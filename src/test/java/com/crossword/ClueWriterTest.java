package com.crossword;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import org.junit.jupiter.api.Test;

// Step 15a-15b: the prompt and the clue checks. Free: no internet, no API call (the paid ones are in LiveClaudeTest).
class ClueWriterTest {

    private final List<String> twoAnswers = List.of("DESK", "CATS");

    private static ClueWriter.ClueSet clues(ClueWriter.Clue... clues) {   // "..." = any number of Clues
        return new ClueWriter.ClueSet(List.of(clues));
    }

    @Test
    void promptMentionsTheAnswersAndDifficulty() {
        String prompt = ClueWriter.buildPrompt(twoAnswers, "hard");
        assertTrue(prompt.contains("DESK"));
        assertTrue(prompt.contains("CATS"));
        assertTrue(prompt.contains("hard"));
    }

    @Test
    void goodCluesHaveNoProblems() {
        ClueWriter.ClueSet good = clues(
                new ClueWriter.Clue("DESK", "Office furniture with drawers"),
                new ClueWriter.Clue("CATS", "Some purring pets"));
        assertEquals(0, ClueWriter.findProblems(good, twoAnswers).size());
    }

    @Test
    void aMissingClueIsCaught() {
        ClueWriter.ClueSet missingOne = clues(new ClueWriter.Clue("DESK", "Office furniture with drawers"));
        assertEquals(1, ClueWriter.findProblems(missingOne, twoAnswers).size());
    }

    @Test
    void aClueContainingItsAnswerIsCaught() {
        ClueWriter.ClueSet givesItAway = clues(
                new ClueWriter.Clue("DESK", "Office furniture with drawers"),
                new ClueWriter.Clue("CATS", "Pets like these cats"));
        assertEquals(1, ClueWriter.findProblems(givesItAway, twoAnswers).size());
    }

    @Test
    void anUnexpectedAnswerIsCaught() {
        ClueWriter.ClueSet extraWord = clues(
                new ClueWriter.Clue("DESK", "Office furniture with drawers"),
                new ClueWriter.Clue("CATS", "Some purring pets"),
                new ClueWriter.Clue("CHAIR", "Seat with a back"));
        assertEquals(1, ClueWriter.findProblems(extraWord, twoAnswers).size());
    }
}
