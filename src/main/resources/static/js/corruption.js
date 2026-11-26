// The Celestial Rift's levels. The Cursed Angel watches you through a tear in the sky while you solve:
//   - the CORRUPTION meter rises slowly while the clock runs (half of it by the level's par time), and a little for
//     every wrong letter; every right word you finish pushes it back (all of them together: 70%)
//   - every so often the angel interferes: a black feather drifts over the board, a false letter is whispered into a
//     square, a glare washes out your clues, a seal closes a square, chains wrap a clue, the board dims. Each one can
//     be fought off (click it, or finish a word); ignore it and it feeds the corruption when it runs out
//   - at 100% the rift takes over: the level is lost (try again with a new puzzle)
// Harder:
//   - the corruption SEEPS into your board as it rises: every so often (16 seconds apart when the meter is empty, 5
//     when it's nearly full) it changes one of your letters into a wrong one, or swaps two letters inside a word. The
//     square is marked like a boss's hit, so clicking it puts your letter back
//   - the angel casts SPELLS like a boss: it winds up (the squares it aims at glow, an omen appears over the board),
//     and unless you click the omen in time it lands: Smite erases 3 letters, Corrupting Touch turns 3 right letters
//     wrong, Trumpet scrambles a word, Judgment wipes a whole row or column. Level 1 knows two, level 3 all four
// The UI is its own (not the boss race bar): a strip above the board with the angel's eyes in a tear and a cracked
// crystal meter, and the edges of the screen darkening violet as it rises.
//   Corruption.start({ key, seed, level, par, onLose })   Corruption.stop()   Corruption.win() -> the highest it got
const Corruption = (() => {
    const root = document.documentElement;
    const TEAR = "M4 36 L22 22 L34 30 L52 10 L66 26 L84 8 L98 28 L116 34 L98 44 L84 62 L66 46 L52 62 L34 42 L22 50Z";
    const bar = U.el("div", { class: "rift-watch", hidden: true, role: "group", "aria-label": "Corruption meter", html: `
        <button type="button" class="rw-eye" aria-label="The Cursed Angel is watching. Click its eye to shut out a glare" title="The angel is watching">
            <svg class="rw-tear" viewBox="0 0 120 70" aria-hidden="true"><defs><clipPath id="rw-clip"><path d="${TEAR}"/></clipPath></defs>
                <path class="rw-tear-glow" d="${TEAR}"/><g clip-path="url(#rw-clip)"><rect width="120" height="70" fill="#14062e"/><g class="rw-angel" transform="translate(-48 -46) scale(.9)"></g><rect class="rw-shut" width="120" height="70"/></g>
                <path class="rw-tear-edge" d="${TEAR}"/></svg>
        </button>
        <div class="rw-main">
            <div class="rw-top"><small>Corruption</small><b class="rw-pct">0%</b><span class="rw-say" aria-live="polite"></span></div>
            <div class="rw-meter"><div class="rw-fill"><i class="rw-shine"></i></div><div class="rw-veins"></div><i class="rw-mark" style="--at:50%"></i><i class="rw-mark hot" style="--at:80%"></i><span class="rw-chain l"></span><span class="rw-chain r"></span></div>
            <div class="rw-note" aria-live="polite"></div>
        </div>` });
    const puzzleEl = document.getElementById("puzzle");
    puzzleEl.before(bar);
    const vignette = U.el("div", { class: "rift-vignette", "aria-hidden": "true" });
    document.body.appendChild(vignette);
    const $ = sel => bar.querySelector(sel);
    let s = null, tick = 0, lastSave = 0;

    const STORE = "rift";
    const RATE_SHARE = 60, WORDS_SHARE = 70, WRONG = 0.9, CAST = 1.5, COUNTER = 2.5;
    // what the angel does in each level (level 1 knows four tricks, level 3 all six), and how often (seconds)
    const KINDS = [["feather", "whisper", "glare", "chain"], ["feather", "whisper", "glare", "chain", "seal"], ["feather", "whisper", "glare", "chain", "seal", "dim"], ["feather", "whisper", "glare", "chain", "seal", "dim"]];
    const EVERY = [19, 17, 15, 13];
    const INFO = {
        feather: { name: "A Black Feather", tip: "Click the feather to catch it", cost: 5, ms: 8000 },
        whisper: { name: "The Angel Whispers", tip: "A false letter: click it away, don't type it", cost: 5, ms: 10000 },
        glare: { name: "Blinding Glare", tip: "Click the angel's eye to shut it out", cost: 4, ms: 7000 },
        chain: { name: "Golden Chains", tip: "Click the chained clue twice to break it", cost: 4, ms: 10000 },
        seal: { name: "A Holy Seal", tip: "Click the sealed square 3 times to break it", cost: 5, ms: 12000 },
        dim: { name: "The Light Fades", tip: "Finish a word to bring the light back", cost: 4, ms: 9000 }
    };
    // its spells: which ones each level knows, how often (seconds), the warning, the clicks on the omen that stop one
    const SPELLS = [["smite", "corrupt"], ["smite", "corrupt", "scramble"], ["smite", "corrupt", "scramble", "judgment"], ["smite", "corrupt", "scramble", "judgment"]];
    const SPELL_EVERY = [30, 26, 23, 20], WINDUP = [3.4, 3.1, 2.8, 2.6], OMEN_HITS = [1, 2, 2, 2], LANDED = 3;
    const SPELL = {
        smite: { name: "Smite", tip: "Click the omen to stop it: it erases 3 letters" },
        corrupt: { name: "Corrupting Touch", tip: "Click the omen to stop it: it turns 3 right letters wrong" },
        scramble: { name: "The Trumpet", tip: "Click the omen to stop it: it scrambles a word" },
        judgment: { name: "Judgment", tip: "Click the omen to stop it: it wipes a whole line" }
    };
    const OMEN = {
        smite: `<path d="M36 4 L16 36 L30 36 L24 60 L48 24 L33 24 Z" fill="#fff6d8" stroke="#c9902f" stroke-width="2.5" stroke-linejoin="round"/>`,
        corrupt: `<path d="M32 8 C44 20 50 30 44 42 C40 52 24 52 20 42 C14 30 20 20 32 8 Z" fill="#6b3fd6" stroke="#2a0f5a" stroke-width="2.5"/><circle cx="28" cy="36" r="4" fill="#e3c8ff"/><circle cx="38" cy="30" r="2.5" fill="#e3c8ff"/>`,
        scramble: `<path d="M6 30 L30 30 Q44 30 54 16 L58 16 L58 48 L54 48 Q44 34 30 34 L6 34 Z" fill="#ffd06b" stroke="#8a5a1a" stroke-width="2.5" stroke-linejoin="round"/>`,
        judgment: `<path d="M24 22 L14 62 L50 62 L40 22 Z" fill="#fff6d8" opacity=".75"/><path d="M29 22 L26 62 L38 62 L35 22 Z" fill="#ffffff"/><ellipse cx="32" cy="16" rx="20" ry="7" fill="none" stroke="#ffd06b" stroke-width="5"/><ellipse cx="32" cy="16" rx="20" ry="7" fill="none" stroke="#fff6d8" stroke-width="1.5"/>`
    };
    const SEEP_SLOW = 16, SEEP_FAST = 5;
    const TAUNTS = ["Your words belong to me.", "Look away from the page...", "Every letter you write, I take.", "The book will be mine.", "Such small light. So easy to put out.", "Kneel, little writer."];

    const g = () => Game.state;
    const on = () => !!(s && !s.over && U.view() === "level" && g().puzzle && !g().solved);
    const cellAt = (r, c) => Game.cellEl(r, c);
    const allCells = () => { const p = g().puzzle, out = []; if (!p) return out; p.solution.forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== ".") out.push([r, c]); })); return out; };

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
        $(".rw-pct").textContent = Math.round(s.value) + "%";
        bar.classList.toggle("warn", s.value >= 50);
        bar.classList.toggle("danger", s.value >= 80);
        root.classList.toggle("rift-danger", s.value >= 80);
        if (s.value >= 80 && !s.warned) { s.warned = true; say("The light is going out. I can feel it."); Sound.tone({ f: 110, f2: 104, type: "sine", d: 1.4, v: 0.08, vib: 3 }); Sound.tone({ f: 116.5, type: "sine", d: 1.4, v: 0.06 }); }
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

    // ---- the angel's tricks ----
    const layer = () => document.querySelector(".board-wrap");
    function cast() {
        const kinds = KINDS[s.level - 1] || KINDS[3], busy = new Set(s.tricks.map(t => t.kind));
        const free = kinds.filter(k => !busy.has(k) && can(k));
        if (!free.length) return;
        let kind = U.pick(free);
        if (free.length > 1 && kind === s.lastKind) kind = U.pick(free.filter(k => k !== kind));
        s.lastKind = kind;
        const info = INFO[kind], t = { kind, until: performance.now() + info.ms, el: null };
        U.restart(bar.querySelector(".rw-eye"), "cast");
        U.restart(root, "rift-flash");
        Sound.tone({ f: 1320, f2: 660, type: "sine", d: 0.5, v: 0.05, echo: 0.4 });
        Sound.tone({ f: 220, f2: 207, type: "sawtooth", d: 0.7, v: 0.025, filt: { f: 900 } });
        const ok = BEGIN[kind](t);
        if (ok === false) return;
        s.tricks.push(t);
        note(`${info.name} · ${info.tip}`, "bad");
        if (Math.random() < 0.6) say(U.pick(TAUNTS));
        add(CAST);
    }
    function can(kind) {
        const p = g().puzzle;
        if (!p) return false;
        if (kind === "whisper" || kind === "seal") return emptyCells().length > 0;
        return true;
    }
    const emptyCells = () => allCells().filter(([r, c]) => !g().letters[r][c] && !Game.isLocked(r, c));
    function end(t, beaten) {
        if (t.done) return;
        t.done = true;
        s.tricks = s.tricks.filter(x => x !== t);
        FINISH[t.kind](t);
        if (beaten) {
            s.countered++;
            Sound.tone({ f: 1568, type: "sine", d: 0.6, v: 0.05, echo: 0.4 });
            Sound.tone({ t: 0.08, f: 2093, type: "sine", d: 0.6, v: 0.04, echo: 0.4 });
            add(-COUNTER, `Resisted: ${INFO[t.kind].name}`);
            if (Math.random() < 0.5) say(U.pick(["You dare?", "Hm. Stubborn.", "That light won't last.", "Again? How tiresome."]));
        } else add(INFO[t.kind].cost, `${INFO[t.kind].name} fed the rift`);
    }
    const piece = (cls, html, parent = layer()) => { const el = U.el("button", { type: "button", class: "rw-piece " + cls, html }); parent.appendChild(el); return el; };
    const FEATHER = `<svg viewBox="0 0 40 120" aria-hidden="true"><path d="M20 4 Q34 30 30 70 Q28 96 20 116 Q12 96 10 70 Q6 30 20 4Z" fill="#1c1230" stroke="#9b6bff" stroke-width="2"/><path d="M20 10 V114" stroke="#b48cff" stroke-width="2"/>${Array.from({ length: 9 }, (_, i) => `<path d="M20 ${22 + i * 9} L${30 - i * 0.4} ${16 + i * 9} M20 ${22 + i * 9} L${10 + i * 0.4} ${16 + i * 9}" stroke="#6b3fd6" stroke-width="1.4"/>`).join("")}</svg>`;
    const SEAL = `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" fill="#e8c66a" stroke="#8a5a1a" stroke-width="2"/><circle cx="20" cy="20" r="11" fill="none" stroke="#8a5a1a" stroke-width="1.5" stroke-dasharray="2 2"/><path d="M20 10 L22.5 17.5 L30 20 L22.5 22.5 L20 30 L17.5 22.5 L10 20 L17.5 17.5Z" fill="#fff6d8" stroke="#8a5a1a" stroke-width="1.2"/></svg>`;
    const BEGIN = {
        feather(t) {
            const el = piece("rw-feather", FEATHER);
            el.setAttribute("aria-label", "A black feather drifting over the board: click it to catch it");
            el.style.left = U.rand(10, 70).toFixed(0) + "%";
            el.style.setProperty("--dur", INFO.feather.ms + "ms");
            el.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); burst(el, ["#1c1230", "#9b6bff", "#ffffff"]); end(t, true); });
            t.el = el;
        },
        whisper(t) {
            const p = g().puzzle, mine = Game.cellsOf(currentEntry()) || [];
            const options = mine.filter(([r, c]) => !g().letters[r][c]);
            const [r, c] = U.pick(options.length ? options : emptyCells());
            const right = p.solution[r][c], fake = String.fromCharCode(65 + ((right.charCodeAt(0) - 65 + 1 + Math.floor(Math.random() * 24)) % 26));
            const el = U.el("button", { type: "button", class: "rw-piece rw-whisper", text: fake, "aria-label": "A whispered letter: click it away" });
            cellAt(r, c).appendChild(el);
            el.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); burst(el, ["#c49bff", "#ffffff"]); end(t, true); });
            Object.assign(t, { el, r, c, letter: fake });
        },
        glare(t) { document.querySelector(".clues").classList.add("rw-glare"); },
        chain(t) {
            const items = [...document.querySelectorAll(".clues li")].filter(li => !li.classList.contains("done"));
            const li = U.pick(items.length ? items : [...document.querySelectorAll(".clues li")]);
            if (!li) return false;
            li.classList.add("rw-chained");
            t.li = li; t.hits = 0;
            t.click = e => { e.preventDefault(); e.stopPropagation(); if (++t.hits >= 2) { burst(li, ["#e8c66a", "#fff6d8"]); end(t, true); } else U.restart(li, "rw-shake"); };
            li.addEventListener("click", t.click, true);
        },
        seal(t) {
            const mine = (Game.cellsOf(currentEntry()) || []).filter(([r, c]) => !g().letters[r][c]);
            const [r, c] = U.pick(mine.length ? mine : emptyCells());
            const el = U.el("button", { type: "button", class: "rw-piece rw-seal", html: SEAL + `<b>3</b>`, "aria-label": "A holy seal: click it 3 times to break it" });
            cellAt(r, c).appendChild(el);
            t.hits = 0;
            el.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); if (++t.hits >= 3) { burst(el, ["#e8c66a", "#fff6d8", "#8a5a1a"]); end(t, true); } else { el.querySelector("b").textContent = 3 - t.hits; U.restart(el, "rw-shake"); Sound.tone({ f: 500 + t.hits * 150, type: "triangle", d: 0.08, v: 0.08 }); } });
            Object.assign(t, { el, r, c });
        },
        dim(t) { document.querySelector(".board-area").classList.add("rw-dim"); t.from = performance.now(); }
    };
    const FINISH = {
        feather(t) { if (t.el) t.el.remove(); },
        whisper(t) { if (t.el) t.el.remove(); },
        glare() { document.querySelector(".clues").classList.remove("rw-glare"); },
        chain(t) { if (t.li) { t.li.classList.remove("rw-chained"); t.li.removeEventListener("click", t.click, true); } },
        seal(t) { if (t.el) t.el.remove(); },
        dim() { const a = document.querySelector(".board-area"); a.classList.remove("rw-dim"); a.style.removeProperty("--dim"); }
    };
    function burst(el, colors) {
        const p = U.center(el);
        FX.burst({ x: p.x, y: p.y, n: 16, colors, shape: "star", speed: [80, 240], gravity: 120, life: [0.4, 0.8], size: [2, 5], glow: true });
    }
    function currentEntry() {
        const st = g();
        if (!st.puzzle || !st.acrossAt) return null;
        return (st.direction === "across" ? st.acrossAt : st.downAt)[st.row][st.col] || st.acrossAt[st.row][st.col] || st.downAt[st.row][st.col];
    }
    // ---- the corruption seeps in, and the angel's spells ----
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
    // a violet tendril of corruption from the tear to a square
    function tendril(el, color = "#9b6bff") {
        if (!el) return;
        const a = eyeAt(), b = U.center(el), bend = U.rand(-80, 80);
        K().add({ life: 0.8, draw(ctx, k) {
            const q = Math.min(1, k / 0.45), fade = k > 0.55 ? (1 - k) / 0.45 : 1;
            const mx = (a.x + b.x) / 2 + bend, my = (a.y + b.y) / 2 - 40;
            ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = fade; ctx.lineCap = "round";
            for (const [w, c] of [[9, "rgba(107,63,214,.35)"], [3.5, color], [1.2, "#e3c8ff"]]) {
                ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a.x, a.y);
                const n = 24;
                for (let i = 1; i <= n * q; i++) { const t = i / n, x = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * mx + t * t * b.x, y = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * my + t * t * b.y; ctx.lineTo(x + Math.sin(t * 18 + k * 20) * 4, y); }
                ctx.stroke();
            }
            if (q >= 1) K().haloAt(ctx, b.x, b.y, 26, "#9b6bff", fade);
        } });
    }
    // a shaft of holy light dropping onto a square (or a line of them)
    function shaft(el, wide = 0.38) {
        if (!el) return;
        const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
        K().add({ life: 0.75, draw(ctx, k) {
            const drop = Math.min(1, k / 0.22), fade = k > 0.3 ? Math.max(0, 1 - (k - 0.3) / 0.7) : 1, bw = r.width * wide * fade;
            ctx.globalCompositeOperation = "lighter";
            const gr = ctx.createLinearGradient(x - bw, 0, x + bw, 0);
            gr.addColorStop(0, "rgba(255,214,120,0)"); gr.addColorStop(0.5, `rgba(255,252,236,${fade})`); gr.addColorStop(1, "rgba(255,214,120,0)");
            ctx.fillStyle = gr; ctx.fillRect(x - bw, 0, bw * 2, y * drop);
            K().haloAt(ctx, x, y * drop, r.width * 0.9, "#fff6d8", fade);
        } });
    }
    // the passive corruption: one letter changed into a wrong one, or two letters swapped inside a word
    function seep() {
        const loose = looseCells(), st = g();
        if (!loose.length) return;
        const before = snapshot(), sets = [];
        const words = [...st.puzzle.across, ...st.puzzle.down].map(e => Game.cellsOf(e).filter(([r, c]) => loose.some(([r2, c2]) => r2 === r && c2 === c))).filter(cs => new Set(cs.map(([r, c]) => st.letters[r][c])).size >= 2);
        if (words.length && Math.random() < 0.35) {
            const cs = U.pick(words), [a] = cs.splice(Math.floor(Math.random() * cs.length), 1), b = U.pick(cs.filter(([r, c]) => st.letters[r][c] !== st.letters[a[0]][a[1]]));
            sets.push([a[0], a[1], st.letters[b[0]][b[1]]], [b[0], b[1], st.letters[a[0]][a[1]]]);
            note("The corruption swapped two of your letters", "bad");
        } else {
            const [r, c] = U.pick(loose), now = st.letters[r][c], right = st.puzzle.solution[r][c];
            let ch = wrongFor(right);
            if (ch === now) ch = wrongFor(right);
            sets.push([r, c, ch]);
            note("The corruption changed one of your letters", "bad");
        }
        Game.setLetters(sets);
        Game.markBossChanges(before);
        for (const [r, c] of sets) { const el = cellAt(r, c); tendril(el); if (el) U.restart(el, "rw-seeped"); }
        Sound.tone({ f: 330, f2: 196, type: "sine", d: 0.5, v: 0.05, vib: 6 });
        Sound.tone({ f: 660, f2: 392, type: "triangle", d: 0.35, v: 0.02 });
    }
    // what a spell will hit, chosen when it winds up (so you can see it coming)
    function aim(kind) {
        const loose = looseCells(), st = g();
        if (kind === "smite") return loose.sort(() => Math.random() - 0.5).slice(0, 3);
        if (kind === "corrupt") return loose.filter(([r, c]) => st.letters[r][c] === st.puzzle.solution[r][c]).sort(() => Math.random() - 0.5).slice(0, 3);
        if (kind === "scramble") {
            const opts = [...st.puzzle.across, ...st.puzzle.down].map(e => Game.cellsOf(e).filter(([r, c]) => loose.some(([r2, c2]) => r2 === r && c2 === c)))
                .filter(cs => new Set(cs.map(([r, c]) => st.letters[r][c])).size >= 2);
            return opts.length ? opts.sort((a, b) => b.length - a.length + Math.random() - 0.5)[0] : [];
        }
        // judgment: the row or column with the most of your loose letters
        const n = st.puzzle.size, lines = [];
        for (let i = 0; i < n; i++) { lines.push(loose.filter(([r]) => r === i)); lines.push(loose.filter(([, c]) => c === i)); }
        return lines.sort((a, b) => b.length - a.length)[0] || [];
    }
    function windUp() {
        const kinds = SPELLS[s.level - 1] || SPELLS[3];
        const options = kinds.filter(k => k !== s.lastSpell).map(k => [k, aim(k)]).filter(([k, t]) => t.length >= (k === "scramble" ? 2 : 1));
        if (!options.length) return;
        const [kind, targets] = U.pick(options);
        s.lastSpell = kind;
        const ms = (WINDUP[s.level - 1] || 2.6) * 1000, need = OMEN_HITS[s.level - 1] || 2;
        const el = U.el("button", { type: "button", class: "rw-omen rw-omen-" + kind, "aria-label": `${SPELL[kind].name}: click it ${need} times to stop it`,
            html: `<svg viewBox="0 0 64 64" aria-hidden="true">${OMEN[kind]}</svg><i class="rw-omen-ring"></i><b>${need > 1 ? "×" + need : ""}</b>` });
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
            if (p.hits >= need) { burst(el, ["#fff6d8", "#ffd06b", "#9b6bff"]); fizzle(true); }
            else { U.restart(el, "rw-shake"); el.querySelector("b").textContent = "×" + (need - p.hits); el.style.left = U.rand(14, 78).toFixed(0) + "%"; el.style.top = U.rand(14, 78).toFixed(0) + "%"; }
        });
        s.pending = p;
        for (const [r, c] of targets) { const t = cellAt(r, c); if (t) t.classList.add("rw-aim"); }
        U.restart(bar.querySelector(".rw-eye"), "cast");
        bar.classList.add("casting");
        note(`${SPELL[kind].name} · ${SPELL[kind].tip}`, "bad");
        say(U.pick(["Feel my power.", "Let me show you what I am.", "Hold still.", "This page is mine.", "Kneel."]));
        Sound.tone({ f: 220, f2: 880, type: "sawtooth", d: ms / 1000, v: 0.025, filt: { f: 1200 } });
        Sound.tone({ f: 110, f2: 220, type: "sine", d: ms / 1000, v: 0.05 });
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
            Sound.tone({ f: 1568, type: "sine", d: 0.6, v: 0.05, echo: 0.4 });
            add(-COUNTER, `Stopped: ${SPELL[p.kind].name}`);
            say(U.pick(["No!", "How dare you.", "You only delay me."]));
        }
    }
    function land() {
        const p = s.pending, st = g();
        fizzle(false);
        const before = snapshot(), loose = new Set(looseCells().map(([r, c]) => r + "," + c));
        const targets = p.targets.filter(([r, c]) => loose.has(r + "," + c));
        let sets = [];
        if (p.kind === "smite" || p.kind === "judgment") sets = targets.map(([r, c]) => [r, c, ""]);
        else if (p.kind === "corrupt") sets = targets.filter(([r, c]) => st.letters[r][c] === st.puzzle.solution[r][c]).map(([r, c]) => [r, c, wrongFor(st.puzzle.solution[r][c])]);
        else if (p.kind === "scramble") {
            const was = targets.map(([r, c]) => st.letters[r][c]);
            let mixed = [...was].sort(() => Math.random() - 0.5);
            if (mixed.every((ch, i) => ch === was[i])) mixed = was.slice(1).concat(was[0]);
            sets = targets.map(([r, c], i) => [r, c, mixed[i]]).filter((x, i) => mixed[i] !== was[i]);
        }
        Game.setLetters(sets);
        Game.markBossChanges(before);
        U.restart(root, "rift-flash");
        FX.shake(p.kind === "judgment" ? 12 : 7, 400);
        targets.forEach(([r, c], i) => {
            const el = cellAt(r, c);
            setTimeout(() => {
                if (p.kind === "corrupt") tendril(el, "#b48cff"); else if (p.kind === "scramble") { if (el) el.animate([{ transform: "rotate(0)" }, { transform: "rotate(360deg) scale(.85)" }, { transform: "rotate(720deg)" }], { duration: 600, easing: "ease-in-out" }); } else shaft(el, p.kind === "judgment" ? 0.5 : 0.36);
                if (el) { const c2 = U.center(el); FX.burst({ x: c2.x, y: c2.y, n: 8, colors: p.kind === "corrupt" ? ["#6b3fd6", "#e3c8ff", "#1c1230"] : ["#fff6d8", "#ffd06b", "#ffffff"], shape: "star", speed: [60, 200], gravity: 100, life: [0.4, 0.8], size: [2, 4], glow: true }); }
            }, U.motion() === "still" ? 0 : i * (p.kind === "judgment" ? 50 : 110));
        });
        if (p.kind === "scramble") [[67, 0], [72, 0.15], [76, 0.3]].forEach(([n, t]) => Sound.tone({ t, f: 440 * Math.pow(2, (n - 69) / 12), type: "sawtooth", d: 0.25, v: 0.04, filt: { f: 2000 } }));
        else if (p.kind === "corrupt") Sound.tone({ f: 300, f2: 120, type: "sine", d: 0.7, v: 0.08, vib: 8 });
        else { Sound.tone({ f: 2400, f2: 600, type: "sine", d: 0.4, v: 0.05 }); Sound.tone({ f: 90, f2: 50, type: "sine", d: 0.6, v: 0.15 }); }
        add(LANDED, `${SPELL[p.kind].name} hit you · Click a marked square to put its letter back`);
    }
    // the eye: clicking it shuts out a glare
    bar.querySelector(".rw-eye").addEventListener("click", () => {
        if (!on()) return;
        const t = s.tricks.find(x => x.kind === "glare");
        if (t) { U.restart(bar.querySelector(".rw-eye"), "shut"); end(t, true); }
        else { U.restart(bar.querySelector(".rw-eye"), "cast"); say(U.pick(["Yes. Look at me.", "I see you, little writer.", "Mm. Keep watching."])); }
    });
    // a seal blocks typing in its square
    function sealed() { const st = g(); return s && s.tricks.some(t => t.kind === "seal" && t.r === st.row && t.c === st.col); }
    addEventListener("keydown", e => {
        if (!on() || e.ctrlKey || e.metaKey || e.altKey || !/^[a-zA-Z]$/.test(e.key)) return;
        if (e.target.closest && e.target.closest("input, select, textarea")) return;
        if (sealed()) { e.preventDefault(); e.stopPropagation(); const el = cellAt(g().row, g().col); if (el) U.restart(el, "shake"); note("Sealed: click the seal 3 times to break it", "bad"); }
    }, true);
    document.getElementById("keyboard").addEventListener("click", e => {
        const k = e.target.closest(".key");
        if (on() && k && /^[A-Z]$/.test(k.dataset.key) && sealed()) { e.stopPropagation(); note("Sealed: click the seal 3 times to break it", "bad"); }
    }, true);
    Bus.on("type", ({ row, col, letter }) => {
        if (!on() || !letter) return;
        const p = g().puzzle;
        const w = s.tricks.find(t => t.kind === "whisper" && t.r === row && t.c === col);
        if (w && letter === w.letter) { end(w, false); add(4, "You listened to the whisper"); say("Good. You listened."); return; }
        if (w) end(w, true);                                  // you typed your own letter over it
        if (letter !== p.solution[row][col]) add(WRONG);
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
            const d = s.tricks.find(t => t.kind === "dim");
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
            if (s.nextCast <= 0) { s.nextCast = EVERY[s.level - 1] * U.rand(0.8, 1.2); cast(); }
            s.nextSpell -= ds;
            if (s.nextSpell <= 0 && !s.pending) { s.nextSpell = SPELL_EVERY[s.level - 1] * U.rand(0.8, 1.2); windUp(); }
            s.seepAcc += ds;                                       // the fuller the meter, the faster it seeps
            if (s.seepAcc >= SEEP_SLOW + (SEEP_FAST - SEEP_SLOW) * (s.value / 100)) { s.seepAcc = 0; seep(); }
        }
        const now = performance.now();
        if (s && s.pending && now >= s.pending.at) land();
        for (const t of [...s.tricks]) if (now >= t.until) end(t, false);
        const d = s.tricks.find(t => t.kind === "dim");
        if (d) document.querySelector(".board-area").style.setProperty("--dim", Math.min(1, (now - d.from) / INFO.dim.ms).toFixed(3));
        tick++;
    }, 250);

    function start({ key, seed, level, par, entries, onLose, world = "rift" }) {
        // the same level again (you went to another screen and came back): carry on where it was
        if (s && !s.over && s.key === key && String(s.seed) === String(seed)) { s.onLose = onLose; s.lastSec = g().seconds; bar.hidden = false; root.classList.add("in-rift"); draw(); return; }
        stopQuiet();
        const saved = U.store.get(STORE, null);
        const keep = saved && saved.key === key && String(saved.seed) === String(seed) && !g().solved;
        s = { key, seed, level: U.clamp(level, 1, 4), value: keep ? saved.value : 0, peak: keep ? saved.peak : 0, rate: RATE_SHARE / Math.max(60, par), perWord: WORDS_SHARE / Math.max(4, entries),
            tricks: [], nextCast: 9, nextSpell: 16, seepAcc: 0, pending: null, lastSpell: null, lastSec: g().seconds, onLose, over: false, countered: 0, lastKind: null, warned: false, credited: new Set(), ready: false };
        const holder = bar.querySelector(".rw-angel");                  // (the secret world's own boss watches)
        if (holder.dataset.world !== world && typeof Bosses !== "undefined") { holder.innerHTML = Bosses.inner(world); holder.dataset.world = world; }
        bar.hidden = false;
        root.classList.add("in-rift");
        draw();
        say(keep ? "Back again? The rift remembers." : U.pick(["I'll take your words one by one.", "Let's see how long your light lasts.", "Write, little writer. I'm watching."]));
    }
    function stopQuiet() {
        if (s) fizzle(false);
        if (s) for (const t of [...s.tricks]) { t.done = true; FINISH[t.kind](t); }
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
        for (const t of [...s.tricks]) { t.done = true; FINISH[t.kind](t); }
        s.tricks = [];
        lastSave = 0; save();
        bar.hidden = true;
        root.classList.remove("in-rift", "rift-danger");
    }
    function lose() {
        if (!s || s.over) return;
        fizzle(false);
        s.over = true;
        for (const t of [...s.tricks]) { t.done = true; FINISH[t.kind](t); }
        s.tricks = [];
        U.store.set(STORE, null);
        say("At last. Your page is mine.");
        U.restart(root, "rift-flash");
        FX.shake(10, 500);
        const cb = s.onLose;
        setTimeout(() => cb && cb(), 600);
    }
    // the level is solved: the tear closes and the meter drains (returns the highest it got, for the results)
    function win() {
        if (!s) return 0;
        const peak = Math.round(s.peak);
        fizzle(false);
        for (const t of [...s.tricks]) { t.done = true; FINISH[t.kind](t); }
        s.tricks = []; s.over = true;
        U.store.set(STORE, null);
        bar.classList.add("sealed");
        say(U.pick(["No... the light holds.", "This isn't over.", "You only delay me."]));
        setTimeout(() => { bar.classList.remove("sealed"); stopQuiet(); }, 2600);
        return peak;
    }
    return { start, stop: stopAll, pause, win, get active() { return on(); }, get value() { return s ? s.value : 0 }, get peak() { return s ? s.peak : 0; } };
})();
