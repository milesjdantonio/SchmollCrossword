package com.crossword;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;

/**
 * The puzzle generator: loads the word lists and fills a grid with words by backtracking.
 */
public class App {
    // How findMatches is used (the tests read these): calls, and calls for a pattern seen before
    static long findMatchesCalls = 0;
    static long repeatedPatterns = 0;
    static Set<String> patternsSeen = new HashSet<>();

    // Patterns already worked out -> the words that fit them, e.g. "C.T." -> [CATS, CITE, CITY, ...].
    // Only valid for the word list it was built from (cacheBuiltFrom); findMatches hands out copies.
    static Map<String, List<String>> matchCache = new HashMap<>();
    static Map<Integer, List<String>> cacheBuiltFrom = null;

    /**
     * A quick demo with no API call: prints the word counts and a filled puzzle for a seed.
     *   mvn compile exec:java -Dexec.mainClass=com.crossword.App                 (seed 1)
     *   mvn compile exec:java -Dexec.mainClass=com.crossword.App -Dexec.args=42  (any seed)
     */
    public static void main(String[] args) throws IOException {
        Map<Integer, List<String>> wordsByLength = loadWords();

        for (int length = 3; length <= 7; length++) {
            List<String> words = wordsByLength.getOrDefault(length, new ArrayList<>());
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
     * true  = skip every word in too-hard-words.txt (the everyday list; the normal game)
     * false = allow the harder words too (OVOID, XYLEM, AVAST...)
     * Offensive words (blocked-words.txt) are always skipped either way.
     */
    static boolean SKIP_TOO_HARD_WORDS = true;

    // Loads the word list using the setting above
    static Map<Integer, List<String>> loadWords() throws IOException {
        return loadWords(SKIP_TOO_HARD_WORDS);
    }

    // loadWords(false) includes the too-hard words
    static Map<Integer, List<String>> loadWords(boolean skipTooHardWords) throws IOException {
        return loadWords(skipTooHardWords, false);
    }

    /*
     * The answer words get harder with the difficulty:
     *   easy   -> only the most common words (SCOWL levels 10-20): skips too-hard and not-easy words
     *   medium -> the everyday list: skips too-hard words
     *   hard   -> adds the less common words, but skips the extremely hard ones (very-hard-words.txt)
     */
    static Map<Integer, List<String>> loadWordsFor(String difficulty) throws IOException {
        switch (difficulty) {
            case "easy":   return loadWords(true, true);
            case "medium": return loadWords(true, false);
            case "hard":   return loadWordsSkipping(loadWordSet("very-hard-words.txt"));
            // Challenge mode: the bigger grids need plenty of 6- and 7-letter words, so it uses Hard's list
            case "challenge": return loadWordsFor("hard");
            default: throw new IllegalArgumentException("difficulty must be easy, medium, hard or challenge: " + difficulty);
        }
    }

    // Skip too-hard words and/or not-easy words (offensive words are always skipped)
    static Map<Integer, List<String>> loadWords(boolean skipTooHardWords, boolean skipNotEasyWords) throws IOException {
        Set<String> tooHard = skipTooHardWords ? loadTooHardWords() : new HashSet<>();
        if (skipNotEasyWords) tooHard.addAll(loadWordSet("not-easy-words.txt"));
        return loadWordsSkipping(tooHard);
    }

    // Reads words.txt into lists by word length (uppercase), skipping offensive words and every word in tooHard
    static Map<Integer, List<String>> loadWordsSkipping(Set<String> tooHard) throws IOException {
        Map<Integer, List<String>> wordsByLength = new HashMap<>();

        InputStream inputStream = App.class.getClassLoader().getResourceAsStream("words.txt");
        if (inputStream == null) {
            throw new IOException("Error: Could not find words.txt in resources.");
        }

        Set<String> blocked = loadBlockedWords();

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String word = line.trim().toUpperCase();
                if (word.isEmpty()) continue;
                if (blocked.contains(word)) continue;
                if (tooHard.contains(word)) continue;

                wordsByLength.computeIfAbsent(word.length(), k -> new ArrayList<>()).add(word);
            }
        }

        return wordsByLength;
    }

    // Offensive words the generator must never use (blocked-words.txt)
    static Set<String> loadBlockedWords() throws IOException {
        return loadWordSet("blocked-words.txt");
    }

    // Words harder than everyday level (archaic, jargon, crossword-only). Edit too-hard-words.txt to change it.
    static Set<String> loadTooHardWords() throws IOException {
        return loadWordSet("too-hard-words.txt");
    }

    // Reads a word list from the resources (one lowercase word per line) into an UPPERCASE set
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

