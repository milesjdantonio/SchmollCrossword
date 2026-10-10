// The HAUNTED LIBRARY world: an old library where the books have a mind of their own.
//   Day: a sunny reading room, light pouring through a stained-glass window in coloured beams, dust motes
//   drifting in the light, tall bookcases on both sides, and now and then a book flapping across the room.
//   Night: the same room at midnight: moonlight through the window, floating candles that bob and flicker,
//   ghostly wisps, and a friendly ghost drifting past.
//   Board: each letter leaves a little library keepsake in its square (an ink drop, a bookmark, a key, a quill,
//   a wax seal, a star sticker); finished words are underlined in wavy hand-drawn ink.
//   Win: the shelves rumble, books fly off them and circle the board, then burst into a flurry of pages.

(() => {
    const TAU = Math.PI * 2;
    const { tone, noise, midi } = Sound;
    const SPINES = ["#7a1f2b", "#1f4a7a", "#2f6a3a", "#8a5a1a", "#4a2a6a", "#a8442a", "#2a5a5a", "#6a4a2a"];
    const GLASS = ["rgba(200,60,70,.45)", "rgba(60,110,200,.45)", "rgba(240,190,60,.5)", "rgba(70,160,90,.45)", "rgba(150,80,190,.45)"];
    const dark = () => document.documentElement.dataset.theme === "dark";

    // ---------------------------------------------------------------------------------------------
    // The background
    // ---------------------------------------------------------------------------------------------
    function scene(W, H, opts) {
        const night = opts.theme === "dark", preview = !!opts.preview;
        let back, shelves, glow, wisp, motes, candles, wisps, win, event = null, nextEvent = preview ? 999 : U.rand(5, 10);

        function setup() {
            const R = U.rng(5150);
            // the window: arched, with stained glass (day) or moonlit sky (night)
            const ww = Math.min(W * 0.26, 320), wh = Math.min(H * 0.5, ww * 1.7);
            win = { x: W / 2 - ww / 2, y: H * 0.08, w: ww, h: wh };
            back = Worlds.canvas(W + 40, H);
            {
                const g = back.getContext("2d");
                const wall = g.createLinearGradient(0, 0, 0, H);
                if (night) { wall.addColorStop(0, "#151026"); wall.addColorStop(0.7, "#221838"); wall.addColorStop(1, "#120c1e"); }
                else { wall.addColorStop(0, "#e9dcc0"); wall.addColorStop(0.7, "#ddc9a3"); wall.addColorStop(1, "#c9ad80"); }
                g.fillStyle = wall;
                g.fillRect(0, 0, W + 40, H);
                // wallpaper stripes
                g.fillStyle = night ? "rgba(255,255,255,.025)" : "rgba(120,80,30,.06)";
                for (let x = 0; x < W + 40; x += 36) g.fillRect(x, 0, 14, H * 0.86);
                // wainscoting along the bottom
                g.fillStyle = night ? "#1c1228" : "#9a6a3c";
                g.fillRect(0, H * 0.72, W + 40, H * 0.16);
                g.strokeStyle = night ? "rgba(255,255,255,.06)" : "rgba(60,30,10,.25)";
                g.lineWidth = 2;
                for (let x = 10; x < W + 40; x += 90) g.strokeRect(x, H * 0.74, 70, H * 0.12);
                // the floor
                const fl = g.createLinearGradient(0, H * 0.86, 0, H);
                fl.addColorStop(0, night ? "#2a1a14" : "#7a4a24"); fl.addColorStop(1, night ? "#140c08" : "#4a2a12");
                g.fillStyle = fl;
                g.fillRect(0, H * 0.86, W + 40, H * 0.14);
                g.strokeStyle = "rgba(0,0,0,.2)"; g.lineWidth = 1;
                for (let x = 0; x < W + 40; x += 48) { g.beginPath(); g.moveTo(x, H * 0.86); g.lineTo(x - 30, H); g.stroke(); }
                // a round rug
                g.fillStyle = night ? "rgba(90,30,60,.6)" : "rgba(150,40,50,.65)";
                g.beginPath(); g.ellipse(W / 2 + 20, H * 0.94, W * 0.22, H * 0.035, 0, 0, TAU); g.fill();
                g.strokeStyle = night ? "rgba(220,180,90,.35)" : "rgba(240,200,110,.7)"; g.lineWidth = 2;
                g.beginPath(); g.ellipse(W / 2 + 20, H * 0.94, W * 0.19, H * 0.026, 0, 0, TAU); g.stroke();
                // the window
                const { x, y, w, h } = win, X = x + 20, arch = w / 2;
                const shape = () => { g.beginPath(); g.moveTo(X, y + arch); g.arc(X + arch, y + arch, arch, Math.PI, TAU); g.lineTo(X + w, y + h); g.lineTo(X, y + h); g.closePath(); };
                g.save();
                shape(); g.clip();
                if (night) {
                    const sky = g.createLinearGradient(0, y, 0, y + h);
                    sky.addColorStop(0, "#0a1030"); sky.addColorStop(1, "#1f2a5a");
                    g.fillStyle = sky; g.fillRect(X, y, w, h);
                    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${(0.3 + R() * 0.6).toFixed(2)})`; g.fillRect(X + R() * w, y + R() * h, 1.4, 1.4); }
                    const mx = X + w * 0.62, my = y + h * 0.3, mr = w * 0.14;
                    const mg = g.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 3);
                    mg.addColorStop(0, "rgba(220,230,255,.45)"); mg.addColorStop(1, "rgba(220,230,255,0)");
                    g.fillStyle = mg; g.fillRect(X, y, w, h);
                    g.fillStyle = "#f2f0e2"; g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill();
                    g.fillStyle = "rgba(180,180,170,.35)"; g.beginPath(); g.arc(mx - mr * 0.3, my - mr * 0.2, mr * 0.22, 0, TAU); g.arc(mx + mr * 0.3, my + mr * 0.3, mr * 0.15, 0, TAU); g.fill();
                } else {
                    g.fillStyle = "#bfe0ff"; g.fillRect(X, y, w, h);
                    // stained glass: coloured panes in a diamond pattern
                    const s = w / 6;
                    for (let gy = y - s; gy < y + h + s; gy += s) for (let gx = X - s; gx < X + w + s; gx += s) {
                        g.fillStyle = GLASS[Math.floor(R() * GLASS.length)];
                        g.beginPath(); g.moveTo(gx + s / 2, gy); g.lineTo(gx + s, gy + s / 2); g.lineTo(gx + s / 2, gy + s); g.lineTo(gx, gy + s / 2); g.fill();
                    }
                    const rose = g.createRadialGradient(X + arch, y + arch, 2, X + arch, y + arch, arch * 0.8);
                    rose.addColorStop(0, "rgba(255,250,210,.95)"); rose.addColorStop(1, "rgba(255,250,210,0)");
                    g.fillStyle = rose; g.fillRect(X, y, w, h);
                }
                g.restore();
                // lead lines and the stone frame
                g.strokeStyle = night ? "#3a2e4a" : "#5a4630"; g.lineWidth = 3;
                g.beginPath(); g.moveTo(X + w / 2, y); g.lineTo(X + w / 2, y + h); g.moveTo(X, y + h * 0.55); g.lineTo(X + w, y + h * 0.55); g.stroke();
                g.lineWidth = Math.max(8, w * 0.05); g.strokeStyle = night ? "#2c2238" : "#8a7458";
                shape(); g.stroke();
                g.fillStyle = night ? "#2c2238" : "#8a7458"; g.fillRect(X - 14, y + h, w + 28, 12);
            }
            // two tall bookcases full of books
            shelves = Worlds.canvas(W + 80, H);
            {
                const g = shelves.getContext("2d"), caseW = Math.max(80, W * 0.11), gap = Math.max(54, H * 0.13);
                for (const left of [true, false]) {
                    const x0 = left ? 0 : W + 80 - caseW, top = H * 0.06;
                    const wood = g.createLinearGradient(x0, 0, x0 + caseW, 0);
                    wood.addColorStop(0, night ? "#24140e" : "#5a3418"); wood.addColorStop(0.5, night ? "#341e14" : "#7a4a24"); wood.addColorStop(1, night ? "#24140e" : "#5a3418");
                    g.fillStyle = wood;
                    g.fillRect(x0, top, caseW, H * 0.86 - top);
                    g.fillStyle = night ? "#120a08" : "#2e1a0c";
                    for (let y = top + 14; y + gap < H * 0.86; y += gap) {
                        g.fillRect(x0 + 10, y, caseW - 20, gap - 10);              // the shadowy back of the shelf
                        // books standing on the shelf
                        let bx = x0 + 12;
                        while (bx < x0 + caseW - 22) {
                            const bw = 7 + R() * 11, bh = (gap - 14) * (0.62 + R() * 0.34), lean = R() < 0.08;
                            if (R() < 0.06) { bx += bw; continue; }                // a gap where a book is missing
                            const col = SPINES[Math.floor(R() * SPINES.length)];
                            g.save();
                            g.translate(bx, y + gap - 10);
                            if (lean) g.rotate(0.18);
                            g.fillStyle = col;
                            g.fillRect(0, -bh, bw, bh);
                            g.fillStyle = night ? "rgba(0,0,0,.45)" : "rgba(0,0,0,.15)"; g.fillRect(bw - 2, -bh, 2, bh);
                            g.fillStyle = night ? "rgba(220,180,90,.35)" : "rgba(240,200,110,.85)";      // gold bands
                            g.fillRect(1, -bh + 5, bw - 2, 1.5); g.fillRect(1, -10, bw - 2, 1.5);
                            if (bw > 12) g.fillRect(bw / 2 - 2, -bh / 2 - 6, 4, 12);
                            g.restore();
                            bx += bw + (lean ? 5 : 0.5);
                        }
                        g.fillStyle = night ? "#3a2418" : "#8a5a2e";
                        g.fillRect(x0 + 6, y + gap - 10, caseW - 12, 7);             // the shelf board
                    }
                    g.fillStyle = night ? "#3a2418" : "#8a5a2e";
                    g.fillRect(x0 - 4, top - 10, caseW + 8, 14);                     // the crown on top
                }
            }
            // soft glow sprites, built once
            glow = Worlds.canvas(64, 64);
            {
                const g = glow.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
                gr.addColorStop(0, night ? "rgba(255,200,110,.9)" : "rgba(255,250,220,.9)"); gr.addColorStop(0.4, night ? "rgba(255,160,60,.28)" : "rgba(255,240,200,.3)"); gr.addColorStop(1, "rgba(255,160,60,0)");
                g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
            }
            // a ghostly wisp, drawn once and stretched into an oval when used
            wisp = Worlds.canvas(64, 64);
            { const g = wisp.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(170,230,210,.10)"); gr.addColorStop(1, "rgba(170,230,210,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }
            motes = Array.from({ length: preview ? 20 : 70 }, () => ({ x: R() * W, y: R() * H, s: 0.6 + R() * 1.6, sp: 3 + R() * 8, ph: R() * TAU }));
            candles = night ? Array.from({ length: preview ? 5 : 11 }, (_, i) => ({ x: W * (0.12 + (i + R() * 0.6) / (preview ? 5 : 11) * 0.76), y: H * (0.12 + R() * 0.42), h: 16 + R() * 18, ph: R() * TAU, z: 0.6 + R() * 0.6 })) : [];
            wisps = night ? Array.from({ length: preview ? 3 : 6 }, () => ({ x: R() * W, y: H * (0.3 + R() * 0.5), sp: 6 + R() * 10, ph: R() * TAU, r: 30 + R() * 50 })) : [];
        }
        setup();

        // a book flapping its covers like wings
        function flyingBook(g, x, y, s, t, col) {
            const flap = Math.sin(t * 9) * 0.9;
            g.save(); g.translate(x, y); g.scale(s, s);
            for (const side of [-1, 1]) {
                g.fillStyle = col;
                g.beginPath(); g.moveTo(0, -12); g.lineTo(side * 26, -12 - flap * 14); g.lineTo(side * 26, 12 - flap * 14); g.lineTo(0, 12); g.fill();
                g.fillStyle = "#f4ead0";
                g.beginPath(); g.moveTo(0, -10); g.lineTo(side * 22, -10 - flap * 11); g.lineTo(side * 22, 10 - flap * 11); g.lineTo(0, 10); g.fill();
            }
            g.restore();
        }
        // a friendly ghost
        function ghost(g, x, y, s, t, a) {
            g.save(); g.translate(x, y); g.scale(s, s); g.globalAlpha = a;
            g.fillStyle = "#eef2ff";
            g.beginPath(); g.arc(0, -10, 24, Math.PI, TAU); g.lineTo(24, 22);
            for (let i = 0; i <= 4; i++) g.lineTo(24 - i * 12, 22 + (i % 2 ? -6 : 6) + Math.sin(t * 6 + i) * 3);
            g.closePath(); g.fill();
            g.fillStyle = "#2a2440";
            g.beginPath(); g.ellipse(-8, -12, 3.5, 5, 0, 0, TAU); g.ellipse(8, -12, 3.5, 5, 0, 0, TAU); g.fill();
            g.beginPath(); g.ellipse(0, 2, 4, 3 + Math.sin(t * 3), 0, 0, TAU); g.fill();
            g.restore(); g.globalAlpha = 1;
        }

        return {
            resize(w, h) { W = w; H = h; setup(); },
            draw(g, t, dt, inp) {
                g.drawImage(back, -20 - inp.px * 4, 0);
                const wx = win.x - inp.px * 4 + win.w / 2;
                if (!night) {
                    // coloured beams of light slanting down from the window
                    for (let i = 0; i < 4; i++) {
                        const a = (0.07 + 0.03 * Math.sin(t * 0.6 + i)) * (preview ? 1.2 : 1);
                        const x0 = wx - win.w * 0.4 + i * win.w * 0.27, y0 = win.y + win.h * 0.4;
                        const bg = g.createLinearGradient(x0, y0, x0 - W * 0.25, H);
                        bg.addColorStop(0, `rgba(255,${[230, 240, 220, 245][i]},${[200, 170, 230, 190][i]},${a.toFixed(3)})`); bg.addColorStop(1, "rgba(255,240,200,0)");
                        g.fillStyle = bg;
                        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + win.w * 0.2, y0); g.lineTo(x0 + win.w * 0.2 - W * 0.22, H); g.lineTo(x0 - W * 0.3, H); g.fill();
                    }
                } else {
                    const mg = g.createLinearGradient(wx, win.y, wx - W * 0.2, H);   // moonlight on the floor
                    mg.addColorStop(0, "rgba(160,180,255,.10)"); mg.addColorStop(1, "rgba(160,180,255,0)");
                    g.fillStyle = mg;
                    g.beginPath(); g.moveTo(wx - win.w / 2, win.y + win.h); g.lineTo(wx + win.w / 2, win.y + win.h); g.lineTo(wx + win.w * 0.1 - W * 0.12, H); g.lineTo(wx - win.w - W * 0.18, H); g.fill();
                }
                g.drawImage(shelves, -40 - inp.px * 10, 0);
                // ghostly wisps drifting (night)
                for (const w of wisps) {
                    w.x += w.sp * dt; if (w.x > W + w.r * 2) w.x = -w.r * 2;
                    const y = w.y + Math.sin(t * 0.7 + w.ph) * 20;
                    g.drawImage(wisp, w.x - inp.px * 14 - w.r * 1.6, y - w.r * 0.6, w.r * 3.2, w.r * 1.2);
                }
                // floating candles, bobbing and flickering (night)
                for (const c of candles) {
                    const x = c.x - inp.px * 18 * c.z, y = c.y + Math.sin(t * 1.1 + c.ph) * 8, s = c.z;
                    const fl = 0.85 + 0.15 * Math.sin(t * 13 + c.ph) * Math.sin(t * 7.3 + c.ph * 2);
                    g.globalCompositeOperation = "lighter";
                    g.globalAlpha = 0.8 * fl;
                    g.drawImage(glow, x - 40 * s, y - 40 * s - c.h * s, 80 * s, 80 * s);
                    g.globalAlpha = 1;
                    g.globalCompositeOperation = "source-over";
                    g.fillStyle = "#efe6cf"; g.fillRect(x - 3.5 * s, y - c.h * s, 7 * s, c.h * s);
                    g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(x + 1.5 * s, y - c.h * s, 2 * s, c.h * s);
                    g.fillStyle = "#ffd36b";
                    g.beginPath(); g.ellipse(x + Math.sin(t * 9 + c.ph) * 0.8, y - c.h * s - 5 * s * fl, 2.6 * s, 5.5 * s * fl, 0, 0, TAU); g.fill();
                    g.fillStyle = "#fff6d8"; g.beginPath(); g.ellipse(x, y - c.h * s - 3.5 * s, 1.1 * s, 2.4 * s, 0, 0, TAU); g.fill();
                }
                // dust motes drifting in the light (or glowing faintly at night)
                for (const m of motes) {
                    m.y -= m.sp * dt * 0.4; m.x += Math.sin(t * 0.5 + m.ph) * dt * 4;
                    if (m.y < -4) { m.y = H + 4; m.x = Math.random() * W; }
                    const a = night ? 0.25 + 0.25 * Math.sin(t * 2 + m.ph) : 0.35 + 0.3 * Math.sin(t * 1.5 + m.ph);
                    g.fillStyle = night ? `rgba(180,255,220,${a.toFixed(2)})` : `rgba(255,248,220,${a.toFixed(2)})`;
                    g.beginPath(); g.arc(m.x - inp.px * 22, m.y, m.s, 0, TAU); g.fill();
                }
                // now and then: a book flaps across the room (day) or a ghost floats by (night)
                nextEvent -= dt;
                if (!event && nextEvent <= 0) event = { x: -60, y: H * U.rand(0.18, 0.5), vx: U.rand(50, 90), s: U.clamp(H / 900, 0.6, 1.2), col: U.pick(SPINES) };
                if (event) {
                    event.x += event.vx * dt;
                    const y = event.y + Math.sin(t * 2) * 18;
                    if (night) ghost(g, event.x - inp.px * 16, y, event.s, t, 0.55);
                    else flyingBook(g, event.x - inp.px * 16, y, event.s, t, event.col);
                    if (event.x > W + 80) { event = null; nextEvent = U.rand(14, 26); }
                }
            }
        };
    }

    // ---------------------------------------------------------------------------------------------
    // The board: a keepsake in each typed square; finished words underlined in wavy ink
    // ---------------------------------------------------------------------------------------------
    const KEEPSAKES = [
        r => `<path d="M0 -.07C.05 -.01 .06 .03 .04 .055C.02 .08 -.02 .08 -.04 .055C-.06 .03 -.05 -.01 0 -.07Z" class="lb-ink"/><circle cx="-.015" cy=".035" r=".012" fill="rgba(255,255,255,.5)"/>`,
        r => `<path d="M-.03 -.08H.03V.07L0 .045L-.03 .07Z" fill="${["#c0392b", "#2e6db4", "#2f8a4a"][Math.floor(r(1) * 3)]}"/>`,
        r => `<circle cx="-.045" r=".028" fill="none" stroke="#c99a2e" stroke-width=".016"/><path d="M-.017 0H.07M.045 0V.025M.06 0V.02" stroke="#c99a2e" stroke-width=".016" fill="none"/>`,
        r => `<path d="M-.07 .07Q-.02 -.02 .07 -.08Q.04 .01 -.04 .05Z" fill="#f4ead0" stroke="#7a6a50" stroke-width=".008"/><path d="M-.07 .07L.04 -.05" stroke="#7a6a50" stroke-width=".008"/>`,
        r => `<circle r=".055" fill="#a8222e"/><circle r=".034" fill="none" stroke="rgba(255,200,200,.5)" stroke-width=".008"/><path d="M-.012 -.016L.012 .016M.012 -.016L-.012 .016" stroke="rgba(255,200,200,.6)" stroke-width=".008"/>`,
        r => `<path d="M0 -.06L.017 -.02L.06 -.018L.027 .01L.037 .052L0 .03L-.037 .052L-.027 .01L-.06 -.018L-.017 -.02Z" fill="#e8b830" stroke="#a87a10" stroke-width=".006"/>`
    ];
    const board = Worlds.decoBoard({
        id: "lb",
        mark: r => KEEPSAKES[Math.floor(r(0) * KEEPSAKES.length)](r),
        word(entry, cells, rnd, g, across) {
            const [r0, c0] = cells[0], len = cells.length;
            let d = "";
            const steps = len * 4;
            for (let i = 0; i <= steps; i++) {
                const u = 0.08 + i / steps * (len - 0.16), wob = Math.sin(i * 1.7 + rnd(1) * 6) * 0.03 + (rnd(i, 2) - 0.5) * 0.015;
                const x = across ? c0 + u : c0 + 0.92 + wob, y = across ? r0 + 0.92 + wob : r0 + u;
                d += (i ? "L" : "M") + x.toFixed(3) + " " + y.toFixed(3);
            }
            U.svg("path", { d, class: "lb-line", pathLength: "1" }, g);
        },
        type(cell) {
            const p = U.center(cell);
            FX.burst({ x: p.x, y: p.y, n: 6, colors: dark() ? ["#b6ffe0", "#e0d0ff"] : ["#2a1a10", "#4a3020"], shape: "circle", speed: [30, 110], gravity: dark() ? -60 : 260, life: [0.35, 0.6], size: [1.5, 3] });
        },
        wordDone(entry, cells) {
            cells.forEach(([r, c], i) => setTimeout(() => {
                const cell = Game.cellEl(r, c);
                if (!cell) return;
                const p = U.center(cell);
                FX.burst({ x: p.x, y: p.y, n: 4, colors: ["#f6ecd2", "#efe2c2"], shape: "rect", speed: [40, 120], gravity: -40, drag: 1.2, life: [0.7, 1.1], size: [7, 10] });
            }, i * 70));
        }
    });

    // ---------------------------------------------------------------------------------------------
    // The win: the shelves rumble, books fly off and circle the board, then burst into pages
    // ---------------------------------------------------------------------------------------------
    async function celebrate(c, { boardEl }) {
        if (U.motion() === "still") return;
        const W = innerWidth, H = innerHeight, b = boardEl.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
        const overlay = document.getElementById("overlay");
        // 1. a rumble
        Sound.play("rumble");
        FX.shake(7, 700);
        await c.wait(650);
        if (c.skipped) return;
        // 2. books fly in from both sides and circle the board
        const books = [];
        const n = U.motion() === "lite" ? 6 : 10, R = Math.max(b.width, b.height) * 0.68;
        for (let i = 0; i < n; i++) {
            const book = U.el("div", { class: "lb-book", style: { "--c": SPINES[i % SPINES.length], left: cx - 30 + "px", top: cy - 20 + "px" }, html: "<i></i><i></i>" });
            overlay.appendChild(book);
            books.push(book);
            const from = i % 2 ? W * 0.75 : -W * 0.75, a0 = i / n * TAU;
            const frames = [{ transform: `translate(${from}px, ${(i / n - 0.5) * H * 0.6}px) scale(.6)` }];
            for (let k = 1; k <= 6; k++) { const a = a0 + k / 6 * Math.PI * 1.4; frames.push({ transform: `translate(${(Math.cos(a) * R).toFixed(0)}px, ${(Math.sin(a) * R * 0.75).toFixed(0)}px) scale(${(0.9 + 0.2 * Math.sin(a)).toFixed(2)})` }); }
            book.animate(frames, { duration: 1900, delay: i * 70, easing: "ease-in-out", fill: "both" });
        }
        c.cleanup(() => books.forEach(bk => bk.remove()));
        FX.follow(c, boardEl, ...books);
        Sound.play("flutter");
        c.later(() => Sound.play("flutter"), 700);
        await c.wait(2000);
        if (c.skipped) return;
        // 3. they swoop to the middle and burst into pages
        books.forEach(bk => bk.animate([{ opacity: 1 }, { transform: "translate(0, 0) scale(.2)", opacity: 0 }], { duration: 350, easing: "ease-in", fill: "forwards" }));
        await c.wait(330);
        if (c.skipped) return;
        Sound.play("burst");
        FX.flash(dark() ? "#d8c8ff" : "#fff6dc", 450, 0.55);
        FX.ring({ x: cx, y: cy, color: dark() ? "#b6ffe0" : "#c99a2e", r1: Math.max(W, H) * 0.6, dur: 1.1, width: 14, glow: dark() });
        FX.burst({ x: cx, y: cy, n: 90, colors: ["#f6ecd2", "#efe2c2", "#fffaf0"], shape: "rect", speed: [200, 650], gravity: 160, drag: 1.1, life: [1.8, 2.8], size: [9, 14] });
        FX.burst({ x: cx, y: cy, n: 30, colors: ["#e8b830", "#ffffff", dark() ? "#b6ffe0" : "#c0392b"], shape: "star", speed: [150, 450], gravity: 120, life: [1.2, 2], size: [4, 8], spin: 5 });
        await c.wait(900);
        if (c.skipped) return;
        // 4. pages drift down over everything
        FX.burst({ x: W / 2, y: -30, jitter: W / 2, jitterY: 10, n: 50, colors: ["#f6ecd2", "#efe2c2"], shape: "rect", angle: Math.PI / 2, spread: 0.3, speed: [30, 90], gravity: 60, drag: 0.6, life: [2.8, 3.8], size: [9, 13], delay: [0, 1.2] });
        Sound.play("sparkle");
        await c.wait(2200);
    }

    // ---------------------------------------------------------------------------------------------
    // Title card: a leather-bound book swings its cover open
    // ---------------------------------------------------------------------------------------------
    async function titleCard(c, info) {
        const card = U.el("div", { class: "tc tc-library", "aria-hidden": "true", html: `
            <div class="tcl-book">
                <div class="tcl-page"><small>${U.esc(info.kicker)}</small><h2>${U.esc(info.title)}</h2><p>${U.esc(info.sub)}</p><i class="tcl-orn">~ &#10022; ~</i></div>
                <div class="tcl-cover"><b>&#10086;</b></div>
            </div>` });
        document.getElementById("overlay").appendChild(card);
        c.cleanup(() => card.remove());
        Sound.play("title");
        await c.wait(1900);
        if (c.skipped) return;
        card.classList.add("out");
        Sound.play("whoosh");
        await c.wait(450);
    }

    // ---------------------------------------------------------------------------------------------
    // The mascot: Boo, a ghost librarian in round glasses
    // ---------------------------------------------------------------------------------------------
    function drawBoo(g, s) {
        const happy = s.mood === "happy", wow = s.mood === "wow", sad = s.mood === "sad";
        g.save();
        g.translate(80, 78 + Math.sin(s.t * 2) * 5 - s.hop * 10);
        g.rotate(Math.sin(s.t * 1.3) * 0.05);
        // the soft glow around the ghost
        const gl = g.createRadialGradient(0, 0, 10, 0, 0, 70);
        gl.addColorStop(0, "rgba(200,220,255,.35)"); gl.addColorStop(1, "rgba(200,220,255,0)");
        g.fillStyle = gl; g.beginPath(); g.arc(0, 0, 70, 0, TAU); g.fill();
        // the body with a wavy tail
        g.fillStyle = "rgba(246,248,255,.96)";
        g.strokeStyle = "#9aa4c8";
        g.lineWidth = 2.5;
        g.beginPath();
        g.arc(0, -8, 38, Math.PI, TAU);
        g.lineTo(38, 40);
        for (let i = 1; i <= 6; i++) { const x = 38 - i * (76 / 6), y = 40 + (i % 2 ? 10 : -2) + Math.sin(s.t * 5 + i) * 4; g.quadraticCurveTo(x + 76 / 12, y + 8 * (i % 2 ? 1 : -0.4), x, y); }
        g.closePath();
        g.fill(); g.stroke();
        // arms: little nubs; one waves when happy
        for (const side of [-1, 1]) {
            g.save(); g.translate(side * 36, 14); g.rotate(side * (0.5 + (happy && side > 0 ? Math.sin(s.t * 10) * 0.6 - 0.6 : 0)));
            g.beginPath(); g.ellipse(side * 6, 0, 12, 7, 0, 0, TAU); g.fill(); g.stroke(); g.restore();
        }
        // a little book held in front
        g.fillStyle = "#7a1f2b"; g.fillRect(-14, 18, 28, 20);
        g.fillStyle = "#f4ead0"; g.fillRect(-12, 20, 24, 3);
        g.fillStyle = "#e8b830"; g.fillRect(-3, 25, 6, 8);
        // eyes behind round glasses
        const ex = s.look * 3;
        for (const side of [-1, 1]) {
            const x = side * 14 + ex, y = -12;
            g.fillStyle = "#2a2440";
            if (s.blink > 0.5) g.fillRect(x - 5, y, 10, 2.5);
            else if (happy) { g.lineWidth = 2.6; g.strokeStyle = "#2a2440"; g.beginPath(); g.arc(x, y + 3, 5, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
            else { g.beginPath(); g.ellipse(x, y, wow ? 5 : 4, wow ? 7 : 6, 0, 0, TAU); g.fill(); g.fillStyle = "#ffffff"; g.beginPath(); g.arc(x + 1.5, y - 2, 1.5, 0, TAU); g.fill(); }
            g.strokeStyle = "#6a5a3a"; g.lineWidth = 2;
            g.beginPath(); g.arc(side * 14, y, 11, 0, TAU); g.stroke();
        }
        g.beginPath(); g.moveTo(-3, -12); g.quadraticCurveTo(0, -15, 3, -12); g.stroke();       // the bridge of the glasses
        // blush and mouth
        g.fillStyle = "rgba(255,150,180,.35)"; g.beginPath(); g.ellipse(-24, 2, 6, 3.5, 0, 0, TAU); g.ellipse(24, 2, 6, 3.5, 0, 0, TAU); g.fill();
        const open = Math.max(s.talk, wow ? 0.8 : 0);
        g.strokeStyle = "#2a2440"; g.lineWidth = 2.2;
        if (open > 0.1) { g.fillStyle = "#2a2440"; g.beginPath(); g.ellipse(0, 5, 4, 2 + open * 4, 0, 0, TAU); g.fill(); }
        else { g.beginPath(); g.moveTo(-6, 4); g.quadraticCurveTo(0, sad ? 0 : 9, 6, 4); g.stroke(); }
        g.restore();
    }

    // ---------------------------------------------------------------------------------------------
    // Sounds: a music box, page flutters and a spooky (but friendly) "oooo"
    // ---------------------------------------------------------------------------------------------
    const box = (t, n, v = 0.05) => { tone({ t, f: midi(n), type: "sine", d: 0.7, v, echo: 0.25 }); tone({ t, f: midi(n) * 4, type: "sine", d: 0.08, v: v * 0.25 }); };
    const sounds = {
        type: () => tone({ f: U.pick([420, 460, 500]), f2: 300, type: "triangle", d: 0.06, v: 0.08, filt: { f: 1400 } }),
        erase: () => noise({ type: "bandpass", f: 1800, f2: 900, d: 0.25, v: 0.05, q: 1.5 }),
        move: () => {},
        word: () => [74, 77, 81, 86].forEach((n, i) => box(i * 0.09, n, 0.05)),
        wrong: () => { tone({ f: 220, f2: 196, type: "triangle", d: 0.45, v: 0.1, filt: { f: 900 } }); tone({ t: 0.2, f: 185, f2: 165, type: "triangle", d: 0.5, v: 0.09, filt: { f: 900 } }); },
        right: () => [74, 78, 81, 86, 90].forEach((n, i) => box(i * 0.07, n, 0.045)),
        reveal: () => tone({ f: 380, f2: 560, type: "sine", d: 0.8, v: 0.07, vib: 18, echo: 0.3 }),
        flip: () => box(0, 93, 0.03),
        flutter: () => { noise({ type: "bandpass", f: 900, f2: 2400, d: 0.4, v: 0.12, q: 0.9 }); noise({ t: 0.18, type: "bandpass", f: 1400, f2: 700, d: 0.35, v: 0.1, q: 0.9 }); },
        rumble: () => { tone({ f: 55, f2: 40, d: 0.8, v: 0.3 }); noise({ type: "lowpass", f: 260, d: 0.8, v: 0.25 }); },
        burst: () => { noise({ type: "bandpass", f: 700, f2: 3000, d: 0.5, v: 0.18, q: 0.7 }); [74, 81, 86, 90, 93].forEach((n, i) => box(0.05 + i * 0.06, n, 0.05)); },
        sparkle: () => [93, 98, 102].forEach((n, i) => box(i * 0.08, n, 0.03)),
        win: () => {},
        streak: () => [69, 74, 77, 81, 86].forEach((n, i) => box(i * 0.07, n, 0.05)),
        achievement: () => { [74, 78, 81, 86].forEach((n, i) => box(i * 0.08, n, 0.05)); tone({ t: 0.35, f: 400, f2: 600, type: "sine", d: 0.6, v: 0.05, vib: 15 }); },
        title: () => { sounds.flutter(); [62, 69, 74, 77].forEach((n, i) => box(0.3 + i * 0.1, n, 0.05)); },
        tile: i => box(0, 74 + (i % 8) * 2, 0.04),
        start: () => { tone({ f: 300, f2: 520, type: "sine", d: 0.9, v: 0.07, vib: 16, echo: 0.3 }); [62, 69, 74, 77, 81].forEach((n, i) => box(0.3 + i * 0.08, n, 0.05)); },
        select: () => box(0, 86, 0.03),
        nav: () => noise({ type: "bandpass", f: 1000, f2: 2200, d: 0.3, v: 0.06, q: 0.9 }),
        mascot: () => tone({ f: 420, f2: 620, type: "sine", d: 0.4, v: 0.05, vib: 20 })
    };

    Worlds.register({
        id: "library", name: "Haunted Library", icon: "\u{1F4DA}", tagline: "Quiet Shelves. Restless Ghosts.",
        modes: ["light", "dark"],
        scene, board, celebrate, titleCard, sounds, transition: "pages",
        mascot: { name: "BOO", draw: drawBoo },
        lines: {
            hello: ["Oh! You can see me? Welcome to the library!", "Shhh... a new puzzle just appeared on the shelf.", "Boo! Sorry, force of habit. Let's solve!"],
            start: ["Tap a square and start typing. Space flips Across and Down.", "Every answer is hiding somewhere in these books..."],
            word: ["Well read!", "By the book!", "Spooky good!", "Page turner!", "Booo-tiful!", "Checked out!"],
            win: ["The whole library is cheering! Quietly, of course.", "A fang-tastic finish!", "You've earned a gold star sticker!"],
            wrong: ["Hmm, a few of these need an eraser.", "Some letters wandered off the page."],
            right: ["Every word in its place!", "Perfectly catalogued!"],
            idle: ["Stuck? Try the shortest clue first.", "The crossing words might give you a hint..."],
            reveal: ["I peeked at the answer key...", "A little ghostly help!"]
        },
        introFlourish(stage) {
            const p = U.center(stage);
            FX.ring({ x: p.x, y: p.y, color: "#c99a2e", r1: Math.max(innerWidth, innerHeight) * 0.6, dur: 1.2, width: 12, glow: false });
            FX.burst({ x: p.x, y: p.y, n: 60, colors: ["#f6ecd2", "#efe2c2", "#fffaf0"], shape: "rect", speed: [200, 600], gravity: 120, drag: 1, life: [1.4, 2.4], size: [9, 13] });
        }
    });
})();
