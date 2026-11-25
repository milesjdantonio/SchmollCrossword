package com.crossword;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

// The secret world, the Celestial Rift: it only shows up after the Void, has 4 levels and a 5-phase boss (the Cursed
// angel), and isn't one of the Everbook's 15 worlds.
class RiftTest {

    static final ObjectMapper JSON = new ObjectMapper();
    static Campaign.Section rift() { return Campaign.section("rift"); }

    @Test
    void theRiftIsSecretAndNotOneOfTheFifteen() {
        assertNotNull(rift());
        assertTrue(Campaign.secret(rift()));
        assertFalse(Campaign.SECTIONS.contains(rift()), "the 15 worlds (and the Daily Boss rotation) don't include it");
        assertEquals(20, Campaign.ALL.size());                       // the 15, the rift, then the four other secret worlds
        assertEquals("rift", Campaign.ALL.get(15).world(), "it comes after the Void");
        for (int day = 0; day < 60; day++) assertFalse(PuzzleStore.dailyBossSection(java.time.LocalDate.of(2026, 10, 1).plusDays(day)) == rift());
    }

    @Test
    void fourLevelsAndABossLikeEveryWorld() {
        assertEquals(List.of(1, 2, 3, 4, 5), Campaign.levels(rift()));
        assertTrue(Campaign.hasLevel(rift(), 4));
        assertEquals(7, Campaign.size(rift(), 1));
        assertEquals(9, Campaign.size(rift(), 2));
        assertEquals(9, Campaign.size(rift(), 5));
        for (int l : Campaign.levels(rift())) assertEquals("expert", Campaign.difficulty(rift(), l), "the hardest in the game");
    }

    @Test
    void theAngelHasFivePhasesAndTheOthersAreUnchanged() {
        assertEquals(5, Campaign.phases(rift()));
        assertEquals(5, Campaign.phases(Campaign.section("space")));
        assertEquals(3, Campaign.phases(Campaign.section("robot")));
        assertEquals(1, Campaign.phases(Campaign.section("paper")));
        for (int p = 2; p <= 5; p++) assertEquals(9, Campaign.phaseSize(rift(), p));
    }

    @Test
    void itsLessonsAndTheMap() {
        assertEquals(4, Lesson.COURSE.get("rift").size());
        assertTrue(Lesson.json("rift", 4).contains("\"mixed\""), Lesson.json("rift", 4));
        assertTrue(Lesson.json("rift", 5).contains("\"review\""));
        String map = Campaign.mapJson();
        assertTrue(map.contains("\"world\":\"rift\",\"secret\":true,\"levelList\":[1,2,3,4,5]"), map.substring(map.length() - 400));
        assertTrue(map.contains("\"levelList\":[1,2,3,4,5]"));
    }

    @Test
    void everySeedIsStillUnique() {
        Set<Long> seeds = new HashSet<>();
        for (Campaign.Section s : Campaign.ALL)
            for (int v = 0; v < Campaign.VARIANTS; v++)
                for (int level = 1; level <= Campaign.LEVELS + 5; level++) assertTrue(seeds.add(Campaign.seed(s, level, v)), s.world() + " " + level + " " + v);
    }

    // every level, the angel's own board and every phase finds a puzzle for each variant number (a few variants
    // were taken out of the pool and fall through to the next), all with hand-written clues
    @Test
    void thePoolIsComplete() throws IOException {
        int own = 0;
        for (int v = 0; v < Campaign.VARIANTS; v++) {
            for (int level : Campaign.levels(rift())) {
                String json = PuzzleStore.poolPuzzleOrNext(PuzzleStore.poolName(rift(), level, false), v);
                assertNotNull(json, "rift " + level + " v" + v);
                JsonNode p = JSON.readTree(json);
                assertEquals(Campaign.size(rift(), level), p.get("size").asInt());
                for (JsonNode e : p.get("across")) assertFalse(e.get("clue").asText().isBlank());
                if (PuzzleStore.poolPuzzle(PuzzleStore.poolName(rift(), level, false), v) != null) own++;
            }
            assertNotNull(PuzzleStore.poolPuzzleOrNext(PuzzleStore.poolName(rift(), 5, true), v), "the angel's board v" + v);
            if (PuzzleStore.poolPuzzle(PuzzleStore.poolName(rift(), 5, true), v) != null) own++;
            for (int phase = 2; phase <= 5; phase++) {
                assertNotNull(PuzzleStore.poolPuzzleOrNext(PuzzleStore.poolPhaseName(rift(), phase), v), "phase " + phase);
                if (PuzzleStore.poolPuzzle(PuzzleStore.poolPhaseName(rift(), phase), v) != null) own++;
            }
        }
        assertTrue(own >= 230, own + " of the rift's 250 puzzles");
    }
}
