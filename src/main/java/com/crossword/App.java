package com.crossword;

import java.io.BufferedReader; // Used for efficient text reading, reads the whole text instead of each char
import java.io.IOException; // Used with dealing with files, networks, and streams, IO touches outside world(must account for)
import java.io.InputStream; // Takes inputs as bytes
import java.io.InputStreamReader; // Translates input bytes to char
import java.util.ArrayList; // You Know This
import java.util.Arrays; // Helper tools for arrays, e.g. Arrays.fill sets every spot to one value
import java.util.Collections; // Helper tools for lists, e.g. Collections.shuffle mixes a list into random order
import java.util.HashMap; // Hashes the map to find faster(theres 100,000 words)
import java.util.HashSet; // A Set that uses hashing, so contains/add/remove are instant even with lots of items
import java.util.List; // You know this
import java.util.Map; // Stores a key and a value, able to find resources easily, very similar to array but can search by variable and location
import java.util.Random; // Makes "random" numbers; the same seed always gives the same sequence
import java.util.Set; // A collection with no duplicates and no order, good for "have I seen this already?"

public class App {
    /*
     * ===== Step 13b-1: Measure findMatches =====
     *
     * Before making findMatches faster, find out how it is used. Inside findMatches:
     *   - add 1 to findMatchesCalls every time it runs
     *   - if this exact pattern was seen before, add 1 to repeatedPatterns;
     *     otherwise remember it in patternsSeen
     *
     * Example:  findMatches("C.T.") twice, then findMatches("CAT")
     *           -> findMatchesCalls = 3, repeatedPatterns = 1 (the second "C.T."), patternsSeen = {C.T., CAT}
     *
     * Constraints:
     *   - Don't change what findMatches returns. Only count.
     *   - The tests reset these to 0 / empty before measuring.
     *
     * Related LeetCode: 217. Contains Duplicate (a Set to spot "seen this before")
     *
     * These are STATIC FIELDS: variables that belong to the whole class, not to one method call.
     * A normal variable inside findMatches starts fresh on every call. These keep counting across calls.
     */
    static long findMatchesCalls = 0;
    static long repeatedPatterns = 0;
    static Set<String> patternsSeen = new HashSet<>();

    /*
     * ===== Step 13b-2: Cache findMatches =====
     *
     * 94% of findMatches calls ask about a pattern that was already worked out. Remember the answers:
     *   - matchCache maps a pattern to the list of words that fit it, e.g. "C.T." -> [CATS, CITE, CITY, ...]
     *   - At the start of findMatches (after the 13b-1 counting): if the pattern is in matchCache,
     *     return the saved answer right away, without scanning any words.
     *   - At the end: save the answer in matchCache before returning it.
     *
     * Example:  findMatches("C.T.") scans and saves it; the next findMatches("C.T.") skips the scan.
     *
     * Constraints:
     *   - The caller must be able to change the list it gets back (solve shuffles it!) without
     *     changing what's saved in the cache. Hint: hand back a COPY, new ArrayList<>(someList).
     *   - The cache assumes one word list per program run (the key is only the pattern).
     *
     * Related LeetCode: 509. Fibonacci Number, 70. Climbing Stairs (memoization: save answers you'll need again)
     */
    static Map<String, List<String>> matchCache = new HashMap<>();

