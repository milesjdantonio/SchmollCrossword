// Machines. The powers that fire, fling or pump something get a real, drawn
// machine that assembles on screen first: wheels roll in, the frame drops on, the arm cranks back, the fuse burns,
// and only then does it fire, with recoil, smoke and the projectile flying out of the right spot.
// These replace those kinds' scenes from spells-abilities.js / spells-moves.js (same Spells.define).
(() => {
    const K = Spells.kit;
    const { add, wait, rect, mid, rnd, splat, letterGhosts, leave, TAU, pick, $, lerp, ease, portrait, myBoard, bossBoard, pts, cellsOf, spray, ring, lob, drawAcorn, drawSnowball, drawPie, drawBottle } = K;
    const D = Spells.define;
    const still = () => K.still();
    const ms = t => (still() ? 0 : t);
    const clamp01 = k => Math.max(0, Math.min(1, k));
    const tone = o => Sound.tone({ ...o, boss: true });           // (at the move's or ability's level: Sound.bossLevel)
    const INK = "#2b2233";
    const fade = (k, from = 0.85) => (k > from ? (1 - k) / (1 - from) : 1);
    // a timeline: ph(t, a, b) = how far through [a, b] seconds we are (0..1)
    const ph = (t, a, b) => clamp01((t - a) / (b - a));
    const bounceIn = k => (k < 1 ? 1 - Math.pow(1 - k, 2) * Math.cos(k * 9) : 1);

    // ---- drawn parts ----
    function wheel(ctx, x, y, r, rot, wood = "#8a5a2b") {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
        ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.fillStyle = wood;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#c48a4a"; ctx.beginPath(); ctx.arc(0, 0, r * 0.72, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = "#5b3a1a"; ctx.lineWidth = 3; for (let i = 0; i < 6; i++) { ctx.rotate(TAU / 6); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 0.72, 0); ctx.stroke(); }
        ctx.fillStyle = "#4a4f5a"; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r * 0.2, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = "#4a4f5a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, Math.max(0, r - 1.5), 0, TAU); ctx.stroke();       // the iron tyre
        ctx.restore();
    }
    // a cannon: carriage on two wheels, iron barrel pivoting at (px, py) and pointing along ang
    function cannonParts(ctx, { x, y, s, wheelX, wheelRot, carriageY, barrelAng, barrelIn, recoil, fuse }) {
        const dirX = Math.cos(barrelAng) >= 0 ? 1 : -1;
        ctx.save(); ctx.translate(x - dirX * recoil, y);
        // carriage (a wooden wedge), dropped in from above
        if (carriageY > -999) {
            ctx.save(); ctx.translate(0, carriageY);
            ctx.fillStyle = "#a8743a"; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(-34 * s, -6 * s); ctx.lineTo(30 * s, -6 * s); ctx.lineTo(22 * s, -30 * s); ctx.lineTo(-14 * s, -30 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#4a4f5a"; for (const bx of [-24, -4, 16]) { ctx.beginPath(); ctx.arc(bx * s, -18 * s, 2.5 * s, 0, TAU); ctx.fill(); }
            ctx.restore();
        }
        // the barrel, swinging down onto the carriage
        if (barrelIn > 0) {
            const py = -32 * s + carriageY * 0, len = 64 * s;
            ctx.save(); ctx.translate(0, py - (1 - barrelIn) * 160); ctx.rotate(barrelAng);
            const g = ctx.createLinearGradient(0, -12 * s, 0, 12 * s); g.addColorStop(0, "#7a8290"); g.addColorStop(0.45, "#3a404c"); g.addColorStop(1, "#1e222a");
            ctx.fillStyle = g; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(-18 * s, -13 * s); ctx.lineTo(len, -9 * s); ctx.lineTo(len, 9 * s); ctx.lineTo(-18 * s, 13 * s); ctx.arc(-18 * s, 0, 13 * s, Math.PI / 2, Math.PI * 1.5); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#5a6270"; for (const bx of [8, 30, len - 6]) { ctx.fillRect(bx, -12 * s, 6 * s, 24 * s); ctx.strokeRect(bx, -12 * s, 6 * s, 24 * s); }
            ctx.fillStyle = "#14161c"; ctx.beginPath(); ctx.ellipse(len + 1, 0, 3 * s, 8 * s, 0, 0, TAU); ctx.fill();
            // the fuse, burning down
            if (fuse >= 0) {
                const fx = -22 * s, fy = -12 * s, end = { x: fx - 10 * s * (1 - fuse), y: fy - 14 * s * (1 - fuse) };
                ctx.strokeStyle = "#8a6a4a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.quadraticCurveTo(fx - 6 * s, fy - 10 * s, end.x, end.y); ctx.stroke();
                if (fuse < 1) { ctx.fillStyle = "#ffe066"; ctx.shadowColor = "#ff9f1c"; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(end.x, end.y, 3.5 * s, 0, TAU); ctx.fill(); ctx.shadowBlur = 0; }
            }
            ctx.restore();
        }
        // wheels, rolled in from the side
        wheel(ctx, wheelX * s - 10 * s, -2 * s, 14 * s, wheelRot);
        wheel(ctx, wheelX * s + 16 * s, -2 * s, 14 * s, wheelRot + 0.6);
        ctx.restore();
    }
    // Build a cannon at `at` (its wheels' ground point), aiming at `target`; it fires after the fuse burns.
    // Resolves with { muzzle, ang } at the moment it fires. The cannon stays a moment, smoking, then fades.
    function cannon(at, target, { s = 1, fuseTime = 0.5, stay = 0.9, color = "#ff9f1c" } = {}) {
        return new Promise(resolve => {
            const pivot = { x: at.x, y: at.y - 32 * s }, ang = Math.atan2(target.y - pivot.y, target.x - pivot.x), dirX = Math.cos(ang) >= 0 ? 1 : -1;
            const T_WHEELS = 0.3, T_CARRIAGE = 0.55, T_BARREL = 0.85, T_FIRE = T_BARREL + fuseTime, life = T_FIRE + stay;
            const muzzle = { x: pivot.x + Math.cos(ang) * 66 * s, y: pivot.y + Math.sin(ang) * 66 * s };
            let fired = false;
            if (still()) { resolve({ muzzle, ang }); return; }
            add({ life, draw(ctx, k, t) {
                const w = ease(ph(t, 0, T_WHEELS)), c = bounceIn(ph(t, T_WHEELS, T_CARRIAGE)), b = ease(ph(t, T_CARRIAGE, T_BARREL));
                // the barrel comes down pointing straight up, then turns the short way round to its aim
                const settle = ease(ph(t, T_CARRIAGE, T_BARREL)), delta = Math.atan2(Math.sin(ang + Math.PI / 2), Math.cos(ang + Math.PI / 2)), aimNow = -Math.PI / 2 + delta * settle;
                const rec = t > T_FIRE ? 18 * s * Math.exp(-(t - T_FIRE) * 7) * Math.sin(Math.min(1, (t - T_FIRE) * 12) * Math.PI / 2) : 0;
                if (!fired && t >= T_FIRE) {
                    fired = true;
                    FX.shake(9, 300);
                    tone({ f: 110, f2: 40, d: 0.35, v: 0.35 });
                    K.glow(muzzle, { color: "#ffe9a8", r: 70, life: 0.3 });
                    ring(muzzle, { color: "#fff3d6", r: 60, width: 6, life: 0.4 });
                    spray(muzzle, 26, { color: ["#ffe066", "#ff9f1c", "#ff5a1f"], shape: "ember", speed: [150, 420], angle: ang, spread: 0.5, size: [1.5, 3], g: 200, life: [0.2, 0.5] });
                    spray(muzzle, 18, { color: ["rgba(200,195,190,.75)", "rgba(150,145,140,.65)", "rgba(240,235,230,.7)"], shape: "glow", speed: [40, 160], angle: ang, spread: 0.9, size: [12, 24], grow: 1.5, g: -20, drag: 1.4, life: [0.9, 1.5] });
                    resolve({ muzzle, ang });
                }
                ctx.globalAlpha = fade(k, 0.85);
                cannonParts(ctx, { x: at.x, y: at.y, s, wheelX: (1 - w) * -dirX * 160 / s, wheelRot: (1 - w) * -dirX * 8, carriageY: lerp(-140, 0, c), barrelAng: aimNow, barrelIn: b, recoil: rec, fuse: t < T_BARREL ? 0 : Math.min(1, (t - T_BARREL) / fuseTime) });
                if (t > T_BARREL && t < T_FIRE && Math.random() < 0.7) {
                    const fx = pivot.x - 22 * s * Math.cos(ang) - 10 * s, fy = pivot.y - 20 * s;
                    spray({ x: fx, y: fy }, 1, { color: ["#ffe066", "#ff9f1c"], shape: "ember", speed: [30, 90], size: [1, 2], g: 100, life: [0.2, 0.4] });
                }
            } });
            if (!still()) { setTimeout(() => tone({ f: 200, f2: 120, d: 0.06, v: 0.12, type: "square" }), T_WHEELS * 1000); setTimeout(() => tone({ f: 160, f2: 90, d: 0.08, v: 0.18, type: "square" }), T_CARRIAGE * 1000); setTimeout(() => tone({ f: 420, f2: 260, d: 0.06, v: 0.1, type: "square" }), T_BARREL * 1000); }
        });
    }
    // a cannonball (or a lit bomb) flying out of a muzzle in a real arc
    function cannonball(from, to, { life = 0.75, bomb = true } = {}) {
        return lob(from, to, { life, height: Math.max(80, Math.abs(to.x - from.x) * 0.35), drawFn: (ctx, x, y, k) => {
            const g = ctx.createRadialGradient(x - 4, y - 4, 1, x, y, 13); g.addColorStop(0, "#6a7280"); g.addColorStop(1, "#14161c");
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 12, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
            if (bomb) { ctx.strokeStyle = "#8a6a4a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 6, y - 9); ctx.quadraticCurveTo(x + 12, y - 18, x + 9, y - 22); ctx.stroke(); if (Math.random() < 0.8) spray({ x: x + 9, y: y - 22 }, 1, { color: ["#ffcf3f", "#ff7a1f"], shape: "ember", speed: [20, 80], size: [1, 2], g: 0, life: [0.15, 0.3] }); }
            if (Math.random() < 0.4) spray({ x, y }, 1, { color: ["rgba(200,195,190,.6)"], shape: "glow", speed: [5, 20], size: [6, 10], g: -10, life: [0.4, 0.7] });
        } });
    }

    // a wooden catapult: frame on wheels, a throwing arm that cranks back and snaps forward
    function catapultParts(ctx, { x, y, s, facing, frameY, armAng, load, wheelRot }) {
        ctx.save(); ctx.translate(x, y + frameY); ctx.scale(facing, 1);
        ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.fillStyle = "#a8743a";
        ctx.fillRect(-40 * s, -14 * s, 80 * s, 10 * s); ctx.strokeRect(-40 * s, -14 * s, 80 * s, 10 * s);
        ctx.beginPath(); ctx.moveTo(-6 * s, -14 * s); ctx.lineTo(4 * s, -50 * s); ctx.lineTo(14 * s, -14 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#8a5a2b"; ctx.fillRect(-30 * s, -20 * s, 14 * s, 8 * s); ctx.strokeRect(-30 * s, -20 * s, 14 * s, 8 * s);
        ctx.strokeStyle = "#c9a07a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-23 * s, -18 * s); ctx.lineTo(4 * s + Math.cos(armAng) * -20 * s, -50 * s + Math.sin(armAng) * -20 * s); ctx.stroke();
        // the arm, pivoting at the top of the A-frame
        ctx.save(); ctx.translate(4 * s, -50 * s); ctx.rotate(armAng);
        ctx.fillStyle = "#8a5a2b"; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.fillRect(-26 * s, -4 * s, 76 * s, 8 * s); ctx.strokeRect(-26 * s, -4 * s, 76 * s, 8 * s);
        ctx.fillStyle = "#6b4219"; ctx.beginPath(); ctx.arc(50 * s, -6 * s, 11 * s, 0, Math.PI); ctx.fill(); ctx.stroke();       // the bucket
        if (load) load(ctx, 50 * s, -12 * s);
        ctx.restore();
        ctx.fillStyle = "#4a4f5a"; ctx.beginPath(); ctx.arc(4 * s, -50 * s, 4 * s, 0, TAU); ctx.fill();
        ctx.restore();
        wheel(ctx, x - 26 * s * facing, y + frameY - 4 * s, 10 * s, wheelRot);
        wheel(ctx, x + 26 * s * facing, y + frameY - 4 * s, 10 * s, wheelRot + 1);
    }
    // Build a catapult and fling `shots` things at `target`, one after another. drawShot(ctx, x, y, rot) draws one.
    // onHit(i, point) is called as each one lands. Resolves when the last one has landed.
    function catapult(at, target, { s = 1, shots = 1, drawShot, onHit, flight = 0.6, height = 200 } = {}) {
        return new Promise(resolve => {
            const facing = target.x >= at.x ? 1 : -1, T_BUILD = 0.4, T_CRANK = 0.45, T_FLING = 0.12, T_RESET = 0.2, cycle = T_CRANK + T_FLING + T_RESET;
            // the arm's angle (canvas: clockwise): the bucket rests low at the back, cranks further down, then swings over the top
            const life = T_BUILD + cycle * shots + flight + 0.4, rest = 2.7, back = 3.0, fwd = 4.9;
            if (still()) { for (let i = 0; i < shots; i++) onHit && onHit(i, target); resolve(); return; }
            let launched = 0;
            add({ life, draw(ctx, k, t) {
                const frameY = lerp(-120, 0, bounceIn(ph(t, 0, T_BUILD)));
                let armAng = rest, loaded = false;
                if (t > T_BUILD) {
                    const c = (t - T_BUILD) % cycle, n = Math.floor((t - T_BUILD) / cycle);
                    if (n < shots) {
                        if (c < T_CRANK) { armAng = lerp(rest, back, ease(c / T_CRANK)); loaded = true; }
                        else if (c < T_CRANK + T_FLING) { armAng = lerp(back, fwd, (c - T_CRANK) / T_FLING); loaded = (c - T_CRANK) / T_FLING < 0.7; }
                        else armAng = lerp(fwd, rest, ease((c - T_CRANK - T_FLING) / T_RESET));
                        if (n >= launched && c >= T_CRANK + T_FLING * 0.7) {
                            const i = launched++;
                            const pivot = { x: at.x + 4 * s * facing, y: at.y - 50 * s }, rel = { x: 50 * s * Math.cos(fwd) + 12 * s * Math.sin(fwd), y: 50 * s * Math.sin(fwd) - 12 * s * Math.cos(fwd) };
                            const from = { x: pivot.x + rel.x * facing, y: pivot.y + rel.y };
                            const tgt = { x: target.x + rnd(-24, 24) * (shots > 1 ? 1 : 0), y: target.y + rnd(-18, 18) * (shots > 1 ? 1 : 0) };
                            tone({ f: 300, f2: 160, d: 0.08, v: 0.15, type: "square" });
                            lob(from, tgt, { life: flight, height, drawFn: (c2, x, y, q) => drawShot(c2, x, y, q * 10) }).then(() => { onHit && onHit(i, tgt); if (i === shots - 1) setTimeout(resolve, 50); });
                        }
                    }
                }
                ctx.globalAlpha = fade(k, 0.9);
                catapultParts(ctx, { x: at.x, y: at.y, s, facing, frameY, armAng: facing > 0 ? armAng : armAng, wheelRot: 0, load: loaded ? (c2, x, y) => drawShot(c2, x, y, 0) : null });
            } });
            for (let i = 0; i < shots; i++) setTimeout(() => tone({ f: 700, f2: 500, d: 0.05, v: 0.05, type: "triangle" }), (T_BUILD + i * cycle + 0.15) * 1000);
        });
    }

    // ---- where things stand ----
    const bossSide = () => { const r = rect(portrait() || bossBoard()); return { r, base: { x: r.left + 30, y: r.bottom - 6 } }; };
    const boardMid = () => mid(myBoard());
    const big = (desk, phone) => (innerWidth < 700 ? phone : desk);         // machines are big on a desktop, smaller on a phone

    // =========================================================================================
    // Boss moves
    // =========================================================================================
    // Cannonball: the Ringmaster's crew builds a cannon at the boss's side, lights the fuse, BOOM: a lit bomb lands on your square
    D("m-bomb", async c => {
        await wait(60);
        const target = (cellsOf("#board .cell.bombed")[0] && mid(cellsOf("#board .cell.bombed")[0])) || boardMid(), { base } = bossSide();
        const { muzzle } = await cannon(base, target, { s: big(1.5, 1), fuseTime: 0.55 });
        await cannonball(muzzle, target, { life: 0.8, bomb: true });
        FX.shake(6, 200);
        ring(target, { color: "#ff9f1c", r: 50, width: 6 });
        spray(target, 14, { color: ["#ffcf3f", "#ff7a1f"], shape: "ember", speed: [60, 180], size: [1, 2.5], g: 100, life: [0.4, 0.8] });
    });
    // Confetti Cannon: two cannons build up on either side of your board and blast it with confetti
    D("m-confetti", async c => {
        const b = rect(myBoard()), sides = [{ x: b.left - 50, y: b.bottom + 10 }, { x: b.right + 50, y: b.bottom + 10 }];
        await Promise.all(sides.map((at, i) => cannon(at, { x: (b.left + b.right) / 2, y: b.top - 40 }, { s: big(1.2, 0.8), fuseTime: 0.35 + i * 0.12, stay: 1 }).then(({ muzzle, ang }) => {
            K.burst(Array.from({ length: K.lite() ? 45 : 90 }, () => { const a = ang + rnd(-0.4, 0.4), v = rnd(500, 900); return { x: muzzle.x, y: muzzle.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 600, drag: 1.2, life: rnd(1.6, 2.4), size: rnd(5, 9), color: pick(["#e2483c", "#ffd23f", "#4fa3e8", "#ffffff", "#7dff6b", "#c08bff"]), shape: "square", vr: rnd(-12, 12), wob: [5, 120], ph: rnd(0, 6) }; }));
        })));
        await wait(900);
    });
    // Eruption: a volcano cone heaves up beside the wyrm, rumbles and glows, then blows lava bombs onto your board
    D("m-eruption", async c => {
        const ghosts = letterGhosts(c.cells), ps = pts(c), b = rect(myBoard()), { r } = bossSide();
        const base = { x: r.left + r.width * 0.25, y: r.bottom }, crater = { x: base.x, y: base.y - 90 };
        const spots = ps.length ? [ps[0], ps[Math.floor(ps.length / 2)] || ps[0]] : [{ x: rnd(b.left, b.right), y: rnd(b.top, b.bottom) }, { x: rnd(b.left, b.right), y: rnd(b.top, b.bottom) }];
        add({ life: 3, draw(ctx, k, t) {
            const rise = ease(ph(t, 0, 0.6)), h = 90 * rise, shake = t > 0.6 && t < 1.3 ? Math.sin(t * 60) * 2 : 0, glowK = ph(t, 0.6, 1.3);
            ctx.globalAlpha = fade(k, 0.85);
            ctx.save(); ctx.translate(shake, 0);
            const g = ctx.createLinearGradient(0, base.y - h, 0, base.y); g.addColorStop(0, "#5a3a2a"); g.addColorStop(1, "#2b1d18");
            ctx.fillStyle = g; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(base.x - 80, base.y); ctx.lineTo(base.x - 18, base.y - h); ctx.lineTo(base.x + 18, base.y - h); ctx.lineTo(base.x + 80, base.y); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = `rgba(255,${120 + glowK * 80},30,${0.3 + glowK * 0.7})`; ctx.lineWidth = 3; ctx.shadowColor = "#ff6a00"; ctx.shadowBlur = 16 * glowK;
            for (const [dx, len] of [[-30, 40], [10, 55], [40, 30]]) { ctx.beginPath(); ctx.moveTo(base.x + dx * 0.4, base.y - h + 6); ctx.lineTo(base.x + dx, base.y - h + len); ctx.stroke(); }
            ctx.fillStyle = `rgba(255,${160 + glowK * 60},40,${0.5 + glowK * 0.5})`; ctx.beginPath(); ctx.ellipse(base.x, base.y - h, 18, 5, 0, 0, TAU); ctx.fill();
            ctx.restore();
            if (t > 0.5 && Math.random() < 0.4) spray({ x: base.x, y: base.y - h }, 1, { color: ["rgba(90,80,80,.6)", "rgba(130,120,115,.5)"], shape: "glow", speed: [20, 60], angle: -Math.PI / 2, spread: 0.4, size: [10, 18], grow: 1.5, g: -40, life: [1, 1.6] });
        } });
        await wait(1300);
        FX.shake(12, 500);
        tone({ f: 70, f2: 30, d: 0.8, v: 0.35 });
        spray(crater, 50, { color: ["#ffcf3f", "#ff6a00", "#ff3d00"], shape: "ember", speed: [250, 600], angle: -Math.PI / 2, spread: 0.5, size: [2, 4], g: 700, life: [0.7, 1.3] });
        await Promise.all(spots.map((p, i) => new Promise(async res => {
            await wait(i * 180);
            await lob(crater, p, { life: 0.8, height: 300, trail: "rgba(255,120,30,.8)", drawFn: (ctx, x, y) => { const g = ctx.createRadialGradient(x - 4, y - 4, 0, x, y, 16); g.addColorStop(0, "#fff3a0"); g.addColorStop(0.4, "#ff9f1c"); g.addColorStop(1, "#7a1f0a"); ctx.fillStyle = g; ctx.shadowColor = "#ff6a00"; ctx.shadowBlur = 24; ctx.beginPath(); ctx.arc(x, y, 14, 0, TAU); ctx.fill(); } });
            FX.shake(10, 300); K.glow(p, { color: "#ff6a00", r: 110 }); ring(p, { color: "#ffcf3f", r: 90, width: 8 });
            spray(p, 30, { color: ["#ffcf3f", "#ff6a00", INK], shape: "crumb", speed: [150, 420], size: [3, 6], g: 800, life: [0.5, 1] });
            res();
        })));
        await leave(ghosts, "burn", { stagger: 30 });
    });
    // Sand Blast: leather bellows unfold on both sides of your board and pump jets of sand across it
    D("m-sandblast", async c => {
        const b = rect(myBoard());
        const bellows = (ctx, x, y, dir, squeeze) => {
            ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
            const open = 1 - squeeze * 0.6;
            ctx.fillStyle = "#8a5a2b"; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(-40, -24 * open); ctx.lineTo(10, -8); ctx.lineTo(10, 8); ctx.lineTo(-40, 24 * open); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = "#5b3a1a"; ctx.lineWidth = 1.5; for (let i = 1; i < 4; i++) { const xx = -40 + i * 12; ctx.beginPath(); ctx.moveTo(xx, -24 * open + i * 4 * open); ctx.lineTo(xx, 24 * open - i * 4 * open); ctx.stroke(); }
            ctx.fillStyle = "#c9a43a"; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.fillRect(10, -5, 22, 10); ctx.strokeRect(10, -5, 22, 10);
            ctx.fillStyle = "#a8743a"; ctx.fillRect(-58, -6, 18, 12); ctx.strokeRect(-58, -6, 18, 12);
            ctx.restore();
        };
        const ys = [b.top + b.height * 0.3, b.top + b.height * 0.7];
        add({ life: 2.2, draw(ctx, k, t) {
            const inK = ease(ph(t, 0, 0.35)), squeeze = t > 0.45 ? (Math.sin((t - 0.45) * 14) + 1) / 2 : 0;
            ctx.globalAlpha = fade(k, 0.8);
            for (const y of ys) { bellows(ctx, lerp(b.left - 160, b.left - 40, inK), y, 1, squeeze); bellows(ctx, lerp(b.right + 160, b.right + 40, inK), y, -1, 1 - squeeze); }
        } });
        await wait(450);
        for (let i = 0; i < 6; i++) {
            for (const [side, y] of [[-1, ys[i % 2]], [1, ys[(i + 1) % 2]]]) {
                const x = side < 0 ? b.left - 8 : b.right + 8;
                K.burst(Array.from({ length: K.lite() ? 15 : 30 }, () => ({ x, y, vx: -side * rnd(600, 1000), vy: rnd(-90, 90), life: 0.5, size: rnd(1.5, 3), color: pick(["#d9a35c", "#c48a45", "#ecc68e"]), shape: "dot", drag: 0.5 })));
            }
            tone({ f: 300, f2: 200, d: 0.1, v: 0.03, type: "sawtooth" });
            await wait(220);
        }
        for (let i = 0; i < 8; i++) spray({ x: rnd(b.left, b.right), y: rnd(b.top, b.bottom) }, 5, { color: ["#ecc68e", "#d9a35c"], shape: "dot", speed: [100, 260], size: [1.5, 2.5], g: 400, life: [0.2, 0.5] });
        await wait(300);
    });

    // =========================================================================================
    // Abilities
    // =========================================================================================
    // Acorn Toss: a wooden catapult assembles by your board, cranks back and flings acorns, one per letter, at the boss's board
    D("knock", async c => {
        const ghosts = letterGhosts(c.cells), ps = pts(c).length ? pts(c) : [mid(c.area)], b = rect(myBoard());
        const at = { x: b.right - 20, y: b.top - 6 }, target = ps.reduce((s, p) => ({ x: s.x + p.x / ps.length, y: s.y + p.y / ps.length }), { x: 0, y: 0 });
        await catapult(at, target, { s: big(1.4, 0.9), shots: ps.length, flight: 0.55, height: 220, drawShot: (ctx, x, y, rot) => drawAcorn(ctx, x, y, 11, rot),
            onHit: (i, p) => {
                const hit = ps[i] || p;
                ring(hit, { color: "#fff3d6", r: 36, width: 5 });
                spray(hit, 12, { color: ["#c9a07a", "#8a5a2b", "#fff"], shape: "crumb", speed: [100, 260], size: [2, 4], g: 700, life: [0.4, 0.7] });
                tone({ f: 420 + i * 70, f2: 200, d: 0.08, v: 0.2, type: "square" });
                if (ghosts[i]) leave([ghosts[i]], "pop");
                const dir = Math.random() < 0.5 ? -1 : 1;
                add({ life: 0.9, draw(ctx, k, t) { drawAcorn(ctx, hit.x + dir * 180 * t, hit.y - 330 * t + 600 * t * t, 11, t * 14); } });
            } });
        await leave(ghosts.slice(ps.length), "pop");
    });
    // Pie in the Face: a catapult winds up and lobs a cream pie, SPLAT, right on the boss's face
    D("blind", async c => {
        const p = mid(portrait()), r = rect(portrait()), b = rect(myBoard());
        await catapult({ x: b.right - 20, y: b.top - 6 }, p, { s: big(1.4, 0.9), shots: 1, flight: 0.65, height: 230, drawShot: (ctx, x, y, rot) => drawPie(ctx, x, y, 20, rot * 0.3),
            onHit: () => {
                FX.shake(10, 300);
                tone({ f: 160, f2: 60, d: 0.2, v: 0.3 });
                splat(p, { color: "#fffaf0", r: r.width * 0.32, drips: 6, life: 2.2 });
                splat({ x: p.x + 30, y: p.y - 20 }, { color: "#fff3e0", r: r.width * 0.12, drips: 2, life: 2 });
                spray(p, 40, { color: ["#fffaf0", "#fff3e0", "#d9a35c"], shape: "drop", speed: [200, 520], size: [3, 7], g: 900, life: [0.5, 1] });
                spray(p, 10, { color: "#d9a35c", shape: "crumb", speed: [100, 300], size: [3, 6], g: 900, life: [0.6, 1] });
            } });
        await wait(700);
    });
    // Snowball: a snowball rolls along under your board, growing as it picks up snow, hops up and gets hurled at the boss
    D("freeze", async c => {
        const b = rect(myBoard()), p = mid(portrait()), r = rect(portrait()), y = b.bottom + 4;
        let end = null;
        await new Promise(res => { if (still()) return res(); add({ life: 1.1, draw(ctx, k) {
            const q = ease(k), x = lerp(b.left + 10, b.right - 10, q), rad = lerp(6, 24, q);
            ctx.globalAlpha = 0.6; ctx.fillStyle = "#ffffff"; ctx.fillRect(b.left + 10, y - 2, x - b.left - 10, 4); ctx.globalAlpha = 1;
            drawSnowball(ctx, x, y - rad, rad, q * 14);
            if (Math.random() < 0.5) spray({ x: x - rad * 0.8, y: y - 2 }, 1, { color: ["#fff", "#e8f8ff"], shape: "dot", speed: [30, 90], angle: -2.4, spread: 0.6, size: [1.5, 3], g: 300, life: [0.3, 0.5] });
            end = { x, y: y - rad };
        } }); setTimeout(res, 1100); });
        const from = end || { x: b.right - 10, y: y - 24 };
        await lob(from, p, { life: 0.6, height: 200, drawFn: (ctx, x, yy, k) => drawSnowball(ctx, x, yy, 24, k * 10), trail: "rgba(255,255,255,.7)" });
        K.flash("#e8f8ff", 220, 0.5);
        ring(p, { color: "#cfeeff", r: 160, width: 12 });
        spray(p, 40, { color: ["#ffffff", "#eef7ff", "#cfe8f8"], shape: "dot", speed: [160, 460], size: [3, 8], g: 700, life: [0.5, 1] });
        spray(p, 20, { color: "#ffffff", shape: "flake", speed: [80, 260], size: [5, 9], g: 60, life: [1, 1.6], spin: 3 });
        K.frost(p, r, { life: 1.8 });
        add({ life: 1.9, draw(ctx, k) {
            const grow = ease(Math.min(1, k * 3));
            ctx.globalAlpha = fade(k, 0.8) * 0.75;
            const g = ctx.createLinearGradient(r.left, r.top, r.right, r.bottom); g.addColorStop(0, "rgba(220,245,255,.75)"); g.addColorStop(0.5, "rgba(160,215,245,.45)"); g.addColorStop(1, "rgba(220,245,255,.75)");
            ctx.fillStyle = g; const h = r.height * grow; ctx.fillRect(r.left, r.bottom - h, r.width, h);
            ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 3; ctx.strokeRect(r.left + 3, r.bottom - h + 3, r.width - 6, h - 6);
        } });
        await wait(1100);
    });
    // Sticky Taffy: a taffy-pulling machine appears by your board, its arms whirl the pink taffy round and round,
    // then it shoots the stretched strands over and glues the boss's board down
    D("slow", async c => {
        const b = rect(myBoard()), a = rect(c.area), m = { x: b.right + 30, y: b.top + 40 };
        await new Promise(res => { if (still()) return res(); add({ life: 1.5, draw(ctx, k, t) {
            const inK = bounceIn(ph(t, 0, 0.35)), spin = t * 7;
            ctx.save(); ctx.translate(m.x, m.y + lerp(-100, 0, inK)); ctx.scale(big(1.5, 1), big(1.5, 1));
            ctx.fillStyle = "#c0c8d0"; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.fillRect(-6, 0, 12, 60); ctx.strokeRect(-6, 0, 12, 60); ctx.fillRect(-26, 56, 52, 10); ctx.strokeRect(-26, 56, 52, 10);
            const pegA = { x: Math.cos(spin) * 26, y: Math.sin(spin) * 26 }, pegB = { x: Math.cos(spin + Math.PI) * 26, y: Math.sin(spin + Math.PI) * 26 }, fixed = { x: 0, y: 34 };
            for (const [w, col] of [[10, "#ff6fb5"], [4, "#ffffff"]]) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = "round"; ctx.beginPath(); ctx.moveTo(pegA.x, pegA.y); ctx.quadraticCurveTo(fixed.x - 10, fixed.y + 6, fixed.x, fixed.y); ctx.quadraticCurveTo(fixed.x + 10, fixed.y + 6, pegB.x, pegB.y); ctx.quadraticCurveTo(0, -6, pegA.x, pegA.y); ctx.stroke(); }
            ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(pegA.x, pegA.y); ctx.lineTo(pegB.x, pegB.y); ctx.stroke();
            for (const q of [pegA, pegB, fixed]) { ctx.fillStyle = "#8a95a3"; ctx.beginPath(); ctx.arc(q.x, q.y, 5, 0, TAU); ctx.fill(); ctx.stroke(); }
            ctx.restore();
        } }); setTimeout(res, 1400); });
        const from = { x: m.x, y: m.y };
        const anchors = [{ x: a.left + 10, y: a.top + 10 }, { x: a.right - 10, y: a.top + 10 }, { x: a.left + 10, y: a.bottom - 10 }, { x: a.right - 10, y: a.bottom - 10 }, { x: (a.left + a.right) / 2, y: a.top + 6 }];
        add({ life: 2, draw(ctx, k, t) {
            const shoot = ease(Math.min(1, k * 3));
            ctx.globalAlpha = fade(k, 0.8); ctx.lineCap = "round";
            anchors.forEach((p, i) => {
                const ex = lerp(from.x, p.x, shoot), ey = lerp(from.y, p.y, shoot), sag = 50 + Math.sin(t * 3 + i) * 10 * (1 - k);
                for (const [w, col] of [[11, "#ff6fb5"], [5, "#ffffff"], [2, "#ffb3d6"]]) { ctx.strokeStyle = col; ctx.lineWidth = w * (1 - k * 0.4); ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.quadraticCurveTo((from.x + ex) / 2, Math.max(from.y, ey) + sag, ex, ey); ctx.stroke(); }
                if (shoot >= 1) { ctx.fillStyle = "#ff6fb5"; ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, TAU); ctx.fill(); }
            });
        } });
        await wait(700);
        anchors.forEach(p => spray(p, 4, { color: "#ff6fb5", shape: "drop", speed: [10, 40], angle: Math.PI / 2, spread: 0.3, size: [3, 5], g: 300, life: [0.8, 1.2] }));
        await wait(600);
    });
    // Ink Splat: the ink bottle's cork pops off with a bang, then it sails over and pours onto the boss's next squares
    D("junk", async c => {
        const area = rect(c.area), targets = cellsOf(".bp-cell.cur:not(.block)").slice(0, 5).map(mid), spots = targets.length ? targets : [mid(c.area)];
        const start = c.from, over = { x: area.left + area.width / 2, y: area.top - 50 };
        await new Promise(res => { if (still()) return res(); add({ life: 0.5, draw(ctx, k) { drawBottle(ctx, start.x, start.y - 20 * ease(k), Math.sin(k * 30) * 0.08); } }); setTimeout(res, 450); });
        tone({ f: 900, f2: 300, d: 0.08, v: 0.25, type: "square" });
        K.burst([{ x: start.x, y: start.y - 44, vx: rnd(-80, 80), vy: -520, g: 1200, life: 0.9, size: 7, color: "#c9a07a", shape: "square", vr: 14 }]);
        spray({ x: start.x, y: start.y - 40 }, 10, { color: ["#1a1424", "#2e2547"], shape: "drop", speed: [100, 260], angle: -Math.PI / 2, spread: 0.6, size: [2, 4], g: 800, life: [0.3, 0.6] });
        await lob(start, over, { life: 0.6, height: 200, drawFn: (ctx, x, y, k) => drawBottle(ctx, x, y, k * 2.6) });
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
})();
