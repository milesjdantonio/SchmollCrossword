// Schmoll Crossword: the scoring formula (Step 21). Only DAILY puzzles earn points.
//
// ===== The design (chosen by the project owner) =====
//   points = base points for the difficulty
//          + a speed bonus that starts at 100 and drops 10 for every full minute (never below 0)
//          - penalties for Check / Reveal (Step 22; the numbers there are placeholders until decided)
//   Streaks are shown on screen only: they never add points.

const SCORING = {
    basePoints: { easy: 100, medium: 150, hard: 200 },   // points for solving, by difficulty
    speedBonusStart: 100,     // bonus for solving in under a minute
    speedBonusLossPerMinute: 10,
    checkPenalty: 10,         // points lost per Check used (placeholder until Step 22)
    revealPenalty: 25         // points lost per square Revealed (placeholder until Step 22)
};

// Points for one solved daily puzzle (never below 0)
function calculateScore(difficulty, seconds, checksUsed = 0, revealsUsed = 0) {
    const base = SCORING.basePoints[difficulty] || 0;
    const fullMinutes = Math.floor(seconds / 60);
    const speedBonus = Math.max(0, SCORING.speedBonusStart - fullMinutes * SCORING.speedBonusLossPerMinute);
    const points = base + speedBonus - checksUsed * SCORING.checkPenalty - revealsUsed * SCORING.revealPenalty;
    return Math.max(0, points);
}

// ---------------------------------------------------------------------------------------------
// Streaks (display only). Saved dailies are keyed by seed, e.g. "20261007" = 2026-10-07.
// ---------------------------------------------------------------------------------------------

// Today's daily key in the player's own calendar, e.g. "20261007"
function dayKey(date) {
    return String(date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate());
}

// { current, best }: current = consecutive days up to today (or up to yesterday, if today isn't done yet,
// so a streak doesn't look broken in the morning); best = the longest run ever.
function calculateStreaks(scores, today = new Date()) {
    const done = new Set(Object.keys(scores));

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
