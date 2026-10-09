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
// A boss fight is a race against a bot: stars for how much of your clock is left. Each world has three abilities
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
    let fadeTimer = 0;
    function swapWorld(si, instant = false) {
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
        box.classList.toggle("boss", boss);
        box.style.setProperty("--c", boss ? bossOf(s.world).color : biome(s.world).node);
        box.appendChild(U.el("button", { type: "button", class: "cm-sheet-close", "aria-label": "Close", text: "×", onclick: closeSheet }));
        if (boss) box.appendChild(U.el("div", { class: "cm-detail-art", html: bossSvg(s.world) }));
        const body = U.el("div", { class: "cm-detail-body" });
        box.appendChild(body);
        body.appendChild(U.el("small", { class: "cm-detail-kicker", text: `WORLD ${si + 1} · ${boss ? "BOSS BATTLE" : "LEVEL " + l} · ${label(d, sizeOf(s, l)).toUpperCase()}` }));
        body.appendChild(U.el("h2", { text: boss ? bossOf(s.world).name : `${Worlds.byId[s.world].name} ${l}` }));
        if (boss) body.appendChild(U.el("p", { class: "cm-taunt", text: `"${bossOf(s.world).taunt}"` }));
        body.appendChild(U.el("p", { class: "cm-rules", text: boss
            ? `A race in two phases: solve the boss's puzzle, then a bigger ${label(...phase2Of(s))} in phase 2, before the boss solves its own boards. Every word you finish hits it; chain words for combos and charge your Super. When it winds up an attack, finish a word to block it.`
            : `Three stars: solve it, don't use Reveal, and finish in under ${U.fmtTime(par(d, sizeOf(s, l)))}.` }));
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
    function closeSheet() {
        const box = $("#cm-detail");
        sheetOpen = false;
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
        const target = data.playing && map.some(s => s.world === data.playing.world)
            ? { si: map.findIndex(s => s.world === data.playing.world), level: data.playing.level } : f;
        requestAnimationFrame(() => scrollToLevel(target.si, target.level, false));
        if (!shownOnce) {
            shownOnce = true;
            const w = Worlds.byId[map[f.si].world];
            setTimeout(() => Mascot.say(`Scroll down the map! Next up: ${w.name}, ${f.level === 5 ? "the boss" : "level " + f.level}.`, { mood: "wow", hold: 4500 }), 600);
        }
    }
    let shownOnce = false;
    function closeSheetQuiet() { sheetOpen = false; const box = $("#cm-detail"); box.classList.remove("in"); box.hidden = true; }

    function play(world, level) {
        data.playing = { world, level };
        save();
        if (level === 5) fight = null;                 // a boss fight always starts from the beginning
        Sound.play("start");
        // a level that was finished (or given up) starts again from scratch
        Game.restartSlot(slotName());
        if (U.view() === "level") Game.show("level");
        else location.hash = "#level";
    }

    const slotName = () => data.playing ? "campaign-" + keyOf(data.playing.world, data.playing.level) : "campaign-none";
    function apiUrl() {
        const p = data.playing;
        return `/api/campaign?world=${encodeURIComponent(p.world)}&level=${p.level}`;
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
        if (c.level === 5) return { title: "Boss: " + bossOf(c.world).name, sub: `${w.name} · World ${c.si + 1} · beat the boss to open the next world` };
        return { title: `${w.name} · Level ${c.level}`, sub: `World ${c.si + 1} of ${map ? map.length : 15}` + (c.difficulty ? ` · ${label(c.difficulty, c.size)}` : "") };
    }
    function cardInfo(puzzle) {
        const c = current(), w = c && Worlds.byId[c.world];
        if (!w) return null;
        const boss = c.level === 5;
        return {
            mode: "campaign", difficulty: puzzle.difficulty, stage: `WORLD ${c.si + 1}-${c.level}`,
            kicker: boss ? `WORLD ${c.si + 1} · BOSS BATTLE` : `WORLD ${c.si + 1} · LEVEL ${c.level}`,
            title: boss ? bossOf(c.world).name : w.name,
            sub: boss ? bossOf(c.world).taunt : `${label(puzzle.difficulty, puzzle.size)} · three stars under ${U.fmtTime(par(puzzle.difficulty, puzzle.size))}`,
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
        const boss = c.level === 5, d = puzzle.difficulty;
        const earned = [];
        let stars;
        if (skipping) {
            stars = 1;
            earned.push(["Cleared with a Level Clear", true]);
        } else if (boss) {
            stars = bossStars();
            const left = fight ? Math.max(0, fight.limit - game.seconds) : 0;
            earned.push(["Beat the boss", true], [`Time left: ${U.fmtTime(left)}`, stars >= 2], ["Half your clock left", stars >= 3]);
            if (fight && fight.phase === 2) earned.push(["Beat both phases", true]);
            if (fight && fight.bestCombo > 1) earned.push([`Best combo: ×${fight.bestCombo}`, true]);
        } else {
            const limit = par(d, puzzle.size), noReveal = !game.squaresRevealed, quick = game.seconds <= limit;
            stars = 1 + (noReveal ? 1 : 0) + (quick ? 1 : 0);
            earned.push(["Solved it", true], ["No Reveal used", noReveal], [`Under ${U.fmtTime(limit)}`, quick]);
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
        return {
            campaign: { stars, best: data.levels[key].stars, earned, boss, firstClear, next, world: c.world, level: c.level, si: c.si, coins, totalCoins: data.coins,
                newWorld: boss && firstClear && next ? Worlds.byId[next.world] : null, finished: boss && c.si === map.length - 1, newAbility, freeUses: FREE_USES }
        };
    }
    function bestLine() {
        const c = current();
        if (!c) return "";
        const rec = data.levels[keyOf(c.world, c.level)];
        return rec ? `Best: ${"★".repeat(rec.stars)}${"☆".repeat(3 - rec.stars)} · ${U.fmtTime(rec.seconds || 0)}` : `World ${c.si + 1} · ${c.level === 5 ? "Boss" : "Level " + c.level}`;
    }
    function next(n) {
        if (!n) { location.hash = "#campaign"; return; }
        if (n.level === 1) { data.playing = { world: n.world, level: 1 }; save(); location.hash = "#campaign"; return; }   // a new world: see it on the map first
        play(n.world, n.level);
    }

    // ---------------------------------------------------------------------------------------------
    // Abilities (boss fights): 3 per world. What each kind does:
    //   freeze  the boss stops typing             slow   the boss types at a third of its speed
    //   blind   the boss stops AND loses its place (its unfinished word is wiped)
    //   erase   the boss's last finished word is wiped     shield  blocks the boss's next attack
    //   time    more time on your clock                    hint    right letters appear in your puzzle
    // ---------------------------------------------------------------------------------------------
    const KIND_TEXT = {
        freeze: d => `Freezes the boss for ${d}s.`, slow: d => `The boss writes at a third of its speed for ${d}s.`,
        blind: d => `Blinds the boss for ${d}s: it stops and loses its place in its word.`, erase: () => "Wipes the boss's last finished word.",
        shield: () => "Blocks the boss's next attack.", time: d => `Adds ${d}s to your clock.`, hint: d => `Fills in ${d} right letter${d > 1 ? "s" : ""} in your puzzle.`
    };
    // world, id, name, icon, kind, strength, a description in the world's own words
    const ABILITY_LIST = [
        ["paper", "ink", "Ink Splat", "🖋️", "blind", 6, "Flick a fat blot of ink right across the boss's page."],
        ["paper", "rub", "Eraser Rub", "🩹", "erase", 0, "Rub out the last word the boss wrote. It has to write it all over again."],
        ["paper", "wall", "Paper Wall", "📄", "shield", 0, "Fold a wall of paper that soaks up the boss's next attack."],
        ["garden", "pollen", "Pollen Puff", "🌼", "blind", 7, "A sneezy cloud of pollen: the boss can't see and forgets where it was."],
        ["garden", "vine", "Vine Snare", "🌿", "freeze", 6, "Vines wrap around the boss's hands so it can't write."],
        ["garden", "sun", "Sunny Hour", "☀️", "time", 30, "Warm sunshine slows the day down: more time on your clock."],
        ["squirrel", "acorn", "Acorn Toss", "🌰", "freeze", 5, "Bonk! An acorn to the head stuns the boss for a moment."],
        ["squirrel", "leaves", "Leaf Pile", "🍂", "blind", 7, "Bury the boss's board under a big heap of autumn leaves."],
        ["squirrel", "stash", "Stash Peek", "🐿️", "hint", 2, "Peek into the squirrels' secret stash: right letters appear in your puzzle."],
        ["candy", "taffy", "Sticky Taffy", "🍬", "slow", 10, "Gooey taffy all over the boss's pencil: it writes at a crawl."],
        ["candy", "rush", "Sugar Rush", "🍭", "time", 35, "A burst of sugar energy: extra time on your clock."],
        ["candy", "gumdrop", "Gumdrop Wall", "🧁", "shield", 0, "A bouncy gumdrop wall bounces the boss's next attack away."],
        ["ocean", "inkcloud", "Ink Cloud", "🦑", "blind", 8, "Squid ink! The boss is lost in a dark cloud."],
        ["ocean", "bubble", "Bubble Trap", "🫧", "freeze", 7, "Trap the boss in a bubble. It floats around, unable to write."],
        ["ocean", "tide", "Tide Pull", "🌊", "erase", 0, "The tide washes the boss's last finished word right off its board."],
        ["snow", "snowball", "Snowball", "⛄", "freeze", 6, "A snowball to the face freezes the boss in place."],
        ["snow", "blizzard", "Blizzard", "🌨️", "blind", 8, "A whiteout storm: the boss can't see its own board."],
        ["snow", "icewall", "Ice Wall", "🧊", "shield", 0, "A wall of solid ice blocks the boss's next attack."],
        ["rain", "puddle", "Puddle Splash", "💦", "slow", 12, "Soak the boss's paper: it writes slowly while it dries."],
        ["rain", "thunder", "Thunderclap", "⚡", "freeze", 7, "A crack of thunder makes the boss freeze in fright."],
        ["rain", "rainbow", "Rainbow Peek", "🌈", "hint", 3, "Follow the rainbow: right letters appear in your puzzle."],
        ["sky", "gust", "Gust", "🌬️", "erase", 0, "A gust of wind blows the boss's last word clean off its board."],
        ["sky", "cloud", "Cloud Cover", "☁️", "blind", 9, "Hide the boss's board behind a thick, fluffy cloud."],
        ["sky", "tailwind", "Tailwind", "🪁", "time", 40, "Ride the tailwind: lots of extra time on your clock."],
        ["desert", "sandstorm", "Sandstorm", "🏜️", "blind", 9, "Sand in its eyes: the boss stops and loses its place."],
        ["desert", "quicksand", "Quicksand", "⏳", "slow", 14, "The boss sinks into quicksand and can barely move its pencil."],
        ["desert", "mirage", "Mirage", "🪞", "shield", 0, "A shimmering mirage tricks the boss's next attack into missing."],
        ["carnival", "pie", "Pie in the Face", "🥧", "blind", 9, "Splat! A cream pie to the face blinds the boss."],
        ["carnival", "juggle", "Juggling Act", "🤹", "freeze", 8, "The boss can't help stopping to watch your juggling act."],
        ["carnival", "cotton", "Cotton Candy", "🍡", "slow", 14, "Sticky cotton candy fingers: the boss writes slowly."],
        ["arcade", "glitchbomb", "Glitch Bomb", "👾", "erase", 0, "A glitch corrupts the boss's last finished word into nothing."],
        ["arcade", "pause", "Pause Button", "⏸️", "freeze", 9, "Press pause on the boss (and only the boss)."],
        ["arcade", "extralife", "Extra Life", "🕹️", "time", 45, "1-UP! A big chunk of extra time on your clock."],
        ["robot", "emp", "EMP", "🔌", "freeze", 10, "An electric pulse shuts the boss down for a while."],
        ["robot", "oil", "Oil Slick", "🛢️", "slow", 16, "The boss's gears slip in a puddle of oil: very slow writing."],
        ["robot", "field", "Force Field", "🛡️", "shield", 0, "A humming force field absorbs the boss's next attack."],
        ["library", "dust", "Dust Cloud", "📚", "blind", 10, "Clap two old books together: a cloud of dust blinds the boss."],
        ["library", "shush", "Shush!", "🤫", "freeze", 9, "SHHH! The boss freezes, embarrassed."],
        ["library", "bookmark", "Bookmark", "🔖", "hint", 3, "Your bookmark remembers the answers: right letters appear."],
        ["volcano", "ash", "Ash Cloud", "🌋", "blind", 11, "A cloud of volcanic ash smothers the boss's board."],
        ["volcano", "lava", "Lava Flow", "🔥", "erase", 0, "Lava melts the boss's last finished word away."],
        ["volcano", "cool", "Cool Down", "🧯", "time", 50, "Cool off: a huge chunk of extra time on your clock."],
        ["space", "blackhole", "Black Hole", "🕳️", "erase", 0, "A tiny black hole swallows the boss's last finished word."],
        ["space", "warp", "Time Warp", "🌀", "slow", 18, "Bend time around the boss: it writes very, very slowly."],
        ["space", "starlight", "Starlight", "✨", "hint", 4, "Starlight shows the way: right letters appear in your puzzle."]
    ];
    const WORLD_ORDER = ["paper", "garden", "squirrel", "candy", "ocean", "snow", "rain", "sky", "desert", "carnival", "arcade", "robot", "library", "volcano", "space"];
    const ABILITIES = ABILITY_LIST.map(([world, id, name, icon, kind, d, flavor]) => {
        const tier = WORLD_ORDER.indexOf(world);
        return { id: world + "-" + id, world, name, icon, kind, d, flavor, price: 30 + tier * 8 + (kind === "erase" || kind === "hint" ? 15 : 0), desc: KIND_TEXT[kind](d) };
    });
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
        { id: "pause", icon: "⏸️", name: "Time Stop", price: 35, desc: "Stops your clock for 30 seconds. In a boss fight the boss keeps going, but your time limit waits." },
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
        const list = (data.loadout || []).filter(id => abilityById[id] && unlockedAbility(abilityById[id]));
        if (list.length) return list.slice(0, 3);
        const here = data.playing ? ABILITIES.filter(a => a.world === data.playing.world && unlockedAbility(a)) : [];
        return (here.length ? here : unlockedAbilities().slice(-3)).map(a => a.id);
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
            const scroll = U.el("div", { class: "shop-scroll" });
            card.appendChild(scroll);
            const buy = (price, give) => () => { if (data.coins < price) return; data.coins -= price; give(); save(); Sound.play("coin"); draw(); };
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
                scroll.appendChild(U.el("div", { class: "shop-loadout" }, U.el("b", { text: "Bringing:" }),
                    ...(eq.length ? eq.map((id, i) => U.el("span", { class: "shop-eq", text: `${i + 1}. ${abilityById[id].icon} ${abilityById[id].name} ×${data.owned[id] || 0}` }))
                        : [U.el("span", { class: "shop-eq none", text: "Nothing yet: clear Level 1 to unlock your first ability" })])));
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
    }
    function useItem(id) {
        const it = itemById[id];
        if (!it || U.view() !== "level" || !Game.state.puzzle || Game.state.solved || (data.items[id] || 0) <= 0) return;
        const boss = data.playing && data.playing.level === 5;
        let n = 0, text = "";
        if (id === "letter") { n = Game.revealFree("square"); text = "The right letter is in."; }
        if (id === "word") { n = Game.revealFree("word"); text = `${n} letter${n === 1 ? "" : "s"} filled in.`; }
        if (id === "clear") { n = Game.clearWrong(); text = `${n} wrong letter${n === 1 ? "" : "s"} wiped.`; }
        if (id === "lock") { n = Game.lockRight(); text = `${n} letter${n === 1 ? "" : "s"} locked in.`; }
        if (id === "pause") { Game.stopClock(30); n = 1; text = "Your clock stops for 30 seconds."; }
        if (id === "skip") {
            if (boss) { FX.toast({ icon: it.icon, kicker: "NOT HERE", title: it.name, text: "Level Clear doesn't work on bosses.", ms: 2200 }); return; }
            skipping = true; data.items[id]--; save();
            Game.revealFree("puzzle");
            return;
        }
        if (!n) { FX.toast({ icon: it.icon, kicker: "NOTHING TO DO", title: it.name, text: id === "clear" ? "No wrong letters on the board." : id === "lock" ? "No unlocked right letters yet." : "That square is already right.", ms: 2200 }); return; }
        data.items[id]--;
        save();
        Sound.play("sparkle");
        FX.toast({ icon: it.icon, kicker: "ITEM USED", title: it.name, text, ms: 2000 });
        drawItemBar();
    }

    // ---------------------------------------------------------------------------------------------
    // Boss fights: a 1v1 race against a bot that solves its own puzzle next to yours. Solve yours first, before
    // your clock runs out. Made interactive (the user asked for more):
    //   - every word you finish HITS the boss (its HP bar is your puzzle still to solve), with damage numbers
    //   - words finished close together build a COMBO, and combos charge your SUPER (key 4): a big full-screen strike
    //   - the boss WINDS UP its attacks for a few seconds: finish a word in time to BLOCK it
    //   - under a third of its HP left, the boss gets ENRAGED: faster, angrier, and the arena turns red
    //   - the fight is shown full screen: an arena behind everything, a VS intro, attack cut-ins and a K.O.
    // ---------------------------------------------------------------------------------------------
    // What each boss does to YOU: blind (your board blurs), scramble (clues jumbled), freeze (you can't type),
    // smudge (your letters go invisible), erase (a few of your letters are wiped, never locked ones)
    const BOSS_MOVES = {
        paper: [["Rub Out", "erase", 3], ["Smudge", "smudge", 6]], garden: [["Thorn Tangle", "freeze", 3], ["Petal Storm", "blind", 5]],
        squirrel: [["Hoot Hoot", "scramble", 7], ["Night Eyes", "blind", 5]], candy: [["Sour Splash", "smudge", 6], ["Sticky Floor", "freeze", 3]],
        ocean: [["Ink Jet", "blind", 6], ["Whirlpool", "scramble", 8]], snow: [["Deep Freeze", "freeze", 4], ["Whiteout", "blind", 6]],
        rain: [["Lightning", "erase", 3], ["Fog Bank", "blind", 6]], sky: [["Gale", "scramble", 8], ["Twister", "erase", 3]],
        desert: [["Riddle", "scramble", 9], ["Sand Blast", "blind", 7]], carnival: [["Funhouse Mirror", "scramble", 9], ["Spotlight", "blind", 7]],
        arcade: [["Glitch", "smudge", 8], ["Lag Spike", "freeze", 4]], robot: [["System Lock", "freeze", 5], ["Static", "smudge", 8]],
        library: [["Shhh!", "freeze", 5], ["Lights Out", "blind", 8]], volcano: [["Eruption", "erase", 4], ["Smoke", "blind", 8]],
        space: [["Gravity Well", "freeze", 5], ["Event Horizon", "scramble", 10], ["Collapse", "erase", 4]]
    };
    const MOVE_ICON = { blind: "🙈", scramble: "🔀", freeze: "❄️", smudge: "👻", erase: "💥" };
    const MOVE_TEXT = { blind: "Your board is blurred", scramble: "Your clues are jumbled", freeze: "You can't type", smudge: "Your letters are invisible", erase: "Letters wiped" };
    const WINDUP = 3.2;               // seconds of warning before an attack lands
    const COMBO_GAP = 15000;          // ms between words to keep a combo going
    const ENRAGE_AT = 34;             // boss HP (%) that makes it angry

    // how long the boss takes to solve its puzzle: the level's par time times this (your time limit is 10% more)
    const BOT_PACE = { easy: 1.4, medium: 1.15, hard: 1, challenge: 1.05, expert: 0.95 };
    const BOSS_EVERY = { easy: 34, medium: 30, hard: 27, challenge: 30, expert: 26 };       // seconds between the boss's attacks

    let fight = null;
    const panel = U.el("aside", { class: "boss-panel", hidden: true, "aria-label": "The boss" });
    document.getElementById("puzzle").appendChild(panel);
    const meStatus = U.el("div", { class: "me-status", "aria-live": "polite" });
    document.querySelector(".hud-row").after(meStatus);
    const warnEl = U.el("div", { class: "me-warn", hidden: true, "aria-live": "assertive" });
    document.querySelector(".board-wrap").prepend(warnEl);
    const isBossLevel = puzzle => !!(puzzle && puzzle.mode === "campaign" && data.playing && data.playing.level === 5);
    const fightOn = () => !!(fight && !fight.over && U.view() === "level" && isBossLevel(Game.state.puzzle) && !Game.state.solved);

    async function startFight(fresh) {
        const key = keyOf(data.playing.world, data.playing.level);
        if (!fresh && fight && fight.key === key) { showPanel(); return; }
        await fetchMap().catch(() => null);
        const c = current(), d = c && c.difficulty ? c.difficulty : "medium";
        const botTime = par(d, c ? c.size : 5) * (BOT_PACE[d] || 1) * (1 - Math.max(0, c ? c.si : 0) * 0.012);
        fight = { key, world: data.playing.world, puzzle: null, letters: null, queue: [], word: null, acc: 0,
            botTime, limit: Math.round(botTime * 1.1), done: [], boss: {}, me: {}, nextMove: 18, moveIdx: 0, over: false, rate: 1, used: 0,
            combo: 0, bestCombo: 0, lastWordAt: -1e9, super: 0, pending: null, windup: 0, enraged: false, hp: 100, intro: false, phase: 1, phase2: null };
        drawPanel(true);
        try {
            const r = await fetch(apiUrl() + "&boss=true");
            if (!r.ok) throw new Error("the server answered " + r.status);
            const p = await r.json();
            if (!fight || fight.key !== key) return;
            fight.puzzle = p;
            fight.letters = p.solution.map(row => Array.from(row, ch => (ch === "." ? "." : "")));
            const entries = [...p.across, ...p.down];
            fight.letterCount = p.solution.join("").replace(/\./g, "").length;
            const r2 = U.rng(p.seed);
            fight.queue = entries.map(e => ({ e, k: r2() })).sort((a, b) => a.k - b.k).map(x => x.e);
            drawPanel(true);
            // phase 2's puzzle, fetched now so it's ready when phase 1 is solved
            const myFight = fight;
            fetch(apiUrl() + "&phase=2").then(r2b => (r2b.ok ? r2b.json() : null)).then(p2 => {
                if (p2 && fight === myFight) { fight.phase2 = Object.assign(p2, { mode: "campaign", world: data.playing.world, level: 5, phase: 2 }); updateHp(); drawFight(); }
            }).catch(() => null);
            if (fresh !== false && U.view() === "level" && !Game.state.solved) {
                fight.intro = true;
                await FX.cinematic(cc => Bosses.intro(cc, fight.world));
                if (fight) fight.intro = false;
                speak(bossOf(fight.world).taunt);
            }
        } catch (err) {
            const l = panel.querySelector(".bp-loading");
            if (l) l.textContent = "Couldn't load the boss's puzzle: " + err.message;
        }
    }
    function showPanel() {
        panel.hidden = false;
        document.getElementById("puzzle").classList.add("boss-mode");
        root.classList.add("in-boss");
        if (data.playing) Bosses.arena(data.playing.world);
    }
    function hidePanel() {
        panel.hidden = true;
        meStatus.innerHTML = "";
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
                <div class="bp-who"><small>BOSS · ${U.esc(Worlds.byId[fight.world].name.toUpperCase())}</small><b></b><div class="bp-status"></div></div>
                <div class="bp-bar bp-hp" title="The boss's HP: your puzzle still to solve"><i></i><span></span></div>
                <div class="bp-bar bp-limit" title="Your time limit"><i></i><span></span></div>
                <div class="bp-bar bp-race" title="The boss's progress on its own board"><i></i><span></span></div>
                <div class="bp-abilities"><small>YOUR MOVES</small><div class="bp-ab-row"></div></div>
                <div class="bp-board-wrap"><div class="bp-board"></div><div class="bp-fog" aria-hidden="true"></div><p class="bp-loading">The boss is getting ready…</p></div>
                <details class="bp-clues"><summary>The boss's clues</summary><div class="bp-clue-cols"><div><h3>Across</h3><ol class="bp-across"></ol></div><div><h3>Down</h3><ol class="bp-down"></ol></div></div></details>`;
            panel.querySelector(".bp-who b").textContent = b.name;
            if (fight.phase2 || fight.phase === 2) panel.querySelector(".bp-who b").appendChild(U.el("span", { class: "bp-phase", text: fight.phase === 2 ? "PHASE 2" : "PHASE 1" }));
            panel.classList.toggle("phase2", fight.phase === 2);
            drawAbilityBar();
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
    function drawAbilityBar() {
        const row = panel.querySelector(".bp-ab-row");
        if (!row || !fight) return;
        row.innerHTML = "";
        loadout().forEach((id, i) => {
            const a = abilityById[id], n = data.owned[id] || 0;
            const btn = U.el("button", { type: "button", class: "bp-ab", disabled: n <= 0, title: `${a.name}: ${a.flavor} ${a.desc} (key ${i + 1})` },
                U.el("span", { class: "bp-ab-icon", text: a.icon }), U.el("b", { text: a.name }), U.el("small", { text: `×${n} · key ${i + 1}` }));
            btn.addEventListener("click", () => { btn.blur(); useAbility(id); });
            row.appendChild(btn);
        });
        if (!loadout().length) row.appendChild(U.el("p", { class: "bp-ab-none", text: "No abilities yet. Clear Level 1 and Level 3 of a world to unlock some." }));
        const sup = U.el("button", { type: "button", class: "bp-super", title: "Super Strike (key 4): finish words to charge it" },
            U.el("i", { class: "bp-super-fill" }), U.el("span", { class: "bp-ab-icon", text: "💥" }), U.el("b", { text: "SUPER" }), U.el("small", { text: "key 4" }));
        sup.addEventListener("click", () => { sup.blur(); useSuper(); });
        row.appendChild(sup);
    }
    function drawFight() {
        if (!fight || panel.hidden) return;
        const g = Game.state, left = Math.max(0, fight.limit - g.seconds);
        const limit = panel.querySelector(".bp-limit");
        if (!limit) return;
        limit.querySelector("i").style.width = (left / fight.limit * 100).toFixed(1) + "%";
        limit.querySelector("span").textContent = `⏱ Your time: ${U.fmtTime(left)} left` + (Game.clockStopped() > 0 ? ` · ⏸ ${Math.ceil(Game.clockStopped())}s` : "");
        limit.classList.toggle("danger", left <= 20);
        const hp = panel.querySelector(".bp-hp");
        hp.querySelector("i").style.width = fight.hp.toFixed(1) + "%";
        hp.querySelector("span").textContent = `❤ BOSS HP ${Math.ceil(fight.hp)}%`;
        hp.classList.toggle("low", fight.hp <= ENRAGE_AT);
        const filled = fight.letters ? fight.letters.flat().filter(ch => ch && ch !== ".").length : 0, pct = fight.letterCount ? filled / fight.letterCount : 0;
        panel.querySelector(".bp-race i").style.width = (pct * 100).toFixed(1) + "%";
        panel.querySelector(".bp-race span").textContent = `✎ Boss's board: ${Math.round(pct * 100)}% done`;
        const st = [];
        for (const [k, lbl] of [["freeze", "❄️ Frozen"], ["slow", "🐌 Slowed"], ["blind", "🙈 Blinded"]]) if (fight.boss[k] > 0) st.push(`${lbl} ${Math.ceil(fight.boss[k])}s`);
        if (fight.enraged) st.push("😡 ENRAGED");
        panel.querySelector(".bp-status").textContent = st.join(" · ") || (fight.puzzle ? "Solving…" : "");
        panel.querySelector(".bp-fog").classList.toggle("on", fight.boss.blind > 0);
        panel.classList.toggle("frozen", fight.boss.freeze > 0);
        panel.classList.toggle("enraged", fight.enraged);
        const sup = panel.querySelector(".bp-super");
        if (sup) {
            sup.querySelector(".bp-super-fill").style.height = fight.super + "%";
            sup.classList.toggle("ready", fight.super >= 100);
            sup.disabled = fight.super < 100;
        }
        // the wind-up warning, on the boss and over your board
        const wu = panel.querySelector(".bp-windup");
        if (fight.pending) {
            const [name, kind] = fight.pending, k = fight.windup / WINDUP;
            wu.hidden = false;
            wu.querySelector("i").style.width = (k * 100).toFixed(1) + "%";
            wu.querySelector("span").textContent = `${MOVE_ICON[kind]} ${name}`;
            warnEl.hidden = false;
            warnEl.innerHTML = `<b>⚠ ${U.esc(name)} incoming!</b><span>Finish a word to block it · ${fight.windup.toFixed(1)}s</span><i style="width:${(k * 100).toFixed(1)}%"></i>`;
        } else { wu.hidden = true; warnEl.hidden = true; }
        if (fight.cells) {
            fight.letters.forEach((row, r) => row.forEach((ch, c) => { if (ch !== ".") fight.cells[r][c].querySelector(".bp-ltr").textContent = ch; }));
            const cur = fight.word;
            fight.cells.flat().forEach(cell => cell.classList.remove("cur"));
            if (cur) Game.cellsOf(cur).forEach(([r, c]) => fight.cells[r][c].classList.add("cur"));
            for (const [e, li] of fight.items) { li.classList.toggle("done", fight.done.includes(e)); li.classList.toggle("active", e === cur); }
        }
        // what the boss is doing to you
        const mine = Object.entries(fight.me).filter(([k, v]) => v > 0 && k !== "shield");
        meStatus.innerHTML = "";
        if (fight.me.shield) meStatus.appendChild(U.el("span", { class: "ms-chip good", text: "🛡️ Shield up" }));
        if (fight.combo > 1) meStatus.appendChild(U.el("span", { class: "ms-chip combo", text: `🔥 Combo ×${fight.combo}` }));
        for (const [k, v] of mine) meStatus.appendChild(U.el("span", { class: "ms-chip", text: `${MOVE_ICON[k]} ${MOVE_TEXT[k]} · ${Math.ceil(v)}s` }));
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

    // the boss writes: one letter at a time, word by word, at a steady (slightly wobbly) pace
    function botStep(dt) {
        const f = fight;
        if (!f.puzzle) return;
        for (const k of ["freeze", "slow", "blind"]) if (f.boss[k] > 0) f.boss[k] = Math.max(0, f.boss[k] - dt);
        if (f.boss.freeze > 0 || f.boss.blind > 0) return;
        const perSec = f.letterCount / f.botTime * (f.boss.slow > 0 ? 0.33 : 1) * f.rate * (f.enraged ? 1.2 : 1);
        f.acc += perSec * dt;
        while (f.acc >= 1) {
            f.acc -= 1;
            if (!f.word) {
                f.word = f.queue.find(e => !f.done.includes(e)) || null;
                f.rate = 0.75 + Math.random() * 0.5;
                if (!f.word) break;
            }
            const cells = Game.cellsOf(f.word), empty = cells.find(([r, c]) => !f.letters[r][c]);
            if (empty) {
                const [r, c] = empty;
                f.letters[r][c] = f.puzzle.solution[r][c];
                if (f.cells) U.restart(f.cells[r][c], "pop");
            }
            if (!cells.some(([r, c]) => !f.letters[r][c])) {
                // finished words: this one, and any crossing word its letters completed
                for (const e of [...f.puzzle.across, ...f.puzzle.down]) if (!f.done.includes(e) && Game.cellsOf(e).every(([r, c]) => f.letters[r][c])) f.done.push(e);
                f.word = null;
                if (Math.random() < 0.35) speak(U.pick(["Ha! Another one!", "Too easy.", "Catch up, if you can!", "Done. Next!"]), 1800);
                if (f.done.length === f.puzzle.across.length + f.puzzle.down.length) { lose("boss"); return; }
            }
        }
    }

    // your word hits the boss: a glowing shot from the word to its portrait, a damage number, combos, super charge
    function onWord({ cells }) {
        if (!fightOn() || !fight.puzzle) return;
        const f = fight, now = performance.now();
        f.combo = now - f.lastWordAt < COMBO_GAP ? f.combo + 1 : 1;
        f.lastWordAt = now;
        f.bestCombo = Math.max(f.bestCombo, f.combo);
        const dmg = Math.round(cells.length * 4 * (1 + (f.combo - 1) * 0.25));
        f.super = Math.min(100, f.super + 20 + (f.combo - 1) * 8);
        // blocked an attack that was winding up?
        if (f.pending) {
            const [name] = f.pending;
            f.pending = null;
            f.windup = 0;
            f.super = Math.min(100, f.super + 15);
            Bosses.cutin(f.world, "BLOCKED!", `${name} was stopped`, { good: true });
            Sound.play("right");
            speak(U.pick(["What?! Blocked?", "Grr... lucky!", "Not fair!"]));
        }
        const els = cells.map(([r, c]) => Game.cellEl(r, c)).filter(Boolean);
        const pts = els.map(el => U.center(el));
        const from = pts.length ? { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length } : U.center(document.querySelector(".board-area"));
        const portrait = panel.querySelector(".bp-portrait");
        const to = portrait ? U.center(portrait) : from;
        const land = () => {
            if (portrait) U.restart(portrait, "hit");
            damageNumber(to, dmg, f.combo);
            FX.burst({ x: to.x, y: to.y, n: 16 + f.combo * 4, colors: ["#fff", "#ffd23f", bossOf(f.world).color], shape: "star", speed: [120, 340], gravity: 260, life: [0.4, 0.8], size: [3, 6] });
            Sound.play("thud");
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
    function damageNumber(at, dmg, combo) {
        const el = U.el("div", { class: "bh-dmg" + (combo > 2 ? " crit" : ""), text: `-${dmg}`, style: { left: at.x + "px", top: at.y + "px" } });
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 1100);
    }
    function comboPop(n) {
        const el = U.el("div", { class: "bh-combo", html: `<small>COMBO</small><b>×${n}</b>` });
        const area = document.querySelector(".board-wrap");
        area.appendChild(el);
        Sound.play("tile", Math.min(8, n + 2));
        setTimeout(() => el.remove(), 1200);
    }
    // the boss's HP is your puzzle still to solve; low HP makes it angry
    function updateHp() {
        const { right, total } = Game.progress(), left = 1 - right / total;
        // with a phase 2 the boss's HP is split: phase 1 takes it from 100% to 50%, phase 2 from 50% to 0
        fight.hp = Math.max(0, fight.phase === 2 ? 50 * left : fight.phase2 ? 50 + 50 * left : 100 * left);
        if (!fight.enraged && fight.hp <= ENRAGE_AT && !Game.state.solved) {
            fight.enraged = true;
            root.classList.add("boss-enraged");
            Bosses.enrage(true);
            Bosses.cutin(fight.world, "ENRAGED!", "It's faster and angrier now");
            Sound.play("boom");
            FX.shake(10, 500);
            speak("ENOUGH! Now I'm angry!", 3000);
            fight.nextMove = Math.min(fight.nextMove, 6);
        }
    }

    function useAbility(id) {
        const a = abilityById[id];
        if (!a || !fightOn() || !fight.puzzle || fight.intro || (data.owned[id] || 0) <= 0) return;
        data.owned[id]--;
        fight.used++;
        save();
        const f = fight, portrait = panel.querySelector(".bp-portrait");
        if (a.kind === "freeze") f.boss.freeze = Math.max(f.boss.freeze || 0, a.d);
        if (a.kind === "slow") f.boss.slow = Math.max(f.boss.slow || 0, a.d);
        if (a.kind === "blind") {
            f.boss.blind = Math.max(f.boss.blind || 0, a.d);
            if (f.word) { wipe(Game.cellsOf(f.word)); f.word = null; }        // it loses its place
        }
        if (a.kind === "erase") {
            const last = f.done.pop();
            if (last) { wipe(Game.cellsOf(last)); f.done = f.done.filter(e => Game.cellsOf(e).every(([r, c]) => f.letters[r][c])); }
        }
        if (a.kind === "shield") f.me.shield = 1;
        if (a.kind === "time") f.limit += a.d;
        if (a.kind === "hint") Game.giveLetters(a.d);
        if (portrait) U.restart(portrait, a.kind === "shield" || a.kind === "time" || a.kind === "hint" ? "buff" : "hit");
        // a shot flies over to the boss's side
        const from = U.center(document.querySelector(".board-area")), to = portrait ? U.center(portrait) : from;
        if (U.motion() !== "still" && ["freeze", "slow", "blind", "erase"].includes(a.kind)) {
            const shot = U.el("div", { class: "bh-shot", text: a.icon });
            document.body.appendChild(shot);
            shot.animate([{ transform: `translate(${from.x}px, ${from.y}px) scale(.6)` }, { transform: `translate(${(from.x + to.x) / 2}px, ${Math.min(from.y, to.y) - 100}px) scale(1.6)` }, { transform: `translate(${to.x}px, ${to.y}px) scale(1)` }],
                { duration: 520, easing: "ease-in" }).onfinish = () => { shot.remove(); FX.burst({ x: to.x, y: to.y, n: 26, colors: ["#fff", biome(f.world).node, "#ffd23f"], shape: "star", speed: [100, 320], gravity: 200, life: [0.4, 0.9], size: [3, 7] }); Sound.play("thud"); };
            speak(U.pick(["Ow!", "Hey! Cut that out!", "Argh!", "My board!"]), 1800);
        }
        Sound.play("whoosh");
        FX.toast({ icon: a.icon, kicker: "YOU USED", title: a.name, text: a.desc, ms: 2200 });
        drawAbilityBar();
        drawFight();
    }
    // Super Strike: a full-screen hit that freezes the boss and wipes its last word
    function useSuper() {
        if (!fightOn() || !fight.puzzle || fight.intro || fight.super < 100) return;
        const f = fight;
        f.super = 0;
        f.boss.freeze = Math.max(f.boss.freeze || 0, 7);
        const last = f.done.pop();
        if (last) { wipe(Game.cellsOf(last)); f.done = f.done.filter(e => Game.cellsOf(e).every(([r, c]) => f.letters[r][c])); }
        if (f.word) { wipe(Game.cellsOf(f.word)); f.word = null; }
        if (f.pending) { f.pending = null; f.windup = 0; }
        Bosses.cutin(f.world, "SUPER STRIKE!", "Frozen 7s · its last word is gone", { good: true });
        Sound.play("boom");
        FX.flash("#fff", 350, 0.6);
        FX.shake(14, 600);
        const portrait = panel.querySelector(".bp-portrait");
        if (portrait) {
            U.restart(portrait, "hit");
            const p = U.center(portrait);
            FX.burst({ x: p.x, y: p.y, n: 70, colors: ["#fff", "#ffd23f", "#ff5c6c", bossOf(f.world).color], shape: "star", speed: [200, 600], gravity: 300, life: [0.6, 1.2], size: [4, 9] });
            damageNumber(p, 50, 3);
        }
        speak("AAARGH!", 2000);
        drawAbilityBar();
        drawFight();
    }
    function wipe(cells) {
        const f = fight;
        for (const [r, c] of cells) {
            if (f.done.some(e => Game.cellsOf(e).some(([r2, c2]) => r2 === r && c2 === c))) continue;   // part of another finished word
            f.letters[r][c] = "";
            if (f.cells) { f.cells[r][c].querySelector(".bp-ltr").textContent = ""; U.restart(f.cells[r][c], "shake"); }
        }
    }

    // the boss's turn to be mean: first a wind-up (finish a word to block it), then the attack lands
    function windUp() {
        const f = fight, moves = BOSS_MOVES[f.world] || BOSS_MOVES.paper;
        f.pending = moves[f.moveIdx++ % moves.length];
        f.windup = WINDUP;
        const portrait = panel.querySelector(".bp-portrait");
        if (portrait) U.restart(portrait, "charge");
        Sound.play("select");
        speak(`${f.pending[0]}... get ready!`, 2400);
        drawFight();
    }
    function attack() {
        const f = fight, [name, kind, d] = f.pending;
        f.pending = null;
        const b = bossOf(f.world), portrait = panel.querySelector(".bp-portrait");
        if (portrait) U.restart(portrait, "attack");
        if (f.me.shield) {
            f.me.shield = 0;
            Bosses.cutin(f.world, "SHIELDED!", `${name} bounced off your shield`, { good: true });
            Sound.play("right");
            drawFight();
            return;
        }
        Bosses.cutin(f.world, name + "!", MOVE_TEXT[kind] + (kind === "erase" ? "" : ` for ${d}s`));
        Sound.play("boom");
        FX.shake(9, 420);
        FX.flash(b.color, 380, 0.25);
        if (kind === "erase") Game.eraseLetters(d);
        else f.me[kind] = d;
        if (kind === "scramble") scramble(true);
        speak(U.pick(["Take that!", "Ha! Try writing now!", b.taunt]));
        applyMe();
        updateHp();
        drawFight();
    }
    // the effects on you, as classes on the page
    let scrambled = null;
    function applyMe() {
        const m = fight ? fight.me : {};
        const area = document.querySelector(".board-area"), clues = document.querySelector(".clues"), board = document.getElementById("board");
        area.classList.toggle("fx-blind", m.blind > 0);
        clues.classList.toggle("fx-blind", m.blind > 0);
        board.classList.toggle("fx-smudge", m.smudge > 0);
        board.classList.toggle("fx-frozen", m.freeze > 0);
        document.getElementById("clue-bar").classList.toggle("fx-scramble", m.scramble > 0);
        if (!(m.scramble > 0) && scrambled) scramble(false);
    }
    function clearMe() {
        if (fight) fight.me = {};
        ["fx-blind"].forEach(c => document.querySelectorAll("." + c).forEach(n => n.classList.remove(c)));
        ["fx-smudge", "fx-frozen"].forEach(c => document.getElementById("board").classList.remove(c));
        document.getElementById("clue-bar").classList.remove("fx-scramble");
        if (scrambled) scramble(false);
    }
    function scramble(on) {
        const items = document.querySelectorAll(".clues .clue-text");
        if (on) {
            if (!scrambled) scrambled = [...items].map(n => n.textContent);
            items.forEach(n => { n.textContent = n.textContent.split(" ").map(w => w.length > 3 ? w[0] + [...w.slice(1, -1)].sort(() => Math.random() - 0.5).join("") + w.slice(-1) : w).join(" "); });
        } else if (scrambled) {
            items.forEach((n, i) => { if (scrambled[i] != null) n.textContent = scrambled[i]; });
            scrambled = null;
        }
    }
    // keys: 1-3 abilities, 4 super; while frozen, typing does nothing
    addEventListener("keydown", e => {
        if (!fightOn() || e.ctrlKey || e.metaKey || e.altKey) return;
        if (/^[1-3]$/.test(e.key)) { const id = loadout()[+e.key - 1]; if (id) { e.preventDefault(); useAbility(id); } return; }
        if (e.key === "4") { e.preventDefault(); useSuper(); return; }
        if (fight.me.freeze > 0 && (/^[a-zA-Z]$/.test(e.key) || e.key === "Backspace" || e.key === "Delete")) { e.preventDefault(); e.stopPropagation(); U.restart(document.getElementById("board"), "shake"); }
    }, true);
    document.getElementById("keyboard").addEventListener("click", e => { if (fightOn() && fight.me.freeze > 0) { e.stopPropagation(); } }, true);

    // the fight's clock: everything moves only while you're actually playing
    let lastTick = performance.now();
    setInterval(() => {
        const now = performance.now(), dt = Math.min(0.5, (now - lastTick) / 1000);
        lastTick = now;
        if (!fightOn() || document.hidden || FX.playing || $("#puzzle").hidden || document.querySelector("#overlay .results") || root.classList.contains("intro-on")) return;
        const f = fight;
        botStep(dt);
        if (f.over) return;
        for (const k of ["blind", "scramble", "freeze", "smudge"]) if (f.me[k] > 0) f.me[k] = Math.max(0, f.me[k] - dt);
        if (f.combo > 1 && now - f.lastWordAt > COMBO_GAP) f.combo = 0;
        if (f.pending) {
            f.windup -= dt;
            if (f.windup <= 0) attack();
        } else if (f.puzzle) {
            f.nextMove -= dt;
            if (f.nextMove <= 0) { f.nextMove = (BOSS_EVERY[Game.state.puzzle.difficulty] || 30) * (f.enraged ? 0.65 : 1) * (0.8 + Math.random() * 0.4); windUp(); }
        }
        if (Game.state.seconds >= f.limit) { lose("time"); return; }
        applyMe();
        drawFight();
    }, 100);

    function lose(why) {
        const f = fight;
        if (!f || f.over) return;
        f.over = true;
        f.pending = null;
        clearMe();
        warnEl.hidden = true;
        const b = bossOf(f.world);
        Game.endLoss({ title: why === "boss" ? `${b.name} wins` : "Out of time", text: why === "boss" ? "The boss finished its puzzle first." : "The clock ran out." });
        Sound.play("wrong");
        FX.shake(10, 420);
        const modal = U.el("div", { class: "results", role: "dialog", "aria-modal": "true" });
        const card = U.el("div", { class: "res-card lose-card", style: { "--boss": b.color } },
            U.el("div", { class: "lose-art", html: bossSvg(f.world) }),
            U.el("small", { class: "res-kicker", text: "BOSS FIGHT · LOST" }),
            U.el("h2", { class: "res-title", text: why === "boss" ? `${b.name} got there first!` : "Out of time!" }),
            U.el("p", { class: "res-note", text: why === "boss" ? "The boss solved its whole board before you. Block its attacks by finishing words, and save your Super for when it's close." : "Your clock ran out. Time abilities and the Time Stop item buy you more." }),
            U.el("div", { class: "res-actions" },
                U.el("button", { type: "button", class: "btn primary", text: "Rematch ▶", onclick: () => { modal.remove(); play(f.world, 5); } }),
                U.el("button", { type: "button", class: "btn", text: "🛒 Shop", onclick: () => openShop("abilities") }),
                U.el("button", { type: "button", class: "btn ghost", text: "Map", onclick: () => { modal.remove(); location.hash = "#campaign"; } })));
        modal.appendChild(card);
        document.getElementById("overlay").appendChild(modal);
        requestAnimationFrame(() => modal.classList.add("in"));
        speak(U.pick(["Better luck next time!", "Too slow!", "Ha! Rematch?"]), 5000);
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
    Bus.on("type", () => { if (fightOn()) updateHp(); });
    Bus.on("surrender", () => { if (fight && !fight.over && isBossLevel(Game.state.puzzle)) { fight.over = true; fight.pending = null; clearMe(); drawFight(); } });

    // Phase 2 (the user's design): solving the boss's first puzzle doesn't end the fight. The boss powers up full screen,
    // you get a bigger puzzle (a Challenge grid instead of a normal 5x5, or a bigger Expert grid), and the boss starts
    // over on the board you just solved. Your clock gets more time; time you had left carries over.
    function nextPhase(game) {
        if (!fight || fight.over || fight.phase !== 1 || !fight.phase2 || !isBossLevel(game.puzzle) || U.view() !== "level") return false;
        fight.phase = 1.5;              // switching
        switchPhase();
        return true;
    }
    async function switchPhase() {
        const f = fight, c = current(), [d2, s2] = phase2Of(map && c && map[c.si]);
        f.pending = null;
        f.windup = 0;
        clearMe();
        warnEl.hidden = true;
        const portrait = panel.querySelector(".bp-portrait");
        if (portrait) { const p = U.center(portrait); damageNumber(p, 50, 3); }
        await FX.cinematic(cc => Bosses.phase(cc, f.world, `${label(d2, s2)}!`, "A bigger puzzle for you. The boss starts over on the board you just solved."));
        if (fight !== f || f.over) return;
        const p1 = Game.state.puzzle;
        Game.startPhase(f.phase2);
        f.phase = 2;
        // the boss's new board: the one you just solved
        f.puzzle = p1;
        f.letters = p1.solution.map(row => Array.from(row, ch => (ch === "." ? "." : "")));
        f.letterCount = p1.solution.join("").replace(/\./g, "").length;
        const r2 = U.rng(p1.seed + 7);
        f.queue = [...p1.across, ...p1.down].map(e => ({ e, k: r2() })).sort((a, b) => a.k - b.k).map(x => x.e);
        f.done = [];
        f.word = null;
        f.acc = 0;
        f.boss = {};
        f.botTime = par(d2, s2) * (BOT_PACE[d2] || 1) * (1 - Math.max(0, c ? c.si : 0) * 0.012);
        f.limit += Math.round(f.botTime * 1.1);
        f.nextMove = 12;
        Bosses.arena(f.world).classList.add("phase2");
        drawPanel(true);
        updateHp();
        speak(U.pick(["You think that was hard?!", "Now I'm serious!", "Round two!"]), 3000);
        Sound.play("start");
    }

    // The boss is beaten: it shatters full screen, then the world's own win animation plays
    async function bossFinale(c) {
        if (!fight) return;
        fight.over = true;
        fight.pending = null;
        fight.hp = 0;
        clearMe();
        warnEl.hidden = true;
        drawFight();
        panel.classList.add("ko");
        await c.wait(250);
        await Bosses.ko(c, fight.world);
    }
    // stars for a boss: how much of your clock was left
    function bossStars() {
        if (!fight) return 1;
        const left = (fight.limit - Game.state.seconds) / fight.limit;
        return left >= 0.5 ? 3 : left >= 0.25 ? 2 : 1;
    }

    // ---------------------------------------------------------------------------------------------
    // The home screen's campaign card
    // ---------------------------------------------------------------------------------------------
    async function drawHomeCard() {
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
    addEventListener("keydown", e => {
        if (U.view() !== "campaign" || !map || e.ctrlKey || e.metaKey || e.altKey || document.querySelector("#overlay .results")) return;
        if (e.key === "Escape" && sheetOpen) { e.preventDefault(); closeSheet(); }
    });

    return {
        onView, showMap, play, ready: fetchMap, nextPhase, next, slotName, apiUrl, titles, cardInfo, onWin, bestLine, bossFinale, drawHomeCard, bossSvg, openShop,
        isBossLevel, abilities: ABILITIES, items: ITEMS, unlockedAbilities, useItem, get playing() { return data.playing; }, get fight() { return fight; }
    };
})();
