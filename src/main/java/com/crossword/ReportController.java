package com.crossword;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.time.Instant;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import jakarta.servlet.http.HttpServletRequest;

/*
 * ===== Reports =====
 *
 * The website's "Report a problem" button sends the puzzle's seed, which clue (if any) and what the player wrote.
 * Each report becomes one line of JSON at the end of reports.jsonl, next to the daily puzzles:
 *
 *   puzzles/reports.jsonl          (on your computer; git ignores the puzzles folder)
 *   $PUZZLE_DIR/reports.jsonl      (online, on the host's disk)
 *
 * To read them: open that file. Online, set the environment variable REPORTS_KEY to a secret word, then visit
 * /api/reports?key=<that word> to see them in the browser. Without REPORTS_KEY that page doesn't exist.
 * No IP addresses or names are saved, only what the player typed.
 */
@RestController
public class ReportController {

    static final Path REPORTS_FILE = Path.of(System.getenv().getOrDefault("PUZZLE_DIR", "puzzles"), "reports.jsonl");
    static final int MAX_MESSAGE = 1000;          // characters
    static final int MAX_CLUE = 300;

    // What the website sends (Spring turns the JSON body into this record)
    public record Report(Long seed, String mode, String difficulty, String clue, String message, String world) {}

    private final Path file;
    private final String key;
    private final RateLimiter limiter = new RateLimiter(10, 1000);   // per person per hour, everyone per day

    public ReportController() {
        this(REPORTS_FILE, System.getenv("REPORTS_KEY"));
    }

    // The tests use this one, with a temporary file and their own key
    ReportController(Path file, String key) {
        this.file = file;
        this.key = key;
    }

    @PostMapping(value = "/api/report", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public String report(@RequestBody Report report, HttpServletRequest request) throws IOException {
        return save(report, request.getRemoteAddr(), System.currentTimeMillis());
    }

    // The part that checks and saves a report (separate so the tests can call it without a web request)
    String save(Report report, String person, long nowMillis) throws IOException {
        if (report == null || report.seed() == null || report.message() == null || report.message().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "a report needs the puzzle's seed and a message");
        }
        if (report.message().length() > MAX_MESSAGE || (report.clue() != null && report.clue().length() > MAX_CLUE)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "that report is too long");
        }
        boolean campaign = "campaign".equals(report.mode());          // campaign levels and boss fights can be reported too
        if (!"daily".equals(report.mode()) && !campaign) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "mode must be daily or campaign");
        }
        if (!PuzzleController.isValidDifficulty(report.difficulty()) && !(campaign && "expert".equalsIgnoreCase(report.difficulty()))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "unknown difficulty");
        }
        if (!limiter.allow(person, nowMillis)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "too many reports, try again later");
        }
        String line = "{\"time\":" + Puzzle.quote(Instant.ofEpochMilli(nowMillis).toString())
                + ",\"seed\":" + report.seed()
                + ",\"mode\":" + Puzzle.quote(report.mode())
                + ",\"difficulty\":" + Puzzle.quote(report.difficulty().toLowerCase())
                + ",\"world\":" + Puzzle.quote(clean(report.world(), 30))
                + ",\"clue\":" + Puzzle.quote(clean(report.clue(), MAX_CLUE))
                + ",\"message\":" + Puzzle.quote(clean(report.message(), MAX_MESSAGE)) + "}\n";
        synchronized (ReportController.class) {        // two reports at once must not mix their lines
            Files.createDirectories(file.toAbsolutePath().getParent());
            Files.writeString(file, line, StandardCharsets.UTF_8, StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        }
        return "{\"saved\":true}";
    }

    // Player text: no control characters (tabs, carriage returns...), trimmed, cut to a maximum length
    static String clean(String text, int max) {
        if (text == null) return "";
        String s = text.replaceAll("[\\p{Cntrl}&&[^\\n]]", " ").trim();
        return s.length() > max ? s.substring(0, max) : s;
    }

    // Read every report, only with the right key (REPORTS_KEY). Without a key set, this page doesn't exist.
    @GetMapping(value = "/api/reports", produces = MediaType.TEXT_PLAIN_VALUE)
    public String reports(@RequestParam(defaultValue = "") String key) throws IOException {
        boolean ok = this.key != null && !this.key.isBlank()
                && MessageDigest.isEqual(this.key.getBytes(StandardCharsets.UTF_8), key.getBytes(StandardCharsets.UTF_8));
        if (!ok) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        return Files.exists(file) ? Files.readString(file, StandardCharsets.UTF_8) : "";
    }
}
