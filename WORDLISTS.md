# Word List Research (Step 13)

Notes on where the game's answer words come from, their licenses, and how each candidate performed.
Researched 2026-10-07.

---

## The problem

The current `src/main/resources/words.txt` is the ENABLE list (172,820 words). It's built for Scrabble, so the solver happily fills grids with words no player would guess:

```
D A R B #      DARB, ERST, YETT, ANELE, AALII, LYTTA, IODID ...
U N A R Y
E E R I E
S L E E T
# E R S T
```

---

## Candidates

| List | License | Can we use it? | Words (letters only) | 3 / 4 / 5-letter |
|---|---|---|---|---|
| **ENABLE** (current) | Public domain | ✅ | 172,820 | 972 / 3,903 / 8,636 |
| **SCOWL size 35** | Permissive (keep copyright notice) | ✅ | 39,097 | 480 / 1,878 / 3,462 |
| **SCOWL size 50** | Permissive (keep copyright notice) | ✅ | 61,494 | 586 / 2,302 / 4,443 |
| **Spread the Wordlist, score ≥ 50** | CC BY-NC-SA 4.0 | ⚠️ Yes for a free game, with attribution. No commercial use, and edited versions of the list must use the same license. | 120,984 | 1,621 / 3,716 / 7,593 |
| **Peter Broda's crossword list** | **None stated** (see below) | ❌ Not without written permission | ~427,000–527,000 (scored 1–100) | not tested |
| 12dicts (Alan Beale) | Permissive | (Already part of SCOWL, so not tested separately) | | |

"Letters only" means words with apostrophes, hyphens, capitals (proper names) or accents were removed.

### Peter Broda's list in detail
- One of the best-known free crossword lists, collected and scored by Peter Broda for over a decade. It's very large, with scores from 1 to 100.
- **No license or terms of use** appear on his site or on the crossword-tool pages that link to it. Without a license, the default is "all rights reserved". Constructors use it privately to build puzzles, but **putting the file into a public GitHub repo** would need his permission.
- Availability: a 2024-01-07 notice on his site says a server failure lost data, and only the *unscored grid text* list can be downloaded for now. The site's HTTPS certificate had also expired when this was checked.
- Others warn that it "may contain some controversial / objectionable entries". Trimmed versions exist (Mark Diehl's "Trimmed Broda", Chris Jones' subsets), but those inherit the same unclear license.
- **To use it:** email Peter for written permission. The contact is on his wordlist page, written as a puzzle (peter·bananarchy at gmail).

---

## How the solver did with each list

Same 5×5 grid, seeds 1–10, using the project's own `solve` (most-constrained first + shuffle).

| List | Solved | Total time (10 puzzles) | Slowest puzzle |
|---|---|---|---|
| ENABLE (current) | 10/10 | 2.1 s | 0.5 s |
| SCOWL 35 | 10/10 | 15.2 s | 5.0 s |
| SCOWL 50 | 10/10 | 2.3 s | 1.2 s |
| Spread the Wordlist ≥ 50 | 10/10 | 1.3 s | 0.5 s |

### Sample answers (the 10 words in one puzzle)

**SCOWL 35:** everyday words, but the smallest list, so it's the slowest.
- seed 2: PEST RAPID AGILE MENDS REEK PRAM EAGER SPINE TILDE DESK
- seed 7: MOOS IMPEL SIEVE STREW SAND MISS OMITS OPERA SEVEN LEWD

**SCOWL 50:** mostly everyday words, and fast.
- seed 4: STIR CANON AMUSE MERES REST SCAM TAMER INURE ROSES NEST
- seed 10: BLAH OUTED ANODE TANGS REEK BOAT LUNAR ATONE HEDGE DESK

**Spread the Wordlist ≥ 50:** real crossword fill, so full of names, abbreviations and phrases.
- seed 3: NOSE ENTRE YEARS ONTOP DERN NEYO ONEND STATE ERROR ESPN
- seed 2: FAQS ALUMS SARAH OMARI ONTV FASO ALAMO QURAN SMART SHIV

Good for experienced solvers, but answers like `NEYO`, `HMART` and `ONTV` need trivia clues, and phrases like `HADTO` and `AIMAT` need the game to handle multi-word answers.

---

## ⚠️ Offensive and sensitive words

Every list produced words that don't belong in a casual game:
- SCOWL 35 made `WHORE` (seed 8).
- SCOWL 50 made `TITS` (seed 9).

Whatever list is chosen needs a **blocklist**: a small file of words the generator must never use.

---

## First recommendation (before combining)

**SCOWL size 50 + a blocklist.**
- Everyday words a normal player can guess.
- About as fast as the current list.
- A simple permissive license (just keep the copyright notice).
- No multi-word phrases or names to handle.

---

## Combining SCOWL with Spread the Wordlist

