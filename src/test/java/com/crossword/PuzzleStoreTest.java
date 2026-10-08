package com.crossword;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

// Step 17: daily puzzles saved to files (these never call the API)
class PuzzleStoreTest {

    private final LocalDate oct7 = LocalDate.of(2026, 10, 7);

    @Test
    void seedComesFromTheDate() {
        assertEquals(20261007L, PuzzleStore.seedForDate(oct7));
        assertEquals(20261008L, PuzzleStore.seedForDate(oct7.plusDays(1)), "next day, different seed");
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
