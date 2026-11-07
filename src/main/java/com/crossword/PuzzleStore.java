package com.crossword;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/*
 * Puzzles: making them and saving them.
 *
 * The daily puzzle must be IDENTICAL for everyone, but Claude writes different clues on every call
 * (and every call costs money). So each daily is written by Claude only the FIRST time it's asked for,
 * then saved as a file and served from the file forever after.
 *
 * There are FIVE dailies every day: one per difficulty (easy, medium, hard), each with its own grid
 * (seed from date + difficulty), its own word list (easier words on easy) and its own clues, plus the Challenge and the Boss.
 *
 *   puzzles/daily/2026-10-07-easy.json     <- three different
 *   puzzles/daily/2026-10-07-medium.json   <- puzzles
 *   puzzles/daily/2026-10-07-hard.json
 */
public class PuzzleStore {

    private static final Logger LOG = LoggerFactory.getLogger(PuzzleStore.class);

    // Where daily puzzles are saved: puzzles/daily inside the project folder (ignored by git: it's generated data).
    // Online, the host sets PUZZLE_DIR to a disk that survives restarts; otherwise a restart would lose
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

    // A date as a number, so the same date always gives the same seed (and grid): 2026-10-07 -> 20261007
    static long seedForDate(LocalDate date) {
        return date.getYear() * 10000 + date.getMonthValue() * 100 + date.getDayOfMonth();
    }

    // Each difficulty's daily gets its own seed (date seed + one digit), so its own grid.
    // Example:  2026-10-07 easy -> 202610071, medium -> 202610072, hard -> 202610073, challenge -> 202610074
    static long dailySeed(LocalDate date, String difficulty) {
        int digit = difficulty.equals("easy") ? 1 : difficulty.equals("medium") ? 2 : difficulty.equals("hard") ? 3 : 4;
        return seedForDate(date) * 10 + digit;
    }

    // The file for one date and difficulty: puzzles/daily/2026-10-07-hard.json
    static Path dailyFile(Path folder, LocalDate date, String difficulty) {
        String fileName = date.toString() + "-" + difficulty + ".json";
        return folder.resolve(fileName);
    }

    /*
     * A daily for a difficulty: read from its saved file if there is one (no API call), else the one shipped with
     * the app, else made once (Claude writes the clues), saved and returned. Never made twice: that would cost
     * money and change the clues.
     */
    static String getDaily(Path folder, LocalDate date, String difficulty, Map<Integer, List<String>> wordsByLength) throws IOException {
        Path file = dailyFile(folder, date, difficulty);
        String saved = readSaved(file);
        if (saved != null) return saved;
        String shipped = shippedDaily(file.getFileName().toString());
        if (shipped != null) return shipped;
        return generateOnce(file, () -> generateDaily(date, difficulty, wordsByLength, recentDailyAnswers(folder, date, difficulty)));
    }

    // ---------------------------------------------------------------------------------------
    // Making a puzzle once, safely
    //   - Reads never wait: a saved or shipped puzzle is served without any lock.
    //   - Each puzzle has its own lock, so two players asking for the same new daily share one generation
    //     (and get the same clues), while other puzzles carry on.
    //   - A failed generation (Claude down, no key, clues that failed the checks) is remembered for a couple of
    //     minutes: requests in that time get Unavailable (HTTP 503 with Retry-After) instead of paying again.
    //   - Files are written atomically (a temporary file, then a rename), so a crash can't leave half a puzzle,
    //     and a damaged file is moved aside and made again rather than served.
    // ---------------------------------------------------------------------------------------
    static final long FAILURE_PAUSE_MS = 120_000;
    private static final ConcurrentHashMap<Path, Object> LOCKS = new ConcurrentHashMap<>();
    private static final ConcurrentHashMap<Path, Long> FAILED_UNTIL = new ConcurrentHashMap<>();
    // puzzles made while their file couldn't be written: kept here so this server still serves the same one
    private static final ConcurrentHashMap<Path, String> UNSAVED = new ConcurrentHashMap<>();

