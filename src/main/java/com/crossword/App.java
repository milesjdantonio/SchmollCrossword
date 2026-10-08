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
    static Map<Integer, List<String>> cacheBuiltFrom = null;   // the word list matchCache's answers came from (Step 26)

    /*
     * ===== Step 25: the tests moved to JUnit =====
     *
     * main used to print ~110 PASS/FAIL lines. Those checks are now real JUnit tests in src/test/java/com/crossword
     * (one test class per part of the game). Run them all with:   mvn test
     *
     * What's left here is a quick demo: it fills a puzzle and prints it, with no API call.
     *   mvn compile exec:java -Dexec.mainClass=com.crossword.App                 (seed 1)
     *   mvn compile exec:java -Dexec.mainClass=com.crossword.App -Dexec.args=42  (any seed you like)
     */
    public static void main(String[] args) throws IOException {
        Map<Integer, List<String>> wordsByLength = loadWords();

        for (int length = 3; length <= 7; length++) {
            List<String> words = wordsByLength.getOrDefault(length, new ArrayList<>()); // getOrDefault defaults instead of null
            System.out.println(length + "-letter words: " + words.size());
        }

        long seed = args.length > 0 ? Long.parseLong(args[0]) : 1;
        boolean[][] blackSquares = PuzzleStore.SHAPE;
        char[][] grid = PuzzleStore.buildGrid(seed, wordsByLength);

        System.out.println();
        System.out.println("Seed " + seed + ":");
        System.out.print(formatGrid(grid, blackSquares));
        System.out.println();
        System.out.println("Clue numbers: " + Arrays.deepToString(numberGrid(blackSquares)));
        for (Slot slot : Slot.findAllSlots(blackSquares)) {
            System.out.println(slot + "  " + slot.getPattern(grid));
        }
        System.out.println("Claude API key found: " + (ClueWriter.hasApiKey() ? "yes" : "no"));   // never the key itself
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
        return loadWords(skipTooHardWords, false);
    }

    /*
     * ===== Design pass: the answer words get harder with the difficulty =====
     *
     *   easy   -> only the most common words (SCOWL levels 10-20): skips too-hard AND not-easy words
     *   medium -> the everyday list (the normal game): skips too-hard words
     *   hard   -> adds the less common words, but skips the extremely hard ones (very-hard-words.txt)
     *   hard + "Allow harder words" (Unlimited only) -> everything except offensive words
     *
     * not-easy-words.txt lists the everyday words that are NOT in SCOWL levels 10-20.
     * very-hard-words.txt is the Step 13c too-hard list (SCOWL 40/50 + archaic words); see WORDLISTS.md.
     */
    static Map<Integer, List<String>> loadWordsFor(String difficulty) throws IOException {
        return loadWordsFor(difficulty, false);
    }

    static Map<Integer, List<String>> loadWordsFor(String difficulty, boolean allowVeryHardWords) throws IOException {
        switch (difficulty) {
            case "easy":   return loadWords(true, true);
            case "medium": return loadWords(true, false);
            case "hard":   return allowVeryHardWords ? loadWords(false, false) : loadWordsSkipping(loadWordSet("very-hard-words.txt"));
            default: throw new IllegalArgumentException("difficulty must be easy, medium or hard: " + difficulty);
        }
    }

    // The full version: skip too-hard words and/or not-easy words (offensive words are always skipped)
    static Map<Integer, List<String>> loadWords(boolean skipTooHardWords, boolean skipNotEasyWords) throws IOException {
        // When the setting is off, use an empty set so nothing is skipped
        Set<String> tooHard = skipTooHardWords ? loadTooHardWords() : new HashSet<>();
        if (skipNotEasyWords) tooHard.addAll(loadWordSet("not-easy-words.txt"));   // easy: skip these too
        return loadWordsSkipping(tooHard);
    }

    // Reads words.txt, skipping offensive words and every word in tooHard
    static Map<Integer, List<String>> loadWordsSkipping(Set<String> tooHard) throws IOException {
        Map<Integer, List<String>> wordsByLength = new HashMap<>();

        InputStream inputStream = App.class.getClassLoader().getResourceAsStream("words.txt");
        if (inputStream == null) {
            throw new IOException("Error: Could not find words.txt in resources.");
        }

        Set<String> blocked = loadBlockedWords(); // read the blocklist ONCE, then reuse it for every word below

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

        // Step 26: the website has TWO word lists (Step 24's "harder words" setting). The cache's key is only the
        // pattern, so answers saved from one list must never be handed out for the other (OVOID could land in
        // the daily!). Same idea as getTrie: a different word map means start a fresh notebook.
        if (cacheBuiltFrom != wordsByLength) {
            matchCache.clear();
            cacheBuiltFrom = wordsByLength;
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
