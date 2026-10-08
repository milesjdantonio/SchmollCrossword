# Schmoll Crossword: Full Roadmap

Every step needed to go from an empty Java project to a mini crossword **website** with a daily puzzle (the same for everyone), an unlimited mode, scores, stats and settings.
Each step is set up like a LeetCode problem: a problem statement, an empty method, and PASS/FAIL tests in `main`.

Legend: ✅ done · 🔨 in progress · ⬜ not started

**Progress: 17 of 27 steps done.** The generator makes Wordle-level puzzles with AI-written clues. Next: package them for a website with daily and unlimited modes.

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

## Phase 4: Make it a website ⬜

### 🔨 Step 17: Save generated puzzles (daily = same for everyone)
- **What:** the daily puzzle must be identical for every player, but Claude writes different clues on every call. So each day's puzzle (per difficulty) is generated **once**, saved as a JSON file, and every player is served that saved copy. Unlimited puzzles can be generated on demand (or pre-generated in batches to control API cost).
- **Will learn:** reading and writing files, caching, why "same input, same output" matters.

### ⬜ Step 18: Backend API (Spring Boot)
- **What:** a small web server with endpoints like `GET /api/daily?difficulty=medium` and `GET /api/unlimited?difficulty=hard`, which return puzzles as JSON. It also serves the website's files.
- **Will learn:** HTTP, REST endpoints, Spring Boot basics, keeping the API key on the server only.

### ⬜ Step 19: Game board UI
- **What:** a web page (HTML/CSS/JavaScript) that draws the grid with numbers and lists the clues, in Schmoll Crossword's own visual style.
- **Will learn:** HTML structure, CSS grid layout, `fetch` to call your API.

### ⬜ Step 20: Controls
- **What:** click to select, type to fill, Backspace, arrow keys, Across/Down toggle, highlight the current word and clue.
- **Will learn:** keyboard and mouse events, keeping UI state in sync.

### ⬜ Step 21: Win detection, timer and score
- **What:** a running timer, pause, a "You solved it!" screen, and a **score** based on time, difficulty and how many checks/reveals were used.
- **Will learn:** `setInterval`, comparing the player's grid to the answer, designing a scoring formula.

### ⬜ Step 22: Check and Reveal
- **What:** check or reveal a square, a word or the whole puzzle, and mark wrong letters (each use lowers the score).
- **Will learn:** reusing slot logic on the frontend.

---

## Phase 5: Modes, saving and launch ⬜

### ⬜ Step 23: Daily and Unlimited modes
- **What:** a home screen to pick a mode. **Daily:** today's date is the seed (builds on 12a), the same puzzle for everyone, one per day, with a countdown to the next one. **Unlimited:** a new random puzzle whenever you want.
- **Will learn:** dates and time zones, turning a date into a seed, routing between screens.

### ⬜ Step 24: Save progress, stats, scores and settings
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
