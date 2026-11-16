// Campaign mode: a map of the worlds, travelled from easy to hard. Each world
// has 5 levels; level 5 is a boss battle.
//
//   #campaign   the stage: one world at a time on its own scene, with its road of five stops, that world's page of
//               the Everbook beside it, and every world in a strip along the bottom. The Everbook (the bar's button)
//               holds the rest: contents, the story's pages, the shop, skills, your hero and help.
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

    // Par times (seconds) for the "quick" star, for a 5x5 board; bigger boards get more time, by their area
    // ("challenge" = a Challenge grid with medium clues, "expert" = hard words and clues; see Campaign.java)
    // (15% more time than they used to be)
    const PAR_BASE = { easy: 140, medium: 210, hard: 280, challenge: 255, expert: 310 };
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

    let map = null, full = null, loading = null;
    // The secret world (the Celestial Rift): on the map only once the Void is beaten
    // (or with the beta's Unlock All). map is what's shown; full has it too.
    // TEST_SECRET_OPEN: true puts the rift on the map and opens its first level without beating the Void (for testing;
    // false for everyone else).
    const TEST_SECRET_OPEN = false;
    // really unlocked (the Void beaten, or Unlock All), ignoring TEST_SECRET_OPEN: what the credits and the start
    // screen's boss parade go by, so they never give the rift or the angel away
    const secretEarned = () => !!(data.betaUnlock || (data.levels && data.levels["space-5"]));
    const secretOpen = () => TEST_SECRET_OPEN || secretEarned();
    const visibleMap = () => full.filter(s => !s.secret || secretOpen());
    // the map grows (the Void just fell): the strip of worlds gets its new tile the next time it's drawn
    function refreshMap() {
        if (!full) return false;
        const next = visibleMap();
        if (map && next.length === map.length) return false;
        map = next;
        return true;
    }
    function fetchMap() {
        if (map) return Promise.resolve(map);
        if (!loading) {
            loading = U.fetchJson("/api/campaign/map")
                .then(list => { full = list.filter(s => Worlds.byId[s.world]); map = visibleMap(); migrate(); return map; })
                .catch(err => { loading = null; throw err; });
        }
        return loading;
    }

    const sizeOf = (s, level) => (s.sizes ? s.sizes[level - 1] : 5);
    // a world's levels: 1-4 and the boss (5); the secret world has only 1-3 and the boss (Campaign.java levelList)
    const LV = si => (map && map[si] && map[si].levelList) || [1, 2, 3, 4, 5];
    const prevLevel = (si, l) => { const list = LV(si), i = list.indexOf(l); return i > 0 ? list[i - 1] : null; };
    const nextLevel = (si, l) => { const list = LV(si), i = list.indexOf(l); return i >= 0 && i < list.length - 1 ? list[i + 1] : null; };
    const MAIN = 15;                          // the Everbook's 15 worlds: boss difficulty is measured along these
    const isSecret = si => !!(map && map[si] && map[si].secret);
    const worldTag = si => (isSecret(si) ? "SECRET WORLD" : `WORLD ${si + 1}`);
    const phase2Of = s => (s && s.phase2 ? s.phase2 : ["challenge", 6]);          // a boss's second puzzle: [difficulty, size]
    // every puzzle after a boss's first: [[difficulty, size], ...] (2 phases for most bosses, 3 for the last three, 5 for the Void)
    const laterPhases = s => (s && s.phases ? s.phases : [phase2Of(s)]);
    // The puzzle pool: every level has
    // POOL ready-made puzzles with the same settings (Campaign.VARIANTS, PuzzleBatch.java), and every fresh start of a
    // level picks one at random, never one of the last RECENT you played there (so losing or replaying always brings a
    // new board and new clues). data.picks: each level's current one; data.recent: the last few.
    const POOL = 25, RECENT = 6;
    function newPick(world, level) {
        const k = keyOf(world, level), recent = ((data.recent = data.recent || {})[k]) || [];
        const all = [...Array(POOL).keys()], choices = all.filter(v => !recent.includes(v));
        const v = U.pick(choices.length ? choices : all);
        (data.picks = data.picks || {})[k] = v;
        data.recent[k] = [...recent, v].slice(-RECENT);
        save();
        return v;
    }
    const tryOf = (world, level) => { const v = (data.picks || {})[keyOf(world, level)]; return v == null ? newPick(world, level) : v; };
    const playedBefore = (world, level) => (((data.recent || {})[keyOf(world, level)]) || []).length > 1;
    // Lessons. Every level teaches one skill (Lesson.java on the server): its clues train it, and its
    // third star is a goal that fits it.
    const lessonOf = (si, level) => (map && map[si] && map[si].lessons ? map[si].lessons[level - 1] : null);
    // the third star's goal: [text, check(game, puzzle)]
    function starGoal(lesson, d, size) {
        const p = par(d, size), t = k => Math.round(p * k / 5) * 5;
        switch (lesson && lesson.star) {
            case "brisk": return [`Finish Under ${U.fmtTime(t(0.75))}`, g => g.seconds <= t(0.75)];
            case "fast": return [`Finish Under ${U.fmtTime(t(0.6))} (Speed)`, g => g.seconds <= t(0.6)];
            // the campaign has no Check or Reveal, so these count wrong letters typed instead
            case "nocheck": return ["4 Wrong Letters or Fewer", g => (g.typos || 0) <= 4];
            case "clean": return ["A Clean Solve: 1 Wrong Letter at Most", g => (g.typos || 0) <= 1];
            default: return [`Finish Under ${U.fmtTime(p)}`, g => g.seconds <= p];
        }
    }
    const record = (si, level) => data.levels[keyOf(map[si].world, level)];
    const cleared = (si, level) => !!(map && map[si] && record(si, level));
    function unlocked(si, level) {
        if (data.betaUnlock) return true;                          // the beta's Unlock All button (see BETA below)
        if (si === 0 && level === 1) return true;
        if (TEST_SECRET_OPEN && level === 1 && map[si].secret) return true;      // (testing: see TEST_SECRET_OPEN)
        if (level > 1) return cleared(si, prevLevel(si, level) || level - 1);
        return si > 0 && cleared(si - 1, 5);
    }
    const sectionOpen = si => unlocked(si, 1);
    // where the player is: the first level not cleared yet
    function frontier() {
        for (let si = 0; si < map.length; si++) for (const l of LV(si)) if (!cleared(si, l)) return { si, level: l };
        return { si: map.length - 1, level: 5 };
    }
    function totals() {
        let levels = 0, stars = 0;
        for (const r of Object.values(data.levels)) { levels++; stars += r.stars || 0; }
        return { levels, stars, max: map ? map.reduce((n, s, si) => n + LV(si).length, 0) : 75 };
    }

    // ---------------------------------------------------------------------------------------------
    // The look of each world's island: its ground and sides, its road, its own colour, its scenery
    // ---------------------------------------------------------------------------------------------
    const BIOMES = {
        paper:    { hill: "#e8dcc0", ground: "#fffaf0", path: "#2f6fd6", node: "#e2483c", prop: "doodle" },
        garden:   { hill: "#78c267", ground: "#9bd67f", path: "#e0bb83", node: "#ff5f98", prop: "flower" },
        squirrel: { hill: "#c26b33", ground: "#d99a55", path: "#f6e3bd", node: "#b5521f", prop: "oak" },
        candy:    { hill: "#ff9ccf", ground: "#ffc4e3", path: "#ffffff", node: "#ff3f9a", prop: "lolly" },
        ocean:    { hill: "#2f9fc7", ground: "#47b4d4", path: "#ffe7a8", node: "#ff7a59", prop: "coral" },
        snow:     { hill: "#b4cdea", ground: "#f2f7ff", path: "#8fb3dc", node: "#3f7fd8", prop: "pine" },
        rain:     { hill: "#6d7d91", ground: "#8493a5", path: "#ffd34d", node: "#ffc93a", prop: "umbrella" },
        sky:      { hill: "#cfe6f7", ground: "#f4fbff", path: "#ffb04d", node: "#ff7a59", prop: "cloud" },
        desert:   { hill: "#df9f55", ground: "#efc27e", path: "#9c5b2e", node: "#2f8f9d", prop: "cactus" },
        carnival: { hill: "#6fbd5c", ground: "#8fd07a", path: "#fff1d0", node: "#e2483c", prop: "tent" },
        arcade:   { hill: "#3a0d6b", ground: "#220a48", path: "#2bf0ff", node: "#ff2bd6", prop: "pixel" },
        robot:    { hill: "#3f4855", ground: "#6a7583", path: "#ffc43d", node: "#ff7a1a", prop: "gear" },
        library:  { hill: "#3d2546", ground: "#5a3a28", path: "#e8c37a", node: "#7fe0c4", prop: "books" },
        volcano:  { hill: "#2e1c1c", ground: "#3d2a26", path: "#ff8a2a", node: "#ffcf3f", prop: "cone" },
        space:    { hill: "#151b40", ground: "#0e1230", path: "#b18cff", node: "#ffe066", prop: "planet" },
        rift:     { hill: "#2a1050", ground: "#170a36", path: "#ffd06b", node: "#e8c66a", prop: "ruin" }
    };
    const biome = world => BIOMES[world] || BIOMES.paper;
    const INK = "#2b2233";
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
        // the Celestial Rift: broken marble columns with gold, and black and white feathers
        ruin: r => r() < 0.6
            ? `<rect x="-9" y="-58" width="18" height="58" fill="#cfc4e6"/><path d="M-9 -58 L-3 -66 L3 -60 L9 -68 L9 -58Z" fill="#cfc4e6"/><path d="M-4 -56V-2M2 -56V-2" stroke="#8a7cae" stroke-width="1.4"/><rect x="-13" y="-4" width="26" height="6" fill="#e8c66a"/>`
            : `<path d="M0 -26 Q9 -12 4 6 L0 10 L-4 6 Q-9 -12 0 -26Z" fill="${pick3(r, ["#ffffff", "#1c1230"])}" stroke="#9b6bff" stroke-width="1.5"/><path d="M0 -22V9" stroke="#9b6bff" stroke-width="1"/>`,
        planet: r => r() < 0.5
            ? `<circle cy="-30" r="16" fill="${pick3(r, ["#ff9f6b", "#6bd0ff", "#b18cff"])}"/><ellipse cy="-30" rx="28" ry="6" fill="none" stroke="#ffe066" stroke-width="2.5" transform="rotate(-15 0 -30)"/>`
            : `<path d="${starPath(0, -20, 9, 3, 4)}" fill="#fff"/>`
    };

    const bossOf = world => Bosses.info(world);
    const bossSvg = (world, cls = "") => Bosses.svg(world, cls);

    // ---------------------------------------------------------------------------------------------
    // The stage: one world at a time on its own scene (the page's background), with its road of five stops.
    // data.section is the world on stage, data.sel the stop whose page is open beside it.
    // ---------------------------------------------------------------------------------------------
    const view = $("#campaign-view"), stage = $("#cm-stage"), stopsEl = $("#cm-stops"), heroLayer = $("#cm-hero-layer");
    const pageEl = $("#cm-detail"), stripEl = $("#cm-strip"), medalEl = $("#cm-medal");
    const phone = matchMedia("(max-width: 760px)");
    const icon = U.icon;
    let staged = false;                         // the stage has been drawn at least once
    // Where the five stops stand, in % of the island's top: the road starts at the near edge and winds back to the
    // boss at the far end. Every other world winds the other way, and each has its own small bends.
    const CLIMB = [[22, 90], [72, 73], [27, 55], [71, 38], [50, 14]];
    function spots(si) {
        const r = U.rng(si * 31 + 5);
        return CLIMB.map(([x, y], i) => [(si % 2 ? 100 - x : x) + (i < 4 ? (r() - 0.5) * 9 : 0), y + (i < 4 ? (r() - 0.5) * 5 : 0)]);
    }
    // the island's slab: its top, the layers of its side, and its shadow far below
    const slab = $("#cm-slab"), isle = $("#cm-isle"), plane = $("#cm-plane");
    slab.append(...Array.from({ length: 9 }, (_, n) => U.el("i", { class: n === 0 ? "top" : n === 8 ? "shade" : "", style: { "--n": n } })));
    isle.addEventListener("animationend", e => { if (e.target === isle) isle.classList.remove("sail-in"); });
    // scenery standing on the island, away from the road (the same for a world every time)
    function drawProps(si) {
        const box = $("#cm-props"), b = biome(map[si].world);
        for (const k of ["ground", "hill", "path"]) plane.style.setProperty("--" + k, b[k]);
        if (box.dataset.for === map[si].world) return;
        box.dataset.for = map[si].world;
        const r = U.rng(si * 131 + 17), pts = spots(si), road = [], list = [];
        for (let u = 0; u <= pts.length - 1; u += 0.1) road.push(roadPoint(pts, u));
        for (let tries = 0; list.length < 15 && tries < 500; tries++) {
            const x = r() * 100, y = r() * 100;
            if (Math.hypot(x - 50, y - 50) > 53) continue;                                  // (on the island)
            if (road.some(p => Math.hypot(p[0] - x, p[1] - y) < 15) || list.some(p => Math.hypot(p.x - x, p.y - y) < 11)) continue;
            list.push({ x, y, k: 0.9 + r() * 0.7 });
        }
        box.replaceChildren(...list.map(p => U.el("div", { class: "ws-prop", style: { "--x": p.x.toFixed(1) + "%", "--y": p.y.toFixed(1) + "%", "--k": p.k.toFixed(2) },
            html: `<svg viewBox="-40 -84 80 88" aria-hidden="true">${PROPS[b.prop](r)}</svg>` })));
    }
    // The road is a smooth curve through the stops (Catmull-Rom, as cubic Béziers). u counts stops along it: 0 is the
    // first stop, 1.5 is halfway between the second and the third.
    function roadPoint(pts, u) {
        const i = U.clamp(Math.floor(u), 0, pts.length - 2), t = U.clamp(u - i, 0, 1), k = 1 - t;
        const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
        const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
        return [0, 1].map(a => k * k * k * p1[a] + 3 * k * k * t * c1[a] + 3 * k * t * t * c2[a] + t * t * t * p2[a]);
    }
    function roadPath(pts, upTo = pts.length - 1) {
        if (upTo <= 0) return "";
        let d = "";
        for (let u = 0; u < upTo; u += 0.04) { const [x, y] = roadPoint(pts, u); d += (d ? "L" : "M") + x.toFixed(2) + " " + y.toFixed(2); }
        const [x, y] = roadPoint(pts, upTo);
        return d + "L" + x.toFixed(2) + " " + y.toFixed(2);
    }
    const reachedIn = si => LV(si).filter(l => unlocked(si, l)).length;        // how many of a world's stops are open
    function setRoad(si, reached) {
        const pts = spots(si), whole = roadPath(pts);
        $("#cm-road-bed").setAttribute("d", whole);
        $("#cm-road-ahead").setAttribute("d", whole);
        const done = sectionOpen(si) ? roadPath(pts, reached - 1) : "";
        $("#cm-road-done").setAttribute("d", done);
        $("#cm-road-flow").setAttribute("d", done);
    }
    const starRow = (n, cls = "") => { const box = U.el("span", { class: "ws-stars " + cls, role: "img", "aria-label": `${n} of 3 stars` }); for (let i = 0; i < 3; i++) box.append(icon("star", i < n ? "on" : "off")); return box; };
    const worldStars = si => LV(si).reduce((n, l) => n + ((record(si, l) || {}).stars || 0), 0);
    const levelName = (si, l) => (l === 5 ? bossOf(map[si].world).name : (lessonOf(si, l) ? lessonOf(si, l).name : label(map[si].levels[l - 1], sizeOf(map[si], l))));

    // hold: this stop is drawn as still locked (it's about to open, with its own little show: see openStop)
    function drawStage({ deal = false, hold = null } = {}) {
        const si = data.section, s = map[si], pts = spots(si), open = sectionOpen(si), f = frontier();
        const list = LV(si);
        setRoad(si, reachedIn(si) - (hold ? 1 : 0));
        stage.classList.toggle("is-locked", !open);
        drawProps(si);
        $("#cm-sky").replaceChildren(U.el("b", { text: Worlds.byId[s.world].name }), U.el("span", { text: isSecret(si) ? "Secret World" : `World ${si + 1} of ${MAIN} · ${bossOf(s.world).name}` }));
        stopsEl.replaceChildren();
        list.forEach((l, i) => {
            const rec = record(si, l), boss = l === 5, isOpen = unlocked(si, l) && l !== hold, isNext = isOpen && !rec && f.si === si && f.level === l;
            const state = rec ? "done" : isOpen ? "open" : "locked", [x, y] = pts[i], name = levelName(si, l);
            const stop = U.el("button", { type: "button", class: `ws-stop ${state}${boss ? " boss" : ""}${isNext ? " next" : ""}${l === data.sel ? " sel" : ""}`,
                style: { "--x": x + "%", "--y": y + "%", "--i": i + 1 }, "data-level": l, "aria-pressed": l === data.sel ? "true" : "false",
                "aria-label": `${boss ? "Boss: " + name : "Level " + l + ": " + name}, ${rec ? rec.stars + " of 3 stars" : isOpen ? "not played yet" : "locked"}`,
                onclick: () => pickLevel(l, true) });
            const disc = U.el("span", { class: "ws-disc" }, boss ? U.el("span", { class: "ws-boss-art", html: bossSvg(s.world) }) : U.el("b", { text: String(l) }));
            if (state === "locked" && !boss) disc.append(icon("lock", "ws-lock"));
            // the boss holds its page of the Everbook over its head until you win it back
            if (boss) disc.append(rec ? U.el("span", { class: "ws-wonmark", title: "Page Won Back" }, icon("check")) : U.el("span", { class: "ws-leaf", title: "Its page of the Everbook" }));
            stopsEl.append(U.el("i", { class: `ws-pad ${state}${boss ? " boss" : ""}${isNext ? " next" : ""}${l === data.sel ? " sel" : ""}`, style: { "--x": x + "%", "--y": y + "%" }, "data-level": l }));
            if (abilityPrize(si, l)) disc.append(U.el("span", { class: "ws-prize", title: `${rec ? "Unlocked" : "Unlocks"}: ${abilityPrize(si, l).name}` }, icon("bolt")));
            const tag = U.el("span", { class: "ws-tag" }, U.el("b", { text: name }));
            tag.append(rec ? starRow(rec.stars) : U.el("small", { text: isNext ? "Next" : boss ? "Boss" : label(s.levels[l - 1], sizeOf(s, l)) }));
            stop.append(disc, tag);
            stopsEl.append(stop);
        });
        // the world's own stars, and its seal once every one is won
        const got = worldStars(si), all = list.length * 3;
        const medal = medalEl;
        medal.hidden = !open;
        medal.classList.toggle("full", got >= all);
        medal.replaceChildren(icon("star"), U.el("b", { text: String(got) }), U.el("span", { text: ` / ${all}` }));
        if (got >= all || cleared(si, 5)) medal.append(U.el("em", { text: got >= all ? "World Mastered" : isSecret(si) ? "Rift Sealed" : "Page Won Back" }));
        $("#cm-sky").append(medal);
        // a locked world: what opens it
        const lockedNote = $("#cm-locked");
        lockedNote.hidden = open;
        if (!open) lockedNote.replaceChildren(icon("lock"), U.el("p", { text: `Beat ${bossOf(map[si - 1].world).name} in ${Worlds.byId[map[si - 1].world].name} to open ${Worlds.byId[s.world].name}.` }));
        for (const [id, k] of [["#cm-prev", -1], ["#cm-next", 1]]) {
            const b = $(id), there = map[si + k];
            b.hidden = !there;
            if (!there) continue;
            const name = Worlds.byId[there.world].name;
            b.replaceChildren(miniIsle(si + k), U.el("span", { class: "ws-edge-name" }, icon(k < 0 ? "back" : "next"), U.el("span", { text: name })));
            b.setAttribute("aria-label", `${k < 0 ? "Previous" : "Next"} world: ${name}`);
        }
        drawHero();
        drawSecret();
        if (deal && U.motion() !== "still") U.restart(stage, "deal");
        staged = true;
    }

    // ---------------------------------------------------------------------------------------------
    // The bar along the top (Exit, the world on stage, stars, coins, the Everbook) and the strip of worlds
    // ---------------------------------------------------------------------------------------------
    $("#cm-exit").append(icon("back"));
    $("#cm-book").prepend(icon("book"));
    function drawBar() {
        const si = data.section, s = map[si], w = Worlds.byId[s.world], t = totals();
        $("#cm-name").textContent = w.name;
        $("#cm-where").textContent = isSecret(si) ? `Secret World · ${bossOf(s.world).name}'s Prison` : `World ${si + 1} of ${MAIN} · ${bossOf(s.world).name}'s World`;
        $("#cm-total").replaceChildren(icon("star"), U.el("b", { text: String(t.stars) }), U.el("span", { text: ` / ${t.max * 3}` }));
        $("#cm-coins").replaceChildren(icon("coin"), U.el("b", { text: String(data.coins) }));
    }
    // one tile per world: a still of its scene, its name, and a pip for each of its five stops
    let stripFor = 0;
    function drawStrip() {
        if (stripFor !== map.length) {
            stripFor = map.length;
            stripEl.replaceChildren(U.el("button", { type: "button", class: "ws-atlas-btn", "aria-label": "See every world", title: "Every World (M)", onclick: () => openAtlas() }, icon("map")));
            map.forEach((s, i) => {
                const w = Worlds.byId[s.world];
                const thumb = U.el("canvas", { class: "ws-thumb", "aria-hidden": "true" });
                const tile = U.el("button", { type: "button", class: "ws-tile", onclick: () => { Sound.play("select"); go(i); } },
                    thumb, U.el("span", { class: "ws-tile-name", text: w.name }), U.el("span", { class: "ws-pips", "aria-hidden": "true" }, ...LV(i).map(() => U.el("i"))),
                    icon("lock", "ws-tile-lock"), U.el("span", { class: "ws-tile-crown", "aria-hidden": "true" }, icon("star")));
                stripEl.append(tile);
                // (a frame apart: each still runs its scene for a moment, and sixteen at once would stall the page)
                setTimeout(() => { if (thumb.isConnected) try { Worlds.preview(thumb, s.world, Worlds.modeFor(w)); } catch (err) { /* no still for this world */ } }, 120 + i * 45);
            });
        }
        const tiles = [...stripEl.querySelectorAll(".ws-tile")];
        tiles.forEach((tile, i) => {
            const open = sectionOpen(i), done = LV(i).filter(l => cleared(i, l)).length;
            tile.classList.toggle("on", i === data.section);
            tile.classList.toggle("shut", !open);
            tile.classList.toggle("won", cleared(i, 5));
            tile.classList.toggle("full", worldStars(i) >= LV(i).length * 3);
            tile.classList.toggle("secret", !!secretOf(i) && secretState(secretOf(i)) === "found");
            tile.setAttribute("aria-current", i === data.section ? "true" : "false");
            tile.setAttribute("aria-label", `${Worlds.byId[map[i].world].name}: ${done} of ${LV(i).length} cleared${open ? "" : ", locked"}`);
            [...tile.querySelector(".ws-pips").children].forEach((pip, k) => pip.classList.toggle("on", cleared(i, LV(i)[k])));
        });
        const on = tiles[data.section];
        if (on && on.scrollIntoView) on.scrollIntoView({ block: "nearest", inline: "center", behavior: U.motion() === "still" ? "auto" : "smooth" });
    }

    // ---------------------------------------------------------------------------------------------
    // Your hero (hero.js): made the first time the campaign opens, changed in the Everbook,
    // standing on the stage at the level it's at and walking the road to the next one. data.hero is its look,
    // data.heroAt the level it stands on ({ si, level }), data.arrived the furthest world it has arrived in (each new
    // world plays its arrival scene once, see travel.js)
    // ---------------------------------------------------------------------------------------------
    const heroLook = () => Hero.fix(data.hero);
    let heroWalking = false, heroArt = "", heroArtFor = "";
    function heroSpot() {
        const at = data.heroAt, f = frontier();
        if (at && map && map[at.si] && LV(at.si).includes(at.level) && unlocked(at.si, at.level)) return at;
        return { si: f.si, level: f.level };
    }
    function heroNode() {
        const key = JSON.stringify(heroLook());
        if (key !== heroArtFor) { heroArtFor = key; heroArt = Hero.svg(heroLook(), "", { still: true }); }
        return U.el("div", { class: "ws-hero" }, U.el("div", { html: heroArt }));
    }
    const placeHero = (node, [x, y]) => { node.style.setProperty("--x", x.toFixed(2) + "%"); node.style.setProperty("--y", y.toFixed(2) + "%"); };
    // the hero stands on the stage only while its own world is the one on stage
    function drawHero() {
        if (heroWalking || !map) return;
        heroLayer.replaceChildren();
        const at = heroSpot();
        if (!data.hero || at.si !== data.section) return;
        const node = heroNode(), i = LV(at.si).indexOf(at.level);
        placeHero(node, spots(at.si)[i]);
        node.classList.toggle("at-boss", at.level === 5);
        heroLayer.append(node);
    }
    // walk the road from where the hero stands to a level of the world on stage (from another world it just appears)
    function walkHero(si, level) {
        if (!map || heroWalking) return Promise.resolve();
        const from = heroSpot();
        data.heroAt = { si, level };
        save();
        if (si !== data.section || from.si !== si || from.level === level || U.motion() === "still" || !data.hero) { drawHero(); return Promise.resolve(); }
        const pts = spots(si), a = LV(si).indexOf(from.level), b = LV(si).indexOf(level), ms = U.clamp(Math.abs(a - b) * 520, 600, 1900);
        heroWalking = true;
        heroLayer.replaceChildren();
        const node = heroNode();
        node.classList.add("walking");
        heroLayer.append(node);
        Sound.play("select");
        return new Promise(done => {
            const t0 = performance.now();
            const step = now => {
                const k = Math.min(1, (now - t0) / ms), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
                const u = a + (b - a) * e, at = roadPoint(pts, u), ahead = roadPoint(pts, U.clamp(u + (b > a ? 0.05 : -0.05), 0, pts.length - 1));
                node.classList.toggle("left", ahead[0] < at[0] - 0.01);
                node.classList.toggle("at-boss", level === 5 && e > 0.8);
                placeHero(node, at);
                if (k < 1 && node.isConnected && U.view() === "campaign") requestAnimationFrame(step);
                else { heroWalking = false; drawHero(); done(); }
            };
            requestAnimationFrame(step);
        });
    }
    // the bosses you've beaten: each one gives your hero new parts (hero.js)
    const beatenBosses = () => (data.betaUnlock ? Bosses.list : (full || map || []).map(s => s.world).filter(w => data.levels[keyOf(w, 5)]));
    async function editHero(first = false) {
        const look = await Hero.maker({ look: data.hero || null, first, beaten: beatenBosses() });
        if (!look) return false;
        data.hero = look;
        save();
        if (map && staged && U.view() === "campaign") { drawHero(); drawPage(); }
        return true;
    }
    // Coming back to the stage: a world reached for the first time plays its arrival scene, then the hero walks on
    async function heroOnMap(fresh = null) {
        if (!map || U.view() !== "campaign") return;
        const f = frontier();
        if (data.arrived == null) { data.arrived = data.storySeen && data.hero ? f.si : -1; save(); }
        if (!data.hero) {
            if (!(await editHero(true))) return;
        }
        if (f.si > data.arrived && U.view() === "campaign") {
            const from = data.arrived >= 0 ? map[data.arrived].world : null, to = map[f.si].world, before = data.arrived;
            data.arrived = f.si;
            data.heroAt = { si: f.si, level: 1 };
            save();
            if (data.section !== f.si) { data.section = f.si; data.sel = 1; save(); showWorld(true); }
            await FX.cinematic(c => Travel.arrive(c, from, to, heroLook(), { index: f.si, total: MAIN }), { stayOn: "campaign" });
            if (U.view() !== "campaign") { data.arrived = before; save(); return; }    // left the map: it plays next time
            drawHero();
            return;
        }
        if (fresh) { openStop(fresh); return; }
        const at = heroSpot();
        if (at.si === f.si && at.si === data.section && at.level < f.level && !data.betaUnlock) setTimeout(() => { if (U.view() === "campaign") walkHero(f.si, f.level); }, 500);
        else drawHero();
    }
    // A stop that has just opened: the road runs on to it, the hero walks along, and the stop wakes up
    async function openStop(level) {
        const si = data.section, pts = spots(si), i = LV(si).indexOf(level);
        if (i < 1 || U.motion() === "still") { drawStage(); return; }
        const walk = walkHero(si, level), t0 = performance.now(), ms = 900;
        await new Promise(done => {
            const step = now => {
                const k = Math.min(1, (now - t0) / ms), d = roadPath(pts, i - 1 + (1 - Math.pow(1 - k, 3)));
                $("#cm-road-done").setAttribute("d", d);
                $("#cm-road-flow").setAttribute("d", d);
                if (k < 1 && U.view() === "campaign" && data.section === si) requestAnimationFrame(step); else done();
            };
            requestAnimationFrame(step);
        });
        await walk;
        if (U.view() !== "campaign" || data.section !== si) return;
        drawStage();
        const stop = stopsEl.querySelector(`.ws-stop[data-level="${level}"]`);
        if (!stop) return;
        U.restart(stop, "fresh");
        Sound.play("sparkle");
        const r = stop.querySelector(".ws-disc").getBoundingClientRect(), css = getComputedStyle(root);
        FX.ring({ x: r.left + r.width / 2, y: r.top + r.height / 2, color: css.getPropertyValue("--accent").trim() || "#ffd23f", r0: r.width / 2, r1: r.width * 1.5, dur: 0.6, width: 6 });
        FX.burst({ x: r.left + r.width / 2, y: r.top + r.height / 2, n: 18, shape: "star", colors: ["#ffd23f", "#fff4c9", css.getPropertyValue("--accent").trim() || "#ffd23f"], speed: 240 });
    }

    // ---------------------------------------------------------------------------------------------
    // Changing the world on stage: the page's background (and with it every colour and face) becomes that world
    // ---------------------------------------------------------------------------------------------
    let fadeTimer = 0, greetTimer = 0, switching = false;
    // a world's companion says hello when the stage reaches it (its whole introduction the first time)
    function greetCompanion(id) {
        clearTimeout(greetTimer);
        greetTimer = setTimeout(() => {
            if (U.view() !== "campaign" || bookOn() || !Worlds.current || Worlds.current.id !== id || typeof Companions === "undefined") return;
            const line = Companions.greet(id);
            if (line) Mascot.say(line, { mood: "happy", hold: 6500 });
        }, 900);
    }
    function swapWorld(si, instant = false) {
        const id = map[si].world, bg = document.getElementById("world-bg");
        clearTimeout(fadeTimer);
        if (Worlds.current && Worlds.current.id === id) { bg.style.opacity = ""; return; }
        if (instant) { bg.style.opacity = ""; Worlds.use(id); greetCompanion(id); return; }
        bg.style.opacity = "0";
        fadeTimer = setTimeout(() => { if (U.view() === "campaign") { Worlds.use(id); greetCompanion(id); } bg.style.opacity = ""; }, 260);
    }
    // the stop a world opens on: the next one to play there, or its boss once it's all done
    function restStop(si) {
        const f = frontier();
        if (f.si === si) return f.level;
        return sectionOpen(si) && LV(si).every(l => cleared(si, l)) ? 5 : 1;
    }
    function showWorld(instant = false) {
        swapWorld(data.section, instant);
        drawBar(); drawStage({ deal: true }); drawPage(); drawStrip();
    }
    // go to world si (and a stop there): the road slides away, the world changes behind it, the new road is dealt in
    function go(si, level) {
        if (!map || !map[si] || switching) return;
        if (si === data.section) { if (level) pickLevel(level); return; }
        const dir = si > data.section ? 1 : -1;
        const land = () => {
            data.section = si;
            data.sel = level || restStop(si);
            save();
            Mascot.hush();
            pageEl.classList.remove("up");
            showWorld(U.motion() === "still");
        };
        if (U.motion() === "still") { land(); return; }
        // the island sails off one way and the next one sails in from the other
        switching = true;
        isle.style.setProperty("--dir", dir);
        isle.classList.remove("sail-in");
        isle.classList.add("sail-out");
        $("#cm-sky").classList.add("out");
        Sound.play("worldSwap");
        setTimeout(() => { land(); isle.classList.remove("sail-out"); isle.classList.add("sail-in"); $("#cm-sky").classList.remove("out"); U.restart(pageEl, "turn"); switching = false; }, 300);
    }

    // ---------------------------------------------------------------------------------------------
    // The page beside the road: the Everbook's page for the world on stage, open at the stop you picked
    // ---------------------------------------------------------------------------------------------
    // About how long a boss fight takes: each phase's puzzle at your own average on levels like it (same difficulty
    // and size), or its par time if you haven't played one, but never longer than the boss itself takes
    function fightEstimate(si) {
        const s = map[si], phases = [[s.levels[4], sizeOf(s, 5)], ...laterPhases(s)];
        const mine = {};
        map.forEach((sec, i) => LV(i).forEach(L => {
            const r = L < 5 && record(i, L);
            if (r && r.seconds > 0) (mine[sec.levels[L - 1] + "x" + sizeOf(sec, L)] = mine[sec.levels[L - 1] + "x" + sizeOf(sec, L)] || []).push(r.seconds);
        }));
        let total = 0, yours = false;
        phases.forEach(([d, size], k) => {
            const t = mine[d + "x" + size];
            if (t) yours = true;
            total += Math.min(t ? t.reduce((a, b) => a + b, 0) / t.length : par(d, size), botTimeFor(d, size, si, k + 1));
        });
        return { phases: phases.length, minutes: Math.max(1, Math.round(total / 60)), yours };
    }
    // a small live portrait of a world's companion (it blinks and breathes while it's on the page)
    const portraits = new Set();
    let portraitRaf = 0;
    function portrait(worldId, size = 52) {
        const cv = U.el("canvas", { class: "dk-companion", width: size * 2, height: size * 2, style: { width: size + "px", height: size + "px" }, "aria-hidden": "true" });
        const w = Worlds.byId[worldId];
        if (!w || !w.mascot) return cv;
        portraits.add({ cv, w, size, st: { t: Math.random() * 3, blink: 0, mood: "happy", look: 0, talk: 0, excite: 0, hop: 0, blinkIn: 1 + Math.random() * 3 } });
        const paint = (p, dt) => {
            const g = p.cv.getContext("2d"), st = p.st, k = (p.size * 2) / 160;
            st.t += dt; st.blinkIn -= dt;
            if (st.blinkIn < 0) { st.blink = 1; st.blinkIn = 2.2 + Math.random() * 3; }
            st.blink = Math.max(0, st.blink - dt * 7);
            g.setTransform(k, 0, 0, k, 0, 0);
            g.clearRect(0, 0, 160, 160);
            try { p.w.mascot.draw(g, st); } catch (err) { /* a world without a drawable companion */ }
        };
        for (const p of portraits) if (p.cv === cv) paint(p, 0);
        if (!portraitRaf && U.motion() !== "still") {
            let last = performance.now();
            portraitRaf = requestAnimationFrame(function loop(now) {
                const dt = Math.min(0.05, (now - last) / 1000);
                last = now;
                for (const p of portraits) { if (!p.cv.isConnected && p.st.t > 1) { portraits.delete(p); continue; } paint(p, dt); }
                portraitRaf = portraits.size ? requestAnimationFrame(loop) : 0;
            });
        }
        return cv;
    }
    const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
    let moveShown = 0;                          // which of a boss's moves is explained on its page
    function drawPage() {
        const si = data.section, s = map[si], w = Worlds.byId[s.world], l = data.sel, boss = l === 5, rec = record(si, l), open = unlocked(si, l);
        const d = s.levels[l - 1], size = sizeOf(s, l), b = bossOf(s.world), won = cleared(si, 5);
        const keep = pageEl.querySelector(".ws-p-body"), keepTop = keep && keep.dataset.for === si + "-" + l ? keep.scrollTop : 0;
        const body = U.el("div", { class: "ws-p-body", "data-for": si + "-" + l });
        body.append(U.el("div", { class: "dk-folio" },
            U.el("span", { class: "eb-ch-n", text: isSecret(si) ? "?" : String(si + 1) }),
            won ? U.el("span", { class: "dk-seal" }, icon("check"), U.el("span", { text: isSecret(si) ? "Rift Sealed" : "Page Won Back" })) : U.el("span", { class: "dk-held", text: `Held by ${b.name}` })));
        body.append(U.el("span", { class: "dk-kicker", text: boss ? "Boss" : `Level ${l} of ${LV(si).length - 1}` }),
            U.el("h2", { class: "dk-title", text: boss ? b.name : `${w.name} ${l}` }));
        if (boss) {
            const th = Powers.threat(si, MAIN), est = fightEstimate(si), moves = Powers.MOVES[s.world] || [];
            body.append(U.el("p", { class: "dk-facts", title: est.yours ? "From your own times on levels like these" : "A typical time" },
                `${plural(est.phases, "Phase")} · About ${plural(est.minutes, "Minute")} · Threat `, U.el("span", { class: "dk-threat", role: "img", "aria-label": `${th.stars} of 5` }, ...[1, 2, 3, 4, 5].map(k => U.el("i", { class: k <= th.stars ? "on" : "" })))));
            body.append(U.el("div", { class: "eb-plate dk-boss-plate" }, U.el("div", { class: "dk-vs" },
                U.el("div", { html: Hero.svg(heroLook()) }), U.el("b", { text: "vs" }), U.el("div", { html: bossSvg(s.world) }))));
            body.append(U.el("p", { class: "dk-taunt", text: `“${b.taunt}”` }));
            if (b.story) body.append(U.el("p", { class: "eb-prose", text: b.story }));
            // its moves: tap one to read what it does
            if (moves.length) {
                moveShown = U.clamp(moveShown, 0, moves.length - 1);
                const what = U.el("p", { class: "dk-move-what", "aria-live": "polite" });
                const grid = U.el("div", { class: "dk-move-grid", role: "group", "aria-label": "Its moves" });
                const show = k => { moveShown = k; [...grid.children].forEach((c, n) => c.setAttribute("aria-pressed", n === k ? "true" : "false")); what.replaceChildren(U.el("b", { text: moves[k].name + ". " }), "It " + moves[k].desc); };
                moves.forEach((m, k) => grid.append(U.el("button", { type: "button", class: "dk-move", onclick: () => { Sound.play("select"); show(k); } }, U.el("span", { text: m.icon, "aria-hidden": "true" }), U.el("b", { text: m.name }))));
                show(moveShown);
                body.append(U.el("h3", { class: "dk-sub", text: "Its Moves" }), grid, what);
            }
            const lesson = lessonOf(si, l);
            if (lesson) body.append(U.el("h3", { class: "dk-sub", text: "Boss Review" }), U.el("p", { class: "eb-prose", text: lesson.practise }));
        } else {
            body.append(U.el("p", { class: "dk-facts", text: `${label(d, size)} · Par ${U.fmtTime(par(d, size))}` }));
            const lesson = lessonOf(si, l);
            if (lesson) body.append(U.el("h3", { class: "dk-lesson" }, U.el("small", { text: "Lesson" + (lesson.round > 1 ? ` · Round ${lesson.round}` : "") }), lesson.name),
                U.el("p", { class: "eb-prose", text: lesson.practise }), U.el("p", { class: "eb-tip" }, icon("spark"), U.el("span", { text: lesson.tip })));
            if (isSecret(si)) body.append(U.el("p", { class: "eb-small why" }, icon("clock"), U.el("span", { text: "The corruption meter rises as you solve. Finished words push it back. If it fills, the level is lost." })));
        }
        const got = rec ? rec.stars : 0;
        const goals = boss ? ["Win the Race", `Boss Kept Under ${Math.round(STAR_CLOSE[0] * 100)}%`, `Boss Kept Under ${Math.round(STAR_CLOSE[1] * 100)}%`] : ["Solve It", "No Items", starGoal(lessonOf(si, l), d, size)[0]];
        body.append(U.el("ul", { class: "eb-goals", "aria-label": "Stars" }, ...goals.map((g, i) => U.el("li", { class: i < got ? "got" : "" }, icon("star"), U.el("span", { text: g })))));
        const prize = abilityPrize(si, l);
        if (prize) body.append(U.el("p", { class: "eb-small" }, icon("bolt"), U.el("span", { text: rec ? `You unlocked ${prize.name} here.` : `Clear it to unlock ${prize.name}.` })));
        if (rec) body.append(U.el("p", { class: "eb-small" }, icon("check"), U.el("span", { text: `Best: ${U.fmtTime(rec.seconds || 0)}` })));
        if (boss && !rec && Hero.giftNames && Hero.giftNames(s.world)) body.append(U.el("p", { class: "eb-small" }, icon("hero"), U.el("span", { text: `Win for your hero: ${Hero.giftNames(s.world).join(", ")}.` })));
        // the companion's note in the margin
        const line = typeof Companions !== "undefined" && (boss ? Companions.boss(s.world, "before") : Companions.level(s.world, l));
        if (w.mascot && line) body.append(U.el("figure", { class: "dk-note" }, portrait(s.world), U.el("figcaption", {}, U.el("b", { text: w.mascot.name }), U.el("q", { text: line }))));

        const foot = U.el("div", { class: "ws-p-go" });
        if (boss && open) foot.append(loadoutBox(s.world, drawPage));
        const why = !open ? (!sectionOpen(si) ? `Beat ${bossOf(map[si - 1].world).name} First` : `Clear Level ${prevLevel(si, l)} First`) : "";
        foot.append(U.el("button", { type: "button", class: "ws-play", disabled: !open, onclick: () => dive(l) },
            icon(open ? "play" : "lock"), U.el("span", { text: !open ? why : boss ? (rec ? "Fight Again" : "Fight") : rec ? "Play Again" : "Play" })));
        foot.append(U.el("div", { class: "ws-p-links" },
            U.el("button", { type: "button", class: "ws-link", text: "Shop", onclick: () => openBook("shop", { shopTab: boss ? "abilities" : "items" }) }),
            boss ? U.el("button", { type: "button", class: "ws-link", text: "How It Works", onclick: () => HowTo.open("boss") }) : U.el("button", { type: "button", class: "ws-link", text: "Skills", onclick: () => openBook("skills") })));
        pageEl.replaceChildren(body, foot);
        pageEl.classList.toggle("is-boss", boss);
        body.scrollTop = keepTop;
    }
    // pick a stop of the world on stage; picking the one that's already open plays it
    function pickLevel(l, fromStage = false) {
        const si = data.section;
        if (fromStage && data.sel === l && unlocked(si, l) && !phone.matches) { dive(l); return; }
        if (fromStage && phone.matches && data.sel === l) pageEl.classList.toggle("up");
        data.sel = l;
        save();
        Sound.play("select");
        stopsEl.querySelectorAll(".ws-stop").forEach(b => { const on = +b.dataset.level === l; b.classList.toggle("sel", on); b.setAttribute("aria-pressed", on ? "true" : "false"); if (on) U.restart(b, "bump"); });
        stopsEl.querySelectorAll(".ws-pad").forEach(p => p.classList.toggle("sel", +p.dataset.level === l));
        if (U.motion() !== "still") U.restart(pageEl, "turn");
        moveShown = 0;
        drawPage();
        if (l === 5) bossSay();
        if (fromStage && unlocked(si, l) && data.hero) walkHero(si, l);
    }

    // ---------------------------------------------------------------------------------------------
    // The secret worlds: four hidden places, each branching off a world once that world's boss is beaten.
    // Nothing says they exist. After the boss falls, something odd turns up on that island (an omen), different in
    // every world, and it has to be dealt with its own way:
    //   Acorn Woods   a giant acorn that keeps hopping away: catch it three times and it cracks open
    //   Coral Reef    a bottle bobbing in the sea beside the island: pull its cork
    //   Desert        an oasis that vanishes when the pointer comes near (a mirage): the fourth time it's real
    //   Volcano       a boulder with a glowing crack: press and hold until it splits
    // Each gives up a torn scrap with a riddle. Say the answer (type it) and the way in appears: a gate on the island,
    // and a small island of its own in the Atlas. data.secrets: { id: "found" }.
    // The worlds behind the gates aren't built yet: a found gate shows what's waiting and says its door is still shut.
    // ---------------------------------------------------------------------------------------------
    const SECRETS = [
        { id: "hollow", parent: "squirrel", name: "The Great Hollow", boss: "The Giant Squirrel", color: "#8a5a2b", omen: "acorn", riddle: "I start as a nut and end as a tree.", answer: "ACORN",
            tease: "Deep inside the oldest oak, something enormous is cracking nuts. Whole ones. With the tree still attached." },
        { id: "atlantis", parent: "ocean", name: "Atlantis", boss: "Poseidon", color: "#1f8fb8", omen: "bottle", riddle: "The city that sank beneath the waves.", answer: "ATLANTIS",
            tease: "Far below the reef a drowned city still keeps its lights on. Its king has a trident, and he has been collecting letters." },
        { id: "dunes", parent: "desert", name: "The Sunken Dunes", boss: "The Sandworm", color: "#c98a3c", omen: "mirage", riddle: "Water you can see but never drink, shimmering on hot sand.", answer: "MIRAGE",
            tease: "The sand here moves by itself. Something long is swimming through the dunes, and it swallows whole sentences." },
        { id: "cave", parent: "volcano", name: "The Lava Cave", boss: "The Lava Beast", color: "#d9481f", omen: "crack", riddle: "The black glass that lava leaves behind.", answer: "OBSIDIAN",
            tease: "Under the volcano is a cave the Magma Wyrm is afraid of. Whatever lives there is made of the mountain itself." }
    ];
    const INK2 = "#2b2233";
    const OMEN_ART = {
        acorn: `<svg viewBox="-30 -62 60 66"><ellipse cy="-20" rx="20" ry="23" fill="#b9773e" stroke="${INK2}" stroke-width="3"/><path d="M-24-30a24 16 0 0 1 48 0z" fill="#6e4429" stroke="${INK2}" stroke-width="3" stroke-linejoin="round"/><path d="M0-46v-11" stroke="#6e4429" stroke-width="5" stroke-linecap="round"/><path d="M-9-18q3-8 9-8" fill="none" stroke="#f2d2a2" stroke-width="3" stroke-linecap="round"/></svg>`,
        bottle: `<svg viewBox="-22 -72 44 76"><rect class="ws-cork" x="-6" y="-68" width="12" height="11" rx="2" fill="#b9773e" stroke="${INK2}" stroke-width="2"/><path d="M-6-57h12v10q10 6 10 18v21a6 6 0 0 1-6 6h-20a6 6 0 0 1-6-6v-21q0-12 10-18z" fill="rgba(170,230,240,.55)" stroke="#e8f8ff" stroke-width="3" stroke-linejoin="round"/><rect x="-8" y="-26" width="17" height="15" rx="2" fill="#f6ecd2" stroke="#b9a070" stroke-width="1.5" transform="rotate(-12)"/></svg>`,
        mirage: `<svg viewBox="-42 -74 84 78"><ellipse cy="-5" rx="36" ry="8" fill="#5ec8e0" stroke="#fff" stroke-width="2"/><path d="M-6-7q5-30 0-50" fill="none" stroke="#7a4a2a" stroke-width="7" stroke-linecap="round"/><path d="M-6-57q-22-8-30 8M-6-57q22-10 32 6M-6-57q-6-18-24-12M-6-57q10-16 26-10" fill="none" stroke="#2f9e6b" stroke-width="6" stroke-linecap="round"/></svg>`,
        crack: `<svg viewBox="-44 -70 88 74"><path d="M-36 0l-6-24 16-26 28-12 26 14 12 28-8 20z" fill="#3a2622" stroke="${INK2}" stroke-width="3" stroke-linejoin="round"/><path d="M-22-40l10 6" stroke="#5a3f39" stroke-width="4" stroke-linecap="round"/><path class="ws-crack-glow" d="M2-60l-8 16 10 10-12 14 8 10-6 10" fill="none" stroke="#ffb21e" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/></svg>`
    };
    const gateArt = sec => `<svg viewBox="-38 -86 76 90"><path d="M-32 0V-48a32 32 0 0 1 64 0V0z" fill="${sec.color}" stroke="${INK2}" stroke-width="3" stroke-linejoin="round"/><path d="M-21 0V-46a21 21 0 0 1 42 0V0z" fill="#150a22"/><text y="-18" text-anchor="middle" font-size="32" font-weight="900" fill="#ffd66b" font-family="Georgia, serif">?</text></svg>`;
    data.secrets = data.secrets || {};
    const secretOf = si => (map && map[si] ? SECRETS.find(s => s.parent === map[si].world) || null : null);
    // "hidden" (its boss still stands), "omen" (something odd is on the island) or "found"
    const secretState = sec => (data.secrets[sec.id] === "found" ? "found" : data.levels[keyOf(sec.parent, 5)] || data.betaUnlock ? "omen" : "hidden");
    const foundSecrets = () => SECRETS.filter(s => secretState(s) === "found" && map && map.some(m => m.world === s.parent));
    const omenEl = U.el("div", { class: "ws-stops ws-omens" });
    plane.append(omenEl);
    let omenTimer = 0;
    // a place on the island away from the road (k picks a different one each time)
    function freeSpot(si, k = 0) {
        const r = U.rng(si * 977 + k * 131 + 3), pts = spots(si), road = [];
        for (let u = 0; u <= pts.length - 1; u += 0.1) road.push(roadPoint(pts, u));
        for (let tries = 0; tries < 300; tries++) {
            const x = 8 + r() * 84, y = 18 + r() * 70;
            if (Math.hypot(x - 50, y - 50) < 44 && !road.some(p => Math.hypot(p[0] - x, p[1] - y) < 19)) return [x, y];
        }
        return [84, 60];
    }
    const placeAt = (node, [x, y]) => { node.style.setProperty("--x", x.toFixed(1) + "%"); node.style.setProperty("--y", y.toFixed(1) + "%"); };
    function drawSecret() {
        clearInterval(omenTimer);
        omenEl.replaceChildren();
        const si = data.section, sec = secretOf(si), state = sec ? secretState(sec) : "hidden";
        if (state === "hidden") return;
        if (state === "found") {
            const gate = U.el("button", { type: "button", class: "ws-omen ws-gate", "aria-label": `${sec.name}: a secret world`, html: gateArt(sec), onclick: () => showSecret(sec, false) });
            gate.append(U.el("span", { class: "ws-gate-name", text: sec.name }));
            placeAt(gate, freeSpot(si));
            omenEl.append(gate);
            return;
        }
        const omen = U.el("button", { type: "button", class: "ws-omen " + sec.omen, "aria-label": "Something strange", html: OMEN_ART[sec.omen] });
        omenEl.append(omen);
        let n = 0;
        const done = () => { clearInterval(omenTimer); omen.classList.add("open"); Sound.play("sparkle"); setTimeout(() => { if (omen.isConnected) openRiddle(sec); }, 750); };
        if (sec.omen === "acorn") {
            // it hops somewhere else every few seconds, and faster each time it's caught
            let k = 0;
            const hop = () => { placeAt(omen, freeSpot(si, ++k)); U.restart(omen, "hop"); };
            placeAt(omen, freeSpot(si, 0));
            omenTimer = setInterval(hop, 3200);
            omen.addEventListener("click", () => {
                if (omen.classList.contains("open")) return;
                Sound.play("select");
                if (++n >= 3) { done(); return; }
                clearInterval(omenTimer);
                hop();
                omenTimer = setInterval(hop, 3200 - n * 900);
            });
        } else if (sec.omen === "bottle") {
            placeAt(omen, [si % 2 ? -9 : 109, 62]);                 // (off the island's edge, in the open)
            omen.addEventListener("click", () => { if (!omen.classList.contains("open")) done(); });
        } else if (sec.omen === "mirage") {
            // gone the moment you come near; the fourth time it stays
            placeAt(omen, freeSpot(si, 0));
            const flee = () => {
                if (n >= 3 || omen.classList.contains("gone")) return;
                n++;
                omen.classList.add("gone");
                setTimeout(() => { if (!omen.isConnected) return; placeAt(omen, freeSpot(si, n)); omen.classList.remove("gone"); if (n >= 3) omen.classList.add("real"); }, 900);
            };
            omen.addEventListener("pointerenter", flee);
            omen.addEventListener("click", () => { if (n >= 3 && !omen.classList.contains("gone") && !omen.classList.contains("open")) done(); else flee(); });
        } else {
            // the crack: press and hold until it glows white and gives
            placeAt(omen, freeSpot(si, 0));
            let heat = 0, held = false, raf = 0, last = 0;
            const step = now => {
                const dt = Math.min(0.05, (now - last) / 1000);
                last = now;
                heat = U.clamp(heat + (held ? dt / 1.8 : -dt / 0.6), 0, 1);
                omen.style.setProperty("--heat", heat.toFixed(3));
                if (heat >= 1) { held = false; done(); return; }
                raf = heat > 0 || held ? requestAnimationFrame(step) : 0;
            };
            const press = on => e => { if (omen.classList.contains("open")) return; if (on) e.preventDefault(); held = on; if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); } };
            // (the press keeps hold of the pointer: the island turns a little under it, and the crack would slip away)
            omen.addEventListener("pointerdown", e => { try { omen.setPointerCapture(e.pointerId); } catch (err) { /* no capture: the hold still works while the pointer stays on it */ } press(true)(e); });
            for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) omen.addEventListener(ev, press(false));
            omen.addEventListener("keydown", e => { if ((e.key === " " || e.key === "Enter") && !e.repeat) press(true)(e); });
            omen.addEventListener("keyup", press(false));
        }
    }
    // the torn scrap: a riddle, answered by typing the word
    function openRiddle(sec) {
        if (document.querySelector(".sc-layer")) return;
        let tries = 0;
        const input = U.el("input", { class: "sc-input", type: "text", maxlength: sec.answer.length, autocomplete: "off", autocapitalize: "characters", spellcheck: "false", "aria-label": "Your answer", style: { "--n": sec.answer.length } });
        const hint = U.el("p", { class: "sc-hint", "aria-live": "polite", text: `${sec.answer.length} Letters` });
        const card = U.el("form", { class: "sc-scrap" }, U.el("small", { text: "A Torn Scrap" }), U.el("p", { class: "sc-riddle", text: `“${sec.riddle}”` }), input, hint,
            U.el("div", { class: "sc-actions" }, U.el("button", { type: "button", class: "eb-quiet", text: "Put It Back", onclick: () => close() }), U.el("button", { type: "submit", class: "eb-buy", text: "Say the Word" })));
        const layer = U.el("div", { class: "results in sc-layer", role: "dialog", "aria-modal": "true", "aria-label": "A torn scrap" }, card);
        const close = () => { layer.remove(); if (onStage()) drawSecret(); };
        card.addEventListener("submit", e => {
            e.preventDefault();
            if (input.value.trim().toUpperCase() === sec.answer) { layer.remove(); foundSecret(sec); return; }
            tries++;
            Sound.play("wrong");
            U.restart(card, "no");
            input.select();
            hint.textContent = tries >= 4 ? `Starts with ${sec.answer[0]}, ends with ${sec.answer[sec.answer.length - 1]}` : tries >= 2 ? `Starts with ${sec.answer[0]}` : "Not that. Try again.";
        });
        layer.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Escape") close(); });
        layer.addEventListener("pointerdown", e => { if (e.target === layer) close(); });
        document.getElementById("overlay").append(layer);
        Mascot.hush();
        input.focus();
    }
    function foundSecret(sec) {
        data.secrets[sec.id] = "found";
        save();
        Sound.play("sparkle");
        showSecret(sec, true);
    }
    // what's behind the gate: shown when it's found (with a little ceremony) and whenever the gate is picked
    function showSecret(sec, first) {
        if (document.querySelector(".sc-layer")) return;
        const close = () => {
            layer.remove();
            if (!onStage()) return;
            drawSecret(); drawStrip();
            const gate = omenEl.querySelector(".ws-gate");
            if (first && gate) { U.restart(gate, "rise"); const r = gate.getBoundingClientRect(); FX.ring({ x: r.left + r.width / 2, y: r.top + r.height / 2, color: sec.color, r0: 20, r1: 220, dur: 0.8, width: 8 }); }
        };
        const layer = U.el("div", { class: "results in sc-layer sc-reveal" + (first ? " first" : ""), role: "dialog", "aria-modal": "true", "aria-label": sec.name, style: { "--c": sec.color } },
            U.el("div", { class: "sc-card" },
                U.el("div", { class: "sc-eyes", "aria-hidden": "true" }, U.el("i"), U.el("i")),
                U.el("small", { text: first ? "You Found a Secret World" : "A Secret World" }),
                U.el("h2", { text: sec.name }),
                U.el("p", { class: "sc-tease", text: sec.tease }),
                U.el("p", { class: "sc-who" }, icon("lock"), U.el("span", { text: `${sec.boss} is waiting. Its door opens in a coming update.` })),
                U.el("button", { type: "button", class: "eb-buy", text: first ? "Mark It on the Map" : "Close", onclick: () => close() })));
        layer.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Escape") close(); });
        layer.addEventListener("pointerdown", e => { if (e.target === layer) close(); });
        document.getElementById("overlay").append(layer);
        Mascot.hush();
        layer.querySelector("button").focus();
    }

    // ---------------------------------------------------------------------------------------------
    // The wider world: small islands (the neighbours in the distance, and the Atlas), mist drifting past,
    // the boss answering back, and the dive into a level
    // ---------------------------------------------------------------------------------------------
    // a world as a small island with its boss standing on it (a shadow of it while the world is locked)
    function miniIsle(si, withHero = false) {
        const s = map[si], b = biome(s.world);
        return U.el("span", { class: "ws-mini" + (sectionOpen(si) ? "" : " shut") + (cleared(si, 5) ? " won" : ""), style: { "--ground": b.ground, "--hill": b.hill, "--path": b.path } },
            U.el("i", { class: "ws-mini-slab" }), U.el("span", { class: "ws-mini-boss", html: bossSvg(s.world) }),
            withHero && data.hero ? U.el("span", { class: "ws-mini-hero", html: Hero.svg(heroLook(), "", { still: true }) }) : null);
    }
    // mist: two banks behind the island and one in front of it
    stage.prepend(U.el("i", { class: "ws-cloud", style: { "--t": "12%", "--w": "46%", "--d": "95s", "--dl": "-30s", "--o": ".5" } }),
        U.el("i", { class: "ws-cloud", style: { "--t": "40%", "--w": "34%", "--d": "70s", "--dl": "-55s", "--o": ".4" } }));
    isle.after(U.el("i", { class: "ws-cloud front", style: { "--t": "78%", "--w": "52%", "--d": "120s", "--dl": "-80s", "--o": ".34" } }));
    // pick the boss and it has something to say
    function bossSay() {
        const stop = stopsEl.querySelector(".ws-stop.boss"), si = data.section;
        if (!stop || !sectionOpen(si)) return;
        stop.querySelectorAll(".ws-taunt").forEach(n => n.remove());
        const say = U.el("span", { class: "ws-taunt", "aria-hidden": "true", text: cleared(si, 5) ? U.pick(["You again?", "Haven't you won enough?", "Back for another round?"]) : bossOf(map[si].world).taunt });
        stop.append(say);
        setTimeout(() => say.remove(), 3400);
    }
    // Play: the view dives into the stop you picked, then the level begins
    let diving = false;
    function dive(l) {
        const si = data.section, world = map[si].world, disc = stopsEl.querySelector(`.ws-stop[data-level="${l}"] .ws-disc`);
        if (!unlocked(si, l) || diving) return;
        if (!onStage() || !disc || U.motion() !== "full") { play(world, l); return; }
        diving = true;
        const r = disc.getBoundingClientRect(), box = isle.getBoundingClientRect();
        isle.style.transformOrigin = `${(r.left + r.width / 2 - box.left).toFixed(0)}px ${(r.top + r.height / 2 - box.top).toFixed(0)}px`;
        isle.classList.remove("sail-in");
        isle.classList.add("dive");
        view.classList.add("diving");
        setTimeout(() => {
            play(world, l);
            setTimeout(() => { isle.classList.remove("dive"); view.classList.remove("diving"); isle.style.transformOrigin = ""; diving = false; }, 450);
        }, 560);
    }
    // The Atlas: step back and see every island at once, in order along the thread of the story. Pick one to go there.
    let atlasOn = false;
    const atlasEl = U.el("div", { class: "ws-atlas", role: "dialog", "aria-modal": "true", "aria-label": "Every world", hidden: true });
    view.append(atlasEl);
    function openAtlas() {
        if (!onStage() || atlasOn || switching || diving || bookOn()) return;
        atlasOn = true;
        Mascot.hush();
        const n = map.length, cols = phone.matches ? 3 : 5, rows = Math.ceil(n / cols), here = heroSpot().si;
        // the islands snake across the sky: left to right, then back
        const pts = map.map((s, i) => {
            const r = Math.floor(i / cols), c = i % cols, x = ((r % 2 ? cols - 1 - c : c) + 0.5) / cols * 100;
            return [x, (r + 0.5) / rows * 100 + Math.sin(i * 1.7) * (14 / rows)];
        });
        const reached = map.filter((s, i) => sectionOpen(i)).length, main = map.filter(s => !s.secret), won = main.filter(s => data.levels[keyOf(s.world, 5)]).length;
        const inner = U.el("div", { class: "ws-at-inner", style: { minHeight: rows * (phone.matches ? 150 : 0) + "px" } });
        inner.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path class="ws-at-thread" d="${roadPath(pts)}"/><path class="ws-at-done" d="${roadPath(pts, reached - 1)}"/></svg>`;
        map.forEach((s, i) => {
            const w = Worlds.byId[s.world], open = sectionOpen(i), stars = worldStars(i);
            inner.append(U.el("button", { type: "button", class: "ws-at" + (i === data.section ? " here" : "") + (open ? "" : " shut") + (cleared(i, 5) ? " won" : ""), "data-world": s.world, "data-theme": Worlds.modeFor(w),
                style: { "--x": pts[i][0].toFixed(1) + "%", "--y": pts[i][1].toFixed(1) + "%", "--i": i },
                "aria-label": `${w.name}: ${open ? stars + " of " + LV(i).length * 3 + " stars" : "locked"}`, onclick: () => { closeAtlas(); go(i); } },
                miniIsle(i, i === here), U.el("b", { text: w.name }),
                U.el("small", {}, open ? icon("star") : icon("lock"), open ? `${stars} / ${LV(i).length * 3}` : bossOf(s.world).name)));
        });
        let branches = "";
        map.forEach((s, i) => {
            const sec = secretOf(i), state = sec ? secretState(sec) : "hidden";
            if (state === "hidden") return;
            const side = pts[i][0] > 80 ? -1 : 1, bx = pts[i][0] + side * (phone.matches ? 13 : 8.5), by = pts[i][1] + 100 / rows * 0.36;
            if (state === "omen") { inner.append(U.el("i", { class: "ws-at-glimmer", title: "Something is hidden here", style: { "--x": bx.toFixed(1) + "%", "--y": by.toFixed(1) + "%" } })); return; }
            branches += `<path class="ws-at-branch" d="M${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}Q${((pts[i][0] + bx) / 2).toFixed(1)} ${(by + 4).toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}"/>`;
            inner.append(U.el("button", { type: "button", class: "ws-at ws-at-secret", style: { "--x": bx.toFixed(1) + "%", "--y": by.toFixed(1) + "%", "--i": map.length + i, "--c": sec.color },
                "aria-label": `${sec.name}, a secret world off ${Worlds.byId[s.world].name}`, onclick: () => { closeAtlas(); if (i === data.section) showSecret(sec, false); else go(i); } },
                U.el("span", { class: "ws-at-gate", html: gateArt(sec) }), U.el("b", { text: sec.name }), U.el("small", {}, icon("lock"), "Sealed")));
        });
        if (branches) inner.querySelector("svg").insertAdjacentHTML("beforeend", branches);
        const secretsFound = foundSecrets().length;
        atlasEl.replaceChildren(
            U.el("header", {}, U.el("div", {}, U.el("h2", { text: "The Everbook's Worlds" }), U.el("p", { text: `${won} of ${main.length} Pages Won Back` + (secretsFound ? ` · ${plural(secretsFound, "Secret World")} Found` : "") })),
                U.el("button", { type: "button", class: "ws-at-close", "aria-label": "Close", onclick: () => closeAtlas() }, icon("close"))),
            U.el("div", { class: "ws-at-map" }, inner));
        atlasEl.classList.remove("out");
        atlasEl.hidden = false;
        view.classList.add("atlas-on");
        root.classList.add("cm-atlas-on");
        Sound.play("worldSwap");
        const cur = atlasEl.querySelector(".ws-at.here");
        if (cur) { cur.focus({ preventScroll: true }); if (phone.matches) cur.scrollIntoView({ block: "center" }); }
    }
    function closeAtlas(now = false) {
        if (!atlasOn) return;
        atlasOn = false;
        view.classList.remove("atlas-on");
        root.classList.remove("cm-atlas-on");
        if (now) { atlasEl.hidden = true; return; }
        atlasEl.classList.add("out");
        setTimeout(() => { if (!atlasOn) atlasEl.hidden = true; }, 240);
    }
    // the wheel steps back to the Atlas (and forward out of it)
    let wheelAt = 0;
    view.addEventListener("wheel", e => {
        if (!onStage() || e.ctrlKey || e.target.closest(".ws-panel, .ws-strip, .ws-at-map") && !(atlasOn && !phone.matches)) return;
        if (Math.abs(e.deltaY) < 20 || performance.now() - wheelAt < 500) return;
        wheelAt = performance.now();
        if (e.deltaY > 0 && !atlasOn) openAtlas(); else if (e.deltaY < 0 && atlasOn) closeAtlas();
    }, { passive: true });

    // ---------------------------------------------------------------------------------------------
    // Showing the stage (#campaign) and playing a level (#level)
    // ---------------------------------------------------------------------------------------------
    async function showMap() {
        const loadingEl = $("#cm-loading");
        try {
            await fetchMap();
        } catch (err) {
            loadingEl.hidden = false;
            U.failCard(loadingEl, err, { retry: () => { if (U.view() === "campaign") showMap(); } });
            return;
        }
        if (U.view() !== "campaign") return;
        loadingEl.hidden = true;
        data = { ...data, ...U.store.get("campaign", {}) };
        const f = frontier(), key = f.si + "-" + f.level;
        data.section = U.clamp(data.section || 0, 0, map.length - 1);
        if (!LV(data.section).includes(data.sel)) data.sel = restStop(data.section);
        // a stop that opened since the stage was last seen gets its own little show (not a new world's first stop:
        // the arrival scene is that world's show)
        const fresh = data.shown && data.shown !== key && f.si === data.section && f.level > 1 && !cleared(f.si, f.level) && !data.betaUnlock ? f.level : null;
        data.shown = key;
        if (fresh) data.sel = fresh;
        save();
        pageEl.classList.remove("up");
        swapWorld(data.section, true);
        drawBar(); drawStage({ deal: true, hold: fresh }); drawPage(); drawStrip();
        // the first time you open the campaign: the story so far (the Everbook replays it)
        if (!data.storySeen) {
            data.storySeen = true;
            data.arrived = -1;
            save();
            setTimeout(async () => {
                if (U.view() !== "campaign") return;
                await FX.cinematic(c => Story.intro(c, storyPages()), { stayOn: "campaign" });
                if (U.view() === "campaign") heroOnMap();
                else { data.storySeen = false; save(); }            // left the map during it: it plays next time
            }, 400);
        } else setTimeout(() => heroOnMap(fresh), fresh ? 700 : 450);
    }

    function play(world, level) {
        data.playing = { world, level };
        // (the stage comes back to this level's world, with the hero standing on it)
        if (map && map.some(s => s.world === world)) { data.section = map.findIndex(s => s.world === world); data.sel = level; data.heroAt = { si: data.section, level }; }
        save();
        closeBook(true);
        // a level that was finished (or given up), and every boss fight, starts again from scratch with a new puzzle from
        // its pool; a level you're in the middle of carries on with the one it has
        if (Game.restartSlot(slotName())) { newPick(world, level); Game.forgetSlot(slotName()); }
        if (level === 5) { fight = null; prefetchBoss(world); }   // a boss fight always starts from the beginning
        else { fight = null; hidePanel(); }                        // straight from a boss to a level: the boss panel goes
        Sound.play("start");
        enterLevel();
    }

    // Into the level view. From inside a level (a rematch from a lose card, the next level) the hash
    // doesn't change, so onView doesn't run: put on the level's world here, or the last one's scene, board and win stay
    function enterLevel() {
        syncHelp();
        if (U.view() === "level") { Worlds.use(data.playing.world); Game.show("level"); }
        else location.hash = "#level";
    }
    const slotName = () => !data.playing ? "campaign-none" : data.playing.special ? "special-" + data.playing.special : "campaign-" + keyOf(data.playing.world, data.playing.level);
    // The Daily Boss: a boss fight outside the campaign (data.playing.special = "daily"). It's that boss's own race
    // (its moves, music and arena) at its campaign boss puzzle, one phase.
    // Nothing in the campaign changes: no stars or records, no rerolls, no pages for the book.
    const special = () => (data.playing && data.playing.special) || null;
    const dayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    async function playSpecial(kind = "daily", { rematch = false } = {}) {
        // a fight that's still going (you went back to the Daily page): carry on with it, so starting
        // over can't skip an attempt or refill the abilities. Giving up ends it.
        if (!rematch && fight && !fight.over && !fight.attemptCounted && special() === kind && fight.key === "sp-" + data.playing.sid && data.playing.date === dayStr()) {
            enterLevel();
            return;
        }
        const problem = err => { const d = U.describe(err); FX.toast({ icon: "⚠️", kicker: "BOSS", title: d.title, text: d.text, ms: 4000 }); };
        try { await fetchMap(); } catch (err) { problem(err); return; }
        let world = null;
        try { world = (await U.fetchJson(`/api/boss/daily?date=${dayStr()}`)).world; } catch (err) { problem(err); return; }
        if (!world || !map.some(s => s.world === world)) { FX.toast({ icon: "⚠️", kicker: "BOSS", title: "Couldn't Find Today's Boss", text: "Reload the page and try again.", ms: 4000 }); return; }
        data.playing = { world, level: 5, special: "daily", date: dayStr(), sid: Date.now() };
        save();
        fight = null;
        prefetchBoss(world);
        Sound.play("start");
        Game.forgetSlot(slotName());                      // today's boss, fetched again: a new copy of its puzzle
        enterLevel();
    }
    const specialUrl = () => `/api/boss?kind=daily&date=${data.playing.date || dayStr()}`;
    const backToMode = () => { location.hash = special() ? "#daily" : "#campaign"; };
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
        if (c.special) return { title: `Boss: ${bossOf(c.world).name}`, sub: w.name };       // the Daily Boss
        const where = isSecret(c.si) ? "Secret World" : `World ${c.si + 1}`;
        if (c.level === 5) return { title: "Boss: " + bossOf(c.world).name, sub: `${where} · ${w.name}` };
        return { title: `${w.name} · Level ${c.level}`, sub: (isSecret(c.si) ? where : `${where} of ${MAIN}`) + (c.difficulty ? ` · ${label(c.difficulty, c.size)}` : "") };
    }
    function cardInfo(puzzle) {
        const c = current(), w = c && Worlds.byId[c.world];
        if (!w) return null;
        const boss = c.level === 5;
        return {
            mode: "campaign", difficulty: puzzle.difficulty, stage: `WORLD ${c.si + 1}-${c.level}`,
            kicker: c.special ? "BOSS" : boss ? `${worldTag(c.si)} · BOSS BATTLE` : `${worldTag(c.si)} · LEVEL ${c.level}`,
            title: boss ? bossOf(c.world).name : w.name,
            sub: boss ? bossOf(c.world).taunt : (lessonOf(c.si, c.level) ? `Lesson: ${lessonOf(c.si, c.level).name} · ★ ${starGoal(lessonOf(c.si, c.level), puzzle.difficulty, puzzle.size)[0]}` : label(puzzle.difficulty, puzzle.size)),
            stardate: `SECTOR ${c.si + 1}.${c.level}`
        };
    }

    // Called by app.js for every screen: campaign screens wear the campaign's world; the rest wear the player's own
    // Check and Reveal: never in the campaign (levels and bosses alike), always on the Daily Boss and
    // everywhere else. ONE class decides it, set whenever the screen or the puzzle changes, so it
    // can't be left over from an earlier screen or wait for a fight's panel (it used to be three classes set at
    // different moments, so Check and Reveal sometimes showed and sometimes didn't)
    function syncHelp() {
        root.classList.toggle("no-help", U.view() === "level" && !!data.playing && !data.playing.special);
        root.classList.toggle("boss-stage", U.view() === "level" && !!data.playing && data.playing.level === 5);     // (a boss fight has its own layout)
    }
    Bus.on("puzzle", syncHelp);
    function onView(view) {
        root.classList.toggle("no-help", view === "level" && !!data.playing && !data.playing.special);
        root.classList.toggle("boss-stage", view === "level" && !!data.playing && data.playing.level === 5);
        root.classList.toggle("in-campaign", view === "campaign" || view === "level");
        root.classList.toggle("in-map", view === "campaign");
        root.classList.toggle("in-level", view === "level");
        if (view !== "level") { hidePanel(); Corruption.pause(); Sound.levelSong(null, { fade: 1 }); musicCtl.hidden = true; }
        if (view !== "campaign") closeAtlas(true);
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
        let stars, corruptPeak = null;
        if (skipping) {
            stars = 1;
            earned.push(["Cleared With a Level Clear", true]);
        } else if (boss) {
            stars = bossStars();
            const close = fight ? Math.round(Math.max(fight.closest, bossPct()) * 100) : 0;
            earned.push(["Won the Race", true], [`Boss Kept Under ${Math.round(STAR_CLOSE[0] * 100)}%`, stars >= 2], [`Boss Kept Under ${Math.round(STAR_CLOSE[1] * 100)}%`, stars >= 3], [`Closest It Got: ${close}%`, true]);
            if (fight && fight.phases > 1) earned.push([fight.phases === 2 ? "Beat Both Phases" : `Beat All ${fight.phases} Phases`, fight.phase === fight.phases]);
            if (fight && fight.bestCombo > 1) earned.push([`Best Combo: ×${fight.bestCombo}`, true]);
        } else {
            const lesson = lessonOf(c.si, c.level), [goal, check] = starGoal(lesson, d, puzzle.size);
            const noItems = !game.itemsUsed && !game.squaresRevealed, met = check(game, puzzle);
            stars = 1 + (noItems ? 1 : 0) + (met ? 1 : 0);
            earned.push(["Solved It", true], ["No Items Used", noItems], [goal, met]);
            if (lesson) earned.push([`Skill Practised: ${lesson.name}`, true]);
            if (riftLevel(puzzle)) { corruptPeak = Corruption.win(); earned.push([`Corruption Peak: ${corruptPeak}%`, corruptPeak < 50]); }
        }
        skipping = false;
        const key = keyOf(c.world, c.level), old = data.levels[key];
        const firstClear = !old;
        // coins: more for a first clear, and for bosses 
        const coins = (boss ? 25 : 7) * stars + (firstClear ? (boss ? 100 : 30) : 0);
        data.coins = (data.coins || 0) + coins;
        data.levels[key] = { stars: Math.max(stars, old ? old.stars : 0), seconds: Math.min(game.seconds, old && old.seconds ? old.seconds : Infinity) };
        // a new ability, the first time this level is cleared (level 1, level 3 and the boss each have one)
        const prize = abilityPrize(c.si, c.level), newAbility = firstClear && prize ? prize : null;
        if (newAbility) data.owned[prize.id] = (data.owned[prize.id] || 0) + FREE_USES;
        let next = null;
        // the Void beaten for the first time: the secret world opens (the map grows, the next world is the Rift)
        const opened = c.world === "space" && boss && firstClear && refreshMap();
        if (c.level < 5) next = { world: c.world, level: nextLevel(c.si, c.level) };
        else if (c.si + 1 < map.length) next = { world: map[c.si + 1].world, level: 1 };
        if (next && next.level === 1) { data.section = c.si + 1; data.sel = 1; }
        else if (next) { data.section = c.si; data.sel = next.level; }
        save();
        drawItemBar();
        // (the 15 worlds of the Everbook: the secret world has its own achievements)
        const main = map.filter(s => !s.secret), bossesBeaten = main.filter(s => data.levels[keyOf(s.world, 5)]).length;
        const stats = {
            levels: Object.keys(data.levels).filter(k => !k.startsWith("rift-")).length, bosses: bossesBeaten, allBosses: main.length, stars: Object.values(data.levels).reduce((n, r) => n + r.stars, 0),
            perfectWorld: map.some((s, si) => LV(si).every(l => (data.levels[keyOf(s.world, l)] || {}).stars === 3)),
            worldDone: map.some((s, si) => LV(si).every(l => data.levels[keyOf(s.world, l)])), allLevels: main.length * 5, totalCoins: data.coins,
            boss, difficulty: d, world: c.world, corruptPeak, secret: isSecret(c.si),
            riftPerfect: isSecret(c.si) && LV(c.si).every(l => (data.levels[keyOf(c.world, l)] || {}).stars === 3)
        };
        if (boss && fight) Object.assign(stats, { hits: fight.hits, blocks: fight.blocks, combo: fight.bestCombo, kinds: fight.kinds.size, used: fight.used + fight.itemsUsed,
            closest: Math.max(fight.closest, bossPct()), lifeUsed: fight.lifeUsed, phase2: fight.phase >= 2, phases: fight.phases,
            phaseReached: fight.phase, counters: fight.counters || 0, bossStars: stars });
        return {
            campaignStats: stats,
            campaign: { stars, best: data.levels[key].stars, earned, boss, firstClear, next, world: c.world, level: c.level, si: c.si, coins, totalCoins: data.coins,
                newWorld: boss && firstClear && next && !opened ? Worlds.byId[next.world] : null, finished: boss && c.world === "space", secret: opened ? Worlds.byId.rift : null,
                epilogue: boss && c.world === "rift", heroGifts: boss && firstClear && typeof Hero !== "undefined" && Hero.giftNames ? Hero.giftNames(c.world) : null, newAbility, freeUses: FREE_USES }
        };
    }
    // the Daily Boss beaten: stars and coins, nothing else (the first win each day pays the most)
    function specialWin(game, c) {
        const stars = bossStars(), close = fight ? Math.round(Math.max(fight.closest, bossPct()) * 100) : 0;
        const earned = [["Won the Race", true], [`Boss Kept Under ${Math.round(STAR_CLOSE[0] * 100)}%`, stars >= 2], [`Boss Kept Under ${Math.round(STAR_CLOSE[1] * 100)}%`, stars >= 3], [`Closest It Got: ${close}%`, true]];
        data.specials = data.specials || {};
        const dailyKey = "daily-" + (data.playing.date || dayStr()), firstToday = c.special === "daily" && !data.specials[dailyKey];
        if (c.special === "daily") data.specials[dailyKey] = Math.max(stars, data.specials[dailyKey] || 0);
        data.specials.wins = (data.specials.wins || 0) + 1;
        const priorTries = triesNow();                  // the attempts before this one (each costs points, see score.js)
        countAttempt(true);
        const coins = (firstToday ? 60 : 10) + stars * 5;
        data.coins = (data.coins || 0) + coins;
        if (firstToday) earned.push(["Today's Boss Beaten", true]);
        save();
        drawItemBar();
        // the boss achievements count here too (Untouchable, Turnabout, Flawless Race...), and Boss of the Day
        const campaignStats = { special: c.special, boss: true, world: c.world, totalCoins: data.coins, bossStars: stars, difficulty: game.puzzle && game.puzzle.difficulty };
        if (fight) Object.assign(campaignStats, { hits: fight.hits, blocks: fight.blocks, combo: fight.bestCombo, kinds: fight.kinds.size, used: fight.used + fight.itemsUsed,
            closest: Math.max(fight.closest, bossPct()), lifeUsed: fight.lifeUsed, phases: 1, phaseReached: 1, counters: fight.counters || 0 });
        return { campaignStats, campaign: { stars, best: stars, earned, boss: true, firstClear: false, next: null, world: c.world, level: 5, si: c.si, coins, totalCoins: data.coins, special: c.special, priorTries } };
    }
    function bestLine() {
        const c = current();
        if (!c) return "";
        const rec = data.levels[keyOf(c.world, c.level)];
        const lesson = lessonOf(c.si, c.level), what = lesson && c.level < 5 ? `📘 ${lesson.name}` : `${isSecret(c.si) ? "Secret World" : "World " + (c.si + 1)} · ${c.level === 5 ? "Boss" : "Level " + c.level}`;
        return rec ? `${what} · Best: ${"★".repeat(rec.stars)}${"☆".repeat(3 - rec.stars)}` : what;
    }
    function next(n) {
        if (!n) { location.hash = "#campaign"; return; }
        if (n.level === 1) { data.playing = { world: n.world, level: 1 }; save(); location.hash = "#campaign"; return; }   // a new world: see it on the map first
        play(n.world, n.level);
    }

    // ---------------------------------------------------------------------------------------------
    // Abilities (boss fights): 3 per world, each one different (no repeats, no stronger copies).
    // What they are, how they look and sound is in powers.js; what each one does is in useAbility below.
    // ---------------------------------------------------------------------------------------------
    const WORLD_ORDER = ["paper", "garden", "squirrel", "candy", "ocean", "snow", "rain", "sky", "desert", "carnival", "arcade", "library", "robot", "volcano", "space", "rift"];   // the map order (Campaign.java)
    const ABILITIES = Powers.ABILITIES.map(a => ({ ...a, price: 30 + WORLD_ORDER.indexOf(a.world) * 8 }));
    const abilityById = Object.fromEntries(ABILITIES.map(a => [a.id, a]));

    // Unlocking: a world's 1st ability unlocks when you clear its level 1, the 2nd at level 3,
    // the 3rd when you beat its boss. The Celestial Rift has four, one per level, all before the angel.
    // Each unlock comes with FREE_USES uses; more cost coins in the shop.
    const FREE_USES = 2;
    const unlockAt = world => (world === "rift" ? [1, 2, 3, 4] : [1, 3, 5]);
    const unlockLevel = a => unlockAt(a.world)[ABILITIES.filter(x => x.world === a.world).indexOf(a)];
    // the ability a level unlocks (or null): abilityPrize(0, 3) = Paper's 2nd ability
    function abilityPrize(si, level) {
        if (!map || !map[si]) return null;
        const i = unlockAt(map[si].world).indexOf(level);
        return i < 0 ? null : ABILITIES.filter(a => a.world === map[si].world)[i] || null;
    }
    function earnedAbility(a) {
        if (!map) return false;
        const si = map.findIndex(s => s.world === a.world);
        return si >= 0 && cleared(si, unlockLevel(a));
    }
    const unlockedAbility = a => !!data.betaUnlock || earnedAbility(a);     // (the beta's Unlock All opens them all)
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

    // Saves from the beta (5000 coins and 3 of every ability) start over with the unlock rules
    function migrate() {
        if (!(data.v >= 2)) {
            data.v = 2;
            data.coins = 50;
            data.owned = {};
            data.loadout = [];
            for (const a of ABILITIES.filter(earnedAbility)) data.owned[a.id] = FREE_USES;
        }
        save();
    }
    // Which abilities a boss fight brings, on keys 1-3:
    //   - campaign bosses: any 3 you've unlocked, from any world, picked on the boss's sheet or in the shop (data.loadout). Empty slots fill
    //     with this world's unlocked ones first, then the newest you've unlocked.
    //   - the Daily Boss: its own world's three, all unlocked, 3 uses each every attempt (fight.uses;
    //     the campaign's uses aren't touched)
    // (shopWorld: in a level, that level's world; on the map, the world in view)
    const shopWorld = () => (U.view() === "level" && data.playing ? data.playing.world : map && map[data.section || 0] ? map[data.section || 0].world : data.playing ? data.playing.world : "paper");
    const worldAbilities = world => ABILITIES.filter(a => a.world === world).map(a => a.id);
    const ownUses = () => !!(U.view() === "level" && special() && fight && fight.uses);      // a Daily Boss fight
    function loadout(world = shopWorld()) {
        if (U.view() === "level" && special()) return worldAbilities(data.playing.world);
        const list = [...new Set((data.loadout || []).filter(id => abilityById[id] && unlockedAbility(abilityById[id])))].slice(0, 3);
        for (const a of [...ABILITIES.filter(x => x.world === world && unlockedAbility(x)), ...unlockedAbilities().reverse()]) if (list.length < 3 && !list.includes(a.id)) list.push(a.id);
        return list;
    }
    function equip(list) { data.loadout = list.filter(Boolean).slice(0, 3); save(); }
    const readyAbilities = (world) => loadout(world).filter(id => abilityOpen(abilityById[id]));
    const DAILY_USES = 3, DAILY_TRY_COST = 50;   // 50 points per earlier attempt
    const abilityOpen = a => (ownUses() ? a.world === fight.world : unlockedAbility(a));
    const usesOf = id => (ownUses() ? fight.uses[id] || 0 : data.owned[id] || 0);
    function spendUse(id) { if (ownUses()) fight.uses[id] = Math.max(0, (fight.uses[id] || 0) - 1); else { data.owned[id] = Math.max(0, (data.owned[id] || 0) - 1); save(); } }
    // Attempts: every finished fight (a loss, giving up, Reveal puzzle, or a win) counts. The Daily Boss saves them
    // per day and each earlier one costs points when you win (see score.js; your best of the day is kept).
    const triesKey = () => "daily-" + ((data.playing && data.playing.date) || dayStr()) + "-tries";
    const dailyTries = () => ((data.specials || {})[triesKey()]) || 0;
    const triesNow = () => (special() === "daily" ? dailyTries() : 0);
    function countAttempt(won = false) {
        if (!fight || fight.attemptCounted || !special()) return;
        fight.attemptCounted = true;
        data.specials = data.specials || {};
        data.specials[triesKey()] = dailyTries() + 1;
        saveCarry(won);
        save();
    }
    // The words you got right carry over to your next attempt, filled in and locked. Only words you finished right yourself count
    // (fight.credited: Reveal Puzzle's letters never do), saved per day with the puzzle's seed. A win clears them,
    // so a rematch after a win starts empty.
    const carryKey = () => "daily-" + ((data.playing && data.playing.date) || dayStr()) + "-carry";
    function getCarry() {
        return special() === "daily" ? (data.specials || {})[carryKey()] || null : null;
    }
    function setCarry(v) {
        if (special() !== "daily") return;
        data.specials = data.specials || {};
        if (v) data.specials[carryKey()] = v; else delete data.specials[carryKey()];
    }
    function saveCarry(won) {
        const p = Game.state.puzzle;
        if (won || !p) { setCarry(null); return; }
        const pre = p.seed + ":", words = [...(fight.credited || [])].filter(id => id.startsWith(pre)).map(id => id.slice(pre.length));
        setCarry(words.length ? { seed: p.seed, words } : null);
    }
    // a fresh attempt: fill the carried words in (never the whole board: that would win before the race starts)
    function applyCarry() {
        const carry = getCarry(), p = Game.state.puzzle;
        if (!carry || !p || String(carry.seed) !== String(p.seed) || Game.state.solved) return 0;
        const all = [...p.across, ...p.down], id = e => e.direction + e.number;
        const keep = all.filter(e => carry.words.includes(id(e)));
        const open = new Set(all.flatMap(e => Game.cellsOf(e).map(([r, c]) => r + "," + c)));
        const cellsOf = list => [...new Map(list.flatMap(e => Game.cellsOf(e)).map(([r, c]) => [r + "," + c, [r, c]])).values()];
        while (keep.length && cellsOf(keep).length >= open.size) keep.pop();
        if (!keep.length) return 0;
        const cells = cellsOf(keep), filled = new Set(cells.map(([r, c]) => r + "," + c));
        // every word those letters finish counts as already done (no combo or block for words you didn't type now)
        fight.credited = new Set(all.filter(e => Game.cellsOf(e).every(([r, c]) => filled.has(r + "," + c))).map(e => p.seed + ":" + id(e)));
        Game.fillCells(cells);
        fight.headStart = myPct();          // a real head start: the boss doesn't rage or rush to catch up over it
        return keep.length;
    }

    // ---------------------------------------------------------------------------------------------
    // The Everbook: the campaign's book, open over the stage. Its bookmarks are everything that isn't a level:
    // Contents (the whole journey), Pages (the story you've won back), Shop, Skills, Hero and Help.
    // From inside a level it opens at the Shop, with only the Shop and Help.
    // ---------------------------------------------------------------------------------------------
    const BOOK_TABS = [["contents", "Contents", "list"], ["pages", "Pages", "ribbon"], ["shop", "Shop", "bag"], ["skills", "Skills", "bolt"], ["hero", "Hero", "hero"], ["help", "Help", "help"]];
    let book = null;                            // the open book: { layer, tab, shopTab, slot, page, focus }
    const bookOn = () => !!book;
    const onStage = () => U.view() === "campaign" && !!map && staged;
    function buy(price, give) {
        if (data.coins < price) return;
        data.coins -= price;
        data.bought = (data.bought || 0) + 1;
        data.spent = (data.spent || 0) + price;
        give(); save(); Sound.play("coin"); drawBook();
        Achievements.announce(Achievements.campaign({ bought: data.bought, spent: data.spent }));
    }
    const price = n => U.el("button", { type: "button", class: "eb-buy" }, icon("coin"), U.el("span", { text: String(n) }));
    const pips = i => U.el("span", { class: "eb-pips", "aria-hidden": "true" }, ...LV(i).map(l => U.el("i", { class: cleared(i, l) ? "on" : "" })));
    // leave the book for a place on the stage
    const bookGo = (si, level) => { closeBook(); if (U.view() !== "campaign") { data.section = si; data.sel = level || restStop(si); save(); location.hash = "#campaign"; } else setTimeout(() => go(si, level), 140); };
    // the three abilities a boss fight brings, as the book shows them (swap one, or buy another use)
    function kitList(world) {
        const eq = loadout(world);
        return U.el("ol", { class: "eb-kit" }, ...[0, 1, 2].map(i => {
            const a = abilityById[eq[i]];
            if (!a) return U.el("li", { class: "empty" }, U.el("small", { text: `Key ${i + 1}` }), U.el("b", { text: "Empty" }));
            const more = price(a.price);
            more.disabled = data.coins < a.price;
            more.title = `Buy one more use of ${a.name}`;
            more.prepend("+1 ");
            more.addEventListener("click", () => buy(a.price, () => { data.owned[a.id] = (data.owned[a.id] || 0) + 1; }));
            return U.el("li", { style: { "--c": a.fx.color } }, U.el("small", { text: `Key ${i + 1} · ${plural(data.owned[a.id] || 0, "Use")}` }), U.el("b", { text: `${a.icon} ${a.name}` }),
                U.el("button", { type: "button", class: "eb-btn", text: "Swap", onclick: () => { book.slot = i; book.tab = "pick"; turnBook(); } }), more);
        }));
    }
    const BOOK_VIEWS = {
        contents(left, right) {
            const t = totals(), f = frontier(), main = map.filter(s => !s.secret), pagesWon = main.filter(s => data.levels[keyOf(s.world, 5)]).length;
            const bar = U.el("span", { class: "eb-pagesbar", role: "img", "aria-label": `${pagesWon} of ${main.length} pages won back` }, ...main.map(s => U.el("i", { class: data.levels[keyOf(s.world, 5)] ? "on" : "" })));
            const allDone = t.levels >= t.max;
            left.append(U.el("h1", { class: "eb-book-title", text: "The Everbook" }),
                U.el("p", { class: "eb-prose", text: "Every word there is, in one book. The Void tore it into fifteen pages and gave one to each boss. Win them back." }),
                U.el("div", { class: "eb-owner" }, U.el("div", { class: "eb-owner-hero", html: Hero.svg(heroLook()) }),
                    U.el("div", {}, U.el("b", { text: heroLook().name }), U.el("p", { text: `${pagesWon} of ${main.length} Pages Won Back` }), bar)),
                U.el("button", { type: "button", class: "eb-ribbon", onclick: () => bookGo(f.si, f.level) }, icon("ribbon"),
                    U.el("span", {}, U.el("small", { text: allDone ? "Every Level Cleared" : t.levels ? "Continue" : "Begin" }), U.el("b", { text: `${Worlds.byId[map[f.si].world].name} ${f.level === 5 ? "Boss" : f.level}` }))),
                U.el("dl", { class: "eb-tally" },
                    U.el("div", {}, U.el("dt", { text: "Stars" }), U.el("dd", { text: `${t.stars} / ${t.max * 3}` })),
                    U.el("div", {}, U.el("dt", { text: "Levels" }), U.el("dd", { text: `${t.levels} / ${t.max}` })),
                    U.el("div", {}, U.el("dt", { text: "Abilities" }), U.el("dd", { text: `${unlockedAbilities().length} / ${ABILITIES.filter(a => a.world !== "rift" || secretOpen()).length}` })),
                    U.el("div", {}, U.el("dt", { text: "Skills Mastered" }), U.el("dd", { text: `${course().filter(k => k.mastered).length} / ${course().length}` }))));
            const list = U.el("ol", { class: "eb-toc" });
            map.forEach((s, i) => {
                const open = sectionOpen(i), w = Worlds.byId[s.world], full = worldStars(i) >= LV(i).length * 3;
                list.append(U.el("li", { "data-world": s.world, "data-theme": Worlds.modeFor(w), class: (open ? "" : "shut") + (i === data.section ? " here" : "") },
                    U.el("button", { type: "button", onclick: () => bookGo(i), "aria-label": `${w.name}, ${LV(i).filter(l => cleared(i, l)).length} of ${LV(i).length} cleared${open ? "" : ", locked"}` },
                        U.el("span", { class: "eb-toc-n", text: s.secret ? "?" : String(i + 1) }), U.el("span", { class: "eb-toc-name", text: w.name }),
                        U.el("span", { class: "eb-toc-dots", "aria-hidden": "true" }), !open ? icon("lock") : full ? icon("check") : pips(i))));
            });
            right.append(U.el("h2", { class: "eb-h", text: "Contents" }), list);
            if (foundSecrets().length) right.append(U.el("h2", { class: "eb-h gap", text: "Secret Places" }), U.el("ul", { class: "eb-list" }, ...foundSecrets().map(sec =>
                U.el("li", { style: { "--c": sec.color } }, icon("lock"), U.el("div", {}, U.el("b", { text: sec.name }), U.el("p", { text: `Off ${Worlds.byId[sec.parent].name}. ${sec.boss} is waiting.` })),
                    U.el("button", { type: "button", class: "eb-btn", text: "Go", onclick: () => bookGo(map.findIndex(m => m.world === sec.parent)) })))));
        },
        // the story: one page per world, readable once its boss has given it back
        pages(left, right) {
            const pages = storyPages(), wonN = pages.filter(p => p.won).length;
            if (book.page == null || !pages[book.page]) book.page = Math.max(0, pages.map(p => p.won).lastIndexOf(true));
            left.append(U.el("h1", { class: "eb-book-title small", text: "The Pages" }),
                U.el("p", { class: "eb-prose", text: wonN ? `${wonN} of ${pages.length} are back in the book.` : "None are back yet. Beat a world's boss to win its page." }));
            const list = U.el("ol", { class: "eb-leaves" });
            pages.forEach((p, i) => list.append(U.el("li", {}, U.el("button", { type: "button", class: "eb-leaf" + (p.won ? " won" : "") + (i === book.page ? " on" : ""), style: { "--c": p.color },
                "aria-pressed": i === book.page ? "true" : "false", "aria-label": `Page ${i + 1}, ${p.name}: ${p.won ? "won back" : "held by " + p.boss}`,
                onclick: () => { book.page = i; Sound.play("flip"); drawBook(); } }, U.el("b", { text: String(i + 1) }), p.won ? null : icon("lock")))));
            left.append(list, U.el("button", { type: "button", class: "eb-quiet", onclick: () => { closeBook(); setTimeout(() => FX.cinematic(c => Story.intro(c, storyPages())), 200); } }, icon("replay"), U.el("span", { text: "Watch the Story Again" })));
            const p = pages[book.page], b = bossOf(p.world), w = Worlds.byId[p.world], si = map.findIndex(s => s.world === p.world);
            right.dataset.world = p.world;
            right.dataset.theme = Worlds.modeFor(w);
            right.append(U.el("h2", { class: "eb-h", text: `Page ${book.page + 1}` }), U.el("h3", { class: "eb-leaf-title", text: p.name }));
            if (p.won) {
                right.append(U.el("div", { class: "eb-plate eb-leaf-plate" }, U.el("div", { class: "dk-vs", html: bossSvg(p.world) })),
                    U.el("p", { class: "eb-prose", text: b.story || "" }),
                    U.el("p", { class: "eb-small" }, icon("check"), U.el("span", { text: `Won back from ${b.name}.` })));
                const c = w.mascot && typeof Companions !== "undefined" && Companions.has(p.world) ? Companions.loreLeft(p.world) : 0;
                if (w.mascot) right.append(U.el("figure", { class: "dk-note" }, portrait(p.world), U.el("figcaption", {}, U.el("b", { text: w.mascot.name }),
                    U.el("q", { text: c ? `I have ${c === 1 ? "one more story" : c + " more stories"} to tell you. Come and find me in ${p.name}.` : "You know all my stories now." }))));
            } else {
                right.append(U.el("p", { class: "eb-prose", text: `This page is missing. ${b.name} holds it in ${p.name}.` }),
                    b.stakes ? U.el("p", { class: "eb-small" }, icon("spark"), U.el("span", { text: b.stakes })) : null);
            }
            if (si >= 0) right.append(U.el("button", { type: "button", class: "eb-quiet", onclick: () => bookGo(si, p.won ? undefined : 5) }, icon("next"), U.el("span", { text: `Go to ${p.name}` })));
        },
        shop(left, right) {
            const tab = book.shopTab || "items";
            left.append(U.el("h1", { class: "eb-book-title small", text: "The Shop" }),
                U.el("p", { class: "eb-purse" }, icon("coin"), U.el("b", { text: String(data.coins) }), U.el("span", { text: data.coins === 1 ? "Coin" : "Coins" })),
                U.el("p", { class: "eb-prose", text: "Coins come from stars and first clears. Items work in any level. A boss fight takes abilities instead." }));
            if (!special()) left.append(U.el("h2", { class: "eb-h gap", text: "Your Abilities" }), kitList());
            right.append(U.el("div", { class: "eb-switch", role: "group", "aria-label": "What to show" }, ...[["items", "Items"], ["abilities", "Abilities"]].map(([id, text]) =>
                U.el("button", { type: "button", "aria-pressed": tab === id ? "true" : "false", text, onclick: () => { book.shopTab = id; Sound.play("select"); drawBook(); } }))));
            if (tab === "items") {
                right.append(U.el("ul", { class: "eb-list" }, ...ITEMS.map(it => {
                    const b = price(it.price);
                    b.disabled = data.coins < it.price;
                    b.setAttribute("aria-label", `Buy ${it.name} for ${it.price} coins`);
                    b.addEventListener("click", () => buy(it.price, () => { data.items[it.id] = (data.items[it.id] || 0) + 1; }));
                    return U.el("li", {}, U.el("span", { class: "eb-icon", text: it.icon, "aria-hidden": "true" }),
                        U.el("div", {}, U.el("b", { text: it.name }), U.el("p", { text: it.desc }), U.el("small", { text: `You Have ${data.items[it.id] || 0}` })), b);
                })));
                return;
            }
            const eq = loadout();
            for (const world of WORLD_ORDER) {
                const w = Worlds.byId[world];
                if (!w || (world === "rift" && !secretOpen())) continue;        // the secret world stays a secret
                right.append(U.el("h3", { class: "eb-world", "data-world": world, "data-theme": Worlds.modeFor(w) }, U.el("span", { text: w.name }), U.el("small", { text: bossOf(world).name })));
                right.append(U.el("ul", { class: "eb-list" }, ...ABILITIES.filter(a => a.world === world).map(a => {
                    const on = eq.includes(a.id), open = unlockedAbility(a);
                    const acts = U.el("div", { class: "eb-acts" });
                    if (open) {
                        const b = price(a.price);
                        b.disabled = data.coins < a.price;
                        b.setAttribute("aria-label", `Buy a use of ${a.name} for ${a.price} coins`);
                        b.addEventListener("click", () => buy(a.price, () => { data.owned[a.id] = (data.owned[a.id] || 0) + 1; }));
                        acts.append(U.el("button", { type: "button", class: "eb-btn" + (on ? " on" : ""), text: on ? "Equipped" : "Equip", "aria-pressed": on ? "true" : "false", onclick: () => {
                            let l = loadout().filter(id => id !== a.id);           // equipping a 4th drops the one on key 1
                            if (!on) { l.push(a.id); if (l.length > 3) l = l.slice(-3); }
                            equip(l); Sound.play("select"); drawBook(); } }), b);
                    }
                    return U.el("li", { class: (open ? "" : "locked") + (on ? " on" : ""), style: { "--c": a.fx.color } }, U.el("span", { class: "eb-icon", text: open ? a.icon : "", "aria-hidden": "true" }, open ? null : icon("lock")),
                        U.el("div", {}, U.el("b", { text: a.name }), U.el("p", { text: a.desc }), U.el("small", { text: open ? plural(data.owned[a.id] || 0, "Use") : unlockText(a) })), acts);
                })));
            }
        },
        // choosing the ability for one key (from Swap, or a slot on a boss's page)
        pick(left, right) {
            const slot = book.slot || 0, eq = loadout(book.world), now = abilityById[eq[slot]];
            left.append(U.el("h1", { class: "eb-book-title small", text: `Key ${slot + 1}` }),
                U.el("p", { class: "eb-prose", text: "Any ability you've unlocked works in any campaign boss fight." }),
                now ? U.el("ul", { class: "eb-list" }, U.el("li", { class: "on", style: { "--c": now.fx.color } }, U.el("span", { class: "eb-icon", text: now.icon, "aria-hidden": "true" }),
                    U.el("div", {}, U.el("b", { text: now.name }), U.el("p", { text: now.desc }), U.el("small", { text: "On This Key Now" })))) : null,
                U.el("button", { type: "button", class: "eb-quiet", onclick: () => pickDone() }, icon("back"), U.el("span", { text: "Back" })));
            right.append(U.el("h2", { class: "eb-h", text: "Choose an Ability" }));
            let any = false;
            for (const world of WORLD_ORDER) {
                const list = ABILITIES.filter(a => a.world === world && unlockedAbility(a)), w = Worlds.byId[world];
                if (!list.length || !w) continue;
                any = true;
                right.append(U.el("h3", { class: "eb-world", "data-world": world, "data-theme": Worlds.modeFor(w) }, U.el("span", { text: w.name })));
                right.append(U.el("ul", { class: "eb-list" }, ...list.map(a => {
                    const at = eq.indexOf(a.id);
                    return U.el("li", { class: at === slot ? "on" : "", style: { "--c": a.fx.color } }, U.el("span", { class: "eb-icon", text: a.icon, "aria-hidden": "true" }),
                        U.el("div", {}, U.el("b", { text: a.name }), U.el("p", { text: a.desc }), U.el("small", { text: plural(data.owned[a.id] || 0, "Use") + (at >= 0 ? ` · On Key ${at + 1}` : "") })),
                        U.el("button", { type: "button", class: "eb-btn" + (at === slot ? " on" : ""), text: at === slot ? "Chosen" : "Choose", onclick: () => {
                            const l = eq.slice(0, 3);
                            while (l.length < 3) l.push(null);
                            const was = l.indexOf(a.id);
                            if (was >= 0) l[was] = l[slot];                 // already on another key: the two swap
                            l[slot] = a.id;
                            equip(l); Sound.play("select"); drawAbilityBar(); pickDone();
                        } }));
                })));
            }
            if (!any) right.append(U.el("p", { class: "eb-prose", text: "No abilities yet. Clear a world's Level 1 to unlock its first one." }));
        },
        // the course: every skill, where it's taught, and how well you've done (3 stars everywhere = mastered)
        skills(left, right) {
            const list = course(), mastered = list.filter(k => k.mastered).length;
            left.append(U.el("h1", { class: "eb-book-title small", text: "Skills" }),
                U.el("p", { class: "eb-prose", text: "Every level practises one crossword skill, and the skills come back harder further on. Three stars on every level of a skill masters it." }),
                U.el("p", { class: "eb-purse" }, icon("check"), U.el("b", { text: `${mastered} / ${list.length}` }), U.el("span", { text: "Mastered" })),
                U.el("div", { class: "eb-meter", role: "img", "aria-label": `${mastered} of ${list.length} skills mastered` }, ...list.map(k => U.el("i", { class: k.mastered ? "on" : k.stars.some(n => n > 0) ? "some" : "" }))));
            right.append(U.el("h2", { class: "eb-h", text: "The Course" }));
            for (const k of list) {
                right.append(U.el("section", { class: "eb-skill" + (k.mastered ? " mastered" : "") },
                    U.el("header", {}, U.el("b", { text: k.lesson.name.replace(/ I+$/, "") }), U.el("small", { text: k.mastered ? "Mastered" : `${k.stars.filter(n => n === 3).length} of ${k.levels.length} Perfect` })),
                    U.el("p", { text: k.lesson.practise }),
                    U.el("div", { class: "eb-chips" }, ...k.levels.map((x, n) => U.el("button", { type: "button", class: "eb-chip", "aria-label": `${Worlds.byId[x.world].name} ${x.level}, ${k.stars[n]} of 3 stars`,
                        onclick: () => bookGo(x.si, x.level) }, U.el("span", { text: `${Worlds.byId[x.world].name} ${x.level}` }), ...[0, 1, 2].map(i => icon("star", i < k.stars[n] ? "on" : "off"))))) ));
            }
        },
        hero(left, right) {
            const look = heroLook();
            left.classList.add("eb-center");
            left.append(U.el("div", { class: "eb-hero-big", html: Hero.svg(look) }), U.el("h1", { class: "eb-book-title small", text: look.name }),
                U.el("button", { type: "button", class: "eb-quiet", onclick: () => { closeBook(); setTimeout(async () => { await editHero(false); }, 160); } }, icon("hero"), U.el("span", { text: "Change Your Hero" })));
            const worlds = (full || map).filter(s => !s.secret || secretOpen()).map(s => s.world).filter(w => Hero.giftNames(w));
            right.append(U.el("h2", { class: "eb-h", text: "Gifts" }), U.el("p", { class: "eb-prose", text: "Every boss you beat gives your hero a hat, an outfit and something to hold." }),
                U.el("ul", { class: "eb-list eb-gifts" }, ...worlds.map(w => {
                    const got = beatenBosses().includes(w);
                    return U.el("li", { class: got ? "" : "locked" }, got ? icon("check") : icon("lock"), U.el("div", {}, U.el("b", { text: bossOf(w).name }), U.el("p", { text: got ? Hero.giftNames(w).join(", ") : "Three parts to win" })));
                })));
        },
        help(left, right) {
            left.append(U.el("h1", { class: "eb-book-title small", text: "How to Play" }),
                U.el("p", { class: "eb-prose", text: "Each level practises one crossword skill and earns up to three stars. The fifth is the world's boss: a race to finish your puzzle before it finishes its own." }),
                U.el("p", { class: "eb-prose", text: "Pick a stop on the road to open its page, then press Play. Pick it again to start straight away." }));
            const row = (name, sub, fn) => U.el("li", {}, U.el("button", { type: "button", onclick: fn }, U.el("span", {}, name, U.el("small", { text: sub })), icon("next")));
            right.append(U.el("h2", { class: "eb-h", text: "Guides" }), U.el("ul", { class: "eb-chapters" },
                row("Levels, Stars and Items", "Ten short animated chapters", () => { closeBook(); HowTo.open("normal"); }),
                row("Boss Fights", "The race, attacks, counters and abilities", () => { closeBook(); HowTo.open("boss"); })));
            if (onStage()) right.append(U.el("h2", { class: "eb-h gap", text: "Keys" }), U.el("dl", { class: "eb-keys" },
                ...[["← →", "Change World"], ["1 – 5", "Pick a Stop"], ["Enter", "Play"], ["B", "Open the Everbook"], ["Esc", "Close"]].map(([k, v]) => U.el("div", {}, U.el("dt", { text: k }), U.el("dd", { text: v })))));
        }
    };
    // every skill in the course: its lesson, the levels that teach it, your stars on each
    function course() {
        const skills = new Map();
        map.forEach((s, si) => (s.lessons || []).forEach((lesson, i) => {
            if (!lesson || lesson.id === "review") return;
            if (!skills.has(lesson.id)) skills.set(lesson.id, { lesson, levels: [] });
            skills.get(lesson.id).levels.push({ si, level: i + 1, world: s.world });
        }));
        return [...skills.values()].map(k => { const stars = k.levels.map(x => (record(x.si, x.level) || {}).stars || 0); return { ...k, stars, mastered: stars.every(n => n === 3) }; });
    }
    const bookTabs = () => (onStage() ? BOOK_TABS : BOOK_TABS.filter(([id]) => id === "shop" || id === "help"));
    function drawBook() {
        if (!book) return;
        const left = book.layer.querySelector(".eb-left"), right = book.layer.querySelector(".eb-right");
        const keep = right.dataset.tab === book.tab ? right.scrollTop : 0;
        for (const p of [left, right]) { p.replaceChildren(); p.className = "eb-page " + (p === left ? "eb-left" : "eb-right"); delete p.dataset.world; delete p.dataset.theme; }
        right.dataset.tab = book.tab;
        BOOK_VIEWS[book.tab](left, right);
        right.scrollTop = keep;
        const on = book.tab === "pick" ? "shop" : book.tab;
        book.layer.querySelector(".eb-tabs").replaceChildren(...bookTabs().map(([id, name, ic]) => U.el("button", { type: "button", class: "eb-tab" + (on === id ? " on" : ""), "aria-current": on === id ? "page" : "false",
            onclick: () => { if (book.tab === id) return; book.tab = id; book.direct = false; turnBook(); } }, icon(ic), U.el("span", { text: name }))));
        if (U.view() === "campaign" && map && staged) drawBar();
    }
    // turn to another section: the pages tip over the spine and settle
    function turnBook() {
        const el = book.layer.querySelector(".eb-book");
        Sound.play("flip");
        if (U.motion() === "still") { drawBook(); return; }
        el.classList.add("turning");
        setTimeout(() => { if (!book) return; drawBook(); el.classList.remove("turning"); U.restart(el, "turned"); }, 230);
    }
    // an ability was chosen (or Back): to the shop, or straight back to the boss's page it was opened from
    function pickDone() {
        if (book.direct) { closeBook(); return; }
        book.tab = "shop"; book.shopTab = "abilities";
        turnBook();
    }
    function openBook(tab = "contents", opts = {}) {
        if (book || !map) return;
        if (!bookTabs().some(([id]) => id === tab) && tab !== "pick") tab = "shop";
        const layer = U.el("div", { class: "results in cm-book-layer", role: "dialog", "aria-modal": "true", "aria-label": "The Everbook" },
            U.el("div", { class: "eb-book" },
                U.el("nav", { class: "eb-tabs", "aria-label": "The book's sections" }),
                U.el("button", { type: "button", class: "dk-book-close", onclick: () => closeBook() }, icon("close"), U.el("span", { text: "Close" })),
                U.el("section", { class: "eb-page eb-left" }), U.el("div", { class: "eb-spine", "aria-hidden": "true" }), U.el("section", { class: "eb-page eb-right" })));
        book = { layer, tab, focus: document.activeElement, ...opts };
        layer.addEventListener("pointerdown", e => { if (e.target === layer) closeBook(); });
        layer.addEventListener("keydown", e => {
            if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); if (book.tab === "pick" && !book.direct) pickDone(); else closeBook(); return; }
            if (e.key !== "Tab") return;                               // Tab stays inside the book
            const list = [...layer.querySelectorAll("button:not(:disabled), [href]")].filter(n => n.offsetParent), first = list[0], last = list[list.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        });
        drawBook();
        document.getElementById("overlay").appendChild(layer);
        root.classList.add("cm-book-on");
        Mascot.hush();
        Sound.play("flip");
        layer.querySelector(".dk-book-close").focus({ preventScroll: true });
    }
    function closeBook(quiet = false) {
        if (!book) return;
        const { layer, focus } = book;
        book = null;
        layer.remove();
        root.classList.remove("cm-book-on");
        if (onStage()) { drawBar(); drawPage(); drawStrip(); }
        drawAbilityBar(); drawItemBar();
        if (!quiet && focus && focus.isConnected && focus.focus) focus.focus({ preventScroll: true });
    }
    // (the item bar's shop button, and anything else that asks for the shop)
    const openShop = (tab = "items") => openBook("shop", { shopTab: tab });

    // ---- a boss's page: your 3 abilities, click a slot to pick what goes in it ----
    function loadoutBox(world, redraw) {
        const eq = loadout(world);
        const box = U.el("div", { class: "cm-loadout" }, U.el("small", { text: "Your Abilities · Keys 1-3" }));
        const row = U.el("div", { class: "lo-row" });
        for (let i = 0; i < 3; i++) {
            const a = abilityById[eq[i]];
            row.appendChild(U.el("button", { type: "button", class: "lo-slot" + (a ? "" : " empty"), style: a ? { "--c": a.fx.color } : {}, title: a ? `${a.name}: ${a.desc}` : "Pick an ability",
                onclick: () => openBook("pick", { slot: i, world, direct: true }) },
                U.el("span", { class: "lo-icon", text: a ? a.icon : "+" }), U.el("b", { text: a ? a.name : "Empty" }),
                U.el("small", { text: a ? `×${data.owned[a.id] || 0} · Key ${i + 1}` : `Key ${i + 1}` })));
        }
        box.appendChild(row);
        return box;
    }

    // ---- the item bar under the board, in campaign levels ----
    const itemBar = U.el("div", { class: "cm-items", "aria-label": "Items" });
    document.getElementById("helpers").before(itemBar);
    function drawItemBar() {
        itemBar.hidden = U.view() !== "level";
        if (itemBar.hidden) return;
        itemBar.innerHTML = "";
        const noItems = !!special();                           // the Daily Boss: no items, just Give Up
        itemBar.classList.toggle("only-giveup", noItems);
        // every item on one row, then the shop
        // and Give Up under it
        const row = U.el("div", { class: "cm-item-row" });
        if (!noItems) { row.appendChild(U.el("span", { class: "helper-label", text: "Items" })); itemBar.appendChild(row); }
        const boss = data.playing && data.playing.level === 5;
        for (const it of noItems ? [] : ITEMS) {
            const n = data.items[it.id] || 0;
            if (it.id === "skip" && boss) continue;
            const b = U.el("button", { type: "button", class: "cm-item", disabled: n <= 0, title: `${it.name}: ${it.desc}` },
                U.el("span", { class: "cm-item-icon", text: it.icon }), U.el("b", { text: "×" + n }));
            b.addEventListener("click", () => { b.blur(); useItem(it.id); });
            row.appendChild(b);
        }
        if (!noItems) itemBar.appendChild(U.el("button", { type: "button", class: "cm-item shop", title: "Open the shop", text: "🛒", onclick: () => openShop("items") }));
        itemBar.appendChild(U.el("button", { type: "button", class: "cm-item giveup", title: "Give up this level", text: "Give Up", onclick: e => { e.currentTarget.blur(); giveUp(); } }));
    }
    // Give up: ends the level without revealing the answers.
    // Nothing is saved, so you can try it again straight away.
    async function giveUp() {
        const g = Game.state;
        if (U.view() !== "level" || !g.puzzle || g.solved || !data.playing) return;
        const boss = data.playing.level === 5;
        const ok = await U.ask({ title: boss ? "Give Up This Fight?" : "Give Up This Level?", text: boss ? "The boss wins this round. You can ask for a rematch right away." : "The level won't be cleared. You can try it again right away.", yes: "Give Up", no: "Keep Playing" });
        if (!ok || g.solved) return;
        if (boss && fight && !fight.over) { lose("surrender"); return; }
        const { world, level } = data.playing;
        Game.endLoss({ title: "Gave Up", text: "Level not cleared. Try it again whenever you like." });
        Corruption.stop();
        levelMusic();
        Sound.play("wrong");
        loseCard({ world, level, kicker: `${Worlds.byId[world].name.toUpperCase()} ${level} · GAVE UP`, title: "Maybe Next Time", note: "Items like Letter Reveal and Clear Wrong (in the shop) can help with a tough one." });
    }
    // The Celestial Rift's levels (corruption.js): the angel watches and the corruption meter runs while you solve
    const riftLevel = puzzle => !!(puzzle && puzzle.mode === "campaign" && data.playing && !data.playing.special && data.playing.world === "rift" && data.playing.level < 5);
    function riftSync(puzzle) {
        if (riftLevel(puzzle) && U.view() === "level" && !Game.state.solved && map) {
            const c = current();
            Corruption.start({ key: keyOf(c.world, c.level), seed: puzzle.seed, level: Math.max(1, LV(c.si).indexOf(c.level) + 1), par: par(puzzle.difficulty, puzzle.size),
                entries: puzzle.across.length + puzzle.down.length, onLose: corruptLose });
        } else Corruption.stop();
    }
    Bus.on("puzzle", ({ puzzle }) => riftSync(puzzle));
    Bus.on("resume", ({ puzzle }) => riftSync(puzzle));
    // the meter filled: the level is lost (the next try is a new puzzle from its pool)
    function corruptLose() {
        const g = Game.state;
        if (U.view() !== "level" || !g.puzzle || g.solved || !data.playing) return;
        const { world, level } = data.playing;
        Game.endLoss({ title: "Corrupted", text: "The rift took over. Try again with a new puzzle." });
        Corruption.stop();
        levelMusic();
        Sound.play("wrong");
        FX.flash("#7a3cff", 500, 0.35);
        loseCard({ world, level, kicker: `${Worlds.byId[world].name.toUpperCase()} ${level} · CORRUPTED`, title: "The Rift Took Over",
            note: "Finish words to push the corruption back, and fight off the angel's tricks: catch the feather, click away the whisper, break the seal and the chains, and click its eye when it glares.", art: bossSvg(world) });
    }
    // the "you lost" card with Retry / Shop / Map
    function loseCard({ world, level, kicker, title, note, art }) {
        const modal = U.el("div", { class: "results", role: "dialog", "aria-modal": "true" });
        const card = U.el("div", { class: "res-card lose-card", style: { "--boss": level === 5 ? bossOf(world).color : biome(world).node } },
            art ? U.el("div", { class: "lose-art", html: art }) : null,
            U.el("small", { class: "res-kicker", text: kicker }),
            U.el("h2", { class: "res-title", text: title }),
            U.el("p", { class: "res-note", text: note }),
            U.el("div", { class: "res-actions" },
                special() ? U.el("button", { type: "button", class: "btn primary", text: "Rematch", onclick: () => { modal.remove(); playSpecial(special(), { rematch: true }); } })
                    : U.el("button", { type: "button", class: "btn primary", text: level === 5 ? "Rematch" : "Try Again", onclick: () => { modal.remove(); play(world, level); } }),
                special() ? null : U.el("button", { type: "button", class: "btn", text: "Shop", onclick: () => openShop(level === 5 ? "abilities" : "items") }),
                U.el("button", { type: "button", class: special() ? "btn" : "btn ghost", text: special() ? "Return" : "Map", onclick: () => { modal.remove(); if (special()) backToMode(); else location.hash = "#campaign"; } })));
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
        if (!n) { FX.toast({ icon: it.icon, kicker: "NOTHING TO DO", title: it.name, text: id === "clear" ? "No wrong letters on the board." : id === "lock" ? "No unlocked right letters yet." : id === "word" ? "That word is already right." : "That square is already right.", ms: 2200 }); return; }
        data.items[id]--;
        Game.state.itemsUsed = (Game.state.itemsUsed || 0) + 1;
        if (fight && !fight.over) fight.itemsUsed++;
        save();
        Sound.play("sparkle");
        FX.toast({ icon: it.icon, kicker: "ITEM USED", title: it.name, text, ms: 2000 });
        drawItemBar();
    }

    // ---------------------------------------------------------------------------------------------
    // Boss fights: a pure RACE against a bot that solves its own puzzle next to
    // yours. No HP and no clock: whoever finishes their board first wins the phase. Win the last phase to win.
    //   - the race bar at the top shows who's ahead: it pushes right when you lead, left when the boss does
    //   - you and the boss use abilities on each other to slow each other down
    //   - words finished close together build a COMBO
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
    // boss solves 15% faster than it used to
    const BOSS_SPEEDUP = 0.77;
    // (the boss's pace is set from the par times levels had before they got 15% longer: bosses didn't change)
    const BOSS_PAR = { easy: 120, medium: 180, hard: 240, challenge: 220, expert: 270 };
    const bossPar = (d, size) => Math.round((BOSS_PAR[d] || 180) * Math.max(1, (size * size) / 25) / 10) * 10;
    const botTimeFor = (d, size, si, phase = 1) => bossPar(d, size) * (BOT_PACE[d] || 1) * (1.15 - 0.43 * Math.max(0, si) / 14) * Math.pow(0.94, phase - 1) * BOSS_SPEEDUP;
    // the boss pushes harder when it's behind: up to +45% speed when you lead by 35% of the board
    const CATCH_UP = lead => 1 + Math.min(0.45, Math.max(0, lead - 0.08) * 1.6);
    // the boss gets ENRAGED when you've done 2.5 times as much of your board as it has of its own (once you've done at
    // least 15%, so the first few letters don't set it off)
    const RAGE_RATIO = 2.5, RAGE_FLOOR = 0.15;
    const RAGE_COOLDOWN = 0.65;                    // an enraged boss's attack cooldown: 35% shorter
    // the time between attacks in each phase, against phase 1 (the Void's 5th phase: about 8 s, 5.5 s enraged)
    const PHASE_PACE = [1, 1, 0.86, 0.74, 0.64, 0.56];
    // timers on the boss (seconds left), and what the status line calls them
    const BOSS_TIMERS = { freeze: "❄️ Frozen", slow: "🍬 Sticky", blind: "🥧 Can't see", stutter: "🤧 Sneezing", hypno: "🤹 Hypnotized", crash: "🍡 Sugar crash",
        bubble: "🫧 Bubbled", dig: "🍂 Digging", quick: "⏳ Sinking", sand: "🏜️ Sandstorm", lava: "🌋 Lava floor", reverse: "⏪ Reversed", worm: "🌀 Wormhole", ghost: "🖊️ Ghost writer",
        haste: "🛩️ Hasted", snowed: "🌨️ Snowed in" };
    // timers on your side (good ones)
    const MY_BUFFS = { blizzard: "🌨️ Blizzard: keep typing right", sun: "🌱 Words grow letters", tailwind: "🪁 Letters held", lucky: "🌈 Combo locked", fireup: "🔥 Wrong letters burn", hot: "🔥 Words stun", overclock: "⚡ Overclock",
        armor: "🧊 Frost armor", firewall: "🧱 Firewall", silver: "☁️ Silver lining", calm: "🤫 Boss calmed", chorus: "🎶 Angel chorus" };
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
        vowels: "🕳️ No vowels", wings: "🌑 Wings closing", holylight: "💫 Blinding light", scripture: "📜 Clues stolen", tithe: "🪙 Tithe of light",
        decree: "⚜️ A letter forbidden", ascend: "🕊️ Letters rising", penance: "⛓️ Penance" };

    let fight = null, lastKeyAt = 0;
    const panel = U.el("aside", { class: "boss-panel", hidden: true, "aria-label": "The boss" });
    document.getElementById("puzzle").appendChild(panel);
    // The race bar: at the top, the level's friend on the left and the boss on the right. The
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
        const text = Math.abs(k) < 3 ? "Neck and Neck" : k > 0 ? `You're Ahead by ${k}%` : `${bossOf(f.world).name} Is Ahead by ${-k}%`;
        const leadEl = raceEl.querySelector(".rb-lead");
        if (leadEl.textContent !== text) { leadEl.textContent = text; raceEl.setAttribute("aria-label", `Race: you ${Math.round(me * 100)}%, the boss ${Math.round(boss * 100)}%. ${text}`); }
        raceEl.classList.toggle("ahead", k >= 3);
        raceEl.classList.toggle("behind", k <= -3);
        raceEl.classList.toggle("danger", !!f.close);
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
        FX.toast({ icon: "🥵", kicker: "HEATWAVE", title: "Too Hot to Touch", text: `Check and Reveal cool down in ${Math.ceil(fight.me.heatwave)}s.`, ms: 1800 });
        Sound.play("wrong");
    }, true);
    const meStatus = U.el("div", { class: "me-status", "aria-live": "polite" });
    document.querySelector(".hud-row").after(meStatus);
    const warnEl = U.el("div", { class: "me-warn", hidden: true, "aria-live": "polite" });
    // a notice ("It Hit You", "Enraged"...) closes when clicked or tapped; an incoming attack's warning doesn't
    warnEl.addEventListener("pointerdown", e => {
        if (!warnEl.classList.contains("can-close") || !fight || fight.pending) return;
        e.stopPropagation();
        note = null;
        drawWarn();
    });
    raceEl.querySelector(".rb-track").appendChild(warnEl);           // right under the race bar's "who's ahead" label
    document.body.appendChild(U.el("div", { class: "close-edge", "aria-hidden": "true" }));   // red edges when the boss is almost done (.boss-close)
    const flareEl = U.el("div", { class: "fx-flare-screen", "aria-hidden": "true" });
    document.body.appendChild(flareEl);
    const isBossLevel = puzzle => !!(puzzle && puzzle.mode === "campaign" && data.playing && data.playing.level === 5);
    const fightOn = () => !!(fight && !fight.over && U.view() === "level" && isBossLevel(Game.state.puzzle) && !Game.state.solved);
    const boardArea = () => document.querySelector(".board-area");
    const portraitEl = () => panel.querySelector(".bp-portrait");
    const bossBoardEl = () => panel.querySelector(".bp-board-wrap");

    async function startFight(fresh) {
        const key = data.playing.special ? "sp-" + data.playing.sid : keyOf(data.playing.world, data.playing.level);
        if (!fresh && fight && fight.key === key) { resumeFight(); return; }
        await fetchMap().catch(() => null);
        const c = current(), d = c && c.difficulty ? c.difficulty : "medium";
        const th = Powers.threat(c ? c.si : 0, MAIN);
        const botTime = botTimeFor(d, c ? c.size : 5, c ? c.si : 0);
        panel.classList.remove("ko");                    // the last boss you beat stays down; this one starts fresh
        fight = { key, id: Date.now(), world: data.playing.world, th, puzzle: null, letters: null, queue: [], word: null, acc: 0,
            botTime, si: c ? c.si : 0, closest: 0, lead: 0, drips: [], done: [], boss: {}, me: {}, buff: {}, nextMove: th.first, moveIdx: 0, over: false, rate: 1, used: 0,
            combo: 0, bestCombo: 0, lastWordAt: -1e9, pending: null, windup: 0, windupMax: 1, enraged: false, intro: false, phase: 1, phases: special() ? 1 : 1 + laterPhases(c && map ? map[c.si] : null).length, next: {}, switching: false,
            log: [], myLog: [], hits: 0, blocks: 0, itemsUsed: 0, kinds: new Set(), extraLife: false, lifeUsed: false, thorns: null, snow: null,
            uses: special() ? Object.fromEntries(ABILITIES.filter(a => a.world === data.playing.world).map(a => [a.id, DAILY_USES])) : null };
        const kept = special() && fresh !== false ? applyCarry() : 0;
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
                if (kept && fight && fight.key === key) notice("🔒", kept === 1 ? "1 Word Kept" : `${kept} Words Kept`, "Your right words from last time are filled in and locked.", "good", 4200);
            }
            else if (fight && fightOn()) Sound.music(fight.phase > 1 ? `${fight.world}-p${fight.phase}` : fight.world, { v: 0.4, fade: 1.2, fromLoop: true });
            if (fight && fight.key === key && special()) setChaos(1);     // the Daily Boss's arena goes wild too
        } catch (err) {
            waiting(false, "Couldn't load the boss's puzzle: " + err.message);
            const l = panel.querySelector(".bp-loading");
            if (l) l.textContent = "Couldn't load the boss's puzzle: " + err.message;
        }
    }
    // Back to a fight that's still going (you left for another screen and came back): leaving took down the panel, the
    // arena's chaos, the rage and the music, so put them all back
    function resumeFight() {
        const f = fight;
        if (!f) return;
        drawPanel(true);                                         // the panel, its board and your abilities
        if (!f.puzzle && !f.over) waiting(true);                 // its board is still on the way: cover yours again
        if (f.phase > 1) Bosses.arena(f.world, f.id).classList.add("phase2");
        if (f.chaos) Bosses.chaos(f.world, f.chaos);
        if (f.enraged) setEnraged(true);
        if (fightOn() && !f.intro && !f.switching) Sound.music(f.phase > 1 ? `${f.world}-p${f.phase}` : f.world, { v: 0.4, fade: 1.2, fromLoop: true });
        drawItemBar();
    }
    // how wild the arena is (chaos.js); remembered so a resumed fight gets it back
    function setChaos(level) {
        if (!fight) return;
        fight.chaos = level;
        Bosses.chaos(fight.world, level);
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
        root.classList.toggle("special-boss", !!special());                 // the Daily Boss keeps Check and Reveal
        raceEl.hidden = false;
        raceShown = -1;
        raceFaceFor = "";
        document.getElementById("puzzle").classList.add("boss-mode");
        root.classList.add("in-boss");
        syncHelp();
        if (data.playing) Bosses.arena(data.playing.world, fight ? fight.id : data.playing.world);
    }
    function hidePanel() {
        panel.hidden = true;
        panel.classList.remove("ko");
        raceEl.hidden = true;
        if (!waitEl.hidden) waiting(false);
        meStatus.innerHTML = "";
        document.querySelectorAll(".bh-combo").forEach(el => el.remove());
        clearWarn();
        document.getElementById("puzzle").classList.remove("boss-mode");
        root.classList.remove("in-boss", "boss-enraged", "special-boss", "boss-close");
        note = null;
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
                <div class="bp-volume" title="Boss Music (also in Settings)"><button type="button" class="bp-vol-mute" aria-label="Boss music on or off"></button><input type="range" min="0" max="100" step="1" aria-label="Boss music volume"><output></output></div>
                <div class="bp-abilities"><small>YOUR MOVES</small><div class="bp-ab-row"></div></div>
                <div class="bp-board-wrap"><div class="bp-board"></div><div class="bp-fog" aria-hidden="true"></div><p class="bp-loading">The boss is getting ready…</p></div>`;
            // (the boss's clues aren't shown, or even written, so its board costs nothing)
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
    // When the boss blocks your abilities or items, the buttons say so for as long as it lasts:
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
        const ids = loadout(fight.world);
        if (!ids.length) row.appendChild(U.el("p", { class: "bp-ab-none", text: "No abilities yet. Clear a world's Level 1 to unlock its first one." }));
        ids.forEach((id, i) => {
            const a = abilityById[id], open = abilityOpen(a), n = open ? usesOf(id) : 0;
            const btn = U.el("button", { type: "button", class: "bp-ab" + (open ? "" : " locked"), disabled: n <= 0, title: open ? `${a.name}: ${a.desc} (key ${i + 1})` : `${a.name}. Unlock: ${unlockText(a)}`, style: { "--c": a.fx.color } },
                U.el("span", { class: "bp-ab-icon", text: open ? a.icon : "🔒" }), U.el("b", { text: a.name }), U.el("small", { text: open ? `×${n} · key ${i + 1}` : "locked" }));
            btn.addEventListener("click", () => { btn.blur(); useAbility(id); });
            row.appendChild(btn);
        });

    }
    const real = (r, c) => { const ch = fight.letters[r][c]; return !!ch && ch !== "." && ch !== BLOT; };
    // A music slider right in the game: Boss Music in a boss fight, Level Music by the timer in a level. The same settings as in Settings > Sound; 1% steps, no
    // mouse wheel. The button mutes that music (the slider goes to 0) and brings it back to
    // where it was.
    const lastMusic = {};
    const musicPct = key => Math.round(U.clamp(Settings.get(key) ?? 1, 0, 1) * 100);
    const musicIcon = (on, v) => (!on || v === 0 ? "🔇" : v < 35 ? "🔈" : v < 70 ? "🔉" : "🔊");
    function setMusic(key, v) {
        v = U.clamp(Math.round(v), 0, 100);
        if (v > 0) lastMusic[key] = v;
        Settings.set(key, v / 100);
        if (v > 0 && !Settings.get("sound")) Settings.set("sound", true);              // turning it up unmutes
    }
    function toggleMusic(key) {
        const on = Settings.get("sound") && musicPct(key) > 0;
        if (on) { lastMusic[key] = musicPct(key); setMusic(key, 0); }
        else setMusic(key, lastMusic[key] || 80);
    }
    function drawVolume() {
        const box = panel.querySelector(".bp-volume");
        if (!box) return;
        const v = musicPct("bossMusicVolume"), on = Settings.get("sound") && v > 0;
        const range = box.querySelector("input");
        if (document.activeElement !== range) range.value = v;
        box.querySelector("output").textContent = on ? v + "%" : "Off";
        box.querySelector(".bp-vol-mute").textContent = musicIcon(on, v);
        box.classList.toggle("off", !on);
    }
    function wireVolume() {
        const box = panel.querySelector(".bp-volume");
        if (!box) return;
        const range = box.querySelector("input");
        range.addEventListener("input", () => { setMusic("bossMusicVolume", Number(range.value)); drawVolume(); });
        range.addEventListener("change", () => range.blur());                                   // back to typing on the board
        box.querySelector(".bp-vol-mute").addEventListener("click", e => { toggleMusic("bossMusicVolume"); drawVolume(); e.currentTarget.blur(); });
        drawVolume();
    }
    Settings.on(key => { if (key === "bossMusicVolume" || key === "sound") drawVolume(); });

    // ---- the level's own song, and a music control by the
    // timer to change it quickly ("add a music slider to the levels"). Songs: audio/music/level-<world>-<1..4>.mp3
    const songFor = (world, level) => `level-${world}-${level}`;
    const musicCtl = U.el("div", { class: "music-ctl", hidden: true, title: "Level Music (also in Settings and the sound menu)" },
        U.el("button", { type: "button", class: "mc-mute", "aria-label": "Level music on or off" }),
        U.el("input", { type: "range", min: "0", max: "100", step: "1", "aria-label": "Level music volume" }),
        U.el("output"));
    document.querySelector(".hud-row").appendChild(musicCtl);
    const levelOn = () => U.view() === "level" && data.playing && !data.playing.special && data.playing.level < 5;
    function drawMusicCtl() {
        musicCtl.hidden = !levelOn();
        if (musicCtl.hidden) return;
        const v = musicPct("levelMusicVolume"), on = Settings.get("sound") && v > 0;
        const range = musicCtl.querySelector("input");
        if (document.activeElement !== range) range.value = v;
        musicCtl.querySelector("output").textContent = on ? v + "%" : "Off";
        const mute = musicCtl.querySelector(".mc-mute");
        mute.textContent = musicIcon(on, v);
        mute.title = on ? `Level Music ${v}%: click to mute it` : "Level Music off: click to turn it on";
        musicCtl.classList.toggle("off", !on);
    }
    {
        const range = musicCtl.querySelector("input");
        range.addEventListener("input", () => { setMusic("levelMusicVolume", Number(range.value)); drawMusicCtl(); });
        range.addEventListener("change", () => range.blur());                                   // back to typing on the board
        musicCtl.querySelector(".mc-mute").addEventListener("click", e => { toggleMusic("levelMusicVolume"); drawMusicCtl(); e.currentTarget.blur(); });
    }
    Settings.on(key => { if (["levelMusicVolume", "sound"].includes(key)) drawMusicCtl(); });
    // which song should be playing: the level's, while it's being played (not once it's solved or given up)
    function levelMusic() {
        drawMusicCtl();
        const g = Game.state;
        if (levelOn() && g.puzzle && g.puzzle.mode === "campaign" && !g.solved) Sound.levelSong(songFor(data.playing.world, data.playing.level));
        else if (Sound.levelSongName) Sound.levelSong(null, { fade: 2 });
    }
    Bus.on("puzzle", () => levelMusic());
    Bus.on("win", () => levelMusic());
    Bus.on("surrender", () => levelMusic());
    // The warning box under the race bar: an attack winding up comes first, then what just happened (notice), then
    // the boss being almost done (85%)
    let warnKey = "";
    function drawWarn() {
        const f = fight, wu = panel.querySelector(".bp-windup");
        if (!f || !wu) return;
        const now = performance.now(), noteOn = note && now - note.at < note.ms;
        const mode = f.pending ? "incoming" : noteOn ? note.tone : f.close && !f.over ? "close" : null;
        if (!f.pending && !wu.hidden) wu.hidden = true;
        if (!mode) { if (!warnEl.hidden) warnEl.hidden = true; warnKey = ""; return; }
        if (!warnEl.firstChild) warnEl.innerHTML = `<b><span class="mw-name"></span> <em></em></b><span class="mw-how"></span><i></i>`;   // built once, then only its parts change
        let name, time = "", how, k;
        if (f.pending) {
            const mv = f.pending, it = INTERCEPT[mv.kind];
            k = f.windup / f.windupMax;
            if (wu.hidden) wu.hidden = false;
            setVar(wu.querySelector("i"), "width", (k * 100).toFixed(1) + "%");
            setText(wu.querySelector("span"), `${mv.icon} ${mv.name}`);
            name = `⚠ ${mv.icon} ${mv.name} Incoming`;
            time = f.windup.toFixed(1) + "s";
            how = it && interceptEl ? `Click the ${LOOK_NAME[it.look]}${it.hits > 1 ? ` ${it.hits}×` : ""} to turn it on the boss, or finish a word to block it` : `Finish a word to block it${COUNTER[mv.kind] ? " · if it lands: " + COUNTER[mv.kind] : ""}`;
            if (warnEl.title !== mv.desc) warnEl.title = mv.desc;
        } else if (noteOn) {
            name = `${note.icon} ${note.title}`;
            how = note.sub;
            k = 1 - (now - note.at) / note.ms;
            if (warnEl.title) warnEl.title = "";
        } else {
            const p = Math.round(bossPct() * 100);
            name = `⚠ ${bossOf(f.world).name} Is ${p}% Done`;
            how = "Almost there. Finish words fast, and use an ability now.";
            k = bossPct();
            if (warnEl.title) warnEl.title = "";
        }
        // a new message pops in again (its animation restarts); the same one only updates its numbers
        const key = mode + "|" + (f.pending ? f.pending.kind : noteOn ? note.at : "");
        if (key !== warnKey) { warnKey = key; warnEl.dataset.tone = mode; warnEl.hidden = true; void warnEl.offsetWidth; warnEl.classList.toggle("can-close", !f.pending && noteOn); }
        if (warnEl.hidden) warnEl.hidden = false;
        setText(warnEl.querySelector(".mw-name"), name);
        setText(warnEl.querySelector("em"), time);
        setText(warnEl.querySelector(".mw-how"), how);
        setVar(warnEl.querySelector("i"), "width", (Math.max(0, k) * 100).toFixed(1) + "%");
    }
    function clearWarn() {
        note = null;
        warnKey = "";
        warnEl.hidden = true;
        root.classList.remove("boss-close");
        if (fight) fight.close = false;
    }

    function drawFight() {
        if (!fight || panel.hidden) return;
        const f = fight, g = Game.state;
        if (!panel.querySelector(".bp-race")) return;
        drawRace();
        const filled = f.letters ? f.letters.flat().filter(ch => ch && ch !== "." && ch !== BLOT).length : 0, pct = f.letterCount ? filled / f.letterCount : 0;
        setVar(panel.querySelector(".bp-race i"), "width", (pct * 100).toFixed(1) + "%");
        setText(panel.querySelector(".bp-race span"), `✎ Boss's Board: ${Math.round(pct * 100)}% Done`);
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
        drawWarn();
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
    // What just happened in the fight: it's said in the warning box under the race bar for a few seconds. A wind-up there comes first.
    //   tone: "good" (you blocked or countered), "bad" (it hit you), "mine" (your ability), "rage", "info"
    let note = null;
    function notice(icon, title, sub = "", tone = "info", ms = 2800) {
        note = { icon, title, sub, tone, at: performance.now(), ms };
        drawWarn();
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
        if (b.freeze > 0 || b.blind > 0 || b.bubble > 0 || b.dig > 0 || b.snowed > 0) return 0;
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
    // wipe letters on the boss's board. force: even letters of other finished words (they stop being finished);
    // own: the finished word being wiped, which doesn't protect its own letters
    function wipe(cells, force = false, own = null) {
        const f = fight;
        let n = 0;
        for (const [r, c] of cells) {
            if (!f.letters[r][c] || f.letters[r][c] === ".") continue;
            if (!force && f.done.some(e => e !== own && Game.cellsOf(e).some(([r2, c2]) => r2 === r && c2 === c))) continue;
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
        if (f.wish) { f.wish = false; bossLose(cells.length); floatText(`Wish granted! The boss loses ${cells.length} letters 🌠`, true); Powers.aura(bossBoardEl(), ["🌠", "✨"], "pop", 10, 900); }
        counterOnWord();
        if (f.me.toll > 0) { bossGain(2); floatText("+2 letters for the boss ♨️", false); }     // Scorched Earth: your words feed it
        f.lastWordAt = now;
        f.bestCombo = Math.max(f.bestCombo, f.combo);
        // Sunny Hour: a right letter grows somewhere else, but only for words YOU finished (a word the sun finished
        // doesn't grow another letter, or one sunny word sets off the next and they all fill in at once)
        if (f.buff.sun > 0 && !f.growing) growLetter(cells);
        if (f.buff.hot > 0) { f.boss.freeze = Math.max(f.boss.freeze || 0, 2); Powers.aura(portraitEl(), ["🔥"], "rise", 6, 900); }
        if (f.boss.bubble > 0) { f.boss.bubble = 0; bossTimerEnded("bubble"); speak("My bubble popped!", 1600); }
        // blocked an attack that was winding up?
        if (f.pending) {
            const mv = f.pending;
            f.pending = null;
            f.windup = 0;
            f.blocks++;
            notice("🛡️", "Blocked", `${mv.name} was stopped.`, "good");
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
    // Sunny Hour: a right letter grows in an empty square that isn't in the word you just finished, and if it can,
    // one that doesn't finish a word by itself (the letter is a helping hand, not a free word)
    function growLetter(skip) {
        const g = Game.state, not = new Set((skip || []).map(([r, c]) => r + "," + c));
        const empty = scopeAll().filter(([r, c]) => !g.letters[r][c] && !not.has(r + "," + c));
        if (!empty.length) return;
        const finishes = ([r, c]) => [...g.puzzle.across, ...g.puzzle.down].some(e => {
            const cells = Game.cellsOf(e);
            return cells.some(([r2, c2]) => r2 === r && c2 === c) && cells.every(([r2, c2]) => (r2 === r && c2 === c) || g.letters[r2][c2]);
        });
        const calm = empty.filter(p => !finishes(p));
        const [r, c] = U.pick(calm.length ? calm : empty);
        setTimeout(() => {
            if (!fightOn() || g.letters[r][c]) return;
            const f = fight;
            f.growing = true;                       // a word this letter finishes doesn't grow another one
            try { Game.fillCells([[r, c]]); } finally { f.growing = false; }
            Powers.aura(Game.cellEl(r, c), ["🌱", "🌼"], "rise", 4, 900);
        }, 350);
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
    // the boss is almost done: red edges, the warning box, an alarm; off again below 80%
    const CLOSE_AT = 0.85, CLOSE_OFF = 0.8;
    function updateHp() {
        const f = fight;
        if (!f || !f.puzzle) return;
        f.lead = myPct() - bossPct() - (f.headStart || 0);          // (words carried over from your last attempt don't count)
        const bp = bossPct(), close = !f.over && !Game.state.solved && !f.switching && bp >= (f.close ? CLOSE_OFF : CLOSE_AT);
        if (close !== !!f.close) {
            f.close = close;
            root.classList.toggle("boss-close", close);
            if (close) {
                if (special() && (f.chaos || 0) < 2) setChaos(2);            // the Daily Boss's arena: wilder near the end
                Sound.custom(() => { for (const t of [0, 0.24]) Sound.tone({ f: 988, f2: 740, type: "triangle", t, d: 0.2, v: 0.045 }); });
                FX.shake(5, 300);
                speak(U.pick(["Almost done...", "Nearly there!", "Too slow!"]), 2200);
                Mascot.say(U.pick(["It's almost done! Hurry!", "Quick, it's nearly finished!"]), { mood: "wow", hold: 2600 });
                drawWarn();
            }
        }
        const mine = myPct() - (f.headStart || 0);
        if (!f.enraged && !(f.buff.calm > 0) && mine >= RAGE_FLOOR && mine >= RAGE_RATIO * bp && !Game.state.solved && !f.switching) {
            f.enraged = true;
            root.classList.add("boss-enraged");
            Bosses.enrage(true);
            notice("😡", `${bossOf(f.world).name} Is Enraged`, f.th.double ? "It chains its attacks now." : "", "rage", 3400);
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
        const myBad = Object.entries(f.me).some(([k, v]) => k !== "decree" && v > 0 && v !== true) || f.thorns;   // (the angel's decree can't be washed off)
        switch (a.kind) {
            case "erase": case "scatter": return f.done.length ? null : "The boss hasn't finished a word yet.";
            case "knock": case "undo": case "chomp": case "blackhole": return bossFilled().length ? null : "The boss's board is still empty.";
            case "cleanse": return myBad ? null : "The boss isn't doing anything to you right now.";
            case "shield": return f.me.shield ? "Your shield is already up." : null;
            case "reflect": return f.me.reflect ? "Your bounce is already ready." : null;
            case "extralife": return f.extraLife ? "You already have an extra life." : null;
            case "haunt": return f.boss.haunt ? "The boss's next page is already haunted." : null;
            case "calm": return f.buff.calm > 0 ? "The boss is already calm." : null;
            case "delay": return f.buff.blizzard > 0 ? "The blizzard is already blowing." : null;
            case "check": return Game.wrongCells().length ? null : "No wrong letters on your board.";
            case "autofill": return autoFillCells().length ? null : "No word is just one letter from done.";
            case "cheat": { const e = currentMyEntry(); return e && Game.cellsOf(e).some(([r, c]) => g.letters[r][c] !== g.puzzle.solution[r][c]) ? null : "Your selected word is already right."; }
            case "constellation": return crossings().length ? null : "No crossings left to light up.";
            case "wish": return f.wish ? "Your wish is already waiting for your next word." : null;
            case "purify": return wrongMine().length ? null : "You don't have any wrong letters to purify.";
            case "chorus": return f.buff.chorus > 0 ? "The chorus is already singing." : null;
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
        if (!a || !fightOn() || !fight.puzzle || fight.intro || usesOf(id) <= 0) return;
        if (!loadout(fight.world).includes(id) || !abilityOpen(a)) return;    // only what this fight brings, once unlocked
        const why = fight.me.seal > 0 ? "Your abilities are wrapped in weeds for a few seconds." : cantUse(a);
        if (why) { notice(a.icon, `Not Now: ${a.name}`, why, "info", 2400); Sound.play("wrong"); return; }
        spendUse(id);
        save();
        const f = fight;
        f.used++;
        f.kinds.add(a.kind);
        drawAbilityBar();
        notice(a.icon, a.name, a.desc, "mine", 2600);
        const castP = Powers.cast(a, { fromEl: boardArea(), bossEl: portraitEl(), bossBoard: bossBoardEl() });
        if (a.fx.on !== "me") await castP;                       // effects on the boss happen when the shot lands
        if (fight !== f || f.over) return;
        if (f.boss.ward && a.fx.on !== "me") {                   // Umbrella: this one bounces off
            f.boss.ward = 0;
            notice("☂️", "Bounced Off", `${a.name} hit its umbrella.`, "bad");
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
            case "erase": { const last = f.done[f.done.length - 1]; if (last && !wipe(Game.cellsOf(last), false, last)) wipe(Game.cellsOf(last), true); break; }   // (every letter shared with another finished word: it goes anyway)
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
            case "cleanse": { const decree = f.me.decree; f.me = { shield: f.me.shield, reflect: f.me.reflect }; f.thorns = null; clearMe(true); if (decree > 0) f.me.decree = decree; break; }   // (not the angel's decree)
            case "bubble": max("bubble", 15); break;
            case "undo": { let n = 0; while (f.log.length && n < 4) { const [r, c] = f.log.pop(); if (real(r, c)) { wipe([[r, c]], true); n++; } } break; }
            case "freeze": max("freeze", 6); break;
            case "delay": f.buff.blizzard = 15; f.blizGiven = 0; break;          // Blizzard (it used to push the next attack back)
            case "armor": f.buff.armor = 40; break;
            case "wash": {                                      // the unfinished words' letters, up to 6 (newest first)
                const inDone = new Set(f.done.flatMap(e => Game.cellsOf(e).map(([r, c]) => r + "," + c)));
                const loose = f.log.filter(([r, c]) => real(r, c) && !inDone.has(r + "," + c)).reverse().slice(0, 6);
                wipe(loose);
                f.word = null;
                break;
            }
            case "counter":
                if (f.pending) { notice("✋", "Countered", `${f.pending.name} was cancelled.`, "good"); f.pending = null; f.windup = 0; max("freeze", 4); }
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
            // the Celestial Rift
            case "constellation": Game.fillCells(crossings().slice(0, 4)); break;
            case "wish": f.wish = true; break;
            case "purify": {                                             // Purifying Light: up to 3 of your wrong letters turn right
                const cells = wrongMine().sort(() => Math.random() - 0.5).slice(0, 3);
                Game.setLetters(cells.map(([r, c]) => [r, c, g.puzzle.solution[r][c]]));
                cells.forEach(([r, c], i) => setTimeout(() => { const el = Game.cellEl(r, c); if (el) U.restart(el, "flip"); }, i * 120));
                floatText(`${cells.length} wrong letter${cells.length === 1 ? "" : "s"} made right ✨`);
                break;
            }
            case "chorus": f.buff.chorus = 20; f.chorusN = 0; floatText("The chorus sings along: right letters echo 🎶"); break;   // Angel Chorus: see the typing handler
        }
        if (g.solved) return;
    }
    // Constellation: squares where two unfinished words cross (and the letter there isn't right yet)
    function crossings() {
        const g = Game.state, out = [];
        const open = e => e && Game.cellsOf(e).some(([r, c]) => g.letters[r][c] !== g.puzzle.solution[r][c]);
        scopeAll().forEach(([r, c]) => {
            if (Game.isLocked(r, c) || g.letters[r][c] === g.puzzle.solution[r][c]) return;
            if (open(g.acrossAt[r][c]) && open(g.downAt[r][c])) out.push([r, c]);
        });
        return out.sort(() => Math.random() - 0.5);
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
    // Each boss has 5 moves, the Cursed Angel 10; it picks one at
    // random, never the same one twice in a row.

    // ---------------------------------------------------------------------------------------------
    // Counterplay. Besides blocking with a word, every move has its own way to fight back:
    //   - INTERCEPTS: during the wind-up a drawn target appears; click it in time and the move is cancelled and
    //     turned back on the boss
    //   - your progress protects you: finished (right) words resist the move
    //   - once it lands, you can break it: brush snow off, cut thorns, wipe ink, repair glitched letters...
    // ---------------------------------------------------------------------------------------------
    // what to do about each move (shown on the warning and on the effect's chip)
    // a tip in Title Case: "click the eraser to snatch it" -> "Click The Eraser To Snatch It"
    const tipCase = s => s.replace(/(^|[\s(·])(\p{Ll})/gu, (m, a, ch) => a + ch.toUpperCase());
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
        snapfinish: "close the warp gate (2 clicks)", vowels: "vowels in finished words stay visible",
        judgment: "click the halo 2× to turn the rays on the angel", wings: "every word you finish pushes the wings back a column",
        holylight: "every word you finish shrinks the light: 3 words put it out", scripture: "click the stolen clues 5× to take them back",
        tithe: "finish 2 words to end the tithe",
        lance: "click the lance 2× to turn the beam on the angel", decree: "it can't be broken: type around the letter for 10 seconds",
        ascend: "click an angel bird 3× to get its letter back; finish 2 words to bring the rest down", trumpet: "click the trumpet 2× before it sounds",
        penance: "type 6 right letters in a row to end your penance"
    };
    // the boss gets a taste of its own move
    const bossBlind = s => { fight.boss.blind = Math.max(fight.boss.blind || 0, s); };
    const bossStun = s => { fight.boss.freeze = Math.max(fight.boss.freeze || 0, s); };
    const bossSlow = s => { fight.boss.slow = Math.max(fight.boss.slow || 0, s); };
    const bossLose = n => { wipe(bossFilled().sort(() => Math.random() - 0.5).slice(0, n), true); refreshDone(); };
    // Judgment Rays turned back: the boss's fullest row(s) go
    function bossLoseRows(k) {
        const f = fight, rows = f.letters.map((row, r) => [r, row.filter(ch => ch && ch !== "." && ch !== BLOT).length]).sort((a, b) => b[1] - a[1]).slice(0, k).map(([r]) => r);
        const cells = bossFilled().filter(([r]) => rows.includes(r));
        wipe(cells, true);
        refreshDone();
        return cells.length;
    }
    // Seraph's Lance turned back: the boss's fullest column goes
    function bossLoseCol() {
        const f = fight, n = f.letters.length, counts = [];
        for (let c = 0; c < n; c++) counts.push([c, f.letters.filter(row => row[c] && row[c] !== "." && row[c] !== BLOT).length]);
        const col = counts.sort((a, b) => b[1] - a[1])[0][0], cells = bossFilled().filter(([, c]) => c === col);
        wipe(cells, true);
        refreshDone();
        return cells.length;
    }
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
        umbrella: '<path d="M8 30 Q32 2 56 30 Z" fill="#ff5c6c" stroke="#2b2233" stroke-width="2.5"/><path d="M32 30 L32 52 Q32 58 26 56" stroke="#2b2233" stroke-width="3" fill="none"/>',
        lance: '<path d="M32 4 L40 20 L34 20 L34 60 L30 60 L30 20 L24 20 Z" fill="#fff6d8" stroke="#c9902f" stroke-width="2.5" stroke-linejoin="round"/><path d="M22 24 Q32 30 42 24" stroke="#ffd06b" stroke-width="3" fill="none"/><circle cx="32" cy="12" r="3" fill="#ffffff"/>',
        trumpet: '<path d="M6 30 L30 30 Q44 30 54 16 L58 16 L58 48 L54 48 Q44 34 30 34 L6 34 Z" fill="#ffd06b" stroke="#8a5a1a" stroke-width="2.5" stroke-linejoin="round"/><circle cx="16" cy="32" r="3" fill="#8a5a1a"/><path d="M24 34 L24 42 L34 42" stroke="#8a5a1a" stroke-width="2.5" fill="none"/>',
        halo: '<ellipse cx="32" cy="30" rx="24" ry="9" fill="none" stroke="#ffd06b" stroke-width="7"/><ellipse cx="32" cy="30" rx="24" ry="9" fill="none" stroke="#fff6d8" stroke-width="2.5"/><path d="M50 24 l4 -4 m-2 8 l6 0" stroke="#2a0f5a" stroke-width="2"/><path d="M22 44 L32 58 L42 44" fill="#ffe7a3" opacity=".7"/>'
    };
    const LOOK_NAME = { sun: "flare", eraser: "eraser", cap: "marker cap", branch: "branch", feather: "feather", paw: "paw", spiral: "whirlpool", icicle: "icicle",
        spark: "spark", swirl: "gust", wings: "wings", jet: "sand jet", wheel: "loading wheel", hand: "ghost hand", bar: "reboot bar", target: "target", gauge: "pressure gauge",
        stream: "lava stream", gate: "warp gate", star: "collapsing star", umbrella: "umbrella", halo: "halo", lance: "lance", trumpet: "trumpet" };
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
        ward: { look: "umbrella", hits: 2, back: () => { bossStun(1.5); return "You knocked the umbrella out of its hands"; } },
        judgment: { look: "halo", hits: 2, back: () => { const n = bossLoseRows(1); fight.rays = null; return `The rays turn on the angel: its own board loses a row (${n} letters)`; } },
        lance: { look: "lance", hits: 2, back: () => { const n = bossLoseCol(); fight.lanceCol = null; return `The lance turns on the angel: its own board loses a column (${n} letters)`; } },
        trumpet: { look: "trumpet", hits: 2, back: () => { bossLoseWord(); bossStun(1.5); return "You muffled the trumpet: the blast blows away the angel's own word"; } }
    };
    let interceptEl = null;
    // the target turns up somewhere random on the screen, drifts about, and jumps somewhere new after every hit
    //; later bosses' targets move faster
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
        notice("🎯", "Countered", text, "good", 3000);
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
        if (f.me.scripture > 0 && e.target.closest(".clue-col.stolen")) {
            e.preventDefault(); e.stopPropagation();
            f.taps = f.taps || {};
            const col = e.target.closest(".clue-col.stolen");
            U.restart(col, "shake");
            Sound.tone({ f: 420 + (f.taps.scripture || 0) * 90, f2: 300, d: 0.08, v: 0.1, type: "triangle" });
            if ((f.taps.scripture = (f.taps.scripture || 0) + 1) >= 5) { f.me.scripture = 0; f.taps.scripture = 0; bossStun(2); floatText("Scripture taken back! The angel is stunned 2s 📜"); }
            applyMe(); drawFight();
            return;
        }
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
        if (f.me.wings > 0) { f.wingsBack = (f.wingsBack || 0) + 1; floatText("The wings pull back 🌑"); }
        if (f.me.holylight > 0 && (f.holyShrink = (f.holyShrink || 0) + 1) >= 3) { f.me.holylight = 0; floatText("The light went out! 💫"); }
        for (const [k, msg] of [["drain", "Board watered! 🌱"], ["heatwave", "Cooled down! ❄️"], ["numberless", "Numbers back! 💾"], ["tithe", "Tithe broken! 🪙"], ["ascend", "Your letters came back down 🕊️"]]) if (f.me[k] > 0) {
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
        f.rays = f.pending.kind === "judgment" ? rayRows() : null;       // Judgment Rays: the rows it aims at light up
        f.lanceCol = f.pending.kind === "lance" ? lanceCol() : null;    // Seraph's Lance: so does the column
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
            notice("📄", "Shielded", `${mv.name} bounced off your Paper Wall.`, "good");
            Sound.play("right");
            drawFight();
            chain();
            return;
        }
        if (f.me.reflect) {
            f.me.reflect = 0;
            f.boss.freeze = Math.max(f.boss.freeze || 0, Math.max(4, mv.d * f.th.power));
            notice("🪞", "Bounced Back", `${mv.name} hit the boss instead. It's frozen.`, "good");
            Sound.custom(Powers.ABILITIES.find(a => a.kind === "reflect").sound);
            Powers.aura(portrait, ["🧁", mv.icon], "pop", 10, 1200);
            speak("Wha-? It came BACK?!", 2000);
            drawFight();
            chain();
            return;
        }
        f.hits++;
        const selfMove = ["ambush", "ward", "haste", "powerup", "heal", "snapfinish"].includes(mv.kind);     // moves that power the boss up
        notice(mv.icon, selfMove ? `${b.name} Used ${mv.name}` : `${mv.name} Hit You`, COUNTER[mv.kind] && !selfMove ? `Tip: ${tipCase(COUNTER[mv.kind])}` : `It ${mv.desc}.`, "bad", 3800);
        FX.shake(9, 420);
        FX.flash(b.color, 380, 0.22);
        await U.wait(U.motion() === "still" ? 0 : 250);
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
                const ids2 = readyAbilities(f.world).filter(id => usesOf(id) > 0);
                if (ids2.length) {
                    const id = U.pick(ids2);
                    spendUse(id);
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
            // the Cursed Angel
            case "judgment": {                                                   // Judgment Rays: whole rows cleared (one with Frost Armor)
                const rows = (f.rays && f.rays.length ? f.rays : rayRows()).slice(0, armor ? 1 : 2);
                f.raysHit = rows;
                Game.setLetters(scopeAll().filter(([r, c]) => rows.includes(r) && g.letters[r][c] && !Game.isLocked(r, c)).map(([r, c]) => [r, c, ""]));
                f.rays = null;
                break;
            }
            case "wings": f.me.wings = dur; f.wingsMax = dur; f.wingsBack = 0; break;                 // Wings of Night: they close in from both sides
            case "holylight": f.me.holylight = dur; f.holyShrink = 0; f.holy = { x: 0.3 + Math.random() * 0.4, y: 0.3 + Math.random() * 0.4, a: Math.random() * 6.283 }; break;
            case "scripture": {                                                  // Stolen Scripture: the direction with more left to solve
                const left = dir => g.puzzle[dir].filter(e => Game.cellsOf(e).some(([r, c]) => g.letters[r][c] !== g.puzzle.solution[r][c])).length;
                f.stolenDir = left("down") > left("across") ? "down" : "across";
                f.me.scripture = dur;
                break;
            }
            case "tithe": f.me.tithe = dur; f.titheN = 0; break;
            case "lance": {                                                      // Seraph's Lance: a whole column (finished words hold with Frost Armor)
                const col = f.lanceCol != null ? f.lanceCol : lanceCol(), keep = armor ? safeCells() : new Set();
                f.lanceHit = col;
                Game.setLetters(scopeAll().filter(([r, c]) => c === col && g.letters[r][c] && !Game.isLocked(r, c) && !keep.has(r + "," + c)).map(([r, c]) => [r, c, ""]));
                f.lanceCol = null;
                break;
            }
            case "decree": {                                                     // Divine Decree: the letter you still need most
                const need = {};
                scopeAll().forEach(([r, c]) => { const ch = g.puzzle.solution[r][c]; if (g.letters[r][c] !== ch && !Game.isLocked(r, c)) need[ch] = (need[ch] || 0) + 1; });
                const best = Object.entries(need).sort((a, b) => b[1] - a[1])[0];
                if (best) { f.decree = best[0]; f.me.decree = DECREE_SECONDS * (armor ? 0.5 : 1); }   // always 10 s: no breaking it, you sit it out
                break;
            }
            case "ascend": f.me.ascend = dur; f.ascAcc = 0; setTimeout(() => sendBirds(f), U.motion() === "still" ? 0 : 900); break;   // Ascension: angel birds, then see the fight's tick
            case "trumpet": {                                                    // Trumpet Blast: the letters inside two words, out of order
                const safe = safeCells(), loose = ([r, c]) => g.letters[r][c] && !Game.isLocked(r, c) && !safe.has(r + "," + c), used = new Set(), sets = [];
                let n = 0;
                for (const w of shuffle(wordsOf())) {
                    const cells = Game.cellsOf(w).filter(x => loose(x) && !used.has(x[0] + "," + x[1]));
                    const was = cells.map(([r, c]) => g.letters[r][c]);
                    if (new Set(was).size < 2) continue;
                    let mixed = shuffle([...was]);
                    if (mixed.every((ch, i) => ch === was[i])) mixed = was.slice(1).concat(was[0]);
                    cells.forEach(([r, c], i) => { used.add(r + "," + c); if (mixed[i] !== was[i]) sets.push([r, c, mixed[i]]); });
                    if (++n >= (armor ? 1 : 2)) break;
                }
                Game.setLetters(sets);
                break;
            }
            case "penance": f.me.penance = dur; f.penStreak = 0; break;          // Penance: see the typing handler
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
    // the rows Judgment Rays aims at: the two with the most of your letters in them (that it can take)
    function rayRows() {
        const g = Game.state, n = g.puzzle ? g.puzzle.size : 0, score = [];
        for (let r = 0; r < n; r++) score.push([r, scopeAll().filter(([r2, c]) => r2 === r && g.letters[r2][c] && !Game.isLocked(r2, c)).length + Math.random() * 0.5]);
        return score.sort((a, b) => b[1] - a[1]).slice(0, 2).map(([r]) => r);
    }
    // the column Seraph's Lance aims at: the one with the most of your letters in it (that it can take)
    function lanceCol() {
        const g = Game.state, n = g.puzzle ? g.puzzle.size : 0, score = [];
        for (let c = 0; c < n; c++) score.push([c, scopeAll().filter(([r, c2]) => c2 === c && g.letters[r][c2] && !Game.isLocked(r, c2)).length + Math.random() * 0.5]);
        return score.sort((a, b) => b[1] - a[1])[0][0];
    }
    // Ascension: one of your loose letters floats up into the empty square above it, or off the top of its column
    function ascendOne(f, g) {
        const safe = safeCells(), open = (r, c) => r >= 0 && g.puzzle.solution[r][c] !== ".";
        const loose = scopeAll().filter(([r, c]) => g.letters[r][c] && !Game.isLocked(r, c) && !safe.has(r + "," + c));
        if (!loose.length) return;
        // letters with an empty square above them go first: they look like they're drifting up
        const up = loose.filter(([r, c]) => open(r - 1, c) && !g.letters[r - 1][c] && !Game.isLocked(r - 1, c) && !takenBy(r - 1, c));
        const [r, c] = U.pick(up.length ? up : loose), ch = g.letters[r][c], before = g.letters.map(x => [...x]);
        const to = up.length ? [r - 1, c] : null, from = U.center(Game.cellEl(r, c));
        Game.setLetters(to ? [[r, c, ""], [to[0], to[1], ch]] : [[r, c, ""]]);
        Game.markBossChanges(before);
        const el = Game.cellEl(r, c);
        if (el) U.restart(el, "ascended");
        if (to) { const t = Game.cellEl(to[0], to[1]); if (t) U.restart(t, "ascended-in"); }
        FX.burst({ x: from.x, y: from.y, n: 7, colors: ["#fff6d8", "#ffd06b", "#ffffff"], shape: "petal", angle: -Math.PI / 2, spread: 0.8, speed: [60, 160], gravity: -60, life: [0.6, 1], size: [4, 7], spin: 2 });
        Sound.tone({ f: 900, f2: 1700, d: 0.25, v: 0.035, type: "sine", boss: true });
    }
    // Divine Decree: a golden tablet over your board names the forbidden letter for 10 seconds. It can't be clicked
    // away: it counts down, and you type around the letter until it lifts.
    const DECREE_SECONDS = 10;
    let decreeEl = null;
    function drawDecree(letter, f) {
        const area = document.querySelector(".board-wrap");                // on the board's top edge
        if (!letter) { if (decreeEl) decreeEl.hidden = true; return; }
        if (!decreeEl) decreeEl = U.el("div", { class: "decree-tablet", role: "status", html: `<small>Forbidden</small><b></b><em></em>` });
        if (area && decreeEl.parentNode !== area) area.appendChild(decreeEl);
        decreeEl.hidden = false;
        const b = decreeEl.querySelector("b"), left = Math.max(0, Math.ceil(f.me.decree || 0)) + "s";
        if (b.textContent !== letter) b.textContent = letter;
        if (decreeEl.lastChild.textContent !== left) { decreeEl.lastChild.textContent = left; decreeEl.setAttribute("aria-label", `The angel forbids ${letter} for ${left}`); }
    }
    // a boss effect on a timer wiping your letters: they get the ✕ mark like any hit, so clicking puts them back
    //
    const bossWipe = list => { const before = Game.state.letters.map(r => [...r]); Game.setLetters(list); Game.markBossChanges(before); };
    // your wrong letters (that aren't locked): what Purifying Light fixes
    const wrongMine = () => { const g = Game.state; return scopeAll().filter(([r, c]) => g.letters[r][c] && g.letters[r][c] !== g.puzzle.solution[r][c] && !Game.isLocked(r, c)); };
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
    // Ascension's angel birds. Five doves swoop down, each carries one of your letters off
    // (right ones first) and flies around the screen with it: 3/4
    // of the speed of the boss's click targets, bouncing off the edges; 3 clicks bring it back, and it keeps its course
    // between clicks. Its square is sealed with a halo lock: no typing there, and clicking it does nothing. When
    // Ascension ends, the doves still flying take their letters to the angel, and the squares open again, empty.
    let birds = [];
    const DOVE = `<svg viewBox="0 0 64 52" aria-hidden="true"><ellipse cx="32" cy="9" rx="13" ry="3.6" fill="none" stroke="#ffd06b" stroke-width="3"/>` +
        `<g class="ab-wing l"><path d="M30 27 Q12 4 2 13 Q9 27 30 33Z" fill="#fff" stroke="#c9b8ff" stroke-width="2"/><path d="M26 27 Q15 16 8 16 M24 30 Q14 23 7 23" fill="none" stroke="#e3d8ff" stroke-width="1.5"/></g>` +
        `<g class="ab-wing r"><path d="M34 27 Q52 4 62 13 Q55 27 34 33Z" fill="#fff" stroke="#c9b8ff" stroke-width="2"/><path d="M38 27 Q49 16 56 16 M40 30 Q50 23 57 23" fill="none" stroke="#e3d8ff" stroke-width="1.5"/></g>` +
        `<path d="M22 31 Q32 22 42 30 Q40 40 32 41 Q24 40 22 31Z" fill="#fff" stroke="#c9b8ff" stroke-width="2"/><path d="M27 40 L24 47 L30 42 L32 48 L34 42 L40 47 L37 40Z" fill="#fff" stroke="#c9b8ff" stroke-width="1.5"/>` +
        `<circle cx="38" cy="25" r="5.5" fill="#fff" stroke="#c9b8ff" stroke-width="2"/><circle cx="39.6" cy="24" r="1.3" fill="#2b2233"/><path d="M43.5 25 l4.5 1 l-4.5 1.6Z" fill="#ffb84d"/></svg>`;
    const LOCK = `<svg viewBox="0 0 40 40" aria-hidden="true"><ellipse cx="20" cy="6.5" rx="10.5" ry="3.2" fill="none" stroke="#ffd06b" stroke-width="2.4"/>` +
        `<path d="M13 21 Q4 12 1 18 Q5 25 13 25Z M27 21 Q36 12 39 18 Q35 25 27 25Z" fill="#fff" stroke="#c9b8ff" stroke-width="1.4"/>` +
        `<path d="M15.5 18 v-3.5 a4.5 4.5 0 0 1 9 0 V18" fill="none" stroke="#8a5a1a" stroke-width="2.2"/><rect x="12.5" y="17.5" width="15" height="13" rx="3" fill="#ffd06b" stroke="#8a5a1a" stroke-width="1.5"/>` +
        `<circle cx="20" cy="22.5" r="1.8" fill="#5a3a10"/><path d="M20 23.5 v3.5" stroke="#5a3a10" stroke-width="1.6"/></svg>`;
    const takenBy = (r, c) => birds.find(b => b.r === r && b.c === c && b.held);
    const placeBird = (el, x, y) => { el.style.left = x.toFixed(0) + "px"; el.style.top = y.toFixed(0) + "px"; };
    function sendBirds(f) {
        const g = Game.state;
        if (fight !== f || f.over || !g.puzzle) return;
        const safe = safeCells(), shuffle = list => list.sort(() => Math.random() - 0.5);
        const loose = scopeAll().filter(([r, c]) => g.letters[r][c] && !Game.isLocked(r, c) && !safe.has(r + "," + c) && !takenBy(r, c));
        const right = loose.filter(([r, c]) => g.letters[r][c] === g.puzzle.solution[r][c]);
        const picks = [...shuffle(right), ...shuffle(loose.filter(x => !right.includes(x)))].slice(0, (f.buff.armor > 0) ? 3 : 5);
        picks.forEach(([r, c], i) => {
            const el = U.el("button", { type: "button", class: "angel-bird", "aria-label": "An angel bird carrying one of your letters: click it to bring the letter back",
                html: DOVE + `<b class="ab-letter"></b><i class="ab-count">×3</i>` });
            const b = { r, c, ch: null, el, held: false, puzzle: g.puzzle, f, hits: 0 };
            document.body.appendChild(el);
            placeBird(el, innerWidth * (0.15 + Math.random() * 0.7), -70);
            el.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); hitBird(b); });
            birds.push(b);
            setTimeout(() => {                                          // down onto the square
                const cell = Game.cellEl(r, c);
                if (!el.isConnected || !cell) return;
                const p = U.center(cell);
                el.classList.add("swoop"); placeBird(el, p.x, p.y - 8);
                setTimeout(() => grabLetter(b), U.motion() === "still" ? 0 : 640);
            }, U.motion() === "still" ? 0 : 60 + i * 220);
        });
        if (picks.length) floatText("Angel birds took your letters! Click a bird 3 times to get its letter back 🕊️", false);
    }
    function grabLetter(b) {
        const g = Game.state, f = b.f;
        if (fight !== f || f.over || g.puzzle !== b.puzzle || !b.el.isConnected) return dropBird(b);
        const ch = g.letters[b.r][b.c];
        if (!ch || Game.isLocked(b.r, b.c)) return flyAway(b);       // nothing to take any more
        b.ch = ch; b.held = true;
        Game.setLetters([[b.r, b.c, ""]]);
        const cell = Game.cellEl(b.r, b.c);
        if (cell) { cell.classList.add("bird-taken"); if (!cell.querySelector(".taken-mark")) cell.appendChild(U.el("span", { class: "taken-mark", "aria-hidden": "true", html: LOCK })); U.restart(cell, "shake"); }
        b.el.querySelector(".ab-letter").textContent = ch;
        b.el.classList.add("holding");
        const p = U.center(b.el);
        FX.burst({ x: p.x, y: p.y, n: 10, colors: ["#ffffff", "#fff6d8", "#ffd06b"], shape: "petal", speed: [60, 180], gravity: 40, life: [0.6, 1], size: [4, 7], spin: 2 });
        Sound.tone({ f: 1400, f2: 2100, type: "sine", d: 0.18, v: 0.04, boss: true });
        flyBird(b);
    }
    // off it goes, round the whole screen, bouncing off the edges (3/4 of the speed of the boss's click targets)
    function flyBird(b) {
        if (!b.el.isConnected) return;
        const q = U.center(b.el), m = 46;
        const pos = { x: q.x, y: q.y }, speed = 0.75 * (45 + (b.f.si || 0) * 9);
        let a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, prev = performance.now();
        b.el.classList.remove("swoop"); b.el.classList.add("flying");
        const step = now => {
            if (!b.held || !b.el.isConnected) return;
            const dt = Math.min(0.05, (now - prev) / 1000);
            prev = now;
            a += (Math.random() - 0.5) * 2.6 * dt;                     // a lazy, wandering course
            pos.x += Math.cos(a) * speed * dt; pos.y += Math.sin(a) * speed * dt;
            if (pos.x < m || pos.x > innerWidth - m) { a = Math.PI - a; pos.x = U.clamp(pos.x, m, innerWidth - m); }
            if (pos.y < 64 + m || pos.y > innerHeight - m) { a = -a; pos.y = U.clamp(pos.y, 64 + m, innerHeight - m); }
            placeBird(b.el, pos.x, pos.y);
            b.el.classList.toggle("left", Math.cos(a) < 0);              // it faces the way it flies
            requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }
    // a click on a dove: three bring its letter back (it doesn't jump away between them)
    function hitBird(b) {
        if (!b.held || !fightOn()) return;
        b.hits++;
        const p = U.center(b.el);
        FX.burst({ x: p.x, y: p.y, n: 6, colors: ["#ffffff", "#fff6d8"], shape: "petal", speed: [40, 140], gravity: 60, life: [0.4, 0.8], size: [4, 6], spin: 2 });
        if (b.hits < 3) {
            b.el.querySelector(".ab-count").textContent = "×" + (3 - b.hits);
            U.restart(b.el, "ab-hit");
            Sound.tone({ f: 700 + b.hits * 220, type: "sine", d: 0.12, v: 0.06 });
            return;
        }
        rescueBird(b);
    }
    function rescueBird(b) {
        if (!b.held || !fightOn()) return;
        const g = Game.state, cell = Game.cellEl(b.r, b.c);
        b.held = false;
        b.el.classList.remove("flying"); b.el.classList.add("swoop");
        if (cell) { const p = U.center(cell); placeBird(b.el, p.x, p.y - 8); }
        Sound.tone({ f: 1046, f2: 1568, type: "sine", d: 0.3, v: 0.05, echo: 0.3 });
        setTimeout(() => {
            if (fight === b.f && !b.f.over && g.puzzle === b.puzzle && !g.letters[b.r][b.c] && !Game.isLocked(b.r, b.c)) Game.setLetters([[b.r, b.c, b.ch]]);
            unmarkTaken(b);
            const el = Game.cellEl(b.r, b.c);
            if (el) { U.restart(el, "flip"); const p = U.center(el); FX.burst({ x: p.x, y: p.y, n: 12, colors: ["#fff6d8", "#ffd06b", "#ffffff"], shape: "star", speed: [60, 200], gravity: 40, life: [0.4, 0.8], size: [2, 4], glow: true }); }
            b.el.remove(); birds = birds.filter(x => x !== b);
            floatText("Letter brought back 🕊️");
            if (fight) drawFight();
        }, U.motion() === "still" ? 0 : 520);
    }
    function unmarkTaken(b) { const cell = Game.cellEl(b.r, b.c); if (cell) { cell.classList.remove("bird-taken"); const m = cell.querySelector(".taken-mark"); if (m) m.remove(); } }
    // off to the angel, letter and all (the square opens again, empty)
    function flyAway(b) {
        b.held = false; unmarkTaken(b);
        const to = portraitEl() ? U.center(portraitEl()) : { x: innerWidth + 80, y: 60 };
        b.el.classList.remove("flying", "swoop"); b.el.classList.add("away"); placeBird(b.el, to.x, to.y);
        setTimeout(() => b.el.remove(), 950);
        birds = birds.filter(x => x !== b);
    }
    function dropBird(b) { unmarkTaken(b); b.el.remove(); birds = birds.filter(x => x !== b); }
    const removeBirds = () => { for (const b of [...birds]) dropBird(b); };

    function moveMinion() {
        const g = Game.state, wrap = document.querySelector(".board-wrap");
        const targets = scopeAll().filter(([r, c]) => g.letters[r][c] && !Game.isLocked(r, c));
        const [r, c] = targets.length ? U.pick(targets) : U.pick(scopeAll());
        const cell = Game.cellEl(r, c);
        if (!cell || !minionEl || !wrap) return;
        const a = cell.getBoundingClientRect(), w = wrap.getBoundingClientRect(), z = U.zoom();   // (on screen -> CSS inside the zoomed page)
        minionEl.style.left = (a.left - w.left + a.width / 2) / z + "px";
        minionEl.style.top = (a.top - w.top + a.height / 2) / z + "px";
        if (g.letters[r][c] && !Game.isLocked(r, c)) setTimeout(() => { if (minionEl && fight && fight.me.minion > 0 && g.letters[r][c] && !Game.isLocked(r, c)) { bossWipe([[r, c, ""]]); U.restart(cell, "scorched"); } }, 600);
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
    const AREA_FX = ["wings", "holylight", "ascend", "decree", "penance", "crumple", "whirl", "mirror", "static", "lights", "confetti", "downpour", "gravity", "sticky", "sandblast", "lock", "taunt",
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
        // bottom half holds it back by a third
        if (on("halffog")) {
            f.floodMax = Math.max(f.floodMax || 0, m.halffog);
            const low = [...rows].filter(r => r >= size - Math.ceil(size / 2)).length;
            // it rises until 5 seconds are left, then stays at its height for those 5 seconds
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
        // the Cursed Angel: wings closing over the sides, the drifting light, the stolen clues, the rows its rays aim at
        if (on("wings")) {
            const n = Game.state.puzzle ? Game.state.puzzle.size : 5, closed = Math.min(Math.floor((n - 1) / 2), 1 + Math.floor((f.wingsMax - m.wings) / 3.5));
            setVar(area, "--wing", (Math.max(0, closed - (f.wingsBack || 0)) / n * 100).toFixed(1) + "%");
        }
        if (on("holylight") && f.holy) {
            setVar(area, "--hx", (f.holy.x * 100).toFixed(1) + "%");
            setVar(area, "--hy", (f.holy.y * 100).toFixed(1) + "%");
            setVar(area, "--hr", (46 * (1 - (f.holyShrink || 0) / 3) + 8).toFixed(1) + "%");
        }
        drawDecree(on("decree") ? f.decree : null, f);
        document.querySelectorAll(".clues .clue-col").forEach((col, i) => col.classList.toggle("stolen", on("scripture") && f.stolenDir === (i === 0 ? "across" : "down")));
        const cb = document.getElementById("clue-bar");
        if (cb) cb.classList.toggle("fx-stolen", on("scripture") && Game.state.direction === f.stolenDir);
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
            cell.classList.toggle("ray-target", !!(f && f.pending && f.pending.kind === "judgment" && f.rays && f.rays.includes(r)));
            cell.classList.toggle("lance-target", !!(f && f.pending && f.pending.kind === "lance" && f.lanceCol === c));
            setVar(cell, "--sx", on("shatter") ? ((r % 2 ? 1 : -1) * (6 + (c % 3) * 3)) + "px" : "0px");
            cell.classList.toggle("shattered", on("shatter"));
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
                const a = cell.getBoundingClientRect(), w = wrap.getBoundingClientRect(), z = U.zoom();
                setVar(area, "--lx", Math.round((a.left + a.width / 2 - w.left) / z) + "px");
                setVar(area, "--ly", Math.round((a.top + a.height / 2 - w.top) / z) + "px");
            }
        }
        if (!on("minion")) removeMinion();
        for (const b of [...birds]) if (b.puzzle !== Game.state.puzzle) dropBird(b);
        if (birds.length && !on("ascend")) for (const b of [...birds]) if (b.held) flyAway(b);
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
        removeBirds();
        const area = boardArea(), board = document.getElementById("board"), clues = document.querySelector(".clues");
        if (area) area.className = area.className.split(" ").filter(c => !c.startsWith("fx-")).join(" ");
        if (clues) clues.classList.remove("fx-blind", "fx-petals", "fx-numberless");
        document.querySelectorAll(".clues .clue-col.stolen").forEach(n => n.classList.remove("stolen"));
        const cbar = document.getElementById("clue-bar");
        if (cbar) cbar.classList.remove("fx-stolen");
        if (fight) fight.rays = null;
        if (board) board.classList.remove("fx-smudge", "fx-frozen");
        flareEl.classList.remove("on");
        document.querySelectorAll("#board .cell").forEach(n => { n.classList.remove("snowed", "thorny", "folded", "piled", "gummed", "bombed", "masked", "ray-target", "shattered"); n.style.removeProperty("--sx"); if (n._vars) delete n._vars["--sx"]; });
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
        if (f.me.decree > 0 && f.decree === letter) return "decree";
        if (takenBy(g.row, g.col)) return "taken";
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
        if (why === "taken") floatText("An angel bird has this letter: click the bird 3 times to get it back", false);
        if (why === "decree") { if (decreeEl) U.restart(decreeEl, "shake"); floatText(`The angel forbids ${fight.decree}`, false); }
    }
    const lockedIn = () => fight && (fight.me.lock > 0 || fight.me.taunt > 0);
    addEventListener("keydown", e => {
        if (!waitEl.hidden && /^[a-zA-Z]$|^Backspace$/.test(e.key) && U.view() === "level") { e.preventDefault(); e.stopPropagation(); return; }
        if (!fightOn() || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.target.closest && e.target.closest("input, select, textarea")) return;
        if (document.querySelector("#overlay .results")) return;
        // (4 too, for a loadout of four abilities)
        if (/^[1-4]$/.test(e.key)) { const id = loadout(fight && fight.world)[+e.key - 1]; if (id && abilityOpen(abilityById[id])) { e.preventDefault(); useAbility(id); } return; }
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
        if (f.buff.blizzard > 0 && letter) {                                  // Blizzard: right letters in a row pile snow on the boss
            if (letter === g.puzzle.solution[row][col]) {
                if ((f.blizGiven || 0) < 8) { f.boss.snowed = (f.boss.snowed || 0) + 0.5; f.blizGiven = (f.blizGiven || 0) + 0.5; }
            } else if (!Game.isLocked(row, col)) { f.buff.blizzard = 0; f.boss.snowed = 0; floatText("A wrong letter melted the snow ❄️", false); }
        }
        if (f.buff.overclock > 0 && (f.ocN || 0) < 5 && letter === g.puzzle.solution[row][col]) {
            const target = U.pick(bossFilled());
            if (target) {
                f.ocN = (f.ocN || 0) + 1;
                const from = U.center(Game.cellEl(row, col)), toCell = f.cells && f.cells[target[0]][target[1]];
                Powers.fly(from, toCell ? U.center(toCell) : U.center(panel), "⚡", "line", 300).then(() => { if (fight === f && !f.over) { wipe([target], true); drawFight(); } });
            }
        }
        if (f.buff.chorus > 0 && letter && letter === g.puzzle.solution[row][col] && (f.chorusN || 0) < 6) {      // Angel Chorus
            const mine = Game.cellsOf(currentMyEntry()) || [];
            const others = scopeAll().filter(([r, c]) => (r !== row || c !== col) && g.puzzle.solution[r][c] === letter && g.letters[r][c] !== letter && !Game.isLocked(r, c));
            const pickFrom = others.filter(([r, c]) => !mine.some(([r2, c2]) => r2 === r && c2 === c));
            const to = U.pick(pickFrom.length ? pickFrom : others);
            if (to) {
                f.chorusN = (f.chorusN || 0) + 1;
                const [r, c] = to;
                Powers.fly(U.center(Game.cellEl(row, col)), U.center(Game.cellEl(r, c)), "🎵", "arc", 360, "#ffd06b").then(() => {
                    if (fight !== f || f.over || g.solved || g.letters[r][c] === letter || Game.isLocked(r, c)) return;
                    Game.setLetters([[r, c, letter]]);
                    const el = Game.cellEl(r, c);
                    if (el) { U.restart(el, "flip"); const p = U.center(el); FX.burst({ x: p.x, y: p.y, n: 10, colors: ["#fff6d8", "#ffd06b", "#ffffff"], shape: "star", speed: [60, 180], gravity: 60, life: [0.4, 0.8], size: [2, 4], glow: true }); }
                    Sound.tone({ f: 880 * Math.pow(2, (f.chorusN % 5) * 2 / 12), type: "sine", d: 0.4, v: 0.05, echo: 0.4, boss: true });
                    drawFight();
                });
                if (f.chorusN >= 6) f.buff.chorus = 0;
            }
        }
        if (f.me.penance > 0 && letter && !Game.isLocked(row, col)) {             // Penance: a wrong letter costs a right one; 6 right in a row end it
            if (letter === g.puzzle.solution[row][col]) {
                if ((f.penStreak = (f.penStreak || 0) + 1) >= 6) { f.me.penance = 0; f.penStreak = 0; floatText("Penance paid! ⛓️"); Powers.aura(Game.cellEl(row, col), ["✨"], "pop", 6, 600); }
            } else {
                f.penStreak = 0;
                const safe = safeCells(), right = scopeAll().filter(([r, c]) => (r !== row || c !== col) && g.letters[r][c] && g.letters[r][c] === g.puzzle.solution[r][c] && !Game.isLocked(r, c) && !safe.has(r + "," + c));
                if (right.length) {
                    const [r, c] = U.pick(right), before = g.letters.map(x => [...x]);
                    Powers.fly(U.center(Game.cellEl(row, col)), U.center(Game.cellEl(r, c)), "⛓️", "line", 260, "#e8c66a").then(() => {
                        if (fight !== f || f.over || g.letters[r][c] !== g.puzzle.solution[r][c]) return;
                        Game.setLetters([[r, c, ""]]);
                        Game.markBossChanges(before);
                        const el = Game.cellEl(r, c);
                        if (el) { U.restart(el, "shake"); const p = U.center(el); FX.burst({ x: p.x, y: p.y, n: 8, colors: ["#e8c66a", "#8a5a1a", "#fff6d8"], shape: "spark", speed: [60, 180], gravity: 200, life: [0.3, 0.6], size: [2, 4] }); }
                        Sound.tone({ f: 1800, f2: 900, d: 0.12, v: 0.05, type: "square", boss: true });
                        drawFight();
                    });
                    floatText("Penance: a right letter pays for that one ⛓️", false);
                }
            }
        }
        if (f.me.tithe > 0 && letter && letter === g.puzzle.solution[row][col] && !Game.isLocked(row, col) && (f.titheN = (f.titheN || 0) + 1) % 3 === 0) {
            const from = U.center(Game.cellEl(row, col));
            setTimeout(() => {
                if (!fightOn() || g.letters[row][col] !== letter || Game.isLocked(row, col)) return;
                const before = g.letters.map(r => [...r]);
                Game.setLetters([[row, col, ""]]);
                Game.markBossChanges(before);
                const empty = bossNextEmpty();
                Powers.fly(from, U.center(portraitEl() || panel), "🪙", "arc", 420, "#ffd06b").then(() => { if (fight === f && !f.over) { if (empty) write(empty); refreshDone(); drawFight(); } });
                floatText("Tithe: the angel took that letter 🪙", false);
            }, 60);
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
        if (Sound.musicPlaying && !["win", "lose"].includes(Sound.musicPlaying) && !Sound.musicPlaying.startsWith("story") && !fightOn() && !(fight && fight.switching)) Sound.stopMusic(1.5);
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
            if (gone.length) { gone.forEach(d => { const el = Game.cellEl(d.r, d.c); if (el) U.restart(el, "drip"); }); bossWipe(gone.map(d => [d.r, d.c, ""])); }
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
            if (loose.length) { const [r, c] = U.pick(loose); bossWipe([[r, c, ""]]); FX.shake(6, 300); }
        }
        if (f.me.minion > 0 && (f.minionAcc = (f.minionAcc || 0) + dt) >= 2.5) { f.minionAcc = 0; moveMinion(); }
        if (f.me.ascend > 0 && (f.ascAcc = (f.ascAcc || 0) + dt) >= 2) { f.ascAcc = 0; ascendOne(f, g); }   // Ascension: a letter floats up every 2s
        if (f.me.holylight > 0 && f.holy) {                                  // Holy Light wanders over your board
            const h = f.holy;
            h.a += (Math.random() - 0.5) * 2.4 * dt;
            h.x += Math.cos(h.a) * 0.09 * dt; h.y += Math.sin(h.a) * 0.09 * dt;
            if (h.x < 0.15 || h.x > 0.85) { h.a = Math.PI - h.a; h.x = U.clamp(h.x, 0.15, 0.85); }
            if (h.y < 0.15 || h.y > 0.85) { h.a = -h.a; h.y = U.clamp(h.y, 0.15, 0.85); }
        }
        if (f.bombAt && (f.bombAt.t -= dt) <= 0) {                           // the Cannonball goes off
            const { r, c } = f.bombAt, n = g.puzzle.size;
            f.bombAt = null;
            const hit = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].map(([dr, dc]) => [r + dr, c + dc])
                .filter(([r2, c2]) => r2 >= 0 && c2 >= 0 && r2 < n && c2 < n && g.puzzle.solution[r2][c2] !== "." && g.letters[r2][c2] && !Game.isLocked(r2, c2));
            hit.forEach(([r2, c2]) => { const el = Game.cellEl(r2, c2); if (el) U.restart(el, "scorched"); });
            bossWipe(hit.map(([r2, c2]) => [r2, c2, ""]));
            const at = Game.cellEl(r, c);
            if (at) { const p = U.center(at); FX.burst({ x: p.x, y: p.y, n: 50, colors: ["#ff9f1c", "#ff3d00", "#ffd23f", "#2b2233"], shape: "star", speed: [150, 500], gravity: 300, life: [0.5, 1], size: [4, 9] }); }
            Sound.custom(Powers.MOVES.carnival.find(m => m.kind === "bomb").sound);
            FX.shake(12, 500);
        }
        if (f.curse && (f.curse.t -= dt) <= 0) {                              // Scorpion Sting: no word in time, and the poison wipes yours
            f.curse = null;
            const cells = Game.cellsOf(currentMyEntry()).filter(([r, c]) => g.letters[r][c] && !Game.isLocked(r, c));
            cells.forEach(([r, c]) => { const el = Game.cellEl(r, c); if (el) U.restart(el, "scorched"); });
            bossWipe(cells.map(([r, c]) => [r, c, ""]));
            floatText("The poison wiped your word 🦂", false);
        }
        if (f.combo > 1 && !(f.buff.lucky > 0) && now - f.lastWordAt > COMBO_GAP) f.combo = 0;
        updateHp();
        if (f.pending) {
            f.windup -= dt;
            if (f.windup <= 0) attack();
        } else if (f.puzzle) {
            f.nextMove -= dt / (f.enraged ? RAGE_COOLDOWN : 1);            // enraged: the cooldown runs 35% shorter, from the moment it gets angry
            if (f.nextMove <= 0) { f.nextMove = f.th.every * (0.8 + Math.random() * 0.4); windUp(); }
        }
        applyMe();
        Game.markBossChanges(tickBefore);                   // letters that fell out, ran away, got eaten or blown up this tick
        drawFight();
    }, 100);

    function lose(why) {
        const f = fight;
        if (!f || f.over) return;
        // Extra Life: come back once (not when you give up yourself)
        if (f.extraLife && why === "boss") {
            f.extraLife = false;
            f.lifeUsed = true;
            for (let i = 0; i < 3; i++) { const last = f.done[f.done.length - 1]; if (last) wipe(Game.cellsOf(last), true); }
            f.word = null;
            refreshDone();
            notice("🕹️", "Extra Life", "The boss lost its last 3 words. The race goes on.", "good", 3400);
            Sound.custom(Powers.ABILITIES.find(a => a.kind === "extralife").sound);
            speak("WHAT? You're still here?!", 2400);
            drawFight();
            return;
        }
        f.over = true;
        f.pending = null;
        clearMe();
        clearWarn();
        countAttempt();
        const b = bossOf(f.world);
        const text = { boss: ["The boss finished its puzzle first.", `${b.name} Got There First`, "The boss solved its whole board before you. Block its attacks by finishing words, and save an ability for when it's close."],
            surrender: ["You gave up this fight.", "Retreat", "Every boss can be beaten. Try a different set of abilities from the shop."],
            reveal: ["You revealed the puzzle.", "Puzzle Revealed", "Every boss can be beaten. Try a different set of abilities from the shop."] }[why] || [];
        Game.endLoss({ title: why === "boss" ? `${b.name} Wins` : "Gave Up", text: text[0] });
        Sound.play("wrong");
        Sound.music("lose", { loop: false, v: 0.42, fade: 1 });           // game-over music
        FX.shake(10, 420);
        const sp = special(), tries = triesNow();
        const tryNote = sp === "daily" ? `Attempt ${tries} used. Your right words stay locked in for the next one. A win now scores ${tries * DAILY_TRY_COST} fewer points; your best of the day is kept.` : null;
        loseCard({ world: f.world, level: 5, kicker: sp ? `BOSS · ATTEMPT ${tries}` : why !== "boss" ? "BOSS FIGHT · GAVE UP" : "BOSS FIGHT · LOST", title: text[1], note: tryNote || text[2], art: bossSvg(f.world) });
        speak(why !== "boss" ? U.pick(["Running away?", "Ha! I knew it!", "Come back when you're ready!"]) : U.pick(["Better luck next time!", "Too slow!", "Ha! Rematch?"]), 5000);
        drawFight();
    }

    Bus.on("puzzle", ({ fresh, puzzle, phase }) => {
        if (phase) { showPanel(); drawItemBar(); return; }               // a boss's phase 2: the same fight goes on
        if (isBossLevel(puzzle) && U.view() === "level" && !(Game.state.solved && !fresh)) startFight(fresh);
        else if (isBossLevel(puzzle) && U.view() === "level") showPanel();
        else { hidePanel(); }
        drawItemBar();
    });
    // back on a boss's board without it being loaded again (Home or Stats and back): the same as a restored board
    Bus.on("resume", ({ puzzle }) => {
        if (isBossLevel(puzzle) && U.view() === "level" && !Game.state.solved) startFight(false);
        else if (isBossLevel(puzzle) && U.view() === "level") showPanel();
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
    // a level played before says it's a new puzzle, so a different board doesn't look like a mistake
    Bus.on("puzzle", ({ fresh, puzzle, phase }) => {
        const c = current();
        if (!fresh || phase || !c || c.special || !puzzle || puzzle.mode !== "campaign" || !playedBefore(c.world, c.level)) return;
        setTimeout(() => FX.toast({ icon: "🎲", kicker: "A FRESH PUZZLE", title: "New Board. New Clues.", ms: 5000 }), c.level === 5 ? 10000 : 300);
    });
    Bus.on("surrender", () => {
        if (fight && !fight.over && isBossLevel(Game.state.puzzle)) lose("reveal");     // Reveal Puzzle = a lost attempt, with the same Rematch / Return / New Boss card
    });

    // Phase 2: solving the boss's first puzzle doesn't end the fight. The boss powers up full screen,
    // you get a bigger puzzle (a Challenge grid instead of a normal 5x5, or a bigger Expert grid), and the boss starts
    // over on the board you just solved: a new race, a little faster and angrier every phase.
    // The next phase ALWAYS starts the moment you finish a board (if its puzzle is still
    // being made, the boss powers up and you wait for it; only if it can't be made at all does the fight end there).
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
        clearWarn();
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
                FX.toast({ icon: "⚠️", kicker: "BOSS FIGHT", title: "The Next Phase Couldn't Load", text: "You win this one as it stands.", ms: 4000 });
                Game.checkWin();
                return;
            }
            f.next[k] = Object.assign(pz, { mode: "campaign", world: f.world, level: 5, phase: k });
        }
        const p1 = Game.state.puzzle;
        Game.startPhase(f.next[k]);
        f.phase = k;
        f.switching = false;
        // every phase is angrier than the one before: it attacks more often (more so in the last phases), winds up
        // faster and hits harder
        f.th = { ...f.th, every: f.th.every * PHASE_PACE[k] / PHASE_PACE[k - 1], windup: Math.max(1.6, f.th.windup * 0.92), power: f.th.power * 1.08 };
        setBossPuzzle(p1, p1.seed + 7);                 // the boss's new board: the one you just solved
        f.boss = {};
        f.myLog = [];
        f.botTime = botTimeFor(d2, s2, c ? c.si : 0, k);
        f.drips = [];
        if (f.enraged) setEnraged(false);
        f.nextMove = Math.max(6, f.th.first * 0.6);
        Bosses.arena(f.world, f.id).classList.add("phase2");
        setChaos(k - 1);                                // the arena goes wilder with every phase
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
        clearWarn();
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
    // The mascot's lines in the campaign: it talks about the lesson you're
    // on, the boss you're fighting and the Everbook's story. null = use its normal line.
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
            if (event === "start" || event === "hello") {
                const f = map ? frontier() : null;
                if (f && isSecret(f.si)) return `The Cursed Angel is waiting in the rift. Next up: ${f.level === 5 ? bossOf(map[f.si].world).name : "Level " + f.level}.`;
                return f ? `${Worlds.byId[map[f.si].world].name}'s page of the Everbook is waiting. Next up: ${f.level === 5 ? bossOf(map[f.si].world).name : "Level " + f.level}.` : null;
            }
            return null;
        }
        if (v !== "level" || !data.playing) return null;
        const c = current();
        if (!c) return null;
        const boss = c.level === 5, lesson = lessonOf(c.si, c.level), b = bossOf(c.world);
        switch (event) {
            case "start": {
                const own = typeof Companions !== "undefined" ? (boss ? Companions.boss(c.world, "before") : Companions.level(c.world, c.level)) : null;
                const rule = boss && c.world === "rift" ? `${b.name} wants the whole Everbook. Solve your board before it solves its own, and watch for the rows its rays are aiming at!`
                    : riftLevel(Game.state.puzzle) ? "The angel is watching. Finish words to push the corruption back, and click away its tricks!"
                    : boss ? `${b.name} has the ${Worlds.byId[c.world].name} page. Solve your board before it solves its own, and finish a word fast when it winds up an attack!`
                    : lesson ? `Lesson: ${lesson.name}. ${lesson.tip}` : null;
                return c.special ? rule : [own, rule];
            }
            case "word": return boss ? (typeof Companions !== "undefined" && Math.random() < 0.5 && Companions.boss(c.world, "during")) || U.pick(["Pulling ahead!", "Push, push!", "Keep the combo going!", "It can't keep up!"]) : lesson && SKILL_WORD[lesson.id] ? U.pick(SKILL_WORD[lesson.id]) : null;
            case "idle": return boss ? U.pick(["Try an ability: keys 1, 2 and 3!", "A word finished fast blocks its next attack!", "Fill the short words first, they cross the long ones."]) : lesson ? `Remember the lesson: ${lesson.tip}` : null;
            case "wrong": return lesson && lesson.id === "clean" ? "Careful: only trust letters that work across AND down." : null;
            case "surrender": return boss ? [typeof Companions !== "undefined" && !c.special ? Companions.boss(c.world, "lose") : null, `${b.name} keeps the page for now. Try different abilities from the shop!`]
                : "Every pro has had a tough level. Try it again with the tip in mind.";
            case "win": {
                const cm = info && info.campaign;
                if (!cm) return null;
                if (cm.boss && cm.special) return cm.special === "daily" ? U.pick(["Today's boss is down! Nice racing.", "That's today's boss beaten. See you tomorrow!"]) : U.pick(["Boss beaten! Want another?", "Down it goes! Pick a new one?"]);
                if (cm.boss) {
                    const own = typeof Companions !== "undefined" ? Companions.boss(c.world, "win") : null;
                    return [own, cm.epilogue ? "The angel is beaten and the rift is closing. The Everbook is safe. For good." : cm.finished ? `The Everbook is whole again! Every word is back. You did it!${cm.secret ? " ...but what's that light in the sky?" : ""}` : `You won back the ${Worlds.byId[c.world].name} page! ${cm.newWorld ? `On to ${cm.newWorld.name}.` : ""}`];
                }
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
    // the Home screen: today's boss, under the Challenge in the Daily card
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
        chip.querySelector(".chip-sub").textContent = w ? w.name : "";
        const rec = Game.scores()[dayStr().replace(/-/g, "") + "-boss"];
        const tries = ((data.specials || {})["daily-" + dayStr() + "-tries"]) || 0;
        chip.querySelector(".chip-state").textContent = rec ? `✓ ${rec.points} pts  ·  ${"★".repeat(stars)}${"☆".repeat(3 - stars)}` : tries ? `Fight  ·  Attempt ${tries + 1}` : "Fight";
        chip.classList.toggle("done", !!stars);
    }
    $("#home-daily-boss") && $("#home-daily-boss").addEventListener("click", () => playSpecial("daily"));
    async function drawHomeCard() {
        drawHomeBoss();
        const el = $("#home-campaign");
        if (!el) return;
        try {
            await fetchMap();
        } catch (err) {
            el.textContent = U.describe(err).title === "You're Offline" ? "The campaign needs a connection." : "The campaign couldn't be loaded. Trying again…";
            let fired = false;
            const again = () => { if (fired) return; fired = true; removeEventListener("online", again); clearTimeout(timer); if (U.view() === "home") drawHomeCard(); };
            const timer = setTimeout(again, 20000);
            addEventListener("online", again);
            return;
        }
        const t = totals(), f = frontier(), w = Worlds.byId[map[f.si].world];
        el.innerHTML = "";
        const done = t.levels >= t.max;
        el.append(
            U.el("div", { class: "hc-bar", style: { "--k": (t.levels / t.max).toFixed(3) } }, U.el("i")),
            U.el("p", { class: "hc-line", text: `${t.levels} of ${t.max} levels  ·  ${t.stars} ★` }),
            U.el("a", { class: "btn primary", href: "#campaign", text: done ? "See the Map" : t.levels ? `Continue: ${w.name}, ${f.level === 5 ? "Boss" : "Level " + f.level}` : "Start the Campaign",
                onclick: () => { data.section = f.si; data.sel = f.level; data.playing = null; save(); } }));
    }

    // ---------------------------------------------------------------------------------------------
    // Buttons, keys and swipes on the stage
    // ---------------------------------------------------------------------------------------------
    // BETA helpers: a small strip on the stage. Unlock All opens every world and level
    // (data.betaUnlock), and every ability too, and can be switched back. Set BETA to false to hide it (kept for beta testing).
    const BETA = true;
    if (BETA) {
        const give = U.el("button", { type: "button", class: "btn small", text: "+500 Coins" });
        const open = U.el("button", { type: "button", class: "btn small" });
        const strip = U.el("div", { class: "cm-beta", role: "group", "aria-label": "Beta tools" }, U.el("b", { text: "Beta" }), give, open);
        const label = () => { open.textContent = data.betaUnlock ? "Lock Again" : "Unlock All"; open.classList.toggle("primary", !!data.betaUnlock); };
        const redraw = () => { if (onStage()) { drawBar(); drawStage(); drawPage(); drawStrip(); } drawItemBar(); };
        give.addEventListener("click", () => {
            data.coins = (data.coins || 0) + 500;
            save(); redraw(); Sound.play("coin");
            FX.toast({ icon: "🪙", kicker: "Beta", title: "+500 Coins", text: `You have ${data.coins} now.`, ms: 2200 });
        });
        open.addEventListener("click", () => {
            data.betaUnlock = !data.betaUnlock;
            // every ability opens too (unlockedAbility), each with its free uses if it has none yet
            if (data.betaUnlock) for (const a of ABILITIES) if (!(data.owned[a.id] > 0)) data.owned[a.id] = FREE_USES;
            save(); label();
            if (full) { map = visibleMap(); data.section = U.clamp(data.section || 0, 0, map.length - 1); const f = frontier(); data.shown = f.si + "-" + f.level; save(); }
            redraw(); Sound.play(data.betaUnlock ? "sparkle" : "select");
            FX.toast({ icon: data.betaUnlock ? "🔓" : "🔒", kicker: "Beta", title: data.betaUnlock ? "Everything Unlocked" : "Locked Again", text: data.betaUnlock ? "Every level and ability is open." : "Levels and abilities open as you clear them again.", ms: 2400 });
        });
        label();
        // on the page itself, not inside the campaign's view (which is zoomed with the rest of the app)
        document.body.appendChild(strip);
    }
    $("#cm-book").addEventListener("click", () => openBook("contents"));
    $("#cm-prev").addEventListener("click", () => go(data.section - 1));
    $("#cm-next").addEventListener("click", () => go(data.section + 1));
    // The story (story.js): the Everbook's pages, one per world, won back by beating its boss
    function storyPages() {
        return (map || []).filter(s => !s.secret).map(s => ({ world: s.world, name: Worlds.byId[s.world] ? Worlds.byId[s.world].name : s.world, boss: bossOf(s.world).name,
            color: bossOf(s.world).color, won: !!data.levels[keyOf(s.world, 5)] }));
    }
    // after a boss's first defeat: its page flies into the book (and the finale, once every page is back)
    async function storyAfterBoss(c, info) {
        const cm = info && info.campaign;
        if (!cm || !cm.boss || !cm.firstClear || !map) return;
        if (cm.epilogue) { await Story.epilogue(c, storyPages(), heroLook()); return; }       // the Cursed Angel: the end of the story
        const pages = storyPages();
        await Story.page(c, pages, cm.world);
        if (!c.skipped && pages.every(p => p.won)) { await c.wait(300); await Story.finale(c, pages); }
    }
    // keys: the arrows change world, 1-5 pick a stop, Enter plays it, B opens the book
    addEventListener("keydown", e => {
        if (atlasOn) { if (e.key === "Escape" || e.key === "m" || e.key === "M") { e.preventDefault(); closeAtlas(); } return; }
        if (!onStage() || diving || e.ctrlKey || e.metaKey || e.altKey || FX.playing || document.querySelector("#overlay .results, .ask-modal, .hm-modal") || e.target.closest("input, textarea, select")) return;
        if (e.key === "ArrowLeft") { e.preventDefault(); go(data.section - 1); }
        else if (e.key === "ArrowRight") { e.preventDefault(); go(data.section + 1); }
        else if (/^[1-5]$/.test(e.key) && LV(data.section).includes(+e.key)) pickLevel(+e.key);
        else if (e.key === "Enter" && !e.target.closest("button, a") && unlocked(data.section, data.sel)) dive(data.sel);
        else if (e.key === "m" || e.key === "M") openAtlas();
        else if (e.key === "b" || e.key === "B") openBook("contents");
        else if (e.key === "Escape") pageEl.classList.remove("up");
    });
    // a phone: swipe the stage to change world; tap the page's top to pull it up or let it down
    let touchAt = null;
    stage.addEventListener("touchstart", e => { touchAt = [e.touches[0].clientX, e.touches[0].clientY]; }, { passive: true });
    stage.addEventListener("touchend", e => {
        if (!touchAt || !map) return;
        const dx = e.changedTouches[0].clientX - touchAt[0], dy = e.changedTouches[0].clientY - touchAt[1];
        touchAt = null;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(data.section + (dx < 0 ? 1 : -1));
    });
    stage.addEventListener("click", e => { if (e.target === stage || e.target === stopsEl) pageEl.classList.remove("up"); });
    pageEl.addEventListener("click", e => {
        if (phone.matches && (e.target === pageEl || e.target.closest(".dk-title, .dk-folio, .dk-kicker, .dk-facts"))) pageEl.classList.toggle("up");
    });
    // the island turns a little with the pointer (eased, so it glides)
    const lean = { x: 0, y: 0, tx: 0, ty: 0, raf: 0 };
    function leanStep() {
        lean.x += (lean.tx - lean.x) * 0.09; lean.y += (lean.ty - lean.y) * 0.09;
        stage.style.setProperty("--lx", lean.x.toFixed(4));
        stage.style.setProperty("--ly", lean.y.toFixed(4));
        lean.raf = Math.abs(lean.tx - lean.x) + Math.abs(lean.ty - lean.y) > 0.002 && U.view() === "campaign" ? requestAnimationFrame(leanStep) : 0;
    }
    const leanTo = (x, y) => { lean.tx = x; lean.ty = y; if (!lean.raf) lean.raf = requestAnimationFrame(leanStep); };
    stage.addEventListener("pointermove", e => {
        if (e.pointerType !== "mouse" || U.motion() !== "full") return;
        const r = stage.getBoundingClientRect();
        leanTo((e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5);
    });
    stage.addEventListener("pointerleave", () => leanTo(0, 0));
    // the page is a sheet on a phone
    phone.addEventListener("change", () => { if (onStage()) { drawStage(); drawPage(); } });

    return {
        onView, showMap, play, playSpecial, heroLook, hero: () => (data.hero ? heroLook() : null), biome, prop: (world, r) => PROPS[biome(world).prop](r), editHero, secretOpen, secretEarned, beatenBosses, backToMode, ready: fetchMap, storyPages, storyAfterBoss, playIntro: () => FX.cinematic(c => Story.intro(c, storyPages())), nextPhase, next, slotName, apiUrl, titles, cardInfo, onWin, bestLine, bossFinale, drawHomeCard, bossSvg, openShop,
        isBossLevel, mascotLine, dailyTries, pageWon: w => !!(data.levels && data.levels[keyOf(w, 5)]), abilities: ABILITIES, items: ITEMS, unlockedAbilities, useItem, useAbility,
        get playing() { return data.playing; }, get fight() { return fight; }
    };
})();
