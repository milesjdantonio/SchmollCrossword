// Arriving in a new world (the user, 2026-10-11: "make animations for each time a player gets to a new area,
// representing them arriving from one place to the next"; remade 2026-10-13: "remake the animations between worlds
// and make them significantly more detailed, as detailed as everything else"). The first time your hero reaches a
// world, a short scene shows how it got there from the world before, each one different:
//
//   Notebook     sketched onto a page of the notebook in pencil (the spiral, doodles, a coffee ring), then coloured in
//   Garden       loops the loop on a paper plane over a windmill and flower beds, and hops off into the flowers
//   Acorn Woods  walks the path into the autumn woods (sun rays through the trees, a squirrel), and jumps into a leaf pile
//   Candy Hills  boards the Candy Express in the woods; it goes into a hollow log and comes out in Candy Hills, over a
//                candy-cane bridge and a chocolate river, to a gingerbread station
//   Coral Reef   slides down a candy cane into the sea and sinks past kelp, coral, fish, a turtle and jellyfish
//   Snow Day     floats up in a bubble from the reef and pops out onto the ice under an aurora (igloo, penguins)
//   Rainy City   floats down the river on a melting ice floe; the snow turns to rain as the city's lights come up; under
//                a stone bridge, past neon reflections, onto a dock, and opens an umbrella
//   Sky Kingdom  the umbrella catches the wind over the rooftops and lifts it up through the clouds to the castle
//   Desert       comes down over the dunes and pyramids in a hot-air balloon (a camel caravan, vultures, an oasis)
//   Carnival     walks over the dunes at night into the fair: Ferris wheel, big top, spotlights, fireworks
//   Neon Arcade  fired from a circus cannon into a giant arcade cabinet's screen, and lands on a neon grid
//   Library      walks through a glowing rune door into the haunted library: moonlight, candles, flying books
//   Robot        falls through the pages of a giant book into a factory: arms, gears, steam, a conveyor
//   Volcano      launches from the factory on a rocket over the sea, and crash-lands on the island's beach
//   Deep Space   launched by the eruption into space, past planets, a comet and asteroids, onto a little moon
//   Celestial Rift  the Void collapses; the prison it held shut cracks, its chains snap, the Cursed Angel breaks out
//                and tears the sky open; the hero leaps through after it and floats down onto a ruin in the rift
//
//   Travel.arrive(c, fromWorld, toWorld, look, { index, total })   c comes from FX.cinematic (skippable)
//   Travel.WORLDS   the worlds that have a scene, in campaign order
//
// Everything is drawn in one SVG (1600 x 900, cropped to fill the screen) plus a canvas for the particles, moved by
// one clock (frame(t)) and one camera (s.cam: pan, zoom, shake; the particles follow it), so a scene looks the same
// every time and a skip just ends it. Builds use a seeded random, so the scenery is the same each time too.
const Travel = (() => {
    const INK = "#2b2233";
    const W = 1600, H = 900;
    const st = (w = 5) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
    const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
    const lerp = (a, b, k) => a + (b - a) * k;
    const smooth = k => k * k * (3 - 2 * k);
    const out = k => 1 - Math.pow(1 - k, 3);
    const inn = k => k * k * k;
    const back = k => { const c = 1.70158; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
    const seg = (t, a, b, e = smooth) => e(clamp((t - a) / (b - a)));
    const rnd = (a, b) => a + Math.random() * (b - a);
    const f = v => (Math.round(v * 10) / 10).toString();
    const WORLDS = ["paper", "garden", "squirrel", "candy", "ocean", "snow", "rain", "sky", "desert", "carnival", "arcade", "library", "robot", "volcano", "space", "rift"];
    // a seeded random for building the scenery (the same scene every time)
    const seeded = seed => { let s = (seed * 2654435761) >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
    function shade(c, k) {
        const n = parseInt(c.slice(1), 16), ch = [n >> 16, (n >> 8) & 255, n & 255];
        return "#" + ch.map(v => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))))).map(v => v.toString(16).padStart(2, "0")).join("");
    }

    // each world's sky (top, bottom) behind its scene
    const SKY = {
        paper: ["#fbf8ef", "#ece4cf"], garden: ["#7cc8ff", "#e6f8ff"], squirrel: ["#ffb36b", "#ffe6bf"], candy: ["#ffb3dc", "#fff0d1"],
        ocean: ["#1f84cf", "#06264d"], snow: ["#1d2b5c", "#7d8fc9"], rain: ["#232a40", "#4b5672"], sky: ["#5cb4ff", "#f1f9ff"],
        desert: ["#ff9a47", "#ffe2a0"], carnival: ["#140c2e", "#5b2463"], arcade: ["#0b0320", "#3b0a5c"], library: ["#120d26", "#2f2148"],
        robot: ["#232a34", "#4d5664"], volcano: ["#ff8a4a", "#ffd6a0"], space: ["#02030f", "#160f45"], rift: ["#0c0420", "#3a1a6a"]
    };

    // ---------------------------------------------------------------------------------------------
    // The drawing kit (all in the scene's 1600 x 900 space). D collects <defs> (gradients) for a scene.
    // ---------------------------------------------------------------------------------------------
    function Defs(prefix) {
        const list = [];
        return {
            list,
            lin(id, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) {
                list.push(`<linearGradient id="${prefix}-${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join("")}</linearGradient>`);
                return `url(#${prefix}-${id})`;
            },
            rad(id, stops, cx = 0.5, cy = 0.5, r = 0.5) {
                list.push(`<radialGradient id="${prefix}-${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join("")}</radialGradient>`);
                return `url(#${prefix}-${id})`;
            },
            raw(s) { list.push(s); }
        };
    }
    // a soft glow (a radial gradient that fades out)
    const glow = (D, id, x, y, r, c, a = 0.8, k = "") => `<circle ${k ? `data-k="${k}"` : ""} cx="${x}" cy="${y}" r="${r}" fill="${D.rad(id, [[0, c, a], [0.45, c, a * 0.35], [1, c, 0]])}"/>`;
    // rolling hills: a filled band with a light rim along its top and (optional) grass tufts
    function hills(y, amp, fill, seed = 0, k = 1, { rim = true, tufts = 0, line = 5, R = seeded(seed + 7) } = {}) {
        const pts = [];
        for (let x = -100; x <= W + 100; x += 40) pts.push([x, y + Math.sin(x / (170 * k) + seed) * amp + Math.sin(x / (61 * k) + seed * 2) * amp * 0.3]);
        const edge = pts.map(([x, yy], i) => `${i ? "L" : "M"}${x} ${f(yy)}`).join(" ");
        let s = `<path d="${edge} L${W + 100} ${H + 400} L-100 ${H + 400}Z" fill="${fill}" ${st(line)}/>`;
        if (rim) s += `<path d="${edge}" transform="translate(0 9)" fill="none" stroke="${shade(fill, 0.28)}" stroke-width="7" stroke-linecap="round" opacity=".7"/>`;
        for (let i = 0; i < tufts; i++) {
            const p = pts[Math.floor(R() * pts.length)], x = p[0] + R() * 30, yy = p[1] + 4;
            s += `<path d="M${f(x)} ${f(yy)} l-5 -16 M${f(x)} ${f(yy)} l2 -20 M${f(x)} ${f(yy)} l8 -13" stroke="${shade(fill, -0.3)}" stroke-width="3" stroke-linecap="round" fill="none"/>`;
        }
        return s;
    }
    // a puffy cloud with a shaded underside and a highlight
    const cloud = (x, y, s = 1, fill = "#fff", under = "#dbe8f7", k = "") =>
        `<g ${k ? `data-k="${k}"` : ""} transform="translate(${f(x)} ${f(y)}) scale(${s})"><path d="M-96 22 a40 40 0 0 1 28 -56 a56 56 0 0 1 104 -8 a44 44 0 0 1 60 42 a28 28 0 0 1 -6 22Z" fill="${fill}" ${st(5)}/>` +
        `<path d="M-88 20 Q-10 4 86 20 Q14 30 -88 20Z" fill="${under}"/><ellipse cx="-4" cy="-38" rx="32" ry="12" fill="#fff" opacity=".75"/><ellipse cx="-58" cy="-14" rx="14" ry="7" fill="#fff" opacity=".6"/></g>`;
    // a leafy tree: a trunk with bark lines and a branch, clusters of leaves with shadows and highlights
    function tree(x, y, s, leaf, trunk = "#8a5a3c", R = seeded(Math.round(x * 3 + y))) {
        const dk = shade(leaf, -0.22), lt = shade(leaf, 0.3);
        let g = `<g transform="translate(${f(x)} ${f(y)}) scale(${s})"><path d="M-16 2 Q-12 -50 -18 -96 L18 -96 Q12 -50 16 2Z" fill="${trunk}" ${st(5)}/>` +
            `<path d="M-6 -20 Q-4 -50 -8 -80 M6 -30 Q8 -56 4 -84" stroke="${shade(trunk, -0.3)}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M8 -70 Q40 -96 58 -104" stroke="${INK}" stroke-width="12" stroke-linecap="round" fill="none"/><path d="M8 -70 Q40 -96 58 -104" stroke="${trunk}" stroke-width="6" stroke-linecap="round" fill="none"/>`;
        const blobs = [[0, -140, 66], [-50, -110, 44], [52, -112, 46], [-28, -176, 38], [30, -172, 40], [0, -96, 40]];
        g += blobs.map(([bx, by, r]) => `<circle cx="${bx}" cy="${by}" r="${r}" fill="${leaf}" ${st(5)}/>`).join("");
        g += blobs.map(([bx, by, r]) => `<path d="M${bx - r * 0.7} ${by + r * 0.35} A${r} ${r} 0 0 0 ${bx + r * 0.75} ${by + r * 0.3} Q${bx} ${by + r * 0.55} ${bx - r * 0.7} ${by + r * 0.35}Z" fill="${dk}" opacity=".8"/>`).join("");
        g += blobs.map(([bx, by, r]) => `<circle cx="${f(bx - r * 0.35)}" cy="${f(by - r * 0.35)}" r="${f(r * 0.22)}" fill="${lt}" opacity=".85"/>`).join("");
        for (let i = 0; i < 7; i++) g += `<circle cx="${f((R() - 0.5) * 120)}" cy="${f(-150 + (R() - 0.5) * 110)}" r="${f(2 + R() * 3)}" fill="${lt}" opacity=".6"/>`;
        return g + "</g>";
    }
    // a pine: three jagged tiers, optional snow on each
    function pine(x, y, s, c = "#2f7d4a", snow = false) {
        const dk = shade(c, -0.25);
        let g = `<g transform="translate(${f(x)} ${f(y)}) scale(${s})"><rect x="-10" y="-30" width="20" height="34" fill="#6b4226" ${st(4)}/>`;
        [[0, 130], [-60, 110], [-115, 86]].forEach(([dy, w], i) => {
            const top = -150 - i * 50 + dy * 0, base = -30 - i * 50;
            const p = `M0 ${top} L${w / 2} ${base} L${w * 0.28} ${base - 6} L${w * 0.36} ${base + 2} L${-w * 0.36} ${base + 2} L${-w * 0.28} ${base - 6} L${-w / 2} ${base}Z`;
            g += `<path d="${p}" fill="${c}" ${st(4)}/><path d="M0 ${top} L${w * 0.5} ${base} L${w * 0.2} ${base - 4} Z" fill="${dk}" opacity=".55"/>`;
            if (snow) g += `<path d="M0 ${top} L${w * 0.2} ${top + (base - top) * 0.42} Q${w * 0.08} ${top + (base - top) * 0.36} 0 ${top + (base - top) * 0.46} Q${-w * 0.1} ${top + (base - top) * 0.36} ${-w * 0.22} ${top + (base - top) * 0.44}Z" fill="#fff" ${st(3)}/>`;
        });
        return g + "</g>";
    }
    function palm(x, y, s, lean = 1) {
        let g = `<g transform="translate(${f(x)} ${f(y)}) scale(${s * lean} ${s})"><path d="M-12 0 Q-18 -110 26 -210 L40 -204 Q2 -110 12 0Z" fill="#a8743e" ${st(5)}/>`;
        for (let i = 0; i < 7; i++) g += `<path d="M${-10 + i * 1.6} ${-30 - i * 26} l24 -4" stroke="#7a4a24" stroke-width="3"/>`;
        [[-140, -170], [-110, -260], [-20, -290], [80, -270], [130, -200], [60, -150]].forEach(([dx, dy]) => {
            g += `<path d="M33 -207 Q${f((33 + dx) / 2)} ${f(dy - 40)} ${dx} ${dy} Q${f((33 + dx) / 2 + 10)} ${f(dy - 10)} 33 -207Z" fill="#3fae4a" ${st(4)}/><path d="M33 -207 Q${f((33 + dx) / 2)} ${f(dy - 26)} ${dx} ${dy}" fill="none" stroke="#2a7d34" stroke-width="2.5"/>`;
        });
        return g + `<circle cx="26" cy="-200" r="9" fill="#7a4a24" ${st(3)}/><circle cx="40" cy="-196" r="8" fill="#7a4a24" ${st(3)}/></g>`;
    }
    const flower = (x, y, c, kind = 0, s = 1) => {
        let head;
        if (kind === 1) head = `<path d="M-14 -4 Q-16 -30 0 -38 Q16 -30 14 -4 Q0 4 -14 -4Z" fill="${c}" ${st(3)}/><path d="M0 -36 V-6" stroke="${shade(c, -0.3)}" stroke-width="2"/>`;
        else if (kind === 2) head = [0, 45, 90, 135, 180, 225, 270, 315].map(a => `<ellipse cx="0" cy="-15" rx="5" ry="13" fill="#fff" ${st(2)} transform="rotate(${a})"/>`).join("") + `<circle r="8" fill="#ffd23f" ${st(2.5)}/>`;
        else head = [0, 72, 144, 216, 288].map(a => `<ellipse cx="0" cy="-14" rx="9" ry="14" fill="${c}" ${st(3)} transform="rotate(${a})"/>`).join("") + `<circle r="8" fill="#ffd23f" ${st(3)}/><circle cx="-2" cy="-2" r="2.5" fill="#fff" opacity=".7"/>`;
        return `<g transform="translate(${f(x)} ${f(y)}) scale(${s})"><path d="M0 0 Q4 -24 0 -44" fill="none" ${st(5)}/><path d="M0 0 Q4 -24 0 -44" fill="none" stroke="#4caf50" stroke-width="2.5"/>` +
            `<path d="M1 -18 Q16 -30 22 -22 Q12 -14 1 -18Z" fill="#5fc35a" ${st(2.5)}/><g transform="translate(0 -50)">${head}</g></g>`;
    };
    const grass = (x, y, c = "#4caf50", h = 1) => `<path d="M${f(x)} ${f(y)} q-6 -${f(18 * h)} -10 -${f(30 * h)} M${f(x)} ${f(y)} q2 -${f(20 * h)} 2 -${f(36 * h)} M${f(x)} ${f(y)} q6 -${f(14 * h)} 14 -${f(26 * h)}" stroke="${c}" stroke-width="4" stroke-linecap="round" fill="none"/>`;
    const sparkle = (x, y, s, c = "#fff") => `<path d="M${x} ${y - 14 * s} L${x + 3.5 * s} ${y - 3.5 * s} L${x + 14 * s} ${y} L${x + 3.5 * s} ${y + 3.5 * s} L${x} ${y + 14 * s} L${x - 3.5 * s} ${y + 3.5 * s} L${x - 14 * s} ${y} L${x - 3.5 * s} ${y - 3.5 * s}Z" fill="${c}"/>`;
    const star5 = (cx, cy, R, r) => { let d = ""; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r : R; d += (i ? "L" : "M") + f(cx + Math.cos(a) * q) + " " + f(cy + Math.sin(a) * q); } return d + "Z"; };
    // a city building: ledges, a roof (flat with a water tower, pitched, or an antenna with a light), windows
    function building(x, w, h, c, lit, R, roof = 0, base = H, k = "") {
        const top = base - h, dk = shade(c, -0.25);
        let g = `<rect x="${x}" y="${top}" width="${w}" height="${h + 10}" fill="${c}" ${st(5)}/><rect x="${x + w - 16}" y="${top + 4}" width="12" height="${h}" fill="${dk}" opacity=".6"/>`;
        for (let yy = top + 30; yy < base - 70; yy += 50) {
            g += `<rect x="${x - 4}" y="${yy - 10}" width="${w + 8}" height="6" fill="${dk}" ${st(2)}/>`;
            for (let xx = x + 16; xx < x + w - 30; xx += 38) {
                const on = R() < 0.42;
                g += on ? `<rect x="${xx - 6}" y="${yy - 4}" width="30" height="36" rx="6" fill="${lit}" opacity=".18"/><rect x="${xx}" y="${yy}" width="18" height="26" rx="3" fill="${lit}" ${st(2)}/><path d="M${xx + 9} ${yy} V${yy + 26} M${xx} ${yy + 13} H${xx + 18}" stroke="${shade(lit, -0.35)}" stroke-width="2"/>`
                    : `<rect x="${xx}" y="${yy}" width="18" height="26" rx="3" fill="#1a2030" ${st(2)}/><path d="M${xx + 3} ${yy + 4} l6 0" stroke="#3a4560" stroke-width="2"/>`;
            }
        }
        if (roof === 1) g += `<g transform="translate(${x + w * 0.6} ${top})"><path d="M-22 0 V-30 M22 0 V-30" ${st(4)}/><rect x="-28" y="-70" width="56" height="44" rx="6" fill="#7a5236" ${st(4)}/><path d="M-32 -70 L0 -94 L32 -70Z" fill="#5a3a24" ${st(4)}/><path d="M-28 -56 H28 M-28 -42 H28" stroke="#5a3a24" stroke-width="2"/></g>`;
        if (roof === 2) g += `<path d="M${x - 10} ${top} L${x + w / 2} ${top - 70} L${x + w + 10} ${top}Z" fill="${dk}" ${st(5)}/>`;
        if (roof === 3) g += `<path d="M${x + w / 2} ${top} V${top - 90}" ${st(4)}/><path d="M${x + w / 2 - 20} ${top - 50} H${x + w / 2 + 20} M${x + w / 2 - 12} ${top - 70} H${x + w / 2 + 12}" ${st(3)}/><circle ${k ? `data-k="${k}"` : ""} cx="${x + w / 2}" cy="${top - 94}" r="7" fill="#ff4d4d"/>`;
        return g;
    }
    // a gear (teeth, a rim, spokes); its inner group turns (data-k)
    const gear = (x, y, r, c, k, n = 12) => {
        let d = "";
        for (let i = 0; i < n * 4; i++) { const a = (i / (n * 4)) * Math.PI * 2, q = (i % 4 === 1 || i % 4 === 2) ? r * 1.2 : r; d += (i ? "L" : "M") + f(Math.cos(a) * q) + " " + f(Math.sin(a) * q); }
        return `<g transform="translate(${x} ${y})"><g data-k="${k}"><path d="${d}Z" fill="${c}" ${st(5)}/><circle r="${r * 0.78}" fill="none" stroke="${shade(c, -0.25)}" stroke-width="6"/>` +
            [0, 60, 120].map(a => `<rect x="${-r * 0.7}" y="-6" width="${r * 1.4}" height="12" rx="4" fill="${shade(c, -0.15)}" transform="rotate(${a})"/>`).join("") + `<circle r="${r * 0.28}" fill="#2a323d" ${st(4)}/><circle r="${r * 0.1}" fill="${shade(c, 0.4)}"/></g></g>`;
    };
    // a bird (its wings flap with data-k's vertical scale)
    const bird = (x, y, s, k) => `<g transform="translate(${f(x)} ${f(y)}) scale(${s})"><g data-k="${k}"><path d="M-16 0 Q-8 -10 0 0 Q8 -10 16 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/></g></g>`;
    // the hero's shadow on the ground, and a few shared things
    const SHADOW = `<ellipse data-k="hshadow" cx="0" cy="0" rx="70" ry="13" fill="#000" opacity="0"/>`;

    // ---------------------------------------------------------------------------------------------
    // The scenes: build(D, R) returns the SVG behind (back), under the hero (under) and in front of it (front);
    // frame(t, s) moves things. s.hero(x, y, scale, rotate, flip, alpha, squash) puts the hero's feet at (x, y);
    // s.shadow(x, y, size, alpha) its shadow; s.cam(cx, cy, zoom, rotate) the camera; s.shake(px) a jolt;
    // s.emit(kind, n, [x, y]) particles; s.flash(colour, a) a full-screen flash; s.once(key) true after the first time.
    // ---------------------------------------------------------------------------------------------
    const S = {};

    // ---- Notebook: sketched onto the page ----
    S.paper = {
        T: 7.2,
        build: (D, R) => {
            let b = `<rect width="${W}" height="${H}" fill="${D.lin("pg", [[0, "#fffdf6"], [1, "#f1e8d2"]])}"/>`;
            for (let i = 0; i < 220; i++) { const x = R() * W, y = R() * H, a = R() * 6; b += `<path d="M${f(x)} ${f(y)} l${f(Math.cos(a) * 9)} ${f(Math.sin(a) * 9)}" stroke="#d8ccae" stroke-width="1.2" opacity=".5"/>`; }
            for (let y = 150; y < H; y += 56) b += `<path d="M0 ${y} H${W}" stroke="#a9c1ec" stroke-width="3"/>`;
            b += `<path d="M230 0 V${H}" stroke="#ef8f9a" stroke-width="4"/><path d="M236 0 V${H}" stroke="#ef8f9a" stroke-width="1.5" opacity=".6"/>`;
            // the spiral binding
            for (let i = 0; i < 8; i++) {
                const y = 70 + i * 112;
                b += `<ellipse cx="110" cy="${y + 10}" rx="17" ry="13" fill="#3a3326" opacity=".8"/><path d="M60 ${y} Q90 ${y - 30} 112 ${y + 6}" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round"/>` +
                    `<path d="M60 ${y} Q90 ${y - 30} 112 ${y + 6}" fill="none" stroke="${D.lin("metal" + i, [[0, "#e8ecf2"], [0.5, "#9aa3b2"], [1, "#d6dbe4"]], 0, 0, 1, 0)}" stroke-width="7" stroke-linecap="round"/>`;
            }
            // doodles in blue ink, a coffee ring, a paper clip, eraser crumbs
            const ink = `stroke="#3b5bdb" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".55"`;
            b += `<path d="${star5(1380, 190, 46, 20)}" ${ink}/><path d="M1340 280 q40 30 80 0" ${ink}/><circle cx="1480" cy="430" r="40" ${ink}/><circle cx="1466" cy="420" r="4" fill="#3b5bdb" opacity=".55"/><circle cx="1494" cy="420" r="4" fill="#3b5bdb" opacity=".55"/><path d="M1462 444 q18 14 36 0" ${ink}/>` +
                `<path d="M300 220 l70 -40 m0 0 l-26 -2 m26 2 l-10 22" ${ink}/><path d="M320 560 c-30 -40 30 -60 30 -20 c0 -40 60 -20 30 20 l-30 30z" ${ink}/>` +
                [0, 1, 2].map(r => [0, 1, 2].map(c => `<rect x="${1290 + c * 40}" y="${620 + r * 40}" width="40" height="40" ${ink}${(r + c) % 3 === 2 ? ` fill="#3b5bdb" fill-opacity=".35"` : ""}/>`).join("")).join("") +
                `<path d="M340 760 q30 -30 60 0 t60 0 t60 0" ${ink}/><circle cx="1200" cy="140" r="26" ${ink}/>${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<path d="M${f(1200 + Math.cos(a * Math.PI / 180) * 36)} ${f(140 + Math.sin(a * Math.PI / 180) * 36)} l${f(Math.cos(a * Math.PI / 180) * 16)} ${f(Math.sin(a * Math.PI / 180) * 16)}" ${ink}/>`).join("")}` +
                `<circle cx="480" cy="380" r="74" fill="none" stroke="#a87a4a" stroke-width="9" opacity=".22"/><circle cx="484" cy="384" r="62" fill="none" stroke="#a87a4a" stroke-width="3" opacity=".18"/>` +
                `<path d="M1500 40 V160 a22 22 0 0 1 -44 0 V60 a14 14 0 0 1 28 0 V150" fill="none" stroke="#9aa3b2" stroke-width="6" stroke-linecap="round"/>` +
                [[560, 840], [590, 852], [1060, 848], [1090, 838], [1120, 856]].map(([x, y]) => `<path d="M${x} ${y} q6 -6 12 0 q-4 7 -12 0z" fill="#ff9fb4" ${st(1.5)}/>`).join("");
            // colour pencils at the bottom of the page
            [["#e5484d", 300], ["#2f8fe0", 380], ["#3fbf5f", 1240], ["#ffb21e", 1320]].forEach(([c, x], i) => {
                b += `<g transform="translate(${x} ${H - 30}) rotate(${i % 2 ? -8 : 6})"><rect x="-12" y="-6" width="160" height="24" rx="4" fill="${c}" ${st(3)}/><path d="M-12 -6 L-40 6 L-12 18Z" fill="#f2d2a2" ${st(3)}/><path d="M-30 1 L-40 6 L-30 11Z" fill="${c}"/><path d="M0 0 H148" stroke="#fff" stroke-width="3" opacity=".35"/></g>`;
            });
            // the ground line and shading the pencil draws, and the pencil itself
            b += `<path data-k="ground" d="M500 772 Q640 760 800 774 Q960 786 1100 768" fill="none" stroke="#5a5560" stroke-width="5" stroke-linecap="round" stroke-dasharray="700" stroke-dashoffset="700"/>` +
                `<path data-k="scrib" d="M640 786 l30 -12 l-14 18 l34 -14 l-14 18 l34 -14 l-14 18 l34 -14 l-14 18 l34 -14 l-14 18 l34 -14 l-14 18 l34 -14 l-14 18 l34 -14" fill="none" stroke="#8a8590" stroke-width="3" stroke-dasharray="900" stroke-dashoffset="900"/>`;
            b += [0, 1, 2, 3, 4].map(i => `<g transform="translate(${[560, 1040, 620, 1000, 800][i]} ${[420, 380, 260, 240, 190][i]})"><g data-k="ds${i}" transform="scale(0)"><path d="${star5(0, 0, 26, 11)}" fill="#ffd23f" ${st(3.5)}/></g></g>`).join("");
            const pencil = `<g data-k="pencil"><ellipse cx="40" cy="30" rx="24" ry="8" fill="#000" opacity=".12"/><g transform="rotate(32)"><path d="M-20 -240 H20 V-20 H-20Z" fill="#ffd23f" ${st(5)}/><path d="M-7 -240 V-20 M7 -240 V-20" stroke="#e8b81f" stroke-width="5"/><path d="M-20 -240 H-7 V-20 H-20Z" fill="#ffe680"/>` +
                `<path d="M-20 -20 L0 32 L20 -20Z" fill="#f2d2a2" ${st(5)}/><path d="M-12 -14 Q-4 0 0 18 M8 -16 Q4 0 2 14" stroke="#d6a77a" stroke-width="2" fill="none"/><path d="M-7 14 L0 32 L7 14Z" fill="#45404a"/>` +
                `<rect x="-22" y="-276" width="44" height="40" rx="4" fill="#c9ced8" ${st(5)}/><path d="M-22 -266 H22 M-22 -256 H22 M-22 -246 H22" stroke="#8a93a3" stroke-width="3"/><rect x="-21" y="-312" width="42" height="40" rx="10" fill="#ff8fa8" ${st(5)}/><path d="M-12 -304 V-282" stroke="#fff" stroke-width="4" opacity=".5" stroke-linecap="round"/></g></g>`;
            return { back: b, front: pencil };
        },
        frame(t, s) {
            const draw = seg(t, 0.3, 3.0, k => k), fill = seg(t, 2.9, 3.7);
            s.sketch(draw, fill);
            s.setStyle("ground", "strokeDashoffset", 700 * (1 - seg(t, 0.5, 1.6)));
            s.setStyle("scrib", "strokeDashoffset", 900 * (1 - seg(t, 1.6, 2.7)));
            // the pencil scribbles round the drawing, shading the ground, then flies off the page
            const r = 220 * (1 - draw * 0.6), px = 800 + Math.cos(t * 8.3) * r * 0.7 + (t > 1.6 && t < 2.7 ? (seg(t, 1.6, 2.7) - 0.5) * 400 : 0),
                py = (t > 1.6 && t < 2.7 ? 780 : 520 + Math.sin(t * 6.1) * r);
            const off = seg(t, 3.1, 3.9, inn);
            s.set("pencil", `translate(${f(lerp(px, 1750, off))} ${f(lerp(py, -260, off))}) rotate(${f(off * 40)})`);
            if (t < 3.0 && Math.random() < 0.5) s.emit("graphite", 1, [px - 18, py - 4]);
            const hop = seg(t, 3.7, 4.3), up = Math.sin(hop * Math.PI);
            s.hero(800, 770 - up * 90, 2.0, 0, 1, 1, hop > 0 && hop < 1 ? 1 + up * 0.08 : t > 4.3 && t < 4.5 ? 0.9 : 1);
            s.shadow(800, 776, 2.2 - up * 0.6, fill * 0.18);
            for (let i = 0; i < 5; i++) { const k = seg(t, 4.2 + i * 0.12, 4.6 + i * 0.12, back); s.set("ds" + i, `scale(${f(k)}) rotate(${f(t * 40 + i * 30)})`); }
            if (t > 3.0 && !s.once("wash")) s.emit("paint", 60, [800, 520]);
            if (t > 4.3 && !s.once("pop")) { s.emit("sparkle", 46, [800, 560]); s.emit("ring", 1, [800, 770]); }
            s.cam(800, lerp(520, 450, seg(t, 3.2, 5.0)), lerp(1.3, 1, seg(t, 3.2, 5.0)), 0);
        }
    };

    // ---- Garden: a paper plane loops the loop, and lands in the flowers ----
    S.garden = {
        T: 7.2,
        build: (D, R) => {
            let b = glow(D, "sun", 1300, 170, 260, "#fff7c2", 0.9) + `<g transform="translate(1300 170)"><g data-k="rays">${Array.from({ length: 12 }, (_, i) => `<path d="M0 0 L${f(Math.cos(i / 12 * 6.283 - 0.08) * 520)} ${f(Math.sin(i / 12 * 6.283 - 0.08) * 520)} L${f(Math.cos(i / 12 * 6.283 + 0.08) * 520)} ${f(Math.sin(i / 12 * 6.283 + 0.08) * 520)}Z" fill="#fff8d0" opacity=".22"/>`).join("")}</g>` +
                `<circle r="70" fill="#ffe066" ${st(5)}/><circle cx="-20" cy="-22" r="22" fill="#fff6c0"/></g>`;
            b += `<g data-k="c1">${cloud(200, 150, 0.8)}${cloud(900, 110, 0.6)}${cloud(1550, 230, 0.7)}</g>`;
            b += hills(560, 30, "#9fd6a0", 1.2, 1.6, { line: 4 }) + [180, 420, 700, 1000, 1240, 1480].map((x, i) => tree(x, 560 + Math.sin(x / 272 + 1.2) * 30 + 8, 0.35, i % 2 ? "#6cc06a" : "#58b05a")).join("");
            // the windmill on the far hill
            b += `<g transform="translate(1180 520)"><path d="M-40 60 L-24 -120 H24 L40 60Z" fill="#f4ecdc" ${st(5)}/><path d="M-30 -120 L0 -160 L30 -120Z" fill="#c9572a" ${st(5)}/><rect x="-10" y="20" width="20" height="40" rx="8" fill="#7a4a2a" ${st(4)}/>` +
                `<g transform="translate(0 -128)"><g data-k="mill">${[0, 90, 180, 270].map(a => `<g transform="rotate(${a})"><rect x="-8" y="-150" width="16" height="140" fill="#8a5a3c" ${st(3)}/><rect x="6" y="-146" width="34" height="110" fill="#fff" ${st(3)}/><path d="M6 -110 H40 M6 -74 H40 M23 -146 V-36" stroke="#c9b48a" stroke-width="2"/></g>`).join("")}<circle r="12" fill="#5a3a24" ${st(3)}/></g></g></g>`;
            b += `<g data-k="c2">${cloud(500, 260, 1.1)}${cloud(1500, 330, 0.9)}</g>`;
            b += hills(690, 28, "#7ccf6a", 2.4, 1.2, { tufts: 30 });
            // a picket fence, flower beds and grass
            for (let x = 40; x < W; x += 46) b += `<path d="M${x} 790 V${730 + Math.sin(x / 90) * 6} l11 -14 l11 14 V790Z" fill="#fffaf0" ${st(4)}/>`;
            b += `<path d="M0 752 H${W} M0 780 H${W}" stroke="${INK}" stroke-width="11"/><path d="M0 752 H${W} M0 780 H${W}" stroke="#fffaf0" stroke-width="5"/>`;
            b += hills(800, 14, "#5fb54f", 4, 1, { tufts: 60 });
            for (let i = 0; i < 26; i++) { const x = 30 + i * 61 + R() * 30; if (x > 640 && x < 980) continue; b += flower(x, 850 + R() * 30, ["#ff7fb0", "#ffd23f", "#b48cff", "#ff8a5c", "#7fd1ff", "#ff5c7a"][i % 6], i % 3, 0.9 + R() * 0.4); }
            const bf = (k, c) => `<g data-k="${k}"><g data-k="${k}w"><path d="M0 0 Q-24 -26 -30 -6 Q-24 10 0 0Z M0 0 Q24 -26 30 -6 Q24 10 0 0Z" fill="${c}" ${st(2.5)}/><path d="M0 0 Q-18 10 -16 22 Q-4 16 0 0Z M0 0 Q18 10 16 22 Q4 16 0 0Z" fill="${shade(c, -0.2)}" ${st(2.5)}/></g><path d="M0 -10 V12" ${st(4)}/></g>`;
            b += bf("bf0", "#ffb84d") + bf("bf1", "#b48cff") + bf("bf2", "#7fd1ff");
            const plane = `<g data-k="plane"><path d="M-170 -10 L170 0 L-170 40 L-110 6Z" fill="${D.lin("pl", [[0, "#ffffff"], [1, "#dfe7f7"]])}" ${st(5)}/><path d="M-110 6 L170 0 L-150 -60Z" fill="#f4f7ff" ${st(5)}/>` +
                `<path d="M-150 -44 L150 -2 M-132 -26 L156 0 M-140 24 L150 4" stroke="#a9c1ec" stroke-width="2"/><path d="M-30 4 L170 0" stroke="#7d93c4" stroke-width="3"/><path d="M-110 6 L-170 40" stroke="#ef8f9a" stroke-width="2"/></g>`;
            const front = `<g data-k="fg">${Array.from({ length: 40 }, (_, i) => grass(i * 42 + R() * 20, 905, i % 2 ? "#3f9a3f" : "#4caf50", 1.4 + R())).join("")}</g>`;
            return { back: b, under: plane, front };
        },
        frame(t, s) {
            s.set("rays", `rotate(${f(t * 6)})`);
            s.set("mill", `rotate(${f(t * 70)})`);
            s.set("c1", `translate(${f(t * 12)} 0)`); s.set("c2", `translate(${f(-t * 20)} 0)`);
            s.set("fg", `skewX(${f(Math.sin(t * 2.4) * 4)})`);
            // the flight: across the sky with a loop the loop in the middle
            const pos = u => {
                const loop = seg(u, 0.38, 0.62, k => k), base = [lerp(-260, 980, u), lerp(250, 610, u * u)];
                const a = loop * Math.PI * 2;
                return loop > 0 && loop < 1 ? [base[0] + Math.sin(a) * 170 - (seg(u, 0.38, 0.62, k => k) * 0), base[1] - (1 - Math.cos(a)) * 170] : base;
            };
            const fly = seg(t, 0, 3.6, k => k), p = pos(fly), q = pos(Math.min(1, fly + 0.01));
            const rot = Math.atan2(q[1] - p[1], q[0] - p[0]) * 180 / Math.PI;
            const away = seg(t, 3.8, 5.0, inn);
            s.set("plane", `translate(${f(lerp(p[0], 1900, away))} ${f(lerp(p[1], p[1] - 420, away))}) rotate(${f(rot - away * 20)}) scale(1.35)`);
            if (t < 3.8) { s.hero(p[0] - 20, p[1] - 4, 0.9, rot, 1, 1); s.shadow(p[0], 900, 0.4, 0); }
            else {
                const land = seg(t, 3.8, 4.5), up = Math.sin(land * Math.PI);
                s.hero(lerp(p[0], 820, land), lerp(p[1], 860, land) - up * 160, 1.1, lerp(rot, 0, land), 1, 1, land >= 1 && t < 4.7 ? 0.9 : 1);
                s.shadow(lerp(p[0], 820, land), 866, 1.1, land * 0.22);
            }
            if (t > 4.5 && !s.once("land")) { s.emit("petal", 60, [820, 850]); s.emit("ring", 1, [820, 862]); s.shake(6); }
            if (t < 3.7 && Math.random() < 0.5) s.emit("trail", 1, [p[0] - Math.cos(rot * Math.PI / 180) * 200, p[1] - Math.sin(rot * Math.PI / 180) * 200]);
            if (Math.random() < 0.12) s.emit("seed", 1, [rnd(-50, W), rnd(500, 850)]);
            for (let i = 0; i < 3; i++) {
                const bx = [300, 1300, 560][i] + Math.sin(t * (0.8 + i * 0.3) + i) * 120, by = [700, 640, 560][i] + Math.sin(t * 1.7 + i * 2) * 40;
                s.set("bf" + i, `translate(${f(bx)} ${f(by)}) rotate(${f(Math.sin(t * 2 + i) * 15)})`);
                s.set("bf" + i + "w", `scale(${f(0.3 + Math.abs(Math.sin(t * 14 + i)) * 0.7)} 1)`);
            }
            s.cam(lerp(800, clamp(p[0], 500, 1100), t < 3.8 ? 0.45 : 0.45 * (1 - seg(t, 3.8, 5.0))), lerp(450, clamp(p[1], 300, 600), 0.3 * (1 - seg(t, 3.8, 5))), lerp(1.12, 1, seg(t, 3.6, 5.2)), 0);
        }
    };

    // ---- Acorn Woods: down the path into the autumn trees ----
    S.squirrel = {
        T: 7.2,
        build: (D, R) => {
            let b = glow(D, "sun", 1250, 300, 360, "#fff0c0", 0.95) + `<circle cx="1250" cy="300" r="80" fill="#ffe9a8"/>`;
            b += `<g data-k="far" opacity=".75">${Array.from({ length: 14 }, (_, i) => tree(i * 150 - 40 + R() * 40, 640, 0.75 + R() * 0.25, ["#f2b07a", "#e8946a", "#f5c48a"][i % 3], "#b8846a")).join("")}</g>`;
            b += `<g data-k="rays" opacity=".5">${[0, 1, 2, 3, 4].map(i => `<path d="M${1250 - i * 30} 300 L${200 + i * 260} 900 L${320 + i * 260} 900Z" fill="#fff6d6" opacity=".35"/>`).join("")}</g>`;
            b += `<g data-k="mid">${Array.from({ length: 10 }, (_, i) => tree(i * 330 + R() * 60, 740, 1.05 + R() * 0.3, ["#e8792b", "#d9542a", "#f2a93b", "#c9642d"][i % 4], "#7a4a2c")).join("")}</g>`;
            b += hills(730, 12, "#c8a46a", 2, 1.4, { tufts: 20 });
            b += `<path d="M-100 900 Q500 760 800 800 Q1200 840 1700 780 L1700 1000 L-100 1000Z" fill="#b38a55" ${st(5)}/><path d="M-100 940 Q500 800 800 840 Q1200 880 1700 820" fill="none" stroke="#9a7444" stroke-width="5" opacity=".6"/>`;
            b += `<g data-k="path">${Array.from({ length: 24 }, (_, i) => `<ellipse cx="${i * 140 + R() * 60}" cy="${845 + R() * 40}" rx="${12 + R() * 14}" ry="${7 + R() * 5}" fill="#8f8a80" ${st(3)}/>`).join("")}` +
                Array.from({ length: 10 }, (_, i) => { const x = 60 + i * 290 + R() * 60; return `<g transform="translate(${f(x)} 790)"><rect x="-6" y="-26" width="12" height="26" rx="4" fill="#fff4e0" ${st(3)}/><path d="M-26 -24 Q0 -56 26 -24Z" fill="#e5484d" ${st(3.5)}/><circle cx="-9" cy="-34" r="4" fill="#fff"/><circle cx="8" cy="-38" r="3" fill="#fff"/></g>`; }).join("") + `</g>`;
            // the log and the squirrel
            b += `<g data-k="logg"><g transform="translate(1180 800)"><rect x="-140" y="-40" width="280" height="56" rx="26" fill="#8a5a3c" ${st(5)}/><ellipse cx="140" cy="-12" rx="22" ry="28" fill="#c9a06a" ${st(4)}/><path d="M130 -12 a10 12 0 1 0 20 0" fill="none" stroke="#8a5a3c" stroke-width="3"/><path d="M-110 -20 H60 M-80 -2 H100" stroke="#6b4226" stroke-width="3"/>` +
                `<g data-k="sq"><path d="M10 -40 C-40 -40 -60 -110 -10 -130 C30 -144 40 -100 10 -90" fill="#c9772d" ${st(4)}/><ellipse cx="34" cy="-60" rx="26" ry="22" fill="#d98a3d" ${st(4)}/><circle cx="56" cy="-86" r="16" fill="#d98a3d" ${st(4)}/><path d="M50 -100 l4 -12 l6 10" fill="#d98a3d" ${st(3)}/><circle cx="62" cy="-88" r="3" fill="${INK}"/><ellipse cx="34" cy="-56" rx="12" ry="12" fill="#ffe0b0"/></g></g>` +
                `<g data-k="acorn"><ellipse cx="0" cy="0" rx="12" ry="14" fill="#c98a4b" ${st(3)}/><path d="M-14 -4 Q0 -20 14 -4Z" fill="#7a4a2c" ${st(3)}/></g></g>`;
            b += `<g data-k="pile"><path d="M480 900 Q560 790 680 820 Q760 770 860 830 Q960 800 1040 900Z" fill="#e8792b" ${st(5)}/>${Array.from({ length: 22 }, () => `<ellipse cx="${f(520 + R() * 500)}" cy="${f(840 + R() * 50)}" rx="14" ry="7" fill="${["#d9542a", "#f2a93b", "#c9642d", "#ffcf5a"][Math.floor(R() * 4)]}" ${st(2)} transform="rotate(${f(R() * 180)} ${f(520 + R() * 500)} ${f(840 + R() * 50)})"/>`).join("")}</g>`;
            const front = `<g data-k="near">${Array.from({ length: 6 }, (_, i) => `<g transform="translate(${i * 520 - 200} 0)"><path d="M-40 1000 Q-30 400 -50 -50 H50 Q30 400 40 1000Z" fill="#5a3826" ${st(6)}/><path d="M-20 900 Q-10 500 -24 0 M14 950 Q20 500 10 0" stroke="#3e2618" stroke-width="5" fill="none"/>` +
                `<path d="M30 180 Q120 120 200 150" stroke="${INK}" stroke-width="22" fill="none" stroke-linecap="round"/><path d="M30 180 Q120 120 200 150" stroke="#5a3826" stroke-width="13" fill="none" stroke-linecap="round"/>${[[200, 140], [170, 110], [140, 160]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="34" fill="${["#d9542a", "#f2a93b", "#e8792b"][i % 3]}" ${st(4)}/>`).join("")}</g>`).join("")}` +
                Array.from({ length: 16 }, (_, i) => `<path d="M${i * 200 + 40} 905 q-20 -40 -60 -50 q30 -6 60 30 q-6 -46 20 -70 q8 40 -8 80 q40 -30 70 -20 q-30 20 -70 34Z" fill="${["#4f7a3a", "#6b8f3a"][i % 2]}" ${st(3)}/>`).join("") + `</g>`;
            return { back: b, front };
        },
        frame(t, s) {
            const walk = seg(t, 0, 4.0, k => k);
            s.set("far", `translate(${f(-walk * 260)} 0)`); s.set("mid", `translate(${f(-walk * 560)} 0)`);
            s.set("path", `translate(${f(-walk * 760)} 0)`); s.set("near", `translate(${f(-walk * 1400)} 0)`);
            s.set("logg", `translate(${f(-walk * 760)} 0)`); s.set("pile", `translate(${f(-walk * 760 + 760)} 0)`);
            s.setStyle("rays", "opacity", 0.35 + Math.sin(t * 1.3) * 0.12);
            // the squirrel hops and tosses its acorn over the path
            const hop = Math.abs(Math.sin(t * 5)) * (t > 1.0 && t < 2.6 ? 22 : 0);
            s.set("sq", `translate(${f(seg(t, 1.0, 2.6) * -80)} ${f(-hop)})`);
            const toss = seg(t, 2.6, 3.6, k => k);
            s.set("acorn", `translate(${f(1236 - toss * 360)} ${f(714 - Math.sin(toss * Math.PI) * 260 + toss * 120)}) rotate(${f(toss * 600)})`);
            s.setStyle("acorn", "opacity", t > 2.6 && t < 3.7 ? 1 : 0);
            const x = lerp(160, 720, seg(t, 0, 2.4)), step = Math.sin(t * 7.5);
            if (t < 4.2) {
                s.hero(x, 838 - Math.abs(step) * 14, 1.2, step * 3, 1, 1);
                s.shadow(x, 842, 1.2, 0.22);
                if (Math.abs(step) < 0.15 && !s.once("st" + Math.floor(t * 7.5 / Math.PI))) s.emit("leafpuff", 4, [x, 840]);
            } else {
                const j = seg(t, 4.2, 4.9), up = Math.sin(j * Math.PI);
                s.hero(lerp(720, 790, j), lerp(838, 860, j) - up * 220, 1.2, j * 360 * 0, 1, 1, j >= 1 && t < 5.1 ? 0.85 : 1);
                s.shadow(lerp(720, 790, j), 862, 1.2 - up * 0.5, 0.22);
            }
            if (t > 4.9 && !s.once("pile")) { s.emit("leaf", 90, [790, 840]); s.shake(10); s.emit("ring", 1, [790, 860]); }
            if (Math.random() < 0.4) s.emit("leaf", 1, [rnd(-100, W + 100), -30]);
            s.cam(lerp(800, 780, seg(t, 3.8, 5.2)), lerp(450, 520, seg(t, 3.8, 5.2)), lerp(1.04, 1.18, seg(t, 3.6, 5.0)), 0);
        }
    };

    // ---- Candy Hills: the Candy Express (the user, 2026-10-14: "change the acorn to candy world animation"). A
    //      chocolate steam train with peppermint wheels waits at a little wooden stop in the autumn woods (a squirrel
    //      waves); the hero hops onto the gumdrop car, the train puffs into a hollow log and comes out of the far end,
    //      which is a chocolate swiss roll, into Candy Hills: over a candy-cane bridge and a chocolate river, past
    //      lollipop trees, to a gingerbread station, where the hero hops off into a burst of sprinkles ----
    // a strip of rolling hills from x0 to x1 (for scenes that scroll sideways)
    function wideHills(x0, x1, y, amp, fill, seed, line = 5) {
        let d = "";
        for (let x = x0; x <= x1; x += 40) d += `${x === x0 ? "M" : "L"}${x} ${f(y + Math.sin(x / 170 + seed) * amp + Math.sin(x / 61 + seed * 2) * amp * 0.3)} `;
        return `<path d="${d}L${x1} ${H + 400} L${x0} ${H + 400}Z" fill="${fill}" ${st(line)}/>`;
    }
    // a peppermint wheel (it turns with data-k)
    const mint = (x, y, r, k) => `<g transform="translate(${x} ${y})"><g data-k="${k}"><circle r="${r}" fill="#fff" ${st(5)}/>` +
        [0, 1, 2, 3, 4, 5].map(i => `<path d="M0 0 L${f(Math.cos(i * 1.047) * r * 0.9)} ${f(Math.sin(i * 1.047) * r * 0.9)} A${r * 0.9} ${r * 0.9} 0 0 1 ${f(Math.cos(i * 1.047 + 0.52) * r * 0.9)} ${f(Math.sin(i * 1.047 + 0.52) * r * 0.9)}Z" fill="#e5484d"/>`).join("") +
        `<circle r="${f(r * 0.28)}" fill="#fff" ${st(3)}/><circle r="${f(r * 0.1)}" fill="#c43a3f"/></g></g>`;
    // a lollipop tree
    const lolly = (x, y, s, c) => `<g transform="translate(${f(x)} ${f(y)}) scale(${s})"><path d="M0 0 V-120" stroke="${INK}" stroke-width="16" stroke-linecap="round"/><path d="M0 0 V-120" stroke="#fff" stroke-width="9" stroke-linecap="round"/>` +
        `<circle cy="-165" r="58" fill="${c}" ${st(5)}/><path d="M-38 -165 a38 38 0 0 1 76 0 a24 24 0 0 1 -48 0 a12 12 0 0 1 22 0" fill="none" stroke="#fff" stroke-width="7"/><circle cx="-24" cy="-190" r="10" fill="#fff" opacity=".5"/></g>`;
    // a gumdrop
    const gumdrop = (x, y, s, c) => `<g transform="translate(${f(x)} ${f(y)}) scale(${s})"><path d="M-40 0 Q-40 -64 0 -68 Q40 -64 40 0Z" fill="${c}" ${st(5)}/><circle cx="-14" cy="-42" r="8" fill="#fff" opacity=".5"/>${[[-22, -16], [-6, -30], [12, -14], [22, -38], [0, -52]].map(([a, b]) => `<circle cx="${a}" cy="${b}" r="2.6" fill="#fff" opacity=".75"/>`).join("")}</g>`;
    S.candy = {
        T: 7.6,
        build: (D, R) => {
            const TRACK = 770;
            D.raw(`<pattern id="tvc-cane" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="26" height="26" fill="#fff"/><rect width="12" height="26" fill="#e5484d"/></pattern>`);
            const cane = "url(#tvc-cane)";
            // the skies: an autumn afternoon, and Candy Hills' pink one fading in over it
            let b = `<rect x="-100" y="-100" width="${W + 200}" height="${H + 200}" fill="${D.lin("skyA", [[0, "#ffb36b"], [1, "#ffe6bf"]])}"/>` + glow(D, "sunA", 1180, 230, 360, "#fff0c0", 0.9) + `<circle cx="1180" cy="230" r="78" fill="#ffe9a8"/>`;
            b += `<g data-k="skyB" opacity="0"><rect x="-100" y="-100" width="${W + 200}" height="${H + 200}" fill="${D.lin("skyB", [[0, "#ffb3dc"], [1, "#fff0d1"]])}"/>` + glow(D, "sunB", 1180, 210, 330, "#fffaf2", 0.95) +
                `<circle cx="1180" cy="210" r="74" fill="#fff6e8" ${st(5)}/><circle cx="1160" cy="195" r="20" fill="#fff" opacity=".7"/>` +
                `<g data-k="cotton">${[[220, 150, 1], [760, 100, 0.75], [1420, 170, 1.05], [1900, 120, 0.8]].map(([x, y, sc]) => cloud(x, y, sc, "#ffe0f0", "#ffc2e0")).join("")}</g></g>`;
            // far away (they move a fifth as fast): autumn hills and woods, or candy mountains with frosting caps
            let farA = wideHills(-100, 2400, 600, 26, "#e9b77a", 1, 4) + Array.from({ length: 18 }, (_, i) => tree(i * 140 - 60 + R() * 40, 612, 0.5 + R() * 0.2, ["#f2b07a", "#e8946a", "#f5c48a"][i % 3], "#b8846a")).join("");
            let farB = [[160, 560, 300], [600, 500, 380], [1100, 540, 340], [1560, 520, 320], [2000, 560, 300], [2350, 520, 280]].map(([x, y, w], i) =>
                `<path d="M${x - w} ${y + 220} L${x} ${y - 160} L${x + w} ${y + 220}Z" fill="${["#c9a0ff", "#ffb3d1", "#a0e7ff", "#ffd8a0"][i % 4]}" ${st(5)}/>` +
                `<path d="M${f(x - w * 0.42)} ${y - 92} L${x} ${y - 160} L${f(x + w * 0.42)} ${y - 92} Q${f(x + w * 0.25)} ${y - 66} ${f(x + w * 0.12)} ${y - 92} Q${x} ${y - 56} ${f(x - w * 0.12)} ${y - 92} Q${f(x - w * 0.27)} ${y - 62} ${f(x - w * 0.42)} ${y - 92}Z" fill="#fff" ${st(4)}/>`).join("") +
                wideHills(-100, 2400, 640, 22, "#ffc8e4", 3, 4);
            b += `<g data-k="farA">${farA}</g><g data-k="farB" opacity="0">${farB}</g>`;
            // the middle distance (half as fast): autumn trees, or lollipop trees and gumdrops
            let midA = wideHills(-100, 3200, 700, 14, "#d9b06a", 2, 4) + Array.from({ length: 13 }, (_, i) => tree(i * 250 + R() * 60, 712, 0.85 + R() * 0.25, ["#e8792b", "#d9542a", "#f2a93b", "#c9642d"][i % 4], "#7a4a2c")).join("");
            let midB = wideHills(-100, 3200, 700, 14, "#ffe0ef", 4, 4) + Array.from({ length: 14 }, (_, i) => i % 3 === 2
                ? gumdrop(i * 240 + R() * 50, 712, 0.9 + R() * 0.4, ["#5fd4c4", "#ff8a5c", "#b48cff", "#ffd23f"][i % 4])
                : lolly(i * 240 + R() * 50, 712, 0.65 + R() * 0.25, ["#ff5c7a", "#7fd1ff", "#ffd23f", "#b48cff", "#5fd4c4"][i % 5])).join("");
            b += `<g data-k="midA">${midA}</g><g data-k="midB" opacity="0">${midB}</g>`;
            // ---- the world itself (it scrolls past at full speed) ----
            let w = "";
            // the ground: autumn earth and grass, then pink frosting with sprinkles, a gap for the chocolate river
            w += `<path d="M-300 ${TRACK + 6} H2360 V${H + 300} H-300Z" fill="#a9824e" ${st(5)}/><path d="M-300 ${TRACK + 6} H2360" stroke="#8fae4a" stroke-width="14"/>`;
            for (let i = 0; i < 70; i++) { const x = -260 + R() * 2580; w += `<path d="M${f(x)} ${TRACK + 2} l-5 -16 M${f(x)} ${TRACK + 2} l3 -20 M${f(x)} ${TRACK + 2} l8 -12" stroke="#6f8f3a" stroke-width="3" stroke-linecap="round"/>`; }
            for (let i = 0; i < 30; i++) { const x = -260 + R() * 2580, y = TRACK + 40 + R() * 120; w += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="12" ry="6" fill="${["#d9542a", "#f2a93b", "#c9642d"][i % 3]}" transform="rotate(${f(R() * 180)} ${f(x)} ${f(y)})"/>`; }
            const candyGround = (x0, x1) => {
                let g = `<path d="M${x0} ${TRACK + 6} H${x1} V${H + 300} H${x0}Z" fill="#ffd1e8" ${st(5)}/><path d="M${x0} ${TRACK + 10} H${x1}" stroke="#fff" stroke-width="10"/>`;
                for (let x = x0 + 10; x < x1; x += 60) g += `<path d="M${x} ${TRACK + 14} q14 ${f(20 + R() * 24)} 28 0" fill="#fff" ${st(3)}/>`;
                for (let i = 0; i < (x1 - x0) / 18; i++) { const x = x0 + R() * (x1 - x0), y = TRACK + 50 + R() * 140; g += `<rect x="${f(x)}" y="${f(y)}" width="14" height="5" rx="2.5" fill="${["#ff5c7a", "#ffd23f", "#5fd4c4", "#7b8cff", "#fff"][i % 5]}" transform="rotate(${f(R() * 180)} ${f(x)} ${f(y)})"/>`; }
                return g;
            };
            w += candyGround(2340, 2800) + candyGround(3560, 5200);
            // the chocolate river under the bridge, flowing
            D.raw(`<clipPath id="tvc-river"><rect x="2790" y="${TRACK + 20}" width="780" height="400"/></clipPath>`);
            w += `<rect x="2790" y="${TRACK + 20}" width="780" height="400" fill="${D.lin("choc", [[0, "#8a4a26"], [1, "#4a2412"]])}" ${st(5)}/>` +
                `<g clip-path="url(#tvc-river)"><g data-k="flow">${Array.from({ length: 22 }, (_, i) => `<path d="M${2700 + i * 50} ${TRACK + 60 + (i % 4) * 34} q25 -12 50 0 q25 12 50 0" fill="none" stroke="#b8784a" stroke-width="5" stroke-linecap="round" opacity=".7"/>`).join("")}</g></g>`;
            // the track: rails on wooden sleepers in the woods, on candy-coloured ones in Candy Hills
            for (let x = -260; x < 4000; x += 42) w += `<rect x="${x}" y="${TRACK - 4}" width="24" height="14" rx="3" fill="${x < 2300 ? "#7a4a2c" : ["#ff7fb0", "#7fd1ff", "#ffd23f", "#b48cff"][Math.abs(Math.round(x / 42)) % 4]}" ${st(2.5)}/>`;
            w += `<rect x="-300" y="${TRACK - 10}" width="4300" height="9" rx="3" fill="#9aa3b2" ${st(3)}/>`;
            // the bridge over the river: a frosting deck on candy-cane posts
            w += `<rect x="2740" y="${TRACK + 2}" width="880" height="26" rx="6" fill="#fff4fa" ${st(5)}/>` + Array.from({ length: 9 }, (_, i) => `<rect x="${2790 + i * 96}" y="${TRACK + 28}" width="24" height="320" fill="${cane}" ${st(4)}/>`).join("") +
                Array.from({ length: 10 }, (_, i) => `<path d="M${2750 + i * 96} ${TRACK - 40} V${TRACK} M${2750 + i * 96} ${TRACK - 40} q14 -16 28 0" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round"/><path d="M${2750 + i * 96} ${TRACK - 40} V${TRACK} M${2750 + i * 96} ${TRACK - 40} q14 -16 28 0" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>`).join("") +
                `<path d="M2740 ${TRACK - 26} H3620" stroke="${INK}" stroke-width="10"/><path d="M2740 ${TRACK - 26} H3620" stroke="#ff7fb0" stroke-width="5"/>`;
            // the stop in the woods: a wooden platform, a sign with an acorn, a lantern, the squirrel waving goodbye
            w += `<rect x="100" y="${TRACK + 12}" width="460" height="34" fill="#9a6a3c" ${st(5)}/>${[0, 1, 2, 3, 4, 5].map(i => `<path d="M${130 + i * 76} ${TRACK + 12} V${TRACK + 46}" stroke="#6b4226" stroke-width="3"/>`).join("")}<rect x="110" y="${TRACK + 46}" width="16" height="70" fill="#6b4226" ${st(3)}/><rect x="534" y="${TRACK + 46}" width="16" height="70" fill="#6b4226" ${st(3)}/>` +
                `<g transform="translate(250 ${TRACK + 12})"><rect x="-6" y="-150" width="12" height="150" fill="#6b4226" ${st(4)}/><rect x="-60" y="-200" width="120" height="64" rx="10" fill="#f2dcb0" ${st(5)}/><g transform="translate(0 -168)"><ellipse cy="6" rx="14" ry="17" fill="#c98a4b" ${st(3)}/><path d="M-17 0 Q0 -20 17 0Z" fill="#7a4a2c" ${st(3)}/></g></g>` +
                `<g transform="translate(500 ${TRACK + 12})"><rect x="-5" y="-170" width="10" height="170" fill="#3a3326"/><rect x="-18" y="-206" width="36" height="40" rx="6" fill="#ffd56b" ${st(4)}/>${glow(D, "lant", 0, -186, 70, "#ffe9a8", 0.6)}</g>` +
                `<g transform="translate(170 ${TRACK + 12})"><path d="M10 0 C-40 0 -60 -70 -10 -90 C30 -104 40 -60 10 -50" fill="#c9772d" ${st(4)}/><ellipse cx="34" cy="-22" rx="24" ry="22" fill="#d98a3d" ${st(4)}/><circle cx="52" cy="-50" r="16" fill="#d98a3d" ${st(4)}/><path d="M46 -64 l4 -12 l6 10" fill="#d98a3d" ${st(3)}/><circle cx="58" cy="-52" r="3" fill="${INK}"/><ellipse cx="34" cy="-18" rx="12" ry="12" fill="#ffe0b0"/>` +
                `<g transform="translate(46 -30)"><g data-k="wave"><path d="M0 0 L18 -30" stroke="${INK}" stroke-width="12" stroke-linecap="round"/><path d="M0 0 L18 -30" stroke="#d98a3d" stroke-width="7" stroke-linecap="round"/></g></g></g>`;
            // the gingerbread station: icing on the edges, gumdrops on the roof, a candy-cane porch, a lollipop lamp
            w += `<rect x="3960" y="${TRACK + 12}" width="900" height="34" fill="#c98a4b" ${st(5)}/><path d="M3960 ${TRACK + 12} H4860" stroke="#fff" stroke-width="8"/>${Array.from({ length: 14 }, (_, i) => `<path d="M${3970 + i * 64} ${TRACK + 16} q12 ${f(14 + R() * 12)} 24 0" fill="#fff" ${st(2)}/>`).join("")}` +
                `<g transform="translate(4250 ${TRACK})"><rect x="-230" y="-260" width="460" height="262" fill="#c98a4b" ${st(6)}/>${[-150, 0, 150].map(x => `<rect x="${x - 34}" y="-210" width="68" height="74" rx="8" fill="#ffe08a" ${st(4)}/><path d="M${x - 34} -210 q17 16 34 0 q17 16 34 0" fill="none" stroke="#fff" stroke-width="7"/><path d="M${x} -210 V-136 M${x - 34} -173 H${x + 34}" stroke="#a8743e" stroke-width="3"/>`).join("")}` +
                `<rect x="-40" y="-110" width="80" height="112" rx="36" fill="#ff7fb0" ${st(5)}/><circle cx="24" cy="-54" r="6" fill="#ffd23f" ${st(2)}/>` +
                `<path d="M-270 -250 L0 -400 L270 -250Z" fill="#8a5a3c" ${st(6)}/><path d="M-280 -246 L0 -404 L280 -246" fill="none" stroke="#fff" stroke-width="18" stroke-linecap="round"/>${[-200, -120, -40, 40, 120, 200].map((x, i) => `<path d="M${x} ${-252 + Math.abs(x) * 0} q10 ${14 + (i % 3) * 8} 20 0" fill="#fff" ${st(2)}/>`).join("")}` +
                [[-150, -300, "#ff5c7a"], [-60, -350, "#5fd4c4"], [60, -350, "#ffd23f"], [150, -300, "#b48cff"]].map(([x, y, c]) => gumdrop(x, y, 0.45, c)).join("") +
                `<rect x="-250" y="-120" width="22" height="122" fill="${cane}" ${st(4)}/><rect x="228" y="-120" width="22" height="122" fill="${cane}" ${st(4)}/></g>` +
                `<g transform="translate(4620 ${TRACK + 12})">${lolly(0, 0, 0.8, "#ffd23f")}${glow(D, "lamp", 0, -132, 90, "#fff3b0", 0.55)}</g>` +
                `<rect x="3990" y="${TRACK - 40}" width="26" height="46" rx="6" fill="#ff5c7a" ${st(4)}/><rect x="3986" y="${TRACK - 46}" width="34" height="14" rx="5" fill="#ffd23f" ${st(3)}/>`;
            // things on the near side of the track in Candy Hills
            w += [[2420, "#5fd4c4"], [3700, "#ff8a5c"], [4760, "#b48cff"]].map(([x, c]) => gumdrop(x, H - 20, 1.1, c)).join("");
            b += `<g data-k="wB">${w}</g>`;
            // ---- in front of the train: the hollow log tunnel (bark at the start, a chocolate roll at the far end), bushes ----
            let fr = `<g transform="translate(1950 0)"><rect x="0" y="${TRACK - 300}" width="720" height="${H - TRACK + 340}" fill="${D.lin("logbody", [[0, "#7a4a2c"], [0.48, "#8a5a3c"], [0.52, "#5a2e18"], [1, "#4a2412"]], 0, 0, 1, 0)}" ${st(6)}/>`;
            for (let i = 0; i < 9; i++) fr += `<path d="M${30 + i * 36} ${TRACK - 290} Q${40 + i * 36} ${TRACK - 150} ${26 + i * 36} ${TRACK}" stroke="#5a3826" stroke-width="5" fill="none" opacity=".7"/>`;
            fr += `<path d="M380 ${TRACK - 300} H720 V${TRACK - 270} Q690 ${TRACK - 236} 660 ${TRACK - 270} Q620 ${TRACK - 220} 580 ${TRACK - 270} Q540 ${TRACK - 240} 500 ${TRACK - 270} Q450 ${TRACK - 226} 410 ${TRACK - 270} Q395 ${TRACK - 250} 380 ${TRACK - 270}Z" fill="#ff9ecb" ${st(4)}/>`;
            for (let i = 0; i < 16; i++) fr += `<rect x="${f(400 + R() * 300)}" y="${f(TRACK - 296 + R() * 20)}" width="12" height="4" rx="2" fill="${["#ffd23f", "#5fd4c4", "#fff", "#7b8cff"][i % 4]}"/>`;
            fr += `<path d="M0 ${TRACK - 300} Q60 ${TRACK - 330} 130 ${TRACK - 304} Q200 ${TRACK - 336} 260 ${TRACK - 300}" fill="#6f8f3a" ${st(4)}/>${[40, 120, 200].map(x => `<ellipse cx="${x}" cy="${TRACK - 316}" rx="16" ry="8" fill="#d9542a" ${st(2)}/>`).join("")}`;
            // the log's mouth (dark, with growth rings) and its far end (a swiss roll with a cream spiral)
            fr += `<ellipse cx="0" cy="${TRACK - 130}" rx="70" ry="182" fill="#c9a06a" ${st(6)}/><ellipse cx="4" cy="${TRACK - 130}" rx="50" ry="150" fill="#1e120a"/>`;
            fr += `<ellipse cx="720" cy="${TRACK - 130}" rx="70" ry="182" fill="#5a2e18" ${st(6)}/><path d="M720 ${TRACK - 130} m-8 0 a12 26 0 1 1 24 0 a26 56 0 1 1 -50 0 a40 86 0 1 1 78 0 a52 114 0 1 1 -104 0" fill="none" stroke="#fff4e6" stroke-width="12"/>`;
            fr += `</g>`;
            fr += Array.from({ length: 9 }, (_, i) => `<path d="M${i * 240 - 100} 912 q-24 -48 -70 -58 q36 -6 70 34 q-6 -54 24 -84 q10 46 -8 92 q46 -34 80 -24 q-34 24 -80 40Z" fill="${["#4f7a3a", "#6b8f3a"][i % 2]}" ${st(3)}/>`).join("");
            fr += [[2900, H - 6], [3300, H - 10]].map(([x, y]) => `<g transform="translate(${x} ${y})"><path d="M0 0 V-140 q0 -40 36 -40 q36 0 36 30" fill="none" stroke="${INK}" stroke-width="26" stroke-linecap="round"/><path d="M0 0 V-140 q0 -40 36 -40 q36 0 36 30" fill="none" stroke="${cane}" stroke-width="16" stroke-linecap="round"/></g>`).join("");
            // ---- the Candy Express (its origin is the engine's middle, on the rails) ----
            const train = `<g data-k="train">` +
                // the ice-cream car
                `<g><rect x="-800" y="-122" width="290" height="80" rx="16" fill="#ffe08a" ${st(5)}/>${Array.from({ length: 6 }, (_, i) => `<path d="M${-790 + i * 48} -120 l40 76 M${-750 + i * 48} -120 l-40 76" stroke="#d9a640" stroke-width="3" opacity=".7"/>`).join("")}` +
                `<ellipse cx="-655" cy="-130" rx="120" ry="34" fill="#fff" ${st(5)}/><ellipse cx="-655" cy="-165" rx="86" ry="30" fill="#ffd1e8" ${st(5)}/><ellipse cx="-655" cy="-196" rx="52" ry="24" fill="#fff" ${st(5)}/><circle cx="-650" cy="-226" r="16" fill="#e5484d" ${st(4)}/><path d="M-646 -240 q8 -18 20 -20" fill="none" ${st(4)}/></g>` +
                // the gumdrop car (the hero rides on it)
                `<g><rect x="-480" y="-132" width="300" height="90" rx="14" fill="#7fd1ff" ${st(5)}/><path d="M-480 -104 H-180 M-480 -74 H-180" stroke="#fff" stroke-width="6"/>` +
                [[-450, "#ff5c7a"], [-400, "#ffd23f"], [-350, "#5fd4c4"], [-300, "#b48cff"], [-250, "#ff8a5c"], [-210, "#ff5c7a"]].map(([x, c]) => `<path d="M${x - 24} -128 Q${x - 24} -168 ${x} -170 Q${x + 24} -168 ${x + 24} -128Z" fill="${c}" ${st(4)}/>`).join("") + `</g>` +
                `<path d="M-510 -60 H-480 M-180 -60 H-140" ${st(10)}/>` +
                // the engine: a chocolate boiler with strawberry bands, a peppermint chimney, a cream dome, a strawberry cab with a frosting roof, a lollipop lamp, a candy-cane cowcatcher
                `<rect x="-140" y="-80" width="350" height="36" rx="8" fill="#4a2614" ${st(5)}/>` +
                `<rect x="-40" y="-190" width="230" height="114" rx="54" fill="${D.lin("boil", [[0, "#9a5a34"], [0.5, "#6b3a22"], [1, "#4a2614"]])}" ${st(6)}/>${[10, 80, 150].map(x => `<rect x="${x}" y="-188" width="16" height="110" fill="#ff9ecb" ${st(3)}/>`).join("")}` +
                `<path d="M96 -190 V-262 M130 -190 V-262" stroke="${INK}" stroke-width="5"/><rect x="96" y="-262" width="34" height="72" fill="${cane}" ${st(5)}/><path d="M80 -290 H146 L132 -262 H94Z" fill="#e5484d" ${st(5)}/>` +
                `<path d="M20 -190 A26 26 0 0 1 72 -190Z" fill="#fff4e6" ${st(4)}/>` +
                `<rect x="-140" y="-286" width="110" height="210" rx="10" fill="#ff7fb0" ${st(6)}/><rect x="-118" y="-258" width="66" height="56" rx="8" fill="#bfe8ff" ${st(4)}/><path d="M-160 -284 H-12 V-300 Q-86 -326 -160 -300Z" fill="#fff" ${st(5)}/>${[-150, -110, -70, -30].map(x => `<path d="M${x} -284 q8 14 16 0" fill="#fff" ${st(2)}/>`).join("")}` +
                `<circle cx="206" cy="-140" r="40" fill="#8a4a2a" ${st(5)}/><circle cx="214" cy="-140" r="22" fill="#ffd23f" ${st(4)}/><path d="M200 -140 a14 14 0 0 1 28 0 a8 8 0 0 1 -16 0" fill="none" stroke="#fff" stroke-width="4"/>${glow(D, "head", 230, -140, 80, "#fff6c0", 0.5)}` +
                `<path d="M200 -44 L262 0 H200Z" fill="${cane}" ${st(5)}/>` +
                `<circle cx="-180" cy="-60" r="10" fill="#ffd23f" ${st(3)}/>` +
                mint(-80, -40, 40, "tw0") + mint(40, -40, 40, "tw1") + mint(150, -30, 30, "tw2") + mint(-430, -28, 28, "tw3") + mint(-230, -28, 28, "tw4") + mint(-750, -28, 28, "tw5") + mint(-560, -28, 28, "tw6") +
                `<g data-k="rod"><path d="M-80 -40 H40" stroke="${INK}" stroke-width="12" stroke-linecap="round"/><path d="M-80 -40 H40" stroke="#e8c66a" stroke-width="6" stroke-linecap="round"/></g>` +
                `<g data-k="bell" transform="translate(150 -190)"><path d="M-12 0 Q-12 -22 0 -24 Q12 -22 12 0Z" fill="#ffd23f" ${st(3)}/></g>` +
                `</g>`;
            return { back: b, under: train, front: `<g data-k="wF">${fr}</g>` };
        },
        frame(t, s) {
            const TRACK = 770;
            // the trip: 2850 units along, speeding up and slowing into the station
            const k0 = seg(t, 1.0, 5.0, k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2), sc = k0 * 2850;
            const speed = t > 1.0 && t < 5.0 ? Math.sin(seg(t, 1.0, 5.0, k => k) * Math.PI) : 0;
            s.set("wB", `translate(${f(-sc)} 0)`); s.set("wF", `translate(${f(-sc)} 0)`);
            s.set("farA", `translate(${f(-sc * 0.2)} 0)`); s.set("farB", `translate(${f(-sc * 0.2)} 0)`);
            s.set("midA", `translate(${f(-sc * 0.5)} 0)`); s.set("midB", `translate(${f(-sc * 0.5)} 0)`);
            const cand = seg(sc, 1350, 2050);                       // how far into Candy Hills (the swap happens while the train is in the log)
            s.setStyle("skyB", "opacity", cand); s.setStyle("farB", "opacity", cand); s.setStyle("midB", "opacity", cand);
            s.setStyle("farA", "opacity", 1 - cand); s.setStyle("midA", "opacity", 1 - cand);
            s.set("cotton", `translate(${f(t * 16)} 0)`);
            s.set("flow", `translate(${f(-(t * 70) % 100)} 0)`);
            // the train: wheels turning, the coupling rod going round, a little rattle while it runs
            const turn = sc / 40, bob = Math.sin(t * 34) * 1.6 * speed;
            for (let i = 0; i < 7; i++) s.set("tw" + i, `rotate(${f(turn * 57.3 * (i < 2 ? 1 : i === 2 ? 1.33 : 1.43))})`);
            s.set("rod", `translate(${f(Math.cos(turn) * 16)} ${f(Math.sin(turn) * 16)})`);
            s.set("train", `translate(900 ${f(TRACK + bob)})`);
            s.set("bell", `translate(150 -190) rotate(${f(t < 1.2 || (t > 4.8 && t < 5.6) ? Math.sin(t * 22) * 22 : 0)})`);
            // puffs from the chimney: grey steam in the woods, pink cotton candy in Candy Hills
            if (Math.random() < 0.35 + speed * 0.5) s.emit(cand > 0.5 ? "cotton" : "steam", 1, [1013, TRACK - 300 + bob]);
            if (speed > 0.3 && Math.random() < 0.3) s.emit("spark", 1, [900 + rnd(-120, 150), TRACK - 6]);
            // the squirrel waves goodbye
            s.set("wave", `rotate(${f(Math.sin(t * 9) * 30 - 10)})`);
            // the hero: hops onto the gumdrop car, rides it, hops off at the station
            const carX = 900 - 330, carY = TRACK - 168 + bob;
            if (t < 0.45) { s.hero(380, TRACK + 12, 1.0, 0, 1, 1); s.shadow(380, TRACK + 14, 1, 0.22); }
            else if (t < 1.05) {
                const j = seg(t, 0.45, 1.05), up = Math.sin(j * Math.PI);
                s.hero(lerp(380, carX, j), lerp(TRACK + 12, carY, j) - up * 170, 1.0, j * 20 * (1 - j) * 4, 1, 1, j >= 1 ? 0.9 : 1);
                s.shadow(380, TRACK + 14, 1, 0.22 * (1 - j));
            } else if (t < 5.25) s.hero(carX, carY, 1.0, Math.sin(t * 5) * 4 * speed, 1, 1, t < 1.2 ? 0.9 : 1);
            else {
                const j = seg(t, 5.25, 6.0), up = Math.sin(j * Math.PI);
                s.hero(lerp(carX, 1230, j), lerp(carY, TRACK + 12, j) - up * 330, 1.05, j < 1 ? j * 360 : 0, 1, 1, j >= 1 && t < 6.2 ? 0.86 : 1);
                s.shadow(lerp(carX, 1230, j), TRACK + 14, 1.05 - up * 0.5, 0.22 * j);
            }
            if (t > 0.98 && !s.once("board")) s.emit("leafpuff", 10, [carX, carY]);
            // out of the log: a burst of sprinkles where the swiss roll ends
            const exitX = 2670 - sc;
            if (exitX < 1050 && !s.once("exit")) { s.emit("sprinkle", 60, [Math.max(exitX, 860), TRACK - 150]); s.emit("sparkle", 30, [Math.max(exitX, 860), TRACK - 150]); s.flash("#fff0f8", 0.35); }
            // into the station: brakes, a big pink puff, the bell
            if (t > 4.7 && t < 5.0 && Math.random() < 0.8) s.emit("spark", 2, [900 + rnd(-100, 150), TRACK - 4]);
            if (t > 5.0 && !s.once("stop")) { s.emit("cotton", 26, [1013, TRACK - 300]); s.shake(5); }
            if (t > 6.0 && !s.once("land")) { s.emit("sprinkle", 50, [1230, TRACK + 4]); s.emit("confetti", 40, [1230, TRACK - 40]); s.emit("ring", 1, [1230, TRACK + 12]); s.shake(7); }
            // falling: leaves in the woods, candy over Candy Hills
            if (Math.random() < 0.35 * (1 - cand)) s.emit("leaf", 1, [rnd(-100, W + 100), -30]);
            if (Math.random() < 0.12 * cand) s.emit("candy", 1, [rnd(0, W), -30]);
            // the camera: close on the stop, back for the ride, in on the station at the end
            const open = seg(t, 0.3, 1.6), end = seg(t, 4.8, 6.2);
            s.cam(lerp(lerp(560, 800, open), 1000, end), lerp(lerp(600, 470, open), 560, end), lerp(lerp(1.3, 1.02, open), 1.18, end), 0);
        }
    };

    // ---- Coral Reef: down the candy cane, splash, and sink to the sea floor ----
    S.ocean = {
        T: 7.4,
        build: (D, R) => {
            let b = `<rect data-k="air" x="-100" y="-100" width="${W + 200}" height="700" fill="${D.lin("air", [[0, "#ffc2e3"], [1, "#fff1c9"]])}"/>`;
            let sea = `<rect x="-100" y="560" width="${W + 200}" height="2100" fill="${D.lin("water", [[0, "#3aa0e6"], [0.35, "#1d6fb5"], [1, "#062a52"]])}"/>`;
            sea += `<g data-k="urays">${[0, 1, 2, 3, 4, 5].map(i => `<path d="M${200 + i * 240} 560 L${80 + i * 260} 1700 L${200 + i * 260} 1700Z" fill="#bfe8ff" opacity=".12"/>`).join("")}</g>`;
            sea += `<path d="M-100 560 ${Array.from({ length: 40 }, (_, i) => `Q${i * 48 + 24 - 100} ${546 + (i % 2) * 28} ${i * 48 - 52} 560`).join(" ")}" fill="none" stroke="#e8f7ff" stroke-width="9"/>`;
            // kelp, coral, rocks, sand, a chest, shells
            sea += Array.from({ length: 9 }, (_, i) => { const x = 60 + i * 190 + R() * 60, h = 360 + R() * 260; return `<g transform="translate(${f(x)} 1560)"><g data-k="kelp${i}"><path d="M0 0 Q-30 ${-h * 0.33} 0 ${-h * 0.66} Q24 ${-h * 0.85} 0 ${-h}" fill="none" stroke="${INK}" stroke-width="16" stroke-linecap="round"/><path d="M0 0 Q-30 ${-h * 0.33} 0 ${-h * 0.66} Q24 ${-h * 0.85} 0 ${-h}" fill="none" stroke="#3fae4a" stroke-width="9" stroke-linecap="round"/>` +
                Array.from({ length: 5 }, (_, j) => `<path d="M${(j % 2 ? 4 : -4)} ${f(-h * (0.2 + j * 0.15))} q${j % 2 ? 40 : -40} -20 ${j % 2 ? 50 : -50} 10 q${j % 2 ? -26 : 26} 6 ${j % 2 ? -50 : 50} -10Z" fill="#5fc35a" ${st(3)}/>`).join("") + `</g></g>`; }).join("");
            sea += `<path d="M-100 1500 Q300 1460 700 1500 Q1100 1540 1700 1490 L1700 2700 L-100 2700Z" fill="#e8d29a" ${st(5)}/><path d="M-100 1540 Q400 1510 800 1540 Q1200 1570 1700 1530" fill="none" stroke="#cdb57a" stroke-width="5"/>`;
            sea += `<g transform="translate(260 1510)"><path d="M-80 0 Q-80 -110 0 -110 Q80 -110 80 0Z" fill="#ff7f98" ${st(5)}/>${Array.from({ length: 6 }, (_, j) => `<path d="M${-60 + j * 22} -10 Q${-50 + j * 22} -60 ${-60 + j * 22} -96" fill="none" stroke="#e05a78" stroke-width="3"/>`).join("")}</g>`;
            sea += `<g transform="translate(1360 1520)">${[-50, -20, 10, 40].map((dx, j) => `<rect x="${dx}" y="${-80 - j * 30}" width="24" height="${80 + j * 30}" rx="12" fill="#c49bff" ${st(4)}/><ellipse cx="${dx + 12}" cy="${-80 - j * 30}" rx="9" ry="4" fill="#7a4fd6"/>`).join("")}</g>`;
            sea += `<g transform="translate(1100 1510)"><path d="M0 0 V-60 M0 -40 Q-50 -70 -60 -130 M0 -50 Q40 -90 70 -140 M-30 -78 Q-70 -90 -90 -120 M34 -86 Q70 -96 96 -110" fill="none" stroke="${INK}" stroke-width="14" stroke-linecap="round"/><path d="M0 0 V-60 M0 -40 Q-50 -70 -60 -130 M0 -50 Q40 -90 70 -140 M-30 -78 Q-70 -90 -90 -120 M34 -86 Q70 -96 96 -110" fill="none" stroke="#ffb84d" stroke-width="7" stroke-linecap="round"/></g>`;
            sea += `<g transform="translate(560 1530)"><rect x="-70" y="-60" width="140" height="70" rx="8" fill="#8a5a3c" ${st(5)}/><path d="M-74 -60 Q0 -110 74 -60Z" fill="#7a4a2c" ${st(5)}/><rect x="-10" y="-60" width="20" height="26" fill="#ffd23f" ${st(3)}/><path d="M-70 -30 H70" stroke="#ffd23f" stroke-width="6"/><circle cx="40" cy="-70" r="8" fill="#ffd23f" opacity=".8"/></g>`;
            sea += [[420, 1570, "#ff8a5c"], [940, 1590, "#ffd23f"], [1240, 1580, "#ff7f98"]].map(([x, y, c]) => `<path d="${star5(x, y, 22, 9)}" fill="${c}" ${st(3)}/>`).join("");
            sea += `<g data-k="fish0">${Array.from({ length: 9 }, (_, j) => `<g transform="translate(${(j % 3) * 50 + (j > 5 ? 30 : 0)} ${Math.floor(j / 3) * 34})"><path d="M0 0 Q20 -14 40 0 Q20 14 0 0Z M40 0 L54 -10 L54 10Z" fill="#ffd23f" ${st(2.5)}/><circle cx="8" cy="-2" r="2.5" fill="${INK}"/></g>`).join("")}</g>`;
            sea += `<g data-k="fish1">${Array.from({ length: 7 }, (_, j) => `<g transform="translate(${(j % 4) * 46} ${Math.floor(j / 4) * 30 + (j % 2) * 10})"><path d="M0 0 Q20 -12 40 0 Q20 12 0 0Z M40 0 L52 -9 L52 9Z" fill="#5ff2ff" ${st(2.5)}/><circle cx="8" cy="-2" r="2.5" fill="${INK}"/></g>`).join("")}</g>`;
            sea += `<g data-k="turtle"><ellipse cx="0" cy="0" rx="70" ry="42" fill="#5fae5a" ${st(5)}/><path d="M-40 -20 L-10 -36 L30 -30 L50 -6 L30 24 L-20 28 L-46 6Z" fill="#3f8a3c" ${st(3)}/><circle cx="84" cy="-6" r="22" fill="#9fdc8a" ${st(4)}/><circle cx="92" cy="-12" r="4" fill="${INK}"/>` +
                `<g data-k="flip"><path d="M10 30 Q30 70 0 80 Q-10 50 -10 30Z M10 -34 Q40 -80 10 -84 Q-6 -60 -6 -34Z" fill="#9fdc8a" ${st(4)}/></g></g>`;
            sea += [0, 1].map(i => `<g data-k="jelly${i}"><path d="M-40 0 Q-40 -50 0 -50 Q40 -50 40 0 Q20 -8 0 0 Q-20 -8 -40 0Z" fill="#ffb3e6" fill-opacity=".75" ${st(4)}/><path d="M-26 0 q6 30 -4 60 M-8 0 q-6 30 4 70 M10 0 q6 30 -4 64 M26 0 q-6 30 4 56" fill="none" stroke="#ff7fd1" stroke-width="4" stroke-linecap="round"/><circle cx="-14" cy="-30" r="8" fill="#fff" opacity=".5"/></g>`).join("");
            b += `<g data-k="sea">${sea}</g>`;
            b += `<g data-k="cane"><path d="M300 -40 Q300 -140 390 -140 Q480 -140 480 -40 L480 600" fill="none" stroke="${INK}" stroke-width="48" stroke-linecap="round"/><path d="M300 -40 Q300 -140 390 -140 Q480 -140 480 -40 L480 600" fill="none" stroke="#fff" stroke-width="36" stroke-linecap="round"/>` +
                `<path d="M480 -40 V600" stroke="#ff5c7a" stroke-width="36" stroke-dasharray="28 28"/><path d="M472 -40 V600" stroke="#fff" stroke-width="5" opacity=".6"/></g>`;
            return { back: b, front: "" };
        },
        frame(t, s) {
            const sink = seg(t, 2.0, 5.4);
            s.set("sea", `translate(0 ${f(-sink * 980)})`); s.set("cane", `translate(0 ${f(-sink * 980)})`);
            s.setStyle("air", "opacity", 1 - seg(t, 2.2, 3.2));
            s.setStyle("urays", "opacity", 0.6 + Math.sin(t * 2) * 0.25);
            for (let i = 0; i < 9; i++) s.set("kelp" + i, `skewX(${f(Math.sin(t * 1.6 + i) * 8)})`);
            s.set("fish0", `translate(${f(lerp(-300, 1800, (t / 7.4)))} ${f(1200 + Math.sin(t * 2) * 20)})`);
            s.set("fish1", `translate(${f(lerp(1800, -300, (t / 6)))} ${f(1350 + Math.sin(t * 2.4) * 16)}) scale(-1 1)`);
            s.set("turtle", `translate(${f(lerp(1700, 1000, t / 7.4))} ${f(1100 + Math.sin(t) * 30)}) scale(-1 1) rotate(${f(Math.sin(t) * 5)})`);
            s.set("flip", `rotate(${f(Math.sin(t * 3) * 14)})`);
            s.set("jelly0", `translate(${f(300 + Math.sin(t * 0.7) * 40)} ${f(1050 - t * 18)}) scale(${f(1 + Math.sin(t * 4) * 0.08)} ${f(1 - Math.sin(t * 4) * 0.08)})`);
            s.set("jelly1", `translate(${f(1250 + Math.sin(t * 0.6) * 40)} ${f(1300 - t * 14)}) scale(${f(0.8 + Math.sin(t * 4 + 1) * 0.06)} ${f(0.8 - Math.sin(t * 4 + 1) * 0.06)})`);
            const slide = seg(t, 0, 1.8, k => k * k);
            if (t < 1.8) { s.hero(520, lerp(-60, 540, slide), 0.95, 0, 1, 1); }
            else {
                // it sinks while the sea floor rises to meet it (the camera dives); its feet stop on the sand
                const k = seg(t, 1.8, 2.5, out), k2 = seg(t, 2.5, 5.6), floor = 1512 - sink * 980, free = lerp(560, 620, k) + k2 * 80;
                const onFloor = free >= floor, y = Math.min(free, floor), calm = 1 - seg(t, 4.2, 5.0);
                if (onFloor && !s.once("sand")) { s.emit("sandpuff", 30, [800, y]); s.emit("bubble", 14, [800, y - 120]); s.emit("ring", 1, [800, y + 4]); }
                const since = onFloor ? t - (s.landedAt = s.landedAt || t) : 0;
                s.hero(lerp(520, 800, k) + Math.sin(t * 2) * 30 * calm, y, 1.1, onFloor ? 0 : Math.sin(t * 3) * 8 * calm, 1, 1, onFloor && since < 0.2 ? 0.9 : 1);
                s.shadow(800, floor + 4, 1.1, onFloor ? 0.22 : clamp(1 - (floor - y) / 500) * 0.2);
                if (Math.random() < 0.25) s.emit("bubble", 1, [lerp(520, 800, k) + 20, y - 200]);
            }
            if (t > 1.8 && !s.once("splash")) { s.emit("drop", 70, [520, 560]); s.emit("ring", 2, [520, 562]); s.shake(10); s.flash("#fff", 0.35); }
            if (t > 2.0 && Math.random() < 0.5) s.emit("bubble", 1, [rnd(0, W), H + 30]);
            s.tint("#04203f", seg(t, 2.2, 5.0) * 0.28);
            s.cam(lerp(560, 800, seg(t, 1.6, 3.2)), lerp(380, 450, seg(t, 1.6, 3.2)), lerp(1.25, 1.05, seg(t, 1.6, 4.0)), 0);
        }
    };

    // ---- Snow Day: up from the reef in a bubble, out onto the ice under the aurora ----
    S.snow = {
        T: 7.2,
        build: (D, R) => {
            // the world is 1800 tall: the ice and sky on top (0-900), the water below (720-1800); the camera rises
            let w = `<rect x="-100" y="-100" width="${W + 200}" height="1100" fill="${D.lin("night", [[0, "#151f4a"], [0.6, "#3a4f94"], [1, "#9fb2e6"]])}"/>`;
            for (let i = 0; i < 70; i++) w += `<circle cx="${f(R() * W)}" cy="${f(R() * 420)}" r="${f(1 + R() * 2.2)}" fill="#fff" opacity="${f(0.4 + R() * 0.6)}"/>`;
            w += `<g data-k="aur">${[["#5fffb0", 0], ["#7ad7ff", 40], ["#c49bff", 80]].map(([c, dy], i) => `<path data-k="au${i}" d="M-100 ${160 + dy} Q300 ${60 + dy} 700 ${180 + dy} T1700 ${140 + dy} L1700 ${300 + dy} Q1200 ${260 + dy} 700 ${330 + dy} T-100 ${300 + dy}Z" fill="${D.lin("au" + i, [[0, c, 0.55], [1, c, 0]])}" opacity=".7"/>`).join("")}</g>`;
            w += `<circle cx="1320" cy="150" r="56" fill="#f4f6ff" ${st(4)}/><circle cx="1300" cy="140" r="10" fill="#d6dcef"/><circle cx="1336" cy="168" r="7" fill="#d6dcef"/>` + glow(D, "moon", 1320, 150, 170, "#dfe8ff", 0.45);
            w += [[200, 620, 420, "#c9d6f2"], [700, 600, 520, "#dfe7f8"], [1300, 610, 460, "#c9d6f2"]].map(([x, y, wd, c]) => `<path d="M${x - wd} ${y + 120} L${x - wd * 0.2} ${y - 220} L${x} ${y - 180} L${x + wd * 0.25} ${y - 260} L${x + wd} ${y + 120}Z" fill="${c}" ${st(5)}/><path d="M${x + wd * 0.25} ${y - 260} L${x + wd} ${y + 120} L${x + wd * 0.4} ${y + 120} L${x + wd * 0.1} ${y - 120}Z" fill="#a9b8de" opacity=".6"/><path d="M${x - wd * 0.2} ${y - 220} L${x - wd * 0.08} ${y - 150} L${x} ${y - 180} L${x + wd * 0.12} ${y - 140} L${x + wd * 0.25} ${y - 260}" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round"/>`).join("");
            w += [80, 190, 300, 1380, 1480].map((x, i) => pine(x, 700, 0.9 + (i % 2) * 0.25, "#2f6d4a", true)).join("");
            // the sea and the ice floes
            w += `<rect x="-100" y="720" width="${W + 200}" height="1200" fill="${D.lin("sea", [[0, "#2a6fb8"], [0.3, "#1c5596"], [1, "#0a2a5c"]])}"/>`;
            w += `<g data-k="urays">${[0, 1, 2, 3, 4].map(i => `<path d="M${260 + i * 290} 730 L${120 + i * 300} 1800 L${240 + i * 300} 1800Z" fill="#cfeaff" opacity=".1"/>`).join("")}</g>`;
            w += `<path d="M-100 1760 Q400 1700 800 1740 Q1200 1780 1700 1720 L1700 1900 L-100 1900Z" fill="#e8d29a" ${st(5)}/>${[[300, 1730, "#ff7f98"], [1250, 1730, "#c49bff"]].map(([x, y, c]) => `<path d="M${x - 50} ${y} Q${x - 50} ${y - 70} ${x} ${y - 70} Q${x + 50} ${y - 70} ${x + 50} ${y}Z" fill="${c}" ${st(5)}/>`).join("")}`;
            w += [[-60, 640, 760], [980, 720, 900]].map(([x, wd, k], i) => `<path d="M${x} 728 L${x + 20} 700 H${x + wd - 20} L${x + wd} 728 L${x + wd - 30} ${k > 800 ? 800 : 790} H${x + 30}Z" fill="#f4faff" ${st(5)}/><path d="M${x + 20} 700 H${x + wd - 20}" stroke="#fff" stroke-width="8"/><path d="M${x + 40} 740 H${x + wd - 40}" stroke="#bfe0ff" stroke-width="5"/>`).join("");
            w += `<path d="M560 728 L580 704 H1040 L1060 728 L1030 772 H590Z" fill="#f4faff" ${st(5)}/><path d="M620 716 L700 728 L760 714 M880 720 L960 730" stroke="#bfe0ff" stroke-width="3" fill="none"/>`;
            // the igloo, penguins, icicles
            w += `<g transform="translate(1250 704)"><path d="M-110 0 A110 100 0 0 1 110 0Z" fill="#f4faff" ${st(5)}/>${[-70, -24, 24, 70].map(y => "").join("")}<path d="M-100 -30 H100 M-80 -60 H80 M-50 -84 H50 M-60 0 V-30 M0 0 V-30 M60 0 V-30 M-30 -30 V-60 M30 -30 V-60 M0 -60 V-84" stroke="#bfd6f0" stroke-width="3"/>` +
                `<path d="M-40 0 V-30 A40 40 0 0 1 40 -30 V0Z" fill="#ffb84d" ${st(4)}/><path d="M-30 0 V-26 A30 30 0 0 1 30 -26 V0Z" fill="#ffe08a"/></g>` + glow(D, "igloo", 1250, 690, 90, "#ffd27a", 0.5);
            w += [0, 1, 2].map(i => `<g transform="translate(${180 + i * 90} 706)"><g data-k="pg${i}"><ellipse cx="0" cy="-34" rx="24" ry="34" fill="#2b2233" ${st(3)}/><ellipse cx="0" cy="-28" rx="15" ry="26" fill="#fff"/><circle cx="-6" cy="-52" r="3" fill="#fff"/><circle cx="6" cy="-52" r="3" fill="#fff"/><path d="M-6 -44 L0 -38 L6 -44Z" fill="#ffb21e"/><path d="M-12 0 h10 M2 0 h10" stroke="#ffb21e" stroke-width="5" stroke-linecap="round"/></g></g>`).join("");
            const bubble = `<g data-k="bubble"><circle r="150" fill="${D.rad("bub", [[0, "#ffffff", 0.05], [0.8, "#cfefff", 0.18], [0.95, "#ffd6fa", 0.5], [1, "#a0e7ff", 0.7]])}" stroke="#eaf8ff" stroke-width="6"/><ellipse cx="-60" cy="-70" rx="40" ry="20" fill="#fff" opacity=".55" transform="rotate(-35 -60 -70)"/><circle cx="70" cy="80" r="10" fill="#fff" opacity=".4"/></g>`;
            return { back: `<g data-k="world">${w}</g>`, front: bubble };
        },
        frame(t, s) {
            const rise = seg(t, 0, 3.0);
            const camY = lerp(1350, 450, seg(t, 0.2, 3.2));
            for (let i = 0; i < 3; i++) s.set("au" + i, `translate(${f(Math.sin(t * 0.6 + i) * 60)} ${f(Math.sin(t * 0.9 + i * 2) * 14)})`);
            s.setStyle("urays", "opacity", 0.7 + Math.sin(t * 2) * 0.2);
            for (let i = 0; i < 3; i++) s.set("pg" + i, `rotate(${f(Math.sin(t * 6 + i) * 8)})`);
            const by = lerp(1600, 640, rise) + Math.sin(t * 3) * 10, bx = 800 + Math.sin(t * 2) * 40;
            const pop = t > 3.0;
            s.set("bubble", `translate(${f(bx)} ${f(by)}) scale(${f(pop ? 1 + seg(t, 3.0, 3.15) * 0.35 : 1 + Math.sin(t * 5) * 0.02)})`);
            s.setStyle("bubble", "opacity", pop ? 1 - seg(t, 3.0, 3.15) : 1);
            if (!pop) { s.hero(bx, by + 110, 1, Math.sin(t * 2) * 6, 1, 1); if (Math.random() < 0.4) s.emit("bubble", 1, [bx + rnd(-140, 140), by + 140]); }
            else {
                const j = seg(t, 3.0, 3.8), up = Math.sin(j * Math.PI);
                s.hero(lerp(bx, 800, j), lerp(by + 110, 712, j) - up * 180, 1.15, 0, 1, 1, j >= 1 && t < 4.0 ? 0.86 : 1);
                s.shadow(lerp(bx, 800, j), 714, 1.15 - up * 0.4, 0.2 * j);
            }
            if (pop && !s.once("pop")) { s.emit("bubble", 30, [bx, by]); s.emit("ring", 1, [bx, by]); s.flash("#e8f6ff", 0.4); }
            if (t > 3.8 && !s.once("land")) { s.emit("snowpuff", 26, [800, 712]); s.shake(6); }
            if (t > 2.6 && Math.random() < 0.9) s.emit("snow", 2, [rnd(-100, W + 100), camY - 470]);
            s.cam(800, camY, lerp(1.1, 1.02, seg(t, 2.8, 4.4)), 0);
        }
    };

    // ---- Rainy City: down the river on an ice floe (the user, 2026-10-14: "change the ... to the city animation"). The
    //      hero floats down a river at night on a melting ice floe: snowy banks, pines and a snowman give way to a stone
    //      embankment and the lights of the city, the snow turns to rain, the floe slides under a lamp-lit stone bridge
    //      past neon reflections and bumps a wooden dock; the hero jumps off with a splash and opens the umbrella ----
    S.rain = {
        T: 7.8,
        build: (D, R) => {
            const WATER = 800;
            // the skies: a snowy night with stars and the moon, then the city's low, rainy, lamp-lit clouds
            let b = `<rect x="-100" y="-100" width="${W + 200}" height="${H + 200}" fill="${D.lin("skyA", [[0, "#1d2b5c"], [1, "#7d8fc9"]])}"/>`;
            for (let i = 0; i < 60; i++) b += `<circle cx="${f(R() * W)}" cy="${f(R() * 380)}" r="${f(1 + R() * 2)}" fill="#fff" opacity="${f(0.4 + R() * 0.6)}"/>`;
            b += `<circle cx="1250" cy="150" r="50" fill="#f4f6ff" ${st(4)}/><circle cx="1234" cy="140" r="9" fill="#d6dcef"/>` + glow(D, "moon", 1250, 150, 160, "#dfe8ff", 0.45);
            b += `<g data-k="skyB" opacity="0"><rect x="-100" y="-100" width="${W + 200}" height="${H + 200}" fill="${D.lin("skyB", [[0, "#1c2236"], [0.6, "#3b4560"], [1, "#6a5a6e"]])}"/>` + glow(D, "cityglow", 800, 700, 760, "#ff9a5a", 0.3) +
                `<g data-k="clouds">${Array.from({ length: 6 }, (_, i) => cloud(i * 330 - 60, 90 + (i % 2) * 50, 1.3, "#4a5470", "#3a4258")).join("")}</g></g>`;
            b += `<path data-k="bolt" d="M1180 -20 L1140 120 L1180 120 L1120 300 L1200 150 L1160 150 L1210 -20Z" fill="#fff8c0" stroke="#fff" stroke-width="4" opacity="0"/>`;
            // far (a fifth as fast): snowy mountains and pines, or the city skyline with blinking antennas
            let farA = [[200, 560, 420], [760, 520, 520], [1360, 560, 460], [1900, 540, 480]].map(([x, y, wd], i) => `<path d="M${x - wd} ${y + 180} L${f(x - wd * 0.2)} ${y - 200} L${x} ${y - 160} L${f(x + wd * 0.25)} ${y - 240} L${x + wd} ${y + 180}Z" fill="${["#c9d6f2", "#dfe7f8"][i % 2]}" ${st(5)}/><path d="M${f(x - wd * 0.2)} ${y - 200} L${f(x - wd * 0.08)} ${y - 130} L${x} ${y - 160} L${f(x + wd * 0.12)} ${y - 120} L${f(x + wd * 0.25)} ${y - 240}" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round"/>`).join("") +
                Array.from({ length: 16 }, (_, i) => pine(i * 150 - 40 + R() * 40, 700, 0.55 + R() * 0.2, "#2f5d48", true)).join("");
            let farB = Array.from({ length: 16 }, (_, i) => { const x = i * 150 - 80, h = 200 + R() * 260, wd = 110 + R() * 50; let g = `<rect x="${f(x)}" y="${f(720 - h)}" width="${f(wd)}" height="${f(h + 40)}" fill="${["#252c40", "#2c3349", "#20263a"][i % 3]}" ${st(4)}/>`; for (let j = 0; j < 7; j++) if (R() < 0.6) g += `<rect x="${f(x + 12 + R() * (wd - 30))}" y="${f(730 - h + 20 + R() * (h - 60))}" width="10" height="14" fill="#ffd56b" opacity=".85"/>`; if (i % 4 === 1) g += `<path d="M${f(x + wd / 2)} ${f(720 - h)} V${f(650 - h)}" ${st(3)}/><circle data-k="ant${i}" cx="${f(x + wd / 2)}" cy="${f(648 - h)}" r="6" fill="#ff4d4d"/>`; return g; }).join("");
            b += `<g data-k="farA">${farA}</g><g data-k="farB" opacity="0">${farB}</g>`;
            // the middle distance (half as fast): the snowy far bank with pines, a snowman and a cabin, or tall buildings on the far embankment
            let midA = `<path d="M-200 ${WATER - 6} Q400 ${WATER - 70} 1000 ${WATER - 40} T3400 ${WATER - 30} V${WATER + 4} H-200Z" fill="#f4faff" ${st(5)}/>` + Array.from({ length: 14 }, (_, i) => pine(i * 230 + R() * 60, WATER - 40, 0.8 + R() * 0.3, "#2f6d4a", true)).join("") +
                `<g transform="translate(900 ${WATER - 44})"><circle cy="-34" r="34" fill="#fff" ${st(4)}/><circle cy="-92" r="26" fill="#fff" ${st(4)}/><circle cx="-8" cy="-98" r="3" fill="${INK}"/><circle cx="8" cy="-98" r="3" fill="${INK}"/><path d="M0 -90 l18 4 l-18 4Z" fill="#ff8a3a"/><path d="M-24 -66 Q0 -58 24 -66" stroke="#e5484d" stroke-width="10" stroke-linecap="round" fill="none"/><path d="M-30 -40 l-30 -20 M30 -40 l30 -24" ${st(4)}/></g>` +
                `<g transform="translate(1700 ${WATER - 40})"><rect x="-80" y="-110" width="160" height="110" fill="#8a5a3c" ${st(5)}/><path d="M-100 -110 L0 -180 L100 -110Z" fill="#fff" ${st(5)}/><rect x="-26" y="-80" width="52" height="40" rx="4" fill="#ffd56b" ${st(3)}/>${glow(D, "cabin", 0, -60, 80, "#ffd27a", 0.45)}<path d="M50 -150 V-196 H70 V-136" fill="#6b4226" ${st(4)}/></g>`;
            let midB = Array.from({ length: 13 }, (_, i) => building(i * 250 - 60 + R() * 30, 200 + R() * 40, 260 + R() * 220, ["#3a4459", "#2f374a", "#465170", "#343d52"][i % 4], ["#ffd56b", "#ffe9a8"][i % 2], R, i % 4, WATER - 20)).join("") +
                `<rect x="-200" y="${WATER - 30}" width="3600" height="34" fill="#5a6070" ${st(4)}/>`;
            b += `<g data-k="midA">${midA}</g><g data-k="midB" opacity="0">${midB}</g>`;
            // ---- the river and everything on it (full speed) ----
            let w = `<rect x="-300" y="${WATER}" width="5400" height="${H + 300 - WATER}" fill="${D.lin("water", [[0, "#2a4a78"], [1, "#0c1a33"]])}" ${st(5)}/>`;
            w += `<g data-k="sheen">${Array.from({ length: 70 }, () => { const x = -300 + R() * 5400, y = WATER + 14 + R() * 90; return `<path d="M${f(x)} ${f(y)} h${f(30 + R() * 60)}" stroke="#9fb9e8" stroke-width="3" stroke-linecap="round" opacity="${f(0.2 + R() * 0.35)}"/>`; }).join("")}</g>`;
            // the near bank: snow first, then the stone embankment wall with arches and lamps
            w += `<path d="M-300 ${H - 20} Q300 ${H - 50} 900 ${H - 30} Q1300 ${H - 20} 1500 ${H - 40} L1500 ${H + 300} L-300 ${H + 300}Z" fill="#f4faff" ${st(5)}/>`;
            w += `<rect x="1460" y="${H - 16}" width="3700" height="400" fill="#6a6f80" ${st(5)}/>${Array.from({ length: 40 }, (_, i) => `<path d="M${1460 + i * 92} ${H - 16} V${H + 40}" stroke="#555a6a" stroke-width="3"/>`).join("")}<rect x="1460" y="${H - 28}" width="3700" height="14" fill="#8a8f9e" ${st(4)}/>`;
            // reflections of lights in the water (the lamps on the far embankment, the neon signs)
            w += [[1900, "#ffe9a8"], [2300, "#ff6fb5"], [2700, "#ffe9a8"], [3100, "#5ff2ff"], [3450, "#ffe9a8"], [4100, "#ffe9a8"]].map(([x, c], i) => `<rect data-k="refl${i}" x="${x - 22}" y="${WATER + 6}" width="44" height="80" fill="${D.lin("rf" + i, [[0, c, 0.5], [1, c, 0]])}"/>`).join("");
            // the far embankment's lamps and neon signs (on the world layer, so they line up with their reflections)
            w += [1900, 2700, 3450].map((x, i) => `<rect x="${x - 4}" y="${WATER - 160}" width="8" height="150" fill="#2b2233"/><path d="M${x - 20} ${WATER - 160} H${x + 20} L${x + 12} ${WATER - 176} H${x - 12}Z" fill="#3a4459" ${st(3)}/><circle cx="${x}" cy="${WATER - 154}" r="7" fill="#fff6c2"/>${glow(D, "fl" + i, x, WATER - 154, 50, "#ffe9a8", 0.6)}`).join("");
            const neon = (x, y, d, c, k) => `<g data-k="${k}" transform="translate(${x} ${y})"><path d="${d}" fill="none" stroke="${c}" stroke-width="16" opacity=".25" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/></g>`;
            w += neon(2300, WATER - 120, "M-30 -20 H24 V10 Q24 30 -3 30 Q-30 30 -30 10Z M24 -10 Q44 -10 40 6 Q36 16 24 14 M-14 -34 q6 -8 0 -16 M4 -34 q6 -8 0 -16", "#ff6fb5", "neon0");
            w += neon(3100, WATER - 120, "M-44 10 Q0 -50 44 10 Q22 0 0 10 Q-22 0 -44 10Z M0 10 V44 q0 10 -10 10", "#5ff2ff", "neon1");
            // a paper boat drifting along beside the hero
            w += `<g data-k="boat"><path d="M-40 0 L40 0 L28 16 H-28Z" fill="#fffdf6" ${st(3)}/><path d="M-20 0 L0 -40 L20 0Z" fill="#f4efe2" ${st(3)}/><path d="M-34 6 H30" stroke="#a9c1ec" stroke-width="2"/></g>`;
            // the dock: wooden boards on posts, a bench, a lamp with a cone of light, puddles
            w += `<g transform="translate(3760 0)"><rect x="0" y="${WATER - 46}" width="1000" height="22" fill="#8a5a3c" ${st(5)}/>${Array.from({ length: 12 }, (_, i) => `<path d="M${i * 84} ${WATER - 46} V${WATER - 24}" stroke="#6b4226" stroke-width="3"/>`).join("")}` +
                [10, 260, 520, 780].map(x => `<rect x="${x}" y="${WATER - 24}" width="22" height="200" fill="#6b4226" ${st(4)}/>`).join("") +
                `<ellipse cx="250" cy="${WATER - 40}" rx="70" ry="6" fill="#3a4a6e" opacity=".8"/><ellipse cx="560" cy="${WATER - 40}" rx="50" ry="5" fill="#3a4a6e" opacity=".8"/>` +
                `<path d="M210 ${WATER - 46} L270 ${WATER - 290} H290 L350 ${WATER - 46}Z" fill="${D.lin("cone", [[0, "#ffe9a8", 0.35], [1, "#ffe9a8", 0]])}"/><rect x="276" y="${WATER - 300}" width="8" height="256" fill="#2b2233"/><path d="M256 ${WATER - 300} H304 L294 ${WATER - 320} H266Z" fill="#3a4459" ${st(4)}/><circle cx="280" cy="${WATER - 294}" r="9" fill="#fff6c2"/>${glow(D, "dlamp", 280, WATER - 294, 70, "#ffe9a8", 0.6)}` +
                `<g transform="translate(560 ${WATER - 46})"><rect x="-70" y="-46" width="140" height="10" rx="4" fill="#4a7ad6" ${st(3)}/><rect x="-70" y="-26" width="140" height="10" rx="4" fill="#4a7ad6" ${st(3)}/><path d="M-60 0 V-46 M60 0 V-46" ${st(5)}/></g></g>`;
            b += `<g data-k="wB">${w}</g>`;
            // ---- in front: the stone bridge the floe slides under, reeds on the snowy bank ----
            let fr = `<g transform="translate(2150 0)"><path d="M-240 500 H240 V${H + 200} H120 V${WATER + 10} A120 230 0 0 0 -120 ${WATER + 10} V${H + 200} H-240Z" fill="${D.lin("stone", [[0, "#8a8f9e"], [1, "#5a5f6e"]])}" fill-rule="evenodd" ${st(6)}/>`;
            for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) { const x = -230 + c * 80 + (r % 2) * 40, y = 520 + r * 50; if (Math.abs(x + 20) < 130 && y > WATER - 220) continue; fr += `<rect x="${x}" y="${y}" width="76" height="46" rx="4" fill="none" stroke="#4e5260" stroke-width="2.5" opacity=".6"/>`; }
            fr += `<path d="M-120 ${WATER + 10} A120 230 0 0 1 120 ${WATER + 10}" fill="none" stroke="#3e4250" stroke-width="10"/><rect x="-260" y="470" width="520" height="34" rx="6" fill="#9aa0b0" ${st(5)}/>` +
                [-200, 200].map((x, i) => `<rect x="${x - 5}" y="350" width="10" height="122" fill="#2b2233"/><path d="M${x - 22} 350 H${x + 22} L${x + 14} 330 H${x - 14}Z" fill="#3a4459" ${st(3)}/><circle cx="${x}" cy="358" r="8" fill="#fff6c2"/>${glow(D, "blamp" + i, x, 358, 60, "#ffe9a8", 0.6)}`).join("") + `</g>`;
            fr += Array.from({ length: 10 }, (_, i) => `<path d="M${i * 150 - 100} ${H + 4} q-6 -60 -2 -110 M${i * 150 - 90} ${H + 4} q4 -50 14 -90 M${i * 150 - 80} ${H + 4} q10 -44 26 -66" fill="none" stroke="#5a6b4a" stroke-width="5" stroke-linecap="round"/><ellipse cx="${i * 150 - 102}" cy="${H - 108}" rx="6" ry="16" fill="#7a5a3a" ${st(2)}/>`).join("");
            // ---- the ice floe (under the hero), in two halves that split when it hits the dock ----
            const floe = `<g data-k="floe"><g data-k="floeL"><path d="M-160 0 L-150 -18 L-60 -26 L0 -22 L0 20 L-60 26 L-140 18Z" fill="${D.lin("ice", [[0, "#ffffff"], [1, "#cfe6ff"]])}" ${st(5)}/><path d="M-150 -18 L-60 -26 L0 -22" fill="none" stroke="#fff" stroke-width="6"/><path d="M-140 18 L-60 26 L0 20 L0 30 L-60 34 L-130 26Z" fill="#7fb6ea" ${st(4)}/><path d="M-110 -14 l20 14 l16 -6" stroke="#a8d0f5" stroke-width="3" fill="none"/></g>` +
                `<g data-k="floeR"><path d="M0 -22 L70 -24 L150 -14 L166 0 L150 16 L70 22 L0 20Z" fill="${D.lin("ice2", [[0, "#ffffff"], [1, "#cfe6ff"]])}" ${st(5)}/><path d="M0 -22 L70 -24 L150 -14" fill="none" stroke="#fff" stroke-width="6"/><path d="M0 20 L70 22 L150 16 L144 26 L70 32 L0 30Z" fill="#7fb6ea" ${st(4)}/><ellipse cx="96" cy="-24" rx="26" ry="10" fill="#fff" ${st(3)}/></g></g>`;
            const umb = `<g data-k="umb" opacity="0"><path d="M0 0 V160 q0 26 -24 26" fill="none" ${st(8)}/><g data-k="ucan"><path d="M-160 0 Q0 -160 160 0 Q120 -22 80 0 Q40 -22 0 0 Q-40 -22 -80 0 Q-120 -22 -160 0Z" fill="#ffd23f" ${st(6)}/>` +
                `<path d="M-80 0 Q-60 -110 0 -116 M80 0 Q60 -110 0 -116" fill="none" stroke="#e8a81f" stroke-width="4"/><path d="M-120 -40 Q-70 -110 -10 -112" fill="none" stroke="#fff" stroke-width="5" opacity=".5"/><path d="M0 -116 V-136" ${st(6)}/></g></g>`;
            return { back: b, under: floe, front: `<g data-k="wF">${fr}</g>` + umb };
        },
        frame(t, s) {
            const WATER = 800;
            const k0 = seg(t, 0.2, 4.8, k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2), sc = k0 * 2900;
            s.set("wB", `translate(${f(-sc)} 0)`); s.set("wF", `translate(${f(-sc)} 0)`);
            s.set("farA", `translate(${f(-sc * 0.2)} 0)`); s.set("farB", `translate(${f(-sc * 0.2)} 0)`);
            s.set("midA", `translate(${f(-sc * 0.5)} 0)`); s.set("midB", `translate(${f(-sc * 0.5)} 0)`);
            const city = seg(sc, 700, 1700);                              // from snow to the city
            s.setStyle("skyB", "opacity", city); s.setStyle("farB", "opacity", city); s.setStyle("midB", "opacity", city);
            s.setStyle("farA", "opacity", 1 - city); s.setStyle("midA", "opacity", 1 - city);
            s.set("clouds", `translate(${f(-t * 18)} 0)`);
            s.set("sheen", `translate(${f(Math.sin(t * 1.5) * 20)} 0)`);
            for (let i = 0; i < 2; i++) s.setStyle("neon" + i, "opacity", 0.75 + 0.25 * Math.sin(t * (9 + i * 3)) * (Math.sin(t * 2.3 + i) > 0.9 ? 1 : 0.3));
            for (let i = 0; i < 6; i++) s.set("refl" + i, `skewX(${f(Math.sin(t * 3 + i) * 8)})`);
            for (let i = 1; i < 16; i += 4) s.setStyle("ant" + i, "opacity", Math.sin(t * 3 + i) > 0 ? 1 : 0.2);
            // the paper boat bobs along a little slower than the floe
            const bx = 1300 + sc * 0.55;
            s.set("boat", `translate(${f(bx)} ${f(WATER + 4 + Math.sin(t * 2.6) * 5)}) rotate(${f(Math.sin(t * 2) * 6)})`);
            // the floe: bobbing, turning a little, melting in the rain
            const fx = 700 + Math.sin(t * 1.1) * 18, fy = WATER + 4 + Math.sin(t * 2.2) * 5, rot = Math.sin(t * 1.6) * 2.5;
            const melt = 1 - 0.18 * city, split = seg(t, 5.0, 6.0, out);
            s.set("floe", `translate(${f(fx)} ${f(fy)}) rotate(${f(rot)}) scale(${f(melt)} 1)`);
            s.set("floeL", `translate(${f(-split * 70)} ${f(split * 6)}) rotate(${f(-split * 6)})`);
            s.set("floeR", `translate(${f(split * 60)} ${f(split * 10)}) rotate(${f(split * 8)})`);
            if (Math.random() < 0.25) s.emit("ripple", 1, [fx + rnd(-170, 170), WATER + 22]);
            // the hero: rides the floe, then jumps onto the dock and opens the umbrella under the lamp
            if (t < 5.0) s.hero(fx - 20, fy - 22, 1.0, rot + Math.sin(t * 3) * 3, 1, 1);
            else {
                const j = seg(t, 5.0, 5.7), up = Math.sin(j * Math.PI);
                s.hero(lerp(fx - 20, 1060, j), lerp(fy - 22, WATER - 46, j) - up * 220, 1.1, 0, 1, 1, j >= 1 && t < 5.9 ? 0.86 : 1);
                s.shadow(lerp(fx - 20, 1060, j), WATER - 44, 1.1 - up * 0.4, 0.25 * j);
                s.set("umb", `translate(1100 ${f(WATER - 240 + Math.sin(t * 3) * 4)}) rotate(-8)`);
                s.setStyle("umb", "opacity", seg(t, 5.9, 6.0));
                s.set("ucan", `scale(${f(lerp(0.15, 1, seg(t, 5.9, 6.4, back)))} ${f(lerp(0.6, 1, seg(t, 5.9, 6.4)))})`);
            }
            if (t > 4.75 && !s.once("bump")) { s.shake(9); s.emit("drop", 30, [860, WATER]); s.emit("ring", 1, [860, WATER + 6]); }
            if (t > 5.7 && !s.once("land")) { s.emit("drop", 60, [1060, WATER - 46]); s.emit("ring", 2, [1060, WATER - 40]); s.shake(7); }
            // thunder once the umbrella is up
            s.setStyle("bolt", "opacity", t > 6.5 && t < 6.8 ? 1 : 0);
            if (t > 6.5 && !s.once("thunder")) { s.flash("#eef4ff", 0.65); s.shake(5); }
            // the snow turns to rain
            const rain = seg(t, 1.8, 3.6);
            if (Math.random() < 1.2 * (1 - rain)) s.emit("wetsnow", 1, [rnd(-100, W + 100), -20]);
            if (Math.random() < rain * 3) s.emit("rain", 3, [rnd(-100, W + 200), -30]);
            if (rain > 0.3 && Math.random() < 0.5 * rain) s.emit("ripple", 1, [rnd(0, W), rnd(WATER + 14, WATER + 66)]);
            const end = seg(t, 4.6, 6.0);
            s.cam(lerp(lerp(720, 800, seg(t, 0.2, 1.4)), 900, end), lerp(560, 600, end), lerp(lerp(1.25, 1.06, seg(t, 0.2, 1.4)), 1.14, end), 0);
        }
    };

    // ---- Sky Kingdom: the wind takes the umbrella up through the clouds to the castle ----
    S.sky = {
        T: 7.4,
        build: (D, R) => {
            let b = glow(D, "sun", 1260, 200, 380, "#fffbe0", 0.9) + `<g data-k="sunrays" opacity="0" transform="translate(1260 200)">${Array.from({ length: 14 }, (_, i) => `<path d="M0 0 L${f(Math.cos(i / 14 * 6.283 - 0.07) * 900)} ${f(Math.sin(i / 14 * 6.283 - 0.07) * 900)} L${f(Math.cos(i / 14 * 6.283 + 0.07) * 900)} ${f(Math.sin(i / 14 * 6.283 + 0.07) * 900)}Z" fill="#fff8d6" opacity=".25"/>`).join("")}</g>`;
            // the castle on its clouds, a rainbow, floating islands with waterfalls (they rise into view)
            let castle = `<path d="M100 700 A700 700 0 0 1 1500 700" fill="none" stroke="#ff5c7a" stroke-width="30" opacity=".55"/><path d="M130 700 A670 670 0 0 1 1470 700" fill="none" stroke="#ffd23f" stroke-width="30" opacity=".55"/><path d="M160 700 A640 640 0 0 1 1440 700" fill="none" stroke="#5fd4c4" stroke-width="30" opacity=".55"/><path d="M190 700 A610 610 0 0 1 1410 700" fill="none" stroke="#7b8cff" stroke-width="30" opacity=".55"/>`;
            castle += [[230, 420], [1380, 380]].map(([x, y], i) => `<g transform="translate(${x} ${y})"><path d="M-120 0 H120 L60 90 L0 120 L-70 80Z" fill="#a8743e" ${st(5)}/><path d="M-120 0 H120 V-14 Q0 -30 -120 -14Z" fill="#7ccf6a" ${st(5)}/>${tree(-50, -10, 0.35, "#58b05a")}<path data-k="falls${i}" d="M80 6 V420" stroke="#bfe8ff" stroke-width="16" stroke-dasharray="20 14" opacity=".9"/></g>`).join("");
            castle += cloud(800, 820, 4.2) + `<g transform="translate(800 640)"><rect x="-170" y="-170" width="340" height="180" fill="#f4f0ff" ${st(6)}/>${[-140, -90, -40, 10, 60, 110].map(x => `<rect x="${x}" y="-196" width="30" height="28" fill="#f4f0ff" ${st(4)}/>`).join("")}` +
                [[-235, 300], [155, 300], [-60, 380]].map(([x, h], i) => `<rect x="${x}" y="${-h}" width="${i === 2 ? 120 : 80}" height="${h + 10}" fill="#e7e0ff" ${st(6)}/><path d="M${x - 14} ${-h} L${x + (i === 2 ? 60 : 40)} ${-h - 110} L${x + (i === 2 ? 134 : 94)} ${-h}Z" fill="#7b8cff" ${st(6)}/><rect x="${x + (i === 2 ? 46 : 26)}" y="${-h + 40}" width="28" height="44" rx="14" fill="#5ff2ff" ${st(3)}/>` +
                    `<g transform="translate(${x + (i === 2 ? 60 : 40)} ${-h - 110})"><path d="M0 0 V-46" ${st(4)}/><g data-k="flag${i}"><path d="M0 -46 Q24 -54 46 -44 Q24 -34 0 -26Z" fill="${["#ff5c7a", "#ffd23f", "#5fd4c4"][i]}" ${st(3)}/></g></g>`).join("") +
                `<path d="M-46 10 V-80 Q0 -130 46 -80 V10Z" fill="#7b8cff" ${st(5)}/><path d="M0 -110 V10" stroke="#5a6ad6" stroke-width="3"/></g>`;
            b += `<g data-k="castle">${castle}</g>`;
            b += `<g data-k="cl1">${Array.from({ length: 14 }, (_, i) => cloud(R() * W, 600 - i * 260 + R() * 80, 0.9 + R() * 0.9)).join("")}</g>`;
            // the rooftops it leaves
            let g = `<rect x="-100" y="680" width="${W + 200}" height="400" fill="#3a4459"/>`;
            g += [[-30, 300, 280], [300, 260, 340], [600, 300, 260], [940, 280, 320], [1250, 340, 280]].map(([x, w, h], i) => {
                const top = 900 - h;
                return `<rect x="${x}" y="${top}" width="${w}" height="${h + 20}" fill="${["#465170", "#3e4862", "#4b5677"][i % 3]}" ${st(5)}/><path d="M${x - 14} ${top} L${x + w / 2} ${top - 70} L${x + w + 14} ${top}Z" fill="#c9572a" ${st(5)}/>` +
                    `<rect x="${x + w * 0.7}" y="${top - 90}" width="34" height="80" fill="#8a5a3c" ${st(4)}/>${[0, 1].map(r => [0, 1, 2].map(c => `<rect x="${x + 30 + c * 70}" y="${top + 40 + r * 70}" width="34" height="40" rx="4" fill="${(r + c + i) % 3 ? "#ffd56b" : "#1a2030"}" ${st(2.5)}/>`).join("")).join("")}`;
            }).join("");
            b += `<g data-k="ground">${g}</g>`;
            const birds = `<g data-k="birds">${[[0, 0], [60, -30], [120, 10], [180, -40], [240, -6]].map(([x, y], i) => bird(x, y, 1.4, "bw" + i)).join("")}</g>`;
            const umb = `<g data-k="umb"><path d="M0 0 V170 q0 26 -24 26" fill="none" ${st(8)}/><path d="M-170 0 Q0 -170 170 0 Q128 -24 85 0 Q42 -24 0 0 Q-42 -24 -85 0 Q-128 -24 -170 0Z" fill="#ffd23f" ${st(6)}/>` +
                `<path d="M-85 0 Q-64 -118 0 -124 M85 0 Q64 -118 0 -124" fill="none" stroke="#e8a81f" stroke-width="4"/><path d="M-130 -44 Q-74 -118 -10 -120" fill="none" stroke="#fff" stroke-width="5" opacity=".5"/><path d="M0 -124 V-146" ${st(6)}/></g>`;
            return { back: b + birds, front: umb };
        },
        frame(t, s) {
            const up = seg(t, 0.5, 4.6);
            s.set("ground", `translate(0 ${f(up * 1000)})`);
            s.set("cl1", `translate(0 ${f(up * 3400)})`);
            s.set("castle", `translate(0 ${f(lerp(700, 0, seg(t, 3.0, 5.0, out)))})`);
            s.setStyle("sunrays", "opacity", seg(t, 3.2, 4.4) * 0.9);
            s.set("sunrays", `translate(1260 200) rotate(${f(t * 5)})`);
            for (let i = 0; i < 3; i++) s.set("flag" + i, `skewY(${f(Math.sin(t * 6 + i) * 10)})`);
            for (let i = 0; i < 2; i++) s.setStyle("falls" + i, "strokeDashoffset", -t * 120);
            s.set("birds", `translate(${f(lerp(-300, 1900, seg(t, 1.0, 5.5, k => k)))} ${f(lerp(500, 260, seg(t, 1, 5.5)))})`);
            for (let i = 0; i < 5; i++) s.set("bw" + i, `scale(1 ${f(Math.sin(t * 12 + i) * 0.9)})`);
            const sway = Math.sin(t * 2.2) * 50 * (1 - seg(t, 4.6, 5.4));
            const y = lerp(840, 500, seg(t, 0.2, 1.6)) + lerp(0, 140, seg(t, 4.6, 5.4));
            s.set("umb", `translate(${f(800 + sway + 40)} ${f(y - 214)}) rotate(${f(-8 + sway * 0.25)})`);
            s.hero(800 + sway, y, 1.05, sway * 0.18, 1, 1, t > 5.4 && t < 5.6 ? 0.9 : 1);
            s.shadow(800, 646, 1.1, seg(t, 4.8, 5.4) * 0.15);
            if (t < 0.6 && !s.once("gust")) { for (let i = 0; i < 8; i++) s.emit("wind", 1, [-80, 640 + i * 30]); }
            if (Math.random() < 0.2) s.emit("wind", 1, [-50, rnd(100, 800)]);
            if (t > 3.3 && !s.once("break")) s.flash("#ffffff", 0.6);
            if (t > 5.4 && !s.once("land")) { s.emit("cloudpuff", 24, [800, 650]); }
            s.cam(800 + sway * 0.3, 450, 1.06, sway * 0.02);
        }
    };

    // ---- Desert: a balloon ride down over dunes and pyramids ----
    S.desert = {
        T: 7.4,
        build: (D, R) => {
            let b = glow(D, "sun", 1260, 230, 340, "#fff1a8", 0.85) + `<circle cx="1260" cy="230" r="100" fill="#fff6c8"/>`;
            b += `<g data-k="vult">${[0, 1].map(i => `<g data-k="vu${i}">${bird(0, 0, 2.2, "vw" + i)}</g>`).join("")}</g>`;
            b += [[160, 560, 220, 120], [520, 540, 160, 150], [1460, 560, 200, 130]].map(([x, y, w, h]) => `<path d="M${x - w} ${y} L${x - w * 0.7} ${y - h} H${x + w * 0.7} L${x + w} ${y}Z" fill="#d98a5a" ${st(5)}/><path d="M${x - w * 0.7} ${y - h} H${x + w * 0.7} L${x + w * 0.62} ${y - h + 18} H${x - w * 0.62}Z" fill="#b8704a"/>`).join("");
            b += [[980, 560, 190], [1170, 560, 130]].map(([x, y, h]) => `<path d="M${x - h * 1.1} ${y} L${x} ${y - h} L${x + h * 1.1} ${y}Z" fill="#e8b46a" ${st(5)}/><path d="M${x} ${y - h} L${x + h * 1.1} ${y} L${x + h * 0.3} ${y}Z" fill="#c98f4a"/>${Array.from({ length: 5 }, (_, j) => `<path d="M${f(x - h * 1.1 * (j + 1) / 6)} ${f(y - h * (5 - j) / 6)} H${f(x + h * 1.1 * (j + 1) / 6)}" stroke="#b07a3a" stroke-width="2" opacity=".5"/>`).join("")}`).join("");
            b += `<g data-k="cara" transform="translate(0 590)">${[0, 1, 2].map(i => `<g transform="translate(${i * 70} 0)"><path d="M-24 0 v-22 M-14 0 v-22 M14 0 v-22 M24 0 v-22" stroke="#5a3a24" stroke-width="5"/><path d="M-30 -22 Q-20 -46 -4 -36 Q6 -54 20 -34 L28 -30 Q40 -40 44 -54 L54 -50 Q52 -30 34 -18 H-30Z" fill="#8a5a3c" ${st(3)}/></g>`).join("")}</g>`;
            b += hills(600, 36, "#f2c47a", 0.5, 2, { line: 4 }) + `<g data-k="oasis"><ellipse cx="420" cy="660" rx="150" ry="26" fill="#3aa0e6" ${st(4)}/><ellipse cx="380" cy="654" rx="60" ry="6" fill="#bfe8ff"/>${palm(340, 660, 0.7)}${palm(500, 664, 0.6, -1)}</g>`;
            b += hills(720, 32, "#e8ad5f", 2, 1.6);
            for (let i = 0; i < 9; i++) b += `<path d="M${i * 190 - 40} ${f(770 + Math.sin(i) * 12)} q60 -16 120 0" stroke="#d99a4c" stroke-width="4" fill="none"/>`;
            b += hills(830, 20, "#d99a4c", 4, 1.3, { tufts: 6 });
            b += [[220, 860], [1380, 880]].map(([x, y]) => `<g transform="translate(${x} ${y})"><rect x="-14" y="-150" width="28" height="150" rx="12" fill="#5fae5a" ${st(5)}/><path d="M-14 -80 h-30 v-40" fill="none" stroke="${INK}" stroke-width="24" stroke-linecap="round"/><path d="M-14 -80 h-30 v-40" fill="none" stroke="#5fae5a" stroke-width="14" stroke-linecap="round"/><path d="M14 -100 h26 v-30" fill="none" stroke="${INK}" stroke-width="22" stroke-linecap="round"/><path d="M14 -100 h26 v-30" fill="none" stroke="#5fae5a" stroke-width="12" stroke-linecap="round"/><path d="M0 -140 V-10 M-6 -130 V-20" stroke="#3f8a3c" stroke-width="2"/><circle cx="0" cy="-156" r="8" fill="#ff7fb0" ${st(2)}/></g>`).join("");
            const panels = ["#ff5c7a", "#ffd23f", "#ff5c7a", "#ffd23f", "#ff5c7a"];
            const balloon = `<g data-k="balloon"><path d="M-180 -300 C-180 -500 180 -500 180 -300 C180 -180 74 -96 44 -44 H-44 C-74 -96 -180 -180 -180 -300Z" fill="${panels[0]}" ${st(6)}/>` +
                panels.map((c, i) => i % 2 ? `<path d="M${-108 + i * 36 - 36} -468 C${-150 + i * 60} -360 ${-90 + i * 30} -170 ${-44 + i * 22} -44 L${-22 + i * 22} -44 C${-50 + i * 30} -170 ${-90 + i * 60} -360 ${-72 + i * 36} -470Z" fill="${c}"/>` : "").join("") +
                `<path d="M-180 -300 C-180 -500 180 -500 180 -300 C180 -180 74 -96 44 -44 H-44 C-74 -96 -180 -180 -180 -300Z" fill="none" ${st(6)}/><path d="M-120 -420 Q-150 -330 -110 -240" fill="none" stroke="#fff" stroke-width="10" opacity=".35" stroke-linecap="round"/><path d="M-176 -290 Q0 -250 176 -290" fill="none" stroke="#e8a81f" stroke-width="10"/>` +
                `<path d="M-44 -44 L-58 24 M44 -44 L58 24 M-10 -44 L-18 24 M10 -44 L18 24" ${st(3)}/><g data-k="burn"><path d="M0 -40 Q-22 -80 0 -120 Q22 -80 0 -40Z" fill="#ffb21e" stroke="#ff5a1f" stroke-width="4"/><path d="M0 -50 Q-9 -74 0 -96 Q9 -74 0 -50Z" fill="#fff3a0"/></g>` +
                `<rect x="-66" y="24" width="132" height="80" rx="12" fill="#c98a4b" ${st(6)}/>${[0, 1, 2, 3].map(j => `<path d="M-66 ${40 + j * 18} H66" stroke="#8a5a3c" stroke-width="3"/>`).join("")}${[-40, -10, 20, 50].map(x => `<path d="M${x} 24 V104" stroke="#8a5a3c" stroke-width="3"/>`).join("")}<rect x="-74" y="20" width="148" height="14" rx="6" fill="#8a5a3c" ${st(4)}/>` +
                [-80, 80].map(x => `<g transform="translate(${x} 50)"><path d="M0 -20 V0" ${st(3)}/><path d="M-10 0 Q-14 22 0 24 Q14 22 10 0Z" fill="#d6a77a" ${st(3)}/></g>`).join("") + `</g>`;
            return { back: b, under: balloon, front: "" };
        },
        frame(t, s) {
            const down = seg(t, 0, 3.8);
            const x = lerp(1120, 760, down) + Math.sin(t * 1.4) * 30, y = lerp(-180, 640, down);
            const away = seg(t, 4.4, 6.4, inn);
            s.set("balloon", `translate(${f(x + away * 200)} ${f(y - away * 1100)}) rotate(${f(Math.sin(t * 1.4) * 3)})`);
            const firing = (t > 1.2 && t < 1.8) || (t > 2.8 && t < 3.3) || t > 4.3;
            s.set("burn", `scale(${f(firing ? 1.4 + Math.sin(t * 40) * 0.2 : 0.6 + Math.sin(t * 30) * 0.1)})`);
            for (let i = 0; i < 2; i++) { const a = t * (0.9 + i * 0.3) + i * 3; s.set("vu" + i, `translate(${f(500 + i * 600 + Math.cos(a) * 140)} ${f(180 + i * 60 + Math.sin(a) * 40)})`); s.set("vw" + i, `scale(1 ${f(0.4 + Math.abs(Math.sin(t * 5 + i)) * 0.6)})`); }
            s.set("cara", `translate(${f(1700 - t * 60)} 590)`);
            if (t < 3.9) { s.hero(x, y + 98, 0.72, 0, 1, 1); }
            else {
                const j = seg(t, 3.9, 4.6), up = Math.sin(j * Math.PI);
                s.hero(lerp(x, 900, j), lerp(y + 98, 830, j) - up * 180, 1.15, 0, 1, 1, j >= 1 && t < 4.8 ? 0.86 : 1);
                s.shadow(lerp(x, 900, j), 832, 1.15 - up * 0.4, 0.25 * j);
            }
            if (t > 4.6 && !s.once("sand")) { s.emit("sandpuff", 40, [900, 830]); s.shake(7); }
            if (Math.random() < 0.35) s.emit("heat", 1, [rnd(0, W), rnd(600, 860)]);
            if (Math.random() < 0.3) s.emit("sand", 1, [-20, rnd(600, 880)]);
            s.cam(lerp(clamp(x, 600, 1000), 820, seg(t, 3.6, 5.0)), lerp(clamp(y, 260, 520), 520, seg(t, 3.6, 5.0)), lerp(1.16, 1.06, seg(t, 3.6, 5.0)), 0);
        }
    };

    // ---- Carnival: over the dunes at night into the fair ----
    S.carnival = {
        T: 7.4,
        build: (D, R) => {
            let b = "";
            for (let i = 0; i < 90; i++) b += `<circle ${i % 9 === 0 ? `data-k="tw${i / 9}"` : ""} cx="${f(R() * W)}" cy="${f(R() * 480)}" r="${f(1 + R() * 2.4)}" fill="#fff" opacity="${f(0.4 + R() * 0.6)}"/>`;
            b += glow(D, "moon", 260, 150, 160, "#fff6d6", 0.5) + `<circle cx="260" cy="150" r="54" fill="#fff8e0" ${st(4)}/><circle cx="244" cy="140" r="9" fill="#ece0b8"/><circle cx="276" cy="166" r="6" fill="#ece0b8"/>`;
            b += `<g data-k="spots">${[0, 1].map(i => `<g transform="translate(${560 + i * 520} 760)"><g data-k="sp${i}"><path d="M0 0 L-90 -900 L90 -900Z" fill="${D.lin("sb" + i, [[0, "#fff6c8", 0.45], [1, "#fff6c8", 0]], 0, 1, 0, 0)}"/></g></g>`).join("")}</g>`;
            // the Ferris wheel (its gondolas stay level)
            b += `<g transform="translate(1280 520)"><path d="M-110 300 L0 0 L110 300" fill="none" ${st(10)}/><path d="M-110 300 L0 0 L110 300" fill="none" stroke="#5a5f6e" stroke-width="5"/>` +
                `<g data-k="wheel"><circle r="230" fill="none" ${st(8)}/><circle r="230" fill="none" stroke="#ffd23f" stroke-width="3"/><circle r="200" fill="none" stroke="#9aa3b2" stroke-width="4"/>${Array.from({ length: 12 }, (_, i) => `<path d="M0 0 L${f(Math.cos(i / 12 * 6.283) * 230)} ${f(Math.sin(i / 12 * 6.283) * 230)}" stroke="#9aa3b2" stroke-width="4"/><circle cx="${f(Math.cos(i / 12 * 6.283) * 230)}" cy="${f(Math.sin(i / 12 * 6.283) * 230)}" r="6" fill="#fff3a0"/>`).join("")}<circle r="22" fill="#e5484d" ${st(4)}/></g>` +
                Array.from({ length: 8 }, (_, i) => `<g data-k="gd${i}"><path d="M0 0 V14" ${st(4)}/><path d="M-30 14 H30 V46 Q30 58 18 58 H-18 Q-30 58 -30 46Z" fill="${["#ff5c7a", "#5fd4c4", "#ffd23f", "#b48cff"][i % 4]}" ${st(4)}/><path d="M-34 14 Q0 -8 34 14Z" fill="${shade(["#ff5c7a", "#5fd4c4", "#ffd23f", "#b48cff"][i % 4], -0.25)}" ${st(3)}/></g>`).join("") + `</g>`;
            // the big top
            let tent = `<path d="M440 820 L440 470 L760 230 L1080 470 L1080 820Z" fill="#fff" ${st(6)}/>`;
            for (let i = 0; i < 6; i++) tent += `<path d="M${440 + i * 107} 820 L${440 + i * 107} 470 L760 230 L${494 + i * 107} 470 L${494 + i * 107} 820Z" fill="#e5484d"/>`;
            tent += `<path d="M440 820 L440 470 L760 230 L1080 470 L1080 820Z" fill="none" ${st(6)}/><path d="M440 470 ${Array.from({ length: 8 }, (_, i) => `Q${f(460 + i * 80)} 520 ${f(520 + i * 80)} 470`).join(" ")}" fill="#ffd23f" ${st(5)}/>`;
            tent += `<path d="M760 230 V150" ${st(6)}/><g transform="translate(760 150)"><g data-k="tflag"><path d="M0 0 Q36 -10 70 6 Q36 20 0 26Z" fill="#5fd4c4" ${st(4)}/></g></g><path d="M690 820 Q760 620 830 820Z" fill="#2b1a3f" ${st(5)}/><path d="M700 820 Q760 660 820 820" fill="#ffd27a" opacity=".35"/>`;
            for (let i = 0; i <= 18; i++) { const x = 440 + i * 35.5; tent += `<circle data-k="b${i}" cx="${f(x)}" cy="${f(474 + Math.sin(i / 18 * Math.PI) * 6)}" r="8" fill="#fff6a0" ${st(2)}/>`; }
            b += `<g data-k="tent">${tent}</g>`;
            // string lights and a food stand
            b += `<path d="M0 560 Q220 620 440 560" fill="none" stroke="${INK}" stroke-width="3"/><path d="M1080 600 Q1180 660 1290 610" fill="none" stroke="${INK}" stroke-width="3"/>` + [...Array.from({ length: 9 }, (_, i) => [i * 50 + 20, 560 + Math.sin(i / 8 * Math.PI) * 52]), ...Array.from({ length: 5 }, (_, i) => [1090 + i * 48, 604 + Math.sin(i / 4 * Math.PI) * 50])].map(([x, y], i) => `<circle data-k="sl${i}" cx="${f(x)}" cy="${f(y + 8)}" r="7" fill="${["#ff5c7a", "#ffd23f", "#5ff2ff", "#7dff6b"][i % 4]}" ${st(2)}/>`).join("");
            b += `<g transform="translate(180 820)"><rect x="-110" y="-120" width="220" height="120" fill="#7a4a2c" ${st(5)}/><path d="M-130 -120 H130 L110 -160 H-110Z" fill="#fff" ${st(5)}/>${[0, 1, 2, 3, 4].map(i => `<path d="M${-110 + i * 44} -160 H${-88 + i * 44} L${-86 + i * 44 + 8} -120 H${-130 + i * 52 + 22}Z" fill="#5fd4c4"/>`).join("")}<rect x="-90" y="-100" width="180" height="50" fill="#ffd27a" opacity=".8"/><circle cx="-40" cy="-76" r="16" fill="#ffb3d1" ${st(3)}/><path d="M-40 -60 V-40" ${st(3)}/></g>`;
            b += `<g data-k="dunes">${hills(830, 22, "#4a2f5e", 1, 2, { line: 5 })}</g><path d="M-100 830 H1700 V1000 H-100Z" fill="#3b2650" ${st(5)}/>`;
            return { back: b, front: "" };
        },
        frame(t, s) {
            const a = t * 18;
            s.set("wheel", `rotate(${f(a)})`);
            for (let i = 0; i < 8; i++) { const q = (a + i * 45) * Math.PI / 180; s.set("gd" + i, `translate(${f(Math.cos(q) * 230)} ${f(Math.sin(q) * 230)})`); }
            for (let i = 0; i < 2; i++) s.set("sp" + i, `rotate(${f(Math.sin(t * 0.9 + i * 2) * 28)})`);
            s.set("tflag", `skewY(${f(Math.sin(t * 6) * 10)})`);
            for (let i = 0; i < 10; i++) s.setStyle("tw" + i, "opacity", 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i)));
            for (let i = 0; i <= 18; i++) s.setStyle("b" + i, "opacity", t > 1.6 + i * 0.04 ? 0.6 + 0.4 * Math.sin(t * 6 + i) : 0.15);
            for (let i = 0; i < 14; i++) s.setStyle("sl" + i, "opacity", 0.55 + 0.45 * Math.sin(t * 4 + i * 1.3));
            s.set("tent", `translate(0 ${f(lerp(140, 0, seg(t, 0.3, 1.8, out)))})`);
            const walk = seg(t, 0, 4.0, k => k), step = Math.sin(t * 7.5);
            const x = lerp(-80, 760, walk);
            s.hero(x, 838 - Math.abs(step) * 14 * (1 - seg(t, 3.8, 4.0)), 1.05, step * 3 * (1 - seg(t, 3.8, 4)), 1, 1);
            s.shadow(x, 840, 1.05, 0.3);
            if (t > 2.0 && Math.random() < 0.06) s.emit("firework", 1, [rnd(200, 1400), 900]);
            if (t > 4.0 && !s.once("cheer")) { s.emit("confetti", 70, [760, 600]); s.emit("firework", 3, [760, 900]); }
            if (Math.random() < 0.05) s.emit("balloon", 1, [rnd(100, 1500), 920]);
            s.cam(lerp(500, 800, seg(t, 0, 4.4)), lerp(560, 470, seg(t, 0, 4.4)), lerp(1.2, 1.05, seg(t, 0, 4.4)), 0);
        }
    };

    // ---- Neon Arcade: fired from a circus cannon into a giant arcade cabinet, out onto the neon grid ----
    S.arcade = {
        T: 7.4,
        build: (D, R) => {
            // inside the big top: stripes, a spotlight on the cannon, the crowd's silhouettes, the arcade cabinet
            let top = `<rect x="-100" y="-100" width="${W + 200}" height="1100" fill="#2b1a3f"/>`;
            for (let i = 0; i < 18; i++) top += `<path d="M800 -200 L${-600 + i * 180} 900 L${-510 + i * 180} 900Z" fill="${i % 2 ? "#5a1f3a" : "#3a1838"}"/>`;
            top += `<path d="M0 0 L800 -60 L1600 0" fill="none" stroke="#ffd23f" stroke-width="6" opacity=".5"/>` + glow(D, "spot", 330, 700, 380, "#fff1c0", 0.45);
            top += `<path d="M-100 820 H1700 V1000 H-100Z" fill="#7a4a2c" ${st(5)}/><path d="M-100 820 H1700" stroke="#a8743e" stroke-width="8"/>`;
            top += Array.from({ length: 16 }, (_, i) => `<circle cx="${i * 110 + 20}" cy="${880 + (i % 2) * 14}" r="40" fill="#1a0f2a"/><ellipse cx="${i * 110 + 20}" cy="${950}" rx="54" ry="40" fill="#1a0f2a"/>`).join("");
            // the arcade cabinet, its screen showing pixel invaders
            let cab = `<g transform="translate(1240 470)"><path d="M-200 360 V-260 L-170 -330 H170 L200 -260 V360Z" fill="${D.lin("cab", [[0, "#2a1450"], [1, "#160a2e"]])}" ${st(8)}/>` +
                `<rect x="-186" y="-322" width="372" height="64" rx="8" fill="#ff2bd6" ${st(5)}/><rect x="-176" y="-314" width="352" height="48" rx="6" fill="#ff7ae6"/>${[0, 1, 2, 3, 4, 5].map(i => `<rect x="${-140 + i * 50}" y="-304" width="30" height="28" fill="#fff" opacity=".85"/>`).join("")}` +
                `<rect x="-170" y="-240" width="340" height="280" rx="20" fill="#05010f" ${st(6)}/><g data-k="scr"><rect x="-154" y="-226" width="308" height="252" rx="12" fill="#14062e"/>` +
                [0, 1, 2].map(r => [0, 1, 2, 3, 4].map(c => `<g data-k="inv${r}${c}" transform="translate(${-110 + c * 55} ${-190 + r * 46})"><path d="M-14 -8 H14 V8 H8 V14 H2 V8 H-2 V14 H-8 V8 H-14Z M-10 -14 H-4 V-8 H-10Z M4 -14 H10 V-8 H4Z" fill="${["#5ff2ff", "#7dff6b", "#ffe066"][r]}"/></g>`).join("")).join("") +
                `<path d="M-30 6 H30 V-6 H6 V-16 H-6 V-6 H-30Z" fill="#ff2bd6"/>${Array.from({ length: 12 }, (_, i) => `<path d="M-154 ${-220 + i * 22} H154" stroke="#000" stroke-width="3" opacity=".25"/>`).join("")}</g>` +
                `<path d="M-200 60 L-230 120 H230 L200 60Z" fill="#3b1a6a" ${st(6)}/><circle cx="-110" cy="94" r="16" fill="#ff5c7a" ${st(3)}/><circle cx="-60" cy="94" r="16" fill="#5ff2ff" ${st(3)}/><circle cx="-10" cy="94" r="16" fill="#ffe066" ${st(3)}/><path d="M90 94 V60" ${st(8)}/><circle cx="90" cy="54" r="16" fill="#e5484d" ${st(4)}/>` +
                `<path d="M-200 -200 V340 M200 -200 V340" stroke="#5ff2ff" stroke-width="5" opacity=".7"/></g>`;
            top += glow(D, "cabglow", 1240, 330, 360, "#ff2bd6", 0.35) + cab;
            top += `<g transform="translate(330 760)"><circle cx="-40" cy="60" r="60" fill="#7a4a2c" ${st(6)}/>${[0, 45, 90, 135].map(a => `<path d="M${f(-40 + Math.cos(a * Math.PI / 180) * 56)} ${f(60 + Math.sin(a * Math.PI / 180) * 56)} L${f(-40 - Math.cos(a * Math.PI / 180) * 56)} ${f(60 - Math.sin(a * Math.PI / 180) * 56)}" stroke="#5a3420" stroke-width="6"/>`).join("")}` +
                `<g transform="rotate(-36)"><rect x="-50" y="-76" width="320" height="152" rx="34" fill="${D.lin("barrel", [[0, "#7a8090"], [0.5, "#5a5f6e"], [1, "#3a3f4e"]])}" ${st(7)}/><rect x="236" y="-86" width="64" height="172" rx="18" fill="#3a3f4e" ${st(7)}/><path d="M20 -76 V76 M110 -76 V76" stroke="#e5484d" stroke-width="18"/><path d="M20 -76 V76 M110 -76 V76" stroke="#ffd23f" stroke-width="4"/><path d="M-40 -50 H230" stroke="#fff" stroke-width="5" opacity=".25"/>` +
                `<path d="M-50 0 Q-100 -10 -110 -50" fill="none" stroke="#8a5a3c" stroke-width="6"/></g><circle cx="-40" cy="60" r="18" fill="${INK}"/></g>`;
            // inside the game: a neon grid, a striped sun, pixel mountains, coins
            let inside = `<rect x="-100" y="-100" width="${W + 200}" height="1100" fill="${D.lin("syn", [[0, "#12043a"], [0.55, "#5a0f6e"], [0.62, "#ff2bd6"], [1, "#1a0533"]])}"/>`;
            for (let i = 0; i < 60; i++) inside += `<rect data-k="${i % 6 === 0 ? "ps" + i / 6 : ""}" x="${f(R() * W)}" y="${f(R() * 420)}" width="5" height="5" fill="#fff" opacity="${f(0.4 + R() * 0.6)}"/>`;
            inside += `<g transform="translate(800 470)"><circle r="190" fill="${D.lin("ssun", [[0, "#ffe066"], [1, "#ff2bd6"]])}"/>${[0, 1, 2, 3, 4].map(i => `<rect x="-200" y="${40 + i * 30}" width="400" height="${6 + i * 3}" fill="#5a0f6e"/>`).join("")}</g>`;
            inside += `<path d="M-100 560 L120 400 L260 470 L420 360 L600 560Z M1000 560 L1180 380 L1300 450 L1460 340 L1700 560Z" fill="#2a0a4a" stroke="#ff2bd6" stroke-width="5"/>`;
            inside += `<rect x="-100" y="560" width="${W + 200}" height="500" fill="#0b0320"/><g data-k="grid">${Array.from({ length: 14 }, (_, i) => `<path d="M-100 ${560 + i * i * 4} H1700" stroke="#5ff2ff" stroke-width="${2 + i * 0.3}" opacity=".8"/>`).join("")}</g>` +
                Array.from({ length: 25 }, (_, i) => `<path d="M800 560 L${-1600 + i * 200} 1000" stroke="#5ff2ff" stroke-width="3" opacity=".8"/>`).join("");
            inside += [0, 1, 2, 3].map(i => `<g transform="translate(${300 + i * 330} ${700 - (i % 2) * 60})"><g data-k="coin${i}"><circle r="26" fill="#ffd23f" ${st(4)}/><circle r="16" fill="none" stroke="#e8a81f" stroke-width="4"/><rect x="-4" y="-10" width="8" height="20" fill="#e8a81f"/></g></g>`).join("");
            inside += `<rect width="${W}" height="${H}" fill="url(#tv-arcade-scan)" opacity=".25"/>`;
            D.raw(`<pattern id="tv-arcade-scan" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="3" fill="#000"/></pattern><pattern id="tv-arcade-pix" width="50" height="50" patternUnits="userSpaceOnUse"><rect width="50" height="50" fill="#ff2bd6"/><rect width="25" height="25" fill="#5ff2ff"/><rect x="25" y="25" width="25" height="25" fill="#7a2dff"/></pattern>`);
            return { back: `<g data-k="top">${top}</g><g data-k="inside" opacity="0">${inside}</g>`, front: `<rect data-k="pix" x="-100" y="-100" width="${W + 200}" height="1100" fill="url(#tv-arcade-pix)" opacity="0"/>` };
        },
        frame(t, s) {
            for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) s.set("inv" + r + c, `translate(${f(-110 + c * 55 + Math.sin(t * 2) * 20)} ${f(-190 + r * 46 + Math.floor(t * 2) % 2 * 4)})`);
            const fly = seg(t, 1.3, 3.0, k => k);
            if (t < 1.3) { s.hero(380, 660, 0.55, -36, 1, 1); if (Math.random() < 0.8) s.emit("spark", 1, [190, 690]); }
            else if (t < 3.0) s.hero(lerp(480, 1240, fly), lerp(560, 360, fly) - Math.sin(fly * Math.PI) * 320, lerp(0.85, 0.3, seg(t, 2.6, 3.0)), fly * 900, 1, 1 - seg(t, 2.85, 3.0));
            if (t > 1.3 && !s.once("boom")) { s.emit("smoke", 40, [500, 560]); s.emit("spark", 30, [500, 560]); s.shake(18); s.flash("#fff1c0", 0.6); }
            if (t > 1.3 && t < 3.0 && Math.random() < 0.6) s.emit("trail", 1, [lerp(480, 1240, fly), lerp(560, 360, fly) - Math.sin(fly * Math.PI) * 320 - 120]);
            // the camera dives into the screen, the picture breaks into pixels, and we're inside the game
            const dive = seg(t, 2.6, 3.3, inn);
            const px = seg(t, 3.0, 3.35) * (1 - seg(t, 3.5, 4.0));
            s.setStyle("pix", "opacity", px);
            s.setStyle("top", "opacity", t < 3.35 ? 1 : 0);
            s.setStyle("inside", "opacity", t >= 3.35 ? 1 : 0);
            s.set("grid", `translate(0 ${f((t * 40) % 16)})`);
            for (let i = 0; i < 4; i++) s.set("coin" + i, `translate(0 ${f(Math.sin(t * 3 + i) * 12)}) scale(${f(Math.cos(t * 4 + i))} 1)`);
            for (let i = 0; i < 10; i++) s.setStyle("ps" + i, "opacity", Math.sin(t * 5 + i) > 0 ? 1 : 0.2);
            if (t > 3.5) {
                const j = seg(t, 3.5, 4.2), up = Math.sin(j * Math.PI);
                s.hero(lerp(800, 800, j), lerp(560, 830, j) - up * 160, 1.15, 0, 1, seg(t, 3.5, 3.7), j >= 1 && t < 4.4 ? 0.86 : 1);
                s.shadow(800, 832, 1.15 - up * 0.4, 0.3 * j);
            }
            if (t > 4.2 && !s.once("bits")) { s.emit("pixel", 70, [800, 760]); s.emit("ring", 1, [800, 830]); s.shake(6); }
            s.cam(t < 3.35 ? lerp(lerp(480, 800, seg(t, 0, 1.3)), 1240, dive) : 800, t < 3.35 ? lerp(520, 370, dive) : 450, t < 3.35 ? lerp(1.12, 3.4, dive) : lerp(1.3, 1.04, seg(t, 3.35, 4.4)), 0);
        }
    };

    // ---- Haunted Library: through the glowing rune door ----
    S.library = {
        T: 7.4,
        build: (D, R) => {
            // the corridor in front of the door (neon, like the arcade)
            let pre = `<rect x="-100" y="-100" width="${W + 200}" height="1100" fill="#1a0a33"/>${Array.from({ length: 10 }, (_, i) => `<path d="M800 450 L${-200 + i * 220} -100" stroke="#ff2bd6" stroke-width="3" opacity=".35"/><path d="M800 450 L${-200 + i * 220} 1000" stroke="#5ff2ff" stroke-width="3" opacity=".35"/>`).join("")}`;
            pre += glow(D, "door", 800, 620, 360, "#b48cff", 0.7) + `<g transform="translate(800 640)"><path d="M-150 200 V-60 Q-150 -220 0 -220 Q150 -220 150 -60 V200Z" fill="#2a1a40" ${st(8)}/>` +
                `<path d="M-120 200 V-50 Q-120 -190 0 -190 Q120 -190 120 -50 V200Z" fill="${D.rad("vort", [[0, "#ffffff"], [0.3, "#cfa0ff"], [1, "#3a1a6a"]])}"/><g data-k="vortex">${[0, 1, 2, 3].map(i => `<path d="M0 0 ${Array.from({ length: 30 }, (_, j) => { const a = j * 0.45 + i * 1.57, r = j * 5; return `L${f(Math.cos(a) * r)} ${f(Math.sin(a) * r * 1.3)}`; }).join(" ")}" fill="none" stroke="#fff" stroke-width="3" opacity=".5"/>`).join("")}</g>` +
                `<g data-k="runes">${Array.from({ length: 10 }, (_, i) => { const a = i / 10 * Math.PI - Math.PI; return `<path d="M${f(Math.cos(a) * 172)} ${f(Math.sin(a) * 172 - 50)} m-8 -8 l16 16 m0 -16 l-16 16" stroke="#5ff2ff" stroke-width="4" stroke-linecap="round"/>`; }).join("")}</g></g>`;
            pre += `<path d="M-100 840 H1700 V1000 H-100Z" fill="#12061f" ${st(5)}/>`;
            // the library
            let lib = `<rect x="-100" y="-100" width="${W + 200}" height="1100" fill="${D.lin("lib", [[0, "#120d26"], [1, "#2f2148"]])}"/>`;
            lib += `<g transform="translate(800 260)"><path d="M-130 200 V-60 Q-130 -190 0 -190 Q130 -190 130 -60 V200Z" fill="#1d2b5c" ${st(8)}/><circle cx="40" cy="-60" r="60" fill="#f4f6ff"/><circle cx="20" cy="-70" r="10" fill="#d6dcef"/><path d="M0 -190 V200 M-130 0 H130" stroke="${INK}" stroke-width="10"/></g>`;
            lib += `<path data-k="beam" d="M680 300 L940 300 L1100 900 L420 900Z" fill="${D.lin("beam", [[0, "#dfe8ff", 0.35], [1, "#dfe8ff", 0]])}"/>`;
            const shelf = (x, wdt, flip) => {
                let g = `<g transform="translate(${x} 0)${flip ? " scale(-1 1)" : ""}"><path d="M0 60 L${wdt} 140 V840 L0 900Z" fill="#4a3424" ${st(6)}/>`;
                for (let r = 0; r < 5; r++) {
                    const y0 = 110 + r * 150;
                    g += `<path d="M14 ${y0 - 40} L${wdt - 14} ${y0 + 20 - r * 0} V${y0 + 120} L14 ${y0 + 110}Z" fill="#2b1d14"/>`;
                    for (let i = 0; i < 9; i++) { const bx = 20 + i * (wdt - 40) / 9, h = 90 - (i % 3) * 12; g += `<rect x="${f(bx)}" y="${f(y0 + 110 - h + i * 1.5)}" width="${f((wdt - 40) / 9 - 4)}" height="${h}" rx="3" fill="${["#7a4fd6", "#e5484d", "#2f8fe0", "#3fbf5f", "#ffb84d", "#8a5a3c"][(i + r) % 6]}" ${st(3)}/>`; }
                }
                return g + `</g>`;
            };
            lib += shelf(-20, 360, false) + shelf(1620, 360, true);
            lib += `<g transform="translate(250 0)"><path d="M0 120 L-40 840 M70 120 L40 840" ${st(8)}/>${Array.from({ length: 9 }, (_, i) => `<path d="M${-2 - i * 4} ${180 + i * 75} H${68 - i * 4}" ${st(6)}/>`).join("")}</g>`;
            lib += `<g transform="translate(800 0)"><g data-k="chand"><path d="M0 0 V120" ${st(4)}/><path d="M-120 140 Q0 200 120 140" fill="none" ${st(8)}/><path d="M-120 140 Q0 200 120 140" fill="none" stroke="#c9a96a" stroke-width="4"/>${[-120, -60, 0, 60, 120].map((x, i) => `<g transform="translate(${x} ${140 + Math.abs(x) * -0.2 + (i === 2 ? 30 : 10)})"><rect x="-8" y="-30" width="16" height="30" fill="#fff4dc" ${st(3)}/><path data-k="cf${i}" d="M0 -32 C-8 -44 -4 -56 0 -62 C4 -56 8 -44 0 -32Z" fill="#ffb21e" opacity="0"/></g>`).join("")}</g></g>`;
            lib += `<path d="M-100 860 H1700 V1000 H-100Z" fill="#2b1d14" ${st(5)}/><path d="M-100 870 H1700" stroke="#4a3424" stroke-width="6"/>`;
            lib += `<g transform="translate(1200 860)"><rect x="-120" y="-90" width="240" height="20" fill="#5a3826" ${st(5)}/><path d="M-100 -70 V0 M100 -70 V0" ${st(10)}/><path d="M-80 -92 Q-40 -110 0 -96 Q40 -110 80 -92 L80 -100 Q40 -118 0 -104 Q-40 -118 -80 -100Z" fill="#fffaf0" ${st(3)}/><path d="M40 -104 L70 -160" ${st(3)}/><path d="M70 -160 Q90 -170 76 -150Z" fill="#fff" ${st(2)}/></g>`;
            lib += [[480, 760, 0], [1080, 760, 1], [620, 560, 2]].map(([x, y, i]) => `<g transform="translate(${x} ${y})"><rect x="-14" y="-70" width="28" height="70" rx="5" fill="#fff4dc" ${st(4)}/><path d="M-14 -50 q6 10 0 20" stroke="#e8dcc0" stroke-width="4" fill="none"/><path data-k="c${i}" d="M0 -74 C-12 -90 -6 -110 0 -122 C6 -110 12 -90 0 -74Z" fill="#ffb21e" stroke="#fff3a0" stroke-width="3" opacity="0"/></g>` + `<g data-k="cg${i}" opacity="0">${glow(D, "cg" + i, x, y - 96, 130, "#ffcf6b", 0.6)}</g>`).join("");
            lib += [[120, 60], [1480, 60]].map(([x, y], i) => `<path d="M${x} ${y} l${i ? 120 : -120} 0 M${x} ${y} l${i ? 90 : -90} 70 M${x} ${y} l0 110 M${x + (i ? 40 : -40)} ${y} q${i ? 4 : -4} 22 ${i ? 20 : -20} 30 q${i ? 6 : -6} -18 ${i ? 30 : -30} -22 M${x + (i ? 70 : -70)} ${y} q${i ? 4 : -4} 40 ${i ? 24 : -24} 52" stroke="#d6dcef" stroke-width="2" fill="none" opacity=".6"/>`).join("");
            lib += [0, 1, 2, 3].map(i => `<g data-k="bk${i}"><g data-k="bkl${i}"><path d="M0 0 L-46 -10 L-46 26 L0 34Z" fill="${["#7a4fd6", "#e5484d", "#2f8fe0", "#3fbf5f"][i]}" ${st(3)}/></g><g data-k="bkr${i}"><path d="M0 0 L46 -10 L46 26 L0 34Z" fill="${shade(["#7a4fd6", "#e5484d", "#2f8fe0", "#3fbf5f"][i], -0.2)}" ${st(3)}/></g><path d="M0 0 V34" stroke="#fffaf0" stroke-width="4"/></g>`).join("");
            return { back: `<g data-k="pre">${pre}</g><g data-k="lib" opacity="0">${lib}</g>`, front: "" };
        },
        frame(t, s) {
            s.set("vortex", `rotate(${f(t * 160)})`); s.set("runes", `rotate(${f(Math.sin(t * 2) * 4)})`);
            const go = seg(t, 0, 2.0, k => k);
            s.setStyle("pre", "opacity", 1 - seg(t, 2.2, 2.6));
            s.setStyle("lib", "opacity", seg(t, 2.4, 3.2));
            if (t > 2.15 && !s.once("through")) { s.flash("#e8d8ff", 0.9); s.emit("sparkle", 40, [800, 600]); }
            if (t < 2.2) { s.hero(lerp(160, 800, go), 840 - Math.abs(Math.sin(t * 7)) * 12, lerp(1.05, 0.8, seg(t, 1.6, 2.2)), 0, 1, 1 - seg(t, 1.9, 2.2)); s.shadow(lerp(160, 800, go), 842, 1, 0.3); if (Math.random() < 0.5) s.emit("sparkle", 1, [800 + rnd(-110, 110), rnd(440, 820)]); }
            else { s.hero(800, 862, 1.1, 0, 1, seg(t, 2.6, 3.2)); s.shadow(800, 864, 1.1, seg(t, 2.6, 3.2) * 0.35); }
            s.set("chand", `rotate(${f(Math.sin(t * 1.3) * 4)})`);
            for (let i = 0; i < 5; i++) s.setStyle("cf" + i, "opacity", t > 3.1 + i * 0.12 ? 0.8 + Math.sin(t * 14 + i) * 0.2 : 0);
            for (const [i, at] of [[0, 3.4], [1, 3.7], [2, 4.0]]) { s.setStyle("c" + i, "opacity", t > at ? 0.85 + Math.sin(t * 13 + i) * 0.15 : 0); s.setStyle("cg" + i, "opacity", t > at ? 0.8 + Math.sin(t * 9 + i) * 0.2 : 0); }
            s.setStyle("beam", "opacity", 0.7 + Math.sin(t * 1.5) * 0.2);
            for (let i = 0; i < 4; i++) {
                const a = t * 0.8 + i * 1.6;
                s.set("bk" + i, `translate(${f(800 + Math.cos(a) * (380 + i * 30))} ${f(380 + Math.sin(a * 1.3) * 120 - i * 30)}) rotate(${f(Math.sin(a) * 12)})`);
                const fl = Math.sin(t * 9 + i);
                s.set("bkl" + i, `skewY(${f(fl * 18)})`); s.set("bkr" + i, `skewY(${f(-fl * 18)})`);
                s.setStyle("bk" + i, "opacity", seg(t, 3.0, 3.6));
            }
            if (t > 2.6 && Math.random() < 0.5) s.emit("mote", 1, [rnd(500, 1100), rnd(300, 860)]);
            if (t > 3.2 && Math.random() < 0.06) s.emit("ghost", 1, [rnd(200, 1400), H + 20]);
            s.cam(800, lerp(560, 470, seg(t, 2.4, 6)), t < 2.3 ? lerp(1.0, 1.4, seg(t, 1.0, 2.3, inn)) : lerp(1.18, 1.04, seg(t, 2.4, 6)), 0);
        }
    };

    // ---- Robot Factory: into the pages of a giant book, down into the factory ----
    S.robot = {
        T: 7.4,
        build: (D, R) => {
            // the factory: a wall of pipes, gears, robot arms, a lamp, a conveyor
            let fac = `<rect x="-100" y="-100" width="${W + 200}" height="1100" fill="${D.lin("wall", [[0, "#2a323d"], [1, "#4d5664"]])}"/>`;
            for (let x = 0; x < W; x += 120) fac += `<path d="M${x} -100 V820" stroke="#222a33" stroke-width="3"/>`;
            fac += `<path d="M-100 200 H500 Q540 200 540 240 V420 H900 M1100 120 H1700 M1180 120 V360 Q1180 400 1220 400 H1700" fill="none" stroke="${INK}" stroke-width="40"/><path d="M-100 200 H500 Q540 200 540 240 V420 H900 M1100 120 H1700 M1180 120 V360 Q1180 400 1220 400 H1700" fill="none" stroke="#8a93a3" stroke-width="28"/>` +
                `<path d="M-100 192 H500" stroke="#c9ced8" stroke-width="6" opacity=".5"/>${[[300, 200], [540, 330], [1400, 120], [1180, 260]].map(([x, y]) => `<rect x="${x - 26}" y="${y - 26}" width="52" height="52" rx="8" fill="#5a5f6e" ${st(4)}/><circle cx="${x}" cy="${y}" r="12" fill="#e5484d" ${st(3)}/>`).join("")}`;
            fac += gear(220, 520, 110, "#8a93a3", "g1") + gear(380, 640, 70, "#a6b3c6", "g2") + gear(1420, 560, 130, "#8a93a3", "g3") + gear(1260, 690, 60, "#a6b3c6", "g4");
            fac += `<g transform="translate(1000 0)"><rect x="-10" y="0" width="20" height="60" fill="#3a3f4e"/><path d="M-40 60 H40 L30 100 H-30Z" fill="#ffd23f" ${st(4)}/><g data-k="lampb" transform="translate(0 90)"><path d="M0 0 L-90 -300 L90 -300Z" fill="#ffb21e" opacity=".2" transform="rotate(180)"/></g><circle data-k="lampc" cx="0" cy="96" r="12" fill="#ff7a1f"/></g>`;
            const arm = (x, k, flip) => `<g transform="translate(${x} 760)${flip ? " scale(-1 1)" : ""}"><rect x="-50" y="-20" width="100" height="30" rx="6" fill="#ffb21e" ${st(5)}/><g data-k="${k}a"><rect x="-16" y="-180" width="32" height="170" rx="12" fill="#ffb21e" ${st(5)}/><path d="M-6 -160 V-30" stroke="#e8901a" stroke-width="5"/><circle cx="0" cy="-10" r="16" fill="#5a5f6e" ${st(4)}/>` +
                `<g transform="translate(0 -180)"><g data-k="${k}b"><rect x="-14" y="-14" width="160" height="28" rx="12" fill="#ffb21e" ${st(5)}/><circle r="14" fill="#5a5f6e" ${st(4)}/><g transform="translate(150 0)"><path d="M0 0 L26 -18 L34 -6 L12 4 L34 14 L26 26 L0 8Z" fill="#9aa3b2" ${st(4)}/></g></g></g></g></g>`;
            fac += arm(330, "armL", false) + arm(1300, "armR", true);
            fac += `<rect x="-100" y="760" width="${W + 200}" height="56" fill="#3a3f4e" ${st(6)}/><path data-k="belt" d="M-100 770 H1700" stroke="#2a2f3a" stroke-width="14" stroke-dasharray="40 30"/>` +
                Array.from({ length: 22 }, (_, i) => `<g transform="translate(${i * 80} 830)"><g data-k="r${i}"><circle r="26" fill="#5a5f6e" ${st(5)}/><path d="M-20 0 H20 M0 -20 V20" stroke="#8a93a3" stroke-width="5"/></g></g>`).join("") + `<rect x="-100" y="856" width="${W + 200}" height="120" fill="#232a34"/>`;
            fac += `<g data-k="crates">${[0, 1, 2].map(i => `<g transform="translate(${i * 520} 760)"><rect x="-50" y="-90" width="100" height="90" fill="#c98a4b" ${st(5)}/><path d="M-50 -90 L50 0 M50 -90 L-50 0" stroke="#8a5a3c" stroke-width="5"/></g>`).join("")}</g>`;
            fac += [[140, 420], [1500, 300]].map(([x, y], i) => `<g transform="translate(${x} ${y})"><rect x="-20" y="-10" width="40" height="20" fill="#5a5f6e" ${st(4)}/></g>`).join("");
            // the book on a desk, its pages turning
            let book = `<rect x="-100" y="-100" width="${W + 200}" height="1100" fill="#3a2a1e"/><path d="M-100 700 H1700 V1000 H-100Z" fill="#6b4226" ${st(5)}/>${Array.from({ length: 8 }, (_, i) => `<path d="M-100 ${720 + i * 34} H1700" stroke="#5a3826" stroke-width="3"/>`).join("")}`;
            book += glow(D, "lamp", 1300, 200, 500, "#ffe0a0", 0.4);
            book += `<path d="M200 420 Q500 380 800 430 Q1100 380 1400 420 L1420 820 Q1100 780 800 830 Q500 780 180 820Z" fill="#7a4fd6" ${st(7)}/>` +
                `<path d="M230 430 Q520 400 800 440 L800 800 Q520 770 215 805Z" fill="#fffaf0" ${st(5)}/><path d="M800 440 Q1080 400 1370 430 L1385 805 Q1080 770 800 800Z" fill="#fff4dc" ${st(5)}/>` +
                `${[0, 1, 2, 3, 4, 5, 6].map(r => `<path d="M280 ${490 + r * 42} Q520 ${470 + r * 42} 760 ${484 + r * 42}" stroke="#c9bfa8" stroke-width="5" fill="none"/>`).join("")}<g transform="translate(1080 600)"><circle r="70" fill="#ffd6a0" ${st(4)}/><path d="${star5(0, 0, 40, 18)}" fill="#ffd23f" ${st(3)}/></g>` +
                Array.from({ length: 6 }, (_, i) => `<g transform="translate(800 0)"><g data-k="p${i}"><path d="M0 440 Q280 400 570 430 L585 805 Q280 770 0 800Z" fill="${i % 2 ? "#fffaf0" : "#fff4dc"}" ${st(5)}/>${[0, 1, 2, 3, 4, 5].map(r => `<path d="M60 ${500 + r * 44} Q300 ${480 + r * 44} 520 ${494 + r * 44}" stroke="#c9bfa8" stroke-width="5" fill="none"/>`).join("")}</g></g>`).join("");
            return { back: `<g data-k="fac" opacity="0">${fac}</g><g data-k="book">${book}</g>`, front: "" };
        },
        frame(t, s) {
            for (let i = 0; i < 6; i++) { const k = seg(t, 0.2 + i * 0.2, 0.7 + i * 0.2); s.set("p" + i, `scale(${f(Math.cos(k * Math.PI))} 1)`); }
            // the camera dives into the page; the letters swirl past; the factory appears below
            const dive = seg(t, 1.4, 2.6, inn);
            s.setStyle("book", "opacity", 1 - seg(t, 2.4, 2.8));
            s.setStyle("fac", "opacity", seg(t, 2.5, 3.0));
            if (t > 1.6 && t < 3.0 && Math.random() < 0.9) s.emit("letter", 2, [800 + rnd(-300, 300), 1000]);
            for (const [k, sp] of [["g1", 40], ["g2", -63], ["g3", 30], ["g4", -65]]) s.set(k, `rotate(${f(t * sp)})`);
            for (let i = 0; i < 22; i++) s.set("r" + i, `rotate(${f(t * 240)})`);
            s.setStyle("belt", "strokeDashoffset", -t * 160);
            s.set("crates", `translate(${f((t * 100) % 520 - 260)} 0)`);
            s.set("armLa", `rotate(${f(-20 + Math.sin(t * 2) * 25)})`); s.set("armLb", `rotate(${f(-30 + Math.sin(t * 2.6) * 30)})`);
            s.set("armRa", `rotate(${f(-15 + Math.sin(t * 2 + 1) * 22)})`); s.set("armRb", `rotate(${f(-40 + Math.sin(t * 3 + 1) * 26)})`);
            s.set("lampb", `translate(0 90) rotate(${f(t * 200)})`); s.setStyle("lampc", "opacity", 0.6 + 0.4 * Math.sin(t * 10));
            if (t > 3.0 && Math.random() < 0.35) s.emit("spark", 2, [rnd(0, 1) < 0.5 ? 520 : 1110, 600]);
            if (t > 3.0 && Math.random() < 0.15) s.emit("steam", 1, [[140, 1500][Math.floor(rnd(0, 2))], [420, 300][Math.floor(rnd(0, 2))]]);
            const fall = seg(t, 1.8, 3.3, inn);
            if (t < 3.3) s.hero(800 + Math.sin(t * 4) * 40, lerp(-140, 760, fall), 1, t * 180, 1, t < 1.8 ? 0 : 1);
            else {
                const ride = seg(t, 3.3, 7.4, k => k), b = seg(t, 3.3, 3.7);
                s.hero(800 + ride * 160, 760 - Math.sin(b * Math.PI) * 70, 1.1, 0, 1, 1, t > 3.7 && t < 3.9 ? 0.86 : 1);
                s.shadow(800 + ride * 160, 764, 1.1, 0.3);
            }
            if (t > 3.3 && !s.once("clank")) { s.emit("spark", 30, [800, 760]); s.shake(12); s.emit("ring", 1, [800, 764]); }
            s.cam(800, t < 2.6 ? lerp(600, 600, dive) : 450, t < 2.6 ? lerp(1.0, 3.2, dive) : lerp(1.4, 1.04, seg(t, 2.6, 4.0)), 0);
        }
    };

    // ---- Volcano Island: a rocket from the factory, over the sea, onto the beach ----
    S.volcano = {
        T: 7.4,
        build: (D, R) => {
            let b = glow(D, "sun", 300, 200, 300, "#fff1b0", 0.8) + `<g data-k="cl">${cloud(300, 260, 0.8, "#ffe8d0", "#ffd0b0")}${cloud(1100, 180, 1, "#ffe8d0", "#ffd0b0")}</g>`;
            let isle = `<path d="M-100 700 H1800 V1000 H-100Z" fill="${D.lin("sea", [[0, "#2a8fd6"], [1, "#0a3a6a"]])}" ${st(5)}/>`;
            isle += `<g data-k="waves">${Array.from({ length: 20 }, (_, i) => `<path d="M${i * 120 - 100} ${730 + (i % 3) * 40} q30 -14 60 0 t60 0" fill="none" stroke="#bfe8ff" stroke-width="4" opacity=".7"/>`).join("")}</g>`;
            isle += `<g data-k="whale" transform="translate(380 760)"><path d="M-80 0 Q-60 -50 20 -40 Q80 -30 90 0Z" fill="#3a5f8a" ${st(5)}/><path d="M90 0 L120 -30 L110 0Z" fill="#3a5f8a" ${st(4)}/><circle cx="-40" cy="-20" r="5" fill="${INK}"/></g>`;
            isle += `<path d="M700 720 L1040 250 L1200 250 L1560 720Z" fill="${D.lin("cone", [[0, "#5a3326"], [1, "#7a4a32"]])}" ${st(6)}/><path d="M1040 250 H1200 L1180 300 L1150 280 L1120 320 L1090 286 L1060 310Z" fill="#ff7a1f" ${st(4)}/>`;
            isle += [0, 1, 2].map(i => `<path data-k="lava${i}" d="M${1080 + i * 40} 290 Q${1040 + i * 60} 420 ${1000 + i * 90} ${560 + i * 40} Q${980 + i * 100} 640 ${960 + i * 120} 720" fill="none" stroke="#ff7a1f" stroke-width="16" stroke-linecap="round" stroke-dasharray="30 20"/>`).join("");
            isle += glow(D, "crater", 1120, 260, 200, "#ff9a3a", 0.7);
            isle += `<path d="M600 730 Q1000 680 1700 730 V760 H600Z" fill="#e8c27a" ${st(5)}/>` + palm(660, 740, 0.8) + palm(1540, 740, 0.9, -1) + palm(820, 730, 0.6);
            b += `<g data-k="isle">${isle}</g>`;
            let fac = `<rect x="-300" y="380" width="640" height="460" fill="#5b6472" ${st(6)}/>${[0, 1, 2].map(i => `<rect x="${-200 + i * 160}" y="${240 - i * 30}" width="60" height="${160 + i * 30}" fill="#4a525e" ${st(6)}/><rect x="${-206 + i * 160}" y="${236 - i * 30}" width="72" height="16" fill="#e5484d" ${st(3)}/>`).join("")}` +
                `${[0, 1].map(r => [0, 1, 2, 3].map(c => `<rect x="${-260 + c * 140}" y="${460 + r * 100}" width="80" height="50" rx="6" fill="#ffd56b" ${st(3)}/>`).join("")).join("")}<path d="M-100 840 H600 V1000 H-100Z" fill="#3a3f4e" ${st(5)}/>` +
                `<g transform="translate(470 840)"><path d="M-60 0 V-320 M60 0 V-320" ${st(8)}/>${Array.from({ length: 6 }, (_, i) => `<path d="M-60 ${-i * 54} L60 ${-i * 54 - 54} M60 ${-i * 54} L-60 ${-i * 54 - 54}" stroke="#5a5f6e" stroke-width="5"/>`).join("")}</g>`;
            b += `<g data-k="fac">${fac}</g>`;
            const rocket = `<g data-k="rocket"><path d="M-130 -44 H60 Q140 -44 186 0 Q140 44 60 44 H-130Z" fill="${D.lin("rk", [[0, "#ffffff"], [1, "#c9ced8"]], 0, 0, 0, 1)}" ${st(6)}/><path d="M-130 -44 L-186 -92 L-160 -44Z M-130 44 L-186 92 L-160 44Z" fill="#e5484d" ${st(5)}/>` +
                `<path d="M120 -30 Q160 -18 186 0 Q160 18 120 30Z" fill="#e5484d" ${st(4)}/><circle cx="40" cy="0" r="20" fill="#5ff2ff" ${st(4)}/><circle cx="34" cy="-6" r="6" fill="#fff"/><path d="M-60 -44 V44 M-20 -44 V44" stroke="#9aa3b2" stroke-width="3"/>` +
                `<g data-k="flame"><path d="M-134 -28 Q-260 0 -134 28 Q-170 0 -134 -28Z" fill="#ffb21e" stroke="#ff5a1f" stroke-width="5"/><path d="M-134 -14 Q-200 0 -134 14Z" fill="#fff3a0"/></g></g>`;
            return { back: b, under: rocket, front: "" };
        },
        frame(t, s) {
            const lift = seg(t, 0.3, 1.0, inn), fly = seg(t, 0.9, 3.9);
            let x, y, rot;
            if (t < 0.9) { x = 470; y = lerp(560, 480, lift); rot = -90; }
            else { x = lerp(470, 1060, fly); y = lerp(480, 640, fly) - Math.sin(fly * Math.PI) * 300; rot = lerp(-90, 30, fly); }
            const sput = t > 3.0 && t < 3.9;
            s.set("rocket", `translate(${f(x + (sput ? rnd(-4, 4) : 0))} ${f(y)}) rotate(${f(rot + (sput ? Math.sin(t * 40) * 6 : 0))})`);
            s.set("flame", `scale(${f(sput ? 0.4 + Math.random() * 0.5 : 0.9 + Math.sin(t * 40) * 0.15)})`);
            s.set("fac", `translate(${f(-fly * 700)} 0)`); s.set("isle", `translate(${f(lerp(380, 0, fly))} 0)`);
            s.set("waves", `translate(${f((t * 30) % 120)} 0)`);
            for (let i = 0; i < 3; i++) s.setStyle("lava" + i, "strokeDashoffset", -t * 60);
            s.set("whale", `translate(${f(380 + t * 20)} ${f(760 + Math.sin(t * 2) * 6)})`);
            if (t > 2.0 && !s.once("spout")) s.emit("drop", 20, [400, 720]);
            if (t > 0.3 && t < 3.9 && Math.random() < 0.8) s.emit("smoke", 1, [x - Math.cos(rot * Math.PI / 180) * 190, y - Math.sin(rot * Math.PI / 180) * 190]);
            if (t > 0.3 && !s.once("ign")) { s.emit("smoke", 30, [470, 820]); s.shake(10); }
            if (t < 3.9) s.hero(x + Math.cos(rot * Math.PI / 180) * 20, y - 40, 0.72, rot + 90 * (t < 0.9 ? 1 : 1 - fly), 1, 1);
            else {
                const j = seg(t, 3.9, 4.7), up = Math.sin(j * Math.PI);
                s.hero(lerp(x, 1000, j), lerp(y - 40, 740, j) - up * 200, 1.1, j < 1 ? j * 540 : 0, 1, 1, j >= 1 && t < 4.9 ? 0.86 : 1);
                s.shadow(lerp(x, 1000, j), 742, 1.1 - up * 0.4, 0.3 * j);
            }
            if (t > 3.9 && !s.once("crash")) { s.emit("sandpuff", 50, [1060, 740]); s.emit("smoke", 20, [1060, 720]); s.shake(16); s.flash("#fff1c0", 0.4); s.emit("ring", 1, [1060, 742]); }
            if (Math.random() < 0.3) s.emit("ember", 1, [1120 + rnd(-40, 40), 260]);
            if (Math.random() < 0.15) s.emit("smoke", 1, [1120 + rnd(-30, 30), 240]);
            s.cam(t < 3.9 ? clamp(x, 560, 1040) : lerp(clamp(x, 560, 1040), 960, seg(t, 3.9, 5)), t < 3.9 ? clamp(y, 320, 560) : lerp(clamp(y, 320, 560), 560, seg(t, 3.9, 5)), 1.16, 0);
        }
    };

    // ---- Deep Space: the eruption launches it past the planets onto a little moon ----
    S.space = {
        T: 7.6,
        build: (D, R) => {
            let sp = `<rect x="-100" y="-100" width="${W + 200}" height="1100" fill="${D.lin("sp", [[0, "#02030f"], [1, "#160f45"]])}"/>`;
            sp += glow(D, "neb1", 300, 300, 420, "#7a2dff", 0.35) + glow(D, "neb2", 1300, 600, 380, "#ff2bd6", 0.25) + glow(D, "neb3", 900, 200, 300, "#2bf0ff", 0.18);
            for (let i = 0; i < 140; i++) sp += `<circle ${i % 14 === 0 ? `data-k="tw${i / 14}"` : ""} cx="${f(R() * W)}" cy="${f(R() * H)}" r="${f(0.8 + R() * 2.4)}" fill="#fff" opacity="${f(0.3 + R() * 0.7)}"/>`;
            sp += `<g data-k="ringed"><circle cx="1300" cy="220" r="96" fill="${D.lin("pl1", [[0, "#e6c4ff"], [1, "#9a6ad6"]])}" ${st(6)}/>${[0, 1, 2].map(i => `<path d="M1210 ${190 + i * 28} Q1300 ${200 + i * 28} 1392 ${190 + i * 28}" stroke="#c49bff" stroke-width="8" fill="none" opacity=".6"/>`).join("")}<ellipse cx="1300" cy="220" rx="170" ry="34" fill="none" stroke="${INK}" stroke-width="16" transform="rotate(-16 1300 220)"/><ellipse cx="1300" cy="220" rx="170" ry="34" fill="none" stroke="#ffd23f" stroke-width="9" transform="rotate(-16 1300 220)"/></g>`;
            sp += `<g data-k="giant"><circle cx="260" cy="620" r="150" fill="${D.lin("pl2", [[0, "#ffb27a"], [1, "#d9542a"]])}" ${st(6)}/><g data-k="bands">${[0, 1, 2, 3].map(i => `<path d="M${120 + i * 6} ${540 + i * 46} Q260 ${520 + i * 46} ${400 - i * 6} ${540 + i * 46}" stroke="#a83a1f" stroke-width="${10 - i * 2}" fill="none" opacity=".55"/>`).join("")}</g><ellipse cx="320" cy="660" rx="30" ry="18" fill="#a83a1f" opacity=".6"/></g>`;
            sp += `<g data-k="earth"><circle cx="1350" cy="780" r="120" fill="#2f8fe0" ${st(6)}/><path d="M1260 740 Q1300 700 1340 730 Q1360 770 1320 800 Q1280 790 1260 740Z M1380 700 Q1440 720 1430 770 Q1400 760 1380 700Z" fill="#3fbf5f"/>${glow(D, "atm", 1350, 780, 160, "#9fdcff", 0.35)}</g>`;
            sp += `<g data-k="astro">${Array.from({ length: 8 }, (_, i) => `<g data-k="as${i}"><path d="M-20 -10 L-6 -22 L16 -18 L24 0 L12 18 L-14 16Z" fill="#8a7a6a" ${st(3)}/><circle cx="2" cy="-4" r="4" fill="#6a5a4a"/></g>`).join("")}</g>`;
            sp += `<g data-k="comet"><path d="M0 0 L-300 -60 L-300 60Z" fill="${D.lin("ctail", [[0, "#bfe8ff", 0], [1, "#bfe8ff", 0.85]], 0, 0, 1, 0)}"/><circle r="16" fill="#fff"/></g>`;
            sp += `<g data-k="moon"><circle cx="800" cy="1560" r="760" fill="${D.lin("mn", [[0, "#e8ecf4"], [1, "#a9b0c4"]])}" ${st(7)}/>${[[600, 860, 44], [900, 900, 28], [1080, 940, 54], [700, 960, 22], [480, 920, 30]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.45}" fill="#b9bfd0" ${st(4)}/><ellipse cx="${x + 4}" cy="${y + 3}" rx="${r * 0.7}" ry="${r * 0.28}" fill="#9aa1b6"/>`).join("")}</g>`;
            const isky = `<rect x="-400" y="-400" width="${W + 800}" height="1700" fill="${D.lin("isky", [[0, "#ff7a3d"], [1, "#4d1610"]])}"/>`;
            let isle = `<path d="M-100 780 Q800 740 1700 780 L1700 1000 L-100 1000Z" fill="#1d6fb5" ${st(5)}/>` +
                `<path d="M380 780 L700 300 L900 300 L1220 780Z" fill="#6b3d2e" ${st(6)}/><path d="M700 300 H900 L880 350 L840 320 L800 360 L760 324 L720 350Z" fill="#ff7a1f" ${st(4)}/>` + glow(D, "erupt", 800, 300, 360, "#ffb21e", 0.9);
            return { back: `<g data-k="isky">${isky}</g><g data-k="space" opacity="0">${sp}</g><g data-k="isle">${isle}</g>`, front: "" };
        },
        frame(t, s) {
            const up = seg(t, 0.6, 3.4);
            s.set("isle", `translate(0 ${f(up * 1200)})`);
            s.setStyle("space", "opacity", seg(t, 0.9, 2.2));
            s.setStyle("isky", "opacity", 1 - seg(t, 0.9, 2.2));
            s.setStyle("isle", "opacity", 1 - seg(t, 2.0, 2.8));
            if (t > 0.6 && !s.once("erupt")) { s.emit("ember", 80, [800, 300]); s.emit("smoke", 40, [800, 300]); s.shake(22); s.flash("#ffd27a", 0.8); s.emit("ring", 2, [800, 300]); }
            for (let i = 0; i < 10; i++) s.setStyle("tw" + i, "opacity", 0.3 + 0.7 * Math.abs(Math.sin(t * 2 + i)));
            const warp = seg(t, 1.4, 2.0) * (1 - seg(t, 3.2, 3.8));
            if (warp > 0 && Math.random() < warp) s.emit("streak", 3, [rnd(0, W), -20]);
            s.set("ringed", `translate(0 ${f(lerp(-300, 60, seg(t, 1.5, 6.0)))})`);
            s.set("giant", `translate(0 ${f(lerp(-500, 40, seg(t, 1.2, 5.0)))}) `); s.set("bands", `translate(${f(Math.sin(t) * 6)} 0)`);
            s.set("earth", `translate(0 ${f(lerp(400, 0, seg(t, 3.0, 6.0, out)))})`);
            for (let i = 0; i < 8; i++) s.set("as" + i, `translate(${f(((i * 230 + t * (40 + i * 10)) % 1900) - 150)} ${f(120 + (i % 4) * 140 + Math.sin(t + i) * 20)}) rotate(${f(t * (30 + i * 20))}) scale(${f(0.8 + (i % 3) * 0.5)})`);
            s.set("comet", `translate(${f(lerp(-200, 1900, seg(t, 2.6, 5.4, k => k)))} ${f(lerp(120, 380, seg(t, 2.6, 5.4)))}) rotate(14)`);
            s.set("moon", `translate(0 ${f(lerp(600, 0, seg(t, 3.0, 4.4, out)))})`);
            s.tint("#02030f", seg(t, 0.8, 2.2) * 0.25);
            if (t < 4.0) s.hero(800 + Math.sin(t * 3) * 40, t < 0.6 ? 300 : lerp(300, 260, up), 1, t * 220, 1, t < 0.6 ? 0 : 1);
            else {
                // two slow, low-gravity bounces
                const b1 = seg(t, 4.0, 4.9, k => k), b2 = seg(t, 4.9, 5.6, k => k);
                const y = t < 4.9 ? lerp(260, 802, b1 * b1) : 802 - Math.sin(b2 * Math.PI) * 90;
                s.hero(800, y, 1.1, t < 4.9 ? lerp(4 * 220, 1080, b1) : 0, 1, 1, t > 5.6 && t < 5.8 ? 0.9 : 1);
                s.shadow(800, 806, 1.1, 0.25 * seg(t, 4.2, 4.9));
            }
            if (t > 4.9 && !s.once("land1")) { s.emit("dust", 26, [800, 802]); s.emit("ring", 1, [800, 806]); s.shake(6); }
            if (t > 5.6 && !s.once("land2")) s.emit("dust", 14, [800, 802]);
            s.cam(800, lerp(400, 470, seg(t, 3.6, 5)), lerp(1.1, 1.04, seg(t, 3.6, 5)), Math.sin(t * 0.7) * 1.5 * (1 - seg(t, 4.0, 5)));
        }
    };


    // ---- The Celestial Rift (the secret world, 2026-10-14; the user: "the void dying released the angel from their
    // prison (make that part of the transition animation)"): the Void collapses into a point and bursts; where it was
    // hangs a golden prison held by four chains, with the Cursed Angel inside. Cracks run over the bars, the chains
    // snap one by one, the cage shatters and the angel bursts out, tears the sky open and flies through. Your hero leaps
    // after it, the camera dives into the tear, and on the other side it floats down onto a ruined platform in the rift.
    S.rift = {
        T: 10.2,
        build: (D, R) => {
            D.raw(`<filter id="tv-rift-glw" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`);
            // the Void's space
            let sp = `<rect x="-400" y="-400" width="${W + 800}" height="${H + 800}" fill="${D.lin("vsp", [[0, "#02010a"], [1, "#140838"]])}"/>`;
            sp += glow(D, "vneb", 800, 450, 620, "#5a2dbf", 0.35);
            for (let i = 0; i < 150; i++) sp += `<circle ${i % 15 === 0 ? `data-k="vt${i / 15}"` : ""} cx="${f(R() * W)}" cy="${f(R() * H)}" r="${f(0.7 + R() * 2.2)}" fill="#fff" opacity="${f(0.3 + R() * 0.7)}"/>`;
            let vd = "";
            for (let i = 0; i < 7; i++) vd += `<ellipse cx="0" cy="0" rx="${300 - i * 34}" ry="${92 - i * 10}" fill="none" stroke="${["#b18cff", "#9b6bff", "#ff9fe8", "#7a3cff", "#c49bff", "#5a2dbf", "#ffe066"][i]}" stroke-width="${10 - i}" opacity="${f(0.75 - i * 0.06)}"/>`;
            for (let i = 0; i < 6; i++) vd += `<path d="M0 0 C${f(Math.cos(i) * 120)} ${f(Math.sin(i) * 60)} ${f(Math.cos(i + 1) * 220)} ${f(Math.sin(i + 1) * 110)} ${f(Math.cos(i + 1.6) * 300)} ${f(Math.sin(i + 1.6) * 130)}" fill="none" stroke="#2a1660" stroke-width="16" stroke-linecap="round"/>`;
            vd += `<circle r="78" fill="#000"/><circle r="84" fill="none" stroke="#ffe066" stroke-width="5" opacity=".8"/>`;
            // the prison: a gothic golden cage, four chains to the edges of the sky, the angel inside
            const bars = Array.from({ length: 9 }, (_, i) => { const x = -120 + i * 30; return `<path d="M${x} -150 Q${x * 0.6} -220 0 -240 M${x} -150 V170 Q${x * 0.7} 220 0 236" fill="none" stroke="#c9902f" stroke-width="7"/><path d="M${x} -150 V170" stroke="#ffe7a3" stroke-width="2"/>`; }).join("");
            const rings = [-150, -40, 70, 170].map(y => `<ellipse cy="${y}" rx="${y < 0 ? 122 : 124}" ry="18" fill="none" stroke="#e8c66a" stroke-width="8"/>`).join("");
            const chain = (i, x2, y2) => {
                const ang = Math.atan2(y2, x2), len = Math.hypot(x2, y2), n = Math.floor(len / 34);
                return `<g data-k="ch${i}"><g transform="rotate(${f(ang * 180 / Math.PI)})">${Array.from({ length: n }, (_, j) => `<ellipse cx="${30 + j * 34}" cy="0" rx="20" ry="9" fill="none" stroke="#e8c66a" stroke-width="6" ${j % 2 ? `transform="rotate(90 ${30 + j * 34} 0)"` : ""}/>`).join("")}</g></g>`;
            };
            const cracks = [["M-60 -120 L-30 -60 L-50 0 L-10 60", "c0"], ["M70 -130 L40 -70 L80 -20 L50 40 L90 110", "c1"], ["M-100 20 L-60 70 L-90 130", "c2"], ["M10 -200 L-10 -150 L20 -100", "c3"]]
                .map(([d, k]) => `<path data-k="${k}" d="${d}" fill="none" stroke="#fff6d8" stroke-width="5" stroke-linecap="round" stroke-dasharray="400" stroke-dashoffset="400" filter="url(#tv-rift-glw)"/>`).join("");
            const shards = Array.from({ length: 14 }, (_, i) => `<path data-k="sh${i}" d="M0 -18 L10 0 L0 22 L-9 2Z" fill="${i % 3 ? "#e8c66a" : "#fff3c4"}" stroke="#8a5a1a" stroke-width="2" opacity="0"/>`).join("");
            const prison = `<g data-k="cage">${glow(D, "pglow", 0, 0, 260, "#ffd06b", 0.5)}${chain(0, -820, -470)}${chain(1, 820, -470)}${chain(2, -820, 470)}${chain(3, 820, 470)}
                <g data-k="angel"><g transform="scale(.95) translate(-120 -130)">${typeof Bosses !== "undefined" ? Bosses.inner("rift") : ""}</g></g>
                <g data-k="bars">${bars}${rings}<path d="M-14 -246 L0 -270 L14 -246" fill="#e8c66a" stroke="#8a5a1a" stroke-width="3"/>${cracks}</g></g>
                <g data-k="shards">${shards}</g>`;
            // the tear it rips open
            // a ragged tear: wide in the middle, every edge point a little different
            const tearPts = (() => {
                const top = [], bot = [];
                for (let i = 0; i <= 26; i++) {
                    const u = i / 26, x = -540 + u * 1080, w = 92 * Math.pow(Math.sin(Math.PI * u), 0.8) * (0.55 + R() * 0.75) + 3;
                    top.push(`${f(x + (R() - 0.5) * 24)} ${f(-w - (i % 3 === 0 ? R() * 26 : 0))}`); bot.push(`${f(x + (R() - 0.5) * 24)} ${f(w * 0.85 + (i % 4 === 1 ? R() * 22 : 0))}`);
                }
                return "M" + top.join(" L") + " L" + bot.reverse().join(" L") + "Z";
            })();
            const tear = `<g data-k="tear" transform="translate(800 170) scale(1 0)"><path d="${tearPts}" fill="${D.lin("tin", [[0, "#ffb86b"], [0.48, "#fff6d8"], [0.52, "#ffe7a3"], [1, "#c46bff"]])}" stroke="#fff6d8" stroke-width="6" filter="url(#tv-rift-glw)"/>${glow(D, "tglow", 0, 0, 560, "#ffd06b", 0.55)}</g>`;
            // the other side: the Celestial Rift
            let rw = `<rect x="-400" y="-400" width="${W + 800}" height="${H + 800}" fill="${D.lin("rsk", [[0, "#0c0420"], [0.6, "#2a0f5a"], [1, "#4a1f7a"]])}"/>`;
            rw += glow(D, "rn1", 300, 260, 420, "#7a3cff", 0.35) + glow(D, "rn2", 1300, 360, 380, "#d65fa8", 0.22) + glow(D, "rn3", 900, 140, 300, "#ffd06b", 0.2);
            for (let i = 0; i < 90; i++) rw += `<circle cx="${f(R() * W)}" cy="${f(R() * H * 0.8)}" r="${f(0.8 + R() * 2)}" fill="#fff6d8" opacity="${f(0.3 + R() * 0.6)}"/>`;
            { let top = "", bot = ""; for (let i = 0; i <= 30; i++) { const x = -60 + i * 58, w = 10 + R() * 22; top += `${i ? "L" : "M"}${f(x)} ${f(110 - w + Math.sin(i * 0.7) * 26)} `; bot = `L${f(x + (R() - 0.5) * 20)} ${f(110 + w * 0.7 + Math.sin(i * 0.7) * 26)} ` + bot; }
              rw += `<path d="${top}${bot}Z" fill="#fff3c4" opacity=".92" filter="url(#tv-rift-glw)"/>`; }
            rw += glow(D, "rtg", 800, 110, 700, "#ffd06b", 0.18);
            // a giant fallen feather drifting far off, and two distant islands of ruin hanging on chains
            rw += `<g data-k="bigfeather" opacity=".35"><path d="M1250 200 Q1360 300 1330 520 Q1320 600 1280 640 Q1250 590 1250 520 Q1210 330 1250 200Z" fill="#1c1230" stroke="#9b6bff" stroke-width="4"/><path d="M1258 210 Q1290 420 1282 630" stroke="#9b6bff" stroke-width="3" fill="none"/></g>`;
            const island = (x, y, s2, k) => `<g data-k="${k}" transform="translate(${x} ${y}) scale(${s2})"><path d="M-160 0 L160 0 L110 60 L40 150 L-20 110 L-90 170 L-120 70Z" fill="#2a1f48" ${st(5)}/><path d="M-160 0 L160 0 L150 -16 L-150 -16Z" fill="${D.lin("isl" + k, [[0, "#efe6ff"], [1, "#b8a8d8"]])}" ${st(5)}/>
                ${[-110, -40, 60, 120].map((cx, j) => j === 2 ? `<path d="M${cx - 14} -16 V-120 L${cx} -136 L${cx + 14} -120 V-16Z" fill="#e6dcf6" ${st(4)}/>` : `<rect x="${cx - 12}" y="${-16 - 60 - j * 14}" width="24" height="${60 + j * 14}" fill="#e6dcf6" ${st(4)}/><rect x="${cx - 16}" y="${-16 - 60 - j * 14 - 10}" width="32" height="10" fill="#e8c66a" ${st(3)}/>`).join("")}
                <path d="M-120 -76 Q-30 -40 60 -100" fill="none" stroke="#e8c66a" stroke-width="4" stroke-dasharray="10 6"/>${[-60, 30].map(cx => `<path d="M${cx} 10 V-900" stroke="#c9902f" stroke-width="5" stroke-dasharray="14 8" opacity=".7"/>`).join("")}</g>`;
            rw += island(240, 340, 0.55, "isA") + island(1260, 300, 0.42, "isB");
            const column = (x, y, s, broken) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-60 0 L60 0 L36 54 L-6 40 L-40 66Z" fill="#3a2f5a" ${st(4)}/><rect x="-26" y="-180" width="52" height="180" fill="${D.lin("mar" + x, [[0, "#e6dcf6"], [1, "#a898c8"]], 0, 0, 1, 0)}" ${st(5)}/>${[-14, 0, 14].map(dx => `<path d="M${dx} -170 V-10" stroke="#8a7cae" stroke-width="2.5"/>`).join("")}<rect x="-36" y="-14" width="72" height="16" fill="#e8c66a" ${st(4)}/>${broken ? `<path d="M-26 -180 L-10 -206 L4 -186 L26 -214 L26 -180Z" fill="#e6dcf6" ${st(4)}/>` : `<rect x="-38" y="-198" width="76" height="20" fill="#e6dcf6" ${st(5)}/>`}</g>`;
            rw += `<g data-k="ruinsFar" opacity=".75">${column(220, 560, 0.7, true)}${column(1380, 520, 0.8, false)}${column(1100, 380, 0.45, true)}${column(460, 360, 0.4, false)}</g>`;
            rw += `<g data-k="plat"><path d="M500 780 L1100 780 L1040 860 L880 840 L760 900 L620 846 L540 870Z" fill="#3a2f5a" ${st(6)}/><rect x="500" y="752" width="600" height="32" rx="6" fill="${D.lin("plt", [[0, "#efe6ff"], [1, "#b8a8d8"]])}" ${st(6)}/>${Array.from({ length: 8 }, (_, i) => `<rect x="${514 + i * 72}" y="760" width="60" height="16" rx="3" fill="${i % 2 ? "#7a3cff" : "#e8c66a"}" opacity=".85"/>`).join("")}${column(560, 752, 0.55, true)}${column(1040, 752, 0.5, false)}</g>`;
            return { back: `<g data-k="voidsp">${sp}<g data-k="void" transform="translate(800 450)">${vd}</g></g><g data-k="prison" opacity="0" transform="translate(800 470)">${prison}</g>${tear}<g data-k="riftw" opacity="0">${rw}</g>`, front: "" };
        },
        frame(t, s) {
            // 1. the Void collapses and bursts
            const shrink = seg(t, 0.2, 1.8, inn);
            s.set("void", `translate(800 450) rotate(${f(t * 140)}) scale(${(1 - shrink * 0.98).toFixed(3)} ${((1 - shrink * 0.98) * (1 + shrink * 0.6)).toFixed(3)})`);
            for (let i = 0; i < 10; i++) s.setStyle("vt" + i, "opacity", 0.3 + 0.7 * Math.abs(Math.sin(t * 2 + i)));
            if (t > 1.8 && !s.once("burst")) { s.flash("#ffffff", 0.95); s.shake(20); s.emit("ring", 3, [800, 450]); s.emit("gold", 50, [800, 450]); s.emit("spark", 30, [800, 450]); }
            s.setStyle("void", "opacity", 1 - seg(t, 1.75, 1.9));
            // 2. the prison it was holding shut
            const appear = seg(t, 1.85, 2.5, back);
            s.setStyle("prison", "opacity", seg(t, 1.85, 2.2) * (1 - seg(t, 6.9, 7.3)));
            s.set("prison", `translate(800 ${f(470 + Math.sin(t * 1.4) * 6)}) scale(${(0.6 + 0.4 * appear).toFixed(3)})`);
            // cracks run over the bars, the chains snap one by one
            ["c0", "c1", "c2", "c3"].forEach((k, i) => s.setStyle(k, "strokeDashoffset", String(400 * (1 - seg(t, 2.6 + i * 0.3, 3.2 + i * 0.3)))));
            [3.0, 3.4, 3.75, 4.05].forEach((at, i) => {
                const d = Math.max(0, t - at), dir = [[-1, -1], [1, -1], [-1, 1], [1, 1]][i];
                s.set("ch" + i, d > 0 ? `translate(${f(dir[0] * d * 260)} ${f(dir[1] * d * 160 + d * d * 300)}) rotate(${f(dir[0] * d * 50)})` : "");
                s.setStyle("ch" + i, "opacity", 1 - seg(d, 0.2, 0.9));
                if (t > at && !s.once("snap" + i)) { s.emit("spark", 22, [800 + dir[0] * 130, 470 + dir[1] * 120]); s.shake(8); s.flash("#ffe7a3", 0.25); }
            });
            // 3. the cage shatters and the angel bursts out
            const free = Math.max(0, t - 4.4);
            s.setStyle("bars", "opacity", t < 4.4 ? 1 : 0);
            for (let i = 0; i < 14; i++) {
                const a = i / 14 * Math.PI * 2 + 0.3, v = 380 + (i % 4) * 90;
                s.set("sh" + i, `translate(${f(Math.cos(a) * v * free)} ${f(Math.sin(a) * v * free + free * free * 260)}) rotate(${f(free * (200 + i * 40))})`);
                s.setStyle("sh" + i, "opacity", free > 0 ? 1 - seg(free, 0.6, 1.4) : 0);
            }
            if (t > 4.4 && !s.once("shatter")) { s.flash("#fff6d8", 0.85); s.shake(26); s.emit("gold", 70, [800, 470]); s.emit("feather", 40, [800, 470]); s.emit("ring", 2, [800, 470]); }
            const rise = seg(t, 4.4, 5.3, out), dash = seg(t, 5.9, 6.6, inn);
            const ay = lerp(lerp(0, -150, rise), -300, dash), asc = (0.95 + rise * 0.35) * (1 - dash * 0.85);
            s.set("angel", `translate(0 ${f(ay)}) scale(${asc.toFixed(3)})`);
            s.setStyle("angel", "opacity", 1 - seg(t, 6.4, 6.7));
            // 4. it slashes the sky open
            const op = seg(t, 5.1, 5.8, back);
            s.set("tear", `translate(800 170) scale(${(0.4 + 0.6 * op).toFixed(3)} ${(op * (1 + Math.sin(t * 5) * 0.04)).toFixed(3)})`);
            s.setStyle("tear", "opacity", 1 - seg(t, 7.3, 7.5));
            if (t > 5.1 && !s.once("slash")) { s.flash("#ffd06b", 0.5); s.shake(12); s.emit("gold", 40, [800, 170]); }
            if (t > 5.2 && t < 7.2 && Math.random() < 0.5) s.emit("gold", 1, [800 + rnd(-480, 480), 170 + rnd(-40, 40)]);
            // 5. the hero leaps after it into the tear, and comes out on the other side
            if (t >= 6.1 && t < 7.3) {
                const k = seg(t, 6.1, 7.2);
                s.hero(lerp(260, 800, k), lerp(980, 190, out(k)) - Math.sin(k * Math.PI) * 140, lerp(1.1, 0.25, k), lerp(-10, 20, k), 1, 1);
            } else if (t < 6.1) s.hero(-400, 1300, 1, 0, 1, 0);
            const dive = seg(t, 6.8, 7.35, inn);
            if (t > 7.3 && !s.once("through")) { s.flash("#ffffff", 1); s.shake(10); }
            const there = t >= 7.35;
            s.setStyle("voidsp", "opacity", there ? 0 : 1);
            s.setStyle("riftw", "opacity", there ? 1 : 0);
            if (!there) s.cam(lerp(800, 800, dive), lerp(450, 180, dive), 1 + dive * 2.6, 0);
            else {
                // floating down onto the ruined platform, feathers drifting all around
                const fall = seg(t, 7.4, 9.0, k => k * k * (3 - 2 * k));
                const y = lerp(-120, 752, fall), sway = Math.sin(t * 3) * 30 * (1 - fall);
                s.hero(800 + sway, y, 1.05, Math.sin(t * 3) * 8 * (1 - fall), 1, 1, t > 9.0 && t < 9.2 ? 0.88 : 1);
                s.shadow(800, 756, 1.05, 0.3 * fall);
                if (t > 9.0 && !s.once("land")) { s.emit("dust", 26, [800, 752]); s.emit("ring", 1, [800, 756]); s.emit("gold", 20, [800, 740]); s.shake(6); }
                if (Math.random() < 0.3) s.emit("feather", 1, [rnd(0, W), -30]);
                if (Math.random() < 0.25) s.emit("gold", 1, [rnd(200, 1400), rnd(500, 880)]);
                s.set("plat", `translate(0 ${f(Math.sin(t * 1.2) * 6)})`);
                s.set("ruinsFar", `translate(${f(Math.sin(t * 0.4) * 10)} ${f(Math.sin(t * 0.7) * 8)})`);
                s.set("isA", `translate(240 ${f(340 + Math.sin(t * 0.8) * 10)}) scale(.55)`); s.set("isB", `translate(1260 ${f(300 + Math.sin(t * 0.6 + 1) * 8)}) scale(.42)`);
                s.set("bigfeather", `translate(${f(Math.sin(t * 0.5) * 30)} ${f((t - 7.4) * 40)}) rotate(${f(Math.sin(t * 0.7) * 8)} 1290 420)`);
                s.cam(800, lerp(420, 470, seg(t, 7.4, 9.4)), lerp(1.25, 1.05, seg(t, 7.4, 9.0)), Math.sin(t * 0.7) * 1.2);
            }
            s.tint("#14062e", seg(t, 0, 1.8) * 0.2 * (there ? 0 : 1));
        }
    };

    // ---------------------------------------------------------------------------------------------
    // Particles: one canvas over the scene, drawn in scene coordinates through the same camera as the SVG.
    // Glows are cached sprites (cheap to draw); fast things leave trails; leaves tumble, confetti flips,
    // snowflakes have arms, rain splashes when it hits the ground, fireworks rise and burst.
    // ---------------------------------------------------------------------------------------------
    const sprites = new Map();
    function glowSprite(c) {
        if (sprites.has(c)) return sprites.get(c);
        const cv = document.createElement("canvas"); cv.width = cv.height = 64;
        const g = cv.getContext("2d"), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        r.addColorStop(0, c); r.addColorStop(0.35, c + "88"); r.addColorStop(1, c + "00");
        g.fillStyle = r; g.fillRect(0, 0, 64, 64);
        sprites.set(c, cv);
        return cv;
    }
    const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    function particles(cv) {
        const ctx = cv.getContext("2d"), list = [];
        const P = (o) => list.push(Object.assign({ age: 0, rot: rnd(0, 6), vr: rnd(-6, 6), trail: null, floor: null }, o));
        const emit = (kind, n, [x, y]) => {
            for (let i = 0; i < n; i++) {
                const a = rnd(0, Math.PI * 2), sp = rnd(120, 420);
                const base = { kind, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, g: 500, life: rnd(0.8, 1.6), r: rnd(5, 11), c: "#fff" };
                const pal = list => list[Math.floor(rnd(0, list.length))];
                switch (kind) {
                    case "snow": P({ ...base, vx: rnd(-30, 30), vy: rnd(70, 150), g: 0, life: 8, r: rnd(3, 10), sw: rnd(0, 6) }); break;
                    case "wetsnow": P({ ...base, kind: "snow", vx: rnd(-50, 10), vy: rnd(260, 380), g: 0, life: rnd(1.6, 2.6), r: rnd(3, 8), sw: rnd(0, 6) }); break;
                    case "rain": P({ ...base, vx: -170, vy: rnd(1400, 1700), g: 0, life: 1.4, r: rnd(18, 32), c: "#bcd6ff", floor: rnd(800, 900) }); break;
                    case "leaf": P({ ...base, vx: n > 1 ? Math.cos(a) * sp : rnd(-60, 60), vy: n > 1 ? -rnd(300, 700) : rnd(70, 140), g: n > 1 ? 500 : 0, life: n > 1 ? rnd(1.6, 2.4) : 9, r: rnd(10, 17), c: pal(["#e88a3a", "#d4562e", "#f2b13a", "#c9642d"]), sw: rnd(0, 6) }); break;
                    case "leafpuff": P({ ...base, vx: rnd(-120, 120), vy: -rnd(80, 200), g: 400, life: 0.7, r: rnd(5, 8), c: pal(["#e88a3a", "#d4562e", "#f2b13a"]), kind: "leaf" }); break;
                    case "petal": P({ ...base, vy: -rnd(300, 600), vx: rnd(-260, 260), g: 380, life: rnd(1.4, 2.2), c: pal(["#ff7fb0", "#ffd23f", "#fff", "#b48cff", "#ff8a5c"]), sw: rnd(0, 6) }); break;
                    case "seed": P({ ...base, vx: rnd(30, 80), vy: -rnd(10, 40), g: -6, life: 6, r: rnd(5, 8), sw: rnd(0, 6) }); break;
                    case "bubble": P(n === 1 ? { ...base, vx: rnd(-20, 20), vy: rnd(-240, -120), g: 0, life: 6, r: rnd(5, 18), sw: rnd(0, 6) } : { ...base, g: -160, life: rnd(0.8, 1.4), r: rnd(4, 12), sw: rnd(0, 6) }); break;
                    case "confetti": case "pixel": case "sprinkle": P({ ...base, c: pal(["#ff5c7a", "#ffd23f", "#5fd4c4", "#7b8cff", "#ff8a5c", "#5ff2ff", "#ff2bd6", "#7dff6b"]), r: kind === "sprinkle" ? rnd(5, 8) : rnd(6, 11), vy: -rnd(200, 700), g: 700, life: rnd(1.2, 2.0), flip: rnd(0, 6) }); break;
                    case "candy": P({ ...base, vx: rnd(-40, 40), vy: rnd(80, 160), g: 0, life: 9, r: rnd(10, 14), c: pal(["#ff5c7a", "#7fd1ff", "#ffd23f", "#b48cff"]) }); break;
                    case "sparkle": P({ ...base, g: 0, life: rnd(0.6, 1.2), r: rnd(6, 14), c: pal(["#ffffff", "#ffd23f", "#bfe6ff", "#ffb3e6"]) }); break;
                    case "gold": P({ ...base, kind: "sparkle", g: n > 1 ? 120 : -30, life: rnd(0.8, 1.6), r: rnd(5, 12), c: pal(["#ffd06b", "#fff6d8", "#e8c66a"]) }); break;
                    case "feather": P({ ...base, vx: n > 1 ? Math.cos(a) * sp : rnd(-50, 50), vy: n > 1 ? Math.sin(a) * sp - 160 : rnd(50, 110), g: n > 1 ? 220 : 0, life: n > 1 ? rnd(1.6, 2.6) : 9, r: rnd(10, 16), c: pal(["#ffffff", "#ffffff", "#1c1230"]), sw: rnd(0, 6) }); break;
                    case "graphite": P({ ...base, vx: rnd(-60, 60), vy: rnd(-40, 40), g: 300, life: 0.6, r: rnd(1.5, 3), c: "#5a5560" }); break;
                    case "paint": P({ ...base, vx: rnd(-300, 300), vy: rnd(-500, 100), g: 200, life: rnd(0.8, 1.4), r: rnd(10, 22), c: pal(["#ff7f98", "#ffd23f", "#7fd1ff", "#8be38b", "#c49bff"]) }); break;
                    case "drop": P({ ...base, vy: -rnd(300, 800), vx: rnd(-320, 320), g: 1500, r: rnd(5, 11), c: "#cfeaff", life: rnd(0.8, 1.3) }); break;
                    case "trail": P({ ...base, vx: rnd(-30, 30), vy: rnd(-20, 20), g: 0, life: 0.9, r: rnd(6, 14), c: "#ffffff" }); break;
                    case "wind": P({ ...base, vx: rnd(800, 1100), vy: rnd(-20, 20), g: 0, life: 2.2, r: rnd(90, 180), c: "#ffffff" }); break;
                    case "sand": P({ ...base, vx: rnd(300, 500), vy: rnd(-20, 20), g: 0, life: 4, r: rnd(1.5, 3), c: "#f2c47a" }); break;
                    case "sandpuff": case "dust": case "snowpuff": case "cloudpuff":
                        P({ ...base, kind: "puff", vx: rnd(-260, 260), vy: -rnd(40, 240), g: kind === "dust" ? 40 : 300, life: kind === "dust" ? rnd(1.6, 2.4) : rnd(0.7, 1.3), r: rnd(12, 26),
                            c: { sandpuff: "#e8c27a", dust: "#c9cdd8", snowpuff: "#ffffff", cloudpuff: "#ffffff" }[kind] }); break;
                    case "heat": P({ ...base, vx: 0, vy: -60, g: 0, life: 1.6, r: rnd(20, 40) }); break;
                    case "smoke": P({ ...base, vx: rnd(-90, 90), vy: -rnd(40, 160), g: -30, life: rnd(1.2, 2.4), r: rnd(18, 40), c: pal(["#8a8f9e", "#a6abb8", "#6f7482"]) }); break;
                    case "steam": P({ ...base, vx: rnd(-20, 20), vy: -rnd(120, 200), g: -20, life: rnd(1, 1.6), r: rnd(14, 24), c: "#e8ecf2", kind: "smoke" }); break;
                    case "cotton": P({ ...base, kind: "puff", vx: n > 1 ? rnd(-220, 220) : -rnd(60, 160), vy: -rnd(60, 180), g: -30, life: rnd(1.2, 2), r: rnd(16, 30), c: pal(["#ffd1e8", "#ffb3dc", "#fff0f7"]) }); break;
                    case "ember": P({ ...base, vy: -rnd(300, 900), vx: rnd(-320, 320), g: 600, r: rnd(3, 7), c: pal(["#ffb21e", "#ff5a1f", "#ffe066"]), trail: [] }); break;
                    case "spark": P({ ...base, vy: -rnd(200, 600), g: 900, life: rnd(0.4, 0.9), r: rnd(2, 4), c: pal(["#ffe066", "#fff3a0", "#ffb21e"]), trail: [] }); break;
                    case "ghost": P({ ...base, vx: rnd(-20, 20), vy: -rnd(60, 120), g: 0, life: 5, r: rnd(16, 26), c: "#d6ccff", sw: rnd(0, 6) }); break;
                    case "mote": P({ ...base, vx: rnd(-10, 10), vy: rnd(-14, 14), g: 0, life: rnd(2, 4), r: rnd(1.5, 3.5), c: "#fff6d6" }); break;
                    case "streak": P({ ...base, vx: 0, vy: rnd(1600, 2600), g: 0, life: 0.8, r: rnd(50, 120) }); break;
                    case "letter": P({ ...base, vx: rnd(-200, 200), vy: -rnd(900, 1400), g: 0, life: 1.2, r: rnd(20, 44), ch: LETTERS[Math.floor(rnd(0, 26))], c: pal(["#5a5560", "#3b5bdb", "#7a4fd6"]) }); break;
                    case "balloon": P({ ...base, vx: rnd(-20, 20), vy: -rnd(60, 110), g: 0, life: 10, r: rnd(16, 22), c: pal(["#ff5c7a", "#ffd23f", "#5fd4c4", "#b48cff"]), sw: rnd(0, 6) }); break;
                    case "ring": P({ ...base, vx: 0, vy: 0, g: 0, life: 0.7 + i * 0.2, r: 10, grow: 220 + i * 120, c: "#ffffff" }); break;
                    case "ripple": P({ ...base, kind: "ring", vx: 0, vy: 0, g: 0, life: 0.7, r: 3, grow: rnd(30, 60), c: "#bcd6ff" }); break;
                    case "firework": P({ ...base, kind: "rocket", vx: rnd(-40, 40), vy: -rnd(700, 900), g: 300, life: rnd(0.9, 1.3), r: 4, c: pal(["#ff5c7a", "#ffd23f", "#5ff2ff", "#b48cff", "#7dff6b"]), trail: [], y: y }); break;
                    default: P(base);
                }
            }
        };
        const burst = p => {
            const n = 44, c2 = ["#ffffff", p.c][Math.floor(rnd(0, 2))];
            for (let j = 0; j < n; j++) { const b = (j / n) * Math.PI * 2, v = rnd(180, 340); list.push({ kind: "spark", x: p.x, y: p.y, vx: Math.cos(b) * v, vy: Math.sin(b) * v, g: 160, life: rnd(1, 1.5), age: 0, r: 2.6, rot: 0, vr: 0, c: j % 3 ? p.c : c2, trail: [] }); }
            list.push({ kind: "flare", x: p.x, y: p.y, vx: 0, vy: 0, g: 0, life: 0.4, age: 0, r: 120, rot: 0, vr: 0, c: p.c });
        };
        const draw = (dt, M) => {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, cv.width, cv.height);
            ctx.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]);
            for (let i = list.length - 1; i >= 0; i--) {
                const p = list[i];
                p.age += dt;
                if (p.age > p.life) { if (p.kind === "rocket") burst(p); list.splice(i, 1); continue; }
                p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
                if (p.sw != null) p.x += Math.sin(p.age * 2.4 + p.sw) * 40 * dt;
                if (p.trail) { p.trail.push(p.x, p.y); if (p.trail.length > 16) p.trail.splice(0, 2); }
                if (p.floor != null && p.y > p.floor) {        // rain hits the ground: a little splash
                    list.splice(i, 1);
                    for (let j = 0; j < 3; j++) list.push({ kind: "drop", x: p.x, y: p.floor, vx: rnd(-90, 90), vy: -rnd(80, 200), g: 900, life: 0.35, age: 0, r: 2.2, rot: 0, vr: 0, c: "#cfe2ff" });
                    continue;
                }
                const k = p.age / p.life, a = k < 0.12 ? k / 0.12 : 1 - Math.max(0, k - 0.6) / 0.4;
                ctx.save();
                ctx.globalAlpha = Math.max(0, a);
                if (p.trail && p.trail.length > 4) {
                    ctx.strokeStyle = p.c; ctx.lineCap = "round"; ctx.lineWidth = p.r * 1.2; ctx.globalAlpha = Math.max(0, a) * 0.45;
                    ctx.beginPath(); for (let j = 0; j < p.trail.length; j += 2) (j ? ctx.lineTo : ctx.moveTo).call(ctx, p.trail[j], p.trail[j + 1]); ctx.stroke();
                    ctx.globalAlpha = Math.max(0, a);
                }
                ctx.translate(p.x, p.y);
                switch (p.kind) {
                    case "snow":
                        if (p.r > 6) {
                            ctx.rotate(p.rot); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.beginPath();
                            for (let j = 0; j < 6; j++) { const b = j * Math.PI / 3, cx = Math.cos(b), sy = Math.sin(b); ctx.moveTo(0, 0); ctx.lineTo(cx * p.r, sy * p.r); ctx.moveTo(cx * p.r * 0.55, sy * p.r * 0.55); ctx.lineTo(Math.cos(b + 0.6) * p.r * 0.8, Math.sin(b + 0.6) * p.r * 0.8); }
                            ctx.stroke();
                        } else { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, 0, p.r * 0.6, 0, 7); ctx.fill(); }
                        break;
                    case "rain": ctx.strokeStyle = p.c; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(p.vx * 0.02, -p.r); ctx.stroke(); break;
                    case "leaf":
                        ctx.rotate(p.rot); ctx.scale(Math.cos(p.age * 5 + p.r), 1);
                        ctx.fillStyle = p.c; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
                        ctx.beginPath(); ctx.moveTo(-p.r, 0); ctx.quadraticCurveTo(0, -p.r * 0.75, p.r, 0); ctx.quadraticCurveTo(0, p.r * 0.75, -p.r, 0); ctx.fill(); ctx.stroke();
                        ctx.strokeStyle = shade(p.c, -0.3); ctx.beginPath(); ctx.moveTo(-p.r, 0); ctx.lineTo(p.r, 0); ctx.stroke(); break;
                    case "petal": case "seed":
                        ctx.rotate(p.rot);
                        if (p.kind === "seed") { ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 1.2; ctx.beginPath(); for (let j = 0; j < 8; j++) { const b = j * Math.PI / 4; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(b) * p.r, Math.sin(b) * p.r); } ctx.stroke(); ctx.fillStyle = "#c9b48a"; ctx.beginPath(); ctx.arc(0, 0, 1.6, 0, 7); ctx.fill(); }
                        else { ctx.scale(Math.cos(p.age * 4 + p.r), 1); ctx.fillStyle = p.c; ctx.beginPath(); ctx.moveTo(0, -p.r); ctx.quadraticCurveTo(p.r * 0.8, 0, 0, p.r); ctx.quadraticCurveTo(-p.r * 0.8, 0, 0, -p.r); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,.45)"; ctx.beginPath(); ctx.ellipse(-p.r * 0.15, -p.r * 0.3, p.r * 0.18, p.r * 0.4, 0, 0, 7); ctx.fill(); }
                        break;
                    case "confetti": case "sprinkle": case "pixel":
                        ctx.rotate(p.rot);
                        if (p.kind === "pixel") { ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 2); ctx.fillStyle = "rgba(255,255,255,.45)"; ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 0.5); ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fillRect(-p.r, p.r * 0.5, p.r * 2, p.r * 0.5); }
                        else if (p.kind === "sprinkle") { ctx.fillStyle = p.c; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-p.r, -2.5, p.r * 2, 5, 2.5) : ctx.rect(-p.r, -2.5, p.r * 2, 5); ctx.fill(); }
                        else { const fl = Math.cos(p.age * 9 + p.flip); ctx.scale(1, fl); ctx.fillStyle = fl > 0 ? p.c : shade(p.c, -0.3); ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r); }
                        break;
                    case "feather":
                        ctx.rotate(Math.sin(p.age * 2.2 + p.r) * 0.9 + p.rot * 0.2); ctx.scale(Math.cos(p.age * 3 + p.r) * 0.4 + 0.6, 1);
                        ctx.fillStyle = p.c; ctx.strokeStyle = p.c === "#1c1230" ? "#9b6bff" : "#b8a080"; ctx.lineWidth = 1.4;
                        ctx.beginPath(); ctx.moveTo(0, -p.r); ctx.quadraticCurveTo(p.r * 0.55, -p.r * 0.3, p.r * 0.28, p.r * 0.8); ctx.lineTo(0, p.r); ctx.lineTo(-p.r * 0.28, p.r * 0.8); ctx.quadraticCurveTo(-p.r * 0.55, -p.r * 0.3, 0, -p.r); ctx.fill(); ctx.stroke();
                        ctx.beginPath(); ctx.moveTo(0, -p.r * 0.9); ctx.lineTo(0, p.r * 1.2); ctx.stroke(); break;
                    case "candy":
                        ctx.rotate(p.rot); ctx.fillStyle = p.c; ctx.strokeStyle = INK; ctx.lineWidth = 2;
                        ctx.beginPath(); ctx.arc(0, 0, p.r * 0.7, 0, 7); ctx.fill(); ctx.stroke();
                        ctx.beginPath(); ctx.moveTo(-p.r * 0.7, 0); ctx.lineTo(-p.r * 1.3, -p.r * 0.5); ctx.lineTo(-p.r * 1.3, p.r * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
                        ctx.beginPath(); ctx.moveTo(p.r * 0.7, 0); ctx.lineTo(p.r * 1.3, -p.r * 0.5); ctx.lineTo(p.r * 1.3, p.r * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
                    case "bubble": {
                        const r = p.r * (1 + Math.sin(p.age * 6) * 0.04);
                        ctx.strokeStyle = "rgba(234,248,255,.9)"; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke();
                        ctx.fillStyle = "rgba(191,232,255,.15)"; ctx.fill();
                        ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.beginPath(); ctx.ellipse(-r * 0.35, -r * 0.38, r * 0.28, r * 0.16, -0.6, 0, 7); ctx.fill(); break;
                    }
                    case "sparkle": case "flare": case "mote": {
                        const s = p.kind === "flare" ? p.r * (1 - k * 0.5) : p.r * 3;
                        ctx.globalCompositeOperation = "lighter";
                        ctx.drawImage(glowSprite(p.c.length === 7 ? p.c : "#ffffff"), -s, -s, s * 2, s * 2);
                        if (p.kind === "sparkle") { ctx.rotate(p.rot * 0.3); ctx.fillStyle = "#fff"; ctx.beginPath(); for (let j = 0; j < 8; j++) { const b = j * Math.PI / 4, q = j % 2 ? p.r * 0.25 : p.r * 1.3; ctx.lineTo(Math.cos(b) * q, Math.sin(b) * q); } ctx.fill(); }
                        break;
                    }
                    case "spark": case "ember": case "rocket": {
                        ctx.globalCompositeOperation = "lighter";
                        ctx.drawImage(glowSprite(p.c), -p.r * 4, -p.r * 4, p.r * 8, p.r * 8);
                        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, 0, p.r * 0.6, 0, 7); ctx.fill(); break;
                    }
                    case "graphite": case "trail": ctx.fillStyle = p.c; ctx.globalAlpha *= p.kind === "trail" ? 0.6 : 1; ctx.beginPath(); ctx.arc(0, 0, p.r * (p.kind === "trail" ? 1 + k : 1), 0, 7); ctx.fill(); break;
                    case "paint": ctx.fillStyle = p.c; ctx.globalAlpha *= 0.75; ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.7, p.rot, 0, 7); ctx.fill(); break;
                    case "drop": ctx.fillStyle = p.c; ctx.rotate(Math.atan2(p.vy, p.vx) - Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, -p.r * 1.6); ctx.quadraticCurveTo(p.r, 0, 0, p.r); ctx.quadraticCurveTo(-p.r, 0, 0, -p.r * 1.6); ctx.fill(); break;
                    case "puff": {
                        const r = p.r * (1 + k * 1.2), gr = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
                        gr.addColorStop(0, p.c); gr.addColorStop(1, p.c + "00");
                        ctx.fillStyle = gr; ctx.globalAlpha *= 0.85; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); break;
                    }
                    case "smoke": {
                        const r = p.r * (1 + k * 1.4), gr = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
                        gr.addColorStop(0, p.c + "cc"); gr.addColorStop(0.7, p.c + "66"); gr.addColorStop(1, p.c + "00");
                        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); break;
                    }
                    case "wind": ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(p.r * 0.6, -16, p.r, 0); ctx.quadraticCurveTo(p.r * 1.1, 10, p.r * 0.95, 18); ctx.stroke(); break;
                    case "sand": ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r * 0.5, p.r * 4, p.r); break;
                    case "heat": ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(8, -p.r * 0.3, -8, -p.r * 0.6, 0, -p.r); ctx.stroke(); break;
                    case "ghost":
                        ctx.fillStyle = p.c; ctx.globalAlpha *= 0.6; ctx.beginPath(); ctx.arc(0, 0, p.r, Math.PI, 0); ctx.lineTo(p.r, p.r * 1.2); ctx.lineTo(p.r * 0.5, p.r * 0.9); ctx.lineTo(0, p.r * 1.2); ctx.lineTo(-p.r * 0.5, p.r * 0.9); ctx.lineTo(-p.r, p.r * 1.2); ctx.fill();
                        ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-p.r * 0.35, -p.r * 0.1, p.r * 0.15, 0, 7); ctx.arc(p.r * 0.35, -p.r * 0.1, p.r * 0.15, 0, 7); ctx.fill(); break;
                    case "streak": ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -p.r); ctx.stroke(); break;
                    case "letter": ctx.rotate(p.rot * 0.4); ctx.fillStyle = p.c; ctx.font = `900 ${Math.round(p.r)}px Georgia, serif`; ctx.textAlign = "center"; ctx.fillText(p.ch, 0, p.r * 0.35); break;
                    case "balloon":
                        ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, p.r * 1.2); ctx.quadraticCurveTo(6, p.r * 2, 0, p.r * 3); ctx.stroke();
                        ctx.fillStyle = p.c; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 1.2, 0, 0, 7); ctx.fill(); ctx.stroke();
                        ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.beginPath(); ctx.ellipse(-p.r * 0.35, -p.r * 0.4, p.r * 0.2, p.r * 0.32, -0.4, 0, 7); ctx.fill(); break;
                    case "ring": {
                        const r = p.r + p.grow * out(k);
                        ctx.strokeStyle = p.c; ctx.lineWidth = 6 * (1 - k) + 1; ctx.globalAlpha *= 0.8; ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.32, 0, 0, 7); ctx.stroke(); break;
                    }
                    default: ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, 7); ctx.fill();
                }
                ctx.restore();
            }
        };
        return { emit, draw };
    }

    // ---------------------------------------------------------------------------------------------
    // Playing a scene
    // ---------------------------------------------------------------------------------------------
    async function arrive(c, from, to, look, { index = WORLDS.indexOf(to), total = 15 } = {}) {
        const scene = S[to] || S.paper, D = Defs("tv-" + to), built = scene.build(D, seeded(WORLDS.indexOf(to) + 3));
        const [top, bottom] = SKY[to] || SKY.paper, [ftop, fbottom] = SKY[from] || SKY[to] || SKY.paper;
        const w = typeof Worlds !== "undefined" && Worlds.byId[to];
        const el = U.el("div", { class: "tv-stage", "aria-hidden": "true" });
        el.innerHTML = `<svg class="tv-svg hero-art" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
            <defs><linearGradient id="tv-from" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ftop}"/><stop offset="1" stop-color="${fbottom}"/></linearGradient>
            <linearGradient id="tv-to" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>
            <radialGradient id="tv-vig" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient>${D.list.join("")}</defs>
            <rect x="-400" y="-400" width="${W + 800}" height="${H + 800}" fill="url(#tv-from)"/><rect data-k="sky" x="-400" y="-400" width="${W + 800}" height="${H + 800}" fill="url(#tv-to)" opacity="0"/>
            <g data-k="cam">${built.back}${built.under || ""}${SHADOW}<g data-k="hero"><g data-k="heroIn">${Hero.inner(look)}</g></g>${built.front || ""}</g>
            <rect data-k="tint" width="${W}" height="${H}" fill="#000" opacity="0"/><rect width="${W}" height="${H}" fill="url(#tv-vig)"/><rect data-k="flash" width="${W}" height="${H}" fill="#fff" opacity="0"/></svg>
            <canvas class="tv-fx"></canvas>
            <div class="tv-card"><small>${to === "rift" ? "Secret World" : `World ${index + 1} of ${total}`}</small><b>${U.esc(w ? w.name : to)}</b></div>
            <p class="tv-skip">Click to skip</p>`;
        document.getElementById("overlay").appendChild(el);
        const cv = el.querySelector("canvas"), card = el.querySelector(".tv-card");
        const k = {};
        el.querySelectorAll("[data-k]").forEach(n => { if (n.dataset.k) k[n.dataset.k] = n; });
        const fx = particles(cv);
        const seen = new Set();
        const cam = { x: 800, y: 450, z: 1, r: 0 };
        let shake = 0, flash = 0, flashC = "#fff";
        let sketched = null;
        const s = {
            set: (name, tr) => { if (k[name]) k[name].setAttribute("transform", tr); },
            setStyle: (name, prop, v) => { if (k[name]) k[name].style[prop] = String(v); },
            attr: (name, a, v) => { if (k[name]) k[name].setAttribute(a, String(v)); },
            hero: (x, y, sc = 1, rot = 0, flip = 1, alpha = 1, sq = 1) => {
                k.hero.setAttribute("transform", `translate(${f(x)} ${f(y)}) rotate(${f(rot)}) scale(${(sc * flip * (2 - sq)).toFixed(3)} ${(sc * sq).toFixed(3)}) translate(-120 -216)`);
                k.hero.style.opacity = String(alpha);
            },
            shadow: (x, y, size = 1, a = 0.25) => { k.hshadow.setAttribute("transform", `translate(${f(x)} ${f(y)}) scale(${Math.max(0.05, size).toFixed(3)})`); k.hshadow.style.opacity = String(Math.max(0, a)); },
            cam: (x, y, z = 1, r = 0) => Object.assign(cam, { x, y, z, r }),
            shake: px => { shake = Math.max(shake, px); },
            flash: (col, a) => { flashC = col; flash = Math.max(flash, a); },
            emit: (kind, n, at) => fx.emit(kind, n, at),
            once: key => (seen.has(key) ? true : (seen.add(key), false)),
            tint: (color, a) => { k.tint.setAttribute("fill", color); k.tint.style.opacity = String(a); },
            sketch: (draw, fill) => {
                if (!sketched) {
                    sketched = [...k.heroIn.querySelectorAll("path, circle, ellipse, rect")];
                    for (const n of sketched) n.style.strokeDasharray = "1600";
                }
                for (const n of sketched) { n.style.strokeDashoffset = String(1600 * (1 - draw)); n.style.fillOpacity = String(fill); }
            }
        };
        sizeCanvas();
        function sizeCanvas() { const d = Math.min(2, devicePixelRatio || 1); cv.width = Math.round(innerWidth * d); cv.height = Math.round(innerHeight * d); }
        addEventListener("resize", sizeCanvas);
        c.cleanup(() => { removeEventListener("resize", sizeCanvas); el.classList.remove("in"); setTimeout(() => el.remove(), 400); });
        requestAnimationFrame(() => el.classList.add("in"));
        // a soft rising chime when the new world appears, in the world's key
        const pitch = { paper: 0, garden: 2, squirrel: -2, candy: 5, ocean: -3, snow: 7, rain: -5, sky: 4, desert: -1, carnival: 3, arcade: 6, library: -6, robot: -4, volcano: -7, space: -8, rift: 9 }[to] || 0;
        c.later(() => [60, 64, 67, 72].forEach((n, i) => Sound.tone({ t: i * 0.13, f: Sound.midi(n + pitch), type: "sine", d: 0.9, v: 0.05 })), (scene.T - 2.2) * 1000);
        const T = scene.T, t0 = performance.now();
        // the camera, applied to the SVG and (as a matrix) to the particle canvas
        const apply = () => {
            const sx = shake ? rnd(-shake, shake) : 0, sy = shake ? rnd(-shake, shake) : 0;
            k.cam.setAttribute("transform", `translate(800 450) rotate(${f(cam.r)}) scale(${cam.z.toFixed(4)}) translate(${f(-cam.x + sx)} ${f(-cam.y + sy)})`);
            const d = cv.width / innerWidth, sc = Math.max(innerWidth / W, innerHeight / H) * d, ox = (cv.width - W * sc) / 2, oy = (cv.height - H * sc) / 2;
            const m = new DOMMatrix().translate(ox, oy).scale(sc).translate(800, 450).rotate(cam.r).scale(cam.z).translate(-cam.x + sx, -cam.y + sy);
            return [m.a, m.b, m.c, m.d, m.e, m.f];
        };
        // reduce motion: just the end of the scene and the world's name, held for a moment
        if (U.motion() === "still") {
            k.sky.style.opacity = "1";
            scene.frame(T - 1.6, s);
            apply();
            card.classList.add("in");
            await c.wait(2600);
            return;
        }
        let last = t0;
        await new Promise(done => {
            const tick = now => {
                if (c.skipped || !el.isConnected) return done();
                const t = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000);
                last = now;
                k.sky.style.opacity = String(seg(t, 0.2, 2.6));
                try { scene.frame(Math.min(t, T), s); } catch (err) { console.error("travel", err); return done(); }
                const M = apply();
                shake *= Math.pow(0.02, dt);
                if (shake < 0.3) shake = 0;
                k.flash.setAttribute("fill", flashC); k.flash.style.opacity = String(flash);
                flash *= Math.pow(0.004, dt);
                fx.draw(dt, M);
                card.classList.toggle("in", t > T - 2.2 && t < T - 0.25);
                if (t >= T) return done();
                requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        });
    }

    return { arrive, WORLDS };
})();
