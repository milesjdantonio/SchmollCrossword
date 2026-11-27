// Volcano Island's background (volcano.js uses it, and makes it erupt for the win).
//   Day: a stratovolcano across a lagoon: ash-grey summit with a ragged crater, gullies lit on the sun's side,
//   old basalt flows, scrub and then jungle up its lower slopes, jungle foothills and a white beach at its foot,
//   its reflection broken by waves; hazy islets on the horizon, a sail far out; shaded clouds and a warm sun;
//   a lagoon of turquoise shallows over sand and coral; a beach with grain, ripples, footprints, driftwood, a
//   tide-pool rock, shells and a crab; tiki torches; palms swaying, monstera, ferns and hibiscus in the corners;
//   gulls, an outrigger canoe, a dolphin now and then.
//   Night: a violet sky with stars and a crescent moon, lava rivers glowing down the gullies with a crust,
//   the smoke lit red from below, lava bombs arcing out, the glow running across the water, the torches lit.
//   The eruption (link.eruption(): seconds since it began, or -1): thick ash, the crater flaring, a lava
//   fountain, the rivers pouring down the slope (by day as well), the sky going orange.
//   VolcanoScene(W, H, opts, link): link = { crater: {x, y} (set here: the crater on screen), eruption(), done() }
function VolcanoScene(W, H, opts, link) {
    const night = opts.theme === "dark", preview = !!opts.preview, TAU = Math.PI * 2, M = 40;
    const P = night
        ? { sky: ["#0c0618", "#22102e", "#4a163a", "#8a2a34"], sun: "#ffd8c8", haze: "rgba(150,60,90,", sea: ["#5a2a44", "#2a1230", "#1a0c22", "#1e1430", "#24203a"],
            rock: ["#3a2c34", "#2a1e26", "#4a3640"], ash: "#4a3a42", basalt: "#1a1218", jungle: ["#0a1a14", "#11261c", "#1a3426"], scrub: "#16261c",
            sand: ["#4a3a40", "#3a2c32", "#2e2228"], wet: "#2a2030", foam: "rgba(200,150,180,", palm: ["#0e1a14", "#16261c", "#1e3024"], trunk: ["#2a1e1e", "#1a1214"], rim: "rgba(255,110,60," }
        : { sky: ["#1f6fc4", "#4b9be0", "#94ccef", "#e6f4f4"], sun: "#fffbe8", haze: "rgba(235,246,250,", sea: ["#a6d8e4", "#3aa0c4", "#1a7fb0", "#1f9ec0", "#3fc6c8"],
            rock: ["#8a7c72", "#5e5048", "#a89a8c"], ash: "#9a8e86", basalt: "#4a4044", jungle: ["#2a6a2e", "#3f8a38", "#68b04a"], scrub: "#6a8a4a",
            sand: ["#f6e4b8", "#ecd09a", "#d9b87a"], wet: "#cbb084", foam: "rgba(255,255,255,", palm: ["#2f7a30", "#4a9a3a", "#76bc50"], trunk: ["#a07a52", "#6a4a2e"], rim: "rgba(255,240,200," };
    const s0 = () => (preview ? 0.45 : U.clamp(Math.min(W, H) / 900, 0.6, 1.15));
    // blends two "#rrggbb" colours; remembered, because the leaves and specks ask for the same few blends thousands of times
    const mixed = new Map(), rgbOf = new Map();
    const rgb = c => { let v = rgbOf.get(c); if (!v) rgbOf.set(c, v = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))); return v; };
    const mix = (a, b, t) => {
        const q = Math.round(t * 64), key = a + b + q;
        let v = mixed.get(key);
        if (!v) { const pa = rgb(a), pb = rgb(b); mixed.set(key, v = "#" + pa.map((x, i) => Math.round(x + (pb[i] - x) * q / 64).toString(16).padStart(2, "0")).join("")); }
        return v;
    };
    function paint(w, h, fn) { const c = Worlds.canvas(w, h), g = c.getContext("2d"); fn(g); return c; }
    // Thousands of specks and strokes grouped by colour (and line width) into one path each, then filled or stroked
    // once per group: setting a colour per speck was most of the time it took to build the scene.
    function batch() {
        const fills = new Map(), strokes = new Map();
        const at = (m, key) => { let p = m.get(key); if (!p) m.set(key, p = new Path2D()); return p; };
        return {
            rect(col, x, y, w, h) { at(fills, col).rect(x, y, w, h); },
            curve(col, lw, x, y, cx, cy, ex, ey) { const p = at(strokes, col + "|" + lw.toFixed(1)); p.moveTo(x, y); p.quadraticCurveTo(cx, cy, ex, ey); },
            flush(g) {
                for (const [col, p] of fills) { g.fillStyle = col; g.fill(p); }
                for (const [key, p] of strokes) { const i = key.lastIndexOf("|"); g.strokeStyle = key.slice(0, i); g.lineWidth = +key.slice(i + 1); g.stroke(p); }
                fills.clear(); strokes.clear();
            },
        };
    }

    let HZ, V, skyImg, islandImg, lavaImg, frontImg, palms = [], clouds = [], puffs = {}, stars = [], foam = [];
    let smoke = [], fountain = [], embers = [], bombs = [], gulls = [], crab = null, dolphin = null, canoe = null, sail = null;
    let nextGull = preview ? 1e9 : 4, nextDolphin = preview ? 1e9 : 9, nextBomb = 3;

    // ---- the shape of things ----
    const shoreY = x => H * 0.79 - Math.sin(x * 0.0032 + 0.6) * H * 0.025 - Math.sin(x * 0.011) * H * 0.006;
    function profile(u) {                                         // the cone's top edge at u (-1..1 across its base)
        const a = Math.abs(u), cr = V.cr / V.half;
        if (a < cr) return V.top + Math.sin((a / cr) * Math.PI) * 3 * V.s + (u > 0 ? 4 * V.s * (a / cr) : 0);
        const t = (a - cr) / (1 - cr);
        const rough = (Math.sin(u * 37) * 0.5 + Math.sin(u * 91 + 1) * 0.3) * 4 * V.s * (1 - t);
        return V.top + (u > 0 ? 6 * V.s : 0) + (V.base - V.top) * (1 - Math.pow(1 - t, 2.25)) + rough;
    }
    function canopy(g, x, y, r, cols, R, lit = true) {          // a crown of leaves: dark under, dabs of mid green, lit tips
        g.fillStyle = mix(cols[0], "#000000", 0.25);
        g.beginPath(); g.ellipse(x, y + r * 0.25, r, r * 0.7, 0, 0, TAU); g.fill();
        for (let i = 0; i < 9; i++) {
            const a = R() * TAU, d = R() * r * 0.7, lx = x + Math.cos(a) * d, ly = y + Math.sin(a) * d * 0.6 - r * 0.1;
            g.fillStyle = R() < 0.5 ? cols[0] : cols[1]; g.beginPath(); g.ellipse(lx, ly, r * (0.28 + R() * 0.2), r * (0.16 + R() * 0.1), R() * Math.PI, 0, TAU); g.fill();
        }
        if (lit) for (let i = 0; i < 5; i++) {
            const a = -2.6 + R() * 1.6, d = r * (0.3 + R() * 0.45);
            g.fillStyle = cols[2]; g.globalAlpha = night ? 0.35 : 0.75;
            g.beginPath(); g.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6 - r * 0.1, r * 0.2, r * 0.1, R() * Math.PI, 0, TAU); g.fill();
            g.globalAlpha = 1;
        }
    }
    // The jungle has thousands of crowns: a few are painted once per palette and stamped at each one's size
    const stamps = new Map(), RR = 32;
    function crown(g, x, y, r, cols, R, lit) {
        const key = cols.join() + lit + Math.floor(R() * 6);
        let c = stamps.get(key);
        if (!c) c = stamps.set(key, paint(RR * 2.4, RR * 2, sg => canopy(sg, RR * 1.2, RR * 0.8, RR, cols, R, lit))).get(key);
        const k = r / RR;
        g.drawImage(c, x - RR * 1.2 * k, y - RR * 0.8 * k, c.width * k, c.height * k);
    }
    function palmCrown(g, x, y, r, R, cols) {                      // a little palm on the far island
        g.strokeStyle = cols[0]; g.lineWidth = Math.max(1, r * 0.12); g.lineCap = "round";
        g.beginPath(); g.moveTo(x, y + r * 2.2); g.quadraticCurveTo(x + r * 0.3, y + r, x, y); g.stroke();
        for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * 0.55, l = r * (0.9 + R() * 0.3); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.6, y + Math.sin(a) * l * 0.6 - r * 0.2, x + Math.cos(a) * l, y + Math.sin(a) * l + l * 0.5); g.stroke(); }
    }

    function setup() {
        const R = U.rng(1883), s = s0(), LW = W + M * 2;
        HZ = H * 0.53;
        const half = Math.min(W * 0.36, H * 0.62);
        V = { x: W * 0.6 + M, top: H * 0.16, base: HZ + H * 0.02, half, cr: half * 0.085, s };

        // ---- the sky: gradient, sun or moon, high streaks, stars, the haze at the horizon ----
        skyImg = paint(W, H, g => {
            const sg = g.createLinearGradient(0, 0, 0, HZ);
            P.sky.forEach((c, i) => sg.addColorStop(i / (P.sky.length - 1), c));
            g.fillStyle = sg; g.fillRect(0, 0, W, H);
            if (night) {
                const eg = g.createRadialGradient(W * 0.6, HZ, 0, W * 0.6, HZ, W * 0.55);   // the volcano lights the sky
                eg.addColorStop(0, "rgba(255,90,50,.35)"); eg.addColorStop(0.5, "rgba(200,50,70,.12)"); eg.addColorStop(1, "rgba(120,30,80,0)");
                g.fillStyle = eg; g.fillRect(0, 0, W, HZ);
                for (let i = 0; i < (preview ? 120 : 520); i++) {
                    const y = Math.pow(R(), 1.4) * HZ * 0.9, a = 0.25 + R() * 0.6 * (1 - y / HZ), big = R() < 0.1;
                    g.fillStyle = `rgba(255,${235 + R() * 20 | 0},${215 + R() * 40 | 0},${a.toFixed(2)})`; g.fillRect(R() * W, y, big ? 1.6 : 1, big ? 1.6 : 1);
                }
                const mx = W * 0.16, my = H * 0.13, mr = Math.min(W, H) * 0.035;            // a crescent moon
                Worlds.glow(g, mx, my, mr * 6, "#c8a8ff", 0.35);
                const moon = paint(mr * 2 + 4, mr * 2 + 4, m => {
                    m.fillStyle = "#fff2e2"; m.beginPath(); m.arc(mr + 2, mr + 2, mr, 0, TAU); m.fill();
                    m.globalCompositeOperation = "destination-out"; m.beginPath(); m.arc(mr + 2 + mr * 0.45, mr + 2 - mr * 0.2, mr * 0.92, 0, TAU); m.fill();
                });
                g.drawImage(moon, mx - mr - 2, my - mr - 2);
            } else {
                const sx = W * 0.17, sy = H * 0.12, sr = Math.min(W, H) * 0.042;
                for (const [rr, a] of [[sr * 14, 0.22], [sr * 6, 0.35], [sr * 2.4, 0.6]]) {
                    const gg = g.createRadialGradient(sx, sy, 0, sx, sy, rr);
                    gg.addColorStop(0, `rgba(255,248,224,${a})`); gg.addColorStop(1, "rgba(255,248,224,0)");
                    g.fillStyle = gg; g.fillRect(sx - rr, sy - rr, rr * 2, rr * 2);
                }
                g.fillStyle = P.sun; g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.fill();
                g.strokeStyle = "rgba(255,255,255,.14)"; g.lineCap = "round";                 // cirrus streaks
                for (let i = 0; i < 14; i++) {
                    const x = R() * W, y = H * (0.05 + R() * 0.2), l = 80 + R() * 220;
                    g.lineWidth = 2 + R() * 5;
                    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l * 0.5, y - 8 - R() * 10, x + l, y + R() * 6); g.stroke();
                }
            }
            const hg = g.createLinearGradient(0, HZ - H * 0.14, 0, HZ);                      // haze down at the horizon
            hg.addColorStop(0, P.haze + "0)"); hg.addColorStop(1, P.haze + (night ? ".35)" : ".7)"));
            g.fillStyle = hg; g.fillRect(0, HZ - H * 0.14, W, H * 0.14);
        });

        // ---- the volcano ----
        const cone = paint(LW, H, g => {
            const { x: vx, top, base, half: hw } = V;
            g.beginPath(); g.moveTo(vx - hw, base + 4); for (let i = 0; i <= 160; i++) { const u = -1 + (2 * i) / 160; g.lineTo(vx + u * hw, profile(u)); } g.lineTo(vx + hw, base + 4); g.closePath();
            const bg = g.createLinearGradient(0, top, 0, base);
            bg.addColorStop(0, P.ash); bg.addColorStop(0.35, P.rock[0]); bg.addColorStop(1, P.rock[1]);
            g.fillStyle = bg; g.fill();
            g.save(); g.clip();
            // the light: warm on the left flank, cool shade on the right
            const lg = g.createLinearGradient(vx - hw * 0.7, 0, vx + hw * 0.6, 0);
            lg.addColorStop(0, night ? "rgba(255,120,70,.06)" : "rgba(255,236,200,.32)"); lg.addColorStop(0.45, "rgba(0,0,0,0)"); lg.addColorStop(1, night ? "rgba(10,0,20,.45)" : "rgba(30,20,50,.32)");
            g.fillStyle = lg; g.fillRect(vx - hw, top - 10, hw * 2, base - top + 20);
            // scree and ash: specks, thicker near the top
            const scree = batch();
            for (let i = 0; i < (preview ? 1500 : 7000); i++) {
                const u = R() * 2 - 1, yb = profile(u), y = yb + Math.pow(R(), 1.6) * (base - yb);
                const col = R() < 0.5 ? `rgba(0,0,0,${(0.08 + R() * 0.12).toFixed(2)})` : (night ? `rgba(255,150,120,${(0.03 + R() * 0.04).toFixed(2)})` : `rgba(255,250,240,${(0.06 + R() * 0.12).toFixed(2)})`);
                scree.rect(col, vx + u * hw, y, 1 + R() * 1.4, 1 + R());
            }
            scree.flush(g);
            // old basalt flows: dark tongues from the rim, ragged, widening, ending in lobes
            for (const u0 of [-0.55, 0.3, 0.7]) {
                const pts = [], n = 22;
                let x = vx + u0 * V.cr, y = profile(u0 * V.cr / hw) + 2;
                for (let i = 0; i < n; i++) { const t = i / n; pts.push([x, y, (2 + t * 18) * s]); x += (u0 * hw * 0.035) + (R() - 0.5) * 7 * s; y += (base - top) * 0.6 / n; }
                g.fillStyle = P.basalt; g.globalAlpha = 0.55;
                g.beginPath(); pts.forEach(([x, y, w], i) => g[i ? "lineTo" : "moveTo"](x - w * (0.7 + R() * 0.4), y));
                for (let i = n - 1; i >= 0; i--) { const [x, y, w] = pts[i]; g.lineTo(x + w * (0.7 + R() * 0.4), y); }
                g.closePath(); g.fill();
                const [ex, ey, ew] = pts[n - 1];
                for (let l = 0; l < 4; l++) { g.beginPath(); g.ellipse(ex + (R() - 0.5) * ew * 2, ey + R() * 10, ew * (0.5 + R() * 0.4), ew * 0.3, 0, 0, TAU); g.fill(); }
                g.globalAlpha = 1;
            }
            // gullies running from the rim to the base: a dark channel that widens, its sunny edge caught in light
            for (let i = 0; i < (preview ? 30 : 84); i++) {
                const u = R() * 2 - 1, x0 = vx + u * V.cr * 1.4, y0 = profile(u * V.cr * 1.4 / hw) + 3;
                const x1 = vx + u * hw * (0.85 + R() * 0.3), y1 = base + 4, bend = (R() - 0.5) * 40 * s, len = 0.45 + R() * 0.55;
                let px = x0, py = y0;
                for (let k = 1; k <= 14; k++) {
                    const t = (k / 14) * len, x = x0 + (x1 - x0) * t + Math.sin(t * Math.PI) * bend, y = y0 + (y1 - y0) * Math.pow(t, 0.9);
                    const w = (0.6 + t * 3.2) * s * (0.6 + R() * 0.5);
                    g.strokeStyle = `rgba(0,0,0,${(0.22 * (1 - t * 0.4)).toFixed(3)})`; g.lineWidth = w;
                    g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke();
                    g.strokeStyle = u < 0.2 ? (night ? "rgba(255,130,90,.06)" : "rgba(255,246,226,.22)") : "rgba(255,240,220,.06)"; g.lineWidth = w * 0.5;
                    g.beginPath(); g.moveTo(px - w * 0.9, py); g.lineTo(x - w * 0.9, y); g.stroke();
                    px = x; py = y;
                }
            }
            // scrub creeping up the gullies, then jungle wrapping the lower slopes (the higher, the thinner)
            for (let i = 0; i < (preview ? 500 : 2600); i++) {
                const u = R() * 2 - 1, yb = profile(u), t = 0.32 + Math.pow(R(), 0.7) * 0.68, y = yb + (base - yb) * t;
                const dens = (t - 0.32) / 0.68;
                if (R() > dens * 1.4) continue;
                const r = (1.4 + R() * 2.6 + dens * 4) * s;
                if (dens < 0.55) { g.fillStyle = night ? P.scrub : mix(P.scrub, P.jungle[0], R() * 0.5); g.beginPath(); g.ellipse(vx + u * hw, y, r, r * 0.6, 0, 0, TAU); g.fill(); }
                else crown(g, vx + u * hw, y, r * 1.3, P.jungle, R, u < 0.3);
            }
            // mist at the foot
            const mg = g.createLinearGradient(0, top + (base - top) * 0.55, 0, base);
            mg.addColorStop(0, P.haze + "0)"); mg.addColorStop(1, P.haze + (night ? ".18)" : ".42)"));
            g.fillStyle = mg; g.fillRect(vx - hw, top, hw * 2, base - top + 10);
            g.restore();
            // the crater's lip: the dark throat behind a ragged rim with a lit edge
            g.fillStyle = night ? "#120a10" : "#3a302c";
            g.beginPath(); g.ellipse(vx + 2 * s, top + 3 * s, V.cr * 0.92, 4.5 * s, 0, Math.PI, TAU); g.fill();
            g.strokeStyle = night ? "rgba(255,120,80,.5)" : "rgba(255,248,230,.55)"; g.lineWidth = 1.4 * s;
            g.beginPath(); for (let i = 0; i <= 30; i++) { const ux = (-1 + (2 * i) / 30) * V.cr / hw; g[i ? "lineTo" : "moveTo"](vx + ux * hw, profile(ux) + 0.5); } g.stroke();
        });

        // ---- the island: the sea, islets, the volcano's reflection, the volcano, its foothills and beach ----
        islandImg = paint(LW, H, g => {
            const sg = g.createLinearGradient(0, HZ, 0, H);
            sg.addColorStop(0, P.sea[0]); sg.addColorStop(0.08, P.sea[1]); sg.addColorStop(0.45, P.sea[2]); sg.addColorStop(0.8, P.sea[3]); sg.addColorStop(1, P.sea[4]);
            g.fillStyle = sg; g.fillRect(0, HZ, LW, H - HZ);
            for (const [x, w, h] of [[0.05, 170, 26], [0.17, 90, 13], [0.97, 130, 20]]) {
                const ix = x * LW, iw = w * s, ih = h * s;
                g.fillStyle = night ? "#3a1a34" : "#7eaec4";
                g.beginPath(); g.moveTo(ix - iw, HZ + 1); for (let i = 0; i <= 20; i++) { const u = i / 20; g.lineTo(ix - iw + u * iw * 2, HZ - Math.sin(u * Math.PI) ** 0.7 * ih * (0.85 + Math.sin(u * 17) * 0.08)); } g.closePath(); g.fill();
                g.fillStyle = night ? "rgba(255,120,120,.06)" : "rgba(255,255,255,.18)"; g.fillRect(ix - iw, HZ, iw * 2, 1.2);
            }
            g.save();                                                                       // the reflection, darker and broken
            g.beginPath(); g.rect(0, V.base + H * 0.035, LW, H); g.clip();
            g.globalAlpha = night ? 0.25 : 0.2;
            g.translate(0, (V.base + H * 0.035) * 2); g.scale(1, -1); g.drawImage(cone, 0, 0);
            g.restore();
            // waves: short strokes, longer and further apart toward the front; whitecaps and troughs
            const waves = batch();
            for (let i = 0; i < (preview ? 500 : 2400); i++) {
                const d = Math.pow(R(), 1.7), y = HZ + 3 + d * (H * 0.82 - HZ), l = (2 + d * 30) * (0.5 + R()), x = R() * LW;
                const col = R() < 0.55 ? (night ? `rgba(0,0,0,${(0.15 + d * 0.1).toFixed(2)})` : `rgba(10,60,110,${(0.1 + d * 0.08).toFixed(2)})`) : (night ? `rgba(255,150,150,${(0.05 + d * 0.05).toFixed(2)})` : `rgba(255,255,255,${(0.12 + d * 0.2).toFixed(2)})`);
                waves.curve(col, 0.6 + d * 1.6, x, y, x + l / 2, y - (0.5 + d * 2), x + l, y);
            }
            waves.flush(g);
            g.drawImage(cone, 0, 0);
            // the foothills: three jungle ridges, hazier further back, a few palms standing up
            const { x: vx, half: hw } = V, fb = HZ + H * 0.045;
            const hill = (x, row) => fb - H * (0.055 - row * 0.018) - Math.sin(x * 0.009 + row * 2) * H * 0.012 - Math.max(0, 1 - Math.abs(x - vx) / (hw * 1.3)) * H * 0.03;
            const x0 = vx - hw * 1.32, x1 = vx + hw * 1.28;
            for (let row = 0; row < 3; row++) {
                const fade = [0.35, 0.15, 0][row], cols = P.jungle.map(c => mix(c, night ? "#2a1a30" : "#9ac0c8", fade));
                g.fillStyle = cols[0];
                g.beginPath(); g.moveTo(x0, fb); for (let x = x0; x <= x1; x += 6) g.lineTo(x, hill(x, row) + 6); g.lineTo(x1, fb); g.closePath(); g.fill();
                for (let x = x0; x < x1; x += (5 + R() * 6) * s) {
                    const edge = Math.min(x - x0, x1 - x) / 60; if (edge < 1 && R() > edge) continue;
                    const y = hill(x, row) + R() * (fb - hill(x, row)) * 0.6, r = (5 + R() * 5 + row * 2) * s;
                    crown(g, x, y, r, cols, R, x < vx + hw * 0.2);
                }
                for (let n = 0; n < 4 + row * 2; n++) { const x = x0 + R() * (x1 - x0); palmCrown(g, x, hill(x, row) - (6 + R() * 8) * s, (5 + row * 1.5) * s, R, cols); }
            }
            g.fillStyle = night ? "#3a2c30" : "#f2e2bc";                                    // its beach and the surf
            g.beginPath(); g.moveTo(x0 - 10, fb + 2); for (let x = x0 - 10; x <= x1 + 10; x += 8) g.lineTo(x, fb - 2 - Math.sin(x * 0.03) * 1.2); g.lineTo(x1 + 10, fb + 4); g.lineTo(x0 - 10, fb + 4); g.fill();
            g.strokeStyle = night ? "rgba(255,190,200,.35)" : "rgba(255,255,255,.85)"; g.lineWidth = 1.5;
            for (let r = 0; r < 2; r++) { g.globalAlpha = r ? 0.4 : 1; g.beginPath(); for (let x = x0 - 20; x <= x1 + 20; x += 5) g[x === x0 - 20 ? "moveTo" : "lineTo"](x, fb + 4 + r * 3 + Math.sin(x * 0.07 + r) * 0.8); g.stroke(); }
            g.globalAlpha = 1;
        });

        // ---- the lava rivers (lit at night, poured out by the eruption): down the gullies into the jungle ----
        lavaImg = paint(LW, H, g => {
            const { x: vx, top, base, half: hw } = V;
            V.rivers = [];
            for (const [u0, drift, reach] of [[-0.5, -0.38, 0.86], [0.08, 0.06, 0.78], [0.55, 0.5, 0.92]]) {
                const pts = [], y0 = profile(u0 * V.cr / hw) + 2;
                for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push([vx + u0 * V.cr + drift * hw * Math.pow(t, 1.15) + Math.sin(t * 9 + u0 * 5) * 6 * s * t + (R() - 0.5) * 2 * t, y0 + (base - top) * reach * t]); }
                V.rivers.push(pts);
                const stroke = (w, c, a) => { g.globalAlpha = a; g.strokeStyle = c; g.lineWidth = w; g.beginPath(); pts.forEach(([px, py], i) => g[i ? "lineTo" : "moveTo"](px, py)); g.stroke(); };
                g.lineCap = "round"; g.lineJoin = "round";
                g.save(); g.shadowColor = "#ff4a10"; g.shadowBlur = 26 * s; stroke(14 * s, "#ff3a10", 0.35); g.restore();
                stroke(10 * s, "#4a1208", 0.95);                                       // the crust either side
                stroke(7 * s, "#e8401a", 1);
                stroke(4 * s, "#ff8a2a", 1);
                g.setLineDash([3 * s, 5 * s, 9 * s, 4 * s]); stroke(1.4 * s, "#fff0a0", 0.9); g.setLineDash([]);
                g.globalAlpha = 0.8; g.fillStyle = "#3a0e06";                         // dark crust plates floating on it
                for (let i = 6; i < pts.length; i += 5) { g.beginPath(); g.ellipse(pts[i][0] + (R() - 0.5) * 3, pts[i][1], 2 * s, 1.2 * s, R() * 3, 0, TAU); g.fill(); }
                const [ex, ey] = pts[pts.length - 1];                                 // where it spreads into a glowing pool
                g.globalAlpha = 1; g.save(); g.shadowColor = "#ff5a10"; g.shadowBlur = 20 * s;
                g.fillStyle = "#ff6a1a"; g.beginPath(); g.ellipse(ex, ey, 14 * s, 4 * s, 0, 0, TAU); g.fill(); g.restore();
                g.fillStyle = "#ffd070"; g.beginPath(); g.ellipse(ex - 2 * s, ey - 0.5, 7 * s, 1.6 * s, 0, 0, TAU); g.fill();
            }
            g.globalAlpha = 1;
        });

        // ---- the front: shallows over sand and coral, the beach and its detail, the corner plants ----
        frontImg = paint(LW, H, g => {
            const sy = x => shoreY(x - M);
            const sh = g.createLinearGradient(0, H * 0.66, 0, H * 0.8);
            sh.addColorStop(0, night ? "rgba(60,40,70,0)" : "rgba(90,220,210,0)"); sh.addColorStop(1, night ? "rgba(70,50,80,.6)" : "rgba(120,230,214,.75)");
            g.fillStyle = sh; g.fillRect(0, H * 0.66, LW, H * 0.16);
            for (let i = 0; i < (preview ? 10 : 34); i++) {                                 // coral heads under the water
                const x = R() * LW, y = sy(x) - H * (0.012 + R() * 0.06), r = (6 + R() * 18) * s;
                const cg = g.createRadialGradient(x, y, 0, x, y, r);
                cg.addColorStop(0, night ? "rgba(40,20,40,.35)" : `rgba(${R() < 0.5 ? "40,110,120" : "150,90,110"},.28)`); cg.addColorStop(1, "rgba(0,0,0,0)");
                g.fillStyle = cg; g.beginPath(); g.ellipse(x, y, r, r * 0.35, 0, 0, TAU); g.fill();
            }
            // the sand: a dark wet band at the water, pale and dry above it, shade in the very front
            g.save();
            g.beginPath(); g.moveTo(0, sy(0)); for (let x = 0; x <= LW; x += 8) g.lineTo(x, sy(x)); g.lineTo(LW, sy(LW)); g.lineTo(LW, H); g.lineTo(0, H); g.closePath();
            const bg = g.createLinearGradient(0, H * 0.76, 0, H);
            bg.addColorStop(0, P.wet); bg.addColorStop(0.12, P.sand[1]); bg.addColorStop(0.45, P.sand[0]); bg.addColorStop(1, P.sand[2]);
            g.fillStyle = bg; g.fill(); g.clip();
            g.fillStyle = night ? "rgba(150,110,140,.12)" : "rgba(160,200,220,.25)";       // the sky in the wet sand
            g.beginPath(); for (let x = 0; x <= LW; x += 8) g.lineTo(x, sy(x)); for (let x = LW; x >= 0; x -= 8) g.lineTo(x, sy(x) + H * 0.018 + Math.sin(x * 0.02) * 2); g.fill();
            const grain = batch();
            for (let i = 0; i < (preview ? 4000 : 26000); i++) {                         // grain
                const x = R() * LW, y = H * 0.74 + R() * H * 0.26, v = R();
                const col = v < 0.5 ? `rgba(120,80,40,${(0.06 + R() * 0.1).toFixed(2)})` : v < 0.9 ? `rgba(255,255,240,${(night ? 0.03 : 0.12 + R() * 0.15).toFixed(2)})` : `rgba(60,40,30,${(0.15 + R() * 0.15).toFixed(2)})`;
                grain.rect(col, x, y, 1 + R() * 0.8, 1);
            }
            grain.flush(g);
            g.lineWidth = 1.2;                                                             // wind ripples
            for (let i = 0; i < (preview ? 40 : 200); i++) {
                const x = R() * LW, y = sy(x) + H * 0.05 + R() * H * 0.2, l = (14 + R() * 30) * s;
                g.strokeStyle = night ? "rgba(0,0,0,.16)" : "rgba(150,110,60,.18)"; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 3, x + l, y + 1); g.stroke();
                g.strokeStyle = night ? "rgba(255,200,200,.04)" : "rgba(255,255,245,.35)"; g.beginPath(); g.moveTo(x, y - 1.5); g.quadraticCurveTo(x + l / 2, y - 4.5, x + l, y - 0.5); g.stroke();
            }
            for (let i = 0; i < 9; i++) {                                                  // footprints down to the water
                const t = i / 9, x = LW * 0.83 - t * LW * 0.06 + (i % 2 ? 7 : -7) * s * (1 - t * 0.5), y = H * 0.99 - t * (H * 0.99 - sy(LW * 0.8) - H * 0.03), r = (5 - t * 2.5) * s;
                g.fillStyle = night ? "rgba(0,0,0,.25)" : "rgba(130,90,40,.28)"; g.beginPath(); g.ellipse(x, y, r * 0.55, r, -0.15, 0, TAU); g.fill();
                g.fillStyle = night ? "rgba(255,200,200,.04)" : "rgba(255,250,230,.4)"; g.beginPath(); g.ellipse(x - r * 0.15, y + r * 0.55, r * 0.4, r * 0.25, 0, 0, Math.PI); g.fill();
            }
            g.restore();
            {                                                                               // a rock with a tide pool
                const rx = LW * 0.15, ry = sy(LW * 0.15) + H * 0.035, rw = 90 * s, rh = 40 * s;
                g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(rx + 10 * s, ry + rh * 0.35, rw * 1.05, rh * 0.3, 0, 0, TAU); g.fill();
                const rg = g.createLinearGradient(rx - rw, ry - rh, rx + rw * 0.5, ry + rh);
                rg.addColorStop(0, night ? "#4a3a44" : "#8a8480"); rg.addColorStop(1, night ? "#1a1218" : "#3e3836");
                g.fillStyle = rg;
                g.beginPath(); g.moveTo(rx - rw, ry + rh * 0.3);
                for (let i = 0; i <= 12; i++) { const a = Math.PI + (i / 12) * Math.PI; g.lineTo(rx + Math.cos(a) * rw * (0.85 + R() * 0.2), ry + Math.sin(a) * rh * (0.8 + R() * 0.35)); }
                g.lineTo(rx + rw, ry + rh * 0.3); g.closePath(); g.fill();
                g.fillStyle = night ? "#2a2040" : "#4aa8b8"; g.beginPath(); g.ellipse(rx - rw * 0.15, ry - rh * 0.25, rw * 0.35, rh * 0.18, 0, 0, TAU); g.fill();
                g.fillStyle = "rgba(255,255,255,.35)"; g.beginPath(); g.ellipse(rx - rw * 0.25, ry - rh * 0.3, rw * 0.12, rh * 0.05, 0, 0, TAU); g.fill();
                for (let i = 0; i < 26; i++) { const a = Math.PI + R() * Math.PI, d = R() * 0.8; g.fillStyle = night ? "rgba(200,180,190,.2)" : "rgba(240,236,220,.7)"; g.beginPath(); g.arc(rx + Math.cos(a) * rw * d, ry + Math.sin(a) * rh * d * 0.8 + rh * 0.1, 1.4 * s, 0, TAU); g.fill(); }
                g.strokeStyle = night ? "#1a2a1a" : "#4a7a2a"; g.lineWidth = 2 * s; g.lineCap = "round";
                for (let i = 0; i < 6; i++) { const x = rx + rw * (0.3 + R() * 0.6), y = ry + rh * 0.25; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 8 * s, y + 6 * s, x + (4 + R() * 10) * s, y + (10 + R() * 6) * s); g.stroke(); }
            }
            {                                                                               // driftwood, bleached, with grain
                const dx = LW * 0.71, dy = H * 0.93, dl = 150 * s;
                g.save(); g.translate(dx, dy); g.rotate(-0.08);
                g.fillStyle = "rgba(0,0,0,.22)"; g.beginPath(); g.ellipse(6, 10 * s, dl * 0.55, 6 * s, 0, 0, TAU); g.fill();
                const wg = g.createLinearGradient(0, -9 * s, 0, 9 * s);
                wg.addColorStop(0, night ? "#5a4a4a" : "#e8dccb"); wg.addColorStop(1, night ? "#2a2024" : "#a08a70");
                g.fillStyle = wg; g.beginPath(); g.moveTo(-dl / 2, -6 * s); g.quadraticCurveTo(0, -11 * s, dl / 2, -5 * s); g.lineTo(dl / 2 + 6 * s, 0); g.lineTo(dl / 2, 6 * s); g.quadraticCurveTo(0, 10 * s, -dl / 2, 7 * s); g.closePath(); g.fill();
                g.beginPath(); g.moveTo(dl * 0.15, -7 * s); g.lineTo(dl * 0.28, -24 * s); g.lineTo(dl * 0.31, -22 * s); g.lineTo(dl * 0.22, -6 * s); g.fill();
                g.strokeStyle = night ? "rgba(0,0,0,.3)" : "rgba(110,90,70,.45)"; g.lineWidth = 0.8;
                for (let i = 0; i < 7; i++) { const yy = (-5 + i * 1.8) * s; g.beginPath(); g.moveTo(-dl / 2 + 4, yy); g.bezierCurveTo(-dl / 6, yy - 2, dl / 6, yy + 2, dl / 2 - 4, yy); g.stroke(); }
                g.fillStyle = night ? "#1a1214" : "#6a5440"; g.beginPath(); g.ellipse(-dl * 0.1, 0, 4 * s, 2.5 * s, 0, 0, TAU); g.fill();
                g.restore();
            }
            const shell = (x, y, r, kind) => {                                              // scallops, a conch, a starfish
                g.fillStyle = "rgba(0,0,0,.18)"; g.beginPath(); g.ellipse(x + 2, y + r * 0.5, r, r * 0.3, 0, 0, TAU); g.fill();
                if (kind === 0) {
                    const sg2 = g.createLinearGradient(x, y - r, x, y + r);
                    sg2.addColorStop(0, night ? "#8a6a7a" : "#ffe4d6"); sg2.addColorStop(1, night ? "#4a3040" : "#f0a888");
                    g.fillStyle = sg2; g.beginPath(); g.moveTo(x, y + r * 0.6); g.arc(x, y + r * 0.6, r, -Math.PI * 0.95, -Math.PI * 0.05); g.closePath(); g.fill();
                    g.strokeStyle = night ? "rgba(0,0,0,.3)" : "rgba(190,110,90,.6)"; g.lineWidth = 0.8;
                    for (let k = 1; k < 8; k++) { const a = -Math.PI * 0.95 + (k / 8) * Math.PI * 0.9; g.beginPath(); g.moveTo(x, y + r * 0.6); g.lineTo(x + Math.cos(a) * r, y + r * 0.6 + Math.sin(a) * r); g.stroke(); }
                } else if (kind === 1) {
                    g.fillStyle = night ? "#7a6a6a" : "#f6e2c4"; g.beginPath(); g.moveTo(x - r * 1.2, y); g.quadraticCurveTo(x, y - r * 1.1, x + r * 1.2, y - r * 0.1); g.quadraticCurveTo(x, y + r * 0.8, x - r * 1.2, y); g.fill();
                    g.fillStyle = night ? "#8a4a5a" : "#ff9aa8"; g.beginPath(); g.ellipse(x + r * 0.3, y + r * 0.05, r * 0.55, r * 0.28, -0.2, 0, TAU); g.fill();
                    g.strokeStyle = night ? "rgba(0,0,0,.3)" : "rgba(170,120,80,.6)"; g.lineWidth = 0.9;
                    for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x - r * 0.65 + k * r * 0.12, y - r * 0.1, r * (0.45 - k * 0.1), Math.PI, TAU); g.stroke(); }
                } else {
                    g.fillStyle = night ? "#7a3a3a" : "#ff7a4a"; g.beginPath();
                    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k / 10) * TAU + 0.2, d = k % 2 ? r * 0.42 : r; g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6); }
                    g.closePath(); g.fill();
                    g.fillStyle = night ? "rgba(255,180,160,.25)" : "rgba(255,230,180,.85)";
                    for (let k = 0; k < 14; k++) { const a = R() * TAU, d = R() * r * 0.7; g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6, 0.9 * s, 0, TAU); g.fill(); }
                }
            };
            for (const [x, y, r, kind] of [[0.29, 0.9, 9, 0], [0.24, 0.96, 12, 1], [0.78, 0.86, 8, 0], [0.88, 0.97, 13, 2], [0.36, 0.86, 6, 0], [0.66, 0.97, 7, 0]]) shell(LW * x, H * y, r * s, kind);
            V.torches = [[LW * 0.235, H * 0.84], [LW * 0.77, H * 0.83]].map(([x, y]) => {   // tiki torches (flames drawn live)
                const h = 110 * s;
                g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(x + 8 * s, y + 2, 14 * s, 4 * s, 0, 0, TAU); g.fill();
                const tg = g.createLinearGradient(x - 4 * s, 0, x + 4 * s, 0); tg.addColorStop(0, night ? "#4a3428" : "#b88a56"); tg.addColorStop(1, night ? "#1a100c" : "#6a4a2a");
                g.fillStyle = tg; g.fillRect(x - 3.5 * s, y - h, 7 * s, h);
                g.strokeStyle = night ? "rgba(0,0,0,.4)" : "rgba(80,50,20,.5)"; g.lineWidth = 1.2;
                for (let yy = y - h + 18 * s; yy < y; yy += 12 * s) { g.beginPath(); g.moveTo(x - 3.5 * s, yy); g.lineTo(x + 3.5 * s, yy + 3 * s); g.stroke(); }
                g.fillStyle = night ? "#3a2a1a" : "#c89a5a";
                g.beginPath(); g.moveTo(x - 10 * s, y - h - 16 * s); g.lineTo(x + 10 * s, y - h - 16 * s); g.lineTo(x + 6 * s, y - h + 4 * s); g.lineTo(x - 6 * s, y - h + 4 * s); g.fill();
                g.strokeStyle = night ? "rgba(0,0,0,.4)" : "rgba(110,70,30,.6)";
                for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(x - 9 * s + k, y - h - 12 * s + k * 4 * s); g.lineTo(x + 9 * s - k, y - h - 12 * s + k * 4 * s); g.stroke(); }
                return { x, y: y - h - 16 * s, s };
            });
            const monstera = (x0, y0, r, a) => { const leaf = paint(r * 3, r * 3, g => {
                g.save(); g.translate(r * 1.5, r * 1.5); g.rotate(a);
                const lg2 = g.createLinearGradient(-r, -r, r, r);
                lg2.addColorStop(0, night ? "#1a3024" : "#4aa83e"); lg2.addColorStop(1, night ? "#0a1610" : "#1f6a28");
                g.fillStyle = lg2;
                g.beginPath(); g.moveTo(0, r * 0.95); g.bezierCurveTo(-r * 1.1, r * 0.6, -r * 1.05, -r * 0.7, 0, -r); g.bezierCurveTo(r * 1.05, -r * 0.7, r * 1.1, r * 0.6, 0, r * 0.95); g.fill();
                g.globalCompositeOperation = "destination-out";                               // its splits and holes
                for (let k = 0; k < 5; k++) for (const side of [-1, 1]) {
                    const yy = -r * 0.6 + k * r * 0.32;
                    g.beginPath(); g.moveTo(side * r * 1.2, yy - r * 0.05); g.quadraticCurveTo(side * r * 0.6, yy + r * 0.02, side * r * 0.32, yy + r * 0.06); g.lineTo(side * r * 1.2, yy + r * 0.1); g.fill();
                    if (k > 0 && k < 4) { g.beginPath(); g.ellipse(side * r * 0.25, yy - r * 0.06, r * 0.07, r * 0.035, 0, 0, TAU); g.fill(); }
                }
                g.globalCompositeOperation = "source-over";
                g.strokeStyle = night ? "rgba(120,160,120,.25)" : "rgba(220,255,190,.55)"; g.lineWidth = 1.6;
                g.beginPath(); g.moveTo(0, r); g.lineTo(0, -r * 0.9); g.stroke();
                g.lineWidth = 0.8;
                for (let k = 0; k < 6; k++) { const yy = -r * 0.62 + k * r * 0.3; g.beginPath(); g.moveTo(0, yy + r * 0.1); g.quadraticCurveTo(r * 0.3, yy, r * 0.6, yy - r * 0.02); g.moveTo(0, yy + r * 0.1); g.quadraticCurveTo(-r * 0.3, yy, -r * 0.6, yy - r * 0.02); g.stroke(); }
                g.restore();
            }); g.drawImage(leaf, x0 - r * 1.5, y0 - r * 1.5); };
            const hibiscus = (x, y, r, col) => {
                for (let p = 0; p < 5; p++) {
                    const a = (p / 5) * TAU - 0.3, px = x + Math.cos(a) * r * 0.5, py = y + Math.sin(a) * r * 0.5;
                    const pg = g.createRadialGradient(x, y, r * 0.1, px, py, r * 0.75);
                    pg.addColorStop(0, night ? "#2a0a14" : "#8a0a2a"); pg.addColorStop(0.35, night ? mix(col, "#000000", 0.6) : col); pg.addColorStop(1, night ? mix(col, "#000000", 0.45) : mix(col, "#ffffff", 0.25));
                    g.fillStyle = pg; g.beginPath(); g.ellipse(px, py, r * 0.62, r * 0.46, a, 0, TAU); g.fill();
                    g.strokeStyle = night ? "rgba(0,0,0,.25)" : "rgba(140,10,40,.35)"; g.lineWidth = 0.7;
                    for (let v = -2; v <= 2; v++) { g.beginPath(); g.moveTo(x, y); g.lineTo(px + Math.cos(a + v * 0.25) * r * 0.5, py + Math.sin(a + v * 0.25) * r * 0.5); g.stroke(); }
                }
                g.strokeStyle = night ? "#8a6a3a" : "#ffde5a"; g.lineWidth = 2.2; g.lineCap = "round";
                g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + r * 0.5, y - r * 0.2, x + r * 0.85, y - r * 0.55); g.stroke();
                g.fillStyle = night ? "#a0702a" : "#ffb02a"; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(x + r * (0.7 + k * 0.04), y - r * (0.45 + k * 0.03) + (k % 2 ? 2 : -2), 1.6, 0, TAU); g.fill(); }
                g.fillStyle = night ? "#7a1a2a" : "#e8203a"; for (let k = 0; k < 5; k++) { const a = k * 1.25; g.beginPath(); g.arc(x + r * 0.88 + Math.cos(a) * 2.6, y - r * 0.58 + Math.sin(a) * 2.6, 1.4, 0, TAU); g.fill(); }
            };
            const fern = (x, y, l, a) => {
                g.save(); g.translate(x, y); g.rotate(a);
                g.strokeStyle = night ? "#11261c" : "#3f8a34"; g.lineWidth = 2; g.lineCap = "round";
                g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(l * 0.2, -l * 0.6, l * 0.5, -l); g.stroke();
                for (let k = 1; k < 18; k++) {
                    const t = k / 18, px = l * 0.2 * 2 * t * (1 - t) + l * 0.5 * t * t, py = -l * 0.6 * 2 * t * (1 - t) - l * t * t, n = l * 0.2 * (1 - t * 0.7);
                    g.fillStyle = night ? (k % 2 ? "#0f2218" : "#163020") : (k % 2 ? "#4a9a3a" : "#68b44a");
                    for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(px + sd * n * 0.5, py + n * 0.15, n * 0.55, n * 0.16, sd * 0.5, 0, TAU); g.fill(); }
                }
                g.restore();
            };
            for (const [x, y, r, a] of [[0.02, 1.0, 120, -0.5], [0.09, 1.04, 100, 0.2], [0.0, 0.88, 80, -1.0]]) monstera(M + W * x, H * y, r * s, a);
            for (const [x, y, l, a] of [[0.93, 1.02, 150, -0.6], [0.98, 1.02, 170, -0.25], [1.0, 0.95, 120, -1.0], [0.88, 1.03, 110, -0.9]]) fern(M + W * x, H * y, l * s, a);
            hibiscus(M + W * 0.06, H * 0.9, 26 * s, "#ff2a4a"); hibiscus(M + W * 0.13, H * 0.97, 22 * s, "#ff6a9a");
            hibiscus(M + W * 0.95, H * 0.9, 24 * s, "#ff7a2a"); hibiscus(M + W * 0.9, H * 0.98, 20 * s, "#ffd02a");
        });

        // ---- palms: each its own picture so it can sway about its foot ----
        palms = [[0.035, 1.02, 380, 0.22, 0.2], [0.115, 1.03, 300, 0.36, 1.4], [0.965, 1.02, 360, -0.24, 2.6], [0.885, 1.04, 270, -0.4, 0.8]].map(([x, y, h, lean, ph]) => {
            h *= s;
            const pw = h * 1.9, phh = h * 1.55, fx = pw / 2 - lean * h, fy = phh - 4;
            const img = paint(pw, phh, g => {
                const tx = fx + lean * h, ty = fy - h;
                for (let i = 0; i < 40; i++) {                                              // the trunk: rings, shaded round
                    const u = i / 40, u2 = (i + 1) / 40, w = (9 - u * 4) * s;
                    const x1 = fx + lean * h * u * u, y1 = fy - h * u, x2 = fx + lean * h * u2 * u2, y2 = fy - h * u2;
                    const tg = g.createLinearGradient(x1 - w, 0, x1 + w, 0);
                    tg.addColorStop(0, P.trunk[0]); tg.addColorStop(0.6, P.trunk[1]); tg.addColorStop(1, mix(P.trunk[1], "#000000", 0.35));
                    g.fillStyle = tg; g.beginPath(); g.moveTo(x1 - w, y1); g.lineTo(x2 - w, y2 - 1); g.lineTo(x2 + w, y2 - 1); g.lineTo(x1 + w, y1); g.fill();
                    g.strokeStyle = i % 2 ? "rgba(0,0,0,.22)" : "rgba(255,240,210,.12)"; g.lineWidth = 1.4;
                    g.beginPath(); g.moveTo(x1 - w, y1); g.quadraticCurveTo(x1, y1 + 2.5 * s, x1 + w, y1 - 1); g.stroke();
                    if (night) { g.strokeStyle = P.rim + "0.22)"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x1 + w - 1, y1); g.lineTo(x2 + w - 1, y2); g.stroke(); }
                }
                const frond = (a, l, droop, col, dead) => {                                 // a rib, leaflets drooping either side
                    const ex = tx + Math.cos(a) * l, ey = ty + Math.sin(a) * l + l * droop;
                    const cx = tx + Math.cos(a) * l * 0.5, cy = ty + Math.sin(a) * l * 0.5 - l * 0.12;
                    for (let j = 1; j <= 22; j++) {
                        const t = j / 22, px = (1 - t) * (1 - t) * tx + 2 * (1 - t) * t * cx + t * t * ex, py = (1 - t) * (1 - t) * ty + 2 * (1 - t) * t * cy + t * t * ey;
                        const n = l * 0.17 * Math.sin(Math.min(1, t * 1.3) * Math.PI * 0.85) + 2;
                        const dx = 2 * (1 - t) * (cx - tx) + 2 * t * (ex - cx), dy = 2 * (1 - t) * (cy - ty) + 2 * t * (ey - cy), d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
                        g.strokeStyle = dead ? (night ? "#2a2018" : "#a08050") : col[j % 3]; g.lineWidth = Math.max(1, 2.6 * s * (1 - t * 0.5));
                        for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo(px + nx * sd * n * 0.6, py + ny * sd * n * 0.6 + n * 0.25, px + nx * sd * n + dx / d * n * 0.3, py + ny * sd * n + n * 0.75); g.stroke(); }
                    }
                    g.strokeStyle = dead ? (night ? "#3a2a1a" : "#8a6a3a") : mix(col[0], "#000000", 0.25); g.lineWidth = 2.2 * s;
                    g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(cx, cy, ex, ey); g.stroke();
                };
                const R2 = U.rng(Math.round(h));
                const shade = P.palm.map(c => mix(c, "#000000", 0.3));
                for (let i = 0; i < 6; i++) frond(-Math.PI / 2 + (i - 2.5) * 0.62 + (R2() - 0.5) * 0.2, h * (0.48 + R2() * 0.12), 0.55, shade, false);
                for (const [dx, dy] of [[-6, 6], [5, 7], [0, 11], [-2, 3]]) {                // coconuts
                    const cx = tx + dx * s, cy = ty + dy * s, cg = g.createRadialGradient(cx - 2 * s, cy - 2 * s, 0, cx, cy, 6 * s);
                    cg.addColorStop(0, night ? "#4a3a20" : "#a88a4a"); cg.addColorStop(1, night ? "#1a1008" : "#4a2e12");
                    g.fillStyle = cg; g.beginPath(); g.arc(cx, cy, 6 * s, 0, TAU); g.fill();
                }
                for (let i = 0; i < 9; i++) frond(-Math.PI / 2 + (i - 4) * 0.42 + (R2() - 0.5) * 0.15, h * (0.5 + R2() * 0.14), 0.42, P.palm, false);
            });
            return { img, x: M + W * x, y: H * y + 4, ox: fx, oy: fy, ph };
        });

        // ---- clouds: heaps of shaded puffs, lit warm on top, a grey-blue belly ----
        clouds = night ? [] : Array.from({ length: preview ? 2 : 6 }, () => {
            const cw = 180 + R() * 220, ch = cw * 0.45, pad = ch * 0.5;
            const img = paint(cw + pad * 2, ch + pad * 2, g => {
                g.translate(pad, pad);
                const base = ch * 0.8, ps = [];
                for (let i = 0; i < 22; i++) { const u = R(), hump = Math.sin(u * Math.PI); ps.push({ x: cw * (0.08 + u * 0.84), y: base - hump * ch * (0.22 + R() * 0.35), r: ch * (0.12 + hump * 0.22 + R() * 0.08) }); }
                g.fillStyle = "#ffffff";                                                     // one crisp silhouette
                for (const p of ps) { g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill(); }
                g.globalCompositeOperation = "source-atop";
                for (let i = 0; i < 6; i++) {                                               // soft creases between the billows
                    const x = cw * (0.15 + R() * 0.7), y = ch * (0.45 + R() * 0.35), r = ch * (0.25 + R() * 0.2);
                    const cg2 = g.createRadialGradient(x, y, 0, x, y, r); cg2.addColorStop(0, "rgba(160,178,204,.22)"); cg2.addColorStop(1, "rgba(160,178,204,0)");
                    g.fillStyle = cg2; g.fillRect(x - r, y - r, r * 2, r * 2);
                }
                const under = g.createLinearGradient(0, base - ch * 0.25, 0, base + ch * 0.1); under.addColorStop(0, "rgba(0,0,0,0)"); under.addColorStop(1, "rgba(150,165,190,.4)");
                g.fillStyle = under; g.fillRect(-pad, -pad, cw + pad * 2, ch + pad * 2);
                const lit = g.createLinearGradient(0, 0, cw * 0.6, ch); lit.addColorStop(0, "rgba(255,240,205,.5)"); lit.addColorStop(1, "rgba(255,240,205,0)");
                g.fillStyle = lit; g.fillRect(-pad, -pad, cw + pad * 2, ch + pad * 2);
            });
            return { img, x: R() * W, y: H * U.lerp(0.02, 0.24, R()), s: U.lerp(0.55, 1.05, R()) * (preview ? 0.5 : 1), sp: U.lerp(3, 9, R()) };
        });
        // smoke puffs: textured sprites (day white, night lit red from below, ash for the eruption)
        const puff = (light, dark, under) => paint(128, 128, g => {
            for (let i = 0; i < 9; i++) {
                const a = R() * TAU, d = R() * 22, x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d * 0.8, r = 26 + R() * 14;
                const pg = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
                pg.addColorStop(0, light); pg.addColorStop(0.7, dark); pg.addColorStop(1, dark.replace(/[\d.]+\)$/, "0)"));
                g.fillStyle = pg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
            }
            g.globalCompositeOperation = "source-atop"; const ug = g.createLinearGradient(0, 50, 0, 120); ug.addColorStop(0, "rgba(0,0,0,0)"); ug.addColorStop(1, under); g.fillStyle = ug; g.fillRect(0, 0, 128, 128);
        });
        puffs = {
            day: puff("rgba(250,250,252,.9)", "rgba(200,204,214,.6)", "rgba(150,150,165,.5)"),
            night: puff("rgba(120,90,110,.7)", "rgba(70,50,70,.55)", "rgba(255,90,40,.55)"),
            ash: puff("rgba(110,100,100,.9)", "rgba(60,52,54,.8)", "rgba(255,110,40,.4)")
        };
        stars = night ? Array.from({ length: preview ? 0 : 40 }, () => ({ x: R() * W, y: Math.pow(R(), 1.3) * HZ * 0.7, r: 1 + R() * 0.8, ph: R() * TAU, sp: 0.4 + R() * 0.8 })) : [];
        foam = Array.from({ length: Math.ceil(LW / 7) }, (_, i) => ({ x: i * 7 + R() * 5, dy: R() * 4 - 2, r: 1.5 + R() * 3, a: 0.5 + R() * 0.5 }));
        canoe = preview ? null : { x: W * 0.28, y: H * 0.7 };
        sail = preview ? null : { x: W * 0.3 };
        crab = preview ? null : { x: W * 0.4, y: H * 0.88, vx: 0, next: 3 };
    }
    setup();

    return {
        resize(w, h) { W = w; H = h; setup(); },
        draw(g, t, dt, inp) {
            const s = V.s, e = link.eruption();
            if (e > 10) link.done();
            const erupting = e >= 0, px = inp.px || 0;
            const swell = erupting ? (e < 1.6 ? e / 1.6 : e < 6 ? 1 : Math.max(0, 1 - (e - 6) / 4)) : 0;
            g.drawImage(skyImg, 0, 0);
            if (swell > 0) { g.fillStyle = `rgba(255,${night ? 70 : 110},30,${(swell * (night ? 0.25 : 0.3)).toFixed(3)})`; g.fillRect(0, 0, W, HZ + 2); }
            for (const st of stars) Worlds.twinkle(g, st.x, st.y, st.r, 0.5 + 0.5 * Math.sin(t * st.sp + st.ph));
            for (const c of clouds) {
                c.x += c.sp * dt; const w = c.img.width * c.s; if (c.x > W + 40) c.x = -w - 40;
                g.globalAlpha = 1 - swell * 0.4; g.drawImage(c.img, c.x - px * 3, c.y, w, c.img.height * c.s); g.globalAlpha = 1;
            }
            if (sail) {                                                                    // a sail far out on the horizon
                sail.x += 3 * dt; if (sail.x > W + 20) sail.x = -20;
                const x = sail.x - px * 4, y = HZ - 1;
                g.fillStyle = night ? "#3a2030" : "#f6f4ee"; g.beginPath(); g.moveTo(x, y - 1); g.lineTo(x, y - 13 * s); g.lineTo(x + 7 * s, y - 2); g.fill();
                g.fillStyle = night ? "#2a1a24" : "#5a6a7a"; g.fillRect(x - 5 * s, y - 1.5, 13 * s, 2);
            }
            // the island, then the lava over it
            const ix = -M - px * 6;
            g.drawImage(islandImg, ix, 0);
            const cx = V.x + ix, top = V.top;
            link.crater.x = cx; link.crater.y = top;
            const heat = night ? 0.75 + 0.25 * Math.sin(t * 1.7) * Math.sin(t * 0.63 + 1) : 0;
            const glowA = Math.max(heat * 0.6, swell);
            if (glowA > 0) { Worlds.glow(g, cx, top, V.cr * (3 + swell * 3), "#ff5a1a", glowA * 0.9); Worlds.glow(g, cx, top + 4, V.cr * 1.4, "#ffc060", glowA * 0.7); }
            const pour = erupting && e > 1.6 ? Math.min(1, (e - 1.6) / 2.4) : 0;
            const lavaA = Math.max(night ? 0.85 + 0.15 * Math.sin(t * 2.3) : 0, pour > 0 ? (e < 8 ? 1 : Math.max(0, 1 - (e - 8) / 2)) : 0);
            if (lavaA > 0) {
                const reach = night ? 1 : pour;
                g.save();
                if (reach < 1) { g.beginPath(); g.rect(0, 0, W, top + (V.base - top) * reach + 4); g.clip(); }
                g.globalAlpha = lavaA; g.drawImage(lavaImg, ix, 0); g.globalAlpha = 1;
                g.restore();
                for (const rv of V.rivers) for (let i = 0; i < 4; i++) {                    // bright gobs running down
                    const q = ((t * 0.08 + i / 4 + rv[0][0] * 0.001) % 1) * reach, j = Math.floor(q * (rv.length - 1));
                    if (rv[j]) Worlds.glow(g, rv[j][0] + ix, rv[j][1], 7 * s, "#ffe080", lavaA * 0.9);
                }
                if (night) {                                                                // the glow running across the water
                    g.save(); g.globalCompositeOperation = "lighter";
                    for (let i = 0; i < 46; i++) {
                        const y = HZ + H * 0.06 + (i / 46) * H * 0.2, w = (8 + i * 1.6) * s * (0.6 + 0.4 * Math.sin(t * 2 + i * 1.7)), x = cx + Math.sin(t * 1.1 + i * 2.3) * (6 + i * 1.5);
                        g.fillStyle = `rgba(255,${100 + (i % 3) * 20},50,${(0.22 * (1 - i / 46) * lavaA).toFixed(3)})`; g.fillRect(x - w / 2, y, w, 1.4);
                    }
                    g.restore();
                }
            }
            // smoke from the crater: thin by day, lit red at night, thick dark ash while it erupts
            const rate = erupting && e < 7 ? 9 : night ? 2.4 : 1.8;
            if (Math.random() < dt * rate) smoke.push({ x: cx + (Math.random() - 0.5) * V.cr, y: top - 4, r: (14 + Math.random() * 10) * s * (erupting ? 1.6 : 1), age: 0, life: U.rand(7, 11), vy: erupting ? U.rand(40, 80) : U.rand(14, 22), vx: U.rand(6, 16), rot: Math.random() * TAU, img: erupting && e < 7 ? puffs.ash : night ? puffs.night : puffs.day });
            for (const p of smoke) {
                p.age += dt; p.x += (p.vx + p.age * 2.2) * dt; p.y -= p.vy * dt * Math.max(0.3, 1 - p.age / p.life); p.r += (erupting ? 12 : 6) * s * dt;
                g.globalAlpha = Math.sin(Math.min(1, p.age / p.life) * Math.PI) * (night ? 0.75 : 0.65);
                g.save(); g.translate(p.x, p.y); g.rotate(p.rot + p.age * 0.05); g.drawImage(p.img, -p.r, -p.r, p.r * 2, p.r * 2); g.restore();
            }
            g.globalAlpha = 1;
            smoke = smoke.filter(p => p.age < p.life);
            // lava bombs arcing out at night (and many in the eruption), trailing smoke
            nextBomb -= dt;
            if ((night || erupting) && nextBomb <= 0 && !preview) { const n = erupting && e > 1.6 && e < 6 ? 3 : 1; for (let i = 0; i < n; i++) bombs.push({ x: cx, y: top, vx: U.rand(-70, 70) * s, vy: U.rand(-160, -90) * s, life: 2.6, trail: [] }); nextBomb = erupting ? 0.15 : U.rand(2.5, 6); }
            for (const b of bombs) {
                b.life -= dt; b.vy += 110 * s * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.trail.push([b.x, b.y]); if (b.trail.length > 14) b.trail.shift();
                g.strokeStyle = night ? "rgba(80,40,50,.35)" : "rgba(80,70,70,.3)"; g.lineWidth = 2.5 * s; g.lineCap = "round";
                g.beginPath(); b.trail.forEach(([x, y], i) => g[i ? "lineTo" : "moveTo"](x, y)); g.stroke();
                Worlds.glow(g, b.x, b.y, 9 * s, "#ff7a2a", Math.min(1, b.life)); g.fillStyle = "#fff0a0"; g.beginPath(); g.arc(b.x, b.y, 1.6 * s, 0, TAU); g.fill();
            }
            bombs = bombs.filter(b => b.life > 0 && b.y < V.base);
            if (erupting && e > 1.6 && e < 5.5) for (let i = 0; i < Math.round(dt * 170); i++) fountain.push({ x: cx + (Math.random() - 0.5) * 24 * s, y: top, vx: (Math.random() - 0.5) * 300 * s, vy: (-260 - Math.random() * 480) * s, life: 2.4, r: (2 + Math.random() * 4) * s });
            for (const p of fountain) { p.life -= dt; p.vy += 520 * s * dt; p.x += p.vx * dt; p.y += p.vy * dt; Worlds.glow(g, p.x, p.y, p.r * 3.2, "#ff6a1a", Math.min(1, p.life)); g.fillStyle = p.life > 1.4 ? "#fff6c0" : "#ffb040"; g.beginPath(); g.arc(p.x, p.y, p.r * 0.55, 0, TAU); g.fill(); }
            fountain = fountain.filter(p => p.life > 0 && p.y < V.base);
            if (night || erupting) {                                                          // embers drifting up
                if (Math.random() < dt * (erupting ? 20 : 5)) embers.push({ x: cx + (Math.random() - 0.5) * V.cr * 2, y: top, vx: U.rand(-8, 22), vy: U.rand(-45, -20), life: U.rand(2, 4.5) });
                for (const em of embers) { em.life -= dt; em.x += (em.vx + Math.sin(em.life * 3) * 8) * dt; em.y += em.vy * dt; Worlds.glow(g, em.x, em.y, 4, "#ffb43a", Math.min(1, em.life)); }
                embers = embers.filter(em => em.life > 0);
            }
            if (!night) {                                                                     // the sea glittering under the sun
                g.save(); g.globalCompositeOperation = "lighter";
                const gx = W * 0.17 - px * 6;
                for (let i = 0; i < 60; i++) {
                    const y = HZ + 2 + Math.pow(i / 60, 1.5) * H * 0.22, w = (3 + i * 0.9) * (0.4 + 0.6 * Math.abs(Math.sin(t * 2.6 + i * 4.1))), x = gx + Math.sin(i * 12.9898) * (10 + i * 2.6) + Math.sin(t * 0.8 + i) * 3;
                    g.fillStyle = `rgba(255,252,235,${(0.55 * (1 - i / 60) * Math.abs(Math.sin(t * 1.9 + i * 2.7))).toFixed(3)})`; g.fillRect(x - w / 2, y, w, 1.3);
                }
                g.restore();
            }
            nextDolphin -= dt;                                                                // a dolphin leaping now and then
            if (nextDolphin <= 0 && !dolphin) { dolphin = { x: W * U.rand(0.15, 0.45), y: HZ + H * U.rand(0.07, 0.12), age: 0, dir: Math.random() < 0.5 ? -1 : 1 }; nextDolphin = U.rand(14, 26); }
            if (dolphin) {
                dolphin.age += dt; const q = dolphin.age / 1.4;
                if (q >= 1) dolphin = null;
                else {
                    const x = dolphin.x + dolphin.dir * q * 40 * s, y = dolphin.y - Math.sin(q * Math.PI) * 24 * s, a = (q - 0.5) * 2.2 * dolphin.dir;
                    if (q < 0.15 || q > 0.85) { g.fillStyle = night ? "rgba(255,170,170,.3)" : "rgba(255,255,255,.7)"; g.beginPath(); g.ellipse(dolphin.x + dolphin.dir * (q < 0.5 ? 0 : 40) * s - px * 6, dolphin.y + 2, 10 * s, 2 * s, 0, 0, TAU); g.fill(); }
                    g.save(); g.translate(x - px * 6, y); g.rotate(a); g.scale(dolphin.dir * s, s);
                    g.fillStyle = night ? "#2a2034" : "#5a7a96";
                    g.beginPath(); g.moveTo(-16, 0); g.quadraticCurveTo(-4, -8, 14, -2); g.lineTo(18, -1); g.lineTo(14, 1); g.quadraticCurveTo(0, 6, -16, 1); g.lineTo(-22, -4); g.lineTo(-20, 0); g.lineTo(-22, 4); g.closePath(); g.fill();
                    g.beginPath(); g.moveTo(-2, -6); g.lineTo(-6, -12); g.lineTo(4, -5); g.fill();
                    g.fillStyle = night ? "rgba(255,150,150,.15)" : "rgba(230,240,250,.6)"; g.beginPath(); g.moveTo(-12, 2); g.quadraticCurveTo(0, 5, 12, 0); g.quadraticCurveTo(0, 2, -12, 2); g.fill();
                    g.restore();
                }
            }
            if (canoe) {                                                                      // the outrigger canoe
                canoe.x += 9 * dt; if (canoe.x > W + 120) canoe.x = -120;
                const x = canoe.x - px * 10, y = canoe.y + Math.sin(t * 1.3) * 1.5, k = 1.1 * s, st = Math.sin(t * 2.4);
                g.fillStyle = night ? "rgba(255,120,80,.08)" : "rgba(255,255,255,.35)";
                for (let i = 1; i < 5; i++) { g.beginPath(); g.ellipse(x - i * 14 * k, y + 3 * k, (6 + i * 3) * k, 1.2 * k, 0, 0, TAU); g.fill(); }
                g.strokeStyle = night ? "#140c10" : "#5a3a20"; g.lineWidth = 1.6 * k;
                g.beginPath(); g.moveTo(x - 12 * k, y - 2 * k); g.lineTo(x - 10 * k, y + 10 * k); g.moveTo(x + 12 * k, y - 2 * k); g.lineTo(x + 10 * k, y + 10 * k); g.stroke();
                g.fillStyle = night ? "#1a1014" : "#7a5030"; g.beginPath(); g.ellipse(x, y + 10 * k, 22 * k, 1.8 * k, 0, 0, TAU); g.fill();
                const hg = g.createLinearGradient(0, y - 4 * k, 0, y + 4 * k); hg.addColorStop(0, night ? "#3a2420" : "#b06a3a"); hg.addColorStop(1, night ? "#140c0e" : "#5a2e14");
                g.fillStyle = hg; g.beginPath(); g.moveTo(x - 36 * k, y - 3 * k); g.quadraticCurveTo(x, y + 8 * k, x + 38 * k, y - 4 * k); g.lineTo(x + 30 * k, y - 1 * k); g.lineTo(x - 30 * k, y); g.closePath(); g.fill();
                g.strokeStyle = night ? "rgba(255,200,160,.15)" : "rgba(255,230,190,.6)"; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 30 * k, y - 0.5 * k); g.lineTo(x + 30 * k, y - 1.5 * k); g.stroke();
                g.fillStyle = night ? "#0c080a" : "#2a1e18";
                g.beginPath(); g.ellipse(x + 4 * k, y - 8 * k, 4 * k, 6 * k, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(x + 4.5 * k, y - 16 * k, 3.4 * k, 0, TAU); g.fill();
                g.strokeStyle = night ? "#0c080a" : "#3a2a1a"; g.lineWidth = 1.5 * k;
                g.beginPath(); g.moveTo(x + 4 * k + st * 10 * k, y - 18 * k); g.lineTo(x + 4 * k - st * 10 * k, y + 6 * k); g.stroke();
                g.fillStyle = night ? "#0c080a" : "#3a2a1a"; g.beginPath(); g.ellipse(x + 4 * k - st * 10 * k, y + 7 * k, 2 * k, 4 * k, -st * 0.4, 0, TAU); g.fill();
            }
            // the front, then the surf over its edge: a sheet that runs up and back, a lacy edge, a wave rolling in
            const fx0 = -M - px * 16, LW = W + M * 2, lineAt = (x, off) => shoreY(x - M) + off;
            g.drawImage(frontImg, fx0, 0);
            const wash = 0.5 + 0.5 * Math.sin(t * 0.55), roll = (t * 0.11) % 1, reach = H * 0.006 + wash * H * 0.03;
            g.save(); g.translate(fx0, 0);
            g.fillStyle = night ? "rgba(90,60,100,.28)" : "rgba(150,236,228,.42)";
            g.beginPath(); g.moveTo(0, lineAt(0, -H * 0.01)); for (let x = 0; x <= LW; x += 12) g.lineTo(x, lineAt(x, -H * 0.01)); for (let x = LW; x >= 0; x -= 12) g.lineTo(x, lineAt(x, reach + Math.sin(x * 0.02 + t) * 2)); g.closePath(); g.fill();
            for (const f of foam) {
                g.fillStyle = P.foam + (f.a * (0.4 + wash * 0.5) * (night ? 0.45 : 1)).toFixed(3) + ")";
                g.beginPath(); g.ellipse(f.x, lineAt(f.x, reach + Math.sin(f.x * 0.02 + t) * 2) + f.dy, f.r * 1.6, f.r * 0.6, 0, 0, TAU); g.fill();
            }
            const ry = -H * 0.05 * (1 - roll), ra = Math.sin(roll * Math.PI) * (night ? 0.35 : 0.75);
            g.strokeStyle = P.foam + ra.toFixed(3) + ")"; g.lineWidth = 2.4;
            g.beginPath(); for (let x = 0; x <= LW; x += 10) g[x ? "lineTo" : "moveTo"](x, lineAt(x, ry) + Math.sin(x * 0.05 + t * 1.8) * 1.6); g.stroke();
            g.restore();
            if (crab) {                                                                       // the crab scuttling sideways
                crab.next -= dt;
                if (crab.next <= 0) { crab.vx = crab.vx ? 0 : (Math.random() < 0.5 ? -1 : 1) * U.rand(30, 60) * s; crab.next = crab.vx ? U.rand(1, 2.5) : U.rand(2, 6); }
                crab.x = U.clamp(crab.x + crab.vx * dt, W * 0.3, W * 0.68);
                const x = crab.x - px * 16, y = crab.y, k = s, step = crab.vx ? Math.sin(t * 22) : 0;
                g.fillStyle = "rgba(0,0,0,.2)"; g.beginPath(); g.ellipse(x, y + 6 * k, 12 * k, 3 * k, 0, 0, TAU); g.fill();
                g.strokeStyle = night ? "#5a2a2a" : "#d0482a"; g.lineWidth = 1.6 * k;
                for (const sd of [-1, 1]) for (let l = 0; l < 3; l++) { const lx = x + sd * (5 + l * 2) * k, a = (l % 2 ? step : -step) * 2; g.beginPath(); g.moveTo(lx, y + k); g.lineTo(lx + sd * 5 * k, y - k + a); g.lineTo(lx + sd * 7 * k, y + 5 * k + a); g.stroke(); }
                const cg = g.createRadialGradient(x - 3 * k, y - 3 * k, 0, x, y, 9 * k); cg.addColorStop(0, night ? "#8a3a3a" : "#ff8a5a"); cg.addColorStop(1, night ? "#3a1414" : "#b8301a");
                g.fillStyle = cg; g.beginPath(); g.ellipse(x, y, 9 * k, 6 * k, 0, 0, TAU); g.fill();
                for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(x + sd * 11 * k, y - 5 * k, 3.5 * k, 2.4 * k, sd * 0.6, 0, TAU); g.fill(); }
                g.strokeStyle = night ? "#3a1414" : "#8a2a1a"; g.lineWidth = k; g.beginPath(); g.moveTo(x - 2.5 * k, y - 5 * k); g.lineTo(x - 3 * k, y - 9 * k); g.moveTo(x + 2.5 * k, y - 5 * k); g.lineTo(x + 3 * k, y - 9 * k); g.stroke();
                g.fillStyle = "#111"; g.beginPath(); g.arc(x - 3 * k, y - 9.5 * k, 1.3 * k, 0, TAU); g.arc(x + 3 * k, y - 9.5 * k, 1.3 * k, 0, TAU); g.fill();
            }
            if (night || swell > 0.5) for (const tc of V.torches) {                           // the torches burning
                const x = tc.x + fx0, y = tc.y, k = tc.s, fl = 0.85 + 0.15 * Math.sin(t * 17 + x) * Math.sin(t * 7.3);
                Worlds.glow(g, x, y - 8 * k, 60 * k * fl, "#ff8a2a", 0.5); Worlds.glow(g, x, y + 120 * k, 70 * k, "#ff7a2a", 0.15);
                g.fillStyle = "#ff6a1a"; g.beginPath(); g.moveTo(x - 7 * k, y); g.quadraticCurveTo(x - 8 * k, y - 14 * k, x + Math.sin(t * 9) * 3 * k, y - 30 * k * fl); g.quadraticCurveTo(x + 8 * k, y - 14 * k, x + 7 * k, y); g.fill();
                g.fillStyle = "#ffd25a"; g.beginPath(); g.moveTo(x - 3.5 * k, y); g.quadraticCurveTo(x - 4 * k, y - 8 * k, x + Math.sin(t * 11) * 2 * k, y - 18 * k * fl); g.quadraticCurveTo(x + 4 * k, y - 8 * k, x + 3.5 * k, y); g.fill();
                if (Math.random() < dt * 4) embers.push({ x, y: y - 20 * k, vx: U.rand(-10, 10), vy: U.rand(-40, -25), life: U.rand(0.8, 1.6) });
            }
            for (const p of palms) {                                                          // the palms, swaying
                const a = Math.sin(t * 0.7 + p.ph) * 0.018 + Math.sin(t * 1.9 + p.ph * 2) * 0.006;
                g.save(); g.translate(p.x - M - px * 22, p.y); g.rotate(a); g.drawImage(p.img, -p.ox, -p.oy); g.restore();
            }
            nextGull -= dt;                                                                   // gulls: flap, then glide
            if (nextGull <= 0 && !night) { const n = U.pick([1, 2, 3]), y = H * U.rand(0.12, 0.34); for (let i = 0; i < n; i++) gulls.push({ x: -40 - i * 36, y: y + i * 16, vx: U.rand(38, 55), ph: Math.random() * TAU, sz: U.rand(0.8, 1.15) * s }); nextGull = U.rand(9, 18); }
            for (const b of gulls) {
                b.x += b.vx * dt;
                const x = b.x - px * 12, y = b.y + Math.sin(t * 1.1 + b.ph) * 5, glide = Math.sin(t * 0.6 + b.ph) > 0.3, f = glide ? 0.15 : Math.sin(t * 7 + b.ph), k = b.sz;
                g.fillStyle = "#f8f8f6"; g.strokeStyle = "#3a3a44"; g.lineWidth = 1;
                for (const sd of [-1, 1]) {
                    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + sd * 7 * k, y - (5 + f * 7) * k, x + sd * 16 * k, y - f * 9 * k); g.quadraticCurveTo(x + sd * 8 * k, y - (1 + f * 3) * k, x, y + 2 * k); g.fill(); g.stroke();
                    g.fillStyle = "#2a2a30"; g.beginPath(); g.arc(x + sd * 15 * k, y - f * 9 * k, 1.8 * k, 0, TAU); g.fill(); g.fillStyle = "#f8f8f6";
                }
                g.beginPath(); g.ellipse(x, y + k, 5 * k, 2 * k, 0, 0, TAU); g.fill();
            }
            gulls = gulls.filter(b => b.x < W + 60);
        }
    };
}
