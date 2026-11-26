// The Garden's background (garden.js uses it): a whole countryside in layers. Day: a deep sky with haze at the
// horizon, a sun with soft bloom and slow rays, shaded clouds drifting; blue hills far off; patchwork fields with
// crop rows, hedgerows and tree clumps; a farmhouse with smoke from its chimney and a windmill whose sails turn;
// a pond holding the sky; a lane winding through; a lush near hill; and grass and wildflowers (daisies, tulips,
// poppies, lavender, dandelion clocks) swaying in the front, with butterflies, bees, birds and drifting seeds.
// Night: the same land under the moon and a band of stars, a lit window, mist in the dips and fireflies.
// Everything that doesn't move is painted once into layers; the frame lays them down with a little parallax.
function GardenScene(W, H, opts) {
    const night = opts.theme === "dark", preview = !!opts.preview, TAU = Math.PI * 2;
    const P = night
        ? { sky: ["#060d24", "#14214a", "#2d3a68", "#4a4a78"], haze: "rgba(120,130,190,", far: ["#2a3560", "#222c52"], fieldA: ["#1c3a2e", "#1a3428", "#22402f", "#2a3a2a", "#1e3326"], hedge: "#0f2419", tree: ["#11281c", "#1b3b28", "#2a5236"], near: ["#173322", "#1d3d29"], front: ["#123020", "#1a3d27", "#0e2618"], path: "#3a3a46", water: ["#1a2a52", "#2a3b6a"], house: ["#6b6b80", "#4a3a48"], light: "rgba(150,170,255," }
        : { sky: ["#3f8fd8", "#7fc0ef", "#bfe3f6", "#fbefd2"], haze: "rgba(255,244,222,", far: ["#8fb3cc", "#a3c3d5"], fieldA: ["#a9d47a", "#c9dc7a", "#8cc469", "#d9c46a", "#9ccf6f"], hedge: "#4d8a3c", tree: ["#3f7a34", "#5a9a44", "#86c060"], near: ["#7cbf58", "#93cc68"], front: ["#4f9a3d", "#6cba54", "#3f8a34"], path: "#e3cf9e", water: ["#7fc0ef", "#bfe3f6"], house: ["#f6efe2", "#c8503c"], light: "rgba(255,246,210," };
    let layers = null, sky = null, clouds = [], shades = [], shadeImg = null, rays = null, groups = [], litBlades = [], blades = [], blooms = [], motes = [], seeds = [], stars = [], birds = [], flies = [], bees = [];
    let nextBirds = preview ? 999 : 6, nextFly = preview ? 999 : 2;
    let mill = null, house = null, pond = null;
    const k = () => (preview ? 0.55 : W < 700 ? 0.75 : 1);
    const M = 40;                                                   // a margin either side for the parallax

    // ---- the land: hill curves for each depth ----
    const ridge = (x, base, amp, f1, f2, ph) => base + Math.sin(x * f1 + ph) * amp + Math.sin(x * f2 + ph * 2.3) * amp * 0.45 + Math.sin(x * f2 * 2.7 + ph) * amp * 0.12;
    function farY(x) { return ridge(x, H * 0.5, H * 0.045, 0.0032, 0.011, 1.7); }
    function midY(x) { return ridge(x, H * 0.6, H * 0.05, 0.0021, 0.0063, 0.4); }
    function nearY(x) { return ridge(x, H * 0.76, H * 0.05, 0.0017, 0.0051, 2.9); }

    const mixC = (a, b, t) => { const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16)); return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
    function paint(w, h, fn) { const c = Worlds.canvas(w, h), g = c.getContext("2d"); fn(g); return c; }
    // a soft round canopy, shaded: dark underneath, lit from the upper left, a rim of light
    function canopy(g, x, y, r, cols, R) {
        g.fillStyle = cols[0];
        g.beginPath(); g.ellipse(x, y + r * 0.25, r * 1.05, r * 0.85, 0, 0, TAU); g.fill();
        for (let i = 0; i < 6; i++) { const a = R() * TAU, d = R() * r * 0.45; g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, r * (0.45 + R() * 0.25), 0, TAU); g.fill(); }
        const lg = g.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.1, x, y, r * 1.2);
        lg.addColorStop(0, cols[2]); lg.addColorStop(0.55, cols[1]); lg.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = lg;
        g.beginPath(); g.ellipse(x - r * 0.1, y - r * 0.05, r * 0.95, r * 0.8, 0, 0, TAU); g.fill();
        g.fillStyle = night ? "rgba(140,170,255,.08)" : "rgba(255,255,220,.25)";
        for (let i = 0; i < 9; i++) { const a = -2.4 + R() * 1.4, d = r * (0.55 + R() * 0.35); g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, r * 0.12, 0, TAU); g.fill(); }
    }
    function setup() {
        const R = U.rng(31337), LW = W + M * 2;
        // the far hills: blue with distance, a tree line along the top, haze over them
        const far = paint(LW, H, g => {
            const top = x => farY(x - M);
            g.fillStyle = P.far[0];
            g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= LW; x += 8) g.lineTo(x, top(x)); g.lineTo(LW, H); g.fill();
            g.fillStyle = P.far[1];
            for (let x = 0; x < LW; x += 7 + R() * 9) { const y = top(x); g.beginPath(); g.ellipse(x, y + 1, 3 + R() * 5, 3 + R() * 4, 0, Math.PI, TAU); g.fill(); }
            const hz = g.createLinearGradient(0, H * 0.4, 0, H * 0.62);
            hz.addColorStop(0, P.haze + "0)"); hz.addColorStop(0.6, P.haze + (night ? ".18)" : ".45)")); hz.addColorStop(1, P.haze + (night ? ".05)" : ".25)"));
            g.fillStyle = hz; g.fillRect(0, H * 0.4, LW, H * 0.3);
        });
        // the fields: patches between the mid hill's top and the near hill, crop rows, hedgerows, trees, a lane
        const mid = paint(LW, H, g => {
            const top = x => midY(x - M);
            g.fillStyle = P.fieldA[0];
            g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= LW; x += 8) g.lineTo(x, top(x)); g.lineTo(LW, H); g.fill();
            // patches: vertical-ish strips between wandering borders, each its own crop with rows
            let x0 = 0;
            const borders = [];
            while (x0 < LW) {
                const x1 = x0 + 70 + R() * 140, col = P.fieldA[Math.floor(R() * P.fieldA.length)], lean = (R() - 0.5) * 90;
                g.save();
                g.beginPath(); g.moveTo(x0, top(x0)); for (let x = x0; x <= x1; x += 6) g.lineTo(x, top(x)); g.lineTo(x1 + lean, H); g.lineTo(x0 + lean * 0.6, H); g.closePath();
                g.fillStyle = col; g.fill(); g.clip();
                g.strokeStyle = night ? "rgba(0,0,0,.18)" : "rgba(60,90,30,.16)"; g.lineWidth = 1.2;
                const ang = (R() - 0.5) * 0.9;
                for (let r = -H; r < H * 2; r += 7) { g.beginPath(); g.moveTo(x0 - 200, top(x0) + r); g.lineTo(x1 + 200, top(x0) + r + (x1 - x0 + 400) * ang); g.stroke(); }
                const sh = g.createLinearGradient(0, top(x0), 0, H);           // further back is lighter (air), nearer darker
                sh.addColorStop(0, P.haze + (night ? ".08)" : ".2)")); sh.addColorStop(1, "rgba(0,0,0,.08)");
                g.fillStyle = sh; g.fillRect(x0 - 100, 0, x1 - x0 + 300, H);
                g.restore();
                borders.push([x1, lean]);
                x0 = x1;
            }
            // field edges: a faint darker seam where two crops meet, and hedgerows running along the hill's contours
            g.strokeStyle = night ? "rgba(0,0,0,.25)" : "rgba(60,90,30,.28)"; g.lineWidth = 1.5;
            for (const [bx, lean] of borders) { g.beginPath(); g.moveTo(bx, top(bx)); g.lineTo(bx + lean, H); g.stroke(); }
            const hedge = (yOff, from, to) => {
                for (let x = from; x < to; x += 3 + R() * 3) {
                    const y = top(x) + yOff + Math.sin(x * 0.02) * 4, r = 2.4 + (yOff / H) * 14 + R() * 1.6;
                    g.fillStyle = mixC(P.hedge, "#000000", 0.3); g.beginPath(); g.arc(x, y + r * 0.35, r, 0, TAU); g.fill();
                    g.fillStyle = P.hedge; g.beginPath(); g.arc(x, y, r * 0.9, 0, TAU); g.fill();
                    g.fillStyle = night ? "rgba(120,160,200,.12)" : "rgba(200,240,140,.4)"; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.4, r * 0.38, 0, TAU); g.fill();
                    if (R() < 0.025) canopy(g, x, y - r * 1.8, r * 2.2, P.tree, R);
                }
            };
            for (let n = 0; n < 4; n++) { const a = R() * LW, len = 180 + R() * 380; hedge(H * (0.03 + R() * 0.08), a, Math.min(LW, a + len)); }
            // the lane: a pale ribbon from the front winding back up over the hill
            g.strokeStyle = P.path; g.lineCap = "round";
            const lx = LW * 0.3;
            for (const [lw, a] of [[22, 0.95], [14, 0.6]]) {
                g.globalAlpha = a; g.lineWidth = lw;
                g.beginPath(); g.moveTo(lx - 90, H); g.bezierCurveTo(lx + 60, H * 0.85, lx - 70, H * 0.72, lx + 30, top(lx + 30) + 4); g.stroke();
            }
            g.globalAlpha = 1;
            // tree clumps on the hill
            for (let i = 0; i < (preview ? 6 : 14); i++) {
                const x = R() * LW, y = top(x) + 6 + R() * H * 0.06, r = (10 + R() * 16) * (1 - (y - H * 0.55) / H);
                g.fillStyle = night ? "#2a1e16" : "#6b4a2a"; g.fillRect(x - r * 0.08, y + r * 0.2, r * 0.16, r * 0.9);
                canopy(g, x, y, r, P.tree, R);
            }
            // the farmhouse (its window glows at night, drawn live)
            house = { x: LW * 0.68, y: top(LW * 0.68) + 14, s: Math.max(14, Math.min(W, H) * 0.028) * k() };
            const { x: hx, y: hy, s } = house;
            g.fillStyle = P.house[0]; g.fillRect(hx - s, hy - s * 0.9, s * 2, s * 0.9);
            g.fillStyle = "rgba(0,0,0,.12)"; g.fillRect(hx + s * 0.3, hy - s * 0.9, s * 0.7, s * 0.9);
            g.fillStyle = P.house[1]; g.beginPath(); g.moveTo(hx - s * 1.2, hy - s * 0.85); g.lineTo(hx, hy - s * 1.75); g.lineTo(hx + s * 1.2, hy - s * 0.85); g.closePath(); g.fill();
            g.fillStyle = "rgba(0,0,0,.18)"; g.beginPath(); g.moveTo(hx, hy - s * 1.75); g.lineTo(hx + s * 1.2, hy - s * 0.85); g.lineTo(hx, hy - s * 0.85); g.closePath(); g.fill();
            g.fillStyle = night ? "#3a3040" : "#8a5a44"; g.fillRect(hx + s * 0.45, hy - s * 1.65, s * 0.25, s * 0.5);
            g.fillStyle = night ? "#2a2030" : "#6a4a3a"; g.fillRect(hx - s * 0.2, hy - s * 0.5, s * 0.4, s * 0.5);
            canopy(g, hx - s * 1.8, hy - s * 0.4, s * 0.9, P.tree, R);
            // the pond, with a reed bed (the shimmer is drawn live)
            pond = { x: LW * 0.14, y: top(LW * 0.14) + H * 0.09, rx: Math.min(W, H) * 0.075 * k(), ry: Math.min(W, H) * 0.02 * k() };
            const pg = g.createLinearGradient(0, pond.y - pond.ry, 0, pond.y + pond.ry);
            pg.addColorStop(0, P.water[0]); pg.addColorStop(1, P.water[1]);
            g.fillStyle = night ? "#10261a" : "#5f9a44"; g.beginPath(); g.ellipse(pond.x, pond.y + 2, pond.rx + 5, pond.ry + 4, 0, 0, TAU); g.fill();
            g.fillStyle = pg; g.beginPath(); g.ellipse(pond.x, pond.y, pond.rx, pond.ry, 0, 0, TAU); g.fill();
            g.strokeStyle = night ? "#1e3a26" : "#3f7a2e"; g.lineWidth = 1.4;
            for (let i = 0; i < 16; i++) { const x = pond.x + pond.rx * (0.55 + R() * 0.5) * (i % 2 ? 1 : -1), y = pond.y; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 2, y - 8, x + (R() - 0.5) * 6, y - 12 - R() * 8); g.stroke(); }
            // the windmill's tower (its sails turn, drawn live)
            mill = { x: LW * 0.86, y: top(LW * 0.86) - 2, s: Math.max(16, Math.min(W, H) * 0.035) * k() };
            const m = mill;
            g.fillStyle = night ? "#5a5466" : "#f2e6cf";
            g.beginPath(); g.moveTo(m.x - m.s * 0.5, m.y); g.lineTo(m.x - m.s * 0.28, m.y - m.s * 2); g.lineTo(m.x + m.s * 0.28, m.y - m.s * 2); g.lineTo(m.x + m.s * 0.5, m.y); g.fill();
            g.fillStyle = "rgba(0,0,0,.15)"; g.beginPath(); g.moveTo(m.x, m.y); g.lineTo(m.x, m.y - m.s * 2); g.lineTo(m.x + m.s * 0.28, m.y - m.s * 2); g.lineTo(m.x + m.s * 0.5, m.y); g.fill();
            g.fillStyle = night ? "#3a3040" : "#a5583c"; g.beginPath(); g.moveTo(m.x - m.s * 0.36, m.y - m.s * 2); g.lineTo(m.x, m.y - m.s * 2.45); g.lineTo(m.x + m.s * 0.36, m.y - m.s * 2); g.fill();
            g.fillStyle = night ? "#2a2030" : "#6a4a3a"; g.fillRect(m.x - m.s * 0.1, m.y - m.s * 0.42, m.s * 0.2, m.s * 0.42);
        });
        // the near hill: lush, a lit crest, wildflower specks
        const near = paint(LW, H, g => {
            const top = x => nearY(x - M);
            const ng = g.createLinearGradient(0, H * 0.7, 0, H);
            ng.addColorStop(0, P.near[1]); ng.addColorStop(1, P.near[0]);
            g.fillStyle = ng;
            g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= LW; x += 6) g.lineTo(x, top(x)); g.lineTo(LW, H); g.fill();
            g.save();
            g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= LW; x += 6) g.lineTo(x, top(x)); g.lineTo(LW, H); g.clip();
            for (let i = 0; i < 26; i++) {                           // broad soft patches: hollows in shade, rises in light
                const x = R() * LW, y = top(x) + R() * (H - top(x)), r = 60 + R() * 160, dark = R() < 0.5;
                const pg = g.createRadialGradient(x, y, 0, x, y, r);
                pg.addColorStop(0, dark ? "rgba(20,60,20,.18)" : (night ? "rgba(120,150,220,.06)" : "rgba(240,255,190,.2)")); pg.addColorStop(1, "rgba(0,0,0,0)");
                g.fillStyle = pg; g.fillRect(x - r, y - r, r * 2, r * 2);
            }
            g.restore();
            g.strokeStyle = night ? "rgba(150,180,255,.22)" : "rgba(255,255,210,.55)"; g.lineWidth = 2;
            g.beginPath(); for (let x = 0; x <= LW; x += 6) g[x ? "lineTo" : "moveTo"](x, top(x) + 1); g.stroke();
            for (let i = 0; i < (preview ? 120 : 520); i++) {
                const x = R() * LW, y = top(x) + 4 + R() * (H - top(x)), d = (y - H * 0.72) / (H * 0.28);
                g.fillStyle = night ? "rgba(190,200,240,.35)" : ["#ffffff", "#f7d24c", "#ef8fb7", "#b79af0", "#f3a65a"][Math.floor(R() * 5)];
                g.beginPath(); g.arc(x, y, 0.8 + d * 1.6, 0, TAU); g.fill();
                if (!night && R() < 0.4) { g.fillStyle = "rgba(40,90,30,.25)"; g.fillRect(x - 0.4, y, 0.8, 2 + d * 3); }
            }
        });
        layers = { far, mid, near };
        // clouds: each a heap of shaded puffs, lit on top, a grey underside
        clouds = Array.from({ length: preview ? 3 : 7 }, () => {
            const cw = 220 + R() * 220, ch = cw * 0.5, pad = ch * 0.5;
            const c = paint(cw + pad * 2, ch + pad * 2, g => {
                g.translate(pad, pad);
                const base = ch * 0.78, puffs = [];
                for (let i = 0; i < 26; i++) {                       // a domed heap: big puffs in the middle, small at the ends
                    const u = R(), x = cw * (0.08 + u * 0.84), hump = Math.sin(u * Math.PI);
                    puffs.push({ x, y: base - hump * ch * (0.25 + R() * 0.35), r: ch * (0.12 + hump * 0.22 + R() * 0.08) });
                }
                puffs.sort((a, b) => b.y - a.y);
                for (const p of puffs) {                             // a soft wide skirt first, then the lit puffs
                    const sg = g.createRadialGradient(p.x, p.y, p.r * 0.6, p.x, p.y, p.r * 1.6);
                    sg.addColorStop(0, night ? "rgba(120,130,180,.12)" : "rgba(255,255,255,.2)"); sg.addColorStop(1, night ? "rgba(120,130,180,0)" : "rgba(255,255,255,0)");
                    g.fillStyle = sg; g.beginPath(); g.arc(p.x, p.y, p.r * 1.6, 0, TAU); g.fill();
                }
                for (const p of puffs) {
                    const pg = g.createRadialGradient(p.x - p.r * 0.35, p.y - p.r * 0.5, p.r * 0.05, p.x, p.y, p.r);
                    if (night) { pg.addColorStop(0, "rgba(190,200,240,.42)"); pg.addColorStop(0.75, "rgba(110,120,170,.32)"); pg.addColorStop(1, "rgba(90,100,150,0)"); }
                    else { pg.addColorStop(0, "rgba(255,255,255,1)"); pg.addColorStop(0.65, "rgba(246,249,255,.95)"); pg.addColorStop(1, "rgba(214,226,240,0)"); }
                    g.fillStyle = pg; g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
                }
                g.globalCompositeOperation = "source-atop";            // a grey-blue belly, flat along the bottom
                const under = g.createLinearGradient(0, base - ch * 0.25, 0, base + ch * 0.1);
                under.addColorStop(0, "rgba(0,0,0,0)"); under.addColorStop(1, night ? "rgba(20,24,50,.4)" : "rgba(140,160,190,.38)");
                g.fillStyle = under; g.fillRect(-pad, -pad, cw + pad * 2, ch + pad * 2);
                if (!night) {                                         // sunlight on the upper right
                    const lit = g.createLinearGradient(cw, 0, cw * 0.4, ch);
                    lit.addColorStop(0, "rgba(255,244,214,.45)"); lit.addColorStop(1, "rgba(255,244,214,0)");
                    g.fillStyle = lit; g.fillRect(-pad, -pad, cw + pad * 2, ch + pad * 2);
                }
            });
            return { x: R() * W, y: U.lerp(0.02, 0.26, R()) * H, s: U.lerp(0.55, 1.1, R()) * (preview ? 0.5 : 1), sp: U.lerp(4, 11, R()), img: c };
        });
        // shadows of clouds sliding over the land (by day)
        shadeImg = paint(256, 256, g => { const sg = g.createRadialGradient(128, 128, 0, 128, 128, 128); sg.addColorStop(0, "rgba(30,60,40,.11)"); sg.addColorStop(0.6, "rgba(30,60,40,.06)"); sg.addColorStop(1, "rgba(30,60,40,0)"); g.fillStyle = sg; g.fillRect(0, 0, 256, 256); });
        shades = night ? [] : Array.from({ length: preview ? 0 : 3 }, () => ({ x: R() * W, y: H * U.lerp(0.64, 0.86, R()), rx: U.lerp(220, 380, R()), ry: U.lerp(40, 70, R()), sp: U.lerp(5, 10, R()) }));
        // the front: grass blades in three tones with a lit edge, and wildflowers of five kinds
        const n = Math.round(W / (preview ? 5 : 3.2));
        blades = Array.from({ length: n }, (_, i) => ({ x: (i + R() * 0.9) / n * W, h: U.lerp(22, 78, R()) * k(), w: 1.6 + R() * 2.6, ph: R() * TAU, c: P.front[i % 3], lit: R() < 0.35 }));
        blades.forEach(b => { b.w = [1.8, 2.8, 3.8][Math.min(2, Math.floor((b.w - 1.6) / 0.9))]; });
        groups = [];
        for (const c of P.front) for (const w of [1.8, 2.8, 3.8]) { const list = blades.filter(b => b.c === c && b.w === w); if (list.length) groups.push({ c, w, list }); }
        litBlades = blades.filter(b => b.lit);
        const kinds = ["daisy", "tulip", "poppy", "lavender", "dandelion"];
        blooms = Array.from({ length: Math.round(W / (preview ? 60 : 34)) }, () => ({ x: R() * W, h: U.lerp(40, 96, R()) * k(), r: U.lerp(4, 7.5, R()) * k(), ph: R() * TAU, kind: kinds[Math.floor(R() * kinds.length)], c: ["#e8798f", "#f3a65a", "#ff5d5d", "#ffffff", "#f2c94c"][Math.floor(R() * 5)] }));
        motes = Array.from({ length: preview ? 14 : 46 }, () => ({ x: R() * W, y: R() * H * 0.9, vx: U.lerp(-6, 14, R()), vy: U.lerp(-12, -3, R()), ph: R() * TAU, r: U.lerp(1, 2.4, R()) }));
        seeds = Array.from({ length: preview ? 0 : 10 }, () => ({ x: R() * W, y: R() * H, vx: U.lerp(10, 26, R()), vy: U.lerp(-6, 4, R()), ph: R() * TAU }));
        stars = night ? Array.from({ length: preview ? 60 : 220 }, () => { const band = R() < 0.45; const x = R() * W; return { x, y: band ? H * 0.08 + (x / W) * H * 0.22 + (R() - 0.5) * H * 0.1 : R() * H * 0.5, r: R() * (band ? 0.9 : 1.4) + 0.3, tw: R() * TAU }; }) : [];
        sky = null;
    }
    setup();

    function butterfly(g, f, t) {
        const flap = Math.abs(Math.sin(t * 13 + f.ph)) * 0.85 + 0.15;
        g.save(); g.translate(f.x, f.y); g.scale(f.vx > 0 ? 1 : -1, 1); g.rotate(Math.sin(t * 3 + f.ph) * 0.15);
        for (const side of [-1, 1]) {
            g.save(); g.scale(side * flap, 1);
            const wg = g.createLinearGradient(0, -14, 12, 8);
            wg.addColorStop(0, f.c); wg.addColorStop(1, f.c2);
            g.fillStyle = wg;
            g.beginPath(); g.ellipse(6, -5, 7.5, 9.5, 0.5, 0, TAU); g.fill();
            g.beginPath(); g.ellipse(5, 5, 5.5, 6.5, -0.4, 0, TAU); g.fill();
            g.strokeStyle = "rgba(40,30,30,.55)"; g.lineWidth = 0.8;
            g.beginPath(); g.ellipse(6, -5, 7.5, 9.5, 0.5, 0, TAU); g.stroke();
            g.fillStyle = "rgba(255,255,255,.75)"; g.beginPath(); g.arc(9, -9, 1.6, 0, TAU); g.fill();
            g.fillStyle = "rgba(40,30,30,.6)"; g.beginPath(); g.arc(6, 4, 1.4, 0, TAU); g.fill();
            g.restore();
        }
        g.fillStyle = "#3a2f2a"; g.beginPath(); g.ellipse(0, 0, 1.4, 7, 0, 0, TAU); g.fill();
        g.strokeStyle = "#3a2f2a"; g.lineWidth = 0.7; g.beginPath(); g.moveTo(0, -6); g.quadraticCurveTo(-2, -11, -4, -12); g.moveTo(0, -6); g.quadraticCurveTo(2, -11, 4, -12); g.stroke();
        g.restore();
    }
    function bee(g, b, t) {
        g.save(); g.translate(b.x, b.y);
        const fl = Math.abs(Math.sin(t * 40));
        g.fillStyle = "rgba(230,245,255,.75)"; g.beginPath(); g.ellipse(-1, -4, 3, 4.5 * fl + 0.5, -0.4, 0, TAU); g.ellipse(2, -4, 3, 4.5 * fl + 0.5, 0.4, 0, TAU); g.fill();
        g.fillStyle = "#f2c22e"; g.beginPath(); g.ellipse(0, 0, 5, 3.6, 0, 0, TAU); g.fill();
        g.fillStyle = "#2b2b33"; g.fillRect(-1.6, -3.4, 1.4, 6.8); g.fillRect(1.4, -3.2, 1.3, 6.4); g.beginPath(); g.arc(-4.6, 0, 2, 0, TAU); g.fill();
        g.restore();
    }
    function flower(g, f, x, y, t) {
        const r = f.r;
        if (f.kind === "lavender") {
            g.fillStyle = night ? "#6a68a8" : "#9b7ad8";
            for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(x + Math.sin(i) * 1.2, y + i * r * 0.55, r * 0.42, r * 0.32, 0, 0, TAU); g.fill(); }
            return;
        }
        if (f.kind === "dandelion") {
            g.strokeStyle = night ? "rgba(220,225,255,.55)" : "rgba(255,255,255,.85)"; g.lineWidth = 0.7;
            for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r * 1.5, y + Math.sin(a) * r * 1.5); g.stroke(); }
            g.fillStyle = night ? "rgba(220,225,255,.3)" : "rgba(255,255,255,.5)"; g.beginPath(); g.arc(x, y, r * 1.5, 0, TAU); g.fill();
            return;
        }
        if (f.kind === "tulip") {
            g.fillStyle = night ? "#7a5a8a" : f.c;
            g.beginPath(); g.moveTo(x - r, y - r * 0.2); g.quadraticCurveTo(x - r, y + r * 1.2, x, y + r * 1.1); g.quadraticCurveTo(x + r, y + r * 1.2, x + r, y - r * 0.2); g.lineTo(x + r * 0.45, y + r * 0.3); g.lineTo(x, y - r * 0.4); g.lineTo(x - r * 0.45, y + r * 0.3); g.closePath(); g.fill();
            g.fillStyle = "rgba(255,255,255,.25)"; g.beginPath(); g.ellipse(x - r * 0.35, y + r * 0.4, r * 0.22, r * 0.5, 0.2, 0, TAU); g.fill();
            return;
        }
        const pet = f.kind === "daisy" ? 10 : 5, col = night ? "rgba(205,205,235,.7)" : f.kind === "daisy" ? "#ffffff" : f.kind === "poppy" ? "#ff4d3a" : f.c;
        for (let i = 0; i < pet; i++) {
            const a = (i / pet) * TAU + f.ph;
            g.fillStyle = col;
            g.beginPath(); g.ellipse(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75, r * (f.kind === "daisy" ? 0.7 : 0.62), r * (f.kind === "daisy" ? 0.25 : 0.55), a, 0, TAU); g.fill();
        }
        g.fillStyle = f.kind === "poppy" ? "#2b1a1a" : "#f2b632";
        g.beginPath(); g.arc(x, y, r * 0.38, 0, TAU); g.fill();
        g.fillStyle = "rgba(255,255,255,.4)"; g.beginPath(); g.arc(x - r * 0.12, y - r * 0.12, r * 0.13, 0, TAU); g.fill();
    }

    return {
        resize(w, h) { W = w; H = h; setup(); },
        draw(g, t, dt, inp) {
            if (!sky) {
                sky = g.createLinearGradient(0, 0, 0, H * 0.62);
                P.sky.forEach((c, i) => sky.addColorStop(i / (P.sky.length - 1), c));
            }
            g.fillStyle = sky; g.fillRect(0, 0, W, H);
            const sx = W * (preview ? 0.8 : 0.82) - inp.px * 5, sy = H * (preview ? 0.22 : 0.16) - inp.py * 3, sr = Math.min(W, H) * (preview ? 0.08 : 0.05);
            if (night) {
                for (const s of stars) {
                    const tw = Math.abs(Math.sin(t * 0.7 + s.tw));
                    g.fillStyle = `rgba(255,255,240,${(0.25 + 0.75 * tw).toFixed(2)})`;
                    g.fillRect(s.x - inp.px * 2, s.y, s.r, s.r);
                    if (s.r > 1.2) Worlds.twinkle(g, s.x + s.r / 2, s.y + s.r / 2, s.r, tw, "#fffff0");
                }
                Worlds.glow(g, sx, sy, sr * 7, "#b8c4ff", 0.35);
                Worlds.glow(g, sx, sy, sr * 2.6, "#fff6dc", 0.55);
                const mg = g.createRadialGradient(sx - sr * 0.3, sy - sr * 0.3, sr * 0.1, sx, sy, sr);
                mg.addColorStop(0, "#fffbea"); mg.addColorStop(1, "#d8d2b8");
                g.fillStyle = mg; g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.fill();
                g.fillStyle = "rgba(160,150,120,.45)";
                g.beginPath(); g.arc(sx - sr * 0.3, sy - sr * 0.2, sr * 0.22, 0, TAU); g.arc(sx + sr * 0.35, sy + sr * 0.3, sr * 0.15, 0, TAU); g.arc(sx + sr * 0.05, sy - sr * 0.48, sr * 0.09, 0, TAU); g.fill();
            } else {
                if (!rays || rays.sr !== sr) {                        // the rays, painted once and turned slowly
                    const RR = Math.ceil(sr * 6.5);
                    rays = paint(RR * 2, RR * 2, rg => {
                        rg.translate(RR, RR);
                        for (let i = 0; i < 14; i++) {
                            rg.rotate(TAU / 14);
                            const gr = rg.createLinearGradient(0, 0, RR, 0);
                            gr.addColorStop(0, "rgba(255,248,210,.24)"); gr.addColorStop(1, "rgba(255,248,210,0)");
                            rg.fillStyle = gr; rg.beginPath(); rg.moveTo(0, 0); rg.lineTo(RR, -sr * (0.35 + (i % 3) * 0.12)); rg.lineTo(RR, sr * (0.35 + (i % 3) * 0.12)); rg.fill();
                        }
                    });
                    rays.sr = sr;
                }
                g.save(); g.translate(sx, sy); g.rotate(t * 0.03); g.drawImage(rays, -rays.width / 2, -rays.height / 2); g.restore();
                Worlds.glow(g, sx, sy, sr * 6, "#fff0b8", 0.75);
                Worlds.glow(g, sx, sy, sr * 2.2, "#ffffff", 0.9);
                g.fillStyle = "#fffbe6"; g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.fill();
            }
            for (const c of clouds) {
                c.x += c.sp * dt;
                const cw = c.img.width * c.s;
                if (c.x > W + cw * 0.6) c.x = -cw;
                g.drawImage(c.img, c.x - inp.px * 8 * c.s, c.y - c.img.height * c.s * 0.25, cw, c.img.height * c.s);
            }
            if (!night) {
                nextBirds -= dt;
                if (nextBirds <= 0) {
                    nextBirds = U.rand(12, 22);
                    const y = U.rand(0.1, 0.32) * H;
                    for (let i = 0; i < U.rand(3, 7); i++) birds.push({ x: -40 - i * 24, y: y + Math.abs(i - 2) * 11, ph: Math.random() * 6, sp: U.rand(55, 75) });
                }
                g.strokeStyle = "rgba(50,60,80,.65)"; g.lineWidth = 1.6;
                for (const b of birds) {
                    b.x += b.sp * dt;
                    const f = Math.sin(t * 8 + b.ph) * 4;
                    g.beginPath(); g.moveTo(b.x - 7, b.y - f); g.quadraticCurveTo(b.x - 3.5, b.y - 2.5, b.x, b.y); g.quadraticCurveTo(b.x + 3.5, b.y - 2.5, b.x + 7, b.y - f); g.stroke();
                }
                birds = birds.filter(b => b.x < W + 60);
            }
            // the land, back to front
            g.drawImage(layers.far, -M - inp.px * 4, -inp.py * 2);
            const mx = -M - inp.px * 10, my = -inp.py * 4;
            g.drawImage(layers.mid, mx, my);
            // live bits on the fields: chimney smoke, the windmill's sails, the pond's shimmer, the lit window
            if (house) {
                const cx = house.x + mx + house.s * 0.57, cy = house.y + my - house.s * 1.7;
                for (let i = 0; i < 6; i++) {
                    const k2 = ((t * 0.25 + i / 6) % 1), x = cx + Math.sin(t * 0.8 + i) * 4 + k2 * 26, y = cy - k2 * 46;
                    g.fillStyle = night ? `rgba(150,150,180,${(0.25 * (1 - k2)).toFixed(3)})` : `rgba(255,255,255,${(0.55 * (1 - k2)).toFixed(3)})`;
                    g.beginPath(); g.arc(x, y, 3 + k2 * 9, 0, TAU); g.fill();
                }
                if (night) {
                    Worlds.glow(g, house.x + mx - house.s * 0.55, house.y + my - house.s * 0.45, house.s * 1.4, "#ffc46a", 0.45 + 0.08 * Math.sin(t * 3));
                    g.fillStyle = "#ffd98a"; g.fillRect(house.x + mx - house.s * 0.75, house.y + my - house.s * 0.62, house.s * 0.36, house.s * 0.3);
                } else { g.fillStyle = "#7fb8d8"; g.fillRect(house.x + mx - house.s * 0.75, house.y + my - house.s * 0.62, house.s * 0.36, house.s * 0.3); }
            }
            if (mill) {
                const m = mill, x = m.x + mx, y = m.y + my - m.s * 1.85;
                g.save(); g.translate(x, y); g.rotate(t * 0.6);
                for (let i = 0; i < 4; i++) {
                    g.rotate(TAU / 4);
                    g.fillStyle = night ? "#4a4458" : "#8a5a3a"; g.fillRect(-m.s * 0.04, 0, m.s * 0.08, m.s * 1.5);
                    g.fillStyle = night ? "rgba(190,190,220,.55)" : "rgba(255,250,240,.92)"; g.fillRect(m.s * 0.06, m.s * 0.3, m.s * 0.34, m.s * 1.15);
                    g.strokeStyle = night ? "rgba(60,60,80,.6)" : "rgba(120,90,60,.6)"; g.lineWidth = 0.7;
                    for (let j = 1; j < 5; j++) { g.beginPath(); g.moveTo(m.s * 0.06, m.s * (0.3 + j * 0.23)); g.lineTo(m.s * 0.4, m.s * (0.3 + j * 0.23)); g.stroke(); }
                }
                g.restore();
                g.fillStyle = night ? "#3a3040" : "#5a3a2a"; g.beginPath(); g.arc(x, y, m.s * 0.1, 0, TAU); g.fill();
            }
            if (pond) {
                g.save(); g.beginPath(); g.ellipse(pond.x + mx, pond.y + my, pond.rx, pond.ry, 0, 0, TAU); g.clip();
                g.strokeStyle = night ? "rgba(200,210,255,.25)" : "rgba(255,255,255,.6)"; g.lineWidth = 1.2;
                for (let i = 0; i < 5; i++) { const yy = pond.y + my - pond.ry * 0.6 + i * pond.ry * 0.3, xx = pond.x + mx + Math.sin(t * 0.8 + i * 1.7) * pond.rx * 0.4; g.beginPath(); g.moveTo(xx - pond.rx * 0.25, yy); g.lineTo(xx + pond.rx * 0.25, yy); g.stroke(); }
                if (night) Worlds.glow(g, pond.x + mx + pond.rx * 0.2, pond.y + my, pond.ry * 2, "#dfe6ff", 0.25);
                g.restore();
            }
            if (night) {                                            // mist pooling in the dips
                const mist = g.createLinearGradient(0, H * 0.6, 0, H * 0.82);
                mist.addColorStop(0, "rgba(120,130,190,0)"); mist.addColorStop(0.5, `rgba(120,130,190,${(0.12 + 0.04 * Math.sin(t * 0.3)).toFixed(3)})`); mist.addColorStop(1, "rgba(120,130,190,0)");
                g.fillStyle = mist; g.fillRect(0, H * 0.6, W, H * 0.22);
            }
            g.drawImage(layers.near, -M - inp.px * 16, -inp.py * 6);
            for (const sh of shades) {                               // cloud shadows sliding over the fields
                sh.x += sh.sp * dt; if (sh.x - sh.rx > W) sh.x = -sh.rx;
                g.drawImage(shadeImg, sh.x - sh.rx, sh.y - sh.ry, sh.rx * 2, sh.ry * 2);
            }
            // butterflies and bees over the meadow (by day)
            if (!night) {
                nextFly -= dt;
                if (nextFly <= 0 && flies.length < 3) {
                    nextFly = U.rand(5, 11);
                    const left = Math.random() < 0.5, cols = U.pick([["#f3a65a", "#e8798f"], ["#7fb4e8", "#b48ad8"], ["#f2c94c", "#f3a65a"], ["#ffffff", "#ef8fb7"], ["#ff9f43", "#5a3a2a"]]);
                    flies.push({ x: left ? -20 : W + 20, y: U.rand(0.5, 0.82) * H, vx: (left ? 1 : -1) * U.rand(30, 55), ph: Math.random() * 6, c: cols[0], c2: cols[1] });
                }
                for (const f of flies) { f.x += f.vx * dt; f.y += Math.sin(t * 2 + f.ph) * 26 * dt; butterfly(g, f, t); }
                flies = flies.filter(f => f.x > -40 && f.x < W + 40);
                if (!preview && bees.length < 2 && Math.random() < dt * 0.15) bees.push({ x: Math.random() * W, y: H * U.rand(0.72, 0.88), a: Math.random() * TAU, life: U.rand(8, 14) });
                for (const b of bees) { b.life -= dt; b.a += dt * 1.6; b.x += Math.cos(b.a) * 40 * dt + 18 * dt; b.y += Math.sin(b.a * 1.7) * 30 * dt; bee(g, b, t); }
                bees = bees.filter(b => b.life > 0 && b.x < W + 30);
            }
            // pollen by day, fireflies by night, dandelion seeds on the wind
            g.globalCompositeOperation = "lighter";
            for (const m of motes) {
                m.x += (m.vx + Math.sin(t + m.ph) * 8) * dt; m.y += m.vy * dt;
                if (m.y < -10) { m.y = H + 5; m.x = Math.random() * W; }
                if (m.x > W + 10) m.x = -10; if (m.x < -10) m.x = W + 10;
                if (night) {
                    const a = Math.max(0, Math.sin(t * 1.6 + m.ph * 3));
                    if (a < 0.05) continue;
                    Worlds.glow(g, m.x, m.y, m.r * 9, "#c8ff6a", a * 0.55);
                    Worlds.glow(g, m.x, m.y, m.r * 3, "#f0ffb0", a);
                } else {
                    const a = 0.3 + 0.3 * Math.sin(t * 2 + m.ph);
                    g.fillStyle = `rgba(255,236,150,${a.toFixed(2)})`; g.beginPath(); g.arc(m.x, m.y, m.r, 0, TAU); g.fill();
                    if (a > 0.55) Worlds.glint(g, m.x, m.y, m.r * 3.5, (a - 0.55) * 6, "#fff4c0");
                }
            }
            g.globalCompositeOperation = "source-over";
            g.strokeStyle = night ? "rgba(220,225,255,.55)" : "rgba(255,255,255,.85)"; g.lineWidth = 0.6;
            for (const s of seeds) {
                s.x += (s.vx + Math.sin(t * 0.7 + s.ph) * 10) * dt; s.y += (s.vy + Math.sin(t * 1.3 + s.ph) * 8) * dt;
                if (s.x > W + 20) { s.x = -20; s.y = Math.random() * H * 0.8; }
                g.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; g.moveTo(s.x, s.y); g.lineTo(s.x + Math.cos(a) * 4, s.y + Math.sin(a) * 4 - 3); } g.moveTo(s.x, s.y); g.lineTo(s.x, s.y + 5); g.stroke();
            }
            // the grass, in front, swaying in the wind (with gusts), lit blades catching the light, flowers among it
            const gust = Math.sin(t * 0.45) * 0.12 + Math.sin(t * 0.17) * 0.06;
            g.lineCap = "round";
            const fx = -inp.px * 22;
            for (const b of blades) b.sw = Math.sin(t * 1.6 + b.x * 0.011 + b.ph * 0.3) * 0.2 + gust;
            for (const grp of groups) {
                g.strokeStyle = grp.c; g.lineWidth = grp.w;
                g.beginPath();
                for (const b of grp.list) { const x = b.x + fx; g.moveTo(x, H + 2); g.quadraticCurveTo(x + b.sw * b.h * 0.3, H - b.h * 0.55, x + b.sw * b.h, H - b.h); }
                g.stroke();
            }
            g.strokeStyle = night ? "rgba(150,180,255,.25)" : "rgba(220,255,160,.55)"; g.lineWidth = 1.1;
            g.beginPath();
            for (const b of litBlades) { const x = b.x + fx; g.moveTo(x + b.sw * b.h * 0.4, H - b.h * 0.6); g.quadraticCurveTo(x + b.sw * b.h * 0.7, H - b.h * 0.85, x + b.sw * b.h, H - b.h); }
            g.stroke();
            for (const f of blooms) {
                const sway = Math.sin(t * 1.6 + f.x * 0.011) * 0.16 + gust, x = f.x + fx, tx = x + sway * f.h, ty = H - f.h;
                g.strokeStyle = night ? "#1f4a2a" : "#3f8a34"; g.lineWidth = 1.6;
                g.beginPath(); g.moveTo(x, H + 2); g.quadraticCurveTo(x + sway * f.h * 0.3, H - f.h * 0.5, tx, ty); g.stroke();
                g.fillStyle = night ? "#1f4a2a" : "#4f9a3d";
                g.beginPath(); g.ellipse(x + sway * f.h * 0.15 + 4, H - f.h * 0.35, 5, 2, -0.5, 0, TAU); g.fill();
                flower(g, f, tx, ty, t);
            }
        }
    };
}
