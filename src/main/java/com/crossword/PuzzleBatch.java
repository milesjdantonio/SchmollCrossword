package com.crossword;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/*
 * ===== Puzzles made ahead of time =====   (written by Claude at the user's request, 2026-10-10)
 *
 *   - THE CAMPAIGN POOL ("make 25 [per level] based on the parameters we set for each level that it pulls from
 *     randomly ... they must feel the same"): Campaign.VARIANTS (25) puzzles for every level, every boss's own
 *     board and every boss phase, into src/main/resources/campaign/<world>-<level>[-boss|-pN]-v<k>.json.
 *     The website picks one at random each time a level starts (campaign.js), and PuzzleStore.poolPuzzle serves it.
 *   - THE DAILIES ("create the dailies for the next 50 days"): all five a day (Easy, Medium, Hard, Challenge and the
 *     Boss, plus the boss's own board), into src/main/resources/daily/<date>-<kind>.json (PuzzleStore reads them
 *     before generating anything).
 *
 * "Feel the same": every puzzle of a level is made with that level's exact settings (difficulty, size, its lesson's
 * grid preference and clue focus, the campaign's easier words). 5x5 boards all share one shape. A bigger board's
 * black squares are random, so a board is only kept if its number of black squares and answers is within one of the
 * usual for its size, and it has the usual number of long (6+ letter) answers. The 25 also stay away from each
 * other's answers, so no two of them are alike.
 *
 * Stages, so the free part can be checked before anything is paid for:
 *   grids     every board, no clues (FREE), into a staging folder (target/puzzle-batch)
 *   clues     Claude writes the clues for every staged board (PAID: one call each), several at a time
 *   export    groups.json: every board that needs clues, grouped by clue difficulty and lesson (FREE)
 *   assemble  builds every puzzle from hand-written clue maps (FREE; see below). This is how the shipped
 *             puzzles were made: the user asked for no API calls, so Claude wrote the clues by hand.
 * grids and clues skip work that's already done, so a stopped run can just be started again.
 *
 *   mvn compile exec:java -Dexec.mainClass=com.crossword.PuzzleBatch -Dexec.args="grids"
 *   mvn compile exec:java -Dexec.mainClass=com.crossword.PuzzleBatch -Dexec.args="clues 8"      (8 at a time)
 *   options: days=50 (dailies from today), from=2026-10-11, only=campaign|daily, worlds=paper,garden
 */
public class PuzzleBatch {

    static final Path STAGE = Path.of("target", "puzzle-batch");
    static final Path POOL_OUT = Path.of("src", "main", "resources", "campaign");
    static final Path DAILY_OUT = Path.of("src", "main", "resources", "daily");
    static final ObjectMapper JSON = new ObjectMapper();

    // one puzzle to make: where it goes, and how its clues are written
    record Job(String file, Path out, String clueDifficulty, String focus) {}

