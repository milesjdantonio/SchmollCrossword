// Rainy City's background (rain.js uses it). A city street in steady rain, in depth: a heavy cloud deck rolling
// over, lightning far off lighting it from inside; three ranges of buildings fading into the rain (water towers,
// antennas, rooftop units, setbacks, fire escapes on the near ones); at street level a café with a striped awning
// and a warm window, drips running off the awning, street lamps, a wet street that mirrors every light, puddles
// that ring with the rain, people under coloured umbrellas going by, and now and then a car with its lights on,
// throwing up spray. Day: grey and soft, the café the warmest thing in it. Night: windows lit up and going out,
// neon on the café, lamp cones, the lightning brighter.
function RainScene(W, H, opts) {
    const night = opts.theme === "dark", preview = !!opts.preview, TAU = Math.PI * 2;
    const P = night
        ? { sky: ["#070b18", "#121a30", "#1f2640", "#3a2e3a"], cloud: ["rgba(40,46,70,", "rgba(20,24,40,"], far: "#1b2236", mid: ["#141a2a", "#1a2133", "#202638"], near: ["#0f131f", "#141a28"], street: ["#0b0e16", "#151a26"], walk: "#1c2130", haze: "rgba(70,80,120," }
        : { sky: ["#77889c", "#93a2b3", "#b3bdc8", "#c9cfd6"], cloud: ["rgba(120,132,150,", "rgba(90,100,118,"], far: "#a3aebb", mid: ["#7c8796", "#86909e", "#717c8b"], near: ["#59626f", "#636c79"], street: ["#4a5058", "#5c636c"], walk: "#7a8088", haze: "rgba(200,208,218," };
    let sky = null, layers = null, windows = [], lamps = [], cafe = null, drops = [], ripples = [], walkers = [], car = null, nextCar = 6, flash = 0, nextFlash = 4, bolt = null, decks = [];
    const k = () => (preview ? 0.5 : U.clamp(Math.min(W, H) / 900, 0.6, 1.1));
    const STREET = () => H * 0.8;                                    // the kerb line
    function paint(w, h, fn) { const c = Worlds.canvas(w, h), g = c.getContext("2d"); fn(g); return c; }

    function building(g, x, w, top, base, col, R, { windowsOut = null, detail = 1 } = {}) {
        g.fillStyle = col; g.fillRect(x, top, w, base - top);
        const sh = g.createLinearGradient(x, 0, x + w, 0);              // the side away from the light a touch darker
        sh.addColorStop(0, "rgba(255,255,255,.04)"); sh.addColorStop(0.7, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(0,0,0,.18)");
        g.fillStyle = sh; g.fillRect(x, top, w, base - top);
        if (detail > 0.5 && R() < 0.5) {                               // a setback on top
            const sw = w * (0.45 + R() * 0.3), sx = x + (w - sw) * R();
            g.fillStyle = col; g.fillRect(sx, top - 18 * detail, sw, 18 * detail);
        }
        if (detail > 0.5 && R() < 0.4) {                               // a water tower on legs
            const tx = x + w * (0.2 + R() * 0.6), ts = 10 * detail;
            g.strokeStyle = col; g.lineWidth = 1.4;
            g.beginPath(); g.moveTo(tx - ts * 0.8, top); g.lineTo(tx - ts * 0.6, top - ts * 1.2); g.moveTo(tx + ts * 0.8, top); g.lineTo(tx + ts * 0.6, top - ts * 1.2); g.stroke();
            g.fillStyle = col; g.fillRect(tx - ts, top - ts * 2.6, ts * 2, ts * 1.5);
            g.beginPath(); g.moveTo(tx - ts * 1.1, top - ts * 2.6); g.lineTo(tx, top - ts * 3.4); g.lineTo(tx + ts * 1.1, top - ts * 2.6); g.fill();
        }
        if (R() < 0.45) { g.strokeStyle = col; g.lineWidth = 1.2; const ax = x + w * R(); g.beginPath(); g.moveTo(ax, top); g.lineTo(ax, top - (14 + R() * 30) * detail); g.stroke(); }
        if (detail > 0.5 && R() < 0.6) { g.fillStyle = col; g.fillRect(x + w * R() * 0.7, top - 6 * detail, 12 * detail, 6 * detail); }
        // windows: a grid with gaps; their light is drawn live at night, their glass here
        const cw = 6 * detail + 2, ch = 8 * detail + 2, gapX = cw * 0.9, gapY = ch * 0.8;
        for (let y = top + 10 * detail; y < base - ch - 6; y += ch + gapY) {
            for (let xx = x + 6 * detail; xx < x + w - cw - 4; xx += cw + gapX) {
                if (R() < 0.12) continue;
                const v = R() * 14 | 0;
                g.fillStyle = night ? "rgba(10,12,20,.8)" : `rgba(${148 + v},${162 + v},${180 + v},.5)`;
                g.fillRect(xx, y, cw, ch);
                if (windowsOut && R() < 0.42) windowsOut.push({ x: xx, y, w: cw, h: ch, on: R() < 0.7, warm: R() < 0.75, t: R() * 20 });
            }
        }
    }
    function setup() {
        const R = U.rng(808), s = k(), st = STREET();
        windows = [];
        // the cloud deck: two layers of heaped, shaded masses
        decks = [0, 1].map(d => {
            const w = W * 1.5, h = H * 0.42;
            const img = paint(w, h, g => {
                // one overcast sheet first, soft along its lower edge, then billows of all sizes on it
                const ov = g.createLinearGradient(0, 0, 0, h);
                ov.addColorStop(0, P.cloud[1] + (night ? ".5)" : ".55)")); ov.addColorStop(0.55, P.cloud[0] + (night ? ".35)" : ".4)")); ov.addColorStop(1, P.cloud[0] + "0)");
                g.fillStyle = ov; g.fillRect(0, 0, w, h);
                for (let i = 0; i < 160; i++) {
                    const x = R() * w, y = h * (0.1 + R() * 0.6) + d * h * 0.12, r = h * (0.05 + R() * 0.12);
                    const cg = g.createRadialGradient(x, y, 0, x, y, r);
                    const tone = R() < 0.35 ? P.cloud[0] : P.cloud[1];      // one colour per billow, fading evenly: no rims
                    cg.addColorStop(0, tone + (night ? ".32)" : ".38)")); cg.addColorStop(0.5, tone + (night ? ".2)" : ".24)")); cg.addColorStop(1, tone + "0)");
                    g.fillStyle = cg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
                }
            });
            return { img, x: -R() * W * 0.5, sp: d ? 7 : 4, y: d ? -H * 0.04 : -H * 0.1 };
        });
        layers = {
            far: paint(W, H, g => {
                for (let x = -20; x < W; x += 30 + R() * 50) { const w = 30 + R() * 60, top = st - H * (0.28 + R() * 0.2); g.fillStyle = P.far; g.fillRect(x, top, w, st - top); if (R() < 0.3) { g.fillRect(x + w * 0.4, top - 30, 3, 30); } }
                const hz = g.createLinearGradient(0, H * 0.3, 0, st); hz.addColorStop(0, P.haze + "0)"); hz.addColorStop(1, P.haze + (night ? ".25)" : ".5)"));
                g.fillStyle = hz; g.fillRect(0, 0, W, st);
            }),
            mid: paint(W, H, g => {
                for (let x = -30; x < W; ) { const w = 50 + R() * 80, top = st - H * (0.18 + R() * 0.24); building(g, x, w, top, st, P.mid[Math.floor(R() * 3)], R, { windowsOut: windows, detail: 0.8 * s + 0.3 }); x += w + R() * 6; }
                const hz = g.createLinearGradient(0, H * 0.45, 0, st); hz.addColorStop(0, P.haze + "0)"); hz.addColorStop(1, P.haze + (night ? ".12)" : ".28)"));
                g.fillStyle = hz; g.fillRect(0, 0, W, st);
            }),
            near: paint(W, H, g => {
                // tall buildings framing the street at both edges, with fire escapes
                for (const [x, w] of [[-20, W * 0.13], [W * 0.89, W * 0.14]]) {
                    const top = H * (0.08 + R() * 0.08);
                    building(g, x, w, top, st + 4, P.near[0], R, { windowsOut: windows, detail: 1.2 * s + 0.2 });
                    g.strokeStyle = night ? "#2a2f3c" : "#3a404a"; g.lineWidth = 1.6;
                    for (let y = top + 60; y < st - 40; y += 62 * s + 20) {
                        const fx = x + (x < 0 ? w - 50 * s : 8), fw = 46 * s;
                        g.beginPath(); g.moveTo(fx, y); g.lineTo(fx + fw, y); g.moveTo(fx, y - 18 * s); g.lineTo(fx + fw, y - 18 * s);
                        for (let i = 0; i <= 6; i++) { g.moveTo(fx + (fw * i) / 6, y); g.lineTo(fx + (fw * i) / 6, y - 18 * s); }
                        g.moveTo(fx + 4, y); g.lineTo(fx + fw - 4, y + 44 * s); g.stroke();
                    }
                }
                // the café, lower right: brick, a big window, a striped awning, its door
                const cx = W * 0.62, cw = Math.min(W * 0.24, 360 * s), ctop = st - 150 * s;
                g.fillStyle = night ? "#2a1a18" : "#7a4a3a"; g.fillRect(cx, ctop - 60 * s, cw, st - ctop + 60 * s);
                g.strokeStyle = night ? "rgba(0,0,0,.35)" : "rgba(60,30,20,.3)"; g.lineWidth = 1;
                for (let y = ctop - 60 * s; y < st; y += 7 * s) { g.beginPath(); g.moveTo(cx, y); g.lineTo(cx + cw, y); g.stroke(); for (let x = cx + ((y / (7 * s)) % 2 ? 0 : 7 * s); x < cx + cw; x += 14 * s) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 7 * s); g.stroke(); } }
                cafe = { x: cx, w: cw, top: ctop, win: { x: cx + cw * 0.08, y: ctop + 40 * s, w: cw * 0.58, h: 90 * s }, door: { x: cx + cw * 0.74, y: ctop + 30 * s, w: cw * 0.18, h: 120 * s }, awning: { x: cx - 6, y: ctop + 8 * s, w: cw + 12, h: 30 * s } };
                g.fillStyle = night ? "#140c0a" : "#3a2620"; g.fillRect(cafe.door.x, cafe.door.y, cafe.door.w, cafe.door.h);
                const a = cafe.awning;
                for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? "#f4efe2" : "#2f7a4a"; g.beginPath(); g.moveTo(a.x + (a.w * i) / 9, a.y); g.lineTo(a.x + (a.w * (i + 1)) / 9, a.y); g.lineTo(a.x + (a.w * (i + 1)) / 9 + 4, a.y + a.h); g.lineTo(a.x + (a.w * i) / 9 + 4, a.y + a.h); g.fill(); }
                for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? "#e8e1d0" : "#256a3e"; g.beginPath(); g.arc(a.x + (a.w * (i + 0.5)) / 9 + 4, a.y + a.h, a.w / 18, 0, Math.PI); g.fill(); }
                g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(a.x, a.y + a.h * 0.6, a.w, a.h * 0.4);
                // the street and the pavement: wet, darker where the water lies
                const sg = g.createLinearGradient(0, st, 0, H);
                sg.addColorStop(0, P.street[1]); sg.addColorStop(1, P.street[0]);
                g.fillStyle = P.walk; g.fillRect(0, st, W, 14 * s);
                g.fillStyle = sg; g.fillRect(0, st + 14 * s, W, H - st);
                g.fillStyle = night ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.12)"; g.fillRect(0, st + 12 * s, W, 2);
                for (let i = 0; i < 14; i++) {                         // dashed lane line, foreshortened
                    const x = (i / 14) * W + 20; g.fillStyle = night ? "rgba(220,200,120,.35)" : "rgba(240,230,170,.6)"; g.fillRect(x, H - (H - st) * 0.35, 46 * s, 4);
                }
                // street lamps
                lamps = [W * 0.2, W * 0.5, W * 0.82].map(x => ({ x, y: st - 150 * s, s }));
                for (const L of lamps) {
                    g.fillStyle = night ? "#2a2f3a" : "#3a3f48"; g.fillRect(L.x - 3 * s, L.y, 6 * s, st - L.y + 2);
                    g.fillRect(L.x - 3 * s, L.y, 26 * s, 5 * s); g.beginPath(); g.moveTo(L.x + 14 * s, L.y + 5 * s); g.lineTo(L.x + 30 * s, L.y + 5 * s); g.lineTo(L.x + 26 * s, L.y + 16 * s); g.lineTo(L.x + 18 * s, L.y + 16 * s); g.fill();
                }
                // puddles: patches of sky-coloured mirror
                ripples = [];
                for (let i = 0; i < (preview ? 3 : 7); i++) {
                    const px = R() * W, py = st + 20 * s + R() * (H - st - 30 * s), rx = (40 + R() * 80) * s, ry = rx * 0.18;
                    const pg = g.createLinearGradient(0, py - ry, 0, py + ry);
                    pg.addColorStop(0, night ? "rgba(60,70,110,.5)" : "rgba(190,200,212,.6)"); pg.addColorStop(1, night ? "rgba(20,24,40,.5)" : "rgba(120,130,145,.5)");
                    g.fillStyle = pg; g.beginPath(); g.ellipse(px, py, rx, ry, 0, 0, TAU); g.fill();
                    ripples.push({ x: px, y: py, rx, ry, rings: [] });
                }
            })
        };
        // reflections of the lights on the wet street (drawn live: they shimmer)
        drops = Array.from({ length: preview ? 80 : 360 }, () => ({ x: R() * W * 1.2, y: R() * H, z: R(), }));
        walkers = [];
    }
    setup();

    function walker(g, w, t) {
        const s = w.s, bob = Math.abs(Math.sin(t * 6 + w.ph)) * 2;
        g.save(); g.translate(w.x, w.y - bob);
        g.strokeStyle = night ? "#0c0e14" : "#2e323a"; g.lineWidth = 3 * s; g.lineCap = "round";
        const step = Math.sin(t * 6 + w.ph) * 6 * s;
        g.beginPath(); g.moveTo(0, -22 * s); g.lineTo(step, 0); g.moveTo(0, -22 * s); g.lineTo(-step, 0); g.stroke();
        g.fillStyle = night ? "#10131a" : "#353a44"; g.beginPath(); g.roundRect(-6 * s, -46 * s, 12 * s, 26 * s, 4 * s); g.fill();
        g.beginPath(); g.arc(0, -50 * s, 5 * s, 0, TAU); g.fill();
        g.strokeStyle = "#2a2a2a"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(2 * s, -40 * s); g.lineTo(2 * s, -66 * s); g.stroke();
        const ug = g.createLinearGradient(0, -86 * s, 0, -64 * s);
        ug.addColorStop(0, w.c); ug.addColorStop(1, w.c2);
        g.fillStyle = ug;
        g.beginPath(); g.moveTo(-24 * s, -64 * s); g.quadraticCurveTo(-20 * s, -86 * s, 2 * s, -88 * s); g.quadraticCurveTo(24 * s, -86 * s, 28 * s, -64 * s);
        for (let i = 4; i >= 0; i--) g.quadraticCurveTo(-24 * s + (52 * s * (i + 0.5)) / 5, -68 * s, -24 * s + (52 * s * i) / 5, -64 * s);
        g.fill();
        g.strokeStyle = "rgba(255,255,255,.25)"; g.lineWidth = 1; g.beginPath(); g.moveTo(2 * s, -88 * s); g.lineTo(-10 * s, -65 * s); g.moveTo(2 * s, -88 * s); g.lineTo(14 * s, -65 * s); g.stroke();
        g.restore();
    }
    return {
        resize(w, h) { W = w; H = h; setup(); },
        draw(g, t, dt, inp) {
            const st = STREET(), s = k();
            if (!sky) { sky = g.createLinearGradient(0, 0, 0, st); P.sky.forEach((c, i) => sky.addColorStop(i / (P.sky.length - 1), c)); }
            g.fillStyle = sky; g.fillRect(0, 0, W, H);
            // lightning, far off: the clouds lit from inside, now and then a bolt
            nextFlash -= dt;
            if (nextFlash <= 0 && !preview) {
                nextFlash = U.rand(night ? 6 : 10, night ? 14 : 22); flash = 1;
                const x0 = U.rand(0.15, 0.85) * W; bolt = [[x0, H * 0.12]]; let x = x0, y = H * 0.12;
                while (y < st - H * 0.25) { x += U.rand(-24, 24); y += U.rand(14, 30); bolt.push([x, y]); }
            }
            if (flash > 0) {
                flash = Math.max(0, flash - dt * 2.4);
                const f = flash > 0.6 ? 1 : flash > 0.4 ? 0.3 : flash;
                g.fillStyle = `rgba(200,210,255,${(f * (night ? 0.35 : 0.18)).toFixed(3)})`; g.fillRect(0, 0, W, st);
                if (bolt && flash > 0.35) { g.strokeStyle = `rgba(235,240,255,${f.toFixed(2)})`; g.lineWidth = 2; g.beginPath(); bolt.forEach(([x, y], i) => g[i ? "lineTo" : "moveTo"](x, y)); g.stroke(); Worlds.glow(g, bolt[0][0], H * 0.2, H * 0.3, "#c8d4ff", f * 0.5); }
            }
            for (const d of decks) {
                d.x += d.sp * dt; if (d.x > 0) d.x -= W * 0.5;
                g.drawImage(d.img, d.x - inp.px * 6, d.y);
            }
            g.drawImage(layers.far, -inp.px * 4, 0);
            g.drawImage(layers.mid, -inp.px * 8, 0);
            if (night) {                                             // windows: lit ones glow, some switch now and then
                for (const w of windows) {
                    w.t -= dt; if (w.t <= 0) { w.t = U.rand(8, 40); if (Math.random() < 0.3) w.on = !w.on; }
                    if (!w.on) continue;
                    g.fillStyle = w.warm ? "rgba(255,206,120,.85)" : "rgba(170,210,255,.75)";
                    g.fillRect(w.x - inp.px * 8, w.y, w.w, w.h);
                }
            }
            g.drawImage(layers.near, -inp.px * 12, 0);
            // the café's window and sign
            if (cafe) {
                const wx = cafe.win.x - inp.px * 12, wy = cafe.win.y;
                const cg = g.createLinearGradient(0, wy, 0, wy + cafe.win.h);
                cg.addColorStop(0, night ? "#ffcf7a" : "#ffe6b0"); cg.addColorStop(1, night ? "#e0883a" : "#f4b46a");
                g.fillStyle = cg; g.fillRect(wx, wy, cafe.win.w, cafe.win.h);
                g.fillStyle = "rgba(60,30,20,.55)";                   // people inside, at tables
                for (let i = 0; i < 3; i++) { const px = wx + cafe.win.w * (0.2 + i * 0.3); g.beginPath(); g.arc(px, wy + cafe.win.h * 0.55, 6 * s, 0, TAU); g.fill(); g.fillRect(px - 7 * s, wy + cafe.win.h * 0.62, 14 * s, cafe.win.h * 0.38); }
                g.strokeStyle = night ? "#3a2418" : "#5a3a2a"; g.lineWidth = 3; g.strokeRect(wx, wy, cafe.win.w, cafe.win.h); g.beginPath(); g.moveTo(wx + cafe.win.w / 2, wy); g.lineTo(wx + cafe.win.w / 2, wy + cafe.win.h); g.stroke();
                Worlds.glow(g, wx + cafe.win.w / 2, wy + cafe.win.h / 2, cafe.win.w * 0.9, "#ffb860", night ? 0.45 : 0.18);
                const sx = cafe.x - inp.px * 12 + cafe.w * 0.5, sy = cafe.top - 26 * s, on = !night || Math.sin(t * 17) > -0.92;
                g.font = `bold ${Math.round(20 * s)}px Pacifico, cursive`; g.textAlign = "center";
                if (night && on) { Worlds.glow(g, sx, sy - 6 * s, 70 * s, "#ff4d8a", 0.6); g.fillStyle = "#ffd0e4"; }
                else g.fillStyle = night ? "#5a2a40" : "#f4efe2";
                g.fillText("Café", sx, sy); g.textAlign = "start";
                for (let i = 0; i < 6; i++) {                       // drips off the awning's edge
                    const p = ((t * 0.9 + i * 0.37) % 1), dx = cafe.awning.x - inp.px * 12 + cafe.awning.w * ((i * 0.17 + 0.05) % 1);
                    g.fillStyle = night ? "rgba(200,210,255,.6)" : "rgba(220,230,240,.8)"; g.fillRect(dx, cafe.awning.y + cafe.awning.h + p * (st - cafe.awning.y - cafe.awning.h), 1.6, 5);
                }
            }
            // lamps: at night a glowing head and a cone of light with rain in it
            for (const L of lamps) {
                const x = L.x - inp.px * 12 + 22 * s, y = L.y + 14 * s;
                if (night) {
                    const cg = g.createLinearGradient(0, y, 0, st);
                    cg.addColorStop(0, "rgba(255,214,150,.22)"); cg.addColorStop(1, "rgba(255,214,150,0)");
                    g.fillStyle = cg; g.beginPath(); g.moveTo(x - 6 * s, y); g.lineTo(x - 80 * s, st + 10); g.lineTo(x + 80 * s, st + 10); g.lineTo(x + 6 * s, y); g.fill();
                    Worlds.glow(g, x, y, 34 * s, "#ffd890", 0.9);
                } else { g.fillStyle = "#c8ccd2"; g.fillRect(x - 6 * s, y - 2, 12 * s, 3); }
            }
            // the wet street mirroring the lights: long soft streaks under each light
            g.save(); g.globalCompositeOperation = night ? "lighter" : "source-over";
            const refl = (x, col, a, wdt) => { const rg = g.createLinearGradient(0, st + 14, 0, H); rg.addColorStop(0, col.replace("A", a)); rg.addColorStop(1, col.replace("A", 0)); g.fillStyle = rg; g.fillRect(x - wdt / 2 + Math.sin(t * 3 + x) * 1.5, st + 14, wdt, H - st); };
            for (const L of lamps) if (night) refl(L.x - inp.px * 12 + 22 * s, "rgba(255,210,140,A)", 0.35, 14 * s);
            if (cafe) refl(cafe.win.x - inp.px * 12 + cafe.win.w / 2, "rgba(255,190,110,A)", night ? 0.3 : 0.18, cafe.win.w * 0.8);
            if (night && cafe) refl(cafe.x - inp.px * 12 + cafe.w * 0.5, "rgba(255,80,140,A)", 0.25, 40 * s);
            g.restore();
            // puddles ringing with the rain
            for (const p of ripples) {
                if (Math.random() < dt * 3) p.rings.push({ x: p.x + (Math.random() - 0.5) * p.rx * 1.4, y: p.y + (Math.random() - 0.5) * p.ry, r: 0 });
                g.strokeStyle = night ? "rgba(200,210,255,.35)" : "rgba(255,255,255,.55)"; g.lineWidth = 1;
                for (const r of p.rings) { r.r += dt * 20; g.globalAlpha = Math.max(0, 1 - r.r / 18); g.beginPath(); g.ellipse(r.x - inp.px * 12, r.y, r.r, r.r * 0.25, 0, 0, TAU); g.stroke(); }
                g.globalAlpha = 1;
                p.rings = p.rings.filter(r => r.r < 18);
            }
            // people with umbrellas along the pavement, and a car now and then
            if (!preview) {
                if (walkers.length < 3 && Math.random() < dt * 0.25) {
                    const left = Math.random() < 0.5, cols = U.pick([["#e8505b", "#a8323a"], ["#f2c94c", "#c79a1e"], ["#4f8ad8", "#2f5aa0"], ["#2f9a6a", "#1f6a48"], ["#b06be0", "#7a3fae"]]);
                    walkers.push({ x: left ? -40 : W + 40, y: st + 8 * s, vx: (left ? 1 : -1) * U.rand(28, 40), ph: Math.random() * 6, s: s * U.rand(0.9, 1.1), c: cols[0], c2: cols[1] });
                }
                for (const w of walkers) { w.x += w.vx * dt; walker(g, w, t); }
                walkers = walkers.filter(w => w.x > -60 && w.x < W + 60);
                nextCar -= dt;
                if (!car && nextCar <= 0) { const left = Math.random() < 0.5; car = { x: left ? -260 * s : W + 260 * s, vx: (left ? 1 : -1) * U.rand(180, 240), c: U.pick(["#c8503c", "#3a5a8a", "#e8e2d4", "#2a2a30"]) }; }
                if (car) {
                    car.x += car.vx * dt;
                    const cy = H - (H - st) * 0.48, cw = 190 * s, dir = Math.sign(car.vx);
                    g.save(); g.translate(car.x, cy); g.scale(dir, 1);
                    if (night) { const hl = g.createLinearGradient(cw / 2, 0, cw / 2 + 260 * s, 0); hl.addColorStop(0, "rgba(255,240,200,.35)"); hl.addColorStop(1, "rgba(255,240,200,0)"); g.fillStyle = hl; g.beginPath(); g.moveTo(cw / 2, -18 * s); g.lineTo(cw / 2 + 260 * s, -50 * s); g.lineTo(cw / 2 + 260 * s, 30 * s); g.lineTo(cw / 2, -6 * s); g.fill(); }
                    g.fillStyle = car.c; g.beginPath(); g.roundRect(-cw / 2, -40 * s, cw, 30 * s, 8 * s); g.fill();
                    g.beginPath(); g.moveTo(-cw * 0.3, -40 * s); g.lineTo(-cw * 0.18, -62 * s); g.lineTo(cw * 0.2, -62 * s); g.lineTo(cw * 0.34, -40 * s); g.fill();
                    g.fillStyle = night ? "rgba(255,220,150,.5)" : "rgba(170,190,210,.8)"; g.beginPath(); g.moveTo(-cw * 0.24, -42 * s); g.lineTo(-cw * 0.15, -58 * s); g.lineTo(cw * 0.17, -58 * s); g.lineTo(cw * 0.27, -42 * s); g.fill();
                    g.fillStyle = "#111"; g.beginPath(); g.arc(-cw * 0.3, -10 * s, 13 * s, 0, TAU); g.arc(cw * 0.3, -10 * s, 13 * s, 0, TAU); g.fill();
                    g.fillStyle = "#ffe8a0"; g.fillRect(cw / 2 - 6 * s, -34 * s, 6 * s, 8 * s); g.fillStyle = "#ff3a3a"; g.fillRect(-cw / 2, -34 * s, 5 * s, 8 * s);
                    g.fillStyle = "rgba(220,230,240,.35)";              // spray off the back wheel
                    for (let i = 0; i < 8; i++) { const a = Math.random(); g.beginPath(); g.arc(-cw * 0.3 - 20 * s - a * 50 * s, -4 * s - a * 26 * s, 3 + a * 6, 0, TAU); g.fill(); }
                    g.restore();
                    if (car.x < -400 * s || car.x > W + 400 * s) { car = null; nextCar = U.rand(10, 22); }
                }
            }
            // the rain itself, three depths, slanting in the wind; splashes where it lands
            const wind = 0.18 + Math.sin(t * 0.3) * 0.05;
            g.lineCap = "round";
            for (const pass of [0, 1, 2]) {
                g.strokeStyle = night ? `rgba(180,195,230,${[0.18, 0.28, 0.4][pass]})` : `rgba(235,240,248,${[0.25, 0.4, 0.6][pass]})`;
                g.lineWidth = [0.8, 1.1, 1.6][pass];
                g.beginPath();
                for (let i = pass; i < drops.length; i += 3) {
                    const d = drops[i], sp = (700 + pass * 300) * dt, len = 10 + pass * 8;
                    d.y += sp; d.x -= sp * wind; if (d.y > H) { d.y = -20; d.x = Math.random() * W * 1.2; }
                    g.moveTo(d.x, d.y); g.lineTo(d.x + len * wind, d.y - len);
                }
                g.stroke();
            }
            g.fillStyle = night ? "rgba(200,210,255,.45)" : "rgba(255,255,255,.6)";
            for (let i = 0; i < (preview ? 4 : 14); i++) { const x = Math.random() * W, y = st + 16 + Math.random() * (H - st - 16); g.fillRect(x - 2, y, 4, 1); g.fillRect(x - 1, y - 2, 1, 2); g.fillRect(x + 1, y - 2, 1, 2); }
            // mist over the street
            const mist = g.createLinearGradient(0, st - 60, 0, st + 40);
            mist.addColorStop(0, P.haze + "0)"); mist.addColorStop(0.5, P.haze + (night ? ".1)" : ".18)")); mist.addColorStop(1, P.haze + "0)");
            g.fillStyle = mist; g.fillRect(0, st - 60, W, 100);
        }
    };
}
