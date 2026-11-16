// The journey: the scene behind a campaign level (the play stage, levels 1-4). You're travelling through the level's
// world toward the boss, who waits on the horizon holding its page of the Everbook.
//
//   - the land scrolls past sideways in layers (far hills, scenery, the road, things close to the camera), always
//     moving, faster while you type; your hero walks the road
//   - every finished word throws you forward: a surge of speed lines from the page, and its letters fly to the page
//     as light
//   - the boss and the page come closer as the squares fill (--solve on the page's root, 0 to 1, set by game.js)
//   - the Void's shadow trails behind you with torn pages in it, and falls back as you solve
//   - loose letters blow across the sky
// It is only a scene: nothing here can lose the level, and nothing tells you whether a letter is right.

const Journey = (() => {
    const root = document.documentElement, view = document.getElementById("game-view");
    const TILE = 2600;                                     // px: a layer's scenery repeats after this far
    const el = U.el("div", { class: "jr", "aria-hidden": "true", hidden: true });
    view.prepend(el);
    let world = "", layers = [], goal = null, hero = null, zoom = null, streaks = null, sg = null;
    let raf = 0, last = 0, x = 0, boost = 0, surge = 0, lines = [], halfSaid = false, heroFor = "";
    const TAU = Math.PI * 2;

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
            const px = (i + 0.15 + r() * 0.7) / n * TILE, w = width * (0.75 + r() * 0.6);
            out += `<svg class="jr-prop" viewBox="-40 -84 80 88" style="left:${px.toFixed(0)}px;bottom:${(bottom + (r() - 0.5) * spread).toFixed(1)}%;width:${w.toFixed(0)}px">${Campaign.prop(world, r)}</svg>`;
        }
        return out;
    }
    function build(id) {
        world = id;
        layers = [];
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
        hero = U.el("div", { class: "jr-hero" });
        heroFor = "";
        zoom = U.el("div", { class: "jr-zoom" },
            layer("far", 0.1, hills(120, 70, 1.3, b.hill, 0.42)),
            goal,
            layer("mid", 0.3, hills(215, 42, 4.1, b.hill) + scenery(r, 11, 48, 44, 5)),
            layer("near", 1, hills(292, 9, 2.2, b.ground) + `<i class="jr-road"></i>` + scenery(r, 9, 96, 23, 3)),
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
        if (key !== heroFor) { heroFor = key; hero.innerHTML = Hero.svg(look); }
    }

    const showing = () => !el.hidden && root.dataset.view === "game" && !view.hidden && getComputedStyle(el).display !== "none";
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
                { duration: 950, delay: i * 70, easing: "cubic-bezier(.4,0,.6,1)", fill: "both" }).onfinish = () => { w.remove(); goal.classList.remove("got"); void goal.offsetWidth; goal.classList.add("got"); };
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
        hero.classList.remove("hop"); void hero.offsetWidth; hero.classList.add("hop");
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
