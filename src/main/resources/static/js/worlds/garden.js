// The GARDEN world (redesign: it was the Garden design).
//   Background: a meadow with rolling hills, swaying grass & wildflowers, clouds, birds, butterflies and pollen
//   by day; a moon, stars and fireflies by night.
//   Board: every letter you type sprouts a bud; vines creep in from the board's frame and spread from square to
//   square (organic curves, not a grid), with leaves, tendrils, berries and tiny blossoms; ivy peeks out around
//   the frame; a finished word's buds open into flowers (seven kinds), one petal at a time.
//   Win: the garden takes over. Stems shoot up both sides of the screen, every flower blooms in a wave, petals
//   and butterflies drift, and a rainbow arcs across the sky. The side flowers stay until the next puzzle.
//
// The flowers and vines are SVG ("Scalable Vector Graphics": shapes described in code, sharp at any size).

(() => {
    const SVG_NS = "http://www.w3.org/2000/svg";
    const PETAL_COLORS = ["#e8798f", "#f3a65a", "#b48ad8", "#ef8fb7", "#7fb4e8", "#e85d5d", "#f2c94c"];
    const FLOWER_TYPES = ["cosmos", "daisy", "poppy", "rose", "tulip", "sunflower", "forgetMeNot"];

    let layer = null, vineLayer = null, flowerLayer = null;   // the <svg> over the board and its two layers
    let vineEls = new Map();         // "r,c" -> { parentKey, node }: the vine growing INTO that square (kept between updates)
    let flowerEls = new Map();       // "r,c" -> { stage: "bud" or "bloom", node }
    let sides = null;                // the side-of-screen garden after a win
    let critterTimer = null;
    let lastGame = null;
    const reduceMotion = () => U.motion() === "still";

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
    // The board: an organic garden, not a grid.
    //   - every square gets its own random spot for its flower (away from the letter and the clue number)
    //   - vines creep in from the board's frame and spread from square to square toward the middle, as wavy
    //     curves with ivy and pointed leaves, tendrils, berries and tiny blossoms along the way
    //   - where a vine enters the board, an ivy sprig peeks out around the outside of the frame
    // "Random" is seeded from the puzzle and the square, so the same puzzle always grows the same garden and
    // nothing jumps around while you type or erase.
    // ---------------------------------------------------------------------------------------------

    // A repeatable random number in [0, 1) for these keys (a small hash, like a seeded Random in Java)
    function rand(...keys) {
        let h = 0x9e3779b9 ^ puzzleSeed;
        for (const k of keys) {
            h = Math.imul(h ^ k, 2654435761);
            h ^= h >>> 15;
            h = Math.imul(h, 2246822519);
            h ^= h >>> 13;
        }
        return (h >>> 0) / 4294967296;
    }
    let puzzleSeed = 1;
    const seedOf = (puzzle) => {
        let h = 7;
        for (const ch of String(puzzle.seed) + puzzle.mode) h = Math.imul(h, 31) + ch.charCodeAt(0) | 0;
        return h;
    };

    const typeFor = (r, c) => FLOWER_TYPES[Math.floor(rand(r, c, 1) * FLOWER_TYPES.length)];
    const colorFor = (r, c) => PETAL_COLORS[Math.floor(rand(r, c, 2) * PETAL_COLORS.length)];

    // Where in square (r, c) its flower grows: around the letter, never on the clue number (top-left)
    function anchor(r, c) {
        // angles measured like on screen (y points down): -135 degrees is the top-left corner, so skip around it
        const angle = (-100 + rand(r, c, 3) * 290) * Math.PI / 180;
        const dist = 0.33 + rand(r, c, 4) * 0.09;
        const x = Math.min(0.88, Math.max(0.12, 0.5 + Math.cos(angle) * dist));
        const y = Math.min(0.88, Math.max(0.14, 0.52 + Math.sin(angle) * dist));
        return [c + x, r + y];
    }

    // Squares near the frame get a lower rank, so vines start at the edges and spread inward
    function rank(r, c, size) {
        const toEdge = Math.min(r, c, size - 1 - r, size - 1 - c);
        return toEdge + rand(r, c, 5) * 1.6;
    }

    // Which square this square's vine grows from: a filled neighbour (including diagonals) with a lower rank.
    // None? Then it grows in from the nearest side of the board ("edge" plus where it enters).
    function parentOf(r, c, game) {
        const size = game.puzzle.size;
        const mine = rank(r, c, size);
        let best = null, bestRank = Infinity;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const nr = r + dr, nc = c + dc;
                if ((dr === 0 && dc === 0) || nr < 0 || nc < 0 || nr >= size || nc >= size) continue;
                if (game.puzzle.solution[nr][nc] === "." || game.letters[nr][nc] === "") continue;
                const theirs = rank(nr, nc, size);
                if (theirs < mine && theirs < bestRank) { best = [nr, nc]; bestRank = theirs; }
            }
        }
        if (best) return { key: best.join(","), from: anchor(best[0], best[1]), edge: null };
        // grow in from the closest side (ties broken by the seed)
        const [ax, ay] = anchor(r, c);
        const sides = [["top", ay], ["left", ax], ["bottom", size - ay], ["right", size - ax]]
            .map(([side, d]) => [side, d + rand(r, c, 6, side.length) * 0.8])
            .sort((a, b) => a[1] - b[1]);
        const side = sides[0][0];
        const along = (side === "top" || side === "bottom" ? ax : ay) + (rand(r, c, 7) - 0.5) * 0.8;
        const from = side === "top" ? [along, -0.2] : side === "bottom" ? [along, size + 0.2]
                   : side === "left" ? [-0.2, along] : [size + 0.2, along];
        return { key: "edge-" + side, from, edge: { side, along } };
    }

    // A point and direction on a cubic Bezier curve (the same curve SVG draws for "C")
    function bezier(p0, p1, p2, p3, t) {
        const u = 1 - t;
        const point = [0, 1].map(i => u * u * u * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t * t * t * p3[i]);
        const tangent = [0, 1].map(i => 3 * u * u * (p1[i] - p0[i]) + 6 * u * t * (p2[i] - p1[i]) + 3 * t * t * (p3[i] - p2[i]));
        return [point, Math.atan2(tangent[1], tangent[0]) * 180 / Math.PI];
    }

    // Leaf shapes, drawn from the stem at (0, 0) out along +x, about 1 long
    const LEAF_SHAPES = [
        "M0,0 C0.3,-0.28 0.75,-0.22 1,0 C0.75,0.22 0.3,0.28 0,0Z",                                   // pointed
        "M0,0 C0.12,-0.32 0.42,-0.46 0.55,-0.24 C0.74,-0.42 1.02,-0.2 0.86,0 C1.02,0.2 0.74,0.42 0.55,0.24 C0.42,0.46 0.12,0.32 0,0Z", // ivy
        "M0,0 C0.2,-0.4 0.8,-0.38 0.95,0 C0.8,0.38 0.2,0.4 0,0Z"                                     // round
    ];
    function vineLeaf(shape, delay) {
        const grow = el("g", { class: "leaf-grow", style: `animation-delay:${delay.toFixed(2)}s` });
        el("path", { d: LEAF_SHAPES[shape], fill: "var(--leaf)" }, grow);
        el("path", { d: "M0.04,0 Q0.45,-0.03 0.82,0", fill: "none", stroke: "var(--vine)", "stroke-width": 0.05, opacity: 0.65 }, grow);
        return grow;
    }

    // One vine from `from` to square (r, c)'s flower spot, with its leaves and extras
    function vine(r, c, parent, size) {
        const p0 = parent.from, p3 = anchor(r, c);
        const dx = p3[0] - p0[0], dy = p3[1] - p0[1];
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;                      // sideways from the straight line
        const w1 = (rand(r, c, 8) - 0.5) * 0.9, w2 = -w1 * (0.4 + rand(r, c, 9) * 0.8);   // an S-curve, different each time
        const p1 = [p0[0] + dx * 0.3 + nx * w1, p0[1] + dy * 0.3 + ny * w1];
        const p2 = [p0[0] + dx * 0.7 + nx * w2, p0[1] + dy * 0.7 + ny * w2];
        const toEdge = Math.min(r, c, size - 1 - r, size - 1 - c);
        const g = el("g", { class: "vine grow" });
        const stem = el("path", { d: `M${p0} C${p1} ${p2} ${p3}`, pathLength: 1, class: "vine-stem" }, g);
        stem.style.strokeWidth = (parent.edge ? 0.07 : 0.055 - toEdge * 0.008).toFixed(3);   // thicker near the frame

        // leaves on alternating sides, of mixed shapes and sizes
        const leaves = 2 + Math.floor(rand(r, c, 10) * 3);
        for (let i = 0; i < leaves; i++) {
            const t = (i + 0.6 + rand(r, c, 11, i) * 0.4) / (leaves + 1);
            const [[x, y], angle] = bezier(p0, p1, p2, p3, t);
            const side = i % 2 ? 1 : -1;
            const holder = el("g", { transform: `translate(${x.toFixed(3)},${y.toFixed(3)}) rotate(${(angle + side * (35 + rand(r, c, 12, i) * 35)).toFixed(1)}) scale(${(0.14 + rand(r, c, 13, i) * 0.09).toFixed(3)})` }, g);
            holder.appendChild(vineLeaf(Math.floor(rand(r, c, 14, i) * LEAF_SHAPES.length), 0.1 + t * 0.6));
        }
        // a curly tendril
        if (rand(r, c, 15) < 0.55) {
            const t = 0.35 + rand(r, c, 16) * 0.3;
            const [[x, y], angle] = bezier(p0, p1, p2, p3, t);
            const s = rand(r, c, 17) < 0.5 ? 1 : -1;
            const holder = el("g", { transform: `translate(${x.toFixed(3)},${y.toFixed(3)}) rotate(${(angle + s * 60).toFixed(1)}) scale(0.3)` }, g);
            el("path", { d: `M0,0 C0.3,${-0.1 * s} 0.5,${-0.45 * s} 0.3,${-0.55 * s} C0.12,${-0.6 * s} 0.1,${-0.35 * s} 0.25,${-0.33 * s}`, pathLength: 1, class: "vine-tendril" }, holder);
        }
        // berries or a tiny blossom now and then
        const extra = rand(r, c, 18);
        if (extra < 0.45) {
            const t = 0.45 + rand(r, c, 19) * 0.3;
            const [[x, y]] = bezier(p0, p1, p2, p3, t);
            const holder = el("g", { transform: `translate(${x.toFixed(3)},${y.toFixed(3)}) scale(0.07)` }, g);
            const pop = el("g", { class: "leaf-grow", style: `animation-delay:${(0.2 + t * 0.6).toFixed(2)}s` }, holder);
            if (extra < 0.2) {                                    // a little cluster of berries
                for (const [bx, by] of [[0, 0], [0.8, 0.3], [0.2, 0.9]]) el("circle", { cx: bx, cy: by, r: 0.55, fill: shade("#8e4a7a") }, pop);
            } else {                                              // a tiny five-dot blossom
                const color = PETAL_COLORS[Math.floor(rand(r, c, 20) * PETAL_COLORS.length)];
                for (let k = 0; k < 5; k++) {
                    const a = k * 1.2566;
                    el("circle", { cx: (Math.cos(a) * 0.6).toFixed(2), cy: (Math.sin(a) * 0.6).toFixed(2), r: 0.5, fill: shade(color) }, pop);
                }
                el("circle", { r: 0.35, fill: "#f7d774" }, pop);
            }
        }
        return g;
    }

    // An ivy sprig on the OUTSIDE of the frame where a vine enters the board
    function frameSprig(r, c, edge, size) {
        const { side, along } = edge;
        // the frame edge point, the direction along the edge, and the direction pointing away from the board
        const point = side === "top" ? [along, 0] : side === "bottom" ? [along, size] : side === "left" ? [0, along] : [size, along];
        const tangent = side === "top" || side === "bottom" ? [1, 0] : [0, 1];
        const out = side === "top" ? [0, -1] : side === "bottom" ? [0, 1] : side === "left" ? [-1, 0] : [1, 0];
        const at = (t, o) => [point[0] + tangent[0] * t + out[0] * o, point[1] + tangent[1] * t + out[1] * o];
        const reach = 0.5 + rand(r, c, 21) * 0.4, dir = rand(r, c, 22) < 0.5 ? -1 : 1;
        const a = at(0, 0.02), b = at(dir * reach * 0.4, 0.22), d = at(dir * reach, 0.1);
        const g = el("g", { class: "vine grow" });
        el("path", { d: `M${a} Q${b} ${d}`, pathLength: 1, class: "vine-stem", style: "stroke-width:0.05" }, g);
        const outAngle = Math.atan2(out[1], out[0]) * 180 / Math.PI;
        const count = 3 + Math.floor(rand(r, c, 23) * 3);
        for (let i = 0; i < count; i++) {
            const t = (i + 0.5) / count;
            const [x, y] = at(dir * reach * t, 0.06 + Math.sin(t * Math.PI) * 0.12);
            const angle = outAngle + (rand(r, c, 24, i) - 0.5) * 100;
            const holder = el("g", { transform: `translate(${x.toFixed(3)},${y.toFixed(3)}) rotate(${angle.toFixed(1)}) scale(${(0.18 + rand(r, c, 25, i) * 0.12).toFixed(3)})` }, g);
            holder.appendChild(vineLeaf(1, 0.2 + t * 0.5));     // ivy leaves
        }
        return g;
    }

    let frameLayer = null;        // a group drawn first in the board's <svg>: the ivy spilling over the frame
    let frameEls = new Map();     // "r,c" -> its sprig

    // Make the garden match the game: add new vines and flowers, remove erased ones, open finished words.
    function update(game, boardEl) {
        lastGame = game;
        const size = game.puzzle.size;
        if (!layer || !boardEl.contains(layer)) {        // a new board was drawn: start a fresh garden
            puzzleSeed = seedOf(game.puzzle);
            layer = el("svg", { class: "garden", viewBox: `0 0 ${size} ${size}`, preserveAspectRatio: "none", "aria-hidden": "true" });
            frameLayer = el("g", {}, layer);         // (the board doesn't clip its corners, so this ivy can spill out)
            vineLayer = el("g", {}, layer);
            flowerLayer = el("g", {}, layer);
            boardEl.appendChild(layer);
            vineEls = new Map();
            flowerEls = new Map();
            frameEls = new Map();
        }

        const filled = (r, c) => game.letters[r][c] !== "";
        const fullWordSquares = new Set();
        for (const entry of [...game.puzzle.across, ...game.puzzle.down]) {
            const cells = Game.cellsOf(entry);
            if (cells.every(([r, c]) => filled(r, c))) cells.forEach(([r, c]) => fullWordSquares.add(`${r},${c}`));
        }

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const key = `${r},${c}`;
                const open = game.puzzle.solution[r][c] !== ".";

                // Vines: one per filled square, from its parent. Rebuilt only if the parent changed.
                const parent = open && filled(r, c) ? parentOf(r, c, game) : null;
                const currentVine = vineEls.get(key);
                if (currentVine && (!parent || currentVine.parentKey !== parent.key)) {
                    currentVine.node.remove();
                    vineEls.delete(key);
                    const sprig = frameEls.get(key);
                    if (sprig) { sprig.remove(); frameEls.delete(key); }
                }
                if (parent && !vineEls.has(key)) {
                    const node = vine(r, c, parent, size);
                    vineLayer.appendChild(node);
                    vineEls.set(key, { parentKey: parent.key, node });
                    if (parent.edge) {
                        const sprig = frameSprig(r, c, parent.edge, size);
                        frameLayer.appendChild(sprig);
                        frameEls.set(key, sprig);
                    }
                }

                // Flowers: a bud on every filled square, opened into a flower once one of its words is full.
                // A surrendered puzzle (Reveal puzzle) keeps its buds: no flowers for giving up.
                const stage = !open || !filled(r, c) ? null
                    : fullWordSquares.has(key) && !game.surrendered ? "bloom" : "bud";
                const current = flowerEls.get(key);
                if (current && current.stage === stage) continue;   // nothing changed here
                const wasBud = current && current.stage === "bud";
                if (current) { current.node.remove(); flowerEls.delete(key); }
                if (!stage) continue;
                const [x, y] = anchor(r, c);
                const scale = stage === "bloom" ? 0.14 + rand(r, c, 26) * 0.08 : 0.12;
                const holder = el("g", { transform: `translate(${x.toFixed(3)},${y.toFixed(3)}) scale(${scale.toFixed(3)})` });
                const sway = el("g", { class: "sway", style: `animation-delay:-${(rand(r, c, 27) * 3.4).toFixed(2)}s` }, holder);
                const inner = stage === "bloom" ? flower(typeFor(r, c), colorFor(r, c)) : bud(colorFor(r, c));
                inner.setAttribute("class", stage + " pop" + (stage === "bloom" && wasBud ? " from-bud" : ""));
                sway.appendChild(inner);
                // some flowers get a little companion (a smaller flower or bud) close by
                if (stage === "bloom" && rand(r, c, 28) < 0.4) {
                    const a = rand(r, c, 29) * Math.PI * 2;
                    const buddy = el("g", { transform: `translate(${(Math.cos(a) * 1.25).toFixed(2)},${(Math.sin(a) * 1.25).toFixed(2)}) scale(0.45)` }, sway);
                    const small = rand(r, c, 30) < 0.5 ? flower("forgetMeNot", colorFor(c, r)) : bud(colorFor(c, r));
                    small.setAttribute("class", "bloom pop");
                    buddy.appendChild(small);
                }
                flowerLayer.appendChild(holder);
                flowerEls.set(key, { stage, node: holder });
            }
        }
    }

    // A finished word: a little burst of sparkles over its new flowers
    function wordDone(entry, cells, boardEl) {
        if (reduceMotion() || !layer || lastGame?.surrendered) return;
        cells.forEach(([r, c], i) => {
            const [x, y] = anchor(r, c);
            const spot = el("g", { transform: `translate(${x.toFixed(3)},${y.toFixed(3)})` }, layer);
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

    function bloomWin(game, instant) {
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
        frameLayer = null;
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

    // ---------------------------------------------------------------------------------------------
    // The background: a meadow under the sky (day) or under the moon with fireflies (night)
    // ---------------------------------------------------------------------------------------------
    function cloudSprite(R, night) {
        const c = document.createElement("canvas");
        c.width = 240;
        c.height = 100;
        const x = c.getContext("2d");
        x.fillStyle = night ? "rgba(150,170,210,.22)" : "rgba(255,255,255,.92)";
        for (let i = 0; i < 7; i++) {
            x.beginPath();
            x.arc(40 + i * 26 + R() * 10, 62 - Math.sin(i / 6 * Math.PI) * 26 + R() * 6, 22 + R() * 16, 0, Math.PI * 2);
            x.fill();
        }
        x.fillRect(40, 62, 170, 26);
        return c;
    }

    function scene(W, H, opts) {
        const night = opts.theme === "dark", preview = !!opts.preview;
        let hills, blades, blooms, clouds, motes, stars, sky = null;
        let birds = [], nextBirds = preview ? 999 : U.rand(5, 12), flies = [], nextFly = preview ? 999 : U.rand(2, 6);
        const k = () => (preview ? 0.5 : W < 700 ? 0.7 : 1);

        function setup() {
            const R = U.rng(31337);
            hills = [0, 1, 2].map(i => ({
                base: H * (0.6 + i * 0.1), amp: H * (0.06 - i * 0.012), f1: 0.0021 + i * 0.0011, f2: 0.0053 + i * 0.0018, ph: R() * 10,
                color: night ? ["#1d3628", "#163023", "#10271b"][i] : ["#b2d896", "#93c674", "#73b258"][i], par: [4, 9, 16][i]
            }));
            const n = Math.round(W / (preview ? 6 : 4));
            blades = Array.from({ length: n }, (_, i) => ({
                x: (i + R() * 0.8) / n * W, h: U.lerp(24, 72, R()) * k(), w: 2 + R() * 2.4, ph: R() * 6.28,
                c: night ? ["#1f4a2a", "#28583a", "#1a3f24"][i % 3] : ["#4f9a3d", "#5fae4a", "#3f8a34", "#6cba54"][i % 4]
            }));
            blooms = Array.from({ length: Math.round(W / 46) }, () => ({
                x: R() * W, h: U.lerp(36, 84, R()) * k(), r: U.lerp(3.5, 6.5, R()), ph: R() * 6.28,
                c: ["#e8798f", "#f3a65a", "#b48ad8", "#ffffff", "#f2c94c", "#7fb4e8"][Math.floor(R() * 6)]
            }));
            clouds = Array.from({ length: preview ? 3 : 6 }, () => ({ x: R() * W, y: U.lerp(0.05, 0.3, R()) * H, s: U.lerp(0.5, 1.3, R()) * (preview ? 0.5 : 1), sp: U.lerp(5, 14, R()), sprite: cloudSprite(R, night) }));
            motes = Array.from({ length: preview ? 14 : 48 }, () => ({ x: R() * W, y: R() * H * 0.9, vx: U.lerp(-6, 14, R()), vy: U.lerp(-12, -3, R()), ph: R() * 6.28, r: U.lerp(1, 2.6, R()) }));
            stars = night ? Array.from({ length: preview ? 40 : 120 }, () => ({ x: R() * W, y: R() * H * 0.55, r: R() * 1.3 + 0.3, tw: R() * 6.28 })) : [];
            sky = null;
        }
        setup();

        function hillY(h, x, shift) { const xx = x - shift; return h.base + Math.sin(xx * h.f1 + h.ph) * h.amp + Math.sin(xx * h.f2 + h.ph * 2) * h.amp * 0.4; }

        function butterfly(g, f, t) {
            const flap = Math.abs(Math.sin(t * 13 + f.ph)) * 0.85 + 0.15;
            g.save();
            g.translate(f.x, f.y);
            g.scale(f.vx > 0 ? 1 : -1, 1);
            for (const side of [-1, 1]) {
                g.save();
                g.scale(side * flap, 1);
                g.fillStyle = f.c;
                g.beginPath(); g.ellipse(6, -5, 7, 9, 0.5, 0, Math.PI * 2); g.fill();
                g.fillStyle = f.c2;
                g.beginPath(); g.ellipse(5, 5, 5, 6, -0.4, 0, Math.PI * 2); g.fill();
                g.restore();
            }
            g.fillStyle = "#3a2f2a";
            g.fillRect(-1, -8, 2, 15);
            g.restore();
        }

        return {
            resize(w, h) { W = w; H = h; setup(); },
            draw(g, t, dt, inp) {
                if (!sky) {
                    sky = g.createLinearGradient(0, 0, 0, H);
                    if (night) { sky.addColorStop(0, "#08122b"); sky.addColorStop(0.55, "#1a2a4e"); sky.addColorStop(1, "#33466b"); }
                    else { sky.addColorStop(0, "#86c9f2"); sky.addColorStop(0.55, "#c8e9f7"); sky.addColorStop(1, "#fdf0d2"); }
                }
                g.fillStyle = sky;
                g.fillRect(0, 0, W, H);
                const sx = W * (preview ? 0.8 : 0.84) - inp.px * 6, sy = H * (preview ? 0.22 : 0.15) - inp.py * 4, sr = Math.min(W, H) * (preview ? 0.09 : 0.055);
                if (night) {
                    for (const s of stars) {
                        g.fillStyle = `rgba(255,255,240,${(0.3 + 0.7 * Math.abs(Math.sin(t * 0.8 + s.tw))).toFixed(2)})`;
                        g.fillRect(s.x, s.y, s.r, s.r);
                    }
                    const mg = g.createRadialGradient(sx, sy, sr * 0.8, sx, sy, sr * 4);
                    mg.addColorStop(0, "rgba(255,250,220,.25)");
                    mg.addColorStop(1, "rgba(255,250,220,0)");
                    g.fillStyle = mg;
                    g.fillRect(sx - sr * 4, sy - sr * 4, sr * 8, sr * 8);
                    g.fillStyle = "#f6f2df";
                    g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
                    g.fillStyle = "rgba(190,184,160,.55)";
                    g.beginPath(); g.arc(sx - sr * 0.3, sy - sr * 0.2, sr * 0.22, 0, 7); g.arc(sx + sr * 0.35, sy + sr * 0.3, sr * 0.16, 0, 7); g.arc(sx + sr * 0.1, sy - sr * 0.45, sr * 0.1, 0, 7); g.fill();
                } else {
                    g.save();
                    g.translate(sx, sy);
                    g.rotate(t * 0.08);
                    g.fillStyle = "rgba(255,246,200,.22)";
                    for (let i = 0; i < 12; i++) {
                        g.rotate(Math.PI / 6);
                        g.beginPath(); g.moveTo(0, 0); g.lineTo(sr * 5, -sr * 0.45); g.lineTo(sr * 5, sr * 0.45); g.fill();
                    }
                    g.restore();
                    const sg = g.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 2.8);
                    sg.addColorStop(0, "rgba(255,248,200,.9)");
                    sg.addColorStop(1, "rgba(255,248,200,0)");
                    g.fillStyle = sg;
                    g.fillRect(sx - sr * 3, sy - sr * 3, sr * 6, sr * 6);
                    g.fillStyle = "#fff4b8";
                    g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
                }
                for (const c of clouds) {
                    c.x += c.sp * dt;
                    if (c.x > W + 260 * c.s) c.x = -260 * c.s;
                    g.drawImage(c.sprite, c.x - inp.px * 8 * c.s, c.y, 240 * c.s, 100 * c.s);
                }
                // a flock of birds now and then (by day)
                if (!night) {
                    nextBirds -= dt;
                    if (nextBirds <= 0) {
                        nextBirds = U.rand(10, 20);
                        const y = U.rand(0.1, 0.35) * H;
                        for (let i = 0; i < U.rand(3, 6); i++) birds.push({ x: -40 - i * 26, y: y + Math.abs(i - 2) * 12, ph: Math.random() * 6, sp: U.rand(70, 90) });
                    }
                    g.strokeStyle = "rgba(60,70,90,.7)";
                    g.lineWidth = 1.8;
                    for (const b of birds) {
                        b.x += b.sp * dt;
                        const f = Math.sin(t * 9 + b.ph) * 4;
                        g.beginPath(); g.moveTo(b.x - 8, b.y - f); g.quadraticCurveTo(b.x - 4, b.y - 3, b.x, b.y); g.quadraticCurveTo(b.x + 4, b.y - 3, b.x + 8, b.y - f); g.stroke();
                    }
                    birds = birds.filter(b => b.x < W + 60);
                }
                // rolling hills
                for (const h of hills) {
                    const shift = inp.px * h.par;
                    g.fillStyle = h.color;
                    g.beginPath();
                    g.moveTo(0, H);
                    for (let x = 0; x <= W + 16; x += 16) g.lineTo(x, hillY(h, x, shift));
                    g.lineTo(W, H);
                    g.closePath();
                    g.fill();
                }
                // butterflies drifting over the meadow
                nextFly -= dt;
                if (nextFly <= 0 && flies.length < 3) {
                    nextFly = U.rand(6, 13);
                    const left = Math.random() < 0.5, cols = U.pick([["#f3a65a", "#e8798f"], ["#7fb4e8", "#b48ad8"], ["#f2c94c", "#f3a65a"], ["#ffffff", "#ef8fb7"]]);
                    flies.push({ x: left ? -20 : W + 20, y: U.rand(0.45, 0.8) * H, vx: (left ? 1 : -1) * U.rand(35, 60), ph: Math.random() * 6, c: cols[0], c2: cols[1] });
                }
                for (const f of flies) {
                    f.x += f.vx * dt;
                    f.y += Math.sin(t * 2 + f.ph) * 26 * dt;
                    butterfly(g, f, t);
                }
                flies = flies.filter(f => f.x > -40 && f.x < W + 40);
                // pollen (day) or fireflies (night)
                g.globalCompositeOperation = "lighter";
                for (const m of motes) {
                    m.x += (m.vx + Math.sin(t + m.ph) * 8) * dt;
                    m.y += m.vy * dt;
                    if (m.y < -10) { m.y = H + 5; m.x = Math.random() * W; }
                    if (m.x > W + 10) m.x = -10;
                    if (m.x < -10) m.x = W + 10;
                    if (night) {
                        const a = Math.max(0, Math.sin(t * 1.6 + m.ph * 3));
                        if (a < 0.05) continue;
                        const fg = g.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 6);
                        fg.addColorStop(0, `rgba(235,255,140,${(0.9 * a).toFixed(2)})`);
                        fg.addColorStop(1, "rgba(200,255,100,0)");
                        g.fillStyle = fg;
                        g.fillRect(m.x - m.r * 6, m.y - m.r * 6, m.r * 12, m.r * 12);
                    } else {
                        g.fillStyle = `rgba(255,236,150,${(0.35 + 0.3 * Math.sin(t * 2 + m.ph)).toFixed(2)})`;
                        g.beginPath(); g.arc(m.x, m.y, m.r, 0, 7); g.fill();
                    }
                }
                g.globalCompositeOperation = "source-over";
                // the grass, swaying in the wind (with gusts), and wildflowers poking out of it
                const gust = Math.sin(t * 0.45) * 0.12 + Math.sin(t * 0.17) * 0.06;
                g.lineCap = "round";
                for (const b of blades) {
                    const sway = Math.sin(t * 1.6 + b.x * 0.011 + b.ph * 0.3) * 0.2 + gust;
                    g.strokeStyle = b.c;
                    g.lineWidth = b.w;
                    g.beginPath();
                    g.moveTo(b.x, H + 2);
                    g.quadraticCurveTo(b.x + sway * b.h * 0.3, H - b.h * 0.55, b.x + sway * b.h, H - b.h);
                    g.stroke();
                }
                for (const f of blooms) {
                    const sway = Math.sin(t * 1.6 + f.x * 0.011) * 0.18 + gust;
                    const tx = f.x + sway * f.h, ty = H - f.h;
                    g.strokeStyle = night ? "#1f4a2a" : "#3f8a34";
                    g.lineWidth = 1.6;
                    g.beginPath(); g.moveTo(f.x, H + 2); g.quadraticCurveTo(f.x + sway * f.h * 0.3, H - f.h * 0.5, tx, ty); g.stroke();
                    g.fillStyle = night ? "rgba(200,200,230,.55)" : f.c;
                    for (let i = 0; i < 5; i++) { const a = i * 1.2566 + f.ph; g.beginPath(); g.arc(tx + Math.cos(a) * f.r * 0.8, ty + Math.sin(a) * f.r * 0.8, f.r * 0.62, 0, 7); g.fill(); }
                    g.fillStyle = "#f2c94c";
                    g.beginPath(); g.arc(tx, ty, f.r * 0.45, 0, 7); g.fill();
                }
            }
        };
    }

    // ---------------------------------------------------------------------------------------------
    // The win, as a cinematic: the garden takes over, and a rainbow arcs across the sky
    // ---------------------------------------------------------------------------------------------
    async function celebrateCine(c, { game }) {
        if (game.surrendered) return;
        const still = U.motion() === "still";
        bloomWin(game, still);
        Sound.play("bloom");
        if (still) return;
        const W = innerWidth, H = innerHeight, cx = W / 2, cy = H * 1.08, R = Math.max(W * 0.62, H * 0.75);
        const BOW = ["#ff5d5d", "#ff9f43", "#ffd84d", "#6ad06a", "#5aa9f0", "#6b6be0", "#b06be0"];
        let rt = 0;
        FX.add({
            update: dt => (rt += dt) < 5.5,
            draw(g) {
                const grow = U.ease.outCubic(Math.min(1, rt / 1.4)), fade = rt < 3.5 ? 1 : 1 - (rt - 3.5) / 2;
                g.globalAlpha = 0.32 * fade;
                g.lineWidth = R * 0.028;
                BOW.forEach((col, i) => {
                    g.strokeStyle = col;
                    g.beginPath();
                    g.arc(cx, cy, R - i * R * 0.028, Math.PI, Math.PI + Math.PI * grow);
                    g.stroke();
                });
                g.globalAlpha = 1;
            }
        });
        FX.burst({ x: W / 2, y: -20, n: 70, colors: PETAL_COLORS, shape: "petal", angle: Math.PI / 2, spread: 1.2, speed: [60, 260], gravity: 60, drag: 0.6, life: [3.5, 5.5], size: [5, 9], wobble: 40, jitter: W * 0.45, jitterY: 10, spin: 3 });
        await c.wait(2600);
    }

    // ---------------------------------------------------------------------------------------------
    // Title card: a wooden garden sign springs up, and a vine wraps its post
    // ---------------------------------------------------------------------------------------------
    async function titleCard(c, info) {
        const card = U.el("div", { class: "tc tc-garden", "aria-hidden": "true", html: `
            <div class="tcg-sign">
                <div class="tcg-post"></div>
                <svg class="tcg-vine" viewBox="0 0 60 200"><path d="M30 200 C 0 170, 60 150, 30 120 S 0 70, 30 40" pathLength="1"/></svg>
                <div class="tcg-board">
                    <small>${U.esc(info.kicker)}</small>
                    <h2>${U.esc(info.title)}</h2>
                    <p>${U.esc(info.sub)}</p>
                    <i class="tcg-flower f1">✿</i><i class="tcg-flower f2">❀</i><i class="tcg-flower f3">✿</i>
                </div>
            </div>` });
        document.getElementById("overlay").appendChild(card);
        c.cleanup(() => card.remove());
        Sound.play("title");
        await c.wait(1800);
        if (c.skipped) return;
        card.classList.add("out");
        Sound.play("whoosh");
        await c.wait(450);
    }

    // ---------------------------------------------------------------------------------------------
    // The mascot: Bumble, a bee
    // ---------------------------------------------------------------------------------------------
    function drawBumble(g, s) {
        const bob = Math.sin(s.t * 2.6) * 5 - s.hop * 10;
        g.save();
        g.translate(80, 84 + bob);
        g.rotate(Math.sin(s.t * 1.3) * 0.07);
        g.lineWidth = 3;
        g.strokeStyle = "#2b2b33";
        // wings, buzzing
        const flap = Math.abs(Math.sin(s.t * 26)) * 0.7 + 0.3;
        for (const side of [-1, 1]) {
            g.save();
            g.translate(side * 22, -4);
            g.rotate(side * -0.6);
            g.scale(1, flap);
            g.fillStyle = "rgba(225,242,255,.8)";
            g.beginPath(); g.ellipse(side * 10, -16, 13, 21, 0, 0, Math.PI * 2); g.fill(); g.stroke();
            g.restore();
        }
        // stinger and body with stripes
        g.fillStyle = "#2b2b33";
        g.beginPath(); g.moveTo(-5, 40); g.lineTo(5, 40); g.lineTo(0, 50); g.closePath(); g.fill();
        g.save();
        g.beginPath(); g.arc(0, 14, 28, 0, Math.PI * 2); g.clip();
        g.fillStyle = "#f8c630"; g.fillRect(-30, -16, 60, 60);
        g.fillStyle = "#2b2b33"; g.fillRect(-30, 8, 60, 8); g.fillRect(-30, 25, 60, 8);
        g.restore();
        g.beginPath(); g.arc(0, 14, 28, 0, Math.PI * 2); g.stroke();
        // little arms
        const wave = s.mood === "happy" || s.mood === "wow" ? Math.sin(s.t * 9) * 0.6 : 0.2;
        g.beginPath(); g.moveTo(-26, 12); g.lineTo(-38, 22); g.stroke();
        g.beginPath(); g.moveTo(26, 12); g.lineTo(38, 2 - wave * 14); g.stroke();
        // head, antennae
        g.fillStyle = "#ffd447";
        g.beginPath(); g.arc(0, -20, 24, 0, Math.PI * 2); g.fill(); g.stroke();
        for (const side of [-1, 1]) {
            g.beginPath(); g.moveTo(side * 8, -42); g.quadraticCurveTo(side * 12, -58, side * 20, -60); g.stroke();
            g.fillStyle = "#2b2b33"; g.beginPath(); g.arc(side * 20, -60, 4, 0, 7); g.fill();
        }
        // face
        const ex = s.look * 3;
        for (const side of [-1, 1]) {
            const x = side * 9 + ex, y = -22;
            if (s.blink > 0.5) { g.beginPath(); g.moveTo(x - 5, y); g.lineTo(x + 5, y); g.stroke(); continue; }
            if (s.mood === "happy") { g.beginPath(); g.arc(x, y + 2, 5, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); continue; }
            g.fillStyle = "#2b2b33";
            g.beginPath(); g.ellipse(x, y, 5, s.mood === "wow" ? 7 : 6, 0, 0, 7); g.fill();
            g.fillStyle = "#fff"; g.beginPath(); g.arc(x + 1.5, y - 2, 1.8, 0, 7); g.fill();
        }
        g.fillStyle = "rgba(240,120,120,.5)";
        g.beginPath(); g.ellipse(-16, -12, 4.5, 3, 0, 0, 7); g.ellipse(16, -12, 4.5, 3, 0, 0, 7); g.fill();
        g.lineWidth = 2.5;
        g.beginPath();
        if (s.mood === "wow" || s.talk > 0.3) { g.fillStyle = "#7a2b3b"; g.ellipse(0, -9, 4, 2 + s.talk * 4, 0, 0, 7); g.fill(); g.stroke(); }
        else if (s.mood === "sad") { g.arc(0, -4, 6, Math.PI * 1.2, Math.PI * 1.8); g.stroke(); }
        else { g.arc(0, -12, 7, Math.PI * 0.2, Math.PI * 0.8); g.stroke(); }
        g.restore();
    }

    // ---------------------------------------------------------------------------------------------
    // Sounds: chimes, plucks, birdsong & wind
    // ---------------------------------------------------------------------------------------------
    const { tone, noise, midi } = Sound;
    const chirp = (t = 0) => { for (let i = 0; i < 3; i++) { const f = U.rand(2600, 3600); tone({ t: t + i * 0.09, f, f2: f * 1.3, type: "sine", d: 0.07, v: 0.035 }); } };
    const sounds = {
        type: () => { const n = U.pick([84, 86, 88, 91, 93]); tone({ f: midi(n), type: "sine", d: 0.28, v: 0.06 }); tone({ f: midi(n + 12), type: "sine", d: 0.09, v: 0.012 }); },
        erase: () => tone({ f: midi(81), f2: midi(76), type: "sine", d: 0.16, v: 0.045 }),
        word: () => { [79, 84, 88, 91].forEach((n, i) => tone({ t: i * 0.08, f: midi(n), type: "sine", d: 0.7, v: 0.055, echo: 0.2 })); chirp(0.35); },
        wrong: () => tone({ f: midi(62), f2: midi(58), type: "sine", d: 0.4, v: 0.13 }),
        right: () => [72, 76, 79, 84, 88].forEach((n, i) => tone({ t: i * 0.07, f: midi(n), type: "sine", d: 0.6, v: 0.05, echo: 0.2 })),
        reveal: () => { tone({ f: midi(84), type: "sine", d: 0.4, v: 0.07 }); tone({ t: 0.1, f: midi(79), type: "sine", d: 0.5, v: 0.06 }); },
        bloom: () => {
            [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tone({ t: i * 0.09, f: midi(n), type: "triangle", d: 1.3, v: 0.06, echo: 0.25 }));
            noise({ type: "bandpass", f: 400, f2: 900, d: 2.5, v: 0.05, a: 1, q: 0.6 });
            chirp(0.6); chirp(1.1); chirp(1.6);
        },
        win: () => {},
        title: () => { tone({ f: 200, f2: 120, type: "triangle", d: 0.15, v: 0.2 }); [79, 84, 91].forEach((n, i) => tone({ t: 0.2 + i * 0.1, f: midi(n), type: "sine", d: 0.6, v: 0.05 })); },
        tile: i => tone({ f: midi(72 + [0, 2, 4, 7, 9, 12, 14][i % 7]), type: "sine", d: 0.3, v: 0.06 }),
        start: () => { chirp(0); chirp(0.3); [72, 79, 84, 88].forEach((n, i) => tone({ t: 0.4 + i * 0.1, f: midi(n), type: "sine", d: 0.9, v: 0.06, echo: 0.2 })); },
        select: () => tone({ f: midi(91), type: "sine", d: 0.12, v: 0.04 }),
        nav: () => noise({ type: "bandpass", f: 500, f2: 1300, q: 0.7, d: 0.45, v: 0.07 }),
        achievement: () => { [84, 88, 91, 96].forEach((n, i) => tone({ t: i * 0.08, f: midi(n), type: "sine", d: 0.8, v: 0.05, echo: 0.3 })); chirp(0.4); },
        streak: () => [72, 79, 84, 91].forEach((n, i) => tone({ t: i * 0.08, f: midi(n), type: "sine", d: 0.6, v: 0.05 }))
    };
    // ambient: soft marimba plucks on a pentatonic scale, with birds now and then (92 bpm)
    const PENTA = [60, 62, 64, 67, 69, 72, 74, 76, 79];
    const music = {
        bpm: 92,
        tick(step, t) {
            const s = step % 16;
            if (s % 2 === 0 && Math.random() < 0.55) tone({ t, f: midi(U.pick(PENTA)), type: "triangle", d: 0.35, v: 0.035, bus: "music" });
            if (s === 0) tone({ t, f: midi(U.pick([48, 45, 41, 43])), type: "sine", d: 2.4, v: 0.04, a: 0.4, bus: "music" });
            if (s === 9 && Math.random() < 0.3) for (let i = 0; i < 3; i++) { const f = U.rand(2600, 3600); tone({ t: t + i * 0.09, f, f2: f * 1.3, type: "sine", d: 0.07, v: 0.015, bus: "music" }); }
        }
    };

    // a new puzzle: take the side garden and drifting petals away
    function reset() {
        if (sides) sides.remove();
        sides = null;
        document.querySelectorAll(".garden-celebration").forEach(n => n.remove());
    }

    Worlds.register({
        id: "garden", name: "Garden", icon: "\u{1F33B}", tagline: "Vines, blooms & fireflies (a night garden in dark mode)",
        modes: ["light", "dark"],
        scene, sounds, music, titleCard, transition: "leaves",
        celebrate: celebrateCine,
        board: { update, wordDone, clear, reset, restoreSolved: (boardEl, game) => { if (!game.surrendered) buildSides(true); } },
        mascot: { name: "BUMBLE", draw: drawBumble },
        lines: {
            hello: ["Bzz! Hi there! The garden's ready for some words.", "Good to see you! Shall we grow a puzzle?", "Bzz bzz. Pick a puzzle and let's get growing!"],
            start: ["Every letter plants a bud. Fill a word and it blooms!", "Tap a square and type. Space flips Across and Down!"],
            word: ["It's blooming!", "Bzz-utiful!", "Look at those flowers!", "Another one in bloom!", "Sweet as honey!"],
            win: ["The whole garden is in bloom!", "Bzz! You did it!", "What a beautiful solve!"],
            wrong: ["A few weeds in there. Check the red squares!", "Almost! Some letters need tending."],
            right: ["Everything's growing just right!", "Healthy garden, all correct!"],
            idle: ["Stuck? Try a crossing word. They grow together!", "Short words sprout fastest. Try those first."],
            reveal: ["A little sunshine to help it grow..."]
        },
        introFlourish(stage) {
            const p = U.center(stage);
            FX.burst({ x: p.x, y: p.y, n: 70, colors: PETAL_COLORS, shape: "petal", speed: [200, 600], gravity: 120, drag: 1.2, life: [1.6, 2.6], size: [5, 9], wobble: 30, spin: 4 });
        }
    });
})();
