# DESIGN.md

What Schmoll Crossword should look, feel and sound like, and **the recipe for making a new world**.
The goal: a prompt like *"make an ocean world"* plus this file should produce what the project owner wants,
without more questions. The six worlds that exist (Notebook, Deep Space, Garden, Neon Arcade, Snow Day, Acorn Woods) are the
worked examples.

Decisions here came from the project owner (2026-10-08). When one changes, update this file.

## The bar: detail and effort

The owner's reference was a hand-built fan site full of animated scenes, cinematic transitions, a guide
character and sound. They asked for **that level of effort, not that style**:

- **Every screen is alive.** Each world has a full animated background (a canvas scene with depth and
  parallax), not a flat color. Something is always moving a little.
- **Every action gets feedback:** a letter typed, a word finished, a check, a reveal, a win, a streak, an
  achievement. Feedback is visual *and* audible, in the world's own style.
- **Big moments are cinematic.** A puzzle starts with a title card; a win is a multi-beat sequence that takes
  over the screen (the Space win: a black hole opens, swallows the board, collapses into a supernova, then a
  warp jump brings the board back). Cinematics are skippable with a click or key.
- **Each world is a different place, not a recolor:** its own fonts, colors, board decorations, sounds,
  mascot, lines, title card, win cinematic and screen transition.
- **Never in the way:** decorations never cover the letters, never slow typing, and clicks always reach the
  squares. On phone-sized game screens the mascot steps aside.
- **Our own look:** no NYT fonts, colors, icons or layout (see CLAUDE.md, License and copyright).

## Game rules that go with the design (built)

- **Words scale with difficulty.** Easy = only the most common words (SCOWL levels 10–20, adjusted by hand both ways, 2,953 answers;
  `not-easy-words.txt` lists the rest). Medium = the everyday list (3,930). Hard = adds the less common words
  (alibi, abhor, cacao) but skips the extremely hard ones in `very-hard-words.txt` (geode, adze, schwa).
  Settings "Allow extremely hard words in Unlimited Hard" adds those back (Unlimited only, so the daily stays the
  same for everyone). `App.loadWordsFor(difficulty, allowVeryHardWords)`.
- **Three dailies a day**, one per difficulty, each with its own grid (seed = date × 10 + 1/2/3), words and clues.
  Each is scored separately (localStorage key `"20261008-easy"`); the Home screen shows a card per difficulty
  with ✓ and points, and the difficulty buttons show ✓ too.
- **Challenge mode:** a fourth daily and an Unlimited option: a bigger grid each day (6x6, 7x7 or 9x9) with random
  symmetric black squares (sometimes one in the middle) and answers up to 7 letters, mostly medium words. Base 300 points + a speed bonus from 200. Shown as a
  gold ★ Challenge button and a wide gold card on Home.
- **Streak:** solving any one of the day's dailies keeps it. The streak number has moving fire behind it:
  no fire at 0, small at 1–2 days, bigger at 3–6, biggest (with embers and a strong glow) at 7+.
- **Achievements** (15, in `achievements.js`): shown as badges that pop in on the results card, and in a grid on
  Stats. Test wins never count.
- **Sound** is on by default, made in code with Web Audio (`sound.js`, no files). There is no background music
  (the owner removed the option on 2026-10-08). Browsers only allow sound after the first click or key press, which the intro's PRESS START provides.

## How the frontend is built

Plain browser JavaScript (no build step), in `src/main/resources/static/`:

