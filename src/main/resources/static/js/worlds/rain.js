// The RAINY CITY world: a cosy rainy day over the rooftops.
//   Day: soft grey-blue skies over layers of city rooftops with water towers, rain slanting down, a warm café
//   window, colourful umbrellas bobbing along the street below and ripples in the puddles.
//   Night: the city at night in the rain: lit windows switching on and off, a glowing café sign, wet streets
//   reflecting the lights, and faint silent lightning far away.
//   Board: each letter leaves something rainy in its square (a raindrop, an umbrella, a rain boot, a leaf, a
//   snail, a little cloud); finished words get a puddle with ripples.
//   Win: the sky darkens, a big umbrella pops open over the board in a downpour, then the rain stops, the sun
//   breaks through and a rainbow appears.

(() => {
    const TAU = Math.PI * 2;
    const { tone, noise, midi } = Sound;
    const UMBRELLAS = ["#ff5a6a", "#ffc93a", "#3aa8ff", "#3ac48a", "#b06aff", "#ff8a3a"];
    const RAINBOW = ["#ff5c5c", "#ff9f40", "#ffd84a", "#6fd36a", "#4cb3ff", "#9a7cff"];
    const DROPS = ["#9ad0ff", "#cfe8ff", "#6ab4f0"];
    const dark = () => document.documentElement.dataset.theme === "dark";

    // ---------------------------------------------------------------------------------------------
    // The background
    // ---------------------------------------------------------------------------------------------
    function scene(W, H, opts) {
        const night = opts.theme === "dark", preview = !!opts.preview;
        let sky, layers, windows, rain, puddles, walkers = [], nextWalker = preview ? 999 : 0.5, flash = 0, nextFlash = preview ? 999 : U.rand(8, 16), street, cafe;

        function skyline(R, base, minH, maxH, col, winCol, list, depth) {
            const c = Worlds.canvas(W + 60, H), g = c.getContext("2d");
            let x = -10;
            while (x < W + 60) {
                const w = 40 + R() * 70, h = minH + R() * (maxH - minH), top = base - h;
                g.fillStyle = col;
                g.fillRect(x, top, w, H - top);
                if (R() < 0.3) { g.fillRect(x + w * 0.3, top - 14, w * 0.4, 14); }                 // a rooftop box
                if (R() < 0.25) {                                                                   // a water tower
                    const tx = x + w * (0.2 + R() * 0.5);
                    g.fillRect(tx, top - 34, 22, 24);
                    g.beginPath(); g.moveTo(tx - 3, top - 34); g.lineTo(tx + 11, top - 46); g.lineTo(tx + 25, top - 34); g.fill();
                    g.fillRect(tx + 2, top - 12, 3, 12); g.fillRect(tx + 17, top - 12, 3, 12);
                }
                // windows: on this layer they're drawn live (so they can switch on and off at night)
                if (winCol) for (let wy = top + 10; wy < base - 8; wy += 18) for (let wx = x + 7; wx < x + w - 10; wx += 14) if (R() < 0.85) list.push({ x: wx, y: wy, on: R() < (night ? 0.45 : 0.18), next: R() * 20, depth });
                x += w + R() * 6;
            }
            return c;
        }
        function setup() {
            const R = U.rng(2468);
            sky = null;
            windows = [];
            const cols = night ? ["#1a2238", "#141a2c", "#0e1220"] : ["#a8b4c4", "#8a98aa", "#6a788a"];
            layers = [
                skyline(R, H * 0.62, H * 0.15, H * 0.32, cols[0], false, windows, 0),
                skyline(R, H * 0.72, H * 0.14, H * 0.3, cols[1], true, windows, 1),
                skyline(R, H * 0.84, H * 0.1, H * 0.22, cols[2], true, windows, 2)
            ];
            // the street at the bottom, wet and shiny
            street = { y: H * 0.86 };
            cafe = { x: W * 0.72, w: Math.min(W * 0.22, 220), h: H * 0.11 };
            rain = Array.from({ length: preview ? 60 : 260 }, () => ({ x: R() * W * 1.2, y: R() * H, sp: 600 + R() * 400, len: 10 + R() * 16, z: 0.4 + R() * 0.6 }));
            puddles = Array.from({ length: preview ? 3 : 6 }, () => ({ x: R() * W, y: H * (0.9 + R() * 0.08), w: 30 + R() * 60, rings: [] }));
        }
        setup();

        function walker(g, w, t) {
            const x = w.x, y = street.y + 6 + w.lane * 8, s = w.s, bob = Math.sin(t * 7 + w.ph) * 1.5;
            g.save(); g.translate(x, y + bob); g.scale(s * w.dir, s);
            g.strokeStyle = night ? "#2a3040" : "#3a3a48"; g.lineWidth = 4; g.lineCap = "round";
            const step = Math.sin(t * 7 + w.ph) * 5;
            g.beginPath(); g.moveTo(0, -18); g.lineTo(step, 0); g.moveTo(0, -18); g.lineTo(-step, 0); g.stroke();
            g.fillStyle = w.coat; g.beginPath(); g.roundRect(-7, -40, 14, 24, 5); g.fill();
            g.strokeStyle = "#3a3a3a"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(4, -36); g.lineTo(4, -62); g.stroke();
            g.fillStyle = w.c;
            g.beginPath(); g.moveTo(-26, -58); g.quadraticCurveTo(4, -86, 34, -58);
            for (let i = 0; i < 4; i++) g.quadraticCurveTo(34 - i * 15 - 7.5, -64, 34 - (i + 1) * 15, -58);
            g.fill();
            g.fillStyle = "rgba(255,255,255,.25)"; g.beginPath(); g.moveTo(-10, -66); g.quadraticCurveTo(4, -80, 20, -68); g.quadraticCurveTo(4, -74, -10, -66); g.fill();
            g.restore();
            if (night) {                                                       // its reflection in the wet street
                g.globalAlpha = 0.18; g.fillStyle = w.c; g.fillRect(x - 26 * s, y + 8, 60 * s, 20 * s); g.globalAlpha = 1;
            }
        }

        return {
            resize(w, h) { W = w; H = h; setup(); },
            draw(g, t, dt, inp) {
                if (!sky) {
                    sky = g.createLinearGradient(0, 0, 0, H * 0.8);
                    if (night) { sky.addColorStop(0, "#0a0e1e"); sky.addColorStop(1, "#24304a"); }
                    else { sky.addColorStop(0, "#8a9ab0"); sky.addColorStop(0.6, "#b8c4d2"); sky.addColorStop(1, "#d8e0ea"); }
                }
                g.fillStyle = sky; g.fillRect(0, 0, W, H);
                // faint lightning far away (no thunder)
                nextFlash -= dt;
                if (nextFlash <= 0) { flash = 1; nextFlash = U.rand(10, 20); }
                if (flash > 0) {
                    flash = Math.max(0, flash - dt * 2.5);
                    const a = flash * (night ? 0.35 : 0.25) * (Math.sin(flash * 30) > -0.3 ? 1 : 0.3);
                    g.fillStyle = `rgba(230,240,255,${a.toFixed(3)})`; g.fillRect(0, 0, W, H * 0.7);
                }
                // soft clouds rolling low
                for (let i = 0; i < 6; i++) {
                    const x = ((i * 0.23 * W + t * (6 + i)) % (W + 400)) - 200 - inp.px * 4, y = H * (0.06 + (i % 3) * 0.06);
                    g.fillStyle = night ? "rgba(40,50,80,.5)" : "rgba(240,244,250,.45)";
                    g.beginPath(); g.ellipse(x, y, 180, 40, 0, 0, TAU); g.fill();
                }
                const shift = [4, 10, 16];
                layers.forEach((layer, d) => {
                    g.drawImage(layer, -30 - inp.px * shift[d], 0);
                    // this layer's windows
                    for (const w of windows) {
                        if (w.depth !== d) continue;
                        w.next -= dt;
                        if (w.next <= 0) { if (Math.random() < 0.5) w.on = !w.on; w.next = 6 + Math.random() * 20; }
                        const x = w.x - 30 - inp.px * shift[d];
                        g.fillStyle = w.on ? (night ? "rgba(255,210,120,.9)" : "rgba(255,230,170,.75)") : (night ? "rgba(40,50,70,.8)" : "rgba(200,210,224,.5)");
                        g.fillRect(x, w.y, 7, 9);
                    }
                });
                // the café: a warm window and a striped awning (its sign glows at night)
                const cx = cafe.x - inp.px * 16, cy = street.y - cafe.h;
                g.fillStyle = night ? "#2a1a1a" : "#5a3a2e"; g.fillRect(cx - 10, cy - 30, cafe.w + 20, cafe.h + 30);
                const cw = g.createLinearGradient(0, cy, 0, cy + cafe.h);
                cw.addColorStop(0, "#ffd890"); cw.addColorStop(1, "#ffb060");
                g.fillStyle = cw; g.fillRect(cx, cy, cafe.w, cafe.h - 6);
                g.fillStyle = "rgba(120,60,20,.5)"; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(cx + cafe.w * (0.25 + i * 0.25), cy + cafe.h - 6, 8, Math.PI, TAU); g.fill(); }   // people inside
                for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#ffffff" : "#2e8a5a"; g.beginPath(); g.moveTo(cx - 10 + i * (cafe.w + 20) / 8, cy - 4); g.lineTo(cx - 10 + (i + 1) * (cafe.w + 20) / 8, cy - 4); g.lineTo(cx - 10 + (i + 1) * (cafe.w + 20) / 8, cy - 20); g.lineTo(cx - 10 + i * (cafe.w + 20) / 8, cy - 20); g.fill(); g.beginPath(); g.arc(cx - 10 + (i + 0.5) * (cafe.w + 20) / 8, cy - 4, (cafe.w + 20) / 16, 0, Math.PI); g.fill(); }
                if (night) {
                    const pulse = 0.8 + 0.2 * Math.sin(t * 2.5);
                    g.font = `700 ${Math.round(cafe.h * 0.32)}px "Pacifico", cursive`;
                    g.textAlign = "center";
                    g.shadowColor = "#ff6ab4"; g.shadowBlur = 18 * pulse;
                    g.fillStyle = `rgba(255,170,215,${pulse.toFixed(2)})`;
                    g.fillText("Café", cx + cafe.w / 2, cy - 36);
                    g.shadowBlur = 0; g.textAlign = "left";
                }
                // the wet street
                const sg = g.createLinearGradient(0, street.y, 0, H);
                sg.addColorStop(0, night ? "#1a2030" : "#6a7484"); sg.addColorStop(1, night ? "#0a0e18" : "#4a5260");
                g.fillStyle = sg; g.fillRect(0, street.y, W, H - street.y);
                if (night) {                                                       // light reflections in the wet road
                    const rh = H - street.y;
                    for (const [x, w, col, len] of [[cx, cafe.w, "255,176,96", 0.9], [cx + cafe.w * 0.3, cafe.w * 0.4, "255,106,180", 0.6]]) {
                        const rg = g.createLinearGradient(0, street.y, 0, street.y + rh * len);
                        rg.addColorStop(0, `rgba(${col},.3)`); rg.addColorStop(1, `rgba(${col},0)`);
                        g.fillStyle = rg;
                        for (let y = 0; y < rh * len; y += 4) g.fillRect(x + Math.sin(y * 0.3 + t * 3) * 3, street.y + y, w, 3);       // rippling streaks
                    }
                }
                g.fillStyle = night ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.1)"; g.fillRect(0, street.y, W, 3);
                // puddles with ripples where drops land
                for (const p of puddles) {
                    g.fillStyle = night ? "rgba(90,110,160,.35)" : "rgba(180,200,225,.55)";
                    g.beginPath(); g.ellipse(p.x - inp.px * 18, p.y, p.w, p.w * 0.16, 0, 0, TAU); g.fill();
                    if (Math.random() < dt * 4) p.rings.push({ x: (Math.random() - 0.5) * p.w * 1.4, age: 0 });
                    p.rings = p.rings.filter(r => (r.age += dt) < 0.8);
                    g.lineWidth = 1;
                    for (const r of p.rings) { const k = r.age / 0.8; g.strokeStyle = `rgba(255,255,255,${(0.6 * (1 - k)).toFixed(2)})`; g.beginPath(); g.ellipse(p.x - inp.px * 18 + r.x, p.y, 3 + k * 16, (3 + k * 16) * 0.25, 0, 0, TAU); g.stroke(); }
                }
                // people with umbrellas walking along the street
                nextWalker -= dt;
                if (nextWalker <= 0) {
                    const dir = Math.random() < 0.5 ? 1 : -1;
                    walkers.push({ x: dir > 0 ? -40 : W + 40, dir, vx: U.rand(30, 50) * dir, s: U.clamp(H / 900, 0.6, 1.1) * U.rand(0.85, 1), lane: Math.floor(Math.random() * 3), c: U.pick(UMBRELLAS), coat: U.pick(["#4a5a7a", "#7a4a3a", "#3a5a4a", "#5a4a6a"]), ph: Math.random() * TAU });
                    nextWalker = U.rand(3, 7);
                }
                walkers = walkers.filter(w => (w.x += w.vx * dt) > -60 && w.x < W + 60);
                walkers.sort((a, b) => a.lane - b.lane);
                for (const w of walkers) walker(g, w, t);
                // the rain, slanting with the wind (and the pointer)
                g.lineCap = "round";
                const slant = 0.18 + inp.px * 0.06;
                for (const r of rain) {
                    r.y += r.sp * dt * r.z; r.x += r.sp * dt * r.z * slant;
                    if (r.y > H) { r.y = -20; r.x = Math.random() * W * 1.2 - W * 0.1; }
                    if (r.x > W + 20) r.x -= W * 1.2;
                    g.strokeStyle = night ? `rgba(170,190,230,${(0.25 + r.z * 0.3).toFixed(2)})` : `rgba(255,255,255,${(0.35 + r.z * 0.35).toFixed(2)})`;
                    g.lineWidth = r.z * 1.4;
                    g.beginPath(); g.moveTo(r.x, r.y); g.lineTo(r.x - r.len * r.z * slant, r.y - r.len * r.z); g.stroke();
                }
            }
        };
    }

    // ---------------------------------------------------------------------------------------------
    // The board: something rainy in each typed square; a rippling puddle under finished words
    // ---------------------------------------------------------------------------------------------
    const RAINY = [
        `<path d="M0 -.065C.035 -.015 .045 .015 .03 .04C.015 .062 -.015 .062 -.03 .04C-.045 .015 -.035 -.015 0 -.065Z" fill="#6ab4f0"/><ellipse cx="-.012" cy=".02" rx=".008" ry=".014" fill="rgba(255,255,255,.7)"/>`,
        r => `<path d="M-.06 0Q0 -.07 .06 0Q.045 -.012 .03 0Q.015 -.012 0 0Q-.015 -.012 -.03 0Q-.045 -.012 -.06 0Z" fill="${UMBRELLAS[Math.floor(r(1) * 6)]}"/><path d="M0 0V.05Q0 .065 -.014 .06" stroke="#4a4a4a" stroke-width=".008" fill="none"/>`,
        `<path d="M-.03 -.06H.015V.02H.05Q.06 .02 .06 .035V.05H-.03Z" fill="#ffc93a" stroke="#c8962a" stroke-width=".006"/>`,
        `<path d="M-.05 .05Q-.05 -.03 .05 -.05Q.04 .04 -.05 .05Z" fill="#e8963a"/><path d="M-.05 .05L.03 -.03" stroke="#a85a1a" stroke-width=".007"/>`,
        `<circle cx=".008" cy="-.008" r=".03" fill="#c89a6a"/><path d="M.008 -.008m-.015 0a.015 .015 0 1 1 .015 .015" stroke="#8a5a3a" stroke-width=".007" fill="none"/><path d="M-.05 .028H.04Q.05 .028 .05 .018" stroke="#a8c86a" stroke-width=".016" stroke-linecap="round" fill="none"/><path d="M-.045 .02L-.055 -.005M-.035 .02L-.04 -.008" stroke="#a8c86a" stroke-width=".006"/>`,
        `<g fill="#cfd8e4"><circle cx="-.025" cy=".005" r=".022"/><circle cx=".005" cy="-.01" r=".028"/><circle cx=".032" cy=".008" r=".02"/></g><path d="M-.02 .035V.05M0 .035V.055M.02 .035V.05" stroke="#6ab4f0" stroke-width=".008" stroke-linecap="round"/>`
    ];
    const board = Worlds.decoBoard({
        id: "rn",
        mark: r => { const k = RAINY[Math.floor(r(0) * RAINY.length)]; return typeof k === "function" ? k(r) : k; },
        word(entry, cells, rnd, g, across) {
            const [r0, c0] = cells[0], len = cells.length;
            const cx = across ? c0 + len / 2 : c0 + 0.93, cy = across ? r0 + 0.93 : r0 + len / 2;
            const rx = across ? len / 2 - 0.08 : 0.055, ry = across ? 0.055 : len / 2 - 0.08;
            U.svg("ellipse", { cx, cy, rx, ry, class: "rn-puddle" }, g);
            for (let i = 0; i < Math.max(2, len - 1); i++) {
                const u = (i + 0.5 + (rnd(i, 1) - 0.5) * 0.4) / Math.max(2, len - 1) * len;
                const ring = U.svg("ellipse", { cx: across ? c0 + u : cx, cy: across ? cy : r0 + u, rx: across ? 0.09 : 0.035, ry: across ? 0.035 : 0.09, class: "rn-ring" }, g);
                ring.style.animationDelay = (rnd(i, 2) * 2.4).toFixed(2) + "s";
            }
        },
        type(cell) {
            const p = U.center(cell);
            FX.burst({ x: p.x, y: p.y + p.h * 0.2, n: 7, colors: DROPS, shape: "circle", angle: -Math.PI / 2, spread: 1.1, speed: [60, 150], gravity: 520, life: [0.35, 0.6], size: [2, 3.5] });
        },
        wordDone(entry, cells) {
            cells.forEach(([r, c], i) => setTimeout(() => {
                const cell = Game.cellEl(r, c);
                if (!cell) return;
                const p = U.center(cell);
                FX.burst({ x: p.x, y: p.y, n: 7, colors: DROPS, shape: "circle", angle: -Math.PI / 2, spread: 1, speed: [80, 180], gravity: 450, life: [0.5, 0.8], size: [2.5, 4] });
            }, i * 60));
        }
    });

    // ---------------------------------------------------------------------------------------------
    // The win: a downpour, a big umbrella pops open over the board, then the sun and a rainbow
    // ---------------------------------------------------------------------------------------------
    const UMBRELLA = `<svg viewBox="-120 -80 240 150" aria-hidden="true">
        <path d="M-110 0Q-100 -76 0 -78Q100 -76 110 0Q92 -14 73 0Q55 -14 37 0Q18 -14 0 0Q-18 -14 -37 0Q-55 -14 -73 0Q-92 -14 -110 0Z" fill="#ff5a6a"/>
        <path d="M-73 0Q-60 -60 0 -78Q-30 -50 -37 0Q-55 -14 -73 0Z M37 0Q30 -50 0 -78Q60 -60 73 0Q55 -14 37 0Z" fill="#ffc93a"/>
        <path d="M-37 0Q-30 -50 0 -78Q30 -50 37 0Q18 -14 0 0Q-18 -14 -37 0Z" fill="#3aa8ff"/>
        <path d="M0 -78V-88" stroke="#4a4a4a" stroke-width="4"/><path d="M0 0V58Q0 70 -12 68" stroke="#4a4a4a" stroke-width="5" fill="none" stroke-linecap="round"/></svg>`;
    async function celebrate(c, { boardEl }) {
        if (U.motion() === "still") return;
        const W = innerWidth, H = innerHeight, b = boardEl.getBoundingClientRect(), cx = b.left + b.width / 2;
        const overlay = document.getElementById("overlay");
        // 1. the sky darkens and the rain gets heavy
        const dim = U.el("div", { class: "rn-dim" });
        overlay.appendChild(dim);
        c.cleanup(() => dim.remove());
        Sound.play("downpour");
        const pour = () => FX.burst({ x: W / 2, y: -20, jitter: W * 0.6, jitterY: 10, n: U.motion() === "lite" ? 60 : 140, colors: DROPS, shape: "spark", angle: Math.PI / 2 - 0.15, spread: 0.05, speed: [900, 1200], gravity: 300, drag: 0, life: [0.8, 1.1], size: [1.5, 2.5], delay: [0, 0.6] });
        pour();
        await c.wait(600);
        if (c.skipped) return;
        // 2. a big umbrella pops open over the board
        const uw = Math.min(W * 0.8, b.width * 1.3);
        const umb = U.el("div", { class: "rn-umbrella", html: UMBRELLA, style: { left: cx - uw / 2 + "px", top: Math.max(4, b.top - uw * 0.3) + "px", width: uw + "px", height: uw * 0.625 + "px" } });
        overlay.appendChild(umb);
        c.cleanup(() => umb.remove());
        Sound.play("whoosh");
        setTimeout(() => Sound.play("pop"), 250);
        pour();
        await c.wait(700);
        if (c.skipped) return;
        const top = umb.getBoundingClientRect();
        for (let i = 0; i < 3; i++) {                                             // drops bouncing off the canopy
            FX.burst({ x: top.left + top.width / 2, y: top.top + top.height * 0.25, jitter: top.width * 0.4, jitterY: 6, n: 30, colors: DROPS, shape: "circle", angle: -Math.PI / 2, spread: 1.3, speed: [60, 180], gravity: 600, life: [0.4, 0.7], size: [2, 3.5] });
            await c.wait(250);
            if (c.skipped) return;
        }
        // 3. the rain stops: the sun breaks through and a rainbow arcs over the city
        dim.classList.add("clear");
        Sound.play("sunshine");
        const rays = U.el("div", { class: "rn-sun" });
        overlay.appendChild(rays);
        c.cleanup(() => rays.remove());
        const R0 = Math.min(W * 0.55, H * 0.75), band = Math.max(10, R0 * 0.045);
        const arcs = RAINBOW.map((col, i) => { const r = R0 - i * band; return `<path d="M${W / 2 - r} ${H} A${r} ${r} 0 0 1 ${W / 2 + r} ${H}" stroke="${col}" stroke-width="${band + 1}" fill="none" pathLength="1" style="animation-delay:${i * 0.06}s"/>`; }).join("");
        const rb = U.el("div", { class: "sk-rainbow rn-rainbow", html: `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${arcs}</svg>` });
        overlay.appendChild(rb);
        c.cleanup(() => rb.remove());
        umb.animate([{ transform: "none" }, { transform: "translateY(-30px) rotate(-12deg) scale(.9)", opacity: 0 }], { duration: 700, delay: 300, easing: "ease-in", fill: "forwards" });
        await c.wait(1000);
        if (c.skipped) return;
        // 4. glittering droplets
        FX.burst({ x: W / 2, y: H / 2, jitter: W / 2, jitterY: H / 2, n: 50, colors: ["#ffffff", "#cfe8ff", "#fff6c8"], shape: "star", speed: [5, 25], gravity: 30, life: [0.8, 1.4], size: [3, 6], delay: [0, 0.8], spin: 3 });
        Sound.play("sparkle");
        await c.wait(2000);
        rb.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: "forwards" });
        rays.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: "forwards" });
        await c.wait(450);
    }

    // ---------------------------------------------------------------------------------------------
    // Title card: a fogged-up window is wiped clear to show the puzzle's name
    // ---------------------------------------------------------------------------------------------
    async function titleCard(c, info) {
        const drops = Array.from({ length: 14 }, (_, i) => `<i class="tcw-drop" style="left:${(4 + i * 7 + (i * 37) % 5).toFixed(0)}%;top:${((i * 53) % 80).toFixed(0)}%;animation-delay:${((i * 0.29) % 2).toFixed(2)}s"></i>`).join("");
        const card = U.el("div", { class: "tc tc-rain", "aria-hidden": "true", html: `
            <div class="tcw-window"><div class="tcw-text"><small>&#9748; ${U.esc(info.kicker)} &#9748;</small><h2>${U.esc(info.title)}</h2><p>${U.esc(info.sub)}</p></div><i class="tcw-fog"></i>${drops}</div>` });
        document.getElementById("overlay").appendChild(card);
        c.cleanup(() => card.remove());
        Sound.play("title");
        await c.wait(2000);
        if (c.skipped) return;
        card.classList.add("out");
        Sound.play("whoosh");
        await c.wait(450);
    }

    // ---------------------------------------------------------------------------------------------
    // The mascot: Puddles, a frog in a yellow rain hat
    // ---------------------------------------------------------------------------------------------
    function drawPuddles(g, s) {
        const happy = s.mood === "happy", wow = s.mood === "wow", sad = s.mood === "sad";
        const squash = happy ? Math.abs(Math.sin(s.t * 8)) * 0.06 : 0;
        g.save();
        g.translate(80, 148);
        g.scale(1 + squash, 1 - squash);
        g.translate(0, -s.hop * 14);
        // a little puddle under the frog
        g.fillStyle = "rgba(106,180,240,.35)"; g.beginPath(); g.ellipse(0, -2, 44, 7, 0, 0, TAU); g.fill();
        // back legs and feet
        g.fillStyle = "#4aa84a"; g.strokeStyle = "#2a6a2a"; g.lineWidth = 2.5;
        for (const side of [-1, 1]) {
            g.beginPath(); g.ellipse(side * 26, -16, 15, 12, side * 0.4, 0, TAU); g.fill(); g.stroke();
            g.beginPath(); g.ellipse(side * 32, -3, 12, 5, 0, 0, TAU); g.fill(); g.stroke();
        }
        // the body in a yellow raincoat
        g.fillStyle = "#ffc93a"; g.strokeStyle = "#c8962a";
        g.beginPath(); g.moveTo(-26, -6); g.quadraticCurveTo(-32, -50, 0, -54); g.quadraticCurveTo(32, -50, 26, -6); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = "#c8962a"; for (const y of [-40, -28, -16]) { g.beginPath(); g.arc(0, y, 2.5, 0, TAU); g.fill(); }
        // front arms; one waves when happy
        for (const side of [-1, 1]) {
            g.save(); g.translate(side * 22, -36); g.rotate(side * (0.4 + (happy && side > 0 ? Math.sin(s.t * 10) * 0.6 - 1 : 0)));
            g.fillStyle = "#ffc93a"; g.strokeStyle = "#c8962a"; g.beginPath(); g.ellipse(side * 6, 10, 7, 13, 0, 0, TAU); g.fill(); g.stroke();
            g.fillStyle = "#4aa84a"; g.beginPath(); g.arc(side * 7, 23, 5, 0, TAU); g.fill();
            g.restore();
        }
        // the head
        g.translate(0, -64 + Math.sin(s.t * 2) * 1.5);
        g.fillStyle = "#5ac05a"; g.strokeStyle = "#2a6a2a"; g.lineWidth = 2.5;
        g.beginPath(); g.ellipse(0, 0, 34, 22, 0, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = "rgba(255,255,255,.3)"; g.beginPath(); g.ellipse(-14, -8, 9, 4, -0.3, 0, TAU); g.fill();
        // big eyes on top
        const ex = s.look * 2.5;
        for (const side of [-1, 1]) {
            const x = side * 16, y = -20;
            g.fillStyle = "#5ac05a"; g.strokeStyle = "#2a6a2a";
            g.beginPath(); g.arc(x, y, 12, 0, TAU); g.fill(); g.stroke();
            g.fillStyle = "#ffffff"; g.beginPath(); g.arc(x, y, 8.5, 0, TAU); g.fill();
            g.fillStyle = "#1a2a1a";
            if (s.blink > 0.5) { g.fillStyle = "#5ac05a"; g.beginPath(); g.arc(x, y, 9, 0, TAU); g.fill(); g.strokeStyle = "#2a6a2a"; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 7, y + 1); g.lineTo(x + 7, y + 1); g.stroke(); continue; }
            if (happy) { g.lineWidth = 2.6; g.strokeStyle = "#1a2a1a"; g.beginPath(); g.arc(x, y + 3, 5, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); continue; }
            g.beginPath(); g.arc(x + ex, y + (sad ? 2 : 0), wow ? 5.5 : 4.5, 0, TAU); g.fill();
            g.fillStyle = "#ffffff"; g.beginPath(); g.arc(x + ex + 1.5, y - 1.5, 1.5, 0, TAU); g.fill();
        }
        // the yellow rain hat (a sou'wester) perched between the eyes
        g.fillStyle = "#ffc93a"; g.strokeStyle = "#c8962a"; g.lineWidth = 2;
        g.beginPath(); g.ellipse(0, -30, 16, 4, 0, 0, TAU); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(-10, -30); g.quadraticCurveTo(-9, -44, 0, -44); g.quadraticCurveTo(9, -44, 10, -30); g.fill(); g.stroke();
        // cheeks and a wide smile
        g.fillStyle = "rgba(255,130,150,.4)"; g.beginPath(); g.ellipse(-22, 4, 5, 3, 0, 0, TAU); g.ellipse(22, 4, 5, 3, 0, 0, TAU); g.fill();
        const open = Math.max(s.talk, wow ? 0.8 : 0);
        g.strokeStyle = "#1a3a1a"; g.lineWidth = 2.4;
        if (open > 0.1) { g.fillStyle = "#a83a4a"; g.beginPath(); g.ellipse(0, 6, 10, 2 + open * 5, 0, 0, TAU); g.fill(); }
        else { g.beginPath(); g.moveTo(-16, 3); g.quadraticCurveTo(0, sad ? 0 : 13, 16, 3); g.stroke(); }
        g.restore();
    }

    // ---------------------------------------------------------------------------------------------
    // Sounds: soft electric piano chords, water drips and rain
    // ---------------------------------------------------------------------------------------------
    const keys = (t, n, v = 0.05, d = 0.7) => { tone({ t, f: midi(n), type: "sine", d, v, detune: 4 }); tone({ t, f: midi(n), type: "triangle", d: d * 0.5, v: v * 0.3, detune: -4, filt: { f: 1500 } }); };
    const drip = (t, f = 1300, v = 0.07) => tone({ t, f, f2: f * 0.45, type: "sine", d: 0.1, v });
    const sounds = {
        type: () => drip(0, U.pick([1100, 1250, 1400]), 0.07),
        erase: () => drip(0, 800, 0.05),
        move: () => {},
        word: () => [0, 4, 7, 11].forEach((k, i) => keys(i * 0.07, 72 + k, 0.045, 0.6)),
        wrong: () => { keys(0, 62, 0.06, 0.5); keys(0.18, 61, 0.06, 0.6); },
        right: () => [0, 4, 7, 11, 14].forEach((k, i) => keys(i * 0.06, 72 + k, 0.045, 0.6)),
        reveal: () => { drip(0, 1500, 0.06); drip(0.1, 1100, 0.05); keys(0.18, 84, 0.035); },
        flip: () => drip(0, 1600, 0.035),
        downpour: () => { noise({ type: "bandpass", f: 2000, q: 0.4, d: 1.6, v: 0.08, a: 0.3 }); noise({ type: "lowpass", f: 500, d: 1.6, v: 0.08, a: 0.3 }); },
        pop: () => tone({ f: 180, f2: 420, type: "sine", d: 0.12, v: 0.12 }),
        sunshine: () => [[0, [60, 64, 67, 71]], [0.35, [65, 69, 72, 76]]].forEach(([t, ch]) => ch.forEach((n, i) => keys(t + i * 0.03, n + 12, 0.035, 1))),
        sparkle: () => [88, 91, 95].forEach((n, i) => drip(i * 0.08, midi(n), 0.04)),
        win: () => {},
        streak: () => [67, 71, 74, 79].forEach((n, i) => keys(i * 0.08, n + 5, 0.05, 0.5)),
        achievement: () => [72, 76, 79, 83, 86].forEach((n, i) => keys(i * 0.07, n, 0.045, 0.6)),
        title: () => { [0, 0.12, 0.2, 0.33].forEach((t, i) => drip(t, [1300, 1000, 1500, 1150][i], 0.05)); [60, 64, 67, 71].forEach((n, i) => keys(0.4 + i * 0.04, n + 12, 0.035, 1)); },
        tile: i => keys(0, 72 + [0, 2, 4, 7, 9, 11, 12, 14][i % 8], 0.035, 0.3),
        start: () => { [0, 0.1, 0.25].forEach(t => drip(t, 1000 + t * 1600, 0.05)); [60, 64, 67, 71, 74].forEach((n, i) => keys(0.3 + i * 0.05, n + 12, 0.035, 0.9)); },
        select: () => drip(0, 1500, 0.035),
        nav: () => { drip(0, 1100, 0.04); drip(0.07, 1400, 0.035); },
        mascot: () => { tone({ f: 260, f2: 200, type: "sine", d: 0.12, v: 0.08 }); tone({ t: 0.12, f: 300, f2: 220, type: "sine", d: 0.12, v: 0.07 }); }
    };

    Worlds.register({
        id: "rain", name: "Rainy City", icon: "\u{1F327}️", tagline: "Umbrellas & rooftops (city lights in the rain at night)",
        modes: ["light", "dark"],
        scene, board, celebrate, titleCard, sounds, transition: "downpour",
        mascot: { name: "PUDDLES", draw: drawPuddles },
        lines: {
            hello: ["Ribbit! I'm Puddles. Perfect puzzle weather!", "Welcome in out of the rain! Cozy up with a crossword.", "Rainy days are for crosswords!"],
            start: ["Tap a square and start typing. Space flips Across and Down!", "Let's make a splash! Fill every square."],
            word: ["Splash!", "Ribbit-ing!", "Toad-ally right!", "Making waves!", "Drip drop, nice!", "Hop to it!"],
            win: ["The sun came out just for you!", "A rainbow-worthy solve!", "Toad-ally amazing!"],
            wrong: ["Hmm, a few of those are a bit soggy.", "Some letters slipped in the puddles."],
            right: ["Clear skies, all correct!", "Right as rain!"],
            idle: ["Stuck? Try a crossing word, it might clear things up.", "Listen to the rain for a sec, then try the shortest clue."],
            reveal: ["Here's a drop of help...", "Clearing up one square!"]
        },
        introFlourish(stage) {
            const p = U.center(stage);
            FX.ring({ x: p.x, y: p.y, color: "#6ab4f0", r1: Math.max(innerWidth, innerHeight) * 0.6, dur: 1.2, width: 12, glow: false });
            FX.burst({ x: p.x, y: p.y, n: 80, colors: DROPS, shape: "circle", speed: [200, 650], gravity: 500, drag: 0.8, life: [1, 1.8], size: [3, 5] });
        }
    });
})();
