// The SNOW DAY world: a quiet winter valley.
//   Background: snowy mountains and two rows of pine forest in parallax, a log cabin with glowing windows and
//   chimney smoke, snow falling in three depths with wind gusts, glints on the snow, a fox trotting by (leaving
//   footprints) and a cardinal flying past. At night: the moon, stars, shooting stars and the northern lights.
//   Board: frosted squares under a cap of snow; every letter grows a snowflake crystal, finished words frost over
//   with feathery ice, and icicles grow under the board as it fills up.
//   Win: the board freezes, a snow globe forms around it and gets shaken, it bursts, and a snowman builds itself.

(() => {
    const TAU = Math.PI * 2;
    const { tone, noise, midi } = Sound;
    const ICE = ["#ffffff", "#e3f3ff", "#bfe3ff", "#9fd2f7"];

    // The background is SnowScene (snow-scene.js)

    // ---------------------------------------------------------------------------------------------
    // The board: snow on top, a crystal on every letter, frost on finished words, icicles underneath
    // ---------------------------------------------------------------------------------------------
    // one arm of a snowflake crystal (from the middle to the tip at y = -1); each kind branches differently
    const ARMS = [
        "M0 0V-1M0 -.45L-.24 -.66M0 -.45L.24 -.66M0 -.72L-.15 -.86M0 -.72L.15 -.86",
        "M0 0V-1M-.13 -.78L0 -.9L.13 -.78M0 -.36L-.2 -.48M0 -.36L.2 -.48",
        "M0 0V-1M0 -.3L-.26 -.42M0 -.3L.26 -.42M0 -.5L-.22 -.64M0 -.5L.22 -.64M0 -.7L-.14 -.82M0 -.7L.14 -.82",
        "M0 0V-.86M-.12 -.74L0 -1L.12 -.74M0 -.5L-.17 -.6M0 -.5L.17 -.6",
        "M0 -.2V-1M0 -.32L-.3 -.56M0 -.32L.3 -.56M0 -.62L-.2 -.8M0 -.62L.2 -.8"
    ];
    const HEX = "M0 -.22L.19 -.11L.19 .11L0 .22L-.19 .11L-.19 -.11Z";

    const board = (() => {
        let layer = null, gFrost, gFlake, icicles = [], crystals = new Map(), frosts = new Map(), seed = 1, size = 5, quiet = true, boardRef = null;
        const rnd = (...k) => { let h = seed; for (const v of k) { h = Math.imul(h ^ v, 2654435761); h ^= h >>> 13; } return (h >>> 0) / 4294967296; };

        function build(game, boardEl) {
            if (layer) layer.remove();
            size = game.puzzle.size;
            seed = U.hash(game.puzzle.seed + game.puzzle.mode + "snow");
            boardRef = boardEl;
            layer = U.svg("svg", { class: "snow-layer", viewBox: `0 0 ${size} ${size}`, preserveAspectRatio: "none", "aria-hidden": "true" });
            boardEl.appendChild(layer);
            gFrost = U.svg("g", {}, layer);
            gFlake = U.svg("g", {}, layer);
            const gIce = U.svg("g", {}, layer);
            // a cap of snow piled along the top edge, in soft lumps
            let d = `M-.07 .025 Q-.08 -.06 -.02 -.07`;
            const lumps = size * 2;
            for (let i = 0; i < lumps; i++) {
                const x1 = (i + 1) / lumps * size + (i === lumps - 1 ? 0.02 : 0), xm = (i + 0.5) / lumps * size;
                d += ` Q${xm.toFixed(3)} ${(-0.1 - rnd(i, 1) * 0.12).toFixed(3)} ${x1.toFixed(3)} ${(-0.05 - rnd(i, 2) * 0.03).toFixed(3)}`;
            }
            d += ` Q${size + 0.08} -.06 ${size + 0.07} .025 Q${size / 2} .045 -.07 .025Z`;
            U.svg("path", { d, class: "sn-cap" }, layer);
            // icicles hanging under the board; they grow as the squares fill up
            icicles = [];
            const n = size * 3;
            for (let i = 0; i < n; i++) {
                const x = (i + 0.25 + rnd(i, 7) * 0.5) / n * size, len = 0.1 + rnd(i, 8) * 0.2, w = 0.03 + rnd(i, 9) * 0.025;
                const el = U.svg("path", { d: `M${(x - w).toFixed(3)} ${size} Q${(x - w * 0.3).toFixed(3)} ${(size + len * 0.55).toFixed(3)} ${x.toFixed(3)} ${(size + len).toFixed(3)} Q${(x + w * 0.3).toFixed(3)} ${(size + len * 0.55).toFixed(3)} ${(x + w).toFixed(3)} ${size}Z`, class: "sn-icicle" }, gIce);
                el.style.transform = "scaleY(0)";
                icicles.push({ el, at: rnd(i, 10) });
            }
            crystals = new Map();
            frosts = new Map();
        }

        function crystal(r, c, grow) {
            const kind = Math.floor(rnd(r, c, 3) * ARMS.length);
            const [ox, oy] = [[0.8, 0.22], [0.8, 0.78], [0.21, 0.79]][Math.floor(rnd(r, c, 4) * 3)];
            const x = c + ox + (rnd(r, c, 5) - 0.5) * 0.06, y = r + oy + (rnd(r, c, 6) - 0.5) * 0.06, s = 0.1 + rnd(r, c, 7) * 0.05;
            const outer = U.svg("g", { transform: `translate(${x.toFixed(3)} ${y.toFixed(3)}) scale(${s.toFixed(3)})`, class: "sn-crystal" + (grow ? " grow" : "") }, gFlake);
            const spin = U.svg("g", { class: "sn-spin", style: `animation-duration:${(16 + rnd(r, c, 8) * 14).toFixed(1)}s` }, outer);
            for (let i = 0; i < 6; i++) U.svg("path", { d: ARMS[kind], transform: `rotate(${i * 60})`, pathLength: 1 }, spin);
            if (kind % 2 === 0) U.svg("path", { d: HEX, pathLength: 1 }, spin);
            return outer;
        }

        // feathery frost along a finished word: on the bottom edge of an across word, the right edge of a down word
        function frost(entry, cells, grow) {
            const across = entry.direction === "across", [r0, c0] = cells[0], len = cells.length, steps = len * 7;
            const gEl = U.svg("g", { class: "sn-frost" + (grow ? " grow" : "") }, gFrost);
            const pts = [];
            for (let i = 0; i <= steps; i++) {
                const u = 0.08 + i / steps * (len - 0.16), wob = (rnd(entry.number, across ? 11 : 12, i) - 0.5) * 0.025;
                pts.push(across ? [c0 + u, r0 + 0.935 + wob] : [c0 + 0.935 + wob, r0 + u]);
            }
            U.svg("polyline", { points: pts.map(p => p.map(v => v.toFixed(3)).join(",")).join(" "), pathLength: 1, class: "sn-frost-main" }, gEl);
            let d = "";
            for (let i = 1; i < steps; i++) {
                const [x, y] = pts[i], l = 0.03 + rnd(entry.number, across ? 13 : 14, i) * 0.05;
                if (across) d += `M${x.toFixed(3)} ${y.toFixed(3)}l${(-0.55 * l).toFixed(3)} ${(-l).toFixed(3)}M${x.toFixed(3)} ${y.toFixed(3)}l${(0.55 * l).toFixed(3)} ${(-l).toFixed(3)}`;
                else d += `M${x.toFixed(3)} ${y.toFixed(3)}l${(-l).toFixed(3)} ${(-0.55 * l).toFixed(3)}M${x.toFixed(3)} ${y.toFixed(3)}l${(-l).toFixed(3)} ${(0.55 * l).toFixed(3)}`;
            }
            U.svg("path", { d, pathLength: 1, class: "sn-frost-feather" }, gEl);
            return gEl;
        }

        function attach() { quiet = true; }
        function update(game, boardEl) {
            if (!layer || !boardEl.contains(layer) || size !== game.puzzle.size) { build(game, boardEl); quiet = true; }
            const grow = !quiet && U.motion() !== "still";
            quiet = false;
            const n = game.puzzle.size, sol = game.puzzle.solution;
            let open = 0, filled = 0;
            const want = new Set();
            for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
                if (sol[r][c] === ".") continue;           // a black square
                open++;
                if (!game.letters[r][c]) continue;
                filled++;
                const key = r * 99 + c;
                want.add(key);
                if (!crystals.has(key)) crystals.set(key, crystal(r, c, grow));
            }
            for (const [key, el] of crystals) if (!want.has(key)) { el.remove(); crystals.delete(key); }
            const full = new Set(), iced = new Set();
            for (const entry of [...game.puzzle.across, ...game.puzzle.down]) {
                const cells = Game.cellsOf(entry);
                if (!cells.every(([r, c]) => game.letters[r][c])) continue;
                const key = entry.direction + entry.number;
                full.add(key);
                cells.forEach(([r, c]) => iced.add(r * 99 + c));
                if (!frosts.has(key)) frosts.set(key, frost(entry, cells, grow));
            }
            for (const [key, el] of frosts) if (!full.has(key)) { el.remove(); frosts.delete(key); }
            for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { const cell = Game.cellEl(r, c); if (cell) cell.classList.toggle("sn-iced", iced.has(r * 99 + c)); }
            const progress = open ? filled / open : 0;
            for (const ic of icicles) ic.el.style.transform = `scaleY(${U.clamp((progress - ic.at * 0.8) / 0.2, 0, 1).toFixed(3)})`;
            boardEl.classList.toggle("sn-frozen", !!(game.solved && !game.surrendered));
        }
        function type(cell) {
            const p = U.center(cell);
            FX.burst({ x: p.x, y: p.y + p.h * 0.1, n: 12, colors: ICE, shape: "circle", speed: [40, 130], angle: -Math.PI / 2, spread: 1.4, gravity: 160, drag: 2, life: [0.45, 0.85], size: [1.2, 2.8] });
        }
        function wordDone(entry, cells) {
            cells.forEach(([r, c], i) => setTimeout(() => {
                const cell = Game.cellEl(r, c);
                if (!cell) return;
                const p = U.center(cell);
                FX.burst({ x: p.x, y: p.y, n: 4, colors: ICE, shape: "flake", speed: [30, 90], gravity: 20, drag: 1.5, life: [0.6, 1], size: [4, 7], spin: 2, glow: document.documentElement.dataset.theme === "dark" });
                FX.ring({ x: p.x, y: p.y, color: "#bfe3ff", r0: 3, r1: p.w * 0.6, dur: 0.45, width: 3 });
            }, i * 60));
        }
        function restoreSolved(boardEl, game) { quiet = true; update(game, boardEl); }
        function clear() {
            if (layer) layer.remove();
            layer = null;
            crystals = new Map();
            frosts = new Map();
            icicles = [];
            Game.openCells().forEach(cell => cell.classList.remove("sn-iced", "sn-freeze"));
            if (boardRef) boardRef.classList.remove("sn-frozen");
        }
        return { attach, update, type, wordDone, restoreSolved, reset: clear, clear };
    })();

    // ---------------------------------------------------------------------------------------------
    // The win: freeze, snow globe, burst, snowman
    // ---------------------------------------------------------------------------------------------
    async function celebrate(c, { boardEl }) {
        if (U.motion() === "still") return;
        const b = boardEl.getBoundingClientRect();
        const cx = b.left + b.width / 2, cy = b.top + b.height / 2, R = Math.hypot(b.width, b.height) / 2 + 18;
        // 1. the board freezes, square by square from the corners in
        Sound.play("freeze");
        const corners = [[b.left, b.top], [b.right, b.top], [b.left, b.bottom], [b.right, b.bottom]];
        const maxD = Math.hypot(b.width, b.height) / 2;
        for (const cell of Game.openCells()) {
            const p = U.center(cell), d = Math.min(...corners.map(([x, y]) => Math.hypot(p.x - x, p.y - y)));
            cell.style.setProperty("--fz", Math.round(d / maxD * 650) + "ms");
            cell.classList.add("sn-freeze");
        }
        c.cleanup(() => Game.openCells().forEach(cell => cell.classList.remove("sn-freeze")));
        await c.wait(900);
        if (c.skipped) return;

        // 2. a snow globe forms around the board, and gets a good shake
        const globe = U.el("div", { class: "sn-globe", "aria-hidden": "true", style: { left: cx - R + "px", top: cy - R + "px", width: R * 2 + "px", height: R * 2 + "px" },
            html: `<div class="sn-glass"></div><div class="sn-base"><span>SNOW DAY!</span></div>` });
        document.getElementById("overlay").appendChild(globe);
        c.cleanup(() => globe.remove());
        FX.follow(c, boardEl, globe);
        Sound.play("whoosh");
        const flakes = Array.from({ length: U.motion() === "lite" ? 70 : 150 }, () => ({ a: Math.random() * TAU, d: Math.sqrt(Math.random()) * (R - 12), va: U.rand(1.6, 3.6) * (Math.random() < 0.5 ? -1 : 1), r: U.rand(1.2, 3.6), x: 0, y: 0, vy: 0 }));
        let phase = "swirl", et = 0, alive = true;
        FX.add({
            update(dt) {
                et += dt;
                for (const f of flakes) {
                    if (phase === "swirl") {
                        f.a += f.va * dt * (1 + 0.6 * Math.sin(et * 3 + f.r));
                        f.d = U.clamp(f.d + Math.sin(et * 4 + f.a * 2) * 50 * dt, 0, R - 12);
                        f.x = cx + Math.cos(f.a) * f.d;
                        f.y = cy + Math.sin(f.a) * f.d;
                    } else {
                        f.vy = Math.min(f.vy + 60 * dt, 30 + f.r * 12);
                        const nx = f.x + Math.sin(et * 2 + f.r * 3) * 12 * dt, ny = f.y + f.vy * dt;
                        if (Math.hypot(nx - cx, ny - cy) < R - 10) { f.x = nx; f.y = ny; } else f.vy = 0;
                    }
                }
                return alive;
            },
            draw(g) {
                g.save();
                g.beginPath();
                g.arc(cx, cy, R - 6, 0, TAU);
                g.clip();
                g.fillStyle = "#ffffff";
                for (const f of flakes) { g.beginPath(); g.arc(f.x, f.y, f.r, 0, TAU); g.fill(); }
                g.restore();
            }
        });
        c.cleanup(() => { alive = false; });
        await c.wait(450);
        if (c.skipped) return;
        Sound.play("jingle");
        const shake = [{ transform: "none" }, { transform: "translate(-14px, 4px) rotate(-7deg)" }, { transform: "translate(14px, -3px) rotate(7deg)" },
            { transform: "translate(-12px, 3px) rotate(-6deg)" }, { transform: "translate(10px, -2px) rotate(5deg)" }, { transform: "translate(-5px, 1px) rotate(-2deg)" }, { transform: "none" }];
        const a1 = globe.animate(shake, { duration: 1300, easing: "ease-in-out" }), a2 = boardEl.animate(shake, { duration: 1300, easing: "ease-in-out" });
        c.cleanup(() => { a1.cancel(); a2.cancel(); });
        await c.wait(1300);
        if (c.skipped) return;
        phase = "settle";
        await c.wait(1300);
        if (c.skipped) return;

        // 3. the globe bursts into a puff of snow and ice
        globe.classList.add("pop");
        alive = false;
        Sound.play("shatter");
        FX.flash("#ffffff", 450, 0.7);
        FX.ring({ x: cx, y: cy, color: "#cfeaff", r0: R * 0.8, r1: R * 2.4, dur: 0.9, width: 14, glow: false });
        FX.burst({ x: cx, y: cy, n: 90, colors: ["#ffffff", "#d7efff", "#a9d8ff"], shape: "spark", speed: [250, 800], gravity: 300, drag: 1, life: [0.6, 1.1], size: [1.5, 3], jitter: R * 0.5 });
        FX.burst({ x: cx, y: cy, n: 46, colors: ICE, shape: "flake", speed: [120, 480], gravity: 60, drag: 1.3, life: [1.4, 2.4], size: [5, 11], spin: 2.5, jitter: R * 0.4 });
        await c.wait(500);
        if (c.skipped) return;

        // 4. a snowman builds itself beside the board (or in front of it on narrow screens): Rive, rive/snow-win.riv
        const sw = 196, sh = 274, place = r => {
            const room = innerWidth - r.right, side = room > sw + 30 ? 1 : r.left > sw + 30 ? -1 : 0;
            return { x: side > 0 ? r.right + 12 : side < 0 ? r.left - sw - 12 : r.left + r.width / 2 - sw / 2, y: side ? r.bottom - sh : Math.min(innerHeight - sh - 10, r.bottom - sh * 0.7), w: sw, h: sh };
        };
        const man = Anim.play("snow-win", { follow: boardEl, ms: 3700, fadeMs: 400, rect: place });
        c.cleanup(() => man.stop());
        c.later(() => Sound.play("plop"), 600);
        c.later(() => Sound.play("plop"), 1000);
        c.later(() => Sound.play("plop"), 1400);
        c.later(() => Sound.play("pop"), 2000);
        Anim.motion().then(({ animate, stagger }) => {                         // the squares thaw out with a little shiver
            if (c.skipped) return;
            const cells = Game.openCells();
            const run = animate(cells, { x: [0, -2, 2, -1, 0], scale: [1, 1.06, 1] }, { duration: 0.5, delay: stagger(0.025, { from: "center" }), ease: "easeOut" });
            c.cleanup(() => { try { run.complete(); } catch (err) { /* done */ } cells.forEach(el => { el.style.transform = ""; }); });
        }).catch(() => null);
        // and a gentle snowfall over everything
        FX.burst({ x: innerWidth / 2, y: -20, jitter: innerWidth / 2, jitterY: 10, n: 70, colors: ["#ffffff", "#eaf6ff"], shape: "flake", speed: [10, 40], angle: Math.PI / 2, spread: 0.5, gravity: 25, drag: 0.2, life: [4, 6], size: [3, 7], spin: 1, wobble: 30, delay: [0, 1.6] });
        await c.wait(3700);
    }

    // ---------------------------------------------------------------------------------------------
    // Title card: a snowy wooden sign swings down on two ropes
    // ---------------------------------------------------------------------------------------------
    async function titleCard(c, info) {
        const flakes = Array.from({ length: 28 }, () =>
            `<i class="tcw-flake" style="left:${U.rand(0, 100).toFixed(1)}%;--d:${U.rand(0, 2.2).toFixed(2)}s;--s:${U.rand(4, 10).toFixed(1)}px;--x:${U.rand(-40, 40).toFixed(0)}px;--t:${U.rand(2.6, 4.8).toFixed(2)}s"></i>`).join("");
        const card = U.el("div", { class: "tc tc-snow", "aria-hidden": "true", html: `
            <div class="tcw-flakes">${flakes}</div>
            <div class="tcw-sign">
                <i class="tcw-rope l"></i><i class="tcw-rope r"></i>
                <div class="tcw-board">
                    <div class="tcw-cap"></div>
                    <small>&#10052; ${U.esc(info.kicker)} &#10052;</small>
                    <h2>${U.esc(info.title)}</h2>
                    <p>${U.esc(info.sub)}</p>
                    <div class="tcw-icicles"></div>
                </div>
            </div>` });
        document.getElementById("overlay").appendChild(card);
        c.cleanup(() => card.remove());
        Sound.play("title");
        await c.wait(1900);
        if (c.skipped) return;
        card.classList.add("out");
        Sound.play("whoosh");
        await c.wait(450);
    }

    // ---------------------------------------------------------------------------------------------
    // The mascot: Pebble, a penguin in a knit hat and scarf
    // ---------------------------------------------------------------------------------------------
    function drawPebble(g, s) {
        const happy = s.mood === "happy", wow = s.mood === "wow", sad = s.mood === "sad";
        const bob = Math.sin(s.t * 2.2) * 2 - s.hop * 12;
        const waddle = Math.sin(s.t * (happy ? 8 : 2.2)) * (happy ? 0.09 : 0.03);
        g.save();
        g.translate(80, 96 + bob);
        g.rotate(waddle);
        g.lineWidth = 2.5;
        g.strokeStyle = "#141821";
        // feet
        g.fillStyle = "#f29a2e";
        for (const side of [-1, 1]) { g.beginPath(); g.ellipse(side * 14, 50, 12, 5, 0, 0, TAU); g.fill(); g.stroke(); }
        // flippers (one waves when happy or surprised)
        const flap = happy || wow ? Math.sin(s.t * 10) * 0.5 : 0;
        for (const side of [-1, 1]) {
            g.save();
            g.translate(side * 34, 4);
            g.rotate(side * (0.35 + (side > 0 ? -flap - (happy ? 0.6 : 0) : 0)));
            g.fillStyle = "#1c212c";
            g.beginPath(); g.ellipse(0, 14, 8, 21, 0, 0, TAU); g.fill(); g.stroke();
            g.restore();
        }
        // body
        const bg = g.createRadialGradient(-14, -18, 6, 0, 6, 54);
        bg.addColorStop(0, "#414a5c");
        bg.addColorStop(1, "#141821");
        g.fillStyle = bg;
        g.beginPath(); g.ellipse(0, 6, 37, 46, 0, 0, TAU); g.fill(); g.stroke();
        const wg = g.createRadialGradient(-6, 8, 4, 0, 16, 36);
        wg.addColorStop(0, "#ffffff");
        wg.addColorStop(1, "#dde8f3");
        g.fillStyle = wg;
        g.beginPath(); g.ellipse(0, 12, 27, 34, 0, 0, TAU); g.fill();
        // eyes
        const ex = s.look * 3;
        for (const side of [-1, 1]) {
            const x = side * 11 + ex, y = -18;
            g.fillStyle = "#ffffff";
            g.beginPath(); g.ellipse(x, y, 7.5, wow ? 9 : 8, 0, 0, TAU); g.fill();
            g.fillStyle = "#141821";
            if (s.blink > 0.5) { g.fillRect(x - 6, y, 12, 2.2); continue; }
            if (happy) { g.lineWidth = 2.6; g.beginPath(); g.arc(x, y + 3, 5, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); continue; }
            g.beginPath(); g.arc(x + side * 0.5, y + (sad ? 2 : 1), wow ? 4.6 : 3.6, 0, TAU); g.fill();
            g.fillStyle = "#ffffff";
            g.beginPath(); g.arc(x + 1.5, y - 1, 1.3, 0, TAU); g.fill();
            if (sad) { g.strokeStyle = "#141821"; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 6, y - 11 - side * 2); g.lineTo(x + 6, y - 11 + side * 2); g.stroke(); }
        }
        // rosy cheeks
        g.fillStyle = "rgba(255,120,140,.45)";
        for (const side of [-1, 1]) { g.beginPath(); g.ellipse(side * 19, -6, 5, 3, 0, 0, TAU); g.fill(); }
        // beak (it opens to talk)
        const open = Math.max(s.talk, wow ? 0.7 : 0) * 5;
        g.fillStyle = "#f29a2e";
        g.strokeStyle = "#a35b12";
        g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(-7, -9); g.lineTo(7, -9); g.lineTo(0, -1 - open * 0.2); g.closePath(); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(-5, -8 + open); g.lineTo(5, -8 + open); g.lineTo(0, -3 + open); g.closePath(); g.fill(); g.stroke();
        // scarf with a flapping end
        g.fillStyle = "#d6455d";
        g.strokeStyle = "#8f2234";
        g.lineWidth = 2;
        g.beginPath(); g.roundRect(-31, 2, 62, 11, 5); g.fill(); g.stroke();
        g.fillStyle = "#ffffff";
        for (let i = -24; i < 28; i += 12) g.fillRect(i, 3.5, 4, 8);
        const tail = Math.sin(s.t * 6) * 4;
        g.fillStyle = "#d6455d";
        g.beginPath(); g.moveTo(18, 10); g.quadraticCurveTo(30 + tail, 22, 26 + tail, 36); g.lineTo(16 + tail, 34); g.quadraticCurveTo(18, 22, 10, 12); g.fill(); g.stroke();
        // knit hat with a bobbing pom-pom
        g.fillStyle = "#3d7cc9";
        g.strokeStyle = "#1f4e86";
        g.beginPath(); g.ellipse(0, -36, 30, 18, 0, Math.PI, TAU); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = "#ffffff";
        g.beginPath(); g.roundRect(-31, -40, 62, 9, 4); g.fill(); g.stroke();
        g.strokeStyle = "rgba(255,255,255,.55)";
        g.lineWidth = 2;
        for (let i = -18; i <= 18; i += 9) { g.beginPath(); g.moveTo(i, -42); g.lineTo(i * 0.75, -52); g.stroke(); }
        const pom = Math.sin(s.t * 3) * 2 - s.hop * 4;
        g.fillStyle = "#ffffff";
        g.strokeStyle = "#c9d8e8";
        g.beginPath(); g.arc(0, -56 + pom, 7.5, 0, TAU); g.fill(); g.stroke();
        g.restore();
    }

    // ---------------------------------------------------------------------------------------------
    // Sounds: crunchy snow, sleigh bells and icy chimes
    // ---------------------------------------------------------------------------------------------
    function bells(t0, n, v, spread = 0.06) {
        for (let i = 0; i < n; i++) {
            const t = t0 + i * spread + Math.random() * spread * 0.4;
            tone({ t, f: U.rand(2400, 4200), type: "triangle", d: 0.14, v });
            tone({ t, f: U.rand(5200, 6800), type: "sine", d: 0.08, v: v * 0.5 });
        }
    }
    const chime = (t, notes, v = 0.045, step = 0.07) => notes.forEach((n, i) => tone({ t: t + i * step, f: midi(n), type: "sine", d: 0.9, v, echo: 0.45 }));
    const sounds = {
        type: () => { noise({ type: "bandpass", f: U.rand(1600, 2800), q: 0.8, d: 0.07, v: 0.09 }); if (Math.random() < 0.35) tone({ f: U.rand(2600, 3400), type: "sine", d: 0.1, v: 0.018, echo: 0.3 }); },
        erase: () => noise({ type: "lowpass", f: 2400, f2: 600, d: 0.14, v: 0.08 }),
        move: () => {},
        word: () => { bells(0, 6, 0.014, 0.045); chime(0.05, [79, 83, 86, 91]); },
        wrong: () => { tone({ f: 190, f2: 140, type: "sawtooth", d: 0.36, v: 0.035, filt: { f: 700 } }); noise({ type: "bandpass", f: 320, q: 3, d: 0.3, v: 0.06 }); },
        right: () => chime(0, [84, 88, 91, 96], 0.04, 0.06),
        reveal: () => { tone({ f: 3200, f2: 1200, type: "sine", d: 0.35, v: 0.05, echo: 0.35 }); noise({ type: "highpass", f: 5000, d: 0.3, v: 0.03 }); },
        flip: () => tone({ f: U.rand(2600, 3400), type: "sine", d: 0.08, v: 0.035 }),
        freeze: () => {
            for (let i = 0; i < 14; i++) noise({ t: i * 0.055 + Math.random() * 0.03, type: "highpass", f: 3500 + Math.random() * 3500, d: 0.035, v: 0.09 });
            tone({ f: 2400, f2: 700, type: "sine", d: 0.9, v: 0.03, echo: 0.4 });
        },
        jingle: () => { bells(0, 22, 0.02, 0.055); noise({ type: "bandpass", f: 900, f2: 2400, q: 0.7, d: 1.2, v: 0.06 }); },
        shatter: () => { noise({ type: "highpass", f: 2500, d: 0.5, v: 0.22 }); for (let i = 0; i < 12; i++) tone({ t: Math.random() * 0.5, f: U.rand(2000, 5000), type: "sine", d: 0.3, v: 0.025, echo: 0.4 }); },
        plop: () => { tone({ f: 170, f2: 70, d: 0.2, v: 0.32 }); noise({ type: "lowpass", f: 900, d: 0.12, v: 0.14 }); },
        pop: () => { tone({ f: 500, f2: 1100, type: "sine", d: 0.1, v: 0.1 }); bells(0.05, 3, 0.015); },
        win: () => {},
        streak: () => { bells(0, 8, 0.016, 0.04); chime(0.1, [72, 79, 84, 91]); },
        achievement: () => { bells(0, 10, 0.016, 0.04); chime(0.15, [76, 83, 88, 95], 0.05, 0.09); },
        title: () => { noise({ type: "bandpass", f: 300, f2: 1600, q: 0.6, d: 1.1, v: 0.1, a: 0.4 }); bells(0.4, 6, 0.014); chime(0.45, [72, 76, 79, 84], 0.04, 0.1); },
        tile: i => tone({ f: midi(79 + (i % 6) * 2), type: "sine", d: 0.35, v: 0.045, echo: 0.35 }),
        start: () => { noise({ type: "bandpass", f: 200, f2: 3000, q: 0.6, d: 1, v: 0.12, a: 0.3 }); bells(0.3, 12, 0.018, 0.05); chime(0.4, [60, 67, 72, 76, 79], 0.04, 0.08); },
        select: () => tone({ f: 2640, type: "sine", d: 0.07, v: 0.04, echo: 0.2 }),
        nav: () => { noise({ type: "bandpass", f: 500, f2: 2600, q: 0.8, d: 0.25, v: 0.07 }); tone({ f: midi(88), type: "sine", d: 0.3, v: 0.035, echo: 0.3 }); },
        mascot: () => { tone({ f: 900, f2: 1500, type: "sine", d: 0.08, v: 0.06 }); tone({ t: 0.09, f: 1100, f2: 1700, type: "sine", d: 0.09, v: 0.05 }); }
    };

    Worlds.register({
        id: "snow", name: "Snow Day", icon: "❄️", tagline: "Fresh Snow and Northern Lights.",
        modes: ["light", "dark"],
        scene: (W, H, opts) => SnowScene(W, H, opts), rive: "snow-win", board, celebrate, titleCard, sounds, transition: "blizzard",
        mascot: { name: "PEBBLE", draw: drawPebble },
        lines: {
            hello: ["Brrr! Perfect puzzle weather.", "Grab a cocoa. Today's puzzles are fresh as new snow.", "Snow day! No school, just puzzles."],
            start: ["Tap a square and start typing. Space flips Across and Down!", "Every letter makes a snowflake. Let's fill the board!"],
            word: ["Ice one!", "Snow way, nice!", "Cool!", "Flake-tastic!", "Chill work!", "That word froze solid!"],
            win: ["Snow day! You aced it.", "Ice-cold solving!", "That's one frosty finish!"],
            wrong: ["A few letters are on thin ice.", "Brrr, some of those need another look."],
            right: ["All clear, no black ice!", "Smooth as fresh snow!"],
            idle: ["Frozen? Try a crossing word to thaw it out.", "Even penguins get stuck. Try the shortest clue!"],
            reveal: ["Brushing off a little snow...", "Here's a snowball of help."]
        },
        introFlourish(stage) {
            const p = U.center(stage);
            FX.ring({ x: p.x, y: p.y, color: "#cfeaff", r1: Math.max(innerWidth, innerHeight) * 0.6, dur: 1.2, width: 16 });
            FX.burst({ x: p.x, y: p.y, n: 80, colors: ICE, shape: "flake", speed: [150, 600], gravity: 40, drag: 1.4, life: [1.4, 2.4], size: [4, 10], spin: 2 });
        }
    });
})();