    public static void main(String[] args) throws Exception {
        String stage = args.length > 0 ? args[0] : "grids";
        Map<String, String> opt = new java.util.HashMap<>();
        for (String a : args) if (a.contains("=")) opt.put(a.substring(0, a.indexOf('=')), a.substring(a.indexOf('=') + 1));
        int threads = args.length > 1 && args[1].matches("\\d+") ? Integer.parseInt(args[1]) : 8;
        String only = opt.getOrDefault("only", "");
        Set<String> worlds = opt.containsKey("worlds") ? Set.of(opt.get("worlds").split(",")) : null;
        int days = Integer.parseInt(opt.getOrDefault("days", "50"));
        LocalDate from = opt.containsKey("from") ? LocalDate.parse(opt.get("from")) : LocalDate.now();

        List<Job> jobs = new ArrayList<>();
        if (!only.equals("daily")) jobs.addAll(campaignJobs(worlds, stage.equals("grids")));
        if (!only.equals("campaign")) jobs.addAll(dailyJobs(from, days, stage.equals("grids")));
        if (stage.equals("grids")) {
            System.out.println("grids done: " + jobs.size() + " boards staged in " + STAGE.toAbsolutePath());
            long needClues = jobs.stream().filter(j -> j.clueDifficulty() != null).count();
            System.out.println("clues still to write (PAID, one Claude call each): " + jobs.stream().filter(j -> j.clueDifficulty() != null && !Files.exists(j.out())).count()
                    + " of " + needClues);
        } else if (stage.equals("clues")) {
            writeAllClues(jobs, threads);
        } else if (stage.equals("export")) {
            export(jobs);
        } else if (stage.equals("assemble")) {
            assemble(jobs);
        } else {
            System.out.println("stage must be grids, clues, export or assemble");
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Clues written by hand instead of by the API (the user, 2026-10-10: "just generate it yourself, dont call my
    // api"): export lists every board that needs clues, grouped by how its clues are written (the clue difficulty
    // and the level's lesson focus), with each group's words; the clues are written into
    // target/puzzle-batch/clues/<group>.json ({"WORD": "clue"}); assemble builds every puzzle from them, checks it
    // with ClueWriter.findProblems, and writes it where the game reads it.
    // ---------------------------------------------------------------------------------------------
    static final Path CLUES = STAGE.resolve("clues");
    static String groupOf(Job j) {
        return j.clueDifficulty() + "|" + j.focus();
    }
    static void export(List<Job> jobs) throws IOException {
        Map<String, Set<String>> words = new java.util.TreeMap<>();
        Map<String, List<String>> files = new java.util.TreeMap<>();
        for (Job j : jobs) {
            if (j.clueDifficulty() == null || !Files.exists(staged(j))) continue;
            words.computeIfAbsent(groupOf(j), k -> new java.util.TreeSet<>()).addAll(PuzzleStore.answersIn(Files.readString(staged(j))));
            files.computeIfAbsent(groupOf(j), k -> new ArrayList<>()).add(j.file());
        }
        List<Map<String, Object>> out = new ArrayList<>();
        int i = 0;
        for (String g : words.keySet()) {
            String[] parts = g.split(java.util.regex.Pattern.quote("|"), 2);
            Map<String, Object> m = new java.util.LinkedHashMap<>();
            m.put("group", String.format("g%03d", i++));
            m.put("difficulty", parts[0]);
            m.put("focus", parts[1]);
            m.put("puzzles", files.get(g).size());
            m.put("examples", files.get(g).subList(0, Math.min(3, files.get(g).size())));
            m.put("files", files.get(g));
            m.put("words", words.get(g));
            out.add(m);
        }
        Files.createDirectories(CLUES);
        JSON.writerWithDefaultPrettyPrinter().writeValue(STAGE.resolve("groups.json").toFile(), out);
        System.out.println(out.size() + " groups, " + words.values().stream().mapToInt(Set::size).sum() + " clues to write -> " + STAGE.resolve("groups.json"));
    }
    static void assemble(List<Job> jobs) throws IOException {
        JsonNode groups = JSON.readTree(STAGE.resolve("groups.json").toFile());
        Map<String, Map<String, String>> clueOf = new java.util.HashMap<>();
        for (JsonNode g : groups) {
            Path f = CLUES.resolve(g.get("group").asText() + ".json");
            Map<String, String> m = new java.util.HashMap<>();
            if (Files.exists(f)) JSON.readTree(f.toFile()).fields().forEachRemaining(e -> m.put(e.getKey().toUpperCase(), e.getValue().asText()));
            clueOf.put(g.get("difficulty").asText() + "|" + g.get("focus").asText(), m);
        }
        int written = 0, copied = 0, missing = 0, problems = 0;
        for (Job j : jobs) {
            Path staged = staged(j);
            if (!Files.exists(staged)) { missing++; continue; }
            String json = Files.readString(staged);
            if (j.clueDifficulty() != null) {
                JsonNode p = JSON.readTree(json);
                int n = p.get("size").asInt();
                boolean[][] black = new boolean[n][n];
                char[][] grid = new char[n][n];
                for (int r = 0; r < n; r++) {
                    String row = p.get("solution").get(r).asText();
                    for (int c = 0; c < n; c++) { grid[r][c] = row.charAt(c); black[r][c] = row.charAt(c) == '.'; }
                }
                List<String> answers = new ArrayList<>();
                for (Slot slot : Slot.findAllSlots(black)) answers.add(slot.getPattern(grid));
                // a puzzle's own clue map (clues/files/<file>), if there is one, beats its group's: it can mix clue
                // styles per puzzle to fit the lesson, and give Down answers easier clues than Across ones
                Path own = CLUES.resolve("files").resolve(j.file());
                Map<String, String> m = clueOf.getOrDefault(groupOf(j), Map.of());
                if (Files.exists(own)) {
                    Map<String, String> mine = new java.util.HashMap<>();
                    JSON.readTree(own.toFile()).fields().forEachRemaining(e -> mine.put(e.getKey().toUpperCase(), e.getValue().asText()));
                    m = mine;
                }
                List<ClueWriter.Clue> list = new ArrayList<>();
                for (String a : answers) if (m.containsKey(a)) list.add(new ClueWriter.Clue(a, m.get(a)));
                ClueWriter.ClueSet set = new ClueWriter.ClueSet(list);
                List<String> found = ClueWriter.findProblems(set, answers);
                if (!found.isEmpty()) { problems++; if (problems <= 20) System.out.println("  " + j.file() + ": " + found); continue; }
                json = Puzzle.create(black, grid, set, p.get("mode").asText(), p.get("seed").asLong(), p.get("difficulty").asText()).toJson();
                written++;
            } else copied++;
            Files.createDirectories(j.out().getParent());
            Files.writeString(j.out(), json);
        }
        System.out.printf("assembled: %d puzzles with clues, %d boards without, %d not staged, %d with problems (not written)%n", written, copied, missing, problems);
    }

    // ---------------------------------------------------------------------------------------------
    // The campaign pool
    // ---------------------------------------------------------------------------------------------
    static List<Job> campaignJobs(Set<String> worlds, boolean build) throws Exception {
        Map<Integer, List<String>> easy = App.loadWordsFor("easy"), medium = App.loadWordsFor("medium"), hard = App.loadWordsFor("challenge");
        List<Job> jobs = new ArrayList<>();
        List<Runnable> chains = new ArrayList<>();
        for (Campaign.Section s : Campaign.SECTIONS) {
            if (worlds != null && !worlds.contains(s.world())) continue;
            // levels 1-4: one chain each (each puzzle avoids the answers of the ones before it)
            for (int level = 1; level < Campaign.LEVELS; level++) {
                final int l = level;
                String d = Campaign.difficulty(s, l);
                List<Job> mine = new ArrayList<>();
                for (int k = 0; k < Campaign.VARIANTS; k++) mine.add(job(PuzzleStore.poolName(s, l, false), k, POOL_OUT, clueLevel(d), Lesson.clueFocus(s.world(), l)));
                jobs.addAll(mine);
                chains.add(() -> chain(mine, (k, avoid) -> board(s, d, Campaign.size(s, l), Campaign.seed(s, l, k), avoid, Lesson.favors(s.world(), l), easy, medium, hard)));
            }
            // the boss: per try, your puzzle, the boss's own board (no clues), then each later phase
            String d5 = Campaign.difficulty(s, Campaign.LEVELS);
            List<Job> boss = new ArrayList<>();
            for (int k = 0; k < Campaign.VARIANTS; k++) {
                boss.add(job(PuzzleStore.poolName(s, Campaign.LEVELS, false), k, POOL_OUT, clueLevel(d5), Lesson.clueFocus(s.world(), Campaign.LEVELS)));
                boss.add(job(PuzzleStore.poolName(s, Campaign.LEVELS, true), k, POOL_OUT, null, ""));
                for (int p = 2; p <= Campaign.phases(s); p++)
                    boss.add(job(PuzzleStore.poolPhaseName(s, p), k, POOL_OUT, clueLevel(Campaign.phaseDifficulty(s, p)), Lesson.clueFocus(s.world(), Campaign.LEVELS)));
            }
            jobs.addAll(boss);
            chains.add(() -> {
                Set<String> seen = new HashSet<>();                    // every answer of every earlier try (soft)
                for (int k = 0; k < Campaign.VARIANTS; k++) {
                    Set<String> fight = new HashSet<>();              // this try's puzzles never repeat each other's words
                    String[] names = names(s);
                    for (int i = 0; i < names.length; i++) {
                        Job j = boss.get(k * names.length + i);
                        Path staged = staged(j);
                        try {
                            String json;
                            if (Files.exists(staged)) json = Files.readString(staged);
                            else {
                                Set<String> avoid = new HashSet<>(seen); avoid.addAll(fight);
                                String nm = names[i];
                                if (nm.equals("player")) json = board(s, d5, Campaign.size(s, Campaign.LEVELS), Campaign.seed(s, Campaign.LEVELS, k), avoid, Lesson.favors(s.world(), Campaign.LEVELS), easy, medium, hard);
                                else if (nm.equals("board")) json = board(s, d5, Campaign.size(s, Campaign.LEVELS), Campaign.seed(s, Campaign.LEVELS + 1, k), avoid, "", easy, medium, hard);
                                else { int p = Integer.parseInt(nm.substring(1)); json = board(s, Campaign.phaseDifficulty(s, p), Campaign.phaseSize(s, p), Campaign.seed(s, Campaign.LEVELS + p, k), avoid, "", easy, medium, hard); }
                                Files.createDirectories(staged.getParent());
                                Files.writeString(staged, json);
                            }
                            Set<String> a = PuzzleStore.answersIn(json);
                            fight.addAll(a); seen.addAll(a);
                        } catch (IOException e) { throw new java.io.UncheckedIOException(e); }
                    }
                    progress(s.world() + " boss try " + k);
                }
            });
        }
        if (build) runAll(chains, 6);
        return jobs;
    }
    static String[] names(Campaign.Section s) {
        List<String> n = new ArrayList<>(List.of("player", "board"));
        for (int p = 2; p <= Campaign.phases(s); p++) n.add("p" + p);
        return n.toArray(new String[0]);
    }
    // clues for a difficulty: a Challenge grid gets medium clues, an Expert one hard clues (as PuzzleStore.generateBig)
    static String clueLevel(String d) {
        return d.equals("expert") ? "hard" : d.equals("challenge") ? "medium" : d;
    }
    static Job job(String name, int k, Path outDir, String clueDifficulty, String focus) {
        String file = name + "-v" + k + ".json";
        return new Job(file, outDir.resolve(file), clueDifficulty, focus);
    }
    static Path staged(Job j) {
        return STAGE.resolve(j.out().getParent().getFileName().toString()).resolve(j.file());
    }

    interface Maker { String make(int k, Set<String> avoid) throws IOException; }
    // a level's 25 boards, one after another, each avoiding the answers of the ones before it
    static void chain(List<Job> mine, Maker maker) {
        Set<String> seen = new HashSet<>();
        for (int k = 0; k < mine.size(); k++) {
            Path staged = staged(mine.get(k));
            try {
                String json = Files.exists(staged) ? Files.readString(staged) : maker.make(k, new HashSet<>(seen));
                if (!Files.exists(staged)) { Files.createDirectories(staged.getParent()); Files.writeString(staged, json); }
                seen.addAll(PuzzleStore.answersIn(json));
            } catch (IOException e) { throw new java.io.UncheckedIOException(e); }
        }
        progress(mine.get(0).file().replace("-v0.json", "") + " x" + mine.size());
    }

    // One board with no clues, at a campaign level's settings. Big boards are tried until they look like the usual
    // board of their size (see "feel the same" above).
    static String board(Campaign.Section s, String d, int size, long seed, Set<String> avoid, String favors,
                        Map<Integer, List<String>> easy, Map<Integer, List<String>> medium, Map<Integer, List<String>> hard) throws IOException {
        if (!Campaign.bigGrid(d)) {
            Map<Integer, List<String>> words = PuzzleStore.campaignSmallWords(d, d.equals("easy") ? easy : medium);
            return PuzzleStore.generateSmall(seed, "campaign", d, words, avoid, favors, "", false);
        }
        int[] want = usual(size);
        String best = null;
        int bestOff = Integer.MAX_VALUE;
        for (int tryN = 0; tryN < 24; tryN++) {
            String json = PuzzleStore.generateBig(seed + tryN * 104_729L, "campaign", d, size, hard, avoid, favors, "", false);
            int[] st = stats(json);
            int off = Math.abs(st[0] - want[0]) + Math.abs(st[1] - want[1]) + 2 * Math.abs(st[2] - want[2]);
            if (Math.abs(st[0] - want[0]) <= 1 && Math.abs(st[1] - want[1]) <= 1 && st[2] == want[2]) return json;
            if (off < bestOff) { best = json; bestOff = off; }
        }
        return best;                                                  // (none matched exactly: the closest one)
    }
    // the usual board of a size: the median black squares, answers and long answers of 300 random shapes
    static final Map<Integer, int[]> USUAL = new java.util.concurrent.ConcurrentHashMap<>();
    static int[] usual(int n) {
        return USUAL.computeIfAbsent(n, size -> {
            int[][] all = new int[3][300];
            for (int i = 0; i < 300; i++) {
                boolean[][] black = ChallengeGrid.shape(990_000L + i, size);
                int b = 0;
                for (boolean[] row : black) for (boolean x : row) if (x) b++;
                List<Slot> slots = Slot.findAllSlots(black);
                all[0][i] = b; all[1][i] = slots.size(); all[2][i] = (int) slots.stream().filter(sl -> sl.length >= 6).count();
            }
            for (int[] a : all) Arrays.sort(a);
            return new int[] { all[0][150], all[1][150], all[2][150] };
        });
    }
    static final Pattern LENGTH = Pattern.compile("\"length\":(\\d+)");
    // [black squares, answers, answers of 6+ letters] of a puzzle's JSON
    static int[] stats(String json) throws IOException {
        JsonNode p = JSON.readTree(json);
        int blacks = 0;
        for (JsonNode row : p.get("solution")) for (char c : row.asText().toCharArray()) if (c == '.') blacks++;
        int answers = 0, longs = 0;
        Matcher m = LENGTH.matcher(json);
        while (m.find()) { answers++; if (Integer.parseInt(m.group(1)) >= 6) longs++; }
        return new int[] { blacks, answers, longs };
    }

    // ---------------------------------------------------------------------------------------------
    // The dailies: day by day (each avoids the answers of its day's others and the 3 days before)
    // ---------------------------------------------------------------------------------------------
    static List<Job> dailyJobs(LocalDate from, int days, boolean build) throws Exception {
        Map<String, Map<Integer, List<String>>> words = Map.of("easy", App.loadWordsFor("easy"), "medium", App.loadWordsFor("medium"),
                "hard", App.loadWordsFor("hard"), "challenge", App.loadWordsFor("challenge"));
        List<Job> jobs = new ArrayList<>();
        Path stageDir = STAGE.resolve(DAILY_OUT.getFileName().toString());
        for (int i = 0; i < days; i++) {
            LocalDate date = from.plusDays(i);
            for (String kind : PuzzleStore.DAILY_KINDS) {
                if (Files.exists(PuzzleStore.dailyFile(PuzzleStore.DAILY_FOLDER, date, kind))) continue;   // already made and saved: it stays
                Job j = new Job(date + "-" + kind + ".json", DAILY_OUT.resolve(date + "-" + kind + ".json"), clueLevel(kind), "");
                jobs.add(j);
                if (build && !Files.exists(staged(j)) && !Files.exists(j.out())) {
                    // the avoid list reads the staged boards (and anything already finished)
                    Set<String> avoid = PuzzleStore.recentDailyAnswers(stageDir, date, kind);
                    avoid.addAll(PuzzleStore.recentDailyAnswers(DAILY_OUT, date, kind));
                    long seed = PuzzleStore.dailySeed(date, kind);
                    String json = kind.equals("challenge")
                            ? PuzzleStore.generateBig(seed, "daily", "challenge", ChallengeGrid.sizeFor(seed), words.get(kind), avoid, "", "", false)
                            : PuzzleStore.generateSmall(seed, "daily", kind, words.get(kind), avoid, "", "", false);
                    Files.createDirectories(staged(j).getParent());
                    Files.writeString(staged(j), json);
                }
            }
            // the Daily Boss: today's boss at its campaign settings (as PuzzleStore.getDailyBoss)
            Campaign.Section s = PuzzleStore.dailyBossSection(date);
            Map<Integer, List<String>> bw = Campaign.bigGrid(s.bossDifficulty()) ? words.get("challenge") : words.get(s.bossDifficulty().equals("easy") ? "easy" : "medium");
            for (boolean board : new boolean[] { false, true }) {
                if (Files.exists(PuzzleStore.DAILY_FOLDER.resolve(date + "-boss" + (board ? "-board" : "") + ".json"))) continue;
                Job j = new Job(date + "-boss" + (board ? "-board" : "") + ".json", DAILY_OUT.resolve(date + "-boss" + (board ? "-board" : "") + ".json"),
                        board ? null : clueLevel(s.bossDifficulty()), "");
                jobs.add(j);
                if (build && !Files.exists(staged(j)) && !Files.exists(j.out())) {
                    String json = PuzzleStore.bossPuzzle(PuzzleStore.seedForDate(date) * 10 + (board ? 6 : 5), s, bw, false);
                    Files.createDirectories(staged(j).getParent());
                    Files.writeString(staged(j), json);
                }
            }
            if (build) progress("daily " + date);
        }
        return jobs;
    }

    // ---------------------------------------------------------------------------------------------
    // Clues (PAID): every staged board gets its clues from Claude, several at once; boards without clues (the bosses'
    // own) are copied as they are
    // ---------------------------------------------------------------------------------------------
    static void writeAllClues(List<Job> jobs, int threads) throws Exception {
        List<Job> todo = jobs.stream().filter(j -> !Files.exists(j.out())).toList();
        long paid = todo.stream().filter(j -> j.clueDifficulty() != null).count();
        System.out.println("writing " + todo.size() + " puzzles (" + paid + " Claude calls), " + threads + " at a time");
        AtomicInteger done = new AtomicInteger(), failed = new AtomicInteger();
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        long t0 = System.currentTimeMillis();
        for (Job j : todo) pool.submit(() -> {
            try {
                Path staged = staged(j);
                if (!Files.exists(staged)) { System.out.println("  missing board (run grids first): " + j.file()); failed.incrementAndGet(); return; }
                String json = Files.readString(staged);
                if (j.clueDifficulty() != null) json = withClues(json, j.clueDifficulty(), j.focus());
                Files.createDirectories(j.out().getParent());
                Files.writeString(j.out(), json);
                int n = done.incrementAndGet();
                if (n % 25 == 0 || n == todo.size()) {
                    long in = ClueWriter.INPUT_TOKENS.get(), out = ClueWriter.OUTPUT_TOKENS.get();
                    System.out.printf("  %d/%d done, %d calls, %,d in / %,d out tokens, %.0f min%n", n, todo.size(), ClueWriter.CALLS.get(), in, out, (System.currentTimeMillis() - t0) / 60000.0);
                }
            } catch (Exception e) {
                failed.incrementAndGet();
                System.out.println("  FAILED " + j.file() + ": " + e.getMessage());
            }
        });
        pool.shutdown();
        pool.awaitTermination(7, TimeUnit.DAYS);
        System.out.printf("clues done: %d written, %d failed (run again to retry those), %d calls, %,d input and %,d output tokens%n",
                done.get(), failed.get(), ClueWriter.CALLS.get(), ClueWriter.INPUT_TOKENS.get(), ClueWriter.OUTPUT_TOKENS.get());
    }
    // a clue-less puzzle's JSON with clues written for it (the same board, seed and everything else)
    static String withClues(String json, String clueDifficulty, String focus) throws IOException {
        JsonNode p = JSON.readTree(json);
        int n = p.get("size").asInt();
        boolean[][] black = new boolean[n][n];
        char[][] grid = new char[n][n];
        for (int r = 0; r < n; r++) {
            String row = p.get("solution").get(r).asText();
            for (int c = 0; c < n; c++) { grid[r][c] = row.charAt(c); black[r][c] = row.charAt(c) == '.'; }
        }
        List<String> answers = new ArrayList<>();
        for (Slot slot : Slot.findAllSlots(black)) answers.add(slot.getPattern(grid));
        ClueWriter.ClueSet clues = ClueWriter.writeClues(answers, clueDifficulty, focus);
        return Puzzle.create(black, grid, clues, p.get("mode").asText(), p.get("seed").asLong(), p.get("difficulty").asText()).toJson();
    }

    static void runAll(List<Runnable> chains, int threads) throws InterruptedException {
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        for (Runnable r : chains) pool.submit(() -> { try { r.run(); } catch (Exception e) { System.out.println("  FAILED: " + e); e.printStackTrace(); } });
        pool.shutdown();
        pool.awaitTermination(7, TimeUnit.DAYS);
    }
    static synchronized void progress(String what) {
        System.out.println("  " + what);
    }
}
