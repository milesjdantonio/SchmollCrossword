package com.crossword;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;

import org.junit.jupiter.api.Test;

// Finding slots, reading their pattern, placing and removing words
class SlotTest {

    @Test
    void findsEveryAnswerSlotInTheTestGrid() {
        List<Slot> slots = Slot.findAllSlots(TestWords.testShape());
        assertEquals(10, slots.size(), "5 across + 5 down");
        assertEquals("Across at (0, 0), length 4", slots.get(0).toString());
    }

    // put a few letters in by hand so the patterns aren't all dots
    @Test
    void patternShowsLettersAndDots() {
        char[][] grid = TestWords.emptyGrid(5);
        grid[0][0] = 'C';
        grid[0][2] = 'T';
        grid[2][1] = 'A';
        assertEquals("C.T.", new Slot(0, 0, 4, true).getPattern(grid));
        assertEquals("..A..", new Slot(0, 1, 5, false).getPattern(grid));
        assertEquals(".....", new Slot(1, 0, 5, true).getPattern(grid));
    }

    // place two crossing words, then undo them one at a time
    @Test
    void placeAndRemoveCrossingWords() {
        char[][] grid = TestWords.emptyGrid(5);
        Slot across = new Slot(0, 0, 4, true);   // top row, 4 long
        Slot down = new Slot(0, 0, 4, false);    // left column, 4 long; shares square (0,0) with `across`

        List<int[]> acrossCells = across.placeWord(grid, "CATS");
        assertEquals("CATS", across.getPattern(grid));
        assertEquals(4, acrossCells.size());

        List<int[]> downCells = down.placeWord(grid, "COAT");
        assertEquals("COAT", down.getPattern(grid));
        assertEquals(3, downCells.size(), "the C was already there");

        down.removeWord(grid, downCells);
        assertEquals("C...", down.getPattern(grid));
        assertEquals("CATS", across.getPattern(grid), "removing COAT must leave CATS untouched (the tricky one)");

        across.removeWord(grid, acrossCells);
        assertEquals("....", across.getPattern(grid));
    }
}
