// The DESERT CARAVAN world: rolling dunes, a camel caravan and buried treasure.
//   Day: golden dunes in layers, a blazing sun, heat shimmer over the sand, a distant mesa and pyramid, cacti,
//   a camel caravan plodding along the far ridge and tumbleweeds rolling past.
//   Night: a cold blue desert under a giant moon and the Milky Way, the caravan carrying lanterns, and a
//   crackling campfire in front.
//   Board: each letter leaves a carved desert symbol in its square (a sun, waves, a spiral, mountains, a bird
//   track, a scarab); finished words get a carved sandstone border.
//   Win: a sandstorm sweeps across, then a treasure chest rises from the sand and bursts open with gold and gems.

(() => {
    const TAU = Math.PI * 2;
    const { tone, noise, midi } = Sound;
    const SAND = ["#e8c27a", "#d9a85a", "#f3dca2", "#c48a42"];
    const GOLD = ["#ffd23a", "#ffe680", "#e8a820", "#fff2b0"];
    const GEMS = ["#e8344e", "#2ec4b6", "#7a5cff", "#3ac45a"];
    const dark = () => document.documentElement.dataset.theme === "dark";

    // ---------------------------------------------------------------------------------------------
    // The board: a carved symbol in each typed square; a sandstone border along finished words
    // ---------------------------------------------------------------------------------------------
    const GLYPHS = [
        `<circle r=".035" class="ds-carve"/><g class="ds-carve-line">${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<path d="M0 -.05V-.068" transform="rotate(${a})"/>`).join("")}</g>`,
        `<path d="M-.06 -.02Q-.045 -.04 -.03 -.02T0 -.02T.03 -.02T.06 -.02M-.06 .02Q-.045 0 -.03 .02T0 .02T.03 .02T.06 .02" class="ds-carve-line"/>`,
        `<path d="M0 0Q.02 -.02 .03 0Q.03 .04 0 .04Q-.05 .04 -.05 0Q-.05 -.06 0 -.06Q.06 -.06 .06 0" class="ds-carve-line"/>`,
        `<path d="M-.065 .04L-.025 -.03L0 .01L.025 -.045L.065 .04Z" class="ds-carve-line"/>`,
        `<path d="M0 .05V-.01M0 -.01L-.035 -.05M0 -.01L.035 -.05M0 -.01V-.06" class="ds-carve-line"/>`,
        `<ellipse cy=".01" rx=".032" ry=".042" class="ds-carve"/><path d="M0 -.03V.05M-.032 -.045L-.05 -.06M.032 -.045L.05 -.06M-.03 .02L-.055 .03M.03 .02L.055 .03" class="ds-carve-line"/>`
    ];
    const board = Worlds.decoBoard({
        id: "ds",
        mark: r => GLYPHS[Math.floor(r(0) * GLYPHS.length)],
        word(entry, cells, rnd, g, across) {
            const [r0, c0] = cells[0], len = cells.length;
            const line = off => across ? `M${c0 + 0.06} ${r0 + off}H${c0 + len - 0.06}` : `M${c0 + off} ${r0 + 0.06}V${r0 + len - 0.06}`;
            U.svg("path", { d: line(0.9), class: "ds-border", pathLength: "1" }, g);
            U.svg("path", { d: line(0.955), class: "ds-border thin", pathLength: "1" }, g);
            for (let i = 0; i < len * 4; i++) {
                const u = 0.12 + i / (len * 4) * (len - 0.24);
                U.svg("rect", { x: (across ? c0 + u : c0 + 0.915).toFixed(3), y: (across ? r0 + 0.915 : r0 + u).toFixed(3), width: ".025", height: ".025", class: "ds-dot", transform: `rotate(45 ${(across ? c0 + u + 0.0125 : c0 + 0.9275).toFixed(3)} ${(across ? r0 + 0.9275 : r0 + u + 0.0125).toFixed(3)})` }, g);
            }
        },
        type(cell) {
            const p = U.center(cell);
            FX.burst({ x: p.x, y: p.y + p.h * 0.25, n: 7, colors: SAND, shape: "circle", angle: -Math.PI / 2, spread: 1.4, speed: [40, 120], gravity: 300, drag: 1.5, life: [0.35, 0.6], size: [1.5, 3] });
        },
        wordDone(entry, cells) {
            cells.forEach(([r, c], i) => setTimeout(() => {
                const cell = Game.cellEl(r, c);
                if (!cell) return;
                const p = U.center(cell);
                FX.burst({ x: p.x, y: p.y, n: 5, colors: GOLD, shape: "star", speed: [40, 120], gravity: 100, life: [0.5, 0.8], size: [3, 5], spin: 4 });
            }, i * 60));
        }
    });

    // ---------------------------------------------------------------------------------------------
    // The win: a sandstorm sweeps across, then a treasure chest rises and bursts open
    // ---------------------------------------------------------------------------------------------
    const CHEST = `<svg viewBox="0 0 160 130" aria-hidden="true">
        <g class="ds-lid"><path d="M10 50Q10 14 80 12Q150 14 150 50Z" fill="#8a4a1e"/><path d="M10 50Q10 14 80 12Q150 14 150 50" fill="none" stroke="#e8a820" stroke-width="6"/>
        <path d="M40 18V50M120 18V50" stroke="#e8a820" stroke-width="6"/></g>
        <rect x="10" y="50" width="140" height="74" rx="6" fill="#a65a24"/><path d="M10 64H150" stroke="#7a3e14" stroke-width="3"/>
        <path d="M40 50V124M120 50V124" stroke="#e8a820" stroke-width="6"/><rect x="10" y="50" width="140" height="74" rx="6" fill="none" stroke="#e8a820" stroke-width="6"/>
        <rect x="68" y="56" width="24" height="26" rx="4" fill="#ffd23a" stroke="#a87a10" stroke-width="2"/><circle cx="80" cy="66" r="4" fill="#5a3a10"/><path d="M80 66V75" stroke="#5a3a10" stroke-width="3"/>
        </svg>`;
    async function celebrate(c, { boardEl }) {
        if (U.motion() === "still") return;
        const W = innerWidth, H = innerHeight, b = boardEl.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
        const overlay = document.getElementById("overlay");
        // 1. a sandstorm blows across the screen
        Sound.play("wind");
        FX.burst({ x: W + 30, y: H / 2, jitter: 10, jitterY: H / 2, n: U.motion() === "lite" ? 120 : 260, colors: SAND, shape: "spark", angle: Math.PI, spread: 0.12, speed: [700, 1300], gravity: 0, drag: 0.2, life: [1.2, 1.8], size: [2, 4], delay: [0, 0.8] });
        FX.shake(4, 900);
        await c.wait(1300);
        if (c.skipped) return;
        // 2. a treasure chest rises out of the sand in front of the board, wobbles and bursts open (Rive:
        //    rive/desert-win.riv plays the whole chest, timed to the coins below)
        const side = Math.min(W * 0.9, b.width * 1.15);
        const art = Anim.play("desert-win", { follow: boardEl, ms: 4700, fadeMs: 300, rect: r => ({ x: r.left + r.width / 2 - side / 2, y: r.top + r.height / 2 - side * 0.6, w: side, h: side }) });
        c.cleanup(() => art.stop());
        Sound.play("thud");
        await c.wait(800);
        if (c.skipped) return;
        Sound.play("rattle");
        await c.wait(520);
        if (c.skipped) return;
        Sound.play("treasure");
        const p = { x: cx, y: cy - side * 0.6 + side * (260 / 600) };
        FX.flash("#fff2b0", 400, 0.5);
        FX.burst({ x: p.x, y: p.y - 20, n: 90, colors: GOLD, shape: "circle", angle: -Math.PI / 2, spread: 0.9, speed: [300, 800], gravity: 900, drag: 0.4, life: [1.6, 2.4], size: [5, 8] });
        FX.burst({ x: p.x, y: p.y - 20, n: 30, colors: GEMS, shape: "star", angle: -Math.PI / 2, spread: 0.7, speed: [300, 700], gravity: 700, life: [1.6, 2.2], size: [6, 10], spin: 6 });
        await c.wait(1200);
        if (c.skipped) return;
        // 4. glints over everything
        FX.burst({ x: W / 2, y: H / 2, jitter: W / 2, jitterY: H / 2, n: 40, colors: GOLD, shape: "star", speed: [5, 20], gravity: 0, life: [0.8, 1.4], size: [4, 8], delay: [0, 1], spin: 3 });
        Sound.play("sparkle");
        await c.wait(1900);
    }

    // ---------------------------------------------------------------------------------------------
    // Title card: a papyrus scroll unrolls
    // ---------------------------------------------------------------------------------------------
    async function titleCard(c, info) {
        const card = U.el("div", { class: "tc tc-desert", "aria-hidden": "true", html: `
            <div class="tcd-scroll"><i class="tcd-roll l"></i><div class="tcd-paper"><small>&#9728; ${U.esc(info.kicker)} &#9728;</small><h2>${U.esc(info.title)}</h2><p>${U.esc(info.sub)}</p></div><i class="tcd-roll r"></i></div>` });
        document.getElementById("overlay").appendChild(card);
        c.cleanup(() => card.remove());
        Sound.play("title");
        await c.wait(2000);
        if (c.skipped) return;
        card.classList.add("out");
        Sound.play("whoosh");
        await c.wait(450);
    }

    // ---------------------------------------------------------------------------------------------
    // The mascot: Sandy, a fennec fox with enormous ears
    // ---------------------------------------------------------------------------------------------
    function drawSandy(g, s) {
        const happy = s.mood === "happy", wow = s.mood === "wow", sad = s.mood === "sad";
        g.save();
        g.translate(80, 146 - s.hop * 12);
        // the bushy tail, swishing
        g.save(); g.translate(26, -18); g.rotate(-0.5 + Math.sin(s.t * (happy ? 9 : 2.5)) * (happy ? 0.35 : 0.15));
        g.fillStyle = "#e8a85a"; g.beginPath(); g.ellipse(18, -6, 24, 11, -0.4, 0, TAU); g.fill();
        g.fillStyle = "#fff4e0"; g.beginPath(); g.ellipse(36, -14, 9, 7, -0.4, 0, TAU); g.fill();
        g.restore();
        // the body
        g.fillStyle = "#f0b868"; g.strokeStyle = "#a8682a"; g.lineWidth = 2.5;
        g.beginPath(); g.ellipse(0, -24, 26, 24, 0, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = "#fff4e0"; g.beginPath(); g.ellipse(0, -18, 15, 16, 0, 0, TAU); g.fill();
        // paws
        g.fillStyle = "#f0b868";
        for (const side of [-1, 1]) { g.beginPath(); g.ellipse(side * 12, -2, 9, 6, 0, 0, TAU); g.fill(); g.stroke(); }
        // a little blue scarf
        g.fillStyle = "#2e8ac4"; g.beginPath(); g.ellipse(0, -44, 20, 6, 0, 0, TAU); g.fill();
        g.beginPath(); g.moveTo(8, -42); g.lineTo(18, -26 + Math.sin(s.t * 5) * 2); g.lineTo(10, -28); g.fill();
        // the head and HUGE ears
        g.translate(0, -70 + Math.sin(s.t * 2) * 1.5);
        g.rotate(s.look * 0.06);
        for (const side of [-1, 1]) {
            g.save(); g.translate(side * 14, -14); g.rotate(side * (0.45 + (wow ? -0.15 : sad ? 0.35 : 0) + Math.sin(s.t * 1.7 + side) * 0.04));
            g.fillStyle = "#f0b868"; g.strokeStyle = "#a8682a";
            g.beginPath(); g.moveTo(-14, 6); g.quadraticCurveTo(-12, -40, 0, -52); g.quadraticCurveTo(12, -40, 14, 6); g.closePath(); g.fill(); g.stroke();
            g.fillStyle = "#ffc8b0"; g.beginPath(); g.moveTo(-8, 2); g.quadraticCurveTo(-6, -32, 0, -42); g.quadraticCurveTo(6, -32, 8, 2); g.closePath(); g.fill();
            g.restore();
        }
        g.fillStyle = "#f0b868"; g.strokeStyle = "#a8682a";
        g.beginPath(); g.ellipse(0, 0, 26, 22, 0, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = "#fff4e0"; g.beginPath(); g.moveTo(-20, 6); g.quadraticCurveTo(0, -4, 20, 6); g.quadraticCurveTo(10, 20, 0, 22); g.quadraticCurveTo(-10, 20, -20, 6); g.fill();
        g.fillStyle = "#2a1a10"; g.beginPath(); g.ellipse(0, 8, 4.5, 3.2, 0, 0, TAU); g.fill();
        const ex = s.look * 2.5;
        for (const side of [-1, 1]) {
            const x = side * 10 + ex, y = -4;
            g.fillStyle = "#2a1a10";
            if (s.blink > 0.5) { g.fillRect(x - 4, y, 8, 2.2); continue; }
            if (happy) { g.lineWidth = 2.4; g.strokeStyle = "#2a1a10"; g.beginPath(); g.arc(x, y + 2, 4, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); continue; }
            g.beginPath(); g.ellipse(x, y, wow ? 4.5 : 3.6, wow ? 5.5 : 4.6, 0, 0, TAU); g.fill();
            g.fillStyle = "#ffffff"; g.beginPath(); g.arc(x + 1.2, y - 1.6, 1.3, 0, TAU); g.fill();
        }
        const open = Math.max(s.talk, wow ? 0.7 : 0);
        g.strokeStyle = "#2a1a10"; g.lineWidth = 1.8;
        if (open > 0.1) { g.fillStyle = "#7a2a2a"; g.beginPath(); g.ellipse(0, 15, 3.5, 1.5 + open * 3.5, 0, 0, TAU); g.fill(); }
        else { g.beginPath(); g.moveTo(-5, 13); g.quadraticCurveTo(0, sad ? 11 : 17, 5, 13); g.stroke(); }
        g.restore();
    }

    // ---------------------------------------------------------------------------------------------
    // Sounds: plucked strings, hand drums and desert wind
    // ---------------------------------------------------------------------------------------------
    const pluck = (t, n, v = 0.07) => { tone({ t, f: midi(n), type: "triangle", d: 0.45, v, a: 0.003, filt: { f: 2200 } }); tone({ t, f: midi(n) * 2, type: "sine", d: 0.15, v: v * 0.3 }); };
    const drum = (t, f = 110, v = 0.18) => tone({ t, f, f2: f * 0.55, type: "sine", d: 0.18, v });
    const sounds = {
        type: () => drum(0, U.pick([160, 180, 200]), 0.12),
        erase: () => drum(0, 120, 0.1),
        move: () => {},
        word: () => [62, 65, 67, 69].forEach((n, i) => pluck(i * 0.08, n + 12, 0.06)),
        wrong: () => { pluck(0, 57, 0.1); pluck(0.16, 56, 0.1); },
        right: () => [62, 65, 67, 69, 74].forEach((n, i) => pluck(i * 0.07, n + 12, 0.06)),
        reveal: () => { noise({ type: "bandpass", f: 600, f2: 1400, d: 0.5, v: 0.08, q: 0.8 }); pluck(0.15, 81, 0.05); },
        flip: () => pluck(0, 86, 0.035),
        wind: () => noise({ type: "bandpass", f: 400, f2: 1400, d: 1.4, v: 0.16, q: 0.6 }),
        thud: () => { drum(0, 90, 0.3); noise({ type: "lowpass", f: 400, d: 0.3, v: 0.15 }); },
        rattle: () => [0, 0.08, 0.16].forEach(t => drum(t, 140, 0.1)),
        treasure: () => { drum(0, 80, 0.25); [74, 77, 81, 86, 89, 93].forEach((n, i) => pluck(0.05 + i * 0.05, n, 0.06)); },
        sparkle: () => [86, 89, 93].forEach((n, i) => tone({ t: i * 0.08, f: midi(n), type: "sine", d: 0.5, v: 0.035, echo: 0.3 })),
        win: () => {},
        streak: () => [62, 65, 69, 74].forEach((n, i) => pluck(i * 0.08, n + 12, 0.06)),
        achievement: () => { drum(0, 100, 0.2); [74, 77, 81, 86].forEach((n, i) => pluck(0.08 + i * 0.08, n, 0.06)); },
        title: () => { noise({ type: "bandpass", f: 300, f2: 900, d: 0.8, v: 0.08, q: 0.6 }); drum(0.1, 90, 0.2); [62, 65, 69].forEach((n, i) => pluck(0.35 + i * 0.12, n + 12, 0.06)); },
        tile: i => pluck(0, 74 + [0, 3, 5, 7, 10, 12, 15, 17][i % 8], 0.05),
        start: () => { [0, 0.15, 0.3].forEach(t => drum(t, 100, 0.2)); [62, 65, 67, 69, 74].forEach((n, i) => pluck(0.45 + i * 0.07, n + 12, 0.06)); },
        select: () => pluck(0, 81, 0.035),
        nav: () => noise({ type: "bandpass", f: 500, f2: 1200, d: 0.3, v: 0.06, q: 0.8 }),
        mascot: () => { tone({ f: 900, f2: 1300, type: "sine", d: 0.07, v: 0.05 }); tone({ t: 0.08, f: 1100, f2: 1500, type: "sine", d: 0.07, v: 0.04 }); }
    };

    Worlds.register({
        id: "desert", name: "Desert Caravan", icon: "\u{1F3DC}️", tagline: "Golden Dunes. Endless Sky.",
        modes: ["light", "dark"],
        scene: (W, H, opts) => DesertScene(W, H, opts), rive: "desert-win", board, celebrate, titleCard, sounds, transition: "sandstorm",
        mascot: { name: "SANDY", draw: drawSandy },
        lines: {
            hello: ["Hi, I'm Sandy! My ears heard a puzzle coming.", "Welcome to the desert! Plenty of words buried here.", "Grab some water, it's puzzle time!"],
            start: ["Tap a square and start typing. Space flips Across and Down!", "Dig in! Every answer is buried treasure."],
            word: ["Dune-derful!", "Treasure found!", "Golden!", "Sand-sational!", "What a find!", "Struck gold!"],
            win: ["You found the treasure!", "A legendary expedition!", "The caravan is throwing you a party!"],
            wrong: ["Hmm, a few of those are mirages.", "Some letters got lost in the sand."],
            right: ["Pure gold, every letter!", "Not a grain out of place!"],
            idle: ["Stuck? Try a crossing word, it might point the way.", "Every oasis starts with one letter. Try the shortest clue!"],
            reveal: ["Brushing off a hint...", "Here's a clue from my map!"]
        },
        introFlourish(stage) {
            const p = U.center(stage);
            FX.ring({ x: p.x, y: p.y, color: "#e8a820", r1: Math.max(innerWidth, innerHeight) * 0.6, dur: 1.2, width: 14, glow: false });
            FX.burst({ x: p.x, y: p.y, n: 70, colors: GOLD, shape: "circle", speed: [200, 650], gravity: 300, drag: 1, life: [1.2, 2], size: [4, 7] });
        }
    });
})();
