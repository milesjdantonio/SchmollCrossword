// The CANDY HILLS world: a valley made of sweets.
//   Day: a pastel sky with cotton-candy clouds and a faint rainbow, glossy gumdrop hills, lollipop trees whose
//   swirls slowly turn, a candy-cane fence, a chocolate river with a wafer bridge, sprinkles drifting down and a
//   cupcake hot-air balloon floating by.
//   Night: a purple sky full of stars, a marshmallow moon, strings of glowing candy lanterns, and sugar crystals
//   that sparkle in the dark.
//   Board: each letter drops a candy into its square; finished words get a drip of frosting with sprinkles.
//   Win: a piñata swings in, takes three whacks, and bursts into a shower of candy and sprinkles.

(() => {
    const TAU = Math.PI * 2;
    const { tone, noise, midi } = Sound;
    const SPRINKLES = ["#ff5c8a", "#ffd23f", "#3ec1d3", "#7cdc5a", "#a26bff", "#ffffff", "#ff9f43"];

    const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };

    // a lollipop swirl of two colours, drawn at x,y with radius r, turned by angle a
    function swirl(g, x, y, r, a, c1, c2) {
        g.save();
        g.translate(x, y);
        g.rotate(a);
        g.fillStyle = c1;
        g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
        g.strokeStyle = c2;
        g.lineWidth = r * 0.22;
        g.lineCap = "round";
        g.beginPath();
        for (let i = 0; i <= 60; i++) { const k = i / 60, ang = k * TAU * 2.6, rr = k * r * 0.85; i ? g.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr) : g.moveTo(0, 0); }
        g.stroke();
        g.fillStyle = "rgba(255,255,255,.35)";
        g.beginPath(); g.ellipse(-r * 0.35, -r * 0.4, r * 0.28, r * 0.16, -0.6, 0, TAU); g.fill();
        g.restore();
    }

    // ---------------------------------------------------------------------------------------------
    // The background
    // ---------------------------------------------------------------------------------------------
    function scene(W, H, opts) {
        const night = opts.theme === "dark", preview = !!opts.preview;
        let hz, hills, river, bg = null, clouds, lollis, sprinkles, stars, lanterns, crystals, balloon = null, nextBalloon = preview ? 999 : U.rand(6, 14);
        const C = night
            ? { top: "#1b0f3a", mid: "#3b1d5e", low: "#6b2f6f", hill: ["#4a2a6b", "#5b2f73", "#6b3577"], river: "#2a140c", riverHi: "rgba(255,200,160,.15)", fence: 0.5 }
            : { top: "#a7d8ff", mid: "#ffd1ec", low: "#ffe9c7", hill: ["#ff9ec7", "#9be7c4", "#ffd47a"], river: "#6b3a22", riverHi: "rgba(255,220,180,.35)", fence: 1 };

        function setup() {
            hz = Math.round(H * 0.62);
            bg = null;
            const R = U.rng(1414);
            // glossy gumdrop hills in three rows, with a sugar sparkle
            hills = canvas(W + 80, H);
            {
                const g = hills.getContext("2d"), w = hills.width;
                [[0.5, 0], [0.58, 1], [0.66, 2]].forEach(([base, row]) => {
                    const n = 5 + row * 2;
                    for (let i = 0; i < n; i++) {
                        const cx = (i + 0.2 + R() * 0.6) / n * w, r = H * (0.12 - row * 0.02) * (0.8 + R() * 0.5), cy = H * base + r * 0.2;
                        const col = C.hill[(i + row) % 3];
                        const gr = g.createRadialGradient(cx - r * 0.3, cy - r * 0.5, r * 0.1, cx, cy, r);
                        gr.addColorStop(0, night ? "rgba(255,255,255,.18)" : "rgba(255,255,255,.75)");
                        gr.addColorStop(0.25, col);
                        gr.addColorStop(1, col);
                        g.fillStyle = gr;
                        g.beginPath(); g.ellipse(cx, cy, r * 1.25, r, 0, Math.PI, TAU); g.lineTo(cx + r * 1.25, H); g.lineTo(cx - r * 1.25, H); g.fill();
                        g.fillStyle = night ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.7)";            // sugar crystals
                        for (let k = 0; k < 14; k++) { const a = Math.PI + R() * Math.PI, d = R() * r; g.fillRect(cx + Math.cos(a) * d * 1.2, cy + Math.sin(a) * d * 0.9, 1.5, 1.5); }
                    }
                });
                // the candy-cane fence along the front
                const fy = H * 0.86;
                for (let x = -10; x < w; x += preview ? 14 : 22) {
                    g.save(); g.translate(x, fy); g.globalAlpha = C.fence;
                    g.fillStyle = "#ffffff"; g.fillRect(-3, -28, 6, 34);
                    g.fillStyle = "#e8344e";
                    for (let s = -26; s < 6; s += 8) { g.beginPath(); g.moveTo(-3, s); g.lineTo(3, s - 4); g.lineTo(3, s); g.lineTo(-3, s + 4); g.fill(); }
                    g.restore();
                }
                g.globalAlpha = 1;
                g.fillStyle = night ? "#c9b8e6" : "#ffffff"; g.fillRect(-10, fy - 22, w + 20, 4); g.fillRect(-10, fy - 8, w + 20, 4);
            }
            // the chocolate river, winding across the valley
            river = { y: H * 0.74, amp: H * 0.025 };
            clouds = Array.from({ length: preview ? 3 : 6 }, (_, i) => ({ x: R() * W, y: H * (0.06 + R() * 0.25), s: 0.6 + R() * 0.8, sp: 4 + R() * 7, c: i % 2 ? "#ffd6ef" : "#cfe9ff" }));
            lollis = Array.from({ length: preview ? 3 : 7 }, (_, i) => {
                const left = i % 2 === 0, fx = left ? R() * 0.17 : 0.83 + R() * 0.17;
                return { x: fx * W, base: H * (0.7 + R() * 0.12), h: H * (0.18 + R() * 0.12), r: H * (0.045 + R() * 0.03), sp: (R() < 0.5 ? -1 : 1) * (0.2 + R() * 0.4), c: [["#ff5c8a", "#ffffff"], ["#3ec1d3", "#ffe066"], ["#a26bff", "#ffd1ec"], ["#7cdc5a", "#ffffff"]][i % 4] };
            });
            sprinkles = Array.from({ length: preview ? 18 : 60 }, () => ({ x: R() * W, y: R() * H, sp: 20 + R() * 30, rot: R() * TAU, vr: (R() - 0.5) * 4, c: SPRINKLES[Math.floor(R() * SPRINKLES.length)], ph: R() * TAU }));
            stars = night ? Array.from({ length: preview ? 30 : 120 }, () => ({ x: R() * W, y: R() * hz * 0.8, r: 0.6 + R() * 1.4, tw: R() * TAU })) : [];
            lanterns = night ? Array.from({ length: preview ? 7 : 16 }, (_, i) => ({ k: (i + 0.5) / (preview ? 7 : 16), c: SPRINKLES[i % 5], ph: R() * TAU })) : [];
            crystals = night ? Array.from({ length: preview ? 10 : 40 }, () => ({ x: R() * W, y: H * (0.5 + R() * 0.5), tw: R() * TAU, sp: 0.8 + R() * 2 })) : [];
        }
        setup();

        function cloud(g, x, y, s, col) {
            g.fillStyle = col;
            for (const [dx, dy, r] of [[0, 0, 26], [24, -10, 30], [52, 0, 24], [28, 8, 24]]) { g.beginPath(); g.arc(x + dx * s, y + dy * s, r * s, 0, TAU); g.fill(); }
            g.fillStyle = "rgba(255,255,255,.5)";
            g.beginPath(); g.arc(x + 18 * s, y - 14 * s, 9 * s, 0, TAU); g.fill();
        }
        function drawBalloon(g, b, t) {
            g.save();
            g.translate(b.x, b.y + Math.sin(t * 0.8) * 10);
            g.scale(b.s, b.s);
            g.fillStyle = night ? "#c45b9a" : "#ff8fc2";                  // the frosting balloon
            g.beginPath(); g.arc(0, -40, 30, Math.PI, TAU); g.quadraticCurveTo(30, -10, 0, -2); g.quadraticCurveTo(-30, -10, -30, -40); g.fill();
            for (let i = 0; i < 7; i++) { g.fillStyle = SPRINKLES[i]; g.fillRect(-20 + i * 6.5, -52 + (i % 3) * 7, 4, 1.8); }
            g.fillStyle = "#e8344e"; g.beginPath(); g.arc(0, -72, 6, 0, TAU); g.fill();       // the cherry on top
            g.strokeStyle = "#7a4a2a"; g.lineWidth = 1.2;
            g.beginPath(); g.moveTo(-14, -6); g.lineTo(-10, 12); g.moveTo(14, -6); g.lineTo(10, 12); g.stroke();
            g.fillStyle = night ? "#8a5a3a" : "#c98b4f";                   // the cupcake basket
            g.beginPath(); g.moveTo(-13, 12); g.lineTo(13, 12); g.lineTo(10, 26); g.lineTo(-10, 26); g.fill();
            g.strokeStyle = "rgba(0,0,0,.15)"; for (let i = -9; i <= 9; i += 4) { g.beginPath(); g.moveTo(i, 13); g.lineTo(i * 0.8, 25); g.stroke(); }
            g.restore();
        }

        return {
            resize(w, h) { W = w; H = h; setup(); },
            draw(g, t, dt, inp) {
                if (!bg) {
                    bg = g.createLinearGradient(0, 0, 0, hz);
                    bg.addColorStop(0, C.top);
                    bg.addColorStop(0.6, C.mid);
                    bg.addColorStop(1, C.low);
                }
                g.fillStyle = bg;
                g.fillRect(0, 0, W, H);
                if (night) {
                    for (const s of stars) { g.fillStyle = `rgba(255,240,255,${(0.3 + 0.7 * Math.abs(Math.sin(t * 1.2 + s.tw))).toFixed(2)})`; g.fillRect(s.x - inp.px * 2, s.y, s.r, s.r); }
                    // the marshmallow moon
                    const mx = W * 0.8 - inp.px * 5, my = H * 0.16, mr = Math.min(W, H) * 0.06;
                    const mg = g.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 3.5);
                    mg.addColorStop(0, "rgba(255,230,250,.3)"); mg.addColorStop(1, "rgba(255,230,250,0)");
                    g.fillStyle = mg; g.fillRect(mx - mr * 3.5, my - mr * 3.5, mr * 7, mr * 7);
                    g.fillStyle = "#fff7fb"; g.beginPath(); g.roundRect(mx - mr, my - mr * 0.8, mr * 2, mr * 1.6, mr * 0.6); g.fill();
                    g.fillStyle = "rgba(255,210,235,.6)"; g.fillRect(mx - mr, my - mr * 0.15, mr * 2, mr * 0.3);
                } else {
                    // a faint rainbow and a soft sun
                    g.lineWidth = Math.min(W, H) * 0.018;
                    ["255,92,138", "255,159,67", "255,210,63", "124,220,90", "62,193,211", "162,107,255"].forEach((c, i) => {
                        g.strokeStyle = `rgba(${c},.18)`;
                        g.beginPath(); g.arc(W * 0.3 - inp.px * 4, hz, Math.min(W, H) * 0.42 - i * g.lineWidth, Math.PI, TAU); g.stroke();
                    });
                    const sg = g.createRadialGradient(W * 0.85, H * 0.12, 4, W * 0.85, H * 0.12, Math.min(W, H) * 0.2);
                    sg.addColorStop(0, "rgba(255,250,220,.95)"); sg.addColorStop(1, "rgba(255,240,200,0)");
                    g.fillStyle = sg; g.fillRect(0, 0, W, H * 0.5);
                }
                for (const cl of clouds) {
                    cl.x += cl.sp * dt; if (cl.x > W + 120) cl.x = -140;
                    cloud(g, cl.x - inp.px * 5, cl.y, cl.s * (preview ? 0.5 : 1), night ? "rgba(200,170,230,.35)" : cl.c);
                }
                // a cupcake hot-air balloon drifting by
                nextBalloon -= dt;
                if (!balloon && nextBalloon <= 0) balloon = { x: -60, y: H * U.rand(0.15, 0.35), vx: U.rand(18, 30), s: U.clamp(H / 900, 0.6, 1.2) };
                if (balloon) { balloon.x += balloon.vx * dt; drawBalloon(g, { ...balloon, x: balloon.x - inp.px * 6 }, t); if (balloon.x > W + 80) { balloon = null; nextBalloon = U.rand(20, 35); } }
                g.drawImage(hills, -40 - inp.px * 8, 0);
                // the chocolate river with flowing ripples, and a wafer bridge
                const ry = river.y;
                g.fillStyle = C.river;
                g.beginPath(); g.moveTo(0, ry);
                for (let x = 0; x <= W; x += 16) g.lineTo(x, ry + Math.sin(x * 0.008) * river.amp);
                for (let x = W; x >= 0; x -= 16) g.lineTo(x, ry + H * 0.05 + Math.sin(x * 0.008) * river.amp);
                g.fill();
                g.strokeStyle = C.riverHi; g.lineWidth = 2;
                for (let i = 0; i < 4; i++) {
                    g.beginPath();
                    for (let x = 0; x <= W; x += 16) { const y = ry + H * 0.012 * (i + 1) + Math.sin(x * 0.008) * river.amp + Math.sin(x * 0.05 - t * 2 + i) * 1.5; x ? g.lineTo(x, y) : g.moveTo(x, y); }
                    g.stroke();
                }
                const bx = W * 0.62 - inp.px * 10, bw = Math.max(70, W * 0.08);
                g.fillStyle = night ? "#8a6a3a" : "#e8c27a";
                g.fillRect(bx, ry - 6 + Math.sin(bx * 0.008) * river.amp, bw, H * 0.05 + 10);
                g.strokeStyle = night ? "rgba(0,0,0,.25)" : "rgba(160,110,40,.5)"; g.lineWidth = 1;
                for (let x = bx + 6; x < bx + bw; x += 8) { g.beginPath(); g.moveTo(x, ry - 6); g.lineTo(x, ry + H * 0.05 + 4); g.stroke(); }
                // lollipop trees, their swirls slowly turning
                for (const l of lollis) {
                    const x = l.x - inp.px * 14;
                    g.fillStyle = night ? "#d8cfe6" : "#ffffff"; g.fillRect(x - 3, l.base - l.h, 6, l.h);
                    if (night) { const gl = g.createRadialGradient(x, l.base - l.h, 0, x, l.base - l.h, l.r * 2.4); gl.addColorStop(0, "rgba(255,200,240,.35)"); gl.addColorStop(1, "rgba(255,200,240,0)"); g.fillStyle = gl; g.beginPath(); g.arc(x, l.base - l.h, l.r * 2.4, 0, TAU); g.fill(); }
                    swirl(g, x, l.base - l.h, l.r, t * l.sp, l.c[0], l.c[1]);
                }
                // strings of glowing candy lanterns (night)
                if (lanterns.length) {
                    const y0 = H * 0.08, sag = H * 0.06;
                    g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 1.2;
                    g.beginPath(); for (let x = 0; x <= W; x += 20) { const k = x / W; g.lineTo(x, y0 + Math.sin(k * Math.PI) * sag); } g.stroke();
                    g.globalCompositeOperation = "lighter";
                    for (const l of lanterns) {
                        const x = l.k * W, y = y0 + Math.sin(l.k * Math.PI) * sag + 8, a = 0.6 + 0.4 * Math.sin(t * 2 + l.ph);
                        const lg = g.createRadialGradient(x, y, 0, x, y, 22);
                        lg.addColorStop(0, l.c); lg.addColorStop(1, "rgba(0,0,0,0)");
                        g.globalAlpha = a; g.fillStyle = lg; g.beginPath(); g.arc(x, y, 22, 0, TAU); g.fill();
                        g.globalAlpha = 1; g.fillStyle = l.c; g.beginPath(); g.ellipse(x, y, 5, 7, 0, 0, TAU); g.fill();
                    }
                    g.globalCompositeOperation = "source-over";
                    for (const c of crystals) {
                        const k = Math.max(0, Math.sin(t * c.sp + c.tw)) ** 8;
                        if (k < 0.05) continue;
                        g.fillStyle = `rgba(255,230,255,${k.toFixed(2)})`;
                        g.fillRect(c.x - 2 * k - inp.px * 8, c.y - 0.5, 4 * k, 1); g.fillRect(c.x - 0.5 - inp.px * 8, c.y - 2 * k, 1, 4 * k);
                    }
                }
                // sprinkles drifting down
                for (const s of sprinkles) {
                    s.y += s.sp * dt; s.rot += s.vr * dt;
                    if (s.y > H + 6) { s.y = -6; s.x = Math.random() * W; }
                    g.save();
                    g.translate(s.x + Math.sin(t + s.ph) * 10 - inp.px * 10, s.y);
                    g.rotate(s.rot);
                    g.globalAlpha = night ? 0.55 : 0.9;
                    g.fillStyle = s.c;
                    g.beginPath(); g.roundRect(-4, -1.3, 8, 2.6, 1.3); g.fill();
                    g.restore();
                }
                g.globalAlpha = 1;
            }
        };
    }

    // ---------------------------------------------------------------------------------------------
    // The board: a candy in each typed square; frosting drips along finished words
    // ---------------------------------------------------------------------------------------------
    const CANDIES = [
        `<rect x="-.07" y="-.045" width=".14" height=".09" rx=".03" fill="#ff5c8a"/><path d="M-.07 0L-.12 -.045L-.12 .045Z M.07 0L.12 -.045L.12 .045Z" fill="#ff8fb0"/>`,
        `<path d="M-.07 .05Q-.08 -.07 0 -.08Q.08 -.07 .07 .05Z" fill="#7cdc5a"/><circle cx="-.02" cy="-.03" r=".012" fill="rgba(255,255,255,.7)"/>`,
        `<circle r=".075" fill="#ffffff"/><path d="M0 0L0 -.075A.075 .075 0 0 1 .065 -.037Z M0 0L.065 .037A.075 .075 0 0 1 0 .075Z M0 0L-.065 .037A.075 .075 0 0 1 -.065 -.037Z" fill="#e8344e"/>`,
        `<ellipse rx=".085" ry=".05" transform="rotate(-25)" fill="#a26bff"/><ellipse cx="-.03" cy="-.015" rx=".02" ry=".01" transform="rotate(-25)" fill="rgba(255,255,255,.6)"/>`,
        `<path d="M0 .07C-.09 0 -.07 -.07 0 -.035C.07 -.07 .09 0 0 .07Z" fill="#ffd23f"/>`
    ];
    const board = (() => {
        let layer = null, gC, gF, candies = new Map(), drips = new Map(), seed = 1, size = 5, quiet = true, boardRef = null;
        const rnd = (...k) => { let h = seed; for (const v of k) { h = Math.imul(h ^ v, 2654435761); h ^= h >>> 13; } return (h >>> 0) / 4294967296; };
        function build(game, boardEl) {
            if (layer) layer.remove();
            size = game.puzzle.size;
            seed = U.hash(game.puzzle.seed + game.puzzle.mode + "candy");
            boardRef = boardEl;
            layer = U.svg("svg", { class: "cd-layer", viewBox: `0 0 ${size} ${size}`, preserveAspectRatio: "none", "aria-hidden": "true" });
            boardEl.appendChild(layer);
            gF = U.svg("g", {}, layer);
            gC = U.svg("g", {}, layer);
            candies = new Map();
            drips = new Map();
        }
        function candy(r, c, grow) {
            const kind = Math.floor(rnd(r, c, 1) * CANDIES.length);
            const [ox, oy] = [[0.8, 0.22], [0.8, 0.79], [0.21, 0.8]][Math.floor(rnd(r, c, 2) * 3)];
            const x = c + ox + (rnd(r, c, 3) - 0.5) * 0.05, y = r + oy + (rnd(r, c, 4) - 0.5) * 0.05, rot = (rnd(r, c, 5) - 0.5) * 60;
            const outer = U.svg("g", { transform: `translate(${x.toFixed(3)} ${y.toFixed(3)}) rotate(${rot.toFixed(1)})`, class: "cd-candy" + (grow ? " pop" : "") }, gC);
            U.svg("g", { class: "cd-candy-in" }, outer).innerHTML = CANDIES[kind];
            return outer;
        }
        // frosting along the top edge of an across word (the left edge of a down word), with drips and sprinkles
        function frosting(entry, cells, grow) {
            const across = entry.direction === "across", [r0, c0] = cells[0], len = cells.length;
            const gEl = U.svg("g", { class: "cd-frost" + (grow ? " grow" : "") }, gF);
            let d = across ? `M${c0 + 0.04} ${r0}` : `M${c0} ${r0 + 0.04}`;
            const steps = len * 3;
            for (let i = 0; i < steps; i++) {
                const u0 = 0.04 + i / steps * (len - 0.08), u1 = 0.04 + (i + 1) / steps * (len - 0.08), um = (u0 + u1) / 2, drip = 0.05 + rnd(entry.number, i, across ? 1 : 2) * (rnd(entry.number, i, 9) < 0.3 ? 0.14 : 0.04);
                d += across ? ` Q${(c0 + um).toFixed(3)} ${(r0 + drip * 2).toFixed(3)} ${(c0 + u1).toFixed(3)} ${r0}` : ` Q${(c0 + drip * 2).toFixed(3)} ${(r0 + um).toFixed(3)} ${c0} ${(r0 + u1).toFixed(3)}`;
            }
            d += "Z";
            U.svg("path", { d, class: "cd-icing" }, gEl);
            for (let i = 0; i < len * 3; i++) {
                const u = 0.1 + rnd(entry.number, i, 5) * (len - 0.2), v = 0.015 + rnd(entry.number, i, 6) * 0.03;
                U.svg("rect", { x: (across ? c0 + u : c0 + v).toFixed(3), y: (across ? r0 + v : r0 + u).toFixed(3), width: ".045", height: ".014", rx: ".007",
                    fill: SPRINKLES[Math.floor(rnd(entry.number, i, 7) * SPRINKLES.length)], transform: `rotate(${Math.floor(rnd(entry.number, i, 8) * 180)} ${(across ? c0 + u : c0 + v).toFixed(3)} ${(across ? r0 + v : r0 + u).toFixed(3)})` }, gEl);
            }
            return gEl;
        }
        function attach() { quiet = true; }
        function update(game, boardEl) {
            if (!layer || !boardEl.contains(layer) || size !== game.puzzle.size) { build(game, boardEl); quiet = true; }
            const grow = !quiet && U.motion() !== "still";
            quiet = false;
            const n = game.puzzle.size, want = new Set();
            for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
                if (!game.letters[r][c]) continue;
                const key = r * 99 + c;
                want.add(key);
                if (!candies.has(key)) candies.set(key, candy(r, c, grow));
            }
            for (const [key, el] of candies) if (!want.has(key)) { el.remove(); candies.delete(key); }
            const full = new Set();
            for (const entry of [...game.puzzle.across, ...game.puzzle.down]) {
                const cells = Game.cellsOf(entry);
                if (!cells.every(([r, c]) => game.letters[r][c])) continue;
                const key = entry.direction + entry.number;
                full.add(key);
                if (!drips.has(key)) drips.set(key, frosting(entry, cells, grow));
            }
            for (const [key, el] of drips) if (!full.has(key)) { el.remove(); drips.delete(key); }
            boardEl.classList.toggle("cd-solved", !!(game.solved && !game.surrendered));
        }
        function type(cell) {
            const p = U.center(cell);
            FX.burst({ x: p.x, y: p.y, n: 8, colors: SPRINKLES, shape: "rect", speed: [60, 160], gravity: 420, drag: 1.5, life: [0.4, 0.7], size: [5, 7] });
        }
        function wordDone(entry, cells) {
            cells.forEach(([r, c], i) => setTimeout(() => {
                const cell = Game.cellEl(r, c);
                if (!cell) return;
                const p = U.center(cell);
                FX.burst({ x: p.x, y: p.y, n: 6, colors: ["#ff9ec7", "#ffffff", "#ffd23f"], shape: "star", speed: [40, 120], gravity: 200, life: [0.5, 0.8], size: [3, 5], spin: 4 });
            }, i * 60));
        }
        function restoreSolved(boardEl, game) { quiet = true; update(game, boardEl); }
        function clear() {
            if (layer) layer.remove();
            layer = null;
            candies = new Map();
            drips = new Map();
            if (boardRef) boardRef.classList.remove("cd-solved");
        }
        return { attach, update, type, wordDone, restoreSolved, reset: clear, clear };
    })();

    // ---------------------------------------------------------------------------------------------
    // The win: a piñata swings in, takes three whacks and bursts into candy
    // ---------------------------------------------------------------------------------------------
    const PINATA = `<svg viewBox="-70 -110 140 170" aria-hidden="true">
        <line x1="0" y1="-110" x2="0" y2="-46" stroke="#7a5a3a" stroke-width="3"/>
        <g class="cd-pinata-body">
            <path d="M-46 -40 L46 -40 L46 30 L-46 30 Z" fill="#ff5c8a"/>
            <path d="M-46 -40 L46 -40 L46 -24 L-46 -24 Z" fill="#ffd23f"/><path d="M-46 -24 L46 -24 L46 -8 L-46 -8 Z" fill="#3ec1d3"/>
            <path d="M-46 -8 L46 -8 L46 8 L-46 8 Z" fill="#7cdc5a"/><path d="M-46 8 L46 8 L46 24 L-46 24 Z" fill="#a26bff"/>
            <path d="M46 -40 L66 -56 L60 -30 Z" fill="#ff9f43"/><circle cx="34" cy="-30" r="4" fill="#2b1a3a"/>
            <path d="M-46 30 L-36 56 L-28 30 M-6 30 L2 56 L10 30 M22 30 L30 56 L38 30" fill="#ff5c8a"/>
            <path d="M-46 -10 L-66 -18 L-62 2 Z" fill="#ff9f43"/>
        </g></svg>`;

    async function celebrate(c, { boardEl }) {
        if (U.motion() === "still") return;
        const W = innerWidth, H = innerHeight, b = boardEl.getBoundingClientRect(), cx = b.left + b.width / 2;
        const overlay = document.getElementById("overlay");
        // 1. the piñata swings down into view above the board
        const pin = U.el("div", { class: "cd-pinata", html: PINATA, style: { left: cx - 70 + "px", top: Math.max(10, b.top - 60) + "px" } });
        overlay.appendChild(pin);
        FX.follow(c, boardEl, pin);
        c.cleanup(() => pin.remove());
        Sound.play("whoosh");
        pin.animate([{ transform: "translateY(-120vh) rotate(-20deg)" }, { transform: "translateY(10px) rotate(14deg)", offset: 0.6 }, { transform: "rotate(-8deg)", offset: 0.8 }, { transform: "none" }], { duration: 900, easing: "ease-out", fill: "backwards" });
        await c.wait(950);
        if (c.skipped) return;
        // 2. three whacks
        for (let i = 0; i < 3; i++) {
            Sound.play("whack");
            FX.shake(6 + i * 3, 220);
            const p = U.center(pin);
            FX.burst({ x: p.x, y: p.y, n: 10 + i * 6, colors: SPRINKLES, shape: "rect", speed: [100, 300], gravity: 500, life: [0.5, 0.9], size: [5, 8] });
            pin.animate([{ transform: "none" }, { transform: `rotate(${i % 2 ? -22 : 22}deg) scale(${1 - i * 0.04})` }, { transform: "none" }], { duration: 380, easing: "ease-out" });
            await c.wait(500);
            if (c.skipped) return;
        }
        // 3. it bursts!
        const p = U.center(pin);
        pin.classList.add("burst");
        Sound.play("burst");
        FX.flash("#ffe3f1", 400, 0.6);
        FX.ring({ x: p.x, y: p.y, color: "#ff9ec7", r1: Math.max(W, H) * 0.55, dur: 1, width: 18, glow: false });
        FX.burst({ x: p.x, y: p.y, n: 120, colors: SPRINKLES, shape: "rect", speed: [250, 750], gravity: 520, drag: 0.6, life: [1.6, 2.6], size: [6, 10] });
        FX.burst({ x: p.x, y: p.y, n: 40, colors: ["#ff5c8a", "#ffd23f", "#3ec1d3", "#a26bff"], shape: "star", speed: [200, 600], gravity: 500, life: [1.4, 2.2], size: [5, 9], spin: 6 });
        FX.burst({ x: p.x, y: p.y, n: 26, colors: ["#e0a060", "#ffb3d1"], shape: "acorn", speed: [200, 550], gravity: 600, life: [1.4, 2], size: [7, 10], spin: 8 });
        await c.wait(900);
        if (c.skipped) return;
        // 4. a sprinkle shower over everything
        FX.burst({ x: W / 2, y: -20, jitter: W / 2, jitterY: 10, n: 140, colors: SPRINKLES, shape: "rect", angle: Math.PI / 2, spread: 0.4, speed: [60, 200], gravity: 260, drag: 0.4, life: [2.4, 3.6], size: [5, 8], delay: [0, 1] });
        Sound.play("sparkle");
        await c.wait(2300);
    }

    // ---------------------------------------------------------------------------------------------
    // Title card: a wrapped candy spins in and unwraps
    // ---------------------------------------------------------------------------------------------
    async function titleCard(c, info) {
        const card = U.el("div", { class: "tc tc-candy", "aria-hidden": "true", html: `
            <div class="tcc-candy">
                <i class="tcc-twist l"></i>
                <div class="tcc-wrap"><small>&#127852; ${U.esc(info.kicker)} &#127852;</small><h2>${U.esc(info.title)}</h2><p>${U.esc(info.sub)}</p></div>
                <i class="tcc-twist r"></i>
            </div>` });
        document.getElementById("overlay").appendChild(card);
        c.cleanup(() => card.remove());
        Sound.play("title");
        await c.wait(700);
        if (c.skipped) return;
        const p = U.center(card.querySelector(".tcc-wrap"));
        FX.burst({ x: p.x, y: p.y, n: 30, colors: SPRINKLES, shape: "rect", speed: [150, 400], gravity: 400, life: [0.8, 1.2], size: [5, 8] });
        await c.wait(1300);
        if (c.skipped) return;
        card.classList.add("out");
        Sound.play("whoosh");
        await c.wait(450);
    }

    // ---------------------------------------------------------------------------------------------
    // The mascot: Gummy, a jiggly gummy bear
    // ---------------------------------------------------------------------------------------------
    function drawGummy(g, s) {
        const happy = s.mood === "happy", wow = s.mood === "wow", sad = s.mood === "sad";
        const jig = Math.sin(s.t * (happy ? 12 : 3)) * (happy ? 0.05 : 0.02) + s.hop * 0.08;
        g.save();
        g.translate(80, 140);
        g.scale(1 - jig, 1 + jig);                          // squash and stretch
        g.translate(0, -60 + Math.sin(s.t * 2) * 1.5 - s.hop * 10);
        const body = "rgba(232,52,78,.82)", edge = "#a81d33";
        const shine = (x, y, rx, ry) => { g.fillStyle = "rgba(255,255,255,.45)"; g.beginPath(); g.ellipse(x, y, rx, ry, -0.5, 0, TAU); g.fill(); };
        g.lineWidth = 2.5;
        g.strokeStyle = edge;
        g.fillStyle = body;
        // legs and arms (arms wave when happy)
        for (const side of [-1, 1]) {
            g.beginPath(); g.ellipse(side * 15, 50, 12, 10, 0, 0, TAU); g.fill(); g.stroke();
            g.save(); g.translate(side * 28, 14); g.rotate(side * (0.4 + (happy ? Math.sin(s.t * 10 + side) * 0.5 : 0)));
            g.beginPath(); g.ellipse(0, 8, 9, 13, 0, 0, TAU); g.fill(); g.stroke(); g.restore();
        }
        // body and belly
        g.beginPath(); g.ellipse(0, 26, 28, 30, 0, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = "rgba(255,160,170,.5)"; g.beginPath(); g.ellipse(0, 30, 16, 18, 0, 0, TAU); g.fill();
        shine(-12, 16, 6, 10);
        // head and ears
        g.fillStyle = body;
        for (const side of [-1, 1]) { g.beginPath(); g.arc(side * 20, -30, 9, 0, TAU); g.fill(); g.stroke(); }
        g.beginPath(); g.ellipse(0, -12, 28, 25, 0, 0, TAU); g.fill(); g.stroke();
        shine(-14, -24, 7, 4);
        // snout
        g.fillStyle = "rgba(255,170,180,.6)"; g.beginPath(); g.ellipse(0, -4, 12, 9, 0, 0, TAU); g.fill();
        g.fillStyle = "#5a0f1e"; g.beginPath(); g.ellipse(0, -8, 4, 3, 0, 0, TAU); g.fill();
        // eyes
        const ex = s.look * 3;
        for (const side of [-1, 1]) {
            const x = side * 10 + ex, y = -16;
            g.fillStyle = "#3a0a14";
            if (s.blink > 0.5) { g.fillRect(x - 4, y, 8, 2); continue; }
            if (happy) { g.lineWidth = 2.4; g.strokeStyle = "#3a0a14"; g.beginPath(); g.arc(x, y + 2, 4, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); g.strokeStyle = edge; g.lineWidth = 2.5; continue; }
            g.beginPath(); g.arc(x, y, wow ? 4.6 : 3.6, 0, TAU); g.fill();
            g.fillStyle = "#ffffff"; g.beginPath(); g.arc(x + 1.2, y - 1.2, 1.2, 0, TAU); g.fill();
        }
        // mouth
        const open = Math.max(s.talk, wow ? 0.7 : 0);
        g.strokeStyle = "#5a0f1e"; g.lineWidth = 2;
        if (open > 0.1) { g.fillStyle = "#5a0f1e"; g.beginPath(); g.ellipse(0, 2, 3.5, 1.5 + open * 3, 0, 0, TAU); g.fill(); }
        else { g.beginPath(); g.moveTo(-4, 0); g.quadraticCurveTo(0, sad ? -2 : 4, 4, 0); g.stroke(); }
        g.restore();
    }

    // ---------------------------------------------------------------------------------------------
    // Sounds: glockenspiel pings, boings and piñata whacks
    // ---------------------------------------------------------------------------------------------
    const glock = (t, n, v = 0.06) => { tone({ t, f: midi(n), type: "sine", d: 0.6, v, echo: 0.2 }); tone({ t, f: midi(n) * 3, type: "sine", d: 0.15, v: v * 0.3 }); };
    const sounds = {
        type: () => glock(0, U.pick([84, 86, 88, 91, 93]), 0.05),
        erase: () => tone({ f: 900, f2: 500, type: "triangle", d: 0.1, v: 0.05 }),
        move: () => {},
        word: () => [0, 4, 7, 12, 16].forEach((k, i) => glock(i * 0.06, 79 + k, 0.05)),
        wrong: () => tone({ f: 420, f2: 150, type: "sine", d: 0.4, v: 0.12, vib: 25 }),
        right: () => [0, 4, 7, 12, 16, 19].forEach((k, i) => glock(i * 0.05, 84 + k, 0.045)),
        reveal: () => { tone({ f: 600, f2: 1600, type: "sine", d: 0.3, v: 0.06 }); glock(0.2, 96, 0.04); },
        flip: () => glock(0, 96, 0.035),
        whack: () => { noise({ type: "lowpass", f: 900, d: 0.12, v: 0.4 }); tone({ f: 160, f2: 80, d: 0.15, v: 0.3 }); },
        burst: () => { noise({ type: "bandpass", f: 1800, f2: 400, d: 0.5, v: 0.35 }); [72, 76, 79, 84, 88, 91].forEach((n, i) => glock(0.1 + i * 0.05, n, 0.05)); },
        sparkle: () => [96, 100, 103, 108].forEach((n, i) => glock(i * 0.07, n, 0.03)),
        win: () => {},
        streak: () => [72, 79, 84, 88, 91].forEach((n, i) => glock(i * 0.06, n, 0.05)),
        achievement: () => { [84, 88, 91, 96].forEach((n, i) => glock(i * 0.08, n, 0.05)); tone({ t: 0.4, f: 300, f2: 600, type: "sine", d: 0.3, v: 0.06, vib: 20 }); },
        title: () => { tone({ f: 300, f2: 900, type: "sine", d: 0.35, v: 0.08, vib: 15 }); [79, 84, 88, 91].forEach((n, i) => glock(0.3 + i * 0.07, n, 0.05)); },
        tile: i => glock(0, 79 + (i % 8) * 2, 0.045),
        start: () => { tone({ f: 200, f2: 800, type: "sine", d: 0.4, v: 0.1, vib: 20 }); [72, 76, 79, 84, 88, 91].forEach((n, i) => glock(0.3 + i * 0.06, n, 0.05)); },
        select: () => glock(0, 96, 0.03),
        nav: () => { tone({ f: 500, f2: 900, type: "sine", d: 0.15, v: 0.05 }); glock(0.08, 91, 0.03); },
        mascot: () => tone({ f: 500, f2: 900, type: "sine", d: 0.18, v: 0.07, vib: 25 })
    };

    Worlds.register({
        id: "candy", name: "Candy Hills", icon: "\u{1F36D}", tagline: "Gumdrop hills & lollipop trees (candy lanterns at night)",
        modes: ["light", "dark"],
        scene, board, celebrate, titleCard, sounds, transition: "frosting",
        mascot: { name: "GUMMY", draw: drawGummy },
        lines: {
            hello: ["Hi, I'm Gummy! Let's make today extra sweet.", "Welcome to Candy Hills! Fresh puzzles, no cavities.", "Ready for a sugar rush of words?"],
            start: ["Tap a square and start typing. Space flips Across and Down!", "Every letter earns a candy. Fill the board!"],
            word: ["Sweet!", "Mint condition!", "So sweet!", "Treat yourself!", "Gum-believable!", "Icing on the cake!"],
            win: ["Piñata time! You did it!", "That was a sweet solve!", "You're one smart cookie!"],
            wrong: ["Hmm, a few of those are a bit sour.", "Some letters need a little more sugar."],
            right: ["Sweet as can be!", "All sugar, no spice!"],
            idle: ["Stuck? Try a crossing word, it's a piece of cake.", "Take a candy break, then try the shortest clue!"],
            reveal: ["Here's a little treat...", "Sprinkling in a hint!"]
        },
        introFlourish(stage) {
            const p = U.center(stage);
            FX.ring({ x: p.x, y: p.y, color: "#ff9ec7", r1: Math.max(innerWidth, innerHeight) * 0.6, dur: 1.2, width: 16, glow: false });
            FX.burst({ x: p.x, y: p.y, n: 110, colors: SPRINKLES, shape: "rect", speed: [200, 700], gravity: 300, drag: 1, life: [1.4, 2.4], size: [6, 9] });
        }
    });
})();
