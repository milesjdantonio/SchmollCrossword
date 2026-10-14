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

## Recorded sounds and music: mostly public domain (CC0 1.0), five boss songs need credit

Almost every recorded file in `src/main/resources/static/audio/` comes from [Kenney](https://kenney.nl/) or from
artists on [OpenGameArt](https://opengameart.org/) under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Each track, its author and its page are listed in
`src/main/resources/static/audio/CREDITS.txt` and on the game's Credits page. The songs were edited for the
game (cut, looped and mastered). The edits add no new restrictions to the CC0 songs.

Five boss songs (added 2026-10-14) are not CC0. They may be shared and changed, but only with credit:

| File | Track | Author | License |
|---|---|---|---|
| `audio/music/rain.mp3` | A Boar in the Bushes | Gundatsch | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) |
| `audio/music/arcade-p2.mp3` | Orbital Colossus (Space Boss Battle Theme) | Music by Matthew Pablo, www.matthewpablo.com | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) |
| `audio/music/rift.mp3` | Boss Theme 2 | Tausdei | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) |
| `audio/music/rift-p2.mp3` | Blackmoor Colossus (Colossal Boss Battle Theme) | Music by Matthew Pablo, www.matthewpablo.com | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) |
| `audio/music/candy.mp3` | To the Final Step (mix), by glitchart, of To the Final Step by Raymond1206 (CC BY-SA 4.0), two tracks by LSAo (OGA-BY 3.0) and Maybe Tomorrow is Different by migfus20 (CC BY 4.0) | glitchart, Raymond1206, LSAo, migfus20 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |

Each was changed for the game (cut, looped, mastered, converted to MP3). Our edited `candy.mp3` is shared under
CC BY-SA 4.0, like the mix it comes from.

The pieces composed for the game (the story music, the win and lose music, the Sphinx's second song and the
Phantom Librarian's two songs) are covered by the MIT License with the code. They were rendered with the
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
