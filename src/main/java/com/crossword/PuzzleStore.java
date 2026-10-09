package com.crossword;

import java.io.IOException;
import java.nio.file.Files; // read/write a whole file in one line
import java.nio.file.Path;  // a file or folder location
import java.time.LocalDate; // a calendar date with no time, e.g. 2026-10-07
import java.util.ArrayList;
import java.util.ArrayDeque;
import java.util.Arrays;
import java.util.Deque;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/*
 * ===== Step 17: Save generated puzzles =====
 *
 * The daily puzzle must be IDENTICAL for everyone, but Claude writes different clues on every call
 * (and every call costs money). So each daily is written by Claude only the FIRST time it's asked for,
 * then saved as a file and served from the file forever after.
 *
 * Design pass: there are THREE dailies every day, one per difficulty, each with its own grid
 * (seed from date + difficulty), its own word list (easier words on easy) and its own clues.
 *
 *   puzzles/daily/2026-10-07-easy.json     <- three different
 *   puzzles/daily/2026-10-07-medium.json   <- puzzles
 *   puzzles/daily/2026-10-07-hard.json
 */
public class PuzzleStore {

    // Where daily puzzles are saved: puzzles/daily inside the project folder (ignored by git: it's generated data).
    // Step 26: online, the host sets PUZZLE_DIR to a disk that survives restarts; otherwise a restart would lose
    // today's saved clues and the next request would pay Claude to write different ones.
    static final Path DAILY_FOLDER = Path.of(System.getenv().getOrDefault("PUZZLE_DIR", "puzzles"), "daily");

    // The grid shape every puzzle uses for now (black squares top-right and bottom-left)
    static final boolean[][] SHAPE = {
        {false, false, false, false, true},
        {false, false, false, false, false},
        {false, false, false, false, false},
        {false, false, false, false, false},
        {true,  false, false, false, false}
    };

    /*
     * ===== Step 17a: A seed from a date =====
     *
     * Turn a date into a number, so the same date always gives the same seed (and so the same grid).
     *
     * Example:  2026-10-07  ->  20261007      2026-12-25  ->  20261225
     *
     * Tools: date.getYear(), date.getMonthValue(), date.getDayOfMonth() each return an int.
     *        Think of it as building the number year, then month, then day: 2026 * 10000 + 10 * 100 + 7.
     *
     * Related LeetCode: 7. Reverse Integer, 9. Palindrome Number (building numbers digit by digit)
     */
    static long seedForDate(LocalDate date) {
        return date.getYear() * 10000 + date.getMonthValue() * 100 + date.getDayOfMonth();
    }

    // Design pass: each difficulty's daily gets its own seed (date seed + one digit), so its own grid.
    // Example:  2026-10-07 easy -> 202610071, medium -> 202610072, hard -> 202610073, challenge -> 202610074
    static long dailySeed(LocalDate date, String difficulty) {
        int digit = difficulty.equals("easy") ? 1 : difficulty.equals("medium") ? 2 : difficulty.equals("hard") ? 3 : 4;
        return seedForDate(date) * 10 + digit;
    }

    /*
     * ===== Step 17b: Where a daily puzzle lives =====
     *
     * The file for one date and difficulty, inside `folder`.
     *
     * Example:  dailyFile(puzzles/daily, 2026-10-07, "hard")  ->  puzzles/daily/2026-10-07-hard.json
     *
     * Tools: date.toString() gives "2026-10-07". folder.resolve("name.json") gives the file inside the folder.
     */
    static Path dailyFile(Path folder, LocalDate date, String difficulty) {
        String fileName = date.toString() + "-" + difficulty + ".json";
        return folder.resolve(fileName); 
    }

