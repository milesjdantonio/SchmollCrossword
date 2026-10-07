# Schmoll Crossword: Full Roadmap

Every step needed to go from an empty Java project to a playable daily mini crossword.
Each step is set up like a LeetCode problem: a problem statement, an empty method, and PASS/FAIL tests in `main`.

Legend: ✅ done · 🔨 in progress · ⬜ not started

**Progress: 12 of 26 steps done.** Phase 2 is complete: the program generates a new, valid 5×5 grid for any seed.

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

## Phase 3: Turn the grid into a real crossword 🔨

### 🔨 Step 13: Use a player-friendly word list
- **What:** replace `words.txt` (full of words like `AALII` and `SCEND`) with common words a normal person can guess.
- **Will learn:** finding and checking the license of a data source, cleaning and filtering data.

### ⬜ Step 14: Clue numbering
- **What:** number squares the crossword way: scan left→right, top→bottom, and number every square that starts an Across or Down answer.
- **Will learn:** grid scanning with neighbor checks.
- **LeetCode:** 36. Valid Sudoku, 200. Number of Islands

### ⬜ Step 15: Clues
- **What:** give every answer an original clue, starting with a `word → clue` file.
- **Will learn:** parsing a file into a `HashMap`, handling missing data.
- **LeetCode:** 1. Two Sum (hash lookups)

### ⬜ Step 16: A `Puzzle` object
- **What:** bundle the grid, answers, numbers and clues into one class and turn it into JSON.
- **Will learn:** designing a class, your first Maven dependency (a JSON library), serialization.
- **LeetCode:** 297. Serialize and Deserialize Binary Tree

---

## Phase 4: Make it playable ⬜

### ⬜ Step 17: Console version (optional warm-up)
- **What:** play in the terminal: type `1A CAT`, see the grid update, and win.
- **Will learn:** reading user input with `Scanner`, a game loop, parsing commands.

### ⬜ Step 18: Backend API
- **What:** a small Spring Boot server with `GET /api/puzzle` that returns a puzzle as JSON.
- **Will learn:** HTTP, REST endpoints, Spring Boot basics.

### ⬜ Step 19: Game board UI
- **What:** a web page (HTML/CSS/JavaScript) that draws the grid with numbers and lists the clues.
- **Will learn:** HTML structure, CSS grid layout, `fetch` to call your API.

### ⬜ Step 20: Controls
- **What:** click to select, type to fill, Backspace, arrow keys, Across/Down toggle, highlight the current word and clue.
- **Will learn:** keyboard and mouse events, keeping UI state in sync.

### ⬜ Step 21: Win detection and timer
- **What:** a running timer, pause, and a "You solved it!" screen with the final time.
- **Will learn:** `setInterval`, comparing the player's grid to the answer.

### ⬜ Step 22: Check and Reveal
- **What:** check or reveal a square, a word or the whole puzzle, and mark wrong letters.
- **Will learn:** reusing slot logic on the frontend.

---

## Phase 5: Polish ⬜

### ⬜ Step 23: Daily puzzle
- **What:** use today's date as the random seed, so everyone gets the same puzzle each day (builds on 12a).
- **Will learn:** dates in Java, turning a date into a seed.

### ⬜ Step 24: Save progress and stats
- **What:** remember a half-finished puzzle, solve times and streaks.
- **Will learn:** browser `localStorage`, JSON in JavaScript.

### ⬜ Step 25: Tests
- **What:** move the PASS/FAIL checks in `main` into real JUnit tests.
- **Will learn:** JUnit, `mvn test`, why real test frameworks beat print statements.

### ⬜ Step 26: Mobile layout and deploy
- **What:** make it work on phones and put it online so friends can play.
- **Will learn:** responsive CSS, hosting a Java app.

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
