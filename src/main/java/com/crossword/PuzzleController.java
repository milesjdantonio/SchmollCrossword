package com.crossword;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/*
 * The puzzle API: the dailies, the campaign and the Daily Boss, as JSON (Puzzle.toJson()).
 *
 *   /api/daily?difficulty=hard&date=2026-10-08   that day's daily for that difficulty
 *   /api/campaign/map, /api/campaign?world=...    the campaign's map and its levels
 *   /api/boss/daily, /api/boss?kind=daily         today's boss and its puzzles
 */
@RestController
public class PuzzleController {

    // Loaded once when the server starts, then reused for every request (loading it per request would be slow).
    // One word list per difficulty ("easy" -> common words only, "hard" -> harder words allowed).
    private final Map<String, Map<Integer, List<String>>> wordsByDifficulty;

    // Spring Boot uses this one when the server starts
    public PuzzleController() throws IOException {
        this(Map.of("easy", App.loadWordsFor("easy"), "medium", App.loadWordsFor("medium"), "hard", App.loadWordsFor("hard"),
                    "challenge", App.loadWordsFor("challenge")));
    }

    // The tests use this one, handing in word lists they already loaded
    PuzzleController(Map<String, Map<Integer, List<String>>> wordsByDifficulty) {
        this.wordsByDifficulty = wordsByDifficulty;
    }

    // The word list for a (valid, lowercase) difficulty
    Map<Integer, List<String>> wordsFor(String difficulty) {
        return wordsByDifficulty.get(difficulty);
    }

    /*
     * The URL can contain anything (?difficulty=banana), so only "easy", "medium", "hard" and "challenge" pass,
     * in any case ("Hard" is fine). Null is false.
     */
    static boolean isValidDifficulty(String difficulty) {
        if (difficulty == null) return false;
        String d = difficulty.toLowerCase();
        return d.equals("easy") || d.equals("medium") || d.equals("hard") || d.equals("challenge");
    }

    /*
     * GET /api/daily: a daily for a difficulty (HTTP 400 for a bad one), made once and then read from its file.
     * Time zones: the browser sends the player's own date, ?date=2026-10-08, so the daily changes at the player's
     * midnight, not the server's. Every place on Earth is within one day of the server's date, so anything further
     * away is refused (nobody can fetch next week's puzzles).
     */
    @GetMapping(value = "/api/daily", produces = MediaType.APPLICATION_JSON_VALUE)
    public String daily(@RequestParam(defaultValue = "medium") String difficulty,
                        @RequestParam(required = false) String date) throws IOException {
        if (!isValidDifficulty(difficulty)) {
            throw badDifficulty(difficulty);
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

    // Campaign mode: GET /api/campaign/map lists the worlds in order with each level's difficulty;
    // GET /api/campaign?world=garden&level=3 gives that level's puzzle (from the shipped pool, else made once).
    // A boss fight (level 5) is a race against a bot with its own puzzle: &boss=true gives the bot's puzzle.
    @GetMapping(value = "/api/campaign/map", produces = MediaType.APPLICATION_JSON_VALUE)
    public String campaignMap() {
        return Campaign.mapJson();
    }

    // phase=2..5: a boss's later puzzles (see Campaign.phases). v = which of the level's puzzles (see Campaign.VARIANTS)
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

    // The Daily Boss.
    // GET /api/boss/daily?date=2026-10-09 -> {"world":"garden"}: which boss is today's
    @GetMapping(value = "/api/boss/daily", produces = MediaType.APPLICATION_JSON_VALUE)
    public String dailyBoss(@RequestParam(required = false) String date) {
        return "{\"world\":\"" + PuzzleStore.dailyBossSection(dailyDate(date, LocalDate.now())).world() + "\"}";
    }
    // GET /api/boss?kind=daily&date=...   today's boss puzzle (the same for everyone, made once)
    // &boss=true: the boss's own board (no clues, so it never costs anything)
    @GetMapping(value = "/api/boss", produces = MediaType.APPLICATION_JSON_VALUE)
    public String bossFight(@RequestParam String kind, @RequestParam(required = false) String date,
                            @RequestParam(defaultValue = "false") boolean boss) throws IOException {
        if (!kind.equals("daily")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "kind must be daily");
        }
        LocalDate day = dailyDate(date, LocalDate.now());
        Campaign.Section section = PuzzleStore.dailyBossSection(day);
        return PuzzleStore.getDailyBoss(PuzzleStore.DAILY_FOLDER, day, boss, wordsFor(Campaign.bigGrid(section.bossDifficulty()) ? "challenge" : section.bossDifficulty()));
    }

    // The error sent back for a bad difficulty. HTTP status 400 means "bad request: your fault, not ours"
    static ResponseStatusException badDifficulty(String difficulty) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "difficulty must be easy, medium, hard or challenge (got: " + difficulty + ")");
    }
}
