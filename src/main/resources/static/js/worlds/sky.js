// The SKY KINGDOM world: floating islands high above the clouds.
//   Day: a bright blue sky, a warm sun, floating islands with waterfalls spilling off their edges and a tiny
//   castle, layers of drifting clouds, a flock of birds and hot-air balloons rising past.
//   Night: a deep starry sky over a sunset glow, a crescent moon, the islands with lit windows, and paper sky
//   lanterns drifting up.
//   Board: each letter leaves something airy in its square (a feather, a tiny cloud, a kite, a balloon, a paper
//   plane, a star); finished words get a rainbow ribbon.
//   Win: a crowd of balloons launches past the board, three paper planes loop around it trailing clouds, confetti drifts down.

(() => {
    const TAU = Math.PI * 2;
    const { tone, noise, midi } = Sound;
    const BALLOONS = ["#ff5c6c", "#ffb627", "#4cc3ff", "#7bd96a", "#b07cff", "#ff8ad8"];
    const RAINBOW = ["#ff5c5c", "#ff9f40", "#ffd84a", "#6fd36a", "#4cb3ff", "#9a7cff"];
    const dark = () => document.documentElement.dataset.theme === "dark";

    // ---------------------------------------------------------------------------------------------
    // The board: something airy in each typed square; a rainbow ribbon along finished words
    // ---------------------------------------------------------------------------------------------
    const AIRY = [
        r => `<path d="M-.06 .06Q-.04 -.04 .06 -.07Q.03 .03 -.06 .06Z" fill="#ffffff" stroke="#9ab4d4" stroke-width=".008"/><path d="M-.06 .06L.03 -.04" stroke="#9ab4d4" stroke-width=".008"/>`,
        r => `<g fill="#ffffff" stroke="#b4c8e4" stroke-width=".008"><circle cx="-.03" cy=".01" r=".028"/><circle cx=".01" cy="-.01" r=".036"/><circle cx=".045" cy=".015" r=".024"/></g>`,
        r => `<path d="M0 -.065L.045 0L0 .055L-.045 0Z" fill="${RAINBOW[Math.floor(r(1) * 6)]}"/><path d="M0 .055Q.02 .08 0 .1" stroke="#7a8aa8" stroke-width=".008" fill="none"/>`,
        r => `<ellipse cy="-.02" rx=".035" ry=".045" fill="${BALLOONS[Math.floor(r(1) * 6)]}"/><path d="M0 .025Q-.012 .05 .005 .08" stroke="#7a8aa8" stroke-width=".007" fill="none"/>`,
        r => `<path d="M-.065 .01L.07 -.04L-.02 .05Z" fill="#ffffff" stroke="#8aa0c0" stroke-width=".007"/><path d="M-.065 .01L.07 -.04L-.025 .02" fill="#e2ecf8"/>`,
        r => `<path d="M0 -.055L.014 -.016L.054 -.016L.022 .008L.034 .048L0 .024L-.034 .048L-.022 .008L-.054 -.016L-.014 -.016Z" fill="#ffd84a"/>`
    ];
    const board = Worlds.decoBoard({
        id: "sk",
        mark: r => AIRY[Math.floor(r(0) * AIRY.length)](r),
        word(entry, cells, rnd, g, across) {
            const [r0, c0] = cells[0], len = cells.length;
            ["#ff5c5c", "#ffd84a", "#4cb3ff"].forEach((col, i) => {
                const off = 0.9 + i * 0.03;
                const d = across ? `M${c0 + 0.08} ${r0 + off}Q${c0 + len / 2} ${r0 + off + 0.03} ${c0 + len - 0.08} ${r0 + off}` : `M${c0 + off} ${r0 + 0.08}Q${c0 + off + 0.03} ${r0 + len / 2} ${c0 + off} ${r0 + len - 0.08}`;
                const p = U.svg("path", { d, class: "sk-band", stroke: col, pathLength: "1" }, g);
                p.style.animationDelay = i * 0.08 + "s";
            });
        },
        type(cell) {
            const p = U.center(cell);
            FX.burst({ x: p.x, y: p.y, n: 5, colors: ["#ffffff", "#e6f2ff"], shape: "circle", speed: [20, 70], gravity: -30, drag: 2, life: [0.4, 0.7], size: [4, 8] });
        },
        wordDone(entry, cells) {
            cells.forEach(([r, c], i) => setTimeout(() => {
                const cell = Game.cellEl(r, c);
                if (!cell) return;
                const p = U.center(cell);
                FX.burst({ x: p.x, y: p.y, n: 6, colors: RAINBOW, shape: "petal", speed: [40, 130], gravity: 80, life: [0.6, 1], size: [5, 8], spin: 3 });
            }, i * 60));
        }
    });

    // ---------------------------------------------------------------------------------------------
    // The win: balloons launch past the board, paper planes loop around it, confetti drifts down
    // ---------------------------------------------------------------------------------------------
    async function celebrate(c, { boardEl }) {
        if (U.motion() === "still") return;
        const W = innerWidth, H = innerHeight;
        const overlay = document.getElementById("overlay");
        // 1. a crowd of balloons floats up from below
        const n = U.motion() === "lite" ? 10 : 18, balloons = [];
        for (let i = 0; i < n; i++) {
            const bl = U.el("div", { class: "sk-balloon", style: { "--c": BALLOONS[i % BALLOONS.length], left: (i + 0.5) / n * W - 22 + U.rand(-20, 20) + "px" } });
            overlay.appendChild(bl);
            balloons.push(bl);
            bl.animate([{ transform: "translate(0, 0)" }, { transform: `translate(${U.rand(-40, 40).toFixed(0)}px, ${(-H - 260).toFixed(0)}px) rotate(${U.rand(-12, 12).toFixed(0)}deg)` }], { duration: U.rand(2600, 3600), delay: U.rand(0, 700), easing: "cubic-bezier(.4,0,.7,1)", fill: "both" });
        }
        c.cleanup(() => balloons.forEach(bl => bl.remove()));
        // and one big hot-air balloon rises past the board, its pilot waving (Rive: rive/sky-win.riv)
        const bb = boardEl.getBoundingClientRect(), bw = Math.min(H / 3, 320), side = bb.left > bw + 20 ? bb.left - bw - 10 : Math.min(W - bw, bb.right + 10);
        const big = Anim.play("sky-win", { ms: 4300, fadeMs: 200, rect: { x: side, y: 0, w: bw, h: H } });
        c.cleanup(() => big.stop());
        Sound.play("whoosh");
        for (let i = 0; i < 4; i++) c.later(() => Sound.play("pop"), 300 + i * 260);
        await c.wait(1300);
        if (c.skipped) return;
        // 2. three little planes fly a loop-the-loop around the board, leaving cloud trails
        const b = boardEl.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
        const R = Math.max(b.width, b.height) * 0.62, planes = [];
        const pathAt = k => {                                       // 0..1: in from the left, once around the board, out to the right
            if (k < 0.2) { const u = k / 0.2; return [U.lerp(-140, cx, u), cy + R]; }
            if (k < 0.8) { const a = Math.PI / 2 - (k - 0.2) / 0.6 * Math.PI * 2; return [cx + Math.cos(a) * R * 1.1, cy + Math.sin(a) * R]; }
            const u = (k - 0.8) / 0.2; return [U.lerp(cx, W + 160, u), cy + R - u * H * 0.25];
        };
        for (let i = 0; i < 3; i++) {
            const pl = U.el("div", { class: "sk-plane", html: PLANE, style: { "--c": BALLOONS[i * 2] } });
            overlay.appendChild(pl);
            planes.push(pl);
            const frames = [];
            for (let f = 0; f <= 40; f++) {
                const k = f / 40, [x, y] = pathAt(k), [x2, y2] = pathAt(Math.min(1, k + 0.01)), [x0, y0] = pathAt(Math.max(0, k - 0.01));
                frames.push({ transform: `translate(${(x - 45).toFixed(0)}px, ${(y - 22).toFixed(0)}px) rotate(${(Math.atan2(y2 - y0, x2 - x0) * 180 / Math.PI).toFixed(1)}deg)` });
            }
            pl.animate(frames, { duration: 2600, delay: i * 260, easing: "linear", fill: "both" });
        }
        const trail = setInterval(() => planes.forEach(pl => {
            const p = U.center(pl);
            if (p.x > -20 && p.x < W + 20) FX.burst({ x: p.x, y: p.y, n: 1, colors: ["#ffffff"], shape: "circle", speed: [0, 10], gravity: -8, drag: 2, life: [1, 1.4], size: [7, 11] });
        }), 45);
        c.cleanup(() => { clearInterval(trail); planes.forEach(pl => pl.remove()); });
        Sound.play("whoosh");
        c.later(() => Sound.play("loop"), 700);
        await c.wait(2400);
        if (c.skipped) return;
        // 3. confetti drifts down from the clouds
        FX.burst({ x: W / 2, y: -20, jitter: W / 2, jitterY: 10, n: 120, colors: BALLOONS, shape: "rect", angle: Math.PI / 2, spread: 0.4, speed: [60, 180], gravity: 220, drag: 0.5, life: [2.4, 3.4], size: [6, 9], delay: [0, 1] });
        FX.burst({ x: cx, y: cy, n: 40, colors: ["#ffffff", "#ffd84a", "#bfe6ff"], shape: "star", speed: [150, 420], gravity: 160, life: [1.2, 1.8], size: [4, 8], spin: 5 });
        Sound.play("sparkle");
        clearInterval(trail);
        await c.wait(2200);
    }

    // ---------------------------------------------------------------------------------------------
    // Title card: a little plane flies in towing a banner
    // ---------------------------------------------------------------------------------------------
    const PLANE = `<svg viewBox="0 0 120 60" aria-hidden="true">
        <path d="M14 30Q20 18 60 20L96 24Q112 28 112 32Q112 36 96 38L60 40Q20 42 14 30Z" style="fill: var(--c, #ff5c6c)"/>
        <path d="M44 22L60 4H70L64 22Z M44 38L60 56H70L64 38Z" fill="#ffd84a"/><path d="M18 28L8 14H16L28 26Z" fill="#ffd84a"/>
        <circle cx="84" cy="27" r="6" fill="#bfe6ff" stroke="#ffffff" stroke-width="2"/>
        <rect class="tcs-prop" x="112" y="14" width="4" height="32" rx="2" fill="#5a5a6a"/></svg>`;
    async function titleCard(c, info) {
        const card = U.el("div", { class: "tc tc-sky", "aria-hidden": "true", html: `
            <div class="tcs-fly">
                <div class="tcs-banner"><small>${U.esc(info.kicker)}</small><h2>${U.esc(info.title)}</h2><p>${U.esc(info.sub)}</p></div>
                <i class="tcs-rope"></i>
                <div class="tcs-plane">${PLANE}</div>
            </div>` });
        document.getElementById("overlay").appendChild(card);
        c.cleanup(() => card.remove());
        Sound.play("title");
        await c.wait(2000);
        if (c.skipped) return;
        card.classList.add("out");
        Sound.play("whoosh");
        await c.wait(550);
    }

    // ---------------------------------------------------------------------------------------------
    // The mascot: Pip, a round little bird pilot with goggles and a scarf
    // ---------------------------------------------------------------------------------------------
    function drawPip(g, s) {
        const happy = s.mood === "happy", wow = s.mood === "wow", sad = s.mood === "sad";
        const flap = Math.sin(s.t * (happy ? 18 : 4)) * (happy ? 0.7 : 0.25);
        g.save();
        g.translate(80, 92 + Math.sin(s.t * 2.2) * 4 - s.hop * 12);
        // the scarf flapping behind
        g.fillStyle = "#e8344e";
        g.beginPath(); g.moveTo(-20, 16); g.quadraticCurveTo(-46, 10 + Math.sin(s.t * 8) * 6, -62, 18 + Math.sin(s.t * 8 + 1) * 8); g.lineTo(-58, 26 + Math.sin(s.t * 8 + 1) * 8); g.quadraticCurveTo(-44, 22, -20, 26); g.fill();
        // wings
        for (const side of [-1, 1]) {
            g.save(); g.translate(side * 34, 8); g.rotate(side * (0.3 + flap));
            g.fillStyle = "#4a9ae8"; g.beginPath(); g.ellipse(side * 12, 0, 18, 10, side * 0.3, 0, TAU); g.fill();
            g.restore();
        }
        // the round body
        const bg = g.createRadialGradient(-12, -14, 6, 0, 0, 46);
        bg.addColorStop(0, "#9ad4ff"); bg.addColorStop(1, "#3a8ae0");
        g.fillStyle = bg; g.strokeStyle = "#2a5a9a"; g.lineWidth = 2.5;
        g.beginPath(); g.arc(0, 0, 40, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = "#fff4dc"; g.beginPath(); g.ellipse(0, 16, 24, 20, 0, 0, TAU); g.fill();
        // the scarf knot
        g.fillStyle = "#e8344e"; g.beginPath(); g.ellipse(0, 22, 22, 7, 0, 0, TAU); g.fill();
        // feet
        g.strokeStyle = "#ff9a1f"; g.lineWidth = 3; g.lineCap = "round";
        for (const side of [-1, 1]) { g.beginPath(); g.moveTo(side * 10, 38); g.lineTo(side * 12, 48); g.moveTo(side * 12, 48); g.lineTo(side * 18, 50); g.stroke(); }
        // the beak
        g.fillStyle = "#ffb627";
        const open = Math.max(s.talk, wow ? 0.8 : 0);
        g.beginPath(); g.moveTo(-7, -2); g.lineTo(0, 8 + open * 3); g.lineTo(7, -2); g.fill();
        if (open > 0.1) { g.fillStyle = "#c46a10"; g.beginPath(); g.moveTo(-5, 1); g.lineTo(0, 5 + open * 6); g.lineTo(5, 1); g.fill(); }
        // eyes
        const ex = s.look * 3;
        for (const side of [-1, 1]) {
            const x = side * 13 + ex, y = -10;
            g.fillStyle = "#1a2a4a";
            if (s.blink > 0.5) { g.fillRect(x - 5, y, 10, 2.5); continue; }
            if (happy) { g.lineWidth = 2.6; g.strokeStyle = "#1a2a4a"; g.beginPath(); g.arc(x, y + 3, 5, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); continue; }
            g.beginPath(); g.arc(x, y, wow ? 6 : sad ? 4 : 5, 0, TAU); g.fill();
            g.fillStyle = "#ffffff"; g.beginPath(); g.arc(x + 1.6, y - 1.8, 1.8, 0, TAU); g.fill();
        }
        // aviator goggles pushed up on the forehead, and a cap
        g.fillStyle = "#7a4a2a"; g.beginPath(); g.arc(0, -16, 38, Math.PI * 1.08, Math.PI * 1.92); g.closePath(); g.fill();
        g.strokeStyle = "#5a3a1a"; g.lineWidth = 4; g.beginPath(); g.moveTo(-36, -24); g.lineTo(36, -24); g.stroke();
        for (const side of [-1, 1]) { g.fillStyle = "#c8e8ff"; g.strokeStyle = "#b8862a"; g.lineWidth = 3; g.beginPath(); g.arc(side * 12, -27, 8, 0, TAU); g.fill(); g.stroke(); g.fillStyle = "rgba(255,255,255,.7)"; g.beginPath(); g.arc(side * 12 - 2, -29, 2.5, 0, TAU); g.fill(); }
        g.restore();
    }

    // ---------------------------------------------------------------------------------------------
    // Sounds: airy flute notes, wind chimes and soft gusts
    // ---------------------------------------------------------------------------------------------
    const flute = (t, n, v = 0.06, d = 0.35) => tone({ t, f: midi(n), type: "sine", d, v, vib: 6, a: 0.03 });
    const chime = (t, n, v = 0.04) => tone({ t, f: midi(n), type: "sine", d: 0.9, v, echo: 0.35 });
    const sounds = {
        type: () => tone({ f: U.pick([880, 988, 1047]), f2: 1200, type: "sine", d: 0.06, v: 0.06 }),
        erase: () => tone({ f: 700, f2: 500, type: "sine", d: 0.07, v: 0.05 }),
        move: () => {},
        word: () => [0, 4, 7, 12].forEach((k, i) => flute(i * 0.08, 79 + k, 0.06, 0.25)),
        wrong: () => { flute(0, 67, 0.08, 0.3); flute(0.18, 63, 0.08, 0.4); },
        right: () => [0, 4, 7, 11, 14].forEach((k, i) => chime(i * 0.07, 79 + k, 0.045)),
        reveal: () => { noise({ type: "bandpass", f: 500, f2: 1600, d: 0.5, v: 0.08, q: 0.6 }); chime(0.2, 91, 0.04); },
        flip: () => chime(0, 91, 0.025),
        pop: () => tone({ f: 500, f2: 1100, type: "sine", d: 0.08, v: 0.07 }),
        loop: () => { tone({ f: 300, f2: 900, type: "sine", d: 0.8, v: 0.04, vib: 8 }); [72, 76, 79, 84, 88, 91].forEach((n, i) => chime(0.3 + i * 0.09, n, 0.04)); },
        sparkle: () => [91, 96, 100].forEach((n, i) => chime(i * 0.08, n, 0.03)),
        win: () => {},
        streak: () => [72, 79, 84, 88].forEach((n, i) => flute(i * 0.09, n, 0.06, 0.3)),
        achievement: () => [79, 83, 86, 91].forEach((n, i) => chime(i * 0.08, n, 0.05)),
        title: () => { noise({ type: "bandpass", f: 300, f2: 1200, d: 0.9, v: 0.08, q: 0.5 }); tone({ f: 120, f2: 180, type: "sawtooth", d: 0.9, v: 0.02, filt: { f: 500 } }); [72, 76, 79].forEach((n, i) => flute(0.4 + i * 0.12, n, 0.05)); },
        tile: i => flute(0, 72 + (i % 8) * 2, 0.05, 0.15),
        start: () => { noise({ type: "bandpass", f: 400, f2: 1500, d: 0.8, v: 0.1, q: 0.6 }); [67, 72, 76, 79, 84].forEach((n, i) => chime(0.3 + i * 0.08, n, 0.05)); },
        select: () => chime(0, 88, 0.025),
        nav: () => { noise({ type: "bandpass", f: 600, f2: 1800, d: 0.3, v: 0.06, q: 0.7 }); flute(0.05, 84, 0.03, 0.12); },
        mascot: () => { tone({ f: 1200, f2: 1600, type: "sine", d: 0.08, v: 0.05 }); tone({ t: 0.09, f: 1400, f2: 1900, type: "sine", d: 0.08, v: 0.04 }); }
    };

    Worlds.register({
        id: "sky", name: "Sky Kingdom", icon: "☁️", tagline: "Islands in the Clouds.",
        modes: ["light", "dark"],
        scene: (W, H, opts) => SkyScene(W, H, opts), rive: "sky-win", board, celebrate, titleCard, sounds, transition: "clouds",
        mascot: { name: "PIP", draw: drawPip },
        lines: {
            hello: ["Pip here, your pilot! Buckle up for a puzzle.", "Welcome aboard! Skies are clear for solving.", "Hello from up here! The view is great."],
            start: ["Tap a square and start typing. Space flips Across and Down!", "Ready for takeoff? Fill in every square!"],
            word: ["Sky high!", "Smooth flying!", "On cloud nine!", "Soaring!", "Fly-tastic!", "Blue skies!"],
            win: ["Balloons up! You did it!", "That solve was out of this world... almost!", "Flying high, you did it!"],
            wrong: ["Bit of turbulence on a few of those.", "Some letters drifted off course."],
            right: ["Clear skies, all correct!", "A perfect landing!"],
            idle: ["Stuck? Try a crossing word for a new view.", "Take a deep breath of fresh air, then try the shortest clue."],
            reveal: ["Here's a little tailwind...", "Dropping a hint from above!"]
        },
        introFlourish(stage) {
            const p = U.center(stage);
            FX.ring({ x: p.x, y: p.y, color: "#4cb3ff", r1: Math.max(innerWidth, innerHeight) * 0.6, dur: 1.2, width: 14, glow: false });
            FX.burst({ x: p.x, y: p.y, n: 70, colors: RAINBOW, shape: "petal", speed: [200, 650], gravity: 150, drag: 1, life: [1.4, 2.2], size: [6, 10], spin: 4 });
        }
    });
})();
