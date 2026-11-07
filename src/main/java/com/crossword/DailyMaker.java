package com.crossword;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/*
 * Makes dailies ahead of time, so no player ever waits for Claude to write a puzzle.
 *
 * Every hour it looks at yesterday, today and the next `daysAhead` days and makes whatever is missing: the four
 * dailies (easy, medium, hard, challenge), the Daily Boss's puzzle and the boss's own board. Each one is made
 * once and saved like any daily (PuzzleStore.generateOnce), so a player who asks at the same moment simply
 * shares the result. At most `maxPerRun` are made per run, so a long gap is filled over a few hours instead of
 * in one expensive burst. Off (0 days) unless the host sets MAKE_DAILIES_AHEAD.
 */
@Component
public class DailyMaker {

    private static final Logger LOG = LoggerFactory.getLogger(DailyMaker.class);

    static final String[] KINDS = {"easy", "medium", "hard", "challenge", "boss", "boss-board"};

    // The part that makes one puzzle; the tests hand in a pretend one
    interface Maker {
        void make(LocalDate date, String kind) throws IOException;
    }

    private final Path folder;
    private final int daysAhead;
    private final int maxPerRun;
    private final Maker maker;

    // what the last run did (for the developer dashboard and the daily email)
    volatile Instant lastRun;
    volatile int lastMade, lastFailed;
    volatile String lastError = "";

    @Autowired
    public DailyMaker(PuzzleController puzzles, @Value("${schmoll.dailies.days-ahead}") int daysAhead,
                      @Value("${schmoll.dailies.max-per-run}") int maxPerRun) {
        this(PuzzleStore.DAILY_FOLDER, daysAhead, maxPerRun, (date, kind) -> makeReal(puzzles, date, kind));
    }

    DailyMaker(Path folder, int daysAhead, int maxPerRun, Maker maker) {
        this.folder = folder;
        this.daysAhead = daysAhead;
        this.maxPerRun = maxPerRun;
        this.maker = maker;
    }

    int daysAhead() { return daysAhead; }

    @Scheduled(initialDelayString = "${schmoll.dailies.first-check}", fixedDelayString = "${schmoll.dailies.check-every}")
    public void run() {
        if (daysAhead <= 0) return;
        makeAhead(LocalDate.now());
    }

    // Makes what's missing from yesterday to today + daysAhead (yesterday: players behind the server's time zone
    // are still on it). Returns how many puzzles it made.
    synchronized int makeAhead(LocalDate today) {
        int made = 0, failed = 0;
        String error = "";
        outer:
        for (int d = -1; d <= daysAhead; d++) {
            LocalDate date = today.plusDays(d);
            for (String kind : KINDS) {
                if (made + failed >= maxPerRun) break outer;
                try {
                    if (exists(date, kind)) continue;
                    maker.make(date, kind);
                    made++;
                } catch (Exception e) {
                    failed++;
                    error = date + " " + kind + ": " + e.getMessage();
                    LOG.warn("Couldn't make the {} daily for {} ({})", kind, date, e.getMessage());
                }
            }
        }
        lastRun = Instant.now();
        lastMade = made;
        lastFailed = failed;
        lastError = error;
        if (made > 0 || failed > 0) LOG.info("Dailies made ahead: {} made, {} failed, {} days in stock", made, failed, daysInStock(today));
        return made;
    }

    // How many days from today on have every daily ready
    int daysInStock(LocalDate today) {
        int days = 0;
        try {
            for (int d = 0; d <= 366; d++) {
                LocalDate date = today.plusDays(d);
                for (String kind : KINDS) if (!exists(date, kind)) return days;
                days++;
            }
        } catch (IOException e) {
            LOG.warn("Couldn't count the dailies in stock ({})", e.getMessage());
        }
        return days;
    }

    // True if that daily is saved or shipped with the app
    boolean exists(LocalDate date, String kind) throws IOException {
        Path file = file(date, kind);
        return Files.exists(file) || PuzzleStore.shippedDaily(file.getFileName().toString()) != null;
    }

    Path file(LocalDate date, String kind) {
        if (kind.startsWith("boss")) return PuzzleStore.dailyBossFile(folder, date, kind.equals("boss-board"));
        return PuzzleStore.dailyFile(folder, date, kind);
    }

    // The real thing: the same calls a player's request makes, so the result is exactly the daily they'd get
    private static void makeReal(PuzzleController puzzles, LocalDate date, String kind) throws IOException {
        if (kind.startsWith("boss")) {
            Campaign.Section section = PuzzleStore.dailyBossSection(date);
            Map<Integer, List<String>> words = puzzles.wordsFor(Campaign.bigGrid(section.bossDifficulty()) ? "challenge" : section.bossDifficulty());
            PuzzleStore.getDailyBoss(PuzzleStore.DAILY_FOLDER, date, kind.equals("boss-board"), words);
        } else {
            PuzzleStore.getDaily(PuzzleStore.DAILY_FOLDER, date, kind, puzzles.wordsFor(kind));
        }
    }
}
