// The CORAL REEF world: under the sea.
//   Day: a sunlit reef. Light shimmers down from the waves, sunbeams sway, coral and sea fans grow on the sand,
//   kelp waves in the current, schools of fish turn together, a sea turtle glides past, bubbles rise and a whale
//   sings far away in the blue.
//   Night: the deep sea. Jellyfish pulse with their own light, an anglerfish dangles its glowing lure, plankton
//   twinkles, and the coral glows faintly.
//   Board: each letter leaves a shell, starfish or pearl in its square; a fish swims along every finished word.
//   Win: bubbles rise, a treasure chest bursts open in a fountain of coins and pearls, and a whale swims by.

(() => {
    const TAU = Math.PI * 2;
    const { tone, noise, midi } = Sound;
    const FISH = ["#ffb03b", "#ff6f61", "#3ec9d6", "#ffe066", "#8f7bff", "#5be38a"];

    const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };

    // a small fish facing right, length about 2*s
    function fish(g, x, y, s, col, flip, wag, glow) {
        g.save();
        g.translate(x, y);
        g.scale(flip, 1);
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(s, 0);
        g.quadraticCurveTo(s * 0.2, -s * 0.62, -s * 0.6, 0);
        g.quadraticCurveTo(s * 0.2, s * 0.62, s, 0);
        g.fill();
        g.beginPath();                                    // the tail, wagging
        g.moveTo(-s * 0.5, 0);
        g.lineTo(-s * 1.1, -s * 0.45 + wag * s * 0.2);
        g.lineTo(-s * 1.1, s * 0.45 + wag * s * 0.2);
        g.fill();
        g.fillStyle = glow ? "#ffffff" : "rgba(255,255,255,.85)";
        g.beginPath(); g.arc(s * 0.5, -s * 0.08, s * 0.14, 0, TAU); g.fill();
        g.fillStyle = "#14213d";
        g.beginPath(); g.arc(s * 0.54, -s * 0.08, s * 0.07, 0, TAU); g.fill();
        g.restore();
    }

    // ---------------------------------------------------------------------------------------------
    // The background
    // ---------------------------------------------------------------------------------------------
    function scene(W, H, opts) {
        const night = opts.theme === "dark", preview = !!opts.preview;
        let sandY, reef, sand, bg = null, kelp, schools, bubbles, snow, jellies, plankton, beams;
        let turtle = null, nextTurtle = preview ? 999 : U.rand(8, 16), whale = null, nextWhale = preview ? 999 : U.rand(14, 26);
        let angler = null, nextAngler = preview ? 999 : U.rand(6, 12);

        const C = night
            ? { top: "#06142e", mid: "#030b1f", low: "#010510", sand1: "#1a2236", sand2: "#0c111f", coralDim: 0.35 }
            : { top: "#6fd8ea", mid: "#1f8fc4", low: "#0b4f80", sand1: "#f4dfa8", sand2: "#d9b877", coralDim: 1 };
        const dim = hex => { if (!night) return hex; const n = parseInt(hex.slice(1), 16); return `rgb(${Math.round((n >> 16 & 255) * 0.3)},${Math.round((n >> 8 & 255) * 0.32)},${Math.round((n & 255) * 0.42)})`; };

        function setup() {
            sandY = Math.round(H * (preview ? 0.8 : 0.82));
            bg = null;
            const R = U.rng(808);
            // the sea floor with ripples
            sand = canvas(W + 40, H - sandY + 30);
            {
                const g = sand.getContext("2d"), w = sand.width, h = sand.height;
                const gr = g.createLinearGradient(0, 0, 0, h);
                gr.addColorStop(0, C.sand1);
                gr.addColorStop(1, C.sand2);
                g.fillStyle = gr;
                g.beginPath(); g.moveTo(0, h);
                for (let x = 0; x <= w; x += 24) g.lineTo(x, 22 - Math.sin(x * 0.008) * 10 - Math.sin(x * 0.027) * 4);
                g.lineTo(w, h); g.fill();
                g.strokeStyle = night ? "rgba(255,255,255,.05)" : "rgba(160,120,60,.25)";
                g.lineWidth = 1.5;
                for (let i = 0; i < 26; i++) { const y = 30 + R() * (h - 30), x = R() * w; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 30, y - 5, x + 60, y); g.stroke(); }
            }
            // the reef: branching coral, brain coral, sea fans and anemones on both sides
            reef = canvas(W + 80, H);
            {
                const g = reef.getContext("2d");
                const branch = (x, y, len, ang, w, col, depth) => {
                    if (depth === 0 || len < 4) return;
                    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
                    g.strokeStyle = col; g.lineWidth = w; g.lineCap = "round";
                    g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
                    branch(x2, y2, len * 0.72, ang - 0.45 - R() * 0.25, w * 0.72, col, depth - 1);
                    branch(x2, y2, len * 0.72, ang + 0.45 + R() * 0.25, w * 0.72, col, depth - 1);
                };
                const brain = (x, y, r, col) => {
                    g.fillStyle = col; g.beginPath(); g.ellipse(x, y, r, r * 0.7, 0, Math.PI, TAU); g.fill();
                    g.strokeStyle = "rgba(0,0,0,.18)"; g.lineWidth = 1.5;
                    for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(x, y, r * (0.3 + i * 0.14), r * 0.7 * (0.3 + i * 0.14), 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); }
                };
                const fan = (x, y, r, col) => {
                    g.strokeStyle = col; g.lineWidth = 1.2;
                    for (let i = 0; i < 22; i++) { const a = -Math.PI * (0.15 + 0.7 * i / 21); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.7, x + Math.cos(a) * r, y + Math.sin(a) * r); g.stroke(); }
                    g.globalAlpha = 0.25; g.fillStyle = col; g.beginPath(); g.arc(x, y, r, Math.PI * 1.1, Math.PI * 1.9); g.lineTo(x, y); g.fill(); g.globalAlpha = 1;
                };
                const s = preview ? 0.55 : U.clamp(H / 900, 0.6, 1.3);
                const spots = [[0.02, "branch", "#ff7b9c"], [0.07, "fan", "#b56cff"], [0.11, "brain", "#ffb86b"], [0.05, "branch", "#ff9f43"],
                               [0.9, "branch", "#ff7b9c"], [0.95, "fan", "#ff5f7e"], [0.86, "brain", "#9be15d"], [0.99, "branch", "#ffd166"], [0.5, "brain", "#ff9f80"], [0.33, "fan", "#ff6fae"], [0.68, "branch", "#ffb347"]];
                for (const [fx, kind, col] of spots) {
                    const x = 40 + fx * W, y = sandY + 18 + R() * 10, c = dim(col);
                    if (kind === "branch") branch(x, y, 52 * s, -Math.PI / 2 + (R() - 0.5) * 0.3, 9 * s, c, 5);
                    else if (kind === "fan") fan(x, y, 70 * s, c);
                    else brain(x, y, 30 * s, c);
                }
                for (let i = 0; i < (preview ? 4 : 10); i++) {              // anemones
                    const x = 40 + R() * W, y = sandY + 20 + R() * 12, col = dim(U.pick(["#ff6fae", "#7ae7ff", "#ffd166"]));
                    g.strokeStyle = col; g.lineWidth = 2.4 * s; g.lineCap = "round";
                    for (let j = 0; j < 9; j++) { const a = -Math.PI * (0.2 + 0.6 * j / 8); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * 10 * s, y + Math.sin(a) * 14 * s, x + Math.cos(a) * 16 * s, y + Math.sin(a) * 18 * s); g.stroke(); }
                }
            }
            kelp = Array.from({ length: preview ? 4 : 9 }, (_, i) => ({ x: (i < 5 ? R() * 0.16 : 0.84 + R() * 0.16) * W, h: H * (0.3 + R() * 0.3), ph: R() * TAU, w: 7 + R() * 5 }));
            schools = Array.from({ length: preview ? 1 : 3 }, (_, i) => ({ x: R() * W, y: H * (0.25 + i * 0.18), vx: (R() < 0.5 ? -1 : 1) * (25 + R() * 30), col: FISH[i % FISH.length], n: 7 + Math.floor(R() * 7), ph: R() * TAU,
                fish: Array.from({ length: 14 }, () => ({ dx: (R() - 0.5) * 110, dy: (R() - 0.5) * 50, s: 5 + R() * 4, ph: R() * TAU })) }));
            bubbles = Array.from({ length: preview ? 10 : 40 }, () => ({ x: R() * W, y: R() * H, r: 1.5 + R() * 4, sp: 20 + R() * 40, ph: R() * TAU }));
            snow = Array.from({ length: preview ? 20 : 80 }, () => ({ x: R() * W, y: R() * H, r: 0.6 + R() * 1.2, sp: 4 + R() * 8, ph: R() * TAU }));
            jellies = night ? Array.from({ length: preview ? 2 : 5 }, (_, i) => ({ x: R() * W, y: H * (0.2 + R() * 0.5), s: 14 + R() * 18, ph: R() * TAU, col: ["120,220,255", "200,140,255", "255,140,210"][i % 3], vy: 0 })) : [];
            plankton = night ? Array.from({ length: preview ? 30 : 140 }, () => ({ x: R() * W, y: R() * H, r: 0.6 + R() * 1.4, tw: R() * TAU, c: R() < 0.6 ? "120,255,220" : "140,200,255" })) : [];
            beams = Array.from({ length: 7 }, () => ({ x: R(), w: 0.03 + R() * 0.05, ph: R() * TAU }));
        }
        setup();

        function drawTurtle(g, tt, t) {
            g.save();
            g.translate(tt.x, tt.y + Math.sin(t * 0.8) * 8);
            g.scale(tt.dir * tt.s, tt.s);
            const fl = Math.sin(t * 2.4);
            g.fillStyle = night ? "#1d3a3a" : "#6fbf73";
            for (const [fx, fy, a] of [[18, -12, -0.6 - fl * 0.5], [18, 12, 0.6 + fl * 0.5], [-20, -10, -2.4 + fl * 0.3], [-20, 10, 2.4 - fl * 0.3]]) {
                g.save(); g.translate(fx, fy); g.rotate(a); g.beginPath(); g.ellipse(9, 0, 12, 4.5, 0, 0, TAU); g.fill(); g.restore();
            }
            g.beginPath(); g.ellipse(34, 0, 9, 7, 0, 0, TAU); g.fill();
            g.fillStyle = night ? "#2a2416" : "#8a6a3a";
            g.beginPath(); g.ellipse(0, 0, 28, 20, 0, 0, TAU); g.fill();
            g.strokeStyle = night ? "#3d3420" : "#b88c4a"; g.lineWidth = 2;
            for (const [cx, cy] of [[0, 0], [-13, -7], [-13, 7], [13, -7], [13, 7]]) { g.beginPath(); g.ellipse(cx, cy, 7, 5, 0, 0, TAU); g.stroke(); }
            g.fillStyle = "#14213d"; g.beginPath(); g.arc(38, -2.5, 1.6, 0, TAU); g.fill();
            g.restore();
        }
        function drawWhale(g, w) {
            g.save();
            g.translate(w.x, w.y);
            g.scale(w.dir * w.s, w.s);
            g.fillStyle = night ? "rgba(40,70,120,.35)" : "rgba(20,70,130,.35)";
            g.beginPath();
            g.moveTo(120, 0);
            g.bezierCurveTo(110, -38, 20, -42, -60, -14);
            g.quadraticCurveTo(-100, -4, -130, -26);
            g.quadraticCurveTo(-120, 0, -132, 22);
            g.quadraticCurveTo(-100, 6, -60, 12);
            g.bezierCurveTo(20, 34, 100, 30, 120, 0);
            g.fill();
            g.beginPath(); g.ellipse(30, 26, 26, 6, 0.35, 0, TAU); g.fill();
            g.restore();
        }
        function drawAngler(g, a, t) {
            g.save();
            g.translate(a.x, a.y + Math.sin(t * 1.3) * 6);
            g.scale(a.dir * a.s, a.s);
            const lx = 34 + Math.sin(t * 2) * 3, ly = -36 + Math.cos(t * 2) * 3;
            const lg = g.createRadialGradient(lx, ly, 0, lx, ly, 34);
            lg.addColorStop(0, "rgba(180,255,230,.75)");
            lg.addColorStop(1, "rgba(120,255,220,0)");
            g.fillStyle = lg; g.beginPath(); g.arc(lx, ly, 34, 0, TAU); g.fill();
            g.strokeStyle = "#2a3550"; g.lineWidth = 2;
            g.beginPath(); g.moveTo(10, -16); g.quadraticCurveTo(26, -44, lx, ly); g.stroke();
            g.fillStyle = "#e9fff8"; g.beginPath(); g.arc(lx, ly, 4, 0, TAU); g.fill();
            g.fillStyle = "#1a2236";
            g.beginPath(); g.ellipse(0, 0, 30, 22, 0, 0, TAU); g.fill();
            g.beginPath(); g.moveTo(-26, 0); g.lineTo(-48, -16); g.lineTo(-48, 16); g.fill();
            g.fillStyle = "#dfe8ff";
            for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(14 + i * 3, 6); g.lineTo(15.5 + i * 3, 12); g.lineTo(17 + i * 3, 6); g.fill(); }
            g.fillStyle = "#cfe6ff"; g.beginPath(); g.arc(14, -8, 4, 0, TAU); g.fill();
            g.fillStyle = "#000"; g.beginPath(); g.arc(15, -8, 2, 0, TAU); g.fill();
            g.restore();
        }

        return {
            resize(w, h) { W = w; H = h; setup(); },
            draw(g, t, dt, inp) {
                if (!bg) {
                    bg = g.createLinearGradient(0, 0, 0, H);
                    bg.addColorStop(0, C.top);
                    bg.addColorStop(0.5, C.mid);
                    bg.addColorStop(1, C.low);
                }
                g.fillStyle = bg;
                g.fillRect(0, 0, W, H);
                // the wavy surface far above, and light shimmering down through it
                g.globalCompositeOperation = "lighter";
                for (const b of beams) {
                    const x = (b.x + Math.sin(t * 0.13 + b.ph) * 0.04) * W - inp.px * 10, w = b.w * W, a = (night ? 0.03 : 0.1) + 0.05 * Math.sin(t * 0.5 + b.ph);
                    const gr = g.createLinearGradient(0, 0, 0, H * 0.9);
                    gr.addColorStop(0, `rgba(${night ? "150,190,255" : "255,255,230"},${Math.max(0, a).toFixed(3)})`);
                    gr.addColorStop(1, "rgba(255,255,255,0)");
                    g.fillStyle = gr;
                    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + w, 0); g.lineTo(x + w * 2.6 + W * 0.08, H * 0.9); g.lineTo(x + W * 0.08, H * 0.9); g.fill();
                }
                if (!night) {                                         // caustics: rippling light near the top
                    g.strokeStyle = "rgba(255,255,255,.18)";
                    g.lineWidth = 2;
                    for (let row = 0; row < 3; row++) {
                        g.beginPath();
                        for (let x = 0; x <= W; x += 16) { const y = 8 + row * 16 + Math.sin(x * 0.03 + t * 1.6 + row * 2) * 6 + Math.sin(x * 0.011 - t) * 4; x ? g.lineTo(x, y) : g.moveTo(x, y); }
                        g.stroke();
                    }
                }
                g.globalCompositeOperation = "source-over";
                // plankton twinkling in the dark
                for (const p of plankton) {
                    p.y -= dt * 3; if (p.y < -4) p.y = H + 4;
                    const k = 0.3 + 0.7 * Math.abs(Math.sin(t * 1.4 + p.tw));
                    g.fillStyle = `rgba(${p.c},${(k * 0.8).toFixed(2)})`;
                    g.fillRect(p.x - inp.px * 6, p.y, p.r, p.r);
                }
                // a whale singing far away in the blue
                nextWhale -= dt;
                if (!whale && nextWhale <= 0) { const dir = Math.random() < 0.5 ? 1 : -1; whale = { dir, x: dir > 0 ? -260 : W + 260, y: H * U.rand(0.18, 0.4), vx: dir * U.rand(22, 34), s: U.clamp(W / 1000, 0.6, 1.6) }; }
                if (whale) { whale.x += whale.vx * dt; drawWhale(g, { ...whale, x: whale.x - inp.px * 4 }); if (whale.x < -320 || whale.x > W + 320) { whale = null; nextWhale = U.rand(30, 50); } }
                // marine snow drifting down
                g.fillStyle = night ? "rgba(200,220,255,.35)" : "rgba(255,255,255,.45)";
                for (const s of snow) { s.y += s.sp * dt; if (s.y > H) s.y = -4; g.fillRect(s.x + Math.sin(t * 0.6 + s.ph) * 8 - inp.px * 5, s.y, s.r, s.r); }
                // schools of fish turning together
                for (const sc of schools) {
                    sc.x += sc.vx * dt;
                    if (sc.x > W + 160) sc.vx = -Math.abs(sc.vx); else if (sc.x < -160) sc.vx = Math.abs(sc.vx);
                    const flip = sc.vx > 0 ? 1 : -1, sy = sc.y + Math.sin(t * 0.5 + sc.ph) * 30;
                    for (let i = 0; i < sc.n; i++) {
                        const f = sc.fish[i];
                        const x = sc.x + f.dx + Math.sin(t * 1.3 + f.ph) * 8 - inp.px * 12, y = sy + f.dy + Math.cos(t * 1.1 + f.ph) * 5;
                        fish(g, x, y, f.s, night ? dim(sc.col) : sc.col, flip, Math.sin(t * 12 + f.ph), false);
                    }
                }
                // a sea turtle gliding past
                nextTurtle -= dt;
                if (!turtle && nextTurtle <= 0) { const dir = Math.random() < 0.5 ? 1 : -1; turtle = { dir, x: dir > 0 ? -80 : W + 80, y: H * U.rand(0.3, 0.6), vx: dir * U.rand(30, 45), s: U.clamp(H / 900, 0.6, 1.3) }; }
                if (turtle) { turtle.x += turtle.vx * dt; drawTurtle(g, { ...turtle, x: turtle.x - inp.px * 14 }, t); if (turtle.x < -120 || turtle.x > W + 120) { turtle = null; nextTurtle = U.rand(16, 28); } }
                // an anglerfish with its glowing lure (night)
                if (night) {
                    nextAngler -= dt;
                    if (!angler && nextAngler <= 0) { const dir = Math.random() < 0.5 ? 1 : -1; angler = { dir, x: dir > 0 ? -70 : W + 70, y: H * U.rand(0.45, 0.7), vx: dir * U.rand(18, 28), s: U.clamp(H / 900, 0.7, 1.3) }; }
                    if (angler) { angler.x += angler.vx * dt; drawAngler(g, { ...angler, x: angler.x - inp.px * 14 }, t); if (angler.x < -110 || angler.x > W + 110) { angler = null; nextAngler = U.rand(14, 24); } }
                }
                // jellyfish pulsing with light (night)
                g.globalCompositeOperation = "lighter";
                for (const j of jellies) {
                    const pulse = Math.sin(t * 2.2 + j.ph);
                    j.y -= (pulse > 0 ? 14 : 3) * dt;
                    if (j.y < -60) { j.y = H + 60; j.x = Math.random() * W; }
                    const x = j.x - inp.px * 10, y = j.y, s = j.s * (1 + pulse * 0.08);
                    const jg = g.createRadialGradient(x, y, 0, x, y, s * 2.4);
                    jg.addColorStop(0, `rgba(${j.col},.35)`);
                    jg.addColorStop(1, `rgba(${j.col},0)`);
                    g.fillStyle = jg; g.beginPath(); g.arc(x, y, s * 2.4, 0, TAU); g.fill();
                    g.fillStyle = `rgba(${j.col},.55)`;
                    g.beginPath(); g.ellipse(x, y, s, s * (0.75 - pulse * 0.08), 0, Math.PI, TAU); g.fill();
                    g.strokeStyle = `rgba(${j.col},.5)`; g.lineWidth = 1.4;
                    for (let k = -2; k <= 2; k++) {
                        g.beginPath(); g.moveTo(x + k * s * 0.3, y);
                        for (let q = 1; q <= 6; q++) g.lineTo(x + k * s * 0.3 + Math.sin(t * 2 + q * 0.8 + k) * 4, y + q * s * 0.35);
                        g.stroke();
                    }
                }
                g.globalCompositeOperation = "source-over";
                // kelp swaying in the current
                for (const k of kelp) {
                    const x0 = k.x - inp.px * 16, y0 = sandY + 26;
                    g.strokeStyle = night ? "#123326" : "#2f9a55";
                    g.lineWidth = k.w;
                    g.lineCap = "round";
                    g.beginPath(); g.moveTo(x0, y0);
                    const pts = [];
                    for (let i = 1; i <= 12; i++) { const yy = y0 - k.h * i / 12, xx = x0 + Math.sin(t * 0.9 + k.ph + i * 0.35) * i * 2.2; pts.push([xx, yy]); g.lineTo(xx, yy); }
                    g.stroke();
                    g.fillStyle = night ? "#164030" : "#3fb865";
                    pts.forEach(([xx, yy], i) => { if (i % 2) return; g.beginPath(); g.ellipse(xx + (i % 4 ? 6 : -6), yy, 8, 3, (i % 4 ? 0.6 : -0.6), 0, TAU); g.fill(); });
                }
                g.drawImage(sand, -20 - inp.px * 6, sandY - 10);
                g.drawImage(reef, -40 - inp.px * 10, 0);
                // bubbles rising
                g.strokeStyle = night ? "rgba(160,220,255,.5)" : "rgba(255,255,255,.75)";
                g.lineWidth = 1.2;
                for (const b of bubbles) {
                    b.y -= b.sp * dt; if (b.y < -10) { b.y = H + 10; b.x = Math.random() * W; }
                    const x = b.x + Math.sin(t * 2 + b.ph) * 4 - inp.px * 8;
                    g.beginPath(); g.arc(x, b.y, b.r, 0, TAU); g.stroke();
                }
            }
        };
    }

    // ---------------------------------------------------------------------------------------------
    // The board: a shell, starfish or pearl in each typed square; a fish swims along every finished word
    // ---------------------------------------------------------------------------------------------
    const TREASURES = [
        `<path d="M0 .1L-.1 -.06Q0 -.13 .1 -.06Z" fill="#ffb3a7"/><path d="M0 .1L-.06 -.09M0 .1L0 -.11M0 .1L.06 -.09" stroke="#e07a6e" stroke-width=".012"/>`,
        `<path d="M0 -.11L.03 -.03L.11 -.03L.045 .02L.07 .1L0 .05L-.07 .1L-.045 .02L-.11 -.03L-.03 -.03Z" fill="#ff8a5b"/><circle cx="0" cy="0" r=".015" fill="#ffd2b8"/>`,
        `<circle r=".06" fill="url(#ocPearl)"/>`,
        `<circle r=".08" fill="#f2e6cf"/><path d="M0 -.05L.012 -.012L.05 0L.012 .012L0 .05L-.012 .012L-.05 0L-.012 -.012Z" fill="#c9b48e"/>`,
        `<path d="M-.1 0Q-.03 -.07 .06 -.02L.1 -.05L.09 .05L.06 .02Q-.03 .07 -.1 0Z" fill="#3ec9d6"/><circle cx="-.05" cy="-.008" r=".012" fill="#14213d"/>`
    ];
    const RUNNER = `<svg viewBox="-30 -20 60 40" aria-hidden="true"><path d="M24 0Q8 -16 -12 0Q8 16 24 0Z" fill="#ffb03b"/><path d="M-10 0L-24 -11L-24 11Z" fill="#ff8c1a" class="oc-tail"/>
        <path d="M2 -9Q6 0 2 9" stroke="#fff" stroke-width="3" fill="none"/><circle cx="14" cy="-2" r="3.2" fill="#fff"/><circle cx="15" cy="-2" r="1.6" fill="#14213d"/></svg>`;

    const board = (() => {
        let layer = null, gT, items = new Map(), seed = 1, size = 5, quiet = true, boardRef = null;
        const rnd = (...k) => { let h = seed; for (const v of k) { h = Math.imul(h ^ v, 2654435761); h ^= h >>> 13; } return (h >>> 0) / 4294967296; };
        function build(game, boardEl) {
            if (layer) layer.remove();
            size = game.puzzle.size;
            seed = U.hash(game.puzzle.seed + game.puzzle.mode + "reef");
            boardRef = boardEl;
            layer = U.svg("svg", { class: "oc-layer", viewBox: `0 0 ${size} ${size}`, preserveAspectRatio: "none", "aria-hidden": "true" });
            layer.innerHTML = `<defs><radialGradient id="ocPearl" cx=".35" cy=".35" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#f3e9ff"/><stop offset="1" stop-color="#c9b8e6"/></radialGradient></defs>`;
            boardEl.appendChild(layer);
            gT = U.svg("g", {}, layer);
            items = new Map();
        }
        function treasure(r, c, grow) {
            const kind = Math.floor(rnd(r, c, 1) * TREASURES.length);
            const [ox, oy] = [[0.8, 0.24], [0.8, 0.78], [0.22, 0.79]][Math.floor(rnd(r, c, 2) * 3)];
            const x = c + ox + (rnd(r, c, 3) - 0.5) * 0.05, y = r + oy + (rnd(r, c, 4) - 0.5) * 0.05, rot = (rnd(r, c, 5) - 0.5) * 50;
            const outer = U.svg("g", { transform: `translate(${x.toFixed(3)} ${y.toFixed(3)}) rotate(${rot.toFixed(1)})`, class: "oc-item" + (grow ? " float" : "") }, gT);
            U.svg("g", { class: "oc-item-in" }, outer).innerHTML = TREASURES[kind];
            return outer;
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
                if (!items.has(key)) items.set(key, treasure(r, c, grow));
            }
            for (const [key, el] of items) if (!want.has(key)) { el.remove(); items.delete(key); }
            const done = new Set();
            for (const entry of [...game.puzzle.across, ...game.puzzle.down]) {
                const cells = Game.cellsOf(entry);
                if (cells.every(([r, c]) => game.letters[r][c])) cells.forEach(([r, c]) => done.add(r * 99 + c));
            }
            for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { const cell = Game.cellEl(r, c); if (cell) cell.classList.toggle("oc-done", done.has(r * 99 + c)); }
            boardEl.classList.toggle("oc-solved", !!(game.solved && !game.surrendered));
        }
        function type(cell) {
            const p = U.center(cell);
            FX.burst({ x: p.x, y: p.y + p.h * 0.2, n: 6, colors: ["#ffffff", "#bff3ff"], shape: "bubble", speed: [20, 60], angle: -Math.PI / 2, spread: 0.6, gravity: -160, drag: 1.5, life: [0.6, 1], size: [2.5, 5], wobble: 20 });
        }
        function wordDone(entry, cells) {
            if (U.motion() === "still") return;
            const pts = cells.map(([r, c]) => Game.cellEl(r, c)).filter(Boolean).map(el => U.center(el));
            if (!pts.length) return;
            const down = entry.direction === "down";
            const fishEl = U.el("div", { class: "oc-runner" + (down ? " down" : ""), html: RUNNER });
            document.getElementById("overlay").appendChild(fishEl);
            const first = pts[0], last = pts[pts.length - 1], dur = 140 * pts.length + 250;
            const frames = pts.map((p, i) => ({ transform: `translate(${p.x - 24}px, ${p.y - 16 + Math.sin(i * 1.6) * 6}px)${down ? " rotate(90deg)" : ""}`, offset: i / Math.max(1, pts.length - 1) }));
            if (frames.length === 1) frames.push({ ...frames[0], offset: 1 });
            fishEl.animate(frames, { duration: dur, easing: "ease-in-out", fill: "forwards" });
            fishEl.animate([{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], { duration: dur + 200 });
            pts.forEach((p, i) => setTimeout(() => FX.burst({ x: p.x, y: p.y, n: 4, colors: ["#ffffff", "#bff3ff"], shape: "bubble", speed: [10, 40], gravity: -140, life: [0.6, 1], size: [2, 4], wobble: 20 }), (dur / pts.length) * i));
            setTimeout(() => fishEl.remove(), dur + 260);
            void first; void last;
        }
        function restoreSolved(boardEl, game) { quiet = true; update(game, boardEl); }
        function clear() {
            if (layer) layer.remove();
            layer = null;
            items = new Map();
            Game.openCells().forEach(cell => cell.classList.remove("oc-done"));
            if (boardRef) boardRef.classList.remove("oc-solved");
        }
        return { attach, update, type, wordDone, restoreSolved, reset: clear, clear };
    })();

    // ---------------------------------------------------------------------------------------------
    // The win: bubbles, a treasure chest bursting open, a fountain of coins and pearls, and a whale
    // ---------------------------------------------------------------------------------------------
    const CHEST = `<svg viewBox="0 0 160 130" aria-hidden="true">
        <defs><linearGradient id="ocWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a0612f"/><stop offset="1" stop-color="#6b3d1a"/></linearGradient></defs>
        <g class="oc-chest-glow"><ellipse cx="80" cy="62" rx="70" ry="30" fill="rgba(255,220,120,.85)"/></g>
        <rect x="14" y="62" width="132" height="60" rx="8" fill="url(#ocWood)" stroke="#3f2310" stroke-width="4"/>
        <rect x="14" y="78" width="132" height="8" fill="#d9a43a"/><rect x="72" y="70" width="16" height="22" rx="3" fill="#ffd166" stroke="#8a5a12" stroke-width="2"/>
        <g class="oc-lid"><path d="M14 64 Q80 6 146 64 Z" fill="url(#ocWood)" stroke="#3f2310" stroke-width="4"/><path d="M20 58 Q80 12 140 58" stroke="#d9a43a" stroke-width="6" fill="none"/></g>
    </svg>`;
    const WHALE = `<svg viewBox="-140 -50 280 100" aria-hidden="true"><path d="M120 0C110 -38 20 -42 -60 -14Q-100 -4 -130 -26Q-120 0 -132 22Q-100 6 -60 12C20 34 100 30 120 0Z" fill="#3b78c4"/>
        <path d="M120 2C100 26 30 30 -40 14Q20 20 120 2Z" fill="#cfe7ff"/><ellipse cx="30" cy="24" rx="26" ry="6" transform="rotate(20 30 24)" fill="#2f63a6"/><circle cx="88" cy="-6" r="4" fill="#0d2240"/>
        <path d="M70 -34Q74 -60 64 -70M70 -34Q80 -58 92 -66M70 -34Q62 -56 48 -62" class="oc-spout" stroke="#bfe9ff" stroke-width="5" stroke-linecap="round" fill="none"/></svg>`;

    async function celebrate(c, { boardEl }) {
        if (U.motion() === "still") return;
        const W = innerWidth, H = innerHeight, b = boardEl.getBoundingClientRect(), cx = b.left + b.width / 2;
        const overlay = document.getElementById("overlay");
        // 1. bubbles stream up out of every square
        Sound.play("bubbles");
        for (const cell of Game.openCells()) {
            const p = U.center(cell);
            FX.burst({ x: p.x, y: p.y, n: 5, colors: ["#ffffff", "#bff3ff", "#8fe3ff"], shape: "bubble", speed: [20, 80], angle: -Math.PI / 2, spread: 0.5, gravity: -260, drag: 0.8, life: [1.2, 2], size: [3, 8], wobble: 30, delay: [0, 0.6] });
        }
        await c.wait(900);
        if (c.skipped) return;
        // 2. a treasure chest rises in front of the board and bursts open
        const chest = U.el("div", { class: "oc-chest", html: CHEST, style: { left: cx - 90 + "px", top: Math.min(H - 160, b.bottom - 120) + "px" } });
        overlay.appendChild(chest);
        FX.follow(c, boardEl, chest);
        c.cleanup(() => chest.remove());
        chest.animate([{ transform: "translateY(260px) scale(.6)", opacity: 0 }, { transform: "translateY(-14px) scale(1.05)", opacity: 1, offset: 0.7 }, { transform: "none", opacity: 1 }], { duration: 700, easing: "cubic-bezier(.2,.9,.3,1)", fill: "backwards" });
        await c.wait(800);
        if (c.skipped) return;
        chest.animate([{ transform: "none" }, { transform: "rotate(-4deg)" }, { transform: "rotate(4deg)" }, { transform: "none" }], { duration: 360 });
        Sound.play("creak");
        await c.wait(420);
        if (c.skipped) return;
        chest.classList.add("open");
        Sound.play("treasure");
        const cp = U.center(chest);
        FX.flash("#fff3c4", 450, 0.5);
        FX.ring({ x: cp.x, y: cp.y - 20, color: "#ffd166", r1: Math.max(W, H) * 0.5, dur: 1, width: 16 });
        FX.burst({ x: cp.x, y: cp.y - 20, n: 70, colors: ["#ffd166", "#ffbe0b", "#fff1a8"], shape: "circle", angle: -Math.PI / 2, spread: 0.9, speed: [350, 800], gravity: 700, drag: 0.4, life: [1.2, 1.8], size: [4, 7], glow: true });
        FX.burst({ x: cp.x, y: cp.y - 20, n: 30, colors: ["#ffffff", "#f3e9ff"], shape: "circle", angle: -Math.PI / 2, spread: 0.8, speed: [300, 700], gravity: 650, drag: 0.4, life: [1.2, 1.8], size: [3, 5] });
        FX.burst({ x: cp.x, y: cp.y - 20, n: 20, colors: ["#3ec9d6", "#ff6fae", "#8f7bff", "#5be38a"], shape: "star", angle: -Math.PI / 2, spread: 0.9, speed: [300, 700], gravity: 650, life: [1.2, 1.8], size: [5, 8], glow: true, spin: 6 });
        await c.wait(1000);
        if (c.skipped) return;
        // 3. a whale swims past, spouting
        Sound.play("whale");
        const whale = U.el("div", { class: "oc-whale", html: WHALE, style: { top: Math.max(60, b.top - 40) + "px" } });
        overlay.appendChild(whale);
        FX.follow(c, boardEl, whale);
        c.cleanup(() => whale.remove());
        whale.animate([{ transform: `translateX(${W + 60}px) translateY(0)` }, { transform: `translateX(${W * 0.4}px) translateY(-24px)`, offset: 0.5 }, { transform: "translateX(-420px) translateY(0)" }], { duration: 3600, easing: "linear", fill: "forwards" });
        for (let i = 0; i < 3; i++) setTimeout(() => FX.burst({ x: W / 2, y: H + 10, jitter: W / 2, n: 14, colors: ["#ffffff", "#bff3ff"], shape: "bubble", speed: [40, 120], angle: -Math.PI / 2, spread: 0.3, gravity: -200, life: [2, 3], size: [3, 9], wobble: 30 }), i * 600);
        await c.wait(3300);
        if (c.skipped) return;
        chest.animate([{ opacity: 1 }, { opacity: 0, transform: "translateY(40px)" }], { duration: 350, fill: "forwards" });
        await c.wait(340);
    }

    // ---------------------------------------------------------------------------------------------
    // Title card: a parchment scroll unrolls between two wooden rollers while bubbles rise
    // ---------------------------------------------------------------------------------------------
    async function titleCard(c, info) {
        const bub = Array.from({ length: 22 }, () => `<i class="tco-bub" style="left:${U.rand(0, 100).toFixed(1)}%;--d:${U.rand(0, 2).toFixed(2)}s;--s:${U.rand(6, 18).toFixed(0)}px;--t:${U.rand(2.4, 4.4).toFixed(2)}s"></i>`).join("");
        const card = U.el("div", { class: "tc tc-ocean", "aria-hidden": "true", html: `
            <div class="tco-bubbles">${bub}</div>
            <div class="tco-scroll">
                <i class="tco-roll top"></i>
                <div class="tco-paper"><small>&#9875; ${U.esc(info.kicker)} &#9875;</small><h2>${U.esc(info.title)}</h2><p>${U.esc(info.sub)}</p></div>
                <i class="tco-roll bottom"></i>
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
    // The mascot: Otto, a friendly octopus
    // ---------------------------------------------------------------------------------------------
    function drawOtto(g, s) {
        const happy = s.mood === "happy", wow = s.mood === "wow", sad = s.mood === "sad";
        const bob = Math.sin(s.t * 1.8) * 4 - s.hop * 12;
        g.save();
        g.translate(80, 74 + bob);
        g.strokeStyle = "#5b2a86";
        g.lineWidth = 2.5;
        // eight tentacles, curling (faster when happy)
        const speed = happy ? 6 : 2.2;
        for (let i = 0; i < 8; i++) {
            const bx = -26 + i * 7.4, ph = i * 0.9;
            g.fillStyle = i % 2 ? "#a35be0" : "#b56ef0";
            g.beginPath();
            g.moveTo(bx - 5, 16);
            const pts = [];
            for (let k = 1; k <= 6; k++) pts.push([bx + Math.sin(s.t * speed + ph + k * 0.7) * k * 1.6 + (i - 3.5) * k * 1.2, 16 + k * 9]);
            pts.forEach(([x, y]) => g.lineTo(x - 4, y));
            for (let k = pts.length - 1; k >= 0; k--) g.lineTo(pts[k][0] + 4 - k * 0.6, pts[k][1]);
            g.lineTo(bx + 5, 16);
            g.closePath();
            g.fill();
            g.stroke();
            g.fillStyle = "#f1d6ff";
            for (let k = 1; k < 5; k++) { g.beginPath(); g.arc(pts[k][0] + 1.5, pts[k][1] - 2, 1.4, 0, TAU); g.fill(); }
        }
        // head
        const hg = g.createRadialGradient(-14, -30, 6, 0, -10, 46);
        hg.addColorStop(0, "#d79bff");
        hg.addColorStop(1, "#9246d6");
        g.fillStyle = hg;
        g.beginPath(); g.ellipse(0, -10, 38, 36, 0, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = "rgba(255,255,255,.35)";
        for (const [x, y, r] of [[-18, -30, 4], [14, -34, 3], [22, -14, 2.5]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
        // eyes
        const ex = s.look * 3;
        for (const side of [-1, 1]) {
            const x = side * 13 + ex, y = -8;
            g.fillStyle = "#ffffff";
            g.beginPath(); g.ellipse(x, y, 9, wow ? 11 : 10, 0, 0, TAU); g.fill();
            g.fillStyle = "#2a1640";
            if (s.blink > 0.5) { g.fillRect(x - 7, y, 14, 2.4); continue; }
            if (happy) { g.lineWidth = 2.8; g.strokeStyle = "#2a1640"; g.beginPath(); g.arc(x, y + 3, 5.5, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); g.strokeStyle = "#5b2a86"; g.lineWidth = 2.5; continue; }
            g.beginPath(); g.arc(x + side * 0.6, y + (sad ? 2 : 1), wow ? 5.5 : 4.5, 0, TAU); g.fill();
            g.fillStyle = "#ffffff"; g.beginPath(); g.arc(x + 1.8, y - 1.5, 1.6, 0, TAU); g.fill();
        }
        g.fillStyle = "rgba(255,120,170,.5)";
        for (const side of [-1, 1]) { g.beginPath(); g.ellipse(side * 24, 6, 5, 3, 0, 0, TAU); g.fill(); }
        // mouth
        const open = Math.max(s.talk, wow ? 0.7 : 0);
        g.strokeStyle = "#2a1640";
        g.lineWidth = 2.4;
        if (open > 0.1) { g.fillStyle = "#5a1838"; g.beginPath(); g.ellipse(0, 10, 5, 2 + open * 4, 0, 0, TAU); g.fill(); }
        else { g.beginPath(); g.moveTo(-6, 9); g.quadraticCurveTo(0, sad ? 5 : 14, 6, 9); g.stroke(); }
        g.restore();
    }

    // ---------------------------------------------------------------------------------------------
    // Sounds: bloops, harp glissandos, a whale's song
    // ---------------------------------------------------------------------------------------------
    const bloop = (t, f, v = 0.1) => tone({ t, f, f2: f * 2.2, type: "sine", d: 0.12, v, a: 0.01 });
    const harp = (t, notes, v = 0.045, step = 0.05) => notes.forEach((n, i) => tone({ t: t + i * step, f: midi(n), type: "triangle", d: 0.9, v, echo: 0.35 }));
    const sounds = {
        type: () => bloop(0, U.rand(280, 520), 0.09),
        erase: () => tone({ f: 500, f2: 200, type: "sine", d: 0.12, v: 0.07 }),
        move: () => {},
        word: () => { harp(0, [72, 76, 79, 84, 88]); bloop(0.3, 600, 0.05); },
        wrong: () => { tone({ f: 200, f2: 140, type: "sine", d: 0.4, v: 0.14, vib: 12 }); },
        right: () => harp(0, [79, 83, 86, 91, 95], 0.04, 0.045),
        reveal: () => { noise({ type: "lowpass", f: 600, f2: 2400, d: 0.4, v: 0.06 }); bloop(0.1, 700, 0.05); },
        flip: () => bloop(0, U.rand(500, 800), 0.05),
        bubbles: () => { for (let i = 0; i < 14; i++) bloop(i * 0.05 + Math.random() * 0.03, U.rand(300, 900), 0.06); },
        creak: () => tone({ f: 120, f2: 180, type: "sawtooth", d: 0.35, v: 0.05, filt: { f: 900 }, vib: 30 }),
        treasure: () => { noise({ type: "highpass", f: 5000, d: 0.8, v: 0.06 }); harp(0, [72, 76, 79, 84, 88, 91, 96], 0.05, 0.06); for (let i = 0; i < 10; i++) tone({ t: 0.2 + i * 0.06, f: U.rand(2400, 3600), type: "triangle", d: 0.12, v: 0.02 }); },
        whale: () => { tone({ f: 220, f2: 380, type: "sine", d: 1.6, v: 0.08, a: 0.4, vib: 6, echo: 0.5 }); tone({ t: 1.4, f: 380, f2: 260, type: "sine", d: 1.4, v: 0.06, a: 0.3, vib: 5, echo: 0.5 }); },
        win: () => {},
        streak: () => harp(0, [67, 72, 76, 79, 84], 0.05, 0.06),
        achievement: () => { harp(0, [76, 79, 83, 88], 0.05, 0.08); bloop(0.35, 900, 0.05); },
        title: () => { noise({ type: "lowpass", f: 300, f2: 1400, d: 0.9, v: 0.1, a: 0.3 }); harp(0.3, [60, 64, 67, 72, 76, 79], 0.04, 0.06); },
        tile: i => bloop(0, 300 + (i % 8) * 60, 0.07),
        start: () => { for (let i = 0; i < 8; i++) bloop(i * 0.04, 300 + i * 70, 0.06); harp(0.35, [60, 67, 72, 76, 79, 84], 0.045, 0.07); },
        select: () => bloop(0, 900, 0.05),
        nav: () => { noise({ type: "lowpass", f: 400, f2: 1600, d: 0.3, v: 0.06 }); bloop(0.05, 700, 0.04); },
        mascot: () => { bloop(0, 400, 0.07); bloop(0.08, 650, 0.06); }
    };

    Worlds.register({
        id: "ocean", name: "Coral Reef", icon: "\u{1F420}", tagline: "A sunlit reef by day, glowing deep-sea creatures by night",
        modes: ["light", "dark"],
        scene, board, celebrate, titleCard, sounds, transition: "tide",
        mascot: { name: "OTTO", draw: drawOtto },
        lines: {
            hello: ["Ahoy! I'm Otto. Eight arms, zero clues... let's find some!", "Welcome to the reef! The puzzles are swimming in.", "Dive in, the water's lovely today!"],
            start: ["Tap a square and start typing. Space flips Across and Down!", "Every letter leaves a little treasure. Let's fill the board!"],
            word: ["Fin-tastic!", "Shell yeah!", "Whale done!", "That's o-fish-al!", "Reel-y good!", "Swimmingly!"],
            win: ["You found the treasure!", "Fin-ished! Whale of a solve!", "Treasure unlocked, captain!"],
            wrong: ["Hmm, something's a little fishy.", "A few letters are lost at sea."],
            right: ["All shipshape!", "Clear waters ahead!"],
            idle: ["Stuck in the kelp? Try a crossing word.", "Even octopuses need a hint sometimes. Try the shortest clue!"],
            reveal: ["Surfacing a hint...", "Here's a pearl of wisdom."]
        },
        introFlourish(stage) {
            const p = U.center(stage);
            FX.ring({ x: p.x, y: p.y, color: "#8fe3ff", r1: Math.max(innerWidth, innerHeight) * 0.6, dur: 1.2, width: 16 });
            FX.burst({ x: p.x, y: p.y, n: 70, colors: ["#ffffff", "#bff3ff", "#8fe3ff"], shape: "bubble", speed: [100, 450], gravity: -120, drag: 1.2, life: [1.4, 2.4], size: [3, 10], wobble: 30 });
        }
    });
})();
