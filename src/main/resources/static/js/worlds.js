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
    let covered = false;                       // something opaque fills the screen (the Atlas): the scene waits
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

    // a 1x1 canvas for warming scenes up: they draw into it, so their particles move on without anything being painted
    let scratchCtx = null;
    const scratch = () => { if (!scratchCtx) { const c = document.createElement("canvas"); c.width = c.height = 1; scratchCtx = c.getContext("2d"); } scratchCtx.setTransform(1, 0, 0, 1, 0, 0); return scratchCtx; };

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

    // The scene is soft and moving, so it's drawn at 1.25 pixels per CSS pixel at most (1 with Lite effects). If frames
    // keep coming late (on a high-density screen with a lot else on the page) it steps down to 1, then 0.75.
    let cap = 1.25, slow = 0;
    function size() {
        dpr = Math.min(devicePixelRatio || 1, U.motion() === "lite" ? 1 : cap);
        // (the size it's shown at: width 100% leaves out a classic scrollbar, which innerWidth counts, and drawing for
        // innerWidth squeezed every frame sideways in Chrome on Windows)
        W = document.documentElement.clientWidth || innerWidth;
        H = document.documentElement.clientHeight || innerHeight;
        const cw = Math.round(W * dpr), ch = Math.round(H * dpr);
        if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }       // (setting them again reallocates it)
        input.W = W;
        input.H = H;
    }

    // Built scenes are kept (the last few worlds and modes at this size), so going back to one, or flipping light and
    // dark, is instant: building a detailed scene paints all its still layers and takes up to a few hundred ms.
    const KEEP = 3, kept = new Map();
    function build() {
        size();
        const theme = document.documentElement.dataset.theme, key = `${current.id}|${theme}|${W}x${H}|${U.motion()}`;
        const old = kept.get(key);
        if (old) { kept.delete(key); kept.set(key, old); scene = old.scene; t = old.t; loop(); return; }
        try {
            scene = current.scene(W, H, { theme });
        } catch (err) {
            console.error("scene", err);
            scene = null;
        }
        t = 0;
        // warm up particle systems so the first frame isn't empty (drawn into a 1x1 scratch canvas: the state moves on,
        // but nothing is painted, so the GPU isn't handed full-screen frames). At most 30 steps and 12 ms.
        if (scene) { const t0 = performance.now(); for (let i = 0; i < 30 && performance.now() - t0 < 12; i++) { t += 0.05; scene.draw(scratch(), t, 0.05, input); } }
        if (scene) { kept.set(key, { scene, t }); while (kept.size > KEEP) kept.delete(kept.keys().next().value); }
        loop();
    }

    // The finish every scene gets: a fine grain and a soft falloff toward the edges, so flat fills read as paint and
    // light instead of plastic. Both are made once (a small noise tile, a gradient per screen size) and laid over each frame.
    let grain = null, vig = null, vigFor = "";
    function finish(g) {
        if (!current || current.plain || U.motion() === "lite") return;
        const dark = document.documentElement.dataset.theme === "dark";
        if (!grain) {
            const tile = document.createElement("canvas"); tile.width = tile.height = 160;
            const tg = tile.getContext("2d"), img = tg.createImageData(160, 160), R = U.rng(2711);
            for (let i = 0; i < img.data.length; i += 4) { const v = 128 + (R() - 0.5) * 120 + (R() - 0.5) * 50; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
            tg.putImageData(img, 0, 0);
            grain = g.createPattern(tile, "repeat");
        }
        const key = W + "x" + H + (dark ? "d" : "l");
        if (vigFor !== key) {
            vigFor = key;
            vig = g.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H * 0.45, Math.hypot(W, H) * 0.62);
            vig.addColorStop(0, "rgba(0,0,0,0)");
            vig.addColorStop(1, dark ? "rgba(0,0,8,.34)" : "rgba(70,50,30,.16)");
        }
        g.save();
        g.fillStyle = vig; g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = "overlay"; g.globalAlpha = dark ? 0.09 : 0.07;
        g.fillStyle = grain; g.fillRect(0, 0, W, H);
        g.restore();
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
        const gap = now - last;
        const dt = U.clamp(gap / 1000, 0, 0.05);       // a frame can be stamped just before "last": never step backwards
        last = now;
        t += dt;
        if (U.motion() === "full" && !covered) {
            if (gap > 22 && gap < 250) slow++; else if (slow > 0) slow -= 0.5;
            if (slow > 90 && cap > 0.75) { cap -= 0.25; slow = 0; size(); if (scene && scene.resize) scene.resize(W, H); }
        }
        input.px += (input.tx - input.px) * Math.min(1, dt * 2.5);
        input.py += (input.ty - input.py) * Math.min(1, dt * 2.5);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        try {
            scene.draw(g, t, dt, input);
            finish(g);
        } catch (err) {
            console.error("scene draw", err);
            return;
        }
        const m = U.motion();
        if (m === "still" || document.hidden || covered) return;          // a single still frame
        if (m === "lite") timer = setTimeout(() => { raf = requestAnimationFrame(frame); }, 30);
        else raf = requestAnimationFrame(frame);
    }

    document.addEventListener("visibilitychange", () => { if (!document.hidden) loop(); });
    const resized = U.debounce(() => {
        const de = document.documentElement;
        if (scene && W === (de.clientWidth || innerWidth) && H === (de.clientHeight || innerHeight) && dpr === Math.min(devicePixelRatio || 1, U.motion() === "lite" ? 1 : cap)) return;
        size();
        if (scene && scene.resize) scene.resize(W, H);
        else if (current) build();
        loop();
    }, 150);
    addEventListener("resize", resized);
    // (a scrollbar coming or going changes the page's width without resizing the window)
    if (typeof ResizeObserver === "function") new ResizeObserver(resized).observe(document.documentElement);
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
        const t0 = performance.now();                      // (particles warmed up for at most 6 ms: it's a still picture)
        for (let i = 0; i < 40 && performance.now() - t0 < 6; i++) { tt += 0.05; sc.draw(scratch(), tt, 0.05, inp); }
        c.setTransform(r, 0, 0, r, 0, 0); sc.draw(c, tt, 0.05, inp);
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

    // Shared touches for the scenes' particles: glow() is a soft light round something (the cached sprite from fx.js, much cheaper than a shadow
    // blur), glint() a cross-shaped sparkle for the brightest stars, sparks and crystals at the top of a twinkle.
    function glow(g, x, y, r, color, a = 1) {
        if (r < 1 || a <= 0.01) return;
        const op = g.globalCompositeOperation, ga = g.globalAlpha;
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = Math.min(1, a);
        g.drawImage(FX.art.halo(color), x - r, y - r, r * 2, r * 2);
        g.globalCompositeOperation = op;
        g.globalAlpha = ga;
    }
    function glint(g, x, y, len, a = 1, color = "#ffffff") {
        if (a <= 0.02 || len < 1) return;
        const op = g.globalCompositeOperation, ga = g.globalAlpha, w = Math.max(0.5, len * 0.09);
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = Math.min(1, a);
        g.fillStyle = color;
        g.beginPath();
        g.moveTo(x - len, y); g.lineTo(x, y - w); g.lineTo(x + len, y); g.lineTo(x, y + w); g.closePath();
        g.moveTo(x, y - len * 0.8); g.lineTo(x + w, y); g.lineTo(x, y + len * 0.8); g.lineTo(x - w, y); g.closePath();
        g.fill();
        g.globalCompositeOperation = op;
        g.globalAlpha = ga;
    }
    // a field of stars twinkling: the brightest ones glow and flash a glint at the top of each twinkle
    function twinkle(g, x, y, r, k, color = "#ffffff") {
        if (k > 0.86) { glow(g, x, y, r * 6, color, (k - 0.86) * 4); glint(g, x, y, r * 5 * (k - 0.6), (k - 0.86) * 6, color); }
    }

    // cover(true) while something opaque fills the whole screen, so the scene behind it stops drawing; cover(false)
    // starts it again
    function cover(on) {
        if (covered === !!on) return;
        covered = !!on;
        if (!covered && scene) loop();
    }

    return {
        register, use, cover, board, preview, modeFor, list, byId, decoBoard, canvas, glow, glint, twinkle,
        get current() { return current; },
        get time() { return t; }
    };
})();
