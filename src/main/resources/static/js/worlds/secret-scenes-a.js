// The secret worlds' backgrounds, part one: the Great Hollow and Atlantis. Each scene draws its still parts once into
// offscreen canvases (layers that shift with the pointer for depth) and animates the rest. scene(W, H, opts) returns
// { draw(g, t, dt, input), resize(W, H) } like every world's background (see worlds.js).
const SecretScenes = window.SecretScenes || (window.SecretScenes = {});
(() => {
    const TAU = Math.PI * 2;
    const lerp = (a, b, k) => a + (b - a) * k;
    const lite = () => U.motion() === "lite";
    const lin = (g, x0, y0, x1, y1, stops) => { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; };
    const rad = (g, x, y, r0, r1, stops) => { const gr = g.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; };
    const layer = (w, h, fn) => { const c = Worlds.canvas(w, h); fn(c.getContext("2d")); return c; };
    SecretScenes.kit = { TAU, lerp, lite, lin, rad, layer };

    // =============================================================================================================
    // The Great Hollow: the inside of the oldest oak, a cathedral of bark rising to a hole of sky. Light pours down
    // onto the Giant Squirrel's hoard (acorns heaped with stolen letter tiles and pages); bracket fungi climb the walls
    // in a spiral, glowing; glow-worm threads hang from above; fireflies, falling leaves, eyes in the knotholes.
    // =============================================================================================================
    SecretScenes.hollow = function (W, H, opts) {
        const night = opts.theme === "dark", preview = !!opts.preview;
        const C = night
            ? { deep: "#0b0503", wallIn: "#5a3518", wallOut: "#160a04", grain: "rgba(0,0,0,.26)", ridge: "rgba(200,120,60,.16)", rim: "rgba(255,190,120,.4)", skyTop: "#0a1838", skyBot: "#27497e",
                beam: "170,200,255", fungus: ["#7dffd4", "#9ff0ff", "#ffd36b"], shelf: ["#6b4422", "#3e2412"], fly: "#d4ff7a", leaf: ["#a8492a", "#c8681c", "#e3a35a", "#6b8f3a"], nut: ["#7a4a24", "#3e2614"], tile: "#e8c66a", tileInk: "#3a2210" }
            : { deep: "#6a4422", wallIn: "#f0cf9a", wallOut: "#a0703e", grain: "rgba(90,50,15,.18)", ridge: "rgba(255,240,210,.35)", rim: "rgba(255,236,190,.65)", skyTop: "#6fbcff", skyBot: "#dff3ff",
                beam: "255,238,190", fungus: ["#ffefa8", "#ffd27a", "#fff6d8"], shelf: ["#c8955a", "#7a5230"], fly: "#fff2b0", leaf: ["#7bbf4a", "#c8a03a", "#e3a35a", "#5c8f3a"], nut: ["#b9773e", "#6e4429"], tile: "#ffe08a", tileInk: "#4a2e14" };
        let walls, holes, far, shelves, fungi, knots, threads, hoard, glints, motes, flies, leaves, drops = [], nextDrop = preview ? 999 : 4, sap = [], beam = null, skyFill = null;

        function ellipsePath(cx, cy, rx, ry, R, jag) {
            const p = new Path2D(), n = 72;
            for (let i = 0; i <= n; i++) {
                const a = (i / n) * TAU, j = 1 + (Math.sin(a * 7 + R * 13) * 0.5 + Math.sin(a * 17 + R * 5) * 0.3) * jag;
                const x = cx + Math.cos(a) * rx * j, y = cy + Math.sin(a) * ry * j;
                i ? p.lineTo(x, y) : p.moveTo(x, y);
            }
            p.closePath();
            return p;
        }
        function setup() {
            const R = U.rng(4141), unit = Math.min(W, H), depth = 5;
            skyFill = null; beam = null;
            holes = Array.from({ length: depth }, (_, d) => {
                const k = d / (depth - 1);
                return { cx: W / 2 + (k - 0.5) * W * 0.05, cy: lerp(H * 0.62, H * 0.14, k), rx: lerp(W * 0.46, W * 0.085, Math.pow(k, 0.8)), ry: lerp(H * 0.7, H * 0.11, Math.pow(k, 0.8)), z: 1 - k * 0.8, seed: R() };
            });
            const far = holes[depth - 1];
            holes.far = far;
            far.path = ellipsePath(far.cx, far.cy, far.rx, far.ry, far.seed, 0.06);
            knots = [];
            // each ring of the trunk, from the far end to the near end: a wall with a hole in it, bark rings round the hole
            walls = holes.map((h, d) => layer(W, H, g => {
                const k = d / (depth - 1);
                g.fillStyle = rad(g, h.cx, h.cy, Math.min(h.rx, h.ry) * 0.9, Math.max(W, H) * (1.1 - k * 0.4), [[0, C.wallIn], [0.35, lerp01(C.wallIn, C.wallOut, 0.45 + k * 0.2)], [1, C.wallOut]]);
                g.fillRect(0, 0, W, H);
                // bark: rings round the hole, ridges running out from it
                g.lineCap = "round";
                for (let j = 1; j < 14; j++) {
                    g.strokeStyle = j % 3 ? C.grain : C.ridge; g.lineWidth = 0.8 + (j % 4) * 0.45;
                    g.stroke(ellipsePath(h.cx, h.cy, h.rx * (1 + j * 0.07), h.ry * (1 + j * 0.06), h.seed + j, 0.04));
                }
                g.strokeStyle = C.grain; g.lineWidth = 1.2;
                for (let i = 0; i < 60; i++) {
                    const a = R() * TAU, r0 = 1.05 + R() * 0.2, r1 = r0 + 0.2 + R() * 0.7;
                    g.beginPath(); g.moveTo(h.cx + Math.cos(a) * h.rx * r0, h.cy + Math.sin(a) * h.ry * r0);
                    g.quadraticCurveTo(h.cx + Math.cos(a + 0.05) * h.rx * (r0 + r1) / 2, h.cy + Math.sin(a + 0.05) * h.ry * (r0 + r1) / 2, h.cx + Math.cos(a) * h.rx * r1, h.cy + Math.sin(a) * h.ry * r1);
                    g.stroke();
                }
                // knotholes on the nearer rings (eyes blink in some of them)
                if (d < 2) for (let i = 0; i < 3; i++) {
                    const a = Math.PI * (0.85 + R() * 0.25) + (i % 2 ? Math.PI * 0.95 : 0), rr = 1.25 + R() * 0.25, x = h.cx + Math.cos(a) * h.rx * rr, y = h.cy + Math.sin(a) * h.ry * rr * 0.8;
                    if (x < 20 || x > W - 20 || y < 30 || y > H - 40) continue;
                    const s = unit * (0.022 + R() * 0.015);
                    g.fillStyle = C.wallOut; g.beginPath(); g.ellipse(x, y, s * 1.6, s * 2, 0, 0, TAU); g.fill();
                    g.strokeStyle = C.ridge; g.lineWidth = 3; g.beginPath(); g.ellipse(x, y, s * 1.9, s * 2.4, 0, 0, TAU); g.stroke();
                    g.fillStyle = "#050200"; g.beginPath(); g.ellipse(x, y, s, s * 1.4, 0, 0, TAU); g.fill();
                    knots.push({ x, y, s, d, ph: R() * TAU });
                }
                // the hole's lit rim, then cut the hole
                const hole = d === depth - 1 ? far.path : ellipsePath(h.cx, h.cy, h.rx, h.ry, h.seed, 0.05);
                h.path = hole;
                g.lineWidth = Math.max(3, unit * 0.012); g.strokeStyle = C.rim; g.stroke(hole);
                g.lineWidth = Math.max(8, unit * 0.03); g.strokeStyle = "rgba(0,0,0,.35)";
                g.save(); g.translate(0, unit * 0.012); g.stroke(hole); g.restore();
                g.globalCompositeOperation = "destination-out"; g.fill(hole); g.globalCompositeOperation = "source-over";
            }));
            // bracket fungi climbing the walls in a spiral, each with a few glowing caps under it
            shelves = []; fungi = [];
            for (let i = 0; i < 9; i++) {
                const d = Math.min(depth - 2, Math.floor(i / 3)), h = holes[d], side = i % 2 ? 1 : -1, a = side > 0 ? -0.15 + R() * 0.5 : Math.PI + 0.15 - R() * 0.5;
                const x = h.cx + Math.cos(a) * h.rx * 1.02, y = h.cy + Math.sin(a) * h.ry * 0.9 - (i % 3) * h.ry * 0.25, s = unit * (0.05 + R() * 0.04) * (1 - d * 0.2);
                if (x < -40 || x > W + 40) continue;
                shelves.push({ x, y, s, side, d });
                for (let k = 0; k < 3; k++) fungi.push({ x: x + side * -s * (0.2 + k * 0.35), y: y + s * 0.28, s: s * (0.14 + R() * 0.1), c: Math.floor(R() * 3), ph: R() * TAU, d });
            }
            // glow-worm threads (night) or hanging roots (day) from the top
            threads = Array.from({ length: preview ? 10 : 34 }, () => ({ x: R() * W, len: H * (0.08 + R() * 0.3), ph: R() * TAU, beads: 3 + Math.floor(R() * 5) }));
            // the hoard: a hill of acorns with stolen letter tiles and torn pages in it
            glints = [];
            const hw = Math.min(W * 0.62, 900), hh = Math.min(H * 0.3, 280);
            hoard = layer(hw, hh, g => {
                const pts = [];
                for (let i = 0; i < 420; i++) {
                    const u = R() * 2 - 1, top = hh * (1 - Math.pow(Math.abs(u), 1.6) * 0.92);
                    pts.push({ x: hw / 2 + u * hw * 0.5, y: hh - R() * top * 0.95, s: hh * (0.045 + R() * 0.03), r: R() * TAU, tile: R() < 0.07, page: R() < 0.02 });
                }
                pts.sort((a, b) => a.y - b.y);
                for (const p of pts) {
                    if (p.page) {
                        g.save(); g.translate(p.x, p.y); g.rotate(p.r * 0.3 - 0.15);
                        g.fillStyle = "#f6ecd2"; g.fillRect(-p.s * 1.6, -p.s, p.s * 3.2, p.s * 2.2);
                        g.strokeStyle = "rgba(120,90,50,.5)"; g.lineWidth = 1; for (let l = 0; l < 4; l++) { g.beginPath(); g.moveTo(-p.s * 1.3, -p.s * 0.5 + l * p.s * 0.45); g.lineTo(p.s * 1.3, -p.s * 0.5 + l * p.s * 0.45); g.stroke(); }
                        g.restore();
                    } else if (p.tile) {
                        g.save(); g.translate(p.x, p.y); g.rotate(p.r * 0.4 - 0.2);
                        g.fillStyle = C.tile; g.strokeStyle = C.tileInk; g.lineWidth = 1.5;
                        g.fillRect(-p.s, -p.s, p.s * 2, p.s * 2); g.strokeRect(-p.s, -p.s, p.s * 2, p.s * 2);
                        g.fillStyle = C.tileInk; g.font = `800 ${Math.round(p.s * 1.4)}px "Patua One", serif`; g.textAlign = "center"; g.textBaseline = "middle";
                        g.fillText(String.fromCharCode(65 + Math.floor(R() * 26)), 0, p.s * 0.08);
                        g.restore();
                        glints.push({ x: p.x - hw / 2, y: p.y - hh, ph: R() * TAU });
                    } else {
                        const s = p.s;
                        g.save(); g.translate(p.x, p.y); g.rotate(p.r);
                        g.fillStyle = C.nut[0]; g.beginPath(); g.ellipse(0, s * 0.15, s * 0.55, s * 0.68, 0, 0, TAU); g.fill();
                        g.fillStyle = C.nut[1]; g.beginPath(); g.ellipse(0, -s * 0.3, s * 0.7, s * 0.38, 0, Math.PI, TAU); g.fill();
                        g.fillRect(-s * 0.06, -s * 0.85, s * 0.12, s * 0.3);
                        g.fillStyle = "rgba(255,255,255,.2)"; g.beginPath(); g.ellipse(-s * 0.2, s * 0.05, s * 0.12, s * 0.25, -0.3, 0, TAU); g.fill();
                        g.restore();
                    }
                }
                // shade it from below so it sits on the floor
                g.globalCompositeOperation = "source-atop";
                g.fillStyle = lin(g, 0, 0, 0, hh, [[0, "rgba(255,230,170,.12)"], [0.6, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,.45)"]]);
                g.fillRect(0, 0, hw, hh);
            });
            motes = Array.from({ length: preview ? 18 : lite() ? 40 : 90 }, () => ({ x: R(), y: R(), v: 4 + R() * 12, s: 0.6 + R() * 1.8, ph: R() * TAU }));
            flies = Array.from({ length: preview ? 6 : 22 }, () => ({ x: R() * W, y: H * (0.25 + R() * 0.6), vx: 0, vy: 0, ph: R() * TAU }));
            leaves = Array.from({ length: preview ? 4 : 14 }, () => newLeaf(R, true));
        }
        function lerp01(a, b, k) {                                    // mix two #rrggbb colours
            const p = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)), A = p(a), B = p(b);
            return "#" + A.map((v, i) => Math.round(lerp(v, B[i], k)).toString(16).padStart(2, "0")).join("");
        }
        function newLeaf(R = Math.random, initial = false) {
            const far = holes.far;
            return { x: far.cx + (R() - 0.5) * far.rx * 2, y: initial ? R() * H : far.cy, vy: 22 + R() * 26, ph: R() * TAU, sw: 0.8 + R() * 1.2, s: 4 + R() * 6, c: Math.floor(R() * 4), spin: 1.5 + R() * 2.5 };
        }
        setup();

        function drawShelf(g, sh) {
            const { x, y, s, side } = sh;
            g.save(); g.translate(x, y); g.scale(side, 1);
            g.fillStyle = C.shelf[1]; g.beginPath(); g.ellipse(-s * 0.3, s * 0.08, s * 0.95, s * 0.3, 0, 0, Math.PI); g.fill();
            g.fillStyle = C.shelf[0]; g.beginPath(); g.ellipse(-s * 0.3, 0, s, s * 0.32, 0, Math.PI, TAU); g.lineTo(s * 0.7, s * 0.04); g.ellipse(-s * 0.3, 0, s, s * 0.12, 0, 0, Math.PI); g.fill();
            g.strokeStyle = "rgba(0,0,0,.25)"; g.lineWidth = 1.2;
            for (let i = 1; i < 4; i++) { g.beginPath(); g.ellipse(-s * 0.3, 0, s * (1 - i * 0.2), s * (0.32 - i * 0.06), 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); }
            g.restore();
        }

        return {
            resize(w, h) { W = w; H = h; setup(); },
            draw(g, t, dt, inp) {
                const px = inp.px || 0, py = inp.py || 0, far = holes.far;
                g.fillStyle = C.deep; g.fillRect(0, 0, W, H);
                // the sky through the far opening: clouds drifting past, the moon or the sun
                const fx = far.cx - px * 2, fy = far.cy - py * 2;
                g.save(); g.translate(-px * 2, -py * 2); g.clip(far.path);
                if (!skyFill) skyFill = lin(g, 0, far.cy - far.ry, 0, far.cy + far.ry, [[0, C.skyTop], [1, C.skyBot]]);
                g.fillStyle = skyFill; g.fillRect(far.cx - far.rx * 1.3, far.cy - far.ry * 1.3, far.rx * 2.6, far.ry * 2.6);
                if (night) {
                    for (let i = 0; i < 14; i++) { const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.8 + i)); g.fillStyle = `rgba(255,250,230,${tw.toFixed(2)})`; g.fillRect(far.cx + Math.sin(i * 7.1) * far.rx * 0.9, far.cy + Math.cos(i * 3.7) * far.ry * 0.8, 1.6, 1.6); }
                    Worlds.glow(g, far.cx + far.rx * 0.35, far.cy - far.ry * 0.25, far.rx * 0.9, "#cfe0ff", 0.6);
                    g.fillStyle = "#fbf6e6"; g.beginPath(); g.arc(far.cx + far.rx * 0.35, far.cy - far.ry * 0.25, far.rx * 0.2, 0, TAU); g.fill();
                } else {
                    Worlds.glow(g, far.cx - far.rx * 0.2, far.cy - far.ry * 0.3, far.rx * 1.4, "#fff6c0", 0.9);
                }
                for (let i = 0; i < 3; i++) {
                    const cx = far.cx - far.rx * 1.3 + ((t * (6 + i * 3) + i * far.rx) % (far.rx * 2.6)), cy = far.cy + (i - 1) * far.ry * 0.4;
                    g.fillStyle = night ? "rgba(90,110,160,.5)" : "rgba(255,255,255,.85)";
                    for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(cx + k * far.rx * 0.12, cy - (k % 2) * far.ry * 0.06, far.rx * 0.16, far.ry * 0.09, 0, 0, TAU); g.fill(); }
                }
                g.restore();
                // the rings of the trunk, far to near, each shifting a little more with the pointer
                for (let d = walls.length - 1; d >= 0; d--) {
                    const z = holes[d].z;
                    g.drawImage(walls[d], -px * 16 * z, -py * 10 * z);
                    // the fungus shelves on this ring, with their caps glowing
                    for (const sh of shelves) if (sh.d === d) { g.save(); g.translate(-px * 16 * z, -py * 10 * z); drawShelf(g, sh); g.restore(); }
                    for (const f of fungi) if (f.d === d) {
                        const k = 0.6 + 0.4 * Math.sin(t * 1.3 + f.ph), x = f.x - px * 16 * z, y = f.y - py * 10 * z, col = C.fungus[f.c];
                        Worlds.glow(g, x, y, f.s * 5, col, (night ? 0.55 : 0.25) * k);
                        g.fillStyle = col; g.beginPath(); g.ellipse(x, y, f.s, f.s * 0.5, 0, Math.PI, TAU); g.fill();
                        g.fillStyle = night ? "rgba(255,255,255,.5)" : "rgba(255,255,255,.7)"; g.fillRect(x - f.s * 0.12, y, f.s * 0.24, f.s * 0.8);
                    }
                }
                // the eyes in the knotholes: they blink, and look toward the pointer
                for (const kn of knots) {
                    const z = holes[kn.d].z, x = kn.x - px * 16 * z, y = kn.y - py * 10 * z, cyc = (t * 0.25 + kn.ph) % 6;
                    if (cyc > 4.5) continue;                                  // (sometimes nobody's home)
                    const blink = (t * 0.7 + kn.ph) % 4 < 0.12 ? 0.1 : 1, lx = px * kn.s * 0.25;
                    for (const sd of [-1, 1]) {
                        Worlds.glow(g, x + sd * kn.s * 0.45, y, kn.s * 0.9, night ? "#ffd36b" : "#ffe9a3", night ? 0.5 : 0.25);
                        g.fillStyle = night ? "#ffe9a3" : "#fff6d8"; g.beginPath(); g.ellipse(x + sd * kn.s * 0.45 + lx, y, kn.s * 0.24, kn.s * 0.3 * blink, 0, 0, TAU); g.fill();
                        g.fillStyle = "#1a0c04"; g.beginPath(); g.ellipse(x + sd * kn.s * 0.45 + lx * 1.4, y, kn.s * 0.1, kn.s * 0.2 * blink, 0, 0, TAU); g.fill();
                    }
                }
                // the shaft of light from the opening down to the hoard, with rays that breathe
                g.save(); g.globalCompositeOperation = "lighter";
                if (!beam) beam = lin(g, 0, far.cy, 0, H, [[0, `rgba(${C.beam},${night ? 0.07 : 0.1})`], [0.6, `rgba(${C.beam},${night ? 0.03 : 0.05})`], [1, `rgba(${C.beam},0)`]]);
                g.fillStyle = beam;
                for (const k of [1, 0.78, 0.56, 0.36]) {
                    g.beginPath(); g.moveTo(fx - far.rx * 0.8 * k, fy); g.lineTo(fx + far.rx * 0.8 * k, fy); g.lineTo(W * 0.5 + W * 0.26 * k - px * 8, H); g.lineTo(W * 0.5 - W * 0.28 * k - px * 8, H); g.closePath(); g.fill();
                }
                for (let i = 0; i < 6; i++) {
                    const a = (Math.sin(t * 0.3 + i * 1.7) * 0.5 + 0.5) * (night ? 0.035 : 0.05), x0 = fx + (i - 2.5) * far.rx * 0.25, x1 = W * 0.5 + (i - 2.5) * W * 0.08 - px * 8;
                    g.fillStyle = `rgba(${C.beam},${a.toFixed(3)})`;
                    g.beginPath(); g.moveTo(x0 - 6, fy); g.lineTo(x0 + 6, fy); g.lineTo(x1 + 30, H); g.lineTo(x1 - 30, H); g.closePath(); g.fill();
                }
                g.restore();
                // dust motes turning in the light
                for (const m of motes) {
                    m.y += m.v * dt / H * 0.5; if (m.y > 1) m.y = 0;
                    const yy = lerp(fy, H, m.y), half = lerp(far.rx * 0.7, W * 0.25, m.y), x = W * 0.5 + (m.x - 0.5) * 2 * half + Math.sin(t * 0.5 + m.ph) * 12 - px * 8;
                    const k = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + m.ph));
                    g.fillStyle = `rgba(${C.beam},${(0.55 * k).toFixed(2)})`; g.fillRect(x, yy, m.s, m.s);
                }
                // threads of glow-worms (night) or hanging roots (day)
                g.lineCap = "round";
                for (const th of threads) {
                    const sw = Math.sin(t * 0.5 + th.ph) * 6, x = th.x - px * 20;
                    if (night) {
                        g.strokeStyle = "rgba(180,230,255,.22)"; g.lineWidth = 1;
                        g.beginPath(); g.moveTo(x, 0); g.lineTo(x + sw, th.len); g.stroke();
                        for (let b = 1; b <= th.beads; b++) { const k = b / th.beads, bx = x + sw * k, by = th.len * k, tw = 0.5 + 0.5 * Math.sin(t * 2 + th.ph + b); Worlds.glow(g, bx, by, 6, "#9ff0ff", 0.4 * tw); g.fillStyle = "#dffaff"; g.fillRect(bx - 0.8, by - 0.8, 1.6, 1.6); }
                    } else {
                        g.strokeStyle = "rgba(60,36,16,.75)"; g.lineWidth = 2.5;
                        g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + sw, th.len * 0.6, x + sw * 1.4, th.len); g.stroke();
                        g.fillStyle = "#5c8f3a"; for (let b = 1; b <= th.beads; b++) { const k = b / (th.beads + 1); g.beginPath(); g.ellipse(x + sw * k * 1.2 + 4, th.len * k, 4, 2, 0.6, 0, TAU); g.fill(); }
                    }
                }
                // the hoard, glowing gold where the stolen tiles catch the light
                const hx = W * 0.5 - hoard.width / 2 - px * 6, hy = H - hoard.height + 8 - py * 3;
                g.save(); g.globalCompositeOperation = "lighter";
                g.fillStyle = rad(g, W * 0.5 - px * 6, H, 0, hoard.width * 0.6, [[0, night ? "rgba(255,170,70,.3)" : "rgba(255,226,150,.35)"], [1, "rgba(0,0,0,0)"]]);
                g.fillRect(0, H - hoard.height * 1.6, W, hoard.height * 1.6);
                g.restore();
                g.drawImage(hoard, hx, hy);
                for (const gl of glints) { const k = Math.max(0, Math.sin(t * 1.6 + gl.ph)); if (k > 0.6) Worlds.glint(g, hx + hoard.width / 2 + gl.x, hy + hoard.height + gl.y - 4, 7 * k, (k - 0.6) / 0.4, "#fff6c0"); }
                // now and then an acorn drops from on high and bounces into the hoard
                nextDrop -= dt;
                if (nextDrop <= 0) { nextDrop = U.rand(3, 7); drops.push({ x: W * (0.4 + Math.random() * 0.2), y: far.cy, v: 0, r: Math.random() * TAU, vr: U.rand(-4, 4), b: 0 }); }
                drops = drops.filter(d => {
                    d.v += 700 * dt; d.y += d.v * dt; d.r += d.vr * dt;
                    const floor = H - hoard.height * 0.72;
                    if (d.y > floor && d.b < 2) { d.y = floor; d.v *= -0.32; d.b++; d.x += U.rand(-20, 20); }
                    const s = Math.min(W, H) * 0.02;
                    g.save(); g.translate(d.x - px * 6, d.y); g.rotate(d.r);
                    g.fillStyle = C.nut[0]; g.beginPath(); g.ellipse(0, s * 0.15, s * 0.55, s * 0.68, 0, 0, TAU); g.fill();
                    g.fillStyle = C.nut[1]; g.beginPath(); g.ellipse(0, -s * 0.3, s * 0.7, s * 0.38, 0, Math.PI, TAU); g.fill();
                    g.restore();
                    return d.b < 2 || d.y < H;
                }).slice(-6);
                // leaves drifting down through the light, turning over as they go
                for (let i = 0; i < leaves.length; i++) {
                    const l = leaves[i];
                    l.y += l.vy * dt;
                    if (l.y > H + 20) leaves[i] = newLeaf();
                    const x = l.x + Math.sin(t * l.sw + l.ph) * 40 - px * 12, flip = Math.cos(t * l.spin + l.ph);
                    g.save(); g.translate(x, l.y); g.rotate(Math.sin(t * l.sw + l.ph) * 0.8); g.scale(flip, 1);
                    g.fillStyle = C.leaf[l.c]; g.beginPath(); g.moveTo(-l.s, 0); g.quadraticCurveTo(0, -l.s * 0.6, l.s, 0); g.quadraticCurveTo(0, l.s * 0.6, -l.s, 0); g.fill();
                    g.strokeStyle = "rgba(0,0,0,.25)"; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-l.s, 0); g.lineTo(l.s, 0); g.stroke();
                    g.restore();
                }
                // fireflies (night) or pollen (day), wandering
                for (const f of flies) {
                    f.vx += (Math.sin(t * 0.7 + f.ph * 3) * 18 - f.vx) * dt; f.vy += (Math.cos(t * 0.5 + f.ph * 2) * 12 - f.vy) * dt;
                    f.x = (f.x + f.vx * dt + W) % W; f.y = Math.min(H * 0.92, Math.max(H * 0.15, f.y + f.vy * dt));
                    const k = night ? Math.max(0, Math.sin(t * 2.2 + f.ph)) : 0.6, x = f.x - px * 14;
                    if (k > 0.05) { Worlds.glow(g, x, f.y, night ? 12 : 5, C.fly, (night ? 0.8 : 0.4) * k); g.fillStyle = night ? "#f4ffd0" : "#fffbe0"; g.fillRect(x - 1, f.y - 1, 2, 2); }
                }
                // sap beading on the shelves' edges, falling as amber drops
                if (!preview && sap.length < 6 && Math.random() < dt * 0.5 && shelves.length) { const sh = U.pick(shelves); sap.push({ x: sh.x + sh.side * sh.s * 0.6, y: sh.y + sh.s * 0.1, d: sh.d, v: 0, grow: 0 }); }
                sap = sap.filter(s => {
                    const z = holes[s.d].z;
                    if (s.grow < 1) s.grow += dt * 0.4; else { s.v += 500 * dt; s.y += s.v * dt; }
                    const x = s.x - px * 16 * z, y = s.y - py * 10 * z, r = 2 + s.grow * 1.6;
                    g.fillStyle = "rgba(255,170,50,.85)"; g.beginPath(); g.ellipse(x, y, r * 0.8, r * (s.grow < 1 ? 1 : 1.6), 0, 0, TAU); g.fill();
                    Worlds.glint(g, x - r * 0.3, y - r * 0.3, r, 0.6, "#fff2c0");
                    return s.y < H;
                });
            }
        };
    };

    // =============================================================================================================
    // Atlantis: the city below the reef. Caustic light rippling down from the surface far above, rays turning slowly;
    // a far skyline of domes and towers with lit windows and a colossal statue of the sea king, his trident raised; the
    // great temple in front with a crystal at its peak that pulses with the city's heart; a broken arch; schools of
    // fish, a manta gliding, glowing jellyfish, kelp, coral, bubbles and marine snow.
    // =============================================================================================================
    SecretScenes.atlantis = function (W, H, opts) {
        const night = opts.theme === "dark", preview = !!opts.preview;
        const C = night
            ? { top: "#0a3a5e", mid: "#052440", bot: "#020c1c", caustic: "140,225,255", ray: "120,200,255", far: "#0c3a5e", far2: "#0a2d4c", mid1: "#14527c", mid2: "#0d3a5c", trim: "#e8c66a", win: "#ffe9a3", crystal: "#7fe8ff",
                coral: ["#ff6a8a", "#ff9a5a", "#c060e0", "#ffd36b"], kelp: ["#1f7a52", "#2f9e6b"], sand: ["#1a3a4a", "#0c2030"], fish: "#cfe8f5", glow: true }
            : { top: "#7fe2f2", mid: "#2a9ccc", bot: "#0e5486", caustic: "255,255,255", ray: "255,255,230", far: "#5ab4d4", far2: "#4aa2c6", mid1: "#e6f2f0", mid2: "#a8cfd6", trim: "#d9a93a", win: "#fff6d8", crystal: "#bff4ff",
                coral: ["#ff7a8a", "#ffa86a", "#d07ae8", "#ffe07a"], kelp: ["#2f9e6b", "#4fbf7b"], sand: ["#e9d6a8", "#c9b080"], fish: "#ffffff", glow: false };
        let water, farCity, temple, arch, reef, crystalAt, kelp, schools, jellies, bubbles, snow, manta = null, nextManta = preview ? 999 : 8, rays = null;

        function setup() {
            const R = U.rng(7171), unit = Math.min(W, H), horizon = H * 0.64;
            water = null; rays = null;
            // the far city and the statue of the sea king, hazed by the water
            farCity = layer(W * 1.1, H, g => {
                const w = W * 1.1;
                // the colossus: robed, crowned, his trident raised
                const sx = w * 0.76, sb = horizon + H * 0.02, sh = H * 0.56, sw = sh * 0.22;
                g.fillStyle = C.far2;
                g.beginPath(); g.moveTo(sx - sw * 0.6, sb); g.lineTo(sx - sw * 0.45, sb - sh * 0.55); g.lineTo(sx - sw * 0.55, sb - sh * 0.7); g.lineTo(sx - sw * 0.25, sb - sh * 0.8);
                g.lineTo(sx + sw * 0.25, sb - sh * 0.8); g.lineTo(sx + sw * 0.6, sb - sh * 0.68); g.lineTo(sx + sw * 0.45, sb - sh * 0.5); g.lineTo(sx + sw * 0.6, sb); g.closePath(); g.fill();
                g.beginPath(); g.arc(sx, sb - sh * 0.86, sw * 0.2, 0, TAU); g.fill();                              // head
                for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(sx + i * sw * 0.08 - sw * 0.04, sb - sh * 0.92); g.lineTo(sx + i * sw * 0.08, sb - sh * 0.99); g.lineTo(sx + i * sw * 0.08 + sw * 0.04, sb - sh * 0.92); g.fill(); }
                g.lineWidth = sw * 0.12; g.strokeStyle = C.far2; g.lineCap = "round";
                g.beginPath(); g.moveTo(sx + sw * 0.5, sb - sh * 0.66); g.lineTo(sx + sw * 0.85, sb - sh * 0.9); g.stroke();           // the raised arm
                g.lineWidth = sw * 0.06; g.beginPath(); g.moveTo(sx + sw * 0.85, sb - sh * 0.4); g.lineTo(sx + sw * 0.85, sb - sh * 1.12); g.stroke();
                g.beginPath(); g.moveTo(sx + sw * 0.6, sb - sh * 1.12); g.lineTo(sx + sw * 0.6, sb - sh * 1.04); g.lineTo(sx + sw * 1.1, sb - sh * 1.04); g.lineTo(sx + sw * 1.1, sb - sh * 1.12); g.moveTo(sx + sw * 0.85, sb - sh * 1.18); g.lineTo(sx + sw * 0.85, sb - sh * 1.04); g.stroke();
                // the skyline: domes, towers, a ziggurat, arches
                for (let x = -20; x < w; ) {
                    const kind = R(), bw = unit * (0.05 + R() * 0.07), bh = H * (0.08 + R() * 0.16);
                    g.fillStyle = R() < 0.5 ? C.far : C.far2;
                    if (kind < 0.3) { g.fillRect(x, horizon - bh * 0.6, bw, bh * 0.6); g.beginPath(); g.ellipse(x + bw / 2, horizon - bh * 0.6, bw / 2, bh * 0.35, 0, Math.PI, TAU); g.fill(); g.fillRect(x + bw / 2 - 1.5, horizon - bh * 1.05, 3, bh * 0.12); }
                    else if (kind < 0.6) { g.fillRect(x + bw * 0.2, horizon - bh, bw * 0.6, bh); g.beginPath(); g.moveTo(x + bw * 0.15, horizon - bh); g.lineTo(x + bw / 2, horizon - bh * 1.3); g.lineTo(x + bw * 0.85, horizon - bh); g.fill(); }
                    else if (kind < 0.8) { for (let s = 0; s < 4; s++) g.fillRect(x + s * bw * 0.1, horizon - bh * (s + 1) * 0.22, bw - s * bw * 0.2, bh * 0.22); }
                    else { g.fillRect(x, horizon - bh * 0.5, bw * 1.6, bh * 0.5); g.fillStyle = C.top; for (let a = 0; a < 3; a++) { g.beginPath(); g.ellipse(x + bw * (0.3 + a * 0.5), horizon, bw * 0.16, bh * 0.3, 0, Math.PI, TAU); g.fill(); } }
                    // lit windows
                    g.fillStyle = C.win;
                    for (let i = 0; i < 4; i++) if (R() < (night ? 0.7 : 0.35)) { g.globalAlpha = night ? 0.85 : 0.5; g.fillRect(x + bw * (0.3 + R() * 0.4), horizon - bh * (0.2 + R() * 0.5), 2.5, 3.5); }
                    g.globalAlpha = 1;
                    x += bw * (0.7 + R() * 0.6);
                }
                // the water's haze over it
                g.globalCompositeOperation = "source-atop";
                g.fillStyle = lin(g, 0, H * 0.1, 0, horizon, [[0, night ? "rgba(10,58,94,.75)" : "rgba(127,226,242,.7)"], [1, night ? "rgba(5,36,64,.2)" : "rgba(42,156,204,.25)"]]);
                g.fillRect(0, 0, w, H);
            });
            // the great temple: steps, six fluted columns, a frieze, the pediment with its gold trim
            const tw = Math.min(W * 0.42, unit * 0.9), th = tw * 0.62;
            temple = layer(tw, th * 1.3, g => {
                const base = th * 1.25, colH = th * 0.52, top = base - th * 0.18 - colH;
                const stone = lin(g, 0, 0, tw, 0, [[0, C.mid2], [0.4, C.mid1], [1, C.mid2]]);
                for (let s = 0; s < 3; s++) { g.fillStyle = s % 2 ? C.mid2 : C.mid1; g.fillRect(tw * (0.02 + s * 0.03), base - th * 0.06 * (s + 1), tw * (0.96 - s * 0.06), th * 0.06); }
                const n = 6, cw = tw * 0.07;
                for (let i = 0; i < n; i++) {
                    const x = tw * 0.12 + i * (tw * 0.76 - cw) / (n - 1);
                    if (i === 4) {                                                  // one broken column
                        g.fillStyle = stone; g.fillRect(x, top + colH * 0.45, cw, colH * 0.55);
                        g.beginPath(); g.moveTo(x, top + colH * 0.45); g.lineTo(x + cw * 0.4, top + colH * 0.38); g.lineTo(x + cw, top + colH * 0.47); g.fill();
                        continue;
                    }
                    g.fillStyle = stone; g.fillRect(x, top, cw, colH);
                    g.strokeStyle = "rgba(0,40,70,.25)"; g.lineWidth = 1;
                    for (let f = 1; f < 4; f++) { g.beginPath(); g.moveTo(x + cw * f / 4, top + 4); g.lineTo(x + cw * f / 4, top + colH - 4); g.stroke(); }
                    g.fillStyle = C.mid1; g.fillRect(x - cw * 0.2, top - th * 0.03, cw * 1.4, th * 0.03); g.fillRect(x - cw * 0.15, top + colH - th * 0.02, cw * 1.3, th * 0.02);
                }
                g.fillStyle = C.mid1; g.fillRect(tw * 0.08, top - th * 0.12, tw * 0.84, th * 0.09);
                g.fillStyle = C.trim; g.fillRect(tw * 0.08, top - th * 0.08, tw * 0.84, th * 0.012);
                for (let i = 0; i < 18; i++) g.fillRect(tw * 0.1 + i * tw * 0.046, top - th * 0.11, tw * 0.02, th * 0.025);
                // the pediment with a gold rim and a round relief of a trident
                const py = top - th * 0.12;
                g.fillStyle = C.mid2; g.beginPath(); g.moveTo(tw * 0.05, py); g.lineTo(tw * 0.5, py - th * 0.28); g.lineTo(tw * 0.95, py); g.closePath(); g.fill();
                g.strokeStyle = C.trim; g.lineWidth = Math.max(2, th * 0.02); g.stroke();
                g.beginPath(); g.arc(tw * 0.5, py - th * 0.1, th * 0.07, 0, TAU); g.stroke();
                g.lineWidth = Math.max(1.5, th * 0.012); g.beginPath(); g.moveTo(tw * 0.5, py - th * 0.04); g.lineTo(tw * 0.5, py - th * 0.16); g.moveTo(tw * 0.47, py - th * 0.15); g.lineTo(tw * 0.47, py - th * 0.12); g.lineTo(tw * 0.53, py - th * 0.12); g.lineTo(tw * 0.53, py - th * 0.15); g.stroke();
                // weed draped over it
                g.strokeStyle = C.kelp[0]; g.lineWidth = 3; g.lineCap = "round";
                for (let i = 0; i < 6; i++) { const x = tw * (0.12 + R() * 0.76); g.beginPath(); g.moveTo(x, top - th * 0.04); g.quadraticCurveTo(x + 8, top + colH * 0.2, x - 4, top + colH * (0.2 + R() * 0.3)); g.stroke(); }
                crystalAt = { x: tw * 0.5, y: py - th * 0.28 };
            });
            temple.at = { x: W * 0.3, y: H * 0.86 };
            // a broken arch on the right
            const aw = Math.min(W * 0.26, unit * 0.5), ah = aw * 0.9;
            arch = layer(aw, ah, g => {
                const st = lin(g, 0, 0, aw, 0, [[0, C.mid2], [0.5, C.mid1], [1, C.mid2]]);
                g.fillStyle = st;
                g.beginPath(); g.moveTo(0, ah); g.lineTo(0, ah * 0.4); g.arc(aw / 2, ah * 0.4, aw / 2, Math.PI, 0); g.lineTo(aw, ah); g.lineTo(aw * 0.78, ah); g.lineTo(aw * 0.78, ah * 0.4); g.arc(aw / 2, ah * 0.4, aw * 0.28, 0, Math.PI, true); g.lineTo(aw * 0.22, ah); g.closePath(); g.fill();
                g.globalCompositeOperation = "destination-out";
                g.beginPath(); g.moveTo(aw * 0.62, 0); g.lineTo(aw * 0.95, ah * 0.05); g.lineTo(aw, ah * 0.35); g.lineTo(aw * 0.7, ah * 0.18); g.fill();
                g.globalCompositeOperation = "source-over";
                g.strokeStyle = C.trim; g.lineWidth = 3; g.beginPath(); g.arc(aw / 2, ah * 0.4, aw * 0.39, Math.PI * 1.05, Math.PI * 1.6); g.stroke();
                g.fillStyle = "rgba(0,40,70,.2)"; for (let i = 0; i < 8; i++) g.fillRect(0, ah * (0.45 + i * 0.07), aw * 0.22, 1.5);
            });
            // the reef in front: coral fans, branching coral, brain coral, a toppled column and amphorae on the sand
            reef = layer(W, H * 0.3, g => {
                const h = H * 0.3;
                g.fillStyle = lin(g, 0, h * 0.4, 0, h, [[0, C.sand[0]], [1, C.sand[1]]]);
                g.beginPath(); g.moveTo(0, h); g.lineTo(0, h * 0.55);
                for (let x = 0; x <= W; x += 20) g.lineTo(x, h * (0.55 + Math.sin(x * 0.01) * 0.06 + Math.sin(x * 0.033) * 0.03));
                g.lineTo(W, h); g.closePath(); g.fill();
                const clump = (x, s) => {
                    for (let i = 0; i < 4; i++) {                                        // branching coral
                        const c = C.coral[(i + Math.floor(x)) % C.coral.length];
                        g.strokeStyle = c; g.lineCap = "round"; g.lineWidth = s * 0.08;
                        const bx = x + (i - 1.5) * s * 0.35, by = h * 0.62;
                        const branch = (x0, y0, a, l, d) => { if (d > 3) return; const x1 = x0 + Math.cos(a) * l, y1 = y0 + Math.sin(a) * l; g.lineWidth = s * 0.08 * (1 - d * 0.2); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); branch(x1, y1, a - 0.45, l * 0.72, d + 1); branch(x1, y1, a + 0.4, l * 0.7, d + 1); };
                        branch(bx, by, -Math.PI / 2 + (R() - 0.5) * 0.4, s * 0.35, 0);
                    }
                    g.fillStyle = C.coral[2]; g.globalAlpha = 0.85;                       // a fan
                    g.beginPath(); g.moveTo(x - s * 0.6, h * 0.64); g.quadraticCurveTo(x - s * 1.2, h * 0.64 - s * 0.9, x - s * 0.4, h * 0.64 - s * 1.1); g.quadraticCurveTo(x, h * 0.64 - s * 0.5, x - s * 0.6, h * 0.64); g.fill();
                    g.globalAlpha = 1;
                    g.fillStyle = C.coral[3]; g.beginPath(); g.ellipse(x + s * 0.7, h * 0.66, s * 0.32, s * 0.22, 0, Math.PI, TAU); g.fill();   // brain coral
                    g.strokeStyle = "rgba(0,0,0,.2)"; g.lineWidth = 1; for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(x + s * 0.7, h * 0.66, Math.max(1, s * 0.3 * (1 - k * 0.22)), Math.max(1, s * 0.2 * (1 - k * 0.22)), 0, Math.PI, TAU); g.stroke(); }
                };
                clump(W * 0.06, unit * 0.16); clump(W * 0.93, unit * 0.18); clump(W * 0.55, unit * 0.09);
                // a toppled column and two amphorae
                g.fillStyle = C.mid1; g.save(); g.translate(W * 0.72, h * 0.66); g.rotate(0.08); g.fillRect(0, -unit * 0.025, unit * 0.22, unit * 0.05); g.restore();
                for (const [x, s] of [[W * 0.42, unit * 0.03], [W * 0.46, unit * 0.022]]) {
                    g.fillStyle = night ? "#8a4a2a" : "#c8743a"; g.beginPath(); g.ellipse(x, h * 0.66, s * 0.6, s, 0, 0, TAU); g.fill(); g.fillRect(x - s * 0.2, h * 0.66 - s * 1.4, s * 0.4, s * 0.5);
                    g.strokeStyle = "rgba(0,0,0,.3)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - s * 0.55, h * 0.66 - s * 0.2); g.lineTo(x + s * 0.55, h * 0.66 - s * 0.2); g.stroke();
                }
            });
            kelp = Array.from({ length: preview ? 6 : 18 }, (_, i) => ({ x: (i / 18) * W + R() * 30, h: H * (0.2 + R() * 0.32), ph: R() * TAU, w: 5 + R() * 6, c: Math.floor(R() * 2), front: R() < 0.4 }));
            schools = Array.from({ length: preview ? 1 : 3 }, (_, i) => ({ x: R() * W, y: H * (0.25 + i * 0.15), dir: i % 2 ? -1 : 1, sp: 30 + R() * 30, ph: R() * TAU, fish: Array.from({ length: 9 + Math.floor(R() * 8) }, () => ({ dx: (R() - 0.5) * 120, dy: (R() - 0.5) * 50, ph: R() * TAU })) }));
            jellies = Array.from({ length: preview ? 2 : 5 }, () => ({ x: R() * W, y: H * (0.2 + R() * 0.5), ph: R() * TAU, s: unit * (0.018 + R() * 0.02), c: R() < 0.5 ? "#f09aff" : "#9ff0ff" }));
            bubbles = Array.from({ length: preview ? 12 : lite() ? 30 : 60 }, () => ({ x: R() * W, y: R() * H, r: 1 + R() * 3.5, v: 20 + R() * 40, ph: R() * TAU }));
            snow = Array.from({ length: preview ? 20 : lite() ? 40 : 90 }, () => ({ x: R() * W, y: R() * H, v: 5 + R() * 10, s: 0.6 + R() * 1.4, ph: R() * TAU }));
        }
        setup();
        function fishAt(g, x, y, s, dir, t, ph) {
            const wag = Math.sin(t * 10 + ph) * 0.25;
            g.save(); g.translate(x, y); g.scale(dir, 1);
            g.fillStyle = C.fish; g.beginPath(); g.ellipse(0, 0, s, s * 0.38, 0, 0, TAU); g.fill();
            g.beginPath(); g.moveTo(-s * 0.8, 0); g.lineTo(-s * 1.5, -s * (0.4 + wag)); g.lineTo(-s * 1.5, s * (0.4 - wag)); g.closePath(); g.fill();
            g.fillStyle = "rgba(0,40,70,.5)"; g.fillRect(s * 0.4, -s * 0.1, s * 0.15, s * 0.15);
            g.restore();
        }

        return {
            resize(w, h) { W = w; H = h; setup(); },
            draw(g, t, dt, inp) {
                const px = inp.px || 0, py = inp.py || 0;
                if (!water) water = lin(g, 0, 0, 0, H, [[0, C.top], [0.45, C.mid], [1, C.bot]]);
                g.fillStyle = water; g.fillRect(0, 0, W, H);
                // the surface far above: caustic light rippling
                g.save(); g.globalCompositeOperation = "lighter"; g.lineWidth = 1.6;
                for (let i = 0; i < 12; i++) {
                    const base = H * (0.02 + i * 0.03), a = (night ? 0.05 : 0.09) * (1 - i / 12);
                    g.strokeStyle = `rgba(${C.caustic},${a.toFixed(3)})`;
                    g.beginPath();
                    for (let x = -10; x <= W + 10; x += 16) { const y = base + Math.sin(x * 0.012 + t * (0.6 + i * 0.07) + i) * 10 + Math.sin(x * 0.031 - t * 0.9 + i * 2) * 5; x === -10 ? g.moveTo(x, y) : g.lineTo(x, y); }
                    g.stroke();
                }
                // rays turning slowly from the surface
                if (!rays) rays = lin(g, 0, 0, 0, H * 0.9, [[0, `rgba(${C.ray},${night ? 0.1 : 0.2})`], [1, `rgba(${C.ray},0)`]]);
                g.fillStyle = rays;
                for (let i = 0; i < 7; i++) {
                    const x = W * (0.1 + i * 0.14) + Math.sin(t * 0.15 + i) * 40 - px * 10, sw = 30 + (i % 3) * 25, lean = 80 + Math.sin(t * 0.2 + i * 2) * 40;
                    g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 0.4 + i * 1.3);
                    g.beginPath(); g.moveTo(x - sw * 0.4, 0); g.lineTo(x + sw * 0.4, 0); g.lineTo(x + lean + sw, H * 0.9); g.lineTo(x + lean - sw, H * 0.9); g.closePath(); g.fill();
                }
                g.globalAlpha = 1; g.restore();
                // the far city and its statue, then marine snow drifting in front of it
                g.drawImage(farCity, -W * 0.05 - px * 6, -py * 4);
                if (night) for (let i = 0; i < 10; i++) { const x = (W * 0.05 + i * W * 0.1 + Math.sin(i * 3) * 30) - px * 6; Worlds.glow(g, x, H * 0.6 + Math.sin(i * 7) * 10, 18, C.win, 0.12 + 0.08 * Math.sin(t + i)); }
                // the manta, now and then gliding across the middle distance
                nextManta -= dt;
                if (!manta && nextManta <= 0) manta = { x: -120, y: H * U.rand(0.3, 0.45), dir: 1, s: Math.min(W, H) * U.rand(0.05, 0.08) };
                if (manta) {
                    manta.x += 55 * dt;
                    const flap = Math.sin(t * 2) * 0.35, s = manta.s, x = manta.x - px * 8, y = manta.y + Math.sin(t * 0.8) * 8;
                    g.fillStyle = night ? "rgba(6,30,52,.85)" : "rgba(20,80,120,.7)";
                    g.beginPath(); g.moveTo(x + s * 0.9, y); g.quadraticCurveTo(x, y - s * (1.2 + flap), x - s * 0.4, y - s * (1.5 + flap)); g.quadraticCurveTo(x - s * 0.2, y, x - s * 0.4, y + s * (1.5 + flap)); g.quadraticCurveTo(x, y + s * (1.2 + flap), x + s * 0.9, y); g.fill();
                    g.lineWidth = 2; g.strokeStyle = g.fillStyle; g.beginPath(); g.moveTo(x - s * 0.3, y); g.lineTo(x - s * 1.6, y + Math.sin(t * 3) * 6); g.stroke();
                    if (manta.x > W + 160) { manta = null; nextManta = U.rand(14, 24); }
                }
                // the broken arch and the temple, the temple's crystal pulsing with the city's heart
                g.drawImage(arch, W * 0.74 - px * 12, H * 0.86 - arch.height - py * 6);
                const tx = temple.at.x - temple.width / 2 - px * 14, ty = temple.at.y - temple.height - py * 7;
                g.drawImage(temple, tx, ty);
                const cx = tx + crystalAt.x, cy = ty + crystalAt.y - 14, pulse = 0.65 + 0.35 * Math.sin(t * 1.4) + 0.1 * Math.sin(t * 4.3);
                g.save(); g.globalCompositeOperation = "lighter";
                for (let i = 0; i < 8; i++) {
                    const a = t * 0.2 + i * TAU / 8, len = Math.min(W, H) * (0.18 + 0.05 * Math.sin(t + i));
                    g.strokeStyle = `rgba(${night ? "127,232,255" : "255,255,240"},${(0.08 * pulse).toFixed(3)})`; g.lineWidth = 6;
                    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len); g.stroke();
                }
                g.restore();
                Worlds.glow(g, cx, cy, 70 * pulse, C.crystal, night ? 0.75 : 0.5);
                g.save(); g.translate(cx, cy); g.rotate(Math.sin(t * 0.5) * 0.1);
                const cs = Math.min(W, H) * 0.018;
                g.fillStyle = C.crystal; g.beginPath(); g.moveTo(0, -cs * 2); g.lineTo(cs, 0); g.lineTo(0, cs * 1.4); g.lineTo(-cs, 0); g.closePath(); g.fill();
                g.fillStyle = "rgba(255,255,255,.7)"; g.beginPath(); g.moveTo(0, -cs * 2); g.lineTo(cs, 0); g.lineTo(0, 0); g.closePath(); g.fill();
                g.restore();
                Worlds.glint(g, cx, cy - cs, cs * 1.6, pulse, "#ffffff");
                // schools of fish sweeping across, each fish wiggling in its place
                for (const sc of schools) {
                    sc.x += sc.dir * sc.sp * dt;
                    if (sc.x > W + 200) sc.x = -200; if (sc.x < -200) sc.x = W + 200;
                    const yy = sc.y + Math.sin(t * 0.5 + sc.ph) * 30 - py * 8;
                    for (const f of sc.fish) fishAt(g, sc.x + f.dx + Math.sin(t * 1.5 + f.ph) * 6 - px * 14, yy + f.dy + Math.cos(t * 1.2 + f.ph) * 5, 5, sc.dir, t, f.ph);
                }
                // jellyfish drifting up and sinking, glowing at night
                for (const j of jellies) {
                    const pulse = Math.max(0, Math.sin(t * 1.8 + j.ph)); j.y -= pulse * 22 * dt - 4 * dt;
                    if (j.y < -60) j.y = H + 40;
                    const x = j.x + Math.sin(t * 0.3 + j.ph) * 20 - px * 18, s = j.s * (1 + pulse * 0.12);
                    if (night) Worlds.glow(g, x, j.y, s * 4, j.c, 0.45);
                    g.fillStyle = night ? j.c : "rgba(255,200,255,.7)"; g.globalAlpha = 0.75;
                    g.beginPath(); g.ellipse(x, j.y, s, s * (0.8 - pulse * 0.2), 0, Math.PI, TAU); g.fill();
                    g.strokeStyle = g.fillStyle; g.lineWidth = 1.2;
                    for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(x + k * s * 0.35, j.y); g.quadraticCurveTo(x + k * s * 0.35 + Math.sin(t * 2 + k) * 5, j.y + s * 1.5, x + k * s * 0.3, j.y + s * 2.6); g.stroke(); }
                    g.globalAlpha = 1;
                }
                // kelp behind the reef, the reef, kelp in front
                const sway = k => { g.save(); g.lineCap = "round"; for (const kp of kelp) if (kp.front === k) {
                    const x = kp.x - px * (k ? 26 : 18), base = H + 10;
                    g.strokeStyle = C.kelp[kp.c]; g.lineWidth = kp.w;
                    g.beginPath(); g.moveTo(x, base);
                    for (let s = 1; s <= 8; s++) { const u = s / 8; g.lineTo(x + Math.sin(t * 0.8 + kp.ph + u * 3) * 18 * u, base - kp.h * u); }
                    g.stroke();
                    g.fillStyle = C.kelp[1 - kp.c];
                    for (let s = 2; s <= 7; s += 2) { const u = s / 8, lx = x + Math.sin(t * 0.8 + kp.ph + u * 3) * 18 * u, ly = base - kp.h * u; g.beginPath(); g.ellipse(lx + 7, ly, 9, 3.5, -0.5 + Math.sin(t + s) * 0.2, 0, TAU); g.fill(); }
                } g.restore(); };
                sway(false);
                g.drawImage(reef, -px * 20, H - reef.height - py * 6);
                sway(true);
                // bubbles rising, marine snow sinking
                for (const b of bubbles) {
                    b.y -= b.v * dt; if (b.y < -10) { b.y = H + 10; b.x = Math.random() * W; }
                    const x = b.x + Math.sin(t * 2 + b.ph) * 4 - px * 16;
                    g.strokeStyle = night ? "rgba(190,240,255,.55)" : "rgba(255,255,255,.75)"; g.lineWidth = 1;
                    g.beginPath(); g.arc(x, b.y, b.r, 0, TAU); g.stroke();
                    g.fillStyle = "rgba(255,255,255,.6)"; g.fillRect(x - b.r * 0.4, b.y - b.r * 0.5, 1.2, 1.2);
                }
                g.fillStyle = night ? "rgba(200,230,255,.45)" : "rgba(255,255,255,.55)";
                for (const s of snow) {
                    s.y += s.v * dt; if (s.y > H + 5) { s.y = -5; s.x = Math.random() * W; }
                    g.fillRect(s.x + Math.sin(t * 0.6 + s.ph) * 8 - px * 10, s.y, s.s, s.s);
                }
            }
        };
    };
})();
