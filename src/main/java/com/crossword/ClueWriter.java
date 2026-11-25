package com.crossword;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.StructuredMessageCreateParams;

/*
 * AI-written clues (Claude API).
 *
 * For each puzzle, ask Claude to write a fresh, original clue for each of its ~10 answers,
 * at a chosen difficulty ("easy", "medium" or "hard").
 */
public class ClueWriter {

    // One answer and its clue, e.g. new Clue("DESK", "Office furniture with drawers").
    // Claude's reply is turned straight into these records (the SDK's "structured output").
    public record Clue(String answer, String clue) {}
    public record ClueSet(List<Clue> clues) {}

    // Quality control: the editor's verdict on one clue, e.g. new Review("TEA", false, "TEA: ...").
    public record Review(String answer, boolean ok, String problem) {}
    public record ReviewSet(List<Review> reviews) {}

    // Which Claude model writes the clues.
    static final String EASY_MODEL = "claude-haiku-5-5";
    static final String MODEL = "claude-haiku-5-5";

    static String modelFor(String difficulty) {
        return difficulty.equalsIgnoreCase("easy") ? EASY_MODEL : MODEL;
    }

    // The stronger model: Sonnet 5.5 writes the clues for hard puzzles, Challenge and Expert
    // grids, and boss puzzles, where wordplay and long clue lists need more skill; and it reviews every puzzle's clues.
    static final String STRONG_MODEL = "claude-sonnet-5-5";
    static final String REVIEW_MODEL = "claude-sonnet-5-5";

    // Which model drafts a puzzle's clues. strong = a Challenge/Expert grid or a boss puzzle.
    static String draftModel(String difficulty, boolean strong) {
        return strong || difficulty.equalsIgnoreCase("hard") ? STRONG_MODEL : modelFor(difficulty);
    }

    // ---------------------------------------------------------------------------------------
    // API key
    // ---------------------------------------------------------------------------------------

    // The key lives OUTSIDE the project folder, so git can never pick it up.
    static final Path KEY_FILE = Path.of(
            System.getProperty("user.home"),
            ".schmoll-crossword",
            "anthropic-api-key.txt");

    // Find the key: the ANTHROPIC_API_KEY environment variable first, then the key file.
    // Returns null if neither exists. Never print what this returns.
    private static String loadApiKey() {
        String fromEnv = System.getenv("ANTHROPIC_API_KEY");

        if (fromEnv != null && !fromEnv.isBlank()) {
            return fromEnv.trim();
        }

        try {
            if (Files.exists(KEY_FILE)) {
                String fromFile = Files.readString(KEY_FILE).trim();

                if (!fromFile.isEmpty()) {
                    return fromFile;
                }
            }
        } catch (IOException e) {
            // Treat a file-reading error as "no key".
        }

        return null;
    }

    // True if a key is set up.
    static boolean hasApiKey() {
        return loadApiKey() != null;
    }

    // A ready-to-use Claude API client, logged in with your key.
    static AnthropicClient createClient() {
        String key = loadApiKey();

        if (key == null) {
            throw new IllegalStateException(
                    "No Anthropic API key found. Put it in " + KEY_FILE
                    + " (see 'Claude API key' in README.md).");
        }

        return AnthropicOkHttpClient.builder().apiKey(key).build();
    }

    // ---------------------------------------------------------------------------------------
    // The prompt
    // ---------------------------------------------------------------------------------------

    static String buildPrompt(List<String> answers, String difficulty) {
        return buildPrompt(answers, difficulty, "");
    }

