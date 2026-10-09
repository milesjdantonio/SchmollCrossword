// The ACORN WOODS world: an autumn forest full of busy squirrels.
//   Background: a golden afternoon (or a harvest moon) over rolling hills, layers of red, orange and yellow trees,
//   sunbeams through the leaves, a big oak whose branch a squirrel runs along, another squirrel burying acorns,
//   geese flying south, mushrooms in the leaf litter and leaves tumbling down everywhere. At night an owl
//   blinks from the hollow of the oak.
//   Board: a tree-stump board; every letter drops an acorn, nut or leaf into its square, finished words get a
//   squirrel scampering across them, and an acorn stash counts up in the corner.
//   Win: leaves gust in, a squirrel leaps onto the board with a golden acorn, throws it, it cracks open,
//   and a leaf tornado spins around the board.

(() => {
    const TAU = Math.PI * 2;
    const { tone, noise, midi } = Sound;
    const LEAVES = ["#d9531e", "#f2a03d", "#b8321a", "#e8c547", "#c7702a", "#9c3d1c"];

    const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };

    // A maple leaf (pointy = true) or a plain oval leaf, centred on 0,0 with radius s
    function leafPath(g, s, pointy) {
        g.beginPath();
        if (!pointy) {
            g.moveTo(-s, 0);
            g.quadraticCurveTo(-s * 0.1, -s * 0.62, s, 0);
            g.quadraticCurveTo(-s * 0.1, s * 0.62, -s, 0);
            return;
        }
        for (let i = 0; i < 10; i++) {                       // five points, like a maple leaf
            const a = -Math.PI / 2 + i * TAU / 10, rr = i % 2 ? s * 0.45 : s;
            if (i) g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        g.closePath();
    }

    // A squirrel in profile (facing right), drawn at scale s with its feet at 0,0. pose: 0..1 run cycle, tail sway
    function drawSquirrel(g, x, y, s, dir, run, tailSway, acorn) {
        g.save();
        g.translate(x, y);
        g.scale(dir * s, s);
        const stretch = Math.sin(run * TAU);
        // tail: a big fluffy S-curve
        g.save();
        g.translate(-10, -12);
        g.rotate(-0.2 + tailSway * 0.25 - stretch * 0.08);
        const tg = g.createLinearGradient(-20, -40, 0, 0);
        tg.addColorStop(0, "#e39a5b");
        tg.addColorStop(1, "#b45b25");
        g.fillStyle = tg;
        g.beginPath();
        g.moveTo(0, 0);
        g.bezierCurveTo(-22, -4, -26, -30, -12, -40);
        g.bezierCurveTo(-2, -48, 10, -40, 4, -32);
        g.bezierCurveTo(-8, -34, -12, -20, -2, -10);
        g.closePath();
        g.fill();
        g.strokeStyle = "rgba(255,225,190,.5)";
        g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(-6, -6); g.quadraticCurveTo(-18, -18, -12, -34); g.stroke();
        g.restore();
        // back legs and body
        g.fillStyle = "#b9622a";
        g.beginPath(); g.ellipse(-4, -6 - Math.max(0, stretch) * 2, 9, 7, 0, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(2, -10, 13 + stretch * 2, 8, -0.15, 0, TAU); g.fill();
        g.fillStyle = "#f3d9b5";
        g.beginPath(); g.ellipse(7, -7, 6, 4.5, -0.3, 0, TAU); g.fill();
        // front legs
        g.strokeStyle = "#8f4a1f";
        g.lineWidth = 2.6;
        g.lineCap = "round";
        g.beginPath(); g.moveTo(9, -6); g.lineTo(12 + stretch * 4, 0); g.stroke();
        g.beginPath(); g.moveTo(-6, -2); g.lineTo(-9 - stretch * 4, 0); g.stroke();
        // head, ear, eye and nose
        g.fillStyle = "#c46a2d";
        g.beginPath(); g.ellipse(14, -17, 7.5, 6.5, 0.2, 0, TAU); g.fill();
        g.beginPath(); g.moveTo(10, -21); g.lineTo(11, -29); g.lineTo(15, -22); g.fill();
        g.fillStyle = "#1e120a";
        g.beginPath(); g.arc(16, -18.5, 1.5, 0, TAU); g.fill();
        g.beginPath(); g.arc(21.2, -15.5, 1.2, 0, TAU); g.fill();
        if (acorn) {
            g.fillStyle = "#b07a3a";
            g.beginPath(); g.ellipse(22, -9, 3.2, 4, 0, 0, TAU); g.fill();
            g.fillStyle = "#6b4220";
            g.beginPath(); g.ellipse(22, -12, 3.8, 2.2, 0, Math.PI, TAU); g.closePath(); g.fill();
        }
        g.restore();
    }

    // ---------------------------------------------------------------------------------------------
    // The background
    // ---------------------------------------------------------------------------------------------
    function scene(W, H, opts) {
        const night = opts.theme === "dark", preview = !!opts.preview;
        let groundY, hills, trees, floor, oak, sky = null, branch = [];
        let leaves, stars, rays;
        let gust = 0, gustLeft = 0, nextGust = preview ? 999 : U.rand(14, 24);
        let runner = null, nextRunner = preview ? 999 : U.rand(4, 9), digger = null, nextDigger = preview ? 999 : U.rand(10, 18), dirt = [];
        let geese = null, nextGeese = preview ? 999 : U.rand(8, 16), owlBlink = 0, owlNext = 3;

        const C = night
            ? { top: "#090b20", mid: "#241a3c", low: "#5b3647", hill1: "#2c2032", hill2: "#22192a", trunk: "#24160f", ground1: "#3a2416", ground2: "#1c120b", leafDim: 0.45 }
            : { top: "#86b9de", mid: "#f3d6a4", low: "#f6b56a", hill1: "#b9876a", hill2: "#9a6a4f", trunk: "#5a3920", ground1: "#b9733a", ground2: "#7e4a24", leafDim: 1 };
        const shade = (hex, k) => {             // darken a colour for night
            const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
            return `rgb(${Math.round(r * k)},${Math.round(gg * k)},${Math.round(b * k)})`;
        };
        const canopyCol = c => (night ? shade(c, 0.42) : c);

        // a round, leafy canopy made of overlapping clusters, lit from the upper left
        function canopy(g, x, y, r, R) {
            const cols = LEAVES.map(canopyCol);
            for (let i = 0; i < 16; i++) {
                const a = R() * TAU, d = Math.sqrt(R()) * r * 0.75, cr = r * (0.32 + R() * 0.25);
                g.fillStyle = cols[Math.floor(R() * cols.length)];
                g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, cr, 0, TAU); g.fill();
            }
            const lg = g.createRadialGradient(x - r * 0.4, y - r * 0.5, r * 0.1, x, y, r * 1.2);
            lg.addColorStop(0, night ? "rgba(255,220,160,.08)" : "rgba(255,240,190,.35)");
            lg.addColorStop(1, "rgba(60,20,0,.2)");
            g.fillStyle = lg;
            g.beginPath(); g.arc(x, y, r * 1.05, 0, TAU); g.fill();
        }

        function setup() {
            groundY = Math.round(H * (preview ? 0.78 : 0.76));
            sky = null;
            const R = U.rng(404);
            // rolling hills with tiny trees along their tops
            hills = canvas(W + 60, H);
            {
                const g = hills.getContext("2d"), w = hills.width;
                [[0.52, C.hill1, 0.06], [0.6, C.hill2, 0.05]].forEach(([base, col, amp], layer) => {
                    const y0 = H * base, pts = [];
                    for (let x = 0; x <= w; x += 20) pts.push([x, y0 - Math.sin(x * 0.006 + layer * 2) * H * amp - Math.sin(x * 0.017 + layer) * H * 0.012]);
                    g.fillStyle = col;
                    g.beginPath(); g.moveTo(0, H); pts.forEach(([x, y]) => g.lineTo(x, y)); g.lineTo(w, H); g.fill();
                    const step = preview ? 9 : 12 + layer * 4;
                    for (let x = 0; x < w; x += step * (0.6 + R() * 0.8)) {
                        const y = y0 - Math.sin(x * 0.006 + layer * 2) * H * amp - Math.sin(x * 0.017 + layer) * H * 0.012;
                        g.fillStyle = canopyCol(LEAVES[Math.floor(R() * LEAVES.length)]);
                        g.globalAlpha = layer ? 0.9 : 0.65;
                        g.beginPath(); g.arc(x, y + 2, H * (0.012 + R() * 0.012) * (layer ? 1.3 : 1), 0, TAU); g.fill();
                    }
                    g.globalAlpha = 1;
                });
            }
            // a row of autumn trees in the middle distance
            trees = canvas(W + 120, H);
            {
                const g = trees.getContext("2d"), n = Math.max(4, Math.round(trees.width / (preview ? 60 : 150)));
                for (let i = 0; i < n; i++) {
                    const x = (i + 0.2 + R() * 0.6) / n * trees.width, h = H * (0.15 + R() * 0.11), base = groundY + H * 0.01;
                    g.fillStyle = C.trunk;
                    g.beginPath(); g.moveTo(x - h * 0.03, base); g.lineTo(x - h * 0.015, base - h * 0.7); g.lineTo(x + h * 0.015, base - h * 0.7); g.lineTo(x + h * 0.03, base); g.fill();
                    canopy(g, x, base - h * 0.78, h * 0.32, R);
                }
            }
            // the forest floor: leaf litter, mushrooms and a pumpkin
            floor = canvas(W + 40, H - groundY + H * 0.05);
            {
                const g = floor.getContext("2d"), w = floor.width, fh = floor.height, top = H * 0.03;
                const gr = g.createLinearGradient(0, top, 0, fh);
                gr.addColorStop(0, C.ground1);
                gr.addColorStop(1, C.ground2);
                g.fillStyle = gr;
                g.beginPath(); g.moveTo(0, fh); g.lineTo(0, top);
                for (let x = 0; x <= w; x += 30) g.lineTo(x, top - Math.sin(x * 0.01) * H * 0.012 - R() * 3);
                g.lineTo(w, fh); g.fill();
                const count = preview ? 120 : Math.round(w * fh / 260);
                for (let i = 0; i < count; i++) {
                    g.save();
                    g.translate(R() * w, top + R() * (fh - top));
                    g.rotate(R() * TAU);
                    g.fillStyle = canopyCol(LEAVES[Math.floor(R() * LEAVES.length)]);
                    g.globalAlpha = 0.55 + R() * 0.45;
                    leafPath(g, 3 + R() * 5, R() < 0.4);
                    g.fill();
                    g.restore();
                }
                g.globalAlpha = 1;
                if (!preview) {
                    for (let i = 0; i < 4; i++) {                    // mushrooms
                        const mx = (0.15 + R() * 0.7) * w, my = top + fh * (0.25 + R() * 0.4), ms = H * (0.012 + R() * 0.012);
                        g.fillStyle = night ? "#8d8070" : "#f3ead8";
                        g.fillRect(mx - ms * 0.3, my - ms * 1.4, ms * 0.6, ms * 1.4);
                        g.fillStyle = night ? "#6e2a20" : "#d8432e";
                        g.beginPath(); g.ellipse(mx, my - ms * 1.4, ms * 1.1, ms * 0.75, 0, Math.PI, TAU); g.fill();
                        g.fillStyle = night ? "#a89a88" : "#ffffff";
                        for (const [dx, dy] of [[-0.5, -0.3], [0.2, -0.55], [0.55, -0.2]]) { g.beginPath(); g.arc(mx + dx * ms, my - ms * 1.4 + dy * ms, ms * 0.14, 0, TAU); g.fill(); }
                    }
                    const px = w * 0.8, py = top + fh * 0.35, ps = H * 0.035;  // a pumpkin
                    g.fillStyle = night ? "#6a3410" : "#e3781f";
                    for (const dx of [-0.55, 0.55, 0]) { g.beginPath(); g.ellipse(px + dx * ps, py, ps * 0.62, ps * 0.55, 0, 0, TAU); g.fill(); }
                    g.fillStyle = night ? "#2c3a18" : "#4d6a24";
                    g.fillRect(px - ps * 0.08, py - ps * 0.75, ps * 0.16, ps * 0.25);
                }
            }
            // the big oak on the left, with a long branch reaching over the top
            oak = canvas(W + 80, H);
            branch = [];
            {
                const g = oak.getContext("2d"), tw = U.clamp(W * 0.05, 22, 70), x0 = 40 + W * 0.04, by = H * 0.14;
                const bark = night ? "#1d120b" : "#5b3820";
                g.fillStyle = bark;
                g.beginPath();
                g.moveTo(x0 - tw, H);
                g.bezierCurveTo(x0 - tw * 0.6, H * 0.6, x0 - tw * 0.5, H * 0.35, x0 - tw * 0.4, by - tw * 0.2);
                g.lineTo(x0 + tw * 0.5, by - tw * 0.3);
                g.bezierCurveTo(x0 + tw * 0.5, H * 0.4, x0 + tw * 0.6, H * 0.7, x0 + tw * 1.1, H);
                g.fill();
                // the branch, drawn as a tapering curve; remember points along its top for the running squirrel
                const bx1 = x0 + W * 0.3, bend = by - H * 0.04;
                const pt = u => {
                    const mx = U.lerp(x0, bx1, u), my = (1 - u) ** 2 * by + 2 * (1 - u) * u * bend + u * u * (by + H * 0.02);
                    return [mx, my];
                };
                for (let i = 0; i <= 30; i++) { const u = i / 30, [mx, my] = pt(u), th = tw * 0.42 * (1 - u * 0.8); branch.push([mx - 40, my - th * 0.55]); g.fillStyle = bark; g.beginPath(); g.arc(mx, my, th * 0.55, 0, TAU); g.fill(); }
                g.strokeStyle = night ? "rgba(255,255,255,.04)" : "rgba(255,220,180,.12)";
                g.lineWidth = 2;
                for (let i = 0; i < 6; i++) { const xx = x0 - tw * 0.3 + i * tw * 0.14; g.beginPath(); g.moveTo(xx, H); g.quadraticCurveTo(xx + 4, H * 0.6, xx - 2, by + 20); g.stroke(); }
                // the hollow
                g.fillStyle = night ? "#070302" : "#2c180b";
                g.beginPath(); g.ellipse(x0 + tw * 0.05, H * 0.5, tw * 0.25, tw * 0.36, 0, 0, TAU); g.fill();
                // leaves on the branch and the top of the trunk
                for (let i = 0; i < 5; i++) { const [mx, my] = pt(0.25 + i * 0.17); canopy(g, mx, my - tw * 0.45, tw * (0.55 + R() * 0.3), R); }
                canopy(g, x0, by - tw * 0.6, tw * 1.15, R);
            }
            const Rl = U.rng(77);
            leaves = Array.from({ length: preview ? 10 : 44 }, () => ({ x: Rl() * W, y: Rl() * H, s: 4 + Rl() * 7, depth: 0.4 + Rl() * 0.9, rot: Rl() * TAU, spin: (Rl() - 0.5) * 3, flip: Rl() * TAU, sway: Rl() * TAU, c: LEAVES[Math.floor(Rl() * LEAVES.length)], pointy: Rl() < 0.45 }));
            stars = Array.from({ length: preview ? 25 : 110 }, () => ({ x: Rl() * W, y: Rl() * H * 0.45, r: Rl() * 1.2 + 0.3, tw: Rl() * TAU }));
            rays = Array.from({ length: 6 }, (_, i) => ({ a: 2.1 + i * 0.13 + Rl() * 0.05, w: 0.025 + Rl() * 0.03, ph: Rl() * TAU }));
        }
        setup();

        return {
            resize(w, h) { W = w; H = h; setup(); },
            draw(g, t, dt, inp) {
                if (!sky) {
                    sky = g.createLinearGradient(0, 0, 0, groundY);
                    sky.addColorStop(0, C.top);
                    sky.addColorStop(0.55, C.mid);
                    sky.addColorStop(1, C.low);
                }
                g.fillStyle = sky;
                g.fillRect(0, 0, W, H);
                nextGust -= dt;
                if (nextGust <= 0 && gustLeft <= 0) { gustLeft = 3; nextGust = U.rand(16, 28); }
                if (gustLeft > 0) { gustLeft -= dt; gust = Math.sin(Math.PI * (1 - gustLeft / 3)) * 160; } else gust = 0;
                const wind = 18 + Math.sin(t * 0.21) * 16 + gust;

                const sx = W * 0.8 - inp.px * 6, sy = H * (night ? 0.3 : 0.27), sr = Math.min(W, H) * (night ? 0.075 : 0.06);
                if (night) {
                    for (const s of stars) {
                        g.fillStyle = `rgba(255,240,220,${(0.25 + 0.6 * Math.abs(Math.sin(t * 1.2 + s.tw))).toFixed(2)})`;
                        g.fillRect(s.x - inp.px * 2, s.y, s.r * 1.3, s.r * 1.3);
                    }
                    // a big harvest moon
                    const mg = g.createRadialGradient(sx, sy, sr * 0.7, sx, sy, sr * 3.5);
                    mg.addColorStop(0, "rgba(255,180,100,.35)");
                    mg.addColorStop(1, "rgba(255,150,80,0)");
                    g.fillStyle = mg;
                    g.fillRect(sx - sr * 3.5, sy - sr * 3.5, sr * 7, sr * 7);
                    const mf = g.createRadialGradient(sx - sr * 0.3, sy - sr * 0.3, sr * 0.1, sx, sy, sr);
                    mf.addColorStop(0, "#ffe2b0");
                    mf.addColorStop(1, "#f2a45a");
                    g.fillStyle = mf;
                    g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.fill();
                    g.fillStyle = "rgba(170,90,40,.25)";
                    for (const [cx, cy, cr] of [[-0.35, -0.1, 0.2], [0.2, 0.3, 0.15], [0.3, -0.35, 0.1]]) { g.beginPath(); g.arc(sx + cx * sr, sy + cy * sr, cr * sr, 0, TAU); g.fill(); }
                } else {
                    const sg = g.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 6);
                    sg.addColorStop(0, "rgba(255,236,170,.9)");
                    sg.addColorStop(0.25, "rgba(255,210,130,.35)");
                    sg.addColorStop(1, "rgba(255,190,110,0)");
                    g.fillStyle = sg;
                    g.fillRect(sx - sr * 6, sy - sr * 6, sr * 12, sr * 12);
                    g.fillStyle = "#fff3cf";
                    g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.fill();
                    // geese flying south in a V
                    nextGeese -= dt;
                    if (!geese && nextGeese <= 0) geese = { x: W + 40, y: H * U.rand(0.08, 0.22), vx: -U.rand(45, 70), n: 5 + Math.floor(Math.random() * 4) };
                    if (geese) {
                        geese.x += geese.vx * dt;
                        g.strokeStyle = "rgba(70,50,40,.75)";
                        g.lineWidth = 1.6;
                        g.lineCap = "round";
                        for (let i = 0; i < geese.n; i++) {
                            const k = Math.ceil(i / 2) * (i % 2 ? 1 : -1), gx = geese.x + Math.abs(k) * 16, gy = geese.y + k * 9, f = Math.sin(t * 8 + i) * 4;
                            g.beginPath(); g.moveTo(gx - 6, gy - f); g.lineTo(gx, gy); g.lineTo(gx + 6, gy - f); g.stroke();
                        }
                        if (geese.x < -160) { geese = null; nextGeese = U.rand(20, 34); }
                    }
                }
                g.drawImage(hills, -30 - inp.px * 4, 0);
                // sunbeams slanting through the trees
                if (!night) {
                    g.globalCompositeOperation = "lighter";
                    for (const r of rays) {
                        const a = r.a + Math.sin(t * 0.15 + r.ph) * 0.02, len = Math.hypot(W, H), al = 0.05 + 0.03 * Math.sin(t * 0.4 + r.ph);
                        g.fillStyle = `rgba(255,220,150,${al.toFixed(3)})`;
                        g.beginPath();
                        g.moveTo(sx, sy);
                        g.lineTo(sx + Math.cos(a - r.w) * len, sy + Math.sin(a - r.w) * len);
                        g.lineTo(sx + Math.cos(a + r.w) * len, sy + Math.sin(a + r.w) * len);
                        g.fill();
                    }
                    g.globalCompositeOperation = "source-over";
                }
                g.drawImage(trees, -60 - inp.px * 9, 0);
                g.drawImage(floor, -20 - inp.px * 6, groundY - H * 0.03);
                if (night) {
                    const fog = g.createLinearGradient(0, groundY - H * 0.1, 0, H);
                    fog.addColorStop(0, "rgba(140,120,170,0)");
                    fog.addColorStop(0.5, `rgba(140,120,170,${(0.16 + Math.sin(t * 0.3) * 0.04).toFixed(3)})`);
                    fog.addColorStop(1, "rgba(140,120,170,0)");
                    g.fillStyle = fog;
                    g.fillRect(0, groundY - H * 0.1, W, H);
                }

                // a squirrel that digs a hole, buries an acorn and dashes off
                nextDigger -= dt;
                if (!digger && nextDigger <= 0) { const dir = Math.random() < 0.5 ? 1 : -1; digger = { dir, x: dir > 0 ? -40 : W + 40, y: groundY + (H - groundY) * U.rand(0.35, 0.6), stopAt: W * U.rand(0.25, 0.75), state: "in", t: 0, s: U.clamp(H / 700, 0.7, 1.5) }; }
                if (digger) {
                    const d = digger;
                    d.t += dt;
                    if (d.state === "in") { d.x += d.dir * 140 * dt; if ((d.dir > 0 && d.x >= d.stopAt) || (d.dir < 0 && d.x <= d.stopAt)) { d.state = "dig"; d.t = 0; } }
                    else if (d.state === "dig") {
                        if (Math.random() < dt * 30) dirt.push({ x: d.x + d.dir * 6 * d.s, y: d.y, vx: -d.dir * U.rand(20, 80), vy: -U.rand(60, 140), life: 0.6 });
                        if (d.t > 1.6) { d.state = "out"; d.dir = -d.dir; }
                    } else { d.x += d.dir * 180 * dt; if (d.x < -60 || d.x > W + 60) { digger = null; nextDigger = U.rand(18, 32); } }
                    if (digger) drawSquirrel(g, d.x - inp.px * 6, d.y, d.s, d.dir, d.state === "dig" ? (d.t * 4) % 1 * 0.3 : (t * 3.2) % 1, Math.sin(t * 6), d.state === "in");
                }
                dirt = dirt.filter(p => {
                    p.life -= dt; p.vy += 400 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
                    g.fillStyle = `rgba(90,55,30,${Math.max(0, p.life).toFixed(2)})`;
                    g.fillRect(p.x - inp.px * 6, p.y, 3, 3);
                    return p.life > 0;
                });

                g.drawImage(oak, -40 - inp.px * 14, 0);
                // the owl in the hollow at night
                if (night) {
                    owlNext -= dt;
                    if (owlNext <= 0) { owlBlink = 0.18; owlNext = U.rand(2, 5); }
                    owlBlink -= dt;
                    const ow = U.clamp(W * 0.05, 22, 70), ox = W * 0.04 + ow * 0.05 - inp.px * 14, oy = H * 0.5, os = ow * 0.1;
                    g.fillStyle = "#ffcf3f";
                    for (const side of [-1, 1]) {
                        if (owlBlink > 0) g.fillRect(ox + side * os * 1.1 - os * 0.7, oy - 1, os * 1.4, 2);
                        else { g.beginPath(); g.arc(ox + side * os * 1.1, oy, os * 0.7, 0, TAU); g.fill(); }
                    }
                }
                // a squirrel running along the oak's branch, pausing at the end to flick its tail
                nextRunner -= dt;
                if (!runner && nextRunner <= 0 && branch.length) runner = { u: 0, dir: 1, state: "run", t: 0 };
                if (runner) {
                    const r = runner;
                    r.t += dt;
                    if (r.state === "run") {
                        r.u += r.dir * dt * 0.28;
                        if (r.u >= 0.85) { r.u = 0.85; r.state = "sit"; r.t = 0; }
                        if (r.u <= 0 && r.dir < 0) { runner = null; nextRunner = U.rand(12, 22); }
                    } else if (r.t > 2.2) { r.state = "run"; r.dir = -1; }
                    if (runner) {
                        const i = Math.min(branch.length - 1, Math.floor(r.u * (branch.length - 1))), [bx, by] = branch[i];
                        drawSquirrel(g, bx - inp.px * 14, by + 2, U.clamp(H / 900, 0.55, 1.1), r.dir, r.state === "run" ? (t * 3.5) % 1 : 0, r.state === "sit" ? Math.sin(t * 14) : Math.sin(t * 5), false);
                    }
                }

                // tumbling leaves, pushed along by the breeze
                for (const l of leaves) {
                    l.y += (24 + l.s * 3) * l.depth * dt;
                    l.x += (wind * l.depth + Math.sin(t * 1.4 + l.sway) * 26) * dt;
                    l.rot += l.spin * dt;
                    l.flip += dt * 3;
                    if (l.y > H + 12) { l.y = -12; l.x = Math.random() * W; }
                    if (l.x > W + 14) l.x -= W + 28; else if (l.x < -14) l.x += W + 28;
                    g.save();
                    g.translate(l.x - inp.px * 10 * l.depth, l.y);
                    g.rotate(l.rot);
                    g.scale(1, Math.abs(Math.cos(l.flip)) * 0.85 + 0.15);
                    g.fillStyle = canopyCol(l.c);
                    leafPath(g, l.s * l.depth, l.pointy);
                    g.fill();
                    g.restore();
                }
            }
        };
    }

    // ---------------------------------------------------------------------------------------------
    // The board: acorns, nuts and leaves; squirrels run across finished words; an acorn stash counter
    // ---------------------------------------------------------------------------------------------
    const NUTS = [
        // acorn
        `<ellipse cx="0" cy=".05" rx=".085" ry=".11" fill="url(#sqNut)"/><path d="M-.11 -.03Q0 -.13 .11 -.03Q0 -.01 -.11 -.03Z" fill="#6b4220"/><path d="M-.09 -.045L.09 -.045M-.06 -.07L.06 -.07" stroke="#4e2f15" stroke-width=".01"/><rect x="-.012" y="-.13" width=".024" height=".05" rx=".01" fill="#4e2f15"/>`,
        // hazelnut
        `<circle cx="0" cy=".02" r=".09" fill="#a4652f"/><path d="M-.09 .0Q-.06 -.12 0 -.11Q.06 -.12 .09 0Q.03 -.06 -.09 0Z" fill="#7a9a3a"/><circle cx="-.03" cy="-.0" r=".02" fill="rgba(255,255,255,.35)"/>`,
        // maple leaf
        `<path d="M0 -.13L.03 -.06L.1 -.09L.07 -.02L.13 .01L.06 .03L.08 .1L0 .05L-.08 .1L-.06 .03L-.13 .01L-.07 -.02L-.1 -.09L-.03 -.06Z" fill="#d9531e"/><path d="M0 .05V.15" stroke="#7a2e10" stroke-width=".015"/>`,
        // oak leaf
        `<path d="M0 -.13Q.05 -.1 .04 -.06Q.09 -.05 .06 0Q.1 .03 .05 .06Q.06 .11 0 .12Q-.06 .11 -.05 .06Q-.1 .03 -.06 0Q-.09 -.05 -.04 -.06Q-.05 -.1 0 -.13Z" fill="#e8a33d"/><path d="M0 -.11V.16" stroke="#8a5212" stroke-width=".012"/>`,
        // chestnut
        `<path d="M-.09 .06Q-.1 -.06 0 -.1Q.1 -.06 .09 .06Q0 .1 -.09 .06Z" fill="#6e3518"/><path d="M-.09 .06Q0 .1 .09 .06Q0 .05 -.09 .06Z" fill="#d9b58a"/><ellipse cx="-.03" cy="-.03" rx=".02" ry=".035" fill="rgba(255,255,255,.3)"/>`
    ];
    const SQUIRREL_SVG = `<svg viewBox="-30 -36 60 40" aria-hidden="true"><g class="sq-tail"><path d="M-10 -12C-32 -16 -36 -42 -22 -52C-12 -60 0 -52 -6 -44C-18 -46 -22 -32 -12 -22Z" transform="translate(0 12)" fill="#c46a2d"/></g>
        <ellipse cx="-4" cy="-6" rx="9" ry="7" fill="#b9622a"/><ellipse cx="2" cy="-10" rx="13" ry="8" fill="#b9622a"/><ellipse cx="7" cy="-7" rx="6" ry="4.5" fill="#f3d9b5"/>
        <ellipse cx="14" cy="-17" rx="7.5" ry="6.5" fill="#c46a2d"/><path d="M10 -21L11 -29L15 -22Z" fill="#c46a2d"/><circle cx="16" cy="-18.5" r="1.5" fill="#1e120a"/><circle cx="21.2" cy="-15.5" r="1.2" fill="#1e120a"/>
        <path d="M9 -6L12 0M-6 -2L-9 0" stroke="#8f4a1f" stroke-width="2.6" stroke-linecap="round"/></svg>`;

    const board = (() => {
        let layer = null, gNuts, nuts = new Map(), seed = 1, size = 5, quiet = true, boardRef = null;
        let hud = null, countEl = null, shown = 0;
        const rnd = (...k) => { let h = seed; for (const v of k) { h = Math.imul(h ^ v, 2654435761); h ^= h >>> 13; } return (h >>> 0) / 4294967296; };

        function build(game, boardEl) {
            if (layer) layer.remove();
            size = game.puzzle.size;
            seed = U.hash(game.puzzle.seed + game.puzzle.mode + "acorn");
            boardRef = boardEl;
            layer = U.svg("svg", { class: "sq-layer", viewBox: `0 0 ${size} ${size}`, preserveAspectRatio: "none", "aria-hidden": "true" });
            layer.innerHTML = `<defs><radialGradient id="sqNut" cx=".35" cy=".35" r=".8"><stop offset="0" stop-color="#d9a05a"/><stop offset="1" stop-color="#9a5f28"/></radialGradient></defs>`;
            boardEl.appendChild(layer);
            gNuts = U.svg("g", {}, layer);
            nuts = new Map();
        }
        function nut(r, c, grow) {
            const kind = Math.floor(rnd(r, c, 1) * NUTS.length);
            const [ox, oy] = [[0.8, 0.24], [0.8, 0.77], [0.22, 0.78]][Math.floor(rnd(r, c, 2) * 3)];
            const x = c + ox + (rnd(r, c, 3) - 0.5) * 0.05, y = r + oy + (rnd(r, c, 4) - 0.5) * 0.05, rot = (rnd(r, c, 5) - 0.5) * 60, s = 0.85 + rnd(r, c, 6) * 0.35;
            const outer = U.svg("g", { transform: `translate(${x.toFixed(3)} ${y.toFixed(3)}) rotate(${rot.toFixed(1)}) scale(${s.toFixed(2)})`, class: "sq-nut" + (grow ? " drop" : "") }, gNuts);
            const inner = U.svg("g", { class: "sq-nut-in" }, outer);
            inner.innerHTML = NUTS[kind];
            return outer;
        }
        function attach(boardEl, game) {
            quiet = true;
            const slot = document.getElementById("world-hud");
            if (!hud) {
                hud = U.el("div", { class: "sq-hud", title: "Your acorn stash: one per letter, five more per word",
                    html: `<svg viewBox="-.14 -.15 .28 .3" aria-hidden="true">${NUTS[0].replace("url(#sqNut)", "#c08040")}</svg><b class="sq-count">0</b>` });
                countEl = hud.querySelector(".sq-count");
            }
            if (!slot.contains(hud)) slot.appendChild(hud);
            shown = 0;
        }
        function update(game, boardEl) {
            if (!layer || !boardEl.contains(layer) || size !== game.puzzle.size) { build(game, boardEl); quiet = true; }
            if (!hud) attach(boardEl, game);
            const grow = !quiet && U.motion() !== "still";
            quiet = false;
            const n = game.puzzle.size;
            const want = new Set();
            let letters = 0;
            for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
                if (!game.letters[r][c]) continue;
                if (!game.revealed[r][c]) letters++;
                const key = r * 99 + c;
                want.add(key);
                if (!nuts.has(key)) nuts.set(key, nut(r, c, grow));
            }
            for (const [key, el] of nuts) if (!want.has(key)) { el.remove(); nuts.delete(key); }
            const done = new Set();
            let words = 0;
            for (const entry of [...game.puzzle.across, ...game.puzzle.down]) {
                const cells = Game.cellsOf(entry);
                if (!cells.every(([r, c]) => game.letters[r][c])) continue;
                words++;
                cells.forEach(([r, c]) => done.add(r * 99 + c));
            }
            for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { const cell = Game.cellEl(r, c); if (cell) cell.classList.toggle("sq-done", done.has(r * 99 + c)); }
            boardEl.classList.toggle("sq-solved", !!(game.solved && !game.surrendered));
            const stash = letters + words * 5;
            if (stash !== shown) {
                const from = shown;
                shown = stash;
                if (grow) FX.countUp(countEl, stash, { from, dur: 400 }); else countEl.textContent = String(stash);
                if (grow && stash > from) U.restart(hud, "bump");
            }
        }
        function type(cell) {
            const p = U.center(cell);
            FX.burst({ x: p.x, y: p.y, n: 5, colors: LEAVES, shape: "leaf", speed: [40, 110], angle: -Math.PI / 2, spread: 1.2, gravity: 90, drag: 2, life: [0.7, 1.1], size: [4, 6], wobble: 40, spin: 4 });
        }
        // a little squirrel scampers along the finished word, hopping from square to square
        function wordDone(entry, cells) {
            if (U.motion() === "still") return;
            const pts = cells.map(([r, c]) => Game.cellEl(r, c)).filter(Boolean).map(el => U.center(el));
            if (!pts.length) return;
            const sq = U.el("div", { class: "sq-runner", html: SQUIRREL_SVG, style: { left: "0px", top: "0px" } });
            document.getElementById("overlay").appendChild(sq);
            const frames = [];
            pts.forEach((p, i) => {
                frames.push({ transform: `translate(${p.x - 24}px, ${p.y - 30}px)`, offset: i / pts.length });
                if (i < pts.length - 1) { const q = pts[i + 1]; frames.push({ transform: `translate(${(p.x + q.x) / 2 - 24}px, ${(p.y + q.y) / 2 - 52}px)`, offset: (i + 0.5) / pts.length }); }
            });
            const last = pts[pts.length - 1];
            frames.push({ transform: `translate(${last.x - 24}px, ${last.y - 30}px)`, offset: 1 });
            const dur = 170 * pts.length + 150;
            sq.animate([{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], { duration: dur + 350 });
            sq.animate(frames, { duration: dur, easing: "linear", fill: "forwards" });
            pts.forEach((p, i) => setTimeout(() => FX.burst({ x: p.x, y: p.y + p.h * 0.2, n: 4, colors: ["#e8c547", "#f2a03d", "#d9531e"], shape: "leaf", speed: [30, 90], angle: -Math.PI / 2, spread: 1.4, gravity: 120, life: [0.6, 1], size: [3, 5], wobble: 30 }), 170 * i + 80));
            setTimeout(() => { Sound.play("chitter"); FX.burst({ x: last.x, y: last.y - 20, n: 6, colors: ["#c99a4a", "#b07a3a"], shape: "acorn", speed: [80, 200], angle: -Math.PI / 2, spread: 1, gravity: 500, life: [0.6, 0.9], size: [5, 7], spin: 6 }); }, dur);
            setTimeout(() => sq.remove(), dur + 400);
        }
        function restoreSolved(boardEl, game) { quiet = true; update(game, boardEl); }
        function clear() {
            if (layer) layer.remove();
            layer = null;
            nuts = new Map();
            if (hud) hud.remove();
            hud = null;
            shown = 0;
            Game.openCells().forEach(cell => cell.classList.remove("sq-done"));
            if (boardRef) boardRef.classList.remove("sq-solved");
        }
        return { attach, update, type, wordDone, restoreSolved, reset: clear, clear };
    })();

    // ---------------------------------------------------------------------------------------------
    // The win: a gust of leaves, a squirrel with a golden acorn, a crack, and a leaf tornado
    // ---------------------------------------------------------------------------------------------
    const HERO = `<svg viewBox="-60 -110 120 120" aria-hidden="true">
        <g class="sqh-tail"><path d="M-14 -20C-56 -26 -62 -86 -34 -100C-14 -110 6 -96 -4 -84C-26 -86 -34 -56 -12 -40Z" fill="#c46a2d"/>
            <path d="M-20 -30C-40 -42 -44 -70 -30 -88" stroke="#f0b27a" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/></g>
        <ellipse cx="0" cy="-26" rx="22" ry="26" fill="#c06a2c"/><ellipse cx="2" cy="-20" rx="13" ry="18" fill="#f5dcb8"/>
        <ellipse cx="-12" cy="-2" rx="11" ry="6" fill="#a9551f"/><ellipse cx="14" cy="-2" rx="11" ry="6" fill="#a9551f"/>
        <circle cx="4" cy="-62" r="20" fill="#c86f30"/><path d="M-10 -76L-12 -94L0 -80Z" fill="#c86f30"/><path d="M14 -78L22 -94L22 -74Z" fill="#c86f30"/>
        <path d="M-9 -78L-11 -89L-3 -80Z" fill="#f2a7a0"/><path d="M15 -78L20 -88L20 -76Z" fill="#f2a7a0"/>
        <ellipse cx="-4" cy="-64" rx="4" ry="5" fill="#1e120a"/><ellipse cx="13" cy="-64" rx="4" ry="5" fill="#1e120a"/>
        <circle cx="-2.6" cy="-66" r="1.4" fill="#fff"/><circle cx="14.4" cy="-66" r="1.4" fill="#fff"/>
        <ellipse cx="5" cy="-54" rx="3.4" ry="2.4" fill="#3a1f10"/><path d="M1 -49Q5 -45 9 -49" stroke="#3a1f10" stroke-width="2" fill="none" stroke-linecap="round"/>
        <rect x="2.6" y="-49" width="4.8" height="5" rx="1" fill="#fff"/>
        <g class="sqh-arms"><path d="M-14 -36Q-22 -60 -10 -78" stroke="#a9551f" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M16 -36Q24 -60 14 -78" stroke="#a9551f" stroke-width="7" stroke-linecap="round" fill="none"/></g></svg>`;
    const GOLD_ACORN = `<svg viewBox="-30 -36 60 72" aria-hidden="true"><defs><radialGradient id="sqGold" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff2a8"/><stop offset=".5" stop-color="#f2c33c"/><stop offset="1" stop-color="#b9821a"/></radialGradient></defs>
        <g class="sqa-nut"><ellipse cx="0" cy="8" rx="20" ry="24" fill="url(#sqGold)"/><ellipse cx="-7" cy="0" rx="5" ry="8" fill="rgba(255,255,255,.55)"/></g>
        <g class="sqa-cap"><path d="M-25 -6Q0 -34 25 -6Q0 2 -25 -6Z" fill="#8a5a1e"/><path d="M-18 -12L18 -12M-12 -20L12 -20M-21 -6L21 -6" stroke="#5c3a10" stroke-width="2"/><rect x="-3" y="-32" width="6" height="10" rx="2" fill="#5c3a10"/></g></svg>`;

    async function celebrate(c, { boardEl }) {
        if (U.motion() === "still") return;
        const W = innerWidth, H = innerHeight, b = boardEl.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
        const overlay = document.getElementById("overlay");
        // 1. a gust of leaves blows in from both sides
        Sound.play("rustle");
        for (const side of [-1, 1]) FX.burst({ x: side < 0 ? -20 : W + 20, y: H * 0.5, jitterY: H * 0.45, n: 50, colors: LEAVES, shape: "leaf", angle: side < 0 ? 0 : Math.PI, spread: 0.5, speed: [300, 700], gravity: 140, drag: 1.1, life: [1.5, 2.5], size: [6, 11], wobble: 60, spin: 6 });
        await c.wait(700);
        if (c.skipped) return;

        // 2. the squirrel bounds onto the board holding a golden acorn
        const hero = U.el("div", { class: "sq-hero", html: HERO, style: { left: cx - 60 + "px", top: b.top - 110 + 20 + "px" } });
        const acorn = U.el("div", { class: "sq-gold", html: GOLD_ACORN, style: { left: cx - 22 + "px", top: b.top - 120 + "px" } });
        overlay.append(hero, acorn);
        c.cleanup(() => { hero.remove(); acorn.remove(); });
        const from = cx < W / 2 ? W + 80 : -200;
        hero.animate([{ transform: `translate(${from - cx}px, 120px)` }, { transform: `translate(${(from - cx) * 0.5}px, -120px)`, offset: 0.5 }, { transform: "none" }], { duration: 750, easing: "cubic-bezier(.3,.7,.4,1)", fill: "backwards" });
        acorn.animate([{ transform: `translate(${from - cx}px, 120px)` }, { transform: `translate(${(from - cx) * 0.5}px, -120px)`, offset: 0.5 }, { transform: "none" }], { duration: 750, easing: "cubic-bezier(.3,.7,.4,1)", fill: "backwards" });
        Sound.play("chitter");
        await c.wait(800);
        if (c.skipped) return;
        hero.querySelector(".sqh-tail").animate([{ transform: "rotate(0)" }, { transform: "rotate(14deg)" }, { transform: "rotate(-8deg)" }, { transform: "rotate(0)" }], { duration: 500, iterations: 2 });
        hero.animate([{ transform: "none" }, { transform: "translateY(10px) scaleY(.9)" }, { transform: "none" }], { duration: 300, delay: 300 });
        await c.wait(600);
        if (c.skipped) return;

        // 3. it throws the acorn up... and it cracks open
        Sound.play("whoosh");
        const up = acorn.animate([{ transform: "none" }, { transform: `translateY(${-Math.min(220, b.top + 40)}px) rotate(540deg) scale(1.4)` }], { duration: 650, easing: "cubic-bezier(.2,.8,.4,1)", fill: "forwards" });
        c.cleanup(() => up.cancel());
        await c.wait(650);
        if (c.skipped) return;
        const ap = U.center(acorn);
        Sound.play("crack");
        FX.flash("#ffe6a8", 400, 0.55);
        FX.ring({ x: ap.x, y: ap.y, color: "#ffd166", r1: Math.max(W, H) * 0.5, dur: 1, width: 18 });
        FX.burst({ x: ap.x, y: ap.y, n: 70, colors: ["#ffd166", "#f2a03d", "#fff2a8", "#e8c547"], shape: "star", speed: [200, 700], gravity: 320, drag: 1, life: [0.9, 1.6], size: [4, 8], glow: true, spin: 4 });
        FX.burst({ x: ap.x, y: ap.y, n: 40, colors: ["#c99a4a", "#b07a3a", "#e0b05a"], shape: "acorn", speed: [180, 560], gravity: 600, drag: 0.8, life: [1, 1.6], size: [6, 10], spin: 8 });
        FX.burst({ x: ap.x, y: ap.y, n: 60, colors: LEAVES, shape: "leaf", speed: [150, 600], gravity: 120, drag: 1.2, life: [1.6, 2.6], size: [6, 11], wobble: 50, spin: 6 });
        acorn.querySelector(".sqa-cap").animate([{ transform: "none" }, { transform: "translate(-60px, -80px) rotate(-120deg)", opacity: 0 }], { duration: 700, easing: "ease-out", fill: "forwards" });
        acorn.querySelector(".sqa-nut").animate([{ transform: "none" }, { transform: "translate(50px, 90px) rotate(160deg)", opacity: 0 }], { duration: 700, easing: "ease-in", fill: "forwards" });
        hero.querySelector(".sqh-arms").animate([{ transform: "none" }, { transform: "translateY(-6px)" }, { transform: "none" }], { duration: 300, iterations: 3 });
        await c.wait(500);
        if (c.skipped) return;

        // 4. a leaf tornado spins around the board, then flings the leaves away
        Sound.play("tornado");
        const R0 = Math.hypot(b.width, b.height) / 2;
        const swirl = Array.from({ length: U.motion() === "lite" ? 80 : 170 }, (_, i) => ({ a: Math.random() * TAU, h: Math.random(), r: R0 * (0.5 + Math.random() * 0.35), s: 8 + Math.random() * 8, rot: Math.random() * TAU, flip: Math.random() * TAU, c: LEAVES[i % LEAVES.length], pointy: Math.random() < 0.5 }));
        let tt = 0, alive = true;
        FX.add({
            update(dt) { tt += dt; return alive && tt < 2.4; },
            draw(g) {
                const k = tt / 2.4, out = Math.max(0, (k - 0.7) / 0.3);
                for (const l of swirl) {
                    const a = l.a + tt * (3.2 + l.h * 2), rr = l.r * (1 + k * 0.5) + out * out * 900;
                    const x = cx + Math.cos(a) * rr, y = cy + (l.h - 0.5) * b.height * 1.1 - k * 60 + Math.sin(a) * rr * 0.28;
                    g.save();
                    g.translate(x, y);
                    g.rotate(l.rot + tt * 6);
                    g.scale(1, Math.abs(Math.cos(l.flip + tt * 5)) * 0.85 + 0.15);
                    g.fillStyle = l.c;
                    g.globalAlpha = 1 - out;
                    leafPath(g, l.s, l.pointy);
                    g.fill();
                    g.restore();
                }
                g.globalAlpha = 1;
            }
        });
        c.cleanup(() => { alive = false; });
        // the squirrel does a backflip on top of the board, then dashes away
        hero.animate([{ transform: "none" }, { transform: "translateY(-90px) rotate(-180deg)", offset: 0.5 }, { transform: "rotate(-360deg)" }], { duration: 750, delay: 600, easing: "ease-in-out" });
        c.later(() => Sound.play("chitter"), 700);
        await c.wait(1900);
        if (c.skipped) return;
        hero.animate([{ transform: "none" }, { transform: `translateX(${cx < W / 2 ? W : -W}px)` }], { duration: 650, easing: "cubic-bezier(.5,0,.8,.5)", fill: "forwards" });
        await c.wait(600);
    }

    // ---------------------------------------------------------------------------------------------
    // Title card: a slice of tree trunk rolls in like a wheel, and a squirrel peeks over the top
    // ---------------------------------------------------------------------------------------------
    async function titleCard(c, info) {
        const leaves = Array.from({ length: 16 }, (_, i) =>
            `<i class="tcq-leaf" style="left:${U.rand(0, 100).toFixed(1)}%;--d:${U.rand(0, 1.8).toFixed(2)}s;--s:${U.rand(10, 18).toFixed(0)}px;--x:${U.rand(-60, 60).toFixed(0)}px;--t:${U.rand(2.6, 4.2).toFixed(2)}s;--c:${LEAVES[i % LEAVES.length]}"></i>`).join("");
        const card = U.el("div", { class: "tc tc-squirrel", "aria-hidden": "true", html: `
            <div class="tcq-leaves">${leaves}</div>
            <div class="tcq-wrap">
                <div class="tcq-peek">${SQUIRREL_SVG}</div>
                <div class="tcq-slice">
                    <small>&#127792; ${U.esc(info.kicker)} &#127792;</small>
                    <h2>${U.esc(info.title)}</h2>
                    <p>${U.esc(info.sub)}</p>
                </div>
            </div>` });
        document.getElementById("overlay").appendChild(card);
        c.cleanup(() => card.remove());
        Sound.play("title");
        await c.wait(900);
        if (c.skipped) return;
        Sound.play("chitter");
        await c.wait(1100);
        if (c.skipped) return;
        card.classList.add("out");
        Sound.play("roll");
        await c.wait(500);
    }

    // ---------------------------------------------------------------------------------------------
    // The mascot: Hazel, a red squirrel with a very fluffy tail
    // ---------------------------------------------------------------------------------------------
    function drawHazel(g, s) {
        const happy = s.mood === "happy", wow = s.mood === "wow", sad = s.mood === "sad";
        const bob = Math.sin(s.t * 2.4) * 2 - s.hop * 12;
        g.save();
        g.translate(78, 100 + bob);
        // the tail, swishing (faster when happy)
        const sway = Math.sin(s.t * (happy ? 7 : 1.8)) * (happy ? 0.16 : 0.07);
        g.save();
        g.translate(18, 28);
        g.rotate(sway);
        const tg = g.createLinearGradient(0, -90, 30, 10);
        tg.addColorStop(0, "#f0a865");
        tg.addColorStop(0.6, "#cf6f2c");
        tg.addColorStop(1, "#a9541e");
        g.fillStyle = tg;
        g.strokeStyle = "#6e3412";
        g.lineWidth = 2.5;
        g.beginPath();
        g.moveTo(-4, 0);
        g.bezierCurveTo(34, -6, 50, -48, 36, -78);
        g.bezierCurveTo(26, -100, -4, -96, 0, -76);
        g.bezierCurveTo(16, -76, 24, -54, 12, -36);
        g.bezierCurveTo(6, -24, -6, -16, -4, 0);
        g.fill();
        g.stroke();
        g.strokeStyle = "rgba(255,230,190,.55)";
        g.lineWidth = 2;
        for (const [a, b2, c2, d2] of [[8, -10, 30, -40], [14, -30, 34, -62], [4, -72, 22, -88]]) { g.beginPath(); g.moveTo(a, b2); g.quadraticCurveTo((a + c2) / 2 + 8, (b2 + d2) / 2, c2, d2); g.stroke(); }
        g.restore();
        g.lineWidth = 2.5;
        g.strokeStyle = "#6e3412";
        // body and belly
        g.fillStyle = "#c86f30";
        g.beginPath(); g.ellipse(0, 22, 25, 30, 0, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = "#f6dfbd";
        g.beginPath(); g.ellipse(0, 26, 15, 21, 0, 0, TAU); g.fill();
        // feet
        g.fillStyle = "#a9541e";
        for (const side of [-1, 1]) { g.beginPath(); g.ellipse(side * 13, 50, 11, 5.5, 0, 0, TAU); g.fill(); g.stroke(); }
        // paws holding an acorn (held up to nibble when happy, dropped when sad)
        const nib = happy ? Math.sin(s.t * 12) * 1.5 - 8 : sad ? 10 : 0;
        g.fillStyle = "#b07a3a";
        g.beginPath(); g.ellipse(0, 18 + nib, 7.5, 9, 0, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = "#6b4220";
        g.beginPath(); g.ellipse(0, 11 + nib, 9, 5, 0, Math.PI, TAU); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = "#a9541e";
        for (const side of [-1, 1]) { g.beginPath(); g.ellipse(side * 8, 16 + nib, 5, 4, 0, 0, TAU); g.fill(); g.stroke(); }
        // head
        g.fillStyle = "#cf7533";
        g.beginPath(); g.ellipse(0, -18, 25, 22, 0, 0, TAU); g.fill(); g.stroke();
        // ears with tufts
        for (const side of [-1, 1]) {
            g.fillStyle = "#cf7533";
            g.beginPath(); g.moveTo(side * 9, -36); g.lineTo(side * 17, -58); g.lineTo(side * 22, -32); g.closePath(); g.fill(); g.stroke();
            g.fillStyle = "#f2a7a0";
            g.beginPath(); g.moveTo(side * 12, -37); g.lineTo(side * 17, -51); g.lineTo(side * 19, -36); g.closePath(); g.fill();
            g.strokeStyle = "#8a4318";
            g.beginPath(); g.moveTo(side * 17, -57); g.lineTo(side * 15, -64); g.moveTo(side * 17, -57); g.lineTo(side * 20, -63); g.stroke();
            g.strokeStyle = "#6e3412";
        }
        // cheeks
        g.fillStyle = "#f6dfbd";
        for (const side of [-1, 1]) { g.beginPath(); g.ellipse(side * 11, -8, 10, 8, 0, 0, TAU); g.fill(); }
        // eyes
        const ex = s.look * 3;
        for (const side of [-1, 1]) {
            const x = side * 10 + ex, y = -21;
            g.fillStyle = "#1e120a";
            if (s.blink > 0.5) { g.fillRect(x - 5, y, 10, 2.2); continue; }
            if (happy) { g.lineWidth = 2.8; g.strokeStyle = "#1e120a"; g.beginPath(); g.arc(x, y + 3, 4.6, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); g.strokeStyle = "#6e3412"; g.lineWidth = 2.5; continue; }
            g.beginPath(); g.ellipse(x, y, wow ? 5.6 : 4.6, wow ? 6.8 : 5.8, 0, 0, TAU); g.fill();
            g.fillStyle = "#ffffff";
            g.beginPath(); g.arc(x + 1.6, y - 2, 1.7, 0, TAU); g.fill();
            if (sad) { g.strokeStyle = "#5a2a0e"; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 5, y - 9 - side * 2); g.lineTo(x + 5, y - 9 + side * 2); g.stroke(); g.strokeStyle = "#6e3412"; g.lineWidth = 2.5; }
        }
        // nose, mouth and buck teeth (they show when talking)
        g.fillStyle = "#3a1f10";
        g.beginPath(); g.ellipse(0, -10, 3.6, 2.6, 0, 0, TAU); g.fill();
        const open = Math.max(s.talk, wow ? 0.6 : 0);
        g.strokeStyle = "#3a1f10";
        g.lineWidth = 2;
        g.beginPath(); g.moveTo(-5, -5); g.quadraticCurveTo(0, sad ? -6 : -1, 5, -5); g.stroke();
        if (open > 0.1) {
            g.fillStyle = "#5a1f12";
            g.beginPath(); g.ellipse(0, -3 + open * 2, 3.6, open * 3.5, 0, 0, TAU); g.fill();
        }
        g.fillStyle = "#ffffff";
        g.strokeStyle = "#8a6a50";
        g.lineWidth = 1;
        g.beginPath(); g.roundRect(-2.6, -5, 5.2, 4.6, 1); g.fill(); g.stroke();
        g.restore();
    }

    // ---------------------------------------------------------------------------------------------
    // Sounds: wood blocks, rustling leaves and squirrel chatter
    // ---------------------------------------------------------------------------------------------
    const PENTA = [72, 74, 76, 79, 81, 84];
    const wood = (t, n, v = 0.12) => { const f = midi(n); tone({ t, f: f * 1.04, f2: f, type: "sine", d: 0.08, v }); noise({ t, type: "bandpass", f: 2600, q: 2, d: 0.015, v: v * 0.4 }); };
    const chatter = (t0, n, v = 0.04) => { for (let i = 0; i < n; i++) { const f = U.rand(2100, 3300); tone({ t: t0 + i * 0.055, f, f2: f * 1.35, type: "sine", d: 0.045, v }); } };
    const rustle = (t, d, v) => { noise({ t, type: "highpass", f: 2800, d, v, a: d * 0.3 }); noise({ t: t + d * 0.2, type: "bandpass", f: 1200, f2: 3600, q: 0.6, d: d * 0.8, v: v * 0.7 }); };
    const sounds = {
        type: () => wood(0, U.pick(PENTA), 0.11),
        erase: () => noise({ type: "lowpass", f: 1800, f2: 500, d: 0.12, v: 0.08 }),
        move: () => {},
        word: () => { [0, 2, 4, 5].forEach((k, i) => wood(i * 0.06, PENTA[k] + 12, 0.08)); chatter(0.25, 4, 0.03); },
        wrong: () => { tone({ f: 230, f2: 140, type: "sine", d: 0.22, v: 0.2 }); tone({ f: 330, f2: 210, type: "triangle", d: 0.18, v: 0.05 }); },
        right: () => PENTA.forEach((n, i) => wood(i * 0.05, n + 12, 0.07)),
        reveal: () => { rustle(0, 0.4, 0.06); tone({ f: midi(88), type: "sine", d: 0.5, v: 0.04, echo: 0.3 }); },
        flip: () => wood(0, U.pick(PENTA) + 12, 0.06),
        rustle: () => rustle(0, 1, 0.14),
        tornado: () => { rustle(0, 2.2, 0.12); noise({ type: "bandpass", f: 300, f2: 1400, q: 0.7, d: 2, v: 0.08, a: 0.5 }); },
        crack: () => { noise({ type: "highpass", f: 1500, d: 0.08, v: 0.35 }); tone({ f: 900, f2: 200, type: "triangle", d: 0.12, v: 0.12 }); [84, 88, 91, 96].forEach((n, i) => tone({ t: 0.1 + i * 0.07, f: midi(n), type: "sine", d: 0.7, v: 0.05, echo: 0.4 })); },
        chitter: () => chatter(0, 7, 0.045),
        roll: () => { for (let i = 0; i < 6; i++) wood(i * 0.07, 60 + (i % 2) * 3, 0.06); },
        win: () => {},
        streak: () => { [0, 1, 2, 3, 4, 5].forEach(i => wood(i * 0.05, PENTA[i] + 12, 0.07)); chatter(0.35, 3, 0.03); },
        achievement: () => { [0, 2, 4, 5, 5].forEach((k, i) => wood(i * 0.07, PENTA[k] + 12, 0.08)); tone({ t: 0.4, f: midi(96), type: "sine", d: 0.8, v: 0.05, echo: 0.4 }); },
        title: () => { rustle(0, 0.6, 0.08); [0, 2, 4, 3, 5].forEach((k, i) => wood(0.3 + i * 0.11, PENTA[k], 0.1)); },
        tile: i => wood(0, PENTA[i % PENTA.length], 0.09),
        start: () => { rustle(0, 0.8, 0.1); [0, 1, 2, 3, 4, 5].forEach(i => wood(0.3 + i * 0.07, PENTA[i], 0.1)); chatter(0.8, 5, 0.035); },
        select: () => wood(0, 88, 0.05),
        nav: () => { rustle(0, 0.25, 0.05); wood(0.05, 84, 0.06); },
        mascot: () => chatter(0, 4, 0.04)
    };

    Worlds.register({
        id: "squirrel", name: "Acorn Woods", icon: "🐿️", tagline: "Autumn leaves, busy squirrels & acorns galore",
        modes: ["light", "dark"],
        scene, board, celebrate, titleCard, sounds, transition: "autumn",
        mascot: { name: "HAZEL", draw: drawHazel },
        lines: {
            hello: ["Hi, I'm Hazel! Ready to stash some words?", "The leaves are falling and the puzzles are fresh!", "Squirrel here! Let's go nuts on some puzzles."],
            start: ["Tap a square and start typing. Space flips Across and Down!", "Every letter is an acorn for my stash!"],
            word: ["Nuts about that one!", "Into the stash!", "Acorn-tastic!", "Leaf it to you!", "Tree-mendous!", "Squeak! Nice!"],
            win: ["You cracked it! What a nut!", "The stash is full! Great solve!", "Tree-mendous finish!"],
            wrong: ["Hmm, a few of those are a bit nutty.", "Some letters fell off the branch."],
            right: ["All acorns accounted for!", "Every letter's a keeper!"],
            idle: ["Stuck? Try a crossing word. Squirrels always have a backup stash!", "Take a nibble at the shortest clue."],
            reveal: ["Digging up a hint...", "Here, I buried this one for you."]
        },
        introFlourish(stage) {
            const p = U.center(stage);
            FX.ring({ x: p.x, y: p.y, color: "#f2a03d", r1: Math.max(innerWidth, innerHeight) * 0.6, dur: 1.2, width: 16, glow: false });
            FX.burst({ x: p.x, y: p.y, n: 70, colors: LEAVES, shape: "leaf", speed: [200, 650], gravity: 140, drag: 1.2, life: [1.6, 2.6], size: [6, 11], wobble: 50, spin: 6 });
            FX.burst({ x: p.x, y: p.y, n: 18, colors: ["#c99a4a", "#b07a3a"], shape: "acorn", speed: [200, 500], gravity: 600, life: [1, 1.6], size: [6, 9], spin: 8 });
        }
    });
})();
