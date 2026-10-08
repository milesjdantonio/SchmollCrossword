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
        last = performance.now();
        raf = requestAnimationFrame(loop);
    }
    function loop(now) {
        const dt = U.clamp((now - last) / 1000, 0, 0.05);       // a frame can be stamped just before "last": never step backwards
        last = now;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, W, H);
        effects = effects.filter(e => {
            let alive = true;
            try { alive = e.update(dt) !== false; if (alive) e.draw(g, W, H); } catch (err) { console.error(err); alive = false; }
            return alive;
        });
        g.globalCompositeOperation = "source-over";
        parts = parts.filter(p => stepParticle(p, dt));
        for (const p of parts) drawParticle(p);
        g.globalAlpha = 1;
        g.globalCompositeOperation = "source-over";
        if (parts.length || effects.length) raf = requestAnimationFrame(loop);
        else { raf = 0; g.clearRect(0, 0, W, H); }
    }

    // ---- particles ----
    function stepParticle(p, dt) {
        p.age += dt;
        if (p.age >= p.life) return false;
        if (p.delay > 0) { p.delay -= dt; p.age = 0; return true; }
        p.vx *= 1 - p.drag * dt;
        p.vy = p.vy * (1 - p.drag * dt) + p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.flip += p.vf * dt;
        if (p.wobble) p.x += Math.sin(p.age * 3 + p.seed) * p.wobble * dt;
        return true;
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
    function drawParticle(p) {
        if (p.delay > 0) return;
        const k = p.age / p.life;
        g.globalAlpha = p.fade ? Math.min(1, (1 - k) * 2.2) * p.alpha : p.alpha;
        g.globalCompositeOperation = p.glow ? "lighter" : "source-over";
        g.fillStyle = p.color;
        g.strokeStyle = p.color;
        const s = p.size * (p.shrink ? 1 - k * 0.7 : 1);
        switch (p.shape) {
            case "rect": {                           // confetti: a little paper rectangle tumbling in 3D
                const c = Math.cos(p.rot), sn = Math.sin(p.rot), f = Math.cos(p.flip);
                g.setTransform(c * dpr, sn * dpr, -sn * f * dpr, c * f * dpr, p.x * dpr, p.y * dpr);
                g.fillRect(-s / 2, -s * 0.3, s, s * 0.6);
                g.setTransform(dpr, 0, 0, dpr, 0, 0);
                break;
            }
            case "pixel":
                g.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
                break;
            case "star":
                star(p.x, p.y, s, p.rot);
                g.fill();
                break;
            case "spark": {                          // a streak along the direction of travel
                const len = Math.min(40, Math.hypot(p.vx, p.vy) * 0.05 + 2);
                const a = Math.atan2(p.vy, p.vx);
                g.lineWidth = s;
                g.lineCap = "round";
                g.beginPath();
                g.moveTo(p.x, p.y);
                g.lineTo(p.x - Math.cos(a) * len, p.y - Math.sin(a) * len);
                g.stroke();
                break;
            }
            case "petal":
                g.save();
                g.translate(p.x, p.y);
                g.rotate(p.rot);
                g.scale(1, Math.abs(Math.cos(p.flip)) * 0.8 + 0.2);
                g.beginPath();
                g.ellipse(0, 0, s, s * 0.55, 0, 0, Math.PI * 2);
                g.fill();
                g.restore();
                break;
            case "flake": {                          // a six-armed snowflake with little branches
                g.save();
                g.translate(p.x, p.y);
                g.rotate(p.rot);
                g.lineWidth = Math.max(1, s * 0.16);
                g.lineCap = "round";
                g.beginPath();
                for (let i = 0; i < 6; i++) {
                    const a = i * Math.PI / 3, ca = Math.cos(a), sa = Math.sin(a);
                    g.moveTo(0, 0);
                    g.lineTo(ca * s, sa * s);
                    for (const side of [-0.7, 0.7]) {
                        g.moveTo(ca * s * 0.55, sa * s * 0.55);
                        g.lineTo(ca * s * 0.55 + Math.cos(a + side) * s * 0.3, sa * s * 0.55 + Math.sin(a + side) * s * 0.3);
                    }
                }
                g.stroke();
                g.restore();
                break;
            }
            case "leaf": {                           // a pointed leaf with a vein, fluttering as it turns
                g.save();
                g.translate(p.x, p.y);
                g.rotate(p.rot);
                g.scale(1, Math.abs(Math.cos(p.flip)) * 0.85 + 0.15);
                g.beginPath();
                g.moveTo(-s, 0);
                g.quadraticCurveTo(-s * 0.1, -s * 0.62, s, 0);
                g.quadraticCurveTo(-s * 0.1, s * 0.62, -s, 0);
                g.fill();
                g.strokeStyle = "rgba(70, 30, 8, .45)";
                g.lineWidth = Math.max(0.6, s * 0.08);
                g.beginPath();
                g.moveTo(-s * 0.9, 0);
                g.lineTo(s * 0.85, 0);
                g.stroke();
                g.restore();
                break;
            }
            case "acorn": {                          // a nut (its colour) under a scaly brown cap
                g.save();
                g.translate(p.x, p.y);
                g.rotate(p.rot);
                g.beginPath();
                g.ellipse(0, s * 0.22, s * 0.55, s * 0.72, 0, 0, Math.PI * 2);
                g.fill();
                g.fillStyle = "#6b4220";
                g.beginPath();
                g.ellipse(0, -s * 0.18, s * 0.7, s * 0.42, 0, Math.PI, Math.PI * 2);
                g.closePath();
                g.fill();
                g.fillRect(-s * 0.08, -s * 0.78, s * 0.16, s * 0.24);
                g.restore();
                break;
            }
            case "bubble": {                         // a see-through bubble with a highlight, wobbling as it rises
                const wob = 1 + Math.sin(p.age * 9 + p.seed) * 0.06;
                g.lineWidth = Math.max(1, s * 0.12);
                g.beginPath();
                g.ellipse(p.x, p.y, s * wob, s / wob, 0, 0, Math.PI * 2);
                g.stroke();
                g.globalAlpha *= 0.25;
                g.fill();
                g.globalAlpha /= 0.25;
                g.fillStyle = "rgba(255,255,255,.85)";
                g.beginPath();
                g.arc(p.x - s * 0.35, p.y - s * 0.35, s * 0.22, 0, Math.PI * 2);
                g.fill();
                break;
            }
            case "text":
                g.font = `${s}px sans-serif`;
                g.textAlign = "center";
                g.textBaseline = "middle";
                g.save();
                g.translate(p.x, p.y);
                g.rotate(p.rot);
                g.fillText(p.text, 0, 0);
                g.restore();
                break;
            default:                                 // circle
                g.beginPath();
                g.arc(p.x, p.y, s, 0, Math.PI * 2);
                g.fill();
        }
    }
    const range = (r, d) => (Array.isArray(r) ? U.rand(r[0], r[1]) : r ?? d);

    // burst({ x, y, n, colors, shape, speed:[a,b], angle, spread, gravity, life:[a,b], size:[a,b], ... })
    function burst(o) {
        const lite = U.motion() === "lite";
        if (U.motion() === "still") return;
        const n = Math.round((o.n || 30) * (lite ? 0.45 : 1));
        const colors = o.colors || ["#ffffff"];
        for (let i = 0; i < n; i++) {
            const a = o.angle != null ? o.angle + U.rand(-1, 1) * (o.spread ?? Math.PI) : Math.random() * Math.PI * 2;
            const sp = range(o.speed, 300) * (o.even ? 1 : U.rand(0.35, 1));
            parts.push({
                x: (o.x ?? W / 2) + U.rand(-1, 1) * (o.jitter || 0), y: (o.y ?? H / 2) + U.rand(-1, 1) * (o.jitterY ?? o.jitter ?? 0),
                vx: Math.cos(a) * sp + (o.vx || 0), vy: Math.sin(a) * sp + (o.vy || 0),
                gravity: o.gravity ?? 600, drag: o.drag ?? 1.2, life: range(o.life, 1.4), age: 0, delay: range(o.delay, 0),
                size: range(o.size, 8), color: colors[i % colors.length], shape: o.shape || "rect",
                rot: Math.random() * 6.28, vr: U.rand(-1, 1) * (o.spin ?? 8), flip: Math.random() * 6.28, vf: U.rand(4, 12),
                alpha: o.alpha ?? 1, fade: o.fade ?? true, glow: !!o.glow, shrink: !!o.shrink, wobble: o.wobble || 0,
                seed: Math.random() * 10, text: o.text ? (Array.isArray(o.text) ? U.pick(o.text) : o.text) : ""
            });
        }
        kick();
    }

    function add(effect) {
        effects.push(effect);
        kick();
        return effect;
    }

    // An expanding shockwave ring
    function ring({ x = W / 2, y = H / 2, color = "#fff", r0 = 10, r1 = 300, dur = 0.7, width = 10, glow = true } = {}) {
        if (U.motion() === "still") return;
        let t = 0;
        add({
            update: dt => (t += dt) < dur,
            draw(c) {
                const k = t / dur, e = U.ease.outCubic(k);
                c.globalCompositeOperation = glow ? "lighter" : "source-over";
                c.globalAlpha = 1 - k;
                c.strokeStyle = color;
                c.lineWidth = width * (1 - k * 0.7);
                c.beginPath();
                c.arc(x, y, U.lerp(r0, r1, e), 0, Math.PI * 2);
                c.stroke();
                c.globalAlpha = 1;
                c.globalCompositeOperation = "source-over";
            }
        });
    }

    // A full-screen flash of colour that fades away
    function flash(color = "#fff", dur = 450, peak = 0.9) {
        if (U.motion() === "still") return;
        const d = U.el("div", { class: "fx-flash", "aria-hidden": "true", style: { background: color } });
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
                cleanup: fn => cleanups.push(fn)
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
                    if (style === "pixels") {
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

    function clear() { parts = []; effects = []; }

    return {
        burst, add, ring, flash, shake, toast, countUp, cinematic, transition, clear, star,
        get playing() { return playing > 0; }, get W() { return W; }, get H() { return H; }
    };
})();