    // Campaign levels are lessons. The focus says what the puzzle's clues should train.
    // An empty focus means a normal puzzle.
    static String buildPrompt(List<String> answers, String difficulty, String focus) {
        StringBuilder sb = new StringBuilder();

        sb.append("Write one original crossword clue for each answer below.\n\n");

        // Difficulty and its meaning.
        sb.append("Difficulty: ").append(difficulty).append(" - ");

        if (difficulty.equalsIgnoreCase("easy")) {
            sb.append("plain and exact. Clue the word's most common, everyday meaning, so most people get it right away "
                    + "without any crossing letters. No puns, no misdirection, no '?' clues, and nothing that needs "
                    + "special knowledge (sports rules, brand names, science, trivia).\n\n");

        } else if (difficulty.equalsIgnoreCase("medium")) {
            sb.append("mostly straightforward, with a little play: some clues use an association, an example, "
                    + "or a common second meaning, so most solvers get them after a moment's thought. The play must "
                    + "use meanings most adults know: no internet or niche slang.\n\n");

        } else if (difficulty.equalsIgnoreCase("hard")) {
            sb.append("clever but fair. Use less obvious meanings or light misdirection, with a pun now and then "
                    + "(end punny clues with '?'). An experienced solver should still get most clues without crossings.\n\n");

        } else {
            sb.append("use your judgment.\n\n");
        }

        sb.append("Rules:\n");

        sb.append("- Each clue must point to ONE answer. Picture a solver who sees only the clue and how many squares "
                + "the answer fills: your answer should be the first word they think of, and no other common word "
                + "with that many letters should fit just as well. Before you keep a clue, think of other words of "
                + "the same length it could describe; if one fits, add a detail that rules it out. Example: "
                + "\"Farm animal\" fits COW, PIG and HEN, and \"Not at home\" fits both AWAY and GONE, "
                + "so both need a sharper clue.\n");

        sb.append("- Only use a fill-in-the-blank (___) for a phrase so well known that just one word fits the blank. "
                + "\"Piece of ___ (something easy)\" works for CAKE; \"Your ___ or mine?\" doesn't, because HOUSE, "
                + "PLACE, ROOM and CAR all fit.\n");

        sb.append("- Every word in a clue should help the solver. Don't tack an extra on the end (\"..., in London\", "
                + "\"..., like a cheetah\", \"..., as a sandwich\") unless it rules out another answer that would "
                + "otherwise fit. \"Hot drink, in London\" for TEA and \"Ran fast, like a cheetah\" for SPED add nothing: "
                + "tea is drunk everywhere, and \"Ran fast\" already says it. Never tie an everyday word to one place: "
                + "METRO is any city's subway, so don't clue it as Paris's.\n");

        sb.append("- Keep each clue short: never over 10 words.\n");
        sb.append("- Never put the answer, or a form of it (like DESKS for DESK), in its own clue. That gives it away.\n");
        sb.append("- Write original, creative clues. Don't copy clues from published crosswords.\n");

        sb.append("- Playful, conversational wording is welcome: idioms, everyday slang and a bit of attitude "
                + "(\"Push someone's buttons\", \"Key that sends your text\"), as long as the clue stays exact. "
                + "At easy difficulty, clear always beats clever, and only use idioms almost every English speaker knows.\n");

        sb.append("- Scale each clue to its word, within the difficulty above: if an answer is less familiar, "
                + "make its clue more direct; at medium or hard, a very common word can be more playful or misleading.\n\n");

        sb.append("Style (a small daily crossword):\n");
        sb.append("- Aim for 1 to 6 words per clue.\n");
        sb.append("- Match the answer's grammar: a plural answer gets a plural clue, a past-tense answer a past-tense answer.\n");
        sb.append("- End a clue with '?' only when it is a pun or wordplay.\n");
        sb.append("- Use \"e.g.\", \"for one\" or \"say\" when the clue gives an example of the answer.\n");
        sb.append("- Put a clue in quotation marks when the answer is something people say out loud.\n");
        sb.append("- Keep the tone lively and modern: everyday life, food, tech, pop culture.\n");
        sb.append("- Mix clue types across the puzzle (straight definitions, a famous phrase, something people say), "
                + "but never force a type in. A clear, exact definition is always a good clue.\n\n");

        if (focus != null && !focus.isBlank()) {
            sb.append("This puzzle is a lesson in a crossword-solving course: each level trains one skill, so the solver "
                    + "keeps improving until they solve like a professional. All the rules above still apply. For this puzzle:\n");
            sb.append(focus.strip()).append("\n\n");
        }

        sb.append("Answers (one per line):\n");

        for (String answer : answers) {
            sb.append(answer).append("\n");
        }

        return sb.toString();
    }

