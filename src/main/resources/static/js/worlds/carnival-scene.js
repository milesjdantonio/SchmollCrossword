// The Big Top Carnival's background (carnival.js uses it). A fairground in depth: a roller coaster's lattice far
// off, a big Ferris wheel turning with its gondolas swinging, the big top (striped canvas with folds in its
// light and shade, a scalloped valance, flags flying, a warm glow inside the entrance), a carousel whose horses
// ride up and down under its striped canopy, game booths with prizes, a popcorn cart steaming, strings of
// pennants and lights swaying overhead, balloons slipping away, and a sawdust path. Day: a bright fair under
// drifting clouds. Night: everything outlined in bulbs (the wheel's chase round), searchlights sweeping, and
// fireworks over the tent.
function CarnivalScene(W, H, opts) {
    const night = opts.theme === "dark", preview = !!opts.preview, TAU = Math.PI * 2;
    const P = night
        ? { sky: ["#08061c", "#1a1440", "#3a2458", "#5a2a50"], ground: ["#1a2418", "#0f160e"], path: "#3a3024", red: "#9a2030", white: "#c8c0d8", far: "#2a2440", gold: "#ffcf3a" }
        : { sky: ["#3f8fe0", "#7fbcef", "#bfe1f7", "#e8f4fb"], ground: ["#7cc35a", "#5fa844"], path: "#e8cf98", red: "#e2343e", white: "#fbf6ee", far: "#9fb8d0", gold: "#ffcf3a" };
    let sky = null, layers = null, clouds = [], balloons = [], fireworks = [], nextFw = 2, nextBalloon = preview ? 999 : 3, wheel = null, carousel = null, tent = null, pennants = [], lights = [];
    const k = () => (preview ? 0.5 : U.clamp(Math.min(W, H) / 900, 0.6, 1.1));
    const GROUND = () => H * 0.82;
    function paint(w, h, fn) { const c = Worlds.canvas(w, h), g = c.getContext("2d"); fn(g); return c; }

    function setup() {
        const R = U.rng(31415), s = k(), gy = GROUND();
        tent = { x: W * 0.36, y: gy, w: Math.min(W * 0.36, 520 * s), h: Math.min(H * 0.42, 340 * s) };
        wheel = { x: W * 0.82, y: gy - Math.min(H * 0.34, 300 * s), r: Math.min(H * 0.3, 250 * s), n: 12 };
        carousel = { x: W * 0.09, y: gy, w: Math.min(W * 0.18, 230 * s), h: Math.min(H * 0.2, 170 * s) };
        layers = {
            back: paint(W, H, g => {
                // a roller coaster's lattice, far off and pale
                g.strokeStyle = P.far; g.lineWidth = 2;
                const track = x => gy - H * 0.12 - Math.abs(Math.sin(x * 0.006 + 1)) * H * 0.18;
                g.beginPath(); for (let x = W * 0.5; x < W; x += 8) g[x > W * 0.5 ? "lineTo" : "moveTo"](x, track(x)); g.stroke();
                g.lineWidth = 1;
                for (let x = W * 0.5; x < W; x += 22) { const y = track(x); g.beginPath(); g.moveTo(x, y); g.lineTo(x, gy - H * 0.05); g.moveTo(x, y); g.lineTo(x + 22, gy - H * 0.05); g.stroke(); }
                // the ground: grass, darker toward the front, and a sawdust path winding to the tent
                const gg = g.createLinearGradient(0, gy - H * 0.05, 0, H);
                gg.addColorStop(0, P.ground[0]); gg.addColorStop(1, P.ground[1]);
                g.fillStyle = gg; g.fillRect(0, gy - H * 0.05, W, H);
                g.fillStyle = P.path;
                g.beginPath(); g.moveTo(tent.x - tent.w * 0.08, gy); g.lineTo(tent.x + tent.w * 0.08, gy); g.quadraticCurveTo(tent.x + W * 0.1, H * 0.92, tent.x + W * 0.2, H + 10); g.lineTo(tent.x - W * 0.2, H + 10); g.quadraticCurveTo(tent.x - W * 0.08, H * 0.92, tent.x - tent.w * 0.08, gy); g.fill();
                g.fillStyle = night ? "rgba(255,230,180,.06)" : "rgba(150,110,60,.2)";
                for (let i = 0; i < 300; i++) { const x = tent.x + (R() - 0.5) * W * 0.4, y = gy + R() * (H - gy); g.fillRect(x, y, 1.6, 1.2); }
                // game booths between the tent and the wheel: striped awnings, shelves of prizes
                for (let i = 0; i < 3; i++) {
                    const bx = W * (0.56 + i * 0.075), bw = 70 * s, bh = 70 * s, by = gy - bh;
                    g.fillStyle = night ? "#3a2a30" : "#c89a6a"; g.fillRect(bx, by, bw, bh);
                    g.fillStyle = night ? "#1a1418" : "#5a3a2a"; g.fillRect(bx + 6 * s, by + 16 * s, bw - 12 * s, bh * 0.45);
                    for (let j = 0; j < 6; j++) { g.fillStyle = ["#ff5a6a", "#ffcf3a", "#3aa8ff", "#3ac48a", "#b06aff", "#ff8a3a"][(i + j) % 6]; g.beginPath(); g.arc(bx + 12 * s + j * 9 * s, by + 30 * s, 4.5 * s, 0, TAU); g.fill(); }
                    for (let j = 0; j < 6; j++) { g.fillStyle = j % 2 ? P.white : ["#e2343e", "#2f7ad8", "#2f9a5a"][i]; g.beginPath(); g.moveTo(bx - 4 + (j * (bw + 8)) / 6, by); g.lineTo(bx - 4 + ((j + 1) * (bw + 8)) / 6, by); g.lineTo(bx - 4 + ((j + 1) * (bw + 8)) / 6, by + 14 * s); g.quadraticCurveTo(bx - 4 + ((j + 0.5) * (bw + 8)) / 6, by + 20 * s, bx - 4 + (j * (bw + 8)) / 6, by + 14 * s); g.fill(); }
                }
            }),
            tent: paint(W, H, g => {
                // the big top: a striped cone roof over a striped drum, folds shaded, a scalloped valance, a doorway
                const { x, y, w, h } = tent, roofH = h * 0.5, wallH = h * 0.42, wallTop = y - wallH, peakY = wallTop - roofH;
                const stripes = 14;
                for (let i = 0; i < stripes; i++) {
                    const u0 = i / stripes, u1 = (i + 1) / stripes, x0 = x - w / 2 + u0 * w, x1 = x - w / 2 + u1 * w;
                    g.fillStyle = i % 2 ? P.white : P.red; g.fillRect(x0, wallTop, x1 - x0 + 0.5, wallH);
                    g.beginPath(); g.moveTo(x, peakY); g.lineTo(x - w / 2 * 1.08 + u0 * w * 1.08, wallTop); g.lineTo(x - w / 2 * 1.08 + u1 * w * 1.08, wallTop); g.closePath(); g.fill();
                }
                // shading across the round: light on the left, deep on the right, and folds between stripes
                for (const [y0, y1, pts] of [[wallTop, y, null], [peakY, wallTop, true]]) {
                    const sh = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
                    sh.addColorStop(0, "rgba(255,255,255,.18)"); sh.addColorStop(0.35, "rgba(255,255,255,0)"); sh.addColorStop(0.75, "rgba(0,0,0,.15)"); sh.addColorStop(1, "rgba(0,0,0,.38)");
                    g.fillStyle = sh;
                    if (pts) { g.beginPath(); g.moveTo(x, peakY); g.lineTo(x - w * 0.54, wallTop); g.lineTo(x + w * 0.54, wallTop); g.fill(); }
                    else g.fillRect(x - w / 2, y0, w, y1 - y0);
                }
                g.strokeStyle = "rgba(0,0,0,.12)"; g.lineWidth = 1;
                for (let i = 1; i < stripes; i++) { const xx = x - w / 2 + (i / stripes) * w; g.beginPath(); g.moveTo(xx, wallTop); g.lineTo(xx, y); g.stroke(); }
                // the valance: gold-trimmed scallops along the roof's edge
                const n = 16;
                for (let i = 0; i < n; i++) {
                    const x0 = x - w * 0.54 + (i / n) * w * 1.08, x1 = x0 + (w * 1.08) / n;
                    g.fillStyle = i % 2 ? P.red : P.white; g.beginPath(); g.moveTo(x0, wallTop); g.lineTo(x1, wallTop); g.quadraticCurveTo((x0 + x1) / 2, wallTop + 26 * k(), x0, wallTop); g.fill();
                    g.strokeStyle = P.gold; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x1, wallTop); g.quadraticCurveTo((x0 + x1) / 2, wallTop + 26 * k(), x0, wallTop); g.stroke();
                }
                // the doorway, held open, warm light inside
                const dw = w * 0.2, dh = wallH * 0.85;
                const dg = g.createLinearGradient(0, y - dh, 0, y);
                dg.addColorStop(0, night ? "#ffb860" : "#ffe0a0"); dg.addColorStop(1, night ? "#c86a20" : "#e8a050");
                g.fillStyle = dg; g.beginPath(); g.moveTo(x - dw / 2, y); g.lineTo(x - dw * 0.15, y - dh); g.lineTo(x + dw * 0.15, y - dh); g.lineTo(x + dw / 2, y); g.fill();
                g.fillStyle = P.red; g.beginPath(); g.moveTo(x - dw * 0.15, y - dh); g.quadraticCurveTo(x - dw * 0.55, y - dh * 0.3, x - dw * 0.62, y); g.lineTo(x - dw / 2, y); g.fill();
                g.beginPath(); g.moveTo(x + dw * 0.15, y - dh); g.quadraticCurveTo(x + dw * 0.55, y - dh * 0.3, x + dw * 0.62, y); g.lineTo(x + dw / 2, y); g.fill();
                g.strokeStyle = P.gold; g.lineWidth = 3; g.beginPath(); g.moveTo(x, peakY); g.lineTo(x, peakY - 34 * k()); g.stroke();
                const R = U.rng(77);
                // the popcorn cart, in front of the tent
                const px = W * 0.21, py = gy + 58 * s;
                g.fillStyle = "#c8282f"; g.fillRect(px - 26 * s, py - 46 * s, 52 * s, 34 * s);
                g.fillStyle = night ? "rgba(255,230,160,.85)" : "rgba(255,250,230,.9)"; g.fillRect(px - 20 * s, py - 72 * s, 40 * s, 28 * s);
                g.fillStyle = "#fff6d0"; for (let i = 0; i < 18; i++) { g.beginPath(); g.arc(px - 16 * s + R() * 32 * s, py - 52 * s - R() * 12 * s, 3 * s, 0, TAU); g.fill(); }
                g.fillStyle = "#c8282f"; g.beginPath(); g.moveTo(px - 28 * s, py - 72 * s); g.lineTo(px, py - 88 * s); g.lineTo(px + 28 * s, py - 72 * s); g.fill();
                g.fillStyle = "#2a2a30"; g.beginPath(); g.arc(px - 16 * s, py - 10 * s, 8 * s, 0, TAU); g.arc(px + 16 * s, py - 10 * s, 8 * s, 0, TAU); g.fill();
                tent.peak = { x, y: peakY - 34 * k() }; tent.wallTop = wallTop;
            })
        };
        clouds = night ? [] : Array.from({ length: preview ? 2 : 5 }, () => ({ x: R() * W, y: H * U.lerp(0.06, 0.28, R()), s: U.lerp(0.6, 1.1, R()) * s, sp: U.lerp(5, 11, R()) }));
        // strings of pennants and lights hung across the top
        pennants = [[0, H * 0.04, W * 0.5, H * 0.1], [W * 0.45, H * 0.08, W, H * 0.02]].map(([x0, y0, x1, y1]) => ({ x0, y0, x1, y1, sag: H * 0.07, ph: R() * TAU }));
        sky = null;
    }
    setup();

    const sagAt = (p, u, t) => [U.lerp(p.x0, p.x1, u), U.lerp(p.y0, p.y1, u) + Math.sin(u * Math.PI) * (p.sag + Math.sin(t * 1.2 + p.ph) * 4)];
    function cloud(g, c) {
        for (const [dx, dy, r] of [[0, 0, 34], [30, -14, 30], [62, 0, 30], [32, 6, 34]]) {
            const cg = g.createRadialGradient(c.x + dx * c.s - 8, c.y + dy * c.s - 10, 4, c.x + dx * c.s, c.y + dy * c.s, r * c.s);
            cg.addColorStop(0, "#ffffff"); cg.addColorStop(1, "rgba(220,232,245,.9)");
            g.fillStyle = cg; g.beginPath(); g.arc(c.x + dx * c.s, c.y + dy * c.s, r * c.s, 0, TAU); g.fill();
        }
    }
    return {
        resize(w, h) { W = w; H = h; setup(); },
        draw(g, t, dt, inp) {
            const s = k(), gy = GROUND();
            if (!sky) { sky = g.createLinearGradient(0, 0, 0, gy); P.sky.forEach((c, i) => sky.addColorStop(i / (P.sky.length - 1), c)); }
            g.fillStyle = sky; g.fillRect(0, 0, W, H);
            if (night) {                                           // searchlights sweeping from behind the tent
                for (const [x, ph] of [[W * 0.3, 0], [W * 0.62, 2]]) {
                    const a = -Math.PI / 2 + Math.sin(t * 0.4 + ph) * 0.5;
                    const lg = g.createLinearGradient(x, gy, x + Math.cos(a) * H, gy + Math.sin(a) * H);
                    lg.addColorStop(0, "rgba(255,240,200,.2)"); lg.addColorStop(1, "rgba(255,240,200,0)");
                    g.fillStyle = lg; g.beginPath(); g.moveTo(x, gy); g.lineTo(x + Math.cos(a - 0.06) * H * 1.2, gy + Math.sin(a - 0.06) * H * 1.2); g.lineTo(x + Math.cos(a + 0.06) * H * 1.2, gy + Math.sin(a + 0.06) * H * 1.2); g.fill();
                }
                nextFw -= dt;
                if (nextFw <= 0 && !preview) { nextFw = U.rand(1.5, 3.5); fireworks.push({ x: W * U.rand(0.2, 0.7), y: H * U.rand(0.12, 0.3), age: 0, c: U.pick(["#ff5a6a", "#ffcf3a", "#3aa8ff", "#3ac48a", "#ff8af0"]) }); }
                for (const f of fireworks) {
                    f.age += dt; const r = Math.min(1, f.age / 0.6) * 70 * s, a = Math.max(0, 1 - f.age / 1.6);
                    for (let i = 0; i < 18; i++) { const an = (i / 18) * TAU, x = f.x + Math.cos(an) * r, y = f.y + Math.sin(an) * r + f.age * f.age * 20; Worlds.glow(g, x, y, 6, f.c, a); }
                    Worlds.glow(g, f.x, f.y, r * 0.8, f.c, a * 0.25);
                }
                fireworks = fireworks.filter(f => f.age < 1.6);
            } else for (const c of clouds) { c.x += c.sp * dt; if (c.x > W + 120) c.x = -120; cloud(g, c); }
            g.drawImage(layers.back, -inp.px * 6, 0);
            // the Ferris wheel: rim, spokes and gondolas that hang level and swing a little
            const wl = wheel, wx = wl.x - inp.px * 6, rot = t * 0.12;
            g.strokeStyle = night ? "#6a5a8a" : "#c8ccd8"; g.lineWidth = 5;
            g.beginPath(); g.moveTo(wx - wl.r * 0.5, gy); g.lineTo(wx, wl.y); g.lineTo(wx + wl.r * 0.5, gy); g.stroke();
            g.lineWidth = 3; g.beginPath(); g.arc(wx, wl.y, wl.r, 0, TAU); g.stroke(); g.beginPath(); g.arc(wx, wl.y, wl.r * 0.92, 0, TAU); g.stroke();
            g.lineWidth = 1.4; g.beginPath();
            for (let i = 0; i < wl.n * 2; i++) { const a = rot + (i / (wl.n * 2)) * TAU; g.moveTo(wx, wl.y); g.lineTo(wx + Math.cos(a) * wl.r, wl.y + Math.sin(a) * wl.r); }
            g.stroke();
            for (let i = 0; i < wl.n; i++) {
                const a = rot + (i / wl.n) * TAU, x = wx + Math.cos(a) * wl.r, y = wl.y + Math.sin(a) * wl.r, sw = Math.sin(t * 1.4 + i) * 0.12, cs = 16 * s;
                g.save(); g.translate(x, y); g.rotate(sw);
                g.strokeStyle = night ? "#6a5a8a" : "#888"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, cs * 0.6); g.stroke();
                g.fillStyle = ["#ff5a6a", "#ffcf3a", "#3aa8ff", "#3ac48a", "#b06aff", "#ff8a3a"][i % 6];
                g.beginPath(); g.roundRect(-cs * 0.7, cs * 0.6, cs * 1.4, cs * 0.9, cs * 0.25); g.fill();
                g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(-cs * 0.55, cs * 0.7, cs * 1.1, cs * 0.18);
                g.restore();
            }
            if (night) for (let i = 0; i < 48; i++) {                   // bulbs round the rim, a light chasing round
                const a = rot + (i / 48) * TAU, on = (Math.floor(t * 8) + i) % 6 < 3;
                Worlds.glow(g, wx + Math.cos(a) * wl.r, wl.y + Math.sin(a) * wl.r, on ? 9 : 4, ["#ffcf3a", "#ff5a6a", "#3aa8ff"][i % 3], on ? 0.95 : 0.35);
            }
            g.fillStyle = night ? "#8a7aaa" : "#9aa0ac"; g.beginPath(); g.arc(wx, wl.y, 8 * s, 0, TAU); g.fill();
            // the big top, its flag, and its lights at night
            g.drawImage(layers.tent, -inp.px * 9, 0);
            if (tent.peak) {
                const fx = tent.peak.x - inp.px * 9, fy = tent.peak.y;
                g.fillStyle = P.gold; g.beginPath(); g.moveTo(fx, fy);
                for (let i = 0; i <= 8; i++) g.lineTo(fx + i * 5 * s, fy + Math.sin(t * 6 - i * 0.8) * 3 * s + (i === 8 ? 8 * s : 0));
                for (let i = 8; i >= 0; i--) g.lineTo(fx + i * 5 * s, fy + 14 * s + Math.sin(t * 6 - i * 0.8) * 3 * s - (i === 8 ? 6 * s : 0));
                g.fill();
                if (night) for (let i = 0; i < 16; i++) { const u = i / 15, x = tent.x - inp.px * 9 - tent.w * 0.54 + u * tent.w * 1.08; Worlds.glow(g, x, tent.wallTop + 4, 6, "#ffe28a", (Math.floor(t * 3) + i) % 2 ? 0.9 : 0.5); }
                Worlds.glow(g, tent.x - inp.px * 9, tent.y - tent.h * 0.2, tent.w * 0.18, "#ffb860", night ? 0.6 : 0.25);
            }
            // the carousel: a striped canopy over poles, horses riding up and down as it turns
            const c = carousel, cx = c.x - inp.px * 10, cy = c.y, top = cy - c.h;
            g.fillStyle = night ? "#3a2a40" : "#e8d6b8"; g.fillRect(cx - c.w / 2, cy - 12 * s, c.w, 12 * s);
            for (let i = 0; i < 7; i++) {
                const u = ((i / 7 + t * 0.06) % 1), x = cx - c.w * 0.45 + u * c.w * 0.9, bob = Math.sin(t * 2.2 + i * 1.7) * 9 * s, depth = Math.sin(u * Math.PI);
                g.strokeStyle = P.gold; g.lineWidth = 2; g.beginPath(); g.moveTo(x, top + 22 * s); g.lineTo(x, cy - 12 * s); g.stroke();
                g.save(); g.translate(x, cy - c.h * 0.45 + bob); g.scale(0.7 + depth * 0.3, 0.7 + depth * 0.3);
                g.fillStyle = ["#fbf6ee", "#ffcf3a", "#c88a5a"][i % 3];
                g.beginPath(); g.ellipse(0, 0, 18 * s, 8 * s, 0, 0, TAU); g.fill(); g.beginPath(); g.ellipse(16 * s, -10 * s, 6 * s, 9 * s, 0.6, 0, TAU); g.fill();
                g.strokeStyle = g.fillStyle; g.lineWidth = 3 * s; g.beginPath(); g.moveTo(-10 * s, 4 * s); g.lineTo(-14 * s, 16 * s); g.moveTo(10 * s, 4 * s); g.lineTo(14 * s, 14 * s); g.stroke();
                g.fillStyle = P.red; g.fillRect(-6 * s, -9 * s, 12 * s, 5 * s);
                g.restore();
            }
            for (let i = 0; i < 10; i++) {
                g.fillStyle = i % 2 ? P.white : P.red;
                g.beginPath(); g.moveTo(cx, top - 26 * s); g.lineTo(cx - c.w / 2 + (i / 10) * c.w, top + 20 * s); g.lineTo(cx - c.w / 2 + ((i + 1) / 10) * c.w, top + 20 * s); g.fill();
            }
            const csh = g.createLinearGradient(cx - c.w / 2, 0, cx + c.w / 2, 0); csh.addColorStop(0, "rgba(255,255,255,.15)"); csh.addColorStop(1, "rgba(0,0,0,.3)");
            g.fillStyle = csh; g.beginPath(); g.moveTo(cx, top - 26 * s); g.lineTo(cx - c.w / 2, top + 20 * s); g.lineTo(cx + c.w / 2, top + 20 * s); g.fill();
            if (night) for (let i = 0; i < 12; i++) Worlds.glow(g, cx - c.w / 2 + (i / 11) * c.w, top + 22 * s, 5, "#ffe28a", (Math.floor(t * 4) + i) % 2 ? 0.95 : 0.4);
            // pennants and string lights swaying overhead
            for (const p of pennants) {
                g.strokeStyle = night ? "#3a3050" : "#6a6a72"; g.lineWidth = 1.2;
                g.beginPath(); for (let i = 0; i <= 24; i++) { const [x, y] = sagAt(p, i / 24, t); g[i ? "lineTo" : "moveTo"](x, y); } g.stroke();
                for (let i = 0; i < 18; i++) {
                    const u = (i + 0.5) / 18, [x, y] = sagAt(p, u, t), sw = Math.sin(t * 2 + i) * 0.2;
                    g.save(); g.translate(x, y); g.rotate(sw);
                    g.fillStyle = ["#ff5a6a", "#ffcf3a", "#3aa8ff", "#3ac48a", "#b06aff", "#ff8a3a"][i % 6];
                    g.beginPath(); g.moveTo(-8 * s, 0); g.lineTo(8 * s, 0); g.lineTo(0, 18 * s); g.fill();
                    g.restore();
                    if (night && i % 2) Worlds.glow(g, x, y + 2, 6, "#fff0b0", 0.8);
                }
            }
            // balloons slipping away into the sky
            nextBalloon -= dt;
            if (nextBalloon <= 0) { nextBalloon = U.rand(5, 10); balloons.push({ x: W * U.rand(0.1, 0.9), y: gy, c: U.pick(["#ff5a6a", "#ffcf3a", "#3aa8ff", "#3ac48a", "#b06aff"]), ph: Math.random() * 6 }); }
            for (const b of balloons) {
                b.y -= 34 * dt; b.x += Math.sin(t + b.ph) * 12 * dt;
                const bg = g.createRadialGradient(b.x - 5, b.y - 7, 2, b.x, b.y, 16 * s);
                bg.addColorStop(0, "rgba(255,255,255,.8)"); bg.addColorStop(0.3, b.c); bg.addColorStop(1, b.c);
                g.fillStyle = bg; g.beginPath(); g.ellipse(b.x, b.y, 13 * s, 16 * s, 0, 0, TAU); g.fill();
                g.strokeStyle = "rgba(60,60,60,.5)"; g.lineWidth = 1; g.beginPath(); g.moveTo(b.x, b.y + 16 * s); g.quadraticCurveTo(b.x + 6, b.y + 30 * s, b.x - 2, b.y + 44 * s); g.stroke();
            }
            balloons = balloons.filter(b => b.y > -60);
        }
    };
}
