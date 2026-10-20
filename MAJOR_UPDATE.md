# SchmollCrossword — Major Update Roadmap

> **Purpose:** This is the consolidated planning document for the next major development cycle. It organizes feature ideas, the shared puzzle-bank plan, bug fixes, polish, and longer-term expansions into an actionable roadmap.
>
> **Status:** Planning document, not a statement that these features are already implemented. Inspect the current code and tests before each implementation task. Update this document as decisions are made.

## 1. Project principles and current architecture

The current game includes daily puzzles, unlimited puzzles, a multi-world campaign with bosses, achievements, statistics, themes, music, leaderboards, and player-submitted problem reports.

The current README describes these important architectural constraints:

- **No player accounts:** Progress, scores, streaks, statistics, achievements, and settings are saved in the browser. Do not assume a reliable cross-device player identity exists.
- **Server-side data:** Generated puzzles, leaderboards, and reports are stored by the server under the configured puzzle directory. Hosting must provide persistent storage if that data needs to survive restarts and deployments.
- **AI generation:** The current design uses the server-side Claude API for new clue generation and review. Keep credentials server-side. The latest repository change explicitly says to stick with the Claude API key and not use browser AI.
- **Daily puzzles:** Daily puzzles are intended to be identical for everyone playing the same daily, with the daily changing at each player's local midnight. The exact puzzle and clues must remain stable once published.
- **Existing limits:** Unlimited generation has per-player and global daily limits. Do not remove or bypass them without an explicit cost and abuse-control plan.
- **Preserve existing player data:** Do not introduce an account system, migrate storage, clear completion history, or change data-retention behavior without explaining the impact and getting approval.
- **Small, testable changes:** Extend existing code and persistence where possible. Avoid unrelated rewrites. Run relevant tests and report results.

### Planning rules

1. Separate bugs and polish from new systems and long-term ideas.
2. Implement work in dependency order; do not begin a feature whose required architecture is undecided.
3. Define acceptance criteria and tests before implementation.
4. Make expensive operations bounded, observable, resumable, and safe to retry.
5. Keep the game usable on desktop and mobile, including accessibility and understandable error messages.
6. Do not deploy, push, merge, delete branches, or perform destructive database/storage operations without explicit approval.

## 2. Priority overview

| Priority | Workstream | Why it comes here |
|---|---|---|
| P0 — Reliability | Correctness, save safety, readable errors, daily rollover, sharing | Protect the current experience and player trust. |
| P1 — Puzzle infrastructure | Shared bank, validation, duplicate detection, assignment history, bounded replenishment | Reduces repeated generation and establishes a reliable foundation for growth. |
| P1 — Game polish | Achievements, reveal behavior, audio, visuals, UI, browser compatibility | Improves existing modes before adding large new ones. |
| P2 — Retention and statistics | Better result screens, detailed statistics, weekly quests, timed achievements | Gives players meaningful reasons to return. |
| P2 — Offline support | Downloadable puzzle packs and clear offline behavior | Useful, but requires storage and synchronization decisions. |
| P3 — Social features | Custom puzzles, shareable challenges, leaderboards/competitions | Build on stable puzzle identity and result validation. |
| P4 — Online multiplayer | Eight-digit rooms, up to ten players, live progress and host settings | Highest complexity; requires server-authoritative session handling. |
| P4 — Larger expansions | More detailed worlds, secret content, extensive cosmetics | Scope only after reliability and core feature work. |

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

- Tell them that the daily has ended and their unfinished run will not count toward the previous day's result, if that is the chosen scoring rule.
- Offer clear **Exit** and **Continue** choices.
- Continuing must not silently submit the old puzzle as the new day's daily.
- If the player has not refreshed the daily data after rollover, prevent them from accidentally starting or submitting against stale daily metadata and show a reload prompt.
- Keep the exact puzzle, clues, and answer key stable for each date/difficulty. Do not silently replace a daily that someone has already started.
- Test local midnight, time-zone differences, daylight-saving changes, stale tabs, and server/browser date disagreement.

**Decision required:** Specify whether an unfinished old daily can still be played for practice after midnight, and exactly which results count toward streaks and leaderboards.

### 3.3 Share links and result cards

Fix the feature where a shared link should display an image and text in Discord, Messages, and other supported destinations.

- Share a stable URL that opens the intended puzzle or result.
- Provide suitable title, description, and image metadata for link-preview crawlers; do not rely only on client-side JavaScript to update metadata.
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

## 4. P1 — Shared puzzle bank

