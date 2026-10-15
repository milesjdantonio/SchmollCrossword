# Schmoll Crossword

A free crossword game for the browser: small daily puzzles, unlimited puzzles on demand, and a campaign through sixteen
worlds with boss fights. The puzzles are made by the game itself, and it stays free, with no ads and no accounts.

Inspired by daily mini crosswords such as the NYT Mini. Not affiliated with The New York Times.

## What's in it

**Daily.** Five puzzles a day, the same for everyone, new at each player's midnight: Easy, Medium and Hard 5×5 grids,
a bigger Challenge grid (6×6 up to 9×9), and the Daily Boss. Scores count toward a streak and a world leaderboard.

**Unlimited.** A new Easy, Medium, Hard or Challenge puzzle whenever you want, or a race against any boss you've met.
Ten a day per player.

**Campaign.** A map of fifteen worlds, five levels each, from the Notebook to Deep Space, plus a secret sixteenth world
that opens once the final boss falls. Every level teaches a crossword skill (fill-in-the-blanks, wordplay,
misdirection, long answers...), and every world ends in a boss: a race against a rival solving its own board, with
moves to dodge and counter, your own abilities, items from the shop, and a story about a torn book of every word.
Make a hero, meet each world's companion, and watch your hero travel from world to world.

**Worlds.** Sixteen looks for the whole game, each with a light and a dark mode, its own animated scene, sounds,
mascot and win animation, plus a plain Classic look.

**Yours.** Progress, scores, streaks, stats, achievements and settings are saved in your browser. There are no
accounts, cookies or analytics.

**Beta.** The campaign map has a Beta strip in its corner (+500 Coins, Unlock All) for testing. Set `BETA` to `false`
in `static/js/campaign.js` to hide it.

## How the puzzles are made

1. **Words.** The answers come from a list of everyday words, sorted into difficulty tiers, with offensive and
   crossword-only words left out. Easier puzzles draw from the easier tiers.
2. **Grid.** A backtracking solver fills the grid, always picking the slot with the fewest words that fit, looking
   patterns up in a letter tree. It never repeats an answer or uses two forms of one word, and it steers away from
   recent answers. The same seed always gives the same grid, which is how a daily is the same for everyone.
3. **Clues.** Claude, an AI model by Anthropic, writes a clue for each answer at the puzzle's difficulty, and a second
   pass reviews them. Only the answer words are sent. Each daily is written once and saved, so everyone gets the same
   clues.

The campaign's puzzles and the first weeks of dailies ship with the game, so most of it runs without any API calls.

## Running it

You need **Java 17 or newer** and **Maven**.

```bash
mvn spring-boot:run        # then open http://localhost:8080
mvn test                   # the test suite (the paid Claude checks only run with -Dlive=true)
```

New puzzles (Unlimited, and dailies past the shipped ones) need an Anthropic API key. The server reads it from the
`ANTHROPIC_API_KEY` environment variable, or from `~/.schmoll-crossword/anthropic-api-key.txt`. Keep the key out of
the repository. Everything that ships with the game works without one.

## Hosting

The `Dockerfile` builds and runs the server on any host that runs Docker images. Give it a persistent disk at `/data`
so saved puzzles, the leaderboard and reports survive restarts, and set a spending limit on your API key.

| Variable | Default | What it does |
|---|---|---|
| `ANTHROPIC_API_KEY` | (none) | The Claude API key, for new puzzles |
| `PORT` | `8080` | The port the server listens on |
| `PUZZLE_DIR` | `/data` in Docker, `puzzles` locally | Where generated puzzles, the leaderboard and reports are saved |
| `UNLIMITED_PER_PERSON_PER_DAY` | `10` | Unlimited puzzles one player can make in 24 hours |
| `UNLIMITED_EVERYONE_PER_DAY` | `200` | Unlimited puzzles everyone together can make in 24 hours |
| `REPORTS_KEY` | (none) | Lets you read player reports at `/api/reports?key=...` |
| `TZ` | `America/New_York` | The server's time zone |

## Project layout

```
src/main/java/com/crossword/     the server: the generator, clues, puzzles, campaign, leaderboard and API
src/main/resources/
    static/                      the website: HTML, CSS, JavaScript, fonts and audio
    campaign/, daily/            puzzles made ahead of time
    words.txt and *-words.txt    the answer list and its difficulty filters
src/test/java/com/crossword/     JUnit tests
```

## Credits and licenses

Made by Miles D'Antonio, assisted by Claude (Anthropic). The music composed for the game was composed by Claude.

- **Code:** [MIT License](LICENSE).
- **Word lists, puzzles and clues:** [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/), because
  the answer list is adapted from [Spread the Word(list)](https://www.spreadthewordlist.com/) by Brooke Husic and
  Enrique Henestroza Anguiano. It is also built from [SCOWL](http://wordlist.aspell.net/) by Kevin Atkinson
  (`SCOWL-Copyright.txt`). Non-commercial use only, which is why the game stays free.
- **Music and sounds:** from [Kenney](https://kenney.nl/) and artists on [OpenGameArt](https://opengameart.org/).
  Almost all are public domain (CC0); five boss songs are CC BY 3.0 or CC BY-SA 4.0. Every track and author is in
  `static/audio/CREDITS.txt` and on the game's Credits page.
- **Fonts:** SIL Open Font License, served from the site (`static/fonts/OFL/`).

[NOTICE.md](NOTICE.md) lists exactly which license covers which files.
