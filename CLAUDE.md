# CLAUDE.md

Context for Claude Code when working in this repository.

## About the project and the user

- A Java crossword **generator**: it fills a grid of black/open squares with dictionary words using backtracking.
- **This is a learning project.** The user is learning Java, Git/GitHub and AI-assisted coding ("vibe coding") as they go.
  - Explain new terms and concepts in plain language when you introduce them.
  - Prefer guiding the user through each step over writing large chunks of code all at once. Keep changes small and focused on the current step.
  - Keep the user's existing learning comments in the code (e.g. the import comments in `App.java`). Don't strip them out.
- The full step-by-step roadmap lives in [README.md](README.md). **When a step is finished, update the roadmap there**: move the 🔨 "YOU ARE HERE" marker and keep the "Current status" section below in sync.

## Current status

- **Done:** Steps 1–5 (Maven setup, word loading, grid representation, slot finding, `Slot.getCells()`).
- **Current step:** Step 6, implementing `Slot.getPattern(char[][] filledGrid)` in `src/main/java/com/crossword/Slot.java`. It should return a string such as `"C.T.."` built from the slot's cells (`.` = empty). The body is empty, so **the project does not compile yet**.
- **Known bug:** in `App.loadWords()`, `if (word.isEmpty());` has a stray semicolon and does nothing. It should be `continue;`.
- **Next:** Step 7, pattern → matching words.

## Build and run

- Java 17 (set in `pom.xml`), Maven. No dependencies yet, and no tests yet.
- Compile: `mvn compile`
- Run: `mvn exec:java -Dexec.mainClass=com.crossword.App`, or run `App.main` from the IDE.
- The shell is Windows (PowerShell / Git Bash), and the project lives inside OneDrive.

## Code layout

- `App.java` has `main` (prints word counts for lengths 3–7, builds a hard-coded 5×5 grid and prints all slots) and `loadWords()` (reads `words.txt` from the classpath and returns `Map<Integer, List<String>>` keyed by length; words are uppercased).
- `Slot.java` describes one across/down word position (`startRow`, `startCol`, `length`, `isAcross`).
  - `findAllSlots` / `findAcrossSlots` / `findDownSlots` scan for runs of 3 or more open squares.
  - `getCells()` returns the list of `{row, col}` for the slot.
  - `getPattern()` is a stub (current step).
- `src/main/resources/words.txt` is a dictionary of about 172k lowercase words, one per line.

## Conventions

- Grids: `boolean[][] blackSquares` (`true` = black), `char[][] filledGrid` (`'.'` = empty). Grids are square (`size = blackSquares.length`).
- The minimum word/slot length is 3.
- Package `com.crossword`. Fields are package-private, with no getters/setters so far. Match this simple style unless the user asks to refactor.
- `target/` is build output and is git-ignored.