| File | Job |
|---|---|
| `index.html` | All four screens (Home, game, Stats, Settings), the top bar, the intro box. An inline script applies the saved world and mode before the page draws. |
| `css/app.css` | Shared layout and components, all driven by CSS variables (`--bg --surface --ink --muted --line --accent --accent-2 --word --sel --solved --font-head --font-body --font-cell --radius ...`). Phone breakpoints at 980/780/480 px; reduced motion turns animations off. |
| `css/worlds.css` | One block per world: `[data-world="id"]` (and `[data-world="id"][data-theme="dark"]`) setting the variables, plus that world's own decorations, title card and win styles. |
| `js/util.js` | `U` helpers (`U.el`, `U.svg`, seeded `U.rng`, `U.store`, `U.motion()`), the `Bus` event hub, `Settings`. |
| `js/sound.js` | Synth engine and the shared sound library (`Sound.play(name)` uses the world's version when it has one). |
| `js/fx.js` | Particle layer (`FX.burst`, `ring`, `flash`, `shake`), `FX.countUp`, `FX.cinematic`, `FX.transition` (page / warp / leaves / autumn / blizzard / pixels / iris). Particle shapes include confetti, sparks, stars, pixels, petals, snowflakes, leaves and acorns. |
| `js/worlds.js` | The world registry and the animated background loop (pointer parallax; ~30 fps in Lite effects; one still frame for reduced motion). |
| `js/worlds/*.js` | One file per world. |
| `js/mascot.js` | The guide character in the corner: drawing loop, speech bubble with typewriter text, reactions to game events. |
| `js/achievements.js`, `js/score.js` | Achievements; scoring, streaks and score keys. |
| `js/game.js` | The puzzle: board, typing, clues, timer, check/reveal, saving progress, the win and the results card. |
| `js/app.js` | Screens and routing (`#daily`, `#stats`...), Home, Stats, Settings, the top bar, world switching, the intro. |

Game events go out on the `Bus` (`puzzle`, `type`, `word`, `check`, `reveal`, `win`, `results`, `world`...);
the mascot and achievements listen to them, so a world never needs to know about either.

## Recipe: making a new world

A world is **one JS file + one CSS block + one script tag**. It must deliver every item in the checklist at
the same level of detail as the existing six.

### 1. The motif map (decide this first)

Pick the place and map each moment to something in it. Every row must be filled in.

| Moment | Deep Space (example) | Garden (example) | New world |
|---|---|---|---|
| Background scene | nebulae, 3 parallax star layers, ringed planet with a moon, satellite, shooting stars, a black hole that lenses the stars behind it | sky with sun (moon and stars at night), clouds, birds, rolling hills, swaying grass with wildflowers, butterflies, pollen (fireflies at night) | ? |
| Board look | holographic glass squares | a deep green frame, pale leafy squares, ivy spilling over the edge | ? |
| A letter is typed | a spark burst | a bud sprouts at a seeded random spot in the square | ? |
| A word is finished | its squares join into a constellation | its buds open into flowers with a sparkle burst; vines wander between squares | ? |
| Puzzle starts (title card) | holographic "INCOMING TRANSMISSION" | a wooden sign with a vine growing on it | ? |
| The win cinematic | board charges up, black hole swallows it, supernova, warp jump back | stems shoot up the screen edges, a bloom wave, a rainbow, a petal burst | ? |
| After the win | the board stays lit | side flowers stay, swaying, until the next puzzle | ? |
| Mascot | NOVA, a little robot | BUMBLE, a bee | ? |
| Screen transition | warp (stars streak to white) | leaves (a wall of leaves sweeps across) | ? |
| Sounds | echoing synth blips | chimes and birdsong | ? |
| Light / dark | dark only | day / night garden | ? |
| Intro flourish | a cyan shockwave ring and sparks | a burst of petals | ? |

### 2. The quality bar

- **Depth:** the background has at least 3 layers that move at different speeds with the pointer (parallax),
  plus ambient events (shooting stars, birds, a UFO) every so often.
- **Shading, not flat shapes:** gradients, glows, soft shadows. Build expensive gradients/sprites once
  (offscreen canvas) and reuse them every frame.
- **Not a grid:** board decorations use seeded randomness (`U.rng` / a hash of the puzzle seed and the square),
  so the same puzzle always looks the same, nothing jumps while typing, and nothing lines up with the grid lines.
- **Variety:** 5–7 kinds of the world's main "reward" object (Garden: daisy, sunflower, poppy, rose, tulip,
  cosmos, forget-me-not), picked per square.
- **Staged animation:** things appear in steps (petals unfold one at a time, then the center pops), not one scale-in.
- **A win in beats** (build-up → climax → particles → rest) of about 4–6 seconds, skippable, ending on the
  results card. It must not play for a surrendered puzzle.
