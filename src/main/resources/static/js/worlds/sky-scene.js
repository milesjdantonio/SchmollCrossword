// The Sky Kingdom's background (sky.js uses it). High above a sea of clouds: floating islands at three depths,
// each a grassy top over a rocky underside that tapers to hanging roots and glowing crystals, waterfalls pouring
// off their edges into mist; a castle with towers and pennants on the great island, cottages and trees on
// another, a rope bridge slung between them; cloud banks drifting past in layers below; an airship idling along;
// hot-air balloons rising (striped envelopes, baskets, ropes) and birds. Night: stars, a crescent moon, the
// sunset still glowing along the horizon, lit windows, and paper lanterns floating up.
function SkyScene(W, H, opts) {
    const night = opts.theme === "dark", preview = !!opts.preview, TAU = Math.PI * 2;
    const P = night
        ? { sky: ["#0a0a2a", "#1c1a4a", "#4a2a5e", "#c2605a"], cloud: ["rgba(120,110,170,", "rgba(70,60,120,"], grass: ["#2a4a3a", "#1e3a2c"], rock: ["#3a3048", "#241e30", "#4a3e5a"], far: "#4a3e6a", water: "rgba(150,170,230,", stone: ["#8a86a8", "#5a5674"], roof: "#4a2a4a" }
        : { sky: ["#3a8ee6", "#6fb2f0", "#a8d4f6", "#e8f4fd"], cloud: ["rgba(255,255,255,", "rgba(210,225,242,"], grass: ["#7cc35a", "#5aa844"], rock: ["#a88a6a", "#7a5e44", "#c8a882"], far: "#9ec0e0", water: "rgba(230,246,255,", stone: ["#f2ece2", "#c8bea8"], roof: "#4a6ad0" };
    let sky = null, islands = [], banks = [], balloons = [], lanterns = [], birds = [], stars = [], ship = null, nextBalloon = preview ? 999 : 2, nextBirds = preview ? 999 : 4;
    const k = () => (preview ? 0.5 : U.clamp(Math.min(W, H) / 900, 0.6, 1.1));
    function paint(w, h, fn) { const c = Worlds.canvas(w, h), g = c.getContext("2d"); fn(g); return c; }

    // one floating island painted once: top, cliff with strata, roots, crystals, and its buildings
    function island(w, kind, R) {
        const h = w * 0.9, cw = Math.ceil(w * 1.2), head = kind === "castle" ? w * 1.05 : h * 0.38, ch = Math.ceil(head + h * 0.9), cx = cw / 2, top = head;
        const pic = paint(cw, ch, g => {
            // the rocky underside: a tapering wedge with ledges
            const pts = [];
            for (let i = 0; i <= 20; i++) { const u = i / 20, x = cx - w / 2 + u * w; const depth = Math.sin(u * Math.PI) ** 0.8 * h * (0.75 + R() * 0.15); pts.push([x, top + depth]); }
            const rg = g.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
            rg.addColorStop(0, P.rock[2]); rg.addColorStop(0.5, P.rock[0]); rg.addColorStop(1, P.rock[1]);
            g.fillStyle = rg; g.beginPath(); g.moveTo(cx - w / 2, top); pts.forEach(([x, y]) => g.lineTo(x, y)); g.lineTo(cx + w / 2, top); g.fill();
            g.strokeStyle = "rgba(0,0,0,.14)"; g.lineWidth = 2;
            for (let y = top + 10; y < top + h * 0.7; y += 12 + R() * 10) { g.beginPath(); g.moveTo(cx - w * 0.45 * (1 - (y - top) / h), y); g.lineTo(cx + w * 0.45 * (1 - (y - top) / h), y + (R() - 0.5) * 6); g.stroke(); }
            g.strokeStyle = night ? "#2a2a1a" : "#6a5a3a"; g.lineWidth = 1.5;
            for (let i = 0; i < 12; i++) { const x = cx + (R() - 0.5) * w * 0.6, y0 = top + h * 0.2 + R() * h * 0.3; g.beginPath(); g.moveTo(x, y0); g.quadraticCurveTo(x + (R() - 0.5) * 20, y0 + 30, x + (R() - 0.5) * 30, y0 + 40 + R() * 50); g.stroke(); }
            for (let i = 0; i < 4; i++) {                       // crystals in the rock, catching the light
                const x = cx + (R() - 0.5) * w * 0.4, y = top + h * (0.3 + R() * 0.3), s = 6 + R() * 8;
                g.fillStyle = night ? "#8ad8ff" : "#a8e8ff"; g.beginPath(); g.moveTo(x, y - s * 1.6); g.lineTo(x + s * 0.6, y); g.lineTo(x, y + s * 0.5); g.lineTo(x - s * 0.6, y); g.fill();
                g.fillStyle = "rgba(255,255,255,.6)"; g.beginPath(); g.moveTo(x, y - s * 1.6); g.lineTo(x + s * 0.6, y); g.lineTo(x, y); g.fill();
            }
            // the grass top, with a lit edge and a fringe hanging over
            g.fillStyle = P.grass[1]; g.beginPath(); g.ellipse(cx, top + 4, w / 2 + 4, 16, 0, 0, TAU); g.fill();
            g.fillStyle = P.grass[0]; g.beginPath(); g.ellipse(cx, top, w / 2, 14, 0, 0, TAU); g.fill();
            for (let x = cx - w / 2; x < cx + w / 2; x += 6) { g.beginPath(); g.moveTo(x, top + 8); g.lineTo(x + 3, top + 16 + R() * 8); g.lineTo(x + 6, top + 8); g.fill(); }
            g.fillStyle = night ? "rgba(150,180,255,.1)" : "rgba(230,255,180,.45)"; g.beginPath(); g.ellipse(cx - w * 0.1, top - 4, w * 0.35, 5, 0, 0, TAU); g.fill();
            const tree = (x, s) => { g.fillStyle = night ? "#2a1e18" : "#6a4a2a"; g.fillRect(x - 2, top - s * 1.2, 4, s * 1.2); g.fillStyle = P.grass[1]; g.beginPath(); g.arc(x, top - s * 1.4, s * 0.7, 0, TAU); g.fill(); g.fillStyle = P.grass[0]; g.beginPath(); g.arc(x - s * 0.2, top - s * 1.55, s * 0.5, 0, TAU); g.fill(); };
            if (kind === "castle") {
                const s = w * 0.05, stoneG = (x, wd) => { const sg = g.createLinearGradient(x - wd / 2, 0, x + wd / 2, 0); sg.addColorStop(0, P.stone[0]); sg.addColorStop(0.6, P.stone[0]); sg.addColorStop(1, P.stone[1]); return sg; };
                const tower = (dx, tw, th) => {
                    const x = cx + dx * w, wd = tw * w, hh = th * w;
                    g.fillStyle = stoneG(x, wd); g.fillRect(x - wd / 2, top - hh, wd, hh);
                    g.fillStyle = P.roof; g.beginPath(); g.moveTo(x - wd * 0.7, top - hh); g.lineTo(x, top - hh - wd * 1.6); g.lineTo(x + wd * 0.7, top - hh); g.fill();
                    g.fillStyle = "rgba(0,0,0,.22)"; g.beginPath(); g.moveTo(x, top - hh - wd * 1.6); g.lineTo(x + wd * 0.7, top - hh); g.lineTo(x + wd * 0.1, top - hh); g.fill();
                    for (let wy = top - hh + s * 1.4; wy < top - s * 3; wy += s * 2.2) { g.fillStyle = night ? "#ffd98a" : "#4a5a7a"; g.beginPath(); g.roundRect(x - s * 0.32, wy, s * 0.64, s * 1, [s * 0.32, s * 0.32, 0, 0]); g.fill(); }
                    g.strokeStyle = "#4a4a4a"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, top - hh - wd * 1.6); g.lineTo(x, top - hh - wd * 1.6 - s * 2.4); g.stroke();
                    g.fillStyle = "#e2343e"; g.beginPath(); g.moveTo(x, top - hh - wd * 1.6 - s * 2.4); g.lineTo(x + s * 1.6, top - hh - wd * 1.6 - s * 1.9); g.lineTo(x, top - hh - wd * 1.6 - s * 1.4); g.fill();
                };
                tower(0, 0.16, 0.6); tower(-0.27, 0.1, 0.38); tower(0.27, 0.1, 0.38);
                // the curtain wall with battlements, and the gate
                const ww = w * 0.62, wh = w * 0.18;
                g.fillStyle = stoneG(cx, ww); g.fillRect(cx - ww / 2, top - wh, ww, wh);
                for (let x = cx - ww / 2; x < cx + ww / 2 - 2; x += s * 1.4) g.fillRect(x, top - wh - s * 0.8, s * 0.8, s * 0.8);
                g.strokeStyle = "rgba(0,0,0,.12)"; g.lineWidth = 1; for (let y = top - wh + s; y < top; y += s) { g.beginPath(); g.moveTo(cx - ww / 2, y); g.lineTo(cx + ww / 2, y); g.stroke(); }
                g.fillStyle = night ? "#1a1424" : "#3a2a20"; g.beginPath(); g.moveTo(cx - s * 1.4, top); g.lineTo(cx - s * 1.4, top - s * 2.2); g.arc(cx, top - s * 2.2, s * 1.4, Math.PI, 0); g.lineTo(cx + s * 1.4, top); g.fill();
                tree(cx - w * 0.42, w * 0.05); tree(cx + w * 0.42, w * 0.06);
            } else if (kind === "village") {
                for (const dx of [-0.25, 0.05]) { const x = cx + dx * w, s = w * 0.11; g.fillStyle = P.stone[0]; g.fillRect(x, top - s * 0.8, s, s * 0.8); g.fillStyle = night ? "#5a2a2a" : "#c85a3c"; g.beginPath(); g.moveTo(x - s * 0.15, top - s * 0.8); g.lineTo(x + s / 2, top - s * 1.45); g.lineTo(x + s * 1.15, top - s * 0.8); g.fill(); g.fillStyle = night ? "#ffd98a" : "#5a6a8a"; g.fillRect(x + s * 0.35, top - s * 0.55, s * 0.3, s * 0.3); }
                for (const dx of [-0.38, 0.32, 0.42]) tree(cx + dx * w, w * 0.07);
            } else for (const dx of [-0.2, 0.15]) tree(cx + dx * w, w * 0.08);
        });
        pic.topY = top;                                         // where its grass is, from the top of the picture
        return pic;
    }
    // a far island: the same picture washed with the air's colour (only where the island is)
    function hazed(img) {
        const c = paint(img.width, img.height, g => { g.drawImage(img, 0, 0); g.globalCompositeOperation = "source-atop"; g.fillStyle = night ? "rgba(74,62,106,.5)" : "rgba(170,205,240,.5)"; g.fillRect(0, 0, img.width, img.height); });
        c.topY = img.topY;
        return c;
    }
    function setup() {
        const R = U.rng(4096), s = k();
        islands = [
            { img: hazed(island(W * 0.12 * s + 60, "plain", R)), x: W * 0.1, y: H * 0.26, z: 0.35, ph: 0, falls: 1, far: true },
            { img: hazed(island(W * 0.14 * s + 70, "plain", R)), x: W * 0.62, y: H * 0.18, z: 0.4, ph: 1, falls: 0, far: true },
            { img: island(Math.min(W * 0.3, 420 * s), "castle", R), x: W * 0.78, y: H * 0.34, z: 1, ph: 2, falls: 2 },
            { img: island(Math.min(W * 0.22, 300 * s), "village", R), x: W * 0.16, y: H * 0.5, z: 0.8, ph: 3, falls: 1 }
        ];
        banks = [0, 1, 2].map(d => {
            const w = W * 1.6, h = H * 0.35;
            const img = paint(w, h, g => {
                const base = g.createLinearGradient(0, h * 0.35, 0, h);
                base.addColorStop(0, P.cloud[1] + "0)"); base.addColorStop(0.5, P.cloud[1] + (night ? ".35)" : ".85)")); base.addColorStop(1, P.cloud[1] + (night ? ".45)" : "1)"));
                g.fillStyle = base; g.fillRect(0, h * 0.35, w, h * 0.65);
                for (let i = 0; i < 150; i++) {
                    const x = R() * w, y = h * (0.3 + R() * 0.55), r = h * (0.06 + R() * 0.12), lit = y < h * 0.5;
                    const tone = lit ? P.cloud[0] : P.cloud[1];
                    const cg = g.createRadialGradient(x, y, 0, x, y, r);
                    cg.addColorStop(0, tone + (night ? ".3)" : ".75)")); cg.addColorStop(0.55, tone + (night ? ".18)" : ".45)")); cg.addColorStop(1, tone + "0)");
                    g.fillStyle = cg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
                }
            });
            return { img, x: -R() * W * 0.5, y: H * (0.62 + d * 0.11), sp: [3, 6, 10][d] };
        });
        stars = night ? Array.from({ length: preview ? 60 : 220 }, () => ({ x: R() * W, y: R() * H * 0.5, r: R() * 1.4 + 0.3, tw: R() * TAU })) : [];
        ship = preview ? null : { x: W * 0.35, y: H * 0.14 };
        sky = null;
    }
    setup();

    function balloon(g, b, t) {
        const s = b.s, x = b.x + Math.sin(t * 0.6 + b.ph) * 6, y = b.y;
        const cols = b.cols;
        g.save(); g.translate(x, y);
        for (let i = 0; i < 6; i++) {                          // the envelope's gores
            const a0 = -1 + i / 3, a1 = -1 + (i + 1) / 3;
            g.fillStyle = cols[i % 2];
            g.beginPath(); g.moveTo(0, -38 * s);
            g.bezierCurveTo(a0 * 46 * s, -38 * s, a0 * 40 * s, 10 * s, a0 * 12 * s, 26 * s); g.lineTo(a1 * 12 * s, 26 * s);
            g.bezierCurveTo(a1 * 40 * s, 10 * s, a1 * 46 * s, -38 * s, 0, -38 * s); g.fill();
        }
        const sh = g.createLinearGradient(-36 * s, 0, 36 * s, 0); sh.addColorStop(0, "rgba(255,255,255,.3)"); sh.addColorStop(0.6, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(0,0,0,.25)");
        g.fillStyle = sh; g.beginPath(); g.ellipse(0, -10 * s, 34 * s, 36 * s, 0, 0, TAU); g.fill();
        g.strokeStyle = "#5a4a3a"; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-11 * s, 26 * s); g.lineTo(-6 * s, 40 * s); g.moveTo(11 * s, 26 * s); g.lineTo(6 * s, 40 * s); g.stroke();
        g.fillStyle = "#8a5a32"; g.fillRect(-7 * s, 40 * s, 14 * s, 10 * s);
        if (Math.sin(t * 4 + b.ph) > 0.4) Worlds.glow(g, 0, 32 * s, 8 * s, "#ffb43a", 0.8);
        g.restore();
    }
    return {
        resize(w, h) { W = w; H = h; setup(); },
        draw(g, t, dt, inp) {
            const s = k();
            if (!sky) { sky = g.createLinearGradient(0, 0, 0, H); P.sky.forEach((c, i) => sky.addColorStop(i / (P.sky.length - 1), c)); }
            g.fillStyle = sky; g.fillRect(0, 0, W, H);
            if (night) {
                for (const st of stars) { const tw = Math.abs(Math.sin(t * 0.7 + st.tw)); g.fillStyle = `rgba(255,252,240,${(0.25 + 0.75 * tw).toFixed(2)})`; g.fillRect(st.x, st.y, st.r, st.r); if (st.r > 1.3) Worlds.twinkle(g, st.x, st.y, st.r, tw, "#fffbe8"); }
                const mx = W * 0.15, my = H * 0.13, mr = Math.min(W, H) * 0.05;
                Worlds.glow(g, mx, my, mr * 5, "#c8d4ff", 0.35);
                g.fillStyle = "#fff8dc"; g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill();
                g.fillStyle = P.sky[1]; g.beginPath(); g.arc(mx + mr * 0.4, my - mr * 0.2, mr * 0.9, 0, TAU); g.fill();
            } else {
                const sx = W * 0.3, sy = H * 0.1, sr = Math.min(W, H) * 0.05;
                Worlds.glow(g, sx, sy, sr * 7, "#fff6d0", 0.6); Worlds.glow(g, sx, sy, sr * 2.2, "#ffffff", 0.9);
                g.fillStyle = "#fffbe6"; g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.fill();
            }
            // the airship idling across
            if (ship) {
                ship.x += 8 * dt; if (ship.x > W + 160) ship.x = -160;
                const x = ship.x - inp.px * 4, y = ship.y + Math.sin(t * 0.5) * 6, sw = 70 * s;
                const eg = g.createLinearGradient(0, y - sw * 0.35, 0, y + sw * 0.35);
                eg.addColorStop(0, night ? "#6a6a8a" : "#f2e6cc"); eg.addColorStop(1, night ? "#3a3a5a" : "#c8a878");
                g.fillStyle = eg; g.beginPath(); g.ellipse(x, y, sw, sw * 0.32, 0, 0, TAU); g.fill();
                g.strokeStyle = "rgba(0,0,0,.15)"; g.lineWidth = 1; for (let i = -2; i <= 2; i++) { g.beginPath(); g.ellipse(x, y, sw * (1 - Math.abs(i) * 0.15), sw * 0.32, 0, i < 0 ? Math.PI / 2 : -Math.PI / 2, i < 0 ? Math.PI * 1.5 : Math.PI / 2); g.stroke(); }
                g.fillStyle = night ? "#3a2a3a" : "#8a5a3a"; g.beginPath(); g.moveTo(x - sw - 4, y); g.lineTo(x - sw - 22, y - 16); g.lineTo(x - sw - 22, y + 16); g.fill();
                g.fillStyle = night ? "#2a2030" : "#6a4a2a"; g.fillRect(x - 22, y + sw * 0.34, 44, 12);
                if (night) for (let i = 0; i < 4; i++) { g.fillStyle = "#ffd98a"; g.fillRect(x - 18 + i * 10, y + sw * 0.34 + 4, 5, 4); }
                const pr = Math.abs(Math.sin(t * 20)) * 10; g.fillStyle = "rgba(80,80,80,.5)"; g.beginPath(); g.ellipse(x - sw - 24, y, 3, pr, 0, 0, TAU); g.fill();
            }
            // islands (far ones first, hazed), each bobbing, waterfalls pouring off into mist
            for (const is of islands) {
                const bob = Math.sin(t * 0.5 + is.ph) * 8 * is.z, x = is.x - inp.px * 12 * is.z - is.img.width / 2, y = is.y + bob - is.img.topY;
                g.drawImage(is.img, x, y);
                for (let f = 0; f < is.falls; f++) {
                    const fx = x + is.img.width * (f ? 0.82 : 0.12), fy = y + is.img.topY + 4, len = H * 0.25 * is.z + 60;
                    const wg = g.createLinearGradient(0, fy, 0, fy + len); wg.addColorStop(0, P.water + ".85)"); wg.addColorStop(1, P.water + "0)");
                    g.fillStyle = wg; g.fillRect(fx - 5 * is.z, fy, 10 * is.z, len);
                    g.strokeStyle = P.water + ".9)"; g.lineWidth = 1;
                    for (let i = 0; i < 4; i++) { const q = (t * 1.5 + i / 4) % 1; g.beginPath(); g.moveTo(fx - 3 * is.z + i * 2 * is.z, fy + q * len * 0.8); g.lineTo(fx - 3 * is.z + i * 2 * is.z, fy + q * len * 0.8 + 14); g.stroke(); }
                    Worlds.glow(g, fx, fy + len * 0.85, 26 * is.z, night ? "#a8b8f0" : "#ffffff", 0.45);
                }
            }
            // a rope bridge between the village island and the castle (sagging, swaying)
            const a = islands[3], b = islands[2];
            if (a && b) {
                const ax = a.x - inp.px * 12 * a.z + a.img.width * 0.35, ay = a.y + Math.sin(t * 0.5 + a.ph) * 8 * a.z - 2;
                const bx = b.x - inp.px * 12 * b.z - b.img.width * 0.4, by = b.y + Math.sin(t * 0.5 + b.ph) * 8 * b.z - 2;
                g.strokeStyle = night ? "#3a2e2a" : "#7a5a3a"; g.lineWidth = 1.5;
                for (const off of [0, -12]) { g.beginPath(); g.moveTo(ax, ay + off); g.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + 60 + off + Math.sin(t) * 4, bx, by + off); g.stroke(); }
                for (let i = 1; i < 24; i++) { const u = i / 24, x = U.lerp(ax, bx, u), y = U.lerp(ay, by, u) + Math.sin(u * Math.PI) * (30 + Math.sin(t) * 2); g.fillStyle = night ? "#4a3a30" : "#a8784a"; g.fillRect(x - 3, y - 1, 6, 3); }
            }
            // cloud banks drifting below
            for (const bk of banks) { bk.x += bk.sp * dt; if (bk.x > 0) bk.x -= W * 0.6; g.drawImage(bk.img, bk.x - inp.px * 8, bk.y); }
            // hot-air balloons rising (day), paper lanterns (night)
            nextBalloon -= dt;
            if (nextBalloon <= 0) {
                nextBalloon = night ? U.rand(0.6, 1.4) : U.rand(5, 9);
                if (night) lanterns.push({ x: W * U.rand(0.05, 0.95), y: H + 20, sp: U.rand(14, 26), ph: Math.random() * 6 });
                else balloons.push({ x: W * U.rand(0.1, 0.9), y: H + 60, sp: U.rand(16, 26), s: U.rand(0.7, 1.2) * s, ph: Math.random() * 6, cols: U.pick([["#e8344e", "#ffcf3a"], ["#3aa8ff", "#ffffff"], ["#3ac48a", "#ffcf3a"], ["#b06aff", "#ff8af0"]]) });
            }
            for (const b2 of balloons) { b2.y -= b2.sp * dt; balloon(g, b2, t); }
            balloons = balloons.filter(b2 => b2.y > -120);
            for (const l of lanterns) {
                l.y -= l.sp * dt; l.x += Math.sin(t * 0.8 + l.ph) * 6 * dt;
                Worlds.glow(g, l.x, l.y, 16, "#ffb460", 0.6);
                g.fillStyle = "#ffcf7a"; g.beginPath(); g.moveTo(l.x - 5, l.y - 7); g.lineTo(l.x + 5, l.y - 7); g.lineTo(l.x + 4, l.y + 6); g.lineTo(l.x - 4, l.y + 6); g.fill();
            }
            lanterns = lanterns.filter(l => l.y > -30);
            if (!night) {
                nextBirds -= dt;
                if (nextBirds <= 0) { nextBirds = U.rand(10, 18); const y = H * U.rand(0.15, 0.35); for (let i = 0; i < 5; i++) birds.push({ x: -30 - i * 22, y: y + Math.abs(i - 2) * 10, ph: Math.random() * 6 }); }
                g.strokeStyle = "rgba(60,70,90,.6)"; g.lineWidth = 1.5;
                for (const bd of birds) { bd.x += 60 * dt; const f = Math.sin(t * 8 + bd.ph) * 4; g.beginPath(); g.moveTo(bd.x - 7, bd.y - f); g.quadraticCurveTo(bd.x - 3, bd.y - 2, bd.x, bd.y); g.quadraticCurveTo(bd.x + 3, bd.y - 2, bd.x + 7, bd.y - f); g.stroke(); }
                birds = birds.filter(bd => bd.x < W + 40);
            }
        }
    };
}