    /*
     * ===== Step 17c: Get today's puzzle, generating it only once =====
     *
     * If the file for this date and difficulty already exists, return what's in it (no API call!).
     * Otherwise: generate it with generateDaily(...), save the JSON to the file, then return it.
     *
     * This "check the saved copy first" idea is the same as matchCache in Step 13b, but the notebook
     * is a file on disk, so it survives restarting the program.
     *
     * Tools:
     *   Files.exists(path)                   -> true if the file is there
     *   Files.readString(path)               -> the whole file as a String
     *   Files.createDirectories(folder)      -> makes the folder (and parents) if missing; harmless if it exists
     *   Files.writeString(path, text)        -> saves text to the file
     *
     * Constraints:
     *   - Never call generateDaily if the file already exists (that would cost money and change the clues).
     *
     * Related LeetCode: 146. LRU Cache (serve from a cache, compute and store on a miss)
     */
    // "synchronized" = only one request at a time may run this. On the website, two players could ask for a new
    // daily at the same moment; without it, both would call Claude and get DIFFERENT clues for the same daily.
    static synchronized String getDaily(Path folder, LocalDate date, String difficulty,
                                        Map<Integer, List<String>> wordsByLength) throws IOException {
        Path file = dailyFile(folder, date, difficulty);

        // Saved already? Serve the saved copy: free, instant, and identical for everyone
        if (Files.exists(file)) {
            return Files.readString(file);
        }

        // First request for this date + difficulty: generate once (one API call), save, return
        String json = generateDaily(date, difficulty, wordsByLength, recentDailyAnswers(folder, date, difficulty));
        Files.createDirectories(folder);
        Files.writeString(file, json);
        return json;
    }

    // ---------------------------------------------------------------------------------------
    // Already done for you
    // ---------------------------------------------------------------------------------------

    // Fills the SHAPE grid using a seed. The same seed always gives the same grid.
    // "synchronized" (Step 26): the solver shares App's cache, counters and Trie, which aren't safe for two
    // requests to change at the same moment. Filling a grid takes well under a second, so taking turns is fine.
    static synchronized char[][] buildGrid(long seed, Map<Integer, List<String>> wordsByLength) {
        return buildGrid(seed, wordsByLength, Set.of());
    }

    // The same, staying away from the words in `avoid` (answers of recent puzzles, see "Fewer repeats" below).
    // Simply banning them doesn't work: the dense 5x5 shape often has no fill without a few "glue" words like
    // REST, and the search for one can take minutes. So it fills up to GRID_TRIES grids (seed, seed+1, ...; each
    // takes a few milliseconds) and keeps the one with the fewest avoided answers.
    static final int GRID_TRIES = 30;
    static synchronized char[][] buildGrid(long seed, Map<Integer, List<String>> wordsByLength, Set<String> avoid) {
        return buildGrid(seed, wordsByLength, avoid, "");
    }
    // A campaign lesson can also ask for grids that suit it (favors: see Lesson.favorScore): then every try is
    // scored as (lesson fit x 2 - repeats) and the best one is kept
    static synchronized char[][] buildGrid(long seed, Map<Integer, List<String>> wordsByLength, Set<String> avoid, String favors) {
        int size = SHAPE.length;
        char[][] best = null;
        int bestRepeats = Integer.MAX_VALUE, bestScore = Integer.MIN_VALUE;
        boolean lesson = favors != null && !favors.isEmpty();
        for (int attempt = 0; attempt < (avoid.isEmpty() && !lesson ? 1 : GRID_TRIES) && (lesson || bestRepeats > 0); attempt++) {
            char[][] grid = new char[size][size];
            for (char[] row : grid) {
                Arrays.fill(row, '.');
            }
            App.solve(new ArrayList<>(Slot.findAllSlots(SHAPE)), grid, wordsByLength, new HashSet<>(), new Random(seed + attempt));
            int repeats = 0;
            List<String> answers = new ArrayList<>();
            for (Slot slot : Slot.findAllSlots(SHAPE)) {
                String answer = slot.getPattern(grid);
                answers.add(answer);
                if (avoid.contains(answer) || App.sharesRoot(answer, avoid)) repeats++;
            }
            int score = lesson ? Lesson.favorScore(favors, answers) * 2 - repeats : -repeats;
            if (score > bestScore) {
                best = grid;
                bestRepeats = repeats;
                bestScore = score;
            }
        }
        return best;
    }

