// The CORAL REEF world: under the sea.
//   Day: a sunlit reef. Light shimmers down from the waves, sunbeams sway, coral and sea fans grow on the sand,
//   kelp waves in the current, schools of fish turn together, a sea turtle glides past, bubbles rise and a whale
//   sings far away in the blue.
//   Night: the deep sea. Jellyfish pulse with their own light, an anglerfish dangles its glowing lure, plankton
//   twinkles, and the coral glows faintly.
//   Board: each letter leaves a shell, starfish or pearl in its square; a fish swims along every finished word.
//   Win: bubbles rise, a treasure chest bursts open in a fountain of coins and pearls, and a whale swims by.

(() => {
    const TAU = Math.PI * 2;
    const { tone, noise, midi } = Sound;
    const FISH = ["#ffb03b", "#ff6f61", "#3ec9d6", "#ffe066", "#8f7bff", "#5be38a"];

    // The background is OceanScene (ocean-scene.js)

    // ---------------------------------------------------------------------------------------------
    // The board: a shell, starfish or pearl in each typed square; a fish swims along every finished word
    // ---------------------------------------------------------------------------------------------
    const TREASURES = [
        `<path d="M0 .1L-.1 -.06Q0 -.13 .1 -.06Z" fill="#ffb3a7"/><path d="M0 .1L-.06 -.09M0 .1L0 -.11M0 .1L.06 -.09" stroke="#e07a6e" stroke-width=".012"/>`,
        `<path d="M0 -.11L.03 -.03L.11 -.03L.045 .02L.07 .1L0 .05L-.07 .1L-.045 .02L-.11 -.03L-.03 -.03Z" fill="#ff8a5b"/><circle cx="0" cy="0" r=".015" fill="#ffd2b8"/>`,
        `<circle r=".06" fill="url(#ocPearl)"/>`,
        `<circle r=".08" fill="#f2e6cf"/><path d="M0 -.05L.012 -.012L.05 0L.012 .012L0 .05L-.012 .012L-.05 0L-.012 -.012Z" fill="#c9b48e"/>`,
        `<path d="M-.1 0Q-.03 -.07 .06 -.02L.1 -.05L.09 .05L.06 .02Q-.03 .07 -.1 0Z" fill="#3ec9d6"/><circle cx="-.05" cy="-.008" r=".012" fill="#14213d"/>`
    ];
    const RUNNER = `<svg viewBox="-30 -20 60 40" aria-hidden="true"><path d="M24 0Q8 -16 -12 0Q8 16 24 0Z" fill="#ffb03b"/><path d="M-10 0L-24 -11L-24 11Z" fill="#ff8c1a" class="oc-tail"/>
        <path d="M2 -9Q6 0 2 9" stroke="#fff" stroke-width="3" fill="none"/><circle cx="14" cy="-2" r="3.2" fill="#fff"/><circle cx="15" cy="-2" r="1.6" fill="#14213d"/></svg>`;

    const board = (() => {
        let layer = null, gT, items = new Map(), seed = 1, size = 5, quiet = true, boardRef = null;
        const rnd = (...k) => { let h = seed; for (const v of k) { h = Math.imul(h ^ v, 2654435761); h ^= h >>> 13; } return (h >>> 0) / 4294967296; };
        function build(game, boardEl) {
            if (layer) layer.remove();
            size = game.puzzle.size;
            seed = U.hash(game.puzzle.seed + game.puzzle.mode + "reef");
            boardRef = boardEl;
            layer = U.svg("svg", { class: "oc-layer", viewBox: `0 0 ${size} ${size}`, preserveAspectRatio: "none", "aria-hidden": "true" });
            layer.innerHTML = `<defs><radialGradient id="ocPearl" cx=".35" cy=".35" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#f3e9ff"/><stop offset="1" stop-color="#c9b8e6"/></radialGradient></defs>`;
            boardEl.appendChild(layer);
            gT = U.svg("g", {}, layer);
            items = new Map();
        }
        function treasure(r, c, grow) {
            const kind = Math.floor(rnd(r, c, 1) * TREASURES.length);
            const [ox, oy] = [[0.8, 0.24], [0.8, 0.78], [0.22, 0.79]][Math.floor(rnd(r, c, 2) * 3)];
            const x = c + ox + (rnd(r, c, 3) - 0.5) * 0.05, y = r + oy + (rnd(r, c, 4) - 0.5) * 0.05, rot = (rnd(r, c, 5) - 0.5) * 50;
            const outer = U.svg("g", { transform: `translate(${x.toFixed(3)} ${y.toFixed(3)}) rotate(${rot.toFixed(1)})`, class: "oc-item" + (grow ? " float" : "") }, gT);
            U.svg("g", { class: "oc-item-in" }, outer).innerHTML = TREASURES[kind];
            return outer;
        }
        function attach() { quiet = true; }
        function update(game, boardEl) {
            if (!layer || !boardEl.contains(layer) || size !== game.puzzle.size) { build(game, boardEl); quiet = true; }
            const grow = !quiet && U.motion() !== "still";
            quiet = false;
            const n = game.puzzle.size, want = new Set();
            for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
                if (!game.letters[r][c]) continue;
                const key = r * 99 + c;
                want.add(key);
                if (!items.has(key)) items.set(key, treasure(r, c, grow));
            }
            for (const [key, el] of items) if (!want.has(key)) { el.remove(); items.delete(key); }
            const done = new Set();
            for (const entry of [...game.puzzle.across, ...game.puzzle.down]) {
                const cells = Game.cellsOf(entry);
                if (cells.every(([r, c]) => game.letters[r][c])) cells.forEach(([r, c]) => done.add(r * 99 + c));
            }
            for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { const cell = Game.cellEl(r, c); if (cell) cell.classList.toggle("oc-done", done.has(r * 99 + c)); }
            boardEl.classList.toggle("oc-solved", !!(game.solved && !game.surrendered));
        }
        function type(cell) {
            const p = U.center(cell);
            FX.burst({ x: p.x, y: p.y + p.h * 0.2, n: 6, colors: ["#ffffff", "#bff3ff"], shape: "bubble", speed: [20, 60], angle: -Math.PI / 2, spread: 0.6, gravity: -160, drag: 1.5, life: [0.6, 1], size: [2.5, 5], wobble: 20 });
        }
        function wordDone(entry, cells) {
            if (U.motion() === "still") return;
            const pts = cells.map(([r, c]) => Game.cellEl(r, c)).filter(Boolean).map(el => U.center(el));
            if (!pts.length) return;
            const down = entry.direction === "down";
            const fishEl = U.el("div", { class: "oc-runner" + (down ? " down" : ""), html: RUNNER });
            document.getElementById("overlay").appendChild(fishEl);
            const first = pts[0], last = pts[pts.length - 1], dur = 140 * pts.length + 250;
            const frames = pts.map((p, i) => ({ transform: `translate(${p.x - 24}px, ${p.y - 16 + Math.sin(i * 1.6) * 6}px)${down ? " rotate(90deg)" : ""}`, offset: i / Math.max(1, pts.length - 1) }));
            if (frames.length === 1) frames.push({ ...frames[0], offset: 1 });
            fishEl.animate(frames, { duration: dur, easing: "ease-in-out", fill: "forwards" });
            fishEl.animate([{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], { duration: dur + 200 });
            pts.forEach((p, i) => setTimeout(() => FX.burst({ x: p.x, y: p.y, n: 4, colors: ["#ffffff", "#bff3ff"], shape: "bubble", speed: [10, 40], gravity: -140, life: [0.6, 1], size: [2, 4], wobble: 20 }), (dur / pts.length) * i));
            setTimeout(() => fishEl.remove(), dur + 260);
            void first; void last;
        }
        function restoreSolved(boardEl, game) { quiet = true; update(game, boardEl); }
        function clear() {
            if (layer) layer.remove();
            layer = null;
            items = new Map();
            Game.openCells().forEach(cell => cell.classList.remove("oc-done"));
            if (boardRef) boardRef.classList.remove("oc-solved");
        }
        return { attach, update, type, wordDone, restoreSolved, reset: clear, clear };
    })();

    // ---------------------------------------------------------------------------------------------
    // The win: bubbles, a treasure chest bursting open, a fountain of coins and pearls, and a whale
    // ---------------------------------------------------------------------------------------------
    const CHEST = `<svg viewBox="0 0 160 130" aria-hidden="true">
        <defs><linearGradient id="ocWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a0612f"/><stop offset="1" stop-color="#6b3d1a"/></linearGradient></defs>
        <g class="oc-chest-glow"><ellipse cx="80" cy="62" rx="70" ry="30" fill="rgba(255,220,120,.85)"/></g>
        <rect x="14" y="62" width="132" height="60" rx="8" fill="url(#ocWood)" stroke="#3f2310" stroke-width="4"/>
        <rect x="14" y="78" width="132" height="8" fill="#d9a43a"/><rect x="72" y="70" width="16" height="22" rx="3" fill="#ffd166" stroke="#8a5a12" stroke-width="2"/>
        <g class="oc-lid"><path d="M14 64 Q80 6 146 64 Z" fill="url(#ocWood)" stroke="#3f2310" stroke-width="4"/><path d="M20 58 Q80 12 140 58" stroke="#d9a43a" stroke-width="6" fill="none"/></g>
    </svg>`;
    const WHALE = `<svg viewBox="-140 -50 280 100" aria-hidden="true"><path d="M120 0C110 -38 20 -42 -60 -14Q-100 -4 -130 -26Q-120 0 -132 22Q-100 6 -60 12C20 34 100 30 120 0Z" fill="#3b78c4"/>
        <path d="M120 2C100 26 30 30 -40 14Q20 20 120 2Z" fill="#cfe7ff"/><ellipse cx="30" cy="24" rx="26" ry="6" transform="rotate(20 30 24)" fill="#2f63a6"/><circle cx="88" cy="-6" r="4" fill="#0d2240"/>
        <path d="M70 -34Q74 -60 64 -70M70 -34Q80 -58 92 -66M70 -34Q62 -56 48 -62" class="oc-spout" stroke="#bfe9ff" stroke-width="5" stroke-linecap="round" fill="none"/></svg>`;

    async function celebrate(c, { boardEl }) {
        if (U.motion() === "still") return;
        const W = innerWidth, H = innerHeight, b = boardEl.getBoundingClientRect(), cx = b.left + b.width / 2;
        const overlay = document.getElementById("overlay");
        // 1. bubbles stream up out of every square
        Sound.play("bubbles");
        for (const cell of Game.openCells()) {
            const p = U.center(cell);
            FX.burst({ x: p.x, y: p.y, n: 5, colors: ["#ffffff", "#bff3ff", "#8fe3ff"], shape: "bubble", speed: [20, 80], angle: -Math.PI / 2, spread: 0.5, gravity: -260, drag: 0.8, life: [1.2, 2], size: [3, 8], wobble: 30, delay: [0, 0.6] });
        }
        await c.wait(900);
        if (c.skipped) return;
        // 2. a giant clam rises in front of the board and opens on a glowing pearl (Rive: rive/ocean-win.riv,
        //    timed to the steps below; the chest element, kept invisible, moves the same way and places the bursts)
        const chest = U.el("div", { class: "oc-chest", html: CHEST, style: { left: cx - 90 + "px", top: Math.min(H - 160, b.bottom - 120) + "px", visibility: "hidden" } });
        overlay.appendChild(chest);
        FX.follow(c, boardEl, chest);
        c.cleanup(() => chest.remove());
        const clam = Anim.play("ocean-win", { follow: boardEl, ms: 4600, fadeMs: 300, rect: r => { const w = Math.min(W * 0.9, 460), top = Math.min(H - 160, r.bottom - 120); return { x: r.left + r.width / 2 - w / 2, y: top + 73 - 410 * w / 600, w, h: 560 * w / 600 }; } });
        c.cleanup(() => clam.stop());
        chest.animate([{ transform: "translateY(260px) scale(.6)", opacity: 0 }, { transform: "translateY(-14px) scale(1.05)", opacity: 1, offset: 0.7 }, { transform: "none", opacity: 1 }], { duration: 700, easing: "cubic-bezier(.2,.9,.3,1)", fill: "backwards" });
        await c.wait(800);
        if (c.skipped) return;
        chest.animate([{ transform: "none" }, { transform: "rotate(-4deg)" }, { transform: "rotate(4deg)" }, { transform: "none" }], { duration: 360 });
        Sound.play("creak");
        await c.wait(420);
        if (c.skipped) return;
        chest.classList.add("open");
        Sound.play("treasure");
        Anim.motion().then(({ animate, stagger }) => {                         // the squares bob like they're afloat
            if (c.skipped) return;
            const cells = [...boardEl.querySelectorAll(".cell:not(.block)")];
            const run = animate(cells, { y: [0, -10, 4, -2, 0], rotate: [0, -3, 2, 0] }, { duration: 1.2, delay: stagger(0.04, { from: "last" }), ease: "easeInOut" });
            c.cleanup(() => { try { run.complete(); } catch (err) { /* done */ } cells.forEach(el => { el.style.transform = ""; }); });
        }).catch(() => null);
        const cp = U.center(chest);
        FX.flash("#fff3c4", 450, 0.5);
        FX.ring({ x: cp.x, y: cp.y - 20, color: "#ffd166", r1: Math.max(W, H) * 0.5, dur: 1, width: 16 });
        FX.burst({ x: cp.x, y: cp.y - 20, n: 70, colors: ["#ffd166", "#ffbe0b", "#fff1a8"], shape: "circle", angle: -Math.PI / 2, spread: 0.9, speed: [350, 800], gravity: 700, drag: 0.4, life: [1.2, 1.8], size: [4, 7], glow: true });
        FX.burst({ x: cp.x, y: cp.y - 20, n: 30, colors: ["#ffffff", "#f3e9ff"], shape: "circle", angle: -Math.PI / 2, spread: 0.8, speed: [300, 700], gravity: 650, drag: 0.4, life: [1.2, 1.8], size: [3, 5] });
        FX.burst({ x: cp.x, y: cp.y - 20, n: 20, colors: ["#3ec9d6", "#ff6fae", "#8f7bff", "#5be38a"], shape: "star", angle: -Math.PI / 2, spread: 0.9, speed: [300, 700], gravity: 650, life: [1.2, 1.8], size: [5, 8], glow: true, spin: 6 });
        await c.wait(1000);
        if (c.skipped) return;
        // 3. a whale swims past, spouting
        Sound.play("whale");
        const whale = U.el("div", { class: "oc-whale", html: WHALE, style: { top: Math.max(60, b.top - 40) + "px" } });
        overlay.appendChild(whale);
        FX.follow(c, boardEl, whale);
        c.cleanup(() => whale.remove());
        whale.animate([{ transform: `translateX(${W + 60}px) translateY(0)` }, { transform: `translateX(${W * 0.4}px) translateY(-24px)`, offset: 0.5 }, { transform: "translateX(-420px) translateY(0)" }], { duration: 3600, easing: "linear", fill: "forwards" });
        for (let i = 0; i < 3; i++) setTimeout(() => FX.burst({ x: W / 2, y: H + 10, jitter: W / 2, n: 14, colors: ["#ffffff", "#bff3ff"], shape: "bubble", speed: [40, 120], angle: -Math.PI / 2, spread: 0.3, gravity: -200, life: [2, 3], size: [3, 9], wobble: 30 }), i * 600);
        await c.wait(3300);
        if (c.skipped) return;
        chest.animate([{ opacity: 1 }, { opacity: 0, transform: "translateY(40px)" }], { duration: 350, fill: "forwards" });
        await c.wait(340);
    }

    // ---------------------------------------------------------------------------------------------
    // Title card: a parchment scroll unrolls between two wooden rollers while bubbles rise
    // ---------------------------------------------------------------------------------------------
    async function titleCard(c, info) {
        const bub = Array.from({ length: 22 }, () => `<i class="tco-bub" style="left:${U.rand(0, 100).toFixed(1)}%;--d:${U.rand(0, 2).toFixed(2)}s;--s:${U.rand(6, 18).toFixed(0)}px;--t:${U.rand(2.4, 4.4).toFixed(2)}s"></i>`).join("");
        const card = U.el("div", { class: "tc tc-ocean", "aria-hidden": "true", html: `
            <div class="tco-bubbles">${bub}</div>
            <div class="tco-scroll">
                <i class="tco-roll top"></i>
                <div class="tco-paper"><small>&#9875; ${U.esc(info.kicker)} &#9875;</small><h2>${U.esc(info.title)}</h2><p>${U.esc(info.sub)}</p></div>
                <i class="tco-roll bottom"></i>
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
    // The mascot: Otto, a friendly octopus
    // ---------------------------------------------------------------------------------------------
    function drawOtto(g, s) {
        const happy = s.mood === "happy", wow = s.mood === "wow", sad = s.mood === "sad";
        const bob = Math.sin(s.t * 1.8) * 4 - s.hop * 12;
        g.save();
        g.translate(80, 74 + bob);
        g.strokeStyle = "#5b2a86";
        g.lineWidth = 2.5;
        // eight tentacles, curling (faster when happy)
        const speed = happy ? 6 : 2.2;
        for (let i = 0; i < 8; i++) {
            const bx = -26 + i * 7.4, ph = i * 0.9;
            g.fillStyle = i % 2 ? "#a35be0" : "#b56ef0";
            g.beginPath();
            g.moveTo(bx - 5, 16);
            const pts = [];
            for (let k = 1; k <= 6; k++) pts.push([bx + Math.sin(s.t * speed + ph + k * 0.7) * k * 1.6 + (i - 3.5) * k * 1.2, 16 + k * 9]);
            pts.forEach(([x, y]) => g.lineTo(x - 4, y));
            for (let k = pts.length - 1; k >= 0; k--) g.lineTo(pts[k][0] + 4 - k * 0.6, pts[k][1]);
            g.lineTo(bx + 5, 16);
            g.closePath();
            g.fill();
            g.stroke();
            g.fillStyle = "#f1d6ff";
            for (let k = 1; k < 5; k++) { g.beginPath(); g.arc(pts[k][0] + 1.5, pts[k][1] - 2, 1.4, 0, TAU); g.fill(); }
        }
        // head
        const hg = g.createRadialGradient(-14, -30, 6, 0, -10, 46);
        hg.addColorStop(0, "#d79bff");
        hg.addColorStop(1, "#9246d6");
        g.fillStyle = hg;
        g.beginPath(); g.ellipse(0, -10, 38, 36, 0, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = "rgba(255,255,255,.35)";
        for (const [x, y, r] of [[-18, -30, 4], [14, -34, 3], [22, -14, 2.5]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
        // eyes
        const ex = s.look * 3;
        for (const side of [-1, 1]) {
            const x = side * 13 + ex, y = -8;
            g.fillStyle = "#ffffff";
            g.beginPath(); g.ellipse(x, y, 9, wow ? 11 : 10, 0, 0, TAU); g.fill();
            g.fillStyle = "#2a1640";
            if (s.blink > 0.5) { g.fillRect(x - 7, y, 14, 2.4); continue; }
            if (happy) { g.lineWidth = 2.8; g.strokeStyle = "#2a1640"; g.beginPath(); g.arc(x, y + 3, 5.5, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); g.strokeStyle = "#5b2a86"; g.lineWidth = 2.5; continue; }
            g.beginPath(); g.arc(x + side * 0.6, y + (sad ? 2 : 1), wow ? 5.5 : 4.5, 0, TAU); g.fill();
            g.fillStyle = "#ffffff"; g.beginPath(); g.arc(x + 1.8, y - 1.5, 1.6, 0, TAU); g.fill();
        }
        g.fillStyle = "rgba(255,120,170,.5)";
        for (const side of [-1, 1]) { g.beginPath(); g.ellipse(side * 24, 6, 5, 3, 0, 0, TAU); g.fill(); }
        // mouth
        const open = Math.max(s.talk, wow ? 0.7 : 0);
        g.strokeStyle = "#2a1640";
        g.lineWidth = 2.4;
        if (open > 0.1) { g.fillStyle = "#5a1838"; g.beginPath(); g.ellipse(0, 10, 5, 2 + open * 4, 0, 0, TAU); g.fill(); }
        else { g.beginPath(); g.moveTo(-6, 9); g.quadraticCurveTo(0, sad ? 5 : 14, 6, 9); g.stroke(); }
        g.restore();
    }

    // ---------------------------------------------------------------------------------------------
    // Sounds: bloops, harp glissandos, a whale's song
    // ---------------------------------------------------------------------------------------------
    const bloop = (t, f, v = 0.1) => tone({ t, f, f2: f * 2.2, type: "sine", d: 0.12, v, a: 0.01 });
    const harp = (t, notes, v = 0.045, step = 0.05) => notes.forEach((n, i) => tone({ t: t + i * step, f: midi(n), type: "triangle", d: 0.9, v, echo: 0.35 }));
    const sounds = {
        type: () => bloop(0, U.rand(280, 520), 0.09),
        erase: () => tone({ f: 500, f2: 200, type: "sine", d: 0.12, v: 0.07 }),
        move: () => {},
        word: () => { harp(0, [72, 76, 79, 84, 88]); bloop(0.3, 600, 0.05); },
        wrong: () => { tone({ f: 200, f2: 140, type: "sine", d: 0.4, v: 0.14, vib: 12 }); },
        right: () => harp(0, [79, 83, 86, 91, 95], 0.04, 0.045),
        reveal: () => { noise({ type: "lowpass", f: 600, f2: 2400, d: 0.4, v: 0.06 }); bloop(0.1, 700, 0.05); },
        flip: () => bloop(0, U.rand(500, 800), 0.05),
        bubbles: () => { for (let i = 0; i < 14; i++) bloop(i * 0.05 + Math.random() * 0.03, U.rand(300, 900), 0.06); },
        creak: () => tone({ f: 120, f2: 180, type: "sawtooth", d: 0.35, v: 0.05, filt: { f: 900 }, vib: 30 }),
        treasure: () => { noise({ type: "highpass", f: 5000, d: 0.8, v: 0.06 }); harp(0, [72, 76, 79, 84, 88, 91, 96], 0.05, 0.06); for (let i = 0; i < 10; i++) tone({ t: 0.2 + i * 0.06, f: U.rand(2400, 3600), type: "triangle", d: 0.12, v: 0.02 }); },
        whale: () => { tone({ f: 220, f2: 380, type: "sine", d: 1.6, v: 0.08, a: 0.4, vib: 6, echo: 0.5 }); tone({ t: 1.4, f: 380, f2: 260, type: "sine", d: 1.4, v: 0.06, a: 0.3, vib: 5, echo: 0.5 }); },
        win: () => {},
        streak: () => harp(0, [67, 72, 76, 79, 84], 0.05, 0.06),
        achievement: () => { harp(0, [76, 79, 83, 88], 0.05, 0.08); bloop(0.35, 900, 0.05); },
        title: () => { noise({ type: "lowpass", f: 300, f2: 1400, d: 0.9, v: 0.1, a: 0.3 }); harp(0.3, [60, 64, 67, 72, 76, 79], 0.04, 0.06); },
        tile: i => bloop(0, 300 + (i % 8) * 60, 0.07),
        start: () => { for (let i = 0; i < 8; i++) bloop(i * 0.04, 300 + i * 70, 0.06); harp(0.35, [60, 67, 72, 76, 79, 84], 0.045, 0.07); },
        select: () => bloop(0, 900, 0.05),
        nav: () => { noise({ type: "lowpass", f: 400, f2: 1600, d: 0.3, v: 0.06 }); bloop(0.05, 700, 0.04); },
        mascot: () => { bloop(0, 400, 0.07); bloop(0.08, 650, 0.06); }
    };

    Worlds.register({
        id: "ocean", name: "Coral Reef", icon: "\u{1F420}", tagline: "A Sunlit Reef That Glows at Night.",
        modes: ["light", "dark"],
        scene: (W, H, opts) => OceanScene(W, H, opts), rive: "ocean-win", board, celebrate, titleCard, sounds, transition: "tide",
        mascot: { name: "OTTO", draw: drawOtto },
        lines: {
            hello: ["Ahoy! I'm Otto. Eight arms, zero clues... let's find some!", "Welcome to the reef! The puzzles are swimming in.", "Dive in, the water's lovely today!"],
            start: ["Tap a square and start typing. Space flips Across and Down!", "Every letter leaves a little treasure. Let's fill the board!"],
            word: ["Fin-tastic!", "Shell yeah!", "Whale done!", "That's o-fish-al!", "Reel-y good!", "Swimmingly!"],
            win: ["You found the treasure!", "Fin-ished! Whale of a solve!", "Treasure unlocked, captain!"],
            wrong: ["Hmm, something's a little fishy.", "A few letters are lost at sea."],
            right: ["All shipshape!", "Clear waters ahead!"],
            idle: ["Stuck in the kelp? Try a crossing word.", "Even octopuses need a hint sometimes. Try the shortest clue!"],
            reveal: ["Surfacing a hint...", "Here's a pearl of wisdom."]
        },
        introFlourish(stage) {
            const p = U.center(stage);
            FX.ring({ x: p.x, y: p.y, color: "#8fe3ff", r1: Math.max(innerWidth, innerHeight) * 0.6, dur: 1.2, width: 16 });
            FX.burst({ x: p.x, y: p.y, n: 70, colors: ["#ffffff", "#bff3ff", "#8fe3ff"], shape: "bubble", speed: [100, 450], gravity: -120, drag: 1.2, life: [1.4, 2.4], size: [3, 10], wobble: 30 });
        }
    });
})();
