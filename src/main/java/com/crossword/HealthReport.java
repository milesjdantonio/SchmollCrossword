package com.crossword;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

import org.springframework.stereotype.Component;

/*
 * How the game is doing, for the developer: dailies in stock and the last made-ahead run, what Claude has cost
 * since the server started, how many reports there are, and how many people played. The admin status page shows
 * it as JSON (AdminController) and the daily email as text (DailyEmail). Nothing private is in it: no names,
 * IP addresses or keys.
 */
@Component
public class HealthReport {

    private final DailyMaker maker;
    private final ReportController reports;
    private final LeaderboardController leaderboard;
    private final Instant started = Instant.now();

    public HealthReport(DailyMaker maker, ReportController reports, LeaderboardController leaderboard) {
        this.maker = maker;
        this.reports = reports;
        this.leaderboard = leaderboard;
    }

    Map<String, Object> status(LocalDate today) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("serverDate", today.toString());
        m.put("upMinutes", Duration.between(started, Instant.now()).toMinutes());
        m.put("apiKeySet", ClueWriter.hasApiKey());
        m.put("dataFolderWritable", writable(PuzzleStore.DAILY_FOLDER.toAbsolutePath().getParent()));

        Map<String, Object> dailies = new LinkedHashMap<>();
        dailies.put("makeAheadDays", maker.daysAhead());
        dailies.put("daysInStock", maker.daysInStock(today));
        dailies.put("lastRun", maker.lastRun == null ? null : maker.lastRun.toString());
        dailies.put("lastMade", maker.lastMade);
        dailies.put("lastFailed", maker.lastFailed);
        dailies.put("lastError", maker.lastError);
        m.put("dailies", dailies);

        Map<String, Object> claude = new LinkedHashMap<>();
        claude.put("calls", ClueWriter.CALLS.get());
        claude.put("inputTokens", ClueWriter.INPUT_TOKENS.get());
        claude.put("outputTokens", ClueWriter.OUTPUT_TOKENS.get());
        claude.put("estimatedCostUsd", Math.round(ClueWriter.estimatedCost() * 1000) / 1000.0);
        Map<String, Object> byModel = new LinkedHashMap<>();
        for (Map.Entry<String, AtomicLong[]> e : ClueWriter.USAGE.entrySet()) {
            byModel.put(e.getKey(), Map.of("calls", e.getValue()[0].get(), "inputTokens", e.getValue()[1].get(), "outputTokens", e.getValue()[2].get()));
        }
        claude.put("byModel", byModel);
        m.put("claudeSinceStart", claude);

        try {
            m.put("reports", reports.count());
            m.put("playersToday", leaderboard.standings(today.toString(), null).players());
            m.put("playersYesterday", leaderboard.standings(today.minusDays(1).toString(), null).players());
        } catch (IOException e) {
            m.put("error", "couldn't read reports or the leaderboard: " + e.getMessage());
        }
        return m;
    }

    // Can the app save puzzles, reports and the leaderboard? (Tries a small file; a read-only disk says no.)
    static boolean writable(Path folder) {
        try {
            Files.createDirectories(folder);
            Path probe = Files.createTempFile(folder, ".write-check", ".tmp");
            Files.delete(probe);
            return true;
        } catch (IOException | SecurityException e) {
            return false;
        }
    }

    // The same as plain text, for the email
    String text(LocalDate today) {
        Map<String, Object> s = status(today);
        @SuppressWarnings("unchecked") Map<String, Object> d = (Map<String, Object>) s.get("dailies");
        @SuppressWarnings("unchecked") Map<String, Object> c = (Map<String, Object>) s.get("claudeSinceStart");
        StringBuilder b = new StringBuilder();
        b.append("Schmoll Crossword, ").append(today).append("\n\n");
        b.append("Dailies ready: ").append(d.get("daysInStock")).append(" days ahead (keeping ").append(d.get("makeAheadDays")).append(")\n");
        b.append("Last made-ahead run: ").append(d.get("lastMade")).append(" made, ").append(d.get("lastFailed")).append(" failed");
        if (!String.valueOf(d.get("lastError")).isEmpty()) b.append(" (").append(d.get("lastError")).append(")");
        b.append("\n");
        b.append("Claude since the server started: ").append(c.get("calls")).append(" calls, about $").append(c.get("estimatedCostUsd")).append("\n");
        b.append("API key set: ").append(Boolean.TRUE.equals(s.get("apiKeySet")) ? "yes" : "NO").append("\n");
        b.append("Data folder writable: ").append(Boolean.TRUE.equals(s.get("dataFolderWritable")) ? "yes" : "NO").append("\n");
        b.append("Players: ").append(s.get("playersYesterday")).append(" yesterday, ").append(s.get("playersToday")).append(" so far today\n");
        b.append("Reports (all time): ").append(s.get("reports")).append("\n");
        if (s.containsKey("error")) b.append("Problem: ").append(s.get("error")).append("\n");
        b.append("Server up for ").append(s.get("upMinutes")).append(" minutes\n");
        return b.toString();
    }
}
