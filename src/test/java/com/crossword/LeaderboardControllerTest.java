package com.crossword;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.server.ResponseStatusException;

// The World Leaderboard: names are checked, points are worked out by the server, one entry per daily, ranked totals
class LeaderboardControllerTest {

    @TempDir
    Path folder;

    static final LocalDate DAY = LocalDate.of(2026, 10, 9);
    static final String A = "aaaaaaaa-1111-2222-3333-444444444444", B = "bbbbbbbb-1111-2222-3333-444444444444";

    static LeaderboardController.Entry entry(String player, String first, String initial, String difficulty, int seconds, int checked, int revealed, Integer stars) {
        return new LeaderboardController.Entry(player, first, initial, "2026-10-09", difficulty, seconds, checked, revealed, stars, null);
    }
    // a leaderboard whose dailies are all 5x5 with 21 white squares (Challenge 7x7 with 40), whatever is on disk
    static LeaderboardController make(Path folder) {
        LeaderboardController lb = new LeaderboardController(folder);
        lb.shapes = (day, kind) -> kind.equals("challenge") ? new int[] { 7, 40 } : new int[] { 5, 21 };
        return lb;
    }
    // the same entry with a start ticket from long ago, so its time counts
    static LeaderboardController.Entry timed(LeaderboardController lb, LeaderboardController.Entry e) {
        String t = lb.ticket(new LeaderboardController.Start(e.date(), e.difficulty()), "ticket", DAY, -10_000_000L);
        return new LeaderboardController.Entry(e.player(), e.first(), e.initial(), e.date(), e.difficulty(), e.seconds(), e.checked(), e.revealed(), e.stars(), e.attempts(), t);
    }

    @Test
    void aPlayerCanRemoveTheirName() throws Exception {
        LeaderboardController lb = make(folder);
        lb.post(entry(A, "Miles", "D", "easy", 90, 0, 0, null), "1.1.1.1", DAY, 0);
        lb.post(entry(A, "Miles", "D", "hard", 90, 0, 0, null), "1.1.1.1", DAY, 1);
        lb.post(entry(B, "Ann", "B", "easy", 90, 0, 0, null), "2.2.2.2", DAY, 2);
        assertEquals(2, lb.forget(A, "1.1.1.1", 3));
        var board = lb.standings("2026-10-09", A);
        assertEquals(1, board.players());
        assertEquals("Ann B.", board.top().get(0).name());
        assertEquals(null, board.you());
        assertEquals(0, lb.forget(A, "1.1.1.1", 4));                      // nothing left to remove
        assertThrows(ResponseStatusException.class, () -> lb.forget("short", "1.1.1.1", 5));
    }

    @Test
    void namesAreOnlyLetters() {
        assertEquals("Miles", LeaderboardController.cleanFirst("miles"));
        assertEquals("O'neil", LeaderboardController.cleanFirst(" o'neil "));
        assertEquals("Anne-Marie", LeaderboardController.cleanFirst("Anne-Marie"));
        assertEquals("José", LeaderboardController.cleanFirst("José"));
        assertEquals("D", LeaderboardController.cleanInitial("d."));
        assertEquals("", LeaderboardController.cleanInitial(""), "the initial is optional");
        assertEquals("", LeaderboardController.cleanInitial(" "));
        assertEquals("", LeaderboardController.cleanInitial(null));
        for (String bad : List.of("", "<script>", "<b>x</b>", "Miles1", "Mi les", "'quote", "dash-", "a\"b", "abcdefghijklm", "x;y", "&amp;")) {
            assertThrows(ResponseStatusException.class, () -> LeaderboardController.cleanFirst(bad), bad);
        }
        for (String bad : List.of("DD", "1", "<", "x y")) {
            assertThrows(ResponseStatusException.class, () -> LeaderboardController.cleanInitial(bad), bad);
        }
        assertEquals("Miles D.", LeaderboardController.displayName("Miles", "D"));
        assertEquals("Miles", LeaderboardController.displayName("Miles", ""));
    }

    // Hate figures, family-list words and look-alike spellings are refused; real names still work
    @Test
    void theNameFilterSeesThroughAccentsAndLookAlikes() throws Exception {
        LeaderboardController lb = make(folder);
        for (String bad : List.of("Hitler", "Hítlér", "Nаzi", "Moron", "Sexy")) {   // (an accented i and e; a Cyrillic a)
            assertTrue(lb.isBlocked(LeaderboardController.cleanFirst(bad), ""), bad);
        }
        for (String fine : List.of("Annalise", "Peter", "Nazira", "Cassie")) {
            assertFalse(lb.isBlocked(LeaderboardController.cleanFirst(fine), ""), fine);
        }
        assertEquals("hitler", LeaderboardController.plain("Hítlér"));
    }

