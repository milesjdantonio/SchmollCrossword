// The Big Top Carnival's background (carnival.js uses it). A fairground at the end of the afternoon:
//   far off, hills with a little town and a wooden roller coaster whose train climbs, plunges and rattles round,
//   and a drop tower whose ring of seats creeps up and falls; a great Ferris wheel (a trussed double rim, paired
//   spokes, a riveted hub) turning with its gondolas hanging level and swinging; the big top (a sagging striped
//   roof and a round striped wall in perspective, a scalloped, tasselled valance, guy ropes, flags on its poles, an
//   arched marquee over a warm doorway); a carousel (a painted rounding board and striped canopy, a mirrored
//   column, horses riding up and down as it turns); game booths (a balloon-dart wall, a milk-bottle pyramid,
//   plush prizes) under striped awnings; strings of pennants and bulbs overhead; people strolling the midway; a
//   sawdust path with popcorn and tickets dropped on it; a popcorn cart steaming, lamp posts, hay bales and a
//   balloon seller, whose balloons now and then slip away. Day: a warm low sun, shaded clouds, birds.
//   Night: a violet sky and a moon, the fair glowing on the horizon, everything outlined in bulbs that chase,
//   searchlights sweeping and fireworks bursting over the tent.
function CarnivalScene(W, H, opts) {
    const night = opts.theme === "dark", preview = !!opts.preview, TAU = Math.PI * 2, M = 40;
    const P = night
        ? { sky: ["#070418", "#141036", "#2c1a4e", "#5a2458", "#8a3a4a"], hills: ["#2a2048", "#1c1834", "#151428"], trees: "#0f1022",
            grass: ["#1a2a24", "#14201c", "#0e1814"], path: ["#4a3a34", "#3a2e2a"], red: "#a3202f", white: "#d8cfe2", steel: "#6a5a8e", steelDark: "#3a3058",
            wood: ["#4a3438", "#2e2028", "#5a4248"], far: "#3a3058", farLit: "rgba(255,190,120,", gold: "#e8b830", canvasShade: "rgba(20,6,40," }
        : { sky: ["#2f7fd6", "#6fb0ea", "#b9dcf2", "#f6e8cc", "#f4d6ac"], hills: ["#b8c8cc", "#93b09a", "#6f9a6a"], trees: "#4f7f48",
            grass: ["#86c45e", "#6fb04c", "#5a9a3e"], path: ["#ecd3a0", "#d9b981"], red: "#e2343e", white: "#fbf6ee", steel: "#eef1f6", steelDark: "#a9b2c4",
            wood: ["#c89a6a", "#9a7048", "#e0b888"], far: "#a9bccb", farLit: null, gold: "#f2bf2a", canvasShade: "rgba(60,20,30," };
    const FLAGS = ["#ff4a5a", "#ffcf3a", "#3aa0ff", "#3ac47a", "#b06aff", "#ff8a2a"];
    const k = () => (preview ? 0.5 : U.clamp(Math.min(W, H) / 900, 0.6, 1.15));

    // ---- small helpers -------------------------------------------------------------------------
    function paint(w, h, fn) { const c = Worlds.canvas(w, h), g = c.getContext("2d"); fn(g); return c; }
    const mixed = new Map(), rgbOf = new Map();
    const rgb = c => { let v = rgbOf.get(c); if (!v) rgbOf.set(c, v = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))); return v; };
    const mix = (a, b, t) => {
        const q = Math.round(t * 64), key = a + b + q;
        let v = mixed.get(key);
        if (!v) { const pa = rgb(a), pb = rgb(b); mixed.set(key, v = "#" + pa.map((x, i) => Math.round(x + (pb[i] - x) * q / 64).toString(16).padStart(2, "0")).join("")); }
        return v;
    };
    const dk = (c, t) => mix(c, "#000000", t), lt = (c, t) => mix(c, "#ffffff", t);
    // thousands of specks and blades grouped by colour into one path each, filled or stroked once per colour
    function batch() {
        const fills = new Map(), strokes = new Map();
        const at = (m, key) => { let p = m.get(key); if (!p) m.set(key, p = new Path2D()); return p; };
        return {
            rect(col, x, y, w, h) { at(fills, col).rect(x, y, w, h); },
            dot(col, x, y, r) { const p = at(fills, col); p.moveTo(x + r, y); p.arc(x, y, r, 0, TAU); },
            line(col, lw, x, y, x2, y2) { const p = at(strokes, col + "|" + lw.toFixed(1)); p.moveTo(x, y); p.lineTo(x2, y2); },
            curve(col, lw, x, y, cx, cy, ex, ey) { const p = at(strokes, col + "|" + lw.toFixed(1)); p.moveTo(x, y); p.quadraticCurveTo(cx, cy, ex, ey); },
            flush(g) {
                for (const [col, p] of fills) { g.fillStyle = col; g.fill(p); }
                g.lineCap = "round";
                for (const [key, p] of strokes) { const i = key.lastIndexOf("|"); g.strokeStyle = key.slice(0, i); g.lineWidth = +key.slice(i + 1); g.stroke(p); }
                fills.clear(); strokes.clear();
            },
        };
    }
    // a soft light (a bulb, a lamp): one cached sprite per colour, stamped
    const glows = new Map();
    function glowImg(col) {
        let c = glows.get(col);
        if (!c) {
            c = paint(64, 64, g => {
                const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
                gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.12, col); gr.addColorStop(0.35, col + "88"); gr.addColorStop(1, col + "00");
                g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
            });
            glows.set(col, c);
        }
        return c;
    }
    function bulb(g, x, y, r, col, a = 1) { if (a <= 0) return; g.globalAlpha = a; g.drawImage(glowImg(col), x - r * 4, y - r * 4, r * 8, r * 8); g.globalAlpha = 1; }
    // a cloud: a lumpy silhouette, lit from the low sun on the left, a flat grey-violet underside and soft creases
    function cloudImg(R, w, h) {
        return paint(w + 20, h * 1.7 + 20, g => {
            g.translate(0, h * 0.7);
            const blobs = [];
            const n = 7 + Math.floor(R() * 5);
            for (let i = 0; i < n; i++) {
                const u = (i + 0.5) / n, r = h * (0.28 + Math.sin(u * Math.PI) * 0.32) * (0.8 + R() * 0.4);
                blobs.push([10 + u * w, 10 + h - r * 0.7 - R() * h * 0.08, r]);
            }
            const shape = new Path2D();
            for (const [x, y, r] of blobs) { shape.moveTo(x + r, y); shape.arc(x, y, r, 0, TAU); }
            for (let i = 0; i < 6; i++) { const u = 0.15 + i * 0.14, r = h * (0.2 + R() * 0.08); shape.moveTo(10 + u * w + r, 10 + h - r); shape.arc(10 + u * w, 10 + h - r, r, 0, TAU); }
            g.save(); g.clip(shape);
            const bg = g.createLinearGradient(0, 10 - h * 0.5, 0, 10 + h);
            bg.addColorStop(0, "#ffffff"); bg.addColorStop(0.55, "#fbf3ea"); bg.addColorStop(0.85, "#e2def0"); bg.addColorStop(1, "#cfcce2");
            g.fillStyle = bg; g.fillRect(0, -h, w + 20, h * 2 + 20);
            const sun = g.createLinearGradient(10, 0, 10 + w, 0);
            sun.addColorStop(0, "rgba(255,226,180,.45)"); sun.addColorStop(0.5, "rgba(255,226,180,0)"); sun.addColorStop(1, "rgba(120,110,170,.14)");
            g.fillStyle = sun; g.fillRect(0, -h, w + 20, h * 2 + 20);
            g.strokeStyle = "rgba(150,145,190,.22)"; g.lineWidth = 2;
            for (const [x, y, r] of blobs) { g.beginPath(); g.arc(x + r * 0.15, y + r * 0.2, r * 0.8, Math.PI * 0.15, Math.PI * 0.75); g.stroke(); }
            g.restore();
        });
    }

    // ---- the layout and the painted layers ---------------------------------------------------
    let L = null;                       // everything measured in setup
    let clouds = [], birds = [], stars = [], balloons = [], fireworks = [], people = [];
    let nextFw = 1.5, nextBalloon = preview ? 1e9 : 4;

    function setup() {
        const R = U.rng(31415), s = k(), LW = W + M * 2, X = f => M + W * f;
        const GY = H * 0.8, HZ = H * 0.6;
        L = { s, LW, X, GY, HZ, bulbs: { mid: [], front: [] } };

        // the sky (no parallax)
        L.sky = paint(W, H, g => {
            const sg = g.createLinearGradient(0, 0, 0, GY);
            P.sky.forEach((c, i) => sg.addColorStop(i / (P.sky.length - 1), c));
            g.fillStyle = sg; g.fillRect(0, 0, W, H);
            if (night) {
                const fg = g.createRadialGradient(W * 0.55, GY, 0, W * 0.55, GY, W * 0.6);           // the fair lights the sky
                fg.addColorStop(0, "rgba(255,140,90,.32)"); fg.addColorStop(0.5, "rgba(200,70,120,.1)"); fg.addColorStop(1, "rgba(120,40,120,0)");
                g.fillStyle = fg; g.fillRect(0, 0, W, GY);
                const b = batch();
                for (let i = 0; i < (preview ? 80 : 420); i++) {
                    const y = Math.pow(R(), 1.5) * HZ * 0.95, a = 0.2 + R() * 0.6 * (1 - y / HZ);
                    b.rect(`rgba(255,${235 + (R() * 20 | 0)},${220 + (R() * 35 | 0)},${a.toFixed(1)})`, R() * W, y, R() < 0.1 ? 1.6 : 1, R() < 0.1 ? 1.6 : 1);
                }
                b.flush(g);
                const mx = W * 0.13, my = H * 0.15, mr = Math.min(W, H) * 0.038;             // a full moon
                Worlds.glow(g, mx, my, mr * 6, "#d8c8ff", 0.3);
                const mg = g.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr);
                mg.addColorStop(0, "#fffaf0"); mg.addColorStop(1, "#e6dcc8");
                g.fillStyle = mg; g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill();
                g.fillStyle = "rgba(160,150,150,.25)";
                for (const [dx, dy, r] of [[-0.3, -0.2, 0.22], [0.25, 0.1, 0.18], [-0.05, 0.4, 0.14], [0.35, -0.35, 0.1]]) { g.beginPath(); g.arc(mx + dx * mr, my + dy * mr, r * mr, 0, TAU); g.fill(); }
            } else {
                const sx = W * 0.12, sy = H * 0.22;                                                // a warm low sun
                const hg = g.createRadialGradient(sx, sy, 0, sx, sy, W * 0.5);
                hg.addColorStop(0, "rgba(255,236,190,.55)"); hg.addColorStop(0.25, "rgba(255,226,170,.18)"); hg.addColorStop(1, "rgba(255,220,170,0)");
                g.fillStyle = hg; g.fillRect(0, 0, W, H);
                Worlds.glow(g, sx, sy, Math.min(W, H) * 0.09, "#fff4d0", 0.8);
                g.fillStyle = "#fffbec"; g.beginPath(); g.arc(sx, sy, Math.min(W, H) * 0.035, 0, TAU); g.fill();
            }
        });

        // far away (x2.5): hills, a town, the roller coaster's trestles and track, the drop tower's mast
        const track = [[0.43, 0.06], [0.47, 0.3], [0.52, 0.04], [0.57, 0.2], [0.615, 0.1], [0.66, 0.24], [0.71, 0.05], [0.76, 0.17], [0.82, 0.07], [0.88, 0.2], [0.94, 0.06], [1.0, 0.15], [1.06, 0.08]]
            .map(([x, h]) => [X(x), GY - H * 0.03 - h * H * 0.85]);
        const TRK = [];                                                     // the track sampled every 2 px (x -> y)
        for (let i = 0; i < track.length - 1; i++) {
            const p0 = track[Math.max(0, i - 1)], p1 = track[i], p2 = track[i + 1], p3 = track[Math.min(track.length - 1, i + 2)];
            for (let x = p1[0]; x < p2[0]; x += 2) {
                const u = (x - p1[0]) / (p2[0] - p1[0]), u2 = u * u, u3 = u2 * u;
                const y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * u + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3);
                TRK.push([x, y]);
            }
        }
        L.track = TRK;
        L.tower = { x: X(0.255), top: GY - H * 0.52, base: GY - H * 0.03, w: 12 * s };
        L.far = paint(LW, H, g => {
            const ridge = (x, base, amp, f, ph) => base - (Math.sin(x * f + ph) * 0.5 + 0.5) * amp - Math.sin(x * f * 2.7 + ph * 2) * amp * 0.25;
            [[HZ - H * 0.02, H * 0.07, 0.004, 1.2, P.hills[0]], [HZ + H * 0.03, H * 0.06, 0.006, 3.1, P.hills[1]], [HZ + H * 0.08, H * 0.05, 0.009, 0.4, P.hills[2]]].forEach(([base, amp, f, ph, col], j) => {
                g.fillStyle = col; g.beginPath(); g.moveTo(0, GY);
                for (let x = 0; x <= LW; x += 6) g.lineTo(x, ridge(x, base, amp, f, ph));
                g.lineTo(LW, GY); g.fill();
                if (j > 0) {                                                    // tree lines along the nearer ridges
                    const b = batch(), tc = j === 1 ? mix(P.trees, P.hills[1], 0.45) : P.trees;
                    for (let x = 0; x <= LW; x += (3 + R() * 5) * s) {
                        if (R() < 0.35) continue;
                        const y = ridge(x, base, amp, f, ph), r = (3 + R() * 4) * s * (j === 2 ? 1.3 : 1);
                        b.dot(tc, x, y - r * 0.4, r); if (!night) b.dot(lt(tc, 0.15), x - r * 0.3, y - r * 0.8, r * 0.45);
                    }
                    b.flush(g);
                }
            });
            // a little town on the far hill: roofs, a steeple, windows lit at night
            const tb = batch();
            for (let i = 0; i < 9; i++) {
                const x = X(0.03 + i * 0.022 + R() * 0.008), y = ridge(x, HZ + H * 0.03, H * 0.06, 0.006, 3.1) + 3, w = (9 + R() * 8) * s, h = (7 + R() * 8) * s;
                const wall = night ? "#2a2444" : mix("#e8dcc8", P.hills[1], 0.35), roof = night ? "#1e1a34" : mix(["#b8584a", "#8a6a5a", "#6a7a8a"][i % 3], P.hills[1], 0.3);
                tb.rect(wall, x, y - h, w, h);
                g.fillStyle = roof; g.beginPath(); g.moveTo(x - 2 * s, y - h); g.lineTo(x + w / 2, y - h - w * 0.45); g.lineTo(x + w + 2 * s, y - h); g.fill();
                if (i === 4) { g.fillStyle = wall; g.fillRect(x + w * 0.35, y - h - w * 1.6, w * 0.3, w * 1.2); g.fillStyle = roof; g.beginPath(); g.moveTo(x + w * 0.3, y - h - w * 1.6); g.lineTo(x + w / 2, y - h - w * 2.5); g.lineTo(x + w * 0.7, y - h - w * 1.6); g.fill(); }
                if (night) for (let j = 0; j < 2; j++) if (R() < 0.7) tb.rect("rgba(255,210,130,.85)", x + w * (0.2 + j * 0.4), y - h * 0.6, 2 * s, 2.4 * s);
            }
            tb.flush(g);
            // the drop tower's mast: a lattice of two rails and zigzag bracing, a crown on top
            const T = L.tower, mb = batch(), mc = night ? P.far : "#c9d3de";
            for (const dx of [-T.w / 2, T.w / 2]) mb.line(mc, 2.2 * s, T.x + dx, T.top, T.x + dx, T.base);
            for (let y = T.top + 4; y < T.base; y += T.w) { mb.line(mc, 1, T.x - T.w / 2, y, T.x + T.w / 2, y + T.w / 2); mb.line(mc, 1, T.x + T.w / 2, y + T.w / 2, T.x - T.w / 2, y + T.w); }
            mb.flush(g);
            g.fillStyle = night ? "#4a3a6a" : "#e04a4a"; g.beginPath(); g.moveTo(T.x - T.w * 1.3, T.top); g.lineTo(T.x, T.top - T.w * 2.2); g.lineTo(T.x + T.w * 1.3, T.top); g.fill();
            g.fillStyle = night ? "#3a2c50" : "#b8c2cc"; g.fillRect(T.x - T.w * 1.4, T.top, T.w * 2.8, 3 * s);
            // the roller coaster: trestle bents with cross-bracing, ledgers, then the two rails and their ties
            const cb = batch(), wc = night ? P.far : "#e8ecf2", wcd = night ? mix(P.far, "#000000", 0.3) : "#b9c6d4";
            for (let i = 0; i < TRK.length; i += 7) {
                const [x, y] = TRK[i];
                cb.line(i % 14 ? wcd : wc, 1.2 * s, x, y + 4 * s, x, GY - H * 0.02);
                const nx = TRK[Math.min(TRK.length - 1, i + 7)];
                for (let yy = y + 14 * s; yy < GY - H * 0.03; yy += 16 * s) {
                    cb.line(wcd, 0.8, x, yy, nx[0], Math.max(nx[1] + 4 * s, yy + 10 * s));
                    cb.line(wcd, 0.8, x, Math.max(y + 4 * s, yy + 10 * s), nx[0], yy);
                }
            }
            cb.flush(g);
            g.lineJoin = "round";
            g.strokeStyle = night ? "#5a4a80" : "#ffffff"; g.lineWidth = 2.6 * s;
            g.beginPath(); TRK.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
            g.strokeStyle = night ? "#2a2244" : "#8fa2b8"; g.lineWidth = 1.4 * s;
            g.beginPath(); TRK.forEach(([x, y], i) => (i ? g.lineTo(x, y + 4 * s) : g.moveTo(x, y + 4 * s))); g.stroke();
            if (night) { g.strokeStyle = "rgba(255,120,200,.35)"; g.lineWidth = 1; g.beginPath(); TRK.forEach(([x, y], i) => (i ? g.lineTo(x, y - 1.5) : g.moveTo(x, y - 1.5))); g.stroke(); }
            // the far fairground's haze where it meets the near ground
            const hz = g.createLinearGradient(0, GY - H * 0.08, 0, GY);
            hz.addColorStop(0, night ? "rgba(60,30,80,0)" : "rgba(246,232,204,0)"); hz.addColorStop(1, night ? "rgba(90,40,90,.5)" : "rgba(246,232,204,.55)");
            g.fillStyle = hz; g.fillRect(0, GY - H * 0.08, LW, H * 0.08);
        });

        // the Ferris wheel (x5): its turning rim as one sprite, its legs and platform as two more
        const r = Math.min(H * 0.3, 270 * s), wx = X(0.81), wy = GY - r - 34 * s;
        L.wheel = { x: wx, y: wy, r, n: 16 };
        const D = Math.ceil(r * 2 + 30);
        L.wheelImg = paint(D, D, g => {
            const c = D / 2, b = batch(), st = P.steel, sd = P.steelDark;
            for (let i = 0; i < 16; i++) {                                       // paired spokes, braced at the middle
                const a = (i / 16) * TAU;
                for (const off of [-0.035, 0.035]) b.line(sd, 2.2 * s, c + Math.cos(a + off) * r * 0.07, c + Math.sin(a + off) * r * 0.07, c + Math.cos(a) * r * 0.86, c + Math.sin(a) * r * 0.86);
                for (const off of [-0.035, 0.035]) b.line(st, 1.2 * s, c + Math.cos(a + off) * r * 0.07, c + Math.sin(a + off) * r * 0.07 - 0.6, c + Math.cos(a) * r * 0.86, c + Math.sin(a) * r * 0.86 - 0.6);
                const a2 = ((i + 1) / 16) * TAU;
                b.line(sd, 1, c + Math.cos(a) * r * 0.5, c + Math.sin(a) * r * 0.5, c + Math.cos(a2) * r * 0.5, c + Math.sin(a2) * r * 0.5);
                b.line(sd, 0.8, c + Math.cos(a) * r * 0.5, c + Math.sin(a) * r * 0.5, c + Math.cos(a2) * r * 0.86, c + Math.sin(a2) * r * 0.86);
            }
            for (let i = 0; i < 96; i++) {                                       // the truss between the two rims
                const a = (i / 96) * TAU, a2 = ((i + 1) / 96) * TAU, r1 = i % 2 ? r * 0.86 : r, r2 = i % 2 ? r : r * 0.86;
                b.line(sd, 1.1 * s, c + Math.cos(a) * r1, c + Math.sin(a) * r1, c + Math.cos(a2) * r2, c + Math.sin(a2) * r2);
            }
            b.flush(g);
            for (const [rr, w, col] of [[r, 3.4 * s, sd], [r - 1, 1.8 * s, st], [r * 0.86, 2.6 * s, sd], [r * 0.86 - 1, 1.2 * s, st]]) { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.arc(c, c, rr, 0, TAU); g.stroke(); }
            if (!night) { g.fillStyle = "#fff8e0"; for (let i = 0; i < 64; i++) { const a = (i / 64) * TAU; g.beginPath(); g.arc(c + Math.cos(a) * r, c + Math.sin(a) * r, 1.5 * s, 0, TAU); g.fill(); } }
            const hg = g.createRadialGradient(c - r * 0.03, c - r * 0.03, 0, c, c, r * 0.1);       // the hub
            hg.addColorStop(0, night ? "#b8a8e0" : "#ffffff"); hg.addColorStop(1, night ? "#4a3a6a" : "#9aa6b8");
            g.fillStyle = hg; g.beginPath(); g.arc(c, c, r * 0.1, 0, TAU); g.fill();
            g.fillStyle = night ? "#e8b830" : "#e2343e"; g.beginPath();
            for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * TAU, rr = i % 2 ? r * 0.028 : r * 0.065; g.lineTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr); }
            g.fill();
            g.fillStyle = night ? "#2a2044" : "#6a7488"; for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; g.beginPath(); g.arc(c + Math.cos(a) * r * 0.085, c + Math.sin(a) * r * 0.085, 1.2 * s, 0, TAU); g.fill(); }
        });
        const legs = (g, ox, oy, front) => {                                      // the A-frame (front legs are heavier)
            const st = front ? P.steel : P.steelDark, sd = front ? P.steelDark : dk(P.steelDark, 0.25), spread = r * (front ? 0.62 : 0.5);
            for (const sd2 of [-1, 1]) {
                const bx = wx + sd2 * spread - ox, by = GY - oy;
                g.strokeStyle = sd; g.lineWidth = (front ? 9 : 6) * s; g.beginPath(); g.moveTo(bx, by); g.lineTo(wx - ox, wy - oy); g.stroke();
                g.strokeStyle = st; g.lineWidth = (front ? 4 : 3) * s; g.beginPath(); g.moveTo(bx - 1.5 * s, by); g.lineTo(wx - ox - 1.5 * s, wy - oy); g.stroke();
                for (let j = 1; j < 6; j++) {                                    // bracing between the two members
                    const u = j / 6, x1 = U.lerp(bx, wx - ox, u), y1 = U.lerp(by, wy - oy, u);
                    g.strokeStyle = sd; g.lineWidth = 1.4 * s; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - sd2 * 10 * s * (1 - u), y1 + 14 * s); g.stroke();
                }
            }
            g.strokeStyle = sd; g.lineWidth = 3 * s; const yb = U.lerp(GY, wy, 0.45) - oy;
            g.beginPath(); g.moveTo(U.lerp(wx - spread, wx, 0.45) - ox, yb); g.lineTo(U.lerp(wx + spread, wx, 0.45) - ox, yb); g.stroke();
        };
        const box = { x: wx - r * 0.8, y: wy - 20, w: r * 1.6, h: GY - wy + 40 * s };
        L.wheelBack = paint(box.w, box.h, g => legs(g, box.x, box.y, false));
        L.wheelFront = paint(box.w, box.h, g => {
            legs(g, box.x, box.y, true);
            // the boarding platform and its little ticket kiosk
            const px = wx - box.x, py = GY - box.y;
            g.fillStyle = night ? "#2a2238" : "#d8c8b0"; g.fillRect(px - r * 0.42, py - 10 * s, r * 0.84, 10 * s);
            g.fillStyle = night ? "#1a1428" : "#a89070"; g.fillRect(px - r * 0.42, py - 2 * s, r * 0.84, 2 * s);
            g.strokeStyle = night ? "#6a5a8e" : "#ffffff"; g.lineWidth = 1.5 * s; g.beginPath();
            for (let i = 0; i <= 10; i++) { const x = px - r * 0.42 + i * r * 0.084; g.moveTo(x, py - 10 * s); g.lineTo(x, py - 22 * s); }
            g.moveTo(px - r * 0.42, py - 22 * s); g.lineTo(px + r * 0.42, py - 22 * s); g.stroke();
            const kx = px + r * 0.5, kw = 26 * s, kh = 34 * s;
            g.fillStyle = night ? "#5a1a2a" : "#e2343e"; g.fillRect(kx, py - kh, kw, kh);
            g.fillStyle = night ? "rgba(255,200,120,.85)" : "#cfe8f6"; g.fillRect(kx + 4 * s, py - kh + 7 * s, kw - 8 * s, 11 * s);
            g.fillStyle = P.white; g.beginPath(); g.moveTo(kx - 4 * s, py - kh); g.lineTo(kx + kw / 2, py - kh - 12 * s); g.lineTo(kx + kw + 4 * s, py - kh); g.fill();
        });
        L.wheelBox = box;
        // a gondola for each colour: a domed roof with a fringe, a body with a window band
        L.gondolas = FLAGS.map(col => paint(40 * s, 46 * s, g => {
            const w = 40 * s, c = w / 2, body = night ? dk(col, 0.35) : col;
            g.strokeStyle = night ? P.steel : "#8a93a6"; g.lineWidth = 1.6 * s; g.beginPath(); g.moveTo(c, 0); g.lineTo(c, 10 * s); g.stroke();
            g.fillStyle = night ? dk(col, 0.2) : lt(col, 0.1); g.beginPath(); g.ellipse(c, 13 * s, 15 * s, 6 * s, 0, Math.PI, 0); g.fill();
            g.fillStyle = P.white; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(c - 13 * s + i * 5.2 * s, 13.5 * s, 2.3 * s, 0, Math.PI); g.fill(); }
            g.strokeStyle = night ? P.steelDark : "#c0c6d2"; g.lineWidth = 1.2 * s; g.beginPath(); g.moveTo(c - 11 * s, 14 * s); g.lineTo(c - 11 * s, 24 * s); g.moveTo(c + 11 * s, 14 * s); g.lineTo(c + 11 * s, 24 * s); g.stroke();
            const bg = g.createLinearGradient(c - 14 * s, 0, c + 14 * s, 0);
            bg.addColorStop(0, lt(body, 0.25)); bg.addColorStop(0.45, body); bg.addColorStop(1, dk(body, 0.3));
            g.fillStyle = bg; g.beginPath(); g.roundRect(c - 14 * s, 23 * s, 28 * s, 17 * s, [3 * s, 3 * s, 8 * s, 8 * s]); g.fill();
            g.fillStyle = night ? "rgba(255,214,150,.9)" : "rgba(255,255,255,.6)"; g.fillRect(c - 11 * s, 26 * s, 22 * s, 4 * s);
            g.fillStyle = night ? "rgba(40,20,40,.8)" : "rgba(60,40,40,.55)";                       // two riders' heads
            g.beginPath(); g.arc(c - 4 * s, 25 * s, 2.4 * s, 0, TAU); g.arc(c + 5 * s, 25.5 * s, 2.2 * s, 0, TAU); g.fill();
        }));

        // the middle ground (x7): grass, the path, the booths, the big top, the carousel's platform
        const T = { x: X(0.39), y: GY + 6 * s, w: Math.min(W * 0.36, 560 * s), h: Math.min(H * 0.44, 380 * s) };
        T.wallH = T.h * 0.36; T.wallTop = T.y - T.wallH; T.rx = T.w / 2; T.ry = T.w * 0.07; T.peakY = T.wallTop - T.h * 0.56;
        L.tent = T;
        const C = { x: X(0.105), y: GY + 16 * s, rx: Math.min(W * 0.095, 130 * s), h: Math.min(H * 0.22, 190 * s) };
        C.ry = C.rx * 0.22;
        L.carousel = C;
        L.mid = paint(LW, H, g => {
            // grass: darker toward the front, mowing bands, blades and clover
            const gg = g.createLinearGradient(0, GY - H * 0.02, 0, H);
            gg.addColorStop(0, P.grass[0]); gg.addColorStop(0.5, P.grass[1]); gg.addColorStop(1, P.grass[2]);
            g.fillStyle = gg; g.fillRect(0, GY - H * 0.02, LW, H);
            g.fillStyle = night ? "rgba(255,255,255,.015)" : "rgba(255,255,255,.06)";
            for (let i = 0; i < 6; i++) { const y = GY + (H - GY) * (i / 6) ** 1.4; g.fillRect(0, y, LW, (H - GY) * 0.05 * (1 + i * 0.4)); }
            const gb = batch();
            for (let i = 0; i < (preview ? 900 : 5200); i++) {
                const d = R(), y = GY + d ** 1.3 * (H - GY), x = R() * LW, l = (2 + d * 9) * s;
                const col = R() < 0.5 ? (night ? "rgba(0,0,0,.25)" : "rgba(40,90,30,.35)") : (night ? "rgba(140,170,160,.08)" : "rgba(220,255,170,.35)");
                gb.line(col, 0.7 + d, x, y, x + (R() - 0.5) * 3, y - l);
            }
            for (let i = 0; i < (preview ? 20 : 120); i++) {
                const y = GY + R() ** 1.2 * (H - GY), x = R() * LW;
                gb.dot(night ? "rgba(200,190,230,.25)" : ["#ffffff", "#fff27a", "#ffb0c8"][i % 3], x, y, (1 + R() * 1.2) * s);
            }
            gb.flush(g);
            // the sawdust path from the tent's door, widening toward us
            const path = new Path2D(), pw = T.w * 0.13;
            path.moveTo(T.x - pw, T.y); path.lineTo(T.x + pw, T.y);
            path.bezierCurveTo(T.x + pw * 1.6, H * 0.88, T.x + W * 0.2, H * 0.94, T.x + W * 0.26, H + 10);
            path.lineTo(T.x - W * 0.3, H + 10);
            path.bezierCurveTo(T.x - W * 0.22, H * 0.93, T.x - pw * 1.8, H * 0.87, T.x - pw, T.y);
            g.save(); g.clip(path);
            const pg = g.createLinearGradient(0, T.y, 0, H);
            pg.addColorStop(0, P.path[1]); pg.addColorStop(1, P.path[0]);
            g.fillStyle = pg; g.fillRect(0, T.y - 2, LW, H);
            const pb = batch();
            for (let i = 0; i < (preview ? 1200 : 7000); i++) {
                const y = T.y + R() ** 0.8 * (H - T.y), x = T.x + (R() - 0.5) * W * 0.6, v = R();
                pb.rect(v < 0.5 ? (night ? "rgba(0,0,0,.18)" : "rgba(150,100,50,.18)") : (night ? "rgba(255,220,180,.06)" : "rgba(255,250,235,.4)"), x, y, (1 + R() * 2) * s, 1);
            }
            for (let i = 0; i < (preview ? 10 : 70); i++) {                    // popcorn, confetti, a few tickets
                const y = T.y + 10 + R() ** 0.7 * (H - T.y), x = T.x + (R() - 0.5) * W * 0.4, v = R();
                if (v < 0.45) { pb.dot(night ? "#a89a88" : "#fff8dc", x, y, 1.8 * s); pb.dot(night ? "#a89a88" : "#fff8dc", x + 1.6 * s, y - 0.6 * s, 1.4 * s); }
                else if (v < 0.9) pb.rect(FLAGS[i % 6] + (night ? "66" : ""), x, y, 3 * s, 1.6 * s);
                else pb.rect(night ? "#8a7a3a" : "#ffcf3a", x, y, 9 * s, 5 * s);
            }
            pb.flush(g);
            g.fillStyle = night ? "rgba(0,0,0,.25)" : "rgba(120,80,40,.15)"; g.lineWidth = 1;   // footprints
            for (let i = 0; i < 40; i++) { const u = R(), y = T.y + 20 + u * (H - T.y - 20), x = T.x + (R() - 0.5) * (pw * 2 + u * W * 0.35); g.beginPath(); g.ellipse(x, y, 2 * s, 3.4 * s, 0.2, 0, TAU); g.fill(); }
            g.restore();
            g.strokeStyle = night ? "rgba(0,0,0,.3)" : "rgba(110,80,40,.25)"; g.lineWidth = 2; g.stroke(path);
            // light pooling on the ground at night (the tent's door, the booths, the carousel)
            if (night) {
                g.globalCompositeOperation = "lighter";
                for (const [x, y, rr, a] of [[T.x, T.y + 20 * s, T.w * 0.45, 0.22], [C.x, C.y + 10 * s, C.rx * 1.8, 0.16], [X(0.66), GY + 18 * s, W * 0.08, 0.13], [X(0.74), GY + 18 * s, W * 0.08, 0.13]]) {
                    const lg = g.createRadialGradient(x, y, 0, x, y, rr); lg.addColorStop(0, `rgba(255,170,90,${a})`); lg.addColorStop(1, "rgba(255,170,90,0)");
                    g.fillStyle = lg; g.save(); g.translate(x, y); g.scale(1, 0.35); g.translate(-x, -y); g.fillRect(x - rr, y - rr, rr * 2, rr * 2); g.restore();
                }
                g.globalCompositeOperation = "source-over";
            }

            // ---- game booths: plank walls, a striped scalloped awning, a counter, the game, the prizes ----
            [[0.625, "darts", "#e2343e"], [0.7, "bottles", "#2f7ad8"], [0.775, "plush", "#2f9a5a"]].forEach(([f, kind, col]) => {
                const bw = 92 * s, bh = 84 * s, bx = X(f) - bw / 2, by = GY - bh + 4 * s;
                const wood = P.wood;
                g.fillStyle = dk(wood[1], night ? 0.3 : 0.1); g.fillRect(bx, by, bw, bh);                      // back wall
                g.fillStyle = night ? "#140e18" : "#4a2e22"; g.fillRect(bx + 5 * s, by + 18 * s, bw - 10 * s, bh * 0.52);
                if (kind === "darts") {                                         // a board of balloons
                    for (let j = 0; j < 4; j++) for (let i = 0; i < 7; i++) {
                        const x = bx + 12 * s + i * 11.5 * s, y = by + 26 * s + j * 10 * s, c = FLAGS[(i + j * 2) % 6];
                        const bgr = g.createRadialGradient(x - 1.5 * s, y - 2 * s, 0.5, x, y, 5 * s); bgr.addColorStop(0, lt(c, 0.6)); bgr.addColorStop(0.4, night ? dk(c, 0.2) : c); bgr.addColorStop(1, dk(c, 0.35));
                        g.fillStyle = bgr; g.beginPath(); g.ellipse(x, y, 4.2 * s, 5 * s, 0, 0, TAU); g.fill();
                    }
                } else if (kind === "bottles") {                                // a milk-bottle pyramid on a stand
                    g.fillStyle = dk(wood[0], 0.2); g.fillRect(bx + 26 * s, by + 58 * s, 40 * s, 6 * s);
                    for (let row = 0; row < 3; row++) for (let i = 0; i < 3 - row; i++) {
                        const x = bx + 34 * s + i * 12 * s + row * 6 * s, y = by + 58 * s - row * 15 * s;
                        g.fillStyle = night ? "#a8a0b8" : "#f4f6f8"; g.beginPath(); g.moveTo(x - 4.5 * s, y); g.lineTo(x - 4.5 * s, y - 8 * s); g.quadraticCurveTo(x - 4.5 * s, y - 11 * s, x - 2 * s, y - 13 * s); g.lineTo(x + 2 * s, y - 13 * s); g.quadraticCurveTo(x + 4.5 * s, y - 11 * s, x + 4.5 * s, y - 8 * s); g.lineTo(x + 4.5 * s, y); g.fill();
                        g.fillStyle = "#e2343e"; g.fillRect(x - 4.5 * s, y - 7 * s, 9 * s, 2 * s);
                    }
                    for (let i = 0; i < 3; i++) { g.fillStyle = FLAGS[i * 2]; g.beginPath(); g.arc(bx + 14 * s, by + 30 * s + i * 10 * s, 3.4 * s, 0, TAU); g.fill(); }
                } else {                                                        // shelves of plush bears
                    for (let row = 0; row < 2; row++) {
                        g.fillStyle = dk(wood[0], 0.15); g.fillRect(bx + 6 * s, by + 40 * s + row * 20 * s, bw - 12 * s, 2.5 * s);
                        for (let i = 0; i < 5; i++) {
                            const x = bx + 17 * s + i * 15 * s, y = by + 40 * s + row * 20 * s, c = ["#c8905a", "#f2a6c0", "#8ac8f0", "#f6e08a", "#b890e0"][(i + row * 2) % 5], cc = night ? dk(c, 0.35) : c;
                            g.fillStyle = cc; g.beginPath(); g.ellipse(x, y - 5 * s, 5 * s, 5.5 * s, 0, 0, TAU); g.fill();
                            g.beginPath(); g.arc(x, y - 13 * s, 4.2 * s, 0, TAU); g.fill();
                            g.beginPath(); g.arc(x - 3.4 * s, y - 16.5 * s, 1.7 * s, 0, TAU); g.arc(x + 3.4 * s, y - 16.5 * s, 1.7 * s, 0, TAU); g.fill();
                            g.fillStyle = "rgba(0,0,0,.6)"; g.beginPath(); g.arc(x - 1.4 * s, y - 13.5 * s, 0.7 * s, 0, TAU); g.arc(x + 1.4 * s, y - 13.5 * s, 0.7 * s, 0, TAU); g.fill();
                        }
                    }
                    for (let i = 0; i < 3; i++) { const x = bx + 20 * s + i * 26 * s, y = by + 18 * s; g.fillStyle = FLAGS[i + 2]; g.beginPath(); g.ellipse(x, y + 7 * s, 4 * s, 7 * s, 0, 0, TAU); g.fill(); }
                }
                // side posts with plank lines and the counter with a painted front
                const pg2 = g.createLinearGradient(bx, 0, bx + bw, 0);
                pg2.addColorStop(0, lt(wood[0], night ? 0 : 0.15)); pg2.addColorStop(1, dk(wood[0], 0.25));
                g.fillStyle = pg2; g.fillRect(bx, by, 6 * s, bh); g.fillRect(bx + bw - 6 * s, by, 6 * s, bh);
                const cy = by + bh * 0.68;
                g.fillStyle = pg2; g.fillRect(bx - 3 * s, cy, bw + 6 * s, bh - (cy - by));
                g.fillStyle = dk(wood[0], 0.35); g.fillRect(bx - 3 * s, cy, bw + 6 * s, 3 * s);
                g.strokeStyle = dk(wood[0], 0.3); g.lineWidth = 1;
                for (let y = cy + 8 * s; y < by + bh; y += 7 * s) { g.beginPath(); g.moveTo(bx - 3 * s, y); g.lineTo(bx + bw + 3 * s, y); g.stroke(); }
                g.fillStyle = night ? dk(col, 0.3) : col; g.beginPath(); g.arc(bx + bw / 2, cy + (bh - (cy - by)) / 2 + 1, 8 * s, 0, TAU); g.fill();
                g.fillStyle = P.white; g.beginPath(); g.arc(bx + bw / 2, cy + (bh - (cy - by)) / 2 + 1, 5 * s, 0, TAU); g.fill();
                g.fillStyle = night ? dk(col, 0.3) : col; g.beginPath(); g.arc(bx + bw / 2, cy + (bh - (cy - by)) / 2 + 1, 2.4 * s, 0, TAU); g.fill();
                // the awning: stripes, a slight slope, scallops, a sign board on top
                const ay = by - 4 * s, n = 8, aw = bw + 14 * s, ax = bx - 7 * s;
                for (let i = 0; i < n; i++) {
                    const x0 = ax + (i / n) * aw, x1 = ax + ((i + 1) / n) * aw, cc = i % 2 ? P.white : (night ? dk(col, 0.25) : col);
                    const sg = g.createLinearGradient(0, ay - 12 * s, 0, ay + 14 * s); sg.addColorStop(0, lt(cc, 0.12)); sg.addColorStop(1, dk(cc, 0.18));
                    g.fillStyle = sg; g.beginPath(); g.moveTo(x0 + 4 * s, ay - 12 * s); g.lineTo(x1 + 4 * s, ay - 12 * s); g.lineTo(x1, ay + 8 * s);
                    g.quadraticCurveTo((x0 + x1) / 2, ay + 15 * s, x0, ay + 8 * s); g.fill();
                }
                g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(bx + 5 * s, ay + 10 * s, bw - 10 * s, 5 * s);
                g.fillStyle = night ? "#3a2a40" : P.white; g.beginPath(); g.roundRect(X(f) - 22 * s, ay - 30 * s, 44 * s, 18 * s, 4 * s); g.fill();
                g.fillStyle = night ? dk(col, 0.2) : col; g.beginPath();
                for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * TAU, rr = i % 2 ? 3 * s : 7 * s; g.lineTo(X(f) + Math.cos(a) * rr, ay - 21 * s + Math.sin(a) * rr); }
                g.fill();
                for (let i = 0; i <= 8; i++) L.bulbs.mid.push([ax + (i / 8) * aw, ay + 9 * s, ["#ffe08a", "#ffb0b0", "#a8d8ff"][i % 3], i]);
            });

            // ---- the big top ----
            const { x, y, rx, ry, wallTop, peakY } = T;
            const stripes = 22, ang = i => Math.PI * (i / stripes);             // the front half of the round, left to right
            const at = (a, yy) => [x - Math.cos(a) * rx, yy + Math.sin(a) * ry];
            // guy ropes behind the tent first (to stakes on either side)
            g.strokeStyle = night ? "rgba(180,170,200,.35)" : "rgba(110,90,70,.55)"; g.lineWidth = 1;
            for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) { const sx = x + sd * (rx * 1.15 + i * 18 * s); g.beginPath(); g.moveTo(x + sd * rx * (0.7 + i * 0.09), wallTop + 2); g.lineTo(sx, y + 4 * s); g.stroke(); g.fillStyle = night ? "#3a2c30" : "#7a5a3a"; g.fillRect(sx - 1.5, y + 1 * s, 3, 5 * s); }
            // the wall: vertical stripes narrowing toward the sides, shaded like a drum
            for (let i = 0; i < stripes; i++) {
                const [xa] = at(ang(i), 0), [xb] = at(ang(i + 1), 0);
                g.fillStyle = i % 2 ? P.white : P.red; g.beginPath();
                g.moveTo(xa, wallTop + Math.sin(ang(i)) * ry); g.lineTo(xb, wallTop + Math.sin(ang(i + 1)) * ry);
                g.lineTo(xb, y + Math.sin(ang(i + 1)) * ry * 0.6); g.lineTo(xa, y + Math.sin(ang(i)) * ry * 0.6); g.fill();
            }
            const wallPath = new Path2D();
            for (let i = 0; i <= 40; i++) { const [wx2, wy2] = at(Math.PI * i / 40, wallTop); i ? wallPath.lineTo(wx2, wy2) : wallPath.moveTo(wx2, wy2); }
            for (let i = 40; i >= 0; i--) { const a = Math.PI * i / 40; wallPath.lineTo(x - Math.cos(a) * rx, y + Math.sin(a) * ry * 0.6); }
            wallPath.closePath();
            g.save(); g.clip(wallPath);
            const drum = g.createLinearGradient(x - rx, 0, x + rx, 0);
            drum.addColorStop(0, "rgba(0,0,0,.28)"); drum.addColorStop(0.12, night ? "rgba(255,190,140,.06)" : "rgba(255,240,210,.3)"); drum.addColorStop(0.4, "rgba(255,255,255,0)"); drum.addColorStop(0.78, P.canvasShade + ".22)"); drum.addColorStop(1, P.canvasShade + ".5)");
            g.fillStyle = drum; g.fillRect(x - rx, wallTop - 2, rx * 2, y - wallTop + ry);
            const foot = g.createLinearGradient(0, y - 30 * s, 0, y + ry * 0.6);
            foot.addColorStop(0, "rgba(0,0,0,0)"); foot.addColorStop(1, "rgba(0,0,0,.2)");
            g.fillStyle = foot; g.fillRect(x - rx, y - 30 * s, rx * 2, 30 * s + ry * 0.6);
            g.restore();
            // the roof: stripes from the king pole down to the eaves, sagging between the poles
            for (let i = 0; i < stripes; i++) {
                const [x0, y0] = at(ang(i), wallTop), [x1, y1] = at(ang(i + 1), wallTop);
                const sag = (a, ex, ey) => [U.lerp(x, ex, 0.55) + (ex - x) * 0.04, U.lerp(peakY, ey, 0.55) + T.h * 0.05];
                const c0 = sag(ang(i), x0, y0), c1 = sag(ang(i + 1), x1, y1);
                g.fillStyle = i % 2 ? P.white : P.red; g.beginPath(); g.moveTo(x, peakY);
                g.quadraticCurveTo(c0[0], c0[1], x0, y0); g.lineTo(x1, y1); g.quadraticCurveTo(c1[0], c1[1], x, peakY); g.fill();
            }
            const roofPath = new Path2D();
            roofPath.moveTo(x, peakY);
            { const [ex, ey] = at(0, wallTop); roofPath.quadraticCurveTo(U.lerp(x, ex, 0.55) + (ex - x) * 0.04, U.lerp(peakY, ey, 0.55) + T.h * 0.05, ex, ey); }
            for (let i = 1; i <= 40; i++) { const [ex, ey] = at(Math.PI * i / 40, wallTop); roofPath.lineTo(ex, ey); }
            { const [ex, ey] = at(Math.PI, wallTop); roofPath.quadraticCurveTo(U.lerp(x, ex, 0.55) + (ex - x) * 0.04, U.lerp(peakY, ey, 0.55) + T.h * 0.05, x, peakY); }
            g.save(); g.clip(roofPath);
            const roof = g.createLinearGradient(x - rx, 0, x + rx, 0);
            roof.addColorStop(0, "rgba(0,0,0,.2)"); roof.addColorStop(0.18, night ? "rgba(255,190,140,.08)" : "rgba(255,244,220,.32)"); roof.addColorStop(0.45, "rgba(255,255,255,0)"); roof.addColorStop(1, P.canvasShade + ".48)");
            g.fillStyle = roof; g.fillRect(x - rx * 1.1, peakY, rx * 2.2, wallTop - peakY + ry * 1.2);
            const roofV = g.createLinearGradient(0, peakY, 0, wallTop);
            roofV.addColorStop(0, "rgba(255,255,255,.12)"); roofV.addColorStop(1, "rgba(0,0,0,.08)");
            g.fillStyle = roofV; g.fillRect(x - rx * 1.1, peakY, rx * 2.2, wallTop - peakY + ry * 1.2);
            g.restore();
            // seams down the roof
            g.strokeStyle = "rgba(0,0,0,.1)"; g.lineWidth = 1;
            for (let i = 1; i < stripes; i++) { const [ex, ey] = at(ang(i), wallTop); g.beginPath(); g.moveTo(x, peakY); g.quadraticCurveTo(U.lerp(x, ex, 0.55), U.lerp(peakY, ey, 0.55) + T.h * 0.05, ex, ey); g.stroke(); }
            // the valance: scallops along the eaves, gold trim, a tassel at each point
            const nv = 26;
            for (let i = 0; i < nv; i++) {
                const a0 = Math.PI * (i / nv), a1 = Math.PI * ((i + 1) / nv), [x0, y0] = at(a0, wallTop), [x1, y1] = at(a1, wallTop), mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + 20 * s;
                g.fillStyle = i % 2 ? P.white : P.red; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.quadraticCurveTo(mx, my + 4 * s, x0, y0); g.fill();
                g.strokeStyle = P.gold; g.lineWidth = 2 * s; g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo(mx, my + 4 * s, x0, y0); g.stroke();
                g.fillStyle = P.gold; g.beginPath(); g.arc(x0, y0 + 1, 2.2 * s, 0, TAU); g.fill(); g.fillRect(x0 - 1 * s, y0 + 1, 2 * s, 7 * s);
                L.bulbs.mid.push([mx, (y0 + y1) / 2 + 12 * s, i % 2 ? "#ffe08a" : "#fff2c8", i]);
            }
            // the king pole and two quarter poles poking through the roof
            g.strokeStyle = night ? "#8a7a50" : "#c89a40"; g.lineWidth = 4 * s; g.beginPath(); g.moveTo(x, peakY + 6); g.lineTo(x, peakY - 40 * s); g.stroke();
            g.fillStyle = P.gold; g.beginPath(); g.arc(x, peakY - 41 * s, 4 * s, 0, TAU); g.fill();
            T.flag = [x, peakY - 38 * s];
            T.poles = [-0.5, 0.5].map(u => { const px = x + u * rx * 0.9, py = U.lerp(peakY, wallTop, 0.55) + T.h * 0.03; g.lineWidth = 2.5 * s; g.beginPath(); g.moveTo(px, py + 4); g.lineTo(px, py - 22 * s); g.stroke(); return [px, py - 20 * s]; });
            // the doorway: an arched marquee with bulbs, curtains tied back, warm light and the ring inside
            const dw = rx * 0.32, dh = T.wallH * 0.95, dx = x, dy = y + ry * 0.55;
            const inside = g.createLinearGradient(0, dy - dh, 0, dy);
            inside.addColorStop(0, night ? "#ffb060" : "#ffd98a"); inside.addColorStop(0.6, night ? "#e07a30" : "#f2a850"); inside.addColorStop(1, night ? "#8a3a20" : "#c87838");
            g.fillStyle = inside; g.beginPath(); g.moveTo(dx - dw / 2, dy); g.lineTo(dx - dw * 0.4, dy - dh * 0.8); g.quadraticCurveTo(dx, dy - dh * 1.02, dx + dw * 0.4, dy - dh * 0.8); g.lineTo(dx + dw / 2, dy); g.fill();
            g.fillStyle = night ? "rgba(60,20,20,.6)" : "rgba(120,50,30,.45)";                    // the ring and seats inside, in silhouette
            g.beginPath(); g.ellipse(dx, dy - dh * 0.14, dw * 0.38, dh * 0.07, 0, 0, TAU); g.fill();
            for (let j = 0; j < 3; j++) { g.fillRect(dx - dw * 0.4, dy - dh * (0.46 + j * 0.1), dw * 0.8, 2 * s); }
            for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(dx - dw * 0.34 + i * dw * 0.085, dy - dh * (0.5 + (i % 3) * 0.1), 2.6 * s, 0, TAU); g.fill(); }
            for (const sd of [-1, 1]) {                                                          // curtains tied back
                const cg = g.createLinearGradient(dx + sd * dw * 0.2, 0, dx + sd * dw * 0.7, 0);
                cg.addColorStop(0, night ? "#7a1626" : "#c8202e"); cg.addColorStop(1, night ? "#4a0a18" : "#8a1420");
                g.fillStyle = cg; g.beginPath(); g.moveTo(dx + sd * dw * 0.4, dy - dh * 0.8);
                g.quadraticCurveTo(dx + sd * dw * 0.15, dy - dh * 0.4, dx + sd * dw * 0.42, dy - dh * 0.32);
                g.quadraticCurveTo(dx + sd * dw * 0.55, dy - dh * 0.15, dx + sd * dw * 0.62, dy); g.lineTo(dx + sd * dw * 0.72, dy); g.lineTo(dx + sd * dw * 0.6, dy - dh * 0.82); g.fill();
                g.fillStyle = P.gold; g.beginPath(); g.arc(dx + sd * dw * 0.43, dy - dh * 0.33, 3 * s, 0, TAU); g.fill();
            }
            g.strokeStyle = P.gold; g.lineWidth = 5 * s; g.beginPath();                              // the marquee arch
            g.moveTo(dx - dw * 0.62, dy - dh * 0.6); g.quadraticCurveTo(dx, dy - dh * 1.32, dx + dw * 0.62, dy - dh * 0.6); g.stroke();
            g.strokeStyle = night ? "#5a1a2a" : "#e2343e"; g.lineWidth = 12 * s; g.beginPath();
            g.moveTo(dx - dw * 0.58, dy - dh * 0.66); g.quadraticCurveTo(dx, dy - dh * 1.24, dx + dw * 0.58, dy - dh * 0.66); g.stroke();
            for (let i = 0; i <= 14; i++) {
                const u = i / 14, ax = (1 - u) * (1 - u) * (dx - dw * 0.58) + 2 * u * (1 - u) * dx + u * u * (dx + dw * 0.58), ay = (1 - u) * (1 - u) * (dy - dh * 0.66) + 2 * u * (1 - u) * (dy - dh * 1.24) + u * u * (dy - dh * 0.66);
                g.fillStyle = "#fff6d0"; g.beginPath(); g.arc(ax, ay, 2 * s, 0, TAU); g.fill();
                L.bulbs.mid.push([ax, ay, "#ffd070", i + 3]);
            }
            g.fillStyle = P.gold; g.beginPath();                                                    // a star over the door
            for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * TAU, rr = i % 2 ? 6 * s : 14 * s; g.lineTo(dx + Math.cos(a) * rr, dy - dh * 1.08 + Math.sin(a) * rr); }
            g.fill();

            // ---- the carousel's platform and the back of its canopy's underside ----
            const pg3 = g.createLinearGradient(0, C.y - C.ry, 0, C.y + C.ry + 12 * s);
            pg3.addColorStop(0, night ? "#4a3a50" : "#f2e2c4"); pg3.addColorStop(1, night ? "#2a2030" : "#c8a880");
            g.fillStyle = night ? "#20182a" : "#a8885e"; g.beginPath(); g.ellipse(C.x, C.y + 8 * s, C.rx * 1.04, C.ry * 1.05, 0, 0, TAU); g.fill();
            g.fillStyle = pg3; g.beginPath(); g.ellipse(C.x, C.y, C.rx, C.ry, 0, 0, TAU); g.fill();
            g.fillStyle = night ? "#5a1a2a" : "#e2343e"; g.fillRect(C.x - C.rx, C.y, C.rx * 2, 8 * s);
            g.beginPath(); g.ellipse(C.x, C.y + 8 * s, C.rx, C.ry, 0, 0, Math.PI); g.fill();
            g.fillStyle = P.gold; for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI; g.beginPath(); g.arc(C.x - Math.cos(a) * C.rx, C.y + 4 * s + Math.sin(a) * C.ry, 1.6 * s, 0, TAU); g.fill(); }
        });

        // the carousel's centre column and canopy (drawn over the horses), and its horses
        L.column = paint(C.rx * 0.5, C.h, g => {
            const w = C.rx * 0.5, cw = w * 0.5, cx = w / 2;
            const cg = g.createLinearGradient(cx - cw / 2, 0, cx + cw / 2, 0);
            cg.addColorStop(0, night ? "#3a2a50" : "#f6e6c0"); cg.addColorStop(0.5, night ? "#6a5a8a" : "#ffffff"); cg.addColorStop(1, night ? "#2a1e3a" : "#c8b088");
            g.fillStyle = cg; g.fillRect(cx - cw / 2, 0, cw, C.h);
            for (let j = 0; j < 4; j++) {                                        // mirror panels
                const y = C.h * (0.22 + j * 0.17);
                g.fillStyle = night ? "rgba(255,210,150,.5)" : "rgba(170,210,240,.9)"; g.fillRect(cx - cw * 0.32, y, cw * 0.64, C.h * 0.12);
                g.strokeStyle = P.gold; g.lineWidth = 1.5; g.strokeRect(cx - cw * 0.32, y, cw * 0.64, C.h * 0.12);
            }
        });
        L.canopy = paint(C.rx * 2.3, C.h * 0.75, g => {
            const w = C.rx * 2.3, cx = w / 2, top = 6 * s, eave = C.h * 0.42, n = 16;
            for (let i = 0; i < n; i++) {                                        // the striped cone
                const a0 = Math.PI * (i / n), a1 = Math.PI * ((i + 1) / n);
                const x0 = cx - Math.cos(a0) * C.rx * 1.08, y0 = eave + Math.sin(a0) * C.ry, x1 = cx - Math.cos(a1) * C.rx * 1.08, y1 = eave + Math.sin(a1) * C.ry;
                g.fillStyle = i % 2 ? P.white : P.red; g.beginPath(); g.moveTo(cx, top + 10 * s); g.lineTo(x0, y0); g.lineTo(x1, y1); g.fill();
            }
            const sh = g.createLinearGradient(cx - C.rx, 0, cx + C.rx, 0);
            sh.addColorStop(0, "rgba(255,240,210,.25)"); sh.addColorStop(0.5, "rgba(255,255,255,0)"); sh.addColorStop(1, P.canvasShade + ".4)");
            g.fillStyle = sh; g.beginPath(); g.moveTo(cx, top + 10 * s); g.lineTo(cx - C.rx * 1.1, eave); g.lineTo(cx - C.rx * 1.1, eave + C.ry + 2); g.lineTo(cx + C.rx * 1.1, eave + C.ry + 2); g.lineTo(cx + C.rx * 1.1, eave); g.fill();
            const bandH = C.h * 0.13;                                            // the painted rounding board
            const bgd = g.createLinearGradient(0, eave, 0, eave + bandH);
            bgd.addColorStop(0, night ? "#7a5a20" : "#ffd760"); bgd.addColorStop(1, night ? "#4a3010" : "#d89a28");
            g.fillStyle = bgd; g.beginPath(); g.ellipse(cx, eave + bandH, C.rx * 1.08, C.ry, 0, 0, Math.PI); g.lineTo(cx - C.rx * 1.08, eave); g.ellipse(cx, eave, C.rx * 1.08, C.ry, 0, Math.PI, 0, true); g.fill();
            for (let i = 0; i < 7; i++) {                                        // its panels: little painted ovals
                const a = Math.PI * ((i + 0.5) / 7), px = cx - Math.cos(a) * C.rx * 1.05, py = eave + bandH * 0.5 + Math.sin(a) * C.ry;
                g.fillStyle = night ? "#3a1a40" : ["#2f7ad8", "#e2343e", "#2f9a5a"][i % 3]; g.beginPath(); g.ellipse(px, py, 9 * s * Math.sin(a) + 2, bandH * 0.32, 0, 0, TAU); g.fill();
                g.fillStyle = P.white; g.beginPath(); g.arc(px, py, 1.8 * s, 0, TAU); g.fill();
            }
            for (let i = 0; i <= 20; i++) {                                      // scallops under it
                const a0 = Math.PI * (i / 21), a1 = Math.PI * ((i + 1) / 21);
                const x0 = cx - Math.cos(a0) * C.rx * 1.08, y0 = eave + bandH + Math.sin(a0) * C.ry, x1 = cx - Math.cos(a1) * C.rx * 1.08, y1 = eave + bandH + Math.sin(a1) * C.ry;
                g.fillStyle = i % 2 ? P.white : P.red; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + 12 * s, x0, y0); g.fill();
                g.fillStyle = "#fff6d0"; g.beginPath(); g.arc(x0, y0 - bandH * 0.5, 1.6 * s, 0, TAU); g.fill();
            }
            g.fillStyle = P.gold; g.beginPath(); g.arc(cx, top + 8 * s, 5 * s, 0, TAU); g.fill();
            g.fillRect(cx - 1 * s, top - 6 * s, 2 * s, 12 * s);
        });
        // a carousel horse (facing right), in four colours
        L.horses = ["#fbf6ee", "#f2c040", "#c88a5a", "#e8e0f0"].map(col => paint(56 * s, 44 * s, g => {
            g.save(); g.scale(s, s); g.translate(4, 4);
            const body = night ? dk(col, 0.35) : col, edge = dk(body, 0.3);
            g.fillStyle = body; g.strokeStyle = edge; g.lineWidth = 1.2; g.lineJoin = "round";
            g.beginPath();                                                       // body, neck and head in one outline
            g.moveTo(8, 20); g.bezierCurveTo(8, 12, 18, 11, 26, 12); g.lineTo(31, 11);
            g.bezierCurveTo(33, 6, 36, 1, 40, 0); g.lineTo(45, 3); g.lineTo(47, 8); g.lineTo(44, 10); g.lineTo(39, 9);
            g.bezierCurveTo(37, 13, 36, 16, 36, 20); g.bezierCurveTo(36, 25, 30, 27, 22, 27); g.bezierCurveTo(14, 27, 8, 26, 8, 20); g.fill(); g.stroke();
            g.lineWidth = 3; g.lineCap = "round"; g.strokeStyle = body;                // prancing legs
            for (const [x0, y0, x1, y1, x2, y2] of [[30, 25, 36, 28, 33, 33], [27, 26, 30, 31, 34, 35], [13, 25, 9, 30, 6, 34], [16, 26, 15, 32, 13, 36]]) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
            g.fillStyle = edge; for (const [x, y] of [[33, 33], [34, 35], [6, 34], [13, 36]]) { g.beginPath(); g.arc(x, y, 1.6, 0, TAU); g.fill(); }
            g.fillStyle = night ? "#8a6a2a" : "#e8b030"; g.beginPath(); g.moveTo(31, 11); g.bezierCurveTo(33, 4, 37, 0, 40, 0); g.lineTo(36, 4); g.lineTo(34, 9); g.fill();   // mane
            g.beginPath(); g.moveTo(8, 17); g.quadraticCurveTo(1, 18, 2, 28); g.quadraticCurveTo(5, 22, 9, 21); g.fill();                                             // tail
            g.fillStyle = night ? "#6a1020" : "#e2343e"; g.beginPath(); g.ellipse(21, 13, 6, 3, 0, 0, TAU); g.fill();                                              // saddle
            g.fillStyle = night ? "#3a3058" : "#2f7ad8"; g.fillRect(15, 15, 12, 4);
            g.fillStyle = "#1a1018"; g.beginPath(); g.arc(42, 4, 1, 0, TAU); g.fill();
            g.restore();
        }));

        // the front (x11): the popcorn cart, lamp posts, hay bales, the balloon seller, grass tufts
        L.front = paint(LW, H, g => {
            const b = batch();
            for (const [x0, x1] of [[0, X(0.2)], [X(0.85), LW]]) {                             // long grass in the corners
                for (let i = 0; i < (preview ? 60 : 380); i++) {
                    const x = x0 + R() * (x1 - x0), y = H - R() ** 2 * H * 0.07 + 4, l = (8 + R() * 22) * s, bend = (R() - 0.5) * 12 * s;
                    b.curve(R() < 0.5 ? dk(P.grass[2], 0.25) : lt(P.grass[1], night ? 0.03 : 0.12), (1 + R() * 1.5) * s, x, y, x + bend * 0.3, y - l * 0.6, x + bend, y - l);
                }
            }
            b.flush(g);
            // hay bales by the path
            for (const [f, yy, w] of [[0.2, 0.9, 64], [0.245, 0.93, 54], [0.73, 0.9, 58]]) {
                const x = X(f), y = H * yy, bw = w * s, bh = bw * 0.5;
                const hg = g.createLinearGradient(0, y - bh, 0, y);
                hg.addColorStop(0, night ? "#6a5a3a" : "#f2d27a"); hg.addColorStop(1, night ? "#3a301e" : "#c89a40");
                g.fillStyle = "rgba(0,0,0,.22)"; g.beginPath(); g.ellipse(x, y + 2, bw * 0.6, bh * 0.18, 0, 0, TAU); g.fill();
                g.fillStyle = hg; g.beginPath(); g.roundRect(x - bw / 2, y - bh, bw, bh, 6 * s); g.fill();
                g.strokeStyle = night ? "rgba(0,0,0,.25)" : "rgba(140,100,30,.4)"; g.lineWidth = 1;
                for (let i = 0; i < 14; i++) { const yy2 = y - bh + 3 + R() * (bh - 6), xx = x - bw / 2 + R() * bw; g.beginPath(); g.moveTo(xx, yy2); g.lineTo(xx + (4 + R() * 6) * s, yy2 + (R() - 0.5) * 2); g.stroke(); }
                g.strokeStyle = night ? "#2a2418" : "#9a6a2a"; g.lineWidth = 1.6; for (const u of [0.3, 0.7]) { g.beginPath(); g.moveTo(x - bw / 2 + bw * u, y - bh); g.lineTo(x - bw / 2 + bw * u, y); g.stroke(); }
            }
            // the popcorn cart: spoked wheels, a red body, a glass case of popcorn, a striped roof
            const px = X(0.155), py = H * 0.955, cs = s * 1.15;
            g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(px, py + 2, 46 * cs, 7 * cs, 0, 0, TAU); g.fill();
            const body = g.createLinearGradient(px - 36 * cs, 0, px + 36 * cs, 0);
            body.addColorStop(0, night ? "#7a1622" : "#f0464e"); body.addColorStop(1, night ? "#4a0a14" : "#a8161e");
            g.fillStyle = body; g.beginPath(); g.roundRect(px - 36 * cs, py - 58 * cs, 72 * cs, 36 * cs, 4 * cs); g.fill();
            g.strokeStyle = P.gold; g.lineWidth = 2 * cs; g.strokeRect(px - 30 * cs, py - 52 * cs, 60 * cs, 24 * cs);
            g.fillStyle = night ? "rgba(255,214,150,.9)" : "rgba(235,248,255,.85)"; g.fillRect(px - 30 * cs, py - 98 * cs, 60 * cs, 40 * cs);
            for (let i = 0; i < 70; i++) { const x = px - 27 * cs + R() * 54 * cs, y = py - 60 * cs - R() ** 1.5 * 24 * cs; b.dot(night ? "#f2d8a0" : "#fff6d8", x, y, (2 + R() * 1.4) * cs); if (R() < 0.3) b.dot(night ? "#c8a060" : "#f2d27a", x + 1, y + 1, 1.2 * cs); }
            b.flush(g);
            g.strokeStyle = night ? "rgba(255,255,255,.2)" : "rgba(255,255,255,.8)"; g.lineWidth = 2 * cs; g.beginPath(); g.moveTo(px - 24 * cs, py - 94 * cs); g.lineTo(px - 14 * cs, py - 64 * cs); g.stroke();
            g.strokeStyle = night ? "#8a7a50" : "#c8a040"; g.lineWidth = 2.5 * cs; g.strokeRect(px - 30 * cs, py - 98 * cs, 60 * cs, 40 * cs);
            for (let i = 0; i < 6; i++) {
                g.fillStyle = i % 2 ? P.white : P.red; const x0 = px - 40 * cs + i * (80 * cs / 6);
                g.beginPath(); g.moveTo(px, py - 124 * cs); g.lineTo(x0, py - 100 * cs); g.lineTo(x0 + 80 * cs / 6, py - 100 * cs); g.fill();
                g.beginPath(); g.moveTo(x0, py - 100 * cs); g.lineTo(x0 + 80 * cs / 6, py - 100 * cs); g.quadraticCurveTo(x0 + 40 * cs / 6, py - 92 * cs, x0, py - 100 * cs); g.fill();
            }
            g.fillStyle = P.gold; g.beginPath(); g.arc(px, py - 126 * cs, 3.5 * cs, 0, TAU); g.fill();
            for (const wx2 of [px - 22 * cs, px + 22 * cs]) {
                g.fillStyle = night ? "#1a1418" : "#2a2a30"; g.beginPath(); g.arc(wx2, py - 14 * cs, 14 * cs, 0, TAU); g.fill();
                g.fillStyle = night ? "#3a3040" : "#d8d8de"; g.beginPath(); g.arc(wx2, py - 14 * cs, 11 * cs, 0, TAU); g.fill();
                g.strokeStyle = night ? "#1a1418" : "#5a5a64"; g.lineWidth = 1.5 * cs;
                for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; g.beginPath(); g.moveTo(wx2, py - 14 * cs); g.lineTo(wx2 + Math.cos(a) * 11 * cs, py - 14 * cs + Math.sin(a) * 11 * cs); g.stroke(); }
                g.fillStyle = P.gold; g.beginPath(); g.arc(wx2, py - 14 * cs, 2.5 * cs, 0, TAU); g.fill();
            }
            L.steam = [px, py - 126 * cs];
            // lamp posts: a fluted post, a scroll arm, two glass globes
            L.lamps = [];
            for (const [f, yy] of [[0.24, 0.995], [0.6, 0.99]]) {
                const x = X(f), y = H * yy, hgt = H * 0.21, top = y - hgt;
                const lg = g.createLinearGradient(x - 4 * s, 0, x + 4 * s, 0); lg.addColorStop(0, night ? "#3a3048" : "#5a6a72"); lg.addColorStop(0.5, night ? "#6a5a80" : "#9aa8b0"); lg.addColorStop(1, night ? "#1a1424" : "#2a343a");
                g.fillStyle = lg; g.fillRect(x - 3 * s, top, 6 * s, hgt); g.fillRect(x - 7 * s, y - 14 * s, 14 * s, 14 * s); g.fillRect(x - 5 * s, y - 20 * s, 10 * s, 6 * s);
                g.strokeStyle = night ? "#4a3e5e" : "#4a5a62"; g.lineWidth = 2.5 * s; g.beginPath(); g.moveTo(x - 22 * s, top + 8 * s); g.quadraticCurveTo(x, top - 6 * s, x + 22 * s, top + 8 * s); g.stroke();
                for (const sd of [-1, 1]) {
                    const gx = x + sd * 22 * s, gy2 = top + 18 * s;
                    g.fillStyle = night ? "#fff4d0" : "rgba(255,255,255,.85)"; g.beginPath(); g.arc(gx, gy2, 7 * s, 0, TAU); g.fill();
                    g.strokeStyle = night ? "rgba(0,0,0,.2)" : "rgba(80,100,110,.5)"; g.lineWidth = 1; g.stroke();
                    L.lamps.push([gx, gy2]);
                }
                g.fillStyle = night ? "#2a2238" : "#3a4a52"; g.beginPath(); g.arc(x, top - 2 * s, 4 * s, 0, TAU); g.fill();
            }
            // the balloon seller's cart (the balloons themselves sway, drawn live)
            const vx = X(0.905), vy = H * 0.975;
            g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(vx, vy + 2, 30 * s, 6 * s, 0, 0, TAU); g.fill();
            g.fillStyle = night ? "#3a2a50" : "#7a5ad8"; g.beginPath(); g.roundRect(vx - 24 * s, vy - 34 * s, 48 * s, 26 * s, 4 * s); g.fill();
            g.fillStyle = P.white; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(vx - 15 * s + i * 10 * s, vy - 21 * s, 3 * s, 0, TAU); g.fill(); }
            for (const wx2 of [vx - 14 * s, vx + 14 * s]) { g.fillStyle = night ? "#1a1418" : "#2a2a30"; g.beginPath(); g.arc(wx2, vy - 6 * s, 7 * s, 0, TAU); g.fill(); }
            g.strokeStyle = night ? "#5a4a70" : "#6a5a4a"; g.lineWidth = 2.5 * s; g.beginPath(); g.moveTo(vx + 18 * s, vy - 34 * s); g.lineTo(vx + 18 * s, vy - 70 * s); g.stroke();
            L.vendor = [vx + 18 * s, vy - 70 * s];
        });

        // things that move
        clouds = night ? [] : Array.from({ length: preview ? 2 : 5 }, (_, i) => {
            const w = (120 + R() * 150) * s, h = w * (0.36 + R() * 0.12);
            return { img: cloudImg(R, w, h), x: R() * W, y: H * (0.04 + R() * 0.24), sp: 4 + R() * 6, depth: 0.6 + i * 0.1 };
        });
        birds = night || preview ? [] : Array.from({ length: 4 }, () => ({ x: R() * W, y: H * (0.12 + R() * 0.2), sp: 22 + R() * 16, ph: R() * TAU, sc: (0.7 + R() * 0.5) * s }));
        stars = night ? Array.from({ length: preview ? 8 : 30 }, () => ({ x: R() * W, y: R() ** 1.5 * HZ * 0.8, r: 1.4 + R() * 1.6, sp: 1 + R() * 2, ph: R() * TAU })) : [];
        people = preview ? [] : Array.from({ length: 12 }, (_, i) => ({
            x: R() * LW, dir: R() < 0.5 ? -1 : 1, sp: 14 + R() * 14, depth: R(), ph: R() * TAU,
            top: ["#e2343e", "#2f7ad8", "#f2c040", "#3a9a5a", "#b06ad8", "#f08a3a", "#ffffff"][i % 7], legs: ["#2a3a5a", "#5a4a3a", "#3a3a40"][i % 3],
            kid: R() < 0.3, balloon: R() < 0.25 ? FLAGS[i % 6] : null,
        }));
        L.pennants = [[-0.02, 0.05, 0.5, 0.13, 0.08], [0.46, 0.1, 1.02, 0.03, 0.07]].map(([a, ya, b2, yb, sag]) => ({ x0: X(a), y0: H * ya, x1: X(b2), y1: H * yb, sag: H * sag, ph: R() * TAU }));
        L.coaster = { u: 0.1, v: 0 };
        L.drop = { t: R() * 12 };
        L.vendorBalloons = Array.from({ length: 7 }, (_, i) => ({ c: FLAGS[i % 6], dx: (i - 3) * 9 * s + (R() - 0.5) * 6 * s, dy: -(28 + R() * 34) * s, ph: R() * TAU }));
    }
    setup();

    // ---- drawing the live parts --------------------------------------------------------------
    const sagAt = (p, u, t) => [U.lerp(p.x0, p.x1, u), U.lerp(p.y0, p.y1, u) + Math.sin(u * Math.PI) * (p.sag + Math.sin(t * 1.1 + p.ph) * 3)];
    function trackAt(x) {
        const T = L.track, i = U.clamp(Math.round((x - T[0][0]) / 2), 0, T.length - 1);
        return T[i];
    }
    function drawCoaster(g, dt, ox) {
        const T = L.track, c = L.coaster, x0 = T[0][0], x1 = T[T.length - 1][0];
        const [, y] = trackAt(U.lerp(x0, x1, c.u)), top = Math.min(...T.slice(0, 40).map(p => p[1]));
        const speed = 30 + Math.sqrt(Math.max(0, y - top)) * 9;                          // faster in the dips
        c.u += (speed * dt) / (x1 - x0);
        if (c.u > 1.08) c.u = -0.05;
        const s = L.s, cars = 5, len = 13 * s;
        for (let i = 0; i < cars; i++) {
            const x = U.lerp(x0, x1, c.u) - i * len;
            if (x < x0 || x > x1) continue;
            const [xa, ya] = trackAt(x - 3), [xb, yb] = trackAt(x + 3), ang = Math.atan2(yb - ya, xb - xa), [, yy] = trackAt(x);
            g.save(); g.translate(x - ox, yy - 2 * s); g.rotate(ang);
            g.fillStyle = night ? ["#a03040", "#d0a030"][i % 2] : ["#e2343e", "#f2c040"][i % 2];
            g.beginPath(); g.roundRect(-len * 0.45, -6 * s, len * 0.9, 6 * s, 2 * s); g.fill();
            g.fillStyle = night ? "rgba(30,20,40,.9)" : "rgba(60,40,40,.75)";
            const arms = ang > 0.25;                                                       // hands up on the way down
            for (const dx of [-0.2, 0.2]) {
                g.beginPath(); g.arc(dx * len, -8 * s, 2 * s, 0, TAU); g.fill();
                if (arms) { g.fillRect(dx * len - 2.5 * s, -14 * s, 1 * s, 5 * s); g.fillRect(dx * len + 1.5 * s, -14 * s, 1 * s, 5 * s); }
            }
            g.restore();
        }
    }
    function drawDrop(g, dt, ox) {
        const T = L.tower, d = L.drop, s = L.s;
        d.t = (d.t + dt) % 12;
        const span = T.base - T.top - 30 * s, t = d.t;
        let h;                                                                            // up slowly, wait, fall, bounce, wait
        if (t < 6) h = U.ease.inOutSine(t / 6);
        else if (t < 7.5) h = 1;
        else if (t < 8.1) h = 1 - ((t - 7.5) / 0.6) ** 2;
        else if (t < 9) h = Math.abs(Math.sin((t - 8.1) / 0.9 * Math.PI)) * 0.06 * (1 - (t - 8.1) / 0.9);
        else h = 0;
        const y = T.base - 14 * s - h * span, x = T.x - ox;
        g.fillStyle = night ? "#5a3a6a" : "#f2c040"; g.beginPath(); g.roundRect(x - T.w * 1.6, y - 5 * s, T.w * 3.2, 10 * s, 3 * s); g.fill();
        g.fillStyle = night ? "rgba(20,10,30,.85)" : "rgba(60,40,40,.7)";
        for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(x - T.w * 1.2 + i * T.w * 0.6, y - 7 * s, 1.8 * s, 0, TAU); g.fill(); }
        if (night) bulb(g, x, T.top - T.w * 2.2, 3 * s, "#ff4a5a", 0.6 + 0.4 * Math.sin(performance.now() / 300));
    }
    function drawWheel(g, t, ox) {
        const w = L.wheel, s = L.s, rot = t * 0.1, wx = w.x - ox, box = L.wheelBox;
        g.drawImage(L.wheelBack, box.x - ox, box.y);
        g.save(); g.translate(wx, w.y); g.rotate(rot); g.drawImage(L.wheelImg, -L.wheelImg.width / 2, -L.wheelImg.height / 2); g.restore();
        if (night) {                                                                        // the rim and spokes outlined in chasing bulbs
            const chase = Math.floor(t * 7);
            for (let i = 0; i < 48; i++) {
                const a = rot + (i / 48) * TAU, on = (chase + i) % 6 < 3;
                bulb(g, wx + Math.cos(a) * w.r, w.y + Math.sin(a) * w.r, on ? 2.4 * s : 1.6 * s, ["#ffd860", "#ff6a8a", "#6ac8ff"][i % 3], on ? 0.95 : 0.35);
            }
            const wave = (t * 0.8) % 1;
            for (let i = 0; i < 16; i++) for (let j = 1; j <= 3; j++) {
                const a = rot + (i / 16) * TAU, u = j / 4, on = Math.abs(u - wave) < 0.2;
                bulb(g, wx + Math.cos(a) * w.r * 0.86 * u, w.y + Math.sin(a) * w.r * 0.86 * u, 1.6 * s, "#fff0b0", on ? 0.9 : 0.25);
            }
        }
        for (let i = 0; i < w.n; i++) {
            const a = rot + (i / w.n) * TAU, x = wx + Math.cos(a) * w.r, y = w.y + Math.sin(a) * w.r, sw = Math.sin(t * 1.3 + i * 1.7) * 0.08;
            const img = L.gondolas[i % L.gondolas.length];
            g.save(); g.translate(x, y); g.rotate(sw); g.drawImage(img, -img.width / 2, 0); g.restore();
        }
        g.drawImage(L.wheelFront, box.x - ox, box.y);
    }
    function drawTentLife(g, t, ox) {
        const T = L.tent, s = L.s;
        const flag = (fx, fy, len, hgt, col) => {
            g.fillStyle = col; g.beginPath(); g.moveTo(fx, fy);
            for (let i = 0; i <= 8; i++) g.lineTo(fx + (i / 8) * len, fy + Math.sin(t * 6 - i * 0.8) * 2.5 * s * (i / 8) + (i / 8) * hgt * 0.3);
            for (let i = 8; i >= 0; i--) g.lineTo(fx + (i / 8) * len, fy + hgt + Math.sin(t * 6 - i * 0.8) * 2.5 * s * (i / 8) - (i / 8) * hgt * 0.3);
            g.fill();
        };
        flag(T.flag[0] - ox, T.flag[1] - 14 * s, 34 * s, 16 * s, P.gold);
        T.poles.forEach(([px, py], i) => flag(px - ox, py - 4 * s, 18 * s, 9 * s, FLAGS[i ? 2 : 3]));
        Worlds.glow(g, T.x - ox, T.y - T.wallH * 0.3, T.rx * 0.35, "#ffb860", night ? 0.45 + 0.08 * Math.sin(t * 3) : 0.18);
    }
    function drawCarousel(g, t, ox) {
        const C = L.carousel, s = L.s, cx = C.x - ox, n = 8, top = C.y - C.h, rot = t * 0.35;
        const horses = [];
        for (let i = 0; i < n; i++) {
            const a = rot + (i / n) * TAU, z = Math.sin(a);
            horses.push({ i, x: cx - Math.cos(a) * C.rx * 0.82, z, y: C.y + z * C.ry * 0.8, dir: z > 0 ? -1 : 1 });
        }
        const draw = h => {
            const bob = Math.sin(t * 2.4 + h.i * 1.9) * 7 * s, sc = 0.8 + (h.z + 1) * 0.12, img = L.horses[h.i % L.horses.length];
            g.strokeStyle = night ? "#a08840" : P.gold; g.lineWidth = 2 * s * sc; g.beginPath(); g.moveTo(h.x, top + C.h * 0.2); g.lineTo(h.x, h.y - 2 * s); g.stroke();
            g.save(); g.translate(h.x, h.y - C.h * 0.38 + bob); g.scale(h.dir * sc, sc);
            if (h.z < 0) g.globalAlpha = 0.75;
            g.drawImage(img, -img.width * 0.42, -img.height * 0.5); g.restore(); g.globalAlpha = 1;
        };
        horses.filter(h => h.z <= 0).sort((a, b) => a.z - b.z).forEach(draw);
        g.drawImage(L.column, cx - L.column.width / 2, top + C.h * 0.12, L.column.width, C.h * 0.88);
        horses.filter(h => h.z > 0).sort((a, b) => a.z - b.z).forEach(draw);
        g.drawImage(L.canopy, cx - L.canopy.width / 2, top - C.h * 0.36);
        if (night) {
            const band = top - C.h * 0.36 + C.h * 0.42 + C.h * 0.065;
            for (let i = 0; i <= 20; i++) {
                const a = Math.PI * (i / 21), x = cx - Math.cos(a) * C.rx * 1.08, y = band + Math.sin(a) * C.ry;
                bulb(g, x, y, 1.8 * s, i % 2 ? "#ffe08a" : "#ff9ab0", (Math.floor(t * 4) + i) % 2 ? 0.95 : 0.45);
            }
        }
    }
    function drawPeople(g, t, dt, ox) {
        const s = L.s;
        for (const p of people) {
            p.x += p.dir * p.sp * dt;
            if (p.x < -40) p.x = L.LW + 30; else if (p.x > L.LW + 40) p.x = -30;
            const y = L.GY + (40 + p.depth * 30) * s, h = (p.kid ? 19 : 30) * s * (0.85 + p.depth * 0.3), x = p.x - ox, step = Math.sin(t * 7 + p.ph);
            const top = night ? dk(p.top, 0.6) : p.top, legs = night ? dk(p.legs, 0.5) : p.legs;
            g.fillStyle = "rgba(0,0,0,.18)"; g.beginPath(); g.ellipse(x, y, h * 0.22, h * 0.06, 0, 0, TAU); g.fill();
            g.strokeStyle = legs; g.lineWidth = h * 0.11; g.lineCap = "round";
            g.beginPath(); g.moveTo(x, y - h * 0.42); g.lineTo(x + step * h * 0.12, y - h * 0.02); g.moveTo(x, y - h * 0.42); g.lineTo(x - step * h * 0.12, y - h * 0.02); g.stroke();
            g.fillStyle = top; g.beginPath(); g.roundRect(x - h * 0.14, y - h * 0.8, h * 0.28, h * 0.42, h * 0.08); g.fill();
            g.fillStyle = night ? "#3a2c34" : "#e8b890"; g.beginPath(); g.arc(x, y - h * 0.9, h * 0.11, 0, TAU); g.fill();
            if (p.balloon) {
                const bx = x + p.dir * h * 0.25, by = y - h * 1.6 + Math.sin(t * 1.5 + p.ph) * 2;
                g.strokeStyle = night ? "rgba(200,190,220,.4)" : "rgba(60,60,60,.5)"; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x + p.dir * h * 0.12, y - h * 0.6); g.lineTo(bx, by + h * 0.18); g.stroke();
                g.fillStyle = night ? dk(p.balloon, 0.3) : p.balloon; g.beginPath(); g.ellipse(bx, by, h * 0.15, h * 0.19, 0, 0, TAU); g.fill();
            }
        }
    }
    function drawPennants(g, t) {
        const s = L.s;
        for (const p of L.pennants) {
            g.strokeStyle = night ? "#4a3e60" : "#6a6a72"; g.lineWidth = 1.2;
            g.beginPath(); for (let i = 0; i <= 30; i++) { const [x, y] = sagAt(p, i / 30, t); g[i ? "lineTo" : "moveTo"](x - M, y); } g.stroke();
            for (let i = 0; i < 22; i++) {
                const u = (i + 0.5) / 22, [x, y] = sagAt(p, u, t), flap = Math.cos(t * 2.2 + i * 0.9), col = FLAGS[i % 6];
                g.save(); g.translate(x - M, y); g.rotate(Math.sin(t * 1.8 + i) * 0.12); g.scale(0.75 + 0.25 * Math.abs(flap), 1);
                const pg = g.createLinearGradient(-8 * s, 0, 8 * s, 0); pg.addColorStop(0, night ? dk(col, 0.2) : lt(col, 0.2)); pg.addColorStop(1, dk(col, night ? 0.5 : 0.25));
                g.fillStyle = pg; g.beginPath(); g.moveTo(-8 * s, 0); g.lineTo(8 * s, 0); g.lineTo(0, 19 * s); g.fill();
                g.restore();
                if (i % 2) {
                    const [bx, by] = sagAt(p, u + 0.5 / 22, t);
                    if (night) bulb(g, bx - M, by + 3, 2 * s, ["#fff0b0", "#ffb0c0", "#b0e0ff"][i % 3], (Math.floor(t * 2.5) + i) % 4 ? 0.9 : 0.4);
                    else { g.fillStyle = "rgba(255,255,240,.9)"; g.beginPath(); g.arc(bx - M, by + 3, 2.2 * s, 0, TAU); g.fill(); }
                }
            }
        }
    }
    function drawFireworks(g, t, dt) {
        const s = L.s;
        nextFw -= dt;
        if (nextFw <= 0 && !preview) {
            nextFw = U.rand(1.6, 3.6);
            const x = W * U.rand(0.15, 0.75);
            fireworks.push({ x, y: L.GY, tx: x + U.rand(-30, 30), ty: H * U.rand(0.1, 0.3), age: 0, c: U.pick(["#ff5a6a", "#ffcf3a", "#4ab0ff", "#4ad48a", "#ff8af0", "#ffffff"]), sparks: null });
        }
        g.globalCompositeOperation = "lighter";
        for (const f of fireworks) {
            f.age += dt;
            if (!f.sparks) {                                                               // the rocket climbing
                const u = Math.min(1, f.age / 1.1), x = U.lerp(f.x, f.tx, u), y = U.lerp(f.y, f.ty, 1 - (1 - u) ** 2);
                bulb(g, x, y, 1.6 * s, "#ffe0a0", 0.9);
                for (let j = 1; j < 6; j++) bulb(g, x - (f.tx - f.x) * 0.02 * j, y + j * 5 * s, 1.2 * s, "#ff9a40", 0.5 - j * 0.08);
                if (u >= 1) { f.sparks = Array.from({ length: 36 }, (_, i) => { const a = (i / 36) * TAU + Math.random() * 0.1, v = (70 + Math.random() * 40) * s; return { vx: Math.cos(a) * v, vy: Math.sin(a) * v }; }); f.age = 0; }
            } else {
                const a = Math.max(0, 1 - f.age / 1.8);
                for (const sp of f.sparks) {
                    const drag = 1 - Math.exp(-f.age * 1.6), x = f.tx + sp.vx * drag / 1.6, y = f.ty + sp.vy * drag / 1.6 + f.age * f.age * 18 * s;
                    for (let j = 0; j < 3; j++) { const dd = 1 - Math.exp(-(f.age - j * 0.05) * 1.6); bulb(g, f.tx + sp.vx * dd / 1.6, f.ty + sp.vy * dd / 1.6 + (f.age - j * 0.05) ** 2 * 18 * s, (1.6 - j * 0.4) * s, f.c, a * (1 - j * 0.3)); }
                    if (f.age > 0.8 && Math.random() < 0.15) bulb(g, x, y, 1 * s, "#ffffff", a);
                }
                if (f.age < 0.25) Worlds.glow(g, f.tx, f.ty, 60 * s, f.c, (0.25 - f.age) * 2);
            }
        }
        g.globalCompositeOperation = "source-over";
        fireworks = fireworks.filter(f => !f.sparks || f.age < 1.8);
    }

    return {
        resize(w, h) { W = w; H = h; setup(); },
        draw(g, t, dt, inp) {
            const s = L.s, px = inp.px || 0;
            g.drawImage(L.sky, 0, 0);
            for (const st of stars) Worlds.twinkle(g, st.x, st.y, st.r, 0.5 + 0.5 * Math.sin(t * st.sp + st.ph));
            if (night) {                                                                     // searchlights from behind the tent
                g.globalCompositeOperation = "lighter";
                for (const [f, ph] of [[0.3, 0], [0.55, 2.1]]) {
                    const x = W * f - px * 4, y = L.GY - H * 0.05, a = -Math.PI / 2 + Math.sin(t * 0.35 + ph) * 0.55;
                    const lg = g.createLinearGradient(x, y, x + Math.cos(a) * H, y + Math.sin(a) * H);
                    lg.addColorStop(0, "rgba(255,236,200,.22)"); lg.addColorStop(1, "rgba(255,236,200,0)");
                    g.fillStyle = lg; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a - 0.05) * H * 1.3, y + Math.sin(a - 0.05) * H * 1.3); g.lineTo(x + Math.cos(a + 0.05) * H * 1.3, y + Math.sin(a + 0.05) * H * 1.3); g.fill();
                }
                g.globalCompositeOperation = "source-over";
                drawFireworks(g, t, dt);
            }
            for (const c of clouds) {
                c.x += c.sp * dt; if (c.x > W + 40) c.x = -c.img.width - 40;
                g.drawImage(c.img, c.x - px * 2 * c.depth, c.y);
            }
            for (const b of birds) {                                                          // a few birds gliding over
                b.x += b.sp * dt; if (b.x > W + 30) { b.x = -30; b.y = H * (0.1 + Math.random() * 0.2); }
                const f = Math.sin(t * 6 + b.ph), x = b.x - px * 3, y = b.y + Math.sin(t * 0.7 + b.ph) * 6;
                g.strokeStyle = "rgba(50,50,70,.7)"; g.lineWidth = 1.6 * b.sc; g.beginPath();
                g.moveTo(x - 8 * b.sc, y - f * 4 * b.sc); g.quadraticCurveTo(x - 3 * b.sc, y - 3 * b.sc, x, y); g.quadraticCurveTo(x + 3 * b.sc, y - 3 * b.sc, x + 8 * b.sc, y - f * 4 * b.sc); g.stroke();
            }
            const oFar = M + px * 2.5;
            g.drawImage(L.far, -oFar, 0);
            drawCoaster(g, dt, oFar);
            drawDrop(g, dt, oFar);
            drawWheel(g, t, M + px * 5);
            const oMid = M + px * 7;
            g.drawImage(L.mid, -oMid, 0);
            if (night) {                                                                      // the booths', tent's and marquee's bulbs
                const chase = Math.floor(t * 4);
                for (const [x, y, col, i] of L.bulbs.mid) bulb(g, x - oMid, y, 1.9 * s, col, (chase + i) % 3 ? 0.95 : 0.4);
            }
            drawTentLife(g, t, oMid);
            drawCarousel(g, t, oMid);
            drawPeople(g, t, dt, oMid);
            const oFront = M + px * 11;
            // the balloon seller's bunch, swaying (behind the front layer's pole top)
            const [vx, vy] = L.vendor;
            for (const b of L.vendorBalloons) {
                const x = vx - oFront + b.dx + Math.sin(t * 1.2 + b.ph) * 4 * s, y = vy + b.dy + Math.cos(t * 1.4 + b.ph) * 2 * s;
                g.strokeStyle = night ? "rgba(200,190,220,.35)" : "rgba(60,60,60,.45)"; g.lineWidth = 0.8; g.beginPath(); g.moveTo(vx - oFront, vy); g.lineTo(x, y + 14 * s); g.stroke();
                const bg = g.createRadialGradient(x - 4 * s, y - 5 * s, 1, x, y, 13 * s); const c = night ? dk(b.c, 0.3) : b.c;
                bg.addColorStop(0, lt(c, 0.6)); bg.addColorStop(0.35, c); bg.addColorStop(1, dk(c, 0.3));
                g.fillStyle = bg; g.beginPath(); g.ellipse(x, y, 10 * s, 12.5 * s, 0, 0, TAU); g.fill();
            }
            g.drawImage(L.front, -oFront, 0);
            if (night) for (const [x, y] of L.lamps) { bulb(g, x - oFront, y, 4 * s, "#ffe2a0", 0.9); Worlds.glow(g, x - oFront, y, 60 * s, "#ffb860", 0.18); }
            // steam curling off the popcorn cart
            const [sx, sy] = L.steam;
            for (let i = 0; i < 4; i++) {
                const u = ((t * 0.35 + i / 4) % 1), x = sx - oFront + Math.sin(u * 6 + i) * 6 * s, y = sy - u * 50 * s;
                g.fillStyle = `rgba(255,255,255,${((1 - u) * (night ? 0.12 : 0.3)).toFixed(3)})`; g.beginPath(); g.arc(x, y, (4 + u * 10) * s, 0, TAU); g.fill();
            }
            drawPennants(g, t);
            // now and then a balloon slips away from the seller
            nextBalloon -= dt;
            if (nextBalloon <= 0) { nextBalloon = U.rand(6, 12); balloons.push({ x: vx - oFront, y: vy - 30 * s, c: U.pick(FLAGS), ph: Math.random() * 6 }); }
            for (const b of balloons) {
                b.y -= 32 * dt; b.x += Math.sin(t + b.ph) * 10 * dt - 6 * dt;
                const c = night ? dk(b.c, 0.3) : b.c, bg = g.createRadialGradient(b.x - 4 * s, b.y - 6 * s, 1, b.x, b.y, 15 * s);
                bg.addColorStop(0, lt(c, 0.65)); bg.addColorStop(0.3, c); bg.addColorStop(1, dk(c, 0.3));
                g.fillStyle = bg; g.beginPath(); g.ellipse(b.x, b.y, 12 * s, 15 * s, 0, 0, TAU); g.fill();
                g.fillStyle = c; g.beginPath(); g.moveTo(b.x - 2 * s, b.y + 15 * s); g.lineTo(b.x + 2 * s, b.y + 15 * s); g.lineTo(b.x, b.y + 12 * s); g.fill();
                g.strokeStyle = night ? "rgba(200,190,220,.4)" : "rgba(60,60,60,.5)"; g.lineWidth = 1; g.beginPath(); g.moveTo(b.x, b.y + 15 * s); g.quadraticCurveTo(b.x + 6, b.y + 30 * s, b.x - 2, b.y + 44 * s); g.stroke();
            }
            balloons = balloons.filter(b => b.y > -60);
        }
    };
}
