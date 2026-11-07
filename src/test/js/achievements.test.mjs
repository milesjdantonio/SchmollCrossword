// Achievements: each is given once, speed needs no Reveal, and the time achievements follow their rules.
// Run with: node --test src/test/js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const SOURCE = readFileSync(new URL("../../main/resources/static/js/achievements.js", import.meta.url), "utf8");

// achievements.js in a sandbox: U.store is a map standing in for the browser's storage (pass the same map to load
// it again, like a reload)
function load(storage = new Map()) {
    const ctx = {
        U: { store: { get: (k, d) => (storage.has(k) ? JSON.parse(storage.get(k)) : d), set: (k, v) => storage.set(k, JSON.stringify(v)) } },
        Worlds: { list: [{ id: "classic", plain: true }, { id: "paper" }, { id: "garden" }, { id: "rift", secret: true }] },
        SCORING: { timeBonusTop: 90 }
    };
    vm.createContext(ctx);
    vm.runInContext(SOURCE + "\nthis.A = Achievements;", ctx);
    return { A: ctx.A, storage };
}
const daily = (o = {}) => ({ mode: "daily", difficulty: "easy", seconds: 150, checked: 0, revealed: 0, checks: 0, counted: true, points: 150,
    breakdown: { speed: 80 }, left: ["medium", "hard", "challenge", "boss"], streak: 1, day: "20261102", ...o });
const ids = list => list.map(a => a.id);

test("every achievement has its own id, and there are 10 time ones", () => {
    const { A } = load();
    const all = A.LIST.map(a => a.id);
    assert.equal(new Set(all).size, all.length);
    assert.equal(all.filter(id => id.startsWith("t-")).length, 10);
});

test("an achievement is given once", () => {
    const { A } = load();
    assert.ok(ids(A.onWin(daily(), "paper")).includes("first"));
    assert.ok(!ids(A.onWin(daily(), "paper")).includes("first"));
});

test("speed needs a solve without Reveal", () => {
    const { A } = load();
    const got = ids(A.onWin(daily({ seconds: 15, revealed: 4 }), "paper"));
    assert.ok(!got.includes("speed20") && !got.includes("speed30") && !got.includes("speed60"));
    const fair = ids(A.onWin(daily({ seconds: 15 }), "paper"));
    assert.ok(fair.includes("speed20") && fair.includes("speed30") && fair.includes("speed60"));
});

test("Hourglass and Ten Hours add up every solve, and the total survives a reload", () => {
    const first = load();
    assert.ok(!ids(first.A.onWin(daily({ seconds: 1800 }), "paper")).includes("t-hour"));
    const again = load(first.storage);                       // a reload
    assert.ok(ids(again.A.onWin({ mode: "campaign", difficulty: "medium", seconds: 1800 }, "garden")).includes("t-hour"), "campaign time counts too");
    let got = [];
    for (let i = 0; i < 9; i++) got = got.concat(ids(again.A.onWin(daily({ seconds: 3600 }), "paper")));
    assert.ok(got.includes("t-tenhours"));
});

test("Hard Charger and Sprint Summit", () => {
    const { A } = load();
    assert.ok(!ids(A.onWin(daily({ difficulty: "hard", seconds: 119, revealed: 1 }), "paper")).includes("t-hard120"));
    assert.ok(!ids(A.onWin(daily({ difficulty: "hard", seconds: 120 }), "paper")).includes("t-hard120"));
    assert.ok(ids(A.onWin(daily({ difficulty: "hard", seconds: 119 }), "paper")).includes("t-hard120"));
    assert.ok(!ids(A.onWin(daily({ difficulty: "challenge", seconds: 200, breakdown: { speed: 80 } }), "paper")).includes("t-sprint"));
    assert.ok(ids(A.onWin(daily({ difficulty: "challenge", seconds: 100, breakdown: { speed: 90 } }), "paper")).includes("t-sprint"));
});

test("Bonus Collector needs the full time bonus 10 times", () => {
    const { A } = load();
    let got = [];
    for (let i = 0; i < 9; i++) got = got.concat(ids(A.onWin(daily({ breakdown: { speed: 90 } }), "paper")));
    A.onWin(daily({ breakdown: { speed: 80 } }), "paper");
    assert.ok(!got.includes("t-bonus10"));
    assert.ok(ids(A.onWin(daily({ breakdown: { speed: 90 } }), "paper")).includes("t-bonus10"));
});

test("Quick Week needs 7 different days", () => {
    const { A } = load();
    let got = [];
    for (let d = 1; d <= 6; d++) {
        got = got.concat(ids(A.onWin(daily({ seconds: 100, day: "2026110" + d }), "paper")));
        got = got.concat(ids(A.onWin(daily({ seconds: 100, day: "2026110" + d, difficulty: "medium" }), "paper")));   // the same day twice
    }
    assert.ok(!got.includes("t-week"));
    assert.ok(!ids(A.onWin(daily({ seconds: 130, day: "20261107" }), "paper")).includes("t-week"), "2:10 isn't under 2 minutes");
    assert.ok(ids(A.onWin(daily({ seconds: 100, day: "20261108" }), "paper")).includes("t-week"));
});

test("Triple Time, Getting Faster and Just in Time", () => {
    const { A } = load();
    assert.ok(!ids(A.onWin(daily({ trio: 300 }), "paper")).includes("t-trio"));
    assert.ok(ids(A.onWin(daily({ trio: 299 }), "paper")).includes("t-trio"));
    let got = [];
    for (let i = 0; i < 4; i++) got = got.concat(ids(A.onWin(daily({ best: 200 }), "paper")));
    assert.ok(!got.includes("t-best5"));
    assert.ok(ids(A.onWin(daily({ best: 150 }), "paper")).includes("t-best5"));
    assert.ok(ids(A.onWin(daily({ grace: true }), "paper")).includes("t-grace"));
});

test("Weekend Warrior: a Saturday and the Sunday after, in either order", () => {
    const one = load();
    assert.ok(!ids(one.A.onWin(daily({ day: "20261107" }), "paper")).includes("t-weekend"), "Saturday alone");
    assert.ok(!ids(one.A.onWin(daily({ day: "20261109" }), "paper")).includes("t-weekend"), "Monday doesn't count");
    assert.ok(ids(one.A.onWin(daily({ day: "20261108" }), "paper")).includes("t-weekend"), "then Sunday");
    const two = load();
    two.A.onWin(daily({ day: "20261115" }), "paper");
    assert.ok(!ids(two.A.onWin(daily({ day: "20261121" }), "paper")).includes("t-weekend"), "the Saturday after isn't the same weekend");
    assert.ok(ids(two.A.onWin(daily({ day: "20261114" }), "paper")).includes("t-weekend"), "Sunday first, then its Saturday");
});

test("practice and the Daily Boss don't earn the daily time achievements", () => {
    const { A } = load();
    const practice = ids(A.onWin(daily({ counted: false, practice: true, difficulty: "hard", seconds: 50, grace: true, best: 60, trio: 100 }), "paper"));
    for (const id of ["t-hard120", "t-grace", "t-best5", "t-trio", "t-week"]) assert.ok(!practice.includes(id), id);
    const boss = ids(A.onWin({ mode: "campaign", daily: true, counted: true, difficulty: "medium", seconds: 60, points: 300, left: [], streak: 1 }, "paper"));
    assert.ok(!boss.some(id => id.startsWith("t-") && id !== "t-hour" && id !== "t-tenhours"));
});
