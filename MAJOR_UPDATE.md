# SchmollCrossword — Major Update Roadmap

> **Purpose:** This is the consolidated planning document for the next major development cycle. It organizes feature ideas, the made-ahead daily plan, bug fixes, polish, and longer-term expansions into an actionable roadmap.
>
> **Status:** In progress on the `major-update` branch since 2026-11-07. The checklist and progress live in [PROGRESS.md](PROGRESS.md); items that need the developer's review live in [REVIEW.md](REVIEW.md). Inspect the current code and tests before each implementation task. Update this document as decisions are made.
>
> **Removed from this plan (2026-11-07):** Unlimited mode (including the Unlimited Boss and the Allow Harder Words setting) and online multiplayer rooms. A free Daily Archive replaces Unlimited.

## 1. Project principles and current architecture

The game includes daily puzzles (Easy, Medium, Hard, Challenge and the Daily Boss), a multi-world campaign with bosses, achievements, statistics, themes, music, leaderboards, and player-submitted problem reports.

The current README describes these important architectural constraints:

- **No player accounts:** Progress, scores, streaks, statistics, achievements, and settings are saved in the browser. Do not assume a reliable cross-device player identity exists.
- **Server-side data:** Generated puzzles, leaderboards, and reports are stored by the server under the configured puzzle directory. Hosting must provide persistent storage if that data needs to survive restarts and deployments.
- **AI generation:** The current design uses the server-side Claude API for new clue generation and review. Keep credentials server-side. The latest repository change explicitly says to stick with the Claude API key and not use browser AI.
- **Daily puzzles:** Daily puzzles are intended to be identical for everyone playing the same daily, with the daily changing at each player's local midnight. The exact puzzle and clues must remain stable once published.
- **Bounded costs:** With Unlimited removed, paid generation is limited to dailies (made ahead on a schedule), the weekly puzzle, and fallbacks. Keep every paid path bounded and rate-limited.
- **Player data during the beta:** The game is in beta, so removing Unlimited erases its saved data without a migration. After the relaunch, do not introduce an account system, migrate storage, clear completion history, or change data-retention behavior without explaining the impact and getting approval.
- **Small, testable changes:** Extend existing code and persistence where possible. Avoid unrelated rewrites. Run relevant tests and report results.

### Planning rules

1. Separate bugs and polish from new systems and long-term ideas.
2. Implement work in dependency order; do not begin a feature whose required architecture is undecided.
3. Define acceptance criteria and tests before implementation.
4. Make expensive operations bounded, observable, resumable, and safe to retry.
5. Keep the game usable on desktop and mobile, including accessibility and understandable error messages.
6. Do not deploy, push to `main`, merge, delete branches, or perform destructive database/storage operations without explicit approval. (Pushing the `major-update` branch as a backup is approved.)

### Decisions (2026-11-07)

The full list is in [PROGRESS.md](PROGRESS.md). In short:

- **Order:** fixes first (reliability, dailies made ahead, rule changes), then the redesign, then audio and visual polish, retention features, social features, and the secret worlds last.
- **Redesign:** a new look for the whole app with UX as the top priority; the worlds keep their scenes and characters. Two or three directions are shown for a pick before it is built. Libraries are allowed if self-hosted, with no build step.
- **Testing:** the local server and the safe test browser may be used; up to $5 of paid Claude test calls.

## 2. Priority overview

| Priority | Workstream | Why it comes here |
|---|---|---|
| P0 — Reliability | Correctness, save safety, readable errors, daily rollover, sharing, dailies made ahead | Protect the current experience and player trust. Shipped dailies end on 2026-11-29. |
| P1 — Daily infrastructure | Validation, duplicate detection, made-ahead stock, bounded generation, health reporting | A reliable foundation so no player waits on generation. |
| P1 — Game polish | Achievements, reveal behavior, scoring, audio, visuals, UI, browser compatibility | Improves existing modes before adding large new ones. |
| P1 — Redesign | A new UI/UX for the whole app | UX is the developer's top priority. |
| P2 — Retention and statistics | Daily Archive, better result screens, detailed statistics, weekly quests, timed achievements | Gives players meaningful reasons to return. |
| P2 — Offline support | The site, the campaign and opened puzzles playable offline | Useful, with clear storage behavior. |
| P3 — Social features | Share cards, custom puzzles, friend challenges, leaderboard improvements, puzzle of the week | Build on stable puzzle identity and result validation. |
| P4 — Larger expansions | Four secret worlds, collection gallery, skill encyclopedia | Scope after reliability and core feature work. |

