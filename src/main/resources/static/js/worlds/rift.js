// The CELESTIAL RIFT world (the secret 16th world, 2026-10-14): the torn sky where the Cursed Angel was imprisoned
// until the Void fell. It only opens after the Void is beaten (campaign.js) and then shows up in Settings too.
//   Night: deep violet space, drifting nebulae, a great jagged tear across the sky with golden heaven light pouring
//   through it (god rays, sparks falling from its burning edges), floating marble ruins of the old prison with crystal
//   lanterns hanging off them, crystal shards orbiting the tear, black and white feathers falling, golden motes rising, a mist
//   sea below and shooting stars.
//   Day: a pale gold dawn over a sea of clouds; the tear is a dark violet wound that leaks corruption, the ruins are
//   sunlit marble, and the feathers are white and gold.
//   Board: each letter leaves a little star, feather or rune; finished words get a gold halo line with a star at each end.
//   Win: a constellation forms over the board and rises into a halo; heaven's gates open, wings of light unfold
//   and beat, feathers fall, and the halo comes down over the board.
//   Mascot: Vigil, a small star who was the angel's jailer light, still carrying the prison's key.

(() => {
    const TAU = Math.PI * 2;
    const { tone, noise, midi, chord } = Sound;
    const GOLD = ["#ffe7a3", "#ffd06b", "#f2b84b", "#fff6d8"];
    const VIOLET = ["#9b6bff", "#c49bff", "#6b3fd6", "#e3c8ff"];

    // ---------------------------------------------------------------------------------------------
    // The background
    // ---------------------------------------------------------------------------------------------
    function scene(W, H, opts) {
        const night = opts.theme !== "light", preview = !!opts.preview;
        let sky, nebula, stars, ruins, shards, feathers, motes, mist, tear, sparks = [], shooters = [], nextShoot = 2;

        // the old prison's ruins, drawn once: a broken fluted column, an arch, a tiled floor slab, a stone wing
        const MARBLE = night ? ["#cfc4e6", "#8a7cae", "#5e5286"] : ["#fffaf0", "#e2d6c2", "#bfae94"];
        const TRIM = night ? "#e8c66a" : "#d9a640";
        function sprite(kind, s) {
            const w = Math.ceil(s * 2.4), h = Math.ceil(s * 3), cv = Worlds.canvas(w, h), g = cv.getContext("2d");
            const lg = g.createLinearGradient(0, 0, w, 0);
            lg.addColorStop(0, MARBLE[1]); lg.addColorStop(0.35, MARBLE[0]); lg.addColorStop(1, MARBLE[2]);
            g.translate(w / 2, h * 0.55);
            g.lineJoin = "round";
            if (kind === "column") {
                const cw = s * 0.42, top = -s * 1.1, bot = s * 0.9;
                g.fillStyle = lg;
                g.beginPath(); g.moveTo(-cw / 2, bot); g.lineTo(-cw / 2, top + s * 0.1); g.lineTo(-cw * 0.2, top - s * 0.08); g.lineTo(cw * 0.05, top + s * 0.06); g.lineTo(cw * 0.3, top - s * 0.16); g.lineTo(cw / 2, top + s * 0.05); g.lineTo(cw / 2, bot); g.closePath(); g.fill();
                g.strokeStyle = "rgba(60,40,90,.25)"; g.lineWidth = Math.max(1, s * 0.02);
                for (let i = 1; i < 5; i++) { const x = -cw / 2 + (cw * i) / 5; g.beginPath(); g.moveTo(x, bot - s * 0.05); g.lineTo(x, top + s * 0.12); g.stroke(); }
                g.fillStyle = MARBLE[0]; g.fillRect(-cw * 0.75, bot, cw * 1.5, s * 0.16); g.fillStyle = MARBLE[2]; g.fillRect(-cw * 0.75, bot + s * 0.12, cw * 1.5, s * 0.06);
                g.strokeStyle = TRIM; g.lineWidth = Math.max(1, s * 0.035); g.beginPath(); g.moveTo(-cw * 0.75, bot + s * 0.02); g.lineTo(cw * 0.75, bot + s * 0.02); g.stroke();
                // a jagged rock base it was torn out with
                g.fillStyle = night ? "#3a2f5a" : "#9a8a72";
                g.beginPath(); g.moveTo(-cw, bot + s * 0.18); g.lineTo(cw, bot + s * 0.18); g.lineTo(cw * 0.6, bot + s * 0.55); g.lineTo(cw * 0.1, bot + s * 0.42); g.lineTo(-cw * 0.3, bot + s * 0.7); g.lineTo(-cw * 0.8, bot + s * 0.4); g.closePath(); g.fill();
            } else if (kind === "arch") {
                g.fillStyle = lg;
                g.beginPath(); g.moveTo(-s, s * 0.8); g.lineTo(-s, -s * 0.1); g.arc(0, -s * 0.1, s, Math.PI, 0); g.lineTo(s, s * 0.8); g.lineTo(s * 0.7, s * 0.8); g.lineTo(s * 0.7, -s * 0.1); g.arc(0, -s * 0.1, s * 0.7, 0, Math.PI, true); g.lineTo(-s * 0.7, s * 0.8); g.closePath(); g.fill();
                // a chunk broken off the right side
                g.globalCompositeOperation = "destination-out";
                g.beginPath(); g.moveTo(s * 1.1, -s * 0.4); g.lineTo(s * 0.55, -s * 0.2); g.lineTo(s * 0.8, s * 0.2); g.lineTo(s * 1.1, s * 0.3); g.fill();
                g.globalCompositeOperation = "source-over";
                g.strokeStyle = TRIM; g.lineWidth = Math.max(1, s * 0.04);
                g.beginPath(); g.arc(0, -s * 0.1, s * 0.85, Math.PI * 1.05, Math.PI * 1.75); g.stroke();
                g.fillStyle = TRIM; g.beginPath(); g.moveTo(0, -s * 1.18); g.lineTo(s * 0.08, -s * 1.06); g.lineTo(0, -s * 0.96); g.lineTo(-s * 0.08, -s * 1.06); g.fill();
            } else if (kind === "slab") {
                g.fillStyle = night ? "#3a2f5a" : "#a8977c";
                g.beginPath(); g.moveTo(-s, 0); g.lineTo(s, 0); g.lineTo(s * 0.5, s * 0.75); g.lineTo(-s * 0.1, s * 0.55); g.lineTo(-s * 0.7, s * 0.85); g.closePath(); g.fill();
                g.fillStyle = lg; g.fillRect(-s, -s * 0.16, s * 2, s * 0.18);
                for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? (night ? "#6b4fb3" : "#7aa8d6") : TRIM; g.fillRect(-s + i * s / 3 + s * 0.03, -s * 0.13, s / 3 - s * 0.06, s * 0.11); }
                // a little broken pillar stump and a fallen stone ball on it
                g.fillStyle = lg; g.fillRect(-s * 0.55, -s * 0.62, s * 0.24, s * 0.48);
                g.fillStyle = MARBLE[0]; g.beginPath(); g.arc(s * 0.45, -s * 0.3, s * 0.15, 0, TAU); g.fill();
            } else {                                            // a stone wing, fallen from a statue
                g.fillStyle = lg;
                g.beginPath(); g.moveTo(-s * 0.9, s * 0.4);
                for (let i = 0; i <= 5; i++) { const a = Math.PI * (1.05 + i * 0.13), r = s * (0.9 + (i % 2) * 0.12); g.quadraticCurveTo(Math.cos(a - 0.08) * r * 1.1, Math.sin(a - 0.08) * r * 1.1 - s * 0.1, Math.cos(a) * r, Math.sin(a) * r - s * 0.1); }
                g.lineTo(s * 0.4, s * 0.1); g.closePath(); g.fill();
                g.strokeStyle = "rgba(60,40,90,.3)"; g.lineWidth = Math.max(1, s * 0.025);
                for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(s * 0.3, s * 0.05); g.quadraticCurveTo(-s * 0.2, -s * (0.2 + i * 0.15), -s * (0.75 - i * 0.05), -s * (0.25 + i * 0.22)); g.stroke(); }
                g.strokeStyle = TRIM; g.lineWidth = Math.max(1, s * 0.04); g.beginPath(); g.moveTo(-s * 0.9, s * 0.4); g.lineTo(s * 0.4, s * 0.1); g.stroke();
            }
            return cv;
        }
        // a puff of cloud (day) or mist (night), drawn once
        function puff(w, h) {
            const cv = Worlds.canvas(w, h), g = cv.getContext("2d"), R = U.rng(w + h);
            for (let i = 0; i < 26; i++) {
                const x = R() * w, y = h * (0.35 + R() * 0.5), r = h * (0.2 + R() * 0.3);
                const gr = g.createRadialGradient(x, y, 0, x, y, r);
                const c = night ? "120,80,200" : "255,250,240";
                gr.addColorStop(0, `rgba(${c},${night ? 0.32 : 0.95})`); gr.addColorStop(1, `rgba(${c},0)`);
                g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
            }
            if (!night) {                                       // warm light on the cloud tops
                g.globalCompositeOperation = "source-atop";
                const lg = g.createLinearGradient(0, 0, 0, h);
                lg.addColorStop(0, "rgba(255,214,150,.55)"); lg.addColorStop(0.6, "rgba(255,255,255,0)"); lg.addColorStop(1, "rgba(200,170,230,.35)");
                g.fillStyle = lg; g.fillRect(0, 0, w, h);
            }
            return cv;
        }
        function setup() {
            const R = U.rng(1616), unit = Math.min(W, H);
            sky = null;
            stars = Array.from({ length: preview ? 50 : night ? 240 : 70 }, () => ({ x: R() * W, y: R() * H * 0.9, r: 0.5 + R() * 1.6, tw: R() * TAU, z: 0.3 + R() * 0.7 }));
            // the nebula: soft clouds of colour, drawn once, larger than the screen so it can drift
            nebula = Worlds.canvas(W * 1.3, H * 1.3);
            {
                const g = nebula.getContext("2d"), cols = night ? ["107,63,214", "214,95,168", "63,200,214", "155,107,255"] : ["201,168,255", "255,207,158", "255,179,217", "255,236,180"];
                for (let i = 0; i < (preview ? 14 : 40); i++) {
                    const x = R() * W * 1.3, y = R() * H * 1.1, r = unit * (0.12 + R() * 0.32), c = cols[i % cols.length];
                    const gr = g.createRadialGradient(x, y, 0, x, y, r);
                    gr.addColorStop(0, `rgba(${c},${night ? 0.13 : 0.2})`); gr.addColorStop(1, `rgba(${c},0)`);
                    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
                }
            }
            // THE TEAR: a jagged wound across the upper sky, wide in the middle, with little side cracks
            const N = 34, x0 = W * 0.5, y0 = -H * 0.04, x1 = W * 1.06, y1 = H * 0.5, wMax = unit * 0.055;
            const ang = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(ang), ny = Math.cos(ang);
            const top = [], bot = [], mid = [];
            for (let i = 0; i <= N; i++) {
                // the middle line wanders; the edges sit either side of it along the normal (n = nx, ny), jagged
                const u = i / N, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u + Math.sin(u * 7.3) * unit * 0.025;
                const w = wMax * Math.pow(Math.sin(Math.PI * u), 0.85) * (0.75 + R() * 0.5) + 1;
                top.push([x - nx * w + (R() - 0.5) * 8, y - ny * w + (R() - 0.5) * 6]);
                bot.push([x + nx * w * 0.9 + (R() - 0.5) * 8, y + ny * w * 0.9 + (R() - 0.5) * 6]);
                mid.push([x, y]);
            }
            const path = new Path2D();
            top.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
            for (let i = bot.length - 1; i >= 0; i--) path.lineTo(bot[i][0], bot[i][1]);
            path.closePath();
            const edge = (list) => { const p = new Path2D(); list.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); return p; };
            const branches = new Path2D();
            for (let i = 3; i < N - 3; i += 3) {
                const side = i % 2 ? top : bot, [x, y] = side[i], dir = side === top ? -1 : 1;
                let px = x, py = y;
                branches.moveTo(px, py);
                for (let k = 0; k < 3; k++) { px += (R() - 0.5) * unit * 0.05; py += dir * unit * (0.015 + R() * 0.02); branches.lineTo(px, py); }
            }
            const c = mid[Math.floor(N / 2)];
            tear = { path, top: edge(top), bot: edge(bot), branches, mid, pts: [...top, ...bot], cx: c[0], cy: c[1], nx, ny, wMax, inner: null };
            ruins = [
                { kind: "column", x: W * 0.12, y: H * 0.62, s: unit * 0.12, z: 0.9, ph: 0, lantern: true, rot: -0.12 },
                { kind: "arch", x: W * 0.84, y: H * 0.58, s: unit * 0.1, z: 0.75, ph: 1.4, lantern: true, rot: 0.08 },
                { kind: "slab", x: W * 0.62, y: H * 0.76, s: unit * 0.09, z: 1.05, ph: 2.2, lantern: false, rot: -0.04 },
                { kind: "wing", x: W * 0.34, y: H * 0.5, s: unit * 0.07, z: 0.55, ph: 3.3, lantern: true, rot: 0.2 },
                { kind: "column", x: W * 0.5, y: H * 0.46, s: unit * 0.05, z: 0.4, ph: 4.1, lantern: false, rot: 0.3 }
            ].map(r => ({ ...r, img: sprite(r.kind, r.s) }));
            shards = Array.from({ length: preview ? 4 : 8 }, (_, i) => ({ a: (i / 8) * TAU, r: unit * (0.1 + R() * 0.14), sp: (0.1 + R() * 0.15) * (i % 2 ? 1 : -1), s: unit * (0.012 + R() * 0.014), h: R() * TAU }));
            feathers = Array.from({ length: preview ? 6 : 26 }, () => newFeather(R, true));
            motes = Array.from({ length: preview ? 14 : 60 }, () => ({ x: R() * W, y: R() * H, sp: 10 + R() * 26, ph: R() * TAU, r: 0.8 + R() * 1.8 }));
            mist = [puff(Math.max(400, W * 0.7), Math.max(140, H * 0.22)), puff(Math.max(400, W * 0.9), Math.max(160, H * 0.26))];
            sparks = [];
        }
        function newFeather(R = Math.random, initial = false) {
            const dark = night ? (R() < 0.45) : false;
            return { x: R() * W, y: initial ? R() * H : -30, vy: 18 + R() * 22, sway: 0.6 + R() * 1.2, ph: R() * TAU, s: 0.7 + R() * 0.8, rot: R() * TAU, dark, gold: !night && R() < 0.3 };
        }
        setup();

        function drawFeather(g, f, x, y, t) {
            const a = Math.sin(t * f.sway + f.ph) * 0.9 + f.rot;
            g.save(); g.translate(x, y); g.rotate(a); g.scale(f.s, f.s);
            g.fillStyle = f.dark ? "#2a1d3f" : f.gold ? "#ffe2a0" : "#ffffff";
            g.globalAlpha = f.dark ? 0.85 : 0.9;
            g.beginPath(); g.moveTo(0, -14); g.quadraticCurveTo(7, -6, 4, 10); g.lineTo(0, 14); g.lineTo(-4, 10); g.quadraticCurveTo(-7, -6, 0, -14); g.fill();
            g.strokeStyle = f.dark ? "rgba(155,107,255,.6)" : "rgba(180,150,110,.6)"; g.lineWidth = 0.8;
            g.beginPath(); g.moveTo(0, -12); g.lineTo(0, 16); g.stroke();
            for (let i = -8; i < 10; i += 4) { g.beginPath(); g.moveTo(0, i); g.lineTo(5, i - 3); g.moveTo(0, i); g.lineTo(-5, i - 3); g.stroke(); }
            g.globalAlpha = 1;
            g.restore();
        }
        // a crystal lantern of starlight hanging off a ruin on a thin golden cord, swaying (the user, 2026-10-14: the
        // hanging chains here looked inappropriate, so they became lanterns)
        function drawLantern(g, x, y, s, t, ph) {
            const sway = Math.sin(t * 0.9 + ph) * 0.18, len = s * 0.8;
            const ex = x + Math.sin(sway) * len, ey = y + Math.cos(sway) * len;
            g.strokeStyle = TRIM; g.lineWidth = Math.max(1, s * 0.02);
            g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.sin(sway) * len * 0.3, y + len * 0.55, ex, ey); g.stroke();
            const w = s * 0.1, h = s * 0.26, lit = 0.55 + 0.25 * Math.sin(t * 2 + ph);
            g.save(); g.translate(ex, ey); g.rotate(-sway);
            Worlds.glow(g, 0, h * 0.45, h * 1.5, night ? "#c49bff" : "#ffd06b", lit);
            g.fillStyle = TRIM; g.fillRect(-w * 0.45, -h * 0.06, w * 0.9, h * 0.08);       // its little gold cap
            g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h * 0.35); g.lineTo(0, h); g.lineTo(-w, h * 0.35); g.closePath();
            const cg = g.createLinearGradient(-w, 0, w, h);
            cg.addColorStop(0, "#fff6d8"); cg.addColorStop(0.5, night ? "#c49bff" : "#ffd06b"); cg.addColorStop(1, night ? "#6b3fd6" : "#e8a840");
            g.fillStyle = cg; g.fill(); g.lineWidth = Math.max(1, s * 0.015); g.strokeStyle = TRIM; g.stroke();
            g.beginPath(); g.moveTo(0, 0); g.lineTo(0, h); g.moveTo(-w, h * 0.35); g.lineTo(w, h * 0.35); g.strokeStyle = "rgba(255,255,255,.5)"; g.stroke();
            g.restore();
            Worlds.glint(g, ex, ey + h * 0.35, s * 0.1, 0.5 + 0.5 * Math.sin(t * 3 + ph), "#fff3c4");
        }

        return {
            resize(w, h) { W = w; H = h; setup(); },
            draw(g, t, dt, inp) {
                if (!sky) {
                    sky = g.createLinearGradient(0, 0, 0, H);
                    if (night) { sky.addColorStop(0, "#04020f"); sky.addColorStop(0.45, "#140834"); sky.addColorStop(0.8, "#28104a"); sky.addColorStop(1, "#3a1a5a"); }
                    else { sky.addColorStop(0, "#f9ecff"); sky.addColorStop(0.4, "#ffeedd"); sky.addColorStop(0.75, "#ffe1b8"); sky.addColorStop(1, "#ffd6a6"); }
                    tear.inner = g.createLinearGradient(tear.cx + tear.nx * -tear.wMax, tear.cy - tear.ny * tear.wMax, tear.cx - tear.nx * -tear.wMax, tear.cy + tear.ny * tear.wMax);
                    if (night) { tear.inner.addColorStop(0, "#ffb86b"); tear.inner.addColorStop(0.45, "#fff6d8"); tear.inner.addColorStop(0.55, "#ffe7a3"); tear.inner.addColorStop(1, "#c46bff"); }
                    else { tear.inner.addColorStop(0, "#2a0f5a"); tear.inner.addColorStop(0.45, "#7a3cff"); tear.inner.addColorStop(0.55, "#4a1f9a"); tear.inner.addColorStop(1, "#14062e"); }
                }
                g.fillStyle = sky; g.fillRect(0, 0, W, H);
                const px = inp.px, py = inp.py;
                // stars, nearer ones drifting more with the pointer
                for (const s of stars) {
                    const tw = Math.abs(Math.sin(t * (0.6 + s.z) + s.tw)), x = s.x - px * 6 * s.z, y = s.y - py * 4 * s.z;
                    g.fillStyle = night ? `rgba(255,248,230,${(0.25 + 0.75 * tw).toFixed(2)})` : `rgba(255,190,120,${(0.15 + 0.45 * tw).toFixed(2)})`;
                    g.fillRect(x, y, s.r, s.r);
                    if (s.r > 1.3) Worlds.twinkle(g, x + s.r / 2, y + s.r / 2, s.r, tw, night ? "rgb(255,240,200)" : "rgb(255,200,140)");
                }
                g.drawImage(nebula, -W * 0.15 - px * 14 + Math.sin(t * 0.03) * W * 0.05, -H * 0.12 - py * 10);
                // light pouring out of the tear: slow god rays (day: the dawn sun's rays from the top left too)
                const pulse = 0.8 + 0.2 * Math.sin(t * 1.3) + 0.08 * Math.sin(t * 3.7);
                g.save();
                g.globalCompositeOperation = "lighter";
                const ox = tear.cx - px * 10, oy = tear.cy - py * 8;
                for (let i = 0; i < 9; i++) {
                    const a = Math.PI * 0.55 + i * 0.13 + Math.sin(t * 0.15 + i) * 0.05, len = Math.hypot(W, H);
                    const grd = g.createLinearGradient(ox, oy, ox + Math.cos(a) * len * 0.8, oy + Math.sin(a) * len * 0.8);
                    grd.addColorStop(0, night ? `rgba(255,220,150,${(0.08 * pulse).toFixed(3)})` : `rgba(155,90,255,${(0.06 * pulse).toFixed(3)})`); grd.addColorStop(1, "rgba(255,220,150,0)");
                    g.fillStyle = grd;
                    g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + Math.cos(a - 0.05) * len, oy + Math.sin(a - 0.05) * len); g.lineTo(ox + Math.cos(a + 0.05) * len, oy + Math.sin(a + 0.05) * len); g.closePath(); g.fill();
                }
                g.restore();
                // the tear itself
                g.save();
                g.translate(-px * 10, -py * 8);
                g.save();
                g.globalCompositeOperation = night ? "lighter" : "source-over";
                g.strokeStyle = night ? `rgba(255,190,110,${(0.14 * pulse).toFixed(3)})` : `rgba(122,60,255,${(0.12 * pulse).toFixed(3)})`;
                g.lineWidth = tear.wMax * 1.2; g.lineJoin = "round"; g.stroke(tear.path);
                g.lineWidth = tear.wMax * 0.5; g.strokeStyle = night ? `rgba(255,230,170,${(0.24 * pulse).toFixed(3)})` : `rgba(90,30,200,${(0.18 * pulse).toFixed(3)})`; g.stroke(tear.path);
                g.restore();
                g.globalAlpha = night ? 0.88 : 0.92; g.fillStyle = tear.inner; g.fill(tear.path); g.globalAlpha = 1;
                // inside: the light of the other side, clouds of glow drifting through it and stars
                g.save();
                g.clip(tear.path);
                g.globalCompositeOperation = "lighter";
                for (let i = 0; i < 7; i++) {
                    const m = tear.mid[Math.floor(((i / 7) + t * 0.01) % 1 * (tear.mid.length - 1))];
                    Worlds.glow(g, m[0] + Math.sin(t * 0.4 + i) * 30, m[1], tear.wMax * (1.4 + Math.sin(t * 0.7 + i * 2) * 0.4), night ? "#fff2c4" : "#b48cff", 0.55 * pulse);
                }
                for (let i = 0; i < 24; i++) {
                    const m = tear.mid[(i * 7) % tear.mid.length], tw = 0.5 + 0.5 * Math.sin(t * 4 + i * 1.7);
                    Worlds.glint(g, m[0] + Math.sin(i * 3.1) * tear.wMax * 0.5, m[1] + Math.cos(i * 2.3) * tear.wMax * 0.35, 4 + tw * 5, tw, night ? "#ffffff" : "#e3c8ff");
                }
                g.restore();
                // the burning edges and the little cracks off them
                g.save();
                g.globalCompositeOperation = night ? "lighter" : "source-over";
                g.lineJoin = "round";
                g.strokeStyle = night ? "#ffe7a3" : "#4a1f9a"; g.lineWidth = 2.4;
                g.stroke(tear.top); g.stroke(tear.bot);
                g.strokeStyle = night ? `rgba(255,214,120,${(0.5 * pulse).toFixed(3)})` : `rgba(90,40,180,${(0.45 * pulse).toFixed(3)})`; g.lineWidth = 1.3; g.stroke(tear.branches);
                g.restore();
                g.restore();
                // sparks of light (night) or drops of violet corruption (day) shed from the edges
                if (!preview && sparks.length < 60 && Math.random() < dt * 22) {
                    const p = U.pick(tear.pts);
                    sparks.push({ x: p[0], y: p[1], vx: (Math.random() - 0.5) * 30, vy: 10 + Math.random() * 30, life: 1.2 + Math.random() * 1.4, age: 0 });
                }
                for (const s of sparks) {
                    s.age += dt; s.vy += 28 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
                    const k = 1 - s.age / s.life, x = s.x - px * 10, y = s.y - py * 8;
                    if (night) { Worlds.glow(g, x, y, 6, "#ffd06b", k); g.fillStyle = `rgba(255,246,214,${k.toFixed(2)})`; g.fillRect(x - 1, y - 1, 2, 2); }
                    else { g.fillStyle = `rgba(110,50,220,${(0.75 * k).toFixed(2)})`; g.beginPath(); g.ellipse(x, y, 1.6, 2.8, 0, 0, TAU); g.fill(); }
                }
                sparks = sparks.filter(s => s.age < s.life);
                // crystal shards circling the tear's heart
                for (const sh of shards) {
                    const a = sh.a + t * sh.sp, x = tear.cx + Math.cos(a) * sh.r * 1.6 - px * 18, y = tear.cy + Math.sin(a) * sh.r * 0.55 - py * 12, s = sh.s;
                    const front = Math.sin(a) > 0;
                    g.save(); g.translate(x, y); g.rotate(a * 2 + sh.h);
                    g.fillStyle = night ? (front ? "#d9c4ff" : "#8a6bd6") : (front ? "#c9a8ff" : "#9a7ad6");
                    g.beginPath(); g.moveTo(0, -s * 2); g.lineTo(s, 0); g.lineTo(0, s * 2); g.lineTo(-s, 0); g.closePath(); g.fill();
                    g.fillStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.moveTo(0, -s * 2); g.lineTo(s, 0); g.lineTo(0, 0); g.closePath(); g.fill();
                    g.restore();
                    if (front) Worlds.glint(g, x, y - s, s * 1.6, 0.5 + 0.5 * Math.sin(t * 5 + sh.h), "#ffffff");
                }
                // the prison's ruins, bobbing at their depths, lanterns hanging
                for (const r of ruins) {
                    const x = r.x - px * 24 * r.z, y = r.y + Math.sin(t * 0.5 + r.ph) * 10 * r.z - py * 10 * r.z;
                    g.save(); g.translate(x, y); g.rotate(r.rot + Math.sin(t * 0.3 + r.ph) * 0.03);
                    g.globalAlpha = 0.55 + r.z * 0.4;
                    g.drawImage(r.img, -r.img.width / 2, -r.img.height * 0.55);
                    g.globalAlpha = 1;
                    if (r.lantern) drawLantern(g, r.s * 0.3, r.s * 0.75, r.s, t, r.ph);
                    g.restore();
                }
                // feathers falling, black ones too at night (the angel's)
                for (let i = 0; i < feathers.length; i++) {
                    const f = feathers[i];
                    f.y += f.vy * dt;
                    if (f.y > H + 30) feathers[i] = newFeather();
                    drawFeather(g, f, f.x + Math.sin(t * f.sway + f.ph) * 30 - px * 16, f.y - py * 8, t);
                }
                // golden motes rising
                for (const m of motes) {
                    m.y -= m.sp * dt; if (m.y < -10) { m.y = H + 10; m.x = Math.random() * W; }
                    const x = m.x + Math.sin(t * 0.8 + m.ph) * 14 - px * 10, k = 0.5 + 0.5 * Math.sin(t * 2 + m.ph);
                    Worlds.glow(g, x, m.y, m.r * 5, night ? "#ffd06b" : "#ffb347", 0.35 + 0.4 * k);
                    g.fillStyle = night ? "#fff6d8" : "#fff2c4"; g.beginPath(); g.arc(x, m.y, m.r * 0.7, 0, TAU); g.fill();
                }
                // a shooting star now and then
                nextShoot -= dt;
                if (!preview && nextShoot <= 0) { shooters.push({ x: W * U.rand(0.2, 1.1), y: H * U.rand(0, 0.3), vx: -U.rand(380, 600), vy: U.rand(160, 260), age: 0 }); nextShoot = U.rand(5, 11); }
                for (const s of shooters) {
                    s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt;
                    const k = Math.max(0, 1 - s.age / 1.4), lg = g.createLinearGradient(s.x, s.y, s.x - s.vx * 0.18, s.y - s.vy * 0.18);
                    lg.addColorStop(0, night ? `rgba(255,250,230,${k})` : `rgba(255,170,90,${k * 0.8})`); lg.addColorStop(1, "rgba(255,250,230,0)");
                    g.strokeStyle = lg; g.lineWidth = 2.2; g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(s.x - s.vx * 0.18, s.y - s.vy * 0.18); g.stroke();
                    Worlds.glow(g, s.x, s.y, 10, night ? "#ffffff" : "#ffcf8a", k);
                }
                shooters = shooters.filter(s => s.age < 1.4);
                // the sea of mist (night) or clouds (day) below
                for (let i = 0; i < 2; i++) {
                    const m = mist[i], speed = i ? 9 : 5, off = ((t * speed) % m.width), y = H - m.height * (i ? 0.85 : 1.15) - py * (6 + i * 6);
                    for (let x = -off - px * (10 + i * 14); x < W + m.width; x += m.width) g.drawImage(m, x, y);
                }
            }
        };
    }

    // ---------------------------------------------------------------------------------------------
    // The board: a little star, feather or rune in each typed square; a gold halo line along finished words
    // ---------------------------------------------------------------------------------------------
    const MARKS = [
        r => `<path d="M0 -.06L.014 -.014L.06 0L.014 .014L0 .06L-.014 .014L-.06 0L-.014 -.014Z" fill="#ffd06b"/><circle r=".012" fill="#fff6d8"/>`,
        r => `<path d="M-.045 .05Q-.03 -.04 .05 -.055Q.03 .03 -.045 .05Z" fill="${r(1) < 0.5 ? "#ffffff" : "#2a1d3f"}" stroke="#c49bff" stroke-width=".007"/><path d="M-.045 .05L.035 -.035" stroke="#c49bff" stroke-width=".006"/>`,
        r => `<path d="M-.03 -.045V.045M-.03 -.01L.03 -.045M-.03 .015L.03 .045" stroke="#9b6bff" stroke-width=".012" stroke-linecap="round" fill="none"/>`,
        r => `<circle r=".03" fill="none" stroke="#ffd06b" stroke-width=".01"/><circle r=".008" fill="#ffd06b"/>`,
        r => `<path d="M0 -.05L.04 0L0 .05L-.04 0Z" fill="#c49bff" opacity=".9"/><path d="M0 -.05L.04 0H0Z" fill="#ffffff" opacity=".7"/>`
    ];
    const board = Worlds.decoBoard({
        id: "rf",
        mark: r => MARKS[Math.floor(r(0) * MARKS.length)](r),
        word(entry, cells, rnd, g, across) {
            const [r0, c0] = cells[0], len = cells.length;
            const d = across ? `M${c0 + 0.12} ${r0 + 0.9}L${c0 + len - 0.12} ${r0 + 0.9}` : `M${c0 + 0.9} ${r0 + 0.12}L${c0 + 0.9} ${r0 + len - 0.12}`;
            U.svg("path", { d, class: "rf-halo-glow", pathLength: "1" }, g);
            U.svg("path", { d, class: "rf-halo", pathLength: "1" }, g);
            const ends = across ? [[c0 + 0.12, r0 + 0.9], [c0 + len - 0.12, r0 + 0.9]] : [[c0 + 0.9, r0 + 0.12], [c0 + 0.9, r0 + len - 0.12]];
            for (const [x, y] of ends) U.svg("path", { d: `M${x} ${y - 0.07}L${x + 0.02} ${y - 0.02}L${x + 0.07} ${y}L${x + 0.02} ${y + 0.02}L${x} ${y + 0.07}L${x - 0.02} ${y + 0.02}L${x - 0.07} ${y}L${x - 0.02} ${y - 0.02}Z`, class: "rf-star" }, g);
        },
        type(cell) {
            const p = U.center(cell);
            FX.burst({ x: p.x, y: p.y, n: 5, colors: GOLD, shape: "star", speed: [30, 90], gravity: -20, drag: 2, life: [0.4, 0.7], size: [2, 4], glow: true });
        },
        wordDone(entry, cells) {
            cells.forEach(([r, c], i) => setTimeout(() => {
                const cell = Game.cellEl(r, c);
                if (!cell) return;
                const p = U.center(cell);
                FX.burst({ x: p.x, y: p.y, n: 5, colors: ["#ffffff", "#2a1d3f", "#ffe7a3"], shape: "petal", speed: [40, 120], gravity: 60, life: [0.7, 1.1], size: [5, 8], spin: 2 });
                FX.burst({ x: p.x, y: p.y, n: 4, colors: GOLD, shape: "star", speed: [60, 160], gravity: -40, life: [0.5, 0.9], size: [2, 4], glow: true });
            }, i * 60));
        }
    });

    // ---------------------------------------------------------------------------------------------
    // The win: the Constellation and Heaven's Gate (the user, 2026-10-14: "a different victory animation for the
    // celestial rift"). The sky goes dark and every square lights up as a star; golden lines join them answer by
    // answer into a constellation. The constellation rises off the board and closes into a halo above it. Then the
    // heavens open: two gates of light part at the top of the screen and god rays pour down onto the board, great
    // wings of light unfold behind it and beat once, shaking loose a fall of white and gold feathers, and the halo
    // comes down over the board and rings out.
    // It follows the board (the user, 2026-10-14): the board is measured again every frame, and the stars, lines, halo,
    // wings and feathers are kept relative to it, so a scroll, a resize or the page moving around doesn't leave them behind.
    // ---------------------------------------------------------------------------------------------
    async function celebrate(c, { boardEl }) {
        if (U.motion() === "still") return;
        let W, H, bx, by, R, hx, hy, hrx, hry;
        const measure = () => {
            const b = boardEl.getBoundingClientRect();
            W = innerWidth; H = innerHeight;
            bx = b.left + b.width / 2; by = b.top + b.height / 2; R = Math.max(b.width, b.height) / 2 || 1;
            // where the halo forms: above the board (kept on screen)
            hx = bx; hy = Math.max(64, b.top - R * 0.12); hrx = R * 0.62; hry = hrx * 0.24;
        };
        measure();
        const p = Game.state.puzzle;
        if (!p) return;
        const ease = k => 1 - Math.pow(1 - k, 3), inout = k => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2, clamp01 = k => Math.max(0, Math.min(1, k));
        // the stars: one per open square, in reading order
        const stars = [], byId = new Map();
        p.solution.forEach((row, r) => [...row].forEach((ch, col) => {
            if (ch === ".") return;
            const el = Game.cellEl(r, col);
            if (!el) return;
            // each star's place on the board, in board radii from its middle
            const q = el.getBoundingClientRect(), s = { u: (q.left + q.width / 2 - bx) / R, v: (q.top + q.height / 2 - by) / R, born: stars.length * 0.022, tw: Math.random() * TAU, size: 2.4 + Math.random() * 1.6 };
            s.x = bx + s.u * R; s.y = by + s.v * R;
            stars.push(s); byId.set(r + "," + col, s);
        }));
        // the constellation: each answer, one after another
        const lines = [...p.across, ...p.down].map((e, i) => ({ pts: Game.cellsOf(e).map(([r, col]) => byId.get(r + "," + col)).filter(Boolean), at: 0.35 + i * 0.07 })).filter(l => l.pts.length > 1);
        stars.forEach((s, i) => { s.a = (i / stars.length) * TAU; });
        const T = { lift: 1.15 + lines.length * 0.07, gate: 0, wings: 0, down: 0, end: 0 };
        T.halo = T.lift + 0.9; T.gate = T.halo + 0.15; T.wings = T.gate + 0.9; T.down = T.wings + 1.15; T.end = T.down + 1.1;
        let t = 0, alive = true, beat = false;
        const ups = [];                                                       // feathers shaken loose by the wings (x, y from the board's middle)
        // ---- a wing: the arm curves up and out from the board's shoulder; three rows of broad white feathers hang from
        //      it (long primaries at the back, then secondaries, then short coverts on top), edged in gold ----
        const feather = (g, len, wid) => {
            const fg = g.createLinearGradient(0, 0, len, 0);
            fg.addColorStop(0, "#fffdf6"); fg.addColorStop(0.7, "#fff4d6"); fg.addColorStop(1, "#ffe2a0");
            g.fillStyle = fg;
            g.beginPath(); g.moveTo(0, -wid * 0.35);
            g.quadraticCurveTo(len * 0.55, -wid * 0.75, len, -wid * 0.1);
            g.quadraticCurveTo(len * 1.02, wid * 0.15, len * 0.9, wid * 0.35);
            g.quadraticCurveTo(len * 0.5, wid * 0.6, 0, wid * 0.35); g.closePath();
            g.fill(); g.stroke();
            g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.5, -wid * 0.08, len * 0.95, 0); g.stroke();
        };
        function wing(g, side, open, flap) {
            const L = R * 1.15;
            g.save();
            g.translate(bx + side * R * 0.78, by - R * 0.42); g.scale(side, 1);
            g.rotate((1 - ease(open)) * 1.1 - flap * 0.22);                    // folded down at first, then up and out; it beats once
            const sc = 0.35 + 0.65 * ease(open);
            g.scale(sc, sc);
            const arm = u => { const x = (1 - u) * (1 - u) * 0 + 2 * (1 - u) * u * L * 0.25 + u * u * L * 1.05, y = 2 * (1 - u) * u * -L * 0.85 + u * u * -L * 0.55; return [x, y]; };
            Worlds.glow(g, L * 0.5, -L * 0.2, L * 0.9, "#fff1c4", 0.35 * fadeOf());
            g.strokeStyle = "#d9a640"; g.lineWidth = 1.4; g.lineJoin = "round";
            const rows = [[13, L * 0.62, L * 1.25, L * 0.17, 0.0], [11, L * 0.45, L * 0.8, L * 0.15, 0.04], [9, L * 0.25, L * 0.42, L * 0.13, 0.08]];
            for (const [n, l0, l1, wid, off] of rows) {
                for (let j = n - 1; j >= 0; j--) {
                    const u = Math.min(1, 0.04 + j / (n - 1) * 0.96 + off * 0.2), [x, y] = arm(u);
                    const ang = 1.75 - u * 1.45 + flap * 0.25 * u;                // down at the shoulder, out at the tip
                    g.save(); g.translate(x, y + off * L); g.rotate(ang);
                    feather(g, l0 + (l1 - l0) * Math.pow(u, 1.3), wid);
                    g.restore();
                }
            }
            // the arm itself, a soft gold bone along the top
            g.strokeStyle = "#e8c66a"; g.lineWidth = 5; g.lineCap = "round"; g.beginPath();
            for (let i = 0; i <= 16; i++) { const [x, y] = arm(i / 16); if (i) g.lineTo(x, y); else g.moveTo(x, y); }
            g.stroke();
            g.restore();
        }
        let fadeOf = () => 1;
        FX.add({
            fixed: true,                                                      // (it tracks the board itself, scroll included)
            update(dt) { t += dt; for (const f of ups) { f.vy += 30 * dt; f.x += (f.vx + Math.sin(t * 2 + f.ph) * 30) * dt; f.y += f.vy * dt; f.rot += f.vr * dt; } return alive; },
            draw(g) {
                measure();
                const fadeAll = t > T.end - 0.6 ? clamp01((T.end - t) / 0.6) : 1;
                // the sky darkens
                g.fillStyle = `rgba(10,4,32,${0.62 * clamp01(t / 0.5) * fadeAll})`; g.fillRect(0, 0, W, H);
                g.globalCompositeOperation = "lighter";
                // ---- the gates of heaven part and god rays fall onto the board ----
                if (t > T.gate) {
                    const k = clamp01((t - T.gate) / 0.9), open = inout(k), a = fadeAll * (t > T.down + 0.3 ? 0.75 : 1);
                    const gw = Math.min(W * 0.2, R * 1.25) * open, top = -H * 0.06;
                    // heaven opening: a soft round glow at the top of the screen, white in the middle (scaled so its edge fades out)
                    const rx = gw * 2.2 + 10, ry = H * 0.42 * (0.4 + 0.6 * open);
                    g.save(); g.translate(bx, top); g.scale(1, ry / rx);
                    const arch = g.createRadialGradient(0, 0, 4, 0, 0, rx);
                    arch.addColorStop(0, `rgba(255,255,250,${0.9 * a})`); arch.addColorStop(0.35, `rgba(255,240,200,${0.5 * a})`); arch.addColorStop(1, "rgba(255,220,150,0)");
                    g.fillStyle = arch; g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill();
                    g.restore();
                    // god rays pouring out of the gate onto the board
                    for (let i = 0; i < 11; i++) {
                        const u = i / 10 - 0.5, sway = Math.sin(t * 0.9 + i * 1.7) * 0.025, ang = Math.PI / 2 + u * 0.6 * open + sway, len = H * 1.3, wid = (0.025 + 0.018 * Math.sin(i * 2.3)) * open;
                        const ox = bx + u * gw * 0.8, rg = g.createLinearGradient(ox, 0, ox + Math.cos(ang) * len, Math.sin(ang) * len);
                        rg.addColorStop(0, `rgba(255,240,200,${(0.22 + 0.1 * Math.sin(t * 2 + i)) * a})`); rg.addColorStop(1, "rgba(255,236,170,0)");
                        g.fillStyle = rg; g.beginPath(); g.moveTo(ox, 0);
                        g.lineTo(ox + Math.cos(ang - wid) * len, Math.sin(ang - wid) * len); g.lineTo(ox + Math.cos(ang + wid) * len, Math.sin(ang + wid) * len); g.closePath(); g.fill();
                    }
                }
                // ---- the wings of light ----
                if (t > T.wings) {
                    const open = clamp01((t - T.wings) / 0.9), fl = t > T.wings + 0.85 && t < T.wings + 1.45 ? Math.sin(((t - T.wings - 0.85) / 0.6) * Math.PI) : 0;
                    fadeOf = () => fadeAll;
                    g.save(); g.globalCompositeOperation = "source-over"; g.globalAlpha = fadeAll * 0.92; wing(g, -1, open, fl); wing(g, 1, open, fl); g.restore();
                    g.globalCompositeOperation = "lighter";
                    if (fl > 0.9 && !beat) {
                        beat = true;
                        for (const s of [-1, 1]) for (let i = 0; i < 26; i++) ups.push({ x: s * R * (0.9 + Math.random() * 1.2), y: -R * (0.6 - Math.random() * 1.1), vx: s * (20 + Math.random() * 80), vy: -60 + Math.random() * 50, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 3, ph: Math.random() * TAU, gold: Math.random() < 0.3 });
                        for (let i = 0; i < 30; i++) ups.push({ x: Math.random() * W - bx, y: -20 - Math.random() * 120 - by, vx: (Math.random() - 0.5) * 30, vy: 20 + Math.random() * 40, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 2, ph: Math.random() * TAU, gold: Math.random() < 0.25 });
                    }
                }
                // ---- the constellation: stars on the squares, lines along the answers ----
                const lift = clamp01((t - T.lift) / 0.9), lk = inout(lift);
                for (const s of stars) {
                    const x0 = bx + s.u * R, y0 = by + s.v * R;
                    s.x = x0; s.y = y0;
                    if (t < s.born) continue;
                    if (lift > 0) {
                        if (t > T.halo) s.a += 0.9 / 60;
                        const tx = hx + Math.cos(s.a) * hrx, ty = hy + Math.sin(s.a) * hry;
                        let dx = tx, dy = ty;
                        if (t > T.down) { const d = inout(clamp01((t - T.down) / 0.55)); dx = bx + Math.cos(s.a) * (hrx + (R * 1.05 - hrx) * d); dy = (hy + (by - hy) * d) + Math.sin(s.a) * (hry + (R * 0.3 - hry) * d); }
                        s.x = x0 + (dx - x0) * lk; s.y = y0 + (dy - y0) * lk - Math.sin(lk * Math.PI) * 40;
                    }
                }
                const lineA = (1 - lk) * fadeAll;
                if (lineA > 0) for (const l of lines) {
                    const k = clamp01((t - l.at) / 0.35);
                    if (k <= 0) continue;
                    const n = l.pts.length - 1, upto = k * n;
                    g.strokeStyle = `rgba(255,214,120,${0.75 * lineA})`; g.lineWidth = 2; g.shadowColor = "#ffd06b"; g.shadowBlur = 10;
                    g.beginPath(); g.moveTo(l.pts[0].x, l.pts[0].y);
                    for (let i = 1; i <= Math.ceil(upto); i++) { const a = l.pts[i - 1], z = l.pts[i], f = Math.min(1, upto - (i - 1)); g.lineTo(a.x + (z.x - a.x) * f, a.y + (z.y - a.y) * f); }
                    g.stroke(); g.shadowBlur = 0;
                }
                for (const s of stars) {
                    if (t < s.born) continue;
                    const pop = clamp01((t - s.born) / 0.25), tw = 0.75 + 0.25 * Math.sin(t * 6 + s.tw);
                    Worlds.glow(g, s.x, s.y, 14 * pop, "#ffd06b", 0.7 * tw * fadeAll);
                    Worlds.glint(g, s.x, s.y, s.size * 3 * pop * tw, fadeAll, "#fff6d8");
                }
                // ---- the halo: a ring of gold once the stars have gathered ----
                if (t > T.halo) {
                    const k = clamp01((t - T.halo) / 0.5), d = t > T.down ? inout(clamp01((t - T.down) / 0.55)) : 0;
                    const cx = bx, cy = hy + (by - hy) * d, rx = hrx + (R * 1.05 - hrx) * d, ry = hry + (R * 0.3 - hry) * d;
                    g.lineWidth = 7; g.strokeStyle = `rgba(255,214,120,${0.55 * k * fadeAll})`; g.shadowColor = "#ffd06b"; g.shadowBlur = 24;
                    g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.stroke();
                    g.lineWidth = 2; g.strokeStyle = `rgba(255,252,240,${0.9 * k * fadeAll})`; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.stroke(); g.shadowBlur = 0;
                }
                // ---- the falling feathers ----
                g.globalCompositeOperation = "source-over";
                for (const f of ups) {
                    if (by + f.y > H + 40) continue;
                    g.save(); g.translate(bx + f.x, by + f.y); g.rotate(f.rot); g.globalAlpha = 0.9 * fadeAll;
                    g.fillStyle = f.gold ? "#ffe7a3" : "#ffffff"; g.strokeStyle = f.gold ? "#c9902f" : "#c9b8ff"; g.lineWidth = 1;
                    g.beginPath(); g.moveTo(-10, 0); g.quadraticCurveTo(0, -5, 10, 0); g.quadraticCurveTo(0, 4, -10, 0); g.fill(); g.stroke();
                    g.beginPath(); g.moveTo(-12, 0.5); g.lineTo(9, 0); g.stroke();
                    g.restore();
                }
                g.globalAlpha = 1;
            }
        });
        c.cleanup(() => { alive = false; });
        // the board glows gold while heaven is open
        const glowAnim = boardEl.animate([{ filter: "none" }, { filter: "brightness(1.25) drop-shadow(0 0 22px rgba(255,214,120,.9))", offset: 0.5 }, { filter: "none" }],
            { duration: (T.end - T.gate) * 1000, delay: T.gate * 1000, easing: "ease-in-out" });
        c.cleanup(() => glowAnim.cancel());
        // ---- the beats, with their sounds ----
        stars.forEach((s, i) => { if (i % 3 === 0) c.later(() => bell(0, 84 + (i / 3 % 6) * 2, 0.018, 0.5), s.born * 1000); });
        lines.forEach((l, i) => c.later(() => harp(0, 67 + [0, 4, 7, 12, 16, 19, 24][i % 7], 0.03), l.at * 1000));
        c.later(() => { [72, 76, 79, 84, 88, 91].forEach((n, i) => harp(i * 0.06, n, 0.035)); }, T.lift * 1000);
        c.later(() => { Sound.play("title"); }, T.halo * 1000);
        c.later(() => { choir(0, [60, 67, 72, 76], 0.035, 2.4); noise({ type: "bandpass", f: 1200, f2: 3200, d: 1.6, v: 0.04, q: 0.5 }); }, T.gate * 1000);
        c.later(() => { noise({ type: "bandpass", f: 300, f2: 900, d: 0.8, v: 0.07, q: 0.7 }); choir(0, [55, 62, 67, 71], 0.03, 1.8); }, (T.wings + 0.85) * 1000);
        c.later(() => {
            measure();
            FX.flash("#fff6d8", 420, 0.5);
            FX.ring({ x: bx, y: by, color: "#ffd06b", r1: R * 1.6, width: 14, dur: 1.1 });
            FX.ring({ x: bx, y: by, color: "#c49bff", r1: R * 1.15, width: 6, dur: 0.9 });
            FX.burst({ x: bx, y: by, n: 60, colors: GOLD, shape: "star", speed: [140, 460], gravity: 60, life: [1, 1.8], size: [3, 7], glow: true });
            Sound.play("right");
        }, (T.down + 0.55) * 1000);
        await c.wait(T.end * 1000 + 200);
    }

    // ---------------------------------------------------------------------------------------------
    // Title card: a stained-glass rose window turns in, the title in its heart; it cracks with light as it goes
    // ---------------------------------------------------------------------------------------------
    const ROSE = (() => {
        let petals = "";
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * 360, col = ["#7a3cff", "#ffd06b", "#3fc8d6", "#d65fa8"][i % 4];
            petals += `<g transform="rotate(${a} 100 100)"><path d="M100 100 L92 30 Q100 18 108 30 Z" fill="${col}" opacity=".85" stroke="#2a1d3f" stroke-width="2"/><circle cx="100" cy="40" r="5" fill="#fff6d8" stroke="#2a1d3f" stroke-width="1.5"/></g>`;
        }
        return `<svg viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="96" fill="#1a0a3a" stroke="#e8c66a" stroke-width="6"/>${petals}<circle cx="100" cy="100" r="96" fill="none" stroke="#2a1d3f" stroke-width="2"/><circle cx="100" cy="100" r="58" fill="none" stroke="#e8c66a" stroke-width="3"/></svg>`;
    })();
    async function titleCard(c, info) {
        const card = U.el("div", { class: "tc tc-rift", "aria-hidden": "true", html: `
            <div class="tcr-window"><div class="tcr-rose">${ROSE}</div><div class="tcr-text"><small>${U.esc(info.kicker)}</small><h2>${U.esc(info.title)}</h2><p>${U.esc(info.sub)}</p></div></div>` });
        document.getElementById("overlay").appendChild(card);
        c.cleanup(() => card.remove());
        Sound.play("title");
        await c.wait(2100);
        if (c.skipped) return;
        card.classList.add("out");
        const p = U.center(card.querySelector(".tcr-window"));
        FX.burst({ x: p.x, y: p.y, n: 30, colors: ["#7a3cff", "#ffd06b", "#3fc8d6", "#d65fa8"], shape: "rect", speed: [150, 420], gravity: 500, life: [0.6, 1.1], size: [5, 10], spin: 6 });
        Sound.play("pop");
        await c.wait(520);
    }

    // ---------------------------------------------------------------------------------------------
    // The mascot: Vigil, a little star who was the light that kept the angel's prison shut (it still carries the key)
    // ---------------------------------------------------------------------------------------------
    function drawVigil(g, s) {
        const happy = s.mood === "happy", wow = s.mood === "wow", sad = s.mood === "sad";
        const bob = Math.sin(s.t * 2) * 5 - s.hop * 12, spin = Math.sin(s.t * 0.8) * 0.08 + (happy ? Math.sin(s.t * 9) * 0.06 : 0);
        g.save();
        g.translate(80, 86 + bob);
        // its glow, pulsing
        const glow = g.createRadialGradient(0, 0, 8, 0, 0, 74);
        glow.addColorStop(0, `rgba(255,236,170,${0.55 + Math.sin(s.t * 3) * 0.1})`); glow.addColorStop(1, "rgba(255,220,140,0)");
        g.fillStyle = glow; g.beginPath(); g.arc(0, 0, 74, 0, TAU); g.fill();
        // the key on its ring, dangling from the lower point
        g.save(); g.translate(18, 34); g.rotate(Math.sin(s.t * 1.7) * 0.35);
        g.strokeStyle = "#c9902f"; g.lineWidth = 3; g.beginPath(); g.arc(0, 4, 6, 0, TAU); g.stroke();
        g.fillStyle = "#e8b84a"; g.strokeStyle = "#8a5a1a"; g.lineWidth = 1.5;
        g.beginPath(); g.arc(0, 18, 6, 0, TAU); g.fill(); g.stroke();
        g.fillRect(-2, 22, 4, 16); g.strokeRect(-2, 22, 4, 16); g.fillRect(2, 32, 5, 3); g.fillRect(2, 27, 4, 3);
        g.fillStyle = "#3a2a10"; g.beginPath(); g.arc(0, 18, 2, 0, TAU); g.fill();
        g.restore();
        // the star: four rounded points and four little ones between, soft gold
        g.rotate(spin);
        const body = new Path2D();
        for (let i = 0; i < 16; i++) {
            const a = -Math.PI / 2 + (i * Math.PI) / 8, r = i % 4 === 0 ? 50 : i % 2 === 0 ? 30 : 24;
            const x = Math.cos(a) * r, y = Math.sin(a) * r;
            if (i === 0) body.moveTo(x, y); else body.lineTo(x, y);
        }
        body.closePath();
        const bg = g.createRadialGradient(-10, -12, 4, 0, 0, 52);
        bg.addColorStop(0, "#fffbe8"); bg.addColorStop(0.55, "#ffe7a3"); bg.addColorStop(1, "#f2b84b");
        g.lineJoin = "round"; g.lineWidth = 7; g.strokeStyle = "#ffe7a3"; g.stroke(body);
        g.fillStyle = bg; g.fill(body);
        g.lineWidth = 2.5; g.strokeStyle = "#c9902f"; g.stroke(body);
        g.rotate(-spin);
        // cheeks
        g.fillStyle = "rgba(255,140,120,.35)"; g.beginPath(); g.ellipse(-17, 8, 6, 4, 0, 0, TAU); g.ellipse(17, 8, 6, 4, 0, 0, TAU); g.fill();
        // eyes
        const ex = s.look * 3;
        for (const side of [-1, 1]) {
            const x = side * 11 + ex, y = -3;
            g.fillStyle = "#2a1d3f";
            if (s.blink > 0.5) { g.fillRect(x - 5, y, 10, 2.4); continue; }
            if (happy) { g.lineWidth = 2.6; g.strokeStyle = "#2a1d3f"; g.beginPath(); g.arc(x, y + 3, 5, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); continue; }
            g.beginPath(); g.ellipse(x, y, wow ? 5.5 : 4.5, wow ? 7 : sad ? 4.5 : 6, 0, 0, TAU); g.fill();
            g.fillStyle = "#ffffff"; g.beginPath(); g.arc(x + 1.6, y - 2.2, 1.8, 0, TAU); g.fill();
            if (sad) { g.strokeStyle = "#2a1d3f"; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 5, y - 9 - side * 2); g.lineTo(x + 5, y - 9 + side * 2); g.stroke(); }
        }
        // mouth
        const open = Math.max(s.talk, wow ? 0.8 : 0);
        g.strokeStyle = "#2a1d3f"; g.lineWidth = 2.4; g.lineCap = "round";
        if (open > 0.15) { g.fillStyle = "#8a3a4a"; g.beginPath(); g.ellipse(0, 12, 4.5, 2 + open * 4, 0, 0, TAU); g.fill(); }
        else { g.beginPath(); if (sad) g.arc(0, 17, 5, Math.PI * 1.2, Math.PI * 1.8); else g.arc(0, 9, 5, Math.PI * 0.15, Math.PI * 0.85); g.stroke(); }
        // two sparkles circling it
        for (let i = 0; i < 2; i++) {
            const a = s.t * 1.6 + i * Math.PI, x = Math.cos(a) * 62, y = Math.sin(a) * 22 - 6;
            Worlds.glint(g, x, y, 7 + Math.sin(s.t * 6 + i) * 2, 0.9, "#fff6d8");
        }
        g.restore();
    }

    // ---------------------------------------------------------------------------------------------
    // Sounds: glass bells, harp runs and a soft choir
    // ---------------------------------------------------------------------------------------------
    const bell = (t, n, v = 0.04, d = 0.9) => tone({ t, f: midi(n), type: "sine", d, v, echo: 0.4 });
    const harp = (t, n, v = 0.05) => tone({ t, f: midi(n), type: "triangle", d: 0.5, v, echo: 0.3 });
    const choir = (t, notes, v = 0.03, d = 1.4) => notes.forEach(n => tone({ t, f: midi(n), type: "sine", d, v, vib: 5, a: 0.25 }));
    const sounds = {
        type: () => tone({ f: U.pick([1568, 1760, 1976]), type: "sine", d: 0.07, v: 0.04, echo: 0.2 }),
        erase: () => tone({ f: 880, f2: 620, type: "sine", d: 0.08, v: 0.045 }),
        move: () => {},
        word: () => [0, 4, 7, 11, 14].forEach((k, i) => harp(i * 0.06, 72 + k, 0.05)),
        wrong: () => choir(0, [55, 56], 0.035, 0.7),
        right: () => { choir(0, [60, 64, 67, 72], 0.025, 1.6); [84, 88, 91, 96].forEach((n, i) => bell(0.2 + i * 0.09, n, 0.03)); },
        reveal: () => { noise({ type: "bandpass", f: 2600, f2: 5000, d: 0.6, v: 0.05, q: 0.6 }); bell(0.15, 91, 0.04); },
        flip: () => bell(0, 93, 0.022, 0.5),
        pop: () => tone({ f: 700, f2: 1400, type: "sine", d: 0.08, v: 0.06 }),
        sparkle: () => [96, 100, 103].forEach((n, i) => bell(i * 0.07, n, 0.025)),
        win: () => {},
        streak: () => [72, 79, 84, 91].forEach((n, i) => harp(i * 0.08, n, 0.05)),
        achievement: () => { choir(0, [67, 71, 74], 0.025, 1.2); [86, 91, 95].forEach((n, i) => bell(0.1 + i * 0.08, n, 0.035)); },
        title: () => { choir(0, [57, 64, 69, 72], 0.03, 1.8); noise({ type: "bandpass", f: 900, f2: 2400, d: 1.2, v: 0.05, q: 0.4 }); bell(0.6, 88, 0.035, 1.2); },
        tile: i => bell(0, 79 + (i % 8) * 2, 0.03, 0.4),
        start: () => { choir(0, [60, 67, 72], 0.03, 1.2); [79, 84, 88, 91].forEach((n, i) => harp(0.3 + i * 0.07, n, 0.045)); },
        select: () => bell(0, 91, 0.022, 0.4),
        nav: () => { noise({ type: "bandpass", f: 1200, f2: 2600, d: 0.3, v: 0.04, q: 0.6 }); harp(0.05, 84, 0.03); },
        mascot: () => { tone({ f: 1800, f2: 2200, type: "sine", d: 0.07, v: 0.04 }); tone({ t: 0.08, f: 2100, f2: 2600, type: "sine", d: 0.07, v: 0.035 }); }
    };

    Worlds.register({
        id: "rift", name: "Celestial Rift", icon: "🌠", tagline: "Where the Angel Waits.",
        modes: ["dark", "light"], secret: true,
        scene, board, celebrate, titleCard, sounds, transition: "rift",
        mascot: { name: "VIGIL", draw: drawVigil },
        lines: {
            hello: ["Vigil here. I'm a star. A small one. I used to keep watch.", "Hello! Mind the feathers, some of them are cursed.", "You came through the tear! Brave."],
            start: ["Tap a square and start typing. Space flips Across and Down.", "Every word you write is a little light. Let's make some."],
            word: ["Shining!", "That one glows!", "Starlight!", "Bright idea!", "Heavenly!", "A whole constellation!"],
            win: ["The rift closed a little! You did it!", "Every star just got brighter.", "That's how you mend a sky."],
            wrong: ["A few of those letters are flickering.", "Some of those don't shine right yet."],
            right: ["All of it shines true!", "Not a single dark letter!"],
            idle: ["Stuck? The crossing words light the way.", "Even stars need a minute. Try the shortest clue."],
            reveal: ["A little light, just for you.", "Here, borrow a sparkle."]
        },
        introFlourish(stage) {
            const p = U.center(stage);
            FX.ring({ x: p.x, y: p.y, color: "#ffd06b", r1: Math.max(innerWidth, innerHeight) * 0.6, dur: 1.2, width: 14, glow: true });
            FX.burst({ x: p.x, y: p.y, n: 60, colors: ["#ffffff", "#2a1d3f", "#ffe7a3"], shape: "petal", speed: [200, 650], gravity: 150, drag: 1, life: [1.4, 2.2], size: [6, 10], spin: 4 });
        }
    });
})();
