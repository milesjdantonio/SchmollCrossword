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
    // like the Challenge daily. "expert" is a Challenge grid with hard clues. The words are one step easier than the
    // difficulty (the user, 2026-10-10): see "Easier words in the campaign" in PuzzleStore.java.
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
        new Section("library",  "expert",    7, "expert",    9),      // the user swapped these two (2026-10-09):
        new Section("robot",    "expert",    7, "expert",    9),      // the robot feels harder than the library
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
        return phaseDifficulty(section, 2);
    }
    static int phase2Size(Section section) {
        return phaseSize(section, 2);
    }

    // How many phases (puzzles) a boss fight has (the user's design, 2026-10-09): the first five bosses have just
    // one, the last three have 3, the final boss (the Void) has 5, the rest have 2. Each new phase starts when you
    // finish a board.
    static final int SINGLE_PHASE_BOSSES = 5;
    static int phases(Section section) {
        int i = SECTIONS.indexOf(section), last = SECTIONS.size() - 1;
        if (i == last) return 5;
        if (i >= last - 2) return 3;
        return i < SINGLE_PHASE_BOSSES ? 1 : 2;
    }
    // Phase 1 is the boss level itself; phase 2 is bigger; phases 3-5 are the biggest Expert grid (9x9)
    static String phaseDifficulty(Section section, int phase) {
        if (phase <= 1) return section.bossDifficulty();
        return bigGrid(section.bossDifficulty()) ? "expert" : "challenge";
    }
    static int phaseSize(Section section, int phase) {
        if (phase <= 1) return section.bossSize();
        if (phase >= 3) return 9;
        if (!bigGrid(section.bossDifficulty())) return 6;
        return section.bossSize() >= 7 ? 9 : 7;
    }

    // Rerolls (the user's rule, 2026-10-09): if you lose or give up, your next try is a NEW puzzle with new clues,
    // so you can't win by remembering the answers. Try 0 is the level's first puzzle, try 1 the next one, and so on.
    // Each one is saved like the first (so Claude is paid once per puzzle); after VARIANTS tries they come round again.
    // The puzzle pool (the user, 2026-10-10: "make 25 [per level] ... that it pulls from randomly ... they must feel
    // the same"): every level has VARIANTS ready-made puzzles (CampaignPool.java), and the website picks one at random
    // each time a level starts (never one of the last few you played there).
    static final int VARIANTS = 25;

    // A fixed seed for each level, far away from the daily seeds (those look like 202610081):
    // world 1 level 1 -> 7000000011, world 15 level 5 -> 7000000155 (6 = the boss's own board, 7-10 = boss phases 2-5)
    static long seed(Section section, int level) {
        return 7_000_000_000L + (SECTIONS.indexOf(section) + 1) * 10L + level;
    }
    // a reroll's seed: the same, 1000 further along for each try
    static long seed(Section section, int level, int variant) {
        return seed(section, level) + 1000L * variant;
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
            sb.append("],\"phase2\":[\"").append(phase2Difficulty(s)).append("\",").append(phase2Size(s)).append("]");
            sb.append(",\"phases\":[");                                  // every phase after the first: [difficulty, size]
            for (int phase = 2; phase <= phases(s); phase++) {
                if (phase > 2) sb.append(",");
                sb.append("[\"").append(phaseDifficulty(s, phase)).append("\",").append(phaseSize(s, phase)).append("]");
            }
            sb.append("]}");
        }
        return sb.append("]").toString();
    }
}
