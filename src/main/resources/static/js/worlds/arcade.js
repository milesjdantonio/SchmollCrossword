// The NEON ARCADE world: a synthwave night drive.
//   Background: a striped retro sun setting behind wireframe mountains, a neon grid floor rushing toward you,
//   palm-tree silhouettes, stars, and a pixel UFO now and then. A CRT scanline filter sits over everything (CSS).
//   Board: neon squares, pixel fonts, pixel sparks on every letter, a 1UP score with word COMBOs.
//   Win: STAGE CLEAR!, pixel fireworks and a bonus tally.

(() => {
    const TAU = Math.PI * 2;
    const { tone, noise, midi } = Sound;
    const NEON = ["#ff2a6d", "#05d9e8", "#f9c80e", "#d16ba5", "#7c5cff", "#3dfc8a"];

    // ---------------------------------------------------------------------------------------------
    // The background
    // ---------------------------------------------------------------------------------------------
    function scene(W, H, opts) {
        const preview = !!opts.preview;
        let hz, sunR, sun, stars, far, near, sky = null, floor = null;
        let ufo = null, nextUfo = preview ? 999 : U.rand(8, 16);

        function ridge(seed, peaks, maxH) {
            const R = U.rng(seed), pts = [];
            for (let i = 0; i <= peaks; i++) pts.push([i / peaks, i === 0 || i === peaks ? 0.1 : 0.2 + R() * 0.8]);
            return pts.map(([x, h]) => [x, h * maxH]);
        }
        function setup() {
            hz = Math.round(H * (preview ? 0.6 : 0.62));
            sunR = Math.min(W, H) * (preview ? 0.3 : 0.21);
            sun = document.createElement("canvas");
            sun.width = sun.height = Math.ceil(sunR * 2 + 4);
            const R = U.rng(2049);
            stars = Array.from({ length: preview ? 40 : 120 }, () => ({ x: R() * W, y: R() * hz * 0.85, r: R() * 1.3 + 0.4, tw: R() * TAU }));
            far = ridge(11, 14, H * 0.17);
            near = ridge(23, 9, H * 0.1);
            sky = floor = null;
        }
        setup();

        function drawSun(g, cx, cy, t) {
            const x = sun.getContext("2d"), S = sun.width, c = S / 2;
            x.globalCompositeOperation = "source-over";
            x.clearRect(0, 0, S, S);
            const gr = x.createLinearGradient(0, c - sunR, 0, c + sunR);
            gr.addColorStop(0, "#ffe66d");
            gr.addColorStop(0.45, "#ff9b42");
            gr.addColorStop(1, "#ff2a6d");
            x.fillStyle = gr;
            x.beginPath(); x.arc(c, c, sunR, 0, TAU); x.fill();
            // the classic stripes, scrolling down and getting thicker
            x.globalCompositeOperation = "destination-out";
            const gap = sunR * 0.17, off = (t * sunR * 0.06) % gap;
            for (let i = -1; i < 7; i++) {
                const y = c + sunR * 0.02 + i * gap + off, h = Math.max(0, 1.5 + (y - c) / sunR * gap * 0.55);
                if (y > c - sunR * 0.05) x.fillRect(0, y, S, h);
            }
            g.drawImage(sun, cx - c, cy - c);
        }

        function palm(g, x, base, s, flip, t) {
            g.save();
            g.translate(x, base);
            g.scale(flip * s, s);
            g.fillStyle = "#0a0118";
            g.strokeStyle = "#0a0118";
            g.lineCap = "round";
            g.lineWidth = 9;
            g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(14, -80, 44, -150); g.stroke();
            const sway = Math.sin(t * 1.2 + x) * 0.06;
            for (let i = 0; i < 7; i++) {
                const a = -2.6 + i * 0.62 + sway;
                g.save();
                g.translate(44, -150);
                g.rotate(a);
                g.beginPath();
                g.moveTo(0, 0);
                g.quadraticCurveTo(40, -18, 82, 14);
                g.quadraticCurveTo(40, -2, 0, 6);
                g.fill();
                g.restore();
            }
            g.restore();
        }

        function drawUfo(g, u, t) {
            const px = 4, x0 = Math.round(u.x), y0 = Math.round(u.y + Math.sin(t * 3) * 6);
            const MAP = ["....cccc....", "..cccccccc..", "pppppppppppp", ".pwpwpwpwpw.", "...pppppp..."];
            const col = { c: "#05d9e8", p: "#d16ba5", w: Math.sin(t * 10) > 0 ? "#f9c80e" : "#ffffff" };
            MAP.forEach((row, ry) => [...row].forEach((ch, rx) => { if (ch !== ".") { g.fillStyle = col[ch]; g.fillRect(x0 + rx * px, y0 + ry * px, px, px); } }));
            if (u.beam) {
                const bg = g.createLinearGradient(0, y0 + 20, 0, hz);
                bg.addColorStop(0, "rgba(249,200,14,.35)");
                bg.addColorStop(1, "rgba(249,200,14,0)");
                g.fillStyle = bg;
                g.beginPath(); g.moveTo(x0 + 16, y0 + 20); g.lineTo(x0 + 32, y0 + 20); g.lineTo(x0 + 60, hz); g.lineTo(x0 - 12, hz); g.fill();
            }
        }

        return {
            resize(w, h) { W = w; H = h; setup(); },
            draw(g, t, dt, inp) {
                if (!sky) {
                    sky = g.createLinearGradient(0, 0, 0, hz);
                    sky.addColorStop(0, "#07011a");
                    sky.addColorStop(0.5, "#240744");
                    sky.addColorStop(0.82, "#6b0f6f");
                    sky.addColorStop(1, "#ff2a6d");
                    floor = g.createLinearGradient(0, hz, 0, H);
                    floor.addColorStop(0, "#1d0338");
                    floor.addColorStop(1, "#040010");
                }
                g.fillStyle = sky;
                g.fillRect(0, 0, W, hz);
                for (const s of stars) {
                    g.fillStyle = `rgba(255,255,255,${(0.35 + 0.65 * Math.abs(Math.sin(t * 1.4 + s.tw))).toFixed(2)})`;
                    g.fillRect(s.x, s.y, s.r * 1.4, s.r * 1.4);
                }
                // the sun and its glow
                const sx = W / 2 - inp.px * 12, sy = hz - sunR * 0.45;
                g.globalCompositeOperation = "lighter";
                const glow = g.createRadialGradient(sx, sy, sunR * 0.6, sx, sy, sunR * 2.3);
                glow.addColorStop(0, "rgba(255,90,140,.35)");
                glow.addColorStop(1, "rgba(255,42,109,0)");
                g.fillStyle = glow;
                g.fillRect(sx - sunR * 2.3, sy - sunR * 2.3, sunR * 4.6, sunR * 4.6);
                g.globalCompositeOperation = "source-over";
                drawSun(g, sx, sy, t);
                // a UFO now and then
                nextUfo -= dt;
                if (!ufo && nextUfo <= 0) ufo = { x: -60, y: U.rand(H * 0.08, hz * 0.45), vx: U.rand(60, 110), beam: false, bt: U.rand(1, 3) };
                if (ufo) {
                    ufo.x += ufo.vx * dt; ufo.bt -= dt;
                    if (ufo.bt < 0) { ufo.beam = !ufo.beam; ufo.bt = ufo.beam ? 1.2 : U.rand(1.5, 3); }
                    drawUfo(g, ufo, t);
                    if (ufo.x > W + 60) { ufo = null; nextUfo = U.rand(14, 26); }
                }
                // wireframe mountains
                for (const [pts, fill, line, shift] of [[far, "#1a0533", "rgba(255,42,109,.75)", 6], [near, "#11022a", "rgba(5,217,232,.7)", 14]]) {
                    const ox = -inp.px * shift;
                    g.beginPath();
                    g.moveTo(-20, hz);
                    for (const [x, h] of pts) g.lineTo(ox + x * (W + 40) - 20, hz - h);
                    g.lineTo(W + 20, hz);
                    g.closePath();
                    g.fillStyle = fill;
                    g.fill();
                    g.strokeStyle = line;
                    g.lineWidth = 1.5;
                    g.stroke();
                }
                // the grid floor
                g.fillStyle = floor;
                g.fillRect(0, hz, W, H - hz);
                const vx = W / 2 - inp.px * 40;
                g.globalCompositeOperation = "lighter";
                for (const [width, alpha] of [[4, 0.18], [1.5, 1]]) {
                    g.lineWidth = width;
                    for (let j = -14; j <= 14; j++) {
                        const bx = vx + j * W * 0.11;
                        g.strokeStyle = `rgba(255,42,109,${(0.55 * alpha).toFixed(2)})`;
                        g.beginPath(); g.moveTo(vx + j * W * 0.006, hz); g.lineTo(bx + (bx - vx) * 0.4, H + 40); g.stroke();
                    }
                    const frac = (t * 1.1) % 1;
                    for (let i = 0; i < 22; i++) {
                        const z = 1 + i - frac;
                        const y = hz + (H - hz) * 0.95 / z ** 1.05;
                        if (y > H + 4) continue;
                        const k = (y - hz) / (H - hz);
                        g.strokeStyle = `rgba(255,42,109,${((0.12 + 0.88 * k) * alpha).toFixed(2)})`;
                        g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
                    }
                }
                // the horizon line glows
                const hg = g.createLinearGradient(0, hz - 6, 0, hz + 10);
                hg.addColorStop(0, "rgba(255,42,109,0)");
                hg.addColorStop(0.5, "rgba(255,120,170,.9)");
                hg.addColorStop(1, "rgba(255,42,109,0)");
                g.fillStyle = hg;
                g.fillRect(0, hz - 6, W, 16);
                g.globalCompositeOperation = "source-over";
                if (!preview || W > 200) {
                    const s = U.clamp(H / 900, 0.4, 1.1);
                    palm(g, W * 0.04, H + 10, s * 1.15, 1, t);
                    palm(g, W * 0.12, H + 30, s * 0.8, 1, t + 1);
                    palm(g, W * 0.96, H + 10, s * 1.1, -1, t + 2);
                }
            }
        };
    }

    // ---------------------------------------------------------------------------------------------
    // The board: pixel sparks, the 1UP score and word combos
    // ---------------------------------------------------------------------------------------------
    const board = (() => {
        let hud = null, scoreEl = null, hiEl = null, shown = 0, bonus = 0, combo = 0, lastWord = 0, hi = U.store.get("arcade.hi", 0), puzzleKey = "";
        function attach(boardEl, game) {
            const slot = document.getElementById("world-hud");
            if (!hud) {
                hud = U.el("div", { class: "arc-hud", html: `<span>1UP <b class="arc-score">000000</b></span><span>HI <b class="arc-hi">000000</b></span>` });
                scoreEl = hud.querySelector(".arc-score");
                hiEl = hud.querySelector(".arc-hi");
            }
            if (!slot.contains(hud)) slot.appendChild(hud);
            const key = game.puzzle.mode + game.puzzle.seed;
            if (key !== puzzleKey) { puzzleKey = key; bonus = 0; combo = 0; }
            hiEl.textContent = String(hi).padStart(6, "0");
        }
        function score(game) {
            let letters = 0, words = 0;
            const size = game.puzzle.size;
            for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (game.letters[r][c] && !game.revealed[r][c]) letters++;
            for (const e of [...game.puzzle.across, ...game.puzzle.down]) if (Game.cellsOf(e).every(([r, c]) => game.letters[r][c])) words++;
            return letters * 10 + words * 100 + bonus + (game.solved && !game.surrendered ? 1000 : 0);
        }
        function update(game, boardEl) {
            if (!hud) attach(boardEl, game);
            const s = score(game);
            if (s !== shown) {
                const from = shown;
                shown = s;
                FX.countUp(scoreEl, s, { from, dur: 350, fmt: v => String(Math.round(v)).padStart(6, "0") });
            }
            if (game.solved && !game.surrendered && !game.testWin && s > hi) { hi = s; U.store.set("arcade.hi", hi); hiEl.textContent = String(hi).padStart(6, "0"); }
            // finished words keep a rainbow border
            const done = new Set();
            for (const e of [...game.puzzle.across, ...game.puzzle.down]) {
                const cells = Game.cellsOf(e);
                if (cells.every(([r, c]) => game.letters[r][c])) cells.forEach(([r, c]) => done.add(r * 99 + c));
            }
            for (let r = 0; r < game.puzzle.size; r++) for (let c = 0; c < game.puzzle.size; c++) {
                const cell = Game.cellEl(r, c);
                if (cell) cell.classList.toggle("arc-done", done.has(r * 99 + c));
            }
        }
        function type(cell) {
            const c = U.center(cell);
            FX.burst({ x: c.x, y: c.y, n: 12, colors: NEON, shape: "pixel", speed: [80, 230], gravity: 380, drag: 1.5, life: [0.3, 0.6], size: [3, 5], fade: false });
        }
        function wordDone(entry, cells) {
            const now = performance.now();
            combo = now - lastWord < 7000 ? combo + 1 : 1;
            lastWord = now;
            if (combo > 1) bonus += 50 * (combo - 1);
            const mid = cells[Math.floor(cells.length / 2)], cell = Game.cellEl(mid[0], mid[1]);
            if (!cell) return;
            const p = U.center(cell);
            const pop = U.el("div", { class: "arc-pop" + (combo > 1 ? " combo" : ""), text: combo > 1 ? `COMBO x${combo}!` : "+100", style: { left: p.x + "px", top: p.y + "px" } });
            document.getElementById("overlay").appendChild(pop);
            setTimeout(() => pop.remove(), 1100);
            if (combo > 2) FX.burst({ x: p.x, y: p.y, n: 30, colors: NEON, shape: "pixel", speed: [150, 400], gravity: 300, life: [0.5, 0.9], size: [4, 6], fade: false });
        }
        function clear() { if (hud) hud.remove(); hud = null; shown = 0; Game.openCells().forEach(cell => cell.classList.remove("arc-done")); }
        return { attach, update, type, wordDone, clear, get combo() { return combo; } };
    })();

    // ---------------------------------------------------------------------------------------------
    // The win: STAGE CLEAR!
    // ---------------------------------------------------------------------------------------------
    async function celebrate(c, { info }) {
        if (U.motion() === "still") return;
        const W = innerWidth, H = innerHeight;
        FX.flash("#ffffff", 280, 0.75);
        FX.shake(8, 300);
        const banner = U.el("div", { class: "arc-clear", "aria-hidden": "true", html:
            `<div class="arc-clear-t" data-text="STAGE CLEAR!">STAGE CLEAR!</div><div class="arc-clear-s"></div><div class="arc-clear-k">PRESS ANY KEY</div>` });
        document.getElementById("overlay").appendChild(banner);
        c.cleanup(() => banner.remove());
        Sound.play("fanfare");
        for (let i = 0; i < 7; i++) {
            const cols = [U.pick(NEON), U.pick(NEON), "#ffffff"];
            FX.burst({ x: U.rand(0.12, 0.88) * W, y: U.rand(0.1, 0.42) * H, n: 70, colors: cols, shape: "pixel", speed: [140, 420], even: true, gravity: 230, drag: 1.2, life: [0.9, 1.5], size: [3, 6], fade: false });
            Sound.play("firework");
            await c.wait(i < 3 ? 240 : 320);
            if (c.skipped) return;
        }
        const seconds = info.seconds || 0, bonusPts = Math.max(0, Math.round((6000 - seconds * 20) / 10) * 10);
        const s = banner.querySelector(".arc-clear-s");
        s.innerHTML = `<span>TIME ${U.fmtTime(seconds)}</span><span>BONUS <b>0</b></span>`;
        let lastCoin = 0;
        await FX.countUp(s.querySelector("b"), bonusPts, { dur: 1100, fmt: v => String(Math.round(v / 10) * 10), onStep: () => { const n = performance.now(); if (n - lastCoin > 60) { lastCoin = n; Sound.play("coin"); } } });
        if (c.skipped) return;
        banner.classList.add("blink");
        await c.wait(1500);
        if (c.skipped) return;
        banner.classList.add("out");
        await c.wait(300);
    }

    // ---------------------------------------------------------------------------------------------
    // Title card: STAGE x-y ... READY? ... GO!
    // ---------------------------------------------------------------------------------------------
    async function titleCard(c, info) {
        const stage = info.mode === "daily" ? `STAGE ${new Date().getDate()}-${["easy", "medium", "hard"].indexOf(info.difficulty) + 1}` : "BONUS STAGE";
        const card = U.el("div", { class: "tc tc-arcade", "aria-hidden": "true", html:
            `<div class="tca-band"><div class="tca-stage">${stage}</div><div class="tca-title">${U.esc(info.title)}</div><div class="tca-ready">READY?</div></div>` });
        document.getElementById("overlay").appendChild(card);
        c.cleanup(() => card.remove());
        Sound.play("title");
        await c.wait(1250);
        if (c.skipped) return;
        const ready = card.querySelector(".tca-ready");
        ready.textContent = "GO!";
        ready.classList.add("go");
        Sound.play("go");
        await c.wait(520);
        if (c.skipped) return;
        card.classList.add("out");
        await c.wait(300);
    }

    // ---------------------------------------------------------------------------------------------
    // The mascot: Bit, a pixel critter
    // ---------------------------------------------------------------------------------------------
    const BIT = [
        "..oo........oo..",
        ".obbo......obbo.",
        ".obbbo....obbbo.",
        ".obbbboooobbbbo.",
        "obbhbbbbbbbbbbbo",
        "obhbbbbbbbbbbbbo",
        "obbbbbbbbbbbbbbo",
        "obbbbbbbbbbbbbbo",
        "obbbbbbbbbbbbbbo",
        "obbbbbbbbbbbbbbo",
        ".obbbbbbbbbbbbo.",
        "..oooooooooooo.."
    ];
    function drawBit(g, s) {
        const P = 6, ox = 80 - 8 * P, hop = Math.round((Math.abs(Math.sin(s.t * 3)) * 2 + s.hop * 3)) * P * 0.5;
        const oy = 44 - hop;
        const col = { o: "#05d9e8", b: s.mood === "sad" ? "#7c5cff" : "#ff2a6d", h: "#ffc2d6" };
        g.save();
        g.shadowColor = "#05d9e8";
        g.shadowBlur = 12;
        BIT.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== ".") { g.fillStyle = col[ch]; g.fillRect(ox + x * P, oy + y * P, P, P); } }));
        g.shadowBlur = 0;
        // eyes
        const look = Math.round(s.look) * P * 0.5;
        g.fillStyle = "#ffffff";
        for (const ex of [4, 10]) {
            const x = ox + ex * P + look, y = oy + 5 * P;
            if (s.blink > 0.5) g.fillRect(x, y + P, P * 2, P * 0.6);
            else if (s.mood === "happy") { g.fillRect(x, y + P, P * 2, P * 0.7); g.fillRect(x - P * 0.4, y + P * 1.6, P * 0.5, P * 0.6); g.fillRect(x + P * 1.9, y + P * 1.6, P * 0.5, P * 0.6); }
            else { g.fillRect(x, y, P * 2, P * 2); g.fillStyle = "#0b0221"; g.fillRect(x + P * (s.mood === "wow" ? 0.5 : 1), y + P * 0.5, P, P); g.fillStyle = "#ffffff"; }
        }
        // mouth
        g.fillStyle = "#0b0221";
        if (s.mood === "wow" || s.talk > 0.4) g.fillRect(ox + 7 * P, oy + 8 * P, P * 2, P * (1 + Math.round(s.talk)));
        else if (s.mood === "sad") { g.fillRect(ox + 6.5 * P, oy + 9 * P, P * 3, P * 0.6); }
        else { g.fillRect(ox + 6.5 * P, oy + 8.5 * P, P * 0.6, P * 0.6); g.fillRect(ox + 7 * P, oy + 9 * P, P * 2, P * 0.6); g.fillRect(ox + 8.9 * P, oy + 8.5 * P, P * 0.6, P * 0.6); }
        // feet
        const step = Math.floor(s.t * 6) % 2;
        g.fillStyle = "#05d9e8";
        g.fillRect(ox + 4 * P, oy + 12 * P + (step ? 0 : -P / 2), P * 2, P);
        g.fillRect(ox + 10 * P, oy + 12 * P + (step ? -P / 2 : 0), P * 2, P);
        g.restore();
    }

    // ---------------------------------------------------------------------------------------------
    // Sounds: square waves & noise, like an old console
    // ---------------------------------------------------------------------------------------------
    const sounds = {
        type: () => tone({ f: U.pick([880, 988, 1047, 1175, 1319]), type: "square", d: 0.045, v: 0.035 }),
        erase: () => tone({ f: 440, f2: 220, type: "square", d: 0.07, v: 0.035 }),
        word: () => { const k = Math.min(6, board.combo || 1); [0, 4, 7, 12].forEach((n, i) => tone({ t: i * 0.045, f: midi(72 + n + (k - 1) * 2), type: "square", d: 0.08, v: 0.035 })); },
        wrong: () => [0, 0.11].forEach(t => tone({ t, f: 140, type: "square", d: 0.09, v: 0.05, filt: { f: 1200 } })),
        right: () => [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tone({ t: i * 0.035, f: midi(n), type: "square", d: 0.06, v: 0.03 })),
        reveal: () => tone({ f: 200, f2: 1600, type: "square", d: 0.25, v: 0.03 }),
        coin: () => { tone({ f: 988, type: "square", d: 0.05, v: 0.03 }); tone({ t: 0.045, f: 1319, type: "square", d: 0.12, v: 0.03 }); },
        firework: () => { noise({ type: "lowpass", f: 3000, f2: 300, d: 0.5, v: 0.18 }); tone({ f: 600, f2: 80, type: "square", d: 0.3, v: 0.03 }); },
        fanfare: () => {
            const mel = [[67, 0, 0.12], [72, 0.12, 0.12], [76, 0.24, 0.12], [79, 0.36, 0.3], [76, 0.68, 0.12], [79, 0.8, 0.12], [84, 0.92, 0.6]];
            mel.forEach(([n, t, d]) => { tone({ t, f: midi(n), type: "square", d, v: 0.045 }); tone({ t, f: midi(n - 12), type: "triangle", d, v: 0.05 }); });
            [0, 0.24, 0.48, 0.72, 0.92].forEach(t => noise({ t, type: "highpass", f: 6000, d: 0.04, v: 0.05 }));
        },
        win: () => {},
        go: () => { tone({ f: midi(84), type: "square", d: 0.25, v: 0.05 }); tone({ f: midi(72), type: "triangle", d: 0.3, v: 0.06 }); },
        title: () => [72, 0, 72, 0, 79].forEach((n, i) => n && tone({ t: i * 0.11, f: midi(n), type: "square", d: 0.09, v: 0.04 })),
        tile: i => tone({ f: midi(72 + (i % 8) * 2), type: "square", d: 0.05, v: 0.035 }),
        start: () => { sounds.coin(); [60, 64, 67, 72, 76, 79, 84, 88].forEach((n, i) => tone({ t: 0.2 + i * 0.04, f: midi(n), type: "square", d: 0.06, v: 0.03 })); },
        select: () => tone({ f: 1760, type: "square", d: 0.03, v: 0.03 }),
        nav: () => { noise({ type: "highpass", f: 3000, d: 0.05, v: 0.06 }); tone({ f: 880, f2: 1320, type: "square", d: 0.07, v: 0.03 }); },
        achievement: () => [76, 79, 88, 84, 86, 91].forEach((n, i) => tone({ t: i * 0.07, f: midi(n), type: "square", d: 0.07, v: 0.04 })),
        streak: () => [64, 67, 72, 76, 79, 84].forEach((n, i) => tone({ t: i * 0.05, f: midi(n), type: "square", d: 0.07, v: 0.035 }))
    };
    // ambient: a chiptune loop (118 bpm)
    const BASS = [45, 45, 57, 45, 41, 41, 53, 41, 43, 43, 55, 43, 40, 40, 52, 40];
    const LEAD = [69, -1, 72, 76, -1, 74, 72, -1, 69, -1, 67, -1, 64, -1, 67, -1];
    const music = {
        bpm: 118,
        tick(step, t) {
            const s = step % 16, bar = Math.floor(step / 16);
            if (s % 2 === 0) tone({ t, f: midi(BASS[(bar % 4) * 4 + (s / 4 | 0)]), type: "square", d: 0.1, v: 0.025, bus: "music", filt: { f: 1200 } });
            if (s % 4 === 0) noise({ t, type: "lowpass", f: 400, d: 0.08, v: 0.06, bus: "music" });
            if (s % 4 === 2) noise({ t, type: "highpass", f: 7000, d: 0.03, v: 0.025, bus: "music" });
            if (bar % 2 === 1 && LEAD[s] > 0) tone({ t, f: midi(LEAD[s]), type: "square", d: 0.12, v: 0.016, bus: "music" });
        }
    };

    Worlds.register({
        id: "arcade", name: "Neon Arcade", icon: "\u{1F579}️", tagline: "Synthwave sunsets, combos & pixel fireworks",
        modes: ["dark"],
        scene, board, celebrate, titleCard, sounds, music, transition: "pixels",
        mascot: { name: "BIT", draw: drawBit },
        lines: {
            hello: ["INSERT COIN... just kidding, it's free! Pick a stage!", "Player 1, ready?", "New high score incoming. I can feel it."],
            start: ["Tap a square, type letters. Space flips direction!", "Finish words back to back for a COMBO!"],
            word: ["+100!", "Nice combo!", "Word cleared!", "Power up!", "Keep the streak going!"],
            win: ["STAGE CLEAR! New high score?", "Flawless victory!", "GG! Ready for the next stage?"],
            wrong: ["Ouch, lost a life! A few letters are off.", "Glitch detected. Check the red squares."],
            right: ["Perfect run so far!", "No damage taken!"],
            idle: ["Stuck on this level? Try a crossing word.", "Pro tip: short words first!"],
            reveal: ["Cheat code activated..."]
        },
        introFlourish(stage) {
            const p = U.center(stage);
            for (let i = 0; i < 4; i++) setTimeout(() => FX.burst({ x: p.x + U.rand(-1, 1) * p.w * 0.6, y: p.y + U.rand(-1, 1) * p.h * 0.4, n: 50, colors: [U.pick(NEON), U.pick(NEON), "#fff"], shape: "pixel", speed: [120, 380], even: true, gravity: 200, life: [0.8, 1.3], size: [3, 6], fade: false }), i * 220);
        }
    });
})();
