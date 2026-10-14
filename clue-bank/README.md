# Clue bank

Every clue in the shipped campaign pool and dailies (2026-10-11 to 2026-11-29), written by Claude by hand
(no API calls) on 2026-10-10/11. Every row pairs a clue with a word from the word list, so the clue bank is
shared under CC BY-NC-SA 4.0 like the list (see ../NOTICE.md).

- `base-<difficulty>-NN.tsv`: one plain clue per answer at each difficulty (`WORD<tab>clue`).
- `st-<difficulty>-<style>-NN.tsv`: clues in a lesson's style (blank, pun, quote, example, double,
  misdirection, synonym, definition, theme-...). A clue of `-` means "this word doesn't suit the style".
- Scripts (Python 3, run with `-I`):
  - `check.py <set>`: finds clues that give away their answer, long or duplicate clues, and missing words.
  - `needs.py --write`: works out which styled clues are still needed.
  - `nextst.py <difficulty> <style> N`: lists the next words to write.
  - `fix.py <file>`: replaces clues from stdin.
  - `seed.py <from> <to> <style>`: copies a style's clues from one difficulty to another.
  - `convert.py`: builds one clue map per staged puzzle for `PuzzleBatch assemble`.
  - `audit.py`: reports each lesson's share of its style.

  `cw.py` holds the shared helpers; its `ROOT` path points at `target/puzzle-batch`.

To make more puzzles without the API:

1. Run `PuzzleBatch grids`, then `export`.
2. Write clues for any new words.
3. Run `convert.py`, then `PuzzleBatch assemble`.

## The 2026-10-11/14 rebuild

The campaign pool was rebuilt so every level has its own 25 puzzles, about a quarter easier: boards are seeded by a hash of their name, picked by word difficulty (`target/puzzle-batch/wordscore.tsv`, `ease.json`), and checked for duplicates across levels (a boss's own board may repeat). `convert.py` gives each campaign puzzle a quarter of its plain clues from the next easier difficulty.
