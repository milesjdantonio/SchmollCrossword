package com.crossword;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

// Checks on the puzzles that ship with the game (src/main/resources/campaign and daily):
//   - no clue uses a word from the blocked list, and no campaign answer is on the family list
//   - each level has at least 20 puzzles of its own (25 variant numbers), with boards no other level has
//   - every daily a player solves has all its clues
class ShippedPuzzlesTest {

    static final Path CAMPAIGN = Path.of("src", "main", "resources", "campaign");
    static final Path DAILY = Path.of("src", "main", "resources", "daily");
    static final ObjectMapper JSON = new ObjectMapper();

    static List<Path> files(Path folder) throws IOException {
        try (Stream<Path> s = Files.list(folder)) {
            return s.filter(p -> p.toString().endsWith(".json")).sorted().toList();
        }
    }

    @Test
    void noClueUsesABlockedWord() throws IOException {
        Set<String> blocked = App.loadBlockedWords();
        List<String> found = new ArrayList<>();
        for (Path folder : List.of(CAMPAIGN, DAILY)) {
            for (Path f : files(folder)) {
                JsonNode p = JSON.readTree(f.toFile());
                for (String dir : List.of("across", "down")) {
                    for (JsonNode e : p.path(dir)) {
                        String clue = e.path("clue").asText();
                        // every word in the clue on its own (so "Moby-Dick" counts as MOBY and DICK)
                        for (String word : clue.toLowerCase().split("[^a-z]+")) {
                            if (blocked.contains(word)) found.add(f.getFileName() + ": " + clue);
                        }
                    }
                }
            }
        }
        assertTrue(found.isEmpty(), "clues with a blocked word: " + found);
    }

    // No answer in the campaign's pool is on the family list (family-words.txt)
    @Test
    void noCampaignAnswerIsOnTheFamilyList() throws IOException {
        Set<String> family = App.loadFamilyWords();
        List<String> found = new ArrayList<>();
        for (Path f : files(CAMPAIGN)) {
            JsonNode p = JSON.readTree(f.toFile());
            for (String dir : List.of("across", "down")) {
                for (JsonNode e : p.path(dir)) {
                    if (family.contains(e.path("answer").asText())) found.add(f.getFileName() + ": " + e.path("answer").asText());
                }
            }
        }
        assertTrue(found.isEmpty(), "family-list answers: " + found);
    }

    // Each level keeps most of its 25 puzzles (a few were taken out of the pool), and every variant number still
    // finds one
    @Test
    void everyLevelHasPlentyOfPuzzles() throws IOException {
        Map<String, Integer> count = new HashMap<>();
        for (Path f : files(CAMPAIGN)) count.merge(f.getFileName().toString().replaceAll("-v\\d+\\.json$", ""), 1, Integer::sum);
        for (Map.Entry<String, Integer> e : count.entrySet()) {
            assertTrue(e.getValue() >= 20, e.getKey() + " has only " + e.getValue() + " puzzles");
            for (int v = 0; v < Campaign.VARIANTS; v++) assertNotNull(PuzzleStore.poolPuzzleOrNext(e.getKey(), v), e.getKey() + " v" + v);
        }
    }

    // Every shipped daily a player solves has a clue for each answer (the boss's own board has none, by design)
    @Test
    void everyDailyHasEveryClue() throws IOException {
        List<String> missing = new ArrayList<>();
        for (Path f : files(DAILY)) {
            if (f.getFileName().toString().endsWith("-boss-board.json")) continue;
            JsonNode p = JSON.readTree(f.toFile());
            for (String dir : List.of("across", "down")) {
                for (JsonNode e : p.path(dir)) {
                    if (e.path("clue").asText().isBlank()) missing.add(f.getFileName() + " " + e.path("answer").asText());
                }
            }
        }
        assertTrue(missing.isEmpty(), "answers with no clue: " + missing);
    }

    @Test
    void noTwoCampaignLevelsShareAPuzzle() throws IOException {
        Map<String, String> levelOf = new HashMap<>();
        List<String> shared = new ArrayList<>();
        for (Path f : files(CAMPAIGN)) {
            String name = f.getFileName().toString();
            // only the puzzles a player solves must be unique; a boss's own board (the bot's, "-boss-v") can be any
            // board, even one a player has
            if (name.contains("-boss-v")) continue;
            String level = name.replaceAll("-v\\d+\\.json$", "");
            StringBuilder grid = new StringBuilder();
            for (JsonNode row : JSON.readTree(f.toFile()).get("solution")) grid.append(row.asText()).append('/');
            String before = levelOf.putIfAbsent(grid.toString(), name);
            if (before != null) shared.add(before + " = " + name + (before.startsWith(level + "-v") ? "" : " (different levels)"));
        }
        assertTrue(shared.isEmpty(), shared.size() + " puzzles used twice, e.g. " + shared.subList(0, Math.min(5, shared.size())));
    }
}