- **A mascot with personality:** drawn in code, blinks, looks toward the typing, changes mood (happy / wow /
  sad / thinking), and has world-flavored lines for every event.

### 3. The world file (`js/worlds/NAME.js`)

Wrap it in `(() => { ... })();` and end with:

```js
Worlds.register({
    id, name, icon, tagline,          // shown in the world picker
    modes: ["light", "dark"],         // or just ["dark"]; the Settings mode buttons lock when there's one
    scene(W, H, { theme, preview }),  // returns { draw(ctx, t, dt, input), resize(W, H) }; input has px/py parallax
    board: { attach, update, type, wordDone, restoreSolved, reset, clear },
    titleCard(c, info),               // async; c.wait(ms), c.cleanup(fn), c.skipped (see FX.cinematic)
    celebrate(c, { boardEl, game, info }),
    sounds: { type, word, win, ... },  // overrides for Sound.LIB names
    mascot: { name, draw(ctx, state) },
    lines: { hello, start, word, win, wrong, right, idle, reveal },
    introFlourish(stage),
    transition: "page" | "warp" | "leaves" | "autumn" | "blizzard" | "pixels" | "iris"
});
```

- `scene` with `preview: true` must draw a recognizable still frame at small sizes (the world picker cards).
- `board.update(game, boardEl)` runs after every change. Draw into one `<svg>` over the board; keep nodes
  between updates (a Map keyed by square) so running animations aren't cut short.
- `board.restoreSolved` draws the finished state instantly (coming back to a solved puzzle, or reduced motion).
- `board.clear` removes everything (world switched, or a new puzzle).

### 4. CSS and HTML

1. **`css/worlds.css`**: a `[data-world="NAME"]` block setting every variable (and a `[data-theme="dark"]`
   block if it has two modes), its fonts, and the styles for its decorations, title card and win. Check contrast
   in both modes: highlight colors (`--word`, `--sel`, `--solved`) must be **opaque**, or letters wash out.
   Only `<html>` carries `data-world`; world cards use `data-wid`, so they don't pick up a world's variables.
2. **`index.html`**: the `<script>` tag (after `worlds.js`, before `mascot.js`), any new Google Font, and the id
   in the inline script that applies the saved world.
3. **`app.css`**: the card label font (`.world-card[data-wid="NAME"] .wc-label b`).
4. **WORDLISTS.md**: add any new font with its license (Google Fonts under the SIL OFL are fine).

### 5. Technical rules (learned building the worlds)

- `U.el(tag, { style: { "--x": ... } })` sets CSS variables with `setProperty`; never `Object.assign` them.
- **SVG + CSS animation:** never put a CSS `transform` animation on an element that has a `transform` attribute
  (CSS replaces it). Position with an outer `<g transform>`, animate an inner `<g>`.
- CSS `stroke-width` beats the SVG attribute; set per-element widths with `element.style.strokeWidth`.
- `"lighter"` blending turns warm colors cyan on light skies; use normal blending there.
- Respect `U.motion()`: `"full"`, `"lite"` (fewer particles, ~30 fps background), `"still"` (no animation).
- Cap particles; clear timers in `board.clear()`; the background pauses when the tab is hidden.
- The game timer pauses while a cinematic plays (`FX.playing`); typing is blocked during cinematics, the intro
  and the results card.

### 6. Testing

Use the temporary **Win (test)** button under Check/Reveal to watch the win (it saves nothing; remove it before
going online). Then drive headless Edge over the DevTools protocol: type a daily for real, screenshot the
title card, the win at several moments, the results card, Stats, Settings, a world switch mid-transition, both
modes, and phone width (390×844). No console errors. Serve dailies from a scratch `PUZZLE_DIR` so testing never
calls Claude.

## Open ideas (not built)

- More worlds: ocean (a whale, bioluminescence, bubbles), a cozy café, a haunted house.
- Snow Day and Acorn Woods (added 2026-10-08) follow the recipe: a snowy valley with a cabin, a snow globe win and
  Pebble the penguin; an autumn forest with squirrels, an acorn stash, a leaf-tornado win and Hazel the squirrel.
- A world that changes with the real season or time of day.
- Unlockable worlds (tied to achievements).
