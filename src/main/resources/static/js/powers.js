// Campaign powers (built by Claude at the user's request): every boss-fight ability and every boss move, each with
// its own effect, its own animation and its own synthesized sound. The rule (the user's): no two abilities do the
// same thing, and no ability is just a stronger copy of another one. The same goes for the bosses' moves.
//
//   Powers.ABILITIES   45 abilities, 3 per world: { id, world, name, icon, kind, flavor, desc, fx, sound }
//   Powers.MOVES       each boss's moves:         { world: [{ name, icon, kind, d, desc, fx, charge, sound }] }
//   Powers.cast(...)   the animation for using an ability (or a boss move landing on you)
//   Powers.threat(si)  how hard a world's boss fights (attacks, wind-ups, time, rage), from 0 (world 1) to 1
//
// What each ability KIND does is coded in campaign.js (useAbility); this file holds what they are, how they look
// and how they sound.

const Powers = (() => {
    // ---- sound helpers (all synthesized, see sound.js; noise shorter than 0.25 s is skipped there) ----
    const T = (f, f2, type = "sine", t = 0, d = 0.2, v = 0.12, x = {}) => Sound.tone({ f, f2, type, t, d, v, ...x });
    const N = (f, f2, t = 0, d = 0.4, v = 0.15, x = {}) => Sound.noise({ f, f2, t, d, v, ...x });
    const M = n => Sound.midi(n);
    const arp = (notes, step, type, d, v, x = {}) => notes.forEach((n, i) => T(M(n), null, type, i * step, d, v, x));

    // every ability's sound
    const SND = {
        junk: () => { T(220, 90, "sawtooth", 0, 0.3, 0.08, { filt: { f: 900 } }); N(300, 120, 0.05, 0.45, 0.2, { type: "lowpass" }); T(120, 60, "sine", 0.12, 0.3, 0.3); },
        erase: () => { for (let i = 0; i < 4; i++) N(900 + i * 200, 500, i * 0.09, 0.3, 0.12, { q: 3 }); T(660, 990, "triangle", 0.36, 0.15, 0.06); },
        shield: () => { N(500, 2200, 0, 0.35, 0.12, { q: 1.5 }); arp([67, 74, 79], 0.06, "triangle", 0.3, 0.07); },
        stutter: () => { T(500, 900, "sine", 0, 0.25, 0.08); T(900, 300, "triangle", 0.32, 0.12, 0.12); N(1800, 700, 0.32, 0.3, 0.2, { q: 2 }); },
        vines: () => { [0, 0.12, 0.24, 0.36].forEach((t, i) => T(160 + i * 40, 320 + i * 60, "triangle", t, 0.22, 0.09)); N(500, 200, 0, 0.6, 0.12, { type: "lowpass" }); },
        sun: () => { arp([72, 76, 79, 84, 88], 0.07, "sine", 0.6, 0.06, { echo: 0.4 }); T(M(60), null, "triangle", 0, 1, 0.05); },
        knock: () => { T(900, 500, "square", 0, 0.06, 0.06); T(300, 140, "sine", 0.05, 0.25, 0.35); T(1200, 1800, "triangle", 0.3, 0.12, 0.05); },
        bury: () => { for (let i = 0; i < 5; i++) N(1400 - i * 150, 400, i * 0.08, 0.3, 0.12, { q: 1 }); T(180, 110, "sine", 0.4, 0.3, 0.2); },
        hint: () => { arp([79, 83, 86], 0.08, "triangle", 0.25, 0.08, { echo: 0.3 }); T(M(91), null, "sine", 0.3, 0.5, 0.05, { echo: 0.5 }); },
        slow: () => { T(400, 90, "sawtooth", 0, 1.1, 0.06, { filt: { f: 700 }, vib: 6 }); N(300, 100, 0, 0.9, 0.1, { type: "lowpass" }); },
        super: () => { for (let i = 0; i < 8; i++) T(M(60 + i * 3), null, "square", i * 0.04, 0.1, 0.03); T(M(84), M(96), "triangle", 0.32, 0.4, 0.08); },
        reflect: () => { T(300, 900, "sine", 0, 0.15, 0.2); T(900, 450, "sine", 0.14, 0.2, 0.15); T(450, 1100, "triangle", 0.3, 0.25, 0.08); },
        cleanse: () => { N(2400, 400, 0, 0.9, 0.12, { q: 0.6 }); arp([72, 79, 84, 91], 0.1, "sine", 0.5, 0.05, { echo: 0.4 }); },
        bubble: () => { [0, 0.07, 0.14, 0.21, 0.3].forEach((t, i) => T(300 + i * 120, 900 + i * 200, "sine", t, 0.09, 0.12)); T(200, 500, "sine", 0.4, 0.4, 0.1, { vib: 20 }); },
        undo: () => { T(1200, 200, "triangle", 0, 0.7, 0.07); N(800, 200, 0.1, 0.8, 0.14, { type: "lowpass" }); T(M(55), M(48), "sine", 0.5, 0.4, 0.1); },
        freeze: () => { arp([96, 91, 88, 84, 79], 0.05, "triangle", 0.35, 0.05, { echo: 0.3 }); N(3000, 800, 0, 0.6, 0.09, { q: 4 }); },
        delay: () => { N(400, 1600, 0, 1.2, 0.16, { q: 0.5 }); N(1500, 300, 0.5, 1, 0.12, { q: 0.5 }); T(M(84), null, "sine", 0.2, 0.8, 0.03, { echo: 0.5 }); },
        armor: () => { T(M(48), null, "triangle", 0, 0.6, 0.12); T(M(55), null, "triangle", 0.05, 0.6, 0.1); T(2400, 3000, "sine", 0.1, 0.3, 0.04); T(3200, 2600, "sine", 0.25, 0.3, 0.03); },
        wash: () => { N(300, 2000, 0, 0.5, 0.18, { q: 0.7 }); N(2000, 200, 0.4, 0.8, 0.16, { q: 0.6 }); T(160, 80, "sine", 0.3, 0.4, 0.15); },
        counter: () => { T(80, 40, "sawtooth", 0, 0.5, 0.25, { crush: true }); N(1200, 100, 0, 1.1, 0.3, { type: "lowpass" }); T(M(76), M(88), "square", 0.1, 0.15, 0.04); },
        lucky: () => { arp([72, 74, 76, 79, 81, 84, 86, 88], 0.045, "triangle", 0.2, 0.05); T(M(96), null, "sine", 0.4, 0.6, 0.04, { echo: 0.5 }); },
        scatter: () => { N(200, 3000, 0, 0.7, 0.18, { q: 0.8 }); for (let i = 0; i < 5; i++) T(800 + i * 150, 1200, "triangle", 0.15 + i * 0.07, 0.06, 0.04); },
        silver: () => { Sound.chord(0, [64, 68, 71, 76], { type: "sine", d: 1.1, v: 0.035, echo: 0.4 }); T(M(88), null, "triangle", 0.3, 0.5, 0.04); },
        time: () => { N(250, 900, 0, 0.8, 0.14, { q: 0.7 }); arp([67, 72, 76, 79], 0.09, "triangle", 0.3, 0.07); },
        sand: () => { N(600, 1800, 0, 1.2, 0.18, { q: 0.4 }); N(1800, 500, 0.6, 0.9, 0.12, { q: 0.4 }); T(220, 180, "sawtooth", 0, 1, 0.025, { filt: { f: 500 } }); },
        quicksand: () => { T(300, 60, "sine", 0, 1.2, 0.18, { vib: 8 }); N(500, 80, 0.2, 1, 0.14, { type: "lowpass" }); T(M(43), M(36), "triangle", 0.6, 0.6, 0.08); },
        check: () => { T(M(84), null, "sine", 0, 0.4, 0.05, { vib: 30, echo: 0.4 }); T(M(91), null, "sine", 0.15, 0.4, 0.04, { vib: 30, echo: 0.4 }); N(900, 1600, 0, 0.7, 0.06, { q: 6 }); },
        blind: () => { T(200, 70, "sine", 0, 0.25, 0.4); N(700, 150, 0, 0.5, 0.25, { type: "lowpass" }); T(500, 600, "triangle", 0.25, 0.2, 0.05, { vib: 40 }); },
        hypno: () => { for (let i = 0; i < 6; i++) T(i % 2 ? 660 : 440, null, "sine", i * 0.15, 0.2, 0.06, { vib: 15 }); T(M(48), null, "triangle", 0, 1.1, 0.05); },
        crash: () => { T(300, 1600, "sawtooth", 0, 0.5, 0.05, { filt: { f: 2000 } }); T(1600, 80, "sawtooth", 0.5, 0.8, 0.07, { filt: { f: 1200 } }); T(120, 40, "sine", 1.1, 0.4, 0.3); },
        chomp: () => { for (let i = 0; i < 8; i++) T(i % 2 ? 300 : 500, i % 2 ? 200 : 700, "square", i * 0.1, 0.08, 0.05); },
        cheat: () => { [76, 76, 72, 76, 79, 67].forEach((n, i) => T(M(n), null, "square", i * 0.08, 0.07, 0.04)); },
        extralife: () => { [72, 76, 79, 84, 79, 84, 88].forEach((n, i) => T(M(n), null, "square", i * 0.07, 0.08, 0.05)); T(M(96), null, "triangle", 0.5, 0.5, 0.05); },
        autofill: () => { for (let i = 0; i < 4; i++) { T(200, 600, "sawtooth", i * 0.12, 0.08, 0.04, { filt: { f: 1500 } }); T(1200, null, "triangle", i * 0.12 + 0.08, 0.04, 0.05); } T(M(84), null, "sine", 0.55, 0.3, 0.06); },
        overclock: () => { T(100, 2400, "sawtooth", 0, 0.9, 0.05, { filt: { f: 3000 }, crush: true }); for (let i = 0; i < 6; i++) T(2000, 3000, "square", 0.3 + i * 0.08, 0.03, 0.02); },
        firewall: () => { T(M(50), null, "square", 0, 0.5, 0.04, { filt: { f: 900 } }); T(M(57), null, "square", 0.08, 0.5, 0.04, { filt: { f: 900 } }); N(300, 900, 0, 0.8, 0.1, { q: 3 }); },
        calm: () => { T(1200, 600, "sine", 0, 0.9, 0.04, { echo: 0.5 }); N(4000, 1500, 0, 1, 0.1, { q: 0.4, type: "lowpass" }); },
        haunt: () => { T(400, 800, "sine", 0, 1.2, 0.08, { vib: 25, echo: 0.5 }); T(600, 300, "triangle", 0.3, 1, 0.04, { vib: 18, echo: 0.5 }); },
        ghost: () => { arp([62, 65, 69, 72], 0.14, "sine", 0.6, 0.05, { vib: 14, echo: 0.6 }); },
        hot: () => { N(200, 1500, 0, 0.8, 0.2, { type: "lowpass" }); T(110, 220, "sawtooth", 0, 0.8, 0.05, { filt: { f: 800 } }); T(M(76), null, "triangle", 0.5, 0.3, 0.06); },
        lavafloor: () => { T(70, 50, "sawtooth", 0, 1.4, 0.12, { filt: { f: 300 } }); N(150, 400, 0, 1.3, 0.25, { type: "lowpass" }); for (let i = 0; i < 4; i++) T(300, 900, "sine", 0.3 + i * 0.22, 0.08, 0.06); },
        fireup: () => { N(300, 3000, 0, 0.6, 0.18, { q: 0.6 }); arp([60, 67, 72, 79], 0.06, "sawtooth", 0.3, 0.03, { filt: { f: 2500 } }); },
        blackhole: () => { T(900, 40, "sine", 0, 1.6, 0.25); T(1800, 60, "triangle", 0, 1.4, 0.05, { echo: 0.4 }); N(2000, 60, 0, 1.4, 0.2, { type: "lowpass" }); },
        reverse: () => { [84, 81, 77, 74, 72, 69, 65].forEach((n, i) => T(M(n), M(n) * 0.97, "triangle", i * 0.07, 0.12, 0.06, { echo: 0.2 })); T(1200, 200, "sine", 0, 0.6, 0.04); },
        wormhole: () => { for (let i = 0; i < 4; i++) T(200 + i * 100, 1600 - i * 200, "sine", i * 0.15, 0.4, 0.05, { echo: 0.5 }); T(60, 30, "sine", 0.5, 0.8, 0.2); }
    };
    // every boss move's sound, when it lands on you (charge sounds are shared by kind of attack)
    const BSND = {
        rubout: () => { for (let i = 0; i < 3; i++) N(700 + i * 300, 300, i * 0.12, 0.3, 0.16, { q: 2 }); T(150, 70, "sine", 0.3, 0.3, 0.3); },
        crumple: () => { for (let i = 0; i < 6; i++) N(1500 + Math.random() * 1500, 600, i * 0.06, 0.3, 0.12, { q: 1.5 }); T(90, 50, "sine", 0.35, 0.3, 0.25); },
        thorns: () => { [0, 0.1, 0.2].forEach(t => T(1400, 300, "sawtooth", t, 0.12, 0.05, { filt: { f: 2000 } })); T(120, 60, "sine", 0.25, 0.4, 0.3); },
        petals: () => { N(800, 3000, 0, 1.2, 0.12, { q: 0.4 }); arp([79, 76, 72, 67], 0.12, "sine", 0.4, 0.05, { echo: 0.4 }); },
        hoot: () => { T(420, 380, "sine", 0, 0.28, 0.2, { vib: 10 }); T(420, 360, "sine", 0.35, 0.4, 0.2, { vib: 10 }); },
        acorns: () => { [0, 0.18].forEach(t => { T(1000, 500, "square", t, 0.05, 0.06); T(260, 120, "sine", t + 0.04, 0.2, 0.3); }); },
        sour: () => { T(300, 900, "sawtooth", 0, 0.3, 0.06, { filt: { f: 1500 } }); N(1500, 300, 0.1, 0.6, 0.2, { q: 1 }); T(180, 120, "square", 0.3, 0.3, 0.05, { filt: { f: 600 } }); },
        sticky: () => { T(200, 140, "sine", 0, 0.6, 0.2, { vib: 30 }); T(600, 300, "triangle", 0.4, 0.4, 0.06, { vib: 40 }); },
        ink: () => { N(600, 200, 0, 0.7, 0.3, { type: "lowpass" }); T(240, 80, "sine", 0, 0.5, 0.3); },
        whirl: () => { for (let i = 0; i < 5; i++) N(300 + i * 300, 1800 - i * 200, i * 0.12, 0.4, 0.1, { q: 3 }); T(150, 60, "sine", 0.4, 0.8, 0.2, { vib: 6 }); },
        freeze: () => { arp([91, 86, 84, 79], 0.04, "square", 0.25, 0.04); N(3000, 600, 0, 0.6, 0.15, { q: 2 }); T(100, 50, "sine", 0.1, 0.4, 0.3); },
        whiteout: () => { N(200, 1500, 0, 1.4, 0.22, { q: 0.4 }); N(1200, 300, 0.7, 1, 0.18, { q: 0.4 }); },
        lightning: () => { T(2000, 60, "sawtooth", 0, 0.3, 0.12, { crush: true }); N(2000, 80, 0.05, 1.3, 0.4, { type: "lowpass" }); },
        downpour: () => { N(1200, 900, 0, 1.6, 0.18, { q: 0.4 }); N(400, 300, 0, 1.6, 0.14, { type: "lowpass" }); [0.2, 0.5, 0.9, 1.2].forEach(t => T(1500, 2500, "sine", t, 0.05, 0.03)); },
        gale: () => { N(150, 1200, 0, 0.8, 0.22, { q: 0.6 }); N(1200, 200, 0.6, 0.8, 0.18, { q: 0.6 }); },
        twister: () => { for (let i = 0; i < 4; i++) N(400, 2000, i * 0.25, 0.3, 0.12, { q: 2 }); T(200, 400, "sine", 0, 1, 0.1, { vib: 20 }); },
        riddle: () => { T(M(62), null, "triangle", 0, 0.3, 0.08); T(M(66), null, "triangle", 0.2, 0.3, 0.08); T(M(61), null, "triangle", 0.4, 0.5, 0.08, { vib: 8 }); },
        sandblast: () => { N(900, 2500, 0, 1, 0.24, { q: 0.5 }); T(110, 60, "sine", 0, 0.5, 0.25); },
        mirror: () => { T(M(84), M(72), "sine", 0, 0.5, 0.08, { echo: 0.5 }); T(M(72), M(84), "sine", 0, 0.5, 0.08, { echo: 0.5 }); },
        confetti: () => { T(100, 50, "sine", 0, 0.3, 0.4); N(500, 3000, 0, 0.5, 0.2, { q: 0.6 }); arp([79, 84, 88], 0.08, "square", 0.1, 0.03); },
        glitch: () => { for (let i = 0; i < 7; i++) T(200 + Math.random() * 1200, null, "square", i * 0.05, 0.05, 0.05, { crush: true }); },
        lag: () => { [76, 74, 72, 69].forEach((n, i) => T(M(n), M(n) * 0.9, "square", i * 0.14, 0.12, 0.04)); T(400, 100, "sawtooth", 0.5, 0.4, 0.04, { filt: { f: 800 } }); },
        lock: () => { T(M(45), null, "square", 0, 0.12, 0.08, { filt: { f: 900 } }); T(M(45), null, "square", 0.18, 0.12, 0.08, { filt: { f: 900 } }); T(80, 40, "sine", 0.3, 0.3, 0.3); },
        static: () => { N(2500, 2400, 0, 1.2, 0.12, { q: 0.3 }); T(60, 60, "sawtooth", 0, 1.2, 0.04, { filt: { f: 300 } }); },
        haunting: () => { T(300, 600, "sine", 0, 1.4, 0.07, { vib: 30, echo: 0.6 }); T(310, 200, "sine", 0.4, 1.2, 0.05, { vib: 25, echo: 0.6 }); },
        lights: () => { T(M(48), M(36), "sine", 0, 0.6, 0.2); T(1600, 400, "triangle", 0, 0.15, 0.06); },
        eruption: () => { T(60, 30, "sawtooth", 0, 1.3, 0.2, { filt: { f: 250 } }); N(300, 60, 0, 1.4, 0.4, { type: "lowpass" }); },
        heatwave: () => { N(200, 2500, 0, 1.2, 0.2, { type: "lowpass" }); T(200, 260, "sawtooth", 0, 1, 0.03, { vib: 12, filt: { f: 700 } }); },
        gravity: () => { T(500, 40, "sine", 0, 1.2, 0.3); T(250, 30, "triangle", 0.1, 1, 0.08); },
        flare: () => { T(400, 3000, "sine", 0, 0.5, 0.06); N(500, 4000, 0, 0.8, 0.2, { q: 0.4 }); T(3000, 300, "triangle", 0.5, 0.8, 0.04, { echo: 0.5 }); },
        collapse: () => { T(200, 30, "sawtooth", 0, 1.1, 0.12, { filt: { f: 400 } }); for (let i = 0; i < 5; i++) T(900 - i * 120, 300, "square", 0.2 + i * 0.12, 0.06, 0.04); },
        // the moves added when every boss got 5 (2026-10-09)
        inkblot: () => { N(400, 120, 0, 0.6, 0.3, { type: "lowpass" }); T(180, 60, "sine", 0, 0.4, 0.3); T(900, 300, "triangle", 0.15, 0.2, 0.05); },
        nobackspace: () => { T(1200, 1100, "sawtooth", 0, 0.5, 0.03, { filt: { f: 2000 } }); N(2500, 1800, 0, 0.6, 0.08, { q: 4 }); T(300, 200, "square", 0.5, 0.2, 0.05); },
        fakecheck: () => { T(M(76), M(74), "square", 0, 0.1, 0.05); T(M(70), M(68), "square", 0.12, 0.2, 0.05); N(1800, 900, 0.1, 0.4, 0.1, { q: 3 }); },
        minion: () => { for (let i = 0; i < 6; i++) T(500 + Math.random() * 400, 300, "square", i * 0.07, 0.05, 0.04); T(160, 120, "sine", 0.4, 0.3, 0.2); },
        drain: () => { T(1200, 80, "sawtooth", 0, 1, 0.06, { filt: { f: 1500 } }); N(1500, 100, 0, 1, 0.12, { q: 1 }); },
        seal: () => { for (let i = 0; i < 4; i++) N(300 + i * 100, 900, i * 0.1, 0.3, 0.1, { q: 2 }); T(M(40), null, "triangle", 0.4, 0.5, 0.15); },
        darkcreep: () => { T(M(45), M(33), "sine", 0, 1.6, 0.18, { vib: 3 }); T(M(52), M(40), "triangle", 0.2, 1.4, 0.05, { echo: 0.4 }); },
        ambush: () => { N(500, 3000, 0, 0.3, 0.15, { q: 1 }); T(90, 50, "sine", 0.25, 0.3, 0.35); },
        steal: () => { T(900, 1500, "triangle", 0, 0.1, 0.08); T(1500, 600, "triangle", 0.1, 0.2, 0.06); N(1200, 3000, 0.1, 0.3, 0.1, { q: 2 }); },
        jitter: () => { for (let i = 0; i < 10; i++) T(800 + (i % 2) * 400, null, "square", i * 0.05, 0.04, 0.03); },
        bubble: () => { T(200, 700, "sine", 0, 0.5, 0.15, { vib: 10 }); T(600, 800, "sine", 0.4, 0.3, 0.08, { vib: 25 }); },
        fumble: () => { T(700, 200, "sine", 0, 0.3, 0.15, { vib: 40 }); T(400, 900, "triangle", 0.25, 0.2, 0.05); },
        tidal: () => { N(150, 1500, 0, 0.8, 0.25, { q: 0.5 }); N(1500, 150, 0.6, 1, 0.22, { q: 0.5 }); },
        backwards: () => { [79, 76, 72, 67].forEach((n, i) => T(M(n), M(n) * 0.95, "triangle", i * 0.09, 0.12, 0.06)); N(500, 1500, 0, 0.5, 0.1, { q: 1 }); },
        shrink: () => { T(800, 200, "sine", 0, 0.7, 0.1); T(600, 150, "triangle", 0.1, 0.6, 0.05); N(300, 120, 0, 0.6, 0.15, { type: "lowpass" }); },
        avalanche: () => { N(120, 400, 0, 1.6, 0.35, { type: "lowpass" }); T(55, 40, "sine", 0, 1.4, 0.35); },
        slowmo: () => { T(400, 100, "sine", 0, 1.2, 0.12, { vib: 2 }); T(300, 75, "triangle", 0.1, 1.1, 0.05); },
        shatter: () => { for (let i = 0; i < 6; i++) T(2000 + Math.random() * 1500, 1200, "triangle", i * 0.04, 0.12, 0.04); N(3000, 900, 0, 0.5, 0.12, { q: 3 }); },
        halffog: () => { N(200, 800, 0, 1.2, 0.2, { q: 0.6 }); T(110, 90, "sine", 0, 1, 0.15, { vib: 4 }); },
        quake: () => { T(45, 35, "sawtooth", 0, 1.2, 0.2, { filt: { f: 200 } }); N(200, 80, 0, 1.2, 0.3, { type: "lowpass" }); },
        ward: () => { T(500, 800, "triangle", 0, 0.15, 0.08); N(1200, 2400, 0, 0.4, 0.1, { q: 2 }); T(M(84), null, "sine", 0.15, 0.4, 0.04); },
        upside: () => { for (let i = 0; i < 8; i++) T(400 + i * 120, null, "sine", i * 0.05, 0.08, 0.05); for (let i = 0; i < 8; i++) T(1400 - i * 120, null, "sine", 0.4 + i * 0.05, 0.08, 0.05); },
        flicker: () => { N(400, 900, 0, 1, 0.12, { q: 0.5 }); T(M(72), null, "sine", 0.2, 0.6, 0.03, { echo: 0.5 }); },
        haste: () => { T(200, 2000, "sawtooth", 0, 0.5, 0.05, { filt: { f: 2500 } }); N(400, 4000, 0, 0.5, 0.15, { q: 0.8 }); },
        mirageclue: () => { T(M(84), M(86), "sine", 0, 0.8, 0.05, { vib: 20, echo: 0.5 }); T(M(79), M(77), "sine", 0.2, 0.8, 0.04, { vib: 20, echo: 0.5 }); },
        shift: () => { N(500, 1200, 0, 0.6, 0.18, { q: 0.8 }); T(200, 300, "triangle", 0, 0.5, 0.08); },
        curse: () => { T(M(62), M(61), "sawtooth", 0, 0.4, 0.05, { filt: { f: 1200 } }); T(M(68), M(67), "sawtooth", 0.3, 0.6, 0.05, { filt: { f: 1200 } }); },
        clueswap: () => { for (let i = 0; i < 6; i++) T(i % 2 ? 900 : 600, null, "triangle", i * 0.08, 0.06, 0.05); },
        bomb: () => { T(300, 100, "sine", 0, 0.3, 0.3); for (let i = 0; i < 4; i++) T(1500, null, "square", 0.3 + i * 0.25, 0.03, 0.04); },
        taunt: () => { [60, 64, 67, 72].forEach((n, i) => T(M(n), null, "square", i * 0.1, 0.12, 0.05)); T(M(84), null, "triangle", 0.45, 0.4, 0.06); },
        comboban: () => { T(400, 120, "square", 0, 0.3, 0.08, { crush: true }); T(300, 90, "square", 0.25, 0.3, 0.08, { crush: true }); },
        echo: () => { for (let i = 0; i < 4; i++) T(M(76), null, "square", i * 0.15, 0.08, 0.06 * (1 - i * 0.2), { echo: 0.4 }); },
        mask: () => { for (let i = 0; i < 8; i++) T(200 + Math.random() * 2000, null, "square", i * 0.04, 0.04, 0.04, { crush: true }); },
        unlock: () => { T(M(48), M(60), "square", 0, 0.4, 0.06, { filt: { f: 1200 } }); T(1500, 800, "triangle", 0.4, 0.15, 0.06); T(1500, 800, "triangle", 0.55, 0.15, 0.06); },
        itemlock: () => { T(M(43), null, "square", 0, 0.3, 0.06, { filt: { f: 800 } }); N(200, 900, 0, 0.6, 0.15, { q: 2 }); },
        numberless: () => { for (let i = 0; i < 10; i++) T(i % 2 ? 1800 : 900, null, "square", i * 0.04, 0.03, 0.03); N(1500, 300, 0.2, 0.5, 0.1, { q: 2 }); },
        fakeclue: () => { T(300, 200, "sine", 0, 1, 0.08, { vib: 20, echo: 0.5 }); T(M(73), M(70), "triangle", 0.3, 0.6, 0.05, { echo: 0.5 }); },
        wordthief: () => { N(300, 2000, 0, 0.4, 0.2, { q: 1 }); T(220, 90, "sine", 0.3, 0.3, 0.3); T(1200, 500, "triangle", 0.4, 0.3, 0.05); },
        oneword: () => { for (let i = 0; i < 3; i++) N(2500, 900, i * 0.12, 0.3, 0.15, { q: 2 }); },
        powerup: () => { T(80, 300, "sawtooth", 0, 1.2, 0.08, { filt: { f: 600 } }); N(100, 800, 0, 1.2, 0.2, { type: "lowpass" }); },
        heal: () => { N(200, 1800, 0, 0.8, 0.2, { type: "lowpass" }); arp([60, 63, 67], 0.1, "sawtooth", 0.3, 0.03, { filt: { f: 1500 } }); },
        toll: () => { T(M(48), null, "triangle", 0, 1.2, 0.12, { echo: 0.4 }); T(M(55), null, "triangle", 0, 1.2, 0.06, { echo: 0.4 }); },
        snapfinish: () => { T(100, 3000, "sawtooth", 0, 0.4, 0.06, { filt: { f: 3000 } }); T(3000, 200, "sine", 0.4, 0.4, 0.06, { echo: 0.5 }); },
        vowels: () => { T(600, 50, "sine", 0, 1.4, 0.25); N(2500, 80, 0, 1.3, 0.2, { type: "lowpass" }); },
    };
    // recorded sounds (CC0, Kenney.nl, see audio/CREDITS.txt) layered under the synthesized ones: [file, speed]
    const SMP = { junk: ["ink"], erase: ["scratch"], shield: ["field"], stutter: ["pluck"], vines: ["creak"], sun: ["confirm"], knock: ["plank"], bury: ["grass"],
        hint: ["glass"], slow: ["goo"], super: ["laser"], reflect: ["bong"], cleanse: ["drop"], bubble: ["bubble"], undo: ["rewind"], freeze: ["ice"],
        delay: ["snowstep"], armor: ["iceheavy"], wash: ["splash"], counter: ["rumble"], lucky: ["lucky"], scatter: ["cloth"], silver: ["chime"], time: ["rise"],
        sand: ["sand"], quicksand: ["goo", 0.7], check: ["question"], blind: ["punch"], hypno: ["pluck2"], crash: ["crunch"], chomp: ["retro"], cheat: ["retro2"],
        extralife: ["jingle-life"], autofill: ["click"], overclock: ["zap"], firewall: ["field2"], calm: ["back"], haunt: ["creak2"], ghost: ["page"], hot: ["thruster"],
        lavafloor: ["rumble2"], fireup: ["thruster2"], blackhole: ["engine"], reverse: ["rewind2"], wormhole: ["warp"] };
    const BSMP = { rubout: ["scratch2"], crumple: ["page2"], thorns: ["knife"], petals: ["cloth4"], acorns: ["plank2"], sour: ["goo", 1.3], sticky: ["goo", 0.6],
        ink: ["punch2"], whirl: ["drop3"], freeze: ["ice2"], whiteout: ["snowstep2"], lightning: ["crunch2"], downpour: ["splash", 0.8], gale: ["sand", 1.3], twister: ["switch"],
        riddle: ["question2"], sandblast: ["step"], mirror: ["glass4"], confetti: ["punch", 1.4], glitch: ["glitch"], lag: ["glitch2"], lock: ["latch"], static: ["noise"],
        haunting: ["creak3"], lights: ["door"], eruption: ["crunch4"], heatwave: ["thruster4"], gravity: ["engine2"], flare: ["laser3"], collapse: ["metal"],
        inkblot: ["ink"], nobackspace: ["scratch"], fakecheck: ["question2"], minion: ["goo", 1.6], drain: ["rewind2", 0.8], seal: ["creak"], darkcreep: ["engine", 0.7],
        ambush: ["punch2"], steal: ["coin"], jitter: ["glitch2", 1.3], bubble: ["bubble", 0.8], fumble: ["goo", 1.1], tidal: ["splash", 0.7], backwards: ["rewind"],
        shrink: ["engine2", 1.3], avalanche: ["rumble"], slowmo: ["ice", 0.6], shatter: ["iceheavy"], halffog: ["splash"], quake: ["rumble2"], ward: ["field"],
        upside: ["rise"], flicker: ["chime", 0.8], haste: ["thruster2", 1.3], mirageclue: ["chime"], shift: ["sand"], curse: ["knife", 0.8], clueswap: ["switch"],
        bomb: ["latch"], taunt: ["bell", 1.2], comboban: ["glitch"], echo: ["retro2", 0.8], mask: ["noise"], unlock: ["click"], itemlock: ["field2", 0.8],
        numberless: ["noise", 1.3], fakeclue: ["creak2", 0.8], wordthief: ["punch"], oneword: ["page"], powerup: ["thruster", 0.6], heal: ["thruster4", 1.2],
        toll: ["bell", 0.7], snapfinish: ["warp", 1.4], vowels: ["engine", 0.5] };
    const smp = ([name, rate = 1] = [], v = 0.55) => name && Sound.sample(name, { v, rate });
    // every recorded sound a fight can use, so they're loaded before they're needed
    const ALL_SAMPLES = [...new Set([...Object.values(SMP), ...Object.values(BSMP)].map(x => x[0]).concat(["hit", "bell", "ko", "jingle-block", "jingle-win", "coin"]))];

    // a boss winding up: a rising alarm, pitched to the boss's world
    const charge = (pitch = 0) => { for (let i = 0; i < 3; i++) T(M(57 + pitch + i * 4), M(60 + pitch + i * 4), "sawtooth", i * 0.18, 0.15, 0.04, { filt: { f: 1600 } }); T(M(45 + pitch), M(57 + pitch), "triangle", 0, 0.6, 0.08); };

    // ---------------------------------------------------------------------------------------------
    // The abilities: world, id, name, icon, kind, flavor (in the world's words), what it does, and how it looks:
    //   proj: what flies over (an emoji) and how (arc, line, spiral, drop from above, rise, zigzag, none)
    //   aura: emojis that swarm the target, and how they move (fall, swirl, rise, pop, orbit, drift, spark)
    //   on:   "boss" (it hits the boss's board) or "me" (it helps you, on your board)
    // ---------------------------------------------------------------------------------------------
    const A = (world, id, name, icon, kind, flavor, desc, fx) => ({ id: world + "-" + id, world, name, icon, kind, flavor, desc, fx, sound: SND[kind] });
    const ABILITIES = [
        A("paper", "ink", "Ink Splat", "🖋️", "junk", "Flick a fat blot of ink onto the boss's page.", "The boss's next 5 letters come out as ink blots. It has to rub each one out and write it again.",
            { proj: "🖋️", path: "arc", aura: ["⚫", "💧"], motion: "pop", color: "#2b2233", on: "boss" }),
        A("paper", "rub", "Eraser Rub", "🩹", "erase", "Rub out the last word the boss wrote.", "Wipes the boss's last finished word.",
            { proj: "🩹", path: "zig", aura: ["✨", "〰️"], motion: "drift", color: "#ff9fb2", on: "boss" }),
        A("paper", "wall", "Paper Wall", "📄", "shield", "Fold a wall of paper in front of your board.", "Blocks the boss's next attack completely.",
            { proj: null, aura: ["📄", "📃"], motion: "orbit", color: "#ffffff", on: "me" }),
        A("garden", "pollen", "Pollen Puff", "🌼", "stutter", "A sneezy cloud of pollen in the boss's face.", "For 15s the boss keeps sneezing: it stops for a moment every 3 seconds.",
            { proj: "🌼", path: "spiral", aura: ["🌼", "🟡", "✨"], motion: "swirl", color: "#ffd23f", on: "boss" }),
        A("garden", "vine", "Vine Snare", "🌿", "vines", "Vines grow over the boss's board.", "Vines cover 4 empty squares on the boss's board for 20s. It can't write any word through them.",
            { proj: "🌱", path: "line", aura: ["🌿", "🍃"], motion: "rise", color: "#3fbf6b", on: "boss" }),
        A("garden", "sun", "Sunny Hour", "☀️", "sun", "Sunshine makes everything grow.", "For 30s, every word you finish grows a right letter somewhere else on your board.",
            { proj: null, aura: ["☀️", "✨", "🌟"], motion: "rise", color: "#ffb21e", on: "me" }),
        A("squirrel", "acorn", "Acorn Toss", "🌰", "knock", "Bonk! A hard acorn to the boss's board.", "Knocks 3 random letters off the boss's board.",
            { proj: "🌰", path: "arc", aura: ["🌰", "💫"], motion: "pop", color: "#a0652c", on: "boss" }),
        A("squirrel", "leaves", "Leaf Pile", "🍂", "bury", "Bury the boss's clues under a heap of leaves.", "The boss's next 3 words each start with a 4-second dig to find the clue.",
            { proj: "🍂", path: "drop", aura: ["🍂", "🍁"], motion: "fall", color: "#e07a2e", on: "boss" }),
        A("squirrel", "stash", "Stash Peek", "🐿️", "hint", "Peek into the squirrels' secret stash.", "2 right letters appear in random squares of your puzzle.",
            { proj: null, aura: ["🌰", "✨"], motion: "pop", color: "#c98a4b", on: "me" }),
        A("candy", "taffy", "Sticky Taffy", "🍬", "slow", "Gooey taffy all over the boss's pencil.", "The boss writes at a third of its speed for 10s.",
            { proj: "🍬", path: "arc", aura: ["🍬", "🩷"], motion: "drift", color: "#ff6fb5", on: "boss" }),
        A("candy", "rush", "Sugar Rush", "🍭", "super", "Sugar-coated hints.", "The first letter of 3 of your unfinished words appears, locked in.",
            { proj: null, aura: ["🍭", "⚡", "✨"], motion: "spark", color: "#ff5fa2", on: "me" }),
        A("candy", "gumdrop", "Gumdrop Bounce", "🧁", "reflect", "A bouncy gumdrop that sends things straight back.", "The boss's next attack bounces back at it: the boss is frozen instead of you.",
            { proj: null, aura: ["🧁", "🟣"], motion: "orbit", color: "#b46cff", on: "me" }),
        A("ocean", "clear", "Clear Water", "💧", "cleanse", "A splash of clean sea water.", "Washes off everything the boss is doing to you right now.",
            { proj: null, aura: ["💧", "🫧"], motion: "rise", color: "#3fb8e0", on: "me" }),
        A("ocean", "bubble", "Bubble Trap", "🫧", "bubble", "Trap the boss in a big floating bubble.", "The boss can't write until you finish your next word (up to 15s).",
            { proj: "🫧", path: "rise", aura: ["🫧", "○"], motion: "rise", color: "#8fe3ff", on: "boss" }),
        A("ocean", "tide", "Tide Pull", "🌊", "undo", "The tide pulls back everything that washed in last.", "Takes back the last 6 letters the boss wrote, newest first.",
            { proj: "🌊", path: "line", aura: ["🌊", "💦"], motion: "drift", color: "#2a8fd6", on: "boss" }),
        A("snow", "snowball", "Snowball", "⛄", "freeze", "A snowball, right in the face.", "Freezes the boss solid for 6s.",
            { proj: "⚪", path: "arc", aura: ["❄️", "✳️"], motion: "pop", color: "#9fd8ff", on: "boss" }),
        A("snow", "blizzard", "Blizzard", "🌨️", "delay", "A storm so thick the boss can't get ready.", "Pushes the boss's next attack 30s further away.",
            { proj: null, aura: ["🌨️", "❄️"], motion: "fall", color: "#cfe9ff", on: "boss" }),
        A("snow", "armor", "Frost Armor", "🧊", "armor", "A thin coat of ice over your whole board.", "For 40s the boss's attacks last half as long, and erasing attacks take fewer letters.",
            { proj: null, aura: ["🧊", "❄️"], motion: "orbit", color: "#7cc7ff", on: "me" }),
        A("rain", "puddle", "Puddle Splash", "💦", "wash", "Soak the boss's paper.", "Washes away every letter in the boss's unfinished words. Finished words stay.",
            { proj: "💦", path: "drop", aura: ["💦", "💧"], motion: "fall", color: "#4d8fd6", on: "boss" }),
        A("rain", "thunder", "Thunderclap", "⚡", "counter", "A crack of thunder at exactly the right moment.", "Cancels an attack that's winding up and stuns the boss for 4s (2s if nothing was coming).",
            { proj: "⚡", path: "drop", aura: ["⚡", "💥"], motion: "spark", color: "#ffe066", on: "boss" }),
        A("rain", "rainbow", "Lucky Rainbow", "🌈", "lucky", "Something lucky waits at the end of the rainbow.", "Your combo jumps up by 2 and can't run out for 30s.",
            { proj: null, aura: ["🌈", "🍀", "✨"], motion: "rise", color: "#ff7b9c", on: "me" }),
        A("sky", "gust", "Gust", "🌬️", "scatter", "A sharp gust across the boss's board.", "Blows one letter out of each word the boss has finished (up to 6).",
            { proj: "🌬️", path: "line", aura: ["💨", "🍃"], motion: "drift", color: "#bfe4ff", on: "boss" }),
        A("sky", "cloud", "Silver Lining", "☁️", "silver", "Every cloud has a silver lining.", "For 40s, each attack that hits you gives you a right letter.",
            { proj: null, aura: ["☁️", "🥈"], motion: "orbit", color: "#d9e2ef", on: "me" }),
        A("sky", "tailwind", "Tailwind", "🪁", "time", "The wind at your back holds your letters in place.", "For 30s, every right letter you type locks in place: the boss's attacks can't erase it.",
            { proj: null, aura: ["🪁", "💨"], motion: "rise", color: "#76c7ff", on: "me" }),
        A("desert", "sandstorm", "Sandstorm", "🏜️", "sand", "Sand blows across the boss's page.", "For 12s, half of the letters the boss writes are blown away as soon as it writes them.",
            { proj: null, aura: ["🟫", "🟤", "💨"], motion: "drift", color: "#d9a35c", on: "boss" }),
        A("desert", "quicksand", "Quicksand", "⏳", "quicksand", "The more it struggles, the deeper it sinks.", "For 20s, every letter the boss writes makes its next one slower.",
            { proj: "⏳", path: "drop", aura: ["⏳", "🟤"], motion: "fall", color: "#b9823e", on: "boss" }),
        A("desert", "mirage", "Truth Mirage", "🪞", "check", "In the shimmer, the wrong answers show themselves.", "Your wrong letters glow red, without the Check penalty.",
            { proj: null, aura: ["🪞", "✨"], motion: "pop", color: "#ffcf7a", on: "me" }),
        A("carnival", "pie", "Pie in the Face", "🥧", "blind", "Splat! A cream pie, right in the face.", "The boss can't see for 8s and loses the word it was writing.",
            { proj: "🥧", path: "arc", aura: ["⚪", "🤍"], motion: "pop", color: "#fff3d6", on: "boss" }),
        A("carnival", "juggle", "Juggling Act", "🤹", "hypno", "The boss can't take its eyes off your juggling.", "For 20s the boss stops writing whenever you type.",
            { proj: null, aura: ["🔴", "🔵", "🟡"], motion: "orbit", color: "#ff4d6d", on: "boss" }),
        A("carnival", "cotton", "Sugar Crash", "🍡", "crash", "Give the boss a giant cotton candy, and wait.", "The boss goes twice as fast for 3s, then crashes and can't write for 12s.",
            { proj: "🍡", path: "arc", aura: ["🍡", "💤"], motion: "rise", color: "#ff9ed2", on: "boss" }),
        A("arcade", "chomp", "Chomper", "👾", "chomp", "Release a hungry little pixel monster.", "It chomps along the boss's board in a zigzag, eating up to 8 letters.",
            { proj: "👾", path: "line", aura: ["🟨", "🟦"], motion: "pop", color: "#ffd23f", on: "boss" }),
        A("arcade", "cheat", "Cheat Code", "🎮", "cheat", "Up, up, down, down, left, right...", "Flashes the answer to your selected word for 2.5 seconds. Remember it!",
            { proj: null, aura: ["🎮", "⭐"], motion: "spark", color: "#5ce1e6", on: "me" }),
        A("arcade", "extralife", "Extra Life", "🕹️", "extralife", "1-UP! Saved for when you need it most.", "If the boss finishes first, you come back once: it loses its last 3 words and the race goes on.",
            { proj: null, aura: ["💚", "🕹️"], motion: "rise", color: "#4fdf6b", on: "me" }),
        A("robot", "autofill", "Auto-Fill", "🦾", "autofill", "A robot arm finishes the job.", "Fills in the last missing letter of every word that's one letter from done (up to 4).",
            { proj: null, aura: ["🔩", "⚙️"], motion: "spark", color: "#9aa7b8", on: "me" }),
        A("robot", "overclock", "Overclock", "⚡", "overclock", "Push your circuits past their limit.", "For 15s, every right letter you type also knocks a letter off the boss's board (up to 5).",
            { proj: null, aura: ["⚡", "🔋"], motion: "spark", color: "#38e0ff", on: "me" }),
        A("robot", "firewall", "Firewall", "🧱", "firewall", "A wall of code the boss's attacks have to break through.", "For 30s the boss's attacks take twice as long to wind up, so they're easier to block.",
            { proj: null, aura: ["🧱", "🔥"], motion: "orbit", color: "#ff7a3d", on: "me" }),
        A("library", "shush", "Shush!", "🤫", "calm", "SHHH! This is a library.", "Calms the boss down: it stops being enraged (and can't get angry) for 30s.",
            { proj: "🤫", path: "line", aura: ["💤", "🤫"], motion: "drift", color: "#b9a6e8", on: "boss" }),
        A("library", "haunt", "Haunted Page", "👻", "haunt", "A ghost hides in the boss's next page.", "The next word the boss finishes vanishes as soon as it's done.",
            { proj: "👻", path: "spiral", aura: ["👻", "🕯️"], motion: "drift", color: "#cfc6ff", on: "boss" }),
        A("library", "ghostwriter", "Ghost Writer", "🖊️", "ghost", "A ghost copies the boss's homework for you.", "For 12s, every letter the boss writes, a right letter appears in your puzzle too (up to 6).",
            { proj: null, aura: ["👻", "🖊️"], motion: "swirl", color: "#a99bff", on: "both" }),
        A("volcano", "hot", "Hot Streak", "🔥", "hot", "You're on fire. Literally.", "For 20s, every word you finish stuns the boss for 2s.",
            { proj: null, aura: ["🔥", "✨"], motion: "rise", color: "#ff5a1f", on: "me" }),
        A("volcano", "lava", "Lava Floor", "🌋", "lavafloor", "The floor is lava, and the boss is standing on it.", "For 15s, every word the boss finishes loses its first letter to the lava.",
            { proj: null, aura: ["🔥", "🟧"], motion: "rise", color: "#ff3d00", on: "boss" }),
        A("volcano", "fireup", "Fire Up", "🧨", "fireup", "Hot enough to burn your mistakes.", "For 20s, any wrong letter you type burns away at once, so you know straight away.",
            { proj: null, aura: ["🧨", "💥"], motion: "spark", color: "#ff9f1c", on: "me" }),
        A("space", "blackhole", "Black Hole", "🕳️", "blackhole", "A tiny black hole opens in the middle of the boss's board.", "Swallows every letter in the middle of the boss's board (the center 3×3).",
            { proj: "🕳️", path: "spiral", aura: ["✦", "·"], motion: "swirl", color: "#6b4dff", on: "boss" }),
        A("space", "reverse", "Time Reversal", "⏪", "reverse", "Turn the boss's clock backwards.", "For 10s the boss un-writes instead: it erases one of its own letters every second.",
            { proj: null, aura: ["⏪", "🌀"], motion: "swirl", color: "#58d6ff", on: "boss" }),
        A("space", "wormhole", "Wormhole", "🌀", "wormhole", "Open a wormhole right under the boss's pencil.", "Everything the boss writes in the next 10s falls into the wormhole when it closes.",
            { proj: "🌀", path: "spiral", aura: ["🌀", "✨"], motion: "swirl", color: "#c06bff", on: "boss" })
    ];

    // ---------------------------------------------------------------------------------------------
    // The bosses' moves: what they do to you. d = how long it lasts (seconds) or how strong it is.
    // ---------------------------------------------------------------------------------------------
    const B = (name, icon, kind, d, desc, fx) => ({ name, icon, kind, d, desc, fx, sound: BSND[kind] });
    const MOVES = {
        paper: [B("Rub Out", "🧽", "rubout", 3, "erases 3 of your letters", { proj: "🧽", aura: ["〰️", "✨"], motion: "drift" }),
            B("Crumple", "🗞️", "crumple", 8, "crumples your board: some squares vanish into the folds", { proj: "🗞️", aura: ["📃", "〰️"], motion: "pop" }),
            B("Ink Blot", "🖋️", "inkblot", 8, "drops a huge ink blot over the middle of your board", { proj: "⚫", aura: ["⚫", "💧"], motion: "pop" }),
            B("Permanent Marker", "🖊️", "nobackspace", 10, "takes away Backspace: no erasing your mistakes", { proj: "🖊️", aura: ["✒️", "〰️"], motion: "drift" }),
            B("Red Pen", "🖍️", "fakecheck", 12, "marks some of your RIGHT letters as wrong, to trick you", { proj: "🖍️", aura: ["❌", "✏️"], motion: "pop" })],
        garden: [B("Thorn Tangle", "🌹", "thorns", 10, "thorns block 3 of your empty squares", { proj: "🌹", aura: ["🌵", "🥀"], motion: "rise" }),
            B("Petal Storm", "🌸", "petals", 8, "petals bury your clue list", { proj: "🌸", aura: ["🌸", "🌺"], motion: "fall" }),
            B("Aphid Swarm", "🐛", "minion", 16, "sends an aphid that eats your letters until you click it", { proj: "🐛", aura: ["🐛", "🍃"], motion: "drift" }),
            B("Wilt", "🥀", "drain", 8, "wilts your board grey: you can't see which word you're on, and your combo ends", { proj: "🥀", aura: ["🍂", "💧"], motion: "fall" }),
            B("Weed Wrap", "🌿", "seal", 12, "wraps your abilities in weeds: you can't use them", { proj: "🌿", aura: ["🌿", "🌱"], motion: "rise" })],
        squirrel: [B("Hoot Hoot", "🦉", "hoot", 8, "jumbles the words in your clues", { proj: "🦉", aura: ["❓", "🌀"], motion: "swirl" }),
            B("Acorn Drop", "🌰", "acorns", 2, "knocks your letters into the wrong squares", { proj: "🌰", aura: ["🌰", "💫"], motion: "fall" }),
            B("Nightfall", "🌑", "darkcreep", 10, "night creeps over your board until it's pitch black", { proj: "🌑", aura: ["🌙", "✨"], motion: "drift" }),
            B("Silent Wings", "🪶", "ambush", 1, "its next attack comes with no warning", { proj: "🪶", aura: ["🪶", "💨"], motion: "drift" }),
            B("Stash Raid", "🐿️", "steal", 1, "steals one use of one of your abilities", { proj: "🐿️", aura: ["🌰", "💨"], motion: "pop" })],
        candy: [B("Sour Splash", "🍋", "sour", 6, "your letters turn invisible", { proj: "🍋", aura: ["🟢", "💦"], motion: "pop" }),
            B("Sticky Floor", "🍯", "sticky", 10, "your cursor sticks: it won't move on by itself", { proj: "🍯", aura: ["🍯", "🟤"], motion: "drift" }),
            B("Sugar Rush", "🍭", "jitter", 9, "shakes your board like it ate too much sugar", { proj: "🍭", aura: ["⚡", "🍬"], motion: "spark" }),
            B("Gum Bubble", "🫧", "bubble", 14, "seals your word in gum: click it 3 times to pop it", { proj: "🫧", aura: ["🩷", "🫧"], motion: "rise" }),
            B("Butterfingers", "🧈", "fumble", 9, "slippery fingers: some letters you type come out wrong", { proj: "🧈", aura: ["🧈", "💦"], motion: "drift" })],
        ocean: [B("Ink Jet", "🦑", "ink", 6, "blurs your whole board", { proj: "🦑", aura: ["⚫", "🫧"], motion: "pop" }),
            B("Whirlpool", "🌀", "whirl", 8, "spins your board around", { proj: "🌀", aura: ["🌊", "🫧"], motion: "swirl" }),
            B("Tidal Wave", "🌊", "tidal", 8, "a wave washes your board half off the screen", { proj: "🌊", aura: ["🌊", "💦"], motion: "drift" }),
            B("Riptide", "↩️", "backwards", 10, "pulls your cursor backwards after every letter", { proj: "🐚", aura: ["↩️", "🌊"], motion: "swirl" }),
            B("Deep Pressure", "🐙", "shrink", 9, "the pressure squeezes your board tiny", { proj: "🐙", aura: ["🫧", "⚫"], motion: "pop" })],
        snow: [B("Deep Freeze", "🥶", "freeze", 4, "freezes your keyboard", { proj: "❄️", aura: ["❄️", "🧊"], motion: "pop" }),
            B("Whiteout", "🌨️", "whiteout", 8, "snow piles up on half your squares", { proj: "🌨️", aura: ["❄️", "⚪"], motion: "fall" }),
            B("Avalanche", "🏔️", "avalanche", 10, "snow buries your board, more squares every second", { proj: "🏔️", aura: ["⚪", "❄️"], motion: "fall" }),
            B("Numb Fingers", "🧤", "slowmo", 9, "cold hands: you can only type one letter at a time, slowly", { proj: "🧤", aura: ["❄️", "🥶"], motion: "drift" }),
            B("Ice Crack", "🧊", "shatter", 9, "your board cracks into sliding pieces", { proj: "🧊", aura: ["🧊", "✳️"], motion: "spark" })],
        rain: [B("Lightning", "⚡", "lightning", 1, "strikes one of your words, wiping it", { proj: "⚡", aura: ["⚡", "💥"], motion: "spark" }),
            B("Downpour", "🌧️", "downpour", 8, "makes your letters run: each one you type washes away after 4s unless its word is finished", { proj: "🌧️", aura: ["💧", "💧"], motion: "fall" }),
            B("Flash Flood", "🌊", "halffog", 9, "floods the bottom half of your board", { proj: "🌊", aura: ["💧", "🌊"], motion: "rise" }),
            B("Thunder Roll", "🌩️", "quake", 8, "thunder shakes a letter out of your board every 2 seconds", { proj: "🌩️", aura: ["⚡", "💥"], motion: "spark" }),
            B("Umbrella", "☂️", "ward", 1, "opens an umbrella: your next ability bounces off", { proj: "☂️", aura: ["☂️", "💧"], motion: "pop" })],
        sky: [B("Gale", "🌪️", "gale", 9, "blows your cursor to random squares", { proj: "🌪️", aura: ["💨", "🍃"], motion: "drift" }),
            B("Twister", "🌀", "twister", 8, "keeps flipping your Across/Down direction", { proj: "🌀", aura: ["🌀", "💨"], motion: "swirl" }),
            B("Loop the Loop", "✈️", "upside", 8, "flips your board upside down", { proj: "✈️", aura: ["💨", "☁️"], motion: "swirl" }),
            B("Cloud Cover", "☁️", "flicker", 9, "clouds drift over your squares, hiding them", { proj: "☁️", aura: ["☁️", "🌫️"], motion: "drift" }),
            B("Jet Stream", "🛩️", "haste", 8, "rides the jet stream: the boss writes twice as fast", { proj: "🛩️", aura: ["💨", "⚡"], motion: "drift" })],
        desert: [B("Riddle", "🐪", "riddle", 9, "writes your clues backwards", { proj: "📜", aura: ["❓", "🔄"], motion: "swirl" }),
            B("Sand Blast", "🏜️", "sandblast", 8, "sand in the keys: some key presses don't count", { proj: "🏜️", aura: ["🟫", "💨"], motion: "drift" }),
            B("Mirage", "🌅", "mirageclue", 10, "your clue bar shows the wrong clue", { proj: "🌅", aura: ["🪞", "✨"], motion: "pop" }),
            B("Dune Shift", "🏜️", "shift", 1, "shifts the letters of one of your words over by one", { proj: "🟫", aura: ["🟫", "➡️"], motion: "drift" }),
            B("Scorpion Sting", "🦂", "curse", 15, "poison: finish a word in time, or it wipes the word you're on", { proj: "🦂", aura: ["🦂", "☠️"], motion: "pop" })],
        carnival: [B("Funhouse Mirror", "🪞", "mirror", 9, "flips your board like a mirror", { proj: "🪞", aura: ["🪞", "✨"], motion: "pop" }),
            B("Confetti Cannon", "🎉", "confetti", 9, "buries half your squares under piles of confetti", { proj: "🎉", aura: ["🎊", "🎉"], motion: "fall" }),
            B("Shell Game", "🥜", "clueswap", 10, "shuffles your clues so they're next to the wrong numbers", { proj: "🥜", aura: ["🔀", "❓"], motion: "swirl" }),
            B("Cannonball", "💣", "bomb", 8, "fires a bomb onto a square: type its right letter to defuse it", { proj: "💣", aura: ["💥", "🎪"], motion: "pop" }),
            B("Ringmaster's Call", "🎩", "taunt", 10, "calls you into the ring: you're stuck on the word it picks", { proj: "🎩", aura: ["🎪", "✨"], motion: "orbit" })],
        arcade: [B("Glitch", "👾", "glitch", 3, "turns 3 of your letters into wrong ones", { proj: "👾", aura: ["▦", "▩"], motion: "spark" }),
            B("Lag Spike", "📶", "lag", 4, "rewinds the last 4 letters you typed", { proj: "📶", aura: ["⏪", "⌛"], motion: "drift" }),
            B("Combo Breaker", "💢", "comboban", 12, "breaks your combo and stops it growing", { proj: "💢", aura: ["💢", "❌"], motion: "pop" }),
            B("Echo Bug", "🔁", "echo", 9, "every letter you type copies itself into the next square", { proj: "🔁", aura: ["🔁", "▦"], motion: "spark" }),
            B("Corrupted Font", "🔣", "mask", 9, "scrambles how your letters look", { proj: "🔣", aura: ["🔣", "▩"], motion: "spark" })],
        robot: [B("System Lock", "🔒", "lock", 10, "locks you into your current word", { proj: "🔒", aura: ["🔒", "⛓️"], motion: "orbit" }),
            B("Static", "📺", "static", 8, "fills your board with heavy TV static", { proj: "📺", aura: ["⚡", "▒"], motion: "spark" }),
            B("Reboot", "🔄", "unlock", 2, "unlocks your locked letters and wipes 2 of them", { proj: "🔄", aura: ["🔓", "⚙️"], motion: "swirl" }),
            B("Firewall", "🧱", "itemlock", 14, "blocks your items", { proj: "🧱", aura: ["🧱", "🔥"], motion: "orbit" }),
            B("Data Wipe", "💾", "numberless", 10, "wipes the numbers off your board and clues", { proj: "💾", aura: ["0", "1"], motion: "spark" })],
        library: [B("Haunting", "👻", "haunting", 10, "fills your empty squares with fake letters that look real", { proj: "👻", aura: ["👻", "🕯️"], motion: "drift" }),
            B("Lights Out", "🕯️", "lights", 8, "blows out the lights: you only see near your cursor", { proj: "🕯️", aura: ["🌑", "💨"], motion: "pop" }),
            B("Possession", "😈", "fakeclue", 12, "possesses one of your clues: it now tells a lie", { proj: "😈", aura: ["👻", "📜"], motion: "swirl" }),
            B("Poltergeist", "🪑", "wordthief", 1, "throws your last finished word off the board", { proj: "🪑", aura: ["📚", "💨"], motion: "pop" }),
            B("Torn Pages", "📜", "oneword", 10, "tears your clues down to their first word", { proj: "📜", aura: ["📄", "✂️"], motion: "fall" })],
        volcano: [B("Eruption", "🌋", "eruption", 2, "lava bombs smash two spots on your board", { proj: "🪨", aura: ["🔥", "🪨"], motion: "fall" }),
            B("Heatwave", "🥵", "heatwave", 15, "makes Check and Reveal too hot to touch", { proj: "☀️", aura: ["🔥", "♨️"], motion: "rise" }),
            B("Pressure Build", "🔴", "powerup", 1, "builds pressure: its next attack lasts twice as long", { proj: null, aura: ["🔴", "🔥"], motion: "orbit" }),
            B("Fresh Lava", "🔥", "heal", 4, "the boss writes 4 letters in a flash", { proj: null, aura: ["🔥", "✨"], motion: "rise" }),
            B("Scorched Earth", "♨️", "toll", 12, "every word you finish feeds it: it writes 2 letters", { proj: "♨️", aura: ["🔥", "💨"], motion: "rise" })],
        space: [B("Gravity Well", "🪐", "gravity", 8, "heavy keys: every letter takes two presses", { proj: "🪐", aura: ["🪐", "·"], motion: "swirl" }),
            B("Solar Flare", "☀️", "flare", 3, "a blinding flash: you can't see anything", { proj: "☀️", aura: ["✴️", "✨"], motion: "spark" }),
            B("Collapse", "💫", "collapse", 6, "pulls one letter out of each of your finished words", { proj: "💫", aura: ["✦", "💫"], motion: "swirl" }),
            B("Warp Speed", "🚀", "snapfinish", 1, "warps ahead: the boss finishes the word it's on", { proj: null, aura: ["🚀", "✨"], motion: "drift" }),
            B("Event Horizon", "🕳️", "vowels", 10, "swallows every vowel on your board from view", { proj: "🕳️", aura: ["·", "✦"], motion: "swirl" })]
    };
    const WORLD_PITCH = { paper: 0, garden: 2, squirrel: -2, candy: 5, ocean: -3, snow: 7, rain: -5, sky: 4, desert: -1, carnival: 3, arcade: 6, robot: -4, library: -6, volcano: -7, space: -8 };

    // ---------------------------------------------------------------------------------------------
    // How hard each boss fights (the user's design: difficulty in the fights too, not just the puzzles).
    // k goes from 0 (world 1) to 1 (world 15); everything scales smoothly between the two ends.
    //   every     seconds between attacks              windup  seconds of warning before an attack lands
    //   power     how long its effects last (x)        rageSpeed  how much faster it writes when enraged
    //   (how fast it solves is campaign.js's botTimeFor; it gets enraged when you lead the race by RAGE_LEAD)
    //   double    enraged, it chains two moves at once  first   seconds before its first attack
    // ---------------------------------------------------------------------------------------------
    const lerp = (a, b, k) => a + (b - a) * k;
    function threat(si, n = 15) {
        const k = Math.max(0, Math.min(1, si / Math.max(1, n - 1)));
        return {
            k, every: lerp(34, 15, k), windup: lerp(4.2, 2.2, k), power: lerp(0.8, 1.35, k),
            rageSpeed: lerp(1.1, 1.4, k), double: k >= 0.6, first: lerp(20, 8, k),
            stars: 1 + Math.round(k * 4)          // 1 to 5 skulls on the level sheet
        };
    }

    // ---------------------------------------------------------------------------------------------
    // Animations
    // ---------------------------------------------------------------------------------------------
    const layer = () => document.getElementById("overlay") || document.body;
    const still = () => U.motion() === "still";

    // the big "cast" moment in the middle of the screen: the icon slams in with a ring, the name and what it does
    function banner({ icon, name, text, color, good = true, kicker }) {
        const el = U.el("div", { class: "pw-banner" + (good ? " good" : " bad"), style: { "--c": color || "#ffd23f" }, "aria-hidden": "true" },
            U.el("div", { class: "pw-rays" }), U.el("div", { class: "pw-ring" }), U.el("div", { class: "pw-icon", text: icon }),
            U.el("div", { class: "pw-text" }, U.el("small", { text: kicker || (good ? "ABILITY" : "INCOMING") }), U.el("b", { text: name }), text ? U.el("span", { text }) : null));
        layer().appendChild(el);
        requestAnimationFrame(() => el.classList.add("in"));
        setTimeout(() => el.classList.add("out"), still() ? 700 : 1050);
        setTimeout(() => el.remove(), 1500);
    }
    // ---- the physical look (the user, 2026-10-09: "more physical components rather than emojis") ----
    // Every shot and swarm is drawn on the spells canvas: comets, embers, leaves, drops, flakes, sparks. The emoji a
    // caller names only picks WHAT is drawn (fire = embers, leaves = leaves, water = drops...), never the emoji itself.
    const KIT = () => (typeof Spells !== "undefined" && Spells.kit && Spells.kit.spray ? Spells.kit : null);
    const LOOK = {
        "🔥": ["ember", ["#ffcf3f", "#ff7a1f", "#ff3d00"]], "♨️": ["glow", ["rgba(255,160,90,.7)", "rgba(200,190,190,.6)"]], "🌋": ["ember", ["#ff6a00", "#ffcf3f"]],
        "🍂": ["leaf", ["#e07a2e", "#c4561f", "#f2b53c"]], "🍁": ["leaf", ["#d9542a", "#a8452a"]], "🌱": ["leaf", ["#7be36b", "#3fbf6b"]], "🌿": ["leaf", ["#3f8f3a", "#6fbf4a"]],
        "🌼": ["petal", ["#ffd23f", "#fff3a0"]], "🌸": ["petal", ["#ffc1d9", "#ff8fb8"]], "🌹": ["petal", ["#e2283c", "#a8152a"]], "🥀": ["petal", ["#8a4a4a", "#5a2a2a"]],
        "💧": ["drop", ["#7fb2ff", "#c9e0ff"]], "🌊": ["drop", ["#4fa3e8", "#c9ecff"]], "💦": ["drop", ["#7fd0ff", "#ffffff"]], "🫧": ["bubble", ["#ffffff"]],
        "❄️": ["flake", ["#ffffff", "#cfeeff"]], "🧊": ["crumb", ["#cfeeff", "#9fd8ff"]], "🧤": ["flake", ["#cfeeff", "#ffffff"]], "🌨️": ["flake", ["#ffffff"]],
        "⚡": ["streak", ["#ffe066", "#ffffff"]], "💥": ["star", ["#ffcf3f", "#ff7a1f", "#ffffff"]], "✨": ["star", ["#fff8d0", "#ffd23f"]], "⭐": ["star", ["#ffd23f"]],
        "💨": ["streak", ["rgba(255,255,255,.85)", "rgba(220,235,255,.8)"]], "🌀": ["ring", ["#7ae0ff", "#b48cff"]], "☁️": ["glow", ["rgba(255,255,255,.8)"]],
        "👻": ["glow", ["rgba(191,243,228,.8)", "rgba(239,255,250,.8)"]], "🩷": ["heart", ["#ff6fb5", "#ffb3d6"]], "🧁": ["heart", ["#c08bff", "#ff9ccf"]],
        "🟫": ["dot", ["#d9a35c", "#c48a45", "#ecc68e"]], "✂️": ["streak", ["#d0d6de", "#ffffff"]], "🐛": ["dot", ["#7be36b"]], "🍬": ["square", ["#ff5fa2", "#7ad7ff", "#ffd23f"]],
        "🎉": ["square", ["#e2483c", "#ffd23f", "#4fa3e8", "#7dff6b"]], "▒": ["square", ["#c8c8c8", "#ffffff", "#888888"]], "🦂": ["drop", ["#9be36b", "#5fbf2a"]],
        "☠️": ["glow", ["rgba(150,255,100,.6)"]], "🕳️": ["ring", ["#2b2233", "#5a4a7a"]], "☂️": ["drop", ["#c9e0ff"]], "☀️": ["star", ["#ffe066", "#fff8d0"]]
    };
    const lookOf = (emojis, color) => {
        const looks = (emojis || []).map(e => LOOK[e]).filter(Boolean);
        if (looks.length) return looks;
        return [["star", [color || "#ffd23f", "#ffffff"]]];
    };
    // a drawn shot from one point to another along a path (a glowing comet in the power's colour); resolves when it lands
    function fly(from, to, emoji, path = "arc", ms = 560, color) {
        const K = KIT();
        if (still() || !K) return Promise.resolve();
        const [shape, cols] = lookOf([emoji], color)[0], c = color || cols[0], trail = [];
        K.add({ life: ms / 1000, draw(ctx, k) {
            let x = from.x + (to.x - from.x) * k, y = from.y + (to.y - from.y) * k;
            if (path === "arc") y -= Math.sin(k * Math.PI) * 140;
            if (path === "zig") y += Math.sin(k * Math.PI * 6) * 26 * (1 - k);
            if (path === "spiral") { const a = k * Math.PI * 5, rr = 60 * (1 - k); x += Math.cos(a) * rr; y += Math.sin(a) * rr; }
            if (path === "rise") { x += Math.sin(k * 9) * 18; y -= Math.sin(k * Math.PI) * 60; }
            trail.push([x, y]); if (trail.length > 16) trail.shift();
            ctx.globalCompositeOperation = "lighter";
            trail.forEach(([px, py], i) => { ctx.globalAlpha = (i / trail.length) * 0.6; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(px, py, 2 + i * 0.6, 0, 7); ctx.fill(); });
            ctx.globalAlpha = 1; ctx.fillStyle = "#fff"; ctx.shadowColor = c; ctx.shadowBlur = 22; ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); ctx.fill();
            if (Math.random() < 0.5) K.spray({ x, y }, 1, { color: cols, shape, speed: [20, 80], size: [2, 4], g: 120, life: [0.3, 0.6] });
        } });
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    // a swarm of drawn particles over an element for a while (what they are comes from the emojis named)
    //   motion: pop (burst out), fall (from above), rise (from below), drift (sideways), swirl (spiral in), spark, orbit
    function aura(target, emojis, motion = "pop", n = 14, ms = 1600, color) {
        const K = KIT();
        if (still() || !K || !target) return;
        const r = target.getBoundingClientRect();
        if (!r.width) return;
        const looks = lookOf(emojis, color), life = ms / 1000, cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const count = Math.round(n * (U.motion() === "lite" ? 1 : 2));
        if (motion === "orbit") {                            // energy circling something that's charging up
            const cols = color ? [color, "#ffffff"] : looks[0][1], R = Math.max(r.width, r.height) * 0.55;
            K.add({ life, draw(ctx, k, t) {
                ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = Math.min(1, k * 4) * (k > 0.85 ? (1 - k) / 0.15 : 1);
                for (let i = 0; i < 6; i++) { const a = t * (3 + k * 6) + i * 1.047, rr = R * (1 - k * 0.35); ctx.fillStyle = cols[i % cols.length]; ctx.shadowColor = cols[0]; ctx.shadowBlur = 16; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.8, 5, 0, 7); ctx.fill(); }
                ctx.strokeStyle = cols[0]; ctx.lineWidth = 2; ctx.globalAlpha *= 0.5; ctx.beginPath(); ctx.arc(cx, cy, R * (1 - k * 0.35), t * 4, t * 4 + 2); ctx.stroke();
            } });
            return;
        }
        for (let i = 0; i < count; i++) {
            const [shape, cols] = looks[i % looks.length];
            const o = { color: cols, shape, life: [life * 0.5, life], size: shape === "glow" ? [8, 16] : [3, 7], delay: life * 0.3, spin: 5 };
            let at = { x: r.left + Math.random() * r.width, y: r.top + Math.random() * r.height };
            if (motion === "fall") { Object.assign(o, { angle: Math.PI / 2, spread: 0.4, speed: [30, 110], g: 160 }); at.y = r.top - 10; }
            else if (motion === "rise") { Object.assign(o, { angle: -Math.PI / 2, spread: 0.5, speed: [40, 140], g: -60 }); at.y = r.bottom; }
            else if (motion === "drift") Object.assign(o, { angle: 0, spread: 0.5, speed: [60, 160], g: 0, wob: [4, 60] });
            else if (motion === "swirl") Object.assign(o, { angle: Math.atan2(cy - at.y, cx - at.x) + 1.2, spread: 0.3, speed: [100, 200], g: 0, drag: 1.5 });
            else if (motion === "spark") Object.assign(o, { speed: [160, 400], g: 300, add: true });
            else { Object.assign(o, { speed: [80, 260], g: 250 }); at = { x: cx + (Math.random() - 0.5) * r.width * 0.4, y: cy + (Math.random() - 0.5) * r.height * 0.4 }; }
            K.spray(at, 1, o);
        }
    }
    // the drawn charge-up before a cast: energy rushing in to a point in the power's colour, then a flash ring
    function chargeUp(at, color, ms = 320) {
        const K = KIT();
        if (still() || !K) return Promise.resolve();
        K.add({ life: ms / 1000, draw(ctx, k) {
            ctx.globalCompositeOperation = "lighter";
            for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283 + k * 2, rr = 120 * (1 - k); ctx.strokeStyle = color; ctx.globalAlpha = k; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(at.x + Math.cos(a) * rr, at.y + Math.sin(a) * rr); ctx.lineTo(at.x + Math.cos(a) * (rr + 26), at.y + Math.sin(a) * (rr + 26)); ctx.stroke(); }
            const g = ctx.createRadialGradient(at.x, at.y, 0, at.x, at.y, 40 * k + 1); g.addColorStop(0, "#fff"); g.addColorStop(1, "transparent"); ctx.fillStyle = g; ctx.globalAlpha = k; ctx.beginPath(); ctx.arc(at.x, at.y, 40 * k + 1, 0, 7); ctx.fill();
        } });
        return new Promise(resolve => setTimeout(() => { K.ring(at, { color, r: 110, width: 7, life: 0.45 }); resolve(); }, ms));
    }
    // a glowing ring that sits on an element while an effect lasts (removed by the caller)
    function halo(target, cls, ms) {
        if (!target) return null;
        const el = U.el("div", { class: "pw-halo " + cls, "aria-hidden": "true" });
        target.appendChild(el);
        if (ms) setTimeout(() => el.remove(), ms);
        return el;
    }

    // Using an ability: the banner, the sound, and a drawn charge-up at your board; the ability's own scene
    // (spells-abilities.js) then plays the rest: what's thrown, poured or cast, and where it lands
    //   fromEl: your board, bossEl: the boss's portrait, bossBoard: the boss's board
    async function cast(a, { fromEl, bossEl, bossBoard }) {
        const fx = a.fx, color = fx.color;
        banner({ icon: a.icon, name: a.name, text: a.desc, color, good: true });
        Sound.custom(a.sound);
        smp(SMP[a.kind]);
        await chargeUp(U.center(fromEl), color);
    }
    // A boss move landing on you: the boss charges it up (drawn), its sound plays, then the move's own scene
    // (spells-moves.js) carries it from the boss to you
    async function strike(world, move, { fromEl, toEl }) {
        const B = typeof Bosses !== "undefined" ? Bosses.info(world) : null;
        await chargeUp(U.center(fromEl), B ? B.color : "#ff5c6c", 280);
        Sound.custom(move.sound);
        smp(BSMP[move.kind]);
    }
    const chargeSound = world => Sound.custom(charge, WORLD_PITCH[world] || 0);

    return { ABILITIES, MOVES, threat, cast, strike, banner, aura, halo, fly, chargeSound, ALL_SAMPLES };
})();
