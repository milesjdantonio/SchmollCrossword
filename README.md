# Schmoll Crossword

A crossword puzzle **generator** written in Java. You give it a grid shape (which squares are black), and it fills every open square with letters so that every across and down word is a real word from a dictionary.

> This is a learning project, built step by step with help from Claude ("vibe coding"). The roadmap below shows every step of the full project and marks where things currently stand.

---

## How it works (the big idea)

1. **Load a dictionary** of ~172,000 words and sort them into buckets by length.
2. **Describe the grid** as a 2D array of `true` (black square) / `false` (open square).
3. **Find the slots.** A *slot* is any run of 3+ open squares going across or down. Each slot needs one word.
4. **Fill the slots** one at a time. For each slot, look at the letters already placed (its *pattern*, e.g. `C.T`) and try words that fit.
5. **Backtrack** when stuck. If no word fits a slot, undo the last word and try the next option. Repeat until the grid is full (or every option has been tried).

---

## Project structure

```
SchmollCrosswordMain/
├── pom.xml                              # Maven build config (Java 17)
├── src/main/java/com/crossword/
│   ├── App.java                         # Entry point: loads words, builds grid, prints slots
│   └── Slot.java                        # One across/down word position in the grid
└── src/main/resources/
    └── words.txt                        # Dictionary, one lowercase word per line
```

---

## Roadmap

Legend: ✅ done · 🔨 **in progress (you are here)** · ⬜ not started

### Phase 1: Foundations
- ✅ **Step 1: Project setup.** Maven project, `com.crossword` package, Java 17.
- ✅ **Step 2: Load the dictionary.** `App.loadWords()` reads `words.txt` from resources and groups words by length into a `Map<Integer, List<String>>`.
  - ⚠️ Small bug to fix: `if (word.isEmpty());` has a stray semicolon, so it does nothing. It should be `if (word.isEmpty()) continue;`.
- ✅ **Step 3: Represent the grid.** `boolean[][] blackSquares` for the shape, `char[][] filledGrid` for the letters (`.` = empty).
- ✅ **Step 4: Find all slots.** `Slot.findAcrossSlots()` / `findDownSlots()` scan each row/column for runs of 3+ open squares.
- ✅ **Step 5: List a slot's cells.** `Slot.getCells()` returns the `(row, col)` of every square in a slot.

### Phase 2: Filling the grid
- 🔨 **Step 6: Read a slot's pattern. ← YOU ARE HERE**
  `Slot.getPattern(char[][] filledGrid)` should walk the slot's cells and build a string like `"C.T.."` from the grid. The method exists but its body is empty, so **the project doesn't compile right now.**
- ⬜ **Step 7: Find matching words.** Given a pattern, return every word of the right length that matches (`.` matches any letter).
- ⬜ **Step 8: Place and remove words.** Write a word into the grid along a slot, and undo it later (remember which letters were already there so you don't erase crossing words).
- ⬜ **Step 9: Backtracking solver.** A recursive `solve()` that picks an unfilled slot, tries each matching word, recurses, and undoes the word if the recursion fails.
- ⬜ **Step 10: Print the finished grid.** Show the filled grid nicely, with `#` for black squares.

### Phase 3: Making it smart and fast
- ⬜ **Step 11: No repeated words.** Track used words so the same word isn't placed twice.
- ⬜ **Step 12: Most-constrained slot first.** Fill the slot with the *fewest* matching words next. This makes solving much faster.
- ⬜ **Step 13: Shuffle candidates.** Randomize word order so each run gives a different puzzle.
- ⬜ **Step 14: Faster pattern lookup.** Pre-index words (e.g. by position and letter) so matching doesn't scan the whole list every time.

### Phase 4: Quality
- ⬜ **Step 15: Unit tests.** Add JUnit and test slot finding, pattern matching and the solver on small grids.
- ⬜ **Step 16: Clean up the dictionary.** Filter out obscure or unwanted words, or switch to a curated crossword word list.

### Phase 5: Bigger puzzles and a real app
- ⬜ **Step 17: Bigger grids and grid templates.** Support 7×7, 11×11 and 15×15, load grid shapes from files, and enforce rotational symmetry.
- ⬜ **Step 18: Clue numbering.** Number squares the way real crosswords do (1-Across, 2-Down, …).
- ⬜ **Step 19: Clues.** Attach a clue to each word (from a clue database, or generated).
- ⬜ **Step 20: Backend API.** Expose puzzle generation over HTTP (the artifact is named `crossword-backend`). Spring Boot is the usual choice.
- ⬜ **Step 21: Frontend.** A web page where someone can actually play the puzzle.

---

## Running it

Requires **Java 17+** and **Maven**.

```bash
mvn compile
mvn exec:java -Dexec.mainClass=com.crossword.App
```

(`exec:java` needs the `exec-maven-plugin`; Maven will download it the first time.) Or run `App.java` directly from VS Code with the ▶ Run button.

> Right now the build fails until Step 6 (`getPattern`) has a body.

---

## Glossary: terms you'll run into

| Term | What it means here |
|---|---|
| **Vibe coding** | Building software by describing what you want to an AI and iterating on what it produces, instead of writing every line from scratch. |
| **Maven** | A Java build tool. `pom.xml` tells it the Java version, dependencies and how to build. |
| **`pom.xml`** | "Project Object Model." Maven's config file. |
| **Resources folder** | `src/main/resources` holds non-code files (like `words.txt`) that get bundled with the program. |
| **Slot** | One place in the grid where a word goes: a start square, a direction (across/down) and a length. |
| **Pattern** | The letters already in a slot, with `.` for blanks, e.g. `C.T`. |
| **Backtracking** | Try a choice → go deeper → if you hit a dead end, undo the choice and try the next one. This is how the solver will search. |
| **Recursion** | A method that calls itself on a smaller problem. The solver will be recursive. |
| **Heuristic** | A rule of thumb that makes a search faster (e.g. "fill the hardest slot first"). |
| **Constraint** | A rule a solution must follow (e.g. crossing words share a letter). Crossword filling is a *constraint satisfaction problem*. |
| **`HashMap`** | Stores key → value pairs with very fast lookup. Here: word length → list of words. |
| **Lambda** (`k -> new ArrayList<>()`) | A tiny unnamed function you pass around as a value. |
| **`try`-with-resources** | `try (Reader r = ...) { }` automatically closes the file when done. |
| **Git** | Tracks every version of your code locally. |
| **GitHub** | A website that hosts your Git repository online. |
| **Commit** | A saved snapshot of your code with a message describing the change. |
| **Push / Pull** | Send your commits to GitHub / bring GitHub's commits down to your computer. |
| **Remote / `origin`** | The online copy of your repo. `origin` is its default nickname. |
| **`.gitignore`** | A list of files Git should not track (like the `target/` build folder). |
| **README.md** | The front page of a repo. It explains what the project is (this file!). |
| **CLAUDE.md** | Instructions and context that Claude Code reads automatically when working in this project. |
