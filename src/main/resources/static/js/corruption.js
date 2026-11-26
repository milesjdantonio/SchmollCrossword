// The secret worlds' levels. The world's boss watches you from its own window while you solve, and a meter of its own
// runs (the Rift's Corruption, the Squirrel's Hoard, Poseidon's Pressure, the Sandworm's Quicksand, the Lava Beast's Heat):
//   - the meter rises slowly while the clock runs (a share of it by the level's par time), and a little for every wrong
//     letter; every right word you finish pushes it back (all of them together: most of it)
//   - every so often the boss plays a TRICK: something to click (a feather, a rolling acorn, bubbles, a scarab, an
//     ember...), a false letter in a square, something over your clues, a stuck square, a covered clue, or the board
//     dimming, swaying, shimmering or flooding with magma until you finish a word. Each can be fought off; ignore it
//     and it feeds the meter when it runs out (some also take a letter: a jellyfish's sting, a scarab's bite)
//   - the meter SEEPS into your board: every so often (more often the fuller it is) it changes, takes or swaps one of
//     your letters, in the world's own way. The square is marked like a boss's hit, so clicking it puts the letter back
//   - the boss casts SPELLS: it winds up (the squares it aims at glow, an omen appears over the board) and unless you
//     click the omen in time it lands: it erases letters, turns right ones wrong, scrambles a word or wipes a line
//   - at 100% the level is lost (try again with a new puzzle)
// Each world has its own window, colours, tricks, spells, lines and balance (THEMES); later worlds are harder.
//   Corruption.start({ key, seed, level, par, entries, onLose, world })   .stop()   .pause()   .win() -> the highest it got
//   Corruption.theme(world) -> { label, loseTitle, loseKicker, loseNote }
const Corruption = (() => {
    const root = document.documentElement;
    const bar = U.el("div", { class: "rift-watch", hidden: true, role: "group", "aria-label": "Corruption meter", html: `
        <button type="button" class="rw-eye"></button>
        <div class="rw-main">
            <div class="rw-top"><small class="rw-label">Corruption</small><b class="rw-pct">0%</b><span class="rw-say" aria-live="polite"></span></div>
            <div class="rw-meter"><div class="rw-fill"><i class="rw-shine"></i></div><div class="rw-veins"></div><i class="rw-mark" style="--at:50%"></i><i class="rw-mark hot" style="--at:80%"></i><span class="rw-chain l"></span><span class="rw-chain r"></span></div>
            <div class="rw-note" aria-live="polite"></div>
        </div>` });
    const puzzleEl = document.getElementById("puzzle");
    puzzleEl.before(bar);
    const vignette = U.el("div", { class: "rift-vignette", "aria-hidden": "true" });
    document.body.appendChild(vignette);
    const $ = sel => bar.querySelector(sel);
    let s = null, T = null, tick = 0, lastSave = 0;
    const STORE = "rift";

    // ---------------------------------------------------------------------------------------------------------
    // The pictures
    // ---------------------------------------------------------------------------------------------------------
    const FEATHER = `<svg viewBox="0 0 40 120" aria-hidden="true"><path d="M20 4 Q34 30 30 70 Q28 96 20 116 Q12 96 10 70 Q6 30 20 4Z" fill="#1c1230" stroke="#9b6bff" stroke-width="2"/><path d="M20 10 V114" stroke="#b48cff" stroke-width="2"/>${Array.from({ length: 9 }, (_, i) => `<path d="M20 ${22 + i * 9} L${30 - i * 0.4} ${16 + i * 9} M20 ${22 + i * 9} L${10 + i * 0.4} ${16 + i * 9}" stroke="#6b3fd6" stroke-width="1.4"/>`).join("")}</svg>`;
    const SEAL = `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" fill="#e8c66a" stroke="#8a5a1a" stroke-width="2"/><circle cx="20" cy="20" r="11" fill="none" stroke="#8a5a1a" stroke-width="1.5" stroke-dasharray="2 2"/><path d="M20 10 L22.5 17.5 L30 20 L22.5 22.5 L20 30 L17.5 22.5 L10 20 L17.5 17.5Z" fill="#fff6d8" stroke="#8a5a1a" stroke-width="1.2"/></svg>`;
    const NUT = `<svg viewBox="0 0 40 40" aria-hidden="true"><ellipse cx="20" cy="23" rx="12" ry="14" fill="#b9773e" stroke="#4a2e14" stroke-width="2"/><path d="M6 18 Q20 2 34 18 Q20 22 6 18Z" fill="#6e4429" stroke="#4a2e14" stroke-width="2"/><path d="M9 16 L31 16 M12 12 L28 12" stroke="#8a5a32" stroke-width="1.2"/><rect x="18.5" y="4" width="3" height="7" rx="1.5" fill="#4a2e14"/><ellipse cx="15" cy="25" rx="2.5" ry="5" fill="rgba(255,255,255,.3)"/></svg>`;
    const ACORN = `<svg viewBox="0 0 40 40" aria-hidden="true"><ellipse cx="20" cy="23" rx="14" ry="15" fill="#c8843f" stroke="#4a2e14" stroke-width="2"/><path d="M4 18 Q20 0 36 18 Q20 23 4 18Z" fill="#6e4429" stroke="#4a2e14" stroke-width="2"/><path d="M8 15 H32 M11 11 H29" stroke="#8a5a32" stroke-width="1.2"/><path d="M20 24 L17 30 L21 33" fill="none" stroke="#4a2e14" stroke-width="1.6" stroke-linecap="round"/></svg>`;
    const LEAVES = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${Array.from({ length: 26 }, (_, i) => {
        const x = (i * 37) % 100, y = (i * 53) % 100, r = (i * 47) % 360, c = ["#c8681c", "#e3a35a", "#8a5a2b", "#d9b04a", "#a8492a"][i % 5];
        return `<path transform="translate(${x} ${y}) rotate(${r}) scale(1.6)" d="M-9 0 Q0 -6 9 0 Q0 6 -9 0Z" fill="${c}" stroke="rgba(60,30,10,.5)" stroke-width=".6"/>`; }).join("")}</svg>`;
    const JELLY = `<svg viewBox="0 0 40 64" aria-hidden="true"><path d="M4 24 Q4 4 20 4 Q36 4 36 24 Q28 28 20 26 Q12 28 4 24Z" fill="rgba(240,150,255,.75)" stroke="#c060e0" stroke-width="2"/><ellipse cx="14" cy="13" rx="4" ry="3" fill="rgba(255,255,255,.6)"/>${[8, 14, 20, 26, 32].map(x => `<path d="M${x} 25 Q${x - 4} 38 ${x} 48 Q${x + 4} 56 ${x} 62" fill="none" stroke="rgba(220,120,240,.8)" stroke-width="1.8" stroke-linecap="round"/>`).join("")}</svg>`;
    const CLAM = `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M3 24 Q20 2 37 24 Z" fill="#b7a9d9" stroke="#4e3f72" stroke-width="2" stroke-linejoin="round"/><path d="M3 24 Q20 38 37 24 Z" fill="#9d8ec4" stroke="#4e3f72" stroke-width="2" stroke-linejoin="round"/>${[-14, -7, 0, 7, 14].map(dx => `<path d="M20 22 L${20 + dx} 10" stroke="#4e3f72" stroke-width="1.1"/>`).join("")}<circle cx="20" cy="25" r="2.4" fill="#fff"/></svg>`;
    const SCARAB = `<svg viewBox="0 0 40 40" aria-hidden="true">${[-1, 1].map(sd => [12, 20, 28].map(y => `<path d="M20 ${y} L${20 + sd * 17} ${y + (y - 20) * 0.5 - 2}" stroke="#2a1a08" stroke-width="2" stroke-linecap="round"/>`).join("")).join("")}<ellipse cx="20" cy="23" rx="10" ry="12" fill="#2f6b6a" stroke="#122a28" stroke-width="2"/><path d="M20 12 V35" stroke="#122a28" stroke-width="1.5"/><circle cx="20" cy="9" r="5" fill="#244f4e" stroke="#122a28" stroke-width="2"/><ellipse cx="16" cy="20" rx="2" ry="5" fill="rgba(180,255,240,.45)"/></svg>`;
    const EMBER = `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" fill="rgba(255,106,31,.35)"/><path d="M20 6 Q30 16 28 24 Q26 34 20 34 Q12 34 12 25 Q12 18 18 14 Q17 22 21 23 Q24 16 20 6Z" fill="#ff8a1f" stroke="#a8300a" stroke-width="1.6"/><path d="M20 18 Q24 24 21 30 Q16 29 17 24 Z" fill="#ffe08a"/></svg>`;
    const OBSIDIAN = `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M8 12 L20 3 L33 10 L36 26 L24 37 L8 31 L4 20Z" fill="#1a1420" stroke="#ff8a1f" stroke-width="1.8" stroke-linejoin="round"/><path d="M20 3 L18 20 L36 26 M18 20 L8 31" fill="none" stroke="#5a4a70" stroke-width="1.3"/><path d="M11 13 L18 8" stroke="rgba(255,255,255,.5)" stroke-width="2" stroke-linecap="round"/></svg>`;

    // The window each boss watches through: what's behind it, its opening (the boss shows inside), and its rim
    const FRAMES = {
        rift: { shape: "M4 36 L22 22 L34 30 L52 10 L66 26 L84 8 L98 28 L116 34 L98 44 L84 62 L66 46 L52 62 L34 42 L22 50Z", inside: "#14062e", boss: "translate(-48 -46) scale(.9)" },
        hollow: {
            back: `<path d="M3 16 Q8 2 34 3 Q60 -2 90 3 Q116 6 118 22 Q121 46 110 61 Q88 72 58 69 Q22 72 8 60 Q-2 40 3 16Z" fill="#5a3a1e" stroke="#2a1608" stroke-width="2"/>
                ${["M10 14 Q26 8 40 15", "M80 9 Q96 6 110 14", "M6 44 Q14 52 22 60", "M100 40 Q108 50 112 58", "M34 66 Q58 70 84 66", "M14 28 Q18 36 16 44", "M106 24 Q110 30 108 36"].map(d => `<path d="${d}" fill="none" stroke="#3a2210" stroke-width="2" stroke-linecap="round"/>`).join("")}
                <path d="M88 60 Q92 52 100 50" fill="none" stroke="#7a5230" stroke-width="1.5"/>`,
            shape: "M60 11 C83 11 93 24 91 38 C89 54 75 62 58 61 C40 60 28 50 30 36 C31 22 42 11 60 11Z", inside: "#140a04", boss: "translate(-2 -12) scale(.52)",
            front: `<path d="M60 11 C83 11 93 24 91 38 C89 54 75 62 58 61 C40 60 28 50 30 36 C31 22 42 11 60 11Z" fill="none" stroke="#2a1608" stroke-width="7" opacity=".55"/>`
        },
        atlantis: {
            back: `<circle cx="60" cy="35" r="35" fill="#6b4e1c"/><circle cx="60" cy="35" r="33" fill="#a8822e"/>`,
            shape: "M60 7 A28 28 0 1 1 59.9 7Z", inside: "#06304c", boss: "translate(-2 -14) scale(.52)",
            front: `<circle cx="60" cy="35" r="30" fill="none" stroke="#e8c66a" stroke-width="4.5"/><circle cx="60" cy="35" r="27.5" fill="none" stroke="#5a3e0c" stroke-width="1.2"/>
                ${Array.from({ length: 10 }, (_, i) => { const a = i / 10 * Math.PI * 2; return `<circle cx="${(60 + Math.cos(a) * 32.5).toFixed(1)}" cy="${(35 + Math.sin(a) * 32.5).toFixed(1)}" r="1.9" fill="#ffe9a3" stroke="#5a3e0c" stroke-width=".8"/>`; }).join("")}
                <path d="M40 22 Q48 12 62 11" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="3" stroke-linecap="round"/><path d="M78 50 Q82 46 84 40" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="2" stroke-linecap="round"/>
                <circle class="rw-bub" cx="44" cy="50" r="2.4" fill="none" stroke="rgba(200,240,255,.8)"/><circle class="rw-bub b2" cx="76" cy="28" r="1.8" fill="none" stroke="rgba(200,240,255,.8)"/>`
        },
        dunes: {
            back: `<ellipse cx="60" cy="40" rx="59" ry="29" fill="#c9974f"/><ellipse cx="60" cy="38" rx="50" ry="24" fill="#d9ab62"/>
                ${["M6 46 Q20 40 34 46", "M86 46 Q100 40 114 46", "M14 58 Q30 54 44 60", "M78 60 Q92 54 106 58"].map(d => `<path d="${d}" fill="none" stroke="#a8743a" stroke-width="1.6" stroke-linecap="round"/>`).join("")}`,
            shape: "M60 9 C79 9 89 22 89 36 C89 51 78 63 60 63 C42 63 31 51 31 36 C31 22 41 9 60 9Z", inside: "#1a0c04", boss: "translate(-3 -6) scale(.52)",
            front: `<path d="M60 9 C79 9 89 22 89 36 C89 51 78 63 60 63 C42 63 31 51 31 36 C31 22 41 9 60 9Z" fill="none" stroke="#6a3e18" stroke-width="5"/>
                ${Array.from({ length: 16 }, (_, i) => { const a = i / 16 * Math.PI * 2, x = 60 + Math.cos(a) * 29, y = 36 + Math.sin(a) * 26.5, ix = 60 + Math.cos(a) * 21, iy = 36 + Math.sin(a) * 19, px = Math.cos(a + Math.PI / 2) * 3.4, py = Math.sin(a + Math.PI / 2) * 3.4;
                    return `<path d="M${(x + px).toFixed(1)} ${(y + py).toFixed(1)} L${ix.toFixed(1)} ${iy.toFixed(1)} L${(x - px).toFixed(1)} ${(y - py).toFixed(1)}Z" fill="#f3e6cc" stroke="#7a5a26" stroke-width=".8"/>`; }).join("")}`
        },
        cave: {
            back: `<path d="M1 12 L18 1 L56 5 L98 0 L119 14 L118 56 L96 70 L30 69 L3 60Z" fill="#2a1a18" stroke="#0e0605" stroke-width="2"/>
                ${["M6 30 L16 34 L14 44", "M104 20 L110 30 L106 40", "M20 62 L30 56", "M92 64 L100 56"].map(d => `<path d="${d}" fill="none" stroke="#ff6a1f" stroke-width="1.4" opacity=".55"/>`).join("")}`,
            shape: "M56 2 L73 12 L68 22 L85 32 L73 44 L81 56 L60 68 L45 58 L37 46 L48 34 L35 22 L50 12Z", inside: "#3a0a02", boss: "translate(-3 -14) scale(.52)"
        }
    };
    function frameHtml(world) {
        const f = FRAMES[world] || FRAMES.rift, id = "rw-clip-" + world;
        return `<svg class="rw-tear" viewBox="0 0 120 70" aria-hidden="true"><defs><clipPath id="${id}"><path d="${f.shape}"/></clipPath></defs>${f.back || ""}
            <path class="rw-tear-glow" d="${f.shape}"/><g clip-path="url(#${id})"><rect width="120" height="70" fill="${f.inside}"/><g class="rw-angel" transform="${f.boss}"></g><rect class="rw-shut" width="120" height="70"/></g>
            <path class="rw-tear-edge" d="${f.shape}"/>${f.front || ""}</svg>`;
    }

    // ---------------------------------------------------------------------------------------------------------
    // Each world's theme: its meter, tricks (per level), spells (per level), seep, balance, effects and lines
    //   trick types: drift (a thing crossing the board: click it; sting = takes a letter if it gets away), whisper (a
    //   false letter in an empty square), glare (over the clues: click the window), chain (over one clue: clicks),
    //   seal (on an empty square, blocks typing: clicks), dim (the board: finish a word), pile (over a quarter of the
    //   board: clicks), bubbles (over several letters: pop each), sink (a letter sinks: pull it out or it's gone)
    //   spell types: erase (3 letters), corrupt (3 right letters wrong), scramble (a word), line / row / col
    // ---------------------------------------------------------------------------------------------------------
    const THEMES = {
        rift: {
            label: "Corruption", loseTitle: "The Rift Took Over", loseKicker: "CORRUPTED", lossText: "The rift took over. Try again with a new puzzle.",
            loseNote: "Finish words to push the corruption back, and fight off the angel's tricks: catch the feather, click away the whisper, break the seal and the chains, and click its eye when it glares.",
            eyeLabel: "The Cursed Angel is watching. Click its eye to shut out a glare",
            balance: { rate: 60, words: 70, wrong: 0.9, cast: 1.5, counter: 2.5, landed: 3, every: [19, 17, 15, 13], spellEvery: [30, 26, 23, 20], windup: [3.4, 3.1, 2.8, 2.6], hits: [1, 2, 2, 2], seep: [16, 5] },
            levels: [["feather", "whisper", "glare", "chain"], ["feather", "whisper", "glare", "chain", "seal"], ["feather", "whisper", "glare", "chain", "seal", "dim"], ["feather", "whisper", "glare", "chain", "seal", "dim"]],
            tricks: {
                feather: { type: "drift", dir: "down", cls: "rw-feather", art: FEATHER, name: "A Black Feather", tip: "Click the feather to catch it", cost: 5, ms: 8000, colors: ["#1c1230", "#9b6bff", "#ffffff"] },
                whisper: { type: "whisper", cls: "rw-whisper", name: "The Angel Whispers", tip: "A false letter: click it away, don't type it", cost: 5, ms: 10000 },
                glare: { type: "glare", cls: "rw-glare", name: "Blinding Glare", tip: "Click the angel's eye to shut it out", cost: 4, ms: 7000 },
                chain: { type: "chain", cls: "rw-chained", hits: 2, name: "Golden Chains", tip: "Click the chained clue twice to break it", cost: 4, ms: 10000 },
                seal: { type: "seal", cls: "rw-seal", art: SEAL, hits: 3, name: "A Holy Seal", tip: "Click the sealed square 3 times to break it", cost: 5, ms: 12000 },
                dim: { type: "dim", cls: "rw-dim", name: "The Light Fades", tip: "Finish a word to bring the light back", cost: 4, ms: 9000 }
            },
            spellLevels: [["smite", "corrupt"], ["smite", "corrupt", "scramble"], ["smite", "corrupt", "scramble", "judgment"], ["smite", "corrupt", "scramble", "judgment"]],
            spells: {
                smite: { type: "erase", name: "Smite", tip: "Click the omen to stop it: it erases 3 letters", omen: `<path d="M36 4 L16 36 L30 36 L24 60 L48 24 L33 24 Z" fill="#fff6d8" stroke="#c9902f" stroke-width="2.5" stroke-linejoin="round"/>` },
                corrupt: { type: "corrupt", name: "Corrupting Touch", tip: "Click the omen to stop it: it turns 3 right letters wrong", omen: `<path d="M32 8 C44 20 50 30 44 42 C40 52 24 52 20 42 C14 30 20 20 32 8 Z" fill="#6b3fd6" stroke="#2a0f5a" stroke-width="2.5"/><circle cx="28" cy="36" r="4" fill="#e3c8ff"/><circle cx="38" cy="30" r="2.5" fill="#e3c8ff"/>` },
                scramble: { type: "scramble", name: "The Trumpet", tip: "Click the omen to stop it: it scrambles a word", omen: `<path d="M6 30 L30 30 Q44 30 54 16 L58 16 L58 48 L54 48 Q44 34 30 34 L6 34 Z" fill="#ffd06b" stroke="#8a5a1a" stroke-width="2.5" stroke-linejoin="round"/>` },
                judgment: { type: "line", name: "Judgment", tip: "Click the omen to stop it: it wipes a whole line", omen: `<path d="M24 22 L14 62 L50 62 L40 22 Z" fill="#fff6d8" opacity=".75"/><path d="M29 22 L26 62 L38 62 L35 22 Z" fill="#ffffff"/><ellipse cx="32" cy="16" rx="20" ry="7" fill="none" stroke="#ffd06b" stroke-width="5"/><ellipse cx="32" cy="16" rx="20" ry="7" fill="none" stroke="#fff6d8" stroke-width="1.5"/>` }
            },
            seep: "corrupt", seepSays: ["The corruption changed one of your letters", "The corruption swapped two of your letters"],
            fx: { burst: ["#fff6d8", "#ffd06b", "#ffffff"], dark: ["#6b3fd6", "#e3c8ff", "#1c1230"], shape: "star", tendril: ["rgba(107,63,214,.35)", "#9b6bff", "#e3c8ff"], shaft: "255,252,236", shaftEdge: "255,214,120", flash: "#7a3cff" },
            sfx: "rift",
            lines: {
                start: ["I'll take your words one by one.", "Let's see how long your light lasts.", "Write, little writer. I'm watching."], back: "Back again? The rift remembers.",
                taunt: ["Your words belong to me.", "Look away from the page...", "Every letter you write, I take.", "The book will be mine.", "Such small light. So easy to put out.", "Kneel, little writer."],
                beaten: ["You dare?", "Hm. Stubborn.", "That light won't last.", "Again? How tiresome."], spell: ["Feel my power.", "Let me show you what I am.", "Hold still.", "This page is mine.", "Kneel."],
                stopped: ["No!", "How dare you.", "You only delay me."], warn: "The light is going out. I can feel it.", lose: "At last. Your page is mine.", win: ["No... the light holds.", "This isn't over.", "You only delay me."],
                eye: ["Yes. Look at me.", "I see you, little writer.", "Mm. Keep watching."], listened: "Good. You listened."
            }
        },
        hollow: {
            label: "Hoard", loseTitle: "The Squirrel Took It All", loseKicker: "HOARDED", lossText: "The Giant Squirrel hoarded your letters. Try again with a new puzzle.",
            loseNote: "Finish words to win back the hoard, and spoil the squirrel's tricks: stop the rolling acorn, crack the stuck one, blow the leaves away, wipe off the sap, and click the knothole to shush its chatter.",
            eyeLabel: "The Giant Squirrel peeks out of its knothole. Click it to shush its chatter",
            balance: { rate: 44, words: 78, wrong: 0.6, cast: 1.2, counter: 3, landed: 2.5, every: [25, 23, 21, 19], spellEvery: [40, 36, 32, 29], windup: [4.2, 4, 3.8, 3.6], hits: [1, 1, 2, 2], seep: [22, 8] },
            levels: [["nut", "chatter", "sap", "acorn"], ["nut", "chatter", "sap", "acorn", "leaves"], ["nut", "chatter", "sap", "acorn", "leaves", "dusk"], ["nut", "chatter", "sap", "acorn", "leaves", "dusk"]],
            tricks: {
                nut: { type: "drift", dir: "roll", cls: "cw-nut", art: NUT, name: "A Rolling Acorn", tip: "Click the acorn to stop it rolling over your letters", cost: 4, ms: 9000, colors: ["#b9773e", "#6e4429", "#e3a35a"] },
                chatter: { type: "glare", cls: "cw-chatter", name: "Squirrel Chatter", tip: "Click the knothole to shush it", cost: 3, ms: 7000 },
                sap: { type: "chain", cls: "cw-sap", hits: 2, name: "Sticky Sap", tip: "Click the sappy clue twice to wipe it", cost: 3, ms: 10000 },
                acorn: { type: "seal", cls: "cw-acorn", art: ACORN, hits: 2, name: "A Stuck Acorn", tip: "Click the acorn twice to crack it", cost: 4, ms: 12000 },
                leaves: { type: "pile", cls: "cw-leaves", art: LEAVES, hits: 3, name: "A Pile of Leaves", tip: "Click the leaves 3 times to blow them away", cost: 4, ms: 11000 },
                dusk: { type: "dim", cls: "cw-dusk", name: "The Fireflies Go Out", tip: "Finish a word to bring them back", cost: 3, ms: 9000 }
            },
            spellLevels: [["pinch", "shuffle"], ["pinch", "shuffle", "swap"], ["pinch", "shuffle", "swap", "avalanche"], ["pinch", "shuffle", "swap", "avalanche"]],
            spells: {
                pinch: { type: "erase", name: "Grabby Paws", tip: "Click the paw to stop it: it grabs 3 letters", omen: `<ellipse cx="32" cy="38" rx="16" ry="14" fill="#c8843f" stroke="#4a2e14" stroke-width="2.5"/>${[[16, 20], [26, 14], [38, 14], [48, 20]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="5.5" ry="7" fill="#c8843f" stroke="#4a2e14" stroke-width="2.5"/>`).join("")}<ellipse cx="32" cy="40" rx="8" ry="6" fill="#f0c89a"/>` },
                shuffle: { type: "scramble", name: "Shuffle the Stash", tip: "Click the acorns to stop it: it shuffles a word", omen: `${[[18, 34, -0.4], [34, 22, 0.3], [44, 42, 0.9]].map(([x, y, r]) => `<g transform="translate(${x} ${y}) rotate(${r * 57})"><ellipse cy="3" rx="8" ry="9" fill="#b9773e" stroke="#4a2e14" stroke-width="2"/><path d="M-9 0 Q0 -11 9 0Z" fill="#6e4429" stroke="#4a2e14" stroke-width="2"/></g>`).join("")}<path d="M10 52 Q32 62 54 50" fill="none" stroke="#fff6d8" stroke-width="2.5" stroke-dasharray="4 4"/>` },
                swap: { type: "corrupt", name: "Bad Nuts", tip: "Click the nut to stop it: it swaps 3 right letters for wrong ones", omen: `<ellipse cx="32" cy="36" rx="16" ry="18" fill="#5a4a2a" stroke="#2a1a08" stroke-width="2.5"/><path d="M14 28 Q32 6 50 28 Q32 32 14 28Z" fill="#3a2a14" stroke="#2a1a08" stroke-width="2.5"/><path d="M26 34 L22 44 M36 38 L42 46 M30 46 L32 52" stroke="#9dbf4a" stroke-width="2.5" stroke-linecap="round"/>` },
                avalanche: { type: "row", name: "Acorn Avalanche", tip: "Click the pile to stop it: it knocks out a whole row", omen: `${[[14, 48], [26, 48], [38, 48], [50, 48], [20, 36], [32, 36], [44, 36], [26, 24], [38, 24], [32, 12]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="6" ry="6.5" fill="#b9773e" stroke="#4a2e14" stroke-width="1.8"/><path d="M${x - 6} ${y - 2} Q${x} ${y - 9} ${x + 6} ${y - 2}Z" fill="#6e4429"/>`).join("")}` }
            },
            seep: "take", seepSays: ["The squirrel pinched one of your letters", "The squirrel pinched one of your letters"],
            fx: { burst: ["#e3a35a", "#c8681c", "#ffd36b"], dark: ["#6e4429", "#9dbf4a", "#3a2a14"], shape: "leaf", tendril: ["rgba(110,68,41,.4)", "#b9773e", "#ffd36b"], shaft: "255,226,170", shaftEdge: "200,130,60", flash: "#c8681c" },
            sfx: "hollow",
            lines: {
                start: ["Mine. Mine. Those letters are MINE.", "Ooh, shiny words. I'll take those.", "Don't mind me. Just counting my nuts."], back: "You came back? More for the hoard!",
                taunt: ["Finders keepers!", "Is that a nut? It's MY nut.", "Chk-chk-chk!", "I bury everything. Even words.", "A squirrel never forgets. You will.", "Hoard, hoard, hoard!"],
                beaten: ["Hey! That was mine!", "Rude.", "I'll just steal another.", "Chk! Chk!"], spell: ["Grabby grabby!", "Stash it all!", "Look over there! ...Got it!", "Into the hoard!"],
                stopped: ["My paws!", "Not fair!", "I'll get it next time."], warn: "Almost every letter is in my hoard now...", lose: "The whole page! It's all in my hoard!", win: ["My hoard... my beautiful hoard...", "Fine! Keep your silly words.", "I'll bury the next one deeper."],
                eye: ["What? I'm not hiding anything.", "Peekaboo.", "These aren't stolen. They're saved."], listened: "Ha! You fell for it!"
            }
        },
        atlantis: {
            label: "Pressure", loseTitle: "The Deep Crushed In", loseKicker: "CRUSHED", lossText: "The pressure of the deep crushed in. Try again with a new puzzle.",
            loseNote: "Finish words to ease the pressure, and fight the sea: pop the bubbles, catch the jellyfish, pry open the clam, cut the net, and click the porthole when ink clouds the glass.",
            eyeLabel: "Poseidon watches through the porthole. Click it to wipe away the ink",
            balance: { rate: 50, words: 75, wrong: 0.7, cast: 1.3, counter: 2.8, landed: 2.8, every: [23, 21, 19, 17], spellEvery: [36, 32, 29, 26], windup: [3.9, 3.7, 3.4, 3.2], hits: [1, 1, 2, 2], seep: [20, 7] },
            levels: [["bubbles", "jelly", "ink", "net"], ["bubbles", "jelly", "ink", "net", "clam"], ["bubbles", "jelly", "ink", "net", "clam", "riptide"], ["bubbles", "jelly", "ink", "net", "clam", "riptide"]],
            tricks: {
                bubbles: { type: "bubbles", cls: "cw-bubble", n: 5, name: "A Bubble Trap", tip: "Pop every bubble over your letters", cost: 4, ms: 9000, colors: ["#bfe8ff", "#ffffff", "#7fd4ff"] },
                jelly: { type: "drift", dir: "up", sting: true, cls: "cw-jelly", art: JELLY, name: "A Jellyfish", tip: "Click the jellyfish before it stings a letter away", cost: 4, ms: 8000, colors: ["#f09aff", "#ffffff", "#c060e0"] },
                ink: { type: "glare", cls: "cw-ink", name: "An Ink Cloud", tip: "Click the porthole to wipe the glass", cost: 4, ms: 7000 },
                net: { type: "chain", cls: "cw-net", hits: 2, name: "A Fishing Net", tip: "Click the netted clue twice to cut it free", cost: 4, ms: 10000 },
                clam: { type: "seal", cls: "cw-clam", art: CLAM, hits: 3, name: "A Giant Clam", tip: "Click the clam 3 times to pry it open", cost: 5, ms: 12000 },
                riptide: { type: "dim", cls: "cw-riptide", name: "Riptide", tip: "Finish a word to steady the board", cost: 4, ms: 9000 }
            },
            spellLevels: [["undertow", "whirlpool"], ["undertow", "whirlpool", "brine"], ["undertow", "whirlpool", "brine", "tidal"], ["undertow", "whirlpool", "brine", "tidal"]],
            spells: {
                undertow: { type: "erase", name: "Undertow", tip: "Click the wave to stop it: it drags away 3 letters", omen: `<path d="M4 44 Q14 24 28 34 Q40 44 50 24 Q56 14 62 20 L62 60 L4 60Z" fill="#2a8fd6" stroke="#0b3d5e" stroke-width="2.5"/><path d="M8 46 Q18 34 28 40" fill="none" stroke="#bfe8ff" stroke-width="2.5"/>` },
                whirlpool: { type: "scramble", name: "Whirlpool", tip: "Click the whirlpool to stop it: it spins a word around", omen: `${[26, 19, 12, 5].map((r, i) => `<path d="M${32 + r} 32 A${r} ${r * 0.8} 0 1 0 ${32 - r * 0.7} ${32 - r * 0.5}" fill="none" stroke="${["#0b3d5e", "#2a8fd6", "#5fd0e8", "#e6fbff"][i]}" stroke-width="4" stroke-linecap="round"/>`).join("")}` },
                brine: { type: "corrupt", name: "Brine", tip: "Click the drop to stop it: it turns 3 right letters wrong", omen: `<path d="M32 6 C44 22 50 32 46 44 C42 56 22 56 18 44 C14 32 20 22 32 6Z" fill="#3fa98a" stroke="#0b3d3a" stroke-width="2.5"/><circle cx="26" cy="38" r="4" fill="#e6fbff"/><circle cx="36" cy="30" r="2.5" fill="#e6fbff"/>` },
                tidal: { type: "row", name: "Tidal Wave", tip: "Click the wave to stop it: it washes away a whole row", omen: `<path d="M2 58 Q4 18 34 10 Q56 6 60 22 Q46 16 40 28 Q36 40 50 42 Q34 56 2 58Z" fill="#2a8fd6" stroke="#0b3d5e" stroke-width="2.5"/><path d="M36 12 Q52 8 58 20" fill="none" stroke="#fff" stroke-width="3"/>` }
            },
            seep: "swap", seepSays: ["The current swapped two of your letters", "The current swapped two of your letters"],
            fx: { burst: ["#bfe8ff", "#ffffff", "#5fd0e8"], dark: ["#0b3d5e", "#3fa98a", "#e6fbff"], shape: "bubble", tendril: ["rgba(42,143,214,.35)", "#5fd0e8", "#e6fbff"], shaft: "220,248,255", shaftEdge: "95,208,232", flash: "#1c6a9a" },
            sfx: "atlantis",
            lines: {
                start: ["Down here, the sea decides.", "Every word you write, the deep will press on.", "Welcome to my kingdom, surface-dweller."], back: "The tide brings you back to me.",
                taunt: ["Feel the weight of the ocean.", "Down, down, down.", "The sea forgets nothing.", "Hold your breath.", "My city, my rules.", "Kneel before the trident."],
                beaten: ["Insolent!", "The sea is patient.", "A ripple. Nothing more.", "Hmph."], spell: ["Rise, waters!", "By the trident!", "The tide turns.", "Drown it all."],
                stopped: ["What?!", "The sea answers to me!", "Next wave, then."], warn: "The pressure's nearly too much for you, isn't it?", lose: "The deep takes all.", win: ["The tide... retreats.", "You breathe for now.", "Atlantis will rise again."],
                eye: ["I see you through the glass.", "Admiring my city?", "Bubbles. How quaint."], listened: "The sirens never lie... except to you."
            }
        },
        dunes: {
            label: "Quicksand", loseTitle: "The Sands Swallowed You", loseKicker: "SWALLOWED", lossText: "The quicksand swallowed the page. Try again with a new puzzle.",
            loseNote: "Finish words to climb out of the sand, and fight the desert: flick the scarab away, pull sinking letters out, see through the mirage, dig up buried clues, and click the worm's maw to calm a sandstorm.",
            eyeLabel: "The Sandworm watches from its burrow. Click its maw to calm a sandstorm",
            balance: { rate: 54, words: 72, wrong: 0.8, cast: 1.4, counter: 2.6, landed: 3, every: [21, 19, 17, 15], spellEvery: [33, 30, 27, 24], windup: [3.7, 3.4, 3.1, 2.9], hits: [1, 2, 2, 2], seep: [18, 6] },
            levels: [["scarab", "mirage", "sandstorm", "buried"], ["scarab", "mirage", "sandstorm", "buried", "quicksand"], ["scarab", "mirage", "sandstorm", "buried", "quicksand", "haze"], ["scarab", "mirage", "sandstorm", "buried", "quicksand", "haze"]],
            tricks: {
                scarab: { type: "drift", dir: "across", sting: true, cls: "cw-scarab", art: SCARAB, name: "A Scarab", tip: "Click the scarab before it eats a letter", cost: 4, ms: 8000, colors: ["#2f6b6a", "#e0b872", "#b4fff0"] },
                mirage: { type: "whisper", cls: "cw-mirage", name: "A Mirage", tip: "A false letter: click it away, don't type it", cost: 5, ms: 10000 },
                sandstorm: { type: "glare", cls: "cw-sandstorm", name: "Sandstorm", tip: "Click the worm's maw to calm the storm", cost: 4, ms: 7000 },
                buried: { type: "chain", cls: "cw-buried", hits: 2, name: "A Buried Clue", tip: "Click the buried clue twice to dig it out", cost: 4, ms: 10000 },
                quicksand: { type: "sink", cls: "cw-sinking", hits: 3, name: "Quicksand", tip: "Click the sinking square 3 times to pull its letter out", cost: 4, ms: 9000 },
                haze: { type: "dim", cls: "cw-haze", name: "Heat Haze", tip: "Finish a word to clear the air", cost: 4, ms: 9000 }
            },
            spellLevels: [["swallow", "funnel"], ["swallow", "funnel", "bleach"], ["swallow", "funnel", "bleach", "tremor"], ["swallow", "funnel", "bleach", "tremor"]],
            spells: {
                swallow: { type: "erase", name: "Swallow", tip: "Click the maw to stop it: it swallows 3 letters", omen: `<circle cx="32" cy="32" r="24" fill="#3a1a08" stroke="#8a5a2b" stroke-width="4"/>${Array.from({ length: 10 }, (_, i) => { const a = i / 10 * Math.PI * 2; return `<path d="M${(32 + Math.cos(a - 0.2) * 22).toFixed(1)} ${(32 + Math.sin(a - 0.2) * 22).toFixed(1)} L${(32 + Math.cos(a) * 12).toFixed(1)} ${(32 + Math.sin(a) * 12).toFixed(1)} L${(32 + Math.cos(a + 0.2) * 22).toFixed(1)} ${(32 + Math.sin(a + 0.2) * 22).toFixed(1)}Z" fill="#f3e6cc"/>`; }).join("")}` },
                funnel: { type: "scramble", name: "Sand Funnel", tip: "Click the funnel to stop it: it churns a word", omen: `<path d="M6 10 L58 10 L38 36 L38 58 L26 58 L26 36Z" fill="#e0b872" stroke="#8a5a2b" stroke-width="2.5" stroke-linejoin="round"/>${[16, 24, 32].map(y => `<path d="M${10 + (y - 10) * 0.6} ${y} H${54 - (y - 10) * 0.6}" stroke="#a8743a" stroke-width="2"/>`).join("")}` },
                bleach: { type: "corrupt", name: "Sun-Bleach", tip: "Click the sun to stop it: it bleaches 3 right letters wrong", omen: `<circle cx="32" cy="32" r="12" fill="#fff1a0" stroke="#e0a95f" stroke-width="2.5"/>${Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2; return `<path d="M${(32 + Math.cos(a) * 17).toFixed(1)} ${(32 + Math.sin(a) * 17).toFixed(1)} L${(32 + Math.cos(a) * 27).toFixed(1)} ${(32 + Math.sin(a) * 27).toFixed(1)}" stroke="#f6d48f" stroke-width="3.5" stroke-linecap="round"/>`; }).join("")}` },
                tremor: { type: "col", name: "Tremor", tip: "Click the crack to stop it: it shakes loose a whole column", omen: `<rect x="6" y="40" width="52" height="18" rx="4" fill="#c9974f" stroke="#6a3e18" stroke-width="2.5"/><path d="M32 4 L26 18 L36 26 L28 40 L34 58" fill="none" stroke="#3a1a08" stroke-width="4" stroke-linejoin="round"/>` }
            },
            seep: "take", seepSays: ["The sand swallowed one of your letters", "The sand swallowed one of your letters"],
            fx: { burst: ["#f6d48f", "#e0a95f", "#fff4c0"], dark: ["#a8743a", "#fff1a0", "#6a3e18"], shape: "circle", tendril: ["rgba(168,116,58,.4)", "#e0a95f", "#fff4c0"], shaft: "255,240,200", shaftEdge: "224,169,95", flash: "#c47f3e" },
            sfx: "dunes",
            lines: {
                start: ["You walk on my back, little one.", "The sand hears every word you write.", "Sink with me."], back: "The dunes remember your footsteps.",
                taunt: ["Every grain is mine.", "Deeper...", "The desert swallows all.", "Can you feel it shifting?", "I have waited a thousand years.", "Rumble, rumble."],
                beaten: ["Grrrrr.", "The sand will shift again.", "Patience. I have plenty.", "Hmm."], spell: ["The ground opens!", "Down you go!", "I rise!", "Feel the dunes move!"],
                stopped: ["RRRAAH!", "Not yet...", "The desert waits."], warn: "You're up to your neck in sand now.", lose: "Swallowed whole.", win: ["Back... into the deep sand...", "You walk away. This time.", "The desert will have you yet."],
                eye: ["I am always beneath you.", "Teeth. So many teeth.", "Stamp your feet. I dare you."], listened: "Ha. The mirage fooled you."
            }
        },
        cave: {
            label: "Heat", loseTitle: "The Cave Erupted", loseKicker: "ERUPTED", lossText: "The heat boiled over. Try again with a new puzzle.",
            loseNote: "Finish words to cool the cave, and fight the fire: catch the falling embers, crack the obsidian, click away branded letters, wipe the soot, and click the fissure to vent the smoke.",
            eyeLabel: "The Lava Beast glares through the fissure. Click it to vent the smoke",
            balance: { rate: 58, words: 70, wrong: 0.85, cast: 1.5, counter: 2.5, landed: 3, every: [20, 18, 16, 14], spellEvery: [31, 28, 25, 22], windup: [3.5, 3.2, 2.9, 2.7], hits: [1, 2, 2, 2], seep: [17, 5.5] },
            levels: [["ember", "brand", "smoke", "soot"], ["ember", "brand", "smoke", "soot", "obsidian"], ["ember", "brand", "smoke", "soot", "obsidian", "magma"], ["ember", "brand", "smoke", "soot", "obsidian", "magma"]],
            tricks: {
                ember: { type: "drift", dir: "down", sting: true, cls: "cw-ember", art: EMBER, name: "A Falling Ember", tip: "Click the ember before it burns a letter away", cost: 4, ms: 7000, colors: ["#ff8a1f", "#ffe08a", "#a8300a"] },
                brand: { type: "whisper", cls: "cw-brand", name: "A Branded Letter", tip: "A false letter: click it away, don't type it", cost: 5, ms: 10000 },
                smoke: { type: "glare", cls: "cw-smoke", name: "Choking Smoke", tip: "Click the fissure to vent the smoke", cost: 4, ms: 7000 },
                soot: { type: "chain", cls: "cw-soot", hits: 2, name: "Soot", tip: "Click the sooty clue twice to wipe it", cost: 4, ms: 10000 },
                obsidian: { type: "seal", cls: "cw-obsidian", art: OBSIDIAN, hits: 3, name: "Obsidian", tip: "Click the obsidian 3 times to crack it", cost: 5, ms: 12000 },
                magma: { type: "dim", cls: "cw-magma", name: "Rising Magma", tip: "Finish a word to push the magma back down", cost: 5, ms: 9000 }
            },
            spellLevels: [["melt", "scorch"], ["melt", "scorch", "flow"], ["melt", "scorch", "flow", "eruption"], ["melt", "scorch", "flow", "eruption"]],
            spells: {
                melt: { type: "erase", name: "Melt", tip: "Click the drop to stop it: it melts away 3 letters", omen: `<path d="M32 4 C46 22 52 32 48 44 C44 58 20 58 16 44 C12 32 18 22 32 4Z" fill="#ff5a1f" stroke="#8a1e08" stroke-width="2.5"/><path d="M26 30 C24 38 28 46 34 46" fill="none" stroke="#ffe08a" stroke-width="3" stroke-linecap="round"/>` },
                scorch: { type: "corrupt", name: "Scorch", tip: "Click the flame to stop it: it scorches 3 right letters wrong", omen: `<path d="M32 4 Q48 20 46 36 Q44 58 32 58 Q16 58 16 40 Q16 28 26 20 Q24 34 32 36 Q38 22 32 4Z" fill="#ff8a1f" stroke="#a8300a" stroke-width="2.5"/><path d="M32 28 Q40 40 34 50 Q24 48 26 40Z" fill="#fff1a0"/>` },
                flow: { type: "col", name: "Lava Flow", tip: "Click the flow to stop it: it pours down a whole column", omen: `<path d="M18 4 H46 L42 22 Q50 34 42 44 Q48 54 40 60 H24 Q16 54 22 44 Q14 34 22 22Z" fill="#ff6a1f" stroke="#8a1e08" stroke-width="2.5"/><path d="M28 10 V54" stroke="#ffe08a" stroke-width="3" stroke-linecap="round"/>` },
                eruption: { type: "row", name: "Eruption", tip: "Click the volcano to stop it: it blasts a whole row", omen: `<path d="M4 60 L22 26 H42 L60 60Z" fill="#3a2a26" stroke="#120806" stroke-width="2.5"/><path d="M22 26 Q32 34 42 26 L38 20 Q32 4 26 20Z" fill="#ff6a1f"/>${[[16, 12], [32, 4], [48, 10]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.5" fill="#ffb02e"/>`).join("")}` }
            },
            seep: "melt", seepSays: ["The heat melted one of your letters wrong", "The heat melted one of your letters wrong"],
            fx: { burst: ["#ffb02e", "#ff6a1f", "#fff1a0"], dark: ["#8a1e08", "#ff6a1f", "#1a0804"], shape: "spark", tendril: ["rgba(200,64,26,.4)", "#ff6a1f", "#ffe08a"], shaft: "255,200,120", shaftEdge: "255,106,31", flash: "#ff5a1f" },
            sfx: "cave",
            lines: {
                start: ["You've come too deep, little spark.", "Everything down here burns.", "Feel the heat rise."], back: "Back to the fire? Good.",
                taunt: ["Hotter. Hotter.", "Your words are kindling.", "The rock remembers fire.", "Breathe in the smoke.", "I am the mountain's heart.", "Burn."],
                beaten: ["Grrrh.", "A spark goes out. More will come.", "You're sweating.", "Hssss."], spell: ["ERUPT!", "Melt!", "Let it flow!", "Burn it all!"],
                stopped: ["RAAAH!", "The fire waits.", "You can't cool me forever."], warn: "The rock is glowing. Almost there.", lose: "Everything burns.", win: ["The fire... dims...", "Cooled. For now.", "The mountain will wake again."],
                eye: ["Staring into the fire?", "The heat is rising.", "Closer..."], listened: "Branded. Ha!"
            }
        }
    };
    const themeOf = world => THEMES[world] || THEMES.rift;

    const g = () => Game.state;
    const on = () => !!(s && !s.over && U.view() === "level" && g().puzzle && !g().solved);
    const cellAt = (r, c) => Game.cellEl(r, c);
    const allCells = () => { const p = g().puzzle, out = []; if (!p) return out; p.solution.forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== ".") out.push([r, c]); })); return out; };
    const B = () => T.balance;
    const lvl = list => list[s.level - 1] || list[list.length - 1];

    // ---- each world's sounds ----
    const SFX = {
        rift: {
            cast() { Sound.tone({ f: 1320, f2: 660, type: "sine", d: 0.5, v: 0.05, echo: 0.4 }); Sound.tone({ f: 220, f2: 207, type: "sawtooth", d: 0.7, v: 0.025, filt: { f: 900 } }); },
            good() { Sound.tone({ f: 1568, type: "sine", d: 0.6, v: 0.05, echo: 0.4 }); Sound.tone({ t: 0.08, f: 2093, type: "sine", d: 0.6, v: 0.04, echo: 0.4 }); },
            windup(d) { Sound.tone({ f: 220, f2: 880, type: "sawtooth", d, v: 0.025, filt: { f: 1200 } }); Sound.tone({ f: 110, f2: 220, type: "sine", d, v: 0.05 }); },
            seep() { Sound.tone({ f: 330, f2: 196, type: "sine", d: 0.5, v: 0.05, vib: 6 }); Sound.tone({ f: 660, f2: 392, type: "triangle", d: 0.35, v: 0.02 }); },
            warn() { Sound.tone({ f: 110, f2: 104, type: "sine", d: 1.4, v: 0.08, vib: 3 }); Sound.tone({ f: 116.5, type: "sine", d: 1.4, v: 0.06 }); }
        },
        hollow: {
            cast() { [0, 0.07, 0.14].forEach(t => Sound.tone({ t, f: 1800, f2: 1500, type: "triangle", d: 0.05, v: 0.05 })); Sound.tone({ f: 180, f2: 140, type: "triangle", d: 0.25, v: 0.06 }); },
            good() { Sound.tone({ f: 784, type: "triangle", d: 0.2, v: 0.06 }); Sound.tone({ t: 0.09, f: 1175, type: "triangle", d: 0.3, v: 0.05 }); },
            windup(d) { Sound.tone({ f: 200, f2: 420, type: "triangle", d, v: 0.04, vib: 10 }); },
            seep() { Sound.tone({ f: 1400, f2: 900, type: "triangle", d: 0.12, v: 0.05 }); Sound.tone({ t: 0.1, f: 300, f2: 200, type: "triangle", d: 0.15, v: 0.05 }); },
            warn() { Sound.tone({ f: 165, f2: 150, type: "triangle", d: 1.2, v: 0.07, vib: 5 }); }
        },
        atlantis: {
            cast() { Sound.tone({ f: 300, f2: 900, type: "sine", d: 0.3, v: 0.05 }); Sound.tone({ t: 0.12, f: 400, f2: 1100, type: "sine", d: 0.25, v: 0.04 }); Sound.tone({ f: 70, f2: 55, type: "sine", d: 0.9, v: 0.08 }); },
            good() { Sound.tone({ f: 1046, type: "sine", d: 0.5, v: 0.05, echo: 0.5 }); Sound.tone({ t: 0.1, f: 1568, type: "sine", d: 0.5, v: 0.04, echo: 0.5 }); },
            windup(d) { Sound.tone({ f: 60, f2: 120, type: "sine", d, v: 0.09, vib: 2 }); Sound.tone({ f: 240, f2: 480, type: "triangle", d, v: 0.02, filt: { f: 700 } }); },
            seep() { Sound.tone({ f: 500, f2: 1200, type: "sine", d: 0.18, v: 0.04 }); Sound.tone({ t: 0.08, f: 700, f2: 1500, type: "sine", d: 0.15, v: 0.03 }); },
            warn() { Sound.tone({ f: 55, f2: 50, type: "sine", d: 1.6, v: 0.12 }); Sound.tone({ f: 82, type: "sine", d: 1.6, v: 0.05 }); }
        },
        dunes: {
            cast() { Sound.tone({ f: 90, f2: 60, type: "sawtooth", d: 0.6, v: 0.05, filt: { f: 400 } }); Sound.tone({ f: 2400, f2: 1800, type: "triangle", d: 0.3, v: 0.012, crush: true }); },
            good() { Sound.tone({ f: 659, type: "triangle", d: 0.3, v: 0.05 }); Sound.tone({ t: 0.08, f: 880, type: "triangle", d: 0.4, v: 0.05 }); Sound.tone({ t: 0.16, f: 1318, type: "sine", d: 0.5, v: 0.03 }); },
            windup(d) { Sound.tone({ f: 45, f2: 90, type: "sawtooth", d, v: 0.05, filt: { f: 300 } }); Sound.tone({ f: 55, type: "sine", d, v: 0.07, vib: 7 }); },
            seep() { Sound.tone({ f: 200, f2: 80, type: "sawtooth", d: 0.35, v: 0.03, filt: { f: 600 } }); },
            warn() { Sound.tone({ f: 49, f2: 44, type: "sawtooth", d: 1.4, v: 0.06, filt: { f: 250 } }); Sound.tone({ f: 98, type: "sine", d: 1.4, v: 0.05 }); }
        },
        cave: {
            cast() { Sound.tone({ f: 80, f2: 45, type: "sawtooth", d: 0.7, v: 0.06, filt: { f: 500 } }); [0, 0.05, 0.11].forEach(t => Sound.tone({ t, f: 3000, f2: 2000, type: "square", d: 0.02, v: 0.01 })); },
            good() { Sound.tone({ f: 523, type: "triangle", d: 0.3, v: 0.05 }); Sound.tone({ t: 0.08, f: 784, type: "triangle", d: 0.4, v: 0.05 }); Sound.tone({ t: 0.04, f: 1500, f2: 800, type: "sine", d: 0.4, v: 0.02 }); },
            windup(d) { Sound.tone({ f: 40, f2: 110, type: "sawtooth", d, v: 0.06, filt: { f: 500 } }); Sound.tone({ f: 80, f2: 160, type: "sine", d, v: 0.05 }); },
            seep() { Sound.tone({ f: 900, f2: 300, type: "sawtooth", d: 0.3, v: 0.02, filt: { f: 1500 } }); Sound.tone({ f: 120, f2: 70, type: "sine", d: 0.3, v: 0.06 }); },
            warn() { Sound.tone({ f: 41, f2: 37, type: "sawtooth", d: 1.6, v: 0.08, filt: { f: 300 } }); Sound.tone({ f: 82, type: "sine", d: 1.6, v: 0.05 }); }
        }
    };
    const sfx = () => SFX[T.sfx] || SFX.rift;

    // ---- the meter ----
    function add(k, why) {
        if (!s || s.over) return;
        s.value = U.clamp(s.value + k, 0, 100);
        s.peak = Math.max(s.peak, s.value);
        if (k > 2) U.restart($(".rw-meter"), "hit");
        if (k < 0) U.restart($(".rw-meter"), "heal");
        draw();
        save();
        if (s.value >= 100) lose();
        else if (why) note(why, k < 0 ? "good" : "bad");
    }
    function draw() {
        if (!s) return;
        const v = s.value / 100;
        bar.style.setProperty("--v", v.toFixed(3));
        vignette.style.setProperty("--v", v.toFixed(3));
        const pct = Math.round(s.value) + "%", el = $(".rw-pct");
        if (el.textContent !== pct) el.textContent = pct;
        bar.classList.toggle("warn", s.value >= 50);
        bar.classList.toggle("danger", s.value >= 80);
        root.classList.toggle("rift-danger", s.value >= 80);
        if (s.value >= 80 && !s.warned) { s.warned = true; say(T.lines.warn); sfx().warn(); }
        if (s.value < 70) s.warned = false;
    }
    let noteTimer = 0, sayTimer = 0;
    function note(text, tone = "info") {
        const el = $(".rw-note");
        el.textContent = text;
        el.dataset.tone = tone;
        U.restart(el, "in");
        clearTimeout(noteTimer);
        noteTimer = setTimeout(() => { el.textContent = ""; }, 3200);
    }
    function say(text) {
        const el = $(".rw-say");
        el.textContent = `"${text}"`;
        U.restart(el, "in");
        clearTimeout(sayTimer);
        sayTimer = setTimeout(() => { el.textContent = ""; }, 4200);
    }
    function save() {
        const now = performance.now();
        if (!s || now - lastSave < 1500) return;
        lastSave = now;
        U.store.set(STORE, { key: s.key, seed: s.seed, value: Math.round(s.value * 10) / 10, peak: Math.round(s.peak * 10) / 10 });
    }

    // ---- the tricks ----
    const layer = () => document.querySelector(".board-wrap");
    const info = kind => T.tricks[kind];
    function cast() {
        const busy = new Set(s.tricks.map(t => info(t.kind).type));
        const free = lvl(T.levels).filter(k => !busy.has(info(k).type) && can(k));
        if (!free.length) return;
        let kind = U.pick(free);
        if (free.length > 1 && kind === s.lastKind) kind = U.pick(free.filter(k => k !== kind));
        s.lastKind = kind;
        const i = info(kind), t = { kind, until: performance.now() + i.ms, el: null };
        U.restart(bar.querySelector(".rw-eye"), "cast");
        U.restart(root, "rift-flash");
        sfx().cast();
        const ok = BEGIN[i.type](t, i);
        if (ok === false) return;
        s.tricks.push(t);
        note(`${i.name} · ${i.tip}`, "bad");
        if (Math.random() < 0.6) say(U.pick(T.lines.taunt));
        add(B().cast);
    }
    function can(kind) {
        const p = g().puzzle, type = info(kind).type;
        if (!p) return false;
        if (type === "whisper" || type === "seal") return emptyCells().length > 0;
        if (type === "bubbles" || type === "sink") return looseCells().length > 0;
        return true;
    }
    const emptyCells = () => allCells().filter(([r, c]) => !g().letters[r][c] && !Game.isLocked(r, c));
    function end(t, beaten) {
        if (t.done) return;
        t.done = true;
        s.tricks = s.tricks.filter(x => x !== t);
        const i = info(t.kind);
        FINISH[i.type](t, i);
        if (beaten) {
            s.countered++;
            sfx().good();
            add(-B().counter, `Fought off: ${i.name}`);
            if (Math.random() < 0.5) say(U.pick(T.lines.beaten));
        } else {
            if (i.sting) sting(t);
            if (i.type === "sink") sinkAway(t);
            add(i.cost, `${i.name} fed the ${T.label.toLowerCase()}`);
        }
    }
    const piece = (cls, html, parent = layer()) => { const el = U.el("button", { type: "button", class: "rw-piece " + cls, html }); parent.appendChild(el); return el; };
    const tap = (el, fn) => el.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); fn(); });
    // a stinging drifter got away: it takes one of your letters on its way out
    function sting(t) {
        const loose = looseCells();
        if (!loose.length) return;
        const st = g(), before = snapshot(), [r, c] = U.pick(loose);
        Game.setLetters([[r, c, ""]]);
        Game.markBossChanges(before);
        const el = cellAt(r, c);
        if (el) { const p = U.center(el); FX.burst({ x: p.x, y: p.y, n: 10, colors: info(t.kind).colors, shape: T.fx.shape, speed: [60, 200], gravity: 200, life: [0.4, 0.8], size: [2, 5] }); U.restart(el, "shake"); }
    }
    // a sinking letter that wasn't pulled out is gone
    function sinkAway(t) {
        if (g().letters[t.r][t.c] !== t.letter) return;
        const before = snapshot();
        Game.setLetters([[t.r, t.c, ""]]);
        Game.markBossChanges(before);
    }
    function clicker(t, i, el, label, onHit) {
        t.hits = 0;
        const need = i.hits || 1;
        const badge = el.querySelector("b");
        tap(el, () => {
            if (++t.hits >= need) { burst(el, T.fx.burst); end(t, true); return; }
            if (badge) badge.textContent = need - t.hits;
            U.restart(el, "rw-shake");
            Sound.tone({ f: 500 + t.hits * 150, type: "triangle", d: 0.08, v: 0.08 });
            if (onHit) onHit();
        });
        el.setAttribute("aria-label", label);
    }
    const BEGIN = {
        drift(t, i) {
            const el = piece(`rw-drift cw-${i.dir} ${i.cls}`, i.art);
            el.setAttribute("aria-label", `${i.name}: click it`);
            el.style.setProperty("--dur", i.ms + "ms");
            if (i.dir === "down" || i.dir === "up") el.style.left = U.rand(10, 70).toFixed(0) + "%";
            else {
                const n = g().puzzle.size, row = Math.floor(Math.random() * n);
                el.style.top = ((row + 0.5) / n * 100).toFixed(1) + "%";
                el.style.setProperty("--cell", (100 / n).toFixed(2) + "%");
            }
            tap(el, () => { burst(el, i.colors); end(t, true); });
            t.el = el;
        },
        whisper(t, i) {
            const p = g().puzzle, mine = Game.cellsOf(currentEntry()) || [];
            const options = mine.filter(([r, c]) => !g().letters[r][c]);
            const [r, c] = U.pick(options.length ? options : emptyCells());
            const fake = wrongFor(p.solution[r][c]);
            const el = U.el("button", { type: "button", class: "rw-piece rw-whisper " + i.cls, text: fake, "aria-label": `${i.name}: click it away` });
            cellAt(r, c).appendChild(el);
            tap(el, () => { burst(el, T.fx.burst); end(t, true); });
            Object.assign(t, { el, r, c, letter: fake });
        },
        glare(t, i) { document.querySelector(".clues").classList.add(i.cls, "cw-cover"); },
        chain(t, i) {
            const items = [...document.querySelectorAll(".clues li")].filter(li => !li.classList.contains("done"));
            const li = U.pick(items.length ? items : [...document.querySelectorAll(".clues li")]);
            if (!li) return false;
            li.classList.add(i.cls, "cw-bound");
            t.li = li; t.hits = 0;
            t.click = e => { e.preventDefault(); e.stopPropagation(); if (++t.hits >= (i.hits || 2)) { burst(li, T.fx.burst); end(t, true); } else U.restart(li, "rw-shake"); };
            li.addEventListener("click", t.click, true);
        },
        seal(t, i) {
            const mine = (Game.cellsOf(currentEntry()) || []).filter(([r, c]) => !g().letters[r][c]);
            const [r, c] = U.pick(mine.length ? mine : emptyCells());
            const el = U.el("button", { type: "button", class: "rw-piece rw-seal " + i.cls, html: i.art + `<b>${i.hits}</b>` });
            cellAt(r, c).appendChild(el);
            clicker(t, i, el, `${i.name}: click it ${i.hits} times`);
            Object.assign(t, { el, r, c });
        },
        dim(t, i) { document.querySelector(".board-area").classList.add(i.cls, "cw-dimmed"); t.from = performance.now(); },
        pile(t, i) {
            const el = piece("cw-pile " + i.cls, i.art + `<b>${i.hits}</b>`);
            el.style.left = Math.random() < 0.5 ? "0" : "50%";
            el.style.top = Math.random() < 0.5 ? "0" : "50%";
            clicker(t, i, el, `${i.name}: click it ${i.hits} times`, () => { const p = U.center(el); FX.burst({ x: p.x, y: p.y, n: 8, colors: ["#c8681c", "#e3a35a", "#8a5a2b"], shape: "leaf", speed: [80, 220], gravity: 200, life: [0.5, 0.9], size: [4, 7] }); });
            t.el = el;
        },
        bubbles(t, i) {
            const spots = looseCells().sort(() => Math.random() - 0.5).slice(0, i.n);
            t.els = spots.map(([r, c]) => {
                const el = U.el("button", { type: "button", class: "rw-piece " + i.cls, "aria-label": "A bubble: click it to pop it" });
                el.style.setProperty("--d", U.rand(0, 1.2).toFixed(2) + "s");
                cellAt(r, c).appendChild(el);
                tap(el, () => {
                    burst(el, i.colors); el.remove();
                    Sound.tone({ f: U.rand(700, 1100), f2: 1600, type: "sine", d: 0.08, v: 0.06 });
                    if (t.els.every(x => !x.isConnected)) end(t, true);
                });
                return el;
            });
        },
        sink(t, i) {
            const [r, c] = U.pick(looseCells());
            const cell = cellAt(r, c);
            cell.classList.add(i.cls);
            cell.style.setProperty("--dur", i.ms + "ms");
            const el = U.el("button", { type: "button", class: "rw-piece cw-sink-grab", html: `<b>${i.hits}</b>` });
            cell.appendChild(el);
            clicker(t, i, el, `${i.name}: click it ${i.hits} times to pull the letter out`, () => U.restart(cell, "cw-tug"));
            Object.assign(t, { el, r, c, cell, letter: g().letters[r][c] });
        }
    };
    const FINISH = {
        drift(t) { if (t.el) t.el.remove(); },
        whisper(t) { if (t.el) t.el.remove(); },
        glare(t, i) { document.querySelector(".clues").classList.remove(i.cls, "cw-cover"); },
        chain(t, i) { if (t.li) { t.li.classList.remove(i.cls, "cw-bound"); t.li.removeEventListener("click", t.click, true); } },
        seal(t) { if (t.el) t.el.remove(); },
        dim(t, i) { const a = document.querySelector(".board-area"); a.classList.remove(i.cls, "cw-dimmed"); a.style.removeProperty("--dim"); },
        pile(t) { if (t.el) t.el.remove(); },
        bubbles(t) { (t.els || []).forEach(el => el.remove()); },
        sink(t, i) { if (t.el) t.el.remove(); if (t.cell) { t.cell.classList.remove(i.cls); t.cell.style.removeProperty("--dur"); } }
    };
    function burst(el, colors) {
        const p = U.center(el);
        FX.burst({ x: p.x, y: p.y, n: 16, colors, shape: T.fx.shape, speed: [80, 240], gravity: 120, life: [0.4, 0.8], size: [2, 5], glow: true });
    }
    function currentEntry() {
        const st = g();
        if (!st.puzzle || !st.acrossAt) return null;
        return (st.direction === "across" ? st.acrossAt : st.downAt)[st.row][st.col] || st.acrossAt[st.row][st.col] || st.downAt[st.row][st.col];
    }

    // ---- the seep and the spells ----
    // your letters it can touch: not locked, and not in a word you've already got right
    function looseCells() {
        const st = g(), safe = new Set();
        for (const e of [...st.puzzle.across, ...st.puzzle.down]) {
            const cells = Game.cellsOf(e);
            if (cells.every(([r, c]) => st.letters[r][c] === st.puzzle.solution[r][c])) cells.forEach(([r, c]) => safe.add(r + "," + c));
        }
        return allCells().filter(([r, c]) => st.letters[r][c] && !Game.isLocked(r, c) && !safe.has(r + "," + c));
    }
    const wrongFor = right => String.fromCharCode(65 + ((right.charCodeAt(0) - 65 + 1 + Math.floor(Math.random() * 24)) % 26));
    const snapshot = () => g().letters.map(row => [...row]);
    const K = () => Spells.kit;
    const eyeAt = () => U.center(bar.querySelector(".rw-eye"));
    // a tendril from the boss's window to a square, in the world's colours
    function tendril(el) {
        if (!el) return;
        const a = eyeAt(), b = U.center(el), bend = U.rand(-80, 80), cols = T.fx.tendril;
        K().add({ life: 0.8, draw(ctx, k) {
            const q = Math.min(1, k / 0.45), fade = k > 0.55 ? (1 - k) / 0.45 : 1;
            const mx = (a.x + b.x) / 2 + bend, my = (a.y + b.y) / 2 - 40;
            ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = fade; ctx.lineCap = "round";
            for (const [w, c] of [[9, cols[0]], [3.5, cols[1]], [1.2, cols[2]]]) {
                ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a.x, a.y);
                const n = 24;
                for (let i = 1; i <= n * q; i++) { const t = i / n, x = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * mx + t * t * b.x, y = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * my + t * t * b.y; ctx.lineTo(x + Math.sin(t * 18 + k * 20) * 4, y); }
                ctx.stroke();
            }
            if (q >= 1) K().haloAt(ctx, b.x, b.y, 26, cols[1], fade);
        } });
    }
    // a shaft of light (or lava, sand, water) dropping onto a square
    function shaft(el, wide = 0.38) {
        if (!el) return;
        const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, core = T.fx.shaft, edge = T.fx.shaftEdge;
        K().add({ life: 0.75, draw(ctx, k) {
            const drop = Math.min(1, k / 0.22), fade = k > 0.3 ? Math.max(0, 1 - (k - 0.3) / 0.7) : 1, bw = r.width * wide * fade;
            ctx.globalCompositeOperation = "lighter";
            const gr = ctx.createLinearGradient(x - bw, 0, x + bw, 0);
            gr.addColorStop(0, `rgba(${edge},0)`); gr.addColorStop(0.5, `rgba(${core},${fade})`); gr.addColorStop(1, `rgba(${edge},0)`);
            ctx.fillStyle = gr; ctx.fillRect(x - bw, 0, bw * 2, y * drop);
            K().haloAt(ctx, x, y * drop, r.width * 0.9, `rgb(${core})`, fade);
        } });
    }
    // the passive seep: changes (or takes, or swaps) one of your letters, the world's way
    function seep() {
        const loose = looseCells(), st = g();
        if (!loose.length) return;
        const before = snapshot(), sets = [];
        const words = [...st.puzzle.across, ...st.puzzle.down].map(e => Game.cellsOf(e).filter(([r, c]) => loose.some(([r2, c2]) => r2 === r && c2 === c))).filter(cs => new Set(cs.map(([r, c]) => st.letters[r][c])).size >= 2);
        const swap = T.seep === "swap" ? words.length > 0 : T.seep === "corrupt" && words.length && Math.random() < 0.35;
        if (swap) {
            const cs = U.pick(words), [a] = cs.splice(Math.floor(Math.random() * cs.length), 1), b = U.pick(cs.filter(([r, c]) => st.letters[r][c] !== st.letters[a[0]][a[1]]));
            sets.push([a[0], a[1], st.letters[b[0]][b[1]]], [b[0], b[1], st.letters[a[0]][a[1]]]);
            note(T.seepSays[1], "bad");
        } else if (T.seep === "take") {
            const [r, c] = U.pick(loose);
            sets.push([r, c, ""]);
            note(T.seepSays[0], "bad");
        } else {
            const [r, c] = U.pick(loose), now = st.letters[r][c], right = st.puzzle.solution[r][c];
            let ch = wrongFor(right);
            if (ch === now) ch = wrongFor(right);
            sets.push([r, c, ch]);
            note(T.seepSays[0], "bad");
        }
        Game.setLetters(sets);
        Game.markBossChanges(before);
        for (const [r, c] of sets) { const el = cellAt(r, c); tendril(el); if (el) U.restart(el, "rw-seeped"); }
        sfx().seep();
    }
    // what a spell will hit, chosen when it winds up (so you can see it coming)
    function aim(type) {
        const loose = looseCells(), st = g();
        if (type === "erase") return loose.sort(() => Math.random() - 0.5).slice(0, 3);
        if (type === "corrupt") return loose.filter(([r, c]) => st.letters[r][c] === st.puzzle.solution[r][c]).sort(() => Math.random() - 0.5).slice(0, 3);
        if (type === "scramble") {
            const opts = [...st.puzzle.across, ...st.puzzle.down].map(e => Game.cellsOf(e).filter(([r, c]) => loose.some(([r2, c2]) => r2 === r && c2 === c)))
                .filter(cs => new Set(cs.map(([r, c]) => st.letters[r][c])).size >= 2);
            return opts.length ? opts.sort((a, b) => b.length - a.length + Math.random() - 0.5)[0] : [];
        }
        // a line: the row or column (or either) with the most of your loose letters
        const n = st.puzzle.size, lines = [];
        for (let i = 0; i < n; i++) {
            if (type !== "col") lines.push(loose.filter(([r]) => r === i));
            if (type !== "row") lines.push(loose.filter(([, c]) => c === i));
        }
        return lines.sort((a, b) => b.length - a.length)[0] || [];
    }
    function windUp() {
        const options = lvl(T.spellLevels).filter(k => k !== s.lastSpell).map(k => [k, aim(T.spells[k].type)]).filter(([k, t]) => t.length >= (T.spells[k].type === "scramble" ? 2 : 1));
        if (!options.length) return;
        const [kind, targets] = U.pick(options), sp = T.spells[kind];
        s.lastSpell = kind;
        const ms = lvl(B().windup) * 1000, need = lvl(B().hits);
        const el = U.el("button", { type: "button", class: `rw-omen rw-omen-${sp.type}`, "aria-label": `${sp.name}: click it ${need} times to stop it`,
            html: `<svg viewBox="0 0 64 64" aria-hidden="true">${sp.omen}</svg><i class="rw-omen-ring"></i><b>${need > 1 ? "×" + need : ""}</b>` });
        el.style.left = U.rand(14, 78).toFixed(0) + "%";
        el.style.top = U.rand(14, 78).toFixed(0) + "%";
        el.style.setProperty("--dur", ms + "ms");
        layer().appendChild(el);
        const p = { kind, targets, at: performance.now() + ms, el, hits: 0, need };
        el.addEventListener("pointerdown", e => {
            e.preventDefault(); e.stopPropagation();
            if (s.pending !== p) return;
            p.hits++;
            Sound.tone({ f: 700 + p.hits * 200, type: "sine", d: 0.12, v: 0.06 });
            if (p.hits >= need) { burst(el, T.fx.burst); fizzle(true); }
            else { U.restart(el, "rw-shake"); el.querySelector("b").textContent = "×" + (need - p.hits); el.style.left = U.rand(14, 78).toFixed(0) + "%"; el.style.top = U.rand(14, 78).toFixed(0) + "%"; }
        });
        s.pending = p;
        for (const [r, c] of targets) { const t = cellAt(r, c); if (t) t.classList.add("rw-aim"); }
        U.restart(bar.querySelector(".rw-eye"), "cast");
        bar.classList.add("casting");
        note(`${sp.name} · ${sp.tip}`, "bad");
        say(U.pick(T.lines.spell));
        sfx().windup(ms / 1000);
    }
    // the spell ends: stopped (beaten) or cleared away quietly
    function fizzle(beaten) {
        const p = s && s.pending;
        if (!p) return;
        s.pending = null;
        p.el.remove();
        document.querySelectorAll("#board .rw-aim").forEach(n => n.classList.remove("rw-aim"));
        bar.classList.remove("casting");
        if (beaten) {
            s.countered++;
            sfx().good();
            add(-B().counter, `Stopped: ${T.spells[p.kind].name}`);
            say(U.pick(T.lines.stopped));
        }
    }
    function land() {
        const p = s.pending, st = g(), sp = T.spells[p.kind], type = sp.type, line = type === "line" || type === "row" || type === "col";
        fizzle(false);
        const before = snapshot(), loose = new Set(looseCells().map(([r, c]) => r + "," + c));
        const targets = p.targets.filter(([r, c]) => loose.has(r + "," + c));
        let sets = [];
        if (type === "erase" || line) sets = targets.map(([r, c]) => [r, c, ""]);
        else if (type === "corrupt") sets = targets.filter(([r, c]) => st.letters[r][c] === st.puzzle.solution[r][c]).map(([r, c]) => [r, c, wrongFor(st.puzzle.solution[r][c])]);
        else if (type === "scramble") {
            const was = targets.map(([r, c]) => st.letters[r][c]);
            let mixed = [...was].sort(() => Math.random() - 0.5);
            if (mixed.every((ch, i) => ch === was[i])) mixed = was.slice(1).concat(was[0]);
            sets = targets.map(([r, c], i) => [r, c, mixed[i]]).filter((x, i) => mixed[i] !== was[i]);
        }
        Game.setLetters(sets);
        Game.markBossChanges(before);
        U.restart(root, "rift-flash");
        FX.shake(line ? 12 : 7, 400);
        targets.forEach(([r, c], i) => {
            const el = cellAt(r, c);
            setTimeout(() => {
                if (type === "corrupt") tendril(el); else if (type === "scramble") { if (el) el.animate([{ transform: "rotate(0)" }, { transform: "rotate(360deg) scale(.85)" }, { transform: "rotate(720deg)" }], { duration: 600, easing: "ease-in-out" }); } else shaft(el, line ? 0.5 : 0.36);
                if (el) { const c2 = U.center(el); FX.burst({ x: c2.x, y: c2.y, n: 8, colors: type === "corrupt" ? T.fx.dark : T.fx.burst, shape: T.fx.shape, speed: [60, 200], gravity: 100, life: [0.4, 0.8], size: [2, 4], glow: true }); }
            }, U.motion() === "still" ? 0 : i * (line ? 50 : 110));
        });
        if (type === "scramble") [[67, 0], [72, 0.15], [76, 0.3]].forEach(([n, t]) => Sound.tone({ t, f: 440 * Math.pow(2, (n - 69) / 12), type: "sawtooth", d: 0.25, v: 0.04, filt: { f: 2000 } }));
        else if (type === "corrupt") Sound.tone({ f: 300, f2: 120, type: "sine", d: 0.7, v: 0.08, vib: 8 });
        else { Sound.tone({ f: 2400, f2: 600, type: "sine", d: 0.4, v: 0.05 }); Sound.tone({ f: 90, f2: 50, type: "sine", d: 0.6, v: 0.15 }); }
        add(B().landed, `${sp.name} hit you · Click a marked square to put its letter back`);
    }
    // the boss's window: clicking it ends whatever is over your clues
    bar.querySelector(".rw-eye").addEventListener("click", () => {
        if (!on()) return;
        const t = s.tricks.find(x => info(x.kind).type === "glare");
        if (t) { U.restart(bar.querySelector(".rw-eye"), "shut"); end(t, true); }
        else { U.restart(bar.querySelector(".rw-eye"), "cast"); say(U.pick(T.lines.eye)); }
    });
    // a stuck square (a seal, an acorn, a clam, obsidian) blocks typing there
    function sealed() { const st = g(); return s && s.tricks.some(t => info(t.kind).type === "seal" && t.r === st.row && t.c === st.col); }
    function sealedNote() { const t = s.tricks.find(x => info(x.kind).type === "seal"); note(t ? info(t.kind).tip : "Stuck", "bad"); }
    addEventListener("keydown", e => {
        if (!on() || e.ctrlKey || e.metaKey || e.altKey || !/^[a-zA-Z]$/.test(e.key)) return;
        if (e.target.closest && e.target.closest("input, select, textarea")) return;
        if (sealed()) { e.preventDefault(); e.stopPropagation(); const el = cellAt(g().row, g().col); if (el) U.restart(el, "shake"); sealedNote(); }
    }, true);
    document.getElementById("keyboard").addEventListener("click", e => {
        const k = e.target.closest(".key");
        if (on() && k && /^[A-Z]$/.test(k.dataset.key) && sealed()) { e.stopPropagation(); sealedNote(); }
    }, true);
    Bus.on("type", ({ row, col, letter }) => {
        if (!on() || !letter) return;
        const p = g().puzzle;
        const w = s.tricks.find(t => info(t.kind).type === "whisper" && t.r === row && t.c === col);
        if (w && letter === w.letter) { end(w, false); add(4, "You fell for it"); say(T.lines.listened); return; }
        if (w) end(w, true);                                  // you typed your own letter over it
        const sk = s.tricks.find(t => info(t.kind).type === "sink" && t.r === row && t.c === col);
        if (sk) { sk.letter = letter; }                       // (a retyped sinking letter is still sinking)
        if (letter !== p.solution[row][col]) add(B().wrong);
    });
    // a word that's just become all right (typed, corrected or filled by an item) pushes the meter back, once
    function rightWords() {
        const st = g();
        if (!st.puzzle) return;
        for (const e of [...st.puzzle.across, ...st.puzzle.down]) {
            const id = e.direction + e.number;
            if (s.credited.has(id) || !Game.cellsOf(e).every(([r, c]) => st.letters[r][c] === st.puzzle.solution[r][c])) continue;
            s.credited.add(id);
            if (!s.ready) continue;                                // (the words already right when the level loads)
            add(-s.perWord);
            const d = s.tricks.find(t => info(t.kind).type === "dim");
            if (d) end(d, true);
        }
        s.ready = true;
    }

    // ---- the clock: four times a second ----
    setInterval(() => {
        if (!on() || document.hidden || FX.playing || document.querySelector("#overlay .results")) return;
        const st = g();
        rightWords();
        const ds = st.seconds - s.lastSec;
        s.lastSec = st.seconds;
        if (ds > 0 && ds < 5) {
            add(s.rate * ds);
            s.nextCast -= ds;
            if (s.nextCast <= 0) { s.nextCast = lvl(B().every) * U.rand(0.8, 1.2); cast(); }
            s.nextSpell -= ds;
            if (s.nextSpell <= 0 && !s.pending) { s.nextSpell = lvl(B().spellEvery) * U.rand(0.8, 1.2); windUp(); }
            s.seepAcc += ds;                                       // the fuller the meter, the faster it seeps
            const [slow, fast] = B().seep;
            if (s.seepAcc >= slow + (fast - slow) * (s.value / 100)) { s.seepAcc = 0; seep(); }
        }
        const now = performance.now();
        if (s && s.pending && now >= s.pending.at) land();
        for (const t of [...s.tricks]) if (now >= t.until) end(t, false);
        const d = s.tricks.find(t => info(t.kind).type === "dim");
        if (d) document.querySelector(".board-area").style.setProperty("--dim", Math.min(1, (now - d.from) / info(d.kind).ms).toFixed(3));
        tick++;
    }, 250);

    function dress(world) {
        T = themeOf(world);
        root.dataset.cw = THEMES[world] ? world : "rift";
        const eye = bar.querySelector(".rw-eye");
        if (eye.dataset.world !== world) {
            eye.innerHTML = frameHtml(THEMES[world] ? world : "rift");
            eye.dataset.world = world;
            eye.setAttribute("aria-label", T.eyeLabel);
            eye.title = T.eyeLabel;
            const holder = eye.querySelector(".rw-angel");
            if (typeof Bosses !== "undefined") holder.innerHTML = Bosses.inner(world);
            $(".rw-label").textContent = T.label;
            bar.setAttribute("aria-label", T.label + " meter");
        }
    }
    function start({ key, seed, level, par, entries, onLose, world = "rift" }) {
        // the same level again (you went to another screen and came back): carry on where it was
        if (s && !s.over && s.key === key && String(s.seed) === String(seed)) { s.onLose = onLose; s.lastSec = g().seconds; dress(s.world); bar.hidden = false; root.classList.add("in-rift"); draw(); return; }
        stopQuiet();
        dress(world);
        const saved = U.store.get(STORE, null);
        const keep = saved && saved.key === key && String(saved.seed) === String(seed) && !g().solved;
        s = { world, key, seed, level: U.clamp(level, 1, 4), value: keep ? saved.value : 0, peak: keep ? saved.peak : 0, rate: B().rate / Math.max(60, par), perWord: B().words / Math.max(4, entries),
            tricks: [], nextCast: 9, nextSpell: 16, seepAcc: 0, pending: null, lastSpell: null, lastSec: g().seconds, onLose, over: false, countered: 0, lastKind: null, warned: false, credited: new Set(), ready: false };
        bar.hidden = false;
        root.classList.add("in-rift");
        draw();
        say(keep ? T.lines.back : U.pick(T.lines.start));
    }
    function clearTricks() { if (!s) return; for (const t of [...s.tricks]) { t.done = true; const i = info(t.kind); FINISH[i.type](t, i); } s.tricks = []; }
    function stopQuiet() {
        if (s) { fizzle(false); clearTricks(); }
        s = null;
        bar.hidden = true;
        root.classList.remove("in-rift", "rift-danger");
        vignette.style.setProperty("--v", "0");
    }
    function stopAll() { stopQuiet(); }
    // leaving the level's screen: the tricks go quietly (no cost) and the meter waits, saved, until you're back
    function pause() {
        if (!s) return;
        fizzle(false);
        clearTricks();
        lastSave = 0; save();
        bar.hidden = true;
        root.classList.remove("in-rift", "rift-danger");
    }
    function lose() {
        if (!s || s.over) return;
        fizzle(false);
        s.over = true;
        clearTricks();
        U.store.set(STORE, null);
        say(T.lines.lose);
        U.restart(root, "rift-flash");
        FX.shake(10, 500);
        const cb = s.onLose;
        setTimeout(() => cb && cb(), 600);
    }
    // the level is solved: the window closes and the meter drains (returns the highest it got, for the results)
    function win() {
        if (!s) return 0;
        const peak = Math.round(s.peak);
        fizzle(false);
        clearTricks();
        s.over = true;
        U.store.set(STORE, null);
        bar.classList.add("sealed");
        say(U.pick(T.lines.win));
        setTimeout(() => { bar.classList.remove("sealed"); stopQuiet(); }, 2600);
        return peak;
    }
    const theme = world => { const t = themeOf(world); return { label: t.label, loseTitle: t.loseTitle, loseKicker: t.loseKicker, loseNote: t.loseNote, lossText: t.lossText, flash: t.fx.flash }; };
    return { start, stop: stopAll, pause, win, theme, get active() { return on(); }, get value() { return s ? s.value : 0 }, get peak() { return s ? s.peak : 0; } };
})();
