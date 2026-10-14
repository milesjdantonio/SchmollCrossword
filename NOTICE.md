# Licenses: what covers what

Schmoll Crossword mixes code, data and media under different licenses. This file lists which license
applies to which files. Anything not listed below is under the **MIT License** in [LICENSE](LICENSE),
© 2026 Miles D'Antonio.

## CC BY-NC-SA 4.0: the word lists and everything built from them

The answer list is adapted from **Spread the Word(list)** by Brooke Husic and Enrique Henestroza Anguiano,
which is licensed under [Creative Commons Attribution-NonCommercial-ShareAlike 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).
ShareAlike means adaptations must carry the same license, so these files are shared under
**CC BY-NC-SA 4.0**, not MIT:

| Files | What they are |
|---|---|
| `src/main/resources/words.txt` | The answer list: words in both SCOWL and Spread the Word(list). Changes are described in `WORDLIST-NOTICE.txt`. |
| `src/main/resources/too-hard-words.txt`, `not-easy-words.txt`, `very-hard-words.txt` | Difficulty filters chosen from that list. |
| `src/main/resources/campaign/`, `src/main/resources/daily/` | Puzzles made ahead of time, filled with words from the list. |
| `clue-bank/*.tsv`, `clue-bank/plan.json`, `clue-bank/needs.json` | The clue bank: a clue for each answer word. |
| `puzzles/` (made while the game runs; not in the repository) | Generated daily, campaign and Unlimited puzzles. |

You may copy, change and share these files **for non-commercial purposes only**, with credit to the
authors above and to this project, and only under the same license. That is why the game stays free,
with no ads and no paid features.

**SCOWL** (Spell Checker Oriented Word Lists) by Kevin Atkinson is the other source of `words.txt`. Its
permissive license notice, `src/main/resources/SCOWL-Copyright.txt`, must stay with the word list.

## Public domain (CC0 1.0): recorded sounds and music

Every recorded file in `src/main/resources/static/audio/` comes from [Kenney](https://kenney.nl/) or from
artists on [OpenGameArt](https://opengameart.org/) under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Each track, its author and its page are listed in
`src/main/resources/static/audio/CREDITS.txt` and on the game's Credits page. The songs were edited for the
game (cut, looped and mastered). The edits add no new restrictions.

The pieces composed for the game (the story music, the win and lose music, the Sphinx's second song and
Thunderhead's chorus) are covered by the MIT License with the code. They were rendered with the
[GeneralUser GS](https://schristiancollins.com/generaluser.php) SoundFont by S. Christian Collins, whose
license allows any use of music made with it.

## SIL Open Font License: fonts

The game's fonts (Nunito, Caveat, Patrick Hand, Orbitron and the rest listed on the About card) come from
[Google Fonts](https://fonts.google.com/) and are served from this site (`src/main/resources/static/fonts/`) under the
[SIL Open Font License 1.1](https://openfontlicense.org/). Each font's license, with its copyright line, is in
`static/fonts/OFL/`. Fonts whose license reserves their name are the original files, unchanged; the others are
Google Fonts' own Latin and Latin Extended files.

## Libraries

Libraries fetched by Maven (Spring Boot, Jackson, the Anthropic Java SDK and others) keep their own
licenses, mostly Apache 2.0 and MIT. See each library's own notice.

## Names

Schmoll Crossword is an independent project. It is not affiliated with or endorsed by The New York Times or
any other newspaper or puzzle publisher. Names of real products, films and people appear only inside
clues, as references.
