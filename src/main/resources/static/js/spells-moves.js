// Every boss move's own big effect (the user, 2026-10-09: the Thunderhead-lightning effort for every ability,
// "player and boss"). The boss's moves come FROM the boss (its portrait) and land ON you: your board, the squares they
// changed, your clue list, your abilities, your Super meter, your items. Each one is staged like the abilities in
// spells-abilities.js: a source, something that travels, the hit, the letters reacting, physical particles.
// Moves that power the boss up (Umbrella, Jet Stream...) play on the boss instead.
// c = { cells: [{el, ch}] (your squares it changed, with their old letters), area, from (the boss), to }
(() => {
    const K = Spells.kit;
    const { add, wait, rect, mid, rnd, jag, stroke, bolt, glow, splat, vine, vortex, letterGhosts, leave, TAU, pick, $, lerp, ease,
        portrait, bossBoard, myBoard, pts, cellsOf, sim, burst, spray, ring, lob, flash, drawEraser, drawAcorn, drawSnowball, drawPie } = K;
    const D = Spells.define;
    const settle = () => wait(60);                     // let the move's own classes land on the squares first
    const from = c => (portrait() ? mid(portrait()) : c.from);
    const board = () => rect(myBoard());
    const boardMid = () => mid(myBoard());
    const els = sel => cellsOf(sel).map(mid);
    const clues = () => $(".clues") || myBoard();
    const tone = o => Sound.tone({ ...o, boss: true });           // (at the move's or ability's level: Sound.bossLevel)
    const fade = (k, from = 0.8) => (k > from ? (1 - k) / (1 - from) : 1);
    // a straight shot from a to b with a glowing head and a trail (beams, jets, darts)
    function shot(a, b, { color = "#fff", size = 8, life = 0.45, trail = 18 } = {}) {
        return new Promise(res => {
            const path = [];
            add({ life, draw(ctx, k) {
                const q = ease(k), x = lerp(a.x, b.x, q), y = lerp(a.y, b.y, q);
                path.push([x, y]); if (path.length > trail) path.shift();
                ctx.globalCompositeOperation = "lighter";
                path.forEach(([px, py], i) => { ctx.globalAlpha = i / path.length * 0.7; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(px, py, size * (0.3 + 0.7 * i / path.length), 0, TAU); ctx.fill(); });
                ctx.globalAlpha = 1; ctx.fillStyle = "#fff"; ctx.shadowColor = color; ctx.shadowBlur = 20; ctx.beginPath(); ctx.arc(x, y, size * 0.7, 0, TAU); ctx.fill();
            } });
            setTimeout(res, K.still() ? 0 : life * 1000);
        });
    }
    // a cloud of soft puffs that billows out from a point (ink, smoke, steam, dust)
    function cloud(p, { colors, n = 30, r = 120, life = 1.6, rise = 0 } = {}) {
        burst(Array.from({ length: K.lite() ? n / 2 : n }, () => { const a = rnd(0, TAU), v = rnd(30, r); return { x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - rise, life: rnd(life * 0.7, life), size: rnd(14, 30), grow: 1.2, color: pick(colors), shape: "glow", drag: 1.4, alpha: 0.75 }; }));
    }
    // a ring of light that shrinks inward (pressure, suction)
    function implode(p, { color = "#fff", r = 200, life = 0.8, width = 5 } = {}) {
        add({ life, draw(ctx, k) { ctx.globalAlpha = k; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.shadowColor = color; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, r * (1 - ease(k))), 0, TAU); ctx.stroke(); } });
    }
    // draws a simple pen/marker/brush tip at x,y
    function drawPen(ctx, x, y, body, tip, ang = -0.7) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.strokeStyle = "#2b2233"; ctx.lineWidth = 2;
        ctx.fillStyle = tip; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(7, -16); ctx.lineTo(-7, -16); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = body; ctx.fillRect(-8, -90, 16, 74); ctx.strokeRect(-8, -90, 16, 74); ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(-5, -86, 4, 66);
        ctx.restore();
    }

    // =========================================================================================
    // Notebook: The Big Eraser
    // =========================================================================================
    // Rub Out: the boss's own eraser flies over and scrubs out your letters one by one, crumbs everywhere
    D("m-rubout", async c => {
        const ghosts = letterGhosts(c.cells), ps = pts(c).length ? pts(c) : [boardMid()];
        let i = 0;
        await lob(from(c), ps[0], { life: 0.5, height: 120, drawFn: (ctx, x, y, k) => drawEraser(ctx, x, y, k * 6) });
        for (const p of ps) {
            await new Promise(res => { add({ life: 0.42, draw(ctx, k, t) { drawEraser(ctx, p.x + Math.sin(t * 40) * 12, p.y - 4, -0.2 + Math.sin(t * 40) * 0.15); } }); setTimeout(res, K.still() ? 0 : 420); });
            spray(p, 14, { color: ["#ff9fb4", "#f6e9ee", "#e7c4cc"], shape: "crumb", speed: [80, 220], size: [2, 4], g: 700, life: [0.4, 0.8] });
            if (ghosts[i]) leave([ghosts[i]], "smear");
            i++;
        }
        await leave(ghosts.slice(i), "smear");
    });
    // Crumple: a giant hand of creases folds your board: crease lines shoot across it, the paper buckles, scraps fly
    D("m-crumple", async c => {
        await settle();
        const b = board(), o = boardMid(), lines = Array.from({ length: 12 }, () => { const a = rnd(0, TAU); return jag(o, { x: o.x + Math.cos(a) * b.width, y: o.y + Math.sin(a) * b.height }, 0.25, 4); });
        add({ life: 1.6, draw(ctx, k) {
            const grow = ease(Math.min(1, k * 2.5));
            ctx.save(); ctx.beginPath(); ctx.rect(b.left, b.top, b.width, b.height); ctx.clip(); ctx.globalAlpha = fade(k);
            for (const l of lines) { const n = Math.max(2, Math.floor(l.length * grow)); stroke(ctx, l.slice(0, n), 3, "rgba(255,255,255,.9)", "rgba(0,0,0,.3)"); ctx.save(); ctx.translate(2, 2); stroke(ctx, l.slice(0, n), 2, "rgba(60,50,70,.35)"); ctx.restore(); }
            ctx.restore();
        } });
        myBoard().animate([{ transform: "none" }, { transform: "scale(.94, .9) rotate(-1.5deg)", filter: "brightness(.92)" }, { transform: "scale(.98) rotate(.8deg)" }, { transform: "none" }], { duration: 700, easing: "ease-in-out" });
        tone({ f: 900, f2: 200, d: 0.25, v: 0.06, type: "sawtooth" });
        spray(o, 22, { color: ["#fffdf6", "#e6e8ef"], shape: "square", speed: [120, 340], size: [5, 10], g: 500, life: [0.6, 1.1], spin: 8 });
        await wait(900);
    });
    // Ink Blot: a fat drop of ink falls from above and bursts across the middle of your board
    D("m-inkblot", async c => {
        const o = boardMid(), b = board();
        await new Promise(res => { add({ life: 0.45, draw(ctx, k) { const y = lerp(-40, o.y, k * k); ctx.fillStyle = "#1a1424"; ctx.beginPath(); ctx.moveTo(o.x, y - 40); ctx.quadraticCurveTo(o.x + 22, y, o.x, y + 16); ctx.quadraticCurveTo(o.x - 22, y, o.x, y - 40); ctx.fill(); } }); setTimeout(res, K.still() ? 0 : 450); });
        FX.shake(8, 300);
        splat(o, { color: "#1a1424", r: Math.min(b.width, b.height) * 0.3, drips: 7, life: 2.4 });
        for (let i = 0; i < 6; i++) { const a = rnd(0, TAU), d = rnd(60, 140); splat({ x: o.x + Math.cos(a) * d, y: o.y + Math.sin(a) * d }, { color: "#1a1424", r: rnd(8, 16), drips: 1, life: 2.2 }); }
        spray(o, 40, { color: ["#1a1424", "#2e2547"], shape: "drop", speed: [200, 520], size: [3, 6], g: 800, life: [0.5, 1] });
        tone({ f: 120, f2: 40, d: 0.3, v: 0.25 });
        await wait(700);
    });
    // Permanent Marker: a huge black marker scrawls a "no erasing" sign across your board, squeaking as it goes
    D("m-nobackspace", async c => {
        const o = boardMid(), r = Math.min(board().width, board().height) * 0.36;
        const path = [];
        for (let a = 0; a <= TAU; a += 0.12) path.push([o.x + Math.cos(a - 2) * r, o.y + Math.sin(a - 2) * r]);
        for (let s = 0; s <= 1; s += 0.06) path.push([o.x - r * 0.7 + r * 1.4 * s, o.y - r * 0.7 + r * 1.4 * s]);
        add({ life: 2, draw(ctx, k) {
            const n = Math.max(2, Math.floor(path.length * Math.min(1, k * 1.6)));
            ctx.globalAlpha = fade(k, 0.7) * 0.85; ctx.strokeStyle = "#151020"; ctx.lineWidth = 16; ctx.lineCap = "round"; ctx.lineJoin = "round";
            ctx.beginPath(); path.slice(0, n).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
            ctx.globalAlpha = 1; const [x, y] = path[n - 1]; if (k < 0.65) drawPen(ctx, x, y, "#2b2233", "#151020");
        } });
        for (let i = 0; i < 4; i++) setTimeout(() => tone({ f: 1400 + i * 120, f2: 900, d: 0.08, v: 0.03, type: "square" }), K.still() ? 0 : i * 260);
        await wait(1400);
    });
    // Red Pen: a red pen darts around your board, circling your RIGHT letters and slashing them with fake marks
    D("m-fakecheck", async c => {
        await settle();
        const marks = els("#board .cell.wrong").slice(0, 8), list = marks.length ? marks : [boardMid()];
        for (let i = 0; i < list.length; i++) {
            const p = list[i], start = i ? list[i - 1] : from(c);
            await new Promise(res => { add({ life: 0.32, draw(ctx, k) { drawPen(ctx, lerp(start.x, p.x, ease(k)), lerp(start.y, p.y, ease(k)), "#e2283c", "#c42536", -0.5); } }); setTimeout(res, K.still() ? 0 : 280); });
            add({ life: 1.4, draw(ctx, k) { const g2 = ease(Math.min(1, k * 4)); ctx.globalAlpha = fade(k); ctx.strokeStyle = "#e2283c"; ctx.lineWidth = 3.5; ctx.lineCap = "round"; ctx.beginPath(); ctx.ellipse(p.x, p.y, 24, 20, -0.3, 0, TAU * g2); ctx.stroke(); if (g2 >= 1) { ctx.beginPath(); ctx.moveTo(p.x - 14, p.y + 12); ctx.lineTo(p.x + 14, p.y - 12); ctx.stroke(); } } });
            tone({ f: 1800, f2: 1200, d: 0.06, v: 0.04, type: "triangle" });
        }
        await wait(500);
    });

    // =========================================================================================
    // Garden: Queen Thistle
    // =========================================================================================
    // Thorn Tangle: black brambles burst out of the ground and coil around 3 of your empty squares
    D("m-thorns", async c => {
        await settle();
        const b = board(), targets = els("#board .cell.thorny"), list = targets.length ? targets : [boardMid()];
        list.forEach((p, i) => {
            const edge = [{ x: b.left - 10, y: rnd(b.top, b.bottom) }, { x: b.right + 10, y: rnd(b.top, b.bottom) }, { x: rnd(b.left, b.right), y: b.bottom + 10 }][i % 3];
            vine(edge, p, { color: "#3b2a1a", leaf: "#7a1f2a", life: 2.2 });
            setTimeout(() => add({ life: 1.5, draw(ctx, k) {
                const g2 = ease(Math.min(1, k * 2.5)); ctx.globalAlpha = fade(k);
                ctx.strokeStyle = "#3b2a1a"; ctx.lineWidth = 4; ctx.beginPath(); for (let s = 0; s < TAU * 2 * g2; s += 0.2) ctx.lineTo(p.x + Math.cos(s * 2) * 18, p.y + Math.sin(s * 3) * 14); ctx.stroke();
                ctx.fillStyle = "#1d140c"; for (let s = 0; s < 10 * g2; s++) { const a = s * 0.63, x = p.x + Math.cos(a) * 20, y = p.y + Math.sin(a) * 17; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9); ctx.lineTo(x + Math.cos(a + 0.5) * 3, y + Math.sin(a + 0.5) * 3); ctx.fill(); }
            } }), K.still() ? 0 : 650);
        });
        await wait(800);
        list.forEach(p => spray(p, 8, { color: ["#7a1f2a", "#3b2a1a"], shape: "leaf", speed: [60, 160], size: [4, 7], g: 300, life: [0.5, 0.9] }));
        await wait(500);
    });
    // Petal Storm: a whirl of petals pours out of the queen and piles up over your clue list
    D("m-petals", async c => {
        const a = rect(clues()), f = from(c), list = [];
        for (let i = 0; i < (K.lite() ? 60 : 120); i++) { const tx = rnd(a.left, a.right), ty = rnd(a.top, a.bottom); list.push({ x: f.x + rnd(-30, 30), y: f.y + rnd(-30, 30), tx, ty, d: rnd(0, 0.5), c: pick(["#ffc1d9", "#ff8fb8", "#ffffff", "#e3b8ff"]), s: rnd(5, 9), r: rnd(0, 6) }); }
        add({ life: 2.2, draw(ctx, k, t) {
            ctx.globalAlpha = fade(k, 0.85);
            for (const p of list) { const q = Math.max(0, Math.min(1, (k * 1.4 - p.d) / 0.6)), e = ease(q); const x = lerp(p.x, p.tx, e) + Math.sin(q * 9 + p.r) * 60 * (1 - q), y = lerp(p.y, p.ty, e) - Math.sin(q * Math.PI) * 120;
                ctx.save(); ctx.translate(x, y); ctx.rotate(p.r + t * 4 * (1 - q)); ctx.fillStyle = p.c; ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, TAU); ctx.fill(); ctx.restore(); }
        } });
        await wait(1500);
    });
    // Aphid Swarm: a buzzing cloud of little green bugs streams out of the queen; one lands on your board
    D("m-minion", async c => {
        const f = from(c), b = boardMid(), list = [];
        for (let i = 0; i < 26; i++) list.push({ ph: rnd(0, TAU), sp: rnd(6, 12), off: rnd(20, 70), d: rnd(0, 0.3) });
        add({ life: 1.6, draw(ctx, k, t) {
            ctx.globalAlpha = fade(k, 0.75);
            for (const p of list) { const q = Math.max(0, Math.min(1, k * 1.4 - p.d)), x = lerp(f.x, b.x, ease(q)) + Math.cos(t * p.sp + p.ph) * p.off * (1 - q * 0.6), y = lerp(f.y, b.y, ease(q)) + Math.sin(t * p.sp * 1.3 + p.ph) * p.off * 0.6 - Math.sin(q * Math.PI) * 80;
                ctx.fillStyle = "#7be36b"; ctx.beginPath(); ctx.ellipse(x, y, 4, 3, 0, 0, TAU); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.beginPath(); ctx.ellipse(x - 1, y - 3, 2.5, 1.5, Math.sin(t * 40) * 0.6, 0, TAU); ctx.fill(); }
        } });
        for (let i = 0; i < 6; i++) setTimeout(() => tone({ f: 220 + Math.random() * 40, f2: 240, d: 0.12, v: 0.03, type: "sawtooth" }), K.still() ? 0 : i * 120);
        await wait(1300);
        spray(b, 12, { color: ["#7be36b", "#3fbf6b"], shape: "dot", speed: [40, 140], size: [2, 3], g: 200, life: [0.3, 0.6] });
    });
    // Wilt: dark tendrils reach out of the queen and suck the colour out of your board; dead petals fall
    D("m-drain", async c => {
        const m = boardMid(), f = from(c);
        add({ life: 1.6, draw(ctx, k, t) {
            ctx.globalAlpha = fade(k); ctx.strokeStyle = "#4a3a2a"; ctx.lineWidth = 3; ctx.lineCap = "round";
            for (let i = 0; i < 4; i++) { const reach = ease(Math.min(1, k * 2)); ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.bezierCurveTo(f.x + 60 * Math.sin(t * 3 + i), f.y + 80, m.x - 40 + i * 20, m.y - 60, lerp(f.x, m.x, reach), lerp(f.y, m.y, reach)); ctx.stroke(); }
        } });
        await wait(500);
        burst(Array.from({ length: 30 }, () => ({ x: m.x + rnd(-30, 30), y: m.y + rnd(-30, 30), vx: (f.x - m.x) * rnd(0.6, 1.1), vy: (f.y - m.y) * rnd(0.6, 1.1), life: 1, size: rnd(3, 6), color: pick(["#ff5fa2", "#ffd23f", "#7ad7ff"]), shape: "glow", add: true, delay: rnd(0, 0.4) })));
        spray({ x: m.x, y: m.y - 20 }, 16, { color: ["#8a6a4a", "#6b4a2a", "#a08060"], shape: "petal", speed: [20, 80], angle: Math.PI / 2, spread: 1, size: [5, 8], g: 120, life: [1, 1.6], wob: [4, 60], delay: 0.3 });
        await wait(1000);
    });
    // Weed Wrap: weeds spiral up around each of your ability buttons and knot shut
    D("m-seal", async c => {
        const btns = cellsOf(".bp-ab").map(rect);
        btns.forEach((r, i) => setTimeout(() => add({ life: 2.2, draw(ctx, k) {
            const g2 = ease(Math.min(1, k * 2)); ctx.globalAlpha = fade(k, 0.85);
            ctx.strokeStyle = "#3f7a2c"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath();
            for (let s = 0; s < g2; s += 0.01) { const x = r.left + r.width * (0.5 + Math.sin(s * TAU * 3) * 0.48), y = r.bottom - r.height * s; ctx.lineTo(x, y); }
            ctx.stroke(); ctx.fillStyle = "#6fbf4a"; for (let s = 0.1; s < g2; s += 0.14) { const x = r.left + r.width * (0.5 + Math.sin(s * TAU * 3) * 0.48), y = r.bottom - r.height * s; ctx.beginPath(); ctx.ellipse(x, y, 7, 3.5, s * 9, 0, TAU); ctx.fill(); }
        } }), K.still() ? 0 : i * 120));
        await wait(1500);
    });

    // =========================================================================================
    // Acorn Woods: Old Grumbleowl
    // =========================================================================================
    // Hoot Hoot: the owl's hoot rolls out in sound rings over your clue list; feathers fly and the clue letters jumble
    D("m-hoot", async c => {
        const f = from(c), a = rect(clues()), o = mid(clues());
        for (let i = 0; i < 4; i++) setTimeout(() => add({ life: 1, draw(ctx, k) { ctx.globalAlpha = 1 - k; ctx.strokeStyle = "#e8792b"; ctx.lineWidth = 4; const x = lerp(f.x, o.x, k), y = lerp(f.y, o.y, k); ctx.beginPath(); ctx.arc(x, y, 30 + k * 90, -0.9, 0.9); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 30 + k * 90, Math.PI - 0.9, Math.PI + 0.9); ctx.stroke(); } }), K.still() ? 0 : i * 180);
        await wait(700);
        spray(o, 14, { color: ["#8a5a2b", "#c9a07a", "#f6ecd2"], shape: "leaf", speed: [60, 200], size: [6, 10], g: 80, life: [1, 1.6], wob: [5, 100], jitter: a.width / 3 });
        burst(Array.from({ length: 24 }, () => ({ x: rnd(a.left, a.right), y: rnd(a.top, a.bottom), vx: rnd(-80, 80), vy: rnd(-80, 80), life: 0.9, size: 16, color: "rgba(43,34,51,.8)", shape: "text", text: pick("ABCDEFGHIKLMNOPRSTUW".split("")), vr: rnd(-6, 6), drag: 2 })));
        await wait(700);
    });
    // Acorn Drop: a shower of acorns rains onto your board and knocks your letters into the wrong squares
    D("m-acorns", async c => {
        const ghosts = letterGhosts(c.cells), ps = pts(c).length ? pts(c) : [boardMid()];
        await Promise.all(ps.map((p, i) => new Promise(async res => {
            await wait(i * 110);
            await new Promise(r2 => { add({ life: 0.45, draw(ctx, k) { drawAcorn(ctx, p.x + (1 - k) * 30, lerp(-30, p.y, k * k), 13, k * 10); } }); setTimeout(r2, K.still() ? 0 : 450); });
            ring(p, { color: "#fff3d6", r: 34, width: 5 });
            spray(p, 10, { color: ["#c9a07a", "#8a5a2b"], shape: "crumb", speed: [80, 220], size: [2, 4], g: 700, life: [0.4, 0.7] });
            const dir = Math.random() < 0.5 ? -1 : 1;
            add({ life: 0.7, draw(ctx, k, t) { drawAcorn(ctx, p.x + dir * 150 * t, p.y - 260 * t + 700 * t * t, 13, t * 16); } });
            if (ghosts[i]) leave([ghosts[i]], "pop");
            tone({ f: 380 + i * 50, f2: 180, d: 0.07, v: 0.15, type: "square" });
            res();
        })));
        await leave(ghosts.slice(ps.length), "pop");
    });
    // Nightfall: night creeps in from the edges of the screen; stars come out and a cold moon rises over your board
    D("m-darkcreep", async c => {
        const b = board(), o = boardMid(), stars = Array.from({ length: 40 }, () => ({ x: rnd(0, innerWidth), y: rnd(0, innerHeight), s: rnd(0.8, 2), ph: rnd(0, 6) }));
        add({ life: 2.6, draw(ctx, k, t) {
            const close = ease(Math.min(1, k * 1.6)), a = fade(k, 0.75);
            const g = ctx.createRadialGradient(o.x, o.y, Math.max(1, (1 - close) * innerWidth * 0.9), o.x, o.y, innerWidth); g.addColorStop(0, "rgba(10,8,30,0)"); g.addColorStop(1, `rgba(10,8,30,${0.85 * a})`);
            ctx.fillStyle = g; ctx.fillRect(0, 0, innerWidth, innerHeight);
            ctx.globalAlpha = a * close; ctx.fillStyle = "#fff"; for (const s of stars) { ctx.globalAlpha = a * close * (0.5 + Math.sin(t * 4 + s.ph) * 0.5); ctx.fillRect(s.x, s.y, s.s, s.s); }
            ctx.globalAlpha = a; const my = lerp(b.top + 40, b.top - 50, close); ctx.fillStyle = "#f6f0d0"; ctx.shadowColor = "#f6f0d0"; ctx.shadowBlur = 30; ctx.beginPath(); ctx.arc(b.right - 30, my, 26, 0, TAU); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = "rgba(10,8,30,.9)"; ctx.beginPath(); ctx.arc(b.right - 18, my - 8, 24, 0, TAU); ctx.fill();
        } });
        await wait(1600);
    });
    // Silent Wings: (on the boss) a great shadow of wings sweeps silently past; feathers drift down, then nothing
    D("m-ambush", async c => {
        const p = from(c), r = rect(portrait() || c.area);
        add({ life: 1.6, draw(ctx, k, t) {
            const x = lerp(r.left - 160, r.right + 160, ease(k)), flap = Math.sin(t * 9) * 0.4;
            ctx.globalAlpha = Math.sin(k * Math.PI) * 0.75; ctx.fillStyle = "rgba(30,20,40,.9)";
            ctx.save(); ctx.translate(x, p.y - 20); ctx.scale(2.2, 2.2);
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-40, -30 - flap * 30, -90, -5 + flap * 20); ctx.quadraticCurveTo(-40, 6, 0, 8); ctx.fill();
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(40, -30 - flap * 30, 90, -5 + flap * 20); ctx.quadraticCurveTo(40, 6, 0, 8); ctx.fill(); ctx.restore();
        } });
        spray({ x: p.x, y: p.y - 40 }, 12, { color: ["#5a4a5a", "#8a7a8a"], shape: "leaf", speed: [20, 80], angle: Math.PI / 2, spread: 1.2, size: [6, 10], g: 60, life: [1.4, 2], wob: [3, 80], delay: 0.5 });
        await wait(1500);
    });
    // Stash Raid: a squirrel paw darts down, snatches a glowing acorn out of one of your ability buttons and runs off
    D("m-steal", async c => {
        const btn = pick(cellsOf(".bp-ab")) || myBoard(), b = mid(btn), f = from(c);
        await lob(f, b, { life: 0.4, height: 60, drawFn: (ctx, x, y) => { ctx.fillStyle = "#8a5a2b"; ctx.beginPath(); ctx.ellipse(x, y, 14, 10, 0, 0, TAU); ctx.fill(); for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.ellipse(x + i * 7, y + 10, 3, 6, 0, 0, TAU); ctx.fill(); } } });
        btn.animate && btn.animate([{ transform: "none" }, { transform: "translateY(4px) scale(.93)" }, { transform: "none" }], { duration: 300 });
        spray(b, 14, { color: ["#ffe066", "#fff"], shape: "star", speed: [80, 200], size: [2, 4], g: 200, life: [0.3, 0.6], add: true });
        tone({ f: 900, f2: 1400, d: 0.1, v: 0.08, type: "triangle" });
        await lob(b, f, { life: 0.6, height: 140, trail: "rgba(255,220,100,.7)", drawFn: (ctx, x, y, k) => { ctx.shadowColor = "#ffd23f"; ctx.shadowBlur = 16; drawAcorn(ctx, x, y, 11, k * 10); } });
        glow(f, { color: "#ffd23f", r: 60 });
    });

    // =========================================================================================
    // Candy Hills: King Sourgum
    // =========================================================================================
    // Sour Splash: the king squeezes a giant lemon: sour juice sprays over your board, fizzing, and your letters fade out
    D("m-sour", async c => {
        const f = from(c), o = boardMid(), b = board(), ghosts = letterGhosts(c.cells);
        add({ life: 0.5, draw(ctx, k) { const s = 1 - k * 0.4; ctx.save(); ctx.translate(f.x, f.y - 20); ctx.scale(1 + k * 0.3, s); ctx.fillStyle = "#f5e642"; ctx.strokeStyle = "#2b2233"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(0, 0, 36, 26, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore(); } });
        await wait(300);
        burst(Array.from({ length: K.lite() ? 50 : 100 }, () => { const tx = rnd(b.left, b.right), ty = rnd(b.top, b.bottom), t = rnd(0.5, 0.8); return { x: f.x, y: f.y, vx: (tx - f.x) / t, vy: (ty - f.y) / t - 300, g: 600 / t, life: t + 0.4, size: rnd(2.5, 5), color: pick(["#d6f04a", "#f5e642", "#b8e04a", "#fff8a0"]), shape: "drop", delay: rnd(0, 0.25) }; }));
        await wait(700);
        for (let i = 0; i < 5; i++) spray({ x: rnd(b.left, b.right), y: rnd(b.top, b.bottom) }, 6, { shape: "bubble", color: "#fff", speed: [10, 50], angle: -Math.PI / 2, spread: 1, size: [2, 5], g: -80, life: [0.6, 1] });
        await leave(ghosts, "smear", { stagger: 25 });
    });
    // Sticky Floor: thick honey pours down over your board in glossy drips that pool at the bottom
    D("m-sticky", async c => {
        const b = board(), drips = Array.from({ length: 9 }, (_, i) => ({ x: b.left + (i + 0.5) * b.width / 9 + rnd(-8, 8), w: rnd(14, 26), len: rnd(0.4, 1), sp: rnd(0.8, 1.2) }));
        add({ life: 2.4, draw(ctx, k) {
            ctx.globalAlpha = fade(k, 0.8) * 0.85;
            const g = ctx.createLinearGradient(0, b.top, 0, b.bottom); g.addColorStop(0, "#f2a93b"); g.addColorStop(1, "#c9781a");
            ctx.fillStyle = g; ctx.fillRect(b.left - 6, b.top - 10, b.width + 12, 18);
            for (const d of drips) { const h = b.height * d.len * ease(Math.min(1, k * d.sp * 1.5)); ctx.beginPath(); ctx.moveTo(d.x - d.w / 2, b.top); ctx.lineTo(d.x - d.w / 2, b.top + h); ctx.arc(d.x, b.top + h, d.w / 2, Math.PI, 0, true); ctx.lineTo(d.x + d.w / 2, b.top); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.fillRect(d.x - d.w / 4, b.top + 6, 3, Math.max(0, h - 10)); ctx.fillStyle = g; }
        } });
        await wait(1500);
    });
    // Sugar Rush (the king's): candy shrapnel bursts out of your board in zigzags while it shakes
    D("m-jitter", async c => {
        const o = boardMid();
        for (let i = 0; i < 3; i++) {
            const p = { x: o.x + rnd(-80, 80), y: o.y + rnd(-60, 60) };
            spray(p, 26, { color: ["#ff5fa2", "#7ad7ff", "#ffd23f", "#7dff6b", "#c08bff"], shape: "square", speed: [200, 480], size: [3, 6], g: 400, life: [0.5, 0.9], spin: 12 });
            add({ life: 0.4, draw(ctx, k) { ctx.globalAlpha = 1 - k; ctx.strokeStyle = pick(["#ff5fa2", "#7ad7ff", "#ffd23f"]); ctx.lineWidth = 3; ctx.beginPath(); for (let j = 0; j < 12; j++) ctx.lineTo(p.x - 80 + j * 14, p.y + (j % 2 ? -12 : 12) * (1 + k)); ctx.stroke(); } });
            FX.shake(7, 200);
            tone({ f: 600 + i * 200, f2: 1200, d: 0.08, v: 0.08, type: "square" });
            await wait(220);
        }
        await wait(300);
    });
    // Gum Bubble: a pink bubble of gum blows up out of your current word, wobbles... and sticks over it
    D("m-bubble", async c => {
        await settle();
        const cells = els("#board .cell.gummed"), list = cells.length ? cells : els("#board .cell.in-word");
        const p = list.length ? { x: list.reduce((s, q) => s + q.x, 0) / list.length, y: list.reduce((s, q) => s + q.y, 0) / list.length } : boardMid();
        sim(1.8, (ctx, dt, t, k) => {
            const grow = Math.min(1, t / 0.7), r = 90 * ease(grow) * (1 + (grow >= 1 ? Math.sin((t - 0.7) * 20) * 0.06 * Math.exp(-(t - 0.7) * 4) : 0));
            ctx.globalAlpha = fade(k, 0.8) * 0.8;
            const g = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, 0, p.x, p.y, Math.max(1, r)); g.addColorStop(0, "rgba(255,220,240,.9)"); g.addColorStop(0.6, "rgba(255,120,190,.6)"); g.addColorStop(1, "rgba(230,70,150,.8)");
            ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p.x, p.y, Math.max(1, r * 1.3), Math.max(1, r), 0, 0, TAU); ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.beginPath(); ctx.ellipse(p.x - r * 0.5, p.y - r * 0.45, r * 0.18, r * 0.09, -0.6, 0, TAU); ctx.fill();
        });
        await wait(700);
        tone({ f: 140, f2: 90, d: 0.15, v: 0.2 });
        await wait(800);
    });
    // Butterfingers: pats of butter slap onto your board and smear into greasy, glistening streaks
    D("m-fumble", async c => {
        const f = from(c), b = board();
        for (let i = 0; i < 5; i++) {
            const p = { x: rnd(b.left + 20, b.right - 20), y: rnd(b.top + 20, b.bottom - 20) };
            lob(f, p, { life: 0.45, height: 120, drawFn: (ctx, x, y, k) => { ctx.save(); ctx.translate(x, y); ctx.rotate(k * 6); ctx.fillStyle = "#ffe48a"; ctx.strokeStyle = "#c9a43a"; ctx.lineWidth = 2; ctx.fillRect(-12, -8, 24, 16); ctx.strokeRect(-12, -8, 24, 16); ctx.restore(); } })
                .then(() => { add({ life: 1.4, draw(ctx, k) { ctx.globalAlpha = fade(k, 0.6) * 0.6; ctx.fillStyle = "#ffe48a"; ctx.beginPath(); ctx.ellipse(p.x + k * 20, p.y, 16 + k * 26, 8, 0.2, 0, TAU); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.fillRect(p.x - 8 + k * 30, p.y - 3, 10, 2); } }); spray(p, 5, { color: "#fff", shape: "star", speed: [20, 60], size: [1.5, 3], g: 0, life: [0.5, 0.9], add: true }); });
            await wait(120);
        }
        await wait(1000);
    });

    // =========================================================================================
    // Coral Reef: The Kraken
    // =========================================================================================
    // Ink Jet: the Kraken blasts a jet of ink across the screen; it billows into a cloud over your board
    D("m-ink", async c => {
        const f = from(c), o = boardMid();
        burst(Array.from({ length: K.lite() ? 40 : 80 }, () => { const t = rnd(0.35, 0.6); return { x: f.x, y: f.y, vx: (o.x - f.x) / t + rnd(-60, 60), vy: (o.y - f.y) / t + rnd(-60, 60), drag: 1.2, life: t + 0.8, size: rnd(10, 22), grow: 1.5, color: pick(["rgba(26,20,36,.8)", "rgba(46,37,71,.7)", "rgba(20,15,30,.85)"]), shape: "glow" }; }));
        await wait(450);
        cloud(o, { colors: ["rgba(26,20,36,.75)", "rgba(46,37,71,.6)"], n: 40, r: 180, life: 1.8 });
        tone({ f: 200, f2: 60, d: 0.4, v: 0.18, type: "sawtooth" });
        await wait(900);
    });
    // Whirlpool: the water over your board starts to turn: foaming arms spiral faster and faster, bubbles sucked in
    D("m-whirl", async c => {
        const o = boardMid(), R0 = Math.max(board().width, board().height) * 0.6;
        add({ life: 2, draw(ctx, k, t) {
            ctx.globalAlpha = Math.sin(k * Math.PI) * 0.85;
            for (let arm = 0; arm < 5; arm++) { ctx.strokeStyle = arm % 2 ? "rgba(140,220,255,.8)" : "rgba(230,250,255,.9)"; ctx.lineWidth = 4; ctx.beginPath(); for (let s = 0; s < 1; s += 0.02) { const a = arm * TAU / 5 + s * 7 + t * (3 + k * 6), r = R0 * (1 - s); ctx.lineTo(o.x + Math.cos(a) * r, o.y + Math.sin(a) * r * 0.8); } ctx.stroke(); }
            const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, 40); g.addColorStop(0, "rgba(10,40,80,.9)"); g.addColorStop(1, "transparent"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(o.x, o.y, 40, 0, TAU); ctx.fill();
        } });
        burst(Array.from({ length: 30 }, () => { const a = rnd(0, TAU), r = rnd(R0 * 0.6, R0); return { x: o.x + Math.cos(a) * r, y: o.y + Math.sin(a) * r, vx: -Math.cos(a) * r * 0.7 - Math.sin(a) * 200, vy: -Math.sin(a) * r * 0.7 + Math.cos(a) * 200, life: 1.3, size: rnd(3, 7), color: "#fff", shape: "bubble", drag: 0.4 }; }));
        await wait(1300);
    });
    // Tidal Wave: a towering wave curls in from the side and crashes over your board in a blast of spray
    D("m-tidal", async c => {
        const b = board(), ghosts = letterGhosts(c.cells);
        add({ life: 1.5, draw(ctx, k, t) {
            const x = lerp(b.left - 200, b.right + 220, ease(Math.min(1, k * 1.3))), h = b.height * 1.25, base = b.bottom + 20;
            ctx.globalAlpha = fade(k, 0.75);
            const g = ctx.createLinearGradient(0, base - h, 0, base); g.addColorStop(0, "rgba(120,220,255,.9)"); g.addColorStop(1, "rgba(20,90,170,.9)");
            ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(b.left - 300, base); ctx.lineTo(b.left - 300, base - h * 0.5);
            ctx.bezierCurveTo(x - 200, base - h * 0.7, x - 60, base - h * 1.05, x + 40, base - h * 0.8); ctx.quadraticCurveTo(x - 10, base - h * 0.62, x + 10, base - h * 0.48); ctx.bezierCurveTo(x + 80, base - h * 0.3, x + 120, base - 10, x + 160, base); ctx.fill();
            ctx.strokeStyle = "#fff"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x - 60, base - h * 1.0); ctx.quadraticCurveTo(x + 10, base - h * 1.02, x + 40, base - h * 0.8); ctx.stroke();
            if (Math.random() < 0.6) spray({ x: x + 30, y: base - h * 0.85 }, 3, { color: ["#ffffff", "#c9ecff"], shape: "drop", speed: [100, 300], angle: -0.6, spread: 0.8, size: [2, 5], g: 900, life: [0.5, 0.9] });
        } });
        await wait(600);
        FX.shake(10, 400);
        await leave(ghosts, "wash", { stagger: 30 });
    });
    // Riptide: a current rips backwards across your board: flowing lines and little fish swept the wrong way
    D("m-backwards", async c => {
        const b = board();
        burst(Array.from({ length: 36 }, () => ({ x: b.right + rnd(0, 200), y: rnd(b.top, b.bottom), vx: -rnd(500, 800), vy: 0, life: 1.4, size: rnd(30, 70), color: "rgba(200,240,255,.7)", shape: "streak", wob: [6, 120], ph: rnd(0, 6) })));
        for (let i = 0; i < 6; i++) { const y = rnd(b.top + 10, b.bottom - 10); add({ life: 1.3, draw(ctx, k) { const x = lerp(b.right + 40, b.left - 60, k); ctx.save(); ctx.translate(x, y + Math.sin(k * 20) * 6); ctx.fillStyle = pick(["#ff9f2e", "#ffd23f", "#4fd2ff"]); ctx.beginPath(); ctx.ellipse(0, 0, 10, 5, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(16, -6); ctx.lineTo(16, 6); ctx.fill(); ctx.restore(); } }); }
        await wait(1200);
    });
    // Deep Pressure: the ocean presses in: dark rings close on your board from all sides, bubbles squashed flat
    D("m-shrink", async c => {
        const o = boardMid(), R0 = Math.max(board().width, board().height);
        for (let i = 0; i < 4; i++) setTimeout(() => implode(o, { color: "rgba(80,160,230,.9)", r: R0 * (1.1 - i * 0.1), life: 0.9, width: 8 }), K.still() ? 0 : i * 200);
        add({ life: 1.8, draw(ctx, k) { const g = ctx.createRadialGradient(o.x, o.y, Math.max(1, R0 * (1 - k * 0.5) * 0.4), o.x, o.y, R0); g.addColorStop(0, "rgba(5,20,50,0)"); g.addColorStop(1, `rgba(5,20,50,${0.7 * Math.sin(k * Math.PI)})`); ctx.fillStyle = g; ctx.fillRect(0, 0, innerWidth, innerHeight); } });
        tone({ f: 80, f2: 50, d: 0.8, v: 0.25 });
        await wait(1200);
    });

    // =========================================================================================
    // Snow Day: The Yeti
    // =========================================================================================
    // Deep Freeze: the Yeti's icy breath roars across the screen; frost locks over your board in crystals
    D("m-freeze", async c => {
        const f = from(c), o = boardMid();
        burst(Array.from({ length: K.lite() ? 40 : 80 }, () => { const t = rnd(0.4, 0.7); return { x: f.x, y: f.y, vx: (o.x - f.x) / t + rnd(-80, 80), vy: (o.y - f.y) / t + rnd(-80, 80), drag: 0.8, life: t + 0.4, size: rnd(8, 18), grow: 1, color: pick(["rgba(230,248,255,.7)", "rgba(190,230,255,.6)"]), shape: "glow" }; }));
        await wait(500);
        K.frost(o, board(), { life: 2 });
        spray(o, 30, { color: "#ffffff", shape: "flake", speed: [80, 260], size: [5, 9], g: 40, life: [1, 1.6], spin: 3 });
        flash("#e8f8ff", 200, 0.4);
        tone({ f: 2400, f2: 800, d: 0.5, v: 0.05, type: "triangle" });
        await wait(800);
    });
    // Whiteout: a white blizzard roars in, and snow drifts pile up over half your squares
    D("m-whiteout", async c => {
        await settle();
        const b = board(), piles = els("#board .cell.snowed");
        K.stream(b, { colors: ["#ffffff", "#e8f4ff"], n: 260, size: [2, 5], wobble: 2, life: 1.6 });
        burst(Array.from({ length: K.lite() ? 30 : 60 }, () => ({ x: b.left - rnd(0, 200), y: rnd(b.top - 40, b.bottom + 40), vx: rnd(600, 1000), vy: rnd(-20, 80), life: 1.3, size: rnd(5, 9), color: "#fff", shape: "flake", vr: rnd(-6, 6) })));
        piles.forEach((p, i) => setTimeout(() => add({ life: 1.4, draw(ctx, k) { const g2 = ease(Math.min(1, k * 2)); ctx.globalAlpha = fade(k, 0.7); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(p.x, p.y + 14 - 10 * g2, 26, 14 * g2, 0, Math.PI, TAU); ctx.fill(); } }), K.still() ? 0 : 500 + i * 30));
        await wait(1500);
    });
    // Avalanche: a rumbling wall of snow and boulders tumbles down over your board from the top
    D("m-avalanche", async c => {
        const b = board();
        add({ life: 2, draw(ctx, k, t) {
            const y = lerp(b.top - 160, b.bottom + 40, ease(Math.min(1, k * 1.2)));
            ctx.globalAlpha = fade(k, 0.75); ctx.fillStyle = "#f4f9ff";
            ctx.beginPath(); ctx.moveTo(b.left - 40, b.top - 200); ctx.lineTo(b.right + 40, b.top - 200); ctx.lineTo(b.right + 40, y);
            for (let x = b.right + 40; x >= b.left - 40; x -= 16) ctx.lineTo(x, y + Math.sin(x / 20 + t * 10) * 14 + Math.abs(Math.sin(x / 7)) * 10); ctx.fill();
        } });
        burst(Array.from({ length: 16 }, () => ({ x: rnd(b.left, b.right), y: b.top - rnd(60, 200), vx: rnd(-60, 60), vy: rnd(200, 400), g: 900, life: 1.6, size: rnd(10, 20), color: "#eef7ff", shape: "dot", delay: rnd(0, 0.6) })));
        for (let i = 0; i < 5; i++) setTimeout(() => FX.shake(5, 150), K.still() ? 0 : i * 200);
        tone({ f: 60, f2: 40, d: 1.2, v: 0.3 });
        await wait(1500);
    });
    // Numb Fingers: frost creeps over the edges of the screen, an icy breath clouds it, snow falls slow as treacle
    D("m-slowmo", async c => {
        add({ life: 2.4, draw(ctx, k) {
            const g2 = ease(Math.min(1, k * 2)), a = fade(k, 0.75), W = innerWidth, H = innerHeight;
            const gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * (0.6 - g2 * 0.15), W / 2, H / 2, Math.max(W, H) * 0.75); gr.addColorStop(0, "rgba(200,235,255,0)"); gr.addColorStop(1, `rgba(200,235,255,${0.75 * a})`);
            ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
        } });
        const b = board();
        burst(Array.from({ length: 40 }, () => ({ x: rnd(b.left, b.right), y: b.top - rnd(0, 100), vx: rnd(-10, 10), vy: rnd(20, 50), life: 2.4, size: rnd(4, 7), color: "#fff", shape: "flake", vr: rnd(-1, 1), wob: [1, 20], ph: rnd(0, 6) })));
        cloud(boardMid(), { colors: ["rgba(240,250,255,.6)"], n: 16, r: 90, life: 1.6, rise: 30 });
        await wait(1800);
    });
    // Ice Crack: the Yeti stamps: cracks race out from the impact across your board and ice chips fly
    D("m-shatter", async c => {
        const b = board(), o = { x: rnd(b.left + b.width * 0.3, b.right - b.width * 0.3), y: rnd(b.top + b.height * 0.3, b.bottom - b.height * 0.3) };
        const cracks = Array.from({ length: 9 }, (_, i) => { const a = i / 9 * TAU + rnd(-0.2, 0.2); return jag(o, { x: o.x + Math.cos(a) * b.width, y: o.y + Math.sin(a) * b.height }, 0.3, 5); });
        FX.shake(12, 350);
        add({ life: 1.8, draw(ctx, k) {
            const g2 = ease(Math.min(1, k * 4));
            ctx.save(); ctx.beginPath(); ctx.rect(b.left, b.top, b.width, b.height); ctx.clip(); ctx.globalAlpha = fade(k, 0.7);
            for (const l of cracks) { const n = Math.max(2, Math.floor(l.length * g2)); stroke(ctx, l.slice(0, n), 2.5, "#ffffff", "#8fd8ff"); }
            ctx.restore();
        } });
        spray(o, 30, { color: ["#cfeeff", "#ffffff", "#9fd8ff"], shape: "crumb", speed: [150, 420], size: [3, 7], g: 800, life: [0.5, 1], spin: 10 });
        ring(o, { color: "#cfeeff", r: 120, width: 6 });
        tone({ f: 3000, f2: 600, d: 0.25, v: 0.07, type: "square" });
        await wait(1000);
    });

    // =========================================================================================
    // Rainy City: Thunderhead (Lightning is the reference effect in spells.js: it stays)
    // =========================================================================================
    // Downpour: a black cloud opens over your board: sheets of rain, splashes on every square, and the letters start to run
    D("m-downpour", async c => {
        const b = board();
        add({ life: 2.2, draw(ctx, k, t) {
            ctx.globalAlpha = fade(k, 0.8);
            for (const [dx, dy, r] of [[0, 0, 50], [-60, 10, 38], [60, 8, 40], [-110, 18, 26], [110, 16, 28]]) { ctx.fillStyle = "#4a5568"; ctx.beginPath(); ctx.arc((b.left + b.right) / 2 + dx, b.top - 40 + dy, r, 0, TAU); ctx.fill(); }
        } });
        burst(Array.from({ length: K.lite() ? 60 : 130 }, () => ({ x: rnd(b.left - 40, b.right + 40), y: b.top - rnd(0, 60), vx: -80, vy: rnd(800, 1100), life: rnd(0.3, 0.6), size: rnd(3, 6), color: "rgba(160,200,255,.8)", shape: "streak", delay: rnd(0, 1.6) })));
        for (let i = 0; i < 14; i++) setTimeout(() => { const p = { x: rnd(b.left, b.right), y: rnd(b.top, b.bottom) }; ring(p, { color: "rgba(160,200,255,.9)", r: 24, width: 2, life: 0.6 }); spray(p, 4, { color: "#c9e0ff", shape: "drop", speed: [60, 140], angle: -Math.PI / 2, spread: 0.8, size: [1.5, 3], g: 700, life: [0.3, 0.5] }); }, K.still() ? 0 : 300 + i * 110);
        await wait(1800);
    });
    // Flash Flood: muddy water surges up from below your board, junk swirling in it (then keeps rising, see campaign.js applyMe)
    D("m-halffog", async c => {
        const b = board();
        add({ life: 2, draw(ctx, k, t) {
            const top = b.bottom - b.height * 0.25 * ease(Math.min(1, k * 2));
            ctx.save(); ctx.beginPath(); ctx.rect(b.left - 10, b.top, b.width + 20, b.height + 20); ctx.clip(); ctx.globalAlpha = fade(k, 0.8) * 0.85;
            const g = ctx.createLinearGradient(0, top, 0, b.bottom); g.addColorStop(0, "rgba(110,150,170,.85)"); g.addColorStop(1, "rgba(60,80,90,.95)");
            ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(b.left - 10, b.bottom + 20); for (let x = b.left - 10; x <= b.right + 10; x += 8) ctx.lineTo(x, top + Math.sin(x / 16 + t * 6) * 6); ctx.lineTo(b.right + 10, b.bottom + 20); ctx.fill();
            ctx.fillStyle = "#8a6a4a"; for (let i = 0; i < 5; i++) { const x = b.left + ((i * 71 + t * 60) % b.width); ctx.save(); ctx.translate(x, top + 6 + Math.sin(t * 3 + i) * 4); ctx.rotate(t + i); ctx.fillRect(-8, -2, 16, 4); ctx.restore(); }
            ctx.restore();
        } });
        spray({ x: (b.left + b.right) / 2, y: b.bottom }, 24, { color: ["#9fc4d8", "#ffffff"], shape: "drop", speed: [200, 400], angle: -Math.PI / 2, spread: 1, size: [2, 5], g: 900, life: [0.5, 0.9] });
        await wait(1500);
    });
    // Thunder Roll: thunder rolls across the sky above your board in shockwaves; the board rumbles and a letter shakes loose
    D("m-quake", async c => {
        const b = board();
        for (let i = 0; i < 3; i++) setTimeout(() => {
            add({ life: 0.7, draw(ctx, k) { ctx.globalAlpha = 1 - k; ctx.strokeStyle = "#9fb4d8"; ctx.lineWidth = 4; for (const s of [-1, 1]) { ctx.beginPath(); for (let y = b.top - 30; y <= b.bottom + 30; y += 10) ctx.lineTo((b.left + b.right) / 2 + s * k * b.width * 0.7 + Math.sin(y / 9) * 6, y); ctx.stroke(); } } });
            FX.shake(9, 300);
            tone({ f: 70, f2: 40, d: 0.5, v: 0.25 });
        }, K.still() ? 0 : i * 350);
        flash("#cfd8e8", 180, 0.25);
        spray({ x: (b.left + b.right) / 2, y: b.bottom }, 20, { color: ["#a8a0a0", "#c8c0b8"], shape: "glow", speed: [40, 160], angle: -Math.PI / 2, spread: 1.2, size: [6, 12], g: -20, life: [0.8, 1.2] });
        await wait(1200);
    });
    // Umbrella: (on the boss) a big umbrella snaps open over the cloud; rain bounces off it in sprays
    D("m-ward", async c => {
        const p = from(c), r = rect(portrait() || c.area), top = r.top + 10;
        add({ life: 1.8, draw(ctx, k) {
            const open = ease(Math.min(1, k * 3)), w = r.width * 0.42 * open;
            ctx.globalAlpha = fade(k, 0.8);
            ctx.strokeStyle = "#2b2233"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(p.x, top); ctx.lineTo(p.x, top + 90); ctx.arc(p.x + 8, top + 90, 8, Math.PI, 0, true); ctx.stroke();
            for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? "#ff5c6c" : "#ffffff"; ctx.beginPath(); ctx.moveTo(p.x, top - 26); ctx.lineTo(p.x - w + i * w / 3, top); ctx.quadraticCurveTo(p.x - w + (i + 0.5) * w / 3, top - 10, p.x - w + (i + 1) * w / 3, top); ctx.closePath(); ctx.fill(); }
        } });
        burst(Array.from({ length: 40 }, () => ({ x: p.x + rnd(-r.width * 0.4, r.width * 0.4), y: top - rnd(100, 260), vx: 0, vy: rnd(500, 700), life: 0.4, size: rnd(2, 4), color: "rgba(160,200,255,.8)", shape: "streak", delay: rnd(0.3, 1.3) })));
        for (let i = 0; i < 5; i++) setTimeout(() => spray({ x: p.x + rnd(-r.width * 0.35, r.width * 0.35), y: top - 6 }, 5, { color: "#c9e0ff", shape: "drop", speed: [80, 200], angle: -Math.PI / 2, spread: 1.2, size: [1.5, 3], g: 700, life: [0.3, 0.6] }), K.still() ? 0 : 500 + i * 200);
        await wait(1500);
    });

    // =========================================================================================
    // Sky Kingdom: Sir Squall
    // =========================================================================================
    // Gale: a howling gale tears across your board, leaves and paper scraps tumbling end over end
    D("m-gale", async c => {
        const b = board();
        for (let i = 0; i < 9; i++) { const y = b.top + b.height * (i + 0.5) / 9; setTimeout(() => add({ life: 0.8, draw(ctx, k) { const x = lerp(b.left - 120, b.right + 160, k), len = 140; const g = ctx.createLinearGradient(x - len, 0, x, 0); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(255,255,255,.85)"); ctx.strokeStyle = g; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - len, y); ctx.bezierCurveTo(x - len / 2, y - 20, x - 20, y + 20, x, y); ctx.stroke(); } }), K.still() ? 0 : i * 60); }
        burst(Array.from({ length: 30 }, () => ({ x: b.left - rnd(0, 200), y: rnd(b.top, b.bottom), vx: rnd(600, 900), vy: rnd(-100, 100), life: 1.2, size: rnd(5, 9), color: pick(["#7be36b", "#e8792b", "#fffdf6"]), shape: Math.random() < 0.7 ? "leaf" : "square", vr: rnd(-12, 12), wob: [6, 300], ph: rnd(0, 6) })));
        await wait(1100);
    });
    // Twister: a little tornado dances across your board, sucking up dust; arrows spin around inside it
    D("m-twister", async c => {
        const b = board(), parts = Array.from({ length: 50 }, () => ({ k: Math.random(), a: rnd(0, TAU) }));
        add({ life: 2, draw(ctx, k, t) {
            const x = lerp(b.left + 20, b.right - 20, (Math.sin(k * Math.PI * 2 - Math.PI / 2) + 1) / 2), base = b.bottom, h = b.height * 1.1;
            ctx.globalAlpha = Math.sin(k * Math.PI);
            for (const p of parts) { p.a += 0.25 + (1 - p.k) * 0.2; const y = base - p.k * h, r = 10 + p.k * p.k * 70; ctx.fillStyle = Math.sin(p.a) > 0 ? "rgba(220,230,245,.9)" : "rgba(160,175,200,.7)"; ctx.beginPath(); ctx.arc(x + Math.cos(p.a) * r, y, 4 + p.k * 4, 0, TAU); ctx.fill(); }
            ctx.font = "900 22px sans-serif"; ctx.fillStyle = "#2b2233"; ctx.textAlign = "center"; ctx.fillText(Math.floor(t * 4) % 2 ? "↕" : "↔", x, base - h * 0.5);
        } });
        await wait(1500);
    });
    // Loop the Loop: a paper plane zooms round your board in a huge loop, leaving a smoke ring, and the board flips
    D("m-upside", async c => {
        const o = boardMid(), R0 = Math.max(board().width, board().height) * 0.62, path = [];
        add({ life: 1.8, draw(ctx, k) {
            const a = -Math.PI / 2 + ease(Math.min(1, k * 1.2)) * TAU * 1.05, x = o.x + Math.cos(a) * R0, y = o.y + Math.sin(a) * R0 * 0.85;
            path.push([x, y]);
            ctx.globalAlpha = fade(k, 0.8); ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 6; ctx.setLineDash([4, 10]); ctx.beginPath(); path.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke(); ctx.setLineDash([]);
            if (k < 0.85) { ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2); ctx.fillStyle = "#fff"; ctx.strokeStyle = "#2b2233"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(24, 0); ctx.lineTo(-16, -12); ctx.lineTo(-6, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(24, 0); ctx.lineTo(-16, 10); ctx.lineTo(-6, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
        } });
        await wait(1500);
    });
    // Cloud Cover: fat clouds roll in over your board one after another and settle there
    D("m-flicker", async c => {
        const b = board();
        for (let i = 0; i < 5; i++) {
            const y = b.top + b.height * (0.15 + i * 0.18), dir = i % 2 ? -1 : 1, s = rnd(30, 46), tx = rnd(b.left + 30, b.right - 30);
            add({ life: 2.2, draw(ctx, k) {
                const x = lerp(dir > 0 ? b.left - 160 : b.right + 160, tx, ease(Math.min(1, k * 2))); ctx.globalAlpha = fade(k, 0.75) * 0.95;
                for (const [dx, dy, r] of [[0, 0, 1], [-s, s * 0.3, 0.75], [s, s * 0.3, 0.8], [s * 1.8, s * 0.45, 0.5], [-s * 1.8, s * 0.45, 0.5]]) { ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(x + dx, y + dy, s * r, 0, TAU); ctx.fill(); }
                ctx.fillStyle = "rgba(170,190,215,.4)"; ctx.beginPath(); ctx.ellipse(x, y + s * 0.6, s * 2.2, s * 0.3, 0, 0, TAU); ctx.fill();
            } });
        }
        await wait(1500);
    });
    // Jet Stream: (on the boss) a roaring jet stream wraps around the knight in speed lines and contrails
    D("m-haste", async c => {
        const p = from(c), r = rect(portrait() || c.area);
        add({ life: 1.6, draw(ctx, k, t) {
            ctx.globalAlpha = Math.sin(k * Math.PI); ctx.globalCompositeOperation = "lighter";
            for (let i = 0; i < 6; i++) { const a = t * 8 + i * TAU / 6; ctx.strokeStyle = "rgba(200,230,255,.8)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(p.x, p.y, r.width * 0.45, r.height * 0.2, i * 0.3, a, a + 1.4); ctx.stroke(); }
        } });
        burst(Array.from({ length: 30 }, () => ({ x: r.left - rnd(0, 100), y: rnd(r.top, r.bottom), vx: rnd(900, 1400), vy: 0, life: 0.6, size: rnd(5, 10), color: "rgba(255,255,255,.8)", shape: "streak", add: true, delay: rnd(0, 0.8) })));
        await wait(1300);
    });

    // =========================================================================================
    // Desert Caravan: The Sphinx
    // =========================================================================================
    // Riddle: glowing hieroglyphs pour out of the Sphinx's eyes and swirl into your clues, turning them backwards
    D("m-riddle", async c => {
        const f = from(c), a = rect(clues()), glyphs = ["𓂀", "𓆣", "𓋹", "𓃭", "𓅓", "𓁹", "𓊽", "𓏏", "𓆓"];
        burst(Array.from({ length: K.lite() ? 18 : 36 }, () => { const tx = rnd(a.left, a.right), ty = rnd(a.top, a.bottom), t = rnd(0.7, 1.1); return { x: f.x, y: f.y, vx: (tx - f.x) / t, vy: (ty - f.y) / t, life: t + 0.4, size: rnd(18, 28), color: "#ffe8a8", glow: "#ffcf6b", shape: "text", text: pick(glyphs), font: "serif", vr: rnd(-2, 2), delay: rnd(0, 0.5) }; }));
        add({ life: 1.8, draw(ctx, k) { ctx.globalAlpha = Math.sin(k * Math.PI) * 0.3; ctx.fillStyle = "#ffcf6b"; ctx.fillRect(a.left, a.top, a.width, a.height); } });
        await wait(1500);
    });
    // Sand Blast: jets of sand fire in from both sides and sandblast your board, grains ricocheting off the squares
    D("m-sandblast", async c => {
        const b = board();
        for (const side of [-1, 1]) burst(Array.from({ length: K.lite() ? 50 : 100 }, () => ({ x: side < 0 ? b.left - 100 : b.right + 100, y: rnd(b.top, b.bottom), vx: -side * rnd(700, 1100), vy: rnd(-80, 80), life: 0.6, size: rnd(1.5, 3), color: pick(["#d9a35c", "#c48a45", "#ecc68e"]), shape: "dot", delay: rnd(0, 1) })));
        for (let i = 0; i < 10; i++) setTimeout(() => spray({ x: rnd(b.left, b.right), y: rnd(b.top, b.bottom) }, 6, { color: ["#ecc68e", "#d9a35c"], shape: "dot", speed: [100, 260], size: [1.5, 2.5], g: 400, life: [0.2, 0.5] }), K.still() ? 0 : i * 100);
        await wait(1200);
    });
    // Mirage: heat haze shimmers over your clue bar, and a ghostly oasis floats up out of it (it's lying to you)
    D("m-mirageclue", async c => {
        const bar = rect($("#clue-bar") || clues()), cx = (bar.left + bar.right) / 2;
        add({ life: 2, draw(ctx, k, t) {
            ctx.globalAlpha = Math.sin(k * Math.PI);
            ctx.strokeStyle = "rgba(255,210,140,.6)"; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { ctx.beginPath(); for (let x = bar.left; x <= bar.right; x += 8) ctx.lineTo(x, bar.top + 6 + i * bar.height / 4 + Math.sin(x / 10 + t * 12 + i) * 3); ctx.stroke(); }
            const y = bar.top - 30 - k * 30; ctx.globalAlpha = Math.sin(k * Math.PI) * 0.6;
            ctx.fillStyle = "#4fd2ff"; ctx.beginPath(); ctx.ellipse(cx, y + 10, 60, 10, 0, 0, TAU); ctx.fill();
            ctx.strokeStyle = "#3f8f3a"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx + 30, y + 6); ctx.quadraticCurveTo(cx + 36, y - 20, cx + 30, y - 44); ctx.stroke();
            ctx.fillStyle = "#3f8f3a"; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(cx + 30 + Math.cos(i * 1.26) * 16, y - 44 + Math.sin(i * 1.26) * 6, 16, 4, i * 1.26, 0, TAU); ctx.fill(); }
        } });
        await wait(1500);
    });
    // Dune Shift: a little dune of sand slides along one of your words and shoves its letters over by one
    D("m-shift", async c => {
        const ghosts = letterGhosts(c.cells), ps = pts(c);
        if (ps.length > 1) {
            const a = ps[0], b2 = ps[ps.length - 1];
            add({ life: 1.2, draw(ctx, k) { const x = lerp(a.x - 30, b2.x + 30, ease(k)), y = lerp(a.y, b2.y, ease(k)); ctx.globalAlpha = fade(k); ctx.fillStyle = "#d9a35c"; ctx.beginPath(); ctx.ellipse(x, y + 16, 34, 14, 0, Math.PI, TAU); ctx.fill(); ctx.fillStyle = "#ecc68e"; ctx.beginPath(); ctx.ellipse(x - 6, y + 14, 20, 6, 0, Math.PI, TAU); ctx.fill(); if (Math.random() < 0.6) spray({ x, y: y + 10 }, 3, { color: ["#ecc68e", "#d9a35c"], shape: "dot", speed: [40, 120], size: [1.5, 2.5], g: 300, life: [0.3, 0.5] }); } });
        }
        await wait(300);
        await Promise.all(ghosts.map(({ ghost, r }, i) => new Promise(res => { const nx = ps[i + 1] ? ps[i + 1].x - (r.left + r.width / 2) : r.width, ny = ps[i + 1] ? ps[i + 1].y - (r.top + r.height / 2) : 0; const anim = ghost.animate([{ transform: "none", opacity: 1 }, { transform: `translate(${nx}px, ${ny}px)`, opacity: 0.2 }], { duration: 800, easing: "ease-in-out", fill: "forwards" }); anim.onfinish = () => { ghost.remove(); res(); }; })));
    });
    // Scorpion Sting: a scorpion's tail whips down out of the sky and stabs your board; green poison splashes and drips
    D("m-curse", async c => {
        const p = { x: boardMid().x + rnd(-60, 60), y: boardMid().y + rnd(-40, 40) };
        add({ life: 1, draw(ctx, k) {
            const strike = k < 0.4 ? ease(k / 0.4) : 1 - (k - 0.4) * 0.6, n = 9;
            ctx.strokeStyle = "#5a3a1a"; ctx.lineWidth = 10; ctx.lineCap = "round"; ctx.beginPath();
            for (let i = 0; i <= n; i++) { const q = i / n, x = p.x + Math.sin(q * 3) * 60 * (1 - strike) + 80 * (1 - q), y = lerp(-40, p.y - 20, strike) - (1 - q) * 160 * (1 - strike * 0.6); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
            ctx.stroke(); ctx.fillStyle = "#2b1a0a"; ctx.beginPath(); ctx.moveTo(p.x - 6, lerp(-40, p.y - 22, strike)); ctx.lineTo(p.x, lerp(-20, p.y, strike)); ctx.lineTo(p.x + 6, lerp(-40, p.y - 22, strike)); ctx.fill();
        } });
        await wait(420);
        FX.shake(8, 250);
        splat(p, { color: "rgba(120,220,60,.85)", r: 30, drips: 4, life: 2 });
        spray(p, 24, { color: ["#9be36b", "#5fbf2a", "#d6ff8a"], shape: "drop", speed: [120, 320], size: [2.5, 5], g: 700, life: [0.5, 0.9] });
        spray(p, 8, { color: "rgba(150,255,100,.6)", shape: "glow", speed: [10, 40], angle: -Math.PI / 2, spread: 0.6, size: [8, 14], g: -40, life: [1, 1.6] });
        tone({ f: 1200, f2: 300, d: 0.15, v: 0.1, type: "sawtooth" });
        await wait(700);
    });

    // =========================================================================================
    // Big Top Carnival: The Ringmaster
    // =========================================================================================
    // Funhouse Mirror: a gilded funhouse mirror swings down in front of your board, rippling everything in it
    D("m-mirror", async c => {
        const b = board();
        add({ life: 2, draw(ctx, k, t) {
            const drop = ease(Math.min(1, k * 2.5)), y = lerp(b.top - b.height, b.top, drop), sw = Math.sin(t * 5) * 0.06 * (1 - k);
            ctx.globalAlpha = fade(k, 0.8); ctx.save(); ctx.translate((b.left + b.right) / 2, y); ctx.rotate(sw);
            ctx.fillStyle = "rgba(200,230,255,.35)"; ctx.strokeStyle = "#d4a93a"; ctx.lineWidth = 10; ctx.beginPath(); ctx.ellipse(0, b.height / 2, b.width * 0.55, b.height * 0.55, 0, 0, TAU); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.lineWidth = 3; for (let i = 0; i < 5; i++) { ctx.beginPath(); for (let x = -b.width * 0.45; x <= b.width * 0.45; x += 8) ctx.lineTo(x, b.height * (0.15 + i * 0.18) + Math.sin(x / 14 + t * 8 + i) * 8); ctx.stroke(); }
            ctx.restore();
        } });
        for (let i = 0; i < 4; i++) setTimeout(() => spray({ x: rnd(b.left, b.right), y: b.top + rnd(0, b.height) }, 6, { color: ["#fff", "#ffe066"], shape: "star", speed: [20, 80], size: [2, 4], g: 0, life: [0.5, 0.8], add: true }), K.still() ? 0 : 600 + i * 150);
        await wait(1500);
    });
    // Confetti Cannon: two cannons on either side of your board fire BOOM, and confetti rains down and piles up
    D("m-confetti", async c => {
        const b = board();
        for (const side of [-1, 1]) {
            const x = side < 0 ? b.left - 30 : b.right + 30, y = b.bottom;
            add({ life: 0.9, draw(ctx, k) { ctx.save(); ctx.translate(x, y); ctx.rotate(side < 0 ? -0.8 : 0.8 + Math.PI); ctx.fillStyle = "#2b2233"; ctx.fillRect(-8, -14, 54, 28); ctx.fillStyle = "#e2483c"; ctx.fillRect(40, -16, 10, 32); ctx.restore(); } });
            setTimeout(() => { FX.shake(6, 200); burst(Array.from({ length: K.lite() ? 40 : 80 }, () => { const a = (side < 0 ? -1.1 : -2.04) + rnd(-0.35, 0.35), v = rnd(500, 900); return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 600, drag: 1.2, life: rnd(1.6, 2.4), size: rnd(5, 9), color: pick(["#e2483c", "#ffd23f", "#4fa3e8", "#ffffff", "#7dff6b", "#c08bff"]), shape: "square", vr: rnd(-12, 12), wob: [5, 120], ph: rnd(0, 6) }; })); tone({ f: 140, f2: 50, d: 0.25, v: 0.3 }); }, K.still() ? 0 : 250);
        }
        await wait(1600);
    });
    // Shell Game: three cups slide around over your clue list faster and faster, and the clues come out shuffled
    D("m-clueswap", async c => {
        const a = rect(clues()), cx = (a.left + a.right) / 2, cy = a.top + 60;
        add({ life: 2, draw(ctx, k, t) {
            ctx.globalAlpha = fade(k, 0.85);
            for (let i = 0; i < 3; i++) { const ph = t * (3 + k * 10) + i * TAU / 3, x = cx + Math.cos(ph) * a.width * 0.3, y = cy + Math.sin(ph) * 14;
                ctx.fillStyle = "#e2483c"; ctx.strokeStyle = "#2b2233"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x - 26, y + 30); ctx.lineTo(x - 18, y - 20); ctx.lineTo(x + 18, y - 20); ctx.lineTo(x + 26, y + 30); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#ffd23f"; ctx.fillRect(x - 22, y + 14, 44, 6); }
        } });
        await wait(1500);
        spray({ x: cx, y: cy }, 20, { color: ["#ffd23f", "#fff"], shape: "star", speed: [80, 220], size: [2, 4], g: 200, life: [0.4, 0.8], add: true });
    });
    // Cannonball: a cannon by the Ringmaster BOOMS and lobs a sizzling bomb onto one of your squares
    D("m-bomb", async c => {
        await settle();
        const target = els("#board .cell.bombed")[0] || boardMid(), f = from(c);
        flash("#fff3d6", 120, 0.25);
        cloud(f, { colors: ["rgba(200,190,180,.7)", "rgba(150,140,130,.6)"], n: 14, r: 80, life: 1 });
        tone({ f: 120, f2: 40, d: 0.3, v: 0.35 });
        await lob(f, target, { life: 0.8, height: 260, drawFn: (ctx, x, y, k) => { ctx.fillStyle = "#2b2233"; ctx.beginPath(); ctx.arc(x, y, 13, 0, TAU); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,.3)"; ctx.beginPath(); ctx.arc(x - 4, y - 4, 4, 0, TAU); ctx.fill(); ctx.strokeStyle = "#8a6a4a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 8, y - 10); ctx.quadraticCurveTo(x + 14, y - 20, x + 10, y - 24); ctx.stroke(); spray({ x: x + 10, y: y - 24 }, 1, { color: ["#ffcf3f", "#ff7a1f"], shape: "ember", speed: [20, 80], size: [1, 2], g: 0, life: [0.2, 0.4] }); } });
        FX.shake(6, 200);
        ring(target, { color: "#ff9f1c", r: 50, width: 6 });
        spray(target, 12, { color: ["#ffcf3f", "#ff7a1f"], shape: "ember", speed: [60, 180], size: [1, 2.5], g: 100, life: [0.4, 0.8] });
    });
    // Ringmaster's Call: a spotlight swings round and slams onto the word you're stuck on; a top hat drops on it
    D("m-taunt", async c => {
        await settle();
        const cells = els("#board .cell.in-word"), p = cells.length ? { x: cells.reduce((s, q) => s + q.x, 0) / cells.length, y: cells.reduce((s, q) => s + q.y, 0) / cells.length } : boardMid();
        add({ life: 2, draw(ctx, k) {
            const sweep = ease(Math.min(1, k * 2)), sx = innerWidth * 0.1, tx = lerp(innerWidth * 0.9, p.x, sweep), ty = lerp(innerHeight * 0.2, p.y, sweep);
            ctx.globalAlpha = fade(k, 0.8); ctx.globalCompositeOperation = "lighter";
            ctx.fillStyle = "rgba(255,240,180,.35)"; ctx.beginPath(); ctx.moveTo(sx, -20); ctx.lineTo(tx - 80, ty + 40); ctx.lineTo(tx + 80, ty + 40); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.ellipse(tx, ty, 90, 40, 0, 0, TAU); ctx.fill();
        } });
        await wait(900);
        await lob({ x: p.x, y: p.y - 300 }, { x: p.x, y: p.y - 30 }, { life: 0.4, height: 0, drawFn: (ctx, x, y) => { ctx.fillStyle = "#2b2233"; ctx.fillRect(x - 18, y - 30, 36, 30); ctx.fillRect(x - 28, y - 2, 56, 6); ctx.fillStyle = "#e2483c"; ctx.fillRect(x - 18, y - 10, 36, 6); } });
        spray({ x: p.x, y: p.y - 30 }, 16, { color: ["#ffd23f", "#fff"], shape: "star", speed: [80, 200], size: [2, 4], g: 200, life: [0.4, 0.8], add: true });
        tone({ f: 600, f2: 900, d: 0.12, v: 0.08, type: "triangle" });
        await wait(400);
    });

    // =========================================================================================
    // Neon Arcade: Glitch
    // =========================================================================================
    // Glitch: your letters corrupt: RGB-split blocks tear across them and they break into pixels
    D("m-glitch", async c => {
        const ghosts = letterGhosts(c.cells), ps = pts(c).length ? pts(c) : [boardMid()];
        add({ life: 0.9, draw(ctx, k) {
            for (const p of ps) for (let i = 0; i < 4; i++) { ctx.globalAlpha = rnd(0.3, 0.9); ctx.fillStyle = pick(["#ff2bd6", "#00f0ff", "#ffffff", "#7bff5c"]); ctx.fillRect(p.x - 28 + rnd(-10, 10), p.y - 20 + rnd(0, 40), rnd(20, 60), rnd(3, 10)); }
        } });
        myBoard().animate([{ filter: "none" }, { filter: "hue-rotate(90deg) contrast(1.6)", transform: "translateX(-5px)" }, { filter: "none", transform: "translateX(4px)" }, { filter: "none" }], { duration: 400 });
        ps.forEach(p => spray(p, 14, { color: ["#ff2bd6", "#00f0ff", "#7bff5c"], shape: "square", speed: [100, 300], size: [3, 6], g: 300, life: [0.4, 0.8] }));
        tone({ f: 80, f2: 2000, d: 0.12, v: 0.06, type: "square" });
        await leave(ghosts, "pixel", { stagger: 40 });
    });
    // Lag Spike: a spinning loading wheel takes over the screen, the board stutters, your last letters rewind away
    D("m-lag", async c => {
        const o = boardMid(), ghosts = letterGhosts(c.cells);
        add({ life: 1.6, draw(ctx, k, t) {
            ctx.globalAlpha = Math.sin(k * Math.PI);
            for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + Math.floor(t * 12) / 10 * TAU; ctx.fillStyle = `rgba(43,240,255,${0.15 + (i / 10) * 0.85})`; ctx.beginPath(); ctx.arc(o.x + Math.cos(a) * 40, o.y + Math.sin(a) * 40, 7, 0, TAU); ctx.fill(); }
            ctx.font = "800 16px monospace"; ctx.fillStyle = "#2bf0ff"; ctx.textAlign = "center"; ctx.fillText(`PING ${900 + Math.floor(t * 500)}ms`, o.x, o.y + 72);
        } });
        for (let i = 0; i < 4; i++) setTimeout(() => myBoard().animate([{ transform: "translateX(0)" }, { transform: `translateX(${rnd(-8, 8)}px)` }, { transform: "translateX(0)" }], { duration: 120, easing: "steps(2)" }), K.still() ? 0 : i * 180);
        await wait(500);
        await leave(ghosts, "suck", { to: o, stagger: 80 });
    });
    // Combo Breaker: a big red X slams through your combo, and its chain shatters into links
    D("m-comboban", async c => {
        const chip = $('.ms-chip[data-k="combo"]') || $(".hud-row"), p = mid(chip);
        add({ life: 1.4, draw(ctx, k) { const s = k < 0.2 ? 2 - k * 5 : 1; ctx.globalAlpha = fade(k, 0.7); ctx.strokeStyle = "#ff2d55"; ctx.lineWidth = 12; ctx.lineCap = "round"; ctx.shadowColor = "#ff2d55"; ctx.shadowBlur = 20; ctx.beginPath(); ctx.moveTo(p.x - 40 * s, p.y - 40 * s); ctx.lineTo(p.x + 40 * s, p.y + 40 * s); ctx.moveTo(p.x + 40 * s, p.y - 40 * s); ctx.lineTo(p.x - 40 * s, p.y + 40 * s); ctx.stroke(); } });
        FX.shake(8, 250);
        burst(Array.from({ length: 12 }, () => { const a = rnd(0, TAU), v = rnd(150, 350); return { x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 100, g: 700, life: 1, size: 7, color: "#c0c8d0", shape: "ring", vr: rnd(-8, 8) }; }));
        tone({ f: 400, f2: 80, d: 0.25, v: 0.15, type: "square" });
        await wait(900);
    });
    // Echo Bug: a pixel bug scuttles across your board and every letter it touches rings with ghostly echoes
    D("m-echo", async c => {
        const b = board(), path = [];
        for (let i = 0; i <= 20; i++) path.push({ x: lerp(b.left, b.right, i / 20), y: b.top + b.height * (0.5 + Math.sin(i * 0.9) * 0.35) });
        add({ life: 1.8, draw(ctx, k, t) {
            const i = Math.min(path.length - 1, Math.floor(k * path.length * 1.1)), p = path[i];
            ctx.globalAlpha = fade(k, 0.85);
            ctx.fillStyle = "#7bff5c"; for (const [dx, dy] of [[0, 0], [-4, -4], [4, -4], [-6, 2], [6, 2], [-4, 6], [4, 6]]) ctx.fillRect(p.x + dx - 2, p.y + dy - 2, 4, 4);
            if (i % 2 === 0) for (let j = 1; j <= 3; j++) { ctx.globalAlpha = (0.5 / j) * fade(k, 0.85); ctx.strokeStyle = "#7bff5c"; ctx.lineWidth = 2; ctx.strokeRect(p.x - 10 - j * 6, p.y - 10 - j * 6, 20 + j * 12, 20 + j * 12); }
        } });
        await wait(1500);
    });
    // Corrupted Font: your letters dissolve into a flicker of random symbols, matrix-like, then come back wrong-looking
    D("m-mask", async c => {
        await settle();
        const cells = els("#board .cell.masked").slice(0, 30), list = cells.length ? cells : els("#board .cell").slice(0, 20);
        add({ life: 1.6, draw(ctx, k) {
            ctx.globalAlpha = Math.sin(k * Math.PI); ctx.font = "800 18px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            for (const p of list) { ctx.fillStyle = pick(["#ff2bd6", "#00f0ff", "#7bff5c"]); ctx.fillText(pick("#$%&@!?*¤§Ø¥Ξ".split("")), p.x + rnd(-3, 3), p.y + rnd(-3, 3)); }
        } });
        await wait(1300);
    });

    // =========================================================================================
    // Haunted Library: The Phantom Librarian
    // =========================================================================================
    // Haunting: little ghost wisps fly out of the Librarian and sink into your empty squares, leaving fake letters
    D("m-haunting", async c => {
        const f = from(c), targets = pts(c).slice(0, 12);
        await Promise.all((targets.length ? targets : [boardMid()]).map((p, i) => new Promise(async res => {
            await wait(i * 60);
            await lob(f, p, { life: 0.7, height: 120, trail: "rgba(191,243,228,.6)", drawFn: (ctx, x, y) => { ctx.fillStyle = "rgba(239,255,250,.9)"; ctx.shadowColor = "#bff3e4"; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(x, y, 8, Math.PI, 0); ctx.lineTo(x + 8, y + 10); ctx.lineTo(x, y + 6); ctx.lineTo(x - 8, y + 10); ctx.fill(); } });
            spray(p, 6, { color: "#bff3e4", shape: "glow", speed: [10, 50], size: [5, 9], g: -30, life: [0.5, 0.9], add: true });
            res();
        })));
    });
    // Lights Out: an icy breath blows past; candles gutter out in curls of smoke and darkness closes in around your cursor
    D("m-lights", async c => {
        const b = board();
        for (let i = 0; i < 6; i++) { const x = b.left + (i + 0.5) * b.width / 6, y = b.top - 20; add({ life: 1.6, draw(ctx, k) { ctx.globalAlpha = fade(k); ctx.fillStyle = "#f6ecd2"; ctx.fillRect(x - 5, y, 10, 22); if (k < 0.3) { ctx.fillStyle = "#ffcf3f"; ctx.shadowColor = "#ffcf3f"; ctx.shadowBlur = 16; ctx.beginPath(); ctx.ellipse(x + k * 20, y - 8, 4 * (1 - k * 3), 8 * (1 - k * 3), 0.5, 0, TAU); ctx.fill(); } } }); setTimeout(() => spray({ x, y: y - 8 }, 4, { color: "rgba(160,160,170,.6)", shape: "glow", speed: [10, 40], angle: -Math.PI / 2, spread: 0.4, size: [5, 9], g: -60, life: [1, 1.4], wob: [4, 40] }), K.still() ? 0 : 400 + i * 60); }
        add({ life: 1.8, draw(ctx, k) { ctx.fillStyle = `rgba(5,5,15,${Math.sin(k * Math.PI) * 0.55})`; ctx.fillRect(0, 0, innerWidth, innerHeight); } });
        await wait(1500);
    });
    // Possession: a purple mist curls out of the Librarian into one of your clues; two glowing eyes open in it
    D("m-fakeclue", async c => {
        await settle();
        const f = from(c), item = pick(cellsOf(".clues li")) || clues(), p = mid(item);
        burst(Array.from({ length: 30 }, () => { const t = rnd(0.6, 0.9); return { x: f.x, y: f.y, vx: (p.x - f.x) / t + rnd(-40, 40), vy: (p.y - f.y) / t + rnd(-40, 40), drag: 0.3, life: t + 0.5, size: rnd(8, 16), color: "rgba(150,90,220,.6)", shape: "glow", wob: [5, 100], ph: rnd(0, 6) }; }));
        await wait(800);
        add({ life: 1.4, draw(ctx, k) { ctx.globalAlpha = Math.sin(k * Math.PI); ctx.fillStyle = "#e0b0ff"; ctx.shadowColor = "#b46cff"; ctx.shadowBlur = 16; for (const dx of [-14, 14]) { ctx.beginPath(); ctx.ellipse(p.x + dx, p.y - 2, 6, 3 + Math.sin(k * 30) * 1, 0, 0, TAU); ctx.fill(); } } });
        await wait(900);
    });
    // Poltergeist: your last word rises off the board, the letters spin in the air... and get flung across the room
    D("m-wordthief", async c => {
        const ghosts = letterGhosts(c.cells);
        await Promise.all(ghosts.map(({ ghost }, i) => new Promise(res => {
            const anim = ghost.animate([{ transform: "none", opacity: 1 }, { transform: `translateY(-50px) rotate(${rnd(-30, 30)}deg)`, opacity: 1, offset: 0.35 }, { transform: `translateY(-60px) rotate(${rnd(-200, 200)}deg)`, opacity: 1, offset: 0.55 }, { transform: `translate(${rnd(-500, 500)}px, ${rnd(-300, 200)}px) rotate(${rnd(-720, 720)}deg) scale(.6)`, opacity: 0 }], { duration: 1300, delay: K.still() ? 0 : i * 60, easing: "ease-in", fill: "forwards" });
            anim.onfinish = () => { ghost.remove(); res(); };
        })));
        spray(boardMid(), 14, { color: "#bff3e4", shape: "glow", speed: [40, 120], size: [6, 10], g: -30, life: [0.6, 1], add: true });
    });
    // Torn Pages: your clue list gets ripped: torn strips of paper peel away and flutter off
    D("m-oneword", async c => {
        const a = rect(clues());
        burst(Array.from({ length: K.lite() ? 12 : 24 }, () => ({ x: rnd(a.left + a.width * 0.4, a.right), y: rnd(a.top, a.bottom), vx: rnd(100, 300), vy: rnd(-200, 0), g: 300, drag: 0.6, life: 1.6, size: rnd(16, 26), color: "#f6ecd2", shape: "square", vr: rnd(-6, 6), wob: [5, 80], ph: rnd(0, 6) })));
        add({ life: 1, draw(ctx, k) { ctx.globalAlpha = 1 - k; ctx.strokeStyle = "#2b2233"; ctx.lineWidth = 2; ctx.beginPath(); for (let y = a.top; y <= a.bottom; y += 10) ctx.lineTo(a.left + a.width * 0.4 + rnd(-8, 8), y); ctx.stroke(); } });
        tone({ f: 3000, f2: 500, d: 0.3, v: 0.05, type: "sawtooth" });
        await wait(1300);
    });

    // =========================================================================================
    // Robot Factory: Mega Unit X
    // =========================================================================================
    // System Lock: steel clamps slam shut around your word, a red laser grid locks it, a LOCKED hologram flickers on
    D("m-lock", async c => {
        await settle();
        const cells = cellsOf("#board .cell.in-word").map(rect), b = cells.length ? { left: Math.min(...cells.map(r => r.left)), right: Math.max(...cells.map(r => r.right)), top: Math.min(...cells.map(r => r.top)), bottom: Math.max(...cells.map(r => r.bottom)) } : board();
        add({ life: 1.8, draw(ctx, k, t) {
            const slam = ease(Math.min(1, k * 4)), a = fade(k, 0.8);
            ctx.globalAlpha = a; ctx.fillStyle = "#8a95a3"; ctx.strokeStyle = "#2b2233"; ctx.lineWidth = 2;
            ctx.fillRect(b.left - 14 - (1 - slam) * 60, b.top - 6, 12, b.bottom - b.top + 12); ctx.strokeRect(b.left - 14 - (1 - slam) * 60, b.top - 6, 12, b.bottom - b.top + 12);
            ctx.fillRect(b.right + 2 + (1 - slam) * 60, b.top - 6, 12, b.bottom - b.top + 12); ctx.strokeRect(b.right + 2 + (1 - slam) * 60, b.top - 6, 12, b.bottom - b.top + 12);
            if (slam >= 1) { ctx.strokeStyle = "rgba(255,60,60,.8)"; ctx.lineWidth = 1.5; for (let y = b.top; y <= b.bottom; y += 8) { ctx.beginPath(); ctx.moveTo(b.left, y); ctx.lineTo(b.right, y); ctx.stroke(); }
                if (Math.sin(t * 30) > -0.3) { ctx.fillStyle = "#ff3b3b"; ctx.font = "900 16px monospace"; ctx.textAlign = "center"; ctx.fillText("🔒 LOCKED", (b.left + b.right) / 2, b.top - 12); } }
        } });
        setTimeout(() => { FX.shake(6, 200); tone({ f: 180, f2: 90, d: 0.12, v: 0.25, type: "square" }); }, K.still() ? 0 : 400);
        await wait(1400);
    });
    // Static: a wall of TV static floods your board with scan lines rolling and crackling
    D("m-static", async c => {
        const b = board();
        add({ life: 1.8, draw(ctx, k, t) {
            ctx.globalAlpha = Math.sin(k * Math.PI) * 0.8;
            for (let i = 0; i < (K.lite() ? 250 : 600); i++) { const v = Math.floor(rnd(80, 255)); ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(rnd(b.left, b.right), rnd(b.top, b.bottom), 3, 2); }
            const sy = b.top + ((t * 300) % b.height); ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(b.left, sy, b.width, 12);
        } });
        await wait(1500);
    });
    // Reboot: a power-down: the board blinks to a reboot spinner, sparks fly off your locked letters, two blink out
    D("m-unlock", async c => {
        const o = boardMid(), ghosts = letterGhosts(c.cells);
        add({ life: 1.5, draw(ctx, k, t) {
            ctx.globalAlpha = Math.sin(k * Math.PI);
            ctx.strokeStyle = "#7ae0ff"; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.beginPath(); ctx.arc(o.x, o.y, 34, t * 6, t * 6 + 4.6); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(o.x, o.y - 50); ctx.lineTo(o.x, o.y - 26); ctx.stroke();
        } });
        flash("#000", 150, 0.35);
        els("#board .cell").slice(0, 0);
        pts(c).forEach(p => { bolt({ x: p.x, y: p.y - 30 }, p, { color: "#7ae0ff", width: 2, life: 0.4, branches: 1 }); spray(p, 10, { color: ["#7ae0ff", "#fff"], shape: "streak", speed: [100, 260], size: [1.5, 2.5], g: 300, life: [0.3, 0.6], add: true }); });
        await wait(400);
        await leave(ghosts, "zap", { stagger: 80 });
    });
    // Firewall (the boss's): a red hexagon shield grid locks down over your items, crackling
    D("m-itemlock", async c => {
        const bar = rect($(".cm-items") || myBoard());
        add({ life: 2, draw(ctx, k, t) {
            const g2 = ease(Math.min(1, k * 2.5)); ctx.globalAlpha = fade(k, 0.8);
            ctx.strokeStyle = "rgba(255,60,80,.9)"; ctx.lineWidth = 2; ctx.shadowColor = "#ff3b5c"; ctx.shadowBlur = 10;
            for (let x = bar.left; x < bar.left + bar.width * g2; x += 26) for (let y = bar.top, row = 0; y < bar.bottom; y += 22, row++) { ctx.beginPath(); for (let i = 0; i < 6; i++) ctx.lineTo(x + (row % 2 ? 13 : 0) + Math.cos(i * TAU / 6) * 13, y + Math.sin(i * TAU / 6) * 13); ctx.closePath(); ctx.stroke(); }
            ctx.fillStyle = `rgba(255,60,80,${0.15 + Math.sin(t * 20) * 0.05})`; ctx.fillRect(bar.left, bar.top, bar.width * g2, bar.height);
        } });
        tone({ f: 200, f2: 400, d: 0.4, v: 0.08, type: "sawtooth" });
        await wait(1500);
    });
    // Data Wipe: a scanner beam sweeps your board and the clue numbers dissolve into floating binary
    D("m-numberless", async c => {
        const b = board(), nums = cellsOf("#board .num, #board .cell-num, #board .number").map(mid);
        add({ life: 1.4, draw(ctx, k) { const y = lerp(b.top - 10, b.bottom + 10, k); ctx.globalCompositeOperation = "lighter"; const g = ctx.createLinearGradient(0, y - 30, 0, y); g.addColorStop(0, "transparent"); g.addColorStop(1, "rgba(80,220,255,.6)"); ctx.fillStyle = g; ctx.fillRect(b.left - 10, y - 30, b.width + 20, 30); ctx.fillStyle = "#bff3ff"; ctx.fillRect(b.left - 10, y, b.width + 20, 2); } });
        const list = nums.length ? nums : Array.from({ length: 12 }, () => ({ x: rnd(b.left, b.right), y: rnd(b.top, b.bottom) }));
        list.forEach(p => setTimeout(() => spray(p, 4, { color: "#7ae0ff", shape: "text", text: ["0", "1"], font: "monospace", speed: [20, 60], angle: -Math.PI / 2, spread: 0.6, size: [10, 14], g: -60, life: [0.8, 1.2] }), K.still() ? 0 : ((p.y - b.top) / b.height) * 1200));
        await wait(1500);
    });

    // =========================================================================================
    // Volcano Island: Magma Wyrm
    // =========================================================================================
    // Eruption: the wyrm erupts: glowing lava bombs arc high and smash down on two spots of your board
    D("m-eruption", async c => {
        const ghosts = letterGhosts(c.cells), ps = pts(c), f = from(c), b = board();
        const spots = ps.length ? [ps[0], ps[Math.floor(ps.length / 2)] || ps[0]] : [{ x: rnd(b.left, b.right), y: rnd(b.top, b.bottom) }, { x: rnd(b.left, b.right), y: rnd(b.top, b.bottom) }];
        spray(f, 30, { color: ["#ffcf3f", "#ff6a00", "#ff3d00"], shape: "ember", speed: [200, 500], angle: -Math.PI / 2, spread: 0.6, size: [2, 4], g: 600, life: [0.6, 1.1] });
        await Promise.all(spots.map((p, i) => new Promise(async res => {
            await wait(i * 200);
            await lob(f, p, { life: 0.7, height: 320, trail: "rgba(255,120,30,.8)", drawFn: (ctx, x, y) => { const g = ctx.createRadialGradient(x - 4, y - 4, 0, x, y, 16); g.addColorStop(0, "#fff3a0"); g.addColorStop(0.4, "#ff9f1c"); g.addColorStop(1, "#7a1f0a"); ctx.fillStyle = g; ctx.shadowColor = "#ff6a00"; ctx.shadowBlur = 24; ctx.beginPath(); ctx.arc(x, y, 14, 0, TAU); ctx.fill(); } });
            FX.shake(10, 300); glow(p, { color: "#ff6a00", r: 110 }); ring(p, { color: "#ffcf3f", r: 90, width: 8 });
            spray(p, 30, { color: ["#ffcf3f", "#ff6a00", "#2b2233"], shape: "crumb", speed: [150, 420], size: [3, 6], g: 800, life: [0.5, 1] });
            tone({ f: 90, f2: 40, d: 0.35, v: 0.3 });
            res();
        })));
        await leave(ghosts, "burn", { stagger: 30 });
    });
    // Heatwave: heat haze rises off your Check and Reveal buttons, which glow red-hot and smoke
    D("m-heatwave", async c => {
        const hl = rect($("#helpers") || myBoard());
        add({ life: 2, draw(ctx, k, t) {
            ctx.globalAlpha = Math.sin(k * Math.PI);
            const g = ctx.createLinearGradient(0, hl.top, 0, hl.bottom); g.addColorStop(0, "rgba(255,90,31,.15)"); g.addColorStop(1, "rgba(255,40,0,.45)"); ctx.fillStyle = g; ctx.fillRect(hl.left, hl.top, hl.width, hl.height);
            ctx.strokeStyle = "rgba(255,180,120,.6)"; ctx.lineWidth = 2; for (let i = 0; i < 6; i++) { const x0 = hl.left + (i + 0.5) * hl.width / 6; ctx.beginPath(); for (let y = hl.bottom; y > hl.top - 80; y -= 8) ctx.lineTo(x0 + Math.sin(y / 10 + t * 8 + i) * 6, y); ctx.stroke(); }
        } });
        for (let i = 0; i < 6; i++) setTimeout(() => spray({ x: rnd(hl.left, hl.right), y: hl.top }, 3, { color: "rgba(140,130,130,.6)", shape: "glow", speed: [10, 40], angle: -Math.PI / 2, spread: 0.5, size: [6, 10], g: -60, life: [1, 1.4] }), K.still() ? 0 : i * 200);
        await wait(1500);
    });
    // Pressure Build: (on the boss) magma pressure builds inside the wyrm: glowing cracks spread, rings close in, it rumbles
    D("m-powerup", async c => {
        const p = from(c), r = rect(portrait() || c.area), cracks = Array.from({ length: 7 }, () => { const a = rnd(0, TAU); return jag(p, { x: p.x + Math.cos(a) * r.width * 0.45, y: p.y + Math.sin(a) * r.height * 0.45 }, 0.3, 4); });
        for (let i = 0; i < 4; i++) setTimeout(() => implode(p, { color: "#ff7a1f", r: r.width * 0.7, life: 0.7, width: 6 }), K.still() ? 0 : i * 250);
        add({ life: 1.8, draw(ctx, k) { const g2 = ease(Math.min(1, k * 1.6)); ctx.globalAlpha = fade(k, 0.85); ctx.globalCompositeOperation = "lighter"; for (const l of cracks) stroke(ctx, l.slice(0, Math.max(2, Math.floor(l.length * g2))), 3, "#ffcf3f", "#ff3d00"); } });
        tone({ f: 50, f2: 120, d: 1.4, v: 0.2, type: "sawtooth" });
        await wait(1400);
        glow(p, { color: "#ff6a00", r: 160 });
    });
    // Fresh Lava: (on the boss's board) the wyrm spits streams of lava that write its letters in a flash
    D("m-heal", async c => {
        const f = from(c), bb = rect(bossBoard()), targets = Array.from({ length: 4 }, () => ({ x: rnd(bb.left + 10, bb.right - 10), y: rnd(bb.top + 10, bb.bottom - 10) }));
        await Promise.all(targets.map((p, i) => new Promise(async res => { await wait(i * 120); await shot(f, p, { color: "#ff6a00", size: 7, life: 0.4 }); glow(p, { color: "#ff9f1c", r: 40, life: 0.4 }); spray(p, 8, { color: ["#ffcf3f", "#ff6a00"], shape: "ember", speed: [40, 140], size: [1.5, 2.5], g: 200, life: [0.3, 0.6] }); res(); })));
    });
    // Scorched Earth: fire sweeps around your board's edge and black ash snows down; your words will feed the wyrm
    D("m-toll", async c => {
        const b = board(), f = from(c);
        add({ life: 2, draw(ctx, k, t) {
            ctx.globalAlpha = fade(k, 0.75); ctx.globalCompositeOperation = "lighter";
            for (let x = b.left; x <= b.right; x += 12) for (const y of [b.top, b.bottom]) { const h = 10 + Math.abs(Math.sin(t * 10 + x * 0.1)) * 18; const g = ctx.createRadialGradient(x, y, 0, x, y, h); g.addColorStop(0, "rgba(255,200,80,.8)"); g.addColorStop(1, "rgba(255,40,0,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, h, 0, TAU); ctx.fill(); }
        } });
        burst(Array.from({ length: 40 }, () => ({ x: rnd(b.left, b.right), y: b.top - rnd(0, 80), vx: rnd(-20, 20), vy: rnd(30, 80), life: 2, size: rnd(2, 4), color: pick(["#2b2233", "#4a3a3a", "#6b5a55"]), shape: "crumb", vr: rnd(-3, 3), wob: [3, 40], ph: rnd(0, 6) })));
        setTimeout(() => shot(boardMid(), f, { color: "#ff7a1f", size: 6, life: 0.6 }), K.still() ? 0 : 900);
        await wait(1600);
    });

    // =========================================================================================
    // Deep Space: The Void
    // =========================================================================================
    // Gravity Well: space bends: the grid of your board warps into a funnel and dust spirals down into it
    D("m-gravity", async c => {
        const b = board(), o = boardMid();
        add({ life: 2, draw(ctx, k) {
            const pull = Math.sin(k * Math.PI);
            ctx.globalAlpha = pull * 0.8; ctx.strokeStyle = "rgba(170,140,255,.8)"; ctx.lineWidth = 1.5;
            const warp = (x, y) => { const dx = x - o.x, dy = y - o.y, d = Math.hypot(dx, dy) || 1, s = 1 - pull * 0.5 * Math.exp(-d / 160); return [o.x + dx * s, o.y + dy * s]; };
            for (let x = b.left - 40; x <= b.right + 40; x += 24) { ctx.beginPath(); for (let y = b.top - 40; y <= b.bottom + 40; y += 8) { const [wx, wy] = warp(x, y); ctx.lineTo(wx, wy); } ctx.stroke(); }
            for (let y = b.top - 40; y <= b.bottom + 40; y += 24) { ctx.beginPath(); for (let x = b.left - 40; x <= b.right + 40; x += 8) { const [wx, wy] = warp(x, y); ctx.lineTo(wx, wy); } ctx.stroke(); }
        } });
        burst(Array.from({ length: 40 }, () => { const a = rnd(0, TAU), r = rnd(150, 300); return { x: o.x + Math.cos(a) * r, y: o.y + Math.sin(a) * r, vx: -Math.cos(a) * r * 0.8 - Math.sin(a) * 150, vy: -Math.sin(a) * r * 0.8 + Math.cos(a) * 150, life: 1.4, size: rnd(1.5, 3), color: pick(["#c6b8ff", "#fff"]), shape: "streak", add: true }; }));
        tone({ f: 60, f2: 30, d: 1.2, v: 0.25 });
        await wait(1500);
    });
    // Solar Flare: a star flares white-hot over your board: blinding rays, lens-flare rings, then white
    D("m-flare", async c => {
        const o = boardMid();
        add({ life: 1.6, draw(ctx, k, t) {
            const a = Math.sin(k * Math.PI); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = a;
            for (let i = 0; i < 16; i++) { const ang = i / 16 * TAU + t * 0.5, len = 400 + Math.sin(t * 6 + i) * 120; const g = ctx.createLinearGradient(o.x, o.y, o.x + Math.cos(ang) * len, o.y + Math.sin(ang) * len); g.addColorStop(0, "rgba(255,250,220,.9)"); g.addColorStop(1, "rgba(255,200,100,0)"); ctx.strokeStyle = g; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + Math.cos(ang) * len, o.y + Math.sin(ang) * len); ctx.stroke(); }
            const g2 = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, 160); g2.addColorStop(0, "#fff"); g2.addColorStop(0.3, "rgba(255,240,180,.9)"); g2.addColorStop(1, "rgba(255,180,60,0)"); ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(o.x, o.y, 160, 0, TAU); ctx.fill();
            for (const [d, r, col] of [[0.4, 30, "rgba(120,200,255,.5)"], [0.8, 18, "rgba(255,120,200,.4)"], [1.3, 40, "rgba(160,255,160,.3)"]]) { ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(o.x + (innerWidth / 2 - o.x) * d, o.y + (innerHeight / 2 - o.y) * d, r, 0, TAU); ctx.stroke(); }
        } });
        await wait(500);
        flash("#ffffff", 400, 0.7);
        await wait(900);
    });
    // Collapse: tiny collapsing stars appear on your finished words and each one swallows a letter as it implodes
    D("m-collapse", async c => {
        const ghosts = letterGhosts(c.cells), ps = pts(c).length ? pts(c) : [boardMid()];
        ps.forEach((p, i) => setTimeout(() => { implode(p, { color: "#c6b8ff", r: 50, life: 0.6, width: 3 }); glow(p, { color: "#8a6bff", r: 40, life: 0.6 }); }, K.still() ? 0 : i * 90));
        await wait(400);
        await Promise.all(ghosts.map(({ ghost }, i) => new Promise(res => { const anim = ghost.animate([{ transform: "none", opacity: 1 }, { transform: "scale(1.3)", opacity: 1, offset: 0.3 }, { transform: "scale(0) rotate(360deg)", opacity: 0 }], { duration: 600, delay: K.still() ? 0 : i * 90, fill: "forwards", easing: "ease-in" }); anim.onfinish = () => { ghost.remove(); res(); }; })));
        ps.forEach(p => spray(p, 6, { color: ["#fff", "#c6b8ff"], shape: "star", speed: [60, 160], size: [1.5, 3], g: 0, life: [0.3, 0.6], add: true }));
    });
    // Warp Speed: (on the boss's board) stars stretch into hyperspace streaks around it as it jumps ahead
    D("m-snapfinish", async c => {
        const bb = rect(bossBoard()), o = { x: (bb.left + bb.right) / 2, y: (bb.top + bb.bottom) / 2 };
        burst(Array.from({ length: K.lite() ? 50 : 100 }, () => { const a = rnd(0, TAU), r = rnd(10, 60); return { x: o.x + Math.cos(a) * r, y: o.y + Math.sin(a) * r, vx: Math.cos(a) * rnd(600, 1200), vy: Math.sin(a) * rnd(600, 1200), life: 0.7, size: rnd(3, 8), color: pick(["#ffffff", "#c6e0ff", "#b48cff"]), shape: "streak", add: true, delay: rnd(0, 0.6) }; }));
        glow(o, { color: "#b48cff", r: 120, life: 0.8 });
        tone({ f: 200, f2: 2400, d: 0.5, v: 0.08, type: "sawtooth" });
        await wait(1200);
    });
    // Event Horizon: a black ring sweeps over your board and the vowels fall into it, stretched thin
    D("m-vowels", async c => {
        const b = board(), o = boardMid();
        add({ life: 2, draw(ctx, k, t) {
            const r = Math.max(b.width, b.height) * 0.6 * (0.3 + ease(Math.min(1, k * 1.5)) * 0.7), a = Math.sin(k * Math.PI);
            ctx.globalAlpha = a; ctx.strokeStyle = "#0a0614"; ctx.lineWidth = 26; ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, TAU); ctx.stroke();
            ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = "rgba(255,190,120,.7)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(o.x, o.y, r + 14, t * 2, t * 2 + 4.5); ctx.stroke(); ctx.beginPath(); ctx.arc(o.x, o.y, Math.max(0, r - 14), -t * 2, -t * 2 + 3.5); ctx.stroke();
        } });
        const vowels = cellsOf("#board .cell").filter(el => /[AEIOU]/.test((el.querySelector(".ltr") || {}).textContent || "")).map(mid);
        vowels.forEach((p, i) => setTimeout(() => { const ang = Math.atan2(p.y - o.y, p.x - o.x); burst([{ x: p.x, y: p.y, vx: Math.cos(ang) * 300, vy: Math.sin(ang) * 300, life: 0.6, size: 14, color: "rgba(255,255,255,.8)", shape: "text", text: "•", vr: 0 }]); spray(p, 4, { color: "#c6b8ff", shape: "streak", speed: [100, 200], size: [1.5, 2.5], g: 0, life: [0.3, 0.5], add: true }); }, K.still() ? 0 : 500 + i * 40));
        await wait(1600);
    });
})();
