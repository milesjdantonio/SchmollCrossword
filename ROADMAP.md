# Schmoll Crossword: Full Roadmap

Every step needed to go from an empty Java project to a mini crossword **website** with a daily puzzle (the same for everyone), an unlimited mode, scores, stats and settings.
Each step is set up like a LeetCode problem: a problem statement, an empty method, and PASS/FAIL tests in `main`.

Legend: ✅ done · 🔨 in progress · ⬜ not started

**Progress: 24 of 27 steps done.** The game is fully playable in the browser, with Daily and Unlimited modes. The generator makes Wordle-level puzzles with AI-written clues. Next: package them for a website with daily and unlimited modes.

---

## Phase 1: Foundations ✅

### ✅ Step 1: Project setup
- **What:** Maven project, `com.crossword` package, Java 17.
- **Learned:** what Maven and `pom.xml` do, how Java packages map to folders.

### ✅ Step 2: Load the word list
- **What:** `App.loadWords()` reads `words.txt` and groups words by length into a `Map<Integer, List<String>>`.
- **Learned:** `HashMap`, reading files with `BufferedReader`, `computeIfAbsent` and lambdas. Also a classic bug: a stray `;` after an `if`.

### ✅ Step 3: Represent the grid
- **What:** `boolean[][] blackSquares` for the shape, `char[][] filledGrid` for the letters (`.` = empty).
- **Learned:** 2D arrays, `grid[row][col]`.

### ✅ Step 4: Find all slots
- **What:** `Slot.findAcrossSlots()` / `findDownSlots()` scan for runs of 3+ open squares.
- **Learned:** scanning for runs with a "start of run" marker.
- **LeetCode:** 485. Max Consecutive Ones

### ✅ Step 5: List a slot's squares
- **What:** `Slot.getCells()` returns every `{row, col}` in a slot.
- **Learned:** `List<int[]>`, a list of coordinates.

---

## Phase 2: Generate a filled grid ✅

### ✅ Step 6: Read a slot's pattern
- **What:** `Slot.getPattern(filledGrid)` → `"C.T.."`.
- **Learned:** `StringBuilder`, for-each loops, reusing your own methods (DRY).

### ✅ Step 7: Find matching words
- **What:** `App.findMatches(pattern, wordsByLength)` returns every word that fits (`.` = any letter).
- **Learned:** map lookups with `getOrDefault`, narrowing the search space, the **flag** pattern, off-by-one bugs.
- **LeetCode:** 211. Design Add and Search Words Data Structure

### ✅ Step 8: Place and remove words
- **What:** `Slot.placeWord()` writes a word and returns only the squares it filled. `Slot.removeWord()` blanks exactly those.
- **Learned:** "undo by record", check-before-write, arrays passed by reference.
- **LeetCode:** 37. Sudoku Solver, 51. N-Queens

### ✅ Step 9: Backtracking solver
- **What:** recursive `App.solve()`: pick a slot, try each word, go deeper, undo on a dead end.
- **Learned:** **recursion** (base case + recursive case), **backtracking** (choose → explore → unchoose), why the order you make choices in matters.
- **LeetCode:** 37. Sudoku Solver, 79. Word Search

### ✅ Step 10: No repeated answers
- **What:** a `Set<String> usedWords` stops the same word appearing twice (the first grid was a mirror image with every word used twice).
- **Learned:** `Set` / `HashSet`, keeping two things in sync on choose and unchoose, tests that check what you actually care about.
- **LeetCode:** 46. Permutations

### ✅ Step 11: Print the filled grid
- **What:** `App.formatGrid()` turns the grid into text with `#` for black squares.
- **Learned:** nested loops, the **fencepost** problem (spaces only *between* items), returning text instead of printing it so tests can check it.
- **LeetCode:** 68. Text Justification, 6. Zigzag Conversion

