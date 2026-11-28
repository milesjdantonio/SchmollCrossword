package com.crossword;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

// The Daily Archive: only days that are over everywhere, only dailies that already exist, never a family-filter answer
class ArchiveControllerTest {

    static final ObjectMapper JSON = new ObjectMapper();
    final ArchiveController archive = new ArchiveController();

    @Test
    void aDayJoinsOnceItIsOverInTheLastTimeZone() {
        LocalDate day = LocalDate.of(2026, 11, 26);
        assertFalse(ArchiveController.overEverywhere(day, Instant.parse("2026-11-27T11:59:59Z")));
        assertTrue(ArchiveController.overEverywhere(day, Instant.parse("2026-11-27T12:00:00Z")));
        assertFalse(ArchiveController.overEverywhere(day, Instant.parse("2026-11-26T20:00:00Z")), "not on the day itself");
    }

    @Test
    void servesAShippedDaily() throws IOException {
        JsonNode p = JSON.readTree(archive.puzzle("2026-10-20", "easy", Instant.parse("2026-11-27T13:00:00Z")));
        assertTrue(p.has("solution") && p.has("across") && p.has("down"));
        assertEquals("easy", p.get("difficulty").asText());
    }

    @Test
    void refusesTodayTheFutureAndBeforeTheFirstDay() {
        Instant now = Instant.parse("2026-11-27T20:00:00Z");
        for (String date : new String[] {"2026-11-27", "2026-11-28", "2030-01-01", "2026-10-10"}) {
            ResponseStatusException e = assertThrows(ResponseStatusException.class, () -> archive.puzzle(date, "easy", now), date);
            assertEquals(HttpStatus.NOT_FOUND, e.getStatusCode());
        }
    }

    @Test
    void refusesABadDifficultyOrDate() {
        Instant now = Instant.parse("2026-11-27T20:00:00Z");
        assertEquals(HttpStatus.BAD_REQUEST, assertThrows(ResponseStatusException.class, () -> archive.puzzle("2026-10-20", "boss", now)).getStatusCode());
        assertEquals(HttpStatus.BAD_REQUEST, assertThrows(ResponseStatusException.class, () -> archive.puzzle("yesterday", "easy", now)).getStatusCode());
    }

    @Test
    void listsDaysNewestFirstAndNeverOneStillBeingPlayed() throws IOException {
        JsonNode days = JSON.readTree(archive.daysJson(Instant.parse("2026-11-01T13:00:00Z"))).get("days");
        assertTrue(days.size() > 15);
        assertEquals("2026-10-31", days.get(0).get("date").asText(), "Nov 1 is still today somewhere");
        assertEquals("2026-10-11", days.get(days.size() - 1).get("date").asText());
        for (int i = 1; i < days.size(); i++) {
            assertTrue(days.get(i - 1).get("date").asText().compareTo(days.get(i).get("date").asText()) > 0);
        }
    }

    @Test
    void noArchivedPuzzleHasAFamilyFilterAnswer() throws IOException {
        Set<String> family = new HashSet<>();
        for (String w : App.loadFamilyWords()) family.add(w.toUpperCase());
        JsonNode days = JSON.readTree(archive.daysJson(Instant.parse("2026-12-01T13:00:00Z"))).get("days");
        int served = 0;
        for (JsonNode d : days) {
            for (JsonNode kind : d.get("kinds")) {
                String json = archive.puzzle(d.get("date").asText(), kind.asText(), Instant.parse("2026-12-01T13:00:00Z"));
                for (String answer : PuzzleStore.answersIn(json)) assertFalse(family.contains(answer), d.get("date") + " " + kind + ": " + answer);
                served++;
            }
        }
        assertTrue(served > 150, "most shipped dailies are in the archive (" + served + ")");
    }
}