Priority is a suggested order, not a commitment to implement every item.

## 3. P0 — Reliability and high-impact fixes

### 3.1 Clear, actionable error messages

Create a consistent error-handling experience for network failures, puzzle loading, invalid puzzle data, generation limits, offline use, saving, and unexpected errors.

- Explain the problem in language a nontechnical player understands.
- Offer an appropriate next action: retry, reload, continue offline, report a problem, or return to the menu.
- Keep diagnostic details in developer logs; do not expose secrets or unnecessary internal details.
- Use the game contact address, **schmollcrossword@gmail.com**, in appropriate report/contact surfaces.
- Avoid claiming a save or submission succeeded until the server or local storage confirms it.

**Acceptance criteria:** Common failure cases show a readable message and a useful next step; technical details remain available for debugging; automated tests cover important API failure responses.

### 3.2 Daily puzzle midnight rollover

When a player is in a daily puzzle and their local date changes:

- Tell them that the daily has ended, and offer clear **Exit** and **Continue** choices.
- **Decision:** a daily finished within **15 minutes** after the player's midnight still counts for the previous day (score, streak and leaderboard). After that, finishing it is practice: no points, streak or leaderboard entry.
- Continuing must not silently submit the old puzzle as the new day's daily.
- If the player has not refreshed the daily data after rollover, prevent them from accidentally starting or submitting against stale daily metadata and show a reload prompt.
- Keep the exact puzzle, clues, and answer key stable for each date/difficulty. Do not silently replace a daily that someone has already started.
- Test local midnight, time-zone differences, daylight-saving changes, stale tabs, and server/browser date disagreement.

### 3.3 Share links and result cards

Fix the feature where a shared link should display an image and text in Discord, Messages, and other supported destinations.

- Share a stable URL that opens the intended puzzle or result.
- Provide suitable title, description, and image metadata for link-preview crawlers; do not rely only on client-side JavaScript to update metadata. (Found 2026-11-07: two meta tags in index.html were missing their closing `>`, which hid the image tag. Fixed on `main`.)
- Never reveal puzzle answers in a public preview.
- Include a compact result format with puzzle identifier, difficulty, solve time, hints, and solved status, where available.
- Fall back to copying the URL if the platform's native share function is unavailable.
- Test on actual target platforms, mobile and desktop, and for recipients who have never opened the site.

**Acceptance criteria:** The URL opens the correct content; preview metadata is available to crawlers; no answer key or private information leaks; unsupported share targets still have a usable copy-link flow.

### 3.4 Persistence and recovery

- Document which data is browser-local and which data is server-side.
- Verify that deployed persistent storage survives restarts and redeployments.
- Preserve unfinished puzzle state using the current save system.
- Provide graceful recovery for missing or invalid local saves instead of crashing.
- Back up important shared data before any migration or cleanup.

**Decision required:** Cross-device progress and identity cannot be guaranteed by browser-local saves alone. Do not promise cross-device synchronization without choosing and approving an identity/sync design.

## 4. P1 — Dailies made ahead

**Decision (2026-11-07):** the shared puzzle bank was planned around Unlimited. With Unlimited removed, it becomes a stock of dailies made ahead of time. The shipped dailies end on 2026-11-29; after that, each daily is currently written by the API the first time someone opens it.

### 4.1 Goal and player-facing behavior