### ✅ Step 12: Faster and different every time
- ✅ **12a: Shuffle.** Candidates are shuffled with a seeded `Random`, so the same seed gives the same puzzle and a different seed gives a different one.
  - **Learned:** random seeds, `Collections.shuffle`, why you pass a `Random` in instead of creating one.
  - **LeetCode:** 384. Shuffle an Array
- ✅ **12b-1: Pick the most-constrained slot.** `App.pickMostConstrained()` returns the slot with the fewest matching words.
  - **Learned:** the "track the best so far" loop, `Integer.MAX_VALUE`, `<` vs `<=` for ties.
  - **LeetCode:** 121. Best Time to Buy and Sell Stock, 414. Third Maximum Number
- ✅ **12b-2: Solve most-constrained first.** `App.solve()` now takes a `remaining` list and always fills the slot `pickMostConstrained` returns, instead of a fixed order. The old index-based solver and the hand-made alternating order were removed in a refactor.
  - **Learned:** a list as one more thing to choose/unchoose, a search heuristic (Minimum Remaining Values), refactoring safely by re-running every test.
  - **LeetCode:** 37. Sudoku Solver (the fast solutions)

---

## Phase 3: Turn the grid into a real crossword ✅

### ✅ Step 13: Use a player-friendly word list
- **What:** replace `words.txt` (full of words like `AALII` and `SCEND`) with common words a normal person can guess.
  - ✅ Researched SCOWL, Spread the Wordlist and others, then benchmarked each with the solver. Chose the words in **both SCOWL 50 and Spread the Wordlist (score ≥ 50)**, so every answer is both common and crossword-approved (see [WORDLISTS.md](WORDLISTS.md)).
  - ✅ `App.loadBlockedWords()` + skipping blocked words in `loadWords()`, because every list produced offensive words in testing.
- **Learned:** finding and checking the license of a data source (and what NonCommercial / ShareAlike mean), benchmarking data choices, filtering data while loading it, `&&` vs `||` and short-circuiting, loading something once outside a loop.
- **Side effect:** the smaller list means more dead ends, so puzzles went from ~0.2 s to ~1 s on average (3.5 s worst of 10). The timing test limit was raised from 5 s to 15 s, and Step 13b exists to win the speed back.

