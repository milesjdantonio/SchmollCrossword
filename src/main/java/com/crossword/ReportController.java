package com.crossword;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import jakarta.servlet.http.HttpServletRequest;

/*
 * ===== Reports =====
 *
 * The website's "Report a problem" button sends the puzzle's seed, which clue (if any), what kind of problem it is
 * (a wrong answer, an unclear clue, a typo, something offensive, a technical problem, or something else) and what
 * the player wrote. Each report becomes one line of JSON at the end of reports.jsonl, next to the daily puzzles:
 *
 *   puzzles/reports.jsonl          (on your computer; git ignores the puzzles folder)
 *   $PUZZLE_DIR/reports.jsonl      (online, on the host's disk)
 *
 * To read them: open that file, or online use the admin page (/admin.html) with the ADMIN_KEY the host sets. The key
 * goes in the X-Admin-Key header; without a key set, the reports page doesn't exist.
 * No IP addresses or names are saved, only what the player typed.
 */
@RestController
public class ReportController {

    static final Path REPORTS_FILE = Path.of(System.getenv().getOrDefault("PUZZLE_DIR", "puzzles"), "reports.jsonl");
    static final int MAX_MESSAGE = 1000;          // characters
    static final int MAX_CLUE = 300;

    static final List<String> CATEGORIES = List.of("wrong-answer", "unclear-clue", "typo", "offensive", "technical", "other");

    // What the website sends (Spring turns the JSON body into this record; an older page sends no category)
    public record Report(Long seed, String mode, String difficulty, String clue, String message, String world, String category) {
        Report(Long seed, String mode, String difficulty, String clue, String message, String world) {
            this(seed, mode, difficulty, clue, message, world, null);
        }
    }

    private final Path file;
    private final String key;
    private final RateLimiter limiter = new RateLimiter(10, 1000);   // per person per hour, everyone per day

    public ReportController() {
        this(REPORTS_FILE, AdminKey.configured());
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
        String category = report == null || report.category() == null || report.category().isBlank() ? "other" : report.category();
        if (!CATEGORIES.contains(category)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "unknown kind of problem");
        }
        // a message is needed only when the kind of problem doesn't say enough by itself
        boolean noMessage = report == null || report.message() == null || report.message().isBlank();
        if (report == null || report.seed() == null || (noMessage && category.equals("other"))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "a report needs the puzzle's seed and a message");
        }
        if ((report.message() != null && report.message().length() > MAX_MESSAGE) || (report.clue() != null && report.clue().length() > MAX_CLUE)) {
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
                + ",\"category\":" + Puzzle.quote(category)
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

    // Every report (one JSON object per line), only with the admin key. Without a key set, this page doesn't exist.
    @GetMapping(value = "/api/admin/reports", produces = MediaType.TEXT_PLAIN_VALUE)
    public String reports(@RequestHeader(value = "X-Admin-Key", required = false) String key) throws IOException {
        AdminKey.require(this.key, key);
        return Files.exists(file) ? Files.readString(file, StandardCharsets.UTF_8) : "";
    }

    // How many reports there are (for the status page and the daily email)
    long count() throws IOException {
        if (!Files.exists(file)) return 0;
        try (var lines = Files.lines(file, StandardCharsets.UTF_8)) {
            return lines.filter(l -> !l.isBlank()).count();
        }
    }
}
