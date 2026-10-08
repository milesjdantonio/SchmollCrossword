package com.crossword;

import java.io.IOException;
import java.nio.file.Files; // Helpers to read files in one line
import java.nio.file.Path; // A file location, e.g. C:\Users\you\.schmoll-crossword\anthropic-api-key.txt
import java.util.ArrayList;
import java.util.HashSet; // A Set with instant contains/add (used in findProblems)
import java.util.List;
import java.util.Set; // A collection with no duplicates, good for "have I seen this?"

import com.anthropic.client.AnthropicClient; // The object that talks to the Claude API
import com.anthropic.client.okhttp.AnthropicOkHttpClient; // The standard way to build that client
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.StructuredMessageCreateParams;

/*
 * ===== Step 15: AI-written clues (Claude API) =====
 *
 * For each puzzle, ask Claude to write a fresh, original clue for each of its ~10 answers,
 * at a chosen difficulty ("easy", "medium" or "hard").
 */
public class ClueWriter {

    // One answer and its clue, e.g. new Clue("DESK", "Office furniture with drawers").
    // Claude's reply is turned straight into these records (the SDK's "structured output").
    public record Clue(String answer, String clue) {}
    public record ClueSet(List<Clue> clues) {}

    // Which Claude model writes the clues. Started on claude-opus-5-5 (the most capable); the project owner asked
    // for the cheapest model that still writes good clues (2026-10-08). A side-by-side test showed Haiku (the
    // cheapest) writes easy clues as well as Sonnet, but its hard clues lost the wordplay, so:
    static final String EASY_MODEL = "claude-haiku-4-5-20251001";   // easy: plain definitions
    static final String MODEL = "claude-sonnet-5-5";                // medium and hard: wordplay needs more skill

    static String modelFor(String difficulty) {
        return difficulty.equalsIgnoreCase("easy") ? EASY_MODEL : MODEL;
    }

    // ---------------------------------------------------------------------------------------
    // API key (already done for you). The key is a password for your Anthropic account:
    // anyone who has it can spend your money, so it never goes in the code, in git, or in chat.
    // ---------------------------------------------------------------------------------------

    // The key lives OUTSIDE the project folder, so git can never pick it up.
    static final Path KEY_FILE = Path.of(System.getProperty("user.home"), ".schmoll-crossword", "anthropic-api-key.txt");

