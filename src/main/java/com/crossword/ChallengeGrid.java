package com.crossword;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Deque;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;

/*
 * ===== Challenge mode: bigger grids =====   (written by Claude at the user's request, 2026-10-08)
 *
 * Each challenge picks its board size from its seed (see SIZES), so some days are bigger than others. Its black
 * squares are random too, but always symmetric like a real crossword: turn the grid upside down (rotate it 180
 * degrees) and the black squares land on black squares. Bigger boards sometimes get one right in the middle.
 *
 * A pattern is only used if
 *   - every white square is part of an across answer AND a down answer, each 3 or more letters long, and
 *   - all the white squares connect to each other (no island cut off from the rest).
 * Long runs of white squares are broken up with black squares, except for a few 6- and 7-letter answers that are
 * kept on purpose: long answers crossing long answers are almost impossible to fill with everyday words.
 *
 * Filling: medium words first (the user asked for mostly medium words). Only if a pattern can't be filled with
 * those does it try Hard's bigger list, and if that fails too, the next pattern. The solver gets a budget
 * (App.solveBudget) for each try, so one stubborn pattern can't take forever.
 */
public class ChallengeGrid {

    static final int[] SIZES = {6, 7, 9};         // board sizes (measured: these fill fast; 8x8 can never keep a 6+ letter answer)
    static final int BUDGET = 8_000;              // solve() calls per try

    // a filled challenge puzzle: where the black squares are, and the letters
    record Filled(boolean[][] blackSquares, char[][] grid) {}

    // The board size for a seed (the same seed always gives the same size)
    static int sizeFor(long seed) {
        return SIZES[new Random(seed ^ 0x5eedL).nextInt(SIZES.length)];
    }

    // A black square and its partner, rotated 180 degrees
    private static void setPair(boolean[][] black, int r, int c) {
        int n = black.length;
        black[r][c] = true;
        black[n - 1 - r][n - 1 - c] = true;
    }

    // Random symmetric black squares for this seed and size
    static boolean[][] shape(long seed, int n) {
        Random random = new Random(seed);
        while (true) {
            boolean[][] black = new boolean[n][n];
            // bigger boards: sometimes a black square in the very middle (or a pair beside it on even sizes)
            if (n >= 7 && random.nextInt(3) == 0) setPair(black, n / 2, (n - 1) / 2);
            for (int i = random.nextInt(n / 3 + 1); i > 0; i--) setPair(black, random.nextInt(n), random.nextInt(n));
            // keep this many answers of 6+ letters (never more than 7 letters); break up every other long run
            int keepLong = 1 + random.nextInt(2) + (n >= 8 ? 1 : 0);
            for (int step = 0; step < 80; step++) {
                List<int[]> runs = runs(black);                        // {row, col, length, across ? 1 : 0}
                List<int[]> tooLong = new ArrayList<>(), longOnes = new ArrayList<>();
                for (int[] run : runs) {
                    if (run[2] > 7) tooLong.add(run);
                    else if (run[2] >= 6) longOnes.add(run);
                }
                int[] split;
                if (!tooLong.isEmpty()) split = tooLong.get(random.nextInt(tooLong.size()));
                else if (longOnes.size() > keepLong) split = longOnes.get(random.nextInt(longOnes.size()));
                else break;
                // where to put the black square: both leftover pieces must be 0 or at least 3 letters long
                List<Integer> spots = new ArrayList<>();
                for (int i = 0; i < split[2]; i++) {
                    int before = i, after = split[2] - 1 - i;
                    if ((before == 0 || before >= 3) && (after == 0 || after >= 3)) spots.add(i);
                }
                List<Integer> inside = new ArrayList<>(), ends = List.of(0, split[2] - 1);
                for (int i : spots) if (i > 0 && i < split[2] - 1) inside.add(i);
                // a run that's too long (8-9) is sometimes cut at one end instead of the middle, which leaves a 6- or
                // 7-letter answer behind (cutting an 8 in the middle always leaves pieces of 5 or less)
                boolean keepALongOne = split[2] > 7 && longOnes.size() < keepLong && random.nextBoolean();
                List<Integer> pick = keepALongOne || inside.isEmpty() ? ends : inside;
                int i = pick.get(random.nextInt(pick.size()));
                setPair(black, split[0] + (split[3] == 1 ? 0 : i), split[1] + (split[3] == 1 ? i : 0));
            }
            // a black square can leave a white square stranded in a 1- or 2-letter run the other way: black those out
            // too (crossword makers call them cheater squares), until every run is 3+ letters long
            boolean changed = true;
            while (changed) {
                changed = false;
                for (int r = 0; r < n; r++) {
                    for (int c = 0; c < n; c++) {
                        if (!black[r][c] && (run(black, r, c, true) < 3 || run(black, r, c, false) < 3)) {
                            setPair(black, r, c);
                            changed = true;
                        }
                    }
                }
            }
            int blacks = 0;
            for (boolean[] row : black) for (boolean b : row) if (b) blacks++;
            int longest = 0;
            for (int[] run : runs(black)) longest = Math.max(longest, run[2]);
            // a challenge must have at least one answer of 6+ letters, and isn't more than about 30% black
            if (longest >= 6 && blacks <= n * n * 3 / 10 && isValid(black)) {         // at most about 30% black
                return black;
            }
        }
    }

