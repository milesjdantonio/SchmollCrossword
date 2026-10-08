// Worlds: the look of the whole game. Each world (js/worlds/*.js) registers itself with Worlds.register({...}):
//
//   id, name, tagline, icon        how it shows up in the world picker
//   modes                          the light/dark modes it supports, e.g. ["light", "dark"] or ["dark"]
//   scene(W, H, opts)              its animated background: returns { draw(ctx, t, dt, input), resize(W, H) }
//   sounds                         its versions of the sound effects (see sound.js)
//   music                          its ambient loop { bpm, tick(step, t) }
//   mascot                         its guide character { name, draw(ctx, state) }, see mascot.js
//   lines                          the mascot's lines in this world, by event
//   board                          decorations on the board: { update, type, wordDone, restoreSolved, clear, attach }
//   titleCard(c, info)             the card shown when a puzzle starts (a cinematic, see FX.cinematic)
//   celebrate(c, info)             the win cinematic
//   introFlourish(stage, c)        extra flair during the start-up intro
//   transition                     its full-screen wipe style (see FX.transition)
//
// Worlds.use(id) switches worlds; the background canvas behind the page draws the current world's scene.

const Worlds = (() => {
    const list = [], byId = {};
    let current = null, scene = null;
    const cv = document.getElementById("world-bg"), g = cv.getContext("2d");
    let W = 0, H = 0, dpr = 1, raf = 0, timer = 0, last = 0, t = 0;
    const input = { px: 0, py: 0, tx: 0, ty: 0, W: 0, H: 0, scroll: 0 };

    addEventListener("pointermove", e => {
        input.tx = e.clientX / innerWidth * 2 - 1;
        input.ty = e.clientY / innerHeight * 2 - 1;
    }, { passive: true });

    function register(world) {
        list.push(world);
        byId[world.id] = world;
    }

    // The light/dark mode actually used: the player's choice if the world supports it, else the world's own
    function modeFor(world) {
        const want = Settings.get("theme");
        return world.modes.includes(want) ? want : world.modes[0];
    }

    function use(id, { force = false } = {}) {
        const world = byId[id] || byId.paper || list[0];
        if (world === current && scene && !force) return;
        const changed = world !== current;
        if (current && changed && current.board && current.board.clear) current.board.clear();
        current = world;
        document.documentElement.dataset.world = world.id;
        document.documentElement.dataset.theme = modeFor(world);
        build();
        if (changed) Bus.emit("world", world);
    }

    function size() {
        dpr = Math.min(devicePixelRatio || 1, U.motion() === "lite" ? 1 : 1.5);
        W = innerWidth;
        H = innerHeight;
        cv.width = Math.round(W * dpr);
        cv.height = Math.round(H * dpr);
        input.W = W;
        input.H = H;
    }

    function build() {
        size();
        try {
            scene = current.scene(W, H, { theme: document.documentElement.dataset.theme });
        } catch (err) {
            console.error("scene", err);
            scene = null;
        }
        t = 0;
        // warm up particle systems so the first frame isn't empty
        if (scene) for (let i = 0; i < 30; i++) { t += 0.05; scene.draw(g, t, 0.05, input); }
        loop();
    }

    function loop() {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
        last = performance.now();
        raf = requestAnimationFrame(frame);
    }

    function frame(now) {
        raf = 0;
        if (!scene) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        t += dt;
        input.px += (input.tx - input.px) * Math.min(1, dt * 2.5);
        input.py += (input.ty - input.py) * Math.min(1, dt * 2.5);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        try {
            scene.draw(g, t, dt, input);
        } catch (err) {
            console.error("scene draw", err);
            return;
        }
        const m = U.motion();
        if (m === "still" || document.hidden) return;          // a single still frame
        if (m === "lite") timer = setTimeout(() => { raf = requestAnimationFrame(frame); }, 30);
        else raf = requestAnimationFrame(frame);
    }

    document.addEventListener("visibilitychange", () => { if (!document.hidden) loop(); });
    addEventListener("resize", U.debounce(() => {
        size();
        if (scene && scene.resize) scene.resize(W, H);
        else if (current) build();
        loop();
    }, 150));
    Settings.on(key => {
        if (key === "design") use(Settings.get("design"));
        if (key === "theme" && current) use(current.id, { force: true });
        if (key === "effects" && current) build();
    });

    // Call one of the current world's board hooks, if it has it
    function board(name, ...args) {
        const b = current && current.board;
        if (b && typeof b[name] === "function") {
            try { return b[name](...args); } catch (err) { console.error("board", name, err); }
        }
    }

    // Draw one still frame of a world's scene onto a small canvas (the world picker's previews)
    function preview(canvas, id, theme) {
        const world = byId[id];
        if (!world) return null;
        const c = canvas.getContext("2d"), r = window.devicePixelRatio > 1 ? 2 : 1;
        const w = canvas.clientWidth || 240, h = canvas.clientHeight || 140;
        canvas.width = w * r;
        canvas.height = h * r;
        const mode = theme && world.modes.includes(theme) ? theme : world.modes[0];
        const sc = world.scene(w, h, { theme: mode, preview: true });
        const inp = { px: 0, py: 0, W: w, H: h };
        let tt = 0;
        c.setTransform(r, 0, 0, r, 0, 0);
        for (let i = 0; i < 40; i++) { tt += 0.05; sc.draw(c, tt, 0.05, inp); }
        // returns a function that animates it (used while the preview is hovered)
        return {
            step(dt) { tt += dt; c.setTransform(r, 0, 0, r, 0, 0); sc.draw(c, tt, dt, inp); }
        };
    }

    return {
        register, use, board, preview, modeFor, list, byId,
        get current() { return current; },
        get time() { return t; }
    };
})();
