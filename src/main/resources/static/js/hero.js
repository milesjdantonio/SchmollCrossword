// The player's own hero (the user, 2026-10-11: "make the user make their player at the start, in the same way of how
// the bosses are formatted; they can edit their character, their character travels between levels, it shows their
// character vs boss in the boss menus"). Drawn like the bosses (bosses.js): an SVG character on a 240 x 240 canvas,
// ink outlines, gradients, and the same animated parts (bz-float, bz-eyes, bz-sway), built from parts you pick.
//
//   Hero.svg(look, cls, { still })   an <svg> of the hero (each copy gets its own gradient ids)
//   Hero.inner(look, { still })      the same without the <svg> wrapper, to place inside another SVG (the map)
//   Hero.maker({ look, first })      the editor: resolves with the new look (or null if it was closed)
//   Hero.random()                    a random look; Hero.fix(look) fills in anything missing
//
// look = { name, body, color, eyes, mouth, face, top, topColor, outfit, outfitColor, item } (numbers pick a part)
// New parts are only ever added at the END of a list, so a saved hero keeps the parts it was made with.
const Hero = (() => {
    const INK = "#2b2233";
    let counter = 0;
    const st = (w = 4) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
    const f1 = v => (Math.round(v * 10) / 10).toString();

    // ---- the parts you can pick ----
    // (more of everything since 2026-10-13, the user: "add more options for everything for the hero")
    const COLORS = ["#ffb84d", "#ff7f98", "#7fd1ff", "#8be38b", "#c49bff", "#ffd84d", "#ff8a5c", "#5fd4c4", "#f5efe3", "#a6b3c6", "#d6a77a", "#7b8cff",
        "#ffcf9e", "#b07a52", "#7a5236", "#ff5f5f", "#3fa66b", "#e0e0ff", "#2f6fb5", "#6b4fa0", "#b8f0a0"];
    const ACCENTS = ["#e5484d", "#ff9f1c", "#ffd23f", "#3fbf5f", "#2f8fe0", "#7a4fd6", "#ff6fb5", "#ffffff", "#5a5f6e", "#2b2233",
        "#7a4a2a", "#f2c56b", "#c8572a", "#00a6a6", "#9be15d", "#ff4d94", "#8b5cf6"];
    // (fruit bodies since 2026-10-13, the user: "add more fruits... like strawberry, watermelon slice": they wear their
    // own colours, so the Colour row hides for them)
    const BODIES = ["Round", "Bean", "Block", "Pear", "Tall", "Blob", "Strawberry", "Watermelon Slice", "Apple", "Orange", "Lemon", "Peach"];
    const EYES = ["Dots", "Big", "Happy", "Starry", "Glasses", "Sleepy", "Wink", "Shades", "Determined", "Hearts", "Dizzy", "One Eye"];
    const MOUTHS = ["Smile", "Grin", "Surprised", "Cheeky", "Cat", "Fangs", "Tongue", "Big Smile", "Whistle", "Flat", "Buck Teeth", "Worried", "Zigzag"];
    const FACES = ["Blush", "Nothing", "Freckles", "Mustache", "Bandage", "Star Cheeks", "Whiskers", "Sweat Drop", "Face Paint"];
    const TOPS = ["Nothing", "Tuft", "Beanie", "Cap", "Crown", "Bow", "Wizard Hat", "Headphones", "Sprout", "Spiky", "Top Hat", "Pirate Hat", "Flower", "Horns", "Halo", "Bandana", "Cowboy Hat", "Chef Hat", "Viking Helmet"];
    const OUTFITS = ["Nothing", "Scarf", "Cape", "Bow Tie", "Backpack", "Medal", "Belt", "Wings", "Overalls", "Necklace", "Tie", "Apron", "Sash"];
    const ITEMS = ["Nothing", "Pencil", "Book", "Star Wand", "Lantern", "Magnifier", "Sword", "Shield", "Balloon", "Umbrella", "Key", "Flag", "Ice Cream", "Fishing Rod", "Trophy"];
    const PARTS = { body: BODIES, eyes: EYES, mouth: MOUTHS, face: FACES, top: TOPS, outfit: OUTFITS, item: ITEMS };

    const pick = a => Math.floor(Math.random() * a.length);
    function random(name = "Hero") {
        return { name, body: pick(BODIES), color: COLORS[pick(COLORS)], eyes: pick(EYES), mouth: pick(MOUTHS), face: pick(FACES), top: pick(TOPS), topColor: ACCENTS[pick(ACCENTS)],
            outfit: pick(OUTFITS), outfitColor: ACCENTS[pick(ACCENTS)], item: 1 + pick(ITEMS.slice(1)) };
    }
    const DEFAULT = { name: "Hero", body: 0, color: COLORS[0], eyes: 1, mouth: 0, face: 0, top: 1, topColor: ACCENTS[0], outfit: 1, outfitColor: ACCENTS[4], item: 1 };
    const hex = c => /^#[0-9a-f]{6}$/i.test(c || "");
    // a saved look, made safe to draw: unknown parts and colours fall back to the default (it's from localStorage)
    function fix(look) {
        const l = { ...DEFAULT, ...(look && typeof look === "object" ? look : {}) };
        for (const [k, list] of Object.entries(PARTS)) l[k] = Number.isInteger(l[k]) && l[k] >= 0 && l[k] < list.length ? l[k] : DEFAULT[k];
        for (const k of ["color", "topColor", "outfitColor"]) if (!hex(l[k])) l[k] = DEFAULT[k];
        l.name = cleanName(l.name) || "Hero";
        return l;
    }
    // names: letters, spaces, ' and -, 12 at most (shown with textContent everywhere; this is just to keep it tidy)
    const cleanName = n => String(n || "").replace(/[^A-Za-zÀ-ɏ '\-]/g, "").replace(/\s+/g, " ").trim().slice(0, 12);

    // colour helpers: lighter and darker shades of a colour
    function shade(c, k) {
        const n = parseInt(c.slice(1), 16), ch = [n >> 16, (n >> 8) & 255, n & 255];
        const out = ch.map(v => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)));
        return "#" + out.map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");
    }

    // ---- the body shapes: the outline, where the head's top is, where the eyes and mouth sit ----
    // (hw: the head's half-width just under its top, for the bandana)
    const SHAPES = [
        { d: "M120 62 C164 62 192 92 192 134 C192 178 162 204 120 204 C78 204 48 178 48 134 C48 92 76 62 120 62Z", top: 62, eyeY: 120, mouthY: 150, w: 72, hw: 54 },
        { d: "M120 48 C158 48 178 82 178 128 C178 180 154 206 120 206 C86 206 62 180 62 128 C62 82 82 48 120 48Z", top: 48, eyeY: 108, mouthY: 140, w: 58, hw: 42 },
        { d: "M86 64 H154 Q188 64 188 98 V170 Q188 204 154 204 H86 Q52 204 52 170 V98 Q52 64 86 64Z", top: 64, eyeY: 118, mouthY: 150, w: 68, hw: 66 },
        { d: "M120 56 C158 56 176 96 186 146 C194 190 166 206 120 206 C74 206 46 190 54 146 C64 96 82 56 120 56Z", top: 56, eyeY: 116, mouthY: 148, w: 66, hw: 40 },
        { d: "M120 56 C152 56 166 78 166 112 V170 C166 196 148 206 120 206 C92 206 74 196 74 170 V112 C74 78 88 56 120 56Z", top: 56, eyeY: 108, mouthY: 138, w: 46, hw: 34 },
        { d: "M120 84 C172 84 204 112 204 150 C204 188 172 206 120 206 C68 206 36 188 36 150 C36 112 68 84 120 84Z", top: 84, eyeY: 134, mouthY: 162, w: 80, hw: 62 },
        // Strawberry: wide shoulders to a rounded point, seeds round the edge, a crown of leaves
        { d: "M120 206 C92 206 52 172 50 128 C48 92 78 66 120 66 C162 66 192 92 190 128 C188 172 148 206 120 206Z", top: 66, eyeY: 118, mouthY: 148, w: 66, hw: 52, bw: 44, fruit: "#e8344a",
          deco: () => [[78, 100], [162, 100], [62, 140], [178, 140], [80, 176], [160, 176], [102, 192], [138, 192], [100, 86], [140, 86], [66, 118], [174, 118]]
              .map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2.6" ry="4" fill="#ffe27a" stroke="#b8862a" stroke-width="1" transform="rotate(${((x - 120) / 3).toFixed(0)} ${x} ${y})"/>`).join("") +
              `<g fill="#3fae4a" ${st(3)}><path d="M120 72 Q98 50 78 66 Q100 72 120 76Z"/><path d="M120 72 Q142 50 162 66 Q140 72 120 76Z"/><path d="M120 76 Q106 50 120 42 Q134 50 120 76Z"/></g><path d="M120 46 V34" ${st(5)}/><path d="M120 46 V34" stroke="#3fae4a" stroke-width="2.5" stroke-linecap="round"/>` },
        // Watermelon Slice: the flat cut on top, red flesh, a pale band, the green rind round the bottom, black seeds
        { d: "M44 84 H196 Q196 200 120 206 Q44 200 44 84Z", top: 84, eyeY: 120, mouthY: 148, w: 70, hw: 72, bw: 50, fruit: "#2f9e44",
          deco: () => `<path d="M50 84 H190 Q189 192 120 198 Q51 192 50 84Z" fill="#dff5c9"/><path d="M56 84 H184 Q182 184 120 190 Q58 184 56 84Z" fill="#ff5a6e"/><path d="M60 88 H180" stroke="#ffffff" stroke-width="4" opacity=".35" stroke-linecap="round"/>` +
              [[76, 104], [164, 104], [70, 140], [170, 140], [92, 172], [148, 172], [120, 182], [96, 96], [144, 96]].map(([x, y]) => `<path d="M${x} ${y - 5} Q${x + 4} ${y + 1} ${x} ${y + 5} Q${x - 4} ${y + 1} ${x} ${y - 5}Z" fill="${INK}"/>`).join("") },
        // Apple: a dip on top, a stem and a leaf
        { d: "M120 78 C138 62 186 62 190 112 C194 166 160 206 120 204 C80 206 46 166 50 112 C54 62 102 62 120 78Z", top: 70, eyeY: 120, mouthY: 150, w: 70, hw: 50, bw: 52, fruit: "#e23b3b",
          deco: () => `<path d="M120 78 Q121 62 128 52" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M120 78 Q121 62 128 52" fill="none" stroke="#7a4a2a" stroke-width="4" stroke-linecap="round"/><path d="M126 62 Q142 46 156 56 Q142 72 126 62Z" fill="#4caf50" ${st(3)}/><path d="M130 61 Q142 56 150 57" stroke="#2e7d32" stroke-width="1.5" fill="none"/>` },
        // Orange: round, dimpled peel, a little green nub on top
        { d: "M120 64 C166 64 194 96 194 136 C194 178 164 206 120 206 C76 206 46 178 46 136 C46 96 74 64 120 64Z", top: 64, eyeY: 124, mouthY: 154, w: 72, hw: 52, bw: 56, fruit: "#ff9a1f",
          deco: () => [[70, 100], [170, 100], [58, 140], [182, 140], [76, 182], [164, 182], [104, 80], [138, 80], [120, 196], [62, 120], [178, 120]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#c66a00" opacity=".45"/>`).join("") +
              `<path d="M120 70 L112 60 L120 64 L128 60Z" fill="#4caf50" ${st(2.5)}/>` },
        // Lemon: an oval with a point at each end
        { d: "M120 72 C160 72 186 98 194 130 L206 136 L194 142 C186 182 160 204 120 204 C80 204 54 182 46 142 L34 136 L46 130 C54 98 80 72 120 72Z", top: 72, eyeY: 124, mouthY: 152, w: 70, hw: 50, bw: 54, fruit: "#ffe14d",
          deco: () => [[72, 104], [168, 104], [64, 156], [176, 156], [96, 190], [144, 190], [110, 82], [132, 82]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8" fill="#d4a800" opacity=".5"/>`).join("") },
        // Peach: soft and round, a crease down one side, a leaf
        { d: "M120 74 C132 62 186 62 192 116 C196 168 160 206 120 204 C80 206 44 168 48 116 C54 62 108 62 120 74Z", top: 70, eyeY: 122, mouthY: 152, w: 72, hw: 52, bw: 54, fruit: "#ffb38a",
          deco: () => `<path d="M112 72 C84 92 70 128 78 168" fill="none" stroke="#e07a5f" stroke-width="3" opacity=".55" stroke-linecap="round"/><path d="M120 74 Q104 54 90 60 Q102 76 120 74Z" fill="#5fae4a" ${st(3)}/>` }
    ];

    function eyes(kind, y) {
        const g = 24;
        let s = `<g class="bz-eyes">`;
        for (const k of [-1, 1]) {
            const x = 120 + k * g;
            if (kind === 0) s += `<ellipse cx="${x}" cy="${y}" rx="7" ry="9" fill="${INK}"/><circle cx="${x - 2.5}" cy="${y - 3.5}" r="2.4" fill="#fff"/>`;
            if (kind === 1) s += `<circle cx="${x}" cy="${y}" r="14" fill="#fff" ${st(3.5)}/><circle cx="${x + k * 1.5}" cy="${y + 2}" r="8.5" fill="#3a7bd5"/><circle cx="${x + k * 1.5}" cy="${y + 2}" r="4.2" fill="${INK}"/><circle cx="${x - 3.5}" cy="${y - 4}" r="3" fill="#fff"/>`;
            if (kind === 2) s += `<path d="M${x - 10} ${y + 3} Q${x} ${y - 9} ${x + 10} ${y + 3}" fill="none" ${st(5)}/>`;
            if (kind === 3) s += `<circle cx="${x}" cy="${y}" r="13" fill="#fff" ${st(3.5)}/><path d="${star(x, y + 1, 8, 3.4)}" fill="#ffc21f" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`;
            if (kind === 4) s += `<ellipse cx="${x}" cy="${y}" rx="5.5" ry="7" fill="${INK}"/><circle cx="${x - 2}" cy="${y - 3}" r="2" fill="#fff"/>`;
            if (kind === 5) s += `<path d="M${x - 10} ${y} A10 10 0 0 0 ${x + 10} ${y}Z" fill="${INK}"/><path d="M${x - 12} ${y} H${x + 12}" ${st(4)}/>`;
            if (kind === 6) s += k < 0 ? `<ellipse cx="${x}" cy="${y}" rx="7" ry="9" fill="${INK}"/><circle cx="${x - 2.5}" cy="${y - 3.5}" r="2.4" fill="#fff"/>`
                : `<path d="M${x + 8} ${y - 7} L${x - 6} ${y} L${x + 8} ${y + 7}" fill="none" ${st(4.5)}/>`;
            if (kind === 9) s += `<path d="M${x} ${y + 9} C${x - 15} ${y - 2} ${x - 7} ${y - 13} ${x} ${y - 5} C${x + 7} ${y - 13} ${x + 15} ${y - 2} ${x} ${y + 9}Z" fill="#ff4d6d" ${st(3)}/><circle cx="${x - 5}" cy="${y - 5}" r="2" fill="#fff"/>`;
            if (kind === 10) s += `<path d="M${x} ${y} m-1.5 0 a1.5 1.5 0 1 1 3 0 a4 4 0 1 1 -8 0 a6.5 6.5 0 1 1 13 0 a9 9 0 1 1 -18 0" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`;
            if (kind === 8) s += `<ellipse cx="${x}" cy="${y + 2}" rx="6.5" ry="8" fill="${INK}"/><circle cx="${x - 2}" cy="${y - 1}" r="2.2" fill="#fff"/><path d="M${x - 11} ${y - (k < 0 ? 17 : 10)} L${x + 11} ${y - (k < 0 ? 10 : 17)}" ${st(5)}/>`;
        }
        s += `</g>`;
        if (kind === 11) s += `<g class="bz-eyes"><circle cx="120" cy="${y}" r="19" fill="#fff" ${st(4)}/><circle cx="121" cy="${y + 2}" r="11" fill="#3fbf5f"/><circle cx="121" cy="${y + 2}" r="5.5" fill="${INK}"/><circle cx="115" cy="${y - 5}" r="4" fill="#fff"/></g><path d="M100 ${y - 24} Q120 ${y - 32} 140 ${y - 24}" fill="none" ${st(4.5)}/>`;
        if (kind === 7) s += `<g ${st(3.5)}><rect x="${120 - g - 18}" y="${y - 11}" width="36" height="22" rx="9" fill="${INK}"/><rect x="${120 + g - 18}" y="${y - 11}" width="36" height="22" rx="9" fill="${INK}"/></g>` +
            `<path d="M${120 - g + 18} ${y - 4} Q120 ${y - 9} ${120 + g - 18} ${y - 4}" fill="none" ${st(4)}/><path d="M${120 - g - 10} ${y - 4} l8 -3 M${120 + g - 10} ${y - 4} l8 -3" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>`;
        if (kind === 4) s += `<g fill="#bfe6ff" fill-opacity=".35" ${st(4)}><circle cx="${120 - g}" cy="${y}" r="16"/><circle cx="${120 + g}" cy="${y}" r="16"/></g><path d="M${120 - g + 16} ${y - 2} Q120 ${y - 8} ${120 + g - 16} ${y - 2}" fill="none" ${st(4)}/>`;
        return s;
    }
    function star(cx, cy, R, r, n = 5) {
        let d = "";
        for (let i = 0; i < n * 2; i++) {
            const a = -Math.PI / 2 + (i * Math.PI) / n, rr = i % 2 ? r : R;
            d += (i ? "L" : "M") + f1(cx + Math.cos(a) * rr) + " " + f1(cy + Math.sin(a) * rr);
        }
        return d + "Z";
    }
    function mouth(kind, y) {
        if (kind === 0) return `<path d="M106 ${y} Q120 ${y + 14} 134 ${y}" fill="none" ${st(4.5)}/>`;
        if (kind === 1) return `<path d="M103 ${y - 2} Q120 ${y} 137 ${y - 2} Q134 ${y + 20} 120 ${y + 20} Q106 ${y + 20} 103 ${y - 2}Z" fill="#7a2335" ${st(4)}/><path d="M110 ${y + 13} Q120 ${y + 7} 130 ${y + 13} Q126 ${y + 19} 120 ${y + 19} Q114 ${y + 19} 110 ${y + 13}Z" fill="#ff8aa0"/>`;
        if (kind === 2) return `<ellipse cx="120" cy="${y + 6}" rx="7" ry="9" fill="#7a2335" ${st(4)}/>`;
        if (kind === 3) return `<path d="M106 ${y + 1} Q120 ${y + 9} 134 ${y + 1}" fill="none" ${st(4.5)}/><path d="M122 ${y + 5} q2 12 8 10 q5 -2 2 -12" fill="#ff8aa0" ${st(3)}/>`;
        if (kind === 5) return `<path d="M104 ${y} Q120 ${y + 12} 136 ${y}" fill="none" ${st(4.5)}/><path d="M110 ${y + 3.5} L113 ${y + 11} L116.5 ${y + 5.5}Z M123.5 ${y + 5.5} L127 ${y + 11} L130 ${y + 3.5}Z" fill="#fff" ${st(2)}/>`;
        if (kind === 6) return `<path d="M106 ${y} Q120 ${y + 4} 134 ${y} Q132 ${y + 14} 120 ${y + 14} Q108 ${y + 14} 106 ${y}Z" fill="#7a2335" ${st(4)}/><path d="M113 ${y + 9} Q112 ${y + 24} 121 ${y + 24} Q130 ${y + 24} 128 ${y + 9}Z" fill="#ff8aa0" ${st(3)}/>`;
        if (kind === 7) return `<path d="M100 ${y - 3} Q120 ${y + 34} 140 ${y - 3}Z" fill="#7a2335" ${st(4)}/><path d="M104 ${y - 1} H136 L133 ${y + 5} H107Z" fill="#fff"/><path d="M111 ${y + 12} Q120 ${y + 8} 129 ${y + 12} Q125 ${y + 15} 120 ${y + 15} Q115 ${y + 15} 111 ${y + 12}Z" fill="#ff8aa0"/>`;
        if (kind === 8) return `<circle cx="124" cy="${y + 5}" r="5.5" fill="#7a2335" ${st(3.5)}/>`;
        if (kind === 9) return `<path d="M108 ${y + 5} H132" ${st(4.5)}/>`;
        if (kind === 10) return `<path d="M104 ${y} Q120 ${y + 12} 136 ${y}" fill="none" ${st(4.5)}/><rect x="112.5" y="${y + 4}" width="7" height="9" rx="1.5" fill="#fff" ${st(2.2)}/><rect x="120.5" y="${y + 4}" width="7" height="9" rx="1.5" fill="#fff" ${st(2.2)}/>`;
        if (kind === 11) return `<path d="M106 ${y + 9} Q113 ${y + 2} 120 ${y + 6} Q127 ${y + 10} 134 ${y + 3}" fill="none" ${st(4.5)}/>`;
        if (kind === 12) return `<path d="M104 ${y + 5} L110 ${y} L116 ${y + 6} L122 ${y} L128 ${y + 6} L134 ${y + 1}" fill="none" ${st(4)}/>`;
        return `<path d="M106 ${y} q7 8 14 0 q7 8 14 0" fill="none" ${st(4.5)}/>`;
    }
    // cheeks and the rest of the face (0 = the blush every hero had before Face was a choice)
    function face(kind, S) {
        const cy = S.eyeY + 22;
        if (kind === 1) return "";
        if (kind === 2) return [-1, 1].map(k => [[-8, -2], [0, 3], [8, -1], [3, -7]].map(([dx, dy]) => `<circle cx="${120 + k * 40 + dx}" cy="${cy + dy}" r="2.2" fill="#a0522d" opacity=".55"/>`).join("")).join("");
        if (kind === 3) { const m = S.mouthY; return `<path d="M120 ${m - 3} C110 ${m - 13} 96 ${m - 11} 90 ${m - 2} C99 ${m - 4} 109 ${m + 1} 120 ${m - 2} C131 ${m + 1} 141 ${m - 4} 150 ${m - 2} C144 ${m - 11} 130 ${m - 13} 120 ${m - 3}Z" fill="#5a3a24" ${st(3)}/>`; }
        const blush = x => `<ellipse cx="${x}" cy="${cy}" rx="10" ry="6" fill="#ff5c7a" opacity=".35"/>`;
        if (kind === 4) return blush(80) + `<g transform="translate(160 ${cy + 1}) rotate(-20)"><rect x="-13" y="-6" width="26" height="12" rx="4" fill="#f2d2a2" ${st(2.5)}/><path d="M-3 -2 v4 M3 -2 v4" stroke="${INK}" stroke-width="1.5" opacity=".5"/></g>`;
        if (kind === 6) { const m = S.mouthY - 2; return blush(80) + blush(160) + [-1, 1].map(k => [-6, 0, 6].map(dy => `<path d="M${120 + k * 30} ${m + dy} L${120 + k * 56} ${m + dy * 2.2}" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`).join("")).join(""); }
        if (kind === 7) { const x = 120 + S.hw * 0.75, y = S.eyeY - 24; return blush(80) + blush(160) + `<path d="M${x} ${y - 10} Q${x + 8} ${y + 2} ${x} ${y + 6} Q${x - 8} ${y + 2} ${x} ${y - 10}Z" fill="#7fd1ff" ${st(2.5)}/><circle cx="${x - 2}" cy="${y + 1}" r="1.6" fill="#fff"/>`; }
        if (kind === 8) return [-1, 1].map(k => [0, 7].map(dy => `<path d="M${120 + k * 24 - 9} ${S.eyeY + 17 + dy} H${120 + k * 24 + 9}" stroke="#2f8fe0" stroke-width="4" stroke-linecap="round"/>`).join("")).join("");
        if (kind === 5) return `<path d="${star(80, cy, 7, 3)}" fill="#ffd23f" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/><path d="${star(160, cy, 7, 3)}" fill="#ffd23f" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`;
        return blush(80) + blush(160);
    }
    // hair and hats, sitting on the top of the head (t)
    function top(kind, t, c, S) {
        const dk = shade(c, -0.3), lt = shade(c, 0.35);
        if (kind === 1) return `<path d="M108 ${t + 4} C100 ${t - 14} 110 ${t - 24} 118 ${t - 14} C116 ${t - 30} 132 ${t - 32} 130 ${t - 16} C138 ${t - 26} 148 ${t - 14} 136 ${t + 4}Z" fill="${c}" ${st(4)}/>`;
        if (kind === 2) return `<path d="M70 ${t + 30} C70 ${t - 16} 170 ${t - 16} 170 ${t + 30}Z" fill="${c}" ${st(4)}/><rect x="64" y="${t + 22}" width="112" height="18" rx="9" fill="${dk}" ${st(4)}/>` +
            `<path d="M76 ${t + 26} v10 M88 ${t + 26} v10 M100 ${t + 26} v10 M112 ${t + 26} v10 M124 ${t + 26} v10 M136 ${t + 26} v10 M148 ${t + 26} v10 M160 ${t + 26} v10" stroke="${INK}" stroke-width="1.6" opacity=".35"/><circle cx="120" cy="${t - 16}" r="12" fill="${lt}" ${st(4)}/>`;
        if (kind === 3) return `<path d="M74 ${t + 26} C74 ${t - 12} 166 ${t - 12} 166 ${t + 26}Z" fill="${c}" ${st(4)}/><path d="M150 ${t + 22} C176 ${t + 18} 196 ${t + 22} 204 ${t + 32} C190 ${t + 36} 168 ${t + 34} 150 ${t + 30}Z" fill="${dk}" ${st(4)}/><circle cx="120" cy="${t - 4}" r="5" fill="${lt}" ${st(3)}/>`;
        if (kind === 4) return `<path d="M86 ${t + 12} L84 ${t - 22} L102 ${t - 6} L120 ${t - 30} L138 ${t - 6} L156 ${t - 22} L154 ${t + 12}Z" fill="#ffd23f" ${st(4)}/><circle cx="120" cy="${t - 2}" r="6" fill="${c}" ${st(2.5)}/><circle cx="98" cy="${t + 4}" r="4" fill="${c}" ${st(2)}/><circle cx="142" cy="${t + 4}" r="4" fill="${c}" ${st(2)}/>`;
        if (kind === 5) return `<g transform="translate(150 ${t + 6}) rotate(18)"><path d="M0 0 L-24 -16 L-26 14Z M0 0 L24 -16 L26 14Z" fill="${c}" ${st(4)}/><circle r="8" fill="${dk}" ${st(4)}/></g>`;
        if (kind === 6) return `<path d="M68 ${t + 22} L132 ${Math.max(6, t - 62)} L172 ${t + 22}Z" fill="${c}" ${st(4)}/><path d="M60 ${t + 22} Q120 ${t + 40} 180 ${t + 22} Q120 ${t + 8} 60 ${t + 22}Z" fill="${dk}" ${st(4)}/>` +
            `<path d="${star(124, t - 12, 8, 3.4)}" fill="#ffd23f" stroke="${INK}" stroke-width="2"/><path d="${star(108, t + 8, 5, 2.2)}" fill="#fff"/>`;
        if (kind === 7) return `<path d="M58 ${t + 62} C54 ${t - 22} 186 ${t - 22} 182 ${t + 62}" fill="none" stroke="${INK}" stroke-width="16" stroke-linecap="round"/><path d="M58 ${t + 62} C54 ${t - 22} 186 ${t - 22} 182 ${t + 62}" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round"/>` +
            `<rect x="40" y="${t + 50}" width="26" height="40" rx="11" fill="${dk}" ${st(4)}/><rect x="174" y="${t + 50}" width="26" height="40" rx="11" fill="${dk}" ${st(4)}/>`;
        if (kind === 9) return `<path d="M${120 - S.hw - 2} ${t + 24} L${120 - S.hw + 6} ${t - 4} L98 ${t + 6} L108 ${t - 20} L120 ${t + 2} L134 ${t - 18} L144 ${t + 6} L${120 + S.hw - 6} ${t - 6} L${120 + S.hw + 2} ${t + 24} Q120 ${t + 6} ${120 - S.hw - 2} ${t + 24}Z" fill="${c}" ${st(4)}/>`;
        if (kind === 10) return `<ellipse cx="120" cy="${t + 6}" rx="46" ry="9" fill="${c}" ${st(4)}/><rect x="94" y="${t - 44}" width="52" height="50" rx="4" fill="${c}" ${st(4)}/><rect x="94" y="${t - 12}" width="52" height="10" fill="${dk}" ${st(3)}/><path d="M100 ${t - 38} v22" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".35"/>`;
        if (kind === 11) return `<path d="M62 ${t + 18} Q120 ${t - 2} 178 ${t + 18} Q170 ${t - 30} 120 ${t - 34} Q70 ${t - 30} 62 ${t + 18}Z" fill="${c}" ${st(4)}/><path d="M74 ${t + 12} Q120 ${t - 4} 166 ${t + 12}" fill="none" stroke="${lt}" stroke-width="3" opacity=".7"/>` +
            `<path d="M111 ${t - 4} L129 ${t - 22} M111 ${t - 22} L129 ${t - 4}" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="120" cy="${t - 15}" r="6.5" fill="#fff" ${st(2)}/>`;
        if (kind === 12) return `<g transform="translate(${120 + S.hw - 8} ${t + 8})">${[0, 72, 144, 216, 288].map(a => `<circle cx="${(Math.cos(a * Math.PI / 180) * 9).toFixed(1)}" cy="${(Math.sin(a * Math.PI / 180) * 9).toFixed(1)}" r="7.5" fill="${c}" ${st(3)}/>`).join("")}<circle r="6" fill="#ffd23f" ${st(3)}/></g>`;
        if (kind === 13) return `<path d="M${120 - S.hw * 0.55 - 6} ${t + 14} Q${120 - S.hw * 0.55 - 18} ${t - 8} ${120 - S.hw * 0.55 - 10} ${t - 26} Q${120 - S.hw * 0.55 + 4} ${t - 8} ${120 - S.hw * 0.55 + 10} ${t + 10}Z" fill="${c}" ${st(3.5)}/>` +
            `<path d="M${120 + S.hw * 0.55 + 6} ${t + 14} Q${120 + S.hw * 0.55 + 18} ${t - 8} ${120 + S.hw * 0.55 + 10} ${t - 26} Q${120 + S.hw * 0.55 - 4} ${t - 8} ${120 + S.hw * 0.55 - 10} ${t + 10}Z" fill="${c}" ${st(3.5)}/>`;
        if (kind === 14) return `<ellipse cx="120" cy="${t - 18}" rx="30" ry="8" fill="none" stroke="${INK}" stroke-width="10"/><ellipse cx="120" cy="${t - 18}" rx="30" ry="8" fill="none" stroke="${c}" stroke-width="5" class="bz-glow"/>`;
        if (kind === 15) return `<path d="M${120 - S.hw - 4} ${t + 18} Q120 ${t + 4} ${120 + S.hw + 4} ${t + 18} L${120 + S.hw + 4} ${t + 31} Q120 ${t + 17} ${120 - S.hw - 4} ${t + 31}Z" fill="${c}" ${st(4)}/>` +
            `<path d="M${120 + S.hw} ${t + 22} L${120 + S.hw + 22} ${t + 12} L${120 + S.hw + 18} ${t + 32}Z M${120 + S.hw} ${t + 26} L${120 + S.hw + 20} ${t + 40} L${120 + S.hw + 8} ${t + 46}Z" fill="${dk}" ${st(3)}/>`;
        if (kind === 16) return `<path d="M86 ${t + 14} C84 ${t - 22} 104 ${t - 30} 120 ${t - 18} C136 ${t - 30} 156 ${t - 22} 154 ${t + 14}Z" fill="${c}" ${st(4)}/><path d="M88 ${t + 4} Q120 ${t + 10} 152 ${t + 4} L153 ${t + 12} Q120 ${t + 18} 87 ${t + 12}Z" fill="${dk}"/>` +
            `<path d="M54 ${t + 10} Q66 ${t + 26} 120 ${t + 24} Q174 ${t + 26} 186 ${t + 10} Q176 ${t + 30} 120 ${t + 32} Q64 ${t + 30} 54 ${t + 10}Z" fill="${c}" ${st(4)}/>`;
        if (kind === 17) return `<rect x="92" y="${t - 6}" width="56" height="22" rx="5" fill="#ffffff" ${st(4)}/>` +
            [[100, t - 16, 15], [140, t - 16, 15], [120, Math.max(18, t - 28), 18]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff" ${st(4)}/>`).join("") + `<rect x="94" y="${t - 4}" width="52" height="8" fill="#ffffff"/><path d="M104 ${t + 2} V${t + 12} M120 ${t + 2} V${t + 12} M136 ${t + 2} V${t + 12}" stroke="#d8d8e0" stroke-width="2"/>`;
        if (kind === 18) return `<path d="M86 ${t + 4} C70 ${t - 4} 62 ${t - 22} 70 ${t - 36} C74 ${t - 20} 84 ${t - 10} 96 ${t - 4}Z" fill="#f5efe3" ${st(3.5)}/><path d="M154 ${t + 4} C170 ${t - 4} 178 ${t - 22} 170 ${t - 36} C166 ${t - 20} 156 ${t - 10} 144 ${t - 4}Z" fill="#f5efe3" ${st(3.5)}/>` +
            `<path d="M78 ${t + 22} C78 ${t - 22} 162 ${t - 22} 162 ${t + 22}Z" fill="${c}" ${st(4)}/><rect x="74" y="${t + 14}" width="92" height="12" rx="5" fill="${dk}" ${st(3.5)}/><path d="M120 ${t - 12} V${t + 14}" stroke="${dk}" stroke-width="5"/>` +
            [88, 104, 136, 152].map(x => `<circle cx="${x}" cy="${t + 20}" r="2.2" fill="${lt}"/>`).join("");
        if (kind === 8) return `<path d="M120 ${t + 4} V${t - 18}" ${st(5)}/><path d="M120 ${t - 16} C104 ${t - 34} 90 ${t - 22} 96 ${t - 12} C104 ${t - 6} 116 ${t - 10} 120 ${t - 16}Z" fill="#5fc35a" ${st(3.5)}/><path d="M120 ${t - 18} C134 ${t - 40} 152 ${t - 30} 146 ${t - 18} C140 ${t - 10} 126 ${t - 12} 120 ${t - 18}Z" fill="#7ad86b" ${st(3.5)}/>`;
        return "";
    }
    // outfits: behind the body (cape, backpack) or over it (scarf, bow tie)
    function outfitBack(kind, c, S) {
        const dk = shade(c, -0.3);
        if (kind === 2) return `<path d="M80 ${S.eyeY + 34} C60 ${S.eyeY + 80} 44 196 40 214 L200 214 C196 196 180 ${S.eyeY + 80} 160 ${S.eyeY + 34}Z" fill="${dk}" ${st(4)}/>`;
        if (kind === 4) return `<rect x="150" y="${S.eyeY + 22}" width="52" height="66" rx="16" fill="${c}" ${st(4)}/><rect x="160" y="${S.eyeY + 48}" width="32" height="26" rx="8" fill="${dk}" ${st(3)}/>`;
        if (kind === 7) {
            const e = Math.min(44, 120 - S.w - 8), lt = shade(c, 0.55), y = S.eyeY + 30;
            return [-1, 1].map(k => { const x = 120 + k * (S.w - 10); return `<path d="M${x} ${y} C${x + k * (e * 0.4)} ${y - 40} ${x + k * (e + 8)} ${y - 34} ${x + k * (e + 10)} ${y - 6} C${x + k * (e + 2)} ${y + 10} ${x + k * (e * 0.5)} ${y + 34} ${x} ${y + 30}Z" fill="${lt}" ${st(4)}/>` +
                `<path d="M${x + k * 8} ${y + 4} Q${x + k * (e * 0.6)} ${y - 12} ${x + k * (e + 2)} ${y - 6} M${x + k * 8} ${y + 16} Q${x + k * (e * 0.5)} ${y + 8} ${x + k * (e - 4)} ${y + 8}" fill="none" stroke="${INK}" stroke-width="2" opacity=".3"/>`; }).join("");
        }
        return "";
    }
    function outfitFront(kind, c, S) {
        const dk = shade(c, -0.3), y = S.mouthY + 24;
        if (kind === 1) return `<path d="M${120 - S.w + 8} ${y} Q120 ${y + 18} ${120 + S.w - 8} ${y} L${120 + S.w - 6} ${y + 16} Q120 ${y + 34} ${120 - S.w + 6} ${y + 16}Z" fill="${c}" ${st(4)}/>` +
            `<path d="M146 ${y + 12} L152 ${y + 50} L166 ${y + 46} L158 ${y + 10}Z" fill="${dk}" ${st(4)}/><path d="M${120 - S.w + 20} ${y + 8} l6 14 M${120 - 14} ${y + 14} l4 14 M${120 + 12} ${y + 14} l-2 14" stroke="${INK}" stroke-width="2" opacity=".3"/>`;
        if (kind === 2) return `<circle cx="96" cy="${S.mouthY + 26}" r="7" fill="#ffd23f" ${st(3)}/><circle cx="144" cy="${S.mouthY + 26}" r="7" fill="#ffd23f" ${st(3)}/>`;
        if (kind === 3) return `<path d="M120 ${y + 4} L98 ${y - 8} L98 ${y + 16}Z M120 ${y + 4} L142 ${y - 8} L142 ${y + 16}Z" fill="${c}" ${st(4)}/><rect x="113" y="${y - 3}" width="14" height="14" rx="4" fill="${dk}" ${st(3)}/>`;
        if (kind === 4) return `<path d="M88 ${S.eyeY + 34} Q92 ${S.eyeY + 66} 98 196 M152 ${S.eyeY + 34} Q148 ${S.eyeY + 66} 142 196" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round"/><path d="M88 ${S.eyeY + 34} Q92 ${S.eyeY + 66} 98 196 M152 ${S.eyeY + 34} Q148 ${S.eyeY + 66} 142 196" fill="none" stroke="${dk}" stroke-width="6" stroke-linecap="round"/>`;
        if (kind === 5) { const m = S.mouthY + 30; return `<path d="M108 ${m - 16} L120 ${m} L132 ${m - 16}" fill="none" stroke="${INK}" stroke-width="10" stroke-linejoin="round"/><path d="M108 ${m - 16} L120 ${m} L132 ${m - 16}" fill="none" stroke="${c}" stroke-width="5" stroke-linejoin="round"/>` +
            `<circle cx="120" cy="${m + 8}" r="10" fill="#ffd23f" ${st(3.5)}/><path d="${star(120, m + 8.5, 5.5, 2.3)}" fill="#ff9f1c"/>`; }
        if (kind === 6) { const half = S.bw || S.w - 4; return `<path d="M${120 - half} 180 Q120 188 ${120 + half} 180 L${120 + half} 192 Q120 200 ${120 - half} 192Z" fill="${c}" ${st(3.5)}/><rect x="110" y="181" width="20" height="16" rx="3" fill="#ffd23f" ${st(3)}/><rect x="116" y="186" width="8" height="6" rx="1" fill="${dk}"/>`; }
        if (kind === 8) {
            const top0 = S.mouthY + 20, h = Math.max(16, Math.min(38, 200 - top0)), sx = S.w * 0.62;
            return `<path d="M101 ${top0 + 2} L${120 - sx} ${S.eyeY + 22} M139 ${top0 + 2} L${120 + sx} ${S.eyeY + 22}" stroke="${INK}" stroke-width="10" stroke-linecap="round"/><path d="M101 ${top0 + 2} L${120 - sx} ${S.eyeY + 22} M139 ${top0 + 2} L${120 + sx} ${S.eyeY + 22}" stroke="${c}" stroke-width="5" stroke-linecap="round"/>` +
                `<rect x="97" y="${top0}" width="46" height="${h}" rx="6" fill="${c}" ${st(3.5)}/><rect x="110" y="${top0 + 6}" width="20" height="${Math.min(12, h - 9)}" rx="2" fill="${dk}"/><circle cx="103" cy="${top0 + 5}" r="3" fill="#ffd23f" ${st(1.5)}/><circle cx="137" cy="${top0 + 5}" r="3" fill="#ffd23f" ${st(1.5)}/>`;
        }
        if (kind === 10) {
            const y0 = S.mouthY + 20, L = Math.max(16, Math.min(44, 200 - (y0 + 9)));
            return `<path d="M113 ${y0} H127 L124 ${y0 + 9} H116Z" fill="${dk}" ${st(3)}/><path d="M116 ${y0 + 9} H124 L131 ${y0 + 9 + L * 0.8} L120 ${y0 + 9 + L} L109 ${y0 + 9 + L * 0.8}Z" fill="${c}" ${st(3)}/><path d="M114 ${y0 + 22} L126 ${y0 + 16} M113 ${y0 + 34} L128 ${y0 + 27}" stroke="${dk}" stroke-width="3" opacity=".6"/>`;
        }
        if (kind === 11) {
            const y0 = S.mouthY + 20, yb = Math.max(y0 + 22, Math.min(202, y0 + 50));
            return `<path d="M101 ${y0 + 2} L${120 - S.w * 0.6} ${S.eyeY + 20} M139 ${y0 + 2} L${120 + S.w * 0.6} ${S.eyeY + 20}" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>` +
                `<path d="M96 ${y0} H144 V${yb - 8} Q144 ${yb} 136 ${yb} H104 Q96 ${yb} 96 ${yb - 8}Z" fill="${shade(c, 0.55)}" ${st(3.5)}/><rect x="108" y="${y0 + 10}" width="24" height="${Math.min(14, yb - y0 - 16)}" rx="3" fill="${c}" ${st(2.5)}/>`;
        }
        if (kind === 12) {
            const x1 = 120 - S.w * 0.72, y1 = S.eyeY + 24, x2 = 120 + S.w * 0.62, y2 = Math.min(200, S.mouthY + 44);
            return `<path d="M${x1} ${y1} L${x1 + 14} ${y1 - 10} L${x2 + 6} ${y2 - 12} L${x2 - 8} ${y2}Z" fill="${c}" ${st(3.5)}/><path d="${star(120 + S.w * 0.15, (y1 + y2) / 2, 8, 3.4)}" fill="#ffd23f" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`;
        }
        if (kind === 9) {
            const y0 = S.mouthY + 16, sx = S.w * 0.55;
            return Array.from({ length: 9 }, (_, i) => { const u = i / 8, x = 120 - sx + u * 2 * sx, y = y0 + Math.sin(u * Math.PI) * 18; return `<circle cx="${f1(x)}" cy="${f1(y)}" r="${i === 4 ? 7 : 4.5}" fill="${i === 4 ? c : shade(c, 0.35)}" ${st(2.5)}/>`; }).join("");
        }
        return "";
    }
    // the item in your right hand (it sways with the arm)
    function item(kind) {
        if (kind === 1) return `<g transform="translate(206 128) rotate(-18)"><rect x="-6" y="-66" width="12" height="64" fill="#ffd23f" ${st(3)}/><path d="M-6 -66 L0 -84 L6 -66Z" fill="#f2d2a2" ${st(3)}/><path d="M-2 -78 L0 -84 L2 -78Z" fill="${INK}"/><rect x="-7" y="-4" width="14" height="10" rx="3" fill="#ff8fa8" ${st(3)}/></g>`;
        if (kind === 2) return `<g transform="translate(206 120) rotate(-10)"><rect x="-22" y="-30" width="44" height="54" rx="5" fill="#7a4fd6" ${st(3.5)}/><rect x="-16" y="-24" width="32" height="10" rx="2" fill="#ffd23f"/><path d="M-22 18 H22" stroke="#fff" stroke-width="4"/></g>`;
        if (kind === 3) return `<g transform="translate(206 126) rotate(-20)"><rect x="-3.5" y="-60" width="7" height="62" rx="3" fill="#8a5a3c" ${st(3)}/><path d="${star(0, -70, 18, 7.5)}" fill="#ffd23f" ${st(3)}/><circle cx="-5" cy="-75" r="3" fill="#fff"/></g>`;
        if (kind === 4) return `<g transform="translate(206 128)"><path d="M0 -60 V-48" ${st(4)}/><path d="M-14 -48 H14 L18 -8 H-18Z" fill="#ffe9a8" ${st(3.5)}/><ellipse cx="0" cy="-26" rx="7" ry="10" fill="#ffb21e" class="bz-glow"/><rect x="-20" y="-10" width="40" height="8" rx="3" fill="#5a5f6e" ${st(3)}/></g>`;
        if (kind === 6) return `<g transform="translate(206 126) rotate(-12)"><rect x="-4" y="-74" width="8" height="62" fill="#dfe6ee" ${st(3)}/><path d="M-4 -74 L0 -86 L4 -74Z" fill="#dfe6ee" ${st(3)}/><path d="M0 -70 V-16" stroke="#fff" stroke-width="2" opacity=".8"/><rect x="-15" y="-15" width="30" height="7" rx="3" fill="#ffd23f" ${st(3)}/><rect x="-3.5" y="-9" width="7" height="14" rx="2" fill="#8a5a3c" ${st(3)}/></g>`;
        if (kind === 7) return `<g transform="translate(202 120)"><path d="M-20 -26 H20 V0 Q20 22 0 32 Q-20 22 -20 0Z" fill="#2f8fe0" ${st(3.5)}/><path d="M0 -20 V24 M-14 -4 H14" stroke="#ffd23f" stroke-width="5" stroke-linecap="round"/></g>`;
        if (kind === 8) return `<g transform="translate(206 128)"><path d="M0 0 Q-10 -30 2 -58" fill="none" stroke="${INK}" stroke-width="2"/><ellipse cx="4" cy="-80" rx="18" ry="22" fill="#ff5c7a" ${st(3.5)}/><path d="M0 -58 L4 -54 L8 -58Z" fill="#ff5c7a" ${st(2)}/><ellipse cx="-3" cy="-88" rx="4" ry="7" fill="#fff" opacity=".6"/></g>`;
        if (kind === 9) return `<g transform="translate(200 128) rotate(-8)"><path d="M0 0 V-70" ${st(4)}/><path d="M-34 -66 Q0 -112 34 -66 Q25 -73 17 -66 Q9 -73 0 -66 Q-9 -73 -17 -66 Q-25 -73 -34 -66Z" fill="#7a4fd6" ${st(3.5)}/><path d="M0 -95 V-66" stroke="${INK}" stroke-width="2" opacity=".35"/><path d="M0 0 q0 9 -8 9" fill="none" ${st(4)}/></g>`;
        if (kind === 10) return `<g transform="translate(206 124) rotate(-24)"><circle cy="-52" r="12" fill="none" stroke="${INK}" stroke-width="10"/><circle cy="-52" r="12" fill="none" stroke="#ffd23f" stroke-width="5"/><rect x="-3.5" y="-40" width="7" height="40" fill="#ffd23f" ${st(3)}/><path d="M4 -12 h8 M4 -3 h6" ${st(4)}/></g>`;
        if (kind === 11) return `<g transform="translate(206 128)"><rect x="-3" y="-90" width="6" height="92" rx="2" fill="#8a5a3c" ${st(3)}/><path d="M-3 -88 L-36 -76 L-3 -62Z" fill="#e5484d" ${st(3)}/><circle cy="-92" r="4" fill="#ffd23f" ${st(2)}/></g>`;
        if (kind === 12) return `<g transform="translate(206 124) rotate(-10)"><path d="M-12 -14 L12 -14 L0 18Z" fill="#e8b06a" ${st(3)}/><path d="M-8 -8 L6 4 M8 -8 L-4 6" stroke="#b07a3a" stroke-width="1.5"/><circle cy="-24" r="13" fill="#ffb3d1" ${st(3)}/><circle cy="-41" r="10" fill="#fff4e0" ${st(3)}/><circle cx="3" cy="-51" r="3.2" fill="#e5484d" ${st(1.5)}/></g>`;
        if (kind === 13) return `<g transform="translate(206 128)"><path d="M0 0 L-34 -104" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M0 0 L-34 -104" stroke="#8a5a3c" stroke-width="4" stroke-linecap="round"/><circle cx="-6" cy="-18" r="5" fill="#5a5f6e" ${st(2)}/>` +
            `<path d="M-34 -104 Q-44 -70 -40 -40" fill="none" stroke="${INK}" stroke-width="1.5"/><circle cx="-40" cy="-36" r="5" fill="#e5484d" ${st(2)}/><path d="M-45 -36 H-35" stroke="#fff" stroke-width="2.5"/></g>`;
        if (kind === 14) return `<g transform="translate(204 108)"><path d="M-16 -20 Q-28 -20 -26 -8 Q-24 0 -14 0 M16 -20 Q28 -20 26 -8 Q24 0 14 0" fill="none" stroke="${INK}" stroke-width="6"/><path d="M-16 -20 Q-28 -20 -26 -8 Q-24 0 -14 0 M16 -20 Q28 -20 26 -8 Q24 0 14 0" fill="none" stroke="#ffd23f" stroke-width="2.5"/>` +
            `<path d="M-16 -26 H16 V-8 Q16 10 0 12 Q-16 10 -16 -8Z" fill="#ffd23f" ${st(3)}/><rect x="-4" y="12" width="8" height="9" fill="#e0b020" ${st(2.5)}/><rect x="-13" y="21" width="26" height="8" rx="2" fill="#7a4a2a" ${st(2.5)}/><path d="M-8 -20 V-4" stroke="#fff" stroke-width="3" opacity=".6" stroke-linecap="round"/></g>`;
        if (kind === 5) return `<g transform="translate(206 120) rotate(-30)"><rect x="-4" y="0" width="8" height="34" rx="3" fill="#8a5a3c" ${st(3)}/><circle cy="-16" r="18" fill="#cdeeff" fill-opacity=".6" ${st(5)}/><path d="M-8 -24 q4 -6 10 -6" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/></g>`;
        return "";
    }

    function inner(look, { still = false } = {}) {
        const l = fix(look), S = SHAPES[l.body], id = "hero" + ++counter, u = k => id + k;
        const bc = S.fruit || l.color, lt = shade(bc, 0.42), dk = shade(bc, -0.28);
        const A = cls => (still ? "" : cls);
        return `<defs><linearGradient id="${u("b")}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${lt}"/><stop offset="1" stop-color="${bc}"/></linearGradient></defs>
        <g class="${A("bz-float")}"><ellipse cx="120" cy="224" rx="62" ry="9" fill="#000" opacity=".2"/>
        ${outfitBack(l.outfit, l.outfitColor, S)}
        <rect x="90" y="190" width="22" height="26" rx="10" fill="${dk}" ${st(4)}/><rect x="128" y="190" width="22" height="26" rx="10" fill="${dk}" ${st(4)}/>
        <ellipse cx="99" cy="216" rx="18" ry="9" fill="${INK}"/><ellipse cx="141" cy="216" rx="18" ry="9" fill="${INK}"/>
        <g class="${A("bz-sway")}" style="transform-origin:${120 - S.w + 4}px ${S.eyeY + 40}px"><path d="M${120 - S.w + 6} ${S.eyeY + 38} Q${120 - S.w - 18} ${S.eyeY + 52} ${120 - S.w - 18} ${S.eyeY + 72}" fill="none" stroke="${INK}" stroke-width="20" stroke-linecap="round"/><path d="M${120 - S.w + 6} ${S.eyeY + 38} Q${120 - S.w - 18} ${S.eyeY + 52} ${120 - S.w - 18} ${S.eyeY + 72}" fill="none" stroke="${bc}" stroke-width="12" stroke-linecap="round"/></g>
        <path d="${S.d}" fill="url(#${u("b")})" ${st(4.5)}/>${S.deco ? S.deco() : ""}
        <ellipse cx="120" cy="${S.mouthY + 34}" rx="${S.w * 0.5}" ry="20" fill="#fff" opacity=".22"/>
        <ellipse cx="${120 - S.w * 0.55}" cy="${S.eyeY - 24}" rx="9" ry="14" fill="#fff" opacity=".45" transform="rotate(-24 ${120 - S.w * 0.55} ${S.eyeY - 24})"/>
        ${outfitFront(l.outfit === 2 ? 2 : l.outfit, l.outfitColor, S)}
        ${eyes(l.eyes, S.eyeY)}${mouth(l.mouth, S.mouthY)}${face(l.face, S)}
        ${top(l.top, S.top, l.topColor, S)}
        <g class="${A("bz-sway")}" style="transform-origin:${120 + S.w - 4}px ${S.eyeY + 40}px;animation-delay:-1.2s">${item(l.item)}
            <path d="M${120 + S.w - 6} ${S.eyeY + 38} Q${120 + S.w + 22} ${S.eyeY + 40} ${206} 128" fill="none" stroke="${INK}" stroke-width="20" stroke-linecap="round"/><path d="M${120 + S.w - 6} ${S.eyeY + 38} Q${120 + S.w + 22} ${S.eyeY + 40} ${206} 128" fill="none" stroke="${bc}" stroke-width="12" stroke-linecap="round"/>
            <circle cx="206" cy="128" r="12" fill="${bc}" ${st(4)}/></g>
        </g>`;
    }
    const svg = (look, cls = "", opts) => `<svg class="hero-art ${cls}" viewBox="0 0 240 240" aria-hidden="true">${inner(look, opts)}</svg>`;

    // ---------------------------------------------------------------------------------------------
    // The editor: a big preview on the left, the parts on the right. The first time (the campaign's start) it can't
    // be closed without a hero; later it's Settings-like (Escape or Close keeps the old one).
    // ---------------------------------------------------------------------------------------------
    const chev = d => `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="${d > 0 ? "M9 5l7 7-7 7" : "M15 5l-7 7 7 7"}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    function maker({ look, first = false } = {}) {
        return new Promise(done => {
            let cur = fix(look || random());
            const modal = U.el("div", { class: "hero-maker", role: "dialog", "aria-modal": "true", "aria-label": first ? "Make Your Hero" : "Your Hero" });
            const card = U.el("div", { class: "hm-card" });
            const preview = U.el("div", { class: "hm-preview" }), nameShow = U.el("b", { class: "hm-name" });
            const rows = U.el("div", { class: "hm-rows" });
            const draw = () => { preview.innerHTML = svg(cur, "hm-art"); nameShow.textContent = cur.name; drawRows(); };
            const set = (k, v) => { cur = fix({ ...cur, [k]: v }); Sound.play("select"); draw(); };
            const stepper = (label, key, list) => {
                const val = U.el("span", { class: "hm-val", text: list[cur[key]] });
                return U.el("div", { class: "hm-row" }, U.el("small", { text: label }),
                    U.el("div", { class: "hm-step" },
                        U.el("button", { type: "button", class: "hm-arrow", "aria-label": `Previous ${label}`, html: chev(-1), onclick: () => set(key, (cur[key] + list.length - 1) % list.length) }),
                        val,
                        U.el("button", { type: "button", class: "hm-arrow", "aria-label": `Next ${label}`, html: chev(1), onclick: () => set(key, (cur[key] + 1) % list.length) })));
            };
            const swatches = (label, key, list) => U.el("div", { class: "hm-row" }, U.el("small", { text: label }),
                U.el("div", { class: "hm-swatches" }, ...list.map(c => U.el("button", { type: "button", class: "hm-swatch" + (cur[key] === c ? " on" : ""), style: { background: c }, "aria-label": `${label} ${c}`, onclick: () => set(key, c) }))));
            const nameIn = U.el("input", { type: "text", class: "hm-input", maxlength: "12", value: cur.name, "aria-label": "Name", autocomplete: "off", spellcheck: "false" });
            nameIn.addEventListener("input", () => { cur = fix({ ...cur, name: nameIn.value }); nameShow.textContent = cur.name; });
            nameIn.addEventListener("keydown", e => e.stopPropagation());
            function drawRows() {
                rows.innerHTML = "";
                rows.append(
                    U.el("div", { class: "hm-row" }, U.el("small", { text: "Name" }), nameIn),
                    SHAPES[cur.body].fruit ? "" : swatches("Colour", "color", COLORS),
                    U.el("div", { class: "hm-grid" },
                        stepper("Body", "body", BODIES), stepper("Eyes", "eyes", EYES),
                        stepper("Mouth", "mouth", MOUTHS), stepper("Face", "face", FACES),
                        stepper("Hair and Hats", "top", TOPS), stepper("Outfit", "outfit", OUTFITS),
                        stepper("Holding", "item", ITEMS)),
                    cur.top ? swatches("Hat Colour", "topColor", ACCENTS) : "",
                    cur.outfit ? swatches("Outfit Colour", "outfitColor", ACCENTS) : "");
            }
            const close = value => { removeEventListener("keydown", onKey, true); modal.classList.remove("in"); setTimeout(() => modal.remove(), 250); done(value); };
            const onKey = e => { if (e.key === "Escape" && !first) { e.preventDefault(); close(null); } };
            addEventListener("keydown", onKey, true);
            const actions = U.el("div", { class: "hm-actions" },
                U.el("button", { type: "button", class: "btn", text: "Surprise Me", onclick: () => { cur = fix({ ...random(cur.name), name: cur.name }); Sound.play("pop"); draw(); } }),
                first ? "" : U.el("button", { type: "button", class: "btn", text: "Cancel", onclick: () => close(null) }),
                U.el("button", { type: "button", class: "btn primary", text: first ? "Let's Go" : "Save", onclick: () => { Sound.play("sparkle"); close(cur); } }));
            card.append(
                U.el("div", { class: "hm-left" }, U.el("small", { class: "hm-kicker", text: first ? "Before You Set Off" : "Campaign" }), U.el("h2", { text: first ? "Make Your Hero" : "Your Hero" }), preview, nameShow),
                U.el("div", { class: "hm-right" }, rows, actions));
            modal.appendChild(card);
            document.body.appendChild(modal);
            draw();
            requestAnimationFrame(() => modal.classList.add("in"));
        });
    }

    return { svg, inner, maker, random, fix, cleanName, COLORS, ACCENTS };
})();
