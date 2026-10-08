package com.crossword;

import java.io.IOException;
import java.nio.file.Files; // read/write a whole file in one line
import java.nio.file.Path;  // a file or folder location
import java.time.LocalDate; // a calendar date with no time, e.g. 2026-10-07
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;

/*
 * ===== Step 17: Save generated puzzles =====
 *
 * The daily puzzle must be IDENTICAL for everyone, but Claude writes different clues on every call
 * (and every call costs money). So each daily is written by Claude only the FIRST time it's asked for,
 * then saved as a file and served from the file forever after.
 *
 * Design pass: there are THREE dailies every day, one per difficulty, each with its own grid
 * (seed from date + difficulty), its own word list (easier words on easy) and its own clues.
 *
 *   puzzles/daily/2026-10-07-easy.json     <- three different
 *   puzzles/daily/2026-10-07-medium.json   <- puzzles
 *   puzzles/daily/2026-10-07-hard.json
 */
public class PuzzleStore {

    // Where daily puzzles are saved: puzzles/daily inside the project folder (ignored by git: it's generated data).
    // Step 26: online, the host sets PUZZLE_DIR to a disk that survives restarts; otherwise a restart would lose
    // today's saved clues and the next request would pay Claude to write different ones.
    static final Path DAILY_FOLDER = Path.of(System.getenv().getOrDefault("PUZZLE_DIR", "puzzles"), "daily");

    // The grid shape every puzzle uses for now (black squares top-right and bottom-left)
    static final boolean[][] SHAPE = {
        {false, false, false, false, true},
        {false, false, false, false, false},
        {false, false, false, false, false},
        {false, false, false, false, false},
        {true,  false, false, false, false}
    };

    /*
     * ===== Step 17a: A seed from a date =====
     *
     * Turn a date into a number, so the same date always gives the same seed (and so the same grid).
     *
     * Example:  2026-10-07  ->  20261007      2026-12-25  ->  20261225
     *
     * Tools: date.getYear(), date.getMonthValue(), date.getDayOfMonth() each return an int.
     *        Think of it as building the number year, then month, then day: 2026 * 10000 + 10 * 100 + 7.
     *
     * Related LeetCode: 7. Reverse Integer, 9. Palindrome Number (building numbers digit by digit)
     */
    static long seedForDate(LocalDate date) {
        return date.getYear() * 10000 + date.getMonthValue() * 100 + date.getDayOfMonth();
    }

    // Design pass: each difficulty's daily gets its own seed (date seed + one digit), so its own grid.
    // Example:  2026-10-07 easy -> 202610071, medium -> 202610072, hard -> 202610073, challenge -> 202610074
    static long dailySeed(LocalDate date, String difficulty) {
        int digit = difficulty.equals("easy") ? 1 : difficulty.equals("medium") ? 2 : difficulty.equals("hard") ? 3 : 4;
        return seedForDate(date) * 10 + digit;
    }

    /*
     * ===== Step 17b: Where a daily puzzle lives =====
     *
     * The file for one date and difficulty, inside `folder`.
     *
     * Example:  dailyFile(puzzles/daily, 2026-10-07, "hard")  ->  puzzles/daily/2026-10-07-hard.json
     *
     * Tools: date.toString() gives "2026-10-07". folder.resolve("name.json") gives the file inside the folder.
     */
    static Path dailyFile(Path folder, LocalDate date, String difficulty) {
        String fileName = date.toString() + "-" + difficulty + ".json";
        return folder.resolve(fileName); 
    }

    /*
     * ===== Step 17c: Get today's puzzle, generating it only once =====
     *
     * If the file for this date and difficulty already exists, return what's in it (no API call!).
     * Otherwise: generate it with generateDaily(...), save the JSON to the file, then return it.
     *
     * This "check the saved copy first" idea is the same as matchCache in Step 13b, but the notebook
     * is a file on disk, so it survives restarting the program.
     *
     * Tools:
     *   Files.exists(path)                   -> true if the file is there
     *   Files.readString(path)               -> the whole file as a String
     *   Files.createDirectories(folder)      -> makes the folder (and parents) if missing; harmless if it exists
     *   Files.writeString(path, text)        -> saves text to the file
     *
     * Constraints:
     *   - Never call generateDaily if the file already exists (that would cost money and change the clues).
     *
     * Related LeetCode: 146. LRU Cache (serve from a cache, compute and store on a miss)
     */
    // "synchronized" = only one request at a time may run this. On the website, two players could ask for a new
    // daily at the same moment; without it, both would call Claude and get DIFFERENT clues for the same daily.
    static synchronized String getDaily(Path folder, LocalDate date, String difficulty,
                                        Map<Integer, List<String>> wordsByLength) throws IOException {
        Path file = dailyFile(folder, date, difficulty);

        // Saved already? Serve the saved copy: free, instant, and identical for everyone
        if (Files.exists(file)) {
            return Files.readString(file);
        }

        // First request for this date + difficulty: generate once (one API call), save, return
        String json = generateDaily(date, difficulty, wordsByLength);
        Files.createDirectories(folder);
        Files.writeString(file, json);
        return json;
    }