    // Moderation needs the admin key and takes one name off one day's board
    @Test
    void anAdminCanHideAName() throws Exception {
        LeaderboardController lb = new LeaderboardController(folder, "s3cret-key");
        lb.post(entry(A, "Ann", "B", "easy", 90, 0, 0, null), "1.1.1.1", DAY, 0);
        lb.post(entry(B, "Bea", "", "easy", 90, 0, 0, null), "1.1.1.2", DAY, 1);
        assertThrows(ResponseStatusException.class, () -> lb.hide(new LeaderboardController.Hide("2026-10-09", "Ann B."), "wrong"));
        assertEquals(java.util.Map.of("removed", 1), lb.hide(new LeaderboardController.Hide("2026-10-09", "Ann B."), "s3cret-key"));
        var board = lb.standings("2026-10-09", null);
        assertEquals(1, board.players());
        assertEquals("Bea", board.top().get(0).name(), "no initial: just the name");
    }

    // A day's board is deleted once it's older than KEEP_DAYS
    @Test
    void oldDaysAreDeleted() throws Exception {
        LeaderboardController lb = make(folder);
        lb.post(entry(A, "Ann", "B", "easy", 90, 0, 0, null), "1.1.1.1", DAY, 0);
        assertEquals(0, lb.deleteDaysBefore(DAY));
        assertEquals(1, lb.deleteDaysBefore(DAY.plusDays(1)));
        assertEquals(0, lb.standings("2026-10-09", null).players());
    }

    @Test
    void offensiveNamesAreRefusedButRealNamesAreNot() throws Exception {
        LeaderboardController lb = make(folder);
        assertThrows(ResponseStatusException.class, () -> lb.post(entry(A, "Shitty", "Q", "easy", 90, 0, 0, null), "1.1.1.1", DAY, 0));
        lb.post(entry(A, "Cassie", "D", "easy", 90, 0, 0, null), "1.1.1.1", DAY, 0);              // contains a short blocked word: fine
        lb.post(entry(B, "Dickens", "W", "easy", 90, 0, 0, null), "1.1.1.1", DAY, 0);
        assertEquals(2, lb.standings("2026-10-09", null).players());
    }

    @Test
    void theServerWorksOutThePointsLikeScoreJs() {
        assertEquals(60, LeaderboardController.band(5));
        assertEquals(118, LeaderboardController.band(7), "a 7x7 band: 60 s x 49/25");
        assertEquals(194, LeaderboardController.band(9));
        assertEquals(21 * 5 + 90, LeaderboardController.points("easy", 5, 21, 59, 0, 0, 0, 1));
        assertEquals(21 * 8 + 80 - 2 - 5, LeaderboardController.points("medium", 5, 21, 61, 2, 1, 0, 1));
        assertEquals(21 * 10 + 50, LeaderboardController.points("hard", 5, 21, 4 * 60 + 59, 0, 0, 0, 1), "4-5 minutes: +50");
        assertEquals(21 * 10 + 10, LeaderboardController.points("hard", 5, 21, 8 * 60 + 59, 0, 0, 0, 1), "8-9 minutes: +10");
        assertEquals(21 * 10, LeaderboardController.points("hard", 5, 21, 9 * 60, 0, 0, 0, 1), "9 minutes and up: no bonus");
        assertEquals(40 * 8 + 90, LeaderboardController.points("challenge", 7, 40, 117, 0, 0, 0, 1));
        assertEquals(40 * 8 + 80, LeaderboardController.points("challenge", 7, 40, 118, 0, 0, 0, 1));
        assertEquals(21 * 8 + 150, LeaderboardController.points("boss", 5, 21, 999, 0, 0, 3, 1), "no time bonus for the boss");
        assertEquals(21 * 8 + 150 - 100, LeaderboardController.points("boss", 5, 21, 999, 0, 0, 3, 3), "two lost attempts first");
        assertEquals(0, LeaderboardController.points("easy", 5, 21, 5000, 100, 100, 0, 1), "never below 0");
    }

    @Test
    void theServerReadsTheGridOfTheRealDaily() throws Exception {
        assertEquals(List.of(5, 3), java.util.Arrays.stream(PuzzleStore.shapeOf("{\"size\":5,\"solution\":[\"AB.\",\".C.\"]}")).boxed().toList());
        // the first shipped daily: a 5x5 with some black squares
        int[] shape = PuzzleStore.dailyShape(folder, LocalDate.of(2026, 11, 8), "easy");
        if (shape != null) {
            assertEquals(5, shape[0]);
            assertTrue(shape[1] > 15 && shape[1] <= 25, "white squares: " + shape[1]);
        }
        assertNull(PuzzleStore.dailyShape(folder, LocalDate.of(2031, 1, 1), "easy"), "never makes a daily");
    }