    // Thrown when a puzzle can't be made right now; the controller answers 503 with Retry-After
    static class Unavailable extends RuntimeException {
        final long retryAfterSeconds;
        Unavailable(long retryAfterSeconds) {
            super("puzzle not available yet, try again in " + retryAfterSeconds + " s");
            this.retryAfterSeconds = retryAfterSeconds;
        }
    }

    static String generateOnce(Path file, Callable<String> make) throws IOException {
        String saved = readSaved(file);
        if (saved != null) return saved;
        synchronized (LOCKS.computeIfAbsent(file, k -> new Object())) {
            saved = readSaved(file);                       // made by another request while this one waited
            if (saved != null) return saved;
            long now = System.currentTimeMillis();
            Long until = FAILED_UNTIL.get(file);
            if (until != null && now < until) throw new Unavailable((until - now) / 1000 + 1);
            String json;
            try {
                json = make.call();
            } catch (Exception e) {
                FAILED_UNTIL.put(file, now + FAILURE_PAUSE_MS);
                LOG.warn("Couldn't make {} ({}: {}); pausing {} s before trying again", file.getFileName(),
                        e.getClass().getSimpleName(), e.getMessage(), FAILURE_PAUSE_MS / 1000);
                throw new Unavailable(FAILURE_PAUSE_MS / 1000);
            }
            FAILED_UNTIL.remove(file);
            try {
                save(file, json);
            } catch (IOException e) {
                LOG.error("Made {} but couldn't save it ({}); serving it from memory", file.getFileName(), e.getMessage());
                UNSAVED.put(file, json);
            }
            LOG.info("Made {} (Claude so far: {} calls, about ${})", file.getFileName(), ClueWriter.CALLS.get(),
                    String.format("%.3f", ClueWriter.estimatedCost()));
            return json;
        }
    }

    // The saved puzzle in a file, or null if there's none. A damaged file is moved aside (name.damaged) and
    // treated as missing, so it's made again instead of breaking the page.
    static String readSaved(Path file) throws IOException {
        String kept = UNSAVED.get(file);
        if (kept != null) return kept;
        if (!Files.exists(file)) return null;
        String json = Files.readString(file);
        if (looksLikePuzzle(json)) return json;
        Path aside = file.resolveSibling(file.getFileName() + ".damaged");
        LOG.error("{} is damaged; moving it to {}", file.getFileName(), aside.getFileName());
        Files.move(file, aside, StandardCopyOption.REPLACE_EXISTING);
        return null;
    }

    // A quick check that a file holds a whole puzzle (a cut-off write or an empty file doesn't)
    static boolean looksLikePuzzle(String json) {
        String t = json == null ? "" : json.trim();
        return t.startsWith("{") && t.endsWith("}") && t.contains("\"solution\"") && t.contains("\"across\"") && t.contains("\"down\"");
    }

    // Writes a file atomically: a temporary file in the same folder, then a rename over the old one
    static void save(Path file, String json) throws IOException {
        Path folder = file.toAbsolutePath().getParent();
        Files.createDirectories(folder);
        Path tmp = Files.createTempFile(folder, file.getFileName().toString(), ".tmp");
        try {
            Files.writeString(tmp, json);
            try {
                Files.move(tmp, file, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            } catch (AtomicMoveNotSupportedException e) {
                Files.move(tmp, file, StandardCopyOption.REPLACE_EXISTING);
            }
        } finally {
            Files.deleteIfExists(tmp);
        }
    }

    // for the tests: forget remembered failures and puzzles kept in memory
    static void resetForTests() {
        FAILED_UNTIL.clear();
        UNSAVED.clear();
    }

    // ---------------------------------------------------------------------------------------
    // Filling grids
    // ---------------------------------------------------------------------------------------

    // Fills the SHAPE grid using a seed. The same seed always gives the same grid.
    // "synchronized": the solver shares App's cache, counters and Trie, which aren't safe for two
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
        return buildChallenge(seed, size, first, second, avoid, 0);
    }
    static synchronized ChallengeGrid.Filled buildChallenge(long seed, int size, Map<Integer, List<String>> first,
                                                            Map<Integer, List<String>> second, Set<String> avoid, int firstOnly) {
        return ChallengeGrid.fill(seed, size, first, second, avoid, firstOnly);
    }

