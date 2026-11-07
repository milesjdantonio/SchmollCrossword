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

    // Remove and re-add a class so its CSS animation plays again
    // Play a one-shot CSS animation again. The classes it adds stay on the element afterwards, so the ones started
    // before on the same element are taken off first: a square that was once "scorched" kept that class, and its
    // stronger rule silently replaced every later flip or shake on it
    function restart(node, cls) {
        if (!node) return;
        const shots = node._shots || (node._shots = new Set());
        for (const c of shots) if (c !== cls) node.classList.remove(c);
        shots.clear();
        shots.add(cls);
        node.classList.remove(cls);
        void node.offsetWidth;
        node.classList.add(cls);
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
                modal.classList.remove("in");
                modal.classList.add("out");
                setTimeout(() => modal.remove(), 300);
                resolve(answer);
            };
            const onKey = e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); done(false); } };
            noBtn.addEventListener("click", () => done(false));
            yesBtn.addEventListener("click", () => done(true));
            modal.addEventListener("pointerdown", e => { if (e.target === modal) done(false); });
            addEventListener("keydown", onKey, true);
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
    function icon(name) {
        return el("span", { class: "ic ic-" + name, html: ICONS[name] || "" });
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

    return { $, $$, el, svg, clamp, lerp, rand, pick, ease, rng, hash, store, saveRaw, saveFailed, motion, wait, restart, fmtTime, esc, touch, view, debounce, center, ask, pin, zoom,
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
        volume: 0.96,           // Master Volume: everything
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
        if (raw.soundV === 2 || !["volume", "musicVolume", "fxVolume", "bossFxVolume", "bossMusic", "levelMusic"].some(k => k in raw)) { v.soundV = 2; return v; }
        const lin = (k, d) => (typeof raw[k] === "number" ? raw[k] : d);
        v.volume = posOf(lin("volume", 0.8));
        v.fxVolume = posOf(lin("fxVolume", 1));
        v.bossFxVolume = posOf(lin("bossFxVolume", 1));
        const music = posOf(lin("musicVolume", 1));
        v.levelMusicVolume = raw.levelMusic === false ? 0 : music;
        v.bossMusicVolume = raw.bossMusic === false ? 0 : music;
        delete v.musicVolume; delete v.bossMusic; delete v.levelMusic;
        v.soundV = 2;
        U.saveRaw(KEY, JSON.stringify(v));
        return v;
    }
    function save() {
        U.saveRaw(KEY, JSON.stringify(values));
    }
    return {
        get: key => values[key],
        gain: key => gainOf(values[key] ?? 1),         // a volume setting as loudness (0-1), along the curve above
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
