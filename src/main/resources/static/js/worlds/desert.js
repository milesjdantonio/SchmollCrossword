// The DESERT CARAVAN world: rolling dunes, a camel caravan and buried treasure.
//   Day: golden dunes in layers, a blazing sun, heat shimmer over the sand, a distant mesa and pyramid, cacti,
//   a camel caravan plodding along the far ridge and tumbleweeds rolling past.
//   Night: a cold blue desert under a giant moon and the Milky Way, the caravan carrying lanterns, and a
//   crackling campfire in front.
//   Board: each letter leaves a carved desert symbol in its square (a sun, waves, a spiral, mountains, a bird
//   track, a scarab); finished words get a carved sandstone border.
//   Win: a sandstorm sweeps across, then a treasure chest rises from the sand and bursts open with gold and gems.

(() => {
    const TAU = Math.PI * 2;
    const { tone, noise, midi } = Sound;
    const SAND = ["#e8c27a", "#d9a85a", "#f3dca2", "#c48a42"];
    const GOLD = ["#ffd23a", "#ffe680", "#e8a820", "#fff2b0"];
    const GEMS = ["#e8344e", "#2ec4b6", "#7a5cff", "#3ac45a"];
    const dark = () => document.documentElement.dataset.theme === "dark";

    // ---------------------------------------------------------------------------------------------
    // The background
    // ---------------------------------------------------------------------------------------------
    function scene(W, H, opts) {
        const night = opts.theme === "dark", preview = !!opts.preview;
        let sky, stars, dunes, ridgeY, cacti, caravanX = 0, weeds = [], nextWeed = preview ? 999 : U.rand(4, 9), fire, sparks = [];

        // a dune ridge: a smooth wavy line at height y across the width
        const ridge = (x, base, amp, f, ph) => base + Math.sin(x * f + ph) * amp + Math.sin(x * f * 2.3 + ph * 1.7) * amp * 0.35;
        function setup() {
            const R = U.rng(4242);
            sky = null;
            stars = night ? Array.from({ length: preview ? 50 : 220 }, () => { const band = R() < 0.45; const x = R() * W; return { x, y: band ? H * 0.1 + x * 0.25 + (R() - 0.5) * H * 0.18 : R() * H * 0.6, r: 0.5 + R() * 1.4, tw: R() * TAU }; }) : [];
            ridgeY = x => ridge(x, H * 0.6, H * 0.025, 0.004, 1);
            // three layers of dunes, drawn once (the far one also has a mesa and a pyramid)
            dunes = [0, 1, 2].map(i => {
                const c = Worlds.canvas(W + 80, H), g = c.getContext("2d");
                const base = H * [0.6, 0.72, 0.84][i], amp = H * [0.025, 0.04, 0.05][i], f = [0.004, 0.006, 0.005][i], ph = [1, 2.5, 4][i];
                const cols = night ? [["#2a3a5e", "#1e2a48"], ["#24324f", "#1a2440"], ["#1c2840", "#121a30"]][i] : [["#f0c98a", "#dcae68"], ["#e6b468", "#cf9a4e"], ["#dca556", "#c08440"]][i];
                if (i === 0) {
                    g.fillStyle = night ? "#2e3a62" : "#d9a070";                    // a far mesa
                    g.beginPath(); g.moveTo(W * 0.05, base); g.lineTo(W * 0.09, base - H * 0.1); g.lineTo(W * 0.24, base - H * 0.1); g.lineTo(W * 0.28, base); g.fill();
                    g.fillStyle = night ? "rgba(0,0,0,.15)" : "rgba(160,80,40,.2)"; g.fillRect(W * 0.09, base - H * 0.07, W * 0.15, 3);
                    const px = W * 0.7 + 40, ph2 = H * 0.14;                     // a pyramid with a lit and a shaded side
                    g.fillStyle = night ? "#3a4a72" : "#e8c48a"; g.beginPath(); g.moveTo(px - ph2, base + 6); g.lineTo(px, base - ph2); g.lineTo(px + ph2 * 0.3, base + 6); g.fill();
                    g.fillStyle = night ? "#26325a" : "#c49a5e"; g.beginPath(); g.moveTo(px, base - ph2); g.lineTo(px + ph2, base + 6); g.lineTo(px + ph2 * 0.3, base + 6); g.fill();
                }
                const gr = g.createLinearGradient(0, base - amp, 0, H);
                gr.addColorStop(0, cols[0]); gr.addColorStop(1, cols[1]);
                g.fillStyle = gr;
                g.beginPath(); g.moveTo(0, H);
                for (let x = 0; x <= W + 80; x += 8) g.lineTo(x, ridge(x, base, amp, f, ph));
                g.lineTo(W + 80, H); g.fill();
                // the shaded side of each crest and wind ripples in the sand
                g.strokeStyle = night ? "rgba(140,170,230,.15)" : "rgba(255,240,200,.6)"; g.lineWidth = 2;
                g.beginPath(); for (let x = 0; x <= W + 80; x += 8) g[x ? "lineTo" : "moveTo"](x, ridge(x, base, amp, f, ph)); g.stroke();
                g.strokeStyle = night ? "rgba(0,0,0,.15)" : "rgba(150,90,30,.18)"; g.lineWidth = 1.2;
                for (let k = 0; k < 18 + i * 10; k++) {
                    const x = R() * (W + 80), y = ridge(x, base, amp, f, ph) + 10 + R() * (H - base) * 0.8, w = 30 + R() * 60;
                    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 4, x + w, y); g.stroke();
                }
                return c;
            });
            cacti = Array.from({ length: preview ? 2 : 4 }, (_, i) => ({ x: i % 2 ? W * (0.82 + R() * 0.15) : W * (0.03 + R() * 0.15), base: H * (0.86 + R() * 0.08), h: H * (0.14 + R() * 0.1), arms: R() < 0.5 ? 1 : 2 }));
            fire = night ? { x: W * 0.8, y: H * 0.93 } : null;
            caravanX = W * 0.1;
        }
        setup();

        function cactus(g, c, px) {
            const x = c.x - px, w = Math.max(10, c.h * 0.14);
            g.fillStyle = night ? "#142030" : "#3f8a4a";
            g.beginPath(); g.roundRect(x - w / 2, c.base - c.h, w, c.h, w / 2); g.fill();
            for (let a = 0; a < c.arms; a++) {
                const side = a ? 1 : -1, ay = c.base - c.h * (0.45 + a * 0.15);
                g.beginPath(); g.roundRect(side > 0 ? x : x - w * 1.6, ay, w * 1.6, w * 0.8, w * 0.4); g.fill();
                g.beginPath(); g.roundRect(x + side * w * 1.2 - w * 0.4, ay - c.h * 0.3, w * 0.8, c.h * 0.3 + w * 0.6, w * 0.4); g.fill();
            }
            if (!night) { g.strokeStyle = "rgba(255,255,255,.25)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - w * 0.15, c.base - c.h + w); g.lineTo(x - w * 0.15, c.base - 4); g.stroke(); }
        }
        function camel(g, x, y, s, t, ph) {
            const step = Math.sin(t * 3 + ph);
            g.save(); g.translate(x, y); g.scale(s, s);
            g.fillStyle = night ? "#0e1424" : "#8a5a2e";
            g.beginPath(); g.ellipse(0, -22, 16, 9, 0, 0, TAU); g.fill();                         // body
            g.beginPath(); g.ellipse(-2, -30, 8, 7, 0, 0, TAU); g.fill();                         // hump
            g.beginPath(); g.moveTo(13, -24); g.quadraticCurveTo(22, -30, 22, -40); g.lineTo(28, -40); g.lineTo(28, -36); g.lineTo(24, -34); g.quadraticCurveTo(22, -24, 15, -18); g.fill();   // neck and head
            g.strokeStyle = g.fillStyle; g.lineWidth = 3; g.lineCap = "round";
            for (const [lx, k] of [[-10, 1], [-6, -1], [8, -1], [12, 1]]) { g.beginPath(); g.moveTo(lx, -16); g.lineTo(lx + step * k * 3, 0); g.stroke(); }
            if (night) {                                                                          // a lantern hanging from the saddle
                const lg = g.createRadialGradient(-14, -14, 0, -14, -14, 16);
                lg.addColorStop(0, "rgba(255,200,100,.8)"); lg.addColorStop(1, "rgba(255,160,60,0)");
                g.fillStyle = lg; g.beginPath(); g.arc(-14, -14, 16, 0, TAU); g.fill();
                g.fillStyle = "#ffd37a"; g.fillRect(-16, -17, 4, 6);
            }
            g.restore();
        }
        function weed(g, w, t) {
            g.save(); g.translate(w.x, w.y - Math.abs(Math.sin(t * 3 + w.ph)) * 18); g.rotate(w.x * 0.03);
            g.strokeStyle = night ? "rgba(120,130,160,.7)" : "rgba(140,100,50,.85)"; g.lineWidth = 1.5;
            for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; g.beginPath(); g.ellipse(0, 0, w.r, w.r * 0.45, a, 0, TAU); g.stroke(); }
            g.restore();
        }

        return {
            resize(w, h) { W = w; H = h; setup(); },
            draw(g, t, dt, inp) {
                if (!sky) {
                    sky = g.createLinearGradient(0, 0, 0, H * 0.62);
                    if (night) { sky.addColorStop(0, "#060a1e"); sky.addColorStop(0.7, "#14204a"); sky.addColorStop(1, "#2a3a6a"); }
                    else { sky.addColorStop(0, "#5aa8e8"); sky.addColorStop(0.65, "#a8d8f0"); sky.addColorStop(1, "#ffe8b8"); }
                }
                g.fillStyle = sky; g.fillRect(0, 0, W, H);
                if (night) {
                    for (const s of stars) { const tw = Math.abs(Math.sin(t * 0.9 + s.tw)), x = s.x - inp.px * 2; g.fillStyle = `rgba(230,240,255,${(0.25 + 0.75 * tw).toFixed(2)})`; g.fillRect(x, s.y, s.r, s.r); if (s.r > 1.2) Worlds.twinkle(g, x + s.r / 2, s.y + s.r / 2, s.r, tw, "rgb(230,240,255)"); }
                    const mx = W * 0.3 - inp.px * 3, my = H * 0.24, mr = Math.min(W, H) * 0.13;           // a giant moon
                    const mg = g.createRadialGradient(mx, my, mr, mx, my, mr * 2.6);
                    mg.addColorStop(0, "rgba(200,220,255,.25)"); mg.addColorStop(1, "rgba(200,220,255,0)");
                    g.fillStyle = mg; g.fillRect(mx - mr * 3, my - mr * 3, mr * 6, mr * 6);
                    const mf = g.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.2, mx, my, mr);
                    mf.addColorStop(0, "#fbf8ec"); mf.addColorStop(1, "#d8d4c4");
                    g.fillStyle = mf; g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill();
                    g.fillStyle = "rgba(150,150,140,.25)";
                    for (const [dx, dy, r] of [[-0.3, -0.2, 0.18], [0.25, 0.1, 0.24], [-0.1, 0.4, 0.12], [0.4, -0.35, 0.1]]) { g.beginPath(); g.arc(mx + dx * mr, my + dy * mr, r * mr, 0, TAU); g.fill(); }
                } else {
                    const sx = W * 0.78 - inp.px * 3, sy = H * 0.16, sr = Math.min(W, H) * 0.075;          // a blazing sun
                    const sg = g.createRadialGradient(sx, sy, sr * 0.8, sx, sy, sr * 5);
                    sg.addColorStop(0, "rgba(255,250,220,.95)"); sg.addColorStop(0.25, "rgba(255,230,160,.4)"); sg.addColorStop(1, "rgba(255,220,150,0)");
                    g.fillStyle = sg; g.fillRect(0, 0, W, H * 0.7);
                    g.fillStyle = "#fffbe8"; g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.fill();
                }
                g.drawImage(dunes[0], -40 - inp.px * 5, 0);
                // the caravan plodding along the far ridge
                caravanX += dt * 9; if (caravanX > W + 220) caravanX = -200;
                const cs = U.clamp(H / 1100, 0.45, 0.9);
                for (let i = 0; i < 4; i++) { const x = caravanX - i * 55 * cs; camel(g, x - inp.px * 5, ridgeY(x + 40) + 2, cs * (i === 3 ? 0.8 : 1), t, i * 1.3); }
                // heat shimmer: wavering light bands just above the sand (day)
                if (!night) for (let i = 0; i < 5; i++) {
                    const y = H * 0.56 + i * 6, a = 0.06 + 0.04 * Math.sin(t * 3 + i);
                    g.strokeStyle = `rgba(255,250,235,${a.toFixed(3)})`; g.lineWidth = 3;
                    g.beginPath(); for (let x = 0; x <= W; x += 20) g[x ? "lineTo" : "moveTo"](x, y + Math.sin(x * 0.03 + t * 4 + i) * 2); g.stroke();
                }
                g.drawImage(dunes[1], -40 - inp.px * 10, 0);
                for (const c of cacti) cactus(g, c, inp.px * 16);
                g.drawImage(dunes[2], -40 - inp.px * 18, 0);
                // the campfire (night): logs, dancing flames, a warm glow and rising sparks
                if (fire) {
                    const x = fire.x - inp.px * 18, y = fire.y, fl = 0.85 + 0.15 * Math.sin(t * 11) * Math.sin(t * 7.1);
                    const gl = g.createRadialGradient(x, y - 10, 0, x, y - 10, 140 * fl);
                    gl.addColorStop(0, "rgba(255,170,80,.45)"); gl.addColorStop(1, "rgba(255,120,40,0)");
                    g.fillStyle = gl; g.beginPath(); g.arc(x, y - 10, 140 * fl, 0, TAU); g.fill();
                    g.fillStyle = "#3a2214"; g.save(); g.translate(x, y); g.rotate(0.3); g.fillRect(-22, -4, 44, 8); g.rotate(-0.6); g.fillRect(-22, -4, 44, 8); g.restore();
                    for (const [col, s, ph] of [["#ff5a1a", 1, 0], ["#ffa020", 0.72, 1.3], ["#ffe680", 0.42, 2.1]]) {
                        const h = 46 * s * fl;
                        g.fillStyle = col;
                        g.beginPath(); g.moveTo(x - 16 * s, y - 2); g.quadraticCurveTo(x - 14 * s, y - h * 0.6, x + Math.sin(t * 8 + ph) * 5, y - h); g.quadraticCurveTo(x + 14 * s, y - h * 0.6, x + 16 * s, y - 2); g.fill();
                    }
                    if (Math.random() < dt * 8) sparks.push({ x, y: y - 30, vx: (Math.random() - 0.5) * 20, vy: -40 - Math.random() * 40, life: 1.5 });
                }
                sparks = sparks.filter(s => (s.life -= dt) > 0);
                // campfire sparks: they wiggle up, glowing, and wink out
                for (const s of sparks) { s.x += s.vx * dt + Math.sin(t * 6 + s.vy) * 0.3; s.y += s.vy * dt; const a = (s.life / 1.5) * (0.7 + 0.3 * Math.sin(t * 17 + s.vx)); g.fillStyle = `rgba(255,${170 + Math.round(a * 60)},90,${a.toFixed(2)})`; g.fillRect(s.x, s.y, 2, 2); Worlds.glow(g, s.x + 1, s.y + 1, 7, "#ffb050", a * 0.55); }
                // tumbleweeds rolling by
                nextWeed -= dt;
                if (nextWeed <= 0) { weeds.push({ x: -40, y: H * U.rand(0.86, 0.95), vx: U.rand(60, 110), r: U.rand(12, 22), ph: Math.random() * TAU }); nextWeed = U.rand(9, 18); }
                weeds = weeds.filter(w => (w.x += w.vx * dt) < W + 60);
                for (const w of weeds) weed(g, w, t);
                // blowing sand drifting low over the ground
                g.fillStyle = night ? "rgba(160,180,220,.2)" : "rgba(255,235,190,.5)";
                for (let i = 0; i < (preview ? 15 : 50); i++) { const x = (i * 131.7 + t * (40 + i % 7 * 12)) % (W + 40) - 20, y = H * 0.8 + ((i * 37) % 100) / 100 * H * 0.2 + Math.sin(t * 2 + i) * 3; g.fillRect(x, y, 3, 1); }
            }
        };
    }

    // ---------------------------------------------------------------------------------------------
    // The board: a carved symbol in each typed square; a sandstone border along finished words
    // ---------------------------------------------------------------------------------------------
    const GLYPHS = [
        `<circle r=".035" class="ds-carve"/><g class="ds-carve-line">${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<path d="M0 -.05V-.068" transform="rotate(${a})"/>`).join("")}</g>`,
        `<path d="M-.06 -.02Q-.045 -.04 -.03 -.02T0 -.02T.03 -.02T.06 -.02M-.06 .02Q-.045 0 -.03 .02T0 .02T.03 .02T.06 .02" class="ds-carve-line"/>`,
        `<path d="M0 0Q.02 -.02 .03 0Q.03 .04 0 .04Q-.05 .04 -.05 0Q-.05 -.06 0 -.06Q.06 -.06 .06 0" class="ds-carve-line"/>`,
        `<path d="M-.065 .04L-.025 -.03L0 .01L.025 -.045L.065 .04Z" class="ds-carve-line"/>`,
        `<path d="M0 .05V-.01M0 -.01L-.035 -.05M0 -.01L.035 -.05M0 -.01V-.06" class="ds-carve-line"/>`,
        `<ellipse cy=".01" rx=".032" ry=".042" class="ds-carve"/><path d="M0 -.03V.05M-.032 -.045L-.05 -.06M.032 -.045L.05 -.06M-.03 .02L-.055 .03M.03 .02L.055 .03" class="ds-carve-line"/>`
    ];
    const board = Worlds.decoBoard({
        id: "ds",
        mark: r => GLYPHS[Math.floor(r(0) * GLYPHS.length)],
        word(entry, cells, rnd, g, across) {
            const [r0, c0] = cells[0], len = cells.length;
            const line = off => across ? `M${c0 + 0.06} ${r0 + off}H${c0 + len - 0.06}` : `M${c0 + off} ${r0 + 0.06}V${r0 + len - 0.06}`;
            U.svg("path", { d: line(0.9), class: "ds-border", pathLength: "1" }, g);
            U.svg("path", { d: line(0.955), class: "ds-border thin", pathLength: "1" }, g);
            for (let i = 0; i < len * 4; i++) {
                const u = 0.12 + i / (len * 4) * (len - 0.24);
                U.svg("rect", { x: (across ? c0 + u : c0 + 0.915).toFixed(3), y: (across ? r0 + 0.915 : r0 + u).toFixed(3), width: ".025", height: ".025", class: "ds-dot", transform: `rotate(45 ${(across ? c0 + u + 0.0125 : c0 + 0.9275).toFixed(3)} ${(across ? r0 + 0.9275 : r0 + u + 0.0125).toFixed(3)})` }, g);
            }
        },
        type(cell) {
            const p = U.center(cell);
            FX.burst({ x: p.x, y: p.y + p.h * 0.25, n: 7, colors: SAND, shape: "circle", angle: -Math.PI / 2, spread: 1.4, speed: [40, 120], gravity: 300, drag: 1.5, life: [0.35, 0.6], size: [1.5, 3] });
        },
        wordDone(entry, cells) {
            cells.forEach(([r, c], i) => setTimeout(() => {
                const cell = Game.cellEl(r, c);
                if (!cell) return;
                const p = U.center(cell);
                FX.burst({ x: p.x, y: p.y, n: 5, colors: GOLD, shape: "star", speed: [40, 120], gravity: 100, life: [0.5, 0.8], size: [3, 5], spin: 4 });
            }, i * 60));
        }
    });

    // ---------------------------------------------------------------------------------------------
    // The win: a sandstorm sweeps across, then a treasure chest rises and bursts open
    // ---------------------------------------------------------------------------------------------
    const CHEST = `<svg viewBox="0 0 160 130" aria-hidden="true">
        <g class="ds-lid"><path d="M10 50Q10 14 80 12Q150 14 150 50Z" fill="#8a4a1e"/><path d="M10 50Q10 14 80 12Q150 14 150 50" fill="none" stroke="#e8a820" stroke-width="6"/>
        <path d="M40 18V50M120 18V50" stroke="#e8a820" stroke-width="6"/></g>
        <rect x="10" y="50" width="140" height="74" rx="6" fill="#a65a24"/><path d="M10 64H150" stroke="#7a3e14" stroke-width="3"/>
        <path d="M40 50V124M120 50V124" stroke="#e8a820" stroke-width="6"/><rect x="10" y="50" width="140" height="74" rx="6" fill="none" stroke="#e8a820" stroke-width="6"/>
        <rect x="68" y="56" width="24" height="26" rx="4" fill="#ffd23a" stroke="#a87a10" stroke-width="2"/><circle cx="80" cy="66" r="4" fill="#5a3a10"/><path d="M80 66V75" stroke="#5a3a10" stroke-width="3"/>
        </svg>`;
    async function celebrate(c, { boardEl }) {
        if (U.motion() === "still") return;
        const W = innerWidth, H = innerHeight, b = boardEl.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
        const overlay = document.getElementById("overlay");
        // 1. a sandstorm blows across the screen
        Sound.play("wind");
        FX.burst({ x: W + 30, y: H / 2, jitter: 10, jitterY: H / 2, n: U.motion() === "lite" ? 120 : 260, colors: SAND, shape: "spark", angle: Math.PI, spread: 0.12, speed: [700, 1300], gravity: 0, drag: 0.2, life: [1.2, 1.8], size: [2, 4], delay: [0, 0.8] });
        FX.shake(4, 900);
        await c.wait(1300);
        if (c.skipped) return;
        // 2. a treasure chest rises out of the sand in front of the board
        const chest = U.el("div", { class: "ds-chest", html: `<i class="ds-rays"></i>${CHEST}`, style: { left: cx - 90 + "px", top: cy - 70 + "px" } });
        overlay.appendChild(chest);
        FX.follow(c, boardEl, chest);
        c.cleanup(() => chest.remove());
        Sound.play("thud");
        chest.animate([{ transform: "translateY(60px) scale(.3)", opacity: 0 }, { transform: "translateY(-10px) scale(1.05)", opacity: 1, offset: 0.7 }, { transform: "none", opacity: 1 }], { duration: 700, easing: "ease-out", fill: "backwards" });
        await c.wait(800);
        if (c.skipped) return;
        // 3. it wobbles, then bursts open
        chest.animate([{ transform: "none" }, { transform: "rotate(-6deg)" }, { transform: "rotate(6deg)" }, { transform: "none" }], { duration: 400 });
        Sound.play("rattle");
        await c.wait(500);
        if (c.skipped) return;
        chest.classList.add("open");
        Sound.play("treasure");
        const p = U.center(chest);
        FX.flash("#fff2b0", 400, 0.5);
        FX.burst({ x: p.x, y: p.y - 20, n: 90, colors: GOLD, shape: "circle", angle: -Math.PI / 2, spread: 0.9, speed: [300, 800], gravity: 900, drag: 0.4, life: [1.6, 2.4], size: [5, 8] });
        FX.burst({ x: p.x, y: p.y - 20, n: 30, colors: GEMS, shape: "star", angle: -Math.PI / 2, spread: 0.7, speed: [300, 700], gravity: 700, life: [1.6, 2.2], size: [6, 10], spin: 6 });
        await c.wait(1200);
        if (c.skipped) return;
        // 4. glints over everything
        FX.burst({ x: W / 2, y: H / 2, jitter: W / 2, jitterY: H / 2, n: 40, colors: GOLD, shape: "star", speed: [5, 20], gravity: 0, life: [0.8, 1.4], size: [4, 8], delay: [0, 1], spin: 3 });
        Sound.play("sparkle");
        await c.wait(1600);
        chest.animate([{ opacity: 1 }, { opacity: 0, transform: "scale(.6)" }], { duration: 400, fill: "forwards" });
        await c.wait(350);
    }

    // ---------------------------------------------------------------------------------------------
    // Title card: a papyrus scroll unrolls
    // ---------------------------------------------------------------------------------------------
    async function titleCard(c, info) {
        const card = U.el("div", { class: "tc tc-desert", "aria-hidden": "true", html: `
            <div class="tcd-scroll"><i class="tcd-roll l"></i><div class="tcd-paper"><small>&#9728; ${U.esc(info.kicker)} &#9728;</small><h2>${U.esc(info.title)}</h2><p>${U.esc(info.sub)}</p></div><i class="tcd-roll r"></i></div>` });
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
    // The mascot: Sandy, a fennec fox with enormous ears
    // ---------------------------------------------------------------------------------------------
    function drawSandy(g, s) {
        const happy = s.mood === "happy", wow = s.mood === "wow", sad = s.mood === "sad";
        g.save();
        g.translate(80, 146 - s.hop * 12);
        // the bushy tail, swishing
        g.save(); g.translate(26, -18); g.rotate(-0.5 + Math.sin(s.t * (happy ? 9 : 2.5)) * (happy ? 0.35 : 0.15));
        g.fillStyle = "#e8a85a"; g.beginPath(); g.ellipse(18, -6, 24, 11, -0.4, 0, TAU); g.fill();
        g.fillStyle = "#fff4e0"; g.beginPath(); g.ellipse(36, -14, 9, 7, -0.4, 0, TAU); g.fill();
        g.restore();
        // the body
        g.fillStyle = "#f0b868"; g.strokeStyle = "#a8682a"; g.lineWidth = 2.5;
        g.beginPath(); g.ellipse(0, -24, 26, 24, 0, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = "#fff4e0"; g.beginPath(); g.ellipse(0, -18, 15, 16, 0, 0, TAU); g.fill();
        // paws
        g.fillStyle = "#f0b868";
        for (const side of [-1, 1]) { g.beginPath(); g.ellipse(side * 12, -2, 9, 6, 0, 0, TAU); g.fill(); g.stroke(); }
        // a little blue scarf
        g.fillStyle = "#2e8ac4"; g.beginPath(); g.ellipse(0, -44, 20, 6, 0, 0, TAU); g.fill();
        g.beginPath(); g.moveTo(8, -42); g.lineTo(18, -26 + Math.sin(s.t * 5) * 2); g.lineTo(10, -28); g.fill();
        // the head and HUGE ears
        g.translate(0, -70 + Math.sin(s.t * 2) * 1.5);
        g.rotate(s.look * 0.06);
        for (const side of [-1, 1]) {
            g.save(); g.translate(side * 14, -14); g.rotate(side * (0.45 + (wow ? -0.15 : sad ? 0.35 : 0) + Math.sin(s.t * 1.7 + side) * 0.04));
            g.fillStyle = "#f0b868"; g.strokeStyle = "#a8682a";
            g.beginPath(); g.moveTo(-14, 6); g.quadraticCurveTo(-12, -40, 0, -52); g.quadraticCurveTo(12, -40, 14, 6); g.closePath(); g.fill(); g.stroke();
            g.fillStyle = "#ffc8b0"; g.beginPath(); g.moveTo(-8, 2); g.quadraticCurveTo(-6, -32, 0, -42); g.quadraticCurveTo(6, -32, 8, 2); g.closePath(); g.fill();
            g.restore();
        }
        g.fillStyle = "#f0b868"; g.strokeStyle = "#a8682a";
        g.beginPath(); g.ellipse(0, 0, 26, 22, 0, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = "#fff4e0"; g.beginPath(); g.moveTo(-20, 6); g.quadraticCurveTo(0, -4, 20, 6); g.quadraticCurveTo(10, 20, 0, 22); g.quadraticCurveTo(-10, 20, -20, 6); g.fill();
        g.fillStyle = "#2a1a10"; g.beginPath(); g.ellipse(0, 8, 4.5, 3.2, 0, 0, TAU); g.fill();
        const ex = s.look * 2.5;
        for (const side of [-1, 1]) {
            const x = side * 10 + ex, y = -4;
            g.fillStyle = "#2a1a10";
            if (s.blink > 0.5) { g.fillRect(x - 4, y, 8, 2.2); continue; }
            if (happy) { g.lineWidth = 2.4; g.strokeStyle = "#2a1a10"; g.beginPath(); g.arc(x, y + 2, 4, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); continue; }
            g.beginPath(); g.ellipse(x, y, wow ? 4.5 : 3.6, wow ? 5.5 : 4.6, 0, 0, TAU); g.fill();
            g.fillStyle = "#ffffff"; g.beginPath(); g.arc(x + 1.2, y - 1.6, 1.3, 0, TAU); g.fill();
        }
        const open = Math.max(s.talk, wow ? 0.7 : 0);
        g.strokeStyle = "#2a1a10"; g.lineWidth = 1.8;
        if (open > 0.1) { g.fillStyle = "#7a2a2a"; g.beginPath(); g.ellipse(0, 15, 3.5, 1.5 + open * 3.5, 0, 0, TAU); g.fill(); }
        else { g.beginPath(); g.moveTo(-5, 13); g.quadraticCurveTo(0, sad ? 11 : 17, 5, 13); g.stroke(); }
        g.restore();
    }

    // ---------------------------------------------------------------------------------------------
    // Sounds: plucked strings, hand drums and desert wind
    // ---------------------------------------------------------------------------------------------
    const pluck = (t, n, v = 0.07) => { tone({ t, f: midi(n), type: "triangle", d: 0.45, v, a: 0.003, filt: { f: 2200 } }); tone({ t, f: midi(n) * 2, type: "sine", d: 0.15, v: v * 0.3 }); };
    const drum = (t, f = 110, v = 0.18) => tone({ t, f, f2: f * 0.55, type: "sine", d: 0.18, v });
    const sounds = {
        type: () => drum(0, U.pick([160, 180, 200]), 0.12),
        erase: () => drum(0, 120, 0.1),
        move: () => {},
        word: () => [62, 65, 67, 69].forEach((n, i) => pluck(i * 0.08, n + 12, 0.06)),
        wrong: () => { pluck(0, 57, 0.1); pluck(0.16, 56, 0.1); },
        right: () => [62, 65, 67, 69, 74].forEach((n, i) => pluck(i * 0.07, n + 12, 0.06)),
        reveal: () => { noise({ type: "bandpass", f: 600, f2: 1400, d: 0.5, v: 0.08, q: 0.8 }); pluck(0.15, 81, 0.05); },
        flip: () => pluck(0, 86, 0.035),
        wind: () => noise({ type: "bandpass", f: 400, f2: 1400, d: 1.4, v: 0.16, q: 0.6 }),
        thud: () => { drum(0, 90, 0.3); noise({ type: "lowpass", f: 400, d: 0.3, v: 0.15 }); },
        rattle: () => [0, 0.08, 0.16].forEach(t => drum(t, 140, 0.1)),
        treasure: () => { drum(0, 80, 0.25); [74, 77, 81, 86, 89, 93].forEach((n, i) => pluck(0.05 + i * 0.05, n, 0.06)); },
        sparkle: () => [86, 89, 93].forEach((n, i) => tone({ t: i * 0.08, f: midi(n), type: "sine", d: 0.5, v: 0.035, echo: 0.3 })),
        win: () => {},
        streak: () => [62, 65, 69, 74].forEach((n, i) => pluck(i * 0.08, n + 12, 0.06)),
        achievement: () => { drum(0, 100, 0.2); [74, 77, 81, 86].forEach((n, i) => pluck(0.08 + i * 0.08, n, 0.06)); },
        title: () => { noise({ type: "bandpass", f: 300, f2: 900, d: 0.8, v: 0.08, q: 0.6 }); drum(0.1, 90, 0.2); [62, 65, 69].forEach((n, i) => pluck(0.35 + i * 0.12, n + 12, 0.06)); },
        tile: i => pluck(0, 74 + [0, 3, 5, 7, 10, 12, 15, 17][i % 8], 0.05),
        start: () => { [0, 0.15, 0.3].forEach(t => drum(t, 100, 0.2)); [62, 65, 67, 69, 74].forEach((n, i) => pluck(0.45 + i * 0.07, n + 12, 0.06)); },
        select: () => pluck(0, 81, 0.035),
        nav: () => noise({ type: "bandpass", f: 500, f2: 1200, d: 0.3, v: 0.06, q: 0.8 }),
        mascot: () => { tone({ f: 900, f2: 1300, type: "sine", d: 0.07, v: 0.05 }); tone({ t: 0.08, f: 1100, f2: 1500, type: "sine", d: 0.07, v: 0.04 }); }
    };

    Worlds.register({
        id: "desert", name: "Desert Caravan", icon: "\u{1F3DC}️", tagline: "Golden Dunes. Endless Sky.",
        modes: ["light", "dark"],
        scene, board, celebrate, titleCard, sounds, transition: "sandstorm",
        mascot: { name: "SANDY", draw: drawSandy },
        lines: {
            hello: ["Hi, I'm Sandy! My ears heard a puzzle coming.", "Welcome to the desert! Plenty of words buried here.", "Grab some water, it's puzzle time!"],
            start: ["Tap a square and start typing. Space flips Across and Down!", "Dig in! Every answer is buried treasure."],
            word: ["Dune-derful!", "Treasure found!", "Golden!", "Sand-sational!", "What a find!", "Struck gold!"],
            win: ["You found the treasure!", "A legendary expedition!", "The caravan is throwing you a party!"],
            wrong: ["Hmm, a few of those are mirages.", "Some letters got lost in the sand."],
            right: ["Pure gold, every letter!", "Not a grain out of place!"],
            idle: ["Stuck? Try a crossing word, it might point the way.", "Every oasis starts with one letter. Try the shortest clue!"],
            reveal: ["Brushing off a hint...", "Here's a clue from my map!"]
        },
        introFlourish(stage) {
            const p = U.center(stage);
            FX.ring({ x: p.x, y: p.y, color: "#e8a820", r1: Math.max(innerWidth, innerHeight) * 0.6, dur: 1.2, width: 14, glow: false });
            FX.burst({ x: p.x, y: p.y, n: 70, colors: GOLD, shape: "circle", speed: [200, 650], gravity: 300, drag: 1, life: [1.2, 2], size: [4, 7] });
        }
    });
})();