    public static void main(String[] args) throws IOException {
        Map<Integer, List<String>> wordsByLength = loadWords();

        for (int length = 3; length <= 7; length++) {
            List<String> words = wordsByLength.getOrDefault(length, new ArrayList<>()); // getOrDefault defaults instead of null
            System.out.println(length + "-letter words: " + words.size());
        } 

         boolean[][] blackSquares = {
            {false, false, false, false, true},
            {false, false, false, false, false},
            {false, false, false, false, false},
            {false, false, false, false, false},
            {true,  false, false, false, false}
        };

        int size = blackSquares.length;
        char[][] filledGrid = new char[size][size];
        for (int row = 0; row < size; row++) {
            for (int col = 0; col < size; col++) {
                filledGrid[row][col] = '.';
            }
        }  

        // Step 6 test: put a few letters in by hand so the patterns aren't all dots
        filledGrid[0][0] = 'C';
        filledGrid[0][2] = 'T';
        filledGrid[2][1] = 'A';

        List<Slot> allSlots = Slot.findAllSlots(blackSquares);
        for (Slot slot : allSlots) {
            System.out.println(slot + "  pattern: " + slot.getPattern(filledGrid));
        }

        // Step 7 tests: like LeetCode's "Run" button. All should say PASS once findMatches works.
        System.out.println();
        testFindMatches("C.T.", 6, wordsByLength);                         // CATS, CITE, CITY, COTS, CUTE, CUTS (COTE is too hard)
        testFindMatches("CAT", 1, wordsByLength);                          // already a full word
        testFindMatches(".....", 3489, wordsByLength);                     // every Wordle-level 5-letter word (blocked and too-hard words skipped)
        testFindMatches("QZX..", 0, wordsByLength);                        // nothing fits
        testFindMatches("...............................", 0, wordsByLength); // no words this long at all

        // Step 8 tests: place two crossing words, then undo them one at a time
        System.out.println();
        char[][] grid = new char[size][size];
        for (char[] row : grid) {
            Arrays.fill(row, '.'); // sets every spot in this row to '.', same as the nested loop above
        }
        Slot across = new Slot(0, 0, 4, true);  // top row, 4 long
        Slot down = new Slot(0, 0, 4, false);   // left column, 4 long; shares square (0,0) with `across`

        List<int[]> acrossCells = across.placeWord(grid, "CATS");
        check("place CATS across: pattern", across.getPattern(grid), "CATS");
        check("place CATS across: squares filled", acrossCells.size(), 4);

        List<int[]> downCells = down.placeWord(grid, "COAT");
        check("place COAT down: pattern", down.getPattern(grid), "COAT");
        check("place COAT down: squares filled", downCells.size(), 3);   // the C was already there

        down.removeWord(grid, downCells);
        check("remove COAT: down pattern", down.getPattern(grid), "C...");
        check("remove COAT: across untouched", across.getPattern(grid), "CATS"); // the tricky one

        across.removeWord(grid, acrossCells);
        check("remove CATS: across pattern", across.getPattern(grid), "....");

        // Step 9 tests: fill the whole 5x5 grid
        System.out.println();
        char[][] puzzle = new char[size][size];
        for (char[] row : puzzle) {
            Arrays.fill(row, '.');
        }

        // new ArrayList<>(allSlots) makes a COPY, because solve takes slots out of the list it's given
        boolean solved = solve(new ArrayList<>(allSlots), puzzle, wordsByLength, new HashSet<>(), new Random(1));
        check("solve: found a fill", solved, true);
        for (Slot slot : allSlots) {
            String answer = slot.getPattern(puzzle);
            check("solve: " + slot + " is a real word", findMatches(answer, wordsByLength).size(), 1);
        }
        for (char[] row : puzzle) {
            System.out.println(new String(row)); // turns a char[] into a String, e.g. "CATS."
        }

        // Step 10 tests: every answer in the puzzle must be different
        Set<String> answers = new HashSet<>();
        for (Slot slot : allSlots) {
            answers.add(slot.getPattern(puzzle)); // a Set ignores duplicates, so repeats don't count twice
        }
        check("no repeats: all " + allSlots.size() + " answers different", answers.size(), allSlots.size());

        // An impossible grid: no 3-letter word starts with QZX, so solve must give up and return false.
        // List.of(...) can't be changed, so wrap it in new ArrayList<>(...) because solve removes slots.
        Slot tiny = new Slot(0, 0, 3, true);
        char[][] stuck = { {'Q', 'Z', 'X'}, {'.', '.', '.'}, {'.', '.', '.'} };
        check("solve: impossible grid returns false", solve(new ArrayList<>(List.of(tiny)), stuck, wordsByLength, new HashSet<>(), new Random(0)), false);

        // CAT is already filled in. Allowed if CAT hasn't been used, blocked if it has.
        char[][] catGrid = { {'C', 'A', 'T'}, {'.', '.', '.'}, {'.', '.', '.'} };
        check("no repeats: CAT allowed when unused", solve(new ArrayList<>(List.of(tiny)), catGrid, wordsByLength, new HashSet<>(), new Random(0)), true);
        Set<String> alreadyUsed = new HashSet<>();
        alreadyUsed.add("CAT");
        check("no repeats: CAT blocked when used", solve(new ArrayList<>(List.of(tiny)), catGrid, wordsByLength, alreadyUsed, new Random(0)), false);

        // Step 11 tests: turn a grid into nice text. "\n" means "new line".
        System.out.println();
        boolean[][] miniBlack = {
            {false, false, true},
            {false, false, false},
            {true,  false, false}
        };
        char[][] miniFull = { {'C', 'A', '.'}, {'O', 'N', 'E'}, {'.', 'D', 'O'} };
        check("format: full 3x3", formatGrid(miniFull, miniBlack), "C A #\nO N E\n# D O\n");

        char[][] miniHalf = { {'C', '.', '.'}, {'.', '.', '.'}, {'.', '.', 'O'} };
        check("format: empty squares stay '.'", formatGrid(miniHalf, miniBlack), "C . #\n. . .\n# . O\n");

        System.out.println();
        System.out.print(formatGrid(puzzle, blackSquares)); // the real 5x5 puzzle from Step 9

        // Step 12a tests: shuffled candidates. Same seed = same puzzle, different seed = different puzzle.
        System.out.println();
        String seed1 = generate(allSlots, blackSquares, wordsByLength, 1);
        String seed1Again = generate(allSlots, blackSquares, wordsByLength, 1);
        String seed2 = generate(allSlots, blackSquares, wordsByLength, 2);
        check("shuffle: same seed gives the same puzzle", seed1Again, seed1);
        check("shuffle: different seeds give different puzzles", seed1.equals(seed2), false);
        check("shuffle: seed 1 no longer starts with AAHS", seed1.startsWith("A A H S"), false);

        // Step 12b-1 tests: pick the slot with the fewest matching words
        System.out.println();
        char[][] pickGrid = new char[size][size];
        for (char[] row : pickGrid) {
            Arrays.fill(row, '.');
        }
        // Empty grid: 4-letter slots (2120 words) beat 5-letter slots (4014). On a tie, keep the earliest.
        check("pick: empty grid", pickMostConstrained(allSlots, pickGrid, wordsByLength).toString(), "Across at (0, 0), length 4");

        // Q at row 2, col 1: Across(2,0) is ".Q..." (7 words), Down(0,1) is "..Q.." (2 words)
        pickGrid[2][1] = 'Q';
        check("pick: fewest options wins", pickMostConstrained(allSlots, pickGrid, wordsByLength).toString(), "Down at (0, 1), length 5");

        // Q at row 3, col 0 too: Down(0,0) is "...Q" and no word ends in Q (0 words), a dead end
        pickGrid[3][0] = 'Q';
        check("pick: dead end (0 options) wins", pickMostConstrained(allSlots, pickGrid, wordsByLength).toString(), "Down at (0, 0), length 4");

        // Step 12b-2 tests: solve picks its own order, so it gets allSlots straight from findAllSlots
        System.out.println();
        long start = System.currentTimeMillis(); // current time in milliseconds, used as a stopwatch
        for (long seed = 1; seed <= 5; seed++) {
            char[][] smartGrid = new char[size][size];
            for (char[] row : smartGrid) {
                Arrays.fill(row, '.');
            }
            boolean ok = solve(new ArrayList<>(allSlots), smartGrid, wordsByLength, new HashSet<>(), new Random(seed));
            Set<String> smartAnswers = new HashSet<>();
            boolean allReal = true;
            for (Slot slot : allSlots) {
                String answer = slot.getPattern(smartGrid);
                smartAnswers.add(answer);
                if (findMatches(answer, wordsByLength).size() != 1) {
                    allReal = false;
                }
            }
            check("smart solve seed " + seed + ": filled, real words, no repeats", ok && allReal && smartAnswers.size() == allSlots.size(), true);
        }
        long elapsed = System.currentTimeMillis() - start;
        // The limit catches disasters (a fixed slot order took 200+ seconds), not normal variation.
        // Raised from 5s to 15s in Step 13 (the smaller word list means more dead ends, ~5.5s),
        // then lowered back to 5s in Step 13b-2, because caching findMatches should make this well under 1s.
        check("smart solve: 5 puzzles in under 5 seconds (took " + elapsed + " ms)", elapsed < 5000, true);

        // Impossible grid: must return false AND put every slot back in `remaining`
        List<Slot> tinyRemaining = new ArrayList<>();
        tinyRemaining.add(tiny);
        check("smart solve: impossible grid returns false", solve(tinyRemaining, stuck, wordsByLength, new HashSet<>(), new Random(0)), false);
        check("smart solve: remaining restored after failing", tinyRemaining.size(), 1);

        // Step 13 tests: player-friendly word list (SCOWL 50 + Spread the Wordlist) with offensive words blocked.
        // DICK and HORNY are still in words.txt, so only the blocklist can keep them out.
        System.out.println();
        Set<String> blocked = loadBlockedWords();
        check("blocklist: loaded all 52 words", blocked.size(), 52);
        check("blocklist: stored in UPPERCASE like the word list", blocked.contains("DICK"), true);
        check("blocklist: DICK never offered as an answer", findMatches("DICK", wordsByLength).size(), 0);
        check("blocklist: HORNY never offered as an answer", findMatches("HORNY", wordsByLength).size(), 0);
        check("blocklist: normal words still there (DESK)", findMatches("DESK", wordsByLength).size(), 1);
        check("word list: obscure ENABLE words are gone (DARB)", findMatches("DARB", wordsByLength).size(), 0);
        System.out.print(generate(allSlots, blackSquares, wordsByLength, 1)); // a puzzle from the new list

        // Step 13c tests: only Wordle-level answers, with a setting to allow harder words
        check("too hard: OVOID skipped by default", findMatches("OVOID", wordsByLength).size(), 0);
        check("too hard: XYLEM skipped by default", findMatches("XYLEM", wordsByLength).size(), 0);
        check("too hard: everyday words stay (EMOJI)", findMatches("EMOJI", wordsByLength).size(), 1);
        Map<Integer, List<String>> withHardWords = loadWords(false);   // the setting turned off
        check("too hard: setting off brings OVOID back", withHardWords.get(5).contains("OVOID"), true);
        check("too hard: setting off still blocks offensive words", withHardWords.get(4).contains("DICK"), false);

        // Step 13b-1 tests: count findMatches calls and repeated patterns
        System.out.println();
        findMatchesCalls = 0;
        repeatedPatterns = 0;
        patternsSeen.clear();
        findMatches("C.T.", wordsByLength);
        findMatches("C.T.", wordsByLength);
        findMatches("CAT", wordsByLength);
        check("measure: 3 calls counted", findMatchesCalls, 3L);   // 3L = the number 3 as a long
        check("measure: 1 repeat (the second C.T.)", repeatedPatterns, 1L);
        check("measure: 2 different patterns seen", patternsSeen.size(), 2);

        // Now measure a real puzzle. Seed 4 is the slowest of seeds 1-10.
        findMatchesCalls = 0;
        repeatedPatterns = 0;
        patternsSeen.clear();
        long measureStart = System.currentTimeMillis();
        generate(allSlots, blackSquares, wordsByLength, 4);
        long measureTime = System.currentTimeMillis() - measureStart;
        long percentRepeated = findMatchesCalls == 0 ? 0 : 100 * repeatedPatterns / findMatchesCalls;
        System.out.println("Seed 4: " + measureTime + " ms, " + findMatchesCalls + " findMatches calls, "
                + repeatedPatterns + " repeats (" + percentRepeated + "%)");
        check("measure: most calls are repeats (so caching will help)", percentRepeated > 50, true);

        // Step 13b-2 tests: cache findMatches answers
        System.out.println();
        matchCache.clear();
        List<String> firstAnswer = findMatches("C.T.", wordsByLength);
        check("cache: answer saved under its pattern", matchCache.containsKey("C.T."), true);
        check("cache: second call gives the same words", findMatches("C.T.", wordsByLength), firstAnswer);
        List<String> scribbled = findMatches("C.T.", wordsByLength);
        scribbled.clear(); // pretend a caller messed with the list it got back
        check("cache: changing a returned list doesn't damage the cache", findMatches("C.T.", wordsByLength).size(), 6);
        matchCache.clear();
        List<String> veryFirst = findMatches("C.T.", wordsByLength); // the call that fills the cache
        veryFirst.clear();
        check("cache: changing the FIRST returned list doesn't damage the cache", findMatches("C.T.", wordsByLength).size(), 6);

        // Step 13b-3 tests: the Trie
        System.out.println();
        Trie tinyTrie = new Trie();
        tinyTrie.insert("CAT");
        tinyTrie.insert("CATS");
        tinyTrie.insert("CUTE");
        check("trie: C.T. finds CATS and CUTE", tinyTrie.match("C.T.").toString(), "[CATS, CUTE]");
        check("trie: exact word CAT", tinyTrie.match("CAT").toString(), "[CAT]");
        check("trie: CA is only the start of a word, not a word", tinyTrie.match("CA").toString(), "[]");
        check("trie: ... finds only 3-letter words", tinyTrie.match("...").toString(), "[CAT]");

        // Same answers as your Step 7 scan, for every 4- and 5-letter word with every other letter hidden
        int compared = 0;
        int different = 0;
        for (int length = 4; length <= 5; length++) {
            for (String word : wordsByLength.get(length)) {
                StringBuilder p = new StringBuilder(word);
                for (int i = 1; i < p.length(); i += 2) {
                    p.setCharAt(i, '.');             // CATS -> C.T.
                }
                String pattern = p.toString();
                compared++;
                if (!getTrie(wordsByLength).match(pattern).equals(findMatchesByScan(pattern, wordsByLength))) {
                    different++;
                }
            }
        }
        check("trie: same answers as the scan for all " + compared + " patterns", different, 0);

        // Race: answer every distinct pattern the solver has seen, once with the scan and once with the Trie
        long scanStart = System.currentTimeMillis();
        for (String pattern : patternsSeen) {
            findMatchesByScan(pattern, wordsByLength);
        }
        long scanTime = System.currentTimeMillis() - scanStart;
        long trieStart = System.currentTimeMillis();
        for (String pattern : patternsSeen) {
            getTrie(wordsByLength).match(pattern);
        }
        long trieTime = System.currentTimeMillis() - trieStart;
        System.out.println(patternsSeen.size() + " patterns: scan " + scanTime + " ms, trie " + trieTime + " ms");
        check("trie: faster than the scan", trieTime < scanTime, true);
        check("cache: seed 4 now under 1 second (took " + measureTime + " ms)", measureTime < 1000, true);
        // Also watch "shuffle: same seed gives the same puzzle" above: it FAILS if the cache hands out its own list.

        // Step 14 tests: clue numbers. Arrays.deepToString turns a 2D array into text like [[1, 2], [3, 0]].
        System.out.println();
        check("numbers: 5x5 test grid", Arrays.deepToString(numberGrid(blackSquares)),
                "[[1, 2, 3, 4, 0], [5, 0, 0, 0, 6], [7, 0, 0, 0, 0], [8, 0, 0, 0, 0], [0, 9, 0, 0, 0]]");

        boolean[][] openThree = new boolean[3][3]; // a new boolean array starts all false = all open
        check("numbers: 3x3 all open", Arrays.deepToString(numberGrid(openThree)), "[[1, 2, 3], [4, 0, 0], [5, 0, 0]]");

        boolean[][] centerBlack = new boolean[3][3];
        centerBlack[1][1] = true;
        check("numbers: 3x3 center black (short runs get no number)", Arrays.deepToString(numberGrid(centerBlack)),
                "[[1, 0, 2], [0, 0, 0], [3, 0, 0]]");

        // Every slot from findAllSlots must start on a numbered square
        int[][] numbers = numberGrid(blackSquares);
        boolean everySlotNumbered = true;
        for (Slot slot : allSlots) {
            if (numbers[slot.startRow][slot.startCol] == 0) {
                everySlotNumbered = false;
            }
        }
        check("numbers: every answer starts on a numbered square", everySlotNumbered, true);

        // Step 15 tests: AI-written clues. 15a and 15b run every time (free, no internet).
        System.out.println();
        List<String> twoAnswers = List.of("DESK", "CATS");
        String prompt = ClueWriter.buildPrompt(twoAnswers, "hard");
        check("prompt: mentions DESK", prompt.contains("DESK"), true);
        check("prompt: mentions CATS", prompt.contains("CATS"), true);
        check("prompt: mentions the difficulty", prompt.contains("hard"), true);

        ClueWriter.ClueSet goodClues = new ClueWriter.ClueSet(List.of(
                new ClueWriter.Clue("DESK", "Office furniture with drawers"),
                new ClueWriter.Clue("CATS", "Some purring pets")));
        check("problems: good clues have none", ClueWriter.findProblems(goodClues, twoAnswers).size(), 0);

        ClueWriter.ClueSet missingOne = new ClueWriter.ClueSet(List.of(
                new ClueWriter.Clue("DESK", "Office furniture with drawers")));
        check("problems: a missing clue is caught", ClueWriter.findProblems(missingOne, twoAnswers).size(), 1);

        ClueWriter.ClueSet givesItAway = new ClueWriter.ClueSet(List.of(
                new ClueWriter.Clue("DESK", "Office furniture with drawers"),
                new ClueWriter.Clue("CATS", "Pets like these cats")));
        check("problems: a clue containing its answer is caught", ClueWriter.findProblems(givesItAway, twoAnswers).size(), 1);

        ClueWriter.ClueSet extraWord = new ClueWriter.ClueSet(List.of(
                new ClueWriter.Clue("DESK", "Office furniture with drawers"),
                new ClueWriter.Clue("CATS", "Some purring pets"),
                new ClueWriter.Clue("CHAIR", "Seat with a back")));
        check("problems: an unexpected answer is caught", ClueWriter.findProblems(extraWord, twoAnswers).size(), 1);

        // 15c calls the real Claude API, which costs a little money, so it only runs when you ask:
        //   mvn compile exec:java -Dexec.mainClass=com.crossword.App -Dexec.args=live
        // The key itself is never printed, only whether one was found.
        System.out.println("Claude API key found: " + (ClueWriter.hasApiKey() ? "yes" : "no"));
        boolean live = List.of(args).contains("live");
        if (!live) {
            System.out.println("Live clue test skipped (run with the argument 'live' to call Claude)");
        } else if (!ClueWriter.hasApiKey()) {
            System.out.println("Live clue test skipped: no API key (see 'Claude API key' in README.md)");
        } else {
            List<String> puzzleAnswers = new ArrayList<>();
            for (Slot slot : allSlots) {
                puzzleAnswers.add(slot.getPattern(puzzle));
            }
            System.out.print(formatGrid(puzzle, blackSquares));
            ClueWriter.ClueSet clues = ClueWriter.writeClues(puzzleAnswers, "medium");
            for (ClueWriter.Clue clue : clues.clues()) {
                System.out.println("  " + clue.answer() + ": " + clue.clue());
            }
            check("live: Claude's clues pass every check", ClueWriter.findProblems(clues, puzzleAnswers).size(), 0);
        }
    }