    // Challenge mode: a 7x7 grid with random symmetric black squares (see ChallengeGrid). "synchronized" for the
    // same reason as buildGrid: the solver shares App's caches.
    static synchronized ChallengeGrid.Filled buildChallenge(long seed, Map<Integer, List<String>> mediumWords, Map<Integer, List<String>> hardWords) {
        return ChallengeGrid.fill(seed, mediumWords, hardWords);
    }
    static synchronized ChallengeGrid.Filled buildChallenge(long seed, int size, Map<Integer, List<String>> first,
                                                            Map<Integer, List<String>> second, Set<String> avoid) {
        return ChallengeGrid.fill(seed, size, first, second, avoid);
    }

    // Medium's word list, loaded once: challenges use medium words first (see ChallengeGrid.fill)
    private static Map<Integer, List<String>> mediumWords = null;
    private static synchronized Map<Integer, List<String>> mediumWords() {
        if (mediumWords == null) {
            try {
                mediumWords = App.loadWordsFor("medium");
            } catch (java.io.IOException e) {
                throw new java.io.UncheckedIOException(e);
            }
        }
        return mediumWords;
    }

    // A challenge puzzle as JSON. Its clues are written at the medium level: the bigger grid and its longer,
    // less common words are the challenge. COSTS MONEY (one API call).
    static String generateChallenge(long seed, String mode, Map<Integer, List<String>> wordsByLength, Set<String> avoid) {
        return generateBig(seed, mode, "challenge", ChallengeGrid.sizeFor(seed), wordsByLength, avoid);
    }

    // A Challenge-style grid of a chosen size as JSON. "challenge": medium words first and medium clues.
    // "expert" (the later campaign worlds): Hard's words and hard clues. wordsByLength = Hard's list.
    // COSTS MONEY (one API call).
    static String generateBig(long seed, String mode, String difficulty, int size,
                              Map<Integer, List<String>> wordsByLength, Set<String> avoid) {
        return generateBig(seed, mode, difficulty, size, wordsByLength, avoid, "", "");
    }
    // the same for a campaign lesson: favors picks the best of a few grids for the lesson, focus goes to the clue writer
    static final int BIG_LESSON_TRIES = 5;
    static String generateBig(long seed, String mode, String difficulty, int size,
                              Map<Integer, List<String>> wordsByLength, Set<String> avoid, String favors, String focus) {
        return generateBig(seed, mode, difficulty, size, wordsByLength, avoid, favors, focus, true);
    }
    // withClues = false: just the grid, no clues and NO Claude call (a boss's own board: nobody reads its clues)
    static String generateBig(long seed, String mode, String difficulty, int size,
                              Map<Integer, List<String>> wordsByLength, Set<String> avoid, String favors, String focus, boolean withClues) {
        boolean expert = difficulty.equals("expert");
        ChallengeGrid.Filled filled = null;
        List<String> answers = null;
        int bestScore = Integer.MIN_VALUE;
        for (int attempt = 0; attempt < (favors.isEmpty() ? 1 : BIG_LESSON_TRIES); attempt++) {
            ChallengeGrid.Filled f = buildChallenge(seed + attempt * 1000L, size, expert ? wordsByLength : mediumWords(), wordsByLength, avoid);
            List<String> list = new ArrayList<>();
            for (Slot slot : Slot.findAllSlots(f.blackSquares())) {
                list.add(slot.getPattern(f.grid()));
            }
            int score = Lesson.favorScore(favors, list);
            if (score > bestScore) { filled = f; answers = list; bestScore = score; }
        }
        ClueWriter.ClueSet clues = withClues ? ClueWriter.writeClues(answers, expert ? "hard" : "medium", focus) : NO_CLUES;
        return Puzzle.create(filled.blackSquares(), filled.grid(), clues, mode, seed, difficulty).toJson();
    }