### ✅ Step 13b: Faster word matching
- **Why:** every try in `solve` calls `pickMostConstrained`, which calls `findMatches` on every open slot, and each call scans thousands of words letter by letter. With the friendlier list, the solver makes many more tries, so this scanning dominates the run time.
- **What:**
  - ✅ **13b-1: Measure first.** Static counters in `findMatches` showed that seed 4 makes **113,616** calls, and **94%** of them repeat a pattern already worked out. That points straight at caching.
  - ✅ **13b-2: Cache.** `matchCache` (a `HashMap<String, List<String>>`) remembers each pattern's answer and hands out copies, so `solve`'s shuffling can't scramble it. 5 puzzles: ~5,500 ms → ~220 ms (25×). Seed 4: ~2,800 ms → ~42 ms. The timing limit is back to 5 s.
  - ✅ **13b-3: Trie.** `Trie.java` stores the words as a tree of letters, so a new pattern like `C.T..` only walks branches that can match. `findMatches` asks the Trie on a cache miss. Your Step 7 scan is kept as `findMatchesByScan`, and a test checks both give identical answers for 6,134 patterns. On the 6,357 distinct patterns the solver sees, the Trie takes ~52 ms vs ~127 ms for the scan, and 5 puzzles take ~150 ms. (Built by Claude at the project owner's request; read `Trie.java` for the commented walkthrough.)
- **Learned:** profiling (measure before optimizing), memoization and caching trade-offs (memory vs speed, handing out copies), the Trie data structure, testing a new implementation against the old one.
- **Result:** 5 puzzles went from ~5,500 ms to ~150 ms (about 35× faster), and the timing limit is back to 5 s.
- **LeetCode:** 208. Implement Trie, 211. Design Add and Search Words Data Structure (same `.` wildcard as `findMatches`), 509. Fibonacci Number (memoization)

### ✅ Step 14: Clue numbering
- **What:** `App.numberGrid(blackSquares)` returns an `int[][]` with the clue number of every square that starts an Across or Down answer (0 elsewhere), numbered left→right, top→bottom.
- **Learned:** grid scanning with neighbor checks, using `||` / `&&` short-circuiting to avoid reading off the edge of an array, default array values (`int` starts at 0), and the copy-paste bug (`col + 2` left in the Down check).
- **LeetCode:** 36. Valid Sudoku, 200. Number of Islands

### ✅ Step 15: Clues
- **What:** each puzzle's ~10 answers get fresh, original clues written by Claude through the Claude API, at a chosen difficulty (easy / medium / hard). No openly licensed clue source exists; see [CLUES.md](CLUES.md).
  - ✅ Setup: `anthropic-java` dependency, API key loaded from a file outside the repo, Claude Code blocked from reading it (`.claude/settings.json`)
  - ✅ **15a:** `ClueWriter.buildPrompt(answers, difficulty)`: the task, the difficulty with its meaning, the rules (short, never contains the answer, original, playful wording, each clue scaled to how familiar its word is) and a small-daily-crossword style guide (1–6 words, grammar matches the answer, `?` for puns, `___` blanks, "e.g." examples, quoted speech, a mix of clue types). Tuned over 6 rounds with the project owner.
  - ✅ **15b:** `ClueWriter.findProblems(clueSet, answers)`: two passes, Claude's clues (unexpected, empty, gives away the answer) then the requested answers (missing), ignoring case
  - ✅ **15c:** `ClueWriter.writeClues(answers, difficulty)`: calls `claude-opus-5-5` with structured output into a `ClueSet`, retries once if the checks fail. Live test passed on the first try.
- **Learned:** calling a real API from Java, keeping secrets out of code and git, prompt writing and iterating on it, structured output, validating AI output before users see it.
- **LeetCode:** 242. Valid Anagram, 383. Ransom Note (checking one collection against another, for 15b)

### ✅ Step 16: A `Puzzle` object
- **What:** bundle everything about one puzzle into one object: the grid, black squares, clue numbers, each Across/Down entry (number, answer, clue), the difficulty, the mode (daily or unlimited) and the seed. Then turn it into JSON text the website can read.
  - ✅ **16a:** `Puzzle.create(...)`: one `Entry` per slot (number from `numberGrid`, answer from `getPattern`, clue matched by answer, ignoring case), Across/Down lists sorted by number with `Comparator.comparingInt`
  - ✅ **16b:** `puzzle.toJson()`: hand-built JSON (mode, seed, difficulty, size, solution rows with `.` for black squares, numbers, Across/Down entries) with `quote()` escaping; a test checks it with a real JSON library (Jackson). Written by Claude at the project owner's request: the owner already works with JSON and treated it as AI-appropriate boilerplate.
- **Learned:** designing a class around what the frontend needs, records and their accessor methods, `.equals` vs `==` for Strings, sorting with `Comparator.comparingInt`, what JSON serialization does (and when to hand it to AI or a library).
- **LeetCode:** 297. Serialize and Deserialize Binary Tree

---

## Phase 4: Make it a website ✅

### ✅ Step 17: Save generated puzzles (daily = same for everyone)
- **What:** the daily puzzle must be identical for every player, but Claude writes different clues on every call. Design (project owner, 2026-10-07): **one grid per date** (the date is the seed) shared by easy, medium and hard, plus **one clue set per difficulty**, each written by Claude only the first time that difficulty is requested, then saved as `puzzles/daily/<date>-<difficulty>.json` and served from the file. Unlimited puzzles can be generated on demand (or pre-generated in batches to control API cost). `PuzzleStore.java`:
  - ✅ **17a:** `seedForDate(date)`: 2026-10-07 → 20261007
  - ✅ **17b:** `dailyFile(folder, date, difficulty)`: `puzzles/daily/2026-10-07-hard.json` via `Path.resolve`
  - ✅ **17c:** `getDaily(...)`: read the saved file if it exists, otherwise generate, save, return. `synchronized` so two simultaneous first requests can't both call Claude (written by Claude)
- **Learned:** `LocalDate`, building a number from parts, `Path.resolve` (works on Windows and Linux), reading/writing files, caching on disk, `synchronized` for requests that arrive at the same time.

### ✅ Step 18: Backend API (Spring Boot)
- **What:** Spring Boot 4.1.1 server (`WebApp`, `mvn spring-boot:run`, http://localhost:8080). `PuzzleController` serves `GET /api/daily?difficulty=` (today's saved daily via `PuzzleStore.getDaily`) and `GET /api/unlimited?difficulty=` (a fresh puzzle from a random seed via `PuzzleStore.generateUnlimited`), both as JSON.
  - ✅ **18a:** `isValidDifficulty`: easy/medium/hard in any case, null-safe (guard clause)
  - ✅ **18b/18c:** reject bad input with HTTP 400 before doing anything that costs money, lowercase the difficulty so `Hard` and `hard` share one saved daily
- **Learned:** annotations (`@RestController`, `@GetMapping`, `@RequestParam`), HTTP status codes, never trusting input, `throw`, random seeds for unlimited mode.

### ✅ Step 19: Game board UI
- **What:** a web page (HTML/CSS/JavaScript) that draws the grid with numbers and lists the clues, in Schmoll Crossword's own visual style.
- **Done (baseline, built by Claude):** `src/main/resources/static/` (`index.html`, `style.css`, `app.js`), served by Spring Boot at http://localhost:8080. Loads `/api/daily`, draws the grid (black squares from `.` in the solution, corner numbers) and the Across/Down clues, with Easy/Medium/Hard buttons. A real design pass comes later.
- **Ideas to know:** the page `fetch`es JSON from your API and builds HTML elements from it; CSS grid lays out the squares; clue text is inserted with `textContent` so it can never inject HTML.
- **Known for later:** the JSON includes the full solution, so a curious player could peek with browser tools. Fine for now; revisit before launch.

### ✅ Step 20: Controls
- **What:** click to select, type to fill, Backspace, arrow keys, Across/Down toggle, highlight the current word and clue.
- **Done (built by Claude):** click a square (click again or Space to flip Across/Down), type to fill and auto-advance (to the next word at the end), Backspace, arrow keys (turn first, then move; skip black squares), Tab/Shift+Tab/Enter between clues, click a clue to jump to it, highlighted word + selected square + active clue, a clue bar above the board. Letters survive switching difficulty (same grid). Checked with 14 automated play tests in headless Edge.
- **Ideas to know:** one `game` state object is the source of truth; every action changes the state, then `render()` redraws the page from it. Keyboard input comes from `keydown` events.
- **Known for later:** phones need an on-screen keyboard (Step 26).

### ✅ Step 21: Win detection, timer and score
- **What:** a running timer, pause, a "You solved it!" screen, and a **score** based on time, difficulty and how many checks/reveals were used.
- **Done:** timer (pauses when the tab is hidden, stops on solve), win detection after every letter, a win panel, the board locks and turns green. Scoring designed by the project owner in `static/score.js`: **easy 100 / medium 150 / hard 200**, plus a **speed bonus starting at 100 that drops 10 per full minute** (never below 0), minus Check/Reveal penalties (Step 22). **Only daily puzzles earn points**, saved per daily in `localStorage` (`schmoll.dailyScores`, keyed by the daily's seed), and only the first solve of a day counts. **Streaks** (current and best consecutive days) are shown but never add points. Unlimited shows the time only. Verified with 16 automated browser checks.
- **Learned:** designing a scoring formula, why points are saved per daily and only once, streak counting across months.

### ✅ Step 22: Check and Reveal
- **What:** check or reveal a square, a word or the whole puzzle, and mark wrong letters (each use lowers the score).
- **Done:** Check and Reveal buttons for square / word / puzzle. Check marks wrong letters with a red slash (a new letter clears it); Reveal fills in correct letters, which stay marked (blue with a corner triangle) and can't be typed over. Penalties (owner's design): **-5 per square checked** (Check word = word length, Check puzzle = every open square) and **-10 per square revealed** (only empty or wrong squares count). **Reveal puzzle = surrender**: asks first, gives 0 points, is saved as surrendered (so no points from re-solving that daily) and doesn't count toward the streak. Verified with 22 automated browser checks.

---

## Phase 5: Modes, saving and launch 🔨

### ✅ Step 23: Daily and Unlimited modes
- **What:** a home screen to pick a mode. **Daily:** today's date is the seed (builds on 12a), the same puzzle for everyone, one per day, with a countdown to the next one. The player picks easy, medium or hard (same grid, different clues); **solving it at any one difficulty completes that day's daily.** **Unlimited:** a new random puzzle whenever you want.
- **Done (built by Claude):** a Home screen (Daily / Unlimited cards, today's status, countdown to the next daily, streak) and mode tabs; the URL after `#` picks the screen (`#daily`, `#unlimited`), so Back and bookmarks work. Unlimited has a New puzzle button and earns no points. Each mode keeps its game while you visit the other. Also in this step, at the owner's request: **board on the left, clues on the right** (stacked on phones), **easier clue definitions** for every difficulty, and **fewer hard words** (most SCOWL level-35 words moved to the too-hard list, keeping a hand-picked everyday list: 3,930 answers of 3–5 letters). Fixed: unlimited seeds are kept below 2^53 so JavaScript reads them exactly. Verified with 19 new browser checks (71 total).
- **Ideas to know:** one page with several screens shown/hidden by the URL hash; why big Java `long`s lose precision in JavaScript.

### 🔨 Step 24: Save progress, stats, scores and settings
- **What:** remember a half-finished puzzle, solve times, scores, daily streaks and win stats. A **settings** screen: difficulty, allow harder words (`SKIP_TOO_HARD_WORDS`), timer on/off, theme. Everything is saved in the browser (`localStorage`), with no accounts needed.
- **Will learn:** browser storage, JSON in JavaScript, designing a settings model.

### ⬜ Step 25: Tests
- **What:** move the PASS/FAIL checks in `main` into real JUnit tests.
- **Will learn:** JUnit, `mvn test`, why real test frameworks beat print statements.

### ⬜ Step 26: Mobile layout and deploy
- **What:** make it work on phones and put the website online so friends can play. The API key lives only on the server, and unlimited mode gets a rate limit so API costs stay small (the game is free with no ads).
- **Will learn:** responsive CSS, hosting a Java app, secrets in production, rate limiting.

---

## Commit history by step

| Step | Commit |
|---|---|
| 1–5 | `4c843c1` |
| 6–7 | `1e55c22` |
| 8 | `1290123` |
| 9 | `99dcf87` |
| 10 | `14f7f2f` |
| 11 | `aea7e7c` |
| 12a | `507da34` |
| 12b-1 | `ffe1057` |
| 12b-2 + refactor | `c5d4846` |
| 13 | `241bd98` |
| 13b-1 | `5ad9a31` |
| 13b-2 | `4f0dbca` |
| 13b-3 | `63bf476` |
| 14 | `84d4c1d` |
| 15 setup | `6d95a43` |
| 15a–15b | `0e81d0f` |
| 15c + 13c + website scope | `d4540c4` |
| 16a | `c553bff` |
| 16b | `25b4958` |
| 17 | `fba4275` |
| 18 | `56dfbde` |
| 19 | `19254f6` |
| 20 | `dbf7ee0` |
| 21 | `d32de58` |
| 22 | `3a9718e` |
| 23 | `a95bb6e` |
