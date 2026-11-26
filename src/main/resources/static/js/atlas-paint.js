// The Atlas's map, painted: the lands of the Everbook as one illustrated fantasy map. It runs in a worker (so painting
// it never stalls the page) or, where workers can't draw, in the page itself (AtlasPaint.paint). Everything is drawn
// once into one picture; atlas.js lays the locations, the road and the fog over it.
//   in a worker: postMessage({ W, H, SPOT, regions, scale }) -> an ImageBitmap back
(() => {
    const TAU = Math.PI * 2;
    const INK = "#3e2e1e", INK_SOFT = "rgba(62,46,30,.55)";

    // ---------------------------------------------------------------------------------------------------------
    // helpers: random numbers, noise, shapes, colours
    // ---------------------------------------------------------------------------------------------------------
    function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
    function noiseMaker(seed) {
        const p = new Uint8Array(512), R = rng(seed);
        for (let i = 0; i < 256; i++) p[i] = i;
        for (let i = 255; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
        for (let i = 0; i < 256; i++) p[i + 256] = p[i];
        const fade = t => t * t * (3 - 2 * t), h = (x, y) => p[p[x & 255] + (y & 255)] / 255;
        const n = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = fade(xf), v = fade(yf);
            const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
        return (x, y, oct = 4) => { let s = 0, amp = 1, f = 1, tot = 0; for (let o = 0; o < oct; o++) { s += n(x * f, y * f) * amp; tot += amp; amp *= 0.5; f *= 2; } return s / tot; };
    }
    function rough(points, R, amount, levels = 4) {
        let pts = points.map(p => p.slice());
        for (let lvl = 0; lvl < levels; lvl++) {
            const out = [];
            for (let i = 0; i < pts.length; i++) {
                const a = pts[i], b = pts[(i + 1) % pts.length], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, off = (R() - 0.5) * len * amount;
                out.push(a, [(a[0] + b[0]) / 2 - dy / len * off, (a[1] + b[1]) / 2 + dx / len * off]);
            }
            pts = out; amount *= 0.6;
        }
        return pts;
    }
    function pathOf(pts, closed = true) {
        const p = new Path2D(), n = pts.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        if (closed) { let m = mid(pts[n - 1], pts[0]); p.moveTo(m[0], m[1]); for (let i = 0; i < n; i++) { const m2 = mid(pts[i], pts[(i + 1) % n]); p.quadraticCurveTo(pts[i][0], pts[i][1], m2[0], m2[1]); } p.closePath(); }
        else { p.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < n - 1; i++) { const m2 = mid(pts[i], pts[i + 1]); p.quadraticCurveTo(pts[i][0], pts[i][1], m2[0], m2[1]); } p.lineTo(pts[n - 1][0], pts[n - 1][1]); }
        return p;
    }
    // a closed outline moved out (d > 0) or in along its normals, for the coast's contour lines
    function offset(pts, d) {
        const n = pts.length, out = [];
        for (let i = 0; i < n; i++) {
            const a = pts[(i - 2 + n) % n], b = pts[(i + 2) % n], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
            out.push([pts[i][0] + ty / l * d, pts[i][1] - tx / l * d]);
        }
        return out;
    }
    const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
    const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
    const mixC = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
    function canvas(w, h) { return typeof OffscreenCanvas === "function" ? new OffscreenCanvas(Math.max(1, w), Math.max(1, h)) : Object.assign(document.createElement("canvas"), { width: Math.max(1, w), height: Math.max(1, h) }); }

    // ---------------------------------------------------------------------------------------------------------
    // the geography (in map units; the map is W x H)
    // ---------------------------------------------------------------------------------------------------------
    const COAST = [[250, 2630], [520, 2720], [800, 2690], [1180, 2740], [1500, 2700], [1700, 2760], [2050, 2710], [2330, 2560], [2440, 2390], [2360, 2160],
        [2470, 2020], [2490, 1820], [2430, 1640], [2480, 1470], [2400, 1260], [2310, 1070], [2140, 950], [1990, 880], [1960, 760], [1760, 640], [1540, 540],
        [1300, 450], [1050, 470], [860, 560], [640, 600], [450, 700], [270, 880], [170, 1110], [140, 1360], [105, 1620], [140, 1880], [100, 2150], [150, 2420]];
    const ISLE = [[2060, 520], [2120, 400], [2260, 330], [2420, 300], [2580, 360], [2600, 500], [2520, 640], [2340, 700], [2160, 660]];
    const ISLETS = [[[2620, 2470], 60], [[2560, 2620], 40], [[60, 2700], 70], [[1950, 2840], 50], [[2640, 980], 70], [[60, 1000], 50]];
    const RIVERS = [
        { name: "The Quill River", pts: [[1380, 1130], [1460, 1300], [1560, 1440], [1640, 1600], [1790, 1760], [1960, 1900], [2150, 2010], [2380, 2080]], w: 14 },
        { name: "", pts: [[2160, 1220], [2100, 1110], [2040, 990], [2010, 890]], w: 10 },
        { name: "The Long Ink", pts: [[1060, 1270], [900, 1310], [720, 1270], [560, 1340], [380, 1370], [140, 1390]], w: 12 },
        { name: "", pts: [[2180, 2310], [2240, 2250], [2300, 2200], [2360, 2150]], w: 9, choc: true }
    ];

    // ---------------------------------------------------------------------------------------------------------
    // the little drawings
    // ---------------------------------------------------------------------------------------------------------
    function peak(g, x, y, w, h, c, snow, R) {
        const light = rgba(mixC(c, [255, 250, 235], 0.35)), dark = rgba(mixC(c, [40, 30, 50], 0.35));
        const lx = x - w / 2, rx = x + w / 2, tx = x + (R() - 0.5) * w * 0.15, ty = y - h;
        g.fillStyle = light; g.beginPath(); g.moveTo(lx, y); g.lineTo(tx - w * 0.1, ty + h * 0.2); g.lineTo(tx, ty); g.lineTo(tx + w * 0.04, y); g.closePath(); g.fill();
        g.fillStyle = dark; g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx + w * 0.16, ty + h * 0.28); g.lineTo(rx, y); g.lineTo(tx + w * 0.04, y); g.closePath(); g.fill();
        // shadow-side hatching
        g.strokeStyle = "rgba(40,28,20,.35)"; g.lineWidth = 1.2; g.beginPath();
        for (let k = 1; k < 6; k++) { const yy = ty + h * (0.25 + k * 0.13), xx = tx + w * 0.05 + k * w * 0.06; g.moveTo(xx, yy); g.lineTo(xx + w * 0.1, yy + h * 0.1); }
        g.stroke();
        if (snow) { g.fillStyle = "#ffffff"; g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx + w * 0.14, ty + h * 0.24); g.lineTo(tx + w * 0.05, ty + h * 0.2); g.lineTo(tx - w * 0.02, ty + h * 0.3); g.lineTo(tx - w * 0.1, ty + h * 0.2); g.closePath(); g.fill(); }
        g.strokeStyle = INK; g.lineWidth = 2.2; g.lineJoin = "round"; g.beginPath(); g.moveTo(lx, y); g.lineTo(tx - w * 0.1, ty + h * 0.2); g.lineTo(tx, ty); g.lineTo(tx + w * 0.16, ty + h * 0.28); g.lineTo(rx, y); g.stroke();
    }
    function hill(g, x, y, w, c) {
        g.fillStyle = rgba(mixC(c, [255, 250, 235], 0.2)); g.beginPath(); g.moveTo(x - w / 2, y); g.quadraticCurveTo(x, y - w * 0.55, x + w / 2, y); g.closePath(); g.fill();
        g.fillStyle = rgba(mixC(c, [40, 30, 30], 0.2)); g.beginPath(); g.moveTo(x + w * 0.05, y - w * 0.27); g.quadraticCurveTo(x + w * 0.3, y - w * 0.18, x + w / 2, y); g.lineTo(x + w * 0.1, y); g.closePath(); g.fill();
        g.strokeStyle = INK_SOFT; g.lineWidth = 1.8; g.beginPath(); g.moveTo(x - w / 2, y); g.quadraticCurveTo(x, y - w * 0.55, x + w / 2, y); g.stroke();
    }
    function crown(g, x, y, r, c, outline = true) {
        g.fillStyle = rgba(mixC(c, [30, 20, 10], 0.25)); g.beginPath(); g.arc(x + r * 0.15, y + r * 0.12, r, 0, TAU); g.fill();
        g.fillStyle = rgba(c); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        g.fillStyle = rgba(mixC(c, [255, 250, 220], 0.35)); g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.45, 0, TAU); g.fill();
        if (outline) { g.strokeStyle = INK_SOFT; g.lineWidth = 1.2; g.beginPath(); g.arc(x, y, r, Math.PI * 0.1, Math.PI * 1.1); g.stroke(); }
    }
    function pine(g, x, y, s, c, snow) {
        g.fillStyle = rgba(c); g.strokeStyle = INK; g.lineWidth = 1.3;
        for (let k = 0; k < 3; k++) { const yy = y - s * (0.25 + k * 0.28), ww = s * (0.42 - k * 0.1); g.beginPath(); g.moveTo(x, yy - s * 0.38); g.lineTo(x + ww, yy); g.lineTo(x - ww, yy); g.closePath(); g.fill(); g.stroke(); if (snow) { g.fillStyle = "#fff"; g.beginPath(); g.moveTo(x, yy - s * 0.38); g.lineTo(x + ww * 0.35, yy - s * 0.24); g.lineTo(x - ww * 0.35, yy - s * 0.24); g.closePath(); g.fill(); g.fillStyle = rgba(c); } }
        g.fillStyle = "#5a3a20"; g.fillRect(x - s * 0.05, y - s * 0.25, s * 0.1, s * 0.25);
    }
    function house(g, x, y, s, wall, roof, R) {
        const h = s * (0.55 + R() * 0.4);
        g.fillStyle = wall; g.strokeStyle = INK; g.lineWidth = 1.3; g.fillRect(x - s / 2, y - h, s, h); g.strokeRect(x - s / 2, y - h, s, h);
        g.fillStyle = roof; g.beginPath(); g.moveTo(x - s * 0.6, y - h); g.lineTo(x, y - h - s * 0.5); g.lineTo(x + s * 0.6, y - h); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = "#ffe9a3"; for (let k = 0; k < 2; k++) g.fillRect(x - s * 0.3 + k * s * 0.38, y - h * 0.7, s * 0.18, s * 0.18);
    }
    function textOnArc(g, text, cx, cy, r, mid, size, color, spacing = 1.15) {
        g.save(); g.font = `italic 700 ${size}px Georgia, "Times New Roman", serif`; g.fillStyle = color; g.textAlign = "center"; g.textBaseline = "middle";
        const widths = [...text].map(ch => g.measureText(ch).width * spacing), total = widths.reduce((a, b) => a + b, 0);
        let a = mid - total / r / 2;
        for (let i = 0; i < text.length; i++) { const w = widths[i]; a += w / 2 / r; g.save(); g.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.rotate(a + Math.PI / 2); g.fillText(text[i], 0, 0); g.restore(); a += w / 2 / r; }
        g.restore();
    }
    function textAlong(g, text, pts, size, color, at = 0.5) {               // a name written along a line (a river)
        g.save(); g.font = `italic 600 ${size}px Georgia, serif`; g.fillStyle = color; g.textAlign = "center"; g.textBaseline = "bottom";
        const lens = [0]; for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
        const L = lens[lens.length - 1], total = g.measureText(text).width * 1.1;
        let d = L * at - total / 2;
        const pointAt = dd => { let i = 1; while (i < lens.length - 1 && lens[i] < dd) i++; const k = (dd - lens[i - 1]) / (lens[i] - lens[i - 1] || 1), a = pts[i - 1], b = pts[i]; return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, Math.atan2(b[1] - a[1], b[0] - a[0])]; };
        for (const ch of text) { const w = g.measureText(ch).width * 1.1, [x, y, ang] = pointAt(d + w / 2); g.save(); g.translate(x, y); g.rotate(ang > Math.PI / 2 || ang < -Math.PI / 2 ? ang + Math.PI : ang); g.fillText(ch, 0, -6); g.restore(); d += w; }
        g.restore();
    }
    const label = (g, text, x, y, size, color = "rgba(50,36,22,.75)", rot = 0, weight = 700) => { g.save(); g.translate(x, y); g.rotate(rot); g.font = `italic ${weight} ${size}px Georgia, serif`; g.textAlign = "center"; g.fillStyle = color; g.fillText(text, 0, 0); g.restore(); };

    // ---------------------------------------------------------------------------------------------------------
    // the map
    // ---------------------------------------------------------------------------------------------------------
    function paint({ W, H, SPOT, regions, scale = 1 }) {
        const c = canvas(Math.round(W * scale), Math.round(H * scale)), g = c.getContext("2d");
        const probe = canvas(4, 4).getContext("2d");
        g.scale(scale, scale);
        const R = rng(4242), noise = noiseMaker(77), noise2 = noiseMaker(91);
        const coastPts = rough(COAST, R, 0.2), islePts = rough(ISLE, R, 0.24);
        const land = pathOf(coastPts), isle = pathOf(islePts);
        const islets = ISLETS.map(([[x, y], r]) => { const pts = rough(Array.from({ length: 9 }, (_, i) => [x + Math.cos(i / 9 * TAU) * r * (0.7 + R() * 0.5), y + Math.sin(i / 9 * TAU) * r * (0.6 + R() * 0.4)]), R, 0.25, 3); return { pts, path: pathOf(pts) }; });
        const allLand = [land, isle, ...islets.map(i => i.path)];
        const onLand = (x, y) => allLand.some(p => probe.isPointInPath(p, x, y));
        const onMain = (x, y) => probe.isPointInPath(land, x, y) || probe.isPointInPath(isle, x, y);
        const col = new Map(regions.map(r => [r.world, r]));
        // each country's colour on the map: a cartographer's palette, not the worlds' own darker colours
        const MAPC = { paper: "#f6f1e2", garden: "#b9d98c", squirrel: "#e2b06a", hollow: "#c98f4e", candy: "#f6c6dc", ocean: "#ecdca8", snow: "#eef3f8",
            rain: "#c4cdbc", sky: "#cfe2bc", desert: "#ecd08f", dunes: "#e2b66c", carnival: "#c6e09a", arcade: "#cdbbe6", library: "#bcb0a8", robot: "#bfc3ca",
            volcano: "#8a6a5a", cave: "#7a5a4a" };
        const ground = w => hexRgb(MAPC[w] || (col.get(w) || {}).ground || "#cfc29a");
        const SKY_EDGE = 352;

        // ---- 1. the sea: deep where it's far from land, paler in the shallows, the sky above the world's edge ----
        const small = canvas(Math.ceil(W / 16), Math.ceil(H / 16)), sg = small.getContext("2d");
        sg.scale(1 / 16, 1 / 16); sg.fillStyle = "#fff"; for (const p of allLand) sg.fill(p);
        const blur = canvas(small.width, small.height), bg = blur.getContext("2d");
        bg.filter = "blur(5px)"; bg.drawImage(small, 0, 0);
        g.fillStyle = "#2e6584"; g.fillRect(0, 0, W, H);
        g.save(); g.globalAlpha = 0.9; g.globalCompositeOperation = "source-over";
        const tint = canvas(blur.width, blur.height), tg = tint.getContext("2d");
        tg.drawImage(blur, 0, 0); tg.globalCompositeOperation = "source-in"; tg.fillStyle = "#7cc3cc"; tg.fillRect(0, 0, tint.width, tint.height);
        g.imageSmoothingEnabled = true; g.drawImage(tint, 0, 0, W, H);
        g.restore();
        // the sea's own texture: slow swirls of colour
        for (let i = 0; i < 2600; i++) { const x = R() * W, y = SKY_EDGE + R() * (H - SKY_EDGE), n = noise(x / 300, y / 300); g.fillStyle = n > 0.55 ? "rgba(255,255,255,.035)" : "rgba(10,30,50,.05)"; g.beginPath(); g.ellipse(x, y, 30 + R() * 60, 10 + R() * 20, n * 3, 0, TAU); g.fill(); }
        // compass lines across the water, from the rose in the south-east and one in the west (an old sea chart)
        for (const [cx, cy] of [[2470, 2560], [70, 2080]]) { g.strokeStyle = "rgba(255,240,210,.16)"; g.lineWidth = 1.6; for (let k = 0; k < 32; k++) { const a = k / 32 * TAU; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 3600, cy + Math.sin(a) * 3600); g.stroke(); } }
        // the coast's contour lines, rippling out from every shore
        for (const [d, a, dash] of [[22, 0.55, null], [44, 0.35, null], [72, 0.25, [10, 10]], [108, 0.16, [4, 12]]]) {
            g.strokeStyle = `rgba(235,250,250,${a})`; g.lineWidth = 2.2; g.setLineDash(dash || []);
            for (const pts of [coastPts, islePts, ...islets.map(i => i.pts)]) g.stroke(pathOf(offset(pts, d)));
        }
        g.setLineDash([]);
        // wind curls and wave marks on the open sea
        g.strokeStyle = "rgba(220,240,245,.5)"; g.lineWidth = 2.4; g.lineCap = "round";
        for (let i = 0; i < 40; i++) {
            const x = R() * W, y = SKY_EDGE + 60 + R() * (H - SKY_EDGE - 100);
            if (onLand(x, y) || onLand(x + 120, y) || onLand(x - 120, y) || onLand(x, y + 80) || onLand(x, y - 80)) continue;
            g.beginPath(); for (let k = 0; k <= 40; k++) { const t = k / 40, a = t * TAU * 1.4, r = 6 + t * 34; g.lineTo(x + Math.cos(a) * r + t * 60, y + Math.sin(a) * r * 0.6); } g.stroke();
        }
        g.strokeStyle = "rgba(15,45,65,.45)"; g.lineWidth = 2;
        for (let i = 0; i < 1100; i++) {
            const x = R() * W, y = SKY_EDGE + 40 + R() * (H - SKY_EDGE - 40);
            if (onLand(x, y) || onLand(x, y - 40) || onLand(x - 50, y) || onLand(x + 50, y) || onLand(x, y + 40)) continue;
            const s = 9 + R() * 8; g.beginPath(); g.moveTo(x - s, y); g.quadraticCurveTo(x - s / 2, y - s * 0.6, x, y); g.quadraticCurveTo(x + s / 2, y - s * 0.6, x + s, y); g.stroke();
        }
        // the sky above the world's edge: stars, a moon, nebulae, constellations, planets
        const sky = g.createLinearGradient(0, 0, 0, SKY_EDGE + 40);
        sky.addColorStop(0, "#07061a"); sky.addColorStop(0.7, "#1d1748"); sky.addColorStop(1, "#33306a");
        g.fillStyle = sky; g.fillRect(0, 0, W, SKY_EDGE + 10);
        const neb = (x, y, r, c1) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, c1); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };
        g.save(); g.beginPath(); g.rect(0, 0, W, SKY_EDGE); g.clip();
        neb(SPOT.space[0], SPOT.space[1], 460, "rgba(155,107,255,.38)"); neb(SPOT.space[0] + 330, 110, 260, "rgba(95,200,230,.25)"); neb(SPOT.rift[0], SPOT.rift[1], 280, "rgba(255,210,120,.28)"); neb(2350, 160, 300, "rgba(255,120,180,.15)");
        for (let i = 0; i < 900; i++) { const x = R() * W, y = R() * SKY_EDGE, r = R() < 0.95 ? 0.6 + R() * 1.4 : 2 + R() * 1.6; g.fillStyle = `rgba(255,248,230,${0.35 + R() * 0.65})`; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
        // constellations: a quill and an open book
        for (const shape of [[[300, 90], [360, 140], [420, 170], [470, 230], [520, 280]], [[1900, 70], [1960, 120], [2040, 110], [2100, 70], [2040, 160], [1960, 160], [1900, 70]]]) {
            g.strokeStyle = "rgba(220,230,255,.45)"; g.lineWidth = 1.5; g.beginPath(); shape.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
            for (const [x, y] of shape) { g.fillStyle = "#fffbe8"; g.beginPath(); g.arc(x, y, 3.5, 0, TAU); g.fill(); }
        }
        for (const [x, y, r, c1, ring] of [[1060, 110, 38, "#e07a5a", true], [1700, 80, 22, "#7fd4ff", false], [2520, 250, 40, "#c9a6ff", true], [180, 150, 26, "#ffd36b", false]]) {
            const pg = g.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r); pg.addColorStop(0, rgba(mixC(hexRgb(c1), [255, 255, 255], 0.4))); pg.addColorStop(1, rgba(mixC(hexRgb(c1), [20, 10, 40], 0.4)));
            g.fillStyle = pg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
            if (ring) { g.strokeStyle = "rgba(255,240,210,.75)"; g.lineWidth = 3; g.beginPath(); g.ellipse(x, y, r * 1.8, r * 0.42, -0.3, 0, TAU); g.stroke(); }
        }
        { const x = 2620, y = 90, r = 60; g.fillStyle = "#fbf6e6"; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.fillStyle = "#1d1748"; g.beginPath(); g.arc(x + 26, y - 12, r * 0.9, 0, TAU); g.fill(); }
        g.restore();
        // the world's edge: the sea pours off the rim into the stars, in falls and mist
        const rimY = x => SKY_EDGE + Math.sin(x * 0.011) * 10 + Math.sin(x * 0.004 + 1) * 14;
        g.save(); g.globalCompositeOperation = "lighter";
        for (let i = 0; i < 380; i++) { const x = R() * W, y = rimY(x), l = 30 + R() * 110; const gr = g.createLinearGradient(x, y, x, y - l); gr.addColorStop(0, "rgba(200,235,255,.35)"); gr.addColorStop(1, "rgba(200,235,255,0)"); g.strokeStyle = gr; g.lineWidth = 2 + R() * 4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 8, y - l); g.stroke(); }
        g.restore();
        g.fillStyle = "rgba(255,255,255,.85)"; g.beginPath(); g.moveTo(0, rimY(0)); for (let x = 0; x <= W; x += 12) g.lineTo(x, rimY(x) - 3 - Math.abs(Math.sin(x * 0.07)) * 5); for (let x = W; x >= 0; x -= 12) g.lineTo(x, rimY(x) + 5); g.closePath(); g.fill();
        for (let i = 0; i < 70; i++) { const x = R() * W, y = rimY(x); const gr = g.createRadialGradient(x, y, 0, x, y, 50); gr.addColorStop(0, "rgba(230,245,255,.35)"); gr.addColorStop(1, "rgba(230,245,255,0)"); g.fillStyle = gr; g.fillRect(x - 50, y - 50, 100, 100); }

        // ---- 2. the land: each world's country (borders that wander), shaded hills, painted texture ----
        // a coarse grid: each cell belongs to the nearest world (with noise, so borders meander), then the grid is
        // smoothed up to full size, which blends the countries softly into each other
        const CELL = 14, gw = Math.ceil(W / CELL), gh = Math.ceil(H / CELL);
        const grid = canvas(gw, gh), gg = grid.getContext("2d"), img = gg.createImageData(gw, gh);
        const lands = Object.entries(SPOT).filter(([w]) => !["space", "rift", "atlantis"].includes(w)).map(([w, [x, y]]) => ({ w, x, y, c: ground(w), weight: ["hollow", "dunes", "cave"].includes(w) ? 0.55 : 1 }));
        const BASE = [214, 196, 150];
        for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
            const x = (i + 0.5) * CELL, y = (j + 0.5) * CELL, nx = (noise(x / 260, y / 260) - 0.5) * 260, ny = (noise2(x / 260, y / 260) - 0.5) * 260;
            let best = null, bd = 1e9;
            for (const L of lands) { const d = Math.hypot(x + nx - L.x, y + ny - L.y) / L.weight; if (d < bd) { bd = d; best = L; } }
            const fall = Math.min(1, Math.max(0, (bd - 260) / 360));
            let cc = mixC(best.c, BASE, 0.12 + fall * 0.45);
            const shade = (noise(x / 90, y / 90, 3) - 0.5) * 22;                        // painted variation
            cc = cc.map(v => Math.max(0, Math.min(255, v + shade)));
            const k = (j * gw + i) * 4; img.data[k] = cc[0]; img.data[k + 1] = cc[1]; img.data[k + 2] = cc[2]; img.data[k + 3] = 255;
        }
        gg.putImageData(img, 0, 0);
        const soft = canvas(gw, gh), sfg = soft.getContext("2d"); sfg.filter = "blur(2.5px)"; sfg.drawImage(grid, 0, 0);
        g.save(); for (const p of allLand) { g.save(); g.clip(p); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high"; g.drawImage(soft, 0, 0, W, H); g.restore(); }
        // hill shading: light from the north-west on a noise height field
        const hs = canvas(gw, gh), hg = hs.getContext("2d"), himg = hg.createImageData(gw, gh);
        const height = (x, y) => noise(x / 420, y / 420, 5);
        for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
            const x = (i + 0.5) * CELL, y = (j + 0.5) * CELL, s = (height(x - CELL, y - CELL) - height(x + CELL, y + CELL)) * 900;
            const k = (j * gw + i) * 4, a = Math.min(90, Math.abs(s) * 2.2);
            if (s > 0) { himg.data[k] = 255; himg.data[k + 1] = 250; himg.data[k + 2] = 230; } else { himg.data[k] = 50; himg.data[k + 1] = 35; himg.data[k + 2] = 25; }
            himg.data[k + 3] = a;
        }
        hg.putImageData(himg, 0, 0);
        const hsoft = canvas(gw, gh), hsg = hsoft.getContext("2d"); hsg.filter = "blur(2px)"; hsg.drawImage(hs, 0, 0);
        for (const p of allLand) { g.save(); g.clip(p); g.globalAlpha = 0.55; g.drawImage(hsoft, 0, 0, W, H); g.restore(); }
        // paper grain over the land
        for (let i = 0; i < 7000; i++) { const x = R() * W, y = SKY_EDGE + R() * (H - SKY_EDGE); if (!onMain(x, y)) continue; g.fillStyle = R() < 0.5 ? "rgba(70,50,25,.07)" : "rgba(255,250,230,.08)"; g.fillRect(x, y, 2 + R() * 4, 1 + R() * 2); }
        g.restore();
        // beaches along the warm south and east, cliffs hatched along the cold north and west
        g.save(); g.clip(land);
        g.strokeStyle = "rgba(246,226,170,.95)"; g.lineWidth = 26; g.save(); g.beginPath(); g.rect(300, 2250, 2300, 600); g.rect(2250, 1500, 400, 900); g.clip(); g.stroke(land); g.restore();
        g.restore();
        g.strokeStyle = INK; g.lineWidth = 1.6;
        for (let i = 0; i < coastPts.length; i += 2) {
            const [x, y] = coastPts[i]; if (!(y < 1000 || x < 400)) continue;
            const [ax, ay] = coastPts[(i + 1) % coastPts.length], dx = ax - x, dy = ay - y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
            g.beginPath(); g.moveTo(x, y); g.lineTo(x - nx * 16, y - ny * 16); g.stroke();
        }

        // ---- 3. rivers (ink banks, water, a shine), with their names ----
        g.lineCap = "round"; g.lineJoin = "round";
        for (const r of RIVERS) {
            const pts = rough(r.pts.concat([r.pts[r.pts.length - 1]]), R, 0.1, 3).slice(0, -2).concat([r.pts[r.pts.length - 1]]), p = pathOf(pts, false);
            g.strokeStyle = INK; g.lineWidth = r.w + 5; g.stroke(p);
            g.strokeStyle = r.choc ? "#7a4a2a" : "#6fb4cc"; g.lineWidth = r.w; g.stroke(p);
            g.strokeStyle = r.choc ? "rgba(255,220,180,.4)" : "rgba(255,255,255,.45)"; g.lineWidth = r.w * 0.25; g.stroke(p);
            if (r.name) textAlong(g, r.name, r.pts, 26, "rgba(30,70,100,.8)", 0.45);
        }
        // the coast: a heavy ink line, a fine inner line
        g.strokeStyle = INK; g.lineWidth = 4.5; for (const p of allLand) g.stroke(p);
        g.save(); g.clip(land); g.strokeStyle = "rgba(255,250,230,.55)"; g.lineWidth = 9; g.stroke(land); g.restore();

        // ---- the open country between the worlds: rolling hills, grass, copses, hamlets ----
        {
            const spots = Object.values(SPOT), free = (x, y, d) => spots.every(([sx, sy]) => Math.hypot(x - sx, y - sy) > d);
            const items = [];
            for (let y = SKY_EDGE + 120; y < H - 60; y += 64) for (let x = 60; x < W - 60; x += 64) {
                const px = x + (R() - 0.5) * 50, py = y + (R() - 0.5) * 50;
                if (!onMain(px, py) || !free(px, py, 300)) continue;
                const n = noise(px / 220, py / 220), r = R();
                if (n > 0.62 && r < 0.55) items.push(["copse", px, py]);
                else if (n < 0.38 && r < 0.45) items.push(["hill", px, py]);
                else if (r < 0.04 && free(px, py, 420)) items.push(["hamlet", px, py]);
                else if (r < 0.6) items.push(["tuft", px, py]);
            }
            items.sort((a, b) => a[2] - b[2]).forEach(([k, x, y]) => {
                if (k === "hill") hill(g, x, y, 60 + R() * 40, [176, 168, 120]);
                else if (k === "copse") for (let q = 0; q < 4; q++) crown(g, x + (R() - 0.5) * 40, y + (R() - 0.5) * 20, 10 + R() * 6, [96, 140, 70]);
                else if (k === "tuft") { g.strokeStyle = "rgba(80,100,50,.55)"; g.lineWidth = 1.6; g.beginPath(); for (const dx of [-5, 0, 5]) { g.moveTo(x + dx, y); g.lineTo(x + dx * 1.6, y - 9); } g.stroke(); }
                else { for (let q = 0; q < 4; q++) house(g, x + q * 22 - 30, y + (q % 2) * 10, 20, "#efe6d0", ["#a8492a", "#5a6a80", "#7a4a4a"][q % 3], R);
                    if (R() < 0.5) { g.fillStyle = "#d9d0c0"; g.strokeStyle = INK; g.lineWidth = 1.5; g.fillRect(x + 60, y - 50, 16, 50); g.strokeRect(x + 60, y - 50, 16, 50); g.beginPath(); g.moveTo(x + 58, y - 50); g.lineTo(x + 68, y - 66); g.lineTo(x + 78, y - 50); g.closePath(); g.fillStyle = "#5a6a80"; g.fill(); g.stroke(); } }
            });
        }

        // ---- 4. each country's own landmarks ----
        const near = (w, rad, n, clear, fn, test = onMain) => {
            const [cx, cy] = SPOT[w], pts = [];
            for (let t = 0; pts.length < n && t < n * 25; t++) { const a = R() * TAU, d = clear + Math.sqrt(R()) * (rad - clear), x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.8; if (test(x, y)) pts.push([x, y]); }
            pts.sort((a, b) => a[1] - b[1]).forEach(([x, y]) => fn(x, y));
        };
        const CLEAR = 150;                                     // (the location itself stands in the middle)
        // the Notebook: ruled lowlands with a margin, pencil doodles, a giant pencil, a paper plane
        { const [x, y] = SPOT.paper; g.save(); g.clip(land); g.beginPath(); g.ellipse(x, y, 380, 300, 0, 0, TAU); g.clip();
            g.fillStyle = "rgba(255,253,244,.55)"; g.fillRect(x - 400, y - 320, 800, 640);
            g.strokeStyle = "rgba(90,140,210,.4)"; g.lineWidth = 2; for (let yy = y - 300; yy < y + 300; yy += 30) { g.beginPath(); g.moveTo(x - 400, yy); g.lineTo(x + 400, yy); g.stroke(); }
            g.strokeStyle = "rgba(220,80,90,.55)"; g.beginPath(); g.moveTo(x - 260, y - 320); g.lineTo(x - 260, y + 320); g.stroke(); g.restore();
            g.save(); g.translate(x + 210, y - 170); g.rotate(-0.5); g.fillStyle = "#ffcf3f"; g.strokeStyle = INK; g.lineWidth = 2; g.fillRect(-90, -11, 160, 22); g.strokeRect(-90, -11, 160, 22);
            g.fillStyle = "#ff9fb4"; g.fillRect(-112, -11, 22, 22); g.strokeRect(-112, -11, 22, 22); g.fillStyle = "#f3e6cc"; g.beginPath(); g.moveTo(70, -11); g.lineTo(100, 0); g.lineTo(70, 11); g.closePath(); g.fill(); g.stroke(); g.fillStyle = INK; g.beginPath(); g.moveTo(92, -3); g.lineTo(100, 0); g.lineTo(92, 3); g.fill(); g.restore();
            g.save(); g.translate(x - 190, y + 150); g.rotate(0.3); g.fillStyle = "#fffdf6"; g.strokeStyle = INK; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-40, 0); g.lineTo(40, -14); g.lineTo(-10, 6); g.lineTo(-20, 20); g.closePath(); g.fill(); g.stroke(); g.restore();
            g.strokeStyle = "rgba(60,60,80,.55)"; g.lineWidth = 2.5; g.beginPath(); for (let k = 0; k <= 40; k++) { const a = k / 40 * TAU * 2.5, r = 4 + k * 0.9; g.lineTo(x + 180 + Math.cos(a) * r, y + 160 + Math.sin(a) * r); } g.stroke(); }
        // the Garden: patchwork fields, hedges, a windmill, flowers
        { const [x, y] = SPOT.garden; const fields = ["#b8d98a", "#9fcc6a", "#e6d98a", "#c8e0a0", "#f0c8d8"];
            for (let k = 0; k < 26; k++) { const fx = x - 330 + R() * 660, fy = y - 250 + R() * 500; if (Math.hypot(fx - x, fy - y) < 170 || !onMain(fx, fy)) continue; g.save(); g.translate(fx, fy); g.rotate(-0.25 + R() * 0.1); g.fillStyle = fields[k % fields.length]; g.fillRect(-55, -32, 110, 64); g.strokeStyle = "rgba(60,90,40,.5)"; g.lineWidth = 1; for (let l = -24; l < 32; l += 10) { g.beginPath(); g.moveTo(-55, l); g.lineTo(55, l); g.stroke(); } g.strokeStyle = "#4a7a3a"; g.lineWidth = 4; g.strokeRect(-55, -32, 110, 64); g.restore(); }
            const mx = x + 230, my = y - 110; g.fillStyle = "#f3e6cc"; g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(mx - 18, my); g.lineTo(mx - 11, my - 60); g.lineTo(mx + 11, my - 60); g.lineTo(mx + 18, my); g.closePath(); g.fill(); g.stroke();
            g.fillStyle = "#c8521f"; g.beginPath(); g.moveTo(mx - 15, my - 60); g.lineTo(mx, my - 78); g.lineTo(mx + 15, my - 60); g.closePath(); g.fill(); g.stroke();
            g.strokeStyle = "#6a4a2a"; g.lineWidth = 4; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; g.beginPath(); g.moveTo(mx, my - 62); g.lineTo(mx + Math.cos(a) * 50, my - 62 + Math.sin(a) * 50); g.stroke(); }
            near("garden", 380, 140, 120, (fx, fy) => { g.fillStyle = ["#ff7aa8", "#ffd23f", "#ffffff", "#c38bff"][Math.floor(R() * 4)]; g.beginPath(); g.arc(fx, fy, 4, 0, TAU); g.fill(); }); }
        // Acorn Woods: a great autumn forest of canopy, and the Great Hollow's oldest oak deep in it
        { const AUT = [[217, 119, 43], [200, 82, 31], [227, 163, 90], [184, 134, 42], [170, 100, 40]];
            const trees = [];
            for (let t = 0; t < 5000 && trees.length < 620; t++) { const x = 1100 + R() * 1100, y = 2180 + R() * 560; if (!onMain(x, y)) continue; const d = Math.min(Math.hypot(x - SPOT.squirrel[0], y - SPOT.squirrel[1]), Math.hypot(x - SPOT.hollow[0], y - SPOT.hollow[1]) * 1.4); if (d < 140) continue; if (noise(x / 160, y / 160) < 0.42) continue; trees.push([x, y]); }
            trees.sort((a, b) => a[1] - b[1]).forEach(([x, y]) => crown(g, x, y, 13 + R() * 7, AUT[Math.floor(R() * AUT.length)]));
            const [ox, oy] = SPOT.hollow; g.fillStyle = "#5a3418"; g.strokeStyle = INK; g.lineWidth = 2.5; g.beginPath(); g.moveTo(ox - 60, oy + 40); g.quadraticCurveTo(ox - 36, oy - 60, ox - 26, oy - 130); g.lineTo(ox + 26, oy - 130); g.quadraticCurveTo(ox + 36, oy - 60, ox + 60, oy + 40); g.closePath(); g.fill(); g.stroke();
            for (const [cx, cy, r] of [[ox - 60, oy - 170, 70], [ox + 60, oy - 175, 75], [ox, oy - 230, 90], [ox - 20, oy - 150, 60]]) crown(g, cx, cy, r, [138, 90, 42]); }
        // Candy Hills: peppermint-striped hills, gumdrops, lollipop trees
        near("candy", 380, 14, CLEAR, (x, y) => { const w = 90 + R() * 50; g.save(); g.beginPath(); g.moveTo(x - w / 2, y); g.quadraticCurveTo(x, y - w * 0.6, x + w / 2, y); g.closePath(); g.fillStyle = "#ffd6ea"; g.fill(); g.clip(); g.strokeStyle = "#ff5f98"; g.lineWidth = 9; for (let k = -w; k < w; k += 22) { g.beginPath(); g.moveTo(x + k, y); g.lineTo(x + k + w * 0.4, y - w * 0.6); g.stroke(); } g.restore(); g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(x - w / 2, y); g.quadraticCurveTo(x, y - w * 0.6, x + w / 2, y); g.stroke(); });
        near("candy", 360, 26, CLEAR, (x, y) => { const c1 = ["#ff5fa2", "#7fd4ff", "#ffd23f", "#a6e36b"][Math.floor(R() * 4)]; g.strokeStyle = "#fff"; g.lineWidth = 5; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 40); g.stroke(); g.fillStyle = c1; g.beginPath(); g.arc(x, y - 44, 15, 0, TAU); g.fill(); g.strokeStyle = "#fff"; g.lineWidth = 3; g.beginPath(); g.arc(x, y - 44, 8, 0, 4.6); g.stroke(); g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y - 44, 15, 0, TAU); g.stroke(); });
        // Coral Reef: a reef in the shallows, palms on the beach, a lighthouse
        { const [x, y] = SPOT.ocean; for (let k = 0; k < 120; k++) { const a = -1.2 + R() * 2.4, d = 190 + R() * 70, cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d; if (onLand(cx, cy)) continue; g.fillStyle = ["#ff7a8a", "#ffa86a", "#d07ae8", "#ffe07a"][Math.floor(R() * 4)]; g.beginPath(); g.arc(cx, cy, 4 + R() * 5, 0, TAU); g.fill(); }
            near("ocean", 260, 12, 130, (px, py) => { g.strokeStyle = "#6a4a2a"; g.lineWidth = 5; g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo(px + 10, py - 34, px + 4, py - 62); g.stroke(); g.fillStyle = "#3f9a5a"; for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; g.beginPath(); g.ellipse(px + 4 + Math.cos(a) * 20, py - 64 + Math.sin(a) * 7, 22, 6, a, 0, TAU); g.fill(); } });
            const lx = x + 70, ly = y - 230; g.fillStyle = "#fffdf6"; g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(lx - 16, ly); g.lineTo(lx - 10, ly - 80); g.lineTo(lx + 10, ly - 80); g.lineTo(lx + 16, ly); g.closePath(); g.fill(); g.stroke();
            g.fillStyle = "#e2483c"; g.fillRect(lx - 13, ly - 30, 26, 14); g.fillRect(lx - 11, ly - 62, 22, 12); g.fillStyle = "#ffe08a"; g.fillRect(lx - 10, ly - 96, 20, 16); g.strokeRect(lx - 10, ly - 96, 20, 16);
            const beam = g.createRadialGradient(lx, ly - 88, 0, lx, ly - 88, 120); beam.addColorStop(0, "rgba(255,240,180,.55)"); beam.addColorStop(1, "rgba(255,240,180,0)"); g.fillStyle = beam; g.beginPath(); g.moveTo(lx, ly - 88); g.lineTo(lx + 160, ly - 150); g.lineTo(lx + 160, ly - 30); g.closePath(); g.fill(); }
        // the central mountains (under the Sky Kingdom), Snow Day's range, the grey north
        const ranges = [];
        const along = (pts, n, size, kind) => { for (let k = 0; k < n; k++) { const t = k / (n - 1), i = Math.min(pts.length - 2, Math.floor(t * (pts.length - 1))), u = t * (pts.length - 1) - i, x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u + (R() - 0.5) * 70, y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u + (R() - 0.5) * 60; if (onMain(x, y) && Math.hypot(x - SPOT.sky[0], y - SPOT.sky[1]) > 150 && Math.hypot(x - SPOT.snow[0], y - SPOT.snow[1]) > 140) ranges.push([x, y, size * (0.7 + R() * 0.6), kind]); } };
        along([[880, 1420], [1050, 1330], [1250, 1300], [1420, 1180], [1560, 1080], [1720, 1000], [1880, 1050]], 34, 120, "rock");
        along([[1900, 1180], [2050, 1240], [2200, 1180], [2330, 1300], [2300, 1450], [2150, 1520]], 26, 130, "snow");
        along([[1080, 720], [1400, 780], [1600, 880]], 14, 80, "grey");
        const foot = [];
        for (const [x, y, s, k] of ranges) for (let q = 0; q < 2; q++) { const fx = x + (R() - 0.5) * 160, fy = y + 40 + R() * 60; if (onMain(fx, fy)) foot.push([fx, fy, s * 0.6, k]); }
        foot.sort((a, b) => a[1] - b[1]).forEach(([x, y, s, k]) => hill(g, x, y, s, k === "snow" ? [210, 222, 240] : k === "grey" ? [150, 150, 160] : [176, 160, 120]));
        ranges.sort((a, b) => a[1] - b[1]).forEach(([x, y, s, k]) => peak(g, x, y, s * 1.2, s, k === "snow" ? [200, 214, 236] : k === "grey" ? [128, 126, 140] : [168, 150, 112], k !== "grey" && s > 110 || k === "snow", R));
        label(g, "The Spine of Pages", 1420, 1395, 30, "rgba(60,44,28,.8)", -0.28);
        // Snow Day: snowy pines, a frozen lake, an igloo
        near("snow", 360, 50, CLEAR, (x, y) => pine(g, x, y, 34 + R() * 12, [47, 106, 74], true));
        { const [x, y] = SPOT.snow; g.fillStyle = "#dff1ff"; g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.ellipse(x - 200, y + 170, 90, 42, 0.2, 0, TAU); g.fill(); g.stroke(); g.strokeStyle = "rgba(120,170,210,.7)"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x - 250, y + 170); g.lineTo(x - 210, y + 160); g.lineTo(x - 180, y + 185); g.moveTo(x - 210, y + 160); g.lineTo(x - 200, y + 140); g.stroke();
            g.fillStyle = "#ffffff"; g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.arc(x + 210, y + 150, 34, Math.PI, TAU); g.closePath(); g.fill(); g.stroke(); g.fillStyle = "#3a4a5a"; g.beginPath(); g.arc(x + 210, y + 150, 11, Math.PI, TAU); g.fill(); }
        // Rainy City: a walled city on the river, its bridges, a cathedral spire, rain clouds
        { const [x, y] = SPOT.rain; g.strokeStyle = INK; g.lineWidth = 6; g.setLineDash([16, 6]); g.beginPath(); g.ellipse(x, y, 250, 170, 0, 0, TAU); g.stroke(); g.setLineDash([]);
            for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, tx = x + Math.cos(a) * 250, ty = y + Math.sin(a) * 170; g.fillStyle = "#a8aab4"; g.fillRect(tx - 12, ty - 26, 24, 30); g.strokeStyle = INK; g.lineWidth = 2; g.strokeRect(tx - 12, ty - 26, 24, 30); g.fillStyle = "#5a6a80"; g.beginPath(); g.moveTo(tx - 15, ty - 26); g.lineTo(tx, ty - 44); g.lineTo(tx + 15, ty - 26); g.closePath(); g.fill(); g.stroke(); }
            near("rain", 235, 46, 120, (hx, hy) => house(g, hx, hy, 26, "#d4d6dc", ["#5a6a80", "#7a4a4a", "#4a5a6a"][Math.floor(R() * 3)], R), (hx, hy) => onMain(hx, hy) && ((hx - x) / 240) ** 2 + ((hy - y) / 160) ** 2 < 1);
            const cx = x + 120, cy = y - 60; g.fillStyle = "#c8c4cc"; g.strokeStyle = INK; g.lineWidth = 2; g.fillRect(cx - 26, cy - 60, 52, 60); g.strokeRect(cx - 26, cy - 60, 52, 60); g.beginPath(); g.moveTo(cx - 14, cy - 60); g.lineTo(cx, cy - 140); g.lineTo(cx + 14, cy - 60); g.closePath(); g.fillStyle = "#5a6a80"; g.fill(); g.stroke();
            for (const bx of [-40, 60]) { g.fillStyle = "#b8a888"; g.fillRect(x + bx * 2.4 - 30, y + bx * 1.6 + 20, 60, 12); }
            for (let k = 0; k < 3; k++) { const rx = x - 120 + k * 120, ry = y - 230; g.fillStyle = "rgba(110,120,140,.75)"; for (let q = 0; q < 4; q++) { g.beginPath(); g.arc(rx + q * 22 - 33, ry - (q % 2) * 10, 24, 0, TAU); g.fill(); } g.strokeStyle = "rgba(90,130,190,.7)"; g.lineWidth = 2; for (let q = 0; q < 6; q++) { g.beginPath(); g.moveTo(rx - 40 + q * 15, ry + 20); g.lineTo(rx - 48 + q * 15, ry + 46); g.stroke(); } } }
        // the Sky Kingdom: a bank of cloud with floating islands over the mountains
        { const [x, y] = SPOT.sky; for (let k = 0; k < 14; k++) { const cx = x - 260 + k * 40, cy = y + 60 + Math.sin(k * 1.3) * 18; g.fillStyle = "rgba(255,255,255,.92)"; g.beginPath(); g.arc(cx, cy, 42 + (k % 3) * 10, 0, TAU); g.fill(); }
            for (const [fx, fy, s] of [[x - 230, y - 120, 50], [x + 240, y - 90, 40], [x + 140, y - 200, 30]]) { g.fillStyle = "#7bbf5a"; g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.ellipse(fx, fy, s, s * 0.3, 0, Math.PI, TAU); g.fill(); g.stroke(); g.fillStyle = "#8a6a4a"; g.beginPath(); g.moveTo(fx - s, fy); g.lineTo(fx, fy + s * 1.1); g.lineTo(fx + s, fy); g.closePath(); g.fill(); g.stroke(); g.fillStyle = "rgba(255,255,255,.9)"; g.beginPath(); g.arc(fx - s * 0.6, fy + s * 0.5, s * 0.4, 0, TAU); g.arc(fx + s * 0.5, fy + s * 0.6, s * 0.35, 0, TAU); g.fill(); } }
        // the Desert: crescent dunes, an oasis, pyramids; the Sunken Dunes deeper in, a giant's ribs and a worm's trail
        const dune = (x, y, w) => { g.fillStyle = "rgba(255,226,160,.9)"; g.beginPath(); g.moveTo(x - w / 2, y); g.quadraticCurveTo(x, y - w * 0.45, x + w / 2, y); g.quadraticCurveTo(x, y - w * 0.18, x - w / 2, y); g.fill(); g.fillStyle = "rgba(170,110,50,.5)"; g.beginPath(); g.moveTo(x, y - w * 0.22); g.quadraticCurveTo(x + w * 0.3, y - w * 0.2, x + w / 2, y); g.quadraticCurveTo(x + w * 0.15, y - w * 0.08, x, y - w * 0.22); g.fill(); g.strokeStyle = "rgba(110,70,30,.6)"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x - w / 2, y); g.quadraticCurveTo(x, y - w * 0.45, x + w / 2, y); g.stroke(); };
        near("desert", 420, 46, CLEAR, (x, y) => dune(x, y, 60 + R() * 50));
        near("dunes", 260, 26, 110, (x, y) => dune(x, y, 70 + R() * 60));
        { const [x, y] = SPOT.desert; const ox = x + 230, oy = y + 120; g.fillStyle = "#6fb4cc"; g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.ellipse(ox, oy, 50, 24, 0, 0, TAU); g.fill(); g.stroke();
            for (const dx of [-50, 40, 0]) { g.strokeStyle = "#6a4a2a"; g.lineWidth = 4; g.beginPath(); g.moveTo(ox + dx, oy - 10); g.quadraticCurveTo(ox + dx + 8, oy - 40, ox + dx, oy - 64); g.stroke(); g.fillStyle = "#3f9a5a"; for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; g.beginPath(); g.ellipse(ox + dx + Math.cos(a) * 16, oy - 66 + Math.sin(a) * 5, 17, 5, a, 0, TAU); g.fill(); } }
            for (const [px, py, s] of [[x - 220, y + 170, 80], [x - 110, y + 210, 56], [x - 310, y + 210, 44]]) { g.fillStyle = "#e8b868"; g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(px - s, py); g.lineTo(px, py - s * 0.95); g.lineTo(px + s, py); g.closePath(); g.fill(); g.stroke(); g.fillStyle = "#b8803a"; g.beginPath(); g.moveTo(px, py - s * 0.95); g.lineTo(px + s, py); g.lineTo(px + s * 0.18, py); g.closePath(); g.fill(); g.strokeStyle = "rgba(90,60,20,.35)"; g.lineWidth = 1; for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(px - s * k / 5, py - s * 0.95 * (1 - k / 5)); g.lineTo(px + s * k / 5, py - s * 0.95 * (1 - k / 5)); g.stroke(); } } }
        { const [x, y] = SPOT.dunes; g.strokeStyle = "#f6ecd8"; g.lineCap = "round"; g.lineWidth = 8; g.beginPath(); g.moveTo(x - 120, y + 80); g.quadraticCurveTo(x, y + 60, x + 120, y + 90); g.stroke(); g.lineWidth = 6; for (let k = 0; k < 6; k++) { const rx = x - 100 + k * 40; g.beginPath(); g.moveTo(rx, y + 74); g.quadraticCurveTo(rx - 24, y + 10, rx + 6, y - 30); g.stroke(); }
            g.strokeStyle = "rgba(110,70,30,.55)"; g.lineWidth = 10; g.beginPath(); for (let k = 0; k <= 60; k++) { const t = k / 60; g.lineTo(x + 60 + t * 260, y - 140 + Math.sin(t * 9) * 26 - t * 80); } g.stroke(); }
        label(g, "The Sunken Sands", SPOT.dunes[0] + 20, SPOT.dunes[1] - 170, 28, "rgba(110,60,20,.75)", -0.1);
        // the Carnival: a big top, a ferris wheel, tents, bunting
        { const [x, y] = SPOT.carnival; const bx = x + 220, by = y + 40; g.fillStyle = "#fff"; g.strokeStyle = INK; g.lineWidth = 2.2; g.beginPath(); g.moveTo(bx - 70, by); g.quadraticCurveTo(bx - 60, by - 70, bx, by - 100); g.quadraticCurveTo(bx + 60, by - 70, bx + 70, by); g.closePath(); g.fill(); g.save(); g.clip(); g.fillStyle = "#e2483c"; for (let k = -70; k < 70; k += 28) g.fillRect(bx + k, by - 110, 14, 120); g.restore(); g.stroke();
            g.fillStyle = "#ffd23f"; g.beginPath(); g.moveTo(bx, by - 100); g.lineTo(bx, by - 128); g.lineTo(bx + 22, by - 120); g.lineTo(bx, by - 112); g.fill(); g.stroke();
            const wx = x - 220, wy = y - 60; g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.arc(wx, wy, 60, 0, TAU); g.stroke(); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; g.beginPath(); g.moveTo(wx, wy); g.lineTo(wx + Math.cos(a) * 60, wy + Math.sin(a) * 60); g.stroke(); g.fillStyle = ["#e2483c", "#3f7fd8", "#ffd23f"][k % 3]; g.beginPath(); g.arc(wx + Math.cos(a) * 60, wy + Math.sin(a) * 60, 9, 0, TAU); g.fill(); }
            g.beginPath(); g.moveTo(wx - 40, wy + 90); g.lineTo(wx, wy); g.lineTo(wx + 40, wy + 90); g.stroke();
            near("carnival", 320, 8, 170, (tx, ty) => { g.fillStyle = "#fff"; g.strokeStyle = INK; g.lineWidth = 1.6; g.beginPath(); g.moveTo(tx - 24, ty); g.lineTo(tx, ty - 38); g.lineTo(tx + 24, ty); g.closePath(); g.fill(); g.stroke(); g.fillStyle = ["#3f7fd8", "#e2483c", "#a35fd6"][Math.floor(R() * 3)]; g.beginPath(); g.moveTo(tx, ty - 38); g.lineTo(tx - 8, ty); g.lineTo(tx + 6, ty); g.closePath(); g.fill(); }); }
        // the Arcade: a neon city of glowing towers on a grid
        { const [x, y] = SPOT.arcade; g.save(); g.clip(land); g.beginPath(); g.ellipse(x, y, 300, 220, 0, 0, TAU); g.clip(); g.fillStyle = "rgba(34,10,72,.42)"; g.fillRect(x - 320, y - 240, 640, 480); g.strokeStyle = "rgba(255,43,214,.45)"; g.lineWidth = 2; for (let k = -320; k <= 320; k += 36) { g.beginPath(); g.moveTo(x + k, y - 240); g.lineTo(x + k, y + 240); g.moveTo(x - 320, y + k); g.lineTo(x + 320, y + k); g.stroke(); } g.restore();
            near("arcade", 280, 22, 140, (tx, ty) => { const h = 40 + R() * 70, w = 22 + R() * 14, c1 = ["#ff2bd6", "#2bf0ff", "#7bff5c"][Math.floor(R() * 3)]; g.fillStyle = "#1a0838"; g.strokeStyle = c1; g.lineWidth = 2; g.fillRect(tx - w / 2, ty - h, w, h); g.strokeRect(tx - w / 2, ty - h, w, h); g.fillStyle = c1; for (let yy = ty - h + 6; yy < ty - 6; yy += 10) for (let xx = tx - w / 2 + 4; xx < tx + w / 2 - 4; xx += 8) if (R() < 0.6) g.fillRect(xx, yy, 4, 5); }); }
        // the Haunted Library: gothic towers in a misty dead wood, graves
        { const [x, y] = SPOT.library;
            near("library", 300, 22, 150, (tx, ty) => { g.strokeStyle = "#3a2a3a"; g.lineCap = "round"; const br = (x0, y0, a, l, d) => { if (d > 3) return; const x1 = x0 + Math.cos(a) * l, y1 = y0 + Math.sin(a) * l; g.lineWidth = Math.max(1, 5 - d * 1.2); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); br(x1, y1, a - 0.5, l * 0.65, d + 1); br(x1, y1, a + 0.45, l * 0.6, d + 1); }; br(tx, ty, -Math.PI / 2, 30, 0); });
            for (const [tx, ty, h] of [[x + 200, y - 30, 150], [x + 250, y - 10, 110]]) { g.fillStyle = "#4a3a5a"; g.strokeStyle = INK; g.lineWidth = 2; g.fillRect(tx - 18, ty - h, 36, h); g.strokeRect(tx - 18, ty - h, 36, h); g.beginPath(); g.moveTo(tx - 22, ty - h); g.lineTo(tx, ty - h - 60); g.lineTo(tx + 22, ty - h); g.closePath(); g.fill(); g.stroke(); g.fillStyle = "#7fe0c4"; for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(tx, ty - h + 26 + k * 34, 5, 9, 0, 0, TAU); g.fill(); } }
            for (let k = 0; k < 7; k++) { const gx = x - 230 + k * 22, gy = y + 150 + (k % 2) * 14; g.fillStyle = "#8a8a96"; g.strokeStyle = INK; g.lineWidth = 1.4; g.beginPath(); g.moveTo(gx - 7, gy); g.lineTo(gx - 7, gy - 14); g.arc(gx, gy - 14, 7, Math.PI, TAU); g.lineTo(gx + 7, gy); g.closePath(); g.fill(); g.stroke(); }
            const mist = g.createRadialGradient(x, y, 50, x, y, 320); mist.addColorStop(0, "rgba(220,220,240,0)"); mist.addColorStop(0.6, "rgba(220,220,240,.18)"); mist.addColorStop(1, "rgba(220,220,240,0)"); g.fillStyle = mist; g.fillRect(x - 320, y - 320, 640, 640); }
        // the Robot Factory: works and chimneys and smoke, gears, rails
        { const [x, y] = SPOT.robot; g.strokeStyle = INK; g.lineWidth = 3; for (const off of [0, 14]) { g.beginPath(); g.moveTo(x - 300, y + 170 + off); g.lineTo(x + 260, y + 120 + off); g.stroke(); } g.lineWidth = 2; for (let k = 0; k < 28; k++) { const t = k / 27, rx = x - 300 + t * 560, ry = y + 170 - t * 50; g.beginPath(); g.moveTo(rx, ry - 3); g.lineTo(rx, ry + 17); g.stroke(); }
            near("robot", 300, 9, 160, (fx, fy) => { const s = 54 + R() * 20; g.fillStyle = "#7a8594"; g.strokeStyle = INK; g.lineWidth = 1.6; g.beginPath(); g.moveTo(fx - s / 2, fy); g.lineTo(fx - s / 2, fy - s * 0.4); for (let k = 0; k < 3; k++) { g.lineTo(fx - s / 2 + (k + 0.5) * s / 3, fy - s * 0.65); g.lineTo(fx - s / 2 + (k + 1) * s / 3, fy - s * 0.4); } g.lineTo(fx + s / 2, fy); g.closePath(); g.fill(); g.stroke(); g.fillStyle = "#4a5260"; g.fillRect(fx + s * 0.22, fy - s * 1.1, s * 0.15, s * 0.7); g.strokeRect(fx + s * 0.22, fy - s * 1.1, s * 0.15, s * 0.7); g.fillStyle = "rgba(150,150,160,.5)"; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(fx + s * (0.32 + k * 0.14), fy - s * (1.25 + k * 0.2), s * (0.12 + k * 0.05), 0, TAU); g.fill(); } }); }
        // Volcano Island: the volcano, its lava, its plume of ash; the Lava Cave's glowing mouth
        { g.save(); g.clip(isle); g.fillStyle = "rgba(60,30,24,.65)"; g.fillRect(1900, 200, 800, 600); g.restore();
            const [x, y] = SPOT.volcano; g.fillStyle = "#4a3028"; g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 230, y + 130); g.lineTo(x - 55, y - 120); g.lineTo(x + 55, y - 120); g.lineTo(x + 230, y + 130); g.closePath(); g.fill(); g.stroke();
            g.fillStyle = "#3a2420"; g.beginPath(); g.moveTo(x + 10, y - 120); g.lineTo(x + 55, y - 120); g.lineTo(x + 230, y + 130); g.lineTo(x + 70, y + 130); g.closePath(); g.fill();
            g.fillStyle = "#ff6a1f"; g.beginPath(); g.ellipse(x, y - 120, 55, 15, 0, 0, TAU); g.fill(); g.strokeStyle = "#ff8a2a"; g.lineWidth = 9; for (const k of [-1, 0.5, 1.2]) { g.beginPath(); g.moveTo(x + k * 18, y - 112); g.quadraticCurveTo(x + k * 60, y, x + k * 100, y + 125); g.stroke(); }
            for (let k = 0; k < 9; k++) { g.fillStyle = `rgba(90,80,80,${0.55 - k * 0.05})`; g.beginPath(); g.arc(x - 20 - k * 30, y - 170 - k * 26, 34 + k * 8, 0, TAU); g.fill(); }
            const [cx, cy] = SPOT.cave; const gl = g.createRadialGradient(cx, cy + 30, 0, cx, cy + 30, 90); gl.addColorStop(0, "rgba(255,140,40,.7)"); gl.addColorStop(1, "rgba(255,140,40,0)"); g.fillStyle = gl; g.fillRect(cx - 90, cy - 60, 180, 180); g.fillStyle = "#1a0804"; g.beginPath(); g.ellipse(cx, cy + 40, 50, 38, 0, Math.PI, TAU); g.fill(); }
        // Atlantis under the water off the reef: columns and domes shimmering up through the sea
        { const [x, y] = SPOT.atlantis; g.save(); g.globalAlpha = 0.45; g.fillStyle = "#d9f0f6"; for (const [dx, h] of [[-90, 70], [-60, 92], [-30, 60], [30, 104], [64, 82], [96, 60]]) g.fillRect(x + dx, y - h, 15, h);
            g.beginPath(); g.ellipse(x - 14, y - 96, 56, 34, 0, Math.PI, TAU); g.fill(); g.fillRect(x - 100, y, 210, 10); g.restore();
            g.strokeStyle = "rgba(255,255,255,.45)"; g.lineWidth = 2; for (let k = 1; k < 4; k++) { g.beginPath(); g.ellipse(x, y - 30, 74 * k, 28 * k, 0, 0, TAU); g.stroke(); } }

        // ---- 5. the sea's names, its creatures and ships, the compass, the title, the scale ----
        label(g, "The Painted Sea", 330, 560, 40, "rgba(225,240,245,.8)", -0.12);
        label(g, "The Sea of Lost Words", 2610, 1560, 40, "rgba(225,240,245,.8)", Math.PI / 2);
        textOnArc(g, "The Northern Deep", 1520, 920, 530, -Math.PI / 2, 34, "rgba(225,240,245,.75)");
        label(g, "The Edge of the World", 360, 320, 30, "rgba(255,240,210,.85)");
        label(g, "The Western Shallows", 52, 1600, 32, "rgba(225,240,245,.75)", -Math.PI / 2);
        label(g, "Inkwell Bay", 2420, 2140, 24, "rgba(225,240,245,.85)", -0.4);
        // a sea serpent off the west coast
        { const x = 2390, y = 1150; g.fillStyle = "#3f8a6a"; g.strokeStyle = INK; g.lineWidth = 2.5; for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(x + 40 + k * 60, y, 24, 34, 0, Math.PI, TAU); g.fill(); g.stroke(); g.fillStyle = "#6fbf9a"; for (let q = 0; q < 3; q++) { g.beginPath(); g.moveTo(x + 30 + k * 60 + q * 8, y - 26); g.lineTo(x + 34 + k * 60 + q * 8, y - 40); g.lineTo(x + 38 + k * 60 + q * 8, y - 26); g.fill(); } g.fillStyle = "#3f8a6a"; }
            g.beginPath(); g.moveTo(x + 210, y); g.quadraticCurveTo(x + 225, y - 70, x + 260, y - 64); g.quadraticCurveTo(x + 280, y - 56, x + 270, y - 40); g.quadraticCurveTo(x + 240, y - 44, x + 236, y); g.closePath(); g.fill(); g.stroke(); g.fillStyle = "#fff"; g.beginPath(); g.arc(x + 258, y - 56, 4, 0, TAU); g.fill(); }
        // the Kraken's tentacles off Coral Reef, a whale spouting in the south, ships with wakes
        { const x = 2590, y = 1760; g.strokeStyle = "#8a4fd1"; g.lineCap = "round"; for (const [dx, dir] of [[-40, 1], [10, -1], [60, 1]]) { g.lineWidth = 12; g.beginPath(); g.moveTo(x + dx, y + 30); g.quadraticCurveTo(x + dx + dir * 30, y - 30, x + dx - dir * 10, y - 60); g.stroke(); g.lineWidth = 4; g.strokeStyle = "#c9a6ff"; g.stroke(); g.strokeStyle = "#8a4fd1"; } }
        { const x = 2620, y = 1380; if (!onLand(x - 70, y) && !onLand(x + 70, y)) { g.fillStyle = "#4a6a8a"; g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y, 70, 24, 0, Math.PI, TAU); g.fill(); g.stroke(); g.strokeStyle = "rgba(255,255,255,.8)"; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 20, y - 24); g.quadraticCurveTo(x - 30, y - 60, x - 50, y - 64); g.moveTo(x - 20, y - 24); g.quadraticCurveTo(x - 10, y - 60, x + 10, y - 64); g.stroke(); } }
        const ship = (x, y, s, flip) => { g.save(); g.translate(x, y); g.scale(flip ? -s : s, s);
            g.strokeStyle = "rgba(255,255,255,.6)"; g.lineWidth = 2; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(-50 - k * 30, 14 + k * 6); g.lineTo(-40 - k * 20, 10); g.moveTo(-50 - k * 30, 6 - k * 4); g.lineTo(-40 - k * 20, 10); g.stroke(); }
            g.fillStyle = "#8a5a2a"; g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(-50, -6); g.lineTo(54, -6); g.lineTo(38, 14); g.lineTo(-38, 14); g.closePath(); g.fill(); g.stroke();
            g.fillStyle = "#fffaf0"; for (const [mx, h] of [[-14, 80], [18, 96]]) { g.beginPath(); g.moveTo(mx, -6); g.lineTo(mx, -h); g.stroke(); g.beginPath(); g.moveTo(mx - 26, -h + 14); g.quadraticCurveTo(mx, -h + 30, mx + 26, -h + 14); g.lineTo(mx + 24, -16); g.quadraticCurveTo(mx, -6, mx - 24, -16); g.closePath(); g.fill(); g.stroke(); }
            g.fillStyle = "#e2483c"; g.beginPath(); g.moveTo(18, -96); g.lineTo(40, -90); g.lineTo(18, -84); g.fill(); g.restore(); };
        ship(2590, 1960, 0.8, true); ship(230, 640, 0.8, false); ship(1960, 490, 0.75, true);
        // the compass rose
        { const x = 2470, y = 2560, r = 130; g.save(); g.translate(x, y);
            const disc = g.createRadialGradient(0, 0, 0, 0, 0, r); disc.addColorStop(0, "rgba(246,236,210,.95)"); disc.addColorStop(1, "rgba(230,214,176,.95)");
            g.fillStyle = disc; g.beginPath(); g.arc(0, 0, r * 0.78, 0, TAU); g.fill();
            g.strokeStyle = INK; g.lineWidth = 2.4; g.beginPath(); g.arc(0, 0, r * 0.78, 0, TAU); g.stroke(); g.lineWidth = 1.2; g.beginPath(); g.arc(0, 0, r * 0.7, 0, TAU); g.stroke();
            for (let k = 0; k < 32; k++) { const a = k / 32 * TAU; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7); g.lineTo(Math.cos(a) * r * (k % 4 ? 0.74 : 0.78), Math.sin(a) * r * (k % 4 ? 0.74 : 0.78)); g.stroke(); }
            for (let k = 0; k < 16; k++) { const a = k / 16 * TAU - Math.PI / 2, len = k % 4 === 0 ? 1.02 : k % 2 === 0 ? 0.62 : 0.42, w = k % 4 === 0 ? 0.14 : 0.09;
                for (const side of [-1, 1]) { g.fillStyle = side < 0 ? (k % 4 === 0 ? "#3e2e1e" : "#8a6a3a") : (k % 4 === 0 ? "#c8321f" : "#e8d6a8"); g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * r * len, Math.sin(a) * r * len); g.lineTo(Math.cos(a + side * Math.PI / 2) * r * w, Math.sin(a + side * Math.PI / 2) * r * w); g.closePath(); g.fill(); g.strokeStyle = INK; g.lineWidth = 1; g.stroke(); } }
            g.fillStyle = "#c9a64a"; g.beginPath(); g.arc(0, 0, r * 0.08, 0, TAU); g.fill(); g.stroke();
            g.font = `700 ${r * 0.24}px Georgia, serif`; g.fillStyle = INK; g.textAlign = "center"; g.textBaseline = "middle";
            g.fillText("N", 0, -r * 1.18); g.fillText("S", 0, r * 1.14); g.fillText("E", r * 1.12, 0); g.fillText("W", -r * 1.14, 0); g.restore(); }
        // the title on a ribbon, in the south sea
        { const x = 2130, y = 230, w = 640; g.save(); g.translate(x, y);
            g.fillStyle = "#c9a66b"; g.strokeStyle = INK; g.lineWidth = 2.5;
            for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * w / 2, -18); g.lineTo(s * (w / 2 + 70), -18); g.lineTo(s * (w / 2 + 44), 6); g.lineTo(s * (w / 2 + 70), 30); g.lineTo(s * w / 2, 30); g.closePath(); g.fill(); g.stroke(); }
            g.fillStyle = "#f3e2b8"; g.beginPath(); g.moveTo(-w / 2, -34); g.quadraticCurveTo(0, -52, w / 2, -34); g.lineTo(w / 2, 22); g.quadraticCurveTo(0, 4, -w / 2, 22); g.closePath(); g.fill(); g.stroke();
            g.font = `italic 700 44px Georgia, "Times New Roman", serif`; g.fillStyle = "#3e2e1e"; g.textAlign = "center"; g.textBaseline = "middle"; if (g.letterSpacing !== undefined) g.letterSpacing = "4px"; g.fillText("The Lands of the Everbook", 0, -12); g.restore(); }
        // a scale of leagues
        { const x = 250, y = 262; g.strokeStyle = "#f3e2b8"; g.lineWidth = 2; g.fillStyle = "#f3e2b8"; for (let k = 0; k < 5; k++) { if (k % 2 === 0) g.fillRect(x + k * 50, y, 50, 10); g.strokeRect(x + k * 50, y, 50, 10); } g.font = "italic 600 20px Georgia, serif"; g.textAlign = "left"; g.fillText("Leagues of Story", x, y - 10); }

        // ---- 6. the sheet: aged edges, a patterned border, corners ----
        const vig = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.38, W / 2, H / 2, Math.max(W, H) * 0.76);
        vig.addColorStop(0, "rgba(60,40,20,0)"); vig.addColorStop(1, "rgba(60,40,20,.45)"); g.fillStyle = vig; g.fillRect(0, 0, W, H);
        g.fillStyle = "#e9dcb6"; g.fillRect(0, 0, W, 26); g.fillRect(0, H - 26, W, 26); g.fillRect(0, 0, 26, H); g.fillRect(W - 26, 0, 26, H);
        g.strokeStyle = "#3a2a18"; g.lineWidth = 4; g.strokeRect(26, 26, W - 52, H - 52); g.lineWidth = 2; g.strokeRect(8, 8, W - 16, H - 16);
        g.fillStyle = "#3a2a18"; for (let x = 26; x < W - 26; x += 60) { g.fillRect(x, 10, 30, 14); g.fillRect(x + 30, H - 24, 30, 14); } for (let y = 26; y < H - 26; y += 60) { g.fillRect(10, y, 14, 30); g.fillRect(W - 24, y + 30, 14, 30); }
        for (const [x, y] of [[26, 26], [W - 26, 26], [26, H - 26], [W - 26, H - 26]]) { g.fillStyle = "#c9a66b"; g.strokeStyle = "#3a2a18"; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 30, 0, TAU); g.fill(); g.stroke(); g.fillStyle = "#3a2a18"; g.beginPath(); for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, rr = k % 2 ? 9 : 22; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); }
        return c;
    }

    if (typeof window === "undefined") {
        self.onmessage = e => { try { const c = paint(e.data); const bmp = c.transferToImageBitmap(); self.postMessage(bmp, [bmp]); } catch (err) { self.postMessage({ error: String(err && err.stack || err) }); } };
    } else {
        window.AtlasPaint = { paint };
    }
})();
