package com.crossword;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTimeout;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest; // runs the same test once for each value below
import org.junit.jupiter.params.provider.ValueSource;

// The backtracking solver, no repeated answers, seeded shuffles and the most-constrained slot
class SolverTest {

    private final Map<Integer, List<String>> words = TestWords.everyday();
    private final boolean[][] shape = TestWords.testShape();
    private final List<Slot> allSlots = Slot.findAllSlots(shape);

    // Solve a fresh empty grid with the given random seed and return it as text
    private String generate(long seed) {
        char[][] grid = TestWords.emptyGrid(shape.length);
        solve(grid, new HashSet<>(), seed);
        return App.formatGrid(grid, shape);
    }

    // new ArrayList<>(allSlots) makes a COPY, because solve takes slots out of the list it's given
    private boolean solve(char[][] grid, Set<String> usedWords, long seed) {
        return App.solve(new ArrayList<>(allSlots), grid, words, usedWords, new Random(seed));
    }

    // Steps 9, 10 and 12b-2: any seed gives a full grid of real, all-different words.
    // @ParameterizedTest runs this 5 times, once per seed, and reports each one separately.
    @ParameterizedTest
    @ValueSource(longs = {1, 2, 3, 4, 5})
    void fillsTheGridWithRealDifferentWords(long seed) {
        char[][] grid = TestWords.emptyGrid(shape.length);
        assertTrue(solve(grid, new HashSet<>(), seed), "found a fill");

        Set<String> answers = new HashSet<>();   // a Set ignores duplicates, so repeats don't count twice
        for (Slot slot : allSlots) {
            String answer = slot.getPattern(grid);
            assertEquals(1, App.findMatches(answer, words).size(), slot + " = " + answer + " should be a real word");
            answers.add(answer);
        }
        assertEquals(allSlots.size(), answers.size(), "all answers different");
    }

    // The limit catches disasters (a fixed slot order took 200+ seconds), not normal variation
    @Test
    void fivePuzzlesInUnderFiveSeconds() {
        assertTimeout(Duration.ofSeconds(5), () -> {
            for (long seed = 1; seed <= 5; seed++) {
                generate(seed);
            }
        });
    }

    // An impossible grid: no 3-letter word starts with QZX, so solve must give up AND put the slot back
    @Test
    void impossibleGridReturnsFalseAndRestoresRemaining() {
        Slot tiny = new Slot(0, 0, 3, true);
        char[][] stuck = { {'Q', 'Z', 'X'}, {'.', '.', '.'}, {'.', '.', '.'} };
        List<Slot> remaining = new ArrayList<>();
        remaining.add(tiny);
        assertFalse(App.solve(remaining, stuck, words, new HashSet<>(), new Random(0)));
        assertEquals(1, remaining.size(), "remaining restored after failing");
    }

    // CAT is already filled in. Allowed if CAT hasn't been used, blocked if it has.
    // List.of(...) can't be changed, so wrap it in new ArrayList<>(...) because solve removes slots.
    @Test
    void usedWordsCantRepeat() {
        Slot tiny = new Slot(0, 0, 3, true);
        char[][] catGrid = { {'C', 'A', 'T'}, {'.', '.', '.'}, {'.', '.', '.'} };
        assertTrue(App.solve(new ArrayList<>(List.of(tiny)), catGrid, words, new HashSet<>(), new Random(0)));
        assertFalse(App.solve(new ArrayList<>(List.of(tiny)), catGrid, words, new HashSet<>(Set.of("CAT")), new Random(0)));
    }

    // same seed = same puzzle, different seed = different puzzle.
    // Also FAILS if the match cache hands out its own list (solve shuffles it).
    @Test
    void seedsAreRepeatable() {
        String seed1 = generate(1);
        assertEquals(seed1, generate(1), "same seed, same puzzle");
        assertNotEquals(seed1, generate(2), "different seeds, different puzzles");
        assertFalse(seed1.startsWith("A A H S"), "candidates are shuffled, not alphabetical");
    }

    // pick the slot with the fewest matching words. On a tie, keep the earliest.
    @Test
    void picksTheMostConstrainedSlot() {
        char[][] grid = TestWords.emptyGrid(5);
        assertEquals("Across at (0, 0), length 4", App.pickMostConstrained(allSlots, grid, words).toString(),
                "empty grid: 4-letter slots have fewer words than 5-letter ones");

        grid[2][1] = 'Q';   // Across(2,0) is ".Q...", Down(0,1) is "..Q.." (fewer words)
        assertEquals("Down at (0, 1), length 5", App.pickMostConstrained(allSlots, grid, words).toString());

        grid[3][0] = 'Q';   // Down(0,0) is "...Q": no word ends in Q (0 words), a dead end
        assertEquals("Down at (0, 0), length 4", App.pickMostConstrained(allSlots, grid, words).toString());
    }
}
