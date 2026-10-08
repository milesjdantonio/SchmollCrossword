// Schmoll Crossword: the scoring formula (Step 21). Only DAILY puzzles earn points.
//
// ===== The design (chosen by the project owner) =====
//   points = base points for the difficulty
//          + a speed bonus that starts at 100 and drops 10 for every full minute (never below 0)
//            (Challenge mode, the bigger 7x7 daily: base 300 and a speed bonus that starts at 200)
//          - 5 for every square CHECKED (Check square = 1 square, Check word = its length, Check puzzle = all squares)
//          - 10 for every square REVEALED (only squares that were empty or wrong count)
//   Revealing the whole puzzle is a surrender: 0 points, and it doesn't count toward the streak.
//   Streaks are shown on screen only: they never add points.

const SCORING = {
    basePoints: { easy: 100, medium: 150, hard: 200, challenge: 300 },   // points for solving, by difficulty
    speedBonusStart: 100,     // bonus for solving in under a minute
    challengeSpeedBonusStart: 200,   // Challenge mode: the bigger grid gets a bigger speed bonus
    speedBonusLossPerMinute: 10,
    checkPenaltyPerSquare: 5,     // per square looked at by Check
    revealPenaltyPerSquare: 10    // per square filled in by Reveal
};

// Points for one solved daily puzzle (never below 0)
function speedBonusFor(difficulty, seconds) {
    const start = difficulty === "challenge" ? SCORING.challengeSpeedBonusStart : SCORING.speedBonusStart;
    return Math.max(0, start - Math.floor(seconds / 60) * SCORING.speedBonusLossPerMinute);
}
function calculateScore(difficulty, seconds, squaresChecked = 0, squaresRevealed = 0) {
    const base = SCORING.basePoints[difficulty] || 0;
    const speedBonus = speedBonusFor(difficulty, seconds);
    const points = base + speedBonus
        - squaresChecked * SCORING.checkPenaltyPerSquare
        - squaresRevealed * SCORING.revealPenaltyPerSquare;
    return Math.max(0, points);
}

// The same score, split into its parts, for the results screen's tally
function scoreBreakdown(difficulty, seconds, squaresChecked = 0, squaresRevealed = 0) {
    const base = SCORING.basePoints[difficulty] || 0;
    const speed = speedBonusFor(difficulty, seconds);
    const check = squaresChecked * SCORING.checkPenaltyPerSquare;
    const reveal = squaresRevealed * SCORING.revealPenaltyPerSquare;
    return { base, speed, check, reveal, total: Math.max(0, base + speed - check - reveal) };
}

// ---------------------------------------------------------------------------------------------
// Streaks (display only). Saved dailies are keyed by day + difficulty, e.g. "20261007-easy".
// Solving ANY of the day's dailies (the three normal ones or the Challenge) keeps the streak alive.
// ---------------------------------------------------------------------------------------------

// The day a daily's seed belongs to: 202610071 (easy daily, design pass) -> "20261007"; old seeds 20261007 too
function seedDay(seed) {
    return String(seed).slice(0, 8);
}

// The score key for a daily puzzle: "20261007-easy"
function scoreKey(puzzle) {
    return seedDay(puzzle.seed) + "-" + puzzle.difficulty;
}

// Has at least one of today's dailies been solved (not surrendered)?
function todayIsDone(scores, today = new Date()) {
    const day = dayKey(today);
    return Object.keys(scores).some(key => key.slice(0, 8) === day && !scores[key].surrendered);
}

// Today's daily key in the player's own calendar, e.g. "20261007"
function dayKey(date) {
    return String(date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate());
}

// { current, best }: current = consecutive days up to today (or up to yesterday, if today isn't done yet,
// so a streak doesn't look broken in the morning); best = the longest run ever.
function calculateStreaks(scores, today = new Date()) {
    // A surrendered daily (whole puzzle revealed) doesn't count as done for the streak
    // A day counts once, whichever difficulties were solved ("20261007-easy" -> "20261007")
    const done = new Set(Object.keys(scores).filter(key => !scores[key].surrendered).map(key => key.slice(0, 8)));

    let current = 0;
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (!done.has(dayKey(day))) day.setDate(day.getDate() - 1);     // today not done yet: start from yesterday
    while (done.has(dayKey(day))) {
        current++;
        day.setDate(day.getDate() - 1);
    }

    let best = 0;
    let run = 0;
    let previous = null;
    for (const key of [...done].sort()) {
        const date = new Date(Number(key.slice(0, 4)), Number(key.slice(4, 6)) - 1, Number(key.slice(6, 8)));
        const nextAfterPrevious = previous && new Date(previous.getFullYear(), previous.getMonth(), previous.getDate() + 1);
        run = nextAfterPrevious && dayKey(nextAfterPrevious) === key ? run + 1 : 1;
        best = Math.max(best, run);
        previous = date;
    }
    return { current, best: Math.max(best, current) };
}
