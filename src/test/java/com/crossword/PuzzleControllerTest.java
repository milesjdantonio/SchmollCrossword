package com.crossword;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest; // a pretend web request, so no server is needed
import org.springframework.web.server.ResponseStatusException;

// Steps 18, 24 and 26: the API's input checks, word list choice and rate limit.
// These call the controller's methods directly and never reach Claude.
class PuzzleControllerTest {

    // A limit of 0 means every unlimited request is refused, so a test can never trigger a real (paid) puzzle
    private final PuzzleController controller =
            new PuzzleController(java.util.Map.of("easy", TestWords.easy(), "medium", TestWords.everyday(), "hard", TestWords.hard()),
                    TestWords.withHardWords(), new RateLimiter(0, 0));

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
        ResponseStatusException unlimited = assertThrows(ResponseStatusException.class,
                () -> controller.unlimited("banana", false, new MockHttpServletRequest()));
        assertEquals(400, unlimited.getStatusCode().value());
    }

    // Design pass: harder difficulties use bigger word lists
    @Test
    void difficultyPicksTheWordList() {
        assertTrue(controller.wordsFor("hard").get(5).contains("ALIBI"), "less common words are Hard");
        assertFalse(controller.wordsFor("medium").get(5).contains("ALIBI"));
        assertFalse(controller.wordsFor("hard").get(5).contains("OVOID"), "extremely hard words need the setting");
        assertTrue(controller.wordsFor("hard", true).get(5).contains("OVOID"));
        assertFalse(controller.wordsFor("medium", true).get(5).contains("OVOID"), "the setting only changes Hard");
        assertTrue(controller.wordsFor("medium").get(5).contains("FJORD"));
        assertFalse(controller.wordsFor("easy").get(5).contains("FJORD"), "not-easy-words.txt keeps it out of Easy");
        assertTrue(controller.wordsFor("easy").get(5).contains("MANGO"), "everyday words moved back into Easy");
        assertTrue(controller.wordsFor("easy").get(5).contains("HOUSE"));
        assertFalse(controller.wordsFor("hard", true).get(4).contains("DICK"), "offensive words are blocked either way");
    }

    // Step 26: over the limit = HTTP 429 "too many requests", before any puzzle (or Claude call) is made
    @Test
    void overTheLimitIsRejectedWith429() {
        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> controller.unlimited("easy", false, new MockHttpServletRequest()));
        assertEquals(429, e.getStatusCode().value());
    }
}
