// The HAUNTED LIBRARY world: an old library where the books have a mind of their own.
//   Day: a sunny reading room, light pouring through a stained-glass window in coloured beams, dust motes
//   drifting in the light, tall bookcases on both sides, and now and then a book flapping across the room.
//   Night: the same room at midnight: moonlight through the window, floating candles that bob and flicker,
//   ghostly wisps, and a friendly ghost drifting past.
//   Board: each letter leaves a little library keepsake in its square (an ink drop, a bookmark, a key, a quill,
//   a wax seal, a star sticker); finished words are underlined in wavy hand-drawn ink.
//   Win: the shelves rumble, books fly off them and circle the board, then burst into a flurry of pages.

(() => {
    const TAU = Math.PI * 2;
    const { tone, noise, midi } = Sound;
    const SPINES = ["#7a1f2b", "#1f4a7a", "#2f6a3a", "#8a5a1a", "#4a2a6a", "#a8442a", "#2a5a5a", "#6a4a2a"];
    const GLASS = ["rgba(200,60,70,.45)", "rgba(60,110,200,.45)", "rgba(240,190,60,.5)", "rgba(70,160,90,.45)", "rgba(150,80,190,.45)"];
    const dark = () => document.documentElement.dataset.theme === "dark";

    // The background is LibraryScene (library-scene.js)

    // ---------------------------------------------------------------------------------------------
    // The board: a keepsake in each typed square; finished words underlined in wavy ink
    // ---------------------------------------------------------------------------------------------
    const KEEPSAKES = [
        r => `<path d="M0 -.07C.05 -.01 .06 .03 .04 .055C.02 .08 -.02 .08 -.04 .055C-.06 .03 -.05 -.01 0 -.07Z" class="lb-ink"/><circle cx="-.015" cy=".035" r=".012" fill="rgba(255,255,255,.5)"/>`,
        r => `<path d="M-.03 -.08H.03V.07L0 .045L-.03 .07Z" fill="${["#c0392b", "#2e6db4", "#2f8a4a"][Math.floor(r(1) * 3)]}"/>`,
        r => `<circle cx="-.045" r=".028" fill="none" stroke="#c99a2e" stroke-width=".016"/><path d="M-.017 0H.07M.045 0V.025M.06 0V.02" stroke="#c99a2e" stroke-width=".016" fill="none"/>`,
        r => `<path d="M-.07 .07Q-.02 -.02 .07 -.08Q.04 .01 -.04 .05Z" fill="#f4ead0" stroke="#7a6a50" stroke-width=".008"/><path d="M-.07 .07L.04 -.05" stroke="#7a6a50" stroke-width=".008"/>`,
        r => `<circle r=".055" fill="#a8222e"/><circle r=".034" fill="none" stroke="rgba(255,200,200,.5)" stroke-width=".008"/><path d="M-.012 -.016L.012 .016M.012 -.016L-.012 .016" stroke="rgba(255,200,200,.6)" stroke-width=".008"/>`,
        r => `<path d="M0 -.06L.017 -.02L.06 -.018L.027 .01L.037 .052L0 .03L-.037 .052L-.027 .01L-.06 -.018L-.017 -.02Z" fill="#e8b830" stroke="#a87a10" stroke-width=".006"/>`
    ];
    const board = Worlds.decoBoard({
        id: "lb",
        mark: r => KEEPSAKES[Math.floor(r(0) * KEEPSAKES.length)](r),
        word(entry, cells, rnd, g, across) {
            const [r0, c0] = cells[0], len = cells.length;
            let d = "";
            const steps = len * 4;
            for (let i = 0; i <= steps; i++) {
                const u = 0.08 + i / steps * (len - 0.16), wob = Math.sin(i * 1.7 + rnd(1) * 6) * 0.03 + (rnd(i, 2) - 0.5) * 0.015;
                const x = across ? c0 + u : c0 + 0.92 + wob, y = across ? r0 + 0.92 + wob : r0 + u;
                d += (i ? "L" : "M") + x.toFixed(3) + " " + y.toFixed(3);
            }
            U.svg("path", { d, class: "lb-line", pathLength: "1" }, g);
        },
        type(cell) {
            const p = U.center(cell);
            FX.burst({ x: p.x, y: p.y, n: 6, colors: dark() ? ["#b6ffe0", "#e0d0ff"] : ["#2a1a10", "#4a3020"], shape: "circle", speed: [30, 110], gravity: dark() ? -60 : 260, life: [0.35, 0.6], size: [1.5, 3] });
        },
        wordDone(entry, cells) {
            cells.forEach(([r, c], i) => setTimeout(() => {
                const cell = Game.cellEl(r, c);
                if (!cell) return;
                const p = U.center(cell);
                FX.burst({ x: p.x, y: p.y, n: 4, colors: ["#f6ecd2", "#efe2c2"], shape: "rect", speed: [40, 120], gravity: -40, drag: 1.2, life: [0.7, 1.1], size: [7, 10] });
            }, i * 70));
        }
    });

    // ---------------------------------------------------------------------------------------------
    // The win: the shelves rumble, books fly off and circle the board, then burst into pages
    // ---------------------------------------------------------------------------------------------
    async function celebrate(c, { boardEl }) {
        if (U.motion() === "still") return;
        const W = innerWidth, H = innerHeight, b = boardEl.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
        const overlay = document.getElementById("overlay");
        // a grimoire rises in front of the board, bursts its clasp as the books burst, riffles and lets out runes
        // (Rive: rive/library-win.riv, timed to the steps below)
        const side = Math.min(W * 0.95, b.width * 1.85);
        c.later(() => {
            const art = Anim.play("library-win", { follow: boardEl, ms: 5500, fadeMs: 300, rect: r => ({ x: r.left + r.width / 2 - side / 2, y: r.top + r.height / 2 - side * 0.55, w: side, h: side * 560 / 600 }) });
            c.cleanup(() => art.stop());
        }, 300);
        // 1. a rumble
        Sound.play("rumble");
        FX.shake(7, 700);
        await c.wait(650);
        if (c.skipped) return;
        // 2. books fly in from both sides and circle the board
        const books = [];
        const n = U.motion() === "lite" ? 6 : 10, R = Math.max(b.width, b.height) * 0.68;
        for (let i = 0; i < n; i++) {
            const book = U.el("div", { class: "lb-book", style: { "--c": SPINES[i % SPINES.length], left: cx - 30 + "px", top: cy - 20 + "px" }, html: "<i></i><i></i>" });
            overlay.appendChild(book);
            books.push(book);
            const from = i % 2 ? W * 0.75 : -W * 0.75, a0 = i / n * TAU;
            const frames = [{ transform: `translate(${from}px, ${(i / n - 0.5) * H * 0.6}px) scale(.6)` }];
            for (let k = 1; k <= 6; k++) { const a = a0 + k / 6 * Math.PI * 1.4; frames.push({ transform: `translate(${(Math.cos(a) * R).toFixed(0)}px, ${(Math.sin(a) * R * 0.75).toFixed(0)}px) scale(${(0.9 + 0.2 * Math.sin(a)).toFixed(2)})` }); }
            book.animate(frames, { duration: 1900, delay: i * 70, easing: "ease-in-out", fill: "both" });
        }
        c.cleanup(() => books.forEach(bk => bk.remove()));
        FX.follow(c, boardEl, ...books);
        Sound.play("flutter");
        c.later(() => Sound.play("flutter"), 700);
        await c.wait(2000);
        if (c.skipped) return;
        // 3. they swoop to the middle and burst into pages
        books.forEach(bk => bk.animate([{ opacity: 1 }, { transform: "translate(0, 0) scale(.2)", opacity: 0 }], { duration: 350, easing: "ease-in", fill: "forwards" }));
        await c.wait(330);
        if (c.skipped) return;
        Sound.play("burst");
        Anim.motion().then(({ animate, stagger }) => {                         // the squares turn over like pages
            if (c.skipped) return;
            const cells = [...boardEl.querySelectorAll(".cell:not(.block)")];
            const run = animate(cells, { rotateY: [0, 360] }, { duration: 0.7, delay: stagger(0.025), ease: "easeInOut" });
            c.cleanup(() => { try { run.complete(); } catch (err) { /* done */ } cells.forEach(el => { el.style.transform = ""; }); });
        }).catch(() => null);
        FX.flash(dark() ? "#d8c8ff" : "#fff6dc", 450, 0.55);
        FX.ring({ x: cx, y: cy, color: dark() ? "#b6ffe0" : "#c99a2e", r1: Math.max(W, H) * 0.6, dur: 1.1, width: 14, glow: dark() });
        FX.burst({ x: cx, y: cy, n: 90, colors: ["#f6ecd2", "#efe2c2", "#fffaf0"], shape: "rect", speed: [200, 650], gravity: 160, drag: 1.1, life: [1.8, 2.8], size: [9, 14] });
        FX.burst({ x: cx, y: cy, n: 30, colors: ["#e8b830", "#ffffff", dark() ? "#b6ffe0" : "#c0392b"], shape: "star", speed: [150, 450], gravity: 120, life: [1.2, 2], size: [4, 8], spin: 5 });
        await c.wait(900);
        if (c.skipped) return;
        // 4. pages drift down over everything
        FX.burst({ x: W / 2, y: -30, jitter: W / 2, jitterY: 10, n: 50, colors: ["#f6ecd2", "#efe2c2"], shape: "rect", angle: Math.PI / 2, spread: 0.3, speed: [30, 90], gravity: 60, drag: 0.6, life: [2.8, 3.8], size: [9, 13], delay: [0, 1.2] });
        Sound.play("sparkle");
        await c.wait(2200);
    }

    // ---------------------------------------------------------------------------------------------
    // Title card: a leather-bound book swings its cover open
    // ---------------------------------------------------------------------------------------------
    async function titleCard(c, info) {
        const card = U.el("div", { class: "tc tc-library", "aria-hidden": "true", html: `
            <div class="tcl-book">
                <div class="tcl-page"><small>${U.esc(info.kicker)}</small><h2>${U.esc(info.title)}</h2><p>${U.esc(info.sub)}</p><i class="tcl-orn">~ &#10022; ~</i></div>
                <div class="tcl-cover"><b>&#10086;</b></div>
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
    // The mascot: Boo, a ghost librarian in round glasses
    // ---------------------------------------------------------------------------------------------
    function drawBoo(g, s) {
        const happy = s.mood === "happy", wow = s.mood === "wow", sad = s.mood === "sad";
        g.save();
        g.translate(80, 78 + Math.sin(s.t * 2) * 5 - s.hop * 10);
        g.rotate(Math.sin(s.t * 1.3) * 0.05);
        // the soft glow around the ghost
        const gl = g.createRadialGradient(0, 0, 10, 0, 0, 70);
        gl.addColorStop(0, "rgba(200,220,255,.35)"); gl.addColorStop(1, "rgba(200,220,255,0)");
        g.fillStyle = gl; g.beginPath(); g.arc(0, 0, 70, 0, TAU); g.fill();
        // the body with a wavy tail
        g.fillStyle = "rgba(246,248,255,.96)";
        g.strokeStyle = "#9aa4c8";
        g.lineWidth = 2.5;
        g.beginPath();
        g.arc(0, -8, 38, Math.PI, TAU);
        g.lineTo(38, 40);
        for (let i = 1; i <= 6; i++) { const x = 38 - i * (76 / 6), y = 40 + (i % 2 ? 10 : -2) + Math.sin(s.t * 5 + i) * 4; g.quadraticCurveTo(x + 76 / 12, y + 8 * (i % 2 ? 1 : -0.4), x, y); }
        g.closePath();
        g.fill(); g.stroke();
        // arms: little nubs; one waves when happy
        for (const side of [-1, 1]) {
            g.save(); g.translate(side * 36, 14); g.rotate(side * (0.5 + (happy && side > 0 ? Math.sin(s.t * 10) * 0.6 - 0.6 : 0)));
            g.beginPath(); g.ellipse(side * 6, 0, 12, 7, 0, 0, TAU); g.fill(); g.stroke(); g.restore();
        }
        // a little book held in front
        g.fillStyle = "#7a1f2b"; g.fillRect(-14, 18, 28, 20);
        g.fillStyle = "#f4ead0"; g.fillRect(-12, 20, 24, 3);
        g.fillStyle = "#e8b830"; g.fillRect(-3, 25, 6, 8);
        // eyes behind round glasses
        const ex = s.look * 3;
        for (const side of [-1, 1]) {
            const x = side * 14 + ex, y = -12;
            g.fillStyle = "#2a2440";
            if (s.blink > 0.5) g.fillRect(x - 5, y, 10, 2.5);
            else if (happy) { g.lineWidth = 2.6; g.strokeStyle = "#2a2440"; g.beginPath(); g.arc(x, y + 3, 5, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
            else { g.beginPath(); g.ellipse(x, y, wow ? 5 : 4, wow ? 7 : 6, 0, 0, TAU); g.fill(); g.fillStyle = "#ffffff"; g.beginPath(); g.arc(x + 1.5, y - 2, 1.5, 0, TAU); g.fill(); }
            g.strokeStyle = "#6a5a3a"; g.lineWidth = 2;
            g.beginPath(); g.arc(side * 14, y, 11, 0, TAU); g.stroke();
        }
        g.beginPath(); g.moveTo(-3, -12); g.quadraticCurveTo(0, -15, 3, -12); g.stroke();       // the bridge of the glasses
        // blush and mouth
        g.fillStyle = "rgba(255,150,180,.35)"; g.beginPath(); g.ellipse(-24, 2, 6, 3.5, 0, 0, TAU); g.ellipse(24, 2, 6, 3.5, 0, 0, TAU); g.fill();
        const open = Math.max(s.talk, wow ? 0.8 : 0);
        g.strokeStyle = "#2a2440"; g.lineWidth = 2.2;
        if (open > 0.1) { g.fillStyle = "#2a2440"; g.beginPath(); g.ellipse(0, 5, 4, 2 + open * 4, 0, 0, TAU); g.fill(); }
        else { g.beginPath(); g.moveTo(-6, 4); g.quadraticCurveTo(0, sad ? 0 : 9, 6, 4); g.stroke(); }
        g.restore();
    }

    // ---------------------------------------------------------------------------------------------
    // Sounds: a music box, page flutters and a spooky (but friendly) "oooo"
    // ---------------------------------------------------------------------------------------------
    const box = (t, n, v = 0.05) => { tone({ t, f: midi(n), type: "sine", d: 0.7, v, echo: 0.25 }); tone({ t, f: midi(n) * 4, type: "sine", d: 0.08, v: v * 0.25 }); };
    const sounds = {
        type: () => tone({ f: U.pick([420, 460, 500]), f2: 300, type: "triangle", d: 0.06, v: 0.08, filt: { f: 1400 } }),
        erase: () => noise({ type: "bandpass", f: 1800, f2: 900, d: 0.25, v: 0.05, q: 1.5 }),
        move: () => {},
        word: () => [74, 77, 81, 86].forEach((n, i) => box(i * 0.09, n, 0.05)),
        wrong: () => { tone({ f: 220, f2: 196, type: "triangle", d: 0.45, v: 0.1, filt: { f: 900 } }); tone({ t: 0.2, f: 185, f2: 165, type: "triangle", d: 0.5, v: 0.09, filt: { f: 900 } }); },
        right: () => [74, 78, 81, 86, 90].forEach((n, i) => box(i * 0.07, n, 0.045)),
        reveal: () => tone({ f: 380, f2: 560, type: "sine", d: 0.8, v: 0.07, vib: 18, echo: 0.3 }),
        flip: () => box(0, 93, 0.03),
        flutter: () => { noise({ type: "bandpass", f: 900, f2: 2400, d: 0.4, v: 0.12, q: 0.9 }); noise({ t: 0.18, type: "bandpass", f: 1400, f2: 700, d: 0.35, v: 0.1, q: 0.9 }); },
        rumble: () => { tone({ f: 55, f2: 40, d: 0.8, v: 0.3 }); noise({ type: "lowpass", f: 260, d: 0.8, v: 0.25 }); },
        burst: () => { noise({ type: "bandpass", f: 700, f2: 3000, d: 0.5, v: 0.18, q: 0.7 }); [74, 81, 86, 90, 93].forEach((n, i) => box(0.05 + i * 0.06, n, 0.05)); },
        sparkle: () => [93, 98, 102].forEach((n, i) => box(i * 0.08, n, 0.03)),
        win: () => {},
        streak: () => [69, 74, 77, 81, 86].forEach((n, i) => box(i * 0.07, n, 0.05)),
        achievement: () => { [74, 78, 81, 86].forEach((n, i) => box(i * 0.08, n, 0.05)); tone({ t: 0.35, f: 400, f2: 600, type: "sine", d: 0.6, v: 0.05, vib: 15 }); },
        title: () => { sounds.flutter(); [62, 69, 74, 77].forEach((n, i) => box(0.3 + i * 0.1, n, 0.05)); },
        tile: i => box(0, 74 + (i % 8) * 2, 0.04),
        start: () => { tone({ f: 300, f2: 520, type: "sine", d: 0.9, v: 0.07, vib: 16, echo: 0.3 }); [62, 69, 74, 77, 81].forEach((n, i) => box(0.3 + i * 0.08, n, 0.05)); },
        select: () => box(0, 86, 0.03),
        nav: () => noise({ type: "bandpass", f: 1000, f2: 2200, d: 0.3, v: 0.06, q: 0.9 }),
        mascot: () => tone({ f: 420, f2: 620, type: "sine", d: 0.4, v: 0.05, vib: 20 })
    };

    Worlds.register({
        id: "library", name: "Haunted Library", icon: "\u{1F4DA}", tagline: "Quiet Shelves. Restless Ghosts.",
        modes: ["light", "dark"],
        scene: (W, H, opts) => LibraryScene(W, H, opts), rive: "library-win", board, celebrate, titleCard, sounds, transition: "pages",
        mascot: { name: "BOO", draw: drawBoo },
        lines: {
            hello: ["Oh! You can see me? Welcome to the library!", "Shhh... a new puzzle just appeared on the shelf.", "Boo! Sorry, force of habit. Let's solve!"],
            start: ["Tap a square and start typing. Space flips Across and Down.", "Every answer is hiding somewhere in these books..."],
            word: ["Well read!", "By the book!", "Spooky good!", "Page turner!", "Booo-tiful!", "Checked out!"],
            win: ["The whole library is cheering! Quietly, of course.", "A fang-tastic finish!", "You've earned a gold star sticker!"],
            wrong: ["Hmm, a few of these need an eraser.", "Some letters wandered off the page."],
            right: ["Every word in its place!", "Perfectly catalogued!"],
            idle: ["Stuck? Try the shortest clue first.", "The crossing words might give you a hint..."],
            reveal: ["I peeked at the answer key...", "A little ghostly help!"]
        },
        introFlourish(stage) {
            const p = U.center(stage);
            FX.ring({ x: p.x, y: p.y, color: "#c99a2e", r1: Math.max(innerWidth, innerHeight) * 0.6, dur: 1.2, width: 12, glow: false });
            FX.burst({ x: p.x, y: p.y, n: 60, colors: ["#f6ecd2", "#efe2c2", "#fffaf0"], shape: "rect", speed: [200, 600], gravity: 120, drag: 1, life: [1.4, 2.4], size: [9, 13] });
        }
    });
})();
