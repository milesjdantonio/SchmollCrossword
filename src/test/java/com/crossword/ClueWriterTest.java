package com.crossword;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.anthropic.core.JsonValue;
import com.anthropic.core.http.Headers;
import com.anthropic.errors.AnthropicIoException;
import com.anthropic.errors.BadRequestException;
import com.anthropic.errors.RateLimitException;

// The prompt, the clue checks and the retry and fallback rules. Free: a pretend Claude answers, so there's no
// internet and no API call (the paid checks are in LiveClaudeTest).
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

    // ---- a pretend Claude: hands out scripted replies (or throws scripted errors) and remembers which models were asked
    private final Deque<Object> script = new ArrayDeque<>();
    private final List<String> modelsAsked = new ArrayList<>();
    private final List<String> promptsSent = new ArrayList<>();

    @BeforeEach
    void pretendClaude() {
        ClueWriter.asker = new ClueWriter.Asker() {
            @SuppressWarnings("unchecked")
            public <T> T ask(String prompt, Class<T> type, String model) {
                modelsAsked.add(model);
                promptsSent.add(prompt);
                Object next = script.poll();
                if (next instanceof RuntimeException e) throw e;
                return (T) next;
            }
        };
    }

    @AfterEach
    void realClaudeAgain() {
        ClueWriter.asker = ClueWriter::askModel;
    }

    private static RateLimitException rateLimited() {
        return RateLimitException.builder().headers(Headers.builder().build()).body(JsonValue.from(Map.of())).build();
    }

    private static ClueWriter.ReviewSet allGood() {
        return new ClueWriter.ReviewSet(List.of(new ClueWriter.Review("DESK", true, ""), new ClueWriter.Review("CATS", true, "")));
    }

    @Test
    void aBusyStrongModelFallsBackToTheFastOne() {
        script.add(rateLimited());                                          // Sonnet's draft: rate-limited
        script.add(clues(new ClueWriter.Clue("DESK", "Office furniture with drawers"), new ClueWriter.Clue("CATS", "Some purring pets")));
        script.add(allGood());                                              // the review
        ClueWriter.ClueSet result = ClueWriter.writeClues(twoAnswers, "hard");
        assertEquals("Office furniture with drawers", result.clues().get(0).clue());
        assertEquals(List.of(ClueWriter.STRONG_MODEL, ClueWriter.MODEL, ClueWriter.REVIEW_MODEL), modelsAsked);
    }

    @Test
    void aBadRequestIsNotRetriedOnAnotherModel() {
        script.add(BadRequestException.builder().headers(Headers.builder().build()).body(JsonValue.from(Map.of())).build());
        assertThrows(BadRequestException.class, () -> ClueWriter.writeClues(twoAnswers, "hard"));
        assertEquals(List.of(ClueWriter.STRONG_MODEL), modelsAsked);
        assertFalse(ClueWriter.fallsBack(new IllegalStateException("no key")));
        assertTrue(ClueWriter.fallsBack(new AnthropicIoException("timed out")));
    }

    @Test
    void twoBrokenDraftsFailInsteadOfSavingBadClues() {
        script.add(clues(new ClueWriter.Clue("DESK", "Office furniture with drawers")));         // CATS is missing
        script.add(clues(new ClueWriter.Clue("DESK", "A desk")));                                // gives DESK away
        assertThrows(ClueWriter.CluesFailed.class, () -> ClueWriter.writeClues(twoAnswers, "easy"));
        assertTrue(promptsSent.get(1).contains("missing clue for CATS"), "the retry says what was wrong");
    }

    @Test
    void aFailedReviewKeepsTheDraft() {
        script.add(clues(new ClueWriter.Clue("DESK", "Office furniture with drawers."), new ClueWriter.Clue("CATS", "Some purring pets")));
        script.add(new AnthropicIoException("timed out"));                  // the review times out
        script.add(new AnthropicIoException("timed out"));                  // ...and so does the fast model
        ClueWriter.ClueSet result = ClueWriter.writeClues(twoAnswers, "easy");
        assertEquals("Office furniture with drawers", result.clues().get(0).clue(), "kept, and tidied");
    }

    @Test
    void onlyTheFlaggedCluesAreRewritten() {
        script.add(clues(new ClueWriter.Clue("DESK", "Office furniture with drawers"), new ClueWriter.Clue("CATS", "Pets")));
        script.add(new ClueWriter.ReviewSet(List.of(new ClueWriter.Review("DESK", true, ""), new ClueWriter.Review("CATS", false, "CATS: fits DOGS too"))));
        script.add(clues(new ClueWriter.Clue("CATS", "Purring pets that chase yarn")));
        ClueWriter.ClueSet result = ClueWriter.writeClues(twoAnswers, "easy");
        assertEquals("Office furniture with drawers", result.clues().get(0).clue());
        assertEquals("Purring pets that chase yarn", result.clues().get(1).clue());
        String fix = promptsSent.get(2);
        assertTrue(fix.contains("CATS: fits DOGS too") && fix.contains("DESK: Office furniture with drawers"), "shows the problem and the kept clues");
        assertFalse(fix.substring(fix.indexOf("Answers (one per line):")).contains("DESK\n"), "asks only for the flagged answer");
    }

    // Whole words only: ERA inside "General" isn't a giveaway; DESKS for DESK is
    @Test
    void giveawaysAreWholeWordsOrForms() {
        assertFalse(ClueWriter.givesAway("General store", "ERA"));
        assertFalse(ClueWriter.givesAway("Running late", "ATE"));
        assertTrue(ClueWriter.givesAway("Office desks", "DESK"));
        assertTrue(ClueWriter.givesAway("Cat's meow", "CAT"));
    }

    @Test
    void cluesAreTidied() {
        assertEquals("Wooden box", ClueWriter.tidy("  Wooden   box. "));
        assertEquals("Carmen, e.g.", ClueWriter.tidy("Carmen, e.g."));
        assertEquals("And so on, etc.", ClueWriter.tidy("And so on, etc."));
        assertEquals("Wait for it...", ClueWriter.tidy("Wait for it..."));
    }

    @Test
    void thePromptAsksForFewerBareSynonyms() {
        String prompt = ClueWriter.buildPrompt(twoAnswers, "medium");
        assertTrue(prompt.contains("bare synonyms"));
        assertTrue(ClueWriter.buildReviewPrompt(clues(new ClueWriter.Clue("DESK", "Table")), "medium", "").contains("bare synonym"));
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

    // quality control. The editor's prompt lists every clue and asks about truth, not just structure
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
