// Worlds: the look of the whole game. Each world (js/worlds/*.js) registers itself with Worlds.register({...}):
//
//   id, name, tagline, icon        how it shows up in the world picker
//   modes                          the light/dark modes it supports, e.g. ["light", "dark"] or ["dark"]
//   scene(W, H, opts)              its animated background: returns { draw(ctx, t, dt, input), resize(W, H) }
//   sounds                         its versions of the sound effects (see sound.js)
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
        const dt = U.clamp((now - last) / 1000, 0, 0.05);       // a frame can be stamped just before "last": never step backwards
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

    // A board decoration layer several worlds share: a little picture ("mark") in a corner of each filled square
    // and something along each finished word, drawn in one <svg> over the board.
    //   id                 CSS class prefix: the layer is "deco-layer ID-layer", the board gets "ID-solved"
    //   mark(rnd)          SVG markup centered on 0,0, in square units (a square is 1 wide); rnd(k) is seeded
    //   word(entry, cells, rnd, group, across)   draws a finished word's decoration into group
    //   type(cell), wordDone(entry, cells)       particle effects
    function decoBoard({ id, mark, word, type, wordDone, corners = [[0.8, 0.22], [0.8, 0.79], [0.21, 0.8]] }) {
        let layer = null, gW, gM, marks = new Map(), words = new Map(), seed = 1, size = 5, quiet = true, boardRef = null;
        const rnd = (...k) => { let h = seed; for (const v of k) { h = Math.imul(h ^ v, 2654435761); h ^= h >>> 13; } return (h >>> 0) / 4294967296; };
        function build(game, boardEl) {
            if (layer) layer.remove();
            size = game.puzzle.size;
            seed = U.hash(game.puzzle.seed + game.puzzle.mode + id);
            boardRef = boardEl;
            layer = U.svg("svg", { class: `deco-layer ${id}-layer`, viewBox: `0 0 ${size} ${size}`, preserveAspectRatio: "none", "aria-hidden": "true" });
            boardEl.appendChild(layer);
            gW = U.svg("g", {}, layer);
            gM = U.svg("g", {}, layer);
            marks = new Map();
            words = new Map();
        }
        function addMark(r, c, grow) {
            const [ox, oy] = corners[Math.floor(rnd(r, c, 2) * corners.length)];
            const x = c + ox + (rnd(r, c, 3) - 0.5) * 0.05, y = r + oy + (rnd(r, c, 4) - 0.5) * 0.05, rot = (rnd(r, c, 5) - 0.5) * 40;
            const outer = U.svg("g", { transform: `translate(${x.toFixed(3)} ${y.toFixed(3)}) rotate(${rot.toFixed(1)})`, class: "deco-mark" + (grow ? " pop" : "") }, gM);
            U.svg("g", { class: "deco-mark-in" }, outer).innerHTML = mark(k => rnd(r, c, 10 + k));
            return outer;
        }
        function update(game, boardEl) {
            if (!layer || !boardEl.contains(layer) || size !== game.puzzle.size) { build(game, boardEl); quiet = true; }
            const grow = !quiet && U.motion() !== "still";
            quiet = false;
            const n = game.puzzle.size;
            if (mark) {
                const want = new Set();
                for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
                    if (!game.letters[r][c]) continue;
                    const key = r * 99 + c;
                    want.add(key);
                    if (!marks.has(key)) marks.set(key, addMark(r, c, grow));
                }
                for (const [key, el] of marks) if (!want.has(key)) { el.remove(); marks.delete(key); }
            }
            if (word) {
                const full = new Set();
                for (const entry of [...game.puzzle.across, ...game.puzzle.down]) {
                    const cells = Game.cellsOf(entry);
                    if (!cells.every(([r, c]) => game.letters[r][c])) continue;
                    const key = entry.direction + entry.number;
                    full.add(key);
                    if (!words.has(key)) {
                        const g = U.svg("g", { class: "deco-word" + (grow ? " grow" : "") }, gW);
                        word(entry, cells, (...k) => rnd(entry.number, entry.direction === "across" ? 1 : 2, ...k), g, entry.direction === "across");
                        words.set(key, g);
                    }
                }
                for (const [key, el] of words) if (!full.has(key)) { el.remove(); words.delete(key); }
            }
            boardEl.classList.toggle(id + "-solved", !!(game.solved && !game.surrendered));
        }
        function clear() {
            if (layer) layer.remove();
            layer = null;
            marks = new Map();
            words = new Map();
            if (boardRef) boardRef.classList.remove(id + "-solved");
        }
        return {
            attach() { quiet = true; },
            update,
            type: cell => type && type(cell),
            wordDone: (entry, cells) => wordDone && wordDone(entry, cells),
            restoreSolved(boardEl, game) { quiet = true; update(game, boardEl); },
            reset: clear,
            clear
        };
    }

    // An offscreen canvas (for drawing a scene's still parts once)
    const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };

    return {
        register, use, board, preview, modeFor, list, byId, decoBoard, canvas,
        get current() { return current; },
        get time() { return t; }
    };
})();