- A scheduled job writes, checks and saves the next weeks of dailies (all five a day, plus the Daily Boss's board) before anyone needs them.
- A player never waits on generation when a made-ahead daily exists. Requests read the saved file.
- If a daily is missing and generation fails, serve a validated spare puzzle and say so, rather than an error.
- The exact puzzle and clues never change once a date's daily has been served.

### 4.2 Puzzle records and storage

Inspect the current persistence implementation before adding a new database or competing storage layer. Extend the simplest suitable existing system (the current file-based storage under the puzzle directory).

A daily record should contain, as needed:

- Stable puzzle ID (date and kind).
- Exact grid, clues, answers, and all fields required to reproduce the puzzle.
- Validation status and validation version.
- Creation time and generation source/model, where available.

A database is not automatically required just because the game has a server. Evaluate concurrency, query needs, backups, and deployment durability before recommending a migration. Do not silently migrate or delete existing data.

### 4.3 Validation and duplicates

- Validate grid dimensions, slot/answer consistency, clue coverage, crossings, difficulty, and successful loading in the game.
- Detect exact duplicates and near-duplicates (shared grids or answer sets) against at least 30 days of dailies.
- Make batch runs resumable and safe to rerun without duplicate records.
- Report made, rejected, duplicate, and failed counts.
- Do not generate thousands of puzzles during normal application startup.

### 4.4 Concurrency and failures

- Never run two generations of the same daily at once; reads never wait behind a generation.
- Use storage-level atomic writes or equivalent protection. Java synchronized methods only coordinate within a single running process; they do not coordinate multiple deployed instances.
- Do not hold a lock or a storage transaction open while waiting for an AI API call.
- Make retries idempotent and back off after failures.

### 4.5 Controlled generation and cost visibility

- Configure how many days ahead to keep in stock and how many puzzles a run may make.
- Limit concurrent jobs, retries, and total generation volume.
- Validate before publishing.
- Allow automatic generation to be disabled during development.
- Track job status, start/end time, retry count, timeout, failure reason, and final outcome.
- Track generated puzzles by kind, API calls/tokens where available, estimated cost, stock, and failed jobs.
- Never log API keys or unnecessary private data.

The preliminary estimate of **$0.01 per easy puzzle** is only an assumption, not a guaranteed price. Medium/hard puzzles, review calls, retries, and model choices can change costs. Runtime API calls may incur separate charges even if the developer has a subscription. Set provider spending limits and application-level limits.

### 4.6 Player reports and quality controls

Expand puzzle reports to distinguish incorrect answer, ambiguous clue, typo, offensive content, and technical issue.

- Allow an administrator to inspect reports and temporarily disable a problematic puzzle.
- Preserve the original record and report history for diagnosis.
- Keep structural validation separate from clue quality: a puzzle can load correctly and still contain a poor clue.
- Use the existing clue review as one quality check and player feedback/statistics as another.
- Add protection against malicious or repeated report submissions.

### 4.7 Generation screen and daily operational email

If a player request genuinely requires new puzzle generation (a rare fallback once dailies are made ahead), show a dedicated SchmollCrossword-branded waiting screen with a progress indicator and the existing rising-letter animation style.

- Explain that a new puzzle is being prepared.
- Show progress only when it reflects real job status; otherwise use honest indeterminate progress.
- Handle waiting, success, retry, cancellation where safe, and failure.
- Do not block unrelated puzzle requests while a job runs.

Send a **daily operational summary email** to the configured developer contact. Include the made-ahead stock, jobs and puzzles created, failures/retries, any fallback served to players, estimated usage/cost where available, and relevant reports/health metrics. Avoid one email per event; aggregate activity into the daily report. Keep email credentials in server configuration and make email failure non-fatal to gameplay.

### 4.8 Acceptance criteria

- Stored dailies are returned exactly as validated.
- No player request waits on Claude while a made-ahead daily exists.
- Concurrent requests do not cause duplicate jobs or inconsistent records.
- Runs can be safely resumed and rerun.
- Generation failure has an explicit, tested fallback.
- Stock levels and limits are configurable.
- Existing saves, achievements, leaderboards, and campaign behavior remain intact.
- Tests cover validation, duplicates, generation failure, retries, persistence, and concurrency.

## 5. P1 — Existing gameplay, UI, audio, and browser fixes

### 5.1 Gameplay correctness

- Ensure achievements trigger correctly in daily, archive and campaign modes, including boss fights.
- Add **10 time-based achievements**, with clear definitions and one-time triggering.
- When a player selects **Reveal Puzzle** in a daily (or the Daily Boss), complete/resolve the puzzle state consistently in the background so the displayed answers and game state agree.
- Make the daily side timer accurately communicate when the player's available points/time run out.
- Make skill-learning popups and boss-attack popups dismissible by clicking/tapping them, while preserving other controls.
- Fit the items section on one row where the layout permits, with responsive behavior on narrow screens.
- Remove the leaderboard's last-name requirement; collect only the information actually needed.
- Verify achievement progress survives reloads and works across relevant game modes.
- Change Boss Enrage to begin when the player's progress is **2.5 times** the boss's (decision 2026-11-07; it was a 25-point lead).
- Make the boss phases reduce the cooldown of boss abilities, so at phases 3-5 it's very chaotic (but keep it controlled).
- Add a Predicted Time to take for boss battles, for however many phases and the player's average time on those types of puzzles; if they don't have a saved average time, show an approximate average. Show how many phases the boss has before starting the boss.
- The Zoom doesn't do anything on screens already too small. Also make the default 50 (but make 50 look like today's 100) so a player can zoom in further as well.
- Make sure letters are visible when typing them; several worlds hide them.
- Lower the slope of difficulty (difficulty ramps up too fast and gets incredibly difficult by later levels). Predict the slope of difficulty first; the developer decides what to change it to.
- Change the check cost to 1 point per square.
- Change the reveal cost to 5 points per square. If there is a wrong letter in the revealed word, count it as a square revealed, charge for it and replace the letter. If a letter is correct, lock it at no additional cost.
- Points by square and difficulty: Easy 5 points per square; Medium 8; Hard 10; Challenge and Boss 8.
- Make the time penalty work like bonus points (decision 2026-11-07: +10 a minute): under 1:00 = +90, 1-2 min = +80, 2-3 = +70, 3-4 = +60, 4-5 = **+50**, 5-6 = +40, 6-7 = +30, 7-8 = +20, 8-9 = +10, 9:00 and up = 0. Bigger grids get longer bands in proportion to their size.
- Daily Boss score (decision 2026-11-07): 8 points per square, +50 per star, -50 per attempt lost before the win; no time bonus.
- Make a custom sprite for coins and points; they shouldn't change between devices as they do now.
- Only 10 Reveal Words per boss phase.

