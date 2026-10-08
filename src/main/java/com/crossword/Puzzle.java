package com.crossword;

import java.util.ArrayList;
import java.util.Comparator; // Tools for sorting, e.g. Comparator.comparingInt = "sort by this number"
import java.util.List;

/*
 * ===== Step 16: A Puzzle object =====
 *
 * Everything the website needs to show and check ONE puzzle, bundled together.
 * Steps 6-15 made the pieces (grid, numbers, answers, clues); this class packages them.
 */
public class Puzzle {

    // One answer in the clue list, e.g. 5-Across: starts at row 1, col 0, 5 letters, ERRED, "Slipped up".
    // row/col/length let the website highlight the right squares when the player clicks a clue.
    public record Entry(int number, String direction, int row, int col, int length, String answer, String clue) {}

    String mode;              // "daily" (same for everyone) or "unlimited"
    long seed;                // the random seed that built the grid (for daily: made from the date, Step 23)
    String difficulty;        // "easy", "medium" or "hard"
    int size;                 // 5 for a 5x5 grid
    boolean[][] blackSquares; // true = black square
    char[][] solution;        // the filled grid, e.g. row 0 = S O C K .
    int[][] numbers;          // clue numbers from numberGrid (0 = no number)
    List<Entry> across;       // sorted by number: 1, 5, 7, 8, 9
    List<Entry> down;         // sorted by number: 1, 2, 3, 4, 6

    Puzzle(String mode, long seed, String difficulty, boolean[][] blackSquares, char[][] solution,
           int[][] numbers, List<Entry> across, List<Entry> down) {
        this.mode = mode;
        this.seed = seed;
        this.difficulty = difficulty;
        this.size = blackSquares.length;
        this.blackSquares = blackSquares;
        this.solution = solution;
        this.numbers = numbers;
        this.across = across;
        this.down = down;
    }

    /*
     * ===== Step 16a: Assemble a Puzzle =====
     *
     * Build a Puzzle from a solved grid and its clues. No API calls here: the clues are handed in,
     * so this can be tested for free (writeClues happens before, in whatever calls create).
     *
     * For every slot from Slot.findAllSlots(blackSquares):
     *   - number    = the clue number on its first square (use App.numberGrid)
     *   - direction = "across" or "down"
     *   - row, col, length = where it is
     *   - answer    = its letters in filledGrid (getPattern)
     *   - clue      = the clue in `clues` whose answer matches ("" if Claude didn't give one)
     * Put Across entries in `across` and Down entries in `down`, each sorted by number.
     *
     * Example:  the SOCK / ERRED / ADIEU / TEMPS / REST grid
     *   across -> 1 SOCK, 5 ERRED, 7 ADIEU, 8 TEMPS, 9 REST
     *   down   -> 1 SEAT, 2 ORDER, 3 CRIME, 4 KEEPS, 6 DUST
     *
     * Constraints:
     *   - findAllSlots returns Down slots column by column, which is NOT always number order,
     *     so sort each list by number before building the Puzzle.
     *   - Don't change filledGrid or blackSquares.
     *
     * Related LeetCode: 49. Group Anagrams (grouping into buckets), 179. Largest Number (sorting with a custom rule)
     */
    static Puzzle create(boolean[][] blackSquares, char[][] filledGrid, ClueWriter.ClueSet clues,
                         String mode, long seed, String difficulty) {
        // ① The clue number of every square (Step 14)
        int[][] numbers = App.numberGrid(blackSquares);

        // ② The two lists this method fills in
        List<Entry> across = new ArrayList<>();
        List<Entry> down = new ArrayList<>();

        // ③ Make one Entry for every slot (answer position) in the grid
        for (Slot slot : Slot.findAllSlots(blackSquares)) {
            int number = numbers[slot.startRow][slot.startCol];   // the number printed on the slot's first square
            String answer = slot.getPattern(filledGrid);         // a filled slot's pattern IS its word, e.g. "DUST"

            String clue = "";     // stays "" if Claude didn't write one
            for (ClueWriter.Clue c : clues.clues()) {
                if (c.answer() != null && c.answer().equalsIgnoreCase(answer)) {   // Claude may send "dust" for DUST
                    clue = c.clue();
                    break;        // found it, no need to keep looking
                }
            }

            String direction = slot.isAcross ? "across" : "down";   // "condition ? ifTrue : ifFalse" is a one-line if/else
            Entry entry = new Entry(number, direction, slot.startRow, slot.startCol, slot.length, answer, clue);

            if (slot.isAcross) {
                across.add(entry);
            } else {
                down.add(entry);
            }
        }

        // ④ Clue lists read 1, 2, 3... but findAllSlots returns Down slots column by column, so sort both
        across.sort(Comparator.comparingInt(Entry::number));   // "sort by each entry's number"
        down.sort(Comparator.comparingInt(Entry::number));

        return new Puzzle(mode, seed, difficulty, blackSquares, filledGrid, numbers, across, down);
    }
}
