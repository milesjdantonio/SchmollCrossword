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
            try { localStorage.setItem("schmoll." + key, JSON.stringify(value)); } catch (err) { /* storage blocked */ }
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
    function restart(node, cls) {
        node.classList.remove(cls);
        void node.offsetWidth;
        node.classList.add(cls);
    }

    const fmtTime = s => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const touch = () => matchMedia("(pointer: coarse)").matches;

    // The screen from the part of the URL after "#": "", "daily", "unlimited", "campaign" (the map), "level" (a campaign level), "stats", "settings"
    const VIEWS = ["daily", "unlimited", "campaign", "level", "stats", "settings"];
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

    return { $, $$, el, svg, clamp, lerp, rand, pick, ease, rng, hash, store, motion, wait, restart, fmtTime, esc, touch, view, debounce, center, ask, pin };
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

// The player's settings (Step 24, grown in the redesign)
const Settings = (() => {
    const KEY = "schmoll.settings";
    const DEFAULTS = {
        difficulty: "medium",   // what Daily and Unlimited start on
        hardWords: false,       // Unlimited Hard: allow the extremely hard words
        showTimer: true,
        theme: "light",         // light / dark (each world decides what that looks like)
        design: "classic",      // the world: the id of one of js/worlds/*.js (new players start on the plain Classic page)
        sound: true,            // sound effects (made in code, see sound.js)
        bossMusic: true,        // music in campaign boss fights (CC0 tracks in audio/music)
        volume: 0.8,
        musicVolume: 1,         // boss music, on top of the main volume (Settings, and the slider in every boss fight)
        intro: true,            // play the start-up intro once per visit
        effects: "full"         // "full" or "lite"
    };
    let values = load();
    const listeners = [];

    function load() {
        try {
            const raw = JSON.parse(localStorage.getItem(KEY)) || {};
            return { ...DEFAULTS, ...raw };
        } catch (err) {
            return { ...DEFAULTS };
        }
    }
    function save() {
        try { localStorage.setItem(KEY, JSON.stringify(values)); } catch (err) { /* storage blocked */ }
    }
    return {
        get: key => values[key],
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