    // Find the key: the ANTHROPIC_API_KEY environment variable first, then the key file. Returns null if neither exists.
    // Never print what this returns.
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
            // Can't read the file: treat it as "no key". (Don't print e, in case it ever contains file contents.)
        }
        return null;
    }

    // true if a key is set up. Safe to print, because it only says yes/no.
    static boolean hasApiKey() {
        return loadApiKey() != null;
    }

    // A ready-to-use Claude API client, logged in with your key
    static AnthropicClient createClient() {
        String key = loadApiKey();
        if (key == null) {
            throw new IllegalStateException("No Anthropic API key found. Put it in " + KEY_FILE
                    + " (see 'Claude API key' in README.md).");
        }
        return AnthropicOkHttpClient.builder().apiKey(key).build();
    }

    // ---------------------------------------------------------------------------------------
    // Your part
    // ---------------------------------------------------------------------------------------

    /*
     * ===== Step 15a: Build the prompt =====
     *
     * Write the instructions Claude will get. A prompt is just a String, so build it like formatGrid.
     * It should tell Claude:
     *   - to write ONE original clue for EACH answer in `answers` (list them all)
     *   - the difficulty, and what it means (easy = plain definition, hard = wordplay / misdirection)
     *   - the rules: a clue must never contain its answer (or an obvious form of it, like DESKS for DESK),
     *     must be original (don't reuse clues from published crosswords), and should be short (under ~10 words)
     *
     * Example:  buildPrompt([DESK, CATS], "easy")  ->  "Write one original crossword clue for each answer...
     *                                                   Difficulty: easy ... Answers: DESK, CATS ..."
     *
     * Constraints:
     *   - Every answer must appear in the prompt, and so must the difficulty word.
     *   - Return the String; don't print it here.
     *
     * Related LeetCode: none. Prompt writing is the "AI at work" skill in this step.
     */
    static String buildPrompt(List<String> answers, String difficulty) {
        StringBuilder sb = new StringBuilder();

        sb.append("Write one original crossword clue for each answer below.\n\n");

        // Difficulty, plus what it means, so Claude doesn't have to guess
        sb.append("Difficulty: ").append(difficulty).append(" - ");
        if (difficulty.equalsIgnoreCase("easy")) {             // equalsIgnoreCase: "Easy", "EASY", "easy" all match
            // Made easier at the project owner's request (after playing): most people should get these right away.
            // Made clearer later (2026-10-08): easy clues kept fitting several words, so easy now means "plain and exact"
            sb.append("plain and exact. Clue the word's most common, everyday meaning, so most people get it right away "
                    + "without any crossing letters. No puns, no misdirection, no '?' clues, and nothing that needs "
                    + "special knowledge (sports rules, brand names, science, trivia).\n\n");
        } else if (difficulty.equalsIgnoreCase("medium")) {
            // No niche slang (added after "Get dunked on in replies, online" for RATIO)
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
        // The most important rule (added after "Your ___ or mine?" could have been HOUSE, PLACE, ROOM or CAR)
        sb.append("- Each clue must point to ONE answer. Picture a solver who sees only the clue and how many squares "
                + "the answer fills: your answer should be the first word they think of, and no other common word "
                + "with that many letters should fit just as well. Before you keep a clue, think of other words of "
                + "the same length it could describe; if one fits, add a detail that rules it out. Example: "
                + "\"Farm animal\" fits COW, PIG and HEN, and \"Not at home\" fits both AWAY and GONE, "
                + "so both need a sharper clue.\n");
        sb.append("- Only use a fill-in-the-blank (___) for a phrase so well known that just one word fits the blank. "
                + "\"Piece of ___ (something easy)\" works for CAKE; \"Your ___ or mine?\" doesn't, because HOUSE, "
                + "PLACE, ROOM and CAR all fit.\n");
        // Sharpen a clue with the word's meaning, not with decoration (added after "Subway, in Paris" for METRO)
        sb.append("- Every word in a clue should help the solver. Don't tack an extra on the end (\"..., in London\", "
                + "\"..., like a cheetah\", \"..., as a sandwich\") unless it rules out another answer that would "
                + "otherwise fit. \"Hot drink, in London\" for TEA and \"Ran fast, like a cheetah\" for SPED add nothing: "
                + "tea is drunk everywhere, and \"Ran fast\" already says it. Never tie an everyday word to one place: "
                + "METRO is any city's subway, so don't clue it as Paris's.\n");
        sb.append("- Keep each clue short: never over 10 words.\n");
        sb.append("- Never put the answer, or a form of it (like DESKS for DESK), in its own clue. That gives it away.\n");
        sb.append("- Write original, creative clues. Don't copy clues from published crosswords.\n");
        // Playful wording (chosen over literal-only): idioms and a bit of attitude are welcome, but easy must stay clear
        sb.append("- Playful, conversational wording is welcome: idioms, everyday slang and a bit of attitude "
                + "(\"Push someone's buttons\", \"Key that sends your text\"), as long as the clue stays exact. "
                + "At easy difficulty, clear always beats clever, and only use idioms almost every English speaker knows.\n");
        // Scale each clue to its word: an uncommon answer plus a tricky clue is unfair, a very common one can take more play
        sb.append("- Scale each clue to its word, within the difficulty above: if an answer is less familiar, "
                + "make its clue more direct; at medium or hard, a very common word can be more playful or misleading.\n\n");

        // Standard mini-crossword conventions, described in our own words (no real puzzle's clues are copied)
        sb.append("Style (a small daily crossword):\n");
        sb.append("- Aim for 1 to 6 words per clue.\n");
        sb.append("- Match the answer's grammar: a plural answer gets a plural clue, a past-tense answer a past-tense clue.\n");
        sb.append("- End a clue with '?' only when it is a pun or wordplay.\n");
        sb.append("- Use \"e.g.\", \"for one\" or \"say\" when the clue gives an example of the answer.\n");
        sb.append("- Put a clue in quotation marks when the answer is something people say out loud.\n");
        sb.append("- Keep the tone lively and modern: everyday life, food, tech, pop culture.\n");
        // No more "at least one fill-in-the-blank": forcing one in is how the vague blanks happened
        sb.append("- Mix clue types across the puzzle (straight definitions, a famous phrase, something people say), "
                + "but never force a type in. A clear, exact definition is always a good clue.\n\n");

        sb.append("Answers (one per line):\n");
        for (String answer : answers) {
            sb.append(answer).append("\n");   // append(...) returns the same sb, so calls can be chained
        }

        return sb.toString();
    }

    /*
     * ===== Step 15b: Check Claude's work =====
     *
     * AI output must be checked before it reaches players. Return a list of problems (empty = all good):
     *   - an answer from `answers` that has no clue          -> "missing clue for DESK"
     *   - a clue that contains its own answer (ignore case)   -> "clue for DESK gives away the answer"
     *   - a clue for a word that isn't in `answers`           -> "unexpected answer CHAIR"
     *
     * Example:  answers [DESK, CATS], clues {DESK: "Office furniture", CATS: "Some cats purr"}
     *           -> ["clue for CATS gives away the answer"]
     *
     * Constraints:
     *   - Don't change clueSet or answers.
     *   - Never return null.
     *
     * Related LeetCode: 242. Valid Anagram, 383. Ransom Note (checking one collection against another)
     */
    static List<String> findProblems(ClueSet clueSet, List<String> answers) {
        List<String> problems = new ArrayList<>();
        Set<String> cluedAnswers = new HashSet<>(); // every answer Claude wrote a clue for

        // Pass 1: look at each clue Claude wrote
        for (Clue c : clueSet.clues()) {
            // Claude might send "desk" instead of "DESK", or leave a field out (null), so clean them up first
            String answer = (c.answer() == null) ? "" : c.answer().trim().toUpperCase();
            String clueText = (c.clue() == null) ? "" : c.clue().trim();
            cluedAnswers.add(answer);

            if (!answers.contains(answer)) {
                problems.add("unexpected answer " + answer);
            }
            if (clueText.isEmpty()) {
                problems.add("empty clue for " + answer);
            } else if (clueText.toUpperCase().contains(answer)) {   // compare in uppercase so "cats" matches CATS
                problems.add("clue for " + answer + " gives away the answer");
            }
        }

        // Pass 2: every answer we asked for must have a clue
        for (String answer : answers) {
            if (!cluedAnswers.contains(answer)) {
                problems.add("missing clue for " + answer);
            }
        }

        return problems;
    }

    /*
     * ===== Step 15c: Call Claude =====
     *
     * Send buildPrompt(...) to Claude and get a ClueSet back. This costs a little money per call,
     * so the test in main only runs it when you ask for it (see "live" below).
     *
     * The pieces you need (from the official Java SDK docs):
     *
     *     AnthropicClient client = createClient();
     *     StructuredMessageCreateParams<ClueSet> params = MessageCreateParams.builder()
     *         .model("claude-opus-5-5")
     *         .maxTokens(16000L)
     *         .outputConfig(ClueSet.class)          // "reply as a ClueSet": the SDK makes the JSON schema for you
     *         .addUserMessage(theTextOfYourPrompt)
     *         .build();
     *     var response = client.messages().create(params);
     *     // response.content() is a list of blocks; the text block's .text() is already a ClueSet:
     *     ClueSet result = response.content().stream()
     *         .flatMap(block -> block.text().stream())
     *         .findFirst().orElseThrow()
     *         .text();
     *
     *   Imports: com.anthropic.models.messages.MessageCreateParams and
     *            com.anthropic.models.messages.StructuredMessageCreateParams
     *
     * Constraints:
     *   - Use createClient(); never put the key in code.
     *   - If findProblems finds anything, try once more before giving up (AI output varies).
     *
     * Related LeetCode: none. This is API integration, the most common "AI at work" task.
     */
    static ClueSet writeClues(List<String> answers, String difficulty) {
        AnthropicClient client = createClient();

        StructuredMessageCreateParams<ClueSet> params = MessageCreateParams.builder()
            .model(modelFor(difficulty))                      // see EASY_MODEL and MODEL at the top
            .maxTokens(16000L)
            .outputConfig(ClueSet.class)                       // "reply as a ClueSet": the SDK makes the JSON schema
            .addUserMessage(buildPrompt(answers, difficulty))  // your Step 15a prompt
            .build();

        ClueSet clues = null;
        for (int attempt = 1; attempt <= 2; attempt++) {
            var response = client.messages().create(params);   // ← the actual internet call
            clues = response.content().stream()
                .flatMap(block -> block.text().stream())
                .findFirst().orElseThrow()
                .text();

            if (findProblems(clues, answers).isEmpty()) {   // Step 15b says no problems?
                return clues;                               // good: done
            }
        }
        return clues;   // still had problems after 2 tries: return them anyway, and the live test will show what's wrong
    }
}
