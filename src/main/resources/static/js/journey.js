// The journey: the scene behind a campaign level (the play stage, levels 1-4). You're travelling through the level's
// world toward the boss, who waits on the horizon holding its page of the Everbook.
//
//   - the land scrolls past sideways in layers (far hills, scenery, the road, things close to the camera), always
//     moving, faster while you type; your hero travels the way that world is travelled (MODES: on foot along a road,
//     a mine cart on rails, a submarine, a sled, a boat, a balloon, a flying carpet, a hoverboard, a flying book,
//     a rocket through open space with no ground at all...)
//   - every finished word throws you forward: a surge of speed lines from the page, and its letters fly to the page
//     as light
//   - the boss and the page come closer as the squares fill (--solve on .jr, 0 to 1, set by game.js)
//   - the Void's shadow trails behind you with torn pages in it, and falls back as you solve
//   - loose letters blow across the sky
// It is only a scene: nothing here can lose the level, and nothing tells you whether a letter is right.

const Journey = (() => {
    const root = document.documentElement, view = document.getElementById("game-view");
    const TILE = 2600;                                     // px: a layer's scenery repeats after this far
    const el = U.el("div", { class: "jr", "aria-hidden": "true", hidden: true });
    view.prepend(el);
    let world = "", mode = null, layers = [], goal = null, hero = null, rider = null, zoom = null, streaks = null, sg = null;
    let raf = 0, last = 0, x = 0, boost = 0, surge = 0, lines = [], halfSaid = false, heroFor = "";
    const TAU = Math.PI * 2, INK = "#2b2233";

    // How each world is travelled. ride: what the hero travels in or on (drawn over the hero, in units where the hero
    // is the 100x100 box at 40,80); ground: what the road is; fly: the hero is up in the air ("high" or "low");
    // open: there's no land at all (space), so the scenery drifts at every height and stars streak by.
    const cart = (body, trim) => `<rect x="42" y="148" width="96" height="30" rx="7" fill="${body}" stroke="${INK}" stroke-width="3"/><rect x="42" y="148" width="96" height="8" rx="4" fill="${trim}"/>` +
        [62, 118].map(cx => `<circle cx="${cx}" cy="184" r="10" fill="${INK}"/><circle cx="${cx}" cy="184" r="4" fill="${trim}"/>`).join("");
    const starPts = (cx, cy, R, r) => Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r : R; return (cx + Math.cos(a) * q).toFixed(1) + "," + (cy + Math.sin(a) * q).toFixed(1); }).join(" ");
    const RIDES = {
        sub: `<circle cx="90" cy="126" r="54" fill="rgba(190,235,255,.3)" stroke="#e8f8ff" stroke-width="3"/><path d="M26 150Q90 196 154 150Q150 186 90 190Q30 186 26 150Z" fill="#ffc93a" stroke="${INK}" stroke-width="3"/>` +
            [60, 90, 120].map((cx, i) => `<circle cx="${cx}" cy="${i === 1 ? 177 : 171}" r="6" fill="#fff" stroke="${INK}" stroke-width="2"/>`).join("") +
            `<g class="jr-spin" style="transform-origin:20px 162px"><path d="M20 146v32M8 162h24" stroke="${INK}" stroke-width="5" stroke-linecap="round"/></g><path d="M124 76v-18h14" fill="none" stroke="#ffc93a" stroke-width="6" stroke-linecap="round"/>`,
        sled: `<path d="M34 188h100q16 0 18-16" fill="none" stroke="#7a4a2a" stroke-width="5" stroke-linecap="round"/><rect x="44" y="173" width="84" height="8" rx="3" fill="#c0392b" stroke="${INK}" stroke-width="2.5"/><path d="M56 181v7M116 181v7" stroke="#7a4a2a" stroke-width="4"/>`,
        boat: `<path d="M30 156h120l-16 30H48z" fill="#b9773e" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M32 157h116" stroke="#f2d2a2" stroke-width="5"/>`,
        balloon: `<path d="M64 150L58 76M116 150l6-74" stroke="${INK}" stroke-width="2"/><ellipse cx="90" cy="38" rx="46" ry="42" fill="#ff5c6c" stroke="${INK}" stroke-width="3"/><path d="M90-4c-18 14-18 70 0 84c18-14 18-70 0-84z" fill="#ffd23f"/><rect x="60" y="150" width="60" height="30" rx="5" fill="#b9773e" stroke="${INK}" stroke-width="3"/><path d="M60 160h60M60 170h60" stroke="#7a4a2a" stroke-width="2"/>`,
        carpet: `<path d="M26 176q16-9 32 0t32 0t32 0t32 0v10q-16 9-32 0t-32 0t-32 0t-32 0z" fill="#8e44ad" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M34 181q12-6 24 0t24 0t24 0t24 0t16 0" fill="none" stroke="#ffd23f" stroke-width="3"/>`,
        board: `<ellipse cx="90" cy="198" rx="50" ry="7" fill="#2bf0ff" opacity=".4"/><rect x="38" y="175" width="104" height="10" rx="5" fill="#ff2bd6" stroke="#2bf0ff" stroke-width="3"/>`,
        book: `<path d="M90 192L34 178v-8l56 12 56-12v8z" fill="#7a3b2e" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M90 182L38 170v-6l52 12 52-12v6z" fill="#f6ecd2" stroke="${INK}" stroke-width="2"/>`,
        rocket: `<g transform="translate(0 16)"><g class="jr-flick" style="transform-origin:24px 158px"><path d="M24 144Q-22 158 24 172Q8 158 24 144Z" fill="#ffb21e"/><path d="M26 150Q0 158 26 166Z" fill="#fff3c4"/></g><path d="M24 138l-14-16h26zM24 178l-14 16h26z" fill="#e2483c" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
            `<path d="M24 136h96q40 6 54 22q-14 16-54 22H24z" fill="#f4f6fb" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M134 138q28 6 40 20q-12 14-40 20z" fill="#e2483c" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M46 136a44 54 0 0 1 88 0z" fill="rgba(190,235,255,.28)" stroke="#e8f8ff" stroke-width="3"/></g>`,
        star: `<path d="M62 186H4" stroke="#ffe7a3" stroke-width="7" stroke-linecap="round" opacity=".55"/><path d="M70 196H24" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".5"/><polygon points="${starPts(90, 186, 32, 14)}" fill="#ffd06b" stroke="#fff3c4" stroke-width="3" stroke-linejoin="round"/>`
    };
    const MODES = {
        paper: { ground: "road" }, garden: { ground: "road" }, squirrel: { ground: "road" },
        candy: { ground: "rail", ride: cart("#ff6fb4", "#ffffff") },
        ocean: { ground: "none", fly: "high", ride: RIDES.sub, bubbles: true },
        snow: { ground: "snow", ride: RIDES.sled },
        rain: { ground: "water", ride: RIDES.boat },
        sky: { ground: "none", fly: "high", ride: RIDES.balloon },
        desert: { ground: "none", fly: "low", ride: RIDES.carpet },
        carnival: { ground: "rail", ride: cart("#e2483c", "#ffd23f") },
        arcade: { ground: "grid", fly: "low", ride: RIDES.board },
        library: { ground: "none", fly: "high", ride: RIDES.book },
        robot: { ground: "rail", ride: cart("#8a95a3", "#ff7a1a") },
        volcano: { ground: "lava", ride: cart("#5a3a34", "#ff8a2a") },
        space: { ground: "none", fly: "high", ride: RIDES.rocket, open: true },
        rift: { ground: "none", fly: "high", ride: RIDES.star, open: true }
    };

    // a strip of hills that joins up with itself after TILE (so the layer can go round and round)
    function hills(base, amp, seed, fill, opacity = 1) {
        let d = `M0 400`;
        for (let px = 0; px <= TILE; px += 26) {
            const t = px / TILE * TAU, y = base - amp * (0.55 * Math.sin(t * 3 + seed) + 0.3 * Math.sin(t * 7 + seed * 2.1) + 0.15 * Math.sin(t * 13 + seed * 0.7));
            d += `L${px} ${y.toFixed(1)}`;
        }
        return `<svg class="jr-hills" viewBox="0 0 ${TILE} 400" preserveAspectRatio="none" style="opacity:${opacity}"><path d="${d}L${TILE} 400Z" fill="${fill}"/></svg>`;
    }
    function layer(cls, k, parts) {
        const half = () => U.el("div", { class: "jr-half", style: { width: TILE + "px" }, html: parts });
        const run = U.el("div", { class: "jr-run", style: { width: TILE * 2 + "px" } }, half(), half());
        layers.push({ run, k });
        return U.el("div", { class: "jr-layer " + cls }, run);
    }
    // scenery for a layer: n of the world's own pieces along the strip
    function scenery(r, n, width, bottom, spread = 0) {
        let out = "";
        for (let i = 0; i < n; i++) {
            const px = (i + 0.15 + r() * 0.7) / n * TILE, w = width * (0.75 + r() * 0.6), at = mode.open ? r() * 92 : bottom + (r() - 0.5) * spread;
            out += `<svg class="jr-prop" viewBox="-40 -84 80 88" style="left:${px.toFixed(0)}px;bottom:${at.toFixed(1)}%;width:${w.toFixed(0)}px">${Campaign.prop(world, r)}</svg>`;
        }
        return out;
    }
    // stars for a layer in open space
    function stars(r, n) {
        let out = "";
        for (let i = 0; i < n; i++) out += `<i class="jr-star" style="left:${(r() * TILE).toFixed(0)}px;top:${(r() * 100).toFixed(1)}%;scale:${(0.5 + r() * 1.6).toFixed(2)}"></i>`;
        return out;
    }
    function build(id) {
        world = id;
        mode = MODES[id] || MODES.paper;
        layers = [];
        el.className = "jr jr-g-" + mode.ground + (mode.fly ? " jr-fly jr-" + mode.fly : "") + (mode.open ? " jr-open" : "") + (mode.ride ? " jr-riding" : "");
        const b = Campaign.biome(id), r = U.rng(U.hash(id) % 9973 + 11), boss = Bosses.info(id);
        el.style.setProperty("--ground", b.ground);
        el.style.setProperty("--hill", b.hill);
        el.style.setProperty("--path", b.path);
        // loose letters blowing across the sky, torn out of the book
        const sky = U.el("div", { class: "jr-sky" });
        for (let i = 0; i < 12; i++) sky.append(U.el("i", { class: "jr-letter", text: String.fromCharCode(65 + Math.floor(r() * 26)),
            style: { "--t": (4 + r() * 46).toFixed(0) + "%", "--d": (16 + r() * 22).toFixed(1) + "s", "--dl": (-r() * 38).toFixed(1) + "s", "--s": (0.7 + r() * 1.3).toFixed(2), "--spin": (r() < 0.5 ? -1 : 1) * (180 + r() * 360) + "deg" } }));
        // the boss on the horizon with the page it holds, and its beam of light
        goal = U.el("div", { class: "jr-goal" }, U.el("i", { class: "jr-crag" }), U.el("div", { class: "jr-boss", html: Bosses.svg(id) }), U.el("span", { class: "ws-leaf" }));
        // the hero, and what it travels in or on (drawn over it)
        rider = U.el("div", { class: "jr-rider" });
        hero = U.el("div", { class: "jr-hero" }, rider);
        if (mode.ride) hero.insertAdjacentHTML("beforeend", `<svg class="jr-ride" viewBox="0 0 180 205" aria-hidden="true">${mode.ride}</svg>`);
        if (mode.bubbles) for (let i = 0; i < 5; i++) hero.append(U.el("i", { class: "jr-bubble", style: { "--dl": (-i * 0.5) + "s", "--x": (i * 9 - 10) + "px" } }));
        const land = (base, amp, seed, fill, opacity) => (mode.open ? "" : hills(base, amp, seed, fill, opacity));
        heroFor = "";
        zoom = U.el("div", { class: "jr-zoom" },
            layer("far", 0.1, land(120, 70, 1.3, b.hill, 0.42) + (mode.open ? stars(r, 90) : "")),
            goal,
            layer("mid", 0.3, land(215, 42, 4.1, b.hill) + scenery(r, 11, 48, 44, 5)),
            layer("near", 1, land(292, 9, 2.2, b.ground) + `<i class="jr-road"></i>` + scenery(r, 9, 96, 23, 3) + (mode.open ? stars(r, 40) : "")),
            hero);
        streaks = U.el("canvas", { class: "jr-streaks" });
        sg = streaks.getContext("2d");
        // the Void's shadow behind you, with pages it has torn out
        const shadow = U.el("div", { class: "jr-shadow" });
        for (let i = 0; i < 7; i++) shadow.append(U.el("i", { class: "jr-page", style: { "--t": (8 + r() * 78).toFixed(0) + "%", "--l": (2 + r() * 20).toFixed(0) + "%", "--d": (5 + r() * 6).toFixed(1) + "s", "--dl": (-r() * 8).toFixed(1) + "s" } }));
        el.replaceChildren(sky, U.el("div", { class: "jr-band" }, zoom), streaks, U.el("div", { class: "jr-band jr-front" }, layer("front", 2.1, scenery(r, 3, 230, -9))), shadow);
    }
    function drawHero() {
        const look = Campaign.hero();
        hero.hidden = !look;
        if (!look) return;
        const key = JSON.stringify(look);
        if (key !== heroFor) { heroFor = key; rider.innerHTML = Hero.svg(look); }
    }

    // (whether CSS hides the scene is read at most twice a second: reading it every frame restyled the whole page)
    let shownAt = 0, shownCss = false;
    const showing = () => {
        if (el.hidden || root.dataset.view !== "game" || view.hidden) return false;
        const now = performance.now();
        if (now - shownAt > 500) { shownAt = now; shownCss = getComputedStyle(el).display !== "none"; }
        return shownCss;
    };
    function frame(now) {
        raf = 0;
        if (!showing() || document.hidden) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        boost *= Math.exp(-dt * 1.5);
        x += (30 + boost) * dt;
        for (const l of layers) l.run.style.transform = `translate3d(${(-((x * l.k) % TILE)).toFixed(1)}px,0,0)`;
        hero.classList.toggle("run", boost > 70);
        if (surge > 0) drawSurge(dt);
        raf = requestAnimationFrame(frame);
    }
    function wake() {
        if (raf || U.motion() === "still" || !showing()) return;
        last = performance.now();
        raf = requestAnimationFrame(frame);
    }
    const goalSpot = () => { const r = goal.querySelector(".ws-leaf").getBoundingClientRect(), b = el.getBoundingClientRect(); return { x: r.left + r.width / 2 - b.left, y: r.top + r.height / 2 - b.top, sx: r.left + r.width / 2, sy: r.top + r.height / 2 }; };

    // The surge: a finished word throws you forward. Lines of light rush out from the page, and the land swells.
    function startSurge() {
        if (U.motion() !== "full") return;
        const g = goalSpot(), b = el.getBoundingClientRect();
        streaks.width = b.width; streaks.height = b.height;
        lines = Array.from({ length: 80 }, () => ({ a: Math.random() * TAU, r: 30 + Math.random() * 120, v: 500 + Math.random() * 1300, len: 40 + Math.random() * 150, w: 1 + Math.random() * 2.4 }));
        surge = 1;
        streaks.dataset.x = g.x; streaks.dataset.y = g.y;
        zoom.style.transformOrigin = `${g.x.toFixed(0)}px ${(g.y - (b.height - zoom.parentElement.getBoundingClientRect().height)).toFixed(0)}px`;
        zoom.animate([{ scale: 1 }, { scale: 1.1, offset: 0.28 }, { scale: 1 }], { duration: 1150, easing: "cubic-bezier(.2,.8,.3,1)" });
    }
    function drawSurge(dt) {
        surge -= dt / 1.05;
        const gx = +streaks.dataset.x, gy = +streaks.dataset.y;
        sg.clearRect(0, 0, streaks.width, streaks.height);
        if (surge <= 0) { surge = 0; return; }
        sg.lineCap = "round";
        for (const l of lines) {
            l.r += l.v * dt;
            const c = Math.cos(l.a), s = Math.sin(l.a);
            sg.strokeStyle = `rgba(255, 238, 180, ${(surge * 0.75).toFixed(3)})`;
            sg.lineWidth = l.w;
            sg.beginPath();
            sg.moveTo(gx + c * l.r, gy + s * l.r);
            sg.lineTo(gx + c * (l.r + l.len * (0.4 + (1 - surge))), gy + s * (l.r + l.len * (0.4 + (1 - surge))));
            sg.stroke();
        }
    }
    // a finished word's letters leave the board as light and fly to the page
    function wisps(cells) {
        if (U.motion() !== "full") return;
        const g = goalSpot(), letters = Game.state.letters;
        cells.forEach(([r, c], i) => {
            const cell = Game.cellEl(r, c);
            if (!cell || !letters[r] || !letters[r][c]) return;
            const from = cell.getBoundingClientRect(), fx = from.left + from.width / 2, fy = from.top + from.height / 2;
            const w = U.el("span", { class: "jr-wisp", text: letters[r][c], style: { left: fx + "px", top: fy + "px" } });
            document.body.append(w);
            const dx = g.sx - fx, dy = g.sy - fy;
            w.animate([{ translate: "0 0", scale: 1, opacity: 0 }, { translate: `${dx * 0.3}px ${dy * 0.3 - 90}px`, scale: 1.25, opacity: 1, offset: 0.3 }, { translate: `${dx}px ${dy}px`, scale: 0.3, opacity: 0.9 }],
                { duration: 950, delay: i * 70, easing: "cubic-bezier(.4,0,.6,1)", fill: "both" }).onfinish = () => { w.remove(); U.restart(goal, "got"); };
        });
    }
    // the boss has something to say now and then
    const LINES = ["Stay back!", "That page is mine!", "You'll never read it!", "Stop writing!", "Not one more word!"];
    function bossSay(text) {
        if (!goal || goal.querySelector(".jr-say")) return;
        const say = U.el("span", { class: "jr-say", text });
        goal.append(say);
        setTimeout(() => say.remove(), 2900);
    }

    function show(id) {
        if (world !== id || !el.firstChild) build(id);
        drawHero();
        halfSaid = false;
        el.hidden = false;
        el.classList.remove("arrived");
        view.classList.add("jr-on");
        wake();
    }
    function hide() {
        el.hidden = true;
        view.classList.remove("jr-on");
    }
    // which puzzles have a journey: a campaign level that isn't a boss fight
    function sync({ puzzle } = {}) {
        const p = puzzle || Game.state.puzzle;
        if (p && p.mode === "campaign" && !p.special && !Campaign.isBossLevel(p) && p.world && Worlds.byId[p.world]) show(p.world);
        else hide();
    }
    Bus.on("puzzle", sync);
    Bus.on("resume", sync);
    Bus.on("type", () => { if (el.hidden) return; boost = Math.min(340, boost + 95); wake(); });
    Bus.on("word", ({ cells }) => {
        if (el.hidden || !showing()) return;
        boost = Math.min(520, boost + 260);
        wake();
        startSurge();
        wisps(cells);
        U.restart(hero, "hop");
        // (how many squares are FILLED, never how many are right)
        const filled = Game.state.letters.flat().filter(Boolean).length, half = filled / Math.max(1, Game.progress().total) >= 0.5;
        if (half && !halfSaid) { halfSaid = true; setTimeout(() => bossSay("You're getting too close!"), 700); }
        else if (Math.random() < 0.3) setTimeout(() => bossSay(U.pick(LINES)), 700);
    });
    Bus.on("win", () => { if (el.hidden) return; el.classList.add("arrived"); boost = 600; wake(); startSurge(); });
    addEventListener("hashchange", () => setTimeout(wake, 60));
    document.addEventListener("visibilitychange", wake);

    return { sync };
})();