    // A normal 5x5 puzzle as JSON. COSTS MONEY (one API call).
    static String generateSmall(long seed, String mode, String difficulty, Map<Integer, List<String>> wordsByLength, Set<String> avoid) {
        return generateSmall(seed, mode, difficulty, wordsByLength, avoid, "", "");
    }
    static String generateSmall(long seed, String mode, String difficulty, Map<Integer, List<String>> wordsByLength, Set<String> avoid,
                                String favors, String focus) {
        return generateSmall(seed, mode, difficulty, wordsByLength, avoid, favors, focus, true);
    }
    static String generateSmall(long seed, String mode, String difficulty, Map<Integer, List<String>> wordsByLength, Set<String> avoid,
                                String favors, String focus, boolean withClues) {
        char[][] grid = buildGrid(seed, wordsByLength, avoid, favors);
        List<String> answers = new ArrayList<>();
        for (Slot slot : Slot.findAllSlots(SHAPE)) {
            answers.add(slot.getPattern(grid));
        }
        ClueWriter.ClueSet clues = withClues ? ClueWriter.writeClues(answers, difficulty, focus) : NO_CLUES;
        return Puzzle.create(SHAPE, grid, clues, mode, seed, difficulty).toJson();
    }
    // an empty clue set: every entry gets a blank clue (the user, 2026-10-09: don't pay for the boss's clues)
    static final ClueWriter.ClueSet NO_CLUES = new ClueWriter.ClueSet(List.of());

    // ---------------------------------------------------------------------------------------
    // Fewer repeats (added by Claude at the user's request): the solver likes some words far more than others
    // (REST was in 1 of every 3 easy grids, ERROR in 1 of 4), so a new puzzle stays away from the answers of
    // recent puzzles: the last few days' dailies, the campaign levels just before it, the last Unlimited puzzles.
    // ---------------------------------------------------------------------------------------
    private static final Pattern ANSWER = Pattern.compile("\"answer\"\\s*:\\s*\"([A-Z]+)\"");

    // Every answer in a puzzle's JSON
    static Set<String> answersIn(String json) {
        Set<String> answers = new HashSet<>();
        Matcher m = ANSWER.matcher(json);
        while (m.find()) answers.add(m.group(1));
        return answers;
    }
    // Every answer in these saved puzzle files (files that don't exist are skipped)
    static Set<String> answersIn(List<Path> files) throws IOException {
        Set<String> answers = new HashSet<>();
        for (Path file : files) {
            if (Files.exists(file)) answers.addAll(answersIn(Files.readString(file)));
        }
        return answers;
    }

    static final String[] DAILY_KINDS = {"easy", "medium", "hard", "challenge"};
    static final int DAYS_BACK = 3;

    // A daily stays away from the other dailies of its day and of the 3 days before
    static Set<String> recentDailyAnswers(Path folder, LocalDate date, String difficulty) throws IOException {
        List<Path> files = new ArrayList<>();
        for (int back = 0; back <= DAYS_BACK; back++) {
            for (String kind : DAILY_KINDS) {
                if (back == 0 && kind.equals(difficulty)) continue;
                files.add(dailyFile(folder, date.minusDays(back), kind));
            }
        }
        return answersIn(files);
    }

    // Unlimited: the answers of the last few puzzles made (kept in memory; a restart forgets them)
    static final int UNLIMITED_MEMORY = 12;
    private static final Deque<Set<String>> recentUnlimited = new ArrayDeque<>();
    private static synchronized Set<String> recentUnlimitedAnswers() {
        Set<String> all = new HashSet<>();
        for (Set<String> answers : recentUnlimited) all.addAll(answers);
        return all;
    }
    private static synchronized void rememberUnlimited(String json) {
        recentUnlimited.addLast(answersIn(json));
        while (recentUnlimited.size() > UNLIMITED_MEMORY) recentUnlimited.removeFirst();
    }

    // Makes a brand-new daily puzzle as JSON: grid from the date, clues from Claude. COSTS MONEY (one API call).
    static String generateDaily(LocalDate date, String difficulty, Map<Integer, List<String>> wordsByLength, Set<String> avoid) {
        long seed = dailySeed(date, difficulty);
        if (difficulty.equals("challenge")) return generateChallenge(seed, "daily", wordsByLength, avoid);
        return generateSmall(seed, "daily", difficulty, wordsByLength, avoid);
    }

    // Campaign mode: where the levels are saved (puzzles/campaign/garden-3.json)
    static final Path CAMPAIGN_FOLDER = Path.of(System.getenv().getOrDefault("PUZZLE_DIR", "puzzles"), "campaign");

