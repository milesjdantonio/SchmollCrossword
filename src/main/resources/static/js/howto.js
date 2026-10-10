// How to Play (built by Claude at the user's request, 2026-10-10): a short guide in two parts, Normal and Boss Fights,
// that works like a video (the user: "make the tutorial work through videos/animations"). Each topic is a chapter
// with its own little animation on a stage: a real board in the current world's colours, a pointer that clicks,
// keys that light up, subtitles. A chapter plays once and stops on its last frame with a Replay button (the user,
// 2026-10-10: no moving on by itself, and no check marks); Next, the arrow keys or the chapter list go to another.
// Click the stage (or press Space) to pause.
//
//   HowTo.open("normal" | "boss")
//
// Opened from the ? in the top bar, the campaign map and a boss's level sheet. Text goes in with textContent only.
// The animations are in DEMOS below; they're drawn with the game's own CSS classes (.board, .cell, .hit-mark...) on a
// 640x360 stage that's scaled to fit, and they run on their own clock, so pausing freezes them mid-move.

const HowTo = (() => {
    const W = 640, H = 360;
    const STOP = Symbol("stop");
    const test = { speed: 1, info: null };          // for automated tests: play faster, and see where the player is
    // a demo switched off part way leaves its helpers' promises rejected with STOP: that's expected, not an error
    addEventListener("unhandledrejection", e => { if (e.reason === STOP) e.preventDefault(); });

    // ---------------------------------------------------------------------------------------------
    // The demo puzzle: a real 5x5 grid of Easy words in the dailies' shape, with clues written for it
    // ---------------------------------------------------------------------------------------------
    const GRID = ["KIWI#", "INERT", "SNAKE", "SEVEN", "#REDS"];
    const CLUES = {
        across: { 1: "Fuzzy brown fruit", 5: "Not moving", 7: "Slithery reptile", 8: "Days in a week", 9: "Cherry and crimson" },
        down: { 1: "Peck on the cheek", 2: "On the inside", 3: "Make a basket, say", 4: "Annoyed", 6: "Ten-dollar bills" }
    };
    // the clue numbers and answers of any grid ("#" = black)
    function layout(grid) {
        const n = grid.length, open = (r, c) => r >= 0 && c >= 0 && r < n && c < n && grid[r][c] !== "#";
        const nums = grid.map(() => Array(n).fill(0)), entries = [];
        let k = 0;
        for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
            if (!open(r, c)) continue;
            const across = !open(r, c - 1) && open(r, c + 1), down = !open(r - 1, c) && open(r + 1, c);
            if (!across && !down) continue;
            nums[r][c] = ++k;
            for (const [dir, go] of [["across", across], ["down", down]]) {
                if (!go) continue;
                const cells = [];
                for (let i = 0; open(dir === "across" ? r : r + i, dir === "across" ? c + i : c); i++) cells.push(dir === "across" ? [r, c + i] : [r + i, c]);
                entries.push({ num: k, dir, cells, answer: cells.map(([a, b]) => grid[a][b]).join("") });
            }
        }
        return { nums, entries };
    }

    // which world's companion and boss to show: the world you're in (Classic has neither, so the Notebook's)
    const scene = () => {
        const w = Worlds.current && !Worlds.current.plain ? Worlds.current : Worlds.byId.paper;
        const bw = Bosses.list.includes(w.id) ? w.id : "paper";
        return { w, bw, boss: Bosses.info(bw), abilities: Powers.ABILITIES.filter(a => a.world === bw) };
    };

    // ---------------------------------------------------------------------------------------------
    // The stage kit: what every demo is drawn with. Everything runs on the run's own clock (run.t, in ms), so a pause
    // stops it exactly where it is, and switching chapters kills the run (its waits throw STOP).
    // ---------------------------------------------------------------------------------------------
    function makeRun(world, hooks = {}) {
        const run = { t: 0, dead: false, waits: [], tweens: [], frames: [] };
        const guard = p => { p.catch(() => {}); return p; };          // (a wait nobody awaits mustn't log an error when killed)
        run.step = dt => {
            run.t += dt;
            for (const f of run.frames.slice()) f(dt);
            for (const tw of run.tweens.slice()) {
                const k = Math.min(1, (run.t - tw.t0) / tw.d);
                tw.fn(tw.ease(k));
                if (k >= 1) { run.tweens.splice(run.tweens.indexOf(tw), 1); tw.ok(); }
            }
            for (const w of run.waits.slice()) if (run.t >= w.at) { run.waits.splice(run.waits.indexOf(w), 1); w.ok(); }
        };
        // an async helper the demo might not await (a wind-up still counting down when you pick another chapter)
        const safe = fn => (...a) => guard(fn(...a));
        run.kill = () => {
            run.dead = true;
            for (const w of [...run.waits, ...run.tweens]) w.no(STOP);
            run.waits = []; run.tweens = []; run.frames = [];
        };
        const s = {
            world, run,
            wait: ms => guard(new Promise((ok, no) => { if (run.dead) no(STOP); else run.waits.push({ at: run.t + ms, ok, no }); })),
            tween: (d, fn, ease = U.ease.inOutCubic) => guard(new Promise((ok, no) => { if (run.dead) return no(STOP); fn(0); run.tweens.push({ t0: run.t, d: Math.max(1, d), fn, ease, ok, no }); })),
            later(ms, fn) { s.wait(ms).then(fn, () => {}); },
            every(fn) { run.frames.push(fn); },
            // a piece on the stage: s.add("cls", { x, y, w, h, text, html }, parent)
            add(cls, o = {}, parent = world) {
                const el = U.el(o.tag || "div", { class: cls, text: o.text, html: o.html, ...(o.attrs || {}) });
                for (const k of ["x", "y", "w", "h"]) if (o[k] != null) el.style[{ x: "left", y: "top", w: "width", h: "height" }[k]] = o[k] + "px";
                if (o.x != null || o.y != null) el.style.position = "absolute";        // (placed inside another piece too)
                if (o.style) for (const [k, v] of Object.entries(o.style)) el.style.setProperty(k, v);
                parent.appendChild(el);
                return el;
            },
            // where something is, in stage units
            pos(el) {
                const wr = world.getBoundingClientRect(), r = el.getBoundingClientRect(), k = wr.width / W || 1;
                return { x: (r.left - wr.left + r.width / 2) / k, y: (r.top - wr.top + r.height / 2) / k, w: r.width / k, h: r.height / k };
            },
            pop(el, cls = "ht-pop") { U.restart(el, cls); },
            // subtitles, like a video's
            sub(text) {
                let el = world.querySelector(".ht-sub");
                if (!el) el = s.add("ht-sub");
                el.classList.remove("in");
                void el.offsetWidth;
                el.textContent = text;
                el.classList.add("in");
                if (hooks.onSub) hooks.onSub(text);
            },
            subSide(on) { world.classList.toggle("sub-side", on); },
            // a key on the keyboard lighting up
            key(label) {
                let row = world.querySelector(".ht-keys");
                if (!row) row = s.add("ht-keys");
                const k = s.add("ht-key" + (label.length > 1 ? " wide" : ""), { text: label }, row);
                s.later(900, () => { k.classList.add("out"); s.later(260, () => k.remove()); });
                return s.wait(120);
            },
            // a little text that floats up (points, "+1")
            float(text, x, y, tone = "") {
                const el = s.add("ht-float " + tone, { x, y, text });
                s.later(1300, () => el.remove());
            },
            // a burst of dots
            burst(x, y, color = "var(--accent)", n = 12) {
                for (let i = 0; i < n; i++) {
                    const a = (i / n) * Math.PI * 2, d = 26 + (i % 3) * 10;
                    const el = s.add("ht-dot", { x, y, style: { "--dx": (Math.cos(a) * d).toFixed(1) + "px", "--dy": (Math.sin(a) * d).toFixed(1) + "px", "--c": color } });
                    s.later(700, () => el.remove());
                }
            },
            // a banner across the middle ("Phase 2", "You Win")
            banner: safe(async (text, tone = "", ms = 1300) => {
                const el = s.add("ht-banner " + tone, { text });
                await s.wait(ms);
                el.classList.add("out");
                s.later(300, () => el.remove());
            })
        };
        // the pointer (a mouse arrow) and, on the phone, a finger
        const pointer = kind => {
            let el = null, x = W * 0.75, y = H * 0.85;
            const place = () => { el.style.left = x + "px"; el.style.top = y + "px"; };
            const p = {
                show(nx = x, ny = y) {
                    if (!el) el = s.add(kind === "finger" ? "ht-finger" : "ht-cursor", { html: kind === "finger" ? "" : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 2.5v17.2l4.6-4.3 3 6.6 3.1-1.4-3-6.5h6.3z"/></svg>' });
                    x = nx; y = ny; place(); el.classList.add("on");
                    return p;
                },
                hide() { if (el) el.classList.remove("on"); },
                async to(target, ms = 650) {
                    if (!el) p.show();
                    const t = target.nodeType ? s.pos(target) : target, x0 = x, y0 = y;
                    const bend = (Math.random() - 0.5) * 60;
                    await s.tween(ms, k => { x = U.lerp(x0, t.x, k) + Math.sin(k * Math.PI) * bend * 0.3; y = U.lerp(y0, t.y, k) - Math.sin(k * Math.PI) * Math.abs(bend) * 0.25; place(); });
                },
                async click(target) {
                    if (target) await p.to(target);
                    el.classList.add("press");
                    const ring = s.add("ht-ripple", { x, y });
                    s.later(500, () => ring.remove());
                    await s.wait(140);
                    el.classList.remove("press");
                    await s.wait(80);
                },
                get x() { return x; }, get y() { return y; }
            };
            return p;
        };
        s.cursor = pointer("mouse");
        s.finger = pointer("finger");

        // ---- a crossword board, drawn with the game's own classes ----
        s.board = ({ x, y, cell = 46, grid = GRID, parent = world, nums = true, cls = "" } = {}) => {
            const n = grid.length, { nums: numbers, entries } = layout(grid);
            const el = s.add("board ht-board " + cls, { x, y, w: n * cell + (n + 1) * 2, h: n * cell + (n + 1) * 2, style: { "--size": String(n), "--hc": cell + "px" } }, parent);
            const cells = [], letters = grid.map(row => [...row].map(() => ""));
            for (let r = 0; r < n; r++) {
                cells.push([]);
                for (let c = 0; c < n; c++) {
                    const block = grid[r][c] === "#";
                    const d = U.el("div", { class: "cell" + (block ? " block" : "") });
                    if (!block) { if (nums && numbers[r][c]) d.append(U.el("span", { class: "num", text: String(numbers[r][c]) })); d.append(U.el("span", { class: "ltr" })); }
                    el.appendChild(d);
                    cells[r].push(d);
                }
            }
            const b = {
                el, cells, entries, letters, sel: null, onSelect: null,
                entry: (dir, num) => entries.find(e => e.dir === dir && e.num === num),
                at: (r, c, dir) => entries.find(e => e.dir === dir && e.cells.some(([a, bb]) => a === r && bb === c)),
                cell: (r, c) => cells[r][c],
                center: (r, c) => s.pos(cells[r][c]),
                select(r, c, dir = "across") {
                    const e = b.at(r, c, dir) || b.at(r, c, dir === "across" ? "down" : "across");
                    for (const row of cells) for (const d of row) d.classList.remove("selected", "in-word");
                    if (!e) return;
                    for (const [a, bb] of e.cells) cells[a][bb].classList.add("in-word");
                    cells[r][c].classList.add("selected");
                    el.dataset.dir = e.dir;
                    b.sel = { r, c, e };
                    if (b.onSelect) b.onSelect(e);
                },
                unselect() { for (const row of cells) for (const d of row) d.classList.remove("selected", "in-word"); b.sel = null; if (b.onSelect) b.onSelect(null); },
                type(r, c, ch) {
                    letters[r][c] = ch;
                    const l = cells[r][c].querySelector(".ltr");
                    l.textContent = ch;
                    cells[r][c].classList.remove("wrong");
                    if (ch) U.restart(cells[r][c], "typed");
                    if (b.onType) b.onType();
                },
                fill(list) { for (const e of list) e.cells.forEach(([r, c], i) => b.type(r, c, e.answer[i])); },
                // type a word in, a letter at a time, the selection moving along like the real game
                async typeWord(e, { ms = 150, keys = true, from = 0, wrong = null } = {}) {
                    for (let i = from; i < e.cells.length; i++) {
                        const [r, c] = e.cells[i];
                        b.select(r, c, e.dir);
                        const ch = wrong && wrong[i] ? wrong[i] : e.answer[i];
                        if (keys) await s.key(ch);
                        b.type(r, c, ch);
                        await s.wait(ms);
                    }
                    const done = e.cells.every(([r, c]) => letters[r][c] === grid[r][c]);
                    if (done) b.wave(e);
                    const next = e.cells[Math.min(e.cells.length - 1, e.cells.length)];
                    if (next) b.select(next[0], next[1], e.dir);
                    return done;
                },
                wave(e) { e.cells.forEach(([r, c], i) => s.later(i * 50, () => U.restart(cells[r][c], "wave"))); },
                mark(r, c, cls, on = true) { cells[r][c].classList.toggle(cls, on); },
                full: () => entries.every(e => e.cells.every(([r, c]) => letters[r][c] === grid[r][c])),
                async solve() {
                    b.unselect();
                    el.classList.add("solved");
                    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) s.later((r + c) * 60, () => U.restart(cells[r][c], "wave"));
                    await s.wait(400);
                },
                pct() { let right = 0, all = 0; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (grid[r][c] !== "#") { all++; if (letters[r][c] === grid[r][c]) right++; } return right / all; }
            };
            return b;
        };
        // the clue bar over a board, following its selection
        s.clueBar = (b, { x, y, w, clues = CLUES }) => {
            const el = s.add("ht-cluebar", { x, y, w });
            const num = U.el("b"), text = U.el("span");
            el.append(num, text);
            const prev = b.onSelect;
            b.onSelect = e => {
                if (prev) prev(e);
                num.textContent = e ? e.num + (e.dir === "across" ? "A" : "D") : "";
                text.textContent = e ? (clues[e.dir] || {})[e.num] || "" : "";
            };
            return el;
        };
        // the Across and Down lists, following the selection, crossing off finished answers
        s.clueList = (b, { x, y, w, clues = CLUES }) => {
            const el = s.add("ht-clues", { x, y, w });
            const items = {};
            for (const dir of ["across", "down"]) {
                el.appendChild(U.el("h4", { text: dir === "across" ? "Across" : "Down" }));
                const ol = U.el("ol");
                for (const e of b.entries.filter(x => x.dir === dir)) {
                    const li = U.el("li", {}, U.el("b", { text: String(e.num) }), U.el("span", { text: clues[dir][e.num] || "" }));
                    items[dir + e.num] = li;
                    ol.appendChild(li);
                }
                el.appendChild(ol);
            }
            const prev = b.onSelect;
            b.onSelect = e => {
                if (prev) prev(e);
                for (const [k, li] of Object.entries(items)) li.classList.toggle("on", !!e && k === e.dir + e.num);
            };
            b.onType = () => { for (const e of b.entries) items[e.dir + e.num].classList.toggle("done", e.cells.every(([r, c]) => b.letters[r][c] === GRID[r][c])); };
            return { el, li: (dir, num) => items[dir + num] };
        };
        // the companion's face (the world's mascot) on a little canvas
        s.face = (wid, size, mood = "happy", parent = world, o = {}) => {
            const cv = s.add("ht-face", { tag: "canvas", attrs: { width: 112, height: 112 }, w: size, h: size, x: o.x, y: o.y }, parent);
            const w = Worlds.byId[wid], g = cv.getContext("2d");
            g.setTransform(112 / 160, 0, 0, 112 / 160, 0, 0);
            if (w && w.mascot) { try { w.mascot.draw(g, { t: 0.4, blink: 0, mood, talk: 0, excite: mood === "happy" ? 0.6 : 0, hop: 0, look: 0.4 }); } catch (err) { /* a face that can't draw stays empty */ } }
            return cv;
        };
        s.bossArt = (bw, cls = "", parent = world, o = {}) => s.add("ht-boss " + cls, { html: Bosses.svg(bw), ...o }, parent);
        // the race bar across the top: you and your companion on the left, the boss on the right
        s.race = ({ x = 20, y = 8, w = 600 } = {}) => {
            const sc = scene();
            const el = s.add("ht-race", { x, y, w });
            const me = s.add("ht-rside me", {}, el);
            s.face(sc.w.id, 34, "happy", me);
            const mePct = s.add("ht-rpct", { text: "0%" }, me);
            const track = s.add("ht-rtrack", {}, el);
            const fillMe = s.add("ht-rfill me", {}, track), fillBoss = s.add("ht-rfill boss", {}, track);
            const lead = s.add("ht-rlead", { text: "Neck and Neck" }, track);
            const bossSide = s.add("ht-rside boss", {}, el);
            const bossPct = s.add("ht-rpct", { text: "0%" }, bossSide);
            s.bossArt(sc.bw, "", bossSide);
            el.style.setProperty("--boss", sc.boss.color);
            const r = {
                el, me: 0, boss: 0,
                set(m = r.me, bo = r.boss) {
                    r.me = m; r.boss = bo;
                    fillMe.style.width = (m * 50).toFixed(1) + "%";
                    fillBoss.style.width = (bo * 50).toFixed(1) + "%";
                    mePct.textContent = Math.round(m * 100) + "%";
                    bossPct.textContent = Math.round(bo * 100) + "%";
                    const k = Math.round((m - bo) * 100);
                    lead.textContent = Math.abs(k) < 3 ? "Neck and Neck" : k > 0 ? `You're Ahead by ${k}%` : `The Boss Is Ahead by ${-k}%`;
                    el.classList.toggle("danger", bo >= 0.85);
                },
                to(m, bo, ms = 600) { const m0 = r.me, b0 = r.boss; return s.tween(ms, k => r.set(U.lerp(m0, m, k), U.lerp(b0, bo, k))); }
            };
            r.set(0, 0);
            return r;
        };
        // the warning box under the race bar: a wind-up with its countdown, or a notice
        s.warn = ({ x = 170, y = 66, w = 300 } = {}) => {
            const el = s.add("ht-warn", { x, y, w });
            el.hidden = true;
            const head = U.el("b"), sub = U.el("small"), bar = U.el("i");
            el.append(head, sub, bar);
            const box = {
                el,
                show(title, text = "", tone = "") { el.hidden = false; el.dataset.tone = tone; head.textContent = title; sub.textContent = text; bar.style.width = "0"; s.pop(el); },
                windup: safe(async (name, text, ms) => {
                    box.show("⚠ " + name + " Incoming", text, "bad");
                    const t0 = s.run.t;
                    let cancelled = false;
                    box.cancel = () => { cancelled = true; };
                    while (!cancelled && s.run.t - t0 < ms) {
                        const left = Math.max(0, ms - (s.run.t - t0));
                        head.textContent = `⚠ ${name} Incoming ${(left / 1000).toFixed(1)}s`;
                        bar.style.width = (left / ms * 100).toFixed(1) + "%";
                        await s.wait(50);
                    }
                    bar.style.width = "0";
                    return !cancelled;
                }),
                hide() { el.hidden = true; }
            };
            return box;
        };
        // the ability cards: icon, name, uses and key
        s.abilityBar = (list, { x, y, w = 330 }) => {
            const el = s.add("ht-abil", { x, y, w });
            const cards = list.map((a, i) => {
                const c = s.add("ht-acard", {}, el);
                c.append(U.el("span", { class: "ht-aic", text: a.icon }), U.el("b", { text: a.name }), U.el("small", { text: `×3 · Key ${i + 1}` }));
                c._uses = 3; c._i = i;
                return c;
            });
            return {
                el, cards,
                async use(i) {
                    const c = cards[i];
                    await s.key(String(i + 1));
                    c._uses = Math.max(0, c._uses - 1);
                    c.querySelector("small").textContent = `×${c._uses} · Key ${i + 1}`;
                    s.pop(c, "ht-flash");
                    const p = s.pos(c);
                    s.burst(p.x, p.y - 10, "var(--accent)", 10);
                },
                refill() { for (const c of cards) { c._uses = 3; c.querySelector("small").textContent = `×3 · Key ${c._i + 1}`; s.pop(c, "ht-flash"); const p = s.pos(c); s.burst(p.x, p.y, "var(--good)", 8); } }
            };
        };
        // a thing flying from one place to another (an ability at the boss, a countered attack)
        s.fly = safe(async (text, from, to, ms = 600) => {
            const el = s.add("ht-proj", { text, x: from.x, y: from.y });
            await s.tween(ms, k => { el.style.left = U.lerp(from.x, to.x, k) + "px"; el.style.top = (U.lerp(from.y, to.y, k) - Math.sin(k * Math.PI) * 50) + "px"; el.style.transform = `translate(-50%, -50%) rotate(${k * 360}deg)`; }, U.ease.inOutSine);
            el.remove();
            s.burst(to.x, to.y, "var(--accent)", 14);
        });
        // the boss's own board on its panel, as little squares that fill in
        s.bossBoard = (parent, { n = 5, cell = 16 } = {}) => {
            const el = s.add("ht-bboard", { style: { "--n": String(n), "--bc": cell + "px" } }, parent);
            const cells = [];
            for (let i = 0; i < n * n; i++) cells.push(s.add("ht-bcell" + ((i === n - 1 || i === n * (n - 1)) ? " block" : ""), {}, el));
            const open = cells.filter(c => !c.classList.contains("block"));
            return {
                el, open,
                set(k) { const m = Math.round(k * open.length); open.forEach((c, i) => c.classList.toggle("on", i < m)); },
                knock(m) { const on = open.filter(c => c.classList.contains("on")); for (const c of on.slice(-m)) { c.classList.remove("on"); s.pop(c, "ht-shake"); } }
            };
        };
        return s;
    }

    // ---------------------------------------------------------------------------------------------
    // The chapters: a title, the text under the stage, and the animation
    // ---------------------------------------------------------------------------------------------
    const ACROSS = n => b => b.entry("across", n);
    const NORMAL = [
        {
            title: "The Goal", len: 8800, text: "Fill the grid so every Across and Down answer is right. A clue's number shows where its answer starts.",
            async demo(s) {
                const b = s.board({ x: 40, y: 62 });
                s.clueBar(b, { x: 40, y: 12, w: 242 });
                const list = s.clueList(b, { x: 318, y: 12, w: 290 });
                await s.wait(300);
                s.sub("Every clue has a number");
                s.pop(list.li("across", 1), "ht-flash");
                await s.wait(1100);
                s.sub("Its answer starts on the square with that number");
                s.pop(b.cell(0, 0), "ht-flash");
                b.select(0, 0, "across");
                await s.wait(1200);
                await b.typeWord(b.entry("across", 1), { ms: 160 });
                await s.wait(300);
                s.sub("Fill in every answer, Across and Down");
                for (const n of [5, 7, 8, 9]) await b.typeWord(b.entry("across", n), { ms: 60, keys: false });
                await s.wait(250);
                s.sub("Every square right and you've solved it");
                await b.solve();
                const stamp = s.add("ht-stamp", { x: 161, y: 183, text: "Solved · 0:58" });
                s.pop(stamp);
                await s.wait(2000);
            }
        },
        {
            title: "Moving Around", len: 14100, text: "Click a square to select it. Click it again, or press Space, to switch between Across and Down. The arrow keys move, Tab and Enter jump to the next clue, and Backspace deletes. Clicking a clue jumps to its answer.",
            async demo(s) {
                const b = s.board({ x: 40, y: 62 });
                s.clueBar(b, { x: 40, y: 12, w: 242 });
                const list = s.clueList(b, { x: 318, y: 12, w: 290 });
                b.fill([ACROSS(1)(b)]);
                s.cursor.show(470, 330);
                await s.wait(300);
                s.sub("Click a square to select it");
                await s.cursor.click(b.cell(2, 1));
                b.select(2, 1, "across");
                await s.wait(1300);
                s.sub("Click it again to switch between Across and Down");
                await s.cursor.click();
                b.select(2, 1, "down");
                await s.wait(1400);
                s.sub("Or press Space");
                await s.key("Space");
                b.select(2, 1, "across");
                await s.wait(1200);
                s.sub("The arrow keys move");
                await s.key("→"); b.select(2, 2, "across"); await s.wait(420);
                await s.key("→"); b.select(2, 3, "across"); await s.wait(900);
                s.sub("Tab jumps to the next clue");
                await s.key("Tab"); b.select(3, 0, "across"); await s.wait(1300);
                s.sub("Click a clue to jump to its answer");
                await s.cursor.click(list.li("down", 4));
                b.select(1, 3, "down");
                await s.wait(1000);
                s.sub("Type, and Backspace deletes");
                await s.key("Q"); b.type(1, 3, "Q"); b.select(2, 3, "down"); await s.wait(500);
                await s.key("⌫"); b.type(1, 3, ""); b.select(1, 3, "down"); await s.wait(400);
                await b.typeWord(b.entry("down", 4), { ms: 130, from: 1 });
                await s.wait(1200);
            }
        },
        {
            title: "On a Phone", len: 15500, text: "Use the keyboard under the board. ⇄ switches between Across and Down, and the arrows beside the clue step through the clues.",
            async demo(s) {
                s.subSide(true);
                const phone = s.add("ht-phone", { x: 70, y: 8, w: 196, h: 344 });
                const bar = s.add("ht-pbar", {}, phone);
                const prevBtn = s.add("ht-parrow", { text: "‹" }, bar), cb = s.add("ht-pclue", {}, bar), nextBtn = s.add("ht-parrow", { text: "›" }, bar);
                const b = s.board({ x: 16, y: 58, cell: 30, parent: phone });
                b.onSelect = e => { cb.textContent = e ? `${e.num}${e.dir === "across" ? "A" : "D"} ${CLUES[e.dir][e.num]}` : ""; };
                b.fill([ACROSS(1)(b), ACROSS(5)(b)]);
                const kb = s.add("ht-pkeys", {}, phone), keys = {};
                for (const row of ["QWERTYUIOP", "ASDFGHJKL", "⇄ZXCVBNM⌫"]) {
                    const r = s.add("ht-prow", {}, kb);
                    for (const ch of row) keys[ch] = s.add("ht-pkey" + (ch === "⇄" || ch === "⌫" ? " wide" : ""), { text: ch }, r);
                }
                const tap = async el => { await s.finger.click(el); s.pop(el, "ht-tap"); };
                s.finger.show(330, 300);
                await s.wait(300);
                s.sub("Tap a square");
                await tap(b.cell(2, 0));
                b.select(2, 0, "across");
                await s.wait(800);
                s.sub("Then type on the keyboard under the board");
                const e = ACROSS(7)(b);
                for (let i = 0; i < 5; i++) { await tap(keys[e.answer[i]]); b.type(...e.cells[i], e.answer[i]); if (i < 4) b.select(...e.cells[i + 1], "across"); }
                b.wave(e);
                await s.wait(700);
                s.sub("⇄ switches between Across and Down");
                await tap(keys["⇄"]);
                b.select(2, 4, "down");
                await s.wait(1300);
                s.sub("The arrows by the clue step through the clues");
                await tap(nextBtn); b.select(3, 0, "across"); await s.wait(700);
                await tap(nextBtn); b.select(4, 1, "across"); await s.wait(700);
                await tap(prevBtn); b.select(3, 0, "across"); await s.wait(1300);
                s.finger.hide();
            }
        },
        {
            title: "Check and Reveal", len: 11000, text: "Check a square, a word or the whole puzzle: wrong letters turn red and right ones lock. Reveal fills letters in. Check costs 5 points a square and Reveal 10. Revealing the whole puzzle counts as giving up.",
            async demo(s) {
                const b = s.board({ x: 40, y: 62 });
                s.clueBar(b, { x: 40, y: 12, w: 242 });
                b.fill([ACROSS(1)(b), ACROSS(5)(b)]);
                const snake = ACROSS(7)(b);
                ["S", "N", "A", "K", "Y"].forEach((ch, i) => b.type(...snake.cells[i], ch));
                const panel = s.add("ht-helpers", { x: 318, y: 70, w: 290 });
                const btn = {};
                for (const act of ["Check", "Reveal"]) {
                    const row = s.add("ht-hrow", {}, panel);
                    s.add("ht-hlabel", { text: act }, row);
                    for (const scope of ["Square", "Word", "Puzzle"]) btn[act + scope] = s.add("ht-hbtn", { tag: "button", text: scope, attrs: { type: "button", tabindex: "-1" } }, row);
                }
                const pen = s.add("ht-penalty", { x: 318, y: 186, w: 290 });
                pen.append(U.el("small", { text: "Points Lost" }), U.el("b", { text: "0" }));
                const lost = v => { pen.querySelector("b").textContent = v ? "−" + v : "0"; s.pop(pen, "ht-flash"); };
                b.select(2, 0, "across");
                s.cursor.show(470, 330);
                await s.wait(400);
                s.sub("Check a square, a word or the whole puzzle");
                await s.cursor.click(btn.CheckWord);
                snake.cells.forEach(([r, c], i) => s.later(i * 70, () => {
                    if (i === 4) { b.mark(r, c, "wrong"); U.restart(b.cell(r, c), "shake"); }
                    else { b.mark(r, c, "locked"); U.restart(b.cell(r, c), "lock-in"); }
                }));
                await s.wait(500);
                lost(25);
                const p = s.pos(pen);
                s.float("−25", p.x + 60, p.y - 20, "bad");
                s.sub("Wrong letters turn red. Right ones lock");
                await s.wait(1700);
                s.sub("Fix it and keep going");
                b.select(2, 4, "across");
                await s.key("E");
                b.mark(2, 4, "wrong", false);
                b.type(2, 4, "E");
                b.wave(snake);
                await s.wait(1000);
                s.sub("Reveal fills a letter in, for 10 points a square");
                b.select(3, 0, "across");
                await s.cursor.click(btn.RevealSquare);
                b.type(3, 0, "S");
                b.mark(3, 0, "revealed");
                U.restart(b.cell(3, 0), "flip");
                lost(35);
                s.float("−10", p.x + 60, p.y - 20, "bad");
                await s.wait(1600);
                s.sub("Revealing the whole puzzle counts as giving up");
                await s.cursor.to(btn.RevealPuzzle);
                const ask = s.add("ht-ask", { x: 330, y: 238, w: 270 });
                ask.append(U.el("b", { text: "Reveal the Whole Puzzle?" }), U.el("small", { text: "This counts as giving up: 0 points." }));
                s.pop(ask);
                await s.wait(1900);
                await s.cursor.to({ x: 560, y: 330 });
                ask.remove();
                await s.wait(400);
            }
        },
        {
            title: "Five Dailies", len: 8300, text: "Easy, Medium, Hard, a bigger Challenge grid and the Boss. Everyone gets the same puzzles, and they change at your midnight. Solve any one of them to keep your streak.",
            async demo(s) {
                const sc = scene();
                const row = s.add("ht-chips", { x: 30, y: 70, w: 580 });
                const chips = ["Easy", "Medium", "Hard", "Challenge", "Boss"].map((name, i) => {
                    const c = s.add("ht-chip" + (i === 3 ? " challenge" : i === 4 ? " boss" : ""), {}, row);
                    if (i === 4) s.bossArt(sc.bw, "", c);
                    c.append(U.el("b", { text: name }), U.el("small", { text: "Play" }));
                    c.style.opacity = "0";
                    return c;
                });
                const clock = s.add("ht-clock", { x: 470, y: 18, text: "11:59 PM" });
                const streak = s.add("ht-streak", { x: 220, y: 200, w: 200 });
                const num = U.el("b", { text: "4" });
                streak.append(U.el("span", { class: "ht-flame", text: "🔥" }), num, U.el("small", { text: "Day Streak" }));
                await s.wait(200);
                s.sub("Five new puzzles every day");
                for (const c of chips) { c.style.opacity = ""; s.pop(c); await s.wait(170); }
                await s.wait(900);
                s.sub("Everyone gets the same ones");
                await s.wait(1400);
                s.sub("Solve any one to keep your streak");
                chips[1].classList.add("done");
                chips[1].querySelector("small").textContent = "✓ 180 pts";
                s.pop(chips[1]);
                await s.wait(500);
                num.textContent = "5";
                s.pop(streak);
                const sp = s.pos(streak);
                s.burst(sp.x - 60, sp.y, "var(--fire-2)", 14);
                await s.wait(1500);
                s.sub("New ones arrive at your midnight");
                clock.textContent = "12:00 AM";
                s.pop(clock);
                await s.wait(400);
                for (const c of chips) { c.classList.remove("done"); c.querySelector("small").textContent = "Play"; s.pop(c, "ht-flip"); await s.wait(90); }
                await s.wait(1600);
            }
        },
        {
            title: "Points", len: 10800, text: "Easy 100, Medium 150, Hard 200 and Challenge 300, plus a speed bonus that shrinks every minute. Only your first solve of each daily counts. Unlimited is for practice, so it has no points.",
            async demo(s) {
                const tiers = s.add("ht-tiers", { x: 40, y: 22, w: 560 });
                const tierEls = [["Easy", 100], ["Medium", 150], ["Hard", 200], ["Challenge", 300]].map(([n, p]) => { const t = s.add("ht-tier", {}, tiers); t.append(U.el("small", { text: n }), U.el("b", { text: String(p) })); return t; });
                s.sub("Each daily has its own points");
                for (const t of tierEls) { s.pop(t); await s.wait(220); }
                await s.wait(800);
                tierEls[1].classList.add("on");
                const card = s.add("ht-score", { x: 170, y: 110, w: 300 });
                const rows = {};
                for (const [k, label] of [["base", "Medium"], ["time", "Time"], ["bonus", "Speed Bonus"], ["check", "Check"], ["total", "Total"]]) {
                    const r = s.add("ht-srow " + k, {}, card);
                    r.append(U.el("span", { text: label }), rows[k] = U.el("b", { text: "" }));
                    if (k === "check") r.style.opacity = "0";
                }
                rows.base.textContent = "150"; rows.time.textContent = "0:00"; rows.bonus.textContent = "+100"; rows.total.textContent = "250";
                s.sub("Plus a speed bonus that shrinks every minute");
                let shown = 100;
                await s.tween(3600, k => {
                    const sec = Math.round(k * 160);
                    rows.time.textContent = U.fmtTime(sec);
                    const bonus = 100 - 10 * Math.floor(sec / 60);
                    if (bonus !== shown) { shown = bonus; s.pop(rows.bonus.parentNode, "ht-flash"); }
                    rows.bonus.textContent = "+" + bonus;
                    rows.total.textContent = String(150 + bonus);
                }, k => k);
                await s.wait(500);
                s.sub("Check and Reveal cost points");
                rows.check.parentNode.style.opacity = "";
                rows.check.textContent = "−10";
                s.pop(rows.check.parentNode);
                rows.total.textContent = "220";
                s.pop(rows.total.parentNode, "ht-flash");
                await s.wait(1500);
                s.sub("Only your first solve of each daily counts");
                await s.wait(1500);
                const un = s.add("ht-tag", { x: 236, y: 296, text: "Unlimited · Practice, No Points" });
                s.pop(un);
                await s.wait(1600);
            }
        },
        {
            title: "World Leaderboard", len: 8400, text: "Post your day's total under your first name and last initial. The server works out the points itself.",
            async demo(s) {
                const list = s.add("ht-lb", { x: 150, y: 14, w: 340 });
                const people = [["Ava R.", 640], ["Ben K.", 590], ["Cleo M.", 505], ["Dev S.", 470], ["Eli T.", 410]];
                const rowOf = (rank, name, pts, me) => { const r = s.add("ht-lbrow" + (me ? " me" : ""), {}, list); r.append(U.el("i", { text: String(rank) }), U.el("span", { text: name }), U.el("b", { text: pts + " pts" })); return r; };
                const rows = people.map(([n, p], i) => rowOf(i + 1, n, p));
                const form = s.add("ht-lbform", { x: 150, y: 232, w: 340 });
                const first = s.add("ht-input", { text: "" }, form), init = s.add("ht-input small", { text: "" }, form), post = s.add("ht-post", { tag: "button", text: "Post", attrs: { type: "button", tabindex: "-1" } }, form);
                first.dataset.ph = "First name"; init.dataset.ph = "L";
                s.cursor.show(560, 320);
                await s.wait(300);
                s.sub("Post your day's total to the World Leaderboard");
                await s.cursor.click(first);
                first.classList.add("on");
                for (const ch of "Sam") { first.textContent += ch; await s.wait(150); }
                first.classList.remove("on");
                await s.cursor.click(init);
                init.classList.add("on");
                init.textContent = "P";
                await s.wait(400);
                init.classList.remove("on");
                s.sub("Just your first name and last initial");
                await s.cursor.click(post);
                s.pop(post, "ht-flash");
                await s.wait(400);
                // your row slides in at third
                const mine = rowOf(3, "Sam P.", 530, true);
                list.insertBefore(mine, rows[2]);
                rows.slice(2).forEach((r, i) => { r.querySelector("i").textContent = String(i + 4); });
                rows[4].classList.add("gone");
                s.pop(mine, "ht-slide");
                s.cursor.hide();
                await s.wait(1700);
                s.sub("The server works out the points itself");
                await s.wait(2000);
            }
        },
        {
            title: "The Campaign", len: 8400, text: "Fifteen worlds with five levels each. Every level practises a skill and earns up to three stars, and the fifth is a boss. Coins buy items and ability uses in the shop.",
            async demo(s) {
                const sc = scene();
                const map = s.add("ht-map", { x: 0, y: 0, w: W, h: H });
                const path = U.svg("svg", { class: "ht-path", viewBox: `0 0 ${W} ${H}` });
                U.svg("path", { d: "M70 280 C 150 280, 150 170, 230 170 S 330 280, 400 230 S 480 90, 560 110" }, path);
                map.appendChild(path);
                const spots = [[70, 280], [230, 170], [330, 232], [445, 175], [560, 110]];
                const skills = ["Definitions", "Plurals", "Crossings", "Speed"];
                const nodes = spots.map(([x, y], i) => {
                    const n = s.add("ht-node" + (i === 4 ? " boss" : ""), { x, y }, map);
                    if (i === 4) s.bossArt(sc.bw, "", n); else n.textContent = String(i + 1);
                    return n;
                });
                const coins = s.add("ht-coins", { x: 24, y: 18, text: "🪙 120" });
                const token = s.face(sc.w.id, 46, "happy", map, { x: spots[0][0], y: spots[0][1] - 40 });
                token.classList.add("ht-token");
                await s.wait(300);
                s.sub("Fifteen worlds, five levels each");
                await s.wait(1400);
                s.sub("Each level practises a skill and earns up to three stars");
                let c = 120;
                for (let i = 0; i < 4; i++) {
                    const [x, y] = spots[i], stars = [3, 2, 3, 1][i];
                    const lab = s.add("ht-skill", { x, y: y + 30, text: skills[i] }, map);
                    s.pop(lab);
                    const st = s.add("ht-stars", { x, y: y - 74, text: "★".repeat(stars) + "☆".repeat(3 - stars) }, map);
                    s.pop(st);
                    nodes[i].classList.add("done");
                    c += 20; coins.textContent = "🪙 " + c; s.pop(coins, "ht-flash");
                    await s.wait(500);
                    const [nx, ny] = spots[i + 1];
                    await s.tween(560, k => { token.style.left = U.lerp(x, nx, k) + "px"; token.style.top = (U.lerp(y, ny, k) - 40 - Math.sin(k * Math.PI) * 40) + "px"; });
                    if (i === 1) s.sub("Coins buy items and ability uses in the shop");
                }
                s.sub("The fifth level is a boss");
                s.pop(nodes[4], "ht-shake");
                const bp = s.pos(nodes[4]);
                s.burst(bp.x, bp.y, sc.boss.color, 16);
                await s.wait(2000);
            }
        },
        {
            title: "Worlds", len: 10300, text: "Pick a world with its button at the top, next to Settings, or in Settings. Each one has its own look, sounds and animations, in light and dark.",
            async demo(s) {
                const tools = s.add("ht-tools", { x: 452, y: 14 });
                const q = s.add("ht-tool", { text: "?" }, tools), globe = s.add("ht-tool", { text: Worlds.current.icon || "🌍" }, tools);
                s.add("ht-tool", { text: "🔊" }, tools);
                const frame = s.add("ht-preview", { x: 128, y: 58, w: 384, h: 216 });
                frame.style.opacity = "0";
                const cv = s.add("", { tag: "canvas", attrs: { width: 768, height: 432 } }, frame);
                const name = s.add("ht-pname", {}, frame);
                const mode = s.add("ht-mode", { x: 262, y: 282 }, s.world);
                const light = s.add("", { tag: "span", text: "☀ Light" }, mode), dark = s.add("", { tag: "span", text: "☾ Dark" }, mode);
                let anim = null;
                const show = (id, theme) => {
                    try { anim = Worlds.preview(cv, id, theme); } catch (err) { anim = null; }
                    const w = Worlds.byId[id];
                    name.textContent = (w.icon ? w.icon + " " : "") + w.name;
                    light.classList.toggle("on", theme === "light"); dark.classList.toggle("on", theme === "dark");
                    s.pop(frame, "ht-fade");
                };
                s.every(dt => { if (anim && U.motion() !== "still") anim.step(Math.min(0.05, dt / 1000)); });
                s.cursor.show(560, 320);
                await s.wait(300);
                s.sub("Pick a world with its button at the top");
                await s.cursor.click(globe);
                frame.style.opacity = "";
                const ids = [Worlds.current.plain ? "garden" : Worlds.current.id, ...["space", "candy", "rain", "volcano"].filter(id => id !== Worlds.current.id)].slice(0, 4);
                show(ids[0], "light");
                s.cursor.hide();
                await s.wait(1300);
                s.sub("Each has its own look, sounds and animations");
                for (const id of ids.slice(1)) { await s.wait(1250); show(id, Worlds.byId[id].modes.includes("light") ? "light" : "dark"); }
                await s.wait(1300);
                s.sub("In light and dark");
                const last = ids.find(id => Worlds.byId[id].modes.length > 1) || ids[0];
                show(last, "light");
                await s.wait(900);
                show(last, "dark");
                await s.wait(1600);
                void q;
            }
        },
        {
            title: "Sound", len: 9600, text: "The speaker at the top opens every sound option: all sound on or off, the volume, the boss music and its volume, the sound effects, the bosses' attacks and your abilities, typing and clicks. Settings has the same ones.",
            async demo(s) {
                const tools = s.add("ht-tools", { x: 452, y: 14 });
                s.add("ht-tool", { text: "?" }, tools); s.add("ht-tool", { text: Worlds.current.icon || "🌍" }, tools);
                const spk = s.add("ht-tool", { text: "🔊" }, tools);
                const menu = s.add("ht-sound", { x: 330, y: 62, w: 280 });
                menu.style.opacity = "0";
                const rows = {};
                const sw = (key, label, on = true) => { const r = s.add("ht-srow2", {}, menu); r.append(U.el("i", { class: "ht-switch" + (on ? " on" : "") }), U.el("span", { text: label })); rows[key] = r; return r; };
                const sl = (key, label, v) => {
                    const r = s.add("ht-slider", {}, menu);
                    const out = U.el("b", { text: v + "%" }), track = U.el("i", { class: "ht-track" }), fill = U.el("i", { class: "ht-tfill" }), knob = U.el("i", { class: "ht-knob" });
                    track.append(fill, knob);
                    r.append(U.el("span", { text: label }), out, track);
                    const set = x => { fill.style.width = x + "%"; knob.style.left = x + "%"; out.textContent = Math.round(x) + "%"; };
                    set(v);
                    rows[key] = { r, set, knob, v };
                    return r;
                };
                sw("all", "All Sound");
                s.add("ht-shead", { text: "Music" }, menu); sw("music", "Boss Music"); sl("mvol", "Music Volume", 100);
                s.add("ht-shead", { text: "Effects" }, menu); sl("boss", "Boss Fight Effects", 100); sw("typing", "Typing Sounds"); sw("clicks", "Click Sounds");
                s.cursor.show(560, 330);
                await s.wait(300);
                s.sub("The speaker at the top opens every sound option");
                await s.cursor.click(spk);
                menu.style.opacity = "";
                s.pop(menu);
                await s.wait(1200);
                s.sub("Turn the boss music down");
                const mv = rows.mvol;
                await s.cursor.to(mv.knob);
                await s.tween(900, k => { const x = U.lerp(100, 55, k); mv.set(x); s.cursor.show(s.pos(mv.knob).x, s.pos(mv.knob).y); });
                await s.wait(700);
                s.sub("The bosses' attacks and your abilities have their own");
                const bf = rows.boss;
                await s.cursor.to(bf.knob);
                await s.tween(800, k => { const x = U.lerp(100, 65, k); bf.set(x); s.cursor.show(s.pos(bf.knob).x, s.pos(bf.knob).y); });
                await s.wait(700);
                s.sub("Typing and clicks can go quiet on their own");
                await s.cursor.click(rows.typing.querySelector(".ht-switch"));
                rows.typing.querySelector(".ht-switch").classList.remove("on");
                await s.wait(1600);
                s.cursor.hide();
            }
        }
    ];

    const BOSS = [
        {
            title: "The Race", len: 7700, text: "You and the boss each get a board. Finish yours first to win. If the boss finishes its board first, you lose. The bar at the top shows who's ahead.",
            async demo(s) {
                const sc = scene(), race = s.race();
                const b = s.board({ x: 40, y: 78, cell: 42 });
                const panel = s.add("ht-bpanel", { x: 372, y: 78, w: 230, h: 226 });
                s.bossArt(sc.bw, "big", panel);
                const bb = s.bossBoard(panel);
                await s.wait(300);
                s.sub("You and the boss each get a board");
                let bossK = 0;
                s.every(dt => { if (bossK < 0.92) { bossK = Math.min(0.92, bossK + dt / 9000); bb.set(bossK); race.set(b.pct(), bossK); } });
                await s.wait(900);
                for (const n of [1, 5]) await b.typeWord(b.entry("across", n), { ms: 90, keys: false });
                s.sub("The bar shows who's ahead");
                s.pop(race.el, "ht-flash");
                for (const n of [7, 8]) await b.typeWord(b.entry("across", n), { ms: 90, keys: false });
                s.sub("Finish yours first to win");
                await b.typeWord(b.entry("across", 9), { ms: 90, keys: false });
                race.set(1, bossK);
                await b.solve();
                bossK = 1;     // (stops the boss)
                s.pop(panel, "ht-shake");
                await s.banner("You Win", "good", 1500);
                s.sub("If the boss finishes first, it wins");
                await s.wait(1500);
            }
        },
        {
            title: "Phases", len: 6900, text: "Later bosses have more than one phase. Finish a board and the next, bigger one starts right away.",
            async demo(s) {
                const race = s.race();
                const dots = s.add("ht-phases", { x: 284, y: 68 });
                const ds = [1, 2, 3].map(() => s.add("", { tag: "i" }, dots));
                ds[0].classList.add("on");
                const b = s.board({ x: 219, y: 96, cell: 38 });
                b.fill(b.entries.filter(e => e.dir === "across" && e.num !== 9));
                race.set(b.pct(), 0.5);
                await s.wait(300);
                s.sub("Later bosses have more than one phase");
                await s.wait(900);
                await b.typeWord(b.entry("across", 9), { ms: 120, keys: false });
                race.set(1, 0.5);
                await b.solve();
                s.sub("Finish a board and the next one starts right away");
                b.el.classList.add("ht-out");
                await s.banner("Phase 2", "", 1100);
                b.el.remove();
                ds[1].classList.add("on");
                const big = s.board({ x: 216, y: 94, cell: 32, grid: ["....#.", "......", "...#..", "..#...", "......", ".#...."].map(r => r.replace(/\./g, "A")), nums: true, cls: "ht-in" });
                for (const row of big.cells) for (const d of row) { const l = d.querySelector(".ltr"); if (l) l.textContent = ""; }
                race.set(0, 0);
                await s.wait(900);
                s.sub("Each board is bigger, and the boss is faster");
                await s.wait(2200);
            }
        },
        {
            title: "Attacks", len: 13000, text: "Every so often the boss winds up an attack. The warning box under the bar shows its name and a countdown. Finish any right word before it runs out to block it.",
            async demo(s) {
                const race = s.race(), warn = s.warn();
                const b = s.board({ x: 224, y: 112, cell: 36 });
                b.fill([ACROSS(1)(b), ACROSS(5)(b), ACROSS(7)(b)]);
                const seven = ACROSS(8)(b);
                seven.cells.slice(0, 3).forEach(([r, c], i) => b.type(r, c, seven.answer[i]));
                b.select(3, 3, "across");
                race.set(b.pct(), 0.45);
                await s.wait(300);
                s.sub("The boss winds up an attack");
                const run = warn.windup("Ink Blot", "Finish a word to block it", 4200);
                await s.wait(1500);
                s.sub("Finish any right word before it runs out to block it");
                await s.wait(600);
                await b.typeWord(seven, { ms: 220, from: 3 });
                warn.cancel();
                await run;
                warn.show("🛡️ Blocked", "Ink Blot was stopped.", "good");
                const p = s.pos(warn.el);
                s.burst(p.x, p.y, "var(--good)", 14);
                race.set(b.pct(), 0.5);
                await s.wait(1800);
                s.sub("If one lands, the box says how to undo it");
                const landed = await warn.windup("Ink Blot", "Finish a word to block it", 2200);
                if (landed) {
                    warn.show("🖋️ Ink Blot Hit You", "Tip: click the blots to wipe them.", "bad");
                    const blots = [[0, 1], [2, 3], [1, 2]].map(([r, c]) => { const bl = s.add("ht-blot", {}, b.cell(r, c)); s.pop(bl); return bl; });
                    s.cursor.show(560, 330);
                    await s.wait(900);
                    for (const bl of blots) { await s.cursor.click(bl); bl.classList.add("gone"); await s.wait(150); }
                    s.cursor.hide();
                }
                await s.wait(1200);
            }
        },
        {
            title: "Fighting Back", len: 8000, text: "Some attacks put a target somewhere on the screen. Click it to turn the attack on the boss. If an attack lands, the warning box says how to undo it.",
            async demo(s) {
                const sc = scene(), race = s.race(), warn = s.warn();
                const b = s.board({ x: 60, y: 112, cell: 36 });
                b.fill([ACROSS(1)(b), ACROSS(5)(b)]);
                race.set(b.pct(), 0.4);
                const panel = s.add("ht-bpanel", { x: 400, y: 112, w: 200, h: 200 });
                const art = s.bossArt(sc.bw, "big", panel);
                s.sub("Some attacks put a target on the screen");
                const run = warn.windup("Icicle", "Click the target 3 times to send it back", 9000);
                const tgt = s.add("ht-target", { x: 330, y: 230 });
                const count = s.add("ht-tcount", { text: "0 / 3" }, tgt);
                let tx = 330, ty = 230, vx = 40, vy = -26;
                s.every(dt => { tx += vx * dt / 1000; ty += vy * dt / 1000; if (tx < 40 || tx > 600) vx = -vx; if (ty < 110 || ty > 330) vy = -vy; tgt.style.left = tx + "px"; tgt.style.top = ty + "px"; });
                s.cursor.show(560, 330);
                await s.wait(1200);
                s.sub("Click it to turn the attack on the boss");
                const spots = [[150, 300], [520, 140], [300, 160]];
                for (let i = 0; i < 3; i++) {
                    await s.cursor.to({ x: tx + vx * 0.65, y: ty + vy * 0.65 }, 650);
                    await s.cursor.click();
                    count.textContent = `${i + 1} / 3`;
                    s.pop(tgt, "ht-flash");
                    if (i < 2) { [tx, ty] = spots[i]; tgt.style.left = tx + "px"; tgt.style.top = ty + "px"; s.pop(tgt); await s.wait(350); }
                }
                warn.cancel();
                await run;
                tgt.remove();
                await s.fly("❄️", { x: tx, y: ty }, s.pos(art), 600);
                art.classList.add("frozen");
                s.pop(panel, "ht-shake");
                warn.show("✋ Countered", "The icicle froze the boss.", "good");
                s.cursor.hide();
                await s.wait(2400);
            }
        },
        {
            title: "Lost Letters", len: 8600, text: "Squares the boss erases or changes get a ✕ or ⇄ mark. Click one to put your letter back.",
            async demo(s) {
                const sc = scene();
                const b = s.board({ x: 70, y: 52, cell: 48 });
                b.fill(b.entries.filter(e => e.dir === "across" && e.num < 9));
                const panel = s.add("ht-bpanel", { x: 400, y: 70, w: 200, h: 200 });
                const art = s.bossArt(sc.bw, "big", panel);
                await s.wait(300);
                s.sub("The boss can erase or change your letters");
                s.pop(art, "ht-shake");
                const hits = [[1, 1, "erased"], [3, 2, "erased"], [2, 3, "changed", "Q"]];
                for (const [r, c, kind, ch] of hits) {
                    await s.fly("✕", s.pos(art), b.center(r, c), 420);
                    b.type(r, c, kind === "changed" ? ch : "");
                    const m = s.add("hit-mark " + kind, { tag: "span" }, b.cell(r, c));
                    b.cell(r, c)._mark = m;
                    U.restart(b.cell(r, c), "shake");
                    await s.wait(150);
                }
                await s.wait(1000);
                s.sub("Click a marked square to put your letter back");
                s.cursor.show(560, 330);
                for (const [r, c] of hits) {
                    await s.cursor.click(b.cell(r, c));
                    b.cell(r, c)._mark.remove();
                    b.type(r, c, GRID[r][c]);
                    U.restart(b.cell(r, c), "ok");
                    await s.wait(250);
                }
                s.cursor.hide();
                await s.wait(1600);
            }
        },
        {
            title: "Abilities", len: 7800, text: "Keys 1, 2 and 3. In the campaign, equip any three you've unlocked, on the boss's sheet or in the shop. Each use costs one, and coins buy more.",
            async demo(s) {
                const sc = scene(), race = s.race(), warn = s.warn();
                const b = s.board({ x: 40, y: 108, cell: 34 });
                b.fill([ACROSS(1)(b), ACROSS(5)(b)]);
                const panel = s.add("ht-bpanel", { x: 430, y: 108, w: 180, h: 186 });
                const art = s.bossArt(sc.bw, "big", panel);
                const bb = s.bossBoard(panel, { cell: 13 });
                bb.set(0.5);
                race.set(b.pct(), 0.5);
                const list = sc.abilities.slice(0, 3);
                const bar = s.abilityBar(list, { x: 232, y: 108, w: 186 });
                await s.wait(300);
                s.sub("Press 1, 2 or 3 to use an ability");
                await s.wait(700);
                await bar.use(0);
                warn.show(list[0].icon + " " + list[0].name, list[0].desc, "mine");
                if (list[0].fx && list[0].fx.on === "me") { b.el.classList.add("ht-glow"); s.later(1600, () => b.el.classList.remove("ht-glow")); }
                else { await s.fly(list[0].icon, s.pos(bar.cards[0]), s.pos(art), 550); bb.knock(3); race.set(b.pct(), 0.4); s.pop(panel, "ht-shake"); }
                await s.wait(1900);
                s.sub("In the campaign, equip any three you've unlocked");
                const other = Powers.ABILITIES.find(a => a.world !== sc.bw && a.world === "space") || Powers.ABILITIES.find(a => a.world !== sc.bw);
                const c2 = bar.cards[1];
                s.pop(c2, "ht-flip");
                await s.wait(250);
                c2.querySelector(".ht-aic").textContent = other.icon;
                c2.querySelector("b").textContent = other.name;
                await s.wait(1800);
                s.sub("Each use costs one. Coins buy more");
                const cp = s.pos(bar.cards[0]);
                s.float("×2 left", cp.x, cp.y - 30);
                await s.wait(1800);
            }
        },
        {
            title: "Close Calls", len: 12000, text: "When the boss is 85% done, the screen turns red and the warning box says so. Get far ahead and it gets angry: faster, with more attacks.",
            async demo(s) {
                const sc = scene(), race = s.race(), warn = s.warn();
                const b = s.board({ x: 224, y: 112, cell: 36 });
                b.fill([ACROSS(1)(b), ACROSS(5)(b), ACROSS(7)(b)]);
                race.set(0.6, 0.66);
                await s.wait(300);
                s.sub("Watch the boss's side of the bar");
                await race.to(0.62, 0.86, 2400);
                s.world.classList.add("ht-close");
                warn.show(`⚠ ${sc.boss.name} Is 86% Done`, "Almost there. Finish words fast, and use an ability now.", "close");
                s.sub("At 85% the screen turns red");
                await s.wait(1600);
                await b.typeWord(ACROSS(8)(b), { ms: 90, keys: false });
                await b.typeWord(ACROSS(9)(b), { ms: 90, keys: false });
                await b.solve();
                s.world.classList.remove("ht-close");
                warn.hide();
                await s.wait(600);
                s.sub("Get far ahead and it gets angry");
                b.el.remove();
                const b2 = s.board({ x: 224, y: 112, cell: 36 });
                b2.fill(b2.entries.filter(e => e.dir === "across" && e.num < 8));
                race.set(0.2, 0.2);
                await race.to(0.62, 0.3, 1600);
                race.el.classList.add("rage");
                warn.show(`😡 ${sc.boss.name} Is Enraged`, "It's faster and angrier now.", "rage");
                s.pop(race.el, "ht-shake");
                await s.wait(1300);
                s.sub("Faster, with more attacks");
                await race.to(0.66, 0.5, 2000);
                await s.wait(600);
            }
        },
        {
            title: "Stars", len: 10500, text: "One star for winning, two if the boss stayed under 85%, and three if it stayed under 60%.",
            async demo(s) {
                const sc = scene();
                const card = s.add("ht-starcard", { x: 160, y: 40, w: 320 });
                s.bossArt(sc.bw, "", card);
                const title = U.el("b", { text: "You Won" });
                const meter = s.add("ht-meter", {}, card), fill = s.add("ht-mfill", {}, meter);
                s.add("ht-mline a", {}, meter); s.add("ht-mline b", {}, meter);
                const pct = U.el("small", { text: "" }), stars = U.el("div", { class: "ht-bigstars", text: "☆☆☆" });
                card.append(title, pct, stars);
                const one = async (k, n, line) => {
                    fill.style.width = "0";
                    stars.textContent = "☆☆☆";
                    s.sub(line);
                    await s.tween(1100, t => { fill.style.width = (t * k * 100).toFixed(1) + "%"; pct.textContent = `The boss got to ${Math.round(t * k * 100)}%`; }, U.ease.outCubic);
                    for (let i = 1; i <= n; i++) { stars.textContent = "★".repeat(i) + "☆".repeat(3 - i); s.pop(stars); await s.wait(260); }
                    await s.wait(1300);
                };
                await s.wait(300);
                await one(0.93, 1, "One star for winning");
                await one(0.74, 2, "Two if the boss stayed under 85%");
                await one(0.48, 3, "Three if it stayed under 60%");
                const p = s.pos(stars);
                s.burst(p.x, p.y, "#f6c445", 18);
                await s.wait(1000);
            }
        },
        {
            title: "The Boss on Daily", len: 9700, text: "Today's boss and the fifth daily. A win scores 250 plus 50 a star, minus Check and Reveal. Your right words stay locked in for your next attempt. Every earlier attempt takes 40 off, and your best of the day is kept.",
            async demo(s) {
                const sc = scene();
                const a1 = s.add("ht-attempt lost", { x: 30, y: 22, w: 180 });
                a1.append(U.el("b", { text: "Attempt 1" }), U.el("small", { text: "The boss won" }));
                const b1 = s.board({ x: 52, y: 92, cell: 26 });
                b1.fill([ACROSS(1)(b1), ACROSS(7)(b1)]);
                b1.type(1, 0, "I"); b1.type(1, 1, "N"); b1.type(3, 1, "E");
                s.sub("Today's boss is the fifth daily");
                s.bossArt(sc.bw, "", s.world, { x: 275, y: 14 }).classList.add("ht-mid");
                await s.wait(1600);
                s.sub("Your right words stay locked in for the next attempt");
                const a2 = s.add("ht-attempt", { x: 430, y: 22, w: 180 });
                a2.append(U.el("b", { text: "Attempt 2" }), U.el("small", { text: "Starts with them" }));
                const b2 = s.board({ x: 452, y: 92, cell: 26 });
                await s.wait(500);
                for (const n of [1, 7]) {
                    const e = ACROSS(n)(b2);
                    await s.fly("🔒", s.pos(b1.cell(...e.cells[2])), s.pos(b2.cell(...e.cells[2])), 520);
                    e.cells.forEach(([r, c], i) => { b2.type(r, c, e.answer[i]); b2.mark(r, c, "locked"); U.restart(b2.cell(r, c), "lock-in"); });
                }
                await s.wait(1500);
                s.sub("A win scores 250 plus 50 a star");
                const score = s.add("ht-score small", { x: 222, y: 112, w: 196 });
                const rows = [["Win", "250"], ["★★", "+100"], ["Attempt 2", "−40"], ["Total", "310"]].map(([a, v], i) => { const r = s.add("ht-srow" + (i === 3 ? " total" : ""), {}, score); r.append(U.el("span", { text: a }), U.el("b", { text: v })); r.style.opacity = "0"; return r; });
                for (const r of rows.slice(0, 2)) { r.style.opacity = ""; s.pop(r); await s.wait(350); }
                await s.wait(500);
                s.sub("Every earlier attempt takes 40 off");
                rows[2].style.opacity = ""; s.pop(rows[2], "ht-flash");
                await s.wait(800);
                rows[3].style.opacity = ""; s.pop(rows[3]);
                await s.wait(900);
                s.sub("Your best of the day is kept");
                const best = s.add("ht-tag good", { x: 254, y: 262, text: "Best Today · 310" });
                s.pop(best);
                await s.wait(1800);
            }
        },
        {
            title: "The Boss on Unlimited", len: 8300, text: "A random boss. Rematch keeps the same boss, its puzzle and your right words, and every earlier attempt takes 5 coins off a win. New Boss picks another one and counts as an Unlimited puzzle.",
            async demo(s) {
                const sc = scene();
                const card = s.add("ht-losecard", { x: 190, y: 26, w: 260 });
                const art = s.bossArt(sc.bw, "", card);
                card.append(U.el("small", { text: "Boss · Attempt 1" }), U.el("b", { text: `${sc.boss.name} Wins` }));
                const btns = s.add("ht-btns", {}, card);
                const rematch = s.add("ht-btn primary", { tag: "button", text: "Rematch", attrs: { type: "button", tabindex: "-1" } }, btns);
                const fresh = s.add("ht-btn", { tag: "button", text: "New Boss", attrs: { type: "button", tabindex: "-1" } }, btns);
                s.cursor.show(560, 330);
                await s.wait(300);
                s.sub("Rematch keeps the same boss, puzzle and right words");
                await s.cursor.click(rematch);
                s.pop(card, "ht-flip");
                card.querySelector("small").textContent = "Boss · Attempt 2";
                card.querySelector("b").textContent = "You Won";
                art.classList.add("ko");
                await s.wait(400);
                const coins = s.add("ht-tag good", { x: 236, y: 252, text: "🪙 20 Coins · 5 Fewer for Attempt 2" });
                s.pop(coins);
                s.sub("Each earlier attempt takes 5 coins off a win");
                await s.wait(2100);
                coins.remove();
                card.querySelector("b").textContent = `${sc.boss.name} Wins`;
                card.querySelector("small").textContent = "Boss · Attempt 2";
                art.classList.remove("ko");
                s.sub("New Boss picks another one");
                await s.cursor.click(fresh);
                const others = Bosses.list.filter(w => w !== sc.bw);
                for (let i = 0; i < 6; i++) { art.innerHTML = Bosses.svg(others[(i * 5) % others.length]); await s.wait(110 + i * 25); }
                card.querySelector("small").textContent = "Boss · Attempt 1";
                card.querySelector("b").textContent = Bosses.info(others[25 % others.length]).name;
                s.pop(card);
                s.cursor.hide();
                await s.wait(1800);
            }
        },
        {
            title: "Their Abilities", len: 8700, text: "On Daily and Unlimited you get the boss's own world's three abilities, with 3 uses each, every attempt. There are no items, but Check and Reveal work.",
            async demo(s) {
                const sc = scene();
                const head = s.add("ht-tag", { x: 252, y: 12, text: "Boss · Attempt 1" });
                const bar = s.abilityBar(sc.abilities.slice(0, 3), { x: 110, y: 58, w: 420 });
                bar.el.classList.add("row");
                await s.wait(300);
                s.sub("You get the boss's own three abilities");
                await s.wait(1300);
                s.sub("3 uses each");
                for (const i of [0, 2, 0, 1]) { await bar.use(i); await s.wait(500); }
                await s.wait(400);
                s.sub("Refilled every attempt");
                head.textContent = "Boss · Attempt 2";
                s.pop(head);
                await s.wait(300);
                bar.refill();
                await s.wait(1500);
                s.sub("No items, but Check and Reveal work");
                const helpers = s.add("ht-helpers", { x: 170, y: 174, w: 300 });
                for (const act of ["Check", "Reveal"]) {
                    const row = s.add("ht-hrow", {}, helpers);
                    s.add("ht-hlabel", { text: act }, row);
                    for (const scope of ["Square", "Word", "Puzzle"]) s.add("ht-hbtn", { tag: "button", text: scope, attrs: { type: "button", tabindex: "-1" } }, row);
                }
                s.pop(helpers);
                const give = s.add("ht-giveup", { x: 270, y: 274, w: 100, text: "Give Up" });
                s.pop(give);
                await s.wait(2000);
            }
        },
        {
            title: "Items", len: 13300, text: "In the campaign, shop items help out: Letter Reveal, Word Reveal, Clear Wrong, Lock Right and Time Stop, which freezes the boss in a fight. Campaign bosses have no Check or Reveal.",
            async demo(s) {
                const sc = scene();
                const b = s.board({ x: 40, y: 14, cell: 40 });
                b.fill([ACROSS(1)(b), ACROSS(5)(b)]);
                ["S", "N", "O", "K", "E"].forEach((ch, i) => b.type(2, i, ch));
                b.mark(2, 2, "wrong");
                const panel = s.add("ht-bpanel", { x: 420, y: 14, w: 190, h: 200 });
                const art = s.bossArt(sc.bw, "big", panel);
                const items = s.add("ht-items", { x: 40, y: 238, w: 570 });
                const it = {};
                for (const [id, icon, name] of [["letter", "🔍", "Letter Reveal"], ["word", "📖", "Word Reveal"], ["clear", "🧽", "Clear Wrong"], ["lock", "🔒", "Lock Right"], ["pause", "⏸️", "Time Stop"]]) {
                    const x = s.add("ht-item", { tag: "button", attrs: { type: "button", tabindex: "-1", title: name } }, items);
                    x.append(U.el("span", { text: icon }), U.el("small", { text: name }));
                    it[id] = x;
                }
                s.cursor.show(560, 250);
                await s.wait(300);
                s.sub("Clear Wrong wipes the wrong letters");
                await s.cursor.click(it.clear);
                b.type(2, 2, ""); b.mark(2, 2, "wrong", false); U.restart(b.cell(2, 2), "shake");
                await s.wait(1100);
                s.sub("Letter Reveal shows the right letter");
                b.select(2, 2, "across");
                await s.cursor.click(it.letter);
                b.type(2, 2, "A"); U.restart(b.cell(2, 2), "flip");
                await s.wait(1100);
                s.sub("Word Reveal fills in a whole word");
                b.select(3, 0, "across");
                await s.cursor.click(it.word);
                ACROSS(8)(b).cells.forEach(([r, c], i) => s.later(i * 80, () => { b.type(r, c, "SEVEN"[i]); U.restart(b.cell(r, c), "flip"); }));
                await s.wait(1200);
                s.sub("Lock Right locks your right letters");
                b.unselect();
                await s.cursor.click(it.lock);
                for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) if (b.letters[r][c] && b.letters[r][c] === GRID[r][c]) s.later((r + c) * 40, () => { b.mark(r, c, "locked"); U.restart(b.cell(r, c), "lock-in"); });
                await s.wait(1200);
                s.sub("Time Stop freezes the boss");
                await s.cursor.click(it.pause);
                art.classList.add("frozen");
                const clock = s.add("ht-freeze", { text: "⏸ 10s" }, panel);
                s.pop(clock);
                s.cursor.hide();
                await s.wait(1500);
                s.sub("Campaign bosses have no Check or Reveal");
                await s.wait(1900);
            }
        }
    ];
    const TABS = [["normal", "Normal", NORMAL], ["boss", "Boss Fights", BOSS]];

    // ---------------------------------------------------------------------------------------------
    // The player
    // ---------------------------------------------------------------------------------------------
    function open(tab = "normal") {
        if (document.querySelector("#overlay .howto-page")) return;
        const still = U.motion() === "still";                          // reduce motion: nothing plays until you press Play
        const modal = U.el("div", { class: "results shop-page howto-page", role: "dialog", "aria-modal": "true", "aria-labelledby": "howto-title" });
        const card = U.el("div", { class: "shop-card howto-card" });
        modal.appendChild(card);
        let chapters = [], idx = 0, run = null, paused = still, raf = 0, last = 0, ended = false;
        const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>';
        const REPLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="ln" d="M5 12a7 7 0 1 0 2.1-5"/><path d="M4 3.5v5h5z"/></svg>';
        // the parts of the page
        const tabs = U.el("div", { class: "shop-tabs", role: "tablist" });
        const stage = U.el("div", { class: "ht-stage", role: "img", tabindex: "0", "aria-label": "Animation" });
        const world = U.el("div", { class: "ht-world" });
        const big = U.el("button", { type: "button", class: "ht-bigplay", "aria-label": "Play", html: PLAY });
        stage.append(world, big);
        const playBtn = U.el("button", { type: "button", class: "ht-ctl ht-play", "aria-label": "Pause" });
        const prevBtn = U.el("button", { type: "button", class: "ht-ctl", "aria-label": "Previous", html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 6v12M18 6l-8 6 8 6z"/></svg>' });
        const nextBtn = U.el("button", { type: "button", class: "ht-ctl", "aria-label": "Next", html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 6v12M6 6l8 6-8 6z"/></svg>' });
        const segs = U.el("div", { class: "ht-segs" });
        const count = U.el("span", { class: "ht-count" });
        const now = U.el("div", { class: "ht-now", "aria-live": "polite" });
        const cap = U.el("p", { class: "ht-cap", "aria-hidden": "true" });
        const list = U.el("ol", { class: "ht-list" });
        const close = () => {
            cancelAnimationFrame(raf);
            if (run) run.kill();
            ro.disconnect();
            modal.classList.remove("in"); modal.classList.add("out");
            setTimeout(() => modal.remove(), 300);
        };
        card.append(
            U.el("div", { class: "shop-head" }, U.el("div", { class: "shop-title" }, U.el("h2", { id: "howto-title", text: "How to Play" })), U.el("button", { type: "button", class: "btn ghost small", text: "Close", onclick: close })),
            tabs,
            U.el("div", { class: "ht-body" },
                U.el("div", { class: "ht-main" }, stage, cap, U.el("div", { class: "ht-bar" }, prevBtn, playBtn, nextBtn, segs, count), now),
                U.el("div", { class: "ht-side" }, list)));
        // the stage is drawn at 640x360 and scaled to fit
        const ro = new ResizeObserver(() => {
            const k = stage.clientWidth / W;
            if (k > 0) world.style.setProperty("--k", k.toFixed(4));
            card.querySelector(".ht-main").classList.toggle("small", k > 0 && k < 0.8);
        });
        ro.observe(stage);

        const drawPlay = () => {
            const showPlay = paused || ended;
            playBtn.innerHTML = ended ? REPLAY : showPlay ? PLAY : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 5.5v13M16.5 5.5v13"/></svg>';
            playBtn.setAttribute("aria-label", ended ? "Replay" : paused ? "Play" : "Pause");
            big.innerHTML = ended ? REPLAY : PLAY;
            big.classList.toggle("replay", ended);
            big.setAttribute("aria-label", ended ? "Replay" : "Play");
            big.hidden = !showPlay;
            stage.classList.toggle("paused", showPlay);
        };
        function drawTabs() {
            tabs.innerHTML = "";
            for (const [id, text] of TABS) tabs.appendChild(U.el("button", { type: "button", role: "tab", class: "shop-tab" + (tab === id ? " on" : ""), "aria-selected": tab === id ? "true" : "false", text,
                onclick: () => { if (tab === id) return; tab = id; Sound.play("select"); load(); } }));
        }
        function drawList() {
            list.innerHTML = "";
            segs.innerHTML = "";
            chapters.forEach((ch, i) => {
                const li = U.el("li", {}, U.el("button", { type: "button", class: "ht-ch" + (i === idx ? " on" : ""), onclick: () => go(i, true) },
                    U.el("span", { class: "ht-chn", text: String(i + 1) }), U.el("span", { class: "ht-cht", text: ch.title }), U.el("i", { class: "ht-chbar" })));
                list.appendChild(li);
                segs.appendChild(U.el("button", { type: "button", class: "ht-seg" + (i < idx ? " done" : i === idx ? " on" : ""), "aria-label": ch.title, onclick: () => go(i, true) }, U.el("i")));
            });
        }
        // a chapter starts: a fresh stage and a new run of its animation
        function go(i, user = false) {
            if (run) run.kill();
            idx = U.clamp(i, 0, chapters.length - 1);
            ended = false;
            if (user && still) paused = false;                     // (choosing a chapter plays it)
            world.innerHTML = "";
            world.classList.remove("sub-side", "ht-close");
            const ch = chapters[idx];
            now.innerHTML = "";
            now.append(U.el("h3", { text: ch.title }), U.el("p", { text: ch.text }));
            count.textContent = `${idx + 1} / ${chapters.length}`;
            drawList();
            const li = list.children[idx];
            if (li && user && list.getBoundingClientRect().top < stage.getBoundingClientRect().bottom) li.scrollIntoView({ block: "nearest" });
            stage.setAttribute("aria-label", "Animation: " + ch.title);
            cap.textContent = "";
            const s = makeRun(world, { onSub: text => { if (run === me) cap.textContent = text; } }), me = s.run;
            run = me;
            me.len = ch.len || 12000;                                  // (each chapter's measured length, for its progress bar)
            ch.demo(s).then(() => { if (run === me) me.done = true; }, err => { if (err !== STOP) console.error(err); });
            drawPlay();
        }
        function load() {
            chapters = TABS.find(t => t[0] === tab)[2];
            drawTabs();
            go(0);
        }
        // the clock: runs the animation while playing; when a chapter ends it stays on its last frame
        function frame(t) {
            const dt = Math.min(50, t - (last || t));
            last = t;
            if (run && !paused && !ended) {
                run.step(dt * test.speed);
                test.info = { tab, idx, t: run.t, done: !!run.done, count: chapters.length };
                const k = run.done ? 1 : Math.min(0.97, run.t / run.len);
                const seg = segs.children[idx], bar = list.children[idx] && list.children[idx].querySelector(".ht-chbar");
                if (seg) seg.firstChild.style.width = (k * 100).toFixed(1) + "%";
                if (bar) bar.style.width = (k * 100).toFixed(1) + "%";
                if (run.done) { ended = true; drawPlay(); }
            }
            raf = requestAnimationFrame(frame);
        }
        const toggle = () => {
            if (ended) { paused = false; go(idx); }                    // Replay: the same chapter again
            else paused = !paused;
            drawPlay();
        };
        playBtn.addEventListener("click", toggle);
        big.addEventListener("click", e => { e.stopPropagation(); toggle(); });
        stage.addEventListener("click", toggle);
        prevBtn.addEventListener("click", () => go(idx - 1, true));
        nextBtn.addEventListener("click", () => go(idx + 1, true));
        modal.addEventListener("pointerdown", e => { if (e.target === modal) close(); });
        modal.addEventListener("keydown", e => {
            e.stopPropagation();                                       // (typing here never reaches the board)
            if (e.key === "Escape") close();
            else if (e.key === "ArrowRight") { e.preventDefault(); go(idx + 1, true); }
            else if (e.key === "ArrowLeft") { e.preventDefault(); go(idx - 1, true); }
            else if ((e.key === " " || e.key === "k") && !e.target.closest("button")) { e.preventDefault(); toggle(); }
        });
        document.getElementById("overlay").appendChild(modal);
        load();
        raf = requestAnimationFrame(frame);
        requestAnimationFrame(() => { modal.classList.add("in"); stage.focus({ preventScroll: true }); });
        Sound.play("select");
    }

    document.getElementById("howto-btn").addEventListener("click", e => { e.currentTarget.blur(); open(U.view() === "level" && typeof Campaign !== "undefined" && Campaign.playing && Campaign.playing.level === 5 ? "boss" : "normal"); });
    return { open, chapters: { normal: NORMAL, boss: BOSS }, test };
})();
