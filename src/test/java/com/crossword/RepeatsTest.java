package com.crossword;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

// Fewer repeats: no RAVEN and RAVENS in one puzzle, and new puzzles stay
// away from the answers of recent ones (REST used to be in 1 of every 3 easy puzzles)
class RepeatsTest {

    @Test
    void wordsWithTheSameRootAreSpotted() {
        assertTrue(App.sharesRoot("RAVENS", Set.of("RAVEN")));
        assertTrue(App.sharesRoot("RAVEN", Set.of("RAVENS")));
        assertTrue(App.sharesRoot("CARED", Set.of("CARE")));
        assertTrue(App.sharesRoot("RESTING", Set.of("REST")));
        assertFalse(App.sharesRoot("RAVEN", Set.of("CROP", "OMENS")));
        assertFalse(App.sharesRoot("ASH", Set.of("A")), "a 1-letter 'root' is not a word");
    }

    @Test
    void noPuzzleHasTwoWordsWithTheSameRoot() {
        for (long seed = 1; seed <= 40; seed++) {
            char[][] grid = PuzzleStore.buildGrid(seed, TestWords.everyday());
            Set<String> answers = new HashSet<>();
            for (Slot slot : Slot.findAllSlots(PuzzleStore.SHAPE)) answers.add(slot.getPattern(grid));
            for (String a : answers) {
                Set<String> others = new HashSet<>(answers);
                others.remove(a);
                assertFalse(App.sharesRoot(a, others), "seed " + seed + ": " + a + " in " + answers);
            }
        }
    }

    // 60 puzzles in a row, each avoiding the last 12 puzzles' answers: no word in more than 1 in 8 of them
    @Test
    void recentAnswersComeBackLessOften() {
        Map<String, Integer> count = new HashMap<>();
        List<Set<String>> recent = new ArrayList<>();
        for (long seed = 1; seed <= 60; seed++) {
            Set<String> avoid = new HashSet<>();
            recent.subList(Math.max(0, recent.size() - 12), recent.size()).forEach(avoid::addAll);
            char[][] grid = PuzzleStore.buildGrid(seed * 7919, TestWords.everyday(), avoid);
            Set<String> answers = new HashSet<>();
            for (Slot slot : Slot.findAllSlots(PuzzleStore.SHAPE)) answers.add(slot.getPattern(grid));
            answers.forEach(a -> count.merge(a, 1, Integer::sum));
            recent.add(answers);
        }
        int most = count.values().stream().max(Integer::compare).orElse(0);
        assertTrue(most <= 60 / 8, "the most common word came up " + most + " times: " + count);
    }

    // A daily stays away from the answers of the other dailies of its day and the 30 days before
    // (a date before the shipped dailies, so only these files count)
    @Test
    void aDailyAvoidsTheOtherDailiesOfTheLastMonth(@TempDir Path folder) throws IOException {
        LocalDate day = LocalDate.of(2026, 9, 1);
        saveDaily(folder, day, "easy", "REST");
        saveDaily(folder, day, "medium", "MEDIUM");
        saveDaily(folder, day.minusDays(30), "hard", "CROP");
        saveDaily(folder, day.minusDays(31), "hard", "OLD");
        assertEquals(Set.of("REST", "CROP"), PuzzleStore.recentDailyAnswers(folder, day, "medium"));
        assertEquals(Set.of("REST", "MEDIUM", "CROP"), PuzzleStore.recentDailyAnswers(folder, day, "hard"));
    }

    private static void saveDaily(Path folder, LocalDate day, String kind, String answer) throws IOException {
        Files.writeString(PuzzleStore.dailyFile(folder, day, kind), "{\"solution\":[],\"across\":[{\"answer\": \"" + answer + "\"}],\"down\":[]}");
    }

    @Test
    void answersAreReadFromPuzzleJson() {
        assertEquals(Set.of("IDLE", "DRIVE"), PuzzleStore.answersIn("{\"across\": [{\"answer\": \"IDLE\"}, {\"answer\":\"DRIVE\"}]}"));
    }
}
