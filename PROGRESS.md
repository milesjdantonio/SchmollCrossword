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
- [ ] Wait for the user's pick (don't build the redesign before it)

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
- [ ] Clear error messages everywhere (load, save, limits, offline, unexpected), with Retry / Reload / Report /
      Home; schmollcrossword@gmail.com in the contact, report and legal pages; never claim a save that failed
- [ ] Midnight rollover: notice with Exit / Continue; 15-minute grace counts for the day before, then practice;
      a stale daily (tab left open) asks to reload; tests for time zones, DST and server/browser disagreement
- [ ] Share links: correct preview tags (title, description, image) for crawlers; answer-free result text;
      copy-link fallback
- [ ] Saves: recover from missing or damaged local saves instead of crashing; document what's stored where
- [ ] Reports: categories (wrong answer, unclear clue, typo, offensive, technical); abuse limits; an admin page
      (key-protected) to read reports, switch a puzzle off and hide a leaderboard name
- [ ] Health: logging, a key-protected developer dashboard (dailies in stock, failures, API use and estimated cost,
      reports), a daily email (SMTP settings from env vars, off when not set, never breaks the game)
- [x] Content: family-friendly answer filter (`family-words.txt`, 42 words: sex, nudity, drinking, crude words,
      insults; `App.loadFamilyWords`, skipped at every difficulty; the clue prompt asks for family-friendly clues).
      Campaign pool: 77 variants with those answers removed (each level keeps 20-25; `PuzzleStore.poolPuzzleOrNext`
      falls through to the next variant), 56 files re-clued (PEE "Letter between O and Q", BRA "Support group
      member?"). Shipped dailies left as played (the Daily Archive should hide ones with family-list answers).
- [ ] A bigger leaderboard name blocklist (and the family words in names too)
- [ ] Security: anything that costs money is a JSON POST; rate limiter keys IPv6 by /64, doesn't leak memory,
      caps survive restarts; Docker non-root user, health check
- [ ] Leaderboard: no last-name requirement; server-side timing check (a start token) so faked times are caught;
      cache standings; faster forget; retention stated

### Phase 4: Rule changes and gameplay fixes
- [ ] Re-check the point-based achievements (Perfect Score = 300 on a daily, Big Scorer = 1,000) against the new
      points
- [ ] Scoring: per-square points, Check 1, Reveal 5 (wrong/empty replaced and charged, right letters locked free),
      the +10-a-minute time bonus with size-scaled bands, Daily Boss 8 a square + stars - lost tries; the server's
      `LeaderboardController.points` matches; tests
- [ ] The daily's timer shows the current bonus and the time left before it drops
- [ ] Reveal Puzzle completes the puzzle's state consistently (Daily, Archive, Daily Boss)
- [ ] At most 10 Reveal Words per boss phase
- [ ] Boss enrage at 2.5x the boss's progress (with a small floor so the first letters don't set it off)
- [ ] Later phases shorten boss attack cooldowns more (phases 3-5 very busy but fair)
- [ ] Boss sheet: number of phases and a predicted time (your average on those puzzles, or a typical one)
- [ ] Skill-learned and boss-attack pop-ups close when clicked or tapped
- [ ] Items on one row where it fits; wraps cleanly on narrow screens
- [ ] Achievements fire correctly (and once) in every mode, boss fights included; progress survives reloads
- [ ] 10 time-based achievements with tests
- [ ] Coin and point icons drawn as our own SVG (no emoji that changes between devices)
- [ ] Zoom works on small screens; the slider's middle (50) looks like today's 100%, so players can zoom in too
- [ ] Typed letters visible in every world (some worlds hide them)
- [ ] Difficulty slope: measure the curve across all levels, chart it in REVIEW.md, wait for the user's numbers,
      then apply them
- [ ] The world-arrival animation plays when you move on after a boss or pick the next world's level; the
      Rift's plays after the Void

### Phase 5: The redesign (after the user picks a direction)
- [ ] Design system: tokens (colour, type, spacing, radius, motion), components, light/dark/System (default System)
- [ ] App shell and navigation; a world/theme control players find at once
- [ ] Home, Daily, results, Stats, Settings, How to Play, legal pages
- [ ] The puzzle screen: clearer Across/Down direction, clue bar, red pulse on a full board with errors
- [ ] Campaign map and level selection: clear completion, optional challenges, secret-world branches
- [ ] Level sheets and the boss screen
- [ ] Phone layout review (all screens)
- [ ] Renderer: world backgrounds in a worker (OffscreenCanvas) where supported, quality tiers from measured frame
      time, pause when hidden (ideas from RhythmArchitect)
- [ ] Loading: fewer requests, versioned files with long caching, lazy-load story/credits/how-to
- [ ] Accessibility and settings: text and cell size, reduced motion, optional timer and mistake counter,
      customisable keys, the grid usable with a screen reader (role grid, live clue announcements), boss assist

### Phase 6: Audio and visual polish
- [ ] Volume: default 80 sounds like today's 100; 100 is louder
- [ ] Loop fixes (measured; previews for the user to listen to): Old Grumble Owl 1, King Sourgum 1, Kraken 1,
      Yeti 1, Thunderhead 1, Sir Squall 2, Sphinx 1, Ringmaster 1, Mega Unit X 1-3, Magma Wyrm 1-3, Void 2-5,
      Cursed Angel 1
- [ ] Cursed Angel: swap phases 3 and 4
- [ ] Chrome stretched background (check every page and window shape)
- [ ] Deep Space: no black box behind the black hole
- [ ] Celestial Rift: chains attached to the blocks beside them
- [ ] Credits after the Cursed Angel: no boss screens; the caption matches the background
- [ ] World scenes and win animations brought up to the Celestial Rift's detail (15 worlds, staged)

### Phase 7: Retention
- [ ] Daily Archive (practice, no points/streak; works with offline)
- [ ] Detailed Stats page (completion, average times by difficulty, streaks, records, hardest puzzles, hints,
      mistakes); says these are this browser's stats
- [ ] Better results screen (time, hints, mistakes, personal bests, compared with your own history)
- [ ] Weekly quests (reset Sunday, no double rewards on reload; rewards: hero parts, badges, world colour variants)
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
- [ ] Secret world 1: the giant squirrel (hidden Acorn Woods), 2 phases
- [ ] Secret world 2: Poseidon (Atlantis), 3 phases; trident that takes 5 letters to its board, unmarked
- [ ] Secret world 3: the Sandworm (desert), 3 phases; sand tornado, sand dive, sand ball
- [ ] Secret world 4: the lava beast (Lava Cave), 5 phases; lava columns
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
- [ ] Go through the zip's findings that aren't covered above (JS bugs: keyboard trap, Boss Fight Effects 0,
      Escape closing the wrong dialog, Report pausing the boss, reload skipping a Daily Boss attempt; licences:
      "Giant Steps but Smooth", credits for CC BY tracks; ops: CI, model IDs from settings) and tick them off here

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