### 5.2 Visual fixes and polish

- Fix the background image stretching issue reported in Google Chrome while checking the currently working Vivaldi behavior. Review other browsers and window shapes as well.
- Remove the unwanted black background behind the space world's black hole.
- Attach Celestial Rift background chains properly to the blocks beside them.
- Make the Classic/world/theme control more recognizable so players can find it immediately.
- Default theme selection to **System**, respecting light/dark system preference.
- Make world and victory animations consistently detailed, using Celestial Rift as the reference quality level. Treat this as a large staged art/polish task rather than a single bug fix.
- Add the glowing red pulse around a completed board that still contains errors; ensure it is clearly visible without being excessively thin or distracting.
- Review the mobile device UI.
- Fix the credits background after beating the Cursed Angel: the roll goes to boss screens, and its caption says the background changed when it didn't.

### 5.3 Audio fixes

- Set the default sound level to **80**; keep 100 louder than the default.
- Fix the looping/transition issues for these tracks/phases:
  - Old Grumble Owl — Phase 1
  - King Sourgum — Phase 1
  - The Kraken — Phase 1
  - The Yeti — Phase 1
  - Thunderhead — Phase 1
  - Sir Squall — Phase 2
  - The Sphinx — Phase 1
  - The Ringmaster — Phase 1
  - Mega Unit X — Phases 1, 2, and 3
  - Magma Wyrm — Phases 1, 2, and 3
  - The Void — Phases 2, 3, 4, and 5
  - Cursed Angel — Phase 1
- Cursed Angel: swap Phases 3 and 4; this is a sequence correction, not a loop fix.
- For Magma Wyrm Phase 1, inspect the existing transition near the loop point before editing; Phase 2 should match the intended rhythm at the beginning of the loop.
- Test loop boundaries and transitions by listening, not only by checking that audio playback continues. (Claude measures and prepares previews; the developer listens. See REVIEW.md.)

