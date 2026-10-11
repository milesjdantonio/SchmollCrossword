package com.crossword;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;

/*
 * Easier words in the campaign (written by Claude, 2026-10-10, the user: "lower the difficulty of the words chosen"):
 * campaign puzzles fill from the word list one step easier than their difficulty (see PuzzleStore). These build
 * clue-less grids (no Claude call, free) for the campaign's sizes and check where their answers come from.
 */
class CampaignWordsTest {

    // the share of a puzzle's answers that are in this word list
    static double shareIn(String json, Map<Integer, List<String>> words) {
        Set<String> all = new HashSet<>();
        for (List<String> list : words.values()) all.addAll(list);
        Set<String> answers = PuzzleStore.answersIn(json);
        return answers.stream().filter(all::contains).count() / (double) answers.size();
    }

    static Campaign.Section section(String world) {
        return Campaign.section(world);
    }

    @Test
    void mediumLevelsUseEasyWords() throws IOException {
        // Acorn Woods' levels are "medium": their 5x5 grids now fill from Easy's list
        Map<Integer, List<String>> easy = App.loadWordsFor("easy");
        for (long seed = 1; seed <= 3; seed++) {
            String json = PuzzleStore.generateSmall(seed, "campaign", "medium", PuzzleStore.campaignSmallWords("medium", App.loadWordsFor("medium")),
                    new HashSet<>(), "", "", false);
            assertTrue(shareIn(json, easy) == 1.0, "every answer is an Easy word: " + PuzzleStore.answersIn(json));
        }
    }

    @Test
    void bigGridsUseMostlyTheEasierList() throws IOException {
        Map<Integer, List<String>> easy = App.loadWordsFor("easy"), medium = App.loadWordsFor("medium"), hard = App.loadWordsFor("challenge");
        // [world, difficulty, size, the easier list, its share must be at least]
        Object[][] cases = { { "ocean", "challenge", 6, easy, 0.8 }, { "rain", "challenge", 7, easy, 0.8 },
                             { "carnival", "expert", 7, medium, 0.8 }, { "space", "expert", 9, medium, 0.7 } };
        for (Object[] c : cases) {
            double total = 0;
            long t0 = System.currentTimeMillis();
            for (long seed = 1; seed <= 3; seed++) {
                String json = PuzzleStore.generateBig(seed * 7919, "campaign", (String) c[1], (Integer) c[2], hard, new HashSet<>(), "", "", false);
                @SuppressWarnings("unchecked") Map<Integer, List<String>> list = (Map<Integer, List<String>>) c[3];
                total += shareIn(json, list);
            }
            long ms = (System.currentTimeMillis() - t0) / 3;
            System.out.printf("%-9s %-9s %dx%d: %.0f%% from the easier list, %d ms a grid%n", c[0], c[1], c[2], c[2], total / 3 * 100, ms);
            assertTrue(total / 3 >= (Double) c[4], c[0] + ": " + Math.round(total / 3 * 100) + "% from the easier list");
            assertTrue(ms < 5000, c[0] + " took " + ms + " ms a grid");
        }
    }
}
