package com.crossword;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Random;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import jakarta.servlet.http.HttpServletRequest; // everything about one incoming web request, e.g. who sent it

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

    // Loaded ONCE when the server starts, then reused for every request (loading it per request would be slow).
    // Design pass: one word list per difficulty ("easy" -> common words only, "hard" -> harder words allowed).
    private final Map<String, Map<Integer, List<String>>> wordsByDifficulty;
    private final Map<Integer, List<String>> allWords;   // Hard + Settings "Allow harder words" (Unlimited only)

    // Step 26: limits how many paid unlimited puzzles can be made (see RateLimiter)
    private final RateLimiter unlimitedLimiter;

    // Spring Boot uses this one when the server starts (@Autowired picks it). @Value reads each limit from
    // application.properties, which lets the host override them with environment variables.
    @Autowired
    public PuzzleController(@Value("${schmoll.unlimited.per-person-per-hour}") int perPersonPerHour,
                            @Value("${schmoll.unlimited.everyone-per-day}") int everyonePerDay) throws IOException {
        this(Map.of("easy", App.loadWordsFor("easy"), "medium", App.loadWordsFor("medium"), "hard", App.loadWordsFor("hard")),
             App.loadWordsFor("hard", true), new RateLimiter(perPersonPerHour, everyonePerDay));
    }

    // The tests use this one, handing in word lists they already loaded
    PuzzleController(Map<String, Map<Integer, List<String>>> wordsByDifficulty, Map<Integer, List<String>> allWords,
                     RateLimiter unlimitedLimiter) {
        this.wordsByDifficulty = wordsByDifficulty;
        this.allWords = allWords;
        this.unlimitedLimiter = unlimitedLimiter;
    }

    // The word list for a (valid, lowercase) difficulty
    Map<Integer, List<String>> wordsFor(String difficulty) {
        return wordsByDifficulty.get(difficulty);
    }

    // Step 24's setting, now for Hard only: "Allow harder words" adds the extremely hard words. Unlimited only:
    // the daily never uses it, so the daily stays the same for everyone.
    Map<Integer, List<String>> wordsFor(String difficulty, boolean hardWords) {
        return hardWords && difficulty.equals("hard") ? allWords : wordsFor(difficulty);
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
     *    using PuzzleStore.DAILY_FOLDER, LocalDate.now() and that difficulty's word list.
     */
    @GetMapping(value = "/api/daily", produces = MediaType.APPLICATION_JSON_VALUE)
    public String daily(@RequestParam(defaultValue = "medium") String difficulty) throws IOException {
        if (!isValidDifficulty(difficulty)) {        // "if it's NOT a real difficulty..."
            throw badDifficulty(difficulty);         // ...stop here and send HTTP 400
        }
        String level = difficulty.toLowerCase();
        return PuzzleStore.getDaily(PuzzleStore.DAILY_FOLDER, LocalDate.now(), level, wordsFor(level));
    }

    /*
     * ===== Step 18c: GET /api/unlimited =====
     *
     * 1. Same difficulty check as 18b.
     * 2. Otherwise return PuzzleStore.generateUnlimited(...) with a random seed: new Random().nextLong()
     *    (no seed in the Random = different every time, which is exactly what unlimited mode wants).
     *
     * Every unlimited puzzle is a paid API call, so Step 26 adds a rate limit (HTTP 429 when it's hit).
     */
    @GetMapping(value = "/api/unlimited", produces = MediaType.APPLICATION_JSON_VALUE)
    public String unlimited(@RequestParam(defaultValue = "medium") String difficulty,
                            @RequestParam(defaultValue = "false") boolean hardWords,    // Settings > harder words (Hard only)
                            HttpServletRequest request) {                               // Step 26: who's asking
        if (!isValidDifficulty(difficulty)) {        // "if it's NOT a real difficulty..."
            throw badDifficulty(difficulty);         // ...stop here and send HTTP 400
        }
        // Checked AFTER the difficulty, so a bad request never uses up someone's allowance.
        // getRemoteAddr() is the player's IP address (application.properties makes it see past the host's proxy).
        if (!unlimitedLimiter.allow(request.getRemoteAddr(), System.currentTimeMillis())) {
            throw tooManyPuzzles();
        }
        // JavaScript can only hold whole numbers exactly up to 2^53 (about 9 quadrillion), so keep the
        // seed below that; otherwise the browser would see a rounded, wrong seed in the JSON.
        long seed = new Random().nextLong() & ((1L << 53) - 1);
        return PuzzleStore.generateUnlimited(seed, difficulty.toLowerCase(), wordsFor(difficulty.toLowerCase(), hardWords));
    }

    // Already done for you: the error sent back for a bad difficulty. HTTP status 400 means "bad request: your fault, not ours"
    static ResponseStatusException badDifficulty(String difficulty) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "difficulty must be easy, medium or hard (got: " + difficulty + ")");
    }

    // Step 26: HTTP 429 means "too many requests: slow down". The website shows a friendly message for it.
    static ResponseStatusException tooManyPuzzles() {
        return new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "unlimited puzzle limit reached, try again later");
    }
}
