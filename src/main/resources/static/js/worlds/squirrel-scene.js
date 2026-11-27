// Acorn Woods' background (squirrel.js uses it): a woodland clearing on an autumn afternoon.
//   Day: a golden sky with clouds lit from below and a low sun; hills far off stippled with autumn woods, mist in
//   the valley; trees at two depths with canopies built of thousands of leaves (lit gold on the sun's side,
//   rust in the shade), a path winding off between them, shafts of light through the gap with dust turning in
//   them; a forest floor of leaf litter dappled with light, a mossy log with shelf fungi, toadstools,
//   chanterelles, bronze ferns, a stump with acorns; a great oak on the left with ridged bark and a hollow, its
//   branch reaching over the top; leaves tumbling in the wind, geese going south, a squirrel running the branch
//   and another burying acorns. Night: a harvest moon, stars, the trees in silhouette with a rim of moonlight,
//   fog, fireflies, an owl blinking in the hollow.
//   SquirrelScene(W, H, opts, kit): kit = { leafPath, drawSquirrel } from squirrel.js
function SquirrelScene(W, H, opts, kit) {
    const night = opts.theme === "dark", preview = !!opts.preview, TAU = Math.PI * 2, M = 50;
    const LEAVES = ["#d9531e", "#f2a03d", "#b8321a", "#e8c547", "#c7702a", "#9c3d1c"];
    const P = night
        ? { sky: ["#0a0a24", "#1c1638", "#3a2448", "#5a3048"], hill: ["#2a2240", "#221a34"], haze: "90,70,120", leaf: ["#3a1a24", "#4a2028", "#5a2a2a", "#2a1420", "#2a1824"], lit: ["#7a6a8a", "#9a8aa8"], trunk: ["#2a1a18", "#140c0c"], floor: ["#2a1c1c", "#1a1014"], path: "#3a2c2a", rim: "255,200,150" }
        : { sky: ["#5a9ad8", "#a8c8e0", "#f4dcb0", "#f6b878"], hill: ["#b88a7a", "#a07068"], haze: "250,210,170", leaf: ["#c84a1e", "#e8862a", "#a8321a", "#e8b83a", "#8a2a18"], lit: ["#ffd060", "#ffb040"], trunk: ["#6a4a32", "#3a2618"], floor: ["#a8602a", "#7a3e1c"], path: "#c89a68", rim: "255,220,160" };
    let skyImg, farImg, midImg, oakImg, frontImg, branch = [], leaves = [], motes = [], flies = [], stars = [], dirt = [], rays = [];
    let geese = null, nextGeese = preview ? 1e9 : U.rand(4, 10), digger = null, nextDigger = preview ? 1e9 : U.rand(5, 10), runner = null, nextRunner = preview ? 1e9 : U.rand(3, 8);
    let owlNext = 3, owlBlink = 0, gust = 0, gustLeft = 0, nextGust = 10, sun = null;
    function paint(w, h, fn) { const c = Worlds.canvas(w, h), g = c.getContext("2d"); fn(g); return c; }
    // blends two "#rrggbb" colours; remembered, because the leaves and specks ask for the same few blends thousands of times
    const mixed = new Map(), rgbOf = new Map();
    const rgb = c => { let v = rgbOf.get(c); if (!v) rgbOf.set(c, v = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))); return v; };
    const mix = (a, b, t) => {
        const q = Math.round(t * 64), key = a + b + q;
        let v = mixed.get(key);
        if (!v) { const pa = rgb(a), pb = rgb(b); mixed.set(key, v = "#" + pa.map((x, i) => Math.round(x + (pb[i] - x) * q / 64).toString(16).padStart(2, "0")).join("")); }
        return v;
    };
    const k = () => (preview ? 0.5 : U.clamp(Math.min(W, H) / 900, 0.6, 1.15));

    // a canopy built of leaves: a dark mass, then leaf dabs lit on the sun's side (top right) and in shade below
    function canopy(g, cx, cy, rx, ry, R, fade, dabs) {
        const blobs = Array.from({ length: 7 }, () => [cx + (R() - 0.5) * rx * 1.2, cy + (R() - 0.5) * ry, rx * (0.35 + R() * 0.3)]);
        g.fillStyle = mix(mix(P.leaf[4], night ? "#0a0814" : "#5a1a10", 0.3), night ? "#2a2240" : "#e8c8a8", fade * 0.8);
        for (const [x, y, r] of blobs) { g.beginPath(); g.ellipse(x, y, r * 0.72, r * 0.58, 0, 0, TAU); g.fill(); }
        const n = Math.round(dabs * 1.6 * (preview ? 0.3 : 1));
        for (let i = 0; i < n; i++) {
            const [bx, by, br] = blobs[Math.floor(R() * blobs.length)], a = R() * TAU, d = Math.pow(R(), 0.6) * br * 1.02, x = bx + Math.cos(a) * d, y = by + Math.sin(a) * d * 0.8;
            const light = ((x - cx) / rx * 0.5 - (y - cy) / ry * 0.8 + 0.4) + (R() - 0.5) * 0.5;
            let col = light > 0.75 ? P.lit[R() < 0.5 ? 0 : 1] : light > 0.25 ? P.leaf[Math.floor(R() * 4)] : mix(P.leaf[Math.floor(R() * 5)], "#000000", 0.35);
            if (fade) col = mix(col, night ? "#2a2240" : "#e8c8a8", fade);
            const s = (2 + R() * 3.5) * (1 - fade * 0.5) * k();
            g.fillStyle = col; g.beginPath(); g.ellipse(x, y, s, s * 0.55, R() * Math.PI, 0, TAU); g.fill();
        }
        if (night) { g.strokeStyle = `rgba(${P.rim},.12)`; g.lineWidth = 1.5; for (const [x, y, r] of blobs) { g.beginPath(); g.arc(x, y, r * 0.95, -0.9, 0.1); g.stroke(); } }
    }
    function trunk(g, x, base, h, w, R, fade) {
        const tg = g.createLinearGradient(x - w, 0, x + w, 0);
        tg.addColorStop(0, mix(P.trunk[1], night ? "#2a2240" : "#e8c8a8", fade)); tg.addColorStop(0.65, mix(P.trunk[0], night ? "#2a2240" : "#e8c8a8", fade)); tg.addColorStop(1, mix(P.trunk[1], night ? "#2a2240" : "#e8c8a8", fade));
        g.fillStyle = tg; g.beginPath(); g.moveTo(x - w * 1.4, base); g.quadraticCurveTo(x - w, base - h * 0.1, x - w * 0.8, base - h); g.lineTo(x + w * 0.8, base - h); g.quadraticCurveTo(x + w, base - h * 0.1, x + w * 1.4, base); g.fill();
        g.strokeStyle = "rgba(0,0,0,.2)"; g.lineWidth = 1; for (let i = 0; i < 4; i++) { const xx = x + (R() - 0.5) * w; g.beginPath(); g.moveTo(xx, base); g.lineTo(xx + (R() - 0.5) * 4, base - h); g.stroke(); }
    }
    // A few canopies are painted once per depth and size and then stamped (flipped and stretched a little) for every
    // tree: painting thousands of leaves for each tree made the scene slow to build.
    const crowns = new Map();
    function crown(g, cx, cy, rx, ry, R, fade, dabs) {
        const key = `${fade}|${Math.round(Math.log(rx) / Math.log(1.25))}|${R() < 0.5 ? 0 : 1}`;
        let c = crowns.get(key);
        if (!c) {
            const w = Math.ceil(rx * 2.6), hh = Math.ceil(ry * 2.4);
            c = Worlds.canvas(w, hh);
            canopy(c.getContext("2d"), w / 2, hh / 2, rx, ry, R, fade, dabs);
            crowns.set(key, c);
        }
        const flip = R() < 0.5 ? -1 : 1, sx = rx * 2.6 / c.width * (0.9 + R() * 0.2), sy = ry * 2.4 / c.height * (0.9 + R() * 0.2);
        g.save(); g.translate(cx, cy); g.scale(flip * sx, sy); g.drawImage(c, -c.width / 2, -c.height / 2); g.restore();
    }
    function tree(g, x, base, h, R, fade, dabs) {
        const w = h * 0.045;
        trunk(g, x, base, h * 0.62, w, R, fade);
        g.strokeStyle = mix(P.trunk[0], night ? "#2a2240" : "#e8c8a8", fade); g.lineCap = "round";
        for (const sd of [-1, 1]) { g.lineWidth = w * 0.45; g.beginPath(); g.moveTo(x, base - h * 0.55); g.quadraticCurveTo(x + sd * h * 0.08, base - h * 0.64, x + sd * h * 0.15, base - h * 0.74); g.stroke(); }
        crown(g, x, base - h * 0.78, h * 0.36, h * 0.3, R, fade, dabs);
    }

    function setup() {
        const R = U.rng(3131), s = k(), LW = W + M * 2, GY = H * 0.68;
        sun = { x: W * 0.74, y: H * (night ? 0.24 : 0.32), r: Math.min(W, H) * (night ? 0.07 : 0.055) };
        skyImg = paint(W, H, g => {
            const sg = g.createLinearGradient(0, 0, 0, GY);
            P.sky.forEach((c, i) => sg.addColorStop(i / (P.sky.length - 1), c));
            g.fillStyle = sg; g.fillRect(0, 0, W, H);
            if (night) {
                for (let i = 0; i < (preview ? 60 : 280); i++) { const y = Math.pow(R(), 1.3) * GY * 0.8; g.fillStyle = `rgba(255,240,220,${(0.25 + R() * 0.55).toFixed(2)})`; g.fillRect(R() * W, y, R() < 0.1 ? 1.6 : 1, R() < 0.1 ? 1.6 : 1); }
                const { x: sx, y: sy, r: sr } = sun;                                      // the harvest moon
                Worlds.glow(g, sx, sy, sr * 4, "#ffb060", 0.4);
                const mf = g.createRadialGradient(sx - sr * 0.3, sy - sr * 0.3, sr * 0.1, sx, sy, sr); mf.addColorStop(0, "#ffe6b8"); mf.addColorStop(1, "#f0a050");
                g.fillStyle = mf; g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.fill();
                g.fillStyle = "rgba(170,90,40,.22)"; for (const [cx, cy, cr] of [[-0.35, -0.1, 0.2], [0.2, 0.3, 0.15], [0.3, -0.35, 0.1], [-0.1, 0.45, 0.08]]) { g.beginPath(); g.arc(sx + cx * sr, sy + cy * sr, cr * sr, 0, TAU); g.fill(); }
            } else {
                const { x: sx, y: sy, r: sr } = sun;
                for (const [rr, a] of [[sr * 12, 0.35], [sr * 4, 0.55], [sr * 1.8, 0.8]]) { const gg = g.createRadialGradient(sx, sy, 0, sx, sy, rr); gg.addColorStop(0, `rgba(255,240,200,${a})`); gg.addColorStop(1, "rgba(255,220,160,0)"); g.fillStyle = gg; g.fillRect(sx - rr, sy - rr, rr * 2, rr * 2); }
                g.fillStyle = "#fff6dc"; g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.fill();
                for (let i = 0; i < (preview ? 3 : 8); i++) {                               // long clouds lit gold and pink from below
                    const cx = R() * W, cy = H * (0.06 + R() * 0.22), cw = (160 + R() * 260), ch = cw * 0.16;
                    for (let p = 0; p < 9; p++) { const x = cx + (R() - 0.5) * cw, y = cy + (R() - 0.5) * ch, r = ch * (0.6 + R() * 0.6); const cg = g.createRadialGradient(x, y - r * 0.3, 0, x, y, r * 1.6); cg.addColorStop(0, "rgba(255,250,240,.55)"); cg.addColorStop(0.6, "rgba(255,200,170,.25)"); cg.addColorStop(1, "rgba(255,180,150,0)"); g.save(); g.scale(1, 0.55); g.fillStyle = cg; g.beginPath(); g.arc(x, y / 0.55, r * 1.6, 0, TAU); g.fill(); g.restore(); }
                }
            }
        });
        // far: hills stippled with autumn woods, mist in the valley
        farImg = paint(LW, H, g => {
            for (const [base, amp, f, ph, col, fade] of [[GY - H * 0.12, H * 0.08, 0.004, 0.5, P.hill[0], 0.55], [GY - H * 0.06, H * 0.07, 0.006, 2.2, P.hill[1], 0.35]]) {
                const top = x => base - Math.sin(x * f + ph) * amp - Math.sin(x * f * 2.6) * amp * 0.25;
                g.fillStyle = col; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= LW; x += 8) g.lineTo(x, top(x)); g.lineTo(LW, H); g.fill();
                for (let i = 0; i < (preview ? 900 : 6000); i++) {
                    const x = R() * LW, y = top(x) + Math.pow(R(), 1.5) * H * 0.12, r = (0.8 + R() * 1.6) * s;
                    g.fillStyle = mix(P.leaf[Math.floor(R() * 5)], night ? "#2a2240" : "#e8c0a0", fade); g.beginPath(); g.arc(x, y - r * 0.5, r, 0, TAU); g.fill();
                }
                const hz = g.createLinearGradient(0, base - amp, 0, base + H * 0.1); hz.addColorStop(0, `rgba(${P.haze},0)`); hz.addColorStop(1, `rgba(${P.haze},${night ? 0.3 : 0.45})`);
                g.fillStyle = hz; g.fillRect(0, base - amp * 1.4, LW, amp * 1.4 + H * 0.1);
            }
        });
        // mid: trees at two depths with a gap where the path runs off, the forest floor, the props
        midImg = paint(LW, H, g => {
            for (let i = 0; i < (preview ? 6 : 14); i++) { const x = R() * LW; if (Math.abs(x - M - W * 0.52) < W * 0.09) continue; tree(g, x, GY - H * 0.02, H * (0.22 + R() * 0.08), R, 0.42, 500); }
            const fg = g.createLinearGradient(0, GY - H * 0.03, 0, H); fg.addColorStop(0, mix(P.floor[0], night ? "#2a2240" : "#e8c0a0", 0.3)); fg.addColorStop(0.3, P.floor[0]); fg.addColorStop(1, P.floor[1]);
            g.fillStyle = fg; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= LW; x += 10) g.lineTo(x, GY - H * 0.025 + Math.sin(x * 0.01) * 3); g.lineTo(LW, H); g.fill();
            // the path winding off between the trees
            const px0 = M + W * 0.52;
            g.fillStyle = P.path; g.globalAlpha = 0.75;
            g.beginPath(); g.moveTo(px0 - W * 0.01, GY - H * 0.02); g.bezierCurveTo(px0 + W * 0.05, GY + H * 0.08, px0 - W * 0.12, GY + H * 0.16, px0 - W * 0.04, H); g.lineTo(px0 + W * 0.2, H); g.bezierCurveTo(px0 + W * 0.02, GY + H * 0.16, px0 + W * 0.12, GY + H * 0.08, px0 + W * 0.01, GY - H * 0.02); g.fill();
            g.globalAlpha = 1;
            for (let i = 0; i < (preview ? 4 : 9); i++) { const x = R() * LW; if (Math.abs(x - px0) < W * 0.12) continue; tree(g, x, GY + H * 0.03, H * (0.34 + R() * 0.1), R, 0.12, 1100); }
            // leaf litter: leaves of a few kinds strewn over the floor
            for (let i = 0; i < (preview ? 600 : 3200); i++) {
                const x = R() * LW, y = GY + R() * (H - GY), sz = (2 + (y - GY) / (H - GY) * 6 + R() * 2) * s;
                g.save(); g.translate(x, y); g.rotate(R() * TAU); g.scale(1, 0.5);
                g.fillStyle = night ? mix(LEAVES[Math.floor(R() * 6)], "#1a1014", 0.6) : mix(LEAVES[Math.floor(R() * 6)], "#000000", R() * 0.3);
                kit.leafPath(g, sz, R() < 0.5); g.fill(); g.restore();
            }
            // a mossy log with shelf fungi
            {
                const lx = M + W * 0.2, ly = GY + H * 0.1, ll = 200 * s, lr = 22 * s;
                g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(lx, ly + lr, ll * 0.55, lr * 0.4, 0, 0, TAU); g.fill();
                const lg2 = g.createLinearGradient(0, ly - lr, 0, ly + lr); lg2.addColorStop(0, night ? "#4a3a30" : "#8a6a4a"); lg2.addColorStop(1, night ? "#1a1410" : "#3a2818");
                g.fillStyle = lg2; g.beginPath(); g.roundRect(lx - ll / 2, ly - lr, ll, lr * 2, lr); g.fill();
                g.fillStyle = night ? "#5a4a3a" : "#c8a070"; g.beginPath(); g.ellipse(lx + ll / 2 - lr * 0.4, ly, lr * 0.5, lr, 0, 0, TAU); g.fill();
                g.strokeStyle = night ? "#3a2a20" : "#8a6038"; g.lineWidth = 1; for (let r = 0.2; r < 1; r += 0.25) { g.beginPath(); g.ellipse(lx + ll / 2 - lr * 0.4, ly, lr * 0.5 * r, lr * r, 0, 0, TAU); g.stroke(); }
                g.fillStyle = night ? "#2a3a2a" : "#6a8a2a"; for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(lx - ll / 2 + R() * ll * 0.9, ly - lr * (0.6 + R() * 0.5), 3 + R() * 4, 0, TAU); g.fill(); }
                for (let i = 0; i < 4; i++) { const fx = lx - ll * 0.3 + i * ll * 0.14, fy = ly - lr * 0.1 + (i % 2) * 6; g.fillStyle = night ? "#6a5a4a" : "#e8c890"; g.beginPath(); g.ellipse(fx, fy, 12 * s, 4 * s, 0, Math.PI, TAU); g.fill(); g.strokeStyle = night ? "#3a2a20" : "#a87a40"; g.beginPath(); g.ellipse(fx, fy, 9 * s, 2.5 * s, 0, Math.PI, TAU); g.stroke(); }
            }
            // a stump with acorns, bronze ferns
            {
                const sx = M + W * 0.84, sy = GY + H * 0.12, sw = 50 * s, sh2 = 36 * s;
                const sg = g.createLinearGradient(sx - sw, 0, sx + sw, 0); sg.addColorStop(0, P.trunk[0]); sg.addColorStop(1, P.trunk[1]);
                g.fillStyle = sg; g.beginPath(); g.moveTo(sx - sw * 1.2, sy + 6); g.lineTo(sx - sw, sy - sh2); g.lineTo(sx + sw, sy - sh2); g.lineTo(sx + sw * 1.25, sy + 6); g.fill();
                g.fillStyle = night ? "#5a4a3a" : "#d8b080"; g.beginPath(); g.ellipse(sx, sy - sh2, sw, sw * 0.28, 0, 0, TAU); g.fill();
                g.strokeStyle = night ? "#3a2a20" : "#a87a48"; g.lineWidth = 1; for (let r = 0.25; r < 1; r += 0.18) { g.beginPath(); g.ellipse(sx, sy - sh2, sw * r, sw * 0.28 * r, 0, 0, TAU); g.stroke(); }
                for (const [dx, dy] of [[-14, -2], [6, 4], [18, -4]]) { const ax = sx + dx * s, ay = sy - sh2 + dy * s; g.fillStyle = night ? "#6a4a2a" : "#b07a3a"; g.beginPath(); g.ellipse(ax, ay, 5 * s, 6 * s, 0, 0, TAU); g.fill(); g.fillStyle = night ? "#3a2a18" : "#6b4220"; g.beginPath(); g.ellipse(ax, ay - 4 * s, 6 * s, 3.4 * s, 0, Math.PI, TAU); g.closePath(); g.fill(); }
            }
            for (let i = 0; i < (preview ? 4 : 12); i++) {
                const fx = M + (R() < 0.5 ? R() * W * 0.3 : W * (0.7 + R() * 0.3)), fy = GY + H * (0.06 + R() * 0.2), fl = (30 + R() * 30) * s;
                for (let f = 0; f < 5; f++) { const a = -Math.PI / 2 + (f - 2) * 0.45; g.strokeStyle = night ? "#3a2a1a" : (f % 2 ? "#b8762a" : "#c88a3a"); g.lineWidth = 1.4; g.beginPath(); g.moveTo(fx, fy); g.quadraticCurveTo(fx + Math.cos(a) * fl * 0.6, fy + Math.sin(a) * fl * 0.7 - 6, fx + Math.cos(a) * fl, fy + Math.sin(a) * fl * 0.6 + 10); g.stroke(); for (let q = 2; q < 9; q++) { const u = q / 9, px = fx + Math.cos(a) * fl * u, py = fy + Math.sin(a) * fl * u * 0.75 + u * u * 8; g.beginPath(); g.moveTo(px, py); g.lineTo(px + 5 * (1 - u) * s, py + 4); g.moveTo(px, py); g.lineTo(px - 5 * (1 - u) * s, py + 4); g.stroke(); } }
            }
            const toad = (x, y, sz) => { g.fillStyle = night ? "#c8c0b0" : "#f4efe4"; g.fillRect(x - sz * 0.18, y - sz * 0.9, sz * 0.36, sz * 0.9); const cg = g.createRadialGradient(x - sz * 0.2, y - sz * 1.1, 0, x, y - sz, sz * 0.7); cg.addColorStop(0, night ? "#a84040" : "#ff5a3a"); cg.addColorStop(1, night ? "#5a1a1a" : "#b8201a"); g.fillStyle = cg; g.beginPath(); g.ellipse(x, y - sz * 0.9, sz * 0.62, sz * 0.38, 0, Math.PI, TAU); g.fill(); g.fillStyle = "#ffffff"; for (const [dx, dy] of [[-0.3, -1.05], [0.1, -1.15], [0.35, -0.98], [-0.05, -0.98]]) { g.beginPath(); g.arc(x + dx * sz, y + dy * sz, sz * 0.06, 0, TAU); g.fill(); } };
            for (const [x, y, sz] of [[0.3, 0.86, 26], [0.33, 0.88, 18], [0.68, 0.9, 22], [0.12, 0.93, 30]]) toad(M + W * x, H * y, sz * s);
            for (let i = 0; i < 5; i++) { const x = M + W * (0.62 + R() * 0.08), y = H * (0.82 + R() * 0.05), sz = (8 + R() * 6) * s; g.fillStyle = night ? "#8a6a3a" : "#f0a830"; g.beginPath(); g.moveTo(x - sz * 0.2, y); g.lineTo(x - sz * 0.6, y - sz); g.quadraticCurveTo(x, y - sz * 1.3, x + sz * 0.6, y - sz); g.lineTo(x + sz * 0.2, y); g.fill(); }
            const dv = g.createRadialGradient(M + W / 2, H * 0.6, H * 0.3, M + W / 2, H * 0.6, H * 0.9); dv.addColorStop(0, "rgba(0,0,0,0)"); dv.addColorStop(1, `rgba(0,0,0,${night ? 0.4 : 0.2})`);
            g.fillStyle = dv; g.fillRect(0, GY - H * 0.1, LW, H);
        });
        // the great oak on the left: ridged bark, roots, the hollow, a branch reaching over the top with its leaves
        oakImg = paint(LW, H, g => {
            const ox = M + W * 0.05, ow = Math.max(60, W * 0.065);
            const tg = g.createLinearGradient(ox - ow, 0, ox + ow, 0); tg.addColorStop(0, P.trunk[1]); tg.addColorStop(0.6, P.trunk[0]); tg.addColorStop(1, mix(P.trunk[0], "#ffffff", night ? 0.05 : 0.15));
            g.fillStyle = tg;
            g.beginPath(); g.moveTo(ox - ow * 1.9, H); g.quadraticCurveTo(ox - ow * 1.1, H * 0.86, ox - ow, H * 0.5); g.lineTo(ox - ow * 0.85, -10); g.lineTo(ox + ow * 0.85, -10); g.lineTo(ox + ow, H * 0.5); g.quadraticCurveTo(ox + ow * 1.2, H * 0.86, ox + ow * 2.2, H); g.fill();
            g.strokeStyle = "rgba(0,0,0,.28)"; g.lineCap = "round";
            for (let i = 0; i < 26; i++) { const x0 = ox + (R() - 0.5) * ow * 1.8; let y = H * R(); g.lineWidth = 1 + R() * 2.4; g.beginPath(); g.moveTo(x0, y); let x = x0; for (let j = 0; j < 8; j++) { y -= H * 0.03; x += (R() - 0.5) * 5; g.lineTo(x, y); } g.stroke(); }
            g.strokeStyle = night ? `rgba(${P.rim},.18)` : "rgba(255,220,160,.25)"; g.lineWidth = 2; g.beginPath(); g.moveTo(ox + ow * 0.84, -10); g.lineTo(ox + ow * 0.98, H * 0.5); g.quadraticCurveTo(ox + ow * 1.2, H * 0.86, ox + ow * 2.1, H); g.stroke();
            g.fillStyle = night ? "#2a3a2a" : "#6a7a2a"; g.globalAlpha = 0.6; for (let i = 0; i < 60; i++) { g.beginPath(); g.arc(ox - ow * 0.9 + R() * ow * 0.5, H * (0.3 + R() * 0.6), 2 + R() * 4, 0, TAU); g.fill(); } g.globalAlpha = 1;
            g.fillStyle = "#140a06"; g.beginPath(); g.ellipse(ox + ow * 0.1, H * 0.5, ow * 0.32, ow * 0.5, 0, 0, TAU); g.fill();       // the hollow
            g.strokeStyle = P.trunk[0]; g.lineWidth = ow * 0.12; g.beginPath(); g.ellipse(ox + ow * 0.1, H * 0.5, ow * 0.36, ow * 0.55, 0, 0, TAU); g.stroke();
            V.owl = [ox + ow * 0.1 - M, H * 0.49, ow * 0.1];
            // the branch over the top
            branch = [];
            g.strokeStyle = P.trunk[0]; g.lineCap = "round";
            const bx0 = ox + ow * 0.5, by0 = H * 0.14;
            for (let i = 0; i <= 30; i++) { const u = i / 30, x = bx0 + u * W * 0.42, y = by0 - Math.sin(u * Math.PI * 0.8) * H * 0.05 + u * u * H * 0.04; branch.push([x - M, y]); }
            for (let i = 0; i < branch.length - 1; i++) { g.lineWidth = Math.max(3, (1 - i / 30) * ow * 0.5); g.beginPath(); g.moveTo(branch[i][0] + M, branch[i][1]); g.lineTo(branch[i + 1][0] + M, branch[i + 1][1]); g.stroke(); }
            g.strokeStyle = night ? `rgba(${P.rim},.15)` : "rgba(255,220,160,.3)"; g.lineWidth = 2; g.beginPath(); branch.forEach(([x, y], i) => g[i ? "lineTo" : "moveTo"](x + M, y - 4)); g.stroke();
            for (let i = 0; i < 6; i++) crown(g, bx0 + W * (0.02 + i * 0.075), by0 - H * 0.1 + (i % 2) * H * 0.04, W * 0.07, H * 0.08, R, 0, 700);
            canopy(g, ox, H * 0.02, ow * 3, H * 0.12, R, 0, 900);
            canopy(g, M + W * 1.0, H * 0.02, W * 0.16, H * 0.14, R, 0, 1100);
        });
        rays = night ? null : paint(W, H, g => {                                       // shafts of light from the sun through the gap
            const sx = sun.x, sy = sun.y, len = Math.hypot(W, H);
            for (let i = 0; i < (preview ? 3 : 7); i++) {
                const a = Math.PI * (0.62 + R() * 0.28), w = 0.012 + R() * 0.03, al = 0.05 + R() * 0.03;
                const rg = g.createLinearGradient(sx, sy, sx + Math.cos(a) * len * 0.7, sy + Math.sin(a) * len * 0.7);
                rg.addColorStop(0, `rgba(255,225,160,${(al * 2).toFixed(3)})`); rg.addColorStop(1, "rgba(255,225,160,0)");
                g.fillStyle = rg; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + Math.cos(a - w) * len, sy + Math.sin(a - w) * len); g.lineTo(sx + Math.cos(a + w) * len, sy + Math.sin(a + w) * len); g.fill();
            }
        });
        leaves = Array.from({ length: preview ? 14 : 50 }, () => ({ x: R() * W, y: R() * H, s: 3 + R() * 6, depth: 0.5 + R() * 0.9, rot: R() * TAU, spin: (R() - 0.5) * 4, flip: R() * TAU, sway: R() * TAU, c: LEAVES[Math.floor(R() * LEAVES.length)], pointy: R() < 0.5 }));
        motes = night ? [] : Array.from({ length: preview ? 10 : 40 }, () => ({ x: W * (0.45 + R() * 0.35), y: H * (0.3 + R() * 0.6), ph: R() * TAU, sp: 2 + R() * 4 }));
        flies = night ? Array.from({ length: preview ? 8 : 28 }, () => ({ x: R() * W, y: H * (0.5 + R() * 0.45), ph: R() * TAU, sp: 0.4 + R() })) : [];
        stars = night ? Array.from({ length: preview ? 0 : 30 }, () => ({ x: R() * W, y: Math.pow(R(), 1.3) * H * 0.4, r: 1 + R(), ph: R() * TAU, sp: 0.5 + R() })) : [];
    }
    const V = {};
    setup();

    return {
        resize(w, h) { W = w; H = h; setup(); },
        draw(g, t, dt, inp) {
            const px = inp.px || 0, GY = H * 0.68;
            nextGust -= dt;
            if (nextGust <= 0 && gustLeft <= 0) { gustLeft = 3; nextGust = U.rand(16, 28); }
            if (gustLeft > 0) { gustLeft -= dt; gust = Math.sin(Math.PI * (1 - gustLeft / 3)) * 160; } else gust = 0;
            const wind = 18 + Math.sin(t * 0.21) * 16 + gust;
            g.drawImage(skyImg, 0, 0);
            for (const st of stars) Worlds.twinkle(g, st.x - px * 2, st.y, st.r, 0.5 + 0.5 * Math.sin(t * st.sp + st.ph), "#fff0dc");
            if (!night) {                                                                // geese going south in a V
                nextGeese -= dt;
                if (!geese && nextGeese <= 0) geese = { x: W + 40, y: H * U.rand(0.08, 0.2), vx: -U.rand(45, 70), n: 5 + Math.floor(Math.random() * 4) };
                if (geese) {
                    geese.x += geese.vx * dt;
                    for (let i = 0; i < geese.n; i++) {
                        const kk = Math.ceil(i / 2) * (i % 2 ? 1 : -1), gx = geese.x + Math.abs(kk) * 18, gy = geese.y + kk * 10, f = Math.sin(t * 7 + i) * 5;
                        g.fillStyle = "rgba(60,44,36,.8)"; g.beginPath(); g.ellipse(gx, gy, 5, 1.8, -0.1, 0, TAU); g.fill();
                        g.strokeStyle = "rgba(60,44,36,.8)"; g.lineWidth = 1.6; g.lineCap = "round"; g.beginPath(); g.moveTo(gx - 1, gy); g.lineTo(gx + 3, gy - f - 5); g.moveTo(gx - 1, gy); g.lineTo(gx - 3, gy - f - 5); g.moveTo(gx - 5, gy); g.lineTo(gx - 9, gy - 1); g.stroke();
                    }
                    if (geese.x < -200) { geese = null; nextGeese = U.rand(20, 34); }
                }
            }
            g.drawImage(farImg, -M - px * 4, 0);
            if (rays) { g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.8 + 0.2 * Math.sin(t * 0.4); g.drawImage(rays, -px * 4, 0); g.restore(); }
            const mo = -M - px * 8;
            g.drawImage(midImg, mo, 0);
            if (!night) for (const m of motes) {                                          // dust turning in the light
                const x = m.x + Math.sin(t * 0.3 + m.ph) * 20 - px * 8, y = m.y + Math.sin(t * 0.2 + m.ph * 2) * 14, a = 0.3 + 0.3 * Math.sin(t * m.sp * 0.4 + m.ph);
                g.fillStyle = `rgba(255,240,200,${a.toFixed(2)})`; g.beginPath(); g.arc(x, y, 1.2, 0, TAU); g.fill();
                if (a > 0.55) Worlds.glint(g, x, y, 4, (a - 0.55) * 4, "#fff4d0");
            }
            if (night) {
                const fog = g.createLinearGradient(0, GY - H * 0.1, 0, H);
                fog.addColorStop(0, "rgba(140,120,170,0)"); fog.addColorStop(0.5, `rgba(140,120,170,${(0.18 + Math.sin(t * 0.3) * 0.05).toFixed(3)})`); fog.addColorStop(1, "rgba(140,120,170,0)");
                g.fillStyle = fog; g.fillRect(0, GY - H * 0.1, W, H);
                for (const f of flies) {                                                   // fireflies
                    const x = f.x + Math.sin(t * f.sp + f.ph) * 30 - px * 8, y = f.y + Math.sin(t * f.sp * 1.3 + f.ph * 2) * 18, a = Math.max(0, Math.sin(t * 1.6 + f.ph * 3));
                    if (a > 0.05) { Worlds.glow(g, x, y, 10, "#e8ff8a", a * 0.8); g.fillStyle = `rgba(250,255,200,${a.toFixed(2)})`; g.beginPath(); g.arc(x, y, 1.3, 0, TAU); g.fill(); }
                }
            }
            nextDigger -= dt;                                                             // a squirrel buries an acorn and dashes off
            if (!digger && nextDigger <= 0) { const dir = Math.random() < 0.5 ? 1 : -1; digger = { dir, x: dir > 0 ? -40 : W + 40, y: GY + (H - GY) * U.rand(0.35, 0.6), stopAt: W * U.rand(0.25, 0.75), state: "in", t: 0, s: U.clamp(H / 700, 0.7, 1.5) }; }
            if (digger) {
                const d = digger; d.t += dt;
                if (d.state === "in") { d.x += d.dir * 140 * dt; if ((d.dir > 0 && d.x >= d.stopAt) || (d.dir < 0 && d.x <= d.stopAt)) { d.state = "dig"; d.t = 0; } }
                else if (d.state === "dig") { if (Math.random() < dt * 30) dirt.push({ x: d.x + d.dir * 6 * d.s, y: d.y, vx: -d.dir * U.rand(20, 80), vy: -U.rand(60, 140), life: 0.6 }); if (d.t > 1.6) { d.state = "out"; d.dir = -d.dir; } }
                else { d.x += d.dir * 180 * dt; if (d.x < -60 || d.x > W + 60) { digger = null; nextDigger = U.rand(18, 32); } }
                if (digger) kit.drawSquirrel(g, d.x - px * 8, d.y, d.s, d.dir, d.state === "dig" ? (d.t * 4) % 1 * 0.3 : (t * 3.2) % 1, Math.sin(t * 6), d.state === "in");
            }
            dirt = dirt.filter(p => { p.life -= dt; p.vy += 400 * dt; p.x += p.vx * dt; p.y += p.vy * dt; g.fillStyle = `rgba(90,55,30,${Math.max(0, p.life).toFixed(2)})`; g.fillRect(p.x - px * 8, p.y, 3, 3); return p.life > 0; });
            const oo = -M - px * 14;
            g.drawImage(oakImg, oo, 0);
            if (night && V.owl) {                                                         // the owl blinking in the hollow
                owlNext -= dt; if (owlNext <= 0) { owlBlink = 0.18; owlNext = U.rand(2, 5); } owlBlink -= dt;
                const [ox, oy, os] = V.owl, x = ox - px * 14;
                for (const sd of [-1, 1]) { const ex = x + sd * os * 1.3; Worlds.glow(g, ex, oy, os * 3, "#ffcf3f", 0.4); g.fillStyle = "#ffcf3f"; if (owlBlink > 0) g.fillRect(ex - os * 0.8, oy - 1, os * 1.6, 2); else { g.beginPath(); g.arc(ex, oy, os * 0.8, 0, TAU); g.fill(); g.fillStyle = "#1a1008"; g.beginPath(); g.arc(ex, oy, os * 0.35, 0, TAU); g.fill(); } }
            }
            nextRunner -= dt;                                                             // a squirrel running the branch
            if (!runner && nextRunner <= 0 && branch.length) runner = { u: 0.05, dir: 1, state: "run", t: 0 };
            if (runner) {
                const r = runner; r.t += dt;
                if (r.state === "run") { r.u += r.dir * dt * 0.22; if (r.u >= 0.85) { r.u = 0.85; r.state = "sit"; r.t = 0; } if (r.u <= 0.05 && r.dir < 0) { runner = null; nextRunner = U.rand(12, 22); } }
                else if (r.t > 2.2) { r.state = "run"; r.dir = -1; }
                if (runner) { const i = Math.min(branch.length - 1, Math.floor(r.u * (branch.length - 1))), [bx, by] = branch[i]; kit.drawSquirrel(g, bx - px * 14, by - 6, U.clamp(H / 900, 0.55, 1.1), r.dir, r.state === "run" ? (t * 3.5) % 1 : 0, r.state === "sit" ? Math.sin(t * 14) : Math.sin(t * 5), false); }
            }
            for (const l of leaves) {                                                     // leaves tumbling on the wind
                l.y += (24 + l.s * 3) * l.depth * dt; l.x += (wind * l.depth + Math.sin(t * 1.4 + l.sway) * 26) * dt; l.rot += l.spin * dt; l.flip += dt * 3;
                if (l.y > H + 12) { l.y = -12; l.x = Math.random() * W; }
                if (l.x > W + 14) l.x -= W + 28; else if (l.x < -14) l.x += W + 28;
                const sz = l.s * l.depth;
                g.save(); g.translate(l.x - px * 10 * l.depth, l.y); g.rotate(l.rot); g.scale(1, Math.abs(Math.cos(l.flip)) * 0.85 + 0.15);
                const lc = night ? mix(l.c, "#1a1014", 0.5) : l.c;
                g.fillStyle = lc; kit.leafPath(g, sz, l.pointy); g.fill();
                if (sz > 3.5) { g.strokeStyle = "rgba(70,30,8,.45)"; g.lineWidth = Math.max(0.6, sz * 0.09); g.beginPath(); g.moveTo(-sz * 1.3, 0); g.lineTo(sz * 0.8, 0); if (l.pointy) { g.moveTo(0, 0); g.lineTo(sz * 0.5, -sz * 0.5); g.moveTo(0, 0); g.lineTo(sz * 0.5, sz * 0.5); } g.stroke(); }
                g.restore();
            }
        }
    };
}
