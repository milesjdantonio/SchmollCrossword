package com.crossword;

import com.anthropic.client.AnthropicClient; // The object that talks to the Claude API
import com.anthropic.client.okhttp.AnthropicOkHttpClient; // The standard way to build that client
import java.io.IOException;
import java.nio.file.Files; // Helpers to read files in one line
import java.nio.file.Path; // A file location, e.g. C:\Users\you\.schmoll-crossword\anthropic-api-key.txt
import java.util.ArrayList;
import java.util.List;

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
        // TODO: your code here
        return ""; // placeholder so the project compiles
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
        // TODO: your code here
        return new ArrayList<>(); // placeholder so the project compiles
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
