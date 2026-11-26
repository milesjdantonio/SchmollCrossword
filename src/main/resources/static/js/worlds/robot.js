// The ROBOT FACTORY world: a busy factory floor run by friendly machines.
//   Day: a clean, bright lab: gears turning on the wall, pipes overhead, blinking control panels, a conveyor
//   belt carrying crates past two robot arms that swing and pick them up, and a little drone buzzing by.
//   Night: the night shift: dark steel, orange warning beacons sweeping the walls, a welding arm throwing
//   sparks, glowing monitors and puffs of steam.
//   Board: each letter leaves a machine part in its square (a bolt, a gear, a nut, a chip, an LED, a spring);
//   finished words get a strip of LEDs that light up one after another.
//   Win: a conveyor belt rolls in carrying a trophy, a "COMPLETE" stamp slams down and bolts fly everywhere.

(() => {
    const TAU = Math.PI * 2;
    const { tone, noise, midi } = Sound;
    const LEDS = ["#3cff9a", "#3ad0ff", "#ffcc1a", "#ff5a7a"];
    const METAL = ["#c8d0d8", "#9aa4ae", "#e8ecf0", "#7a848e"];
    const dark = () => document.documentElement.dataset.theme === "dark";

    // a gear with n teeth, radius r, turned by angle a
    function gear(g, x, y, r, n, a, fill, hole) {
        g.save(); g.translate(x, y); g.rotate(a);
        g.fillStyle = fill;
        g.beginPath();
        for (let i = 0; i < n * 2; i++) {
            const k = i / (n * 2) * TAU, rr = i % 2 ? r : r * 0.82, k2 = (i + 1) / (n * 2) * TAU;
            g.lineTo(Math.cos(k) * rr, Math.sin(k) * rr); g.lineTo(Math.cos(k2) * rr, Math.sin(k2) * rr);
        }
        g.closePath(); g.fill();
        g.fillStyle = hole;
        g.beginPath(); g.arc(0, 0, r * 0.3, 0, TAU); g.fill();
        for (let i = 0; i < 4; i++) { const k = i / 4 * TAU + 0.4; g.beginPath(); g.arc(Math.cos(k) * r * 0.55, Math.sin(k) * r * 0.55, r * 0.11, 0, TAU); g.fill(); }
        g.restore();
    }

    // ---------------------------------------------------------------------------------------------
    // The board: a machine part in each typed square; an LED strip along finished words
    // ---------------------------------------------------------------------------------------------
    const PARTS = [
        `<path d="M.05 0L.025 .043L-.025 .043L-.05 0L-.025 -.043L.025 -.043Z" fill="#9aa4ae" stroke="#5a646e" stroke-width=".008"/><path d="M-.03 0H.03" stroke="#4a545e" stroke-width=".012"/>`,
        `<g fill="#b0bac6">${Array.from({ length: 8 }, (_, i) => `<rect x="-.012" y="-.062" width=".024" height=".024" transform="rotate(${i * 45})"/>`).join("")}<circle r=".045"/></g><circle r=".016" fill="#e8ecf0"/>`,
        `<path d="M.045 0L.022 .039L-.022 .039L-.045 0L-.022 -.039L.022 -.039Z" fill="#c8a040"/><circle r=".018" fill="#ffffff" fill-opacity=".85"/>`,
        `<rect x="-.045" y="-.035" width=".09" height=".07" rx=".008" fill="#2a3a2e"/><g stroke="#c8a040" stroke-width=".01">${[-0.025, 0, 0.025].map(x => `<path d="M${x} -.035V-.055M${x} .035V.055"/>`).join("")}</g><rect x="-.018" y="-.014" width=".036" height=".028" fill="#3a4a3e"/>`,
        r => `<circle r=".03" fill="${LEDS[Math.floor(r(1) * 4)]}" class="rb-led"/><circle cx="-.008" cy="-.01" r=".008" fill="rgba(255,255,255,.7)"/>`,
        `<path d="M-.05 -.03Q-.03 -.06 -.01 -.03T.03 -.03T.05 -.03M-.05 .01Q-.03 -.02 -.01 .01T.03 .01T.05 .01M-.05 .05Q-.03 .02 -.01 .05T.03 .05T.05 .05" stroke="#8a96a2" stroke-width=".012" fill="none"/>`
    ];
    const board = Worlds.decoBoard({
        id: "rb",
        mark: r => { const p = PARTS[Math.floor(r(0) * PARTS.length)]; return typeof p === "function" ? p(r) : p; },
        word(entry, cells, rnd, g, across) {
            const [r0, c0] = cells[0], len = cells.length;
            const bar = across ? { x: c0 + 0.06, y: r0 + 0.885, width: len - 0.12, height: 0.07 } : { x: c0 + 0.885, y: r0 + 0.06, width: 0.07, height: len - 0.12 };
            U.svg("rect", { ...bar, rx: ".03", class: "rb-strip" }, g);
            const n = len * 4;
            for (let i = 0; i < n; i++) {
                const u = 0.12 + (i + 0.5) / n * (len - 0.24);
                const led = U.svg("circle", { cx: (across ? c0 + u : c0 + 0.92).toFixed(3), cy: (across ? r0 + 0.92 : r0 + u).toFixed(3), r: ".018", class: "rb-dot" }, g);
                led.style.animationDelay = (i * 0.05).toFixed(2) + "s";
            }
        },
        type(cell) {
            const p = U.center(cell);
            FX.burst({ x: p.x + p.w * 0.3, y: p.y + p.h * 0.3, n: 6, colors: ["#ffe680", "#9ae6ff", "#ffffff"], shape: "spark", speed: [80, 200], gravity: 400, drag: 1, life: [0.25, 0.45], size: [1.5, 2.5] });
        },
        wordDone(entry, cells) {
            cells.forEach(([r, c], i) => setTimeout(() => {
                const cell = Game.cellEl(r, c);
                if (!cell) return;
                const p = U.center(cell);
                FX.burst({ x: p.x, y: p.y, n: 8, colors: LEDS, shape: "pixel", speed: [50, 140], gravity: 200, life: [0.5, 0.8], size: [4, 6] });
            }, i * 50));
        }
    });

    // ---------------------------------------------------------------------------------------------
    // The win: a conveyor belt rolls in a trophy, a COMPLETE stamp slams down, bolts fly everywhere
    // ---------------------------------------------------------------------------------------------
    const TROPHY = `<svg viewBox="0 0 120 140" aria-hidden="true">
        <path d="M30 14H90V40Q90 80 60 86Q30 80 30 40Z" fill="#ffd23a" stroke="#a87a10" stroke-width="3"/>
        <path d="M30 22H14Q12 50 34 56M90 22H106Q108 50 86 56" fill="none" stroke="#ffd23a" stroke-width="7"/>
        <rect x="52" y="86" width="16" height="22" fill="#e8a820"/><rect x="34" y="108" width="52" height="16" rx="3" fill="#5a646e"/>
        <path d="M44 24Q42 50 52 64" stroke="rgba(255,255,255,.6)" stroke-width="5" fill="none" stroke-linecap="round"/>
        <path d="M60 30L65 41L77 42L68 50L71 62L60 56L49 62L52 50L43 42L55 41Z" fill="#fff2b0"/></svg>`;
    async function celebrate(c, { boardEl }) {
        if (U.motion() === "still") return;
        const W = innerWidth, H = innerHeight, b = boardEl.getBoundingClientRect(), cx = b.left + b.width / 2;
        const overlay = document.getElementById("overlay");
        // 1. a conveyor belt slides up into view along the bottom of the screen
        const belt = U.el("div", { class: "rb-belt" });
        overlay.appendChild(belt);
        c.cleanup(() => belt.remove());
        Sound.play("servo");
        belt.animate([{ transform: "translateY(100%)" }, { transform: "none" }], { duration: 450, easing: "ease-out", fill: "backwards" });
        await c.wait(450);
        if (c.skipped) return;
        // 2. a trophy rides in on it and stops in the middle
        // (the trophy element rides the belt and lifts; Rive's trophy, rive/robot-win.riv, follows it, larger)
        const trophy = U.el("div", { class: "rb-trophy", style: { left: cx - 60 + "px" } });
        overlay.appendChild(trophy);
        c.cleanup(() => trophy.remove());
        const art = Anim.play("robot-win", { follow: trophy, ms: 5600, fadeMs: 300, z: 834, rect: r => ({ x: r.left + r.width / 2 - r.width * 1.55, y: r.top + r.height * 0.5 - r.width * 1.75, w: r.width * 3.1, h: r.width * 3.1 }) });
        c.cleanup(() => art.stop());
        Sound.play("conveyor");
        trophy.animate([{ transform: `translateX(${-cx - 140}px)` }, { transform: "translateX(8px)", offset: 0.9 }, { transform: "none" }], { duration: 1400, easing: "cubic-bezier(.3,.6,.4,1)", fill: "backwards" });
        await c.wait(1450);
        if (c.skipped) return;
        belt.classList.add("stop");
        // 3. it rises up and shines
        trophy.classList.add("lift");
        Sound.play("powerup");
        const tp = U.center(trophy);
        FX.ring({ x: tp.x, y: tp.y - H * 0.15, color: "#ffd23a", r1: 260, dur: 0.8, width: 8, glow: dark() });
        await c.wait(700);
        if (c.skipped) return;
        // 4. a COMPLETE stamp slams down and bolts fly everywhere
        const stamp = U.el("div", { class: "rb-stamp", text: "COMPLETE" });
        overlay.appendChild(stamp);
        c.cleanup(() => stamp.remove());
        await c.wait(220);
        if (c.skipped) return;
        Sound.play("stamp");
        FX.shake(10, 400);
        FX.flash(dark() ? "#9ae6ff" : "#ffffff", 300, 0.5);
        const p = U.center(stamp);
        FX.burst({ x: p.x, y: p.y, n: 70, colors: METAL, shape: "pixel", speed: [250, 700], gravity: 700, drag: 0.5, life: [1.4, 2.2], size: [5, 9] });
        FX.burst({ x: p.x, y: p.y, n: 50, colors: ["#ffe680", "#9ae6ff", "#ffffff"], shape: "spark", speed: [300, 800], gravity: 300, life: [0.6, 1.1], size: [2, 3] });
        FX.burst({ x: W / 2, y: -20, jitter: W / 2, jitterY: 10, n: 90, colors: LEDS, shape: "rect", angle: Math.PI / 2, spread: 0.4, speed: [60, 180], gravity: 240, drag: 0.5, life: [2.2, 3.2], size: [6, 9], delay: [0.2, 1] });
        await c.wait(2200);
        for (const node of [stamp, trophy, belt]) node.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: "forwards" });
        await c.wait(400);
    }

    // ---------------------------------------------------------------------------------------------
    // Title card: a monitor flickers on and prints the puzzle's name
    // ---------------------------------------------------------------------------------------------
    async function titleCard(c, info) {
        const card = U.el("div", { class: "tc tc-robot", "aria-hidden": "true", html: `
            <div class="tcr-monitor"><div class="tcr-screen"><small>&gt; ${U.esc(info.kicker)}_</small><h2>${U.esc(info.title)}</h2><p>${U.esc(info.sub)}</p></div><i class="tcr-led"></i></div>` });
        document.getElementById("overlay").appendChild(card);
        c.cleanup(() => card.remove());
        Sound.play("title");
        await c.wait(2000);
        if (c.skipped) return;
        card.classList.add("out");
        Sound.play("powerdown");
        await c.wait(450);
    }

    // ---------------------------------------------------------------------------------------------
    // The mascot: Bolt, a boxy little robot with a screen for a face
    // ---------------------------------------------------------------------------------------------
    function drawBolt(g, s) {
        const happy = s.mood === "happy", wow = s.mood === "wow", sad = s.mood === "sad";
        g.save();
        g.translate(80, 148);
        // treads
        g.fillStyle = "#3a424c"; g.beginPath(); g.roundRect(-34, -16, 68, 16, 8); g.fill();
        g.fillStyle = "#6a747e"; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(-26 + i * 10.4 + (s.t * 8 % 10.4) * 0, -8, 4, 0, TAU); g.fill(); }
        g.translate(0, -s.hop * 12 + Math.sin(s.t * 3) * 1);
        // arms on springs, waving when happy
        for (const side of [-1, 1]) {
            g.save(); g.translate(side * 30, -44); g.rotate(side * (0.3 + (happy ? Math.sin(s.t * 12 + side) * 0.5 : wow ? -0.8 : 0)));
            g.strokeStyle = "#8a96a2"; g.lineWidth = 3;
            g.beginPath(); for (let i = 0; i <= 8; i++) g.lineTo(side * (4 + i * 2.2), (i % 2 ? -4 : 4)); g.stroke();
            g.fillStyle = "#ff8a1e"; g.beginPath(); g.arc(side * 24, 0, 6, 0, TAU); g.fill();
            g.restore();
        }
        // the body
        const bg = g.createLinearGradient(-30, -70, 30, -16);
        bg.addColorStop(0, "#e8ecf0"); bg.addColorStop(1, "#a8b2bc");
        g.fillStyle = bg; g.strokeStyle = "#5a646e"; g.lineWidth = 2.5;
        g.beginPath(); g.roundRect(-30, -66, 60, 50, 8); g.fill(); g.stroke();
        for (let i = 0; i < 3; i++) { g.fillStyle = Math.sin(s.t * 4 + i * 2) > 0 ? LEDS[i] : "#4a545e"; g.beginPath(); g.arc(-12 + i * 12, -30, 3.5, 0, TAU); g.fill(); }
        g.fillStyle = "#5a646e"; g.fillRect(-14, -50, 28, 8);
        // the head: a box with a screen face
        g.translate(0, -70);
        g.rotate(s.look * 0.05);
        g.strokeStyle = "#5a646e"; g.lineWidth = 2;
        g.beginPath(); g.moveTo(0, -48); g.lineTo(0, -62); g.stroke();
        const blink = Math.sin(s.t * 4) > 0;
        g.fillStyle = blink ? "#ff5a7a" : "#8a2a3a"; g.beginPath(); g.arc(0, -64, 5, 0, TAU); g.fill();
        g.fillStyle = bg; g.strokeStyle = "#5a646e"; g.lineWidth = 2.5;
        g.beginPath(); g.roundRect(-36, -48, 72, 50, 10); g.fill(); g.stroke();
        g.fillStyle = "#4a545e"; g.fillRect(-42, -30, 6, 16); g.fillRect(36, -30, 6, 16);
        g.fillStyle = "#0e1a16"; g.beginPath(); g.roundRect(-28, -40, 56, 34, 6); g.fill();
        // pixel eyes and mouth in screen green
        const P = 3.4, ink = "#3cff9a", ex = Math.round(s.look * 2) * P;
        g.fillStyle = ink;
        const px = (x, y) => g.fillRect(x * P + ex, y * P, P - 0.4, P - 0.4);
        for (const side of [-1, 1]) {
            const cx = side * 4;
            if (s.blink > 0.5) { for (let i = -1; i <= 1; i++) px(cx + i, -7); continue; }
            if (happy) { px(cx - 1, -7); px(cx, -8); px(cx + 1, -7); continue; }
            if (sad) { px(cx - 1, -8 + (side > 0 ? 0 : 1)); px(cx, -7); px(cx + 1, -8 + (side > 0 ? 1 : 0)); continue; }
            const big = wow ? 1 : 0;
            for (let y = -9 - big; y <= -7 + big; y++) for (let x = -1 - big; x <= 1 + big; x++) if (!(Math.abs(x) === 1 + big && Math.abs(y + 8) === 1 + big)) px(cx + x, y);
        }
        const open = Math.max(s.talk, wow ? 0.8 : 0);
        if (open > 0.1) { for (let x = -2; x <= 2; x++) px(x, -4); for (let x = -2; x <= 2; x++) if (open > 0.5) px(x, -3); }
        else if (sad) { px(-2, -3); px(-1, -4); px(0, -4); px(1, -4); px(2, -3); }
        else { px(-3, -4); px(-2, -3); px(-1, -3); px(0, -3); px(1, -3); px(2, -3); px(3, -4); }
        g.restore();
    }

    // ---------------------------------------------------------------------------------------------
    // Sounds: soft beeps and boops, servo whirs and a big stamp
    // ---------------------------------------------------------------------------------------------
    const beep = (t, n, v = 0.05, d = 0.09) => tone({ t, f: midi(n), type: "square", d, v, filt: { f: 2400 } });
    const sounds = {
        type: () => tone({ f: U.pick([620, 680, 740]), type: "square", d: 0.04, v: 0.04, filt: { f: 1600 } }),
        erase: () => tone({ f: 500, f2: 300, type: "square", d: 0.06, v: 0.04, filt: { f: 1400 } }),
        move: () => {},
        word: () => [0, 4, 7, 12].forEach((k, i) => beep(i * 0.06, 76 + k, 0.045)),
        wrong: () => { beep(0, 52, 0.07, 0.18); beep(0.2, 48, 0.07, 0.3); },
        right: () => [0, 4, 7, 12, 16].forEach((k, i) => beep(i * 0.05, 79 + k, 0.04)),
        reveal: () => { tone({ f: 300, f2: 1200, type: "sawtooth", d: 0.3, v: 0.03, filt: { f: 1800 } }); beep(0.3, 91, 0.03); },
        flip: () => beep(0, 88, 0.025, 0.04),
        servo: () => tone({ f: 120, f2: 260, type: "sawtooth", d: 0.45, v: 0.05, filt: { f: 700 } }),
        conveyor: () => { tone({ f: 80, f2: 90, type: "sawtooth", d: 1.4, v: 0.05, filt: { f: 400 }, vib: 4 }); noise({ type: "lowpass", f: 500, d: 1.4, v: 0.1 }); },
        powerup: () => tone({ f: 200, f2: 1400, type: "sawtooth", d: 0.6, v: 0.04, filt: { f: 2000 } }),
        powerdown: () => tone({ f: 900, f2: 120, type: "sawtooth", d: 0.4, v: 0.035, filt: { f: 1600 } }),
        stamp: () => { tone({ f: 110, f2: 45, d: 0.4, v: 0.45 }); noise({ type: "lowpass", f: 900, f2: 200, d: 0.4, v: 0.3 }); [72, 79, 84, 91].forEach((n, i) => beep(0.15 + i * 0.07, n, 0.04, 0.12)); },
        sparkle: () => [84, 88, 91, 96].forEach((n, i) => beep(i * 0.06, n, 0.025, 0.06)),
        win: () => {},
        streak: () => [72, 76, 79, 84].forEach((n, i) => beep(i * 0.07, n, 0.045, 0.12)),
        achievement: () => { [72, 76, 79, 84].forEach((n, i) => beep(i * 0.08, n, 0.04, 0.12)); tone({ t: 0.35, f: midi(88), type: "triangle", d: 0.5, v: 0.06, echo: 0.2 }); },
        title: () => { tone({ f: 60, f2: 120, type: "sawtooth", d: 0.3, v: 0.04, filt: { f: 600 } }); [76, 79, 84].forEach((n, i) => beep(0.3 + i * 0.1, n, 0.04)); },
        tile: i => beep(0, 72 + (i % 8) * 2, 0.035, 0.07),
        start: () => { tone({ f: 100, f2: 900, type: "sawtooth", d: 0.6, v: 0.04, filt: { f: 1600 } }); [72, 76, 79, 84].forEach((n, i) => beep(0.5 + i * 0.07, n, 0.04)); },
        select: () => beep(0, 84, 0.025, 0.04),
        nav: () => { beep(0, 79, 0.03, 0.05); beep(0.06, 86, 0.025, 0.05); },
        mascot: () => { beep(0, 84, 0.03, 0.05); beep(0.07, 79, 0.03, 0.05); beep(0.14, 88, 0.03, 0.06); }
    };

    Worlds.register({
        id: "robot", name: "Robot Factory", icon: "\u{1F916}", tagline: "Gears, Belts and Sparks.",
        modes: ["light", "dark"],
        scene: (W, H, opts) => RobotScene(W, H, opts), rive: "robot-win", board, celebrate, titleCard, sounds, transition: "shutter",
        mascot: { name: "BOLT", draw: drawBolt },
        lines: {
            hello: ["BEEP BOOP. I am Bolt. Puzzle module loaded!", "Welcome to the factory! Today we build words.", "Systems online. Ready to solve!"],
            start: ["Tap a square and start typing. Space flips Across and Down!", "Insert letters to begin production."],
            word: ["Word assembled!", "Bolted on!", "Efficient!", "Gears turning!", "Quality checked!", "Beep-tastic!"],
            win: ["PUZZLE COMPLETE. Joy levels at 100%!", "Production finished! Trophy dispatched!", "You are a well-oiled machine!"],
            wrong: ["ERROR: a few letters failed inspection.", "Hmm, some parts don't fit."],
            right: ["All systems green!", "Zero defects! Excellent!"],
            idle: ["Processing... Try a crossing word for more data.", "Recommendation: start with the shortest clue."],
            reveal: ["Downloading a hint...", "Installing letter... done!"]
        },
        introFlourish(stage) {
            const p = U.center(stage);
            FX.ring({ x: p.x, y: p.y, color: "#3ad0ff", r1: Math.max(innerWidth, innerHeight) * 0.6, dur: 1, width: 10, glow: true });
            FX.burst({ x: p.x, y: p.y, n: 70, colors: LEDS, shape: "pixel", speed: [200, 650], gravity: 250, drag: 1, life: [1.2, 2], size: [5, 8] });
        }
    });
})();
