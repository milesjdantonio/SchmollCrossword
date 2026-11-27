// Neon Arcade's background (arcade.js uses it): a synthwave night drive.
//   Night: a violet sky with nebula haze and stars; a striped sun sinking behind low-poly mountains with neon
//   ridges, its lower edge shimmering in the heat; a retro skyline at the horizon with lit windows, rooftop
//   signs and blinking beacons; a glossy grid floor rushing toward you with the sun's reflection broken across
//   it, a highway with dashed lines running to the horizon, rows of palms sweeping past on both sides; big
//   palms in the corners caught in pink and cyan neon; shooting stars, drifting neon motes, a pixel UFO now
//   and then. Day: the same drive as a pastel vaporwave afternoon with shaded pixel clouds.
//   ArcadeScene(W, H, opts)
function ArcadeScene(W, H, opts) {
    const day = opts.theme === "light", preview = !!opts.preview, TAU = Math.PI * 2;
    const P = day
        ? { sky: ["#7fd6ff", "#b9c4ff", "#f6c4f0", "#ffbe9a"], neb: ["255,200,240", "200,220,255", "255,230,200"], floor: ["#ffd6f0", "#f0c0f4", "#e2b2f0"],
            far: ["#e9b6f0", "#d49ae6", "#c286dc"], near: ["#d59ae8", "#b878d8", "#a466cc"], edge: "255,90,190", edge2: "60,170,230", grid: "255,70,180", road: "#e8a8e8",
            city: ["#c48ae0", "#b07ad2"], win: ["#fff4c0", "#ffffff", "#a8f0ff"], palm: "#5a2a7e", rimA: "#ff6ac8", rimB: "#4ad8ff", sun: ["#fff2a0", "#ffb07a", "#ff6aa8"], glow: "255,170,210" }
        : { sky: ["#05010f", "#1a0638", "#4a0c5e", "#c8205e"], neb: ["255,42,140", "120,60,255", "5,200,232"], floor: ["#1a0332", "#0c011e", "#040008"],
            far: ["#2a0a4a", "#1c0636", "#120424"], near: ["#1a0532", "#120326", "#0a0118"], edge: "255,42,109", edge2: "5,217,232", grid: "255,42,109", road: "#0a0216",
            city: ["#14042a", "#0c021c"], win: ["#ffd26a", "#5af0ff", "#ff6ad0"], palm: "#07010f", rimA: "#ff2a8a", rimB: "#05d9e8", sun: ["#ffe66d", "#ff9b42", "#ff2a6d"], glow: "255,70,130" };
    let hz, sunR, skyImg, sunImg, farImg, cityImg, nearImg, palmImg, bigPalm, clouds = [], stars = [], motes = [], shooting = [], rows = [], beacons = [];
    let ufo = null, nextUfo = preview ? 1e9 : U.rand(8, 16), nextShoot = preview ? 1e9 : 3;
    const M = 60;
    function paint(w, h, fn) { const c = Worlds.canvas(w, h), g = c.getContext("2d"); fn(g); return c; }

    // low-poly mountains: a ridge of peaks and valleys, each slope a pair of facets lit by the sun in the middle,
    // a thin wireframe over the facets and a neon line along the ridge
    function mountains(seed, maxH, cols, gap, lineA) {
        const R = U.rng(seed), LW = W + M * 2, pts = [];
        let x = -20;
        while (x < LW + 40) {
            const u = (x - M) / W, dip = 1 - gap * Math.exp(-((u - 0.5) ** 2) / 0.012);
            pts.push([x, hz - (pts.length % 2 ? 0.55 + R() * 0.45 : 0.12 + R() * 0.3) * maxH * dip]);
            x += (40 + R() * 90) * (maxH / (H * 0.18));
        }
        return paint(LW, hz + 4, g => {
            const sunX = M + W / 2;
            for (let i = 0; i < pts.length - 1; i++) {
                const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], b0 = x0 + (R() - 0.5) * 20, b1 = x1 + (R() - 0.5) * 20;
                const towardSun = (y1 < y0) === (x1 < sunX), near = 1 - Math.min(1, Math.abs((x0 + x1) / 2 - sunX) / (W * 0.6));
                const lit = towardSun ? 0.55 + near * 0.45 : 0.15 + near * 0.15;
                const tri = (a, b, c, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.lineTo(...c); g.closePath(); g.fill(); };
                const shadeA = lit > 0.5 ? cols[0] : cols[1], shadeB = lit > 0.5 ? cols[1] : cols[2];
                tri([x0, y0], [x1, y1], [b0, hz + 2], shadeA);
                tri([x1, y1], [b1, hz + 2], [b0, hz + 2], shadeB);
                if (lit > 0.5) {                                          // the sun's light on the facing facet
                    const lg = g.createLinearGradient(0, Math.min(y0, y1), 0, hz);
                    lg.addColorStop(0, `rgba(${P.edge},${(0.32 * lit).toFixed(3)})`); lg.addColorStop(1, `rgba(${P.edge},0)`);
                    tri([x0, y0], [x1, y1], [b0, hz + 2], lg);
                }
                g.strokeStyle = `rgba(${P.edge2},${lineA * 0.35})`; g.lineWidth = 0.8;   // the wireframe
                g.beginPath(); g.moveTo(x1, y1); g.lineTo(b0, hz); g.moveTo(x0, y0); g.lineTo(b0, hz); g.stroke();
                for (let k = 1; k < 4; k++) {                             // contour lines across the facet
                    const t = k / 4, ya = y0 + (hz - y0) * t, yb = y1 + (hz - y1) * t;
                    g.beginPath(); g.moveTo(x0 + (b0 - x0) * t, ya); g.lineTo(x1 + (b0 - x1) * t, yb); g.stroke();
                }
            }
            g.lineJoin = "round";                                          // the ridge in neon, a soft glow under it
            for (const [w, a] of [[7, 0.12], [3, 0.3], [1.4, 0.95]]) {
                g.strokeStyle = `rgba(${P.edge},${a * lineA})`; g.lineWidth = w;
                g.beginPath(); pts.forEach(([x, y], i) => g[i ? "lineTo" : "moveTo"](x, y)); g.stroke();
            }
        });
    }
    function palmShape(g, h, rim) {                                       // a palm, base at (0,0): ringed trunk, ten fronds
        const lean = h * 0.22, tx = lean, ty = -h;
        g.fillStyle = P.palm;
        g.beginPath(); g.moveTo(-h * 0.035, 0);
        g.quadraticCurveTo(h * 0.02, -h * 0.55, tx - h * 0.018, ty); g.lineTo(tx + h * 0.018, ty);
        g.quadraticCurveTo(h * 0.07, -h * 0.55, h * 0.035, 0); g.closePath(); g.fill();
        if (rim) {
            g.strokeStyle = P.rimA; g.lineWidth = Math.max(1, h * 0.006); g.globalAlpha = 0.85;
            g.beginPath(); g.moveTo(h * 0.035, 0); g.quadraticCurveTo(h * 0.07, -h * 0.55, tx + h * 0.018, ty); g.stroke();
            g.globalAlpha = 1;
            g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = Math.max(1, h * 0.004);
            for (let i = 1; i < 22; i++) { const u = i / 22, x = 2 * (1 - u) * u * h * 0.045 + u * u * tx, y = -h * u; g.beginPath(); g.moveTo(x - h * 0.03, y); g.lineTo(x + h * 0.03, y - h * 0.008); g.stroke(); }
        }
        for (let i = 0; i < 10; i++) {
            const a = -Math.PI / 2 + (i - 4.5) * 0.36, l = h * (0.42 + (i % 3) * 0.05), droop = 0.55;
            const ex = tx + Math.cos(a) * l, ey = ty + Math.sin(a) * l + l * droop, cx = tx + Math.cos(a) * l * 0.5, cy = ty + Math.sin(a) * l * 0.5 - l * 0.15;
            g.strokeStyle = P.palm; g.lineCap = "round";
            for (let j = 1; j <= 26; j++) {                                // leaflets: thin drooping strokes either side of the rib
                const t = j / 26, px = (1 - t) * (1 - t) * tx + 2 * (1 - t) * t * cx + t * t * ex, py = (1 - t) * (1 - t) * ty + 2 * (1 - t) * t * cy + t * t * ey;
                const dx = 2 * (1 - t) * (cx - tx) + 2 * t * (ex - cx), dy = 2 * (1 - t) * (cy - ty) + 2 * t * (ey - cy), d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
                const n = l * 0.2 * Math.sin(Math.min(1, t * 1.2) * Math.PI * 0.88) + 1;
                g.lineWidth = Math.max(1, h * 0.0085 * (1 - t * 0.5));
                for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo(px + nx * sd * n * 0.5 + dx / d * n * 0.2, py + ny * sd * n * 0.5, px + nx * sd * n * 0.8 + dx / d * n * 0.35, py + ny * sd * n * 0.8 + n * 0.65); g.stroke(); }
            }
            g.strokeStyle = P.palm; g.lineWidth = Math.max(1.5, h * 0.012);
            g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(cx, cy, ex, ey); g.stroke();
            if (rim && i >= 4) { g.strokeStyle = i > 6 ? P.rimB : P.rimA; g.globalAlpha = 0.7; g.lineWidth = Math.max(1, h * 0.004); g.beginPath(); g.moveTo(tx, ty - 1); g.quadraticCurveTo(cx, cy - 1.5, ex, ey - 1); g.stroke(); g.globalAlpha = 1; }
        }
    }

    function setup() {
        const R = U.rng(2049), LW = W + M * 2;
        hz = Math.round(H * (preview ? 0.6 : 0.6));
        sunR = Math.min(W, H) * (preview ? 0.3 : 0.2);
        skyImg = paint(W, hz + 2, g => {
            const sg = g.createLinearGradient(0, 0, 0, hz);
            P.sky.forEach((c, i) => sg.addColorStop([0, 0.45, 0.8, 1][i], c));
            g.fillStyle = sg; g.fillRect(0, 0, W, hz + 2);
            for (let i = 0; i < (preview ? 6 : 16); i++) {                 // nebula haze, stretched sideways
                const x = R() * W, y = R() * hz * 0.75, rx = (120 + R() * 260), ry = rx * (0.25 + R() * 0.25), c = P.neb[i % 3];
                g.save(); g.translate(x, y); g.scale(1, ry / rx);
                const ng = g.createRadialGradient(0, 0, 0, 0, 0, rx); ng.addColorStop(0, `rgba(${c},${day ? 0.22 : 0.14})`); ng.addColorStop(1, `rgba(${c},0)`);
                g.fillStyle = ng; g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill(); g.restore();
            }
            if (!day) {
                for (let i = 0; i < (preview ? 80 : 420); i++) { const y = Math.pow(R(), 1.3) * hz * 0.9, a = 0.25 + R() * 0.65 * (1 - y / hz); g.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`; const r = R() < 0.08 ? 2 : 1; g.fillRect(Math.round(R() * W), Math.round(y), r, r); }
                const px = W * 0.16, py = hz * 0.22, pr = Math.min(W, H) * 0.045;                   // a ringed planet
                const pg = g.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr);
                pg.addColorStop(0, "#c89aff"); pg.addColorStop(0.7, "#5a2a9a"); pg.addColorStop(1, "#2a0a4a");
                g.strokeStyle = "rgba(5,217,232,.5)"; g.lineWidth = 2; g.beginPath(); g.ellipse(px, py, pr * 2, pr * 0.45, -0.3, Math.PI, TAU); g.stroke();
                g.fillStyle = pg; g.beginPath(); g.arc(px, py, pr, 0, TAU); g.fill();
                g.strokeStyle = "rgba(255,255,255,.12)"; g.lineWidth = 1; for (let k = -2; k <= 2; k++) { g.beginPath(); g.ellipse(px, py + k * pr * 0.3, pr * Math.sqrt(1 - (k * 0.3) ** 2), pr * 0.08, 0, 0, TAU); g.stroke(); }
                g.strokeStyle = "rgba(5,217,232,.75)"; g.lineWidth = 2; g.beginPath(); g.ellipse(px, py, pr * 2, pr * 0.45, -0.3, 0, Math.PI); g.stroke();
            }
        });
        sunImg = paint(sunR * 2 + 4, sunR * 2 + 4, g => {
            const c = sunR + 2, gr = g.createLinearGradient(0, c - sunR, 0, c + sunR);
            gr.addColorStop(0, P.sun[0]); gr.addColorStop(0.45, P.sun[1]); gr.addColorStop(1, P.sun[2]);
            g.fillStyle = gr; g.beginPath(); g.arc(c, c, sunR, 0, TAU); g.fill();
            const hl = g.createRadialGradient(c - sunR * 0.3, c - sunR * 0.5, 0, c, c, sunR);
            hl.addColorStop(0, "rgba(255,255,240,.45)"); hl.addColorStop(0.5, "rgba(255,255,240,0)");
            g.fillStyle = hl; g.beginPath(); g.arc(c, c, sunR, 0, TAU); g.fill();
        });
        farImg = mountains(11, H * 0.2, P.far, 0.75, day ? 0.6 : 0.6);
        nearImg = mountains(23, H * 0.12, P.near, 0.9, 1);
        // the skyline on the right: towers with stepped tops, lit windows, antennas, a neon sign or two
        beacons = [];
        cityImg = paint(LW, hz + 2, g => {
            let x = M + W * 0.66;
            while (x < M + W * 0.98) {
                const w = (16 + R() * 34) * (preview ? 0.6 : 1), h = (H * 0.03 + R() * H * 0.11) * (1 - Math.abs(x - M - W * 0.82) / (W * 0.4)), y = hz - h;
                const bg = g.createLinearGradient(x, 0, x + w, 0); bg.addColorStop(0, P.city[0]); bg.addColorStop(1, P.city[1]);
                g.fillStyle = bg; g.fillRect(x, y, w, h + 2);
                if (R() < 0.5) { g.fillRect(x + w * 0.2, y - h * 0.08, w * 0.6, h * 0.08 + 1); if (R() < 0.6) g.fillRect(x + w * 0.45, y - h * 0.08 - 14, 2, 14); beacons.push([x + w * 0.46, y - h * 0.08 - 15, R() * TAU]); }
                g.strokeStyle = `rgba(${R() < 0.5 ? P.edge : P.edge2},.55)`; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, w - 1, h);
                for (let wy = y + 5; wy < hz - 4; wy += 5) for (let wx = x + 3; wx < x + w - 4; wx += 4) {
                    if (R() < (day ? 0.25 : 0.42)) { g.fillStyle = P.win[Math.floor(R() * 3)]; g.globalAlpha = 0.5 + R() * 0.5; g.fillRect(wx, wy, 2, 2); g.globalAlpha = 1; }
                }
                if (R() < 0.25 && h > H * 0.07) { g.fillStyle = `rgba(${P.edge2},.9)`; g.fillRect(x + 3, y + h * 0.2, w - 6, 3); g.fillStyle = `rgba(${P.edge},.9)`; g.fillRect(x + 3, y + h * 0.2 + 5, w - 6, 2); }
                x += w + 1 + R() * 5;
            }
        });
        palmImg = paint(340, 400, g => { g.translate(110, 396); palmShape(g, 260, true); });
        bigPalm = paint(840, 960, g => { g.translate(280, 956); palmShape(g, 640, true); });
        // rows of palms along the highway, at depths that sweep toward you
        rows = [];
        for (let i = 0; i < 9; i++) for (const side of [-1, 1]) rows.push({ z: 1.2 + i * 1.6 + (side > 0 ? 0.8 : 0), side });
        clouds = day ? Array.from({ length: preview ? 3 : 6 }, () => {
            const cw = 6 + Math.floor(R() * 6), px = Math.round(4 + R() * 4), img = paint((cw + 2) * px, 6 * px, g => {
                const hump = i => Math.round(1 + Math.sin((i / cw) * Math.PI) * 2.6 + (R() - 0.5));
                for (let i = 0; i < cw; i++) { const hgt = hump(i); for (let j = 0; j < hgt + 1; j++) { const y = 5 - j - 1; g.fillStyle = j === 0 ? "#e2c8ff" : j === hgt ? "#ffffff" : "#fbf4ff"; g.fillRect((i + 1) * px, y * px, px, px); } }
                g.fillStyle = "#c8b0f0"; g.fillRect(px, 5 * px, cw * px, px * 0.6);
            });
            return { img, x: R() * W, y: R() * hz * 0.5, sp: 6 + R() * 10 };
        }) : [];
        stars = day ? [] : Array.from({ length: preview ? 0 : 50 }, () => ({ x: R() * W, y: Math.pow(R(), 1.3) * hz * 0.7, r: 1 + R(), ph: R() * TAU, sp: 0.5 + R() }));
        motes = preview ? [] : Array.from({ length: 34 }, () => ({ x: R() * W, y: hz + R() * (H - hz), vy: -(4 + R() * 10), ph: R() * TAU, c: R() < 0.5 ? P.rimA : P.rimB }));
    }
    setup();

    function drawUfo(g, u, t) {
        const px = 4, x0 = Math.round(u.x), y0 = Math.round(u.y + Math.sin(t * 3) * 6);
        const MAP = ["....cccc....", "..cccccccc..", "pppppppppppp", ".pwpwpwpwpw.", "...pppppp..."];
        const col = { c: "#05d9e8", p: "#d16ba5", w: Math.sin(t * 10) > 0 ? "#f9c80e" : "#ffffff" };
        MAP.forEach((row, ry) => [...row].forEach((ch, rx) => { if (ch !== ".") { g.fillStyle = col[ch]; g.fillRect(x0 + rx * px, y0 + ry * px, px, px); } }));
        if (u.beam) {
            const bg = g.createLinearGradient(0, y0 + 20, 0, hz);
            bg.addColorStop(0, "rgba(249,200,14,.35)"); bg.addColorStop(1, "rgba(249,200,14,0)");
            g.fillStyle = bg; g.beginPath(); g.moveTo(x0 + 16, y0 + 20); g.lineTo(x0 + 32, y0 + 20); g.lineTo(x0 + 60, hz); g.lineTo(x0 - 12, hz); g.fill();
        }
    }

    return {
        resize(w, h) { W = w; H = h; setup(); },
        draw(g, t, dt, inp) {
            const px = inp.px || 0, speed = 1.1, D = H - hz;
            g.drawImage(skyImg, -px * 2 - 2, 0, W + 4, hz + 2);
            for (const st of stars) Worlds.twinkle(g, st.x - px * 2, st.y, st.r, 0.5 + 0.5 * Math.sin(t * st.sp + st.ph), "#ffd0f0");
            nextShoot -= dt;                                                  // shooting stars
            if (nextShoot <= 0 && !day) { shooting.push({ x: U.rand(0.1, 0.9) * W, y: U.rand(0.05, 0.3) * hz, age: 0 }); nextShoot = U.rand(4, 9); }
            for (const s of shooting) {
                s.age += dt; const q = s.age / 0.8, x = s.x + q * 220, y = s.y + q * 90, a = Math.sin(Math.min(1, q) * Math.PI);
                const sg = g.createLinearGradient(x - 90, y - 37, x, y); sg.addColorStop(0, "rgba(255,255,255,0)"); sg.addColorStop(1, `rgba(255,230,250,${a.toFixed(3)})`);
                g.strokeStyle = sg; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x - 90, y - 37); g.lineTo(x, y); g.stroke();
            }
            shooting = shooting.filter(s => s.age < 0.8);
            for (const cl of clouds) { cl.x += cl.sp * dt; if (cl.x > W + 80) cl.x = -cl.img.width - 40; g.drawImage(cl.img, Math.round(cl.x - px * 6), Math.round(cl.y)); }
            // the sun: a glow, the striped disc, its lower edge rippling in the heat
            const sx = W / 2 - px * 12, sy = hz - sunR * 0.62;
            g.save(); g.globalCompositeOperation = "lighter";
            for (const [r0, r1, a] of [[0.6, 2.6, day ? 0.5 : 0.4], [0.9, 1.4, 0.35]]) {
                const gl = g.createRadialGradient(sx, sy, sunR * r0, sx, sy, sunR * r1); gl.addColorStop(0, `rgba(${P.glow},${a})`); gl.addColorStop(1, `rgba(${P.glow},0)`);
                g.fillStyle = gl; g.fillRect(sx - sunR * r1, sy - sunR * r1, sunR * r1 * 2, sunR * r1 * 2);
            }
            g.restore();
            const S = sunImg.width, c = S / 2, gap = sunR * 0.16, off = (t * sunR * 0.05) % gap;
            for (let y = 0; y < S; y += 2) {                                   // slices: stripes cut out below the middle, a heat wobble
                const yy = y - c;
                let cut = false;
                if (yy > -sunR * 0.3) for (let i = -3; i < 8; i++) { const sy0 = sunR * 0.02 + i * gap + off, sh = Math.max(0, 1.5 + ((sy0 + sunR * 0.3) / sunR) * gap * 0.5); if (yy >= sy0 && yy < sy0 + sh) { cut = true; break; } }
                if (cut || sy - c + y > hz) continue;
                const wob = yy > sunR * 0.3 ? Math.sin(t * 3 + y * 0.15) * 1.6 * ((yy - sunR * 0.3) / sunR) : 0;
                g.drawImage(sunImg, 0, y, S, 2, sx - c + wob, sy - c + y, S, 2);
            }
            nextUfo -= dt;                                                     // a UFO now and then
            if (!ufo && nextUfo <= 0) ufo = { x: -60, y: U.rand(H * 0.08, hz * 0.4), vx: U.rand(60, 110), beam: false, bt: U.rand(1, 3) };
            if (ufo) {
                ufo.x += ufo.vx * dt; ufo.bt -= dt;
                if (ufo.bt < 0) { ufo.beam = !ufo.beam; ufo.bt = ufo.beam ? 1.2 : U.rand(1.5, 3); }
                drawUfo(g, ufo, t);
                if (ufo.x > W + 60) { ufo = null; nextUfo = U.rand(14, 26); }
            }
            g.drawImage(farImg, -M - px * 6, 0);
            g.drawImage(cityImg, -M - px * 8, 0);
            for (const [bx, by, ph] of beacons) { const on = Math.sin(t * 2.2 + ph) > 0.6; if (on) { Worlds.glow(g, bx - M - px * 8, by, 7, "#ff3a5a", 0.9); } }
            g.drawImage(nearImg, -M - px * 14, 0);
            // the floor: glossy, darker toward you, the sun's reflection broken by the lines
            const fg = g.createLinearGradient(0, hz, 0, H);
            fg.addColorStop(0, P.floor[0]); fg.addColorStop(0.4, P.floor[1]); fg.addColorStop(1, P.floor[2]);
            g.fillStyle = fg; g.fillRect(0, hz, W, H - hz);
            const vx = W / 2 - px * 40;
            g.save(); g.globalCompositeOperation = day ? "source-over" : "lighter";
            const rg = g.createLinearGradient(0, hz, 0, hz + D * 0.7);
            rg.addColorStop(0, `rgba(${P.glow},${day ? 0.5 : 0.45})`); rg.addColorStop(1, `rgba(${P.glow},0)`);
            g.fillStyle = rg;
            for (let i = 0; i < 26; i++) { const y = hz + 2 + i * i * D * 0.0011 + i * 2, w = sunR * (1.1 - i * 0.02) * (0.85 + 0.15 * Math.sin(t * 2 + i)); g.fillRect(sx - w + Math.sin(t * 1.4 + i * 1.3) * 3, y, w * 2, 1 + i * 0.18); }
            // the highway: a darker band, glowing edges, dashed lines rushing toward you
            g.globalCompositeOperation = "source-over";
            const RW = 0.75;
            g.fillStyle = day ? "rgba(232,168,232,.55)" : "rgba(10,2,22,.7)";
            g.beginPath(); g.moveTo(vx - 2, hz); g.lineTo(vx + 2, hz); g.lineTo(vx + RW * D * 1.4, H + D * 0.4); g.lineTo(vx - RW * D * 1.4, H + D * 0.4); g.fill();
            g.globalCompositeOperation = day ? "source-over" : "lighter";
            // the grid
            for (const [width, alpha] of [[5, 0.14], [1.5, 1]]) {
                g.lineWidth = width;
                for (let j = -18; j <= 18; j++) {
                    const X = j * 0.42;
                    if (Math.abs(X) < RW * 0.99) continue;
                    g.strokeStyle = `rgba(${P.grid},${(0.55 * alpha).toFixed(2)})`;
                    g.beginPath(); g.moveTo(vx + X * 3, hz); g.lineTo(vx + X * D * 1.4, H + D * 0.4); g.stroke();
                }
                const frac = (t * speed) % 1;
                for (let i = 0; i < 24; i++) {
                    const z = 1 + i - frac, y = hz + D / z;
                    if (y > H + 4) continue;
                    const k = (y - hz) / D;
                    g.strokeStyle = `rgba(${P.grid},${((0.12 + 0.88 * k) * alpha).toFixed(2)})`;
                    g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
                }
                g.strokeStyle = `rgba(${P.edge2},${0.9 * alpha})`;              // the road's edges, cyan
                for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(vx + sd * 2, hz); g.lineTo(vx + sd * RW * D * 1.4, H + D * 0.4); g.stroke(); }
            }
            const dfrac = (t * speed * 1.4) % 1;                                // dashes down the middle
            g.fillStyle = day ? "rgba(255,255,255,.9)" : "rgba(255,230,120,.85)";
            for (let i = 0; i < 16; i++) {
                const z0 = 0.6 + i * 0.9 - dfrac * 0.9, z1 = z0 + 0.4;
                if (z0 <= 0.2) continue;
                const y0 = hz + D / z0, y1 = hz + D / z1, w0 = 6 / z0, w1 = 6 / z1;
                if (y1 > H) continue;
                g.beginPath(); g.moveTo(vx - w1, y1); g.lineTo(vx + w1, y1); g.lineTo(vx + w0, Math.min(H, y0)); g.lineTo(vx - w0, Math.min(H, y0)); g.fill();
            }
            // the horizon line glows
            const hg = g.createLinearGradient(0, hz - 6, 0, hz + 10);
            hg.addColorStop(0, `rgba(${P.edge},0)`); hg.addColorStop(0.5, day ? "rgba(255,255,255,.95)" : "rgba(255,140,190,.95)"); hg.addColorStop(1, `rgba(${P.edge},0)`);
            g.fillStyle = hg; g.fillRect(0, hz - 6, W, 16);
            g.restore();
            // the palm rows sweeping past, far to near
            for (const r of rows) { r.z -= speed * dt; if (r.z < 0.45) r.z += 9 * 1.6; }
            rows.sort((a, b) => b.z - a.z);
            for (const r of rows) {
                const y = hz + D / r.z, x = vx + r.side * 1.3 * D / r.z, sc = (D * 0.85 / r.z) / 260;
                if (x < -300 || x > W + 300 || sc < 0.02) continue;
                const fade = Math.min(1, (14 - r.z) / 3);
                g.globalAlpha = Math.max(0, fade);
                g.save(); g.translate(x, y); g.scale(r.side * sc, sc); g.drawImage(palmImg, -110, -396); g.restore();
                if (!day && r.z < 6) Worlds.glow(g, x, y, 30 * sc * 4, r.side < 0 ? P.rimA : P.rimB, 0.18 * fade);
            }
            g.globalAlpha = 1;
            for (const m of motes) {                                            // neon motes drifting up
                m.y += m.vy * dt; if (m.y < hz) { m.y = H; m.x = Math.random() * W; }
                Worlds.glow(g, m.x + Math.sin(t + m.ph) * 10, m.y, 5, m.c, (day ? 0.25 : 0.55) * (0.5 + 0.5 * Math.sin(t * 2 + m.ph)));
            }
            // the big palms in the corners, swaying
            if (!preview || W > 200) {
                const s = U.clamp(H / 900, 0.45, 1.1);
                for (const [x, sc, flip, ph] of [[W * 0.04, 1.0, 1, 0], [W * 0.13, 0.66, 1, 1.3], [W * 0.965, 0.95, -1, 2.2]]) {
                    g.save(); g.translate(x - px * 22, H + 8); g.rotate(Math.sin(t * 0.8 + ph) * 0.012); g.scale(flip * s * sc, s * sc); g.drawImage(bigPalm, -280, -956); g.restore();
                }
            }
        }
    };
}
