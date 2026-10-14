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
        // -Dlevels=1,2 (or 5 for the boss) builds only those levels' boards, so several processes can share a world
        // (the 5x5 solver is shared inside one process, so one process builds one board at a time)
        String levelsProp = System.getProperty("levels");
        Set<Integer> onlyLevels = levelsProp == null ? null : java.util.Arrays.stream(levelsProp.split(",")).map(String::trim).map(Integer::parseInt).collect(java.util.stream.Collectors.toSet());
        for (Campaign.Section s : Campaign.SECTIONS) {
            if (worlds != null && !worlds.contains(s.world())) continue;
            // levels 1-4: one chain each (each puzzle avoids the answers of the ones before it)
            for (int level = 1; level < Campaign.LEVELS; level++) {
                final int l = level;
                if (build && onlyLevels != null && !onlyLevels.contains(l)) continue;
                String d = Campaign.difficulty(s, l);
                List<Job> mine = new ArrayList<>();
                for (int k = 0; k < Campaign.VARIANTS; k++) mine.add(job(PuzzleStore.poolName(s, l, false), k, POOL_OUT, clueLevel(d), Lesson.clueFocus(s.world(), l)));
                jobs.addAll(mine);
                String name = PuzzleStore.poolName(s, l, false);
                chains.add(() -> chain(mine, (k, avoid) -> eased(name, s, d, Campaign.size(s, l), Campaign.seed(s, l, k), avoid, Lesson.favors(s.world(), l), easy, medium, hard)));
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
            if (build && onlyLevels != null && !onlyLevels.contains(Campaign.LEVELS)) continue;
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
                                if (nm.equals("player")) json = eased(PuzzleStore.poolName(s, Campaign.LEVELS, false), s, d5, Campaign.size(s, Campaign.LEVELS), Campaign.seed(s, Campaign.LEVELS, k), avoid, Lesson.favors(s.world(), Campaign.LEVELS), easy, medium, hard);
                                else if (nm.equals("board")) json = uniqueBoard(s, d5, Campaign.size(s, Campaign.LEVELS), Campaign.seed(s, Campaign.LEVELS + 1, k), avoid, easy, medium, hard);
                                else { int p = Integer.parseInt(nm.substring(1)); json = eased(PuzzleStore.poolPhaseName(s, p), s, Campaign.phaseDifficulty(s, p), Campaign.phaseSize(s, p), Campaign.seed(s, Campaign.LEVELS + p, k), avoid, "", easy, medium, hard); }
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
        if (build) { loadEase(); runAll(chains, 6); System.out.println("5x5 fills by step: done " + FILLED + ", gave up " + FAILED); }
        return jobs;
    }

    // ---------------------------------------------------------------------------------------------
    // Every level its own puzzles, and 25% easier (the user, 2026-10-11: "a garden level re used puzzle and clues
    // from the paper level ... each level should have 25 levels that it can pull from independently that no other
    // level has"; "lower the difficulty of the campaign across the board by around 25% (the words and clues)").
    //   - no board is ever used twice, in any level (USED). The old pool's 5x5 levels shared boards: each level's
    //     seeds were 1 apart and every board tried the 30 seeds after its own.
    //   - each word has a difficulty score (target/puzzle-batch/wordscore.tsv: its tier x 2 plus how rare SCOWL
    //     says it is, 0 to 2), and each level a target: 75% of its old pool's average (ease.json). A puzzle is
    //     picked from several candidates, some filled from the level's list with its hardest words taken out:
    //     the one closest to the target, preferring words that already have a hand-written clue (clued-<d>.txt)
    //     and words other levels haven't used much.
    // ---------------------------------------------------------------------------------------------
    static final Set<String> USED = java.util.concurrent.ConcurrentHashMap.newKeySet();
    static final Map<Integer, Integer> FILLED = new java.util.concurrent.ConcurrentHashMap<>(), FAILED = new java.util.concurrent.ConcurrentHashMap<>();
    static final Map<String, Integer> USES = new java.util.concurrent.ConcurrentHashMap<>();
    static final Map<String, Double> SCORE = new java.util.HashMap<>();
    static final Map<String, Double> TARGET = new java.util.HashMap<>();
    static final Map<String, Set<String>> CLUED = new java.util.HashMap<>();
    static void loadEase() throws IOException {
        for (String line : Files.readAllLines(STAGE.resolve("wordscore.tsv"))) {
            String[] p = line.split("\t");
            SCORE.put(p[0], Double.parseDouble(p[1]));
        }
        JSON.readTree(STAGE.resolve("ease.json").toFile()).get("target").fields().forEachRemaining(e -> TARGET.put(e.getKey(), e.getValue().asDouble()));
        for (String d : List.of("easy", "medium", "hard")) CLUED.put(d, new HashSet<>(Files.readAllLines(STAGE.resolve("clued-" + d + ".txt"))));
        // boards already staged (a stopped run started again) are taken
        Path dir = STAGE.resolve(POOL_OUT.getFileName().toString());
        if (Files.isDirectory(dir)) try (var files = Files.list(dir)) {
            for (Path f : files.toList()) claim(Files.readString(f), true);
        }
    }
    static String gridOf(String json) throws IOException {
        StringBuilder b = new StringBuilder();
        for (JsonNode row : JSON.readTree(json).get("solution")) b.append(row.asText()).append('/');
        return b.toString();
    }
    // takes a board for good; false if another level already has it
    static boolean claim(String json, boolean force) throws IOException {
        if (!USED.add(gridOf(json)) && !force) return false;
        for (String a : PuzzleStore.answersIn(json)) USES.merge(a, 1, Integer::sum);
        return true;
    }
    static double mean(Set<String> answers) {
        return answers.stream().mapToDouble(a -> SCORE.getOrDefault(a, 4.0)).average().orElse(0);
    }
    // the words up to a score, plus a share (keep, 0 to 1) of the harder ones, a different share for each salt
    static Map<Integer, List<String>> upTo(Map<Integer, List<String>> words, double max, double keep, long salt) {
        Map<Integer, List<String>> out = new java.util.HashMap<>();
        words.forEach((len, list) -> out.put(len, list.stream().filter(w -> SCORE.getOrDefault(w, 9.0) <= max
                || Math.floorMod((w.hashCode() * 31L + salt) * 2_654_435_761L, 1000) < keep * 1000).toList()));
        return out;
    }
    // how far a candidate is from what the level wants (lower is better)
    static double cost(String json, String name, String d, Set<String> avoid) {
        Set<String> a = PuzzleStore.answersIn(json);
        Set<String> clued = CLUED.get(clueLevel(d));
        double target = TARGET.getOrDefault(name, 9.0), m = mean(a);
        long unclued = a.stream().filter(w -> !clued.contains(w)).count();
        long repeats = a.stream().filter(avoid::contains).count();
        double worn = a.stream().mapToInt(w -> USES.getOrDefault(w, 0)).sum() / (double) Math.max(1, a.size());
        return Math.abs(m - target) * 30 + unclued * 0.2 + repeats * 1.5 + worn * 0.1;
    }
    // a board's seed from its name and the level's seed, hashed: the level seeds are 1 and 10 apart, and boards made
    // from simple sums of them landed on the same seeds in different levels (and, run in separate processes, the
    // same boards)
    static long seedOf(String name, long seed) {
        return java.util.UUID.nameUUIDFromBytes((name + "/" + seed).getBytes(java.nio.charset.StandardCharsets.UTF_8)).getMostSignificantBits() & ((1L << 50) - 1);
    }
    // a 5x5 fill that didn't finish still has empty squares
    static boolean complete(String json) throws IOException {
        for (JsonNode row : JSON.readTree(json).get("solution")) if (row.asText().contains("?") || row.asText().contains(" ")) return false;
        return !PuzzleStore.answersIn(json).isEmpty() && PuzzleStore.answersIn(json).stream().noneMatch(a -> a.contains("."));
    }
    static String eased(String name, Campaign.Section s, String d, int size, long seed, Set<String> avoid, String favors,
                        Map<Integer, List<String>> easy, Map<Integer, List<String>> medium, Map<Integer, List<String>> hard) throws IOException {
        List<String> cands = new ArrayList<>();
        long base = seedOf(name, seed);                          // its own seed, unrelated to any other board's
        if (!Campaign.bigGrid(d)) {
            Map<Integer, List<String>> words = PuzzleStore.campaignSmallWords(d, d.equals("easy") ? easy : medium);
            // 16 fills from the full list, the easiest kept (taking the easiest of many lowers the average without
            // making a fill fail, as a shorter list did on the dense 5x5 shape)
            for (int i = 0; i < 4; i++) {
                Map<Integer, List<String>> w = words;
                for (int t = 0; t < 4; t++) {
                    String json;
                    synchronized (PuzzleStore.class) {             // a short word list can search for minutes: give up early
                        App.solveBudget = Long.getLong("solveBudget", 2_000_000L);     // -DsolveBudget=250000: dead ends give up sooner
                        try { json = PuzzleStore.generateSmall(base + i * 101 + t * 17, "campaign", d, w, avoid, favors, "", false); }
                        catch (RuntimeException e) { json = null; }
                        finally { App.solveBudget = Long.MAX_VALUE; }
                    }
                    if (json != null && complete(json)) { cands.add(json); FILLED.merge(i, 1, Integer::sum); } else FAILED.merge(i, 1, Integer::sum);
                }
            }
        } else {
            boolean expert = d.equals("expert");
            Map<Integer, List<String>> first = expert ? medium : easy;
            // expert boards: Medium's words with its harder half thinned out; challenge boards (Easy's words) need a
            // gentler list too, or they come out far easier than 25%
            // (a challenge board falls back on Medium's words when a pattern needs them, as the old pool did; with
            // Easy's alone it came out ~40% easier instead of 25%)
            double[] keep = expert ? new double[] { 0.45 } : new double[] { 0.95, 0.8 };
            Map<Integer, List<String>> then = expert ? first : medium;
            int[] want = usual(size);
            for (int i = 0; i < keep.length; i++) {
                Map<Integer, List<String>> f = keep[i] >= 1 ? first : upTo(first, expert ? 1.0 : 0, keep[i], seed + i);
                int got = 0;
                for (int t = 0; t < 10 && got < 2; t++) {
                    String json = PuzzleStore.generateBigWith(base + i * 7_777L + t * 104_729L, "campaign", d, size, f, then, avoid, favors);
                    int[] st = stats(json);
                    if (Math.abs(st[0] - want[0]) <= 1 && Math.abs(st[1] - want[1]) <= 1 && st[2] == want[2]) { cands.add(json); got++; }
                }
            }
            if (cands.isEmpty()) cands.add(board(s, d, size, base, avoid, favors, easy, medium, hard));
        }
        cands.sort(java.util.Comparator.comparingDouble(j -> cost(j, name, d, avoid)));
        synchronized (USED) {
            for (String j : cands) if (claim(j, false)) return j;
        }
        return uniqueBoard(s, d, size, base + 1, avoid, easy, medium, hard);      // (every candidate was taken)
    }
    // a boss's own board (nobody reads its clues): it only has to be new
    static String uniqueBoard(Campaign.Section s, String d, int size, long seed, Set<String> avoid,
                              Map<Integer, List<String>> easy, Map<Integer, List<String>> medium, Map<Integer, List<String>> hard) throws IOException {
        for (int t = 0; ; t++) {
            // after the first try, from a random three quarters of the words (the same popular grids kept coming back)
            long salt = seed + t * 31L;
            String json = board(s, d, size, seedOf("boss-board", seed) + t * 15_485_863L, avoid, "",
                    // -DuniqueWide=true: the bot's board may use Medium's words (nobody solves it; the Easy list had run out of new grids)
                    Boolean.getBoolean("uniqueWide") ? medium : t == 0 ? easy : upTo(easy, -1, 0.75, salt), t == 0 ? medium : upTo(medium, -1, 0.75, salt), hard);
            synchronized (USED) { if (claim(json, false)) return json; }
        }
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
                // -DnoAvoid=true: a board may reuse words from the level's earlier boards (the user's call for the last two
                // Garden boards, 2026-10-13: the rule made them take far too long). It must still be a board no level has.
                String json = Files.exists(staged) ? Files.readString(staged) : maker.make(k, Boolean.getBoolean("noAvoid") ? new HashSet<>() : new HashSet<>(seen));
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
            // the same search budget as eased(): a fill that runs out of budget is dropped and the next seed is tried
            // (with no budget one hard grid could search for many minutes)
            for (int t = 0; ; t++) {
                String json;
                synchronized (PuzzleStore.class) {
                    App.solveBudget = Long.getLong("solveBudget", 2_000_000L);
                    // after the first try, a random three quarters of the words: the solver keeps landing on the same
                    // popular grids (already taken by other levels), and a thinned list gives it different ones
                    Map<Integer, List<String>> w = t == 0 ? words : upTo(words, -1, 0.75, seed + t);
                    try { json = PuzzleStore.generateSmall(seed + t * 7_919L, "campaign", d, w, avoid, favors, "", false); }
                    catch (RuntimeException e) { json = null; }
                    finally { App.solveBudget = Long.MAX_VALUE; }
                }
                if (json != null && complete(json)) return json;
            }
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
