package com.crossword;

import java.io.BufferedReader; // Used for efficient text reading, reads the whole text instead of each char
import java.io.IOException; // Used with dealing with files, networks, and streams, IO touches outside world(must account for)
import java.io.InputStream; // Takes inputs as bytes
import java.io.InputStreamReader; // Translates input bytes to char
import java.util.ArrayList; // You Know This
import java.util.HashMap; // Hashes the map to find faster(theres 100,000 words)
import java.util.List; // You know this 
import java.util.Map; // Stores a key and a value, able to find resources easily, very similar to array but can search by variable and location

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
}