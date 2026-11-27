// The NEON ARCADE world: a synthwave night drive.
//   Background: a striped retro sun setting behind wireframe mountains, a neon grid floor rushing toward you,
//   palm-tree silhouettes, stars, and a pixel UFO now and then. A CRT scanline filter sits over everything (CSS).
//   Board: neon squares, pixel fonts, pixel sparks on every letter, a 1UP score with word COMBOs.
//   Win: STAGE CLEAR!, pixel fireworks and a bonus tally.

(() => {
    const TAU = Math.PI * 2;
    const { tone, noise, midi } = Sound;
    const NEON = ["#ff2a6d", "#05d9e8", "#f9c80e", "#d16ba5", "#7c5cff", "#3dfc8a"];

    // The background is ArcadeScene (arcade-scene.js)

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
            if (game.solved && !game.surrendered && s > hi) { hi = s; U.store.set("arcade.hi", hi); hiEl.textContent = String(hi).padStart(6, "0"); }
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
        // a neon marquee draws itself round the banner, with a joystick, buttons and raining coins (Rive:
        // rive/arcade-win.riv); the board's squares power up one after another (Motion)
        const mw = Math.min(W * 0.98, 1100), mh = mw * 0.56;
        const sign = Anim.play("arcade-win", { ms: 5200, fadeMs: 300, rect: { x: (W - mw) / 2, y: H / 2 - mh * 0.48, w: mw, h: mh } });
        c.cleanup(() => sign.stop());
        const boardEl = document.getElementById("board");
        if (boardEl) Anim.motion().then(({ animate, stagger }) => {
            if (c.skipped) return;
            const cells = [...boardEl.querySelectorAll(".cell:not(.block)")];
            const run = animate(cells, { scale: [1, 1.18, 0.94, 1], filter: ["brightness(1)", "brightness(1.6) saturate(1.6)", "brightness(1)"] }, { duration: 0.45, delay: stagger(0.03), ease: "easeOut" });
            c.cleanup(() => { try { run.complete(); } catch (err) { /* done */ } cells.forEach(el => { el.style.transform = ""; el.style.filter = ""; }); });
        }).catch(() => null);
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
        const stage = info.stage ? info.stage : info.mode === "daily" ? `STAGE ${new Date().getDate()}-${["easy", "medium", "hard"].indexOf(info.difficulty) + 1}` : "BONUS STAGE";
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

    Worlds.register({
        id: "arcade", name: "Neon Arcade", icon: "\u{1F579}️", tagline: "Synthwave Nights. Pixel Fireworks.",
        modes: ["light", "dark"],
        scene: (W, H, opts) => ArcadeScene(W, H, opts), rive: "arcade-win", board, celebrate, titleCard, sounds, transition: "pixels",
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
