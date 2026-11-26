// The Robot Factory's background (robot.js uses it). A factory hall in depth: a riveted back wall of brushed
// steel panels with a hazard-striped bay door, I-beam girders and a catwalk with railings, pipes overhead with
// valves that vent steam, lamps hanging on cables with cones of light, great shaded gears meshing on the wall, a
// control console whose screens draw live waveforms and blink, a conveyor in front carrying crates and robot
// parts, two articulated robot arms (one welding, throwing sparks), a drone with spinning rotors, and a grated
// floor that catches the light. Day: a bright clean lab. Night: the night shift in dark steel, orange beacons
// sweeping the walls.
function RobotScene(W, H, opts) {
    const night = opts.theme === "dark", preview = !!opts.preview, TAU = Math.PI * 2;
    const P = night
        ? { wall: ["#1a2028", "#141920", "#202832"], rivet: "#2e3844", beam: ["#2a3038", "#1a1e24"], floor: ["#14181e", "#0c0f13"], pipe: ["#3a4450", "#1e242c"], gear: ["#3a4450", "#22282f", "#58646f"], hazard: ["#c89a1a", "#1a1a1a"], lampLight: "rgba(160,210,255,", screen: "#0a1a24", glow: "#4ad8ff" }
        : { wall: ["#d8dee4", "#c8d0d8", "#e4e9ee"], rivet: "#a8b2bc", beam: ["#7a8692", "#5a646e"], floor: ["#9aa4ae", "#7c8690"], pipe: ["#b8c2cc", "#7a8692"], gear: ["#9aa6b2", "#6e7a86", "#d4dce4"], hazard: ["#f2c11a", "#2a2a2a"], lampLight: "rgba(255,250,220,", screen: "#0e2a20", glow: "#3ae6a0" };
    let layers = null, gears = [], steams = [], crates = [], sparks = [], drone = null, waves = [], beacons = [], lamps = [];
    const k = () => (preview ? 0.5 : U.clamp(Math.min(W, H) / 900, 0.6, 1.1));
    const FLOOR = () => H * 0.78, BELT = () => H * 0.86;
    function paint(w, h, fn) { const c = Worlds.canvas(w, h), g = c.getContext("2d"); fn(g); return c; }
    function metal(g, x, y, w, h, cols, vertical = false) {
        const mg = vertical ? g.createLinearGradient(x, 0, x + w, 0) : g.createLinearGradient(0, y, 0, y + h);
        mg.addColorStop(0, cols[2] || cols[0]); mg.addColorStop(0.5, cols[0]); mg.addColorStop(1, cols[1]);
        g.fillStyle = mg; g.fillRect(x, y, w, h);
    }
    function gearShape(g, x, y, r, n, a, cols) {
        g.save(); g.translate(x, y); g.rotate(a);
        g.beginPath();
        for (let i = 0; i < n * 2; i++) { const ang = (i / (n * 2)) * TAU, rr = i % 2 ? r * 0.82 : r; g.lineTo(Math.cos(ang - 0.08) * rr, Math.sin(ang - 0.08) * rr); g.lineTo(Math.cos(ang + 0.08) * rr, Math.sin(ang + 0.08) * rr); }
        g.closePath();
        const gg = g.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
        gg.addColorStop(0, cols[2]); gg.addColorStop(0.6, cols[0]); gg.addColorStop(1, cols[1]);
        g.fillStyle = gg; g.fill();
        g.strokeStyle = "rgba(0,0,0,.25)"; g.lineWidth = 1.5; g.stroke();
        g.fillStyle = cols[1]; g.beginPath(); g.arc(0, 0, r * 0.55, 0, TAU); g.fill();
        for (let i = 0; i < 5; i++) { const ang = (i / 5) * TAU; g.fillStyle = night ? "#0c1014" : "#4a545e"; g.beginPath(); g.arc(Math.cos(ang) * r * 0.36, Math.sin(ang) * r * 0.36, r * 0.11, 0, TAU); g.fill(); }
        g.fillStyle = cols[2]; g.beginPath(); g.arc(0, 0, r * 0.16, 0, TAU); g.fill();
        g.restore();
    }
    function setup() {
        const R = U.rng(2024), s = k(), fl = FLOOR();
        layers = {
            wall: paint(W, H, g => {
                // brushed steel panels, rivets at their corners, a seam of shadow between them
                const pw = 160 * s + 40, ph = 110 * s + 30;
                for (let y = 0; y < fl; y += ph) for (let x = 0; x < W; x += pw) {
                    metal(g, x, y, pw - 3, ph - 3, [P.wall[(Math.floor(x / pw) + Math.floor(y / ph)) % 2], P.wall[1], P.wall[2]]);
                    g.strokeStyle = night ? "rgba(255,255,255,.02)" : "rgba(255,255,255,.12)"; g.lineWidth = 1;
                    for (let l = 0; l < 10; l++) { const yy = y + 4 + R() * (ph - 10), x0 = x + 8 + R() * 20; g.beginPath(); g.moveTo(x0, yy); g.lineTo(x0 + (pw - 40) * (0.5 + R() * 0.4), yy + (R() - 0.5) * 2); g.stroke(); }
                    g.fillStyle = P.rivet;
                    for (const [rx, ry] of [[6, 6], [pw - 9, 6], [6, ph - 9], [pw - 9, ph - 9]]) { g.beginPath(); g.arc(x + rx, y + ry, 2.4, 0, TAU); g.fill(); }
                }
                // the bay door, hazard-striped frame and slatted shutter
                const dx = W * 0.42, dw = Math.min(W * 0.26, 340 * s), dh = Math.min(H * 0.42, 300 * s), dy = fl - dh;
                g.fillStyle = P.hazard[1]; g.fillRect(dx - 14, dy - 14, dw + 28, dh + 14);
                g.save(); g.beginPath(); g.rect(dx - 14, dy - 14, dw + 28, dh + 14); g.rect(dx, dy, dw, dh); g.clip("evenodd");
                g.fillStyle = P.hazard[0]; for (let i = -10; i < 40; i++) { g.beginPath(); g.moveTo(dx - 14 + i * 22, dy - 14); g.lineTo(dx - 14 + i * 22 + 11, dy - 14); g.lineTo(dx - 14 + i * 22 + 11 - dh, dy + dh); g.lineTo(dx - 14 + i * 22 - dh, dy + dh); g.fill(); }
                g.restore();
                for (let y = dy; y < fl; y += 12 * s) { metal(g, dx, y, dw, 12 * s - 1, P.beam); }
                g.fillStyle = night ? "rgba(255,170,60,.15)" : "rgba(255,255,255,.3)"; g.fillRect(dx, fl - 8, dw, 8);
                // the catwalk across the top: an I-beam, a deck and railings
                const cy = H * 0.3;
                metal(g, 0, cy, W, 16 * s, P.beam);
                g.fillStyle = P.beam[1]; g.fillRect(0, cy + 16 * s, W, 5 * s);
                g.strokeStyle = P.beam[0]; g.lineWidth = 2.5;
                g.beginPath(); g.moveTo(0, cy - 34 * s); g.lineTo(W, cy - 34 * s); g.moveTo(0, cy - 17 * s); g.lineTo(W, cy - 17 * s); g.stroke();
                g.lineWidth = 2; g.beginPath(); for (let x = 10; x < W; x += 34 * s) { g.moveTo(x, cy - 34 * s); g.lineTo(x, cy); } g.stroke();
                // vertical girders holding it up, with cross bracing
                for (const gx of [W * 0.06, W * 0.94]) {
                    metal(g, gx - 12 * s, 0, 24 * s, fl, P.beam, true);
                    g.strokeStyle = P.beam[1]; g.lineWidth = 3;
                    for (let y = 0; y < fl; y += 60 * s) { g.beginPath(); g.moveTo(gx - 12 * s, y); g.lineTo(gx + 12 * s, y + 60 * s); g.moveTo(gx + 12 * s, y); g.lineTo(gx - 12 * s, y + 60 * s); g.stroke(); }
                }
                // the floor: grated plates, a hazard edge, a sheen where the lamps fall
                const fg = g.createLinearGradient(0, fl, 0, H);
                fg.addColorStop(0, P.floor[0]); fg.addColorStop(1, P.floor[1]);
                g.fillStyle = fg; g.fillRect(0, fl, W, H - fl);
                g.strokeStyle = night ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.08)"; g.lineWidth = 1;
                for (let x = 0; x < W; x += 9) { g.beginPath(); g.moveTo(x, fl); g.lineTo(x + (x - W / 2) * 0.3, H); g.stroke(); }
                g.fillStyle = P.hazard[0]; for (let x = 0; x < W; x += 28) g.fillRect(x, fl, 14, 6);
            }),
            pipes: paint(W, H, g => {
                // pipes along the top: shaded cylinders, flanges, valves with red wheels
                for (const [y, r] of [[H * 0.08, 14 * s], [H * 0.14, 9 * s], [H * 0.19, 11 * s]]) {
                    metal(g, 0, y - r, W, r * 2, P.pipe);
                    for (let x = 60; x < W; x += 180 + R() * 140) {
                        metal(g, x - 4, y - r - 4, 8, r * 2 + 8, P.pipe, true);
                        if (R() < 0.5) { g.strokeStyle = "#c8282f"; g.lineWidth = 3; g.beginPath(); g.arc(x + 20, y - r - 10, 8 * s, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(x + 20, y - r - 18 * s); g.lineTo(x + 20, y - r - 2 * s); g.moveTo(x + 12 * s, y - r - 10); g.lineTo(x + 28 * s, y - r - 10); g.stroke(); }
                    }
                }
                // a drop pipe down the left side into a tank
                metal(g, W * 0.16, H * 0.19, 18 * s, H * 0.32, P.pipe, true);
                g.fillStyle = P.pipe[1]; g.beginPath(); g.roundRect(W * 0.12, H * 0.5, 80 * s, fl - H * 0.5, 16 * s); g.fill();
                metal(g, W * 0.12 + 6, H * 0.5 + 6, 80 * s - 12, fl - H * 0.5 - 12, P.pipe, true);
                g.fillStyle = night ? "#c89a1a" : "#f2c11a"; g.fillRect(W * 0.12 + 10, H * 0.62, 80 * s - 20, 10);
            })
        };
        gears = [[W * 0.78, H * 0.45, 70, 14, 1], [W * 0.78 + 70 * s * 1.6, H * 0.45 - 30 * s, 42, 9, -1.55], [W * 0.3, H * 0.5, 50, 11, 1], [W * 0.3 - 50 * s * 1.55, H * 0.5 + 34 * s, 32, 7, -1.6]].map(([x, y, r, n, sp]) => ({ x, y, r: r * s, n, sp }));
        steams = Array.from({ length: preview ? 0 : 3 }, (_, i) => ({ x: W * (0.2 + i * 0.3), y: H * 0.08 + 14 * s, t: R() * 6, burst: 0 }));
        crates = Array.from({ length: 6 }, (_, i) => ({ x: i * (W / 5), kind: i % 3 }));
        lamps = [W * 0.25, W * 0.55, W * 0.82].map(x => ({ x, y: H * 0.36 }));
        waves = Array.from({ length: 80 }, () => R());
        beacons = night ? [W * 0.12, W * 0.88].map(x => ({ x, y: H * 0.27 })) : [];
        drone = preview ? null : { x: -60, y: H * 0.42, vx: 60 };
    }
    setup();

    function arm(g, bx, by, t, ph, s, welding) {
        // a base, two segments and a gripper; each joint drawn as a shaded disc, cables along the arm
        const a1 = -1.9 + Math.sin(t * 0.8 + ph) * 0.35, a2 = 1.3 + Math.sin(t * 1.1 + ph) * 0.45, L1 = 110 * s0(), L2 = 90 * s0();
        const jx = bx + Math.cos(a1) * L1, jy = by + Math.sin(a1) * L1, ex = jx + Math.cos(a1 + a2) * L2, ey = jy + Math.sin(a1 + a2) * L2;
        const seg = (x0, y0, x1, y1, w) => {
            g.strokeStyle = night ? "#c8781a" : "#f28a1a"; g.lineWidth = w; g.lineCap = "round"; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
            g.strokeStyle = "rgba(255,255,255,.28)"; g.lineWidth = w * 0.25; g.beginPath(); g.moveTo(x0, y0 - w * 0.25); g.lineTo(x1, y1 - w * 0.25); g.stroke();
        };
        g.fillStyle = night ? "#2a3038" : "#5a646e"; g.beginPath(); g.roundRect(bx - 30 * s, by - 6, 60 * s, 26 * s, 6); g.fill();
        seg(bx, by, jx, jy, 22 * s); seg(jx, jy, ex, ey, 16 * s);
        g.strokeStyle = "#222"; g.lineWidth = 2; g.beginPath(); g.moveTo(bx + 8, by); g.quadraticCurveTo((bx + jx) / 2 + 20, (by + jy) / 2, jx + 6, jy + 4); g.stroke();
        for (const [x, y, r] of [[bx, by, 15], [jx, jy, 12]]) { const jg = g.createRadialGradient(x - 4, y - 4, 1, x, y, r * s); jg.addColorStop(0, "#f2f4f6"); jg.addColorStop(1, "#6a727c"); g.fillStyle = jg; g.beginPath(); g.arc(x, y, r * s, 0, TAU); g.fill(); }
        g.fillStyle = "#4a525c"; g.save(); g.translate(ex, ey); g.rotate(a1 + a2); g.fillRect(0, -10 * s, 18 * s, 20 * s); g.fillRect(18 * s, -12 * s, 10 * s, 6 * s); g.fillRect(18 * s, 6 * s, 10 * s, 6 * s); g.restore();
        if (welding && Math.sin(t * 3 + ph) > 0.2) {
            const tx = ex + Math.cos(a1 + a2) * 26 * s, ty = ey + Math.sin(a1 + a2) * 26 * s;
            Worlds.glow(g, tx, ty, 30 * s, "#bfe8ff", 0.9); Worlds.glow(g, tx, ty, 8 * s, "#ffffff", 1);
            if (Math.random() < 0.6) for (let i = 0; i < 3; i++) sparks.push({ x: tx, y: ty, vx: U.rand(-160, 160), vy: U.rand(-220, -40), life: U.rand(0.4, 0.9) });
        }
    }
    const s0 = () => k();
    return {
        resize(w, h) { W = w; H = h; setup(); },
        draw(g, t, dt, inp) {
            const s = k(), fl = FLOOR(), bl = BELT();
            g.drawImage(layers.wall, -inp.px * 3, 0);
            // the wall's gears, meshing (each turns at a speed set by its size)
            for (const gr of gears) gearShape(g, gr.x - inp.px * 5, gr.y, gr.r, gr.n, t * 0.4 * gr.sp * (70 / (gr.r / s)), P.gear);
            // the console under the catwalk: screens drawing a moving waveform, rows of lamps blinking
            const cx = W * 0.62, cy = H * 0.52, cw = 170 * s, ch = 96 * s;
            g.fillStyle = night ? "#2a3038" : "#8a96a2"; g.beginPath(); g.roundRect(cx, cy, cw, ch, 8); g.fill();
            g.fillStyle = P.screen; g.fillRect(cx + 10 * s, cy + 10 * s, cw * 0.55, ch * 0.62);
            g.strokeStyle = P.glow; g.lineWidth = 1.6; g.beginPath();
            for (let i = 0; i < 40; i++) { const x = cx + 12 * s + (i / 39) * (cw * 0.55 - 4 * s), y = cy + 10 * s + ch * 0.31 + Math.sin(i * 0.5 + t * 4) * ch * 0.12 * waves[i]; g[i ? "lineTo" : "moveTo"](x, y); }
            g.stroke();
            Worlds.glow(g, cx + 10 * s + cw * 0.27, cy + 10 * s + ch * 0.31, cw * 0.35, P.glow, night ? 0.35 : 0.15);
            for (let i = 0; i < 12; i++) { const on = Math.sin(t * (1.5 + (i % 4)) + i * 2) > 0; g.fillStyle = on ? ["#ff4a4a", "#ffd23a", "#3ae6a0", "#4ad8ff"][i % 4] : "#2a2f36"; g.beginPath(); g.arc(cx + cw * 0.7 + (i % 3) * 14 * s, cy + 18 * s + Math.floor(i / 3) * 16 * s, 4 * s, 0, TAU); g.fill(); if (on && night) Worlds.glow(g, cx + cw * 0.7 + (i % 3) * 14 * s, cy + 18 * s + Math.floor(i / 3) * 16 * s, 10 * s, g.fillStyle, 0.5); }
            g.drawImage(layers.pipes, -inp.px * 6, 0);
            // steam bursting from the valves now and then
            for (const st of steams) {
                st.t -= dt; if (st.t <= 0) { st.t = U.rand(4, 9); st.burst = 1.6; }
                if (st.burst > 0) {
                    st.burst -= dt;
                    for (let i = 0; i < 8; i++) { const q = (1.6 - st.burst) + i * 0.05; const x = st.x + q * 50 + Math.sin(i) * 8, y = st.y + q * 30; g.fillStyle = night ? `rgba(180,190,210,${(0.18 * st.burst).toFixed(3)})` : `rgba(255,255,255,${(0.4 * st.burst).toFixed(3)})`; g.beginPath(); g.arc(x - inp.px * 6, y, 8 + q * 18, 0, TAU); g.fill(); }
                }
            }
            // lamps hanging from the catwalk: a cable, a shade, a cone of light
            for (const L of lamps) {
                const x = L.x - inp.px * 6, y = L.y + Math.sin(t * 0.7 + L.x) * 1.5;
                g.strokeStyle = "#2a2a2a"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, H * 0.3); g.lineTo(x, y); g.stroke();
                const cg = g.createLinearGradient(0, y, 0, fl);
                cg.addColorStop(0, P.lampLight + (night ? ".28)" : ".35)")); cg.addColorStop(1, P.lampLight + "0)");
                g.fillStyle = cg; g.beginPath(); g.moveTo(x - 14 * s, y + 8 * s); g.lineTo(x - 140 * s, fl + 20); g.lineTo(x + 140 * s, fl + 20); g.lineTo(x + 14 * s, y + 8 * s); g.fill();
                g.fillStyle = night ? "#3a4450" : "#5a646e"; g.beginPath(); g.moveTo(x - 18 * s, y + 10 * s); g.lineTo(x - 8 * s, y); g.lineTo(x + 8 * s, y); g.lineTo(x + 18 * s, y + 10 * s); g.fill();
                Worlds.glow(g, x, y + 10 * s, 20 * s, "#fff6d0", night ? 0.9 : 0.6);
            }
            // night beacons, turning, their beams sweeping the wall
            for (const b of beacons) {
                const a = t * 3, bx = b.x - inp.px * 5;
                const bg = g.createLinearGradient(bx, b.y, bx + Math.cos(a) * W * 0.4, b.y + Math.sin(a) * H * 0.2);
                bg.addColorStop(0, "rgba(255,150,40,.3)"); bg.addColorStop(1, "rgba(255,150,40,0)");
                g.fillStyle = bg; g.beginPath(); g.moveTo(bx, b.y); g.lineTo(bx + Math.cos(a - 0.15) * W * 0.4, b.y + Math.sin(a - 0.15) * H * 0.3); g.lineTo(bx + Math.cos(a + 0.15) * W * 0.4, b.y + Math.sin(a + 0.15) * H * 0.3); g.fill();
                g.fillStyle = "#ff9a2a"; g.beginPath(); g.arc(bx, b.y, 9 * s, Math.PI, TAU); g.fill(); Worlds.glow(g, bx, b.y, 26 * s, "#ff9a2a", 0.7 + 0.3 * Math.sin(a * 2));
            }
            // the conveyor: a belt with rollers, crates and robot parts riding along it
            g.fillStyle = night ? "#1a1e24" : "#3a4048"; g.fillRect(0, bl - 6 * s, W, 34 * s);
            g.fillStyle = night ? "#2a3038" : "#5a646e";
            const roll = (t * 60) % (30 * s);
            for (let x = -roll; x < W; x += 30 * s) { g.beginPath(); g.arc(x, bl + 20 * s, 9 * s, 0, TAU); g.fill(); }
            g.fillStyle = night ? "#0c0f13" : "#2a2e34"; g.fillRect(0, bl - 6 * s, W, 8 * s);
            g.strokeStyle = night ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.12)"; g.lineWidth = 1; g.beginPath(); for (let x = -roll * 2; x < W; x += 14 * s) { g.moveTo(x, bl - 6 * s); g.lineTo(x, bl + 2 * s); } g.stroke();
            for (const c of crates) {
                c.x += 60 * dt; if (c.x > W + 80) c.x -= W + 160;
                const x = c.x, y = bl - 6 * s;
                if (c.kind === 0) {                                // a wooden crate
                    g.fillStyle = "#b8864a"; g.fillRect(x - 26 * s, y - 44 * s, 52 * s, 44 * s); g.strokeStyle = "#7a5228"; g.lineWidth = 3; g.strokeRect(x - 26 * s, y - 44 * s, 52 * s, 44 * s); g.beginPath(); g.moveTo(x - 26 * s, y - 44 * s); g.lineTo(x + 26 * s, y); g.stroke();
                } else if (c.kind === 1) {                         // a robot head waiting for a body
                    g.fillStyle = night ? "#8a96a2" : "#d8dee4"; g.beginPath(); g.roundRect(x - 22 * s, y - 40 * s, 44 * s, 40 * s, 8 * s); g.fill();
                    g.fillStyle = P.screen; g.fillRect(x - 15 * s, y - 32 * s, 30 * s, 14 * s); g.fillStyle = P.glow; g.fillRect(x - 10 * s, y - 28 * s, 6 * s, 6 * s); g.fillRect(x + 4 * s, y - 28 * s, 6 * s, 6 * s);
                    g.strokeStyle = night ? "#8a96a2" : "#a8b2bc"; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y - 40 * s); g.lineTo(x, y - 50 * s); g.stroke(); g.fillStyle = "#ff4a4a"; g.beginPath(); g.arc(x, y - 52 * s, 3 * s, 0, TAU); g.fill();
                } else {                                           // a box of gears
                    g.fillStyle = night ? "#3a4450" : "#7a8692"; g.fillRect(x - 24 * s, y - 24 * s, 48 * s, 24 * s);
                    gearShape(g, x - 8 * s, y - 28 * s, 12 * s, 8, t, P.gear); gearShape(g, x + 10 * s, y - 26 * s, 9 * s, 7, -t, P.gear);
                }
            }
            // the robot arms at work over the belt
            arm(g, W * 0.24 - inp.px * 8, fl + 4, t, 0, s, false);
            arm(g, W * 0.72 - inp.px * 8, fl + 4, t, 2, s, true);
            for (const sp of sparks) { sp.life -= dt; sp.vy += 500 * dt; sp.x += sp.vx * dt; sp.y += sp.vy * dt; g.strokeStyle = `rgba(255,220,140,${Math.max(0, sp.life).toFixed(2)})`; g.lineWidth = 1.6; g.beginPath(); g.moveTo(sp.x, sp.y); g.lineTo(sp.x - sp.vx * 0.02, sp.y - sp.vy * 0.02); g.stroke(); }
            sparks = sparks.filter(sp => sp.life > 0 && sp.y < H);
            // the drone, crossing the hall
            if (drone) {
                drone.x += drone.vx * dt; if (drone.x > W + 80) { drone.x = -80; drone.y = H * U.rand(0.36, 0.5); }
                const x = drone.x, y = drone.y + Math.sin(t * 2) * 8;
                g.fillStyle = night ? "#3a4450" : "#5a646e"; g.beginPath(); g.roundRect(x - 18 * s, y - 6 * s, 36 * s, 12 * s, 4); g.fill();
                g.fillStyle = P.glow; g.beginPath(); g.arc(x, y, 3 * s, 0, TAU); g.fill();
                for (const side of [-1, 1]) { g.strokeStyle = "#2a2a2a"; g.lineWidth = 2; g.beginPath(); g.moveTo(x + side * 18 * s, y); g.lineTo(x + side * 24 * s, y - 8 * s); g.stroke(); g.fillStyle = "rgba(200,210,220,.5)"; g.beginPath(); g.ellipse(x + side * 24 * s, y - 9 * s, 14 * s * Math.abs(Math.sin(t * 40 + side)), 2.5 * s, 0, 0, TAU); g.fill(); }
                if (night) Worlds.glow(g, x, y + 6 * s, 18 * s, "#ff4a4a", 0.5 + 0.5 * Math.sin(t * 6));
            }
        }
    };
}
