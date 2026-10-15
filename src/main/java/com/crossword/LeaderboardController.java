package com.crossword;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import jakarta.servlet.http.HttpServletRequest;

/*
 * ===== The World Leaderboard =====
 *
 * Every day's dailies (Easy, Medium, Hard, Challenge and the Daily Boss) can be posted to a leaderboard for that
 * day, under a first name and a last-name initial ("Miles D."). A player's points for the day are added up across
 * the dailies they posted, and the board ranks everyone by that total.
 *
 *   POST /api/leaderboard   { player, first, initial, date, difficulty, seconds, checked, revealed, stars, attempts }
 *   GET  /api/leaderboard?date=2026-10-09&player=...   -> the top 50, how many played, and your own place
 *
 * Safety (nothing a player types can ever run as code):
 *   - the name is only letters, with an apostrophe or hyphen inside ("O'Neil", "Anne-Marie"), at most 12, plus
 *     ONE letter for the initial; anything else is refused. Names containing a blocked word are refused too.
 *   - the server works the points out itself from the time, Checks, Reveals and stars (the same formula as
 *     score.js); a "points" number sent by the browser is never trusted
 *   - one entry per player, daily and day (the first one counts, like the dailies themselves); the Daily Boss keeps
 *     your BEST score of the day, since every attempt is scored (a rematch can improve it)
 *   - "player" is a random id the browser makes once; it's never shown to anyone
 *   - a rate limit per person, and the website shows names with textContent only (never as HTML)
 *
 * Saved as one tab-separated line per entry in $PUZZLE_DIR/leaderboard/<date>.tsv (puzzles/ on your computer).
 * Tabs are safe there because names can only contain letters, ' and -.
 */
@RestController
public class LeaderboardController {

    static final Path FOLDER = Path.of(System.getenv().getOrDefault("PUZZLE_DIR", "puzzles"), "leaderboard");
    static final int TOP = 50;
    static final List<String> DAILIES = List.of("easy", "medium", "hard", "challenge", "boss");
    static final Pattern FIRST = Pattern.compile("^\\p{L}(?:[\\p{L}]|['\\-](?=\\p{L})){0,11}$");
    static final Pattern INITIAL = Pattern.compile("^\\p{L}$");
    static final Pattern PLAYER = Pattern.compile("^[a-zA-Z0-9-]{16,64}$");

    // What the website sends (Spring turns the JSON body into this record; unknown fields are ignored)
    public record Entry(String player, String first, String initial, String date, String difficulty,
                        Integer seconds, Integer checked, Integer revealed, Integer stars, Integer attempts) {}
    // What the board shows: no ids, just names and points
    public record Row(int rank, String name, int points, List<String> dailies) {}
    public record Board(String date, int players, List<Row> top, Row you) {}

    private final Path folder;
    private final RateLimiter limiter = new RateLimiter(20, 3_600_000L, 100_000);   // per person per hour, everyone per day
    private final Map<String, List<String[]>> days = new HashMap<>();               // date -> its lines
    private final Map<String, Long> stamps = new HashMap<>();                       // date -> when its file last changed
    private Set<String> blocked;

    public LeaderboardController() {
        this(FOLDER);
    }

    // The tests use this one, with a temporary folder
    LeaderboardController(Path folder) {
        this.folder = folder;
    }

