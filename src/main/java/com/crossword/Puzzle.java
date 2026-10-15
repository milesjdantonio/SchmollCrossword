package com.crossword;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/*
 * Everything the website needs to show and check one puzzle: the grid, its numbers, answers and clues.
 */
public class Puzzle {

    // One answer in the clue list, e.g. 5-Across: starts at row 1, col 0, 5 letters, ERRED, "Slipped up".
    // row/col/length let the website highlight the right squares when the player clicks a clue.
    public record Entry(int number, String direction, int row, int col, int length, String answer, String clue) {}

    String mode;              // "daily" (same for everyone) or "unlimited"
    long seed;                // the random seed that built the grid (for a daily: made from the date)
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
     * Builds a Puzzle from a solved grid and its clues (handed in, so no API call here): one Entry per slot, with
     * its clue number, place, answer and clue ("" if there's none), Across and Down each sorted by number.
     * E.g. the SOCK / ERRED / ADIEU / TEMPS / REST grid:
     *   across -> 1 SOCK, 5 ERRED, 7 ADIEU, 8 TEMPS, 9 REST
     *   down   -> 1 SEAT, 2 ORDER, 3 CRIME, 4 KEEPS, 6 DUST
     */
    static Puzzle create(boolean[][] blackSquares, char[][] filledGrid, ClueWriter.ClueSet clues,
                         String mode, long seed, String difficulty) {
        // ① The clue number of every square
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

    /*
     * The puzzle as JSON for the website:
     *
     *   {"mode":"daily","seed":1,"difficulty":"medium","size":5,
     *    "solution":["SOCK.","ERRED","ADIEU","TEMPS",".REST"],
     *    "numbers":[[1,2,3,4,0],[5,0,0,0,6],[7,0,0,0,0],[8,0,0,0,0],[0,9,0,0,0]],
     *    "across":[{"number":1,"direction":"across","row":0,"col":0,"length":4,"answer":"SOCK","clue":"..."}, ...],
     *    "down":[ ...same shape... ]}
     *
     * Every piece of text goes through quote(...), which escapes quotes and backslashes. Black squares are the '.'
     * in the "solution" rows, so there's no separate list of them.
     */
    String toJson() {
        StringBuilder sb = new StringBuilder("{");
        sb.append("\"mode\":").append(quote(this.mode)).append(",");
        sb.append("\"seed\":").append(this.seed).append(",");
        sb.append("\"difficulty\":").append(quote(this.difficulty)).append(",");   // text, so it needs quote()
        sb.append("\"size\":").append(this.size).append(",");

        // "solution":["SOCK.","ERRED",...]  (black squares are the '.')
        sb.append("\"solution\":[");
        for (int r = 0; r < solution.length; r++) {
            if (r > 0) sb.append(",");                        // comma BETWEEN items only
            sb.append(quote(new String(solution[r])));       // char[] row -> "SOCK."
        }
        sb.append("],");

        // "numbers":[[1,2,3,4,0],[5,0,0,0,6],...]
        sb.append("\"numbers\":[");
        for (int r = 0; r < numbers.length; r++) {
            if (r > 0) sb.append(",");
            sb.append("[");
            for (int c = 0; c < numbers[r].length; c++) {
                if (c > 0) sb.append(",");
                sb.append(numbers[r][c]);
            }
            sb.append("]");
        }
        sb.append("],");

        sb.append("\"across\":").append(entriesJson(across)).append(",");
        sb.append("\"down\":").append(entriesJson(down));
        sb.append("}");
        return sb.toString();
    }

    // [{...},{...}] for a list of entries (Across and Down share this, so it's written once)
    private static String entriesJson(List<Entry> entries) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < entries.size(); i++) {
            if (i > 0) sb.append(",");
            Entry e = entries.get(i);
            sb.append("{\"number\":").append(e.number())
              .append(",\"direction\":").append(quote(e.direction()))
              .append(",\"row\":").append(e.row())
              .append(",\"col\":").append(e.col())
              .append(",\"length\":").append(e.length())
              .append(",\"answer\":").append(quote(e.answer()))
              .append(",\"clue\":").append(quote(e.clue()))
              .append("}");
        }
        return sb.append("]").toString();
    }

    // Wraps text in double quotes and escapes the characters that would break JSON (already done for you).
    // quote("Hi") -> "Hi"      quote("Say \"cheese\"") -> "Say \"cheese\""
    static String quote(String text) {
        StringBuilder sb = new StringBuilder("\"");
        for (char ch : text.toCharArray()) {
            if (ch == '"') {
                sb.append("\\\"");          // " becomes \"
            } else if (ch == '\\') {
                sb.append("\\\\");          // \ becomes \\
            } else if (ch == '\n') {
                sb.append("\\n");           // a line break becomes \n
            } else {
                sb.append(ch);
            }
        }
        return sb.append('"').toString();
    }
}