### 4.1 Goal and player-facing behavior

Create a persistent shared bank so players can receive previously generated puzzles instead of generating a new puzzle for every play. Multiple players may receive the same puzzle, but a player should normally receive puzzles they have not completed.

Initial planning target: approximately **1,000–3,000 pre-generated puzzles** across supported difficulties. This is a target to evaluate, not an instruction to launch an uncontrolled generation batch.

Request flow:

1. Resolve the requested difficulty and settings that affect puzzle compatibility.
2. Find a validated, compatible bank puzzle.
3. Prefer an uncompleted puzzle and avoid repeating a puzzle already assigned to the same player when reliable identity/history exists.
4. Record the assignment and return the exact stored puzzle.
5. If the eligible pool is empty, use a bounded generation/replenishment path or a documented fallback.
6. Record completion separately. Completion must not remove a puzzle from the shared bank.

Resume an unfinished puzzle by default when the existing save state allows it. Assignment history and completion history are distinct.

### 4.2 Puzzle records and storage

Inspect the current persistence implementation before adding a new database or competing storage layer. Extend the simplest suitable existing system.

A bank record should contain, as needed:

- Stable puzzle ID.
- Difficulty and compatible game settings.
- Exact grid, clues, answers, and all fields required to reproduce the puzzle.
- Validation status and validation version.
- Creation time and generation source/model, where available.
- Optional usage, assignment, report, and quality statistics.

Keep player-specific assignment/completion history separate from the shared puzzle record. Use a uniqueness constraint or equivalent safeguard for duplicate history entries.

The README currently describes file-based persistence for generated puzzles, leaderboards, and reports. A database is not automatically required just because the game has a server. Evaluate concurrency, query needs, backups, and deployment durability before recommending a migration. Do not silently migrate or delete existing data.

### 4.3 Importing the initial inventory

- Inspect and validate the current puzzle format and generator before importing.
- Validate grid dimensions, slot/answer consistency, clue coverage, crossings, difficulty, and successful loading in the game.
- Detect exact duplicates and, where practical, near-duplicates based on grids and answer sets.
- Make batch imports resumable and safe to rerun without duplicate records.
- Report imported, rejected, duplicate, and failed counts.
- Do not generate thousands of puzzles during normal application startup.

### 4.4 Assignment, concurrency, and exhaustion

- Allow different players to receive the same bank puzzle.
- Avoid giving one player the same puzzle repeatedly while alternatives exist.
- Make simultaneous requests and multiple tabs safe.
- Use storage-level uniqueness, transactions, or equivalent protection where needed. Java synchronized methods only coordinate within a single running process; they do not coordinate multiple deployed instances.
- Do not hold a long-running storage transaction open while waiting for an AI API call.
- Avoid duplicate generation jobs when many players request puzzles from an empty pool at once.
- Make retries idempotent where practical.
- Define a fallback for a player who has completed every eligible puzzle. Do not endlessly generate puzzles or silently repeat completed ones without a documented policy.

### 4.5 Controlled replenishment and cost visibility

- Configure low-water inventory thresholds per difficulty.
- Replenish based on available eligible inventory, not every completion.
- Generate in bounded batches; the proposed initial batch size is **five per needed difficulty**, subject to configuration and measured demand.
- Limit concurrent jobs, retries, and total generation volume.
- Validate before publishing to the bank.
- Allow automatic replenishment to be disabled during development.
- Track job status, start/end time, retry count, timeout, failure reason, and final outcome.
- Track generated puzzles by difficulty, API calls/tokens where available, estimated cost, inventory, assignments, completions, and failed jobs.
- Calculate new puzzles generated per 1,000 plays; do not assume cost grows logarithmically.
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

If a player request genuinely requires new puzzle generation, show a dedicated SchmollCrossword-branded waiting screen with a progress indicator and the existing rising-letter animation style.

- Explain that a new puzzle is being prepared.
- Show progress only when it reflects real job status; otherwise use honest indeterminate progress.
- Handle waiting, success, retry, cancellation where safe, and failure.
- Do not block unrelated puzzle requests while a job runs.

Send a **daily operational summary email** to the configured developer contact when new generation was needed. Include how many players triggered the fallback, jobs and puzzles created by difficulty, failures/retries, bank inventory, estimated usage/cost where available, and relevant reports/health metrics. Avoid one email per player; aggregate activity into the daily report. Keep email credentials in server configuration and make email failure non-fatal to gameplay.

### 4.8 Puzzle-bank acceptance criteria