    // every run of white squares (across and down) as {row, col, length, across ? 1 : 0}
    static List<int[]> runs(boolean[][] black) {
        int n = black.length;
        List<int[]> out = new ArrayList<>();
        for (int a = 0; a < n; a++) {
            for (int across = 0; across < 2; across++) {
                int start = -1;
                for (int b = 0; b <= n; b++) {
                    boolean open = b < n && !(across == 1 ? black[a][b] : black[b][a]);
                    if (open && start < 0) start = b;
                    if (!open && start >= 0) {
                        out.add(across == 1 ? new int[] {a, start, b - start, 1} : new int[] {start, a, b - start, 0});
                        start = -1;
                    }
                }
            }
        }
        return out;
    }

    static boolean isValid(boolean[][] black) {
        int n = black.length, white = 0, firstR = -1, firstC = -1;
        for (int r = 0; r < n; r++) {
            for (int c = 0; c < n; c++) {
                if (black[r][c]) continue;
                white++;
                if (firstR < 0) { firstR = r; firstC = c; }
                if (run(black, r, c, true) < 3 || run(black, r, c, false) < 3) return false;
            }
        }
        if (white == 0) return false;
        // flood fill from the first white square: every white square must be reachable
        boolean[][] seen = new boolean[n][n];
        Deque<int[]> todo = new ArrayDeque<>();
        todo.push(new int[] {firstR, firstC});
        seen[firstR][firstC] = true;
        int reached = 0;
        while (!todo.isEmpty()) {
            int[] p = todo.pop();
            reached++;
            for (int[] d : new int[][] {{1, 0}, {-1, 0}, {0, 1}, {0, -1}}) {
                int r = p[0] + d[0], c = p[1] + d[1];
                if (r >= 0 && r < n && c >= 0 && c < n && !black[r][c] && !seen[r][c]) {
                    seen[r][c] = true;
                    todo.push(new int[] {r, c});
                }
            }
        }
        return reached == white;
    }

    // how long the across (or down) run of white squares through (r, c) is
    static int run(boolean[][] black, int r, int c, boolean across) {
        int n = black.length, len = 1;
        int dr = across ? 0 : 1, dc = across ? 1 : 0;
        for (int i = 1; r - dr * i >= 0 && c - dc * i >= 0 && !black[r - dr * i][c - dc * i]; i++) len++;
        for (int i = 1; r + dr * i < n && c + dc * i < n && !black[r + dr * i][c + dc * i]; i++) len++;
        return len;
    }

    // Fill a challenge grid for this seed: medium words first, Hard's list only if a pattern needs it.
    // Only call it while holding PuzzleStore's lock (the solver shares App's caches), see PuzzleStore.buildChallenge.
    static Filled fill(long seed, Map<Integer, List<String>> mediumWords, Map<Integer, List<String>> hardWords) {
        return fill(seed, sizeFor(seed), mediumWords, hardWords, Set.of());
    }

    // The same with a chosen board size n (campaign levels pick theirs) and words to stay away from (`avoid`:
    // answers of recent puzzles, so the same words don't keep coming back). Tries `first`'s words, then `second`'s.
    // If a few patterns in a row can't be filled without the avoided words, it stops avoiding them.
    static Filled fill(long seed, int n, Map<Integer, List<String>> first, Map<Integer, List<String>> second, Set<String> avoid) {
        return fill(seed, n, first, second, avoid, 0);
    }
    // firstOnly: how many patterns to try with `first`'s words alone before `second`'s are allowed too (the campaign
    // uses this so its easier words win far more often: added by Claude, 2026-10-10)
    static Filled fill(long seed, int n, Map<Integer, List<String>> first, Map<Integer, List<String>> second, Set<String> avoid, int firstOnly) {
        for (int attempt = 0; ; attempt++) {
            boolean[][] black = shape(seed * 31 + attempt, n);
            for (Map<Integer, List<String>> words : attempt < firstOnly ? List.of(first) : List.of(first, second)) {
                char[][] grid = new char[n][n];
                for (char[] row : grid) Arrays.fill(row, '.');
                App.solveBudget = BUDGET;
                try {
                    Set<String> used = new HashSet<>(attempt < 6 ? avoid : Set.of());
                    if (App.solve(new ArrayList<>(Slot.findAllSlots(black)), grid, words, used, new Random(seed + attempt))) {
                        return new Filled(black, grid);
                    }
                } finally {
                    App.solveBudget = Long.MAX_VALUE;
                }
            }
        }
    }
}
