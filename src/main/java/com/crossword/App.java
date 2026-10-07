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
        testFindMatches("C.T.", 9, wordsByLength);                         // CATE, CATS, CETE, CITE, CITY, ...
        testFindMatches("CAT", 1, wordsByLength);                          // already a full word
        testFindMatches(".....", 8636, wordsByLength);                     // every 5-letter word
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
        // Alternate across/down so crossing letters get checked early (all-across-first takes minutes).
        // findAllSlots returns 5 across then 5 down, so slot i pairs with slot i + 5.
        List<Slot> solveOrder = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            solveOrder.add(allSlots.get(i));     // across
            solveOrder.add(allSlots.get(i + 5)); // down
        }
        char[][] puzzle = new char[size][size];
        for (char[] row : puzzle) {
            Arrays.fill(row, '.');
        }

        boolean solved = solve(solveOrder, 0, puzzle, wordsByLength, new HashSet<>(), new Random(1));
        check("solve: found a fill", solved, true);
        for (Slot slot : solveOrder) {
            String answer = slot.getPattern(puzzle);
            check("solve: " + slot + " is a real word", findMatches(answer, wordsByLength).size(), 1);
        }
        for (char[] row : puzzle) {
            System.out.println(new String(row)); // turns a char[] into a String, e.g. "CATS."
        }

        // Step 10 tests: every answer in the puzzle must be different
        Set<String> answers = new HashSet<>();
        for (Slot slot : solveOrder) {
            answers.add(slot.getPattern(puzzle)); // a Set ignores duplicates, so repeats don't count twice
        }
        check("no repeats: all " + solveOrder.size() + " answers different", answers.size(), solveOrder.size());

        // An impossible grid: no 3-letter word starts with QZX, so solve must give up and return false
        Slot tiny = new Slot(0, 0, 3, true);
        char[][] stuck = { {'Q', 'Z', 'X'}, {'.', '.', '.'}, {'.', '.', '.'} };
        check("solve: impossible grid returns false", solve(List.of(tiny), 0, stuck, wordsByLength, new HashSet<>(), new Random(0)), false);

        // CAT is already filled in. Allowed if CAT hasn't been used, blocked if it has.
        char[][] catGrid = { {'C', 'A', 'T'}, {'.', '.', '.'}, {'.', '.', '.'} };
        check("no repeats: CAT allowed when unused", solve(List.of(tiny), 0, catGrid, wordsByLength, new HashSet<>(), new Random(0)), true);
        Set<String> alreadyUsed = new HashSet<>();
        alreadyUsed.add("CAT");
        check("no repeats: CAT blocked when used", solve(List.of(tiny), 0, catGrid, wordsByLength, alreadyUsed, new Random(0)), false);

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
        String seed1 = generate(solveOrder, blackSquares, wordsByLength, 1);
        String seed1Again = generate(solveOrder, blackSquares, wordsByLength, 1);
        String seed2 = generate(solveOrder, blackSquares, wordsByLength, 2);
        check("shuffle: same seed gives the same puzzle", seed1Again, seed1);
        check("shuffle: different seeds give different puzzles", seed1.equals(seed2), false);
        check("shuffle: seed 1 no longer starts with AAHS", seed1.startsWith("A A H S"), false);
    }

    // Test helper: solve a fresh empty grid with the given random seed and return it as text
    static String generate(List<Slot> order, boolean[][] blackSquares, Map<Integer, List<String>> wordsByLength, long seed) {
        int size = blackSquares.length;
        char[][] grid = new char[size][size];
        for (char[] row : grid) {
            Arrays.fill(row, '.');
        }
        solve(order, 0, grid, wordsByLength, new HashSet<>(), new Random(seed));
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

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String word = line.trim().toUpperCase();
                if (word.isEmpty()) continue; // skip blank lines
                
                int length = word.length();
                wordsByLength.computeIfAbsent(length, k -> new ArrayList<>()).add(word); // computeIfAbsent allows you to add to a list even when it doesnt exist
                // computeIfAbsent runs your lambda, creates a new empty ArrayList, stores it under key 5, and hands it back. Then .add(word) puts your word into that brand-new list
            }
        }

        return wordsByLength;
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
     * ===== Step 9: Backtracking Solver =====
     *
     * Fill every slot in `slots` with a real word, starting from slots.get(index).
     * Return true if the whole grid got filled, false if it's impossible from here.
     * When this returns true, filledGrid holds the finished puzzle.
     * When this returns false, filledGrid must look exactly like it did before the call.
     *
     * Example 1:  index == slots.size()                ->  true   (nothing left to fill)
     * Example 2:  slots.get(index) pattern = "QZX"     ->  false  (no word fits, nothing to try)
     * Example 3:  the 5x5 test grid from index 0       ->  true, and every slot is a real word
     *
     * Constraints:
     *   - This method calls itself (recursion) with index + 1.
     *   - Use the tools you already built: getPattern, findMatches, placeWord, removeWord.
     *   - A slot that crossing words already filled (pattern has no '.') still has to be a real word.
     *
     * Related LeetCode: 37. Sudoku Solver, 79. Word Search (try, go deeper, undo)
     *
     * ===== Step 10: No Repeated Answers =====
     *
     * usedWords holds every word currently placed on the board.
     * Skip any candidate that is already in usedWords.
     * Keep usedWords in sync with the board: when a word goes on (CHOOSE) it goes in the set,
     * when a word comes off (UNCHOOSE) it comes out of the set.
     *
     * Example:  usedWords = {CAT}, slot pattern = "CAT"  ->  false  (the only fit is taken)
     *
     * Constraints:
     *   - Every one of the 10 answers in the 5x5 test grid must be different.
     *   - When solve returns false, usedWords must look exactly like it did before the call (same rule as the grid).
     *
     * Related LeetCode: 46. Permutations (a "used" set with add on choose, remove on unchoose)
     *
     * ===== Step 12a: A Different Puzzle Every Time =====
     *
     * Right now candidates come out of findMatches in alphabetical order, so the solver
     * always finds the same puzzle. Mix the candidates into a random order before trying them.
     * Use the `random` passed in, so the same seed always gives the same puzzle
     * (Step 23 will use today's date as the seed, so everyone gets the same daily puzzle).
     *
     * Example:  seed 1 -> one puzzle, seed 1 again -> the exact same puzzle, seed 2 -> a different one
     *
     * Constraints:
     *   - Only shuffle `candidates`, never the lists inside wordsByLength.
     *   - Don't create a new Random inside solve. Use the one passed in.
     *
     * Related LeetCode: 384. Shuffle an Array
     */
    static boolean solve(List<Slot> slots, int index, char[][] filledGrid, Map<Integer, List<String>> wordsByLength, Set<String> usedWords, Random random) {
        
        if (index == slots.size()) {
            return true;
        }

        Slot slot = slots.get(index);

        String pattern = slot.getPattern(filledGrid);
        List<String> candidates = findMatches(pattern, wordsByLength);

        Collections.shuffle(candidates, random);
        
        for (String word : candidates) {
            if (!usedWords.contains(word)) {
                List<int[]> placed = slot.placeWord(filledGrid, word);
                usedWords.add(word);

                if (solve(slots, index + 1, filledGrid, wordsByLength, usedWords, random)) {
                    return true;
                }

                slot.removeWord(filledGrid, placed);
                usedWords.remove(word);
            }
        }
        
        return false;
    }
}