    // ---------------------------------------------------------------------------------------
    // A retry prompt
    // ---------------------------------------------------------------------------------------

    /*
     * Reuses the original instructions and adds the problems found in the previous response.
     * This gives Claude specific feedback instead of simply asking it to try again.
     */
    private static String buildRetryPrompt(
            List<String> answers,
            String difficulty,
            String focus,
            List<String> problems,
            ClueSet previous) {

        StringBuilder prompt = new StringBuilder(
                buildPrompt(answers, difficulty, focus));

        // Show the previous clues (when there are any), so the good ones can be kept as they are.
        if (previous != null && previous.clues() != null && !previous.clues().isEmpty()) {
            prompt.append("\nYour previous clues:\n");

            for (Clue c : previous.clues()) {
                if (c != null) {
                    prompt.append(c.answer()).append(": ").append(c.clue()).append("\n");
                }
            }
        }

        prompt.append("\nYour previous attempt had these problems:\n");

        for (String problem : problems) {
            prompt.append("- ").append(problem).append("\n");
        }

        prompt.append("\nFix every listed problem. ");
        prompt.append("Return exactly one clue for each requested answer. ");
        prompt.append("Keep all the original difficulty and style rules. ");
        prompt.append("Do not change answers that already have valid clues ");
        prompt.append("unless necessary to fix a reported problem.");

        return prompt.toString();
    }

    // ---------------------------------------------------------------------------------------
    // Checking Claude's work
    // ---------------------------------------------------------------------------------------

    /*
     * Returns a list of problems. An empty list means all checks passed.
     */
    static List<String> findProblems(ClueSet clueSet, List<String> answers) {
        List<String> problems = new ArrayList<>();
        Set<String> cluedAnswers = new HashSet<>();

        // Handle a missing or incomplete response safely.
        if (clueSet == null || clueSet.clues() == null) {
            problems.add("missing clue set or clue list");
            return problems;
        }

        // Pass 1: look at each clue Claude wrote.
        for (Clue c : clueSet.clues()) {
            if (c == null) {
                problems.add("null clue entry");
                continue;
            }

            String answer = (c.answer() == null)
                    ? ""
                    : c.answer().trim().toUpperCase();

            String clueText = (c.clue() == null)
                    ? ""
                    : c.clue().trim();

            cluedAnswers.add(answer);

            if (!answers.contains(answer)) {
                problems.add("unexpected answer " + answer);
            }

            if (clueText.isEmpty()) {
                problems.add("empty clue for " + answer);
            } else if (!answer.isEmpty()
                    && clueText.toUpperCase().contains(answer)) {
                problems.add("clue for " + answer + " gives away the answer");
            }
        }

        // Pass 2: every answer we asked for must have a clue.
        for (String answer : answers) {
            if (!cluedAnswers.contains(answer)) {
                problems.add("missing clue for " + answer);
            }
        }

        return problems;
    }

    // ---------------------------------------------------------------------------------------
    // Calling Claude, validating the response, and retrying once if needed
    // ---------------------------------------------------------------------------------------

    // Counts calls and tokens since the server or batch started.
    static final java.util.concurrent.atomic.AtomicLong CALLS =
            new java.util.concurrent.atomic.AtomicLong();

    static final java.util.concurrent.atomic.AtomicLong INPUT_TOKENS =
            new java.util.concurrent.atomic.AtomicLong();

    static final java.util.concurrent.atomic.AtomicLong OUTPUT_TOKENS =
            new java.util.concurrent.atomic.AtomicLong();

