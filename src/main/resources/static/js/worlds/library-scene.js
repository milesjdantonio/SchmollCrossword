// The Haunted Library's background (library.js uses it): a grand two-storey reading hall seen down its length.
//   Bookcases run away on both sides in true perspective, every shelf full (gilt bands, labels, leaning books,
//   gaps), a gallery with a balustrade along the upper storey and a rolling ladder against it; a vaulted ceiling
//   with ribs and a candle chandelier; at the far end a gothic window of leaded stained glass (two lancets and a
//   rose) between two more bookcases, a grandfather clock whose pendulum swings, a long runner down a parquet
//   floor; coloured shafts of light falling from the window onto the floor with dust turning in them; cobwebs
//   in the corners, a stack of old books with a guttering candle and a globe in front; now and then a book
//   flaps across the hall. Night: moonlight through the glass, floating candles, sconces lit on the gallery,
//   ghostly wisps and a friendly ghost drifting past.
//   LibraryScene(W, H, opts)
function LibraryScene(W, H, opts) {
    const night = opts.theme === "dark", preview = !!opts.preview, TAU = Math.PI * 2, M = 30;
    const SPINES = ["#7a1f2b", "#1f4a7a", "#2f6a3a", "#8a5a1a", "#4a2a6a", "#a8442a", "#2a5a5a", "#6a4a2a", "#3a3a5a", "#8a2a4a"];
    const P = night
        ? { wood: ["#3a2230", "#24141e", "#4a3040", "#160c14"], floor: ["#2a1a24", "#140a12"], ceil: ["#140a14", "#20121e"], wall: ["#2a1a2a", "#1c101c"], stone: ["#5a5070", "#3a3450"],
            light: "150,175,255", glass: ["#2a3a8a", "#3a2a6a", "#1a4a6a", "#5a2a4a", "#2a5a5a", "#6a5a2a"], rug: ["#4a1424", "#2a0a14", "#8a6a3a"], gilt: "#a8864a", shade: 0.55 }
        : { wood: ["#7a4a2a", "#5a3218", "#9a6a3e", "#3a200e"], floor: ["#9a6a3a", "#6a4020"], ceil: ["#4a2c18", "#6a4428"], wall: ["#c8a878", "#a88a5a"], stone: ["#d8ccb4", "#a89c84"],
            light: "255,236,190", glass: ["#d83a3a", "#2a6ad8", "#f0b830", "#3aa04a", "#9a4ac8", "#e87a2a"], rug: ["#8a1a2a", "#5a0a18", "#e0b860"], gilt: "#e0b860", shade: 0.25 };
    let VPX, VPY, F, A = 1.4, ZF = 2.8, ZN = 1, FL = -1, CE = 1.7;
    let room, beams, front, glowSprite, wispImg, candles = [], motes = [], wisps = [], flames = [], event = null, nextEvent = preview ? 1e9 : 6;
    let clock = null, chand = null, stackCandle = null;
    const pr = (X, Y, z) => [VPX + (X * F) / z, VPY - (Y * F) / z];
    function paint(w, h, fn) { const c = Worlds.canvas(w, h), g = c.getContext("2d"); fn(g); return c; }
    const mix = (a, b, t) => { const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16)); return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
    function poly(g, pts, fill) { g.fillStyle = fill; g.beginPath(); pts.forEach((p, i) => g[i ? "lineTo" : "moveTo"](p[0], p[1])); g.closePath(); g.fill(); }

    // the back wall's window: a pointed arch of leaded glass with two lancets, a rose and stone tracery
    function windowPath(g, x0, x1, yb, ys) {
        const w = x1 - x0, apex = ys - w * 0.866;
        g.beginPath(); g.moveTo(x0, yb); g.lineTo(x0, ys); g.arc(x1, ys, w, Math.PI, Math.PI * 4 / 3); g.arc(x0, ys, w, Math.PI * 5 / 3, TAU); g.lineTo(x1, yb); g.closePath();
        return apex;
    }
    function drawWindow(g, x0, x1, yb, ys, R) {
        const w = x1 - x0, cx = (x0 + x1) / 2;
        g.save(); windowPath(g, x0 - w * 0.06, x1 + w * 0.06, yb + w * 0.04, ys);         // the stone surround
        const sg = g.createLinearGradient(x0, 0, x1, 0); sg.addColorStop(0, P.stone[0]); sg.addColorStop(1, P.stone[1]);
        g.fillStyle = sg; g.fill(); g.restore();
        g.save(); const apex = windowPath(g, x0, x1, yb, ys); g.clip();
        // the glass: quarries in a diamond lattice, each its own colour, lighter toward the middle
        const q = Math.max(6, w / 9);
        for (let y = apex - q; y < yb + q; y += q * 0.5) for (let x = x0 - q; x < x1 + q; x += q) {
            const ox = (Math.round((y - apex) / (q * 0.5)) % 2) * q * 0.5, px = x + ox, py = y;
            const col = P.glass[Math.floor(R() * P.glass.length)], d = Math.hypot(px - cx, py - (apex + yb) * 0.45) / w;
            const c2 = night ? mix(col, "#0a0a20", 0.35 + d * 0.2) : mix(col, "#ffffff", Math.max(0, 0.45 - d * 0.35));
            poly(g, [[px, py - q * 0.5], [px + q * 0.5, py], [px, py + q * 0.5], [px - q * 0.5, py]], c2);
        }
        if (night) {                                                                     // the moon glowing behind the glass
            const mg = g.createRadialGradient(cx + w * 0.15, apex + w * 0.55, 0, cx + w * 0.15, apex + w * 0.55, w * 0.7);
            mg.addColorStop(0, "rgba(230,235,255,.75)"); mg.addColorStop(0.3, "rgba(170,185,255,.35)"); mg.addColorStop(1, "rgba(120,140,255,0)");
            g.fillStyle = mg; g.fillRect(x0, apex, w, yb - apex);
        } else {
            const lg = g.createRadialGradient(cx, apex + w * 0.6, 0, cx, apex + w * 0.6, w * 0.9);
            lg.addColorStop(0, "rgba(255,255,235,.55)"); lg.addColorStop(1, "rgba(255,255,235,0)");
            g.fillStyle = lg; g.fillRect(x0, apex, w, yb - apex);
        }
        g.strokeStyle = night ? "rgba(10,8,20,.85)" : "rgba(40,30,30,.7)"; g.lineWidth = 1.3;      // the lead cames
        for (let y = apex - q; y < yb + q; y += q * 0.5) for (let x = x0 - q; x < x1 + q; x += q) {
            const ox = (Math.round((y - apex) / (q * 0.5)) % 2) * q * 0.5, px = x + ox;
            g.beginPath(); g.moveTo(px, y - q * 0.5); g.lineTo(px + q * 0.5, y); g.lineTo(px, y + q * 0.5); g.lineTo(px - q * 0.5, y); g.closePath(); g.stroke();
        }
        // the tracery: a mullion, two lancet arches, a rose with petals, a transom
        g.strokeStyle = P.stone[0]; g.lineCap = "round"; g.lineWidth = Math.max(3, w * 0.035);
        const lw = w / 2, rs = ys + w * 0.05;
        g.beginPath(); g.moveTo(cx, yb); g.lineTo(cx, rs); g.stroke();
        for (const [a0, a1] of [[x0, cx], [cx, x1]]) {
            const ww = a1 - a0; g.beginPath(); g.moveTo(a0, rs); g.arc(a1, rs, ww, Math.PI, Math.PI * 4 / 3); g.arc(a0, rs, ww, Math.PI * 5 / 3, TAU); g.stroke();
        }
        const rcx = cx, rcy = rs - lw * 1.15, rr = lw * 0.52;
        g.beginPath(); g.arc(rcx, rcy, rr, 0, TAU); g.stroke();
        g.lineWidth = Math.max(2, w * 0.02);
        for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; g.beginPath(); g.arc(rcx + Math.cos(a) * rr * 0.55, rcy + Math.sin(a) * rr * 0.55, rr * 0.38, 0, TAU); g.stroke(); }
        g.beginPath(); g.arc(rcx, rcy, rr * 0.2, 0, TAU); g.stroke();
        g.lineWidth = Math.max(3, w * 0.03); g.beginPath(); g.moveTo(x0, yb - (yb - ys) * 0.42); g.lineTo(x1, yb - (yb - ys) * 0.42); g.stroke();
        g.restore();
        g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 2; windowPath(g, x0, x1, yb, ys); g.stroke();
        g.fillStyle = P.stone[1]; g.fillRect(x0 - w * 0.1, yb, w * 1.2, w * 0.05);                    // the sill
        g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(x0 - w * 0.1, yb, w * 1.2, 1.5);
    }

    // a row of book spines standing on a shelf, in a wall plane (side = -1 left wall, 1 right wall)
    function shelfOfBooks(g, side, X, y0, z0, z1, maxH, R) {
        let z = z0 + R() * 0.01;
        while (z < z1 - 0.004) {
            const dz = (0.014 + R() * 0.02) * (z / 1.6), h = maxH * (0.62 + R() * 0.36);
            if (R() < 0.05) { z += dz * 1.5; continue; }                                   // a gap
            const za = z, zb = Math.min(z1, z + dz), lean = R() < 0.06 ? dz * 1.4 : 0;
            const col = SPINES[Math.floor(R() * SPINES.length)], tone = night ? mix(col, "#000000", 0.45) : mix(col, R() < 0.5 ? "#000000" : "#ffffff", R() * 0.18);
            const p = [pr(side * X, y0, za), pr(side * X, y0, zb), pr(side * X, y0 + h, zb + lean), pr(side * X, y0 + h, za + lean)];
            poly(g, p, tone);
            const sh = g.createLinearGradient(p[0][0], 0, p[1][0], 0); sh.addColorStop(0, "rgba(255,255,255,.12)"); sh.addColorStop(0.5, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(0,0,0,.25)");
            poly(g, p, sh);
            if (Math.abs(p[1][0] - p[0][0]) > 2.2) {                                      // gilt bands and a label
                g.strokeStyle = P.gilt; g.globalAlpha = night ? 0.5 : 0.8; g.lineWidth = 0.8;
                for (const f of [0.12, 0.18, 0.84]) { const a = pr(side * X, y0 + h * f, za + lean * f), b = pr(side * X, y0 + h * f, zb + lean * f); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
                if (R() < 0.4) { const a = pr(side * X, y0 + h * 0.62, za + dz * 0.25), b = pr(side * X, y0 + h * 0.72, zb - dz * 0.25); g.fillStyle = night ? "#6a5a4a" : "#efe2c0"; g.fillRect(Math.min(a[0], b[0]), b[1], Math.abs(b[0] - a[0]), a[1] - b[1]); }
                g.globalAlpha = 1;
            }
            z = zb + (lean ? dz : 0.0015);
        }
    }

    function setup() {
        const R = U.rng(1452), LW = W + M * 2;
        VPX = M + W / 2; VPY = H * 0.44;
        F = Math.min(W * 0.39, H * 0.62);
        ZN = Math.min(F / (H - VPY), (A * F) / (W / 2 + M), (CE * F) / VPY) * 0.92;
        const bays = preview ? 4 : 7, shelvesLow = [-1, -0.72, -0.44, -0.16], shelvesHigh = [0.42, 0.72, 1.02, 1.3], GAL = 0.3, RAIL = 0.6, DEPTH = 0.1;

        room = paint(LW, H, g => {
            // the ceiling: dark coffers between ribs
            poly(g, [pr(-A, CE, ZN), pr(A, CE, ZN), pr(A, CE, ZF), pr(-A, CE, ZF)], P.ceil[0]);
            for (let z = ZN; z < ZF; z += 0.16) {
                poly(g, [pr(-A, CE, z), pr(A, CE, z), pr(A, CE, z + 0.04), pr(-A, CE, z + 0.04)], P.ceil[1]);
                const a = pr(-A, CE, z + 0.04), b = pr(A, CE, z + 0.04); g.strokeStyle = night ? "rgba(255,200,160,.06)" : "rgba(255,230,190,.18)"; g.lineWidth = 1; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
            }
            for (const X of [-0.7, 0, 0.7]) poly(g, [pr(X - 0.03, CE, ZN), pr(X + 0.03, CE, ZN), pr(X + 0.03, CE, ZF), pr(X - 0.03, CE, ZF)], P.ceil[1]);
            // the floor: parquet boards running away, polished, lighter toward the window
            poly(g, [pr(-A, FL, ZN), pr(A, FL, ZN), pr(A, FL, ZF), pr(-A, FL, ZF)], P.floor[1]);
            const fg = g.createLinearGradient(0, pr(0, FL, ZF)[1], 0, H);
            fg.addColorStop(0, P.floor[0]); fg.addColorStop(1, P.floor[1]);
            poly(g, [pr(-A, FL, ZN), pr(A, FL, ZN), pr(A, FL, ZF), pr(-A, FL, ZF)], fg);
            g.strokeStyle = "rgba(0,0,0,.22)"; g.lineWidth = 1;
            for (let X = -A; X <= A; X += 0.11) { const a = pr(X, FL, ZN), b = pr(X, FL, ZF); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
            for (let z = ZN, k = 0; z < ZF; z += 0.09 * z, k++) for (let X = -A + (k % 2) * 0.055; X < A; X += 0.11) { if (R() < 0.5) continue; const a = pr(X, FL, z), b = pr(X + 0.11, FL, z); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
            for (let i = 0; i < 400; i++) { const X = -A + R() * 2 * A, z = ZN + R() * (ZF - ZN), p = pr(X, FL, z); g.fillStyle = R() < 0.5 ? "rgba(0,0,0,.08)" : "rgba(255,240,210,.05)"; g.fillRect(p[0], p[1], 8 / z, 1); }
            // the runner down the middle, with a border and a gold line
            const rug = (X0, X1, z0, z1, c) => poly(g, [pr(X0, FL, z0), pr(X1, FL, z0), pr(X1, FL, z1), pr(X0, FL, z1)], c);
            rug(-0.42, 0.42, ZN, ZF - 0.25, P.rug[1]); rug(-0.36, 0.36, ZN, ZF - 0.3, P.rug[0]);
            g.strokeStyle = P.rug[2]; g.lineWidth = 1.2; g.globalAlpha = 0.7;
            for (const X of [-0.32, 0.32]) { const a = pr(X, FL, ZN), b = pr(X, FL, ZF - 0.33); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
            for (let z = ZN + 0.1; z < ZF - 0.35; z += 0.2) { const a = pr(-0.2, FL, z), b = pr(0, FL, z + 0.06), c = pr(0.2, FL, z); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.stroke(); }
            for (let z = ZN + 0.2; z < ZF - 0.4; z += 0.38) {                               // medallions down the runner
                const c = pr(0, FL, z), a = pr(-0.16, FL, z), b = pr(0, FL, z + 0.1), d = pr(0.16, FL, z), e = pr(0, FL, z - 0.1);
                g.fillStyle = P.rug[1]; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(d[0], d[1]); g.lineTo(e[0], e[1]); g.closePath(); g.fill(); g.stroke();
                g.fillStyle = P.rug[2]; g.beginPath(); g.ellipse(c[0], c[1], 6 / z, 2.2 / z, 0, 0, TAU); g.fill();
            }
            for (let i = 0; i < 900; i++) { const X = -0.36 + Math.random() * 0.72, z = ZN + Math.random() * (ZF - 0.4 - ZN), p = pr(X, FL, z); g.fillStyle = i % 2 ? "rgba(0,0,0,.12)" : "rgba(255,220,200,.06)"; g.fillRect(p[0], p[1], 2 / z, 1); }
            g.globalAlpha = 1;
            // the back wall: panelled wood, a frieze, bookcases flanking the window
            const bl = pr(-A, FL, ZF), tr = pr(A, CE, ZF), bw = tr[0] - bl[0];
            const wg = g.createLinearGradient(0, tr[1], 0, bl[1]); wg.addColorStop(0, P.wood[3]); wg.addColorStop(0.5, P.wood[1]); wg.addColorStop(1, P.wood[0]);
            g.fillStyle = wg; g.fillRect(bl[0], tr[1], bw, bl[1] - tr[1]);
            const wx0 = VPX - bw * 0.15, wx1 = VPX + bw * 0.15, wyb = pr(0, -0.15, ZF)[1], wys = pr(0, 0.95, ZF)[1];
            for (const [x0, x1] of [[bl[0] + bw * 0.04, wx0 - bw * 0.11], [wx1 + bw * 0.06, tr[0] - bw * 0.04]]) {
                g.fillStyle = P.wood[3]; g.fillRect(x0, tr[1] + (bl[1] - tr[1]) * 0.08, x1 - x0, (bl[1] - tr[1]) * 0.92);
                const rows = 8, top = tr[1] + (bl[1] - tr[1]) * 0.1, rowH = ((bl[1] - top) * 0.97) / rows;
                for (let r = 0; r < rows; r++) {
                    let x = x0 + 2; const yb = top + (r + 1) * rowH - 2;
                    while (x < x1 - 3) { const bwid = 2 + R() * 3.5, bh = rowH * (0.55 + R() * 0.35); if (R() > 0.06) { g.fillStyle = night ? mix(SPINES[Math.floor(R() * SPINES.length)], "#000000", 0.5) : SPINES[Math.floor(R() * SPINES.length)]; g.fillRect(x, yb - bh, bwid, bh); } x += bwid + 0.4; }
                    g.fillStyle = P.wood[2]; g.fillRect(x0, yb, x1 - x0, 2);
                }
                g.strokeStyle = P.wood[2]; g.lineWidth = 3; g.strokeRect(x0, tr[1] + (bl[1] - tr[1]) * 0.08, x1 - x0, (bl[1] - tr[1]) * 0.92);
            }
            for (let k = 0; k < 3; k++) {                                                   // panelling under the window
                const px0 = wx0 + (k / 3) * (wx1 - wx0) + 3, pw = (wx1 - wx0) / 3 - 6, py0 = wyb + (bl[1] - wyb) * 0.12, ph = (bl[1] - wyb) * 0.76;
                g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(px0, py0, pw, ph);
                g.strokeStyle = P.wood[2]; g.lineWidth = 1.5; g.strokeRect(px0 + 3, py0 + 3, pw - 6, ph - 6);
                g.strokeStyle = "rgba(255,240,210,.12)"; g.beginPath(); g.moveTo(px0, py0 + ph); g.lineTo(px0 + pw, py0 + ph); g.stroke();
            }
            drawWindow(g, wx0, wx1, wyb, wys, R);
            V.window = { x0: wx0, x1: wx1, yb: wyb, ys: wys };
            // the grandfather clock against the back wall, left of the window (its pendulum and hands are live)
            {
                const cx = wx0 - bw * 0.055, base = bl[1], ch = (bl[1] - tr[1]) * 0.6, cw = bw * 0.072;
                g.fillStyle = "rgba(0,0,0,.3)"; g.fillRect(cx - cw * 0.7, base - 2, cw * 1.6, 4);
                const cg = g.createLinearGradient(cx - cw / 2, 0, cx + cw / 2, 0); cg.addColorStop(0, P.wood[2]); cg.addColorStop(1, P.wood[3]);
                g.fillStyle = cg; g.fillRect(cx - cw * 0.55, base - ch * 0.12, cw * 1.1, ch * 0.12); g.fillRect(cx - cw * 0.4, base - ch * 0.75, cw * 0.8, ch * 0.64); g.fillRect(cx - cw * 0.55, base - ch, cw * 1.1, ch * 0.27);
                g.beginPath(); g.arc(cx, base - ch, cw * 0.55, Math.PI, TAU); g.fill();
                g.fillStyle = night ? "#0c0810" : "#2a1a10"; g.fillRect(cx - cw * 0.25, base - ch * 0.7, cw * 0.5, ch * 0.5);
                g.fillStyle = night ? "#b8b0a0" : "#f4ecd8"; g.beginPath(); g.arc(cx, base - ch * 0.87, cw * 0.38, 0, TAU); g.fill();
                g.strokeStyle = P.gilt; g.lineWidth = 1.2; g.stroke();
                g.fillStyle = "#3a2a1a"; for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; g.fillRect(cx + Math.cos(a) * cw * 0.31 - 0.6, base - ch * 0.87 + Math.sin(a) * cw * 0.31 - 0.6, 1.2, 1.2); }
                clock = { x: cx - M, y: base - ch * 0.87, r: cw * 0.38, py: base - ch * 0.7, pl: ch * 0.46, win: [cx - cw * 0.25 - M, base - ch * 0.7, cw * 0.5, ch * 0.5] };
            }
            // the side walls: bays of bookcases, two storeys, a gallery with a balustrade
            for (const side of [-1, 1]) {
                const sx = side * A;
                poly(g, [pr(sx, FL, ZN), pr(sx, FL, ZF), pr(sx, CE, ZF), pr(sx, CE, ZN)], P.wood[3]);
                const zs = Array.from({ length: bays + 1 }, (_, i) => ZN * Math.pow(ZF / ZN, i / bays));
                for (let b = 0; b < bays; b++) {
                    const z0 = zs[b] + 0.012 * zs[b], z1 = zs[b + 1] - 0.012 * zs[b + 1];
                    poly(g, [pr(sx, FL, z0), pr(sx, FL, z1), pr(sx, CE - 0.1, z1), pr(sx, CE - 0.1, z0)], night ? "#0a0408" : "#24140a");   // the case's dark back
                    for (const [list, top] of [[shelvesLow, GAL - 0.04], [shelvesHigh, CE - 0.14]]) list.forEach((y, k) => {
                        const next = k < list.length - 1 ? list[k + 1] : top;
                        shelfOfBooks(g, side, A - 0.03, y + 0.02, z0, z1, (next - y) * 0.9, R);
                        const fr = [pr(sx - side * DEPTH, y + 0.02, z0), pr(sx - side * DEPTH, y + 0.02, z1), pr(sx - side * DEPTH, y - 0.01, z1), pr(sx - side * DEPTH, y - 0.01, z0)];
                        poly(g, fr, P.wood[0]);
                        if (y < 0) poly(g, [pr(sx, y + 0.02, z0), pr(sx, y + 0.02, z1), pr(sx - side * DEPTH, y + 0.02, z1), pr(sx - side * DEPTH, y + 0.02, z0)], P.wood[2]);
                        else poly(g, [pr(sx, y - 0.01, z0), pr(sx, y - 0.01, z1), pr(sx - side * DEPTH, y - 0.01, z1), pr(sx - side * DEPTH, y - 0.01, z0)], P.wood[3]);
                        const sh = [pr(sx, next - 0.01, z0), pr(sx, next - 0.01, z1), pr(sx, next - 0.08, z1), pr(sx, next - 0.08, z0)];
                        const shg = g.createLinearGradient(0, sh[0][1], 0, sh[3][1]); shg.addColorStop(0, "rgba(0,0,0,.45)"); shg.addColorStop(1, "rgba(0,0,0,0)"); poly(g, sh, shg);
                    });
                }
                for (const z of zs) {                                                    // the uprights between bays, carved at the top
                    poly(g, [pr(sx, FL, z * 0.985), pr(sx - side * DEPTH * 1.3, FL, z * 0.985), pr(sx - side * DEPTH * 1.3, CE, z * 0.985), pr(sx, CE, z * 0.985)], P.wood[2]);
                    poly(g, [pr(sx, FL, z * 0.985), pr(sx, FL, z * 1.012), pr(sx, CE, z * 1.012), pr(sx, CE, z * 0.985)], P.wood[0]);
                }
                poly(g, [pr(sx, CE - 0.12, ZN), pr(sx, CE - 0.12, ZF), pr(sx, CE, ZF), pr(sx, CE, ZN)], P.wood[0]);   // the cornice
                // the gallery: its underside, the fascia, the rail and balusters
                const gx = sx - side * 0.36;
                poly(g, [pr(sx, GAL, ZN), pr(sx, GAL, ZF), pr(gx, GAL, ZF), pr(gx, GAL, ZN)], P.wood[3]);
                poly(g, [pr(gx, GAL, ZN), pr(gx, GAL, ZF), pr(gx, GAL + 0.06, ZF), pr(gx, GAL + 0.06, ZN)], P.wood[0]);
                const lit = [pr(gx, GAL + 0.06, ZN), pr(gx, GAL + 0.06, ZF)]; g.strokeStyle = night ? "rgba(255,200,160,.12)" : "rgba(255,230,190,.35)"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(...lit[0]); g.lineTo(...lit[1]); g.stroke();
                g.strokeStyle = P.wood[2];
                for (let z = ZN; z < ZF; z *= 1.035) { const a = pr(gx, GAL + 0.06, z), b = pr(gx, RAIL, z); g.lineWidth = Math.max(1, 5 / z); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
                poly(g, [pr(gx, RAIL, ZN), pr(gx, RAIL, ZF), pr(gx, RAIL + 0.035, ZF), pr(gx, RAIL + 0.035, ZN)], P.wood[0]);
                // sconces on the gallery fascia (lit at night: drawn live)
                if (side < 0) V.sconces = [];
                for (let i = 1; i < bays; i += 2) { const p = pr(gx, GAL - 0.06, zs[i]); g.fillStyle = P.gilt; g.fillRect(p[0] - 2, p[1], 4, 7 / zs[i] * 1.4); V.sconces.push([p[0] - M, p[1] - 3, 1 / zs[i]]); }
            }
            // the rolling ladder on the right, leaning on the gallery rail
            {
                const zA = 1.55, zB = 1.62;
                g.strokeStyle = P.wood[2]; g.lineCap = "round";
                for (const dz of [0, 0.09]) { const a = pr(A - 0.42, FL, zA + dz), b = pr(A - 0.36, RAIL + 0.04, zB + dz); g.lineWidth = Math.max(2, 7 / zA); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
                g.lineWidth = Math.max(1.5, 4 / zA);
                for (let k = 1; k < 12; k++) { const t = k / 12, X = A - 0.42 + 0.06 * t, Y = FL + (RAIL + 0.04 - FL) * t, z = zA + (zB - zA) * t, a = pr(X, Y, z), b = pr(X, Y, z + 0.09); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
            }
            // the chandelier hanging in the middle (its candles are live)
            {
                const zc = 1.35, top = pr(0, CE + 1, zc), ring = pr(0, 0.86, zc), rx = (0.34 * F) / zc, ry = rx * 0.2;
                g.strokeStyle = night ? "#3a3030" : "#4a3a2a"; g.lineWidth = 2; g.beginPath(); g.moveTo(top[0], top[1]); g.lineTo(ring[0], ring[1] - ry * 2); g.stroke();
                for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; g.beginPath(); g.moveTo(ring[0], ring[1] - ry * 3); g.lineTo(ring[0] + Math.cos(a) * rx, ring[1] + Math.sin(a) * ry); g.stroke(); }
                g.strokeStyle = P.gilt; g.lineWidth = 3; g.beginPath(); g.ellipse(ring[0], ring[1], rx, ry, 0, 0, TAU); g.stroke();
                g.lineWidth = 1.5; g.beginPath(); g.ellipse(ring[0], ring[1] + ry * 0.8, rx * 0.5, ry * 0.5, 0, 0, TAU); g.stroke();
                chand = { x: ring[0] - M, y: ring[1], rx, ry, s: 1 / zc };
            }
            // a soft vignette in the corners of the hall
            const vg = g.createRadialGradient(VPX, VPY, Math.min(W, H) * 0.25, VPX, VPY, Math.max(W, H) * 0.75);
            vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, `rgba(0,0,0,${P.shade})`);
            g.fillStyle = vg; g.fillRect(0, 0, LW, H);
        });

        // the shafts of light from the window onto the floor, and the pool of colour they leave there
        beams = paint(LW, H, g => {
            const { x0, x1, yb, ys } = V.window, w = x1 - x0;
            const pool = [pr(-0.5, FL, ZN + 0.25), pr(0.55, FL, ZN + 0.25), pr(0.25, FL, ZF - 0.05), pr(-0.25, FL, ZF - 0.05)];
            for (let i = 0; i < 5; i++) {
                const u0 = i / 5, u1 = (i + 1) / 5, col = night ? P.light : ["255,120,110", "130,170,255", "255,220,120", "140,230,150", "210,150,255"][i];
                const top0 = [x0 + w * u0, ys - w * 0.3], top1 = [x0 + w * u1, ys - w * 0.3];
                const b0 = [pool[0][0] + (pool[1][0] - pool[0][0]) * u0, pool[0][1]], b1 = [pool[0][0] + (pool[1][0] - pool[0][0]) * u1, pool[1][1]];
                const bg = g.createLinearGradient(0, ys, 0, b0[1]);
                bg.addColorStop(0, `rgba(${col},${night ? 0.1 : 0.14})`); bg.addColorStop(1, `rgba(${col},0)`);
                poly(g, [top0, top1, b1, b0], bg);
            }
            const pg = g.createLinearGradient(0, pool[2][1], 0, pool[0][1]);
            pg.addColorStop(0, `rgba(${P.light},${night ? 0.2 : 0.3})`); pg.addColorStop(1, `rgba(${P.light},0)`);
            poly(g, pool, pg);
            const rg = g.createLinearGradient(0, yb, 0, H);                                    // the window's gleam in the polished floor
            rg.addColorStop(0, `rgba(${P.light},${night ? 0.18 : 0.22})`); rg.addColorStop(1, `rgba(${P.light},0)`);
            g.fillStyle = rg; g.fillRect(x0 + w * 0.2, pr(0, FL, ZF)[1], w * 0.6, H);
        });

        // the front: cobwebs, a stack of old books with a candle, a globe on a stand
        front = paint(LW, H, g => {
            const s = U.clamp(Math.min(W, H) / 900, 0.55, 1.15);
            const web = (x, y, r, dir) => {
                g.strokeStyle = night ? "rgba(200,210,255,.28)" : "rgba(255,255,255,.4)"; g.lineWidth = 0.8;
                const spokes = 7;
                for (let i = 0; i <= spokes; i++) { const a = (dir > 0 ? 0 : Math.PI / 2) + (i / spokes) * (Math.PI / 2); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r * dir, y + Math.sin(a) * r); g.stroke(); }
                for (let k = 1; k < 8; k++) {
                    const rr = (k / 8) * r; g.beginPath();
                    for (let i = 0; i <= spokes; i++) { const a = (dir > 0 ? 0 : Math.PI / 2) + (i / spokes) * (Math.PI / 2), sag = i && i < spokes ? 0.9 : 1; const px = x + Math.cos(a) * rr * sag * dir, py = y + Math.sin(a) * rr * sag; g[i ? "lineTo" : "moveTo"](px, py); }
                    g.stroke();
                }
            };
            web(M, 0, 150 * s, 1); web(M + W, 0, 120 * s, -1);
            // the book stack, bottom left
            const bx = M + W * 0.08, by = H;
            const books = [[200, 34, "#5a1a20"], [180, 30, "#1f3a5a"], [190, 38, "#2a4a2a"], [160, 28, "#6a4a1a"], [150, 26, "#4a2a5a"]];
            let y = by;
            books.forEach(([w, h, c], i) => {
                w *= s; h *= s; const x = bx + (i % 2 ? 10 : -6) * s - w / 2;
                y -= h;
                const col = night ? mix(c, "#000000", 0.45) : c;
                g.fillStyle = night ? "#8a8070" : "#efe4c8"; g.fillRect(x + 5 * s, y + 3 * s, w - 4 * s, h - 6 * s);
                g.strokeStyle = night ? "rgba(0,0,0,.3)" : "rgba(150,130,90,.6)"; g.lineWidth = 0.7; for (let k = 1; k < 6; k++) { g.beginPath(); g.moveTo(x + 6 * s, y + 3 * s + k * (h - 6 * s) / 6); g.lineTo(x + w, y + 3 * s + k * (h - 6 * s) / 6); g.stroke(); }
                const lg = g.createLinearGradient(0, y, 0, y + h); lg.addColorStop(0, mix(col, "#ffffff", 0.15)); lg.addColorStop(1, mix(col, "#000000", 0.3));
                g.fillStyle = lg; g.beginPath(); g.roundRect(x, y, 14 * s, h, 4 * s); g.fill();
                g.fillRect(x, y, w, 3 * s); g.fillRect(x, y + h - 3 * s, w, 3 * s);
                g.fillStyle = P.gilt; g.fillRect(x + 3 * s, y + h * 0.25, 8 * s, 1.5); g.fillRect(x + 3 * s, y + h * 0.7, 8 * s, 1.5);
            });
            const cx = bx + 20 * s, ch = 60 * s;                                                // the candle on top, wax dripping down
            g.fillStyle = night ? "#c8bca8" : "#f6efdc"; g.fillRect(cx - 9 * s, y - ch, 18 * s, ch);
            g.fillStyle = "rgba(0,0,0,.15)"; g.fillRect(cx + 4 * s, y - ch, 5 * s, ch);
            g.fillStyle = night ? "#d8ccb8" : "#fffaf0"; for (const [dx, l] of [[-7, 18], [-2, 30], [5, 12]]) { g.beginPath(); g.roundRect(cx + dx * s - 2 * s, y - ch, 4 * s, l * s, 2 * s); g.fill(); }
            g.fillStyle = night ? "#c8bca8" : "#f6efdc"; g.beginPath(); g.ellipse(cx, y - 2 * s, 20 * s, 5 * s, 0, 0, TAU); g.fill();
            stackCandle = { x: cx - M, y: y - ch - 2 * s, s };
            // the globe, bottom right
            const gx = M + W * 0.92, gy = H - 170 * s, gr = 62 * s;
            g.strokeStyle = night ? "#4a3a2a" : "#6a4a2a"; g.lineWidth = 8 * s; g.beginPath(); g.moveTo(gx, gy + gr + 6 * s); g.lineTo(gx, H); g.stroke();
            g.lineWidth = 4 * s; g.beginPath(); g.moveTo(gx - 40 * s, H); g.lineTo(gx, H - 40 * s); g.lineTo(gx + 40 * s, H); g.stroke();
            const og = g.createRadialGradient(gx - gr * 0.35, gy - gr * 0.35, gr * 0.1, gx, gy, gr);
            og.addColorStop(0, night ? "#5a6a7a" : "#d8e4c8"); og.addColorStop(1, night ? "#1a2230" : "#7a8a5a");
            g.fillStyle = og; g.beginPath(); g.arc(gx, gy, gr, 0, TAU); g.fill();
            g.save(); g.beginPath(); g.arc(gx, gy, gr, 0, TAU); g.clip();
            g.fillStyle = night ? "rgba(140,120,80,.4)" : "rgba(160,110,60,.55)";
            for (const [dx, dy, rx, ry, a] of [[-0.3, -0.25, 0.3, 0.22, 0.4], [0.25, 0.1, 0.22, 0.35, -0.3], [-0.1, 0.45, 0.25, 0.12, 0]]) { g.beginPath(); g.ellipse(gx + dx * gr, gy + dy * gr, rx * gr, ry * gr, a, 0, TAU); g.fill(); }
            g.strokeStyle = "rgba(60,40,20,.35)"; g.lineWidth = 0.8;
            for (let k = -2; k <= 2; k++) { g.beginPath(); g.ellipse(gx, gy + k * gr * 0.35, gr * Math.sqrt(1 - (k * 0.35) ** 2), gr * 0.06, 0, 0, TAU); g.stroke(); g.beginPath(); g.ellipse(gx + k * gr * 0.35, gy, gr * 0.12 + Math.abs(k) * 2, gr, 0, 0, TAU); g.stroke(); }
            g.restore();
            g.strokeStyle = P.gilt; g.lineWidth = 3 * s; g.beginPath(); g.arc(gx, gy, gr + 6 * s, Math.PI * 0.75, Math.PI * 2.25); g.stroke();
        });

        glowSprite = paint(64, 64, g => { const gg = g.createRadialGradient(32, 32, 0, 32, 32, 32); gg.addColorStop(0, "rgba(255,210,130,.9)"); gg.addColorStop(0.4, "rgba(255,170,80,.3)"); gg.addColorStop(1, "rgba(255,150,60,0)"); g.fillStyle = gg; g.fillRect(0, 0, 64, 64); });
        wispImg = paint(128, 64, g => { const gg = g.createRadialGradient(64, 32, 0, 64, 32, 60); gg.addColorStop(0, "rgba(190,255,230,.22)"); gg.addColorStop(1, "rgba(190,255,230,0)"); g.save(); g.scale(1, 0.5); g.fillStyle = gg; g.beginPath(); g.arc(64, 64, 60, 0, TAU); g.fill(); g.restore(); });
        candles = night ? Array.from({ length: preview ? 5 : 14 }, () => ({ x: R() * W, y: H * U.lerp(0.1, 0.5, R()), h: U.lerp(14, 28, R()), z: U.lerp(0.5, 1.1, R()), ph: R() * TAU })) : [];
        motes = Array.from({ length: preview ? 15 : 70 }, () => ({ x: W * U.lerp(0.25, 0.75, R()), y: R() * H, sp: U.lerp(4, 14, R()), s: U.lerp(0.6, 1.8, R()), ph: R() * TAU }));
        wisps = night ? Array.from({ length: preview ? 2 : 6 }, () => ({ x: R() * W, y: H * U.lerp(0.3, 0.8, R()), r: U.lerp(60, 140, R()), sp: U.lerp(6, 14, R()), ph: R() * TAU })) : [];
    }
    const V = {};
    setup();

    function flame(g, x, y, s, t, ph) {
        const fl = 0.85 + 0.15 * Math.sin(t * 13 + ph) * Math.sin(t * 7.3 + ph * 2);
        g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.75 * fl;
        g.drawImage(glowSprite, x - 36 * s, y - 40 * s, 72 * s, 72 * s);
        g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
        g.fillStyle = "#ffb84a"; g.beginPath(); g.ellipse(x + Math.sin(t * 9 + ph) * 0.8 * s, y - 5 * s * fl, 2.8 * s, 6 * s * fl, 0, 0, TAU); g.fill();
        g.fillStyle = "#fff6d8"; g.beginPath(); g.ellipse(x, y - 3.5 * s, 1.2 * s, 2.6 * s, 0, 0, TAU); g.fill();
    }
    function flyingBook(g, x, y, s, t, col) {
        const flap = Math.sin(t * 9) * 0.9;
        g.save(); g.translate(x, y); g.scale(s, s);
        for (const side of [-1, 1]) {
            g.fillStyle = mix(col, "#000000", side < 0 ? 0.2 : 0);
            g.beginPath(); g.moveTo(0, -13); g.lineTo(side * 28, -13 - flap * 14); g.lineTo(side * 28, 13 - flap * 14); g.lineTo(0, 13); g.fill();
            g.fillStyle = "#f4ead0";
            g.beginPath(); g.moveTo(0, -11); g.lineTo(side * 24, -11 - flap * 11); g.lineTo(side * 24, 11 - flap * 11); g.lineTo(0, 11); g.fill();
            g.strokeStyle = "rgba(120,100,70,.5)"; g.lineWidth = 0.7;
            for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(side * 3, k * 4); g.lineTo(side * 21, k * 4 - flap * 10); g.stroke(); }
        }
        g.fillStyle = mix(col, "#000000", 0.35); g.fillRect(-2, -13, 4, 26);
        g.restore();
    }
    function ghost(g, x, y, s, t, a) {
        g.save(); g.translate(x, y); g.scale(s, s); g.globalAlpha = a;
        Worlds.glow(g, 0, 0, 60, "#b6ffe0", 0.35);
        const gg = g.createLinearGradient(0, -34, 0, 26); gg.addColorStop(0, "#f4f6ff"); gg.addColorStop(1, "rgba(220,230,255,.4)");
        g.fillStyle = gg;
        g.beginPath(); g.arc(0, -10, 24, Math.PI, TAU); g.lineTo(24, 22);
        for (let i = 0; i <= 4; i++) g.lineTo(24 - i * 12, 22 + (i % 2 ? -6 : 6) + Math.sin(t * 6 + i) * 3);
        g.closePath(); g.fill();
        g.fillStyle = "#2a2440";
        g.beginPath(); g.ellipse(-8, -12, 3.5, 5, 0, 0, TAU); g.ellipse(8, -12, 3.5, 5, 0, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(0, 2, 4, 3 + Math.sin(t * 3), 0, 0, TAU); g.fill();
        g.fillStyle = "rgba(255,150,170,.4)"; g.beginPath(); g.ellipse(-14, -2, 4, 2.4, 0, 0, TAU); g.ellipse(14, -2, 4, 2.4, 0, 0, TAU); g.fill();
        g.restore(); g.globalAlpha = 1;
    }

    return {
        resize(w, h) { W = w; H = h; setup(); },
        draw(g, t, dt, inp) {
            const px = inp.px || 0, ox = -M - px * 5;
            g.drawImage(room, ox, 0);
            // the clock: its pendulum swinging, its hands
            if (clock) {
                const cx = clock.x - px * 5, sw = Math.sin(t * Math.PI) * 0.1;
                g.save(); g.beginPath(); g.rect(clock.win[0] - px * 5, clock.win[1], clock.win[2], clock.win[3]); g.clip();
                const bx = cx + Math.sin(sw) * clock.pl * 0.75, by = clock.py + Math.cos(sw) * clock.pl * 0.75;
                g.strokeStyle = "#b8903a"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(cx, clock.py); g.lineTo(bx, by); g.stroke();
                g.fillStyle = "#d8b048"; g.beginPath(); g.arc(bx, by, clock.r * 0.4, 0, TAU); g.fill();
                g.fillStyle = "rgba(255,255,230,.6)"; g.beginPath(); g.arc(bx - clock.r * 0.12, by - clock.r * 0.12, clock.r * 0.12, 0, TAU); g.fill();
                g.restore();
                const d = new Date(), hA = ((d.getHours() % 12) + d.getMinutes() / 60) / 12 * TAU - Math.PI / 2, mA = (d.getMinutes() / 60) * TAU - Math.PI / 2;
                g.strokeStyle = "#1a1008"; g.lineCap = "round";
                g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx, clock.y); g.lineTo(cx + Math.cos(hA) * clock.r * 0.5, clock.y + Math.sin(hA) * clock.r * 0.5); g.stroke();
                g.lineWidth = 1; g.beginPath(); g.moveTo(cx, clock.y); g.lineTo(cx + Math.cos(mA) * clock.r * 0.78, clock.y + Math.sin(mA) * clock.r * 0.78); g.stroke();
            }
            // the shafts of light, breathing
            g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.85 + 0.15 * Math.sin(t * 0.5); g.drawImage(beams, ox, 0); g.restore();
            // dust turning in the light
            for (const m of motes) {
                m.y -= m.sp * dt * 0.4; m.x += Math.sin(t * 0.5 + m.ph) * dt * 4;
                if (m.y < -4) { m.y = H + 4; m.x = W * U.lerp(0.25, 0.75, Math.random()); }
                const a = night ? 0.2 + 0.2 * Math.sin(t * 2 + m.ph) : 0.3 + 0.3 * Math.sin(t * 1.5 + m.ph), x = m.x - px * 10;
                g.fillStyle = night ? `rgba(190,210,255,${a.toFixed(2)})` : `rgba(255,248,220,${a.toFixed(2)})`;
                g.beginPath(); g.arc(x, m.y, m.s, 0, TAU); g.fill();
                if (!night && a > 0.55) Worlds.glint(g, x, m.y, m.s * 4, (a - 0.55) * 5, "#fff8dc");
            }
            // the chandelier's candles (lit by day too: it's a dim hall)
            if (chand) for (let i = 0; i < 8; i++) {
                const a = (i / 8) * TAU, x = chand.x - px * 5 + Math.cos(a) * chand.rx, y = chand.y + Math.sin(a) * chand.ry, s = chand.s * 0.9;
                g.fillStyle = night ? "#c8bca8" : "#f6efdc"; g.fillRect(x - 2.5 * s, y - 14 * s, 5 * s, 14 * s);
                flame(g, x, y - 14 * s, s, t, i * 1.7);
            }
            if (night && V.sconces) for (const [x, y, s] of V.sconces) flame(g, x - px * 5, y, s * 0.8, t, x);
            for (const w of wisps) {                                               // ghostly wisps drifting (night)
                w.x += w.sp * dt; if (w.x > W + w.r * 2) w.x = -w.r * 2;
                const y = w.y + Math.sin(t * 0.7 + w.ph) * 20;
                g.drawImage(wispImg, w.x - px * 14 - w.r * 1.6, y - w.r * 0.6, w.r * 3.2, w.r * 1.2);
            }
            for (const c of candles) {                                             // floating candles (night)
                const x = c.x - px * 18 * c.z, y = c.y + Math.sin(t * 1.1 + c.ph) * 8, s = c.z;
                g.fillStyle = "#efe6cf"; g.fillRect(x - 3.5 * s, y - c.h * s, 7 * s, c.h * s);
                g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(x + 1.5 * s, y - c.h * s, 2 * s, c.h * s);
                g.fillStyle = "#fffaf0"; g.fillRect(x - 3.5 * s, y - c.h * s, 2 * s, c.h * s * 0.4);
                flame(g, x, y - c.h * s, s, t, c.ph);
            }
            nextEvent -= dt;                                                       // a book flaps across, or a ghost drifts by
            if (!event && nextEvent <= 0) event = { x: -60, y: H * U.rand(0.18, 0.45), vx: U.rand(50, 90), s: U.clamp(H / 900, 0.6, 1.2), col: SPINES[Math.floor(Math.random() * SPINES.length)] };
            if (event) {
                event.x += event.vx * dt;
                const y = event.y + Math.sin(t * 2) * 18;
                if (night) ghost(g, event.x - px * 16, y, event.s, t, 0.6);
                else flyingBook(g, event.x - px * 16, y, event.s, t, event.col);
                if (event.x > W + 80) { event = null; nextEvent = U.rand(12, 22); }
            }
            const fx = -M - px * 14;
            g.drawImage(front, fx, 0);
            if (stackCandle) flame(g, stackCandle.x + M + fx, stackCandle.y, stackCandle.s * 1.6, t, 3.3);
        }
    };
}
