// The "Garden" design (Settings > Theme > Design). Registered with Designs (designs.js); see DESIGN.md.
//   - every letter you type sprouts a bud in its square
//   - vines (with leaves and curly tendrils) grow between neighbouring filled squares of the same word
//   - when a word is full, its buds swell and open into flowers, one petal at a time
//   - seven kinds of flowers: daisy, sunflower, poppy, rose, tulip, cosmos, forget-me-not
//   - butterflies, bees and ladybugs wander by now and then (behind the page, never over the board)
//   - the win: the garden takes over. Stems shoot up both sides of the screen, every flower blooms in a wave
//     from the board outward, petals and butterflies drift, then the win panel slides in. The side flowers
//     stay until the next puzzle.
//
// Everything is drawn with SVG ("Scalable Vector Graphics": shapes described in code, sharp at any size).

const Garden = (() => {
    const SVG_NS = "http://www.w3.org/2000/svg";
    const PETAL_COLORS = ["#e8798f", "#f3a65a", "#b48ad8", "#ef8fb7", "#7fb4e8", "#e85d5d", "#f2c94c"];
    const FLOWER_TYPES = ["cosmos", "daisy", "poppy", "rose", "tulip", "sunflower", "forgetMeNot"];

    let layer = null, vineLayer = null, flowerLayer = null;   // the <svg> over the board and its two layers
    let vineEls = new Map();         // "r,c-r,c" -> the vine's <g> (kept between updates, so animations aren't cut short)
    let flowerEls = new Map();       // "r,c" -> { stage: "bud" or "bloom", node }
    let sides = null;                // the side-of-screen garden after a win
    let critterTimer = null;
    let lastGame = null;
    const reduceMotion = () => Designs.reduceMotion();

    function el(name, attrs = {}, parent = null) {
        const node = document.createElementNS(SVG_NS, name);
        for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
        if (parent) parent.appendChild(node);
        return node;
    }

    // ---------------------------------------------------------------------------------------------
    // Shading: one radial gradient per color (light in the middle, the color at the edge), made once and
    // kept in a hidden <svg> on the page. Any SVG on the page can use it as fill="url(#id)".
    // ---------------------------------------------------------------------------------------------
    let defs = null;
    const lighten = (hex, amount) => {
        const n = parseInt(hex.slice(1), 16);
        const mix = (v) => Math.round(v + (255 - v) * amount);
        return "rgb(" + mix(n >> 16) + "," + mix((n >> 8) & 255) + "," + mix(n & 255) + ")";
    };
    const darken = (hex, amount) => {       // returns "#rrggbb", so the result can be shaded again
        const n = parseInt(hex.slice(1), 16);
        const mix = (v) => Math.round(v * (1 - amount)).toString(16).padStart(2, "0");
        return "#" + mix(n >> 16) + mix((n >> 8) & 255) + mix(n & 255);
    };
    function shade(color) {
        if (!defs) {
            const holder = el("svg", { width: 0, height: 0, "aria-hidden": "true", style: "position:absolute" });
            defs = el("defs", {}, holder);
            document.body.appendChild(holder);
        }
        const id = "gshade-" + color.slice(1);
        if (!document.getElementById(id)) {
            const g = el("radialGradient", { id, cx: "50%", cy: "85%", r: "90%" }, defs);
            el("stop", { offset: "0%", "stop-color": lighten(color, 0.55) }, g);
            el("stop", { offset: "70%", "stop-color": color }, g);
            el("stop", { offset: "100%", "stop-color": darken(color, 0.15) }, g);
        }
        return "url(#" + id + ")";
    }

    // ---------------------------------------------------------------------------------------------
    // Flowers. Each is drawn around (0, 0) with a radius of about 1. Every petal sits in its own
    // <g rotate> so CSS can unfold the petals one at a time (class "petal", delay set per petal).
    // ---------------------------------------------------------------------------------------------
    function petals(g, count, shapeFor, offset = 0, delayStep = 0.045, startDelay = 0) {
        for (let i = 0; i < count; i++) {
            const holder = el("g", { transform: `rotate(${offset + (i * 360) / count})` }, g);
            const petal = shapeFor(i);
            petal.classList.add("petal");
            petal.style.animationDelay = (startDelay + i * delayStep).toFixed(3) + "s";
            holder.appendChild(petal);
        }
    }
    function middle(g, r, fill, stroke, dots = 0, dotColor = "#8a5a1c") {
        const c = el("g", { class: "flower-middle" }, g);
        el("circle", { r, fill, stroke, "stroke-width": r * 0.18 }, c);
        for (let i = 0; i < dots; i++) {          // seeds in a spiral, like a real sunflower
            const a = i * 2.4, d = Math.sqrt(i / dots) * r * 0.8;
            el("circle", { cx: (Math.cos(a) * d).toFixed(3), cy: (Math.sin(a) * d).toFixed(3), r: r * 0.07, fill: dotColor }, c);
        }
        return c;
    }

    const FLOWERS = {
        cosmos(color) {
            const g = el("g");
            petals(g, 8, () => el("path", { d: "M0,-0.15 C0.32,-0.3 0.34,-0.85 0.2,-1 L0,-0.9 L-0.2,-1 C-0.34,-0.85 -0.32,-0.3 0,-0.15Z", fill: shade(color) }));
            middle(g, 0.26, "#f7d774", "#e0a93b", 8);
            return g;
        },
        daisy() {
            const g = el("g");
            petals(g, 14, () => el("ellipse", { cx: 0, cy: -0.55, rx: 0.13, ry: 0.45, fill: shade("#f4f1ea"), stroke: "#d9d3c4", "stroke-width": 0.03 }), 0, 0.03);
            middle(g, 0.27, "#f6c933", "#d99a1e", 10);
            return g;
        },
        poppy(color) {
            const g = el("g");
            const red = color === "#f2c94c" ? "#e85d5d" : color;
            petals(g, 4, () => el("path", { d: "M0,0 C0.6,-0.12 0.66,-0.98 0,-0.98 C-0.66,-0.98 -0.6,-0.12 0,0Z", fill: shade(red) }), 45, 0.08);
            const m = middle(g, 0.2, "#2d2a26", "#1a1816");
            for (let i = 0; i < 10; i++) {              // stamens around the dark middle
                const a = (i / 10) * Math.PI * 2;
                el("circle", { cx: (Math.cos(a) * 0.3).toFixed(3), cy: (Math.sin(a) * 0.3).toFixed(3), r: 0.045, fill: "#2d2a26" }, m);
            }
            return g;
        },
        rose(color) {
            const g = el("g");
            petals(g, 5, () => el("circle", { cx: 0, cy: -0.48, r: 0.46, fill: shade(color) }), 0, 0.06);
            petals(g, 5, () => el("circle", { cx: 0, cy: -0.27, r: 0.32, fill: shade(darken(color, 0.12)) }), 36, 0.06, 0.25);
            const swirl = el("g", { class: "flower-middle" }, g);
            el("circle", { r: 0.22, fill: darken(color, 0.25) }, swirl);
            el("path", { d: "M0.12,0 A0.12,0.12 0 1 1 0,-0.12 A0.07,0.07 0 1 1 -0.06,0", fill: "none", stroke: lighten(color, 0.3), "stroke-width": 0.04, "stroke-linecap": "round" }, swirl);
            return g;
        },
        tulip(color) {
            // seen from the side: two back petals, then the front one
            const outer = el("g");
            const g = el("g", { transform: "translate(0,0.2)" }, outer);
            const back = (side) => el("path", { d: `M0,0.45 C${side * 0.7},0.4 ${side * 0.75},-0.3 ${side * 0.45},-0.8 C${side * 0.3},-0.45 ${side * 0.1},-0.3 0,-0.2Z`, fill: shade(darken(color, 0.1)) });
            for (const [i, side] of [[0, -1], [1, 1]]) {
                const p = back(side);
                p.classList.add("petal");
                p.style.animationDelay = i * 0.07 + "s";
                g.appendChild(p);
            }
            const front = el("path", { d: "M0,0.5 C-0.5,0.45 -0.5,-0.4 0,-0.85 C0.5,-0.4 0.5,0.45 0,0.5Z", fill: shade(color), class: "petal" }, g);
            front.style.animationDelay = "0.16s";
            el("path", { d: "M0,0.4 L0,-0.4", stroke: lighten(color, 0.4), "stroke-width": 0.04, opacity: 0.6, class: "flower-middle" }, g);
            return outer;
        },
        sunflower() {
            const g = el("g");
            petals(g, 13, () => el("path", { d: "M0,-0.25 Q0.17,-0.62 0,-1 Q-0.17,-0.62 0,-0.25", fill: shade("#f0a830") }), 14, 0.025);
            petals(g, 13, () => el("path", { d: "M0,-0.25 Q0.15,-0.58 0,-0.92 Q-0.15,-0.58 0,-0.25", fill: shade("#f6c933") }), 0, 0.025, 0.12);
            middle(g, 0.4, "#6b3f1d", "#4a2a12", 26, "#c58b3a");
            return g;
        },
        forgetMeNot(color) {
            const g = el("g");
            const blue = color === "#7fb4e8" || color === "#b48ad8" ? color : "#7fb4e8";
            petals(g, 5, () => el("circle", { cx: 0, cy: -0.5, r: 0.38, fill: shade(blue) }), 0, 0.05);
            el("circle", { r: 0.2, fill: "#fffdf2", class: "flower-middle" }, g);
            el("circle", { r: 0.1, fill: "#f2c94c", class: "flower-middle" }, g);
            return g;
        }
    };

    function flower(type, color) {
        return (FLOWERS[type] || FLOWERS.cosmos)(color);
    }

    // A bud: two veined leaves and a closed bud in the petal color
    function bud(color) {
        const g = el("g");
        g.appendChild(leaf(-1));
        g.appendChild(leaf(1));
        el("path", { d: "M0,0.1 C-0.38,-0.05 -0.3,-0.55 0,-0.75 C0.3,-0.55 0.38,-0.05 0,0.1Z", fill: shade(color), class: "bud-head" }, g);
        el("path", { d: "M0,0.1 C-0.25,0 -0.22,-0.3 -0.08,-0.4 M0,0.1 C0.25,0 0.22,-0.3 0.08,-0.4", fill: "none", stroke: "var(--leaf)", "stroke-width": 0.08, class: "bud-head" }, g);
        return g;
    }

    // A leaf with a vein down the middle. side -1 = pointing left, 1 = right
    function leaf(side, scale = 0.7) {
        const g = el("g", { transform: `translate(0,0.15) scale(${side * scale},${scale}) rotate(-30)` });
        el("path", { d: "M0,0 C0.3,-0.28 0.75,-0.22 1,0 C0.75,0.22 0.3,0.28 0,0Z", fill: "var(--leaf)" }, g);
        el("path", { d: "M0.05,0 Q0.5,-0.03 0.9,0", fill: "none", stroke: "var(--vine)", "stroke-width": 0.05, opacity: 0.7 }, g);
        return g;
    }

    // ---------------------------------------------------------------------------------------------
    // The board
    // ---------------------------------------------------------------------------------------------

    // The same square always gets the same flower and color, so nothing changes while you type
    const typeFor = (r, c) => FLOWER_TYPES[(r * 3 + c * 5 + r * c) % FLOWER_TYPES.length];
    const colorFor = (r, c) => PETAL_COLORS[(r * 7 + c * 3) % PETAL_COLORS.length];

    // A wavy vine from one square to the next, with a veined leaf and sometimes a curly tendril.
    // Across vines run along the lower part of the squares, Down vines along the right side;
    // they cross where the flowers sit (the lower-right of each square).
    function vine(r1, c1, r2, c2) {
        const across = r1 === r2;
        const x1 = c1 + 0.8, y1 = r1 + 0.8, x2 = c2 + 0.8, y2 = r2 + 0.8;
        const d = across
            ? `M${x1},${y1} C${x1 + 0.33},${y1 - 0.16} ${x1 + 0.66},${y1 + 0.16} ${x2},${y2}`
            : `M${x1},${y1} C${x1 + 0.16},${y1 + 0.33} ${x1 - 0.16},${y1 + 0.66} ${x2},${y2}`;
        const g = el("g", { class: "vine grow" });
        el("path", { d, pathLength: 1, class: "vine-stem" }, g);
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        const leafHolder = el("g", { transform: `translate(${mx},${my}) rotate(${across ? -40 : 50}) scale(0.16)`, class: "vine-leaf" }, g);
        leafHolder.appendChild(leaf(1, 1));
        if ((r1 + c1 + (across ? 0 : 1)) % 2 === 0) {      // a tendril on every other vine, curling as it grows
            const tx = across ? x1 + 0.3 : x1 + 0.06, ty = across ? y1 - 0.05 : y1 + 0.3;
            const s = across ? -1 : 1;
            el("path", {
                d: `M${tx},${ty} c${0.05 * s},${-0.12} ${0.17 * s},${-0.12} ${0.15 * s},${-0.03} c${-0.02 * s},${0.06} ${-0.09 * s},${0.05} ${-0.08 * s},0`,
                pathLength: 1, class: "vine-tendril"
            }, g);
        }
        return g;
    }

    // Make the garden match the game: add new vines and flowers, remove erased ones, open finished words.
    function update(game, boardEl) {
        lastGame = game;
        startCritters();
        const size = game.puzzle.size;
        if (!layer || !boardEl.contains(layer)) {        // a new board was drawn: start a fresh garden
            layer = el("svg", { class: "garden", viewBox: `0 0 ${size} ${size}`, preserveAspectRatio: "none", "aria-hidden": "true" });
            vineLayer = el("g", {}, layer);
            flowerLayer = el("g", {}, layer);
            boardEl.appendChild(layer);
            vineEls = new Map();
            flowerEls = new Map();
        }

        const filled = (r, c) => game.letters[r][c] !== "";
        const wantedVines = new Map();                   // key -> [r1, c1, r2, c2]
        const fullWordSquares = new Set();
        for (const entry of [...game.puzzle.across, ...game.puzzle.down]) {
            const cells = Designs.cellsOf(entry);
            for (let i = 0; i + 1 < cells.length; i++) {
                const [r1, c1] = cells[i], [r2, c2] = cells[i + 1];
                if (filled(r1, c1) && filled(r2, c2)) wantedVines.set(`${r1},${c1}-${r2},${c2}`, [r1, c1, r2, c2]);
            }
            if (cells.every(([r, c]) => filled(r, c))) cells.forEach(([r, c]) => fullWordSquares.add(`${r},${c}`));
        }

        // Vines: remove erased ones, grow new ones
        for (const [key, node] of vineEls) {
            if (!wantedVines.has(key)) { node.remove(); vineEls.delete(key); }
        }
        for (const [key, [r1, c1, r2, c2]] of wantedVines) {
            if (vineEls.has(key)) continue;
            const node = vine(r1, c1, r2, c2);
            vineLayer.appendChild(node);
            vineEls.set(key, node);
        }

        // Flowers: a bud on every filled square, opened into a flower once one of its words is full.
        // A surrendered puzzle (Reveal puzzle) keeps its buds: no flowers for giving up.
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const key = `${r},${c}`;
                const stage = !filled(r, c) ? null
                    : fullWordSquares.has(key) && !game.surrendered ? "bloom" : "bud";
                const current = flowerEls.get(key);
                if (current && current.stage === stage) continue;   // nothing changed here
                const wasBud = current && current.stage === "bud";
                if (current) { current.node.remove(); flowerEls.delete(key); }
                if (!stage) continue;
                const holder = el("g", { transform: `translate(${c + 0.8},${r + 0.8}) scale(${stage === "bloom" ? 0.17 : 0.14})` });
                const sway = el("g", { class: "sway", style: `animation-delay:-${((r * 5 + c * 3) % 7) * 0.4}s` }, holder);
                const inner = stage === "bloom" ? flower(typeFor(r, c), colorFor(r, c)) : bud(colorFor(r, c));
                inner.setAttribute("class", stage + " pop" + (stage === "bloom" && wasBud ? " from-bud" : ""));
                sway.appendChild(inner);
                flowerLayer.appendChild(holder);
                flowerEls.set(key, { stage, node: holder });
            }
        }
    }

    // A finished word: a little burst of sparkles over its new flowers
    function wordDone(entry, cells, boardEl) {
        if (reduceMotion() || !layer || lastGame?.surrendered) return;
        cells.forEach(([r, c], i) => {
            const spot = el("g", { transform: `translate(${c + 0.8},${r + 0.8})` }, layer);
            const burst = el("g", { class: "sparkle-burst", style: `animation-delay:${i * 0.07}s` }, spot);
            for (let k = 0; k < 6; k++) {
                const a = (k / 6) * Math.PI * 2;
                el("circle", { cx: (Math.cos(a) * 0.32).toFixed(3), cy: (Math.sin(a) * 0.32).toFixed(3), r: 0.03, fill: "#f7d774" }, burst);
            }
            setTimeout(() => spot.remove(), 1200 + i * 70);
        });
    }

    // ---------------------------------------------------------------------------------------------
    // Critters: one at a time, now and then, flying across the page BEHIND the content
    // ---------------------------------------------------------------------------------------------
    function critterLayer() {
        let node = document.querySelector(".critter-layer");
        if (!node) {
            node = document.createElement("div");
            node.className = "critter-layer";
            node.setAttribute("aria-hidden", "true");
            document.body.prepend(node);
        }
        return node;
    }

    function butterfly(color) {
        const svg = el("svg", { viewBox: "-1.2 -1.2 2.4 2.4", class: "critter butterfly" });
        const body = el("g", {}, svg);
        for (const side of [-1, 1]) {
            const wing = el("g", { class: "wing" }, body);
            el("path", { d: `M0,0 C${side * 0.4},-1.1 ${side * 1.2},-0.9 ${side * 1},-0.1 C${side * 0.9},0.2 ${side * 0.4},0.1 0,0Z`, fill: shade(color) }, wing);
            el("path", { d: `M0,0.05 C${side * 0.6},0.2 ${side * 0.8},0.8 ${side * 0.3},0.85 C${side * 0.1},0.8 0,0.4 0,0.05Z`, fill: shade(color), opacity: 0.9 }, wing);
            el("circle", { cx: side * 0.62, cy: -0.42, r: 0.12, fill: "#fffdf2", opacity: 0.8 }, wing);
        }
        el("ellipse", { rx: 0.08, ry: 0.5, cy: 0.15, fill: "#3a2f2a" }, body);
        el("path", { d: "M-0.02,-0.3 Q-0.15,-0.7 -0.28,-0.75 M0.02,-0.3 Q0.15,-0.7 0.28,-0.75", stroke: "#3a2f2a", "stroke-width": 0.04, fill: "none" }, body);
        return svg;
    }
    function bee() {
        const svg = el("svg", { viewBox: "-1.2 -1.2 2.4 2.4", class: "critter bee" });
        for (const side of [-1, 1]) {
            el("ellipse", { cx: side * 0.3, cy: -0.55, rx: 0.3, ry: 0.42, fill: "#eaf6ff", opacity: 0.8, stroke: "#b9d4e6", "stroke-width": 0.04, class: "wing" }, svg);
        }
        el("ellipse", { rx: 0.62, ry: 0.42, fill: "#f6c933", stroke: "#3a2f2a", "stroke-width": 0.05 }, svg);
        for (const x of [-0.2, 0.15]) el("rect", { x, y: -0.4, width: 0.14, height: 0.8, fill: "#3a2f2a", rx: 0.05 }, svg);
        el("circle", { cx: 0.55, cy: -0.05, r: 0.08, fill: "#3a2f2a" }, svg);
        return svg;
    }
    function ladybug() {
        const svg = el("svg", { viewBox: "-1.2 -1.2 2.4 2.4", class: "critter ladybug" });
        el("circle", { cx: 0.62, r: 0.3, fill: "#2d2a26" }, svg);
        el("ellipse", { rx: 0.7, ry: 0.6, fill: "#e14a3b" }, svg);
        el("path", { d: "M0.7,0 L-0.7,0", stroke: "#2d2a26", "stroke-width": 0.06 }, svg);
        for (const [x, y] of [[0.25, -0.3], [-0.2, -0.32], [0.2, 0.3], [-0.25, 0.28], [-0.5, 0]]) el("circle", { cx: x, cy: y, r: 0.11, fill: "#2d2a26" }, svg);
        return svg;
    }

    // Fly a critter across the screen along a wavy path (the Web Animations API: element.animate(keyframes))
    function spawnCritter(kind, options = {}) {
        if (reduceMotion()) return;
        const parent = options.front ? document.querySelector(".garden-celebration") || critterLayer() : critterLayer();
        if (!options.front && parent.childElementCount > 0) return;     // one at a time
        const node = kind === "bee" ? bee() : kind === "ladybug" ? ladybug() : butterfly(PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)]);
        parent.appendChild(node);
        const w = window.innerWidth, h = window.innerHeight;
        const fromLeft = Math.random() < 0.5;
        const startX = options.x ?? (fromLeft ? -60 : w + 60), endX = fromLeft ? w + 60 : -60;
        const startY = options.y ?? h * (0.15 + Math.random() * 0.7);
        const endY = h * (0.1 + Math.random() * 0.6);
        const steps = 14, frames = [];
        const wobble = kind === "bee" ? 22 : kind === "ladybug" ? 6 : 50;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = startX + (endX - startX) * t;
            const y = startY + (endY - startY) * t + Math.sin(t * Math.PI * (kind === "bee" ? 9 : 4)) * wobble;
            frames.push({ transform: `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px) scaleX(${fromLeft ? 1 : -1})` });
        }
        const duration = kind === "ladybug" ? 26000 : kind === "bee" ? 9000 : 13000;
        const anim = node.animate(frames, { duration: duration * (0.8 + Math.random() * 0.4), easing: "linear" });
        anim.onfinish = () => node.remove();
    }

    function startCritters() {
        if (critterTimer) return;
        const tick = () => {
            critterTimer = setTimeout(tick, 18000 + Math.random() * 22000);
            if (document.hidden || document.documentElement.dataset.design !== "garden") return;
            const roll = Math.random();
            spawnCritter(roll < 0.55 ? "butterfly" : roll < 0.85 ? "bee" : "ladybug");
        };
        critterTimer = setTimeout(tick, 6000 + Math.random() * 8000);
    }

    // ---------------------------------------------------------------------------------------------
    // The win: the garden takes over
    // ---------------------------------------------------------------------------------------------

    // Stems with flowers up both sides of the screen, drawn in screen pixels
    function buildSides(instant) {
        if (sides) sides.remove();
        sides = document.createElement("div");
        sides.className = "garden-sides" + (instant ? " instant" : "");
        sides.setAttribute("aria-hidden", "true");
        // Fit the empty margin beside the page (main is at most 1000px wide). With little or no margin
        // (phones, small windows) the stems stay short, down at the bottom corners.
        const margin = (window.innerWidth - 1000) / 2;
        const W = Math.min(240, Math.max(60, margin - 10));
        const narrow = margin < 90;
        const H = window.innerHeight;
        for (const side of ["left", "right"]) {
            const svg = el("svg", { class: "side " + side, viewBox: `0 0 ${W} ${H}`, width: W, height: H });
            const count = W < 120 ? 4 : 6;
            for (let i = 0; i < count; i++) {
                // i = 0 is the stem nearest the page edge; inner stems (closer to the board) bloom first
                const t = (i + 0.5) / count;
                const baseX = side === "left" ? t * W * 0.9 : W - t * W * 0.9;
                const inner = t;                                 // 0 = outer edge, 1 = toward the board
                const height = H * (narrow ? 0.08 + Math.random() * 0.14 : 0.35 + Math.random() * 0.5);
                const lean = (Math.random() - 0.5) * W * 0.35;
                const topX = baseX + lean, topY = H - height;
                const delay = (1 - inner) * 0.35 + Math.random() * 0.2;
                const g = el("g", { class: "side-stem" }, svg);
                const stem = el("path", {
                    d: `M${baseX.toFixed(1)},${H + 4} C${(baseX - lean * 0.6).toFixed(1)},${(H - height * 0.35).toFixed(1)} ${(topX + lean * 0.4).toFixed(1)},${(topY + height * 0.35).toFixed(1)} ${topX.toFixed(1)},${topY.toFixed(1)}`,
                    pathLength: 1, class: "vine-stem big", style: `animation-delay:${delay.toFixed(2)}s`
                }, g);
                stem.style.strokeWidth = ((W < 120 ? 2.5 : 3.5) + Math.random() * 1.5).toFixed(1);   // (CSS beats the attribute)
                // leaves along the stem
                for (let k = 1; k <= 3; k++) {
                    const ly = H - height * (k / 4), lx = baseX + (topX - baseX) * (k / 4);
                    const lf = el("g", { transform: `translate(${lx.toFixed(1)},${ly.toFixed(1)}) scale(${narrow ? 8 : W < 120 ? 14 : 20})`, class: "side-leaf", style: `animation-delay:${(delay + 0.25 + k * 0.15).toFixed(2)}s` }, g);
                    lf.appendChild(leaf(k % 2 ? 1 : -1, 1));
                }
                // the flower on top (and a smaller one partway up on some stems)
                const spots = [[topX, topY, narrow ? 13 : W < 120 ? 20 : 26 + Math.random() * 12]];
                if (!narrow && Math.random() < 0.6) spots.push([baseX + (topX - baseX) * 0.55, H - height * 0.55, W < 120 ? 12 : 15]);
                spots.forEach(([fx, fy, size], s) => {
                    const holder = el("g", { transform: `translate(${fx.toFixed(1)},${fy.toFixed(1)}) scale(${size.toFixed(1)})` }, g);
                    const sway = el("g", { class: "sway slow", style: `animation-delay:-${(Math.random() * 4).toFixed(2)}s` }, holder);
                    const type = FLOWER_TYPES[Math.floor(Math.random() * FLOWER_TYPES.length)];
                    const f = flower(type, PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)]);
                    f.setAttribute("class", "bloom pop side-bloom");
                    f.style.setProperty("--wave", (1.0 + (1 - inner) * 0.6 + s * 0.15 + delay * 0.5).toFixed(2) + "s");
                    sway.appendChild(f);
                });
            }
            sides.appendChild(svg);
        }
        document.body.prepend(sides);
    }

    function celebrate(game, { instant }) {
        if (game.surrendered) return;
        buildSides(instant);
        if (instant) return;

        // the board's flowers bloom again in a wave, starting in the middle
        const size = game.puzzle.size, mid = (size - 1) / 2;
        for (const [key, { node }] of flowerEls) {
            const [r, c] = key.split(",").map(Number);
            const inner = node.querySelector(".bloom");
            if (!inner) continue;
            inner.classList.remove("wave");
            void inner.getBoundingClientRect();
            inner.style.setProperty("--wave", (Math.hypot(r - mid, c - mid) * 0.12).toFixed(2) + "s");
            inner.classList.add("wave");
        }

        // petals drifting down, and butterflies leaving the board
        const old = document.querySelector(".garden-celebration");
        if (old) old.remove();
        const overlay = document.createElement("div");
        overlay.className = "garden-celebration";
        overlay.setAttribute("aria-hidden", "true");
        for (let i = 0; i < 34; i++) {
            const petal = document.createElement("span");
            petal.className = "falling-petal";
            const color = PETAL_COLORS[i % PETAL_COLORS.length];
            petal.style.cssText = `left:${(Math.random() * 100).toFixed(1)}%; background:radial-gradient(circle at 30% 30%, ${lighten(color, 0.5)}, ${color});` +
                `--drift:${(Math.random() * 160 - 80).toFixed(0)}px; --size:${(8 + Math.random() * 8).toFixed(0)}px;` +
                `animation-delay:${(0.6 + Math.random() * 3).toFixed(2)}s; animation-duration:${(5 + Math.random() * 3).toFixed(2)}s;`;
            overlay.appendChild(petal);
        }
        document.body.appendChild(overlay);
        const box = document.getElementById("board").getBoundingClientRect();
        for (let i = 0; i < 3; i++) {
            setTimeout(() => spawnCritter("butterfly", { front: true, x: box.left + box.width * (0.3 + i * 0.2), y: box.top + box.height / 2 }), 900 + i * 450);
        }
        setTimeout(() => overlay.classList.add("fade"), 9000);
        setTimeout(() => overlay.remove(), 10500);
    }

    // Switched off, or a new puzzle: take everything away
    function clear() {
        if (layer) layer.remove();
        layer = null;
        if (sides) sides.remove();
        sides = null;
        document.querySelectorAll(".garden-celebration, .critter-layer").forEach(n => n.remove());
        clearTimeout(critterTimer);
        critterTimer = null;
    }

    // The side garden is drawn in screen pixels, so redraw it (already grown) when the window changes size
    let resizeTimer = null;
    window.addEventListener("resize", () => {
        if (!sides) return;
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => { if (sides) buildSides(true); }, 250);
    });

    const module = { update, wordDone, celebrate, clear };
    Designs.register("garden", module);
    return module;
})();
