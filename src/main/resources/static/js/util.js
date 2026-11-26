// Schmoll Crossword: small helpers every other script uses.
//   U         DOM helpers, maths, random numbers, browser storage
//   Bus       a tiny event bus: the game announces things ("type", "word", "win"...) and the worlds,
//             the mascot, the sounds and the achievements react to them
//   Settings  the player's settings, saved in this browser

const U = (() => {
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

    // el("div", { class: "card", text: "hi" }, child, child...)
    function el(tag, attrs = {}, ...kids) {
        const node = document.createElement(tag);
        for (const [key, value] of Object.entries(attrs || {})) {
            if (value == null || value === false) continue;
            if (key === "class") node.className = value;
            else if (key === "text") node.textContent = value;
            else if (key === "html") node.innerHTML = value;
            else if (key === "style" && typeof value === "object") {
                // "--name" CSS variables need setProperty (plain assignment silently ignores them)
                for (const [prop, v] of Object.entries(value)) {
                    if (prop.startsWith("--")) node.style.setProperty(prop, v);
                    else node.style[prop] = v;
                }
            }
            else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
            else node.setAttribute(key, value === true ? "" : value);
        }
        for (const kid of kids.flat()) if (kid != null && kid !== false) node.append(kid);
        return node;
    }

    const SVG_NS = "http://www.w3.org/2000/svg";
    function svg(tag, attrs = {}, parent = null) {
        const node = document.createElementNS(SVG_NS, tag);
        for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
        if (parent) parent.appendChild(node);
        return node;
    }

    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const lerp = (a, b, t) => a + (b - a) * t;
    const rand = (a, b) => a + Math.random() * (b - a);
    const pick = list => list[Math.floor(Math.random() * list.length)];
    const ease = {
        outCubic: k => 1 - (1 - k) ** 3,
        inCubic: k => k * k * k,
        inOutCubic: k => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2),
        outBack: k => 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2,
        outExpo: k => (k >= 1 ? 1 : 1 - 2 ** (-10 * k)),
        inOutSine: k => -(Math.cos(Math.PI * k) - 1) / 2
    };

    // A repeatable random number generator: the same seed always gives the same numbers
    function rng(seed) {
        let a = seed | 0;
        return () => {
            a = (a + 0x6d2b79f5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    function hash(text) {
        let h = 7;
        for (const ch of String(text)) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
        return h;
    }

    // Saving failed (storage blocked in a private window, or full): the player is told once a visit, so the game
    // never seems to have saved something it didn't. Returns false, for the caller to pass on.
    let saveWarned = false;
    function saveFailed(err) {
        if (saveWarned) return false;
        saveWarned = true;
        const full = err && (err.name === "QuotaExceededError" || err.code === 22 || err.code === 1014);
        setTimeout(() => typeof FX !== "undefined" && FX.toast({
            icon: "⚠️", kicker: "SAVING", ms: 9000,
            title: full ? "Browser Storage Is Full" : "Progress Isn't Being Saved",
            text: full ? "Free some space for this site in your browser's settings, or a reload may lose this puzzle."
                : "This browser is blocking storage, as private windows can. You can keep playing, but a reload starts over."
        }), 0);
        return false;
    }
    // Writes a value to browser storage; false (and the notice above) if it couldn't
    function saveRaw(fullKey, text) {
        try { localStorage.setItem(fullKey, text); return true; } catch (err) { return saveFailed(err); }
    }

    // Browser storage under "schmoll.<key>". Storage can be blocked (private mode): then nothing is saved.
    const store = {
        get(key, fallback) {
            try {
                const raw = localStorage.getItem("schmoll." + key);
                return raw == null ? fallback : JSON.parse(raw);
            } catch (err) {
                return fallback;
            }
        },
        set(key, value) {
            return saveRaw("schmoll." + key, JSON.stringify(value));
        },
        remove(key) {
            try { localStorage.removeItem("schmoll." + key); } catch (err) { /* storage blocked */ }
        }
    };

    // How much motion the player wants: "full", "lite" (fewer particles, 30 fps scenes) or "still" (no animation)
    // (asked every frame by every animation, so the system setting is read once and then followed by its change event)
    const reduceMQ = matchMedia("(prefers-reduced-motion: reduce)");
    let reduce = reduceMQ.matches;
    reduceMQ.addEventListener("change", e => { reduce = e.matches; });
    function motion() {
        if (reduce) return "still";
        return Settings.get("effects") === "lite" ? "lite" : "full";
    }

    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

    // Play a one-shot CSS animation (a class) again. The classes it adds stay on the element afterwards, so the ones
    // started before on the same element are taken off first: a square that was once "scorched" kept that class, and
    // its stronger rule silently replaced every later flip or shake on it.
    // A class that's already on (or was taken off a moment ago) is taken off and put back two frames later, once the
    // browser has drawn the element without it. (It used to be put back at once after reading offsetWidth, which made
    // the browser restyle the whole page on the spot: typing a letter did that dozens of times.)
    function restart(node, cls) {
        if (!node) return;
        const shots = node._shots || (node._shots = new Set());
        const now = performance.now(), recent = now - (node._shotAt || -1e9) < 50;
        for (const c of shots) if (c !== cls && node.classList.contains(c)) { node.classList.remove(c); node._shotAt = now; }
        shots.clear();
        shots.add(cls);
        const token = node._shotToken = (node._shotToken || 0) + 1;
        if (!node.classList.contains(cls) && !recent) { node.classList.add(cls); return; }
        node.classList.remove(cls);
        node._shotAt = now;
        requestAnimationFrame(() => requestAnimationFrame(() => { if (node._shotToken === token) node.classList.add(cls); }));
    }

    const fmtTime = s => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const touch = () => matchMedia("(pointer: coarse)").matches;

    // The screen from the part of the URL after "#": "", "daily", "campaign" (the map), "level" (a campaign level), "stats", "settings"
    const VIEWS = ["daily", "campaign", "level", "stats", "settings"];
    function view() {
        const v = location.hash.replace("#", "");
        return VIEWS.includes(v) ? v : "home";
    }

    function debounce(fn, ms) {
        let id = 0;
        return (...args) => { clearTimeout(id); id = setTimeout(() => fn(...args), ms); };
    }

    // The middle of an element, in screen pixels
    function center(node) {
        const r = node.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
    }

    // Keep a position: fixed piece over the page content it was placed on (a letter flying off the board...) while the
    // page scrolls: it's moved by however far the page has scrolled since. Uses the CSS translate property, so the
    // piece's own transform animations still work. Call it after the piece is in the page.
    const pinned = new Set();
    function movePins() {
        for (const n of pinned) {
            if (!n.isConnected) { pinned.delete(n); continue; }
            n.style.translate = `${n._pinX - scrollX}px ${n._pinY - scrollY}px`;
        }
        if (!pinned.size) removeEventListener("scroll", movePins);
    }
    function pin(node) {
        node._pinX = scrollX;
        node._pinY = scrollY;
        if (!pinned.size) addEventListener("scroll", movePins, { passive: true });
        pinned.add(node);
        return node;
    }

    // An in-page yes/no question (instead of the browser's confirm() box). Resolves true for yes.
    // Escape, a click outside, or the "no" button answer no; "no" has focus, so a stray Enter is safe.
    function ask({ title, text = "", yes = "Yes", no = "Cancel" }) {
        return new Promise(resolve => {
            const modal = el("div", { class: "results ask-modal", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "ask-title" });
            const noBtn = el("button", { type: "button", class: "btn ghost", text: no });
            const yesBtn = el("button", { type: "button", class: "btn primary", text: yes });
            modal.appendChild(el("div", { class: "res-card ask-card" },
                el("h2", { id: "ask-title", class: "res-title ask-title", text: title }),
                text ? el("p", { class: "ask-text", text }) : null,
                el("div", { class: "res-actions" }, noBtn, yesBtn)));
            let answered = false;
            const done = answer => {
                if (answered) return;
                answered = true;
                removeEventListener("keydown", onKey, true);
                dialog.close(modal);
                modal.classList.remove("in");
                modal.classList.add("out");
                setTimeout(() => modal.remove(), 300);
                resolve(answer);
            };
            const onKey = e => { if (e.key === "Escape" && dialog.top(modal)) { e.preventDefault(); e.stopPropagation(); done(false); } };
            noBtn.addEventListener("click", () => done(false));
            yesBtn.addEventListener("click", () => done(true));
            modal.addEventListener("pointerdown", e => { if (e.target === modal) done(false); });
            addEventListener("keydown", onKey, true);
            dialog.open(modal);
            (document.getElementById("overlay") || document.body).appendChild(modal);
            requestAnimationFrame(() => modal.classList.add("in"));
            setTimeout(() => noBtn.focus({ preventScroll: true }), 60);
        });
    }

    // The game's own small icons, drawn here so they look the same on every device (emoji differ between systems)
    const ICONS = {
        coin: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#d98e04"/><circle cx="12" cy="12" r="9.3" fill="#ffcf4a"/>`
            + `<circle cx="12" cy="12" r="7" fill="none" stroke="#e39b12" stroke-width="1.2"/>`
            + `<path d="M14.6 9.3c-.5-.8-1.5-1.3-2.6-1.3-1.6 0-2.6.8-2.6 1.9 0 2.7 5.4 1.4 5.4 4.2 0 1.2-1.1 2-2.8 2-1.2 0-2.3-.5-2.8-1.4M12 6.6v1.4M12 16.1v1.3" fill="none" stroke="#a8650a" stroke-width="1.6" stroke-linecap="round"/>`
            + `<path d="M5.7 9a7 7 0 0 1 3.6-3.6" fill="none" stroke="#fff4c9" stroke-width="1.5" stroke-linecap="round"/></svg>`
    };
    // line icons in the text's own colour (one stroke weight); the filled ones are solid shapes
    const LINE = {
        star: '<path d="M12 2.8l2.75 5.6 6.15.9-4.45 4.35 1.05 6.1L12 16.85 6.5 19.75l1.05-6.1L3.1 9.3l6.15-.9z"/>',
        lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/>',
        play: '<path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.6-6.8a.8.8 0 0 0 0-1.4L9.2 4.5A.8.8 0 0 0 8 5.2z"/>',
        back: '<path d="M15 5l-7 7 7 7"/>',
        next: '<path d="M9 5l7 7-7 7"/>',
        close: '<path d="M6 6l12 12M18 6L6 18"/>',
        book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
        bolt: '<path d="M13 2.5L4.5 13.5H11l-1 8 8.5-11H12z"/>',
        hero: '<circle cx="12" cy="7.5" r="4"/><path d="M4 21.5c.6-4.4 3.9-7 8-7s7.4 2.6 8 7"/>',
        bag: '<path d="M5 8h14l-1.2 12.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 10.5V6.8a3 3 0 0 1 6 0v3.7"/>',
        help: '<circle cx="12" cy="12" r="9.5"/><path d="M9.4 9.3a2.7 2.7 0 0 1 5.2 1c0 1.9-2.6 2.3-2.6 4.2"/><circle cx="12" cy="17.6" r=".6"/>',
        check: '<path d="M4.5 12.5l5 5L19.5 7"/>',
        spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.6 2.6M15.4 15.4L18 18M18 6l-2.6 2.6M8.6 15.4L6 18"/>',
        list: '<path d="M8.5 6.5h12M8.5 12h12M8.5 17.5h12"/><circle cx="4.2" cy="6.5" r=".9"/><circle cx="4.2" cy="12" r=".9"/><circle cx="4.2" cy="17.5" r=".9"/>',
        ribbon: '<path d="M6 2.5h12v19l-6-4.2-6 4.2z"/>',
        clock: '<circle cx="12" cy="12" r="9.5"/><path d="M12 6.8V12l3.6 2.2"/>',
        replay: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/>',
        map: '<path d="M9 4L3.5 6v14L9 18l6 2 5.5-2V4L15 6z"/><path d="M9 4v14M15 6v14"/>',
        pencil: '<path d="M4 20l1-4.5L16.5 4a2.1 2.1 0 0 1 3 0l.5.5a2.1 2.1 0 0 1 0 3L8.5 19z"/><path d="M14.5 6l3.5 3.5"/>'
    };
    const FILLED = new Set(["star", "play", "bolt", "ribbon"]);
    for (const [name, paths] of Object.entries(LINE)) {
        ICONS[name] = `<svg viewBox="0 0 24 24" aria-hidden="true" ${FILLED.has(name) ? 'fill="currentColor" stroke="none"' : 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"'}>${paths}</svg>`;
    }
    function icon(name, cls = "") {
        return el("span", { class: "ic ic-" + name + (cls ? " " + cls : ""), "aria-hidden": "true", html: ICONS[name] || "" });
    }

    // The page's zoom (Settings > Zoom; app.js puts it on #app). Measurements (getBoundingClientRect) are on-screen
    // sizes, so a position measured on screen and then set as CSS INSIDE #app is divided by this.
    const zoom = () => parseFloat(document.getElementById("app")?.style.zoom) || 1;

    // ---------------------------------------------------------------------------------------------
    // Things going wrong: fetchJson throws an error that knows what happened (offline, the server's status, how
    // long it asked us to wait), describe() turns it into words for the player, and failCard() shows them with
    // Try Again, Home and Report.
    // ---------------------------------------------------------------------------------------------
    const CONTACT = "schmollcrossword@gmail.com";
    async function fetchJson(url, opts) {
        let r;
        try {
            r = await fetch(url, opts);
        } catch (e) {
            throw Object.assign(new Error(navigator.onLine === false ? "offline" : "network"), { offline: navigator.onLine === false, network: true });
        }
        if (!r.ok) {
            const err = Object.assign(new Error("the server answered " + r.status), { status: r.status, retryAfter: parseInt(r.headers.get("Retry-After"), 10) || 0 });
            try { const j = await r.json(); err.reason = j.error || j.message || ""; } catch (e) { /* not JSON */ }
            throw err;
        }
        try {
            return await r.json();
        } catch (e) {
            throw Object.assign(new Error("a damaged answer"), { status: 0 });
        }
    }
    function describe(err) {
        const s = err && err.status;
        if (err && (err.offline || navigator.onLine === false)) return { title: "You're Offline", text: "Connect to the internet and it will try again." };
        if (err && err.network) return { title: "Couldn't Reach the Server", text: "Check your connection, then try again." };
        if (s === 503) return { title: "This Puzzle Isn't Ready Yet", text: "It's still being made.", retryIn: Math.min(120, Math.max(5, err.retryAfter || 30)) };
        if (s === 429) return { title: "Too Many Requests", text: "Wait a minute, then try again.", retryIn: Math.min(300, err.retryAfter || 0) || undefined };
        if (s === 404) return { title: "Puzzle Not Found", text: "This puzzle isn't available." };
        if (s === 400) return { title: "This Puzzle Can't Be Opened", text: "Reload the page. If your device's date is wrong, fix it first." };
        if (s >= 500) return { title: "Something Went Wrong on Our Side", text: "Try again in a moment. If it keeps happening, let us know." };
        return { title: "Something Went Wrong", text: "Try again. If it keeps happening, let us know." };
    }
    // Fills `box` with the problem and its buttons. retry: what Try Again does (and what runs by itself when a
    // countdown ends or the connection comes back). Returns the card.
    function failCard(box, err, { retry, home = true } = {}) {
        const d = describe(err);
        const text = el("p", { class: "fail-text", text: d.text });
        const actions = el("div", { class: "fail-actions" });
        const card = el("div", { class: "fail-card", role: "alert" }, el("h2", { class: "fail-title", text: d.title }), text, actions);
        let timer = 0, onOnline = null;
        const stop = () => { clearInterval(timer); if (onOnline) removeEventListener("online", onOnline); };
        const again = () => { stop(); if (retry) retry(); };
        if (retry) actions.append(el("button", { type: "button", class: "btn primary", text: "Try Again", onclick: again }));
        if (home) actions.append(el("a", { class: "btn ghost", href: "#", text: "Home", onclick: stop }));
        const subject = encodeURIComponent("Schmoll Crossword: " + d.title);
        const body = encodeURIComponent(`What I was doing:\n\n\n(${location.hash || "#"} · ${err && err.status ? "status " + err.status : err && err.message || ""} · ${new Date().toISOString()})`);
        actions.append(el("a", { class: "btn ghost", href: `mailto:${CONTACT}?subject=${subject}&body=${body}`, text: "Report" }));
        box.replaceChildren(card);
        if (retry && d.retryIn) {
            let left = d.retryIn;
            const tick = () => {
                if (!card.isConnected) return stop();
                if (left <= 0) return again();
                text.textContent = `${d.text} Trying again in ${left} s.`;
                left--;
            };
            tick();
            timer = setInterval(tick, 1000);
        }
        if (retry && (err && (err.offline || err.network))) {
            onOnline = () => { if (card.isConnected) again(); else stop(); };
            addEventListener("online", onOnline);
        }
        return card;
    }

    // Dialogs can open on top of each other (a question over the Privacy Notice): each one listening for Escape on the
    // whole window only acts when it's the newest one still open. dialog.open(el) when it opens, dialog.close(el) when
    // it closes, dialog.top(el) in its key handler.
    const dialogs = [];
    const dialog = {
        open(d) { dialogs.push(d); },
        close(d) { const i = dialogs.lastIndexOf(d); if (i >= 0) dialogs.splice(i, 1); },
        top(d) { const live = dialogs.filter(x => x.isConnected); return !live.length || live[live.length - 1] === d; }
    };

    return { $, $$, el, svg, clamp, lerp, rand, pick, ease, rng, hash, store, saveRaw, saveFailed, motion, wait, restart, fmtTime, esc, touch, view, debounce, center, ask, pin, zoom, dialog,
        CONTACT, fetchJson, describe, failCard, icon };
})();

// The event bus. Bus.on("win", fn) listens; Bus.emit("win", info) tells every listener.
const Bus = {
    handlers: {},
    on(name, fn) { (this.handlers[name] || (this.handlers[name] = [])).push(fn); },
    emit(name, ...args) {
        for (const fn of this.handlers[name] || []) {
            try { fn(...args); } catch (err) { console.error("Bus", name, err); }
        }
    }
};

// The player's settings
const Settings = (() => {
    const KEY = "schmoll.settings";
    const DEFAULTS = {
        difficulty: "medium",   // what Daily starts on
        showTimer: true,
        theme: "light",         // light / dark (each world decides what that looks like)
        design: "classic",      // the world: the id of one of js/worlds/*.js (new players start on the plain Classic page)
        // Sound. Every
        // volume is a slider position from 0 to 1; Settings.gain(key) turns it into loudness (see VOLUME_DB).
        sound: true,            // all sound on or off: the mute button by Master Volume (sound effects are made in code, see sound.js)
        volume: 0.8,            // Master Volume: everything (80% is full loudness; above that is louder still, see masterGainOf)
        levelMusicVolume: 1,    // each campaign level's own chill song (audio/music/level-<world>-<n>.mp3), and the credits
        bossMusicVolume: 1,     // boss fights, the story, winning and losing (also the slider in every boss fight); 0 = off
        fxVolume: 1,            // All Effects
        bossFxVolume: 1,        // Boss Fight Effects: the bosses' moves and your abilities, on top of All Effects
        typingSounds: true,     // typing, erasing and moving on the board
        clickSounds: true,      // buttons, menus and switches
        zoom: 1,                // Zoom: 0.6-1.4, smaller = more fits on screen, bigger = easier to read (applyZoom in app.js)
        intro: false,           // play the start-up intro on every visit (it always plays the very first time)
        effects: "full"         // "full" or "lite"
    };
    // A volume slider is a loudness curve, not a straight line: 100% is full, every step down is the same number of decibels, and 1% is VOLUME_DB below
    // full (about the quietest sound you'd still notice). 0 is silent.
    const VOLUME_DB = 50;
    const gainOf = x => (x > 0 ? Math.pow(10, (Math.min(1, x) - 1) * VOLUME_DB / 20) : 0);
    // the slider position that's as loud as an old straight-line volume (older saves)
    const posOf = linear => (linear > 0 ? Math.max(0.01, Math.round((1 + 20 * Math.log10(Math.min(1, linear)) / VOLUME_DB) * 100) / 100) : 0);
    // Master Volume has headroom: 80% is full loudness (1% is VOLUME_DB below it) and 100% is MASTER_BOOST_DB above it
    // (sound.js's compressor keeps that from clipping)
    const MASTER_FULL = 0.8, MASTER_BOOST_DB = 6;
    const masterGainOf = x => {
        if (!(x > 0)) return 0;
        const db = x <= MASTER_FULL ? (x - MASTER_FULL) / (MASTER_FULL - 0.01) * VOLUME_DB : (Math.min(1, x) - MASTER_FULL) / (1 - MASTER_FULL) * MASTER_BOOST_DB;
        return Math.pow(10, db / 20);
    };
    // a Master Volume saved on the old curve (100% = full) becomes the position that's just as loud on this one
    const masterPosOf = old => (old > 0 ? Math.max(0.01, Math.round((MASTER_FULL + (Math.min(1, old) - 1) * (MASTER_FULL - 0.01)) * 100) / 100) : 0);
    let values = load();
    const listeners = [];

    function load() {
        try {
            const raw = JSON.parse(localStorage.getItem(KEY)) || {};
            return migrate({ ...DEFAULTS, ...raw }, raw);
        } catch (err) {
            return { ...DEFAULTS };
        }
    }
    // Old sound settings (one Music Volume with Level Music and Boss Music switches, straight-line volumes) become the
    // new sliders at the same loudness; a switched-off music is a slider at 0.
    function migrate(v, raw) {
        if (raw.soundV === 3 || !["volume", "musicVolume", "fxVolume", "bossFxVolume", "bossMusic", "levelMusic"].some(k => k in raw)) { v.soundV = 3; return v; }
        if (raw.soundV === 2) {                      // the sliders are right; only Master Volume moves to its new curve
            v.volume = masterPosOf(typeof raw.volume === "number" ? raw.volume : 0.96);
            v.soundV = 3;
            U.saveRaw(KEY, JSON.stringify(v));
            return v;
        }
        const lin = (k, d) => (typeof raw[k] === "number" ? raw[k] : d);
        v.volume = masterPosOf(posOf(lin("volume", 0.8)));
        v.fxVolume = posOf(lin("fxVolume", 1));
        v.bossFxVolume = posOf(lin("bossFxVolume", 1));
        const music = posOf(lin("musicVolume", 1));
        v.levelMusicVolume = raw.levelMusic === false ? 0 : music;
        v.bossMusicVolume = raw.bossMusic === false ? 0 : music;
        delete v.musicVolume; delete v.bossMusic; delete v.levelMusic;
        v.soundV = 3;
        U.saveRaw(KEY, JSON.stringify(v));
        return v;
    }
    function save() {
        U.saveRaw(KEY, JSON.stringify(values));
    }
    return {
        get: key => values[key],
        gain: key => (key === "volume" ? masterGainOf(values.volume ?? MASTER_FULL) : gainOf(values[key] ?? 1)),   // a volume setting as loudness, along the curves above
        all: () => ({ ...values }),
        set(key, value) {
            if (values[key] === value) return;
            values[key] = value;
            save();
            for (const fn of listeners) fn(key, value);
        },
        on: fn => listeners.push(fn),
        reset() { values = { ...DEFAULTS }; }
    };
})();
