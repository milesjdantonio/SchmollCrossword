// The SPACE world: solve among the stars.
//   Background: three layers of parallax stars, drifting nebulae, a ringed gas giant with a moon, shooting stars,
//   a passing satellite, and a black hole with a spinning accretion disk that bends the starlight around it
//   (gravitational lensing: stars passing behind it smear into arcs and show up twice).
//   Board: holographic glass squares; completed words become constellations.
//   Win: a black hole opens, swallows the board, collapses into a supernova, then a warp jump brings it back.

(() => {
    const TAU = Math.PI * 2;
    const { tone, noise, midi, chord } = Sound;

    // ---------------------------------------------------------------------------------------------
    // The black hole (used by the background AND the win cinematic)
    // ---------------------------------------------------------------------------------------------
    const RINGS = 22;
    const STOPS = [[0, [255, 249, 232]], [0.12, [255, 222, 150]], [0.35, [255, 150, 66]], [0.65, [226, 74, 44]], [1, [128, 32, 128]]];
    function diskRGB(k) {
        for (let i = 1; i < STOPS.length; i++) {
            if (k <= STOPS[i][0]) {
                const [k0, a] = STOPS[i - 1], [k1, b] = STOPS[i], f = (k - k0) / (k1 - k0);
                return a.map((v, j) => Math.round(v + (b[j] - v) * f)).join(",");
            }
        }
        return STOPS[STOPS.length - 1][1].join(",");
    }
    const RING_COL = Array.from({ length: RINGS }, (_, i) => diskRGB(i / (RINGS - 1)));
    const R0 = U.rng(1977);
    const CLUMPS = Array.from({ length: RINGS }, () => Array.from({ length: 12 }, () => 0.35 + R0() * 0.65));

    function disk(g, x, y, r, tilt, spin, back, glow) {
        g.save();
        g.translate(x, y);
        g.scale(1, tilt);
        for (let i = 0; i < RINGS; i++) {
            const k = i / (RINGS - 1), rr = r * (1.55 + k * 2.9), start = spin * (1.7 - k * 1.1);
            const cg = g.createConicGradient(start, 0, 0);
            for (let j = 0; j <= 12; j++) {
                const a = start + (j / 12) * TAU;
                const doppler = 0.4 + 0.6 * (0.5 - 0.5 * Math.cos(a));        // the side spinning toward us is brighter
                const alpha = CLUMPS[i][j % 12] * doppler * (1 - k) ** 1.15 * glow;
                cg.addColorStop(j / 12, `rgba(${RING_COL[i]},${alpha.toFixed(3)})`);
            }
            g.strokeStyle = cg;
            g.lineWidth = r * 0.16;
            g.beginPath();
            if (back) g.arc(0, 0, rr, Math.PI, TAU); else g.arc(0, 0, rr, 0, Math.PI);
            g.stroke();
        }
        g.restore();
    }

    function drawBlackHole(g, x, y, r, t, o = {}) {
        if (r < 0.5) return;
        const tilt = o.tilt ?? 0.24, spin = t * (o.spin ?? 0.5), glow = o.glow ?? 1;
        const gr = g.createRadialGradient(x, y, r * 0.9, x, y, r * 6.5);
        gr.addColorStop(0, `rgba(255,170,90,${0.26 * glow})`);
        gr.addColorStop(0.28, `rgba(180,70,200,${0.11 * glow})`);
        gr.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = gr;
        g.fillRect(x - r * 6.5, y - r * 6.5, r * 13, r * 13);
        g.globalCompositeOperation = "lighter";
        if (o.dust) dustPass(g, x, y, r, tilt, o.dust, true);
        disk(g, x, y, r, tilt, spin, true, glow);                       // the far half, behind the hole
        // the far side of the disk, bent by gravity up over the top and down under the bottom of the hole
        g.save();
        g.translate(x, y);
        const hc = g.createConicGradient(-Math.PI / 2 + Math.sin(t * 0.3) * 0.06, 0, 0);
        [[0, ".95"], [0.12, ".5"], [0.25, ".12"], [0.38, ".45"], [0.5, ".75"], [0.62, ".42"], [0.75, ".1"], [0.88, ".5"], [1, ".95"]]
            .forEach(([p, a]) => hc.addColorStop(p, `rgba(255,${p === 0 || p === 1 ? 236 : p === 0.5 ? 220 : 165},${p === 0 || p === 1 || p === 0.5 ? 190 : 90},${a})`));
        g.strokeStyle = hc;
        for (const [rr, w, a] of [[1.34, 0.36, 0.45], [1.2, 0.14, 0.9], [1.55, 0.24, 0.22]]) {
            g.globalAlpha = a * glow;
            g.lineWidth = r * w;
            g.beginPath();
            g.ellipse(0, 0, r * rr, r * rr * 0.93, 0, 0, TAU);
            g.stroke();
        }
        g.restore();
        g.globalAlpha = 1;
        g.globalCompositeOperation = "source-over";
        g.fillStyle = "#000";                                           // the event horizon
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
        g.fill();
        g.globalCompositeOperation = "lighter";
        g.strokeStyle = `rgba(255,240,215,${0.85 * glow})`;            // the photon ring
        g.lineWidth = Math.max(1, r * 0.035);
        g.beginPath();
        g.arc(x, y, r * 1.045, 0, TAU);
        g.stroke();
        disk(g, x, y, r, tilt, spin, false, glow);                      // the near half, in front of the hole
        if (o.dust) dustPass(g, x, y, r, tilt, o.dust, false);
        g.globalCompositeOperation = "source-over";
    }

    // Gas and dust spiralling down into the hole
    function makeDust(n) {
        return Array.from({ length: n }, () => ({ a: Math.random() * TAU, rad: U.rand(1.6, 6.5), sp: U.rand(0.5, 1.2), s: U.rand(0.6, 1.8) }));
    }
    function stepDust(dust, dt) {
        for (const d of dust) {
            d.a += d.sp * dt * 2.2 / d.rad;
            d.rad -= dt * 0.22 * (2.2 / d.rad);
            if (d.rad < 1.12) { d.rad = U.rand(4, 6.8); d.a = Math.random() * TAU; }
        }
    }
    function dustPass(g, x, y, r, tilt, dust, back) {
        for (const d of dust) {
            const sn = Math.sin(d.a);
            if ((sn < 0) !== back) continue;
            const k = U.clamp((d.rad - 1.5) / 5, 0, 1);
            g.fillStyle = `rgba(${diskRGB(k)},${(0.9 - k * 0.6).toFixed(2)})`;
            const px = x + Math.cos(d.a) * d.rad * r, py = y + sn * d.rad * r * tilt;
            g.fillRect(px, py, d.s, d.s);
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Pre-drawn pieces of the background
    // ---------------------------------------------------------------------------------------------
    function makeNebula(W, H, seed) {
        const c = document.createElement("canvas");
        c.width = Math.max(160, Math.round(W / 3));
        c.height = Math.max(110, Math.round(H / 3));
        const x = c.getContext("2d"), R = U.rng(seed);
        const cols = ["110,60,210", "40,110,230", "210,60,160", "40,190,210", "90,40,170", "230,90,120"];
        x.globalCompositeOperation = "lighter";
        for (let i = 0; i < 11; i++) {
            const cx = R() * c.width, cy = R() * c.height, rr = (0.18 + R() * 0.42) * Math.max(c.width, c.height);
            const gr = x.createRadialGradient(cx, cy, 0, cx, cy, rr), col = cols[i % cols.length];
            gr.addColorStop(0, `rgba(${col},${(0.14 + R() * 0.14).toFixed(2)})`);
            gr.addColorStop(0.45, `rgba(${col},${(0.05 + R() * 0.05).toFixed(2)})`);
            gr.addColorStop(1, `rgba(${col},0)`);
            x.fillStyle = gr;
            x.fillRect(0, 0, c.width, c.height);
        }
        x.globalCompositeOperation = "destination-out";                 // dark dust lanes
        for (let i = 0; i < 6; i++) {
            const cx = R() * c.width, cy = R() * c.height, rr = (0.08 + R() * 0.16) * c.width;
            const gr = x.createRadialGradient(cx, cy, 0, cx, cy, rr);
            gr.addColorStop(0, "rgba(0,0,0,.55)");
            gr.addColorStop(1, "rgba(0,0,0,0)");
            x.fillStyle = gr;
            x.fillRect(0, 0, c.width, c.height);
        }
        return c;
    }

    function makePlanet(pr) {
        const S = Math.ceil(pr * 4.2), c = document.createElement("canvas");
        c.width = c.height = S;
        const x = c.getContext("2d"), cx = S / 2, cy = S / 2;
        const ring = back => {
            x.save();
            x.translate(cx, cy);
            x.rotate(-0.36);
            x.scale(1, 0.27);
            for (const [rr, w, a] of [[1.32, 0.08, 0.35], [1.45, 0.12, 0.6], [1.6, 0.05, 0.25], [1.72, 0.1, 0.5], [1.86, 0.04, 0.25]]) {
                x.strokeStyle = `rgba(232,206,165,${a})`;
                x.lineWidth = pr * w / 0.27 * 0.27;
                x.beginPath();
                if (back) x.arc(0, 0, pr * rr, Math.PI, TAU); else x.arc(0, 0, pr * rr, 0, Math.PI);
                x.stroke();
            }
            x.restore();
        };
        ring(true);
        x.save();
        x.beginPath();
        x.arc(cx, cy, pr, 0, TAU);
        x.clip();
        const bands = ["#c98b5b", "#e6b98a", "#b8744a", "#f0d2a8", "#a5653f", "#d9a274", "#8f5636", "#e8c49a", "#c47e52"];
        for (let y = -pr; y < pr; y += 2) {
            const k = (y + pr) / (2 * pr);
            const i = Math.abs(Math.floor(k * 9 + Math.sin(k * 23) * 0.6 + Math.sin(k * 61) * 0.25)) % bands.length;
            x.fillStyle = bands[i];
            x.fillRect(cx - pr, cy + y, pr * 2, 2.6);
        }
        x.fillStyle = "rgba(170,70,50,.85)";                           // a storm
        x.beginPath();
        x.ellipse(cx + pr * 0.28, cy + pr * 0.28, pr * 0.2, pr * 0.09, 0.05, 0, TAU);
        x.fill();
        x.strokeStyle = "rgba(255,230,200,.35)";
        x.lineWidth = pr * 0.02;
        x.beginPath();
        x.ellipse(cx + pr * 0.28, cy + pr * 0.28, pr * 0.14, pr * 0.05, 0.05, 0, TAU);
        x.stroke();
        const sh = x.createRadialGradient(cx - pr * 0.45, cy - pr * 0.45, pr * 0.1, cx, cy, pr * 1.12);
        sh.addColorStop(0, "rgba(255,255,255,.28)");
        sh.addColorStop(0.5, "rgba(0,0,0,0)");
        sh.addColorStop(1, "rgba(0,0,12,.9)");
        x.fillStyle = sh;
        x.fillRect(cx - pr, cy - pr, pr * 2, pr * 2);
        x.restore();
        x.strokeStyle = "rgba(255,210,170,.25)";                      // a thin atmosphere
        x.lineWidth = pr * 0.05;
        x.beginPath();
        x.arc(cx, cy, pr * 1.01, Math.PI * 0.9, Math.PI * 1.8);
        x.stroke();
        ring(false);
        return c;
    }

    // ---------------------------------------------------------------------------------------------
    // The background scene
    // ---------------------------------------------------------------------------------------------
    // ---------------------------------------------------------------------------------------------
    // Light mode: the solar system in full sunlight. A huge sun with a boiling surface, corona streamers and
    // solar flares looping off its edge; planets on their orbits (each lit on the side facing the sun), an
    // asteroid belt, comets whose tails always point away from the sun, and a lens flare across the sky.
    // ---------------------------------------------------------------------------------------------
    function sunScene(W, H, opts) {
        const preview = !!opts.preview;
        let sx, sy, sr, surface, glow, bgGrad, stars, belt, planets, ringed;
        let flares = [], nextFlare = 0.5, comet = null, nextComet = preview ? 999 : U.rand(4, 9);

        function setup() {
            const m = Math.min(W, H), R = U.rng(1601);
            sr = preview ? m * 0.2 : U.clamp(m * 0.13, 40, 150);
            sx = preview ? W * 0.72 : W < 760 ? W * 0.82 : W * 0.8;
            sy = preview ? H * 0.42 : W < 760 ? H * 0.12 : H * 0.24;
            // the sun's surface: granules (hot cells) and darker sunspots, darker toward the edge
            surface = document.createElement("canvas");
            surface.width = surface.height = Math.ceil(sr * 2);
            const x = surface.getContext("2d"), c = sr;
            const base = x.createRadialGradient(c, c, 0, c, c, sr);
            base.addColorStop(0, "#fffbe6");
            base.addColorStop(0.55, "#ffe08a");
            base.addColorStop(0.85, "#ffb23e");
            base.addColorStop(1, "#ff8a1f");
            x.fillStyle = base;
            x.beginPath(); x.arc(c, c, sr, 0, TAU); x.fill();
            x.save();
            x.beginPath(); x.arc(c, c, sr, 0, TAU); x.clip();
            for (let i = 0; i < (preview ? 160 : 700); i++) {
                const a = R() * TAU, d = Math.sqrt(R()) * sr, gr = sr * (0.02 + R() * 0.035);
                x.fillStyle = R() < 0.5 ? "rgba(255,255,230,.35)" : "rgba(230,120,20,.18)";
                x.beginPath(); x.arc(c + Math.cos(a) * d, c + Math.sin(a) * d, gr, 0, TAU); x.fill();
            }
            for (const [dx, dy, s] of [[-0.3, 0.2, 0.07], [-0.22, 0.26, 0.04], [0.35, -0.3, 0.05]]) {
                x.fillStyle = "rgba(120,50,10,.55)";
                x.beginPath(); x.arc(c + dx * sr, c + dy * sr, s * sr, 0, TAU); x.fill();
                x.fillStyle = "rgba(180,80,20,.35)";
                x.beginPath(); x.arc(c + dx * sr, c + dy * sr, s * sr * 1.8, 0, TAU); x.fill();
            }
            x.restore();
            glow = null;
            bgGrad = null;
            stars = Array.from({ length: preview ? 25 : 90 }, () => ({ x: R() * W, y: R() * H, r: 0.6 + R() * 1.2, tw: R() * TAU }));
            belt = Array.from({ length: preview ? 50 : 220 }, () => ({ a: R() * TAU, d: 3.15 + R() * 0.35, s: 0.6 + R() * 1.6, sp: 0.02 + R() * 0.02 }));
            // [orbit radius (in sun radii), size, speed, colours, has a moon]
            planets = [
                { o: 1.7, s: 0.09, sp: 0.5, c: ["#d9cfc4", "#8f8478"], a: R() * TAU },
                { o: 2.3, s: 0.14, sp: 0.32, c: ["#ffe2b8", "#c8875a"], a: R() * TAU },
                { o: 2.85, s: 0.15, sp: 0.24, c: ["#9fd8ff", "#2f6fb8"], a: R() * TAU, moon: true },
                { o: 4.2, s: 0.27, sp: 0.1, c: ["#f2d0a6", "#b37446"], a: R() * TAU, rings: true },
                { o: 5.3, s: 0.18, sp: 0.07, c: ["#c7f1f5", "#4aa3b8"], a: R() * TAU }
            ];
            ringed = makePlanet(Math.max(6, sr * 0.27));
        }
        setup();

        const orbitY = 0.32;                                  // the orbits are seen from above at a slant
        function orbitPoint(o, a) { return [sx + Math.cos(a) * sr * o, sy + Math.sin(a) * sr * o * orbitY]; }

        function drawPlanet(g, p, x, y) {
            const r = sr * p.s;
            if (p.rings) { g.drawImage(ringed, x - ringed.width / 2, y - ringed.height / 2); return; }
            // lit on the side facing the sun
            const ang = Math.atan2(sy - y, sx - x);
            const gr = g.createRadialGradient(x + Math.cos(ang) * r * 0.45, y + Math.sin(ang) * r * 0.45, r * 0.1, x, y, r * 1.1);
            gr.addColorStop(0, p.c[0]);
            gr.addColorStop(1, p.c[1]);
            g.fillStyle = gr;
            g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        }

        return {
            resize(w, h) { W = w; H = h; setup(); },
            draw(g, t, dt, inp) {
                const px = sx - inp.px * 10, py = sy - inp.py * 8;
                if (!bgGrad) {
                    bgGrad = g.createRadialGradient(sx, sy, sr, sx, sy, Math.hypot(W, H));
                    bgGrad.addColorStop(0, "#fff6dc");
                    bgGrad.addColorStop(0.25, "#fde8d6");
                    bgGrad.addColorStop(0.6, "#e6dcf6");
                    bgGrad.addColorStop(1, "#c9cdf0");
                }
                g.fillStyle = bgGrad;
                g.fillRect(0, 0, W, H);
                for (const s of stars) {                      // faint stars, washed out by the sunlight
                    g.fillStyle = `rgba(110,100,170,${(0.15 + 0.2 * Math.abs(Math.sin(t * 0.9 + s.tw))).toFixed(2)})`;
                    g.fillRect(s.x - inp.px * 4, s.y - inp.py * 3, s.r, s.r);
                }
                // orbit lines
                g.strokeStyle = "rgba(120,100,180,.22)";
                g.lineWidth = 1;
                for (const p of planets) { g.beginPath(); g.ellipse(px, py, sr * p.o, sr * p.o * orbitY, 0, 0, TAU); g.stroke(); }
                // planets behind the sun (the top half of their orbits)
                const placed = planets.map(p => { p.a += p.sp * dt * 0.4; const [x, y] = orbitPoint(p.o, p.a); return { p, x: x - inp.px * 10, y: y - inp.py * 8 }; });
                for (const q of placed) if (Math.sin(q.p.a) < 0) drawPlanet(g, q.p, q.x, q.y);
                // the asteroid belt
                g.fillStyle = "rgba(120,95,80,.55)";
                for (const b of belt) {
                    b.a += b.sp * dt;
                    const [x, y] = orbitPoint(b.d, b.a);
                    g.fillRect(x - inp.px * 10, y - inp.py * 8, b.s, b.s);
                }
                // the corona: a big soft glow and slowly turning streamers
                if (!glow) {
                    glow = g.createRadialGradient(px, py, sr * 0.9, px, py, sr * 4);
                    glow.addColorStop(0, "rgba(255,230,150,.75)");
                    glow.addColorStop(0.35, "rgba(255,200,120,.25)");
                    glow.addColorStop(1, "rgba(255,190,120,0)");
                }
                g.save();
                g.translate(px - sx, py - sy);
                g.fillStyle = glow;
                g.fillRect(sx - sr * 4, sy - sr * 4, sr * 8, sr * 8);
                g.restore();
                g.globalCompositeOperation = "lighter";
                for (let i = 0; i < 14; i++) {
                    const a = i / 14 * TAU + t * 0.03 * (i % 2 ? 1 : -1), len = sr * (1.9 + 0.5 * Math.sin(t * 0.7 + i * 1.7)), w = 0.07 + 0.03 * Math.sin(t + i);
                    const gr = g.createLinearGradient(px, py, px + Math.cos(a) * len, py + Math.sin(a) * len);
                    gr.addColorStop(0.45, "rgba(255,220,140,.32)");
                    gr.addColorStop(1, "rgba(255,220,140,0)");
                    g.fillStyle = gr;
                    g.beginPath();
                    g.moveTo(px + Math.cos(a - w) * sr * 0.9, py + Math.sin(a - w) * sr * 0.9);
                    g.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len);
                    g.lineTo(px + Math.cos(a + w) * sr * 0.9, py + Math.sin(a + w) * sr * 0.9);
                    g.fill();
                }
                g.globalCompositeOperation = "source-over";
                // the sun itself, its surface slowly turning and breathing
                g.save();
                g.translate(px, py);
                g.rotate(t * 0.02);
                const pulse = 1 + Math.sin(t * 1.3) * 0.006;
                g.drawImage(surface, -sr * pulse, -sr * pulse, sr * 2 * pulse, sr * 2 * pulse);
                g.restore();
                // solar flares: glowing loops that rise off the edge and fade
                nextFlare -= dt;
                if (nextFlare <= 0) { nextFlare = U.rand(1.2, 3); flares.push({ a: U.rand(0, TAU), w: U.rand(0.12, 0.3), h: U.rand(0.25, 0.6), life: U.rand(2.2, 3.6), age: 0 }); }
                g.globalCompositeOperation = "lighter";
                flares = flares.filter(f => (f.age += dt) < f.life);
                for (const f of flares) {
                    const k = f.age / f.life, grow = Math.min(1, k * 3), fade = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
                    const a1 = f.a - f.w, a2 = f.a + f.w, top = sr * (1 + f.h * grow);
                    g.strokeStyle = `rgba(255,120,40,${(0.75 * fade).toFixed(2)})`;
                    g.lineWidth = sr * 0.035;
                    g.lineCap = "round";
                    g.beginPath();
                    g.moveTo(px + Math.cos(a1) * sr * 0.98, py + Math.sin(a1) * sr * 0.98);
                    g.bezierCurveTo(px + Math.cos(a1) * top, py + Math.sin(a1) * top, px + Math.cos(a2) * top, py + Math.sin(a2) * top, px + Math.cos(a2) * sr * 0.98, py + Math.sin(a2) * sr * 0.98);
                    g.stroke();
                    g.strokeStyle = `rgba(255,220,150,${(0.5 * fade).toFixed(2)})`;
                    g.lineWidth = sr * 0.012;
                    g.stroke();
                }
                g.globalCompositeOperation = "source-over";
                // planets in front of the sun (the bottom half of their orbits), with a moon around the blue one
                for (const q of placed) {
                    if (Math.sin(q.p.a) < 0) continue;
                    drawPlanet(g, q.p, q.x, q.y);
                    if (q.p.moon) { const ma = t * 1.4; g.fillStyle = "#d8d4e8"; g.beginPath(); g.arc(q.x + Math.cos(ma) * sr * 0.3, q.y + Math.sin(ma) * sr * 0.1, sr * 0.035, 0, TAU); g.fill(); }
                }
                // a comet now and then; its tail always points away from the sun
                nextComet -= dt;
                if (!comet && nextComet <= 0) comet = { x: -40, y: U.rand(0.35, 0.8) * H, vx: U.rand(90, 140), vy: -U.rand(10, 40) };
                if (comet) {
                    comet.x += comet.vx * dt; comet.y += comet.vy * dt;
                    const away = Math.atan2(comet.y - sy, comet.x - sx), len = 140;
                    const tg = g.createLinearGradient(comet.x, comet.y, comet.x + Math.cos(away) * len, comet.y + Math.sin(away) * len);
                    tg.addColorStop(0, "rgba(120,170,255,.7)");
                    tg.addColorStop(1, "rgba(120,170,255,0)");
                    g.strokeStyle = tg;
                    g.lineWidth = 5;
                    g.lineCap = "round";
                    g.beginPath(); g.moveTo(comet.x, comet.y); g.lineTo(comet.x + Math.cos(away) * len, comet.y + Math.sin(away) * len); g.stroke();
                    g.fillStyle = "#ffffff";
                    g.beginPath(); g.arc(comet.x, comet.y, 3.2, 0, TAU); g.fill();
                    if (comet.x > W + 60 || comet.y < -60) { comet = null; nextComet = U.rand(10, 20); }
                }
                // a lens flare: soft rings on the line from the sun through the middle of the screen
                if (!preview) {
                    g.globalCompositeOperation = "lighter";
                    const cx = W / 2 + inp.px * 30, cy = H / 2 + inp.py * 20;
                    [[0.5, 0.12, "255,190,120"], [0.9, 0.05, "170,140,255"], [1.25, 0.2, "255,170,200"], [1.6, 0.08, "140,200,255"]].forEach(([k, s, col]) => {
                        const fx = px + (cx - px) * k * 2, fy = py + (cy - py) * k * 2, fr = sr * s * 2;
                        const fg = g.createRadialGradient(fx, fy, 0, fx, fy, fr);
                        fg.addColorStop(0, `rgba(${col},.18)`);
                        fg.addColorStop(0.7, `rgba(${col},.08)`);
                        fg.addColorStop(1, `rgba(${col},0)`);
                        g.fillStyle = fg;
                        g.beginPath(); g.arc(fx, fy, fr, 0, TAU); g.fill();
                    });
                    g.globalCompositeOperation = "source-over";
                }
            }
        };
    }

    function scene(W, H, opts) {
        if (opts.theme === "light") return sunScene(W, H, opts);
        const preview = !!opts.preview;
        let stars, neb, planet, pr, pp, bh, dust, bgGrad, moonR;
        let shooters = [], nextShoot = 2, sat = null, nextSat = preview ? 999 : U.rand(6, 14);

        function setup() {
            const R = U.rng(424242);
            const n = Math.min(preview ? 170 : 700, Math.round(W * H / 2400));
            stars = Array.from({ length: n }, (_, i) => {
                const layer = i % 3, kind = R();
                return {
                    x: R() * W, y: R() * H, layer, tw: R() * TAU, ts: 0.6 + R() * 2.4,
                    r: [0.7, 1.05, 1.6][layer] * (0.7 + R() * 0.7), sp: [2, 5, 11][layer],
                    c: kind < 0.7 ? "255,255,255" : kind < 0.86 ? "175,205,255" : "255,222,185"
                };
            });
            neb = makeNebula(W, H, 77);
            const m = Math.min(W, H);
            if (preview) bh = { x: W * 0.68, y: H * 0.56, r: m * 0.12 };
            else if (W < 760) bh = { x: W * 0.8, y: H * 0.14, r: U.clamp(m * 0.08, 22, 52) };
            else bh = { x: W * 0.83, y: H * 0.7, r: U.clamp(m * 0.075, 30, 95) };
            dust = makeDust(preview ? 60 : 150);
            pr = U.clamp(m * (preview ? 0.13 : 0.07), 18, 86);
            pp = preview ? { x: W * 0.2, y: H * 0.3 } : W < 760 ? { x: W * 0.14, y: H * 0.1 } : { x: W * 0.12, y: H * 0.22 };
            planet = makePlanet(pr);
            moonR = pr * 0.17;
            bgGrad = null;
        }
        setup();

        function drawMoon(g, x, y) {
            const gr = g.createRadialGradient(x - moonR * 0.4, y - moonR * 0.4, moonR * 0.1, x, y, moonR);
            gr.addColorStop(0, "#e9e7f2");
            gr.addColorStop(1, "#5d5a6e");
            g.fillStyle = gr;
            g.beginPath();
            g.arc(x, y, moonR, 0, TAU);
            g.fill();
            g.fillStyle = "rgba(60,58,75,.45)";
            g.beginPath();
            g.arc(x + moonR * 0.25, y - moonR * 0.1, moonR * 0.25, 0, TAU);
            g.arc(x - moonR * 0.3, y + moonR * 0.35, moonR * 0.16, 0, TAU);
            g.fill();
        }

        function drawSatellite(g, s) {
            g.save();
            g.translate(s.x, s.y);
            g.rotate(s.rot);
            g.fillStyle = "#c9cfdf";
            g.fillRect(-6, -4, 12, 8);
            g.fillStyle = "#2a5bd7";
            for (const side of [-1, 1]) {
                g.fillRect(side * 8 + (side < 0 ? -16 : 0), -5, 16, 10);
                g.strokeStyle = "rgba(160,200,255,.6)";
                g.lineWidth = 0.6;
                for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(side * 8 + (side < 0 ? -16 : 0) + i * 4, -5); g.lineTo(side * 8 + (side < 0 ? -16 : 0) + i * 4, 5); g.stroke(); }
            }
            g.strokeStyle = "#c9cfdf";
            g.beginPath(); g.moveTo(0, -4); g.lineTo(0, -10); g.stroke();
            if (Math.sin(s.t * 6) > 0.6) { g.fillStyle = "#ff4d5e"; g.beginPath(); g.arc(0, -11, 1.6, 0, TAU); g.fill(); }
            g.restore();
        }

        return {
            resize(w, h) { W = w; H = h; setup(); },
            draw(g, t, dt, inp) {
                if (!bgGrad) {
                    bgGrad = g.createLinearGradient(0, 0, 0, H);
                    bgGrad.addColorStop(0, "#04020c");
                    bgGrad.addColorStop(0.6, "#0a0620");
                    bgGrad.addColorStop(1, "#130830");
                }
                g.fillStyle = bgGrad;
                g.fillRect(0, 0, W, H);
                // nebulae, drifting slowly
                g.globalAlpha = 0.95;
                g.drawImage(neb, -W * 0.06 - inp.px * 14 + Math.sin(t * 0.05) * 22, -H * 0.06 - inp.py * 10 + Math.cos(t * 0.04) * 14, W * 1.12, H * 1.12);
                g.globalAlpha = 1;
                // stars, with parallax, twinkling, and lensing around the black hole
                const par = [5, 12, 26], E = bh.r * 2.3;
                const bx = bh.x - inp.px * 8, by = bh.y - inp.py * 8;
                g.globalCompositeOperation = "lighter";
                for (const s of stars) {
                    s.x -= s.sp * dt;
                    if (s.x < -30) s.x += W + 60;
                    let x = s.x - inp.px * par[s.layer], y = s.y - inp.py * par[s.layer];
                    const tw = 0.55 + 0.45 * Math.sin(t * s.ts + s.tw);
                    const a = (0.3 + 0.7 * tw) * [0.45, 0.72, 1][s.layer];
                    const dx = x - bx, dy = y - by, d = Math.hypot(dx, dy) || 0.001;
                    if (d < E * 4.5) {
                        const root = Math.sqrt(d * d + 4 * E * E);
                        const th = (d + root) / 2, u = d / E;
                        const mag = (u * u + 2) / (u * Math.sqrt(u * u + 4));
                        const ang = Math.atan2(dy, dx);
                        if (mag > 1.3) {                                   // smeared into an arc around the hole
                            const span = Math.min(1.1, (mag - 1) * s.r * 5 / th);
                            g.strokeStyle = `rgba(${s.c},${Math.min(1, a * (0.6 + mag * 0.2)).toFixed(2)})`;
                            g.lineWidth = s.r * 1.15;
                            g.lineCap = "round";
                            g.beginPath();
                            g.arc(bx, by, th, ang - span / 2, ang + span / 2);
                            g.stroke();
                        } else {
                            x = bx + (dx / d) * th;
                            y = by + (dy / d) * th;
                            g.fillStyle = `rgba(${s.c},${a.toFixed(2)})`;
                            g.fillRect(x - s.r / 2, y - s.r / 2, s.r, s.r);
                        }
                        const th2 = (d - root) / 2;                        // the second image, on the far side
                        if (-th2 > bh.r * 1.1) {
                            g.fillStyle = `rgba(${s.c},${(a * 0.55).toFixed(2)})`;
                            g.fillRect(bx + (dx / d) * th2 - s.r * 0.4, by + (dy / d) * th2 - s.r * 0.4, s.r * 0.8, s.r * 0.8);
                        }
                        continue;
                    }
                    g.fillStyle = `rgba(${s.c},${a.toFixed(2)})`;
                    if (s.layer === 2 && tw > 0.9) {                       // the brightest stars get a little glint, and a glow
                        g.fillRect(x - s.r * 2.5, y - 0.4, s.r * 5, 0.8);
                        g.fillRect(x - 0.4, y - s.r * 2.5, 0.8, s.r * 5);
                        Worlds.glow(g, x, y, s.r * 7, `rgb(${s.c})`, (tw - 0.9) * 6);
                        g.fillStyle = `rgba(${s.c},${a.toFixed(2)})`;
                    }
                    g.beginPath();
                    g.arc(x, y, s.r * 0.6, 0, TAU);
                    g.fill();
                }
                g.globalCompositeOperation = "source-over";
                // the gas giant and its moon (the moon passes behind and in front)
                const px = pp.x - inp.px * 18, py = pp.y - inp.py * 14 + Math.sin(t * 0.3) * 4;
                const ma = t * 0.22, mx = px + Math.cos(ma) * pr * 2.5, my = py + Math.sin(ma) * pr * 0.55;
                if (Math.sin(ma) < 0) drawMoon(g, mx, my);
                g.drawImage(planet, px - planet.width / 2, py - planet.height / 2);
                if (Math.sin(ma) >= 0) drawMoon(g, mx, my);
                // a satellite drifting across now and then
                if (!preview) {
                    nextSat -= dt;
                    if (!sat && nextSat <= 0) sat = { x: -40, y: U.rand(H * 0.08, H * 0.35), vx: U.rand(28, 45), rot: U.rand(-0.4, 0.4), vr: U.rand(-0.15, 0.15), t: 0 };
                    if (sat) {
                        sat.t += dt; sat.x += sat.vx * dt; sat.rot += sat.vr * dt;
                        drawSatellite(g, sat);
                        if (sat.x > W + 40) { sat = null; nextSat = U.rand(18, 30); }
                    }
                }
                // shooting stars
                nextShoot -= dt;
                if (nextShoot <= 0) {
                    nextShoot = U.rand(2.5, 7);
                    const a = U.rand(0.35, 0.75) * (Math.random() < 0.5 ? 1 : -1) + (Math.random() < 0.5 ? 0 : Math.PI);
                    shooters.push({ x: U.rand(0.1, 0.9) * W, y: U.rand(0, 0.45) * H, vx: Math.cos(a) * 700, vy: Math.abs(Math.sin(a)) * 420, life: U.rand(0.5, 0.9), age: 0 });
                }
                g.globalCompositeOperation = "lighter";
                shooters = shooters.filter(s => (s.age += dt) < s.life);
                for (const s of shooters) {
                    s.x += s.vx * dt; s.y += s.vy * dt;
                    const k = 1 - s.age / s.life, len = 0.16;
                    const gr = g.createLinearGradient(s.x, s.y, s.x - s.vx * len, s.y - s.vy * len);
                    gr.addColorStop(0, `rgba(255,255,255,${k})`);
                    gr.addColorStop(1, "rgba(150,200,255,0)");
                    g.strokeStyle = gr;
                    g.lineWidth = 2;
                    g.beginPath();
                    g.moveTo(s.x, s.y);
                    g.lineTo(s.x - s.vx * len, s.y - s.vy * len);
                    g.stroke();
                }
                g.globalCompositeOperation = "source-over";
                // the black hole
                stepDust(dust, dt);
                drawBlackHole(g, bx, by, bh.r, t, { dust });
            }
        };
    }

    // ---------------------------------------------------------------------------------------------
    // The board: holographic squares; finished words become constellations
    // ---------------------------------------------------------------------------------------------
    const board = (() => {
        let layer = null, stars = new Map(), seed = 1;
        const rnd = (...k) => { let h = seed; for (const v of k) { h = Math.imul(h ^ v, 2654435761); h ^= h >>> 13; } return (h >>> 0) / 4294967296; };
        // each square's star sits at a random (but fixed) spot around its letter
        function spot(r, c) {
            const a = rnd(r, c, 1) * TAU, d = 0.3 + rnd(r, c, 2) * 0.1;
            return [c + 0.5 + Math.cos(a) * d, r + 0.52 + Math.sin(a) * d];
        }
        function update(game, boardEl) {
            const size = game.puzzle.size;
            if (!layer || !boardEl.contains(layer)) {
                layer = U.svg("svg", { class: "space-const", viewBox: `0 0 ${size} ${size}`, preserveAspectRatio: "none", "aria-hidden": "true" });
                boardEl.appendChild(layer);
                stars = new Map();
                seed = U.hash(game.puzzle.seed + game.puzzle.mode);
            }
            const filled = (r, c) => game.letters[r][c] !== "";
            const full = new Set();
            for (const entry of [...game.puzzle.across, ...game.puzzle.down]) {
                const cells = Game.cellsOf(entry);
                if (!cells.every(([r, c]) => filled(r, c))) continue;
                const key = entry.direction + entry.number;
                full.add(key);
                if (stars.has(key)) continue;
                const pts = cells.map(([r, c]) => spot(r, c));
                const gEl = U.svg("g", { class: "const grow" }, layer);
                U.svg("polyline", { points: pts.map(p => p.join(",")).join(" "), pathLength: 1, class: "const-line" }, gEl);
                pts.forEach(([x, y], i) => {
                    const st = U.svg("g", { transform: `translate(${x} ${y})` }, gEl);
                    U.svg("path", { d: "M0,-.09 L.02,-.02 L.09,0 L.02,.02 L0,.09 L-.02,.02 L-.09,0 L-.02,-.02Z", class: "const-star", style: `animation-delay:${(0.12 + i * 0.07).toFixed(2)}s` }, st);
                });
                stars.set(key, gEl);
            }
            for (const [key, node] of stars) if (!full.has(key)) { node.remove(); stars.delete(key); }
        }
        function type(cell) {
            const c = U.center(cell);
            FX.burst({ x: c.x, y: c.y, n: 10, colors: ["#7ffbff", "#ffffff", "#b48cff"], shape: "spark", speed: [60, 170], gravity: 0, drag: 3, life: [0.25, 0.5], size: [1.2, 2.2], glow: true });
        }
        function wordDone(entry, cells, boardEl) {
            cells.forEach(([r, c], i) => setTimeout(() => {
                const cell = Game.cellEl(r, c);
                if (!cell) return;
                const p = U.center(cell);
                FX.ring({ x: p.x, y: p.y, color: "#7ffbff", r0: 4, r1: p.w * 0.7, dur: 0.5, width: 3 });
            }, i * 55));
        }
        function clear() { if (layer) layer.remove(); layer = null; stars = new Map(); }
        return { update, type, wordDone, clear };
    })();

    // ---------------------------------------------------------------------------------------------
    // The win: a black hole swallows the board, then a supernova and a warp jump bring it back
    // ---------------------------------------------------------------------------------------------
    async function celebrate(c, { boardEl }) {
        if (U.motion() === "still") return;
        const W = innerWidth, H = innerHeight, cx = W / 2, cy = H / 2;
        const b = U.center(boardEl);
        boardEl.classList.add("sp-charge");
        c.cleanup(() => boardEl.classList.remove("sp-charge"));
        Sound.play("rumble");
        await c.wait(650);
        if (c.skipped) return;

        // the black hole opens in the middle of the screen, pulling glowing debris from every square
        const hole = { r: 0, target: Math.min(W, H) * 0.09, t: 0, phase: "grow", alive: true, dust: makeDust(110), debris: [] };
        for (const cell of Game.openCells()) {
            const p = U.center(cell);
            for (let i = 0; i < 5; i++) {
                const dx = p.x + U.rand(-p.w / 2, p.w / 2) - cx, dy = p.y + U.rand(-p.h / 2, p.h / 2) - cy;
                hole.debris.push({ a: Math.atan2(dy, dx), d: Math.hypot(dx, dy), s: U.rand(1.5, 3.5), c: U.pick(["#7ffbff", "#b48cff", "#ffffff", "#ffd27a"]), delay: U.rand(0, 0.9) });
            }
        }
        FX.add({
            update(dt) {
                hole.t += dt;
                if (hole.phase === "grow") hole.r += (hole.target - hole.r) * Math.min(1, dt * 2.6);
                if (hole.phase === "collapse") { hole.r *= Math.pow(0.002, dt); if (hole.r < 0.6) return false; }
                stepDust(hole.dust, dt * 2.5);
                for (const d of hole.debris) {
                    if (hole.t < d.delay) continue;
                    d.a += dt * (260 / Math.max(30, d.d));
                    d.d = Math.max(0, d.d - dt * (60 + 9000 / Math.max(40, d.d)));
                }
                return hole.alive;
            },
            draw(g) {
                g.fillStyle = `rgba(2,0,10,${Math.min(0.78, hole.t * 0.7)})`;
                g.fillRect(0, 0, W, H);
                g.globalCompositeOperation = "lighter";
                for (const d of hole.debris) {
                    if (d.d < hole.r * 1.05) continue;
                    g.fillStyle = d.c;
                    g.globalAlpha = Math.min(1, d.d / 120);
                    g.fillRect(cx + Math.cos(d.a) * d.d, cy + Math.sin(d.a) * d.d * 0.75, d.s, d.s);
                }
                g.globalAlpha = 1;
                g.globalCompositeOperation = "source-over";
                drawBlackHole(g, cx, cy, hole.r, hole.t * 2.4, { tilt: 0.3, spin: 1.5, glow: 1.25, dust: hole.dust });
            }
        });
        c.cleanup(() => { hole.alive = false; });
        const swallow = boardEl.animate([
            { transform: "none", filter: "none" },
            { transform: `translate(${(cx - b.x) * 0.4}px, ${(cy - b.y) * 0.4}px) rotate(90deg) scale(.75)`, filter: "brightness(1.4)", offset: 0.45 },
            { transform: `translate(${cx - b.x}px, ${cy - b.y}px) rotate(560deg) scale(0)`, filter: "brightness(2.2) blur(2px)" }
        ], { duration: 1600, delay: 450, easing: "cubic-bezier(.5,0,.85,.4)", fill: "forwards" });
        c.cleanup(() => swallow.cancel());
        await c.wait(2150);
        if (c.skipped) return;

        // collapse... and a supernova
        hole.phase = "collapse";
        Sound.play("implode");
        await c.wait(380);
        if (c.skipped) return;
        FX.flash("#eaf6ff", 700, 0.95);
        Sound.play("supernova");
        FX.shake(16, 600);
        const R = Math.hypot(W, H) * 0.62;
        FX.ring({ x: cx, y: cy, color: "#7ffbff", r1: R, dur: 1.1, width: 28 });
        FX.ring({ x: cx, y: cy, color: "#c9a0ff", r1: R * 0.8, dur: 1.4, width: 16 });
        FX.ring({ x: cx, y: cy, color: "#ffd27a", r1: R * 0.55, dur: 1.6, width: 8 });
        FX.burst({ x: cx, y: cy, n: 240, colors: ["#ffffff", "#7ffbff", "#b48cff", "#ffd27a"], shape: "spark", speed: [250, 1200], gravity: 0, drag: 0.8, life: [0.8, 1.9], size: [1.5, 3.2], glow: true });
        FX.burst({ x: cx, y: cy, n: 46, colors: ["#ffffff", "#ffd27a", "#7ffbff"], shape: "star", speed: [150, 650], gravity: 0, drag: 1, life: [1.2, 2.2], size: [4, 10], glow: true, spin: 3 });
        // the warp jump: stars streak out from the middle
        const streaks = Array.from({ length: 260 }, () => ({ a: Math.random() * TAU, d: U.rand(0, 1), sp: U.rand(0.5, 1.6) }));
        let wt = 0;
        FX.add({
            fixed: true,                                        // full-screen warp streaks
            update: dt => (wt += dt) < 1.8,
            draw(g) {
                const k = wt / 1.8, fade = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85, Rr = Math.hypot(W, H) / 2;
                g.globalCompositeOperation = "lighter";
                for (const s of streaks) {
                    const d = ((s.d + wt * s.sp * 0.9) % 1) * Rr, len = 30 + 220 * s.sp * fade;
                    g.strokeStyle = `rgba(170,225,255,${(0.7 * fade).toFixed(2)})`;
                    g.lineWidth = 1 + s.sp;
                    g.beginPath();
                    g.moveTo(cx + Math.cos(s.a) * d, cy + Math.sin(s.a) * d);
                    g.lineTo(cx + Math.cos(s.a) * (d + len), cy + Math.sin(s.a) * (d + len));
                    g.stroke();
                }
                g.globalCompositeOperation = "source-over";
            }
        });
        swallow.cancel();
        boardEl.animate([
            { transform: "scale(.15) rotate(-140deg)", opacity: 0, filter: "brightness(3)" },
            { transform: "scale(1.07) rotate(4deg)", opacity: 1, filter: "brightness(1.6)", offset: 0.65 },
            { transform: "none", opacity: 1, filter: "none" }
        ], { duration: 1000, easing: "cubic-bezier(.2,.8,.3,1)" });
        await c.wait(1500);
    }

    // ---------------------------------------------------------------------------------------------
    // Title card: an incoming transmission
    // ---------------------------------------------------------------------------------------------
    async function titleCard(c, info) {
        const card = U.el("div", { class: "tc tc-space", "aria-hidden": "true", html: `
            <div class="tcs-scan"></div>
            <div class="tcs-frame">
                <i class="tcs-c tl"></i><i class="tcs-c tr"></i><i class="tcs-c bl"></i><i class="tcs-c br"></i>
                <div class="tcs-line">&#9656; INCOMING TRANSMISSION</div>
                <div class="tcs-title">${U.esc(info.title)}</div>
                <div class="tcs-sub">${U.esc(info.sub)}</div>
                <div class="tcs-bar"><i></i></div>
                <div class="tcs-line dim">STARDATE ${U.esc(info.stardate)} &middot; SIGNAL LOCKED</div>
            </div>` });
        document.getElementById("overlay").appendChild(card);
        c.cleanup(() => card.remove());
        Sound.play("title");
        await c.wait(1750);
        if (c.skipped) return;
        card.classList.add("out");
        Sound.play("whoosh");
        await c.wait(420);
    }

    // ---------------------------------------------------------------------------------------------
    // The mascot: Nova, a little robot astronaut
    // ---------------------------------------------------------------------------------------------
    function drawNova(g, s) {
        const bob = Math.sin(s.t * 2.1) * 4 - s.hop * 10;
        g.save();
        g.translate(80, 82 + bob);
        // jet flame
        const fl = 1 + Math.sin(s.t * 30) * 0.15 + s.excite * 0.6;
        const fg = g.createLinearGradient(0, 40, 0, 40 + 26 * fl);
        fg.addColorStop(0, "rgba(255,255,255,.95)");
        fg.addColorStop(0.3, "rgba(127,251,255,.85)");
        fg.addColorStop(1, "rgba(124,92,255,0)");
        g.fillStyle = fg;
        g.beginPath();
        g.moveTo(-9, 40); g.quadraticCurveTo(0, 40 + 34 * fl, 9, 40); g.closePath();
        g.fill();
        // body
        g.lineWidth = 3;
        g.strokeStyle = "#1d2340";
        g.fillStyle = "#e8ecff";
        g.beginPath(); g.roundRect(-24, 6, 48, 36, 14); g.fill(); g.stroke();
        const pulse = 0.5 + 0.5 * Math.sin(s.t * 3);
        g.fillStyle = `rgba(41,230,255,${0.5 + pulse * 0.5})`;
        g.beginPath(); g.arc(0, 24, 6, 0, TAU); g.fill();
        g.fillStyle = "#ff4d8d"; g.fillRect(-15, 16, 6, 4); g.fillStyle = "#ffd166"; g.fillRect(-15, 23, 6, 4);
        // arms (they wave when it's happy)
        const wave = s.mood === "happy" || s.mood === "wow" ? Math.sin(s.t * 9) * 0.5 : 0.15;
        for (const side of [-1, 1]) {
            g.save();
            g.translate(side * 24, 16);
            g.rotate(side * (0.5 + (side > 0 ? wave : 0)));
            g.fillStyle = "#e8ecff";
            g.beginPath(); g.roundRect(-5, -4, 10, 22, 5); g.fill(); g.stroke();
            g.restore();
        }
        // helmet
        const hg = g.createRadialGradient(-12, -32, 4, 0, -18, 38);
        hg.addColorStop(0, "#ffffff");
        hg.addColorStop(1, "#c3cbff");
        g.fillStyle = hg;
        g.beginPath(); g.arc(0, -18, 34, 0, TAU); g.fill(); g.stroke();
        // antenna with a blinking light
        g.beginPath(); g.moveTo(14, -48); g.lineTo(20, -62); g.stroke();
        g.fillStyle = Math.sin(s.t * 4) > 0 ? "#ff4d5e" : "#7a1f2b";
        g.beginPath(); g.arc(20, -64, 4.5, 0, TAU); g.fill(); g.stroke();
        // visor
        g.fillStyle = "#121735";
        g.beginPath(); g.roundRect(-25, -34, 50, 30, 13); g.fill();
        // eyes
        const ex = s.look * 4;
        g.fillStyle = "#29e6ff";
        g.shadowColor = "#29e6ff";
        g.shadowBlur = 10;
        for (const side of [-1, 1]) {
            const x = side * 10 + ex, y = -20;
            if (s.blink > 0.5) { g.fillRect(x - 6, y, 12, 2.5); continue; }
            if (s.mood === "happy") {
                g.lineWidth = 3; g.strokeStyle = "#29e6ff";
                g.beginPath(); g.arc(x, y + 3, 5.5, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
            } else if (s.mood === "wow") {
                g.beginPath(); g.arc(x, y, 5.5, 0, TAU); g.fill();
            } else if (s.mood === "sad") {
                g.fillRect(x - 5, y - 1, 10, 4);
            } else {
                g.beginPath(); g.roundRect(x - 4, y - 6, 8, 11, 4); g.fill();
            }
        }
        // mouth (it moves while talking)
        const mw = 6 + s.talk * 6;
        g.fillRect(-mw / 2, -10 + (s.mood === "sad" ? 1 : 0), mw, 2 + s.talk * 3);
        g.shadowBlur = 0;
        // visor shine
        g.strokeStyle = "rgba(255,255,255,.35)";
        g.lineWidth = 3;
        g.beginPath(); g.arc(0, -18, 28, Math.PI * 1.15, Math.PI * 1.45); g.stroke();
        g.restore();
    }

    // ---------------------------------------------------------------------------------------------
    // Sounds: soft sines through an echo, deep rumbles for the big moments
    // ---------------------------------------------------------------------------------------------
    const sounds = {
        type: () => { const f = U.rand(880, 1400); tone({ f, f2: f * 1.5, type: "sine", d: 0.09, v: 0.06, echo: 0.25 }); },
        erase: () => tone({ f: 520, f2: 300, type: "sine", d: 0.12, v: 0.06, echo: 0.15 }),
        move: () => {},
        word: () => [0, 4, 7, 11, 14].forEach((n, i) => tone({ t: i * 0.055, f: midi(74 + n), type: "sine", d: 0.4, v: 0.055, echo: 0.45 })),
        wrong: () => { tone({ f: 240, f2: 120, type: "sawtooth", d: 0.32, v: 0.05, filt: { f: 900 } }); tone({ t: 0.12, f: 200, f2: 100, type: "sawtooth", d: 0.3, v: 0.04, filt: { f: 700 } }); },
        right: () => [0, 7, 12, 19].forEach((n, i) => tone({ t: i * 0.07, f: midi(79 + n), type: "sine", d: 0.5, v: 0.05, echo: 0.5 })),
        reveal: () => { tone({ f: 2400, f2: 600, type: "sine", d: 0.3, v: 0.06, echo: 0.3 }); noise({ f: 3000, f2: 800, d: 0.25, v: 0.05, q: 2 }); },
        flip: () => tone({ f: 1800, f2: 900, type: "sine", d: 0.08, v: 0.04 }),
        rumble: () => { tone({ f: 55, f2: 32, d: 2.6, v: 0.45, a: 0.7 }); noise({ type: "lowpass", f: 180, f2: 700, d: 2.4, v: 0.22, a: 0.9 }); tone({ f: 110, f2: 220, type: "sawtooth", d: 2.4, v: 0.02, a: 1.6, filt: { f: 500 } }); },
        implode: () => { tone({ f: 900, f2: 60, type: "sine", d: 0.4, v: 0.12 }); noise({ f: 4000, f2: 200, d: 0.38, v: 0.12, q: 1.5 }); },
        supernova: () => {
            tone({ f: 90, f2: 26, d: 1.8, v: 0.7 });
            noise({ type: "lowpass", f: 3000, f2: 80, d: 2, v: 0.5 });
            chord(0.05, [57, 64, 69, 73, 76, 81], { type: "sawtooth", d: 2.6, v: 0.022, a: 0.05, filt: { f: 2600 }, echo: 0.3 });
            [88, 91, 95, 100].forEach((n, i) => tone({ t: 0.3 + i * 0.09, f: midi(n), type: "sine", d: 0.9, v: 0.04, echo: 0.6 }));
        },
        win: () => {},
        streak: () => [72, 79, 84, 91].forEach((n, i) => tone({ t: i * 0.08, f: midi(n), type: "sine", d: 0.6, v: 0.05, echo: 0.5 })),
        achievement: () => { [76, 83, 88].forEach((n, i) => tone({ t: i * 0.09, f: midi(n), type: "sine", d: 0.7, v: 0.06, echo: 0.5 })); noise({ type: "highpass", f: 6000, d: 0.6, v: 0.04 }); },
        title: () => { [0, 0.12, 0.24].forEach((t, i) => tone({ t, f: [1200, 1500, 1800][i], type: "square", d: 0.05, v: 0.025 })); noise({ t: 0.3, f: 300, f2: 4000, d: 0.5, v: 0.08, q: 0.8 }); tone({ t: 0.35, f: midi(69), type: "sine", d: 1.2, v: 0.06, echo: 0.4 }); },
        tile: i => tone({ f: midi(76 + (i % 6) * 2), type: "sine", d: 0.18, v: 0.05, echo: 0.35 }),
        start: () => { noise({ f: 200, f2: 7000, d: 0.9, v: 0.12, q: 0.9 }); tone({ f: 80, f2: 900, type: "sawtooth", d: 0.9, v: 0.03, filt: { f: 1800 } }); tone({ t: 0.85, f: 60, f2: 30, d: 0.8, v: 0.5 }); },
        select: () => tone({ f: 1760, f2: 2200, type: "sine", d: 0.06, v: 0.05, echo: 0.2 }),
        nav: () => { noise({ f: 600, f2: 3000, d: 0.25, v: 0.07, q: 1 }); tone({ f: 660, f2: 990, type: "sine", d: 0.18, v: 0.05, echo: 0.3 }); }
    };

    Worlds.register({
        id: "space", name: "Deep Space", icon: "\u{1FA90}", tagline: "A Blazing Sun. A Black Hole.",
        modes: ["light", "dark"],
        scene, board, celebrate, titleCard, sounds, transition: "warp",
        mascot: { name: "NOVA", draw: drawNova },
        lines: {
            hello: ["Systems online. Ready to solve, Commander?", "Welcome aboard! Today's puzzles are in orbit.", "Scanning the grid... all systems go."],
            start: ["Tap a square and start typing. Space flips Across and Down!", "Launch sequence ready. Pick a square!"],
            word: ["Locked in!", "Stellar!", "That word is in orbit.", "Constellation complete!", "Out of this world!", "Nice trajectory!"],
            win: ["Mission complete! You just bent spacetime with words.", "Supernova solve!", "Houston, we have a winner!"],
            wrong: ["Hmm, a few readings are off.", "Houston, we have a couple of typos."],
            right: ["All readings nominal!", "Every letter checks out!"],
            idle: ["Scanning... try a crossing word for a hint.", "Even astronauts get stuck. Try the shortest clue!"],
            reveal: ["Revealing coordinates...", "Sensor sweep complete."]
        },
        introFlourish(stage) {
            const p = U.center(stage);
            FX.ring({ x: p.x, y: p.y, color: "#7ffbff", r1: Math.max(innerWidth, innerHeight) * 0.6, dur: 1.2, width: 18 });
            FX.burst({ x: p.x, y: p.y, n: 120, colors: ["#ffffff", "#7ffbff", "#b48cff"], shape: "spark", speed: [200, 900], gravity: 0, drag: 1, life: [0.6, 1.4], size: [1.2, 2.6], glow: true });
        },
        drawBlackHole
    });
})();
