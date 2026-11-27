// Snow Day's background (snow.js uses it): a quiet winter valley.
//   Day: a crisp sky with a low pale sun, a halo round it with two sun dogs, thin ice clouds; an alpine range
//   shaded facet by facet with rock gullies and snowfields, a nearer ridge, forests climbing the lower slopes;
//   a frozen lake with cracks and a skater gliding about; a village across the ice (cabins, a chapel with a
//   steeple, smoke from the chimneys); wind-carved drifts with blue shadows in front, snow-laden pines and
//   birches, a fence half buried, a sled, a winterberry bush with a cardinal on it; snow falling in three depths
//   with gusts, glints on the snow, a fox trotting through leaving prints, a cardinal flying past. Night: stars,
//   the Milky Way, the northern lights rippling, a moon with a ring, windows glowing, a shooting star.
//   SnowScene(W, H, opts)
function SnowScene(W, H, opts) {
    const night = opts.theme === "dark", preview = !!opts.preview, TAU = Math.PI * 2, M = 50;
    const P = night
        ? { sky: ["#040a1e", "#0c1a3a", "#1a2c54", "#2a3c64"], snow: ["#c8d4ec", "#8a9cc8", "#5a6c9c"], shade: "40,60,120", rock: "#2a3048", pine: ["#0c1c24", "#14262e"], haze: "60,80,130", lake: ["#1a2c50", "#2a3c64"], wood: ["#3a271d", "#24170f"] }
        : { sky: ["#3a86d8", "#7ab4ea", "#bcdcf4", "#e8f2fa"], snow: ["#ffffff", "#dce8f6", "#b4c8e4"], shade: "90,130,200", rock: "#5a6278", pine: ["#1e4a3a", "#2a5e48"], haze: "200,220,240", lake: ["#9ec4e4", "#c8e0f2"], wood: ["#7d4b2b", "#59331c"] };
    let HZ, GY, skyImg, farImg, midImg, frontImg, cabins = [], flakes = [], glints = [], stars = [], aur = [], flakeSpr, prints = [], smoke = [];
    let fox = null, nextFox = preview ? 1e9 : U.rand(6, 14), bird = null, nextBird = preview ? 1e9 : U.rand(8, 16), meteor = null, nextMeteor = 5, skater = null;
    let gust = 0, gustLeft = 0, nextGust = 12;
    function paint(w, h, fn) { const c = Worlds.canvas(w, h), g = c.getContext("2d"); fn(g); return c; }
    const mix = (a, b, t) => { const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16)); return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
    const k = () => (preview ? 0.5 : U.clamp(Math.min(W, H) / 900, 0.6, 1.15));

    // a jagged ridge by midpoint displacement: heights at n+1 points
    function ridgeLine(n, rough, R, peaks) {
        const pts = new Array(n + 1).fill(0);
        let step = n, amp = 1;
        pts[0] = R() * 0.3; pts[n] = R() * 0.3;
        while (step > 1) { for (let i = step / 2; i < n; i += step) pts[i] = (pts[i - step / 2] + pts[i + step / 2]) / 2 + (R() - 0.5) * amp; step /= 2; amp *= rough; }
        for (const [c, h, w] of peaks) for (let i = 0; i <= n; i++) pts[i] += h * Math.exp(-(((i / n) - c) ** 2) / (w * w));
        return pts;
    }
    // a mountain range: jagged peaks, a snowcap down to a broken snowline, rock below; each peak split along its
    // spine into a lit face and a shaded one (the sun is on the right by day, the moon by night)
    function range(g, LW, base, height, R, cols, peaks, rockA) {
        const n = 256, pts = ridgeLine(n, 0.62, R, peaks), xs = i => (i / n) * LW, ys = i => base - Math.max(0, pts[i]) * height;
        const outline = () => { g.beginPath(); g.moveTo(0, base + 4); for (let i = 0; i <= n; i++) g.lineTo(xs(i), ys(i)); g.lineTo(LW, base + 4); g.closePath(); };
        outline(); g.fillStyle = cols[3]; g.fill();
        g.save(); outline(); g.clip();
        const snowLevel = base - height * 0.42;                             // the snowcap, its lower edge in zigzags
        g.fillStyle = cols[0];
        g.beginPath(); g.moveTo(xs(0), ys(0)); for (let i = 0; i <= n; i++) g.lineTo(xs(i), ys(i));
        for (let i = n; i >= 0; i -= 2) { const y = Math.max(ys(i) + 6, snowLevel + Math.sin(i * 1.7) * height * 0.05 + (R() - 0.5) * height * 0.08 - (i % 6 === 0 ? height * 0.1 * R() : 0)); g.lineTo(xs(i), y); }
        g.closePath(); g.fill();
        const sm = i => { let a = 0; for (let k2 = -4; k2 <= 4; k2++) a += pts[Math.min(n, Math.max(0, i + k2))]; return a / 9; };
        const peaksAt = [], valleys = [0];
        for (let i = 6; i < n - 6; i++) { const v = sm(i); if (v > sm(i - 6) && v > sm(i + 6) && v >= sm(i - 1) && v >= sm(i + 1)) peaksAt.push(i); if (v < sm(i - 6) && v < sm(i + 6) && v <= sm(i - 1) && v <= sm(i + 1)) valleys.push(i); }
        valleys.push(n);
        for (const pk of peaksAt) {                                         // the shaded face beside each peak's spine
            const prev = Math.max(...valleys.filter(v => v < pk)), next = Math.min(...valleys.filter(v => v > pk));
            const spine = []; let x = xs(pk), y = ys(pk);
            while (y < base) { spine.push([x, y]); y += height * 0.06; x += (night ? -1 : 1) * height * 0.012 + (R() - 0.5) * height * 0.03; }
            spine.push([x, base + 4]);
            g.fillStyle = `rgba(${P.shade},${night ? 0.35 : 0.22})`;
            g.beginPath();
            if (night) { for (let i = pk; i <= next; i++) g.lineTo(xs(i), ys(i)); g.lineTo(xs(next), base + 4); for (let q = spine.length - 1; q >= 0; q--) g.lineTo(spine[q][0], spine[q][1]); }
            else { for (let i = prev; i <= pk; i++) g.lineTo(xs(i), ys(i)); for (const [sx, sy] of spine) g.lineTo(sx, sy); g.lineTo(xs(prev), base + 4); }
            g.closePath(); g.fill();
            g.strokeStyle = `rgba(${P.shade},${rockA * 0.35})`; g.lineWidth = 1;          // crevices fanning off the spine
            for (let c = 0; c < 6; c++) { const [sx, sy] = spine[Math.min(spine.length - 1, 1 + Math.floor(R() * Math.min(5, spine.length - 1)))], l = height * (0.05 + R() * 0.1), a = Math.PI / 2 + (R() - 0.5) * 1.6; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + Math.cos(a) * l * 0.5 + (R() - 0.5) * 4, sy + Math.sin(a) * l * 0.5); g.lineTo(sx + Math.cos(a) * l, sy + Math.sin(a) * l); g.stroke(); }
        }
        const lg = g.createLinearGradient(0, base - height, 0, base);       // brighter up high, the air thickening lower down
        lg.addColorStop(0, "rgba(255,255,255,0)"); lg.addColorStop(1, `rgba(${P.haze},${night ? 0.15 : 0.3})`);
        g.fillStyle = lg; g.fillRect(0, base - height * 1.6, LW, height * 1.6 + 4);
        g.restore();
        return pts;
    }
    function pine(g, x, base, h, body, snow, trunk) {                         // a snowy pine: layered tiers with snow on each
        if (trunk) { g.fillStyle = trunk; g.fillRect(x - h * 0.03, base - h * 0.1, h * 0.06, h * 0.12); }
        const tiers = 6;
        for (let i = 0; i < tiers; i++) {
            const ya = base - h + i * h * (0.9 / tiers), dy = h * 0.26, yb = ya + dy, hw = h * (0.08 + (i / tiers) * 0.32);
            g.fillStyle = i % 2 ? body[0] : body[1];
            g.beginPath(); g.moveTo(x, ya); g.quadraticCurveTo(x + hw * 0.4, ya + dy * 0.55, x + hw, yb); g.lineTo(x + hw * 0.6, yb - dy * 0.06); g.lineTo(x + hw * 0.3, yb + dy * 0.02); g.lineTo(x, yb - dy * 0.08); g.lineTo(x - hw * 0.3, yb + dy * 0.02); g.lineTo(x - hw * 0.6, yb - dy * 0.06); g.lineTo(x - hw, yb); g.quadraticCurveTo(x - hw * 0.4, ya + dy * 0.55, x, ya); g.fill();
            if (!snow) continue;
            g.fillStyle = snow;
            g.beginPath(); g.moveTo(x, ya - dy * 0.04); g.quadraticCurveTo(x + hw * 0.35, ya + dy * 0.35, x + hw * 0.75, ya + dy * 0.7); g.quadraticCurveTo(x + hw * 0.4, ya + dy * 0.56, x + hw * 0.1, ya + dy * 0.66); g.quadraticCurveTo(x - hw * 0.2, ya + dy * 0.5, x - hw * 0.5, ya + dy * 0.62); g.quadraticCurveTo(x - hw * 0.7, ya + dy * 0.58, x - hw * 0.75, ya + dy * 0.7); g.quadraticCurveTo(x - hw * 0.35, ya + dy * 0.35, x, ya - dy * 0.04); g.fill();
            for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(x + sd * hw * 0.88, yb - dy * 0.06, hw * 0.18, dy * 0.08, sd * 0.3, 0, TAU); g.fill(); }
        }
    }
    function birch(g, x, base, h, s) {
        g.fillStyle = night ? "#a8b0c8" : "#f4f2ec"; g.fillRect(x - 4 * s, base - h, 8 * s, h);
        g.fillStyle = night ? "#2a2a3a" : "#2a2a2a";
        for (let y = base - h + 10; y < base; y += 12 + Math.sin(y) * 6) { g.fillRect(x - 4 * s, y, 4 + Math.abs(Math.sin(y * 3)) * 5 * s, 2); }
        g.strokeStyle = night ? "#6a6a7a" : "#5a4a3a"; g.lineWidth = 1.4;
        for (let i = 0; i < 9; i++) { const y = base - h + i * h * 0.08, sd = i % 2 ? 1 : -1; g.beginPath(); g.moveTo(x, y + 10); g.quadraticCurveTo(x + sd * 20 * s, y, x + sd * 34 * s, y - 6 * s); g.stroke(); g.fillStyle = P.snow[0]; g.beginPath(); g.ellipse(x + sd * 22 * s, y - 2, 6 * s, 2, sd * -0.3, 0, TAU); g.fill(); }
    }

    function setup() {
        const R = U.rng(2121), s = k(), LW = W + M * 2;
        HZ = H * 0.56; GY = H * 0.7;
        skyImg = paint(W, H, g => {
            const sg = g.createLinearGradient(0, 0, 0, HZ);
            P.sky.forEach((c, i) => sg.addColorStop(i / (P.sky.length - 1), c));
            g.fillStyle = sg; g.fillRect(0, 0, W, H);
            if (night) {
                g.save(); g.translate(W * 0.5, HZ * 0.4); g.rotate(-0.5);                    // the Milky Way, a faint band of dust and stars
                const mw = g.createLinearGradient(0, -H * 0.08, 0, H * 0.08); mw.addColorStop(0, "rgba(180,190,255,0)"); mw.addColorStop(0.5, "rgba(180,190,255,.09)"); mw.addColorStop(1, "rgba(180,190,255,0)");
                g.fillStyle = mw; g.fillRect(-W, -H * 0.08, W * 2, H * 0.16);
                for (let i = 0; i < (preview ? 100 : 600); i++) { g.fillStyle = `rgba(230,235,255,${(0.2 + R() * 0.5).toFixed(2)})`; g.fillRect((R() - 0.5) * W * 2, (R() + R() + R() - 1.5) * H * 0.05, 1, 1); }
                g.restore();
                for (let i = 0; i < (preview ? 60 : 300); i++) { const y = Math.pow(R(), 1.2) * HZ; g.fillStyle = `rgba(255,255,255,${(0.25 + R() * 0.6 * (1 - y / HZ)).toFixed(2)})`; g.fillRect(R() * W, y, R() < 0.1 ? 1.6 : 1, R() < 0.1 ? 1.6 : 1); }
                const mx = W * 0.8, my = H * 0.14, mr = Math.min(W, H) * 0.04;                 // the moon with a ring
                Worlds.glow(g, mx, my, mr * 6, "#c8d8ff", 0.45);
                g.strokeStyle = "rgba(200,215,255,.08)"; g.lineWidth = mr * 0.25; g.beginPath(); g.arc(mx, my, mr * 4.5, 0, TAU); g.stroke();
                const mg = g.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, 0, mx, my, mr); mg.addColorStop(0, "#fffef4"); mg.addColorStop(1, "#d8d8cc");
                g.fillStyle = mg; g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill();
                g.fillStyle = "rgba(150,150,140,.35)"; for (const [cx, cy, cr] of [[-0.3, -0.2, 0.22], [0.25, 0.1, 0.16], [-0.05, 0.4, 0.12], [0.35, -0.35, 0.09]]) { g.beginPath(); g.arc(mx + cx * mr, my + cy * mr, cr * mr, 0, TAU); g.fill(); }
            } else {
                const sx = W * 0.78, sy = H * 0.17, sr = Math.min(W, H) * 0.035;             // a low winter sun, its halo and two sun dogs
                for (const [rr, a] of [[sr * 12, 0.25], [sr * 4, 0.45]]) { const gg = g.createRadialGradient(sx, sy, 0, sx, sy, rr); gg.addColorStop(0, `rgba(255,252,236,${a})`); gg.addColorStop(1, "rgba(255,252,236,0)"); g.fillStyle = gg; g.fillRect(sx - rr, sy - rr, rr * 2, rr * 2); }
                const hr = sr * 5.5;
                for (const [off, c] of [[-2, "255,160,120"], [0, "255,255,255"], [2, "150,200,255"]]) { g.strokeStyle = `rgba(${c},.08)`; g.lineWidth = sr * 0.35; g.beginPath(); g.arc(sx, sy, hr + off * 2, 0, TAU); g.stroke(); }
                for (const sd of [-1, 1]) { Worlds.glow(g, sx + sd * hr, sy, sr * 1.8, "#fff4e0", 0.7); g.fillStyle = "rgba(255,210,170,.5)"; g.beginPath(); g.ellipse(sx + sd * hr - sd * sr * 0.2, sy, sr * 0.35, sr * 0.8, 0, 0, TAU); g.fill(); }
                g.fillStyle = "#fffdf0"; g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.fill();
                g.strokeStyle = "rgba(255,255,255,.22)"; g.lineCap = "round";                    // thin ice clouds
                for (let i = 0; i < 12; i++) { const x = R() * W, y = H * (0.05 + R() * 0.22), l = 100 + R() * 240; g.lineWidth = 2 + R() * 6; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l * 0.5, y - 6 - R() * 8, x + l, y + R() * 5); g.stroke(); }
            }
        });
        // far: the alpine range, hazy, with a nearer ridge in front
        farImg = paint(LW, H, g => {
            const far = P.snow.map(c => mix(c, night ? "#2a3c64" : "#c8dcf0", 0.35));
            range(g, LW, HZ, H * 0.3, R, [far[0], far[1], far[2], mix(P.rock, night ? "#2a3c64" : "#c8dcf0", 0.45)], [[0.2, 0.55, 0.07], [0.48, 0.8, 0.05], [0.76, 0.65, 0.06]], 0.5);
            const hz = g.createLinearGradient(0, HZ - H * 0.2, 0, HZ); hz.addColorStop(0, `rgba(${P.haze},0)`); hz.addColorStop(1, `rgba(${P.haze},${night ? 0.35 : 0.6})`);
            g.fillStyle = hz; g.fillRect(0, HZ - H * 0.2, LW, H * 0.2);
            const ridge = range(g, LW, HZ + H * 0.04, H * 0.12, R, [P.snow[0], P.snow[1], P.snow[2], mix(P.rock, P.snow[1], 0.3)], [[0.1, 0.4, 0.1], [0.88, 0.5, 0.1]], 0.9);
            // forests climbing the lower slopes of the near ridge
            for (let i = 0; i < (preview ? 300 : 1400); i++) {
                const x = R() * LW, top = HZ + H * 0.04 - Math.max(0, ridge[Math.round((x / LW) * 256)]) * H * 0.12, y = top + (HZ + H * 0.06 - top) * (0.35 + R() * 0.65), h = (5 + R() * 6) * s * (0.6 + (y - HZ) / (H * 0.1));
                g.fillStyle = P.pine[R() < 0.5 ? 0 : 1]; g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + h * 0.3, y); g.lineTo(x - h * 0.3, y); g.fill();
                g.fillStyle = P.snow[1]; g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + h * 0.12, y - h * 0.6); g.lineTo(x - h * 0.12, y - h * 0.6); g.fill();
            }
            const mh = g.createLinearGradient(0, HZ, 0, HZ + H * 0.08); mh.addColorStop(0, `rgba(${P.haze},0)`); mh.addColorStop(0.6, `rgba(${P.haze},${night ? 0.2 : 0.45})`); mh.addColorStop(1, `rgba(${P.haze},0)`);
            g.fillStyle = mh; g.fillRect(0, HZ, LW, H * 0.08);
        });
        // mid: the valley floor, the frozen lake, the village across it
        midImg = paint(LW, H, g => {
            const vg = g.createLinearGradient(0, HZ + H * 0.04, 0, H);
            vg.addColorStop(0, P.snow[1]); vg.addColorStop(0.3, P.snow[0]); vg.addColorStop(1, P.snow[1]);
            g.fillStyle = vg; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= LW; x += 10) g.lineTo(x, HZ + H * 0.055 + Math.sin(x * 0.004) * H * 0.008); g.lineTo(LW, H); g.fill();
            const lx = M + W * 0.42, ly = HZ + H * 0.1, lw = W * 0.3, lh = H * 0.045;      // the lake: ice mirroring the sky, cracks, snow dusting it
            const lg = g.createLinearGradient(0, ly - lh, 0, ly + lh); lg.addColorStop(0, P.lake[0]); lg.addColorStop(1, P.lake[1]);
            g.fillStyle = lg; g.beginPath(); g.ellipse(lx, ly, lw, lh, 0, 0, TAU); g.fill();
            g.save(); g.beginPath(); g.ellipse(lx, ly, lw, lh, 0, 0, TAU); g.clip();
            g.strokeStyle = night ? "rgba(200,220,255,.2)" : "rgba(255,255,255,.6)"; g.lineWidth = 0.8;
            for (let i = 0; i < 16; i++) { let x = lx + (R() - 0.5) * lw * 1.8, y = ly + (R() - 0.5) * lh * 1.6; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 5; j++) { x += (R() - 0.5) * 40; y += (R() - 0.5) * 6; g.lineTo(x, y); } g.stroke(); }
            g.fillStyle = night ? "rgba(200,215,245,.15)" : "rgba(255,255,255,.55)";
            for (let i = 0; i < 20; i++) { g.beginPath(); g.ellipse(lx + (R() - 0.5) * lw * 1.8, ly + (R() - 0.5) * lh * 1.5, 10 + R() * 30, 2 + R() * 3, 0, 0, TAU); g.fill(); }
            g.fillStyle = "rgba(255,255,255,.25)"; g.beginPath(); g.ellipse(lx - lw * 0.3, ly - lh * 0.3, lw * 0.3, lh * 0.15, 0, 0, TAU); g.fill();
            g.restore();
            g.strokeStyle = P.snow[0]; g.lineWidth = 3; g.beginPath(); g.ellipse(lx, ly, lw, lh, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
            skater = { x: lx - M, y: ly, rx: lw * 0.6, ry: lh * 0.5, ph: 0 };
            // the village on the far shore: cabins, a chapel, a few pines
            cabins = [];
            const cab = (x, base, sc, chapel) => {
                const w = 40 * sc, h = 22 * sc;
                g.fillStyle = "rgba(0,0,0,.1)"; g.beginPath(); g.ellipse(x, base + 2, w * 0.8, 4 * sc, 0, 0, TAU); g.fill();
                const wg = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0); wg.addColorStop(0, chapel ? (night ? "#8a90a8" : "#f4ece0") : P.wood[0]); wg.addColorStop(1, chapel ? (night ? "#5a6078" : "#c8bca8") : P.wood[1]);
                g.fillStyle = wg; g.fillRect(x - w / 2, base - h, w, h);
                if (!chapel) { g.strokeStyle = "rgba(0,0,0,.25)"; g.lineWidth = 0.8; for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(x - w / 2, base - h + i * h / 5); g.lineTo(x + w / 2, base - h + i * h / 5); g.stroke(); } }
                g.fillStyle = chapel ? (night ? "#3a2a3a" : "#7a3a3a") : (night ? "#2b1d16" : "#4f2f1c");
                g.beginPath(); g.moveTo(x - w * 0.62, base - h); g.lineTo(x, base - h - w * 0.45); g.lineTo(x + w * 0.62, base - h); g.fill();
                g.fillStyle = P.snow[0]; g.beginPath(); g.moveTo(x - w * 0.66, base - h + 1); g.lineTo(x, base - h - w * 0.5); g.lineTo(x + w * 0.66, base - h + 1); g.quadraticCurveTo(x + w * 0.3, base - h - w * 0.1, x, base - h - w * 0.32); g.quadraticCurveTo(x - w * 0.3, base - h - w * 0.1, x - w * 0.66, base - h + 1); g.fill();
                if (chapel) {
                    const tx = x + w * 0.25, th = w * 0.9;
                    g.fillStyle = wg; g.fillRect(tx - w * 0.12, base - h - th, w * 0.24, th);
                    g.fillStyle = night ? "#3a2a3a" : "#7a3a3a"; g.beginPath(); g.moveTo(tx - w * 0.16, base - h - th); g.lineTo(tx, base - h - th - w * 0.55); g.lineTo(tx + w * 0.16, base - h - th); g.fill();
                    g.fillStyle = P.snow[0]; g.beginPath(); g.moveTo(tx - w * 0.17, base - h - th + 1); g.lineTo(tx, base - h - th - w * 0.57); g.lineTo(tx - w * 0.02, base - h - th - w * 0.2); g.fill();
                    g.strokeStyle = night ? "#a89060" : "#c8a040"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(tx, base - h - th - w * 0.55); g.lineTo(tx, base - h - th - w * 0.8); g.moveTo(tx - 3, base - h - th - w * 0.7); g.lineTo(tx + 3, base - h - th - w * 0.7); g.stroke();
                    g.fillStyle = night ? "#2a1a10" : "#4a3a2a"; g.beginPath(); g.arc(tx, base - h - th * 0.6, w * 0.06, Math.PI, TAU); g.fillRect(tx - w * 0.06, base - h - th * 0.6, w * 0.12, w * 0.08); g.fill();
                    cabins.push({ x: x - M - w * 0.15, y: base - h * 0.55, w: w * 0.14, h: h * 0.4, chim: null, sc, arch: true });
                } else {
                    const chx = x + w * 0.2, cht = base - h - w * 0.3;
                    g.fillStyle = night ? "#4a3a3a" : "#8a5a4a"; g.fillRect(chx, cht, w * 0.1, w * 0.25); g.fillStyle = P.snow[0]; g.fillRect(chx - 1, cht - 2, w * 0.1 + 2, 3);
                    cabins.push({ x: x - M - w * 0.22, y: base - h * 0.62, w: w * 0.18, h: h * 0.32, chim: [chx + w * 0.05 - M, cht - 3], sc });
                }
            };
            const vy = HZ + H * 0.07;
            for (const [x, sc, ch] of [[0.62, 0.9, false], [0.7, 1.05, false], [0.78, 1.2, true], [0.86, 0.95, false], [0.93, 1.1, false]]) cab(M + W * x, vy + sc * 6, sc * s * 1.2, ch);
            for (let i = 0; i < (preview ? 6 : 18); i++) { const x = M + W * (0.58 + R() * 0.4), y = vy + R() * H * 0.03; pine(g, x, y, (26 + R() * 20) * s, P.pine, P.snow[0], P.wood[1]); }
            for (let i = 0; i < (preview ? 4 : 10); i++) { const x = M + W * (0.02 + R() * 0.2), y = vy + R() * H * 0.03; pine(g, x, y, (26 + R() * 24) * s, P.pine, P.snow[0], P.wood[1]); }
        });
        // front: wind-carved drifts, big pines and birches, the fence, the sled, the winterberry bush
        frontImg = paint(LW, H, g => {
            const dy = x => GY + H * 0.08 + Math.sin(x * 0.006) * H * 0.02 + Math.sin(x * 0.017 + 1) * H * 0.008;
            const dg = g.createLinearGradient(0, GY, 0, H); dg.addColorStop(0, P.snow[0]); dg.addColorStop(1, P.snow[1]);
            g.fillStyle = dg; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= LW; x += 8) g.lineTo(x, dy(x)); g.lineTo(LW, H); g.fill();
            for (let i = 0; i < 8; i++) {                                                       // blue shadows in the hollows, sastrugi lines
                const x = R() * LW, y = dy(x) + H * (0.03 + R() * 0.15), rx = (80 + R() * 160) * s, ry = (8 + R() * 10) * s;
                const sg = g.createRadialGradient(x, y, 0, x, y, rx); sg.addColorStop(0, `rgba(${P.shade},.18)`); sg.addColorStop(1, `rgba(${P.shade},0)`);
                g.save(); g.scale(1, ry / rx); g.fillStyle = sg; g.beginPath(); g.arc(x, y * rx / ry, rx, 0, TAU); g.fill(); g.restore();
            }
            g.strokeStyle = `rgba(${P.shade},.18)`; g.lineWidth = 1;
            for (let i = 0; i < (preview ? 40 : 160); i++) { const x = R() * LW, y = dy(x) + R() * (H - dy(x)), l = (20 + R() * 50) * s; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 2, x + l, y + 1); g.stroke(); }
            g.strokeStyle = "rgba(255,255,255,.5)"; g.lineWidth = 2; g.beginPath(); for (let x = 0; x <= LW; x += 8) g[x ? "lineTo" : "moveTo"](x, dy(x) + 1); g.stroke();
            // a fence half buried, its posts capped with snow
            const posts = []; for (let x = M + W * 0.18; x < M + W * 0.42; x += 34 * s) posts.push([x, dy(x) + 10 * s]);
            g.strokeStyle = P.wood[1]; g.lineWidth = 4 * s; g.beginPath(); posts.forEach(([x, y], i) => g[i ? "lineTo" : "moveTo"](x, y - 18 * s)); g.stroke();
            g.strokeStyle = P.snow[0]; g.lineWidth = 2.5 * s; g.beginPath(); posts.forEach(([x, y], i) => g[i ? "lineTo" : "moveTo"](x, y - 20.5 * s)); g.stroke();
            for (const [x, y] of posts) { g.fillStyle = P.wood[0]; g.fillRect(x - 3 * s, y - 30 * s, 6 * s, 30 * s); g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(x + 1 * s, y - 30 * s, 2 * s, 30 * s); g.fillStyle = P.snow[0]; g.beginPath(); g.ellipse(x, y - 30 * s, 6 * s, 3.5 * s, 0, 0, TAU); g.fill(); g.beginPath(); g.ellipse(x, y, 9 * s, 4 * s, 0, Math.PI, TAU); g.fill(); }
            {                                                                                    // a sled with a scarf over it
                const x = M + W * 0.7, y = dy(M + W * 0.7) + 30 * s;
                g.fillStyle = "rgba(0,0,0,.12)"; g.beginPath(); g.ellipse(x + 6, y + 6 * s, 56 * s, 7 * s, 0, 0, TAU); g.fill();
                g.strokeStyle = night ? "#8a8a9a" : "#3a3a44"; g.lineWidth = 3 * s; g.lineCap = "round";
                g.beginPath(); g.moveTo(x - 50 * s, y); g.lineTo(x + 40 * s, y); g.quadraticCurveTo(x + 58 * s, y, x + 54 * s, y - 14 * s); g.stroke();
                for (const dx of [-36, -6, 24]) { g.beginPath(); g.moveTo(x + dx * s, y); g.lineTo(x + dx * s, y - 10 * s); g.stroke(); }
                const wg = g.createLinearGradient(0, y - 18 * s, 0, y - 10 * s); wg.addColorStop(0, night ? "#6a3a2a" : "#c84a3a"); wg.addColorStop(1, night ? "#4a2418" : "#8a2a1a");
                g.fillStyle = wg; g.beginPath(); g.roundRect(x - 48 * s, y - 18 * s, 96 * s, 8 * s, 3 * s); g.fill();
                g.fillStyle = night ? "#3a5a7a" : "#3a8ad8"; g.beginPath(); g.moveTo(x - 10 * s, y - 18 * s); g.quadraticCurveTo(x, y - 24 * s, x + 14 * s, y - 18 * s); g.lineTo(x + 18 * s, y - 4 * s); g.lineTo(x + 10 * s, y - 4 * s); g.lineTo(x + 8 * s, y - 16 * s); g.fill();
                g.fillStyle = P.snow[0]; g.beginPath(); g.ellipse(x - 30 * s, y - 19 * s, 14 * s, 3 * s, 0, 0, TAU); g.fill();
            }
            {                                                                                    // a winterberry bush (the cardinal perches here)
                const x = M + W * 0.86, y = dy(M + W * 0.86) + 20 * s;
                g.strokeStyle = night ? "#3a2a2a" : "#5a3a2a"; g.lineWidth = 1.6;
                for (let i = 0; i < 14; i++) { const a = -Math.PI / 2 + (R() - 0.5) * 2.2, l = (40 + R() * 30) * s; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.5 - 6, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); for (let b = 0; b < 4; b++) { const t2 = 0.5 + R() * 0.5; g.fillStyle = night ? "#8a2a2a" : "#e02a2a"; g.beginPath(); g.arc(x + Math.cos(a) * l * t2 + (R() - 0.5) * 6, y + Math.sin(a) * l * t2 + (R() - 0.5) * 6, 2.6 * s, 0, TAU); g.fill(); } }
                g.fillStyle = P.snow[0]; for (let i = 0; i < 8; i++) { g.beginPath(); g.ellipse(x + (R() - 0.5) * 60 * s, y - R() * 50 * s, 6 * s, 2.5 * s, 0, 0, TAU); g.fill(); }
                V.perch = [x - M, y - 54 * s, s];
            }
            // big pines and birches on both sides
            for (const [x, h] of [[0.02, 0.62], [0.09, 0.48], [0.94, 0.66], [0.99, 0.52]]) pine(g, M + W * x, dy(M + W * x) + 40 * s, H * h, P.pine, P.snow[0], P.wood[1]);
            for (const x of [0.14, 0.9]) birch(g, M + W * x, dy(M + W * x) + 30 * s, H * 0.4, s);
        });
        flakeSpr = paint(16, 16, g => { const gr = g.createRadialGradient(8, 8, 0, 8, 8, 8); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.45, "rgba(255,255,255,.85)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 16, 16); });
        aur = [[80, 255, 170], [60, 220, 255], [190, 120, 255]].map(([r, gg, b]) => paint(1, 128, g => { const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, `rgba(${r},${gg},${b},0)`); gr.addColorStop(0.55, `rgba(${r},${gg},${b},.55)`); gr.addColorStop(0.85, `rgba(${r},${gg},${b},.9)`); gr.addColorStop(1, `rgba(${r},${gg},${b},0)`); g.fillStyle = gr; g.fillRect(0, 0, 1, 128); }));
        const per = preview ? [35, 25, 6] : [110, 80, 22];
        flakes = [];
        per.forEach((n, layer) => { for (let i = 0; i < n; i++) flakes.push({ layer, x: R() * W, y: R() * H, r: [0.7, 1.5, 2.8][layer] + R() * [0.6, 0.9, 1.8][layer], sp: [16, 34, 64][layer] * (0.75 + R() * 0.5), ph: R() * TAU }); });
        glints = Array.from({ length: preview ? 10 : 60 }, () => ({ x: R() * W, y: GY + H * 0.1 + R() * (H - GY - H * 0.1), ph: R() * TAU, sp: 0.6 + R() * 1.6 }));
        stars = night ? Array.from({ length: preview ? 0 : 40 }, () => ({ x: R() * W, y: Math.pow(R(), 1.2) * HZ * 0.7, r: 1 + R(), ph: R() * TAU, sp: 0.5 + R() })) : [];
    }
    const V = {};
    setup();

    function drawFox(g, f, t) {
        g.save(); g.translate(f.x, f.y); g.scale(f.dir * f.s, f.s);
        const step = Math.sin(t * 13), bob = Math.abs(step) * 1.5;
        g.translate(0, -bob);
        g.fillStyle = "#d4652a"; g.beginPath(); g.moveTo(-16, -14); g.quadraticCurveTo(-36, -26 + step * 2, -50, -12); g.quadraticCurveTo(-36, -6, -16, -9); g.fill();
        g.fillStyle = "#fff8f0"; g.beginPath(); g.ellipse(-47, -12.5, 5.5, 3.4, -0.3, 0, TAU); g.fill();
        g.strokeStyle = "#3a2216"; g.lineWidth = 3; g.lineCap = "round";
        for (const [lx, ph] of [[-11, 0], [-6, Math.PI], [9, Math.PI], [14, 0]]) { const sw = Math.sin(t * 13 + ph) * 5; g.beginPath(); g.moveTo(lx, -10); g.lineTo(lx + sw, 2 + bob); g.stroke(); }
        const bg = g.createLinearGradient(0, -22, 0, -6); bg.addColorStop(0, "#e8803a"); bg.addColorStop(1, "#c85a22");
        g.fillStyle = bg; g.beginPath(); g.ellipse(0, -14, 19, 8.5, 0, 0, TAU); g.fill();
        g.fillStyle = "#fff4e8"; g.beginPath(); g.ellipse(13, -11, 7, 5, 0.3, 0, TAU); g.fill();
        g.fillStyle = "#e0702e"; g.beginPath(); g.moveTo(12, -24); g.quadraticCurveTo(22, -30, 31, -19); g.lineTo(23, -15); g.quadraticCurveTo(14, -14, 12, -24); g.fill();
        g.fillStyle = "#3a2216"; g.beginPath(); g.moveTo(15, -25); g.lineTo(16, -34); g.lineTo(20, -27); g.fill(); g.beginPath(); g.moveTo(19, -26); g.lineTo(22, -34); g.lineTo(24, -26); g.fill();
        g.beginPath(); g.arc(30.5, -19.5, 1.6, 0, TAU); g.fill(); g.beginPath(); g.arc(21, -22.5, 1.2, 0, TAU); g.fill();
        g.restore();
    }
    function drawBird(g, x, y, sc, dir, t, perched) {
        g.save(); g.translate(x, y); g.scale(dir * sc, sc);
        const flap = perched ? 0.05 : Math.sin(t * 22);
        g.fillStyle = night ? "#8a2a30" : "#c8202f";
        g.beginPath(); g.ellipse(0, 0, 11, 6.5, -0.15, 0, TAU); g.fill();
        g.beginPath(); g.moveTo(-9, -1); g.lineTo(-20, perched ? 6 : -4); g.lineTo(-19, perched ? 10 : 3); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(6, -5); g.lineTo(9, -13); g.lineTo(12, -4); g.fill();
        g.fillStyle = "#1a1a1a"; g.beginPath(); g.ellipse(10, -1, 3.5, 3, 0, 0, TAU); g.fill();
        g.fillStyle = "#f0a830"; g.beginPath(); g.moveTo(12, -2); g.lineTo(17, 0); g.lineTo(12, 1.5); g.fill();
        g.fillStyle = night ? "#6a1a20" : "#9c1622"; g.beginPath(); g.moveTo(-3, -2); g.lineTo(-10, -2 - 14 * flap); g.lineTo(4, -1); g.fill();
        g.restore();
    }

    return {
        resize(w, h) { W = w; H = h; setup(); },
        draw(g, t, dt, inp) {
            const px = inp.px || 0;
            nextGust -= dt;
            if (nextGust <= 0 && gustLeft <= 0) { gustLeft = 3.2; nextGust = U.rand(18, 32); }
            if (gustLeft > 0) { gustLeft -= dt; gust = Math.sin(Math.PI * (1 - gustLeft / 3.2)) * 150; } else gust = 0;
            const wind = Math.sin(t * 0.17) * 14 + Math.sin(t * 0.05 + 1) * 10 + gust;
            g.drawImage(skyImg, 0, 0);
            if (night) {
                for (const st of stars) Worlds.twinkle(g, st.x - px * 2, st.y, st.r, 0.5 + 0.5 * Math.sin(t * st.sp + st.ph), "#eef6ff");
                g.save(); g.globalCompositeOperation = "lighter";                           // the northern lights
                const step = preview ? 3 : 5;
                aur.forEach((spr, i) => {
                    const base = H * (0.04 + i * 0.07), ph = i * 2.1;
                    for (let x = -step; x < W + step; x += step) {
                        const y = base + Math.sin(x * 0.0035 + t * 0.22 + ph) * H * 0.06 + Math.sin(x * 0.011 - t * 0.37 + ph) * H * 0.018;
                        const hgt = H * (0.17 + 0.07 * Math.sin(x * 0.006 + t * 0.29 + ph));
                        g.globalAlpha = Math.max(0, 0.16 + 0.14 * Math.sin(x * 0.013 + t * 0.6 + ph) + 0.06 * Math.sin(x * 0.041 - t));
                        g.drawImage(spr, x - px * 3, y, step + 1, hgt);
                    }
                });
                g.restore();
                nextMeteor -= dt;
                if (!meteor && nextMeteor <= 0) meteor = { x: U.rand(0.2, 0.9) * W, y: U.rand(0.03, 0.25) * H, vx: -U.rand(380, 560), vy: U.rand(120, 220), life: 0.9 };
                if (meteor) {
                    meteor.life -= dt; meteor.x += meteor.vx * dt; meteor.y += meteor.vy * dt;
                    const mgr = g.createLinearGradient(meteor.x, meteor.y, meteor.x - meteor.vx * 0.18, meteor.y - meteor.vy * 0.18);
                    mgr.addColorStop(0, `rgba(255,255,255,${Math.min(1, meteor.life * 2)})`); mgr.addColorStop(1, "rgba(255,255,255,0)");
                    g.strokeStyle = mgr; g.lineWidth = 2; g.beginPath(); g.moveTo(meteor.x, meteor.y); g.lineTo(meteor.x - meteor.vx * 0.18, meteor.y - meteor.vy * 0.18); g.stroke();
                    if (meteor.life <= 0) { meteor = null; nextMeteor = U.rand(5, 12); }
                }
            }
            g.drawImage(farImg, -M - px * 4, 0);
            const mo = -M - px * 8;
            g.drawImage(midImg, mo, 0);
            for (const c of cabins) {                                                     // windows glowing, chimneys smoking
                const x = c.x - px * 8, fl = 0.85 + Math.sin(t * 7.3 + x) * 0.06 + Math.sin(t * 13.1 + x) * 0.05;
                g.fillStyle = night ? `rgba(255,205,110,${fl})` : "rgba(90,70,50,.9)";
                if (c.arch) { g.beginPath(); g.arc(x + c.w / 2, c.y, c.w / 2, Math.PI, TAU); g.fillRect(x, c.y, c.w, c.h); g.fill(); }
                else { g.fillRect(x, c.y, c.w, c.h); g.fillRect(x + c.w * 1.8, c.y, c.w, c.h); }
                if (night) Worlds.glow(g, x + c.w, c.y + c.h / 2, c.w * 3, "#ffc060", 0.35);
                if (c.chim && Math.random() < dt * 4) smoke.push({ x: c.chim[0], y: c.chim[1], r: 2 * c.sc, a: 0.5, vx: 0, vy: -10 * c.sc });
            }
            smoke = smoke.filter(p => {
                p.vx += (wind * 0.4 - p.vx) * dt * 0.8; p.x += p.vx * dt; p.y += p.vy * dt; p.r += 3 * dt; p.a -= dt * 0.09;
                if (p.a <= 0) return false;
                g.fillStyle = night ? `rgba(170,180,200,${(p.a * 0.45).toFixed(3)})` : `rgba(240,242,246,${(p.a * 0.85).toFixed(3)})`;
                g.beginPath(); g.arc(p.x - px * 8, p.y, p.r, 0, TAU); g.fill();
                return true;
            });
            if (skater) {                                                                  // a skater gliding loops on the ice
                skater.ph += dt * 0.35;
                const a = skater.ph, x = skater.x + Math.cos(a) * skater.rx - px * 8, y = skater.y + Math.sin(a) * skater.ry, dir = -Math.sin(a) > 0 ? 1 : -1, sc = k() * 0.9, lean = Math.sin(t * 2.2) * 0.25;
                g.fillStyle = "rgba(0,0,0,.12)"; g.beginPath(); g.ellipse(x, y + 1, 6 * sc, 1.5 * sc, 0, 0, TAU); g.fill();
                g.save(); g.translate(x, y); g.scale(dir, 1); g.rotate(lean * 0.3);
                g.strokeStyle = night ? "#2a2a3a" : "#2a2a44"; g.lineWidth = 2 * sc; g.lineCap = "round";
                g.beginPath(); g.moveTo(0, -10 * sc); g.lineTo(-3 * sc + lean * 6, 0); g.moveTo(0, -10 * sc); g.lineTo(4 * sc, -2 * sc); g.lineTo(7 * sc, -3 * sc); g.stroke();
                g.fillStyle = night ? "#6a2a3a" : "#d83a4a"; g.beginPath(); g.ellipse(0, -15 * sc, 3.5 * sc, 6 * sc, 0.2, 0, TAU); g.fill();
                g.strokeStyle = night ? "#6a2a3a" : "#d83a4a"; g.beginPath(); g.moveTo(-1, -17 * sc); g.lineTo(-8 * sc, -14 * sc + lean * 4); g.moveTo(1, -17 * sc); g.lineTo(8 * sc, -19 * sc - lean * 4); g.stroke();
                g.fillStyle = "#f2c8a0"; g.beginPath(); g.arc(0, -23 * sc, 2.8 * sc, 0, TAU); g.fill();
                g.fillStyle = night ? "#3a5a7a" : "#3a8ad8"; g.beginPath(); g.arc(0, -24 * sc, 3 * sc, Math.PI, TAU); g.fill();
                g.restore();
            }
            for (const gl of glints) {                                                     // glints on the snow
                const q = Math.max(0, Math.sin(t * gl.sp + gl.ph)) ** 10;
                if (q < 0.05) continue;
                const x = gl.x - px * 14;
                Worlds.glint(g, x, gl.y, 2 + q * 5, q, night ? "#dfe8ff" : "#ffffff");
            }
            nextFox -= dt;                                                                 // a fox trots through, leaving prints
            if (!fox && nextFox <= 0) { const dir = Math.random() < 0.5 ? 1 : -1; fox = { dir, x: dir > 0 ? -60 : W + 60, y: GY + (H - GY) * U.rand(0.55, 0.8), vx: dir * U.rand(70, 95), s: U.clamp(H / 820, 0.55, 1.25), printIn: 0 }; }
            for (let i = prints.length - 1; i >= 0; i--) {
                const p = prints[i]; p.age += dt;
                if (p.age > 16) { prints.splice(i, 1); continue; }
                g.fillStyle = night ? `rgba(30,45,80,${(0.35 * (1 - p.age / 16)).toFixed(3)})` : `rgba(120,150,190,${(0.4 * (1 - p.age / 16)).toFixed(3)})`;
                g.beginPath(); g.ellipse(p.x - px * 14, p.y, 2.6 * p.s, 1.4 * p.s, 0, 0, TAU); g.fill();
            }
            g.drawImage(frontImg, -M - px * 14, 0);
            if (fox) {
                fox.x += fox.vx * dt; fox.printIn -= dt;
                if (fox.printIn <= 0) { fox.printIn = 0.16; prints.push({ x: fox.x + px * 14, y: fox.y + (prints.length % 2 ? 2 : -2) * fox.s, s: fox.s, age: 0 }); }
                drawFox(g, { ...fox, x: fox.x - px * 14 }, t);
                if (fox.x < -80 || fox.x > W + 80) { fox = null; nextFox = U.rand(16, 30); }
            }
            // the cardinal: perched on the berry bush, hopping off to fly a loop now and then
            nextBird -= dt;
            if (!bird && nextBird <= 0 && !preview) { const dir = Math.random() < 0.5 ? 1 : -1; bird = { dir, x: dir > 0 ? -30 : W + 30, y: U.rand(0.15, 0.4) * H, vx: dir * U.rand(90, 140), s: U.clamp(H / 900, 0.6, 1.2) }; }
            if (bird) { bird.x += bird.vx * dt; drawBird(g, bird.x, bird.y + Math.sin(t * 5) * 6, bird.s, bird.dir, t, false); if (bird.x < -60 || bird.x > W + 60) { bird = null; nextBird = U.rand(14, 26); } }
            else if (V.perch) { const [x, y, s] = V.perch, hop = Math.max(0, Math.sin(t * 1.3)) ** 20 * 4; drawBird(g, x - px * 14, y - hop, s * 1.1, Math.sin(t * 0.4) > 0 ? 1 : -1, t, true); }
            for (const f of flakes) {                                                      // the snowfall, three depths in the wind
                const depth = 0.4 + f.layer * 0.4;
                f.y += f.sp * dt; f.x += (wind * depth + Math.sin(t * 1.3 + f.ph) * 8) * dt;
                if (f.y > H + 6) { f.y = -6; f.x = Math.random() * W; }
                if (f.x > W + 10) f.x -= W + 20; else if (f.x < -10) f.x += W + 20;
                const x = f.x - px * (3 + f.layer * 9);
                if (f.layer === 0) { g.fillStyle = night ? "rgba(220,230,255,.6)" : "rgba(255,255,255,.75)"; g.fillRect(x, f.y, f.r, f.r); }
                else {
                    const d = f.r * 2.6; g.globalAlpha = f.layer === 2 ? 0.85 : 0.95; g.drawImage(flakeSpr, x - d / 2, f.y - d / 2, d, d); g.globalAlpha = 1;
                    const gl = Math.sin(t * 2.3 + f.ph * 5);
                    if (f.layer === 2 && gl > 0.95) Worlds.glint(g, x, f.y, d * 0.7, (gl - 0.95) * 16, night ? "#dfe8ff" : "#ffffff");
                }
            }
        }
    };
}
