// Boss phases go wild (the user's design, 2026-10-09): "in every phase 2 there's lots of designs in the background,
// everything starts going crazy" - meteors falling and planets colliding in Deep Space, lava bombs on Volcano Island,
// lightning in Rainy City... Each world has its own set pieces, drawn on a canvas in the boss arena (behind the
// board), and every phase after that is wilder: more of them, bigger, faster.
//   Chaos.start(canvas, world, level)   level 1 = phase 2, 2 = phase 3, ... 4 = the Void's phase 5
//   Chaos.stop()
const Chaos = (() => {
    const TAU = Math.PI * 2;
    const rand = (a, b) => a + Math.random() * (b - a);
    const pick = list => list[Math.floor(Math.random() * list.length)];
    let cv = null, ctx = null, raf = 0, last = 0, actors = [], world = "", level = 0, clocks = [], W = 0, H = 0, flash = 0, flashColor = "#fff", shake = 0;

    // ---- drawing helpers ----
    function glow(color, blur) { ctx.shadowColor = color; ctx.shadowBlur = blur; }
    function noGlow() { ctx.shadowBlur = 0; }
    function circle(x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, TAU); ctx.fillStyle = fill; ctx.fill(); }
    function radial(x, y, r, stops) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, r));
        stops.forEach(([o, c]) => g.addColorStop(o, c));
        return g;
    }
    function poly(points, fill, stroke, lw = 2) {
        ctx.beginPath();
        points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
    }
    // a trail of fading circles behind something moving
    function trail(list, color, size) {
        list.forEach(([x, y], i) => { ctx.globalAlpha = (i / list.length) * 0.7; circle(x, y, size * (i / list.length), color); });
        ctx.globalAlpha = 1;
    }
    // a branching lightning bolt from (x, y) down to the ground, as a list of segments
    function bolt(x, y, x2, y2, spread, depth = 0) {
        const segs = [], n = 12;
        let px = x, py = y;
        for (let i = 1; i <= n; i++) {
            const k = i / n, nx = x + (x2 - x) * k + (i < n ? rand(-spread, spread) : 0), ny = y + (y2 - y) * k;
            segs.push([px, py, nx, ny, depth]);
            if (depth < 2 && Math.random() < 0.22) segs.push(...bolt(nx, ny, nx + rand(-160, 160), ny + rand(80, 220), spread * 0.6, depth + 1));
            px = nx; py = ny;
        }
        return segs;
    }
    function drawBolt(segs, color, alpha) {
        ctx.lineCap = "round";
        for (const pass of [[14, 0.25], [6, 0.55], [2.2, 1]]) {
            ctx.strokeStyle = pass[1] === 1 ? "#fff" : color;
            ctx.globalAlpha = alpha * pass[1];
            for (const [x1, y1, x2, y2, d] of segs) { ctx.lineWidth = pass[0] / (1 + d); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
        }
        ctx.globalAlpha = 1;
    }
    // little bits flying out of an explosion
    function debris(x, y, n, colors, speed = [120, 420], size = [2, 6], gravity = 260, life = [0.6, 1.4]) {
        for (let i = 0; i < n; i++) {
            const a = rand(0, TAU), v = rand(...speed), c = pick(colors), s = rand(...size), lf = rand(...life);
            add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: lf, t: 0,
                step(dt) { this.vy += gravity * dt; this.x += this.vx * dt; this.y += this.vy * dt; this.vx *= 0.99; },
                draw() { ctx.globalAlpha = Math.max(0, 1 - this.t / this.life); circle(this.x, this.y, s, c); ctx.globalAlpha = 1; } });
        }
    }
    function ring(x, y, color, maxR, life = 0.8, width = 6) {
        add({ t: 0, life, draw() { const k = this.t / this.life; ctx.globalAlpha = 1 - k; ctx.strokeStyle = color; ctx.lineWidth = width * (1 - k) + 1; ctx.beginPath(); ctx.arc(x, y, maxR * Math.pow(k, 0.6), 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; } });
    }
    function boom(x, y, colors, size = 1) {
        add({ t: 0, life: 0.5, draw() { const k = this.t / this.life; circle(x, y, 70 * size * (0.4 + k), radial(x, y, 70 * size * (0.4 + k), [[0, `rgba(255,255,255,${1 - k})`], [0.4, colors[0] + Math.round((1 - k) * 200).toString(16).padStart(2, "0")], [1, "rgba(0,0,0,0)"]])); } });
        ring(x, y, colors[1] || colors[0], 160 * size);
        debris(x, y, Math.round(26 * size), colors);
        flash = Math.max(flash, 0.18 * size); flashColor = colors[0];
        shake = Math.max(shake, 6 * size);
    }
    function add(a) { if (actors.length < 260) actors.push(a); return a; }

    // ---- falling things with a fiery trail (meteors, lava bombs) ----
    function meteor({ colors, size = [10, 24], speed = [380, 620], angle = [0.25, 0.6], burst = true, shape = "rock" }) {
        const fromLeft = Math.random() < 0.5, a = rand(...angle) * (fromLeft ? 1 : -1), s = rand(...size) * (1 + level * 0.12), v = rand(...speed) * (1 + level * 0.1);
        const groundY = H * rand(0.62, 0.95);
        return add({ x: rand(0.05, 0.95) * W - Math.sin(a) * H * 0.4, y: -60, vx: Math.sin(a) * v, vy: Math.cos(a) * v, rot: 0, path: [], t: 0, life: 9,
            step(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.rot += dt * 3; this.path.push([this.x, this.y]); if (this.path.length > 22) this.path.shift();
                if (this.y >= groundY) { this.dead = true; if (burst) boom(this.x, this.y, colors, s / 18); } },
            draw() {
                ctx.globalCompositeOperation = "lighter";
                trail(this.path, colors[1], s * 0.9);
                ctx.globalCompositeOperation = "source-over";
                glow(colors[0], 24);
                if (shape === "rock") {
                    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rot);
                    poly(Array.from({ length: 7 }, (_, i) => [Math.cos(i / 7 * TAU) * s * (0.8 + (i % 3) * 0.12), Math.sin(i / 7 * TAU) * s * (0.8 + (i % 2) * 0.15)]), colors[2] || "#5a4a46");
                    ctx.restore();
                    circle(this.x - this.vx * 0.012, this.y - this.vy * 0.012, s * 0.7, radial(this.x, this.y, s * 1.4, [[0, "#fff"], [0.4, colors[0]], [1, "rgba(0,0,0,0)"]]));
                } else circle(this.x, this.y, s, radial(this.x, this.y, s, [[0, "#fff"], [0.35, colors[0]], [1, colors[1]]]));
                noGlow();
            } });
    }

    // ---- each world's set pieces: [spawn function, seconds between them at level 1] ----
    const WORLDS = {
        // Deep Space: a meteor shower, planets colliding and exploding, shooting stars, a supernova
        space: [
            [() => meteor({ colors: ["#ffb347", "#ff6a00", "#5b4b55"] }), 0.9],
            [() => { for (let i = 0; i < 3; i++) setTimeout(() => cv && add(shootingStar()), i * 120); }, 2.2],
            [planetCrash, 7],
            [() => { const x = rand(0.1, 0.9) * W, y = rand(0.08, 0.4) * H; ring(x, y, "#9fd8ff", 420, 1.6, 10); ring(x, y, "#ff7ad9", 300, 1.2, 6); flash = 0.22; flashColor = "#b48cff"; }, 11]
        ],
        // Volcano Island: lava bombs, geysers out of the ground, ash and a fire tornado
        volcano: [
            [() => meteor({ colors: ["#ffcf3f", "#ff3d00", "#3a2622"], speed: [300, 520], angle: [0.05, 0.35] }), 0.8],
            [() => geyser(["#ffe066", "#ff7a1f", "#d62f12"]), 3],
            [() => { for (let i = 0; i < 10; i++) add(floater({ c: pick(["#6b5a55", "#8a7a74", "#3d302c"]), s: rand(2, 5), vy: rand(-30, 30), vx: rand(60, 160), life: 6 })); }, 1.2],
            [() => tornado(["#ffcf3f", "#ff6a00", "#ff2d2d"]), 9]
        ],
        // Rainy City: real branching lightning, sheets of rain, thunder flashes
        rain: [
            [lightning, 1.6],
            [() => { for (let i = 0; i < 30; i++) add(streak("rgba(170,205,255,.75)", rand(900, 1300), -0.25)); }, 0.25],
            [() => { const x = rand(0.1, 0.9) * W, y = H * rand(0.8, 0.98); for (let i = 0; i < 3; i++) setTimeout(() => cv && ring(x, y, "rgba(170,205,255,.8)", 60 + i * 30, 1, 2), i * 150); }, 0.6]
        ],
        // Notebook: giant pencil scribbles, paper planes, crumpled paper balls, ink splats
        paper: [
            [() => scribble(pick(["#3b6fe0", "#e2483c", "#2b2233", "#3fbf6b"])), 1.4],
            [() => add(plane("#fff", "#9aa3b5")), 1.8],
            [() => { const b = meteor({ colors: ["#ffffff", "#d9dbe3", "#c6c9d6"], size: [14, 26], speed: [260, 420], burst: false, shape: "ball" }); b.onBounce = true; }, 1.6],
            [() => splat(rand(0.05, 0.95) * W, rand(0.1, 0.9) * H, pick(["#1d2240", "#3b2a6e", "#c42536"]), rand(30, 70)), 2.4]
        ],
        // Garden: vines lashing in from the edges, petal tornadoes, bee swarms, seed bursts
        garden: [
            [() => vine(pick(["#3f8f3a", "#2f7a2c", "#5aa84a"])), 1.8],
            [() => tornado(["#ffb3d9", "#e3b8ff", "#fff"], "petal"), 6],
            [() => { const y = rand(0.15, 0.7) * H, dir = Math.random() < 0.5 ? 1 : -1; for (let i = 0; i < 9; i++) add(bee(y + rand(-40, 40), dir, i * 0.08)); }, 3],
            [() => { const x = rand(0.1, 0.9) * W, y = rand(0.1, 0.6) * H; debris(x, y, 30, ["#fff", "#f6f0d0", "#e6dcae"], [60, 220], [1.5, 3.5], 20, [1.5, 3]); }, 1.4]
        ],
        // Acorn Woods: acorns raining and bouncing, leaf whirlwinds, a swooping owl, falling branches
        squirrel: [
            [() => { for (let i = 0; i < 3; i++) add(bouncer({ c: "#8a5a2b", cap: "#5b3a1a", s: rand(8, 13) })); }, 0.9],
            [() => tornado(["#e8792b", "#d9542a", "#f2a93b"], "leaf"), 5],
            [() => add(owl()), 6],
            [() => add(branch()), 3.5]
        ],
        // Candy Hills: gumballs raining and bouncing, spinning lollipops, flying candy canes, sprinkle bursts
        candy: [
            [() => { for (let i = 0; i < 3; i++) add(bouncer({ c: pick(["#ff5fa2", "#7ad7ff", "#ffd23f", "#7dff6b", "#c08bff"]), s: rand(10, 18), gum: true })); }, 0.8],
            [() => add(lolly()), 2.6],
            [() => add(cane()), 1.6],
            [() => { const x = rand(0.1, 0.9) * W, y = rand(0.1, 0.6) * H; debris(x, y, 40, ["#ff6fb4", "#7ad7ff", "#ffd23f", "#7dff6b", "#fff"], [140, 460], [2, 4]); ring(x, y, "#ff9ccf", 120); }, 1.5]
        ],
        // Coral Reef: tentacles rising from below, huge waves, bubble torrents, a whirlpool
        ocean: [
            [() => add(tentacle()), 2.2],
            [() => add(wave()), 4],
            [() => { const x = rand(0.05, 0.95) * W; for (let i = 0; i < 18; i++) add(bubble(x + rand(-30, 30), H + rand(0, 200))); }, 0.9],
            [() => add(whirl("#7ae0ff")), 8]
        ],
        // Snow Day: a blizzard, giant snowballs rolling across, ice shards falling, an avalanche cloud
        snow: [
            [() => { for (let i = 0; i < 26; i++) add(streak("rgba(255,255,255,.85)", rand(500, 800), -1.2)); }, 0.3],
            [() => add(snowball()), 3],
            [() => meteor({ colors: ["#e8f8ff", "#9fd8ff", "#c6ecff"], size: [8, 16], speed: [500, 700], angle: [0, 0.1], shape: "ball" }), 0.9],
            [() => add(cloudBank("rgba(255,255,255,.75)")), 6]
        ],
        // Sky Kingdom: a tornado, flocks of birds, rushing clouds, wind streams
        sky: [
            [() => tornado(["#ffffff", "#d7e8ff", "#a9c6ea"]), 5],
            [() => { const y = rand(0.1, 0.6) * H, dir = Math.random() < 0.5 ? 1 : -1; for (let i = 0; i < 12; i++) add(bird(y + (i % 4) * 14 - Math.floor(i / 4) * 10, dir, i * 0.07)); }, 2.4],
            [() => add(cloudBank("rgba(255,255,255,.8)", true)), 2],
            [() => { for (let i = 0; i < 8; i++) add(windLine()); }, 0.6]
        ],
        // Desert Caravan: walls of sand, sand twisters, scarab swarms, glowing hieroglyphs
        desert: [
            [() => { for (let i = 0; i < 40; i++) add(floater({ c: pick(["#ffd79c", "#e0b060", "#fff1c8"]), s: rand(1.5, 3.5), vx: rand(400, 700), vy: rand(-20, 60), life: 4, fromLeft: true })); }, 0.35],
            [() => tornado(["#e0b060", "#c9953f", "#ffe0a8"], "sand"), 5],
            [() => { const y = rand(0.7, 0.95) * H, dir = Math.random() < 0.5 ? 1 : -1; for (let i = 0; i < 10; i++) add(scarab(y + rand(-30, 30), dir, i * 0.1)); }, 3.5],
            [() => add(glyph()), 1.6]
        ],
        // Big Top Carnival: fireworks, sweeping spotlights, confetti cannons
        carnival: [
            [firework, 0.9],
            [() => add(spotlight()), 3],
            [() => { const left = Math.random() < 0.5, x = left ? 0 : W, y = H * 0.9; for (let i = 0; i < 40; i++) { const a = (left ? -0.9 : -2.24) + rand(-0.3, 0.3), v = rand(400, 800); add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: rand(0, 6), c: pick(["#e2483c", "#ffd23f", "#4fa3e8", "#fff", "#7dff6b"]), t: 0, life: 3, step(dt) { this.vy += 420 * dt; this.vx *= 0.985; this.x += this.vx * dt; this.y += this.vy * dt; this.rot += dt * 8; }, draw() { ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rot); ctx.fillStyle = this.c; ctx.fillRect(-5, -3, 10, 6); ctx.restore(); } }); } }, 2.5]
        ],
        // Neon Arcade: invaders marching, glitch blocks, neon laser sweeps, screen tears
        arcade: [
            [() => { const y = rand(0.08, 0.5) * H; for (let i = 0; i < 6; i++) add(invader(i * 60, y, pick(["#2bf0ff", "#ff2bd6", "#7dff6b", "#ffe066"]))); }, 3],
            [() => { for (let i = 0; i < 6; i++) add(glitchBlock()); }, 0.5],
            [() => add(laser(pick(["#2bf0ff", "#ff2bd6"]))), 1.8],
            [() => add(tear()), 2.2]
        ],
        // Haunted Library: books flapping around, ghost wisps, floating candles, a storm of pages
        library: [
            [() => add(book()), 1.1],
            [() => add(ghost()), 2.2],
            [() => add(candle()), 1.6],
            [() => { for (let i = 0; i < 12; i++) add(page()); }, 1.4]
        ],
        // Robot Factory: spark fountains, flying gears, a sweeping laser grid, electric arcs
        robot: [
            [() => { const x = rand(0.05, 0.95) * W; for (let i = 0; i < 30; i++) add(spark(x, H * rand(0.85, 1))); }, 0.7],
            [() => add(gear()), 1.3],
            [() => add(laser("#ff3b3b", true)), 2.6],
            [arc, 1.5]
        ]
    };

    // ---- the pieces ----
    function shootingStar() {
        const x = rand(0, W), y = rand(-40, H * 0.3), a = rand(0.35, 0.6), v = rand(900, 1300);
        return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, path: [], t: 0, life: 2,
            step(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.path.push([this.x, this.y]); if (this.path.length > 14) this.path.shift(); },
            draw() { ctx.globalCompositeOperation = "lighter"; trail(this.path, "#cfe9ff", 3); ctx.globalCompositeOperation = "source-over"; circle(this.x, this.y, 2.5, "#fff"); } };
    }
    function planetCrash() {
        const y = rand(0.15, 0.5) * H, mid = rand(0.3, 0.7) * W, r1 = rand(26, 46) * (1 + level * 0.15), r2 = rand(20, 40) * (1 + level * 0.15);
        const colors = [["#ff9f6b", "#c4532c"], ["#7ad7ff", "#2f6fbf"], ["#b48cff", "#5b3a9e"], ["#9be36b", "#3f8f3a"], ["#ffd23f", "#c48a12"]];
        const [c1, c2] = [pick(colors), pick(colors)];
        const planet = (x, dir, r, c) => add({ x, y, dir, r, t: 0, life: 9, step(dt) { this.x += this.dir * 110 * (1 + level * 0.2) * dt; if (Math.abs(this.x - mid) < this.r * 0.6) this.dead = true; },
            draw() { glow(c[0], 30); circle(this.x, this.y, this.r, radial(this.x - this.r * 0.35, this.y - this.r * 0.35, this.r * 1.5, [[0, "#fff"], [0.25, c[0]], [1, c[1]]])); noGlow();
                ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(this.x, this.y, this.r * 1.6, this.r * 0.35, -0.3, 0, TAU); ctx.stroke(); } });
        const a = planet(mid - W * 0.32, 1, r1, c1), b = planet(mid + W * 0.32, -1, r2, c2);
        const watch = add({ t: 0, life: 12, step() { if (a.dead && b.dead) { this.dead = true; boom(mid, y, ["#ffffff", c1[0], c2[0], c1[1], c2[1]], 2.4); ring(mid, y, "#fff", 520, 1.4, 12); } }, draw() {} });
        return watch;
    }
    function geyser(colors) {
        const x = rand(0.05, 0.95) * W, h = H * rand(0.35, 0.65) * (1 + level * 0.12);
        add({ t: 0, life: 1.6, draw() {
            const k = this.t / this.life, up = Math.sin(Math.min(1, k * 2) * Math.PI / 2) * h * (k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3);
            const g = ctx.createLinearGradient(x, H, x, H - up);
            g.addColorStop(0, colors[2]); g.addColorStop(0.5, colors[1]); g.addColorStop(1, colors[0]);
            glow(colors[1], 30);
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.moveTo(x - 26, H); ctx.quadraticCurveTo(x - 10, H - up * 0.6, x, H - up); ctx.quadraticCurveTo(x + 10, H - up * 0.6, x + 26, H); ctx.fill();
            noGlow();
        } });
        debris(x, H - h * 0.8, 24, colors, [100, 380], [3, 7], 500, [0.8, 1.6]);
    }
    function tornado(colors, kind = "wind") {
        const x0 = Math.random() < 0.5 ? -100 : W + 100, dir = x0 < 0 ? 1 : -1, hgt = H * rand(0.6, 0.9), parts = Array.from({ length: 70 }, () => ({ k: Math.random(), a: rand(0, TAU), c: pick(colors) }));
        return add({ x: x0, t: 0, life: 9, step(dt) { this.x += dir * W / 7 * dt * (1 + level * 0.15); if (this.x < -200 || this.x > W + 200) this.dead = this.t > 1; },
            draw() {
                for (const p of parts) {
                    p.a += 0.12 + (1 - p.k) * 0.12;
                    const y = H - p.k * hgt, rad = 20 + p.k * p.k * 160 * (1 + level * 0.1), px = this.x + Math.cos(p.a) * rad + Math.sin(this.t * 3 + p.k * 6) * 20, depth = Math.sin(p.a);
                    ctx.globalAlpha = 0.35 + depth * 0.3;
                    if (kind === "petal" || kind === "leaf") { ctx.save(); ctx.translate(px, y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.beginPath(); ctx.ellipse(0, 0, 8, 4, 0, 0, TAU); ctx.fill(); ctx.restore(); }
                    else circle(px, y, kind === "sand" ? 3 : 5 + p.k * 6, p.c);
                }
                ctx.globalAlpha = 1;
            } });
    }
    function lightning() {
        const x = rand(0.05, 0.95) * W, segs = bolt(x, -10, x + rand(-200, 200), H * rand(0.7, 1), 60);
        flash = 0.35; flashColor = "#cfe0ff"; shake = Math.max(shake, 5);
        add({ t: 0, life: 0.45, draw() { const k = this.t / this.life; drawBolt(segs, "#9fc4ff", k < 0.15 ? 1 : k < 0.3 ? 0.4 : k < 0.45 ? 1 : 1 - k); } });
        if (level >= 2 && Math.random() < 0.5) setTimeout(() => cv && lightning(), 180);
    }
    function streak(color, speed, slant) {
        return { x: rand(-100, W + 100), y: rand(-H * 0.2, 0), vx: speed * slant * 0.3, vy: speed, len: rand(14, 28), t: 0, life: 3,
            step(dt) { this.x += this.vx * dt; this.y += this.vy * dt; if (this.y > H + 30) this.dead = true; },
            draw() { ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x - this.vx * 0.03, this.y - this.len); ctx.stroke(); } };
    }
    function floater({ c, s, vx, vy, life, fromLeft }) {
        return { x: fromLeft ? rand(-W * 0.3, 0) : rand(0, W), y: rand(0, H), vx, vy, t: 0, life,
            step(dt) { this.x += this.vx * dt; this.y += this.vy * dt + Math.sin(this.t * 4) * 0.5; },
            draw() { ctx.globalAlpha = Math.min(1, (this.life - this.t)); circle(this.x, this.y, s, c); ctx.globalAlpha = 1; } };
    }
    function scribble(color) {
        const pts = [], x0 = rand(0.05, 0.8) * W, y0 = rand(0.05, 0.8) * H, n = 26;
        let x = x0, y = y0, a = rand(0, TAU);
        for (let i = 0; i < n; i++) { a += rand(-1.6, 1.6); x += Math.cos(a) * 40; y += Math.sin(a) * 26; pts.push([x, y]); }
        add({ t: 0, life: 2.6, draw() {
            const k = Math.min(1, this.t / 0.9), m = Math.max(2, Math.floor(pts.length * k));
            ctx.globalAlpha = this.t > 1.8 ? 1 - (this.t - 1.8) / 0.8 : 1;
            ctx.strokeStyle = color; ctx.lineWidth = 7; ctx.lineCap = "round"; ctx.lineJoin = "round";
            ctx.beginPath(); pts.slice(0, m).forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke();
            // the giant pencil drawing it
            const [px, py] = pts[m - 1];
            ctx.save(); ctx.translate(px, py); ctx.rotate(-0.7);
            poly([[0, 0], [10, -22], [-10, -22]], "#f2d2a2"); poly([[0, 0], [4, -9], [-4, -9]], color);
            ctx.fillStyle = "#ffd23f"; ctx.fillRect(-10, -120, 20, 98); ctx.fillStyle = "#ff8fa3"; ctx.fillRect(-10, -136, 20, 16);
            ctx.restore(); ctx.globalAlpha = 1;
        } });
    }
    function plane(fill, line) {
        const dir = Math.random() < 0.5 ? 1 : -1, y0 = rand(0.1, 0.6) * H;
        return { x: dir > 0 ? -60 : W + 60, y: y0, t: 0, life: 8, path: [],
            step(dt) { this.x += dir * 300 * (1 + level * 0.15) * dt; this.y = y0 + Math.sin(this.t * 2.5) * 60; this.path.push([this.x, this.y]); if (this.path.length > 30) this.path.shift(); if (this.x < -100 || this.x > W + 100) this.dead = true; },
            draw() {
                ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.setLineDash([6, 8]); ctx.lineWidth = 2; ctx.beginPath(); this.path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.setLineDash([]);
                ctx.save(); ctx.translate(this.x, this.y); ctx.scale(dir, 1); ctx.rotate(Math.cos(this.t * 2.5) * 0.4);
                poly([[26, 0], [-18, -14], [-8, 0]], fill, line); poly([[26, 0], [-18, 12], [-8, 0]], "#e6e8ef", line);
                ctx.restore();
            } };
    }
    function splat(x, y, color, r) {
        const blobs = Array.from({ length: 9 }, () => [rand(0, TAU), rand(0.5, 1.4) * r, rand(0.15, 0.35) * r]);
        add({ t: 0, life: 3, draw() {
            const k = Math.min(1, this.t / 0.15);
            ctx.globalAlpha = this.t > 2.2 ? 1 - (this.t - 2.2) / 0.8 : 0.9;
            circle(x, y, r * k, color);
            for (const [a, d, s] of blobs) circle(x + Math.cos(a) * d * k, y + Math.sin(a) * d * k, s * k, color);
            ctx.globalAlpha = 1;
        } });
    }
    function vine(color) {
        const side = pick(["left", "right", "bottom"]), pts = [];
        let x = side === "left" ? 0 : side === "right" ? W : rand(0, W), y = side === "bottom" ? H : rand(0.2, 0.9) * H, a = side === "left" ? 0 : side === "right" ? Math.PI : -Math.PI / 2;
        for (let i = 0; i < 34; i++) { a += rand(-0.35, 0.35); x += Math.cos(a) * 18; y += Math.sin(a) * 18; pts.push([x, y]); }
        add({ t: 0, life: 4, draw() {
            const k = Math.min(1, this.t / 1.2), m = Math.max(2, Math.floor(pts.length * k));
            ctx.globalAlpha = this.t > 3 ? 4 - this.t : 1;
            ctx.strokeStyle = color; ctx.lineWidth = 9; ctx.lineCap = "round";
            ctx.beginPath(); ctx.moveTo(side === "left" ? 0 : side === "right" ? W : pts[0][0], side === "bottom" ? H : pts[0][1]); pts.slice(0, m).forEach(([px, py]) => ctx.lineTo(px, py)); ctx.stroke();
            pts.slice(0, m).forEach(([px, py], i) => { if (i % 4 === 2) { poly([[px, py], [px + 10, py - 12], [px + 3, py - 1]], "#cfe8b0"); } if (i % 6 === 5) circle(px, py - 6, 6, "#e85a9b"); });
            ctx.globalAlpha = 1;
        } });
    }
    function bee(y0, dir, delay) {
        return { x: dir > 0 ? -40 - delay * 300 : W + 40 + delay * 300, y: y0, t: 0, life: 9,
            step(dt) { this.x += dir * 260 * dt; this.y = y0 + Math.sin(this.t * 9 + delay * 20) * 18; if (this.t > 2 && (this.x < -80 || this.x > W + 80)) this.dead = true; },
            draw() { ctx.save(); ctx.translate(this.x, this.y); ctx.scale(dir, 1);
                ctx.globalAlpha = 0.7; circle(-2, -8, 6, "#fff"); ctx.globalAlpha = 1;
                ctx.fillStyle = "#ffd23f"; ctx.beginPath(); ctx.ellipse(0, 0, 10, 7, 0, 0, TAU); ctx.fill();
                ctx.fillStyle = "#2b2233"; ctx.fillRect(-3, -7, 3, 14); ctx.fillRect(3, -6, 2.5, 12); circle(9, -1, 1.6, "#2b2233"); ctx.restore(); } };
    }
    function bouncer({ c, cap, s, gum }) {
        return { x: rand(0, W), y: -30, vx: rand(-80, 80), vy: rand(100, 260), s, t: 0, life: 7, bounces: 0, rot: 0,
            step(dt) { this.vy += 900 * dt; this.x += this.vx * dt; this.y += this.vy * dt; this.rot += this.vx * dt * 0.05;
                if (this.y > H - this.s && this.vy > 0) { this.y = H - this.s; this.vy *= -0.55; this.bounces++; if (this.bounces > 3) this.dead = true; } },
            draw() { ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rot);
                if (gum) { circle(0, 0, this.s, radial(-this.s * 0.3, -this.s * 0.3, this.s * 1.6, [[0, "#fff"], [0.3, c], [1, c]])); }
                else { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, 2, this.s * 0.8, this.s, 0, 0, TAU); ctx.fill(); ctx.fillStyle = cap; ctx.beginPath(); ctx.ellipse(0, -this.s * 0.5, this.s, this.s * 0.5, 0, Math.PI, TAU); ctx.fill(); ctx.fillRect(-1.5, -this.s - 5, 3, 6); }
                ctx.restore(); } };
    }
    function owl() {
        const dir = Math.random() < 0.5 ? 1 : -1;
        return { x: dir > 0 ? -120 : W + 120, t: 0, life: 6,
            step(dt) { this.x += dir * W / 3.2 * dt; if (this.t > 1 && (this.x < -150 || this.x > W + 150)) this.dead = true; },
            draw() { const y = H * 0.25 + Math.sin(this.x / W * Math.PI) * H * 0.35, flap = Math.sin(this.t * 14) * 0.5;
                ctx.save(); ctx.translate(this.x, y); ctx.scale(dir * 1.6, 1.6); ctx.fillStyle = "rgba(40,25,20,.85)";
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-30, -20 - flap * 30, -70, -5 + flap * 20); ctx.quadraticCurveTo(-30, 5, 0, 8); ctx.fill();
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(30, -20 - flap * 30, 70, -5 + flap * 20); ctx.quadraticCurveTo(30, 5, 0, 8); ctx.fill();
                ctx.beginPath(); ctx.ellipse(0, 4, 14, 18, 0, 0, TAU); ctx.fill(); circle(-5, -2, 3.5, "#ffd23f"); circle(5, -2, 3.5, "#ffd23f"); ctx.restore(); } };
    }
    function branch() {
        const x = rand(0.05, 0.95) * W, len = rand(80, 160);
        return { x, y: -40, vy: 0, rot: rand(-1, 1), vr: rand(-2, 2), t: 0, life: 4,
            step(dt) { this.vy += 600 * dt; this.y += this.vy * dt; this.rot += this.vr * dt; if (this.y > H + 80) this.dead = true; },
            draw() { ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rot); ctx.strokeStyle = "#5b3a1a"; ctx.lineWidth = 8; ctx.lineCap = "round";
                ctx.beginPath(); ctx.moveTo(-len / 2, 0); ctx.lineTo(len / 2, 0); ctx.moveTo(0, 0); ctx.lineTo(len * 0.25, -len * 0.25); ctx.stroke();
                [[-len / 3, -6], [len / 4, 8], [len * 0.25, -len * 0.25]].forEach(([lx, ly]) => { ctx.fillStyle = "#e8792b"; ctx.beginPath(); ctx.ellipse(lx, ly, 12, 6, 0.5, 0, TAU); ctx.fill(); });
                ctx.restore(); } };
    }
    function lolly() {
        const x = rand(0.05, 0.95) * W, y = rand(0.1, 0.8) * H, r = rand(30, 60) * (1 + level * 0.1), cols = [pick(["#ff5fa2", "#7ad7ff", "#ffd23f"]), "#fff"];
        return { t: 0, life: 3,
            draw() { const k = this.t / this.life, s = Math.sin(Math.min(1, k * 3) * Math.PI / 2) * (k > 0.8 ? (1 - k) / 0.2 : 1);
                ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(this.t * 6);
                ctx.fillStyle = "#fff"; ctx.fillRect(-3, 0, 6, r * 2.2);
                for (let i = 0; i < 6; i++) { ctx.fillStyle = cols[i % 2]; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, i / 6 * TAU, (i + 1) / 6 * TAU); ctx.fill(); }
                ctx.strokeStyle = "#2b2233"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); ctx.restore(); } };
    }
    function cane() {
        const dir = Math.random() < 0.5 ? 1 : -1;
        return { x: dir > 0 ? -60 : W + 60, y: rand(0.1, 0.8) * H, rot: 0, t: 0, life: 6,
            step(dt) { this.x += dir * 520 * dt; this.rot += dir * 7 * dt; if (this.t > 0.5 && (this.x < -100 || this.x > W + 100)) this.dead = true; },
            draw() { ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rot); ctx.lineCap = "round";
                ctx.lineWidth = 12; ctx.strokeStyle = "#fff"; ctx.beginPath(); ctx.moveTo(0, 40); ctx.lineTo(0, -20); ctx.arc(14, -20, 14, Math.PI, 0); ctx.stroke();
                ctx.setLineDash([8, 8]); ctx.strokeStyle = "#e2283c"; ctx.stroke(); ctx.setLineDash([]); ctx.restore(); } };
    }
    function tentacle() {
        const x = rand(0.05, 0.95) * W, len = H * rand(0.35, 0.6) * (1 + level * 0.1), side = Math.random() < 0.5 ? 1 : -1;
        return { t: 0, life: 3.4,
            draw() { const k = this.t / this.life, up = Math.sin(Math.min(1, k * 2.2) * Math.PI / 2) * (k > 0.75 ? (1 - k) / 0.25 : 1);
                const n = 18, pts = [];
                for (let i = 0; i <= n; i++) { const q = i / n; pts.push([x + Math.sin(q * 4 + this.t * 3) * 40 * q * side, H - q * len * up]); }
                for (let i = 0; i < n; i++) { const w = 26 * (1 - i / n) + 4; ctx.strokeStyle = "#8a3fa3"; ctx.lineWidth = w; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(...pts[i]); ctx.lineTo(...pts[i + 1]); ctx.stroke(); }
                for (let i = 2; i < n; i += 2) circle(pts[i][0] - side * 6, pts[i][1], 4 * (1 - i / n) + 1.5, "#f0b5ff"); } };
    }
    function wave() {
        const dir = Math.random() < 0.5 ? 1 : -1, hgt = H * rand(0.25, 0.4) * (1 + level * 0.1);
        return { x: dir > 0 ? -W * 0.6 : W * 1.6, t: 0, life: 5,
            step(dt) { this.x += dir * W * 0.45 * dt; if (this.t > 1 && (this.x < -W || this.x > W * 2)) this.dead = true; },
            draw() { const c = this.x;
                const g = ctx.createLinearGradient(0, H - hgt, 0, H); g.addColorStop(0, "rgba(120,220,255,.85)"); g.addColorStop(1, "rgba(20,90,170,.85)");
                ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(c - W * 0.6, H);
                ctx.bezierCurveTo(c - W * 0.3, H - hgt * 0.2, c - 60 * dir, H - hgt * 1.1, c + 80 * dir, H - hgt * 0.8);
                ctx.quadraticCurveTo(c + 20 * dir, H - hgt * 0.65, c + 60 * dir, H - hgt * 0.5);
                ctx.bezierCurveTo(c + 200 * dir, H - hgt * 0.2, c + W * 0.3 * dir, H, c + W * 0.6 * dir, H); ctx.fill();
                for (let i = 0; i < 8; i++) circle(c + 60 * dir + Math.sin(this.t * 6 + i) * 30, H - hgt * 0.85 - i * 4, 6 - i * 0.5, "rgba(255,255,255,.8)"); } };
    }
    function bubble(x, y) {
        const s = rand(3, 12);
        return { x, y, t: 0, life: 6, step(dt) { this.y -= (120 + 40 / s * 10) * dt; this.x += Math.sin(this.t * 4 + s) * 1.2; if (this.y < -20) this.dead = true; },
            draw() { ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(this.x, this.y, s, 0, TAU); ctx.stroke(); circle(this.x - s * 0.35, this.y - s * 0.35, s * 0.25, "rgba(255,255,255,.9)"); } };
    }
    function whirl(color) {
        const x = rand(0.25, 0.75) * W, y = rand(0.25, 0.6) * H;
        return { t: 0, life: 4, draw() { const k = this.t / this.life, a = Math.sin(k * Math.PI);
            ctx.strokeStyle = color; ctx.globalAlpha = a * 0.7;
            for (let j = 0; j < 4; j++) { ctx.lineWidth = 4 - j * 0.7; ctx.beginPath(); for (let i = 0; i < 80; i++) { const q = i / 80, ang = q * 12 + this.t * 5 + j * 1.5, r = q * 200 * (1 + level * 0.12); const px = x + Math.cos(ang) * r, py = y + Math.sin(ang) * r * 0.45; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke(); }
            ctx.globalAlpha = 1; } };
    }
    function snowball() {
        const dir = Math.random() < 0.5 ? 1 : -1, r = rand(40, 80) * (1 + level * 0.12);
        return { x: dir > 0 ? -r : W + r, rot: 0, t: 0, life: 8,
            step(dt) { this.x += dir * 360 * dt; this.rot += dir * 360 * dt / r; if (Math.random() < 0.4) debris(this.x - dir * r * 0.6, H - 6, 1, ["#fff", "#e8f8ff"], [40, 140], [2, 4], 300, [0.4, 0.8]); if (this.t > 1 && (this.x < -2 * r || this.x > W + 2 * r)) this.dead = true; },
            draw() { const y = H - r + 6; circle(this.x, y, r, radial(this.x - r * 0.3, y - r * 0.3, r * 1.4, [[0, "#fff"], [0.6, "#eef7ff"], [1, "#b9d8ef"]]));
                ctx.save(); ctx.translate(this.x, y); ctx.rotate(this.rot); for (let i = 0; i < 5; i++) circle(Math.cos(i * 1.3) * r * 0.55, Math.sin(i * 1.3) * r * 0.55, r * 0.1, "rgba(160,200,230,.5)"); ctx.restore(); } };
    }
    function cloudBank(color, fast) {
        const dir = Math.random() < 0.5 ? 1 : -1, y = fast ? rand(0.05, 0.6) * H : H * rand(0.75, 0.9), s = rand(60, 120) * (fast ? 0.8 : 1.6);
        return { x: dir > 0 ? -s * 3 : W + s * 3, t: 0, life: 10,
            step(dt) { this.x += dir * (fast ? 520 : 240) * dt; if (this.t > 1 && (this.x < -s * 4 || this.x > W + s * 4)) this.dead = true; },
            draw() { ctx.fillStyle = color; [[0, 0, 1], [-s * 0.9, s * 0.25, 0.7], [s * 0.9, s * 0.25, 0.75], [s * 1.7, s * 0.4, 0.5], [-s * 1.7, s * 0.4, 0.5]].forEach(([dx, dy, k]) => circle(this.x + dx, y + dy, s * k, color)); } };
    }
    function bird(y0, dir, delay) {
        return { x: dir > 0 ? -40 - delay * 400 : W + 40 + delay * 400, t: 0, life: 9,
            step(dt) { this.x += dir * 380 * dt; if (this.t > 2 && (this.x < -80 || this.x > W + 80)) this.dead = true; },
            draw() { const y = y0 + Math.sin(this.t * 3 + delay * 9) * 10, f = Math.sin(this.t * 16 + delay * 30) * 8;
                ctx.strokeStyle = "rgba(43,34,51,.8)"; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(this.x - 12, y - f); ctx.quadraticCurveTo(this.x - 5, y - 4, this.x, y); ctx.quadraticCurveTo(this.x + 5, y - 4, this.x + 12, y - f); ctx.stroke(); } };
    }
    function windLine() {
        const y = rand(0, H), len = rand(120, 280);
        return { x: -len, t: 0, life: 3, step(dt) { this.x += 1400 * dt; if (this.x > W + len) this.dead = true; },
            draw() { const g = ctx.createLinearGradient(this.x - len, 0, this.x, 0); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(255,255,255,.8)");
                ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(this.x - len, y); ctx.quadraticCurveTo(this.x - len / 2, y - 14, this.x, y); ctx.stroke(); } };
    }
    function scarab(y, dir, delay) {
        return { x: dir > 0 ? -30 - delay * 300 : W + 30 + delay * 300, t: 0, life: 10,
            step(dt) { this.x += dir * 200 * dt; if (this.t > 2 && (this.x < -60 || this.x > W + 60)) this.dead = true; },
            draw() { const yy = y + Math.sin(this.t * 10 + delay * 40) * 3; ctx.save(); ctx.translate(this.x, yy); ctx.scale(dir, 1);
                ctx.fillStyle = "#1e5f6b"; ctx.beginPath(); ctx.ellipse(0, 0, 11, 8, 0, 0, TAU); ctx.fill(); ctx.fillStyle = "#2f9aa8"; ctx.beginPath(); ctx.ellipse(-2, -2, 6, 3, 0, 0, TAU); ctx.fill();
                ctx.strokeStyle = "#13353b"; ctx.lineWidth = 1.5; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 5, 6); ctx.lineTo(i * 5 + Math.sin(this.t * 30 + i) * 3, 12); ctx.stroke(); }
                circle(11, 0, 3.5, "#13353b"); ctx.restore(); } };
    }
    function glyph() {
        const x = rand(0.05, 0.95) * W, y = rand(0.05, 0.6) * H, ch = pick(["𓂀", "𓆣", "𓋹", "𓃭", "𓅓", "𓁹", "𓊽"]), s = rand(40, 80);
        return { t: 0, life: 2.4, draw() { const k = this.t / this.life; ctx.globalAlpha = Math.sin(k * Math.PI); glow("#ffcf6b", 30); ctx.fillStyle = "#ffe8a8"; ctx.font = `${s}px serif`; ctx.textAlign = "center"; ctx.fillText(ch, x, y + k * -20); noGlow(); ctx.globalAlpha = 1; } };
    }
    function firework() {
        const x = rand(0.1, 0.9) * W, top = rand(0.08, 0.45) * H, c = pick(["#ff5c6c", "#ffd23f", "#4fa3e8", "#7dff6b", "#ff9ccf", "#c08bff"]);
        add({ x, y: H, t: 0, life: 4, path: [],
            step(dt) { this.y -= 900 * dt; this.path.push([this.x, this.y]); if (this.path.length > 12) this.path.shift();
                if (this.y <= top) { this.dead = true; debris(this.x, this.y, 50 + level * 12, [c, "#fff"], [160, 420], [2, 3.5], 140, [0.9, 1.6]); ring(this.x, this.y, c, 180, 0.9, 3); flash = Math.max(flash, 0.08); flashColor = c; } },
            draw() { ctx.globalCompositeOperation = "lighter"; trail(this.path, c, 3); ctx.globalCompositeOperation = "source-over"; } });
    }
    function spotlight() {
        const x = Math.random() < 0.5 ? 0 : W, c = pick(["rgba(255,240,180,.25)", "rgba(255,160,200,.22)", "rgba(160,220,255,.22)"]);
        return { t: 0, life: 4, draw() { const a = (x === 0 ? -0.9 : -2.24) + Math.sin(this.t * 1.5) * 0.6, len = Math.hypot(W, H);
            ctx.globalAlpha = Math.sin(Math.min(1, this.t / this.life) * Math.PI); ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, H);
            ctx.lineTo(x + Math.cos(a - 0.08) * len, H + Math.sin(a - 0.08) * len); ctx.lineTo(x + Math.cos(a + 0.08) * len, H + Math.sin(a + 0.08) * len); ctx.fill(); ctx.globalAlpha = 1; } };
    }
    function invader(dx, y, c) {
        const map = ["0010000100", "0001001000", "0011111100", "0110110110", "1111111111", "1011111101", "1010000101", "0001101100"];
        return { x: -200 + dx, t: 0, life: 12, step(dt) { this.x += 160 * dt; if (this.x > W + 60) this.dead = true; },
            draw() { const s = 4, frame = Math.floor(this.t * 3) % 2, yy = y + Math.floor(this.t * 1.5) * 6;
                glow(c, 12); ctx.fillStyle = c;
                map.forEach((row, r) => [...row].forEach((v, q) => { if (v === "1") ctx.fillRect(this.x + q * s, yy + r * s + (r > 5 && frame ? s : 0), s, s); })); noGlow(); } };
    }
    function glitchBlock() {
        const x = rand(0, W), y = rand(0, H), w = rand(20, 160), h = rand(4, 22), c = pick(["#2bf0ff", "#ff2bd6", "#ffe066", "#7dff6b", "#fff"]);
        return { t: 0, life: rand(0.1, 0.35), draw() { ctx.globalAlpha = 0.7; ctx.fillStyle = c; ctx.fillRect(x + rand(-8, 8), y, w, h); ctx.globalAlpha = 1; } };
    }
    function laser(c, grid) {
        const horizontal = Math.random() < 0.5;
        return { t: 0, life: 1.8, draw() { const k = this.t / this.life, p = (horizontal ? H : W) * k;
            glow(c, 20); ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.globalAlpha = 0.85;
            const lines = grid ? [p - 80, p, p + 80] : [p];
            for (const q of lines) { ctx.beginPath(); if (horizontal) { ctx.moveTo(0, q); ctx.lineTo(W, q); } else { ctx.moveTo(q, 0); ctx.lineTo(q, H); } ctx.stroke(); }
            ctx.globalAlpha = 1; noGlow(); } };
    }
    function tear() {
        const y = rand(0, H), h = rand(20, 70);
        return { t: 0, life: 0.3, draw() { if (!cv) return; const off = rand(-40, 40); ctx.drawImage(cv, 0, y * dpr(), cv.width, h * dpr(), off, y, W, h); ctx.fillStyle = "rgba(255,43,214,.15)"; ctx.fillRect(0, y, W, h); } };
    }
    function book() {
        const dir = Math.random() < 0.5 ? 1 : -1, y0 = rand(0.1, 0.7) * H, c = pick(["#7a2e3a", "#2e4a7a", "#3f6b3a", "#6b4a2e", "#4a2e6b"]);
        return { x: dir > 0 ? -50 : W + 50, t: 0, life: 9,
            step(dt) { this.x += dir * 240 * (1 + level * 0.15) * dt; if (this.t > 1 && (this.x < -80 || this.x > W + 80)) this.dead = true; },
            draw() { const y = y0 + Math.sin(this.t * 3) * 40, f = Math.abs(Math.sin(this.t * 9)) * 0.9 + 0.1;
                ctx.save(); ctx.translate(this.x, y); ctx.scale(dir, 1);
                poly([[0, 0], [-30 * f, -14], [-30 * f, 12], [0, 22]], c, "#2b2233"); poly([[0, 0], [30 * f, -14], [30 * f, 12], [0, 22]], c, "#2b2233");
                poly([[0, 2], [-26 * f, -10], [-26 * f, 10], [0, 19]], "#f6ecd2"); poly([[0, 2], [26 * f, -10], [26 * f, 10], [0, 19]], "#efe2c2"); ctx.restore(); } };
    }
    function ghost() {
        const x0 = rand(0.05, 0.95) * W;
        return { t: 0, life: 4, draw() { const k = this.t / this.life, x = x0 + Math.sin(this.t * 2) * 60, y = H * (1 - k) - 40;
            ctx.globalAlpha = Math.sin(k * Math.PI) * 0.75; glow("#bff3e4", 26);
            ctx.fillStyle = "#e9fff8"; ctx.beginPath(); ctx.arc(x, y, 30, Math.PI, 0); for (let i = 0; i <= 4; i++) ctx.lineTo(x + 30 - i * 15, y + 40 + (i % 2 ? -8 : 4) + Math.sin(this.t * 8 + i) * 3); ctx.fill(); noGlow();
            circle(x - 10, y - 2, 4, "#2b2233"); circle(x + 10, y - 2, 4, "#2b2233"); ctx.beginPath(); ctx.ellipse(x, y + 14, 5, 8, 0, 0, TAU); ctx.fillStyle = "#2b2233"; ctx.fill(); ctx.globalAlpha = 1; } };
    }
    function candle() {
        const x = rand(0.05, 0.95) * W, y0 = rand(0.3, 0.9) * H;
        return { t: 0, life: 5, draw() { const k = this.t / this.life, y = y0 - k * 120;
            ctx.globalAlpha = Math.sin(k * Math.PI); ctx.fillStyle = "#f6ecd2"; ctx.fillRect(x - 6, y, 12, 34);
            glow("#ffcf3f", 24); ctx.fillStyle = "#ffcf3f"; ctx.beginPath(); ctx.ellipse(x, y - 8 + Math.sin(this.t * 20) * 1.5, 5, 10, 0, 0, TAU); ctx.fill(); noGlow(); ctx.globalAlpha = 1; } };
    }
    function page() {
        return { x: rand(-W * 0.2, 0), y: rand(0, H), vx: rand(300, 600), vy: rand(-60, 60), rot: rand(0, 6), vr: rand(-6, 6), t: 0, life: 5,
            step(dt) { this.x += this.vx * dt; this.y += this.vy * dt + Math.sin(this.t * 5) * 2; this.rot += this.vr * dt; if (this.x > W + 60) this.dead = true; },
            draw() { ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rot); ctx.scale(1, Math.cos(this.t * 6)); ctx.fillStyle = "#f6ecd2"; ctx.fillRect(-14, -18, 28, 36);
                ctx.fillStyle = "rgba(43,34,51,.35)"; for (let i = 0; i < 5; i++) ctx.fillRect(-10, -12 + i * 6, 20, 1.5); ctx.restore(); } };
    }
    function spark(x, y) {
        const a = -Math.PI / 2 + rand(-0.6, 0.6), v = rand(250, 600);
        return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rand(0.6, 1.2),
            step(dt) { this.vy += 900 * dt; this.x += this.vx * dt; this.y += this.vy * dt; },
            draw() { ctx.strokeStyle = pick(["#ffe066", "#ffb21e", "#fff"]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x - this.vx * 0.02, this.y - this.vy * 0.02); ctx.stroke(); } };
    }
    function gear() {
        const r = rand(20, 50), teeth = 10;
        return { x: rand(0, W), y: -60, vx: rand(-120, 120), vy: rand(80, 200), rot: 0, vr: rand(-5, 5), t: 0, life: 6,
            step(dt) { this.vy += 300 * dt; this.x += this.vx * dt; this.y += this.vy * dt; this.rot += this.vr * dt; if (this.y > H + 80) this.dead = true; },
            draw() { ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rot); ctx.fillStyle = "#8a95a3";
                ctx.beginPath(); for (let i = 0; i < teeth * 2; i++) { const a = i / (teeth * 2) * TAU, rr = i % 2 ? r : r * 1.22; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill();
                ctx.strokeStyle = "#5a6470"; ctx.lineWidth = 2; ctx.stroke(); circle(0, 0, r * 0.35, "#3f4855"); ctx.restore(); } };
    }
    function arc() {
        const x1 = rand(0, W), y1 = rand(0, H), x2 = x1 + rand(-300, 300), y2 = y1 + rand(-200, 200), segs = bolt(x1, y1, x2, y2, 30, 1);
        add({ t: 0, life: 0.35, draw() { drawBolt(segs, "#7ae0ff", 1 - this.t / this.life); } });
        circle(x1, y1, 8, "#bff3ff"); circle(x2, y2, 8, "#bff3ff");
    }

    const dpr = () => Math.min(2, devicePixelRatio || 1);
    function frame(now) {
        if (!cv || !cv.isConnected || !document.documentElement.classList.contains("in-boss")) { stop(); return; }
        raf = requestAnimationFrame(frame);
        const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));      // a frame can be stamped just before "last": never step back
        last = now;
        if (document.hidden) return;
        const d = dpr(), w = innerWidth, h = innerHeight;
        if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
        W = w; H = h;
        // spawn each set piece on its own clock: wilder every phase (level 1 = phase 2)
        const lite = U.motion() === "lite", rate = (0.7 + 0.45 * level) * (lite ? 0.5 : 1);
        for (const c of clocks) {
            c.acc += dt * rate;
            if (c.acc >= c.every) { c.acc -= c.every * rand(0.7, 1.3); try { c.fn(); } catch (err) { console.error("chaos", err); } }
        }
        ctx.setTransform(d, 0, 0, d, 0, 0);
        ctx.clearRect(0, 0, w, h);
        if (shake > 0.2) { ctx.translate(rand(-shake, shake), rand(-shake, shake)); shake *= 0.9; }
        for (const a of actors) { a.t += dt; if (a.step) a.step(dt); if (a.t >= a.life) a.dead = true; }
        actors = actors.filter(a => !a.dead);
        for (const a of actors) { ctx.save(); try { a.draw(); } catch (err) { a.dead = true; } ctx.restore(); }
        if (flash > 0.01) { ctx.setTransform(d, 0, 0, d, 0, 0); ctx.globalAlpha = flash; ctx.fillStyle = flashColor; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; flash *= 0.86; }
    }
    function start(canvas, w, lvl) {
        stop();
        if (!canvas || U.motion() === "still" || !WORLDS[w]) return;
        cv = canvas; ctx = cv.getContext("2d"); world = w; level = Math.max(1, lvl);
        clocks = WORLDS[w].map(([fn, every]) => ({ fn, every, acc: every * Math.random() }));
        actors = []; flash = 0; shake = 0;
        last = performance.now();
        raf = requestAnimationFrame(frame);
    }
    function stop() {
        cancelAnimationFrame(raf);
        raf = 0;
        actors = [];
        if (ctx && cv) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); }
        cv = null;
    }
    return { start, stop, get level() { return level; }, worlds: Object.keys(WORLDS) };
})();
