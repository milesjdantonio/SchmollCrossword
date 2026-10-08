package com.crossword;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;

// Challenge mode: 7x7 grids with random symmetric black squares, filled with real words
class ChallengeGridTest {

    @Test
    void shapesFollowTheRules() {
        for (long seed = 1; seed <= 300; seed++) {
            boolean[][] black = ChallengeGrid.shape(seed);
            int n = black.length;
            assertEquals(ChallengeGrid.SIZE, n);
            int blacks = 0;
            for (int r = 0; r < n; r++) {
                for (int c = 0; c < n; c++) {
                    assertEquals(black[r][c], black[n - 1 - r][n - 1 - c], "symmetric when turned upside down, seed " + seed);
                    if (black[r][c]) { blacks++; continue; }
                    assertTrue(ChallengeGrid.run(black, r, c, true) >= 3, "across answer of 3+ letters, seed " + seed);
                    assertTrue(ChallengeGrid.run(black, r, c, false) >= 3, "down answer of 3+ letters, seed " + seed);
                }
            }
            assertTrue(blacks >= 2 && blacks <= 12, "a few black squares, seed " + seed + ": " + blacks);
            assertTrue(ChallengeGrid.isValid(black));
        }
    }

    @Test
    void theSameSeedGivesTheSameShape() {
        assertTrue(java.util.Arrays.deepEquals(ChallengeGrid.shape(42), ChallengeGrid.shape(42)));
    }

    @Test
    void gridsFillWithRealWordsQuickly() {
        Map<Integer, List<String>> words = TestWords.hard();
        Set<String> dictionary = new HashSet<>();
        words.values().forEach(dictionary::addAll);
        long start = System.currentTimeMillis();
        int longest = 0;
        for (long seed = 1; seed <= 6; seed++) {
            ChallengeGrid.Filled filled = PuzzleStore.buildChallenge(seed, words);
            Set<String> used = new HashSet<>();
            for (Slot slot : Slot.findAllSlots(filled.blackSquares())) {
                String word = slot.getPattern(filled.grid());
                assertTrue(dictionary.contains(word), "seed " + seed + ": " + word);
                assertTrue(used.add(word), "no repeats, seed " + seed + ": " + word);
                longest = Math.max(longest, word.length());
            }
        }
        assertTrue(longest >= 6, "challenge grids have long answers");
        long ms = System.currentTimeMillis() - start;
        assertTrue(ms < 30_000, "6 challenge grids took " + ms + " ms");
        assertEquals(Long.MAX_VALUE, App.solveBudget, "the solver's budget is switched off again afterwards");
    }

    @Test
    void theChallengeDailyHasItsOwnSeed() {
        assertEquals(202610074L, PuzzleStore.dailySeed(LocalDate.of(2026, 10, 7), "challenge"));
        assertTrue(PuzzleController.isValidDifficulty("Challenge"));
    }
}
