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

import jakarta.servlet.http.HttpServletRequest;

/*
 * The puzzle API: the dailies, Unlimited, the campaign and the boss fights, as JSON (Puzzle.toJson()).
 *
 *   /api/daily?difficulty=hard      today's daily for that difficulty
 *   /api/unlimited?difficulty=easy  a new puzzle (rate-limited: each one is a paid Claude call)
 */
@RestController
public class PuzzleController {

    // Loaded ONCE when the server starts, then reused for every request (loading it per request would be slow).
    // One word list per difficulty ("easy" -> common words only, "hard" -> harder words allowed).
    private final Map<String, Map<Integer, List<String>>> wordsByDifficulty;
    private final Map<Integer, List<String>> allWords;   // Hard + Settings "Allow harder words" (Unlimited only)

    // Limits how many paid unlimited puzzles can be made (see RateLimiter)
    private final RateLimiter unlimitedLimiter;
    // The Unlimited Boss's own board is free (no clues), but making a grid takes the solver up to half a second, and
    // the solver is shared (PuzzleStore.buildGrid is synchronized), so a flood of them would hold up everyone's
    // dailies. One a fight is all the website asks for; 60 an hour per person is far more than anyone plays.
    private final RateLimiter boardLimiter = new RateLimiter(60, RateLimiter.HOUR, 100_000);

