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
        testFindMatches("C.T.", 7, wordsByLength);                         // CATS, CITE, CITY, COTE, COTS, CUTE, CUTS
        testFindMatches("CAT", 1, wordsByLength);                          // already a full word
        testFindMatches(".....", 4014, wordsByLength);                     // every 5-letter word (4016 minus 2 blocked)
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
        // Raised from 5s to 15s in Step 13: the smaller, friendlier word list means more dead ends (~5s now).
        // Step 13b (faster matching) should bring this back down.
        check("smart solve: 5 puzzles in under 15 seconds (took " + elapsed + " ms)", elapsed < 15000, true);

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

    static Map<Integer, List<String>> loadWords() throws IOException {
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
        Set<String> blocked = new HashSet<>();

        InputStream inputStream = App.class.getClassLoader().getResourceAsStream("blocked-words.txt");
        if (inputStream == null) {
            throw new IOException("Failed to Access blocked-words.txt");
        }

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String word = line.trim().toUpperCase();
                if (word.isEmpty()) continue;
                blocked.add(word);
            }
        }
        return blocked; 
    }

    /*
     * ===== Step 7: Find Matching Words =====
     *
     * Given a pattern of uppercase letters and '.', return every word that fits it.
     * A '.' matches any one letter. A letter must match exactly.
     * The order of the returned words does not matter.
     *
     * Example 1:  pattern = "C.T."   ->  [CATE, CATS, CETE, CITE, CITY, ...]  (9 words)
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