    // ---------------------------------------------------------------------------------------
    // Already done for you
    // ---------------------------------------------------------------------------------------

    // Fills the SHAPE grid using a seed. The same seed always gives the same grid.
    // "synchronized" (Step 26): the solver shares App's cache, counters and Trie, which aren't safe for two
    // requests to change at the same moment. Filling a grid takes well under a second, so taking turns is fine.
    static synchronized char[][] buildGrid(long seed, Map<Integer, List<String>> wordsByLength) {
        int size = SHAPE.length;
        char[][] grid = new char[size][size];
        for (char[] row : grid) {
            Arrays.fill(row, '.');
        }
        App.solve(new ArrayList<>(Slot.findAllSlots(SHAPE)), grid, wordsByLength, new HashSet<>(), new Random(seed));
        return grid;
    }

    // Challenge mode: a 7x7 grid with random symmetric black squares (see ChallengeGrid). "synchronized" for the
    // same reason as buildGrid: the solver shares App's caches.
    static synchronized ChallengeGrid.Filled buildChallenge(long seed, Map<Integer, List<String>> wordsByLength) {
        return ChallengeGrid.fill(seed, wordsByLength);
    }

    // A challenge puzzle as JSON. Its clues are written at the medium level: the bigger grid and its longer,
    // less common words are the challenge. COSTS MONEY (one API call).
    static String generateChallenge(long seed, String mode, Map<Integer, List<String>> wordsByLength) {
        ChallengeGrid.Filled filled = buildChallenge(seed, wordsByLength);
        List<String> answers = new ArrayList<>();
        for (Slot slot : Slot.findAllSlots(filled.blackSquares())) {
            answers.add(slot.getPattern(filled.grid()));
        }
        ClueWriter.ClueSet clues = ClueWriter.writeClues(answers, "medium");
        return Puzzle.create(filled.blackSquares(), filled.grid(), clues, mode, seed, "challenge").toJson();
    }

    // Makes a brand-new daily puzzle as JSON: grid from the date, clues from Claude. COSTS MONEY (one API call).
    static String generateDaily(LocalDate date, String difficulty, Map<Integer, List<String>> wordsByLength) {
        long seed = dailySeed(date, difficulty);
        if (difficulty.equals("challenge")) return generateChallenge(seed, "daily", wordsByLength);
        char[][] grid = buildGrid(seed, wordsByLength);
        List<String> answers = new ArrayList<>();
        for (Slot slot : Slot.findAllSlots(SHAPE)) {
            answers.add(slot.getPattern(grid));
        }
        ClueWriter.ClueSet clues = ClueWriter.writeClues(answers, difficulty);
        return Puzzle.create(SHAPE, grid, clues, "daily", seed, difficulty).toJson();
    }

    // Makes a brand-new unlimited puzzle as JSON (not saved: every unlimited puzzle is new). COSTS MONEY (one API call).
    static String generateUnlimited(long seed, String difficulty, Map<Integer, List<String>> wordsByLength) {
        if (difficulty.equals("challenge")) return generateChallenge(seed, "unlimited", wordsByLength);
        char[][] grid = buildGrid(seed, wordsByLength);
        List<String> answers = new ArrayList<>();
        for (Slot slot : Slot.findAllSlots(SHAPE)) {
            answers.add(slot.getPattern(grid));
        }
        ClueWriter.ClueSet clues = ClueWriter.writeClues(answers, difficulty);
        return Puzzle.create(SHAPE, grid, clues, "unlimited", seed, difficulty).toJson();
    }
}
