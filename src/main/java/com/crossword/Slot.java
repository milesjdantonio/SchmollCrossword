package com.crossword;

import java.util.ArrayList;
import java.util.List;

public class Slot {
    int startRow;
    int startCol;
    int length;
    boolean isAcross; // true = across, false = down

    Slot (int startRow, int startCol, int length, boolean isAcross) {
        this.startRow = startRow;
        this.startCol = startCol;
        this.length = length;
        this.isAcross = isAcross;
    }

    @Override
    public String toString() {
        String direction = isAcross ? "Across" : "Down";
        return direction + " at (" + startRow + ", " + startCol + "), length " + length;
    }

    static List<Slot> findAllSlots(boolean[][] blackSquares) {
        List<Slot> slots = new ArrayList<>();
        slots.addAll(findAcrossSlots(blackSquares));
        slots.addAll(findDownSlots(blackSquares));
        return slots;
    }

    static List<Slot> findAcrossSlots(boolean[][] blackSquares) {
        List<Slot> slots = new ArrayList<>();
        int size = blackSquares.length;

        for (int row = 0; row < size; row++) {
            int runStart = -1; // run not going

            for (int col = 0; col < size; col++) {
                boolean isBlack = blackSquares[row][col];

                if (!isBlack && runStart == -1) {
                    runStart = col;
                } else if (isBlack && runStart != -1) {
                    int length = col - runStart;
                    if (length >= 3) {
                        slots.add(new Slot(row, runStart, length, true));
                    }
                    runStart = -1;
                }
            }

            if (runStart != -1) {
                int length = size - runStart;
                if (length >= 3) {
                    slots.add(new Slot(row, runStart, length, true));
                }
            }
        }
        return slots;
    }

    static List<Slot> findDownSlots(boolean[][] blackSquares) {
        List<Slot> slots = new ArrayList<>();
        int size = blackSquares.length;

        for (int col = 0; col < size; col++) {
            int runStart = -1;

            for (int row = 0; row < size; row++) {
                boolean isBlack = blackSquares[row][col];

                if (!isBlack && runStart == -1) {
                    runStart = row;
                } else if (isBlack && runStart != -1) {
                    int length = row - runStart;
                    if (length >= 3) {
                        slots.add(new Slot(runStart, col, length, false));
                    }
                    runStart = -1;
                }
            }

            if (runStart != -1) {
                int length = size - runStart;
                if (length >= 3) {
                    slots.add(new Slot(runStart, col, length, false));
                }
            }
        }
        return slots;
    }

    List<int[]> getCells() {
        List<int[]> cells = new ArrayList<>();
        for (int i = 0; i < length; i++) {
            if (isAcross) {
                cells.add(new int[] {startRow, startCol + i});
            } else {
                cells.add(new int[] {startRow + i, startCol});
            }
        }
        return cells;
    }

    String getPattern(char[][] filledGrid) {
        StringBuilder pattern = new StringBuilder(); // a String you can add to, cheaper than += in a loop
        for (int[] cell : getCells()) {
            pattern.append(filledGrid[cell[0]][cell[1]]); // cell[0] = row, cell[1] = col
        }
        return pattern.toString();
    }

    /*
     * ===== Step 8a: Place a Word =====
     *
     * Write `word` into filledGrid along this slot, one letter per square.
     * Return the squares that were EMPTY ('.') before and got a letter from this call.
     * Squares that already had a letter (from a crossing word) are NOT in the list.
     *
     * Example:  grid row 0 = "C...", slot = Across (0,0) length 4, word = "CATS"
     *           -> grid row 0 becomes "CATS"
     *           -> returns [{0,1}, {0,2}, {0,3}]   (the C was already there)
     *
     * Constraints:
     *   - word.length() == length, and word already fits getPattern() (findMatches guarantees this).
     *   - Never return null. If nothing was empty, return an empty list.
     *
     * Related LeetCode: 37. Sudoku Solver, 51. N-Queens (place a choice, remember it, undo it later)
     */
    List<int[]> placeWord(char[][] filledGrid, String word) {
        List<int[]> result = new ArrayList<>();
        List<int[]> cells = getCells();

        for (int i = 0; i < cells.size(); i++) {
            int[] cell = cells.get(i);

            if (filledGrid[cell[0]][cell[1]] == '.') {
                filledGrid[cell[0]][cell[1]] = word.charAt(i);
                result.add(cells.get(i));
            }
        }
        return result; // placeholder so the project compiles
    }

    /*
     * ===== Step 8b: Remove a Word =====
     *
     * Undo a placeWord: set every square in `placedCells` back to '.'.
     * Only touch those squares, so letters that belong to crossing words stay put.
     *
     * Example:  after placing "CATS" above, removeWord(grid, [{0,1}, {0,2}, {0,3}])
     *           -> grid row 0 is back to "C..."
     */
    void removeWord(char[][] filledGrid, List<int[]> placedCells) {
        for (int[] placedCell : placedCells) {
            filledGrid[placedCell[0]][placedCell[1]] = '.'; 
        }
    }
}