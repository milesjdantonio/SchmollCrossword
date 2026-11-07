package com.crossword;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

// The developer's tools: the key, the status report and switching a daily off. Nothing here calls Claude.
class AdminControllerTest {

    private static final String KEY = "a-long-test-key";
    private final LocalDate day = LocalDate.of(2031, 3, 10);

    @AfterEach
    void putBack() {
        PuzzleStore.disabledFile = PuzzleStore.DISABLED_FILE;
        PuzzleStore.resetForTests();
    }

    private HealthReport health(Path folder) {
        DailyMaker maker = new DailyMaker(folder.resolve("daily"), 2, 10, (date, kind) -> {});
        return new HealthReport(maker, new ReportController(folder.resolve("reports.jsonl"), KEY),
                new LeaderboardController(folder.resolve("leaderboard"), KEY));
    }

    @Test
    void theKeyHasToMatch() {
        assertTrue(AdminKey.matches(KEY, KEY));
        assertTrue(AdminKey.matches(KEY, " " + KEY + " "));
        assertFalse(AdminKey.matches(KEY, "a-long-test-kez"));
        assertFalse(AdminKey.matches(KEY, null));
        assertFalse(AdminKey.matches(null, KEY), "no key set: nobody gets in");
        assertFalse(AdminKey.matches("", ""));
    }

    @Test
    void withoutTheKeyTheAdminPagesDontExist(@TempDir Path folder) {
        AdminController admin = new AdminController(KEY, health(folder));
        ResponseStatusException e = assertThrows(ResponseStatusException.class, () -> admin.status("wrong"));
        assertEquals(HttpStatus.NOT_FOUND, e.getStatusCode());
        assertThrows(ResponseStatusException.class, () -> admin.status(null));
        assertThrows(ResponseStatusException.class, () -> new AdminController(null, health(folder)).status(KEY));
        assertThrows(ResponseStatusException.class, () -> admin.disable(new AdminController.Disable("2031-03-10", "easy"), null));
        assertEquals("{\"ok\":true}", admin.healthCheck(), "the health check needs no key");
    }

    @Test
    void theStatusSaysWhatsGoingOnWithoutAnythingPrivate(@TempDir Path folder) throws IOException {
        AdminController admin = new AdminController(KEY, health(folder));
        Map<String, Object> s = admin.status(KEY);
        assertTrue(s.containsKey("dailies"));
        assertTrue(s.containsKey("claudeSinceStart"));
        assertEquals(0L, s.get("reports"));
        assertEquals(0, s.get("playersToday"));
        String text = health(folder).text(day);
        assertTrue(text.contains("Dailies ready"), text);
        assertTrue(text.contains("API key set"), text);
        assertFalse(text.contains(KEY), "never the admin key");
    }

    @Test
    void aBadDisableRequestIsRefused(@TempDir Path folder) {
        AdminController admin = new AdminController(KEY, health(folder));
        assertThrows(ResponseStatusException.class, () -> admin.disable(new AdminController.Disable("2031-03-10", "unlimited"), KEY));
        assertThrows(ResponseStatusException.class, () -> admin.disable(new AdminController.Disable("tomorrow", "easy"), KEY));
        assertThrows(ResponseStatusException.class, () -> admin.disable(new AdminController.Disable(null, "easy"), KEY));
    }

    @Test
    void aSwitchedOffDailyIsMovedAsideAndMadeAgain(@TempDir Path folder) throws IOException {
        PuzzleStore.disabledFile = folder.resolve("disabled.txt");
        PuzzleStore.resetForTests();
        Path daily = folder.resolve("daily");
        Path file = PuzzleStore.dailyFile(daily, day, "easy");
        PuzzleStore.save(file, PuzzleStoreTest.PUZZLE);

        assertTrue(PuzzleStore.disableDaily(daily, day, "easy"));
        assertFalse(Files.exists(file), "the bad one is moved aside");
        assertTrue(Files.exists(file.resolveSibling(file.getFileName() + ".disabled")));
        assertTrue(Files.readString(PuzzleStore.disabledFile).contains(file.getFileName().toString()));
        assertTrue(PuzzleStore.isDisabled(PuzzleStoreTest.PUZZLE));
        assertFalse(PuzzleStore.disableDaily(daily, day, "medium"), "nothing to switch off");

        List<String> made = new ArrayList<>();
        DailyMaker maker = new DailyMaker(daily, 0, 100, (date, kind) -> made.add(date + " " + kind));
        maker.makeAhead(day);
        assertTrue(made.contains(day + " easy"), "the made-ahead job makes a new one");
    }

    @Test
    void aSwitchedOffShippedDailyIsSkipped(@TempDir Path folder) throws IOException {
        LocalDate shippedDay = LocalDate.of(2026, 11, 8);     // one of the dailies shipped with the app
        if (PuzzleStore.shippedDaily(shippedDay + "-easy.json") == null) return;
        PuzzleStore.disabledFile = folder.resolve("disabled.txt");
        PuzzleStore.resetForTests();
        DailyMaker maker = new DailyMaker(folder.resolve("daily"), 0, 100, (date, kind) -> {});
        assertTrue(maker.exists(shippedDay, "easy"));
        assertTrue(PuzzleStore.disableDaily(folder.resolve("daily"), shippedDay, "easy"));
        assertFalse(maker.exists(shippedDay, "easy"), "a switched-off shipped daily counts as missing");
        assertNotEquals("", Files.readString(PuzzleStore.disabledFile));
    }
}
