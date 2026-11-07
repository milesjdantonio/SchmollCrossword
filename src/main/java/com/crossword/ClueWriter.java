package com.crossword;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.errors.AnthropicIoException;
import com.anthropic.errors.AnthropicServiceException;
import com.anthropic.errors.InternalServerException;
import com.anthropic.errors.RateLimitException;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.StructuredMessageCreateParams;

/*
 * AI-written clues (Claude API).
 *
 * For each puzzle, Claude writes a fresh, original clue for each of its answers at a chosen difficulty ("easy",
 * "medium" or "hard"), a second call reviews them like an editor, and any clue the editor flags is rewritten.
 * Only the answer words are ever sent.
 */
public class ClueWriter {

    private static final Logger LOG = LoggerFactory.getLogger(ClueWriter.class);

    // One answer and its clue, e.g. new Clue("DESK", "Office furniture with drawers").
    // Claude's reply is turned straight into these records (the SDK's "structured output").
    public record Clue(String answer, String clue) {}
    public record ClueSet(List<Clue> clues) {}

    // Quality control: the editor's verdict on one clue, e.g. new Review("TEA", false, "TEA: ...").
    public record Review(String answer, boolean ok, String problem) {}
    public record ReviewSet(List<Review> reviews) {}

    // Thrown when Claude's clues still fail the checks after a retry: nothing half-right is ever saved.
    static class CluesFailed extends RuntimeException {
        CluesFailed(String message) { super(message); }
    }

    // Which Claude models write and review the clues. The host can change them without a new build
    // (CLAUDE_FAST_MODEL, CLAUDE_STRONG_MODEL, CLAUDE_REVIEW_MODEL), e.g. when a model is retired.
    static final String MODEL = setting("CLAUDE_FAST_MODEL", "claude-haiku-5-5");
    // Sonnet writes the clues for hard puzzles, Challenge and Expert grids and boss puzzles, where wordplay and
    // long clue lists need more skill, and it reviews every puzzle's clues.
    static final String STRONG_MODEL = setting("CLAUDE_STRONG_MODEL", "claude-sonnet-5-5");
    static final String REVIEW_MODEL = setting("CLAUDE_REVIEW_MODEL", "claude-sonnet-5-5");

    private static String setting(String name, String fallback) {
        String v = System.getenv(name);
        return v == null || v.isBlank() ? fallback : v.trim();
    }

    // Which model drafts a puzzle's clues. strong = a Challenge/Expert grid or a boss puzzle.
    static String draftModel(String difficulty, boolean strong) {
        return strong || difficulty.equalsIgnoreCase("hard") ? STRONG_MODEL : MODEL;
    }

    // ---------------------------------------------------------------------------------------
    // API key and the client
    // ---------------------------------------------------------------------------------------

    // The key lives OUTSIDE the project folder, so git can never pick it up.
    static final Path KEY_FILE = Path.of(System.getProperty("user.home"), ".schmoll-crossword", "anthropic-api-key.txt");

    // Find the key: the ANTHROPIC_API_KEY environment variable first, then the key file.
    // Returns null if neither exists. Never print what this returns.
    private static String loadApiKey() {
        String fromEnv = System.getenv("ANTHROPIC_API_KEY");
        if (fromEnv != null && !fromEnv.isBlank()) return fromEnv.trim();
        try {
            if (Files.exists(KEY_FILE)) {
                String fromFile = Files.readString(KEY_FILE).trim();
                if (!fromFile.isEmpty()) return fromFile;
            }
        } catch (IOException e) {
            // a file that can't be read counts as "no key"
        }
        return null;
    }

    // True if a key is set up.
    static boolean hasApiKey() {
        return loadApiKey() != null;
    }

    // One client for the whole server (each one holds its own connection pool). A call gives up after 90 seconds
    // and the SDK retries once on its own (rate limits, overload, server errors, dropped connections).
    static final Duration TIMEOUT = Duration.ofSeconds(90);
    private static volatile AnthropicClient client;

    static AnthropicClient client() {
        AnthropicClient c = client;
        if (c != null) return c;
        synchronized (ClueWriter.class) {
            if (client == null) {
                String key = loadApiKey();
                if (key == null) {
                    throw new IllegalStateException("No Anthropic API key found. Set ANTHROPIC_API_KEY or put it in " + KEY_FILE + ".");
                }
                client = AnthropicOkHttpClient.builder().apiKey(key).timeout(TIMEOUT).maxRetries(1).build();
            }
            return client;
        }
    }

