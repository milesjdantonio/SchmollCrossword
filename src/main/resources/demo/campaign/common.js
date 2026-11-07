// Shared by the campaign redesign demos: the real level data from the server (/api/campaign/map), SAMPLE progress
// (never your own save: nothing here reads or writes the game's saved data), small helpers, a drawn icon set, and
// live companion portraits. The game's own scripts (worlds, bosses, hero, powers) are loaded by each demo page.

// Some worlds tidy up the puzzle screen when you leave them (Game...); a demo has no puzzle screen, so a stand-in
// answers every such call with an empty list
if (typeof Game === "undefined") window.Game = new Proxy({}, { get: (o, k) => (k === "state" ? {} : () => []) });

const Demo = (() => {
    const PAR_BASE = { easy: 140, medium: 210, hard: 280, challenge: 255, expert: 310 };
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
    const label = (d, size) => cap(d) + (size > 5 ? ` ${size}×${size}` : "");
    const par = (d, size = 5) => Math.round((PAR_BASE[d] || 180) * Math.max(1, (size * size) / 25) / 10) * 10;
    const fmt = s => Math.floor(s / 60) + ":" + String(Math.round(s % 60)).padStart(2, "0");

    // the third star's goal, worded as the game words it
    function starGoal(lesson, d, size) {
        const p = par(d, size), t = k => Math.round(p * k / 5) * 5;
        switch (lesson && lesson.star) {
            case "brisk": return `Finish under ${fmt(t(0.75))}`;
            case "fast": return `Finish under ${fmt(t(0.6))}`;
            case "nocheck": return "4 wrong letters or fewer";
            case "clean": return "1 wrong letter at most";
            case "boss": return "Win with the boss far behind";
            default: return `Finish under ${fmt(p)}`;
        }
    }

    // ---- sample progress: the first three worlds done, two levels into Candy Hills ----
    const SAMPLE_STARS = { paper: [3, 3, 2, 3, 3], garden: [3, 2, 3, 2, 2], squirrel: [2, 3, 3, 1, 2], candy: [3, 2] };
    const levels = {};
    for (const [w, stars] of Object.entries(SAMPLE_STARS)) stars.forEach((s, i) => { levels[`${w}-${i + 1}`] = { stars: s, seconds: 70 + i * 23 + w.length * 9 }; });
    const sample = { coins: 245, levels };

    let map = [];
    async function load() {
        const r = await fetch("/api/campaign/map");
        if (!r.ok) throw new Error("the server answered " + r.status);
        map = (await r.json()).filter(s => typeof Worlds === "undefined" || Worlds.byId[s.world]);
        return map;
    }
    const rec = (si, l) => sample.levels[`${map[si].world}-${l}`];
    const worldOpen = si => si === 0 || !!rec(si - 1, 5);
    const levelOpen = (si, l) => worldOpen(si) && (l === 1 || !!rec(si, l - 1));
    const done = si => [1, 2, 3, 4, 5].filter(l => rec(si, l)).length;
    const starsIn = si => [1, 2, 3, 4, 5].reduce((n, l) => n + ((rec(si, l) || {}).stars || 0), 0);
    function next() {
        for (let si = 0; si < map.length; si++) for (const l of [1, 2, 3, 4, 5]) if (levelOpen(si, l) && !rec(si, l)) return { si, l };
        return { si: 0, l: 1 };
    }
    function totals() {
        const main = map.filter(s => !s.secret);
        return { stars: main.reduce((n, s) => n + starsIn(map.indexOf(s)), 0), max: main.length * 15, pages: main.filter(s => rec(map.indexOf(s), 5)).length, worlds: main.length };
    }

    // what a level is, in one object
    function level(si, l) {
        const s = map[si], w = Worlds.byId[s.world], d = s.levels[l - 1], size = s.sizes ? s.sizes[l - 1] : 5;
        const lesson = s.lessons && s.lessons[l - 1];
        const boss = l === 5;
        const abilities = Powers.ABILITIES.filter(a => a.world === s.world);
        const unlockAt = s.world === "rift" ? [1, 2, 3, 4] : [1, 3, 5];
        const prize = abilities[unlockAt.indexOf(l)] || null;
        return {
            si, l, world: s.world, worldName: w.name, d, size, label: label(d, size), lesson, boss, prize,
            goal: starGoal(lesson, d, size), rec: rec(si, l), open: levelOpen(si, l), secret: !!s.secret,
            bossInfo: boss ? Bosses.info(s.world) : null, moves: boss ? (Powers.MOVES[s.world] || []) : [],
            phases: boss ? 1 + (s.phases ? s.phases.length : 1) : 0, par: par(d, size)
        };
    }

    // ---- a small drawn icon set (one stroke weight), so no emoji or text glyph stands in for an icon ----
    const P = {
        star: '<path d="M12 2.8l2.75 5.6 6.15.9-4.45 4.35 1.05 6.1L12 16.85 6.5 19.75l1.05-6.1L3.1 9.3l6.15-.9z"/>',
        lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/>',
        play: '<path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.6-6.8a.8.8 0 0 0 0-1.4L9.2 4.5A.8.8 0 0 0 8 5.2z"/>',
        back: '<path d="M15 5l-7 7 7 7"/>',
        prev: '<path d="M15 5l-7 7 7 7"/>',
        next: '<path d="M9 5l7 7-7 7"/>',
        close: '<path d="M6 6l12 12M18 6L6 18"/>',
        book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
        bolt: '<path d="M13 2.5L4.5 13.5H11l-1 8 8.5-11H12z"/>',
        hero: '<circle cx="12" cy="7.5" r="4"/><path d="M4 21.5c.6-4.4 3.9-7 8-7s7.4 2.6 8 7"/>',
        bag: '<path d="M5 8h14l-1.2 12.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 10.5V6.8a3 3 0 0 1 6 0v3.7"/>',
        help: '<circle cx="12" cy="12" r="9.5"/><path d="M9.4 9.3a2.7 2.7 0 0 1 5.2 1c0 1.9-2.6 2.3-2.6 4.2"/><circle cx="12" cy="17.6" r=".6"/>',
        crown: '<path d="M3.5 18.5l-1-11 5.5 4.5L12 5l4 7 5.5-4.5-1 11z"/><path d="M4 21.5h16"/>',
        clock: '<circle cx="12" cy="12" r="9.5"/><path d="M12 6.8V12l3.6 2.2"/>',
        check: '<path d="M4.5 12.5l5 5L19.5 7"/>',
        target: '<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
        spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.6 2.6M15.4 15.4L18 18M18 6l-2.6 2.6M8.6 15.4L6 18"/>',
        list: '<path d="M8.5 6.5h12M8.5 12h12M8.5 17.5h12"/><circle cx="4.2" cy="6.5" r=".9"/><circle cx="4.2" cy="12" r=".9"/><circle cx="4.2" cy="17.5" r=".9"/>',
        map: '<path d="M9 4L3.5 6v14L9 18l6 2 5.5-2V4L15 6z"/><path d="M9 4v14M15 6v14"/>',
        ribbon: '<path d="M6 2.5h12v19l-6-4.2-6 4.2z"/>'
    };
    const FILLED = new Set(["star", "play", "bolt", "ribbon"]);
    function icon(name, cls = "") {
        const span = document.createElement("span");
        span.className = "di di-" + name + (cls ? " " + cls : "");
        span.setAttribute("aria-hidden", "true");
        span.innerHTML = `<svg viewBox="0 0 24 24" ${FILLED.has(name) ? 'fill="currentColor" stroke="none"' : 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"'}>${P[name] || ""}</svg>`;
        return span;
    }
    // three stars, earned ones filled
    function stars(n, cls = "") {
        const box = el("span", { class: "di-stars " + cls, "aria-label": `${n} of 3 stars` });
        for (let i = 0; i < 3; i++) box.append(icon("star", i < n ? "on" : "off"));
        return box;
    }

    function el(tag, attrs = {}, ...kids) {
        const node = document.createElement(tag);
        for (const [k, v] of Object.entries(attrs || {})) {
            if (v == null || v === false) continue;
            if (k === "class") node.className = v;
            else if (k === "text") node.textContent = v;
            else if (k === "html") node.innerHTML = v;
            else if (k === "style" && typeof v === "object") for (const [p, x] of Object.entries(v)) p.startsWith("--") ? node.style.setProperty(p, x) : (node.style[p] = x);
            else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
            else node.setAttribute(k, v === true ? "" : v);
        }
        for (const kid of kids.flat()) if (kid != null && kid !== false) node.append(kid);
        return node;
    }

    // ---- a world's companion, alive in a small canvas (blinks, breathes) ----
    const portraits = new Set();
    let portraitRaf = 0;
    function companion(worldId, size = 96) {
        const cv = el("canvas", { class: "di-companion", width: size * 2, height: size * 2, style: { width: size + "px", height: size + "px" }, "aria-hidden": "true" });
        const w = Worlds.byId[worldId];
        if (!w || !w.mascot) return cv;
        portraits.add({ cv, w, st: { t: Math.random() * 3, blink: 0, mood: "happy", look: 0, talk: 0, excite: 0, hop: 0, blinkIn: 1 + Math.random() * 3 }, size });
        if (!portraitRaf) { let last = performance.now(); portraitRaf = requestAnimationFrame(function loop(now) {
            const dt = Math.min(0.05, (now - last) / 1000); last = now;
            for (const p of portraits) {
                if (!p.cv.isConnected) { portraits.delete(p); continue; }
                const g = p.cv.getContext("2d"), st = p.st;
                st.t += dt; st.blinkIn -= dt;
                if (st.blinkIn < 0) { st.blink = 1; st.blinkIn = 2.2 + Math.random() * 3; }
                st.blink = Math.max(0, st.blink - dt * 7);
                const k = (p.size * 2) / 160;
                g.setTransform(k, 0, 0, k, 0, 0);
                g.clearRect(0, 0, 160, 160);
                try { p.w.mascot.draw(g, st); } catch (err) { /* a world without a drawable mascot */ }
            }
            portraitRaf = portraits.size ? requestAnimationFrame(loop) : 0;
        }); }
        return cv;
    }

    // a world's live scene in a canvas (the same preview the Settings cards use), animated while visible
    function scene(canvas, worldId, theme) {
        let anim = null;
        try { anim = Worlds.preview(canvas, worldId, theme); } catch (err) { return null; }
        if (!anim) return null;
        let raf = 0, last = 0, seen = false;
        const loop = now => { const dt = Math.min(0.05, (now - last) / 1000); last = now; anim.step(dt); raf = canvas.isConnected && seen ? requestAnimationFrame(loop) : 0; };
        const io = new IntersectionObserver(([e]) => { seen = e.isIntersecting; if (seen && !raf && !matchMedia("(prefers-reduced-motion: reduce)").matches) { last = performance.now(); raf = requestAnimationFrame(loop); } });
        io.observe(canvas);
        return { stop() { io.disconnect(); cancelAnimationFrame(raf); } };
    }

    // "Play" in a demo doesn't start anything: it says what the real game would do
    function said(text) {
        let t = document.querySelector(".di-toast");
        if (!t) { t = el("div", { class: "di-toast", role: "status" }); document.body.append(t); }
        t.textContent = text;
        t.classList.remove("in"); void t.offsetWidth; t.classList.add("in");
        clearTimeout(said.timer);
        said.timer = setTimeout(() => t.classList.remove("in"), 2600);
    }

    // the light/dark mode a world shows in
    const modeFor = w => (w.modes.includes("light") ? "light" : w.modes[0]);

    return { load, get map() { return map; }, sample, rec, worldOpen, levelOpen, done, starsIn, next, totals, level, label, par, fmt,
        icon, stars, el, companion, scene, said, modeFor, cap };
})();
