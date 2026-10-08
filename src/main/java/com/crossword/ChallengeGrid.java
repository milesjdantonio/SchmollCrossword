package com.crossword;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Deque;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;

/*
 * ===== Challenge mode: bigger grids =====   (written by Claude at the user's request, 2026-10-08)
 *
 * A challenge puzzle is 7x7, so answers can be up to 7 letters long. Its black squares are placed at random
 * from the seed, but always symmetrically like a real crossword: turn the grid upside down (rotate it 180
 * degrees) and the black squares land on black squares. A pattern is only used if
 *   - every white square is part of an across answer AND a down answer, each 3 or more letters long, and
 *   - all the white squares connect to each other (no island cut off from the rest).
 * Some random patterns can't be filled with real words, so fill() gives the solver a budget and moves on to the
 * next pattern when it runs out.
 */
public class ChallengeGrid {

    static final int SIZE = 7;

    // a filled challenge puzzle: where the black squares are, and the letters
    record Filled(boolean[][] blackSquares, char[][] grid) {}

    // Random symmetric black squares for this seed (the same seed always gives the same pattern)
    static boolean[][] shape(long seed) {
        Random random = new Random(seed);
        while (true) {
            boolean[][] black = new boolean[SIZE][SIZE];
            int pairs = 3 + random.nextInt(4);                  // 3 to 6 symmetric pairs: about 6 to 12 black squares
            for (int i = 0; i < pairs; i++) {
                int r = random.nextInt(SIZE), c = random.nextInt(SIZE);
                black[r][c] = true;
                black[SIZE - 1 - r][SIZE - 1 - c] = true;      // its partner, rotated 180 degrees
            }
            if (isValid(black)) {
                return black;
            }
        }
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

    // Fill a challenge grid for this seed. Tries one pattern after another until one fills within the budget.
    // Only call it while holding PuzzleStore's lock (the solver shares App's caches), see PuzzleStore.buildChallenge.
    static Filled fill(long seed, Map<Integer, List<String>> wordsByLength) {
        for (int attempt = 0; ; attempt++) {
            boolean[][] black = shape(seed * 31 + attempt);
            char[][] grid = new char[SIZE][SIZE];
            for (char[] row : grid) Arrays.fill(row, '.');
            App.solveBudget = 8_000;                            // about 1 second per grid on average (measured)
            try {
                if (App.solve(new ArrayList<>(Slot.findAllSlots(black)), grid, wordsByLength, new HashSet<>(), new Random(seed + attempt))) {
                    return new Filled(black, grid);
                }
            } finally {
                App.solveBudget = Long.MAX_VALUE;
            }
        }
    }
}
