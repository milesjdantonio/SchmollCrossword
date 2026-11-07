package com.crossword;

import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Arrays;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/*
 * The developer's tools (the admin page, admin.html, calls these with the X-Admin-Key header):
 *
 *   GET  /api/health                  {"ok":true}: for the host's health check (no key, nothing private)
 *   GET  /api/admin/status            how the game is doing (HealthReport)
 *   POST /api/admin/daily/disable     { date, kind }: switch a daily off; the next request makes a new one
 *
 * Reports are read at /api/admin/reports (ReportController) and a name is hidden at /api/admin/leaderboard/hide
 * (LeaderboardController).
 */
@RestController
public class AdminController {

    private final String key;
    private final HealthReport health;

    @Autowired
    public AdminController(HealthReport health) {
        this(AdminKey.configured(), health);
    }

    AdminController(String key, HealthReport health) {
        this.key = key;
        this.health = health;
    }

    @GetMapping(value = "/api/health", produces = MediaType.APPLICATION_JSON_VALUE)
    public String healthCheck() {
        return "{\"ok\":true}";
    }

    @GetMapping(value = "/api/admin/status", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> status(@RequestHeader(value = "X-Admin-Key", required = false) String given) {
        AdminKey.require(key, given);
        return health.status(LocalDate.now());
    }

    public record Disable(String date, String kind) {}

    @PostMapping(value = "/api/admin/daily/disable", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> disable(@RequestBody Disable d, @RequestHeader(value = "X-Admin-Key", required = false) String given) throws IOException {
        AdminKey.require(key, given);
        if (d == null || d.kind() == null || !Arrays.asList(DailyMaker.KINDS).contains(d.kind())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "kind must be one of " + String.join(", ", DailyMaker.KINDS));
        }
        LocalDate date;
        try {
            date = LocalDate.parse(d.date());
        } catch (DateTimeParseException | NullPointerException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "date must look like 2026-10-08");
        }
        return Map.of("disabled", PuzzleStore.disableDaily(PuzzleStore.DAILY_FOLDER, date, d.kind()));
    }
}