    // A campaign level, generated once and saved, exactly like getDaily (same reasons: identical for everyone,
    // and Claude is only paid once per level). The caller checks that the world and level are real.
    // boss = the boss's own board in a boss fight (level 5 only): a second puzzle at the same difficulty, for the bot
    // variant = a reroll (0 = the level's first puzzle): a new try after losing gets a new puzzle (Campaign.VARIANTS)
    static synchronized String getCampaign(Path folder, Campaign.Section section, int level, boolean boss,
                                           Map<Integer, List<String>> wordsByLength) throws IOException {
        return getCampaign(folder, section, level, boss, 0, wordsByLength);
    }
    static synchronized String getCampaign(Path folder, Campaign.Section section, int level, boolean boss, int variant,
                                           Map<Integer, List<String>> wordsByLength) throws IOException {
        Path file = variantFile(campaignFile(folder, section, level, boss), variant);
        if (Files.exists(file)) {
            return Files.readString(file);
        }
        String difficulty = Campaign.difficulty(section, level);
        long seed = Campaign.seed(section, boss ? level + 1 : level, variant);    // the boss's board: the next seed along
        Set<String> avoid = new HashSet<>(recentCampaignAnswers(folder, section, level, boss));
        avoid.addAll(answersIn(earlierVariants(campaignFile(folder, section, level, boss), variant)));   // a reroll is really new
        // every level is a lesson (Lesson.java): a grid that suits it, and clues that train its skill
        String favors = Lesson.favors(section.world(), level), focus = Lesson.clueFocus(section.world(), level);
        String json = Campaign.bigGrid(difficulty)
                ? generateBig(seed, "campaign", difficulty, Campaign.size(section, level), wordsByLength, avoid, favors, focus, !boss)
                : generateSmall(seed, "campaign", difficulty, wordsByLength, avoid, favors, focus, !boss);     // the boss's own board: no clues
        Files.createDirectories(folder);
        Files.writeString(file, json);
        return json;
    }

    // A boss's later phases (phase 2-5, bigger grids, see Campaign.phases), saved as puzzles/campaign/garden-5-p2.json.
    // Each stays away from the boss's earlier puzzles in the same fight and the boards before them.
    static synchronized String getBossPhase(Path folder, Campaign.Section section, int phase, int variant,
                                            Map<Integer, List<String>> wordsByLength) throws IOException {
        Path file = variantFile(phaseFile(folder, section, phase), variant);
        if (Files.exists(file)) {
            return Files.readString(file);
        }
        Set<String> avoid = new HashSet<>(recentCampaignAnswers(folder, section, Campaign.LEVELS, true));
        List<Path> before = new ArrayList<>(List.of(variantFile(campaignFile(folder, section, Campaign.LEVELS, false), variant),
                variantFile(campaignFile(folder, section, Campaign.LEVELS, true), variant)));
        for (int p = 2; p < phase; p++) before.add(variantFile(phaseFile(folder, section, p), variant));
        before.addAll(earlierVariants(phaseFile(folder, section, phase), variant));
        avoid.addAll(answersIn(before));
        long seed = Campaign.seed(section, Campaign.LEVELS + phase, variant);
        String json = generateBig(seed, "campaign", Campaign.phaseDifficulty(section, phase), Campaign.phaseSize(section, phase), wordsByLength, avoid,
                "", Lesson.clueFocus(section.world(), Campaign.LEVELS));
        Files.createDirectories(folder);
        Files.writeString(file, json);
        return json;
    }
    static String getBossPhase2(Path folder, Campaign.Section section, Map<Integer, List<String>> wordsByLength) throws IOException {
        return getBossPhase(folder, section, 2, 0, wordsByLength);
    }

