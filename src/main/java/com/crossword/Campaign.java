package com.crossword;

import java.util.List;

/*
 * Campaign mode (written by Claude at the user's request): a map of 15 worlds, travelled in order from easy to hard.
 * Each world has 5 levels; level 5 is a boss battle.
 *
 * Every level is ONE fixed puzzle, the same for everyone (like a daily): the seed comes from the world and level,
 * and PuzzleStore.getCampaign generates it once (one paid Claude call) and saves it to
 * puzzles/campaign/<world>-<level>.json. So the whole campaign costs at most 75 calls, ever.
 */
public class Campaign {

    // One section of the map: a world, the difficulty and board size of its levels 1-4, and its boss's (level 5).
    // Difficulties: "easy" and "medium" are normal 5x5 puzzles. "challenge" is a Challenge grid with medium clues,
    // like the Challenge daily. "expert" is a Challenge grid with hard words first and hard clues.
    record Section(String world, String difficulty, int size, String bossDifficulty, int bossSize) {}

    // The order of the map, easiest first. The ids match the worlds in static/js/worlds/.
    // The user's design (2026-10-08): the Challenge grid felt right, so it's the MIDDLE of the campaign;
    // the first worlds lead up to it with 5x5 puzzles and the later ones scale up from it (bigger, harder).
    static final List<Section> SECTIONS = List.of(
        new Section("paper",    "easy",      5, "easy",      5),
        new Section("garden",   "easy",      5, "medium",    5),
        new Section("squirrel", "medium",    5, "challenge", 6),
        new Section("candy",    "medium",    5, "challenge", 6),
        new Section("ocean",    "challenge", 6, "challenge", 7),
        new Section("snow",     "challenge", 6, "challenge", 7),
        new Section("rain",     "challenge", 7, "expert",    7),
        new Section("sky",      "challenge", 7, "expert",    7),
        new Section("desert",   "challenge", 7, "expert",    9),
        new Section("carnival", "expert",    6, "expert",    7),
        new Section("arcade",   "expert",    7, "expert",    7),
        new Section("robot",    "expert",    7, "expert",    9),
        new Section("library",  "expert",    7, "expert",    9),
        new Section("volcano",  "expert",    9, "expert",    9),
        new Section("space",    "expert",    9, "expert",    9)
    );

    static final int LEVELS = 5;      // per world; the last one is the boss

    // The section for a world id, or null if there isn't one
    static Section section(String world) {
        for (Section s : SECTIONS) {
            if (s.world().equals(world)) return s;
        }
        return null;
    }

    // A level's difficulty: the world's, or its boss difficulty for level 5
    static String difficulty(Section section, int level) {
        return level == LEVELS ? section.bossDifficulty() : section.difficulty();
    }

    // A level's board size (5 = the normal 5x5 shape)
    static int size(Section section, int level) {
        return level == LEVELS ? section.bossSize() : section.size();
    }

    // Is this level a Challenge-style grid (random black squares, any size) rather than the normal 5x5 shape?
    static boolean bigGrid(String difficulty) {
        return difficulty.equals("challenge") || difficulty.equals("expert");
    }

    // Boss phases (the user's design, 2026-10-08): when you solve the boss's first puzzle, phase 2 starts with a
    // second, bigger one. The early bosses (normal 5x5 puzzles) switch to a Challenge grid; the Challenge and
    // Expert bosses switch to a bigger Expert grid, up to 9x9.
    static String phase2Difficulty(Section section) {
        return bigGrid(section.bossDifficulty()) ? "expert" : "challenge";
    }
    static int phase2Size(Section section) {
        if (!bigGrid(section.bossDifficulty())) return 6;
        return section.bossSize() >= 7 ? 9 : 7;
    }

    // A fixed seed for each level, far away from the daily seeds (those look like 202610081):
    // world 1 level 1 -> 7000000011, world 15 level 5 -> 7000000155 (6 = the boss's own board, 7 = boss phase 2)
    static long seed(Section section, int level) {
        return 7_000_000_000L + (SECTIONS.indexOf(section) + 1) * 10L + level;
    }

    // The map as JSON for the website:
    // [{"world":"paper","levels":["easy","easy","easy","easy","easy"],"sizes":[5,5,5,5,5],"phase2":["challenge",6]}, ...]
    static String mapJson() {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < SECTIONS.size(); i++) {
            Section s = SECTIONS.get(i);
            if (i > 0) sb.append(",");
            sb.append("{\"world\":\"").append(s.world()).append("\",\"levels\":[");
            for (int level = 1; level <= LEVELS; level++) {
                if (level > 1) sb.append(",");
                sb.append("\"").append(difficulty(s, level)).append("\"");
            }
            sb.append("],\"sizes\":[");
            for (int level = 1; level <= LEVELS; level++) {
                if (level > 1) sb.append(",");
                sb.append(size(s, level));
            }
            sb.append("],\"lessons\":[");
            for (int level = 1; level <= LEVELS; level++) {
                if (level > 1) sb.append(",");
                sb.append(Lesson.json(s.world(), level));                  // what each level teaches (Lesson.java)
            }
            sb.append("],\"phase2\":[\"").append(phase2Difficulty(s)).append("\",").append(phase2Size(s)).append("]}");
        }
        return sb.append("]").toString();
    }
}
