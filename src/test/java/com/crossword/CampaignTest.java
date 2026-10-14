package com.crossword;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.web.server.ResponseStatusException;

// Campaign mode: the map's order, difficulties, seeds and the API's input checks. Never reaches Claude.
class CampaignTest {

    private final PuzzleController controller =
            new PuzzleController(java.util.Map.of("easy", TestWords.easy(), "medium", TestWords.everyday(), "hard", TestWords.hard()),
                    TestWords.withHardWords(), new RateLimiter(0, 0));

    @Test
    void fifteenDifferentWorldsStartingEasy() {
        assertEquals(15, Campaign.SECTIONS.size());
        Set<String> worlds = new HashSet<>();
        for (Campaign.Section s : Campaign.SECTIONS) worlds.add(s.world());
        assertEquals(15, worlds.size(), "no world twice");
        assertEquals("easy", Campaign.difficulty(Campaign.SECTIONS.get(0), 1));
        assertEquals("expert", Campaign.difficulty(Campaign.SECTIONS.get(14), 5), "the final boss is an Expert grid");
    }

    // The user's design: the Challenge grid is the middle of the campaign; it only gets bigger and harder from there
    @Test
    void difficultyClimbsAndChallengeIsTheMiddle() {
        List<String> order = List.of("easy", "medium", "challenge", "expert");
        int lastRank = 0, lastSize = 0, firstChallenge = -1;
        for (int i = 0; i < Campaign.SECTIONS.size(); i++) {
            Campaign.Section s = Campaign.SECTIONS.get(i);
            for (int level = 1; level <= Campaign.LEVELS; level++) {
                String d = Campaign.difficulty(s, level);
                int rank = order.indexOf(d), size = Campaign.size(s, level);
                assertTrue(rank >= 0, d);
                assertTrue(Campaign.bigGrid(d) ? List.of(6, 7, 9).contains(size) : size == 5, d + " " + size);
                if (level < Campaign.LEVELS) {       // levels 1-4 never get easier than the world before
                    assertTrue(rank > lastRank || (rank == lastRank && size >= lastSize), s.world());
                    lastRank = rank;
                    lastSize = size;
                }
                if (d.equals("challenge") && firstChallenge < 0) firstChallenge = i;
            }
        }
        assertTrue(firstChallenge >= 2 && firstChallenge <= 6, "Challenge grids start around the middle: world " + (firstChallenge + 1));
    }

    // Boss phase 2 is always a bigger grid than the boss's first puzzle: a Challenge grid instead of a normal 5x5
    @Test
    void phaseTwoIsBigger() {
        for (Campaign.Section s : Campaign.SECTIONS) {
            String d = Campaign.phase2Difficulty(s);
            assertTrue(Campaign.bigGrid(d), s.world());
            assertTrue(Campaign.phase2Size(s) >= Math.max(6, Campaign.size(s, Campaign.LEVELS)), s.world());
            if (!Campaign.bigGrid(s.bossDifficulty())) assertEquals("challenge", d, "a normal boss switches to a Challenge grid");
        }
    }

    // Every campaign size fills quickly with Hard's words (no Claude: just the grid)
    @Test
    void bigCampaignGridsFill() {
        long start = System.currentTimeMillis();
        for (int size : List.of(6, 7, 9)) {
            ChallengeGrid.Filled filled = PuzzleStore.buildChallenge(7_000_000_000L + size, size, TestWords.hard(), TestWords.hard(), Set.of("REST"));
            assertEquals(size, filled.grid().length);
        }
        assertTrue(System.currentTimeMillis() - start < 20_000);
    }

    // A level stays away from the answers of the levels just before it on the map
    @Test
    void levelsAvoidTheAnswersOfTheLevelsBefore(@TempDir Path folder) throws IOException {
        Campaign.Section paper = Campaign.SECTIONS.get(0), garden = Campaign.SECTIONS.get(1);
        Files.writeString(PuzzleStore.campaignFile(folder, paper, 4, false), "{\"across\": [{\"answer\": \"REST\"}]}");
        Files.writeString(PuzzleStore.campaignFile(folder, paper, 5, true), "{\"answer\": \"CROP\"}");
        Files.writeString(PuzzleStore.campaignFile(folder, garden, 2, false), "{\"answer\": \"LATER\"}");
        assertEquals(Set.of("REST", "CROP"), PuzzleStore.recentCampaignAnswers(folder, garden, 1, false));
        assertEquals(Set.of("REST"), PuzzleStore.recentCampaignAnswers(folder, paper, 5, false), "the boss's board comes after the boss's level");
        assertEquals(Set.of(), PuzzleStore.recentCampaignAnswers(folder, paper, 1, false));
    }

    @Test
    void everyLevelHasItsOwnSeed() {
        Set<Long> seeds = new HashSet<>();
        for (Campaign.Section s : Campaign.SECTIONS) {
            for (int level = 1; level <= Campaign.LEVELS; level++) {
                assertTrue(seeds.add(Campaign.seed(s, level)));
            }
            assertTrue(seeds.add(Campaign.seed(s, Campaign.LEVELS + 1)), "the boss's own board");
            for (int level = 1; level <= Campaign.LEVELS; level++) {
                assertTrue(Campaign.seed(s, level) < (1L << 53), "JavaScript can hold it exactly");
            }
        }
    }

