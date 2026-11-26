// The four secret worlds found off the campaign's road (campaign.js SECRETS), each with its own scene in light and
// dark. Each brings its parent world's companion, sounds and title card along (the parent's companion goes with you),
// and has its own short win.
//   The Great Hollow (off Acorn Woods): inside a giant hollow oak, glowing fungi, hanging roots, a hoard of acorns
//   Atlantis (off the Coral Reef): a drowned city that still keeps its lights on, kelp, caustics, a sea king's statue
//   The Sunken Dunes (off the Desert): dunes swallowing ruins, sand streaming off the crests, something long beneath
//   The Lava Cave (off Volcano Island): a cavern of stalactites over a river of lava, lava falls, embers, obsidian
(() => {
    const TAU = Math.PI * 2;
    const lerp = (a, b, k) => a + (b - a) * k;
    const grad = (g, y0, y1, stops) => { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; };
    const radial = (g, x, y, r, stops) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; };
    const lite = () => U.motion() === "lite";

    // a short win for a secret world: a burst of the world's own shapes from the board, a ring, and a shimmer
    // The board: a mark in each typed square and a trim along each finished word (Worlds.decoBoard), plus a little
    // burst as you type and as a word finishes. line() and wavy() are paths along a word at an offset from its top or left.
    const line = (cells, across, off, pad = 0.06) => { const [r0, c0] = cells[0], n = cells.length; return across ? `M${c0 + pad} ${r0 + off}H${c0 + n - pad}` : `M${c0 + off} ${r0 + pad}V${r0 + n - pad}`; };
    const wavy = (cells, across, off, amp, waves) => {
        const [r0, c0] = cells[0], n = cells.length, steps = n * 8, pts = [];
        for (let i = 0; i <= steps; i++) { const u = 0.08 + i / steps * (n - 0.16), w = Math.sin(i / steps * waves * TAU) * amp; pts.push(across ? [c0 + u, r0 + off + w] : [c0 + off + w, r0 + u]); }
        return "M" + pts.map(([x, y]) => x.toFixed(3) + " " + y.toFixed(3)).join("L");
    };
    function deco(id, { marks, word, typeColors, typeShape = "circle", doneColors, doneShape = "star", rise = false }) {
        return Worlds.decoBoard({
            id,
            mark: r => marks[Math.floor(r(0) * marks.length)],
            word,
            type(cell) {
                const p = U.center(cell);
                FX.burst({ x: p.x, y: p.y + p.h * 0.25, n: 7, colors: typeColors, shape: typeShape, angle: -Math.PI / 2, spread: 1.4, speed: [40, 120], gravity: rise ? -80 : 300, drag: 1.5, life: [0.35, 0.6], size: [1.5, 3] });
            },
            wordDone(entry, cells) {
                cells.forEach(([r, c], i) => setTimeout(() => {
                    const cell = Game.cellEl(r, c);
                    if (!cell) return;
                    const p = U.center(cell);
                    FX.burst({ x: p.x, y: p.y, n: 5, colors: doneColors, shape: doneShape, speed: [40, 120], gravity: rise ? -60 : 100, life: [0.5, 0.8], size: [3, 5], spin: 4 });
                }, i * 60));
            }
        });
    }

    function winOf(colors, shape) {
        return async (c, { boardEl }) => {
            if (!boardEl) return;
            const r = boardEl.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
            FX.ring({ x, y, color: colors[0], r0: 20, r1: Math.max(r.width, r.height), dur: 0.9, width: 12 });
            FX.burst({ x, y, n: 70, colors, shape, speed: [200, 700], gravity: 260, drag: 1, life: [1.4, 2.4], size: [6, 12], spin: 4 });
            await c.wait(500);
            FX.burst({ x, y: r.top, n: 40, colors, shape: "star", speed: [120, 420], gravity: 120, life: [1, 1.8], size: [5, 9] });
            await c.wait(1200);
        };
    }
    function register(o) {
        const P = Worlds.byId[o.parent] || {};
        Worlds.register({
            modes: ["dark", "light"], secret: true, board: {},
            titleCard: P.titleCard, sounds: P.sounds, transition: P.transition, mascot: P.mascot, lines: P.lines, introFlourish: P.introFlourish,
            ...o
        });
    }

    // ------------------------------------------------------------------------------------------------------------
    // The Great Hollow
    // ------------------------------------------------------------------------------------------------------------
    function hollowScene(W, H, opts) {
        const night = opts.theme === "dark", preview = !!opts.preview;
        let sky, walls, rings, fungi, roots, motes, acorns, pile, drops = [], nextDrop = preview ? 999 : 3;
        const C = night
            ? { top: "#120a06", mid: "#2b170c", low: "#4a2a14", wall: "#2a170c", wall2: "#3a2212", grain: "rgba(0,0,0,.35)", glow: "#ffb347", fungus: ["#7dffd4", "#9ff0ff", "#ffd36b"], hole: ["#0b1430", "#1d2a5a"], dust: "#ffcf7a" }
            : { top: "#5a3a1e", mid: "#8a5a2c", low: "#b8813f", wall: "#6b4422", wall2: "#7e5229", grain: "rgba(40,20,5,.28)", glow: "#ffe3a0", fungus: ["#ffefa8", "#ffd27a", "#fff6d8"], hole: ["#8fc6ee", "#cfe9f8"], dust: "#fff1c4" };
        function setup() {
            const R = U.rng(31);
            sky = null;
            // the bark walls: the inside of the trunk, curving in at the sides
            walls = [-1, 1].map(side => ({ side, w: W * (0.16 + R() * 0.04) }));
            rings = Array.from({ length: 7 }, (_, i) => ({ r: Math.max(W, H) * (0.25 + i * 0.12), a: R() * TAU }));
            fungi = Array.from({ length: preview ? 6 : 14 }, () => ({ x: R() < 0.5 ? R() * W * 0.18 : W - R() * W * 0.18, y: H * (0.25 + R() * 0.6), s: 8 + R() * 16, c: Math.floor(R() * 3), p: R() * TAU, flip: R() < 0.5 }));
            roots = Array.from({ length: 9 }, () => ({ x: W * (0.15 + R() * 0.7), len: H * (0.08 + R() * 0.22), w: 3 + R() * 6, p: R() * TAU }));
            motes = Array.from({ length: preview ? 20 : lite() ? 40 : 80 }, () => ({ x: R() * W, y: R() * H, v: 6 + R() * 16, s: 1 + R() * 2.4, p: R() * TAU }));
            pile = Array.from({ length: 34 }, (_, i) => ({ x: W * 0.5 + (R() - 0.5) * W * 0.5 * (1 - i / 60), y: H - 10 - R() * 50 * (1 - Math.abs(R() - 0.5)), s: 10 + R() * 9, r: R() * TAU }));
            acorns = pile;
        }
        function acorn(g, x, y, s, rot) {
            g.save(); g.translate(x, y); g.rotate(rot);
            g.fillStyle = night ? "#7a4a24" : "#b9773e"; g.beginPath(); g.ellipse(0, s * 0.15, s * 0.55, s * 0.65, 0, 0, TAU); g.fill();
            g.fillStyle = night ? "#3e2614" : "#6e4429"; g.beginPath(); g.ellipse(0, -s * 0.3, s * 0.68, s * 0.36, 0, Math.PI, TAU); g.fill();
            g.fillRect(-s * 0.06, -s * 0.85, s * 0.12, s * 0.3);
            g.fillStyle = "rgba(255,255,255,.18)"; g.beginPath(); g.ellipse(-s * 0.2, s * 0.05, s * 0.12, s * 0.25, -0.3, 0, TAU); g.fill();
            g.restore();
        }
        setup();
        return {
            resize(w, h) { W = w; H = h; setup(); },
            draw(g, t, dt, inp) {
                if (!sky) sky = grad(g, 0, H, [[0, C.top], [0.55, C.mid], [1, C.low]]);
                g.fillStyle = sky; g.fillRect(0, 0, W, H);
                // a knothole high up: the sky outside, and light pouring in
                const hx = W * 0.62 + (inp.px || 0) * 8, hy = H * 0.12, hr = Math.min(W, H) * 0.09;
                g.fillStyle = grad(g, hy - hr, hy + hr, [[0, C.hole[0]], [1, C.hole[1]]]);
                g.beginPath(); g.ellipse(hx, hy, hr * 1.25, hr, -0.2, 0, TAU); g.fill();
                if (night) { g.fillStyle = "#fff6d8"; g.beginPath(); g.arc(hx + hr * 0.4, hy - hr * 0.2, hr * 0.28, 0, TAU); g.fill(); }
                g.save(); g.globalCompositeOperation = "lighter";
                g.fillStyle = grad(g, hy, H, [[0, night ? "rgba(160,190,255,.16)" : "rgba(255,240,190,.32)"], [1, "rgba(255,240,190,0)"]]);
                g.beginPath(); g.moveTo(hx - hr, hy); g.lineTo(hx + hr * 0.9, hy); g.lineTo(W * 0.5 + 220, H); g.lineTo(W * 0.5 - 260, H); g.closePath(); g.fill();
                g.restore();
                // growth rings on the far wall
                g.strokeStyle = C.grain; g.lineWidth = 2;
                for (const r of rings) { g.beginPath(); g.ellipse(W * 0.5, H * 1.05, r.r, r.r * 0.55, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); }
                // the walls
                for (const w of walls) {
                    const x0 = w.side < 0 ? 0 : W;
                    g.fillStyle = grad(g, 0, H, [[0, C.wall], [1, C.wall2]]);
                    g.beginPath(); g.moveTo(x0, 0); g.quadraticCurveTo(x0 + w.side * -w.w * 1.6, H * 0.5, x0, H); g.closePath(); g.fill();
                    g.strokeStyle = C.grain; g.lineWidth = 2;
                    for (let k = 1; k < 7; k++) { g.beginPath(); g.moveTo(x0 - w.side * k * 6, 0); g.quadraticCurveTo(x0 - w.side * (w.w * 1.5 - k * 10), H * 0.5, x0 - w.side * k * 6, H); g.stroke(); }
                }
                // roots hanging from the top, swaying
                g.strokeStyle = night ? "#1c0f07" : "#4a2c14"; g.lineCap = "round";
                for (const r of roots) {
                    const sw = Math.sin(t * 0.6 + r.p) * 8;
                    g.lineWidth = r.w; g.beginPath(); g.moveTo(r.x, 0); g.quadraticCurveTo(r.x + sw, r.len * 0.6, r.x + sw * 1.6, r.len); g.stroke();
                }
                // glowing fungi on the walls
                for (const f of fungi) {
                    const col = C.fungus[f.c], k = 0.65 + Math.sin(t * 1.4 + f.p) * 0.35, d = f.flip ? -1 : 1;
                    Worlds.glow(g, f.x, f.y, f.s * 3.2, col, (night ? 0.55 : 0.25) * k);
                    g.fillStyle = col; g.beginPath(); g.ellipse(f.x, f.y, f.s, f.s * 0.42, d * 0.25, Math.PI, TAU); g.fill();
                    g.fillStyle = night ? "rgba(0,0,0,.25)" : "rgba(80,40,10,.25)"; g.fillRect(f.x - f.s * 0.12, f.y, f.s * 0.24, f.s * 0.5);
                }
                // the hoard: a heap of acorns on the floor, and one now and then falling into it
                g.fillStyle = radial(g, W * 0.5, H + 30, W * 0.42, [[0, night ? "rgba(255,170,70,.28)" : "rgba(255,220,140,.35)"], [1, "rgba(0,0,0,0)"]]);
                g.fillRect(0, H * 0.6, W, H * 0.4);
                for (const a of acorns) acorn(g, a.x, a.y, a.s, a.r);
                nextDrop -= dt;
                if (nextDrop <= 0) { nextDrop = U.rand(2.5, 6); drops.push({ x: W * (0.3 + Math.random() * 0.4), y: -20, v: 0, r: Math.random() * TAU, vr: U.rand(-3, 3), bounce: 0 }); }
                drops = drops.filter(d => {
                    d.v += 900 * dt; d.y += d.v * dt; d.r += d.vr * dt;
                    if (d.y > H - 40 && d.bounce < 2) { d.y = H - 40; d.v *= -0.35; d.bounce++; }
                    acorn(g, d.x, d.y, 15, d.r);
                    return d.y < H + 40;
                });
                // golden dust in the light
                for (const m of motes) {
                    m.y -= m.v * dt * 0.3; m.x += Math.sin(t * 0.5 + m.p) * 6 * dt;
                    if (m.y < -5) { m.y = H + 5; m.x = Math.random() * W; }
                    const a = 0.35 + Math.sin(t * 2 + m.p) * 0.25;
                    g.fillStyle = C.dust; g.globalAlpha = Math.max(0, a); g.beginPath(); g.arc(m.x, m.y, m.s, 0, TAU); g.fill();
                }
                g.globalAlpha = 1;
                // warm darkness at the edges
                g.fillStyle = radial(g, W * 0.5, H * 0.55, Math.max(W, H) * 0.75, [[0.55, "rgba(0,0,0,0)"], [1, night ? "rgba(8,3,0,.65)" : "rgba(40,20,5,.35)"]]);
                g.fillRect(0, 0, W, H);
            }
        };
    }
    // The board: an acorn, a toadstool or an oak leaf in each typed square; a root runs along every finished word
    const hollowBoard = deco("hw", {
        marks: [
            `<ellipse cy=".012" rx=".026" ry=".032" class="hw-nut"/><path d="M-.034 -.006Q0 -.05 .034 -.006Z" class="hw-cap"/><path d="M0 -.03V-.045" class="hw-line"/>`,
            `<path d="M-.006 .04V.005H.006V.04Z" class="hw-stem"/><path d="M-.04 .008Q0 -.05 .04 .008Z" class="hw-shroom"/><circle cx="-.012" cy="-.01" r=".006" class="hw-spot"/><circle cx=".014" cy="-.004" r=".005" class="hw-spot"/>`,
            `<path d="M0 -.045Q.035 -.02 .02 .02Q0 .045 0 .045Q0 .045 -.02 .02Q-.035 -.02 0 -.045Z" class="hw-leaf"/><path d="M0 -.035V.05" class="hw-line"/>`
        ],
        word(entry, cells, rnd, g, across) {
            U.svg("path", { d: wavy(cells, across, 0.92, 0.012, cells.length * 0.7), class: "hw-root", pathLength: "1" }, g);
            const [r0, c0] = cells[0];
            for (let i = 0; i < cells.length; i++) {
                if (rnd(i) < 0.45) continue;
                const u = i + 0.5, x = across ? c0 + u : c0 + 0.92, y = across ? r0 + 0.92 : r0 + u;
                U.svg("path", { d: across ? `M${x} ${y}q.03 .03 .06 .02` : `M${x} ${y}q.03 .03 .02 .06`, class: "hw-root thin", pathLength: "1" }, g);
                U.svg("ellipse", { cx: (across ? x + 0.06 : x + 0.02).toFixed(3), cy: (across ? y + 0.02 : y + 0.06).toFixed(3), rx: ".018", ry: ".01", class: "hw-sprout" }, g);
            }
        },
        typeColors: ["#8a5a2b", "#c8681c", "#e3a35a"],
        doneColors: ["#ffd36b", "#7dffd4", "#e3a35a"]
    });
    register({
        id: "hollow", name: "The Great Hollow", icon: "🌰", tagline: "Inside the Oldest Oak.", parent: "squirrel",
        scene: hollowScene, board: hollowBoard, celebrate: winOf(["#ffb347", "#b9773e", "#7dffd4", "#ffd36b"], "acorn")
    });

    // ------------------------------------------------------------------------------------------------------------
    // Atlantis
    // ------------------------------------------------------------------------------------------------------------
    function atlantisScene(W, H, opts) {
        const night = opts.theme === "dark", preview = !!opts.preview;
        let sea, city, kelp, bubbles, fish, statue;
        const C = night
            ? { top: "#010a1c", mid: "#04264a", low: "#062f4f", far: "#0b3a5e", near: "#072c48", window: "#ffd98a", kelp: "#0f5a4a", light: "rgba(120,200,255,.10)" }
            : { top: "#5fd0e8", mid: "#1d8fbf", low: "#0b5a8a", far: "#3a9cc4", near: "#1f6f99", window: "#fff3c4", kelp: "#2f9e6b", light: "rgba(255,255,255,.18)" };
        function setup() {
            const R = U.rng(47);
            sea = null;
            city = [];
            for (let layer = 0; layer < 2; layer++) {
                let x = -40;
                while (x < W + 60) {
                    const w = 50 + R() * 90, h = H * (layer ? 0.18 : 0.28) + R() * H * 0.16, kind = R();
                    city.push({ layer, x, w, h, kind, win: Array.from({ length: 6 }, () => ({ x: R(), y: R(), on: R() < 0.6, p: R() * TAU })) });
                    x += w + (layer ? 30 : 12) + R() * 30;
                }
            }
            kelp = Array.from({ length: preview ? 6 : 16 }, () => ({ x: R() * W, h: H * (0.2 + R() * 0.35), p: R() * TAU, w: 4 + R() * 5 }));
            bubbles = Array.from({ length: preview ? 12 : lite() ? 24 : 50 }, () => ({ x: R() * W, y: R() * H, r: 1.5 + R() * 4, v: 20 + R() * 40, p: R() * TAU }));
            fish = Array.from({ length: preview ? 4 : 10 }, () => ({ x: R() * W, y: H * (0.2 + R() * 0.5), v: (R() < 0.5 ? -1 : 1) * (20 + R() * 30), s: 6 + R() * 6, p: R() * TAU }));
            statue = { x: W * 0.72, h: H * 0.5 };
        }
        function building(g, b, col) {
            const base = H - (b.layer ? H * 0.16 : 0), top = base - b.h;
            g.fillStyle = col;
            if (b.kind < 0.35) {                                // a temple: columns under a pediment
                g.beginPath(); g.moveTo(b.x - 6, top + 22); g.lineTo(b.x + b.w / 2, top); g.lineTo(b.x + b.w + 6, top + 22); g.fill();
                g.fillRect(b.x - 4, top + 22, b.w + 8, 8);
                for (let c = 0; c < 4; c++) g.fillRect(b.x + 4 + c * (b.w - 14) / 3, top + 30, 6, b.h - 30);
                g.fillRect(b.x - 6, base - 8, b.w + 12, 8);
            } else if (b.kind < 0.6) {                          // a dome
                g.fillRect(b.x, top + b.w * 0.4, b.w, b.h - b.w * 0.4);
                g.beginPath(); g.arc(b.x + b.w / 2, top + b.w * 0.42, b.w / 2, Math.PI, TAU); g.fill();
            } else {                                            // a tower, a little broken
                g.beginPath(); g.moveTo(b.x, base); g.lineTo(b.x, top + 10); g.lineTo(b.x + b.w * 0.3, top); g.lineTo(b.x + b.w * 0.55, top + 14); g.lineTo(b.x + b.w, top + 4); g.lineTo(b.x + b.w, base); g.fill();
            }
        }
        setup();
        return {
            resize(w, h) { W = w; H = h; setup(); },
            draw(g, t, dt, inp) {
                if (!sea) sea = grad(g, 0, H, [[0, C.top], [0.5, C.mid], [1, C.low]]);
                g.fillStyle = sea; g.fillRect(0, 0, W, H);
                // light from the surface: slanting shafts that sway
                g.save(); g.globalCompositeOperation = "lighter";
                for (let i = 0; i < 5; i++) {
                    const x = W * (0.1 + i * 0.22) + Math.sin(t * 0.25 + i) * 40;
                    g.fillStyle = grad(g, 0, H * 0.9, [[0, C.light], [1, "rgba(255,255,255,0)"]]);
                    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 70, 0); g.lineTo(x + 220, H * 0.9); g.lineTo(x + 90, H * 0.9); g.closePath(); g.fill();
                }
                g.restore();
                // the sea king's statue, far off, trident raised
                const sx = statue.x + (inp.px || 0) * -6, sb = H - H * 0.14;
                g.fillStyle = night ? "rgba(20,70,110,.55)" : "rgba(30,110,150,.45)";
                g.beginPath(); g.moveTo(sx - 40, sb); g.lineTo(sx - 26, sb - statue.h * 0.55); g.quadraticCurveTo(sx, sb - statue.h * 0.68, sx + 26, sb - statue.h * 0.55); g.lineTo(sx + 40, sb); g.fill();
                g.beginPath(); g.arc(sx, sb - statue.h * 0.72, 18, 0, TAU); g.fill();
                g.fillRect(sx + 30, sb - statue.h, 6, statue.h * 0.62);
                for (let k = -1; k <= 1; k++) g.fillRect(sx + 33 + k * 12 - 3, sb - statue.h - 22 + Math.abs(k) * 6, 6, 26);
                g.fillRect(sx + 18, sb - statue.h, 36, 6);
                // the city: the far row, then the near one, with windows that still glow
                for (const b of city) {
                    building(g, b, b.layer ? C.far : C.near);
                    const base = H - (b.layer ? H * 0.16 : 0);
                    for (const w of b.win) {
                        if (!w.on) continue;
                        const x = b.x + 8 + w.x * (b.w - 20), y = base - 12 - w.y * (b.h * 0.6), a = 0.6 + Math.sin(t * 1.5 + w.p) * 0.3;
                        g.fillStyle = C.window; g.globalAlpha = a * (b.layer ? 0.6 : 1); g.fillRect(x, y, 5, 7); g.globalAlpha = 1;
                        if (night) Worlds.glow(g, x + 2.5, y + 3.5, 14, C.window, 0.25 * a);
                    }
                }
                // kelp
                g.strokeStyle = C.kelp; g.lineCap = "round";
                for (const k of kelp) {
                    g.lineWidth = k.w; g.beginPath(); g.moveTo(k.x, H);
                    for (let s = 1; s <= 6; s++) { const y = H - k.h * s / 6; g.lineTo(k.x + Math.sin(t * 1.1 + k.p + s * 0.7) * 10 * s / 6, y); }
                    g.stroke();
                }
                // fish
                for (const f of fish) {
                    f.x += f.v * dt; if (f.x < -40) f.x = W + 40; if (f.x > W + 40) f.x = -40;
                    const y = f.y + Math.sin(t + f.p) * 6, d = Math.sign(f.v);
                    g.fillStyle = night ? "rgba(140,220,255,.7)" : "rgba(255,200,90,.9)";
                    g.beginPath(); g.ellipse(f.x, y, f.s, f.s * 0.45, 0, 0, TAU); g.fill();
                    g.beginPath(); g.moveTo(f.x - d * f.s, y); g.lineTo(f.x - d * f.s * 1.6, y - f.s * 0.45); g.lineTo(f.x - d * f.s * 1.6, y + f.s * 0.45); g.fill();
                }
                // bubbles rising
                g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 1.2;
                for (const b of bubbles) {
                    b.y -= b.v * dt; b.x += Math.sin(t * 2 + b.p) * 10 * dt;
                    if (b.y < -10) { b.y = H + 10; b.x = Math.random() * W; }
                    g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.stroke();
                }
                g.fillStyle = radial(g, W / 2, H * 0.45, Math.max(W, H) * 0.8, [[0.5, "rgba(0,0,0,0)"], [1, night ? "rgba(0,5,20,.6)" : "rgba(0,40,80,.25)"]]);
                g.fillRect(0, 0, W, H);
            }
        };
    }
    // The board: a pearl, a coral sprig or a little trident in each typed square; a golden wave band along finished words
    const atlantisBoard = deco("at", {
        marks: [
            `<circle r=".026" class="at-pearl"/><circle cx="-.009" cy="-.009" r=".007" class="at-shine"/>`,
            `<path d="M0 .045V0M0 .01L-.025 -.02M-.025 -.02V-.04M0 0L.022 -.028M.022 -.028V-.045M-.012 -.01L-.03 .002" class="at-coral"/>`,
            `<path d="M0 .045V-.03M-.024 -.012V-.04M.024 -.012V-.04M-.024 -.012H.024M0 -.03L0 -.048" class="at-tri"/>`
        ],
        word(entry, cells, rnd, g, across) {
            U.svg("path", { d: wavy(cells, across, 0.915, 0.014, cells.length * 1.5), class: "at-band", pathLength: "1" }, g);
            U.svg("path", { d: line(cells, across, 0.955), class: "at-band thin", pathLength: "1" }, g);
            const [r0, c0] = cells[0];
            for (let i = 0; i < cells.length; i++) {
                const u = i + 0.5;
                U.svg("circle", { cx: (across ? c0 + u : c0 + 0.955).toFixed(3), cy: (across ? r0 + 0.955 : r0 + u).toFixed(3), r: ".014", class: "at-bead" }, g);
            }
        },
        typeColors: ["#bfe8ff", "#ffffff", "#7fd4ff"], rise: true,
        doneColors: ["#ffd98a", "#ffffff", "#5fd0e8"]
    });
    register({
        id: "atlantis", name: "Atlantis", icon: "🔱", tagline: "The City Below the Reef.", parent: "ocean",
        scene: atlantisScene, board: atlantisBoard, celebrate: winOf(["#5fd0e8", "#ffd98a", "#ffffff", "#2a8fd6"], "bubble")
    });

    // ------------------------------------------------------------------------------------------------------------
    // The Sunken Dunes
    // ------------------------------------------------------------------------------------------------------------
    function dunesScene(W, H, opts) {
        const night = opts.theme === "dark", preview = !!opts.preview;
        let sky, dunes, ruins, grains, worm = null, nextWorm = preview ? 999 : 6;
        const C = night
            ? { top: "#120d2a", mid: "#3a2346", low: "#8a4a3a", sun: "#ffe0b0", dune: ["#5a3a2e", "#6e4632", "#82553a", "#5b3b2a"], ruin: "#3a2620", sand: "#d9a56b", star: true }
            : { top: "#3d8fd0", mid: "#9fd0ea", low: "#f6d79a", sun: "#fff6d0", dune: ["#e0a95f", "#d39250", "#c47f3e", "#e8b66d"], ruin: "#9c6a3a", sand: "#f6d48f", star: false };
        function setup() {
            const R = U.rng(59);
            sky = null;
            dunes = [0.55, 0.65, 0.75, 0.86].map((y, i) => ({ y: H * y, amp: H * (0.05 + R() * 0.04), f: 1.2 + R() * 1.4, p: R() * TAU, c: C.dune[i] }));
            ruins = [{ x: W * 0.2, k: "pillar", h: H * 0.2 }, { x: W * 0.27, k: "pillar", h: H * 0.13 }, { x: W * 0.78, k: "head", h: H * 0.16 }, { x: W * 0.55, k: "arch", h: H * 0.12 }];
            grains = Array.from({ length: preview ? 20 : lite() ? 50 : 110 }, () => ({ x: R() * W, y: H * (0.5 + R() * 0.45), v: 60 + R() * 120, s: 0.8 + R() * 1.6, l: R() }));
        }
        const duneY = (d, x, t) => d.y - Math.sin(x / W * d.f * TAU + d.p + t * 0.02) * d.amp - Math.sin(x / W * 5.1 + d.p) * d.amp * 0.25;
        function ruin(g, r, y) {
            g.fillStyle = C.ruin;
            if (r.k === "pillar") { g.fillRect(r.x - 12, y - r.h, 24, r.h); g.fillRect(r.x - 18, y - r.h - 10, 36, 10); g.beginPath(); g.moveTo(r.x - 12, y - r.h - 10); g.lineTo(r.x + 5, y - r.h - 22); g.lineTo(r.x + 12, y - r.h - 10); g.fill(); }
            else if (r.k === "arch") { g.beginPath(); g.moveTo(r.x - 50, y); g.lineTo(r.x - 50, y - r.h * 0.6); g.arc(r.x, y - r.h * 0.6, 50, Math.PI, TAU); g.lineTo(r.x + 50, y); g.lineTo(r.x + 32, y); g.lineTo(r.x + 32, y - r.h * 0.6); g.arc(r.x, y - r.h * 0.6, 32, 0, Math.PI, true); g.lineTo(r.x - 32, y); g.fill(); }
            else {                                               // a giant stone head, half buried
                g.beginPath(); g.moveTo(r.x - 60, y); g.quadraticCurveTo(r.x - 62, y - r.h * 1.2, r.x, y - r.h * 1.25); g.quadraticCurveTo(r.x + 62, y - r.h * 1.2, r.x + 60, y); g.fill();
                g.fillStyle = "rgba(0,0,0,.3)"; g.fillRect(r.x - 32, y - r.h * 0.75, 20, 7); g.fillRect(r.x + 12, y - r.h * 0.75, 20, 7); g.fillRect(r.x - 5, y - r.h * 0.6, 10, 22);
            }
        }
        setup();
        return {
            resize(w, h) { W = w; H = h; setup(); },
            draw(g, t, dt, inp) {
                if (!sky) sky = grad(g, 0, H * 0.7, [[0, C.top], [0.6, C.mid], [1, C.low]]);
                g.fillStyle = sky; g.fillRect(0, 0, W, H);
                if (C.star) for (let i = 0; i < 60; i++) { const x = (i * 97.3) % W, y = (i * 53.7) % (H * 0.45); g.fillStyle = "rgba(255,255,255,.7)"; g.fillRect(x, y, 1.5, 1.5); Worlds.twinkle(g, x, y, 1, (Math.sin(t * 1.3 + i) + 1) / 2); }
                const sx = W * 0.3, sy = H * 0.3;
                Worlds.glow(g, sx, sy, Math.min(W, H) * 0.25, C.sun, night ? 0.25 : 0.55);
                g.fillStyle = C.sun; g.beginPath(); g.arc(sx, sy, Math.min(W, H) * 0.05, 0, TAU); g.fill();
                // dunes back to front; the ruins sink into the second row
                dunes.forEach((d, i) => {
                    const off = (inp.px || 0) * (i + 1) * 6;
                    g.fillStyle = d.c;
                    g.beginPath(); g.moveTo(0, H);
                    for (let x = 0; x <= W; x += 16) g.lineTo(x, duneY(d, x + off, t));
                    g.lineTo(W, H); g.closePath(); g.fill();
                    // a lit edge along each crest
                    g.strokeStyle = night ? "rgba(255,190,140,.18)" : "rgba(255,245,210,.5)"; g.lineWidth = 2;
                    g.beginPath(); for (let x = 0; x <= W; x += 16) { const y = duneY(d, x + off, t); x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
                    if (i === 1) for (const r of ruins) ruin(g, r, duneY(d, r.x + off, t) + 6);
                    // something long moves under the sand: a ridge rises and runs along the third row
                    if (i === 2 && worm) {
                        const k = worm.t / worm.d, x = lerp(worm.from, worm.to, k), y = duneY(d, x + off, t);
                        for (let s = 0; s < 14; s++) {
                            const xx = x - Math.sign(worm.to - worm.from) * s * 18, hump = Math.sin(Math.min(1, k * 3) * Math.PI * 0.5) * Math.sin(s / 14 * Math.PI) * 22;
                            g.fillStyle = C.dune[0]; g.beginPath(); g.ellipse(xx, y - hump * 0.5, 16, hump * 0.6 + 2, 0, 0, TAU); g.fill();
                        }
                    }
                });
                nextWorm -= dt;
                if (!worm && nextWorm <= 0) { const l = Math.random() < 0.5; worm = { from: l ? -80 : W + 80, to: l ? W + 80 : -80, t: 0, d: U.rand(7, 10) }; }
                if (worm) { worm.t += dt; if (worm.t >= worm.d) { worm = null; nextWorm = U.rand(10, 18); } }
                // sand streaming off the crests in the wind
                g.fillStyle = C.sand;
                for (const p of grains) {
                    p.x += p.v * dt; p.y += Math.sin(t * 3 + p.l * 9) * 8 * dt;
                    if (p.x > W + 5) { p.x = -5; p.y = H * (0.5 + Math.random() * 0.45); }
                    g.globalAlpha = 0.25 + p.l * 0.5; g.fillRect(p.x, p.y, p.s * 3, p.s);
                }
                g.globalAlpha = 1;
            }
        };
    }
    // The board: a worm's track, a buried ring or a scatter of grains in each typed square; sand ripples along finished words
    const dunesBoard = deco("dn", {
        marks: [
            `<path d="M-.045 .02Q-.03 -.02 -.012 .01T.022 0T.048 -.03" class="dn-track"/>`,
            `<circle r=".022" class="dn-ring"/><circle r=".008" class="dn-grain"/>`,
            `<circle cx="-.02" cy=".01" r=".007" class="dn-grain"/><circle cx=".012" cy="-.015" r=".006" class="dn-grain"/><circle cx=".022" cy=".018" r=".008" class="dn-grain"/><circle cx="-.004" cy="-.03" r=".005" class="dn-grain"/>`
        ],
        word(entry, cells, rnd, g, across) {
            U.svg("path", { d: wavy(cells, across, 0.895, 0.01, cells.length * 2), class: "dn-ripple", pathLength: "1" }, g);
            U.svg("path", { d: wavy(cells, across, 0.94, 0.01, cells.length * 2), class: "dn-ripple thin", pathLength: "1" }, g);
        },
        typeColors: ["#e0b872", "#c9974f", "#f2d39a"],
        doneColors: ["#f6d48f", "#ffffff", "#e0a95f"]
    });
    register({
        id: "dunes", name: "The Sunken Dunes", icon: "🪱", tagline: "Something Swims Beneath the Sand.", parent: "desert",
        scene: dunesScene, board: dunesBoard, celebrate: winOf(["#f6d48f", "#e0a95f", "#ffffff", "#c47f3e"], "circle")
    });

    // ------------------------------------------------------------------------------------------------------------
    // The Lava Cave
    // ------------------------------------------------------------------------------------------------------------
    function caveScene(W, H, opts) {
        const night = opts.theme === "dark", preview = !!opts.preview;
        let back, tites, mites, crystals, embers, falls;
        const C = night
            ? { top: "#0a0504", mid: "#1a0b07", low: "#3a1408", rock: "#140a08", rock2: "#22120d", lava: ["#ff5a1f", "#ffb02e", "#fff1a0"], glow: "#ff6a1f", crystal: "#3a2a5a" }
            : { top: "#2a1208", mid: "#5a2410", low: "#a8401a", rock: "#3a1c12", rock2: "#4e2716", lava: ["#ff6a2a", "#ffc23e", "#fff6c4"], glow: "#ff8a3a", crystal: "#5a3e88" };
        function setup() {
            const R = U.rng(73);
            back = null;
            tites = Array.from({ length: 22 }, (_, i) => ({ x: (i + R() * 0.6) / 22 * W, l: H * (0.06 + R() * 0.22), w: 14 + R() * 30 }));
            mites = Array.from({ length: 14 }, (_, i) => ({ x: (i + R() * 0.6) / 14 * W, l: H * (0.05 + R() * 0.14), w: 20 + R() * 40 }));
            crystals = Array.from({ length: 10 }, () => ({ x: R() < 0.5 ? R() * W * 0.2 : W - R() * W * 0.2, y: H * (0.3 + R() * 0.4), s: 10 + R() * 18, a: (R() - 0.5) * 0.8 }));
            embers = Array.from({ length: preview ? 20 : lite() ? 40 : 90 }, () => ({ x: R() * W, y: H * R(), v: 30 + R() * 70, s: 1 + R() * 2.2, p: R() * TAU }));
            falls = [W * 0.18, W * 0.8].map(x => ({ x, w: 18 + R() * 14 }));
        }
        setup();
        return {
            resize(w, h) { W = w; H = h; setup(); },
            draw(g, t, dt, inp) {
                if (!back) back = grad(g, 0, H, [[0, C.top], [0.6, C.mid], [1, C.low]]);
                g.fillStyle = back; g.fillRect(0, 0, W, H);
                const ry = H * 0.84;                             // the lava river's surface
                // glow from below on everything
                g.fillStyle = radial(g, W / 2, ry + 40, Math.max(W, H) * 0.7, [[0, night ? "rgba(255,90,30,.35)" : "rgba(255,120,50,.45)"], [1, "rgba(0,0,0,0)"]]);
                g.fillRect(0, 0, W, H);
                // lava falls pouring from the walls
                for (const f of falls) {
                    g.fillStyle = grad(g, 0, ry, [[0, C.lava[0]], [0.5, C.lava[1]], [1, C.lava[0]]]);
                    const wob = Math.sin(t * 3 + f.x) * 3;
                    g.fillRect(f.x - f.w / 2 + wob, H * 0.12, f.w, ry - H * 0.12);
                    Worlds.glow(g, f.x, ry, f.w * 4, C.glow, 0.5);
                    for (let k = 0; k < 4; k++) { const y = H * 0.12 + ((t * 120 + k * 60) % (ry - H * 0.12)); g.fillStyle = C.lava[2]; g.globalAlpha = 0.6; g.fillRect(f.x - 3 + wob, y, 6, 16); }
                    g.globalAlpha = 1;
                }
                // obsidian crystals in the walls
                for (const c of crystals) {
                    g.save(); g.translate(c.x, c.y); g.rotate(c.a);
                    g.fillStyle = C.crystal; g.beginPath(); g.moveTo(0, -c.s); g.lineTo(c.s * 0.4, 0); g.lineTo(0, c.s * 0.6); g.lineTo(-c.s * 0.4, 0); g.closePath(); g.fill();
                    g.fillStyle = "rgba(255,180,120,.35)"; g.beginPath(); g.moveTo(0, -c.s); g.lineTo(c.s * 0.4, 0); g.lineTo(0, 0); g.fill();
                    g.restore();
                }
                // stalactites hanging from the roof, stalagmites rising to meet them
                g.fillStyle = C.rock;
                g.fillRect(0, 0, W, H * 0.04);
                for (const s of tites) { g.beginPath(); g.moveTo(s.x - s.w / 2, 0); g.lineTo(s.x, H * 0.04 + s.l); g.lineTo(s.x + s.w / 2, 0); g.fill(); }
                g.fillStyle = C.rock2;
                for (const s of mites) { g.beginPath(); g.moveTo(s.x - s.w / 2, ry); g.lineTo(s.x, ry - s.l); g.lineTo(s.x + s.w / 2, ry); g.fill(); }
                // the river of lava: a bright crust with cracks of fire that flow
                g.fillStyle = grad(g, ry, H, [[0, C.lava[1]], [0.35, C.lava[0]], [1, "#7a1a06"]]);
                g.fillRect(0, ry, W, H - ry);
                g.strokeStyle = night ? "rgba(40,8,2,.55)" : "rgba(80,20,4,.45)"; g.lineWidth = 3;
                for (let k = 0; k < 7; k++) {
                    const y = ry + 10 + k * (H - ry) / 7, off = (t * 30 * (1 + k * 0.2)) % 120;
                    g.beginPath();
                    for (let x = -120; x <= W + 120; x += 40) { const xx = x + off, yy = y + Math.sin(x * 0.05 + k) * 4; x === -120 ? g.moveTo(xx, yy) : g.lineTo(xx, yy); }
                    g.stroke();
                }
                Worlds.glow(g, W * 0.5, ry, W * 0.4, C.lava[1], 0.25);
                // embers rising
                for (const e of embers) {
                    e.y -= e.v * dt; e.x += Math.sin(t * 2 + e.p) * 14 * dt;
                    if (e.y < -5) { e.y = ry; e.x = Math.random() * W; }
                    const a = Math.max(0, Math.min(1, (e.y / ry))) * (0.5 + Math.sin(t * 6 + e.p) * 0.3);
                    g.fillStyle = C.lava[2]; g.globalAlpha = a; g.beginPath(); g.arc(e.x, e.y, e.s, 0, TAU); g.fill();
                }
                g.globalAlpha = 1;
            }
        };
    }
    // The board: a crystal, an ember or a drop of magma in each typed square; a glowing lava vein along finished words
    const caveBoard = deco("lc", {
        marks: [
            `<path d="M0 -.045L.018 -.012L.012 .035H-.012L-.018 -.012Z" class="lc-crystal"/><path d="M0 -.045V.035" class="lc-facet"/>`,
            `<circle r=".02" class="lc-ember"/><circle r=".008" class="lc-core"/>`,
            `<path d="M0 -.04Q.026 -.002 .02 .018A.02 .02 0 0 1 -.02 .018Q-.026 -.002 0 -.04Z" class="lc-drop"/>`
        ],
        word(entry, cells, rnd, g, across) {
            const [r0, c0] = cells[0], n = cells.length, pts = [];
            for (let i = 0; i <= n * 3; i++) { const u = 0.08 + i / (n * 3) * (n - 0.16), j = (rnd(i) - 0.5) * 0.05; pts.push(across ? [c0 + u, r0 + 0.92 + j] : [c0 + 0.92 + j, r0 + u]); }
            const d = "M" + pts.map(([x, y]) => x.toFixed(3) + " " + y.toFixed(3)).join("L");
            U.svg("path", { d, class: "lc-vein-glow", pathLength: "1" }, g);
            U.svg("path", { d, class: "lc-vein", pathLength: "1" }, g);
        },
        typeColors: ["#ff6a1f", "#ffb02e", "#ffe08a"], typeShape: "spark", rise: true,
        doneColors: ["#ff5a1f", "#ffb02e", "#fff1a0"], doneShape: "spark"
    });

    register({
        id: "cave", name: "The Lava Cave", icon: "🌋", tagline: "Under the Volcano, Something Burns.", parent: "volcano",
        scene: caveScene, board: caveBoard, celebrate: winOf(["#ff5a1f", "#ffb02e", "#fff1a0", "#3a2a5a"], "spark")
    });
})();