    /**
     * Every word that fits a pattern of uppercase letters and '.' ('.' matches any one letter), e.g.
     * "C.T." -> [CATS, CITE, CITY, COTE, COTS, CUTE, CUTS]. Never null. The caller gets its own copy,
     * which it may change (the solver shuffles it).
     */
    static List<String> findMatches(String pattern, Map<Integer, List<String>> wordsByLength) {
        findMatchesCalls++;
        if (patternsSeen.contains(pattern)) {
            repeatedPatterns++;
        } else {
            patternsSeen.add(pattern);
        }

        // The cache's key is only the pattern, so answers saved from one word list must never be handed out
        // for another (a hard word could land in an easy puzzle): a different word map starts a fresh cache.
        if (cacheBuiltFrom != wordsByLength) {
            matchCache.clear();
            cacheBuiltFrom = wordsByLength;
        }

        if (matchCache.containsKey(pattern)) {
            return new ArrayList<>(matchCache.get(pattern));
        }

        // new patterns are looked up in the Trie instead of scanning every word
        List<String> result = getTrie(wordsByLength).match(pattern);

        matchCache.put(pattern, result);
        return new ArrayList<>(result);     // a copy, so shuffling it can't scramble the cache
    }

    // A Trie of every word in wordsByLength, built the first time it's needed and rebuilt for a different word map
    static Trie wordTrie = null;
    static Map<Integer, List<String>> trieBuiltFrom = null;

    static Trie getTrie(Map<Integer, List<String>> wordsByLength) {
        if (wordTrie == null || trieBuiltFrom != wordsByLength) {
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

    // The same as findMatches by scanning every word of the pattern's length (the tests check the Trie against it)
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

    /**
     * Each square's clue number (0 for none), in reading order. A square gets the next number if it starts an
     * Across or a Down answer: the square before it is black or off the grid, and it begins a run of 3+ open squares.
     * For the 5x5 test grid (black top-right and bottom-left):
     *   1 2 3 4 #
     *   5 . . . 6
     *   7 . . . .
     *   8 . . . .
     *   # 9 . . .
     */
    static int[][] numberGrid(boolean[][] blackSquares) {
        int size = blackSquares.length;
        int[][] result = new int[size][size];
        int nextNumber = 1;

        for (int row = 0; row < size; row++) {
            for (int col = 0; col < size; col++) {
                if (blackSquares[row][col]) continue;

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

    /**
     * The grid as text: '#' for black squares, the letter (or '.') for open ones, one space between squares,
     * a line break after every row. E.g. "C A #\nO N E\n# D O\n".
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

    // The slot in `remaining` with the fewest words that fit its current pattern (the earlier one on a tie)
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

    // A budget of solve() calls: some random big patterns are very hard to fill, so the challenge generator sets a
    // budget and, if it runs out, tries another pattern. Long.MAX_VALUE = no limit (the 5x5 puzzles never need one).
    static long solveBudget = Long.MAX_VALUE;

    // RAVEN and RAVENS shouldn't both be in one puzzle: true if `word` is another word in `used` plus (or minus)
    // an ending like S, ES, ED or ING (RAVEN/RAVENS, CARE/CARED, REST/RESTING).
    static final String[] ENDINGS = {"S", "ES", "D", "ED", "R", "ER", "ING", "LY"};
    static boolean sharesRoot(String word, Set<String> used) {
        for (String end : ENDINGS) {
            if (used.contains(word + end)) return true;
            if (word.length() > end.length() + 2 && word.endsWith(end)
                    && used.contains(word.substring(0, word.length() - end.length()))) return true;
        }
        return false;
    }

    /**
     * The backtracking solver: fills every slot in `remaining` with a real word. Returns true when the whole grid is
     * filled (filledGrid then holds the puzzle), false if that's impossible from here (and then remaining, filledGrid
     * and usedWords are exactly as they were).
     *   - It always fills the most-constrained slot next, and a slot that crossing words already filled must still
     *     be a real word.
     *   - usedWords holds every word on the board, so no answer appears twice (nor two forms of one word).
     *   - Candidates are shuffled with `random`, so the same seed always gives the same puzzle.
     * `remaining` must be a list that can change; callers pass a copy (new ArrayList<>(...)).
     */
    static boolean solve(List<Slot> remaining, char[][] filledGrid, Map<Integer, List<String>> wordsByLength, Set<String> usedWords, Random random) {
        if (remaining.isEmpty()) {
            return true;
        }
        if (--solveBudget < 0) {
            return false;   // out of budget: unwinds like any dead end, so the grid is left as it was
        }

        Slot slot = pickMostConstrained(remaining, filledGrid, wordsByLength);
        remaining.remove(slot);

        String pattern = slot.getPattern(filledGrid);
        List<String> candidates = findMatches(pattern, wordsByLength);

        Collections.shuffle(candidates, random);

        for (String word : candidates) {
            if (!usedWords.contains(word) && !sharesRoot(word, usedWords)) {
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
