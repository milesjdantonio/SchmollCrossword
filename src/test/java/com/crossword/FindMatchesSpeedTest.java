package com.crossword;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

// Measuring findMatches, caching its answers, and the Trie
class FindMatchesSpeedTest {

    private final Map<Integer, List<String>> words = TestWords.everyday();

    // @BeforeEach runs before EVERY test in this class, so each one starts from zero
    @BeforeEach
    void resetCounters() {
        App.findMatchesCalls = 0;
        App.repeatedPatterns = 0;
        App.patternsSeen.clear();
        App.matchCache.clear();
    }

    private void generate(long seed) {
        boolean[][] shape = TestWords.testShape();
        App.solve(new ArrayList<>(Slot.findAllSlots(shape)), TestWords.emptyGrid(shape.length), words, new HashSet<>(), new Random(seed));
    }

    // count calls and repeated patterns
    @Test
    void countsCallsAndRepeats() {
        App.findMatches("C.T.", words);
        App.findMatches("C.T.", words);
        App.findMatches("CAT", words);
        assertEquals(3L, App.findMatchesCalls);    // 3L = the number 3 as a long
        assertEquals(1L, App.repeatedPatterns, "the second C.T.");
        assertEquals(2, App.patternsSeen.size());
    }

    // Seed 4 is the slowest of seeds 1-10
    @Test
    void mostCallsAreRepeatsSoCachingHelps() {
        generate(4);
        long percentRepeated = 100 * App.repeatedPatterns / App.findMatchesCalls;
        assertTrue(percentRepeated > 50, "only " + percentRepeated + "% repeats");
    }

    // the cache
    @Test
    void cacheSavesAnswersUnderTheirPattern() {
        List<String> first = App.findMatches("C.T.", words);
        assertTrue(App.matchCache.containsKey("C.T."));
        assertEquals(first, App.findMatches("C.T.", words), "second call gives the same words");
    }

    @Test
    void changingAReturnedListDoesntDamageTheCache() {
        List<String> veryFirst = App.findMatches("C.T.", words);   // the call that fills the cache
        veryFirst.clear();                                           // pretend a caller messed with the list it got back
        assertEquals(6, App.findMatches("C.T.", words).size());
        App.findMatches("C.T.", words).clear();                      // and a list handed out FROM the cache
        assertEquals(6, App.findMatches("C.T.", words).size());
    }

    // the website uses two word lists, so answers cached from one must not leak into the other
    @Test
    void cacheNeverMixesUpWordLists() {
        assertEquals(0, App.findMatches("OVOID", words).size());
        assertEquals(1, App.findMatches("OVOID", TestWords.withHardWords()).size());
        assertEquals(0, App.findMatches("OVOID", words).size(), "back on the everyday list, OVOID must be gone again");
    }

    @Test
    void seed4InUnderOneSecond() {
        generate(1);   // warm-up: the very first fill also builds the Trie
        App.matchCache.clear();
        long start = System.currentTimeMillis();
        generate(4);
        long elapsed = System.currentTimeMillis() - start;
        assertTrue(elapsed < 1000, "took " + elapsed + " ms");
    }

    // the Trie gives the same answers as a plain scan, for every 4- and 5-letter word with every other letter hidden
    @Test
    void trieGivesTheSameAnswersAsTheScan() {
        List<String> different = new ArrayList<>();
        for (int length = 4; length <= 5; length++) {
            for (String word : words.get(length)) {
                StringBuilder p = new StringBuilder(word);
                for (int i = 1; i < p.length(); i += 2) {
                    p.setCharAt(i, '.');             // CATS -> C.T.
                }
                String pattern = p.toString();
                if (!App.getTrie(words).match(pattern).equals(App.findMatchesByScan(pattern, words))) {
                    different.add(pattern);
                }
            }
        }
        assertEquals(List.of(), different, "patterns where the Trie and the scan disagree");
    }

    // Race: answer every distinct pattern the solver needed, once with the scan and once with the Trie
    @Test
    void trieIsFasterThanTheScan() {
        generate(4);
        List<String> patterns = new ArrayList<>(App.patternsSeen);
        App.getTrie(words);   // build it before starting the stopwatch

        long scanStart = System.currentTimeMillis();
        for (String pattern : patterns) {
            App.findMatchesByScan(pattern, words);
        }
        long scanTime = System.currentTimeMillis() - scanStart;

        long trieStart = System.currentTimeMillis();
        for (String pattern : patterns) {
            App.getTrie(words).match(pattern);
        }
        long trieTime = System.currentTimeMillis() - trieStart;

        assertFalse(patterns.isEmpty());
        assertTrue(trieTime < scanTime, patterns.size() + " patterns: scan " + scanTime + " ms, trie " + trieTime + " ms");
    }
}
