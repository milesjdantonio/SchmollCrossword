# Major Update: Progress

Update this file with everything you have to do and every time you complete something, check it off. It will be
deleted after everything is done.

## How to pick up after a break

- The work happens on the git branch **`major-update`** (`git checkout major-update`). `main` only has the
  "under development" page. Merge into `main` only when the user says it's ready.
- Commit and push `major-update` after every finished task (`git push origin major-update`), so nothing is lost.
- The plan is [MAJOR_UPDATE.md](MAJOR_UPDATE.md). Things the user has to look at are in [REVIEW.md](REVIEW.md).
- Rules from CLAUDE.md still apply: no heavy disk scans, one test browser at a time through
  `tools/browser-test/cdp.mjs`, stop the server after each check (`tools/stop-server.ps1`), never read the API key.
- The design skills (taste-skill, Impeccable, UI UX Pro Max...) come from the user's TerraSim repo
  (github.com/milesjdantonio/TerraSim, `.claude/skills`). RhythmArchitect (github.com/milesjdantonio/RhythmArchitect)
  has the worker renderer, Rive tools and perf code to borrow from.
- The review zip (`SchmollCrossword-review.zip`, 9 reviewers, 2026-10-15) is summarised in `.claude/REVIEW-STATUS.md`.
  Some of its findings are fixed by removing Unlimited; the rest are in Phase 3 and Phase 11 below.

## START HERE NEXT SESSION: the Atlas (the user, 2026-11-16: "horrid performance and UX issues")

**Done (2026-11-25, commit e202813):** the Atlas is drawn on ONE canvas by `js/atlas.js` (`AtlasView.create`):
islands from cached bitmaps (each boss/prop/hero/gate SVG turned into an ImageBitmap at a few sizes, made a few ms a
frame, never while drawing), slab/sea/road/page light drawn directly, name plates are real buttons moved over it.
campaign.js `atlasSea` says what's on the sea; `warmAtlas` makes the pictures and loads the plates' fonts while you're
on the island; `Worlds.cover(true)` stops the world background while the Atlas covers it.
Measured in the test browser on this PC's GPU (Radeon 860M), 1440x900, frame times:

| | before | after |
|---|---|---|
| opening | 0.5 s freeze, then ~27 fps | one ~0.1 s frame (a brand-new browser profile: ~0.4 s, the GPU compiling its programs once) |
| Whole Map glide | p50 33 ms (~30 fps), worst 150 ms | 60 fps |
| dragging | p50 33 ms, worst 83 ms | 60 fps, worst 17 ms |
| wheel zoom | worst 50 ms | 60 fps |
| elements | 2,563 | 151 |

UX changes made with it (my guesses; the user hasn't confirmed which problems they hit): the point under the pointer
stays under it while dragging (plus a flick); the wheel and pinch zoom around the pointer; scrolling in past the closest
zoom travels to the focused island (the wheel already opened the Atlas from the island); the sea is centred in the room
left by the page of the atlas, and plates behind the page are hidden; it opens on where you are and the next island;
Whole Map fits everything (also on phones now); plates stay readable at any zoom (`.far` drops the star line); locked
islands' plates said "undefined" (an old bug) and now name the boss.

**The user, 2026-11-25:** still laggy with scrolling ("unless the local host needs a restart"); "finish the campaign
and build the new sections"; bosses' speech bubbles cut off at the top; "review the performance on every campaign
thing"; a new animation for switching pages in the Everbook's shop; "celestial rift isn't treated like a secret world
like the rest of them"; a different picture than "what looks like a ss" in the dock. All done (commits 2308cd2 to
c212d72), except the new sections (below):
- Atlas scroll-zoom at 200% scaling: canvas capped at 1.25 px per CSS px and steps down when slow, picture sizes made
  only once the camera stops, idle animation at 30 fps, the sea's glow in CSS. A third of frames late -> none.
- The boss's bubble is placed on the stage beside/above/below the boss, so it's never clipped.
- The Everbook: sections turn a leaf over the spine (backward for an earlier section); the shop's Items/Abilities
  switch slides a marker and only the list (only its page is redrawn). Phone: Close was blank (the rule hiding its
  label hid its icon too) and had no name.
- The Rift is a secret like the others (`SECRETS` id "rift", parent "space", `world: "rift"`): after the Void, four
  fallen stars blink in turn on Deep Space (repeat the order), riddle HALO, a gate that opens (`enterSecret`: the
  arrival scene the first time), a branch island off Deep Space in the Atlas. `secretOpen()` = found (or Unlock All,
  or any rift-* record). Beating the Void announces nothing.
- The dock's windows: `AtlasView.thumb` draws the boss on a little island of the world's colours (a shadow while
  locked), from the Atlas's picture cache, instead of 16 live scene previews.
- Performance on every campaign screen at 200% (scratchpad `perf-all.mjs`, `prof-type.mjs`, `trace-type.mjs`,
  `layers.mjs`): typing in a level ~50 ms frames -> ~23 ms (U.restart no longer forces a restyle; render() writes only
  changed letters; `--solve` on its users, not :root; `--bw` instead of a container query; journey/FX measure less);
  world background 1.25x and adaptive, effects/spells/chaos 1.5x, empty effect canvases hidden; the Everbook has no
  backdrop blur and pauses the world (scroll: 55/80 late -> 20/102). Still ~23 ms while typing at 150-200%: what's
  left is GPU compositing (~100 layers, 4 full-screen) and SVG animations inside board decorations (Candy's pops).
  Ideas if needed: an automatic Lite when frames stay slow; fewer journey layers; fewer full-screen layers.
- How to Play's Campaign chapter shows the island, the boss holding its page, the Everbook (Shop/Skills/Hero) and
  the Atlas.

**The user, 2026-11-25 (later):** "push to main a timer until shutdown ... once it reaches Nov 29 the page is instead a
page that says Sorry for the inconvenience ..." (done: `main` 025812f; the countdown, then a closed page with no way
past it; the server refuses every paid Claude call from Nov 29 New York time, `CLOSED_FROM`); "leave it on" (the Beta
strip stays); "playable version of all" (the four secret worlds first as playable versions, then polish).

**The four secret worlds are playable (commits 5f0593f, 877e03a).** What's done and what's still a stand-in:
- Done: server sections, lessons, phases (2/3/3/5), 25 puzzles a level (825, from the clue bank: plain clues, no lesson
  styles yet; local tool `src/test/java/com/crossword/SecretBatch.java`, git-excluded); scenes (light/dark), colours,
  bosses (art, lore, 10 moves, 7 of them new kinds), 4 abilities each (existing kinds renamed), corruption on levels,
  companion lines, omen -> riddle -> gate -> arrival, Atlas islands, dock, neighbours.
