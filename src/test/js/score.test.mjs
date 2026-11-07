// score.js: the points (the same numbers the server works out in LeaderboardControllerTest) and the midnight grace,
// in several time zones. Run with: node --test "src/test/js/**/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const SOURCE = readFileSync(new URL("../../main/resources/static/js/score.js", import.meta.url), "utf8");
function load() {
    const ctx = { Date };
    vm.createContext(ctx);
    vm.runInContext(SOURCE + "\nthis.s = { scoreBreakdown, bossScoreBreakdown, bandFor, timeBonusNow, dailyStanding, calculateStreaks };", ctx);
    return ctx.s;
}
// a size x size puzzle with exactly `squares` white squares
const grid = (size, squares, difficulty) => {
    const rows = [];
    let left = squares;
    for (let r = 0; r < size; r++) { let row = ""; for (let c = 0; c < size; c++) { row += left-- > 0 ? "A" : "."; } rows.push(row); }
    return { size, difficulty, solution: rows };
};

test("points match the server", () => {
    const { scoreBreakdown, bossScoreBreakdown, bandFor } = load();
    assert.deepEqual([bandFor(5), bandFor(7), bandFor(9)], [60, 118, 194]);
    assert.equal(scoreBreakdown(grid(5, 21, "easy"), 59).total, 21 * 5 + 90);
    assert.equal(scoreBreakdown(grid(5, 21, "medium"), 61, 2, 1).total, 21 * 8 + 80 - 2 - 5);
    assert.equal(scoreBreakdown(grid(5, 21, "hard"), 4 * 60 + 59).total, 21 * 10 + 50);
    assert.equal(scoreBreakdown(grid(5, 21, "hard"), 8 * 60 + 59).total, 21 * 10 + 10);
    assert.equal(scoreBreakdown(grid(5, 21, "hard"), 9 * 60).total, 21 * 10);
    assert.equal(scoreBreakdown(grid(7, 40, "challenge"), 117).total, 40 * 8 + 90);
    assert.equal(scoreBreakdown(grid(7, 40, "challenge"), 118).total, 40 * 8 + 80);
    assert.equal(bossScoreBreakdown(grid(5, 21, "medium"), 3).total, 21 * 8 + 150);
    assert.equal(bossScoreBreakdown(grid(5, 21, "medium"), 3, 0, 0, 2).total, 21 * 8 + 150 - 100);
    assert.equal(scoreBreakdown(grid(5, 21, "easy"), 5000, 100, 100).total, 0);
});

test("the timer's bonus and the time left before it drops", () => {
    const { timeBonusNow } = load();
    assert.deepEqual({ ...timeBonusNow(5, 0) }, { bonus: 90, left: 60 });
    assert.deepEqual({ ...timeBonusNow(5, 75) }, { bonus: 80, left: 45 });
    assert.deepEqual({ ...timeBonusNow(5, 600) }, { bonus: 0, left: null });
});

test("a daily counts for 15 minutes after midnight, in any time zone and across clock changes", () => {
    for (const zone of ["America/New_York", "Europe/London", "Australia/Sydney", "Pacific/Kiritimati", "America/Santiago"]) {
        process["env"]["TZ"] = zone;
        const { dailyStanding } = load();
        const at = (y, m, d, h, min) => new Date(y, m - 1, d, h, min);
        const cases = [
            ["20261107", at(2026, 11, 7, 23, 59), "today"], ["20261107", at(2026, 11, 8, 0, 0), "grace"],
            ["20261107", at(2026, 11, 8, 0, 14), "grace"], ["20261107", at(2026, 11, 8, 0, 15), "past"],
            ["20261031", at(2026, 11, 1, 0, 10), "grace"], ["20260307", at(2026, 3, 8, 0, 10), "grace"],
            ["20261003", at(2026, 10, 4, 0, 10), "grace"], ["20260404", at(2026, 4, 5, 0, 10), "grace"],
            ["20261231", at(2027, 1, 1, 0, 5), "grace"], ["20261106", at(2026, 11, 8, 0, 5), "past"]
        ];
        for (const [day, now, want] of cases) assert.equal(dailyStanding(day, now), want, `${zone}: ${day} at ${now}`);
    }
});

test("streaks: a surrendered daily doesn't count, and today not done yet doesn't break it", () => {
    const { calculateStreaks } = load();
    const scores = { "20261105-easy": {}, "20261106-hard": {}, "20261107-easy": { surrendered: true } };
    assert.equal(calculateStreaks(scores, new Date(2026, 10, 7, 12)).current, 2);
    assert.equal(calculateStreaks({ ...scores, "20261107-medium": {} }, new Date(2026, 10, 7, 12)).current, 3);
});
