// The PAPER world: a crossword in your notebook.
//   Background: a ruled notebook page (light) or a blueprint (dark), with a coffee ring, punched holes, and
//   pencil doodles that draw themselves in the margins while you play.
//   Board: letters in pen; black squares are pencil hatching; finished words get a highlighter loop.
//   Win: a red rubber stamp slams down, paper confetti, gold star stickers, and a paper airplane flies a banner by.

(() => {
    const TAU = Math.PI * 2;
    const { tone, noise, midi } = Sound;

    // ---------------------------------------------------------------------------------------------
    // Doodles: each is a list of pencil strokes (lists of points in a 0..1 box). They draw themselves.
    // ---------------------------------------------------------------------------------------------
    const circle = (cx, cy, r, from = 0, to = TAU, n = 28) => Array.from({ length: n + 1 }, (_, i) => { const a = from + (to - from) * i / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
    const DOODLES = {
        star: () => [Array.from({ length: 11 }, (_, i) => { const a = -Math.PI / 2 + i * TAU / 10, r = i % 2 ? 0.2 : 0.48; return [0.5 + Math.cos(a) * r, 0.52 + Math.sin(a) * r]; })],
        spiral: () => [Array.from({ length: 70 }, (_, i) => { const a = i / 69 * TAU * 3.2, r = 0.04 + 0.42 * i / 69; return [0.5 + Math.cos(a) * r, 0.5 + Math.sin(a) * r]; })],
        smiley: () => [circle(0.5, 0.5, 0.44), circle(0.36, 0.4, 0.04, 0, TAU, 8), circle(0.64, 0.4, 0.04, 0, TAU, 8), circle(0.5, 0.52, 0.24, 0.15 * Math.PI, 0.85 * Math.PI, 14)],
        cube: () => [[[0.15, 0.35], [0.6, 0.35], [0.6, 0.85], [0.15, 0.85], [0.15, 0.35]], [[0.4, 0.15], [0.85, 0.15], [0.85, 0.65], [0.6, 0.85]], [[0.15, 0.35], [0.4, 0.15]], [[0.6, 0.35], [0.85, 0.15]]],
        heart: () => [Array.from({ length: 40 }, (_, i) => { const t = i / 39 * TAU; return [0.5 + 0.026 * 16 * Math.sin(t) ** 3, 0.47 - 0.026 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]; })],
        flower: () => [circle(0.5, 0.42, 0.08, 0, TAU, 10), ...Array.from({ length: 6 }, (_, k) => circle(0.5 + Math.cos(k * TAU / 6) * 0.19, 0.42 + Math.sin(k * TAU / 6) * 0.19, 0.11, 0, TAU, 12)), [[0.5, 0.62], [0.48, 0.95]], [[0.49, 0.8], [0.32, 0.7], [0.48, 0.76]]],
        bolt: () => [[[0.6, 0.05], [0.3, 0.52], [0.52, 0.52], [0.38, 0.95], [0.75, 0.4], [0.52, 0.4], [0.68, 0.05], [0.6, 0.05]]],
        arrow: () => [Array.from({ length: 20 }, (_, i) => { const t = i / 19; return [0.1 + t * 0.78, 0.7 - Math.sin(t * Math.PI) * 0.45]; }), [[0.72, 0.6], [0.88, 0.7], [0.78, 0.52]]],
        sun: () => [circle(0.5, 0.5, 0.2), ...Array.from({ length: 8 }, (_, k) => { const a = k * TAU / 8; return [[0.5 + Math.cos(a) * 0.29, 0.5 + Math.sin(a) * 0.29], [0.5 + Math.cos(a) * 0.45, 0.5 + Math.sin(a) * 0.45]]; })],
        cloud: () => [[...circle(0.3, 0.6, 0.16, Math.PI * 0.5, Math.PI * 1.5, 10), ...circle(0.5, 0.42, 0.2, Math.PI, TAU, 12), ...circle(0.72, 0.58, 0.16, Math.PI * 1.5, Math.PI * 2.5, 10), [0.3, 0.76]]],
        ttt: () => [[[0.36, 0.08], [0.33, 0.92]], [[0.64, 0.08], [0.66, 0.92]], [[0.06, 0.36], [0.94, 0.34]], [[0.06, 0.64], [0.94, 0.66]], [[0.1, 0.1], [0.28, 0.28]], [[0.28, 0.1], [0.1, 0.28]], circle(0.5, 0.5, 0.1, 0, TAU, 12), [[0.72, 0.72], [0.9, 0.9]], [[0.9, 0.72], [0.72, 0.9]]],
        squiggle: () => [Array.from({ length: 40 }, (_, i) => { const t = i / 39; return [0.05 + t * 0.9, 0.5 + Math.sin(t * TAU * 2.5) * 0.18]; })],
        note: () => [circle(0.32, 0.78, 0.1, 0, TAU, 12), [[0.42, 0.78], [0.42, 0.15], [0.75, 0.25], [0.75, 0.62]], circle(0.65, 0.65, 0.1, 0, TAU, 12)],
        house: () => [[[0.15, 0.45], [0.15, 0.9], [0.85, 0.9], [0.85, 0.45]], [[0.08, 0.5], [0.5, 0.12], [0.92, 0.5]], [[0.42, 0.9], [0.42, 0.65], [0.58, 0.65], [0.58, 0.9]]],
        planet: () => [circle(0.5, 0.5, 0.25), Array.from({ length: 30 }, (_, i) => { const a = i / 29 * TAU; return [0.5 + Math.cos(a) * 0.45, 0.5 + Math.sin(a) * 0.12 - Math.cos(a) * 0.08]; })],
        grid: () => [[[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9], [0.1, 0.1]], [[0.37, 0.1], [0.37, 0.9]], [[0.63, 0.1], [0.63, 0.9]], [[0.1, 0.37], [0.9, 0.37]], [[0.1, 0.63], [0.9, 0.63]], [[0.65, 0.12], [0.88, 0.35]], [[0.72, 0.12], [0.88, 0.28]], [[0.12, 0.65], [0.35, 0.88]]],
        aplus: () => [[[0.1, 0.85], [0.3, 0.15], [0.5, 0.85]], [[0.18, 0.58], [0.43, 0.58]], [[0.62, 0.5], [0.92, 0.5]], [[0.77, 0.35], [0.77, 0.65]]],
        check: () => [[[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9], [0.1, 0.1]], [[0.22, 0.5], [0.42, 0.72], [0.8, 0.25]]]
    };
    const DOODLE_NAMES = Object.keys(DOODLES);

    function makeDoodle(name, x, y, size, rot) {
        const R = Math.random;
        const strokes = DOODLES[name]().map(st => st.map(([px, py]) => [(px - 0.5) * size + (R() - 0.5) * size * 0.025, (py - 0.5) * size + (R() - 0.5) * size * 0.025]));
        let total = 0;
        const lens = strokes.map(st => { let l = 0; for (let i = 1; i < st.length; i++) l += Math.hypot(st[i][0] - st[i - 1][0], st[i][1] - st[i - 1][1]); total += l; return l; });
        return { strokes, lens, total, x, y, rot, size, prog: 0, dur: U.rand(1.1, 2), fade: 1, dying: false };
    }
    function drawDoodle(g, d, color) {
        g.save();
        g.translate(d.x, d.y);
        g.rotate(d.rot);
        g.strokeStyle = color;
        g.globalAlpha = d.fade;
        g.lineWidth = 1.6;
        g.lineCap = "round";
        g.lineJoin = "round";
        let left = d.prog * d.total;
        d.strokes.forEach((st, i) => {
            if (left <= 0) return;
            g.beginPath();
            g.moveTo(st[0][0], st[0][1]);
            for (let j = 1; j < st.length && left > 0; j++) {
                const seg = Math.hypot(st[j][0] - st[j - 1][0], st[j][1] - st[j - 1][1]);
                if (seg > left) {
                    const f = left / seg;
                    g.lineTo(st[j - 1][0] + (st[j][0] - st[j - 1][0]) * f, st[j - 1][1] + (st[j][1] - st[j - 1][1]) * f);
                    left = 0;
                } else {
                    g.lineTo(st[j][0], st[j][1]);
                    left -= seg;
                }
            }
            g.stroke();
            if (i === 0) left -= 0;
        });
        g.restore();
        g.globalAlpha = 1;
    }

    // a little paper grain, drawn once and tiled
    function grain(dark) {
        const c = document.createElement("canvas");
        c.width = c.height = 180;
        const x = c.getContext("2d"), img = x.createImageData(180, 180);
        for (let i = 0; i < img.data.length; i += 4) {
            const v = Math.random();
            img.data[i] = img.data[i + 1] = img.data[i + 2] = dark ? 255 : 60;
            img.data[i + 3] = v < 0.5 ? Math.round(v * (dark ? 14 : 22)) : 0;
        }
        x.putImageData(img, 0, 0);
        return c;
    }

    // ---------------------------------------------------------------------------------------------
    // The background: ruled notebook paper, or a blueprint in dark mode
    // ---------------------------------------------------------------------------------------------
    function scene(W, H, opts) {
        const dark = opts.theme === "dark", preview = !!opts.preview;
        let pattern = null, doodles = [], next = preview ? 99 : 1.2;
        const tex = grain(dark);
        const ink = dark ? "rgba(235,245,255,.6)" : "rgba(70,68,82,.62)";

        // free places for doodles: the margins beside the page, or anywhere on small screens
        function spot() {
            const content = Math.min(1060, W - 32), side = (W - content) / 2;
            for (let tries = 0; tries < 30; tries++) {
                const size = U.rand(46, side > 140 ? 110 : 80);
                let x;
                if (side > 90) x = Math.random() < 0.5 ? U.rand(size * 0.6, side - size * 0.3) : U.rand(W - side + size * 0.3, W - size * 0.6);
                else x = U.rand(size, W - size);
                const y = U.rand(90 + size / 2, H - size / 2);
                if (doodles.every(d => Math.hypot(d.x - x, d.y - y) > (d.size + size) * 0.62)) return { x, y, size };
            }
            return null;
        }
        function spawn(instant) {
            const p = spot();
            if (!p) return;
            const d = makeDoodle(U.pick(DOODLE_NAMES), p.x, p.y, p.size, U.rand(-0.35, 0.35));
            if (instant) d.prog = 1;
            doodles.push(d);
            const alive = doodles.filter(dd => !dd.dying);
            if (alive.length > 14) alive[0].dying = true;
        }
        if (preview) for (let i = 0; i < 7; i++) spawn(true);
        else for (let i = 0; i < 4; i++) spawn(true);

        // a coffee ring, because every notebook has one
        const ring = { x: W * 0.08, y: H * 0.86, r: U.clamp(Math.min(W, H) * 0.09, 40, 90) };

        return {
            resize(w, h) { W = w; H = h; doodles = doodles.filter(d => d.x < W && d.y < H); ring.x = W * 0.08; ring.y = H * 0.86; },
            draw(g, t, dt) {
                g.fillStyle = dark ? "#163a6b" : "#fbf7ee";
                g.fillRect(0, 0, W, H);
                if (!pattern) pattern = g.createPattern(tex, "repeat");
                g.fillStyle = pattern;
                g.fillRect(0, 0, W, H);
                if (dark) {
                    // blueprint grid
                    g.lineWidth = 1;
                    g.strokeStyle = "rgba(255,255,255,.06)";
                    g.beginPath();
                    for (let x = 0; x < W; x += 24) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); }
                    for (let y = 0; y < H; y += 24) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); }
                    g.stroke();
                    g.strokeStyle = "rgba(255,255,255,.14)";
                    g.beginPath();
                    for (let x = 0; x < W; x += 120) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); }
                    for (let y = 0; y < H; y += 120) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); }
                    g.stroke();
                } else {
                    // ruled lines, the red margin, and punched holes
                    g.lineWidth = 1;
                    g.strokeStyle = "rgba(80,140,210,.26)";
                    g.beginPath();
                    for (let y = 96; y < H; y += 34) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); }
                    g.stroke();
                    const mx = preview ? W * 0.12 : Math.max(56, W * 0.055);
                    g.strokeStyle = "rgba(226,72,60,.45)";
                    g.beginPath(); g.moveTo(mx, 0); g.lineTo(mx, H); g.stroke();
                    if (W > 640 || preview) {
                        for (const k of [0.2, 0.5, 0.8]) {
                            const hx = mx * 0.42, hy = H * k, hr = preview ? 6 : 11;
                            g.fillStyle = "rgba(0,0,0,.08)";
                            g.beginPath(); g.arc(hx + 1.5, hy + 2, hr, 0, TAU); g.fill();
                            g.fillStyle = "#e9e1cf";
                            g.beginPath(); g.arc(hx, hy, hr, 0, TAU); g.fill();
                        }
                    }
                    // coffee ring
                    if (!preview) {
                        g.lineWidth = 5;
                        g.strokeStyle = "rgba(150,95,45,.12)";
                        g.beginPath(); g.arc(ring.x, ring.y, ring.r, 0.2, TAU - 0.4); g.stroke();
                        g.lineWidth = 2;
                        g.strokeStyle = "rgba(150,95,45,.1)";
                        g.beginPath(); g.arc(ring.x + 3, ring.y - 2, ring.r * 0.93, 0, TAU); g.stroke();
                    }
                }
                // doodles: a new one every few seconds, drawn stroke by stroke
                next -= dt;
                if (next <= 0) { spawn(false); next = U.rand(4, 8); }
                for (const d of doodles) {
                    if (d.prog < 1) d.prog = Math.min(1, d.prog + dt / d.dur);
                    if (d.dying) d.fade -= dt * 0.5;
                    drawDoodle(g, d, ink);
                }
                doodles = doodles.filter(d => d.fade > 0);
                // the pencil, while something is being drawn
                const busy = doodles.find(d => d.prog < 1);
                if (busy && !preview) pencilAt(g, busy, t);
            }
        };
    }

    // a tiny pencil that follows the line being drawn
    function pencilAt(g, d, t) {
        let left = d.prog * d.total, px = 0, py = 0;
        outer: for (const st of d.strokes) {
            for (let j = 1; j < st.length; j++) {
                const seg = Math.hypot(st[j][0] - st[j - 1][0], st[j][1] - st[j - 1][1]);
                if (seg >= left) { const f = left / seg; px = st[j - 1][0] + (st[j][0] - st[j - 1][0]) * f; py = st[j - 1][1] + (st[j][1] - st[j - 1][1]) * f; break outer; }
                left -= seg;
            }
        }
        const c = Math.cos(d.rot), s = Math.sin(d.rot);
        const x = d.x + px * c - py * s, y = d.y + px * s + py * c;
        g.save();
        g.translate(x, y);
        g.rotate(-0.7 + Math.sin(t * 20) * 0.04);
        g.fillStyle = "#3a3340"; g.beginPath(); g.moveTo(0, 0); g.lineTo(4, -9); g.lineTo(-4, -9); g.fill();
        g.fillStyle = "#e9c99a"; g.beginPath(); g.moveTo(4, -9); g.lineTo(6, -16); g.lineTo(-6, -16); g.lineTo(-4, -9); g.fill();
        g.fillStyle = "#f2c230"; g.fillRect(-6, -52, 12, 36);
        g.fillStyle = "#c8c8d0"; g.fillRect(-6, -58, 12, 6);
        g.fillStyle = "#f08aa0"; g.beginPath(); g.roundRect(-6, -66, 12, 9, 3); g.fill();
        g.restore();
    }

    // ---------------------------------------------------------------------------------------------
    // The board: highlighter loops around finished words, the SOLVED stamp
    // ---------------------------------------------------------------------------------------------
    const HIGHLIGHT = ["#ffe34d", "#ff9ec7", "#8ff0a4", "#8fd3ff", "#ffb86b"];
    const board = (() => {
        let layer = null, loops = new Map(), stamp = null;
        // a wobbly rounded loop around a word, like a highlighter swipe
        function loopPath(entry) {
            const across = entry.direction === "across", len = entry.length;
            const x0 = entry.col + 0.06, y0 = entry.row + 0.1, x1 = entry.col + (across ? len : 1) - 0.06, y1 = entry.row + (across ? 1 : len) - 0.1;
            const R = U.rng(entry.number * 7 + (across ? 1 : 2)), j = () => (R() - 0.5) * 0.08;
            const r = 0.4;
            return `M${x0 + r + j()},${y0 + j()} L${x1 - r + j()},${y0 + j()} Q${x1 + j()},${y0 + j()} ${x1 + j()},${y0 + r + j()} ` +
                `L${x1 + j()},${y1 - r + j()} Q${x1 + j()},${y1 + j()} ${x1 - r + j()},${y1 + j()} L${x0 + r + j()},${y1 + j()} ` +
                `Q${x0 + j()},${y1 + j()} ${x0 + j()},${y1 - r + j()} L${x0 + j()},${y0 + r + j()} Q${x0 + j()},${y0 + j()} ${x0 + r + 0.15},${y0 - 0.02}`;
        }
        function update(game, boardEl) {
            const size = game.puzzle.size;
            if (!layer || !boardEl.contains(layer)) {
                layer = U.svg("svg", { class: "paper-loops", viewBox: `0 0 ${size} ${size}`, preserveAspectRatio: "none", "aria-hidden": "true" });
                boardEl.appendChild(layer);
                loops = new Map();
                stamp = null;
            }
            const filled = (r, c) => game.letters[r][c] !== "";
            const full = new Set();
            for (const entry of [...game.puzzle.across, ...game.puzzle.down]) {
                if (!Game.cellsOf(entry).every(([r, c]) => filled(r, c))) continue;
                const key = entry.direction + entry.number;
                full.add(key);
                if (loops.has(key)) continue;
                const color = HIGHLIGHT[(entry.number + (entry.direction === "down" ? 2 : 0)) % HIGHLIGHT.length];
                const p = U.svg("path", { d: loopPath(entry), pathLength: 1, class: "hl-loop grow", stroke: color }, layer);
                loops.set(key, p);
            }
            for (const [key, node] of loops) if (!full.has(key)) { node.remove(); loops.delete(key); }
            // the stamp stays on a solved board
            if (!game.celebrating) {                     // (during the win cinematic, the stamp slams in by itself)
                const want = game.solved && !game.surrendered;
                if (want && !stamp) stamp = addStamp(boardEl, false);
                if (!want && stamp) { stamp.remove(); stamp = null; }
            }
        }
        function addStamp(boardEl, animate) {
            const s = U.el("div", { class: "paper-stamp" + (animate ? " slam" : ""), "aria-hidden": "true", html: "<span>SOLVED!</span>" });
            boardEl.appendChild(s);
            return s;
        }
        function type(cell) {
            const c = U.center(cell);
            FX.burst({ x: c.x + c.w * 0.2, y: c.y + c.h * 0.3, n: 4, colors: ["#55525e", "#8a8794"], shape: "circle", speed: [20, 70], gravity: 200, life: [0.25, 0.45], size: [0.8, 1.4] });
        }
        function clear() { if (layer) layer.remove(); layer = null; loops = new Map(); if (stamp) stamp.remove(); stamp = null; }
        return {
            update, type, clear,
            stampNow(boardEl) { if (stamp) stamp.remove(); stamp = addStamp(boardEl, true); return stamp; }
        };
    })();

    // ---------------------------------------------------------------------------------------------
    // The win: SOLVED stamp, paper confetti, star stickers, and a paper airplane with a banner
    // ---------------------------------------------------------------------------------------------
    async function celebrate(c, { boardEl }) {
        if (U.motion() === "still") { board.stampNow(boardEl); return; }
        const b = U.center(boardEl);
        boardEl.animate([{ transform: "none" }, { transform: "translateY(-10px) rotate(-1deg)" }, { transform: "none" }], { duration: 420, easing: "ease-out" });
        // gold star stickers pop onto the corners
        const stickers = [[-0.46, -0.46, -14], [0.46, -0.46, 12], [-0.46, 0.46, 9], [0.46, 0.46, -10]].map(([fx, fy, rot], i) => {
            const st = U.el("div", { class: "paper-sticker", "aria-hidden": "true", text: "★", style: { left: (b.x + fx * b.w) + "px", top: (b.y + fy * b.h) + "px", "--r": rot + "deg", animationDelay: (0.15 + i * 0.12) + "s" } });
            document.getElementById("overlay").appendChild(st);
            return st;
        });
        c.cleanup(() => stickers.forEach(s => s.remove()));
        FX.follow(c, boardEl, ...stickers);
        [0, 120, 240, 360].forEach(ms => c.later(() => Sound.play("pop"), 150 + ms));
        await c.wait(650);
        if (c.skipped) return;
        // the stamp
        board.stampNow(boardEl);
        Sound.play("stamp");
        await c.wait(230);
        if (c.skipped) return;
        FX.shake(12, 380);
        FX.burst({ x: b.x, y: b.y, n: 34, colors: ["#d7263d", "#b81d32", "#e2483c"], shape: "circle", speed: [120, 460], gravity: 300, drag: 3, life: [0.4, 0.9], size: [1.5, 4.5], jitter: b.w * 0.15 });
        // paper confetti from both bottom corners
        const H = innerHeight, W = innerWidth;
        const paperColors = ["#fffdf7", "#ffe34d", "#ff9ec7", "#8fd3ff", "#8ff0a4", "#f4eee0"];
        FX.burst({ x: 0, y: H, n: 90, colors: paperColors, shape: "rect", angle: -Math.PI / 3, spread: 0.45, speed: [700, 1250], gravity: 650, drag: 1.4, life: [2.6, 3.6], size: [9, 16] });
        FX.burst({ x: W, y: H, n: 90, colors: paperColors, shape: "rect", angle: -Math.PI * 2 / 3, spread: 0.45, speed: [700, 1250], gravity: 650, drag: 1.4, life: [2.6, 3.6], size: [9, 16] });
        Sound.play("crumple");
        await c.wait(700);
        if (c.skipped) return;
        // the paper airplane, towing a banner
        const plane = U.el("div", { class: "paper-plane", "aria-hidden": "true", html:
            `<svg viewBox="0 0 120 60"><path d="M4 30 L116 6 L50 40 Z" fill="#fffdf7" stroke="#2b2b33" stroke-width="2.5" stroke-linejoin="round"/><path d="M50 40 L116 6 L64 56 Z" fill="#ece6d6" stroke="#2b2b33" stroke-width="2.5" stroke-linejoin="round"/><path d="M50 40 L58 50" stroke="#2b2b33" stroke-width="2"/></svg>` +
            `<span class="paper-banner">${U.esc(U.pick(["NICE WORK!", "A+ SOLVE!", "GOLD STAR!", "NAILED IT!"]))}</span>` });
        document.getElementById("overlay").appendChild(plane);
        c.cleanup(() => plane.remove());
        Sound.play("whoosh");
        const pts = [];
        for (let i = 0; i <= 12; i++) {
            const k = i / 12;
            pts.push({ transform: `translate(${(-0.2 + k * 1.4) * W}px, ${(0.62 - Math.sin(k * Math.PI) * 0.42 + Math.sin(k * 9) * 0.03) * H}px) rotate(${(-8 + Math.cos(k * 9) * 10).toFixed(1)}deg)` });
        }
        await new Promise(res => {
            const a = plane.animate(pts, { duration: 2600, easing: "ease-in-out", fill: "forwards" });
            a.onfinish = res;
            c.cleanup(() => { a.cancel(); res(); });
            c.wait(2700).then(res);
        });
    }

    // ---------------------------------------------------------------------------------------------
    // Title card: an index card, paper-clipped, with the puzzle written on it
    // ---------------------------------------------------------------------------------------------
    async function titleCard(c, info) {
        const card = U.el("div", { class: "tc tc-paper", "aria-hidden": "true", html: `
            <div class="tcp-card">
                <svg class="tcp-clip" viewBox="0 0 30 80"><path d="M8 70 V18 a7 7 0 0 1 14 0 V62 a4 4 0 0 1 -8 0 V22" fill="none" stroke="#9aa0ab" stroke-width="3" stroke-linecap="round"/></svg>
                <small>${U.esc(info.kicker)}</small>
                <h2>${U.esc(info.title)}</h2>
                <p>${U.esc(info.sub)}</p>
                <svg class="tcp-underline" viewBox="0 0 300 20" preserveAspectRatio="none"><path d="M6 12 Q 80 4 150 10 T 294 8" pathLength="1"/></svg>
            </div>` });
        document.getElementById("overlay").appendChild(card);
        c.cleanup(() => card.remove());
        Sound.play("title");
        await c.wait(1700);
        if (c.skipped) return;
        card.classList.add("out");
        Sound.play("whoosh");
        await c.wait(450);
    }

    // ---------------------------------------------------------------------------------------------
    // The mascot: Pip, a pencil
    // ---------------------------------------------------------------------------------------------
    function drawPip(g, s) {
        const bob = Math.sin(s.t * 2.2) * 3 - s.hop * 10;
        const tilt = Math.sin(s.t * 1.1) * 0.06 + (s.mood === "wow" ? -0.1 : 0);
        g.save();
        g.translate(80, 86 + bob);
        g.rotate(tilt);
        g.lineWidth = 3;
        g.strokeStyle = "#2b2b33";
        g.lineJoin = "round";
        // arms
        const wave = s.mood === "happy" || s.mood === "wow" ? Math.sin(s.t * 9) * 0.6 : 0.2;
        for (const side of [-1, 1]) {
            g.beginPath();
            g.moveTo(side * 18, 4);
            g.quadraticCurveTo(side * 34, 0, side * 38, side > 0 ? -18 - wave * 14 : 16);
            g.stroke();
        }
        // the wooden tip and graphite point
        g.fillStyle = "#ecc896";
        g.beginPath(); g.moveTo(-19, 36); g.lineTo(19, 36); g.lineTo(0, 66); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = "#2b2b33";
        g.beginPath(); g.moveTo(-6, 56); g.lineTo(6, 56); g.lineTo(0, 66); g.closePath(); g.fill();
        // the yellow body with its stripes
        g.fillStyle = "#f6c533";
        g.beginPath(); g.roundRect(-20, -46, 40, 84, 4); g.fill(); g.stroke();
        g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(-14, -44, 6, 80);
        g.fillStyle = "rgba(180,120,0,.25)"; g.fillRect(8, -44, 6, 80);
        // metal band & eraser
        g.fillStyle = "#c9ccd6";
        g.beginPath(); g.rect(-21, -58, 42, 13); g.fill(); g.stroke();
        g.strokeStyle = "rgba(43,43,51,.5)"; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(-21, -53); g.lineTo(21, -53); g.moveTo(-21, -49); g.lineTo(21, -49); g.stroke();
        g.lineWidth = 3; g.strokeStyle = "#2b2b33";
        g.fillStyle = "#f28ba4";
        g.beginPath(); g.roundRect(-20, -74, 40, 17, 6); g.fill(); g.stroke();
        // face
        const ex = s.look * 3;
        for (const side of [-1, 1]) {
            const x = side * 8 + ex, y = -18;
            g.fillStyle = "#fff";
            g.beginPath(); g.ellipse(x, y, 6, s.blink > 0.5 ? 1 : 7.5, 0, 0, TAU); g.fill();
            g.lineWidth = 2; g.stroke();
            if (s.blink <= 0.5) {
                g.fillStyle = "#2b2b33";
                if (s.mood === "happy") { g.lineWidth = 2.5; g.beginPath(); g.arc(x, y + 2, 3.6, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
                else { g.beginPath(); g.arc(x + s.look * 1.5, y + 1, s.mood === "wow" ? 2 : 3.2, 0, TAU); g.fill(); }
            }
        }
        g.fillStyle = "rgba(240,120,140,.45)";
        g.beginPath(); g.ellipse(-14, -6, 4, 2.5, 0, 0, TAU); g.ellipse(14, -6, 4, 2.5, 0, 0, TAU); g.fill();
        g.lineWidth = 2.5;
        g.beginPath();
        if (s.mood === "wow" || s.talk > 0.3) { g.fillStyle = "#7a2b3b"; g.ellipse(0, -4, 4, 2 + s.talk * 4, 0, 0, TAU); g.fill(); g.stroke(); }
        else if (s.mood === "sad") { g.arc(0, 2, 6, Math.PI * 1.2, Math.PI * 1.8); g.stroke(); }
        else { g.arc(0, -8, 7, Math.PI * 0.2, Math.PI * 0.8); g.stroke(); }
        g.restore();
    }

    // ---------------------------------------------------------------------------------------------
    // Sounds: pencil scratches, paper rustles, a rubber stamp, a soft piano
    // ---------------------------------------------------------------------------------------------
    const sounds = {
        type: () => { for (let i = 0; i < 3; i++) noise({ t: i * 0.018 + Math.random() * 0.01, f: U.rand(3500, 6500), q: 6, d: 0.035, v: 0.07 }); },
        erase: () => noise({ f: 900, f2: 500, q: 1.2, d: 0.14, v: 0.08 }),
        word: () => { noise({ f: 2500, f2: 5000, d: 0.25, v: 0.05, q: 2 }); [0, 4, 7].forEach((n, i) => tone({ t: 0.05 + i * 0.08, f: midi(72 + n), type: "triangle", d: 0.5, v: 0.07 })); },
        wrong: () => { noise({ f: 700, d: 0.2, v: 0.08, q: 1 }); tone({ f: 220, f2: 180, type: "triangle", d: 0.3, v: 0.08 }); },
        right: () => [0, 4, 7, 12].forEach((n, i) => tone({ t: i * 0.07, f: midi(79 + n), type: "triangle", d: 0.4, v: 0.06 })),
        reveal: () => { noise({ f: 2000, f2: 6000, d: 0.18, v: 0.06, q: 2 }); tone({ f: midi(84), type: "triangle", d: 0.3, v: 0.05 }); },
        stamp: () => { tone({ f: 160, f2: 50, d: 0.25, v: 0.6 }); noise({ type: "lowpass", f: 1400, f2: 200, d: 0.2, v: 0.45 }); noise({ t: 0.01, f: 5000, d: 0.05, v: 0.12, q: 1 }); },
        crumple: () => { for (let i = 0; i < 10; i++) noise({ t: i * 0.05 + Math.random() * 0.03, f: U.rand(1800, 5000), q: 1.5, d: 0.05, v: 0.07 }); },
        win: () => [60, 64, 67, 72, 76, 79].forEach((n, i) => tone({ t: i * 0.1, f: midi(n), type: "triangle", d: i === 5 ? 1.2 : 0.4, v: 0.08 })),
        title: () => { noise({ f: 1500, f2: 4000, d: 0.3, v: 0.08, q: 1 }); for (let i = 0; i < 6; i++) noise({ t: 0.3 + i * 0.06, f: U.rand(3500, 6000), q: 6, d: 0.04, v: 0.06 }); },
        tile: i => { noise({ f: 2000, d: 0.04, v: 0.08, q: 2 }); tone({ f: midi(67 + (i % 7) * 2), type: "triangle", d: 0.12, v: 0.05 }); },
        start: () => { noise({ f: 300, f2: 3000, d: 0.5, v: 0.1, q: 0.8 }); [60, 67, 72].forEach((n, i) => tone({ t: 0.2 + i * 0.1, f: midi(n), type: "triangle", d: 0.6, v: 0.07 })); },
        select: () => { noise({ f: 3000, d: 0.03, v: 0.06, q: 4 }); tone({ f: 1400, type: "triangle", d: 0.04, v: 0.04 }); },
        nav: () => noise({ f: 1200, f2: 4000, d: 0.28, v: 0.08, q: 0.9 }),
        achievement: () => { sounds.stamp(); [72, 76, 79, 84].forEach((n, i) => tone({ t: 0.15 + i * 0.07, f: midi(n), type: "triangle", d: 0.4, v: 0.06 })); }
    };

    Worlds.register({
        id: "paper", name: "Notebook", icon: "✏️", tagline: "Pencil, Paper and Doodles.",
        modes: ["light", "dark"],
        scene, board, celebrate, titleCard, sounds, transition: "page",
        mascot: { name: "PIP", draw: drawPip },
        lines: {
            hello: ["Hi! I'm Pip. Let's fill in some squares!", "Sharpened and ready. Pick a puzzle!", "Fresh page, fresh puzzles."],
            start: ["Tap a square and start writing. Space switches direction!", "Tab jumps to the next clue. Easy peasy."],
            word: ["Neatly done!", "That one's in pen now.", "Gold star!", "Look at that handwriting!", "Nice!"],
            win: ["A+! Stamped and done.", "That deserves a sticker. Or four!", "Solved! I'm so proud I could erase."],
            wrong: ["A few need the eraser.", "Close! Some letters need another look."],
            right: ["Every letter's correct so far!", "No eraser needed!"],
            idle: ["Stuck? Try a crossing word.", "Short words are often the easiest way in."],
            reveal: ["Peeking is allowed. Sometimes."]
        },
        introFlourish(stage) {
            const p = U.center(stage);
            FX.burst({ x: p.x, y: p.y + p.h * 0.3, n: 60, colors: ["#fffdf7", "#ffe34d", "#ff9ec7", "#8fd3ff"], shape: "rect", angle: -Math.PI / 2, spread: 0.9, speed: [400, 900], gravity: 700, life: [1.5, 2.4], size: [8, 14] });
        }
    });
})();
