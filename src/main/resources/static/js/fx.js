// FX: the effects layer, a canvas over the whole page (clicks go through it).
//
//   FX.burst({...})        a burst of particles: confetti, sparks, stars, pixels, petals, snowflakes, leaves,
//                          acorns, circles
//   FX.add(effect)         any custom effect: { update(dt) -> false when finished, draw(ctx, W, H) }
//   FX.ring / flash / shake    shockwave rings, screen flashes, screen shakes
//   FX.toast({...})        a pop-up notice (achievements)
//   FX.countUp(el, n)      a number that counts up
//   FX.cinematic(run)      runs a skippable sequence (win animations, title cards); click or any key skips it
//   FX.transition(style, onCovered)   a full-screen wipe in the world's style

const FX = (() => {
    const cv = U.el("canvas", { class: "fx-layer", "aria-hidden": "true" });
    document.body.appendChild(cv);
    const g = cv.getContext("2d");
    let W = 0, H = 0, dpr = 1, raf = 0, last = 0;
    let parts = [], effects = [];

    function size() {
        dpr = Math.min(devicePixelRatio || 1, 2);
        W = innerWidth;
        H = innerHeight;
        cv.width = W * dpr;
        cv.height = H * dpr;
    }
    size();
    addEventListener("resize", size);

    function kick() {
        if (raf) return;
        lastSX = scrollX; lastSY = scrollY;
        last = performance.now();
        raf = requestAnimationFrame(loop);
    }
    // Particles and effects stay on what they were aimed at when the page scrolls (the snow inside the snow globe...):
    // particles are moved by the scroll, effects drawn shifted by however far the page moved since they started
    // (fixed: true for a full-screen one)
    let lastSX = scrollX, lastSY = scrollY;
    // ...or they follow an element: while FX.anchor(el) is on (a win animation runs with the board
    // as its anchor), new effects and bursts remember the element, which is measured again every frame. Effects are
    // drawn moved and scaled with it, particles moved with it, so the page shifting, a resize or the zoom setting
    // (and scrolling) don't leave them behind.
    let aim = null, fno = 0;
    function anchor(el) {
        const prev = aim;
        aim = el || null;
        return () => { if (aim === el) aim = prev; };
    }
    const anchorOf = el => {
        if (!el || !el.isConnected) return null;
        const r = el.getBoundingClientRect();
        return r.width ? { el, x: r.left, y: r.top, w: r.width, last: r, px: r.left, py: r.top, dx: 0, dy: 0, f: -1 } : null;
    };
    // an anchor's place this frame (measured once a frame; a removed element keeps its last place), and how far it moved
    function track(a) {
        if (a.f === fno) return a;
        a.f = fno;
        const r = a.el.isConnected ? a.el.getBoundingClientRect() : null;
        if (r && r.width) a.last = r;
        a.dx = a.last.left - a.px; a.dy = a.last.top - a.py;
        a.px = a.last.left; a.py = a.last.top;
        return a;
    }
    // One bad particle (a NaN size, a negative radius...) used to throw out of this loop before the next frame was
    // asked for: raf stayed set, kick() thought it was still running, and every burst after that never showed for
    // the rest of the visit. Now a particle
    // that throws is dropped, and the loop always carries on.
    function loop(now) {
        try { frame(now); }
        catch (err) { console.error(err); parts = []; born = []; }
        if (parts.length || effects.length) raf = requestAnimationFrame(loop);
        else { raf = 0; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); }
    }
    const safeStep = (p, dt) => { try { return stepParticle(p, dt); } catch (err) { return false; } };
    function frame(now) {
        const dt = U.clamp((now - last) / 1000, 0, 0.05);       // a frame can be stamped just before "last": never step backwards
        last = now;
        const sx = scrollX, sy = scrollY, mx = lastSX - sx, my = lastSY - sy;
        lastSX = sx; lastSY = sy;
        fno++;
        for (const p of parts) {
            let ox = mx, oy = my;
            if (p.an) { track(p.an); ox = p.an.dx; oy = p.an.dy; }
            if (!ox && !oy) continue;
            p.x += ox; p.y += oy;
            if (p.tr) for (let i = 0; i < p.tr.length; i += 2) { p.tr[i] += ox; p.tr[i + 1] += oy; }
        }
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, W, H);
        effects = effects.filter(e => {
            let alive = true;
            try {
                alive = e.update(dt) !== false;
                if (alive) {
                    g.save();
                    if (e.anchor) { const q = track(e.anchor).last, k = q.width / e.anchor.w; g.translate(q.left, q.top); g.scale(k, k); g.translate(-e.anchor.x, -e.anchor.y); }
                    else if (!e.fixed) g.translate(e.sx - sx, e.sy - sy);
                    e.draw(g, W, H); g.restore();
                }
            } catch (err) { console.error(err); alive = false; }
            return alive;
        });
        g.globalCompositeOperation = "source-over";
        parts = parts.filter(p => safeStep(p, dt));
        if (born.length) { parts = parts.concat(born); born = []; }
        let bad = null;
        for (const p of parts) {
            g.save();
            try { drawParticle(p); } catch (err) { (bad = bad || new Set()).add(p); }
            g.restore();
        }
        if (bad) parts = parts.filter(p => !bad.has(p));
        g.globalAlpha = 1;
        g.globalCompositeOperation = "source-over";
    }

    // ---- particles ----
    // Every particle pops in with a little overshoot and gets its own shade of its colour, and each
    // shape has more to it: glowing halos (cached sprites, so they're cheap), trails behind fast sparks and stars,
    // stars that twinkle and flash a cross-shaped glint, confetti with a darker back as it flips and a glint on its
    // edge, shaded round dots, petals and leaves with veins and light, snowflakes with branches and a sparkle, nuts with
    // a scaly cap, bubbles with a rainbow rim that pop into droplets, 8-bit pixels with lit and shadowed edges.
    const colorCache = new Map(), probe = document.createElement("canvas").getContext("2d");
    // any CSS colour (a name, #hex, rgb(), rgba()) as [r, g, b, a]
    function rgba(color) {
        let v = colorCache.get(color);
        if (v) return v;
        if (colorCache.size > 800) colorCache.clear();
        probe.fillStyle = "#000";
        probe.fillStyle = color;
        const s = probe.fillStyle;                      // the browser gives it back as "#rrggbb" or "rgba(r, g, b, a)"
        if (s[0] === "#") v = [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), 1];
        else { const m = s.match(/[\d.]+/g) || [0, 0, 0, 1]; v = [+m[0], +m[1], +m[2], m[3] != null ? +m[3] : 1]; }
        colorCache.set(color, v);
        return v;
    }
    const css = (v, a = v[3]) => `rgba(${v[0] | 0},${v[1] | 0},${v[2] | 0},${a})`;
    // a colour made lighter (k > 0, toward white) or darker (k < 0, toward black)
    function tint(color, k) {
        const v = rgba(color);
        return css(k >= 0 ? [v[0] + (255 - v[0]) * k, v[1] + (255 - v[1]) * k, v[2] + (255 - v[2]) * k] : [v[0] * (1 + k), v[1] * (1 + k), v[2] * (1 + k)], v[3]);
    }
    const sprites = new Map();
    function sprite(key, size, paint) {
        let s = sprites.get(key);
        if (s) return s;
        if (sprites.size > 400) sprites.clear();
        s = document.createElement("canvas");
        s.width = s.height = size;
        paint(s.getContext("2d"), size);
        sprites.set(key, s);
        return s;
    }
    // a soft glow: the colour fading out to nothing (fading to the same colour, so there's no dark fringe)
    const haloSprite = color => sprite("h" + color, 64, (c, n) => {
        const v = rgba(color), gr = c.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
        gr.addColorStop(0, css(v, 0.95)); gr.addColorStop(0.2, css(v, 0.6)); gr.addColorStop(0.5, css(v, 0.18)); gr.addColorStop(1, css(v, 0));
        c.fillStyle = gr;
        c.fillRect(0, 0, n, n);
    });
    // a little shaded ball: lit from the top left, darker at the rim, with a white highlight
    const ballSprite = color => sprite("b" + color, 48, (c, n) => {
        const gr = c.createRadialGradient(n * 0.37, n * 0.33, 1, n / 2, n / 2, n / 2 - 1);
        gr.addColorStop(0, tint(color, 0.6)); gr.addColorStop(0.45, color); gr.addColorStop(1, tint(color, -0.38));
        c.fillStyle = gr;
        c.beginPath(); c.arc(n / 2, n / 2, n / 2 - 1, 0, Math.PI * 2); c.fill();
        c.fillStyle = "rgba(255,255,255,.7)";
        c.beginPath(); c.ellipse(n * 0.35, n * 0.31, n * 0.12, n * 0.08, -0.6, 0, Math.PI * 2); c.fill();
    });
    // stars, snowflakes and acorns look the same all the way through their flight (they only turn and grow), so each
    // is drawn once per colour into a sprite and then just placed: far cheaper than drawing their paths every frame.
    // The sprite is 4 particle-radii across (a radius is 16 of its 64 px), with room for the glow.
    function starPath(c, x, y, r, rot, points = 5, inner = 0.45) {
        c.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const rr = i % 2 ? r * inner : r, a = rot + (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
            c[i ? "lineTo" : "moveTo"](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        c.closePath();
    }
    const starSprite = (color, light, glow) => sprite("s" + color + glow, 64, (c, n) => {
        const v = rgba(color), gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, css(v, glow ? 0.7 : 0.45)); gr.addColorStop(0.35, css(v, glow ? 0.3 : 0.16)); gr.addColorStop(1, css(v, 0));
        c.fillStyle = gr;
        c.fillRect(0, 0, n, n);
        c.fillStyle = color;
        starPath(c, 32, 32, 16, 0);
        c.fill();
        c.fillStyle = light;
        starPath(c, 32, 32, 8, 0);
        c.fill();
    });
    const flakeSprite = color => sprite("f" + color, 64, c => {
        const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, "rgba(223,241,255,.4)"); gr.addColorStop(1, "rgba(223,241,255,0)");
        c.fillStyle = gr;
        c.fillRect(0, 0, 64, 64);
        c.translate(32, 32);
        c.strokeStyle = color;
        c.lineWidth = 2.2;
        c.lineCap = "round";
        c.beginPath();
        for (let i = 0; i < 6; i++) {
            const an = i * Math.PI / 3, ca = Math.cos(an), sa = Math.sin(an);
            c.moveTo(0, 0);
            c.lineTo(ca * 16, sa * 16);
            for (const [at, len] of [[0.42, 0.3], [0.7, 0.2]]) for (const side of [-0.75, 0.75]) {
                c.moveTo(ca * 16 * at, sa * 16 * at);
                c.lineTo(ca * 16 * at + Math.cos(an + side) * 16 * len, sa * 16 * at + Math.sin(an + side) * 16 * len);
            }
        }
        c.stroke();
        c.fillStyle = "rgba(255,255,255,.9)";
        c.beginPath();
        for (let i = 0; i < 6; i++) { const an = i * Math.PI / 3; c[i ? "lineTo" : "moveTo"](Math.cos(an) * 2.9, Math.sin(an) * 2.9); }
        c.closePath();
        c.fill();
    });
    const acornSprite = (color, back) => sprite("a" + color, 64, c => {
        c.translate(32, 32);
        const s = 16;
        c.fillStyle = color;
        c.beginPath(); c.ellipse(0, s * 0.22, s * 0.55, s * 0.72, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = "rgba(255,255,255,.35)";
        c.beginPath(); c.ellipse(-s * 0.2, s * 0.08, s * 0.14, s * 0.3, 0.2, 0, Math.PI * 2); c.fill();
        c.fillStyle = back;
        c.beginPath(); c.arc(0, s * 0.9, s * 0.09, 0, Math.PI * 2); c.fill();
        c.fillStyle = "#6b4220";
        c.beginPath(); c.ellipse(0, -s * 0.18, s * 0.72, s * 0.44, 0, Math.PI, Math.PI * 2); c.closePath(); c.fill();
        c.strokeStyle = "rgba(40, 20, 6, .55)";
        c.lineWidth = 1.1;
        c.beginPath();
        for (const [x, y] of [[-0.4, -0.3], [0, -0.32], [0.4, -0.3], [-0.2, -0.48], [0.2, -0.48]]) { c.moveTo((x - 0.13) * s, y * s); c.quadraticCurveTo(x * s, (y + 0.12) * s, (x + 0.13) * s, y * s); }
        c.stroke();
        c.fillStyle = "#5a3618";
        c.fillRect(-s * 0.08, -s * 0.8, s * 0.16, s * 0.26);
    });
    // place a sprite (4 radii across) at x, y, turned by rot, for a particle of radius r
    function place(img, x, y, r, rot) {
        const c = Math.cos(rot), sn = Math.sin(rot);
        g.setTransform(c * dpr, sn * dpr, -sn * dpr, c * dpr, x * dpr, y * dpr);
        g.drawImage(img, -r * 2, -r * 2, r * 4, r * 4);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    // a bubble's rainbow rim, made once (in a bubble's own space: it's drawn as a circle of radius 1, then scaled)
    let rimGrad = null;
    function rim() {
        if (rimGrad) return rimGrad;
        rimGrad = g.createLinearGradient(-1, -1, 1, 1);
        rimGrad.addColorStop(0, "rgba(190,240,255,.95)"); rimGrad.addColorStop(0.42, "rgba(255,190,240,.95)"); rimGrad.addColorStop(0.68, "rgba(180,255,235,.95)"); rimGrad.addColorStop(1, "rgba(190,230,255,.95)");
        return rimGrad;
    }
    // text and emoji, drawn once each (with a soft shadow) and then just placed: drawing an emoji is slow
    const textSprite = (text, color) => sprite("t" + text + color, 80, (c, n) => {
        c.font = "56px sans-serif";
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillStyle = color;
        c.shadowColor = "rgba(0,0,0,.3)";
        c.shadowBlur = 8;
        c.shadowOffsetY = 3;
        c.fillText(text, n / 2, n / 2);
    });
    function halo(x, y, r, color, a) {
        if (a <= 0.01 || r < 1) return;
        const op = g.globalCompositeOperation, ga = g.globalAlpha;
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = Math.min(1, a);
        g.drawImage(haloSprite(color), x - r, y - r, r * 2, r * 2);
        g.globalCompositeOperation = op;
        g.globalAlpha = ga;
    }
    // a cross-shaped glint (two thin diamonds), like light catching something shiny
    function flare(x, y, len, a) {
        if (a <= 0.02) return;
        const op = g.globalCompositeOperation, ga = g.globalAlpha, w = len * 0.09;
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = Math.min(1, a);
        g.fillStyle = "rgba(255,255,255,.95)";
        g.beginPath();
        g.moveTo(x - len, y); g.lineTo(x, y - w); g.lineTo(x + len, y); g.lineTo(x, y + w); g.closePath();
        g.moveTo(x, y - len * 0.8); g.lineTo(x + w, y); g.lineTo(x, y + len * 0.8); g.lineTo(x - w, y); g.closePath();
        g.fill();
        g.globalCompositeOperation = op;
        g.globalAlpha = ga;
    }
    let born = [];                                      // particles made while the others are being stepped (a bubble's droplets)
    function stepParticle(p, dt) {
        p.age += dt;
        if (p.age >= p.life) { if (p.shape === "bubble" && !p.popped) popBubble(p); return false; }
        if (p.delay > 0) { p.delay -= dt; p.age = 0; return true; }
        p.vx *= 1 - p.drag * dt;
        p.vy = p.vy * (1 - p.drag * dt) + p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.flip += p.vf * dt;
        if (p.wobble) p.x += Math.sin(p.age * 3 + p.seed) * p.wobble * dt;
        if (p.tr) { p.tr.push(p.x, p.y); if (p.tr.length > p.trail * 2) p.tr.splice(0, 2); }
        return true;
    }
    // a bubble at the end of its life pops: a little ring and a few droplets
    function popBubble(p) {
        p.popped = true;
        if (U.motion() !== "full") return;
        const base = { x: p.x, y: p.y, gravity: 0, drag: 0, age: 0, delay: 0, rot: 0, vr: 0, flip: 0, vf: 0, alpha: p.alpha, fade: true, glow: false, shrink: false, wobble: 0, seed: 0, text: "", color: p.color, back: p.back, light: p.light, hot: p.hot };
        born.push({ ...base, vx: 0, vy: 0, life: 0.28, size: p.size * 0.7, shape: "pop" });
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + Math.random() * 0.5, sp = U.rand(60, 150);
            born.push({ ...base, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, gravity: 260, drag: 1.5, life: U.rand(0.25, 0.45), size: U.rand(1, 1.8), shape: "circle", shrink: true });
        }
    }
    function star(x, y, r, rot, points = 5, inner = 0.45) {
        g.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const rr = i % 2 ? r * inner : r, a = rot + (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
            const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
            if (i) g.lineTo(px, py); else g.moveTo(px, py);
        }
        g.closePath();
    }
    // a fading trail along where it's been: a thin line from the oldest point, a thicker one over the newest half
    function drawTrail(p, s, a) {
        const t = p.tr, n = t.length / 2, mid = Math.floor(n / 2);
        g.lineCap = "round";
        g.lineJoin = "round";
        g.strokeStyle = p.color;
        g.globalAlpha = a * 0.22;
        g.lineWidth = Math.max(0.6, s * 0.45);
        g.beginPath();
        g.moveTo(t[0], t[1]);
        for (let i = 1; i < n; i++) g.lineTo(t[i * 2], t[i * 2 + 1]);
        g.stroke();
        g.globalAlpha = a * 0.4;
        g.lineWidth = Math.max(0.8, s * 0.8);
        g.beginPath();
        g.moveTo(t[mid * 2], t[mid * 2 + 1]);
        for (let i = mid + 1; i < n; i++) g.lineTo(t[i * 2], t[i * 2 + 1]);
        g.stroke();
        g.globalAlpha = a;
    }
    const TAU = Math.PI * 2;
    function drawParticle(p) {
        if (p.delay > 0) return;
        const k = p.age / p.life;
        const a = (p.fade ? Math.min(1, (1 - k) * 2.2) : 1) * p.alpha;
        // it pops into being: a quick grow with a little overshoot
        const grow = Math.min(1, p.age / 0.12), pin = grow < 1 ? Math.max(0, U.ease.outBack(grow)) : 1;
        const s = p.size * (p.shrink ? 1 - k * 0.7 : 1) * pin;
        if (s <= 0.05 || a <= 0.005) return;
        g.globalAlpha = a;
        g.globalCompositeOperation = p.glow ? "lighter" : "source-over";
        if (p.tr && p.tr.length > 4) drawTrail(p, s, a);
        if (p.glow && p.shape !== "spark" && p.shape !== "star") halo(p.x, p.y, s * 3.2, p.color, a * 0.5);
        g.fillStyle = p.color;
        g.strokeStyle = p.color;
        switch (p.shape) {
            case "rect": {                           // confetti: a little paper rectangle tumbling in 3D
                const c = Math.cos(p.rot), sn = Math.sin(p.rot), f = Math.cos(p.flip);
                g.setTransform(c * dpr, sn * dpr, -sn * f * dpr, c * f * dpr, p.x * dpr, p.y * dpr);
                g.fillStyle = f >= 0 ? p.color : p.back;              // its back is a shade darker
                g.fillRect(-s / 2, -s * 0.3, s, s * 0.6);
                if (f > 0.4) { g.fillStyle = "rgba(255,255,255,.4)"; g.fillRect(-s / 2, -s * 0.3, s, s * 0.13); }   // light along the top edge
                else if (f < -0.4) { g.fillStyle = "rgba(0,0,0,.12)"; g.fillRect(-s / 2, s * 0.17, s, s * 0.13); }
                g.setTransform(dpr, 0, 0, dpr, 0, 0);
                break;
            }
            case "pixel": {                          // an 8-bit block: lit top and left, shadowed bottom and right
                const x = Math.round(p.x - s / 2), y = Math.round(p.y - s / 2), q = Math.max(1, Math.round(s / 4));
                if (p.glow) halo(p.x, p.y, s * 2.4, p.color, a * 0.45);
                g.fillRect(x, y, s, s);
                g.fillStyle = p.light; g.fillRect(x, y, s, q); g.fillRect(x, y, q, s);
                g.fillStyle = p.back; g.fillRect(x, y + s - q, s, q); g.fillRect(x + s - q, y, q, s);
                break;
            }
            case "star": {                           // it twinkles: a glow, a bright middle, a cross glint at each peak
                const tw = 1 + Math.sin(p.age * 13 + p.seed * 3) * 0.16, r = s * tw;
                place(starSprite(p.color, p.light, p.glow), p.x, p.y, r, p.rot);
                if (tw > 1.1) flare(p.x, p.y, r * 2.1, a * (tw - 1.1) / 0.06);
                break;
            }
            case "spark": {                          // a streak along its path, fading at the tail, white-hot at the head
                const sp = Math.hypot(p.vx, p.vy), len = Math.min(46, sp * 0.06 + 3), ang = Math.atan2(p.vy, p.vx);
                const tx = p.x - Math.cos(ang) * len, ty = p.y - Math.sin(ang) * len;
                const gr = g.createLinearGradient(tx, ty, p.x, p.y);
                gr.addColorStop(0, css(rgba(p.color), 0));
                gr.addColorStop(1, p.color);
                g.strokeStyle = gr;
                g.lineWidth = s;
                g.lineCap = "round";
                g.beginPath(); g.moveTo(tx, ty); g.lineTo(p.x, p.y); g.stroke();
                g.fillStyle = p.hot;
                g.beginPath(); g.arc(p.x, p.y, s * 0.55, 0, TAU); g.fill();
                halo(p.x, p.y, s * 3, p.color, a * 0.5);
                break;
            }
            case "petal": {                          // round at the base, a notch at the tip, a crease, light near the tip
                g.save();
                g.translate(p.x, p.y);
                g.rotate(p.rot);
                const sy = Math.abs(Math.cos(p.flip)) * 0.8 + 0.2;
                g.scale(1, sy);
                g.beginPath();
                g.moveTo(-s, 0);
                g.bezierCurveTo(-s * 0.6, -s * 0.78, s * 0.75, -s * 0.72, s, -s * 0.14);
                g.lineTo(s * 0.78, 0);
                g.lineTo(s, s * 0.14);
                g.bezierCurveTo(s * 0.75, s * 0.72, -s * 0.6, s * 0.78, -s, 0);
                g.fillStyle = sy > 0.55 ? p.color : p.back;
                g.fill();
                g.globalAlpha = a * 0.5;
                g.fillStyle = p.light;
                g.beginPath(); g.ellipse(s * 0.28, -s * 0.12, s * 0.48, s * 0.2, 0, 0, TAU); g.fill();
                g.globalAlpha = a * 0.7;
                g.strokeStyle = p.back;
                g.lineWidth = Math.max(0.5, s * 0.07);
                g.beginPath(); g.moveTo(-s * 0.85, 0); g.quadraticCurveTo(0, s * 0.07, s * 0.62, 0); g.stroke();
                g.restore();
                break;
            }
            case "flake": {                          // six arms with two pairs of branches, a hexagon middle, a sparkle
                place(flakeSprite(p.color), p.x, p.y, s, p.rot);
                if (Math.sin(p.age * 6 + p.seed) > 0.88) flare(p.x, p.y, s * 1.5, a * 0.8);
                break;
            }
            case "leaf": {                           // a pointed leaf with a stem, a vein and side veins, lit on one half
                g.save();
                g.translate(p.x, p.y);
                g.rotate(p.rot);
                const turn = Math.cos(p.flip);
                g.scale(1, Math.abs(turn) * 0.85 + 0.15);
                g.beginPath();
                g.moveTo(-s, 0);
                g.quadraticCurveTo(-s * 0.1, -s * 0.66, s, 0);
                g.quadraticCurveTo(-s * 0.1, s * 0.66, -s, 0);
                g.fillStyle = turn >= 0 ? p.color : p.back;
                g.fill();
                g.globalAlpha = a * 0.32;
                g.fillStyle = p.light;
                g.beginPath();
                g.moveTo(-s, 0);
                g.quadraticCurveTo(-s * 0.1, -s * 0.66, s, 0);
                g.closePath();
                g.fill();
                g.globalAlpha = a;
                g.strokeStyle = "rgba(60, 28, 8, .42)";
                g.lineWidth = Math.max(0.6, s * 0.08);
                g.beginPath();
                g.moveTo(-s * 1.32, 0); g.lineTo(s * 0.85, 0);
                for (const x of [-0.45, 0, 0.42]) for (const side of [-1, 1]) { g.moveTo(x * s, 0); g.lineTo((x + 0.32) * s, side * s * 0.3); }
                g.stroke();
                g.restore();
                break;
            }
            case "acorn":                            // a shiny nut under a scaly cap, with a stem
                place(acornSprite(p.color, p.back), p.x, p.y, s, p.rot);
                break;
            case "bubble": {                         // a see-through bubble with a rainbow rim and two highlights
                const wob = 1 + Math.sin(p.age * 9 + p.seed) * 0.06, rx = s * wob, ry = s / wob;
                g.save();
                g.translate(p.x, p.y);
                g.scale(rx, ry);
                g.beginPath();
                g.arc(0, 0, 1, 0, TAU);
                g.globalAlpha = a * 0.16;
                g.fill();
                g.globalAlpha = a;
                g.strokeStyle = rim();
                g.lineWidth = Math.max(1 / s, 0.11);
                g.stroke();
                g.restore();
                g.fillStyle = "rgba(255,255,255,.9)";
                g.beginPath(); g.ellipse(p.x - rx * 0.38, p.y - ry * 0.4, s * 0.24, s * 0.13, -0.7, 0, TAU); g.fill();
                g.beginPath(); g.arc(p.x + rx * 0.42, p.y + ry * 0.4, s * 0.08, 0, TAU); g.fill();
                break;
            }
            case "pop":                              // what's left of a popped bubble: a ring that spreads and fades
                g.lineWidth = Math.max(0.6, 1.8 * (1 - k));
                g.globalAlpha = a * (1 - k);
                g.beginPath(); g.arc(p.x, p.y, s * (1 + k * 2.4), 0, TAU); g.stroke();
                break;
            case "text": {                           // (56 px in an 80 px sprite: s is the font size)
                const c = Math.cos(p.rot), sn = Math.sin(p.rot), w = s * 80 / 56;
                g.setTransform(c * dpr, sn * dpr, -sn * dpr, c * dpr, p.x * dpr, p.y * dpr);
                g.drawImage(textSprite(p.text, p.color), -w / 2, -w / 2, w, w);
                g.setTransform(dpr, 0, 0, dpr, 0, 0);
                break;
            }
            default:                                 // circle: a shaded little ball (a glowing one is a hot core in its halo)
                if (p.glow) { g.fillStyle = p.hot; g.beginPath(); g.arc(p.x, p.y, s * 0.8, 0, TAU); g.fill(); }
                else if (s < 2.5) { g.beginPath(); g.arc(p.x, p.y, s, 0, TAU); g.fill(); }
                else g.drawImage(ballSprite(p.color), p.x - s, p.y - s, s * 2, s * 2);
        }
    }
    const range = (r, d) => (Array.isArray(r) ? U.rand(r[0], r[1]) : r ?? d);

    // burst({ x, y, n, colors, shape, speed:[a,b], angle, spread, gravity, life:[a,b], size:[a,b], trail, ... })
    function burst(o) {
        const lite = U.motion() === "lite";
        if (U.motion() === "still") return;
        const n = Math.round((o.n || 30) * (lite ? 0.45 : 1));
        const colors = o.colors || ["#ffffff"];
        const shape = o.shape || "rect";
        // fast, bright things leave a trail (not in Lite effects)
        const trail = lite ? 0 : o.trail ?? (shape === "star" ? 5 : shape === "circle" && o.glow ? 6 : 0);
        const an = o.fixed ? null : anchorOf(aim);
        if (an) an.f = fno;                                  // (measured just now)
        for (let i = 0; i < n; i++) {
            const a = o.angle != null ? o.angle + U.rand(-1, 1) * (o.spread ?? Math.PI) : Math.random() * Math.PI * 2;
            const sp = range(o.speed, 300) * (o.even ? 1 : U.rand(0.35, 1));
            const shadeK = [-0.12, 0, 0.14][i % 3], base = colors[i % colors.length];
            const color = shadeK && shape !== "text" ? tint(base, shadeK) : base;      // each one a slightly different shade
            parts.push({
                x: (o.x ?? W / 2) + U.rand(-1, 1) * (o.jitter || 0), y: (o.y ?? H / 2) + U.rand(-1, 1) * (o.jitterY ?? o.jitter ?? 0),
                vx: Math.cos(a) * sp + (o.vx || 0), vy: Math.sin(a) * sp + (o.vy || 0),
                gravity: o.gravity ?? 600, drag: o.drag ?? 1.2, life: range(o.life, 1.4), age: 0, delay: range(o.delay, 0),
                size: range(o.size, 8), color, back: tint(color, -0.32), light: tint(color, 0.5), hot: tint(color, 0.78), shape,
                rot: Math.random() * 6.28, vr: U.rand(-1, 1) * (o.spin ?? 8), flip: Math.random() * 6.28, vf: U.rand(4, 12),
                alpha: o.alpha ?? 1, fade: o.fade ?? true, glow: !!o.glow, shrink: !!o.shrink, wobble: o.wobble || 0,
                trail, tr: trail ? [] : null,
                seed: Math.random() * 10, text: o.text ? (Array.isArray(o.text) ? U.pick(o.text) : o.text) : "", an
            });
        }
        kick();
    }

    function add(effect) {
        effect.sx = scrollX; effect.sy = scrollY;
        if (!effect.fixed && !effect.anchor) effect.anchor = anchorOf(aim);
        effects.push(effect);
        kick();
        return effect;
    }

    // An expanding shockwave ring: a soft outer glow, the ring itself, a thin bright ring just inside it, and glints
    // of light scattered round it
    function ring({ x = W / 2, y = H / 2, color = "#fff", r0 = 10, r1 = 300, dur = 0.7, width = 10, glow = true } = {}) {
        if (U.motion() === "still") return;
        let t = 0;
        const glints = Array.from({ length: U.motion() === "lite" ? 0 : 9 }, () => ({ a: Math.random() * Math.PI * 2, d: U.rand(0.9, 1.08), s: U.rand(0.6, 1.2) }));
        add({
            update: dt => (t += dt) < dur,
            draw(c) {
                const k = t / dur, e = U.ease.outCubic(k), r = U.lerp(r0, r1, e), w = width * (1 - k * 0.7);
                c.globalCompositeOperation = glow ? "lighter" : "source-over";
                c.strokeStyle = color;
                c.globalAlpha = (1 - k) * 0.28;
                c.lineWidth = w * 2.6;
                c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
                c.globalAlpha = 1 - k;
                c.lineWidth = w;
                c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
                c.globalAlpha = (1 - k) * 0.7;
                c.strokeStyle = "rgba(255,255,255,.9)";
                c.lineWidth = Math.max(1, w * 0.25);
                c.beginPath(); c.arc(x, y, Math.max(1, r - w * 0.9), 0, Math.PI * 2); c.stroke();
                for (const gl of glints) {
                    const gx = x + Math.cos(gl.a) * r * gl.d, gy = y + Math.sin(gl.a) * r * gl.d, a = (1 - k) * gl.s;
                    c.globalAlpha = Math.min(1, a);
                    c.drawImage(haloSprite(color), gx - w * 1.6, gy - w * 1.6, w * 3.2, w * 3.2);
                }
                c.globalAlpha = 1;
                c.globalCompositeOperation = "source-over";
            }
        });
    }

    // A full-screen flash of colour that fades away
    function flash(color = "#fff", dur = 450, peak = 0.9) {
        if (U.motion() === "still") return;
        const d = U.el("div", { class: "fx-flash", "aria-hidden": "true" },
            U.el("i", { class: "fx-flash-sheet", style: { background: color } }),
            U.el("i", { class: "fx-flash-core", style: { background: `radial-gradient(ellipse at 50% 45%, ${color} 0%, ${color} 18%, transparent 72%)` } }));
        document.body.appendChild(d);
        d.animate([{ opacity: peak }, { opacity: 0 }], { duration: dur, easing: "ease-out" }).onfinish = () => d.remove();
    }

    // Shake the page (the #app element) for a moment
    function shake(power = 10, dur = 380, target) {
        if (U.motion() !== "full") return;
        const node = target || document.getElementById("app");
        const frames = [];
        for (let i = 0; i <= 8; i++) {
            const k = 1 - i / 8, p = power * k;
            frames.push({ transform: i === 8 ? "none" : `translate(${U.rand(-p, p).toFixed(1)}px, ${U.rand(-p, p).toFixed(1)}px) rotate(${U.rand(-p, p) * 0.03}deg)` });
        }
        node.animate(frames, { duration: dur, easing: "linear" });
    }

    // ---- toasts ----
    const toasts = U.el("div", { class: "toasts", "aria-live": "polite" });
    document.body.appendChild(toasts);
    function toast({ icon = "★", kicker = "", title = "", text = "", cls = "", ms = 4200 }) {
        const node = U.el("div", { class: "toast " + cls },
            U.el("span", { class: "toast-icon", text: icon }),
            U.el("div", { class: "toast-body" },
                kicker ? U.el("small", { text: kicker }) : null,
                U.el("b", { text: title }),
                text ? U.el("span", { text }) : null));
        toasts.appendChild(node);
        requestAnimationFrame(() => node.classList.add("in"));
        setTimeout(() => { node.classList.remove("in"); node.classList.add("out"); setTimeout(() => node.remove(), 500); }, ms);
        return node;
    }

    // ---- numbers that count up ----
    function countUp(node, to, { dur = 900, fmt = v => String(Math.round(v)), from = 0, onStep } = {}) {
        if (U.motion() === "still") { node.textContent = fmt(to); return Promise.resolve(); }
        return new Promise(resolve => {
            const t0 = performance.now();
            (function tick(now) {
                const k = Math.min(1, (now - t0) / dur), v = from + (to - from) * U.ease.outCubic(k);
                node.textContent = fmt(v);
                if (onStep) onStep(v);
                if (k < 1) requestAnimationFrame(tick); else resolve();
            })(t0);
        });
    }

    // ---- cinematics: skippable sequences. run(c) is an async function that uses `await c.wait(ms)` between
    //      beats and c.cleanup(fn) to register clean-up. A click or key press skips straight to the end. ----
    let playing = 0;
    function cinematic(run) {
        return new Promise(resolve => {
            const timers = [], cleanups = [];
            let finished = false;
            const c = {
                skipped: false,
                wait: ms => new Promise(r => { if (c.skipped) return r(); const id = setTimeout(r, ms); timers.push([id, r]); }),
                cleanup: fn => cleanups.push(fn),
                // like setTimeout, but nothing happens if the cinematic was skipped (so no stray sounds after a skip)
                later: (fn, ms) => { const id = setTimeout(() => { if (!c.skipped) fn(); }, ms); timers.push([id, () => {}]); }
            };
            const skip = () => {
                if (finished || c.skipped) return;
                c.skipped = true;
                for (const [id, r] of timers) { clearTimeout(id); r(); }
                parts = [];
            };
            const onKey = e => { if (!e.ctrlKey && !e.metaKey && !e.altKey) skip(); };
            const armId = setTimeout(() => {
                addEventListener("pointerdown", skip, true);
                addEventListener("keydown", onKey, true);
            }, 250);
            playing++;
            document.documentElement.classList.add("cinematic");
            Promise.resolve()
                .then(() => run(c))
                .catch(err => console.error("cinematic", err))
                .finally(() => {
                    finished = true;
                    clearTimeout(armId);
                    removeEventListener("pointerdown", skip, true);
                    removeEventListener("keydown", onKey, true);
                    for (const fn of cleanups) { try { fn(); } catch (err) { console.error(err); } }
                    playing--;
                    if (!playing) document.documentElement.classList.remove("cinematic");
                    resolve(c.skipped);
                });
        });
    }

    // ---- full-screen transitions in each world's style ----
    // style: "page" (a sheet of paper slides over), "warp" (stars streak, white-out), "leaves" (a wall of leaves
    // sweeps across), "autumn" (the same in fall colors), "blizzard" (a snowstorm blows in to a white-out),
    // "tide" (water rises with bubbles), "frosting" (pink frosting drips down over the screen),
    // "pages" (book pages pile up), "lava" (lava rises, then cools), "clouds" (clouds billow in, then part),
    // "sandstorm", "shutter" (blast doors), "curtain" (velvet stage curtains), "downpour" (rain, then a wiper), "rift" (a golden tear opens and seals),
    // "pixels" (blocks fill in), "iris" (a closing circle). onCovered runs while all is hidden.
    function transition(style, onCovered) {
        if (U.motion() === "still") { onCovered && onCovered(); return Promise.resolve(); }
        const IN = 0.5, HOLD = 0.12, OUT = 0.55;
        const css = getComputedStyle(document.documentElement);
        const col = name => css.getPropertyValue(name).trim() || "#000";
        const C = { bg: col("--bg"), accent: col("--accent"), accent2: col("--accent-2"), ink: col("--ink"), surface: col("--surface-solid") };
        const cells = [], leaves = [], streaks = [], flakes = [];
        // leaf colors: the wall, two inner shades, the vein, and the tumbling edge leaves
        const P = style === "autumn"
            ? { wall: "#7a3a17", deep: "#6a3214", mid: "#934819", vein: "rgba(70, 25, 5, .4)", edge: ["#d9531e", "#f2a03d", "#b8321a", "#e8c547", "#9c5a2a"] }
            : { wall: "#2f6a33", deep: "#285c2b", mid: "#357a36", vein: "rgba(20, 60, 20, .35)", edge: ["#3f8f3a", "#4fa344", "#2f7a31", "#5cb04c", "#77b35f"] };
        const SZ = 56;
        for (let y = 0; y < Math.ceil(H / SZ) + 1; y++) for (let x = 0; x < Math.ceil(W / SZ) + 1; x++) cells.push({ x, y, k: Math.random() * 0.6 + (x + y) / (W / SZ + H / SZ) * 0.4 });
        for (let i = 0; i < 160; i++) leaves.push({ y: U.rand(-0.1, 1.1), x: Math.random(), off: U.rand(-0.35, 0.35), r: U.rand(26, 70), rot: U.rand(0, 6.28), spin: U.rand(-2.5, 2.5), c: P.edge[i % 5] });
        for (let i = 0; i < 280; i++) flakes.push({ x: Math.random(), y: Math.random(), sp: U.rand(0.6, 1.8), r: U.rand(1, 4.5), ph: Math.random() * 6.28 });
        // a pointed leaf with a center vein
        const leaf = (c, x, y, r, rot, fill) => {
            c.save();
            c.translate(x, y);
            c.rotate(rot);
            c.fillStyle = fill;
            c.beginPath();
            c.moveTo(-r, 0);
            c.quadraticCurveTo(-r * 0.1, -r * 0.62, r, 0);
            c.quadraticCurveTo(-r * 0.1, r * 0.62, -r, 0);
            c.fill();
            c.strokeStyle = P.vein;
            c.lineWidth = Math.max(1, r * 0.05);
            c.beginPath();
            c.moveTo(-r * 0.85, 0);
            c.lineTo(r * 0.85, 0);
            c.stroke();
            c.restore();
        };
        for (let i = 0; i < 220; i++) streaks.push({ a: Math.random() * 6.28, d: U.rand(0.05, 1), sp: U.rand(0.6, 1.6) });
        let t = 0, covered = false;
        return new Promise(resolve => {
            add({
                update(dt) {
                    t += dt;
                    if (!covered && t >= IN) { covered = true; try { onCovered && onCovered(); } catch (err) { console.error(err); } }
                    if (t >= IN + HOLD + OUT) { resolve(); return false; }
                },
                draw(c) {
                    // k: 0 -> 1 while covering, stays 1 during the hold, then 1 -> 0 while uncovering
                    const k = t < IN ? U.ease.inOutCubic(t / IN) : t < IN + HOLD ? 1 : 1 - U.ease.inOutCubic((t - IN - HOLD) / OUT);
                    const leaving = t >= IN + HOLD;
                    if (style === "fade") {
                        // the Classic page: a quick, plain fade through the page colour
                        c.fillStyle = C.bg;
                        c.globalAlpha = k;
                        c.fillRect(0, 0, W, H);
                        c.globalAlpha = 1;
                    } else if (style === "pixels") {
                        for (const cell of cells) {
                            const on = leaving ? cell.k < k : cell.k < k;
                            if (!on) continue;
                            c.fillStyle = (cell.x + cell.y) % 7 === 0 ? C.accent : (cell.x * 3 + cell.y) % 11 === 0 ? C.accent2 : C.bg;
                            c.fillRect(cell.x * SZ, cell.y * SZ, SZ + 1, SZ + 1);
                        }
                    } else if (style === "tide") {
                        // the water rises from the bottom with a wavy surface and bubbles, then drains away
                        const level = H * (1.08 - k * 1.2);
                        const wg = c.createLinearGradient(0, level, 0, H);
                        wg.addColorStop(0, "#3fc4dc");
                        wg.addColorStop(0.3, "#1679b0");
                        wg.addColorStop(1, "#0a3a6b");
                        c.fillStyle = wg;
                        c.beginPath();
                        c.moveTo(0, H);
                        for (let x = 0; x <= W + 20; x += 20) c.lineTo(x, level + Math.sin(x * 0.012 + t * 6) * 16 + Math.sin(x * 0.031 - t * 4) * 7);
                        c.lineTo(W, H);
                        c.fill();
                        c.strokeStyle = "rgba(255,255,255,.7)";
                        c.lineWidth = 3;
                        c.beginPath();
                        for (let x = 0; x <= W + 20; x += 20) c[x ? "lineTo" : "moveTo"](x, level + Math.sin(x * 0.012 + t * 6) * 16 + Math.sin(x * 0.031 - t * 4) * 7);
                        c.stroke();
                        c.strokeStyle = "rgba(255,255,255,.6)";
                        c.lineWidth = 1.5;
                        for (const f of flakes) {
                            const y = H - ((f.y + t * 0.5 * f.sp) % 1) * H * 1.1;
                            if (y < level + 10) continue;
                            c.beginPath();
                            c.arc(f.x * W + Math.sin(t * 5 + f.ph) * 6, y, f.r * 1.6, 0, Math.PI * 2);
                            c.stroke();
                        }
                    } else if (style === "frosting") {
                        // pink frosting drips down from the top until it covers everything, then slides off the bottom
                        const p = leaving ? 1 + (1 - k) : k;
                        const edge = p <= 1 ? p * H * 1.25 : H * 1.25 + (p - 1) * H * 1.3;
                        const top = p <= 1 ? -20 : (p - 1) * H * 1.3 - 20;
                        c.fillStyle = "#ff9ec7";
                        c.beginPath();
                        c.moveTo(0, top);
                        c.lineTo(W, top);
                        for (let i = flakes.length > 40 ? 40 : flakes.length, x = W; i > 0; i--) {
                            const f = flakes[i], w = W / 40, drip = (0.05 + f.r * 0.035) * H;
                            c.lineTo(x, edge - drip * 0.3);
                            c.quadraticCurveTo(x - w * 0.5, edge + drip, x - w, edge - drip * 0.3);
                            x -= w;
                        }
                        c.closePath();
                        c.fill();
                        c.fillStyle = "rgba(255,255,255,.35)";
                        c.fillRect(0, top, W, Math.max(0, edge - top) * 0.04);
                        const sprinkle = ["#ffd23f", "#3ec1d3", "#7cdc5a", "#ffffff", "#a26bff", "#ff5c8a"];
                        for (let i = 0; i < flakes.length; i++) {
                            const f = flakes[i], y = top + f.y * (edge - top) * 0.92;
                            if (y < top || y > edge - 20) continue;
                            c.save();
                            c.translate(f.x * W, y);
                            c.rotate(f.ph * 3);
                            c.fillStyle = sprinkle[i % sprinkle.length];
                            c.fillRect(-5, -1.6, 10, 3.2);
                            c.restore();
                        }
                    } else if (style === "pages") {
                        // loose book pages flutter in from the right and pile up into a parchment wall, then blow off left
                        const p = leaving ? 1 + (1 - k) : k;
                        const shift = p <= 1 ? 0 : -(p - 1) * W * 1.6;
                        c.fillStyle = `rgba(233, 219, 186, ${Math.min(1, p <= 1 ? k * 1.15 : 1).toFixed(3)})`;
                        c.fillRect(shift, 0, W, H);
                        for (const l of leaves) {
                            const arrive = l.x * 0.8;                                   // when this page lands
                            const q = U.clamp((Math.min(p, 1) - arrive) / 0.25, 0, 1);
                            if (q <= 0) continue;
                            const x = U.lerp(W * 1.2, l.x * W, U.ease.outCubic(q)) + shift * (1 + l.off), y = l.y * H + Math.sin(t * 3 + l.rot) * 12 * (1 - q);
                            c.save();
                            c.translate(x, y);
                            c.rotate(l.rot * 0.3 + (1 - q) * l.spin + (p > 1 ? (p - 1) * l.spin : 0));
                            c.scale(1, 0.7 + 0.3 * Math.abs(Math.cos(t * 4 + l.rot)));
                            const w = l.r * 1.5, h = l.r * 1.9;
                            c.fillStyle = l.c === P.edge[0] ? "#f6ecd2" : "#efe2c2";
                            c.fillStyle = "rgba(60,40,10,.18)"; c.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
                            c.fillStyle = l.c === P.edge[0] ? "#f6ecd2" : "#efe2c2";
                            c.fillRect(-w / 2, -h / 2, w, h);
                            c.strokeStyle = "rgba(90,70,40,.35)"; c.lineWidth = 1;
                            for (let yy = -h / 2 + 8; yy < h / 2 - 5; yy += 6) { c.beginPath(); c.moveTo(-w / 2 + 6, yy); c.lineTo(w / 2 - 6 - (yy * 7 % 9), yy); c.stroke(); }
                            c.restore();
                        }
                    } else if (style === "lava") {
                        // glowing lava rises from the bottom, then cools to dark rock that sinks away
                        const p = leaving ? 1 + (1 - k) : k;
                        const level = p <= 1 ? H * (1.1 - p * 1.25) : -H * 0.15 + (p - 1) * H * 1.3;
                        const cool = p <= 1 ? 0 : Math.min(1, (p - 1) * 2.5);
                        const lg = c.createLinearGradient(0, level, 0, level + H);
                        lg.addColorStop(0, cool ? `rgb(${Math.round(255 - cool * 200)},${Math.round(200 - cool * 160)},${Math.round(60 - cool * 20)})` : "#ffd23a");
                        lg.addColorStop(0.08, cool ? "#3a1a10" : "#ff7a1a");
                        lg.addColorStop(0.5, cool ? "#2a120c" : "#d9300f");
                        lg.addColorStop(1, cool ? "#1a0a08" : "#7a1408");
                        c.fillStyle = lg;
                        c.beginPath();
                        c.moveTo(0, H + 40);
                        for (let x = 0; x <= W + 24; x += 24) c.lineTo(x, level + Math.sin(x * 0.01 + t * 3) * 14 + Math.sin(x * 0.027 - t * 2) * 6);
                        c.lineTo(W, H + 40);
                        c.fill();
                        // bubbles of brighter lava swelling and popping (glowing cracks once it cools)
                        for (let i = 0; i < 50; i++) {
                            const f = flakes[i], x = f.x * W, y = level + 30 + f.y * H;
                            if (y > H + 20) continue;
                            if (cool) {
                                c.strokeStyle = "rgba(255,110,40,.45)"; c.lineWidth = 2;
                                c.beginPath(); c.moveTo(x - 30, y); c.lineTo(x - 8, y + 6 * Math.sin(f.ph)); c.lineTo(x + 12, y - 4); c.lineTo(x + 34, y + 8 * Math.cos(f.ph)); c.stroke();
                            } else {
                                const r = (4 + f.r * 4) * (0.4 + 0.6 * Math.abs(Math.sin(t * 2 * f.sp + f.ph)));
                                c.fillStyle = "rgba(255,220,110,.55)"; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
                                c.fillStyle = "rgba(255,250,200,.6)"; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2); c.fill();
                            }
                        }
                        if (!cool) for (const f of flakes.slice(0, 60)) {                // embers flying off the surface
                            const y = level - ((t * 140 * f.sp + f.y * 300) % 260);
                            c.fillStyle = `rgba(255,${150 + Math.round(f.r * 20)},60,${(0.8 - (level - y) / 300).toFixed(2)})`;
                            c.fillRect(f.x * W + Math.sin(t * 4 + f.ph) * 10, y, f.r, f.r);
                        }
                    } else if (style === "clouds") {
                        // puffy clouds billow in from every edge until the sky is white, then part to the sides
                        const p = leaving ? 1 + (1 - k) : k;
                        const grow = p <= 1 ? U.ease.outCubic(p) : 1;
                        const part = p <= 1 ? 0 : U.ease.inCubic(p - 1);
                        c.fillStyle = `rgba(250, 252, 255, ${Math.min(1, Math.max(0, grow * 1.4 - 0.4) * (1 - part)).toFixed(3)})`;
                        c.fillRect(0, 0, W, H);
                        for (let i = 0; i < 70; i++) {
                            const f = flakes[i], side = f.x < 0.5 ? -1 : 1;
                            const hx = f.x * W, hy = f.y * H;
                            const x = U.lerp(f.x < 0.5 ? -W * 0.3 : W * 1.3, hx, grow) + side * part * W * 0.9;
                            const r = (60 + f.r * 30) * (0.4 + grow * 0.9);
                            c.fillStyle = i % 3 ? "#ffffff" : "#e6eef8";
                            for (const [dx, dy, rr] of [[0, 0, 1], [0.7, 0.15, 0.75], [-0.7, 0.18, 0.7], [0.2, -0.45, 0.65]]) {
                                c.beginPath(); c.arc(x + dx * r, hy + dy * r + Math.sin(t * 2 + f.ph) * 4, rr * r, 0, Math.PI * 2); c.fill();
                            }
                        }
                    } else if (style === "sandstorm") {
                        // a wall of sand sweeps in from the right, the screen goes golden, then it blows away left
                        c.fillStyle = `rgba(222, 178, 110, ${Math.min(1, k * 1.15).toFixed(3)})`;
                        c.fillRect(0, 0, W, H);
                        for (const f of flakes) {
                            const x = W * 1.15 - (((f.x + t * f.sp * 1.4) % 1.3)) * W;
                            const y = ((f.y + t * 0.05 * f.sp) % 1) * H + Math.sin(t * 5 + f.ph) * 10;
                            const len = 6 + 60 * k * f.sp;
                            c.globalAlpha = Math.min(1, 0.3 + k);
                            c.strokeStyle = f.r > 3 ? "#f7dca0" : "#b9864a";
                            c.lineWidth = f.r * 0.7;
                            c.lineCap = "round";
                            c.beginPath(); c.moveTo(x, y); c.lineTo(x + len, y + len * 0.08); c.stroke();
                        }
                        c.globalAlpha = 1;
                        const dust = c.createLinearGradient(0, 0, W, 0);
                        dust.addColorStop(0, "rgba(160,110,50,0)"); dust.addColorStop(1, `rgba(160,110,50,${(0.35 * k).toFixed(3)})`);
                        c.fillStyle = dust; c.fillRect(0, 0, W, H);
                    } else if (style === "shutter") {
                        // two riveted blast doors with hazard stripes slam shut from top and bottom, then slide open
                        const half = H / 2 * k;
                        for (const top of [true, false]) {
                            const y = top ? half - H / 2 : H - half;
                            const mg = c.createLinearGradient(0, y, 0, y + H / 2);
                            mg.addColorStop(0, "#6b7682"); mg.addColorStop(0.5, "#8e9aa6"); mg.addColorStop(1, "#5a646e");
                            c.fillStyle = mg;
                            c.fillRect(0, y, W, H / 2);
                            c.strokeStyle = "rgba(0,0,0,.25)"; c.lineWidth = 2;
                            for (let x = 0; x < W; x += 120) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + H / 2); c.stroke(); }
                            c.fillStyle = "rgba(255,255,255,.5)";
                            for (let x = 30; x < W; x += 60) for (const ry of [y + 18, y + H / 2 - 18]) { c.beginPath(); c.arc(x, ry, 4, 0, Math.PI * 2); c.fill(); }
                            const sy = top ? y + H / 2 - 34 : y;                       // the hazard stripes on the meeting edge
                            c.save();
                            c.beginPath(); c.rect(0, sy, W, 34); c.clip();
                            c.fillStyle = "#ffcc1a"; c.fillRect(0, sy, W, 34);
                            c.fillStyle = "#1e2226";
                            for (let x = -40; x < W + 40; x += 40) { c.beginPath(); c.moveTo(x, sy + 34); c.lineTo(x + 20, sy + 34); c.lineTo(x + 54, sy); c.lineTo(x + 34, sy); c.fill(); }
                            c.restore();
                        }
                        if (k > 0.97 && !leaving) { c.fillStyle = "rgba(255,240,180,.5)"; c.fillRect(0, H / 2 - 2, W, 4); }
                    } else if (style === "curtain") {
                        // red velvet curtains swish shut from both sides, with gold fringe, then open again
                        for (const left of [true, false]) {
                            const w = W / 2 * (0.04 + k * 0.98);
                            const x0 = left ? 0 : W - w;
                            const cg = c.createLinearGradient(x0, 0, x0 + w, 0);
                            for (let i = 0; i <= 10; i++) cg.addColorStop(i / 10, i % 2 ? "#a3121f" : "#d42a35");
                            c.fillStyle = cg;
                            c.beginPath();
                            const edge = left ? x0 + w : x0, outer = left ? 0 : W;
                            c.moveTo(outer, 0);
                            for (let y = 0; y <= H; y += 30) c.lineTo(edge + (left ? 1 : -1) * Math.sin(y * 0.02 + t * 3) * 8 * (1 - k * 0.5), y);
                            c.lineTo(outer, H);
                            c.fill();
                            c.fillStyle = "#ffcf4a";
                            for (let y = 0; y <= H; y += 14) c.fillRect(edge - (left ? 6 : 0) + (left ? 1 : -1) * Math.sin(y * 0.02 + t * 3) * 8 * (1 - k * 0.5), y, 6, 8);
                        }
                        const vg = c.createLinearGradient(0, 0, 0, 70);                // the valance across the top
                        vg.addColorStop(0, "#7a0c16"); vg.addColorStop(1, "#b81d28");
                        c.fillStyle = vg;
                        c.beginPath(); c.moveTo(0, 0); c.lineTo(W, 0);
                        for (let x = W; x >= 0; x -= W / 12) c.quadraticCurveTo(x - W / 24, 90, x - W / 12, 50);
                        c.fill();
                    } else if (style === "downpour") {
                        // rain streaks thicken into a misty downpour, then a windshield wiper sweeps it clear
                        const fogA = leaving ? 1 : Math.min(1, k * 1.2);
                        const sweep = leaving ? 1 - k : 0;                            // 0..1 of the wiper's trip
                        const px = W / 2, py = H + 10, R = Math.hypot(W / 2, H + 10) * 1.05, ang = Math.PI + sweep * Math.PI;
                        c.save();
                        if (leaving) { c.beginPath(); c.rect(0, 0, W, H); c.moveTo(px, py); c.arc(px, py, R, Math.PI, ang); c.closePath(); c.clip("evenodd"); }
                        c.fillStyle = `rgba(120, 140, 165, ${(fogA * 0.97).toFixed(3)})`;
                        c.fillRect(0, 0, W, H);
                        c.strokeStyle = "rgba(220,235,250,.55)"; c.lineWidth = 1.4;
                        for (const f of flakes) {
                            const x = f.x * W, y = ((f.y + t * 1.6 * f.sp) % 1.1) * H - 40, len = 14 + 30 * f.sp;
                            c.beginPath(); c.moveTo(x, y); c.lineTo(x - len * 0.15, y + len); c.stroke();
                        }
                        c.fillStyle = "rgba(235,245,255,.35)";                          // drops on the glass
                        for (let i = 0; i < 90; i++) { const f = flakes[i]; c.beginPath(); c.arc(f.x * W, ((f.y + t * 0.05 * f.sp) % 1) * H, f.r * 1.5, 0, Math.PI * 2); c.fill(); }
                        c.restore();
                        if (leaving && sweep < 1) {                                    // the wiper blade
                            c.save(); c.translate(px, py); c.rotate(ang);
                            c.fillStyle = "#1d2228"; c.fillRect(0, -5, R, 10);
                            c.fillStyle = "#3a434d"; c.fillRect(0, -2, R, 4);
                            c.restore();
                        }
                    } else if (style === "blizzard") {
                        // a snowstorm blows in from the left, thickens into a white-out, then blows away
                        c.fillStyle = `rgba(236, 244, 252, ${Math.min(1, k * 1.1).toFixed(3)})`;
                        c.fillRect(0, 0, W, H);
                        for (const f of flakes) {
                            const x = (((f.x + t * f.sp * 1.3) % 1.3) - 0.15) * W;
                            const y = ((f.y + t * 0.12 * f.sp) % 1) * H + Math.sin(t * 4 + f.ph) * 14;
                            const len = 8 + 70 * k * f.sp;
                            c.globalAlpha = Math.min(1, 0.35 + k);
                            c.strokeStyle = f.r > 3 ? "#ffffff" : "#b7cde4";
                            c.lineWidth = f.r * 0.8;
                            c.lineCap = "round";
                            c.beginPath();
                            c.moveTo(x, y);
                            c.lineTo(x - len, y - len * 0.22);
                            c.stroke();
                        }
                        c.globalAlpha = 1;
                    } else if (style === "leaves" || style === "autumn") {
                        // a wall of leaves moving left to right: it covers the screen in the middle of its trip
                        const p = leaving ? 1 + (1 - k) : k;            // 0..2
                        const front = p <= 1 ? U.lerp(-0.2 * W, 1.25 * W, p) : U.lerp(1.25 * W, 2.7 * W, p - 1);
                        const back = front - W * 1.5;
                        c.fillStyle = P.wall;
                        c.fillRect(back, 0, W * 1.5, H);
                        // the inside of the wall: two layers of darker leaves for depth
                        for (const l of leaves) {
                            leaf(c, back + l.x * W * 1.5, l.y * H, l.r * 1.25, l.rot + t * 0.4, P.deep);
                            leaf(c, back + ((l.x + 0.37) % 1) * W * 1.5, (((l.y + 0.53) % 1.2) - 0.1) * H, l.r, -l.rot + t * 0.5, P.mid);
                        }
                        // the ragged, tumbling edges
                        for (const l of leaves) for (const edge of [front, back]) leaf(c, edge + l.off * W * 0.25, l.y * H, l.r, l.rot + t * l.spin, l.c);
                    } else if (style === "page") {
                        // a sheet of notebook paper slides up from the bottom, then off the top
                        const p = leaving ? 1 + (1 - k) : k;
                        const top = p <= 1 ? H - p * H * 1.12 : -0.12 * H - (p - 1) * H * 1.3;
                        c.save();
                        c.translate(W / 2, top + H / 2);
                        c.rotate((1 - Math.min(p, 2 - p)) * -0.06);
                        c.translate(-W / 2, -H / 2);
                        c.shadowColor = "rgba(0,0,0,.35)";
                        c.shadowBlur = 30;
                        c.fillStyle = C.surface || "#fffdf7";
                        c.fillRect(-40, 0, W + 80, H * 1.15);
                        c.shadowBlur = 0;
                        c.strokeStyle = "rgba(80,140,210,.35)";
                        c.lineWidth = 1;
                        for (let y = 60; y < H * 1.15; y += 34) { c.beginPath(); c.moveTo(-40, y); c.lineTo(W + 40, y); c.stroke(); }
                        c.strokeStyle = "rgba(220,80,80,.55)";
                        c.beginPath(); c.moveTo(72, 0); c.lineTo(72, H * 1.15); c.stroke();
                        c.restore();
                    } else if (style === "warp") {
                        const cx = W / 2, cy = H / 2, R = Math.hypot(W, H) / 2;
                        c.fillStyle = `rgba(4,2,14,${Math.min(1, k * 1.4)})`;
                        c.fillRect(0, 0, W, H);
                        c.globalCompositeOperation = "lighter";
                        for (const s of streaks) {
                            const d = ((s.d + t * s.sp * 1.4) % 1) * R, len = 40 + k * 260 * s.sp;
                            c.strokeStyle = `rgba(160,220,255,${0.6 * k})`;
                            c.lineWidth = 1.5 + s.sp;
                            c.beginPath();
                            c.moveTo(cx + Math.cos(s.a) * d, cy + Math.sin(s.a) * d);
                            c.lineTo(cx + Math.cos(s.a) * (d + len), cy + Math.sin(s.a) * (d + len));
                            c.stroke();
                        }
                        c.globalCompositeOperation = "source-over";
                        const white = Math.max(0, (k - 0.75) / 0.25);
                        if (white > 0) { c.fillStyle = `rgba(235,245,255,${white})`; c.fillRect(0, 0, W, H); }
                    } else if (style === "rift") {
                        // the Celestial Rift: a jagged golden crack tears across the screen, splits wide
                        // open into a sky of violet light and stars, then seals itself shut again
                        const N = 26, ang = Math.atan2(H * 0.7, W * 1.1), nx = -Math.sin(ang), ny = Math.cos(ang);
                        const half = Math.pow(k, 1.6) * Math.hypot(W, H) * 0.75 + k * 6;
                        const top = [], bot = [];
                        for (let i = 0; i <= N; i++) {
                            const u = i / N, s = streaks[i], j = (s.d - 0.5) * 0.9;
                            const x = U.lerp(-0.08 * W, 1.08 * W, u), y = U.lerp(0.15 * H, 0.85 * H, u) + Math.sin(u * 9 + 1) * H * 0.03;
                            const w = half * (0.55 + 0.45 * Math.sin(u * Math.PI)) * (1 + j * 0.35) + (i % 2 ? 4 : -4) * k;
                            top.push([x + nx * w + (s.sp - 1.1) * 14, y + ny * -w + j * 10]);
                            bot.push([x - nx * w * 0.85 - (s.sp - 1.1) * 10, y - ny * -w * 0.85 - j * 8]);
                        }
                        const shape = () => { c.beginPath(); top.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); for (let i = bot.length - 1; i >= 0; i--) c.lineTo(bot[i][0], bot[i][1]); c.closePath(); };
                        // the dark sky around the tear dims as it opens
                        c.fillStyle = `rgba(12,4,30,${(0.55 * k).toFixed(3)})`;
                        c.fillRect(0, 0, W, H);
                        // inside the tear: gold at the heart, violet out to the edges, stars drifting
                        c.save();
                        shape();
                        c.clip();
                        const ig = c.createLinearGradient(W * 0.5 + nx * half, H * 0.5 - ny * half, W * 0.5 - nx * half, H * 0.5 + ny * half);
                        ig.addColorStop(0, "#2a0f5a"); ig.addColorStop(0.42, "#9b6bff"); ig.addColorStop(0.5, "#fff3c4"); ig.addColorStop(0.58, "#ffb86b"); ig.addColorStop(1, "#1a0a40");
                        c.fillStyle = ig;
                        c.fillRect(0, 0, W, H);
                        c.globalCompositeOperation = "lighter";
                        for (const f of flakes) {
                            const x = ((f.x + t * 0.03 * f.sp) % 1) * W, y = ((f.y + t * 0.02 * f.sp) % 1) * H, tw = 0.5 + 0.5 * Math.sin(t * 6 + f.ph);
                            c.fillStyle = `rgba(255,245,220,${(0.35 + 0.6 * tw).toFixed(2)})`;
                            c.beginPath(); c.arc(x, y, f.r * 0.6, 0, Math.PI * 2); c.fill();
                        }
                        c.restore();
                        // the burning edges of the tear, and sparks shed from them
                        c.globalCompositeOperation = "lighter";
                        for (const [edge, w, a] of [[top, 10, 0.35], [top, 3, 0.95], [bot, 10, 0.35], [bot, 3, 0.95]]) {
                            c.strokeStyle = `rgba(255,214,120,${(a * Math.min(1, k * 3)).toFixed(3)})`;
                            c.lineWidth = w; c.lineJoin = "round";
                            c.beginPath(); edge.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
                        }
                        for (let i = 0; i < 70; i++) {
                            const s = streaks[i], e = (i % 2 ? top : bot)[i % (N + 1)], life = (t * s.sp * 1.8 + s.d) % 1;
                            const x = e[0] + Math.cos(s.a) * life * 60, y = e[1] + Math.sin(s.a) * life * 60 + life * life * 40;
                            c.fillStyle = `rgba(255,${200 + Math.round(55 * (1 - life))},150,${((1 - life) * Math.min(1, k * 2)).toFixed(2)})`;
                            c.fillRect(x, y, 2.2, 2.2);
                        }
                        c.globalCompositeOperation = "source-over";
                        const white = Math.max(0, (k - 0.8) / 0.2);
                        if (white > 0) { c.fillStyle = `rgba(255,246,222,${(white * 0.9).toFixed(3)})`; c.fillRect(0, 0, W, H); }
                    } else {                                            // iris
                        const R = Math.hypot(W, H) / 2 * (1 - k);
                        c.fillStyle = C.bg;
                        c.beginPath();
                        c.rect(0, 0, W, H);
                        c.arc(W / 2, H / 2, Math.max(0.1, R), 0, Math.PI * 2, true);
                        c.fill("evenodd");
                        c.strokeStyle = C.accent;
                        c.lineWidth = 10;
                        c.beginPath();
                        c.arc(W / 2, H / 2, Math.max(0.1, R), 0, Math.PI * 2);
                        c.stroke();
                    }
                }
            });
        });
    }

    // Keep pieces of a cinematic that sit on or around the board (a snow globe, a chest...) attached to it: they're
    // position: fixed, so they're moved by however far the board has moved since they were placed. Checked every frame
    // (it used to be only on scroll), so the page shifting or a resize moves them too.
    function follow(c, boardEl, ...els) {
        const start = boardEl.getBoundingClientRect();
        const items = els.map(el => ({ el, x: el.style.left ? parseFloat(el.style.left) : null, y: el.style.top ? parseFloat(el.style.top) : null }));
        let raf = 0, lx = 0, ly = 0;
        const move = () => {
            raf = requestAnimationFrame(move);
            if (!boardEl.isConnected) return;
            const r = boardEl.getBoundingClientRect();
            if (!r.width) return;
            const dx = r.left - start.left, dy = r.top - start.top;
            if (dx === lx && dy === ly) return;
            lx = dx; ly = dy;
            for (const it of items) {
                if (it.x !== null) it.el.style.left = it.x + dx + "px";
                if (it.y !== null) it.el.style.top = it.y + dy + "px";
            }
        };
        raf = requestAnimationFrame(move);
        c.cleanup(() => cancelAnimationFrame(raf));
    }

    function clear() { parts = []; effects = []; }

    return {
        burst, add, ring, flash, shake, toast, countUp, cinematic, transition, follow, anchor, clear, star,
        // the shared sprites and colour helpers, for the other particle systems (spells, powers): halo(color) is a soft
        // glow, ball(color) a shaded ball, starImg(color, light, glow) and flake(color) are 4 radii across
        art: { halo: haloSprite, ball: ballSprite, starImg: starSprite, flake: flakeSprite, text: textSprite, tint, fade: (c, a) => css(rgba(c), a), rgba },
        get playing() { return playing > 0; }, get W() { return W; }, get H() { return H; }
    };
})();
