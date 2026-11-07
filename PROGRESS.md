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
- [ ] Coin and point icons drawn as our own SVG (no emoji that changes between devices)
- [ ] Zoom works on small screens; the slider's middle (50) looks like today's 100%, so players can zoom in too
- [x] Typed letters visible in every world: measured in all 17 worlds, light and dark (contrast 9.5:1 or more). The
      thing that hid them: Shatter's `translateX(var(--sx, 0px))` was on every square all the time, which put each
      square on its own layer, so board decorations (the Garden's vines) drew over the letters. It's now only on
      while Shatter is (`.shattered`), and the deal animation's class comes off once the squares are dealt
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
- 2026-11-07: Phase 3 done except the two `main`-only daily fixes (waiting on the user's OK in REVIEW.md): admin
  page, health/status, daily email, report kinds, leaderboard moderation/tickets/retention, rate limiter, Docker
  user + health check, error cards, save recovery, midnight grace, share. 155 JUnit tests pass (3 skipped: paid).
  Browser checks (admin, errors, midnight, share, ticket) found and fixed: `window.FX` (always undefined: FX is a
  `const`), the story intro playing on after leaving the map, a flaky leaderboard cache. Paid calls: still $0.04.
