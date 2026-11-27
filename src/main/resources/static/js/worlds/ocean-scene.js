// Coral Reef's background (ocean.js uses it): a sunlit reef seen from just above the sand.
//   Day: the surface bright overhead, shafts of light swaying down, caustics rippling over the sand; reef ridges
//   fading blue into the distance and a sunken ship lying on its side in the haze; bommies of coral in front
//   (brain coral with its maze, staghorn, table coral, sea fans, tube sponges), anemones whose tentacles sway with
//   clownfish darting in and out, kelp with gas bladders swaying, sea grass, shells, a starfish and an urchin on
//   rippled sand; schools turning together, tangs, butterflyfish and angelfish, a turtle, a manta far off, a
//   whale's silhouette, bubbles and marine snow. Night: the deep blue-black, moonlight from above, everything
//   glowing faintly, jellyfish pulsing, an anglerfish's lure, plankton twinkling.
//   OceanScene(W, H, opts)
function OceanScene(W, H, opts) {
    const night = opts.theme === "dark", preview = !!opts.preview, TAU = Math.PI * 2, M = 40;
    const P = night
        ? { water: ["#0a2a4a", "#061a36", "#030c1e", "#02060f"], haze: "8,26,52", sand: ["#2a3448", "#1a2234", "#121826"], light: "140,180,255", rock: ["#1a2a3a", "#121e2c"], dim: 0.38 }
        : { water: ["#7fe0ee", "#2aa6d4", "#127ab0", "#0b4f80"], haze: "40,140,190", sand: ["#f6e2b0", "#e2c488", "#c8a468"], light: "255,255,230", rock: ["#6a7a7a", "#4a5a5e"], dim: 1 };
    let SY, water, far, reefL, front, caustic, kelp = [], anemones = [], schools = [], reefFish = [], bubbles = [], snow = [], jellies = [], plankton = [], beams = [];
    let turtle = null, nextTurtle = preview ? 1e9 : U.rand(6, 12), manta = null, nextManta = preview ? 1e9 : U.rand(10, 20), whale = null, nextWhale = preview ? 1e9 : U.rand(18, 30), angler = null, nextAngler = preview ? 1e9 : U.rand(5, 10);
    function paint(w, h, fn) { const c = Worlds.canvas(w, h), g = c.getContext("2d"); fn(g); return c; }
    const mix = (a, b, t) => { const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16)); return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
    const dimc = (hex, extra = 0) => night ? mix(hex, "#06122a", 0.62 + extra) : hex;
    const k = () => (preview ? 0.5 : U.clamp(Math.min(W, H) / 900, 0.6, 1.15));

    // reef pieces, drawn into the reef layer
    function brain(g, x, y, r, col, R) {
        const bg = g.createRadialGradient(x - r * 0.35, y - r * 0.5, r * 0.1, x, y, r * 1.1);
        bg.addColorStop(0, mix(col, "#ffffff", night ? 0.05 : 0.35)); bg.addColorStop(1, mix(col, "#000000", 0.35));
        g.fillStyle = bg; g.beginPath(); g.ellipse(x, y, r, r * 0.72, 0, Math.PI, TAU); g.quadraticCurveTo(x + r, y + r * 0.1, x, y + r * 0.1); g.quadraticCurveTo(x - r, y + r * 0.1, x - r, y); g.fill();
        g.save(); g.beginPath(); g.ellipse(x, y, r, r * 0.72, 0, Math.PI, TAU); g.clip();
        g.strokeStyle = mix(col, "#000000", 0.4); g.globalAlpha = 0.55; g.lineWidth = Math.max(1, r * 0.04);
        for (let i = 0; i < r * 0.5; i++) { let px = x + (R() - 0.5) * r * 1.8, py = y - R() * r * 0.7, a = R() * TAU; g.beginPath(); g.moveTo(px, py); for (let j = 0; j < 6; j++) { a += (R() - 0.5) * 1.6; px += Math.cos(a) * r * 0.12; py += Math.sin(a) * r * 0.09; g.lineTo(px, py); } g.stroke(); }
        g.restore(); g.globalAlpha = 1;
    }
    function staghorn(g, x, y, len, ang, w, col, depth, R) {
        if (depth === 0 || len < 4) return;
        const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
        g.strokeStyle = col; g.lineWidth = w; g.lineCap = "round";
        g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.stroke();
        if (depth === 1) { g.fillStyle = mix(col, "#ffffff", night ? 0.1 : 0.45); g.beginPath(); g.arc(ex, ey, w * 0.55, 0, TAU); g.fill(); }
        staghorn(g, ex, ey, len * (0.65 + R() * 0.2), ang - 0.35 - R() * 0.3, w * 0.75, col, depth - 1, R);
        staghorn(g, ex, ey, len * (0.65 + R() * 0.2), ang + 0.35 + R() * 0.3, w * 0.75, col, depth - 1, R);
    }
    function fan(g, x, y, h, col, R) {
        g.strokeStyle = col; g.globalAlpha = night ? 0.5 : 0.85;
        const tips = [];
        for (let i = 0; i < 14; i++) { const a = -Math.PI / 2 + (i - 6.5) * 0.12, l = h * (0.75 + R() * 0.3); tips.push([x + Math.cos(a) * l, y + Math.sin(a) * l]); g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (R() - 0.5) * 8, y + Math.sin(a) * l * 0.5, tips[i][0], tips[i][1]); g.stroke(); }
        g.lineWidth = 0.7;
        for (let r = 0.25; r < 1; r += 0.09) { g.beginPath(); tips.forEach(([tx, ty], i) => g[i ? "lineTo" : "moveTo"](x + (tx - x) * r, y + (ty - y) * r)); g.stroke(); }
        g.globalAlpha = 1;
    }
    function tubes(g, x, y, h, col, R) {
        for (let i = 0; i < 4; i++) {
            const tx = x + (i - 1.5) * h * 0.18, th = h * (0.5 + R() * 0.5), tw = h * 0.08;
            const tg = g.createLinearGradient(tx - tw, 0, tx + tw, 0); tg.addColorStop(0, mix(col, "#ffffff", night ? 0 : 0.25)); tg.addColorStop(1, mix(col, "#000000", 0.35));
            g.fillStyle = tg; g.beginPath(); g.moveTo(tx - tw, y); g.lineTo(tx - tw * 1.2, y - th); g.lineTo(tx + tw * 1.2, y - th); g.lineTo(tx + tw, y); g.fill();
            g.fillStyle = mix(col, "#000000", 0.55); g.beginPath(); g.ellipse(tx, y - th, tw * 1.2, tw * 0.45, 0, 0, TAU); g.fill();
        }
    }
    function table(g, x, y, w, col) {
        g.fillStyle = mix(col, "#000000", 0.3); g.fillRect(x - w * 0.06, y - w * 0.3, w * 0.12, w * 0.3);
        const tg = g.createLinearGradient(0, y - w * 0.4, 0, y - w * 0.28); tg.addColorStop(0, mix(col, "#ffffff", night ? 0 : 0.3)); tg.addColorStop(1, mix(col, "#000000", 0.3));
        g.fillStyle = tg; g.beginPath(); g.ellipse(x, y - w * 0.32, w * 0.55, w * 0.1, 0, 0, TAU); g.fill();
        g.strokeStyle = mix(col, "#000000", 0.4); g.lineWidth = 0.7; for (let i = -5; i <= 5; i++) { g.beginPath(); g.moveTo(x, y - w * 0.32); g.lineTo(x + i * w * 0.1, y - w * 0.32 + (Math.abs(i) < 5 ? w * 0.09 : 0) * Math.sign(i % 2 ? 1 : -1)); g.stroke(); }
    }
    function rock(g, x, y, w, h, R, col) {
        const rg = g.createLinearGradient(x - w / 2, y - h, x + w / 2, y);
        rg.addColorStop(0, mix(col[0], "#ffffff", night ? 0 : 0.15)); rg.addColorStop(1, col[1]);
        g.fillStyle = rg; g.beginPath(); g.moveTo(x - w / 2, y);
        const bumps = Array.from({ length: 5 }, () => [R(), 0.15 + R() * 0.2, 0.15 + R() * 0.25]);
        for (let i = 0; i <= 40; i++) { const u = i / 40; let hh = Math.pow(Math.sin(u * Math.PI), 0.7) * 0.7; for (const [c, wd, a] of bumps) hh += a * Math.exp(-((u - c) ** 2) / (wd * wd * 0.5)); hh *= Math.pow(Math.sin(u * Math.PI), 0.35); g.lineTo(x - w / 2 + u * w, y - hh * h * (0.96 + R() * 0.08)); }
        g.lineTo(x + w / 2, y); g.closePath(); g.fill();
        g.fillStyle = "rgba(0,0,0,.12)"; for (let i = 0; i < w * 0.3; i++) { const u = R(); g.beginPath(); g.arc(x - w / 2 + u * w, y - R() * Math.sin(u * Math.PI) * h * 0.8, 1 + R() * 2.5, 0, TAU); g.fill(); }
    }
    function bommie(g, x, base, w, R) {                                // a rock heaped with corals
        rock(g, x, base, w, w * 0.45, R, P.rock);
        const cols = ["#ff7a8a", "#ffb04a", "#c86aff", "#5ad8c8", "#ff5a9a", "#ffd04a", "#6ab0ff"].map(c => dimc(c));
        for (let i = 0; i < 14; i++) {                                    // encrusting sponge and algae first
            const u = 0.05 + R() * 0.9, cx = x - w / 2 + u * w, cy = base - Math.pow(Math.sin(u * Math.PI), 0.7) * w * 0.3 * R(), r = w * (0.015 + R() * 0.025), col = cols[Math.floor(R() * cols.length)];
            g.fillStyle = mix(col, P.rock[1], 0.45); g.globalAlpha = 0.7; g.beginPath(); g.ellipse(cx, cy, r * 1.4, r, R(), 0, TAU); g.fill();
            g.fillStyle = "rgba(0,0,0,.25)"; for (let q = 0; q < 4; q++) { g.beginPath(); g.arc(cx + (R() - 0.5) * r * 1.6, cy + (R() - 0.5) * r, r * 0.15, 0, TAU); g.fill(); }
            g.globalAlpha = 1;
        }
        for (let i = 0; i < 16; i++) {
            const u = 0.08 + R() * 0.84, cx = x - w / 2 + u * w, cy = base - Math.pow(Math.sin(u * Math.PI), 0.7) * w * 0.33 + 6, col = cols[Math.floor(R() * cols.length)], kind = Math.floor(R() * 5);
            if (kind === 0) brain(g, cx, cy, w * (0.09 + R() * 0.06), col, R);
            else if (kind === 1) staghorn(g, cx, cy, w * 0.07, -Math.PI / 2 + (R() - 0.5) * 0.6, w * 0.022, col, 4, R);
            else if (kind === 2) fan(g, cx, cy, w * (0.2 + R() * 0.1), col, R);
            else if (kind === 3) tubes(g, cx, cy, w * 0.22, col, R);
            else table(g, cx, cy, w * 0.3, col);
        }
    }

    function setup() {
        const R = U.rng(808), s = k(), LW = W + M * 2;
        SY = H * (preview ? 0.8 : 0.82);
        water = paint(W, H, g => {
            const wg = g.createLinearGradient(0, 0, 0, H);
            P.water.forEach((c, i) => wg.addColorStop([0, 0.28, 0.65, 1][i], c));
            g.fillStyle = wg; g.fillRect(0, 0, W, H);
            const sg = g.createRadialGradient(W * 0.45, -H * 0.1, 0, W * 0.45, -H * 0.1, H * 0.7);  // the bright patch under the sun (or moon)
            sg.addColorStop(0, `rgba(${P.light},${night ? 0.18 : 0.45})`); sg.addColorStop(1, `rgba(${P.light},0)`);
            g.fillStyle = sg; g.fillRect(0, 0, W, H * 0.7);
        });
        // a caustic net: cells of bright lines, tiled and slid over the sand and the surface
        caustic = paint(552, 276, g => {                                          // wraps both ways: a 12 x 6 net with period 552 x 276
            const CW = 552, CH = 276, NX = 12, NY = 6, pts = [];
            for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) pts.push([x * 46 + R() * 26, y * 46 + R() * 26]);
            const segs = [];
            for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
                const a = pts[y * NX + x];
                for (const [dx, dy] of [[1, 0], [0, 1], [1, 1]]) {
                    if (dx && dy && R() < 0.6) continue;
                    const nx = (x + dx) % NX, ny = (y + dy) % NY, b = pts[ny * NX + nx];
                    segs.push([a, [b[0] + (x + dx >= NX ? CW : 0), b[1] + (y + dy >= NY ? CH : 0)], (R() - 0.5) * 16, (R() - 0.5) * 16]);
                }
            }
            g.strokeStyle = `rgba(${P.light},1)`; g.lineCap = "round";
            for (const [w, al] of [[5, 0.12], [1.6, 0.55]]) {
                g.lineWidth = w; g.globalAlpha = al;
                for (const [a, b, jx, jy] of segs) for (const ox of [-CW, 0]) for (const oy of [-CH, 0]) {
                    g.beginPath(); g.moveTo(a[0] + ox + (ox ? 0 : 0), a[1] + oy); g.quadraticCurveTo((a[0] + b[0]) / 2 + jx + ox, (a[1] + b[1]) / 2 + jy + oy, b[0] + ox, b[1] + oy); g.stroke();
                    g.beginPath(); g.moveTo(a[0] + ox + CW, a[1] + oy + CH); g.quadraticCurveTo((a[0] + b[0]) / 2 + jx + ox + CW, (a[1] + b[1]) / 2 + jy + oy + CH, b[0] + ox + CW, b[1] + oy + CH); g.stroke();
                }
            }
        });
        // far: reef ridges fading into the blue, the wreck lying on its side
        far = paint(LW, H, g => {
            const ridge = (base, amp, f, ph, fade) => {
                g.fillStyle = mix(P.rock[1], night ? "#06142c" : "#3a9cc8", fade);
                g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= LW; x += 8) g.lineTo(x, base - Math.abs(Math.sin(x * f + ph)) * amp - Math.sin(x * f * 3.1) * amp * 0.2 - (R() < 0.1 ? R() * amp * 0.3 : 0)); g.lineTo(LW, H); g.fill();
            };
            ridge(SY - H * 0.12, H * 0.08, 0.004, 0.3, 0.8);
            // the wreck: a hull keeled over, a broken mast, portholes, a frayed sail, weed hanging off it
            const wx = M + W * 0.4, wy = SY - H * 0.06, ws = Math.min(W, H) * 0.0015 * 100 * (preview ? 0.6 : 1);
            g.save(); g.translate(wx, wy); g.rotate(-0.12);
            const hullC = mix(night ? "#3a2a22" : "#6a4a32", night ? "#06142c" : "#3a9cc8", 0.6);
            g.fillStyle = hullC;
            g.beginPath(); g.moveTo(-ws * 2.2, -ws * 0.4); g.quadraticCurveTo(-ws * 2.4, ws * 0.5, -ws * 1.6, ws * 0.6); g.lineTo(ws * 1.5, ws * 0.6); g.quadraticCurveTo(ws * 2.3, ws * 0.2, ws * 2.5, -ws * 0.6); g.lineTo(ws * 1.8, -ws * 0.5); g.lineTo(-ws * 1.2, -ws * 0.45); g.closePath(); g.fill();
            g.strokeStyle = mix(hullC, "#000000", 0.25); g.lineWidth = 1.2; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(-ws * 2.1, -ws * 0.4 + i * ws * 0.25); g.lineTo(ws * 2.1, -ws * 0.45 + i * ws * 0.25); g.stroke(); }
            g.fillStyle = mix(hullC, "#000000", 0.45); for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(-ws * 1.2 + i * ws * 0.6, -ws * 0.1, ws * 0.07, 0, TAU); g.fill(); }
            g.strokeStyle = hullC; g.lineWidth = ws * 0.09; g.beginPath(); g.moveTo(-ws * 0.2, -ws * 0.45); g.lineTo(ws * 0.4, -ws * 1.9); g.stroke();
            g.lineWidth = ws * 0.05; g.beginPath(); g.moveTo(ws * 0.1, -ws * 1.2); g.lineTo(ws * 0.9, -ws * 1.0); g.stroke();
            g.fillStyle = mix(hullC, "#ffffff", 0.15); g.globalAlpha = 0.6; g.beginPath(); g.moveTo(ws * 0.35, -ws * 1.75); g.quadraticCurveTo(ws * 0.9, -ws * 1.5, ws * 0.8, -ws * 1.05); g.lineTo(ws * 0.2, -ws * 1.15); g.closePath(); g.fill(); g.globalAlpha = 1;
            g.strokeStyle = mix(night ? "#123a2a" : "#3a7a4a", night ? "#06142c" : "#3a9cc8", 0.5); g.lineWidth = 2;
            for (let i = 0; i < 8; i++) { const x = -ws * 1.8 + R() * ws * 3.6; g.beginPath(); g.moveTo(x, ws * 0.55); g.quadraticCurveTo(x + 6, ws * 0.55 - 20, x - 2, ws * 0.55 - 30 - R() * 20); g.stroke(); }
            g.restore();
            ridge(SY - H * 0.04, H * 0.06, 0.006, 1.9, 0.6);
            const hz = g.createLinearGradient(0, SY - H * 0.25, 0, SY); hz.addColorStop(0, `rgba(${P.haze},0)`); hz.addColorStop(1, `rgba(${P.haze},${night ? 0.35 : 0.45})`);
            g.fillStyle = hz; g.fillRect(0, SY - H * 0.25, LW, H * 0.25);
        });
        // the reef in front: sand, bommies on both sides, sea grass, shells, a starfish and an urchin
        reefL = paint(LW, H, g => {
            const sg = g.createLinearGradient(0, SY - 10, 0, H);
            sg.addColorStop(0, P.sand[1]); sg.addColorStop(0.4, P.sand[0]); sg.addColorStop(1, P.sand[2]);
            g.fillStyle = sg; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= LW; x += 10) g.lineTo(x, SY + Math.sin(x * 0.005 + 1) * H * 0.018); g.lineTo(LW, H); g.fill();
            g.lineWidth = 1.1;
            for (let i = 0; i < (preview ? 60 : 260); i++) {                             // sand ripples, lit on one side
                const x = R() * LW, y = SY + H * 0.03 + R() * (H - SY), l = (16 + R() * 40) * s * (0.6 + (y - SY) / (H - SY));
                g.strokeStyle = night ? "rgba(0,0,0,.18)" : "rgba(150,110,60,.2)"; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 3, x + l, y); g.stroke();
                g.strokeStyle = night ? "rgba(140,170,255,.05)" : "rgba(255,255,240,.4)"; g.beginPath(); g.moveTo(x, y - 1.5); g.quadraticCurveTo(x + l / 2, y - 4.5, x + l, y - 1.5); g.stroke();
            }
            for (let i = 0; i < (preview ? 2000 : 9000); i++) { g.fillStyle = R() < 0.5 ? "rgba(0,0,0,.08)" : (night ? "rgba(160,190,255,.04)" : "rgba(255,255,240,.18)"); g.fillRect(R() * LW, SY + R() * (H - SY), 1.2, 1.2); }
            bommie(g, M + W * 0.1, SY + H * 0.04, W * 0.24, R);
            bommie(g, M + W * 0.86, SY + H * 0.03, W * 0.26, R);
            bommie(g, M + W * 0.58, SY + H * 0.01, W * 0.12, R);
            for (let i = 0; i < (preview ? 40 : 160); i++) {                             // sea grass
                const x = R() * LW, y = SY + H * (0.01 + R() * 0.05), h = (12 + R() * 22) * s;
                g.strokeStyle = dimc(R() < 0.5 ? "#4aa05a" : "#6ab86a"); g.lineWidth = 1.6;
                g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (R() - 0.5) * 10, y - h / 2, x + (R() - 0.5) * 14, y - h); g.stroke();
            }
            const shell = (x, y, r, col) => { g.fillStyle = "rgba(0,0,0,.15)"; g.beginPath(); g.ellipse(x + 2, y + r * 0.4, r, r * 0.3, 0, 0, TAU); g.fill(); g.fillStyle = col; g.beginPath(); g.moveTo(x, y + r * 0.5); g.arc(x, y + r * 0.5, r, -Math.PI * 0.95, -Math.PI * 0.05); g.closePath(); g.fill(); g.strokeStyle = "rgba(0,0,0,.2)"; g.lineWidth = 0.7; for (let q = 1; q < 7; q++) { const a = -Math.PI * 0.95 + (q / 7) * Math.PI * 0.9; g.beginPath(); g.moveTo(x, y + r * 0.5); g.lineTo(x + Math.cos(a) * r, y + r * 0.5 + Math.sin(a) * r); g.stroke(); } };
            for (const [x, y, r, c] of [[0.3, 0.92, 9, "#ffd8c8"], [0.42, 0.97, 7, "#fff0d8"], [0.66, 0.94, 10, "#ffc8a8"], [0.25, 0.86, 6, "#f8e0f0"]]) shell(M + W * x, H * y, r * s, dimc(c));
            {                                                                                // a starfish
                const x = M + W * 0.72, y = H * 0.95, r = 18 * s;
                g.fillStyle = dimc("#ff6a3a"); g.beginPath(); for (let q = 0; q < 10; q++) { const a = -Math.PI / 2 + (q / 10) * TAU + 0.3, d = q % 2 ? r * 0.4 : r; g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.55); } g.closePath(); g.fill();
                g.fillStyle = dimc("#ffd0a0"); for (let q = 0; q < 16; q++) { const a = R() * TAU, d = R() * r * 0.7; g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.55, 1.1, 0, TAU); g.fill(); }
            }
            {                                                                                // a sea urchin
                const x = M + W * 0.2, y = H * 0.93, r = 12 * s;
                g.strokeStyle = dimc("#3a2a5a"); g.lineWidth = 1.4; for (let q = 0; q < 30; q++) { const a = Math.PI + (q / 29) * Math.PI, l = r * (1.4 + R() * 0.6); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l * 0.9); g.stroke(); }
                g.fillStyle = dimc("#4a3a6a"); g.beginPath(); g.arc(x, y, r * 0.8, Math.PI, TAU); g.fill();
            }
        });
        front = null;
        kelp = Array.from({ length: preview ? 4 : 10 }, (_, i) => { const left = i % 2 === 0; return { x: left ? R() * W * 0.18 : W * (0.82 + R() * 0.18), h: H * (0.45 + R() * 0.35), w: (4 + R() * 3) * s, ph: R() * TAU, z: 0.7 + R() * 0.5 }; });
        anemones = [[M + W * 0.16, SY + H * 0.005], [M + W * 0.82, SY - H * 0.005]].map(([x, y], i) => ({ x, y, r: 38 * s, col: dimc(i ? "#c86aff" : "#ff7aa8"), tip: dimc(i ? "#ffd0ff" : "#ffe0ea"), ph: i * 2, fish: [0, 1].map(j => ({ ph: j * 3 + i, r: 30 * s + j * 10 })) }));
        const school = (n, col, y, sz) => ({ x: R() * W, y, vx: (R() < 0.5 ? -1 : 1) * U.lerp(26, 48, R()), ph: R() * TAU, col, fish: Array.from({ length: n }, () => ({ dx: (R() - 0.5) * 140, dy: (R() - 0.5) * 60, s: sz * (0.8 + R() * 0.4), ph: R() * TAU })) });
        schools = [school(preview ? 6 : 16, "#c8d8e8", H * 0.25, 5 * s), school(preview ? 5 : 12, "#ffd04a", H * 0.4, 6 * s), school(preview ? 4 : 10, "#4ac8e8", H * 0.55, 5.5 * s)];
        reefFish = Array.from({ length: preview ? 2 : 6 }, (_, i) => ({ kind: i % 3, x: R() * W, y: H * U.lerp(0.45, 0.75, R()), vx: (R() < 0.5 ? -1 : 1) * U.lerp(14, 30, R()), s: (14 + R() * 6) * s, ph: R() * TAU }));
        bubbles = Array.from({ length: preview ? 8 : 34 }, () => ({ x: R() * W, y: R() * H, r: 1.2 + R() * 4, sp: 18 + R() * 40, ph: R() * TAU }));
        snow = Array.from({ length: preview ? 10 : 60 }, () => ({ x: R() * W, y: R() * H, r: 0.6 + R() * 1.4, sp: 4 + R() * 8, ph: R() * TAU }));
        jellies = night ? Array.from({ length: preview ? 2 : 6 }, (_, i) => ({ x: R() * W, y: H * (0.15 + R() * 0.6), s: (14 + R() * 18) * s, ph: R() * TAU, col: ["180,140,255", "120,200,255", "255,140,210"][i % 3] })) : [];
        plankton = night ? Array.from({ length: preview ? 20 : 90 }, () => ({ x: R() * W, y: R() * H, r: 1 + R() * 1.5, tw: R() * TAU, c: R() < 0.5 ? "120,255,220" : "140,200,255" })) : [];
        beams = Array.from({ length: preview ? 3 : 6 }, () => ({ x: R(), w: 0.03 + R() * 0.06, ph: R() * TAU }));
    }
    setup();

    // a reef fish: 0 tang (blue, yellow tail), 1 butterflyfish (yellow, a black band through the eye), 2 angelfish (stripes)
    function reefFishDraw(g, x, y, s, kind, flip, t, ph) {
        const wag = Math.sin(t * 9 + ph) * 0.25;
        g.save(); g.translate(x, y); g.scale(flip, 1);
        const body = kind === 0 ? ["#2a6ae8", "#1a3aa8"] : kind === 1 ? ["#ffe04a", "#e8b020"] : ["#f0f0f8", "#b8c0d0"];
        const tail = kind === 0 ? "#ffd02a" : kind === 1 ? "#ffe04a" : "#3a3a5a";
        g.fillStyle = dimc(tail); g.beginPath(); g.moveTo(-s * 0.7, 0); g.lineTo(-s * 1.25, -s * 0.45 + wag * s); g.lineTo(-s * 1.15, 0); g.lineTo(-s * 1.25, s * 0.45 + wag * s); g.closePath(); g.fill();
        const tall = kind === 0 ? 0.55 : 0.8;
        const bg = g.createLinearGradient(0, -s * tall, 0, s * tall); bg.addColorStop(0, dimc(body[0])); bg.addColorStop(1, dimc(body[1]));
        g.fillStyle = bg; g.beginPath(); g.moveTo(s, 0); g.bezierCurveTo(s * 0.6, -s * tall * 1.2, -s * 0.5, -s * tall, -s * 0.75, 0); g.bezierCurveTo(-s * 0.5, s * tall, s * 0.6, s * tall * 1.2, s, 0); g.fill();
        if (kind === 2) { g.save(); g.clip(); g.fillStyle = dimc("#2a2a40"); for (const sx of [-0.35, 0.05, 0.42]) g.fillRect(sx * s, -s, s * 0.14, s * 2); g.restore(); g.fillStyle = dimc("#ffd02a"); g.beginPath(); g.moveTo(-s * 0.2, -s * 0.6); g.lineTo(-s * 0.7, -s * 1.3); g.lineTo(-s * 0.55, -s * 0.5); g.fill(); g.beginPath(); g.moveTo(-s * 0.2, s * 0.6); g.lineTo(-s * 0.7, s * 1.3); g.lineTo(-s * 0.55, s * 0.5); g.fill(); }
        if (kind === 1) { g.fillStyle = dimc("#1a1a2a"); g.beginPath(); g.moveTo(s * 0.55, -s * 0.7); g.lineTo(s * 0.7, -s * 0.7); g.lineTo(s * 0.52, s * 0.7); g.lineTo(s * 0.38, s * 0.7); g.fill(); g.beginPath(); g.arc(-s * 0.45, -s * 0.3, s * 0.1, 0, TAU); g.fill(); }
        if (kind === 0) { g.strokeStyle = dimc("#0a1a5a"); g.lineWidth = s * 0.08; g.beginPath(); g.moveTo(s * 0.5, -s * 0.25); g.quadraticCurveTo(-s * 0.1, -s * 0.5, -s * 0.55, -s * 0.05); g.quadraticCurveTo(-s * 0.1, s * 0.15, s * 0.2, 0); g.stroke(); }
        g.fillStyle = "rgba(255,255,255,.35)"; g.beginPath(); g.ellipse(s * 0.2, -s * tall * 0.4, s * 0.35, s * 0.08, -0.2, 0, TAU); g.fill();
        g.fillStyle = "#ffffff"; g.beginPath(); g.arc(s * 0.6, -s * 0.12, s * 0.12, 0, TAU); g.fill();
        g.fillStyle = "#0a0a1a"; g.beginPath(); g.arc(s * 0.63, -s * 0.12, s * 0.07, 0, TAU); g.fill();
        g.restore();
    }
    function smallFish(g, x, y, s, col, flip, wag) {
        g.save(); g.translate(x, y); g.scale(flip, 1);
        g.fillStyle = col; g.beginPath(); g.moveTo(s, 0); g.quadraticCurveTo(s * 0.2, -s * 0.5, -s * 0.6, 0); g.quadraticCurveTo(s * 0.2, s * 0.5, s, 0); g.fill();
        g.beginPath(); g.moveTo(-s * 0.5, 0); g.lineTo(-s * 1.1, -s * 0.4 + wag * s * 0.2); g.lineTo(-s * 1.1, s * 0.4 + wag * s * 0.2); g.fill();
        g.fillStyle = "rgba(255,255,255,.5)"; g.fillRect(-s * 0.3, -s * 0.12, s * 1, s * 0.1);
        g.restore();
    }
    function clownfish(g, x, y, s, flip, t, ph) {
        g.save(); g.translate(x, y); g.scale(flip, 1);
        const wag = Math.sin(t * 12 + ph) * 0.25;
        g.fillStyle = dimc("#ff7a1a"); g.beginPath(); g.moveTo(-s * 0.6, 0); g.lineTo(-s * 1.1, -s * 0.4 + wag * s); g.lineTo(-s * 1.1, s * 0.4 + wag * s); g.fill();
        g.beginPath(); g.ellipse(0, 0, s * 0.75, s * 0.42, 0, 0, TAU); g.fill();
        g.save(); g.clip(); g.fillStyle = dimc("#ffffff"); for (const sx of [-0.4, 0.05, 0.45]) g.fillRect(sx * s, -s, s * 0.14, s * 2); g.strokeStyle = "#1a1a1a"; g.lineWidth = 0.8; g.restore();
        g.fillStyle = "#1a1a1a"; g.beginPath(); g.arc(s * 0.5, -s * 0.08, s * 0.07, 0, TAU); g.fill();
        g.restore();
    }

    return {
        resize(w, h) { W = w; H = h; setup(); },
        draw(g, t, dt, inp) {
            const px = inp.px || 0;
            g.drawImage(water, 0, 0);
            // the surface far above: the caustic net sliding, a bright rippling band
            g.save(); g.globalCompositeOperation = "lighter";
            for (const [sy, sh, a] of [[0, 46, 0.55], [46, 30, 0.3], [76, 26, 0.12]]) {      // the band fades away from the surface
                g.globalAlpha = (night ? 0.45 : 1) * a;
                for (let x = -((t * 14) % 552) - 552; x < W; x += 552) g.drawImage(caustic, 0, sy * 2.5, 552, sh * 2.5, x - px * 3, sy, 552, sh);
            }
            for (const b of beams) {                                                       // shafts of light swaying down
                const x = (b.x + Math.sin(t * 0.13 + b.ph) * 0.04) * W - px * 10, w = b.w * W, a = (night ? 0.03 : 0.09) + 0.05 * Math.sin(t * 0.5 + b.ph);
                const gr = g.createLinearGradient(0, 0, 0, SY);
                gr.addColorStop(0, `rgba(${P.light},${Math.max(0, a).toFixed(3)})`); gr.addColorStop(1, `rgba(${P.light},0)`);
                g.globalAlpha = 1; g.fillStyle = gr;
                g.beginPath(); g.moveTo(x, 0); g.lineTo(x + w, 0); g.lineTo(x + w * 2.6 + W * 0.08, SY); g.lineTo(x + W * 0.08, SY); g.fill();
            }
            g.restore();
            for (const p of plankton) {                                                    // plankton twinkling (night)
                p.y -= dt * 3; if (p.y < -4) p.y = H + 4;
                const q = 0.3 + 0.7 * Math.abs(Math.sin(t * 1.4 + p.tw));
                g.fillStyle = `rgba(${p.c},${(q * 0.8).toFixed(2)})`; g.fillRect(p.x - px * 6, p.y, p.r, p.r);
                if (q > 0.8) Worlds.glow(g, p.x - px * 6 + p.r / 2, p.y + p.r / 2, p.r * 6, `rgb(${p.c})`, (q - 0.8) * 3);
            }
            nextWhale -= dt;                                                               // a whale far off in the blue
            if (!whale && nextWhale <= 0) { const dir = Math.random() < 0.5 ? 1 : -1; whale = { dir, x: dir > 0 ? -300 : W + 300, y: H * U.rand(0.15, 0.32), vx: dir * U.rand(20, 30), s: U.clamp(W / 1000, 0.6, 1.5) }; }
            if (whale) {
                whale.x += whale.vx * dt;
                g.save(); g.translate(whale.x - px * 3, whale.y); g.scale(whale.dir * whale.s, whale.s); g.fillStyle = night ? "rgba(40,70,120,.3)" : "rgba(20,80,140,.3)";
                g.beginPath(); g.moveTo(120, 0); g.bezierCurveTo(110, -38, 20, -42, -60, -14); g.quadraticCurveTo(-100, -4, -130, -26 + Math.sin(t) * 6); g.quadraticCurveTo(-120, 0, -132, 22 + Math.sin(t) * 6); g.quadraticCurveTo(-100, 6, -60, 12); g.bezierCurveTo(20, 34, 100, 30, 120, 0); g.fill();
                g.beginPath(); g.ellipse(30, 26, 26, 6, 0.35 + Math.sin(t * 0.8) * 0.15, 0, TAU); g.fill(); g.restore();
                if (whale.x < -340 || whale.x > W + 340) { whale = null; nextWhale = U.rand(30, 50); }
            }
            nextManta -= dt;                                                               // a manta gliding far off
            if (!manta && nextManta <= 0) { const dir = Math.random() < 0.5 ? 1 : -1; manta = { dir, x: dir > 0 ? -120 : W + 120, y: H * U.rand(0.35, 0.55), vx: dir * U.rand(24, 36), s: U.clamp(H / 900, 0.5, 1.1) }; }
            if (manta) {
                manta.x += manta.vx * dt;
                const fl = Math.sin(t * 1.6) * 0.35;
                g.save(); g.translate(manta.x - px * 5, manta.y); g.scale(manta.dir * manta.s, manta.s); g.fillStyle = night ? "rgba(30,50,90,.5)" : "rgba(20,60,100,.45)";
                g.beginPath(); g.moveTo(40, 0); g.quadraticCurveTo(10, -14 - fl * 30, -10, -70 * (1 - fl * 0.3)); g.quadraticCurveTo(-20, -20, -30, -4); g.lineTo(-80, 0); g.lineTo(-30, 4); g.quadraticCurveTo(-20, 20, -10, 70 * (1 - fl * 0.3)); g.quadraticCurveTo(10, 14 + fl * 30, 40, 0); g.fill();
                g.beginPath(); g.moveTo(40, -6); g.lineTo(52, -10); g.lineTo(44, -2); g.moveTo(40, 6); g.lineTo(52, 10); g.lineTo(44, 2); g.fill(); g.restore();
                if (manta.x < -160 || manta.x > W + 160) { manta = null; nextManta = U.rand(24, 40); }
            }
            g.drawImage(far, -M - px * 5, 0);
            g.fillStyle = night ? "rgba(200,220,255,.35)" : "rgba(255,255,255,.45)";        // marine snow
            for (const sn of snow) { sn.y += sn.sp * dt; if (sn.y > H) sn.y = -4; g.fillRect(sn.x + Math.sin(t * 0.6 + sn.ph) * 8 - px * 5, sn.y, sn.r, sn.r); }
            for (const sc of schools) {                                                    // schools turning together
                sc.x += sc.vx * dt;
                if (sc.x > W + 160) sc.vx = -Math.abs(sc.vx); else if (sc.x < -160) sc.vx = Math.abs(sc.vx);
                const flip = sc.vx > 0 ? 1 : -1, sy = sc.y + Math.sin(t * 0.5 + sc.ph) * 30;
                for (const f of sc.fish) smallFish(g, sc.x + f.dx + Math.sin(t * 1.3 + f.ph) * 8 - px * 10, sy + f.dy + Math.cos(t * 1.1 + f.ph) * 5, f.s, dimc(sc.col), flip, Math.sin(t * 12 + f.ph));
            }
            nextTurtle -= dt;                                                              // a sea turtle gliding past
            if (!turtle && nextTurtle <= 0) { const dir = Math.random() < 0.5 ? 1 : -1; turtle = { dir, x: dir > 0 ? -100 : W + 100, y: H * U.rand(0.3, 0.55), vx: dir * U.rand(26, 40), s: U.clamp(H / 900, 0.6, 1.3) }; }
            if (turtle) {
                turtle.x += turtle.vx * dt;
                const sw = Math.sin(t * 2.2);
                g.save(); g.translate(turtle.x - px * 12, turtle.y + Math.sin(t * 0.8) * 8); g.scale(turtle.dir * turtle.s, turtle.s);
                g.fillStyle = dimc("#5a8a4a");
                for (const [fx, fy, a, l] of [[16, -14, -0.9 - sw * 0.5, 34], [16, 14, 0.9 + sw * 0.5, 34], [-20, -12, -2.4 + sw * 0.3, 18], [-20, 12, 2.4 - sw * 0.3, 18]]) { g.save(); g.translate(fx, fy); g.rotate(a); g.beginPath(); g.ellipse(l / 2, 0, l / 2, l * 0.18, 0, 0, TAU); g.fill(); g.restore(); }
                g.beginPath(); g.ellipse(38, 0, 11, 8, 0, 0, TAU); g.fill();
                const shg = g.createRadialGradient(-6, -8, 2, 0, 0, 32); shg.addColorStop(0, dimc("#a88a4a")); shg.addColorStop(1, dimc("#5a4220"));
                g.fillStyle = shg; g.beginPath(); g.ellipse(0, 0, 30, 21, 0, 0, TAU); g.fill();
                g.strokeStyle = dimc("#3a2a10"); g.lineWidth = 1.4;
                for (const [cx, cy, rx, ry] of [[0, 0, 8, 6], [-14, -8, 7, 5], [-14, 8, 7, 5], [14, -8, 7, 5], [14, 8, 7, 5], [-24, 0, 4, 6], [24, 0, 4, 6]]) { g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.stroke(); }
                g.fillStyle = "#14213d"; g.beginPath(); g.arc(43, -3, 1.8, 0, TAU); g.fill();
                g.restore();
                if (turtle.x < -140 || turtle.x > W + 140) { turtle = null; nextTurtle = U.rand(16, 28); }
            }
            if (night) {                                                                   // an anglerfish and its lure
                nextAngler -= dt;
                if (!angler && nextAngler <= 0) { const dir = Math.random() < 0.5 ? 1 : -1; angler = { dir, x: dir > 0 ? -70 : W + 70, y: H * U.rand(0.45, 0.7), vx: dir * U.rand(18, 28), s: U.clamp(H / 900, 0.7, 1.3) }; }
                if (angler) {
                    angler.x += angler.vx * dt;
                    g.save(); g.translate(angler.x - px * 14, angler.y + Math.sin(t * 1.3) * 6); g.scale(angler.dir * angler.s, angler.s);
                    const lx = 34 + Math.sin(t * 2) * 3, ly = -36 + Math.cos(t * 2) * 3;
                    Worlds.glow(g, lx, ly, 40, "#a0ffe0", 0.8);
                    g.strokeStyle = "#2a3550"; g.lineWidth = 2; g.beginPath(); g.moveTo(10, -16); g.quadraticCurveTo(26, -44, lx, ly); g.stroke();
                    g.fillStyle = "#e9fff8"; g.beginPath(); g.arc(lx, ly, 4, 0, TAU); g.fill();
                    const ag = g.createRadialGradient(lx - 34, ly + 30, 0, 0, 0, 34); ag.addColorStop(0, "#3a4a6a"); ag.addColorStop(1, "#121a2a");
                    g.fillStyle = ag; g.beginPath(); g.ellipse(0, 0, 30, 22, 0, 0, TAU); g.fill();
                    g.beginPath(); g.moveTo(-26, 0); g.lineTo(-48, -16 + Math.sin(t * 6) * 4); g.lineTo(-48, 16 + Math.sin(t * 6) * 4); g.fill();
                    g.fillStyle = "#dfe8ff"; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(14 + i * 3, 6); g.lineTo(15.5 + i * 3, 12); g.lineTo(17 + i * 3, 6); g.fill(); }
                    g.fillStyle = "#cfe6ff"; g.beginPath(); g.arc(14, -8, 4, 0, TAU); g.fill(); g.fillStyle = "#000"; g.beginPath(); g.arc(15, -8, 2, 0, TAU); g.fill();
                    g.restore();
                    if (angler.x < -110 || angler.x > W + 110) { angler = null; nextAngler = U.rand(14, 24); }
                }
            }
            for (const j of jellies) {                                                     // jellyfish pulsing with light (night)
                const pulse = Math.sin(t * 2.2 + j.ph);
                j.y -= (pulse > 0 ? 14 : 3) * dt; if (j.y < -60) { j.y = H + 60; j.x = Math.random() * W; }
                const x = j.x - px * 10, y = j.y, s = j.s * (1 + pulse * 0.08);
                Worlds.glow(g, x, y, s * 2.6, `rgb(${j.col})`, 0.4);
                const bell = g.createRadialGradient(x, y - s * 0.3, 0, x, y, s); bell.addColorStop(0, `rgba(${j.col},.75)`); bell.addColorStop(1, `rgba(${j.col},.25)`);
                g.fillStyle = bell; g.beginPath(); g.ellipse(x, y, s, s * (0.75 - pulse * 0.08), 0, Math.PI, TAU); g.quadraticCurveTo(x, y + s * 0.18, x - s, y); g.fill();
                g.strokeStyle = `rgba(${j.col},.55)`; g.lineWidth = 1.2;
                for (let q = -3; q <= 3; q++) { g.beginPath(); g.moveTo(x + q * s * 0.25, y); for (let n = 1; n <= 8; n++) g.lineTo(x + q * s * 0.25 + Math.sin(t * 2 + n * 0.8 + q) * 4, y + n * s * 0.32); g.stroke(); }
                g.strokeStyle = `rgba(255,255,255,.5)`; g.lineWidth = 2; for (let q = -1; q <= 1; q++) { g.beginPath(); g.moveTo(x + q * s * 0.15, y); g.quadraticCurveTo(x + q * s * 0.3 + Math.sin(t * 1.5 + q) * 5, y + s * 0.8, x + q * s * 0.1, y + s * 1.5); g.stroke(); }
            }
            const ro = -M - px * 9;
            g.drawImage(reefL, ro, 0);
            // caustics dancing on the sand
            g.save(); g.beginPath(); g.rect(0, SY - 6, W, H); g.clip();
            g.globalCompositeOperation = "lighter"; g.globalAlpha = night ? 0.06 : 0.17;
            for (const [sp, dy, a] of [[18, 0, 1], [-11, 37, 0.7]]) { g.globalAlpha *= a; const off = (((t * sp) % 552) + 552) % 552; for (let x = -off - 552; x < W; x += 552) for (let y = SY - 6 + dy - 276; y < H; y += 276) g.drawImage(caustic, x - px * 9, y); }
            g.restore();
            for (const a of anemones) {                                                    // anemones swaying, clownfish darting about them
                const x = a.x + ro;
                for (let i = 0; i < 34; i++) {
                    const u = i / 33, ang = -Math.PI + u * Math.PI, l = a.r * (0.7 + Math.sin(u * Math.PI) * 0.6), sw = Math.sin(t * 1.4 + a.ph + u * 2) * 0.25;
                    const ex = x + Math.cos(ang + sw) * l, ey = a.y + Math.sin(ang + sw) * l * 0.9;
                    g.strokeStyle = a.col; g.lineWidth = 3.4; g.lineCap = "round";
                    g.beginPath(); g.moveTo(x + Math.cos(ang) * a.r * 0.2, a.y); g.quadraticCurveTo(x + Math.cos(ang) * l * 0.5, a.y + Math.sin(ang) * l * 0.6 - 4, ex, ey); g.stroke();
                    g.fillStyle = a.tip; g.beginPath(); g.arc(ex, ey, 2.4, 0, TAU); g.fill();
                    if (night) Worlds.glow(g, ex, ey, 6, a.tip, 0.3);
                }
                for (const f of a.fish) {
                    const ang = t * 0.9 + f.ph, fx = x + Math.cos(ang) * f.r * 1.4, fy = a.y - a.r * 0.6 + Math.sin(ang * 1.7) * f.r * 0.4;
                    clownfish(g, fx, fy, 11 * k(), Math.sin(ang) > 0 ? -1 : 1, t, f.ph);
                }
            }
            for (const f of reefFish) {                                                    // reef fish pottering about
                f.x += f.vx * dt; if (f.x > W + 60) f.vx = -Math.abs(f.vx); else if (f.x < -60) f.vx = Math.abs(f.vx);
                reefFishDraw(g, f.x - px * 12, f.y + Math.sin(t * 0.7 + f.ph) * 12, f.s, f.kind, f.vx > 0 ? 1 : -1, t, f.ph);
            }
            for (const kp of kelp) {                                                       // kelp swaying: a stipe, blades, gas bladders
                const x0 = kp.x - px * 16 * kp.z, y0 = H + 10, pts = [];
                for (let i = 0; i <= 16; i++) { const q = i / 16, yy = y0 - kp.h * q, xx = x0 + Math.sin(t * 0.9 + kp.ph + q * 3) * q * q * 40 * kp.z; pts.push([xx, yy]); }
                g.strokeStyle = dimc("#6a7a2a"); g.lineWidth = kp.w * 0.5; g.lineCap = "round";
                g.beginPath(); pts.forEach(([x, y], i) => g[i ? "lineTo" : "moveTo"](x, y)); g.stroke();
                pts.forEach(([x, y], i) => {
                    if (i === 0) return;
                    const side = i % 2 ? 1 : -1, l = (28 + (i % 3) * 8) * kp.z, sw = Math.sin(t * 1.2 + kp.ph + i) * 0.3;
                    const bg = g.createLinearGradient(x, y, x + side * l, y); bg.addColorStop(0, dimc("#7a8a2a")); bg.addColorStop(1, dimc("#a8b84a"));
                    g.fillStyle = bg; g.globalAlpha = night ? 0.6 : 0.85;
                    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + side * l * 0.5, y - 10 + sw * 10, x + side * l, y + 4 + sw * 14); g.quadraticCurveTo(x + side * l * 0.5, y + 6, x, y + 3); g.fill();
                    g.globalAlpha = 1; g.fillStyle = dimc("#b8a83a"); g.beginPath(); g.arc(x + side * 3, y + 1, kp.w * 0.45, 0, TAU); g.fill();
                });
            }
            for (const b of bubbles) {                                                     // bubbles rising
                b.y -= b.sp * dt; if (b.y < -10) { b.y = H + 10; b.x = Math.random() * W; }
                const x = b.x + Math.sin(t * 2 + b.ph) * 4 - px * 8, wob = 1 + Math.sin(t * 7 + b.ph * 3) * 0.07;
                g.strokeStyle = night ? "rgba(160,220,255,.5)" : "rgba(255,255,255,.75)"; g.lineWidth = 1.2;
                g.beginPath(); g.ellipse(x, b.y, b.r * wob, b.r / wob, 0, 0, TAU); g.stroke();
                if (b.r > 2.5) { g.fillStyle = night ? "rgba(160,220,255,.08)" : "rgba(255,255,255,.12)"; g.fill(); g.fillStyle = night ? "rgba(200,240,255,.7)" : "rgba(255,255,255,.9)"; g.beginPath(); g.arc(x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.24, 0, TAU); g.fill(); }
            }
        }
    };
}