    // Every call to Claude goes through this, so the tests can hand in a pretend Claude and never pay for a call.
    interface Asker {
        <T> T ask(String prompt, Class<T> type, String model);
    }
    static volatile Asker asker = ClueWriter::askModel;

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
        sb.append("- Don't lean on bare synonyms. A clue that is just another word for the answer (\"Toss\" for THROW, "
                + "\"Box\" for CRATE) is usually unfair, because several words of that length mean the same thing: "
                + "\"Toss\" fits THROW, PITCH, HEAVE and FLING. Give the definition a detail that only the answer fits "
                + "(\"Wooden box for shipping fruit\" for CRATE), use an example or a famous phrase instead, or describe "
                + "where the word turns up. Use a one-word clue only when no other common word of that length fits it, "
                + "and never for more than one clue in four.\n");
        sb.append("- Only use a fill-in-the-blank (___) for a phrase so well known that just one word fits the blank. "
                + "\"Piece of ___ (something easy)\" works for CAKE; \"Your ___ or mine?\" doesn't, because HOUSE, "
                + "PLACE, ROOM and CAR all fit.\n");
        sb.append("- Every word in a clue should help the solver. Don't tack an extra on the end (\"..., in London\", "
                + "\"..., like a cheetah\", \"..., as a sandwich\") unless it rules out another answer that would "
                + "otherwise fit. \"Hot drink, in London\" for TEA and \"Ran fast, like a cheetah\" for SPED add nothing: "
                + "tea is drunk everywhere, and \"Ran fast\" already says it. Never tie an everyday word to one place: "
                + "METRO is any city's subway, so don't clue it as Paris's.\n");
        sb.append("- Every clue must suit a family puzzle that children play: nothing about sex, bodily functions, drugs or "
                + "drinking. If an answer has a clean meaning, clue that one (PEE is the letter P).\n");
        sb.append("- Keep each clue short: never over 10 words.\n");
        sb.append("- Never put the answer, or a form of it (like DESKS for DESK), in its own clue. That gives it away.\n");
        sb.append("- Write original, creative clues. Don't copy clues from published crosswords.\n");
        sb.append("- Playful, conversational wording is welcome: idioms, everyday slang and a bit of attitude "
                + "(\"Push someone's buttons\", \"Key that sends your text\"), as long as the clue stays exact. "
                + "At easy difficulty, clear always beats clever, and only use idioms almost every English speaker knows.\n");
        sb.append("- Scale each clue to its word, within the difficulty above: if an answer is less familiar, "
                + "make its clue more direct; at medium or hard, a very common word can be more playful or misleading.\n\n");

        sb.append("Style (a small daily crossword):\n");
        sb.append("- Aim for 3 to 8 words per clue.\n");
        sb.append("- Match the answer's grammar: a plural answer gets a plural clue, a past-tense answer a past-tense clue.\n");
        sb.append("- End a clue with '?' only when it is a pun or wordplay.\n");
        sb.append("- Use \"e.g.\", \"for one\" or \"say\" when the clue gives an example of the answer.\n");
        sb.append("- Put a clue in quotation marks when the answer is something people say out loud.\n");
        sb.append("- Keep the tone lively and modern: everyday life, food, tech, pop culture.\n");
        sb.append("- Mix clue types across the puzzle (exact definitions, a famous phrase, an example, something people say), "
                + "but never force a type in.\n\n");

        if (focus != null && !focus.isBlank()) {
            sb.append("This puzzle is a lesson in a crossword-solving course: each level trains one skill, so the solver "
                    + "keeps improving until they solve like a professional. All the rules above still apply. For this puzzle:\n");
            sb.append(focus.strip()).append("\n\n");
        }

