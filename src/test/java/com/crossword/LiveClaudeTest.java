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
 * Steps 15c and 17 with the REAL Claude API. These cost a little money, so they're skipped unless you ask:
 *
 *   mvn test -Dlive=true                         (everything, including these)
 *   mvn test -Dlive=true -Dtest=LiveClaudeTest   (only these)
 *
 * @EnabledIfSystemProperty skips the whole class unless "live" is "true". The key itself is never printed.
 */
@EnabledIfSystemProperty(named = "live", matches = "true")
class LiveClaudeTest {

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
