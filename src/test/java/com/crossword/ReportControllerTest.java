package com.crossword;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.web.server.ResponseStatusException;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

// Reports: saved as one JSON line each, checked first, and only readable with the key
class ReportControllerTest {

    @TempDir
    Path folder;

    @Test
    void aReportIsSavedAsOneJsonLine() throws Exception {
        Path file = folder.resolve("reports.jsonl");
        ReportController controller = new ReportController(file, "secret");
        controller.save(new ReportController.Report(202610082L, "daily", "Medium", "5A: Sound before \"Bless you!\"", "The clue says\tit's wrong\r\nhere", "snow"), "1.2.3.4", 0);
        controller.save(new ReportController.Report(42L, "campaign", "challenge", null, "Too hard!", null), "1.2.3.4", 1000);
        List<String> lines = Files.readAllLines(file);
        assertEquals(2, lines.size());
        JsonNode first = new ObjectMapper().readTree(lines.get(0));
        assertEquals(202610082L, first.get("seed").asLong());
        assertEquals("medium", first.get("difficulty").asText());
        assertEquals("The clue says it's wrong \nhere", first.get("message").asText());
        assertEquals("", new ObjectMapper().readTree(lines.get(1)).get("clue").asText());
        assertTrue(controller.reports("secret").contains("Too hard!"));
    }

    @Test
    void campaignLevelsCanBeReportedToo() throws Exception {
        Path file = folder.resolve("reports.jsonl");
        ReportController controller = new ReportController(file, "secret");
        controller.save(new ReportController.Report(7L, "campaign", "expert", null, "Odd clue <script>alert(1)</script>", "space"), "1.2.3.4", 0);
        // saved as plain JSON text: it's data, never run (and /api/reports answers as text/plain)
        assertEquals("Odd clue <script>alert(1)</script>", new ObjectMapper().readTree(Files.readAllLines(file).get(0)).get("message").asText());
        assertThrows(ResponseStatusException.class, () -> controller.save(new ReportController.Report(7L, "admin", "easy", null, "x", null), "1.2.3.4", 0));
    }

    @Test
    void badReportsAreRejected() {
        ReportController controller = new ReportController(folder.resolve("r.jsonl"), null);
        assertThrows(ResponseStatusException.class, () -> controller.save(new ReportController.Report(1L, "daily", "easy", null, "  ", null), "a", 0));
        assertThrows(ResponseStatusException.class, () -> controller.save(new ReportController.Report(null, "daily", "easy", null, "hi", null), "a", 0));
        assertThrows(ResponseStatusException.class, () -> controller.save(new ReportController.Report(1L, "daily", "banana", null, "hi", null), "a", 0));
        assertThrows(ResponseStatusException.class, () -> controller.save(new ReportController.Report(1L, "daily", "easy", null, "x".repeat(1001), null), "a", 0));
        assertThrows(ResponseStatusException.class, () -> controller.reports("anything"), "no key set: the reports page doesn't exist");
    }

    @Test
    void tooManyReportsFromOnePersonAreRefused() throws Exception {
        ReportController controller = new ReportController(folder.resolve("r.jsonl"), "k");
        for (int i = 0; i < 10; i++) controller.save(new ReportController.Report(1L, "daily", "easy", null, "report " + i, null), "same", 0);
        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> controller.save(new ReportController.Report(1L, "daily", "easy", null, "one more", null), "same", 0));
        assertEquals(429, e.getStatusCode().value());
        assertThrows(ResponseStatusException.class, () -> controller.reports("wrong key"));
    }
}
