package com.crossword;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;

// Challenge mode: grids of different sizes with random symmetric black squares, filled mostly with medium words
class ChallengeGridTest {

    @Test
    void shapesFollowTheRules() {
        for (int n : ChallengeGrid.SIZES) {
            for (long seed = 1; seed <= 60; seed++) {
                boolean[][] black = ChallengeGrid.shape(seed, n);
                assertEquals(n, black.length);
                int blacks = 0;
                for (int r = 0; r < n; r++) {
                    for (int c = 0; c < n; c++) {
                        assertEquals(black[r][c], black[n - 1 - r][n - 1 - c], "symmetric when turned upside down, " + n + "x" + n + " seed " + seed);
                        if (black[r][c]) { blacks++; continue; }
                        assertTrue(ChallengeGrid.run(black, r, c, true) >= 3, "across answers are 3+ letters");
                        assertTrue(ChallengeGrid.run(black, r, c, false) >= 3, "down answers are 3+ letters");
                    }
                }
                assertTrue(blacks <= n * n * 3 / 10, "not too many black squares");
                assertTrue(ChallengeGrid.isValid(black));
                int longest = 0;
                for (int[] run : ChallengeGrid.runs(black)) longest = Math.max(longest, run[2]);
                assertTrue(longest >= 6 && longest <= 7, "at least one long answer, none over 7 letters: " + longest);
            }
        }
    }

    @Test
    void theSameSeedGivesTheSameSizeAndShape() {
        assertEquals(ChallengeGrid.sizeFor(42), ChallengeGrid.sizeFor(42));
        assertTrue(Arrays.deepEquals(ChallengeGrid.shape(42, 7), ChallengeGrid.shape(42, 7)));
        Set<Integer> sizes = new HashSet<>();
        for (long seed = 1; seed <= 40; seed++) sizes.add(ChallengeGrid.sizeFor(seed));
        assertEquals(ChallengeGrid.SIZES.length, sizes.size(), "every size comes up");
    }

    @Test
    void gridsFillWithRealWordsQuickly() {
        Map<Integer, List<String>> medium = TestWords.everyday(), hard = TestWords.hard();
        Set<String> dictionary = new HashSet<>(), mediumSet = new HashSet<>();
        hard.values().forEach(dictionary::addAll);
        medium.values().forEach(mediumSet::addAll);
        long start = System.currentTimeMillis();
        int total = 0, fromMedium = 0;
        for (long seed = 1; seed <= 9; seed++) {
            ChallengeGrid.Filled filled = PuzzleStore.buildChallenge(seed, medium, hard);
            assertEquals(ChallengeGrid.sizeFor(seed), filled.grid().length);
            Set<String> used = new HashSet<>();
            for (Slot slot : Slot.findAllSlots(filled.blackSquares())) {
                String word = slot.getPattern(filled.grid());
                assertTrue(dictionary.contains(word), "seed " + seed + ": " + word);
                assertTrue(used.add(word), "no repeats, seed " + seed + ": " + word);
                total++;
                if (mediumSet.contains(word)) fromMedium++;
            }
        }
        assertTrue(fromMedium * 10 >= total * 7, "mostly medium words: " + fromMedium + " of " + total);
        long ms = System.currentTimeMillis() - start;
        assertTrue(ms < 30_000, "9 challenge grids took " + ms + " ms");
        assertEquals(Long.MAX_VALUE, App.solveBudget, "the solver's budget is switched off again afterwards");
    }

    @Test
    void theChallengeDailyHasItsOwnSeed() {
        assertEquals(202610074L, PuzzleStore.dailySeed(LocalDate.of(2026, 10, 7), "challenge"));
        assertTrue(PuzzleController.isValidDifficulty("Challenge"));
    }
}
