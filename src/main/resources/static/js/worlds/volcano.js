// The VOLCANO ISLAND world: a tropical island with a (mostly) friendly volcano.
//   Day: a bright beach: blue sky, a smoking volcano behind the jungle, a sparkling sea, swaying palm trees
//   and seagulls gliding by.
//   Night: an eruption: a red-violet sky, a glowing crater, lava rivers creeping down the slopes, embers
//   floating up and the sea reflecting the glow.
//   Board: each letter leaves an island treasure in its square (a shell, a hibiscus, a starfish, an ember,
//   a coconut, a lava pebble); finished words get a glowing lava crack along their edge.
//   Win: the volcano in the background rumbles and erupts: a lava fountain, lava rivers, confetti and fireworks.

(() => {
    const TAU = Math.PI * 2;
    const { tone, noise, midi } = Sound;
    const FIRE = ["#ffd23a", "#ff9a1f", "#ff5a1a", "#e8301a"];
    const TROPIC = ["#ff5c8a", "#ffd23a", "#2ec4b6", "#ff9a1f", "#7cdc5a", "#ffffff"];
    const dark = () => document.documentElement.dataset.theme === "dark";
    // The win makes the volcano in the background erupt: celebrate() sets the start time, the scene draws it,
    // and the scene tells celebrate() where the crater is on screen (for the confetti)
    let eruption = 0;
    const crater = { x: 0, y: 0 };

    // The background is VolcanoScene (volcano-scene.js); it erupts while eruption is set
    const scene = (W, H, opts) => VolcanoScene(W, H, opts, {
        crater,
        eruption: () => (eruption && !opts.preview ? (performance.now() - eruption) / 1000 : -1),
        done: () => { eruption = 0; }
    });

    // ---------------------------------------------------------------------------------------------
    // The board: an island treasure in each typed square; a glowing lava crack along finished words
    // ---------------------------------------------------------------------------------------------
    const TREASURES = [
        `<path d="M-.06 .04Q0 -.09 .06 .04Z" fill="#ffb08a"/><path d="M-.04 .04L0 -.04L.04 .04M-.02 .04L0 -.03L.02 .04" stroke="#d06a4a" stroke-width=".008" fill="none"/>`,
        `<g fill="#ff4f7a">${[0, 72, 144, 216, 288].map(a => `<ellipse cy="-.035" rx=".026" ry=".04" transform="rotate(${a})"/>`).join("")}</g><circle r=".016" fill="#ffd23a"/>`,
        `<path d="M0 -.065L.016 -.018L.062 -.02L.026 .012L.04 .058L0 .03L-.04 .058L-.026 .012L-.062 -.02L-.016 -.018Z" fill="#ff8a3a"/><circle r=".008" fill="#ffd0a0"/>`,
        `<circle r=".045" class="vc-ember"/><circle r=".02" fill="#fff2a0"/>`,
        `<circle r=".05" fill="#6a4020"/><circle cx="-.015" cy="-.012" r=".008" fill="#2a1408"/><circle cx=".015" cy="-.012" r=".008" fill="#2a1408"/><circle cy=".012" r=".008" fill="#2a1408"/>`,
        `<path d="M-.05 .02L-.03 -.04L.02 -.05L.055 -.01L.04 .04L-.02 .05Z" fill="#2a2228"/><path d="M-.03 -.01L.01 -.03L.03 .01" stroke="#ff7a2a" stroke-width=".01" fill="none"/>`
    ];
    const board = Worlds.decoBoard({
        id: "vc",
        mark: r => TREASURES[Math.floor(r(0) * TREASURES.length)],
        word(entry, cells, rnd, g, across) {
            const [r0, c0] = cells[0], len = cells.length;
            let d = "";
            const steps = len * 3;
            for (let i = 0; i <= steps; i++) {
                const u = 0.06 + i / steps * (len - 0.12), j = (rnd(i, 3) - 0.5) * 0.06;
                d += (i ? "L" : "M") + (across ? c0 + u : c0 + 0.94 + j).toFixed(3) + " " + (across ? r0 + 0.94 + j : r0 + u).toFixed(3);
            }
            U.svg("path", { d, class: "vc-glow", pathLength: "1" }, g);
            U.svg("path", { d, class: "vc-crack", pathLength: "1" }, g);
        },
        type(cell) {
            const p = U.center(cell);
            FX.burst({ x: p.x, y: p.y + p.h * 0.3, n: 7, colors: FIRE, shape: "spark", angle: -Math.PI / 2, spread: 0.7, speed: [80, 200], gravity: -40, drag: 2, life: [0.35, 0.6], size: [2, 3] });
        },
        wordDone(entry, cells) {
            cells.forEach(([r, c], i) => setTimeout(() => {
                const cell = Game.cellEl(r, c);
                if (!cell) return;
                const p = U.center(cell);
                FX.burst({ x: p.x, y: p.y, n: 8, colors: FIRE, shape: "circle", angle: -Math.PI / 2, spread: 0.9, speed: [60, 170], gravity: 260, life: [0.5, 0.8], size: [2, 4] });
            }, i * 60));
        }
    });

    // ---------------------------------------------------------------------------------------------
    // The win: the volcano in the background rumbles, then erupts in lava, confetti and fireworks
    // ---------------------------------------------------------------------------------------------
    async function celebrate(c) {
        if (U.motion() === "still") return;
        const W = innerWidth, H = innerHeight;
        const top = () => (crater.x ? { x: crater.x, y: crater.y } : { x: W * 0.62, y: H * 0.26 });
        // 1. the ground rumbles, harder and harder (the scene starts glowing and puffing)
        eruption = performance.now();
        // two carved tikis rise either side of the board, shudder with the rumbles and blaze when it blows
        // (Rive: rive/volcano-win.riv, timed to the steps below; the right one is its mirror image)
        const board = document.getElementById("board");
        const tikis = board ? [false, true].map(flip => Anim.play("volcano-win", { follow: board, flip, ms: 5400, fadeMs: 300, rect: r => {
            const w = Math.min(r.height * 0.5, W * 0.22), h = w * 840 / 360;
            return { x: flip ? r.right - w * 0.12 : r.left - w * 0.88, y: r.bottom + w * 0.15 - h, w, h };
        } })) : [];
        c.cleanup(() => tikis.forEach(a => a.stop()));
        Sound.play("rumble");
        FX.shake(4, 700);
        await c.wait(800);
        if (c.skipped) return;
        Sound.play("rumble");
        FX.shake(9, 700);
        await c.wait(800);
        if (c.skipped) return;
        // 2. ERUPTION: lava shoots out of the crater (drawn by the scene) along with confetti
        const p = top();
        Sound.play("erupt");
        if (board) Anim.motion().then(({ animate, stagger }) => {               // the letters jump with the blast, glowing hot
            if (c.skipped) return;
            const cells = [...board.querySelectorAll(".cell:not(.block)")];
            const run = animate(cells, { y: [0, -14, 3, 0], filter: ["brightness(1)", "brightness(1.35) sepia(.5) saturate(2.2) hue-rotate(-12deg)", "brightness(1)"] },
                { duration: 0.8, delay: stagger(0.03, { from: "first" }), ease: "easeOut" });
            c.cleanup(() => { try { run.complete(); } catch (err) { /* done */ } cells.forEach(el => { el.style.transform = ""; el.style.filter = ""; }); });
        }).catch(() => null);
        FX.flash("#ffb35a", 500, 0.4);
        FX.shake(14, 700);
        FX.ring({ x: p.x, y: p.y, color: "#ff8a1f", r1: Math.max(W, H) * 0.5, dur: 1, width: 14, glow: dark() });
        FX.burst({ x: p.x, y: p.y, n: 140, colors: TROPIC, shape: "rect", angle: -Math.PI / 2, spread: 0.6, speed: [500, 1100], gravity: 700, drag: 0.5, life: [2, 3.2], size: [7, 11] });
        FX.burst({ x: p.x, y: p.y, n: 50, colors: FIRE, shape: "star", angle: -Math.PI / 2, spread: 0.45, speed: [400, 900], gravity: 600, life: [1.5, 2.4], size: [5, 9], spin: 6 });
        FX.burst({ x: p.x, y: p.y, n: 40, colors: FIRE, shape: "spark", angle: -Math.PI / 2, spread: 0.6, speed: [300, 800], gravity: 400, life: [0.8, 1.4], size: [2, 4] });
        await c.wait(1000);
        if (c.skipped) return;
        // 3. fireworks of lava bursting high in the sky
        for (let i = 0; i < 3; i++) {
            const x = W * (0.25 + i * 0.25) + U.rand(-40, 40), y = H * U.rand(0.12, 0.28);
            Sound.play("pop");
            FX.ring({ x, y, color: FIRE[i], r1: 120, dur: 0.7, width: 4, glow: dark() });
            FX.burst({ x, y, n: 40, colors: [FIRE[i], "#ffffff", TROPIC[i]], shape: "spark", speed: [150, 330], gravity: 140, life: [0.9, 1.4], size: [2, 3] });
            await c.wait(350);
            if (c.skipped) return;
        }
        Sound.play("sparkle");
        await c.wait(1600);
    }

    // ---------------------------------------------------------------------------------------------
    // Title card: a stone tablet rises, its carved letters glowing like lava
    // ---------------------------------------------------------------------------------------------
    async function titleCard(c, info) {
        const card = U.el("div", { class: "tc tc-volcano", "aria-hidden": "true", html: `
            <div class="tcv-stone"><small>&#127755; ${U.esc(info.kicker)} &#127755;</small><h2>${U.esc(info.title)}</h2><p>${U.esc(info.sub)}</p></div>` });
        document.getElementById("overlay").appendChild(card);
        c.cleanup(() => card.remove());
        Sound.play("title");
        FX.shake(4, 500);
        await c.wait(700);
        if (c.skipped) return;
        const p = U.center(card.querySelector(".tcv-stone"));
        FX.burst({ x: p.x, y: p.y + p.h / 2, n: 24, colors: FIRE, shape: "spark", angle: -Math.PI / 2, spread: 1.2, speed: [120, 320], gravity: 200, life: [0.6, 1], size: [2, 3] });
        await c.wait(1300);
        if (c.skipped) return;
        card.classList.add("out");
        Sound.play("whoosh");
        await c.wait(450);
    }

    // ---------------------------------------------------------------------------------------------
    // The mascot: Ember, a cheerful little lava blob
    // ---------------------------------------------------------------------------------------------
    function drawEmber(g, s) {
        const happy = s.mood === "happy", wow = s.mood === "wow", sad = s.mood === "sad";
        const wob = Math.sin(s.t * (happy ? 10 : 3)) * (happy ? 0.05 : 0.025);
        g.save();
        g.translate(80, 140);
        g.scale(1 + wob, 1 - wob);
        g.translate(0, -s.hop * 12);
        // the glow
        const gl = g.createRadialGradient(0, -40, 10, 0, -40, 75);
        gl.addColorStop(0, "rgba(255,140,40,.45)"); gl.addColorStop(1, "rgba(255,90,20,0)");
        g.fillStyle = gl; g.beginPath(); g.arc(0, -40, 75, 0, TAU); g.fill();
        // the flame tuft on top, flickering
        for (let i = 0; i < 3; i++) {
            const h = 26 + Math.sin(s.t * 9 + i * 2) * 5 - i * 6, x = (i - 1) * 9;
            g.fillStyle = ["#ffd23a", "#ff9a1f", "#ffb84a"][i];
            g.beginPath(); g.moveTo(x - 9, -78); g.quadraticCurveTo(x - 4, -78 - h * 0.6, x + Math.sin(s.t * 7 + i) * 4, -78 - h); g.quadraticCurveTo(x + 6, -78 - h * 0.5, x + 9, -78); g.fill();
        }
        // the body: a blob with drips at the bottom
        const bg = g.createRadialGradient(-12, -60, 6, 0, -36, 60);
        bg.addColorStop(0, "#ffd86a"); bg.addColorStop(0.45, "#ff8a1f"); bg.addColorStop(1, "#d8361a");
        g.fillStyle = bg; g.strokeStyle = "#9a1e0e"; g.lineWidth = 2.5;
        g.beginPath();
        g.moveTo(-44, -6);
        g.bezierCurveTo(-52, -60, -24, -86, 0, -84);
        g.bezierCurveTo(24, -86, 52, -60, 44, -6);
        for (let i = 0; i <= 4; i++) { const x = 44 - i * 22, dr = i % 2 ? 8 + Math.sin(s.t * 2 + i) * 3 : 0; g.quadraticCurveTo(x + 11, dr + 2, x, -2 + dr * 0.3); }
        g.closePath(); g.fill(); g.stroke();
        // cracks of brighter lava on the skin
        g.strokeStyle = "rgba(255,240,150,.7)"; g.lineWidth = 2;
        g.beginPath(); g.moveTo(-30, -30); g.lineTo(-22, -24); g.lineTo(-26, -14); g.moveTo(26, -50); g.lineTo(32, -42); g.lineTo(28, -34); g.stroke();
        g.fillStyle = "rgba(255,255,255,.4)"; g.beginPath(); g.ellipse(-18, -64, 9, 5, -0.6, 0, TAU); g.fill();
        // face
        const ex = s.look * 3;
        for (const side of [-1, 1]) {
            const x = side * 13 + ex, y = -46;
            g.fillStyle = "#3a0a04";
            if (s.blink > 0.5) { g.fillRect(x - 5, y, 10, 2.5); continue; }
            if (happy) { g.lineWidth = 3; g.strokeStyle = "#3a0a04"; g.beginPath(); g.arc(x, y + 3, 5, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); continue; }
            g.beginPath(); g.ellipse(x, y, wow ? 5.5 : 4.5, wow ? 7.5 : 6.5, 0, 0, TAU); g.fill();
            g.fillStyle = "#fff4c0"; g.beginPath(); g.arc(x + 1.5, y - 2.5, 1.8, 0, TAU); g.fill();
        }
        g.fillStyle = "rgba(255,60,40,.45)"; g.beginPath(); g.ellipse(-26, -34, 6, 3.5, 0, 0, TAU); g.ellipse(26, -34, 6, 3.5, 0, 0, TAU); g.fill();
        const open = Math.max(s.talk, wow ? 0.8 : 0);
        g.strokeStyle = "#3a0a04"; g.lineWidth = 2.4;
        if (open > 0.1) { g.fillStyle = "#3a0a04"; g.beginPath(); g.ellipse(0, -30, 5, 2 + open * 5, 0, 0, TAU); g.fill(); }
        else { g.beginPath(); g.moveTo(-8, -32); g.quadraticCurveTo(0, sad ? -36 : -24, 8, -32); g.stroke(); }
        g.restore();
    }

    // ---------------------------------------------------------------------------------------------
    // Sounds: marimba and steel drum notes, bongos and a big (soft) rumble
    // ---------------------------------------------------------------------------------------------
    const marimba = (t, n, v = 0.08) => { tone({ t, f: midi(n), type: "sine", d: 0.35, v }); tone({ t, f: midi(n) * 4, type: "sine", d: 0.05, v: v * 0.3 }); };
    const steel = (t, n, v = 0.06) => { tone({ t, f: midi(n), type: "sine", d: 0.6, v }); tone({ t, f: midi(n) * 2.01, type: "sine", d: 0.4, v: v * 0.4 }); tone({ t, f: midi(n) * 3.02, type: "triangle", d: 0.2, v: v * 0.15 }); };
    const sounds = {
        type: () => tone({ f: U.pick([200, 230, 260]), f2: 140, type: "sine", d: 0.09, v: 0.16 }),
        erase: () => tone({ f: 160, f2: 110, type: "sine", d: 0.08, v: 0.12 }),
        move: () => {},
        word: () => [0, 4, 7, 12].forEach((k, i) => steel(i * 0.08, 72 + k, 0.06)),
        wrong: () => { marimba(0, 55, 0.12); marimba(0.15, 52, 0.12); },
        right: () => [0, 4, 7, 12, 16].forEach((k, i) => steel(i * 0.07, 74 + k, 0.055)),
        reveal: () => { tone({ f: 150, f2: 90, d: 0.4, v: 0.15 }); steel(0.15, 84, 0.05); },
        flip: () => marimba(0, 84, 0.05),
        rumble: () => { tone({ f: 48, f2: 36, d: 1, v: 0.35 }); noise({ type: "lowpass", f: 220, d: 1, v: 0.3 }); },
        erupt: () => { tone({ f: 90, f2: 30, d: 1.3, v: 0.5 }); noise({ type: "lowpass", f: 1400, f2: 150, d: 1.2, v: 0.35 }); [72, 76, 79, 84].forEach((n, i) => steel(0.3 + i * 0.08, n, 0.06)); },
        pop: () => { tone({ f: 180, f2: 80, d: 0.25, v: 0.15 }); steel(0.05, U.pick([84, 86, 88, 91]), 0.04); },
        sparkle: () => [88, 91, 96].forEach((n, i) => steel(i * 0.08, n, 0.035)),
        win: () => {},
        streak: () => [67, 72, 76, 79, 84].forEach((n, i) => steel(i * 0.07, n, 0.06)),
        achievement: () => [72, 76, 79, 84, 88].forEach((n, i) => steel(i * 0.08, n, 0.055)),
        title: () => { tone({ f: 60, f2: 45, d: 0.6, v: 0.25 }); [67, 72, 76].forEach((n, i) => steel(0.25 + i * 0.1, n, 0.06)); },
        tile: i => marimba(0, 72 + (i % 8) * 2, 0.07),
        start: () => { tone({ f: 70, f2: 40, d: 0.7, v: 0.3 }); [60, 67, 72, 76, 79].forEach((n, i) => steel(0.25 + i * 0.07, n, 0.06)); },
        select: () => marimba(0, 79, 0.05),
        nav: () => { marimba(0, 72, 0.06); marimba(0.07, 79, 0.05); },
        mascot: () => tone({ f: 300, f2: 500, type: "sine", d: 0.18, v: 0.07, vib: 15 })
    };

    Worlds.register({
        id: "volcano", name: "Volcano Island", icon: "\u{1F30B}", tagline: "Palm Trees and a Rumbling Volcano.",
        modes: ["light", "dark"],
        scene, rive: "volcano-win", board, celebrate, titleCard, sounds, transition: "lava",
        mascot: { name: "EMBER", draw: drawEmber },
        lines: {
            hello: ["Aloha! I'm Ember. Things are heating up!", "Welcome to Volcano Island! Mind the lava.", "A fresh puzzle just erupted!"],
            start: ["Tap a square and start typing. Space flips Across and Down!", "Fill every square before the volcano gets impatient."],
            word: ["Hot stuff!", "Lava-ly!", "On fire!", "Red hot!", "Sizzling!", "Magma-nificent!"],
            win: ["KABOOM! What an eruption!", "You're hotter than lava!", "That solve was explosive!"],
            wrong: ["Hmm, a few of those need to cool off.", "Some letters are a bit off the boil."],
            right: ["Hot, hot, hot! All correct!", "Every letter red hot!"],
            idle: ["Stuck? Try a crossing word, it might crack the case.", "Take a breather by the beach, then try the shortest clue."],
            reveal: ["Here comes a little spark...", "Melting the answer free!"]
        },
        introFlourish(stage) {
            const p = U.center(stage);
            FX.ring({ x: p.x, y: p.y, color: "#ff8a1f", r1: Math.max(innerWidth, innerHeight) * 0.6, dur: 1.1, width: 16, glow: true });
            FX.burst({ x: p.x, y: p.y, n: 80, colors: FIRE, shape: "spark", speed: [250, 750], gravity: 200, drag: 1, life: [1, 1.8], size: [2, 4] });
        }
    });
})();
