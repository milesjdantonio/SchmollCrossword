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

    // Every difficulty uses the cheapest model now (Haiku 5.5); modelFor still lets each one pick its own
    @Test
    void easyUsesTheCheaperModel() {
        assertEquals(ClueWriter.EASY_MODEL, ClueWriter.modelFor("easy"));
        assertEquals(ClueWriter.MODEL, ClueWriter.modelFor("medium"));
        assertEquals(ClueWriter.MODEL, ClueWriter.modelFor("hard"));
    }

    // Haiku 5.5 drafts easy and medium; Sonnet 5.5 drafts hard, Challenge/Expert grids and bosses, and reviews everything
    @Test
    void theStrongerModelWritesHardChallengeAndBossClues() {
        assertEquals(ClueWriter.MODEL, ClueWriter.draftModel("easy", false));
        assertEquals(ClueWriter.MODEL, ClueWriter.draftModel("medium", false));
        assertEquals(ClueWriter.STRONG_MODEL, ClueWriter.draftModel("hard", false));
        assertEquals(ClueWriter.STRONG_MODEL, ClueWriter.draftModel("medium", true));    // a Challenge grid or a boss
        assertEquals("claude-sonnet-5-5", ClueWriter.REVIEW_MODEL);
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

    // Step 15e: quality control. The editor's prompt lists every clue and asks about truth, not just structure
    @Test
    void reviewPromptListsTheCluesAndAsksIfTheyAreTrue() {
        String prompt = ClueWriter.buildReviewPrompt(clues(
                new ClueWriter.Clue("DESK", "Office furniture with drawers"),
                new ClueWriter.Clue("CATS", "Some purring pets")), "easy", "");
        assertTrue(prompt.contains("DESK: Office furniture with drawers"));
        assertTrue(prompt.contains("CATS: Some purring pets"));
        assertTrue(prompt.contains("TRUE"));
    }

    // Only failed clues for answers in this puzzle become problems; a failure with no reason still counts
    @Test
    void reviewProblemsKeepsOnlyRealFailures() {
        ClueWriter.ReviewSet review = new ClueWriter.ReviewSet(List.of(
                new ClueWriter.Review("DESK", true, ""),
                new ClueWriter.Review("cats", false, "CATS: dogs purr too? No, but the clue is vague"),
                new ClueWriter.Review("CHAIR", false, "CHAIR: not in this puzzle"),
                new ClueWriter.Review("DESK", false, null)));
        List<String> problems = ClueWriter.reviewProblems(review, twoAnswers);
        assertEquals(2, problems.size());
        assertTrue(problems.get(0).startsWith("CATS"));
        assertTrue(problems.get(1).startsWith("DESK"));
        assertEquals(0, ClueWriter.reviewProblems(null, twoAnswers).size());
    }
}
