# SchmollCrossword — Shared Puzzle Bank Plan

## 1. Goal

Implement a persistent, shared puzzle bank so multiple players can reuse AI-generated crossword puzzles. Avoid generating a new puzzle for every play. Generate additional puzzles only when the available inventory needs replenishment.

This document describes the desired design. Inspect the existing codebase and database before implementing anything. Preserve current gameplay, UI, clue-generation quality, saved progress, achievements, and compatibility unless a change is necessary and approved.

## 2. Core Behavior

When a player requests a puzzle:

1. Determine the requested difficulty and any settings that affect puzzle compatibility.
2. Find an eligible puzzle in the shared bank matching those requirements.
3. Exclude puzzles that the player has already completed. Prefer puzzles they have not previously been assigned, where the current data model supports tracking assignments.
4. Assign and return an eligible puzzle. Multiple players may receive the same puzzle.
5. If no eligible puzzle is available, follow a controlled fallback: queue or request generation, validate the result, save it to the bank, and then assign it. Do not create uncontrolled parallel generation requests when many players request a puzzle at once.
6. If generation fails or is temporarily unavailable, provide a graceful error or reuse another eligible puzzle when appropriate. Never return a malformed or unvalidated puzzle.

Completing a puzzle should update that player's completion history. Completing a puzzle must not remove it from the shared bank or make it unavailable to other players.

## 3. Initial Puzzle Inventory

Initial target: approximately 1,000–3,000 pre-generated puzzles across the supported difficulties.

The developer may generate the initial batch using an existing Claude subscription and code-assisted generation workflow. Treat that initial batch as having no additional API cost only if the subscription actually covers the work and its usage limits are respected. Do not assume this subscription covers runtime API calls made by the deployed application.

Before importing puzzles, validate their structure, answer/clue consistency, grid validity, difficulty, and uniqueness. Reject invalid puzzles and report import counts and failures. Make batch imports resumable and safe to rerun without creating duplicate records.

Do not automatically generate thousands of puzzles or run a large batch as part of routine application startup.

## 4. Puzzle Storage

Inspect the existing persistence layer first and extend it rather than introducing a competing system unnecessarily.

Each bank entry should store the fields needed by the current game, such as:

- Stable puzzle ID
- Difficulty and compatible game settings
- Grid, clues, answers, and any other data required to reproduce the exact puzzle
- Validation status
- Creation time and generation source/model where available
- Optional usage/assignment statistics

Store the exact validated puzzle output. Do not regenerate a stored puzzle from a prompt or seed each time it is played.

Store player-specific history separately from shared puzzle data. Reuse the existing account, anonymous-player identifier, and persistence mechanisms if possible. History should record puzzle assignment and completion as appropriate. Add a unique constraint or equivalent protection against duplicate history records for the same player and puzzle.

If the current persistence system is not durable across deployments or restarts, document the limitation and recommend the smallest suitable change. Do not silently migrate or delete existing user data.

## 5. Assignment and Concurrency

Puzzle selection and assignment must be safe under concurrent requests.

- Avoid assigning a player the same puzzle repeatedly due to simultaneous requests or multiple tabs, when reliable player identity and assignment history are available.
- Use database transactions, unique constraints, or equivalent mechanisms to prevent duplicate records and inconsistent state.
- Allow different players to share the same puzzle.
- Do not hold long-running database transactions open while waiting for an AI generation call.
- Avoid generating multiple copies of the same needed puzzle because of concurrent empty-inventory requests.
- Ensure that retries are idempotent where practical.

If all eligible puzzles of a requested difficulty have been completed by a player, define a graceful fallback. Do not endlessly generate puzzles or return an already completed puzzle without an explicit fallback policy. Consider reusing completed puzzles only after the eligible pool is exhausted, and make the behavior configurable.

## 6. Replenishment Strategy

Use a configurable low-water threshold per difficulty. When eligible inventory falls below its threshold, request replenishment in a controlled way.

Requirements:

- Do not generate a replacement for every puzzle completion.
- Replenish based on available inventory, not raw play count alone.
- Keep generation bounded by configurable batch sizes and retry limits.
- Prevent duplicate jobs and uncontrolled simultaneous generation.
- Validate generated puzzles before publishing them to the bank.
- Track failed jobs and allow safe retries.
- Prefer generating more of the difficulties actually being used.
- Make it possible to disable automatic replenishment during development.

The thresholds and batch sizes should be configuration values, not hard-coded assumptions about future traffic. Do not implement an elaborate queueing platform unless the existing scale requires it; start with the simplest reliable approach.

## 7. AI Generation and Cost Control

The current Claude-based clue-generation implementation is known to produce good results. Preserve it unless inspection demonstrates a concrete reason to change it. Do not replace it with a browser-based WebGPU model as part of this task.

Runtime API calls made by the deployed server may incur separate charges, even if the developer has a Claude subscription. Keep API credentials server-side and use the existing secret/environment-variable configuration.

Record, where practical:

- Number of new puzzles generated per difficulty
- Successful and failed generations
- API calls and token usage when available
- Estimated cost per generated puzzle
- Number of puzzle assignments and completions
- Bank inventory and replenishment events