    @PostMapping(value = "/api/leaderboard", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public Board post(@RequestBody Entry entry, HttpServletRequest request) throws IOException {
        return post(entry, request.getRemoteAddr(), LocalDate.now(), System.currentTimeMillis());
    }

    @GetMapping(value = "/api/leaderboard", produces = MediaType.APPLICATION_JSON_VALUE)
    public Board board(@RequestParam(required = false) String date, @RequestParam(required = false) String player) throws IOException {
        LocalDate day = PuzzleController.dailyDate(date, LocalDate.now());
        String id = player != null && PLAYER.matcher(player).matches() ? player : null;
        return standings(day.toString(), id);
    }

    // "Remove My Name" (the privacy review, 2026-10-11): every line this player posted, on every day, is deleted.
    // Only the browser that posted knows its random player id, so knowing it is what proves it's you.
    public record Forget(String player) {}
    @PostMapping(value = "/api/leaderboard/forget", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Integer> forget(@RequestBody Forget f, HttpServletRequest request) throws IOException {
        return Map.of("removed", forget(f == null ? null : f.player(), request.getRemoteAddr(), System.currentTimeMillis()));
    }
    synchronized int forget(String player, String person, long nowMillis) throws IOException {
        if (player == null || !PLAYER.matcher(player).matches()) throw bad("bad player id");
        if (!limiter.allow(person, nowMillis)) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "too many requests, try again later");
        if (!Files.isDirectory(folder)) return 0;
        int removed = 0;
        List<Path> files;
        try (var list = Files.list(folder)) { files = list.filter(f -> f.getFileName().toString().endsWith(".tsv")).toList(); }
        for (Path f : files) {
            List<String> all = Files.readAllLines(f, StandardCharsets.UTF_8);
            List<String> keep = all.stream().filter(l -> { String[] c = l.split("\t", -1); return c.length < 2 || !c[1].equals(player); }).toList();
            if (keep.size() == all.size()) continue;
            removed += all.size() - keep.size();
            Files.writeString(f, keep.isEmpty() ? "" : String.join("\n", keep) + "\n", StandardCharsets.UTF_8);
            days.remove(f.getFileName().toString().replace(".tsv", ""));
        }
        return removed;
    }

    // Check an entry, work out its points, and save it (separate so the tests can call it without a web request)
    synchronized Board post(Entry e, String person, LocalDate serverToday, long nowMillis) throws IOException {
        if (e == null) throw bad("missing entry");
        if (e.player() == null || !PLAYER.matcher(e.player()).matches()) throw bad("bad player id");
        String first = cleanFirst(e.first()), initial = cleanInitial(e.initial());
        if (isBlocked(first, initial)) throw bad("Please pick a different name.");
        LocalDate day = PuzzleController.dailyDate(e.date(), serverToday);
        String difficulty = e.difficulty() == null ? "" : e.difficulty().toLowerCase(Locale.ROOT);
        if (!DAILIES.contains(difficulty)) throw bad("unknown daily");
        int seconds = range(e.seconds(), 1, 86_400, "seconds");
        int checked = range(e.checked(), 0, 400, "checked");
        int revealed = range(e.revealed(), 0, 400, "revealed");
        int stars = difficulty.equals("boss") ? range(e.stars(), 1, 3, "stars") : 0;
        int attempts = difficulty.equals("boss") && e.attempts() != null ? range(e.attempts(), 1, 99, "attempts") : 1;
        if (!limiter.allow(person, nowMillis)) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "too many posts, try again later");

        List<String[]> lines = lines(day.toString());
        int points = points(difficulty, seconds, checked, revealed, stars, attempts);
        int best = lines.stream().filter(l -> l[1].equals(e.player()) && l[4].equals(difficulty)).mapToInt(l -> Integer.parseInt(l[5])).max().orElse(-1);
        boolean already = best >= 0 && !(difficulty.equals("boss") && points > best);
        if (!already) {
            String[] line = { Long.toString(nowMillis), e.player(), first, initial, difficulty, Integer.toString(points), Integer.toString(seconds) };
            Files.createDirectories(folder);
            Files.writeString(folder.resolve(day + ".tsv"), String.join("\t", line) + "\n", StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE, StandardOpenOption.APPEND);
            days.remove(day.toString());                   // read back from the file next time (it just changed)
        }
        return standings(day.toString(), e.player());
    }

    // The day's board: each player's dailies added up, best first (ties: whoever posted first)
    synchronized Board standings(String date, String player) throws IOException {
        Map<String, int[]> total = new LinkedHashMap<>();          // player -> { points, first post order }
        Map<String, String> names = new HashMap<>();
        Map<String, List<String>> done = new HashMap<>();
        int order = 0;
        Map<String, Integer> bestOf = new HashMap<>();              // player + daily -> its best points (the boss can be posted again)
        for (String[] l : lines(date)) {
            int[] t = total.computeIfAbsent(l[1], k -> new int[2]);
            if (t[0] == 0 && !done.containsKey(l[1])) t[1] = order++;
            String k = l[1] + "\t" + l[4];
            int p = Integer.parseInt(l[5]), was = bestOf.getOrDefault(k, -1);
            if (p > was) { t[0] += p - Math.max(0, was); bestOf.put(k, p); }
            names.put(l[1], l[2] + " " + l[3] + ".");              // the latest name a player used
            if (was < 0) done.computeIfAbsent(l[1], k2 -> new ArrayList<>()).add(l[4]);
        }
        List<String> ranked = new ArrayList<>(total.keySet());
        ranked.sort((a, b) -> total.get(b)[0] != total.get(a)[0] ? total.get(b)[0] - total.get(a)[0] : total.get(a)[1] - total.get(b)[1]);
        List<Row> top = new ArrayList<>();
        Row you = null;
        for (int i = 0; i < ranked.size(); i++) {
            String id = ranked.get(i);
            List<String> dailies = DAILIES.stream().filter(done.get(id)::contains).toList();
            Row row = new Row(i + 1, names.get(id), total.get(id)[0], dailies);
            if (i < TOP) top.add(row);
            if (id.equals(player)) you = row;
        }
        return new Board(date, ranked.size(), top, you);
    }