    // Easier words in the campaign. Every campaign
    // puzzle (and the Daily Boss, which uses the campaign's settings) fills from the word list one step
    // easier than its difficulty; the clues stay at the level's own difficulty.
    //   medium 5x5:  Easy's words (was Medium's)
    //   challenge:   Easy's words first, then Medium's (was Medium's, then Hard's)
    //   expert:      Medium's words first, then Hard's (was Hard's)
    // A big grid tries CAMPAIGN_FIRST_ONLY board patterns with the easier list alone before it may use the other.
    static final int CAMPAIGN_FIRST_ONLY = 10;
    private static Map<Integer, List<String>> easyWords = null;
    private static synchronized Map<Integer, List<String>> easyWords() {
        if (easyWords == null) {
            try {
                easyWords = App.loadWordsFor("easy");
            } catch (java.io.IOException e) {
                throw new java.io.UncheckedIOException(e);
            }
        }
        return easyWords;
    }
    // a small (5x5) campaign puzzle's words: one step easier than its difficulty (easy stays easy)
    static Map<Integer, List<String>> campaignSmallWords(String difficulty, Map<Integer, List<String>> wordsByLength) {
        return difficulty.equals("medium") ? easyWords() : wordsByLength;
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
    // (Campaign puzzles use easier words than these since 2026-10-10: see "Easier words in the campaign" above.)
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
        boolean expert = difficulty.equals("expert"), campaign = mode.equals("campaign");
        // which words fill it: see "Easier words in the campaign" above (the dailies are unchanged)
        Map<Integer, List<String>> first = campaign ? (expert ? mediumWords() : easyWords()) : (expert ? wordsByLength : mediumWords());
        Map<Integer, List<String>> second = campaign && !expert ? mediumWords() : wordsByLength;
        ChallengeGrid.Filled filled = null;
        List<String> answers = null;
        int bestScore = Integer.MIN_VALUE;
        for (int attempt = 0; attempt < (favors.isEmpty() ? 1 : BIG_LESSON_TRIES); attempt++) {
            ChallengeGrid.Filled f = buildChallenge(seed + attempt * 1000L, size, first, second, avoid, campaign ? CAMPAIGN_FIRST_ONLY : 0);
            List<String> list = new ArrayList<>();
            for (Slot slot : Slot.findAllSlots(f.blackSquares())) {
                list.add(slot.getPattern(f.grid()));
            }
            int score = Lesson.favorScore(favors, list);
            if (score > bestScore) { filled = f; answers = list; bestScore = score; }
        }
        // (a Challenge or Expert grid: Sonnet 5.5 writes its clues, see ClueWriter.draftModel)
        ClueWriter.ClueSet clues = withClues ? ClueWriter.writeClues(answers, expert ? "hard" : "medium", focus, true) : NO_CLUES;
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
        return generateSmall(seed, mode, difficulty, wordsByLength, avoid, favors, focus, withClues, false);
    }
    // strong = a boss puzzle: Sonnet 5.5 writes its clues (ClueWriter.draftModel)
    static String generateSmall(long seed, String mode, String difficulty, Map<Integer, List<String>> wordsByLength, Set<String> avoid,
                                String favors, String focus, boolean withClues, boolean strong) {
        char[][] grid = buildGrid(seed, wordsByLength, avoid, favors);
        List<String> answers = new ArrayList<>();
        for (Slot slot : Slot.findAllSlots(SHAPE)) {
            answers.add(slot.getPattern(grid));
        }
        ClueWriter.ClueSet clues = withClues ? ClueWriter.writeClues(answers, difficulty, focus, strong) : NO_CLUES;
        return Puzzle.create(SHAPE, grid, clues, mode, seed, difficulty).toJson();
    }
    // an empty clue set: every entry gets a blank clue (the boss's own board doesn't need clues, so it's free)
    static final ClueWriter.ClueSet NO_CLUES = new ClueWriter.ClueSet(List.of());

    // ---------------------------------------------------------------------------------------
    // Fewer repeats: the solver likes some words far more than others
    // (REST was in 1 of every 3 easy grids, ERROR in 1 of 4), so a new puzzle stays away from the answers of
    // recent puzzles: the last few days' dailies and the campaign levels just before it.
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
    static final int DAYS_BACK = 30;

