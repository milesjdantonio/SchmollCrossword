# DESIGN.md

What Schmoll Crossword should look, feel and sound like, and **the recipe for making a new design**.
The goal: a prompt like *"make a space design"* plus this file should produce what the project owner wants,
without more questions. Garden is the worked example; it is not special.

Decisions here came from the project owner (2026-10-08). When one changes, update this file.

## The feel

**Cozy and handmade, but alive.** The site should feel like a warm, hand-drawn notebook that is always gently moving.

- **Cozy:** paper texture, soft offset "drawn" shadows, wobbly hand-drawn corners, rounded shapes, friendly type
  (Nunito for text, Caveat for the logo and headings).
- **Active:** something is always moving a little (swaying, drifting, flickering, breathing). Every action gets
  feedback: typing a letter, finishing a word, solving, keeping a streak.
- **Never in the way:** decorations sit behind or around the board, never over the letters, and never slow typing.
  Clicks always go through to the squares.
- **Our own look:** no NYT fonts, colors, icons or layout (see CLAUDE.md, License and copyright).

## Game rules that go with the design pass (built)

- **Words scale with difficulty.** Easy = only the most common words (SCOWL levels 10–20, 2,541 answers;
  `not-easy-words.txt` lists the rest). Medium = the everyday list (3,930). Hard = adds the less common words
  (alibi, abhor, cacao) but skips the extremely hard ones in `very-hard-words.txt` (geode, adze, schwa).
  Settings "Allow extremely hard words in Unlimited Hard" adds those back (Unlimited only, so the daily stays the
  same for everyone). `App.loadWordsFor(difficulty, allowVeryHardWords)`.
- **Three dailies a day**, one per difficulty, each with its own grid (seed = date × 10 + 1/2/3), words and clues.
  Each is scored separately (localStorage key `"20261008-easy"`); the Home screen shows a chip per difficulty
  with ✓ and points, and the difficulty buttons show ✓ too.
- **Streak:** solving any one of the day's dailies keeps it. The streak number has moving fire behind it:
  no fire at 0, small at 1–2 days, bigger at 3–6, biggest (with embers and a strong glow) at 7+.
- **Sound** is on by default, made in code with Web Audio (`sound.js`, no files). Speaker button in the top bar
  and a Settings switch. Browsers only allow sound after the first click or key press.

## Shared look (every design)

These live in the "Design pass" part of `style.css` and apply whatever the design:

- Paper texture over the design's `--bg`; drawn shadows (`--shadow-ink`); sketchy card corners (`--sketch`).
- Letters pop in when typed; the selected square gently glows; a new clue slides into the clue bar.
- The win panel opens up after `--win-delay` (a design sets it to wait for its own win animation). Until then
  it takes no space, so there's no empty gap above the board.
- `prefers-reduced-motion` turns every animation off. Phones get compact tabs and a smaller sound button.

## Recipe: making a new design

A design is **one color block + one JS file + one instrument + one Settings option.** Every design must deliver
everything in this checklist at the same level of detail as Garden.

### 1. The motif map (decide this first)

Pick the design's world and map each game moment to something in it. Every row must be filled in.

| Game moment | Garden (example) | New design |
|---|---|---|
| A letter is typed | a bud sprouts in the square's corner | ? |
| Two neighbouring letters in a word | a vine grows between them, with a leaf and a curly tendril | ? |
| A word is finished | its buds swell and open into flowers, petal by petal, with a sparkle burst | ? |
| Idle / ambient life | butterflies, bees, ladybugs wander by every 20–40 s, behind the page | ? |
| The win, beat 1 (build-up) | stems shoot up both sides of the screen | ? |
| The win, beat 2 (wave) | every flower blooms in a wave from the board outward to the sides | ? |
| The win, beat 3 (particles) | petals drift down, butterflies fly off the board | ? |
| The win, beat 4 (rest) | win panel slides in; side flowers stay, swaying, until the next puzzle | ? |
| Surrender (Reveal puzzle) | buds stay closed, no win animation | ? |
| Dark mode | the garden at night (darker greens, softer pinks) | ? |
| Logo mark | a slowly spinning flower before the name | ? |

### 2. Variety and richness (the quality bar)

Garden sets the bar. A new design needs at least:

- **5–7 kinds of its main "reward" object** (Garden: daisy, sunflower, poppy, rose, tulip, cosmos, forget-me-not),
  chosen per square so the same square always gets the same one (no flicker while typing).
- **Shading**, not flat shapes: gradients (Garden's `shade(color)` makes a radial gradient once and reuses it).
- **Staged animation**: things appear in steps (petals unfold one at a time, centers pop after), not one scale-in.
- **Constant gentle motion** on finished objects (Garden: sway), with offsets so they don't move in sync.
- **2–3 kinds of ambient critters/objects**, one at a time, rare, behind the page.
- **A win that takes over the screen edges** and leaves something behind until the next puzzle.

### 3. Files to write

1. **Colors** in `style.css`: `:root[data-design="NAME"]` and `:root[data-design="NAME"][data-theme="dark"]`,
   setting every token: `--bg --panel --ink --muted --border --hover --cell --block --line --accent --accent-ink
   --word --selected --solved --surrendered --banner --banner-ink --nav-active --nav-active-ink --shadow-ink`,
   plus `--win-delay` (how long the win panel waits) and any design-only tokens. Also the logo mark
   (`.logo::before`) and the clue heading underline color. Check contrast in both modes.
2. **`NAME.js`** in `static/`, calling `Designs.register("NAME", { update, wordDone, celebrate, clear })`:
   - `update(game, boardEl)`: after every change. Draw into one `<svg>` laid over the board
     (`viewBox="0 0 size size"`, so square (r, c) spans r..r+1, c..c+1). Put decorations in the corners/edges
     of squares; letters sit in the middle and stay on top (z-index 2). Keep nodes between updates
     (a Map keyed by square) so running animations aren't cut short; only add/remove what changed.
   - `wordDone(entry, cells, boardEl)`: a word was just filled (designs.js works this out and plays the sound).
   - `celebrate(game, { instant })`: the win. `instant` = coming back to an already-solved puzzle (or reduced
     motion): draw the end state with no animation. Do nothing if `game.surrendered`.
   - `clear()`: remove everything (design switched off, or a new puzzle).
3. **Instrument** in `sound.js` (or `Sound.addInstrument("NAME", {...})` in the design file): notes for
   `type, erase, word, wrong, reveal, win, streak`. Soft and short; never harsh.
4. **Settings**: a radio button in `index.html` (`name="design"`) with a one-line hint, the `<script>` tag
   (after `designs.js`, before `app.js`), and the name in the inline script at the top of `index.html` that
   applies the saved design before the page draws.

### 4. Technical rules (learned building Garden)

- **SVG + CSS animation:** never put a CSS `transform` animation on an element that has a `transform` attribute
  (CSS replaces it). Position with an outer `<g transform>`, animate an inner `<g>`.
- CSS `stroke-width` beats the SVG attribute; set per-element widths with `element.style.strokeWidth`.
- Decorations behind the page go in a `position: fixed; z-index: 0` layer; header and main are `z-index: 1`.
- Side decorations must fit the empty margin beside the page (`(innerWidth - 1000) / 2`); on phones keep them
  small and low at the bottom corners. Rebuild them (instantly) on resize.
- Use the Web Animations API (`element.animate`) for paths across the screen; CSS keyframes for everything else.
- Cap counts: ~35 particles, one ambient critter at a time, timers cleared in `clear()`.
- Restarting a CSS animation: remove the class, read `offsetWidth`, add the class again.

### 5. Testing

Play it with the headless-Edge script (DevTools protocol, as in Step 20): type a daily partway, finish it, and
screenshot during the wave, after the win, after a reload (instant state), in dark mode and at phone width
(390×844). No console errors. Serve fake dailies from a scratch `PUZZLE_DIR` so testing never calls Claude.

## The designs

### Classic (default)

Paper and pencil: warm paper, slate-blue blocks, orange accent, hand-drawn underlines. Word finished = the
squares shimmer one after another. Win = the board bounces and paper confetti bursts out of it. Sounds: soft
triangle-wave plucks.

### Garden

See the motif map above. `garden.js` + the Garden block in `style.css`. Sounds: sine-wave chimes.

## Open ideas (not built)

- Fireflies instead of butterflies in Garden's dark mode.
- A design that changes with the real season.