    // Points, worked out here (the same formula as score.js: the browser's own number is never trusted)
    static int points(String difficulty, int seconds, int checked, int revealed, int stars) {
        return points(difficulty, seconds, checked, revealed, stars, 1);
    }
    // (the Daily Boss: every lost attempt before the win costs 40)
    static int points(String difficulty, int seconds, int checked, int revealed, int stars, int attempts) {
        int penalties = checked * 5 + revealed * 10;
        if (difficulty.equals("boss")) return Math.max(0, 250 + 50 * stars - penalties - 50 * (attempts - 1));
        int base = switch (difficulty) { case "easy" -> 100; case "medium" -> 150; case "hard" -> 200; default -> 300; };
        int speedStart = difficulty.equals("challenge") ? 200 : 100;
        int speed = Math.max(0, speedStart - (seconds / 60) * 10);
        return Math.max(0, base + speed - penalties);
    }

    // "miles" -> "Miles"; refused unless it's letters (with ' or - between letters), 1 to 12 of them
    static String cleanFirst(String first) {
        String s = first == null ? "" : first.strip();
        if (!FIRST.matcher(s).matches()) throw bad("Your first name can only have letters (up to 12).");
        return s.substring(0, 1).toUpperCase(Locale.ROOT) + s.substring(1);
    }
    static String cleanInitial(String initial) {
        String s = initial == null ? "" : initial.strip().replace(".", "");
        if (!INITIAL.matcher(s).matches()) throw bad("The initial is one letter.");
        return s.toUpperCase(Locale.ROOT);
    }
    // A name made of an offensive word (the game's blocklist) is refused, and so is one with a longer offensive word
    // inside it. Short words only count on their own, so real names that happen to contain them still work
    // (Cassie, Dickens); a few explicit ones are refused anywhere.
    static final Set<String> ALWAYS = Set.of("fuck", "shit", "cunt", "slut");
    boolean isBlocked(String first, String initial) throws IOException {
        if (blocked == null) blocked = App.loadBlockedWords();
        String f = first.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}]", ""), whole = f + initial.toLowerCase(Locale.ROOT);
        return blocked.stream().map(w -> w.toLowerCase(Locale.ROOT)).anyMatch(w ->
                f.equals(w) || whole.equals(w) || (w.length() >= 5 && whole.contains(w)) || (ALWAYS.contains(w) && whole.contains(w)));
    }

    // A day's lines, read again whenever its file changes (so deleting a line by hand, to remove a name, works at once)
    private List<String[]> lines(String date) throws IOException {
        Path file = folder.resolve(date + ".tsv");
        long stamp = Files.exists(file) ? Files.getLastModifiedTime(file).toMillis() * 31 + Files.size(file) : -1;
        List<String[]> list = days.get(date);
        if (list != null && stamps.getOrDefault(date, -2L) == stamp) return list;
        list = new ArrayList<>();
        if (Files.exists(file)) {
            for (String line : Files.readAllLines(file, StandardCharsets.UTF_8)) {
                String[] parts = line.split("\t");
                if (parts.length == 7) list.add(parts);
            }
        }
        if (days.size() > 7) { days.clear(); stamps.clear(); }      // keep only a few days in memory
        days.put(date, list);
        stamps.put(date, stamp);
        return list;
    }

    // A refused entry answers with its reason, so the website can say what to fix (only this controller's own
    // messages: nothing else from the server is ever shown)
    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<Map<String, String>> refused(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode()).body(Map.of("message", e.getReason() == null ? "" : e.getReason()));
    }

    private static int range(Integer value, int min, int max, String what) {
        if (value == null || value < min || value > max) throw bad(what + " out of range");
        return value;
    }
    private static ResponseStatusException bad(String why) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, why);
    }
}