    @Test
    void totalsAreRankedAndEachDailyCountsOnce() throws Exception {
        LeaderboardController lb = make(folder);
        lb.post(timed(lb, entry(A, "Miles", "D", "easy", 50, 0, 0, null)), "1.1.1.1", DAY, 0);        // 105 + 90 = 195
        lb.post(timed(lb, entry(A, "Miles", "D", "easy", 10, 0, 0, null)), "1.1.1.1", DAY, 1);        // a second Easy: ignored
        lb.post(timed(lb, entry(B, "Ana", "R", "hard", 50, 0, 0, null)), "2.2.2.2", DAY, 2);          // 210 + 90 = 300
        LeaderboardController.Board board = lb.post(entry(A, "Miles", "D", "boss", 400, 0, 0, 2), "1.1.1.1", DAY, 3);   // 195 + 168 + 100
        assertEquals(2, board.players());
        assertEquals("Miles D.", board.top().get(0).name());
        assertEquals(463, board.top().get(0).points());
        assertEquals(List.of("easy", "boss"), board.top().get(0).dailies());
        assertEquals(1, board.you().rank());
        assertEquals(2, lb.standings("2026-10-09", B).you().rank());
        assertNull(lb.standings("2026-10-09", "cccccccc-1111-2222-3333-444444444444").you());
        // saved to disk: a fresh controller (a server restart) sees the same board
        assertEquals(463, new LeaderboardController(folder).standings("2026-10-09", null).top().get(0).points());
    }

    @Test
    void removingANameFromTheFileTakesEffectAtOnce() throws Exception {
        LeaderboardController lb = make(folder);
        lb.post(entry(A, "Miles", "D", "easy", 50, 0, 0, null), "1.1.1.1", DAY, 0);
        lb.post(entry(B, "Ana", "R", "easy", 50, 0, 0, null), "2.2.2.2", DAY, 1);
        assertEquals(2, lb.standings("2026-10-09", null).players());
        Path file = folder.resolve("2026-10-09.tsv");
        java.nio.file.Files.write(file, java.nio.file.Files.readAllLines(file).subList(0, 1));     // a moderator deletes Ana's line
        assertEquals(1, lb.standings("2026-10-09", null).players());
        java.nio.file.Files.delete(file);
        assertEquals(0, lb.standings("2026-10-09", null).players());
    }

    @Test
    void theDailyBossKeepsYourBestAttempt() throws Exception {
        LeaderboardController lb = make(folder);
        lb.post(new LeaderboardController.Entry(A, "Miles", "D", "2026-10-09", "boss", 200, 0, 0, 1, 2), "1.1.1.1", DAY, 0);    // 168 + 50 - 50 = 168
        lb.post(new LeaderboardController.Entry(A, "Miles", "D", "2026-10-09", "boss", 200, 0, 0, 1, 3), "1.1.1.1", DAY, 1);    // 168 + 50 - 100 = 118: lower, ignored
        assertEquals(168, lb.standings("2026-10-09", A).you().points());
        lb.post(new LeaderboardController.Entry(A, "Miles", "D", "2026-10-09", "boss", 200, 0, 0, 3, 3), "1.1.1.1", DAY, 2);    // 168 + 150 - 100 = 218: better
        LeaderboardController.Board b = lb.standings("2026-10-09", A);
        assertEquals(218, b.you().points());
        assertEquals(List.of("boss"), b.you().dailies());
        lb.post(timed(lb, entry(A, "Miles", "D", "easy", 50, 0, 0, null)), "1.1.1.1", DAY, 3);                                  // + 195
        assertEquals(413, lb.standings("2026-10-09", A).you().points());
    }

