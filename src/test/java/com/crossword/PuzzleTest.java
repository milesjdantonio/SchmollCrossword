package com.crossword;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper; // a real JSON library (comes with the Claude SDK)

// Step 16: build a Puzzle from a solved grid and its clues (no API call), then turn it into JSON
class PuzzleTest {

    private final boolean[][] shape = TestWords.testShape();
    private final char[][] sockGrid = {
        "SOCK.".toCharArray(),   // toCharArray turns a String into a char[] row
        "ERRED".toCharArray(),
        "ADIEU".toCharArray(),
        "TEMPS".toCharArray(),
        ".REST".toCharArray()
    };

    private List<ClueWriter.Clue> sockClues() {
        List<ClueWriter.Clue> clues = new ArrayList<>();
        for (String answer : List.of("SOCK", "ERRED", "ADIEU", "TEMPS", "REST", "SEAT", "ORDER", "CRIME", "KEEPS", "DUST")) {
            clues.add(new ClueWriter.Clue(answer, "clue for " + answer));
        }
        return clues;
    }

    private Puzzle sockPuzzle(List<ClueWriter.Clue> clues) {
        return Puzzle.create(shape, sockGrid, new ClueWriter.ClueSet(clues), "daily", 1, "medium");
    }

    private static List<String> numbersAndAnswers(List<Puzzle.Entry> entries) {
        List<String> out = new ArrayList<>();
        for (Puzzle.Entry e : entries) {
            out.add(e.number() + " " + e.answer());
        }
        return out;
    }

    // Step 16a
    @Test
    void entriesAreInNumberOrder() {
        Puzzle puzzle = sockPuzzle(sockClues());
        assertEquals(List.of("1 SOCK", "5 ERRED", "7 ADIEU", "8 TEMPS", "9 REST"), numbersAndAnswers(puzzle.across));
        assertEquals(List.of("1 SEAT", "2 ORDER", "3 CRIME", "4 KEEPS", "6 DUST"), numbersAndAnswers(puzzle.down));
    }

    @Test
    void numbersMatchNumberGrid() {
        assertTrue(Arrays.deepEquals(App.numberGrid(shape), sockPuzzle(sockClues()).numbers));
    }

    @Test
    void eachEntryGetsItsOwnClueAndPosition() {
        Puzzle.Entry sixDown = sockPuzzle(sockClues()).down.get(4);
        assertEquals(new Puzzle.Entry(6, "down", 1, 4, 4, "DUST", "clue for DUST"), sixDown);
    }

    @Test
    void keepsModeSeedAndDifficulty() {
        Puzzle puzzle = sockPuzzle(sockClues());
        assertEquals("daily 1 medium", puzzle.mode + " " + puzzle.seed + " " + puzzle.difficulty);
    }

    // Step 16b
    @Test
    void jsonHasEveryPart() {
        String json = sockPuzzle(sockClues()).toJson();
        assertTrue(json.startsWith("{") && json.endsWith("}"));
        assertTrue(json.contains("\"mode\":\"daily\""));
        assertTrue(json.contains("\"seed\":1,"));
        assertTrue(json.contains("\"solution\":[\"SOCK.\",\"ERRED\",\"ADIEU\",\"TEMPS\",\".REST\"]"));
        assertTrue(json.contains("\"numbers\":[[1,2,3,4,0],[5,0,0,0,6],[7,0,0,0,0],[8,0,0,0,0],[0,9,0,0,0]]"));
        assertTrue(json.contains("{\"number\":1,\"direction\":\"across\",\"row\":0,\"col\":0,\"length\":4,\"answer\":\"SOCK\",\"clue\":\"clue for SOCK\"}"));
        assertDoesNotThrow(() -> new ObjectMapper().readTree(json), "a real JSON library can read it");
    }

    // A clue with double quotes in it must still produce valid JSON
    @Test
    void quotesInsideAClueAreEscaped() {
        List<ClueWriter.Clue> clues = sockClues();
        clues.set(0, new ClueWriter.Clue("SOCK", "\"Put a ___ in it!\""));
        String json = sockPuzzle(clues).toJson();
        assertTrue(json.contains("\"clue\":\"\\\"Put a ___ in it!\\\"\""));
        assertDoesNotThrow(() -> new ObjectMapper().readTree(json));
    }
}
