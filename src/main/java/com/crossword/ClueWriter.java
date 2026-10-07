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
            sb.append("not a dictionary definition. Use a synonym, a fill-in-the-blank phrase, or a common association, "
                    + "so a casual solver needs a moment's thought.\n\n");
        } else if (difficulty.equalsIgnoreCase("medium")) {
            sb.append("indirect. Lean on less obvious meanings of the word and surface misdirection, "
                    + "so an experienced solver gets it but a casual solver may need the crossing words.\n\n");
        } else if (difficulty.equalsIgnoreCase("hard")) {
            sb.append("tricky. Use heavy misdirection, puns or wordplay (end punny clues with '?'), "
                    + "uncommon meanings, or trivia. Still fair: once solved, the clue must clearly fit the answer.\n\n");
        } else {
            sb.append("use your judgment.\n\n");
        }

        sb.append("Rules:\n");
        sb.append("- Keep each clue short: never over 10 words.\n");
        sb.append("- Never put the answer, or a form of it (like DESKS for DESK), in its own clue. That gives it away.\n");
        sb.append("- Write original, creative clues. Don't copy clues from published crosswords.\n\n");

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
        // TODO: your code here
        return new ClueSet(new ArrayList<>()); // placeholder so the project compiles
    }
}