Use these metrics to calculate new puzzles generated per 1,000 puzzle plays. Do not assume total AI costs will grow logarithmically: sharing reduces repeated generations, but total cost still depends on the number of genuinely new puzzles required.

Do not log API keys, private user data, or unnecessary puzzle answers in production logs.

## 8. Initial Cost Assumptions

The developer's preliminary estimate is approximately $0.01 per easy puzzle generated through the runtime API. This is an estimate, not a guaranteed cost. Medium, hard, and higher-difficulty puzzles may cost more, particularly if they use a more expensive model, additional review calls, or retries.

For reference, at $0.01 per puzzle:

- 1,000 puzzles would cost about $10 in runtime API usage.
- 2,000 puzzles would cost about $20.
- 3,000 puzzles would cost about $30.

These estimates do not apply to initial puzzles generated within an existing subscription if that work is genuinely covered without additional charges. Exclude hosting and domain costs from these AI-only calculations.

## 9. Compatibility and Safety

- Inspect the repository, current branch, schema, puzzle-generation flow, saved progress, achievements, and tests before proposing edits.
- Preserve the existing frontend and puzzle-solving behavior.
- Preserve existing saved user data and completion records.
- Do not expose the Claude API key or call the AI provider directly from browser code.
- Do not change authentication, player identity, or data retention without explaining the consequences.
- Avoid broad rewrites of unrelated frontend files.
- Add or update automated tests for selection, history, difficulty filtering, validation, concurrency, replenishment, and failure handling.
- Do not deploy, push, merge, delete branches, or perform destructive database operations without explicit permission.

## 10. Suggested Implementation Order

1. Inspect and document the existing architecture and identify reusable components.
2. Propose the smallest changes needed; identify schema migrations and risks before applying them.
3. Implement shared puzzle storage and safe initial batch import.
4. Implement eligible puzzle selection and per-player completion tracking.
5. Connect the existing puzzle-request flow to the bank.
6. Add bounded generation and replenishment behavior.
7. Add metrics and tests.
8. Provide a summary of changed files, migrations, test results, configuration, and remaining limitations.

## 11. Acceptance Criteria

- Multiple players can receive the same stored puzzle.
- A player who completed a puzzle is not assigned it again while eligible alternatives exist, except through an explicitly documented fallback.
- Completing a puzzle does not remove it from the shared bank.
- Puzzle requests use the bank before triggering new AI generation.
- Newly generated puzzles are validated and stored before assignment.
- Concurrent requests do not cause uncontrolled duplicate generation or inconsistent assignment history.
- Existing progress and achievements remain intact.
- The system can import a 1,000–3,000 puzzle batch without duplicating records on retry.
- Inventory thresholds, batch sizes, and automatic replenishment can be configured.
- Tests cover normal use, empty inventory, generation failure, duplicate requests, and persistence.
- No deployment or destructive action occurs without explicit approval.

## Instructions for Claude Code

Begin in analysis/planning mode. Inspect the existing codebase and report how the current puzzle generation, persistence, player identity, completion tracking, and puzzle assignment work. Map this plan to the current implementation and identify discrepancies or unresolved decisions. Do not edit files until the proposed implementation steps and risks have been presented for approval.


1. Protect the puzzle bank from bad data

Puzzle validation before publication
Every imported or AI-generated puzzle should pass checks before entering the public bank: valid grid dimensions, correct answer lengths, matching clue numbers, valid crossings, no missing answers, and successful puzzle loading in the existing game.



Report a bad clue
Let players flag a clue that is incorrect, ambiguous, or has an incorrect answer. Track reports, and let an administrator review or temporarily disable problematic puzzles.



Duplicate detection
Prevent exact duplicate puzzles from filling the bank. You could also detect near-duplicates based on grid and answer sets, since two puzzles with different IDs can still be effectively identical.



One subtle issue: a puzzle that is structurally valid isn't necessarily a good puzzle. Keep your existing Claude quality review, and add player reports and quality statistics as a second line of defense.
2. Make puzzle assignment reliable
This is one of the most important backend details.
- Track assignment separately from completion. If a player receives a puzzle but closes the tab, the game shouldn't necessarily give them a different puzzle immediately.
- Prevent race conditions. Two simultaneous requests from the same player shouldn't assign the same puzzle twice or corrupt their history.
- Handle exhausted inventories. If a player has completed every easy puzzle, the game needs a defined fallback instead of endlessly generating more puzzles or repeatedly returning the same one.
- Preserve in-progress puzzles. If a player leaves halfway through, they should be able to continue the same puzzle using your existing save mechanism.
I'd make resuming an unfinished puzzle the default. It avoids wasting assignments and makes the game feel much more polished.

Make it so they reset every 3 months(so puzzles played 3 months ago reset, the player likely forgot them)
When it has to generate new puzzles say generating new puzzles and generate them in batches(like 5 for each level and notify me that a player had to generte puzzles through email)  But send it in a daily email that says blank players had to make new puzzles, in that same email just give some sort of design report of whats going on. If new puzzles have to be generated, make a special screen for it like with the logo, a progress bar, and letters rising in the back like the start up animation screen.

also the send feature, when you send the link to someone and has a picture and text doesnt work