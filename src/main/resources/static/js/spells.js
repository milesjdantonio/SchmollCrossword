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
    // Effects stay on what they were aimed at when the page scrolls: each remembers the scroll position it started at,
    // and is drawn shifted by however far the page has moved since (fixed: true for one that measures live positions)
    function add(fx) {
        if (still()) return;
        ensure();
        fx.t = 0;
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
        const now_ = effects, sx = scrollX, sy = scrollY;
        effects = [];
        const kept = now_.filter(fx => { fx.t += dt; const alive = fx.t < fx.life; if (alive) { g.save(); if (!fx.fixed) g.translate(fx.sx - sx, fx.sy - sy); try { fx.draw(g, fx.t / fx.life, fx.t); } catch (err) { console.error("spell", err); fx.life = 0; } g.restore(); } return alive; });
        effects = kept.concat(effects);
        if (effects.length) requestAnimationFrame(loop);
        else { running = false; g.clearRect(0, 0, innerWidth, innerHeight); }
    }
    const wait = ms => new Promise(r => setTimeout(r, still() ? 0 : ms));
    const rect = el => el.getBoundingClientRect();
    const mid = el => { const r = rect(el); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    const rnd = (a, b) => a + Math.random() * (b - a);

    // ---- drawing helpers ----
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
    // a lightning bolt between two points: it flickers (redrawn jagged every few frames), branches, and fades
    function bolt(a, b, { color = "#bfe8ff", core = "#ffffff", width = 4, life = 0.55, branches = 3 } = {}) {
        let pts = jag(a, b), forks = [], frame = 0;
        const makeForks = () => {
            forks = [];
            for (let i = 0; i < branches; i++) {
                const p = pts[Math.floor(rnd(0.2, 0.8) * pts.length)], ang = Math.atan2(b.y - a.y, b.x - a.x) + rnd(-1.1, 1.1), len = Math.hypot(b.x - a.x, b.y - a.y) * rnd(0.15, 0.35);
                forks.push(jag(p, { x: p.x + Math.cos(ang) * len, y: p.y + Math.sin(ang) * len }, 0.4, 4));
            }
        };
        makeForks();
        add({ life, draw(ctx, k) {
            if (frame++ % 3 === 0) { pts = jag(a, b); makeForks(); }
            const alpha = k < 0.15 ? 1 : (1 - k) * (0.6 + Math.random() * 0.4);
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = alpha;
            stroke(ctx, pts, width * 2.6, color);
            for (const f of forks) stroke(ctx, f, width, color);
            ctx.globalAlpha = alpha;
            stroke(ctx, pts, width * 0.9, core, color);
        } });
    }
    // a soft glow that pops at a point
    function glow(p, { color = "#fff", r = 90, life = 0.5 } = {}) {
        add({ life, draw(ctx, k) {
            const rad = r * (0.4 + k * 0.8), grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
            grad.addColorStop(0, color); grad.addColorStop(1, "transparent");
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = 1 - k;
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, 6.3); ctx.fill();
        } });
    }
    // a blob splat (ink, pie, goo, paint) with drips, that stays a moment then fades
    function splat(p, { color = "#1a1424", r = 40, life = 1.6, drips = 4 } = {}) {
        const pts = [], n = 14;
        for (let i = 0; i < n; i++) pts.push(r * rnd(0.6, 1.15));
        const dl = []; for (let i = 0; i < drips; i++) dl.push({ x: rnd(-r * 0.7, r * 0.7), len: rnd(r * 0.5, r * 1.4), w: rnd(4, 9) });
        add({ life, draw(ctx, k) {
            const grow = Math.min(1, k * 6), fade = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
            ctx.globalAlpha = fade;
            ctx.fillStyle = color;
            ctx.beginPath();
            for (let i = 0; i <= n; i++) {
                const a = (i / n) * Math.PI * 2, rr = pts[i % n] * grow;
                const x = p.x + Math.cos(a) * rr, y = p.y + Math.sin(a) * rr;
                i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            }
            ctx.fill();
            for (const d of dl) { ctx.fillRect(p.x + d.x - d.w / 2, p.y, d.w, d.len * Math.min(1, k * 2)); ctx.beginPath(); ctx.arc(p.x + d.x, p.y + d.len * Math.min(1, k * 2), d.w * 0.8, 0, 6.3); ctx.fill(); }
        } });
    }
    // a growing vine from a to b, with leaves
    function vine(a, b, { color = "#2f9e4f", leaf = "#7be36b", life = 1.8 } = {}) {
        const c1 = { x: a.x + (b.x - a.x) * 0.3 + rnd(-60, 60), y: a.y + (b.y - a.y) * 0.3 + rnd(-60, 60) }, c2 = { x: a.x + (b.x - a.x) * 0.7 + rnd(-50, 50), y: a.y + (b.y - a.y) * 0.7 + rnd(-50, 50) };
        const at = s => { const u = 1 - s; return { x: u * u * u * a.x + 3 * u * u * s * c1.x + 3 * u * s * s * c2.x + s * s * s * b.x, y: u * u * u * a.y + 3 * u * u * s * c1.y + 3 * u * s * s * c2.y + s * s * s * b.y }; };
        add({ life, draw(ctx, k) {
            const grow = Math.min(1, k * 2.2), fade = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
            ctx.globalAlpha = fade;
            ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.lineCap = "round";
            ctx.beginPath();
            for (let s = 0; s <= grow; s += 0.02) { const q = at(s); s ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }
            ctx.stroke();
            ctx.fillStyle = leaf;
            for (let s = 0.15; s < grow; s += 0.17) {
                const q = at(s), q2 = at(Math.min(1, s + 0.01)), ang = Math.atan2(q2.y - q.y, q2.x - q.x) + (Math.round(s * 10) % 2 ? 1 : -1) * 1.1;
                ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(ang); ctx.beginPath(); ctx.ellipse(9, 0, 9, 4, 0, 0, 6.3); ctx.fill(); ctx.restore();
            }
        } });
    }
    // a vortex: spinning arms around a point, getting smaller
    function vortex(p, { color = "#6b4dff", r = 120, life = 1.4, arms = 5 } = {}) {
        add({ life, draw(ctx, k, t) {
            const rad = r * (1 - k * 0.6);
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = Math.sin(k * Math.PI);
            for (let i = 0; i < arms; i++) {
                ctx.beginPath();
                for (let s = 0; s < 1; s += 0.03) {
                    const a = t * 6 + i * (Math.PI * 2 / arms) + s * 4, rr = rad * (1 - s);
                    const x = p.x + Math.cos(a) * rr, y = p.y + Math.sin(a) * rr * 0.75;
                    s ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
                }
                ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.shadowColor = color; ctx.shadowBlur = 16; ctx.stroke();
            }
            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad * 0.35);
            grad.addColorStop(0, "#000"); grad.addColorStop(1, "transparent");
            ctx.globalCompositeOperation = "source-over";
            ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(p.x, p.y, rad * 0.35, 0, 6.3); ctx.fill();
        } });
    }
    // frost: crystal lines spreading out from a point across an area
    function frost(p, area, { color = "#cfeeff", life = 1.6 } = {}) {
        const lines = [];
        const reach = Math.max(area.width, area.height) * 0.8;
        for (let i = 0; i < 18; i++) {
            const a = (i / 18) * Math.PI * 2 + rnd(-0.15, 0.15), len = reach * rnd(0.45, 1);
            lines.push(jag(p, { x: p.x + Math.cos(a) * len, y: p.y + Math.sin(a) * len }, 0.18, 4));
        }
        add({ life, draw(ctx, k) {
            const grow = Math.min(1, k * 2.5), fade = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
            ctx.save();
            ctx.beginPath(); ctx.rect(area.left - 6, area.top - 6, area.width + 12, area.height + 12); ctx.clip();
            ctx.globalAlpha = fade * 0.95;
            for (const l of lines) {
                const n = Math.max(2, Math.floor(l.length * grow));
                stroke(ctx, l.slice(0, n), 2, color, "#8fd8ff");
            }
            ctx.globalAlpha = fade * 0.35 * grow;
            ctx.fillStyle = "#e8f7ff"; ctx.fillRect(area.left, area.top, area.width, area.height);
            ctx.restore();
        } });
    }
    // a wave of water sweeping across an area (dir 1 = left to right, -1 = up from the bottom)
    function wave(area, { color = "rgba(60, 150, 230, .75)", foam = "#e8f7ff", life = 1.2, up = false } = {}) {
        add({ life, draw(ctx, k, t) {
            ctx.save();
            ctx.beginPath(); ctx.rect(area.left - 10, area.top - 10, area.width + 20, area.height + 20); ctx.clip();
            const e = Math.sin(k * Math.PI);
            ctx.fillStyle = color;
            ctx.beginPath();
            if (up) {
                const top = area.bottom - area.height * e * 1.05;
                ctx.moveTo(area.left - 10, area.bottom + 10);
                for (let x = area.left - 10; x <= area.right + 10; x += 8) ctx.lineTo(x, top + Math.sin(x / 22 + t * 9) * 9);
                ctx.lineTo(area.right + 10, area.bottom + 10);
            } else {
                const front = area.left - 40 + (area.width + 80) * Math.min(1, k * 1.6);
                ctx.moveTo(area.left - 10, area.top - 10);
                for (let y = area.top - 10; y <= area.bottom + 10; y += 8) ctx.lineTo(front + Math.sin(y / 18 + t * 10) * 14, y);
                ctx.lineTo(area.left - 10, area.bottom + 10);
            }
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = foam; ctx.lineWidth = 4; ctx.globalAlpha = 0.8; ctx.stroke();
            ctx.restore();
        } });
    }
    // a stream of particles blowing across an area (sand, leaves, pollen, snow, wind)
    function stream(area, { colors = ["#d9a35c"], n = 120, life = 1.3, dir = 1, size = [2, 5], wobble = 1, gravity = 0 } = {}) {
        const ps = [];
        for (let i = 0; i < (lite() ? n / 2 : n); i++) ps.push({ x: dir > 0 ? area.left - rnd(0, 200) : area.right + rnd(0, 200), y: rnd(area.top - 20, area.bottom + 20), v: rnd(380, 720), s: rnd(...size), c: colors[i % colors.length], ph: rnd(0, 6) });
        add({ life, draw(ctx, k, t) {
            ctx.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1;
            for (const p of ps) {
                const x = p.x + dir * p.v * t, y = p.y + Math.sin(t * 8 + p.ph) * 10 * wobble + gravity * t * t;
                ctx.fillStyle = p.c; ctx.fillRect(x, y, p.s * 2, p.s);
            }
        } });
    }
    // things falling from the top of the screen onto points (meteors, lava bombs, hail)
    function meteor(p, { color = "#ff6a00", tail = "#ffd23f", life = 0.55, delay = 0 } = {}) {
        const start = { x: p.x + rnd(-160, 160), y: -40 };
        return new Promise(resolve => setTimeout(() => {
            add({ life, draw(ctx, k) {
                const x = start.x + (p.x - start.x) * k, y = start.y + (p.y - start.y) * k * k;
                const grad = ctx.createLinearGradient(start.x, start.y, x, y);
                grad.addColorStop(0, "transparent"); grad.addColorStop(1, tail);
                ctx.globalCompositeOperation = "lighter";
                ctx.strokeStyle = grad; ctx.lineWidth = 10; ctx.lineCap = "round";
                ctx.beginPath(); ctx.moveTo(x - (p.x - start.x) * 0.35, y - (p.y - start.y) * 0.35); ctx.lineTo(x, y); ctx.stroke();
                ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 20;
                ctx.beginPath(); ctx.arc(x, y, 9, 0, 6.3); ctx.fill();
            } });
            setTimeout(() => { glow(p, { color, r: 70, life: 0.45 }); FX.burst({ x: p.x, y: p.y, n: 18, colors: [color, tail, "#2b2233"], shape: "star", speed: [100, 300], gravity: 400, life: [0.3, 0.7], size: [3, 6] }); resolve(); }, still() ? 0 : life * 1000);
        }, still() ? 0 : delay));
    }
    // a beam between two points that pulses (taffy strands, lasers, energy)
    function beam(a, b, { color = "#ff6fb5", width = 10, life = 1, wobble = 18, strands = 3 } = {}) {
        add({ life, draw(ctx, k, t) {
            ctx.globalAlpha = Math.sin(k * Math.PI);
            ctx.globalCompositeOperation = "lighter";
            for (let s = 0; s < strands; s++) {
                ctx.beginPath();
                for (let i = 0; i <= 30; i++) {
                    const u = i / 30, off = Math.sin(u * Math.PI) * Math.sin(t * 7 + s * 2 + u * 9) * wobble;
                    const x = a.x + (b.x - a.x) * u, y = a.y + (b.y - a.y) * u + off;
                    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
                }
                ctx.strokeStyle = color; ctx.lineWidth = width / (s + 1); ctx.shadowColor = color; ctx.shadowBlur = 18; ctx.stroke();
            }
        } });
    }
    // sun rays turning behind an area
    function rays(area, { color = "rgba(255, 210, 63, .55)", life = 1.6, n = 14 } = {}) {
        const c = { x: area.left + area.width / 2, y: area.top + area.height / 2 }, R = Math.max(area.width, area.height);
        add({ life, draw(ctx, k, t) {
            ctx.globalAlpha = Math.sin(k * Math.PI);
            ctx.globalCompositeOperation = "lighter";
            ctx.translate(c.x, c.y); ctx.rotate(t * 0.8);
            ctx.fillStyle = color;
            for (let i = 0; i < n; i++) { ctx.rotate(Math.PI * 2 / n); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(R, -R * 0.08); ctx.lineTo(R, R * 0.08); ctx.fill(); }
        } });
    }
    // glitch: shifted colour slices over an area
    function glitchBars(area, { life = 0.9 } = {}) {
        add({ life, draw(ctx) {
            for (let i = 0; i < 9; i++) {
                const y = rnd(area.top, area.bottom), h = rnd(4, 18);
                ctx.globalAlpha = rnd(0.3, 0.8);
                ctx.fillStyle = ["#ff2bd6", "#00f0ff", "#ffffff", "#7bff5c"][i % 4];
                ctx.fillRect(area.left + rnd(-30, 30), y, area.width, h);
            }
        } });
    }
    // a clock face spinning (forwards or backwards) over an area
    function clockFace(area, { back = true, color = "#58d6ff", life = 1.3 } = {}) {
        const c = { x: area.left + area.width / 2, y: area.top + area.height / 2 }, R = Math.min(area.width, area.height) * 0.45;
        add({ life, draw(ctx, k, t) {
            ctx.globalAlpha = Math.sin(k * Math.PI) * 0.85;
            ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.shadowColor = color; ctx.shadowBlur = 14;
            ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, 6.3); ctx.stroke();
            for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; ctx.beginPath(); ctx.moveTo(c.x + Math.cos(a) * R * 0.85, c.y + Math.sin(a) * R * 0.85); ctx.lineTo(c.x + Math.cos(a) * R, c.y + Math.sin(a) * R); ctx.stroke(); }
            const s = (back ? -1 : 1) * t * 9;
            ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + Math.cos(s) * R * 0.8, c.y + Math.sin(s) * R * 0.8); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + Math.cos(s / 12) * R * 0.5, c.y + Math.sin(s / 12) * R * 0.5); ctx.stroke();
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
                if (style === "zap" || style === "freeze" || style === "pixel") FX.burst({ x: cx, y: cy, n: 12, colors: style === "pixel" ? ["#ff2bd6", "#00f0ff", "#7bff5c"] : ["#fff", color, "#bfe8ff"], shape: style === "pixel" ? "rect" : "star", speed: [80, 240], gravity: 200, life: [0.25, 0.6], size: [2, 5] });
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
            const n = lite() ? 14 : 28;
            for (let i = 0; i < n; i++) setTimeout(() => {
                const dot = U.el("div", { class: "spell-dot", style: { background: colors[i % colors.length], boxShadow: `0 0 10px ${colors[i % colors.length]}` } });
                document.body.appendChild(dot);
                U.pin(dot);
                const mx = (from.x + to.x) / 2 + rnd(-140, 140), my = Math.min(from.y, to.y) - rnd(40, 160);
                dot.animate([{ transform: `translate(${from.x}px, ${from.y}px) scale(.6)` }, { transform: `translate(${mx}px, ${my}px) scale(1.2)` }, { transform: `translate(${to.x}px, ${to.y}px) scale(.4)` }], { duration: 650, easing: "ease-in-out" }).onfinish = () => dot.remove();
            }, still() ? 0 : i * 22);
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
        try { await fn({ cells: [], ...ctx }); } catch (err) { console.error("spell", kind, err); }
    }
    const has = kind => !!PLAYS[kind];
    // for spells-abilities.js: the drawing kit, and a way to give a kind its own effect
    const kit = { add, wait, rect, mid, rnd, jag, stroke, bolt, glow, splat, vine, vortex, frost, wave, stream, meteor, beam, rays, glitchBars, clockFace, letterGhosts, leave, R,
        still, lite, get dpr() { return dpr; } };
    const define = (kind, fn) => { PLAYS[kind] = fn; };
    return { play, has, define, kit, bolt, glow, splat, vine, vortex, frost, wave, stream, meteor, beam, rays };
})();
