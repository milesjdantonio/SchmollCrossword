// The BIG TOP CARNIVAL world: a fairground with a striped circus tent and a Ferris wheel.
//   Day: a sunny fair: a red-and-white big top with flags waving, a turning Ferris wheel, strings of pennants
//   swaying overhead, a popcorn cart, and now and then a balloon escaping into the sky.
//   Night: the fair lit up: the wheel outlined in chasing coloured bulbs, string lights on the tent, searchlights
//   sweeping the sky and small fireworks popping far away.
//   Board: each letter leaves a fair keepsake in its square (a ticket, a popcorn, a star, a balloon, a juggling
//   ball, a ring); finished words get a row of marquee bulbs along their bottom (or right) edge.
//   Win: a "test your strength" tower appears, the puck flies up and rings the bell, and confetti and popcorn rain.

(() => {
    const TAU = Math.PI * 2;
    const { tone, noise, midi } = Sound;
    const FLAGS = ["#e8344e", "#ffcf3a", "#2e8ae0", "#3ac46a", "#ff8a1e", "#a05ae8"];
    const dark = () => document.documentElement.dataset.theme === "dark";

    // ---------------------------------------------------------------------------------------------
    // The board: a fair keepsake in each typed square; marquee bulbs chasing along finished words
    // ---------------------------------------------------------------------------------------------
    const KEEPSAKES = [
        `<path d="M-.065 -.035H.065V-.012A.012 .012 0 0 0 .065 .012V.035H-.065V.012A.012 .012 0 0 0 -.065 -.012Z" fill="#ffcf3a" stroke="#c8902a" stroke-width=".006"/><path d="M-.03 -.035V.035" stroke="#c8902a" stroke-width=".006" stroke-dasharray=".01 .008"/>`,
        `<g fill="#fff6d0" stroke="#e8c070" stroke-width=".006"><circle cx="-.015" cy=".01" r=".024"/><circle cx=".018" cy=".006" r=".022"/><circle cy="-.02" r=".024"/></g>`,
        `<path d="M0 -.06L.017 -.018L.06 -.018L.026 .008L.038 .05L0 .026L-.038 .05L-.026 .008L-.06 -.018L-.017 -.018Z" fill="#ff8a1e"/>`,
        r => `<ellipse cy="-.015" rx=".032" ry=".042" fill="${FLAGS[Math.floor(r(1) * 6)]}"/><path d="M0 .027Q.012 .05 -.004 .075" stroke="#6a6a6a" stroke-width=".006" fill="none"/>`,
        r => `<circle r=".042" fill="${FLAGS[Math.floor(r(1) * 6)]}"/><path d="M-.042 0A.042 .042 0 0 0 .042 0" fill="${FLAGS[Math.floor(r(2) * 6)]}"/><circle cx="-.014" cy="-.016" r=".009" fill="rgba(255,255,255,.6)"/>`,
        `<circle r=".045" fill="none" stroke="#2e8ae0" stroke-width=".016"/><circle r=".045" fill="none" stroke="#ffffff" stroke-width=".016" stroke-dasharray=".02 .02"/>`
    ];
    const board = Worlds.decoBoard({
        id: "cv",
        mark: r => { const k = KEEPSAKES[Math.floor(r(0) * KEEPSAKES.length)]; return typeof k === "function" ? k(r) : k; },
        word(entry, cells, rnd, g, across) {
            const [r0, c0] = cells[0], len = cells.length, n = len * 3;
            for (let i = 0; i < n; i++) {
                const u = (i + 0.5) / n * len;
                const b = U.svg("circle", { cx: (across ? c0 + u : c0 + 0.94).toFixed(3), cy: (across ? r0 + 0.94 : r0 + u).toFixed(3), r: ".03", class: "cv-bulb" }, g);
                b.style.animationDelay = `${((i % 3) * 0.25).toFixed(2)}s, ${(i * 0.06).toFixed(2)}s`;      // the chase, then the pop-in
            }
        },
        type(cell) {
            const p = U.center(cell);
            FX.burst({ x: p.x, y: p.y, n: 6, colors: FLAGS, shape: "rect", speed: [50, 140], gravity: 380, drag: 1.3, life: [0.4, 0.65], size: [4, 6] });
        },
        wordDone(entry, cells) {
            cells.forEach(([r, c], i) => setTimeout(() => {
                const cell = Game.cellEl(r, c);
                if (!cell) return;
                const p = U.center(cell);
                FX.burst({ x: p.x, y: p.y, n: 6, colors: ["#ffcf3a", "#ffffff", "#e8344e"], shape: "star", speed: [50, 140], gravity: 180, life: [0.5, 0.8], size: [3, 6], spin: 4 });
            }, i * 60));
        }
    });

    // ---------------------------------------------------------------------------------------------
    // The win: the "test your strength" tower: the puck flies up and rings the bell
    // ---------------------------------------------------------------------------------------------
    const TOWER = `<svg viewBox="0 0 80 400" preserveAspectRatio="none" aria-hidden="true">
        <rect x="32" y="40" width="16" height="350" fill="#ffffff" stroke="#c8c8c8" stroke-width="2"/>
        ${Array.from({ length: 10 }, (_, i) => `<rect x="20" y="${60 + i * 32}" width="40" height="26" rx="4" fill="${["#e8344e", "#ff8a1e", "#ffcf3a", "#3ac46a", "#2e8ae0", "#a05ae8"][i % 6]}" class="cv-seg" style="animation-delay:${((9 - i) * 0.06).toFixed(2)}s"/>`).join("")}
        <rect x="8" y="384" width="64" height="16" rx="3" fill="#8a5a2e"/></svg>`;
    async function celebrate(c, { boardEl }) {
        if (U.motion() === "still") return;
        const W = innerWidth, H = innerHeight, b = boardEl.getBoundingClientRect();
        const overlay = document.getElementById("overlay");
        const th = Math.min(H * 0.8, 520), tx = Math.min(W - 70, b.right + 30), ty = H - th - 10;
        // 1. the tower slides up beside the board (Rive: rive/carnival-win.riv plays the whole tower: the puck,
        //    the bulbs lighting, the bell, the chase, and sliding away, timed to the sounds below)
        const tw = th * 0.3, art = Anim.play("carnival-win", { ms: 4400, fadeMs: 200, rect: { x: tx - tw / 2, y: ty, w: tw, h: th } });
        c.cleanup(() => art.stop());
        const bellAt = { x: tx, y: ty + th * (84 / 800) };
        Sound.play("whoosh");
        await c.wait(800);
        if (c.skipped) return;
        // 2. WHACK: a hammer hit at the bottom sends the puck flying up
        Sound.play("whack");
        FX.shake(8, 250);
        FX.burst({ x: tx, y: H - 20, n: 18, colors: ["#ffcf3a", "#ffffff"], shape: "star", angle: -Math.PI / 2, spread: 1.2, speed: [120, 300], gravity: 400, life: [0.5, 0.8], size: [4, 7] });
        Sound.play("rise");
        await c.wait(650);
        if (c.skipped) return;
        // 3. DING DING DING! the bell rings
        Sound.play("bell");
        const bell = bellAt;
        FX.ring({ x: bell.x, y: bell.y, color: "#ffcf3a", r1: 220, dur: 0.7, width: 8, glow: dark() });
        FX.flash("#fff6d0", 300, 0.45);
        await c.wait(250);
        if (c.skipped) return;
        // 4. confetti and popcorn rain down
        FX.burst({ x: bell.x, y: bell.y, n: 70, colors: FLAGS, shape: "star", speed: [200, 600], gravity: 500, life: [1.4, 2.2], size: [5, 9], spin: 6 });
        FX.burst({ x: W / 2, y: -20, jitter: W / 2, jitterY: 10, n: 130, colors: FLAGS, shape: "rect", angle: Math.PI / 2, spread: 0.4, speed: [60, 200], gravity: 260, drag: 0.4, life: [2.4, 3.4], size: [6, 10], delay: [0, 0.9] });
        FX.burst({ x: W / 2, y: -20, jitter: W / 2, jitterY: 10, n: 40, colors: ["#fff6d0", "#ffeeb0"], shape: "circle", angle: Math.PI / 2, spread: 0.3, speed: [80, 200], gravity: 400, life: [1.8, 2.6], size: [5, 8], delay: [0.2, 1.1] });
        Sound.play("fanfare");
        await c.wait(2900);
    }

    // ---------------------------------------------------------------------------------------------
    // Title card: a marquee sign full of bulbs swings down on two chains
    // ---------------------------------------------------------------------------------------------
    async function titleCard(c, info) {
        const card = U.el("div", { class: "tc tc-carnival", "aria-hidden": "true", html: `
            <div class="tcc2-sign"><i class="tcc2-chain l"></i><i class="tcc2-chain r"></i><div class="tcc2-board"><small>&#9733; ${U.esc(info.kicker)} &#9733;</small><h2>${U.esc(info.title)}</h2><p>${U.esc(info.sub)}</p></div></div>` });
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
    // The mascot: Kernel, a striped popcorn bucket full of fluffy popcorn
    // ---------------------------------------------------------------------------------------------
    function drawKernel(g, s) {
        const happy = s.mood === "happy", wow = s.mood === "wow", sad = s.mood === "sad";
        const bounce = happy ? Math.abs(Math.sin(s.t * 9)) * 6 : 0;
        g.save();
        g.translate(80, 146 - s.hop * 12 - bounce);
        // little legs
        g.strokeStyle = "#5a2a1a"; g.lineWidth = 4; g.lineCap = "round";
        for (const side of [-1, 1]) { g.beginPath(); g.moveTo(side * 12, -6); g.lineTo(side * 14, 4); g.lineTo(side * 20, 4); g.stroke(); }
        // the bucket: red and white stripes, wider at the top
        g.save();
        g.beginPath(); g.moveTo(-28, -6); g.lineTo(-38, -78); g.lineTo(38, -78); g.lineTo(28, -6); g.closePath(); g.clip();
        for (let i = -5; i < 5; i++) { g.fillStyle = i % 2 ? "#ffffff" : "#e8344e"; g.beginPath(); g.moveTo(i * 9, -6); g.lineTo(i * 12, -80); g.lineTo((i + 1) * 12, -80); g.lineTo((i + 1) * 9, -6); g.fill(); }
        g.restore();
        g.strokeStyle = "#a81e2e"; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(-28, -6); g.lineTo(-38, -78); g.lineTo(38, -78); g.lineTo(28, -6); g.closePath(); g.stroke();
        // arms
        for (const side of [-1, 1]) {
            g.save(); g.translate(side * 32, -44); g.rotate(side * (0.6 + (happy ? Math.sin(s.t * 12 + side) * 0.5 : wow ? -1 : 0)));
            g.strokeStyle = "#5a2a1a"; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 0); g.lineTo(side * 14, 8); g.stroke();
            g.fillStyle = "#ffffff"; g.beginPath(); g.arc(side * 15, 9, 5, 0, TAU); g.fill();
            g.restore();
        }
        // the popcorn heaped on top, kernels jiggling
        const pops = [[-30, -84, 11], [-14, -92, 13], [4, -94, 13], [22, -88, 12], [34, -80, 9], [-4, -104, 11], [14, -104, 10], [-22, -100, 9]];
        pops.forEach(([x, y, r], i) => {
            const j = Math.sin(s.t * (happy ? 14 : 3) + i * 1.7) * (happy ? 2 : 0.6);
            g.fillStyle = "#fff6d8"; g.strokeStyle = "#e8c070"; g.lineWidth = 1.5;
            g.beginPath(); g.arc(x, y + j, r, 0, TAU); g.arc(x + r * 0.5, y + j - r * 0.4, r * 0.6, 0, TAU); g.fill();
            g.fillStyle = "#ffd86a"; g.beginPath(); g.arc(x - r * 0.3, y + j + r * 0.3, r * 0.3, 0, TAU); g.fill();
        });
        // the face on the bucket, in a white label
        g.fillStyle = "#ffffff"; g.strokeStyle = "#a81e2e"; g.lineWidth = 2;
        g.beginPath(); g.ellipse(0, -40, 22, 18, 0, 0, TAU); g.fill(); g.stroke();
        const ex = s.look * 2.5;
        for (const side of [-1, 1]) {
            const x = side * 8 + ex, y = -44;
            g.fillStyle = "#2a1a1a";
            if (s.blink > 0.5) { g.fillRect(x - 4, y, 8, 2.2); continue; }
            if (happy) { g.lineWidth = 2.4; g.strokeStyle = "#2a1a1a"; g.beginPath(); g.arc(x, y + 2, 4, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); continue; }
            g.beginPath(); g.arc(x, y, wow ? 4.4 : 3.5, 0, TAU); g.fill();
            g.fillStyle = "#ffffff"; g.beginPath(); g.arc(x + 1.2, y - 1.4, 1.2, 0, TAU); g.fill();
        }
        g.fillStyle = "rgba(255,120,140,.45)"; g.beginPath(); g.ellipse(-15, -36, 4, 2.5, 0, 0, TAU); g.ellipse(15, -36, 4, 2.5, 0, 0, TAU); g.fill();
        const open = Math.max(s.talk, wow ? 0.8 : 0);
        g.strokeStyle = "#2a1a1a"; g.lineWidth = 2;
        if (open > 0.1) { g.fillStyle = "#7a1a2a"; g.beginPath(); g.ellipse(0, -32, 4, 1.5 + open * 4, 0, 0, TAU); g.fill(); }
        else { g.beginPath(); g.moveTo(-6, -34); g.quadraticCurveTo(0, sad ? -36 : -28, 6, -34); g.stroke(); }
        g.restore();
    }

    // ---------------------------------------------------------------------------------------------
    // Sounds: a soft calliope (a fairground steam organ), pops and a bell
    // ---------------------------------------------------------------------------------------------
    const pipe = (t, n, v = 0.05, d = 0.22) => { tone({ t, f: midi(n), type: "square", d, v: v * 0.5, filt: { f: 1800 }, vib: 5 }); tone({ t, f: midi(n), type: "sine", d, v }); };
    const bell = (t, n, v = 0.06) => { tone({ t, f: midi(n), type: "sine", d: 1.2, v, echo: 0.2 }); tone({ t, f: midi(n) * 2.76, type: "sine", d: 0.5, v: v * 0.3 }); };
    const sounds = {
        type: () => tone({ f: U.pick([500, 560, 620]), f2: 1000, type: "sine", d: 0.06, v: 0.08 }),
        erase: () => tone({ f: 700, f2: 400, type: "sine", d: 0.07, v: 0.06 }),
        move: () => {},
        word: () => [0, 4, 7, 12].forEach((k, i) => pipe(i * 0.08, 72 + k, 0.05, 0.16)),
        wrong: () => { pipe(0, 60, 0.07, 0.25); pipe(0.22, 59, 0.07, 0.25); pipe(0.44, 58, 0.07, 0.4); },
        right: () => { [0, 4, 7, 12].forEach((k, i) => pipe(i * 0.07, 72 + k, 0.05, 0.15)); bell(0.3, 84, 0.04); },
        reveal: () => { tone({ f: 400, f2: 1000, type: "sine", d: 0.25, v: 0.07 }); bell(0.2, 88, 0.03); },
        flip: () => tone({ f: 900, f2: 1300, type: "sine", d: 0.05, v: 0.04 }),
        whack: () => { tone({ f: 140, f2: 60, d: 0.3, v: 0.4 }); noise({ type: "lowpass", f: 800, d: 0.3, v: 0.25 }); },
        rise: () => tone({ f: 200, f2: 1600, type: "sine", d: 0.6, v: 0.07 }),
        bell: () => [0, 0.18, 0.36].forEach(t => bell(t, 88, 0.08)),
        fanfare: () => [[0, 72], [0.12, 76], [0.24, 79], [0.42, 84]].forEach(([t, n], i) => pipe(t, n, 0.06, i === 3 ? 0.6 : 0.14)),
        sparkle: () => [88, 91, 96].forEach((n, i) => bell(i * 0.08, n, 0.03)),
        win: () => {},
        streak: () => [67, 72, 76, 79].forEach((n, i) => pipe(i * 0.09, n, 0.05, 0.15)),
        achievement: () => { [72, 76, 79, 84].forEach((n, i) => pipe(i * 0.08, n, 0.05, 0.14)); bell(0.36, 88, 0.05); },
        title: () => [[0, 67], [0.15, 72], [0.3, 76], [0.45, 79], [0.6, 76], [0.75, 79]].forEach(([t, n]) => pipe(t, n, 0.045, 0.14)),
        tile: i => pipe(0, 72 + (i % 8) * 2, 0.04, 0.1),
        start: () => { [60, 64, 67, 72, 76, 79].forEach((n, i) => pipe(i * 0.07, n, 0.05, 0.14)); bell(0.5, 84, 0.05); },
        select: () => tone({ f: 1000, type: "sine", d: 0.05, v: 0.04 }),
        nav: () => { pipe(0, 76, 0.035, 0.08); pipe(0.07, 79, 0.035, 0.08); },
        mascot: () => { tone({ f: 600, f2: 1200, type: "sine", d: 0.07, v: 0.06 }); tone({ t: 0.08, f: 700, f2: 1400, type: "sine", d: 0.07, v: 0.05 }); }
    };

    Worlds.register({
        id: "carnival", name: "Big Top Carnival", icon: "\u{1F3AA}", tagline: "Step Right Up to the Big Top.",
        modes: ["light", "dark"],
        scene: (W, H, opts) => CarnivalScene(W, H, opts), rive: "carnival-win", board, celebrate, titleCard, sounds, transition: "curtain",
        mascot: { name: "KERNEL", draw: drawKernel },
        lines: {
            hello: ["Step right up! I'm Kernel, and the puzzle's about to start!", "Welcome to the greatest crossword on Earth!", "Grab some popcorn, it's showtime!"],
            start: ["Tap a square and start typing. Space flips Across and Down!", "Every square you fill wins a prize!"],
            word: ["Ta-da!", "Pop-tastic!", "Bravo!", "A real crowd-pleaser!", "Jackpot!", "Showstopper!"],
            win: ["DING DING DING! We have a winner!", "Take a bow, superstar!", "The crowd goes wild!"],
            wrong: ["Hmm, a few of those missed the target.", "Some letters need another throw."],
            right: ["Bullseye! All correct!", "A perfect performance!"],
            idle: ["Stuck? Try a crossing word, maybe it's a ticket in.", "Take a spin on the Ferris wheel, then try the shortest clue."],
            reveal: ["And for my next trick...", "Abracadabra, a letter!"]
        },
        introFlourish(stage) {
            const p = U.center(stage);
            FX.ring({ x: p.x, y: p.y, color: "#ffcf3a", r1: Math.max(innerWidth, innerHeight) * 0.6, dur: 1.1, width: 14, glow: false });
            FX.burst({ x: p.x, y: p.y, n: 100, colors: FLAGS, shape: "rect", speed: [200, 700], gravity: 300, drag: 1, life: [1.4, 2.4], size: [6, 9] });
        }
    });
})();
