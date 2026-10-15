package com.crossword;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import java.util.Arrays;

import org.junit.jupiter.api.Test;

// The grid as text, and clue numbers
class GridTest {

    private final boolean[][] miniBlack = {
        {false, false, true},
        {false, false, false},
        {true,  false, false}
    };

    // "\n" means "new line"
    @Test
    void formatsAFullGrid() {
        char[][] full = { {'C', 'A', '.'}, {'O', 'N', 'E'}, {'.', 'D', 'O'} };
        assertEquals("C A #\nO N E\n# D O\n", App.formatGrid(full, miniBlack));
    }

    @Test
    void emptySquaresStayDots() {
        char[][] half = { {'C', '.', '.'}, {'.', '.', '.'}, {'.', '.', 'O'} };
        assertEquals("C . #\n. . .\n# . O\n", App.formatGrid(half, miniBlack));
    }

    // Arrays.deepToString turns a 2D array into text like [[1, 2], [3, 0]]
    @Test
    void numbersTheTestGrid() {
        assertEquals("[[1, 2, 3, 4, 0], [5, 0, 0, 0, 6], [7, 0, 0, 0, 0], [8, 0, 0, 0, 0], [0, 9, 0, 0, 0]]",
                Arrays.deepToString(App.numberGrid(TestWords.testShape())));
    }

    @Test
    void numbersAnAllOpenGrid() {
        boolean[][] openThree = new boolean[3][3];   // a new boolean array starts all false = all open
        assertEquals("[[1, 2, 3], [4, 0, 0], [5, 0, 0]]", Arrays.deepToString(App.numberGrid(openThree)));
    }

    @Test
    void shortRunsGetNoNumber() {
        boolean[][] centerBlack = new boolean[3][3];
        centerBlack[1][1] = true;
        assertEquals("[[1, 0, 2], [0, 0, 0], [3, 0, 0]]", Arrays.deepToString(App.numberGrid(centerBlack)));
    }

    @Test
    void everyAnswerStartsOnANumberedSquare() {
        boolean[][] shape = TestWords.testShape();
        int[][] numbers = App.numberGrid(shape);
        for (Slot slot : Slot.findAllSlots(shape)) {
            assertNotEquals(0, numbers[slot.startRow][slot.startCol], slot + " has no number");
        }
    }
}