The project owner confirmed the game is **free with no ads**, which Spread the Wordlist's license allows, and asked to combine the lists.
Four combinations were built (blocked words removed) and benchmarked with the same 10 seeds:

| Combination | Words | 10 puzzles | Sample answers | Verdict |
|---|---|---|---|---|
| **A: SCOWL 50 ∩ STWL ≥ 50** | 38,576 | 5.4 s (max 1.9 s) | SOCK, AVOID, BAYOU, LOYAL, BODY, STAKE, DESK | ✅ **chosen**, cleanest answers |
| B: SCOWL 60 ∩ STWL ≥ 50 | 42,154 | 7.3 s | ZEAL, IGLOO, SACRA, STET, OPED | a few odd words |
| C: SCOWL 70 ∩ STWL ≥ 50 | 44,448 | 3.8 s | YENTA, MUDRA, UMPED, PRANA, SCHMO | getting obscure |
| D: SCOWL 50 ∩ STWL ≥ 40 | 43,451 | 7.2 s | UTERI, YEPS, YESES, MISDO | lower-rated words get in |

("∩" means "words in both lists".)

Why A works: each list filters the other. SCOWL keeps out crossword-only names, abbreviations and phrases. Spread the Wordlist removes 602 odd SCOWL words of 3–5 letters (`abaft`, `bract`, `curer`, `oaten`, `lorn`) and most offensive words. A few blocked words survive (10 after the project owner extended the list), so the blocklist is still needed.

---

## Decision (2026-10-07)

**Words in both SCOWL 50 and Spread the Wordlist (score ≥ 50), plus a blocklist file**, chosen by the project owner.

