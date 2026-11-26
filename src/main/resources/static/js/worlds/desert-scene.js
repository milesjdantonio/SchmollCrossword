// The Desert Caravan's background (desert.js uses it). Day: a deep sky paling into haze at the horizon, a huge
// sun with glare, striped mesas going blue with distance, pyramids lit on one face and in shade on the other, an
// oasis (palms, a pool holding the sky, tents), four ranges of dunes with sharp crests (warm light on one side,
// cool shade on the other) and wind ripples, sand blowing off the crests, a camel caravan walking the far ridge,
// saguaros, rocks, a tumbleweed rolling by, vultures circling and the air shimmering. Night: the same under the
// Milky Way and a big moon, the crests silvered, the caravan carrying lanterns, glowing tents and a campfire.
function DesertScene(W, H, opts) {
    const night = opts.theme === "dark", preview = !!opts.preview, TAU = Math.PI * 2;
    const P = night
        ? { sky: ["#05081c", "#101a3c", "#22305a", "#3a3a62"], far: ["#3a3e66", "#2c3058"], mesa: ["#4a4468", "#3a3658", "#2e2a48"], lit: ["#5a5a86", "#4c4c78", "#3e3e68", "#34345c"], shade: ["#2a2c50", "#232548", "#1c1e3e", "#161836"], ripple: "rgba(160,170,230,.12)", pyr: ["#6a6a92", "#3a3a5e"], palm: ["#0e1626", "#16223a"], water: ["#2a3a6a", "#1a2448"] }
        : { sky: ["#2f7fc9", "#69a9dd", "#bfdcec", "#f6e6c0"], far: ["#d9b89a", "#ccaa8c"], mesa: ["#c27a52", "#a8603c", "#8e4c2e"], lit: ["#f3d394", "#ebc27a", "#e2b064", "#d89e50"], shade: ["#c99a62", "#b9864f", "#a9743f", "#996434"], ripple: "rgba(150,100,40,.16)", pyr: ["#efcf8e", "#b8894c"], palm: ["#3f7a34", "#2f6228"], water: ["#4aa0d8", "#2f7ab8"] };
    let sky = null, layers = null, spin = [], caravan = [], weed = null, nextWeed = preview ? 999 : 5, birds = [], stars = [], fire = null, sparks = [];
    const k = () => (preview ? 0.5 : U.clamp(Math.min(W, H) / 900, 0.6, 1.1));
    const M = 40;
    function paint(w, h, fn) { const c = Worlds.canvas(w, h), g = c.getContext("2d"); fn(g); return c; }
    const crest = (x, base, amp, f, ph) => base + Math.sin(x * f + ph) * amp + Math.sin(x * f * 2.3 + ph * 1.7) * amp * 0.35;
    const DUNES = [[0.6, 0.035, 0.004, 0.3], [0.68, 0.045, 0.003, 1.9], [0.78, 0.05, 0.0024, 3.1], [0.9, 0.055, 0.002, 4.4]];

    function setup() {
        const R = U.rng(5150), LW = W + M * 2, s = k();
        layers = {};
        layers.far = paint(LW, H, g => {
            // mesas: flat-topped, striped, their shaded side darker; a second, paler row behind
            for (const [row, base, sc] of [[0, H * 0.58, 0.7], [1, H * 0.6, 1]]) {
                for (let i = 0; i < 3 + row * 2; i++) {
                    const x = R() * LW, w = (120 + R() * 220) * sc * s, h = (50 + R() * 70) * sc * s, top = base - h;
                    const col = row ? P.mesa : P.far.concat(P.far[1]);
                    g.fillStyle = col[0]; g.beginPath(); g.moveTo(x, base); g.lineTo(x + w * 0.12, top); g.lineTo(x + w * 0.82, top); g.lineTo(x + w, base); g.fill();
                    g.fillStyle = col[2] || col[1]; g.beginPath(); g.moveTo(x + w * 0.6, top); g.lineTo(x + w * 0.82, top); g.lineTo(x + w, base); g.lineTo(x + w * 0.7, base); g.fill();
                    g.strokeStyle = "rgba(0,0,0,.1)"; g.lineWidth = 2;
                    for (let y = top + 8; y < base; y += 9 + R() * 8) { g.beginPath(); g.moveTo(x + w * 0.12 * (1 - (y - top) / h) + 2, y); g.lineTo(x + w - w * 0.18 * (1 - (y - top) / h), y); g.stroke(); }
                }
                const hz = g.createLinearGradient(0, base - H * 0.15, 0, base);
                hz.addColorStop(0, night ? "rgba(60,64,110,0)" : "rgba(246,230,192,0)"); hz.addColorStop(1, night ? "rgba(60,64,110,.35)" : "rgba(246,230,192,.55)");
                g.fillStyle = hz; g.fillRect(0, base - H * 0.15, LW, H * 0.15);
            }
            // pyramids, one big and two small, lit on the left face
            for (const [px, pw, ph] of [[0.62, 170, 110], [0.71, 90, 58], [0.55, 70, 44]]) {
                const x = px * LW, base = H * 0.6, w = pw * s, h = ph * s;
                g.fillStyle = P.pyr[0]; g.beginPath(); g.moveTo(x - w / 2, base); g.lineTo(x, base - h); g.lineTo(x + w * 0.1, base); g.fill();
                g.fillStyle = P.pyr[1]; g.beginPath(); g.moveTo(x + w * 0.1, base); g.lineTo(x, base - h); g.lineTo(x + w / 2, base); g.fill();
                g.strokeStyle = "rgba(0,0,0,.08)"; g.lineWidth = 1;
                for (let r = 1; r < 10; r++) { const y = base - (h * r) / 10, hw = (w / 2) * (1 - r / 10); g.beginPath(); g.moveTo(x - hw, y); g.lineTo(x + hw, y); g.stroke(); }
            }
        });
        // the dunes, each painted with its lit face, its shaded face, its sharp crest and wind ripples
        layers.dunes = DUNES.map(([b, a, fr, ph], i) => paint(LW, H, g => {
            const base = H * b, amp = H * a, top = x => crest(x - M, base, amp, fr, ph);
            const lg = g.createLinearGradient(0, base - amp, 0, H);
            lg.addColorStop(0, P.lit[i]); lg.addColorStop(1, P.shade[i]);
            g.fillStyle = lg;
            g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= LW; x += 5) g.lineTo(x, top(x)); g.lineTo(LW, H); g.fill();
            // the shade side: where the crest falls away to the right, a darker wedge below the ridge
            // the far side of each crest falls into shade: a darker band under the ridge wherever it slopes away,
            // deepest just under the crest and fading down the slope
            for (let x = 0; x < LW; x += 4) {
                const y0 = top(x), slope = (top(x + 4) - y0) / 4;
                if (slope <= 0) continue;
                const k2 = Math.min(1, slope * 2.2), depth = H * (0.05 + k2 * 0.08);
                const sg = g.createLinearGradient(0, y0, 0, y0 + depth);
                sg.addColorStop(0, `rgba(${night ? "10,12,40" : "120,70,30"},${(0.38 * k2).toFixed(3)})`); sg.addColorStop(1, "rgba(0,0,0,0)");
                g.fillStyle = sg; g.fillRect(x, y0, 4.5, depth);
            }
            // light along the crest only where the dune faces the sun
            g.strokeStyle = night ? "rgba(200,210,255,.22)" : "rgba(255,246,214,.55)"; g.lineWidth = 1.2;
            g.beginPath(); for (let x = 0; x <= LW; x += 5) { const up = top(x + 5) <= top(x); if (up) { g.moveTo(x, top(x)); g.lineTo(x + 5, top(x + 5)); } } g.stroke();
            g.strokeStyle = P.ripple; g.lineWidth = 1;
            for (let r = 0; r < 26 + i * 10; r++) {
                const x = R() * LW, y = top(x) + 12 + R() * (H - top(x)), len = 30 + R() * 80;
                g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + len * 0.5, y - 6, x + len, y + 2); g.stroke();
            }
            if (i === 1) {                                           // the oasis, on the second range
                const ox = LW * 0.24, oy = top(ox) + 26 * s;
                const wg = g.createLinearGradient(0, oy - 10, 0, oy + 10); wg.addColorStop(0, P.water[0]); wg.addColorStop(1, P.water[1]);
                g.fillStyle = night ? "#1e2e2a" : "#6a9a4a"; g.beginPath(); g.ellipse(ox, oy, 90 * s, 18 * s, 0, 0, TAU); g.fill();
                g.fillStyle = wg; g.beginPath(); g.ellipse(ox, oy, 70 * s, 12 * s, 0, 0, TAU); g.fill();
                g.fillStyle = "rgba(255,255,255,.25)"; g.fillRect(ox - 40 * s, oy - 2, 30 * s, 1.5);
                for (const [dx, hh, lean] of [[-60, 70, -0.15], [-35, 92, 0.08], [50, 80, 0.2], [72, 58, -0.1]]) palm(g, ox + dx * s, oy - 4, hh * s, lean, R);
                for (const [dx, col] of [[-110, night ? "#3a2e4a" : "#e8dcc2"], [110, night ? "#4a3040" : "#d6a878"]]) {
                    const tx = ox + dx * s, ty = oy + 6 * s;
                    g.fillStyle = col; g.beginPath(); g.moveTo(tx - 24 * s, ty); g.lineTo(tx, ty - 26 * s); g.lineTo(tx + 24 * s, ty); g.fill();
                    g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.moveTo(tx, ty - 26 * s); g.lineTo(tx + 24 * s, ty); g.lineTo(tx + 4 * s, ty); g.fill();
                    g.fillStyle = night ? "#ffb860" : "#5a3a2a"; g.beginPath(); g.moveTo(tx - 5 * s, ty); g.lineTo(tx, ty - 12 * s); g.lineTo(tx + 5 * s, ty); g.fill();
                }
            }
            if (i === 3) {                                           // near: saguaros, rocks, a bleached skull
                for (const fx of [0.08, 0.86, 0.94]) saguaro(g, fx * LW, top(fx * LW) + 30 * s, (80 + R() * 50) * s, R);
                for (let r = 0; r < 8; r++) { const x = R() * LW, y = top(x) + 40 * s + R() * 60 * s, rs = (8 + R() * 16) * s; g.fillStyle = night ? "#2a2c46" : "#a8865a"; g.beginPath(); g.ellipse(x, y, rs * 1.4, rs, 0, Math.PI, TAU); g.fill(); g.fillStyle = night ? "rgba(200,210,255,.12)" : "rgba(255,240,200,.45)"; g.beginPath(); g.ellipse(x - rs * 0.3, y - rs * 0.4, rs * 0.6, rs * 0.3, 0, 0, TAU); g.fill(); }
            }
        }));
        sky = null;
        stars = night ? Array.from({ length: preview ? 80 : 300 }, () => { const band = R() < 0.55, x = R() * W; return { x, y: band ? H * 0.05 + (1 - x / W) * H * 0.3 + (R() - 0.5) * H * 0.12 : R() * H * 0.55, r: R() * (band ? 1 : 1.5) + 0.3, tw: R() * TAU }; }) : [];
        caravan = Array.from({ length: preview ? 3 : 5 }, (_, i) => ({ off: -i * 46 * s, ph: i * 1.3 }));
        fire = night && !preview ? { x: W * 0.84, y: H * 0.94 } : null;
        spin = Array.from({ length: preview ? 0 : 3 }, () => ({ d: Math.floor(R() * 3), x: R() * W, ph: R() * TAU }));
    }
    function palm(g, x, y, h, lean, R) {
        g.strokeStyle = night ? "#1a1a28" : "#7a5a3a"; g.lineWidth = 5; g.lineCap = "round";
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + lean * h * 0.5, y - h * 0.6, x + lean * h, y - h); g.stroke();
        const tx = x + lean * h, ty = y - h;
        for (let i = 0; i < 7; i++) {
            const a = -Math.PI / 2 + (i - 3) * 0.55 + (R() - 0.5) * 0.2, l = h * (0.45 + R() * 0.15);
            g.strokeStyle = P.palm[i % 2]; g.lineWidth = 4;
            g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(tx + Math.cos(a) * l * 0.6, ty + Math.sin(a) * l * 0.6 - 10, tx + Math.cos(a) * l, ty + Math.sin(a) * l + l * 0.3); g.stroke();
        }
    }
    function saguaro(g, x, y, h, R) {
        const w = h * 0.16, col = night ? "#1e3a2e" : "#5a9a48", dark = night ? "#142a20" : "#3f7a34";
        const arm = (side, at, len) => { g.strokeStyle = col; g.lineWidth = w * 0.75; g.lineCap = "round"; g.beginPath(); g.moveTo(x, y - h * at); g.lineTo(x + side * w * 1.6, y - h * at); g.lineTo(x + side * w * 1.6, y - h * at - len); g.stroke(); };
        arm(-1, 0.45, h * 0.25); arm(1, 0.6, h * 0.2);
        g.fillStyle = col; g.beginPath(); g.roundRect(x - w / 2, y - h, w, h, w / 2); g.fill();
        g.fillStyle = dark; g.fillRect(x + w * 0.1, y - h + w * 0.4, w * 0.4, h - w * 0.4);
        g.strokeStyle = night ? "rgba(150,200,170,.25)" : "rgba(200,240,160,.45)"; g.lineWidth = 1;
        for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(x + i * w * 0.25, y - h + w * 0.5); g.lineTo(x + i * w * 0.25, y); g.stroke(); }
    }
    setup();

    function camel(g, x, y, t, ph, s, lamp) {
        const step = Math.sin(t * 3 + ph), c = night ? "#0c0e1c" : "#7a5236";
        g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = c; g.strokeStyle = c; g.lineWidth = 2.4; g.lineCap = "round";
        for (const [lx, d] of [[-9, 1], [-5, -1], [7, -1], [11, 1]]) { g.beginPath(); g.moveTo(lx, -6); g.lineTo(lx + step * 3 * d, 8); g.stroke(); }
        g.beginPath(); g.ellipse(1, -10, 14, 6, 0, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(-3, -16, 5, 5, 0, 0, TAU); g.ellipse(6, -15, 5, 4, 0, 0, TAU); g.fill();
        g.beginPath(); g.moveTo(14, -12); g.quadraticCurveTo(20, -18, 20, -24); g.lineWidth = 3.5; g.stroke();
        g.beginPath(); g.ellipse(22, -25, 4, 2.5, 0.2, 0, TAU); g.fill();
        g.fillRect(-2, -26, 4, 9); g.beginPath(); g.arc(0, -28, 3, 0, TAU); g.fill();  // a rider
        g.restore();
        if (lamp) Worlds.glow(g, x + 18 * s, y - 20 * s, 14 * s, "#ffc46a", 0.7 + 0.2 * Math.sin(t * 5 + ph));
    }
    return {
        resize(w, h) { W = w; H = h; setup(); },
        draw(g, t, dt, inp) {
            const s = k();
            if (!sky) { sky = g.createLinearGradient(0, 0, 0, H * 0.62); P.sky.forEach((c, i) => sky.addColorStop(i / (P.sky.length - 1), c)); }
            g.fillStyle = sky; g.fillRect(0, 0, W, H);
            const sx = W * 0.78 - inp.px * 4, sy = H * 0.2 - inp.py * 3, sr = Math.min(W, H) * (preview ? 0.09 : 0.07);
            if (night) {
                for (const st of stars) { const tw = Math.abs(Math.sin(t * 0.7 + st.tw)); g.fillStyle = `rgba(255,252,240,${(0.25 + 0.75 * tw).toFixed(2)})`; g.fillRect(st.x, st.y, st.r, st.r); if (st.r > 1.3) Worlds.twinkle(g, st.x, st.y, st.r, tw, "#fffbe8"); }
                Worlds.glow(g, sx, sy, sr * 5, "#c8d4ff", 0.4);
                const mg = g.createRadialGradient(sx - sr * 0.3, sy - sr * 0.3, sr * 0.1, sx, sy, sr);
                mg.addColorStop(0, "#fffdf0"); mg.addColorStop(1, "#cfcab4");
                g.fillStyle = mg; g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.fill();
                g.fillStyle = "rgba(150,145,120,.4)";
                for (const [dx, dy, r] of [[-0.3, -0.2, 0.2], [0.35, 0.25, 0.14], [0.05, 0.45, 0.1], [-0.4, 0.3, 0.08], [0.2, -0.45, 0.09]]) { g.beginPath(); g.arc(sx + dx * sr, sy + dy * sr, r * sr, 0, TAU); g.fill(); }
            } else {
                Worlds.glow(g, sx, sy, sr * 7, "#fff0c0", 0.55);
                Worlds.glow(g, sx, sy, sr * 2.4, "#ffffff", 0.9);
                g.fillStyle = "#fffbe6"; g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.fill();
            }
            if (!night && !preview) {                                 // vultures circling far off
                if (!birds.length) birds = Array.from({ length: 3 }, (_, i) => ({ a: i * 2.1, r: 40 + i * 14 }));
                g.strokeStyle = "rgba(40,30,30,.55)"; g.lineWidth = 1.6;
                for (const b of birds) { b.a += dt * 0.4; const x = W * 0.3 + Math.cos(b.a) * b.r * 2, y = H * 0.24 + Math.sin(b.a) * b.r * 0.5, f = Math.sin(t * 2 + b.r) * 2; g.beginPath(); g.moveTo(x - 9, y - f); g.quadraticCurveTo(x - 4, y - 3, x, y); g.quadraticCurveTo(x + 4, y - 3, x + 9, y - f); g.stroke(); }
            }
            g.drawImage(layers.far, -M - inp.px * 4, 0);
            // the dunes, back to front, with the caravan along the first crest
            layers.dunes.forEach((img, i) => {
                const px = -M - inp.px * (6 + i * 5);
                g.drawImage(img, px, 0);
                if (i === 0) {
                    const [b, a, fr, ph] = DUNES[0], cx0 = ((t * 14 + W * 0.45) % (W + 400)) - 200;
                    for (const cm of caravan) { const x = cx0 + cm.off; camel(g, x, crest(x - px - M, H * b, H * a, fr, ph) - 2, t, cm.ph, 0.9 * s, night); }
                }
                for (const sp of spin) if (sp.d === i) {                 // sand blowing off the crest
                    const [b, a, fr, ph] = DUNES[i];
                    sp.x += dt * 30; if (sp.x > W + 60) sp.x = -60;
                    const y = crest(sp.x - px - M, H * b, H * a, fr, ph);
                    g.fillStyle = night ? "rgba(190,200,240,.12)" : "rgba(255,236,190,.4)";
                    for (let j = 0; j < 14; j++) { const q = (t * 0.8 + j / 14) % 1; g.beginPath(); g.arc(sp.x + q * 60, y - q * 18 + Math.sin(q * 9 + sp.ph) * 3, 2 + q * 4, 0, TAU); g.fill(); }
                }
            });
            // a tumbleweed rolling through now and then
            nextWeed -= dt;
            if (!weed && nextWeed <= 0) weed = { x: -40, sp: U.rand(80, 130), r: U.rand(14, 22) * s, rot: 0 };
            if (weed) {
                weed.x += weed.sp * dt; weed.rot += weed.sp * dt / weed.r;
                const [b, a, fr, ph] = DUNES[3], gy = crest(weed.x + inp.px * 21, H * b, H * a, fr, ph) + 30 * s - Math.abs(Math.sin(t * 5)) * 12;
                g.save(); g.translate(weed.x, gy - weed.r); g.rotate(weed.rot); g.strokeStyle = night ? "#3a3448" : "#9a7444"; g.lineWidth = 1.2;
                for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(0, 0, weed.r, weed.r * (0.3 + (i % 3) * 0.3), (i * Math.PI) / 9, 0, TAU); g.stroke(); }
                g.restore();
                if (weed.x > W + 60) { weed = null; nextWeed = U.rand(8, 18); }
            }
            if (fire) {                                               // the campfire: flames, a glow on the sand, sparks
                const fx = fire.x - inp.px * 21, fy = fire.y;
                Worlds.glow(g, fx, fy - 10, 140 * s, "#ff8a3a", 0.35 + 0.08 * Math.sin(t * 7));
                g.fillStyle = "#3a2418"; g.fillRect(fx - 26 * s, fy - 4, 52 * s, 7); g.save(); g.translate(fx, fy); g.rotate(0.4); g.fillRect(-26 * s, -3, 52 * s, 6); g.restore();
                for (const [col, h, w] of [["#ff6a1f", 46, 22], ["#ffb43a", 34, 15], ["#fff0a0", 20, 8]]) {
                    g.fillStyle = col; g.beginPath(); g.moveTo(fx - w * s, fy);
                    g.quadraticCurveTo(fx - w * s * 0.8, fy - h * s * 0.6, fx + Math.sin(t * 9) * 4, fy - h * s * (0.9 + 0.1 * Math.sin(t * 13)));
                    g.quadraticCurveTo(fx + w * s * 0.8, fy - h * s * 0.6, fx + w * s, fy); g.fill();
                }
                if (Math.random() < dt * 10) sparks.push({ x: fx + U.rand(-8, 8), y: fy - 30 * s, vx: U.rand(-15, 15), vy: U.rand(-70, -40), life: 1.2 });
                for (const sp of sparks) { sp.life -= dt; sp.x += sp.vx * dt; sp.y += sp.vy * dt; Worlds.glow(g, sp.x, sp.y, 4, "#ffb43a", Math.max(0, sp.life)); }
                sparks = sparks.filter(sp => sp.life > 0);
            }
            if (!night) {                                             // heat shimmer low over the sand
                g.fillStyle = "rgba(255,246,220,.06)";
                for (let i = 0; i < 6; i++) { const y = H * 0.6 + i * 6 + Math.sin(t * 3 + i) * 2; g.fillRect(0, y, W, 2); }
            }
        }
    };
}
