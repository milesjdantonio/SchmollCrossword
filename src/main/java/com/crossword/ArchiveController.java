package com.crossword;

import java.io.IOException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/*
 * The Daily Archive: earlier days' dailies, replayed for practice (no points, no streak).
 *
 *   /api/archive/days                         every day in the archive, newest first, with the puzzles it has
 *   /api/archive?date=2026-11-02&difficulty=hard   that day's puzzle
 *
 * It only ever serves a daily that already exists (saved, or shipped with the app): it never makes one, so it can
 * never cost anything. A day joins the archive once it's over everywhere on Earth (the last time zone is 12 hours
 * behind UTC), so nobody can practise a daily that still counts for them. Dailies switched off by a moderator and
 * any with an answer from the family filter (family-words.txt) are left out.
 */
@RestController
public class ArchiveController {

    // the first day with dailies (the shipped ones start here)
    static final LocalDate FIRST_DAY = LocalDate.of(2026, 10, 11);

    // a day's list is only worked out again after this long (a moderator switching one off shows up then)
    static final long CACHE_MS = 10 * 60_000;

    private final Map<LocalDate, List<String>> kindsCache = new ConcurrentHashMap<>();
    private volatile long cacheMadeAt = 0;
    private Set<String> familyWords;

    // A day is over everywhere once it's midnight after it in the last time zone (UTC-12): noon UTC the next day
    static boolean overEverywhere(LocalDate day, Instant now) {
        return !now.isBefore(day.plusDays(1).atTime(12, 0).toInstant(ZoneOffset.UTC));
    }

    @GetMapping(value = "/api/archive/days", produces = MediaType.APPLICATION_JSON_VALUE)
    public String days() throws IOException {
        return daysJson(Instant.now());
    }

    String daysJson(Instant now) throws IOException {
        if (System.currentTimeMillis() - cacheMadeAt > CACHE_MS) { kindsCache.clear(); cacheMadeAt = System.currentTimeMillis(); }
        StringBuilder out = new StringBuilder("{\"days\":[");
        boolean first = true;
        for (LocalDate day = LocalDate.ofInstant(now, ZoneOffset.UTC); !day.isBefore(FIRST_DAY); day = day.minusDays(1)) {
            if (!overEverywhere(day, now)) continue;
            List<String> kinds = kindsCache.get(day);
            if (kinds == null) { kinds = kindsOn(day); kindsCache.put(day, kinds); }
            if (kinds.isEmpty()) continue;
            if (!first) out.append(',');
            first = false;
            out.append("{\"date\":\"").append(day).append("\",\"kinds\":[");
            for (int i = 0; i < kinds.size(); i++) out.append(i == 0 ? "" : ",").append('"').append(kinds.get(i)).append('"');
            out.append("]}");
        }
        return out.append("]}").toString();
    }

    // the day's dailies that the archive can serve, in difficulty order
    List<String> kindsOn(LocalDate day) throws IOException {
        List<String> kinds = new ArrayList<>();
        for (String kind : PuzzleStore.DAILY_KINDS) if (archived(day, kind) != null) kinds.add(kind);
        return kinds;
    }

    @GetMapping(value = "/api/archive", produces = MediaType.APPLICATION_JSON_VALUE)
    public String puzzle(@RequestParam String date, @RequestParam String difficulty) throws IOException {
        return puzzle(date, difficulty, Instant.now());
    }

    String puzzle(String date, String difficulty, Instant now) throws IOException {
        if (!PuzzleController.isValidDifficulty(difficulty)) throw PuzzleController.badDifficulty(difficulty);
        LocalDate day;
        try {
            day = LocalDate.parse(date);
        } catch (java.time.format.DateTimeParseException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "date must look like 2026-10-08");
        }
        if (day.isBefore(FIRST_DAY) || !overEverywhere(day, now)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "that day isn't in the archive");
        }
        String json = archived(day, difficulty.toLowerCase());
        if (json == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "that puzzle isn't in the archive");
        return json;
    }

    // A day's daily if the archive may serve it: saved or shipped (never made), not switched off, no family-filter answer
    String archived(LocalDate day, String kind) throws IOException {
        String file = PuzzleStore.dailyFile(PuzzleStore.DAILY_FOLDER, day, kind).getFileName().toString();
        String json = PuzzleStore.readSaved(PuzzleStore.DAILY_FOLDER.resolve(file));
        if (json == null) json = PuzzleStore.shippedDaily(file);
        if (json == null || PuzzleStore.isDisabled(json)) return null;
        for (String answer : PuzzleStore.answersIn(json)) if (family().contains(answer)) return null;
        return json;
    }

    private synchronized Set<String> family() throws IOException {
        if (familyWords == null) {
            Set<String> upper = new java.util.HashSet<>();
            for (String w : App.loadFamilyWords()) upper.add(w.toUpperCase());
            familyWords = upper;
        }
        return familyWords;
    }
}