    static ClueSet writeClues(List<String> answers, String difficulty) {
        return writeClues(answers, difficulty, "");
    }

    // Same method for a campaign lesson.
    static ClueSet writeClues(
            List<String> answers,
            String difficulty,
            String focus) {
        return writeClues(answers, difficulty, focus, false);
    }

    // strong = true for a Challenge/Expert grid or a boss puzzle (see draftModel)
    static ClueSet writeClues(
            List<String> answers,
            String difficulty,
            String focus,
            boolean strong) {

        AnthropicClient client = createClient();
        String model = draftModel(difficulty, strong);
        ClueSet clues = null;

        // First attempt plus one retry maximum.
        for (int attempt = 1; attempt <= 2; attempt++) {
            String prompt;

            if (attempt == 1) {
                // First attempt: use the normal prompt.
                prompt = buildPrompt(answers, difficulty, focus);
            } else {
                // Retry: tell Claude exactly what failed in its previous response.
                List<String> problems = findProblems(clues, answers);
                prompt = buildRetryPrompt(answers, difficulty, focus, problems, clues);
            }

            clues = ask(client, prompt, ClueSet.class, model);

            // If the structure is right, stop retrying and let quality control check the content.
            if (findProblems(clues, answers).isEmpty()) {
                return qualityControl(client, clues, answers, difficulty, focus, model);
            }
        }

        // If both attempts fail validation, return the latest response.
        return clues;
    }

    // One call to Claude with a structured answer (a ClueSet or a ReviewSet).
    // maxTokens is roomy because the models think before they answer, and thinking counts toward the limit:
    // a reply cut off half way couldn't be read at all. You only pay for the tokens actually used.
    // If Sonnet's call fails or declines (no answer comes back), the same request goes to Haiku instead.
    private static <T> T ask(AnthropicClient client, String prompt, Class<T> type, String model) {
        try {
            return askModel(client, prompt, type, model);
        } catch (RuntimeException e) {
            if (model.equals(MODEL)) throw e;
            return askModel(client, prompt, type, MODEL);
        }
    }

    // The live site closes on this date while the new version is finished (CLOSED_FROM in the environment, a date like
    // 2026-11-29, New York time; set it empty to turn this off). From then on no request can make a paid call.
    static final String CLOSED_FROM = System.getenv().getOrDefault("CLOSED_FROM", "2026-11-29");

    static boolean closed() {
        if (CLOSED_FROM.isBlank()) return false;
        try {
            return !java.time.LocalDate.now(java.time.ZoneId.of("America/New_York")).isBefore(java.time.LocalDate.parse(CLOSED_FROM.trim()));
        } catch (java.time.DateTimeException e) {
            return false;
        }
    }

    private static <T> T askModel(AnthropicClient client, String prompt, Class<T> type, String model) {
        if (closed()) throw new IllegalStateException("The site is closed for the update, so no clues are written.");
        StructuredMessageCreateParams<T> params =
                MessageCreateParams.builder()
                        .model(model)
                        .maxTokens(8000L)
                        .outputConfig(type)
                        .addUserMessage(prompt)
                        .build();

        var response = client.messages().create(params);

        // Track API usage so the cost can be estimated.
        CALLS.incrementAndGet();
        INPUT_TOKENS.addAndGet(response.usage().inputTokens());
        OUTPUT_TOKENS.addAndGet(response.usage().outputTokens());

        return response.content().stream()
                .flatMap(block -> block.text().stream())
                .findFirst()
                .orElseThrow()
                .text();
    }

    // ---------------------------------------------------------------------------------------
    // Quality control
    // ---------------------------------------------------------------------------------------

