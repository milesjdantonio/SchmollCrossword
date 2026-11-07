package com.crossword;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Random;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/*
 * Clue writing and dailies with the REAL Claude API. These cost a little money, so they're skipped unless you ask:
 *
 *   mvn test -Dlive=true                         (everything, including these)
 *   mvn test -Dlive=true -Dtest=LiveClaudeTest   (only these)
 *
 * @EnabledIfSystemProperty skips the whole class unless "live" is "true". The key itself is never printed.
 */
@EnabledIfSystemProperty(named = "live", matches = "true")
class LiveClaudeTest {

    // Sample clues at each difficulty to read (draft, review, rewrite of anything flagged), with what it cost.
    // About 15 cents.
    @Test
    void sampleCluesAtEachDifficulty() {
        assertTrue(ClueWriter.hasApiKey(), "no API key");
        java.util.Map<String, java.util.Map<Integer, List<String>>> lists =
                java.util.Map.of("easy", TestWords.easy(), "medium", TestWords.everyday(), "hard", TestWords.hard());
        long seed = 9001;
        for (String difficulty : List.of("easy", "medium", "hard")) {
            char[][] grid = PuzzleStore.buildGrid(seed++, lists.get(difficulty));
            List<String> answers = new ArrayList<>();
            for (Slot slot : Slot.findAllSlots(PuzzleStore.SHAPE)) answers.add(slot.getPattern(grid));
            ClueWriter.ClueSet clues = ClueWriter.writeClues(answers, difficulty);
            System.out.println("\n" + difficulty.toUpperCase());
            for (ClueWriter.Clue clue : clues.clues()) System.out.println("  " + clue.answer() + ": " + clue.clue());
            assertEquals(List.of(), ClueWriter.findProblems(clues, answers));
        }
        System.out.printf("%nClaude: %d calls, %d tokens in, %d out, about $%.3f%n", ClueWriter.CALLS.get(),
                ClueWriter.INPUT_TOKENS.get(), ClueWriter.OUTPUT_TOKENS.get(), ClueWriter.estimatedCost());
    }

    @Test
    void claudesCluesPassEveryCheck() {
        assertTrue(ClueWriter.hasApiKey(), "no API key (see 'Claude API key' in README.md)");

        boolean[][] shape = TestWords.testShape();
        char[][] grid = TestWords.emptyGrid(shape.length);
        List<Slot> slots = Slot.findAllSlots(shape);
        App.solve(new ArrayList<>(slots), grid, TestWords.everyday(), new HashSet<>(), new Random(1));
        List<String> answers = new ArrayList<>();
        for (Slot slot : slots) {
            answers.add(slot.getPattern(grid));
        }
        System.out.print(App.formatGrid(grid, shape));

        ClueWriter.ClueSet clues = ClueWriter.writeClues(answers, "medium");
        for (ClueWriter.Clue clue : clues.clues()) {
            System.out.println("  " + clue.answer() + ": " + clue.clue());
        }
        assertEquals(List.of(), ClueWriter.findProblems(clues, answers));
    }

    // The FIRST run today calls Claude and saves the file; every run after that reads the file instead
    @Test
    void askingTwiceGivesTheIdenticalDaily() throws Exception {
        LocalDate today = LocalDate.now();
        String first = PuzzleStore.getDaily(PuzzleStore.DAILY_FOLDER, today, "medium", TestWords.everyday());
        String second = PuzzleStore.getDaily(PuzzleStore.DAILY_FOLDER, today, "medium", TestWords.everyday());
        System.out.println("Today's medium daily: " + first);
        assertEquals(first, second);
    }
}
