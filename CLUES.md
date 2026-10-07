# Clue Research (Step 15)

Where the game's clues can come from, and what each option's license allows.
Researched 2026-10-07. Rule from CLAUDE.md: **never copy NYT (or any published puzzle's) clues.**

---

## What's needed

Every answer the generator can place needs a clue. The grid is 5×5, so the words that matter are the
**6,695 answer words of 3–5 letters** in `words.txt` (after the blocklist).

---

## Option 3: an openly licensed clue source

### Crossword clue datasets: ❌ none usable

Every crossword clue collection found was scraped from **published puzzles**, so the clues belong to those
publishers or constructors, whatever license the dataset's code carries:

| Dataset | Where the clues come from | Usable? |
|---|---|---|
| "Down and Across" (NLP benchmark) | 25 years of New York Times crosswords | ❌ NYT content, explicitly banned in CLAUDE.md |
| xd corpus (Saul Pwanson) | ~52,000 scraped puzzles (NYT, USA Today, ...) | ❌ publishers' copyright |
| Cryptonite (Apache-2.0 code) | Cryptic crosswords from British newspapers | ❌ newspaper clues, and cryptic style doesn't suit a mini |
| EnigmaEval | Puzzle hunts / cryptics; needs authors' permission | ❌ |
| Clue-Instruct | Clues generated from Wikipedia pages for educational crosswords | ❌ no license found, and it covers Wikipedia topics, not everyday words |

### Dictionary definitions: ⚠️ usable, but not as finished clues

**Open English WordNet 2024**: CC BY 4.0 (any use, including commercial, with credit).

Coverage of the 6,695 answer words:

| | Words |
|---|---|
| Base word has a definition | 4,740 |
| Found through a listed form (e.g. irregular plural) | 122 |
| Found by stripping -s / -ed / -ing / -er | 1,660 |
| **Not found** (e.g. `gosh`, `psst`, `meh`, `veep`, `satay`, `them`) | 173 |
| **Total covered** | **6,522 (97%)** |

But the definitions **aren't good crossword clues as they are**:
- **Too long and formal.** `ROAMS` gives "move about aimlessly or without any destination, often in search of food or employment".
- **The first sense listed is often the wrong one.** `SAX` gives "a Belgian maker of musical instruments who invented the saxophone", and `SHOTS` gives "varying in color when seen in different lights".
- **Some contain the answer itself.** `SAX` → "...invented the **sax**ophone".
- **Inflected answers need rewording.** `ROAMS` needs "Moves about aimlessly", not "move about...".

**Conclusion:** no ready-to-use open clue source exists. WordNet is a good *reference* to help write clues (which meaning a word has, what it is), but the clues themselves need to be written, per option 2.

---

## Option 2: AI-written clues

Write original, short clues for the 6,695 words with AI help, check them, and store them in a `clues.txt` file
that ships with the game (generated once, so no AI is needed while people play).
WordNet definitions can be given to the AI as background, so it picks a real meaning of the word.
If WordNet is used this way, credit it (CC BY 4.0) in the notice file.

---

## Decision (2026-10-07)

The project owner chose **option 2 with a twist**: no stored clue file. Each time a puzzle is made, its ~10 answers are sent to the
Claude API (`claude-opus-5-5`), which writes fresh clues at the chosen difficulty (easy / medium / hard). The code checks every
clue (none missing, none containing its answer) before players see it. WordNet is not used for now.

---

## Sources

- Open English WordNet: https://en-word.net/ · https://github.com/globalwordnet/english-wordnet (license: CC BY 4.0)
  - Download used: https://github.com/globalwordnet/english-wordnet/releases/download/2024-edition/english-wordnet-2024.xml.gz
  - Archive listing: https://ota.ox.ac.uk/llds/xmlui/handle/20.500.14106/2571-2024
- "Down and Across" (NYT clue benchmark): https://deepai.org/publication/down-and-across-introducing-crossword-solving-as-a-new-nlp-benchmark
- xd corpus and the 2016 USA Today plagiarism story: https://developers.slashdot.org/story/16/03/06/1618217/crossword-database-analysis-spots-what-looks-like-plagiarism
- Cryptonite: https://huggingface.co/datasets/cryptonite/blob/main/cryptonite.py
- Cryptic clue datasets and their sources: https://cryptics.georgeho.org/datasheet
- EnigmaEval: https://huggingface.co/datasets/ScaleAI/EnigmaEval-archived
- Clue-Instruct: https://www.arxiv.org/abs/2404.06186
- Hugging Face CC0 dataset search (no crossword clue sets found): https://huggingface.co/datasets?license=license%3Acc0-1.0
