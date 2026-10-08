package com.crossword;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Random;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/*
 * ===== Step 18: The puzzle API =====
 *
 * A "controller" answers web requests. Each method marked @GetMapping is connected to a URL:
 *
 *   http://localhost:8080/api/daily?difficulty=hard      -> daily("hard")
 *   http://localhost:8080/api/unlimited?difficulty=easy  -> unlimited("easy")
 *
 * Whatever the method returns is sent back to the browser. Ours return the JSON text from Puzzle.toJson().
 * @RequestParam reads the "?difficulty=..." part of the URL (and uses "medium" if it's missing).
 */
@RestController
public class PuzzleController {

    // Loaded ONCE when the server starts, then reused for every request (loading it per request would be slow)
    private final Map<Integer, List<String>> wordsByLength;

    // Spring Boot uses this one when the server starts
    public PuzzleController() throws IOException {
        this(App.loadWords());
    }

    // The tests use this one, handing in a word list they already loaded
    PuzzleController(Map<Integer, List<String>> wordsByLength) {
        this.wordsByLength = wordsByLength;
    }

    /*
     * ===== Step 18a: Is this a real difficulty? =====
     *
     * The URL is typed by whoever is calling the API, so it can contain anything (?difficulty=banana).
     * Return true only for "easy", "medium" or "hard", ignoring upper/lower case ("Hard" is fine). Null is false.
     *
     * Example:  isValidDifficulty("Hard") -> true      isValidDifficulty("banana") -> false
     *
     * Related LeetCode: 20. Valid Parentheses, 65. Valid Number (never trust input; check it first)
     */
    static boolean isValidDifficulty(String difficulty) {
        if (difficulty == null) return false;
        if (difficulty.toLowerCase().equals("easy")) return true;
        if (difficulty.toLowerCase().equals("medium")) return true;
        if (difficulty.toLowerCase().equals("hard")) return true;
        return false;
    }

    /*
     * ===== Step 18b: GET /api/daily =====
     *
     * 1. If the difficulty isn't valid, stop with:   throw badDifficulty(difficulty);
     * 2. Otherwise return today's daily puzzle for that difficulty (lowercased) from PuzzleStore.getDaily,
     *    using PuzzleStore.DAILY_FOLDER, LocalDate.now() and this.wordsByLength.
     */
    @GetMapping(value = "/api/daily", produces = MediaType.APPLICATION_JSON_VALUE)
    public String daily(@RequestParam(defaultValue = "medium") String difficulty) throws IOException {
        if (!isValidDifficulty(difficulty)) {        // "if it's NOT a real difficulty..."
            throw badDifficulty(difficulty);         // ...stop here and send HTTP 400
        }
        return PuzzleStore.getDaily(PuzzleStore.DAILY_FOLDER, LocalDate.now(), difficulty.toLowerCase(), wordsByLength);
    }

    /*
     * ===== Step 18c: GET /api/unlimited =====
     *
     * 1. Same difficulty check as 18b.
     * 2. Otherwise return PuzzleStore.generateUnlimited(...) with a random seed: new Random().nextLong()
     *    (no seed in the Random = different every time, which is exactly what unlimited mode wants).
     *
     * Every unlimited puzzle is a paid API call; Step 26 adds a rate limit before the site goes public.
     */
    @GetMapping(value = "/api/unlimited", produces = MediaType.APPLICATION_JSON_VALUE)
    public String unlimited(@RequestParam(defaultValue = "medium") String difficulty) {
        if (!isValidDifficulty(difficulty)) {        // "if it's NOT a real difficulty..."
            throw badDifficulty(difficulty);         // ...stop here and send HTTP 400
        }
        return PuzzleStore.generateUnlimited(new Random().nextLong(), difficulty.toLowerCase(), wordsByLength);
    }

    // Already done for you: the error sent back for a bad difficulty. HTTP status 400 means "bad request: your fault, not ours"
    static ResponseStatusException badDifficulty(String difficulty) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "difficulty must be easy, medium or hard (got: " + difficulty + ")");
    }
}