    // ---------------------------------------------------------------------------------------
    // Daily Boss and Unlimited Boss (the user, 2026-10-09: "options daily boss and unlimited boss, a random boss"):
    // a boss fight outside the campaign, with the boss's campaign puzzle settings (one phase).
    // ---------------------------------------------------------------------------------------
    // Today's boss: 4 bosses along the map each day, so it's never the same two days running and every boss
    // comes round once every 15 days
    static Campaign.Section dailyBossSection(LocalDate date) {
        int n = Campaign.SECTIONS.size();
        return Campaign.SECTIONS.get((int) Math.floorMod(date.toEpochDay() * 4, (long) n));
    }
    // the daily boss's puzzles: yours (clues by Claude, once a day for everyone) and the boss's own (no clues, free)
    static synchronized String getDailyBoss(Path folder, LocalDate date, boolean bossBoard, Map<Integer, List<String>> wordsByLength) throws IOException {
        Path file = folder.resolve(date + "-boss" + (bossBoard ? "-board" : "") + ".json");
        if (Files.exists(file)) {
            return Files.readString(file);
        }
        Campaign.Section section = dailyBossSection(date);
        long seed = seedForDate(date) * 10 + (bossBoard ? 6 : 5);       // the dailies use 1-4
        String json = bossPuzzle(seed, section, wordsByLength, !bossBoard);
        Files.createDirectories(folder);
        Files.writeString(file, json);
        return json;
    }
    // a boss puzzle at a section's boss settings (Unlimited Boss calls this with a random seed; not saved)
    static String bossPuzzle(long seed, Campaign.Section section, Map<Integer, List<String>> wordsByLength, boolean withClues) {
        String difficulty = section.bossDifficulty();
        return Campaign.bigGrid(difficulty)
                ? generateBig(seed, "campaign", difficulty, section.bossSize(), wordsByLength, new HashSet<>(), "", "", withClues)
                : generateSmall(seed, "campaign", difficulty, wordsByLength, new HashSet<>(), "", "", withClues);
    }

    static Path campaignFile(Path folder, Campaign.Section section, int level, boolean boss) {
        return folder.resolve(section.world() + "-" + level + (boss ? "-boss" : "") + ".json");
    }
    static Path phaseFile(Path folder, Campaign.Section section, int phase) {
        return folder.resolve(section.world() + "-" + Campaign.LEVELS + "-p" + phase + ".json");
    }
    // a reroll's file: garden-3.json -> garden-3-v2.json (try 0 keeps the plain name)
    static Path variantFile(Path file, int variant) {
        if (variant == 0) return file;
        String name = file.getFileName().toString();
        return file.resolveSibling(name.substring(0, name.length() - ".json".length()) + "-v" + variant + ".json");
    }
    // the same puzzle's earlier tries (so a reroll doesn't repeat their answers)
    static List<Path> earlierVariants(Path file, int variant) {
        List<Path> list = new ArrayList<>();
        for (int k = 0; k < variant; k++) list.add(variantFile(file, k));
        return list;
    }

    // A campaign level stays away from the answers of the 12 boards before it on the map (bosses' boards included)
    static final int CAMPAIGN_BACK = 12;
    static Set<String> recentCampaignAnswers(Path folder, Campaign.Section section, int level, boolean boss) throws IOException {
        List<Path> all = new ArrayList<>();
        int here = 0;
        for (Campaign.Section s : Campaign.SECTIONS) {
            for (int l = 1; l <= Campaign.LEVELS; l++) {
                if (s == section && l == level) here = all.size() + (boss ? 1 : 0);
                all.add(campaignFile(folder, s, l, false));
                if (l == Campaign.LEVELS) all.add(campaignFile(folder, s, l, true));
            }
        }
        return answersIn(all.subList(Math.max(0, here - CAMPAIGN_BACK), here));
    }

    // Makes a brand-new unlimited puzzle as JSON (not saved: every unlimited puzzle is new). COSTS MONEY (one API call).
    static String generateUnlimited(long seed, String difficulty, Map<Integer, List<String>> wordsByLength) {
        Set<String> avoid = recentUnlimitedAnswers();
        String json = difficulty.equals("challenge")
                ? generateChallenge(seed, "unlimited", wordsByLength, avoid)
                : generateSmall(seed, "unlimited", difficulty, wordsByLength, avoid);
        rememberUnlimited(json);
        return json;
    }
}