### 5.4 Accessibility and settings

Provide or improve settings for:

- System/light/dark theme.
- Keyboard controls and customizable shortcuts.
- Sound effects and music levels.
- Reduced animations / reduced motion.
- Adjustable text and cell sizes.
- Optional timer and mistake counter.

Respect system accessibility preferences. Ensure animations and audio do not prevent a puzzle from being solved.

### 5.5 The redesign

A new UI/UX for the whole app, with UX as the top priority, using the design skills from the developer's TerraSim repository (taste-skill, Impeccable, UI UX Pro Max) and the renderer and performance ideas from RhythmArchitect.

- Covers Home, Daily, results, Stats, Settings, How to Play, the campaign map and level selection, level sheets, and the boss screen. The worlds keep their scenes and characters inside the new system.
- Two or three directions are shown as clickable mockups (desktop and phone) for the developer to pick before the redesign is built.
- Libraries are allowed if self-hosted (no CDN), with no build step; the game stays plain JavaScript.
- World backgrounds may move to a worker renderer with quality tiers, as in RhythmArchitect.

## 6. P2 — Player retention, results, and progression

### 6.1 Detailed statistics

Build on existing saved statistics and achievements with a dedicated statistics page:

- Puzzles completed and completion percentage.
- Average solve time by difficulty.
- Longest streak and personal records.
- Most difficult puzzles.
- Total hints used and mistakes made.
- Performance trends over time and additional useful measures of solving behavior.
- Clue-level time analysis only if the game already collects enough data reliably and transparently.

Do not imply cross-device or global identity tracking while progress is browser-local. Explain the difference between personal statistics and server-wide leaderboards.

### 6.2 Weekly quests and timed achievements

Examples of weekly quests:

- Complete three Medium puzzles.
- Finish a puzzle without hints.
- Complete a Hard puzzle.
- Solve puzzles across multiple difficulties.

**Decision (2026-11-07):** rewards are hero parts, badges, and world color variants (not coins). Keep rewards cosmetic; avoid making a large grind necessary to enjoy the core game.

Define quest reset time, progress rules, and duplicate-trigger protection. Test that reloading does not award the same reward repeatedly.

### 6.3 Better post-puzzle results

Show useful information after a puzzle: time, hints, mistakes, completion state, personal bests, and comparison with the player's own previous performance. Add skill-level breakdowns only where the clue metadata supports them.

### 6.4 Time-based achievements

Add ten achievements based on measurable time-related milestones. Decide exact thresholds before implementation and ensure:
- The timer uses a consistent definition of elapsed time.
- Pausing, tab suspension, reloads, and midnight rollover have explicit behavior.
- A revealed puzzle cannot earn a normal completion achievement unless intended.
- Each achievement is awarded once and has automated tests.

### 6.5 Daily Archive

**Decision (2026-11-07):** a free Daily Archive replaces Unlimited. Players can replay any past daily for practice: no points, streak or leaderboard entry. It costs nothing because it reuses saved puzzles.

## 7. P2 — Offline support

**Decision (2026-11-07):** offline packs were built around Unlimited. Instead, the site, the campaign and puzzles a player has opened (including archive puzzles) keep working without a connection.

Before implementation, decide:

- How much is cached and how it is counted against device storage.
- How offline results are stored and later reconciled.
- Which features require a connection, including leaderboards, sharing, reporting, and new dailies.
- What happens when browser storage is unavailable, full, cleared, or evicted.
- Whether users can remove cached content and view their storage use.

Keep the current plan of server-side Claude generation; do not add large local AI models as part of offline support.

**Acceptance criteria:** Opened puzzles remain playable without a connection; online-only features clearly explain why they are unavailable; reconnecting does not duplicate or corrupt local results; users can manage cached content.

## 8. P3 — Custom puzzles, sharing, and competitions

### 8.1 Custom puzzle creation

Let players create a grid, add their own answers and clues, validate the puzzle, and share it through a stable link.

Start with a simple editor and validation. Collaborative editing is out of scope for the first version.

Decide how custom puzzle data is stored, how long shared puzzles remain available, and how abusive content is handled. Validate data on the server; never trust the client to provide a valid grid or safe content.

