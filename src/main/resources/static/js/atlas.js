// The Atlas's sea: the whole campaign as an archipelago on a tilted sea, drawn on ONE canvas.
//
// Each island is drawn from a few flat pictures (its boss, its scenery, your hero, a gate) that are turned into
// bitmaps once and cached at a handful of sizes, plus shapes drawn straight onto the canvas (the island's slab, the
// sea, the road, the page's light). Nothing here is a 3D DOM layer, so moving the camera costs one canvas redraw.
// campaign.js decides what is on the sea (AtlasView.create) and what happens when an island is picked.
//
//   const v = AtlasView.create(host, { width, height, islands, road, branches, glimmers, insets, onPick, onTravel })
//   v.look(x, y, z)       glide the camera to a point of the sea (z: zoom)
//   v.focus(i)            outline island i (its map index)
//   v.fit()               the zoom that shows the whole journey
//   v.zoomBy(k)           zoom in (k > 1) or out around the middle of the view
//   v.cam                 { x, y, z, tx, ty, tz }: where the camera is and where it's heading
//   v.destroy()           stop drawing and let go of everything
//   AtlasView.warm(list)  make pictures ahead of time ([{ key, svg, px, look }]), so the Atlas opens without waiting
//   AtlasView.thumb(canvas, o)  a world's boss on a little island, for the dock's windows
//
// The sea is a plane of width x height units. The camera looks at the point (x, y) of it, zoomed by z; the plane is
// tilted away by TILT degrees and seen with a perspective of PERSP pixels, like CSS's rotateX + perspective.
const AtlasView = (() => {
    const TILT = 54 * Math.PI / 180, COS = Math.cos(TILT), SIN = Math.sin(TILT), PERSP = 2600;
    const ZMAX = 2.3;
    const SIZES = [48, 96, 160, 256, 400, 640];          // the widths (in device pixels) a picture is cached at

    // ---- colours ----
    const hex = h => { const n = parseInt(h.slice(1), 16); return h.length === 4 ? [((n >> 8) & 15) * 17, ((n >> 4) & 15) * 17, (n & 15) * 17] : [n >> 16, (n >> 8) & 255, n & 255]; };
    const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
    const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    const dull = c => { const g = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11; return mix(c, [g, g, g], 0.9).map(v => v * 0.55); };
    const WHITE = [255, 255, 255], NIGHT = hex("#170d24");

    // ---- the pictures: an SVG string turned into a bitmap, cached per (key, size, look) ----
    // look: "" as drawn, "shadow" (a dark silhouette with a faint rim, for a boss you haven't reached), "faded" (less
    // colour, for a boss you've beaten)
    const cache = new Map(), loading = new Map();
    let onReady = null;                                   // the open view's redraw, called when a picture arrives
    let calm = true;                                      // the camera is still: new sizes may be made
    function aspectOf(svg) {
        const m = /viewBox="([-\d.]+)[ ,]+([-\d.]+)[ ,]+([-\d.]+)[ ,]+([-\d.]+)"/.exec(svg);
        return m ? +m[4] / +m[3] : 1;
    }
    function source(key, svg) {
        if (loading.has(key)) return loading.get(key);
        const img = new Image();
        const text = svg.includes("xmlns=") ? svg : svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
        const p = new Promise(resolve => { img.onload = () => resolve(img); img.onerror = () => resolve(null); });
        img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(text);
        const entry = { p, img, aspect: aspectOf(svg), ok: false };
        p.then(i => { entry.ok = !!i; });
        loading.set(key, entry);
        return entry;
    }
    // (drawn on an OffscreenCanvas and kept as an ImageBitmap where the browser has them: a bitmap stays on the GPU,
    // while a canvas used as a picture is sent there again every frame)
    function render(src, w, look) {
        const h = Math.max(1, Math.round(w * src.aspect));
        const off = typeof OffscreenCanvas === "function";
        const c = off ? new OffscreenCanvas(w, h) : document.createElement("canvas");
        if (!off) { c.width = w; c.height = h; }
        const g = c.getContext("2d");
        if (look === "faded" && "filter" in g) g.filter = "saturate(.5)";
        g.drawImage(src.img, 0, 0, w, h);
        if (look === "shadow") {
            g.filter = "none";
            g.globalCompositeOperation = "source-atop";
            g.fillStyle = "#120a1e";
            g.fillRect(0, 0, w, h);
        }
        return off && c.transferToImageBitmap ? c.transferToImageBitmap() : c;
    }
    // Turning a picture into a bitmap takes a few milliseconds (a boss at its biggest, tens), so it's never done while
    // a frame is being drawn: it goes in a queue, and the queue is worked through a few milliseconds a frame. Until
    // then the nearest size already made stands in.
    const jobs = [], queued = new Set();
    let pumping = 0;
    function enqueue(id, key, svg, size, look) {
        if (queued.has(id)) return;
        queued.add(id);
        jobs.push({ id, key, svg, size, look });
        if (!pumping) pumping = requestAnimationFrame(work);
    }
    function work() {
        pumping = 0;
        const t0 = performance.now();
        let made = 0;
        while (jobs.length && (made === 0 || performance.now() - t0 < 6)) {
            const j = jobs.shift(), src = source(j.key, j.svg);
            if (!src.ok) {
                queued.delete(j.id);
                src.p.then(ok => { if (ok) enqueue(j.id, j.key, j.svg, j.size, j.look); });
                continue;
            }
            cache.set(j.id, render(src, j.size, j.look));
            queued.delete(j.id);
            made++;
        }
        if (made && onReady) onReady();
        if (jobs.length) pumping = requestAnimationFrame(work);
    }
    // the cached bitmap for a picture at (at least) px device pixels wide, or the nearest one already made
    function picture(key, svg, px, look = "") {
        const size = SIZES.find(s => s >= px) || SIZES[SIZES.length - 1];
        const id = key + "|" + look + "|" + size;
        const hit = cache.get(id);
        if (hit) return hit;
        let best = null;
        for (const s of SIZES) { const c = cache.get(key + "|" + look + "|" + s); if (c && (!best || Math.abs(s - size) < Math.abs(best.width - size))) best = c; }
        // (while the camera moves, the nearest size stands in: making new ones mid-zoom is what made zooming stutter)
        if (!best || calm) enqueue(id, key, svg, size, look);
        return best;
    }
    // make pictures ahead of time, when the browser has nothing else to do: [{ key, svg, px, look }]
    // (a couple of pictures start loading per quiet moment: each one is a small SVG document the browser has to read)
    function warm(list) {
        const idle = window.requestIdleCallback || (fn => setTimeout(() => fn({ timeRemaining: () => 8 }), 120));
        let waiting = 0;
        const next = deadline => {
            let started = 0;
            for (let n = list.length; n > 0 && list.length && deadline.timeRemaining() > 4; n--) {
                const w = list.shift(), size = SIZES.find(s => s >= w.px) || SIZES[SIZES.length - 1], id = w.key + "|" + (w.look || "") + "|" + size;
                if (cache.has(id)) continue;
                const fresh = !loading.has(w.key), src = source(w.key, w.svg);
                if (src.ok) { cache.set(id, render(src, size, w.look || "")); continue; }
                list.push(w);
                if (fresh) {
                    waiting++;
                    src.p.then(() => { waiting--; });
                    if (++started >= 2) break;
                }
            }
            if (list.length) idle(next);
        };
        idle(next);
    }
    // A world's window in the dock (campaign.js drawStrip): its boss standing on a little island of the world's
    // colours, under a glow of them. o: { key, svg, look, ground, hill }. Drawn once; again when the boss's picture
    // is ready.
    function thumb(canvas, o) {
        const w = Math.max(16, canvas.clientWidth || 52), h = Math.max(16, canvas.clientHeight || 52), dpr = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
        const g = canvas.getContext("2d"), ground = hex(o.ground), hill = hex(o.hill), dark = o.look === "shadow";
        const size = SIZES.find(s => s >= h * 0.95 * dpr) || SIZES[SIZES.length - 1], id = o.key + "|" + (o.look || "") + "|" + size;
        const paint = () => {
            g.setTransform(dpr, 0, 0, dpr, 0, 0);
            const sky = g.createRadialGradient(w / 2, h * 0.38, 0, w / 2, h * 0.38, Math.max(w, h) * 0.75);
            sky.addColorStop(0, css(mix(ground, WHITE, dark ? 0.05 : 0.45)));
            sky.addColorStop(0.55, css(mix(hill, NIGHT, dark ? 0.45 : 0.1)));
            sky.addColorStop(1, css(mix(hill, NIGHT, dark ? 0.75 : 0.5)));
            g.fillStyle = sky;
            g.fillRect(0, 0, w, h);
            // the island: its side in two layers, then its top
            const cx = w / 2, cy = h * 0.84, rx = w * 0.44, ry = h * 0.11;
            for (let n = 2; n >= 1; n--) { g.fillStyle = css(mix(hill, NIGHT, 0.2 + n * 0.15)); g.beginPath(); g.ellipse(cx, cy + n * h * 0.035, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
            g.fillStyle = css(mix(ground, WHITE, 0.15));
            g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill();
            g.fillStyle = "rgba(10, 4, 24, .22)";
            g.beginPath(); g.ellipse(cx, cy, rx * 0.5, ry * 0.5, 0, 0, Math.PI * 2); g.fill();
            const pic = cache.get(id);
            if (!pic) return;
            const bh = h * 0.8, bw = bh * pic.width / pic.height;
            g.drawImage(pic, cx - bw / 2, cy + ry * 0.35 - bh, bw, bh);
        };
        paint();
        if (cache.has(id)) return;
        source(o.key, o.svg).p.then(ok => {
            if (!ok || !canvas.isConnected) return;
            if (!cache.has(id)) cache.set(id, render(loading.get(o.key), size, o.look || ""));
            paint();
        });
    }

    function create(host, opts) {
        const { width: W, height: H } = opts;
        // (a flat Atlas is a map seen from straight above: its painted land, opts.terrain, lies under the locations)
        const flat = !!opts.flat, tilt = (flat ? 0 : 54) * Math.PI / 180, COS = Math.cos(tilt), SIN = Math.sin(tilt);
        const canvas = document.createElement("canvas"), g = canvas.getContext("2d");
        canvas.className = "at-canvas";
        const tags = document.createElement("div");
        tags.className = "at-tags";
        host.append(canvas, tags);
        const cam = { x: W / 2, y: H / 2, z: 1, tx: W / 2, ty: H / 2, tz: 1 };
        let vw = 1, vh = 1, dpr = 1, raf = 0, alive = true, focusI = -1, hoverI = -1, born = performance.now();
        const islands = opts.islands.map((d, n) => ({ ...d, n, hover: 0, outline: blob(d.seed ?? n, d.rock ? 0.06 : 0.1) }));

        // ---- the camera ----
        // the middle of the view (where the camera's point is drawn) and the point the sea vanishes toward
        function frame() {
            const ins = opts.insets ? opts.insets() : { right: 0, bottom: 0 };
            const cx = (vw - ins.right) / 2, cy = ins.bottom ? (vh - ins.bottom) * 0.62 : vh * 0.6;
            return { cx, cy, ox: cx, oy: cy - vh * 0.42 };
        }
        let F = { cx: 0, cy: 0, ox: 0, oy: 0 };
        // a point of the sea (and a height above it, in sea units) on the screen, and how much it's scaled there
        function project(px, py, h = 0, c = cam) {
            const dx = (px - c.x) * c.z, dy = (py - c.y) * c.z;
            const den = PERSP - dy * SIN;
            if (den < 80) return null;                        // behind the viewer
            const f = PERSP / den, s = c.z * f;
            return { x: F.ox + (F.cx + dx - F.ox) * f, y: F.oy + (F.cy + dy * COS - F.oy) * f - h * s, s };
        }
        // the point of the sea under a point of the screen (relative to the camera's point, in sea units x zoom)
        function unproject(sx, sy) {
            const A = sy - F.oy, B = F.cy - F.oy;
            const den = COS * PERSP + A * SIN;
            if (den <= 1) return null;
            const dy = (A - B) * PERSP / den, f = PERSP / (PERSP - dy * SIN);
            return { dx: (sx - F.ox) / f - (F.cx - F.ox), dy };
        }
        const clampCam = () => {
            cam.tx = Math.min(W - 100, Math.max(100, cam.tx));
            cam.ty = Math.min(H - 100, Math.max(100, cam.ty));
            cam.tz = Math.min(flat ? 0.9 : ZMAX, Math.max(fitZ() * 0.9, cam.tz));       // (a painted map stays sharp up to about 1 pixel a unit)
        };
        function look(x, y, z = cam.tz) { cam.tx = x; cam.ty = y; cam.tz = z; clampCam(); wake(); }
        // the zoom (with the camera on the middle of the islands) that keeps every island in view
        let fitCache = null;
        function fitZ() {
            if (fitCache && fitCache.w === vw && fitCache.h === vh) return fitCache.z;
            const ins = opts.insets ? opts.insets() : { right: 0, bottom: 0 }, mid = middle();
            let lo = 0.05, hi = 2;
            for (let k = 0; k < 22; k++) {
                const z = (lo + hi) / 2, c = { x: mid[0], y: mid[1], z };
                const fits = islands.every(d => {
                    const top = project(d.x, d.y, 260, c), bot = project(d.x, d.y + 200, 0, c);
                    return top && bot && top.y > 90 && bot.y < vh - ins.bottom - (ins.bottom ? 20 : 80) && project(d.x - 230, d.y, 0, c).x > 20 && project(d.x + 230, d.y, 0, c).x < vw - ins.right - 20;
                });
                if (fits) lo = z; else hi = z;
            }
            fitCache = { w: vw, h: vh, z: lo };
            return lo;
        }
        function middle() {
            const xs = islands.map(d => d.x), ys = islands.map(d => d.y);
            return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2 + 60];
        }
        function fit() { const [x, y] = middle(); look(x, y, fitZ()); }
        // zoom by k keeping the point of the sea under (sx, sy) where it is (the middle of the view if not given)
        function zoomBy(k, sx = F.cx, sy = F.cy) {
            const u = unproject(sx, sy), z0 = cam.tz;
            cam.tz = z0 * k;
            clampCam();
            if (u) { cam.tx += u.dx / z0 - u.dx / cam.tz; cam.ty += u.dy / z0 - u.dy / cam.tz; }
            clampCam();
            wake();
        }

        // ---- drawing ----
        // an island's outline: a slightly lumpy oval (the same for an island every time)
        function blob(seed, wob) {
            let s = (seed * 9301 + 49297) % 233280;
            const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
            const a = r() * 6.28, b = r() * 6.28, out = [];
            for (let k = 0; k < 40; k++) { const t = k / 40 * Math.PI * 2; out.push([Math.cos(t), Math.sin(t), 1 + wob * (Math.sin(t * 2 + a) * 0.6 + Math.sin(t * 3 + b) * 0.4)]); }
            return out;
        }
        // trace an island's outline at (px, py) on the sea, rx by ry units, dropped by `down` units below the top
        function trace(d, rx, ry, down = 0) {
            g.beginPath();
            let any = false;
            for (const [cx, cy, k] of d.outline) {
                const p = project(d.x + cx * rx * k, d.y + cy * ry * k, -down);
                if (!p) continue;
                any ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y);
                any = true;
            }
            g.closePath();
            return any;
        }
        function ellipseAt(px, py, rx, ry, h = 0) {
            const c = project(px, py, h), a = project(px + rx, py, h), b = project(px, py - ry, h), e = project(px, py + ry, h);
            if (!c || !a || !b || !e) return null;
            return { x: c.x, y: (b.y + e.y) / 2, rx: Math.abs(a.x - c.x), ry: Math.abs(e.y - b.y) / 2, s: c.s };
        }
        function radial(e, stops, alpha = 1) {
            if (!e || e.rx < 1) return;
            g.save();
            g.globalAlpha = alpha;
            g.translate(e.x, e.y);
            g.scale(1, e.ry / e.rx);
            const gr = g.createRadialGradient(0, 0, 0, 0, 0, e.rx);
            stops.forEach(([o, c]) => gr.addColorStop(o, c));
            g.fillStyle = gr;
            g.beginPath(); g.arc(0, 0, e.rx, 0, Math.PI * 2); g.fill();
            g.restore();
        }
        // a picture standing on the sea at (px, py), w units wide, its feet on the spot
        function stand(key, svg, px, py, w, look = "", scale = 1, shadow = true) {
            const p = project(px, py);
            if (!p) return;
            const ww = w * p.s * scale;
            if (ww < 2 || p.x < -ww || p.x > vw + ww || p.y < -ww * 2 || p.y > vh + ww) return;
            if (shadow) {
                g.fillStyle = "rgba(10, 4, 24, .2)";
                g.beginPath(); g.ellipse(p.x, p.y, ww * 0.3, ww * 0.3 * COS * 0.45, 0, 0, Math.PI * 2); g.fill();
            }
            const pic = picture(key, svg, ww * dpr, look);
            if (!pic) return;
            const hh = ww * pic.height / pic.width;
            g.drawImage(pic, p.x - ww / 2, p.y - hh, ww, hh);
            return { x: p.x - ww / 2, y: p.y - hh, w: ww, h: hh };
        }

        function drawSea(t) {
            g.clearRect(0, 0, vw, vh);
            if (flat) {
                const a = project(0, 0), b = project(W, H), tex = opts.terrain && opts.terrain();
                if (a && b) { if (tex) g.drawImage(tex, a.x, a.y, b.x - a.x, b.y - a.y); else { g.fillStyle = "#3f7d9a"; g.fillRect(a.x, a.y, b.x - a.x, b.y - a.y); } }
                return;
            }
            // a soft purple pool of light on the water, and rings on it
            // (the pool of light under it all is the .at-scene background: a full-screen gradient here cost too much
            // on high-density screens)
            const cx = W / 2, cy = H * 0.62, R = Math.max(W, H) * 0.78;
            g.strokeStyle = "rgba(255, 255, 255, .055)";
            g.lineWidth = Math.max(1, 3 * cam.z);
            for (let r = 120 + (t / 90) % 120; r < R; r += 120) {
                g.beginPath();
                let on = false;
                for (let k = 0; k <= 64; k++) {
                    const a = k / 64 * Math.PI * 2, p = project(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
                    if (!p) { on = false; continue; }
                    on ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y);
                    on = true;
                }
                g.stroke();
            }
        }
        function line(pts, width, color, dash) {
            g.beginPath();
            let on = false;
            for (const [x, y] of pts) { const p = project(x, y); if (!p) { on = false; continue; } on ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); on = true; }
            g.lineWidth = width; g.strokeStyle = color; g.setLineDash(dash || []);
            g.stroke();
        }
        function drawRoad(t) {
            const road = opts.road;
            if (!road) return;
            const k = Math.max(0.35, Math.min(1.3, cam.z));
            g.lineCap = "round"; g.lineJoin = "round";
            if (flat) {                                   // a map's trail: ink dashes, the way you've come in red
                line(road.all, 14 * k, "rgba(255, 246, 220, .55)");
                line(road.all, 6 * k, "#5a3e22", [12 * k, 12 * k]);
                if (road.done.length > 1) { line(road.done, 16 * k, "rgba(255, 246, 220, .7)"); line(road.done, 9 * k, "#c8321f", [16 * k, 10 * k]); }
                for (const b of opts.branches || []) line(b, 6 * k, "#7a4ac8", [6 * k, 12 * k]);
                g.setLineDash([]);
                return;
            }
            line(road.all, 44 * k, "rgba(20, 10, 40, .45)");
            line(road.all, 8 * k, "rgba(255, 255, 255, .34)", [2 * k, 26 * k]);
            if (road.done.length > 1) {
                line(road.done, 30 * k, "rgba(242, 193, 74, .25)");
                line(road.done, 16 * k, "#f2c14a");
            }
            for (const b of opts.branches || []) { line(b, 14 * k, "rgba(201, 166, 255, .25)"); line(b, 8 * k, "#c9a6ff", [3 * k, 20 * k]); }
            g.setLineDash([]);
        }
        function drawIsland(d, t) {
            const age = (t - born - (d.n * 40 + 100)) / 700;
            if (age <= 0 && !still()) return;
            const rise = still() ? 1 : Math.min(1, age), e = 1 - Math.pow(1 - rise, 3);
            g.save();
            g.globalAlpha = e;
            g.translate(0, (1 - e) * 60 * cam.z);
            if (flat) { drawPlace(d, t); g.restore(); return; }
            const RX = d.rock ? 90 : d.small ? 125 : 190, RY = d.rock ? 76 : d.small ? 105 : 160;
            const hill = hex(d.hill), ground = hex(d.ground), shut = !d.open && !d.rock;
            const h2 = shut ? dull(hill) : hill, g2 = shut ? dull(ground) : ground;
            // its glow on the water
            if (!shut) radial(ellipseAt(d.x, d.y, RX * 1.8, RY * 1.8, -70), [[0, css(mix(ground, [0, 0, 0], 0), 0.35)], [1, css(ground, 0)]]);
            if (d.n === focusI) radial(ellipseAt(d.x, d.y, RX * 1.45, RY * 1.45), [[0.55, "rgba(255, 236, 170, .55)"], [1, "rgba(255, 236, 170, 0)"]]);
            // its side, layer by layer from the bottom up, then its top
            for (let n = d.rock ? 3 : 5; n >= 1; n--) {
                if (!trace(d, RX, RY, n * 11)) continue;
                g.fillStyle = css(mix(h2, NIGHT, n * 0.09));
                g.fill();
            }
            const top = ellipseAt(d.x, d.y, RX, RY);
            if (top && trace(d, RX, RY)) {
                // (the path is already placed; the gradient is set out in a squashed space so it's an oval)
                g.save();
                g.translate(top.x, top.y - top.ry * 0.2);
                g.scale(1, top.ry / top.rx);
                const gr = g.createRadialGradient(0, 0, 0, 0, 0, top.rx * 1.15);
                gr.addColorStop(0, css(mix(g2, WHITE, 0.24)));
                gr.addColorStop(0.55, css(g2));
                gr.addColorStop(1, css(mix(g2, h2, 0.45)));
                g.fillStyle = gr;
                g.fill();
                g.restore();
                g.lineWidth = Math.max(1, 6 * top.s);
                g.strokeStyle = d.n === focusI ? "#fff" : css(mix(h2, WHITE, 0.3));
                g.stroke();
                if (d.n === focusI) { g.lineWidth = Math.max(1.5, 10 * top.s); g.strokeStyle = "rgba(255, 255, 255, .5)"; trace(d, RX * 1.06, RY * 1.06); g.stroke(); }
            }
            // a bit of road across its top
            if (!d.rock) line([[d.x - 106, d.y + 22], [d.x - 10, d.y + 14], [d.x + 91, d.y - 6]], Math.max(1, 12 * (top ? top.s : 1)), css(hex(d.path), shut ? 0.35 : 0.9));
            // where you are: a ring that keeps spreading
            if (d.here && top) {
                const k = still() ? 0.5 : ((t / 2000) % 1);
                g.lineWidth = Math.max(1.5, 8 * top.s * (1 - k * 0.6));
                g.strokeStyle = `rgba(255, 255, 255, ${(1 - k) * 0.85})`;
                g.beginPath(); g.ellipse(top.x, top.y, top.rx * (1.1 + k * 0.25), top.ry * (1.1 + k * 0.25), 0, 0, Math.PI * 2); g.stroke();
            }
            // mist over a world you haven't reached
            if (shut) {
                const drift = still() ? 0 : Math.sin(t / 7000 * Math.PI) * 40;
                radial(ellipseAt(d.x + drift, d.y - Math.abs(drift) * 0.35, 260, 200, 26), [[0, "rgba(220, 215, 240, .5)"], [1, "rgba(220, 215, 240, 0)"]], 0.9);
            }
            // what stands on it, back to front: scenery behind the boss, the boss (and its page), the rest, the hero
            const things = [];
            for (const p of d.props || []) things.push({ y: p.oy, draw: () => stand(p.key, p.svg, d.x + p.ox, d.y + p.oy, 74 * p.k) });
            if (d.boss) things.push({ y: -40, draw: () => drawBoss(d, t) });
            if (d.gate) things.push({ y: -10, draw: () => { d.box = stand(d.gateKey, d.gate, d.x, d.y - 10, 110, "", 1 + d.hover * 0.1, false); } });
            if (d.hero) things.push({ y: 60, draw: () => stand(d.heroKey, d.hero, d.x - 130, d.y + 60, 100) });
            things.sort((a, b) => a.y - b.y).forEach(x => x.draw());
            g.restore();
        }
        // a place on the map: a marker under it, a ring where you are, fog over somewhere not reached yet
        function drawPlace(d, t) {
            const shut = !d.open && !d.rock, r = d.rock ? 46 : d.small ? 60 : 80, c = project(d.x, d.y);
            if (!c) return;
            const s = c.s, ground = hex(d.ground);
            radial({ x: c.x, y: c.y, rx: r * 1.9 * s, ry: r * 1.9 * s }, [[0, css(ground, shut ? 0.15 : 0.55)], [1, css(ground, 0)]]);
            // a world with a secret still to find: its country glows gold, a solid gold ring round its base with a bright
            // shine sweeping round it, sparkles circling, and a ring that keeps spreading out
            if (d.gold) {
                const pulse = still() ? 0.85 : 0.8 + Math.sin(t / 500 + d.n) * 0.2, spin = still() ? 0 : t / 900;
                radial({ x: c.x, y: c.y - 40 * s, rx: 320 * s, ry: 280 * s }, [[0, `rgba(255, 214, 90, ${0.65 * pulse})`], [0.5, `rgba(255, 190, 60, ${0.35 * pulse})`], [1, "rgba(255, 190, 60, 0)"]]);
                g.save(); g.translate(c.x, c.y); g.scale(1, 0.55);
                const R1 = r * 1.4 * s;
                const fill = g.createRadialGradient(0, 0, 0, 0, 0, R1);
                fill.addColorStop(0, "rgba(255, 236, 160, .75)"); fill.addColorStop(0.75, "rgba(255, 200, 70, .6)"); fill.addColorStop(1, "rgba(220, 150, 30, .85)");
                g.fillStyle = fill; g.beginPath(); g.arc(0, 0, R1, 0, Math.PI * 2); g.fill();
                g.lineWidth = Math.max(3, 14 * s); g.strokeStyle = "#e0a52a"; g.stroke();
                g.lineWidth = Math.max(2, 7 * s); g.strokeStyle = "#ffd65a"; g.stroke();
                g.lineWidth = Math.max(2, 9 * s); g.strokeStyle = "rgba(255, 252, 230, .95)"; g.lineCap = "round";
                g.beginPath(); g.arc(0, 0, R1, spin, spin + 1.1); g.stroke();
                g.beginPath(); g.arc(0, 0, R1, spin + Math.PI, spin + Math.PI + 0.6); g.stroke();
                const k = still() ? 0.5 : ((t / 1600 + d.n * 0.3) % 1);
                g.lineWidth = Math.max(1.5, 8 * s * (1 - k)); g.strokeStyle = `rgba(255, 214, 90, ${(1 - k) * 0.9})`;
                g.beginPath(); g.arc(0, 0, R1 * (1.05 + k * 0.7), 0, Math.PI * 2); g.stroke();
                g.restore();
                for (let q = 0; q < 4; q++) {                                     // sparkles circling the ring
                    const a = -spin * 1.3 + q * Math.PI / 2, sx = c.x + Math.cos(a) * R1 * 1.12, sy = c.y + Math.sin(a) * R1 * 1.12 * 0.55, sr = Math.max(3, 14 * s) * (0.7 + 0.3 * Math.sin(t / 200 + q));
                    radial({ x: sx, y: sy, rx: sr * 2, ry: sr * 2 }, [[0, "rgba(255, 246, 200, .9)"], [1, "rgba(255, 220, 110, 0)"]]);
                    g.fillStyle = "#fffbe8"; g.beginPath(); g.moveTo(sx, sy - sr); g.lineTo(sx + sr * 0.3, sy); g.lineTo(sx, sy + sr); g.lineTo(sx - sr * 0.3, sy); g.closePath(); g.fill();
                    g.beginPath(); g.moveTo(sx - sr, sy); g.lineTo(sx, sy - sr * 0.3); g.lineTo(sx + sr, sy); g.lineTo(sx, sy + sr * 0.3); g.closePath(); g.fill();
                }
            }
            g.lineWidth = Math.max(1, 4 * s); g.strokeStyle = "#4a3826"; g.fillStyle = css(mix(ground, WHITE, 0.35), shut ? 0.5 : 0.85);
            g.beginPath(); g.ellipse(c.x, c.y, r * s, r * 0.55 * s, 0, 0, Math.PI * 2); g.fill(); g.stroke();
            g.setLineDash([6 * s, 6 * s]); g.beginPath(); g.ellipse(c.x, c.y, r * 0.78 * s, r * 0.42 * s, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
            if (d.n === focusI) { g.lineWidth = Math.max(2, 8 * s); g.strokeStyle = "rgba(255, 246, 200, .9)"; g.beginPath(); g.ellipse(c.x, c.y, r * 1.2 * s, r * 0.68 * s, 0, 0, Math.PI * 2); g.stroke(); }
            if (d.here) {
                const k = still() ? 0.5 : ((t / 2000) % 1);
                g.lineWidth = Math.max(1.5, 7 * s * (1 - k * 0.6)); g.strokeStyle = `rgba(200, 50, 31, ${(1 - k) * 0.9})`;
                g.beginPath(); g.ellipse(c.x, c.y, r * (1.1 + k * 0.5) * s, r * (0.6 + k * 0.28) * s, 0, 0, Math.PI * 2); g.stroke();
            }
            if (d.boss) drawBoss(d, t);
            if (d.gate) d.box = stand(d.gateKey, d.gate, d.x, d.y - 10, 110, "", 1 + d.hover * 0.1, false);
            if (d.hero) stand(d.heroKey, d.hero, d.x - 120, d.y + 50, 90);
            // fog over a land you haven't reached: soft cloud you can just see through
            if (shut) {
                const drift = still() ? 0 : Math.sin(t / 7000 * Math.PI + d.n) * 20;
                for (const [dx, dy, rr] of [[-70, -50, 120], [60, -80, 110], [0, 10, 130], [-50, 60, 95], [70, 40, 100]])
                    radial({ x: c.x + (dx + drift) * s, y: c.y + (dy - 40) * s, rx: rr * s, ry: rr * 0.7 * s }, [[0, "rgba(246, 240, 226, .5)"], [1, "rgba(246, 240, 226, 0)"]]);
            }
        }
        function drawBoss(d, t) {
            const look = d.open ? (d.won ? "faded" : "") : "shadow";
            const box = stand("boss-" + d.world, d.boss, d.x, d.y - (d.small ? 26 : 40), d.small ? 118 : 170, look, 1 + d.hover * 0.1);
            d.box = box;
            if (!box || d.won) return;
            // the page it holds, and the beam of light rising from it
            const bob = still() ? 0 : Math.sin(t / 540 + d.n) * 0.06;
            const pw = box.w * 0.21, ph = pw * 1.28, px = box.x + box.w / 2, py = box.y - pw * 0.6 + bob * box.w * 0.4;
            const pulse = still() ? 0.75 : 0.6 + Math.sin(t / 540 + d.n) * 0.25;
            const beam = g.createLinearGradient(0, py, 0, py - box.w * 2.7);
            beam.addColorStop(0, `rgba(255, 228, 150, ${0.55 * pulse})`);
            beam.addColorStop(1, "rgba(255, 228, 150, 0)");
            g.fillStyle = beam;
            g.fillRect(px - pw * 0.65 * (0.7 + pulse * 0.3), py - box.w * 2.7, pw * 1.3 * (0.7 + pulse * 0.3), box.w * 2.7);
            radial({ x: px, y: py, rx: pw * 1.8, ry: pw * 1.8 }, [[0, `rgba(255, 221, 130, ${0.7 * pulse})`], [1, "rgba(255, 221, 130, 0)"]]);
            g.save();
            g.translate(px, py);
            g.rotate((still() ? 0 : Math.sin(t / 540 + d.n)) * 0.1);
            g.fillStyle = "#fbf1d3";
            g.fillRect(-pw / 2, -ph / 2, pw, ph);
            g.fillStyle = "#d9ae4a";
            g.fillRect(-pw / 2, -ph / 2, Math.max(1, pw * 0.1), ph);
            g.fillStyle = "rgba(160, 120, 50, .45)";
            for (let k = 0; k < 3; k++) g.fillRect(-pw * 0.25, -ph * 0.2 + k * ph * 0.18, pw * 0.55, Math.max(0.7, ph * 0.05));
            g.restore();
        }
        function drawGlimmer(p, t) {
            const q = project(p[0], p[1]);
            if (!q) return;
            const k = still() ? 0.8 : 0.6 + Math.sin(t / 480) * 0.4, r = Math.max(4, 40 * q.s) * k;
            radial({ x: q.x, y: q.y, rx: r, ry: r }, [[0, "#fff"], [0.25, "rgba(201, 166, 255, .9)"], [1, "rgba(201, 166, 255, 0)"]]);
        }
        // the name plates: real buttons over the canvas, moved with their islands
        const plates = islands.map(d => {
            if (!d.label) return null;
            const b = document.createElement("button");
            b.type = "button";
            b.className = "at-label" + (d.rock ? " secret" : "") + (d.gold ? " gold" : "");
            if (d.label.world) { b.dataset.world = d.label.world; b.dataset.theme = d.label.theme; }
            b.setAttribute("aria-label", d.label.aria);
            const name = document.createElement("b"); name.textContent = d.label.name;
            const sub = document.createElement("small"); sub.append(...(d.label.sub || []));
            b.append(name, sub);
            b.addEventListener("click", e => { if (e.detail === 0) opts.onPick(d); });   // the keyboard (a pointer is handled below)
            b.addEventListener("focus", () => { if (d.n !== focusI && b.matches(":focus-visible")) opts.onPick(d, true); });
            tags.append(b);
            return { el: b, last: "" };
        });
        // (a plate behind the page of the atlas is hidden: it couldn't be pressed there)
        function placeTags() {
            const ins = opts.insets ? opts.insets() : { right: 0, bottom: 0 };
            islands.forEach((d, n) => {
                const t = plates[n];
                if (!t) return;
                const p = project(d.x, d.y + (flat ? (d.rock ? 60 : d.small ? 70 : 90) : d.rock ? 100 : d.small ? 128 : 190));
                const off = !p || p.x < -200 || p.x > vw - ins.right - 30 || p.y < -100 || p.y > vh - ins.bottom - 10;
                const v = off ? "off" : `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, 0) scale(${Math.max(vw < 700 ? 0.45 : 0.6, Math.min(1, p.s * 1.25)).toFixed(3)})`;
                if (v === t.last) return;
                t.last = v;
                if (off) { t.el.style.visibility = "hidden"; return; }
                t.el.style.visibility = "";
                t.el.style.transform = v;
                t.el.style.zIndex = String(Math.round(p.y));
                t.el.classList.toggle("far", p.s < 0.42);
            });
        }

        const still = () => U.motion() === "still";
        function draw(t) {
            g.setTransform(dpr, 0, 0, dpr, 0, 0);
            F = frame();
            drawSea(still() ? 0 : t);
            drawRoad(t);
            const order = islands.map(d => d).sort((a, b) => a.y - b.y);
            for (const d of order) drawIsland(d, t);
            for (const p of opts.glimmers || []) drawGlimmer(p, t);
            placeTags();
        }
        // one frame: ease the camera toward its target, draw, and keep going while something moves
        function step(t) {
            raf = 0;
            if (!alive) return;
            const k = still() ? 1 : drag ? 1 : 0.14;
            cam.x += (cam.tx - cam.x) * k; cam.y += (cam.ty - cam.y) * k; cam.z += (cam.tz - cam.z) * k;
            let busy = Math.abs(cam.tx - cam.x) + Math.abs(cam.ty - cam.y) > 0.3 || Math.abs(cam.tz - cam.z) > 0.0015;
            if (!busy) { cam.x = cam.tx; cam.y = cam.ty; cam.z = cam.tz; }
            for (const d of islands) {
                const want = d.n === hoverI || d.n === focusI ? 1 : 0;
                if (Math.abs(d.hover - want) > 0.01) { d.hover += (want - d.hover) * (still() ? 1 : 0.2); busy = true; } else d.hover = want;
            }
            if (inertia && !drag) {
                cam.tx -= inertia.vx; cam.ty -= inertia.vy; clampCam();
                inertia.vx *= 0.9; inertia.vy *= 0.9;
                if (Math.abs(inertia.vx) + Math.abs(inertia.vy) < 0.2) inertia = null;
                busy = true;
            }
            const rising = t - born < islands.length * 40 + 900;
            calm = !busy && !drag && !pinch;
            // the scene's own life (the pages' light, the ring, the mist) runs on at 30 frames a second with full
            // effects; otherwise the canvas is only drawn while the camera or something else moves
            if (busy || rising || t - drawnAt > 31) {
                if (busy && drawnAt) settle(t - drawnAt);
                drawnAt = t;
                draw(t);
            }
            if (busy || rising || U.motion() === "full") raf = requestAnimationFrame(step);
        }
        // If moving frames come slower than about 45 a second, the canvas drops to fewer pixels (it starts at 1.25 per
        // CSS pixel at most: the plates are real text, so the canvas needn't be sharper than that)
        let drawnAt = 0, slow = 0, quality = 1.25;
        function settle(dt) {
            if (dt > 22 && dt < 200) slow++; else slow = Math.max(0, slow - 1);
            if (slow > 12 && quality > 0.75) { quality -= 0.25; slow = 0; resize(); }
        }
        function wake() { if (!raf && alive) raf = requestAnimationFrame(step); }

        function resize() {
            const r = host.getBoundingClientRect();
            vw = Math.max(1, r.width); vh = Math.max(1, r.height);
            dpr = Math.min(quality, window.devicePixelRatio || 1);
            canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
            fitCache = null;
            F = frame();
            clampCam();
            draw(performance.now());
            wake();
        }
        const ro = new ResizeObserver(resize);
        ro.observe(host);

        // ---- the pointer: drag to look around (pinch or wheel to zoom), a press that doesn't move picks ----
        function hit(sx, sy) {
            const order = islands.slice().sort((a, b) => b.y - a.y);
            for (const d of order) {
                if (d.box && sx >= d.box.x && sx <= d.box.x + d.box.w && sy >= d.box.y && sy <= d.box.y + d.box.h) return d;
                const e = ellipseAt(d.x, d.y, d.rock ? 90 : d.small ? 125 : 190, d.rock ? 76 : d.small ? 105 : 160);
                if (e && ((sx - e.x) / e.rx) ** 2 + ((sy - e.y) / e.ry) ** 2 <= 1.1) return d;
            }
            return null;
        }
        const local = e => { const r = host.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
        const pointers = new Map();
        let drag = null, pinch = null, inertia = null;
        host.addEventListener("pointerdown", e => {
            if (e.button) return;
            const [x, y] = local(e);
            pointers.set(e.pointerId, { x, y });
            inertia = null;
            if (pointers.size === 2) {
                const [a, b] = [...pointers.values()];
                pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: cam.tz };
                drag = null;
                return;
            }
            const u = unproject(x, y);
            drag = { x, y, moved: false, onTag: e.target.closest(".at-label"), sea: u ? [cam.tx + u.dx / cam.tz, cam.ty + u.dy / cam.tz] : null, last: [x, y, performance.now()], v: [0, 0] };
        });
        host.addEventListener("pointermove", e => {
            const [x, y] = local(e);
            if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x, y });
            if (pinch && pointers.size === 2) {
                const [a, b] = [...pointers.values()], dd = Math.hypot(a.x - b.x, a.y - b.y);
                const want = pinch.z * dd / pinch.d;
                zoomBy(want / cam.tz, (a.x + b.x) / 2, (a.y + b.y) / 2);
                return;
            }
            if (!drag) {
                if (e.pointerType === "mouse") { const d = hit(x, y); const i = d ? d.n : -1; if (i !== hoverI) { hoverI = i; host.classList.toggle("over", i >= 0); wake(); } }
                return;
            }
            if (!drag.moved && Math.hypot(x - drag.x, y - drag.y) < 8) return;
            if (!drag.moved) { drag.moved = true; host.classList.add("dragging"); try { host.setPointerCapture(e.pointerId); } catch (err) { /* the drag works without it */ } }
            const u = unproject(x, y);
            if (!u || !drag.sea) return;
            // the point of the sea that was under the pointer stays under it
            cam.tx = drag.sea[0] - u.dx / cam.tz; cam.ty = drag.sea[1] - u.dy / cam.tz;
            clampCam();
            const now = performance.now(), [lx, ly, lt] = drag.last, dt = Math.max(8, now - lt);
            const lu = unproject(lx, ly);
            if (lu) drag.v = [(u.dx - lu.dx) / cam.tz * 16 / dt, (u.dy - lu.dy) / cam.tz * 16 / dt];
            drag.last = [x, y, now];
            wake();
        });
        const drop = e => {
            pointers.delete(e.pointerId);
            if (pinch) { if (pointers.size < 2) pinch = null; drag = null; return; }
            if (!drag) return;
            const d0 = drag;
            drag = null;
            host.classList.remove("dragging");
            if (d0.moved) {
                if (performance.now() - d0.last[2] < 80 && !still()) inertia = { vx: d0.v[0], vy: d0.v[1] };
                wake();
                return;
            }
            if (e.type !== "pointerup") return;
            const [x, y] = local(e);
            const tag = d0.onTag && islands.find((d, n) => plates[n] && plates[n].el === d0.onTag);
            const d = tag || hit(x, y);
            if (d) opts.onPick(d);
        };
        host.addEventListener("pointerup", drop);
        host.addEventListener("pointercancel", drop);
        host.addEventListener("pointerleave", () => { if (hoverI >= 0 && !drag) { hoverI = -1; host.classList.remove("over"); wake(); } });
        // the wheel zooms around the pointer; turning it on toward you once fully zoomed in travels to the island
        let pushIn = 0;
        host.addEventListener("wheel", e => {
            e.preventDefault();
            const [x, y] = local(e), dy = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
            if (dy < 0 && cam.tz >= ZMAX - 0.001 && opts.onTravel) {
                pushIn += -dy;
                if (pushIn > 400) { pushIn = 0; opts.onTravel(); }
                return;
            }
            pushIn = 0;
            zoomBy(Math.exp(-dy * 0.0015), x, y);
        }, { passive: false });

        onReady = () => wake();
        resize();
        return {
            cam, look, fit, fitZ, zoomBy, wake,
            redraw() { if (alive) { draw(performance.now()); wake(); } },
            focus(i) {
                focusI = islands.findIndex(d => d.i === i && !d.rock);
                plates.forEach((t, n) => t && t.el.classList.toggle("focus", n === focusI));
                wake();
            },
            spot(i) { const d = islands.find(x => x.i === i && !x.rock); return d ? [d.x, d.y] : null; },
            plate(i) { const n = islands.findIndex(d => d.i === i && !d.rock); return n >= 0 && plates[n] ? plates[n].el : null; },
            destroy() { alive = false; cancelAnimationFrame(raf); ro.disconnect(); onReady = null; canvas.remove(); tags.remove(); }
        };
    }
    return { create, warm, thumb };
})();
