// Schmoll Crossword: the scoring formula. Only DAILY puzzles earn points.
//
// ===== The rules =====
//   points = the puzzle's white squares x points a square (Easy 5, Medium 8, Hard 10, Challenge 8)
//          + a time bonus: +90 inside the first time band, 10 less for each band after that, 0 from the 10th band on.
//            A band is a minute on a 5x5 grid, and longer on a bigger grid in proportion to its area
//            (a 7x7 band is 1:58, a 9x9 band 3:14), so a bigger puzzle has as fair a chance at the bonus.
//          - 1 for every square CHECKED (Check square = 1 square, Check word = its length, Check puzzle = all squares)
//          - 5 for every square REVEALED (only squares that were empty or wrong; a right letter is locked for free)
//   Revealing the whole puzzle is a surrender: 0 points, and it doesn't count toward the streak.
//   The Daily Boss (the 5th daily, a race, so no clock): 8 a square + 50 for each star (how close the boss got),
//   the same Check and Reveal penalties, and -50 for every attempt lost before the win.
//   Never below 0. Streaks are shown on screen only: they never add points.
//   The server works the same numbers out again (LeaderboardController.points): change both together.

const SCORING = {
    perSquare: { easy: 5, medium: 8, hard: 10, challenge: 8, boss: 8 },
    timeBonusTop: 90,             // inside the first band
    timeBonusStep: 10,            // less for each band after
    bandSeconds: 60,              // a band on a 5x5 grid...
    bandBaseArea: 25,             // ...grows with the grid's area
    checkPenaltyPerSquare: 1,     // per square looked at by Check
    revealPenaltyPerSquare: 5,    // per square filled in by Reveal
    bossPerStar: 50,              // the Daily Boss: each star (1 to 3)
    bossPerLostTry: 50            // ...minus this for every attempt lost before the win
};

// A puzzle's white squares (black squares are "." in its solution)
function squaresOf(puzzle) {
    return puzzle.solution.reduce((n, row) => n + [...row].filter(ch => ch !== ".").length, 0);
}
// How long one time band is on a grid of this size, in whole seconds
function bandFor(size) {
    return Math.round(SCORING.bandSeconds * (size * size) / SCORING.bandBaseArea);
}
// The time bonus after `seconds` on a grid of this size
function timeBonusFor(size, seconds) {
    return Math.max(0, SCORING.timeBonusTop - Math.floor(seconds / bandFor(size)) * SCORING.timeBonusStep);
}
// The bonus now and how many seconds are left before it drops (for the timer); left = null once it's 0
function timeBonusNow(size, seconds) {
    const bonus = timeBonusFor(size, seconds), band = bandFor(size);
    return { bonus, left: bonus > 0 ? band - (seconds % band) : null };
}

// One solved daily puzzle's score, split into its parts for the results screen's tally
function scoreBreakdown(puzzle, seconds, squaresChecked = 0, squaresRevealed = 0) {
    const squares = squaresOf(puzzle);
    const base = squares * (SCORING.perSquare[puzzle.difficulty] || 0);
    const speed = timeBonusFor(puzzle.size, seconds);
    const check = squaresChecked * SCORING.checkPenaltyPerSquare;
    const reveal = squaresRevealed * SCORING.revealPenaltyPerSquare;
    return { squares, base, speed, check, reveal, total: Math.max(0, base + speed - check - reveal) };
}

// The Daily Boss's score: stars instead of a time bonus (it's a race against the boss, not the clock)
function bossScoreBreakdown(puzzle, stars, squaresChecked = 0, squaresRevealed = 0, lostTries = 0) {
    const squares = squaresOf(puzzle);
    const base = squares * SCORING.perSquare.boss, starBonus = SCORING.bossPerStar * stars;
    const check = squaresChecked * SCORING.checkPenaltyPerSquare, reveal = squaresRevealed * SCORING.revealPenaltyPerSquare;
    const tries = lostTries * SCORING.bossPerLostTry;
    return { boss: true, squares, stars, lostTries, base, speed: starBonus, check, reveal, tries, total: Math.max(0, base + starBonus - check - reveal - tries) };
}

// ---------------------------------------------------------------------------------------------
// Streaks (display only). Saved dailies are keyed by day + difficulty, e.g. "20261007-easy".
// Solving ANY of the day's dailies (the three normal ones, the Challenge or the Daily Boss) keeps the streak alive.
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

// Where a daily from `day` ("20261007") stands now: "today"; "grace" in the first 15 minutes after midnight (a
// puzzle started before midnight still counts for its own day); "past" after that (practice: no points or streak).
const GRACE_MINUTES = 15;
function dailyStanding(day, now = new Date()) {
    if (day === dayKey(now)) return "today";
    if (day === dayKey(new Date(now.getTime() - GRACE_MINUTES * 60000))) return "grace";
    return "past";
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