    // Test helper: solve a fresh empty grid with the given random seed and return it as text
    static String generate(List<Slot> slots, boolean[][] blackSquares, Map<Integer, List<String>> wordsByLength, long seed) {
        int size = blackSquares.length;
        char[][] grid = new char[size][size];
        for (char[] row : grid) {
            Arrays.fill(row, '.');
        }
        solve(new ArrayList<>(slots), grid, wordsByLength, new HashSet<>(), new Random(seed));
        return formatGrid(grid, blackSquares);
    }

    // Prints PASS/FAIL when comparing any two values (Strings, numbers, ...)
    static void check(String label, Object actual, Object expected) {
        String status = actual.equals(expected) ? "PASS" : "FAIL";
        String shownExpected = expected.toString().replace("\n", "\\n"); // show line breaks as \n so it stays on one line
        String shownActual = actual.toString().replace("\n", "\\n");
        System.out.println(status + "  " + label + "  expected " + shownExpected + ", got " + shownActual);
    }

    // Prints PASS/FAIL for one test case, plus the first few matches so you can eyeball them
    static void testFindMatches(String pattern, int expectedCount, Map<Integer, List<String>> wordsByLength) {
        List<String> result = findMatches(pattern, wordsByLength);
        if (result == null) {
            System.out.println("FAIL  " + pattern + "  returned null (should be an empty list)");
            return;
        }
        String status = (result.size() == expectedCount) ? "PASS" : "FAIL";
        List<String> preview = result.subList(0, Math.min(5, result.size()));
        System.out.println(status + "  " + pattern + "  expected " + expectedCount + ", got " + result.size() + "  " + preview);
    }