    /*
     * findProblems only checks the STRUCTURE (one clue per answer, no answer inside its clue). It can't tell
     * whether a clue is TRUE, or whether a solver could actually get the answer from it. So once the structure
     * passes, Claude reviews the clues like an editor would, and anything it flags goes back through the retry
     * builder above to be rewritten. At most two extra calls per puzzle: one review, one rewrite.
     */
    static ClueSet qualityControl(
            AnthropicClient client,
            ClueSet clues,
            List<String> answers,
            String difficulty,
            String focus,
            String model) {

        // the review is always Sonnet 5.5 (a stricter editor than Haiku, which passed every clue in testing);
        // the rewrite is done by the model that wrote the draft
        ReviewSet review = ask(client, buildReviewPrompt(clues, difficulty, focus), ReviewSet.class, REVIEW_MODEL);
        List<String> problems = reviewProblems(review, answers);

        // Every clue passed the review: keep them.
        if (problems.isEmpty()) {
            return clues;
        }

        ClueSet rewrite = ask(client, buildRetryPrompt(answers, difficulty, focus, problems, clues), ClueSet.class, model);

        // Keep the rewrite only if its structure is still right; otherwise the first clues are better than nothing.
        return findProblems(rewrite, answers).isEmpty() ? rewrite : clues;
    }

    // The editor's instructions: check each clue for more than its structure.
    static String buildReviewPrompt(ClueSet clues, String difficulty, String focus) {
        StringBuilder sb = new StringBuilder();

        sb.append("You are the editor of a small daily crossword. Review each clue below for the answer it goes with.\n");
        sb.append("Difficulty: ").append(difficulty).append(".\n");

        if (focus != null && !focus.isBlank()) {
            sb.append("This puzzle is a lesson. Its clues were asked to do this: ").append(focus.strip()).append("\n");
        }

        sb.append("\nA clue passes only if ALL of these are true:\n");
        sb.append("- It is TRUE: every fact in it is correct, and the answer really means what the clue says.\n");
        sb.append("- It is EXACT: it describes the answer itself, not something close to it. A roller coaster's loop is not a "
                + "\"twist\", and a ladder is not a \"stair\". Be strict here: if a clearly more exact clue is easy to think of, flag it.\n");
        sb.append("- It points to ONE answer: no other common word with the same number of letters fits as well.\n");
        sb.append("- It is HELPFUL and fair: a solver at this difficulty can get the answer from it.\n");
        sb.append("- Its grammar matches the answer: plural with plural, past tense with past tense, and so on.\n");
        sb.append("- A fill-in-the-blank (___) is a well-known phrase that only the answer completes.\n");
        sb.append("- It doesn't contain the answer or a form of it, and has 10 words or fewer.\n");
        sb.append("- It is clean enough for a family puzzle.\n\n");

        sb.append("For each answer, return ok = true if its clue passes. If it fails, return ok = false and, in problem, "
                + "one short sentence that starts with the answer and says what's wrong "
                + "(\"TEA: tea isn't only drunk in London\"). Only flag real problems: a plain clue is fine, but a vague or "
                + "only-roughly-right one is a real problem.\n\n");

        sb.append("Clues (ANSWER: clue):\n");

        for (Clue c : clues.clues()) {
            sb.append(c.answer()).append(": ").append(c.clue()).append("\n");
        }

        return sb.toString();
    }

    // The problems the review found, written the way the retry builder lists them (empty = everything passed).
    static List<String> reviewProblems(ReviewSet review, List<String> answers) {
        List<String> problems = new ArrayList<>();

        // No usable review: treat it as "nothing found" rather than rewriting good clues blindly.
        if (review == null || review.reviews() == null) {
            return problems;
        }

        for (Review r : review.reviews()) {
            if (r == null || r.ok() || r.answer() == null) {
                continue;
            }

            String answer = r.answer().trim().toUpperCase();

            // Ignore verdicts about answers that aren't in this puzzle.
            if (!answers.contains(answer)) {
                continue;
            }

            boolean noReason = r.problem() == null || r.problem().isBlank();
            problems.add(noReason ? answer + ": the editor flagged this clue" : r.problem().trim());
        }

        return problems;
    }
}