What went into the project:
- `src/main/resources/words.txt`: 38,584 words, letters a–z only. Blocked words are kept in the file and skipped by the code at load time, so the blocklist stays a separate, easy-to-edit list.
- `src/main/resources/WORDLIST-NOTICE.txt`: credits both sources, describes the changes and states that `words.txt` is under **CC BY-NC-SA 4.0** (required because it's adapted from Spread the Wordlist). The game's code stays MIT.
- `src/main/resources/SCOWL-Copyright.txt`: SCOWL's `Copyright` file, copied unchanged as its license requires.
- `src/main/resources/blocked-words.txt`: started with 36 slurs, profanity and sexual/violent terms. The project owner extended it to 52 (adding words like `chink`, `cracker`, `faggot`, `retard`, `hoe`, `cuck`, and removing `queer`). 10 of them appear in `words.txt` (`anal`, `ass`, `asses`, `cock`, `cracker`, `dick`, `hoe`, `hoes`, `horny`, `tit`). Format: lowercase, one word per line, sorted, no duplicates. Milder words (`damn`, `hell`, `crap`, `butt`) were left in.

**What this means going forward:** because of the NonCommercial license, the game must stay free, with no ads or paid features, unless the word list is replaced.

---

## Too-hard list (Step 13c, 2026-10-07)

The project owner wants **nothing harder than a Wordle answer**. The combined list still had words like
OVOID, UVULA, XYLEM, AVAST, EWER and TIDED, so `src/main/resources/too-hard-words.txt` now lists words to skip:

- **Every SCOWL level 40/50 word** (the least common we kept), **except** a hand-picked keep list of everyday words
  (EMOJI, NINJA, WIKI, DECAF, VEGAN, ADIEU, LEMUR, PIXEL, TRYST...).
- **Archaic, odd or crossword-only words from level 35** (EKED, METE, LIEU, DEIGN, ABLER, UTERI, TIDED...).
- Result: 849 of the 6,695 three-to-five-letter answers are skipped, leaving 5,847.

**Update (Step 23, after playing):** the project owner asked for fewer hard words, so every SCOWL **level-35** word
was also moved to the too-hard list **except** a hand-picked list of everyday words (CABIN, BANJO, CLAW, PIER...).
CYST, MITES, WOMB, OVARY and COTS are now skipped. Answers of 3–5 letters: 5,847 → **3,930**; the solver still fills
20/20 test grids in about a second. Example answers now: WADE, AGING, LATTE, LITER, NORM, WALL, AGAIN, DITTO, ENTER, GERM.

It was judged by Claude, not copied from any list. **The NYT's Wordle answer list was deliberately not used** (NYT content).
The setting `App.SKIP_TOO_HARD_WORDS` (default `true`) turns the filter off; offensive words stay blocked either way.
Edit the file to add or remove words.

---

## Sources

- **SCOWL** (Spell Checker Oriented Word Lists), Kevin Atkinson
  - Site: http://wordlist.aspell.net/
  - Download used: https://sourceforge.net/projects/wordlist/files/SCOWL/2020.12.07/scowl-2020.12.07.tar.gz/download
  - License: the `Copyright` file in the download ("Permission to use, copy, modify, distribute and sell these word lists ... provided that the above copyright notice appears in all copies").
  - Size levels explained: https://sources.debian.org/src/scowl/2020.12.07-4/README
  - Copyright summary: https://sources.debian.org/src/scowl/6-3/debian/copyright
- **12dicts**, Alan Beale (included in SCOWL)
  - Readme: https://wordlist.aspell.net/12dicts-readme/
- **Spread the Word(list)**
  - Site, license and downloads: https://www.spreadthewordlist.com/
  - Download used: https://www.spreadthewordlist.com/downloads/spreadthewordlist_caps.txt (format: `WORD;score`)
  - License: CC BY-NC-SA 4.0. Free products with attribution are allowed.
  - Exact license wording: "spread the word(list) is licensed under CC BY-NC-SA 4.0" and "you're welcome to use spread the word(list) in a product you're offering free of charge (with attribution) as well as to sell crossword puzzles you've constructed using spread the word(list)."
- **Peter Broda's Wordlist**
  - Page: https://peterbroda.me/crosswords/wordlist/ (no license stated; 2024-01-07 "limited availability" notice)
  - Listed on: https://communicrossings.com/constructing-crosswords-tools ("Broda's list is large and may contain some controversial / objectionable entries. Diehl and Jones have created subsets.")
  - Related: https://github.com/gregpoulos/crossword-owl (an open word list project for constructors)
- **Overview of crossword word lists** (sizes, costs, scoring): https://tcampbell.substack.com/p/shopping-for-wordlists
- **ENABLE** (current `words.txt`): public domain Scrabble-style list. The original download source wasn't recorded when it was added.

## Design pass: an easier list for Easy (2026-10-08)

Difficulty now picks the answer words. **Easy** uses only everyday answers that are also in SCOWL size levels
10 or 20 (the most common English words). The other 1,389 everyday answers are listed in
`src/main/resources/not-easy-words.txt` (generated from the same SCOWL 2020.12.07 release linked below:
`english-words.10/20` + `american-words.10/20`). It is derived from SCOWL and the existing list, so the same
licenses and notices apply. Medium = the everyday list.

Later the same day the user found words like INCUR and LEST in an easy puzzle, so Claude went through every easy
answer by hand and added 124 more to `not-easy-words.txt` (now 1,513 words): formal or old-fashioned words (LEST,
ERGO, HENCE, THOU), British words (CHAP, DAFT, PENCE, VICAR), jargon (NODE, SINE, PARSE, SIGMA), and words that
are awkward to clue in a family puzzle (DAMN, SEXY, MORON).

Then the user went the other way through the start of the list (A to BALD) and moved everyday words with one clear,
concrete meaning back into Easy (ACHOO, ACNE, ACRE, ANKLE, ANT, AQUA, ATTIC, BAKER, BALD), and asked Claude to do the
same for the rest. Claude moved 525 more back (BARN, CANDY, DEER, GOOSE, IGLOO, LAMB, PUPPY, SHARK, TACO, ZEBRA...),
keeping out niche, slangy or dated ones (BANAL, DWEEB, FJORD, KUDZU, MATZO, SWAMI). `not-easy-words.txt` now has
977 words, which leaves **2,953 easy answers** of 3–5 letters.

**Hard** adds the less common words (the level-35 words that Step 23 moved into the too-hard list), but skips the
extremely hard ones: `very-hard-words.txt` (9,336 words) is exactly the Step 13c too-hard list (all SCOWL level
40/50 words except the everyday keep list, plus archaic/crossword-only level-35 words like EKED and METE).
Settings "Allow extremely hard words in Unlimited Hard" adds them back; the daily never uses them.

## Fonts (design pass)

All loaded from Google Fonts, and all under the SIL Open Font License 1.1, which allows free use on websites:

- **Nunito** and **Caveat** (Notebook text and headings). https://fonts.google.com/specimen/Nunito ,
  https://fonts.google.com/specimen/Caveat
- **Patrick Hand** (Notebook's handwriting). https://fonts.google.com/specimen/Patrick+Hand
- **Orbitron** and **Exo 2** (Deep Space). https://fonts.google.com/specimen/Orbitron ,
  https://fonts.google.com/specimen/Exo+2
- **Fredoka** (Garden). https://fonts.google.com/specimen/Fredoka
- **Press Start 2P** and **VT323** (Neon Arcade). https://fonts.google.com/specimen/Press+Start+2P ,
  https://fonts.google.com/specimen/VT323
- **Sniglet** and **Quicksand** (Snow Day). https://fonts.google.com/specimen/Sniglet ,
  https://fonts.google.com/specimen/Quicksand
- **Patua One** (Acorn Woods). https://fonts.google.com/specimen/Patua+One
- Sounds are generated in code (Web Audio API), so there are no sound files or licenses.
