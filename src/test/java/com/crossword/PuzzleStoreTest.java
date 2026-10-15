package com.crossword;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

// Daily puzzles saved to files (these never call the API)
class PuzzleStoreTest {

    private final LocalDate oct7 = LocalDate.of(2026, 10, 7);

    @Test
    void seedComesFromTheDate() {
        assertEquals(20261007L, PuzzleStore.seedForDate(oct7));
        assertEquals(20261008L, PuzzleStore.seedForDate(oct7.plusDays(1)), "next day, different seed");
    }

    // Three dailies a day, each with its own seed (so its own grid)
    @Test
    void eachDifficultyHasItsOwnDailySeed() {
        assertEquals(202610071L, PuzzleStore.dailySeed(oct7, "easy"));
        assertEquals(202610072L, PuzzleStore.dailySeed(oct7, "medium"));
        assertEquals(202610073L, PuzzleStore.dailySeed(oct7, "hard"));
    }

    // The easy list is smaller, so check it can still fill the grid for many seeds (and only with easy words)
    @Test
    void easyWordsFillEveryGrid() {
        java.util.Set<String> easyWords = new java.util.HashSet<>();
        TestWords.easy().values().forEach(easyWords::addAll);
        for (long seed = 1; seed <= 40; seed++) {
            char[][] grid = PuzzleStore.buildGrid(seed, TestWords.easy());
            for (Slot slot : Slot.findAllSlots(PuzzleStore.SHAPE)) {
                String word = slot.getPattern(grid);
                org.junit.jupiter.api.Assertions.assertTrue(easyWords.contains(word), "seed " + seed + ": " + word);
            }
        }
    }

    @Test
    void dailyFileNameAndFolder() {
        Path hardFile = PuzzleStore.dailyFile(PuzzleStore.DAILY_FOLDER, oct7, "hard");
        assertEquals("2026-10-07-hard.json", hardFile.getFileName().toString());
        assertEquals(PuzzleStore.DAILY_FOLDER, hardFile.getParent());
    }

    @Test
    void sameDateSameGrid() {
        long seed = PuzzleStore.seedForDate(oct7);
        assertArrayEquals(PuzzleStore.buildGrid(seed, TestWords.everyday()), PuzzleStore.buildGrid(seed, TestWords.everyday()));
    }

    // Cache hit: a saved file must be returned as-is, with no API call.
    // @TempDir hands the test a fresh, empty throwaway folder and deletes it afterwards.
    @Test
    void savedPuzzleIsServedFromItsFile(@TempDir Path tempFolder) throws Exception {
        Files.writeString(tempFolder.resolve("2026-10-07-medium.json"), "{\"saved\":true}");
        assertEquals("{\"saved\":true}", PuzzleStore.getDaily(tempFolder, oct7, "medium", TestWords.everyday()));
    }
}