    @Test
    void mapJsonListsEveryLevel() {
        String json = Campaign.mapJson();
        assertTrue(json.startsWith("[{\"world\":\"paper\",\"levelList\":[1,2,3,4,5],\"levels\":[\"easy\",\"easy\",\"easy\",\"easy\",\"easy\"],\"sizes\":[5,5,5,5,5],\"lessons\":["));
        assertTrue(json.contains("{\"world\":\"space\",\"levelList\":[1,2,3,4,5],\"levels\":[\"expert\",\"expert\",\"expert\",\"expert\",\"expert\"],\"sizes\":[9,9,9,9,9],\"lessons\":["));
        assertTrue(json.endsWith("\"phase2\":[\"expert\",9],\"phases\":[[\"expert\",9],[\"expert\",9],[\"expert\",9],[\"expert\",9]]}]"), "the last world (the secret Celestial Rift, after the Void) has 5 phases");
    }

    @Test
    void unknownWorldsAndLevelsAreRejectedWith400() {
        assertNull(Campaign.section("banana"));
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> controller.campaign("banana", 1, false)).getStatusCode().value());
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> controller.campaign("garden", 0, false)).getStatusCode().value());
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> controller.campaign("garden", 6, false)).getStatusCode().value());
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> controller.campaign("garden", 3, true)).getStatusCode().value(), "only bosses have a boss board");
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> controller.campaign("garden", 3, false, 2)).getStatusCode().value(), "only bosses have a phase 2");
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> controller.campaign("garden", 5, false, 2)).getStatusCode().value(), "the Garden boss has one phase");
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> controller.campaign("snow", 5, false, 3)).getStatusCode().value(), "two phases");
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> controller.campaign("space", 5, false, 6)).getStatusCode().value(), "the Void has five");
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> controller.campaign("garden", 3, false, 1, -1)).getStatusCode().value(), "no negative tries");
    }

    // The user's design (2026-10-09): the first five bosses have 1 phase, the last three 3, the final boss 5, the rest 2.
    // Every phase is at least as big as the one before.
    @Test
    void lastBossesHaveMorePhases() {
        int last = Campaign.SECTIONS.size() - 1;
        for (int i = 0; i <= last; i++) {
            Campaign.Section s = Campaign.SECTIONS.get(i);
            assertEquals(i == last ? 5 : i >= last - 2 ? 3 : i < 5 ? 1 : 2, Campaign.phases(s), s.world());
            for (int phase = 2; phase <= Campaign.phases(s); phase++) {
                assertTrue(Campaign.phaseSize(s, phase) >= Campaign.phaseSize(s, phase - 1), s.world() + " phase " + phase);
                assertTrue(Campaign.bigGrid(Campaign.phaseDifficulty(s, phase)));
            }
        }
        assertEquals("space", Campaign.SECTIONS.get(last).world());
        assertEquals("robot", Campaign.SECTIONS.get(last - 2).world(), "the user swapped the robot and the library");
    }

    // The boss's own board is made without clues, so it never calls Claude (the user: less expensive)
    @Test
    void bossBoardsHaveNoClues() {
        String json = PuzzleStore.generateSmall(7_000_000_016L, "campaign", "easy", TestWords.easy(), Set.of(), "", "", false);
        assertTrue(json.contains("\"answer\""), "it's a real board");
        assertTrue(!json.matches("(?s).*\"clue\"\s*:\s*\"[^\"]+\".*"), "every clue is blank");
        String big = PuzzleStore.generateBig(7_000_000_016L, "campaign", "expert", 7, TestWords.hard(), Set.of(), "", "", false);
        assertTrue(!big.matches("(?s).*\"clue\"\s*:\s*\"[^\"]+\".*"));
    }

    // Daily Boss (the user, 2026-10-09): a different boss every day, all 15 in 15 days, never the same two days running
    @Test
    void dailyBossCyclesThroughEveryBoss() {
        java.time.LocalDate day = java.time.LocalDate.of(2026, 10, 9);
        Set<String> seen = new HashSet<>();
        String last = null;
        for (int i = 0; i < 15; i++) {
            String w = PuzzleStore.dailyBossSection(day.plusDays(i)).world();
            seen.add(w);
            assertTrue(!w.equals(last), "not the same boss two days running");
            last = w;
        }
        assertEquals(15, seen.size());
        // the boss's own board for any boss is free (no clues, no Claude)
        String board = PuzzleStore.bossPuzzle(7_000_000_099L, Campaign.SECTIONS.get(0), TestWords.easy(), false);
        assertTrue(!board.matches("(?s).*\"clue\"\s*:\s*\"[^\"]+\".*"));
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> controller.bossFight("weekly", null, null, false, null)).getStatusCode().value());
        assertEquals(400, assertThrows(ResponseStatusException.class, () -> controller.bossFight("unlimited", null, "banana", false, null)).getStatusCode().value());
    }

    // Losing or giving up rerolls the level (the user's rule): each try has its own seed and file
    @Test
    void rerollsHaveTheirOwnSeedsAndFiles(@TempDir Path folder) {
        Campaign.Section garden = Campaign.SECTIONS.get(1);
        Set<Long> seeds = new HashSet<>();
        for (int v = 0; v < Campaign.VARIANTS; v++) {
            for (Campaign.Section s : Campaign.SECTIONS) {
                for (int level = 1; level <= Campaign.LEVELS + 5; level++) assertTrue(seeds.add(Campaign.seed(s, level, v)), s.world() + " " + level + " try " + v);
            }
        }
        Path file = PuzzleStore.campaignFile(folder, garden, 3, false);
        assertEquals(file, PuzzleStore.variantFile(file, 0));
        assertEquals("garden-3-v2.json", PuzzleStore.variantFile(file, 2).getFileName().toString());
        assertEquals("garden-5-p3-v1.json", PuzzleStore.variantFile(PuzzleStore.phaseFile(folder, garden, 3), 1).getFileName().toString());
        assertEquals(List.of(file, PuzzleStore.variantFile(file, 1)), PuzzleStore.earlierVariants(file, 2));
    }
}
