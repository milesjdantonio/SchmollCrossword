// The Atlas's map: the lands of the Everbook drawn as one illustrated map, painted once into a picture the Atlas
// (atlas.js) lays under its locations. Every world has its own place on it, set by hand where it belongs: the
// Notebook's ruled lowlands in the south-west, the Garden's meadows, Acorn Woods' forest (the Great Hollow deep in
// it), Candy Hills on the east coast, Coral Reef on the shore (Atlantis under the water off it), Snow Day's peaks in
// the north-east, Rainy City on the river, the Sky Kingdom over the central mountains, the Desert in the west (the
// Sunken Dunes deeper in), the Carnival, the Arcade, the Library and the Factory along the north, Volcano Island in
// the northern sea (the Lava Cave in it), and at the very top the edge of the world, where the sea meets the stars
// and Deep Space (and the Celestial Rift) hang.
//   AtlasMap.W, AtlasMap.H      the map's size in units (the Atlas's plane)
//   AtlasMap.SPOT[world]        where a world is, [x, y]
//   AtlasMap.texture(regions)   the painted map (cached), regions: [{ world, ground, hill }]
const AtlasMap = (() => {
    const W = 2700, H = 2800, TAU = Math.PI * 2;
    const SPOT = {
        paper: [430, 2470], garden: [990, 2520], squirrel: [1560, 2420], candy: [2150, 2290], ocean: [2370, 1880],
        snow: [2140, 1330], rain: [1640, 1620], sky: [1160, 1190], desert: [580, 1740], carnival: [430, 1170],
        arcade: [770, 770], library: [1260, 580], robot: [1790, 780], volcano: [2270, 520], space: [1460, 190],
        hollow: [1900, 2610], atlantis: [2610, 2180], dunes: [250, 2060], cave: [2460, 400], rift: [800, 200]
    };
    // the continent's coast, clockwise from the south-west, and Volcano Island's
    const COAST = [[250, 2630], [520, 2720], [800, 2690], [1180, 2740], [1500, 2700], [1700, 2760], [2050, 2710], [2330, 2560], [2440, 2390], [2360, 2160],
        [2470, 2020], [2490, 1820], [2430, 1640], [2480, 1470], [2400, 1260], [2310, 1070], [2140, 950], [1990, 880], [1960, 760], [1760, 640], [1540, 540],
        [1300, 450], [1050, 470], [860, 560], [640, 600], [450, 700], [270, 880], [170, 1110], [140, 1360], [105, 1620], [140, 1880], [100, 2150], [150, 2420]];
    const ISLE = [[2060, 520], [2120, 400], [2260, 330], [2420, 300], [2580, 360], [2600, 500], [2520, 640], [2340, 700], [2160, 660]];
    const RIVERS = [
        [[1380, 1110], [1460, 1300], [1560, 1440], [1640, 1600], [1790, 1760], [1960, 1900], [2150, 2010], [2380, 2080]],
        [[2160, 1220], [2100, 1110], [2040, 990], [2010, 890]],
        [[1060, 1260], [900, 1300], [720, 1260], [560, 1330], [380, 1360], [140, 1380]]
    ];

    let cached = null;
    function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
    // a natural coast: each edge split and pushed in and out a little, three times over
    function rough(points, R, amount) {
        let pts = points.map(p => p.slice());
        for (let lvl = 0; lvl < 4; lvl++) {
            const out = [];
            for (let i = 0; i < pts.length; i++) {
                const a = pts[i], b = pts[(i + 1) % pts.length], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
                const off = (R() - 0.5) * len * amount;
                out.push(a, [(a[0] + b[0]) / 2 - dy / len * off, (a[1] + b[1]) / 2 + dx / len * off]);
            }
            pts = out; amount *= 0.62;
        }
        return pts;
    }
    function smooth(pts, closed = true) {
        const p = new Path2D(), n = pts.length;
        const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        if (closed) {
            let m = mid(pts[n - 1], pts[0]); p.moveTo(m[0], m[1]);
            for (let i = 0; i < n; i++) { const m2 = mid(pts[i], pts[(i + 1) % n]); p.quadraticCurveTo(pts[i][0], pts[i][1], m2[0], m2[1]); }
            p.closePath();
        } else {
            p.moveTo(pts[0][0], pts[0][1]);
            for (let i = 1; i < n - 1; i++) { const m2 = mid(pts[i], pts[i + 1]); p.quadraticCurveTo(pts[i][0], pts[i][1], m2[0], m2[1]); }
            p.lineTo(pts[n - 1][0], pts[n - 1][1]);
        }
        return p;
    }

    // ---- the little pictures a map is drawn with (in map units; ink outlines) ----
    const INK = "#4a3826";
    function tree(g, x, y, s, c, shade) {
        g.fillStyle = "#6a4a2a"; g.fillRect(x - s * 0.08, y - s * 0.2, s * 0.16, s * 0.35);
        g.fillStyle = c; g.beginPath(); g.arc(x, y - s * 0.55, s * 0.42, 0, TAU); g.fill();
        g.fillStyle = shade; g.beginPath(); g.arc(x + s * 0.12, y - s * 0.45, s * 0.28, 0, TAU); g.fill();
        g.strokeStyle = INK; g.lineWidth = 1.6; g.beginPath(); g.arc(x, y - s * 0.55, s * 0.42, 0, TAU); g.stroke();
    }
    function pine(g, x, y, s, c, snow) {
        g.fillStyle = c; g.strokeStyle = INK; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s * 0.36, y - s * 0.1); g.lineTo(x - s * 0.36, y - s * 0.1); g.closePath(); g.fill(); g.stroke();
        if (snow) { g.fillStyle = "#ffffff"; g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s * 0.14, y - s * 0.62); g.lineTo(x - s * 0.14, y - s * 0.62); g.closePath(); g.fill(); }
        g.fillStyle = "#5a3a20"; g.fillRect(x - s * 0.05, y - s * 0.1, s * 0.1, s * 0.16);
    }
    function mountain(g, x, y, w, h, light, dark, snow) {
        g.fillStyle = light; g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x, y - h); g.lineTo(x + w / 2, y); g.closePath(); g.fill();
        g.fillStyle = dark; g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + w / 2, y); g.lineTo(x + w * 0.08, y); g.closePath(); g.fill();
        if (snow) { g.fillStyle = "#ffffff"; g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + w * 0.16, y - h * 0.66); g.lineTo(x + w * 0.04, y - h * 0.72); g.lineTo(x - w * 0.06, y - h * 0.62); g.lineTo(x - w * 0.16, y - h * 0.68); g.closePath(); g.fill(); }
        g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x, y - h); g.lineTo(x + w / 2, y); g.stroke();
        g.lineWidth = 1; g.beginPath(); for (let k = 1; k < 4; k++) { g.moveTo(x + w * 0.05 * k, y - h * (0.7 - k * 0.15)); g.lineTo(x + w * 0.12 * k, y - h * (0.55 - k * 0.12)); } g.stroke();
    }
    function house(g, x, y, s, wall, roof) {
        g.fillStyle = wall; g.strokeStyle = INK; g.lineWidth = 1.4;
        g.fillRect(x - s / 2, y - s * 0.6, s, s * 0.6); g.strokeRect(x - s / 2, y - s * 0.6, s, s * 0.6);
        g.fillStyle = roof; g.beginPath(); g.moveTo(x - s * 0.62, y - s * 0.6); g.lineTo(x, y - s * 1.05); g.lineTo(x + s * 0.62, y - s * 0.6); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = "#ffe9a3"; g.fillRect(x - s * 0.12, y - s * 0.42, s * 0.22, s * 0.2);
    }
    function lolly(g, x, y, s, c) {
        g.strokeStyle = "#ffffff"; g.lineWidth = s * 0.12; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - s); g.stroke();
        g.fillStyle = c; g.beginPath(); g.arc(x, y - s, s * 0.38, 0, TAU); g.fill();
        g.strokeStyle = "#ffffff"; g.lineWidth = s * 0.08; g.beginPath(); g.arc(x, y - s, s * 0.2, 0, TAU * 0.8); g.stroke();
        g.strokeStyle = INK; g.lineWidth = 1.4; g.beginPath(); g.arc(x, y - s, s * 0.38, 0, TAU); g.stroke();
    }
    function tent(g, x, y, s, c) {
        g.fillStyle = "#ffffff"; g.strokeStyle = INK; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(x - s / 2, y); g.lineTo(x, y - s * 0.9); g.lineTo(x + s / 2, y); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = c; for (const k of [-0.3, 0.1]) { g.beginPath(); g.moveTo(x, y - s * 0.9); g.lineTo(x + s * k, y); g.lineTo(x + s * (k + 0.18), y); g.closePath(); g.fill(); }
        g.beginPath(); g.moveTo(x, y - s * 0.9); g.lineTo(x, y - s * 1.15); g.stroke(); g.fillStyle = c; g.fillRect(x, y - s * 1.15, s * 0.22, s * 0.12);
    }
    function cactus(g, x, y, s) {
        g.strokeStyle = "#3f7a3a"; g.lineCap = "round"; g.lineWidth = s * 0.22;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - s); g.moveTo(x, y - s * 0.55); g.lineTo(x - s * 0.3, y - s * 0.55); g.lineTo(x - s * 0.3, y - s * 0.8); g.moveTo(x, y - s * 0.4); g.lineTo(x + s * 0.28, y - s * 0.4); g.lineTo(x + s * 0.28, y - s * 0.68); g.stroke();
        g.lineCap = "butt";
    }
    function deadTree(g, x, y, s) {
        g.strokeStyle = "#3a2a3a"; g.lineCap = "round";
        const br = (x0, y0, a, l, d) => { if (d > 3) return; const x1 = x0 + Math.cos(a) * l, y1 = y0 + Math.sin(a) * l; g.lineWidth = Math.max(1, s * 0.1 * (1 - d * 0.25)); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); br(x1, y1, a - 0.5, l * 0.65, d + 1); br(x1, y1, a + 0.45, l * 0.6, d + 1); };
        br(x, y, -Math.PI / 2, s * 0.5, 0); g.lineCap = "butt";
    }
    function factory(g, x, y, s) {
        g.fillStyle = "#6a7583"; g.strokeStyle = INK; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(x - s / 2, y); g.lineTo(x - s / 2, y - s * 0.4); for (let k = 0; k < 3; k++) { g.lineTo(x - s / 2 + (k + 0.5) * s / 3, y - s * 0.62); g.lineTo(x - s / 2 + (k + 1) * s / 3, y - s * 0.4); } g.lineTo(x + s / 2, y); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = "#4a5260"; g.fillRect(x + s * 0.25, y - s * 1.05, s * 0.14, s * 0.65); g.strokeRect(x + s * 0.25, y - s * 1.05, s * 0.14, s * 0.65);
        g.fillStyle = "rgba(160,160,170,.55)"; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(x + s * (0.36 + k * 0.12), y - s * (1.2 + k * 0.18), s * (0.12 + k * 0.05), 0, TAU); g.fill(); }
    }
    function gear(g, x, y, r, c) {
        g.fillStyle = c; g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath();
        for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, rr = k % 2 ? r : r * 1.25; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
        g.closePath(); g.fill(); g.stroke(); g.fillStyle = "#3a4250"; g.beginPath(); g.arc(x, y, r * 0.35, 0, TAU); g.fill();
    }
    function star(g, x, y, r, c) { g.fillStyle = c; g.beginPath(); for (let k = 0; k < 10; k++) { const a = k / 10 * TAU - Math.PI / 2, rr = k % 2 ? r * 0.42 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); }
    function waves(g, x, y, s) { g.beginPath(); g.moveTo(x - s, y); g.quadraticCurveTo(x - s / 2, y - s * 0.6, x, y); g.quadraticCurveTo(x + s / 2, y - s * 0.6, x + s, y); g.stroke(); }

    // where to scatter a region's pictures: around its spot, on land, not on top of the spot itself
    function scatter(R, cx, cy, rad, n, ok, clear = 150) {
        const out = [];
        for (let tries = 0; out.length < n && tries < n * 20; tries++) {
            const a = R() * TAU, d = clear + Math.sqrt(R()) * (rad - clear), x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.85;
            if (ok(x, y)) out.push([x, y]);
        }
        return out.sort((a, b) => a[1] - b[1]);
    }

    function paint(regions, scale) {
        const off = typeof OffscreenCanvas === "function", cw = Math.round(W * scale), ch = Math.round(H * scale);
        const c = off ? new OffscreenCanvas(cw, ch) : Object.assign(document.createElement("canvas"), { width: cw, height: ch });
        const g = c.getContext("2d");
        const probe = (off ? new OffscreenCanvas(4, 4) : document.createElement("canvas")).getContext("2d");
        g.scale(scale, scale);
        const R = rng(2468);
        const land = smooth(rough(COAST, R, 0.22)), isle = smooth(rough(ISLE, R, 0.25));
        const onLand = (x, y) => probe.isPointInPath(land, x, y) || probe.isPointInPath(isle, x, y);
        const region = new Map(regions.map(r => [r.world, r]));
        const colour = (w, k = "ground") => (region.get(w) || {})[k] || "#cfc29a";

        // ---- the sea, and the sky at the top where the world ends ----
        const sea = g.createLinearGradient(0, 300, 0, H);
        sea.addColorStop(0, "#3f7d9a"); sea.addColorStop(0.5, "#5a9bb2"); sea.addColorStop(1, "#4a8aa4");
        g.fillStyle = sea; g.fillRect(0, 0, W, H);
        const sky = g.createLinearGradient(0, 0, 0, 420);
        sky.addColorStop(0, "#0a0820"); sky.addColorStop(0.65, "#2a2160"); sky.addColorStop(1, "rgba(63,125,154,0)");
        g.fillStyle = sky; g.fillRect(0, 0, W, 420);
        for (let i = 0; i < 520; i++) { const x = R() * W, y = R() * 330, r = R() * 2.2 + 0.4; g.fillStyle = `rgba(255,248,230,${(0.3 + R() * 0.7) * (1 - y / 360)})`; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
        // a nebula round Deep Space, and the Rift's golden tear
        const neb = (x, y, r, col) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };
        neb(SPOT.space[0], SPOT.space[1] + 20, 420, "rgba(155,107,255,.35)"); neb(SPOT.space[0] + 260, 120, 260, "rgba(95,200,230,.22)"); neb(SPOT.rift[0], SPOT.rift[1], 260, "rgba(255,210,120,.25)");
        for (const [x, y, r, c1, ring] of [[1080, 120, 34, "#e07a5a", true], [1880, 90, 22, "#7fd4ff", false], [2350, 170, 46, "#c9a6ff", true], [300, 110, 18, "#ffd36b", false]]) {
            g.fillStyle = c1; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
            g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.arc(x + r * 0.3, y + r * 0.2, r * 0.85, 0, TAU); g.fill();
            if (ring) { g.strokeStyle = "rgba(255,240,200,.7)"; g.lineWidth = 3; g.beginPath(); g.ellipse(x, y, r * 1.8, r * 0.45, -0.3, 0, TAU); g.stroke(); }
        }
        // the edge of the world: the sea's foaming rim, spray rising into the stars
        g.strokeStyle = "rgba(255,255,255,.8)"; g.lineWidth = 5; g.beginPath();
        for (let x = 0; x <= W; x += 20) g.lineTo(x, 345 + Math.sin(x * 0.02) * 8 + Math.sin(x * 0.007) * 12);
        g.stroke();
        g.strokeStyle = "rgba(220,240,255,.35)"; g.lineWidth = 2;
        for (let i = 0; i < 160; i++) { const x = R() * W, y = 340 + Math.sin(x * 0.02) * 8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 10, y - 20 - R() * 60); g.stroke(); }
        // the shallows: rings of paler water round every shore
        for (const [w, a] of [[150, 0.08], [110, 0.12], [70, 0.16], [36, 0.24]]) {
            g.lineJoin = "round"; g.strokeStyle = `rgba(200,240,245,${a})`; g.lineWidth = w; g.stroke(land); g.stroke(isle);
        }
        // wave marks across the open sea
        g.strokeStyle = "rgba(20,60,80,.32)"; g.lineWidth = 2.2;
        for (let i = 0; i < 900; i++) { const x = R() * W, y = 380 + R() * (H - 380); if (onLand(x, y) || onLand(x, y - 50) || onLand(x, y + 50) || onLand(x - 60, y) || onLand(x + 60, y)) continue; waves(g, x, y, 10 + R() * 8); if (R() < 0.5) waves(g, x + 22, y + 4, 8); }

        // ---- the land: parchment, then each world's colours washed over its country ----
        g.save(); g.clip(land);
        g.fillStyle = "#ece0b4"; g.fillRect(0, 0, W, H);
        for (const [w, [x, y]] of Object.entries(SPOT)) {
            if (w === "space" || w === "rift" || w === "atlantis" || w === "volcano" || w === "cave") continue;
            const r = w === "hollow" || w === "dunes" ? 260 : 430, gr = g.createRadialGradient(x, y, 0, x, y, r);
            gr.addColorStop(0, colour(w)); gr.addColorStop(0.55, colour(w)); gr.addColorStop(1, "rgba(236,224,180,0)");
            g.globalAlpha = w === "arcade" || w === "library" || w === "robot" ? 0.45 : 0.7; g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
        }
        g.globalAlpha = 1;
        // the Notebook's lowlands are ruled like a page, with a margin
        g.save(); g.beginPath(); g.arc(SPOT.paper[0], SPOT.paper[1], 360, 0, TAU); g.clip();
        g.strokeStyle = "rgba(90,140,210,.35)"; g.lineWidth = 2; for (let y = SPOT.paper[1] - 360; y < SPOT.paper[1] + 360; y += 34) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
        g.strokeStyle = "rgba(220,80,90,.45)"; g.beginPath(); g.moveTo(SPOT.paper[0] - 250, 0); g.lineTo(SPOT.paper[0] - 250, H); g.stroke();
        g.restore();
        // the Arcade's country is a neon grid
        g.save(); g.beginPath(); g.arc(SPOT.arcade[0], SPOT.arcade[1], 300, 0, TAU); g.clip();
        g.strokeStyle = "rgba(255,43,214,.35)"; g.lineWidth = 2; for (let k = -300; k <= 300; k += 40) { g.beginPath(); g.moveTo(SPOT.arcade[0] + k, SPOT.arcade[1] - 300); g.lineTo(SPOT.arcade[0] + k, SPOT.arcade[1] + 300); g.moveTo(SPOT.arcade[0] - 300, SPOT.arcade[1] + k); g.lineTo(SPOT.arcade[0] + 300, SPOT.arcade[1] + k); g.stroke(); }
        g.restore();
        g.restore();
        g.save(); g.clip(isle);
        g.fillStyle = "#6a4a3a"; g.fillRect(0, 0, W, H);
        const lava = g.createRadialGradient(SPOT.volcano[0], SPOT.volcano[1], 0, SPOT.volcano[0], SPOT.volcano[1], 300);
        lava.addColorStop(0, "rgba(255,120,40,.5)"); lava.addColorStop(1, "rgba(255,120,40,0)"); g.fillStyle = lava; g.fillRect(0, 0, W, H);
        g.restore();
        // rivers, from the mountains to the sea
        g.lineCap = "round"; g.lineJoin = "round";
        for (const r of RIVERS) { const p = smooth(rough(r, R, 0.12).slice(0, -1).concat([r[r.length - 1]]), false); g.strokeStyle = INK; g.lineWidth = 16; g.stroke(p); g.strokeStyle = "#6fb4cc"; g.lineWidth = 11; g.stroke(p); g.strokeStyle = "rgba(255,255,255,.4)"; g.lineWidth = 3; g.stroke(p); }
        // the coast's ink line
        g.strokeStyle = INK; g.lineWidth = 4; g.stroke(land); g.stroke(isle);
        g.strokeStyle = "rgba(255,250,230,.5)"; g.lineWidth = 2; g.save(); g.clip(land); g.lineWidth = 14; g.strokeStyle = "rgba(255,250,230,.25)"; g.stroke(land); g.restore();

        // ---- each country's own pictures ----
        const P = (w, n, rad, clear, fn) => { const [x, y] = SPOT[w]; for (const [px, py] of scatter(R, x, y, rad, n, onLand, clear)) fn(px, py); };
        // the central mountains under the Sky Kingdom, Snow Day's peaks, the grey hills of the north
        const peaks = [];
        for (let i = 0; i < 26; i++) { const a = R() * TAU, d = 160 + R() * 240, x = SPOT.sky[0] + 120 + Math.cos(a) * d, y = SPOT.sky[1] + 60 + Math.sin(a) * d * 0.55; if (onLand(x, y)) peaks.push([x, y, 70 + R() * 70, 0]); }
        for (let i = 0; i < 26; i++) { const a = R() * TAU, d = 150 + R() * 250, x = SPOT.snow[0] + Math.cos(a) * d, y = SPOT.snow[1] + Math.sin(a) * d * 0.7; if (onLand(x, y)) peaks.push([x, y, 80 + R() * 80, 1]); }
        for (let i = 0; i < 12; i++) { const x = 1050 + R() * 900, y = 640 + R() * 200; if (onLand(x, y) && Math.hypot(x - SPOT.library[0], y - SPOT.library[1]) > 170 && Math.hypot(x - SPOT.robot[0], y - SPOT.robot[1]) > 170) peaks.push([x, y, 50 + R() * 40, 2]); }
        peaks.sort((a, b) => a[1] - b[1]).forEach(([x, y, s, k]) => mountain(g, x, y, s * 1.3, s, k === 1 ? "#dfe8f4" : k === 2 ? "#8a8a96" : "#b4a88a", k === 1 ? "#a8b8d0" : k === 2 ? "#6a6a76" : "#8a7e62", k !== 2));
        P("garden", 34, 400, 160, (x, y) => tree(g, x, y, 46, "#5fae4a", "#4a9a3a"));
        for (const [x, y] of scatter(R, SPOT.garden[0], SPOT.garden[1], 380, 160, onLand, 120)) { g.fillStyle = ["#ff7aa8", "#ffd23f", "#ffffff", "#c38bff"][Math.floor(R() * 4)]; g.beginPath(); g.arc(x, y, 4, 0, TAU); g.fill(); }
        P("squirrel", 90, 430, 150, (x, y) => tree(g, x, y, 54, ["#d9772b", "#c8521f", "#e3a35a", "#b8862a"][Math.floor(R() * 4)], "rgba(90,40,10,.25)"));
        P("hollow", 22, 240, 120, (x, y) => tree(g, x, y, 60, "#7a4a24", "rgba(40,20,5,.3)"));
        // the oldest oak, at the Great Hollow
        { const [x, y] = SPOT.hollow; g.fillStyle = "#5a3418"; g.strokeStyle = INK; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x - 46, y + 10); g.quadraticCurveTo(x - 30, y - 80, x - 20, y - 140); g.lineTo(x + 20, y - 140); g.quadraticCurveTo(x + 30, y - 80, x + 46, y + 10); g.closePath(); g.fill(); g.stroke();
            g.fillStyle = "#1a0c04"; g.beginPath(); g.ellipse(x, y - 60, 14, 20, 0, 0, TAU); g.fill();
            g.fillStyle = "#8a5a2a"; g.beginPath(); g.arc(x, y - 190, 110, 0, TAU); g.fill(); g.stroke(); g.fillStyle = "#a8692e"; g.beginPath(); g.arc(x + 30, y - 170, 70, 0, TAU); g.fill(); }
        P("candy", 26, 400, 150, (x, y) => (R() < 0.6 ? lolly(g, x, y, 40, ["#ff5fa2", "#7fd4ff", "#ffd23f", "#a6e36b"][Math.floor(R() * 4)]) : (g.fillStyle = "#ff9ccf", g.beginPath(), g.ellipse(x, y, 40, 26, 0, Math.PI, TAU), g.fill(), g.strokeStyle = INK, g.lineWidth = 1.5, g.stroke())));
        P("ocean", 10, 260, 140, (x, y) => { g.strokeStyle = "#6a4a2a"; g.lineWidth = 4; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 8, y - 30, x + 2, y - 54); g.stroke(); g.fillStyle = "#3f9a5a"; for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; g.beginPath(); g.ellipse(x + 2 + Math.cos(a) * 16, y - 56 + Math.sin(a) * 6, 18, 5, a, 0, TAU); g.fill(); } });
        P("snow", 40, 420, 150, (x, y) => pine(g, x, y, 40, "#2f6a4a", true));
        P("rain", 30, 260, 120, (x, y) => house(g, x, y, 26 + R() * 12, "#c8ccd4", ["#5a6a80", "#7a4a4a", "#4a5a6a"][Math.floor(R() * 3)]));
        P("desert", 40, 430, 150, (x, y) => { g.strokeStyle = "rgba(140,90,40,.6)"; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 40, y); g.quadraticCurveTo(x, y - 22, x + 40, y); g.stroke(); });
        P("desert", 14, 400, 160, (x, y) => cactus(g, x, y, 34));
        for (const [x, y, s] of [[SPOT.desert[0] - 220, SPOT.desert[1] + 160, 70], [SPOT.desert[0] - 120, SPOT.desert[1] + 200, 50]]) { g.fillStyle = "#e0b060"; g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(x - s, y); g.lineTo(x, y - s * 0.9); g.lineTo(x + s, y); g.closePath(); g.fill(); g.stroke(); g.fillStyle = "#b88838"; g.beginPath(); g.moveTo(x, y - s * 0.9); g.lineTo(x + s, y); g.lineTo(x + s * 0.2, y); g.closePath(); g.fill(); }
        P("dunes", 18, 260, 110, (x, y) => { g.strokeStyle = "rgba(120,70,30,.65)"; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 50, y); g.quadraticCurveTo(x, y - 26, x + 50, y); g.stroke(); });
        { const [x, y] = SPOT.dunes; g.strokeStyle = "#f3e6cc"; g.lineWidth = 7; g.lineCap = "round"; for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(x - 90 + k * 34, y + 60); g.quadraticCurveTo(x - 110 + k * 34, y - 10, x - 80 + k * 34, y - 40); g.stroke(); } }
        P("carnival", 10, 300, 150, (x, y) => tent(g, x, y, 54, ["#e2483c", "#3f7fd8", "#ffd23f"][Math.floor(R() * 3)]));
        P("arcade", 24, 300, 140, (x, y) => { g.fillStyle = ["#ff2bd6", "#2bf0ff", "#7bff5c"][Math.floor(R() * 3)]; g.fillRect(x - 12, y - 12, 24, 24); g.strokeStyle = INK; g.lineWidth = 1.5; g.strokeRect(x - 12, y - 12, 24, 24); });
        P("library", 22, 300, 150, (x, y) => deadTree(g, x, y, 60));
        P("robot", 8, 300, 160, (x, y) => factory(g, x, y, 60));
        P("robot", 8, 300, 140, (x, y) => gear(g, x, y, 16, "#9aa4b4"));
        // the volcano itself on its island, its lava running down, the cave's glowing mouth
        { const [x, y] = SPOT.volcano; g.fillStyle = "#4a3028"; g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 200, y + 120); g.lineTo(x - 50, y - 110); g.lineTo(x + 50, y - 110); g.lineTo(x + 200, y + 120); g.closePath(); g.fill(); g.stroke();
            g.fillStyle = "#ff6a1f"; g.beginPath(); g.ellipse(x, y - 110, 50, 14, 0, 0, TAU); g.fill();
            g.strokeStyle = "#ff8a2a"; g.lineWidth = 8; for (const k of [-1, 0.4]) { g.beginPath(); g.moveTo(x + k * 20, y - 100); g.quadraticCurveTo(x + k * 60, y, x + k * 90, y + 110); g.stroke(); } }
        { const [x, y] = SPOT.cave; g.fillStyle = "#1a0804"; g.beginPath(); g.ellipse(x, y + 40, 46, 34, 0, Math.PI, TAU); g.fill(); const gl = g.createRadialGradient(x, y + 30, 0, x, y + 30, 80); gl.addColorStop(0, "rgba(255,140,40,.6)"); gl.addColorStop(1, "rgba(255,140,40,0)"); g.fillStyle = gl; g.fillRect(x - 80, y - 50, 160, 160); }
        // Atlantis under the water off the reef: its columns and domes shimmer up through the sea
        { const [x, y] = SPOT.atlantis; g.globalAlpha = 0.4; g.fillStyle = "#d9f0f6";
            for (const [dx, h] of [[-80, 70], [-50, 90], [-20, 60], [30, 100], [70, 80]]) g.fillRect(x + dx, y - h, 14, h);
            g.beginPath(); g.ellipse(x - 10, y - 90, 50, 30, 0, Math.PI, TAU); g.fill(); g.globalAlpha = 1;
            g.strokeStyle = "rgba(255,255,255,.4)"; g.lineWidth = 2; for (let k = 1; k < 4; k++) { g.beginPath(); g.ellipse(x, y - 30, 70 * k, 26 * k, 0, 0, TAU); g.stroke(); } }
        // the Sky Kingdom's clouds
        { const [x, y] = SPOT.sky; g.fillStyle = "rgba(255,255,255,.85)"; for (let k = 0; k < 9; k++) { g.beginPath(); g.arc(x - 160 + k * 40, y + 50 + Math.sin(k) * 10, 40 + (k % 3) * 10, 0, TAU); g.fill(); } }

        // ---- the sea's names, a serpent, a ship, the compass ----
        const name = (text, x, y, size, rot = 0, color = "rgba(20,50,70,.6)") => { g.save(); g.translate(x, y); g.rotate(rot); g.font = `italic 700 ${size}px Georgia, "Times New Roman", serif`; g.fillStyle = color; g.textAlign = "center"; if (g.letterSpacing !== undefined) g.letterSpacing = `${size * 0.25}px`; g.fillText(text, 0, 0); g.restore(); };
        name("The Painted Sea", 700, 2775, 44);
        name("The Sea of Lost Words", 2610, 1520, 42, Math.PI / 2);
        name("The Northern Deep", 1720, 400, 40);
        name("The Edge of the World", 2150, 300, 38, 0, "rgba(255,240,210,.7)");
        name("The Western Shallows", 50, 1600, 36, -Math.PI / 2);
        // a sea serpent's coils off the west coast, and a ship in the south
        { const x = 70, y = 2300; g.fillStyle = "#3f8a6a"; g.strokeStyle = INK; g.lineWidth = 2.5; for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(x + k * 60 - 60, y + 300, 26, 34, 0, Math.PI, TAU); g.fill(); g.stroke(); } }
        { const x = 1500, y = 2770; g.fillStyle = "#8a5a2a"; g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 50, y - 10); g.lineTo(x + 50, y - 10); g.lineTo(x + 36, y + 12); g.lineTo(x - 36, y + 12); g.closePath(); g.fill(); g.stroke();
            g.fillStyle = "#fffaf0"; g.beginPath(); g.moveTo(x, y - 90); g.lineTo(x + 40, y - 20); g.lineTo(x, y - 20); g.closePath(); g.fill(); g.stroke(); g.beginPath(); g.moveTo(x - 4, y - 80); g.lineTo(x - 36, y - 22); g.lineTo(x - 4, y - 22); g.closePath(); g.fill(); g.stroke(); g.beginPath(); g.moveTo(x, y - 95); g.lineTo(x, y - 10); g.stroke(); }
        { const x = 2520, y = 2600, r = 120; g.save(); g.translate(x, y);
            g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, r * 0.82, 0, TAU); g.stroke(); g.beginPath(); g.arc(0, 0, r * 0.7, 0, TAU); g.stroke();
            for (let k = 0; k < 8; k++) { g.rotate(TAU / 8); const long = k % 2 === 1; g.fillStyle = k % 4 === 3 ? "#c8321f" : long ? "#f6ecd2" : "#c9a66b"; g.beginPath(); g.moveTo(0, -r * (long ? 1 : 0.62)); g.lineTo(r * 0.12, 0); g.lineTo(-r * 0.12, 0); g.closePath(); g.fill(); g.stroke(); }
            g.rotate(-TAU); g.font = `700 ${r * 0.28}px Georgia, serif`; g.fillStyle = INK; g.textAlign = "center"; g.fillText("N", 0, -r * 1.06);
            g.restore(); }

        // ---- the sheet: aged paper grain, darker edges, a frame ----
        for (let i = 0; i < 9000; i++) { const x = R() * W, y = R() * H; g.fillStyle = R() < 0.5 ? "rgba(60,40,20,.05)" : "rgba(255,250,230,.06)"; g.fillRect(x, y, 2 + R() * 3, 2 + R() * 3); }
        const vig = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
        vig.addColorStop(0, "rgba(60,40,20,0)"); vig.addColorStop(1, "rgba(60,40,20,.42)"); g.fillStyle = vig; g.fillRect(0, 0, W, H);
        g.strokeStyle = "#3a2a18"; g.lineWidth = 10; g.strokeRect(18, 18, W - 36, H - 36); g.lineWidth = 3; g.strokeRect(40, 40, W - 80, H - 80);
        for (const [x, y] of [[40, 40], [W - 40, 40], [40, H - 40], [W - 40, H - 40]]) { g.fillStyle = "#c9a66b"; g.strokeStyle = "#3a2a18"; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 22, 0, TAU); g.fill(); g.stroke(); star(g, x, y, 14, "#3a2a18"); }
        return off ? c.transferToImageBitmap() : c;
    }
    // the painted map, made once (one pixel per unit: 2700 x 2800)
    function texture(regions) {
        if (!cached) cached = paint(regions, 1);
        return cached;
    }
    return { W, H, SPOT, texture, ready: () => !!cached };
})();