    @Test
    void solveTimesAreCheckedAgainstTheStartTicket() throws Exception {
        LeaderboardController lb = make(folder);
        long started = 1_000_000_000L;
        String ticket = lb.ticket(new LeaderboardController.Start("2026-10-09", "easy"), "1.1.1.1", DAY, started);
        assertTrue(lb.secondsSinceStart(ticket, DAY, "easy", started + 30_000) == 30);
        assertEquals(-1, lb.secondsSinceStart(ticket, DAY, "medium", started), "a ticket is for one daily");
        assertEquals(-1, lb.secondsSinceStart(ticket, DAY.plusDays(1), "easy", started), "and one day");
        assertEquals(-1, lb.secondsSinceStart(ticket.replace(Long.toString(started), Long.toString(started - 600_000)), DAY, "easy", started), "a moved start time breaks the signature");
        assertEquals(-1, lb.secondsSinceStart("1.2026-10-09.easy.00", DAY, "easy", started), "a made-up ticket");
        assertEquals(-1, lb.secondsSinceStart(null, DAY, "easy", started));
        // a server restart keeps the secret, so the ticket still works
        assertEquals(30, new LeaderboardController(folder).secondsSinceStart(ticket, DAY, "easy", started + 30_000));

        // 3 minutes after the start, claiming 10 minutes is impossible
        LeaderboardController.Entry slow = new LeaderboardController.Entry(A, "Miles", "D", "2026-10-09", "easy", 600, 0, 0, null, null, ticket);
        assertThrows(ResponseStatusException.class, () -> lb.post(slow, "1.1.1.1", DAY, started + 180_000));
        // claiming 50 s after 3 minutes is fine (the clock stops while the page is hidden): full speed bonus
        LeaderboardController.Entry ok = new LeaderboardController.Entry(A, "Miles", "D", "2026-10-09", "easy", 50, 0, 0, null, null, ticket);
        assertEquals(105 + 90, lb.post(ok, "1.1.1.1", DAY, started + 180_000).you().points());
        // no ticket: it counts, without the time bonus
        assertEquals(105, lb.post(entry(B, "Ann", "", "easy", 50, 0, 0, null), "2.2.2.2", DAY, started + 1000).you().points());
        assertThrows(ResponseStatusException.class, () -> lb.ticket(new LeaderboardController.Start("2026-10-09", "boss"), "1.1.1.1", DAY, started), "the Daily Boss needs no ticket");
    }

    @Test
    void badEntriesAreRefused() {
        LeaderboardController lb = make(folder);
        assertThrows(ResponseStatusException.class, () -> lb.post(entry("short", "Miles", "D", "easy", 50, 0, 0, null), "1", DAY, 0));
        assertThrows(ResponseStatusException.class, () -> lb.post(entry(A, "Miles", "D", "expert", 50, 0, 0, null), "1", DAY, 0));
        assertThrows(ResponseStatusException.class, () -> lb.post(entry(A, "Miles", "D", "easy", 0, 0, 0, null), "1", DAY, 0));
        assertThrows(ResponseStatusException.class, () -> lb.post(entry(A, "Miles", "D", "easy", 50, -1, 0, null), "1", DAY, 0));
        assertThrows(ResponseStatusException.class, () -> lb.post(entry(A, "Miles", "D", "boss", 50, 0, 0, 4), "1", DAY, 0));
        assertThrows(ResponseStatusException.class, () -> lb.post(new LeaderboardController.Entry(A, "Miles", "D", "2026-10-20", "easy", 50, 0, 0, null, null), "1", DAY, 0));
    }

    @Test
    void onePersonCanOnlyPostSoOften() throws Exception {
        LeaderboardController lb = make(folder);
        for (int i = 0; i < 20; i++) lb.post(entry("player-" + "x".repeat(10) + i, "Miles", "D", "easy", 50, 0, 0, null), "9.9.9.9", DAY, i);
        ResponseStatusException e = assertThrows(ResponseStatusException.class, () -> lb.post(entry(B, "Miles", "D", "easy", 50, 0, 0, null), "9.9.9.9", DAY, 30));
        assertEquals(429, e.getStatusCode().value());
    }

    @Test
    void everyResponseGetsTheSecurityHeadersAndBigPostsAreRefused() throws Exception {
        SecurityHeaders filter = new SecurityHeaders();
        MockHttpServletResponse page = new MockHttpServletResponse();
        filter.doFilter(new MockHttpServletRequest("GET", "/"), page, new MockFilterChain());
        assertTrue(page.getHeader("Content-Security-Policy").contains("script-src 'self'"));
        assertFalse(page.getHeader("Content-Security-Policy").contains("unsafe-eval"));
        assertEquals("nosniff", page.getHeader("X-Content-Type-Options"));
        assertEquals("DENY", page.getHeader("X-Frame-Options"));

        MockHttpServletRequest big = new MockHttpServletRequest("POST", "/api/report");
        big.setContent(new byte[SecurityHeaders.MAX_POST_BYTES + 1]);
        MockHttpServletResponse refused = new MockHttpServletResponse();
        filter.doFilter(big, refused, new MockFilterChain());
        assertEquals(413, refused.getStatus());

        MockHttpServletRequest small = new MockHttpServletRequest("POST", "/api/report");
        small.setContent("{}".getBytes());
        MockHttpServletResponse ok = new MockHttpServletResponse();
        filter.doFilter(small, ok, new MockFilterChain());
        assertEquals(200, ok.getStatus());
    }
}
