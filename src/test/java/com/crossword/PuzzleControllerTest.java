package com.crossword;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

// Steps 18 and 24: the API's input checks and word list choice.
// These call the controller's methods directly and never reach Claude.
class PuzzleControllerTest {

    private final PuzzleController controller = new PuzzleController(TestWords.everyday(), TestWords.withHardWords());

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
                () -> controller.unlimited("banana", false));
        assertEquals(400, unlimited.getStatusCode().value());
    }

    // Step 24: Settings > "Allow harder words in Unlimited" picks the bigger word list
    @Test
    void hardWordsSettingPicksTheBiggerList() {
        assertTrue(controller.wordsFor(true).get(5).contains("OVOID"));
        assertFalse(controller.wordsFor(false).get(5).contains("OVOID"));
        assertFalse(controller.wordsFor(true).get(4).contains("DICK"), "offensive words are blocked either way");
    }

}
