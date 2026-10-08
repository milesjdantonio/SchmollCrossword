package com.crossword;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

// Shared by the test classes: the word lists are loaded once, and everyone uses the SAME map, so App's
// Trie and match cache (which remember which map they were built from) aren't rebuilt over and over.
final class TestWords {

    private static Map<Integer, List<String>> everyday;
    private static Map<Integer, List<String>> withHardWords;
    private static Map<Integer, List<String>> easy;

    private static Map<Integer, List<String>> hard;

    // The hard list (design pass): less common words, but not the extremely hard ones
    static synchronized Map<Integer, List<String>> hard() {
        if (hard == null) {
            try {
                hard = App.loadWordsFor("hard");
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        }
        return hard;
    }

    // The easy list (design pass): only SCOWL level 10-20 words
    static synchronized Map<Integer, List<String>> easy() {
        if (easy == null) {
            try {
                easy = App.loadWordsFor("easy");
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        }
        return easy;
    }

    // The normal list: blocked and too-hard words skipped
    static synchronized Map<Integer, List<String>> everyday() {
        if (everyday == null) {
            everyday = load(true);
        }
        return everyday;
    }

    // The "harder words" list (Step 13c setting turned off): too-hard words allowed, offensive ones still blocked
    static synchronized Map<Integer, List<String>> withHardWords() {
        if (withHardWords == null) {
            withHardWords = load(false);
        }
        return withHardWords;
    }

    private static Map<Integer, List<String>> load(boolean skipTooHardWords) {
        try {
            return App.loadWords(skipTooHardWords);
        } catch (IOException e) {
            throw new UncheckedIOException(e);   // turns a checked exception into one that needs no "throws"
        }
    }

    // The 5x5 test grid from App.main: black squares in the top-right and bottom-left corners
    static boolean[][] testShape() {
        return new boolean[][] {
            {false, false, false, false, true},
            {false, false, false, false, false},
            {false, false, false, false, false},
            {false, false, false, false, false},
            {true,  false, false, false, false}
        };
    }

    // An all-empty grid ('.' everywhere)
    static char[][] emptyGrid(int size) {
        char[][] grid = new char[size][size];
        for (char[] row : grid) {
            Arrays.fill(row, '.');
        }
        return grid;
    }

    private TestWords() {}   // only static helpers: nobody makes a TestWords object
}
