// The secret worlds' backgrounds, part two: the Sunken Dunes and the Lava Cave (see secret-scenes-a.js).
(() => {
    const { TAU, lerp, lite, lin, rad, layer } = SecretScenes.kit;

    // =============================================================================================================
    // The Sunken Dunes: a vast desert under a huge sky (night: the milky way and an enormous moon; day: a blazing
    // sun). Dunes in layers with lit crests and shadowed faces; a colossal stone face half sunk in the sand, a tilted
    // obelisk with glowing glyphs, the ribcage of some ancient beast. And the Sandworm: now and then it breaches far
    // off, arcing out of the dunes and diving back in a cascade of sand; between times a ridge travels under the sand.
    // =============================================================================================================
    SecretScenes.dunes = function (W, H, opts) {
        const night = opts.theme === "dark", preview = !!opts.preview;
        const C = night
            ? { sky: ["#03061a", "#141238", "#3a2448", "#7a4a4a"], dune: [["#4a3a5a", "#2a2040"], ["#6a4a4a", "#3a2836"], ["#8a5e44", "#4a3028"], ["#a8744c", "#5a3a24"]], lit: "rgba(200,210,255,.22)", mesa: "#24182e",
                stone: ["#6a5a6a", "#3a2e3e"], glyph: "#7fe8ff", worm: ["#5a3a2a", "#2e1c14", "#8a5a3a"], sand: ["#a8744c", "#d9a868", "#6a4a34"], dust: "200,160,120" }
            : { sky: ["#1f5fc4", "#6aaee8", "#bfe0f2", "#ffe2a8"], dune: [["#e8b878", "#c99050"], ["#e0a860", "#b87a3a"], ["#d89850", "#a86a2a"], ["#f0b868", "#b8783a"]], lit: "rgba(255,246,210,.45)", mesa: "#c98a58",
                stone: ["#e0c49a", "#a8865c"], glyph: "#ff8a3a", worm: ["#9a6a44", "#5a3a22", "#c8945a"], sand: ["#e0b872", "#f2d39a", "#c9974f"], dust: "240,210,160" };
        let sky, stars, band, mesas, dunes, ruins, ribs, horizon, worm = null, nextWorm = preview ? 999 : 5, ridge, grains = [], streaks, devil = null, nextDevil = preview ? 999 : 9, shooters = [], nextShoot = 3;

        function crest(R, base, amp, n) {                         // a dune line: a few long swells and sharp ridges
            const k = Array.from({ length: 4 }, () => ({ f: (0.6 + R() * 2.4) * TAU / W, p: R() * TAU, a: amp * (0.3 + R() * 0.7) }));
            return Array.from({ length: n + 1 }, (_, i) => { const x = (i / n) * W * 1.2 - W * 0.1; return [x, base - k.reduce((s, q) => s + Math.abs(Math.sin(x * q.f + q.p)) * q.a, 0) * 0.7]; });
        }
        function setup() {
            const R = U.rng(9191), unit = Math.min(W, H);
            horizon = H * 0.5; sky = null;
            stars = Array.from({ length: preview ? 40 : night ? 260 : 0 }, () => ({ x: R() * W, y: R() * horizon * 1.05, r: 0.4 + R() * 1.5, ph: R() * TAU }));
            // the milky way: a soft band of light and dust across the night sky (drawn once)
            band = night ? layer(W, horizon, g => {
                g.translate(W * 0.5, horizon * 0.5); g.rotate(-0.42);
                for (let i = 0; i < (preview ? 30 : 120); i++) {
                    const x = (R() - 0.5) * W * 1.4, y = (R() - 0.5) * horizon * 0.25, r = unit * (0.04 + R() * 0.12), c = R() < 0.3 ? "200,170,255" : R() < 0.5 ? "255,220,200" : "220,230,255";
                    g.fillStyle = rad(g, x, y, 0, r, [[0, `rgba(${c},.09)`], [1, `rgba(${c},0)`]]); g.fillRect(x - r, y - r, r * 2, r * 2);
                }
                for (let i = 0; i < (preview ? 200 : 900); i++) { const x = (R() - 0.5) * W * 1.4, y = (R() - 0.5) * horizon * 0.22 * (0.4 + R()), a = R() * 0.7; g.fillStyle = `rgba(255,250,240,${a.toFixed(2)})`; g.fillRect(x, y, 1, 1); }
            }) : null;
            // flat-topped mesas on the far horizon
            mesas = layer(W * 1.2, H, g => {
                g.fillStyle = C.mesa;
                for (let x = -20; x < W * 1.2; x += unit * (0.12 + R() * 0.2)) {
                    if (R() < 0.35) continue;
                    const w = unit * (0.08 + R() * 0.16), h = H * (0.03 + R() * 0.06);
                    g.beginPath(); g.moveTo(x - w * 0.3, horizon); g.lineTo(x, horizon - h); g.lineTo(x + w, horizon - h * (0.9 + R() * 0.2)); g.lineTo(x + w * 1.3, horizon); g.closePath(); g.fill();
                }
                g.globalCompositeOperation = "source-atop";
                g.fillStyle = lin(g, 0, horizon - H * 0.1, 0, horizon, [[0, night ? "rgba(122,74,74,.5)" : "rgba(255,226,168,.6)"], [1, "rgba(0,0,0,0)"]]);
                g.fillRect(0, 0, W * 1.2, H);
            });
            // four layers of dunes, far to near, each with its sunlit side and its shadow side
            dunes = [0, 1, 2, 3].map(i => {
                const base = lerp(horizon + H * 0.03, H * 0.86, i / 3), amp = H * lerp(0.05, 0.14, i / 3), pts = crest(R, base, amp, 60);
                const img = layer(W * 1.2, H, g => {
                    g.translate(W * 0.1, 0);
                    const path = new Path2D(); path.moveTo(pts[0][0], H); pts.forEach(([x, y]) => path.lineTo(x, y)); path.lineTo(pts[pts.length - 1][0], H); path.closePath();
                    g.fillStyle = lin(g, 0, base - amp, 0, H, [[0, C.dune[i][0]], [1, C.dune[i][1]]]); g.fill(path);
                    // the shadow side of each ridge (the light comes from the left)
                    g.save(); g.clip(path);
                    g.fillStyle = night ? "rgba(10,6,30,.35)" : "rgba(120,60,20,.28)";
                    for (let j = 1; j < pts.length - 1; j++) {
                        const [x0, y0] = pts[j], [x1, y1] = pts[j + 1];
                        if (y1 > y0) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineTo(x1 + (x1 - x0) * 0.6, H); g.lineTo(x0 + (x1 - x0) * 0.3, H); g.closePath(); g.fill(); }
                    }
                    // wind ripples across the sand
                    g.strokeStyle = night ? "rgba(255,255,255,.05)" : "rgba(120,70,20,.14)"; g.lineWidth = 1;
                    for (let k = 0; k < 40; k++) { const x = R() * W * 1.2, y = base - amp * R() + H * 0.05 * (i + 1) * R(), w = unit * (0.04 + R() * 0.1); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 3, x + w, y); g.stroke(); }
                    g.restore();
                    // the lit crest line
                    g.strokeStyle = C.lit; g.lineWidth = 2; g.beginPath(); pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
                });
                return { img, pts, z: 0.3 + i * 0.25 };
            });
            // the colossal half-buried face, the tilted obelisk, the ribcage (each drawn once, set into the dunes)
            const fs = unit * 0.2;
            ruins = {
                face: layer(fs * 2.4, fs * 2, g => {
                    g.translate(fs * 1.2, fs * 1.4);
                    g.fillStyle = lin(g, -fs, 0, fs, 0, [[0, C.stone[1]], [0.4, C.stone[0]], [1, C.stone[1]]]);
                    g.beginPath(); g.moveTo(-fs * 1.1, fs * 0.6); g.lineTo(-fs * 1.1, -fs * 0.6); g.quadraticCurveTo(-fs, -fs * 1.3, 0, -fs * 1.35); g.quadraticCurveTo(fs, -fs * 1.3, fs * 1.1, -fs * 0.6); g.lineTo(fs * 1.1, fs * 0.6); g.closePath(); g.fill();
                    g.fillStyle = "rgba(0,0,0,.18)"; for (let i = 0; i < 7; i++) g.fillRect(-fs * 1.1, -fs * 0.6 + i * fs * 0.17, fs * 0.32, fs * 0.08), g.fillRect(fs * 0.78, -fs * 0.6 + i * fs * 0.17, fs * 0.32, fs * 0.08);
                    g.fillStyle = C.stone[0]; g.beginPath(); g.ellipse(0, -fs * 0.15, fs * 0.62, fs * 0.8, 0, 0, TAU); g.fill();
                    g.strokeStyle = "rgba(0,0,0,.45)"; g.lineWidth = fs * 0.04; g.lineCap = "round";
                    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * fs * 0.42, -fs * 0.32); g.quadraticCurveTo(s * fs * 0.25, -fs * 0.22, s * fs * 0.08, -fs * 0.3); g.stroke(); }    // closed eyes
                    g.beginPath(); g.moveTo(0, -fs * 0.2); g.lineTo(-fs * 0.06, fs * 0.12); g.lineTo(fs * 0.06, fs * 0.14); g.stroke();
                    g.beginPath(); g.moveTo(-fs * 0.18, fs * 0.32); g.quadraticCurveTo(0, fs * 0.38, fs * 0.18, fs * 0.32); g.stroke();
                    g.strokeStyle = "rgba(0,0,0,.3)"; g.lineWidth = 2; g.beginPath(); g.moveTo(fs * 0.3, -fs * 0.9); g.lineTo(fs * 0.12, -fs * 0.5); g.lineTo(fs * 0.25, -fs * 0.2); g.stroke();   // a crack
                }),
                obelisk: layer(fs * 0.6, fs * 2.8, g => {
                    const w = fs * 0.4, h = fs * 2.5;
                    g.translate(fs * 0.3, fs * 2.7);
                    g.fillStyle = lin(g, -w / 2, 0, w / 2, 0, [[0, C.stone[0]], [1, C.stone[1]]]);
                    g.beginPath(); g.moveTo(-w / 2, 0); g.lineTo(-w * 0.38, -h); g.lineTo(0, -h - w * 0.4); g.lineTo(w * 0.38, -h); g.lineTo(w / 2, 0); g.closePath(); g.fill();
                }),
                ribs: layer(unit * 0.7, unit * 0.4, g => {
                    const w = unit * 0.7, h = unit * 0.4;
                    g.strokeStyle = night ? "#c8b8a8" : "#f6ecd8"; g.lineCap = "round";
                    g.lineWidth = unit * 0.012; g.beginPath(); g.moveTo(w * 0.05, h * 0.92); g.quadraticCurveTo(w * 0.5, h * 0.82, w * 0.95, h * 0.95); g.stroke();   // the spine
                    for (let i = 0; i < 8; i++) {
                        const x = w * (0.1 + i * 0.11), top = h * (0.12 + Math.abs(i - 3.5) * 0.06);
                        g.lineWidth = unit * (0.01 - i * 0.0005);
                        g.beginPath(); g.moveTo(x, h * 0.9); g.quadraticCurveTo(x - w * 0.08, top, x + w * 0.03, top * 0.9); g.stroke();
                    }
                    g.fillStyle = night ? "#c8b8a8" : "#f6ecd8"; g.beginPath(); g.ellipse(w * 0.96, h * 0.86, w * 0.06, h * 0.08, 0.3, 0, TAU); g.fill();
                })
            };
            ridge = { x: -0.1, sp: 0.03 + R() * 0.02 };
            streaks = Array.from({ length: preview ? 6 : lite() ? 14 : 30 }, () => ({ x: R() * W, y: horizon + R() * (H - horizon), l: 30 + R() * 90, v: 160 + R() * 220, a: 0.1 + R() * 0.2 }));
        }
        setup();
        function crestAt(d, x) { const pts = dunes[d].pts, u = (x + W * 0.1) / (W * 1.2) * (pts.length - 1), i = Math.max(0, Math.min(pts.length - 2, Math.floor(u))), k = u - i; return lerp(pts[i][1], pts[i + 1][1], k); }
        function dust(x, y, n, up = 160, spread = 60) {
            for (let i = 0; i < n; i++) grains.push({ x: x + (Math.random() - 0.5) * spread, y, vx: (Math.random() - 0.5) * 80, vy: -Math.random() * up, life: 1 + Math.random() * 1.6, age: 0, s: 1 + Math.random() * 2.5, puff: Math.random() < 0.3 });
        }

        return {
            resize(w, h) { W = w; H = h; setup(); },
            draw(g, t, dt, inp) {
                const px = inp.px || 0, py = inp.py || 0, unit = Math.min(W, H);
                if (!sky) sky = lin(g, 0, 0, 0, horizon * 1.05, [[0, C.sky[0]], [0.45, C.sky[1]], [0.8, C.sky[2]], [1, C.sky[3]]]);
                g.fillStyle = sky; g.fillRect(0, 0, W, H);
                if (night) {
                    g.drawImage(band, -px * 4, -py * 3);
                    for (const s of stars) { const tw = 0.3 + 0.7 * Math.abs(Math.sin(t * 0.7 + s.ph)); g.fillStyle = `rgba(255,248,235,${tw.toFixed(2)})`; g.fillRect(s.x - px * 4, s.y - py * 3, s.r, s.r); if (s.r > 1.5) Worlds.twinkle(g, s.x - px * 4, s.y - py * 3, s.r, tw, "rgb(255,240,220)"); }
                    // the moon, huge and low, with its halo
                    const mx = W * 0.22 - px * 6, my = horizon * 0.42 - py * 4, mr = unit * 0.11;
                    Worlds.glow(g, mx, my, mr * 4, "#cfd8ff", 0.35); Worlds.glow(g, mx, my, mr * 1.8, "#f0f2ff", 0.5);
                    g.fillStyle = rad(g, mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mr, [[0, "#fffdf4"], [1, "#d8d6e8"]]); g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill();
                    g.fillStyle = "rgba(150,150,180,.35)"; for (const [cx, cy, cr] of [[-0.3, -0.2, 0.18], [0.25, 0.1, 0.24], [-0.1, 0.4, 0.12], [0.4, -0.35, 0.1]]) { g.beginPath(); g.arc(mx + cx * mr, my + cy * mr, cr * mr, 0, TAU); g.fill(); }
                    nextShoot -= dt;
                    if (!preview && nextShoot <= 0) { shooters.push({ x: W * U.rand(0.3, 1), y: horizon * U.rand(0, 0.4), age: 0 }); nextShoot = U.rand(4, 9); }
                    shooters = shooters.filter(s => { s.age += dt; const k = 1 - s.age / 1.1, x = s.x - s.age * 520, y = s.y + s.age * 200; g.strokeStyle = `rgba(255,250,230,${Math.max(0, k).toFixed(2)})`; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 90, y - 35); g.stroke(); return s.age < 1.1; });
                } else {
                    // the sun, blazing, with a slow corona
                    const sx = W * 0.72 - px * 6, sy = horizon * 0.35 - py * 4, sr = unit * 0.07;
                    Worlds.glow(g, sx, sy, sr * 9, "#fff2c0", 0.55); Worlds.glow(g, sx, sy, sr * 3.5, "#ffffff", 0.75);
                    g.save(); g.globalCompositeOperation = "lighter"; g.translate(sx, sy); g.rotate(t * 0.04);
                    for (let i = 0; i < 16; i++) { g.rotate(TAU / 16); g.fillStyle = `rgba(255,240,190,${(0.05 + 0.03 * Math.sin(t + i)).toFixed(3)})`; g.beginPath(); g.moveTo(0, -sr); g.lineTo(sr * 0.25, -sr * 5.5); g.lineTo(-sr * 0.25, -sr * 5.5); g.closePath(); g.fill(); }
                    g.restore();
                    g.fillStyle = "#fffdf0"; g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.fill();
                }
                g.drawImage(mesas, -W * 0.1 - px * 5, -py * 3);
                // dunes far to near; the worm breaches between the first and second; the ruins set into them
                const off = d => [-W * 0.1 - px * 30 * dunes[d].z, -py * 10 * dunes[d].z];
                g.drawImage(dunes[0].img, ...off(0));
                // ---- the Sandworm ----
                nextWorm -= dt;
                if (!worm && nextWorm <= 0) {
                    const x = W * U.rand(0.25, 0.75), span = unit * U.rand(0.35, 0.5);
                    worm = { age: 0, life: 7.5, ax: x - span / 2, bx: x + span / 2, top: H * U.rand(0.12, 0.2), r: unit * U.rand(0.045, 0.06), dir: Math.random() < 0.5 ? 1 : -1, warned: false };
                }
                if (worm) {
                    const w = worm; w.age += dt;
                    const ox = -px * 30 * dunes[1].z, oy = -py * 10 * dunes[1].z, ground = x => crestAt(1, x) + 6;
                    const head = w.age / (w.life * 0.62), len = 0.55;                      // how far along the arc its head is, and its length (of the arc)
                    const along = u => { const x = w.dir > 0 ? lerp(w.ax, w.bx, u) : lerp(w.bx, w.ax, u), gy = ground(x); return [x + ox, lerp(gy, w.top, Math.sin(Math.PI * Math.min(1, Math.max(0, u)))) + oy + (u < 0 || u > 1 ? Math.abs(u < 0 ? u : u - 1) * w.r * 6 : 0)]; };
                    if (w.age < 0.9) { const [x, y] = along(0); if (Math.random() < 0.6) dust(x, y, 3, 120, w.r * 2); }     // the sand boils where it will come up
                    const n = 30;
                    g.save();
                    for (let i = n; i >= 0; i--) {
                        const u = head - (i / n) * len;
                        if (u < -0.02 || u > 1.02) continue;
                        const [x, y] = along(u), gy = ground(w.dir > 0 ? lerp(w.ax, w.bx, u) : lerp(w.bx, w.ax, u)) + oy;
                        if (y > gy) continue;
                        const r = w.r * (i === 0 ? 1.05 : 0.85 + 0.15 * Math.sin(i * 0.9)) * (1 - (i / n) * 0.25);
                        g.fillStyle = i % 2 ? C.worm[0] : C.worm[1];
                        g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
                        g.strokeStyle = C.worm[2]; g.lineWidth = r * 0.12; g.beginPath(); g.arc(x, y, r * 0.85, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
                        if (i === 0) {                                                // its maw, ringed with teeth, facing the way it's going
                            const [x2, y2] = along(u + 0.02), a = Math.atan2(y2 - y, x2 - x);
                            g.save(); g.translate(x, y); g.rotate(a);
                            g.fillStyle = "#1a0804"; g.beginPath(); g.ellipse(r * 0.5, 0, r * 0.45, r * 0.8, 0, 0, TAU); g.fill();
                            g.fillStyle = "#f3e6cc";
                            for (let k = 0; k < 10; k++) { const ta = (k / 10) * TAU; g.beginPath(); g.moveTo(r * 0.5 + Math.cos(ta) * r * 0.42, Math.sin(ta) * r * 0.76); g.lineTo(r * 0.5 + Math.cos(ta) * r * 0.2, Math.sin(ta) * r * 0.4); g.lineTo(r * 0.5 + Math.cos(ta + 0.3) * r * 0.42, Math.sin(ta + 0.3) * r * 0.76); g.fill(); }
                            g.restore();
                        }
                        if (Math.random() < 0.08) grains.push({ x, y: y + r * 0.6, vx: (Math.random() - 0.5) * 30, vy: 0, life: 1.2, age: 0, s: 1.5 + Math.random() * 2, fall: true });
                    }
                    g.restore();
                    const [ex, ey] = along(0), [dx, dy] = along(1);
                    if (head > 0 && head - len < 0.05 && Math.random() < 0.5) dust(ex, ey, 2, 180, w.r * 2);
                    if (head > 0.95 && head - len < 1 && Math.random() < 0.6) dust(dx, dy, 3, 220, w.r * 2.4);
                    if (head - len > 1.05) { worm = null; nextWorm = U.rand(14, 22); }      // gone once its tail is under the sand
                }
                g.drawImage(dunes[1].img, ...off(1));
                const [o1x, o1y] = off(1), [o2x, o2y] = off(2);
                g.drawImage(ruins.ribs, W * 0.62 + o1x + W * 0.1, crestAt(1, W * 0.7) - ruins.ribs.height * 0.85 + o1y + 10);
                // the obelisk, its glyphs glowing (night) or glinting (day)
                const obx = W * 0.14 + o2x + W * 0.1, oby = crestAt(2, W * 0.2) - ruins.obelisk.height * 0.88 + o2y;
                g.save(); g.translate(obx + ruins.obelisk.width / 2, oby + ruins.obelisk.height); g.rotate(-0.12);
                g.drawImage(ruins.obelisk, -ruins.obelisk.width / 2, -ruins.obelisk.height);
                const gl = 0.45 + 0.4 * Math.sin(t * 1.1);
                for (let i = 0; i < 7; i++) { const yy = -ruins.obelisk.height * (0.25 + i * 0.09), sz = ruins.obelisk.width * 0.16; if (night) Worlds.glow(g, 0, yy, sz * 2.5, C.glyph, gl * 0.6); g.fillStyle = night ? C.glyph : "rgba(90,50,20,.6)"; g.globalAlpha = night ? gl : 0.8; g.fillRect(-sz / 2, yy - sz / 2, sz, sz * (i % 3 ? 1 : 0.4)); g.globalAlpha = 1; }
                g.restore();
                g.drawImage(dunes[2].img, ...off(2));
                g.drawImage(ruins.face, W * 0.58 + o2x + W * 0.1 - ruins.face.width / 2, crestAt(2, W * 0.62) - ruins.face.height * 0.6 + o2y + 20);
                // a ridge travelling under the near sand: the worm between breaches
                ridge.x += ridge.sp * dt; if (ridge.x > 1.15) ridge.x = -0.15;
                const [o3x, o3y] = off(3), rx = ridge.x * W, ry = crestAt(3, rx) + o3y;
                g.drawImage(dunes[3].img, o3x, o3y);
                g.fillStyle = C.dune[3][0];
                g.beginPath(); g.ellipse(rx + o3x + W * 0.1, ry + 4, unit * 0.09, unit * 0.022, 0, Math.PI, TAU); g.fill();
                if (Math.random() < 0.5) dust(rx + o3x + W * 0.1 - unit * 0.06, ry, 1, 60, 20);
                // grains: dust thrown up by the worm, and sand pouring off its back
                g.fillStyle = `rgba(${C.dust},.8)`;
                grains = grains.filter(p => {
                    p.age += dt; p.vy += (p.fall ? 300 : 120) * dt; p.x += p.vx * dt; p.y += p.vy * dt;
                    const k = 1 - p.age / p.life;
                    if (p.puff) { g.globalAlpha = 0.25 * k; g.beginPath(); g.arc(p.x, p.y, p.s * 6 * (1 + p.age), 0, TAU); g.fill(); }
                    else { g.globalAlpha = k; g.fillRect(p.x, p.y, p.s, p.s); }
                    return p.age < p.life;
                }).slice(-500);
                g.globalAlpha = 1;
                // wind blowing sand across the dunes, and a dust devil now and then
                g.lineCap = "round";
                for (const s of streaks) {
                    s.x += s.v * dt; if (s.x > W + s.l) { s.x = -s.l; s.y = horizon + Math.random() * (H - horizon); }
                    g.strokeStyle = `rgba(${C.dust},${s.a.toFixed(2)})`; g.lineWidth = 1.2; g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(s.x - s.l, s.y + 3); g.stroke();
                }
                nextDevil -= dt;
                if (!devil && nextDevil <= 0) devil = { x: -60, y: H * U.rand(0.62, 0.8), age: 0 };
                if (devil) {
                    devil.age += dt; devil.x += 70 * dt;
                    for (let i = 0; i < 26; i++) {
                        const u = i / 26, a = t * 8 + i * 0.7, r = lerp(6, 40, u), y = devil.y - u * H * 0.22, x = devil.x + Math.sin(t * 2 + u * 3) * 10 + Math.cos(a) * r;
                        g.fillStyle = `rgba(${C.dust},${(0.35 * (1 - u * 0.5)).toFixed(2)})`; g.beginPath(); g.arc(x, y, 2 + u * 3, 0, TAU); g.fill();
                    }
                    if (devil.x > W + 80) { devil = null; nextDevil = U.rand(12, 20); }
                }
            }
        };
    };

    // =============================================================================================================
    // The Lava Cave: a vast cavern under the volcano. The skull of some ancient beast carved into the far wall (its
    // eyes burn), magma veins pulsing through the rock, stalactites in layers, two lavafalls pouring into a lava lake
    // (crust drifting on it, cracks of light, bubbles bursting), giant crystals glowing, a stone bridge hung with
    // chains, embers rising and ash drifting down.
    // =============================================================================================================
    SecretScenes.cave = function (W, H, opts) {
        const night = opts.theme === "dark", preview = !!opts.preview;
        const C = night
            ? { bg: ["#060202", "#1c0705", "#4a1206"], rock: ["#2a1a18", "#1a0e0c", "#3a2420"], vein: "255,110,30", lava: ["#ff5a1f", "#ffb02e", "#fff1a0", "#8a1e08"], crust: "rgba(30,12,8,.92)", crystal: ["#9a7dff", "#c3a0ff"], ash: "180,170,170" }
            : { bg: ["#e8b888", "#f0c49a", "#ffb070"], rock: ["#e0a878", "#c88a5c", "#f2c49a"], vein: "255,150,60", lava: ["#ff6a1f", "#ffc04e", "#fff6c0", "#b83010"], crust: "rgba(120,60,30,.8)", crystal: ["#b89aff", "#dcc8ff"], ash: "150,110,90" };
        let bg, wall, veins, skull, tites, mites, bridge, crystals, falls, crusts, bubbles = [], embers, ash, drips = [], lakeY;

        function setup() {
            const R = U.rng(5353), unit = Math.min(W, H);
            bg = null; lakeY = H * 0.8;
            // the far wall: rock in strata, the beast's skull carved in it, and the magma veins (kept as paths to pulse)
            veins = [];
            for (let i = 0; i < (preview ? 4 : 10); i++) {
                let x = R() * W, y = R() * lakeY * 0.9; const p = new Path2D(); p.moveTo(x, y);
                for (let k = 0; k < 6; k++) { const cx = x + (R() - 0.5) * unit * 0.1, cy = y + unit * 0.03; x += (R() - 0.5) * unit * 0.08; y += unit * (0.03 + R() * 0.05); p.quadraticCurveTo(cx, cy, x, y); }
                veins.push({ p, ph: R() * TAU, w: 0.8 + R() * 1.6 });
            }
            const sx = W * 0.5, sy = H * 0.36, ss = unit * 0.24;
            skull = { x: sx, y: sy, s: ss };
            wall = layer(W * 1.1, H, g => {
                g.translate(W * 0.05, 0);
                for (let i = 0; i < 14; i++) {                                    // strata
                    const y = H * (i / 14), h = H / 14 + 4;
                    g.fillStyle = i % 2 ? C.rock[0] : C.rock[1]; g.globalAlpha = 0.55;
                    g.beginPath(); g.moveTo(-W * 0.05, y); for (let x = -W * 0.05; x <= W * 1.05; x += 30) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 10 + (R() - 0.5) * 6); g.lineTo(W * 1.05, y + h); g.lineTo(-W * 0.05, y + h); g.closePath(); g.fill();
                }
                g.globalAlpha = 1;
                g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 2;
                for (let i = 0; i < 50; i++) { const x = R() * W, y = R() * H; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 40, y + R() * 30); g.lineTo(x + (R() - 0.5) * 50, y + R() * 50); g.stroke(); }
                // the skull carved in the rock: brow, horns, cheekbones, teeth
                g.save(); g.translate(sx, sy);
                g.fillStyle = C.rock[2]; g.strokeStyle = "rgba(0,0,0,.55)"; g.lineWidth = ss * 0.03;
                for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * ss * 0.55, -ss * 0.45); g.quadraticCurveTo(s * ss * 1.25, -ss * 0.9, s * ss * 1.1, -ss * 1.45); g.quadraticCurveTo(s * ss * 0.95, -ss * 0.85, s * ss * 0.4, -ss * 0.55); g.closePath(); g.fill(); g.stroke(); }
                g.beginPath(); g.moveTo(-ss * 0.75, -ss * 0.3); g.quadraticCurveTo(-ss * 0.8, -ss * 0.85, 0, -ss * 0.9); g.quadraticCurveTo(ss * 0.8, -ss * 0.85, ss * 0.75, -ss * 0.3); g.lineTo(ss * 0.6, ss * 0.35); g.lineTo(ss * 0.35, ss * 0.8); g.lineTo(-ss * 0.35, ss * 0.8); g.lineTo(-ss * 0.6, ss * 0.35); g.closePath(); g.fill(); g.stroke();
                g.fillStyle = "#0a0302";
                for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * ss * 0.12, -ss * 0.38); g.lineTo(s * ss * 0.55, -ss * 0.48); g.lineTo(s * ss * 0.5, -ss * 0.12); g.lineTo(s * ss * 0.16, -ss * 0.08); g.closePath(); g.fill(); }
                g.beginPath(); g.moveTo(-ss * 0.08, ss * 0.05); g.lineTo(0, ss * 0.22); g.lineTo(ss * 0.08, ss * 0.05); g.fill();
                g.fillRect(-ss * 0.32, ss * 0.42, ss * 0.64, ss * 0.28);
                g.fillStyle = C.rock[2]; for (let i = 0; i < 6; i++) { const x = -ss * 0.3 + i * ss * 0.12; g.beginPath(); g.moveTo(x, ss * 0.42); g.lineTo(x + ss * 0.05, ss * 0.6); g.lineTo(x + ss * 0.1, ss * 0.42); g.fill(); }
                g.restore();
                // darker towards the top
                g.fillStyle = lin(g, 0, 0, 0, H, [[0, night ? "rgba(0,0,0,.55)" : "rgba(90,40,10,.18)"], [0.5, night ? "rgba(0,0,0,.1)" : "rgba(0,0,0,0)"], [1, "rgba(0,0,0,0)"]]); g.fillRect(-W * 0.05, 0, W * 1.1, H);
            });
            // stalactites hanging in two layers, and stalagmites
            const spikes = (n, maxH, color, top) => layer(W * 1.2, H, g => {
                g.fillStyle = color;
                for (let i = 0; i < n; i++) {
                    const x = R() * W * 1.2, w = unit * (0.015 + R() * 0.05), h = maxH * (0.3 + R() * 0.7);
                    g.beginPath();
                    if (top) { g.moveTo(x - w, 0); g.quadraticCurveTo(x - w * 0.3, h * 0.6, x, h); g.quadraticCurveTo(x + w * 0.3, h * 0.6, x + w, 0); }
                    else { g.moveTo(x - w, H); g.quadraticCurveTo(x - w * 0.3, H - h * 0.6, x, H - h); g.quadraticCurveTo(x + w * 0.3, H - h * 0.6, x + w, H); }
                    g.fill();
                }
                if (top) { g.fillStyle = color; g.fillRect(0, 0, W * 1.2, H * 0.03); }
            });
            tites = [spikes(preview ? 10 : 40, H * 0.22, night ? "#120806" : "#c88a5c", true), spikes(preview ? 8 : 22, H * 0.32, night ? "#080302" : "#a86e44", true)];
            tites.drops = Array.from({ length: 8 }, () => ({ x: R() * W, y: H * (0.1 + R() * 0.15) }));
            mites = spikes(preview ? 6 : 14, H * 0.25, night ? "#0a0403" : "#a86e44", false);
            // the stone bridge across the cavern, chains hanging from it
            bridge = layer(W, H * 0.3, g => {
                const h = H * 0.3, y = h * 0.35;
                g.fillStyle = night ? "#140806" : "#9a643c";
                g.beginPath(); g.moveTo(0, y); g.quadraticCurveTo(W / 2, y - h * 0.18, W, y); g.lineTo(W, y + h * 0.08); g.quadraticCurveTo(W / 2, y - h * 0.1, 0, y + h * 0.08); g.closePath(); g.fill();
                for (const x of [W * 0.06, W * 0.94]) { g.beginPath(); g.moveTo(x - 20, h); g.lineTo(x - 12, y); g.lineTo(x + 12, y); g.lineTo(x + 20, h); g.fill(); }
                for (let x = W * 0.08; x < W * 0.92; x += W * 0.04) { const yy = y - h * 0.18 * Math.sin(Math.PI * x / W) * 0.9; g.fillRect(x, yy - h * 0.06, 4, h * 0.06); }
            });
            bridge.chains = Array.from({ length: 6 }, (_, i) => ({ x: W * (0.15 + i * 0.14), len: H * (0.06 + R() * 0.1), ph: R() * TAU }));
            crystals = [[W * 0.06, lakeY - 6, unit * 0.12], [W * 0.95, lakeY - 4, unit * 0.15], [W * 0.82, lakeY + 4, unit * 0.07]].map(([x, y, s]) => ({ x, y, s, img: layer(s * 2.2, s * 2.2, g => {
                g.translate(s * 1.1, s * 2);
                for (let i = 0; i < 6; i++) {
                    const a = -Math.PI / 2 + (i - 2.5) * 0.28 + (R() - 0.5) * 0.2, l = s * (0.6 + R() * 0.9), w = s * (0.12 + R() * 0.1);
                    g.save(); g.rotate(a + Math.PI / 2);
                    g.fillStyle = lin(g, -w, 0, w, 0, [[0, C.crystal[0]], [0.5, C.crystal[1]], [1, "#4a2e8a"]]);
                    g.beginPath(); g.moveTo(-w, 0); g.lineTo(-w, -l * 0.8); g.lineTo(0, -l); g.lineTo(w, -l * 0.8); g.lineTo(w, 0); g.closePath(); g.fill();
                    g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(-w * 0.6, -l * 0.75, w * 0.3, l * 0.6);
                    g.restore();
                }
            }) }));
            falls = [{ x: W * 0.2, top: H * 0.22, w: unit * 0.05 }, { x: W * 0.78, top: H * 0.3, w: unit * 0.04 }];
            crusts = Array.from({ length: preview ? 8 : 22 }, () => ({ x: R() * W * 1.2, y: lakeY + R() * (H - lakeY), w: unit * (0.04 + R() * 0.08), h: unit * (0.01 + R() * 0.015), v: 6 + R() * 10, ph: R() * TAU }));
            embers = Array.from({ length: preview ? 14 : lite() ? 30 : 70 }, () => ({ x: R() * W, y: R() * H, v: 20 + R() * 50, s: 1 + R() * 2.2, ph: R() * TAU }));
            ash = Array.from({ length: preview ? 10 : lite() ? 20 : 50 }, () => ({ x: R() * W, y: R() * H, v: 8 + R() * 14, s: 1 + R() * 2, ph: R() * TAU }));
        }
        setup();

        return {
            resize(w, h) { W = w; H = h; setup(); },
            draw(g, t, dt, inp) {
                const px = inp.px || 0, py = inp.py || 0, unit = Math.min(W, H), pulse = 0.7 + 0.3 * Math.sin(t * 1.2);
                if (!bg) bg = lin(g, 0, 0, 0, H, [[0, C.bg[0]], [0.6, C.bg[1]], [1, C.bg[2]]]);
                g.fillStyle = bg; g.fillRect(0, 0, W, H);
                g.drawImage(wall, -W * 0.05 - px * 6, -py * 4);
                // magma veins pulsing through the rock
                g.save(); g.translate(-px * 6, -py * 4); g.globalCompositeOperation = "lighter"; g.lineJoin = "round"; g.lineCap = "round";
                for (const v of veins) {
                    const k = 0.5 + 0.5 * Math.sin(t * 1.4 + v.ph);
                    g.strokeStyle = `rgba(${C.vein},${(0.06 + 0.1 * k).toFixed(3)})`; g.lineWidth = v.w * 5; g.stroke(v.p);
                    g.strokeStyle = `rgba(255,200,120,${(0.12 + 0.22 * k).toFixed(3)})`; g.lineWidth = v.w; g.stroke(v.p);
                }
                g.restore();
                // the skull's eyes burn
                for (const s of [-1, 1]) {
                    const x = skull.x + s * skull.s * 0.33 - px * 6, y = skull.y - skull.s * 0.28 - py * 4, k = pulse * (0.85 + 0.15 * Math.sin(t * 7 + s));
                    Worlds.glow(g, x, y, skull.s * 0.5, "#ff6a1f", 0.7 * k); Worlds.glow(g, x, y, skull.s * 0.18, "#fff1a0", 0.9 * k);
                }
                g.drawImage(tites[0], -W * 0.1 - px * 10, -py * 5);
                // the lavafalls: bright streams pouring down, streaks running in them, spray at the bottom
                for (const f of falls) {
                    const x = f.x - px * 12, top = f.top - py * 6;
                    Worlds.glow(g, x, (top + lakeY) / 2, f.w * 4, "#ff6a1f", 0.45);
                    g.fillStyle = lin(g, 0, top, 0, lakeY, [[0, C.lava[1]], [0.5, C.lava[0]], [1, C.lava[1]]]);
                    g.beginPath(); g.moveTo(x - f.w * 0.4, top); g.quadraticCurveTo(x - f.w * 0.7, (top + lakeY) / 2, x - f.w * 0.6, lakeY); g.lineTo(x + f.w * 0.6, lakeY); g.quadraticCurveTo(x + f.w * 0.7, (top + lakeY) / 2, x + f.w * 0.4, top); g.closePath(); g.fill();
                    g.strokeStyle = "rgba(255,246,200,.7)"; g.lineWidth = 2;
                    for (let i = 0; i < 4; i++) { const yy = top + ((t * 220 + i * 90) % (lakeY - top)); g.beginPath(); g.moveTo(x + (i - 1.5) * f.w * 0.25, yy); g.lineTo(x + (i - 1.5) * f.w * 0.28, yy + 30); g.stroke(); }
                    g.fillStyle = "#3a1a10"; g.beginPath(); g.ellipse(x, top, f.w, f.w * 0.3, 0, 0, TAU); g.fill();
                    if (Math.random() < 0.5) embers.push({ x: x + (Math.random() - 0.5) * f.w, y: lakeY, v: 60 + Math.random() * 80, s: 1.5 + Math.random() * 2, ph: Math.random() * TAU, splash: true });
                }
                // the bridge and its chains
                g.drawImage(bridge, -px * 14, H * 0.44 - py * 7);
                g.strokeStyle = night ? "#2a1a14" : "#5a3a2a"; g.lineWidth = 2.5;
                for (const c of bridge.chains) {
                    const x = c.x - px * 14, y0 = H * 0.44 + bridge.height * 0.35 - H * 0.3 * 0.18 * Math.sin(Math.PI * c.x / W) * 0.9 - py * 7 + bridge.height * 0.06, sw = Math.sin(t * 0.8 + c.ph) * 5;
                    for (let k = 0; k < c.len; k += 8) { g.beginPath(); g.ellipse(x + sw * k / c.len, y0 + k, 3, 4.5, 0, 0, TAU); g.stroke(); }
                }
                g.drawImage(tites[1], -W * 0.1 - px * 18, -py * 8);
                // glowing drips falling from the stalactites
                if (!preview && drips.length < 5 && Math.random() < dt * 0.8) { const d = U.pick(tites.drops); drips.push({ x: d.x, y: d.y, v: 0 }); }
                drips = drips.filter(d => { d.v += 600 * dt; d.y += d.v * dt; Worlds.glow(g, d.x - px * 14, d.y, 8, "#ff8a1f", 0.8); g.fillStyle = "#ffe08a"; g.fillRect(d.x - px * 14 - 1, d.y - 3, 2, 5); return d.y < lakeY; });
                // the lava lake: its glow, the flow, the crust drifting on it with cracks of light between
                const ly = lakeY - py * 10;
                g.fillStyle = rad(g, W / 2, ly + 40, 0, W * 0.8, [[0, `rgba(${C.vein},.35)`], [1, `rgba(${C.vein},0)`]]); g.fillRect(0, ly - H * 0.35, W, H * 0.35);
                g.fillStyle = lin(g, 0, ly, 0, H, [[0, C.lava[2]], [0.15, C.lava[1]], [0.6, C.lava[0]], [1, C.lava[3]]]); g.fillRect(0, ly, W, H - ly);
                for (const c of crusts) {
                    c.x += c.v * dt; if (c.x > W * 1.15) c.x = -W * 0.1;
                    const x = c.x - px * 22, y = c.y - py * 10 + Math.sin(t + c.ph) * 2;
                    g.fillStyle = C.crust;
                    g.beginPath(); g.moveTo(x - c.w, y); g.lineTo(x - c.w * 0.4, y - c.h); g.lineTo(x + c.w * 0.6, y - c.h * 0.8); g.lineTo(x + c.w, y + c.h * 0.2); g.lineTo(x + c.w * 0.2, y + c.h); g.lineTo(x - c.w * 0.7, y + c.h * 0.8); g.closePath(); g.fill();
                    g.strokeStyle = `rgba(255,240,180,${(0.4 + 0.3 * Math.sin(t * 2 + c.ph)).toFixed(2)})`; g.lineWidth = 1; g.stroke();
                }
                // bubbles swelling and bursting
                if (!preview && bubbles.length < 6 && Math.random() < dt * 1.5) bubbles.push({ x: Math.random() * W, y: ly + Math.random() * (H - ly) * 0.6 + 8, age: 0, life: 1 + Math.random() });
                bubbles = bubbles.filter(b => {
                    b.age += dt; const k = b.age / b.life, x = b.x - px * 22;
                    if (k < 1) { g.fillStyle = C.lava[1]; g.beginPath(); g.arc(x, b.y, 3 + k * 9, Math.PI, TAU); g.fill(); g.fillStyle = "rgba(255,250,220,.6)"; g.fillRect(x - 3, b.y - 6 - k * 6, 2, 2); return true; }
                    for (let i = 0; i < 6; i++) embers.push({ x, y: b.y - 6, v: 80 + Math.random() * 120, s: 1.5 + Math.random() * 2, ph: Math.random() * TAU, splash: true, vx: (Math.random() - 0.5) * 120 });
                    return false;
                });
                // crystals glowing on the shores, stalagmites in front
                for (const cr of crystals) {
                    const x = cr.x - px * 24, y = cr.y - py * 10, k = 0.6 + 0.4 * Math.sin(t * 0.9 + cr.x);
                    Worlds.glow(g, x, y - cr.s, cr.s * 1.8, C.crystal[1], (night ? 0.5 : 0.3) * k);
                    g.drawImage(cr.img, x - cr.img.width / 2, y - cr.img.height * 0.92);
                }
                g.drawImage(mites, -W * 0.1 - px * 28, -py * 12);
                // embers rising (and splashes thrown up from the lake), ash drifting down
                for (const e of embers) {
                    e.y -= e.v * dt; if (e.vx) e.x += e.vx * dt;
                    if (e.splash) { e.v -= 260 * dt; }
                    else if (e.y < -10) { e.y = H + 10; e.x = Math.random() * W; }
                    const x = e.x + Math.sin(t * 2 + e.ph) * 6 - px * 20;
                    Worlds.glow(g, x, e.y, e.s * 4, "#ff8a1f", 0.6); g.fillStyle = "#fff0c0"; g.fillRect(x - e.s / 2, e.y - e.s / 2, e.s, e.s);
                }
                embers = embers.filter(e => !e.splash || e.y < lakeY + 4);
                if (embers.length > 160) embers.splice(0, embers.length - 160);
                g.fillStyle = `rgba(${C.ash},.5)`;
                for (const a of ash) {
                    a.y += a.v * dt; if (a.y > H + 5) { a.y = -5; a.x = Math.random() * W; }
                    g.fillRect(a.x + Math.sin(t * 0.7 + a.ph) * 14 - px * 16, a.y, a.s, a.s);
                }
                // the heat: a shimmer of glow over everything near the lake
                g.save(); g.globalCompositeOperation = "lighter";
                g.fillStyle = `rgba(${C.vein},${(0.05 * pulse).toFixed(3)})`; g.fillRect(0, ly - H * 0.2, W, H * 0.2);
                g.restore();
            }
        };
    };
})();
