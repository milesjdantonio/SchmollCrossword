package com.crossword;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

// Dailies made ahead of time. A pretend maker writes the files, so nothing here calls Claude.
class DailyMakerTest {

    // far enough ahead that no shipped daily gets in the way
    private final LocalDate today = LocalDate.of(2031, 3, 10);

    private DailyMaker maker(Path folder, int daysAhead, int maxPerRun, List<String> made, String failKind) {
        DailyMaker[] dm = new DailyMaker[1];
        dm[0] = new DailyMaker(folder, daysAhead, maxPerRun, (date, kind) -> {
            if (kind.equals(failKind)) throw new IOException("Claude is down");
            made.add(date + " " + kind);
            PuzzleStore.save(dm[0].file(date, kind), PuzzleStoreTest.PUZZLE);
        });
        return dm[0];
    }

    @Test
    void makesEverythingMissingFromYesterdayOn(@TempDir Path folder) throws IOException {
        List<String> made = new ArrayList<>();
        DailyMaker dm = maker(folder, 2, 100, made, null);
        assertEquals(4 * DailyMaker.KINDS.length, dm.makeAhead(today), "yesterday, today and two days ahead");
        assertTrue(made.contains(today.minusDays(1) + " easy"));
        assertTrue(made.contains(today.plusDays(2) + " boss-board"));
        assertEquals(3, dm.daysInStock(today), "today and the next two");
        assertEquals(0, dm.makeAhead(today), "nothing left to make");
    }

    @Test
    void aRunMakesAtMostItsShare(@TempDir Path folder) {
        List<String> made = new ArrayList<>();
        DailyMaker dm = maker(folder, 7, 5, made, null);
        assertEquals(5, dm.makeAhead(today));
        assertEquals(5, dm.makeAhead(today), "the next run carries on");
        assertEquals(10, made.size());
    }

    @Test
    void aFailureIsCountedAndTheRestCarryOn(@TempDir Path folder) {
        List<String> made = new ArrayList<>();
        DailyMaker dm = maker(folder, 0, 100, made, "challenge");
        assertEquals(2 * (DailyMaker.KINDS.length - 1), dm.makeAhead(today));
        assertEquals(2, dm.lastFailed);
        assertTrue(dm.lastError.contains("challenge"));
    }

    @Test
    void offMeansOff(@TempDir Path folder) {
        List<String> made = new ArrayList<>();
        maker(folder, 0, 100, made, null).run();
        assertTrue(made.isEmpty(), "0 days ahead: the scheduled run does nothing");
    }
}