- Bank is checked before any new generation request.
- Stored puzzles are returned exactly as validated.
- A completion does not remove a puzzle from the bank.
- Assignment and completion history are separate.
- Concurrent requests do not cause uncontrolled duplicate jobs or inconsistent records.
- Imports can be safely resumed and rerun.
- Exhaustion and generation failure have explicit tested fallbacks.
- Replenishment limits and thresholds are configurable.
- Existing saves, achievements, leaderboards, and campaign behavior remain intact.
- Tests cover validation, duplicates, assignment, exhaustion, generation failure, retries, persistence, and concurrency.

## 5. P1 — Existing gameplay, UI, audio, and browser fixes

### 5.1 Gameplay correctness

- Ensure achievements trigger correctly in daily and unlimited modes, including boss fights.
- Add **10 time-based achievements**, with clear definitions and one-time triggering.
- When a player selects **Reveal Puzzle** in daily or unlimited, complete/resolve the puzzle state consistently in the background so the displayed answers and game state agree.
- Make the daily side timer accurately communicate when the player's available points/time run out.
- Make skill-learning popups and boss-attack popups dismissible by clicking/tapping them, while preserving other controls.
- Fit the items section on one row where the layout permits, with responsive behavior on narrow screens.
- Remove the leaderboard's last-name requirement; collect only the information actually needed.
- Verify achievement progress survives reloads and works across relevant game modes.
- Change Boss Enrage to begin when the player is 50% more progress than the player
- Make the boss phases reduce the cooldown off boss abilities, so at phase 3 - 5 its very chaotic (but keep it controlled)
- Add a Predicted Time to take for boss battles, for however how many phases and their average time on those types of puzzles, if they dont have a saved average time then just put an approximate average, also save how many phases the boss has before starting the boss
- The Zoom doesnt do anything on screens already too small, Also make the default 50(but make 50 look like 100) so a player can soom in further as well
- Make sure letters are visible when typing them, several worlds remove this
- Lower the slope of difficulty (Difficuty ramps up too fast and gets incredibly difficult by later levels) As needed, predict the slope of difficulty and ill tell you what to change it to
- Change the check cost to 1 points per sqaure
- Change the reveal cost to 5 points per square. If there is a wrong letter in the revealed word, count it as a square revealed and cost them, replace the letter too. If the letter is correct, lock that letter at no additional cost.
- Change the point values to adjust per game to be by square add difficulty. Easy: 5 Points Per Square; Medium: 8 Points per Square; Hard: 10 Points per Square, Challenge & Boss are 8 per Square
- Make the time penalty work more like bonus points, so it will say plus 50 if you completed in above 4 minutes but under 5 minutes. 
- Make a custom sprite for coins and points, they shouldn't change between devices as it does now

### 5.2 Visual fixes and polish

- Fix the background image stretching issue reported in Google Chrome while checking the currently working Vivaldi behavior. Review other browsers as well.
- Remove the unwanted black background behind the space world's black hole.
- Attach Celestial Rift background chains properly to the blocks beside them.
- Make the Classic/world/theme control more recognizable so players can find it immediately.
- Default theme selection to **System**, respecting light/dark system preference.
- Make world and victory animations consistently detailed, using Celestial Rift as the reference quality level. Treat this as a large staged art/polish task rather than a single bug fix.
- Add the glowing red pulse around a completed board that still contains errors; ensure it is clearly visible without being excessively thin or distracting.
- Review Module Device's UI 

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
- Test loop boundaries and transitions by listening, not only by checking that audio playback continues.

### 5.4 Accessibility and settings

Provide or improve settings for:

- System/light/dark theme.
- Keyboard controls and customizable shortcuts.
- Sound effects and music levels.
- Reduced animations / reduced motion.
- Adjustable text and cell sizes.
- Optional timer and mistake counter.

Respect system accessibility preferences. Ensure animations and audio do not prevent a puzzle from being solved.

## 6. P2 — Player retention, results, and progression

### 6.1 Detailed statistics

Build on existing saved statistics and achievements with a dedicated statistics page:

- Puzzles completed and completion percentage.
- Average solve time by difficulty.
- Longest streak and personal records.
- Most difficult puzzles.
- Total hints used and mistakes made.
- Unlimited-mode performance trends and additional useful measures of solving behavior.
- Clue-level time analysis only if the game already collects enough data reliably and transparently.

Do not imply cross-device or global identity tracking while progress is browser-local. Explain the difference between personal statistics and server-wide leaderboards.