- Stand-ins to replace: music (parent's level songs; boss phases on existing songs: `SONGS_OF` in campaign.js), the
  arrival scene (the parent's: `KIN` in travel.js), arena scenery and chaos (parent's), the title card, sounds and
  board decorations (parent's or none), abilities that are other worlds' kinds renamed, 3 borrowed moves per boss
  that other bosses have too (the original rule: every move different), no staged visuals for the 7 new move kinds,
  no hero gifts, no achievements, no How to Play chapter, plain (not lesson-styled) clues.

## The user's decisions (2026-11-07)

- **Update page:** pushed to `main`; it looks like the intro and has a **Play the Current Version** button, so the
  current game stays playable. Work goes on the `major-update` branch.
- **Testing:** the local server and the safe test browser are allowed (with the safety tools, stopped after each use).
- **Paid Claude test calls:** up to **$5** in total. Keep a running total in the log at the bottom.
- **Unlimited** (and the Unlimited Boss and Allow Harder Words) is removed. Players' Unlimited data is **erased**
  (the game is in beta; no data needs saving). **Online multiplayer rooms** are removed from the plan.
- **Replaces Unlimited:** a free **Daily Archive** (replay past dailies for practice; no points or streak).
- **Social features that stay:** share result cards, leaderboard improvements, friend challenges, custom puzzle maker.
- **Puzzle bank** becomes **dailies made ahead**: a scheduled job writes and checks dailies weeks ahead; offline,
  the site, the campaign and opened puzzles keep working; a daily email reports the job and the stock.
- **Redesign:** a new look for the whole app (Home, Daily, results, Stats, Settings, How to Play, campaign map, level
  sheets, boss screen); the 16 worlds keep their scenes and characters inside the new system. **UX matters most.**
  Show **2-3 directions** first and wait for the pick (keep working on fixes meanwhile).
- **Libraries:** allowed, **self-hosted, no build step**; the game stays plain JavaScript. World backgrounds can move
  to a worker like RhythmArchitect's.
- **Order:** fixes first (reliability, dailies ahead, rule changes), then the redesign, then audio/visual polish,
  stats and quests, social features, secret worlds last.
- **Boss enrage:** when your progress is **2.5x** the boss's (was a 25-point lead).
- **Time bonus:** +10 a minute: under 1:00 = +90, 1-2 min +80, 2-3 +70, 3-4 +60, **4-5 = +50**, ... 8-9 = +10,
  9:00 and up 0. Bigger grids get longer bands in proportion to their size.
- **Points:** Easy 5 a square, Medium 8, Hard 10, Challenge 8, Boss 8. Check 1 a square. Reveal 5 a square (a
  wrong or empty square costs 5 and is replaced; a right letter is locked for free).
- **Daily Boss score:** 8 a square, +50 a star, -50 per attempt lost before the win; no time bonus.
- **Midnight:** a daily finished within **15 minutes** after the player's midnight still counts for the day before;
  after that, finishing it is practice.
- **Secret worlds:** a step harder than the world they branch from; each world's **own companion** goes with you.
- **Music:** free-license songs (CC0/CC BY), and composed ones where needed. The user listens; I measure.
- **Synonym clues:** fix **everything**: the AI prompt, the shipped dailies and every campaign clue.
- **Credits bug** (after the Cursed Angel): the roll shows boss screens, and its caption says the background
  changed when it didn't.
- **Chrome:** the world background looks stretched; check every page and size.
- **Weekly quests reward:** hero parts, badges and world colour variants (not coins).
- **Puzzle of the week:** a bigger **11x11 or 13x13** grid (needs generator work).

## Checklist

### Phase 0: Set up
- [x] Read MAJOR_UPDATE.md, the code, TerraSim, RhythmArchitect and the review zip; ask every question
- [x] PROGRESS.md (this file)
- [x] REVIEW.md
- [x] Update page (looks like the intro, Play the Current Version button) on `main`; fix the two broken `<meta>`
      tags that stop link previews showing the image; test in the browser; commit and push `main`
- [x] Branch `major-update` from `main`, push it
- [x] MAJOR_UPDATE.md: remove Unlimited and online multiplayer, write in the decisions
- [x] Copy TerraSim's design skills into `.claude/skills/` (local, git-ignored); no hooks without asking
- [x] CLAUDE.md "current work" note + a memory pointing here

### Phase 1: Remove Unlimited
- [x] Frontend: Home card, menu tab, `#unlimited` route, picker (`showPicker`, `#un-picker`), New Puzzle button,
      "x of 10 left", Unlimited Boss (`playSpecial("unlimited")`, Rematch/New Boss, `UNLIMITED_TRY_COINS`),
      Allow Harder Words setting, Unlimited stats rows, How to Play, legal.js text, CSS
- [x] Erase saved Unlimited data in players' browsers (progress slot `unlimited`, `counts.unlimited`, the
      `unlimited10`/`unlimited50` achievements, `data.playing` Unlimited Boss state) with a one-time migration
- [x] Two new achievements in place of Can't Stop and Marathon: Time Traveler and Archivist (10 and 50 Daily
      Archive solves; they unlock once the Archive exists in Phase 7)
- [x] Backend: `/api/unlimited`, `/api/unlimited/left`, `/api/boss?kind=unlimited` (keep the Daily Boss and its free
      board), `RateLimiter` use for Unlimited, `PuzzleStore` recent-Unlimited code, `hardWords`, the
      `UNLIMITED_*` settings, README, tests
- [x] `mvn test` passes; browser check of Home, Daily, Campaign, Stats, Settings with no errors

### Phase 2: Redesign directions (early, so the user can pick while the fixes go on)
- [x] Read the design skills (taste-skill, Impeccable, UI UX Pro Max); screenshot every current screen (desktop
      and phone); write a UX audit of today's game (what's confusing, slow or hard to find)
      (audit, in short: no clear next step on Home; Check/Reveal below the fold; Across/Down hard to see; the map shows
      ~4 levels at a time with tiny unlabeled world icons and an 8-button top bar; the boss screen is overloaded and the
      companion's bubble covers the abilities; emoji icons differ by device; kickers, hard offset shadows, glows)
- [x] 2-3 directions as clickable mockups (Home, a puzzle, the campaign map), desktop and phone; add to REVIEW.md
      IN PROGRESS: Design canvas https://claude.ai/artifact/LzQzyKbpcskqALsXQzCaAM (local files in the session
      scratchpad `redesign-canvas/`; if lost, rebuild from this note). Directions: A Passport (tickets, stamps,
      Big Shoulders Display + Figtree), B Transit (departures board, line diagram, Atkinson Hyperlegible; my pick),
      C Storybook (the Everbook, spreads, table of contents, Alegreya + Alegreya Sans). Stylesheets uploaded as
      assets: a.css /_blob/f6068e7ae09e1ddc49f167c02fb96be6, b.css /_blob/d546a5f2effa8760a8b5e30722a40d24,
      c.css /_blob/4290894908d6e860f2bf63a369264d23. All 19 boards published (Main overview + Home/Puzzle/Map, computer and phone, for
      A, B and C; phone boards dc-import the computer board with sfx="-Phone"). c.css was re-uploaded as
      /_blob/fe092ad3c43491db6bd745c47244dbec (the C boards use it). A local copy of every file is in
      `.claude/design/redesign-canvas/`.
