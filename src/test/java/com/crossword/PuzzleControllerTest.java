package com.crossword;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

// The API's input checks and word list choice.
// These call the controller's methods directly and never reach Claude.
class PuzzleControllerTest {

    private final PuzzleController controller =
            new PuzzleController(java.util.Map.of("easy", TestWords.easy(), "medium", TestWords.everyday(), "hard", TestWords.hard()));

    @Test
    void validDifficulties() {
        assertTrue(PuzzleController.isValidDifficulty("easy"));
        assertTrue(PuzzleController.isValidDifficulty("Hard"), "any case");
        assertFalse(PuzzleController.isValidDifficulty("banana"));
        assertFalse(PuzzleController.isValidDifficulty(null), "missing");
    }

    // assertThrows runs the code and passes only if it throws that kind of exception (it hands it back to check)
    @Test
    void badDifficultyIsRejectedWith400() {
        ResponseStatusException daily = assertThrows(ResponseStatusException.class, () -> controller.daily("banana"));
        assertEquals(400, daily.getStatusCode().value());
    }

    // Time zones: a player's own date is used if it's within a day of the server's
    @Test
    void dailyDateFollowsThePlayersTimeZone() {
        java.time.LocalDate today = java.time.LocalDate.of(2026, 10, 8);
        assertEquals(today, PuzzleController.dailyDate(null, today), "no date: the server's day");
        assertEquals(today.minusDays(1), PuzzleController.dailyDate("2026-10-07", today), "behind the server (e.g. Hawaii)");
        assertEquals(today.plusDays(1), PuzzleController.dailyDate("2026-10-09", today), "ahead of the server (e.g. Tokyo)");
        assertThrows(ResponseStatusException.class, () -> PuzzleController.dailyDate("2026-10-12", today), "next week");
        assertThrows(ResponseStatusException.class, () -> PuzzleController.dailyDate("yesterday", today), "not a date");
    }

    // Harder difficulties use bigger word lists
    @Test
    void difficultyPicksTheWordList() {
        assertTrue(controller.wordsFor("hard").get(5).contains("ABHOR"), "less common words are Hard");
        assertFalse(controller.wordsFor("medium").get(5).contains("ABHOR"));
        assertTrue(controller.wordsFor("medium").get(5).contains("ALIBI"), "common words are Medium");
        assertFalse(controller.wordsFor("hard").get(5).contains("OVOID"), "extremely hard words are never answers");
        assertTrue(controller.wordsFor("medium").get(5).contains("FJORD"));
        assertFalse(controller.wordsFor("easy").get(5).contains("FJORD"), "not-easy-words.txt keeps it out of Easy");
        assertTrue(controller.wordsFor("easy").get(5).contains("MANGO"), "everyday words moved back into Easy");
        assertTrue(controller.wordsFor("easy").get(5).contains("HOUSE"));
        assertFalse(controller.wordsFor("hard").get(4).contains("DICK"), "offensive words are blocked");
    }

    // The Daily Boss is the only boss fight outside the campaign
    @Test
    void onlyTheDailyBossIsServed() {
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> controller.bossFight("unlimited", null, false)).getStatusCode().value());
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> controller.bossFight("weekly", null, false)).getStatusCode().value());
    }
}