    // A daily stays away from the answers of the other dailies of its day and of the 30 days before, saved or shipped
    static Set<String> recentDailyAnswers(Path folder, LocalDate date, String difficulty) throws IOException {
        Set<String> answers = new HashSet<>();
        for (int back = 0; back <= DAYS_BACK; back++) {
            for (String kind : DAILY_KINDS) {
                if (back == 0 && kind.equals(difficulty)) continue;
                Path file = dailyFile(folder, date.minusDays(back), kind);
                String json = readSaved(file);
                if (json == null) json = shippedDaily(file.getFileName().toString());
                if (json != null) answers.addAll(answersIn(json));
            }
        }
        return answers;
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
    static String getCampaign(Path folder, Campaign.Section section, int level, boolean boss,
                              Map<Integer, List<String>> wordsByLength) throws IOException {
        return getCampaign(folder, section, level, boss, 0, wordsByLength);
    }
    // The campaign's puzzle pool: 25 ready-made puzzles per level, made ahead of time to the same
    // settings and shipped inside the app (src/main/resources/campaign/<world>-<level>[-boss|-pN]-v<k>.json), so
    // nothing has to be generated (or paid for) while people play. null when a puzzle isn't in the pool.
    static String poolPuzzle(String name, int variant) throws IOException {
        try (InputStream in = PuzzleStore.class.getResourceAsStream("/campaign/" + name + "-v" + variant + ".json")) {
            return in == null ? null : new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
    // a daily made ahead of time and shipped in the app (src/main/resources/daily/<date>-<kind>.json)
    static String shippedDaily(String fileName) throws IOException {
        try (InputStream in = PuzzleStore.class.getResourceAsStream("/daily/" + fileName)) {
            return in == null ? null : new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
    static String poolName(Campaign.Section section, int level, boolean boss) {
        return section.world() + "-" + level + (boss ? "-boss" : "");
    }
    static String poolPhaseName(Campaign.Section section, int phase) {
        return section.world() + "-" + Campaign.LEVELS + "-p" + phase;
    }

    // A level's puzzle from the shipped pool. A variant taken out of the pool (one whose answers didn't suit a
    // family game) falls through to the next one, so every variant number still gets a puzzle.
    static String poolPuzzleOrNext(String name, int variant) throws IOException {
        for (int k = 0; k < Campaign.VARIANTS; k++) {
            String json = poolPuzzle(name, (variant + k) % Campaign.VARIANTS);
            if (json != null) return json;
        }
        return null;
    }

    static String getCampaign(Path folder, Campaign.Section section, int level, boolean boss, int variant,
                              Map<Integer, List<String>> wordsByLength) throws IOException {
        String pooled = poolPuzzleOrNext(poolName(section, level, boss), variant);
        if (pooled != null) return pooled;
        Path file = variantFile(campaignFile(folder, section, level, boss), variant);
        return generateOnce(file, () -> makeCampaign(folder, section, level, boss, variant, wordsByLength));
    }
    private static String makeCampaign(Path folder, Campaign.Section section, int level, boolean boss, int variant,
                                       Map<Integer, List<String>> wordsByLength) throws IOException {
        String difficulty = Campaign.difficulty(section, level);
        long seed = Campaign.seed(section, boss ? level + 1 : level, variant);    // the boss's board: the next seed along
        Set<String> avoid = new HashSet<>(recentCampaignAnswers(folder, section, level, boss));
        avoid.addAll(answersIn(earlierVariants(campaignFile(folder, section, level, boss), variant)));   // a reroll is really new
        // every level is a lesson (Lesson.java): a grid that suits it, and clues that train its skill
        String favors = Lesson.favors(section.world(), level), focus = Lesson.clueFocus(section.world(), level);
        return Campaign.bigGrid(difficulty)
                ? generateBig(seed, "campaign", difficulty, Campaign.size(section, level), wordsByLength, avoid, favors, focus, !boss)
                : generateSmall(seed, "campaign", difficulty, campaignSmallWords(difficulty, wordsByLength), avoid, favors, focus, !boss, level == Campaign.LEVELS);     // the boss's own board: no clues
    }

    // A boss's later phases (phase 2-5, bigger grids, see Campaign.phases), saved as puzzles/campaign/garden-5-p2.json.
    // Each stays away from the boss's earlier puzzles in the same fight and the boards before them.
    static String getBossPhase(Path folder, Campaign.Section section, int phase, int variant,
                               Map<Integer, List<String>> wordsByLength) throws IOException {
        String pooled = poolPuzzleOrNext(poolPhaseName(section, phase), variant);
        if (pooled != null) return pooled;
        Path file = variantFile(phaseFile(folder, section, phase), variant);
        return generateOnce(file, () -> makeBossPhase(folder, section, phase, variant, wordsByLength));
    }
    private static String makeBossPhase(Path folder, Campaign.Section section, int phase, int variant,
                                        Map<Integer, List<String>> wordsByLength) throws IOException {
        Set<String> avoid = new HashSet<>(recentCampaignAnswers(folder, section, Campaign.LEVELS, true));
        List<Path> before = new ArrayList<>(List.of(variantFile(campaignFile(folder, section, Campaign.LEVELS, false), variant),
                variantFile(campaignFile(folder, section, Campaign.LEVELS, true), variant)));
        for (int p = 2; p < phase; p++) before.add(variantFile(phaseFile(folder, section, p), variant));
        before.addAll(earlierVariants(phaseFile(folder, section, phase), variant));
        avoid.addAll(answersIn(before));
        long seed = Campaign.seed(section, Campaign.LEVELS + phase, variant);
        return generateBig(seed, "campaign", Campaign.phaseDifficulty(section, phase), Campaign.phaseSize(section, phase), wordsByLength, avoid,
                "", Lesson.clueFocus(section.world(), Campaign.LEVELS));
    }
    static String getBossPhase2(Path folder, Campaign.Section section, Map<Integer, List<String>> wordsByLength) throws IOException {
        return getBossPhase(folder, section, 2, 0, wordsByLength);
    }

    // ---------------------------------------------------------------------------------------
    // The Daily Boss:
    // a boss fight outside the campaign, with the boss's campaign puzzle settings (one phase).
    // ---------------------------------------------------------------------------------------
    // Today's boss: 4 bosses along the map each day, so it's never the same two days running and every boss
    // comes round once every 15 days
    static Campaign.Section dailyBossSection(LocalDate date) {
        int n = Campaign.SECTIONS.size();
        return Campaign.SECTIONS.get((int) Math.floorMod(date.toEpochDay() * 4, (long) n));
    }
    // the daily boss's puzzles: yours (clues by Claude, once a day for everyone) and the boss's own (no clues, free)
    static String getDailyBoss(Path folder, LocalDate date, boolean bossBoard, Map<Integer, List<String>> wordsByLength) throws IOException {
        Path file = dailyBossFile(folder, date, bossBoard);
        String saved = readSaved(file);
        if (saved != null) return saved;
        String shipped = shippedDaily(file.getFileName().toString());
        if (shipped != null) return shipped;
        Campaign.Section section = dailyBossSection(date);
        long seed = seedForDate(date) * 10 + (bossBoard ? 6 : 5);       // the dailies use 1-4
        return generateOnce(file, () -> bossPuzzle(seed, section, wordsByLength, !bossBoard));
    }
    static Path dailyBossFile(Path folder, LocalDate date, boolean bossBoard) {
        return folder.resolve(date + "-boss" + (bossBoard ? "-board" : "") + ".json");
    }
    // a boss puzzle at a section's boss settings
    static String bossPuzzle(long seed, Campaign.Section section, Map<Integer, List<String>> wordsByLength, boolean withClues) {
        String difficulty = section.bossDifficulty();
        return Campaign.bigGrid(difficulty)
                ? generateBig(seed, "campaign", difficulty, section.bossSize(), wordsByLength, new HashSet<>(), "", "", withClues)
                : generateSmall(seed, "campaign", difficulty, campaignSmallWords(difficulty, wordsByLength), new HashSet<>(), "", "", withClues, true);
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
}
