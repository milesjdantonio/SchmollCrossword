package com.crossword;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

// Daily puzzles saved to files, and making each puzzle once (these never call the API)
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

    // A stand-in for a whole puzzle (looksLikePuzzle only checks the shape)
    static final String PUZZLE = "{\"solution\":[],\"across\":[],\"down\":[],\"saved\":true}";

    // Cache hit: a saved file must be returned as-is, with no API call.
    // @TempDir hands the test a fresh, empty throwaway folder and deletes it afterwards.
    @Test
    void savedPuzzleIsServedFromItsFile(@TempDir Path tempFolder) throws Exception {
        Files.writeString(tempFolder.resolve("2026-10-07-medium.json"), PUZZLE);
        assertEquals(PUZZLE, PuzzleStore.getDaily(tempFolder, oct7, "medium", TestWords.everyday()));
    }

    @AfterEach
    void forget() {
        PuzzleStore.resetForTests();
    }

    // A file cut off half way (a crash while writing, a full disk) is moved aside and made again, not served
    @Test
    void aDamagedFileIsMadeAgain(@TempDir Path tempFolder) throws Exception {
        Path file = tempFolder.resolve("2031-01-01-easy.json");
        Files.writeString(file, "{\"solution\":[[\"C\",\"A");
        assertEquals(PUZZLE, PuzzleStore.generateOnce(file, () -> PUZZLE));
        assertTrue(Files.exists(tempFolder.resolve("2031-01-01-easy.json.damaged")));
        assertEquals(PUZZLE, Files.readString(file));
    }

    // When making a puzzle fails (Claude down), the next requests are told to wait instead of paying again
    @Test
    void aFailureIsRememberedForAWhile(@TempDir Path tempFolder) {
        Path file = tempFolder.resolve("2031-01-01-hard.json");
        AtomicInteger calls = new AtomicInteger();
        Callable<String> broken = () -> { calls.incrementAndGet(); throw new IllegalStateException("Claude is down"); };
        PuzzleStore.Unavailable first = assertThrows(PuzzleStore.Unavailable.class, () -> PuzzleStore.generateOnce(file, broken));
        assertEquals(PuzzleStore.FAILURE_PAUSE_MS / 1000, first.retryAfterSeconds);
        assertThrows(PuzzleStore.Unavailable.class, () -> PuzzleStore.generateOnce(file, broken));
        assertEquals(1, calls.get(), "the second request didn't try again");
        assertFalse(Files.exists(file));
    }

    // Two players asking for the same new daily at once share one generation and get the same puzzle
    @Test
    void twoRequestsShareOneGeneration(@TempDir Path tempFolder) throws Exception {
        Path file = tempFolder.resolve("2031-01-01-medium.json");
        AtomicInteger calls = new AtomicInteger();
        Callable<String> slow = () -> { calls.incrementAndGet(); Thread.sleep(300); return PUZZLE; };
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<String> a = pool.submit(() -> PuzzleStore.generateOnce(file, slow));
            Future<String> b = pool.submit(() -> PuzzleStore.generateOnce(file, slow));
            assertEquals(PUZZLE, a.get(5, TimeUnit.SECONDS));
            assertEquals(PUZZLE, b.get(5, TimeUnit.SECONDS));
        } finally {
            pool.shutdownNow();
        }
        assertEquals(1, calls.get());
    }

    // Saving leaves the whole file and no temporary file behind
    @Test
    void savingIsWholeAndTidy(@TempDir Path tempFolder) throws Exception {
        Path file = tempFolder.resolve("deep/2031-01-01-easy.json");
        PuzzleStore.save(file, PUZZLE);
        PuzzleStore.save(file, PUZZLE.replace("true", "false"));
        assertTrue(PuzzleStore.readSaved(file).contains("false"));
        try (var files = Files.list(file.getParent())) {
            assertEquals(1, files.count(), "no .tmp files left");
        }
    }

    // A daily stays away from a month of recent answers, shipped dailies included
    @Test
    void recentAnswersReachBackAMonth(@TempDir Path tempFolder) throws Exception {
        LocalDate day = LocalDate.of(2026, 11, 20);
        Set<String> recent = PuzzleStore.recentDailyAnswers(tempFolder, day, "easy");
        Set<String> shippedTwentyDaysBack = PuzzleStore.answersIn(PuzzleStore.shippedDaily(day.minusDays(20) + "-medium.json"));
        assertFalse(shippedTwentyDaysBack.isEmpty());
        assertTrue(recent.containsAll(shippedTwentyDaysBack));
    }
}
