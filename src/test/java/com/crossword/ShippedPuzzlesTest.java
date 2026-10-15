package com.crossword;

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
//   - no clue uses a word from the blocked list
//   - each level has 25 puzzles of its own, with boards no other level has
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
