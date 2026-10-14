// Every ability's own big effect (the user, 2026-10-09: "the effort you put into the lightning for Thunderhead, I
// want in every ability"). Like the lightning, each one is a little scene aimed at the real target: the squares it
// changes, the boss's board or portrait, your board, your Super meter. It has a source (something thrown, poured,
// grown or cast), a hit, the letters reacting in their own way, physical particles and an aftermath.
//
// Drawn with the kit from spells.js (one full-screen canvas) plus a small physics particle system below.
// Spells.define(kind, recipe) gives each ability kind its effect; c = { cells: [{el, ch}], area, from, to }.
(() => {
    const K = Spells.kit, { add, wait, rect, mid, rnd, jag, stroke, bolt, glow, splat, vine, vortex, letterGhosts, leave } = K;
    const TAU = Math.PI * 2;
    const pick = list => list[Math.floor(Math.random() * list.length)];
    const $ = sel => document.querySelector(sel);
    const lerp = (a, b, k) => a + (b - a) * k;
    const ease = k => 1 - Math.pow(1 - k, 3);
    const portrait = () => $(".bp-portrait") || $(".boss-panel");
    const bossBoard = () => $(".bp-board-wrap") || $(".boss-panel");
    const myBoard = () => $("#board");
    const pts = c => (c.cells.length ? c.cells.filter(x => x.el).map(x => mid(x.el)) : []);
    const cellsOf = sel => [...document.querySelectorAll(sel)];

    // ---- a scene with a real time step (dt), for things that move by physics ----
    function sim(life, fn) { add({ life, prev: 0, draw(ctx, k, t) { const dt = Math.min(0.05, t - this.prev); this.prev = t; fn(ctx, dt, t, k); } }); }

    // ---- particles: little things with velocity, gravity, drag, spin and a shape ----
    //   shapes: dot glow streak drop leaf petal flake star square crumb ring coin heart text ember bubble
    function burst(list) {
        if (!list.length) return;
        const life = Math.max(...list.map(p => (p.delay || 0) + p.life));
        for (const p of list) Object.assign(p, { age: -(p.delay || 0), rot: p.rot ?? rnd(0, TAU), vr: p.vr ?? 0, g: p.g ?? 0, drag: p.drag ?? 0, alpha: p.alpha ?? 1, grow: p.grow ?? 0 });
        sim(life, (ctx, dt) => {
            for (const p of list) {
                p.age += dt;
                if (p.age < 0 || p.age > p.life) continue;
                p.vy += p.g * dt; p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt;
                if (p.wob) p.vx += Math.sin(p.age * p.wob[0] + p.ph) * p.wob[1] * dt;
                p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
                const k = p.age / p.life, a = p.alpha * (p.fadeIn ? Math.min(1, p.age / p.fadeIn) : 1) * (k > 0.6 ? (1 - k) / 0.4 : 1);
                draw(ctx, p, a, p.size * (1 + p.grow * k));
            }
        });
    }
    // How each particle looks (redone 2026-10-10, the user: "make large adjustments to every particle"): glows and
    // embers use the cached glow sprites from fx.js (cheaper than shadow blurs), stars twinkle, streaks fade at the
    // tail with a bright head, drops and hearts have a shine, leaves and petals have veins and light, confetti squares
    // show a darker back as they flip, coins spin with a rim and a glint, bubbles have a rainbow rim, dots are shaded.
    const A = () => FX.art;
    let rimGrad = null;
    function halo0(ctx, r, color, a = 1) {                  // a glow centred where the particle is (lighter blend)
        if (r < 0.8) return;
        const op = ctx.globalCompositeOperation, ga = ctx.globalAlpha;
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = ga * a;
        ctx.drawImage(A().halo(color), -r, -r, r * 2, r * 2);
        ctx.globalCompositeOperation = op;
        ctx.globalAlpha = ga;
    }
    const shade = (p, key, k) => p[key] || (p[key] = A().tint(p.color, k));
    function draw(ctx, p, a, s) {
        if (s <= 0.05 || a <= 0.005) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, a);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color; ctx.strokeStyle = p.color;
        if (p.add) ctx.globalCompositeOperation = "lighter";
        if (p.glow) halo0(ctx, s * 3, p.glow, 0.7);
        switch (p.shape) {
            case "glow": halo0(ctx, s * 1.2, p.color, 1); if (p.add) { ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.beginPath(); ctx.arc(0, 0, s * 0.18, 0, TAU); ctx.fill(); } break;
            case "streak": {                                // a streak that fades at its tail, with a bright head
                ctx.rotate(-p.rot + Math.atan2(p.vy, p.vx));
                const gr = ctx.createLinearGradient(-s * 3.4, 0, 0, 0);
                gr.addColorStop(0, A().fade(p.color, 0)); gr.addColorStop(1, p.color);
                ctx.fillStyle = gr;
                ctx.beginPath(); ctx.moveTo(-s * 3.4, 0); ctx.lineTo(0, -s * 0.3); ctx.lineTo(s * 0.25, 0); ctx.lineTo(0, s * 0.3); ctx.closePath(); ctx.fill();
                ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.beginPath(); ctx.arc(0, 0, s * 0.2, 0, TAU); ctx.fill();
                break;
            }
            case "drop":                                    // a teardrop with a shine
                ctx.rotate(-p.rot + Math.atan2(p.vy, p.vx) - Math.PI / 2);
                ctx.beginPath(); ctx.moveTo(0, s * 1.6); ctx.quadraticCurveTo(s, 0, 0, -s * 0.6); ctx.quadraticCurveTo(-s, 0, 0, s * 1.6); ctx.fill();
                ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.beginPath(); ctx.ellipse(-s * 0.26, s * 0.4, s * 0.15, s * 0.32, 0.25, 0, TAU); ctx.fill();
                break;
            case "leaf": {                                  // a pointed leaf, lit on one half, with a vein and a stem
                ctx.beginPath(); ctx.moveTo(-s, 0); ctx.quadraticCurveTo(-s * 0.1, -s * 0.55, s, 0); ctx.quadraticCurveTo(-s * 0.1, s * 0.55, -s, 0); ctx.fill();
                ctx.globalAlpha = Math.max(0, a) * 0.35; ctx.fillStyle = shade(p, "_l", 0.45);
                ctx.beginPath(); ctx.moveTo(-s, 0); ctx.quadraticCurveTo(-s * 0.1, -s * 0.55, s, 0); ctx.closePath(); ctx.fill();
                ctx.globalAlpha = Math.max(0, a);
                ctx.strokeStyle = "rgba(0,0,0,.28)"; ctx.lineWidth = Math.max(0.6, s * 0.09);
                ctx.beginPath(); ctx.moveTo(-s * 1.25, 0); ctx.lineTo(s * 0.85, 0);
                for (const x of [-0.4, 0.1]) for (const side of [-1, 1]) { ctx.moveTo(x * s, 0); ctx.lineTo((x + 0.3) * s, side * s * 0.26); }
                ctx.stroke();
                break;
            }
            case "petal":                                   // a petal with a notch at the tip and light near it
                ctx.beginPath(); ctx.moveTo(-s, 0);
                ctx.bezierCurveTo(-s * 0.6, -s * 0.75, s * 0.75, -s * 0.7, s, -s * 0.12); ctx.lineTo(s * 0.8, 0); ctx.lineTo(s, s * 0.12);
                ctx.bezierCurveTo(s * 0.75, s * 0.7, -s * 0.6, s * 0.75, -s, 0); ctx.fill();
                ctx.globalAlpha = Math.max(0, a) * 0.5; ctx.fillStyle = shade(p, "_l", 0.5);
                ctx.beginPath(); ctx.ellipse(s * 0.28, -s * 0.1, s * 0.46, s * 0.2, 0, 0, TAU); ctx.fill();
                break;
            case "flake": ctx.drawImage(A().flake(p.color), -s * 2, -s * 2, s * 4, s * 4); break;
            case "star": {                                  // it twinkles, with a bright middle and a soft glow
                const tw = 1 + Math.sin(p.age * 13 + (p.ph || 0) * 3) * 0.16, r = s * tw;
                ctx.drawImage(A().starImg(p.color, shade(p, "_l", 0.5), !!p.add), -r * 2, -r * 2, r * 4, r * 4);
                break;
            }
            case "square": {                                // a scrap of paper tumbling: its back is a shade darker
                const f = Math.cos(p.age * 9 + (p.ph || 0));
                ctx.scale(Math.abs(f) * 0.8 + 0.2, 1);
                ctx.fillStyle = f >= 0 ? p.color : shade(p, "_d", -0.3);
                ctx.fillRect(-s / 2, -s / 2, s, s);
                if (f > 0.4) { ctx.fillStyle = "rgba(255,255,255,.4)"; ctx.fillRect(-s / 2, -s / 2, s, s * 0.22); }
                break;
            }
            case "crumb":                                   // a chip with a lit edge
                ctx.beginPath(); ctx.moveTo(-s, -s * 0.4); ctx.lineTo(s * 0.6, -s * 0.7); ctx.lineTo(s, s * 0.5); ctx.lineTo(-s * 0.4, s * 0.7); ctx.closePath(); ctx.fill();
                ctx.strokeStyle = "rgba(255,255,255,.4)"; ctx.lineWidth = Math.max(0.5, s * 0.18);
                ctx.beginPath(); ctx.moveTo(-s, -s * 0.4); ctx.lineTo(s * 0.6, -s * 0.7); ctx.stroke();
                break;
            case "ring":                                    // a ring with a thin bright ring inside it
                ctx.lineWidth = Math.max(1, s * 0.15); ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.stroke();
                ctx.globalAlpha = Math.max(0, a) * 0.6; ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = Math.max(0.6, s * 0.05);
                ctx.beginPath(); ctx.arc(0, 0, Math.max(0.5, s * 0.84), 0, TAU); ctx.stroke();
                break;
            case "bubble": {                                // a rainbow rim and two highlights
                if (!rimGrad) { rimGrad = ctx.createLinearGradient(-1, -1, 1, 1); rimGrad.addColorStop(0, "rgba(255,255,255,.95)"); rimGrad.addColorStop(0.42, "rgba(255,190,240,.95)"); rimGrad.addColorStop(0.68, "rgba(180,255,235,.95)"); rimGrad.addColorStop(1, "rgba(255,255,255,.95)"); }
                ctx.save(); ctx.scale(s, s);
                ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU);
                ctx.globalAlpha = Math.max(0, a) * 0.14; ctx.fillStyle = "#ffffff"; ctx.fill();
                ctx.globalAlpha = Math.max(0, a); ctx.strokeStyle = rimGrad; ctx.lineWidth = Math.max(1.4 / s, 0.1); ctx.stroke();
                ctx.restore();
                ctx.fillStyle = "rgba(255,255,255,.88)"; ctx.beginPath(); ctx.ellipse(-s * 0.36, -s * 0.38, s * 0.22, s * 0.13, -0.7, 0, TAU); ctx.fill();
                ctx.beginPath(); ctx.arc(s * 0.4, s * 0.42, s * 0.08, 0, TAU); ctx.fill();
                break;
            }
            case "coin": {                                  // it spins: a gold face with a rim and a glint, its edge when it's side on
                const f = Math.cos(p.age * 9);
                ctx.scale(Math.abs(f) + 0.1, 1);
                ctx.fillStyle = Math.abs(f) < 0.3 ? "#a8780f" : p.color;
                ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill();
                ctx.strokeStyle = "#b8860b"; ctx.lineWidth = Math.max(1, s * 0.16); ctx.stroke();
                ctx.strokeStyle = "rgba(255,240,170,.8)"; ctx.lineWidth = Math.max(0.6, s * 0.08);
                ctx.beginPath(); ctx.arc(0, 0, s * 0.62, 0, TAU); ctx.stroke();
                ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.beginPath(); ctx.ellipse(-s * 0.35, -s * 0.35, s * 0.18, s * 0.1, -0.7, 0, TAU); ctx.fill();
                break;
            }
            case "heart":                                   // a heart with a shine on one side
                ctx.beginPath(); ctx.moveTo(0, s * 0.8); ctx.bezierCurveTo(-s * 1.4, -s * 0.2, -s * 0.5, -s * 1.1, 0, -s * 0.3); ctx.bezierCurveTo(s * 0.5, -s * 1.1, s * 1.4, -s * 0.2, 0, s * 0.8); ctx.fill();
                ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.beginPath(); ctx.ellipse(-s * 0.42, -s * 0.38, s * 0.18, s * 0.11, -0.7, 0, TAU); ctx.fill();
                break;
            case "text":
                ctx.rotate(-p.rot * 0.2);
                if (!p.font) { const w = s * 80 / 56; ctx.drawImage(A().text(p.text, p.color), -w / 2, -w / 2, w, w); }
                else { ctx.font = `900 ${s}px ${p.font}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(p.text, 0, 0); }
                break;
            case "ember":                                   // a hot glowing spark, white in the middle
                halo0(ctx, s * 2.4, p.color, 1);
                ctx.globalCompositeOperation = "lighter";
                ctx.fillStyle = "rgba(255,250,230,.95)"; ctx.beginPath(); ctx.arc(0, 0, s * 0.42, 0, TAU); ctx.fill();
                break;
            default:                                        // a dot: a shaded little ball
                if (s < 2.5 || p.add) { ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill(); }
                else ctx.drawImage(A().ball(p.color), -s, -s, s * 2, s * 2);
        }
        ctx.restore();
    }
    // n particles from a point (or from a spread around it)
    function spray(at, n, o) {
        const list = [];
        for (let i = 0; i < (K.lite() ? Math.ceil(n / 2) : n); i++) {
            const a = (o.angle ?? rnd(0, TAU)) + rnd(-(o.spread ?? Math.PI), o.spread ?? Math.PI), v = rnd(...(o.speed || [80, 260]));
            list.push({ x: at.x + rnd(-(o.jitter || 0), o.jitter || 0), y: at.y + rnd(-(o.jitter || 0), o.jitter || 0), vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(...(o.life || [0.5, 1.1])),
                size: rnd(...(o.size || [2, 5])), color: Array.isArray(o.color) ? pick(o.color) : o.color, shape: o.shape, g: o.g ?? 300, drag: o.drag ?? 0.6, vr: rnd(-(o.spin || 4), o.spin || 4),
                delay: o.delay ? rnd(0, o.delay) : 0, glow: o.glow, add: o.add, wob: o.wob, ph: rnd(0, 6), text: o.text ? pick(o.text) : null, alpha: o.alpha ?? 1, grow: o.grow ?? 0, fadeIn: o.fadeIn });
        }
        burst(list);
    }
    // a shockwave ring
    // (a soft wide glow, the ring, and a thin bright ring just inside it)
    function ring(p, { color = "#fff", r = 120, life = 0.6, width = 8 } = {}) {
        add({ life, draw(ctx, k) {
            const rr = r * ease(k), w = width * (1 - k) + 1;
            ctx.globalCompositeOperation = "lighter";
            ctx.strokeStyle = color;
            ctx.globalAlpha = (1 - k) * 0.3; ctx.lineWidth = w * 2.8; ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, TAU); ctx.stroke();
            ctx.globalAlpha = 1 - k; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, TAU); ctx.stroke();
            ctx.globalAlpha = (1 - k) * 0.7; ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = Math.max(1, w * 0.28);
            ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, rr - w * 0.9), 0, TAU); ctx.stroke();
        } });
    }
    // something flying along an arc (a parabola) from a to b, drawn by drawFn(ctx, x, y, k, t); resolves when it lands
    function lob(a, b, { life = 0.65, height = 160, drawFn, trail } = {}) {
        return new Promise(resolve => {
            if (K.still()) return resolve();
            const path = [];
            add({ life, draw(ctx, k, t) {
                const x = lerp(a.x, b.x, k), y = lerp(a.y, b.y, k) - Math.sin(k * Math.PI) * height;
                if (trail) { path.push([x, y]); if (path.length > 14) path.shift(); ctx.globalAlpha = 1; path.forEach(([px, py], i) => K.haloAt(ctx, px, py, 4 + i * 0.7, trail, i / path.length * 0.6)); ctx.globalAlpha = 1; }
                drawFn(ctx, x, y, k, t);
            } });
            setTimeout(resolve, life * 1000);
        });
    }
    const flash = (color, ms = 220, o = 0.4) => FX.flash(color, ms, o);
    const tone = (o) => Sound.tone({ ...o, boss: true });         // (at the ability's level: Sound.bossLevel)

    // ---- drawn props ----
    function drawEraser(ctx, x, y, ang) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
        ctx.fillStyle = "#ff9fb4"; ctx.strokeStyle = "#2b2233"; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.roundRect(-34, -16, 40, 32, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#4f86d9"; ctx.beginPath(); ctx.roundRect(4, -17, 34, 34, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.fillRect(-30, -12, 30, 5);
        ctx.restore();
    }
    function drawBottle(ctx, x, y, ang) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.strokeStyle = "#2b2233"; ctx.lineWidth = 2.5;
        ctx.fillStyle = "#1d1a2e"; ctx.beginPath(); ctx.roundRect(-16, -14, 32, 34, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#3a3355"; ctx.fillRect(-8, -24, 16, 11); ctx.strokeRect(-8, -24, 16, 11);
        ctx.fillStyle = "#f6ecd2"; ctx.fillRect(-11, -2, 22, 12); ctx.fillStyle = "#2b2233"; ctx.font = "900 8px sans-serif"; ctx.textAlign = "center"; ctx.fillText("INK", 0, 7);
        ctx.restore();
    }
    function drawAcorn(ctx, x, y, s, rot) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.strokeStyle = "#2b2233"; ctx.lineWidth = 2;
        ctx.fillStyle = "#b5732e"; ctx.beginPath(); ctx.ellipse(0, s * 0.25, s * 0.75, s * 0.9, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#6b4219"; ctx.beginPath(); ctx.ellipse(0, -s * 0.35, s * 0.95, s * 0.5, 0, Math.PI, TAU); ctx.lineTo(s * 0.95, -s * 0.35); ctx.fill(); ctx.stroke();
        ctx.fillRect(-1.5, -s * 1.05, 3, s * 0.35);
        ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.ellipse(-s * 0.3, s * 0.1, s * 0.15, s * 0.35, 0.3, 0, TAU); ctx.fill();
        ctx.restore();
    }
    function drawSnowball(ctx, x, y, s, rot) {
        const g = ctx.createRadialGradient(x - s * 0.3, y - s * 0.3, 0, x, y, s); g.addColorStop(0, "#fff"); g.addColorStop(0.7, "#eef7ff"); g.addColorStop(1, "#b9d8ef");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = "rgba(150,190,220,.5)"; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(Math.cos(i * 1.7) * s * 0.5, Math.sin(i * 1.7) * s * 0.5, s * 0.12, 0, TAU); ctx.fill(); } ctx.restore();
    }
    function drawPie(ctx, x, y, s, rot) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.strokeStyle = "#2b2233"; ctx.lineWidth = 2;
        ctx.fillStyle = "#d9a35c"; ctx.beginPath(); ctx.ellipse(0, 4, s, s * 0.45, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#fffaf0"; ctx.beginPath(); for (let i = 0; i <= 12; i++) { const a = Math.PI + i / 12 * Math.PI; ctx.lineTo(Math.cos(a) * s * 0.95, Math.sin(a) * s * 0.75 - (i % 2 ? 6 : 0)); } ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#e2283c"; ctx.beginPath(); ctx.arc(0, -s * 0.6, s * 0.16, 0, TAU); ctx.fill();
        ctx.restore();
    }
    function drawGumdrop(ctx, x, y, w, h, wob, color) {
        ctx.save(); ctx.translate(x, y); ctx.scale(1 + wob, 1 - wob);
        const g = ctx.createLinearGradient(0, -h, 0, 0); g.addColorStop(0, "rgba(255,255,255,.55)"); g.addColorStop(0.25, color); g.addColorStop(1, color);
        ctx.fillStyle = g; ctx.globalAlpha *= 0.55; ctx.beginPath(); ctx.moveTo(-w, 0); ctx.bezierCurveTo(-w, -h * 1.2, w, -h * 1.2, w, 0); ctx.closePath(); ctx.fill();
        ctx.globalAlpha /= 0.55; ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.beginPath(); ctx.ellipse(-w * 0.45, -h * 0.6, w * 0.12, h * 0.22, -0.5, 0, TAU); ctx.fill();
        for (let i = 0; i < 18; i++) { ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.fillRect(Math.cos(i * 2.4) * w * 0.7, -h * 0.4 + Math.sin(i * 3.1) * h * 0.3, 2, 2); }
        ctx.restore();
    }

    // shared with spells-moves.js (the boss's moves use the same kit)
    Object.assign(K, { TAU, pick, $, lerp, ease, portrait, bossBoard, myBoard, pts, cellsOf, sim, burst, spray, ring, lob, flash,
        drawEraser, drawBottle, drawAcorn, drawSnowball, drawPie, drawGumdrop, drawParticle: draw });

    // =========================================================================================
    // The abilities
    // =========================================================================================
    const D = Spells.define;

    // ---- Notebook ----
    // Ink Splat: an ink bottle sails over and tips; a black stream pours onto the squares the boss is about to write
    D("junk", async c => {
        const area = rect(c.area), targets = cellsOf(".bp-cell.cur:not(.block)").slice(0, 5).map(mid);
        const spots = targets.length ? targets : [mid(c.area)];
        const over = { x: area.left + area.width / 2, y: area.top - 50 };
        await lob(c.from, over, { life: 0.6, height: 200, drawFn: (ctx, x, y, k) => drawBottle(ctx, x, y, k * 2.6) });
        for (let i = 0; i < spots.length; i++) {
            const p = spots[i];
            add({ life: 0.32, draw(ctx, k) {
                drawBottle(ctx, over.x, over.y, 2.6);
                ctx.strokeStyle = "#1a1424"; ctx.lineCap = "round"; ctx.lineWidth = 9 * (1 - k * 0.5);
                ctx.beginPath(); ctx.moveTo(over.x + 18, over.y + 6); ctx.quadraticCurveTo(lerp(over.x, p.x, 0.5) + 30, over.y + 10, lerp(over.x + 18, p.x, Math.min(1, k * 2)), lerp(over.y, p.y, Math.min(1, k * 2))); ctx.stroke();
            } });
            await wait(170);
            splat(p, { color: "#1a1424", r: rnd(22, 30), drips: 3, life: 1.6 });
            spray(p, 14, { color: ["#1a1424", "#2e2547"], shape: "drop", speed: [120, 300], size: [2.5, 5], g: 700, life: [0.4, 0.8] });
            tone({ f: 180 - i * 15, f2: 60, d: 0.12, v: 0.18 });
        }
        await wait(300);
    });
    // Eraser Rub: a giant pink eraser scrubs back and forth along the boss's last word; crumbs fly, letters smear off
    D("erase", async c => {
        const ghosts = letterGhosts(c.cells), ps = pts(c).length ? pts(c) : [mid(c.area)];
        const a = ps[0], b = ps[ps.length - 1], n = 7;
        await new Promise(res => { add({ life: 1.1, draw(ctx, k, t) {
            const sweep = (Math.sin(k * n * Math.PI) + 1) / 2, x = lerp(a.x - 20, b.x + 20, sweep), y = lerp(a.y, b.y, sweep) - 6;
            ctx.globalAlpha = 0.35; ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.fillRect(Math.min(a.x, b.x) - 24, Math.min(a.y, b.y) - 18, Math.abs(b.x - a.x) + 48, Math.abs(b.y - a.y) + 36);
            ctx.globalAlpha = 1; drawEraser(ctx, x, y, Math.sin(t * 30) * 0.12 - 0.15);
            if (Math.random() < 0.6) spray({ x, y: y + 14 }, 2, { color: ["#ff9fb4", "#e7c4cc", "#f6e9ee"], shape: "crumb", speed: [60, 200], angle: Math.PI / 2, spread: 1.2, size: [2, 4], g: 600, life: [0.4, 0.8] });
        } }); setTimeout(res, 1100); });
        await leave(ghosts, "smear", { stagger: 40 });
    });
    // Paper Wall: sheets of lined paper fly in and stack into a wall in front of your board
    D("shield", async c => {
        const b = rect(myBoard()), sheets = 9;
        for (let i = 0; i < sheets; i++) {
            const tx = b.left + b.width * ((i % 3) + 0.5) / 3, ty = b.top + b.height * (Math.floor(i / 3) + 0.5) / 3, from = { x: i % 2 ? -60 : innerWidth + 60, y: rnd(0, innerHeight) };
            setTimeout(() => add({ life: 1.7, draw(ctx, k) {
                const m = ease(Math.min(1, k * 2.2)), x = lerp(from.x, tx, m), y = lerp(from.y, ty, m), w = b.width / 3 + 4, h = b.height / 3 + 4, rot = (1 - m) * (i % 2 ? 3 : -3);
                ctx.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 0.92;
                ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = "#fffdf6"; ctx.strokeStyle = "#c6d6ea"; ctx.lineWidth = 1;
                ctx.fillRect(-w / 2, -h / 2, w, h); for (let l = -h / 2 + 12; l < h / 2; l += 10) { ctx.beginPath(); ctx.moveTo(-w / 2, l); ctx.lineTo(w / 2, l); ctx.stroke(); }
                ctx.strokeStyle = "#ff8fa3"; ctx.beginPath(); ctx.moveTo(-w / 2 + 10, -h / 2); ctx.lineTo(-w / 2 + 10, h / 2); ctx.stroke();
                ctx.strokeStyle = "#2b2233"; ctx.lineWidth = 2; ctx.strokeRect(-w / 2, -h / 2, w, h); ctx.restore();
            } }), K.still() ? 0 : i * 60);
        }
        await wait(700);
        flash("#fffdf6", 200, 0.35);
        ring(mid(myBoard()), { color: "#c6d6ea", r: b.width * 0.8, width: 10 });
        await wait(400);
    });

    // ---- Garden ----
    // Pollen Puff: a dandelion bursts; a cloud of pollen drifts to the boss, who sneezes three shockwaves
    D("stutter", async c => {
        const to = mid(portrait());
        spray(c.from, 70, { color: ["#ffe066", "#fff3a0", "#f5c518", "#ffffff"], shape: "glow", speed: [120, 380], angle: Math.atan2(to.y - c.from.y, to.x - c.from.x), spread: 0.45, size: [5, 12], g: -10, drag: 0.4, life: [1, 1.6], add: true, wob: [5, 60] });
        spray(c.from, 24, { color: "#ffffff", shape: "flake", speed: [100, 300], angle: Math.atan2(to.y - c.from.y, to.x - c.from.x), spread: 0.5, size: [4, 7], g: 20, drag: 0.3, life: [1.2, 1.8], wob: [4, 80] });
        await wait(900);
        for (let i = 0; i < 3; i++) {
            ring(to, { color: "#fff3a0", r: 140 + i * 40, width: 10 });
            spray(to, 18, { color: ["#ffe066", "#ffffff"], shape: "glow", speed: [150, 420], size: [4, 8], g: 40, life: [0.5, 0.9], add: true });
            tone({ f: 900 - i * 120, f2: 300, d: 0.16, v: 0.12, type: "triangle" });
            await wait(260);
        }
    });
    // Vine Snare: thorny vines burst up from the board's edges, curl around each target square and bloom
    D("vines", async c => {
        const a = rect(c.area), targets = cellsOf(".bp-cell.vine").map(mid);
        const list = targets.length ? targets : [mid(c.area)];
        list.forEach((p, i) => {
            const edge = [{ x: a.left - 10, y: rnd(a.top, a.bottom) }, { x: a.right + 10, y: rnd(a.top, a.bottom) }, { x: rnd(a.left, a.right), y: a.bottom + 10 }, { x: rnd(a.left, a.right), y: a.top - 10 }][i % 4];
            vine(edge, p, { color: "#2f7a2c", leaf: "#7be36b", life: 2.2 });
            setTimeout(() => add({ life: 1.6, draw(ctx, k) {
                const grow = ease(Math.min(1, k * 2)), r = 16;
                ctx.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1;
                ctx.strokeStyle = "#2f7a2c"; ctx.lineWidth = 3.5; ctx.beginPath();
                for (let s = 0; s < grow * 3 * TAU; s += 0.2) ctx.lineTo(p.x + Math.cos(s) * r * (1 - s / (8 * TAU)), p.y + Math.sin(s) * r * 0.85 * (1 - s / (8 * TAU)));
                ctx.stroke();
                ctx.fillStyle = "#3b2a1a"; for (let s = 0; s < 6; s++) { const q = s / 6 * TAU; ctx.beginPath(); ctx.moveTo(p.x + Math.cos(q) * r, p.y + Math.sin(q) * r); ctx.lineTo(p.x + Math.cos(q) * (r + 6 * grow), p.y + Math.sin(q) * (r + 6 * grow)); ctx.lineTo(p.x + Math.cos(q + 0.2) * r, p.y + Math.sin(q + 0.2) * r); ctx.fill(); }
                if (k > 0.35) { const bl = ease(Math.min(1, (k - 0.35) * 3)); for (let q = 0; q < 5; q++) { ctx.fillStyle = "#e85a9b"; ctx.beginPath(); ctx.ellipse(p.x + Math.cos(q * 1.26) * 6 * bl, p.y - r + Math.sin(q * 1.26) * 6 * bl, 5 * bl, 3 * bl, q * 1.26, 0, TAU); ctx.fill(); } ctx.fillStyle = "#ffd23f"; ctx.beginPath(); ctx.arc(p.x, p.y - r, 3 * bl, 0, TAU); ctx.fill(); }
            } }), K.still() ? 0 : 700);
        });
        await wait(1000);
        spray(mid(c.area), 26, { color: ["#7be36b", "#3f8f3a"], shape: "leaf", speed: [80, 260], size: [5, 9], g: 200, life: [0.8, 1.4], spin: 6 });
    });
    // Sunny Hour: a sun rises behind your board, god-rays sweep across it, and little sprouts pop up
    D("sun", async c => {
        const b = rect(myBoard()), sunAt = { x: b.right - b.width * 0.1, y: b.top - 20 };
        add({ life: 2.2, draw(ctx, k, t) {
            const rise = ease(Math.min(1, k * 2.5)), y = lerp(b.top + 40, sunAt.y, rise), fade = k > 0.75 ? (1 - k) / 0.25 : 1;
            ctx.globalAlpha = fade; ctx.globalCompositeOperation = "lighter";
            for (let i = 0; i < 9; i++) {
                const ang = Math.PI * 0.55 + i * 0.09 + Math.sin(t * 0.8) * 0.06, len = Math.hypot(b.width, b.height) * 1.3;
                const g = ctx.createLinearGradient(sunAt.x, y, sunAt.x + Math.cos(ang) * len, y + Math.sin(ang) * len); g.addColorStop(0, "rgba(255,230,120,.55)"); g.addColorStop(1, "rgba(255,230,120,0)");
                ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sunAt.x, y); ctx.lineTo(sunAt.x + Math.cos(ang - 0.025) * len, y + Math.sin(ang - 0.025) * len); ctx.lineTo(sunAt.x + Math.cos(ang + 0.025) * len, y + Math.sin(ang + 0.025) * len); ctx.fill();
            }
            ctx.globalCompositeOperation = "source-over";
            const g2 = ctx.createRadialGradient(sunAt.x, y, 0, sunAt.x, y, 60); g2.addColorStop(0, "#fff8d0"); g2.addColorStop(0.4, "#ffd23f"); g2.addColorStop(1, "rgba(255,180,0,0)");
            ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(sunAt.x, y, 60, 0, TAU); ctx.fill();
            ctx.save(); ctx.translate(sunAt.x, y); ctx.rotate(t * 1.2); ctx.fillStyle = "#ffb21e"; for (let i = 0; i < 12; i++) { ctx.rotate(TAU / 12); ctx.beginPath(); ctx.moveTo(30, -5); ctx.lineTo(46, 0); ctx.lineTo(30, 5); ctx.fill(); } ctx.restore();
        } });
        await wait(600);
        for (let i = 0; i < 8; i++) { const p = { x: rnd(b.left + 10, b.right - 10), y: rnd(b.top + 10, b.bottom - 10) }; spray(p, 6, { color: ["#7be36b", "#3fbf6b"], shape: "leaf", speed: [30, 90], angle: -Math.PI / 2, spread: 0.6, size: [4, 7], g: -30, life: [0.8, 1.2], delay: 0.6 }); }
        spray({ x: (b.left + b.right) / 2, y: b.top }, 30, { color: ["#fff8d0", "#ffe066"], shape: "star", speed: [40, 160], angle: Math.PI / 2, spread: 1.2, size: [2, 4], g: 60, life: [0.8, 1.4], add: true, delay: 0.8 });
        await wait(800);
    });

    // ---- Acorn Woods ----
    // Acorn Toss: real acorns lobbed in arcs, one per target letter: it clonks, the letter pops off, the acorn bounces away
    D("knock", async c => {
        const ghosts = letterGhosts(c.cells), ps = pts(c).length ? pts(c) : [mid(c.area)];
        await Promise.all(ps.map((p, i) => new Promise(async res => {
            await wait(i * 150);
            await lob(c.from, p, { life: 0.55, height: 220, drawFn: (ctx, x, y, k) => drawAcorn(ctx, x, y, 12, k * 12) });
            ring(p, { color: "#fff3d6", r: 40, width: 6 });
            spray(p, 12, { color: ["#c9a07a", "#8a5a2b", "#fff"], shape: "crumb", speed: [100, 260], size: [2, 4], g: 700, life: [0.4, 0.7] });
            tone({ f: 420 + i * 70, f2: 200, d: 0.08, v: 0.2, type: "square" });
            if (ghosts[i]) leave([ghosts[i]], "pop");
            const dir = Math.random() < 0.5 ? -1 : 1;
            add({ life: 0.9, draw(ctx, k, t) { drawAcorn(ctx, p.x + dir * 180 * t, p.y - 330 * t + 600 * t * t, 12, t * 14); } });
            res();
        })));
        await wait(300);
    });
    // Leaf Pile: a whirl of autumn leaves pours down onto the boss's board and piles up over it
    D("bury", async c => {
        const a = rect(c.area), list = [];
        for (let i = 0; i < (K.lite() ? 45 : 90); i++) list.push({ x: rnd(a.left - 60, a.right + 60), y: a.top - rnd(40, 260), vx: rnd(-40, 40), vy: rnd(120, 260), g: 120, drag: 0.8, life: 2.4, size: rnd(6, 11),
            color: pick(["#e07a2e", "#c4561f", "#f2b53c", "#a8452a", "#d9782b"]), shape: "leaf", vr: rnd(-5, 5), wob: [rnd(3, 6), 160], ph: rnd(0, 6), floor: rnd(a.top + a.height * 0.35, a.bottom) });
        const settle = list.map(p => p.floor);
        sim(2.6, (ctx, dt, t, k) => {
            list.forEach((p, i) => {
                if (p.y < settle[i]) { p.vy += p.g * dt; p.vy *= 1 - p.drag * dt; p.vx += Math.sin(t * p.wob[0] + p.ph) * p.wob[1] * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot = (p.rot || 0) + p.vr * dt; }
                draw(ctx, p, k > 0.8 ? (1 - k) / 0.2 : 1, p.size);
            });
        });
        await wait(1500);
    });
    // Stash Peek: a little treasure stash bursts open on your board; glowing acorns fly to the squares it reveals
    D("hint", async c => {
        const b = rect(myBoard()), chest = { x: (b.left + b.right) / 2, y: b.bottom - 20 }, ps = pts(c);
        add({ life: 1.6, draw(ctx, k, t) {
            const open = ease(Math.min(1, k * 4)), fade = k > 0.8 ? (1 - k) / 0.2 : 1;
            ctx.globalAlpha = fade;
            const g = ctx.createRadialGradient(chest.x, chest.y - 10, 0, chest.x, chest.y - 10, 120 * open); g.addColorStop(0, "rgba(255,230,120,.9)"); g.addColorStop(1, "rgba(255,200,60,0)");
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(chest.x, chest.y - 10, 120 * open, 0, TAU); ctx.fill();
            ctx.strokeStyle = "#2b2233"; ctx.lineWidth = 2.5; ctx.fillStyle = "#8a5a2b"; ctx.beginPath(); ctx.roundRect(chest.x - 34, chest.y - 18, 68, 32, 6); ctx.fill(); ctx.stroke();
            ctx.save(); ctx.translate(chest.x - 34, chest.y - 18); ctx.rotate(-open * 1.1); ctx.fillStyle = "#a8743a"; ctx.beginPath(); ctx.roundRect(0, -16, 68, 18, [8, 8, 2, 2]); ctx.fill(); ctx.stroke(); ctx.restore();
            ctx.fillStyle = "#ffd23f"; ctx.fillRect(chest.x - 5, chest.y - 10, 10, 10);
        } });
        await wait(350);
        spray({ x: chest.x, y: chest.y - 20 }, 30, { color: ["#ffe066", "#fff8d0"], shape: "star", speed: [120, 320], angle: -Math.PI / 2, spread: 0.9, size: [2, 5], g: 400, life: [0.6, 1], add: true });
        await Promise.all((ps.length ? ps : [mid(myBoard())]).map((p, i) => lob({ x: chest.x, y: chest.y - 20 }, p, { life: 0.6, height: 140, trail: "rgba(255,220,100,.8)", drawFn: (ctx, x, y, k) => { ctx.shadowColor = "#ffd23f"; ctx.shadowBlur = 20; drawAcorn(ctx, x, y, 10, k * 8); } })
            .then(() => { glow(p, { color: "#ffe066", r: 50 }); spray(p, 10, { color: "#fff8d0", shape: "star", speed: [60, 160], size: [2, 4], g: 100, life: [0.4, 0.7], add: true }); })));
        await wait(300);
    });

    // ---- Candy Hills ----
    // Sticky Taffy: stretchy pink-and-white taffy shoots out and glues the boss's board down; the strands sag and drip
    D("slow", async c => {
        const a = rect(c.area), from = c.from;
        const anchors = [{ x: a.left + 10, y: a.top + 10 }, { x: a.right - 10, y: a.top + 10 }, { x: a.left + 10, y: a.bottom - 10 }, { x: a.right - 10, y: a.bottom - 10 }, { x: (a.left + a.right) / 2, y: a.top + 6 }];
        add({ life: 2.2, draw(ctx, k, t) {
            const shoot = ease(Math.min(1, k * 3)), fade = k > 0.8 ? (1 - k) / 0.2 : 1;
            ctx.globalAlpha = fade; ctx.lineCap = "round";
            anchors.forEach((p, i) => {
                const ex = lerp(from.x, p.x, shoot), ey = lerp(from.y, p.y, shoot), sag = 50 + Math.sin(t * 3 + i) * 10 * (1 - k);
                for (const [w, col] of [[11, "#ff6fb5"], [5, "#ffffff"], [2, "#ffb3d6"]]) { ctx.strokeStyle = col; ctx.lineWidth = w * (1 - k * 0.4); ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.quadraticCurveTo((from.x + ex) / 2, Math.max(from.y, ey) + sag, ex, ey); ctx.stroke(); }
                if (shoot >= 1) { ctx.fillStyle = "#ff6fb5"; ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, TAU); ctx.fill(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(p.x - 3, p.y - 3, 3, 0, TAU); ctx.fill(); }
            });
        } });
        await wait(700);
        anchors.forEach(p => spray(p, 4, { color: "#ff6fb5", shape: "drop", speed: [10, 40], angle: Math.PI / 2, spread: 0.3, size: [3, 5], g: 300, life: [0.8, 1.2], delay: 0.6 }));
        await wait(700);
    });
    // Sugar Rush: sugar crystals in every candy colour spiral onto your board and crystallise into the first letters
    D("super", async c => {
        const ps = pts(c), to = ps.length ? ps[0] : mid(myBoard());
        const list = [];
        for (let i = 0; i < (K.lite() ? 30 : 60); i++) { const a = rnd(0, TAU), r = rnd(160, 320); list.push({ a, r, c: pick(["#ff5fa2", "#7ad7ff", "#ffd23f", "#7dff6b", "#c08bff", "#fff"]), s: rnd(3, 6), d: rnd(0, 0.5) }); }
        add({ life: 1.5, draw(ctx, k, t) {
            ctx.globalCompositeOperation = "lighter";
            for (const p of list) { const q = Math.max(0, Math.min(1, (k * 1.5 - p.d))), r = p.r * (1 - ease(q)), a = p.a + q * 7;
                if (q <= 0 || q >= 1) continue; ctx.fillStyle = p.c; ctx.shadowColor = p.c; ctx.shadowBlur = 10; ctx.save(); ctx.translate(to.x + Math.cos(a) * r, to.y + Math.sin(a) * r); ctx.rotate(a * 2); ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s); ctx.restore(); }
        } });
        await wait(1100);
        for (const p of (ps.length ? ps : [to])) { ring(p, { color: "#ff9ccf", r: 50, width: 6 }); glow(p, { color: "#ffd23f", r: 60 }); spray(p, 16, { color: ["#ff5fa2", "#7ad7ff", "#ffd23f", "#fff"], shape: "square", speed: [80, 220], size: [2, 4], g: 200, life: [0.4, 0.8], spin: 10 }); }
    });
    // Gumdrop Bounce: a giant wobbling jelly gumdrop drops over your board and settles there, ready to bounce
    D("reflect", async c => {
        const b = rect(myBoard()), x = (b.left + b.right) / 2, y = b.bottom + 6, w = b.width * 0.62, h = b.height * 0.95;
        sim(1.8, (ctx, dt, t, k) => {
            const drop = Math.min(1, t / 0.35), yy = lerp(b.top - h, y, drop * drop), wob = drop < 1 ? 0 : Math.sin((t - 0.35) * 22) * 0.12 * Math.exp(-(t - 0.35) * 4);
            ctx.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1;
            drawGumdrop(ctx, x, yy, w, h, wob, "rgba(180,108,255,.8)");
        });
        await wait(360);
        tone({ f: 200, f2: 520, d: 0.25, v: 0.25, type: "sine" });
        spray({ x, y }, 24, { color: ["#c08bff", "#fff"], shape: "star", speed: [100, 280], angle: -Math.PI / 2, spread: 1.4, size: [2, 5], g: 500, life: [0.5, 0.9] });
        await wait(1200);
    });

    // ---- Coral Reef ----
    // Clear Water: a curtain of clear water pours down your board with light rippling through it; grime washes away
    D("cleanse", async c => {
        const b = rect(myBoard());
        add({ life: 1.8, draw(ctx, k, t) {
            const fall = ease(Math.min(1, k * 2)), fade = k > 0.7 ? (1 - k) / 0.3 : 1, bottom = b.top - 20 + (b.height + 60) * fall;
            ctx.save(); ctx.globalAlpha = fade;
            const g = ctx.createLinearGradient(0, b.top, 0, bottom); g.addColorStop(0, "rgba(140,220,255,.15)"); g.addColorStop(1, "rgba(140,220,255,.5)");
            ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(b.left - 10, b.top - 20);
            for (let x = b.left - 10; x <= b.right + 10; x += 10) ctx.lineTo(x, bottom + Math.sin(x / 15 + t * 12) * 8);
            ctx.lineTo(b.right + 10, b.top - 20); ctx.fill();
            ctx.beginPath(); ctx.rect(b.left, b.top, b.width, Math.max(0, bottom - b.top)); ctx.clip();
            ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 2;
            for (let i = 0; i < 9; i++) { ctx.beginPath(); for (let x = b.left; x <= b.right; x += 12) ctx.lineTo(x, b.top + (i + 0.5) * b.height / 9 + Math.sin(x / 20 + t * 5 + i) * 6); ctx.stroke(); }
            ctx.restore();
        } });
        for (let i = 0; i < 4; i++) setTimeout(() => spray({ x: rnd(b.left, b.right), y: b.bottom }, 8, { shape: "bubble", color: "#fff", speed: [40, 120], angle: -Math.PI / 2, spread: 0.4, size: [3, 8], g: -120, life: [0.8, 1.4], wob: [6, 60] }), K.still() ? 0 : 300 + i * 200);
        await wait(1400);
        spray({ x: (b.left + b.right) / 2, y: b.bottom }, 24, { color: ["#bfefff", "#fff"], shape: "drop", speed: [100, 260], angle: -Math.PI / 2, spread: 1.3, size: [2, 4], g: 800, life: [0.4, 0.8] });
    });
    // Bubble Trap: a big rainbow-skinned bubble grows around the boss and seals it in
    D("bubble", async c => {
        const p = mid(portrait()), r = Math.max(90, rect(portrait()).width * 0.62);
        add({ life: 2.1, draw(ctx, k, t) {
            const grow = ease(Math.min(1, k * 2.5)), rr = r * grow * (1 + Math.sin(t * 6) * 0.02), fade = k > 0.85 ? (1 - k) / 0.15 : 1;
            ctx.globalAlpha = fade;
            const g = ctx.createRadialGradient(p.x, p.y, rr * 0.7, p.x, p.y, rr); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.85, "rgba(190,240,255,.25)"); g.addColorStop(1, "rgba(255,255,255,.6)");
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.1, rr), 0, TAU); ctx.fill();
            ctx.lineWidth = 5; ctx.globalCompositeOperation = "lighter";
            for (let i = 0; i < 3; i++) { ctx.strokeStyle = ["rgba(255,120,200,.5)", "rgba(120,220,255,.5)", "rgba(255,240,120,.45)"][i]; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.1, rr - i * 4), t * 2 + i * 2, t * 2 + i * 2 + 2.2); ctx.stroke(); }
            ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.beginPath(); ctx.ellipse(p.x - rr * 0.45, p.y - rr * 0.45, rr * 0.14, rr * 0.08, -0.7, 0, TAU); ctx.fill();
        } });
        for (let i = 0; i < 3; i++) setTimeout(() => spray({ x: p.x + rnd(-r, r), y: p.y + r }, 6, { shape: "bubble", color: "#fff", speed: [40, 120], angle: -Math.PI / 2, spread: 0.5, size: [4, 9], g: -150, life: [0.8, 1.3] }), K.still() ? 0 : 300 + i * 250);
        await wait(700);
        tone({ f: 600, f2: 900, d: 0.18, v: 0.12 });
        await wait(600);
    });
    // Tide Pull: the tide rolls back across the boss's board (right to left) and drags its newest letters out with it
    D("undo", async c => {
        const a = rect(c.area), ghosts = letterGhosts(c.cells);
        add({ life: 1.4, draw(ctx, k, t) {
            const front = a.right + 40 - (a.width + 120) * ease(Math.min(1, k * 1.4)), fade = k > 0.75 ? (1 - k) / 0.25 : 1;
            ctx.save(); ctx.beginPath(); ctx.rect(a.left - 20, a.top - 20, a.width + 40, a.height + 40); ctx.clip(); ctx.globalAlpha = fade;
            const g = ctx.createLinearGradient(front, 0, a.right + 40, 0); g.addColorStop(0, "rgba(40,140,220,.85)"); g.addColorStop(1, "rgba(20,90,170,.4)");
            ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(a.right + 40, a.top - 20);
            for (let y = a.top - 20; y <= a.bottom + 20; y += 8) ctx.lineTo(front + Math.sin(y / 14 + t * 10) * 12, y);
            ctx.lineTo(a.right + 40, a.bottom + 20); ctx.fill();
            ctx.strokeStyle = "#e8f7ff"; ctx.lineWidth = 5; ctx.beginPath(); for (let y = a.top - 20; y <= a.bottom + 20; y += 8) ctx.lineTo(front + Math.sin(y / 14 + t * 10) * 12, y); ctx.stroke();
            ctx.restore();
        } });
        await wait(300);
        await Promise.all(ghosts.map(({ ghost }, i) => new Promise(res => setTimeout(() => {
            const anim = ghost.animate([{ transform: "none", opacity: 1 }, { transform: `translate(${-a.width * 0.7}px, ${rnd(-10, 10)}px) rotate(-30deg) scale(.6)`, opacity: 0, filter: "blur(2px)" }], { duration: 700, easing: "ease-in", fill: "forwards" });
            anim.onfinish = () => { ghost.remove(); res(); };
        }, K.still() ? 0 : i * 60))));
        spray({ x: a.left, y: (a.top + a.bottom) / 2 }, 20, { color: ["#e8f7ff", "#9fdcff"], shape: "drop", speed: [100, 260], angle: Math.PI, spread: 0.8, size: [2, 4], g: 500, life: [0.4, 0.8] });
    });

    // ---- Snow Day ----
    // Snowball: a big snowball sails at the boss and bursts into chunks; ice creeps over it and it freezes solid
    D("freeze", async c => {
        const p = mid(portrait()), r = rect(portrait());
        await lob(c.from, p, { life: 0.6, height: 180, drawFn: (ctx, x, y, k) => drawSnowball(ctx, x, y, 22, k * 10), trail: "rgba(255,255,255,.7)" });
        flash("#e8f8ff", 220, 0.5);
        ring(p, { color: "#cfeeff", r: 160, width: 12 });
        spray(p, 40, { color: ["#ffffff", "#eef7ff", "#cfe8f8"], shape: "dot", speed: [160, 460], size: [3, 8], g: 700, life: [0.5, 1] });
        spray(p, 20, { color: "#ffffff", shape: "flake", speed: [80, 260], size: [5, 9], g: 60, life: [1, 1.6], spin: 3 });
        K.frost(p, r, { life: 1.8 });
        add({ life: 1.9, draw(ctx, k) {
            const grow = ease(Math.min(1, k * 3)), fade = k > 0.8 ? (1 - k) / 0.2 : 1;
            ctx.globalAlpha = fade * 0.75;
            const g = ctx.createLinearGradient(r.left, r.top, r.right, r.bottom); g.addColorStop(0, "rgba(220,245,255,.75)"); g.addColorStop(0.5, "rgba(160,215,245,.45)"); g.addColorStop(1, "rgba(220,245,255,.75)");
            ctx.fillStyle = g; const h = r.height * grow; ctx.fillRect(r.left, r.bottom - h, r.width, h);
            ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 3; ctx.strokeRect(r.left + 3, r.bottom - h + 3, r.width - 6, h - 6);
            ctx.beginPath(); ctx.moveTo(r.left + r.width * 0.2, r.bottom - h + 10); ctx.lineTo(r.left + r.width * 0.32, r.bottom - h * 0.6); ctx.stroke();
        } });
        await wait(1100);
    });
    // Blizzard: a howling white blizzard sweeps across the boss and buries its attack meter in snow
    D("delay", async c => {
        const pn = rect($(".boss-panel") || c.area), wu = $(".bp-windup") || portrait();
        K.stream(pn, { colors: ["#ffffff", "#e8f4ff", "#cfe8f8"], n: 260, size: [2, 5], wobble: 2, life: 1.6 });
        burst(Array.from({ length: K.lite() ? 25 : 50 }, () => ({ x: pn.left - rnd(0, 200), y: rnd(pn.top, pn.bottom), vx: rnd(500, 900), vy: rnd(-30, 60), life: 1.4, size: rnd(5, 9), color: "#fff", shape: "flake", vr: rnd(-6, 6), wob: [5, 200], ph: rnd(0, 6) })));
        await wait(700);
        const w = mid(wu);
        spray(w, 30, { color: ["#ffffff", "#eef7ff"], shape: "dot", speed: [20, 120], angle: Math.PI / 2, spread: 0.6, size: [4, 9], g: 200, life: [0.8, 1.4], jitter: 60 });
        ring(w, { color: "#ffffff", r: 120, width: 8 });
        await wait(600);
    });
    // Frost Armor: plates of ice grow inward from your board's edges, hexagon frost spreading, with a cold glint
    D("armor", async c => {
        const b = rect(myBoard());
        add({ life: 2, draw(ctx, k, t) {
            const grow = ease(Math.min(1, k * 2.2)), fade = k > 0.8 ? (1 - k) / 0.2 : 1, d = 26 * grow;
            ctx.globalAlpha = fade;
            const g = ctx.createLinearGradient(b.left, b.top, b.right, b.bottom); g.addColorStop(0, "rgba(200,240,255,.85)"); g.addColorStop(1, "rgba(140,200,240,.85)");
            ctx.fillStyle = g; ctx.beginPath(); ctx.rect(b.left - 8, b.top - 8, b.width + 16, b.height + 16); ctx.rect(b.left - 8 + d, b.top - 8 + d, b.width + 16 - 2 * d, b.height + 16 - 2 * d); ctx.fill("evenodd");
            ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 1.5;
            for (let x = b.left; x < b.right; x += 22) for (const y of [b.top - 4, b.bottom + 4]) { ctx.beginPath(); for (let i = 0; i < 6; i++) ctx.lineTo(x + Math.cos(i * TAU / 6) * 9 * grow, y + Math.sin(i * TAU / 6) * 9 * grow); ctx.closePath(); ctx.stroke(); }
            const gx = lerp(b.left, b.right, (t * 0.8) % 1); ctx.globalCompositeOperation = "lighter"; const gl = ctx.createLinearGradient(gx - 40, 0, gx + 40, 0); gl.addColorStop(0, "transparent"); gl.addColorStop(0.5, "rgba(255,255,255,.6)"); gl.addColorStop(1, "transparent");
            ctx.fillStyle = gl; ctx.fillRect(gx - 40, b.top - 8, 80, b.height + 16);
        } });
        spray(mid(myBoard()), 30, { color: "#ffffff", shape: "flake", speed: [100, 300], size: [4, 8], g: 40, life: [0.8, 1.4], spin: 4 });
        await wait(1300);
    });

    // ---- Rainy City ----
    // Puddle Splash: a giant crown splash erupts out of each unfinished word on the boss's board, then ripples settle
    D("wash", async c => {
        const ghosts = letterGhosts(c.cells), ps = pts(c).length ? pts(c) : [mid(c.area)];
        const centers = ps.filter((_, i) => i % 3 === 0).slice(0, 4);
        centers.forEach((p, i) => setTimeout(() => {
            spray(p, 34, { color: ["#7fb2ff", "#c9e0ff", "#ffffff"], shape: "drop", speed: [260, 520], angle: -Math.PI / 2, spread: 0.7, size: [3, 6], g: 1200, life: [0.5, 0.9] });
            for (let j = 0; j < 3; j++) setTimeout(() => ring(p, { color: "rgba(160,200,255,.9)", r: 60 + j * 25, width: 4, life: 0.8 }), j * 120);
            tone({ f: 500 - i * 60, f2: 120, d: 0.14, v: 0.16 });
        }, K.still() ? 0 : i * 120));
        await wait(250);
        await leave(ghosts, "wash", { stagger: 35 });
    });
    // Thunderclap: the sky cracks: a huge bolt strikes the boss, the shockwave rolls out and arcs jump across its board
    D("counter", async c => {
        const p = mid(portrait()), bb = rect(bossBoard());
        bolt({ x: p.x + rnd(-80, 80), y: -20 }, p, { width: 9, life: 1, branches: 7 });
        flash("#e8f4ff", 260, 0.6); FX.shake(12, 450);
        glow(p, { color: "#bfe8ff", r: 180, life: 0.7 });
        ring(p, { color: "#bfe8ff", r: 260, width: 14, life: 0.8 });
        await wait(180);
        for (let i = 0; i < 4; i++) { const q = { x: rnd(bb.left, bb.right), y: rnd(bb.top, bb.bottom) }; bolt(p, q, { width: 3, life: 0.6, branches: 2 }); glow(q, { color: "#bfe8ff", r: 60, life: 0.4 }); await wait(90); }
        spray(p, 40, { color: ["#ffffff", "#bfe8ff"], shape: "streak", speed: [300, 700], size: [2, 4], g: 0, drag: 2, life: [0.3, 0.6], add: true });
    });
    // Lucky Rainbow: a rainbow arcs from your board to your combo; a shower of gold coins rains down from its end
    D("lucky", async c => {
        const from = mid(myBoard()), chip = $('.ms-chip[data-k="combo"]') || $(".hud-row"), to = chip ? mid(chip) : { x: from.x + 200, y: from.y - 100 };
        const cols = ["#ff5c6c", "#ff9f2e", "#ffd23f", "#7be36b", "#4fa3e8", "#9b6bff"];
        add({ life: 2, draw(ctx, k) {
            const grow = ease(Math.min(1, k * 2)), fade = k > 0.8 ? (1 - k) / 0.2 : 1, cx = (from.x + to.x) / 2, cy = Math.max(from.y, to.y), rx = Math.abs(to.x - from.x) / 2 + 40, ry = Math.abs(cy - Math.min(from.y, to.y)) + 120;
            ctx.globalAlpha = fade * 0.85;
            cols.forEach((col, i) => { ctx.strokeStyle = col; ctx.lineWidth = 9; ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(1, rx - i * 9), Math.max(1, ry - i * 9), 0, Math.PI, Math.PI + Math.PI * grow); ctx.stroke(); });
        } });
        await wait(800);
        for (let i = 0; i < 3; i++) setTimeout(() => spray({ x: to.x, y: to.y - 60 }, 12, { color: ["#ffd23f", "#ffe066"], shape: "coin", speed: [60, 200], angle: -Math.PI / 2, spread: 1.2, size: [5, 8], g: 600, life: [0.8, 1.2] }), K.still() ? 0 : i * 150);
        spray(to, 20, { color: cols, shape: "star", speed: [80, 220], size: [3, 5], g: 100, life: [0.6, 1], add: true });
        await wait(800);
    });

    // ---- Sky Kingdom ----
    // Gust: a curling gust of wind sweeps the boss's board; one letter is plucked out of each finished word and tumbles away
    D("scatter", async c => {
        const a = rect(c.area), ghosts = letterGhosts(c.cells);
        for (let i = 0; i < 7; i++) {
            const y = a.top + a.height * (i + 0.5) / 7, len = rnd(80, 160), curl = rnd(14, 26);
            setTimeout(() => add({ life: 0.9, draw(ctx, k) {
                const x = lerp(a.left - 100, a.right + 120, k);
                const g = ctx.createLinearGradient(x - len, 0, x, 0); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(255,255,255,.9)");
                ctx.strokeStyle = g; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(x - len, y); ctx.bezierCurveTo(x - len / 2, y - curl, x - 20, y + curl, x, y); ctx.arc(x - curl * 0.5, y - curl * 0.5, curl * 0.6, Math.PI * 0.5, Math.PI * 2.2); ctx.stroke();
            } }), K.still() ? 0 : i * 70);
        }
        await wait(300);
        await Promise.all(ghosts.map(({ ghost }, i) => new Promise(res => setTimeout(() => {
            const dx = rnd(200, 360), dy = rnd(-120, 40);
            const anim = ghost.animate([{ transform: "none", opacity: 1 }, { transform: `translate(${dx * 0.4}px, ${dy - 50}px) rotate(200deg)`, opacity: 1, offset: 0.5 }, { transform: `translate(${dx}px, ${dy}px) rotate(560deg) scale(.5)`, opacity: 0 }], { duration: 900, easing: "ease-out", fill: "forwards" });
            anim.onfinish = () => { ghost.remove(); res(); };
        }, K.still() ? 0 : i * 70))));
    });
    // Silver Lining: a storm cloud rolls over your board and its edge lights up silver, beams shining down through it
    D("silver", async c => {
        const b = rect(myBoard()), cx = (b.left + b.right) / 2, cy = b.top - 30;
        add({ life: 2.1, draw(ctx, k, t) {
            const in_ = ease(Math.min(1, k * 2.5)), fade = k > 0.8 ? (1 - k) / 0.2 : 1, x = lerp(b.left - 200, cx, in_);
            ctx.globalAlpha = fade;
            if (k > 0.35) { ctx.globalCompositeOperation = "lighter"; for (let i = 0; i < 6; i++) { const bx = x - 90 + i * 36; const g = ctx.createLinearGradient(bx, cy, bx, b.bottom); g.addColorStop(0, "rgba(230,240,255,.6)"); g.addColorStop(1, "rgba(230,240,255,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(bx - 6, cy + 20); ctx.lineTo(bx + 6, cy + 20); ctx.lineTo(bx + 26, b.bottom); ctx.lineTo(bx - 14, b.bottom); ctx.fill(); } ctx.globalCompositeOperation = "source-over"; }
            const puffs = [[0, 0, 46], [-50, 12, 34], [52, 10, 36], [-90, 22, 24], [92, 22, 24], [-20, -26, 32], [28, -22, 30]];
            for (const [dx, dy, r] of puffs) { ctx.fillStyle = "#7f8ea3"; ctx.beginPath(); ctx.arc(x + dx, cy + dy, r, 0, TAU); ctx.fill(); }
            const edge = Math.max(0, k - 0.3) * 1.6;
            ctx.strokeStyle = `rgba(235,245,255,${Math.min(1, edge)})`; ctx.lineWidth = 4; ctx.shadowColor = "#fff"; ctx.shadowBlur = 18;
            for (const [dx, dy, r] of puffs) { ctx.beginPath(); ctx.arc(x + dx, cy + dy, r, Math.PI * 0.05, Math.PI * 0.95); ctx.stroke(); }
        } });
        await wait(900);
        spray({ x: cx, y: cy + 30 }, 30, { color: ["#ffffff", "#dfe8f5"], shape: "star", speed: [60, 200], angle: Math.PI / 2, spread: 1, size: [2, 4], g: 120, life: [0.6, 1.1], add: true });
        await wait(700);
    });
    // Tailwind: a kite swoops across your board trailing ribbons of wind; they wrap around the board and hold it
    D("time", async c => {
        const b = rect(myBoard()), path = [];
        add({ life: 2, draw(ctx, k, t) {
            const q = Math.min(1, k * 1.25), x = lerp(b.left - 60, b.right + 60, q), y = b.top + b.height * 0.5 + Math.sin(q * TAU * 1.5) * b.height * 0.42;
            path.push([x, y]); if (path.length > 40) path.shift();
            const fade = k > 0.8 ? (1 - k) / 0.2 : 1; ctx.globalAlpha = fade;
            for (const [off, col] of [[0, "rgba(255,255,255,.85)"], [10, "rgba(160,210,255,.7)"], [-10, "rgba(255,200,120,.6)"]]) { ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); path.forEach(([px, py], i) => (i ? ctx.lineTo(px, py + off * Math.sin(i / 5 + t * 8)) : ctx.moveTo(px, py))); ctx.stroke(); }
            if (q < 1) { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.cos(q * TAU * 1.5) * 0.6); ctx.fillStyle = "#ff5c6c"; ctx.strokeStyle = "#2b2233"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(14, 0); ctx.lineTo(0, 26); ctx.lineTo(-14, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.strokeStyle = "#ffd23f"; ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(0, 26); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.stroke(); ctx.restore(); }
            if (k > 0.55) { const w = ease((k - 0.55) / 0.45); ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 3; ctx.setLineDash([14, 10]); ctx.lineDashOffset = -t * 60; ctx.strokeRect(b.left - 6 - 4 * w, b.top - 6 - 4 * w, b.width + 12 + 8 * w, b.height + 12 + 8 * w); ctx.setLineDash([]); }
        } });
        await wait(1500);
    });

    // ---- Desert Caravan ----
    // Sandstorm: a towering wall of sand rolls over the boss's board, grains whipping in curls
    D("sand", async c => {
        const a = rect(c.area), ghosts = letterGhosts(c.cells);
        add({ life: 1.8, draw(ctx, k, t) {
            const front = lerp(a.left - 120, a.right + 200, ease(Math.min(1, k * 1.2))), fade = k > 0.8 ? (1 - k) / 0.2 : 1;
            ctx.globalAlpha = fade * 0.8;
            const g = ctx.createLinearGradient(front - 260, 0, front, 0); g.addColorStop(0, "rgba(217,163,92,0)"); g.addColorStop(0.6, "rgba(217,163,92,.75)"); g.addColorStop(1, "rgba(236,198,142,.9)");
            ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(front - 260, a.top - 40);
            for (let y = a.top - 40; y <= a.bottom + 40; y += 10) ctx.lineTo(front + Math.sin(y / 20 + t * 6) * 20, y);
            ctx.lineTo(front - 260, a.bottom + 40); ctx.fill();
            ctx.strokeStyle = "rgba(255,240,200,.6)"; ctx.lineWidth = 2;
            for (let i = 0; i < 5; i++) { const cy = a.top + a.height * (i + 0.5) / 5; ctx.beginPath(); ctx.arc(front - 40 - i * 30, cy, 14 + i * 3, t * 8 + i, t * 8 + i + 4); ctx.stroke(); }
        } });
        K.stream(a, { colors: ["#d9a35c", "#c48a45", "#ecc68e", "#fff1c8"], n: 220, size: [1.5, 3], life: 1.6, wobble: 1.5 });
        await wait(350);
        await leave(ghosts, "blow", { stagger: 30 });
    });
    // Quicksand: the sand under the boss's board starts to turn; a funnel opens and grains spiral down into it
    D("quicksand", async c => {
        const a = rect(c.area), p = { x: (a.left + a.right) / 2, y: a.bottom - a.height * 0.15 };
        add({ life: 2, draw(ctx, k, t) {
            const fade = Math.sin(k * Math.PI);
            ctx.globalAlpha = fade;
            for (let i = 6; i >= 0; i--) { const r = 20 + i * 22; ctx.fillStyle = i % 2 ? "rgba(185,130,62,.55)" : "rgba(217,163,92,.55)"; ctx.beginPath(); ctx.ellipse(p.x, p.y, r * 1.6, r * 0.45, 0, 0, TAU); ctx.fill(); }
            ctx.strokeStyle = "rgba(90,60,30,.6)"; ctx.lineWidth = 2;
            for (let i = 0; i < 6; i++) { ctx.beginPath(); for (let s = 0; s < 1; s += 0.05) { const a2 = t * 3 + i + s * 6, r = 160 * (1 - s); ctx.lineTo(p.x + Math.cos(a2) * r * 1.6 * 0.6, p.y + Math.sin(a2) * r * 0.45 * 0.6); } ctx.stroke(); }
            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 30); g.addColorStop(0, "rgba(40,25,10,.9)"); g.addColorStop(1, "transparent"); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p.x, p.y, 40, 14, 0, 0, TAU); ctx.fill();
        } });
        burst(Array.from({ length: K.lite() ? 40 : 80 }, () => { const ang = rnd(0, TAU), r = rnd(80, 200); return { x: p.x + Math.cos(ang) * r * 1.4, y: p.y + Math.sin(ang) * r * 0.4, vx: -Math.cos(ang) * 120, vy: -Math.sin(ang) * 40, life: 1.6, size: rnd(1.5, 3), color: pick(["#d9a35c", "#c48a45", "#ecc68e"]), shape: "dot", drag: 0.2 }; }));
        bossBoard().animate([{ transform: "none" }, { transform: "translateY(10px) scale(.97)" }, { transform: "none" }], { duration: 1600, easing: "ease-in-out" });
        await wait(1500);
    });
    // Truth Mirage: a heat-shimmer wave passes over your board; an eye opens above it and your wrong letters burn red
    D("check", async c => {
        const b = rect(myBoard()), eye = { x: (b.left + b.right) / 2, y: b.top - 40 }, wrong = cellsOf("#board .cell.wrong").map(mid);
        add({ life: 1.9, draw(ctx, k, t) {
            const fade = Math.sin(k * Math.PI), open = ease(Math.min(1, k * 3));
            ctx.globalAlpha = fade;
            ctx.strokeStyle = "rgba(255,210,140,.5)"; ctx.lineWidth = 2;
            for (let i = 0; i < 6; i++) { const y = b.top + ((k * 1.5 + i / 6) % 1) * b.height; ctx.beginPath(); for (let x = b.left; x <= b.right; x += 8) ctx.lineTo(x, y + Math.sin(x / 12 + t * 14) * 4); ctx.stroke(); }
            ctx.fillStyle = "#fff6e0"; ctx.strokeStyle = "#c48a12"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(eye.x, eye.y, 34, 16 * open, 0, 0, TAU); ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#1e5f6b"; ctx.beginPath(); ctx.arc(eye.x, eye.y, 9 * open, 0, TAU); ctx.fill(); ctx.fillStyle = "#2b2233"; ctx.beginPath(); ctx.arc(eye.x, eye.y, 4 * open, 0, TAU); ctx.fill();
            ctx.strokeStyle = "#c48a12"; ctx.beginPath(); ctx.moveTo(eye.x - 10, eye.y + 16); ctx.quadraticCurveTo(eye.x - 14, eye.y + 30, eye.x - 24, eye.y + 30); ctx.stroke();
            for (const p of wrong) { ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = `rgba(255,60,60,${0.5 + Math.sin(t * 10) * 0.3})`; ctx.lineWidth = 4; ctx.shadowColor = "#ff3b3b"; ctx.shadowBlur = 16; ctx.strokeRect(p.x - 22, p.y - 22, 44, 44); ctx.globalCompositeOperation = "source-over"; ctx.shadowBlur = 0; }
        } });
        wrong.forEach((p, i) => setTimeout(() => bolt(eye, p, { color: "#ffb36b", core: "#fff4d6", width: 2, life: 0.4, branches: 0 }), K.still() ? 0 : 500 + i * 70));
        await wait(1400);
    });

    // ---- Big Top Carnival ----
    // Pie in the Face: a cream pie flies, SPLAT on the boss's face, cream splatters everywhere and drips down
    D("blind", async c => {
        const p = mid(portrait()), r = rect(portrait());
        await lob(c.from, p, { life: 0.6, height: 200, drawFn: (ctx, x, y, k) => drawPie(ctx, x, y, 26, k * 8) });
        FX.shake(10, 300);
        tone({ f: 160, f2: 60, d: 0.2, v: 0.3 });
        splat(p, { color: "#fffaf0", r: r.width * 0.32, drips: 6, life: 2.2 });
        splat({ x: p.x + 30, y: p.y - 20 }, { color: "#fff3e0", r: r.width * 0.12, drips: 2, life: 2 });
        spray(p, 40, { color: ["#fffaf0", "#fff3e0", "#d9a35c"], shape: "drop", speed: [200, 520], size: [3, 7], g: 900, life: [0.5, 1] });
        spray(p, 10, { color: "#d9a35c", shape: "crumb", speed: [100, 300], size: [3, 6], g: 900, life: [0.6, 1] });
        await wait(800);
    });
    // Juggling Act: the boss can't look away: balls and clubs fly in a juggling cascade above it, hypnotic spirals behind
    D("hypno", async c => {
        const p = mid(portrait()), top = rect(portrait()).top + 10;
        add({ life: 2.4, draw(ctx, k, t) {
            const fade = Math.sin(k * Math.PI);
            ctx.globalAlpha = fade * 0.5; ctx.strokeStyle = "#ff4d6d"; ctx.lineWidth = 4;
            ctx.beginPath(); for (let s = 0; s < 1; s += 0.01) { const a = s * 26 + t * 5, r = s * 120; ctx.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r); } ctx.stroke();
            ctx.globalAlpha = fade;
            for (let i = 0; i < 5; i++) {
                const ph = (t * 1.3 + i / 5) % 1, side = Math.floor((t * 1.3 + i / 5) % 2) ? 1 : -1, x = p.x + side * lerp(-70, 70, ph), y = top + 20 - Math.sin(ph * Math.PI) * 120;
                if (i % 2) { ctx.save(); ctx.translate(x, y); ctx.rotate(t * 10 + i); ctx.fillStyle = "#fff"; ctx.strokeStyle = "#2b2233"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, -8, 6, 12, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#e2483c"; ctx.fillRect(-2, 2, 4, 12); ctx.restore(); }
                else { const col = ["#e2483c", "#ffd23f", "#4fa3e8"][i % 3]; ctx.fillStyle = col; ctx.strokeStyle = "#2b2233"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 10, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.beginPath(); ctx.arc(x - 3, y - 3, 3, 0, TAU); ctx.fill(); }
            }
        } });
        await wait(1400);
    });
    // Sugar Crash: candy floss whirls the boss into a frenzy (pink speed lines)... then a crash: it slumps, Zs float up
    D("crash", async c => {
        const p = mid(portrait());
        add({ life: 1, draw(ctx, k, t) { ctx.globalAlpha = Math.sin(k * Math.PI); ctx.strokeStyle = "#ff9ed2"; ctx.lineWidth = 3; for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + t * 4, r1 = 60, r2 = 130 + Math.sin(t * 20 + i) * 20; ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * r1, p.y + Math.sin(a) * r1); ctx.lineTo(p.x + Math.cos(a) * r2, p.y + Math.sin(a) * r2); ctx.stroke(); } } });
        spray(p, 30, { color: ["#ff9ed2", "#ffffff", "#ffd1ea"], shape: "glow", speed: [100, 300], size: [6, 12], g: 0, drag: 1.5, life: [0.6, 1], add: true });
        await wait(1000);
        portrait().animate([{ transform: "none" }, { transform: "translateY(14px) rotate(-8deg) scale(.95)" }, { transform: "translateY(10px) rotate(-6deg) scale(.96)" }], { duration: 600, fill: "none" });
        FX.shake(6, 250);
        spray({ x: p.x, y: p.y + 40 }, 16, { color: ["#ffd1ea", "#ff9ed2"], shape: "crumb", speed: [100, 260], angle: -Math.PI / 2, spread: 1.4, size: [3, 5], g: 800, life: [0.4, 0.8] });
        spray({ x: p.x + 40, y: p.y - 40 }, 5, { color: "#ffffff", shape: "text", text: ["Z", "z"], font: "Fredoka, sans-serif", speed: [30, 60], angle: -Math.PI / 2, spread: 0.4, size: [16, 26], g: -40, life: [1.2, 1.6], delay: 0.8, spin: 0.5 });
        await wait(800);
    });

    // ---- Neon Arcade ----
    // Chomper: a pixel chomper races along the boss's board, mouth flapping, gobbling letters and leaving pellets behind
    D("chomp", async c => {
        let last = null;
        add({ life: 2.6, fixed: true, draw(ctx, k, t) {           // follows the live squares itself
            const eaten = cellsOf(".bp-cell.chomped");
            if (eaten.length) last = mid(eaten[eaten.length - 1]);
            if (!last) return;
            const r = 15, mouth = Math.abs(Math.sin(t * 18)) * 0.8;
            ctx.fillStyle = "#ffe066"; ctx.shadowColor = "#ffe066"; ctx.shadowBlur = 16;
            ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.arc(last.x, last.y, r, mouth / 2, TAU - mouth / 2); ctx.closePath(); ctx.fill();
            ctx.shadowBlur = 0; ctx.fillStyle = "#2b2233"; ctx.beginPath(); ctx.arc(last.x + 2, last.y - 8, 2.5, 0, TAU); ctx.fill();
            if (Math.random() < 0.5) spray(last, 2, { color: ["#2bf0ff", "#ff2bd6", "#ffe066"], shape: "square", speed: [60, 160], size: [3, 5], g: 300, life: [0.3, 0.6] });
        } });
        await wait(1200);
    });
    // Cheat Code: a burst of falling green code over your word, then the answer flashes through it
    D("cheat", async c => {
        const cells = cellsOf("#board .cell.in-word"), b = cells.length ? cells.map(rect) : [rect(myBoard())];
        const left = Math.min(...b.map(r => r.left)), right = Math.max(...b.map(r => r.right)), top = Math.min(...b.map(r => r.top)), bottom = Math.max(...b.map(r => r.bottom));
        const cols = Array.from({ length: Math.ceil((right - left + 40) / 14) }, (_, i) => ({ x: left - 20 + i * 14, y: top - rnd(0, 200), v: rnd(220, 420) }));
        add({ life: 1.4, draw(ctx, k, t) {
            ctx.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1; ctx.font = "700 14px monospace"; ctx.textAlign = "center";
            for (const col of cols) { const y = col.y + col.v * t; for (let j = 0; j < 8; j++) { ctx.fillStyle = j === 0 ? "#d6ffd6" : `rgba(80,255,120,${1 - j / 8})`; ctx.fillText(String.fromCharCode(0x30a0 + ((col.x + j * 7 + Math.floor(t * 20)) % 90)), col.x, y - j * 14); } }
            ctx.globalAlpha = 0.25 * Math.sin(k * Math.PI); ctx.fillStyle = "#50ff78"; ctx.fillRect(left - 6, top - 6, right - left + 12, bottom - top + 12);
        } });
        cells.forEach((el, i) => setTimeout(() => { glow(mid(el), { color: "#7bff9c", r: 40, life: 0.5 }); }, K.still() ? 0 : 400 + i * 60));
        await wait(900);
    });
    // Extra Life: a pixel heart rises from your board, gleaming, and a green 1-UP pops above it in a shower of pixels
    D("extralife", async c => {
        const b = rect(myBoard()), x = (b.left + b.right) / 2;
        const heart = ["0110110", "1111111", "1111111", "0111110", "0011100", "0001000"];
        add({ life: 2, draw(ctx, k, t) {
            const y = lerp(b.bottom, b.top + b.height * 0.35, ease(Math.min(1, k * 2))), s = 9, fade = k > 0.8 ? (1 - k) / 0.2 : 1;
            ctx.globalAlpha = fade; ctx.shadowColor = "#ff3b5c"; ctx.shadowBlur = 20;
            heart.forEach((row, r) => [...row].forEach((v, q) => { if (v === "1") { ctx.fillStyle = r === 1 && q === 1 ? "#fff" : "#ff3b5c"; ctx.fillRect(x - 3.5 * s + q * s, y - 3 * s + r * s, s, s); } }));
            ctx.shadowColor = "#4fdf6b"; ctx.fillStyle = "#4fdf6b"; ctx.font = "900 28px monospace"; ctx.textAlign = "center"; if (k > 0.3) ctx.fillText("1-UP", x, y - 4 * s - 10 - (k - 0.3) * 30);
        } });
        await wait(700);
        spray({ x, y: b.top + b.height * 0.35 }, 40, { color: ["#4fdf6b", "#ff3b5c", "#ffffff", "#ffe066"], shape: "square", speed: [140, 380], size: [3, 6], g: 400, life: [0.5, 1] });
        await wait(900);
    });

    // ---- Haunted Library ----
    // Shush!: a giant finger hushes the boss: soft lavender rings ripple out, its rage melts and Zs drift up
    D("calm", async c => {
        const p = mid(portrait());
        add({ life: 1.6, draw(ctx, k) {
            const fade = Math.sin(k * Math.PI);
            ctx.globalAlpha = fade; ctx.fillStyle = "#f2d2b6"; ctx.strokeStyle = "#2b2233"; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.roundRect(p.x - 11, p.y - 70 + (1 - fade) * 30, 22, 74, 11); ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#ffe3d0"; ctx.beginPath(); ctx.ellipse(p.x, p.y - 62 + (1 - fade) * 30, 7, 5, 0, 0, TAU); ctx.fill();
        } });
        for (let i = 0; i < 4; i++) setTimeout(() => ring(p, { color: "#c9b8ff", r: 120 + i * 30, width: 6, life: 1 }), K.still() ? 0 : i * 220);
        spray({ x: p.x + 50, y: p.y - 30 }, 4, { color: "#c9b8ff", shape: "text", text: ["shh…", "Z", "z"], font: "Fredoka, sans-serif", speed: [20, 50], angle: -Math.PI / 2, spread: 0.6, size: [16, 24], g: -30, life: [1.4, 1.8], spin: 0.3, delay: 0.4 });
        await wait(1300);
    });
    // Haunted Page: a ghost peels out of your board, swoops across with a wailing wisp trail and dives into the boss's board
    D("haunt", async c => {
        const a = c.from, b = mid(bossBoard()), trail = [];
        add({ life: 1.6, draw(ctx, k, t) {
            const q = ease(Math.min(1, k * 1.2)), x = lerp(a.x, b.x, q) + Math.sin(q * 9) * 40, y = lerp(a.y, b.y, q) - Math.sin(q * Math.PI) * 140;
            trail.push([x, y]); if (trail.length > 24) trail.shift();
            ctx.globalAlpha = k > 0.85 ? (1 - k) / 0.15 : 1;
            trail.forEach(([px, py], i) => { ctx.globalAlpha = i / trail.length * 0.4; ctx.fillStyle = "#bff3e4"; ctx.beginPath(); ctx.arc(px, py + 10, 14 * i / trail.length, 0, TAU); ctx.fill(); });
            ctx.globalAlpha = q >= 1 ? Math.max(0, 1 - (k - 0.83) * 6) : 0.9; ctx.shadowColor = "#bff3e4"; ctx.shadowBlur = 24; ctx.fillStyle = "#effffa";
            ctx.beginPath(); ctx.arc(x, y, 22, Math.PI, 0); for (let i = 0; i <= 4; i++) ctx.lineTo(x + 22 - i * 11, y + 28 + (i % 2 ? -6 : 3) + Math.sin(t * 12 + i) * 3); ctx.fill();
            ctx.shadowBlur = 0; ctx.fillStyle = "#2b2233"; ctx.beginPath(); ctx.arc(x - 7, y - 2, 3, 0, TAU); ctx.arc(x + 7, y - 2, 3, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(x, y + 10, 4, 6, 0, 0, TAU); ctx.fill();
        } });
        await wait(1250);
        ring(b, { color: "#bff3e4", r: 120, width: 6 });
        spray(b, 20, { color: ["#bff3e4", "#ffffff"], shape: "glow", speed: [40, 160], size: [6, 12], g: -60, life: [0.8, 1.2], add: true });
        await wait(300);
    });
    // Ghost Writer: a spectral quill writes glowing script in the air over your board, ink trailing light
    D("ghost", async c => {
        const b = rect(myBoard()), pts2 = [];
        let x = b.left + 10, y = b.top + b.height * 0.3;
        for (let i = 0; i < 60; i++) { x += (b.width - 20) / 60; y = b.top + b.height * 0.3 + Math.sin(i * 0.9) * 22 + Math.sin(i * 0.31) * 30; pts2.push([x, y]); }
        add({ life: 2, draw(ctx, k) {
            const n = Math.max(2, Math.floor(pts2.length * Math.min(1, k * 1.4))), fade = k > 0.8 ? (1 - k) / 0.2 : 1;
            ctx.globalAlpha = fade; ctx.strokeStyle = "#a99bff"; ctx.lineWidth = 3; ctx.shadowColor = "#a99bff"; ctx.shadowBlur = 14; ctx.lineCap = "round";
            ctx.beginPath(); pts2.slice(0, n).forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke();
            const [qx, qy] = pts2[n - 1];
            ctx.save(); ctx.translate(qx, qy); ctx.rotate(-0.8); ctx.fillStyle = "rgba(240,236,255,.9)"; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(10, -30, 4, -60); ctx.quadraticCurveTo(-10, -30, 0, 0); ctx.fill(); ctx.restore();
            if (Math.random() < 0.5) spray({ x: qx, y: qy }, 1, { color: "#cfc6ff", shape: "glow", speed: [10, 40], size: [3, 6], g: 30, life: [0.4, 0.7], add: true });
        } });
        await wait(1500);
    });

    // ---- Robot Factory ----
    // Auto-Fill: a robot printer head scans across your board on a laser line, printing the missing letters as it passes
    D("autofill", async c => {
        const b = rect(myBoard()), ps = pts(c);
        add({ life: 1.6, draw(ctx, k) {
            const x = lerp(b.left - 20, b.right + 20, Math.min(1, k * 1.2)), fade = k > 0.85 ? (1 - k) / 0.15 : 1;
            ctx.globalAlpha = fade; ctx.globalCompositeOperation = "lighter";
            const g = ctx.createLinearGradient(x - 30, 0, x + 4, 0); g.addColorStop(0, "transparent"); g.addColorStop(1, "rgba(80,220,255,.6)");
            ctx.fillStyle = g; ctx.fillRect(x - 30, b.top, 34, b.height);
            ctx.strokeStyle = "#7ae0ff"; ctx.lineWidth = 2; ctx.shadowColor = "#7ae0ff"; ctx.shadowBlur = 12; ctx.beginPath(); ctx.moveTo(x, b.top - 10); ctx.lineTo(x, b.bottom + 10); ctx.stroke();
            ctx.globalCompositeOperation = "source-over"; ctx.shadowBlur = 0; ctx.fillStyle = "#8a95a3"; ctx.strokeStyle = "#2b2233"; ctx.fillRect(x - 16, b.top - 30, 32, 20); ctx.strokeRect(x - 16, b.top - 30, 32, 20); ctx.fillStyle = "#ff3b3b"; ctx.fillRect(x - 3, b.top - 24, 6, 6);
        } });
        ps.forEach(p => setTimeout(() => { glow(p, { color: "#7ae0ff", r: 40, life: 0.4 }); spray(p, 8, { color: ["#7ae0ff", "#ffffff"], shape: "square", speed: [40, 140], size: [2, 3], g: 100, life: [0.3, 0.5] }); }, K.still() ? 0 : ((p.x - b.left) / b.width) * 1300));
        await wait(1500);
    });
    // Overclock: circuit traces race out over your board from the centre, glowing hotter, sparks at every junction
    D("overclock", async c => {
        const b = rect(myBoard()), o = mid(myBoard()), traces = [];
        for (let i = 0; i < 14; i++) { let x = o.x, y = o.y; const path = [[x, y]]; for (let j = 0; j < 6; j++) { if (j % 2) x += rnd(-1, 1) * b.width * 0.18; else y += rnd(-1, 1) * b.height * 0.18; x = Math.max(b.left, Math.min(b.right, x)); y = Math.max(b.top, Math.min(b.bottom, y)); path.push([x, y]); } traces.push(path); }
        add({ life: 1.7, draw(ctx, k, t) {
            const grow = Math.min(1, k * 2), fade = k > 0.75 ? (1 - k) / 0.25 : 1;
            ctx.globalAlpha = fade; ctx.globalCompositeOperation = "lighter"; ctx.lineWidth = 2.5; ctx.strokeStyle = `rgba(${255},${200 - k * 120},${60},.9)`; ctx.shadowColor = "#ffcf3f"; ctx.shadowBlur = 12;
            for (const path of traces) { const n = Math.max(2, Math.floor(path.length * grow)); ctx.beginPath(); path.slice(0, n).forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke(); const [ex, ey] = path[n - 1]; ctx.fillStyle = "#fff6c0"; ctx.beginPath(); ctx.arc(ex, ey, 3.5, 0, TAU); ctx.fill(); }
        } });
        await wait(600);
        bolt({ x: b.left, y: o.y }, { x: b.right, y: o.y }, { color: "#ffd23f", width: 3, life: 0.5, branches: 4 });
        spray(o, 30, { color: ["#ffe066", "#fff", "#ff9f2e"], shape: "streak", speed: [200, 500], size: [2, 3], g: 300, life: [0.3, 0.6], add: true });
        await wait(800);
    });
    // Firewall: a wall of digital fire bricks stacks up between you and the boss, flickering pixel flames on top
    D("firewall", async c => {
        const a = rect($(".board-area") || myBoard()), p = rect($(".boss-panel") || c.area), x = (a.right + p.left) / 2 || a.right + 20, top = Math.min(a.top, p.top), bottom = Math.max(a.bottom, p.bottom);
        add({ life: 2.2, draw(ctx, k, t) {
            const h = (bottom - top) * ease(Math.min(1, k * 2)), fade = k > 0.8 ? (1 - k) / 0.2 : 1, bw = 34, bh = 18;
            ctx.globalAlpha = fade;
            for (let y = bottom - bh, row = 0; y > bottom - h; y -= bh, row++) for (let i = -1; i <= 1; i++) { const bx = x - bw * 1.5 + (i + 1) * bw + (row % 2 ? bw / 2 : 0) - bw / 2; ctx.fillStyle = row % 3 ? "#c4361b" : "#e2552c"; ctx.fillRect(bx, y, bw - 3, bh - 3); }
            const fy = bottom - h;
            for (let i = 0; i < 10; i++) { const fx = x - bw * 1.6 + i * bw * 0.34, fh = 20 + Math.abs(Math.sin(t * 9 + i * 1.7)) * 30; ctx.fillStyle = i % 2 ? "#ffcf3f" : "#ff7a1f"; ctx.fillRect(Math.round(fx / 6) * 6, fy - fh, 10, fh); }
        } });
        spray({ x, y: bottom }, 30, { color: ["#ff7a1f", "#ffcf3f"], shape: "square", speed: [80, 260], angle: -Math.PI / 2, spread: 0.6, size: [3, 6], g: -100, life: [0.6, 1.2], delay: 0.5 });
        await wait(1500);
    });

    // ---- Volcano Island ----
    // Hot Streak: flames race around the edge of your board and keep licking upward, embers flying off
    D("hot", async c => {
        const b = rect(myBoard()), per = 2 * (b.width + b.height), at = s => { s = ((s % per) + per) % per; if (s < b.width) return [b.left + s, b.top]; s -= b.width; if (s < b.height) return [b.right, b.top + s]; s -= b.height; if (s < b.width) return [b.right - s, b.bottom]; return [b.left, b.bottom - (s - b.width)]; };
        add({ life: 2, draw(ctx, k, t) {
            const run = Math.min(1, k * 1.6), fade = k > 0.8 ? (1 - k) / 0.2 : 1;
            ctx.globalAlpha = fade; ctx.globalCompositeOperation = "lighter";
            for (let s = 0; s < per * run; s += 10) { const [x, y] = at(s), h = 14 + Math.abs(Math.sin(t * 12 + s * 0.13)) * 20; const g = ctx.createRadialGradient(x, y - h * 0.3, 0, x, y - h * 0.3, h); g.addColorStop(0, "rgba(255,240,180,.9)"); g.addColorStop(0.4, "rgba(255,130,30,.7)"); g.addColorStop(1, "rgba(255,40,0,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - h * 0.3, h, 0, TAU); ctx.fill(); }
        } });
        for (let i = 0; i < 6; i++) setTimeout(() => { const [x, y] = at(rnd(0, per)); spray({ x, y }, 6, { color: ["#ffb21e", "#ff7a1f", "#ffe066"], shape: "ember", speed: [40, 140], angle: -Math.PI / 2, spread: 0.7, size: [1.5, 3], g: -80, life: [0.6, 1.1] }); }, K.still() ? 0 : 200 + i * 200);
        await wait(1500);
    });
    // Lava Floor: lava wells up under the boss's board, glowing and bubbling, and splashes up its sides
    D("lavafloor", async c => {
        const a = rect(c.area);
        add({ life: 2.2, draw(ctx, k, t) {
            const rise = ease(Math.min(1, k * 2)) * a.height * 0.34, fade = k > 0.8 ? (1 - k) / 0.2 : 1, top = a.bottom - rise;
            ctx.save(); ctx.globalAlpha = fade; ctx.beginPath(); ctx.rect(a.left - 10, a.top - 40, a.width + 20, a.height + 60); ctx.clip();
            const g = ctx.createLinearGradient(0, top, 0, a.bottom); g.addColorStop(0, "#ffcf3f"); g.addColorStop(0.3, "#ff6a00"); g.addColorStop(1, "#a8200e");
            ctx.fillStyle = g; ctx.shadowColor = "#ff6a00"; ctx.shadowBlur = 30; ctx.beginPath(); ctx.moveTo(a.left - 10, a.bottom + 20);
            for (let x = a.left - 10; x <= a.right + 10; x += 8) ctx.lineTo(x, top + Math.sin(x / 18 + t * 4) * 6 + Math.sin(x / 7 - t * 6) * 2);
            ctx.lineTo(a.right + 10, a.bottom + 20); ctx.fill();
            ctx.shadowBlur = 0; for (let i = 0; i < 6; i++) { const bx = a.left + ((i * 53 + t * 40) % a.width), r = 4 + ((t * 3 + i) % 1) * 6; ctx.strokeStyle = "rgba(255,240,180,.8)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, top + 10, r, Math.PI, 0); ctx.stroke(); }
            ctx.restore();
        } });
        for (let i = 0; i < 4; i++) setTimeout(() => spray({ x: rnd(a.left, a.right), y: a.bottom - a.height * 0.3 }, 10, { color: ["#ffcf3f", "#ff6a00"], shape: "drop", speed: [200, 400], angle: -Math.PI / 2, spread: 0.5, size: [3, 5], g: 1000, life: [0.5, 0.9] }), K.still() ? 0 : 500 + i * 250);
        await wait(1600);
    });
    // Fire Up: a twister of flame and embers spirals up over your board, which catches fire round the edges
    D("fireup", async c => {
        const to = mid(myBoard()), list = [];
        for (let i = 0; i < (K.lite() ? 30 : 60); i++) list.push({ a: rnd(0, TAU), d: rnd(0, 0.6), r: rnd(30, 60), c: pick(["#ffcf3f", "#ff7a1f", "#ff3d00", "#fff3a0"]) });
        add({ life: 1.6, draw(ctx, k, t) {
            ctx.globalCompositeOperation = "lighter";
            for (const p of list) { const q = Math.max(0, Math.min(1, k * 1.6 - p.d)); if (q <= 0 || q >= 1) continue; const y = lerp(to.y + 200, to.y, ease(q)), a = p.a + q * 14, r = p.r * (1 - q); const x = to.x + Math.cos(a) * r; const g = ctx.createRadialGradient(x, y, 0, x, y, 9); g.addColorStop(0, "#fff"); g.addColorStop(0.3, p.c); g.addColorStop(1, "transparent"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fill(); }
        } });
        await wait(1100);
        glow(to, { color: "#ff7a1f", r: 120, life: 0.6 }); ring(to, { color: "#ffcf3f", r: 90, width: 8 });
        spray(to, 30, { color: ["#ffcf3f", "#ff7a1f"], shape: "ember", speed: [80, 260], size: [1.5, 3], g: -60, life: [0.5, 1] });
    });

    // ---- Deep Space ----
    // Black Hole: space tears open over the middle of the boss's board: an accretion disk, light bending around it,
    // and the letters stretched into spaghetti as they spiral in
    D("blackhole", async c => {
        const a = rect(c.area), p = { x: (a.left + a.right) / 2, y: (a.top + a.bottom) / 2 }, ghosts = letterGhosts(c.cells), R0 = Math.max(70, Math.min(a.width, a.height) * 0.42);
        add({ life: 2.2, draw(ctx, k, t) {
            const open = ease(Math.min(1, k * 3)), fade = k > 0.82 ? (1 - k) / 0.18 : 1, R1 = R0 * open;
            ctx.globalAlpha = fade;
            ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, 0.38);
            for (let i = 0; i < 4; i++) { ctx.strokeStyle = ["rgba(255,210,140,.9)", "rgba(255,150,80,.75)", "rgba(200,120,255,.6)", "rgba(120,160,255,.5)"][i]; ctx.lineWidth = 7 - i; ctx.shadowColor = "#ffb36b"; ctx.shadowBlur = 20; ctx.beginPath(); ctx.arc(0, 0, R1 * (1.15 + i * 0.22), t * (2 - i * 0.3), t * (2 - i * 0.3) + 5.2); ctx.stroke(); }
            ctx.restore();
            ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = "rgba(255,230,190,.7)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, R1 * 0.62, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
            ctx.globalCompositeOperation = "source-over"; const g = ctx.createRadialGradient(p.x, p.y, R1 * 0.2, p.x, p.y, R1 * 0.6); g.addColorStop(0, "#000"); g.addColorStop(0.85, "#000"); g.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, R1 * 0.6, 0, TAU); ctx.fill();
        } });
        burst(Array.from({ length: K.lite() ? 30 : 60 }, () => { const ang = rnd(0, TAU), r = rnd(R0 * 1.2, R0 * 2.4); return { x: p.x + Math.cos(ang) * r, y: p.y + Math.sin(ang) * r * 0.6, vx: -Math.cos(ang) * r * 0.9 - Math.sin(ang) * 120, vy: -Math.sin(ang) * r * 0.5 + Math.cos(ang) * 60, life: 1.3, size: rnd(1, 2.5), color: pick(["#ffffff", "#ffd8a8", "#c6b8ff"]), shape: "streak", add: true }; }));
        await wait(400);
        await Promise.all(ghosts.map(({ ghost, r }, i) => new Promise(res => setTimeout(() => {
            const dx = p.x - (r.left + r.width / 2), dy = p.y - (r.top + r.height / 2), ang = Math.atan2(dy, dx) * 180 / Math.PI;
            const anim = ghost.animate([{ transform: "none", opacity: 1 }, { transform: `translate(${dx * 0.5}px, ${dy * 0.5}px) rotate(${ang}deg) scaleX(2.6) scaleY(.4)`, opacity: 0.9, offset: 0.6 }, { transform: `translate(${dx}px, ${dy}px) rotate(${ang + 200}deg) scaleX(4) scaleY(.05)`, opacity: 0 }], { duration: 850, easing: "ease-in", fill: "forwards" });
            anim.onfinish = () => { ghost.remove(); res(); };
        }, K.still() ? 0 : i * 70))));
        flash("#000", 160, 0.25);
    });
    // Time Reversal: a ghostly clock appears over the boss's board, its hands whirl backwards with rewind streaks,
    // and the letters fly back up into the boss's quill
    D("reverse", async c => {
        const a = rect(c.area), o = { x: (a.left + a.right) / 2, y: (a.top + a.bottom) / 2 }, R0 = Math.min(a.width, a.height) * 0.45, ghosts = letterGhosts(c.cells), quill = mid(portrait());
        add({ life: 2, draw(ctx, k, t) {
            const fade = Math.sin(k * Math.PI);
            ctx.globalAlpha = fade * 0.85; ctx.strokeStyle = "#58d6ff"; ctx.shadowColor = "#58d6ff"; ctx.shadowBlur = 16; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(o.x, o.y, R0, 0, TAU); ctx.stroke();
            for (let i = 0; i < 12; i++) { const q = i * Math.PI / 6; ctx.beginPath(); ctx.moveTo(o.x + Math.cos(q) * R0 * 0.86, o.y + Math.sin(q) * R0 * 0.86); ctx.lineTo(o.x + Math.cos(q) * R0, o.y + Math.sin(q) * R0); ctx.stroke(); }
            const h = -t * 14;
            for (let j = 0; j < 6; j++) { ctx.globalAlpha = fade * (0.6 - j * 0.1); ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + Math.cos(h + j * 0.12) * R0 * 0.8, o.y + Math.sin(h + j * 0.12) * R0 * 0.8); ctx.stroke(); }
            ctx.globalAlpha = fade; ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + Math.cos(h / 12) * R0 * 0.5, o.y + Math.sin(h / 12) * R0 * 0.5); ctx.stroke();
            ctx.globalCompositeOperation = "lighter"; ctx.lineWidth = 2; for (let i = 0; i < 8; i++) { const q = -t * 6 + i * 0.8; ctx.beginPath(); ctx.arc(o.x, o.y, R0 * (1.1 + i * 0.05), q, q + 0.6); ctx.stroke(); }
        } });
        await wait(500);
        await Promise.all(ghosts.map(({ ghost, r }, i) => new Promise(res => setTimeout(() => {
            const dx = quill.x - (r.left + r.width / 2), dy = quill.y - (r.top + r.height / 2);
            const anim = ghost.animate([{ transform: "none", opacity: 1, filter: "none" }, { transform: `translate(${dx}px, ${dy}px) rotate(-540deg) scale(.3)`, opacity: 0, filter: "hue-rotate(160deg) blur(1px)" }], { duration: 800, easing: "ease-in", fill: "forwards" });
            anim.onfinish = () => { ghost.remove(); res(); };
        }, K.still() ? 0 : i * 80))));
    });
    // Wormhole: a pair of glowing portals opens on the boss's board, a starfield swirling inside, pulling at everything
    D("wormhole", async c => {
        const a = rect(c.area), p1 = { x: a.left + a.width * 0.3, y: a.top + a.height * 0.5 }, p2 = { x: a.left + a.width * 0.72, y: a.top + a.height * 0.45 }, stars = Array.from({ length: 30 }, () => ({ a: rnd(0, TAU), r: rnd(0, 1) }));
        add({ life: 2.2, draw(ctx, k, t) {
            const open = ease(Math.min(1, k * 2.5)), fade = k > 0.8 ? (1 - k) / 0.2 : 1;
            ctx.globalAlpha = fade;
            for (const [p, col] of [[p1, "#c06bff"], [p2, "#4fd2ff"]]) {
                const R1 = 46 * open;
                const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R1); g.addColorStop(0, "#05010f"); g.addColorStop(0.8, "#1a0b3a"); g.addColorStop(1, col);
                ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p.x, p.y, R1, R1 * 1.25, 0, 0, TAU); ctx.fill();
                ctx.fillStyle = "#fff"; for (const s of stars) { const a2 = s.a + t * 3, rr = s.r * R1 * 0.85; ctx.fillRect(p.x + Math.cos(a2) * rr, p.y + Math.sin(a2) * rr * 1.25, 1.5, 1.5); }
                ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.shadowColor = col; ctx.shadowBlur = 22; ctx.beginPath(); ctx.ellipse(p.x, p.y, R1, R1 * 1.25, 0, 0, TAU); ctx.stroke(); ctx.shadowBlur = 0;
            }
            if (open >= 1) { ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = "rgba(200,160,255,.4)"; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.bezierCurveTo(p1.x + 60, p1.y - 90 - i * 20 + Math.sin(t * 4) * 10, p2.x - 60, p2.y - 90 - i * 20, p2.x, p2.y); ctx.stroke(); } }
        } });
        burst(Array.from({ length: 40 }, () => { const s = Math.random() < 0.5 ? p1 : p2, ang = rnd(0, TAU), r = rnd(80, 160); return { x: s.x + Math.cos(ang) * r, y: s.y + Math.sin(ang) * r, vx: -Math.cos(ang) * r * 1.2, vy: -Math.sin(ang) * r * 1.2, life: 0.9, size: rnd(1.5, 3), color: pick(["#c06bff", "#4fd2ff", "#ffffff"]), shape: "streak", add: true, delay: rnd(0.3, 1) }; }));
        await wait(1500);
    });

    // =========================================================================================
    // The Celestial Rift (2026-10-14)
    // =========================================================================================
    // Constellation: a star lights on each crossing it fills, the stars join up with lines of gold, and they flare
    D("constellation", async c => {
        const ps = pts(c).length ? pts(c) : [mid(myBoard())];
        const order = ps.slice().sort((a, b) => a.x - b.x);
        add({ life: 2, draw(ctx, k, t) {
            const fade = k > 0.8 ? (1 - k) / 0.2 : 1, n = Math.min(order.length, Math.floor(k * 1.6 * order.length) + 1);
            ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = fade;
            ctx.strokeStyle = "rgba(255,214,120,.85)"; ctx.lineWidth = 2.5; ctx.shadowColor = "#ffd06b"; ctx.shadowBlur = 12;
            ctx.beginPath(); order.slice(0, n).forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
            ctx.shadowBlur = 0;
            order.slice(0, n).forEach((p, i) => { const tw = 0.6 + 0.4 * Math.sin(t * 9 + i); K.haloAt(ctx, p.x, p.y, 26 * tw, "#fff6d8", fade); ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, TAU); ctx.fill(); });
        } });
        order.forEach((p, i) => setTimeout(() => { glow(p, { color: "#ffd06b", r: 50, life: 0.5 }); Sound.tone({ f: Sound.midi(84 + i * 4), type: "sine", d: 0.6, v: 0.03, echo: 0.4 }); }, K.still() ? 0 : i * 260));
        await wait(1600);
        order.forEach(p => burst(Array.from({ length: 10 }, () => { const a = rnd(0, TAU), v = rnd(60, 200); return { x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.4, 0.8), size: rnd(2, 4), color: pick(["#fff6d8", "#ffd06b", "#ffffff"]), shape: "star", add: true }; })));
        await wait(400);
    });
    // Wish Upon a Star: a shooting star streaks down across the screen onto your board and stays there, glowing,
    // until your next word makes the wish come true
    D("wish", async c => {
        const o = mid(myBoard()), s0 = { x: o.x - innerWidth * 0.5, y: -40 }, path = [];
        add({ life: 1, draw(ctx, k) {
            const q = ease(Math.min(1, k * 1.15)), x = lerp(s0.x, o.x, q), y = lerp(s0.y, o.y, q);
            path.push([x, y]); if (path.length > 26) path.shift();
            ctx.globalCompositeOperation = "lighter";
            path.forEach(([px, py], i) => K.haloAt(ctx, px, py, 4 + i * 0.9, i % 3 ? "#c49bff" : "#fff6d8", i / path.length));
            K.haloAt(ctx, x, y, 34, "#fff6d8", 1); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fill();
            if (Math.random() < 0.6) spray({ x, y }, 1, { color: ["#fff6d8", "#c49bff"], shape: "star", speed: [20, 90], size: [2, 4], g: 120, life: [0.4, 0.8] });
        } });
        await wait(900);
        K.ring(o, { color: "#fff6d8", r: 140, width: 6, life: 0.6 });
        spray(o, 30, { color: ["#fff6d8", "#c49bff", "#ffd06b"], shape: "star", speed: [100, 320], size: [2, 5], g: 80, life: [0.5, 1], add: true });
        await wait(600);
    });
    // Rewrite Fate: a golden quill writes across your board; every letter the boss took comes back in ink and light
    D("fate", async c => {
        const ps = pts(c), b = rect(myBoard());
        const order = ps.length ? ps.slice().sort((a, p) => a.y - p.y || a.x - p.x) : [{ x: b.left + b.width * 0.2, y: b.top + b.height * 0.5 }, { x: b.right - b.width * 0.2, y: b.top + b.height * 0.5 }];
        add({ life: 0.5 + order.length * 0.16, draw(ctx, k) {
            const pos = k * (order.length - 1), i = Math.min(order.length - 2, Math.floor(pos)), a = order[Math.max(0, i)], bb = order[Math.min(order.length - 1, i + 1)], f = pos - Math.max(0, i);
            const x = order.length > 1 ? lerp(a.x, bb.x, f) : a.x, y = order.length > 1 ? lerp(a.y, bb.y, f) : a.y;
            ctx.save(); ctx.translate(x + 10, y - 26); ctx.rotate(0.7);
            ctx.fillStyle = "#fff6d8"; ctx.strokeStyle = "#c9902f"; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(0, 30); ctx.quadraticCurveTo(-10, 0, 0, -26); ctx.quadraticCurveTo(10, 0, 0, 30); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = "#e8c66a"; ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(0, 40); ctx.stroke();
            ctx.restore();
            K.haloAt(ctx, x, y, 30, "#ffd06b", 0.6);
        } });
        order.forEach((p, i) => setTimeout(() => { glow(p, { color: "#c49bff", r: 46, life: 0.5 }); spray(p, 8, { color: ["#c49bff", "#ffd06b", "#ffffff"], shape: "star", speed: [40, 140], size: [1.5, 3], g: 60, life: [0.3, 0.6], add: true }); }, K.still() ? 0 : 250 + i * 160));
        await wait(600 + order.length * 160);
    });
})();