        sb.append("Answers (one per line):\n");
        for (String answer : answers) sb.append(answer).append("\n");
        return sb.toString();
    }

    // A retry after the structure was wrong: the same instructions, the previous clues and what was wrong with them.
    static String buildRetryPrompt(List<String> answers, String difficulty, String focus, List<String> problems, ClueSet previous) {
        StringBuilder prompt = new StringBuilder(buildPrompt(answers, difficulty, focus));
        if (previous != null && previous.clues() != null && !previous.clues().isEmpty()) {
            prompt.append("\nYour previous clues:\n");
            for (Clue c : previous.clues()) {
                if (c != null) prompt.append(c.answer()).append(": ").append(c.clue()).append("\n");
            }
        }
        prompt.append("\nYour previous attempt had these problems:\n");
        for (String problem : problems) prompt.append("- ").append(problem).append("\n");
        prompt.append("\nFix every listed problem. Return exactly one clue for each requested answer. "
                + "Keep all the original difficulty and style rules. Do not change answers that already have valid clues "
                + "unless necessary to fix a reported problem.");
        return prompt.toString();
    }

    // A rewrite after the editor's review: only the flagged answers are asked for, with the rest of the puzzle's
    // clues shown so the new ones don't repeat their wording.
    static String buildFixPrompt(ClueSet clues, List<String> flagged, List<String> problems, String difficulty, String focus) {
        StringBuilder prompt = new StringBuilder(buildPrompt(flagged, difficulty, focus));
        prompt.append("\nThe editor sent these clues back:\n");
        for (String problem : problems) prompt.append("- ").append(problem).append("\n");
        prompt.append("\nThe puzzle's other clues stay as they are (don't repeat their wording):\n");
        for (Clue c : clues.clues()) {
            if (c != null && !flagged.contains(c.answer())) prompt.append(c.answer()).append(": ").append(c.clue()).append("\n");
        }
        prompt.append("\nWrite a new clue for each answer listed above, fixing the editor's problem with it.");
        return prompt.toString();
    }

    // ---------------------------------------------------------------------------------------
    // Checking Claude's work
    // ---------------------------------------------------------------------------------------

    // A list of problems with the structure; empty means every check passed.
    static List<String> findProblems(ClueSet clueSet, List<String> answers) {
        List<String> problems = new ArrayList<>();
        Set<String> cluedAnswers = new HashSet<>();
        if (clueSet == null || clueSet.clues() == null) {
            problems.add("missing clue set or clue list");
            return problems;
        }
        for (Clue c : clueSet.clues()) {
            if (c == null) {
                problems.add("null clue entry");
                continue;
            }
            String answer = c.answer() == null ? "" : c.answer().trim().toUpperCase();
            String clueText = c.clue() == null ? "" : c.clue().trim();
            cluedAnswers.add(answer);
            if (!answers.contains(answer)) problems.add("unexpected answer " + answer);
            if (clueText.isEmpty()) problems.add("empty clue for " + answer);
            else if (!answer.isEmpty() && givesAway(clueText, answer)) problems.add("clue for " + answer + " gives away the answer");
        }
        for (String answer : answers) {
            if (!cluedAnswers.contains(answer)) problems.add("missing clue for " + answer);
        }
        return problems;
    }

    // True if a clue contains its answer as a word, or a form of it (DESKS for DESK). Whole words only, so ERA
    // inside "General" or ATE inside "late" doesn't count.
    static boolean givesAway(String clue, String answer) {
        Set<String> one = Set.of(answer);
        for (String word : clue.toUpperCase().split("[^A-Z]+")) {
            if (word.isEmpty()) continue;
            if (word.equals(answer) || App.sharesRoot(word, one)) return true;
        }
        return false;
    }

    // Tidies a clue's text: trimmed, single spaces, and no full stop at the end (crossword clues don't end with
    // one), unless the last word is an abbreviation like "e.g." or "etc.".
    static final Set<String> ABBREVIATIONS = Set.of("e.g.", "i.e.", "etc.", "vs.", "Mr.", "Mrs.", "Ms.", "Dr.", "St.", "Jr.", "Sr.", "Inc.", "Co.", "Ltd.", "Mt.", "No.", "U.S.", "a.m.", "p.m.");
    static String tidy(String clue) {
        if (clue == null) return null;
        String t = clue.replaceAll("\\s+", " ").trim();
        if (t.endsWith(".") && !t.endsWith("..")) {
            String last = t.substring(t.lastIndexOf(' ') + 1);
            if (!ABBREVIATIONS.contains(last) && last.indexOf('.') == last.length() - 1) t = t.substring(0, t.length() - 1).trim();
        }
        return t;
    }
    static ClueSet tidy(ClueSet set) {
        if (set == null || set.clues() == null) return set;
        List<Clue> out = new ArrayList<>();
        for (Clue c : set.clues()) {
            out.add(c == null ? null : new Clue(c.answer() == null ? null : c.answer().trim().toUpperCase(), tidy(c.clue())));
        }
        return new ClueSet(out);
    }

    // ---------------------------------------------------------------------------------------
    // Calling Claude, validating the response, and retrying once if needed
    // ---------------------------------------------------------------------------------------

    // Calls and tokens since the server started, in total and per model (for the cost estimate on the dashboard).
    static final AtomicLong CALLS = new AtomicLong();
    static final AtomicLong INPUT_TOKENS = new AtomicLong();
    static final AtomicLong OUTPUT_TOKENS = new AtomicLong();
    static final Map<String, AtomicLong[]> USAGE = new ConcurrentHashMap<>();   // model -> {calls, input, output}
    // US dollars per million tokens {input, output}; anything unknown is priced like Sonnet, to err on the high side
    static final Map<String, double[]> PRICES = Map.of("claude-haiku-5-5", new double[] {0.10, 0.50}, "claude-sonnet-5-5", new double[] {2.00, 10.00});
    static double estimatedCost() {
        double dollars = 0;
        for (Map.Entry<String, AtomicLong[]> e : USAGE.entrySet()) {
            double[] p = PRICES.getOrDefault(e.getKey(), new double[] {2.00, 10.00});
            dollars += e.getValue()[1].get() / 1e6 * p[0] + e.getValue()[2].get() / 1e6 * p[1];
        }
        return dollars;
    }

    static ClueSet writeClues(List<String> answers, String difficulty) {
        return writeClues(answers, difficulty, "");
    }
    static ClueSet writeClues(List<String> answers, String difficulty, String focus) {
        return writeClues(answers, difficulty, focus, false);
    }

    // strong = true for a Challenge/Expert grid or a boss puzzle (see draftModel).
    // Throws CluesFailed when two drafts in a row fail the structural checks.
    static ClueSet writeClues(List<String> answers, String difficulty, String focus, boolean strong) {
        String model = draftModel(difficulty, strong);
        ClueSet clues = null;
        for (int attempt = 1; attempt <= 2; attempt++) {
            String prompt = attempt == 1 ? buildPrompt(answers, difficulty, focus)
                    : buildRetryPrompt(answers, difficulty, focus, findProblems(clues, answers), clues);
            clues = tidy(ask(prompt, ClueSet.class, model));
            if (findProblems(clues, answers).isEmpty()) {
                return qualityControl(clues, answers, difficulty, focus, model);
            }
            LOG.warn("Clue draft {} for {} answers failed the checks: {}", attempt, answers.size(), findProblems(clues, answers));
        }
        throw new CluesFailed("clues failed the checks twice: " + findProblems(clues, answers));
    }

    // One call, falling back to the fast model when the stronger one is overloaded, rate-limited, down or
    // unreachable. Any other error (a bad request, a missing key) isn't something a second model would fix.
    static <T> T ask(String prompt, Class<T> type, String model) {
        try {
            return asker.ask(prompt, type, model);
        } catch (RuntimeException e) {
            if (model.equals(MODEL) || !fallsBack(e)) throw e;
            LOG.warn("{} failed ({}); asking {} instead", model, e.getClass().getSimpleName(), MODEL);
            return asker.ask(prompt, type, MODEL);
        }
    }

    // The errors worth trying the fast model for
    static boolean fallsBack(RuntimeException e) {
        if (e instanceof RateLimitException || e instanceof InternalServerException || e instanceof AnthropicIoException) return true;
        if (e instanceof AnthropicServiceException s) return s.statusCode() == 529 || s.statusCode() >= 500;
        return e instanceof NoSuchElementException;          // the model declined and sent no answer
    }

    // maxTokens is roomy because the models think before they answer, and thinking counts toward the limit:
    // a reply cut off half way couldn't be read at all. Only the tokens actually used are paid for.
    static <T> T askModel(String prompt, Class<T> type, String model) {
        StructuredMessageCreateParams<T> params = MessageCreateParams.builder()
                .model(model)
                .maxTokens(8000L)
                .outputConfig(type)
                .addUserMessage(prompt)
                .build();
        var response = client().messages().create(params);
        long in = response.usage().inputTokens(), out = response.usage().outputTokens();
        CALLS.incrementAndGet();
        INPUT_TOKENS.addAndGet(in);
        OUTPUT_TOKENS.addAndGet(out);
        AtomicLong[] u = USAGE.computeIfAbsent(model, k -> new AtomicLong[] {new AtomicLong(), new AtomicLong(), new AtomicLong()});
        u[0].incrementAndGet();
        u[1].addAndGet(in);
        u[2].addAndGet(out);
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
     * passes, Claude reviews the clues like an editor would, and the clues it flags are rewritten. The review is a
     * bonus: if it can't be done, the draft is kept as it is.
     */
    static ClueSet qualityControl(ClueSet clues, List<String> answers, String difficulty, String focus, String model) {
        ReviewSet review;
        try {
            review = ask(buildReviewPrompt(clues, difficulty, focus), ReviewSet.class, REVIEW_MODEL);
        } catch (RuntimeException e) {
            LOG.warn("Clue review skipped ({})", e.getClass().getSimpleName());
            return clues;
        }
        List<String> problems = reviewProblems(review, answers);
        if (problems.isEmpty()) return clues;

        List<String> flagged = flaggedAnswers(review, answers);
        ClueSet fixes;
        try {
            fixes = tidy(ask(buildFixPrompt(clues, flagged, problems, difficulty, focus), ClueSet.class, model));
        } catch (RuntimeException e) {
            LOG.warn("Clue rewrite skipped ({})", e.getClass().getSimpleName());
            return clues;
        }
        ClueSet merged = merge(clues, fixes, flagged);
        // keep the rewrite only if the whole set still passes; otherwise the first clues are better than nothing
        return findProblems(merged, answers).isEmpty() ? merged : clues;
    }

    // The draft with the rewritten clues swapped in (only for flagged answers, and only usable ones)
    static ClueSet merge(ClueSet clues, ClueSet fixes, List<String> flagged) {
        Map<String, String> better = new LinkedHashMap<>();
        if (fixes != null && fixes.clues() != null) {
            for (Clue c : fixes.clues()) {
                if (c == null || c.answer() == null || c.clue() == null || c.clue().isBlank()) continue;
                String a = c.answer().trim().toUpperCase();
                if (flagged.contains(a) && !givesAway(c.clue(), a)) better.put(a, c.clue());
            }
        }
        List<Clue> out = new ArrayList<>();
        for (Clue c : clues.clues()) out.add(better.containsKey(c.answer()) ? new Clue(c.answer(), better.get(c.answer())) : c);
        return new ClueSet(out);
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
        sb.append("- It isn't a bare synonym that several words of that length fit (\"Toss\" fits THROW, PITCH, HEAVE and FLING).\n");
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
        for (Clue c : clues.clues()) sb.append(c.answer()).append(": ").append(c.clue()).append("\n");
        return sb.toString();
    }

    // The problems the review found, written the way the rewrite prompt lists them (empty = everything passed).
    static List<String> reviewProblems(ReviewSet review, List<String> answers) {
        List<String> problems = new ArrayList<>();
        if (review == null || review.reviews() == null) return problems;   // no usable review: nothing to fix
        for (Review r : review.reviews()) {
            if (r == null || r.ok() || r.answer() == null) continue;
            String answer = r.answer().trim().toUpperCase();
            if (!answers.contains(answer)) continue;                       // a verdict on an answer not in this puzzle
            boolean noReason = r.problem() == null || r.problem().isBlank();
            problems.add(noReason ? answer + ": the editor flagged this clue" : r.problem().trim());
        }
        return problems;
    }

    // The answers the editor flagged
    static List<String> flaggedAnswers(ReviewSet review, List<String> answers) {
        List<String> flagged = new ArrayList<>();
        if (review == null || review.reviews() == null) return flagged;
        for (Review r : review.reviews()) {
            if (r == null || r.ok() || r.answer() == null) continue;
            String answer = r.answer().trim().toUpperCase();
            if (answers.contains(answer) && !flagged.contains(answer)) flagged.add(answer);
        }
        return flagged;
    }
}