### 8.2 Friend challenges

Allow a player to challenge a friend to solve the same puzzle and compare results afterward. This is asynchronous: each player solves on their own.

A challenge link should identify the exact puzzle and rule set. Keep answers private until the challenge's intended reveal point. Define how completion time, hints, and mistakes are compared.

### 8.3 Leaderboards and competitions

Improve daily rankings, weekly rankings, and friend competitions only after the result and identity rules are clear.

Current progress is browser-local and the game has no accounts, so a robust cross-device player identity cannot be assumed. For meaningful competitive rankings, choose a deliberate identity and server-validation design. Do not require last name. Avoid collecting personal data that is not needed.

### 8.4 Puzzle of the week

**Decision (2026-11-07):** a bigger **11x11 or 13x13** grid each week (the generator needs work to make grids that size), the same for everyone, made ahead, with its own leaderboard.

## 9. P4 — Expanded campaign, worlds, and collection ideas

These are optional expansions to consider after core work:

- Secret challenges and hidden levels unlocked through campaign progress.
- Special bosses and world-completion rewards.
- A collection gallery for heroes, companions, themes, and cosmetic unlocks.
- A crossword skill encyclopedia that explains techniques learned in campaign lessons and links to practice puzzles.
- Improve the visuals to tell if a player is going down or across.
- A world map that clearly shows completion and optional challenges.
- Improve the entire campaign level selection screen.
- Enough Secret Bosses and Levels to make the campaign 100 levels (currently sitting at 80). That means 4 new worlds, 4 new bosses, 20 new levels.
- The new bosses should all be secret worlds with their own animation to enter them.
- **Decision (2026-11-07):** each secret world is a step harder than the world it branches from, and that world's own companion goes with the player.
- Secret Boss 1: Large Squirrel Boss, secret world in a hidden part of Acorn Woods, unlocked after completing Acorn Woods. One ability idea is to roll one large acorn across the board that deletes 3 rows. Another is to have small squirrels steal letters and then follow the mouse; the player must lead the squirrel back to where the letter came from (with a dashed track from the squirrel to the letter). 2 Phases, 10 Boss Abilities.
- Secret Boss 2: Poseidon, secret world in the city of Atlantis, unlocked after the ocean section. One Poseidon ability is to throw a trident that attaches to 5 letters; if you don't break the trident, it steals the letters and adds 5 letters to the boss's board, and it does not mark that the letters were taken. 3 Phases, 10 Boss Abilities.
- Secret Boss 3: Sandworm, secret world found after finishing the desert section. One ability idea is a sand tornado that travels across the board scrambling letters. Another is that the worm covers the board in sand, then dives in, deleting letters from the player's board. Another is that the worm forms a sand ball that turns into letters it puts on its own board; the player must click to destroy the ball and get letters of their own instead. 3 Phases, 10 Boss Abilities.
- Secret Boss 4: Some sort of Lava Beast, in the Lava Cave, secret world after the volcano section. One ability is lava columns, which cover columns of the player's board with flowing lava, preventing them from typing or clicking there. 5 Phases, 10 Boss Abilities.
- Each Secret world has 4 new player abilities, organized just like the Celestial Rift's.
- For each Secret world, put it in the lore somehow (and show how through an animation) so it makes sense to the player why they have to go defeat that boss (but it shouldn't be required that they do it now; they can come back to it).
- Implement Corruption (from the Celestial Rift) for every secret level.
- Music: free-license songs (CC0/CC BY), and composed ones where needed (decision 2026-11-07).

Keep new progression systems connected to the existing campaign, achievements, and rewards. Prefer extending existing systems rather than introducing overlapping currencies or progression tracks.

## 10. Suggested implementation sequence

1. **Baseline:** Inspect the current code, current tests, persistence, and outstanding bugs. Record current behavior before changing it.
2. **Removals:** Remove Unlimited (game, server, saved data, docs) and online multiplayer (plan).
3. **Redesign directions:** Show two or three directions early, so the pick happens while the fixes go on.
4. **Reliability:** Dailies made ahead, share previews, actionable errors, daily rollover, save recovery, reveal behavior, and achievement correctness.
5. **Operations:** The daily email, the developer dashboard, and the administrative report workflow.
6. **Rules:** Scoring, reveal, boss rules, zoom, difficulty slope.
7. **Redesign:** Build the chosen direction across the app, with accessibility and settings.
8. **Polish:** Fix the browser, world visuals, music loops, and responsive UI issues in small groups.
9. **Retention:** Daily Archive, detailed statistics, post-game analysis, weekly quests, timed achievements, offline support.
10. **Social features:** Share cards, custom puzzle creation, friend challenges, competition improvements, puzzle of the week.
11. **Expansions:** The four secret worlds and the collection additions.

Each step should be split into reviewable tasks with its own acceptance criteria and test results. Reorder only when a real dependency or urgent bug justifies it.

## 11. Required workflow for implementation tasks

Before editing:

1. Read the relevant source files and tests on the current branch.
2. Identify what already exists and what this task changes.
3. List dependencies, affected files, persistence changes, compatibility risks, and unresolved product decisions.
4. Propose the smallest implementation plan.
5. Wait for approval before high-risk migrations, destructive changes, or broad rewrites.

After editing:

1. Run relevant automated tests and report exactly which tests passed or failed.
2. Add tests for regression cases and failure paths.
3. Summarize files changed, behavior changed, configuration required, and known limitations.
4. Do not claim a test was run if it was not.
5. Do not deploy, push to `main`, merge, or perform destructive operations without explicit permission.

## 12. Completion checklist

A workstream is not complete merely because the feature appears to work once. Confirm that:

- [ ] Acceptance criteria are met.
- [ ] Relevant automated tests pass.
- [ ] Failure and retry behavior is tested.
- [ ] Existing saved progress and achievements are preserved.
- [ ] Desktop, mobile, and supported browser behavior is checked where relevant.
- [ ] Errors are understandable and actionable.
- [ ] Secrets and private data are not exposed.
- [ ] Cost, storage, and operational impact are documented.
- [ ] Documentation is updated to match the implementation.
- [ ] Remaining limitations and follow-up work are recorded.

---

**Source documents consolidated:** NEW_FEATURE.md, PUZZLE_BANK_PLAN.md, and RANDOM_CHANGE.md, organized into priorities, dependencies, and acceptance criteria.


---

## Appendix A — Detailed Existing Bug Checklist

These are specific tasks from the original notes. Keep them here so consolidating the planning files does not lose individual fixes.

### Campaign visuals and navigation
- [ ] Fix the Celestial Rift background chains so they attach correctly to nearby blocks.
- [ ] Remove the unwanted black background behind the Space world's black hole.
- [ ] Fix the stretched image/background issue observed in Google Chrome (it looked correct in Vivaldi).
- [ ] Make every world and victory animation approach the detail level of Celestial Rift.
- [ ] Play the world transition animation when the player advances after defeating a boss or manually selects the next level. For the Angel sequence, play it after defeating the Void.
- [ ] Make the world/theme selector more recognizable, especially for changing dark mode; follow the operating-system theme by default.
- [ ] Make skill-learning and boss-attack pop-ups dismissible by clicking them.
- [ ] Fit the inventory/items section on one row where the layout allows it.

### Audio fixes
- [ ] Set the current sound-volume default to 80; make the 100 setting louder than the current 100 setting.
- [ ] Review the following tracks/phases for loop issues:
  - Old Grumble Owl — Phase 1
  - King Sourgum — Phase 1
  - The Kraken — Phase 1
  - The Yeti — Phase 1
  - Thunderhead — Phase 1
  - Sir Squall — Phase 2
  - The Sphinx — Phase 1
  - The Ringmaster — Phase 1
  - Mega Unit X — Phases 1, 2, and 3
  - Magma Wyrm — Phase 1 (loop boundary appears to be set up immediately before the loop)
  - Magma Wyrm — Phase 2 (review the rhythm leading into the guitar and compare it with the start)
  - Magma Wyrm — Phase 3
  - The Void — Phases 2 and 3
  - The Void — Phases 4 and 5 (nearly correct; fine-tune the loop)
  - Cursed Angel — Phase 1 (currently replays the full track instead of looping properly)
- [ ] Swap Cursed Angel Phase 3 and Phase 4; this is an ordering fix, not a loop fix.

### Daily and achievement behavior
- [ ] Verify achievements across Daily, Archive, and boss-related gameplay; each should trigger correctly and only once.
- [ ] Add 10 time-based achievements.
- [ ] When a player uses "Reveal Puzzle" in a Daily, complete the puzzle state in the background as well as displaying the answer.
- [ ] Show the time remaining until the Daily's cutoff/points expire.
- [ ] At midnight, if a player is still playing a Daily, explain that the date has changed; a finish within 15 minutes still counts for the previous date, after that it is practice; offer clear exit/continue choices.
- [ ] If a player has not loaded the new Daily after the date changes, prevent them from accidentally playing the stale Daily and prompt them to reload.
- [ ] Remove the leaderboard's last-name requirement.

### General quality and support
- [ ] Fix browser-specific HTML issues.
- [ ] Add understandable, actionable error messages throughout the game, including retry/reload/report options where appropriate.
- [ ] Add `schmollcrossword@gmail.com` to appropriate contact, support, and problem-reporting locations.
- [ ] Investigate the existing persistence architecture before deciding whether a database is necessary. Document which data currently works, where it is stored, and what can be lost on restart/deployment; do not introduce a database solely on assumption.
- [ ] Add a developer dashboard for puzzle-generation, stock, error, and game-health metrics.
- [ ] Make the site, the campaign and opened puzzles work offline, with clear storage behavior.
- [ ] Improve share links so Discord/messages can display a preview image and text without exposing puzzle answers. Test actual crawler-generated previews, not only the in-game share UI.

## Appendix B — Feature Details Retained from Original Notes

### Custom puzzles
- Allow players to create a custom grid and enter their own words and clues, validate it, and share a link. Start with a simple editor; defer collaborative editing until the basic format is reliable.

### Weekly quests
- Examples: complete three Medium puzzles, solve without hints, or finish a Hard puzzle.
- Rewards: hero parts, badges, and world color variants.

### Shareable results
- Provide a compact, answer-safe result suitable for Discord, messages, and social platforms. Example fields: puzzle number, difficulty, solve time, hints used, and solved status.

### Statistics
- Include completion count and rate, average solve time by difficulty, longest streak, personal records, difficult puzzles, hints, and mistakes.

### Gameplay customization
- Support light, dark, and system themes; keyboard controls/shortcuts; sound effects and reduced motion; adjustable text/cell size; and optional timer/mistake counter.

### Made-ahead daily safeguards
- Store the exact validated puzzle, rather than regenerating it from a seed or prompt whenever it is played.
- Use atomic writes or equivalent protection for concurrent requests; in-process synchronization alone does not protect multiple server instances.
- Run batches safely and resumably; never run a huge generation batch automatically at startup.
- Validate structure, answer lengths, clue numbering, crossings, clue quality, and uniqueness before publishing a puzzle.
- Keep generation jobs bounded and observable with statuses, retries, timeouts, and failure reasons. Prevent duplicate jobs.
- Track stock and quality, reports, generation failures, and API usage/cost where available.
- Do not expose provider credentials or unnecessary answer/user data in production logs.
- Preserve daily puzzle identity. A regenerated puzzle must not silently replace a Daily that has already been served.
- Send a single daily developer summary email with a compact health report, rather than one email per event.
- If a puzzle needs to be generated, show a branded loading screen with progress and the existing rising-letter visual motif; provide a graceful failure state and retry path.
- Preserve the current Claude API-key approach. Do not migrate to browser AI/WebGPU unless a separate decision is made later.

### Other notes
- There's a bug in the background of the credits after beating the Angel Boss (see 5.2).
- Make it so there are only 10 reveals of a word per boss phase.
- Clue writing produces a lot of clues that are bare synonyms, and they are mostly unfair; fix this. **Decision (2026-11-07):** fix everything: the AI prompt, the shipped dailies, and every campaign clue. A one-word synonym is fair only when it points to a single answer; otherwise use a specific definition, an example, or a fill-in-the-blank.
