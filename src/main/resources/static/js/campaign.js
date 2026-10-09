// Campaign mode (built by Claude at the user's request): a map of the worlds, travelled from easy to hard. Each world
// has 5 levels; level 5 is a boss battle.
//
//   #campaign   the map: its own full page that scrolls down through every world (an Exit button goes home).
//               The page's background world changes as you scroll into the next world.
//   #level      playing a level, on the normal game screen, dressed as that level's world
//
// The order of the worlds and each level's difficulty come from the server (GET /api/campaign/map, Campaign.java);
// each level is one fixed puzzle, the same for everyone (GET /api/campaign?world=garden&level=3).
//
// Stars: a normal level gives 3, minus one for using Reveal and one for going over the par time (never below 1).
// A boss fight is a race against a bot: stars for how far ahead you finished. Each world has three abilities
// for boss fights, unlocked by clearing its level 1, its level 3 and its boss (each unlock comes with 2 free uses).
// Coins from clearing levels buy more uses and items (reveals, clears, time stops...) in the shop.
// Saved in this browser as schmoll.campaign:
//   { levels: { "garden-3": { stars: 2, seconds: 95 } }, section, sel, playing: { world, level }, coins, owned, items, loadout, v }

const Campaign = (() => {
    const $ = U.$;
    const root = document.documentElement;

    // TEMPORARY testing switch (the user asked, 2026-10-08): every level and every ability is open, and a test save
    // gets coins, uses and items once. Set it to false before deploying.
    const TEST_UNLOCK_ALL = true;

    const W = 1000, SH = 1000, TOP = 170, BOTTOM = 240;     // map units: the map's width, one world's height, margins
    // Par times (seconds) for the "quick" star, for a 5x5 board; bigger boards get more time, by their area
    // ("challenge" = a Challenge grid with medium clues, "expert" = hard words and clues; see Campaign.java)
    const PAR_BASE = { easy: 120, medium: 180, hard: 240, challenge: 220, expert: 270 };
    const par = (d, size = 5) => Math.round((PAR_BASE[d] || 180) * Math.max(1, (size * size) / 25) / 10) * 10;
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
    // "Easy", "Challenge 6×6", "Expert 9×9"
    const label = (d, size = 5) => cap(d) + (d === "challenge" || d === "expert" ? ` ${size}×${size}` : "");

    // ---------------------------------------------------------------------------------------------
    // Saved progress and the map from the server
    // ---------------------------------------------------------------------------------------------
    let data = { levels: {}, section: 0, sel: 1, playing: null, ...U.store.get("campaign", {}) };
    const save = () => U.store.set("campaign", data);
    const keyOf = (world, level) => world + "-" + level;
    data.coins = data.coins || 0;
    data.owned = data.owned || {};
    data.items = data.items || {};

    let map = null, loading = null;
    function fetchMap() {
        if (map) return Promise.resolve(map);
        if (!loading) {
            loading = fetch("/api/campaign/map")
                .then(r => { if (!r.ok) throw new Error("the server answered " + r.status); return r.json(); })
                .then(list => { map = list.filter(s => Worlds.byId[s.world]); migrate(); return map; })
                .catch(err => { loading = null; throw err; });
        }
        return loading;
    }

    const sizeOf = (s, level) => (s.sizes ? s.sizes[level - 1] : 5);
    const phase2Of = s => (s && s.phase2 ? s.phase2 : ["challenge", 6]);          // a boss's second puzzle: [difficulty, size]
    // every puzzle after a boss's first: [[difficulty, size], ...] (2 phases for most bosses, 3 for the last three, 5 for the Void)
    const laterPhases = s => (s && s.phases ? s.phases : [phase2Of(s)]);
    // Rerolls (the user's rule): losing or giving up means your next try is a new puzzle with new clues (Campaign.VARIANTS)
    const tryOf = (world, level) => ((data.tries || {})[keyOf(world, level)] || 0);
    function reroll(world, level) {
        data.tries = data.tries || {};
        data.tries[keyOf(world, level)] = tryOf(world, level) + 1;
        save();
    }
    // Lessons (the user's goal: keep improving the player, making them practise something different each level
    // until they're a pro). Every level teaches one skill (Lesson.java on the server): its clues train it, and its
    // third star is a goal that fits it.
    const lessonOf = (si, level) => (map && map[si] && map[si].lessons ? map[si].lessons[level - 1] : null);
    // the third star's goal: [text, check(game, puzzle)]
    function starGoal(lesson, d, size) {
        const p = par(d, size), t = k => Math.round(p * k / 5) * 5;
        switch (lesson && lesson.star) {
            case "brisk": return [`Finish under ${U.fmtTime(t(0.75))}`, g => g.seconds <= t(0.75)];
            case "fast": return [`Finish under ${U.fmtTime(t(0.6))} (speed!)`, g => g.seconds <= t(0.6)];
            case "nocheck": return ["Don't use Check", g => !g.checks];
            case "clean": return ["No Check at all (a clean solve)", g => !g.checks && !g.squaresChecked];
            default: return [`Finish under ${U.fmtTime(p)}`, g => g.seconds <= p];
        }
    }
    const record = (si, level) => data.levels[keyOf(map[si].world, level)];
    const cleared = (si, level) => !!(map && map[si] && record(si, level));
    function unlocked(si, level) {
        if (TEST_UNLOCK_ALL) return true;
        if (si === 0 && level === 1) return true;
        if (level > 1) return cleared(si, level - 1);
        return si > 0 && cleared(si - 1, 5);
    }
    const sectionOpen = si => unlocked(si, 1);
    // where the player is: the first level not cleared yet
    function frontier() {
        for (let si = 0; si < map.length; si++) for (let l = 1; l <= 5; l++) if (!cleared(si, l)) return { si, level: l };
        return { si: map.length - 1, level: 5 };
    }
    function totals() {
        let levels = 0, stars = 0;
        for (const r of Object.values(data.levels)) { levels++; stars += r.stars || 0; }
        return { levels, stars, max: (map ? map.length : 15) * 5 };
    }

    // ---------------------------------------------------------------------------------------------
    // The look of each world's part of the map
    // ---------------------------------------------------------------------------------------------
    const BIOMES = {
        paper:    { sky: "#fbf3df", hill: "#e8dcc0", ground: "#fffaf0", path: "#2f6fd6", node: "#e2483c", prop: "doodle" },
        garden:   { sky: "#bfe6ff", hill: "#78c267", ground: "#9bd67f", path: "#e0bb83", node: "#ff5f98", prop: "flower" },
        squirrel: { sky: "#ffd9a8", hill: "#c26b33", ground: "#d99a55", path: "#f6e3bd", node: "#b5521f", prop: "oak" },
        candy:    { sky: "#ffd6ef", hill: "#ff9ccf", ground: "#ffc4e3", path: "#ffffff", node: "#ff3f9a", prop: "lolly" },
        ocean:    { sky: "#8fe0f5", hill: "#2f9fc7", ground: "#47b4d4", path: "#ffe7a8", node: "#ff7a59", prop: "coral" },
        snow:     { sky: "#d7e7fb", hill: "#b4cdea", ground: "#f2f7ff", path: "#8fb3dc", node: "#3f7fd8", prop: "pine" },
        rain:     { sky: "#97a6b8", hill: "#6d7d91", ground: "#8493a5", path: "#ffd34d", node: "#ffc93a", prop: "umbrella" },
        sky:      { sky: "#a6dbff", hill: "#f4fbff", ground: "#e3f4ff", path: "#ffb04d", node: "#ff7a59", prop: "cloud" },
        desert:   { sky: "#ffd79c", hill: "#df9f55", ground: "#efc27e", path: "#9c5b2e", node: "#2f8f9d", prop: "cactus" },
        carnival: { sky: "#ffe4a3", hill: "#6fbd5c", ground: "#8fd07a", path: "#fff1d0", node: "#e2483c", prop: "tent" },
        arcade:   { sky: "#1a0638", hill: "#3a0d6b", ground: "#220a48", path: "#2bf0ff", node: "#ff2bd6", prop: "pixel", night: true },
        robot:    { sky: "#55606f", hill: "#3f4855", ground: "#6a7583", path: "#ffc43d", node: "#ff7a1a", prop: "gear", night: true },
        library:  { sky: "#2b1a35", hill: "#3d2546", ground: "#5a3a28", path: "#e8c37a", node: "#7fe0c4", prop: "books", night: true },
        volcano:  { sky: "#5a2320", hill: "#2e1c1c", ground: "#3d2a26", path: "#ff8a2a", node: "#ffcf3f", prop: "cone", night: true },
        space:    { sky: "#070a1f", hill: "#151b40", ground: "#0e1230", path: "#b18cff", node: "#ffe066", prop: "planet", night: true }
    };
    const biome = world => BIOMES[world] || BIOMES.paper;
    const INK = "#2b2233";
    const bossOf = world => Bosses.info(world);
    const bossSvg = (world, cls = "") => Bosses.svg(world, cls);

    // little pictures for each world's scenery, standing on 0,0
    const pick3 = (r, list) => list[Math.floor(r() * list.length)];
    function flower(r) {
        const c = pick3(r, ["#ff6fa0", "#ffd23f", "#ffffff", "#b98cff"]);
        return `<path d="M0 0v-26" stroke="#3f8a34" stroke-width="3"/>` + [0, 72, 144, 216, 288].map(a => `<circle cx="${(Math.cos(a * Math.PI / 180) * 7).toFixed(1)}" cy="${(-30 + Math.sin(a * Math.PI / 180) * 7).toFixed(1)}" r="6" fill="${c}"/>`).join("") + `<circle cy="-30" r="4.5" fill="#ffb21e"/>`;
    }
    function starPath(cx, cy, r1, r2, n) {
        let d = "";
        for (let i = 0; i < n * 2; i++) {
            const a = -Math.PI / 2 + (i * Math.PI) / n, rr = i % 2 ? r2 : r1;
            d += (i ? "L" : "M") + (cx + Math.cos(a) * rr).toFixed(1) + " " + (cy + Math.sin(a) * rr).toFixed(1);
        }
        return d + "z";
    }
    const PROPS = {
        doodle: r => pick3(r, [
            `<g transform="rotate(${(r() * 50 - 25).toFixed(0)})"><rect x="-5" y="-62" width="10" height="46" fill="#ffd23f" stroke="${INK}" stroke-width="1.5"/><path d="M-5-16L0 0 5-16z" fill="#f2d2a2" stroke="${INK}" stroke-width="1.5"/><rect x="-5" y="-69" width="10" height="7" fill="#ff8fa3" stroke="${INK}" stroke-width="1.5"/></g>`,
            `<path d="${starPath(0, -22, 18, 8, 5)}" fill="none" stroke="#e2483c" stroke-width="2.5" stroke-linejoin="round"/>`,
            `<circle cy="-12" r="12" fill="#fff" stroke="#9aa3b5" stroke-width="1.5"/><path d="M-7-16l6 4 5-7M-4-6l8-3" stroke="#9aa3b5" stroke-width="1.2" fill="none"/>`]),
        flower: r => r() < 0.6 ? flower(r) : `<g fill="#5fae4c"><circle cx="-12" cy="-12" r="13"/><circle cx="10" cy="-14" r="15"/><circle cy="-24" r="13"/></g><circle cx="4" cy="-20" r="3" fill="#ff5f98"/>`,
        oak: r => r() < 0.75
            ? `<rect x="-5" y="-34" width="10" height="34" rx="3" fill="#7a4a2a"/><g fill="${pick3(r, ["#e8792b", "#d9542a", "#f2a93b"])}"><circle cx="-15" cy="-44" r="18"/><circle cx="13" cy="-46" r="18"/><circle cy="-62" r="20"/></g>`
            : `<ellipse cy="-9" rx="8" ry="10" fill="#b9773e"/><path d="M-10-14a10 7 0 0 1 20 0z" fill="#6e4429"/><path d="M0-21v-4" stroke="#6e4429" stroke-width="2"/>`,
        lolly: r => r() < 0.55
            ? `<rect x="-2" y="-46" width="4" height="46" fill="#fff" stroke="#e7c9d8"/><circle cy="-56" r="16" fill="${pick3(r, ["#ff6fb4", "#7ad7ff", "#ffd23f"])}"/><path d="M0-56m-10 0a10 10 0 1 0 10-10" stroke="#fff" stroke-width="4" fill="none"/>`
            : `<path d="M0 0V-44a10 10 0 0 1 20 0" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M0 0V-44a10 10 0 0 1 20 0" stroke="#ff4b6e" stroke-width="8" fill="none" stroke-dasharray="7 7" stroke-linecap="butt"/>`,
        coral: r => r() < 0.6
            ? `<path d="M0 0V-30M0-16L-13-34M0-22L12-42M12-42v-8M-13-34l-4-8" stroke="${pick3(r, ["#ff7a8a", "#ff9f45", "#c86bff"])}" stroke-width="6" stroke-linecap="round" fill="none"/>`
            : `<path d="M0 0c-8-12 8-22 0-34s8-20 2-28" stroke="#2f9e6b" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="10" cy="-40" r="3" fill="none" stroke="#fff" opacity=".7"/><circle cx="14" cy="-52" r="2" fill="none" stroke="#fff" opacity=".7"/>`,
        pine: r => r() < 0.8
            ? `<rect x="-4" y="-14" width="8" height="14" fill="#6b4a3a"/><path d="M0-72L-19-38H19zM0-54L-25-14H25z" fill="#2f6f5a"/><path d="M0-72l-8 14h16zM0-54l-9 14h18z" fill="#fff"/>`
            : `<circle cy="-12" r="13" fill="#fff" stroke="#c6d6ea" stroke-width="2"/><circle cy="-33" r="10" fill="#fff" stroke="#c6d6ea" stroke-width="2"/><path d="M0-32l7 2-7 2z" fill="#ff9f2e"/><circle cx="-3" cy="-36" r="1.5" fill="${INK}"/><circle cx="3" cy="-36" r="1.5" fill="${INK}"/>`,
        umbrella: r => r() < 0.5
            ? `<rect x="-3" y="-70" width="6" height="70" fill="#3b4250"/><circle cy="-74" r="9" fill="#ffe28a"/><circle cy="-74" r="20" fill="#ffe28a" opacity=".25"/>`
            : `<path d="M0 0v-40" stroke="${INK}" stroke-width="2.5"/><path d="M-24-40a24 18 0 0 1 48 0z" fill="${pick3(r, ["#ffc93a", "#ff5c6c", "#4fa3e8"])}"/><ellipse cx="0" cy="2" rx="20" ry="4" fill="#5b6a7c" opacity=".6"/>`,
        cloud: r => r() < 0.6
            ? `<g fill="#fff"><circle cx="-16" cy="-10" r="13"/><circle cx="2" cy="-18" r="17"/><circle cx="20" cy="-9" r="12"/><rect x="-28" y="-12" width="58" height="12" rx="6"/></g>`
            : `<ellipse cy="-58" rx="16" ry="19" fill="${pick3(r, ["#ff5c6c", "#ffc93a", "#7a5cff"])}"/><path d="M-10-44l6 16M10-44l-6 16" stroke="#7a4a2a" stroke-width="1.5"/><rect x="-6" y="-28" width="12" height="9" rx="2" fill="#9c6a3c"/>`,
        cactus: r => r() < 0.7
            ? `<path d="M0 0v-56M0-30h-14v-14M0-38h12v-14" stroke="#4f9a4a" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
            : `<path d="M-36 0L0-42 36 0z" fill="#d9a35a"/><path d="M0-42L36 0H10z" fill="#b9823f"/>`,
        tent: r => r() < 0.65
            ? `<path d="M-28 0L0-46 28 0z" fill="#fff"/><path d="M0-46L-16 0h10L0-46 6 0h10z" fill="#e2483c"/><path d="M0-46v-12" stroke="${INK}" stroke-width="2"/><path d="M0-58l12 4-12 4z" fill="#ffd23f"/>`
            : `<path d="M0 0v-36" stroke="#9aa3b5" stroke-width="1.5"/><ellipse cy="-46" rx="10" ry="12" fill="${pick3(r, ["#ff5c6c", "#4fa3e8", "#ffd23f"])}"/>`,
        pixel: r => r() < 0.5
            ? `<g fill="none" stroke="${pick3(r, ["#2bf0ff", "#ff2bd6", "#ffe066"])}" stroke-width="3"><rect x="-16" y="-32" width="32" height="32"/><rect x="-8" y="-52" width="16" height="16"/></g>`
            : `<g fill="#7dff6b"><rect x="-12" y="-24" width="24" height="12"/><rect x="-16" y="-20" width="4" height="12"/><rect x="12" y="-20" width="4" height="12"/><rect x="-8" y="-30" width="4" height="6"/><rect x="4" y="-30" width="4" height="6"/><rect x="-10" y="-12" width="6" height="6"/><rect x="4" y="-12" width="6" height="6"/></g><g fill="#220a48"><rect x="-6" y="-21" width="4" height="4"/><rect x="2" y="-21" width="4" height="4"/></g>`,
        gear: r => r() < 0.6
            ? `<g transform="translate(0 -22)"><circle r="17" fill="none" stroke="#a7b2c0" stroke-width="9" stroke-dasharray="6.5 5"/><circle r="13" fill="#a7b2c0"/><circle r="5" fill="#3f4855"/></g>`
            : `<path d="M-30 0v-26h26v-18" stroke="#b07a3a" stroke-width="9" fill="none" stroke-linejoin="round"/><circle cx="-4" cy="-44" r="6" fill="#d9a05a"/>`,
        books: r => r() < 0.65
            ? [0, 1, 2, 3].slice(0, 2 + Math.floor(r() * 3)).map(i => `<rect x="${-18 + (r() - 0.5) * 6}" y="${-12 * (i + 1)}" width="36" height="11" rx="2" fill="${pick3(r, ["#b8483a", "#3f6fb3", "#4f9a5a", "#c9902f", "#7a4fa3"])}"/>`).join("")
            : `<rect x="-5" y="-26" width="10" height="26" fill="#f4ead2"/><ellipse cy="-32" rx="4" ry="7" fill="#ffcf3f"/><circle cy="-30" r="14" fill="#ffcf3f" opacity=".2"/>`,
        cone: r => r() < 0.55
            ? `<path d="M-34 0L-10-40h20L34 0z" fill="#4a2f2a"/><path d="M-10-40h20l-4 8h-12z" fill="#ff8a2a"/><circle cx="4" cy="-52" r="8" fill="#6d5a58" opacity=".7"/><circle cx="-4" cy="-64" r="10" fill="#6d5a58" opacity=".5"/>`
            : `<path d="M-16 0l4-16 12-6 14 8 2 14z" fill="#2a1d1b"/><ellipse cx="20" cy="2" rx="14" ry="4" fill="#ff7a1f" opacity=".85"/>`,
        planet: r => r() < 0.5
            ? `<circle cy="-30" r="16" fill="${pick3(r, ["#ff9f6b", "#6bd0ff", "#b18cff"])}"/><ellipse cy="-30" rx="28" ry="6" fill="none" stroke="#ffe066" stroke-width="2.5" transform="rotate(-15 0 -30)"/>`
            : `<path d="${starPath(0, -20, 9, 3, 4)}" fill="#fff"/>`
    };

    // ---------------------------------------------------------------------------------------------
    // The map: one tall SVG, a band per world from the top down, the path winding through all 75 levels
    // ---------------------------------------------------------------------------------------------
    const mapEl = $("#cm-map");
    let svg = null, dyn = null;
    const LT = [[290, 260], [700, 420], [320, 590], [690, 745], [500, 905]];      // the 5 levels inside a world's band
    function nodePos(si, li) {
        const r = U.rng(si * 31 + li * 7 + 5);
        let [x, y] = LT[li];
        if (si % 2) x = W - x;                     // every other world winds the other way
        return [x + (r() - 0.5) * 60, TOP + si * SH + y + (r() - 0.5) * 30];
    }
    const allNodes = () => [[500, 50], ...map.flatMap((s, si) => [0, 1, 2, 3, 4].map(li => nodePos(si, li)))];
    const totalH = () => TOP + map.length * SH + BOTTOM;

    // a smooth curve through the points (Catmull-Rom), from point "from" to point "to"
    function curve(pts, from = 0, to = pts.length - 1) {
        const f = v => v.toFixed(1);
        let d = `M${f(pts[from][0])} ${f(pts[from][1])}`;
        for (let i = from; i < to; i++) {
            const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
            d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
        }
        return d;
    }
    // a vertical gradient that holds each world's colour in the middle of its band and blends at the borders
    function blend(id, field) {
        const total = totalH();
        const st = map.flatMap((s, si) => [TOP + si * SH + 200, TOP + si * SH + 800].map(y => `<stop offset="${(y / total).toFixed(5)}" stop-color="${biome(s.world)[field]}"/>`));
        return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${total}">${st.join("")}</linearGradient>`;
    }
    // a wavy strip down one side of the map (hills along the edges)
    function sideWave(left, depth, seed) {
        const r = U.rng(seed), total = totalH();
        const edge = left ? -60 : W + 60;
        let d = `M${edge} -60`;
        for (let y = -60; y <= total + 60; y += 90) {
            const x = (left ? 0 : W) + (left ? 1 : -1) * (depth + Math.sin(y / 230 + seed) * depth * 0.45 + (r() - 0.5) * depth * 0.4);
            d += `L${x.toFixed(0)} ${y}`;
        }
        return d + `L${edge} ${total + 60}Z`;
    }

    function buildStatic() {
        const total = totalH(), nodes = allNodes();
        const segs = [];
        for (let i = 0; i < nodes.length - 1; i++) segs.push([nodes[i], nodes[i + 1]]);
        const nearPath = (x, y) => segs.some(([a, b]) => {
            if (Math.abs(y - a[1]) > 260 && Math.abs(y - b[1]) > 260) return false;
            const dx = b[0] - a[0], dy = b[1] - a[1], t = U.clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy), 0, 1);
            return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t) < 88;
        });
        let props = "", sky = "", texture = "", signs = "";
        map.forEach((s, si) => {
            const b = biome(s.world), r = U.rng(si * 131 + 17), y0 = TOP + si * SH, list = [];
            // scenery, away from the path and the world's sign
            for (let tries = 0; list.length < 26 && tries < 400; tries++) {
                const x = 30 + r() * (W - 60), y = y0 + 150 + r() * (SH - 120);
                if (Math.abs(x - 500) < 270 && y < y0 + 170) continue;
                if (nearPath(x, y - 14) || list.some(p => Math.hypot(p.x - x, p.y - y) < 70)) continue;
                list.push({ x, y, k: 0.95 + r() * 0.6 });
            }
            list.sort((a, c) => a.y - c.y);
            for (const p of list) props += `<g transform="translate(${p.x.toFixed(0)} ${p.y.toFixed(0)}) scale(${p.k.toFixed(2)})"><ellipse rx="22" ry="5" fill="#000" opacity=".12"/>${PROPS[b.prop](r)}</g>`;
            // the sky's bits, seen from above: stars at night, drifting cloud shadows by day
            if (b.night) {
                for (let i = 0; i < 40; i++) sky += `<circle cx="${(r() * W).toFixed(0)}" cy="${(y0 + r() * SH).toFixed(0)}" r="${(0.8 + r() * 2).toFixed(1)}" fill="#fff" opacity="${(0.3 + r() * 0.6).toFixed(2)}"/>`;
            } else {
                for (let i = 0; i < 3; i++) { const cx = 80 + r() * (W - 160), cy = y0 + 120 + r() * (SH - 200); sky += `<g transform="translate(${cx.toFixed(0)} ${cy.toFixed(0)})" fill="#fff" opacity=".35"><ellipse rx="70" ry="22"/><circle cx="-20" cy="-14" r="26"/><circle cx="22" cy="-10" r="20"/></g>`; }
            }
            if (s.world === "volcano") sky += `<path d="M${W - 280} ${y0 + 520}L${W - 170} ${y0 + 360}h50L${W - 10} ${y0 + 520}z" fill="#24130f"/><path d="M${W - 170} ${y0 + 360}h50l-10 18h-30z" fill="#ff7a1f"/>`;
            if (s.world === "space") sky += `<circle cx="140" cy="${y0 + 470}" r="54" fill="#ff9f6b"/><ellipse cx="140" cy="${y0 + 470}" rx="92" ry="14" fill="none" stroke="#ffe066" stroke-width="4" transform="rotate(-12 140 ${y0 + 470})"/>`;
            if (s.world === "arcade") sky += `<g transform="translate(${W - 130} ${y0 + 520})"><circle r="70" fill="#ff5fb0"/>${[0, 1, 2, 3].map(i => `<rect x="-80" y="${8 + i * 14}" width="160" height="${3 + i * 2}" fill="#220a48"/>`).join("")}</g>`;
            // ground textures
            if (s.world === "paper") { for (let y = y0 + 20; y < y0 + SH; y += 36) texture += `<path d="M0 ${y}h${W}" stroke="#b9cdea" stroke-width="2"/>`; texture += `<path d="M90 ${y0}V${y0 + SH}" stroke="#f0a0a0" stroke-width="2.5"/>`; }
            if (s.world === "arcade") { for (let x = 0; x <= W; x += 60) texture += `<path d="M${x} ${y0}V${y0 + SH}" stroke="#ff2bd6" stroke-width="1.5" opacity=".3"/>`; for (let y = y0; y < y0 + SH; y += 60) texture += `<path d="M0 ${y}H${W}" stroke="#2bf0ff" stroke-width="1.5" opacity=".2"/>`; }
            if (s.world === "robot") for (let x = 0; x < W; x += 125) for (let y = y0; y < y0 + SH; y += 90) texture += `<rect x="${x + 4}" y="${y + 4}" width="117" height="82" fill="none" stroke="#56606d" stroke-width="2"/>`;
            if (s.world === "library") for (let y = y0 + 10; y < y0 + SH; y += 28) texture += `<path d="M0 ${y}h${W}" stroke="#4a2f20" stroke-width="2"/>`;
            if (s.world === "ocean") for (let i = 0; i < 9; i++) { const y = y0 + 60 + i * 110; texture += `<path d="M0 ${y} q60 -16 120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0" stroke="#fff" stroke-width="2" fill="none" opacity=".18"/>`; }
            // the world's sign at the top of its band
            const w = Worlds.byId[s.world];
            signs += `<g class="cm-sign" transform="translate(500 ${y0 + 92})"><rect x="-230" y="-52" width="460" height="104" rx="22" fill="${b.node}" stroke="#fff" stroke-width="6"/>
                <rect x="-230" y="-52" width="460" height="104" rx="22" fill="none" stroke="${INK}" stroke-width="3" opacity=".35"/>
                <text class="cm-sign-kick" y="-16">WORLD ${si + 1}</text><text class="cm-sign-name" y="30">${U.esc(w.icon + " " + w.name)}</text></g>`;
        });
        svg = U.svg("svg", { class: "cm-svg", viewBox: `0 0 ${W} ${total}`, role: "group", "aria-label": "Campaign map" });
        svg.innerHTML = `<defs>${blend("cm-ground", "ground")}${blend("cm-hill", "hill")}${blend("cm-path", "path")}${blend("cm-sky", "sky")}</defs>
            <rect x="-100" y="-100" width="${W + 200}" height="${total + 200}" fill="url(#cm-ground)"/>
            <g>${texture}</g>
            <path d="${sideWave(true, 70, 3)}" fill="url(#cm-hill)"/><path d="${sideWave(false, 70, 7)}" fill="url(#cm-hill)"/>
            <path d="${sideWave(true, 30, 11)}" fill="url(#cm-sky)" opacity=".7"/><path d="${sideWave(false, 30, 13)}" fill="url(#cm-sky)" opacity=".7"/>
            <g>${sky}</g>
            <path class="cm-road-shadow" d="${curve(nodes)}" transform="translate(0 7)"/>
            <path class="cm-road" d="${curve(nodes)}" stroke="url(#cm-path)"/>
            <path class="cm-road-dash" d="${curve(nodes)}"/>
            <g>${props}</g><g>${signs}</g>
            <g class="cm-start" transform="translate(500 50)"><circle r="26" fill="#fff" stroke="${INK}" stroke-width="3"/><text y="7" class="cm-start-text">GO</text></g>
            <g class="cm-finish" transform="translate(500 ${total - 120})"><path d="M-8 40V-60" stroke="${INK}" stroke-width="6"/><path d="M-8 -60h70l-14 22 14 22h-70z" fill="#ffd23f" stroke="${INK}" stroke-width="3"/><text x="27" y="-32" class="cm-finish-text">🏆</text></g>`;
        dyn = U.svg("g", { class: "cm-dyn" }, svg);
        mapEl.innerHTML = "";
        mapEl.appendChild(svg);
    }

    // the parts that change with progress: the travelled path, the nodes, the fog over locked worlds, the player
    function drawDynamic() {
        const nodes = allNodes(), f = frontier(), fi = f.si * 5 + f.level;
        let out = `<path class="cm-road-done" d="${curve(nodes, 0, fi)}"/>`;
        map.forEach((s, si) => {
            const b = biome(s.world);
            if (!sectionOpen(si)) {
                out += `<g class="cm-fog"><rect x="-100" y="${TOP + si * SH}" width="${W + 200}" height="${SH}"/><text x="500" y="${TOP + si * SH + SH / 2 - 10}" class="cm-fog-lock">&#128274;</text>` +
                    `<text x="500" y="${TOP + si * SH + SH / 2 + 40}" class="cm-fog-text">Beat ${U.esc(bossOf(map[si - 1].world).name)} to open</text></g>`;
            }
            for (let l = 1; l <= 5; l++) {
                const [x, y] = nodePos(si, l - 1), rec = record(si, l), open = unlocked(si, l), boss = l === 5;
                const state = rec ? "done" : open ? "open" : "locked";
                const sel = si === data.section && l === data.sel && sheetOpen ? " sel" : "";
                const R = boss ? 62 : 38;
                let inner = `<circle class="cm-node-shadow" cy="7" r="${R}"/>`;
                if (state === "open" && si === f.si && l === f.level) inner += `<circle class="cm-pulse" r="${R}" style="stroke:${b.node}"/>`;
                inner += `<circle class="cm-node-base" r="${R}" style="fill:${state === "locked" ? "" : b.node}"/>`;
                if (boss) inner += `<g transform="translate(-54 -60) scale(.45)" class="${state === "locked" ? "cm-dim" : ""}">${Bosses.inner(s.world)}</g>`;
                else inner += `<text class="cm-node-num" y="11">${state === "locked" ? "&#128274;" : l}</text>`;
                if (rec) inner += `<g transform="translate(0 ${R + 16})">${[-1, 0, 1].map((k, i) => `<path class="cm-star${i < rec.stars ? " on" : ""}" d="${starPath(k * 20, 0, 10, 4.4, 5)}"/>`).join("")}</g>`;
                if (boss) inner += `<text class="cm-boss-tag" y="${-R - 12}">BOSS</text>`;
                const prize = abilityPrize(si, l);
                if (prize) inner += `<g class="cm-prize-badge${rec ? "" : " todo"}" transform="translate(${(R * 0.78).toFixed(1)} ${(boss ? R * 0.78 : -R * 0.78).toFixed(1)})"><title>${rec ? "Unlocked" : "Unlocks"}: ${U.esc(prize.name)}</title><circle r="16"/><text>${prize.icon}</text></g>`;
                out += `<g class="cm-node ${state}${boss ? " boss" : ""}${sel}" data-si="${si}" data-level="${l}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" tabindex="0" role="button" aria-label="${U.esc(Worlds.byId[s.world].name)}, ${boss ? "boss battle" : "level " + l}, ${state === "locked" ? "locked" : rec ? rec.stars + " stars" : "ready"}">${inner}</g>`;
            }
        });
        // the player's marker, on the next level to play
        const [px, py] = nodePos(f.si, f.level - 1);
        out += `<g class="cm-player" transform="translate(${px.toFixed(1)} ${(py - (f.level === 5 ? 66 : 42)).toFixed(1)})"><g class="cm-bob"><path d="M0 0c-12-16-22-26-22-38a22 22 0 0 1 44 0c0 12-10 22-22 38z" fill="#fff" stroke="${INK}" stroke-width="3.5"/><circle cy="-38" r="11" fill="${biome(map[f.si].world).node}" stroke="${INK}" stroke-width="2.5"/></g></g>`;
        dyn.innerHTML = out;
        dyn.querySelectorAll(".cm-node").forEach(n => {
            n.addEventListener("click", () => pickLevel(+n.dataset.si, +n.dataset.level, true));
            n.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickLevel(+n.dataset.si, +n.dataset.level, true); } });
        });
    }

    // ---------------------------------------------------------------------------------------------
    // Scrolling: the page scrolls through the worlds; the background world and the top bar follow
    // ---------------------------------------------------------------------------------------------
    const scale = () => (svg ? svg.getBoundingClientRect().width / W : 1);
    const svgTop = () => (svg ? svg.getBoundingClientRect().top + scrollY : 0);
    function scrollToPoint(y, smooth = true) {
        scrollTo({ top: Math.max(0, svgTop() + y * scale() - innerHeight * 0.48), behavior: smooth && U.motion() !== "still" ? "smooth" : "auto" });
    }
    const scrollToLevel = (si, l, smooth) => scrollToPoint(nodePos(si, l - 1)[1], smooth);
    const scrollToWorld = si => scrollToPoint(TOP + si * SH + 420);
    function sectionInView() {
        const y = (scrollY + innerHeight * 0.5 - svgTop()) / scale();
        return U.clamp(Math.floor((y - TOP) / SH), 0, map.length - 1);
    }
    let scrollRAF = 0;
    addEventListener("scroll", () => {
        if (U.view() !== "campaign" || !svg || scrollRAF) return;
        scrollRAF = requestAnimationFrame(() => {
            scrollRAF = 0;
            const si = sectionInView();
            if (si !== data.section) { data.section = si; save(); drawBar(); swapWorld(si); }
        });
    }, { passive: true });

    // the background behind the page becomes the world in view, fading through
    // (not while a level's sheet is open: the page keeps the sheet's world, fonts and all, until it's closed)
    let fadeTimer = 0, pendingSwap = null;
    function swapWorld(si, instant = false) {
        if (sheetOpen && !instant) { pendingSwap = si; return; }
        pendingSwap = null;
        const id = map[si].world, bg = document.getElementById("world-bg");
        clearTimeout(fadeTimer);
        if (Worlds.current && Worlds.current.id === id) return;
        if (instant) { bg.style.opacity = ""; Worlds.use(id); return; }
        bg.style.opacity = "0";
        fadeTimer = setTimeout(() => { if (U.view() === "campaign") Worlds.use(id); bg.style.opacity = ""; }, 380);
    }

    // ---------------------------------------------------------------------------------------------
    // The bar along the top (Exit, the world in view, stars, coins, shop) and the rail of worlds
    // ---------------------------------------------------------------------------------------------
    function drawBar() {
        const si = data.section, s = map[si], w = Worlds.byId[s.world], b = biome(s.world);
        const bar = $(".cmv-bar");
        bar.style.setProperty("--c", b.node);
        $("#cm-kicker").textContent = `WORLD ${si + 1} OF ${map.length}`;
        $("#cm-name").textContent = `${w.icon} ${w.name}`;
        const diffs = [...new Set(s.levels.slice(0, 4).map((d, i) => label(d, sizeOf(s, i + 1))))].join(" / ");
        $("#cm-tag").textContent = `${diffs} · Boss: ${bossOf(s.world).name}`;
        const t = totals();
        $("#cm-total").textContent = `★ ${t.stars} / ${t.max * 3}`;
        $("#cm-coins").textContent = `🪙 ${data.coins}`;
        const rail = $("#cm-rail");
        if (!rail.children.length) {
            map.forEach((sec, i) => {
                const ww = Worlds.byId[sec.world];
                const dot = U.el("button", { type: "button", class: "cm-dot", style: { "--c": biome(sec.world).node }, title: `${i + 1}. ${ww.name}`, "aria-label": `Go to world ${i + 1}: ${ww.name}` }, U.el("span", { text: ww.icon }));
                dot.addEventListener("click", () => { Sound.play("select"); scrollToWorld(i); });
                rail.appendChild(dot);
            });
        }
        [...rail.children].forEach((dot, i) => {
            dot.classList.toggle("on", i === si);
            dot.classList.toggle("done", cleared(i, 5));
            dot.classList.toggle("locked", !sectionOpen(i));
        });
    }

    // ---------------------------------------------------------------------------------------------
    // The level sheet: what a level is, and Play
    // ---------------------------------------------------------------------------------------------
    let sheetOpen = false;
    function drawDetail() {
        const si = data.section, s = map[si], l = data.sel, boss = l === 5, rec = record(si, l), open = unlocked(si, l);
        const d = s.levels[l - 1], box = $("#cm-detail");
        box.innerHTML = "";
        // the sheet wears its own level's world (fonts, colours), so scrolling the map to another world doesn't restyle it
        const w = Worlds.byId[s.world];
        if (w) { box.dataset.world = w.id; box.dataset.theme = Worlds.modeFor(w); }
        box.classList.toggle("boss", boss);
        box.style.setProperty("--c", boss ? bossOf(s.world).color : biome(s.world).node);
        box.appendChild(U.el("button", { type: "button", class: "cm-sheet-close", "aria-label": "Close", text: "×", onclick: closeSheet }));
        if (boss) box.appendChild(U.el("div", { class: "cm-detail-art", html: bossSvg(s.world) }));
        const body = U.el("div", { class: "cm-detail-body" });
        box.appendChild(body);
        body.appendChild(U.el("small", { class: "cm-detail-kicker", text: `WORLD ${si + 1} · ${boss ? "BOSS BATTLE" : "LEVEL " + l} · ${label(d, sizeOf(s, l)).toUpperCase()}` }));
        body.appendChild(U.el("h2", { text: boss ? bossOf(s.world).name : `${Worlds.byId[s.world].name} ${l}` }));
        if (boss && bossOf(s.world).story) body.appendChild(U.el("p", { class: "cm-story", text: bossOf(s.world).story }));
        if (boss) body.appendChild(U.el("p", { class: "cm-taunt", text: `"${bossOf(s.world).taunt}"` }));
        if (boss) {
            const th = Powers.threat(si, map.length), moves = Powers.MOVES[s.world] || [];
            body.appendChild(U.el("p", { class: "cm-threat", text: `Threat ${"💀".repeat(th.stars)}${"·".repeat(5 - th.stars)}` }));
            // its moves, in a menu on the left of the sheet
            box.insertBefore(U.el("div", { class: "cm-moves-menu" }, U.el("small", { text: "ITS MOVES" }),
                ...moves.map(m => U.el("div", { class: "cm-move" }, U.el("span", { class: "cm-move-icon", text: m.icon }),
                    U.el("div", {}, U.el("b", { text: m.name }), U.el("small", { text: "It " + m.desc }))))), box.children[1] || null);
        }
        const lesson = lessonOf(si, l);
        if (lesson) body.appendChild(U.el("div", { class: "cm-lesson" },
            U.el("small", { text: boss ? "BOSS REVIEW" : `LESSON ${l} OF 4` + (lesson.round > 1 ? ` · ROUND ${lesson.round}` : "") }),
            U.el("b", { text: `📘 ${lesson.name}` }),
            U.el("p", { text: lesson.practise }),
            U.el("p", { class: "cm-tip", text: `💡 ${lesson.tip}` })));
        body.appendChild(U.el("p", { class: "cm-rules", text: boss
            ? "A race: solve your puzzle before the boss solves its own. Every right word pushes the race bar your way; chain words for combos. When it winds up an attack, finish a word to block it."
            : `${label(d, sizeOf(s, l))}. Three stars: ★ solve it · ★ no Reveal · ★ ${starGoal(lesson, d, sizeOf(s, l))[0]}.` }));
        if (boss) body.appendChild(loadoutBox(() => drawDetail()));
        const prize = abilityPrize(si, l);
        if (prize) body.appendChild(U.el("p", { class: "cm-prize" + (rec ? " got" : ""), text: rec ? `Ability unlocked here: ${prize.icon} ${prize.name}` : `Clear it to unlock an ability: ${prize.icon} ${prize.name}` }));
        if (rec) body.appendChild(U.el("p", { class: "cm-best", text: `Best: ${"★".repeat(rec.stars)}${"☆".repeat(3 - rec.stars)} · ${U.fmtTime(rec.seconds || 0)}` }));
        if (!open) body.appendChild(U.el("p", { class: "cm-rules", text: l > 1 ? `Clear level ${l - 1} first.` : `Beat ${bossOf(map[si - 1].world).name} first.` }));
        const btn = U.el("button", { type: "button", class: "btn primary big", text: !open ? "🔒 Locked" : rec ? "Play again ▶" : boss ? "Fight! ▶" : "Play ▶" });
        btn.disabled = !open;
        btn.addEventListener("click", () => play(s.world, l));
        body.appendChild(U.el("div", { class: "cm-actions" }, btn, U.el("button", { type: "button", class: "btn", text: "🛒 Shop", onclick: () => openShop(boss ? "abilities" : "items") })));
        box.hidden = false;
        sheetOpen = true;
        requestAnimationFrame(() => box.classList.add("in"));
    }
    function catchUpWorld() { if (pendingSwap != null) { const si = pendingSwap; pendingSwap = null; swapWorld(si); } }
    function closeSheet() {
        const box = $("#cm-detail");
        sheetOpen = false;
        catchUpWorld();
        box.classList.remove("in");
        setTimeout(() => { if (!sheetOpen) box.hidden = true; }, 250);
        if (dyn) drawDynamic();
    }
    function pickLevel(si, l, fromMap = false) {
        if (fromMap && sheetOpen && data.section === si && data.sel === l && unlocked(si, l)) { play(map[si].world, l); return; }   // a second click plays it
        data.section = si;
        data.sel = l;
        save();
        Sound.play("select");
        drawBar();
        drawDetail();
        drawDynamic();
        const node = dyn.querySelector(`.cm-node[data-si="${si}"][data-level="${l}"]`);
        if (node) U.restart(node, "cm-bump");
    }

    // ---------------------------------------------------------------------------------------------
    // Showing the map (#campaign) and playing a level (#level)
    // ---------------------------------------------------------------------------------------------
    async function showMap() {
        try {
            await fetchMap();
        } catch (err) {
            mapEl.innerHTML = "";
            mapEl.appendChild(U.el("p", { class: "status error", text: "Couldn't load the map: " + err.message }));
            return;
        }
        if (U.view() !== "campaign") return;
        data = { ...data, ...U.store.get("campaign", {}) };
        if (!svg) buildStatic();
        drawDynamic();
        const f = frontier();
        data.section = U.clamp(data.section || 0, 0, map.length - 1);
        drawBar();
        swapWorld(data.section, true);
        closeSheetQuiet();
        // land on the level you were looking at (or the next one to play)
        const last = data.playing && data.playing.special ? data.lastPlaying : data.playing;
        const target = last && map.some(s => s.world === last.world)
            ? { si: map.findIndex(s => s.world === last.world), level: last.level } : f;
        requestAnimationFrame(() => scrollToLevel(target.si, target.level, false));
        // the first time you open the campaign: the story so far (the 📖 Book button replays it from the book)
        if (!data.storySeen) {
            data.storySeen = true;
            save();
            setTimeout(() => { if (U.view() === "campaign") FX.cinematic(c => Story.intro(c, storyPages())); }, 400);
        }
        if (!shownOnce) {
            shownOnce = true;
            const w = Worlds.byId[map[f.si].world];
            setTimeout(() => Mascot.say(`Scroll down the map! Next up: ${w.name}, ${f.level === 5 ? "the boss" : "level " + f.level}.`, { mood: "wow", hold: 4500 }), 600);
        }
    }
    let shownOnce = false;
    function closeSheetQuiet() { sheetOpen = false; const box = $("#cm-detail"); box.classList.remove("in"); box.hidden = true; catchUpWorld(); }

    function play(world, level) {
        data.playing = { world, level };
        save();
        if (level === 5) { fight = null; prefetchBoss(world); }   // a boss fight always starts from the beginning
        Sound.play("start");
        // a level that was finished (or given up) starts again from scratch
        Game.restartSlot(slotName());
        if (U.view() === "level") Game.show("level");
        else location.hash = "#level";
    }

    const slotName = () => !data.playing ? "campaign-none" : data.playing.special ? "special-" + data.playing.special : "campaign-" + keyOf(data.playing.world, data.playing.level);
    // Daily Boss / Unlimited Boss (the user, 2026-10-09): a boss fight outside the campaign. data.playing.special
    // says which; it's that boss's own race (its moves, music and arena) at its campaign boss puzzle, one phase.
    // Nothing in the campaign changes: no stars or records, no rerolls, no pages for the book.
    const special = () => (data.playing && data.playing.special) || null;
    const dayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    async function playSpecial(kind) {
        await fetchMap().catch(() => null);
        if (!map) { FX.toast({ icon: "⚠️", kicker: "BOSS", title: "Couldn't reach the server", text: "Try again in a moment.", ms: 3000 }); return; }
        let world = null;
        if (kind === "daily") world = await fetch(`/api/boss/daily?date=${dayStr()}`).then(r => (r.ok ? r.json() : null)).then(r => r && r.world).catch(() => null);
        else world = U.pick(map.map(s => s.world).filter(w => !data.playing || data.playing.world !== w || map.length < 2));
        if (!world || !map.some(s => s.world === world)) { FX.toast({ icon: "⚠️", kicker: "BOSS", title: "Couldn't find today's boss", text: "Try again in a moment.", ms: 3000 }); return; }
        if (data.playing && !data.playing.special) data.lastPlaying = data.playing;          // where the campaign map lands next time
        data.playing = { world, level: 5, special: kind, date: kind === "daily" ? dayStr() : null, sid: Date.now() };
        save();
        fight = null;
        prefetchBoss(world);
        Sound.play("start");
        Game.restartSlot(slotName());
        if (U.view() === "level") Game.show("level");
        else location.hash = "#level";
    }
    const specialUrl = () => { const p = data.playing; return p.special === "daily" ? `/api/boss?kind=daily&date=${p.date || dayStr()}` : `/api/boss?kind=unlimited&world=${encodeURIComponent(p.world)}`; };
    const backToMode = () => { const k = special(); location.hash = k === "daily" ? "#daily" : k === "unlimited" ? "#unlimited" : "#campaign"; };
    // A boss fight needs three puzzles: yours, the boss's own board and phase 2. New ones take a while (Claude writes
    // their clues, one at a time on the server), so they're asked for the moment you press Fight, not after your
    // puzzle has arrived (the intro used to start ~10 seconds late, after you could already type).
    let bossFetch = null;
    function prefetchBoss(world) {
        const sp = special(), v = sp ? "sp" + data.playing.sid : tryOf(world, 5), base = sp ? specialUrl() : `/api/campaign?world=${encodeURIComponent(world)}&level=5` + (v ? `&v=${v}` : "");
        const get = url => fetch(url).then(r => (r.ok ? r.json() : Promise.reject(new Error("the server answered " + r.status))));
        const si = map ? map.findIndex(s => s.world === world) : -1, n = sp ? 1 : 1 + laterPhases(si >= 0 ? map[si] : null).length;
        bossFetch = { world, v, board: get(base + "&boss=true"), phases: {} };
        bossFetch.board.catch(() => null);
        // the later phases one after another (phase 2 is needed first), each ready long before you get there
        let chain = bossFetch.board.catch(() => null);
        for (let k = 2; k <= n; k++) {
            const mine = chain.then(() => get(base + "&phase=" + k));
            bossFetch.phases[k] = mine;
            mine.catch(() => null);
            chain = mine.catch(() => null);
        }
    }
    function apiUrl() {
        const p = data.playing, v = tryOf(p.world, p.level);
        if (p.special) return specialUrl();
        return `/api/campaign?world=${encodeURIComponent(p.world)}&level=${p.level}` + (v ? `&v=${v}` : "");
    }
    function current() {
        if (!data.playing) return null;
        const si = map ? map.findIndex(s => s.world === data.playing.world) : -1;
        return { ...data.playing, si, difficulty: si >= 0 ? map[si].levels[data.playing.level - 1] : null, size: si >= 0 ? sizeOf(map[si], data.playing.level) : 5 };
    }
    // the words on the game screen for a level
    function titles() {
        const c = current(), w = c && Worlds.byId[c.world];
        if (!w) return { title: "Campaign", sub: "" };
        if (c.special) return { title: `${c.special === "daily" ? "Daily Boss" : "Unlimited Boss"}: ${bossOf(c.world).name}`, sub: c.special === "daily" ? `${w.name} · today's boss, the same for everyone` : `${w.name} · a random boss and a new puzzle every time` };
        if (c.level === 5) return { title: "Boss: " + bossOf(c.world).name, sub: `${w.name} · World ${c.si + 1} · beat the boss to open the next world` };
        return { title: `${w.name} · Level ${c.level}`, sub: `World ${c.si + 1} of ${map ? map.length : 15}` + (c.difficulty ? ` · ${label(c.difficulty, c.size)}` : "") };
    }
    function cardInfo(puzzle) {
        const c = current(), w = c && Worlds.byId[c.world];
        if (!w) return null;
        const boss = c.level === 5;
        return {
            mode: "campaign", difficulty: puzzle.difficulty, stage: `WORLD ${c.si + 1}-${c.level}`,
            kicker: c.special ? (c.special === "daily" ? "DAILY BOSS" : "UNLIMITED BOSS") : boss ? `WORLD ${c.si + 1} · BOSS BATTLE` : `WORLD ${c.si + 1} · LEVEL ${c.level}`,
            title: boss ? bossOf(c.world).name : w.name,
            sub: boss ? bossOf(c.world).taunt : (lessonOf(c.si, c.level) ? `Lesson: ${lessonOf(c.si, c.level).name} · ★ ${starGoal(lessonOf(c.si, c.level), puzzle.difficulty, puzzle.size)[0]}` : label(puzzle.difficulty, puzzle.size)),
            stardate: `SECTOR ${c.si + 1}.${c.level}`
        };
    }

    // Called by app.js for every screen: campaign screens wear the campaign's world; the rest wear the player's own
    function onView(view) {
        root.classList.toggle("in-campaign", view === "campaign" || view === "level");
        root.classList.toggle("in-map", view === "campaign");
        root.classList.toggle("in-level", view === "level");
        if (view !== "level") hidePanel();
        if (view === "campaign") showMap();
        else if (view === "level") {
            if (!data.playing) { location.replace("#campaign"); return false; }
            document.getElementById("world-bg").style.opacity = "";
            Worlds.use(data.playing.world);
        } else {
            document.getElementById("world-bg").style.opacity = "";
            if (Worlds.current && Worlds.current.id !== Settings.get("design")) Worlds.use(Settings.get("design"));
        }
        drawItemBar();
        return true;
    }

    // ---------------------------------------------------------------------------------------------
    // Winning a level: stars, saving, what's next
    // ---------------------------------------------------------------------------------------------
    let skipping = false;
    function onWin(game, puzzle) {
        const c = current();
        if (!c || !map) return {};
        if (c.special) return specialWin(game, c);
        const boss = c.level === 5, d = puzzle.difficulty;
        const earned = [];
        let stars;
        if (skipping) {
            stars = 1;
            earned.push(["Cleared with a Level Clear", true]);
        } else if (boss) {
            stars = bossStars();
            const close = fight ? Math.round(Math.max(fight.closest, bossPct()) * 100) : 0;
            earned.push(["Won the race", true], [`The boss never got past ${Math.round(STAR_CLOSE[0] * 100)}%`, stars >= 2], [`...or past ${Math.round(STAR_CLOSE[1] * 100)}%`, stars >= 3], [`Closest it got: ${close}%`, true]);
            if (fight && fight.phases > 1) earned.push([fight.phases === 2 ? "Beat both phases" : `Beat all ${fight.phases} phases`, fight.phase === fight.phases]);
            if (fight && fight.bestCombo > 1) earned.push([`Best combo: ×${fight.bestCombo}`, true]);
        } else {
            const lesson = lessonOf(c.si, c.level), [goal, check] = starGoal(lesson, d, puzzle.size);
            const noReveal = !game.squaresRevealed, met = check(game, puzzle);
            stars = 1 + (noReveal ? 1 : 0) + (met ? 1 : 0);
            earned.push(["Solved it", true], ["No Reveal used", noReveal], [goal, met]);
            if (lesson) earned.push([`Skill practised: ${lesson.name}`, true]);
        }
        skipping = false;
        const key = keyOf(c.world, c.level), old = data.levels[key];
        const firstClear = !old;
        // coins: more for a first clear, and for bosses
        const coins = (boss ? 25 : 5) * stars + (firstClear ? (boss ? 100 : 20) : 0);
        data.coins = (data.coins || 0) + coins;
        data.levels[key] = { stars: Math.max(stars, old ? old.stars : 0), seconds: Math.min(game.seconds, old && old.seconds ? old.seconds : Infinity) };
        // a new ability, the first time this level is cleared (level 1, level 3 and the boss each have one)
        const prize = abilityPrize(c.si, c.level), newAbility = firstClear && prize ? prize : null;
        if (newAbility) data.owned[prize.id] = (data.owned[prize.id] || 0) + FREE_USES;
        let next = null;
        if (c.level < 5) next = { world: c.world, level: c.level + 1 };
        else if (c.si + 1 < map.length) next = { world: map[c.si + 1].world, level: 1 };
        if (next && next.level === 1) { data.section = c.si + 1; data.sel = 1; }
        else if (next) { data.section = c.si; data.sel = next.level; }
        save();
        drawItemBar();
        const bossesBeaten = map.filter(s => data.levels[keyOf(s.world, 5)]).length;
        const stats = {
            levels: Object.keys(data.levels).length, bosses: bossesBeaten, allBosses: map.length, stars: Object.values(data.levels).reduce((n, r) => n + r.stars, 0),
            perfectWorld: map.some(s => [1, 2, 3, 4, 5].every(l => (data.levels[keyOf(s.world, l)] || {}).stars === 3)),
            boss, difficulty: d, test: !!game.testWin
        };
        if (boss && fight) Object.assign(stats, { hits: fight.hits, blocks: fight.blocks, combo: fight.bestCombo, kinds: fight.kinds.size, used: fight.used + fight.itemsUsed,
            closest: Math.max(fight.closest, bossPct()), lifeUsed: fight.lifeUsed, phase2: fight.phase >= 2, phases: fight.phases });
        return {
            campaignStats: stats,
            campaign: { stars, best: data.levels[key].stars, earned, boss, firstClear, next, world: c.world, level: c.level, si: c.si, coins, totalCoins: data.coins,
                newWorld: boss && firstClear && next ? Worlds.byId[next.world] : null, finished: boss && c.si === map.length - 1, newAbility, freeUses: FREE_USES }
        };
    }
    // a Daily or Unlimited Boss beaten: stars and coins, nothing else (the daily's first win each day pays the most)
    function specialWin(game, c) {
        const stars = bossStars(), close = fight ? Math.round(Math.max(fight.closest, bossPct()) * 100) : 0;
        const earned = [["Won the race", true], [`The boss never got past ${Math.round(STAR_CLOSE[0] * 100)}%`, stars >= 2], [`...or past ${Math.round(STAR_CLOSE[1] * 100)}%`, stars >= 3], [`Closest it got: ${close}%`, true]];
        data.specials = data.specials || {};
        const dailyKey = "daily-" + (data.playing.date || dayStr()), firstToday = c.special === "daily" && !data.specials[dailyKey];
        if (c.special === "daily") data.specials[dailyKey] = Math.max(stars, data.specials[dailyKey] || 0);
        data.specials.wins = (data.specials.wins || 0) + 1;
        const coins = c.special === "daily" ? (firstToday ? 60 : 10) + stars * 5 : 15 + stars * 5;
        data.coins = (data.coins || 0) + coins;
        if (firstToday) earned.push(["Today's boss beaten", true]);
        save();
        drawItemBar();
        return { campaign: { stars, best: stars, earned, boss: true, firstClear: false, next: null, world: c.world, level: 5, si: c.si, coins, totalCoins: data.coins, special: c.special } };
    }
    function bestLine() {
        const c = current();
        if (!c) return "";
        const rec = data.levels[keyOf(c.world, c.level)];
        const lesson = lessonOf(c.si, c.level), what = lesson && c.level < 5 ? `📘 ${lesson.name}` : `World ${c.si + 1} · ${c.level === 5 ? "Boss" : "Level " + c.level}`;
        return rec ? `${what} · Best: ${"★".repeat(rec.stars)}${"☆".repeat(3 - rec.stars)}` : what;
    }
    function next(n) {
        if (!n) { location.hash = "#campaign"; return; }
        if (n.level === 1) { data.playing = { world: n.world, level: 1 }; save(); location.hash = "#campaign"; return; }   // a new world: see it on the map first
        play(n.world, n.level);
    }

    // ---------------------------------------------------------------------------------------------
    // Abilities (boss fights): 3 per world, each one different (no repeats, no stronger copies; the user's rule).
    // What they are, how they look and sound is in powers.js; what each one does is in useAbility below.
    // ---------------------------------------------------------------------------------------------
    const WORLD_ORDER = ["paper", "garden", "squirrel", "candy", "ocean", "snow", "rain", "sky", "desert", "carnival", "arcade", "library", "robot", "volcano", "space"];   // the map order (Campaign.java)
    const ABILITIES = Powers.ABILITIES.map(a => ({ ...a, price: 30 + WORLD_ORDER.indexOf(a.world) * 8 }));
    const abilityById = Object.fromEntries(ABILITIES.map(a => [a.id, a]));

    // Unlocking (the user's design): a world's 1st ability unlocks when you clear its level 1, the 2nd at level 3,
    // the 3rd when you beat its boss. Each unlock comes with FREE_USES uses; more cost coins in the shop.
    const UNLOCK_AT = [1, 3, 5], FREE_USES = 2;
    const unlockLevel = a => UNLOCK_AT[ABILITIES.filter(x => x.world === a.world).indexOf(a)];
    // the ability a level unlocks (or null): abilityPrize(0, 3) = Paper's 2nd ability
    function abilityPrize(si, level) {
        if (!map || !map[si]) return null;
        const i = UNLOCK_AT.indexOf(level);
        return i < 0 ? null : ABILITIES.filter(a => a.world === map[si].world)[i] || null;
    }
    function earnedAbility(a) {
        if (!map) return false;
        const si = map.findIndex(s => s.world === a.world);
        return si >= 0 && cleared(si, unlockLevel(a));
    }
    const unlockedAbility = a => TEST_UNLOCK_ALL || earnedAbility(a);
    const unlockedAbilities = () => ABILITIES.filter(unlockedAbility);
    const unlockText = a => (unlockLevel(a) === 5 ? `Beat ${bossOf(a.world).name}` : `Clear ${Worlds.byId[a.world] ? Worlds.byId[a.world].name : a.world} ${unlockLevel(a)}`);

    // ---- items: one-use helpers for any campaign level, bought in the shop ----
    const ITEMS = [
        { id: "letter", icon: "🔍", name: "Letter Reveal", price: 15, desc: "Shows the right letter in the selected square. It doesn't count as using Reveal, so you keep that star." },
        { id: "word", icon: "📖", name: "Word Reveal", price: 45, desc: "Fills in the whole selected word, with no Reveal penalty." },
        { id: "clear", icon: "🧽", name: "Clear Wrong", price: 12, desc: "Wipes every wrong letter off your board, so you can see what's left to fix." },
        { id: "lock", icon: "🔒", name: "Lock Right", price: 20, desc: "Locks every right letter in place. Boss attacks can't erase locked letters." },
        { id: "pause", icon: "⏸️", name: "Time Stop", price: 35, desc: "Stops your clock for 30 seconds. In a boss fight it stops the boss instead, for 10 seconds." },
        { id: "skip", icon: "⏭️", name: "Level Clear", price: 150, desc: "Clears a normal level for you, with 1 star. Doesn't work on bosses." }
    ];
    const itemById = Object.fromEntries(ITEMS.map(i => [i.id, i]));

    // Saves from the beta (5000 coins and 3 of every ability) start over with the unlock rules; while testing,
    // every save gets coins, uses and items once
    function migrate() {
        if (!(data.v >= 2)) {
            data.v = 2;
            data.coins = 50;
            data.owned = {};
            data.loadout = [];
            for (const a of ABILITIES.filter(earnedAbility)) data.owned[a.id] = FREE_USES;
        }
        if (TEST_UNLOCK_ALL && !data.testGift) {
            data.testGift = true;
            data.coins = (data.coins || 0) + 2000;
            for (const a of ABILITIES) data.owned[a.id] = Math.max(3, data.owned[a.id] || 0);
            for (const i of ITEMS) data.items[i.id] = Math.max(5, data.items[i.id] || 0);
        }
        save();
    }
    // the abilities you bring: the ones you picked (if still unlocked), else this world's
    const loadout = () => {
        const list = [...new Set((data.loadout || []).filter(id => abilityById[id] && unlockedAbility(abilityById[id])))].slice(0, 3);
        if (list.length >= 3) return list;
        // fill the empty slots: this world's abilities first, then the newest unlocked ones
        const here = data.playing ? ABILITIES.filter(a => a.world === data.playing.world && unlockedAbility(a)) : [];
        for (const a of [...here, ...unlockedAbilities().reverse()]) if (list.length < 3 && !list.includes(a.id)) list.push(a.id);
        return list;
    };

    // ---------------------------------------------------------------------------------------------
    // The shop: one page for everything (items and every world's abilities)
    // ---------------------------------------------------------------------------------------------
    function openShop(tab = "items") {
        const modal = U.el("div", { class: "results shop-page", role: "dialog", "aria-modal": "true", "aria-labelledby": "shop-title" });
        const card = U.el("div", { class: "shop-card" });
        modal.appendChild(card);
        let scrollKeep = 0;
        const draw = () => {
            const list0 = card.querySelector(".shop-scroll");
            if (list0) scrollKeep = list0.scrollTop;
            card.innerHTML = "";
            const eq = loadout();
            const tabs = U.el("div", { class: "shop-tabs", role: "tablist" },
                ...[["items", "🎒 Items"], ["abilities", "⚔️ Boss abilities"]].map(([id, text]) => U.el("button", { type: "button", role: "tab", class: "shop-tab" + (tab === id ? " on" : ""), "aria-selected": tab === id ? "true" : "false", text,
                    onclick: () => { tab = id; scrollKeep = 0; Sound.play("select"); draw(); } })));
            card.append(
                U.el("div", { class: "shop-head" },
                    U.el("div", { class: "shop-title" }, U.el("small", { text: "CAMPAIGN" }), U.el("h2", { id: "shop-title", text: "The Shop" })),
                    U.el("span", { class: "shop-coins", text: `🪙 ${data.coins}` }),
                    U.el("button", { type: "button", class: "btn ghost small", text: "Close ✕", onclick: close })),
                tabs);
            const buy = (price, give) => () => {
                if (data.coins < price) return;
                data.coins -= price;
                data.bought = (data.bought || 0) + 1;
                data.spent = (data.spent || 0) + price;
                give(); save(); Sound.play("coin"); draw();
                Achievements.announce(Achievements.campaign({ bought: data.bought, spent: data.spent }));
            };
            // your 3 equipped abilities, always at the top: easy to buy more uses (the user's request)
            const eqBar = U.el("div", { class: "shop-equipped" }, U.el("small", { text: "EQUIPPED (KEYS 1-3)" }));
            const eqRow = U.el("div", { class: "se-row" });
            for (let i = 0; i < 3; i++) {
                const a = abilityById[eq[i]];
                eqRow.appendChild(a ? U.el("div", { class: "se-slot", style: { "--c": a.fx.color } },
                    U.el("span", { class: "se-icon", text: a.icon }),
                    U.el("div", { class: "se-text" }, U.el("b", { text: a.name }), U.el("small", { text: `×${data.owned[a.id] || 0} uses · key ${i + 1}` })),
                    U.el("button", { type: "button", class: "btn small primary", text: `+1 · 🪙 ${a.price}`, disabled: data.coins < a.price, title: `Buy one more use of ${a.name}`,
                        onclick: buy(a.price, () => { data.owned[a.id] = (data.owned[a.id] || 0) + 1; }) }),
                    U.el("button", { type: "button", class: "btn small ghost", text: "Change", onclick: () => pickAbility(i, draw) }))
                    : U.el("div", { class: "se-slot empty" }, U.el("span", { class: "se-icon", text: "+" }),
                        U.el("div", { class: "se-text" }, U.el("b", { text: "Empty" }), U.el("small", { text: `key ${i + 1}` })),
                        U.el("button", { type: "button", class: "btn small", text: "Pick", onclick: () => pickAbility(i, draw) })));
            }
            eqBar.appendChild(eqRow);
            card.appendChild(eqBar);
            const scroll = U.el("div", { class: "shop-scroll" });
            card.appendChild(scroll);
            if (tab === "items") {
                scroll.appendChild(U.el("p", { class: "shop-note", text: "Items work in any campaign level, bosses included. Use them from the item bar under the board." }));
                const grid = U.el("div", { class: "shop-grid" });
                for (const it of ITEMS) grid.appendChild(U.el("div", { class: "shop-item-card" },
                    U.el("span", { class: "sic-icon", text: it.icon }),
                    U.el("b", { text: it.name }), U.el("p", { text: it.desc }),
                    U.el("div", { class: "sic-foot" }, U.el("span", { class: "shop-owned", text: `You have ×${data.items[it.id] || 0}` }),
                        U.el("button", { type: "button", class: "btn small primary", text: `Buy · 🪙 ${it.price}`, disabled: data.coins < it.price, onclick: buy(it.price, () => { data.items[it.id] = (data.items[it.id] || 0) + 1; }) }))));
                scroll.appendChild(grid);
            } else {
                scroll.appendChild(U.el("p", { class: "shop-note", text: `Each world has 3 abilities for boss fights: clear its Level 1, Level 3 and its boss to unlock them (${FREE_USES} free uses each). Bring up to 3 into a fight; use them with keys 1, 2 and 3.` + (TEST_UNLOCK_ALL ? " Testing: everything is unlocked for now." : "") }));
                // (what you bring is shown in the equipped bar at the top of the shop)
                for (const world of WORLD_ORDER) {
                    const w = Worlds.byId[world];
                    if (!w) continue;
                    scroll.appendChild(U.el("h3", { class: "shop-world", style: { "--c": biome(world).node } }, U.el("span", { text: `${w.icon} ${w.name}` }), U.el("small", { text: bossOf(world).name })));
                    const grid = U.el("div", { class: "shop-grid" });
                    for (const a of ABILITIES.filter(x => x.world === world)) {
                        const on = eq.includes(a.id), open = unlockedAbility(a);
                        grid.appendChild(U.el("div", { class: "shop-item-card ability" + (on ? " on" : "") + (open ? "" : " locked"), style: { "--c": biome(world).node } },
                            U.el("span", { class: "sic-icon", text: open ? a.icon : "🔒" }),
                            U.el("b", { text: a.name }), U.el("p", { text: a.flavor }), U.el("p", { class: "sic-effect", text: a.desc }),
                            U.el("small", { class: "sic-unlock", text: (earnedAbility(a) ? "✓ Unlocked: " : "🔓 Unlock: ") + unlockText(a) + (!earnedAbility(a) && TEST_UNLOCK_ALL ? " (open for testing)" : "") }),
                            open ? U.el("div", { class: "sic-foot" }, U.el("span", { class: "shop-owned", text: `×${data.owned[a.id] || 0}` }),
                                U.el("button", { type: "button", class: "btn small", text: `Buy · 🪙 ${a.price}`, disabled: data.coins < a.price, onclick: buy(a.price, () => { data.owned[a.id] = (data.owned[a.id] || 0) + 1; }) }),
                                U.el("button", { type: "button", class: "btn small" + (on ? " primary" : ""), text: on ? "Equipped ✓" : "Equip", onclick: () => {
                                    let l = loadout().filter(id => id !== a.id);
                                    if (!on) { l.push(a.id); if (l.length > 3) l = l.slice(-3); }
                                    data.loadout = l; save(); Sound.play("select"); draw(); } })) : null));
                    }
                    scroll.appendChild(grid);
                }
            }
            requestAnimationFrame(() => { scroll.scrollTop = scrollKeep; });
        };
        const close = () => {
            modal.classList.remove("in"); modal.classList.add("out"); setTimeout(() => modal.remove(), 300);
            if (U.view() === "campaign" && map && svg) { drawBar(); if (sheetOpen) drawDetail(); }
            drawAbilityBar(); drawItemBar();
        };
        modal.addEventListener("pointerdown", e => { if (e.target === modal) close(); });
        modal.addEventListener("keydown", e => { if (e.key === "Escape") { e.stopPropagation(); close(); } });
        draw();
        document.getElementById("overlay").appendChild(modal);
        requestAnimationFrame(() => { modal.classList.add("in"); const b = modal.querySelector(".shop-tab.on"); if (b) b.focus({ preventScroll: true }); });
        Sound.play("select");
    }

    // ---- your 3 abilities: any 3 you've unlocked, from any world (the user's request) ----
    // The box on a boss's level sheet: 3 slots; click one to pick what goes in it
    function loadoutBox(redraw) {
        const eq = loadout();
        const box = U.el("div", { class: "cm-loadout" }, U.el("small", { text: "YOUR 3 ABILITIES (KEYS 1-3)" }));
        const row = U.el("div", { class: "lo-row" });
        for (let i = 0; i < 3; i++) {
            const a = abilityById[eq[i]];
            row.appendChild(U.el("button", { type: "button", class: "lo-slot" + (a ? "" : " empty"), style: a ? { "--c": a.fx.color } : {}, title: a ? `${a.name}: ${a.desc}` : "Pick an ability",
                onclick: () => pickAbility(i, redraw) },
                U.el("span", { class: "lo-icon", text: a ? a.icon : "+" }), U.el("b", { text: a ? a.name : "Empty" }), U.el("small", { text: a ? `×${data.owned[a.id] || 0} · key ${i + 1}` : `key ${i + 1}` })));
        }
        box.appendChild(row);
        return box;
    }
    // Pick an ability for slot i, from every unlocked ability in every world
    function pickAbility(slot, redraw) {
        const modal = U.el("div", { class: "results shop-page", role: "dialog", "aria-modal": "true", "aria-labelledby": "pick-title" });
        const card = U.el("div", { class: "shop-card" });
        const close = () => { modal.classList.remove("in"); modal.classList.add("out"); setTimeout(() => modal.remove(), 300); };
        const eq = loadout();
        const scroll = U.el("div", { class: "shop-scroll" }, U.el("p", { class: "shop-note", text: `Choose the ability for key ${slot + 1}. Any unlocked ability from any world works in any boss fight.` }));
        for (const world of WORLD_ORDER) {
            const list = ABILITIES.filter(a => a.world === world && unlockedAbility(a));
            if (!list.length) continue;
            scroll.appendChild(U.el("h3", { class: "shop-world", style: { "--c": biome(world).node } }, U.el("span", { text: `${Worlds.byId[world].icon} ${Worlds.byId[world].name}` })));
            const grid = U.el("div", { class: "shop-grid" });
            for (const a of list) {
                const at = eq.indexOf(a.id);
                grid.appendChild(U.el("button", { type: "button", class: "shop-item-card ability pick" + (at === slot ? " on" : ""), style: { "--c": a.fx.color },
                    onclick: () => {
                        const l = loadout().slice(0, 3);
                        while (l.length < 3) l.push(null);
                        const was = l.indexOf(a.id);
                        if (was >= 0) l[was] = l[slot];                 // already equipped elsewhere: swap the two
                        l[slot] = a.id;
                        data.loadout = l.filter(Boolean);
                        save(); Sound.play("select"); close(); redraw && redraw(); drawAbilityBar();
                    } },
                    U.el("span", { class: "sic-icon", text: a.icon }), U.el("b", { text: a.name }), U.el("p", { class: "sic-effect", text: a.desc }),
                    U.el("small", { class: "sic-unlock", text: `×${data.owned[a.id] || 0} uses` + (at >= 0 ? ` · on key ${at + 1}` : "") })));
            }
            scroll.appendChild(grid);
        }
        card.append(U.el("div", { class: "shop-head" },
            U.el("div", { class: "shop-title" }, U.el("small", { text: "LOADOUT" }), U.el("h2", { id: "pick-title", text: `Key ${slot + 1}` })),
            U.el("button", { type: "button", class: "btn ghost small", text: "Close ✕", onclick: close })), scroll);
        modal.appendChild(card);
        modal.addEventListener("pointerdown", e => { if (e.target === modal) close(); });
        modal.addEventListener("keydown", e => { if (e.key === "Escape") { e.stopPropagation(); close(); } });
        document.getElementById("overlay").appendChild(modal);
        requestAnimationFrame(() => modal.classList.add("in"));
    }

    // ---- the item bar under the board, in campaign levels ----
    const itemBar = U.el("div", { class: "cm-items", "aria-label": "Items" });
    document.getElementById("helpers").before(itemBar);
    function drawItemBar() {
        itemBar.hidden = U.view() !== "level";
        if (itemBar.hidden) return;
        itemBar.innerHTML = "";
        itemBar.appendChild(U.el("span", { class: "helper-label", text: "Items" }));
        const boss = data.playing && data.playing.level === 5;
        for (const it of ITEMS) {
            const n = data.items[it.id] || 0;
            if (it.id === "skip" && boss) continue;
            const b = U.el("button", { type: "button", class: "cm-item", disabled: n <= 0, title: `${it.name}: ${it.desc}` },
                U.el("span", { class: "cm-item-icon", text: it.icon }), U.el("b", { text: "×" + n }));
            b.addEventListener("click", () => { b.blur(); useItem(it.id); });
            itemBar.appendChild(b);
        }
        itemBar.appendChild(U.el("button", { type: "button", class: "cm-item shop", title: "Open the shop", text: "🛒", onclick: () => openShop("items") }));
        itemBar.appendChild(U.el("button", { type: "button", class: "cm-item giveup", title: "Give up this level", text: "🏳️ Give up", onclick: e => { e.currentTarget.blur(); giveUp(); } }));
    }
    // Give up (the user asked for it on bosses and every level): ends the level without revealing the answers.
    // Nothing is saved, so you can try it again straight away.
    async function giveUp() {
        const g = Game.state;
        if (U.view() !== "level" || !g.puzzle || g.solved || !data.playing) return;
        const boss = data.playing.level === 5;
        const ok = await U.ask({ title: boss ? "Give up this fight?" : "Give up this level?", text: boss ? "The boss wins this round. You can ask for a rematch right away." : "The level won't be cleared. You can try it again right away.", yes: "Give up", no: "Keep playing" });
        if (!ok || g.solved) return;
        if (boss && fight && !fight.over) { lose("surrender"); return; }
        const { world, level } = data.playing;
        Game.endLoss({ title: "Gave up", text: "Level not cleared. Try it again whenever you like." });
        Sound.play("wrong");
        loseCard({ world, level, kicker: `${Worlds.byId[world].name.toUpperCase()} ${level} · GAVE UP`, title: "Maybe next time!", note: "Items like Letter Reveal and Clear Wrong (in the shop) can help with a tough one." });
    }
    // the "you lost" card with Retry / Shop / Map
    function loseCard({ world, level, kicker, title, note, art }) {
        rerollOnce(world, level);
        const modal = U.el("div", { class: "results", role: "dialog", "aria-modal": "true" });
        const card = U.el("div", { class: "res-card lose-card", style: { "--boss": level === 5 ? bossOf(world).color : biome(world).node } },
            art ? U.el("div", { class: "lose-art", html: art }) : null,
            U.el("small", { class: "res-kicker", text: kicker }),
            U.el("h2", { class: "res-title", text: title }),
            U.el("p", { class: "res-note", text: note }),
            U.el("div", { class: "res-actions" },
                special() ? U.el("button", { type: "button", class: "btn primary", text: special() === "daily" ? "Rematch ▶" : "New boss ▶", onclick: () => { modal.remove(); playSpecial(special()); } })
                    : U.el("button", { type: "button", class: "btn primary", text: level === 5 ? "Rematch ▶" : "Try again ▶", onclick: () => { modal.remove(); play(world, level); } }),
                U.el("button", { type: "button", class: "btn", text: "🛒 Shop", onclick: () => openShop(level === 5 ? "abilities" : "items") }),
                U.el("button", { type: "button", class: "btn ghost", text: special() ? "Back" : "Map", onclick: () => { modal.remove(); if (special()) backToMode(); else location.hash = "#campaign"; } })));
        modal.appendChild(card);
        document.getElementById("overlay").appendChild(modal);
        requestAnimationFrame(() => modal.classList.add("in"));
    }
    function useItem(id) {
        const it = itemById[id];
        if (!it || U.view() !== "level" || !Game.state.puzzle || Game.state.solved || (data.items[id] || 0) <= 0) return;
        if (fight && !fight.over && fight.me.itemlock > 0) { FX.toast({ icon: "🧱", kicker: "BLOCKED", title: it.name, text: "The boss's Firewall blocks your items for a few seconds.", ms: 2200 }); Sound.play("wrong"); return; }
        const boss = data.playing && data.playing.level === 5;
        let n = 0, text = "";
        if (id === "letter") { n = Game.revealFree("square"); text = "The right letter is in."; }
        if (id === "word") { n = Game.revealFree("word"); text = `${n} letter${n === 1 ? "" : "s"} filled in.`; }
        if (id === "clear") { n = Game.clearWrong(); text = `${n} wrong letter${n === 1 ? "" : "s"} wiped.`; }
        if (id === "lock") { n = Game.lockRight(); text = `${n} letter${n === 1 ? "" : "s"} locked in.`; }
        if (id === "pause" && fightOn() && fight.puzzle) { fight.boss.freeze = Math.max(fight.boss.freeze || 0, 10); n = 1; text = "The boss is frozen in time for 10 seconds."; }
        else if (id === "pause") { Game.stopClock(30); n = 1; text = "Your clock stops for 30 seconds."; }
        if (id === "skip") {
            if (boss) { FX.toast({ icon: it.icon, kicker: "NOT HERE", title: it.name, text: "Level Clear doesn't work on bosses.", ms: 2200 }); return; }
            skipping = true; data.items[id]--; save();
            Game.revealFree("puzzle");
            return;
        }
        if (!n) { FX.toast({ icon: it.icon, kicker: "NOTHING TO DO", title: it.name, text: id === "clear" ? "No wrong letters on the board." : id === "lock" ? "No unlocked right letters yet." : "That square is already right.", ms: 2200 }); return; }
        data.items[id]--;
        if (fight && !fight.over) fight.itemsUsed++;
        save();
        Sound.play("sparkle");
        FX.toast({ icon: it.icon, kicker: "ITEM USED", title: it.name, text, ms: 2000 });
        drawItemBar();
    }

    // ---------------------------------------------------------------------------------------------
    // Boss fights (the user's design, 2026-10-09): a pure RACE against a bot that solves its own puzzle next to
    // yours. No HP and no clock: whoever finishes their board first wins the phase. Win the last phase to win.
    //   - the race bar at the top shows who's ahead: it pushes right when you lead, left when the boss does
    //   - you and the boss use abilities on each other to slow each other down
    //   - words finished close together build a COMBO, and combos charge your SUPER (key 4): a big full-screen strike
    //   - the boss WINDS UP its attacks for a few seconds: finish a (right) word in time to BLOCK it
    //   - fall behind and the boss pushes harder; get far ahead and it gets ENRAGED: faster, and the arena turns red
    //   - each boss is faster and fights harder than the one before (Powers.threat, racePace): quicker solving,
    //     more frequent attacks, shorter wind-ups, longer effects, and late bosses chain two moves when enraged
    // The boss's moves (Powers.MOVES) each do their own thing to you; see attack() and applyMe().
    // ---------------------------------------------------------------------------------------------
    const COMBO_GAP = 15000;          // ms between words to keep a combo going
    const BLOT = "✱";                // an ink blot on the boss's board (Ink Splat)
    // how long the boss takes to solve its puzzle: the level's par time times this, by difficulty...
    const BOT_PACE = { easy: 1.15, medium: 1.05, hard: 0.95, challenge: 1, expert: 0.95 };
    // ...and faster in every world (world 1: x1.15, world 15: x0.72) and every phase (x0.94 each); on top of that every
    // boss solves 15% faster than it used to (the user, 2026-10-09: "make each boss a little harder")
    const BOSS_SPEEDUP = 0.72;
    const botTimeFor = (d, size, si, phase = 1) => par(d, size) * (BOT_PACE[d] || 1) * (1.15 - 0.43 * Math.max(0, si) / 14) * Math.pow(0.94, phase - 1) * BOSS_SPEEDUP;
    // the boss pushes harder when it's behind: up to +45% speed when you lead by 35% of the board
    const CATCH_UP = lead => 1 + Math.min(0.45, Math.max(0, lead - 0.08) * 1.6);
    const RAGE_LEAD = 0.25;           // you're this far ahead: the boss gets ENRAGED
    // timers on the boss (seconds left), and what the status line calls them
    const BOSS_TIMERS = { freeze: "❄️ Frozen", slow: "🍬 Sticky", blind: "🥧 Can't see", stutter: "🤧 Sneezing", hypno: "🤹 Hypnotized", crash: "🍡 Sugar crash",
        bubble: "🫧 Bubbled", dig: "🍂 Digging", quick: "⏳ Sinking", sand: "🏜️ Sandstorm", lava: "🌋 Lava floor", reverse: "⏪ Reversed", worm: "🌀 Wormhole", ghost: "🖊️ Ghost writer",
        haste: "🛩️ Hasted" };
    // timers on your side (good ones)
    const MY_BUFFS = { sun: "🌱 Words grow letters", tailwind: "🪁 Letters held", lucky: "🌈 Combo locked", fireup: "🔥 Wrong letters burn", hot: "🔥 Words stun", overclock: "⚡ Overclock",
        armor: "🧊 Frost armor", firewall: "🧱 Firewall", silver: "☁️ Silver lining", calm: "🤫 Boss calmed" };
    // what each boss move does to you, for the status chips
    const ME_TEXT = { crumple: "🗞️ Board crumpled", petals: "🌸 Clues buried", hoot: "🦉 Clues jumbled", sour: "🍋 Letters invisible", sticky: "🍯 Sticky cursor",
        ink: "🦑 Board blurred", whirl: "🌀 Board spinning", freeze: "🥶 Can't type", whiteout: "🌨️ Snowed in", downpour: "🌧️ Letters running", gale: "🌪️ Cursor blown",
        twister: "🌀 Direction flipping", riddle: "🐪 Clues backwards", sandblast: "🏜️ Sandy keys", mirror: "🪞 Mirrored", confetti: "🎉 Confetti", lock: "🔒 Word locked",
        static: "📺 Static", haunting: "👻 Fake letters", lights: "🕯️ Lights out", gravity: "🪐 Heavy keys", flare: "☀️ Blinded",
        inkblot: "🖋️ Ink blot", nobackspace: "🖊️ No Backspace", drain: "🥀 Board wilted", fakecheck: "🖍️ Red pen lies", minion: "🐛 Aphid! Click it", seal: "🌿 Abilities sealed",
        darkcreep: "🌑 Nightfall", jitter: "🍭 Shaking", fumble: "🧈 Butterfingers", tidal: "🌊 Washed away", backwards: "↩️ Riptide", shrink: "🐙 Squeezed",
        avalanche: "🏔️ Avalanche", slowmo: "🧤 Numb fingers", shatter: "🧊 Cracked board", halffog: "🌊 Flooded", quake: "🌩️ Letters falling", upside: "✈️ Upside down",
        flicker: "☁️ Cloud cover", mirageclue: "🌅 Clue bar lies", clueswap: "🥜 Clues shuffled", taunt: "🎩 Stuck on its word", comboban: "💢 No combos", echo: "🔁 Echo",
        mask: "🔣 Corrupted letters", itemlock: "🧱 Items blocked", numberless: "💾 No numbers", fakeclue: "😈 A clue lies", oneword: "📜 Torn clues", toll: "♨️ Words feed it", heatwave: "🥵 Check too hot",
        vowels: "🕳️ No vowels" };

    let fight = null, lastKeyAt = 0;
    const panel = U.el("aside", { class: "boss-panel", hidden: true, "aria-label": "The boss" });
    document.getElementById("puzzle").appendChild(panel);
    // The race bar (the user's design): at the top, the level's friend on the left and the boss on the right. The
    // middle is pushed right when you're ahead and left when the boss is (how far = how much more of the board).
    const raceEl = U.el("div", { class: "race-bar", hidden: true, role: "img", "aria-label": "Who's ahead in the race",
        html: `<div class="rb-side rb-me"><canvas class="rb-face" width="112" height="112"></canvas><div class="rb-who"><small>YOU</small><b class="rb-pct">0%</b></div></div>
            <div class="rb-track"><div class="rb-fill-me"></div><div class="rb-fill-boss"></div><div class="rb-ticks"></div><div class="rb-knot"><i></i></div><div class="rb-lead"></div><div class="rb-phase"></div></div>
            <div class="rb-side rb-boss"><div class="rb-who"><small>BOSS</small><b class="rb-pct">0%</b></div><div class="rb-face rb-boss-face"></div></div>` });
    document.getElementById("puzzle").before(raceEl);
    let raceShown = -1, raceFaceFor = "";
    // Write to the page only when something changed: the fight redraws ten times a second, and every write (even of
    // the same value) makes the browser redo styles and layout for the part of the page it touches
    const setText = (el, t) => { if (el && el.textContent !== t) el.textContent = t; };
    const setVar = (el, k, v) => { if (!el) return; const c = el._vars || (el._vars = {}); if (c[k] !== v) { c[k] = v; el.style.setProperty(k, v); } };
    function drawRace() {
        const f = fight;
        if (!f || raceEl.hidden) return;
        const me = myPct(), boss = bossPct(), lead = me - boss;
        // the knot: 50% when level, pushed most of the way to the boss's end when you're a whole board ahead
        const x = 50 + Math.max(-1, Math.min(1, lead)) * 44;
        setVar(raceEl, "--x", x.toFixed(1) + "%");
        setText(raceEl.querySelector(".rb-me .rb-pct"), Math.round(me * 100) + "%");
        setText(raceEl.querySelector(".rb-boss .rb-pct"), Math.round(boss * 100) + "%");
        const k = Math.round(lead * 100);
        const text = Math.abs(k) < 3 ? "Neck and neck!" : k > 0 ? `You're ahead by ${k}%` : `${bossOf(f.world).name} is ahead by ${-k}%`;
        const leadEl = raceEl.querySelector(".rb-lead");
        if (leadEl.textContent !== text) { leadEl.textContent = text; raceEl.setAttribute("aria-label", `Race: you ${Math.round(me * 100)}%, the boss ${Math.round(boss * 100)}%. ${text}`); }
        raceEl.classList.toggle("ahead", k >= 3);
        raceEl.classList.toggle("behind", k <= -3);
        raceEl.classList.toggle("danger", boss >= 0.8 && k < 10);
        raceEl.classList.toggle("enraged", f.enraged);
        const ph = f.phases > 1 ? (f.phase === f.phases && f.phases > 2 ? `FINAL PHASE · ${f.phase}/${f.phases}` : `PHASE ${f.phase}/${f.phases}`) : "";
        const phEl = raceEl.querySelector(".rb-phase");
        if (phEl.textContent !== ph) phEl.textContent = ph;
        // the friend's face: happy when you're ahead, worried when you're behind (redrawn only when that changes)
        const mood = k >= 3 ? "happy" : k <= -10 ? "sad" : "idle";
        if (raceFaceFor !== f.world + mood) {
            raceFaceFor = f.world + mood;
            const w = Worlds.byId[f.world], cv = raceEl.querySelector("canvas.rb-face"), g = cv.getContext("2d");
            g.setTransform(1, 0, 0, 1, 0, 0);
            g.clearRect(0, 0, cv.width, cv.height);
            g.setTransform(cv.width / 160, 0, 0, cv.height / 160, 0, 0);
            if (w && w.mascot) { try { w.mascot.draw(g, { t: 0.4, blink: 0, mood, talk: 0, excite: mood === "happy" ? 0.6 : 0, hop: 0, look: 0.4 }); } catch (err) { console.error(err); } }
            raceEl.querySelector(".rb-me small").textContent = w && w.mascot ? `YOU & ${w.mascot.name}` : "YOU";
        }
        if (raceShown !== f.phase + f.world) {
            raceShown = f.phase + f.world;
            raceEl.querySelector(".rb-boss-face").innerHTML = bossSvg(f.world);
            raceEl.style.setProperty("--boss", bossOf(f.world).color);
        }
    }
    // squares in words you've got completely right (Downpour leaves those alone)
    function doneCells() {
        const g = Game.state, out = new Set();
        for (const e of [...g.puzzle.across, ...g.puzzle.down]) {
            const cells = Game.cellsOf(e);
            if (cells.every(([r, c]) => g.letters[r][c] === g.puzzle.solution[r][c])) cells.forEach(([r, c]) => out.add(r + "," + c));
        }
        return out;
    }
    // Heatwave: Check and Reveal are too hot to touch
    document.getElementById("helpers").addEventListener("click", e => {
        const btn = e.target.closest("button[data-action]");
        if (!btn || !fightOn() || !(fight.me.heatwave > 0)) return;
        e.stopPropagation();
        e.preventDefault();
        U.restart(btn, "shake");
        Powers.aura(btn, ["🔥", "♨️"], "rise", 4, 700);
        FX.toast({ icon: "🥵", kicker: "HEATWAVE", title: "Too hot to touch!", text: `Check and Reveal cool down in ${Math.ceil(fight.me.heatwave)}s.`, ms: 1800 });
        Sound.play("wrong");
    }, true);
    const meStatus = U.el("div", { class: "me-status", "aria-live": "polite" });
    document.querySelector(".hud-row").after(meStatus);
    const warnEl = U.el("div", { class: "me-warn", hidden: true, "aria-live": "assertive" });
    raceEl.querySelector(".rb-track").appendChild(warnEl);           // right under the race bar's "who's ahead" label (the user's spot)
    const flareEl = U.el("div", { class: "fx-flare-screen", "aria-hidden": "true" });
    document.body.appendChild(flareEl);
    const isBossLevel = puzzle => !!(puzzle && puzzle.mode === "campaign" && data.playing && data.playing.level === 5);
    const fightOn = () => !!(fight && !fight.over && U.view() === "level" && isBossLevel(Game.state.puzzle) && !Game.state.solved);
    const boardArea = () => document.querySelector(".board-area");
    const portraitEl = () => panel.querySelector(".bp-portrait");
    const bossBoardEl = () => panel.querySelector(".bp-board-wrap");

    async function startFight(fresh) {
        const key = data.playing.special ? "sp-" + data.playing.sid : keyOf(data.playing.world, data.playing.level);
        if (!fresh && fight && fight.key === key) { showPanel(); return; }
        await fetchMap().catch(() => null);
        const c = current(), d = c && c.difficulty ? c.difficulty : "medium";
        const th = Powers.threat(c ? c.si : 0, map ? map.length : 15);
        const botTime = botTimeFor(d, c ? c.size : 5, c ? c.si : 0);
        panel.classList.remove("ko");                    // the last boss you beat stays down; this one starts fresh
        fight = { key, id: Date.now(), world: data.playing.world, th, puzzle: null, letters: null, queue: [], word: null, acc: 0,
            botTime, si: c ? c.si : 0, closest: 0, lead: 0, drips: [], done: [], boss: {}, me: {}, buff: {}, nextMove: th.first, moveIdx: 0, over: false, rate: 1, used: 0,
            combo: 0, bestCombo: 0, lastWordAt: -1e9, pending: null, windup: 0, windupMax: 1, enraged: false, intro: false, phase: 1, phases: special() ? 1 : 1 + laterPhases(c && map ? map[c.si] : null).length, next: {}, switching: false,
            log: [], myLog: [], hits: 0, blocks: 0, itemsUsed: 0, kinds: new Set(), extraLife: false, lifeUsed: false, thorns: null, snow: null };
        drawPanel(true);
        try {
            if (!bossFetch || bossFetch.world !== data.playing.world || bossFetch.v !== (special() ? "sp" + data.playing.sid : tryOf(data.playing.world, 5))) prefetchBoss(data.playing.world);
            const pre = bossFetch;
            waiting(true);                                    // cover the board until the boss is ready
            const p = await pre.board;
            if (!fight || fight.key !== key) return;
            waiting(false);
            setBossPuzzle(p, p.seed);
            drawPanel(true);
            // the later phases' puzzles, fetched now so each is ready when the one before is solved
            const myFight = fight, world = data.playing.world;
            fight.fetches = pre.phases;
            for (const [k, pr] of Object.entries(pre.phases)) {
                pr.then(pz => { if (fight === myFight) myFight.next[k] = Object.assign(pz, { mode: "campaign", world, level: 5, phase: +k }); }).catch(() => null);
            }
            Sound.preload(Powers.ALL_SAMPLES);
            if (fresh !== false && U.view() === "level" && !Game.state.solved) {
                fight.intro = true;
                // each boss has its own song: it starts with the song's own intro, then loops its fight section (audio/CREDITS.txt)
                Sound.music(fight.world, { v: 0.4, fade: 0.3 });
                if (fight.phases > 1) setTimeout(() => fight && Sound.preloadMusic(fight.world + "-p2"), 9000);    // phase 2's song, ready in time
                await FX.cinematic(cc => Bosses.intro(cc, fight.world, { until: () => Sound.buildDone() }));
                if (fight) fight.intro = false;
                speak(bossOf(fight.world).taunt);
            }
            else if (fight && fightOn()) Sound.music(fight.world, { fade: 1.2, fromLoop: true });
        } catch (err) {
            waiting(false, "Couldn't load the boss's puzzle: " + err.message);
            const l = panel.querySelector(".bp-loading");
            if (l) l.textContent = "Couldn't load the boss's puzzle: " + err.message;
        }
    }
    // While the boss's puzzle is still coming: a cover over your board, no typing, and your clock waits
    const waitEl = U.el("div", { class: "boss-wait", hidden: true, html: `<span class="spinner" aria-hidden="true"></span><b>The boss is preparing its puzzle…</b><small>The fight starts as soon as it's ready.</small>` });
    document.querySelector(".board-wrap").appendChild(waitEl);
    function waiting(on, error) {
        waitEl.hidden = !on && !error;
        waitEl.classList.toggle("error", !!error);
        if (error) waitEl.querySelector("b").textContent = error;
        else waitEl.querySelector("b").textContent = "The boss is preparing its puzzle…";
        Game.holdClock(on);
    }
    // the boss's board: a fresh copy of a puzzle, its words in a random order
    function setBossPuzzle(p, seed) {
        const f = fight;
        f.puzzle = p;
        f.letters = p.solution.map(row => Array.from(row, ch => (ch === "." ? "." : "")));
        f.letterCount = p.solution.join("").replace(/\./g, "").length;
        const r2 = U.rng(seed);
        f.queue = [...p.across, ...p.down].map(e => ({ e, k: r2() })).sort((a, b) => a.k - b.k).map(x => x.e);
        f.done = [];
        f.word = null;
        f.acc = 0;
        f.log = [];
    }
    function showPanel() {
        panel.hidden = false;
        skipBtn.hidden = false;
        raceEl.hidden = false;
        raceShown = -1;
        raceFaceFor = "";
        document.getElementById("puzzle").classList.add("boss-mode");
        root.classList.add("in-boss");
        if (data.playing) Bosses.arena(data.playing.world, fight ? fight.id : data.playing.world);
    }
    function hidePanel() {
        panel.hidden = true;
        panel.classList.remove("ko");
        skipBtn.hidden = true;
        raceEl.hidden = true;
        if (!waitEl.hidden) waiting(false);
        meStatus.innerHTML = "";
        document.querySelectorAll(".bh-combo").forEach(el => el.remove());
        warnEl.hidden = true;
        document.getElementById("puzzle").classList.remove("boss-mode");
        root.classList.remove("in-boss", "boss-enraged");
        Bosses.enrage(false);
        clearMe();
    }

    function drawPanel(full) {
        if (!fight) return;
        showPanel();
        const b = bossOf(fight.world);
        panel.style.setProperty("--boss", b.color);
        if (full) {
            panel.innerHTML = `
                <div class="bp-stage"><div class="bp-portrait">${bossSvg(fight.world)}</div><div class="bp-speech" hidden></div><div class="bp-windup" hidden><i></i><span></span></div></div>
                <div class="bp-who"><small>BOSS · ${U.esc(Worlds.byId[fight.world].name.toUpperCase())} · ${"💀".repeat(fight.th.stars)}</small><b></b><div class="bp-status"></div></div>
                <div class="bp-bar bp-race" title="The boss's progress on its own board"><i></i><span></span></div>
                <div class="bp-volume" title="Boss music volume: drag, or scroll the mouse wheel over it (also in Settings)"><button type="button" class="bp-vol-mute" aria-label="Boss music on or off"></button><input type="range" min="0" max="100" step="5" aria-label="Boss music volume"><output></output></div>
                <div class="bp-abilities"><small>YOUR MOVES</small><div class="bp-ab-row"></div></div>
                <div class="bp-board-wrap"><div class="bp-board"></div><div class="bp-fog" aria-hidden="true"></div><p class="bp-loading">The boss is getting ready…</p></div>`;
            // (the boss's clues aren't shown, or even written: the user, 2026-10-09, so its board costs nothing)
            panel.querySelector(".bp-who b").textContent = b.name;
            if (fight.phase >= 2) panel.querySelector(".bp-who b").appendChild(U.el("span", { class: "bp-phase", text: fight.phase === fight.phases && fight.phases > 2 ? "FINAL PHASE" : "PHASE " + fight.phase }));
            panel.classList.toggle("phase2", fight.phase >= 2);
            drawAbilityBar();
            wireVolume();
            if (fight.puzzle) {
                const p = fight.puzzle, board = panel.querySelector(".bp-board");
                panel.querySelector(".bp-loading").remove();
                board.style.setProperty("--size", p.size);
                fight.cells = p.solution.map((row, r) => Array.from(row, (ch, c) => {
                    const cell = U.el("div", { class: "bp-cell" + (ch === "." ? " block" : "") });
                    if (ch !== "." && p.numbers[r][c]) cell.appendChild(U.el("span", { class: "bp-num", text: p.numbers[r][c] }));
                    cell.appendChild(U.el("span", { class: "bp-ltr" }));
                    board.appendChild(cell);
                    return cell;
                }));
                fight.items = new Map();
                for (const [list, entries] of [[".bp-across", p.across], [".bp-down", p.down]]) {
                    const ol = panel.querySelector(list);
                    if (!ol) continue;
                    for (const e of entries) {
                        const li = U.el("li", {}, U.el("b", { text: e.number }), U.el("span", { text: e.clue }));
                        ol.appendChild(li);
                        fight.items.set(e, li);
                    }
                }
            }
        }
        drawFight();
    }
    // When the boss blocks your abilities or items, the buttons say so for as long as it lasts (the user, 2026-10-09):
    // Weed Wrap seals your abilities, its Umbrella bounces your next one, Firewall blocks your items
    function drawBlocks() {
        const f = fight;
        if (!f) return;
        const sealed = f.me.seal > 0, ward = !!f.boss.ward, locked = f.me.itemlock > 0;
        const mark = (btn, kind, text) => {
            let m = btn.querySelector(".ab-block");
            if (!kind) { if (m) m.remove(); btn.classList.remove("blocked", "warded"); return; }
            if (!m) { m = U.el("span", { class: "ab-block", "aria-hidden": "true" }, U.el("b"), U.el("small")); btn.appendChild(m); }
            m.className = "ab-block " + kind;
            btn.classList.toggle("blocked", kind !== "ward");
            btn.classList.toggle("warded", kind === "ward");
            const [t1, t2] = text;
            if (m.firstChild.textContent !== t1) m.firstChild.textContent = t1;
            if (m.lastChild.textContent !== t2) m.lastChild.textContent = t2;
        };
        panel.querySelectorAll(".bp-ab").forEach(btn => mark(btn, null));
        const box = panel.querySelector(".bp-abilities"), row = panel.querySelector(".bp-ab-row");
        if (box && row) {
            let banner = box.querySelector(".ab-ward-banner");
            if (ward && !banner) { banner = U.el("div", { class: "ab-ward-banner", html: "<b>UMBRELLA UP</b><span>your next ability bounces off it</span>" }); row.before(banner); }
            else if (!ward && banner) banner.remove();
            cover(row, sealed, "seal", "ABILITIES SEALED", sealed ? Math.ceil(f.me.seal) + `s · click ${7 - ((f.taps && f.taps.seal) || 0)}× to tear the weeds off` : "");
        }
        const items = document.querySelector(".cm-items");
        if (items) cover(items, locked && fightOn(), "firewall", "ITEMS BLOCKED", locked ? "Firewall · " + Math.ceil(f.me.itemlock) + `s · click ${7 - ((f.taps && f.taps.itemlock) || 0)}× to hack through` : "");
    }
    // a cover over a whole row of buttons, so they can't be seen or used while the boss blocks them
    function cover(row, on, kind, title, text) {
        let c = row.querySelector(":scope > .ab-cover");
        if (!on) { if (c) c.remove(); row.classList.remove("covered"); return; }
        if (!c) { c = U.el("div", { class: "ab-cover " + kind, "aria-live": "polite" }, U.el("b", { text: title }), U.el("small")); row.appendChild(c); }
        row.classList.add("covered");
        if (c.lastChild.textContent !== text) c.lastChild.textContent = text;
    }
    function drawAbilityBar() {
        const row = panel.querySelector(".bp-ab-row");
        if (!row || !fight) return;
        row.innerHTML = "";
        loadout().forEach((id, i) => {
            const a = abilityById[id], n = data.owned[id] || 0;
            const btn = U.el("button", { type: "button", class: "bp-ab", disabled: n <= 0, title: `${a.name}: ${a.desc} (key ${i + 1})`, style: { "--c": a.fx.color } },
                U.el("span", { class: "bp-ab-icon", text: a.icon }), U.el("b", { text: a.name }), U.el("small", { text: `×${n} · key ${i + 1}` }));
            btn.addEventListener("click", () => { btn.blur(); useAbility(id); });
            row.appendChild(btn);
        });
        if (!loadout().length) row.appendChild(U.el("p", { class: "bp-ab-none", text: "No abilities yet. Clear Level 1 and Level 3 of a world to unlock some." }));
    }
    const real = (r, c) => { const ch = fight.letters[r][c]; return !!ch && ch !== "." && ch !== BLOT; };
    // The boss music's volume, right in the fight (the user: "when you're in a boss you don't have to travel menus")
    function drawVolume() {
        const box = panel.querySelector(".bp-volume");
        if (!box) return;
        const on = Settings.get("sound") && Settings.get("bossMusic") !== false, v = Math.round((Settings.get("musicVolume") ?? 1) * 100);
        const range = box.querySelector("input");
        if (document.activeElement !== range) range.value = v;
        box.querySelector("output").textContent = on ? v + "%" : "off";
        box.querySelector(".bp-vol-mute").textContent = !on ? "🔇" : v === 0 ? "🔈" : v < 60 ? "🔉" : "🔊";
        box.classList.toggle("off", !on);
    }
    function wireVolume() {
        const box = panel.querySelector(".bp-volume");
        if (!box) return;
        const range = box.querySelector("input");
        const set = v => {
            Settings.set("musicVolume", U.clamp(v, 0, 100) / 100);
            if (v > 0 && Settings.get("bossMusic") === false) Settings.set("bossMusic", true);     // turning it up turns the music back on
            drawVolume();
        };
        range.addEventListener("input", () => set(Number(range.value)));
        range.addEventListener("change", () => range.blur());                                   // back to typing on the board
        box.addEventListener("wheel", e => { e.preventDefault(); range.value = U.clamp(Number(range.value) + (e.deltaY < 0 ? 5 : -5), 0, 100); set(Number(range.value)); }, { passive: false });
        box.querySelector(".bp-vol-mute").addEventListener("click", e => { Settings.set("bossMusic", Settings.get("bossMusic") === false); drawVolume(); e.currentTarget.blur(); });
        drawVolume();
    }
    Settings.on(key => { if (key === "musicVolume" || key === "bossMusic" || key === "sound") drawVolume(); });
    function drawFight() {
        if (!fight || panel.hidden) return;
        const f = fight, g = Game.state;
        if (!panel.querySelector(".bp-race")) return;
        drawRace();
        const filled = f.letters ? f.letters.flat().filter(ch => ch && ch !== "." && ch !== BLOT).length : 0, pct = f.letterCount ? filled / f.letterCount : 0;
        setVar(panel.querySelector(".bp-race i"), "width", (pct * 100).toFixed(1) + "%");
        setText(panel.querySelector(".bp-race span"), `✎ Boss's board: ${Math.round(pct * 100)}% done`);
        const st = [];
        for (const [k, lbl] of Object.entries(BOSS_TIMERS)) {
            if (f.boss[k] > 0) st.push(`${lbl} ${Math.ceil(k === "crash" && f.boss.crash > 12 ? f.boss.crash - 12 : f.boss[k])}s`);
            panel.classList.toggle("st-" + k, f.boss[k] > 0);
        }
        if (f.boss.vines) st.push(`🌿 Vines ${Math.ceil(f.boss.vines.t)}s`);
        if (f.boss.buryN > 0) st.push(`🍂 ${f.boss.buryN} buried`);
        if (f.boss.junk > 0) st.push(`🖋️ ${f.boss.junk} blots`);
        if (f.boss.haunt) st.push("👻 Haunted page");
        if (f.boss.ward) st.push("☂️ Umbrella up");
        if (f.powerNext) st.push("🔴 Next attack ×2");
        if (f.ambush) st.push("🪶 Next attack: no warning");
        panel.classList.toggle("st-haunt", !!f.boss.haunt);
        panel.classList.toggle("st-calm", f.buff.calm > 0);
        if (f.enraged) st.push("😡 ENRAGED");
        setText(panel.querySelector(".bp-status"), st.join(" · ") || (f.puzzle ? "Solving…" : ""));
        panel.querySelector(".bp-fog").classList.toggle("on", f.boss.blind > 0);
        panel.classList.toggle("frozen", f.boss.freeze > 0);
        panel.classList.toggle("enraged", f.enraged);
        drawBlocks();
        // the wind-up warning, on the boss and over your board
        const wu = panel.querySelector(".bp-windup");
        if (f.pending) {
            const mv = f.pending, k = f.windup / f.windupMax;
            if (wu.hidden) wu.hidden = false;
            setVar(wu.querySelector("i"), "width", (k * 100).toFixed(1) + "%");
            setText(wu.querySelector("span"), `${mv.icon} ${mv.name}`);
            if (warnEl.hidden) warnEl.hidden = false;
            const it = INTERCEPT[mv.kind];
            const how = it && interceptEl ? `Counter: click the ${LOOK_NAME[it.look]}${it.hits > 1 ? ` ${it.hits}×` : ""} to turn it on the boss! Or finish a word to block it` : `Finish a word to block it${COUNTER[mv.kind] ? " · if it lands: " + COUNTER[mv.kind] : ""}`;
            if (!warnEl.firstChild) warnEl.innerHTML = `<b><span class="mw-name"></span> <em></em></b><span class="mw-how"></span><i></i>`;   // built once, then only its parts change
            setText(warnEl.querySelector(".mw-name"), `⚠ ${mv.icon} ${mv.name} incoming!`);
            setText(warnEl.querySelector("em"), f.windup.toFixed(1) + "s");
            setText(warnEl.querySelector(".mw-how"), how);
            setVar(warnEl.querySelector("i"), "width", (k * 100).toFixed(1) + "%");
            if (warnEl.title !== mv.desc) warnEl.title = mv.desc;
        } else { if (!wu.hidden) wu.hidden = true; if (!warnEl.hidden) warnEl.hidden = true; }
        if (!f.pending && interceptEl) removeIntercept();
        if (f.cells) {
            const vines = f.boss.vines ? f.boss.vines.cells : null, cur = f.word;
            const curCells = new Set(cur ? Game.cellsOf(cur).map(([r, c]) => r + "," + c) : []);
            f.letters.forEach((row, r) => row.forEach((ch, c) => {
                if (ch === ".") return;
                const cell = f.cells[r][c], id = r + "," + c;
                setText(cell._ltr || (cell._ltr = cell.querySelector(".bp-ltr")), ch);
                cell.classList.toggle("blot", ch === BLOT);
                cell.classList.toggle("vine", !!vines && vines.has(id));
                cell.classList.toggle("cur", curCells.has(id));
            }));
            for (const [e, li] of f.items) { li.classList.toggle("done", f.done.includes(e)); li.classList.toggle("active", e === cur); }
        }
        // your side: what helps you, what the boss is doing to you. The chips are kept (not rebuilt) while they stay,
        // so their pop-in animation plays once instead of restarting ten times a second
        const chips = [];
        if (f.me.shield) chips.push(["shield", "good", "📄 Shield up"]);
        if (f.me.reflect) chips.push(["reflect", "good", "🧁 Bounce ready"]);
        if (f.extraLife) chips.push(["life", "good", "🕹️ Extra life"]);
        for (const [k, lbl] of Object.entries(MY_BUFFS)) if (f.buff[k] > 0) chips.push(["b-" + k, "good", `${lbl} · ${Math.ceil(f.buff[k])}s`]);
        if (f.combo > 1) {
            const left = f.buff.lucky > 0 ? null : Math.max(0, (COMBO_GAP - (performance.now() - f.lastWordAt)) / 1000);
            chips.push(["combo", "combo", `🔥 Combo ×${f.combo}` + (left == null ? " · locked" : ` · ${Math.ceil(left)}s`), left == null ? 1 : left / (COMBO_GAP / 1000)]);
        }
        for (const [k, v] of Object.entries(f.me)) if (v > 0 && ME_TEXT[k]) chips.push(["m-" + k, "", `${ME_TEXT[k]} · ${Math.ceil(v)}s${COUNTER[k] && !INTERCEPT[k] ? " · " + COUNTER[k] : ""}`]);
        if (f.thorns) chips.push(["thorns", "", `🌹 Thorns · ${Math.ceil(f.thorns.t)}s · ${COUNTER.thorns}`]);
        if (f.gum) chips.push(["gum", "", `🫧 Gum: click it ${3 - f.gum.hits}× · ${Math.ceil(f.gum.t)}s`]);
        if (f.bombAt) chips.push(["bomb", "", `💣 Bomb! Type the right letter · ${Math.ceil(f.bombAt.t)}s`, f.bombAt.t / 8]);
        if (f.curse) chips.push(["curse", "", `🦂 Finish a word · ${Math.ceil(f.curse.t)}s`, f.curse.t / 15]);
        drawChips(chips);
    }
    function drawChips(chips) {
        const keep = new Set(chips.map(c => c[0]));
        for (const node of [...meStatus.children]) if (!keep.has(node.dataset.k)) node.remove();
        chips.forEach(([k, cls, text, bar], i) => {
            let node = meStatus.querySelector(`[data-k="${k}"]`);
            if (!node) { node = U.el("span", { class: "ms-chip " + cls, "data-k": k }, U.el("span", { class: "ms-text" }), U.el("i", { class: "ms-bar" })); }
            if (meStatus.children[i] !== node) meStatus.insertBefore(node, meStatus.children[i] || null);
            const t = node.querySelector(".ms-text");
            if (t.textContent !== text) t.textContent = text;
            setVar(node.querySelector(".ms-bar"), "width", bar == null ? "0" : (bar * 100).toFixed(1) + "%");
        });
    }
    // the boss says something, in a speech bubble by its portrait
    let speechTimer = 0;
    function speak(text, ms = 2600) {
        const el = panel.querySelector(".bp-speech");
        if (!el) return;
        el.textContent = text;
        el.hidden = false;
        U.restart(el, "pop");
        clearTimeout(speechTimer);
        speechTimer = setTimeout(() => { el.hidden = true; }, ms);
    }
    // a little "Defused!" (or "+2 letters") that floats up from the middle of the race bar
    function floatText(text, good = true) {
        const knot = raceEl.querySelector(".rb-knot"), at = !raceEl.hidden && knot ? U.center(knot) : U.center(boardArea());
        const el = U.el("div", { class: "bh-dmg small" + (good ? " good" : ""), text, style: { left: at.x + "px", top: at.y + "px" } });
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 1100);
    }

    // ---- the boss writes: one letter at a time, word by word, at a steady (slightly wobbly) pace ----
    function bossSpeed(f) {
        const b = f.boss;
        if (b.freeze > 0 || b.blind > 0 || b.bubble > 0 || b.dig > 0) return 0;
        if (b.crash > 0) return b.crash > 12 ? 2 : 0;                       // Sugar Crash: 3s at double speed, then nothing
        if (b.stutter > 0 && b.stutter % 3 > 1.9) return 0;                   // Pollen Puff: a sneeze every 3 seconds
        if (b.hypno > 0 && performance.now() - lastKeyAt < 1000) return 0;   // Juggling Act: it watches you type
        let s = f.rate * (f.enraged ? f.th.rageSpeed : CATCH_UP(f.lead)) * (b.haste > 0 ? 2 : 1);
        if (b.slow > 0) s *= 0.33;
        if (b.quick > 0) s /= 1 + 0.18 * (f.quickN || 0);                    // Quicksand: slower with every letter
        return s;
    }
    function botStep(dt) {
        const f = fight;
        if (!f.puzzle) return;
        const b = f.boss;
        for (const k of Object.keys(BOSS_TIMERS)) if (b[k] > 0) { b[k] = Math.max(0, b[k] - dt); if (b[k] === 0) bossTimerEnded(k); }
        if (b.vines && (b.vines.t -= dt) <= 0) b.vines = null;
        if (b.reverse > 0) {                                                   // Time Reversal: it un-writes instead
            f.revAcc = (f.revAcc || 0) + dt;
            while (f.revAcc >= 1) { f.revAcc -= 1; unwriteOne(); }
            return;
        }
        const speed = bossSpeed(f);
        if (!speed) return;
        f.acc += f.letterCount / f.botTime * speed * dt;
        while (f.acc >= 1) {
            f.acc -= 1;
            if (bossTick()) return;
        }
    }
    const vineBlocked = e => { const v = fight.boss.vines; return !!v && Game.cellsOf(e).some(([r, c]) => v.cells.has(r + "," + c) && !real(r, c)); };
    // one letter's worth of work; true when the boss has finished its board
    function bossTick() {
        const f = fight, b = f.boss;
        if (!f.word) {
            f.word = f.queue.find(e => !f.done.includes(e) && !vineBlocked(e)) || null;
            f.rate = 0.75 + Math.random() * 0.5;
            if (!f.word) return false;
            if (b.buryN > 0) {                                                   // Leaf Pile: dig the clue out first
                b.buryN--;
                b.dig = 4;
                Powers.aura(bossBoardEl(), ["🍂", "🍁"], "fall", 8, 1400);
                return false;
            }
        }
        if (vineBlocked(f.word)) { f.word = null; return false; }
        const cells = Game.cellsOf(f.word), empty = cells.find(([r, c]) => !f.letters[r][c]);
        if (empty) write(empty);
        else {
            const blot = cells.find(([r, c]) => f.letters[r][c] === BLOT);
            if (blot) {                                                          // rub an ink blot out (it writes the letter next time)
                f.letters[blot[0]][blot[1]] = "";
                if (f.cells) U.restart(f.cells[blot[0]][blot[1]], "shake");
                return false;
            }
        }
        if (cells.every(([r, c]) => real(r, c))) {
            const e = f.word;
            f.word = null;
            refreshDone();
            finishedWord(e);
            if (f.done.length === f.puzzle.across.length + f.puzzle.down.length) { lose("boss"); return true; }
        }
        return false;
    }
    function write([r, c]) {
        const f = fight, b = f.boss, cell = f.cells && f.cells[r][c];
        if (b.junk > 0) { b.junk--; f.letters[r][c] = BLOT; if (cell) U.restart(cell, "pop"); return; }
        if (b.sand > 0 && Math.random() < 0.5) { if (cell) U.restart(cell, "blown"); return; }            // written, then blown away
        f.letters[r][c] = f.puzzle.solution[r][c];
        f.log.push([r, c]);
        if (cell) U.restart(cell, "pop");
        if (b.quick > 0) f.quickN = (f.quickN || 0) + 1;
        if (b.ghost > 0 && (f.ghostN || 0) < 6) { f.ghostN = (f.ghostN || 0) + 1; Game.giveLetters(1); Powers.aura(boardArea(), ["👻"], "drift", 2, 1000); }
    }
    // a word on the boss's board was just finished: traps go off
    function finishedWord(e) {
        const f = fight, b = f.boss;
        if (b.haunt) {
            b.haunt = false;
            wipe(Game.cellsOf(e), true);
            Powers.aura(bossBoardEl(), ["👻", "💨"], "drift", 10, 1400);
            Sound.custom(Powers.ABILITIES.find(a => a.kind === "haunt").sound);
            speak("My word! Where did it go?!", 2200);
            return;
        }
        if (b.lava > 0) {
            wipe([Game.cellsOf(e)[0]], true);
            Powers.aura(bossBoardEl(), ["🔥"], "rise", 6, 1000);
            return;
        }
        if (Math.random() < 0.35) speak(U.pick(["Ha! Another one!", "Too easy.", "Catch up, if you can!", "Done. Next!"]), 1800);
    }
    // the boss's finished words, in the order it finished them
    function refreshDone() {
        const f = fight, full = e => Game.cellsOf(e).every(([r, c]) => real(r, c));
        f.done = f.done.filter(full);
        for (const e of [...f.puzzle.across, ...f.puzzle.down]) if (!f.done.includes(e) && full(e)) f.done.push(e);
    }
    // wipe letters on the boss's board. force: even letters of other finished words (they stop being finished)
    function wipe(cells, force = false) {
        const f = fight;
        let n = 0;
        for (const [r, c] of cells) {
            if (!f.letters[r][c] || f.letters[r][c] === ".") continue;
            if (!force && f.done.some(e => Game.cellsOf(e).some(([r2, c2]) => r2 === r && c2 === c))) continue;
            f.letters[r][c] = "";
            n++;
            if (f.cells) { f.cells[r][c].querySelector(".bp-ltr").textContent = ""; U.restart(f.cells[r][c], "shake"); }
        }
        refreshDone();
        if (f.word && !Game.cellsOf(f.word).some(([r, c]) => f.letters[r][c])) f.word = null;
        return n;
    }
    function unwriteOne() {
        const f = fight;
        while (f.log.length) {
            const [r, c] = f.log.pop();
            if (real(r, c)) { wipe([[r, c]], true); return; }
        }
    }
    const bossFilled = () => fight.letters.flatMap((row, r) => row.map((ch, c) => [r, c])).filter(([r, c]) => real(r, c));
    function bossTimerEnded(k) {
        const f = fight;
        if (k === "worm") {                                                     // the wormhole closes: what went in is gone
            const cells = f.log.slice(f.wormFrom || 0);
            const n = wipe(cells, true);
            Powers.aura(bossBoardEl(), ["🌀", "✨"], "swirl", 12, 1400);
            if (n) speak(`${n} letters... sucked away!`, 2000);
        }
        if (k === "bubble") Powers.aura(bossBoardEl(), ["💥", "🫧"], "pop", 8, 900);
        if (k === "crash") speak("Ugh... I need a nap...", 1800);
    }

    // ---- your right words push the race: a glowing shot from the word into the race bar, combos, Super ----
    function onWord({ entry, cells, right }) {
        if (!fightOn() || !fight.puzzle) return;
        const f = fight, now = performance.now();
        // A word only hits the boss when it's RIGHT, and only the first time (no combos from typing random letters,
        // or from erasing a right word and typing it again)
        const id = Game.state.puzzle.seed + ":" + entry.direction + entry.number;
        if (!right || (f.credited || (f.credited = new Set())).has(id)) return;
        f.credited.add(id);
        f.combo = f.me.comboban > 0 ? 1 : f.buff.lucky > 0 || now - f.lastWordAt < COMBO_GAP ? f.combo + 1 : 1;
        f.myWords = (f.myWords || 0) + 1;
        f.lastMyWord = cells;
        if (f.curse) { f.curse = null; bossLose(2); floatText("Cured! The poison flows back into the boss 🦂", true); }
        counterOnWord();
        if (f.me.toll > 0) { bossGain(2); floatText("+2 letters for the boss ♨️", false); }     // Scorched Earth: your words feed it
        f.lastWordAt = now;
        f.bestCombo = Math.max(f.bestCombo, f.combo);
        if (f.buff.sun > 0) growLetter(cells);                               // Sunny Hour: a right letter grows somewhere else
        if (f.buff.hot > 0) { f.boss.freeze = Math.max(f.boss.freeze || 0, 2); Powers.aura(portraitEl(), ["🔥"], "rise", 6, 900); }
        if (f.boss.bubble > 0) { f.boss.bubble = 0; bossTimerEnded("bubble"); speak("My bubble popped!", 1600); }
        // blocked an attack that was winding up?
        if (f.pending) {
            const mv = f.pending;
            f.pending = null;
            f.windup = 0;
            f.blocks++;
            Bosses.cutin(f.world, "BLOCKED!", `${mv.name} was stopped`, { good: true });
            Sound.sample("jingle-block", { v: 0.45 });
            speak(U.pick(["What?! Blocked?", "Grr... lucky!", "Not fair!"]));
        }
        const els = cells.map(([r, c]) => Game.cellEl(r, c)).filter(Boolean);
        const pts = els.map(el => U.center(el));
        const from = pts.length ? { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length } : U.center(boardArea());
        // your word flies up into the race bar and pushes it along
        const knot = raceEl.querySelector(".rb-knot"), portrait = portraitEl();
        const to = !raceEl.hidden && knot ? U.center(knot) : portrait ? U.center(portrait) : from;
        const land = () => {
            if (knot) U.restart(knot, "push");
            if (portrait) U.restart(portrait, "hit");
            FX.burst({ x: to.x, y: to.y, n: 16 + f.combo * 4, colors: ["#fff", "#ffd23f", bossOf(f.world).color], shape: "star", speed: [120, 340], gravity: 260, life: [0.4, 0.8], size: [3, 6] });
            Sound.play("thud");
            Sound.sample("hit", { v: 0.45 + Math.min(0.3, f.combo * 0.05), rate: 1 + Math.min(0.3, (f.combo - 1) * 0.06) });
        };
        if (U.motion() === "still") land();
        else {
            const shot = U.el("div", { class: "bh-orb" + (f.combo > 2 ? " big" : "") });
            document.body.appendChild(shot);
            shot.animate([{ transform: `translate(${from.x}px, ${from.y}px) scale(.5)` }, { transform: `translate(${(from.x + to.x) / 2}px, ${Math.min(from.y, to.y) - 120}px) scale(1.3)` }, { transform: `translate(${to.x}px, ${to.y}px) scale(1)` }],
                { duration: 480, easing: "cubic-bezier(.5,0,.8,.6)" }).onfinish = () => { shot.remove(); land(); };
        }
        if (f.combo > 1) comboPop(f.combo);
        updateHp();
        drawFight();
    }
    // Sugar Rush: the first letter of n of your unfinished words (the ones that are still wrong or empty there)
    function firstLetters(n) {
        const g = Game.state, picks = [];
        for (const e of [...g.puzzle.across, ...g.puzzle.down].sort(() => Math.random() - 0.5)) {
            const cells = Game.cellsOf(e), [r, c] = cells[0];
            if (cells.every(([r2, c2]) => g.letters[r2][c2] === g.puzzle.solution[r2][c2])) continue;
            if (g.letters[r][c] === g.puzzle.solution[r][c] || picks.some(([r2, c2]) => r2 === r && c2 === c)) continue;
            picks.push([r, c]);
            if (picks.length >= n) break;
        }
        return picks;
    }
    // Sunny Hour: a right letter grows in an empty square that isn't in the word you just finished
    function growLetter(skip) {
        const g = Game.state, not = new Set((skip || []).map(([r, c]) => r + "," + c));
        const empty = scopeAll().filter(([r, c]) => !g.letters[r][c] && !not.has(r + "," + c));
        if (!empty.length) return;
        const [r, c] = U.pick(empty);
        setTimeout(() => { if (fightOn()) { Game.fillCells([[r, c]]); Powers.aura(Game.cellEl(r, c), ["🌱", "🌼"], "rise", 4, 900); } }, 350);
    }
    // the boss writes n letters at once (it can win that way)
    function bossGain(n) {
        const f = fight;
        for (let i = 0; i < n; i++) { const empty = bossNextEmpty(); if (!empty) break; write(empty); }
        refreshDone();
        if (f.done.length === f.puzzle.across.length + f.puzzle.down.length) lose("boss");
    }
    // how far along each side is, 0 to 1: you = right letters on your board, the boss = letters on its board
    const myPct = () => { const { right, total } = Game.progress(); return total ? right / total : 0; };
    const bossPct = () => fight && fight.letterCount ? fight.letters.flat().filter(ch => ch && ch !== "." && ch !== BLOT).length / fight.letterCount : 0;
    // the combo pop: next to the timer, never over the board (one at a time: two words finished by one letter show the final count)
    function comboPop(n) {
        document.querySelectorAll(".bh-combo").forEach(el => el.remove());
        const el = U.el("div", { class: "bh-combo" + (n >= 5 ? " hot" : ""), html: `<small>COMBO</small><b>×${n}</b>` });
        document.querySelector(".hud-row").appendChild(el);
        Sound.play("tile", Math.min(8, n + 2));
        setTimeout(() => el.remove(), 1200);
    }
    // who's ahead in the race; far behind, the boss gets angry (not while it's calmed)
    function updateHp() {
        const f = fight;
        if (!f || !f.puzzle) return;
        f.lead = myPct() - bossPct();
        if (!f.enraged && !(f.buff.calm > 0) && f.lead >= RAGE_LEAD && !Game.state.solved && !f.switching) {
            f.enraged = true;
            root.classList.add("boss-enraged");
            Bosses.enrage(true);
            Bosses.cutin(f.world, "ENRAGED!", f.th.double ? "Faster, angrier, and it chains its attacks now" : "It's faster and angrier now");
            Sound.play("boom");
            FX.shake(10, 500);
            speak("ENOUGH! Now I'm angry!", 3000);
            f.nextMove = Math.min(f.nextMove, 6);
        }
    }
    function setEnraged(on) {
        fight.enraged = on;
        root.classList.toggle("boss-enraged", on);
        Bosses.enrage(on);
    }

    // ---- your abilities ----
    // why an ability can't be used right now (null: it can)
    function cantUse(a) {
        const f = fight, g = Game.state;
        const myBad = Object.values(f.me).some(v => v > 0 && v !== true) || f.thorns;
        switch (a.kind) {
            case "erase": case "scatter": return f.done.length ? null : "The boss hasn't finished a word yet.";
            case "knock": case "undo": case "chomp": case "blackhole": return bossFilled().length ? null : "The boss's board is still empty.";
            case "cleanse": return myBad ? null : "The boss isn't doing anything to you right now.";
            case "shield": return f.me.shield ? "Your shield is already up." : null;
            case "reflect": return f.me.reflect ? "Your bounce is already ready." : null;
            case "extralife": return f.extraLife ? "You already have an extra life." : null;
            case "haunt": return f.boss.haunt ? "The boss's next page is already haunted." : null;
            case "calm": return f.buff.calm > 0 ? "The boss is already calm." : null;
            case "check": return Game.wrongCells().length ? null : "No wrong letters on your board.";
            case "autofill": return autoFillCells().length ? null : "No word is just one letter from done.";
            case "cheat": { const e = currentMyEntry(); return e && Game.cellsOf(e).some(([r, c]) => g.letters[r][c] !== g.puzzle.solution[r][c]) ? null : "Your selected word is already right."; }
            default: return null;
        }
    }
    const currentMyEntry = () => { const g = Game.state; if (!g.acrossAt) return null; const a = g.acrossAt[g.row][g.col], d = g.downAt[g.row][g.col]; return g.direction === "across" ? a || d : d || a; };
    function autoFillCells() {
        const g = Game.state, out = [];
        for (const e of [...g.puzzle.across, ...g.puzzle.down]) {
            const wrong = Game.cellsOf(e).filter(([r, c]) => g.letters[r][c] !== g.puzzle.solution[r][c]);
            if (wrong.length === 1 && !out.some(([r, c]) => r === wrong[0][0] && c === wrong[0][1])) out.push(wrong[0]);
        }
        return out.slice(0, 4);
    }
    async function useAbility(id) {
        const a = abilityById[id];
        if (!a || !fightOn() || !fight.puzzle || fight.intro || (data.owned[id] || 0) <= 0) return;
        const why = fight.me.seal > 0 ? "Your abilities are wrapped in weeds for a few seconds." : cantUse(a);
        if (why) { FX.toast({ icon: a.icon, kicker: "NOT NOW", title: a.name, text: why, ms: 2200 }); Sound.play("wrong"); return; }
        data.owned[id]--;
        save();
        const f = fight;
        f.used++;
        f.kinds.add(a.kind);
        drawAbilityBar();
        const castP = Powers.cast(a, { fromEl: boardArea(), bossEl: portraitEl(), bossBoard: bossBoardEl() });
        if (a.fx.on !== "me") await castP;                       // effects on the boss happen when the shot lands
        if (fight !== f || f.over) return;
        if (f.boss.ward && a.fx.on !== "me") {                   // Umbrella: this one bounces off
            f.boss.ward = 0;
            Bosses.cutin(f.world, "BLOCKED!", `${a.name} bounced off its umbrella`);
            speak("Ha! Nice try.", 1800);
            drawFight();
            return;
        }
        const portrait = portraitEl();
        if (portrait) U.restart(portrait, a.fx.on === "me" ? "buff" : "hit");
        const bossBefore = f.letters.map(r => [...r]), myBefore = Game.state.letters.map(r => [...r]);
        applyAbility(a);
        // the big effect (spells.js), aimed at the squares this ability just changed
        if (a.fx.on === "me") Spells.play(a.kind, { cells: myChanges(myBefore), area: document.getElementById("board"), from: U.center(boardArea()), to: U.center(document.getElementById("board")) });
        else Spells.play(a.kind, { cells: bossChanges(bossBefore), area: bossBoardEl(), from: U.center(boardArea()), to: U.center(bossBoardEl()) });
        if (a.fx.on !== "me" && Math.random() < 0.7) speak(U.pick(["Ow!", "Hey! Cut that out!", "Argh!", "My board!", "You'll pay for that!"]), 1800);
        updateHp();
        drawFight();
    }
    function applyAbility(a) {
        const f = fight, b = f.boss, g = Game.state;
        const max = (k, v) => { b[k] = Math.max(b[k] || 0, v); };
        switch (a.kind) {
            case "junk": b.junk = (b.junk || 0) + 5; break;
            case "erase": { const last = f.done[f.done.length - 1]; if (last) wipe(Game.cellsOf(last)); break; }
            case "shield": f.me.shield = 1; break;
            case "stutter": max("stutter", 15); break;
            case "vines": {
                const open = f.letters.flatMap((row, r) => row.map((ch, c) => [r, c, ch])).filter(([, , ch]) => ch === "").map(([r, c]) => r + "," + c);
                const pick = open.sort(() => Math.random() - 0.5).slice(0, 4);
                b.vines = { cells: new Set(pick), t: 20 };
                if (f.word && vineBlocked(f.word)) f.word = null;
                break;
            }
            case "sun": f.buff.sun = 30; break;
            case "knock": wipe(bossFilled().sort(() => Math.random() - 0.5).slice(0, 3), true); break;
            case "bury": b.buryN = (b.buryN || 0) + 3; break;
            case "hint": Game.giveLetters(2); break;
            case "slow": max("slow", 10); break;
            case "super": Game.fillCells(firstLetters(3)); break;                  // Sugar Rush: the first letters of 3 words
            case "reflect": f.me.reflect = 1; break;
            case "cleanse": f.me = { shield: f.me.shield, reflect: f.me.reflect }; f.thorns = null; clearMe(true); break;
            case "bubble": max("bubble", 15); break;
            case "undo": { let n = 0; while (f.log.length && n < 4) { const [r, c] = f.log.pop(); if (real(r, c)) { wipe([[r, c]], true); n++; } } break; }
            case "freeze": max("freeze", 6); break;
            case "delay": f.nextMove += 30; break;
            case "armor": f.buff.armor = 40; break;
            case "wash": {                                      // the unfinished words' letters, up to 6 (newest first)
                const inDone = new Set(f.done.flatMap(e => Game.cellsOf(e).map(([r, c]) => r + "," + c)));
                const loose = f.log.filter(([r, c]) => real(r, c) && !inDone.has(r + "," + c)).reverse().slice(0, 6);
                wipe(loose);
                f.word = null;
                break;
            }
            case "counter":
                if (f.pending) { Bosses.cutin(f.world, "COUNTERED!", `${f.pending.name} was cancelled`, { good: true }); f.pending = null; f.windup = 0; max("freeze", 4); }
                else max("freeze", 2);
                break;
            case "lucky": f.buff.lucky = 30; f.combo += 2; f.bestCombo = Math.max(f.bestCombo, f.combo); f.lastWordAt = performance.now(); comboPop(f.combo); break;
            case "scatter": wipe(f.done.slice(-4).map(e => U.pick(Game.cellsOf(e))), true); break;
            case "silver": f.buff.silver = 40; break;
            case "time": f.buff.tailwind = 30; break;                        // Tailwind: right letters you type are held in place
            case "sand": max("sand", 12); break;
            case "quicksand": max("quick", 20); f.quickN = 0; break;
            case "check": Game.markWrong(); break;
            case "blind": {
                max("blind", 8);
                if (f.word) { wipe(Game.cellsOf(f.word)); f.word = null; }
                break;
            }
            case "hypno": max("hypno", 12); break;
            case "crash": max("crash", 15); break;
            case "chomp": chomp(); break;
            case "cheat": flashAnswer(currentMyEntry()); break;
            case "extralife": f.extraLife = true; break;
            case "autofill": Game.fillCells(autoFillCells()); break;
            case "overclock": f.buff.overclock = 15; f.ocN = 0; break;      // up to 5 letters
            case "firewall": f.buff.firewall = 30; if (f.pending) { f.windup *= 2; f.windupMax *= 2; } break;
            case "calm": f.buff.calm = 30; if (f.enraged) { setEnraged(false); speak("...fine. I'll be quiet.", 2000); } break;
            case "haunt": b.haunt = true; break;
            case "ghost": max("ghost", 12); f.ghostN = 0; break;
            case "hot": f.buff.hot = 20; break;
            case "lavafloor": max("lava", 15); break;
            case "fireup": f.buff.fireup = 20; break;                               // Fire Up: wrong letters burn away as you type
            case "blackhole": {                                 // the 5 letters nearest the middle
                const m = (f.puzzle.size - 1) / 2;
                wipe(bossFilled().sort((a, b2) => Math.hypot(a[0] - m, a[1] - m) - Math.hypot(b2[0] - m, b2[1] - m)).slice(0, 5), true);
                break;
            }
            case "reverse": max("reverse", 6); f.revAcc = 0; break;
            case "wormhole": max("worm", 10); f.wormFrom = f.log.length; break;
        }
        if (g.solved) return;
    }
    // the squares that changed since a snapshot, with their old letters (for the spells)
    function bossChanges(before) {
        const f = fight, out = [];
        before.forEach((row, r) => row.forEach((ch, c) => { if (ch && ch !== "." && ch !== BLOT && f.letters[r][c] !== ch && f.cells) out.push({ el: f.cells[r][c], ch }); }));
        return out;
    }
    function myChanges(before) {
        const g = Game.state, out = [];
        before.forEach((row, r) => row.forEach((ch, c) => { if (g.letters[r][c] !== ch) out.push({ el: Game.cellEl(r, c), ch: ch || g.letters[r][c] }); }));
        return out;
    }
    // Chomper: a pixel monster eats along the boss's board in a zigzag, one square at a time
    function chomp() {
        const f = fight, n = f.puzzle.size, path = [];
        const startTop = Math.random() < 0.5;
        for (let i = 0; i < n; i++) {
            const r = startTop ? i : n - 1 - i;
            for (let j = 0; j < n; j++) path.push([r, i % 2 ? n - 1 - j : j]);
        }
        let eaten = 0, step = 0;
        const t = setInterval(() => {
            if (fight !== f || f.over || eaten >= 5 || step >= path.length) { clearInterval(t); return; }
            const [r, c] = path[step++];
            const cell = f.cells && f.cells[r][c];
            if (cell && !cell.classList.contains("block")) {
                cell.classList.add("chomped");
                setTimeout(() => cell.classList.remove("chomped"), 250);
            }
            if (real(r, c)) { wipe([[r, c]], true); eaten++; Sound.tone({ f: eaten % 2 ? 300 : 500, f2: 200, type: "square", d: 0.07, v: 0.04 }); }
            drawFight();
        }, 70);
    }
    // Cheat Code: the answer appears over your selected word for a moment
    function flashAnswer(e) {
        const g = Game.state;
        if (!e) return;
        for (const [r, c] of Game.cellsOf(e)) {
            const cell = Game.cellEl(r, c);
            if (!cell || g.letters[r][c] === g.puzzle.solution[r][c]) continue;
            const ghost = U.el("span", { class: "cheat-ltr", text: g.puzzle.solution[r][c] });
            cell.appendChild(ghost);
            setTimeout(() => ghost.remove(), 2500);
        }
    }
    // ---- the boss's turn to be mean: first a wind-up (finish a word to block it), then the attack lands ----
    // Each boss has 5 moves (the user asked for 5, all of them doing something that really hurts); it picks one at
    // random, never the same one twice in a row.

    // ---------------------------------------------------------------------------------------------
    // Counterplay (the user, 2026-10-09: "add additional counterplay to every boss ability", e.g. "click the solar
    // flare before it activates to cancel it and blind the boss instead", "words on the bottom of the board limit how
    // far a flash flood goes up"). Besides blocking with a word, every move has its own way to fight back:
    //   - INTERCEPTS: during the wind-up a drawn target appears; click it in time and the move is cancelled and
    //     turned back on the boss
    //   - your progress protects you: finished (right) words resist the move
    //   - once it lands, you can break it: brush snow off, cut thorns, wipe ink, repair glitched letters...
    // ---------------------------------------------------------------------------------------------
    // what to do about each move (shown on the warning and on the effect's chip)
    const COUNTER = {
        rubout: "click the eraser to snatch it", crumple: "finished words don't fold · click a fold to smooth it", inkblot: "click the blot 6× to wipe it",
        nobackspace: "click the marker cap to put it back on", fakecheck: "click a falsely marked square to expose the lie",
        thorns: "click a thorn 4× to cut it", petals: "click the clue list 6× to sweep the petals", minion: "click the aphid to send it back",
        drain: "finish 2 words to water your board", seal: "click the weeds 7× to tear them off",
        hoot: "click a clue to unscramble it", acorns: "click the branch to drop the acorns on the owl", darkcreep: "every word you finish pushes the night back a little",
        ambush: "catch the falling feather", steal: "slap the paw away",
        sour: "letters in finished words stay visible", sticky: "double-click the board twice to come unstuck", jitter: "the more you solve, the steadier it gets",
        bubble: "click the gum 3× to pop it", fumble: "squares in finished words never slip",
        ink: "click the board to wipe the ink away", whirl: "click the whirlpool to plug it", tidal: "each finished Across row steadies it a third: 3 rows stop it",
        backwards: "the riptide can't pull you back past a right letter", shrink: "click the board 6× to push the pressure back",
        freeze: "smash the icicle (3 clicks)", whiteout: "click a snowy square to brush it off", avalanche: "finished words never get buried",
        slowmo: "every right letter you type warms your fingers a little", shatter: "click the board to fit the pieces back",
        lightning: "click the spark to ground it", downpour: "finish the word, or click a running letter to save it",
        halffog: "each finished Across word in the bottom half holds it back a third: 3 rows stop it", quake: "letters in finished words can't shake loose", ward: "click the boss 5× to tear its umbrella",
        gale: "click the gust to break it up", twister: "it can't spin you inside a half-solved word", upside: "double-click the board twice to flip it back",
        flicker: "click a cloud to blow it away", haste: "click the wings to clip them",
        riddle: "click a clue to read it the right way round", sandblast: "plug the sand jet (2 clicks)", mirageclue: "click the clue bar to dispel the mirage",
        shift: "click the word within 6s to slide it back", curse: "finish a word to cure it and poison the boss",
        mirror: "double-click the board twice to break the mirror", confetti: "click a pile to sweep it away", clueswap: "click a clue to put it back",
        bomb: "type its right letter to defuse it and throw it back", taunt: "finish the word to break free",
        glitch: "click a glitched square to repair it", lag: "click the loading wheel 3×", comboban: "finish 2 words within 5s to break the ban",
        echo: "echoes can't overwrite right letters", mask: "click a letter to decode it",
        haunting: "click a ghost letter to banish it", lights: "every word you finish brightens the light", fakeclue: "click the lying clue to expose it",
        wordthief: "click your word to hold it down", oneword: "click a torn clue to tape it back",
        lock: "finish the word to break the lock", static: "click the board 5× to clear the static", unlock: "hit Cancel on the reboot",
        itemlock: "click the firewall 7× to hack through", numberless: "finish 2 words to restore the numbers",
        eruption: "click the target 2× to cool the lava", heatwave: "finish 2 words to cool them down", powerup: "click the vent 3× to let the pressure out",
        heal: "click the lava stream 2× to block it", toll: "click the boss 5× to douse the fire",
        gravity: "click the board 6× to break the gravity well", flare: "click the flare before it bursts", collapse: "click the collapsing star 2×",
        snapfinish: "close the warp gate (2 clicks)", vowels: "vowels in finished words stay visible"
    };
    // the boss gets a taste of its own move
    const bossBlind = s => { fight.boss.blind = Math.max(fight.boss.blind || 0, s); };
    const bossStun = s => { fight.boss.freeze = Math.max(fight.boss.freeze || 0, s); };
    const bossSlow = s => { fight.boss.slow = Math.max(fight.boss.slow || 0, s); };
    const bossLose = n => { wipe(bossFilled().sort(() => Math.random() - 0.5).slice(0, n), true); refreshDone(); };
    const bossLoseWord = () => { const f = fight, e = f.word || f.done[f.done.length - 1]; if (e) wipe(Game.cellsOf(e), true); f.word = null; refreshDone(); };
    // squares in words you've got right (they resist some moves)
    const safeCells = () => (Game.state.puzzle ? doneCells() : new Set());
    // the rows that have a finished (right) Across word
    function doneAcrossRows() {
        const g = Game.state, rows = new Set();
        if (!g.puzzle) return rows;
        for (const e of g.puzzle.across) if (Game.cellsOf(e).every(([r, c]) => g.letters[r][c] === g.puzzle.solution[r][c])) rows.add(e.row);
        return rows;
    }
    // INTERCEPTS: where the target appears (a container and a spot in it, in %), what it looks like, how many clicks, the payback
    const ICON = {
        sun: '<circle cx="32" cy="32" r="14" fill="#fff6c0"/><g stroke="#ffd23f" stroke-width="5" stroke-linecap="round">' + Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4; return `<line x1="${32 + Math.cos(a) * 20}" y1="${32 + Math.sin(a) * 20}" x2="${32 + Math.cos(a) * 28}" y2="${32 + Math.sin(a) * 28}"/>`; }).join("") + '</g>',
        eraser: '<rect x="8" y="20" width="30" height="24" rx="5" fill="#ff9fb4" stroke="#2b2233" stroke-width="3"/><rect x="36" y="20" width="20" height="24" rx="3" fill="#4f86d9" stroke="#2b2233" stroke-width="3"/>',
        cap: '<rect x="20" y="10" width="24" height="40" rx="8" fill="#2b2233"/><rect x="24" y="14" width="6" height="30" rx="3" fill="#5a5070"/><rect x="18" y="46" width="28" height="8" rx="3" fill="#151020"/>',
        branch: '<path d="M4 20 Q32 12 60 22" stroke="#6b4219" stroke-width="6" fill="none" stroke-linecap="round"/><ellipse cx="22" cy="34" rx="7" ry="9" fill="#b5732e" stroke="#2b2233" stroke-width="2"/><path d="M14 28 Q22 20 30 28 Z" fill="#6b4219"/><ellipse cx="42" cy="36" rx="7" ry="9" fill="#b5732e" stroke="#2b2233" stroke-width="2"/><path d="M34 30 Q42 22 50 30 Z" fill="#6b4219"/>',
        feather: '<path d="M14 54 Q20 20 50 8 Q44 36 14 54 Z" fill="#f2ece4" stroke="#8a7a8a" stroke-width="2"/><path d="M14 54 L44 16" stroke="#8a7a8a" stroke-width="2"/>',
        paw: '<ellipse cx="32" cy="40" rx="14" ry="11" fill="#8a5a2b"/><circle cx="18" cy="24" r="6" fill="#8a5a2b"/><circle cx="28" cy="18" r="6" fill="#8a5a2b"/><circle cx="38" cy="18" r="6" fill="#8a5a2b"/><circle cx="47" cy="24" r="6" fill="#8a5a2b"/>',
        spiral: '<path d="M32 32 m0 -4 a4 4 0 1 1 -4 4 a8 8 0 1 1 8 8 a12 12 0 1 1 -12 -12 a16 16 0 1 1 16 16" stroke="#2a8fd6" stroke-width="5" fill="none" stroke-linecap="round"/>',
        icicle: '<path d="M14 8 L50 8 L44 16 L38 52 L32 18 L26 44 L20 16 Z" fill="#cfeeff" stroke="#7fbfe8" stroke-width="2"/>',
        spark: '<path d="M36 4 L14 36 L30 36 L24 60 L50 24 L34 24 Z" fill="#ffe066" stroke="#2b2233" stroke-width="2.5" stroke-linejoin="round"/>',
        swirl: '<path d="M8 24 Q28 8 48 20 Q60 28 48 34 Q38 38 40 30" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M6 42 Q26 32 44 42" stroke="#dfeaff" stroke-width="4" fill="none" stroke-linecap="round"/>',
        wings: '<path d="M32 32 Q14 10 4 18 Q8 30 32 36 Z" fill="#fff" stroke="#9aa3b5" stroke-width="2"/><path d="M32 32 Q50 10 60 18 Q56 30 32 36 Z" fill="#fff" stroke="#9aa3b5" stroke-width="2"/>',
        jet: '<rect x="6" y="22" width="30" height="20" rx="4" fill="#a8743a" stroke="#2b2233" stroke-width="2.5"/><rect x="34" y="26" width="16" height="12" fill="#c9a43a" stroke="#2b2233" stroke-width="2.5"/><circle cx="56" cy="28" r="2.5" fill="#d9a35c"/><circle cx="59" cy="34" r="2" fill="#d9a35c"/><circle cx="55" cy="38" r="2.5" fill="#ecc68e"/>',
        wheel: Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4; return `<circle cx="${32 + Math.cos(a) * 18}" cy="${32 + Math.sin(a) * 18}" r="5" fill="#2bf0ff" opacity="${0.25 + i * 0.1}"/>`; }).join(""),
        hand: '<path d="M18 56 L18 28 Q18 22 23 22 Q27 22 27 28 L27 14 Q27 9 31 9 Q35 9 35 14 L35 24 Q35 19 39 19 Q43 19 43 25 L43 30 Q43 26 47 26 Q51 26 51 32 L50 46 Q48 56 38 58 Z" fill="#effffa" stroke="#7fd8c0" stroke-width="2.5"/>',
        bar: '<rect x="4" y="20" width="56" height="24" rx="6" fill="#3f4855" stroke="#2b2233" stroke-width="2.5"/><rect x="8" y="26" width="26" height="12" rx="3" fill="#7ae0ff"/><text x="47" y="37" font-size="11" font-weight="900" text-anchor="middle" fill="#ff5c6c" font-family="sans-serif">X</text>',
        target: '<circle cx="32" cy="32" r="24" fill="#ff6a00" opacity=".25"/><circle cx="32" cy="32" r="22" fill="none" stroke="#ff3d00" stroke-width="4"/><circle cx="32" cy="32" r="12" fill="none" stroke="#ff3d00" stroke-width="4"/><circle cx="32" cy="32" r="4" fill="#ff3d00"/>',
        gauge: '<circle cx="32" cy="34" r="22" fill="#e8e2d8" stroke="#2b2233" stroke-width="3"/><path d="M14 34 A18 18 0 0 1 50 34" stroke="#ff3d00" stroke-width="5" fill="none"/><line x1="32" y1="34" x2="46" y2="22" stroke="#2b2233" stroke-width="4" stroke-linecap="round"/><rect x="26" y="6" width="12" height="8" fill="#8a95a3" stroke="#2b2233" stroke-width="2"/>',
        stream: '<path d="M32 4 Q46 26 46 40 A14 14 0 0 1 18 40 Q18 26 32 4 Z" fill="#ff7a1f" stroke="#7a1f0a" stroke-width="2.5"/><path d="M28 30 Q32 22 36 30" stroke="#ffe066" stroke-width="3" fill="none"/>',
        gate: '<ellipse cx="32" cy="32" rx="18" ry="24" fill="#1a0b3a" stroke="#c06bff" stroke-width="5"/><circle cx="28" cy="26" r="1.5" fill="#fff"/><circle cx="36" cy="38" r="1.5" fill="#fff"/><circle cx="32" cy="32" r="1" fill="#fff"/>',
        star: '<circle cx="32" cy="32" r="10" fill="#fff"/><circle cx="32" cy="32" r="18" fill="none" stroke="#c6b8ff" stroke-width="4" stroke-dasharray="6 5"/><circle cx="32" cy="32" r="26" fill="none" stroke="#8a6bff" stroke-width="2"/>',
        umbrella: '<path d="M8 30 Q32 2 56 30 Z" fill="#ff5c6c" stroke="#2b2233" stroke-width="2.5"/><path d="M32 30 L32 52 Q32 58 26 56" stroke="#2b2233" stroke-width="3" fill="none"/>'
    };
    const LOOK_NAME = { sun: "flare", eraser: "eraser", cap: "marker cap", branch: "branch", feather: "feather", paw: "paw", spiral: "whirlpool", icicle: "icicle",
        spark: "spark", swirl: "gust", wings: "wings", jet: "sand jet", wheel: "loading wheel", hand: "ghost hand", bar: "reboot bar", target: "target", gauge: "pressure gauge",
        stream: "lava stream", gate: "warp gate", star: "collapsing star", umbrella: "umbrella" };
    const INTERCEPT = {
        rubout: { look: "eraser", hits: 2, back: () => { bossLose(3); return "You snatched the eraser: the boss's board loses 3 letters"; } },
        nobackspace: { look: "cap", hits: 1, back: () => { fight.boss.junk = (fight.boss.junk || 0) + 3; return "Capped! Its next 3 letters come out as ink blots"; } },
        acorns: { look: "branch", hits: 2, back: () => { bossStun(3); return "The acorns land on the owl: stunned for 3s"; } },
        ambush: { look: "feather", hits: 1, back: () => { bossStun(1.5); return "Caught the feather: no sneak attack"; } },
        steal: { look: "paw", hits: 1, back: () => { bossLose(2); return "Slapped away! The boss drops 2 of its letters"; } },
        whirl: { look: "spiral", hits: 2, back: () => { bossLoseWord(); return "You plugged the whirlpool: it swallows the Kraken's own word"; } },
        freeze: { look: "icicle", hits: 3, back: () => { bossStun(3); return "Icicle smashed: the Yeti is frozen instead (3s)"; } },
        lightning: { look: "spark", hits: 1, back: () => { bossLoseWord(); return "Grounded! The lightning strikes the boss's own word"; } },
        gale: { look: "swirl", hits: 2, back: () => { bossBlind(3); return "Gust broken: the dust blows into the knight's eyes (3s)"; } },
        haste: { look: "wings", hits: 2, back: () => { bossSlow(5); return "Wings clipped: it writes at a third of its speed for 5s"; } },
        sandblast: { look: "jet", hits: 2, back: () => { fight.boss.sand = Math.max(fight.boss.sand || 0, 6); return "The sand blows back: its letters keep blowing away (6s)"; } },
        lag: { look: "wheel", hits: 3, back: () => { bossStun(3); return "The boss lags instead: frozen for 3s"; } },
        wordthief: { look: "hand", hits: 1, back: () => { const f = fight, e = f.done[f.done.length - 1]; if (e) wipe(Game.cellsOf(e), true); refreshDone(); return "You held your word down: the ghost throws the boss's word instead"; } },
        unlock: { look: "bar", hits: 1, back: () => { bossStun(4); return "Reboot cancelled: the robot reboots itself (4s)"; } },
        eruption: { look: "target", hits: 2, back: () => { bossLose(2); return "You cooled the lava: it splashes back on the wyrm (-2 letters)"; } },
        powerup: { look: "gauge", hits: 3, back: () => { bossStun(2); return "Pressure let out: the wyrm sputters (2s)"; } },
        heal: { look: "stream", hits: 2, back: () => { bossLose(2); return "You blocked the lava: it cools on the boss's own board (-2 letters)"; } },
        flare: { look: "sun", hits: 1, back: () => { bossBlind(4); return "The flare is turned back: the Void is blinded for 4s"; } },
        collapse: { look: "star", hits: 2, back: () => { bossLose(3); return "Stabilised! The collapse pulls 3 letters out of the boss instead"; } },
        snapfinish: { look: "gate", hits: 2, back: () => { bossLoseWord(); return "Warp gate closed: the word it was on is lost"; } },
        ward: { look: "umbrella", hits: 2, back: () => { bossStun(1.5); return "You knocked the umbrella out of its hands"; } }
    };
    let interceptEl = null;
    // the target turns up somewhere random on the screen, drifts about, and jumps somewhere new after every hit
    // (the user: "the click counterplay should be pretty hard"); later bosses' targets move faster
    const TARGET = 58;
    function randomSpot() {
        const m = 20 + TARGET / 2, top = 64;
        return { x: m + Math.random() * Math.max(1, innerWidth - 2 * m), y: top + m + Math.random() * Math.max(1, innerHeight - top - 2 * m) };
    }
    function spawnIntercept(f, mv) {
        removeIntercept();
        const it = INTERCEPT[mv.kind];
        if (!it || f.windup < 1) return;                // Silent Wings: no warning, no target
        let left = it.hits, p = randomSpot(), a = Math.random() * Math.PI * 2, prev = performance.now();
        const speed = 45 + (f.si || 0) * 9;
        const el = U.el("button", { type: "button", class: "counter-target look-" + it.look, "aria-label": "Counter: click the " + LOOK_NAME[it.look], title: "Click the " + LOOK_NAME[it.look],
            style: { "--c": bossOf(f.world).color },
            html: `<svg viewBox="0 0 64 64" aria-hidden="true">${ICON[it.look] || ICON.target}</svg><span class="ct-label">${it.hits > 1 ? `×${it.hits}` : "Click!"}</span><i class="ct-ring"></i>` });
        const place = () => { el.style.left = p.x.toFixed(1) + "px"; el.style.top = p.y.toFixed(1) + "px"; };
        const drift = now => {
            if (!el.isConnected) return;
            const dt = Math.min(0.05, (now - prev) / 1000), m = 20 + TARGET / 2;
            prev = now;
            a += (Math.random() - 0.5) * 3 * dt;
            p.x += Math.cos(a) * speed * dt; p.y += Math.sin(a) * speed * dt;
            if (p.x < m || p.x > innerWidth - m) { a = Math.PI - a; p.x = U.clamp(p.x, m, innerWidth - m); }
            if (p.y < 64 + m || p.y > innerHeight - m) { a = -a; p.y = U.clamp(p.y, 64 + m, innerHeight - m); }
            place();
            requestAnimationFrame(drift);
        };
        place();
        el.addEventListener("pointerdown", e => {
            e.preventDefault(); e.stopPropagation();
            if (fight !== f || f.pending !== mv) return;
            left--;
            Sound.tone({ f: 500 + (it.hits - left) * 160, f2: 900, d: 0.08, v: 0.12, type: "triangle" });
            const at = U.center(el);
            FX.burst({ x: at.x, y: at.y, n: 10, colors: ["#fff", bossOf(f.world).color], shape: "star", speed: [80, 220], gravity: 200, life: [0.3, 0.6], size: [2, 5] });
            if (left <= 0) { countered(f, mv, it); return; }
            el.querySelector(".ct-label").textContent = `×${left}`;
            p = randomSpot(); a = Math.random() * Math.PI * 2;         // it jumps away
            place();
            U.restart(el, "hop");
        });
        document.body.appendChild(el);
        if (U.motion() !== "still") requestAnimationFrame(drift);
        interceptEl = el;
    }
    function removeIntercept() { if (interceptEl) { interceptEl.remove(); interceptEl = null; } }
    function countered(f, mv, it) {
        const p = interceptEl ? U.center(interceptEl) : U.center(boardArea());
        removeIntercept();
        f.pending = null;
        f.windup = 0;
        f.counters = (f.counters || 0) + 1;
        const text = it.back();
        Bosses.cutin(f.world, "COUNTERED!", text, { good: true });
        Sound.sample("jingle-block", { v: 0.5 });
        FX.burst({ x: p.x, y: p.y, n: 40, colors: ["#fff", "#ffd23f", bossOf(f.world).color], shape: "star", speed: [150, 420], gravity: 200, life: [0.5, 1], size: [3, 7] });
        if (f.cells) Powers.aura(bossBoardEl(), ["💥", "✨"], "pop", 8, 900);
        speak(U.pick(["What?! My own move?!", "You... countered that?!", "Grr! Not fair!", "How did you see that coming?!"]), 2400);
        drawFight();
    }
    // breaking a move that's already landed: clicks on your board, your clues, the clue bar, the boss, the covers
    function boardClick(e) {
        if (!fightOn()) return;
        const f = fight, g = Game.state, cellEl = e.target.closest(".cell");
        let r = -1, c = -1;
        if (cellEl && g.cells) g.cells.forEach((row, rr) => row.forEach((el, cc) => { if (el === cellEl) { r = rr; c = cc; } }));
        const id = r + "," + c, puff = (el, looks) => el && Powers.aura(el, looks, "pop", 6, 600);
        let hit = false;
        if (r >= 0) {
            if (f.snow && f.snow.has(id) && (f.me.whiteout > 0 || f.me.avalanche > 0)) { f.snow.delete(id); f.cleared = f.cleared || new Set(); f.cleared.add(id); puff(cellEl, ["❄️"]); hit = true; }
            if (f.thorns && f.thorns.cells.has(id)) { f.thornHits = f.thornHits || {}; if ((f.thornHits[id] = (f.thornHits[id] || 0) + 1) >= 4) { f.thorns.cells.delete(id); puff(cellEl, ["🍂", "✂️"]); floatText("Thorn cut! ✂️"); } else U.restart(cellEl, "shake"); hit = true; }
            if (f.me.confetti > 0 && f.piles && f.piles.has(id)) { f.piles.delete(id); (f.swept = f.swept || new Set()).add(id); puff(cellEl, ["🎉"]); hit = true; }
            if (f.me.flicker > 0 && cellEl.classList.contains("clouded")) { (f.clearSky = f.clearSky || new Set()).add(id); cellEl.classList.remove("clouded"); puff(cellEl, ["☁️"]); hit = true; }
            if (f.me.mask > 0 && cellEl.classList.contains("masked")) { (f.decoded = f.decoded || new Set()).add(id); puff(cellEl, ["✨"]); hit = true; }
            if (f.me.haunting > 0 && cellEl.querySelector(".ghost-ltr")) { (f.banished = f.banished || new Set()).add(id); puff(cellEl, ["👻"]); hit = true; }
            if (f.me.crumple > 0 && f.folds && f.folds.has(id)) { f.folds.delete(id); puff(cellEl, ["✨"]); hit = true; }
            if (f.drips && f.drips.some(d => d.r === r && d.c === c)) { f.drips = f.drips.filter(d => d.r !== r || d.c !== c); puff(cellEl, ["💧"]); hit = true; }
            if (f.redPen && f.redPen.some(([r2, c2]) => r2 === r && c2 === c)) {
                f.redPen = f.redPen.filter(([r2, c2]) => r2 !== r || c2 !== c);
                Game.markCells([[r, c]], false);
                f.exposed = (f.exposed || 0) + 1;
                puff(cellEl, ["✨"]);
                if (f.exposed === 2) { bossStun(2); floatText("Caught lying! Boss stunned 2s"); }
                hit = true;
            }
            if (f.glitched && f.glitched.has(id) && performance.now() < f.glitched.get(id).until) {
                const fix = f.glitched.get(id); f.glitched.delete(id);
                if (!Game.isLocked(r, c)) Game.setLetters([[r, c, fix.ch]]);
                puff(cellEl, ["✨"]); floatText("Repaired! 🔧"); hit = true;
            }
            if (f.shifted && performance.now() < f.shifted.until && f.shifted.cells.some(([r2, c2]) => r2 === r && c2 === c)) {
                Game.setLetters(f.shifted.cells.filter(([r2, c2]) => !Game.isLocked(r2, c2)).map(([r2, c2], i) => [r2, c2, f.shifted.letters[i]]));
                f.shifted = null; puff(cellEl, ["🟫"]); floatText("Slid back! 🐪"); hit = true;
            }
        }
        // the moves you break by working at the whole board
        const tap = (k, n, msg) => { if (f.me[k] > 0) { f.taps = f.taps || {}; if ((f.taps[k] = (f.taps[k] || 0) + 1) >= n) { f.me[k] = 0; f.taps[k] = 0; floatText(msg); applyMe(); } hit = true; } };
        tap("inkblot", 6, "Blot wiped! 🧽");
        tap("static", 5, "Static cleared! 📺");
        tap("shrink", 6, "Pressure pushed back! 🌊");
        tap("gravity", 6, "Gravity well broken! 🪐");
        if (f.me.ink > 0) { f.me.ink = Math.max(0, f.me.ink - 0.8); hit = true; }
        if (f.me.shatter > 0) { f.me.shatter = Math.max(0, f.me.shatter - 1); hit = true; }
        if (hit) { applyMe(); drawFight(); }
    }
    function boardDoubleClick() {
        if (!fightOn()) return;
        const f = fight;
        f.taps = f.taps || {};
        for (const [k, msg] of [["mirror", "Mirror broken! 🪞"], ["upside", "Flipped back! ✈️"], ["sticky", "Unstuck! 🍯"]]) if (f.me[k] > 0) {
            if ((f.taps[k] = (f.taps[k] || 0) + 1) >= 2) { f.me[k] = 0; f.taps[k] = 0; floatText(msg); }     // two double-clicks
            else floatText("Once more!");
        }
        applyMe(); drawFight();
    }
    function clueClick(e) {
        if (!fightOn()) return;
        const f = fight, li = e.target.closest(".clues li");
        if (f.me.petals > 0) { f.taps = f.taps || {}; if ((f.taps.petals = (f.taps.petals || 0) + 1) >= 6) { f.me.petals = 0; f.taps.petals = 0; floatText("Petals swept away! 🌸"); } }
        if (!li) { applyMe(); return; }
        const items = [...document.querySelectorAll(".clues li")], i = items.indexOf(li);
        if (f.me.fakeclue > 0 && f.lie && Game.state.clueItems.get(f.lie.entry) === li) { f.lie = null; f.me.fakeclue = 0; bossStun(2); floatText("Lie exposed! Boss stunned 2s 😈"); }
        if (CLUE_TRICKS.some(k => f.me[k] > 0) && i >= 0) { (f.fixedClues = f.fixedClues || new Set()).add(i); Powers.aura(li, ["✨"], "pop", 4, 500); }
        rewriteClues();
        applyMe();
    }
    function portraitClick() {
        if (!fightOn()) return;
        const f = fight;
        f.taps = f.taps || {};
        if (f.boss.ward && (f.taps.ward = (f.taps.ward || 0) + 1) >= 5) { f.boss.ward = 0; f.taps.ward = 0; floatText("Umbrella torn! ☂️"); Powers.aura(portraitEl(), ["💧"], "pop", 8, 700); }
        if (f.me.toll > 0 && (f.taps.toll = (f.taps.toll || 0) + 1) >= 5) { f.me.toll = 0; f.taps.toll = 0; floatText("Fire doused! ♨️"); Powers.aura(portraitEl(), ["💧"], "pop", 8, 700); }
        drawFight();
    }
    function coverClick(e) {
        const cov = e.target.closest(".ab-cover");
        if (!cov || !fightOn()) return;
        const f = fight, k = cov.classList.contains("seal") ? "seal" : "itemlock";
        f.taps = f.taps || {};
        U.restart(cov, "shake");
        Sound.tone({ f: 300 + (f.taps[k] || 0) * 80, f2: 200, d: 0.07, v: 0.12, type: "square" });
        if ((f.taps[k] = (f.taps[k] || 0) + 1) >= 7) { f.me[k] = 0; f.taps[k] = 0; floatText(k === "seal" ? "Weeds torn off! 🌿" : "Firewall hacked! 🧱"); }
        drawFight();
    }
    document.querySelector(".board-wrap").addEventListener("click", boardClick, true);
    document.querySelector(".board-wrap").addEventListener("dblclick", boardDoubleClick, true);
    document.querySelector(".clues").addEventListener("click", clueClick, true);
    document.getElementById("clue-bar").addEventListener("click", () => { if (fightOn() && fight.me.mirageclue > 0) { fight.me.mirageclue = 0; fight.mirage = null; floatText("Mirage dispelled! 🌅"); applyMe(); } }, true);
    document.addEventListener("click", e => { if (e.target.closest(".bp-portrait")) portraitClick(); else if (e.target.closest(".ab-cover")) coverClick(e); }, true);
    // a right word finished: some moves can't stand that
    function counterOnWord() {
        const f = fight, now = performance.now();
        f.taps = f.taps || {};
        for (const [k, msg] of [["drain", "Board watered! 🌱"], ["heatwave", "Cooled down! ❄️"], ["numberless", "Numbers back! 💾"]]) if (f.me[k] > 0) {
            if ((f.taps["w-" + k] = (f.taps["w-" + k] || 0) + 1) >= 2) { f.me[k] = 0; f.taps["w-" + k] = 0; floatText(msg); }   // two words
            else floatText("1 more word!");
        }
        if (f.me.lock > 0 || f.me.taunt > 0) { f.me.lock = 0; f.me.taunt = 0; bossStun(2); floatText("Broke free! Boss stunned 2s"); }
        if (f.me.darkcreep > 0) f.me.darkcreep = Math.max(0, f.me.darkcreep - 1.5);
        if (f.me.lights > 0) f.lightsBonus = (f.lightsBonus || 0) + 1;
        if (f.me.comboban > 0) { f.banWords = (f.banWords || []).filter(t => now - t < 5000); f.banWords.push(now); if (f.banWords.length >= 2) { f.me.comboban = 0; f.banWords = []; floatText("Combo ban broken! 💢"); } }
    }

    function windUp(chained = false, forced = null) {
        const f = fight, moves = Powers.MOVES[f.world] || Powers.MOVES.paper;
        let i = forced ? Math.max(0, moves.indexOf(forced)) : Math.floor(Math.random() * moves.length);
        if (moves.length > 1 && i === f.lastMove) i = (i + 1 + Math.floor(Math.random() * (moves.length - 1))) % moves.length;
        f.lastMove = i;
        f.pending = forced || moves[i];
        f.pendingChained = chained;
        // Silent Wings: the next attack comes with (almost) no warning
        f.windup = f.ambush ? 0.4 : f.th.windup * (chained ? 0.7 : 1) * (f.buff.firewall > 0 ? 2 : 1);
        f.ambush = false;
        f.windupMax = f.windup;
        const portrait = portraitEl();
        if (portrait) U.restart(portrait, "charge");
        Powers.chargeSound(f.world);
        Powers.aura(portrait, [f.pending.icon], "orbit", 4, f.windup * 1000, bossOf(f.world).color);
        speak(chained ? `And ${f.pending.name}, too!` : `${f.pending.name}... get ready!`, 2400);
        if (Math.random() < 0.4) Mascot.say(U.pick([`${f.pending.name} is coming! Finish a word to block it!`, "Quick, finish a word!", "Block it! Any word will do!"]), { mood: "wow", hold: 2500 });
        spawnIntercept(f, f.pending);                          // its counter target, if it has one
        drawFight();
    }
    async function attack() {
        const f = fight, mv = f.pending, b = bossOf(f.world);
        f.pending = null;
        removeIntercept();
        const portrait = portraitEl();
        if (portrait) U.restart(portrait, "attack");
        const chain = () => { if (f.th.double && f.enraged && !f.pendingChained && !f.over) setTimeout(() => { if (fight === f && fightOn() && !f.pending) windUp(true); }, 900); };
        if (f.me.shield) {
            f.me.shield = 0;
            Bosses.cutin(f.world, "SHIELDED!", `${mv.name} bounced off your Paper Wall`, { good: true });
            Sound.play("right");
            drawFight();
            chain();
            return;
        }
        if (f.me.reflect) {
            f.me.reflect = 0;
            f.boss.freeze = Math.max(f.boss.freeze || 0, Math.max(4, mv.d * f.th.power));
            Bosses.cutin(f.world, "BOUNCED BACK!", `${mv.name} hit the boss instead: frozen`, { good: true });
            Sound.custom(Powers.ABILITIES.find(a => a.kind === "reflect").sound);
            Powers.aura(portrait, ["🧁", mv.icon], "pop", 10, 1200);
            speak("Wha-? It came BACK?!", 2000);
            drawFight();
            chain();
            return;
        }
        f.hits++;
        Bosses.cutin(f.world, mv.name + "!", "It " + mv.desc);
        FX.shake(9, 420);
        FX.flash(b.color, 380, 0.22);
        const selfMove = ["ambush", "ward", "haste", "powerup", "heal", "snapfinish"].includes(mv.kind);     // moves that power the boss up
        await U.wait(U.motion() === "still" ? 0 : 750);         // let the cut-in clear, so the strike itself can be seen
        if (fight !== f || f.over || !fightOn()) return;
        await Powers.strike(f.world, mv, { fromEl: portrait || panel, toEl: selfMove ? (portrait || panel) : boardArea() });
        if (fight !== f || f.over || !fightOn()) return;
        const myBefore = Game.state.letters.map(r => [...r]);
        hitMe(mv);
        Game.markBossChanges(myBefore);                     // what it erased or changed stays marked until you fix it
        Spells.play("m-" + mv.kind, { cells: myChanges(myBefore), area: selfMove ? (portrait || panel) : document.getElementById("board"),
            from: U.center(portrait || panel), to: U.center(selfMove ? (portrait || panel) : document.getElementById("board")) });
        if (f.buff.silver > 0 && !selfMove) { Game.giveLetters(1); floatText("+1 right letter ☁️"); }           // Silver Lining
        speak(U.pick(["Take that!", "Ha! Try writing now!", b.taunt]));
        applyMe();
        updateHp();
        drawFight();
        chain();
    }
    // what a boss move does to you (durations get longer with each boss, Frost Armor halves them, Pressure Build doubles one)
    const COUNTER_STATE = { confetti: "swept", flicker: "clearSky", mask: "decoded", haunting: "banished", lights: "lightsBonus", fakecheck: "exposed", comboban: "banWords" };
    function hitMe(mv) {
        const f = fight, g = Game.state, armor = f.buff.armor > 0;
        if (COUNTER_STATE[mv.kind]) f[COUNTER_STATE[mv.kind]] = null;
        if (f.taps) { f.taps[mv.kind] = 0; f.taps["w-" + mv.kind] = 0; }
        const dur = mv.d * f.th.power * (armor ? 0.5 : 1) * (f.powerNext ? 2 : 1);
        if (mv.kind !== "powerup") f.powerNext = false;
        const open = () => scopeAll().filter(([r, c]) => !Game.isLocked(r, c));
        const filled = () => open().filter(([r, c]) => g.letters[r][c]);
        const shuffle = list => list.sort(() => Math.random() - 0.5);
        const ids = list => new Set(list.map(([r, c]) => r + "," + c));
        const wordsOf = () => [...g.puzzle.across, ...g.puzzle.down];
        switch (mv.kind) {
            case "rubout": Game.eraseLetters(armor ? 2 : 3); break;
            case "thorns": {
                const cells = shuffle(open().filter(([r, c]) => !g.letters[r][c])).slice(0, armor ? 2 : 3);
                f.thorns = { cells: ids(cells), t: dur };
                break;
            }
            case "acorns": {                                                     // swap pairs of your letters around
                const list = shuffle(filled());
                const sets = [];
                for (let i = 0; i + 1 < list.length && sets.length < (armor ? 1 : 2) * 2; i += 2) {
                    const [a, b2] = [list[i], list[i + 1]];
                    if (g.letters[a[0]][a[1]] === g.letters[b2[0]][b2[1]]) continue;
                    sets.push([a[0], a[1], g.letters[b2[0]][b2[1]]], [b2[0], b2[1], g.letters[a[0]][a[1]]]);
                }
                Game.setLetters(sets);
                break;
            }
            case "lightning": {                                                  // the word with the most of your letters in it
                let best = null, most = 0;
                for (const e of wordsOf()) {
                    const n = Game.cellsOf(e).filter(([r, c]) => g.letters[r][c] && !Game.isLocked(r, c)).length;
                    if (n > most) { most = n; best = e; }
                }
                if (best) Game.setLetters(Game.cellsOf(best).filter(([r, c]) => !Game.isLocked(r, c)).slice(0, armor ? 2 : 99).map(([r, c]) => [r, c, ""]));
                break;
            }
            case "glitch": {
                const right = shuffle(filled().filter(([r, c]) => g.letters[r][c] === g.puzzle.solution[r][c])).slice(0, armor ? 2 : 3);
                f.glitched = new Map(right.map(([r, c]) => [r + "," + c, { ch: g.puzzle.solution[r][c], until: performance.now() + 8000 }]));   // click one in time to repair it
                Game.setLetters(right.map(([r, c]) => [r, c, wrongLetter(g.puzzle.solution[r][c])]));
                break;
            }
            case "lag": {
                const back = [];
                for (let i = f.myLog.length - 1; i >= 0 && back.length < (armor ? 2 : 4); i--) {
                    const [r, c] = f.myLog[i];
                    if (g.letters[r][c] && !Game.isLocked(r, c) && !back.some(([r2, c2]) => r2 === r && c2 === c)) back.push([r, c, ""]);
                }
                Game.setLetters(back);
                break;
            }
            case "eruption": {
                const n = g.puzzle.size, hits = [];
                for (let k = 0; k < (armor ? 1 : 2); k++) {
                    const r0 = Math.floor(Math.random() * n), c0 = Math.floor(Math.random() * n);
                    for (const [dr, dc] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) hits.push([r0 + dr, c0 + dc]);
                }
                const ok = hits.filter(([r, c]) => r >= 0 && c >= 0 && r < n && c < n && g.puzzle.solution[r][c] !== "." && g.letters[r][c] && !Game.isLocked(r, c));
                ok.forEach(([r, c]) => { const el = Game.cellEl(r, c); if (el) U.restart(el, "scorched"); });
                Game.setLetters(ok.map(([r, c]) => [r, c, ""]));
                break;
            }
            case "heatwave": f.me.heatwave = dur; break;                           // Check and Reveal are too hot to touch
            case "collapse": {
                const outs = [];
                for (const e of wordsOf()) {
                    const cells = Game.cellsOf(e);
                    if (!cells.every(([r, c]) => g.letters[r][c])) continue;
                    const loose = cells.filter(([r, c]) => !Game.isLocked(r, c) && !outs.some(([r2, c2]) => r2 === r && c2 === c));
                    if (loose.length) outs.push(U.pick(loose));
                    if (outs.length >= (armor ? 3 : 6)) break;
                }
                Game.setLetters(outs.map(([r, c]) => [r, c, ""]));
                break;
            }
            case "whiteout": f.snow = ids(shuffle(scopeAll()).slice(0, Math.ceil(scopeAll().length / 2))); f.me.whiteout = dur; break;
            case "avalanche": f.snow = new Set(); f.me.avalanche = dur; break;                     // grows every second (see the clock)
            case "crumple": { const safe = safeCells(); f.folds = ids(shuffle(scopeAll().filter(([r, c]) => !safe.has(r + "," + c))).slice(0, Math.ceil(scopeAll().length * 0.35))); f.me.crumple = dur; break; }   // finished words don't fold
            case "confetti": f.piles = ids(shuffle(scopeAll()).slice(0, Math.ceil(scopeAll().length * 0.5))); f.me.confetti = dur; break;
            case "fakecheck": {                                                  // Red Pen: right letters marked wrong
                const right = shuffle(filled().filter(([r, c]) => g.letters[r][c] === g.puzzle.solution[r][c])).slice(0, armor ? 2 : 4);
                f.redPen = right;
                Game.markCells(right, true);
                f.me.fakecheck = dur;
                break;
            }
            case "minion": {                                                     // Aphid: eats letters until you click it
                f.me.minion = dur;
                spawnMinion();
                break;
            }
            case "drain": f.me.drain = dur; f.combo = 0; floatText("Your board wilted! 🥀", false); break;     // Wilt: you can't see which word you're on
            case "steal": {
                const ids2 = loadout().filter(id => (data.owned[id] || 0) > 0);
                if (ids2.length) {
                    const id = U.pick(ids2);
                    data.owned[id]--;
                    save();
                    drawAbilityBar();
                    FX.toast({ icon: "🐿️", kicker: "STOLEN", title: abilityById[id].name, text: "The boss stole one use.", ms: 2400 });
                }
                break;
            }
            case "ambush": f.ambush = true; break;
            case "bubble": {                                                     // Gum Bubble: your word is sealed in gum
                const e = currentMyEntry();
                if (e) f.gum = { cells: ids(Game.cellsOf(e)), hits: 0, t: dur };
                break;
            }
            case "shift": {                                                      // Dune Shift: a word's letters slide over by one
                let best = null;
                for (const e of wordsOf()) {
                    const cells = Game.cellsOf(e);
                    if (cells.every(([r, c]) => g.letters[r][c] && !Game.isLocked(r, c)) && (!best || cells.length > Game.cellsOf(best).length)) best = e;
                }
                if (!best) best = wordsOf().find(e => Game.cellsOf(e).filter(([r, c]) => g.letters[r][c] && !Game.isLocked(r, c)).length >= 2);
                if (best) {
                    const cells = Game.cellsOf(best).filter(([r, c]) => !Game.isLocked(r, c));
                    const letters = cells.map(([r, c]) => g.letters[r][c]);
                    f.shifted = { cells, letters, until: performance.now() + 6000 };          // click it in time to slide it back
                    Game.setLetters(cells.map(([r, c], i) => [r, c, letters[(i + letters.length - 1) % letters.length]]));
                }
                break;
            }
            case "curse": f.curse = { t: dur, words: f.myWords || 0 }; break;
            case "bomb": {                                                       // Cannonball: defuse it with the right letter
                const spots = shuffle(open().filter(([r, c]) => g.letters[r][c] !== g.puzzle.solution[r][c]));
                if (spots.length) f.bombAt = { r: spots[0][0], c: spots[0][1], t: dur };
                break;
            }
            case "taunt": {                                                      // Ringmaster's Call: stuck on its word
                const e = U.pick(wordsOf().filter(w => Game.cellsOf(w).some(([r, c]) => g.letters[r][c] !== g.puzzle.solution[r][c]))) || currentMyEntry();
                if (e) {
                    const item = g.clueItems.get(e);
                    if (item) item.click();
                }
                f.me.taunt = dur;
                break;
            }
            case "comboban": f.combo = 0; f.me.comboban = dur; break;
            case "unlock": {
                const freed = Game.unlockLetters();
                Game.setLetters(shuffle(freed).slice(0, armor ? 1 : 2).map(([r, c]) => [r, c, ""]));
                floatText(`${freed.length} unlocked`, false);
                break;
            }
            case "wordthief": {
                const cells = (f.lastMyWord || []).filter(([r, c]) => g.letters[r][c] && !Game.isLocked(r, c));
                Game.setLetters(cells.map(([r, c]) => [r, c, ""]));
                break;
            }
            case "fakeclue": {                                                   // Possession: one clue tells a lie
                const mine = wordsOf().filter(w => Game.cellsOf(w).some(([r, c]) => g.letters[r][c] !== g.puzzle.solution[r][c]));
                const target = U.pick(mine), others = f.puzzle ? [...f.puzzle.across, ...f.puzzle.down] : [];
                const lie = others.find(o => target && o.length === target.length && o.clue !== target.clue) || U.pick(others);
                if (target && lie) f.lie = { entry: target, text: lie.clue };
                f.me.fakeclue = dur;
                break;
            }
            // moves that power the boss up
            case "ward": f.boss.ward = 1; break;
            case "haste": f.boss.haste = Math.max(f.boss.haste || 0, dur); break;
            case "powerup": f.powerNext = true; break;
            case "heal": for (let i = 0; i < Math.round(mv.d * (armor ? 0.5 : 1)); i++) { const empty = bossNextEmpty(); if (!empty) break; write(empty); } refreshDone(); break;
            case "snapfinish": {
                if (!f.word) f.word = f.queue.find(e => !f.done.includes(e)) || null;
                if (f.word) { for (const cell of Game.cellsOf(f.word)) if (!real(cell[0], cell[1])) { f.letters[cell[0]][cell[1]] = f.puzzle.solution[cell[0]][cell[1]]; f.log.push(cell); } refreshDone(); f.word = null; }
                if (f.done.length === f.puzzle.across.length + f.puzzle.down.length) lose("boss");
                break;
            }
            default: f.me[mv.kind] = dur;
        }
        if (["hoot", "riddle", "clueswap", "oneword", "fakeclue"].includes(mv.kind)) rewriteClues();
    }
    const scopeAll = () => { const g = Game.state, out = []; g.puzzle.solution.forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== ".") out.push([r, c]); })); return out; };
    const wrongLetter = right => String.fromCharCode(65 + ((right.charCodeAt(0) - 65 + 1 + Math.floor(Math.random() * 24)) % 26));
    const bossNextEmpty = () => { const f = fight; for (const e of f.queue) { if (f.done.includes(e)) continue; const empty = Game.cellsOf(e).find(([r, c]) => !f.letters[r][c]); if (empty) return empty; } return null; };

    // Aphid Swarm: a bug sits on one of your letters, eats it, and hops to the next one, until you click it
    let minionEl = null;
    function spawnMinion() {
        removeMinion();
        minionEl = U.el("button", { type: "button", class: "minion", "aria-label": "An aphid! Click it", text: "🐛" });
        minionEl.addEventListener("click", e => {
            e.stopPropagation();
            if (!fight) return;
            fight.me.minion = 0;
            Powers.aura(minionEl, ["💥", "✨"], "pop", 8, 700);
            Sound.custom(Powers.ABILITIES.find(a => a.kind === "knock").sound);
            bossLose(2);
            floatText("Sent back! The aphid eats 2 of the boss's letters 🐛", true);
            removeMinion();
        });
        document.querySelector(".board-wrap").appendChild(minionEl);
        fight.minionAcc = 2;
    }
    function removeMinion() { if (minionEl) { minionEl.remove(); minionEl = null; } }
    function moveMinion() {
        const g = Game.state, wrap = document.querySelector(".board-wrap");
        const targets = scopeAll().filter(([r, c]) => g.letters[r][c] && !Game.isLocked(r, c));
        const [r, c] = targets.length ? U.pick(targets) : U.pick(scopeAll());
        const cell = Game.cellEl(r, c);
        if (!cell || !minionEl || !wrap) return;
        const a = cell.getBoundingClientRect(), w = wrap.getBoundingClientRect();
        minionEl.style.left = (a.left - w.left + a.width / 2) + "px";
        minionEl.style.top = (a.top - w.top + a.height / 2) + "px";
        if (g.letters[r][c] && !Game.isLocked(r, c)) setTimeout(() => { if (minionEl && fight && fight.me.minion > 0) { Game.setLetters([[r, c, ""]]); U.restart(cell, "scorched"); } }, 600);
    }

    // ---- the boss's effects on you, shown on the page ----
    let savedClues = null;
    function rewriteClues() {
        const f = fight, m = f ? f.me : {};
        const items = [...document.querySelectorAll(".clues .clue-text")];
        if (!savedClues) savedClues = items.map(n => n.textContent);
        const jumble = t => t.split(" ").map(w => (w.length > 3 ? w[0] + [...w.slice(1, -1)].sort(() => Math.random() - 0.5).join("") + w.slice(-1) : w)).join(" ");
        const mirror = t => [...t].reverse().join("");
        const order = m.clueswap > 0 ? savedClues.map((t, i) => i).sort(() => Math.random() - 0.5) : null;
        const lieAt = m.fakeclue > 0 && f.lie ? [...Game.state.clueItems.keys()].indexOf(f.lie.entry) : -1;
        items.forEach((n, i) => {
            if (f && f.fixedClues && f.fixedClues.has(i)) { n.textContent = savedClues[i]; return; }      // you put this one back
            let t = order ? savedClues[order[i]] : savedClues[i];
            if (i === lieAt) t = f.lie.text;
            if (m.hoot > 0) t = jumble(t);
            else if (m.riddle > 0) t = mirror(t);
            else if (m.oneword > 0) t = t.split(" ")[0] + " …";
            n.textContent = t;
        });
        fixClueBar();
    }
    // the clue bar follows the same tricks (and Mirage puts a different clue there)
    function fixClueBar() {
        const f = fight, m = f ? f.me : {}, bar = document.querySelector("#clue-bar .cb-text"), e = currentMyEntry();
        if (!bar || !e) return;
        const items = [...Game.state.clueItems.keys()], i = items.indexOf(e), list = [...document.querySelectorAll(".clues .clue-text")];
        if (m.mirageclue > 0) {
            if (!f.mirage || f.mirage.entry !== e) f.mirage = { entry: e, text: U.pick(items.filter(x => x !== e)).clue };
            bar.textContent = f.mirage.text;
        } else if (savedClues && list[i]) bar.textContent = list[i].textContent;
    }
    const CLUE_TRICKS = ["hoot", "riddle", "clueswap", "oneword", "fakeclue"];
    const AREA_FX = ["crumple", "whirl", "mirror", "static", "lights", "confetti", "downpour", "gravity", "sticky", "sandblast", "lock", "taunt",
        "inkblot", "nobackspace", "jitter", "tidal", "shrink", "shatter", "halffog", "upside", "flicker", "darkcreep", "numberless", "slowmo", "fumble", "backwards", "echo", "mask", "vowels"];
    const FLOOD_HOLD = 5;                                   // seconds Flash Flood stays at its full height
    function applyMe() {
        const f = fight, m = f ? f.me : {}, on = k => m[k] > 0;
        const area = boardArea(), clues = document.querySelector(".clues"), board = document.getElementById("board");
        if (!area || !board) return;
        area.classList.toggle("fx-blind", on("ink"));
        clues.classList.toggle("fx-blind", on("ink"));
        for (const k of AREA_FX) area.classList.toggle("fx-" + k, on(k));
        clues.classList.toggle("fx-numberless", on("numberless"));
        board.classList.toggle("fx-smudge", on("sour"));
        board.classList.toggle("fx-frozen", on("freeze"));
        board.classList.toggle("fx-wilt", on("drain"));
        // progress protects you: the flood stops at your finished words, the shaking and the tide ease off as you solve
        const safe = safeCells(), pct = myPct(), size = Game.state.puzzle ? Game.state.puzzle.size : 5, rows = doneAcrossRows();
        // Flash Flood rises over its whole duration and can cover the entire board. Each finished Across word in the
        // bottom half holds it back by a third (the user: "you need like 3 rows of words to stop it")
        if (on("halffog")) {
            f.floodMax = Math.max(f.floodMax || 0, m.halffog);
            const low = [...rows].filter(r => r >= size - Math.ceil(size / 2)).length;
            // it rises until 5 seconds are left, then stays at its height for those 5 seconds (the user's rule)
            const rise = 25 + 75 * Math.min(1, (f.floodMax - m.halffog) / Math.max(1.5, f.floodMax - FLOOD_HOLD)), dammed = Math.max(0, 100 - 34 * low);
            setVar(area, "--flood", Math.min(rise, dammed).toFixed(1) + "%");
            area.classList.toggle("flood-dammed", dammed < rise);
        } else if (f) { f.floodMax = 0; area.classList.remove("flood-dammed"); }
        setVar(area, "--jit", Math.max(0.45, 1 - 0.55 * pct).toFixed(2));
        setVar(area, "--tide", (46 * Math.max(0, 1 - rows.size / 3)).toFixed(1) + "%");     // 3 finished rows hold it still
        setVar(area, "--lr", (46 + 12 * ((f && f.lightsBonus) || 0)) + "px");
        if (f && !on("lights")) f.lightsBonus = 0;
        clues.classList.toggle("fx-petals", on("petals"));
        flareEl.classList.toggle("on", on("flare"));
        if (on("darkcreep")) setVar(area, "--dark", Math.min(0.97, 1 - m.darkcreep / Math.max(1, f.darkMax || m.darkcreep)).toFixed(2));
        // the clue text tricks end: put the clues back
        if (savedClues && !CLUE_TRICKS.some(on)) {
            if (f) f.fixedClues = null;
            document.querySelectorAll(".clues .clue-text").forEach((n, i) => { if (savedClues[i] != null) n.textContent = savedClues[i]; });
            savedClues = null;
            Game.render();
        }
        if (on("mirageclue") || savedClues) fixClueBar();
        else if (f) f.mirage = null;
        // squares: snow, thorns, folds, confetti, gum, ghost and masked letters, the bomb
        const g = Game.state;
        if (g.puzzle && g.cells) scopeAll().forEach(([r, c]) => {
            const cell = Game.cellEl(r, c), id = r + "," + c;
            if (!cell) return;
            cell.classList.toggle("safe", safe.has(id));
            cell.classList.toggle("snowed", (on("whiteout") || on("avalanche")) && !!f.snow && f.snow.has(id));
            cell.classList.toggle("thorny", !!(f && f.thorns && f.thorns.cells.has(id)));
            cell.classList.toggle("folded", on("crumple") && !!f.folds && f.folds.has(id));
            cell.classList.toggle("piled", on("confetti") && !!f.piles && f.piles.has(id));
            cell.classList.toggle("gummed", !!(f && f.gum && f.gum.cells.has(id)));
            cell.classList.toggle("bombed", !!(f && f.bombAt && f.bombAt.r === r && f.bombAt.c === c));
            setVar(cell, "--sx", on("shatter") ? ((r % 2 ? 1 : -1) * (6 + (c % 3) * 3)) + "px" : "0px");
            // Haunting: fake letters in empty squares that look exactly like real ones
            const ghost = cell.querySelector(".ghost-ltr");
            if (on("haunting") && !g.letters[r][c] && !(f.banished && f.banished.has(id))) { if (!ghost) cell.appendChild(U.el("span", { class: "ghost-ltr", text: String.fromCharCode(65 + Math.floor(Math.random() * 26)) })); }
            else if (ghost) ghost.remove();
            // Corrupted Font: your letters show as other letters. Event Horizon: vowels vanish from view
            const ltr = g.letters[r][c], shown = cell.querySelector(".mask-ltr");
            const keep = safe.has(id) || (f && f.decoded && f.decoded.has(id));                // finished words (and decoded letters) show through
            const fake = keep ? null : on("mask") && ltr ? String.fromCharCode(65 + (ltr.charCodeAt(0) - 65 + 7) % 26) : on("vowels") && "AEIOU".includes(ltr) ? " " : null;
            if (fake != null && ltr) { if (!shown) cell.appendChild(U.el("span", { class: "mask-ltr", text: fake })); else if (shown.textContent !== fake) shown.textContent = fake; cell.classList.add("masked"); }
            else { if (shown) shown.remove(); cell.classList.remove("masked"); }
        });
        // Lights Out: a small circle of light around your cursor
        if (on("lights") && g.cells) {
            const cell = Game.cellEl(g.row, g.col), wrap = document.querySelector(".board-wrap");
            if (cell && wrap) {
                const a = cell.getBoundingClientRect(), w = wrap.getBoundingClientRect();
                setVar(area, "--lx", Math.round(a.left + a.width / 2 - w.left) + "px");
                setVar(area, "--ly", Math.round(a.top + a.height / 2 - w.top) + "px");
            }
        }
        if (!on("minion")) removeMinion();
    }
    function clearMe(keepShield = false) {
        if (fight && !keepShield) { fight.me = {}; fight.thorns = null; }
        const f = fight, m = f ? f.me : {};
        f && Object.keys(m).forEach(k => { if (typeof m[k] === "number" && k !== "shield" && k !== "reflect") m[k] = 0; });
        if (f) {
            if (f.redPen) { Game.markCells(f.redPen, false); f.redPen = null; }
            f.gum = null; f.bombAt = null; f.curse = null; f.snow = null; f.folds = null; f.piles = null; f.lie = null; f.mirage = null;
        }
        removeMinion();
        const area = boardArea(), board = document.getElementById("board"), clues = document.querySelector(".clues");
        if (area) area.className = area.className.split(" ").filter(c => !c.startsWith("fx-")).join(" ");
        if (clues) clues.classList.remove("fx-blind", "fx-petals", "fx-numberless");
        if (board) board.classList.remove("fx-smudge", "fx-frozen");
        flareEl.classList.remove("on");
        document.querySelectorAll("#board .cell").forEach(n => { n.classList.remove("snowed", "thorny", "folded", "piled", "gummed", "bombed", "masked"); n.style.removeProperty("--sx"); if (n._vars) delete n._vars["--sx"]; });
        document.querySelectorAll("#board .ghost-ltr, #board .mask-ltr").forEach(n => n.remove());
        if (savedClues) {
            document.querySelectorAll(".clues .clue-text").forEach((n, i) => { if (savedClues[i] != null) n.textContent = savedClues[i]; });
            savedClues = null;
            if (Game.state.puzzle) Game.render();
        }
    }

    // ---- keys: 1-3 abilities; and the boss's tricks that mess with your typing ----
    let heavy = null, lastLetterAt = 0;
    function letterBlocked(letter) {
        const f = fight, g = Game.state, now = performance.now(), here = g.row + "," + g.col;
        if (f.me.freeze > 0) return "freeze";
        if (f.thorns && f.thorns.cells.has(here)) return "thorns";
        if (f.gum && f.gum.cells.has(here)) return "gum";
        if (f.me.sandblast > 0 && Math.random() < 0.35) return "sand";
        if (f.me.slowmo > 0 && now - lastLetterAt < 700) return "slow";
        if (f.me.gravity > 0) {
            if (!heavy || heavy.key !== letter || now - heavy.at > 1500) { heavy = { key: letter, at: now }; return "heavy"; }
            heavy = null;
        }
        lastLetterAt = now;
        return null;
    }
    function bump(why) {
        const board = document.getElementById("board");
        U.restart(board, "shake");
        const cell = Game.cellEl(Game.state.row, Game.state.col);
        if (cell) U.restart(cell, why === "heavy" ? "heavy" : "shake");
        if (why === "sand") Powers.aura(cell, ["🟫"], "pop", 3, 600);
        if (why === "thorns") Powers.aura(cell, ["🌹"], "pop", 2, 600);
        if (why === "gum") Powers.aura(cell, ["🩷"], "pop", 2, 600);
        if (why === "slow") Powers.aura(cell, ["🧤"], "pop", 1, 500);
    }
    const lockedIn = () => fight && (fight.me.lock > 0 || fight.me.taunt > 0);
    addEventListener("keydown", e => {
        if (!waitEl.hidden && /^[a-zA-Z]$|^Backspace$/.test(e.key) && U.view() === "level") { e.preventDefault(); e.stopPropagation(); return; }
        if (!fightOn() || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.target.closest && e.target.closest("input, select, textarea")) return;
        if (/^[1-3]$/.test(e.key)) { const id = loadout()[+e.key - 1]; if (id) { e.preventDefault(); useAbility(id); } return; }
        const f = fight;
        if (/^[a-zA-Z]$/.test(e.key)) {
            lastKeyAt = performance.now();
            const why = letterBlocked(e.key.toUpperCase());
            if (why) { e.preventDefault(); e.stopPropagation(); bump(why); }
            return;
        }
        if ((f.me.freeze > 0 || f.me.nobackspace > 0) && (e.key === "Backspace" || e.key === "Delete")) { e.preventDefault(); e.stopPropagation(); bump("freeze"); return; }
        if (lockedIn() && ["Tab", "Enter", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) { e.preventDefault(); e.stopPropagation(); bump("lock"); }
    }, true);
    document.getElementById("keyboard").addEventListener("click", e => {
        if (!fightOn()) return;
        const k = e.target.closest(".key");
        if (!k) return;
        const key = k.dataset.key;
        if (/^[A-Z]$/.test(key)) {
            lastKeyAt = performance.now();
            const why = letterBlocked(key);
            if (why) { e.stopPropagation(); bump(why); }
        } else if (fight.me.freeze > 0 || (key === "⌫" && fight.me.nobackspace > 0) || (key === "⇄" && lockedIn())) { e.stopPropagation(); bump("freeze"); }
    }, true);
    // System Lock and Ringmaster's Call: clicking another word or clue does nothing. Gum: click it 3 times to pop it
    for (const sel of ["#board", ".clues", "#clue-bar"]) document.querySelector(sel).addEventListener("click", e => {
        if (!fightOn()) return;
        const f = fight, cellEl = e.target.closest(".cell");
        if (f.gum && cellEl && cellEl.classList.contains("gummed")) {
            if (++f.gum.hits >= 3) { f.gum = null; Powers.aura(cellEl, ["💥", "🩷"], "pop", 6, 700); bossBlind(2); floatText("Popped! It splats in the boss's face 🫧", true); }
            else U.restart(cellEl, "heavy");
            applyMe();
        }
        if (!lockedIn()) return;
        const cur = currentMyEntry();
        if (cellEl && cur && Game.cellsOf(cur).some(([r, c]) => Game.cellEl(r, c) === cellEl)) return;
        e.stopPropagation();
        bump("lock");
    }, true);
    // your letters: Overclock zaps, Sticky Floor holds the cursor, Lag Spike remembers what you typed,
    // Butterfingers fumbles, Echo Bug copies, Riptide pulls you backwards, the bomb gets defused
    Bus.on("type", ({ row, col, letter }) => {
        if (!fightOn()) return;
        const f = fight, g = Game.state;
        f.myLog.push([row, col]);
        if (f.myLog.length > 40) f.myLog.shift();
        if (f.buff.tailwind > 0 && letter === g.puzzle.solution[row][col]) setTimeout(() => { if (fightOn() && g.letters[row][col] === letter) Game.fillCells([[row, col]]); }, 0);
        if (f.buff.fireup > 0 && letter && letter !== g.puzzle.solution[row][col]) setTimeout(() => {              // Fire Up: a wrong letter burns away
            if (!fightOn() || g.letters[row][col] !== letter || Game.isLocked(row, col)) return;
            const el = Game.cellEl(row, col);
            if (el) { U.restart(el, "scorched"); Powers.aura(el, ["🔥"], "rise", 3, 600); }
            Game.setLetters([[row, col, ""]]);
        }, 260);
        if (f.me.downpour > 0 && letter !== "") f.drips.push({ r: row, c: col, t: 4 });          // Downpour: this letter starts running
        if (f.buff.overclock > 0 && (f.ocN || 0) < 5 && letter === g.puzzle.solution[row][col]) {
            const target = U.pick(bossFilled());
            if (target) {
                f.ocN = (f.ocN || 0) + 1;
                const from = U.center(Game.cellEl(row, col)), toCell = f.cells && f.cells[target[0]][target[1]];
                Powers.fly(from, toCell ? U.center(toCell) : U.center(panel), "⚡", "line", 300).then(() => { if (fight === f && !f.over) { wipe([target], true); drawFight(); } });
            }
        }
        if (f.bombAt && f.bombAt.r === row && f.bombAt.c === col && letter === g.puzzle.solution[row][col]) {
            Powers.aura(Game.cellEl(row, col), ["✂️", "✨"], "pop", 6, 700);
            floatText("Defused and thrown back! The boss can't see (3s) 💣", true);
            f.bombAt = null;
            bossBlind(3);
        }
        // the boss's typing tricks (their changes are marked too)
        const bossEdit = fn => setTimeout(() => { const before = g.letters.map(r => [...r]); fn(); Game.markBossChanges(before); }, 0);
        if (f.me.slowmo > 0 && letter === g.puzzle.solution[row][col]) f.me.slowmo = Math.max(0, f.me.slowmo - 0.4);   // right letters warm your fingers
        if (f.me.fumble > 0 && Math.random() < 0.3 && !safeCells().has(row + "," + col)) bossEdit(() => { if (!g.solved && g.letters[row][col] === letter) Game.setLetters([[row, col, wrongLetter(letter)]]); });
        const cells = Game.cellsOf(currentMyEntry()), at = cells.findIndex(([r, c]) => r === row && c === col);
        if (f.me.echo > 0 && at >= 0 && at + 1 < cells.length) { const [r2, c2] = cells[at + 1]; bossEdit(() => { if (!g.solved && !Game.isLocked(r2, c2) && g.letters[r2][c2] !== g.puzzle.solution[r2][c2]) Game.setLetters([[r2, c2, letter]]); }); }
        if (f.me.backwards > 0 && at > 0 && g.letters[cells[at - 1][0]][cells[at - 1][1]] !== g.puzzle.solution[cells[at - 1][0]][cells[at - 1][1]]) setTimeout(() => { if (!g.solved) { [g.row, g.col] = cells[at - 1]; Game.render(); } }, 0);
        if (f.me.sticky > 0) setTimeout(() => { if (!g.solved && g.puzzle) { g.row = row; g.col = col; Game.render(); } }, 0);
        updateHp();
    });

    // ---- the fight's clock: everything moves only while you're actually playing ----
    let lastTick = performance.now();
    setInterval(() => {
        const now = performance.now(), dt = Math.min(0.5, (now - lastTick) / 1000);
        lastTick = now;
        if (Sound.musicPlaying && Sound.musicPlaying !== "win" && Sound.musicPlaying !== "lose" && !fightOn() && !(fight && fight.switching)) Sound.stopMusic(1.5);
        if (!fightOn() || document.hidden || FX.playing || $("#puzzle").hidden || document.querySelector("#overlay .results") || root.classList.contains("intro-on")) return;
        const f = fight, g = Game.state, tickBefore = g.letters.map(r => [...r]);
        botStep(dt);
        if (f.over) return;
        const before = { ...f.me };
        for (const k of Object.keys(f.me)) if (typeof f.me[k] === "number" && k !== "shield" && k !== "reflect" && f.me[k] > 0) f.me[k] = Math.max(0, f.me[k] - dt);
        for (const k of Object.keys(f.buff)) if (f.buff[k] > 0) f.buff[k] = Math.max(0, f.buff[k] - dt);
        if (f.me.darkcreep > 0 && !(before.darkcreep > 0 && f.darkMax)) f.darkMax = f.me.darkcreep;
        if (!(f.me.darkcreep > 0)) f.darkMax = 0;
        if (before.fakecheck > 0 && !(f.me.fakecheck > 0) && f.redPen) { Game.markCells(f.redPen.filter(([r, c]) => g.letters[r][c] === g.puzzle.solution[r][c]), false); f.redPen = null; }
        if (f.thorns && (f.thorns.t -= dt) <= 0) f.thorns = null;
        if (f.gum && (f.gum.t -= dt) <= 0) f.gum = null;
        if (f.drips.length) {                                                // Downpour: letters run away unless their word gets finished
            const done = doneCells();
            for (const d of f.drips) d.t -= dt;
            const gone = f.drips.filter(d => d.t <= 0 && g.letters[d.r][d.c] && !Game.isLocked(d.r, d.c) && !done.has(d.r + "," + d.c));
            f.drips = f.drips.filter(d => d.t > 0);
            if (gone.length) { gone.forEach(d => { const el = Game.cellEl(d.r, d.c); if (el) U.restart(el, "drip"); }); Game.setLetters(gone.map(d => [d.r, d.c, ""])); }
        }
        if (f.me.gale > 0 && (f.galeAcc = (f.galeAcc || 0) + dt) >= 2.5) {  // Gale: the cursor is blown somewhere else
            f.galeAcc = 0;
            const [r, c] = U.pick(scopeAll());
            g.row = r; g.col = c;
            if (g.direction === "across" && !g.acrossAt[r][c]) g.direction = "down";
            if (g.direction === "down" && !g.downAt[r][c]) g.direction = "across";
            Game.render();
            Powers.aura(Game.cellEl(r, c), ["💨"], "drift", 3, 700);
        }
        if (f.me.twister > 0 && (f.twAcc = (f.twAcc || 0) + dt) >= 2) {    // Twister: Across and Down keep swapping
            f.twAcc = 0;
            const other = g.direction === "across" ? "down" : "across", cur = currentMyEntry();
            const halfRight = cur && Game.cellsOf(cur).filter(([r, c]) => g.letters[r][c] === g.puzzle.solution[r][c]).length * 2 >= Game.cellsOf(cur).length;
            if (!halfRight && (other === "across" ? g.acrossAt : g.downAt)[g.row][g.col]) { g.direction = other; Game.render(); }   // not inside a half-solved word
        }
        if (f.me.avalanche > 0 && (f.avAcc = (f.avAcc || 0) + dt) >= 1) {  // Avalanche: two more squares buried every second
            f.avAcc = 0;
            const safe = safeCells(), free = scopeAll().filter(([r, c]) => !f.snow.has(r + "," + c) && !safe.has(r + "," + c));   // finished words never get buried
            for (const [r, c] of free.sort(() => Math.random() - 0.5).slice(0, 2)) f.snow.add(r + "," + c);
        }
        if (f.me.confetti > 0 && (f.cfAcc = (f.cfAcc || 0) + dt) >= 2.5) {  // Confetti: the piles shift around
            f.cfAcc = 0;
            f.piles = new Set(scopeAll().filter(([r, c]) => !(f.swept && f.swept.has(r + "," + c))).sort(() => Math.random() - 0.5).slice(0, Math.ceil(scopeAll().length * 0.5)).map(([r, c]) => r + "," + c));
        }
        if (f.me.confetti > 0 && Math.random() < dt * 5) {
            const a = boardArea().getBoundingClientRect();
            FX.burst({ x: a.left + Math.random() * a.width, y: a.top, n: 12, colors: ["#ff5c6c", "#ffd23f", "#4fc3f7", "#7be36b", "#c08bff"], shape: "rect", speed: [40, 120], angle: Math.PI / 2, spread: 0.8, gravity: 260, life: [1.4, 2.2], size: [6, 11] });
        }
        if (f.me.flicker > 0 && (f.flAcc = (f.flAcc || 0) + dt) >= 0.5) {  // Cloud Cover: clouds drift over random squares
            f.flAcc = 0;
            const all = scopeAll();
            all.forEach(([r, c]) => { const el = Game.cellEl(r, c); if (el) el.classList.toggle("clouded", Math.random() < 0.45 && !(f.clearSky && f.clearSky.has(r + "," + c))); });
        } else if (!(f.me.flicker > 0)) document.querySelectorAll("#board .clouded").forEach(n => n.classList.remove("clouded"));
        if (f.me.quake > 0 && (f.qkAcc = (f.qkAcc || 0) + dt) >= 2) {      // Thunder Roll: a letter falls out every 2 seconds
            f.qkAcc = 0;
            const safe = safeCells(), loose = scopeAll().filter(([r, c]) => g.letters[r][c] && !Game.isLocked(r, c) && !safe.has(r + "," + c));   // finished words hold on
            if (loose.length) { const [r, c] = U.pick(loose); Game.setLetters([[r, c, ""]]); FX.shake(6, 300); }
        }
        if (f.me.minion > 0 && (f.minionAcc = (f.minionAcc || 0) + dt) >= 2.5) { f.minionAcc = 0; moveMinion(); }
        if (f.bombAt && (f.bombAt.t -= dt) <= 0) {                           // the Cannonball goes off
            const { r, c } = f.bombAt, n = g.puzzle.size;
            f.bombAt = null;
            const hit = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].map(([dr, dc]) => [r + dr, c + dc])
                .filter(([r2, c2]) => r2 >= 0 && c2 >= 0 && r2 < n && c2 < n && g.puzzle.solution[r2][c2] !== "." && g.letters[r2][c2] && !Game.isLocked(r2, c2));
            hit.forEach(([r2, c2]) => { const el = Game.cellEl(r2, c2); if (el) U.restart(el, "scorched"); });
            Game.setLetters(hit.map(([r2, c2]) => [r2, c2, ""]));
            const at = Game.cellEl(r, c);
            if (at) { const p = U.center(at); FX.burst({ x: p.x, y: p.y, n: 50, colors: ["#ff9f1c", "#ff3d00", "#ffd23f", "#2b2233"], shape: "star", speed: [150, 500], gravity: 300, life: [0.5, 1], size: [4, 9] }); }
            Sound.custom(Powers.MOVES.carnival.find(m => m.kind === "bomb").sound);
            FX.shake(12, 500);
        }
        if (f.curse && (f.curse.t -= dt) <= 0) {                              // Scorpion Sting: no word in time, and the poison wipes yours
            f.curse = null;
            const cells = Game.cellsOf(currentMyEntry()).filter(([r, c]) => g.letters[r][c] && !Game.isLocked(r, c));
            cells.forEach(([r, c]) => { const el = Game.cellEl(r, c); if (el) U.restart(el, "scorched"); });
            Game.setLetters(cells.map(([r, c]) => [r, c, ""]));
            floatText("The poison wiped your word 🦂", false);
        }
        if (f.combo > 1 && !(f.buff.lucky > 0) && now - f.lastWordAt > COMBO_GAP) f.combo = 0;
        updateHp();
        if (f.pending) {
            f.windup -= dt;
            if (f.windup <= 0) attack();
        } else if (f.puzzle) {
            f.nextMove -= dt;
            if (f.nextMove <= 0) { f.nextMove = f.th.every * (f.enraged ? 0.65 : 1) * (0.8 + Math.random() * 0.4); windUp(); }
        }
        applyMe();
        Game.markBossChanges(tickBefore);                   // letters that fell out, ran away, got eaten or blown up this tick
        drawFight();
    }, 100);

    function lose(why) {
        const f = fight;
        if (!f || f.over) return;
        // Extra Life: come back once (not when you give up yourself)
        if (f.extraLife && why !== "surrender") {
            f.extraLife = false;
            f.lifeUsed = true;
            for (let i = 0; i < 3; i++) { const last = f.done[f.done.length - 1]; if (last) wipe(Game.cellsOf(last), true); }
            f.word = null;
            refreshDone();
            Powers.banner({ icon: "🕹️", name: "EXTRA LIFE!", text: "The boss lost its last 3 words: the race goes on", color: "#4fdf6b", kicker: "1-UP" });
            Sound.custom(Powers.ABILITIES.find(a => a.kind === "extralife").sound);
            speak("WHAT? You're still here?!", 2400);
            drawFight();
            return;
        }
        f.over = true;
        f.pending = null;
        clearMe();
        warnEl.hidden = true;
        const b = bossOf(f.world);
        const text = { boss: ["The boss finished its puzzle first.", `${b.name} got there first!`, "The boss solved its whole board before you. Block its attacks by finishing words, and save an ability for when it's close."],
            surrender: ["You gave up this fight.", "Retreat!", "Every boss can be beaten. Try a different set of abilities from the shop."] }[why] || [];
        Game.endLoss({ title: why === "boss" ? `${b.name} wins` : "Gave up", text: text[0] });
        Sound.play("wrong");
        Sound.music("lose", { loop: false, v: 0.42, fade: 1 });           // game-over music
        FX.shake(10, 420);
        loseCard({ world: f.world, level: 5, kicker: why === "surrender" ? "BOSS FIGHT · GAVE UP" : "BOSS FIGHT · LOST", title: text[1], note: text[2], art: bossSvg(f.world) });
        speak(why === "surrender" ? U.pick(["Running away?", "Ha! I knew it!", "Come back when you're ready!"]) : U.pick(["Better luck next time!", "Too slow!", "Ha! Rematch?"]), 5000);
        drawFight();
    }

    Bus.on("puzzle", ({ fresh, puzzle, phase }) => {
        if (phase) { showPanel(); drawItemBar(); return; }               // a boss's phase 2: the same fight goes on
        if (isBossLevel(puzzle) && U.view() === "level" && !(Game.state.solved && !fresh)) startFight(fresh);
        else if (isBossLevel(puzzle) && U.view() === "level") showPanel();
        else { hidePanel(); }
        drawItemBar();
    });
    Bus.on("word", onWord);
    // a lesson's tip, when you start it fresh
    Bus.on("puzzle", ({ fresh, puzzle }) => {
        const c = current();
        if (!fresh || !c || c.level === 5 || !puzzle || puzzle.mode !== "campaign") return;
        const lesson = lessonOf(c.si, c.level);
        if (lesson) setTimeout(() => FX.toast({ icon: "📘", kicker: `LESSON · ${lesson.name.toUpperCase()}`, title: lesson.practise, text: `💡 ${lesson.tip}`, ms: 7000 }), 1200);
    });
    // a rerolled level says so, so a different puzzle after losing doesn't look like a mistake
    Bus.on("puzzle", ({ fresh, puzzle, phase }) => {
        const c = current();
        if (!fresh || phase || !c || c.special || !puzzle || puzzle.mode !== "campaign" || !tryOf(c.world, c.level) || data.levels[keyOf(c.world, c.level)]) return;
        setTimeout(() => FX.toast({ icon: "🎲", kicker: "A FRESH PUZZLE", title: "New board, new clues", text: "Every time you lose or give up, the level rerolls, so it's won by skill, not by memory.", ms: 5000 }), c.level === 5 ? 10000 : 300);
    });
    Bus.on("surrender", () => {
        if (fight && !fight.over && isBossLevel(Game.state.puzzle)) { fight.over = true; fight.pending = null; clearMe(); drawFight(); }
        const p = Game.state.puzzle;
        if (p && p.mode === "campaign" && data.playing) rerollOnce(data.playing.world, data.playing.level);   // Reveal puzzle = giving up
    });
    // one reroll per puzzle lost (losing a fight and then seeing the card mustn't count twice)
    let lostSeed = null;
    function rerollOnce(world, level) {
        if (special()) return;                           // the Daily Boss is the same for everyone; Unlimited is new every time anyway
        const p = Game.state.puzzle, id = world + level + ":" + (p ? p.seed : "");
        if (lostSeed === id) return;
        lostSeed = id;
        reroll(world, level);
    }

    // Phase 2 (the user's design): solving the boss's first puzzle doesn't end the fight. The boss powers up full screen,
    // you get a bigger puzzle (a Challenge grid instead of a normal 5x5, or a bigger Expert grid), and the boss starts
    // over on the board you just solved: a new race, a little faster and angrier every phase.
    // The user's rule (2026-10-09): the next phase ALWAYS starts the moment you finish a board (if its puzzle is still
    // being made, the boss powers up and you wait for it; only if it can't be made at all does the fight end there).
    // TEMPORARY (the user asked for it, for testing): skip straight to the boss's next phase. Remove before deploying.
    const skipBtn = document.getElementById("test-skip-phase");
    skipBtn.addEventListener("click", () => {
        skipBtn.blur();
        if (!fight || fight.over || fight.switching || !isBossLevel(Game.state.puzzle) || Game.state.solved) return;
        if (fight.phase >= fight.phases) { FX.toast({ icon: "🧪", kicker: "TEST", title: "This is the last phase", text: "Use Win (test) to finish the fight.", ms: 2200 }); return; }
        nextPhase(Game.state);
    });
    function nextPhase(game) {
        if (!fight || fight.over || fight.switching || fight.phase >= fight.phases || !isBossLevel(game.puzzle) || U.view() !== "level") return false;
        fight.switching = true;
        fight.closest = Math.max(fight.closest, bossPct());          // how close the boss got (stars)
        switchPhase();
        return true;
    }
    async function switchPhase() {
        const f = fight, c = current(), k = f.phase + 1, [d2, s2] = laterPhases(map && c && map[c.si])[k - 2] || ["expert", 9];
        f.pending = null;
        f.windup = 0;
        clearMe();
        warnEl.hidden = true;
        const portrait = portraitEl();
        // each phase has its own, more intense song (audio/CREDITS.txt); its build-up plays during the power-up
        Sound.music(f.world + "-p" + k, { v: 0.4, fade: 0.5 });
        const final = k === f.phases && f.phases > 2;
        await FX.cinematic(cc => Bosses.phase(cc, f.world, `${label(d2, s2)}!`, final ? "The final phase. Everything it has left." : "A bigger puzzle for you. The boss starts over on the board you just solved.",
            { phase: k, phases: f.phases, until: () => Sound.buildDone() }));
        if (fight !== f || f.over) return;
        if (!f.next[k]) {                                   // still being made: cover the board and wait
            waiting(true);
            const pz = await (f.fetches && f.fetches[k] ? f.fetches[k].catch(() => null) : null);
            waiting(false);
            if (fight !== f || f.over) return;
            if (!pz) {                                      // it couldn't be made: the fight ends with the boards you've beaten
                f.phases = f.phase;
                f.switching = false;
                FX.toast({ icon: "⚠️", kicker: "BOSS FIGHT", title: "The next phase couldn't load", text: "You win this one as it stands.", ms: 4000 });
                Game.checkWin();
                return;
            }
            f.next[k] = Object.assign(pz, { mode: "campaign", world: f.world, level: 5, phase: k });
        }
        const p1 = Game.state.puzzle;
        Game.startPhase(f.next[k]);
        f.phase = k;
        f.switching = false;
        // every phase is angrier than the one before: it attacks more often, winds up faster and hits harder
        f.th = { ...f.th, every: f.th.every * 0.88, windup: Math.max(1.6, f.th.windup * 0.92), power: f.th.power * 1.08 };
        setBossPuzzle(p1, p1.seed + 7);                 // the boss's new board: the one you just solved
        f.boss = {};
        f.myLog = [];
        f.botTime = botTimeFor(d2, s2, c ? c.si : 0, k);
        f.drips = [];
        if (f.enraged) setEnraged(false);
        f.nextMove = Math.max(6, f.th.first * 0.6);
        Bosses.arena(f.world, f.id).classList.add("phase2");
        Bosses.chaos(f.world, k - 1);                   // the arena goes wilder with every phase
        if (k < f.phases) setTimeout(() => fight === f && Sound.preloadMusic(f.world + "-p" + (k + 1)), 9000);
        drawPanel(true);
        updateHp();
        speak(final ? U.pick(["THIS ENDS NOW!", "You'll never finish this one!", "My final form!"]) : U.pick(["You think that was hard?!", "Now I'm serious!", `Round ${k}!`]), 3000);
        Sound.play("start");
    }

    // The boss is beaten: it shatters full screen, then the world's own win animation plays
    async function bossFinale(c) {
        if (!fight) return;
        fight.over = true;
        fight.pending = null;
        clearMe();
        warnEl.hidden = true;
        drawFight();
        panel.classList.add("ko");
        Sound.music("win", { loop: false, v: 0.45, fade: 0.6 });          // victory music
        Sound.sample("ko", { v: 0.6 });
        await c.wait(250);
        await Bosses.ko(c, fight.world);
    }
    // stars for a boss: how close it got (its board, the moment you finished each of yours)
    const STAR_CLOSE = [0.85, 0.6];
    function bossStars() {
        if (!fight) return 1;
        const close = Math.max(fight.closest, bossPct());
        return close <= STAR_CLOSE[1] ? 3 : close <= STAR_CLOSE[0] ? 2 : 1;
    }


    // ---------------------------------------------------------------------------------------------
    // The mascot's lines in the campaign (the user asked for dialogue that fits): it talks about the lesson you're
    // on, the boss you're fighting and the Lexicon's story. null = use its normal line.
    // ---------------------------------------------------------------------------------------------
    const SKILL_WORD = {
        definitions: ["That's a straight definition, cracked!", "Plain clue, plain answer. Nailed it."], blanks: ["The phrase filled itself in!", "Hum the phrase, fill the blank. Perfect."],
        plurals: ["Plural clue, plural answer. You spotted it!", "See that S at the end? That's the trick."], tense: ["You matched the tense!", "-ED clue, -ED answer. Nice."],
        crossings: ["The crossings gave it away. That's the pro move.", "Down helped Across. Exactly right."], synonyms: ["Same meaning, same part of speech. Got it!"],
        categories: ["Example and category: you read the direction right!"], speech: ["You heard that one out loud!"], speed: ["Keep moving, keep moving!", "Fast! Don't stop now."],
        wordplay: ["You didn't take the '?' literally. Clever!"], double: ["The OTHER meaning! You saw through it."], misdirection: ["It tried to trick you and you didn't fall for it."],
        parts: ["You read the grammar. That's how pros do it."], theme: ["That one fits the theme!"], long: ["A long one! That opens the whole grid."],
        clean: ["Careful and clean. No checking needed."], mixed: ["Every trick in the book!"]
    };
    function mascotLine(event, info) {
        const v = U.view();
        if (v === "campaign") {
            if (event === "start" || event === "hello") { const f = map ? frontier() : null; return f ? `${Worlds.byId[map[f.si].world].name}'s page of the Lexicon is waiting. Next up: ${f.level === 5 ? bossOf(map[f.si].world).name : "Level " + f.level}.` : null; }
            return null;
        }
        if (v !== "level" || !data.playing) return null;
        const c = current();
        if (!c) return null;
        const boss = c.level === 5, lesson = lessonOf(c.si, c.level), b = bossOf(c.world);
        switch (event) {
            case "start": return boss ? `${b.name} has the ${Worlds.byId[c.world].name} page. It's a race: solve your board before it solves its own. Finish a word fast when it winds up an attack!`
                : lesson ? `Lesson: ${lesson.name}. ${lesson.tip}` : null;
            case "word": return boss ? U.pick(["Pulling ahead!", "Push, push!", "Keep the combo going!", "It can't keep up!"]) : lesson && SKILL_WORD[lesson.id] ? U.pick(SKILL_WORD[lesson.id]) : null;
            case "idle": return boss ? U.pick(["Try an ability: keys 1, 2 and 3!", "A word finished fast blocks its next attack!", "Fill the short words first, they cross the long ones."]) : lesson ? `Remember the lesson: ${lesson.tip}` : null;
            case "wrong": return lesson && lesson.id === "clean" ? "Careful: only trust letters that work across AND down." : null;
            case "surrender": return boss ? `${b.name} keeps the page for now. Try different abilities from the shop!` : "Every pro has had a tough level. Try it again with the tip in mind.";
            case "win": {
                const cm = info && info.campaign;
                if (!cm) return null;
                if (cm.boss) return cm.finished ? "The Lexicon is whole again! Every word is back. You did it!" : `You won back the ${Worlds.byId[c.world].name} page! ${cm.newWorld ? `On to ${cm.newWorld.name}.` : ""}`;
                const next = cm.next && cm.next.world === c.world && cm.next.level < 5 ? lessonOf(c.si, cm.next.level) : null;
                const stars = cm.stars === 3 ? "Three stars: lesson mastered!" : `${cm.stars} star${cm.stars > 1 ? "s" : ""}. Replay it for the rest.`;
                return `${stars}${next ? ` Next lesson: ${next.name}.` : cm.next && cm.next.level === 5 ? ` Next: ${b.name}!` : ""}`;
            }
            default: return null;
        }
    }

    // ---------------------------------------------------------------------------------------------
    // The home screen's campaign card
    // ---------------------------------------------------------------------------------------------
    // the Home screen: today's boss, under the Challenge in the Daily card (and a random boss in the Unlimited card)
    async function drawHomeBoss() {
        const chip = $("#home-daily-boss");
        if (!chip) return;
        const world = await fetch(`/api/boss/daily?date=${dayStr()}`).then(r => (r.ok ? r.json() : null)).then(r => r && r.world).catch(() => null);
        if (!world || !Bosses.info(world)) { chip.hidden = true; return; }
        const b = bossOf(world), w = Worlds.byId[world], stars = ((data.specials || {})["daily-" + dayStr()]) || 0;
        chip.hidden = false;
        chip.style.setProperty("--boss", b.color);
        chip.querySelector(".bchip-art").innerHTML = bossSvg(world);
        chip.querySelector(".chip-name").textContent = "Today's Boss: " + b.name;
        chip.querySelector(".chip-sub").textContent = `${w ? w.name : ""} · a boss race, the same for everyone`;
        chip.querySelector(".chip-state").textContent = stars ? `✓ Beaten ${"★".repeat(stars)}${"☆".repeat(3 - stars)} · fight again ▶` : "Fight ▶";
        chip.classList.toggle("done", !!stars);
    }
    $("#home-daily-boss") && $("#home-daily-boss").addEventListener("click", () => playSpecial("daily"));
    async function drawHomeCard() {
        drawHomeBoss();
        const el = $("#home-campaign");
        if (!el) return;
        try { await fetchMap(); } catch (err) { el.textContent = "The campaign map couldn't be loaded."; return; }
        const t = totals(), f = frontier(), w = Worlds.byId[map[f.si].world];
        el.innerHTML = "";
        const done = t.levels >= t.max;
        el.append(
            U.el("div", { class: "hc-bar", style: { "--k": (t.levels / t.max).toFixed(3) } }, U.el("i")),
            U.el("p", { class: "hc-line", text: `${t.levels} of ${t.max} levels · ${t.stars} ★` }),
            U.el("a", { class: "btn primary", href: "#campaign", text: done ? "See the map ▶" : t.levels ? `Continue: ${w.icon} ${w.name}, ${f.level === 5 ? "Boss" : "Level " + f.level} ▶` : "Start the adventure ▶",
                onclick: () => { data.section = f.si; data.sel = f.level; data.playing = null; save(); } }));
    }

    // ---------------------------------------------------------------------------------------------
    // Buttons and keys on the map page
    // ---------------------------------------------------------------------------------------------
    $("#cm-shop").addEventListener("click", () => openShop("items"));
    $("#cm-skills").addEventListener("click", () => openSkills());
    $("#cm-book").addEventListener("click", () => { Sound.play("select"); Story.openBook(storyPages(), { onReplay: () => FX.cinematic(c => Story.intro(c, storyPages())) }); });
    // The story (story.js): the Lexicon's pages, one per world, won back by beating its boss
    function storyPages() {
        return (map || []).map(s => ({ world: s.world, name: Worlds.byId[s.world] ? Worlds.byId[s.world].name : s.world, boss: bossOf(s.world).name,
            color: bossOf(s.world).color, won: !!data.levels[keyOf(s.world, 5)] }));
    }
    // after a boss's first defeat: its page flies into the book (and the finale, once every page is back)
    async function storyAfterBoss(c, info) {
        const cm = info && info.campaign;
        if (!cm || !cm.boss || !cm.firstClear || !map) return;
        const pages = storyPages();
        await Story.page(c, pages, cm.world);
        if (!c.skipped && pages.every(p => p.won)) { await c.wait(300); await Story.finale(c, pages); }
    }
    // The skill book: every skill in the course, where it's taught, and how well you've done (3 stars everywhere = mastered)
    function openSkills() {
        const skills = new Map();
        map.forEach((s, si) => (s.lessons || []).forEach((lesson, i) => {
            if (!lesson || lesson.id === "review") return;
            if (!skills.has(lesson.id)) skills.set(lesson.id, { lesson, levels: [] });
            skills.get(lesson.id).levels.push({ si, level: i + 1, world: s.world, name: lesson.name });
        }));
        const modal = U.el("div", { class: "results shop-page", role: "dialog", "aria-modal": "true", "aria-labelledby": "skills-title" });
        const card = U.el("div", { class: "shop-card" });
        const close = () => { modal.classList.remove("in"); modal.classList.add("out"); setTimeout(() => modal.remove(), 300); };
        let mastered = 0;
        const list = U.el("div", { class: "skill-list" });
        for (const { lesson, levels } of skills.values()) {
            const stars = levels.map(x => (record(x.si, x.level) || {}).stars || 0), done = stars.every(n => n === 3);
            if (done) mastered++;
            list.appendChild(U.el("div", { class: "skill-card" + (done ? " mastered" : "") },
                U.el("div", { class: "sk-head" }, U.el("b", { text: lesson.name.replace(/ I+$/, "") }), U.el("span", { class: "sk-badge", text: done ? "🏅 Mastered" : `${stars.filter(n => n === 3).length}/${levels.length} perfect` })),
                U.el("p", { text: lesson.practise }),
                U.el("p", { class: "cm-tip", text: `💡 ${lesson.tip}` }),
                U.el("div", { class: "sk-levels" }, ...levels.map((x, k) => U.el("button", { type: "button", class: "sk-level", title: `Play ${Worlds.byId[x.world].name} ${x.level}`,
                    text: `${Worlds.byId[x.world].icon} ${x.si + 1}-${x.level} ${"★".repeat(stars[k])}${"☆".repeat(3 - stars[k])}`,
                    onclick: () => { close(); data.section = x.si; data.sel = x.level; save(); drawBar(); drawDetail(); drawDynamic(); scrollToLevel(x.si, x.level, true); } })))));
        }
        card.append(U.el("div", { class: "shop-head" },
            U.el("div", { class: "shop-title" }, U.el("small", { text: "THE COURSE" }), U.el("h2", { id: "skills-title", text: "Skill book" })),
            U.el("span", { class: "shop-coins", text: `🏅 ${mastered} / ${skills.size} mastered` }),
            U.el("button", { type: "button", class: "btn ghost small", text: "Close ✕", onclick: close })),
            U.el("div", { class: "shop-scroll" }, U.el("p", { class: "shop-note", text: "Every level teaches one skill, and the skills come back later, harder. Get 3 stars on every level of a skill to master it. Master them all and you're a pro." }), list));
        modal.appendChild(card);
        modal.addEventListener("pointerdown", e => { if (e.target === modal) close(); });
        modal.addEventListener("keydown", e => { if (e.key === "Escape") { e.stopPropagation(); close(); } });
        document.getElementById("overlay").appendChild(modal);
        requestAnimationFrame(() => modal.classList.add("in"));
        Sound.play("select");
    }
    addEventListener("keydown", e => {
        if (U.view() !== "campaign" || !map || e.ctrlKey || e.metaKey || e.altKey || document.querySelector("#overlay .results")) return;
        if (e.key === "Escape" && sheetOpen) { e.preventDefault(); closeSheet(); }
    });

    return {
        onView, showMap, play, playSpecial, backToMode, ready: fetchMap, storyPages, storyAfterBoss, playIntro: () => FX.cinematic(c => Story.intro(c, storyPages())), nextPhase, next, slotName, apiUrl, titles, cardInfo, onWin, bestLine, bossFinale, drawHomeCard, bossSvg, openShop,
        isBossLevel, mascotLine, abilities: ABILITIES, items: ITEMS, unlockedAbilities, useItem, useAbility,
        testMove: mv => { if (fightOn()) { fight.pending = mv; attack(); } },          // for automated tests
        testWindUp: mv => { if (fightOn()) windUp(false, mv); },
        get playing() { return data.playing; }, get fight() { return fight; }
    };
})();
