// Spells (built by Claude at the user's request, 2026-10-09): the big animations for boss-fight abilities and boss
// moves. The user wanted them to feel real, "like the Thunderhead's lightning strike: make it strike actual lightning
// that connects between the words and zaps them away". So every effect is aimed at the actual squares it changes:
// the letters it erases are shown being zapped, burned, blown, washed or sucked away.
//
//   Spells.play(kind, { cells, area, from, to, color })   plays a kind's effect (see RECIPES at the bottom)
//      cells: [{ el, ch }]  the squares the effect changed (their old letters), area: the board it hits,
//      from / to: where it comes from and where it lands (points), color: the ability's colour
//   Spells.bolt(a, b, opts)  one lightning bolt between two points
//
// Everything is drawn on one full-screen canvas (no pointer events), plus a few DOM pieces: copies of the letters,
// so they can fly off while the real squares are already empty.

const Spells = (() => {
    const still = () => U.motion() === "still";
    const lite = () => U.motion() === "lite";
    let canvas = null, g = null, effects = [], running = false, last = 0, dpr = 1;
    function ensure() {
        if (canvas) return;
        canvas = U.el("canvas", { class: "spells-canvas", "aria-hidden": "true" });
        document.body.appendChild(canvas);
        g = canvas.getContext("2d");
        const size = () => { dpr = Math.min(2, devicePixelRatio || 1); canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; };
        size();
        addEventListener("resize", size);
    }
    // Effects stay on what they were aimed at. Each one follows an element (the user, 2026-10-14: "this change you made
    // for tracking boards, can you do this for other animations that are meant to travel boards"): the area a
    // Spells.play is aimed at (your board, the boss's board, the boss), or else your board. It's measured again every
    // frame and the effect is drawn moved and scaled with it, so scrolling, the page shifting, a resize or the zoom
    // setting don't leave it behind. With nothing to follow it's shifted by the scroll, as before. fixed: true for
    // one that measures live positions itself.
    let aim = null;
    const anchorOf = el => {
        if (!el || !el.isConnected) return null;
        const r = el.getBoundingClientRect();
        return r.width ? { el, x: r.left, y: r.top, w: r.width, last: r } : null;
    };
    function add(fx) {
        if (still()) return;
        ensure();
        fx.t = 0;
        if (!fx.fixed && !fx.anchor) fx.anchor = anchorOf(aim && aim.isConnected ? aim : document.getElementById("board"));
        fx.sx = scrollX; fx.sy = scrollY;
        effects.push(fx);
        if (!running) { running = true; last = performance.now(); requestAnimationFrame(loop); }
    }
    function loop(now) {
        const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));      // a frame can be stamped just before "last": never step back
        last = now;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, innerWidth, innerHeight);
        // effects started while drawing (crumbs flying off an eraser...) join on the next frame instead of being lost
        const now_ = effects, sx = scrollX, sy = scrollY, seen = new Map();
        // where an anchor is now (each element measured once a frame; a removed one keeps its last place)
        const follow = a => {
            let r = seen.get(a.el);
            if (r === undefined) { r = a.el.isConnected ? a.el.getBoundingClientRect() : null; if (r && !r.width) r = null; seen.set(a.el, r); }
            if (r) a.last = r;
            const q = a.last, k = q.width / a.w;
            g.translate(q.left, q.top); g.scale(k, k); g.translate(-a.x, -a.y);
        };
        effects = [];
        const kept = now_.filter(fx => { fx.t += dt; const alive = fx.t < fx.life; if (alive) { g.save(); if (fx.anchor) follow(fx.anchor); else if (!fx.fixed) g.translate(fx.sx - sx, fx.sy - sy); try { fx.draw(g, fx.t / fx.life, fx.t); } catch (err) { console.error("spell", err); fx.life = 0; } g.restore(); } return alive; });
        effects = kept.concat(effects);
        if (effects.length) requestAnimationFrame(loop);
        else { running = false; g.clearRect(0, 0, innerWidth, innerHeight); }
    }
    const wait = ms => new Promise(r => setTimeout(r, still() ? 0 : ms));
    const rect = el => el.getBoundingClientRect();
    const mid = el => { const r = rect(el); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    const rnd = (a, b) => a + Math.random() * (b - a);

    // ---- drawing helpers ----
    // Redone on 2026-10-10 (the user: "make large adjustments to every particle, animation: make them look nicer, add
    // extra details"): every one has more to it now: light blooms and flares where things hit, afterimages, splatter,
    // shine, foam, bubbles, debris, embers, smoke, tapered stems with thorns and flowers. Glows use the shared cached
    // sprites from fx.js (FX.art), which are much cheaper than shadow blurs.
    const TAU = Math.PI * 2;
    const tint = (c, k) => FX.art.tint(c, k), fade = (c, a) => FX.art.fade(c, a);
    // a soft glow at a point (lighter blend), for any colour
    function haloAt(ctx, x, y, r, color, a = 1) {
        if (r < 1 || a <= 0.01) return;
        const ga = ctx.globalAlpha, op = ctx.globalCompositeOperation;
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = Math.min(1, ga * a);
        ctx.drawImage(FX.art.halo(color), x - r, y - r, r * 2, r * 2);
        ctx.globalAlpha = ga;
        ctx.globalCompositeOperation = op;
    }
    // a jagged path from a to b (midpoint displacement), for lightning and cracks
    function jag(a, b, rough = 0.28, depth = 6) {
        let pts = [a, b];
        for (let d = 0; d < depth; d++) {
            const next = [pts[0]];
            for (let i = 0; i < pts.length - 1; i++) {
                const p = pts[i], q = pts[i + 1], len = Math.hypot(q.x - p.x, q.y - p.y);
                const nx = -(q.y - p.y) / (len || 1), ny = (q.x - p.x) / (len || 1), off = (Math.random() - 0.5) * len * rough;
                next.push({ x: (p.x + q.x) / 2 + nx * off, y: (p.y + q.y) / 2 + ny * off }, q);
            }
            pts = next;
        }
        return pts;
    }
    function stroke(ctx, pts, width, color, glow) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (const p of pts) ctx.lineTo(p.x, p.y);
        ctx.lineWidth = width;
        ctx.strokeStyle = color;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.shadowColor = glow || color;
        ctx.shadowBlur = width * 4;
        ctx.stroke();
    }
    function strokePlain(ctx, pts, width, color) {
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (const p of pts) ctx.lineTo(p.x, p.y);
        ctx.lineWidth = width;
        ctx.strokeStyle = color;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
    }
    // a lightning bolt between two points: it flickers (redrawn jagged every few frames, its last shape left behind as
    // a dim afterimage), branches, lights up the air round it, flares where it starts and where it hits (with sparks)
    function bolt(a, b, { color = "#bfe8ff", core = "#ffffff", width = 4, life = 0.55, branches = 3 } = {}) {
        let pts = jag(a, b), forks = [], frame = 0, prev = null;
        const makeForks = () => {
            forks = [];
            for (let i = 0; i < branches; i++) {
                const p = pts[Math.floor(rnd(0.2, 0.8) * pts.length)], ang = Math.atan2(b.y - a.y, b.x - a.x) + rnd(-1.1, 1.1), len = Math.hypot(b.x - a.x, b.y - a.y) * rnd(0.15, 0.35);
                forks.push(jag(p, { x: p.x + Math.cos(ang) * len, y: p.y + Math.sin(ang) * len }, 0.4, 4));
            }
        };
        makeForks();
        if (!still()) FX.burst({ x: b.x, y: b.y, n: lite() ? 6 : 14, colors: [core, color], shape: "spark", glow: true, speed: [160, 420], gravity: 500, drag: 1.4, life: [0.25, 0.55], size: [1.4, 2.6] });
        add({ life, draw(ctx, k) {
            if (frame++ % 3 === 0) { prev = pts; pts = jag(a, b); makeForks(); }
            const alpha = k < 0.15 ? 1 : (1 - k) * (0.6 + Math.random() * 0.4);
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = alpha * 0.14;
            strokePlain(ctx, pts, width * 8, color);                       // the air lit up round it
            if (prev) { ctx.globalAlpha = alpha * 0.28; strokePlain(ctx, prev, width * 1.1, color); }
            ctx.globalAlpha = alpha;
            stroke(ctx, pts, width * 2.6, color);
            for (const f of forks) stroke(ctx, f, width, color);
            ctx.globalAlpha = alpha;
            stroke(ctx, pts, width * 0.9, core, color);
            haloAt(ctx, b.x, b.y, width * 15 * (1 - k * 0.4), color, alpha);
            haloAt(ctx, b.x, b.y, width * 5, core, alpha);
            if (k < 0.35) haloAt(ctx, a.x, a.y, width * 7, color, alpha * 0.7);
        } });
    }
    // a glow that pops at a point: wide soft light, a white-hot middle, and a lens streak across the big ones
    function glow(p, { color = "#fff", r = 90, life = 0.5 } = {}) {
        add({ life, draw(ctx, k) {
            const rad = r * (0.4 + k * 0.8), a = 1 - k;
            haloAt(ctx, p.x, p.y, rad * 1.3, color, a * 0.85);
            haloAt(ctx, p.x, p.y, rad * 0.42, "#ffffff", a * 0.7);
            if (r >= 80) {
                ctx.save();
                ctx.globalCompositeOperation = "lighter";
                ctx.globalAlpha = a * 0.55;
                ctx.translate(p.x, p.y);
                ctx.scale(1, 0.06);
                ctx.drawImage(FX.art.halo(color), -rad * 2, -rad * 2, rad * 4, rad * 4);
                ctx.restore();
            }
        } });
    }
    // a blob splat (ink, pie, goo, paint): a ragged blob with spikes, a wet shine, drips with beads, and splatter
    // droplets thrown out round it; it stays a moment, then fades
    function splat(p, { color = "#1a1424", r = 40, life = 1.6, drips = 4 } = {}) {
        const pts = [], n = 18;
        for (let i = 0; i < n; i++) pts.push(r * (i % 5 === 2 ? rnd(1.15, 1.4) : rnd(0.62, 1.12)));
        const dl = []; for (let i = 0; i < drips; i++) dl.push({ x: rnd(-r * 0.7, r * 0.7), len: rnd(r * 0.5, r * 1.4), w: rnd(4, 9) });
        const dots = [];
        for (let i = 0; i < (lite() ? 5 : 12); i++) { const a = rnd(0, TAU), d = r * rnd(1.2, 2); dots.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, s: rnd(1.5, r * 0.12 + 2) }); }
        const shine = tint(color, 0.55);
        add({ life, draw(ctx, k) {
            const grow = Math.min(1, k * 6), fly = Math.min(1, k * 8), fd = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
            ctx.globalAlpha = fd;
            ctx.fillStyle = color;
            ctx.beginPath();
            for (let i = 0; i <= n; i++) {
                const a = (i / n) * TAU, rr = pts[i % n] * grow;
                const x = p.x + Math.cos(a) * rr, y = p.y + Math.sin(a) * rr;
                i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            }
            ctx.fill();
            for (const d of dl) {
                const len = d.len * Math.min(1, k * 2);
                ctx.fillRect(p.x + d.x - d.w / 2, p.y, d.w, len);
                ctx.beginPath(); ctx.arc(p.x + d.x, p.y + len, d.w * 0.8, 0, TAU); ctx.fill();
            }
            for (const d of dots) { ctx.beginPath(); ctx.arc(p.x + d.x * fly, p.y + d.y * fly, d.s, 0, TAU); ctx.fill(); }
            ctx.globalAlpha = fd * 0.4;
            ctx.fillStyle = shine;
            ctx.beginPath(); ctx.ellipse(p.x - r * 0.28 * grow, p.y - r * 0.32 * grow, r * 0.3 * grow, r * 0.14 * grow, -0.5, 0, TAU); ctx.fill();
            for (const d of dl) { const len = d.len * Math.min(1, k * 2); ctx.beginPath(); ctx.arc(p.x + d.x - d.w * 0.25, p.y + len - d.w * 0.25, d.w * 0.25, 0, TAU); ctx.fill(); }
        } });
    }
    // a growing vine from a to b: a stem that's thick at the root and thin at the tip (dark edge, light line), leaves
    // that unfurl as it passes (lit on one half, with a vein), curly tendrils, little thorns, and a flower at the tip
    function vine(a, b, { color = "#2f9e4f", leaf = "#7be36b", life = 1.8 } = {}) {
        const c1 = { x: a.x + (b.x - a.x) * 0.3 + rnd(-60, 60), y: a.y + (b.y - a.y) * 0.3 + rnd(-60, 60) }, c2 = { x: a.x + (b.x - a.x) * 0.7 + rnd(-50, 50), y: a.y + (b.y - a.y) * 0.7 + rnd(-50, 50) };
        const at = s => { const u = 1 - s; return { x: u * u * u * a.x + 3 * u * u * s * c1.x + 3 * u * s * s * c2.x + s * s * s * b.x, y: u * u * u * a.y + 3 * u * u * s * c1.y + 3 * u * s * s * c2.y + s * s * s * b.y }; };
        const dark = tint(color, -0.4), light = tint(color, 0.45), leafLight = tint(leaf, 0.4), leafDark = tint(leaf, -0.35);
        const bloom = U.pick(["#ff8fb8", "#ffd23f", "#c08bff", "#ffffff"]);
        const path = (ctx, upto) => { ctx.beginPath(); for (let s = 0; s <= upto + 0.001; s += 0.02) { const q = at(Math.min(s, upto)); s ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); } };
        add({ life, draw(ctx, k) {
            const grow = Math.min(1, k * 2.2), fd = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
            ctx.globalAlpha = fd;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            const steps = [[1, 3.2], [0.66, 5.2], [0.33, 7.4]];
            for (const [f, w] of steps) { path(ctx, grow * f); ctx.strokeStyle = dark; ctx.lineWidth = w + 2.6; ctx.stroke(); }
            for (const [f, w] of steps) { path(ctx, grow * f); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke(); }
            path(ctx, grow * 0.92); ctx.strokeStyle = light; ctx.lineWidth = 1.2; ctx.globalAlpha = fd * 0.55; ctx.stroke(); ctx.globalAlpha = fd;
            // thorns, tendrils and leaves along it
            ctx.fillStyle = dark;
            for (let s = 0.08; s < grow; s += 0.09) {
                const q = at(s), q2 = at(Math.min(1, s + 0.01)), ang = Math.atan2(q2.y - q.y, q2.x - q.x), side = Math.round(s * 100) % 2 ? 1 : -1;
                const w = 6 * (1 - s * 0.6);
                ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(ang + side * 1.25);
                ctx.beginPath(); ctx.moveTo(w * 0.45, -2); ctx.lineTo(w * 0.45 + 6, 0); ctx.lineTo(w * 0.45, 2); ctx.fill();
                ctx.restore();
            }
            for (let s = 0.22; s < grow; s += 0.31) {
                const q = at(s), side = Math.round(s * 10) % 2 ? 1 : -1;
                ctx.strokeStyle = color; ctx.lineWidth = 1.6;
                ctx.beginPath();
                for (let j = 0; j <= 14; j++) { const an = j / 14 * 4.2 * side, rr = 9 * (1 - j / 18); const x = q.x + side * 6 + Math.cos(an) * rr, y = q.y - 4 + Math.sin(an) * rr; j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
                ctx.stroke();
            }
            for (let s = 0.15; s < grow; s += 0.17) {
                const q = at(s), q2 = at(Math.min(1, s + 0.01)), side = Math.round(s * 10) % 2 ? 1 : -1, ang = Math.atan2(q2.y - q.y, q2.x - q.x) + side * 1.1;
                const open = Math.min(1, (grow - s) * 7);
                ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(ang); ctx.scale(open, open);
                ctx.fillStyle = leaf;
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(7, -7, 18, 0); ctx.quadraticCurveTo(7, 7, 0, 0); ctx.fill();
                ctx.fillStyle = leafLight;
                ctx.globalAlpha = fd * 0.6;
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(7, -7, 18, 0); ctx.closePath(); ctx.fill();
                ctx.globalAlpha = fd;
                ctx.strokeStyle = leafDark; ctx.lineWidth = 0.9;
                ctx.beginPath(); ctx.moveTo(1, 0); ctx.lineTo(16, 0); ctx.stroke();
                ctx.restore();
            }
            // a flower opens at the tip once it's grown
            const fl = Math.max(0, Math.min(1, (k - 0.42) * 5));
            if (fl > 0) {
                ctx.save(); ctx.translate(b.x, b.y); ctx.scale(fl, fl); ctx.rotate(k * 2);
                ctx.fillStyle = bloom;
                for (let i = 0; i < 5; i++) { ctx.rotate(TAU / 5); ctx.beginPath(); ctx.ellipse(0, -6, 4.2, 6.5, 0, 0, TAU); ctx.fill(); }
                ctx.fillStyle = "#ffcf3a"; ctx.beginPath(); ctx.arc(0, 0, 3.6, 0, TAU); ctx.fill();
                ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.beginPath(); ctx.arc(-1, -1, 1.2, 0, TAU); ctx.fill();
                ctx.restore();
            }
        } });
    }
    // a vortex: spinning arms round a point getting smaller, a glow, a tilted bright ring round the dark eye, and
    // bits of debris spiralling in faster and faster
    function vortex(p, { color = "#6b4dff", r = 120, life = 1.4, arms = 5 } = {}) {
        const debris = Array.from({ length: lite() ? 14 : 36 }, () => ({ a: rnd(0, TAU), d: Math.random(), sp: rnd(0.6, 1.4), s: rnd(1.2, 3.2), c: Math.random() < 0.45 ? "#ffffff" : tint(color, 0.35) }));
        const ringC = tint(color, 0.55);
        add({ life, draw(ctx, k, t) {
            const rad = r * (1 - k * 0.6), env = Math.sin(k * Math.PI);
            haloAt(ctx, p.x, p.y, rad * 1.35, color, env * 0.6);
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = env;
            for (let i = 0; i < arms; i++) {
                ctx.beginPath();
                for (let s = 0; s < 1; s += 0.03) {
                    const a = t * 6 + i * (TAU / arms) + s * 4, rr = rad * (1 - s);
                    const x = p.x + Math.cos(a) * rr, y = p.y + Math.sin(a) * rr * 0.75;
                    s ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
                }
                ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.shadowColor = color; ctx.shadowBlur = 16; ctx.stroke();
            }
            ctx.shadowBlur = 0;
            for (const d of debris) {
                const u = (d.d + t * 0.45 * d.sp) % 1, rr = rad * (1 - u) * 1.05, an = d.a + t * d.sp * (2 + u * 7);
                ctx.globalAlpha = env * Math.min(1, (1 - u) * 3);
                ctx.fillStyle = d.c;
                ctx.beginPath(); ctx.arc(p.x + Math.cos(an) * rr, p.y + Math.sin(an) * rr * 0.75, d.s * (0.5 + (1 - u) * 0.7), 0, TAU); ctx.fill();
            }
            ctx.globalAlpha = env * 0.85;
            ctx.strokeStyle = ringC;
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.ellipse(p.x, p.y, rad * 0.46, rad * 0.16, Math.sin(t * 1.3) * 0.25, 0, TAU); ctx.stroke();
            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad * 0.35);
            grad.addColorStop(0, "#000"); grad.addColorStop(0.75, "rgba(0,0,0,.85)"); grad.addColorStop(1, "transparent");
            ctx.globalCompositeOperation = "source-over";
            ctx.globalAlpha = env;
            ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(p.x, p.y, rad * 0.35, 0, TAU); ctx.fill();
        } });
    }
    // frost: crystal lines spreading out from a point, ice crystals forming at their tips, glints, and a frosty edge
    // creeping in round the area
    function frost(p, area, { color = "#cfeeff", life = 1.6 } = {}) {
        const lines = [];
        const reach = Math.max(area.width, area.height) * 0.8;
        for (let i = 0; i < 18; i++) {
            const a = (i / 18) * TAU + rnd(-0.15, 0.15), len = reach * rnd(0.45, 1);
            lines.push(jag(p, { x: p.x + Math.cos(a) * len, y: p.y + Math.sin(a) * len }, 0.18, 4));
        }
        const glints = Array.from({ length: lite() ? 4 : 10 }, () => ({ x: rnd(area.left, area.right), y: rnd(area.top, area.bottom), ph: rnd(0, 6) }));
        add({ life, draw(ctx, k, t) {
            const grow = Math.min(1, k * 2.5), fd = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
            ctx.save();
            ctx.beginPath(); ctx.rect(area.left - 6, area.top - 6, area.width + 12, area.height + 12); ctx.clip();
            ctx.globalAlpha = fd * 0.95;
            for (const l of lines) {
                const n = Math.max(2, Math.floor(l.length * grow));
                stroke(ctx, l.slice(0, n), 2, color, "#8fd8ff");
            }
            ctx.shadowBlur = 0;
            for (const l of lines) {                                        // a crystal at the tip of each line
                const n = Math.max(2, Math.floor(l.length * grow)), q = l[n - 1], s = 3 + grow * 4;
                ctx.globalAlpha = fd;
                ctx.drawImage(FX.art.flake("#ffffff"), q.x - s * 2, q.y - s * 2, s * 4, s * 4);
            }
            ctx.globalAlpha = fd * 0.35 * grow;
            ctx.fillStyle = "#e8f7ff"; ctx.fillRect(area.left, area.top, area.width, area.height);
            // the frosty edge
            const e = Math.min(area.width, area.height) * 0.3 * grow;
            for (const [x0, y0, x1, y1] of [[area.left, 0, area.left + e, 0], [area.right, 0, area.right - e, 0], [0, area.top, 0, area.top + e], [0, area.bottom, 0, area.bottom - e]]) {
                const gr = x0 ? ctx.createLinearGradient(x0, 0, x1, 0) : ctx.createLinearGradient(0, y0, 0, y1);
                gr.addColorStop(0, "rgba(240,250,255,.85)"); gr.addColorStop(1, "rgba(240,250,255,0)");
                ctx.globalAlpha = fd * 0.8;
                ctx.fillStyle = gr;
                ctx.fillRect(area.left, area.top, area.width, area.height);
            }
            ctx.restore();
            for (const gl of glints) { const tw = Math.sin(t * 7 + gl.ph); if (tw > 0.6) haloAt(ctx, gl.x, gl.y, 10, "#ffffff", fd * (tw - 0.6) * 2.5); }
        } });
    }
    // a wave of water sweeping across an area (or rising up from the bottom): a darker wave behind, a front wave that's
    // lighter at the top, foam along the crest, bubbles inside and spray flying off the front
    function wave(area, { color = "rgba(60, 150, 230, .75)", foam = "#e8f7ff", life = 1.2, up = false } = {}) {
        const back = tint(color, -0.3), topC = tint(color, 0.3);
        const bubbles = Array.from({ length: lite() ? 8 : 22 }, () => ({ x: Math.random(), y: Math.random(), r: rnd(1.5, 4.2), sp: rnd(0.4, 1.1) }));
        add({ life, draw(ctx, k, t) {
            ctx.save();
            ctx.beginPath(); ctx.rect(area.left - 10, area.top - 10, area.width + 20, area.height + 20); ctx.clip();
            const e = Math.sin(k * Math.PI);
            const surf = (x, ph) => Math.sin(x / 22 + t * 9 + ph) * 9 + Math.sin(x / 9 - t * 5 + ph) * 3;
            const side = (y, ph) => Math.sin(y / 18 + t * 10 + ph) * 14 + Math.sin(y / 7 - t * 6 + ph) * 4;
            const crest = [];
            for (const layer of [0, 1]) {
                ctx.beginPath();
                if (up) {
                    const top = area.bottom - area.height * e * 1.05 - (layer ? 0 : 10);
                    ctx.moveTo(area.left - 10, area.bottom + 10);
                    for (let x = area.left - 10; x <= area.right + 10; x += 8) { const y = top + surf(x, layer ? 0 : 2); ctx.lineTo(x, y); if (layer) crest.push([x, y]); }
                    ctx.lineTo(area.right + 10, area.bottom + 10);
                    if (layer) { const gr = ctx.createLinearGradient(0, top - 10, 0, area.bottom); gr.addColorStop(0, topC); gr.addColorStop(1, color); ctx.fillStyle = gr; } else ctx.fillStyle = back;
                } else {
                    const front = area.left - 40 + (area.width + 80) * Math.min(1, k * 1.6) + (layer ? 0 : 16);
                    ctx.moveTo(area.left - 10, area.top - 10);
                    for (let y = area.top - 10; y <= area.bottom + 10; y += 8) { const x = front + side(y, layer ? 0 : 2); ctx.lineTo(x, y); if (layer) crest.push([x, y]); }
                    ctx.lineTo(area.left - 10, area.bottom + 10);
                    if (layer) { const gr = ctx.createLinearGradient(front, 0, area.left, 0); gr.addColorStop(0, topC); gr.addColorStop(1, color); ctx.fillStyle = gr; } else ctx.fillStyle = back;
                }
                ctx.closePath();
                ctx.globalAlpha = layer ? 1 : 0.75;
                ctx.fill();
            }
            ctx.globalAlpha = 0.85;
            ctx.strokeStyle = foam; ctx.lineWidth = 4;
            ctx.beginPath(); crest.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
            ctx.fillStyle = foam;
            crest.forEach(([x, y], i) => { if (i % 2) return; ctx.beginPath(); ctx.arc(x + Math.sin(i * 7.1 + t * 8) * 3, y + Math.cos(i * 5.3 + t * 7) * 3, 2 + (i * 13 % 5) * 0.5, 0, TAU); ctx.fill(); });
            // bubbles rising inside the water
            ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 1.2;
            for (const bb of bubbles) {
                const x = area.left + bb.x * area.width + Math.sin(t * 6 + bb.x * 20) * 4, y = area.bottom - ((bb.y + t * bb.sp) % 1) * area.height;
                const inside = up ? y > area.bottom - area.height * e : x < area.left - 40 + (area.width + 80) * Math.min(1, k * 1.6);
                if (!inside) continue;
                ctx.globalAlpha = 0.8 * e;
                ctx.beginPath(); ctx.arc(x, y, bb.r, 0, TAU); ctx.stroke();
            }
            ctx.restore();
            // spray off the crest
            if (!up && k < 0.6) { ctx.fillStyle = foam; for (let i = 0; i < crest.length; i += 3) { const [x, y] = crest[i]; ctx.globalAlpha = 0.7 * (1 - k / 0.6); ctx.beginPath(); ctx.arc(x + 8 + ((i * 37 + t * 300) % 30), y + Math.sin(i + t * 9) * 6, 1.6, 0, TAU); ctx.fill(); } }
        } });
    }
    // a stream of particles blowing across an area (sand, leaves, pollen, snow, wind): each one stretched by its speed,
    // nearer ones bigger, faster and brighter, with gusts of wind lines sweeping through
    function stream(area, { colors = ["#d9a35c"], n = 120, life = 1.3, dir = 1, size = [2, 5], wobble = 1, gravity = 0 } = {}) {
        const ps = [];
        for (let i = 0; i < (lite() ? n / 2 : n); i++) {
            const z = rnd(0.55, 1.3);
            ps.push({ x: dir > 0 ? area.left - rnd(0, 200) : area.right + rnd(0, 200), y: rnd(area.top - 20, area.bottom + 20), v: rnd(380, 720) * z, s: rnd(...size) * z, c: colors[i % colors.length], ph: rnd(0, 6), z });
        }
        ps.sort((p, q) => p.z - q.z);
        const gusts = Array.from({ length: lite() ? 2 : 5 }, () => ({ y: rnd(area.top, area.bottom), ph: rnd(0, 6), len: rnd(90, 220), v: rnd(700, 1000), x0: rnd(-200, 0) }));
        add({ life, draw(ctx, k, t) {
            const fd = k > 0.75 ? (1 - k) / 0.25 : 1;
            ctx.lineCap = "round";
            for (const gu of gusts) {
                const x = (dir > 0 ? area.left + gu.x0 + gu.v * t : area.right - gu.x0 - gu.v * t);
                ctx.globalAlpha = fd * 0.32;
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 1.6;
                ctx.beginPath();
                for (let j = 0; j <= 10; j++) { const xx = x - dir * gu.len * j / 10, yy = gu.y + Math.sin(j * 0.7 + t * 6 + gu.ph) * 6; j ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
                ctx.stroke();
            }
            for (const p of ps) {
                const x = p.x + dir * p.v * t, y = p.y + Math.sin(t * 8 + p.ph) * 10 * wobble + gravity * t * t;
                const len = p.s * 2 + p.v * 0.012;
                ctx.globalAlpha = fd * (0.45 + 0.55 * Math.min(1, p.z));
                ctx.fillStyle = p.c;
                ctx.fillRect(dir > 0 ? x - len + p.s * 2 : x, y, len, p.s);
                if (p.s > 3.5) { ctx.fillStyle = "rgba(255,255,255,.4)"; ctx.fillRect(dir > 0 ? x - len + p.s * 2 : x, y, len, Math.max(1, p.s * 0.25)); }
            }
        } });
    }
    // things falling from the top of the screen onto points (meteors, lava bombs, hail): a glowing head with a white
    // core, a tapered fiery tail, flickering embers left behind; on impact a flash, a ring, sparks and smoke
    function meteor(p, { color = "#ff6a00", tail = "#ffd23f", life = 0.55, delay = 0 } = {}) {
        const start = { x: p.x + rnd(-160, 160), y: -40 };
        const embers = [];
        return new Promise(resolve => setTimeout(() => {
            add({ life, draw(ctx, k) {
                const x = start.x + (p.x - start.x) * k, y = start.y + (p.y - start.y) * k * k;
                const tx = x - (p.x - start.x) * 0.38, ty = y - (p.y - start.y) * 0.38 * (0.4 + k);
                if (!lite() && Math.random() < 0.8) embers.push({ x: x + rnd(-6, 6), y: y + rnd(-6, 6), age: 0, s: rnd(1, 2.6) });
                ctx.globalCompositeOperation = "lighter";
                const grad = ctx.createLinearGradient(tx, ty, x, y);
                grad.addColorStop(0, "transparent"); grad.addColorStop(0.6, fade(color, 0.6)); grad.addColorStop(1, tail);
                ctx.strokeStyle = grad; ctx.lineCap = "round";
                ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
                ctx.lineWidth = 6; ctx.strokeStyle = "rgba(255,250,220,.8)"; ctx.beginPath(); ctx.moveTo((tx + x * 2) / 3, (ty + y * 2) / 3); ctx.lineTo(x, y); ctx.stroke();
                for (const e of embers) {
                    e.age += 0.016; e.y += 0.6;
                    const a = 1 - e.age / 0.4;
                    if (a <= 0) continue;
                    ctx.globalAlpha = a * (0.6 + Math.random() * 0.4);
                    ctx.fillStyle = tail;
                    ctx.fillRect(e.x, e.y, e.s, e.s);
                }
                ctx.globalAlpha = 1;
                haloAt(ctx, x, y, 34, color, 1);
                ctx.fillStyle = "#fff";
                ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fill();
            } });
            setTimeout(() => {
                glow(p, { color, r: 80, life: 0.5 });
                FX.ring({ x: p.x, y: p.y, color: tail, r1: 70, width: 6, dur: 0.45 });
                FX.burst({ x: p.x, y: p.y, n: 18, colors: [color, tail, "#2b2233"], shape: "star", speed: [100, 300], gravity: 400, life: [0.3, 0.7], size: [3, 6] });
                FX.burst({ x: p.x, y: p.y, n: lite() ? 3 : 7, colors: ["rgba(70,60,60,.55)", "rgba(110,95,90,.45)"], shape: "circle", speed: [20, 70], angle: -Math.PI / 2, spread: 1.2, gravity: -60, drag: 1.6, life: [0.8, 1.3], size: [6, 12] });
                resolve();
            }, still() ? 0 : life * 1000);
        }, still() ? 0 : delay));
    }
    // a beam between two points that pulses (taffy strands, lasers, energy): a wide bloom, wavy strands, a white core,
    // bright pulses running along it, and flares at both ends
    function beam(a, b, { color = "#ff6fb5", width = 10, life = 1, wobble = 18, strands = 3 } = {}) {
        const at = (u, t, s) => { const off = Math.sin(u * Math.PI) * Math.sin(t * 7 + s * 2 + u * 9) * wobble; return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u + off }; };
        add({ life, draw(ctx, k, t) {
            const env = Math.sin(k * Math.PI);
            ctx.globalAlpha = env * 0.18;
            ctx.globalCompositeOperation = "lighter";
            strokePlain(ctx, [a, b], width * 4.5, color);
            ctx.globalAlpha = env;
            for (let s = 0; s < strands; s++) {
                ctx.beginPath();
                for (let i = 0; i <= 30; i++) { const q = at(i / 30, t, s); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }
                ctx.strokeStyle = color; ctx.lineWidth = width / (s + 1); ctx.shadowColor = color; ctx.shadowBlur = 18; ctx.stroke();
            }
            ctx.shadowBlur = 0;
            ctx.beginPath();
            for (let i = 0; i <= 30; i++) { const q = at(i / 30, t, 0); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }
            ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = Math.max(1.5, width * 0.22); ctx.stroke();
            for (let i = 0; i < 3; i++) { const q = at((t * 1.4 + i / 3) % 1, t, 0); haloAt(ctx, q.x, q.y, width * 2, "#ffffff", env * 0.9); haloAt(ctx, q.x, q.y, width * 3.5, color, env * 0.6); }
            haloAt(ctx, a.x, a.y, width * 4, color, env);
            haloAt(ctx, b.x, b.y, width * 5, color, env);
        } });
    }
    // sun rays turning behind an area: rays that fade toward their ends, a second wider set turning the other way, and a
    // glowing middle
    function rays(area, { color = "rgba(255, 210, 63, .55)", life = 1.6, n = 14 } = {}) {
        const c = { x: area.left + area.width / 2, y: area.top + area.height / 2 }, R = Math.max(area.width, area.height);
        let gr = null;
        add({ life, draw(ctx, k, t) {
            const env = Math.sin(k * Math.PI);
            ctx.globalCompositeOperation = "lighter";
            haloAt(ctx, c.x, c.y, R * 0.55, color, env * 0.8);
            ctx.save();
            ctx.translate(c.x, c.y);
            if (!gr) { gr = ctx.createLinearGradient(0, 0, R, 0); gr.addColorStop(0, color); gr.addColorStop(0.55, fade(color, FX.art.rgba(color)[3] * 0.4)); gr.addColorStop(1, fade(color, 0)); }
            ctx.fillStyle = gr;
            for (const [count, w, spin, a] of [[n, 0.08, 0.8, 1], [Math.round(n / 2), 0.16, -0.45, 0.45]]) {
                ctx.save();
                ctx.rotate(t * spin);
                ctx.globalAlpha = env * a;
                for (let i = 0; i < count; i++) { ctx.rotate(TAU / count); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(R, -R * w); ctx.lineTo(R, R * w); ctx.fill(); }
                ctx.restore();
            }
            ctx.restore();
            haloAt(ctx, c.x, c.y, R * 0.18, "#ffffff", env * 0.6);
        } });
    }
    // glitch: colour-split slices (magenta and cyan pulled apart), scanlines and blocks of noise over an area
    function glitchBars(area, { life = 0.9 } = {}) {
        add({ life, draw(ctx) {
            ctx.globalCompositeOperation = "lighter";
            for (let i = 0; i < 9; i++) {
                const y = rnd(area.top, area.bottom), h = rnd(4, 18), dx = rnd(-30, 30), split = rnd(3, 9);
                ctx.globalAlpha = rnd(0.3, 0.7);
                ctx.fillStyle = "#ff2bd6"; ctx.fillRect(area.left + dx - split, y, area.width, h);
                ctx.fillStyle = "#00f0ff"; ctx.fillRect(area.left + dx + split, y, area.width, h);
                ctx.globalAlpha = rnd(0.4, 0.9);
                ctx.fillStyle = i % 3 ? "#ffffff" : "#7bff5c"; ctx.fillRect(area.left + dx, y + h * 0.4, area.width, Math.max(1, h * 0.2));
            }
            ctx.globalCompositeOperation = "source-over";
            ctx.globalAlpha = 0.14;
            ctx.fillStyle = "#000";
            for (let y = area.top; y < area.bottom; y += 3) ctx.fillRect(area.left, y, area.width, 1);
            for (let i = 0; i < (lite() ? 4 : 12); i++) {
                ctx.globalAlpha = rnd(0.25, 0.7);
                ctx.fillStyle = ["#ffffff", "#2b2233", "#ff2bd6", "#00f0ff"][i % 4];
                ctx.fillRect(rnd(area.left, area.right), rnd(area.top, area.bottom), rnd(4, 26), rnd(3, 10));
            }
        } });
    }
    // a clock face spinning (forwards or backwards) over an area: a glassy face, minute and hour ticks, hands that
    // leave a sweep of light behind them, and a center cap
    function clockFace(area, { back = true, color = "#58d6ff", life = 1.3 } = {}) {
        const c = { x: area.left + area.width / 2, y: area.top + area.height / 2 }, R = Math.min(area.width, area.height) * 0.45;
        add({ life, draw(ctx, k, t) {
            const env = Math.sin(k * Math.PI);
            const face = ctx.createRadialGradient(c.x, c.y - R * 0.3, 0, c.x, c.y, R);
            face.addColorStop(0, fade(color, 0.28)); face.addColorStop(1, fade(color, 0.08));
            ctx.globalAlpha = env;
            ctx.fillStyle = face; ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, TAU); ctx.fill();
            ctx.globalAlpha = env * 0.85;
            ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.shadowColor = color; ctx.shadowBlur = 14;
            ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, TAU); ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(c.x, c.y, R * 0.92, 0, TAU); ctx.stroke();
            for (let i = 0; i < 60; i++) {
                const a = i * TAU / 60, big = i % 5 === 0, r0 = big ? R * 0.8 : R * 0.88;
                ctx.lineWidth = big ? 4 : 1.4;
                ctx.beginPath(); ctx.moveTo(c.x + Math.cos(a) * r0, c.y + Math.sin(a) * r0); ctx.lineTo(c.x + Math.cos(a) * R * 0.92, c.y + Math.sin(a) * R * 0.92); ctx.stroke();
            }
            const s = (back ? -1 : 1) * t * 9, dirn = back ? 1 : -1;
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = env * 0.3;
            ctx.fillStyle = color;
            ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.arc(c.x, c.y, R * 0.8, s, s + dirn * 0.9, back ? false : true); ctx.closePath(); ctx.fill();
            ctx.globalCompositeOperation = "source-over";
            ctx.globalAlpha = env * 0.95;
            ctx.strokeStyle = color; ctx.lineCap = "round";
            ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + Math.cos(s) * R * 0.8, c.y + Math.sin(s) * R * 0.8); ctx.stroke();
            ctx.lineWidth = 6;
            ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + Math.cos(s / 12) * R * 0.5, c.y + Math.sin(s / 12) * R * 0.5); ctx.stroke();
            ctx.fillStyle = "#ffffff";
            ctx.beginPath(); ctx.arc(c.x, c.y, 6, 0, TAU); ctx.fill();
            ctx.fillStyle = color;
            ctx.beginPath(); ctx.arc(c.x, c.y, 3, 0, TAU); ctx.fill();
            haloAt(ctx, c.x + Math.cos(s) * R * 0.8, c.y + Math.sin(s) * R * 0.8, 14, color, env);
        } });
    }

    // ---- the letters: copies of the old letters over their squares, which then leave in some style ----
    //   zap (flash white, jitter, burst into sparks) · burn (turn orange, rise, crumble) · blow (fly off sideways)
    //   wash (slide down and drip) · suck (spiral into a point) · smear (rubbed out) · pop (jump out and spin away)
    //   pixel (break into blocks) · freeze (turn to ice and shatter)
    function letterGhosts(cells) {
        return cells.map(({ el, ch }) => {
            if (!el || !ch) return null;
            const r = rect(el), src = el.querySelector(".ltr, .bp-ltr"), cs = src ? getComputedStyle(src) : null;
            const ghost = U.el("div", { class: "spell-letter", text: ch, style: { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px",
                font: cs ? cs.font : "800 24px sans-serif", color: cs ? cs.color : "#2b2233" } });
            document.body.appendChild(ghost);
            U.pin(ghost);
            return { ghost, r };
        }).filter(Boolean);
    }
    // what each way of leaving throws off, as the letter goes (the user, 2026-10-10: "add extra details")
    const LEAVE_FX = {
        zap: (x, y, o) => { FX.burst({ x, y, n: 12, colors: ["#fff", o.color, "#bfe8ff"], shape: "spark", glow: true, speed: [120, 300], gravity: 200, drag: 1.4, life: [0.25, 0.55], size: [1.4, 2.4] }); FX.burst({ x, y, n: 5, colors: ["#ffffff", "#bfe8ff"], shape: "star", glow: true, speed: [40, 120], gravity: 0, life: [0.3, 0.5], size: [3, 5] }); },
        freeze: (x, y) => { FX.burst({ x, y, n: 8, colors: ["#ffffff", "#dff1ff"], shape: "flake", speed: [70, 200], gravity: 260, life: [0.5, 0.9], size: [3, 6], spin: 4 }); FX.burst({ x, y, n: 10, colors: ["#e8f7ff", "#9fdcff"], shape: "rect", speed: [100, 260], gravity: 500, life: [0.4, 0.7], size: [3, 6] }); },
        pixel: (x, y) => FX.burst({ x, y, n: 14, colors: ["#ff2bd6", "#00f0ff", "#7bff5c"], shape: "pixel", speed: [80, 240], gravity: 200, life: [0.3, 0.7], size: [3, 6] }),
        burn: (x, y) => {
            FX.burst({ x, y, n: 10, colors: ["#ffb33a", "#ff6a00", "#ffe08a"], shape: "spark", glow: true, angle: -Math.PI / 2, spread: 0.8, speed: [60, 160], gravity: -120, drag: 1, life: [0.5, 0.9], size: [1.2, 2.2] });
            FX.burst({ x, y: y - 6, n: 4, colors: ["rgba(60,50,50,.5)", "rgba(100,90,90,.4)"], shape: "circle", angle: -Math.PI / 2, spread: 0.6, speed: [20, 60], gravity: -50, drag: 1.4, life: [0.8, 1.2], size: [5, 9] });
        },
        blow: (x, y) => FX.burst({ x, y, n: 5, colors: ["rgba(255,255,255,.7)", "rgba(230,235,245,.6)"], shape: "circle", speed: [30, 90], gravity: 0, drag: 2, life: [0.4, 0.6], size: [3, 6] }),
        wash: (x, y) => FX.burst({ x, y: y + 8, n: 6, colors: ["#7fb2ff", "#c9e0ff"], shape: "circle", angle: Math.PI / 2, spread: 0.6, speed: [60, 140], gravity: 700, life: [0.4, 0.7], size: [1.6, 3], shrink: true }),
        suck: (x, y, o) => { if (o.to) FX.burst({ x, y, n: 5, colors: ["#ffffff", o.color], shape: "star", glow: true, angle: Math.atan2(o.to.y - y, o.to.x - x), spread: 0.35, speed: [150, 300], gravity: 0, drag: 1, life: [0.3, 0.5], size: [2, 3.5] }); },
        smear: (x, y) => FX.burst({ x, y: y + 4, n: 5, colors: ["#e7d9df", "#ffb3c1", "#ffffff"], shape: "circle", speed: [30, 100], gravity: 300, life: [0.4, 0.7], size: [1.5, 3] }),
        pop: (x, y) => FX.burst({ x, y, n: 7, colors: ["#ffffff", "#ffd23f", "#ff9fb4"], shape: "star", speed: [80, 200], gravity: 300, life: [0.4, 0.7], size: [2, 4] })
    };
    function leave(ghosts, style, { to, color = "#fff", stagger = 60 } = {}) {
        return Promise.all(ghosts.map(({ ghost, r }, i) => new Promise(resolve => {
            const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            const frames = {
                zap: [{ transform: "none", filter: "none", opacity: 1 }, { transform: "translate(2px,-2px) scale(1.25)", filter: "brightness(5) drop-shadow(0 0 8px #bfe8ff)", opacity: 1, offset: 0.25 },
                    { transform: "translate(-3px,2px) scale(1.1)", filter: "brightness(5)", opacity: 1, offset: 0.45 }, { transform: "scale(.1)", filter: "brightness(5)", opacity: 0 }],
                burn: [{ color: ghost.style.color, transform: "none" }, { color: "#ff6a00", textShadow: "0 0 10px #ff3d00", transform: "translateY(-6px) scale(1.1)", offset: 0.4 }, { color: "#2b2233", transform: "translateY(-30px) scale(.6) rotate(10deg)", opacity: 0 }],
                blow: [{ transform: "none", opacity: 1 }, { transform: `translate(${rnd(140, 260)}px, ${rnd(-80, 40)}px) rotate(${rnd(200, 520)}deg) scale(.7)`, opacity: 0 }],
                wash: [{ transform: "none", opacity: 1 }, { transform: "translateY(8px) skewX(8deg)", opacity: 0.9, offset: 0.3 }, { transform: `translateY(${rnd(70, 120)}px) scaleY(1.6)`, opacity: 0, filter: "blur(2px)" }],
                suck: to ? [{ transform: "none", opacity: 1 }, { transform: `translate(${to.x - cx}px, ${to.y - cy}px) rotate(720deg) scale(.05)`, opacity: 0.2 }] : [{ opacity: 1 }, { opacity: 0, transform: "scale(.1) rotate(360deg)" }],
                smear: [{ transform: "none", opacity: 1, filter: "none" }, { transform: "translateX(6px) scaleX(1.4)", opacity: 0.5, filter: "blur(2px)", offset: 0.5 }, { transform: "translateX(14px) scaleX(2)", opacity: 0, filter: "blur(5px)" }],
                pop: [{ transform: "none", opacity: 1 }, { transform: `translate(${rnd(-40, 40)}px, -50px) rotate(${rnd(-90, 90)}deg) scale(1.3)`, opacity: 1, offset: 0.4 }, { transform: `translate(${rnd(-90, 90)}px, 80px) rotate(${rnd(-360, 360)}deg) scale(.6)`, opacity: 0 }],
                pixel: [{ transform: "none", opacity: 1, filter: "none" }, { transform: "translateX(-6px)", filter: "blur(1px) hue-rotate(90deg)", opacity: 0.8, offset: 0.2 }, { transform: "translateX(8px) scaleY(.3)", filter: "blur(3px) hue-rotate(200deg)", opacity: 0 }],
                freeze: [{ color: ghost.style.color, transform: "none", opacity: 1 }, { color: "#8fd8ff", textShadow: "0 0 10px #cfeeff", transform: "scale(1.15)", offset: 0.5 }, { transform: "scale(1.4)", opacity: 0, filter: "blur(2px)" }]
            }[style] || [{ opacity: 1 }, { opacity: 0 }];
            const delay = still() ? 0 : i * stagger, dur = still() ? 1 : { zap: 380, blow: 700, wash: 700, suck: 800, smear: 600, pop: 800, burn: 800 }[style] || 600;
            setTimeout(() => {
                LEAVE_FX[style] && LEAVE_FX[style](cx, cy, { color, to, r });
                const anim = ghost.animate(frames, { duration: dur, easing: "ease-out", fill: "forwards" });
                anim.onfinish = () => { ghost.remove(); resolve(); };
            }, delay);
        })));
    }

    // ---- recipes: how each kind of effect plays ----
    // ctx: { cells: [{el, ch}], area: element, from: point, to: point, color }
    const centerOf = el => mid(el);
    const R = {
        // lightning: a bolt from the sky onto the first square, then arcs jump from square to square, zapping each one
        lightning: async c => {
            const ghosts = letterGhosts(c.cells), pts = (c.cells.length ? c.cells.map(x => mid(x.el)) : [centerOf(c.area)]);
            const top = { x: pts[0].x + rnd(-120, 120), y: -20 };
            bolt(top, pts[0], { width: 6, life: 0.9, branches: 5 });
            FX.flash("#e8f4ff", 220, 0.5);
            glow(pts[0], { color: "#bfe8ff", r: 120 });
            await wait(160);
            for (let i = 1; i < pts.length; i++) { bolt(pts[i - 1], pts[i], { width: 3.5, life: 0.75, branches: 2 }); glow(pts[i], { color: "#bfe8ff", r: 70, life: 0.45 }); await wait(110); }
            if (pts.length > 1) bolt(pts[0], pts[pts.length - 1], { width: 2, life: 0.6, branches: 3 });     // one last arc across the whole word
            await leave(ghosts, "zap", { stagger: 50 });
        },
        // an eraser (or anything that scrubs) rubbing back and forth over the squares
        scrub: async (c, emoji = "🩹", style = "smear") => {
            const ghosts = letterGhosts(c.cells), pts = c.cells.length ? c.cells.map(x => mid(x.el)) : [centerOf(c.area)];
            const tool = U.el("div", { class: "spell-tool", text: emoji });
            document.body.appendChild(tool);
            U.pin(tool);
            const frames = [];
            pts.forEach(p => { frames.push({ transform: `translate(${p.x - 20}px, ${p.y - 30}px) rotate(-20deg)` }, { transform: `translate(${p.x + 14}px, ${p.y - 24}px) rotate(15deg)` }, { transform: `translate(${p.x - 14}px, ${p.y - 30}px) rotate(-15deg)` }); });
            if (!still()) await tool.animate(frames, { duration: Math.max(500, pts.length * 260), easing: "ease-in-out" }).finished.catch(() => null);
            tool.remove();
            pts.forEach(p => FX.burst({ x: p.x, y: p.y + 10, n: 8, colors: ["#ffb3c1", "#e7d9df", "#fff"], shape: "circle", speed: [40, 140], gravity: 300, life: [0.4, 0.8], size: [2, 4] }));
            await leave(ghosts, style);
        },
        // splats on the area (and on each square that changed)
        splat: async (c, color = "#1a1424", style = "wash") => {
            const ghosts = letterGhosts(c.cells), a = rect(c.area);
            const spots = c.cells.length ? c.cells.map(x => mid(x.el)) : [centerOf(c.area)];
            splat({ x: a.left + a.width / 2, y: a.top + a.height / 2 }, { color, r: Math.min(a.width, a.height) * 0.28 });
            spots.slice(0, 6).forEach((p, i) => setTimeout(() => splat(p, { color, r: rnd(14, 24), drips: 2, life: 1.3 }), i * 70));
            await wait(200);
            await leave(ghosts, style);
        },
        vines: async c => {
            const a = rect(c.area), targets = c.cells.length ? c.cells.map(x => mid(x.el)) : [centerOf(c.area)];
            targets.forEach((p, i) => { const edge = [{ x: a.left - 10, y: rnd(a.top, a.bottom) }, { x: a.right + 10, y: rnd(a.top, a.bottom) }, { x: rnd(a.left, a.right), y: a.bottom + 10 }][i % 3]; vine(edge, p); });
            await wait(900);
        },
        vortex: async (c, color = "#6b4dff") => {
            const ghosts = letterGhosts(c.cells), p = c.to || centerOf(c.area);
            vortex(p, { color, r: Math.max(rect(c.area).width, 160) * 0.6 });
            await wait(250);
            await leave(ghosts, "suck", { to: p, stagger: 40 });
        },
        frost: async c => {
            const ghosts = letterGhosts(c.cells), p = c.to || centerOf(c.area);
            frost(p, rect(c.area));
            glow(p, { color: "#cfeeff", r: 120, life: 0.7 });
            await wait(400);
            await leave(ghosts, "freeze");
        },
        wave: async (c, up = false) => {
            const ghosts = letterGhosts(c.cells);
            wave(rect(c.area), { up });
            await wait(350);
            await leave(ghosts, "wash", { stagger: 40 });
        },
        stream: async (c, colors, style = "blow", opts = {}) => {
            const ghosts = letterGhosts(c.cells);
            stream(rect(c.area), { colors, ...opts });
            await wait(300);
            await leave(ghosts, style, { stagger: 45 });
        },
        meteors: async (c, color = "#ff6a00") => {
            const ghosts = letterGhosts(c.cells), spots = c.cells.length ? c.cells.map(x => mid(x.el)) : [centerOf(c.area)];
            const hits = spots.slice(0, 5).map((p, i) => meteor(p, { color, delay: i * 120 }));
            await hits[0];
            FX.shake(10, 400);
            await Promise.all([...hits, leave(ghosts, "burn", { stagger: 50 })]);
        },
        beam: async (c, color = "#ff6fb5") => {
            beam(c.from, c.to || centerOf(c.area), { color, life: 1.2 });
            await wait(500);
        },
        rays: async (c, color) => { rays(rect(c.area), color ? { color } : {}); glow(centerOf(c.area), { color: "#ffd23f", r: 160, life: 0.9 }); await wait(400); },
        glitch: async c => {
            const ghosts = letterGhosts(c.cells);
            glitchBars(rect(c.area));
            c.area.animate([{ filter: "none" }, { filter: "hue-rotate(90deg) contrast(1.6)", transform: "translateX(-6px)" }, { filter: "hue-rotate(-60deg)", transform: "translateX(5px)" }, { filter: "none" }], { duration: 500 });
            await wait(150);
            await leave(ghosts, "pixel", { stagger: 30 });
        },
        clock: async (c, back = true) => {
            const ghosts = letterGhosts(c.cells);
            clockFace(rect(c.area), { back });
            await wait(400);
            await leave(ghosts, back ? "suck" : "pop", { to: centerOf(c.area), stagger: 90 });
        },
        // something bounces from square to square, knocking letters loose
        bounce: async (c, emoji = "🌰") => {
            const ghosts = letterGhosts(c.cells), pts = c.cells.length ? c.cells.map(x => mid(x.el)) : [centerOf(c.area)];
            const ball = U.el("div", { class: "spell-tool", text: emoji });
            document.body.appendChild(ball);
            U.pin(ball);
            let prev = c.from || { x: pts[0].x, y: pts[0].y - 200 };
            for (let i = 0; i < pts.length; i++) {
                const p = pts[i];
                if (!still()) await ball.animate([{ transform: `translate(${prev.x - 20}px, ${prev.y - 20}px)` }, { transform: `translate(${(prev.x + p.x) / 2 - 20}px, ${Math.min(prev.y, p.y) - 90}px) rotate(180deg)` }, { transform: `translate(${p.x - 20}px, ${p.y - 20}px) rotate(360deg)` }], { duration: 300, easing: "ease-in" }).finished.catch(() => null);
                FX.burst({ x: p.x, y: p.y, n: 10, colors: ["#fff", "#ffd23f", "#a0652c"], shape: "star", speed: [80, 220], gravity: 300, life: [0.3, 0.6], size: [2, 5] });
                Sound.tone({ f: 300 + i * 60, f2: 150, d: 0.12, v: 0.2, boss: true });
                if (ghosts[i]) leave([ghosts[i]], "pop");
                prev = p;
            }
            ball.remove();
            await leave(ghosts.slice(pts.length), "pop");
            await wait(300);
        },
        // an explosion at a point: shockwave, flash, debris
        boom: async (c, color = "#ff9f1c") => {
            const ghosts = letterGhosts(c.cells), p = c.to || centerOf(c.area);
            glow(p, { color, r: 200, life: 0.6 });
            FX.ring && FX.ring({ x: p.x, y: p.y, color, r1: 260, width: 14 });
            FX.burst({ x: p.x, y: p.y, n: 60, colors: [color, "#ffd23f", "#fff", "#2b2233"], shape: "star", speed: [200, 600], gravity: 300, life: [0.5, 1.1], size: [3, 8] });
            FX.shake(14, 500);
            await leave(ghosts, "pop", { stagger: 20 });
        },
        // energy flowing from one point into another (charging, healing, giving letters)
        flow: async (c, colors = ["#ffd23f", "#fff"]) => {
            const to = c.to || centerOf(c.area), from = c.from || to;
            // little comets of energy, each curving up and over on its own path with a glowing tail
            const n = lite() ? 14 : 28, dur = 0.65, gap = 0.022;
            const ps = Array.from({ length: n }, (_, i) => ({ t0: i * gap, mx: (from.x + to.x) / 2 + rnd(-140, 140), my: Math.min(from.y, to.y) - rnd(40, 160), c: colors[i % colors.length], s: rnd(3, 5.5) }));
            const at = (p, q) => { const v = 1 - q; return { x: v * v * from.x + 2 * v * q * p.mx + q * q * to.x, y: v * v * from.y + 2 * v * q * p.my + q * q * to.y }; };
            add({ life: n * gap + dur + 0.05, draw(ctx, k, t) {
                for (const p of ps) {
                    const u = (t - p.t0) / dur;
                    if (u <= 0 || u >= 1) continue;
                    const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2, grow = Math.sin(u * Math.PI) * 0.6 + 0.6;
                    for (let j = 6; j >= 1; j--) { const q = at(p, Math.max(0, e - j * 0.035)); haloAt(ctx, q.x, q.y, p.s * grow * (2.4 - j * 0.22), p.c, (1 - j / 7) * 0.5); }
                    const q = at(p, e);
                    haloAt(ctx, q.x, q.y, p.s * grow * 2.8, p.c, 0.9);
                    ctx.globalAlpha = 1;
                    ctx.fillStyle = "#ffffff";
                    ctx.beginPath(); ctx.arc(q.x, q.y, p.s * grow * 0.5, 0, TAU); ctx.fill();
                }
            } });
            await wait(700);
            glow(to, { color: colors[0], r: 90, life: 0.5 });
            if (c.cells.length) c.cells.forEach(x => x.el && U.restart(x.el, "flip"));
        }
    };

    // Which recipe each ability (A) and boss move (M) uses, with its own colours and props
    const PLAYS = {
        // abilities, aimed at the boss's board
        junk: c => R.splat(c, "#1a1424", "wash"), erase: c => R.scrub(c, "🩹", "smear"), knock: c => R.bounce(c, "🌰"), bury: c => R.stream(c, ["#e07a2e", "#c4561f", "#f2b53c"], "blow", { n: 70, size: [5, 9], gravity: 160 }),
        stutter: c => R.stream(c, ["#ffd23f", "#fff3a0", "#f5c518"], "blow", { n: 160, size: [2, 4], wobble: 3 }), vines: c => R.vines(c), slow: c => R.beam(c, "#ff6fb5"),
        bubble: c => R.flow(c, ["#bdf0ff", "#ffffff"]), undo: c => R.wave(c, true), freeze: c => R.frost(c), delay: c => R.stream(c, ["#ffffff", "#dff3ff"], "blow", { n: 200, size: [2, 4], wobble: 2 }),
        wash: c => R.splat(c, "rgba(60, 140, 230, .8)", "wash"), counter: c => R.lightning(c), scatter: c => R.stream(c, ["#d8f0ff", "#ffffff"], "blow", { n: 90, size: [6, 2] }),
        sand: c => R.stream(c, ["#d9a35c", "#c48a45", "#ecc68e"], "blow", { n: 180, size: [2, 4] }), quicksand: c => R.vortex(c, "#b9823e"), blind: c => R.splat(c, "#fff6e0", "smear"),
        hypno: c => R.vortex(c, "#ff4d6d"), crash: c => R.flow(c, ["#ff9ed2", "#ffffff"]), chomp: () => Promise.resolve(), calm: c => R.stream(c, ["#c9b8ff", "#ffffff"], "blow", { n: 60, size: [3, 6], wobble: 3 }),
        haunt: c => R.flow(c, ["#cfc6ff", "#ffffff"]), ghost: c => R.flow(c, ["#a99bff", "#ffffff"]), lavafloor: c => R.wave(c, true), blackhole: c => R.vortex(c, "#6b4dff"),
        reverse: c => R.clock(c, true), wormhole: c => R.vortex(c, "#c06bff"),
        // abilities that help you, on your board
        shield: c => R.flow(c, ["#ffffff", "#f1ead8"]), sun: c => R.rays(c), hint: c => R.flow(c, ["#ffd23f", "#c98a4b"]), super: c => R.flow(c, ["#ff5fa2", "#ffd23f"]),
        reflect: c => R.flow(c, ["#b46cff", "#ffffff"]), cleanse: c => R.wave(c, false), armor: c => R.frost(c), lucky: c => R.rays(c, "rgba(255, 123, 156, .45)"),
        silver: c => R.rays(c, "rgba(220, 230, 245, .6)"), time: c => R.clock(c, false), check: c => R.rays(c, "rgba(255, 207, 122, .5)"), cheat: c => R.glitch(c),
        extralife: c => R.flow(c, ["#4fdf6b", "#ffffff"]), autofill: c => R.flow(c, ["#9aa7b8", "#ffffff"]), overclock: c => R.lightning(c), firewall: c => R.rays(c, "rgba(255, 122, 61, .5)"),
        hot: c => R.rays(c, "rgba(255, 90, 31, .55)"), fireup: c => R.flow(c, ["#ff9f1c", "#ffd23f"]),
        // boss moves, aimed at your board
        "m-lightning": c => R.lightning(c), "m-rubout": c => R.scrub(c, "🧽", "smear"), "m-acorns": c => R.bounce(c, "🌰"), "m-eruption": c => R.meteors(c, "#ff6a00"),
        "m-glitch": c => R.glitch(c), "m-lag": c => R.clock(c, true), "m-collapse": c => R.vortex(c, "#8a6bff"), "m-quake": c => R.meteors(c, "#a0a0a0"), "m-wordthief": c => R.bounce(c, "🪑"),
        "m-unlock": c => R.glitch(c), "m-shift": c => R.stream(c, ["#d9a35c", "#ecc68e"], "blow", { n: 120 }), "m-ink": c => R.splat(c, "#1a1424", "wash"), "m-sour": c => R.splat(c, "#b8e04a", "wash"),
        "m-freeze": c => R.frost(c), "m-whiteout": c => R.stream(c, ["#ffffff", "#e8f4ff"], "blow", { n: 220, size: [3, 5], wobble: 2 }), "m-avalanche": c => R.stream(c, ["#ffffff", "#dfeefa"], "wash", { n: 200, size: [4, 7], gravity: 300 }),
        "m-petals": c => R.stream(c, ["#ffc1d9", "#ff8fb8", "#ffffff"], "blow", { n: 90, size: [5, 8], wobble: 3 }), "m-sandblast": c => R.stream(c, ["#d9a35c", "#c48a45"], "blow", { n: 180 }),
        "m-gale": c => R.stream(c, ["#e8f4ff", "#ffffff"], "blow", { n: 80, size: [10, 2] }), "m-downpour": c => R.stream(c, ["#7fb2ff", "#c9e0ff"], "wash", { n: 160, size: [1, 8], gravity: 500 }),
        "m-tidal": c => R.wave(c, false), "m-halffog": c => R.wave(c, true), "m-whirl": c => R.vortex(c, "#2a8fd6"), "m-gravity": c => R.vortex(c, "#6b4dff"), "m-vowels": c => R.vortex(c, "#2b2233"),
        "m-heatwave": c => R.rays(c, "rgba(255, 90, 31, .5)"), "m-flare": c => R.rays(c, "rgba(255, 245, 200, .8)"), "m-static": c => R.glitch(c), "m-mask": c => R.glitch(c), "m-numberless": c => R.glitch(c),
        "m-inkblot": c => R.splat(c, "#1a1424", "wash"), "m-confetti": c => R.stream(c, ["#ff5c6c", "#ffd23f", "#4fc3f7", "#7be36b", "#c08bff"], "blow", { n: 160, size: [4, 7], wobble: 2, gravity: 120 }),
        "m-bomb": c => R.flow(c, ["#2b2233", "#ff9f1c"]), "m-thorns": c => R.vines(c), "m-minion": c => R.flow(c, ["#7be36b", "#3fbf6b"]), "m-heal": c => R.flow(c, ["#ff6a00", "#ffd23f"]),
        "m-darkcreep": c => R.stream(c, ["#1a1530", "#2b2450"], "blow", { n: 120, size: [6, 10] }), "m-shatter": c => R.frost(c), "m-crumple": c => R.scrub(c, "🗞️", "smear"), "m-fakecheck": c => R.scrub(c, "🖍️", "smear")
    };
    // play one: resolves when the effect is done (abilities and moves keep their old flying shot, swarm and banner too)
    async function play(kind, ctx) {
        const fn = PLAYS[kind];
        if (!fn || still()) { ctx.cells.forEach(() => {}); return; }
        const prev = aim;
        if (ctx.area instanceof Element) aim = ctx.area;             // its effects follow what it's aimed at
        try { await fn({ cells: [], ...ctx }); } catch (err) { console.error("spell", kind, err); }
        finally { if (aim === ctx.area) aim = prev; }
    }
    const has = kind => !!PLAYS[kind];
    // for spells-abilities.js: the drawing kit, and a way to give a kind its own effect
    const kit = { add, wait, rect, mid, rnd, jag, stroke, strokePlain, haloAt, tint, fade, bolt, glow, splat, vine, vortex, frost, wave, stream, meteor, beam, rays, glitchBars, clockFace, letterGhosts, leave, R,
        still, lite, get dpr() { return dpr; } };
    const define = (kind, fn) => { PLAYS[kind] = fn; };
    return { play, has, define, kit, bolt, glow, splat, vine, vortex, frost, wave, stream, meteor, beam, rays };
})();
