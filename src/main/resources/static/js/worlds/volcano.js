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

    // ---------------------------------------------------------------------------------------------
    // The background
    // ---------------------------------------------------------------------------------------------
    function scene(W, H, opts) {
        const night = opts.theme === "dark", preview = !!opts.preview;
        let hz, sky, far, mid, glow, smoke, embers, gulls, palms, rivers, vx, vtop, nextGull = preview ? 999 : U.rand(3, 8), sparks = [], fountain = [];

        function setup() {
            const R = U.rng(7070);
            hz = Math.round(H * 0.66);
            vx = W * 0.62; vtop = H * 0.26;
            sky = null;
            // far layer: the volcano and the jungle at its foot
            far = Worlds.canvas(W + 40, H);
            {
                const g = far.getContext("2d"), X = vx + 20, base = hz + 4, half = Math.max(W * 0.34, H * 0.42), cw = half * 0.16;
                const vg = g.createLinearGradient(0, vtop, 0, base);
                vg.addColorStop(0, night ? "#2a1214" : "#6a5a52"); vg.addColorStop(1, night ? "#140808" : "#4a6a3a");
                g.fillStyle = vg;
                g.beginPath(); g.moveTo(X - half, base); g.quadraticCurveTo(X - cw * 1.6, vtop + 40, X - cw, vtop); g.lineTo(X + cw, vtop); g.quadraticCurveTo(X + cw * 1.6, vtop + 40, X + half, base); g.fill();
                // ridges on the slopes
                g.strokeStyle = night ? "rgba(0,0,0,.35)" : "rgba(40,30,20,.25)"; g.lineWidth = 2;
                for (let i = 0; i < 9; i++) { const k = (i + 0.5) / 9 * 2 - 1; g.beginPath(); g.moveTo(X + k * cw, vtop + 4); g.quadraticCurveTo(X + k * half * 0.5, vtop + (base - vtop) * 0.5, X + k * half * 0.9, base); g.stroke(); }
                if (!night) {                                                 // green jungle creeping up the base
                    g.fillStyle = "#3f7a3a";
                    for (let x = X - half; x < X + half; x += 14) { const h = (base - vtop) * (0.25 + R() * 0.12) * (1 - Math.abs(x - X) / half * 0.6); g.beginPath(); g.arc(x, base - h * 0.4, 16 + R() * 10, 0, TAU); g.fill(); }
                }
                // distant islands
                g.fillStyle = night ? "#1a0c12" : "#7aa7a0";
                g.beginPath(); g.ellipse(W * 0.12, base, W * 0.12, H * 0.05, 0, Math.PI, TAU); g.fill();
            }
            rivers = Array.from({ length: preview ? 2 : 4 }, (_, i) => {
                const side = i % 2 ? 1 : -1, cw = Math.max(W * 0.34, H * 0.42) * 0.16;
                const pts = [];
                let x = vx + side * cw * (0.2 + R() * 0.6), y = vtop + 2;
                for (let k = 0; k < 14; k++) { pts.push([x, y]); y += (hz - vtop) / 14; x += side * (8 + R() * 16) + (R() - 0.5) * 12; }
                return { pts, ph: R() * 10 };
            });
            // mid layer: the sea and beach
            mid = Worlds.canvas(W + 60, H);
            {
                const g = mid.getContext("2d");
                const sea = g.createLinearGradient(0, hz, 0, H * 0.84);
                sea.addColorStop(0, night ? "#3a1420" : "#2aa6c8"); sea.addColorStop(1, night ? "#120812" : "#1ec4c4");
                g.fillStyle = sea; g.fillRect(0, hz, W + 60, H * 0.2);
                const sand = g.createLinearGradient(0, H * 0.82, 0, H);
                sand.addColorStop(0, night ? "#3a2a24" : "#f3dca2"); sand.addColorStop(1, night ? "#24180f" : "#e6c27a");
                g.fillStyle = sand;
                g.beginPath(); g.moveTo(0, H * 0.84); for (let x = 0; x <= W + 60; x += 30) g.lineTo(x, H * 0.84 + Math.sin(x * 0.01) * 8); g.lineTo(W + 60, H); g.lineTo(0, H); g.fill();
                g.fillStyle = night ? "rgba(0,0,0,.2)" : "rgba(190,150,80,.35)";
                for (let i = 0; i < 120; i++) g.fillRect(R() * (W + 60), H * 0.86 + R() * H * 0.14, 2, 2);
                // a few shells and starfish on the sand
                for (let i = 0; i < 5; i++) { g.fillStyle = night ? "#5a3a3a" : ["#ff9a7a", "#ffd0a0", "#ff7a6a"][i % 3]; g.beginPath(); g.arc(R() * (W + 60), H * (0.9 + R() * 0.08), 4 + R() * 3, Math.PI, TAU); g.fill(); }
            }
            palms = Array.from({ length: preview ? 2 : 4 }, (_, i) => ({ x: i % 2 ? W * (0.86 + R() * 0.12) : W * (0.02 + R() * 0.12), base: H * (0.92 + R() * 0.06), h: H * (0.38 + R() * 0.16), lean: (i % 2 ? -1 : 1) * (0.12 + R() * 0.12), ph: R() * TAU }));
            glow = Worlds.canvas(64, 64);
            { const g = glow.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,170,60,.9)"); gr.addColorStop(0.4, "rgba(255,90,30,.3)"); gr.addColorStop(1, "rgba(255,60,20,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }
            smoke = Array.from({ length: preview ? 6 : 16 }, (_, i) => ({ age: i / (preview ? 6 : 16) * 9, ph: R() * TAU, s: 0.8 + R() * 0.6 }));
            embers = night ? Array.from({ length: preview ? 20 : 70 }, () => ({ x: vx + (R() - 0.5) * 60, y: vtop - R() * H * 0.3, vx: (R() - 0.5) * 30, vy: -20 - R() * 50, life: R() * 4, r: 1 + R() * 2 })) : [];
            gulls = [];
        }
        setup();

        function palm(g, p, t, px) {
            const sway = Math.sin(t * 0.9 + p.ph) * 0.04;
            const x0 = p.x - px, tx = x0 + Math.sin(p.lean + sway) * p.h, ty = p.base - Math.cos(p.lean) * p.h;
            g.strokeStyle = night ? "#140a08" : "#8a5a2e"; g.lineWidth = Math.max(8, p.h * 0.05); g.lineCap = "round";
            g.beginPath(); g.moveTo(x0, p.base); g.quadraticCurveTo(x0 + (tx - x0) * 0.2, p.base - p.h * 0.6, tx, ty); g.stroke();
            if (!night) { g.strokeStyle = "rgba(60,30,10,.35)"; g.lineWidth = 2; for (let k = 0.1; k < 0.95; k += 0.08) { const x = x0 + (tx - x0) * k * k * 0.9 + (tx - x0) * 0.1 * k, y = p.base - (p.base - ty) * k; g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x + 6, y + 3); g.stroke(); } }
            // fronds
            for (let i = 0; i < 7; i++) {
                const a = -Math.PI / 2 + (i - 3) * 0.5 + Math.sin(t * 1.4 + p.ph + i) * 0.06 + sway * 3, len = p.h * (0.42 + (i % 2) * 0.1);
                g.save(); g.translate(tx, ty); g.rotate(a);
                g.fillStyle = night ? "#1a0c0a" : i % 2 ? "#2f8a3a" : "#3fa046";
                g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.5, -len * 0.18, len, len * 0.35); g.quadraticCurveTo(len * 0.5, len * 0.12, 0, 0); g.fill();
                g.restore();
            }
            if (!night) { g.fillStyle = "#6a4020"; for (const [dx, dy] of [[-6, 6], [5, 8], [0, 12]]) { g.beginPath(); g.arc(tx + dx, ty + dy, 5, 0, TAU); g.fill(); } }
        }

        return {
            resize(w, h) { W = w; H = h; setup(); },
            draw(g, t, dt, inp) {
                if (!sky) {
                    sky = g.createLinearGradient(0, 0, 0, hz);
                    if (night) { sky.addColorStop(0, "#14081e"); sky.addColorStop(0.6, "#4a1424"); sky.addColorStop(1, "#a8301a"); }
                    else { sky.addColorStop(0, "#3fa8f0"); sky.addColorStop(0.7, "#9fdcf8"); sky.addColorStop(1, "#e8f8ff"); }
                }
                g.fillStyle = sky; g.fillRect(0, 0, W, H);
                if (!night) {
                    const sx = W * 0.18 - inp.px * 3, sy = H * 0.16, sr = Math.min(W, H) * 0.06;
                    const sg = g.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 4);
                    sg.addColorStop(0, "rgba(255,250,200,.9)"); sg.addColorStop(1, "rgba(255,250,200,0)");
                    g.fillStyle = sg; g.fillRect(sx - sr * 4, sy - sr * 4, sr * 8, sr * 8);
                    g.fillStyle = "#fff6c8"; g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.fill();
                }
                const fx = -20 - inp.px * 6;
                crater.x = vx - inp.px * 6; crater.y = vtop;
                // the eruption (the win): rumbling for 1.6 s, erupting until 6 s, calming down by 10 s
                const e = eruption && !preview ? (performance.now() - eruption) / 1000 : -1;
                if (e > 10) eruption = 0;
                const I = e < 0 ? 0 : e < 1.6 ? e / 1.6 * 0.4 : e < 6 ? 1 : Math.max(0, 1 - (e - 6) / 4);
                // the crater glow behind the smoke (always at night, during an eruption by day too)
                if (night || I > 0) {
                    const pulse = (night ? 0.75 + 0.25 * Math.sin(t * 1.7) : 0) + I * (0.8 + 0.2 * Math.sin(t * 20));
                    if (night) g.globalCompositeOperation = "lighter";
                    g.globalAlpha = Math.min(1, pulse);
                    const sz = 1 + I * 1.6;
                    g.drawImage(glow, crater.x - 160 * sz, vtop - 150 * sz, 320 * sz, 260 * sz);
                    g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
                }
                // smoke puffs rising from the crater and drifting with the wind
                for (const s of smoke) {
                    s.age += dt; if (s.age > 9) s.age -= 9;
                    const k = s.age / 9, x = vx - inp.px * 6 + k * W * 0.18 + Math.sin(t * 0.5 + s.ph) * 10, y = vtop - k * H * 0.32, r = (14 + k * 70) * s.s * (1 + I * 0.9);
                    g.fillStyle = night ? `rgba(60,30,40,${(0.55 * (1 - k)).toFixed(3)})` : I > 0.3 ? `rgba(120,110,115,${(0.8 * (1 - k)).toFixed(3)})` : `rgba(235,235,240,${(0.75 * (1 - k)).toFixed(3)})`;
                    g.beginPath(); g.arc(x, y, r, 0, TAU); g.arc(x + r * 0.6, y + r * 0.2, r * 0.7, 0, TAU); g.fill();
                    if (night) { g.fillStyle = `rgba(255,110,40,${(0.18 * (1 - k)).toFixed(3)})`; g.beginPath(); g.arc(x, y + r * 0.3, r * 0.8, 0, TAU); g.fill(); }
                }
                g.drawImage(far, fx, 0);
                // lava rivers creeping down the slopes (at night; by day they pour out during an eruption)
                const flow = night ? 1 : U.clamp((e - 1.6) / 2.5, 0, 1);
                if (night || I > 0) for (const r of rivers) {
                    const pts = r.pts.slice(0, Math.max(1, Math.ceil(r.pts.length * flow)));
                    if (pts.length < 2) continue;
                    g.lineCap = "round"; g.lineJoin = "round";
                    g.globalAlpha = night ? 1 : Math.min(1, I * 1.2);
                    for (const [w, col] of [[10 + I * 8, "rgba(255,80,20,.35)"], [4 + I * 3, "#ff8a1f"], [1.6 + I, "#ffe07a"]]) {
                        g.strokeStyle = col; g.lineWidth = w;
                        g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x + fx + 20, y) : g.moveTo(x + fx + 20, y)); g.stroke();
                    }
                    g.globalAlpha = 1;
                    if (!night) continue;
                    const k = (t * 0.08 + r.ph) % 1, i = Math.floor(k * (r.pts.length - 1)), [x, y] = r.pts[i];          // a bright blob flowing down
                    g.globalCompositeOperation = "lighter"; g.drawImage(glow, x + fx + 20 - 14, y - 14, 28, 28); g.globalCompositeOperation = "source-over";
                }
                // the lava fountain shooting out of the crater during an eruption
                if (e > 1.6 && e < 5.5) for (let i = 0; i < Math.round(dt * 140); i++) fountain.push({ x: crater.x + (Math.random() - 0.5) * 30, y: vtop, vx: (Math.random() - 0.5) * 300, vy: -250 - Math.random() * 450, life: 2.4, r: 2 + Math.random() * 4 });
                if (fountain.length) {
                    if (night) g.globalCompositeOperation = "lighter";
                    fountain = fountain.filter(f => (f.life -= dt) > 0 && f.y < H);
                    for (const f of fountain) {
                        f.vy += 420 * dt; f.x += f.vx * dt; f.y += f.vy * dt;
                        g.fillStyle = f.r > 4 ? "#ffd23a" : f.r > 3 ? "#ff8a1f" : "#ff5a1a";
                        g.globalAlpha = Math.min(1, f.life);
                        g.beginPath(); g.arc(f.x, f.y, f.r, 0, TAU); g.fill();
                    }
                    g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
                }
                // embers floating up from the crater (night)
                for (const e of embers) {
                    e.life -= dt; e.x += e.vx * dt; e.y += e.vy * dt;
                    if (e.life <= 0) { e.x = vx + (Math.random() - 0.5) * 50; e.y = vtop; e.vx = (Math.random() - 0.5) * 40; e.vy = -30 - Math.random() * 60; e.life = 2 + Math.random() * 3; }
                    const a = Math.min(1, e.life * 0.5) * (0.75 + 0.25 * Math.sin(t * 13 + e.r * 7));     // it flickers
                    g.fillStyle = `rgba(255,${150 + Math.round(e.r * 30)},60,${a.toFixed(2)})`;
                    g.fillRect(e.x - inp.px * 6, e.y, e.r, e.r);
                    Worlds.glow(g, e.x - inp.px * 6 + e.r / 2, e.y + e.r / 2, e.r * 5, "#ff8a3a", a * 0.55);
                }
                // a little spurt of sparks from the crater now and then (day)
                if (!night && !preview && Math.random() < dt * 0.15) for (let i = 0; i < 10; i++) sparks.push({ x: vx, y: vtop, vx: (Math.random() - 0.5) * 80, vy: -60 - Math.random() * 80, life: 1.2 });
                sparks = sparks.filter(s => (s.life -= dt) > 0);
                g.lineCap = "round"; g.lineWidth = 2.4;
                for (const s of sparks) { s.vy += 120 * dt; s.x += s.vx * dt; s.y += s.vy * dt; g.strokeStyle = `rgba(255,${120 + Math.round(s.life * 80)},40,${s.life.toFixed(2)})`; g.beginPath(); g.moveTo(s.x - inp.px * 6 - s.vx * 0.05, s.y - s.vy * 0.05); g.lineTo(s.x - inp.px * 6, s.y); g.stroke(); Worlds.glow(g, s.x - inp.px * 6, s.y, 7, "#ff7a2a", s.life * 0.5); }
                g.drawImage(mid, -30 - inp.px * 10, 0);
                // sparkles (day) or glow streaks (night) on the water, and waves lapping the beach
                for (let i = 0; i < (preview ? 12 : 40); i++) {
                    const x = (i * 97.3 + t * (6 + i % 5)) % W, y = hz + 4 + ((i * 53) % 100) / 100 * H * 0.16;
                    const a = Math.max(0, Math.sin(t * 2 + i * 1.7));
                    g.fillStyle = night ? `rgba(255,120,50,${(a * 0.4).toFixed(2)})` : `rgba(255,255,255,${(a * 0.8).toFixed(2)})`;
                    g.fillRect(x - inp.px * 10, y, night ? 14 : 6, 1.5);
                    if (!night && a > 0.94) Worlds.glint(g, x - inp.px * 10 + 3, y + 0.75, 9, (a - 0.94) * 14);        // the sun catching a wave
                }
                const wy = H * 0.835 + Math.sin(t * 1.2) * 4;
                g.fillStyle = night ? "rgba(255,140,90,.18)" : "rgba(255,255,255,.75)";
                g.beginPath(); g.moveTo(0, wy); for (let x = 0; x <= W; x += 24) g.lineTo(x, wy + Math.sin(x * 0.03 + t * 2) * 3); g.lineTo(W, wy + 6); g.lineTo(0, wy + 6); g.fill();
                // seagulls gliding by (day) or bats (night)
                nextGull -= dt;
                if (nextGull <= 0) { gulls.push({ x: -40, y: H * U.rand(0.1, 0.35), vx: U.rand(35, 60), ph: Math.random() * TAU, n: night ? 1 : U.pick([1, 2, 3]) }); nextGull = U.rand(10, 20); }
                gulls = gulls.filter(b => (b.x += b.vx * dt) < W + 80);
                g.strokeStyle = night ? "#1a0a10" : "#ffffff"; g.lineWidth = 2.2; g.lineCap = "round";
                for (const b of gulls) for (let k = 0; k < b.n; k++) {
                    const x = b.x - k * 30 - inp.px * 12, y = b.y + k * 14 + Math.sin(t * 1.5 + b.ph + k) * 6, f = Math.sin(t * 6 + b.ph + k) * 5;
                    g.beginPath(); g.moveTo(x - 12, y - f); g.quadraticCurveTo(x - 5, y - 6, x, y); g.quadraticCurveTo(x + 5, y - 6, x + 12, y - f); g.stroke();
                }
                for (const p of palms) palm(g, p, t, inp.px * 20);
            }
        };
    }

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
        scene, board, celebrate, titleCard, sounds, transition: "lava",
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