    // Spring Boot uses this one when the server starts (@Autowired picks it). @Value reads each limit from
    // application.properties, which lets the host override them with environment variables.
    @Autowired
    public PuzzleController(@Value("${schmoll.unlimited.per-person-per-day}") int perPersonPerDay,
                            @Value("${schmoll.unlimited.everyone-per-day}") int everyonePerDay) throws IOException {
        this(Map.of("easy", App.loadWordsFor("easy"), "medium", App.loadWordsFor("medium"), "hard", App.loadWordsFor("hard"),
                    "challenge", App.loadWordsFor("challenge")),
             App.loadWordsFor("hard", true), new RateLimiter(perPersonPerDay, RateLimiter.DAY, everyonePerDay));
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

    // The "Allow harder words" setting (Hard only) adds the extremely hard words. Unlimited only:
    // the daily never uses it, so the daily stays the same for everyone.
    Map<Integer, List<String>> wordsFor(String difficulty, boolean hardWords) {
        return hardWords && difficulty.equals("hard") ? allWords : wordsFor(difficulty);
    }

    /*
     * The URL can contain anything (?difficulty=banana), so only "easy", "medium", "hard" and "challenge" pass,
     * in any case ("Hard" is fine). Null is false.
     */
    static boolean isValidDifficulty(String difficulty) {
        if (difficulty == null) return false;
        if (difficulty.toLowerCase().equals("easy")) return true;
        if (difficulty.toLowerCase().equals("medium")) return true;
        if (difficulty.toLowerCase().equals("hard")) return true;
        if (difficulty.toLowerCase().equals("challenge")) return true;   // Challenge mode: a bigger 7x7 grid
        return false;
    }

    /*
     * GET /api/daily: today's daily for a difficulty (HTTP 400 for a bad one), made once and then read from its file.
     */
    // Time zones: the browser sends the player's own date, ?date=2026-10-08,
    // so the daily changes at the player's midnight, not the server's. Every place on Earth is within one day of
    // the server's date, so anything further away is refused (nobody can fetch next week's puzzles).
    @GetMapping(value = "/api/daily", produces = MediaType.APPLICATION_JSON_VALUE)
    public String daily(@RequestParam(defaultValue = "medium") String difficulty,
                        @RequestParam(required = false) String date) throws IOException {
        if (!isValidDifficulty(difficulty)) {        // "if it's NOT a real difficulty..."
            throw badDifficulty(difficulty);         // ...stop here and send HTTP 400
        }
        String level = difficulty.toLowerCase();
        return PuzzleStore.getDaily(PuzzleStore.DAILY_FOLDER, dailyDate(date, LocalDate.now()), level, wordsFor(level));
    }

    // The same, for the server's own date (used by the tests)
    public String daily(String difficulty) throws IOException {
        return daily(difficulty, null);
    }

    // Which day's puzzle to serve: the player's date if it's within a day of the server's, else HTTP 400
    static LocalDate dailyDate(String date, LocalDate serverToday) {
        if (date == null || date.isBlank()) return serverToday;
        LocalDate asked;
        try {
            asked = LocalDate.parse(date);           // "2026-10-08"
        } catch (java.time.format.DateTimeParseException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "date must look like 2026-10-08");
        }
        if (Math.abs(asked.toEpochDay() - serverToday.toEpochDay()) > 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "date must be today (in some time zone)");
        }
        return asked;
    }

    /*
     * GET /api/unlimited: a new puzzle with a random seed. Every one is a paid API call, so it's rate-limited
     * (HTTP 429 when the limit is hit).
     */
    @GetMapping(value = "/api/unlimited", produces = MediaType.APPLICATION_JSON_VALUE)
    public String unlimited(@RequestParam(defaultValue = "medium") String difficulty,
                            @RequestParam(defaultValue = "false") boolean hardWords,    // Settings > harder words (Hard only)
                            HttpServletRequest request) {                               // who's asking
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

    // How many Unlimited puzzles this player has left today: {"left":7,"limit":10,"nextInSeconds":0}
    // nextInSeconds = when they're out, how long until they get one back.
    @GetMapping(value = "/api/unlimited/left", produces = MediaType.APPLICATION_JSON_VALUE)
    public String unlimitedLeft(HttpServletRequest request) {
        long now = System.currentTimeMillis();
        String person = request.getRemoteAddr();
        return "{\"left\":" + unlimitedLimiter.remaining(person, now) + ",\"limit\":" + unlimitedLimiter.limit()
                + ",\"nextInSeconds\":" + unlimitedLimiter.secondsUntilNext(person, now) + "}";
    }

    // Campaign mode: GET /api/campaign/map lists the worlds in order with each level's difficulty;
    // GET /api/campaign?world=garden&level=3 gives that level's puzzle (made once, then read from its file).
    // A boss fight (level 5) is a race against a bot with its own puzzle: &boss=true gives the bot's puzzle.
    @GetMapping(value = "/api/campaign/map", produces = MediaType.APPLICATION_JSON_VALUE)
    public String campaignMap() {
        return Campaign.mapJson();
    }

    // phase=2..5: a boss's later puzzles (see Campaign.phases). v = which try this is (a reroll after losing, see Campaign.VARIANTS)
    @GetMapping(value = "/api/campaign", produces = MediaType.APPLICATION_JSON_VALUE)
    public String campaign(@RequestParam String world, @RequestParam int level, @RequestParam(defaultValue = "false") boolean boss,
                           @RequestParam(defaultValue = "1") int phase, @RequestParam(defaultValue = "0") int v) throws IOException {
        Campaign.Section section = Campaign.section(world);
        if (section == null || !Campaign.hasLevel(section, level) || (boss && level != Campaign.LEVELS)
                || phase < 1 || phase > Campaign.phases(section) || (phase > 1 && (level != Campaign.LEVELS || boss)) || v < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "no such campaign level: " + world + " " + level);
        }
        int variant = v % Campaign.VARIANTS;
        if (phase > 1) {
            return PuzzleStore.getBossPhase(PuzzleStore.CAMPAIGN_FOLDER, section, phase, variant, wordsFor("challenge"));
        }
        String difficulty = Campaign.difficulty(section, level);
        // big grids use Hard's list (Challenge grids start with Medium's words, see PuzzleStore.generateBig)
        return PuzzleStore.getCampaign(PuzzleStore.CAMPAIGN_FOLDER, section, level, boss, variant, wordsFor(Campaign.bigGrid(difficulty) ? "challenge" : difficulty));
    }
    public String campaign(String world, int level, boolean boss) throws IOException {
        return campaign(world, level, boss, 1, 0);
    }
    public String campaign(String world, int level, boolean boss, int phase) throws IOException {
        return campaign(world, level, boss, phase, 0);
    }

    // Daily Boss / Unlimited Boss.
    // GET /api/boss/daily?date=2026-10-09 -> {"world":"garden"}: which boss is today's
    @GetMapping(value = "/api/boss/daily", produces = MediaType.APPLICATION_JSON_VALUE)
    public String dailyBoss(@RequestParam(required = false) String date) {
        return "{\"world\":\"" + PuzzleStore.dailyBossSection(dailyDate(date, LocalDate.now())).world() + "\"}";
    }
    // GET /api/boss?kind=daily&date=...      today's boss puzzle (the same for everyone, made once)
    // GET /api/boss?kind=unlimited&world=sky a new puzzle against that boss (paid: counts against the Unlimited limit)
    // &boss=true: the boss's own board (no clues, so it never costs anything)
    @GetMapping(value = "/api/boss", produces = MediaType.APPLICATION_JSON_VALUE)
    public String bossFight(@RequestParam String kind, @RequestParam(required = false) String date, @RequestParam(required = false) String world,
                            @RequestParam(defaultValue = "false") boolean boss, HttpServletRequest request) throws IOException {
        if (kind.equals("daily")) {
            LocalDate day = dailyDate(date, LocalDate.now());
            Campaign.Section section = PuzzleStore.dailyBossSection(day);
            return PuzzleStore.getDailyBoss(PuzzleStore.DAILY_FOLDER, day, boss, wordsFor(Campaign.bigGrid(section.bossDifficulty()) ? "challenge" : section.bossDifficulty()));
        }
        Campaign.Section section = world == null ? null : Campaign.section(world);
        if (!kind.equals("unlimited") || section == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "kind must be daily or unlimited, with a real world for unlimited");
        }
        long seed = new Random().nextLong() & ((1L << 53) - 1);
        Map<Integer, List<String>> words = wordsFor(Campaign.bigGrid(section.bossDifficulty()) ? "challenge" : section.bossDifficulty());
        if (boss) {                                                                  // free: no clues
            if (!boardLimiter.allow(request.getRemoteAddr(), System.currentTimeMillis())) throw tooManyPuzzles();
            return PuzzleStore.bossPuzzle(seed, section, words, false);
        }
        if (!unlimitedLimiter.allow(request.getRemoteAddr(), System.currentTimeMillis())) {
            throw tooManyPuzzles();
        }
        return PuzzleStore.bossPuzzle(seed, section, words, true);
    }

    // Already done for you: the error sent back for a bad difficulty. HTTP status 400 means "bad request: your fault, not ours"
    static ResponseStatusException badDifficulty(String difficulty) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "difficulty must be easy, medium, hard or challenge (got: " + difficulty + ")");
    }

    // HTTP 429 means "too many requests: slow down". The website shows a friendly message for it.
    static ResponseStatusException tooManyPuzzles() {
        return new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "unlimited puzzle limit reached, try again later");
    }
}
