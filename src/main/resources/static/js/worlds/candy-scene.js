// Candy Hills' background (candy.js uses it): a valley made of sweets, in depth.
//   Day: a pastel sky with a lemon-drop sun, a sour-belt rainbow dusted with sugar and cotton-candy clouds;
//   frosted mountains with icing dripping down them; a candy castle on a hill (wafer walls, cone towers with
//   swirled roofs, gumdrop domes, flags); a chocolate waterfall pouring off a cliff into a chocolate river that
//   winds toward you with gloss sliding along it and a wafer bridge across; rows of glossy sugar-dusted gumdrop
//   hills; cotton-candy trees, ice-cream-cone trees and lollipops whose swirls slowly turn; a frosted meadow with
//   sprinkles, peppermint stepping stones, candy corn, a donut and a candy-cane fence; sprinkles drifting down and
//   a cupcake balloon floating by. Night: violet sky, a marshmallow moon, stars, lantern strings, sugar crystals
//   glinting and the castle's windows lit.
//   CandyScene(W, H, opts)
function CandyScene(W, H, opts) {
    const night = opts.theme === "dark", preview = !!opts.preview, TAU = Math.PI * 2, M = 50;
    const SPRINKLES = ["#ff5c8a", "#ffd23f", "#3ec1d3", "#7cdc5a", "#a26bff", "#ffffff", "#ff9f43"];
    const P = night
        ? { sky: ["#140a2e", "#2e1650", "#5a2468", "#8a3a74"], mtn: ["#5a3a7a", "#4a2e66"], icing: "#d8c8f0", hill: ["#6a3a8a", "#3a6a7a", "#8a4a6a", "#7a6a3a"], meadow: ["#2a5a5a", "#1e4448"],
            choc: ["#2a140a", "#4a2a16", "#120804"], wafer: ["#8a6a3a", "#6a4a24"], cloud: ["200,170,230", "170,180,240"], gloss: 0.25, haze: "rgba(120,80,160," }
        : { sky: ["#8fd0ff", "#c4dcff", "#ffd1ec", "#ffe9d2"], mtn: ["#f4b8d8", "#d8a8e8"], icing: "#ffffff", hill: ["#ff8ab8", "#7ee0b8", "#ffcf6a", "#b49aff"], meadow: ["#a8f0d0", "#78d8b0"],
            choc: ["#6a3a1e", "#9a5a30", "#3a1a08"], wafer: ["#f0c87a", "#c8964a"], cloud: ["255,214,239", "207,233,255"], gloss: 0.75, haze: "rgba(255,236,250," };
    let HZ, sky, far, mid, near, front, river = [], clouds = [], lollis = [], sprinkles = [], stars = [], lanterns = [], crystals = [], windows = [], fall = null;
    let balloon = null, nextBalloon = preview ? 1e9 : U.rand(6, 14);
    function paint(w, h, fn) { const c = Worlds.canvas(w, h), g = c.getContext("2d"); fn(g); return c; }
    const mix = (a, b, t) => { const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16)); return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
    const k = () => (preview ? 0.5 : U.clamp(Math.min(W, H) / 900, 0.6, 1.15));

    // a glossy gumdrop: shaded dome, a soft highlight, a rim of light, sugar crystals
    function gumdrop(g, cx, base, r, col, R) {
        const top = base - r * 1.5;
        const gr = g.createLinearGradient(cx - r, 0, cx + r, 0);
        gr.addColorStop(0, mix(col, "#ffffff", 0.15)); gr.addColorStop(0.55, col); gr.addColorStop(1, mix(col, "#000000", night ? 0.45 : 0.22));
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(cx - r * 1.1, base); g.bezierCurveTo(cx - r * 1.1, top + r * 0.3, cx - r * 0.6, top, cx, top); g.bezierCurveTo(cx + r * 0.6, top, cx + r * 1.1, top + r * 0.3, cx + r * 1.1, base); g.closePath(); g.fill();
        const hl = g.createRadialGradient(cx - r * 0.4, top + r * 0.45, 0, cx - r * 0.4, top + r * 0.45, r * 0.55);
        hl.addColorStop(0, `rgba(255,255,255,${P.gloss})`); hl.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = hl; g.beginPath(); g.ellipse(cx - r * 0.4, top + r * 0.45, r * 0.4, r * 0.55, -0.4, 0, TAU); g.fill();
        g.fillStyle = night ? "rgba(255,230,255,.18)" : "rgba(255,255,255,.75)";
        for (let i = 0; i < r * 1.2; i++) { const u = R() * 2 - 1, y = top + r * 0.15 + R() * (base - top - r * 0.15); if (Math.abs(u) * r * 1.05 > r * 1.1 * Math.min(1, (y - top) / (r * 0.6) + 0.2)) continue; g.fillRect(cx + u * r, y, 1.4, 1.4); }
    }
    function swirl(g, x, y, r, a, c1, c2) {
        g.save(); g.translate(x, y); g.rotate(a);
        g.fillStyle = c1; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
        g.strokeStyle = c2; g.lineWidth = r * 0.22; g.lineCap = "round";
        g.beginPath(); for (let i = 0; i <= 60; i++) { const q = i / 60, ang = q * TAU * 2.6, rr = q * r * 0.85; i ? g.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr) : g.moveTo(0, 0); } g.stroke();
        g.restore();
        const hl = g.createRadialGradient(x - r * 0.35, y - r * 0.4, 0, x - r * 0.35, y - r * 0.4, r * 0.6);
        hl.addColorStop(0, "rgba(255,255,255,.6)"); hl.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = hl; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        g.strokeStyle = "rgba(0,0,0,.12)"; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
    }

    function setup() {
        const R = U.rng(1414), s = k(), LW = W + M * 2;
        HZ = H * 0.5;
        sky = paint(W, H, g => {
            const sg = g.createLinearGradient(0, 0, 0, HZ + H * 0.1);
            P.sky.forEach((c, i) => sg.addColorStop(i / (P.sky.length - 1), c));
            g.fillStyle = sg; g.fillRect(0, 0, W, H);
            if (night) {
                for (let i = 0; i < (preview ? 60 : 300); i++) { const y = Math.pow(R(), 1.3) * HZ, a = 0.3 + R() * 0.6 * (1 - y / HZ); g.fillStyle = `rgba(255,236,255,${a.toFixed(2)})`; g.fillRect(R() * W, y, R() < 0.1 ? 1.8 : 1, R() < 0.1 ? 1.8 : 1); }
                const mx = W * 0.8, my = H * 0.15, mr = Math.min(W, H) * 0.055;                  // the marshmallow moon
                const mg = g.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 4); mg.addColorStop(0, "rgba(255,230,250,.3)"); mg.addColorStop(1, "rgba(255,230,250,0)");
                g.fillStyle = mg; g.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
                const mb = g.createLinearGradient(0, my - mr, 0, my + mr); mb.addColorStop(0, "#fffaff"); mb.addColorStop(1, "#f0d8ec");
                g.fillStyle = mb; g.beginPath(); g.roundRect(mx - mr, my - mr * 0.8, mr * 2, mr * 1.6, mr * 0.65); g.fill();
                g.fillStyle = "rgba(255,200,230,.55)"; g.beginPath(); g.roundRect(mx - mr, my - mr * 0.12, mr * 2, mr * 0.24, mr * 0.12); g.fill();
                g.fillStyle = "rgba(255,255,255,.5)"; g.beginPath(); g.ellipse(mx - mr * 0.45, my - mr * 0.45, mr * 0.3, mr * 0.12, -0.2, 0, TAU); g.fill();
            } else {
                // the sour-belt rainbow: bands dusted with sugar
                const rx = W * 0.3, rr = Math.min(W, H) * 0.5, bw = rr * 0.06;
                ["255,92,138", "255,159,67", "255,210,63", "124,220,90", "62,193,211", "162,107,255"].forEach((c, i) => {
                    g.strokeStyle = `rgba(${c},.42)`; g.lineWidth = bw; g.beginPath(); g.arc(rx, HZ + H * 0.05, rr - i * bw, Math.PI, TAU); g.stroke();
                });
                g.fillStyle = "rgba(255,255,255,.55)";
                for (let i = 0; i < 700; i++) { const a = Math.PI + R() * Math.PI, d = rr - R() * bw * 6 + bw / 2; g.fillRect(rx + Math.cos(a) * d, HZ + H * 0.05 + Math.sin(a) * d, 1.3, 1.3); }
                const sx = W * 0.84, sy = H * 0.12, sr = Math.min(W, H) * 0.05;                  // the lemon-drop sun
                const halo = g.createRadialGradient(sx, sy, sr, sx, sy, sr * 6); halo.addColorStop(0, "rgba(255,250,210,.7)"); halo.addColorStop(1, "rgba(255,250,210,0)");
                g.fillStyle = halo; g.fillRect(sx - sr * 6, sy - sr * 6, sr * 12, sr * 12);
                const sg2 = g.createRadialGradient(sx - sr * 0.3, sy - sr * 0.3, 0, sx, sy, sr); sg2.addColorStop(0, "#fffbd0"); sg2.addColorStop(0.6, "#ffe85a"); sg2.addColorStop(1, "#ffc83a");
                g.fillStyle = sg2; g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.fill();
                g.fillStyle = "rgba(255,255,255,.7)"; for (let i = 0; i < 60; i++) { const a = R() * TAU, d = Math.sqrt(R()) * sr * 0.9; g.fillRect(sx + Math.cos(a) * d, sy + Math.sin(a) * d, 1.2, 1.2); }
            }
        });
        // far: frosted mountains with icing dripping down from their peaks
        far = paint(LW, H, g => {
            const ridge = (base, amp, f1, ph, col, icing) => {
                const pts = []; for (let x = -10; x <= LW + 10; x += 6) pts.push([x, base - Math.abs(Math.sin(x * f1 + ph)) * amp - Math.sin(x * f1 * 2.7 + ph) * amp * 0.15]);
                g.fillStyle = col; g.beginPath(); g.moveTo(-10, H); pts.forEach(p => g.lineTo(p[0], p[1])); g.lineTo(LW + 10, H); g.fill();
                if (!icing) return;
                g.fillStyle = P.icing; g.globalAlpha = night ? 0.5 : 0.95;                   // the icing: along the tops, dripping
                g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); pts.forEach(p => g.lineTo(p[0], p[1]));
                for (let i = pts.length - 1; i >= 0; i--) { const [x, y] = pts[i], peak = base - y; const drip = Math.max(0, peak - amp * 0.55) * (0.5 + 0.5 * Math.abs(Math.sin(x * 0.11))) + (i % 5 === 0 ? peak * 0.12 * R() : 0); g.lineTo(x, y + 4 + drip); }
                g.closePath(); g.fill(); g.globalAlpha = 1;
            };
            ridge(HZ - H * 0.02, H * 0.2, 0.004, 0.6, P.mtn[1], true);
            const hz = g.createLinearGradient(0, HZ - H * 0.2, 0, HZ + H * 0.05); hz.addColorStop(0, P.haze + "0)"); hz.addColorStop(1, P.haze + (night ? ".25)" : ".55)"));
            g.fillStyle = hz; g.fillRect(0, HZ - H * 0.2, LW, H * 0.3);
            ridge(HZ + H * 0.02, H * 0.13, 0.0065, 2.1, P.mtn[0], true);
            // a great layer cake on the left, frosted, the chocolate pouring off its edge
            const fx = M + W * 0.24, top = HZ - H * 0.1, cw = W * 0.13, cbot = HZ + H * 0.08, x0 = fx - cw;
            const layers = [["#f0c890", "#d8a868"], ["#6a3a1e", "#4a2410"], ["#f0c890", "#d8a868"], ["#ff9ac0", "#e87aa8"]];
            const lh = (cbot - top) / layers.length;
            layers.forEach(([a, b], i) => {
                const y = top + i * lh, lg = g.createLinearGradient(x0, 0, fx, 0); lg.addColorStop(0, night ? mix(a, "#000000", 0.45) : a); lg.addColorStop(1, night ? mix(b, "#000000", 0.5) : b);
                g.fillStyle = lg; g.fillRect(x0, y, cw, lh);
                g.fillStyle = night ? "rgba(255,240,250,.35)" : "#fffaf2"; g.fillRect(x0, y + lh - 3, cw, 3);
                g.fillStyle = "rgba(0,0,0,.08)"; for (let k = 0; k < 40; k++) g.fillRect(x0 + R() * cw, y + R() * (lh - 4), 1.6, 1.6);
            });
            g.fillStyle = P.icing; g.globalAlpha = night ? 0.6 : 1;
            g.beginPath(); g.roundRect(x0 - 4, top - 8, cw + 8, 12, 6); g.fill();
            for (let x = x0; x < fx - 6; x += 9 + R() * 8) { g.beginPath(); g.roundRect(x, top - 2, 6, 6 + R() * 18, 3); g.fill(); }
            g.globalAlpha = 1;
            for (let x = x0 + 10; x < fx - 10; x += cw / 4) { g.fillStyle = "#e8344e"; g.beginPath(); g.arc(x, top - 12, 5, 0, TAU); g.fill(); g.fillStyle = "rgba(255,255,255,.6)"; g.beginPath(); g.arc(x - 1.5, top - 13.5, 1.6, 0, TAU); g.fill(); }
            fall = { x: fx - M, top: top + 2, bottom: cbot, w: W * 0.016 };
            // the candy castle on its hill
            const cx = M + W * 0.74, cb = HZ + H * 0.04, cs = Math.min(W, H) * 0.0009 * (preview ? 0.6 : 1) * 100;
            gumdrop(g, cx, cb + H * 0.04, cs * 1.9, P.hill[1], R);
            const wall = (x, w, h) => { const wg = g.createLinearGradient(x, 0, x + w, 0); wg.addColorStop(0, P.wafer[0]); wg.addColorStop(1, P.wafer[1]); g.fillStyle = wg; g.fillRect(x, cb - h, w, h); g.strokeStyle = "rgba(120,70,20,.35)"; g.lineWidth = 0.8; for (let yy = cb - h + 4; yy < cb; yy += 5) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy); g.stroke(); } for (let xx = x + 4; xx < x + w; xx += 5) { g.beginPath(); g.moveTo(xx, cb - h); g.lineTo(xx, cb); g.stroke(); } };
            wall(cx - cs * 1.6, cs * 3.2, cs * 1.1);
            for (let x = cx - cs * 1.6; x < cx + cs * 1.6; x += cs * 0.4) { g.fillStyle = "#ff8ab8"; g.beginPath(); g.arc(x + cs * 0.2, cb - cs * 1.1, cs * 0.2, Math.PI, TAU); g.fill(); }
            windows = [];
            const tower = (x, w, h, roof, flag) => {
                wall(x - w / 2, w, h);
                const rg = g.createLinearGradient(x - w, 0, x + w, 0); rg.addColorStop(0, mix(roof, "#ffffff", 0.3)); rg.addColorStop(1, mix(roof, "#000000", 0.2));
                g.fillStyle = rg; g.beginPath(); g.moveTo(x - w * 0.7, cb - h); g.lineTo(x, cb - h - w * 1.8); g.lineTo(x + w * 0.7, cb - h); g.fill();
                g.strokeStyle = "rgba(255,255,255,.7)"; g.lineWidth = w * 0.12;                // a swirl stripe round the cone
                g.save(); g.beginPath(); g.moveTo(x - w * 0.7, cb - h); g.lineTo(x, cb - h - w * 1.8); g.lineTo(x + w * 0.7, cb - h); g.clip();
                for (let i = -3; i < 6; i++) { g.beginPath(); g.moveTo(x - w, cb - h - i * w * 0.4); g.lineTo(x + w, cb - h - i * w * 0.4 - w * 0.5); g.stroke(); }
                g.restore();
                g.fillStyle = "#e8344e"; g.beginPath(); g.arc(x, cb - h - w * 1.8, w * 0.16, 0, TAU); g.fill();
                if (flag) { g.strokeStyle = "#7a5a3a"; g.lineWidth = 1; g.beginPath(); g.moveTo(x, cb - h - w * 1.8); g.lineTo(x, cb - h - w * 2.5); g.stroke(); g.fillStyle = flag; g.beginPath(); g.moveTo(x, cb - h - w * 2.5); g.lineTo(x + w * 0.6, cb - h - w * 2.35); g.lineTo(x, cb - h - w * 2.2); g.fill(); }
                for (let wy = cb - h + w * 0.4; wy < cb - w * 0.4; wy += w * 0.7) { g.fillStyle = night ? "#ffd88a" : "#7a4a8a"; g.beginPath(); g.roundRect(x - w * 0.12, wy, w * 0.24, w * 0.34, [w * 0.12, w * 0.12, 0, 0]); g.fill(); windows.push([x - M, wy + w * 0.17, w * 0.4]); }
            };
            tower(cx - cs * 1.6, cs * 0.7, cs * 2.1, "#ff5c8a", "#ffd23f");
            tower(cx + cs * 1.6, cs * 0.7, cs * 2.3, "#a26bff", "#3ec1d3");
            tower(cx, cs * 1.0, cs * 2.9, "#3ec1d3", "#ff5c8a");
            for (const [dx, col] of [[-0.8, "#ffd23f"], [0.8, "#7cdc5a"]]) { const x = cx + dx * cs, gr2 = g.createRadialGradient(x - cs * 0.15, cb - cs * 1.55, 0, x, cb - cs * 1.4, cs * 0.45); gr2.addColorStop(0, "#ffffff"); gr2.addColorStop(0.4, col); gr2.addColorStop(1, mix(col, "#000000", 0.25)); g.fillStyle = gr2; g.beginPath(); g.arc(x, cb - cs * 1.1, cs * 0.45, Math.PI, TAU); g.fill(); }
            g.fillStyle = "#6a3a1e"; g.beginPath(); g.moveTo(cx - cs * 0.3, cb); g.lineTo(cx - cs * 0.3, cb - cs * 0.5); g.arc(cx, cb - cs * 0.5, cs * 0.3, Math.PI, 0); g.lineTo(cx + cs * 0.3, cb); g.fill();
        });
        // mid: rows of gumdrop hills, trees, the chocolate river and its bridge
        mid = paint(LW, H, g => {
            for (const [base, r0, n] of [[HZ + H * 0.09, H * 0.07, 9], [HZ + H * 0.15, H * 0.085, 7]]) for (let i = 0; i < n; i++) {
                const x = ((i + 0.15 + R() * 0.7) / n) * LW, r = r0 * (0.75 + R() * 0.5);
                gumdrop(g, x, base + r * 0.4, r, P.hill[Math.floor(R() * P.hill.length)], R);
            }
            // the meadow in front of the hills
            const mg = g.createLinearGradient(0, HZ + H * 0.16, 0, H);
            mg.addColorStop(0, P.meadow[0]); mg.addColorStop(1, P.meadow[1]);
            g.fillStyle = mg; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= LW; x += 10) g.lineTo(x, HZ + H * 0.17 + Math.sin(x * 0.006) * H * 0.012); g.lineTo(LW, H); g.fill();
            // the river: from the waterfall's pool winding toward you, wider as it comes
            river = [];
            for (let i = 0; i <= 40; i++) { const t = i / 40, y = HZ + H * 0.08 + Math.pow(t, 1.3) * (H * 0.62), x = M + W * (0.24 + 0.22 * Math.sin(t * 2.6) + t * 0.12), w = W * (0.012 + t * t * 0.14); river.push([x, y, w]); }
            g.fillStyle = P.choc[2];
            g.beginPath(); river.forEach(([x, y, w], i) => g[i ? "lineTo" : "moveTo"](x - w - 3, y)); for (let i = river.length - 1; i >= 0; i--) g.lineTo(river[i][0] + river[i][2] + 3, river[i][1]); g.fill();
            const cg = g.createLinearGradient(0, HZ, 0, H); cg.addColorStop(0, P.choc[1]); cg.addColorStop(1, P.choc[0]);
            g.fillStyle = cg; g.beginPath(); river.forEach(([x, y, w], i) => g[i ? "lineTo" : "moveTo"](x - w, y)); for (let i = river.length - 1; i >= 0; i--) g.lineTo(river[i][0] + river[i][2], river[i][1]); g.fill();
            g.fillStyle = mix(P.choc[1], "#ffffff", 0.08); g.beginPath(); g.ellipse(river[0][0], river[0][1], W * 0.035, H * 0.008, 0, 0, TAU); g.fill();
            // the wafer bridge across it
            const bi = 26, [bx, by, bw] = river[bi], span = bw * 1.6;
            g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(bx, by + 8, span, 5, 0, 0, TAU); g.fill();
            const wg = g.createLinearGradient(0, by - 14, 0, by + 6); wg.addColorStop(0, P.wafer[0]); wg.addColorStop(1, P.wafer[1]);
            g.fillStyle = wg; g.beginPath(); g.moveTo(bx - span, by + 4); g.quadraticCurveTo(bx, by - 22, bx + span, by + 4); g.lineTo(bx + span, by - 6); g.quadraticCurveTo(bx, by - 32, bx - span, by - 6); g.closePath(); g.fill();
            g.strokeStyle = "rgba(120,70,20,.4)"; g.lineWidth = 0.8;
            for (let u = -0.9; u <= 0.9; u += 0.1) { const x = bx + u * span, y = by - 1 - (1 - u * u) * 13; g.beginPath(); g.moveTo(x, y - 5); g.lineTo(x, y + 5); g.stroke(); }
            g.strokeStyle = "#ffffff"; g.lineWidth = 3; g.beginPath(); g.moveTo(bx - span, by - 8); g.quadraticCurveTo(bx, by - 36, bx + span, by - 8); g.stroke();
            g.strokeStyle = "#e8344e"; g.setLineDash([5, 5]); g.beginPath(); g.moveTo(bx - span, by - 8); g.quadraticCurveTo(bx, by - 36, bx + span, by - 8); g.stroke(); g.setLineDash([]);
            // trees: cotton candy and ice-cream cones along the hills
            for (let i = 0; i < (preview ? 5 : 14); i++) {
                const x = R() * LW, y = HZ + H * (0.18 + R() * 0.08), sz = H * (0.03 + R() * 0.025);
                if (Math.abs(x - river[Math.min(40, Math.round(((y - HZ - H * 0.08) / (H * 0.62)) ** (1 / 1.3) * 40))][0]) < W * 0.05) continue;
                if (R() < 0.55) {
                    g.strokeStyle = night ? "#c8b8d8" : "#ffffff"; g.lineWidth = sz * 0.12; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - sz * 1.6); g.stroke();
                    const col = R() < 0.5 ? "255,170,210" : "170,210,255";
                    for (let p = 0; p < 9; p++) { const a = R() * TAU, d = R() * sz * 0.5, px = x + Math.cos(a) * d, py = y - sz * 2 + Math.sin(a) * d * 0.7, pr = sz * (0.4 + R() * 0.3); const cg2 = g.createRadialGradient(px - pr * 0.2, py - pr * 0.3, 0, px, py, pr); cg2.addColorStop(0, `rgba(255,255,255,${night ? 0.4 : 0.95})`); cg2.addColorStop(0.5, `rgba(${col},${night ? 0.6 : 0.9})`); cg2.addColorStop(1, `rgba(${col},0)`); g.fillStyle = cg2; g.beginPath(); g.arc(px, py, pr, 0, TAU); g.fill(); }
                } else {
                    g.fillStyle = night ? "#8a6a3a" : "#e8b060"; g.beginPath(); g.moveTo(x - sz * 0.45, y - sz * 1.4); g.lineTo(x, y); g.lineTo(x + sz * 0.45, y - sz * 1.4); g.fill();
                    g.strokeStyle = "rgba(140,80,20,.45)"; g.lineWidth = 0.8; for (let q = -2; q <= 2; q++) { g.beginPath(); g.moveTo(x + q * sz * 0.18 - sz * 0.2, y - sz * 1.4); g.lineTo(x + q * sz * 0.05, y - sz * 0.2); g.stroke(); }
                    const sc = ["#ffb8d8", "#fff2c8", "#b8f0d8", "#c8a8ff"][Math.floor(R() * 4)];
                    for (const [dx, dy, rr] of [[0, -1.75, 0.5], [-0.2, -2.25, 0.36]]) { const gg = g.createRadialGradient(x + dx * sz - rr * sz * 0.3, y + dy * sz - rr * sz * 0.3, 0, x + dx * sz, y + dy * sz, rr * sz); gg.addColorStop(0, "#ffffff"); gg.addColorStop(0.4, sc); gg.addColorStop(1, mix(sc, "#000000", 0.15)); g.fillStyle = gg; g.beginPath(); g.arc(x + dx * sz, y + dy * sz, rr * sz, 0, TAU); g.fill(); }
                    g.fillStyle = "#e8344e"; g.beginPath(); g.arc(x - 0.2 * sz, y - 2.62 * sz, sz * 0.1, 0, TAU); g.fill();
                }
            }
        });
        // the front: frosted ground with sprinkles, stepping stones, candy corn, a donut, the candy-cane fence
        front = paint(LW, H, g => {
            const fy = H * 0.84;
            const fg = g.createLinearGradient(0, fy - H * 0.05, 0, H);
            fg.addColorStop(0, night ? "#6a4a7a" : "#ffeef6"); fg.addColorStop(1, night ? "#4a305a" : "#ffd8ea");
            g.fillStyle = fg; g.beginPath(); g.moveTo(0, H);
            for (let x = 0; x <= LW; x += 12) g.lineTo(x, fy - H * 0.02 + Math.sin(x * 0.012) * 6 + Math.sin(x * 0.041) * 3); g.lineTo(LW, H); g.fill();
            g.fillStyle = night ? "#8a6a9a" : "#ffffff";                                        // frosting drips along its edge
            for (let x = 0; x < LW; x += 18 + R() * 30) { const y = fy - H * 0.02 + Math.sin(x * 0.012) * 6 + Math.sin(x * 0.041) * 3; g.beginPath(); g.roundRect(x, y - 2, 7, 8 + R() * 16, 3.5); g.fill(); }
            for (let i = 0; i < (preview ? 120 : 600); i++) { const x = R() * LW, y = fy + R() * (H - fy); g.save(); g.translate(x, y); g.rotate(R() * TAU); g.fillStyle = SPRINKLES[Math.floor(R() * SPRINKLES.length)]; g.globalAlpha = night ? 0.5 : 0.9; g.fillRect(-3, -1, 6, 2); g.restore(); }
            g.globalAlpha = 1;
            const s = k();
            const mint = (x, y, r) => {                                                       // a peppermint stepping stone
                g.fillStyle = "rgba(0,0,0,.15)"; g.beginPath(); g.ellipse(x + 3, y + r * 0.3, r, r * 0.35, 0, 0, TAU); g.fill();
                g.fillStyle = "#ffffff"; g.beginPath(); g.ellipse(x, y, r, r * 0.38, 0, 0, TAU); g.fill();
                g.fillStyle = "#e8344e"; for (let p = 0; p < 8; p += 2) { g.beginPath(); g.moveTo(x, y); g.ellipse(x, y, r * 0.92, r * 0.35, 0, (p / 8) * TAU, ((p + 1) / 8) * TAU); g.closePath(); g.fill(); }
                g.fillStyle = "rgba(255,255,255,.5)"; g.beginPath(); g.ellipse(x - r * 0.3, y - r * 0.12, r * 0.3, r * 0.08, 0, 0, TAU); g.fill();
            };
            for (const [x, y, r] of [[0.33, 0.92, 26], [0.43, 0.97, 32], [0.58, 0.95, 30], [0.68, 0.9, 24]]) mint(M + W * x, H * y, r * s);
            const corn = (x, y, h) => { g.fillStyle = "#ffffff"; g.beginPath(); g.moveTo(x - h * 0.35, y); g.lineTo(x, y - h); g.lineTo(x + h * 0.35, y); g.closePath(); g.fill(); g.save(); g.clip(); g.fillStyle = "#ffb21a"; g.fillRect(x - h, y - h * 0.68, h * 2, h * 0.36); g.fillStyle = "#ff7a1a"; g.fillRect(x - h, y - h * 0.32, h * 2, h * 0.32); g.restore(); };
            for (let i = 0; i < 8; i++) corn(M + W * (R() < 0.5 ? R() * 0.22 : 0.78 + R() * 0.22), fy + R() * (H - fy) * 0.8 + 10, (18 + R() * 10) * s);
            {                                                                                 // a donut, bottom right
                const dx = M + W * 0.86, dy = H * 0.95, dr = 46 * s;
                g.fillStyle = "rgba(0,0,0,.18)"; g.beginPath(); g.ellipse(dx + 6, dy + dr * 0.35, dr * 1.05, dr * 0.35, 0, 0, TAU); g.fill();
                const db = g.createRadialGradient(dx - dr * 0.3, dy - dr * 0.3, 0, dx, dy, dr); db.addColorStop(0, "#f0b870"); db.addColorStop(1, "#b87a3a");
                g.fillStyle = db; g.beginPath(); g.ellipse(dx, dy, dr, dr * 0.55, 0, 0, TAU); g.fill();
                g.fillStyle = night ? "#c86aa0" : "#ff8ac0"; g.beginPath();
                for (let i = 0; i <= 24; i++) { const a = (i / 24) * TAU, rr = dr * (0.88 + (i % 3 ? 0 : 0.06)); g.lineTo(dx + Math.cos(a) * rr, dy + Math.sin(a) * rr * 0.5 - 4); } g.fill();
                g.fillStyle = "#6a3a1e"; g.beginPath(); g.ellipse(dx, dy - 4, dr * 0.3, dr * 0.14, 0, 0, TAU); g.fill();
                for (let i = 0; i < 22; i++) { const a = R() * TAU, d = dr * (0.4 + R() * 0.42); g.save(); g.translate(dx + Math.cos(a) * d, dy - 4 + Math.sin(a) * d * 0.5); g.rotate(R() * TAU); g.fillStyle = SPRINKLES[i % 7]; g.fillRect(-3, -1, 6, 2); g.restore(); }
                g.fillStyle = "rgba(255,255,255,.4)"; g.beginPath(); g.ellipse(dx - dr * 0.45, dy - dr * 0.25, dr * 0.25, dr * 0.07, -0.2, 0, TAU); g.fill();
            }
            // the candy-cane fence: striped posts with hooked tops and two rails
            const step = preview ? 34 : 62;
            for (let x = -10; x < LW; x += step) {
                const y = fy - 4, h = 58 * s, r = 9 * s;
                const cane = () => { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - h); g.arc(x + r, y - h, r, Math.PI, Math.PI * 2.15); };
                g.fillStyle = "rgba(0,0,0,.12)"; g.beginPath(); g.ellipse(x + 4, y + 2, 8, 2.5, 0, 0, TAU); g.fill();
                g.lineCap = "round"; g.lineWidth = 7 * s;
                g.strokeStyle = night ? "#e8e0f0" : "#ffffff"; cane(); g.stroke();
                g.strokeStyle = "#e8344e"; g.setLineDash([4.5 * s, 5.5 * s]); g.lineCap = "butt"; cane(); g.stroke(); g.setLineDash([]);
                g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x - 2 * s, y - 2); g.lineTo(x - 2 * s, y - h); g.stroke();
            }
            g.fillStyle = night ? "#d8c8f0" : "#ffffff";
            for (const ry of [fy - 4 - 34 * s]) { g.fillRect(-10, ry, LW + 20, 4); g.fillStyle = "rgba(232,52,78,.85)"; for (let x = 0; x < LW; x += 14) g.fillRect(x, ry, 6, 4); g.fillStyle = night ? "#d8c8f0" : "#ffffff"; }
        });
        clouds = Array.from({ length: preview ? 3 : 6 }, (_, i) => {
            const cw = 160 + R() * 160, ch = cw * 0.42, pad = ch * 0.6, col = P.cloud[i % 2];
            const img = paint(cw + pad * 2, ch + pad * 2, g => {
                g.translate(pad, pad);
                for (let p = 0; p < 30; p++) {                                               // spun sugar: fluffy puffs, then fine strands
                    const u = R(), hump = Math.sin(u * Math.PI), x = cw * (0.08 + u * 0.84), y = ch * 0.75 - hump * ch * (0.2 + R() * 0.4), r = ch * (0.16 + hump * 0.22);
                    const pg = g.createRadialGradient(x, y, 0, x, y, r); pg.addColorStop(0, `rgba(${col},${night ? 0.35 : 0.85})`); pg.addColorStop(0.6, `rgba(${col},${night ? 0.2 : 0.55})`); pg.addColorStop(1, `rgba(${col},0)`);
                    g.fillStyle = pg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
                }
                g.strokeStyle = `rgba(255,255,255,${night ? 0.12 : 0.45})`; g.lineWidth = 0.8;
                for (let q = 0; q < 50; q++) { const x = cw * (0.15 + R() * 0.7), y = ch * (0.3 + R() * 0.45), l = 10 + R() * 26; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l * 0.5, y - 4 - R() * 6, x + l, y + (R() - 0.5) * 4); g.stroke(); }
            });
            return { img, x: R() * W, y: H * (0.05 + R() * 0.22), s: (0.6 + R() * 0.6) * (preview ? 0.5 : 1), sp: 4 + R() * 7 };
        });
        lollis = Array.from({ length: preview ? 3 : 6 }, (_, i) => {
            const left = i % 2 === 0, fx = left ? 0.03 + R() * 0.13 : 0.84 + R() * 0.13;
            return { x: M + fx * W, base: H * (0.8 + R() * 0.05), h: H * (0.2 + R() * 0.14), r: H * (0.045 + R() * 0.03) * (preview ? 0.6 : 1), sp: (R() < 0.5 ? -1 : 1) * (0.2 + R() * 0.4), c: [["#ff5c8a", "#ffffff"], ["#3ec1d3", "#ffe066"], ["#a26bff", "#ffd1ec"], ["#7cdc5a", "#ffffff"]][i % 4] };
        });
        sprinkles = Array.from({ length: preview ? 18 : 60 }, () => ({ x: R() * W, y: R() * H, sp: 20 + R() * 30, rot: R() * TAU, vr: (R() - 0.5) * 4, c: SPRINKLES[Math.floor(R() * SPRINKLES.length)], ph: R() * TAU }));
        stars = night ? Array.from({ length: preview ? 0 : 40 }, () => ({ x: R() * W, y: Math.pow(R(), 1.3) * HZ * 0.8, r: 1 + R(), ph: R() * TAU, sp: 0.5 + R() })) : [];
        lanterns = night ? Array.from({ length: preview ? 7 : 16 }, (_, i) => ({ k: (i + 0.5) / (preview ? 7 : 16), c: SPRINKLES[i % 5], ph: R() * TAU })) : [];
        crystals = night ? Array.from({ length: preview ? 10 : 40 }, () => ({ x: R() * W, y: H * (0.55 + R() * 0.45), tw: R() * TAU, sp: 0.8 + R() * 2 })) : [];
    }
    setup();

    function drawBalloon(g, b, t) {
        g.save(); g.translate(b.x, b.y + Math.sin(t * 0.8) * 10); g.scale(b.s, b.s);
        const bg = g.createRadialGradient(-10, -50, 2, 0, -40, 34); bg.addColorStop(0, night ? "#f08ac8" : "#ffd0e6"); bg.addColorStop(1, night ? "#a04a7a" : "#ff7ab6");
        g.fillStyle = bg; g.beginPath(); g.arc(0, -40, 30, Math.PI, TAU); g.quadraticCurveTo(30, -10, 0, -2); g.quadraticCurveTo(-30, -10, -30, -40); g.fill();
        for (let i = 0; i < 7; i++) { g.fillStyle = SPRINKLES[i]; g.save(); g.translate(-18 + i * 6, -52 + (i % 3) * 7); g.rotate(i); g.fillRect(-2, -0.9, 4, 1.8); g.restore(); }
        g.fillStyle = "#e8344e"; g.beginPath(); g.arc(0, -72, 6, 0, TAU); g.fill(); g.fillStyle = "rgba(255,255,255,.6)"; g.beginPath(); g.arc(-2, -74, 2, 0, TAU); g.fill();
        g.strokeStyle = "#7a4a2a"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-14, -6); g.lineTo(-10, 12); g.moveTo(14, -6); g.lineTo(10, 12); g.stroke();
        g.fillStyle = night ? "#8a5a3a" : "#c98b4f"; g.beginPath(); g.moveTo(-13, 12); g.lineTo(13, 12); g.lineTo(10, 26); g.lineTo(-10, 26); g.fill();
        g.strokeStyle = "rgba(0,0,0,.15)"; for (let i = -9; i <= 9; i += 4) { g.beginPath(); g.moveTo(i, 13); g.lineTo(i * 0.8, 25); g.stroke(); }
        g.restore();
    }

    return {
        resize(w, h) { W = w; H = h; setup(); },
        draw(g, t, dt, inp) {
            const px = inp.px || 0;
            g.drawImage(sky, 0, 0);
            for (const st of stars) Worlds.twinkle(g, st.x - px * 2, st.y, st.r, 0.5 + 0.5 * Math.sin(t * st.sp + st.ph), "#fff0ff");
            for (const cl of clouds) { cl.x += cl.sp * dt; const w = cl.img.width * cl.s; if (cl.x > W + 40) cl.x = -w - 40; g.drawImage(cl.img, cl.x - px * 4, cl.y, w, cl.img.height * cl.s); }
            nextBalloon -= dt;
            if (!balloon && nextBalloon <= 0) balloon = { x: -60, y: H * U.rand(0.12, 0.3), vx: U.rand(18, 30), s: U.clamp(H / 900, 0.6, 1.2) };
            if (balloon) { balloon.x += balloon.vx * dt; drawBalloon(g, { ...balloon, x: balloon.x - px * 6 }, t); if (balloon.x > W + 80) { balloon = null; nextBalloon = U.rand(20, 35); } }
            const fo = -M - px * 5;
            g.drawImage(far, fo, 0);
            if (night) for (const [x, y, r] of windows) Worlds.glow(g, x - px * 5, y, r * 2.2, "#ffc870", 0.5 + 0.2 * Math.sin(t * 2 + x));
            if (fall) {                                                                      // the chocolate waterfall
                const x = fall.x - px * 5, w = fall.w, top = fall.top, bot = fall.bottom;
                const wg = g.createLinearGradient(x - w, 0, x + w * 2, 0); wg.addColorStop(0, P.choc[2]); wg.addColorStop(0.35, P.choc[1]); wg.addColorStop(1, P.choc[0]);
                g.fillStyle = wg;
                g.beginPath(); g.moveTo(x - w * 1.2, top - 3); g.quadraticCurveTo(x + w * 0.8, top - 6, x + w * 1.2, top + w); g.quadraticCurveTo(x + w * 1.5, (top + bot) / 2, x + w * 2.2, bot);
                g.lineTo(x - w * 0.2, bot); g.quadraticCurveTo(x - w * 0.1, (top + bot) / 2, x - w * 0.2, top + w); g.closePath(); g.fill();
                g.strokeStyle = `rgba(255,225,190,${night ? 0.18 : 0.45})`; g.lineWidth = 1.4; g.lineCap = "round";
                for (let i = 0; i < 6; i++) { const q = (t * 0.8 + i / 6) % 1, y0 = top + w + q * (bot - top - w), xx = x + w * (0.1 + (i % 3) * 0.45) + q * w * 0.8; g.globalAlpha = Math.sin(q * Math.PI); g.beginPath(); g.moveTo(xx, y0); g.lineTo(xx + 1.5, Math.min(bot, y0 + 18)); g.stroke(); }
                g.globalAlpha = 1;
                for (let i = 0; i < 7; i++) { const a = t * 3 + i * 1.7, r = w * (0.5 + 0.3 * Math.sin(a)); g.fillStyle = mix(P.choc[1], "#ffffff", 0.15); g.beginPath(); g.arc(x + w * (i * 0.45 - 0.4), bot - 1, r, Math.PI, TAU); g.fill(); }
            }
            const mo = -M - px * 9;
            g.drawImage(mid, mo, 0);
            g.save(); g.globalCompositeOperation = night ? "lighter" : "source-over";        // gloss sliding down the river
            for (let i = 0; i < river.length - 1; i++) {
                const [x, y, w] = river[i], q = Math.sin(i * 0.9 - t * 2.2);
                if (q < 0.6) continue;
                g.fillStyle = `rgba(255,225,190,${((q - 0.6) * (night ? 0.25 : 0.7)).toFixed(3)})`;
                g.beginPath(); g.ellipse(x + mo + Math.sin(i + t) * w * 0.3, y, w * 0.45, 1.2 + w * 0.02, 0, 0, TAU); g.fill();
            }
            g.restore();
            const ffo = -M - px * 16;
            g.drawImage(front, ffo, 0);
            for (const l of lollis) {                                                        // lollipops, their swirls turning
                const x = l.x + ffo;
                g.fillStyle = night ? "#d8cfe6" : "#ffffff"; g.fillRect(x - 3, l.base - l.h, 6, l.h);
                g.fillStyle = "rgba(0,0,0,.1)"; g.fillRect(x + 1, l.base - l.h, 2, l.h);
                if (night) Worlds.glow(g, x, l.base - l.h, l.r * 2.4, "#ffc8f0", 0.35);
                swirl(g, x, l.base - l.h, l.r, t * l.sp, l.c[0], l.c[1]);
            }
            if (lanterns.length) {                                                           // lantern strings (night)
                const y0 = H * 0.07, sag = H * 0.06;
                g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 1.2;
                g.beginPath(); for (let x = 0; x <= W; x += 20) { const q = x / W; g.lineTo(x, y0 + Math.sin(q * Math.PI) * sag); } g.stroke();
                for (const l of lanterns) {
                    const x = l.k * W, y = y0 + Math.sin(l.k * Math.PI) * sag + 8, a = 0.6 + 0.4 * Math.sin(t * 2 + l.ph);
                    Worlds.glow(g, x, y, 24, l.c, a);
                    g.fillStyle = l.c; g.beginPath(); g.ellipse(x, y, 5, 7, 0, 0, TAU); g.fill();
                    g.fillStyle = "rgba(255,255,255,.5)"; g.beginPath(); g.ellipse(x - 1.5, y - 2.5, 1.5, 2.5, 0, 0, TAU); g.fill();
                }
                for (const c of crystals) {
                    const q = Math.max(0, Math.sin(t * c.sp + c.tw)) ** 8;
                    if (q < 0.05) continue;
                    Worlds.glow(g, c.x - px * 9, c.y, 10 * q, "#ffc8f0", q * 0.7);
                    Worlds.glint(g, c.x - px * 9, c.y, 7 * q, q * 0.8, "#fff0ff");
                }
            }
            for (const sp of sprinkles) {                                                    // sprinkles drifting down
                sp.y += sp.sp * dt; sp.rot += sp.vr * dt;
                if (sp.y > H + 6) { sp.y = -6; sp.x = Math.random() * W; }
                g.save(); g.translate(sp.x + Math.sin(t + sp.ph) * 10 - px * 10, sp.y); g.rotate(sp.rot);
                g.globalAlpha = night ? 0.55 : 0.9; g.fillStyle = sp.c;
                g.beginPath(); g.roundRect(-4, -1.3, 8, 2.6, 1.3); g.fill();
                g.fillStyle = "rgba(255,255,255,.5)"; g.fillRect(-2.8, -1, 5.6, 0.75);
                g.restore();
            }
            g.globalAlpha = 1;
        }
    };
}