- [x] The user's answer (2026-11-07, after seeing the canvas): **the campaign screen needs a huge redesign** (the
      whole thing: map, level sheets, boss screen); **Home is fine: a refresh, not a remake**; the resources from the other repos (TerraSim's
      design skills, RhythmArchitect's renderer and tools) can come into play. **From now on, show options to pick
      at a local `/demo` page** (on the local server) and tell the user when they're ready. A, B, C weren't picked
      as such; take what fits the campaign from them.

### Phase 3: Reliability and backend (P0)
- [x] **Dailies made ahead:** a scheduled job (`DailyMaker`) writes and checks the next N days of all five dailies
      plus the boss board, saves them atomically, retries with backoff, never two at once, can be turned off;
      requests never wait on Claude if a made-ahead daily exists; a spare-puzzle fallback when generation fails
      Done: `DailyMaker` (@Scheduled hourly; MAKE_DAILIES_AHEAD days, default 0 = off; MAX_DAILIES_PER_RUN 12; makes yesterday to today+N, all 6 kinds). Not done: a spare-puzzle fallback (the made-ahead stock is the protection; revisit if needed).
- [x] `PuzzleStore`: per-puzzle locks instead of one global lock; lock-free reads of shipped/saved files; ignore
      damaged files; remember a failure for a short time and answer 503 + Retry-After
      Done: `generateOnce` (lock per file, lock-free reads, 2-minute failure pause -> `Unavailable` -> 503 + Retry-After in PuzzleController), `save` (atomic), `readSaved` (damaged files moved to .damaged). The solver keeps its class lock (shared caches).
- [x] `ClueWriter`: one shared client, timeouts, 1 SDK retry, fall back to Haiku only on overload/5xx/timeouts,
      skip the review if it fails, tidy clue text, "gives away the answer" by whole word, rewrite only flagged clues,
      throw instead of returning bad clues; a fake Claude for tests
      Done: shared client (90 s, 1 retry), `ClueWriter.asker` for tests, `fallsBack` (429/5xx/IO/no answer), review skipped on failure, `buildFixPrompt` + `merge` (only flagged clues), `givesAway` whole words, `tidy`, `CluesFailed`, model IDs from CLAUDE_FAST_MODEL / CLAUDE_STRONG_MODEL / CLAUDE_REVIEW_MODEL, per-model `USAGE` and `estimatedCost()`.
- [x] Dailies avoid 30 days of answers (not 3), saved or shipped
- [ ] Fix the shipped dailies that repeat: only matters on `main` (the live site serves Nov 7-29 from there).
      Asked in REVIEW.md; do it only on the user's OK. Add an `everyDailyHasEveryClue` test either way.
- [x] Synonym-clue rule in the AI prompt and the review prompt
- [x] Test the new prompt live (within the $5) and put sample clues in REVIEW.md
- [ ] Rewrite the bare-synonym clues in the shipped dailies still to come (same: only on `main`, only on the OK)
- [x] Clear error messages: `U.fetchJson` (knows offline / network / status / Retry-After), `U.describe` (the
      words) and `U.failCard` (Try Again, Home, Report by email; a 503 counts down and retries by itself, offline
      retries when the connection is back). Used by the Daily and campaign puzzle loader, the campaign map, the Home
      campaign card (retries every 20 s) and the Boss button. Saving: `U.saveRaw` tells the player once a visit
      if storage is blocked or full (progress first drops finished puzzles to make room). The email address is in
      the report dialog, the FAQ and the Privacy Notice (Contact)
- [x] Found while testing: leaving the map during the story intro or an arrival scene left it playing over the next
      page and froze that page's clock. `FX.cinematic(run, { stayOn })` skips it on leaving; it plays next visit
- [x] Midnight rollover: `dailyStanding(day)` in score.js (today / grace for 15 minutes / past). A daily or Daily
      Boss won after the grace is practice (no score, streak, leaderboard or daily achievements; "PRACTICE" on the
      results). `checkMidnight` in game.js asks "It's a New Day" (Keep Playing / Go to Today's) once at midnight and
      again when the grace ends; also when a tab left open is looked at again; a finished old daily is simply
      replaced. Visiting another screen during the grace keeps the puzzle. Checked in the test browser with a moved
      clock, and `dailyStanding` in 5 time zones across clock changes and the new year. (Server/browser
      disagreement: the server already accepts a date within a day of its own.)
- [x] Share: the preview tags and `preview.png` (1200x630) were right; added `og:site_name` and a canonical link.
      Share text (`shareText` in game.js): date, difficulty, time and points (or Practice), an answer-free grid
      (🟩 typed, 🟨 checked, 🟦 revealed, ⬛️ black), No Hints, streak, schmollcrossword.com. The Daily Boss can share
      too (stars). Touch screens use the share sheet; elsewhere the clipboard; if that's refused, a "Copy Your
      Result" box with the text selected (instead of `prompt()`)
- [x] Saves: boot.js moves any unreadable save (or one that should be an object and isn't) to
      `schmoll-damaged.<name>` and the game starts that part fresh with a notice; a saved game that doesn't fit its
      puzzle is skipped (`sane` in game.js). What's stored where: the Privacy Notice lists it for players
- [x] Saves: the storage keys are listed at the top of boot.js
- [x] Reports: categories (wrong answer, unclear clue, typo, offensive, technical, other; details optional unless
      "other"), 10 an hour per person, and the email address in the dialog. Admin page `/admin.html` (`ADMIN_KEY`,
      `REPORTS_KEY` still works; the key goes in the `X-Admin-Key` header, kept in sessionStorage; without a key
      every admin URL is 404): reads reports (filter by kind; a daily's report has "Switch Off This Daily"),
      switches a daily off (`POST /api/admin/daily/disable`: a saved one is moved to `.disabled`, a shipped one is
      skipped by its hash in `$PUZZLE_DIR/disabled.txt`, the next request or the made-ahead job makes a new one),
      hides a name from a day's board (`POST /api/admin/leaderboard/hide`)
- [x] Health: `GET /api/health` (no key) for the host; `GET /api/admin/status` (`HealthReport`: dailies in stock,
      the last made-ahead run and its error, Claude calls and estimated cost by model, API key set or not, players
      today/yesterday, reports, uptime); a daily email at 08:00 (`DailyEmail`, spring-boot-starter-mail; off unless
      `SPRING_MAIL_HOST`/`USERNAME`/`PASSWORD` and `REPORT_EMAIL_TO` are set; failures only logged). Logging is SLF4J
      throughout (made, failed, moderation)
- [x] Content: family-friendly answer filter (`family-words.txt`, 42 words: sex, nudity, drinking, crude words,
      insults; `App.loadFamilyWords`, skipped at every difficulty; the clue prompt asks for family-friendly clues).
      Campaign pool: 77 variants with those answers removed (each level keeps 20-25; `PuzzleStore.poolPuzzleOrNext`
      falls through to the next variant), 56 files re-clued (PEE "Letter between O and Q", BRA "Support group
      member?"). Shipped dailies left as played (the Daily Archive should hide ones with family-list answers).
- [x] A bigger leaderboard name blocklist (`name-blocklist.txt`: hate terms; plus the family words), and it sees
      through accents and look-alike letters (`plain()`: NFD, Cyrillic/Greek look-alikes to Latin)
- [x] Security: the rate limiter counts an IPv6 /64 as one person (`RateLimiter.person`), never remembers a
      refused request, and sweeps at most once a minute. Docker runs as user `schmoll` (uid 10001, owns `/data`)
      with a `HEALTHCHECK` on `/api/health`; the status page and email say if the data folder can't be written
      (a host disk owned by root would). With Unlimited gone no player request pays for Claude (dailies are made
      once; campaign puzzles come from the pool), so the caps don't need to survive restarts. Daily Archive must
      only serve saved or shipped dailies, never make one (Phase 7)
- [x] Leaderboard: the initial is optional ("Miles" or "Miles D."); standings cached until the day's file
      changes; days older than 30 are deleted every night (`KEEP_DAYS`, stated in the Privacy Notice)
- [x] Leaderboard timing check: `POST /api/leaderboard/start` gives a signed start ticket (HMAC, secret in
      `$PUZZLE_DIR/leaderboard/ticket-secret.txt`, survives restarts; nothing about the player). game.js asks for one
      when today's daily starts (or a restored one under 90 s), keeps it in the saved game and the score; the post
      sends it. Server: a time longer than the time since the start (+120 s) is refused; no valid ticket = no speed
      bonus; faster than 6 s (12 s Challenge) counts as that. FAQ and Privacy Notice updated. Forget is quick enough
      now that only 30 days are kept
- [x] Found while testing: the leaderboard's cached board could miss a change (its file stamp could collide), so a
      removed name sometimes stayed for a moment. Own writes now drop the cache (`changed`), and the stamp can't
      collide

### Phase 4: Rule changes and gameplay fixes
- [x] Re-check the point-based achievements: Perfect Score is now "every point a Hard daily offers" (full time
      bonus, no Check or Reveal), since 300 depended on the puzzle's square count; Big Scorer (1,000) still fits
- [x] Scoring (score.js `SCORING`, `scoreBreakdown(puzzle, ...)`, `bossScoreBreakdown(puzzle, ...)`): white squares
      x 5/8/10/8, time bonus 90 - 10 a band (a band = 60 s x size²/25: 1:00, 1:58 on 7x7, 3:14 on 9x9), Check 1,
      Reveal 5 (right letters locked free, as before), Daily Boss 8 a square + 50 a star - 50 a lost try. Server:
      `LeaderboardController.points(difficulty, size, squares, ...)` reads the daily's own grid
      (`PuzzleStore.dailyShape`, never makes one). Checked in node (15 cases match the server) and in the browser
      (a Hard daily: 319 in the browser and on the leaderboard). How to Play, the mascot tips and the results tally
      ("23 Squares × 10", "Time Bonus") updated
- [x] The daily's timer shows the current bonus and the time left before it drops (`#time-bonus`, `timeBonusNow`;
      red in the last 10 s; hidden for practice, campaign and after the win)
- [x] Reveal Puzzle completes the puzzle's state consistently: checked in the browser on a daily (board = answers,
      saved game solved + surrendered, the score, Home's "Revealed" chip, all the same after a reload). The Daily
      Boss treats it as a lost attempt (`lose("reveal")`). After the midnight grace a surrender saves nothing. The
      Daily Archive must do the same when it's built (Phase 7)
- [x] At most 10 Reveal Words per boss phase (`REVEAL_WORDS_PER_PHASE` in game.js; the button reads "Word · 7";
      `render()` used to re-enable it, now `drawRevealWords` decides)
- [x] Boss enrage at 2.5x the boss's progress, once you've done 15% (`RAGE_RATIO`, `RAGE_FLOOR`); How to Play says so
- [x] Later phases attack more often: `PHASE_PACE` = 1, .86, .74, .64, .56 of phase 1's gap (was 0.88 each)
- [x] Boss sheet: "2 Phases · About 14 Minutes" (`fightEstimate`: each phase at your average on levels of the same
      difficulty and size, else par, capped at the boss's own time; the tooltip says which)
- [x] Pop-ups close when clicked or tapped: every toast (achievements, new abilities, items, lessons...), and the
      fight's notice box ("It Hit You", "Enraged"; `.can-close`); an incoming attack's warning stays
- [x] Items: all six share one row in equal buttons; the shop and Give Up together below; under 380 px two even
      rows of three (checked at 1366, 700, 390, 340 px)
- [x] Achievements fire correctly (and once) in every mode, boss fights included; progress survives reloads.
      Found: the speed ones could be earned by revealing every word fast; they now need no Reveal. Practice and the
      Daily Boss don't earn daily-only ones. Tests: `src/test/js/achievements.test.mjs` (node --test, with a stand-in
      for browser storage; a "reload" loads the script again on the same storage)
- [x] 10 time-based achievements (Hard Charger, Sprint Summit, Bonus Collector, Quick Week, Hourglass, Ten Hours,
      Triple Time, Getting Faster, Just in Time, Weekend Warrior); the clock's rules are in the comment above them
      (runs only while the puzzle is on screen, saved with the game, grace after midnight counts). game.js gives the
      win `day`, `grace` and `trio`. 10 node tests; `src/test/js/score.test.mjs` (points = the server's, the grace in
      5 time zones, streaks). README says how to run them
- [x] Coin icon drawn as our own SVG (`U.icon("coin")`, `.ic`): the campaign bar, the shop and its buy buttons, the
      results, How to Play. Points are shown as "pts" text, the same on every device. (Achievement, move and item
      icons are still emoji; the redesign decides those)
- [x] Zoom: 60%-140% with 100% in the middle of the slider, on every screen (`applyZoom`). Zooming in stops where
      the zoomed layout would be narrower than its breakpoint needs (`roomNeeded`: 981/781/500 px; checked at 430,
      600, 900, 1024, 1280 and 1920 px with no spill), so phones zoom out only (their pinch zoom still zooms in).
      Found: on touch screens a too-wide page widens the reported window, so there the screen's width is used
- [x] Typed letters visible in every world: measured in all 17 worlds, light and dark (contrast 9.5:1 or more). The
      thing that hid them: Shatter's `translateX(var(--sx, 0px))` was on every square all the time, which put each
      square on its own layer, so board decorations (the Garden's vines) drew over the letters. It's now only on
      while Shatter is (`.shattered`), and the deal animation's class comes off once the squares are dealt
- [ ] Difficulty slope: measure the curve across all levels, chart it in REVIEW.md, wait for the user's numbers,
      then apply them
- [x] The world-arrival animation plays when you move on after a boss or pick the next world's level (2026-11-26:
      Next after a boss opens the map, where `heroOnMap` plays it; going to that world yourself (dock, arrows, Atlas)
      now plays it too, `go()`. Checked: Notebook's boss, then Next and the map, both show the Garden arrival. The
      Rift's is now its gate's: it's found like the other secret worlds)

### Phase 5: The redesign (the user's answer: the campaign screen, big; Home stays)
- [x] `/demo` on the local server (`DemoPages`, `src/main/resources/demo/`): served when `SHOW_DEMO` is on (default
      on; the Dockerfile sets it off), never cached; `/demo/` pages may be framed by the site itself (the phone frame)
- [x] Campaign redesign options at `/demo` (Impeccable followed by hand: its launcher downloads a program, so it
      wasn't run; code-led, no image generation). All three load the game's own scripts (worlds, bosses, hero,
      powers, companions) on the real `/api/campaign/map` with sample progress (`demo/campaign/common.js`), wear
      each world's tokens and faces, and work on a computer and a phone (checked in the test browser):
      **A World Stage** (`a.*`: one world per screen, its road of five stops, a level panel beside it / a peeking
      sheet on a phone, a strip of named worlds, one Pack for shop/skills/hero/book/help; my pick),
      **B The Everbook** (`b.*`: the story's book; a contents spread, a two-page spread per world, bookmark tabs),
      **C Journey Line** (`c.*`: today's scroll, one screen per world, a named world rail, details beside the
      stop, Continue always there). Front page `demo/index.html` with screenshots, phone frame `demo/phone.html`.
      Found while building: the game's `main { margin: auto }` and `body { min-height: 100vh }` (on phones 100vh
      is taller than the screen) both need overriding on full-screen pages; a grid column needs `minmax(0, 1fr)`
      or a long title widens the page
- [x] The user's pick (2026-11-07): "mix of A and B, up to your discretion" -> **D, Stage and Everbook**
      (`demo/campaign/d.*`, first on /demo): A's stage (one world, its road, hero, the strip of worlds, the phone
      sheet) + the panel as that world's Everbook page (parchment, gold page number, "Held by X" / "Page Won Back"
      seal, boss in a gold plate) + an Everbook button opening the book (contents with Continue, bookmarks)
- [x] Built into the game, and pushed much further at the user's word (2026-11-16: "huge campaign rework, something I
      look at and go woah", "preferably doesn't look at all like what it looks like now"): **the Island**.
      Each world is a floating 3D island (`#cm-isle` > `#cm-plane`, CSS 3D: a tilted plane with a layered slab and a
      shadow; `BIOMES` gives its ground, sides and road colours; the old map's scenery sprites `PROPS` stand on it).
      The road winds from the near edge back to the boss, who stands whole at the far end holding its glowing page
      (a silhouette while the world is locked; a gold seal once beaten). Stops, scenery, hero and boss are upright
      "billboards" (`--rx`/`--rz` undo the plane's tilt); the island turns with the pointer (`leanTo`), floats, and
      sails off / in when the world changes (`go`). A stop that opened since your last visit gets a show (`openStop`:
      the road runs on, the hero walks, a ring and stars; `data.shown`). The world's name is large in the sky with its
      stars; the bar floats; the level is a floating page of the Everbook that turns when you pick a stop (boss: you vs
      it in a gold plate, threat, fight length, its moves as buttons, your abilities, Fight always in view); the worlds
      are a dock of round windows onto their scenes. Keys: arrows, 1-5, Enter, B. Phone: the island fills the screen,
      the page is a sheet, swipe changes world.
      **The Everbook** (`openBook`, one layer for everything that isn't a level): Contents (continue, tallies, every
      world in its own face), Pages (the story you've won back, each boss's lore, Watch the Story Again), Shop (items /
      abilities, your three keys, Swap), Skills (the course, jump to a level), Hero (gifts won and to win), Help. In a
      level it opens at the Shop (Shop and Help only). The old map, shop, skill-book and ability-picker code and CSS
      are gone. Checked in the test browser at 1440x900, 1280x620 and 390x844: no errors; play, buy, equip, keys, jumps.
      Port note: 8080 on this PC is often another project (HokieBikeRack); run ours with `PORT=8090`.
- [x] More of the same (the user, 2026-11-16: "i like the changes ... keep adding to them to make a wow factor"):
      **the Atlas** (`openAtlas`: the map button in the dock, M, or the mouse wheel: every island at once along a
      golden thread, each with its boss, locked ones as shadows; pick one to go there), the **neighbouring worlds as
      small islands in the distance** (`miniIsle`, the prev/next buttons), a **dive into the stop** when you press
      Play (`dive`), mist drifting past, a beam of light from the stolen page, and the boss answering when you pick
      it (`bossSay`). Checked at 1440x900 and 390x844: no errors.
- [x] How to Play's Campaign chapter shows the island, the Everbook and the Atlas (2026-11-25)
- [ ] Island follow-ups: boss fight screen and level screen redesign; the Beta strip's place (asked in REVIEW.md)
- [ ] Build the picked campaign design: map and level selection (clear completion, optional challenges,
      secret-world branches), level sheets, the boss sheet and fight screen, shop, skills, hero, book
- [x] Home, Stats and Settings without the generated look (2026-11-26; the user: "use the skills to make the pages
      not look AI generated"; design-taste-frontend's app-screen run, style "editorial greeting", seed 1170179221,
      worlds' own colours and type kept). `css/pages.css`: flat panels in the world's colours (no shadows, gradients,
      blur or icon badges), a left-aligned title row on every screen with one line of data under it. Home: the
      greeting is the title with what's left today ("Good Morning. Three Left Today"), Campaign leads with its
      figure, the dailies are rows with a small grid of their size and Play on the right, the streak is a figure,
      the week a row of crossword squares in the world's board colours (the day where a clue number goes, how many
      solved written in), then the latest achievements (or the next three). Stats: a finding under the title
      ("Solve one today to keep your 2-day streak."), the headline figures in one panel split by hairlines, plain
      difficulty labels, no padlock on every locked achievement. Settings: two columns of panels as tall as their
      content, neutral segmented choices, switches on in ink, the world in use marked In Use, Reset last. The top
      bar's current screen is a tone step, not the world's colour. Checked with the skill's inspector (run through
      `tools/browser-test/cdp.mjs`: its own launcher tracks only the first Edge process) in Garden, Classic and
      Deep Space dark at 1440, 768 and 390. Kept on purpose: the soft halo on titles written on the scene, the
      crossword's dark grid ink, each world card's own lettering. The Daily page (the play stage) wasn't part of it.
- [x] The puzzle screen (the user, 2026-11-16: "make some major advancements to the actual crossword gameplay ... it
      feels like its lacking behind now"; built straight in, no demo). `css/play.css`, game.js:
      **the play stage** (a computer-sized window, not a boss fight: `html[data-view="game"]:not(.boss-stage)`): the
      site's bar goes, a back button, the board as a thick slab as big as the window allows that leans toward the
      pointer, the clues in a panel down the side, Check/Reveal and the items on one line each.
      **The spotlight** (`drawSpotlight`, every layout except boss fights, whose moves hide letters and clues): under
      the active clue, the answer so far in letter slots and the clue crossing your square.
      **Pencil** (`game.pencil`, the Pencil button or Shift + a letter: guesses shown lighter; saved; they still
      count). **Something's Not Right** (`notQuite`: the board shakes with a red ring and a notice when every square
      is filled but it isn't solved). **Per-clue progress** (a bar under each clue, `--k`). **Flow** (`flowType`: 6+
      letters without a 3.5 s pause or a Backspace: a chip and a glow round the board; only for feel).
      `boss-stage` on the root (campaign.js `syncHelp`) marks a boss level before its panel arrives.
      Checked at 1440x900 (daily, 5x5 and 6x6 levels, a boss) and 390x844: no errors.
- [x] The play stage's show (the user, 2026-11-16: "now give it some sort of wow factor"): a real 3D board (the word
      you're on rises out of it, your square higher: `translate` z on `.cell.in-word` / `.selected`), a wave through
      the board when a word is finished (`ripple`), the board landing from above (`.board-wrap.drop`), the world
      behind faded at the start and getting its colour back as you fill squares (`--solve` on the root, a filter on
      `#world-bg`), a pool of stage light, and in campaign levels your hero beside the board, hopping at a finished
      word, cheering at a win, wobbling at a full-but-wrong board (`.ps-hero`, `Campaign.hero()`).
- [x] **The journey** (`js/journey.js`, play.css; the user, 2026-11-16: "it needs a scene, i want to feel like im
      traveling through an active world trying to save something important"; their answers: side-scrolling AND flying
      forward, atmosphere only (nothing can lose the level), campaign levels only, full spectacle but light by the
      board and never covering it). Behind campaign levels 1-4 on the play stage: the land scrolls past in four
      layers built from the world's `BIOMES` colours and `PROPS` scenery, always moving and faster while you type;
      the hero walks the road; the boss stands on the horizon with its page and beam and comes nearer as squares fill
      (`--solve`); the Void's shadow with torn pages trails at the left and falls back; loose letters blow across the
      sky; a finished word surges you forward (speed lines from the page, the land swells) and its letters fly to the
      page as light; the boss answers back now and then. It goes by squares FILLED, never by right letters.
- [x] The journey's way of travelling fits the world (the user: "space doesnt have a road ... it uses a rocket
      ship"): `MODES` / `RIDES` in journey.js. On foot along a road (Notebook, Garden, Acorn Woods); a cart on rails
      (Candy Hills, Carnival, Robot Factory; over lava on Volcano Island); a submarine with bubbles (Coral Reef); a
      sled (Snow Day); a boat on flooded streets (Rainy City); a balloon (Sky Kingdom); a flying carpet (Desert); a
      hoverboard over a neon line (Neon Arcade); a flying book (Haunted Library); a rocket through open space with
      no land, scenery at every height and stars streaking by (Deep Space); a star (the Celestial Rift).
- [x] **Secret worlds: how they're found** (the user: "make creative ways to introduce the secret worlds that are
      planned", "the atlas might need huge work for this to work, and other UI"). `SECRETS` in campaign.js. Nothing
      says they exist; once a world's boss is beaten an omen turns up on its island, each handled its own way:
      Acorn Woods, a giant acorn that hops away (catch it 3 times); Coral Reef, a bottle bobbing beside the island
      (pull the cork); Desert, an oasis that vanishes when the pointer comes near (the 4th time it's real); Volcano, a
      boulder with a glowing crack (press and hold). Each gives a torn scrap with a riddle answered by typing the
      word (hints after 2 and 4 wrong tries), then a reveal (eyes in the dark, the name, a teaser). Found: a gate on
      the island, a "?" on its dock window, a branch island in the Atlas (an unfound omen is a faint glimmer there),
      and a Secret Places list in the Everbook's contents. `data.secrets`.
      **The worlds behind the gates are NOT built** (Phase 9): a gate says its door opens in a coming update.
- [x] **The Atlas rebuilt** (the user: "rework the atlas page heavily ... a full rework"): the grid of small islands
      on a dark sheet is gone. `openAtlas` now builds an archipelago on a tilted sea under a dusk sky (`.at`, CSS 3D):
      world 1 nearest, four islands a row, each row further off, the Void toward the horizon; every island has its
      slab, scenery, boss and the page it holds (locked: grey under mist, the boss a shadow, the page still shining);
      the golden road shows how far you've come; found secret worlds are rocks with gates off their islands (an
      unfound omen is a glimmer). A camera (`at`: x, y, zoom, eased): drag to look around, wheel or + / - to zoom,
      Whole Map, arrows step along the journey. Picking an island opens its page of the atlas (stops with their
      lessons and stars, the secret, Travel Here); picking it again, Travel or Enter flies down into it. Phone: the
      page is a sheet. Checked at 1440x900 and 390x844: no errors.
- [x] Boss fight boards need a UX pass (the user, 2026-11-27: "boss boards need work for better UX, it missed out on
      previous updates and doesnt feel good"). Done 2026-11-27: the boss stage (play.css, `html[data-view=game]:is(.in-boss,
      .boss-stage)`, computer-sized windows): no site bar, a back button, the title and the race bar on one line, your
      board as big as the window allows with your abilities in a column beside it (moved out of the boss panel:
      `abDock` in campaign.js; on phones they sit under the board), items on one line, the clues and the boss panel
      down the side scrolling inside (981-1240 px: clues over a compact boss panel). Checked at 1440x900, 1280x720,
      1100x800 and 390x844 (Queen Thistle 5x5, the Magma Wyrm 9x9).
      The clue bar's answer slots and crossing clue show in fights too (the user: "does the clue and empty spaces show
      up at the top ... include if there is anything on those spaces, like ink"): each slot shows its square's effect
      (the same CSS: `:is(#board .cell, #clue-bar .cb-slot).snowed`...), fake letters, the boss's marks, and the
      board-wide covers where they cover (`coverAt`, `syncSlots` in campaign.js); the crossing clue follows the clue
      tricks and hides while the clues are stolen or inked.
      Still open: the board doesn't lean in 3D like a level's (effects aim at the squares), the attack warning covers
      the top of the clue list while it shows.
- [ ] Puzzle screen follow-ups: boss fights on the play stage; How to Play chapters for Pencil and the spotlight; the
      phone layout (the on-screen keyboard has no Pencil key yet: the button above the board does it)
- [x] Phone layout review (all screens)
      - [x] The puzzle on a phone (2026-11-27): opening a puzzle scrolls the timer row to the top (`fitPhone` in game.js),
        so the clue, the whole board, Check/Reveal and the keyboard are all in view (the keyboard covered the last two
        rows); the difficulty buttons are one row (swiped sideways if they must); the keyboard has a Pencil key.
      - [x] The other screens at 390x844 (2026-11-27): Home, Stats, Settings, the hero maker, the Everbook: nothing
        wider than the screen, buttons in reach (the Atlas was checked on 2026-11-16).
- [ ] Renderer: world backgrounds in a worker (OffscreenCanvas) where supported, quality tiers from measured frame
      time, pause when hidden (ideas from RhythmArchitect)
- [ ] Loading: fewer requests, versioned files with long caching, lazy-load story/credits/how-to
      - [x] Versioned files (2026-11-27): `IndexPage` serves index.html with every script and stylesheet named by
        its content hash (Spring's resource chain, `spring.web.resources.chain.strategy.content.*`; CSS font links
        too), `LongCache` keeps those names a year (`immutable`, never a 404); the page and plain names stay
        no-cache. The chain's cache is off locally and on in the Dockerfile (`RESOURCE_CACHE`). `StaticFilesTest`.
      - [x] Lazy (2026-11-27): the arrival scenes (travel.js, 235 KB) and the story (story.js) aren't run at start-up:
        index.html lists them as `<link rel="prefetch" data-lazy>` (versioned, fetched when idle) and `U.need(name)`
        runs one on first use (campaign.js's three places). How to Play, Credits and Legal wire their own buttons as
        they load, so they stay as they are.
      - [ ] Fewer requests (66 scripts, 13 stylesheets): with the versioned names a repeat visit fetches none of them,
        so bundling only helps a first visit; left for now
- [ ] Accessibility and settings: text and cell size, reduced motion, optional timer and mistake counter,
      customisable keys, the grid usable with a screen reader (role grid, live clue announcements), boss assist

### Phase 6: Audio and visual polish
- [x] Volume: default 80 sounds like today's 100; 100 is louder (2026-11-26: Master Volume has its own curve in util.js,
      `masterGainOf`: 80% = full, 1% = 50 dB below, 100% = +6 dB (2x), sound.js's compressor in front of the speakers;
      saved volumes move to the same loudness on it (`soundV: 3`, `masterPosOf`: 96% -> 77%); new players start at 80%)
- [ ] Loop fixes (measured; previews for the user to listen to): Old Grumble Owl 1, King Sourgum 1, Kraken 1,
      Yeti 1, Thunderhead 1, Sir Squall 2, Sphinx 1, Ringmaster 1, Mega Unit X 1-3, Magma Wyrm 1-3, Void 2-5,
      Cursed Angel 1
- [x] Cursed Angel: swap phases 3 and 4 (2026-11-26: rift-p3 is now Determined Pursuit, rift-p4 the Boss Battle #2
      chorus; files, songs.json loops, credits.json and CREDITS.txt swapped together)
- [x] Chrome stretched background (2026-11-26: the world background and the effects layer were drawn for innerWidth,
      which counts Chrome's classic scrollbar, and shown at 100%, which doesn't, so every frame was squeezed sideways;
      Vivaldi's overlay scrollbars take no room. They now use the shown size, and follow a scrollbar coming or going
      (ResizeObserver). Measured 1.000 drawn-to-shown on pages with and without a scrollbar. Asked in REVIEW.md)
- [x] Deep Space: no black box behind the black hole (2026-11-26: not found on the island, the Atlas or the scene
      in either mode; it was most likely on the old scrolling map, which is gone. Asked in REVIEW.md)
- [x] Celestial Rift: chains attached to the blocks beside them (2026-11-26: every lantern hung from the same point,
      which was air beside the column, inside the arch and under the wing; each ruin now has its own hook on the
      stone (`HOOK` in rift.js) with a gold ring, the cord hangs straight down, and the column's rock base is no
      longer cut off its picture)
- [x] Credits after the Cursed Angel: no boss screens; the caption matches the background (2026-11-26: the fight's
      `.in-boss #world-bg { opacity: 0 }` was still on, so the world never showed while the caption named each one,
      and the angel's arena stayed up; credits.css now hides a fight's arena and shows the world while the roll is on,
      and the ending roll (`Credits.show({ ending: true })`) has the worlds only. Checked by faking a fight's end)
- [x] World scenes and win animations brought up to the Celestial Rift's detail (15 worlds, staged). The user,
      2026-11-26: "add a refresh to every worlds background and win animation with rive and motion ... make the whole
      thing more detailed, less plasticy". How it's done:
      - **Rive** (`vendor/rive/`, @rive-app/canvas 2.49.0) and **Motion** (`vendor/motion/`, 14.9.0), MIT,
        self-hosted, loaded on first use by `js/anim.js` (`Anim.play(name, { follow, rect, ms })`, `Anim.motion()`,
        `Anim.warm()` from the idle warm-up; a world's `rive:` names its file). CSP has `'wasm-unsafe-eval'`.
        The .riv files are made in code: `tools/rive/` (local only; the writer `riv.mjs` + `defs.json` from
        RhythmArchitect, `helpers.mjs`, one art script per file in `tools/rive/art/`, `node tools/rive/build.mjs
        [name]` writes `static/rive/<name>.riv`). Clipping works (`ab.add('ClippingShape', { sourceId }, node)`).
      - **Every scene** gets a finish in worlds.js (`finish`: fine grain in overlay, a soft edge falloff).
      - A world's scene goes in its own file when rebuilt (`js/worlds/<world>-scene.js`).
      - Done: **Garden** (garden-scene.js: countryside with fields, hedgerows, farmhouse and smoke, windmill,
        pond, shaded clouds and their shadows, five wildflowers, butterflies, bees, seeds; night with moon, stars,
        mist, lit window, fireflies; win: Rive wreath `garden-win`, Motion bloom from the middle, a glowing rainbow).
        **Notebook** (paper-scene.js: lamplit paper with fibres, steel spiral, mug with steam, pencil, eraser,
        sticky note, clip; blueprint by night with drafting tools and a title block; graphite doodles; win: Rive
        `paper-win` pencil circle, doodles and gold-foil stars, the stamp with a Motion press).
        **Rainy City** (rain-scene.js: cloud deck lit by far lightning, three depths of skyline, windows lighting
        up at night, café with awning, neon and drips, lamps, a wet street mirroring the lights, ringing puddles,
        umbrellas, cars; win: Rive umbrella `rain-win`). **Desert Caravan** (desert-scene.js: striped mesas, lit
        pyramids, oasis, sculpted dunes with shaded far sides, caravan, saguaros, tumbleweed, vultures; Milky Way,
        moon, lanterns, campfire by night; win: Rive treasure chest `desert-win`).
        **Big Top Carnival** (carnival-scene.js: shaded big top, carousel, Ferris wheel, coaster, booths, popcorn
        cart, pennants, balloons; bulbs, searchlights, fireworks by night; win: Rive strength tower `carnival-win`).
        **Robot Factory** (robot-scene.js: steel hall, bay door, girders, catwalk, steam pipes, lamps, gears,
        console, conveyor, articulated arms, welding sparks, drone; win: Rive trophy `robot-win`). **Sky Kingdom**
        (sky-scene.js: islands with roots, crystals and waterfalls, castle, village, rope bridge, airship, cloud sea,
        balloons; win: a Rive hot-air balloon `sky-win` beside the board). **Volcano Island** (volcano-scene.js: a
        stratovolcano with gullies, scree, basalt flows, scrub and jungle, crater rim, reflection in the lagoon,
        jungle foothills, islets, a sail; shallows over coral, a beach with grain, ripples, footprints, driftwood,
        tide-pool rock, shells, a crab, tiki torches, swaying palms, monstera, ferns, hibiscus; gulls, a canoe, a
        dolphin; night: crescent moon, crusted lava rivers, red-lit smoke, lava bombs, glow on the water; win: the
        eruption pours the rivers by day too, two Rive tikis `volcano-win` either side of the board (the right one
        mirrored: `Anim.play(..., { flip: true })`), Motion jolts the letters).
        **Neon Arcade** (arcade-scene.js: nebula sky, ringed planet, a striped sun shimmering in the heat with its
        reflection on the floor, low-poly mountains with neon ridges and wireframe, a skyline with lit windows and
        beacons, a highway with dashes, palm rows sweeping past in perspective, neon-rimmed corner palms, shooting
        stars, motes, the UFO; day = pastel vaporwave with shaded pixel clouds; win: a Rive neon marquee
        `arcade-win` draws itself round STAGE CLEAR with a joystick, buttons and coins, Motion powers up the squares).
        **Haunted Library** (library-scene.js: a two-storey hall in true perspective, bookcases full of spines with
        gilt and labels, a gallery with balusters, a rolling ladder, a ribbed ceiling, a chandelier, a gothic
        stained-glass window with lancets and a rose, coloured shafts and a pool of light, a grandfather clock
        showing the real time with its pendulum swinging, a runner with medallions, cobwebs, a book stack with a
        candle, a globe; moonlight, floating candles, lit sconces, wisps and a ghost by night; win: a Rive grimoire
        `library-win` bursts its clasp and riffles out runes, Motion turns the squares like pages).
        **Candy Hills** (candy-scene.js: a lemon-drop sun, a sugared sour-belt rainbow, spun-sugar clouds, frosted
        mountains with icing drips, a candy castle with wafer walls, swirled cone towers and gumdrop domes (lit
        windows by night), a layer cake with a chocolate waterfall into a winding glossy river, a wafer bridge,
        sugar-dusted gumdrop hills, cotton-candy and ice-cream trees, lollipops, a frosted meadow with sprinkles,
        peppermint stones, candy corn, a donut, striped candy canes; win: a Rive star piñata `candy-win` with tissue
        fringe swings in, cracks at each whack and bursts into sweets; Motion jiggles the squares).
        **Coral Reef** (ocean-scene.js: a seamless caustic net at the surface and sliding over the sand, swaying
        shafts, reef ridges fading blue, a sunken ship, lumpy bommies covered in brain, staghorn, table and tube
        corals, sea fans and sponges, anemones with clownfish, kelp with bladders, sea grass, shells, a starfish and
        an urchin; schools, tangs, butterflyfish, angelfish, a detailed turtle, a manta, a whale; jellyfish, an
        anglerfish and plankton by night; win: a Rive giant clam `ocean-win` opens its frilled mantle and lifts a
        glowing pearl, Motion bobs the squares). Candy's and the Reef's old DOM props stay as invisible anchors
        (`visibility: hidden`) that place the bursts.
        **Snow Day** (snow-scene.js: a low sun with a halo and sun dogs, ice clouds; alpine peaks with snowcaps, a
        broken snowline and lit/shaded faces split along each spine, forests on the lower slopes; a frozen lake
        with cracks and a skater; a village with cabins and a chapel, chimney smoke; drifts with blue shadows, big
        pines and birches, a fence, a sled, a winterberry bush with the cardinal perched; Milky Way, aurora, a ringed
        moon and lit windows by night; win: a Rive snowman `snow-win` builds itself (rolling base, squash, scarf,
        coal face, carrot, top hat, waving arm) instead of the SVG one).
        **Acorn Woods** (squirrel-scene.js: a golden sky with clouds lit from below, hills stippled with autumn
        woods, mist, trees at two depths with canopies built of thousands of leaves lit gold on the sun's side, a
        path winding off between them, pre-painted light shafts with dust, leaf litter, a mossy log with shelf
        fungi, toadstools, chanterelles, bronze ferns, a stump with acorns, the great oak with ridged bark, its
        hollow and its branch; a harvest moon, fog, fireflies and the owl by night; win: a Rive squirrel
        `squirrel-win` with strand-drawn fur throws a golden acorn that cracks open in light, backflips and dashes
        off; Motion sways the squares in the leaf tornado).
        **Deep Space** (space.js, upgraded in place: a finer nebula with soft wisps, star-forming knots and ragged
        dust lanes, a distant spiral galaxy, bright stars with diffraction spikes, a gas giant with turbulent bands,
        a ring gap and the rings' shadow, cratered asteroids tumbling past; by day a sun with granulation, faculae,
        sunspots with penumbras and limb darkening, a smooth corona, each planet with its own surface and night
        side, rocky belt, a comet with ion and dust tails, a ringed giant rising in the lower left; win: a Rive
        retro rocket `space-win` flies out of the warp and off the screen (artboard `clip: false`, full-screen
        rect), Motion flashes the squares).
        **Classic** (its win only: a Rive seal `classic-win` draws its ring, pops a blue disc, strokes a check and
        flicks out ticks with a shine; Motion runs a wave across the squares in reading order).
      - All 16 worlds done (2026-11-27).

### Phase 7: Retention
- [x] Daily Archive (2026-11-27): `#archive` (js/archive.js) is a month calendar drawn as a crossword grid (each day a
      square with its date as the clue number, black squares for days without puzzles, four pips for Easy / Medium /
      Hard / Challenge, filled once solved on the day or in practice), the picked day's puzzles beside it (Play,
      Continue, On the Day · time, Solved · time, Revealed), Surprise Me (a random unsolved one), arrow keys on the
      calendar. A puzzle plays on `#past` (game.js `playPast`; mode "archive", slots `archive-<date>-<kind>`, the 12
      latest games saved, practice solves in `schmoll.archive`, the day's own scores untouched; Time Traveler and
      Archivist count them). Server: `ArchiveController` (`/api/archive/days`, `/api/archive?date=&difficulty=`)
      serves only saved or shipped dailies (never makes one), a day only once it's over everywhere (noon UTC the
      next day), and leaves out switched-off dailies and any with a family-filter answer (Nov 23's Hard). Home's
      Daily card links to it. Tests: `ArchiveControllerTest`; 170 JUnit pass. Offline: with the service worker (later).
- [x] Detailed Stats page (2026-11-27): three new cards under the heatmap and times (`drawDeep` in app.js):
      How You Solve ("Saved in This Browser": days played since your first, all five in a day, no-hint solves,
      squares checked and revealed, mistakes per puzzle, given up, Archive practice), Records (fastest at each
      difficulty with its date, best Boss, best day, best streak) and Hardest for You (the solves furthest over
      your own average, each with Replay into the Archive).
- [x] Better results screen (2026-11-27): dailies and Archive puzzles show Hints (checked / revealed), Mistakes (wrong
      letters typed) and your average at that difficulty, then your recent times as bars (this one lit up) with its
      rank and how it compares with your average (`howItWent` in game.js; the New Personal Best badge stays). Scores
      and practice solves now save `mistakes` too (for the Stats page).
- [x] Weekly quests (2026-11-27): js/quests.js, css/quests.css. Three a week (one each from the daily, campaign
      and skill pools), picked by the week's Sunday so everyone has the same, new at Sunday midnight; counted from
      game.js's "win" (sets for "different days/worlds"); each gives its reward the moment it's done, marked given
      and saved before it's applied (no double rewards on reload), and finishing all three gives the week's badge
      (a medal drawn from the week's date). Rewards: four board colours (Gold, Midnight, Rose, Mint: any world's
      board, chosen on Home's card), six hero parts drawn for it (Laurel Wreath, Explorer Hat, Star Sash, Quest
      Satchel, Golden Pencil, Compass; locked in the hero maker until won), then 50 coins once everything's won.
      Home has a Weekly Quests card (the quests, progress, rewards, the badge, board colours, your badges); the
      results card lists the quests a solve moved. Privacy Notice updated.
- [ ] Offline: a service worker; the site, the campaign and opened puzzles work offline; online-only features say so

### Phase 8: Social
- [ ] Share result cards (answer-free; copy fallback)
- [ ] Leaderboard: weekly rankings
- [ ] Friend challenges (a link to the same puzzle and rules; compare after both finish)
- [ ] Custom puzzle maker (editor, validation on the server, share link, storage and retention, name/content filter,
      reports and the admin switch-off)
- [ ] Puzzle of the week: 11x11 or 13x13 grids (generator work), made ahead, with its own leaderboard

### Phase 9: Campaign expansion (100 levels)
- [ ] Map: secret branches off Acorn Woods (3), Coral Reef (5), Desert (9) and Volcano (14); unlock after that
      world's boss; optional (come back any time)
- [x] All four playable (2026-11-25); the stand-ins listed in "START HERE" still to replace
- [x] Secret world 1: the giant squirrel (hidden Acorn Woods), 2 phases
- [x] Secret world 2: Poseidon (Atlantis), 3 phases; trident that takes 5 letters to its board, unmarked
- [x] Secret world 3: the Sandworm (desert), 3 phases; sand tornado, sand dive, sand ball
- [x] Secret world 4: the lava beast (Lava Cave), 5 phases; lava columns
- [x] Next to their parent world in the dock and the Everbook's contents (commit bf94677)
- [x] Unique abilities (16) and boss moves (6 each, 24), none a copy of another world's (bf94677)
- [x] Own arenas, chaos, hero gifts (4 tops, outfits, items) and arrival scenes (d4fc08c)
- [x] Own music: 16 level songs, 13 boss phase songs, all CC0, credited (a67f791; listening copies in
      `boss-music/17-hollow...` to `20-cave...` and `boss-music/levels (secret worlds)`)
- [x] Every move and ability has its own staged effect (`js/spells-secret.js`, 033a11b; tested in real fights)
- [x] Board decorations: a mark per typed square, a trim along finished words (`deco` in secret-worlds.js, `hw-`,
      `at-`, `dn-`, `lc-` in worlds.css)
- [x] 2026-11-26 (the user: "as detailed and grand as Celestial Rift", "the sunken dunes needs a full rework", the
      bosses "need some serious work", "re color the corruption bar", music, "each song for each level is unique"):
      new backgrounds in `js/worlds/secret-scenes-a.js` (Hollow, Atlantis) and `-b.js` (Dunes rebuilt with a breaching
      worm, Cave); the four bosses redrawn in bosses.js; every secret world's level meter is its own (corruption.js
      THEMES: window, meter name, tricks, spells, seep, sounds, lines, colours, balance, easiest Hollow to hardest
      Rift); composed boss songs (Poseidon 1-2, Sandworm 1-3, Lava Beast 1-5; kit and script copied to
      `boss-music/drafts/composed-2026-11-26/`); Atlantis level 4 swapped (Aquaria was also Coral Reef 3); light
      modes made readable (--bg was dark under dark text).
- [x] Speed (the user: "lags out for 3 seconds when switching light to dark"): scene warm-ups draw into a 1x1
      canvas (worlds.js `scratch`), world cards paint a few a frame and are cached (app.js `previewCache`). Found:
      the first visit to each page in a browser session costs ~1.3 s of GPU raster (shader/glyph warm-up), then
      ~0.2 s. Not fixed yet: an idle-time warm-up of the Campaign and Daily pages (they build on demand and the
      campaign switches worlds, so it needs care).
- [x] Faster page and world switches (2026-11-27, the user: "improve performance significantly when switching pages and
      backgrounds"; measured at 200%): the last 3 scenes are kept (worlds.js `kept`), so going back to a world takes
      7-30 ms instead of 100-300 ms; first builds are cheaper (Acorn Woods 257 -> 176 ms: canopies painted once and
      stamped; Volcano 228 -> 154 ms: specks and waves batched by colour, jungle crowns stamped; colour blends cached);
      world cards are painted only near the screen and saved between visits as small WebPs (encoded when idle), so
      Settings opens in ~40 ms after the first visit; Stats no longer forces two layouts (scroll first, the heatmap's
      width from a ResizeObserver): 166 -> 48 ms of script. Still slow: the very first Settings visit in a browser
      (~2 s of GPU raster painting every card in the headless test).
- [x] The Carnival redrawn (2026-11-27, the user: "the carnival could use more updates"): carnival-scene.js
      rewritten at the other worlds' level (far hills and town, a coaster with a running train, a drop tower, a
      trussed Ferris wheel as a turning sprite, a big top in perspective, a carousel with horses in depth, game
      booths, walkers, a popcorn cart, lamps, a balloon seller; night bulbs, searchlights, fireworks). ~30 ms to build.
- [x] Ominous music when a secret world is found (2026-11-27, the user: "when stuff like this is said there needs
      to be ominous music"): `audio/music/secret-<id>.mp3`, composed for the game (scratchpad `omen/compose_omens.py`,
      copied to `boss-music/drafts/composed-2026-11-26/`), played by `showSecret` in campaign.js and stopped when
      the card goes; the fight clock no longer stops `secret-` songs. Credits updated.
- [x] The Atlas is a real map (2026-11-26, the user: "make the campaign atlas like an actual map, design the map, and
      dont put the locations in a grid"): `js/atlas-map.js` paints one illustrated continent once (coast, shallows,
      rivers, each world's country in its colours with its own pictures, Volcano Island, the sky at the top edge
      where Deep Space and the Rift hang, sea names, serpent, ship, compass, frame); every world has a hand-placed
      spot (`AtlasMap.SPOT`); atlas.js `flat` mode draws it from straight above with map markers, an inked trail
      (the way you've come in red) and fog over places not reached; zoom capped at 0.9 so it stays sharp. 60 fps.
- [x] Gold for a secret waiting (the user: "if the player beat the boss in an area that has a secret world but hasnt
      started the secret world, highlight the area in gold..."): `secretWaiting(si)` in campaign.js; the country
      glows gold with a turning gold ring at its base, its plate and Atlas page count the secret world's 5 levels.
- [x] Secret worlds next to their parent on the abilities pages (`BOOK_ORDER` in campaign.js; WORLD_ORDER still sets
      prices). No secret-world icon until the secret world is started (no "?" badge, no dock tile, no Atlas glimmer
      or rock); the parent world gets the gold instead (dock: a spinning gold ring `.ws-tile.gold`; Atlas: a solid
      gold disc and ring with a sweeping shine and circling sparkles). The user, 2026-11-26.
- [x] The Atlas map designed properly (the user, 2026-11-26: "really design this atlas map and put a lot of effort into
      its design"): `js/atlas-paint.js` paints it in a worker (atlas-map.js runs it; in the page where workers can't
      draw): countries with wandering, blended borders in a map palette, hill shading, coast contour lines, deepening
      sea, compass lines, wind curls, beaches and hatched cliffs, rivers with names, mountain ranges and foothills,
      every world's landmark scene (ruled Notebook with a pencil, patchwork Garden and windmill, the autumn forest and
      the oldest oak, peppermint Candy Hills, the reef and lighthouse, Snow Day's lake and igloo, walled Rainy City,
      the Sky Kingdom's floating isles, dunes, oasis and pyramids, the Sunken Sands' ribs and worm trail, the
      fairground, the neon Arcade, the Library's gothic towers, the Factory and rails, the Volcano and the Cave),
      the open country filled (hills, copses, hamlets), the sky with constellations and planets, the sea pouring off
      the edge of the world, sea names, serpent, Kraken, ships, compass rose, title ribbon, scale, patterned border.
- [x] No emoji anywhere (the user, 2026-11-26: "remove all emojis and instead create your own icon everywhere"):
      `js/glyphs.js` draws ~130 icons for the game (shape lists, the same data as inline SVG, canvas sprites and CSS
      images `--g-name`) and maps all 224 emoji the game used to them (`Glyph.EMOJI`). It hooks every way text reaches
      the page (an element's text or HTML, strings given to append/prepend/replaceChildren/before/after; titles and
      labels lose their emoji), FX's text sprites draw the icon, three canvas spots draw icons, the CSS ::after
      pictures use `var(--g-name)`, index.html's symbols are `<i class="gi gi-...">`. The emoji in the source are only
      names now. A browser sweep of every page, the Everbook, a boss fight and How to Play found none left.
- [x] The refresh of the non-campaign pages (done 2026-11-26; see "Home, Stats and Settings without the generated look" above; the
      Daily page is the play stage, already redone).
- [x] First-visit lag (2026-11-26, the user: "fix the first-visit lag on campaign and daily"): the first opening of a
      page made the GPU build its programs for everything on it (gradients alone were half). While Home sits idle
      (2.5 s after it settles, in idle time), `Campaign.warmStage` draws the stage once at 0.4% opacity (and warms
      the Atlas), then `Game.warmStage` draws a stand-in of the play stage (the screen's markup, a sample board, the
      play.css rules copied onto `.warm-play` through a constructed sheet) and plays the world's title card unseen
      and unheard (`warmTitleCard`: sounds, bursts and shakes held back for that moment). Nothing is fetched but the
      free map. Measured at 200% scaling: Campaign's first open 0.51-0.67 s of stall down to 0.06-0.09 s (Classic:
      0.61 to 0.12, the rest is building the world's scene), Daily's 0.21 to 0.07-0.1 s.
- [ ] Still borrowed from the parent world: title card, screen transition, sounds, mascot (by design: the companion
      is the parent's mascot). 6 boss moves each, not 10. No How to Play chapters yet. (Achievements done
      2026-11-26: four each, hidden like the Rift's until won: a level cleared, a level with its meter never above
      25%, the boss, every level at 3 stars; `hw-`, `at-`, `dn-`, `lc-` in achievements.js, 81 in all.)
- [ ] For each: world look (scene light/dark, board, win, transition, fonts), lore + an animation explaining why to
      go, an arrival animation, 4 levels + boss, corruption on every level, 4 player abilities (one per level, like
      the Rift), 10 boss moves with counterplay, arena and chaos, music (per phase + levels), hero gifts,
      achievements, companion lines, How to Play, credits
- [ ] Puzzles: 25 per level, a step harder than the parent world, unique boards, hand-written clues (no API)
- [ ] Collection gallery (heroes, companions, worlds, cosmetics)
- [ ] Skill encyclopedia (the Skill book, with practice links)
- [ ] World-completion rewards

### Phase 10: Clue rewrite
- [ ] Rewrite the bare-synonym clues in every campaign puzzle (fair = a one-word synonym only when it points to one
      answer; otherwise a specific definition, an example or a fill-in-the-blank)

### Phase 11: Leftovers from the review zip
- [x] The zip's JS bugs (2026-11-26, each checked in the code first: the old notes said some were fixed and they
      weren't): **keyboard trap** (on a button or link, Space/Enter/Tab do their usual job instead of moving on the
      board; a mouse-clicked button in the puzzle lets go of focus so Space goes back to the board); **Boss Fight
      Effects at 0** (a silent sound returns before its volume ramp, which threw RangeError); **Escape closing the
      wrong dialog** (`U.dialog` stack: the window-level Escape handlers of the question, Legal, hero maker,
      credits, story book, Copy and Report act only when theirs is on top; one Escape on a question over the Privacy
      Notice closed both before); **Report pausing the boss** (the fight's clock stops only for the end screen, a
      cinematic or a hidden tab, not the Report form or a question); **reload skipping a Daily Boss attempt** (a
      fight is marked live when it starts, `daily-<date>-live`; starting another while it's still marked counts the
      abandoned one as lost). All checked in the test browser.
- [x] Two tabs overwriting campaign progress (2026-11-27): a tab takes in another tab's save (`storage` event,
      `mergeCampaign`): best result per level, further along, secrets and attempts kept, coins/items from the newest
      save, its own fight and place kept; it saves the mix only if it adds something (no ping-pong). Checked in the page.
- [x] The grid for screen readers (2026-11-27): each square has a spoken label (row, column, number, letter or
      blank, pencilled, locked), black squares are hidden from readers, and a polite live region reads the clue, its
      length and its letters when the word changes, and "Solved" at the end. (No ARIA rows: the board's DOM stays flat
      for the worlds' decorations.)
- [ ] The zip's other leftovers: licences ("Giant Steps but Smooth", credits for CC BY tracks), ops (CI, model IDs
      from settings), two tabs overwriting campaign progress, the grid for screen readers

### Phase 12: Finish
- [ ] README, NOTICE.md, legal.js (and its date), How to Play match the game
- [ ] `mvn test` passes; a full browser pass (every screen, world, phone sizes)
- [ ] CLAUDE.md updated
- [ ] With the user's OK: merge `major-update` into `main`, remove the update page, push
- [ ] Delete this file

## Log

- 2026-11-07: questions asked and answered; plan written. Paid calls so far: $0.
- 2026-11-07: update page pushed to `main` (6b0ee02); branch `major-update` made. The test browser helper was broken
  by Edge 156 (its launcher process exits at once and the watchdog then killed the real browser); fixed in
  `tools/browser-test/` (local), see CLAUDE.md "Running things safely".
- 2026-11-07: Phase 1 done. Unlimited, the Unlimited Boss, Allow Harder Words, `/api/unlimited*` and the
  `UNLIMITED_*` settings are gone; boot.js drops their saved data once (`schmoll.noUnlimited`). 118 JUnit tests pass;
  the browser check found no errors. Home's Daily and Your Streak now sit side by side.
- 2026-11-07: Phase 2 directions published for the user to pick (REVIEW.md). Waiting on the pick; Phase 3 next.
- 2026-11-07: Phase 3 backend core done (ClueWriter, PuzzleStore, DailyMaker); 138 JUnit tests pass.
- 2026-11-07: live clue test: 9 calls, about $0.04. Paid calls so far: about $0.04 of $5.
- 2026-11-07: family filter done; 142 JUnit tests pass (3 skipped: paid).
- 2026-11-07: Phase 3 done except the two `main`-only daily fixes (waiting on the user's OK in REVIEW.md): admin
  page, health/status, daily email, report kinds, leaderboard moderation/tickets/retention, rate limiter, Docker
  user + health check, error cards, save recovery, midnight grace, share. 155 JUnit tests pass (3 skipped: paid).
  Browser checks (admin, errors, midnight, share, ticket) found and fixed: `window.FX` (always undefined: FX is a
  `const`), the story intro playing on after leaving the map, a flaky leaderboard cache. Paid calls: still $0.04.
- 2026-11-16: the campaign map rebuilt as the Island and the Everbook (Phase 5). JS tests pass (14); Java untouched. Paid calls: still $0.04.
- 2026-11-25: the Atlas on one canvas (js/atlas.js), 60 fps; see "START HERE". JS tests pass (14). Paid calls: still $0.04.
- 2026-11-25: `main`: countdown to Nov 29, then closed; no paid calls from then. The Rift found like the other
  secrets. The four secret worlds playable. 158 JUnit, 14 JS tests pass. Paid calls: still $0.04.
- 2026-11-25: campaign performance pass, the Rift as a secret world, dock pictures, Everbook page turns, How to Play's
  campaign chapter. JS tests pass (14). Paid calls: still $0.04.
