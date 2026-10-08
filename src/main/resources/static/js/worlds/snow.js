// The SNOW DAY world: a quiet winter valley.
//   Background: snowy mountains and two rows of pine forest in parallax, a log cabin with glowing windows and
//   chimney smoke, snow falling in three depths with wind gusts, glints on the snow, a fox trotting by (leaving
//   footprints) and a cardinal flying past. At night: the moon, stars, shooting stars and the northern lights.
//   Board: frosted squares under a cap of snow; every letter grows a snowflake crystal, finished words frost over
//   with feathery ice, and icicles grow under the board as it fills up.
//   Win: the board freezes, a snow globe forms around it and gets shaken, it bursts, and a snowman builds itself.

(() => {
    const TAU = Math.PI * 2;
    const { tone, noise, midi } = Sound;
    const ICE = ["#ffffff", "#e3f3ff", "#bfe3ff", "#9fd2f7"];

    const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };

    // A snowy pine: four tiers of branches, each with snow on top and on its tips
    function pine(g, x, base, h, body, snow, trunk) {
        if (trunk) { g.fillStyle = trunk; g.fillRect(x - h * 0.035, base - h * 0.08, h * 0.07, h * 0.1); }
        for (let i = 0; i < 4; i++) {
            const ya = base - h + i * h * 0.22, yb = ya + h * 0.34, hw = h * (0.12 + i * 0.07), dy = yb - ya;
            g.fillStyle = body;
            g.beginPath();
            g.moveTo(x, ya);
            g.quadraticCurveTo(x + hw * 0.45, ya + dy * 0.55, x + hw, yb);
            g.quadraticCurveTo(x + hw * 0.5, yb - dy * 0.1, x, yb - dy * 0.04);
            g.quadraticCurveTo(x - hw * 0.5, yb - dy * 0.1, x - hw, yb);
            g.quadraticCurveTo(x - hw * 0.45, ya + dy * 0.55, x, ya);
            g.fill();
            if (!snow) continue;
            g.fillStyle = snow;
            g.beginPath();
            g.moveTo(x, ya - dy * 0.03);
            g.quadraticCurveTo(x + hw * 0.3, ya + dy * 0.3, x + hw * 0.56, ya + dy * 0.56);
            g.quadraticCurveTo(x + hw * 0.32, ya + dy * 0.48, x + hw * 0.14, ya + dy * 0.6);
            g.quadraticCurveTo(x - hw * 0.12, ya + dy * 0.46, x - hw * 0.34, ya + dy * 0.56);
            g.quadraticCurveTo(x - hw * 0.48, ya + dy * 0.5, x - hw * 0.56, ya + dy * 0.56);
            g.quadraticCurveTo(x - hw * 0.3, ya + dy * 0.3, x, ya - dy * 0.03);
            g.fill();
            for (const side of [-1, 1]) { g.beginPath(); g.ellipse(x + side * hw * 0.86, yb - dy * 0.05, hw * 0.2, dy * 0.07, side * 0.3, 0, TAU); g.fill(); }
        }
    }

    // ---------------------------------------------------------------------------------------------
    // The background
    // ---------------------------------------------------------------------------------------------
    function scene(W, H, opts) {
        const night = opts.theme === "dark", preview = !!opts.preview;
        let hz, groundY, mtn, far, near, ground, cloudSpr, flakeSpr, auroraSpr = [], sky = null;
        let flakes, glints, stars, clouds;
        let smoke = [], smokeIn = 0, gust = 0, gustLeft = 0, nextGust = preview ? 999 : U.rand(12, 22);
        let fox = null, nextFox = preview ? 999 : U.rand(6, 14), prints = [];
        let bird = null, nextBird = preview ? 999 : U.rand(5, 12), meteor = null, nextMeteor = preview ? 999 : U.rand(3, 8);

        const C = night
            ? { top: "#040a1c", mid: "#0d1c3c", low: "#24375e", mtn: "#2b3d60", mtnSnow: "#9fb4d4", far: "#1a2a47", farSnow: "#7d93b6", near: "#0c1f2c", nearSnow: "#c9d8ec", trunk: "#1b120c", g1: "#7f97bb", g2: "#4d6489", mist: "rgba(120,150,200,.18)" }
            : { top: "#7fb0dc", mid: "#b9d7f0", low: "#e6f1fa", mtn: "#94adc8", mtnSnow: "#ffffff", far: "#6d8ea8", farSnow: "#eef5fb", near: "#1f4d3c", nearSnow: "#ffffff", trunk: "#4a3020", g1: "#ffffff", g2: "#d7e5f2", mist: "rgba(255,255,255,.45)" };

        function setup() {
            hz = Math.round(H * 0.6);
            groundY = Math.round(H * (preview ? 0.8 : 0.79));
            sky = null;
            // mountains: craggy peaks with a snow line and a shaded side
            mtn = canvas(W + 60, hz + 4);
            {
                const g = mtn.getContext("2d"), R = U.rng(31), w = mtn.width, n = Math.max(3, Math.round(w / 190)) * 2;
                const pts = [];
                for (let i = 0; i <= n; i++) {
                    const peak = i % 2 === 1;
                    pts.push([i / n * w, hz - (peak ? H * (0.13 + R() * 0.13) : H * (0.03 + R() * 0.05))]);
                }
                const path = new Path2D();
                path.moveTo(0, hz + 4);
                for (let i = 0; i < pts.length; i++) {
                    const [x, y] = pts[i];
                    if (i) { const [px, py] = pts[i - 1]; path.lineTo((px + x) / 2 + (R() - 0.5) * 18, (py + y) / 2 + (R() - 0.5) * H * 0.02); }
                    path.lineTo(x, y);
                }
                path.lineTo(w, hz + 4);
                path.closePath();
                g.fillStyle = C.mtn;
                g.fill(path);
                g.save();
                g.clip(path);
                const sg = g.createLinearGradient(0, hz - H * 0.27, 0, hz - H * 0.05);
                sg.addColorStop(0, C.mtnSnow);
                sg.addColorStop(0.6, C.mtnSnow);
                sg.addColorStop(1, "rgba(255,255,255,0)");
                g.fillStyle = sg;
                g.fillRect(0, 0, w, hz);
                g.fillStyle = night ? "rgba(5,10,30,.28)" : "rgba(40,70,110,.16)";          // the shady side of each peak
                for (let i = 1; i < pts.length - 1; i += 2) {
                    g.beginPath(); g.moveTo(pts[i][0], pts[i][1]); g.lineTo(pts[i + 1][0], pts[i + 1][1]); g.lineTo(pts[i + 1][0] - 30, hz + 4); g.lineTo(pts[i][0] + 6, hz + 4); g.fill();
                }
                g.restore();
            }
            // a far row of hazy pines
            far = canvas(W + 80, H);
            {
                const g = far.getContext("2d"), R = U.rng(57), count = Math.round(far.width / (preview ? 10 : 15));
                for (let i = 0; i < count; i++) {
                    const x = (i + R() * 0.8) / count * far.width, h = H * (0.05 + R() * 0.05);
                    pine(g, x, hz + H * (0.04 + R() * 0.04), h, C.far, C.farSnow, null);
                }
            }
            // the snowy ground with soft drifts and blue shadows
            ground = canvas(W + 40, H - groundY + H * 0.06);
            {
                const g = ground.getContext("2d"), R = U.rng(83), w = ground.width, gh = ground.height, top = H * 0.05;
                const gr = g.createLinearGradient(0, 0, 0, gh);
                gr.addColorStop(0, C.g1);
                gr.addColorStop(1, C.g2);
                g.fillStyle = gr;
                g.beginPath();
                g.moveTo(0, gh);
                g.lineTo(0, top);
                const n = 6;
                for (let i = 0; i < n; i++) {
                    const x0 = i / n * w, x1 = (i + 1) / n * w;
                    g.quadraticCurveTo((x0 + x1) / 2, top - H * (0.02 + R() * 0.035), x1, top + (R() - 0.5) * H * 0.012);
                }
                g.lineTo(w, gh);
                g.fill();
                g.fillStyle = night ? "rgba(10,20,50,.18)" : "rgba(110,150,200,.12)";
                for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(R() * w, top + H * (0.03 + R() * 0.12), w * (0.08 + R() * 0.1), H * 0.012, 0, 0, TAU); g.fill(); }
            }
            // near pines on the right side and the far left edge (the cabin sits on the left)
            near = canvas(W + 120, H);
            {
                const g = near.getContext("2d"), R = U.rng(101), sc = preview ? 0.7 : 1;
                const spots = [[-0.02, 0.5], [0.9, 0.42], [0.97, 0.55], [0.84, 0.3], [1.04, 0.36]];
                for (const [fx, fh] of spots) pine(g, 60 + fx * W, groundY + H * (0.06 + R() * 0.05), H * fh * sc, C.near, C.nearSnow, C.trunk);
            }
            // sprites: a soft snowflake, a fluffy cloud, and the aurora's curtains
            flakeSpr = canvas(16, 16);
            {
                const g = flakeSpr.getContext("2d"), gr = g.createRadialGradient(8, 8, 0, 8, 8, 8);
                gr.addColorStop(0, "rgba(255,255,255,1)");
                gr.addColorStop(0.45, "rgba(255,255,255,.85)");
                gr.addColorStop(1, "rgba(255,255,255,0)");
                g.fillStyle = gr;
                g.fillRect(0, 0, 16, 16);
            }
            cloudSpr = canvas(220, 90);
            {
                const g = cloudSpr.getContext("2d");
                g.fillStyle = "rgba(255,255,255,.75)";
                g.filter = "blur(6px)";
                for (const [x, y, r] of [[60, 55, 28], [95, 42, 34], [135, 50, 30], [165, 60, 22], [110, 64, 30]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
            }
            auroraSpr = [[80, 255, 170], [60, 220, 255], [190, 120, 255]].map(([r, gg, b]) => {
                const c = canvas(1, 128), g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 128);
                gr.addColorStop(0, `rgba(${r},${gg},${b},0)`);
                gr.addColorStop(0.55, `rgba(${r},${gg},${b},.55)`);
                gr.addColorStop(0.85, `rgba(${r},${gg},${b},.9)`);
                gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
                g.fillStyle = gr;
                g.fillRect(0, 0, 1, 128);
                return c;
            });
            const R = U.rng(7);
            const per = preview ? [35, 25, 6] : [110, 80, 22];
            flakes = [];
            per.forEach((n, layer) => {
                for (let i = 0; i < n; i++) flakes.push({ layer, x: R() * W, y: R() * H, r: [0.7, 1.5, 2.8][layer] + R() * [0.6, 0.9, 1.8][layer], sp: [16, 34, 64][layer] * (0.75 + R() * 0.5), ph: R() * TAU });
            });
            glints = Array.from({ length: preview ? 10 : 46 }, () => ({ x: R() * W, y: groundY + H * 0.03 + R() * (H - groundY), ph: R() * TAU, sp: 0.6 + R() * 1.6 }));
            stars = Array.from({ length: preview ? 30 : 140 }, () => ({ x: R() * W, y: R() * hz * 0.75, r: R() * 1.2 + 0.3, tw: R() * TAU }));
            clouds = Array.from({ length: 3 }, (_, i) => ({ x: R() * W, y: H * (0.06 + i * 0.07), s: 0.6 + R() * 0.7, sp: 4 + R() * 6 }));
        }
        setup();

        function drawCabin(g, x, base, s, t) {
            const w = s, h = s * 0.5;
            // warm light spilling onto the snow at night
            if (night) {
                const lg = g.createRadialGradient(x - w * 0.15, base + s * 0.05, 2, x - w * 0.15, base + s * 0.05, s * 0.9);
                lg.addColorStop(0, "rgba(255,190,90,.35)");
                lg.addColorStop(1, "rgba(255,170,60,0)");
                g.fillStyle = lg;
                g.fillRect(x - s, base - s * 0.4, s * 2, s * 1.2);
            }
            // log walls
            g.fillStyle = night ? "#3a271d" : "#7d4b2b";
            g.fillRect(x - w / 2, base - h, w, h);
            g.strokeStyle = night ? "#24170f" : "#59331c";
            g.lineWidth = Math.max(1, s * 0.012);
            for (let i = 1; i < 6; i++) { const y = base - h + i * h / 6; g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x + w / 2, y); g.stroke(); }
            g.fillStyle = night ? "#4c3426" : "#9a6038";
            for (let i = 0; i < 6; i++) for (const side of [-1, 1]) { g.beginPath(); g.arc(x + side * w / 2, base - h + (i + 0.5) * h / 6, h / 13, 0, TAU); g.fill(); }
            // the window, flickering with firelight
            const fl = 0.85 + Math.sin(t * 7.3) * 0.06 + Math.sin(t * 13.1) * 0.05;
            const wx = x - w * 0.36, wy = base - h * 0.74, ww = w * 0.24, wh = h * 0.38;
            const wg = g.createRadialGradient(wx + ww / 2, wy + wh * 0.7, 1, wx + ww / 2, wy + wh / 2, ww);
            wg.addColorStop(0, `rgba(255,225,140,${fl})`);
            wg.addColorStop(1, `rgba(240,140,50,${fl * 0.9})`);
            g.fillStyle = wg;
            g.fillRect(wx, wy, ww, wh);
            g.strokeStyle = night ? "#24170f" : "#4a2a16";
            g.lineWidth = Math.max(1.5, s * 0.018);
            g.strokeRect(wx, wy, ww, wh);
            g.beginPath(); g.moveTo(wx + ww / 2, wy); g.lineTo(wx + ww / 2, wy + wh); g.moveTo(wx, wy + wh / 2); g.lineTo(wx + ww, wy + wh / 2); g.stroke();
            g.fillStyle = "#ffffff";
            g.fillRect(wx - 2, wy + wh - 1, ww + 4, Math.max(2, h * 0.05));                   // snow on the sill
            // the door
            g.fillStyle = night ? "#2a1a12" : "#5a321b";
            g.fillRect(x + w * 0.1, base - h * 0.78, w * 0.22, h * 0.78);
            g.fillStyle = "#e8b04a";
            g.beginPath(); g.arc(x + w * 0.28, base - h * 0.38, Math.max(1.2, s * 0.012), 0, TAU); g.fill();
            // the chimney (behind the roof's snow)
            const chx = x + w * 0.2, chTop = base - h - s * 0.36;
            g.fillStyle = night ? "#4a3a3a" : "#8a5a4a";
            g.fillRect(chx, chTop, w * 0.12, s * 0.3);
            g.fillStyle = "#ffffff";
            g.beginPath(); g.ellipse(chx + w * 0.06, chTop, w * 0.085, s * 0.025, 0, 0, TAU); g.fill();
            // the roof, deep with snow, and icicles along its edge
            g.fillStyle = night ? "#2b1d16" : "#4f2f1c";
            g.beginPath(); g.moveTo(x - w * 0.62, base - h); g.lineTo(x, base - h - s * 0.42); g.lineTo(x + w * 0.62, base - h); g.closePath(); g.fill();
            g.fillStyle = night ? "#dfe8f6" : "#ffffff";
            g.beginPath();
            g.moveTo(x - w * 0.68, base - h + s * 0.02);
            g.quadraticCurveTo(x - w * 0.7, base - h - s * 0.06, x - w * 0.6, base - h - s * 0.07);
            g.lineTo(x, base - h - s * 0.5);
            g.lineTo(x + w * 0.6, base - h - s * 0.07);
            g.quadraticCurveTo(x + w * 0.7, base - h - s * 0.06, x + w * 0.68, base - h + s * 0.02);
            g.quadraticCurveTo(x + w * 0.4, base - h - s * 0.01, x, base - h - s * 0.33);
            g.quadraticCurveTo(x - w * 0.4, base - h - s * 0.01, x - w * 0.68, base - h + s * 0.02);
            g.fill();
            g.fillStyle = night ? "rgba(190,215,245,.85)" : "rgba(200,230,255,.95)";
            for (let i = 0; i < 9; i++) {
                const ix = x - w * 0.58 + i * w * 0.145, il = s * (0.05 + ((i * 37) % 5) * 0.018);
                g.beginPath(); g.moveTo(ix - s * 0.015, base - h + s * 0.01); g.lineTo(ix + s * 0.015, base - h + s * 0.01); g.lineTo(ix, base - h + s * 0.01 + il); g.fill();
            }
            return { x: chx + w * 0.06, y: chTop - s * 0.02 };
        }

        function drawFox(g, f, t) {
            g.save();
            g.translate(f.x, f.y);
            g.scale(f.dir * f.s, f.s);
            const step = Math.sin(t * 13), bob = Math.abs(step) * 1.5;
            g.translate(0, -bob);
            // tail
            g.fillStyle = "#d4652a";
            g.beginPath();
            g.moveTo(-16, -14);
            g.quadraticCurveTo(-36, -26 + step * 2, -50, -12);
            g.quadraticCurveTo(-36, -6, -16, -9);
            g.fill();
            g.fillStyle = "#fff8f0";
            g.beginPath(); g.ellipse(-47, -12.5, 5.5, 3.4, -0.3, 0, TAU); g.fill();
            // legs
            g.strokeStyle = "#3a2216";
            g.lineWidth = 3;
            g.lineCap = "round";
            for (const [lx, ph] of [[-11, 0], [-6, Math.PI], [9, Math.PI], [14, 0]]) {
                const sw = Math.sin(t * 13 + ph) * 5;
                g.beginPath(); g.moveTo(lx, -10); g.lineTo(lx + sw, 2 + bob); g.stroke();
            }
            // body and white chest
            g.fillStyle = "#e0702e";
            g.beginPath(); g.ellipse(0, -14, 19, 8.5, 0, 0, TAU); g.fill();
            g.fillStyle = "#fff4e8";
            g.beginPath(); g.ellipse(13, -11, 7, 5, 0.3, 0, TAU); g.fill();
            // head, ears and snout
            g.fillStyle = "#e0702e";
            g.beginPath(); g.moveTo(12, -24); g.quadraticCurveTo(22, -30, 31, -19); g.lineTo(23, -15); g.quadraticCurveTo(14, -14, 12, -24); g.fill();
            g.fillStyle = "#3a2216";
            g.beginPath(); g.moveTo(15, -25); g.lineTo(16, -34); g.lineTo(20, -27); g.fill();
            g.beginPath(); g.moveTo(19, -26); g.lineTo(22, -34); g.lineTo(24, -26); g.fill();
            g.beginPath(); g.arc(30.5, -19.5, 1.6, 0, TAU); g.fill();
            g.beginPath(); g.arc(21, -22.5, 1.2, 0, TAU); g.fill();
            g.restore();
        }

        function drawBird(g, b, t) {
            g.save();
            g.translate(b.x, b.y + Math.sin(t * 5) * 6);
            g.scale(b.dir * b.s, b.s);
            const flap = Math.sin(t * 22);
            g.fillStyle = "#c8202f";
            g.beginPath(); g.ellipse(0, 0, 11, 6.5, -0.15, 0, TAU); g.fill();
            g.beginPath(); g.moveTo(-9, -1); g.lineTo(-20, -4); g.lineTo(-19, 3); g.closePath(); g.fill();          // tail
            g.beginPath(); g.moveTo(6, -5); g.lineTo(9, -13); g.lineTo(12, -4); g.fill();                       // crest
            g.fillStyle = "#1a1a1a";
            g.beginPath(); g.ellipse(10, -1, 3.5, 3, 0, 0, TAU); g.fill();                                     // face mask
            g.fillStyle = "#f0a830";
            g.beginPath(); g.moveTo(12, -2); g.lineTo(17, 0); g.lineTo(12, 1.5); g.fill();
            g.fillStyle = "#9c1622";
            g.beginPath(); g.moveTo(-3, -2); g.lineTo(-10, -2 - 14 * flap); g.lineTo(4, -1); g.fill();          // wing
            g.restore();
        }

        return {
            resize(w, h) { W = w; H = h; setup(); },
            draw(g, t, dt, inp) {
                if (!sky) {
                    sky = g.createLinearGradient(0, 0, 0, groundY);
                    sky.addColorStop(0, C.top);
                    sky.addColorStop(0.55, C.mid);
                    sky.addColorStop(1, C.low);
                }
                g.fillStyle = sky;
                g.fillRect(0, 0, W, H);
                // wind: a gentle breeze, and a strong gust now and then
                nextGust -= dt;
                if (nextGust <= 0 && gustLeft <= 0) { gustLeft = 3.2; nextGust = U.rand(18, 32); }
                if (gustLeft > 0) { gustLeft -= dt; gust = Math.sin(Math.PI * (1 - gustLeft / 3.2)) * 150; } else gust = 0;
                const wind = Math.sin(t * 0.17) * 14 + Math.sin(t * 0.05 + 1) * 10 + gust;

                if (night) {
                    for (const s of stars) {
                        g.fillStyle = `rgba(255,255,255,${(0.3 + 0.7 * Math.abs(Math.sin(t * 1.1 + s.tw))).toFixed(2)})`;
                        g.fillRect(s.x - inp.px * 2, s.y, s.r * 1.4, s.r * 1.4);
                    }
                    // the northern lights: glowing curtains that ripple slowly
                    g.globalCompositeOperation = "lighter";
                    const step = preview ? 3 : 6;
                    auroraSpr.forEach((spr, i) => {
                        const base = H * (0.06 + i * 0.07), ph = i * 2.1;
                        for (let x = -step; x < W + step; x += step) {
                            const y = base + Math.sin(x * 0.0035 + t * 0.22 + ph) * H * 0.06 + Math.sin(x * 0.011 - t * 0.37 + ph) * H * 0.018;
                            const hgt = H * (0.17 + 0.07 * Math.sin(x * 0.006 + t * 0.29 + ph));
                            g.globalAlpha = Math.max(0, 0.16 + 0.14 * Math.sin(x * 0.013 + t * 0.6 + ph) + 0.06 * Math.sin(x * 0.041 - t));
                            g.drawImage(spr, x - inp.px * 3, y, step + 1, hgt);
                        }
                    });
                    g.globalAlpha = 1;
                    g.globalCompositeOperation = "source-over";
                    // the moon
                    const mx = W * 0.8 - inp.px * 5, my = H * 0.15, mr = Math.min(W, H) * 0.045;
                    const mg = g.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 4);
                    mg.addColorStop(0, "rgba(220,235,255,.35)");
                    mg.addColorStop(1, "rgba(220,235,255,0)");
                    g.fillStyle = mg;
                    g.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
                    g.fillStyle = "#f4f2e6";
                    g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill();
                    g.fillStyle = "rgba(170,170,160,.35)";
                    for (const [cx, cy, cr] of [[-0.3, -0.2, 0.22], [0.25, 0.1, 0.16], [-0.05, 0.4, 0.12], [0.35, -0.35, 0.09]]) { g.beginPath(); g.arc(mx + cx * mr, my + cy * mr, cr * mr, 0, TAU); g.fill(); }
                    // a shooting star now and then
                    nextMeteor -= dt;
                    if (!meteor && nextMeteor <= 0) meteor = { x: U.rand(0.2, 0.9) * W, y: U.rand(0.03, 0.25) * H, vx: -U.rand(380, 560), vy: U.rand(120, 220), life: 0.9 };
                    if (meteor) {
                        meteor.life -= dt; meteor.x += meteor.vx * dt; meteor.y += meteor.vy * dt;
                        const mgr = g.createLinearGradient(meteor.x, meteor.y, meteor.x - meteor.vx * 0.18, meteor.y - meteor.vy * 0.18);
                        mgr.addColorStop(0, `rgba(255,255,255,${Math.min(1, meteor.life * 2)})`);
                        mgr.addColorStop(1, "rgba(255,255,255,0)");
                        g.strokeStyle = mgr;
                        g.lineWidth = 2;
                        g.beginPath(); g.moveTo(meteor.x, meteor.y); g.lineTo(meteor.x - meteor.vx * 0.18, meteor.y - meteor.vy * 0.18); g.stroke();
                        if (meteor.life <= 0) { meteor = null; nextMeteor = U.rand(5, 12); }
                    }
                } else {
                    // a pale winter sun and slow clouds
                    const sx = W * 0.82 - inp.px * 5, sy = H * 0.13, sr = Math.min(W, H) * 0.05;
                    const sg = g.createRadialGradient(sx, sy, sr * 0.6, sx, sy, sr * 5);
                    sg.addColorStop(0, "rgba(255,252,235,.85)");
                    sg.addColorStop(0.3, "rgba(255,250,230,.3)");
                    sg.addColorStop(1, "rgba(255,250,230,0)");
                    g.fillStyle = sg;
                    g.fillRect(sx - sr * 5, sy - sr * 5, sr * 10, sr * 10);
                    g.fillStyle = "#fffdf2";
                    g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.fill();
                    for (const cl of clouds) {
                        cl.x += cl.sp * dt + gust * 0.02 * dt;
                        if (cl.x > W + 240) cl.x = -240;
                        g.drawImage(cloudSpr, cl.x - inp.px * 4, cl.y, 220 * cl.s * (preview ? 0.5 : 1), 90 * cl.s * (preview ? 0.5 : 1));
                    }
                    // a cardinal flies by now and then
                    nextBird -= dt;
                    if (!bird && nextBird <= 0) { const dir = Math.random() < 0.5 ? 1 : -1; bird = { dir, x: dir > 0 ? -30 : W + 30, y: U.rand(0.12, 0.4) * H, vx: dir * U.rand(90, 140), s: U.clamp(H / 900, 0.6, 1.2) }; }
                    if (bird) { bird.x += bird.vx * dt; drawBird(g, bird, t); if (bird.x < -60 || bird.x > W + 60) { bird = null; nextBird = U.rand(14, 26); } }
                }

                g.drawImage(mtn, -30 - inp.px * 4, 0);
                g.drawImage(far, -40 - inp.px * 8, 0);
                // a band of mist where the forest meets the valley
                const mist = g.createLinearGradient(0, hz - H * 0.02, 0, groundY + H * 0.02);
                mist.addColorStop(0, "rgba(255,255,255,0)");
                mist.addColorStop(0.6, C.mist);
                mist.addColorStop(1, "rgba(255,255,255,0)");
                g.fillStyle = mist;
                g.fillRect(0, hz - H * 0.02, W, groundY - hz + H * 0.04);
                g.drawImage(ground, -20 - inp.px * 6, groundY - H * 0.05);

                // the cabin and its chimney smoke
                const cs = U.clamp(H * (preview ? 0.2 : 0.17), 40, 170), cabX = Math.max(cs * 0.75, W * 0.1) - inp.px * 9;
                const chim = drawCabin(g, cabX, groundY + H * 0.025, cs, t);
                smokeIn -= dt;
                if (smokeIn <= 0) { smokeIn = 0.16; smoke.push({ x: chim.x, y: chim.y, r: cs * 0.03, a: 0.5, vx: 0, vy: -cs * 0.25 }); }
                smoke = smoke.filter(p => {
                    p.vx += (wind * 0.6 - p.vx) * dt * 0.8; p.x += p.vx * dt + Math.sin(t * 2 + p.y * 0.05) * 6 * dt; p.y += p.vy * dt;
                    p.r += cs * 0.06 * dt; p.a -= dt * 0.11;
                    if (p.a <= 0) return false;
                    g.fillStyle = night ? `rgba(170,180,200,${(p.a * 0.5).toFixed(3)})` : `rgba(235,238,242,${(p.a * 0.9).toFixed(3)})`;
                    g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
                    return true;
                });

                // glints on the snow
                for (const s of glints) {
                    const k = Math.max(0, Math.sin(t * s.sp + s.ph)) ** 10;
                    if (k < 0.05) continue;
                    const x = s.x - inp.px * 6, sz = 1 + k * 3;
                    g.fillStyle = `rgba(255,255,255,${k.toFixed(2)})`;
                    g.fillRect(x - sz, s.y - 0.5, sz * 2, 1);
                    g.fillRect(x - 0.5, s.y - sz, 1, sz * 2);
                }
                // a fox trots across, leaving footprints that slowly fill with snow
                nextFox -= dt;
                if (!fox && nextFox <= 0) { const dir = Math.random() < 0.5 ? 1 : -1; fox = { dir, x: dir > 0 ? -60 : W + 60, y: groundY + (H - groundY) * U.rand(0.45, 0.75), vx: dir * U.rand(70, 95), s: U.clamp(H / 820, 0.55, 1.25), printIn: 0 }; }
                for (let i = prints.length - 1; i >= 0; i--) {
                    const p = prints[i];
                    p.age += dt;
                    if (p.age > 16) { prints.splice(i, 1); continue; }
                    g.fillStyle = night ? `rgba(30,45,80,${(0.35 * (1 - p.age / 16)).toFixed(3)})` : `rgba(120,150,190,${(0.4 * (1 - p.age / 16)).toFixed(3)})`;
                    g.beginPath(); g.ellipse(p.x - inp.px * 6, p.y, 2.6 * p.s, 1.4 * p.s, 0, 0, TAU); g.fill();
                }
                if (fox) {
                    fox.x += fox.vx * dt;
                    fox.printIn -= dt;
                    if (fox.printIn <= 0) { fox.printIn = 0.16; prints.push({ x: fox.x + inp.px * 6, y: fox.y + (prints.length % 2 ? 2 : -2) * fox.s, s: fox.s, age: 0 }); }
                    drawFox(g, { ...fox, x: fox.x - inp.px * 6 }, t);
                    if (fox.x < -80 || fox.x > W + 80) { fox = null; nextFox = U.rand(16, 30); }
                }

                g.drawImage(near, -60 - inp.px * 16, 0);

                // the snowfall: far, middle and near layers, all pushed by the wind
                for (const f of flakes) {
                    const depth = 0.4 + f.layer * 0.4;
                    f.y += f.sp * dt;
                    f.x += (wind * depth + Math.sin(t * 1.3 + f.ph) * 8) * dt;
                    if (f.y > H + 6) { f.y = -6; f.x = Math.random() * W; }
                    if (f.x > W + 10) f.x -= W + 20; else if (f.x < -10) f.x += W + 20;
                    const x = f.x - inp.px * (3 + f.layer * 9);
                    if (f.layer === 0) { g.fillStyle = night ? "rgba(220,230,255,.6)" : "rgba(255,255,255,.75)"; g.fillRect(x, f.y, f.r, f.r); }
                    else { const d = f.r * 2.6; g.globalAlpha = f.layer === 2 ? 0.85 : 0.95; g.drawImage(flakeSpr, x - d / 2, f.y - d / 2, d, d); g.globalAlpha = 1; }
                }
            }
        };
    }

    // ---------------------------------------------------------------------------------------------
    // The board: snow on top, a crystal on every letter, frost on finished words, icicles underneath
    // ---------------------------------------------------------------------------------------------
    // one arm of a snowflake crystal (from the middle to the tip at y = -1); each kind branches differently
    const ARMS = [
        "M0 0V-1M0 -.45L-.24 -.66M0 -.45L.24 -.66M0 -.72L-.15 -.86M0 -.72L.15 -.86",
        "M0 0V-1M-.13 -.78L0 -.9L.13 -.78M0 -.36L-.2 -.48M0 -.36L.2 -.48",
        "M0 0V-1M0 -.3L-.26 -.42M0 -.3L.26 -.42M0 -.5L-.22 -.64M0 -.5L.22 -.64M0 -.7L-.14 -.82M0 -.7L.14 -.82",
        "M0 0V-.86M-.12 -.74L0 -1L.12 -.74M0 -.5L-.17 -.6M0 -.5L.17 -.6",
        "M0 -.2V-1M0 -.32L-.3 -.56M0 -.32L.3 -.56M0 -.62L-.2 -.8M0 -.62L.2 -.8"
    ];
    const HEX = "M0 -.22L.19 -.11L.19 .11L0 .22L-.19 .11L-.19 -.11Z";

    const board = (() => {
        let layer = null, gFrost, gFlake, icicles = [], crystals = new Map(), frosts = new Map(), seed = 1, size = 5, quiet = true, boardRef = null;
        const rnd = (...k) => { let h = seed; for (const v of k) { h = Math.imul(h ^ v, 2654435761); h ^= h >>> 13; } return (h >>> 0) / 4294967296; };

        function build(game, boardEl) {
            if (layer) layer.remove();
            size = game.puzzle.size;
            seed = U.hash(game.puzzle.seed + game.puzzle.mode + "snow");
            boardRef = boardEl;
            layer = U.svg("svg", { class: "snow-layer", viewBox: `0 0 ${size} ${size}`, preserveAspectRatio: "none", "aria-hidden": "true" });
            boardEl.appendChild(layer);
            gFrost = U.svg("g", {}, layer);
            gFlake = U.svg("g", {}, layer);
            const gIce = U.svg("g", {}, layer);
            // a cap of snow piled along the top edge, in soft lumps
            let d = `M-.07 .025 Q-.08 -.06 -.02 -.07`;
            const lumps = size * 2;
            for (let i = 0; i < lumps; i++) {
                const x1 = (i + 1) / lumps * size + (i === lumps - 1 ? 0.02 : 0), xm = (i + 0.5) / lumps * size;
                d += ` Q${xm.toFixed(3)} ${(-0.1 - rnd(i, 1) * 0.12).toFixed(3)} ${x1.toFixed(3)} ${(-0.05 - rnd(i, 2) * 0.03).toFixed(3)}`;
            }
            d += ` Q${size + 0.08} -.06 ${size + 0.07} .025 Q${size / 2} .045 -.07 .025Z`;
            U.svg("path", { d, class: "sn-cap" }, layer);
            // icicles hanging under the board; they grow as the squares fill up
            icicles = [];
            const n = size * 3;
            for (let i = 0; i < n; i++) {
                const x = (i + 0.25 + rnd(i, 7) * 0.5) / n * size, len = 0.1 + rnd(i, 8) * 0.2, w = 0.03 + rnd(i, 9) * 0.025;
                const el = U.svg("path", { d: `M${(x - w).toFixed(3)} ${size} Q${(x - w * 0.3).toFixed(3)} ${(size + len * 0.55).toFixed(3)} ${x.toFixed(3)} ${(size + len).toFixed(3)} Q${(x + w * 0.3).toFixed(3)} ${(size + len * 0.55).toFixed(3)} ${(x + w).toFixed(3)} ${size}Z`, class: "sn-icicle" }, gIce);
                el.style.transform = "scaleY(0)";
                icicles.push({ el, at: rnd(i, 10) });
            }
            crystals = new Map();
            frosts = new Map();
        }

        function crystal(r, c, grow) {
            const kind = Math.floor(rnd(r, c, 3) * ARMS.length);
            const [ox, oy] = [[0.8, 0.22], [0.8, 0.78], [0.21, 0.79]][Math.floor(rnd(r, c, 4) * 3)];
            const x = c + ox + (rnd(r, c, 5) - 0.5) * 0.06, y = r + oy + (rnd(r, c, 6) - 0.5) * 0.06, s = 0.1 + rnd(r, c, 7) * 0.05;
            const outer = U.svg("g", { transform: `translate(${x.toFixed(3)} ${y.toFixed(3)}) scale(${s.toFixed(3)})`, class: "sn-crystal" + (grow ? " grow" : "") }, gFlake);
            const spin = U.svg("g", { class: "sn-spin", style: `animation-duration:${(16 + rnd(r, c, 8) * 14).toFixed(1)}s` }, outer);
            for (let i = 0; i < 6; i++) U.svg("path", { d: ARMS[kind], transform: `rotate(${i * 60})`, pathLength: 1 }, spin);
            if (kind % 2 === 0) U.svg("path", { d: HEX, pathLength: 1 }, spin);
            return outer;
        }

        // feathery frost along a finished word: on the bottom edge of an across word, the right edge of a down word
        function frost(entry, cells, grow) {
            const across = entry.direction === "across", [r0, c0] = cells[0], len = cells.length, steps = len * 7;
            const gEl = U.svg("g", { class: "sn-frost" + (grow ? " grow" : "") }, gFrost);
            const pts = [];
            for (let i = 0; i <= steps; i++) {
                const u = 0.08 + i / steps * (len - 0.16), wob = (rnd(entry.number, across ? 11 : 12, i) - 0.5) * 0.025;
                pts.push(across ? [c0 + u, r0 + 0.935 + wob] : [c0 + 0.935 + wob, r0 + u]);
            }
            U.svg("polyline", { points: pts.map(p => p.map(v => v.toFixed(3)).join(",")).join(" "), pathLength: 1, class: "sn-frost-main" }, gEl);
            let d = "";
            for (let i = 1; i < steps; i++) {
                const [x, y] = pts[i], l = 0.03 + rnd(entry.number, across ? 13 : 14, i) * 0.05;
                if (across) d += `M${x.toFixed(3)} ${y.toFixed(3)}l${(-0.55 * l).toFixed(3)} ${(-l).toFixed(3)}M${x.toFixed(3)} ${y.toFixed(3)}l${(0.55 * l).toFixed(3)} ${(-l).toFixed(3)}`;
                else d += `M${x.toFixed(3)} ${y.toFixed(3)}l${(-l).toFixed(3)} ${(-0.55 * l).toFixed(3)}M${x.toFixed(3)} ${y.toFixed(3)}l${(-l).toFixed(3)} ${(0.55 * l).toFixed(3)}`;
            }
            U.svg("path", { d, pathLength: 1, class: "sn-frost-feather" }, gEl);
            return gEl;
        }

        function attach() { quiet = true; }
        function update(game, boardEl) {
            if (!layer || !boardEl.contains(layer) || size !== game.puzzle.size) { build(game, boardEl); quiet = true; }
            const grow = !quiet && U.motion() !== "still";
            quiet = false;
            const n = game.puzzle.size, sol = game.puzzle.solution;
            let open = 0, filled = 0;
            const want = new Set();
            for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
                if (sol[r][c] === "#") continue;
                open++;
                if (!game.letters[r][c]) continue;
                filled++;
                const key = r * 99 + c;
                want.add(key);
                if (!crystals.has(key)) crystals.set(key, crystal(r, c, grow));
            }
            for (const [key, el] of crystals) if (!want.has(key)) { el.remove(); crystals.delete(key); }
            const full = new Set(), iced = new Set();
            for (const entry of [...game.puzzle.across, ...game.puzzle.down]) {
                const cells = Game.cellsOf(entry);
                if (!cells.every(([r, c]) => game.letters[r][c])) continue;
                const key = entry.direction + entry.number;
                full.add(key);
                cells.forEach(([r, c]) => iced.add(r * 99 + c));
                if (!frosts.has(key)) frosts.set(key, frost(entry, cells, grow));
            }
            for (const [key, el] of frosts) if (!full.has(key)) { el.remove(); frosts.delete(key); }
            for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { const cell = Game.cellEl(r, c); if (cell) cell.classList.toggle("sn-iced", iced.has(r * 99 + c)); }
            const progress = open ? filled / open : 0;
            for (const ic of icicles) ic.el.style.transform = `scaleY(${U.clamp((progress - ic.at * 0.8) / 0.2, 0, 1).toFixed(3)})`;
            boardEl.classList.toggle("sn-frozen", !!(game.solved && !game.surrendered));
        }
        function type(cell) {
            const p = U.center(cell);
            FX.burst({ x: p.x, y: p.y + p.h * 0.1, n: 12, colors: ICE, shape: "circle", speed: [40, 130], angle: -Math.PI / 2, spread: 1.4, gravity: 160, drag: 2, life: [0.45, 0.85], size: [1.2, 2.8] });
        }
        function wordDone(entry, cells) {
            cells.forEach(([r, c], i) => setTimeout(() => {
                const cell = Game.cellEl(r, c);
                if (!cell) return;
                const p = U.center(cell);
                FX.burst({ x: p.x, y: p.y, n: 4, colors: ICE, shape: "flake", speed: [30, 90], gravity: 20, drag: 1.5, life: [0.6, 1], size: [4, 7], spin: 2, glow: document.documentElement.dataset.theme === "dark" });
                FX.ring({ x: p.x, y: p.y, color: "#bfe3ff", r0: 3, r1: p.w * 0.6, dur: 0.45, width: 3 });
            }, i * 60));
        }
        function restoreSolved(boardEl, game) { quiet = true; update(game, boardEl); }
        function clear() {
            if (layer) layer.remove();
            layer = null;
            crystals = new Map();
            frosts = new Map();
            icicles = [];
            Game.openCells().forEach(cell => cell.classList.remove("sn-iced", "sn-freeze"));
            if (boardRef) boardRef.classList.remove("sn-frozen");
        }
        return { attach, update, type, wordDone, restoreSolved, reset: clear, clear };
    })();

    // ---------------------------------------------------------------------------------------------
    // The win: freeze, snow globe, burst, snowman
    // ---------------------------------------------------------------------------------------------
    const SNOWMAN = `
        <svg class="sn-snowman" viewBox="0 0 150 210" aria-hidden="true">
            <defs><radialGradient id="snBall" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#eef5fc"/><stop offset="1" stop-color="#c9dcef"/></radialGradient></defs>
            <ellipse cx="75" cy="204" rx="56" ry="6" fill="rgba(60,90,130,.25)"/>
            <g class="snm-arm l"><path d="M44 112 L10 92 M22 99 L14 84 M22 99 L8 100" stroke="#5b3a22" stroke-width="4" stroke-linecap="round" fill="none"/></g>
            <g class="snm-arm r"><path d="M106 112 L140 90 M128 97 L136 82 M128 97 L144 100" stroke="#5b3a22" stroke-width="4" stroke-linecap="round" fill="none"/></g>
            <g class="snm-b"><circle cx="75" cy="166" r="40" fill="url(#snBall)"/></g>
            <g class="snm-m"><circle cx="75" cy="112" r="30" fill="url(#snBall)"/>
                <circle cx="75" cy="102" r="3.4" fill="#2b2b33"/><circle cx="75" cy="114" r="3.4" fill="#2b2b33"/><circle cx="75" cy="126" r="3.4" fill="#2b2b33"/></g>
            <g class="snm-scarf"><path d="M50 86 Q75 96 100 86 L101 95 Q75 105 49 95Z" fill="#d6455d"/><path d="M88 92 L94 120 L84 122 L80 95Z" fill="#b8344a"/></g>
            <g class="snm-h"><circle cx="75" cy="66" r="22" fill="url(#snBall)"/></g>
            <g class="snm-face"><circle cx="67" cy="61" r="3" fill="#2b2b33"/><circle cx="83" cy="61" r="3" fill="#2b2b33"/>
                <path d="M65 74 Q75 81 85 74" stroke="#2b2b33" stroke-width="2.6" stroke-linecap="round" fill="none"/></g>
            <g class="snm-nose"><path d="M75 66 L98 70 L75 72Z" fill="#f07c22"/></g>
            <g class="snm-hat"><rect x="54" y="41" width="42" height="6" rx="2" fill="#23262f"/><rect x="60" y="14" width="30" height="29" rx="3" fill="#23262f"/><rect x="60" y="34" width="30" height="5" fill="#d6455d"/></g>
        </svg>`;

    async function celebrate(c, { boardEl }) {
        if (U.motion() === "still") return;
        const b = boardEl.getBoundingClientRect();
        const cx = b.left + b.width / 2, cy = b.top + b.height / 2, R = Math.hypot(b.width, b.height) / 2 + 18;
        // 1. the board freezes, square by square from the corners in
        Sound.play("freeze");
        const corners = [[b.left, b.top], [b.right, b.top], [b.left, b.bottom], [b.right, b.bottom]];
        const maxD = Math.hypot(b.width, b.height) / 2;
        for (const cell of Game.openCells()) {
            const p = U.center(cell), d = Math.min(...corners.map(([x, y]) => Math.hypot(p.x - x, p.y - y)));
            cell.style.setProperty("--fz", Math.round(d / maxD * 650) + "ms");
            cell.classList.add("sn-freeze");
        }
        c.cleanup(() => Game.openCells().forEach(cell => cell.classList.remove("sn-freeze")));
        await c.wait(900);
        if (c.skipped) return;

        // 2. a snow globe forms around the board, and gets a good shake
        const globe = U.el("div", { class: "sn-globe", "aria-hidden": "true", style: { left: cx - R + "px", top: cy - R + "px", width: R * 2 + "px", height: R * 2 + "px" },
            html: `<div class="sn-glass"></div><div class="sn-base"><span>SNOW DAY!</span></div>` });
        document.getElementById("overlay").appendChild(globe);
        c.cleanup(() => globe.remove());
        Sound.play("whoosh");
        const flakes = Array.from({ length: U.motion() === "lite" ? 70 : 150 }, () => ({ a: Math.random() * TAU, d: Math.sqrt(Math.random()) * (R - 12), va: U.rand(1.6, 3.6) * (Math.random() < 0.5 ? -1 : 1), r: U.rand(1.2, 3.6), x: 0, y: 0, vy: 0 }));
        let phase = "swirl", et = 0, alive = true;
        FX.add({
            update(dt) {
                et += dt;
                for (const f of flakes) {
                    if (phase === "swirl") {
                        f.a += f.va * dt * (1 + 0.6 * Math.sin(et * 3 + f.r));
                        f.d = U.clamp(f.d + Math.sin(et * 4 + f.a * 2) * 50 * dt, 0, R - 12);
                        f.x = cx + Math.cos(f.a) * f.d;
                        f.y = cy + Math.sin(f.a) * f.d;
                    } else {
                        f.vy = Math.min(f.vy + 60 * dt, 30 + f.r * 12);
                        const nx = f.x + Math.sin(et * 2 + f.r * 3) * 12 * dt, ny = f.y + f.vy * dt;
                        if (Math.hypot(nx - cx, ny - cy) < R - 10) { f.x = nx; f.y = ny; } else f.vy = 0;
                    }
                }
                return alive;
            },
            draw(g) {
                g.save();
                g.beginPath();
                g.arc(cx, cy, R - 6, 0, TAU);
                g.clip();
                g.fillStyle = "#ffffff";
                for (const f of flakes) { g.beginPath(); g.arc(f.x, f.y, f.r, 0, TAU); g.fill(); }
                g.restore();
            }
        });
        c.cleanup(() => { alive = false; });
        await c.wait(450);
        if (c.skipped) return;
        Sound.play("jingle");
        const shake = [{ transform: "none" }, { transform: "translate(-14px, 4px) rotate(-7deg)" }, { transform: "translate(14px, -3px) rotate(7deg)" },
            { transform: "translate(-12px, 3px) rotate(-6deg)" }, { transform: "translate(10px, -2px) rotate(5deg)" }, { transform: "translate(-5px, 1px) rotate(-2deg)" }, { transform: "none" }];
        const a1 = globe.animate(shake, { duration: 1300, easing: "ease-in-out" }), a2 = boardEl.animate(shake, { duration: 1300, easing: "ease-in-out" });
        c.cleanup(() => { a1.cancel(); a2.cancel(); });
        await c.wait(1300);
        if (c.skipped) return;
        phase = "settle";
        await c.wait(1300);
        if (c.skipped) return;

        // 3. the globe bursts into a puff of snow and ice
        globe.classList.add("pop");
        alive = false;
        Sound.play("shatter");
        FX.flash("#ffffff", 450, 0.7);
        FX.ring({ x: cx, y: cy, color: "#cfeaff", r0: R * 0.8, r1: R * 2.4, dur: 0.9, width: 14, glow: false });
        FX.burst({ x: cx, y: cy, n: 90, colors: ["#ffffff", "#d7efff", "#a9d8ff"], shape: "spark", speed: [250, 800], gravity: 300, drag: 1, life: [0.6, 1.1], size: [1.5, 3], jitter: R * 0.5 });
        FX.burst({ x: cx, y: cy, n: 46, colors: ICE, shape: "flake", speed: [120, 480], gravity: 60, drag: 1.3, life: [1.4, 2.4], size: [5, 11], spin: 2.5, jitter: R * 0.4 });
        await c.wait(500);
        if (c.skipped) return;

        // 4. a snowman builds itself beside the board (or in front of it on narrow screens)
        const sw = 150, sh = 210, room = innerWidth - b.right;
        const sx = room > sw + 30 ? b.right + 18 : b.left > sw + 30 ? b.left - sw - 18 : cx - sw / 2;
        const sy = room > sw + 30 || b.left > sw + 30 ? b.bottom - sh : Math.min(innerHeight - sh - 10, b.bottom - sh * 0.7);
        const holder = U.el("div", { class: "sn-snowman-wrap", "aria-hidden": "true", style: { left: sx + "px", top: sy + "px" }, html: SNOWMAN });
        document.getElementById("overlay").appendChild(holder);
        c.cleanup(() => holder.remove());
        const part = sel => holder.querySelector(sel);
        const ease = "cubic-bezier(.3,1.4,.5,1)";
        part(".snm-b").animate([{ transform: "translateX(260px) rotate(320deg)" }, { transform: "none" }], { duration: 650, easing: "cubic-bezier(.2,.9,.3,1)", fill: "backwards" });
        setTimeout(() => Sound.play("plop"), 600);
        part(".snm-m").animate([{ transform: "translateY(-320px)" }, { transform: "none" }], { duration: 480, delay: 600, easing: ease, fill: "backwards" });
        setTimeout(() => Sound.play("plop"), 1000);
        part(".snm-scarf").animate([{ opacity: 0, transform: "scaleX(0)" }, { opacity: 1, transform: "none" }], { duration: 300, delay: 1050, fill: "backwards" });
        part(".snm-h").animate([{ transform: "translateY(-380px)" }, { transform: "none" }], { duration: 480, delay: 950, easing: ease, fill: "backwards" });
        setTimeout(() => Sound.play("plop"), 1350);
        part(".snm-face").animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: 1400, fill: "backwards" });
        part(".snm-nose").animate([{ transform: "scaleX(0)" }, { transform: "none" }], { duration: 300, delay: 1500, easing: ease, fill: "backwards" });
        part(".snm-hat").animate([{ transform: "translateY(-260px) rotate(-40deg)" }, { transform: "none" }], { duration: 600, delay: 1500, easing: ease, fill: "backwards" });
        setTimeout(() => Sound.play("pop"), 1950);
        part(".snm-arm.l").animate([{ transform: "scale(0)" }, { transform: "none" }], { duration: 300, delay: 1800, easing: ease, fill: "backwards" });
        part(".snm-arm.r").animate([{ transform: "scale(0)" }, { transform: "none" }, { transform: "rotate(-18deg)" }, { transform: "none" }, { transform: "rotate(-18deg)" }, { transform: "none" }],
            { duration: 1300, delay: 1800, easing: "ease-in-out", fill: "backwards" });
        // and a gentle snowfall over everything
        FX.burst({ x: innerWidth / 2, y: -20, jitter: innerWidth / 2, jitterY: 10, n: 70, colors: ["#ffffff", "#eaf6ff"], shape: "flake", speed: [10, 40], angle: Math.PI / 2, spread: 0.5, gravity: 25, drag: 0.2, life: [4, 6], size: [3, 7], spin: 1, wobble: 30, delay: [0, 1.6] });
        await c.wait(3300);
        if (c.skipped) return;
        holder.animate([{ opacity: 1 }, { opacity: 0, transform: "translateY(20px)" }], { duration: 400, fill: "forwards" });
        await c.wait(380);
    }

    // ---------------------------------------------------------------------------------------------
    // Title card: a snowy wooden sign swings down on two ropes
    // ---------------------------------------------------------------------------------------------
    async function titleCard(c, info) {
        const flakes = Array.from({ length: 28 }, () =>
            `<i class="tcw-flake" style="left:${U.rand(0, 100).toFixed(1)}%;--d:${U.rand(0, 2.2).toFixed(2)}s;--s:${U.rand(4, 10).toFixed(1)}px;--x:${U.rand(-40, 40).toFixed(0)}px;--t:${U.rand(2.6, 4.8).toFixed(2)}s"></i>`).join("");
        const card = U.el("div", { class: "tc tc-snow", "aria-hidden": "true", html: `
            <div class="tcw-flakes">${flakes}</div>
            <div class="tcw-sign">
                <i class="tcw-rope l"></i><i class="tcw-rope r"></i>
                <div class="tcw-board">
                    <div class="tcw-cap"></div>
                    <small>&#10052; ${U.esc(info.kicker)} &#10052;</small>
                    <h2>${U.esc(info.title)}</h2>
                    <p>${U.esc(info.sub)}</p>
                    <div class="tcw-icicles"></div>
                </div>
            </div>` });
        document.getElementById("overlay").appendChild(card);
        c.cleanup(() => card.remove());
        Sound.play("title");
        await c.wait(1900);
        if (c.skipped) return;
        card.classList.add("out");
        Sound.play("whoosh");
        await c.wait(450);
    }

    // ---------------------------------------------------------------------------------------------
    // The mascot: Pebble, a penguin in a knit hat and scarf
    // ---------------------------------------------------------------------------------------------
    function drawPebble(g, s) {
        const happy = s.mood === "happy", wow = s.mood === "wow", sad = s.mood === "sad";
        const bob = Math.sin(s.t * 2.2) * 2 - s.hop * 12;
        const waddle = Math.sin(s.t * (happy ? 8 : 2.2)) * (happy ? 0.09 : 0.03);
        g.save();
        g.translate(80, 96 + bob);
        g.rotate(waddle);
        g.lineWidth = 2.5;
        g.strokeStyle = "#141821";
        // feet
        g.fillStyle = "#f29a2e";
        for (const side of [-1, 1]) { g.beginPath(); g.ellipse(side * 14, 50, 12, 5, 0, 0, TAU); g.fill(); g.stroke(); }
        // flippers (one waves when happy or surprised)
        const flap = happy || wow ? Math.sin(s.t * 10) * 0.5 : 0;
        for (const side of [-1, 1]) {
            g.save();
            g.translate(side * 34, 4);
            g.rotate(side * (0.35 + (side > 0 ? -flap - (happy ? 0.6 : 0) : 0)));
            g.fillStyle = "#1c212c";
            g.beginPath(); g.ellipse(0, 14, 8, 21, 0, 0, TAU); g.fill(); g.stroke();
            g.restore();
        }
        // body
        const bg = g.createRadialGradient(-14, -18, 6, 0, 6, 54);
        bg.addColorStop(0, "#414a5c");
        bg.addColorStop(1, "#141821");
        g.fillStyle = bg;
        g.beginPath(); g.ellipse(0, 6, 37, 46, 0, 0, TAU); g.fill(); g.stroke();
        const wg = g.createRadialGradient(-6, 8, 4, 0, 16, 36);
        wg.addColorStop(0, "#ffffff");
        wg.addColorStop(1, "#dde8f3");
        g.fillStyle = wg;
        g.beginPath(); g.ellipse(0, 12, 27, 34, 0, 0, TAU); g.fill();
        // eyes
        const ex = s.look * 3;
        for (const side of [-1, 1]) {
            const x = side * 11 + ex, y = -18;
            g.fillStyle = "#ffffff";
            g.beginPath(); g.ellipse(x, y, 7.5, wow ? 9 : 8, 0, 0, TAU); g.fill();
            g.fillStyle = "#141821";
            if (s.blink > 0.5) { g.fillRect(x - 6, y, 12, 2.2); continue; }
            if (happy) { g.lineWidth = 2.6; g.beginPath(); g.arc(x, y + 3, 5, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); continue; }
            g.beginPath(); g.arc(x + side * 0.5, y + (sad ? 2 : 1), wow ? 4.6 : 3.6, 0, TAU); g.fill();
            g.fillStyle = "#ffffff";
            g.beginPath(); g.arc(x + 1.5, y - 1, 1.3, 0, TAU); g.fill();
            if (sad) { g.strokeStyle = "#141821"; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 6, y - 11 - side * 2); g.lineTo(x + 6, y - 11 + side * 2); g.stroke(); }
        }
        // rosy cheeks
        g.fillStyle = "rgba(255,120,140,.45)";
        for (const side of [-1, 1]) { g.beginPath(); g.ellipse(side * 19, -6, 5, 3, 0, 0, TAU); g.fill(); }
        // beak (it opens to talk)
        const open = Math.max(s.talk, wow ? 0.7 : 0) * 5;
        g.fillStyle = "#f29a2e";
        g.strokeStyle = "#a35b12";
        g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(-7, -9); g.lineTo(7, -9); g.lineTo(0, -1 - open * 0.2); g.closePath(); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(-5, -8 + open); g.lineTo(5, -8 + open); g.lineTo(0, -3 + open); g.closePath(); g.fill(); g.stroke();
        // scarf with a flapping end
        g.fillStyle = "#d6455d";
        g.strokeStyle = "#8f2234";
        g.lineWidth = 2;
        g.beginPath(); g.roundRect(-31, 2, 62, 11, 5); g.fill(); g.stroke();
        g.fillStyle = "#ffffff";
        for (let i = -24; i < 28; i += 12) g.fillRect(i, 3.5, 4, 8);
        const tail = Math.sin(s.t * 6) * 4;
        g.fillStyle = "#d6455d";
        g.beginPath(); g.moveTo(18, 10); g.quadraticCurveTo(30 + tail, 22, 26 + tail, 36); g.lineTo(16 + tail, 34); g.quadraticCurveTo(18, 22, 10, 12); g.fill(); g.stroke();
        // knit hat with a bobbing pom-pom
        g.fillStyle = "#3d7cc9";
        g.strokeStyle = "#1f4e86";
        g.beginPath(); g.ellipse(0, -36, 30, 18, 0, Math.PI, TAU); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = "#ffffff";
        g.beginPath(); g.roundRect(-31, -40, 62, 9, 4); g.fill(); g.stroke();
        g.strokeStyle = "rgba(255,255,255,.55)";
        g.lineWidth = 2;
        for (let i = -18; i <= 18; i += 9) { g.beginPath(); g.moveTo(i, -42); g.lineTo(i * 0.75, -52); g.stroke(); }
        const pom = Math.sin(s.t * 3) * 2 - s.hop * 4;
        g.fillStyle = "#ffffff";
        g.strokeStyle = "#c9d8e8";
        g.beginPath(); g.arc(0, -56 + pom, 7.5, 0, TAU); g.fill(); g.stroke();
        g.restore();
    }

    // ---------------------------------------------------------------------------------------------
    // Sounds: crunchy snow, sleigh bells and icy chimes
    // ---------------------------------------------------------------------------------------------
    function bells(t0, n, v, spread = 0.06) {
        for (let i = 0; i < n; i++) {
            const t = t0 + i * spread + Math.random() * spread * 0.4;
            tone({ t, f: U.rand(2400, 4200), type: "triangle", d: 0.14, v });
            tone({ t, f: U.rand(5200, 6800), type: "sine", d: 0.08, v: v * 0.5 });
        }
    }
    const chime = (t, notes, v = 0.045, step = 0.07) => notes.forEach((n, i) => tone({ t: t + i * step, f: midi(n), type: "sine", d: 0.9, v, echo: 0.45 }));
    const sounds = {
        type: () => { noise({ type: "bandpass", f: U.rand(1600, 2800), q: 0.8, d: 0.07, v: 0.09 }); if (Math.random() < 0.35) tone({ f: U.rand(2600, 3400), type: "sine", d: 0.1, v: 0.018, echo: 0.3 }); },
        erase: () => noise({ type: "lowpass", f: 2400, f2: 600, d: 0.14, v: 0.08 }),
        move: () => {},
        word: () => { bells(0, 6, 0.014, 0.045); chime(0.05, [79, 83, 86, 91]); },
        wrong: () => { tone({ f: 190, f2: 140, type: "sawtooth", d: 0.36, v: 0.035, filt: { f: 700 } }); noise({ type: "bandpass", f: 320, q: 3, d: 0.3, v: 0.06 }); },
        right: () => chime(0, [84, 88, 91, 96], 0.04, 0.06),
        reveal: () => { tone({ f: 3200, f2: 1200, type: "sine", d: 0.35, v: 0.05, echo: 0.35 }); noise({ type: "highpass", f: 5000, d: 0.3, v: 0.03 }); },
        flip: () => tone({ f: U.rand(2600, 3400), type: "sine", d: 0.08, v: 0.035 }),
        freeze: () => {
            for (let i = 0; i < 14; i++) noise({ t: i * 0.055 + Math.random() * 0.03, type: "highpass", f: 3500 + Math.random() * 3500, d: 0.035, v: 0.09 });
            tone({ f: 2400, f2: 700, type: "sine", d: 0.9, v: 0.03, echo: 0.4 });
        },
        jingle: () => { bells(0, 22, 0.02, 0.055); noise({ type: "bandpass", f: 900, f2: 2400, q: 0.7, d: 1.2, v: 0.06 }); },
        shatter: () => { noise({ type: "highpass", f: 2500, d: 0.5, v: 0.22 }); for (let i = 0; i < 12; i++) tone({ t: Math.random() * 0.5, f: U.rand(2000, 5000), type: "sine", d: 0.3, v: 0.025, echo: 0.4 }); },
        plop: () => { tone({ f: 170, f2: 70, d: 0.2, v: 0.32 }); noise({ type: "lowpass", f: 900, d: 0.12, v: 0.14 }); },
        pop: () => { tone({ f: 500, f2: 1100, type: "sine", d: 0.1, v: 0.1 }); bells(0.05, 3, 0.015); },
        win: () => {},
        streak: () => { bells(0, 8, 0.016, 0.04); chime(0.1, [72, 79, 84, 91]); },
        achievement: () => { bells(0, 10, 0.016, 0.04); chime(0.15, [76, 83, 88, 95], 0.05, 0.09); },
        title: () => { noise({ type: "bandpass", f: 300, f2: 1600, q: 0.6, d: 1.1, v: 0.1, a: 0.4 }); bells(0.4, 6, 0.014); chime(0.45, [72, 76, 79, 84], 0.04, 0.1); },
        tile: i => tone({ f: midi(79 + (i % 6) * 2), type: "sine", d: 0.35, v: 0.045, echo: 0.35 }),
        start: () => { noise({ type: "bandpass", f: 200, f2: 3000, q: 0.6, d: 1, v: 0.12, a: 0.3 }); bells(0.3, 12, 0.018, 0.05); chime(0.4, [60, 67, 72, 76, 79], 0.04, 0.08); },
        select: () => tone({ f: 2640, type: "sine", d: 0.07, v: 0.04, echo: 0.2 }),
        nav: () => { noise({ type: "bandpass", f: 500, f2: 2600, q: 0.8, d: 0.25, v: 0.07 }); tone({ f: midi(88), type: "sine", d: 0.3, v: 0.035, echo: 0.3 }); },
        mascot: () => { tone({ f: 900, f2: 1500, type: "sine", d: 0.08, v: 0.06 }); tone({ t: 0.09, f: 1100, f2: 1700, type: "sine", d: 0.09, v: 0.05 }); }
    };

    Worlds.register({
        id: "snow", name: "Snow Day", icon: "❄️", tagline: "Snowfall, pine forests & a cozy cabin (northern lights at night)",
        modes: ["light", "dark"],
        scene, board, celebrate, titleCard, sounds, transition: "blizzard",
        mascot: { name: "PEBBLE", draw: drawPebble },
        lines: {
            hello: ["Brrr! Perfect puzzle weather.", "Grab a cocoa. Today's puzzles are fresh as new snow.", "Snow day! No school, just puzzles."],
            start: ["Tap a square and start typing. Space flips Across and Down!", "Every letter makes a snowflake. Let's fill the board!"],
            word: ["Ice one!", "Snow way, nice!", "Cool!", "Flake-tastic!", "Chill work!", "That word froze solid!"],
            win: ["Snow day! You aced it.", "Ice-cold solving!", "That's one frosty finish!"],
            wrong: ["A few letters are on thin ice.", "Brrr, some of those need another look."],
            right: ["All clear, no black ice!", "Smooth as fresh snow!"],
            idle: ["Frozen? Try a crossing word to thaw it out.", "Even penguins get stuck. Try the shortest clue!"],
            reveal: ["Brushing off a little snow...", "Here's a snowball of help."]
        },
        introFlourish(stage) {
            const p = U.center(stage);
            FX.ring({ x: p.x, y: p.y, color: "#cfeaff", r1: Math.max(innerWidth, innerHeight) * 0.6, dur: 1.2, width: 16 });
            FX.burst({ x: p.x, y: p.y, n: 80, colors: ICE, shape: "flake", speed: [150, 600], gravity: 40, drag: 1.4, life: [1.4, 2.4], size: [4, 10], spin: 2 });
        }
    });
})();
