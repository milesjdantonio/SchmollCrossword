// The secret worlds' own big effects: the Great Hollow, Atlantis, the Sunken Dunes and the Lava Cave. Every boss move
// and ability is staged like the rest (spells-abilities.js, spells-moves.js): a source, something that travels, the
// hit aimed at the real squares, the letters reacting, physical particles. Drawn with the shared kit (Spells.kit).
(() => {
    const K = Spells.kit;
    const { add, wait, rect, mid, rnd, splat, vine, vortex, letterGhosts, leave, TAU, pick, $, lerp, ease,
        portrait, bossBoard, myBoard, pts, cellsOf, sim, spray, ring, lob, flash, drawAcorn } = K;
    const D = Spells.define;
    const F = () => Campaign.fight || {};
    const from = c => (portrait() ? mid(portrait()) : c.from);
    const board = () => rect(myBoard());
    const boardMid = () => mid(myBoard());
    const still = () => K.still();
    const hold = s => new Promise(res => setTimeout(res, still() ? 0 : s * 1000));
    const size = () => (Game.state.puzzle ? Game.state.puzzle.size : 5);
    const cellAt = (r, c) => Game.cellEl(r, c);
    const idEls = keys => [...(keys || [])].map(k => { const [r, c] = String(k).split(",").map(Number); return cellAt(r, c); }).filter(Boolean);
    const word = () => cellsOf("#board .cell.in-word");
    const bossCells = () => cellsOf(".bp-cell");
    const bossCell = (r, c) => { const all = bossCells(), n = Math.round(Math.sqrt(all.length)); return all[r * n + c]; };
    const spots = (c, fallback) => { const p = pts(c); return p.length ? p : fallback(); };

    // ---- drawn props ----
    function drawPinecone(ctx, x, y, s, rot) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.strokeStyle = "#3a2410"; ctx.lineWidth = 1.5;
        for (let i = 0; i < 5; i++) for (let j = -i; j <= i; j += 2) {
            const yy = -s + i * s * 0.42, xx = j * s * 0.2;
            ctx.fillStyle = i % 2 ? "#8a5a2b" : "#a8713a";
            ctx.beginPath(); ctx.ellipse(xx, yy, s * 0.24, s * 0.2, 0, 0, TAU); ctx.fill(); ctx.stroke();
        }
        ctx.fillStyle = "#5c8f3a"; ctx.fillRect(-1.5, -s * 1.35, 3, s * 0.3);
        ctx.restore();
    }
    function drawTrident(ctx, x, y, s, rot) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
        const g = ctx.createLinearGradient(-s * 0.3, 0, s * 0.3, 0); g.addColorStop(0, "#c79a2e"); g.addColorStop(0.5, "#ffe9a3"); g.addColorStop(1, "#a87a1c");
        ctx.fillStyle = g; ctx.strokeStyle = "#5a3e0c"; ctx.lineWidth = 1.5;
        ctx.fillRect(-2.5, -s * 0.2, 5, s * 1.8); ctx.strokeRect(-2.5, -s * 0.2, 5, s * 1.8);
        ctx.beginPath(); ctx.moveTo(-s * 0.42, -s * 0.2); ctx.lineTo(s * 0.42, -s * 0.2); ctx.lineTo(s * 0.42, -s * 0.32); ctx.lineTo(-s * 0.42, -s * 0.32); ctx.closePath(); ctx.fill(); ctx.stroke();
        for (const px of [-s * 0.38, 0, s * 0.38]) {
            ctx.beginPath(); ctx.moveTo(px - 3, -s * 0.3); ctx.lineTo(px, -s * (px ? 0.82 : 1)); ctx.lineTo(px + 3, -s * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        ctx.restore();
    }
    function drawShell(ctx, x, y, s, rot) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.strokeStyle = "#6b4a3a"; ctx.lineWidth = 1.4;
        ctx.fillStyle = "#e9d6c0"; ctx.beginPath(); ctx.moveTo(-s, s * 0.4); ctx.lineTo(0, -s * 0.9); ctx.lineTo(s, s * 0.4); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#fff4e6"; ctx.beginPath(); ctx.ellipse(0, -s * 0.7, s * 0.22, s * 0.18, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = "rgba(107,74,58,.55)";
        for (const k of [-0.6, -0.2, 0.2, 0.6]) { ctx.beginPath(); ctx.moveTo(0, -s * 0.6); ctx.lineTo(k * s, s * 0.38); ctx.stroke(); }
        ctx.restore();
    }
    function drawOyster(ctx, x, y, s, open) {
        ctx.save(); ctx.translate(x, y); ctx.strokeStyle = "#3e3550"; ctx.lineWidth = 2;
        ctx.fillStyle = "#8f86a8"; ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.45, 0, 0, Math.PI); ctx.fill(); ctx.stroke();
        ctx.save(); ctx.rotate(-open * 0.9); ctx.fillStyle = "#a69dc0"; ctx.beginPath(); ctx.ellipse(s * 0.02, 0, s, s * 0.45, 0, Math.PI, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
        if (open > 0.2) { ctx.fillStyle = "#f4c7d6"; ctx.beginPath(); ctx.ellipse(0, 2, s * 0.8, s * 0.25, 0, 0, Math.PI); ctx.fill(); }
        ctx.restore();
    }
    function drawHourglass(ctx, x, y, s, k) {
        ctx.save(); ctx.translate(x, y); ctx.strokeStyle = "#5a3e1c"; ctx.lineWidth = 2;
        ctx.fillStyle = "#8a5a2b"; ctx.fillRect(-s * 0.7, -s * 1.1, s * 1.4, s * 0.18); ctx.fillRect(-s * 0.7, s * 0.92, s * 1.4, s * 0.18);
        ctx.fillStyle = "rgba(220,240,255,.35)";
        ctx.beginPath(); ctx.moveTo(-s * 0.55, -s * 0.92); ctx.lineTo(s * 0.55, -s * 0.92); ctx.lineTo(s * 0.06, 0); ctx.lineTo(s * 0.55, s * 0.92); ctx.lineTo(-s * 0.55, s * 0.92); ctx.lineTo(-s * 0.06, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#f2c66b";
        const top = (1 - k) * 0.8, bot = k * 0.8;
        ctx.beginPath(); ctx.moveTo(-s * 0.5 * top, -s * 0.05 - s * 0.85 * top); ctx.lineTo(s * 0.5 * top, -s * 0.05 - s * 0.85 * top); ctx.lineTo(0, -s * 0.03); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-s * 0.5, s * 0.9); ctx.lineTo(s * 0.5, s * 0.9); ctx.lineTo(0, s * 0.9 - s * 0.8 * bot); ctx.closePath(); ctx.fill();
        if (k < 0.98) ctx.fillRect(-1, 0, 2, s * 0.9 - s * 0.8 * bot);
        ctx.restore();
    }
    function drawTumbleweed(ctx, x, y, s, rot) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.strokeStyle = "#a07a3c"; ctx.lineWidth = 1.6;
        for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(0, 0, s, s * (0.3 + (i % 3) * 0.25), i * 0.7, 0, TAU); ctx.stroke(); }
        ctx.strokeStyle = "#7a5a26"; ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.stroke();
        ctx.restore();
    }
    function drawRock(ctx, x, y, s, rot, hot = 1) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
        ctx.fillStyle = "#3a2a26"; ctx.strokeStyle = "#1a1210"; ctx.lineWidth = 1.5;
        ctx.beginPath(); for (let i = 0; i < 7; i++) { const a = i / 7 * TAU, r = s * (0.75 + (i * 37 % 10) / 30); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = `rgba(255,120,30,${0.8 * hot})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-s * 0.4, -s * 0.2); ctx.lineTo(0, s * 0.1); ctx.lineTo(s * 0.35, -s * 0.15); ctx.moveTo(0, s * 0.1); ctx.lineTo(s * 0.05, s * 0.5); ctx.stroke();
        ctx.restore();
        K.haloAt(ctx, x, y, s * 2.2, "#ff6a1f", 0.5 * hot);
    }
    function drawEyes(ctx, x, y, s, open) {
        for (const side of [-1, 1]) {
            ctx.save(); ctx.translate(x + side * s * 0.9, y); ctx.scale(1, Math.max(0.05, open));
            ctx.fillStyle = "#fff8e0"; ctx.strokeStyle = "#3a2410"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(0, 0, s * 0.6, s * 0.45, 0, 0, TAU); ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#2b1a0e"; ctx.beginPath(); ctx.arc(side * s * 0.08, s * 0.05, s * 0.26, 0, TAU); ctx.fill();
            ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(side * s * 0.08 - s * 0.08, -s * 0.05, s * 0.08, 0, TAU); ctx.fill();
            ctx.restore();
        }
    }
    // a sandy, lumpy mound line (a worm burrowing just under the surface)
    function mound(ctx, path, color, k) {
        if (path.length < 2) return;
        ctx.strokeStyle = color; ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.lineWidth = 16; ctx.globalAlpha = 0.75 * (1 - k * 0.5);
        ctx.beginPath(); path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
        ctx.lineWidth = 5; ctx.strokeStyle = "rgba(255,240,200,.6)";
        ctx.beginPath(); path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y - 4) : ctx.moveTo(x, y - 4))); ctx.stroke();
        ctx.globalAlpha = 1;
    }
    const SAND = ["#e0b872", "#c9974f", "#f2d39a", "#a87a3c"];
    const LAVA = ["#ff6a1f", "#ffb02e", "#ffe08a", "#d93a12"];
    const SEA = ["#bfe8ff", "#7fd4ff", "#ffffff", "#4fb3e0"];
    const WOOD = ["#8a5a2b", "#c8681c", "#e3a35a", "#5c8f3a"];

    // =========================================================================================
    // The Great Hollow: the Giant Squirrel
    // =========================================================================================
    // Acorn Roll: a giant acorn rolls along each row it clears, flattening the letters, leaves kicked up behind it
    D("m-acornroll", async c => {
        const f = F(), rows = f.raysHit || [], b = board(), n = size();
        const ghosts = letterGhosts(c.cells), h = b.height / n;
        for (const [i, r] of rows.entries()) {
            const y = b.top + h * (r + 0.5), s = h * 0.42, dir = i % 2 ? -1 : 1;
            add({ life: 0.75, draw(ctx, k) {
                const q = ease(k), x = dir > 0 ? lerp(b.left - 60, b.right + 60, q) : lerp(b.right + 60, b.left - 60, q);
                ctx.globalAlpha = 0.25 * (1 - k); ctx.fillStyle = "#3a2410"; ctx.beginPath(); ctx.ellipse(x, y + s * 0.95, s * 0.9, s * 0.2, 0, 0, TAU); ctx.fill();
                ctx.globalAlpha = 1; drawAcorn(ctx, x, y, s, q * dir * 14);
                if (Math.random() < 0.5) spray({ x: x - dir * s, y: y + s * 0.6 }, 2, { color: ["#c8681c", "#e3a35a", "#8a5a2b", "#d9b04a"], shape: "leaf", angle: dir > 0 ? Math.PI * 1.2 : -Math.PI * 0.2, spread: 0.6, speed: [80, 220], size: [4, 7], g: 260, life: [0.6, 1] });
            } });
            setTimeout(() => leave(ghosts.filter(gh => Math.abs(gh.r.top + gh.r.height / 2 - y) < h / 2), "blow", { stagger: 30 }), still() ? 0 : 200);
            await hold(0.32);
        }
        await hold(0.6);
    });
    // Thieving Squirrels: a gust of leaves and acorn shells sweeps out of the boss toward your board, the thieves inside it
    D("m-thieves", async c => {
        const a = from(c), b = boardMid();
        spray(a, 40, { color: WOOD, shape: "leaf", angle: Math.atan2(b.y - a.y, b.x - a.x), spread: 0.5, speed: [200, 480], size: [4, 8], g: 80, drag: 0.8, life: [0.9, 1.4], wob: [5, 120] });
        for (let i = 0; i < 5; i++) setTimeout(() => lob(a, { x: b.x + rnd(-120, 120), y: b.y + rnd(-90, 90) }, { life: 0.55, height: 120, drawFn: (ctx, x, y, k) => drawAcorn(ctx, x, y, 9, k * 8) }), still() ? 0 : i * 90);
        await hold(0.9);
    });
    // Pinecone Barrage: pinecones lobbed into four words; each one thumps in and throws needles
    D("m-pinecones", async c => {
        const ghosts = letterGhosts(c.cells), ps = spots(c, () => idEls(F().prickly).map(mid)), a = from(c);
        ps.forEach((p, i) => setTimeout(async () => {
            await lob(a, p, { life: 0.55, height: 170, drawFn: (ctx, x, y, k) => drawPinecone(ctx, x, y, 13, k * 9) });
            ring(p, { color: "#7a5a26", r: 46, width: 6, life: 0.45 });
            spray(p, 16, { color: ["#2f6b2a", "#5c8f3a", "#8a5a2b"], shape: "streak", speed: [140, 340], size: [2, 3.5], g: 400, life: [0.35, 0.7] });
            if (ghosts[i]) leave([ghosts[i]], "pop");
        }, still() ? 0 : i * 140));
        await hold(1.2);
    });
    // Hoard Count: an abacus of acorns: one flies from each unfinished word to the boss's board, counted aloud
    D("m-hoardcount", async c => {
        const g = Game.state, all = g.puzzle ? [...g.puzzle.across, ...g.puzzle.down] : [];
        const words = all.filter(e => Game.cellsOf(e).some(([r, cc]) => g.letters[r][cc] !== g.puzzle.solution[r][cc])).slice(0, 6).map(e => { const [r, cc] = Game.cellsOf(e)[0]; return cellAt(r, cc); }).filter(Boolean), to = bossBoard() ? mid(bossBoard()) : from(c);
        words.forEach((el, i) => setTimeout(async () => {
            const p = mid(el);
            spray(p, 1, { color: "#ffe08a", shape: "text", text: [String(i + 1)], speed: [30, 60], angle: -Math.PI / 2, spread: 0.2, size: [22, 22], g: -40, life: [0.8, 0.8] });
            await lob(p, to, { life: 0.6, height: 140, drawFn: (ctx, x, y, k) => drawAcorn(ctx, x, y, 8, k * 10), trail: "#ffcf6b" });
            spray(to, 8, { color: ["#ffcf6b", "#fff"], shape: "star", speed: [60, 180], size: [2, 4], g: 0, life: [0.3, 0.6], add: true });
        }, still() ? 0 : i * 160));
        await hold(1.6);
    });
    // Squirrel Sentry: two big eyes open over your board and a beam of attention sweeps across it
    D("m-sentry", async c => {
        const b = board(), x = b.left + b.width / 2, y = b.top - 34, s = 22;
        add({ life: 2, draw(ctx, k) {
            const open = k < 0.15 ? k / 0.15 : k > 0.85 ? (1 - k) / 0.15 : (Math.abs(k - 0.5) < 0.03 ? 0.1 : 1);
            const sweep = Math.sin(k * Math.PI * 2) * 0.7, tx = x + Math.sin(sweep) * b.width * 0.6, ty = b.bottom;
            ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.18 * open;
            ctx.fillStyle = "#ffe9a3"; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx - b.width * 0.18, ty); ctx.lineTo(tx + b.width * 0.18, ty); ctx.closePath(); ctx.fill();
            ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
            drawEyes(ctx, x, y, s, open);
        } });
        await hold(2);
    });
    // Root Bind: roots burst out of the board's edges and wrap around your word
    D("m-rootbind", async c => {
        const b = board(), cells = word().map(mid), edges = [{ x: b.left - 10, y: b.bottom + 10 }, { x: b.right + 10, y: b.bottom + 10 }, { x: b.left - 10, y: b.top - 10 }, { x: b.right + 10, y: b.top - 10 }];
        (cells.length ? cells : [boardMid()]).forEach((p, i) => setTimeout(() => {
            vine(edges[i % edges.length], p, { color: "#5a3a1c", leaf: "#6b8f3a", life: 2.2 });
            spray(p, 8, { color: ["#5a3a1c", "#8a5a2b"], shape: "crumb", speed: [60, 160], size: [2, 3], g: 500, life: [0.4, 0.8] });
        }, still() ? 0 : i * 110));
        await hold(1.6);
    });

    // =========================================================================================
    // Atlantis: the Kraken King
    // =========================================================================================
    // The Trident: it flies down into your letters; each one is carried off in a column of bubbles to its board
    D("m-trident", async c => {
        const ghosts = letterGhosts(c.cells), ps = pts(c), to = bossBoard() ? mid(bossBoard()) : from(c), s = 30;
        for (const [i, p] of ps.entries()) {
            add({ life: 0.35, draw(ctx, k) { drawTrident(ctx, p.x, lerp(p.y - 260, p.y - s * 0.2, ease(k)), s, 0); } });
            setTimeout(() => {
                ring(p, { color: "#ffe9a3", r: 42, width: 5, life: 0.4 });
                spray(p, 12, { color: SEA, shape: "bubble", speed: [40, 140], angle: -Math.PI / 2, spread: 0.8, size: [3, 7], g: -220, life: [0.6, 1.1] });
                if (ghosts[i]) leave([ghosts[i]], "suck", { to, color: "#7fd4ff" });
            }, still() ? 0 : 340);
            await hold(0.12);
        }
        await hold(1.1);
    });
    // Barnacles: shells clatter onto your letters and crust over them
    D("m-barnacles", async c => {
        const els = idEls(F().barn && F().barn.keys()), a = from(c);
        els.forEach((el, i) => setTimeout(async () => {
            const p = mid(el);
            await lob(a, p, { life: 0.5, height: 120, drawFn: (ctx, x, y, k) => drawShell(ctx, x, y, 10, k * 12) });
            ring(p, { color: "#e9d6c0", r: 34, width: 4, life: 0.35 });
            spray(p, 10, { color: ["#e9d6c0", "#b8a48c", "#fff4e6"], shape: "crumb", speed: [60, 180], size: [2, 3.5], g: 500, life: [0.3, 0.6] });
        }, still() ? 0 : i * 120));
        await hold(1.1);
    });
    // Deep Pressure: the weight of the sea: the light dims, rings squeeze in on the board, bubbles flatten
    D("m-pressure", async c => {
        const b = board(), p = boardMid();
        add({ life: 1.8, draw(ctx, k) { ctx.globalAlpha = 0.4 * Math.sin(k * Math.PI); ctx.fillStyle = "#08243f"; ctx.fillRect(b.left - 20, b.top - 20, b.width + 40, b.height + 40); } });
        for (let i = 0; i < 4; i++) setTimeout(() => add({ life: 0.7, draw(ctx, k) {
            ctx.globalAlpha = k; ctx.strokeStyle = "#7fd4ff"; ctx.lineWidth = 4; ctx.strokeRect(p.x - b.width * (1.2 - ease(k) * 0.7) / 2, p.y - b.height * (1.2 - ease(k) * 0.7) / 2, b.width * (1.2 - ease(k) * 0.7), b.height * (1.2 - ease(k) * 0.7));
        } }), still() ? 0 : i * 300);
        spray({ x: p.x, y: b.bottom }, 24, { color: SEA, shape: "bubble", angle: -Math.PI / 2, spread: 0.5, speed: [40, 110], size: [3, 8], g: -60, drag: 1.5, life: [1, 1.6], jitter: b.width / 2 });
        await hold(1.6);
    });
    // Backwash: a wave runs back along your word, and the letters wash out in the wrong order
    D("m-backwash", async c => {
        const ghosts = letterGhosts(c.cells), cells = word().map(rect);
        if (cells.length) {
            const l = Math.min(...cells.map(r => r.left)), r = Math.max(...cells.map(r => r.right)), t = Math.min(...cells.map(r => r.top)), bt = Math.max(...cells.map(r => r.bottom));
            add({ life: 0.9, draw(ctx, k) {
                const x = lerp(r + 40, l - 40, ease(k));
                const g = ctx.createLinearGradient(x - 60, 0, x + 30, 0); g.addColorStop(0, "rgba(79,179,224,0)"); g.addColorStop(0.7, "rgba(127,212,255,.75)"); g.addColorStop(1, "rgba(255,255,255,.95)");
                ctx.fillStyle = g; ctx.fillRect(x - 60, t - 10, 90, bt - t + 20);
                if (Math.random() < 0.7) spray({ x, y: rnd(t, bt) }, 2, { color: SEA, shape: "drop", angle: Math.PI, spread: 0.8, speed: [80, 220], size: [2, 3.5], g: 500, life: [0.3, 0.6] });
            } });
        }
        await hold(0.4);
        await leave(ghosts, "wash", { stagger: 50 });
    });
    // Echo of the Deep: sonar rings pulse out of the boss and across your board
    D("m-deepecho", async c => {
        const a = from(c), b = boardMid();
        for (let i = 0; i < 4; i++) setTimeout(() => {
            ring(a, { color: "#4fb3e0", r: Math.hypot(b.x - a.x, b.y - a.y) + 200, width: 6, life: 1.2 });
            ring(b, { color: "#bfe8ff", r: 160, width: 3, life: 0.8 });
        }, still() ? 0 : i * 260);
        await hold(1.6);
    });
    // Pearl Hoard: an oyster opens beside your board; your rarest letters turn to pearls and roll into the boss's treasury
    D("m-pearlhoard", async c => {
        const ghosts = letterGhosts(c.cells), b = board(), o = { x: b.left - 50, y: b.bottom - 20 }, to = from(c);
        add({ life: 2, draw(ctx, k) { ctx.globalAlpha = k > 0.85 ? (1 - k) / 0.15 : 1; drawOyster(ctx, o.x, o.y, 34, Math.min(1, k * 3)); } });
        await hold(0.4);
        pts(c).forEach((p, i) => setTimeout(() => {
            lob(p, to, { life: 0.8, height: 160, trail: "#f4fbff", drawFn: (ctx, x, y) => { K.haloAt(ctx, x, y, 16, "#ffffff", 0.8); ctx.fillStyle = "#f8f4ff"; ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill(); } });
        }, still() ? 0 : i * 150));
        await leave(ghosts, "pop", { stagger: 150 });
        await hold(0.8);
    });

    // =========================================================================================
    // The Sunken Dunes: the Great Sandworm
    // =========================================================================================
    // Sand Tornado: a funnel of sand crosses your board, and the letters it passes spin round and land out of order
    D("m-tornado", async c => {
        const b = board(), ps = pts(c), y0 = ps.length ? ps.reduce((s, p) => s + p.y, 0) / ps.length : b.top + b.height / 2;
        add({ life: 1.5, draw(ctx, k, t) {
            const x = lerp(b.left - 40, b.right + 40, ease(k)), top = y0 - b.height * 0.55;
            for (let i = 0; i < 14; i++) {
                const q = i / 13, y = lerp(top, y0 + 30, q), w = lerp(60, 10, q), a = t * 14 + i * 0.8;
                ctx.globalAlpha = 0.5 * (1 - Math.abs(k - 0.5)); ctx.strokeStyle = pick(SAND); ctx.lineWidth = 3;
                ctx.beginPath(); ctx.ellipse(x + Math.sin(a) * 6, y, w, w * 0.22, 0, 0, TAU); ctx.stroke();
            }
            ctx.globalAlpha = 1;
            if (Math.random() < 0.8) spray({ x, y: y0 }, 3, { color: SAND, shape: "crumb", speed: [120, 300], size: [1.5, 3], g: 200, life: [0.4, 0.8] });
        } });
        ps.forEach((p, i) => setTimeout(() => spray(p, 8, { color: SAND, shape: "dot", speed: [40, 120], size: [1.5, 3], g: 0, life: [0.4, 0.7] }), still() ? 0 : 200 + i * 60));
        await hold(1.5);
    });
    // Sand Dive: sand pours over your board and the worm arcs through it, swallowing letters
    D("m-sanddive", async c => {
        const ghosts = letterGhosts(c.cells), b = board();
        spray({ x: b.left + b.width / 2, y: b.top - 30 }, 80, { color: SAND, shape: "dot", angle: Math.PI / 2, spread: 0.4, speed: [100, 260], size: [1.5, 3.5], g: 600, life: [0.6, 1.1], jitter: b.width / 2 });
        await hold(0.5);
        const ps = pts(c).sort((p, q) => p.x - q.x);
        const path = [];
        add({ life: 1.2, draw(ctx, k) {
            const x = lerp(b.left - 30, b.right + 30, k), y = b.top + b.height / 2 + Math.sin(k * Math.PI * 3) * b.height * 0.3;
            path.push([x, y]); if (path.length > 30) path.shift();
            mound(ctx, path, "#b8894a", k);
        } });
        ps.forEach((p, i) => setTimeout(() => { spray(p, 10, { color: SAND, shape: "crumb", angle: -Math.PI / 2, spread: 0.7, speed: [120, 260], size: [2, 3.5], g: 700, life: [0.4, 0.7] }); if (ghosts[i]) leave([ghosts[i]], "blow"); }, still() ? 0 : 150 + i * 220));
        await hold(1.3);
    });
    // Sand Ball: nobody broke it, so it rolls off to the boss's board and bursts into five letters there
    D("m-sandball", async c => {
        const a = boardMid(), to = bossBoard() ? mid(bossBoard()) : from(c);
        await lob(a, to, { life: 0.8, height: 120, drawFn: (ctx, x, y, k) => {
            const g = ctx.createRadialGradient(x - 6, y - 6, 2, x, y, 22); g.addColorStop(0, "#f2d39a"); g.addColorStop(1, "#a87a3c");
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 20, 0, TAU); ctx.fill();
            ctx.strokeStyle = "rgba(90,60,20,.5)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 14, k * 20, k * 20 + 2); ctx.stroke();
        } });
        ring(to, { color: "#e0b872", r: 90, width: 8 });
        spray(to, 40, { color: SAND, shape: "crumb", speed: [120, 320], size: [2, 4], g: 500, life: [0.5, 0.9] });
        await hold(0.6);
    });
    // Sinkhole: the sand at one square starts to turn and fall away, cracks running out from it
    D("m-sinkhole", async c => {
        const key = F().sinkCenter, el = key ? idEls([key])[0] : null, p = el ? mid(el) : boardMid();
        vortex(p, { color: "#a87a3c", r: 70, life: 1.6, arms: 4 });
        add({ life: 1.6, draw(ctx, k) {
            ctx.strokeStyle = "#5a3e1c"; ctx.lineWidth = 2; ctx.globalAlpha = 1 - k * 0.6;
            for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.3, r = 70 * ease(Math.min(1, k * 2)); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(a) * r * 0.5 + 6, p.y + Math.sin(a) * r * 0.5); ctx.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r); ctx.stroke(); }
        } });
        spray(p, 30, { color: SAND, shape: "dot", speed: [60, 140], size: [1.5, 3], g: 0, drag: 2, life: [0.6, 1.2], jitter: 40 });
        await hold(1.6);
    });
    // Worm Sign: a ridge of sand rips diagonally through your board and the letters on it are thrown up
    D("m-wormsign", async c => {
        const ghosts = letterGhosts(c.cells), ps = pts(c).sort((p, q) => p.y - q.y), path = [];
        if (ps.length) {
            const a = ps[0], z = ps[ps.length - 1], dx = (z.x - a.x) / Math.max(1, ps.length), dy = (z.y - a.y) / Math.max(1, ps.length);
            add({ life: 1.1, draw(ctx, k) { const q = lerp(-1, ps.length, k); path.push([a.x + dx * q + Math.sin(k * 30) * 4, a.y + dy * q]); mound(ctx, path, "#c9974f", k); } });
        }
        ps.forEach((p, i) => setTimeout(() => { spray(p, 12, { color: SAND, shape: "crumb", angle: -Math.PI / 2, spread: 0.6, speed: [160, 320], size: [2, 4], g: 800, life: [0.4, 0.8] }); if (ghosts[i]) leave([ghosts[i]], "pop"); }, still() ? 0 : i * 1100 / Math.max(1, ps.length)));
        await hold(1.4);
    });
    // Sand Pillar: a pillar of sand rises under a column, grains streaming off it
    D("m-pillar", async c => {
        const col = F().pillarCol ?? 0, top = cellAt(0, col), b = board(), r = top ? rect(top) : b, x = r.left, w = r.width;
        add({ life: 2, draw(ctx, k) {
            const h = b.height * ease(Math.min(1, k * 2.5)), y = b.bottom - h;
            ctx.globalAlpha = (k > 0.8 ? (1 - k) / 0.2 : 1) * 0.55;
            const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, "#a87a3c"); g.addColorStop(0.5, "#f2d39a"); g.addColorStop(1, "#a87a3c");
            ctx.fillStyle = g; ctx.fillRect(x + 3, y, w - 6, h);
            ctx.globalAlpha = 1;
            if (Math.random() < 0.6) spray({ x: x + rnd(0, w), y }, 2, { color: SAND, shape: "dot", speed: [20, 80], size: [1.5, 2.5], g: 400, life: [0.4, 0.8] });
        } });
        await hold(2);
    });

    // =========================================================================================
    // The Lava Cave: the Lava Beast
    // =========================================================================================
    // Lava Columns: lava pours from the top of the board down two columns, glowing and dripping
    D("m-lavacols", async c => {
        const b = board(), cols = [...(F().lava || [])];
        for (const col of cols) {
            const el = cellAt(0, col), r = el ? rect(el) : b, x = r.left + r.width / 2, w = r.width * 0.8;
            add({ life: 1.6, draw(ctx, k, t) {
                const y = lerp(b.top - 30, b.bottom, ease(Math.min(1, k * 1.6)));
                const g = ctx.createLinearGradient(0, b.top, 0, y); g.addColorStop(0, "#ffe08a"); g.addColorStop(0.4, "#ff8a1f"); g.addColorStop(1, "#d93a12");
                ctx.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 0.85; ctx.fillStyle = g;
                ctx.beginPath(); ctx.moveTo(x - w / 2, b.top - 30);
                for (let yy = b.top - 30; yy <= y; yy += 10) ctx.lineTo(x - w / 2 + Math.sin(yy * 0.08 + t * 6) * 3, yy);
                ctx.lineTo(x, y + 14);
                for (let yy = y; yy >= b.top - 30; yy -= 10) ctx.lineTo(x + w / 2 + Math.sin(yy * 0.08 + t * 6 + 1) * 3, yy);
                ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
                K.haloAt(ctx, x, y, w, "#ff6a1f", 0.6);
                if (Math.random() < 0.5) spray({ x: x + rnd(-w / 2, w / 2), y }, 1, { color: LAVA, shape: "ember", speed: [40, 120], angle: -Math.PI / 2, spread: 0.8, size: [2, 3.5], g: -60, life: [0.5, 0.9] });
            } });
            await hold(0.25);
        }
        await hold(1.4);
    });
    // Rising Heat: the air above the board ripples and glows from the bottom up
    D("m-heatrise", async c => {
        const b = board();
        add({ life: 2.2, draw(ctx, k, t) {
            const a = Math.sin(k * Math.PI);
            const g = ctx.createLinearGradient(0, b.bottom, 0, b.top); g.addColorStop(0, `rgba(255,106,31,${0.45 * a})`); g.addColorStop(1, "rgba(255,176,46,0)");
            ctx.fillStyle = g; ctx.fillRect(b.left - 20, b.top - 20, b.width + 40, b.height + 40);
            ctx.strokeStyle = `rgba(255,224,138,${0.35 * a})`; ctx.lineWidth = 2;
            for (let i = 0; i < 6; i++) { const y = b.bottom - ((t * 120 + i * b.height / 6) % b.height); ctx.beginPath(); for (let x = b.left; x <= b.right; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.05 + t * 5 + i) * 5); ctx.stroke(); }
        } });
        spray({ x: b.left + b.width / 2, y: b.bottom }, 30, { color: LAVA, shape: "ember", angle: -Math.PI / 2, spread: 0.3, speed: [60, 160], size: [2, 3.5], g: -40, life: [0.8, 1.6], jitter: b.width / 2, delay: 1 });
        await hold(2.2);
    });
    // Pyroclast: burning rocks rain down beside the black squares and the letters there catch fire
    D("m-pyroclast", async c => {
        const ghosts = letterGhosts(c.cells), a = from(c);
        pts(c).forEach((p, i) => setTimeout(async () => {
            await lob(a, p, { life: 0.55, height: 200, drawFn: (ctx, x, y, k) => drawRock(ctx, x, y, 10, k * 10) });
            ring(p, { color: "#ff6a1f", r: 40, width: 6, life: 0.4 });
            spray(p, 14, { color: LAVA, shape: "ember", speed: [100, 280], size: [2, 4], g: 500, life: [0.4, 0.8] });
            if (ghosts[i]) leave([ghosts[i]], "burn");
        }, still() ? 0 : i * 110));
        await hold(1.4);
    });
    // Molten Letters: four right letters glow red-hot and start to drip
    D("m-molten", async c => {
        const els = cellsOf("#board .cell.molten");
        add({ life: 2.4, draw(ctx, k) {
            for (const el of els) { const r = rect(el); K.haloAt(ctx, r.left + r.width / 2, r.top + r.height / 2, r.width * 0.9, "#ff6a1f", 0.55 * Math.sin(k * Math.PI)); }
        } });
        els.forEach((el, i) => { const r = rect(el); for (let j = 0; j < 3; j++) setTimeout(() => spray({ x: r.left + rnd(r.width * 0.2, r.width * 0.8), y: r.bottom - 2 }, 1, { color: LAVA, shape: "drop", angle: Math.PI / 2, spread: 0.1, speed: [20, 50], size: [2.5, 4], g: 400, life: [0.6, 0.9] }), still() ? 0 : i * 100 + j * 600); });
        await hold(2.4);
    });
    // Sulfur Fumes: yellow smoke rolls in over the clue lists
    D("m-fumes", async c => {
        const cl = $(".clues"), r = cl ? rect(cl) : board();
        for (let i = 0; i < (K.lite() ? 14 : 28); i++) {
            const x = rnd(r.left, r.right), y = rnd(r.top, r.bottom), s = rnd(30, 70), life = rnd(1.6, 2.4), dx = rnd(-30, 30);
            add({ life, draw(ctx, k) {
                ctx.globalAlpha = 0.32 * Math.sin(k * Math.PI);
                const g = ctx.createRadialGradient(x + dx * k, y - 20 * k, 0, x + dx * k, y - 20 * k, s * (0.6 + k * 0.6));
                g.addColorStop(0, "rgba(214,206,96,.9)"); g.addColorStop(1, "rgba(160,150,70,0)");
                ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + dx * k, y - 20 * k, s * (0.6 + k * 0.6), 0, TAU); ctx.fill();
            } });
        }
        await hold(2);
    });
    // Cinders: glowing cinders drift down onto three empty squares and smoulder there
    D("m-cinder", async c => {
        const els = idEls(F().cinders);
        els.forEach((el, i) => setTimeout(() => {
            const p = mid(el), x0 = p.x + rnd(-80, 80);
            add({ life: 0.9, draw(ctx, k) { const x = lerp(x0, p.x, k) + Math.sin(k * 12) * 8, y = lerp(p.y - 220, p.y, k); K.haloAt(ctx, x, y, 14, "#ff8a2a", 0.9); ctx.fillStyle = "#fff0c0"; ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill(); } });
            setTimeout(() => { ring(p, { color: "#ff8a2a", r: 30, width: 4, life: 0.4 }); spray(p, 8, { color: LAVA, shape: "ember", angle: -Math.PI / 2, spread: 0.6, speed: [30, 90], size: [1.5, 3], g: -30, life: [0.6, 1.1] }); }, still() ? 0 : 900);
        }, still() ? 0 : i * 200));
        await hold(1.6);
    });

    // =========================================================================================
    // The abilities
    // =========================================================================================
    // Root Network: roots run out from your word along every word that crosses it; the letters they reach set like wood
    D("rootnet", async c => {
        const cur = word().map(mid), locked = cellsOf("#board .cell.locked").map(mid);
        const hub = cur.length ? cur[Math.floor(cur.length / 2)] : boardMid();
        locked.forEach((p, i) => setTimeout(() => { vine(hub, p, { color: "#6b4a2a", leaf: "#7bbf4a", life: 1.8 }); }, still() ? 0 : i * 40));
        await hold(0.8);
        locked.forEach(p => spray(p, 4, { color: ["#9fd26b", "#ffe9a3"], shape: "star", speed: [30, 90], size: [2, 3.5], g: 0, life: [0.4, 0.8], add: true }));
        await hold(0.8);
    });
    // Acorn Cache: acorns drop into the corners of your board and are buried with a puff of earth
    D("cache", async c => {
        const b = board(), corners = [[b.left, b.top], [b.right, b.top], [b.left, b.bottom], [b.right, b.bottom]];
        corners.forEach(([x, y], i) => setTimeout(async () => {
            await lob({ x: x + rnd(-120, 120), y: y - 260 }, { x, y }, { life: 0.5, height: 60, drawFn: (ctx, xx, yy, k) => drawAcorn(ctx, xx, yy, 11, k * 6) });
            spray({ x, y }, 12, { color: ["#6b4219", "#8a5a2b", "#3a2410"], shape: "crumb", angle: -Math.PI / 2, spread: 0.9, speed: [80, 200], size: [2, 4], g: 600, life: [0.4, 0.7] });
            ring({ x, y }, { color: "#ffcf6b", r: 40, width: 4, life: 0.5 });
        }, still() ? 0 : i * 120));
        await hold(1.2);
        ring(boardMid(), { color: "#c8681c", r: Math.max(b.width, b.height) * 0.75, width: 6, life: 0.8 });
        await hold(0.6);
    });
    // Hibernate: a winter lullaby: a moon rises over the boss, frosty mist drifts in, Zzz float up
    D("hibernate", async c => {
        const p = portrait() ? mid(portrait()) : mid(c.area);
        add({ life: 2.2, draw(ctx, k) {
            ctx.globalAlpha = Math.sin(k * Math.PI);
            const x = p.x + 60, y = p.y - 70 - k * 20;
            K.haloAt(ctx, x, y, 50, "#cfe6ff", 0.6);
            ctx.fillStyle = "#f4f8ff"; ctx.beginPath(); ctx.arc(x, y, 18, 0, TAU); ctx.fill();
            ctx.globalCompositeOperation = "destination-out"; ctx.beginPath(); ctx.arc(x + 8, y - 5, 15, 0, TAU); ctx.fill();
            ctx.globalCompositeOperation = "source-over";
        } });
        spray(p, 20, { color: ["#dff1ff", "#ffffff"], shape: "flake", speed: [30, 90], size: [3, 6], g: 30, drag: 1, life: [1.2, 2], jitter: 60, wob: [3, 60] });
        for (let i = 0; i < 4; i++) setTimeout(() => spray({ x: p.x + 20, y: p.y - 20 }, 1, { color: "#9fc6e8", shape: "text", text: ["Z"], angle: -Math.PI / 3, spread: 0.2, speed: [40, 60], size: [16 + i * 6, 16 + i * 6], g: -20, life: [1.2, 1.2] }), still() ? 0 : i * 350);
        await hold(2.2);
    });
    // Sapling: a seed drops into your word and a little sapling sprouts out of it, leaf by leaf
    D("sapling", async c => {
        const cells = word().map(rect), r = cells.length ? cells[Math.floor(cells.length / 2)] : board(), x = r.left + r.width / 2, y = r.top + r.height * 0.8;
        await lob({ x, y: y - 220 }, { x, y }, { life: 0.4, height: 20, drawFn: (ctx, xx, yy) => { ctx.fillStyle = "#8a5a2b"; ctx.beginPath(); ctx.ellipse(xx, yy, 4, 6, 0.4, 0, TAU); ctx.fill(); } });
        spray({ x, y }, 8, { color: ["#6b4219", "#8a5a2b"], shape: "crumb", angle: -Math.PI / 2, spread: 0.8, speed: [60, 140], size: [1.5, 3], g: 500, life: [0.3, 0.6] });
        add({ life: 2.2, draw(ctx, k) {
            const h = r.height * 1.1 * ease(Math.min(1, k * 1.8)), a = k > 0.85 ? (1 - k) / 0.15 : 1;
            ctx.globalAlpha = a; ctx.strokeStyle = "#3f8f3a"; ctx.lineWidth = 3; ctx.lineCap = "round";
            ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 6, y - h * 0.5, x, y - h); ctx.stroke();
            for (const [q, side] of [[0.45, -1], [0.7, 1], [0.95, -1]]) {
                if (h < r.height * q) continue;
                const ly = y - r.height * q, s = 9 * Math.min(1, (h - r.height * q) / 12 + 0.2);
                ctx.fillStyle = "#7be36b"; ctx.beginPath(); ctx.ellipse(x + side * s, ly, s, s * 0.45, side * -0.5, 0, TAU); ctx.fill();
            }
            ctx.globalAlpha = 1;
        } });
        await hold(2.2);
    });
    // Pearl Diver: pearls dive down through a trail of bubbles into every square that needed the letter
    D("diver", async c => {
        const ps = pts(c);
        ps.forEach((p, i) => setTimeout(() => {
            add({ life: 0.5, draw(ctx, k) { const y = lerp(p.y - 240, p.y, ease(k)); K.haloAt(ctx, p.x, y, 16, "#ffffff", 0.9); ctx.fillStyle = "#f8f4ff"; ctx.beginPath(); ctx.arc(p.x, y, 6, 0, TAU); ctx.fill(); } });
            spray({ x: p.x, y: p.y - 120 }, 6, { color: SEA, shape: "bubble", angle: -Math.PI / 2, spread: 0.4, speed: [30, 80], size: [2, 5], g: -120, life: [0.6, 1] });
            setTimeout(() => { ring(p, { color: "#bfe8ff", r: 36, width: 4, life: 0.45 }); spray(p, 8, { color: SEA, shape: "drop", angle: -Math.PI / 2, spread: 0.9, speed: [80, 180], size: [2, 3], g: 600, life: [0.3, 0.6] }); }, still() ? 0 : 500);
        }, still() ? 0 : i * 130));
        await hold(1.3);
    });
    // Tide Chart: an old sea chart unrolls over the clues, a compass rose spinning in its corner
    D("tidechart", async c => {
        const cl = $(".clues"), r = cl ? rect(cl) : board();
        add({ life: 1.6, draw(ctx, k) {
            const open = ease(Math.min(1, k * 2.5)), a = k > 0.75 ? (1 - k) / 0.25 : 1, w = r.width * open;
            ctx.globalAlpha = 0.35 * a; ctx.fillStyle = "#f3e2b8"; ctx.fillRect(r.left, r.top, w, r.height);
            ctx.globalAlpha = 0.6 * a; ctx.strokeStyle = "#a07a3c"; ctx.lineWidth = 1;
            for (let y = r.top + 20; y < r.bottom; y += 26) { ctx.beginPath(); for (let x = r.left; x < r.left + w; x += 10) ctx.lineTo(x, y + Math.sin(x * 0.06) * 4); ctx.stroke(); }
            const cx = r.right - 36, cy = r.top + 36;
            ctx.save(); ctx.translate(cx, cy); ctx.rotate(k * 6); ctx.fillStyle = "#d9a93a"; ctx.strokeStyle = "#5a3e1c"; ctx.lineWidth = 1.5;
            for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(5, 0); ctx.lineTo(-5, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); }
            ctx.restore(); ctx.globalAlpha = 1;
        } });
        await hold(1.6);
    });
    // Conch Call: a conch sounds beside your board; rings of music roll out of it
    D("conch", async c => {
        const b = board(), p = { x: b.left - 40, y: b.top + b.height / 2 };
        add({ life: 1.8, draw(ctx, k) { ctx.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1; drawShell(ctx, p.x, p.y, 22, -Math.PI / 2 + Math.sin(k * 20) * 0.05); } });
        for (let i = 0; i < 4; i++) setTimeout(() => {
            ring(p, { color: "#ffb0c0", r: b.width * 0.9, width: 5, life: 1 });
            spray(p, 3, { color: ["#ffb0c0", "#fff", "#7fd4ff"], shape: "text", text: ["♪", "♫"], angle: 0, spread: 0.6, speed: [80, 160], size: [16, 22], g: -30, life: [1, 1.4] });
        }, still() ? 0 : i * 300);
        await hold(1.8);
    });
    // Kelp Forest: kelp shoots up out of the squares the boss is about to write, swaying
    D("kelp", async c => {
        const kelp = F().boss && F().boss.kelp, els = kelp ? [...kelp].map(k => { const [r, cc] = k.split(",").map(Number); return bossCell(r, cc); }).filter(Boolean) : [];
        els.forEach((el, i) => setTimeout(() => {
            const r = rect(el), base = { x: r.left + r.width / 2, y: r.bottom + 20 };
            vine(base, { x: base.x + rnd(-6, 6), y: r.top - 6 }, { color: "#1f7a52", leaf: "#4fc38a", life: 2.4 });
            spray(base, 5, { color: SEA, shape: "bubble", angle: -Math.PI / 2, spread: 0.4, speed: [20, 60], size: [2, 4], g: -80, life: [0.6, 1.1] });
        }, still() ? 0 : i * 120));
        await hold(1.6);
    });
    // Sand Clock: an hourglass appears over the boss and the sand starts to run slow and gold
    D("sandclock", async c => {
        const p = portrait() ? mid(portrait()) : mid(c.area), at = { x: p.x, y: p.y - 80 };
        add({ life: 2.4, draw(ctx, k) {
            ctx.globalAlpha = k < 0.1 ? k / 0.1 : k > 0.85 ? (1 - k) / 0.15 : 1;
            K.haloAt(ctx, at.x, at.y, 60, "#f6d48f", 0.5);
            ctx.save(); ctx.translate(at.x, at.y); ctx.rotate(k < 0.2 ? (1 - k / 0.2) * Math.PI : 0); drawHourglass(ctx, 0, 0, 26, Math.max(0, (k - 0.2) / 0.8)); ctx.restore();
            ctx.globalAlpha = 1;
        } });
        spray(at, 20, { color: ["#f6d48f", "#fff4c0"], shape: "star", speed: [40, 120], size: [2, 3.5], g: 0, life: [0.6, 1.2], add: true, delay: 0.6 });
        await hold(2.4);
    });
    // Oasis: spring water wells up where the attack hit, palm fronds shade the board, the letters come back with a ripple
    D("oasis", async c => {
        const ps = spots(c, () => [boardMid()]), b = board();
        spray({ x: b.left + b.width / 2, y: b.top - 10 }, 14, { color: ["#2f8f4a", "#4fb36a", "#7be36b"], shape: "leaf", angle: Math.PI / 2, spread: 1.2, speed: [60, 160], size: [8, 14], g: 120, drag: 1.2, life: [1, 1.6], wob: [3, 80] });
        ps.forEach((p, i) => setTimeout(() => {
            for (let j = 0; j < 3; j++) setTimeout(() => ring(p, { color: "#7fd4ff", r: 34 + j * 10, width: 3, life: 0.6 }), still() ? 0 : j * 140);
            spray(p, 8, { color: SEA, shape: "drop", angle: -Math.PI / 2, spread: 0.5, speed: [100, 200], size: [2, 3.5], g: 700, life: [0.4, 0.7] });
        }, still() ? 0 : i * 90));
        await hold(1.4);
    });
    // Tumbleweed: a tumbleweed bounces along the boss's fullest row and blows its letters away
    D("tumble", async c => {
        const ghosts = letterGhosts(c.cells), ps = pts(c).sort((p, q) => p.x - q.x), area = rect(c.area);
        const y = ps.length ? ps[0].y : area.top + area.height / 2, s = ps.length ? rect(c.cells[0].el).height * 0.45 : 16;
        add({ life: 1.2, draw(ctx, k) {
            const x = lerp(area.left - 40, area.right + 40, k), bounce = Math.abs(Math.sin(k * Math.PI * 4)) * s;
            drawTumbleweed(ctx, x, y - bounce, s, k * 16);
            if (Math.random() < 0.5) spray({ x, y: y + s * 0.6 }, 2, { color: SAND, shape: "dot", angle: Math.PI, spread: 0.6, speed: [40, 120], size: [1.5, 3], g: 100, life: [0.4, 0.8] });
        } });
        ghosts.forEach((gh, i) => setTimeout(() => leave([gh], "blow"), still() ? 0 : 1200 * (i + 0.5) / Math.max(1, ghosts.length)));
        await hold(1.4);
    });
    // Sun Bake: the sun beats down on your word: its right letters set hard and gold, its wrong ones crack and crumble
    D("bake", async c => {
        const cells = word().map(rect), ghosts = letterGhosts(c.cells);
        if (cells.length) {
            const l = Math.min(...cells.map(r => r.left)), r = Math.max(...cells.map(r => r.right)), t = Math.min(...cells.map(r => r.top)), bt = Math.max(...cells.map(r => r.bottom));
            const sun = { x: (l + r) / 2, y: t - 140 };
            add({ life: 1.6, draw(ctx, k) {
                const a = Math.sin(k * Math.PI);
                K.haloAt(ctx, sun.x, sun.y, 60, "#ffcf3f", a);
                ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.25 * a; ctx.fillStyle = "#ffe08a";
                ctx.beginPath(); ctx.moveTo(sun.x - 20, sun.y); ctx.lineTo(sun.x + 20, sun.y); ctx.lineTo(r + 10, bt); ctx.lineTo(l - 10, bt); ctx.closePath(); ctx.fill();
                ctx.globalAlpha = 0.3 * a; ctx.fillRect(l - 4, t - 4, r - l + 8, bt - t + 8);
            } });
        }
        await hold(0.6);
        leave(ghosts, "smear");
        pts(c).forEach(p => spray(p, 10, { color: ["#c9974f", "#e0b872", "#8a5a2b"], shape: "crumb", speed: [60, 160], size: [2, 3.5], g: 600, life: [0.4, 0.7] }));
        await hold(1);
    });
    // Magma Core: a molten core lights up under your board and starts to pulse
    D("core", async c => {
        const b = board(), p = boardMid(), R = Math.max(b.width, b.height) * 0.7;
        add({ life: 2, draw(ctx, k, t) { ctx.globalAlpha = Math.sin(k * Math.PI) * (0.7 + Math.sin(t * 10) * 0.3); K.haloAt(ctx, p.x, p.y, R, "#ff6a1f", 0.45); ctx.globalAlpha = 1; } });
        for (let i = 0; i < 3; i++) setTimeout(() => ring(p, { color: "#ff8a1f", r: R, width: 7, life: 0.8 }), still() ? 0 : i * 500);
        spray({ x: p.x, y: b.bottom }, 24, { color: LAVA, shape: "ember", angle: -Math.PI / 2, spread: 0.5, speed: [80, 200], size: [2, 4], g: -30, life: [0.7, 1.3], jitter: b.width / 2 });
        await hold(2);
    });
    // Ember Trail: a ring of embers runs round your board and stays hot
    D("embers", async c => {
        const b = board();
        add({ life: 1.4, draw(ctx, k) {
            const per = 2 * (b.width + b.height), d = per * ease(k);
            const at = d2 => { let q = d2 % per; if (q < b.width) return [b.left + q, b.top]; q -= b.width; if (q < b.height) return [b.right, b.top + q]; q -= b.height; if (q < b.width) return [b.right - q, b.bottom]; q -= b.width; return [b.left, b.bottom - q]; };
            for (let i = 0; i < 24; i++) { const [x, y] = at(d - i * 8); K.haloAt(ctx, x, y, 12 - i * 0.4, "#ff8a2a", 0.9 - i * 0.035); }
            if (Math.random() < 0.8) { const [x, y] = at(d); spray({ x, y }, 2, { color: LAVA, shape: "ember", speed: [30, 90], size: [1.5, 3], g: -40, life: [0.4, 0.8] }); }
        } });
        await hold(1.4);
    });
    // Vent: your combo blasts out as a jet of steam onto the boss's board, scalding letters off it
    D("vent", async c => {
        const ghosts = letterGhosts(c.cells), a = boardMid(), to = mid(c.area), ang = Math.atan2(to.y - a.y, to.x - a.x);
        spray(a, 50, { color: ["rgba(255,255,255,.85)", "rgba(230,230,240,.7)", "#ffd9a8"], shape: "glow", angle: ang, spread: 0.18, speed: [500, 900], size: [8, 18], g: -40, drag: 0.6, life: [0.6, 1], grow: 1.5 });
        await hold(0.45);
        ring(to, { color: "#ffb02e", r: 120, width: 8 });
        await leave(ghosts, "burn", { stagger: 40 });
    });
    // Lava Lamp: warm blobs of light rise slowly over every letter you have right
    D("lamp", async c => {
        const els = cellsOf("#board .cell.lamp-lit").map(rect);
        add({ life: 2.4, draw(ctx, k, t) {
            const a = Math.sin(k * Math.PI);
            els.forEach((r, i) => {
                const x = r.left + r.width / 2 + Math.sin(t * 2 + i) * r.width * 0.15, y = r.bottom - ((t * 30 + i * 13) % r.height);
                K.haloAt(ctx, x, y, r.width * 0.35, i % 2 ? "#ff6a8a" : "#ffd03e", 0.7 * a);
            });
        } });
        await hold(2.4);
    });
})();