    /*
     * ===== Setting: skip words that are too hard =====
     *
     * true  = only Wordle-level answers (skips every word in too-hard-words.txt). This is the normal game.
     * false = allow the harder words too (OVOID, XYLEM, AVAST...), e.g. for an "expert" mode later.
     * Offensive words (blocked-words.txt) are ALWAYS skipped; this setting doesn't change that.
     */
    static boolean SKIP_TOO_HARD_WORDS = true;

    // Loads the word list using the setting above
    static Map<Integer, List<String>> loadWords() throws IOException {
        return loadWords(SKIP_TOO_HARD_WORDS);
    }

    // Same, but you choose: loadWords(false) includes the too-hard words (the tests use this to compare)
    static Map<Integer, List<String>> loadWords(boolean skipTooHardWords) throws IOException {
        Map<Integer, List<String>> wordsByLength = new HashMap<>();

        InputStream inputStream = App.class.getClassLoader().getResourceAsStream("words.txt");
        if (inputStream == null) {
            throw new IOException("Error: Could not find words.txt in resources.");
        }

        Set<String> blocked = loadBlockedWords(); // read the blocklist ONCE, then reuse it for every word below
        // Same idea for the too-hard list. When the setting is off, use an empty set so nothing is skipped.
        Set<String> tooHard = skipTooHardWords ? loadTooHardWords() : new HashSet<>();

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String word = line.trim().toUpperCase();
                if (word.isEmpty()) continue; // skip blank lines
                if (blocked.contains(word)) continue; // skip offensive lines
                if (tooHard.contains(word)) continue; // skip words harder than Wordle level

                int length = word.length();
                wordsByLength.computeIfAbsent(length, k -> new ArrayList<>()).add(word); // computeIfAbsent allows you to add to a list even when it doesnt exist
                // computeIfAbsent runs your lambda, creates a new empty ArrayList, stores it under key 5, and hands it back. Then .add(word) puts your word into that brand-new list
            }
        }

        return wordsByLength;
    }

    /*
     * ===== Step 13: Block Offensive Words =====
     *
     * Read src/main/resources/blocked-words.txt (one lowercase word per line) into a Set,
     * so loadWords can skip any word in it. Then use it in loadWords (see the TODO there).
     *
     * Example:  blocked-words.txt has "dick" and "horny"  ->  {DICK, HORNY}
     *           and findMatches("DICK", wordsByLength) returns []
     *
     * Constraints:
     *   - Store the words in UPPERCASE, because loadWords uppercases every word.
     *   - Skip blank lines, like loadWords does.
     *   - If the file is missing, throw an IOException (same as loadWords).
     *
     * Related LeetCode: 1. Two Sum, 217. Contains Duplicate (a HashSet for instant "is it in here?" checks)
     */
    static Set<String> loadBlockedWords() throws IOException {
        return loadWordSet("blocked-words.txt");
    }

    // Words harder than Wordle level (archaic, jargon, crossword-only). Edit too-hard-words.txt to change it.
    static Set<String> loadTooHardWords() throws IOException {
        return loadWordSet("too-hard-words.txt");
    }

    // Your Step 13 code, moved here so both lists can share it (one lowercase word per line -> UPPERCASE Set)
    static Set<String> loadWordSet(String fileName) throws IOException {
        Set<String> words = new HashSet<>();

        InputStream inputStream = App.class.getClassLoader().getResourceAsStream(fileName);
        if (inputStream == null) {
            throw new IOException("Failed to Access " + fileName);
        }

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String word = line.trim().toUpperCase();
                if (word.isEmpty()) continue;
                words.add(word);
            }
        }
        return words;
    }

    /*
     * ===== Step 7: Find Matching Words =====
     *
     * Given a pattern of uppercase letters and '.', return every word that fits it.
     * A '.' matches any one letter. A letter must match exactly.
     * The order of the returned words does not matter.
     *
     * Example 1:  pattern = "C.T."   ->  [CATS, CITE, CITY, COTE, COTS, CUTE, CUTS]  (7 words)
     * Example 2:  pattern = "CAT"    ->  [CAT]
     * Example 3:  pattern = "QZX.."  ->  []
     *
     * Constraints:
     *   - Only words with the same length as the pattern can match.
     *   - Never return null. If nothing matches, return an empty list.
     *   - Don't change wordsByLength (the solver will reuse it thousands of times).
     *
     * Related LeetCode: 211. Design Add and Search Words Data Structure (same '.' wildcard idea)
     */
    static List<String> findMatches(String pattern, Map<Integer, List<String>> wordsByLength) {
        findMatchesCalls++;
        if (patternsSeen.contains(pattern)) {
            repeatedPatterns++;
        } else {
            patternsSeen.add(pattern);
        }

        // Step 13b-2: already worked out? Hand back a COPY of the saved answer and skip the scan.
        // (A copy, because solve shuffles the list it gets, and that must not scramble the cache.)
        if (matchCache.containsKey(pattern)) {
            return new ArrayList<>(matchCache.get(pattern));
        }

        // Step 13b-3: new patterns are looked up in the Trie instead of scanning every word
        List<String> result = getTrie(wordsByLength).match(pattern);

        matchCache.put(pattern, result);    // notebook: "C.T." → [CATS, CITE, ...]
        return new ArrayList<>(result);     // give the caller a copy, so shuffling it can't scramble the notebook
    }

    /*
     * ===== Step 13b-3: Build the Trie once =====
     *
     * Builds a Trie from every word in wordsByLength the first time it's needed, then reuses it.
     * If a different word map is passed in, it builds a fresh Trie for that map.
     */
    static Trie wordTrie = null;
    static Map<Integer, List<String>> trieBuiltFrom = null;

    static Trie getTrie(Map<Integer, List<String>> wordsByLength) {
        if (wordTrie == null || trieBuiltFrom != wordsByLength) { // != on objects asks "is it the SAME map?"
            wordTrie = new Trie();
            for (List<String> bucket : wordsByLength.values()) {
                for (String word : bucket) {
                    wordTrie.insert(word);
                }
            }
            trieBuiltFrom = wordsByLength;
        }
        return wordTrie;
    }

    // Your Step 7 scan, kept so the tests can check the Trie gives exactly the same answers
    static List<String> findMatchesByScan(String pattern, Map<Integer, List<String>> wordsByLength) {
        List<String> result = new ArrayList<>();
        List<String> possibleWords = wordsByLength.getOrDefault(pattern.length(), new ArrayList<>());

        for (String possibleWord : possibleWords) {
            boolean matches = true;

            for (int i = 0; i < pattern.length(); i++) { 
                if ((pattern.charAt(i) != possibleWord.charAt(i)) && pattern.charAt(i) != '.') {
                    matches = false;
                    break;
                }
            }
            if (matches) {
                result.add(possibleWord);
            }
        }

        return result;
    }

    /*
     * ===== Step 14: Clue Numbering =====
     *
     * Give each square its clue number, the small number printed in the corner of a crossword square.
     * Go through the squares left -> right, top -> bottom. A square gets the next number (1, 2, 3, ...)
     * if it is the FIRST square of an Across answer or the FIRST square of a Down answer (or both).
     * Every other square, including black squares, gets 0.
     *
     * An answer is a run of 3 or more open squares (the same rule findAllSlots uses).
     * So a square starts an Across answer if:
     *   - the square to its LEFT is black or off the grid, and
     *   - it and the next 2 squares to its RIGHT are all open (a run of at least 3).
     * Down works the same way, using the square ABOVE and the squares BELOW.
     *
     * Example 1:  our 5x5 test grid (black top-right and bottom-left)
     *               1 2 3 4 #        -> {{1,2,3,4,0},
     *               5 . . . 6            {5,0,0,0,6},
     *               7 . . . .            {7,0,0,0,0},
     *               8 . . . .            {8,0,0,0,0},
     *               # 9 . . .            {0,9,0,0,0}}
     *            Square (1,4) gets 6: it starts a Down answer because the square above it is black.
     *
     * Example 2:  3x3, all open       -> {{1,2,3},{4,0,0},{5,0,0}}
     *
     * Example 3:  3x3, center black   -> {{1,0,2},{0,0,0},{3,0,0}}
     *            (0,1) gets NO number: going down it's only 1 square long before the black square.
     *
     * Constraints:
     *   - Return an int[][] the same size as blackSquares. Don't change blackSquares.
     *   - Numbers go up by 1 with no gaps, in reading order.
     *
     * Related LeetCode: 36. Valid Sudoku, 200. Number of Islands (walking a grid and checking neighbors)
     */
    static int[][] numberGrid(boolean[][] blackSquares) {
        int size = blackSquares.length;
        int[][] result = new int[size][size];   
        int nextNumber = 1;                     

        for (int row = 0; row < size; row++) {
            for (int col = 0; col < size; col++) {
                if (blackSquares[row][col]) continue;   // black squares stay 0

                boolean startsAcross = (col == 0 || blackSquares[row][col - 1])
                                        && col + 2 < size
                                        && !blackSquares[row][col + 1]
                                        && !blackSquares[row][col + 2];

                boolean startsDown = (row == 0 || blackSquares[row - 1][col])
                                        && row + 2 < size
                                        && !blackSquares[row + 1][col]
                                        && !blackSquares[row + 2][col];

                if (startsAcross || startsDown) {
                    result[row][col] = nextNumber;
                    nextNumber++;
                }
            }
        }
        return result;
    }

    /*
     * ===== Step 11: Print the Filled Grid =====
     *
     * Turn the grid into text that is easy to read in the console.
     *   - Black squares show as '#'.
     *   - Open squares show their letter, or '.' if still empty.
     *   - Squares in a row are separated by ONE space, with no space after the last one.
     *   - Every row (including the last) ends with "\n" (a line break).
     *
     * Example:  blackSquares = {{F,F,T},{F,F,F},{T,F,F}},  filledGrid = {{C,A,.},{O,N,E},{.,D,O}}
     *           -> "C A #\nO N E\n# D O\n"   which prints as:
     *              C A #
     *              O N E
     *              # D O
     *
     * Constraints:
     *   - Return the text, don't print it here (so tests can compare it).
     *   - The grid is square: size = filledGrid.length.
     *
     * Related LeetCode: 6. Zigzag Conversion, 68. Text Justification (building output strings exactly right)
     */
    static String formatGrid(char[][] filledGrid, boolean[][] blackSquares) {
        String result = "";

        for (int row = 0; row < filledGrid.length; row++) {
            for (int col = 0; col < filledGrid[row].length; col++) {
                if (!blackSquares[row][col]) {
                    result += filledGrid[row][col];
                } else {
                    result += "#";
                }

                if (col != filledGrid.length - 1) {
                    result += " ";
                }
            }
            result += "\n";
        }
        return result; 
    }

    /*
     * ===== Step 12b-1: Pick the Most-Constrained Slot =====
     *
     * Out of the slots in `remaining`, return the one with the FEWEST matching words
     * for its current pattern in filledGrid. If two slots tie, return the earlier one.
     *
     * Example 1:  empty 5x5 grid                    ->  Across (0,0) length 4   (2120 beats 4014; earliest of the ties)
     * Example 2:  Q at row 2, col 1                 ->  Down (0,1) length 5     ("..Q.." has 2, the fewest)
     * Example 3:  also Q at row 3, col 0            ->  Down (0,0) length 4     ("...Q" has 0, a dead end)
     *
     * Constraints:
     *   - remaining always has at least one slot.
     *   - Don't change remaining or filledGrid. Only look.
     *
     * Related LeetCode: 414. Third Maximum Number, 1. Two Sum (scan once, remember the best so far)
     */
    static Slot pickMostConstrained(List<Slot> remaining, char[][] filledGrid, Map<Integer, List<String>> wordsByLength) {
        int bestCount = Integer.MAX_VALUE;
        Slot best = null;

        for (Slot slot : remaining) {
            int count = findMatches(slot.getPattern(filledGrid), wordsByLength).size();

            if (count < bestCount) {
                best = slot;
                bestCount = count;
            }
        }
        return best;
    }

    /*
     * ===== Backtracking Solver (Steps 9, 10, 12a, 12b) =====
     *
     * Fill every slot in `remaining` with a real word. Return true if the whole grid got filled,
     * false if it's impossible from here. When this returns true, filledGrid holds the finished puzzle.
     * When it returns false, remaining, filledGrid and usedWords look exactly like they did before the call.
     *
     * How each step shaped it:
     *   - Step 9:   recursion + backtracking. Place a word, go deeper, undo it on a dead end.
     *               A slot that crossing words already filled (no '.') still has to be a real word.
     *   - Step 10:  usedWords holds every word on the board, so no answer appears twice.
     *               Add on CHOOSE, remove on UNCHOOSE, in sync with placeWord/removeWord.
     *   - Step 12a: candidates are shuffled with the `random` passed in, so the same seed always
     *               gives the same puzzle (Step 23 will use today's date as the seed).
     *   - Step 12b: always fill the most-constrained slot next (pickMostConstrained) instead of a
     *               fixed order. Take it out of remaining before going deeper, put it back if every word failed.
     *
     * Example 1:  remaining is empty                       ->  true   (nothing left to fill)
     * Example 2:  allSlots for the 5x5 grid, any seed      ->  true, real words, no repeats, fast
     * Example 3:  one slot with pattern "QZX"              ->  false, and remaining still holds that slot
     *
     * Constraints:
     *   - remaining must be a list that can change (new ArrayList<>(...)), and callers should pass a copy.
     *   - Only shuffle `candidates`, never the lists inside wordsByLength.
     *
     * Related LeetCode: 37. Sudoku Solver, 79. Word Search, 46. Permutations, 384. Shuffle an Array
     */
    static boolean solve(List<Slot> remaining, char[][] filledGrid, Map<Integer, List<String>> wordsByLength, Set<String> usedWords, Random random) {
        if (remaining.isEmpty()) {
            return true;
        }

        Slot slot = pickMostConstrained(remaining, filledGrid, wordsByLength); 
        remaining.remove(slot);

        String pattern = slot.getPattern(filledGrid);
        List<String> candidates = findMatches(pattern, wordsByLength);

        Collections.shuffle(candidates, random);
        
        for (String word : candidates) {
            if (!usedWords.contains(word)) {
                List<int[]> placed = slot.placeWord(filledGrid, word);
                usedWords.add(word);

                if (solve(remaining, filledGrid, wordsByLength, usedWords, random)) {
                    return true;
                }

                slot.removeWord(filledGrid, placed);
                usedWords.remove(word);
            }
        }

        remaining.add(slot);
        return false;
    }
}