### 6.2 Weekly quests and timed achievements

Examples of weekly quests:

- Complete three Medium puzzles.
- Finish a puzzle without hints.
- Complete a Hard puzzle.
- Solve puzzles across multiple difficulties.

Rewards can include achievement badges, profile decorations, or themes. Keep rewards cosmetic or otherwise balanced; avoid making a large grind necessary to enjoy the core game.

Define quest reset time, progress rules, and duplicate-trigger protection. Test that reloading does not award the same reward repeatedly.

### 6.3 Better post-puzzle results

Show useful information after a puzzle: time, hints, mistakes, completion state, personal bests, and comparison with the player's own previous performance. Add skill-level breakdowns only where the clue metadata supports them.

### 6.4 Time-based achievements

Add ten achievements based on measurable time-related milestones. Decide exact thresholds before implementation and ensure:
- The timer uses a consistent definition of elapsed time.
- Pausing, tab suspension, reloads, and midnight rollover have explicit behavior.
- A revealed puzzle cannot earn a normal completion achievement unless intended.
- Each achievement is awarded once and has automated tests.

## 7. P2 — Offline puzzle packs

Allow players to save a chosen number of puzzles for offline play, considering packs of **5, 10, 25, or 50 per difficulty**.

Before implementation, decide:

- Whether the pack contains complete puzzle sets or individual puzzles.
- How downloaded puzzles are counted against device storage.
- How duplicate puzzles are avoided when downloading multiple packs.
- How offline results are stored and later reconciled.
- Which features require a connection, including leaderboards, sharing, reporting, and new puzzle generation.
- What happens when browser storage is unavailable, full, cleared, or evicted.
- Whether users can remove downloaded packs and view their storage use.

Keep puzzle downloads distinct from model downloads. The current plan is to use server-side Claude generation, not browser AI; do not add large local AI models as part of offline puzzle support.

**Acceptance criteria:** Downloaded puzzles remain playable without a connection; online-only features clearly explain why they are unavailable; reconnecting does not duplicate or corrupt local results; users can manage downloaded content.

## 8. P3 — Custom puzzles, sharing, and competitions

### 8.1 Custom puzzle creation

Let players create a grid, add their own answers and clues, validate the puzzle, and share it through a stable link.

Start with a simple editor and validation. Collaborative editing is out of scope for the first version.

Decide how custom puzzle data is stored, how long shared puzzles remain available, and how abusive content is handled. Validate data on the server; never trust the client to provide a valid grid or safe content.

### 8.2 Friend challenges

Allow a player to challenge a friend to solve the same puzzle and compare results afterward. This can be built before real-time multiplayer.

A challenge link should identify the exact puzzle and rule set. Keep answers private until the challenge's intended reveal point. Define how completion time, hints, and mistakes are compared.

### 8.3 Leaderboards and competitions

Improve daily rankings, weekly challenges, and friend competitions only after the result and identity rules are clear.

Current progress is browser-local and the game has no accounts, so a robust cross-device player identity cannot be assumed. For meaningful competitive rankings, choose a deliberate identity and server-validation design. Do not require last name. Avoid collecting personal data that is not needed.

## 9. P4 — Online multiplayer

Create an **Online** mode using an eight-digit room code displayed as **____-____**, with a maximum of ten players.

### Initial experience

- A host creates a room and selects difficulty and match settings.
- Players join with the room code.
- The room displays each player's hero and progress.
- Opponents' boards are greyed out rather than revealing their answers.
- When a player finishes with errors, reuse the red-pulse visual treatment.
- Include host options for difficulty and whether the match awards second/third-place results.
- Add polished, readable animations without making them necessary for understanding the race.

### Technical requirements

- The server must be authoritative for room membership, puzzle identity, timers, completion state, and rankings.
- Use a single shared puzzle/rule set for the room.
- Handle disconnects, reconnects, refreshes, expired rooms, host departure, duplicate joins, and room-code collisions.
- Prevent client-side timer manipulation from determining official results.
- Do not leak another player's board answers.
- Keep room capacity capped at ten.
- Define room lifetime and cleanup behavior.
- Add automated tests for normal matches, invalid codes, full rooms, disconnects, and concurrent joins.

**Dependency:** Build this after the puzzle identity, persistence, and result-validation decisions are settled. It is a larger feature and should not delay reliability fixes or the puzzle bank.

## 10. P4 — Expanded campaign, worlds, and collection ideas

These are optional expansions to consider after core work:

- Secret challenges and hidden levels unlocked through campaign progress.
- Special bosses and world-completion rewards.
- A collection gallery for heroes, companions, themes, and cosmetic unlocks.
- A crossword skill encyclopedia that explains techniques learned in campaign lessons and links to practice puzzles.
- A puzzle-of-the-week mode.
- A world map that clearly shows completion and optional challenges. 
- Improve the entire campaign level selection screen
- Enough Secret Bosses and Levels to make the campaign 100 levels (currently sitting at 80) So that means 4 new world, 4 new bosses, 20 new levels 
- The new bosses should all be secert worlds with their own animation to enter them
- Secret Boss 1: Large Squirrel Boss, secret world in a hidden part of acorn woods unlocked after completing acorn woods. One ability Idea is to two roll one large acorn across the board that deletes 3 rows. Another ability idea is to have small squirrels steal letters and then follow the mouse, then the user must lead the squirrel back to where the letter went(have a dashed track from the squirrel to the letter) 2 Phases, 10 Boss Abilities. 
- Secret Boss 2: Posiedon, Secret world in the city of Atlantis unlocked after the ocean section, One Posiedon Ability is To throw a trident that attches to 5 letters and if you dont break the trident, it steals the letters and adds 5 letters to the bosses board, Does not mark if the letter was taken. 3 Phases, 10 Boss Abilities 
- Secret Boss 3: Sandworm, secret world found after finishing the desert section, One ability idea is a sand tornado that travels across the board scrambling letters. Another idea is the earth worm covers the board in sand then dives in deleting letters from the users board. Another idea is the worm forms a sand ball that turns into letters that they put on their board, the player must click to destroy the ball and instead get letters of their own. 3 Phases, 10 Boss Abilities 
- Secret Boss 4: Some sort of Lava Beast, in the Lava Cave, secret world after the volcano section. One Ability is lava columns which covers columns of the users board with flowing lava preventing them from typing or click there. 5 Phases, Boss 10 Abilities 
- Each Secret world has 4 new player abilities for the player organized just like how celestial rift is organized 
- For each Secret world, put them in the lore somehow(and show how through an animation) so it makes sense to the player why they have to go kill that boss (but it shouldn't be required that they do it now, they can come back to it)

Keep new progression systems connected to the existing campaign, achievements, and rewards. Prefer extending existing systems rather than introducing overlapping currencies or progression tracks.

## 11. Suggested implementation sequence

1. **Baseline:** Inspect the current code, current tests, persistence, and outstanding bugs. Record current behavior before changing it.
2. **Reliability:** Fix share previews, actionable errors, daily rollover, save recovery, reveal behavior, and achievement correctness.
3. **Puzzle-bank design:** Map the plan to existing persistence and identity. Present the proposed storage model, migrations (if any), concurrency design, cost controls, and risks for approval.
4. **Puzzle-bank core:** Add validation, stable IDs, duplicate detection, safe import, assignment history, completion history, and tests.
5. **Controlled generation:** Add low-water replenishment, bounded jobs/retries, generation status, operational metrics, and the branded waiting screen.
6. **Operations:** Add the daily email report and administrative puzzle-report workflow.
7. **Polish:** Fix the browser, world visuals, music loops, responsive UI, settings, and accessibility issues in small groups.
8. **Retention:** Add detailed statistics, post-game analysis, weekly quests, and timed achievements.
9. **Offline:** Implement downloadable puzzle packs with explicit storage and synchronization behavior.
10. **Social features:** Add custom puzzle creation, friend challenges, and competition improvements.
11. **Multiplayer and expansions:** Build online rooms and larger campaign/collection additions after the underlying systems are stable.

Each step should be split into reviewable tasks with its own acceptance criteria and test results. Reorder only when a real dependency or urgent bug justifies it.

## 12. Required workflow for implementation tasks

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
5. Do not deploy, push, merge, or perform destructive operations without explicit permission.

## 13. Completion checklist

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

**Source documents consolidated:** NEW_FEATURE.md, PUZZLE_BANK_PLAN.md, and RANDOM_CHANGE.md, organized into priorities, dependencies, and acceptance criteria. Keep those source files until the roadmap has been reviewed and approved; this file is the organized master plan, not authorization to implement every item at once.


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

### Daily, unlimited, and achievement behavior
- [ ] Verify achievements across Daily, Unlimited, and boss-related gameplay; each should trigger correctly and only once.
- [ ] Add 10 time-based achievements.
- [ ] When a player uses “Reveal Puzzle” in Daily or Unlimited, complete the puzzle state in the background as well as displaying the answer.
- [ ] Show the time remaining until the Daily's cutoff/points expire.
- [ ] At midnight, if a player is still playing a Daily, explain that the date has changed and that the current run will no longer count for the previous date; offer clear exit/continue choices.
- [ ] If a player has not loaded the new Daily after the date changes, prevent them from accidentally playing the stale Daily and prompt them to reload.
- [ ] Remove the leaderboard's last-name requirement.

### Multiplayer specification
- [ ] Add an Online multiplayer mode using room codes formatted as `XXXX-XXXX` (eight characters grouped by a hyphen).
- [ ] Support up to 10 players per room.
- [ ] Show each participant's hero and progress with clear animations.
- [ ] Represent unfilled cells/boards in a muted grey state; reuse the existing red-pulse treatment to identify a completed board that still contains errors.
- [ ] Let the room owner configure difficulty and competition options, including whether second- and third-place finishes count.
- [ ] Treat this as an iterative feature: start with a tested, reliable minimum version, then refine the presentation and options.
- [ ] Make room membership, puzzle identity, progress, and timing authoritative on the server; support reconnecting without duplicating a player session.

### General quality and support
- [ ] Fix browser-specific HTML issues.
- [ ] Add understandable, actionable error messages throughout the game, including retry/reload/report options where appropriate.
- [ ] Add `schmollcrossword@gmail.com` to appropriate contact, support, and problem-reporting locations.
- [ ] Investigate the existing persistence architecture before deciding whether a database is necessary. Document which data currently works, where it is stored, and what can be lost on restart/deployment; do not introduce a database solely on assumption.
- [ ] Add a developer dashboard for puzzle-generation, inventory, error, and game-health metrics.
- [ ] Expand Unlimited-mode statistics to help players understand their solving patterns and improve.
- [ ] Investigate optional offline puzzle packs (for example 5, 10, 25, or 50 puzzles per difficulty). Explain storage, freshness, and synchronization trade-offs before implementation.
- [ ] Improve share links so Discord/messages can display a preview image and text without exposing puzzle answers. Test actual crawler-generated previews, not only the in-game share UI.

## Appendix B — Feature Details Retained from Original Notes

### Custom puzzles
- Allow players to create a custom grid and enter their own words and clues, validate it, and share a link. Start with a simple editor; defer collaborative editing until the basic format is reliable.

### Weekly quests
- Examples: complete three Medium puzzles, solve without hints, or finish a Hard puzzle.
- Rewards may include badges, profile decorations, or themes.

### Shareable results
- Provide a compact, answer-safe result suitable for Discord, messages, and social platforms. Example fields: puzzle number, difficulty, solve time, hints used, and solved status.

### Statistics
- Include completion count and rate, average solve time by difficulty, longest streak, personal records, difficult puzzles, hints, and mistakes.

### Gameplay customization
- Support light, dark, and system themes; keyboard controls/shortcuts; sound effects and reduced motion; adjustable text/cell size; and optional timer/mistake counter.

### Puzzle-bank implementation safeguards
- Store the exact validated puzzle, rather than regenerating it from a seed or prompt whenever it is played.
- Keep player assignment/completion history separate from shared puzzle data. Resume unfinished puzzles where possible.
- Use unique constraints/transactions or equivalent protection for concurrent requests; in-process synchronization alone does not protect multiple server instances.
- Import batches safely and resumably; never run a huge generation batch automatically at startup.
- Validate structure, answer lengths, clue numbering, crossings, clue quality, and uniqueness before publishing a puzzle.
- Keep generation jobs bounded and observable with statuses, retries, timeouts, and failure reasons. Prevent duplicate replenishment jobs.
- Track inventory and quality by difficulty, puzzle assignments/completions, reports, generation failures, and API usage/cost where available.
- Do not expose provider credentials or unnecessary answer/user data in production logs.
- Preserve existing player data and daily puzzle identity. A regenerated puzzle must not silently replace a Daily that has already been started.
- Treat the proposed three-month history reset as a gameplay eligibility window, not deletion of permanent completion records, achievements, streaks, or statistics.
- Send a single daily developer summary email with the number of players who triggered generation and a compact health/design report, rather than one email per event.
- If a puzzle needs to be generated, show a branded loading screen with progress and the existing rising-letter visual motif; provide a graceful failure state and retry path.
- Preserve the current Claude API-key approach. Do not migrate to browser AI/WebGPU unless a separate decision is made later.

