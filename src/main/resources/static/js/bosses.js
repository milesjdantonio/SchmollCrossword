// Campaign bosses (built by Claude at the user's request): one boss per world, drawn as detailed SVG characters on a
// 240 x 240 canvas, plus everything that shows them FULL SCREEN in a boss fight:
//
//   Bosses.info(world)        name, colour, taunt
//   Bosses.svg(world, cls)    an <svg> of the boss (each copy gets its own gradient ids)
//   Bosses.inner(world)       the same without the <svg> wrapper, to place inside another SVG (the map)
//   Bosses.arena(world)       the full-screen arena behind a boss fight: colours, a giant faded boss, scenery, particles
//   Bosses.intro(c, world)    the full-screen boss intro (a cinematic: c comes from FX.cinematic)
//   Bosses.ko(c, world)       the boss shatters (a cinematic)
//
// Animated parts use classes: bz-float (bobbing), bz-eyes (blinking), bz-sway (swaying limbs), bz-bit (floating
// bits), bz-glow (pulsing light), bz-spin (turning), bz-glitch (jumping slices), bz-rain (falling streaks).

const Bosses = (() => {
    const INK = "#2b2233";
    let counter = 0;
    const st = (w = 4) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
    const f1 = v => (Math.round(v * 10) / 10).toString();

    // ---- drawing helpers ----
    const stops = list => list.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ""}/>`).join("");
    const lin = (id, list, x1 = 0, y1 = 0, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops(list)}</linearGradient>`;
    const rad = (id, list, cx = 0.4, cy = 0.35, r = 0.75) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops(list)}</radialGradient>`;
    const glowFilter = (id, sd = 3) => `<filter id="${id}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${sd}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
    const shadow = (y = 226, rx = 72) => `<ellipse cx="120" cy="${y}" rx="${rx}" ry="9" fill="#000" opacity=".2"/>`;

    // a pair of cartoon eyes with brows. brow: angry | sly | stern | none
    function eyes({ x = 120, y, gap = 22, r = 13, iris = "#ffd23f", brow = "angry", glow = "", white = "#fff" }) {
        let s = `<g class="bz-eyes">`;
        for (const k of [-1, 1]) {
            const cx = x + k * gap, px = cx - k * r * 0.14, py = y + r * 0.12;
            s += `<circle cx="${f1(cx)}" cy="${y}" r="${r}" fill="${white}" ${st(3.5)}/>` +
                `<circle cx="${f1(px)}" cy="${f1(py)}" r="${f1(r * 0.62)}" fill="${iris}"${glow ? ` filter="url(#${glow})"` : ""}/>` +
                `<circle cx="${f1(px)}" cy="${f1(py)}" r="${f1(r * 0.3)}" fill="${INK}"/>` +
                `<circle cx="${f1(cx - r * 0.32)}" cy="${f1(y - r * 0.3)}" r="${f1(r * 0.2)}" fill="#fff"/>`;
        }
        s += `</g>`;
        for (const k of [-1, 1]) {
            const cx = x + k * gap;
            if (brow === "angry") s += `<path d="M${f1(cx + k * (r + 5))} ${f1(y - r - 9)} L${f1(cx - k * r * 0.5)} ${f1(y - r + 1)}" ${st(7)}/>`;
            if (brow === "sly") s += `<path d="M${f1(cx - r - 3)} ${f1(y - r - 3)} Q${f1(cx)} ${f1(y - r - 15)} ${f1(cx + r + 3)} ${f1(y - r - 3)}" fill="none" ${st(4)}/>`;
            if (brow === "stern") s += `<path d="M${f1(cx + k * (r + 3))} ${f1(y - r - 6)} L${f1(cx - k * r * 0.6)} ${f1(y - r - 2)}" ${st(6)}/>`;
        }
        return s;
    }
    // gritted teeth: a white bar with tooth lines
    const gritted = (x, y, w, h = 14) => `<rect x="${x - w / 2}" y="${y}" width="${w}" height="${h}" rx="${h / 2.4}" fill="#fff" ${st(3)}/>` +
        Array.from({ length: Math.floor(w / 9) }, (_, i) => `<path d="M${f1(x - w / 2 + (i + 1) * w / (Math.floor(w / 9) + 1))} ${y + 1}v${h - 2}" stroke="${INK}" stroke-width="2"/>`).join("") +
        `<path d="M${x - w / 2 + 3} ${y + h / 2}h${w - 6}" stroke="${INK}" stroke-width="2"/>`;
    // little floating bits around a boss (crumbs, bubbles, leaves...), placed on a ring
    function bits(list) {
        return list.map(([x, y, svg], i) => `<g class="bz-bit" style="animation-delay:${(-i * 0.7).toFixed(1)}s"><g transform="translate(${x} ${y})">${svg}</g></g>`).join("");
    }
    const sparkle = (c = "#fff") => `<path d="M0 -6 L1.6 -1.6 6 0 1.6 1.6 0 6 -1.6 1.6 -6 0 -1.6 -1.6z" fill="${c}"/>`;
    // a shape outlined as one piece: everything stroked fat in ink first, then filled on top
    const united = (shapes, fill, w = 8) => shapes.map(s => s.replace("/>", ` fill="${INK}" stroke="${INK}" stroke-width="${w}"/>`)).join("") + shapes.map(s => s.replace("/>", ` fill="${fill}"/>`)).join("");
    // a fuzzy outline around an ellipse (fur, puffs): alternating bumps
    function fuzzy(cx, cy, rx, ry, n = 36, out = 1.06, inn = 0.95) {
        let d = "";
        for (let i = 0; i <= n; i++) {
            const a = (i / n) * Math.PI * 2, b = ((i + 0.5) / n) * Math.PI * 2;
            const p = [cx + Math.cos(a) * rx * inn, cy + Math.sin(a) * ry * inn], c = [cx + Math.cos(b - Math.PI / n) * rx * out, cy + Math.sin(b - Math.PI / n) * ry * out];
            d += i === 0 ? `M${f1(p[0])} ${f1(p[1])}` : `Q${f1(c[0])} ${f1(c[1])} ${f1(p[0])} ${f1(p[1])}`;
        }
        return d + "Z";
    }
    const mirror = d => d.replace(/(-?\d+(?:\.\d+)?)\s(-?\d+(?:\.\d+)?)/g, (m, x, y) => `${f1(240 - +x)} ${y}`);   // absolute "x y" pairs only

    // =============================================================================================
    // The bosses
    // =============================================================================================
    const B = {};

    // ---------- 1. Notebook: The Big Eraser ----------
    B.paper = { name: "The Big Eraser", color: "#ff7f98", taunt: "I'll rub out every letter you write!", arena: ["#5a7fd0", "#203566"], fx: "crumbs",
        art: u => `<defs>${lin(u("f"), [[0, "#ffc9d5"], [1, "#ff8aa5"]])}${lin(u("s"), [[0, "#4b82e6"], [1, "#2a4fa0"]])}${lin(u("p"), [[0, "#ffe27a"], [1, "#f2b600"]], 0, 0, 1, 0)}</defs>
        <g class="bz-float">${shadow(224, 80)}
        <g class="bz-sway" style="transform-origin:58px 112px">
            <path d="M58 110 C34 110 24 124 22 140" fill="none" ${st(19)}/><path d="M58 110 C34 110 24 124 22 140" fill="none" stroke="#ff9fb4" stroke-width="11" stroke-linecap="round"/>
            <circle cx="22" cy="144" r="14" fill="#ff9fb4" ${st()}/><path d="M15 140h11M15 146h11" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/></g>
        <ellipse cx="88" cy="210" rx="21" ry="10" fill="${INK}"/><ellipse cx="160" cy="210" rx="21" ry="10" fill="${INK}"/>
        <path d="M188 76 L212 50 L212 174 L188 202 Z" fill="#e0708d" ${st()}/>
        <path d="M188 134 L212 108 L212 174 L188 202 Z" fill="#1f3f86" ${st()}/>
        <path d="M52 76 L76 50 L212 50 L188 76 Z" fill="#ffd8e1" ${st()}/>
        <path d="M86 60 q20 -6 40 0 q18 5 34 -1" stroke="#c99aa6" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7"/>
        <rect x="52" y="76" width="136" height="126" rx="10" fill="url(#${u("f")})" ${st()}/>
        <rect x="60" y="84" width="9" height="38" rx="4.5" fill="#fff" opacity=".55"/>
        <path d="M52 134 H188 V192 a10 10 0 0 1 -10 10 H62 a10 10 0 0 1 -10 -10 Z" fill="url(#${u("s")})" ${st()}/>
        <path d="M54 144 H186 M54 190 H186" stroke="#8fb4ff" stroke-width="3"/>
        <rect x="72" y="152" width="96" height="30" rx="7" fill="#fff" ${st(3)}/>
        <text x="120" y="173" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="17" fill="#2f5bb3" letter-spacing="2">ERASER</text>
        <ellipse cx="78" cy="114" rx="10" ry="6" fill="#ff5c7a" opacity=".45"/><ellipse cx="162" cy="114" rx="10" ry="6" fill="#ff5c7a" opacity=".45"/>
        ${eyes({ y: 98, gap: 28, r: 14, iris: "#4a7fe0" })}${gritted(120, 110, 50)}
        <g class="bz-sway" style="transform-origin:190px 112px;animation-delay:-1s">
            <g transform="translate(216 96) rotate(32)"><rect x="-7" y="-82" width="14" height="86" fill="url(#${u("p")})" ${st(3)}/><path d="M0 -82v86" stroke="#d99a00" stroke-width="2.5"/>
                <path d="M-7 -82 L0 -104 L7 -82Z" fill="#f2d2a2" ${st(3)}/><path d="M-2.4 -96 L0 -104 L2.4 -96Z" fill="${INK}"/>
                <rect x="-8" y="4" width="16" height="10" fill="#c0c7d1" ${st(3)}/><rect x="-7" y="14" width="14" height="11" rx="3" fill="#ff8fa8" ${st(3)}/></g>
            <path d="M188 114 C200 112 208 106 214 100" fill="none" ${st(19)}/><path d="M188 114 C200 112 208 106 214 100" fill="none" stroke="#ff9fb4" stroke-width="11" stroke-linecap="round"/>
            <circle cx="216" cy="98" r="14" fill="#ff9fb4" ${st()}/></g>
        ${bits([[30, 52, `<path d="M-5 0 q5 -6 10 0 q-5 6 -10 0" fill="#ff9fb4" ${st(2)}/>`], [222, 192, `<path d="M-4 0 q4 -5 8 0 q-4 5 -8 0" fill="#ffc9d5" ${st(2)}/>`], [34, 196, `<path d="M-4 0 q4 -5 8 0 q-4 5 -8 0" fill="#c99aa6" ${st(2)}/>`], [150, 26, sparkle("#ffd23f")]])}</g>` };

    // ---------- 2. Garden: Queen Thistle ----------
    B.garden = { name: "Queen Thistle", color: "#a35fd6", taunt: "My thorns will tangle up your words!", arena: ["#5fa64f", "#1f4a2a"], fx: "petals",
        art: u => {
            let spikes = "";
            for (let i = 0; i < 25; i++) {
                const a = Math.PI + (i / 24) * Math.PI, len = 50 + ((i * 37) % 13);
                const x0 = 120 + Math.cos(a) * 34, y0 = 100 + Math.sin(a) * 30, x1 = 120 + Math.cos(a) * (34 + len), y1 = 100 + Math.sin(a) * (30 + len * 0.95);
                const xm = 120 + Math.cos(a) * (34 + len - 14), ym = 100 + Math.sin(a) * (30 + (len - 14) * 0.95);
                spikes += `<path d="M${f1(x0)} ${f1(y0)} L${f1(x1)} ${f1(y1)}" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M${f1(x0)} ${f1(y0)} L${f1(xm)} ${f1(ym)}" stroke="#8e44c9" stroke-width="5" stroke-linecap="round"/><path d="M${f1(xm)} ${f1(ym)} L${f1(x1)} ${f1(y1)}" stroke="#e3b8ff" stroke-width="5" stroke-linecap="round"/>`;
            }
            let thorns = "";
            for (let i = 0; i < 9; i++) {
                const a = (10 + i * 20) * Math.PI / 180, px = 120 + Math.cos(a) * 54, py = 114 + Math.sin(a) * 42;
                const ox = Math.cos(a) * 11, oy = Math.sin(a) * 11, tx = -Math.sin(a) * 5, ty = Math.cos(a) * 5;
                thorns += `<path d="M${f1(px - tx)} ${f1(py - ty)} L${f1(px + ox)} ${f1(py + oy)} L${f1(px + tx)} ${f1(py + ty)}Z" fill="#2f6e2a" ${st(2.5)}/>`;
            }
            let hatch = "";
            for (let k = -60; k <= 60; k += 13) hatch += `<path d="M${120 + k - 50} 70 l100 90 M${120 + k + 50} 70 l-100 90" stroke="#2f6e2a" stroke-width="2" opacity=".45"/>`;
            return `<defs>${rad(u("b"), [[0, "#a8ea86"], [1, "#3f8a34"]])}${lin(u("d"), [[0, "#62b54f"], [1, "#2a6626"]])}${lin(u("g"), [[0, "#ffe680"], [1, "#e0a800"]])}<clipPath id="${u("c")}"><ellipse cx="120" cy="114" rx="54" ry="42"/></clipPath></defs>
            <g class="bz-float">${shadow(226, 76)}
            <g class="bz-sway" style="transform-origin:66px 210px"><path d="M54 214 L66 72" ${st(10)}/><path d="M54 214 L66 72" stroke="#3f8a34" stroke-width="5" stroke-linecap="round"/>
                <path d="M58 170 l-9 -4 M61 130 l9 -4 M63 104 l-9 -3" ${st(3)}/>
                ${Array.from({ length: 9 }, (_, i) => { const a = Math.PI + (i / 8) * Math.PI; return `<path d="M66 64 L${f1(66 + Math.cos(a) * 22)} ${f1(64 + Math.sin(a) * 22)}" stroke="#8e44c9" stroke-width="4" stroke-linecap="round"/>`; }).join("")}
                <ellipse cx="66" cy="70" rx="12" ry="10" fill="#5fb34a" ${st(3)}/></g>
            <path d="M94 148 C80 180 62 200 52 222 H188 C178 200 160 180 146 148 Z" fill="url(#${u("d")})" ${st()}/>
            <path d="M52 222 q11.3 -18 22.6 0 q11.3 -18 22.6 0 q11.3 -18 22.6 0 q11.3 -18 22.6 0 q11.3 -18 22.6 0 q11.3 -18 22.6 0" fill="#7cc862" ${st(3)}/>
            <path d="M120 156 V210 M104 172 q16 10 16 22 M136 172 q-16 10 -16 22" stroke="#2a6626" stroke-width="3" fill="none" stroke-linecap="round"/>
            <path d="M84 176 l-10 -2 M80 194 l-10 0 M156 176 l10 -2 M160 194 l10 0" ${st(3)}/>
            <path d="M98 158 C76 156 66 146 64 138" fill="none" ${st(16)}/><path d="M98 158 C76 156 66 146 64 138" fill="none" stroke="#5fb34a" stroke-width="9" stroke-linecap="round"/><circle cx="64" cy="136" r="9" fill="#5fb34a" ${st(3)}/>
            <path d="M144 156 C178 156 184 172 170 190" fill="none" ${st(16)}/><path d="M144 156 C178 156 184 172 170 190" fill="none" stroke="#5fb34a" stroke-width="9" stroke-linecap="round"/>
            ${spikes}
            <ellipse cx="120" cy="114" rx="54" ry="42" fill="url(#${u("b")})" ${st()}/>
            <g clip-path="url(#${u("c")})">${hatch}</g>${thorns}
            <path d="M94 76 l4 -24 12 13 10 -21 10 21 12 -13 4 24 z" fill="url(#${u("g")})" ${st(3)}/>
            <circle cx="120" cy="66" r="4.5" fill="#e2483c" ${st(2)}/><circle cx="103" cy="70" r="3" fill="#4fa3e8"/><circle cx="137" cy="70" r="3" fill="#4fa3e8"/>
            ${eyes({ y: 110, gap: 22, r: 13, iris: "#a35fd6", brow: "sly" })}
            <path d="M93 98 l-6 -5 M90 103 l-7 -2 M147 98 l6 -5 M150 103 l7 -2" ${st(2.5)}/>
            <path d="M104 134 q16 11 32 -3" stroke="#c2185b" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="146" cy="128" r="2.4" fill="${INK}"/>
            ${bits([[198, 60, `<ellipse rx="7" ry="4" fill="#ff8fc8" ${st(2)} transform="rotate(30)"/>`], [214, 150, `<ellipse rx="6" ry="3.5" fill="#ffd1ea" ${st(2)} transform="rotate(-20)"/>`], [26, 34, `<ellipse rx="6" ry="3.5" fill="#e3b8ff" ${st(2)}/>`]])}</g>`;
        } };

    // ---------- 3. Acorn Woods: Old Grumbleowl ----------
    B.squirrel = { name: "Old Grumbleowl", color: "#8a5a3b", taunt: "Hoo dares wake me? Not you, surely.", arena: ["#c2652b", "#3a1a0e"], fx: "leaves",
        art: u => {
            let chev = "";
            for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) { const x = 96 + c * 16 + (r % 2) * 8, y = 132 + r * 12; if (Math.hypot((x - 120) / 40, (y - 156) / 48) < 0.95) chev += `<path d="M${x - 5} ${y} l5 5 l5 -5" stroke="#b9895a" stroke-width="2.5" fill="none" stroke-linecap="round"/>`; }
            const wingL = "M60 108 C34 140 38 196 80 206 C70 180 66 150 72 120 Z";
            return `<defs>${lin(u("b"), [[0, "#a87249"], [1, "#6a4126"]])}${rad(u("e"), [[0, "#fff1a8"], [0.6, "#ffb21e"], [1, "#e07a00"]], 0.5, 0.5, 0.6)}</defs>
            <g class="bz-float">
            <path d="M6 208 Q120 192 234 212" fill="none" ${st(24)}/><path d="M6 208 Q120 192 234 212" fill="none" stroke="#8a5a3b" stroke-width="16" stroke-linecap="round"/>
            <path d="M30 206 q14 -3 26 0 M150 202 q14 -2 30 1 M196 208 q10 1 20 3" stroke="#5c3820" stroke-width="2.5" fill="none"/>
            <path d="M214 210 q14 -14 22 -2 q-10 10 -22 2z" fill="#e8792b" ${st(2.5)}/><path d="M18 206 q-14 -12 -18 2 q10 8 18 -2z" fill="#d9542a" ${st(2.5)}/>
            <g class="bz-sway" style="transform-origin:196px 212px"><path d="M196 212 v8" ${st(2.5)}/><ellipse cx="196" cy="230" rx="7" ry="9" fill="#b9773e" ${st(2.5)}/><path d="M188 225 a8 6 0 0 1 16 0z" fill="#6e4429" ${st(2.5)}/></g>
            <path d="M68 74 L54 24 L80 50 L86 28 L98 64 Z" fill="#6e4429" ${st()}/><path d="${mirror("M68 74 L54 24 L80 50 L86 28 L98 64 Z")}" fill="#6e4429" ${st()}/>
            <ellipse cx="120" cy="132" rx="66" ry="78" fill="url(#${u("b")})" ${st()}/>
            <path d="M74 84 q8 -8 16 0 M150 84 q8 -8 16 0 M84 70 q6 -6 12 0 M144 70 q6 -6 12 0" stroke="#5c3820" stroke-width="2.5" fill="none"/>
            <ellipse cx="120" cy="156" rx="42" ry="50" fill="#efd6ab" ${st(3)}/>${chev}
            <g class="bz-sway" style="transform-origin:66px 116px"><path d="${wingL}" fill="#5c3820" ${st()}/><path d="M50 160 q8 6 16 0 M48 176 q9 6 18 0 M56 192 q8 5 16 0 M56 144 q7 5 14 0" stroke="#a87249" stroke-width="2.5" fill="none"/></g>
            <g class="bz-sway" style="transform-origin:174px 116px;animation-delay:-1.1s"><path d="${mirror(wingL)}" fill="#5c3820" ${st()}/><path d="M190 160 q-8 6 -16 0 M192 176 q-9 6 -18 0 M184 192 q-8 5 -16 0 M184 144 q-7 5 -14 0" stroke="#a87249" stroke-width="2.5" fill="none"/></g>
            <circle cx="96" cy="100" r="30" fill="#c99a6a" ${st(3)}/><circle cx="144" cy="100" r="30" fill="#c99a6a" ${st(3)}/>
            <path d="M96 74 v-6 M76 84 l-5 -4 M70 100 h-6 M144 74 v-6 M164 84 l5 -4 M170 100 h6" stroke="#8a5a3b" stroke-width="2.5" stroke-linecap="round"/>
            ${eyes({ y: 100, gap: 24, r: 19, iris: `url(#${u("e")})`, brow: "none" })}
            <path d="M64 74 Q88 66 114 88 L108 96 Q86 80 68 86 Z" fill="#3e2414" ${st(2.5)}/><path d="${mirror("M64 74 Q88 66 114 88 L108 96 Q86 80 68 86 Z")}" fill="#3e2414" ${st(2.5)}/>
            <path d="M110 112 L130 112 L120 136 Z" fill="#ff9f2e" ${st(3)}/><path d="M114 114 L120 126" stroke="#fff" stroke-width="2" opacity=".7"/>
            <path d="M90 197 l-5 12 M100 198 v13 M110 197 l5 12 M130 197 l-5 12 M140 198 v13 M150 197 l5 12" ${st(8)}/><path d="M90 197 l-5 12 M100 198 v13 M110 197 l5 12 M130 197 l-5 12 M140 198 v13 M150 197 l5 12" stroke="#ff9f2e" stroke-width="4" stroke-linecap="round"/>
            ${bits([[24, 60, `<path d="M0 0 q8 -10 14 -2 q-6 10 -14 2z" fill="#e8792b" ${st(2)}/>`], [214, 70, `<path d="M0 0 q8 -10 14 -2 q-6 10 -14 2z" fill="#f2a93b" ${st(2)}/>`], [204, 26, `<text font-size="16" font-weight="900" fill="${INK}" font-family="Arial">Z</text>`]])}</g>`;
        } };

    // ---------- 4. Candy Hills: King Sourgum ----------
    B.candy = { name: "King Sourgum", color: "#5fbf2f", taunt: "One taste of sour and you'll pucker up!", arena: ["#ff8fc8", "#8a2a6a"], fx: "sprinkles",
        art: u => {
            const crystals = [[86, 92, 20], [150, 84, -15], [170, 140, 40], [76, 160, 10], [140, 190, 25], [102, 186, -30], [164, 176, 5], [96, 126, 45], [60, 120, 15]]
                .map(([x, y, r]) => `<rect x="${x - 3}" y="${y - 3}" width="6" height="6" rx="1" fill="#fff" opacity=".9" transform="rotate(${r} ${x} ${y})"/>`).join("");
            return `<defs>${rad(u("g"), [[0, "#e4ffb0"], [0.5, "#86e04a"], [1, "#3c9a1c"]], 0.4, 0.3, 0.8)}${lin(u("c"), [[0, "#ff5c8a"], [1, "#b0204f"]])}${lin(u("k"), [[0, "#ffe680"], [1, "#e0a800"]])}</defs>
            <g class="bz-float">${shadow(226, 86)}
            <path d="M70 96 C40 150 32 196 28 222 H212 C208 196 200 150 170 96 Z" fill="url(#${u("c")})" ${st()}/>
            <path d="M28 222 q92 -20 184 0 v-14 q-92 -20 -184 0 z" fill="#fff" ${st(3)}/>
            ${[44, 68, 92, 116, 140, 164, 188].map((x, i) => `<path d="M${x} ${213 - (i === 3 ? 4 : i % 3)} l2 5 -2 3 -2 -3z" fill="${INK}"/>`).join("")}
            <g class="bz-sway" style="transform-origin:46px 214px;animation-delay:-.5s"><path d="M38 216 L48 84" ${st(11)}/><path d="M38 216 L48 84" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
                <circle cx="48" cy="62" r="26" fill="#ff6fb4" ${st()}/><circle cx="48" cy="62" r="18" fill="#ffd23f"/><circle cx="48" cy="62" r="10" fill="#7ad7ff"/><circle cx="48" cy="62" r="3" fill="#fff"/>
                <path d="M48 62 m-22 0 a22 22 0 0 1 22 -22 M48 62 m0 -14 a14 14 0 0 1 14 14" stroke="#fff" stroke-width="3" fill="none" opacity=".8"/></g>
            <path d="M120 52 C164 52 190 86 192 130 C194 168 190 196 178 206 C170 214 164 204 158 212 C150 222 140 208 130 214 C120 220 112 208 102 214 C92 220 84 206 76 212 C64 210 50 196 50 160 C48 100 74 52 120 52 Z" fill="url(#${u("g")})" ${st()}/>
            <circle cx="150" cy="160" r="9" fill="#fff" opacity=".22"/><circle cx="88" cy="176" r="6" fill="#fff" opacity=".22"/><circle cx="168" cy="110" r="5" fill="#fff" opacity=".25"/>
            <path d="M74 98 Q86 66 116 62" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round" opacity=".75"/><circle cx="70" cy="114" r="4" fill="#fff" opacity=".75"/>
            ${crystals}
            <path d="M58 134 C44 132 38 124 40 116" fill="none" ${st(16)}/><path d="M58 134 C44 132 38 124 40 116" fill="none" stroke="#7fd84a" stroke-width="9" stroke-linecap="round"/><circle cx="44" cy="118" r="9" fill="#7fd84a" ${st(3)}/>
            <g class="bz-sway" style="transform-origin:184px 132px"><path d="M184 132 C204 126 210 112 212 96" fill="none" ${st(16)}/><path d="M184 132 C204 126 210 112 212 96" fill="none" stroke="#7fd84a" stroke-width="9" stroke-linecap="round"/><circle cx="212" cy="92" r="11" fill="#7fd84a" ${st(3)}/></g>
            <path d="M86 60 L80 22 L102 42 L120 12 L138 42 L160 22 L154 60 Z" fill="url(#${u("k")})" ${st(3.5)}/>
            <circle cx="80" cy="20" r="6" fill="#ff6fb4" ${st(2.5)}/><circle cx="120" cy="10" r="7" fill="#7ad7ff" ${st(2.5)}/><circle cx="160" cy="20" r="6" fill="#ff6fb4" ${st(2.5)}/>
            <rect x="86" y="50" width="68" height="10" fill="#ffcf3f" ${st(3)}/><circle cx="120" cy="44" r="5" fill="#e2483c" ${st(2)}/><circle cx="100" cy="55" r="3" fill="#4fa3e8"/><circle cx="140" cy="55" r="3" fill="#4fa3e8"/>
            ${eyes({ y: 110, gap: 24, r: 14, iris: "#e2483c" })}
            <path d="M94 144 l6 -6 6 6 6 -6 6 6 6 -6 6 6 6 -6 6 6 6 -6" fill="none" ${st(4.5)}/>
            <path d="M138 150 q2 10 -2 16 q-6 -6 2 -16" fill="#b4ff6a" ${st(2)}/>
            ${bits([[208, 182, `<rect x="-6" y="-2" width="12" height="4" rx="2" fill="#7ad7ff" transform="rotate(30)"/>`], [24, 150, `<rect x="-6" y="-2" width="12" height="4" rx="2" fill="#ffd23f" transform="rotate(-40)"/>`], [196, 36, `<rect x="-6" y="-2" width="12" height="4" rx="2" fill="#ff6fb4" transform="rotate(70)"/>`]])}</g>`;
        } };

    // ---------- 5. Coral Reef: The Kraken ----------
    B.ocean = { name: "The Kraken", color: "#8a4fd1", taunt: "Down to the deep with your puzzle!", arena: ["#1f7fb0", "#06243f"], fx: "bubbles",
        art: u => {
            const T = ["M86 142 C42 140 18 172 28 198 C36 216 60 212 58 198 C56 188 46 190 48 197", "M98 148 C82 182 60 196 70 220 C76 232 96 228 92 214", "M110 150 C106 184 98 206 110 222 C118 230 130 220 122 212"];
            const tent = (d, back) => `<g class="bz-sway" style="transform-origin:120px 150px;animation-delay:${(-d.length % 7) / 3}s"><path d="${d}" fill="none" ${st(22)}/><path d="${d}" fill="none" stroke="${back ? "#6d37b3" : "#9a5fe0"}" stroke-width="14" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#f3d2ff" stroke-width="5" stroke-linecap="round" stroke-dasharray="0 12"/></g>`;
            return `<defs>${lin(u("m"), [[0, "#cfa6ff"], [1, "#6d37b3"]])}</defs>
            <g class="bz-float"><ellipse cx="120" cy="228" rx="90" ry="8" fill="#000" opacity=".18"/>
            ${tent(T[1], true)}${tent(mirror(T[1]), true)}${tent(T[0])}${tent(mirror(T[0]))}${tent(T[2])}${tent(mirror(T[2]))}
            <path d="M74 70 L46 50 L64 98 Z" fill="#8a4fd1" ${st(3.5)}/><path d="${mirror("M74 70 L46 50 L64 98 Z")}" fill="#8a4fd1" ${st(3.5)}/>
            <path d="M68 150 C56 100 74 30 120 22 C166 30 184 100 172 150 C150 164 90 164 68 150 Z" fill="url(#${u("m")})" ${st()}/>
            <circle cx="96" cy="54" r="7" fill="#e2c8ff"/><circle cx="142" cy="46" r="5" fill="#e2c8ff"/><circle cx="154" cy="82" r="7" fill="#e2c8ff"/><circle cx="86" cy="86" r="4.5" fill="#e2c8ff"/><circle cx="124" cy="66" r="4" fill="#e2c8ff"/>
            <path d="M92 40 Q104 28 120 26" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" opacity=".5"/>
            ${eyes({ y: 118, gap: 26, r: 15, iris: "#ffd23f" })}
            <path d="M108 142 l12 9 l12 -9" fill="#ffb21e" ${st(3)}/>
            <g class="bz-sway" style="transform-origin:168px 146px;animation-delay:-.6s"><path d="M168 146 C204 140 214 110 200 92" fill="none" ${st(22)}/><path d="M168 146 C204 140 214 110 200 92" fill="none" stroke="#9a5fe0" stroke-width="14" stroke-linecap="round"/>
                <g transform="translate(200 62)" fill="none" stroke-linecap="round"><g stroke="${INK}" stroke-width="10"><circle cy="-8" r="7"/><path d="M0 -1 V40 M-14 10 H14 M-20 30 Q0 54 20 30"/></g><g stroke="#9aa3b5" stroke-width="5"><circle cy="-8" r="7"/><path d="M0 -1 V40 M-14 10 H14 M-20 30 Q0 54 20 30"/></g></g></g>
            ${bits([[30, 44, `<circle r="7" fill="none" stroke="#fff" stroke-width="2.5" opacity=".85"/><circle cx="-2" cy="-2" r="2" fill="#fff"/>`], [214, 26, `<circle r="5" fill="none" stroke="#fff" stroke-width="2" opacity=".85"/>`], [46, 112, `<circle r="4" fill="none" stroke="#fff" stroke-width="2" opacity=".85"/>`]])}</g>`;
        } };

    // ---------- 6. Snow Day: The Yeti ----------
    B.snow = { name: "The Yeti", color: "#7fa6d6", taunt: "Your answers will freeze solid!", arena: ["#9cc4ee", "#2a4670"], fx: "snow",
        art: u => {
            const armL = "M62 112 C32 130 24 176 40 198";
            const flake = c => `<path d="M0 -7V7M-6 -3.5L6 3.5M-6 3.5L6 -3.5" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/>`;
            return `<defs>${lin(u("f"), [[0, "#ffffff"], [1, "#c8dcf4"]])}${lin(u("x"), [[0, "#bcd0ec"], [1, "#8aa3cc"]])}</defs>
            <g class="bz-float">${shadow(228, 82)}
            <ellipse cx="88" cy="214" rx="28" ry="13" fill="#e4eefb" ${st()}/><ellipse cx="152" cy="214" rx="28" ry="13" fill="#e4eefb" ${st()}/>
            <path d="M70 208 v6 M80 206 v7 M162 206 v7 M172 208 v6" stroke="#9fb4cc" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M78 62 C58 48 52 24 66 12 C66 32 78 44 94 50 Z" fill="#f2e6cf" ${st(3.5)}/><path d="${mirror("M78 62 C58 48 52 24 66 12 C66 32 78 44 94 50 Z")}" fill="#f2e6cf" ${st(3.5)}/>
            <path d="M66 30 l8 -2 M70 40 l9 -2 M174 30 l-8 -2 M170 40 l-9 -2" stroke="#c9b48e" stroke-width="2.5" stroke-linecap="round"/>
            <path d="${fuzzy(120, 132, 74, 84, 40, 1.07, 0.96)}" fill="url(#${u("f")})" ${st()}/>
            <path d="${fuzzy(120, 162, 40, 42, 24, 1.08, 0.94)}" fill="#fff" stroke="#c6d6ea" stroke-width="3"/>
            <path d="M84 84 C84 62 156 62 156 84 C162 120 150 142 120 142 C90 142 78 120 84 84Z" fill="url(#${u("x")})" ${st(3.5)}/>
            ${eyes({ y: 96, gap: 17, r: 10.5, iris: "#3fb7ff", brow: "none" })}
            <path d="M88 80 q8 -8 22 2 M152 80 q-8 -8 -22 2" stroke="#fff" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M88 80 q8 -8 22 2 M152 80 q-8 -8 -22 2" stroke="#c6d6ea" stroke-width="2" stroke-linecap="round" fill="none"/>
            <path d="M98 116 Q120 108 142 116 Q140 138 120 140 Q100 138 98 116 Z" fill="#5a1f2e" ${st(3)}/><ellipse cx="120" cy="133" rx="11" ry="5" fill="#ff7a8a"/>
            <path d="M103 117 l4 10 l4 -10 Z M129 117 l4 10 l4 -10 Z" fill="#fff" ${st(1.5)}/>
            <g class="bz-sway" style="transform-origin:62px 112px"><path d="${armL}" fill="none" ${st(34)}/><path d="${armL}" fill="none" stroke="#edf4fe" stroke-width="26" stroke-linecap="round"/>
                <path d="M30 204 l-5 10 M40 207 l0 11 M50 204 l5 10" stroke="#3f6fb3" stroke-width="5" stroke-linecap="round"/><path d="M28 150 l4 12 l4 -12z M36 176 l3 9 l3 -9z" fill="#bfe4ff" stroke="#7fb3e0" stroke-width="1.5"/></g>
            <g class="bz-sway" style="transform-origin:178px 112px;animation-delay:-1s"><path d="${mirror(armL)}" fill="none" ${st(34)}/><path d="${mirror(armL)}" fill="none" stroke="#edf4fe" stroke-width="26" stroke-linecap="round"/>
                <path d="M210 204 l5 10 M200 207 l0 11 M190 204 l-5 10" stroke="#3f6fb3" stroke-width="5" stroke-linecap="round"/><path d="M206 150 l4 12 l4 -12z M198 176 l3 9 l3 -9z" fill="#bfe4ff" stroke="#7fb3e0" stroke-width="1.5"/></g>
            ${bits([[24, 40, flake("#fff")], [216, 46, flake("#dff1ff")], [214, 150, flake("#fff")], [20, 110, flake("#dff1ff")]])}</g>`;
        } };

    // ---------- 7. Rainy City: Thunderhead ----------
    B.rain = { name: "Thunderhead", color: "#5d6a7d", taunt: "Rumble rumble... here comes the storm!", arena: ["#55657d", "#141b29"], fx: "rain",
        art: u => {
            const puffs = [`<circle cx="70" cy="112" r="38"/>`, `<circle cx="110" cy="80" r="46"/>`, `<circle cx="158" cy="88" r="42"/>`, `<circle cx="188" cy="126" r="32"/>`, `<circle cx="50" cy="142" r="26"/>`, `<rect x="44" y="112" width="156" height="62" rx="31"/>`];
            return `<defs>${rad(u("c"), [[0, "#a7b3c6"], [0.6, "#5d6a7d"], [1, "#384152"]], 0.4, 0.2, 0.9)}${glowFilter(u("gl"), 3.5)}</defs>
            <g class="bz-float">
            <g class="bz-rain">${[60, 84, 108, 132, 156, 180].map((x, i) => `<path d="M${x} ${180 + (i % 2) * 8} l-8 ${36 + (i % 3) * 6}" stroke="#7fb3ff" stroke-width="3.5" stroke-linecap="round"/>`).join("")}</g>
            <g class="bz-glow" filter="url(#${u("gl")})"><path d="M146 168 L134 196 L150 196 L132 236" fill="none" stroke="#ffe066" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/><path d="M146 168 L134 196 L150 196 L132 236" fill="none" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/></g>
            ${united(puffs, `url(#${u("c")})`, 9)}
            <path d="M82 84 a30 30 0 0 1 30 -30 M128 52 a40 40 0 0 1 36 18 M42 128 a24 24 0 0 1 14 -20" stroke="#c7d1e0" stroke-width="6" fill="none" stroke-linecap="round" opacity=".7"/>
            ${eyes({ y: 120, gap: 27, r: 15, iris: "#ffe066", glow: u("gl"), white: "#fdfbe8" })}
            <path d="M90 146 L101 140 L110 149 L120 140 L130 149 L139 140 L150 146 Q120 166 90 146 Z" fill="${INK}" ${st(3)}/>
            <path d="M96 146 l5 4 5 -4 5 4 5 -4 5 4 5 -4 5 4 5 -4 5 4" stroke="#fff" stroke-width="2" fill="none"/>
            <circle cx="40" cy="166" r="14" fill="#5d6a7d" ${st(3.5)}/><circle cx="28" cy="176" r="9" fill="#5d6a7d" ${st(3)}/>
            <g class="bz-sway" style="transform-origin:200px 116px"><circle cx="206" cy="110" r="15" fill="#5d6a7d" ${st(3.5)}/><circle cx="220" cy="96" r="11" fill="#5d6a7d" ${st(3)}/>
                <path d="M222 22 L200 80 L216 80 L200 132 L238 66 L221 66 L236 22 Z" fill="#ffe066" stroke="#c48f00" stroke-width="3" stroke-linejoin="round" filter="url(#${u("gl")})"/></g>
            ${bits([[20, 60, `<path d="M0 -6 q5 6 0 10 q-5 -4 0 -10" fill="#7fb3ff" ${st(1.5)}/>`], [30, 220, `<path d="M0 -6 q5 6 0 10 q-5 -4 0 -10" fill="#7fb3ff" ${st(1.5)}/>`], [96, 22, sparkle("#ffe066")]])}</g>`;
        } };

    // ---------- 8. Sky Kingdom: Sir Squall ----------
    B.sky = { name: "Sir Squall", color: "#4fa3e8", taunt: "I'll blow your letters right off the board!", arena: ["#7ec6ff", "#2a5d9a"], fx: "wind",
        art: u => {
            const head = [`<circle cx="120" cy="104" r="52"/>`, `<circle cx="78" cy="86" r="22"/>`, `<circle cx="164" cy="84" r="24"/>`, `<circle cx="178" cy="118" r="20"/>`, `<circle cx="66" cy="122" r="20"/>`, `<circle cx="120" cy="150" r="30"/>`];
            const swirl = "M120 168 C162 172 190 198 162 218 C140 232 110 216 128 200 C138 192 152 202 144 208";
            return `<defs>${rad(u("b"), [[0, "#ffffff"], [1, "#b2e0ff"]], 0.4, 0.3, 0.8)}</defs>
            <g class="bz-float">
            <g class="bz-sway" style="transform-origin:120px 170px"><path d="${swirl}" fill="none" ${st(18)}/><path d="${swirl}" fill="none" stroke="#e8f6ff" stroke-width="11" stroke-linecap="round"/>
                <path d="M96 176 C70 190 76 214 96 214" fill="none" ${st(12)}/><path d="M96 176 C70 190 76 214 96 214" fill="none" stroke="#e8f6ff" stroke-width="6" stroke-linecap="round"/></g>
            <g class="bz-rain" style="--dash: 16 10">${["M58 124 H18 q-10 0 -10 -8 q0 -6 6 -6", "M60 138 H4", "M64 152 H26 q-8 0 -8 6 q0 5 5 5"].map(d => `<path d="${d}" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`).join("")}</g>
            ${united(head, `url(#${u("b")})`, 8)}
            <path d="M80 68 Q120 24 162 68 Q120 58 80 68 Z" fill="#8a5a3b" ${st(3.5)}/>
            <path d="M84 70 q-10 20 0 36 l10 -4 q-6 -14 0 -28 Z" fill="#8a5a3b" ${st(3)}/><path d="M156 70 q10 20 0 36 l-10 -4 q6 -14 0 -28 Z" fill="#8a5a3b" ${st(3)}/>
            <path d="M84 66 Q120 54 158 66" stroke="#5c3820" stroke-width="3" fill="none"/>
            <circle cx="104" cy="64" r="12" fill="#bfe6ff" stroke="#c48f00" stroke-width="5"/><circle cx="136" cy="64" r="12" fill="#bfe6ff" stroke="#c48f00" stroke-width="5"/><path d="M116 64 h8" stroke="#c48f00" stroke-width="4"/>
            <path d="M99 59 l5 -4 M131 59 l5 -4" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
            ${eyes({ y: 100, gap: 20, r: 11, iris: "#2f7fd6", brow: "stern" })}
            <circle cx="84" cy="122" r="14" fill="#ff8fa8" opacity=".5"/><circle cx="156" cy="122" r="14" fill="#ff8fa8" opacity=".5"/>
            <path d="M120 116 c-8 -6 -22 -6 -28 4 c-2 4 2 8 6 6 c4 -4 12 -6 22 -4 c10 -2 18 0 22 4 c4 2 8 -2 6 -6 c-6 -10 -20 -10 -28 -4 z" fill="#fff" ${st(3)}/>
            <ellipse cx="120" cy="130" rx="7" ry="6" fill="${INK}"/>
            <path d="${"M120 140 l4 8 9 1 -7 6 2 9 -8 -5 -8 5 2 -9 -7 -6 9 -1z"}" fill="#ffd23f" ${st(2.5)}/>
            <g class="bz-sway" style="transform-origin:200px 150px;animation-delay:-.7s"><path d="M196 216 L216 40" ${st(10)}/><path d="M196 216 L216 40" stroke="#b07a3a" stroke-width="5" stroke-linecap="round"/>
                <path d="M216 40 L234 28 L222 50 Z" fill="#e2483c" ${st(3)}/><path d="M212 36 l6 -14 6 14 z" fill="#ffd23f" ${st(2.5)}/>
                <circle cx="200" cy="150" r="14" fill="url(#${u("b")})" ${st(3.5)}/><circle cx="210" cy="136" r="10" fill="url(#${u("b")})" ${st(3)}/></g>
            ${bits([[30, 40, `<path d="M0 0 q10 -8 18 2 q-10 6 -18 -2z" fill="#9fe08a" ${st(2)}/>`], [210, 196, `<path d="M0 0 q10 -8 18 2 q-10 6 -18 -2z" fill="#ffd23f" ${st(2)}/>`], [44, 196, `<path d="M-8 0 q8 -10 16 0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`]])}</g>`;
        } };

    // ---------- 9. Desert Caravan: The Sphinx ----------
    B.desert = { name: "The Sphinx", color: "#c9902f", taunt: "Answer my riddles... if you can.", arena: ["#f2b25a", "#7a3a14"], fx: "sand",
        art: u => {
            const nemes = "M68 162 L78 72 Q120 38 162 72 L172 162 L150 162 L142 112 L98 112 L90 162 Z";
            let stripes = "";
            for (let y = 48; y < 166; y += 10) stripes += `<path d="M40 ${y} H200" stroke="#2f6fb3" stroke-width="5"/>`;
            return `<defs>${lin(u("s"), [[0, "#f6d39a"], [1, "#c9902f"]])}<clipPath id="${u("n")}"><path d="${nemes}"/></clipPath>${glowFilter(u("gl"), 2.5)}</defs>
            <g class="bz-float">
            <circle cx="46" cy="42" r="18" fill="#ffd23f" opacity=".9"/><path d="M150 174 L196 96 L240 174 Z" fill="#e0b060" ${st(3)}/><path d="M196 96 L240 174 H214 Z" fill="#c9902f" opacity=".7"/>
            <rect x="16" y="198" width="208" height="30" rx="4" fill="#d9a35a" ${st()}/>
            ${[40, 76, 112, 148, 184].map((x, i) => i % 2 ? `<g stroke="#7a4a1e" stroke-width="2.5" fill="none" stroke-linecap="round"><circle cx="${x}" cy="207" r="4"/><path d="M${x} 211 v9 M${x - 5} 214 h10"/></g>` : `<g stroke="#7a4a1e" stroke-width="2.5" fill="none" stroke-linecap="round"><path d="M${x - 6} 220 q6 -14 12 0 M${x} 206 v4"/></g>`).join("")}
            <path d="M34 198 C34 152 66 136 110 140 L196 150 C214 156 222 176 216 198 Z" fill="url(#${u("s")})" ${st()}/>
            <path d="M190 158 q22 -20 30 -50 q-12 22 -30 30" fill="none" ${st(5)}/>
            <rect x="52" y="176" width="46" height="24" rx="11" fill="#f2c98a" ${st(3.5)}/><rect x="142" y="176" width="46" height="24" rx="11" fill="#f2c98a" ${st(3.5)}/>
            <path d="M62 186 v12 M74 186 v12 M86 186 v12 M152 186 v12 M164 186 v12 M176 186 v12" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
            <path d="${nemes}" fill="#ffd23f" ${st()}/><g clip-path="url(#${u("n")})">${stripes}</g><path d="${nemes}" fill="none" ${st()}/>
            <path d="M88 160 q32 24 64 0" fill="none" stroke="#2fb3a0" stroke-width="7"/><path d="M84 152 q36 28 72 0" fill="none" stroke="#e2483c" stroke-width="4"/>
            <ellipse cx="120" cy="106" rx="28" ry="34" fill="url(#${u("s")})" ${st(3.5)}/>
            <path d="M120 74 q-8 -12 0 -20 q8 8 0 20" fill="#2f8f9d" ${st(2.5)}/><circle cx="120" cy="60" r="2.5" fill="#ffd23f"/>
            <g filter="url(#${u("gl")})">${eyes({ y: 100, gap: 12, r: 7.5, iris: "#2fd0c0", brow: "stern" })}</g>
            <path d="M100 100 l-9 4 M140 100 l9 4" ${st(3)}/>
            <path d="M118 108 q2 8 4 0" fill="none" ${st(2.5)}/><path d="M110 122 h20" ${st(3)}/>
            <path d="M113 136 h14 l-2 24 h-10 z" fill="#2f6fb3" ${st(3)}/><path d="M114 144 h12 M115 152 h10" stroke="#ffd23f" stroke-width="3"/>
            ${bits([[206, 40, sparkle("#fff3c4")], [30, 120, `<circle r="3" fill="#e0b060"/>`], [218, 124, `<circle r="2.5" fill="#e0b060"/>`]])}</g>`;
        } };

    // ---------- 10. Big Top Carnival: The Ringmaster ----------
    B.carnival = { name: "The Ringmaster", color: "#e2483c", taunt: "Step right up... and lose!", arena: ["#e2483c", "#4a0f2a"], fx: "confetti",
        art: u => {
            const coat = "M84 104 C78 130 76 160 82 188 L102 180 L110 120 L130 120 L138 180 L158 188 C164 160 162 130 156 104 Q120 94 84 104 Z";
            return `<defs>${lin(u("c"), [[0, "#ff6a5a"], [1, "#b8281f"]])}<clipPath id="${u("d")}"><path d="M60 196 h120 v26 a60 9 0 0 1 -120 0 z"/></clipPath></defs>
            <g class="bz-float"><path d="M120 -10 L34 236 H206 Z" fill="#fff8cc" opacity=".35"/>
            <path d="M60 196 h120 v26 a60 9 0 0 1 -120 0 z" fill="#fff" ${st()}/><g clip-path="url(#${u("d")})">${[60, 84, 108, 132, 156].map(x => `<rect x="${x}" y="190" width="12" height="44" fill="#e2483c"/>`).join("")}</g><path d="M60 196 h120 v26 a60 9 0 0 1 -120 0 z" fill="none" ${st()}/>
            <ellipse cx="120" cy="196" rx="60" ry="10" fill="#ffd23f" ${st()}/>
            <path d="M100 162 L98 196 H114 L118 170 L122 170 L126 196 H142 L140 162 Z" fill="${INK}"/>
            <path d="${coat}" fill="url(#${u("c")})" ${st()}/>
            <path d="M110 120 L100 104 M130 120 L140 104" stroke="#8a1a14" stroke-width="5"/>
            <circle cx="112" cy="142" r="3.5" fill="#ffd23f" ${st(2)}/><circle cx="112" cy="158" r="3.5" fill="#ffd23f" ${st(2)}/><circle cx="128" cy="142" r="3.5" fill="#ffd23f" ${st(2)}/><circle cx="128" cy="158" r="3.5" fill="#ffd23f" ${st(2)}/>
            <path d="M80 104 q-4 8 0 14 M88 102 q-2 8 0 14 M152 104 q4 8 0 14 M160 104 q2 8 0 14" stroke="#ffd23f" stroke-width="3" stroke-linecap="round" fill="none"/>
            <path d="M80 100 h20 v6 h-22z M140 100 h20 l2 6 h-22z" fill="#ffd23f" ${st(2.5)}/>
            <path d="M106 104 L120 132 L134 104 Z" fill="#fff" ${st(3)}/><path d="M120 104 l-12 -7 v14 z M120 104 l12 -7 v14 z" fill="#ffd23f" ${st(2.5)}/><circle cx="120" cy="104" r="3.5" fill="#e2483c" ${st(2)}/>
            <circle cx="120" cy="76" r="26" fill="#f2c9a0" ${st()}/><ellipse cx="96" cy="78" rx="5" ry="7" fill="#f2c9a0" ${st(3)}/><ellipse cx="144" cy="78" rx="5" ry="7" fill="#f2c9a0" ${st(3)}/>
            <ellipse cx="120" cy="52" rx="42" ry="8" fill="${INK}"/><rect x="98" y="6" width="44" height="46" rx="3" fill="${INK}"/><rect x="98" y="40" width="44" height="8" fill="#e2483c"/>
            <path d="M120 40 l2.4 4.8 5.3 .8 -3.8 3.7 .9 5.3 -4.8 -2.5 -4.8 2.5 .9 -5.3 -3.8 -3.7 5.3 -.8z" fill="#ffd23f" transform="translate(0 -8) scale(1)"/>
            <path d="M102 12 v26" stroke="#fff" stroke-width="3" opacity=".2"/>
            ${eyes({ y: 72, gap: 11, r: 7, iris: "#2f6fb3", brow: "sly" })}
            <circle cx="131" cy="72" r="10" fill="#bfe6ff" fill-opacity=".35" stroke="#e0a800" stroke-width="3"/><path d="M140 78 q10 30 -6 52" stroke="#e0a800" stroke-width="1.5" fill="none"/>
            <path d="M120 88 c-6 -4 -18 -6 -26 2 c-6 6 -14 4 -16 -2 c2 10 14 14 24 8 c8 -4 14 -6 18 -6 c4 0 10 2 18 6 c10 6 22 2 24 -8 c-2 6 -10 8 -16 2 c-8 -8 -20 -6 -26 -2 z" fill="#5a3320" ${st(2)}/>
            <path d="M110 96 q10 8 20 0" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>
            <g class="bz-sway" style="transform-origin:86px 112px"><path d="M86 112 C66 108 56 96 52 80" fill="none" ${st(17)}/><path d="M86 112 C66 108 56 96 52 80" fill="none" stroke="#e2483c" stroke-width="11" stroke-linecap="round"/>
                <path d="M38 150 L58 46 q4 -14 16 -8" fill="none" ${st(9)}/><path d="M38 150 L58 46 q4 -14 16 -8" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M38 150 L58 46" stroke="#e2483c" stroke-width="5" stroke-dasharray="6 6"/>
                <circle cx="54" cy="76" r="9" fill="#fff" ${st(3)}/></g>
            <g class="bz-sway" style="transform-origin:154px 112px;animation-delay:-1s"><path d="M154 112 C176 116 186 108 192 98" fill="none" ${st(17)}/><path d="M154 112 C176 116 186 108 192 98" fill="none" stroke="#e2483c" stroke-width="11" stroke-linecap="round"/>
                <path d="M190 92 L224 68 L232 102 L198 104 Z" fill="#ffd23f" ${st(3.5)}/><path d="M224 68 L232 102" stroke="#e2483c" stroke-width="5"/><circle cx="194" cy="98" r="9" fill="#fff" ${st(3)}/></g>
            ${bits([[24, 30, `<rect x="-4" y="-4" width="8" height="8" fill="#ffd23f" transform="rotate(20)"/>`], [216, 180, `<rect x="-4" y="-4" width="8" height="8" fill="#4fa3e8" transform="rotate(-30)"/>`], [30, 190, `<rect x="-4" y="-4" width="8" height="8" fill="#e2483c" transform="rotate(45)"/>`], [214, 30, sparkle("#ffd23f")]])}</g>`;
        } };

    // ---------- 11. Neon Arcade: Glitch ----------
    const GLITCH = ["..X........X..", "...X......X...", "...XXXXXXXX...", "..XXBXXXXBXX..", ".XXEEXXXXEEXX.", ".XXEPXXXXPEXX.", "XXXXXXXXXXXXXX",
        "XX.XTMTMTMX.XX", "X..XXXXXXXX..X", "X...XX..XX...X", "...XX....XX...", "..XX......XX.."];
    const GLITCH_C = { X: "#ff2bd6", B: "#5a0f52", E: "#ffffff", P: "#1a0638", T: "#ffffff", M: "#1a0638" };
    function pixels(colors, dx = 0, extra = "") {
        let s = "";
        GLITCH.forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== ".") s += `<rect x="${15 + c * 15 + dx}" y="${30 + r * 15}" width="15" height="15" fill="${colors[ch] || colors.X}"${extra}/>`; }));
        return s;
    }
    B.arcade = { name: "Glitch", color: "#ff2bd6", taunt: "ERR0R: y0ur w0rds are c0rrupted!", arena: ["#3a0d6b", "#0b0218"], fx: "pixels",
        art: u => `<defs><pattern id="${u("sl")}" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="2" fill="#000" opacity=".22"/></pattern>
            <clipPath id="${u("c1")}"><rect x="0" y="88" width="240" height="22"/></clipPath><clipPath id="${u("c2")}"><rect x="0" y="150" width="240" height="16"/></clipPath>${glowFilter(u("gl"), 4)}</defs>
            <g class="bz-float"><ellipse cx="120" cy="222" rx="80" ry="8" fill="#ff2bd6" opacity=".25"/>
            <g opacity=".75" style="mix-blend-mode:screen">${pixels({ X: "#2bf0ff", B: "#2bf0ff", E: "#2bf0ff", P: "#2bf0ff", T: "#2bf0ff", M: "#2bf0ff" }, -6)}</g>
            <g opacity=".6" style="mix-blend-mode:screen">${pixels({ X: "#ffe066", B: "#ffe066", E: "#ffe066", P: "#ffe066", T: "#ffe066", M: "#ffe066" }, 6)}</g>
            <g filter="url(#${u("gl")})">${pixels(GLITCH_C, 0, ` stroke="#7a0f6a" stroke-width="1.2"`)}</g>
            <g class="bz-glitch" clip-path="url(#${u("c1")})">${pixels(GLITCH_C, 12)}</g>
            <g class="bz-glitch" style="animation-delay:-.9s" clip-path="url(#${u("c2")})">${pixels(GLITCH_C, -10)}</g>
            <g>${pixels({ X: `url(#${u("sl")})` }, 0)}</g>
            <text x="120" y="226" text-anchor="middle" font-family="Courier New, monospace" font-weight="700" font-size="13" fill="#2bf0ff" letter-spacing="3">ERR0R_404</text>
            ${bits([[20, 20, `<rect width="8" height="8" fill="#2bf0ff"/>`], [212, 40, `<rect width="6" height="6" fill="#ffe066"/>`], [222, 150, `<rect width="8" height="8" fill="#ff2bd6"/>`], [16, 170, `<rect width="6" height="6" fill="#7dff6b"/>`]])}</g>` };

    // ---------- 12. Robot Factory: Mega Unit X ----------
    B.robot = { name: "Mega Unit X", color: "#ff7a1a", taunt: "PROCESSING... YOUR DEFEAT.", arena: ["#4a5568", "#14181f"], fx: "sparks",
        art: u => `<defs>${lin(u("m"), [[0, "#dfe6ef"], [0.5, "#9ba8b9"], [1, "#5c6878"]], 0, 0, 1, 1)}${rad(u("k"), [[0, "#fff6a0"], [0.45, "#ffb21e"], [1, "#ff4b1f"]], 0.5, 0.5, 0.55)}${glowFilter(u("gl"), 3)}
            <pattern id="${u("hz")}" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="12" height="12" fill="#ffc43d"/><rect width="6" height="12" fill="${INK}"/></pattern></defs>
            <g class="bz-float">${shadow(228, 78)}
            <rect x="84" y="166" width="26" height="40" rx="4" fill="url(#${u("m")})" ${st()}/><rect x="130" y="166" width="26" height="40" rx="4" fill="url(#${u("m")})" ${st()}/>
            <circle cx="97" cy="186" r="6" fill="#5c6878" ${st(2.5)}/><circle cx="143" cy="186" r="6" fill="#5c6878" ${st(2.5)}/>
            <rect x="72" y="204" width="46" height="18" rx="6" fill="url(#${u("hz")})" ${st()}/><rect x="122" y="204" width="46" height="18" rx="6" fill="url(#${u("hz")})" ${st()}/>
            <path d="M64 88 H176 L166 172 H74 Z" fill="url(#${u("m")})" ${st()}/>
            <path d="M84 102 H156 L150 154 H90 Z" fill="#323a46" ${st(3)}/>
            <g class="bz-glow"><circle cx="120" cy="126" r="17" fill="url(#${u("k")})" filter="url(#${u("gl")})"/></g>
            <circle cx="120" cy="126" r="22" fill="none" stroke="#ffcf3f" stroke-width="2" opacity=".7"/><circle cx="120" cy="126" r="17" fill="none" ${st(3)}/>
            <circle cx="96" cy="146" r="2.5" fill="#ff4b3a"/><circle cx="104" cy="146" r="2.5" fill="#7dff6b"/><circle cx="112" cy="146" r="2.5" fill="#ffd23f"/>
            <circle cx="72" cy="96" r="2.5" fill="#5c6878"/><circle cx="168" cy="96" r="2.5" fill="#5c6878"/><circle cx="78" cy="164" r="2.5" fill="#5c6878"/><circle cx="162" cy="164" r="2.5" fill="#5c6878"/>
            <g class="bz-sway" style="transform-origin:58px 104px"><path d="M50 112 L36 152" ${st(22)}/><path d="M50 112 L36 152" stroke="#8d9aab" stroke-width="15" stroke-linecap="round"/>
                <circle cx="36" cy="154" r="10" fill="#5c6878" ${st(3)}/><path d="M36 156 L40 186" ${st(18)}/><path d="M36 156 L40 186" stroke="#8d9aab" stroke-width="11" stroke-linecap="round"/>
                <path d="M30 186 l-12 18 l12 -4 M50 186 l12 18 l-12 -4" fill="none" ${st(8)}/><path d="M30 186 l-12 18 l12 -4 M50 186 l12 18 l-12 -4" fill="none" stroke="#c5ced9" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g>
            <g class="bz-sway" style="transform-origin:182px 104px;animation-delay:-1s"><path d="M190 112 L204 150" ${st(22)}/><path d="M190 112 L204 150" stroke="#8d9aab" stroke-width="15" stroke-linecap="round"/>
                <path d="M192 156 L216 156 L204 210 Z" fill="#ffc43d" ${st(3.5)}/><path d="M196 168 L212 164 M199 182 L209 179 M202 196 L206 194" stroke="${INK}" stroke-width="2.5"/></g>
            <ellipse cx="62" cy="98" rx="28" ry="22" fill="url(#${u("hz")})" ${st()}/><ellipse cx="178" cy="98" rx="28" ry="22" fill="url(#${u("hz")})" ${st()}/>
            <rect x="108" y="70" width="8" height="20" fill="#5c6878" ${st(2.5)}/><rect x="124" y="70" width="8" height="20" fill="#5c6878" ${st(2.5)}/>
            <path d="M94 30 L88 8 M146 30 L152 10" ${st(4)}/><circle class="bz-glow" cx="88" cy="8" r="6" fill="#ff4b3a" ${st(2.5)}/><circle cx="152" cy="10" r="5" fill="#7dff6b" ${st(2.5)}/>
            <path d="M84 28 H156 L164 74 H76 Z" fill="url(#${u("m")})" ${st()}/>
            <path d="M90 42 L120 52 L150 42 L154 60 L86 60 Z" fill="#14181f" ${st(3)}/>
            <g filter="url(#${u("gl")})" class="bz-glow"><path d="M96 48 L114 54 M144 48 L126 54" stroke="#ff4b3a" stroke-width="5" stroke-linecap="round"/></g>
            <rect x="104" y="63" width="32" height="8" rx="2" fill="#323a46" ${st(2)}/><path d="M110 63 v8 M116 63 v8 M122 63 v8 M128 63 v8" stroke="#9ba8b9" stroke-width="1.5"/>
            ${bits([[26, 64, `<circle r="7" fill="#cfd6df" opacity=".6"/><circle cx="6" cy="-6" r="5" fill="#cfd6df" opacity=".5"/>`], [214, 60, `<circle r="6" fill="#cfd6df" opacity=".6"/>`], [222, 196, sparkle("#ffcf3f")], [18, 214, sparkle("#ffcf3f")]])}</g>` };

    // ---------- 13. Haunted Library: The Phantom Librarian ----------
    B.library = { name: "The Phantom Librarian", color: "#7fd8c0", taunt: "Shhh! No solving in my library!", arena: ["#3a2350", "#0e0816"], fx: "dust",
        art: u => {
            const ghost = "M64 102 C64 46 176 46 176 102 L180 168 C182 196 168 214 150 206 C138 222 126 204 116 216 C104 228 92 208 80 214 C64 216 60 196 64 168 Z";
            const book = (c, r) => `<g transform="rotate(${r})"><path d="M-15 0 Q-7 -7 0 0 Q7 -7 15 0 L15 14 Q7 8 0 14 Q-7 8 -15 14 Z" fill="${c}" ${st(2.5)}/><path d="M-11 3 q5 -3 10 0 M1 3 q5 -3 10 0" stroke="#fff" stroke-width="1.5" fill="none"/></g>`;
            return `<defs>${lin(u("g"), [[0, "#f6fffc", 0.98], [1, "#9eecd6", 0.78]])}<filter id="${u("bl")}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="8"/></filter>${glowFilter(u("gl"), 3)}</defs>
            <g class="bz-float"><ellipse cx="120" cy="230" rx="60" ry="6" fill="#7fd8c0" opacity=".25"/>
            <path d="${ghost}" fill="#7fe0c4" opacity=".55" filter="url(#${u("bl")})"/>
            <path d="${ghost}" fill="url(#${u("g")})" ${st()}/>
            <path d="M84 196 q4 -16 0 -30 M150 190 q6 -18 2 -34" stroke="#bff3e4" stroke-width="4" fill="none" stroke-linecap="round"/>
            <circle cx="120" cy="46" r="17" fill="#e6f2ee" ${st(3.5)}/><path d="M108 44 q12 -10 24 0" stroke="#c6dcd5" stroke-width="2.5" fill="none"/><path d="M98 38 L144 54" ${st(6)}/><path d="M98 38 L144 54" stroke="#ffd23f" stroke-width="3"/><path d="M144 54 l6 2 -5 2z" fill="${INK}"/>
            <path d="M78 122 Q120 152 162 122 L166 142 Q120 172 74 142 Z" fill="#7a4fa3" fill-opacity=".9" ${st(3)}/><circle cx="120" cy="148" r="6" fill="#ffd23f" ${st(2.5)}/>
            ${eyes({ y: 96, gap: 20, r: 9.5, iris: "#2fd0b0", glow: u("gl"), brow: "stern" })}
            <circle cx="100" cy="96" r="15" fill="#fff" fill-opacity=".18" ${st(3)}/><circle cx="140" cy="96" r="15" fill="#fff" fill-opacity=".18" ${st(3)}/><path d="M115 96 h10" ${st(3)}/>
            <path d="M85 96 q-12 20 -6 40" stroke="#c48f00" stroke-width="1.5" fill="none"/>
            <ellipse cx="120" cy="124" rx="5" ry="6" fill="${INK}"/>
            <g class="bz-sway" style="transform-origin:160px 160px"><path d="M162 160 Q146 144 136 128" fill="none" ${st(14)}/><path d="M162 160 Q146 144 136 128" fill="none" stroke="#e6fff7" stroke-width="8" stroke-linecap="round"/>
                <rect x="131" y="108" width="7" height="20" rx="3.5" fill="#e6fff7" ${st(2.5)}/></g>
            <g class="bz-sway" style="transform-origin:78px 150px;animation-delay:-.8s"><path d="M78 150 Q60 160 52 146" fill="none" ${st(14)}/><path d="M78 150 Q60 160 52 146" fill="none" stroke="#e6fff7" stroke-width="8" stroke-linecap="round"/>
                <ellipse cx="48" cy="146" rx="16" ry="5" fill="#c9902f" ${st(2.5)}/><rect x="41" y="120" width="14" height="24" rx="2" fill="#f4ead2" ${st(2.5)}/>
                <g class="bz-glow" filter="url(#${u("gl")})"><path d="M48 118 q-8 -10 0 -22 q8 12 0 22" fill="#ffcf3f"/><path d="M48 116 q-3 -5 0 -10 q3 5 0 10" fill="#fff"/></g></g>
            ${bits([[30, 40, book("#b8483a", -15)], [210, 30, book("#3f6fb3", 12)], [216, 150, book("#4f9a5a", -8)], [22, 196, `<circle r="3" fill="#bff3e4"/>`]])}</g>`;
        } };

    // ---------- 14. Volcano Island: Magma Wyrm ----------
    B.volcano = { name: "Magma Wyrm", color: "#ff5a1f", taunt: "I'll melt your grid to slag!", arena: ["#8a2416", "#1a0806"], fx: "embers",
        art: u => {
            const wing = "M86 92 L22 38 L34 78 L12 84 L36 108 L22 124 L72 128 Z";
            const coil = "M58 212 C36 182 68 156 110 168 C150 180 190 172 186 140 C182 116 150 112 140 128";
            return `<defs>${lin(u("r"), [[0, "#6a4236"], [1, "#2a1a16"]])}${rad(u("l"), [[0, "#fff3a0"], [0.4, "#ffb21e"], [1, "#ff3d1a"]], 0.5, 0.4, 0.7)}${glowFilter(u("gl"), 3)}</defs>
            <g class="bz-float"><ellipse cx="120" cy="220" rx="104" ry="16" fill="url(#${u("l")})" filter="url(#${u("gl")})"/>
            <g class="bz-sway" style="transform-origin:86px 110px"><path d="${wing}" fill="#3a1c14" ${st(3.5)}/><path d="M80 100 L34 62 L42 84 L26 90 L44 106 L36 118 L70 120 Z" fill="#b8361a" opacity=".85"/></g>
            <g class="bz-sway" style="transform-origin:154px 110px;animation-delay:-1.2s"><path d="${mirror(wing)}" fill="#3a1c14" ${st(3.5)}/><path d="${mirror("M80 100 L34 62 L42 84 L26 90 L44 106 L36 118 L70 120 Z")}" fill="#b8361a" opacity=".85"/></g>
            <path d="${coil}" fill="none" ${st(42)}/><path d="${coil}" fill="none" stroke="#4a2c24" stroke-width="34" stroke-linecap="round"/>
            <path d="${coil}" fill="none" stroke="#ff8a2a" stroke-width="3" stroke-dasharray="7 15" filter="url(#${u("gl")})"/>
            <path d="M78 164 l6 -14 6 12 M120 170 l6 -14 6 13 M168 160 l8 -12 4 14 M186 128 l12 -6 -4 13" fill="#3a1c14" ${st(2.5)}/>
            <path d="M140 134 C150 112 142 94 124 84" fill="none" ${st(36)}/><path d="M140 134 C150 112 142 94 124 84" fill="none" stroke="#4a2c24" stroke-width="28" stroke-linecap="round"/>
            <path d="M86 46 C70 32 66 14 74 4 C80 20 92 28 102 34 Z" fill="#efe0be" ${st(3)}/><path d="${mirror("M86 46 C70 32 66 14 74 4 C80 20 92 28 102 34 Z")}" fill="#efe0be" ${st(3)}/>
            <path d="M76 78 C70 46 96 28 120 28 C144 28 170 46 164 78 C162 98 150 114 120 118 C90 114 78 98 76 78 Z" fill="url(#${u("r")})" ${st()}/>
            <path d="M90 56 l8 6 -4 8 M152 54 l-6 8 5 6 M120 34 v10" stroke="#ff8a2a" stroke-width="3" fill="none" stroke-linecap="round" filter="url(#${u("gl")})"/>
            ${eyes({ y: 68, gap: 21, r: 10, iris: "#ffe066", glow: u("gl"), white: "#fff1c8" })}
            <path d="M92 92 Q120 84 148 92 Q144 122 120 126 Q96 122 92 92 Z" fill="#ff6a2a" ${st(3.5)} filter="url(#${u("gl")})"/>
            <path d="M98 93 l4 9 4 -9 z M134 93 l4 9 4 -9 z M108 121 l3 -7 3 7 z M126 121 l3 -7 3 7 z" fill="#fff" ${st(1.5)}/>
            <circle cx="110" cy="82" r="2.5" fill="${INK}"/><circle cx="130" cy="82" r="2.5" fill="${INK}"/>
            <g class="bz-glow"><path d="M108 124 q-22 30 -6 58 q4 -16 14 -20 q-2 16 10 26 q4 -18 -4 -34 q14 10 12 26 q14 -22 -4 -56 Z" fill="url(#${u("l")})" opacity=".92" filter="url(#${u("gl")})"/></g>
            ${bits([[24, 60, `<circle r="3.5" fill="#ffb21e"/>`], [212, 52, `<circle r="3" fill="#ff7a1f"/>`], [200, 196, `<circle r="3" fill="#ffcf3f"/>`], [34, 180, `<circle r="2.5" fill="#ff7a1f"/>`]])}</g>`;
        } };

    // ---------- 15. Deep Space: The Void ----------
    B.space = { name: "The Void", color: "#9b6bff", taunt: "Everything falls into me. Even your answers.", arena: ["#2a1660", "#020210"], fx: "stars",
        art: u => {
            const tendrils = ["M120 120 C80 100 60 140 18 120", "M120 120 C90 70 60 80 38 28", "M120 120 C150 70 190 90 210 30", "M120 120 C170 110 190 150 228 140", "M120 120 C90 160 70 176 48 216", "M120 120 C150 170 172 162 200 218"];
            return `<defs>${rad(u("i"), [[0, "#100326"], [0.28, "#4a22c0"], [0.62, "#b18cff"], [1, "#ff9fe8"]], 0.5, 0.5, 0.55)}${lin(u("d"), [[0, "#ff9f6b"], [0.5, "#ffe066"], [1, "#9b6bff"]], 0, 0, 1, 0)}${glowFilter(u("gl"), 3)}</defs>
            <g class="bz-float">
            ${tendrils.map((d, i) => `<g class="bz-sway" style="transform-origin:120px 120px;animation-delay:${-i * 0.4}s"><path d="${d}" fill="none" ${st(16)}/><path d="${d}" fill="none" stroke="#2a1660" stroke-width="11" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="0 17" opacity=".9"/></g>`).join("")}
            <g transform="rotate(-12 120 120)"><ellipse cx="120" cy="120" rx="106" ry="24" fill="none" stroke="url(#${u("d")})" stroke-width="10" opacity=".9" filter="url(#${u("gl")})"/></g>
            <ellipse cx="120" cy="118" rx="60" ry="47" fill="#f4ecff" ${st()}/>
            <path d="M66 106 q12 4 18 -2 M174 108 q-12 6 -20 0 M70 136 q12 -2 16 4" stroke="#c59cff" stroke-width="2" fill="none"/>
            <g class="bz-eyes"><circle cx="120" cy="118" r="35" fill="url(#${u("i")})" ${st(3.5)}/>
                <g class="bz-spin"><path d="M120 118 m-26 0 a26 26 0 0 1 26 -26 M120 118 m26 0 a26 26 0 0 1 -26 26 M120 118 m0 -16 a16 16 0 0 1 16 16 M120 118 m0 16 a16 16 0 0 1 -16 -16" stroke="#fff" stroke-width="2.5" fill="none" opacity=".55"/></g>
                <circle cx="120" cy="118" r="13" fill="#000"/><circle class="bz-glow" cx="120" cy="118" r="15" fill="none" stroke="#ffe066" stroke-width="3" filter="url(#${u("gl")})"/>
                <circle cx="108" cy="106" r="5" fill="#fff" opacity=".9"/></g>
            <path d="M58 116 Q120 46 182 116 Q160 84 120 84 Q80 84 58 116 Z" fill="#2a1660" ${st(3.5)}/>
            <path d="M62 126 Q120 176 178 126 Q150 160 120 160 Q90 160 62 126 Z" fill="#2a1660" ${st(3)}/>
            <g transform="rotate(-12 120 120)"><path d="M14 120 A106 24 0 0 0 226 120" fill="none" stroke="url(#${u("d")})" stroke-width="10" filter="url(#${u("gl")})"/></g>
            ${bits([[84, 30, `<path d="M0 -14 L8 0 L0 14 L-8 0Z" fill="#6b4fd6" ${st(2.5)}/><path d="M0 -14 L8 0 L0 0Z" fill="#b18cff"/>`], [120, 14, `<path d="M0 -16 L9 0 L0 16 L-9 0Z" fill="#6b4fd6" ${st(2.5)}/><path d="M0 -16 L9 0 L0 0Z" fill="#b18cff"/>`], [156, 30, `<path d="M0 -14 L8 0 L0 14 L-8 0Z" fill="#6b4fd6" ${st(2.5)}/><path d="M0 -14 L8 0 L0 0Z" fill="#b18cff"/>`], [24, 60, sparkle()], [218, 196, sparkle("#ffe066")]])}</g>`;
        } };

    // =============================================================================================
    // Rendering
    // =============================================================================================
    // The story (the user asked for lore: why are you fighting them?). The Lexicon, the great book that holds every
    // word, was torn apart, and each world's boss grabbed a piece of it. Win back every piece, world by world.
    //   story: the level sheet's paragraph · stakes: one line on the intro screen
    const LORE = {
        paper: { story: "The Lexicon, the book that holds every word in the world, was torn to pieces in the night, and its pages scattered across fifteen worlds. In the Notebook, the Big Eraser grabbed the first page. It wants a perfectly blank world: no words, no doodles, no homework, nothing.", stakes: "Win back the first page of the Lexicon before every word is rubbed out." },
        garden: { story: "Queen Thistle planted her page of the Lexicon in the middle of the Garden, and now nothing grows there but thorns. The flowers are wilting and the bees have gone quiet. She says words are weeds.", stakes: "Free the Garden's page from the thorns and let the flowers talk again." },
        squirrel: { story: "Old Grumbleowl has hoarded the forest's page in the hollow of the oldest oak, and he hoots every clue into nonsense so nobody can read it. The squirrels can't find their stashes without their words.", stakes: "Wake the owl and take the forest's page back from his hollow." },
        candy: { story: "King Sourgum dissolved his page of the Lexicon in a vat of sour syrup, and every sweet in Candy Hills now tastes like vinegar. He thinks sour is the only flavour anyone deserves.", stakes: "Fish the page out of the syrup and make Candy Hills sweet again." },
        ocean: { story: "The Kraken dragged the Coral Reef's page down to the deepest trench and wrapped it in eight arms. Without its words the reef has lost its colours, and the fish swim in circles.", stakes: "Dive to the trench and pry the page out of the Kraken's grip." },
        snow: { story: "The Yeti froze his page of the Lexicon inside a glacier, and the whole valley froze with it. Snow Day has turned into Snow Year, and it won't stop.", stakes: "Thaw the glacier, take back the page, and let spring come." },
        rain: { story: "Thunderhead parks over Rainy City and soaks every street sign until the words run off. Its page of the Lexicon is hidden somewhere inside the storm.", stakes: "Fly into the storm and bring the city's words back before they wash away." },
        sky: { story: "Sir Squall blew the Sky Kingdom's page so high that it's stuck in his castle in the clouds, and he blows away anyone who comes near. The kingdom can't send a single letter.", stakes: "Climb the wind to his castle and catch the page before it's gone for good." },
        desert: { story: "The Sphinx buried its page of the Lexicon under the dunes and guards the spot with riddles. Every traveller who answers wrong forgets one more word.", stakes: "Answer the Sphinx's riddles and dig up the desert's page." },
        carnival: { story: "The Ringmaster turned the carnival's page into the star of his show: every night it's juggled, shot from a cannon and hidden under three shells. The crowd loves it. The words are exhausted.", stakes: "Steal the show, win the page, and close the circus of confusion." },
        arcade: { story: "Glitch crawled into the arcade's machines and corrupted their page of the Lexicon into garbage code. High scores are gone, and every game says ERR0R.", stakes: "Debug the arcade and restore the page, one clean word at a time." },
        robot: { story: "Mega Unit X decided words are inefficient and fed the factory's page into its shredder, one line at a time. Its machines now speak only in beeps.", stakes: "Shut down Mega Unit X before it shreds the last line." },
        library: { story: "The Phantom Librarian haunts the stacks and has bound the library's page into a book that reads itself backwards. Anyone who solves a clue out loud gets shushed into silence.", stakes: "Break the Phantom's spell and take the page back from the haunted shelves." },
        volcano: { story: "Magma Wyrm swallowed its page of the Lexicon and sleeps on it in the heart of the volcano. Every time it snores, the island shakes and another word melts.", stakes: "Wake the Wyrm and pull the page out of the fire before it melts." },
        space: { story: "The Void tore the Lexicon apart in the first place. It wants every word in the universe to fall into it and disappear. The last page, and all the pieces you've won back, are what stand in its way.", stakes: "This is it. Put the Lexicon back together and close the Void forever." }
    };
    for (const k of Object.keys(LORE)) if (B[k]) Object.assign(B[k], LORE[k]);
    const info = world => B[world] || B.paper;
    function inner(world) {
        const id = "bz" + (++counter) + "-", u = name => id + name;
        return info(world).art(u);
    }
    const svg = (world, cls = "") => `<svg class="boss-art ${cls}" viewBox="0 0 240 240" aria-hidden="true">${inner(world)}</svg>`;

    // ---------------------------------------------------------------------------------------------
    // The arena: a full-screen backdrop behind a boss fight
    // ---------------------------------------------------------------------------------------------
    // scenery along the bottom of the arena, in two layers (far and near), drawn on a 1600 x 400 strip
    function horizon(world, far, near) {
        const r = U.rng(world.length * 977 + 5);
        const rnd = (a, b) => a + r() * (b - a);
        const W = 1600, H = 400;
        let back = "", front = "";
        const hills = (y0, amp, step, fill) => { let d = `M0 ${H}L0 ${y0}`; for (let x = 0; x <= W; x += step) d += `L${x} ${(y0 + Math.sin(x / 140 + y0) * amp + rnd(-amp, amp) * 0.4).toFixed(0)}`; return `<path d="${d}L${W} ${H}Z" fill="${fill}"/>`; };
        switch (world) {
            case "paper":
                back = hills(250, 26, 80, far);
                for (let i = 0; i < 9; i++) { const x = 80 + i * 180 + rnd(-30, 30), h = rnd(140, 260); front += `<g transform="translate(${x.toFixed(0)} ${H}) rotate(${rnd(-10, 10).toFixed(0)})"><rect x="-16" y="${-h}" width="32" height="${h}" fill="${near}"/><path d="M-16 ${-h} L0 ${-h - 46} L16 ${-h}Z" fill="${near}"/></g>`; }
                front += `<rect x="0" y="${H - 40}" width="${W}" height="40" fill="${near}"/>`; break;
            case "garden":
                back = hills(260, 20, 60, far);
                for (let x = 0; x < W; x += 70) front += `<circle cx="${x}" cy="${H - 50 + rnd(-10, 10)}" r="${rnd(46, 64).toFixed(0)}" fill="${near}"/>`;
                for (let i = 0; i < 14; i++) { const x = rnd(0, W), h = rnd(120, 220); front += `<path d="M${x} ${H}V${H - h}" stroke="${near}" stroke-width="7"/><circle cx="${x}" cy="${H - h}" r="${rnd(14, 24).toFixed(0)}" fill="${near}"/>`; } break;
            case "squirrel":
                back = hills(240, 30, 70, far);
                for (let i = 0; i < 12; i++) { const x = i * 140 + rnd(-30, 30), h = rnd(160, 280), rr = rnd(60, 90); front += `<rect x="${x - 10}" y="${H - h}" width="20" height="${h}" fill="${near}"/><circle cx="${x}" cy="${H - h}" r="${rr.toFixed(0)}" fill="${near}"/><circle cx="${x - rr * 0.6}" cy="${H - h + 30}" r="${(rr * 0.7).toFixed(0)}" fill="${near}"/>`; } break;
            case "candy":
                back = hills(250, 34, 90, far);
                for (let i = 0; i < 12; i++) { const x = i * 140 + rnd(-30, 30), h = rnd(130, 240); front += `<rect x="${x - 5}" y="${H - h}" width="10" height="${h}" fill="${near}"/><circle cx="${x}" cy="${H - h}" r="${rnd(34, 50).toFixed(0)}" fill="${near}"/>`; }
                front += hills(340, 18, 60, near); break;
            case "ocean":
                for (let i = 0; i < 18; i++) { const x = rnd(0, W), h = rnd(100, 260); back += `<path d="M${x} ${H} q${rnd(-40, 40)} ${-h / 2} 0 ${-h}" stroke="${far}" stroke-width="16" fill="none" stroke-linecap="round"/>`; }
                for (let i = 0; i < 10; i++) { const x = rnd(0, W), h = rnd(120, 200); front += `<path d="M${x} ${H}V${H - h}M${x} ${H - h * 0.5}l-40 -50M${x} ${H - h * 0.7}l36 -40" stroke="${near}" stroke-width="18" stroke-linecap="round" fill="none"/>`; }
                front += hills(356, 14, 70, near); break;
            case "snow":
                for (let i = 0; i < 8; i++) { const x = i * 220 + rnd(-40, 40), h = rnd(200, 320); back += `<path d="M${x - 200} ${H}L${x} ${H - h}L${x + 200} ${H}Z" fill="${far}"/>`; }
                for (let i = 0; i < 16; i++) { const x = rnd(0, W), h = rnd(120, 200); front += `<path d="M${x} ${H - h}L${x - 40} ${H - h * 0.4}H${x + 40}ZM${x} ${H - h * 0.6}L${x - 54} ${H}H${x + 54}Z" fill="${near}"/>`; } break;
            case "rain":
                for (let x = 0; x < W; x += rnd(60, 110)) { const h = rnd(120, 300), w = rnd(50, 100); back += `<rect x="${x}" y="${H - h}" width="${w}" height="${h}" fill="${far}"/>`; for (let wy = H - h + 16; wy < H - 20; wy += 26) for (let wx = x + 10; wx < x + w - 14; wx += 18) if (r() < 0.35) back += `<rect x="${wx}" y="${wy}" width="8" height="10" fill="#ffd34d" opacity=".55"/>`; }
                for (let x = 0; x < W; x += rnd(80, 140)) { const h = rnd(60, 160); front += `<rect x="${x}" y="${H - h}" width="${rnd(70, 130)}" height="${h}" fill="${near}"/>`; } break;
            case "sky":
                for (let i = 0; i < 20; i++) back += `<circle cx="${rnd(0, W)}" cy="${rnd(260, 360)}" r="${rnd(50, 110).toFixed(0)}" fill="${far}"/>`;
                for (let i = 0; i < 4; i++) { const x = 200 + i * 400 + rnd(-60, 60), y = rnd(150, 230); front += `<path d="M${x - 90} ${y}h180l-50 70h-80z" fill="${near}"/><circle cx="${x - 40}" cy="${y - 10}" r="30" fill="${near}"/><circle cx="${x + 20}" cy="${y - 18}" r="40" fill="${near}"/>`; }
                for (let i = 0; i < 18; i++) front += `<circle cx="${rnd(0, W)}" cy="${rnd(340, 400)}" r="${rnd(50, 90).toFixed(0)}" fill="${near}"/>`; break;
            case "desert":
                back = hills(260, 40, 120, far) + [300, 520, 1200].map(x => `<path d="M${x - 140} ${H}L${x} ${H - 220}L${x + 140} ${H}Z" fill="${far}"/>`).join("");
                front = hills(330, 26, 110, near);
                for (let i = 0; i < 6; i++) { const x = rnd(0, W); front += `<path d="M${x} ${H - 60}V${H - 180}M${x} ${H - 120}h-26v-30M${x} ${H - 140}h22v-26" stroke="${near}" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`; } break;
            case "carnival":
                back = `<g transform="translate(1180 160)"><circle r="150" fill="none" stroke="${far}" stroke-width="12"/>${Array.from({ length: 12 }, (_, i) => `<path d="M0 0L${(Math.cos(i * Math.PI / 6) * 150).toFixed(0)} ${(Math.sin(i * Math.PI / 6) * 150).toFixed(0)}" stroke="${far}" stroke-width="5"/><circle cx="${(Math.cos(i * Math.PI / 6) * 150).toFixed(0)}" cy="${(Math.sin(i * Math.PI / 6) * 150).toFixed(0)}" r="18" fill="${far}"/>`).join("")}<path d="M0 0L-90 240M0 0L90 240" stroke="${far}" stroke-width="12"/></g>`;
                for (let i = 0; i < 6; i++) { const x = 120 + i * 260 + rnd(-40, 40), h = rnd(160, 230); front += `<path d="M${x - 110} ${H}L${x - 110} ${H - h * 0.45}L${x} ${H - h}L${x + 110} ${H - h * 0.45}L${x + 110} ${H}Z" fill="${near}"/><path d="M${x} ${H - h}v-40" stroke="${near}" stroke-width="5"/><path d="M${x} ${H - h - 40}l30 10 -30 10z" fill="${near}"/>`; } break;
            case "arcade":
                for (let x = -800; x <= W + 800; x += 100) back += `<path d="M${W / 2 + (x - W / 2) * 0.25} 240L${x} ${H}" stroke="${far}" stroke-width="3"/>`;
                for (let y = 250; y < H; y += (y - 230) * 0.35 + 8) back += `<path d="M0 ${y.toFixed(0)}H${W}" stroke="${far}" stroke-width="3"/>`;
                front = `<path d="M0 240L160 140L300 220L470 90L640 230L800 120L980 230L1150 100L1320 220L1480 130L1600 240" fill="none" stroke="${near}" stroke-width="6"/>`; break;
            case "robot":
                for (let x = 0; x < W; x += rnd(120, 200)) { const h = rnd(140, 260), w = rnd(90, 150); back += `<rect x="${x}" y="${H - h}" width="${w}" height="${h}" fill="${far}"/><rect x="${x + w * 0.6}" y="${H - h - 90}" width="22" height="90" fill="${far}"/>`; }
                for (let i = 0; i < 6; i++) { const x = rnd(0, W), y = rnd(300, 380), rr = rnd(40, 70); front += `<circle cx="${x}" cy="${y}" r="${rr.toFixed(0)}" fill="none" stroke="${near}" stroke-width="${(rr * 0.4).toFixed(0)}" stroke-dasharray="${(rr * 0.35).toFixed(0)} ${(rr * 0.25).toFixed(0)}"/><circle cx="${x}" cy="${y}" r="${(rr * 0.55).toFixed(0)}" fill="${near}"/>`; }
                front += `<rect x="0" y="${H - 30}" width="${W}" height="30" fill="${near}"/>`; break;
            case "library":
                for (let shelf = 0; shelf < 3; shelf++) { const y = 140 + shelf * 90; back += `<rect x="0" y="${y + 70}" width="${W}" height="12" fill="${far}"/>`; for (let x = 0; x < W; x += rnd(16, 30)) { const h = rnd(44, 70); back += `<rect x="${x}" y="${y + 70 - h}" width="${rnd(12, 24).toFixed(0)}" height="${h.toFixed(0)}" fill="${far}" opacity="${rnd(0.6, 1).toFixed(2)}"/>`; } }
                front = `<rect x="0" y="${H - 34}" width="${W}" height="34" fill="${near}"/>` + Array.from({ length: 5 }, (_, i) => `<rect x="${i * 360 + 60}" y="40" width="40" height="${H}" fill="${near}"/>`).join(""); break;
            case "volcano":
                back = `<path d="M400 ${H}L700 90H900L1200 ${H}Z" fill="${far}"/><path d="M700 90H900L860 140H740Z" fill="#ff7a1f" opacity=".75"/>`;
                front = hills(320, 40, 60, near);
                for (let i = 0; i < 8; i++) { const x = rnd(0, W); front += `<path d="M${x - 40} ${H}L${x - 10} ${H - rnd(80, 150)}L${x + 30} ${H}Z" fill="${near}"/>`; }
                front += `<path d="M0 ${H - 10}Q400 ${H - 40} 800 ${H - 12}T1600 ${H - 16}" stroke="#ff7a1f" stroke-width="6" fill="none" opacity=".8"/>`; break;
            case "space":
                back = `<circle cx="1260" cy="120" r="70" fill="${far}"/><ellipse cx="1260" cy="120" rx="130" ry="22" fill="none" stroke="${far}" stroke-width="8" transform="rotate(-14 1260 120)"/><circle cx="260" cy="90" r="30" fill="${far}"/>`;
                front = `<path d="M-200 ${H}Q800 160 1800 ${H}Z" fill="${near}"/>` + Array.from({ length: 9 }, () => `<ellipse cx="${rnd(200, 1400).toFixed(0)}" cy="${rnd(330, 390).toFixed(0)}" rx="${rnd(20, 50).toFixed(0)}" ry="${rnd(6, 12).toFixed(0)}" fill="${far}"/>`).join(""); break;
        }
        return `<svg class="ba-horizon" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><g>${back}</g><g>${front}</g></svg>`;
    }

    // particles: each world's kind of "weather" in the arena
    function spawn(kind, w, h, initial) {
        const p = { x: Math.random() * w, y: initial ? Math.random() * h : -20, vx: 0, vy: 0, s: 3, rot: Math.random() * 6, vr: 0, a: 1, shape: "dot", c: "#fff", life: 1e9 };
        const pick = list => list[Math.floor(Math.random() * list.length)];
        switch (kind) {
            case "crumbs": Object.assign(p, { vy: 20 + Math.random() * 30, vx: -10 + Math.random() * 20, s: 3 + Math.random() * 4, shape: "rect", c: pick(["#ff9fb4", "#ffd8e1", "#c9a0aa"]), vr: 1 }); break;
            case "petals": Object.assign(p, { vy: 30 + Math.random() * 30, vx: 20 + Math.random() * 30, s: 6 + Math.random() * 5, shape: "ell", c: pick(["#ffb3d9", "#e3b8ff", "#fff"]), vr: 2 }); break;
            case "leaves": Object.assign(p, { vy: 40 + Math.random() * 30, vx: -30 + Math.random() * 60, s: 7 + Math.random() * 6, shape: "ell", c: pick(["#e8792b", "#d9542a", "#f2a93b"]), vr: 2.5 }); break;
            case "sprinkles": Object.assign(p, { vy: 50 + Math.random() * 40, s: 8, shape: "rod", c: pick(["#ff6fb4", "#7ad7ff", "#ffd23f", "#7dff6b", "#fff"]), vr: 3 }); break;
            case "bubbles": Object.assign(p, { y: initial ? Math.random() * h : h + 20, vy: -30 - Math.random() * 40, s: 3 + Math.random() * 9, shape: "ring", c: "rgba(255,255,255,.8)" }); break;
            case "snow": Object.assign(p, { vy: 30 + Math.random() * 40, vx: -10 + Math.random() * 20, s: 2 + Math.random() * 4, c: "#fff" }); break;
            case "rain": Object.assign(p, { vy: 600 + Math.random() * 300, vx: -120, s: 14 + Math.random() * 10, shape: "streak", c: "rgba(160,200,255,.7)" }); break;
            case "wind": Object.assign(p, { x: initial ? Math.random() * w : -200, y: Math.random() * h, vx: 400 + Math.random() * 300, s: 60 + Math.random() * 80, shape: "hline", c: "rgba(255,255,255,.55)" }); break;
            case "sand": Object.assign(p, { x: initial ? Math.random() * w : -10, y: Math.random() * h, vx: 200 + Math.random() * 200, vy: 20, s: 2 + Math.random() * 2, c: pick(["#ffd79c", "#e0b060", "#fff1c8"]) }); break;
            case "confetti": Object.assign(p, { vy: 60 + Math.random() * 50, vx: -20 + Math.random() * 40, s: 6 + Math.random() * 4, shape: "rect", c: pick(["#e2483c", "#ffd23f", "#4fa3e8", "#fff", "#7dff6b"]), vr: 4 }); break;
            case "pixels": Object.assign(p, { y: initial ? Math.random() * h : h + 10, vy: -40 - Math.random() * 60, s: 4 + Math.random() * 6, shape: "square", c: pick(["#2bf0ff", "#ff2bd6", "#ffe066", "#7dff6b"]) }); break;
            case "sparks": Object.assign(p, { vy: 100 + Math.random() * 200, vx: -60 + Math.random() * 120, s: 6 + Math.random() * 6, shape: "streak", c: pick(["#ffcf3f", "#ff9f2e", "#fff3a0"]) }); break;
            case "dust": Object.assign(p, { vy: -5 + Math.random() * 10, vx: -8 + Math.random() * 16, s: 1.5 + Math.random() * 3, c: pick(["rgba(191,243,228,.8)", "rgba(255,240,200,.7)"]), y: Math.random() * h }); break;
            case "embers": Object.assign(p, { y: initial ? Math.random() * h : h + 10, vy: -60 - Math.random() * 80, vx: -20 + Math.random() * 40, s: 2 + Math.random() * 3, c: pick(["#ffb21e", "#ff7a1f", "#ffe066"]), glow: true }); break;
            case "stars": { const a = Math.random() * Math.PI * 2, d = Math.max(w, h) * (initial ? Math.random() * 0.6 + 0.1 : 0.7); Object.assign(p, { x: w / 2 + Math.cos(a) * d, y: h / 2 + Math.sin(a) * d, a, d, s: 1 + Math.random() * 2, shape: "star", c: "#fff" }); break; }
        }
        return p;
    }
    let arenaEl = null, arenaRAF = 0;
    // fight: which fight this is; the arena only calms down (no rage, no phase chaos) when a new fight starts
    function arena(world, fight = world) {
        const b = info(world);
        if (!arenaEl) {
            arenaEl = U.el("div", { id: "boss-arena", class: "boss-arena", "aria-hidden": "true" });
            document.body.insertBefore(arenaEl, document.getElementById("app"));
        }
        if (arenaEl.dataset.world !== world) {
            arenaEl.dataset.world = world;
            cancelAnimationFrame(arenaRAF);
            arenaRAF = 0;                                       // this world's own weather (started below)
            arenaEl.style.setProperty("--a1", b.arena[0]);
            arenaEl.style.setProperty("--a2", b.arena[1]);
            arenaEl.style.setProperty("--boss", b.color);
            arenaEl.innerHTML = `<div class="ba-sky"></div><div class="ba-rays"></div><div class="ba-giant">${svg(world)}</div>
                ${horizon(world, "rgba(0,0,0,.22)", "rgba(0,0,0,.42)")}<canvas class="ba-fx"></canvas><div class="ba-tint"></div><div class="ba-vignette"></div>`;
        }
        if (arenaEl.dataset.fight !== String(fight)) {
            arenaEl.dataset.fight = String(fight);
            arenaEl.classList.remove("enraged", "phase2");
            chaos(world, 0);
        }
        if (!arenaRAF) startParticles(b.fx);
        return arenaEl;
    }
    // Later phases go wild (chaos.js): level 1 = phase 2 ... level 4 = the Void's phase 5. 0 = calm again.
    function chaos(world, level) {
        if (!arenaEl) return;
        arenaEl.dataset.chaos = level || "";
        let cv = arenaEl.querySelector(".ba-chaos");
        if (!level) { if (typeof Chaos !== "undefined") Chaos.stop(); if (cv) cv.remove(); return; }
        if (!cv) { cv = U.el("canvas", { class: "ba-chaos" }); arenaEl.querySelector(".ba-fx").after(cv); }
        if (typeof Chaos !== "undefined") Chaos.start(cv, world, level);
    }
    function startParticles(kind) {
        cancelAnimationFrame(arenaRAF);
        const cv = arenaEl.querySelector(".ba-fx"), ctx = cv.getContext("2d");
        let parts = [], last = performance.now();
        const N = { rain: 140, wind: 22, sand: 120, stars: 160, dust: 60, snow: 110 }[kind] || 60;
        const loop = now => {
            if (!arenaEl.isConnected || !document.documentElement.classList.contains("in-boss")) { arenaRAF = 0; return; }
            arenaRAF = requestAnimationFrame(loop);
            const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));      // a frame can be stamped just before "last": never step back
            last = now;
            const dpr = Math.min(2, devicePixelRatio || 1), w = innerWidth, h = innerHeight;
            if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); parts = []; }
            if (!parts.length) for (let i = 0; i < N; i++) parts.push(spawn(kind, w, h, true));
            if (U.motion() === "still") return;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, w, h);
            const speed = arenaEl.classList.contains("enraged") ? 1.6 : 1;
            for (let i = 0; i < parts.length; i++) {
                const p = parts[i];
                if (kind === "stars") {
                    p.d -= (40 + 1800 / Math.max(30, p.d)) * dt * speed;
                    p.a += dt * 0.6;
                    p.x = w / 2 + Math.cos(p.a) * p.d; p.y = h / 2 + Math.sin(p.a) * p.d;
                    if (p.d < 20) parts[i] = spawn(kind, w, h, false);
                } else {
                    p.x += (p.vx + (p.shape === "ell" ? Math.sin(now / 600 + i) * 30 : 0)) * dt * speed;
                    p.y += p.vy * dt * speed;
                    p.rot += p.vr * dt;
                    if (p.y > h + 40 || p.y < -60 || p.x > w + 220 || p.x < -240) parts[i] = spawn(kind, w, h, false);
                }
                ctx.fillStyle = p.c; ctx.strokeStyle = p.c;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                if (p.glow) { ctx.shadowColor = p.c; ctx.shadowBlur = 10; }
                switch (p.shape) {
                    case "rect": ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.66); break;
                    case "square": ctx.rotate(-p.rot); ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s); break;
                    case "ell": ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * 0.5, 0, 0, 7); ctx.fill(); break;
                    case "rod": ctx.fillRect(-p.s / 2, -1.5, p.s, 3); break;
                    case "ring": ctx.rotate(-p.rot); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, p.s, 0, 7); ctx.stroke(); break;
                    case "streak": ctx.rotate(-p.rot + Math.atan2(p.vy, p.vx) - Math.PI / 2); ctx.fillRect(-1, -p.s, 2, p.s); break;
                    case "hline": ctx.rotate(-p.rot); ctx.fillRect(-p.s, -1, p.s, 2); break;
                    case "star": ctx.rotate(-p.rot); ctx.globalAlpha = Math.min(1, p.d / 120); ctx.beginPath(); ctx.arc(0, 0, p.s, 0, 7); ctx.fill(); break;
                    default: ctx.beginPath(); ctx.arc(0, 0, p.s, 0, 7); ctx.fill();
                }
                ctx.restore();
            }
        };
        arenaRAF = requestAnimationFrame(loop);
    }
    const enrage = on => arenaEl && arenaEl.classList.toggle("enraged", on);

    // ---------------------------------------------------------------------------------------------
    // Full-screen moments
    // ---------------------------------------------------------------------------------------------
    // The intro: the boss fills the screen, its name slams in, FIGHT! (no "VS": the user's request) The music is the boss song's own build-up
    // (no sound effects, the user's design): FIGHT! lands on the beat where the song proper starts (until = Sound.buildDone)
    async function intro(c, world, { until = null } = {}) {
        const b = info(world), still = U.motion() === "still";
        const el = U.el("div", { class: "bfx-intro", style: { "--boss": b.color, "--a1": b.arena[0], "--a2": b.arena[1] }, "aria-hidden": "true",
            html: `<div class="bi-bg"></div><div class="bi-band"></div><div class="bi-boss">${svg(world)}</div>
                <div class="bi-text"><small>BOSS BATTLE</small><b>${U.esc(b.name)}</b><em>"${U.esc(b.taunt)}"</em>${b.stakes ? `<p class="bi-stakes">${U.esc(b.stakes)}</p>` : ""}</div><div class="bi-fight">FIGHT!</div>` });
        document.getElementById("overlay").appendChild(el);
        c.cleanup(() => el.remove());
        requestAnimationFrame(() => el.classList.add("in"));
        await c.wait(still ? 900 : 650);
        FX.shake(10, 400);
        el.classList.add("slam");
        await c.wait(b.stakes ? 2700 : 1500);                  // time to read why you're fighting
        if (until) await Promise.race([until(), c.wait(12000)]);   // ...and the build-up runs into the song
        if (c.skipped) return;
        el.classList.add("fight");
        FX.flash(b.color, 300, 0.35);
        await c.wait(700);
        el.classList.add("out");
        await c.wait(320);
    }

    // A new phase: the boss powers up full screen (bigger, glowing, the arena turns), then the new puzzle is announced.
    // The phase's own song builds up underneath; the burst lands where the song proper starts (until = Sound.buildDone)
    async function phase(c, world, title, sub, { phase: n = 2, phases = 2, until = null } = {}) {
        const b = info(world), final = n === phases && phases > 2;
        const el = U.el("div", { class: "bfx-phase", style: { "--boss": b.color, "--a1": b.arena[0], "--a2": b.arena[1] }, "aria-hidden": "true",
            html: `<div class="bp2-bg"></div><div class="bp2-ring"></div><div class="bp2-boss">${svg(world)}</div>
                <div class="bp2-text"><small>${U.esc(b.name.toUpperCase())} ${final ? "UNLEASHES EVERYTHING" : "ISN'T DONE YET"}</small><b>${final ? "FINAL PHASE" : "PHASE " + n}</b><em>${U.esc(title)}</em><span>${U.esc(sub)}</span>${phases > 2 ? `<i class="bp2-pips">${Array.from({ length: phases }, (_, i) => `<u class="${i < n ? "on" : ""}"></u>`).join("")}</i>` : ""}</div>` });
        el.classList.toggle("final", final);
        document.getElementById("overlay").appendChild(el);
        c.cleanup(() => el.remove());
        requestAnimationFrame(() => el.classList.add("in"));
        await c.wait(500);
        el.classList.add("charge");
        FX.shake(6, 900);
        await c.wait(900);
        if (until) await Promise.race([until(), c.wait(12000)]);   // the charge holds until the song's build-up peaks
        el.classList.add("burst");
        FX.flash(b.color, 400, 0.55);
        FX.burst({ x: innerWidth / 2, y: innerHeight * 0.42, n: 80, colors: ["#fff", b.color, "#ffd23f"], shape: "star", speed: [250, 700], gravity: 200, life: [0.6, 1.3], size: [3, 8] });
        if (arenaEl) arenaEl.classList.add("phase2");
        await c.wait(1900);
        el.classList.add("out");
        await c.wait(320);
    }

    // The knock-out: the boss fills the screen, cracks, and shatters into pieces
    async function ko(c, world) {
        const b = info(world), art = svg(world);
        const pieces = [];
        const cols = 4, rows = 4;
        for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
            const j = (v, i) => Math.max(0, Math.min(100, v + ((i * 37 + r * 11 + q * 7) % 9) - 4));
            const x0 = q * 100 / cols, x1 = (q + 1) * 100 / cols, y0 = r * 100 / rows, y1 = (r + 1) * 100 / rows;
            const poly = `${j(x0, 1)}% ${j(y0, 2)}%, ${j(x1, 3)}% ${j(y0, 4)}%, ${j(x1, 5)}% ${j(y1, 6)}%, ${j(x0, 7)}% ${j(y1, 8)}%`;
            const ang = Math.atan2((y0 + y1) / 2 - 50, (x0 + x1) / 2 - 50);
            pieces.push(`<div class="bk-piece" style="clip-path:polygon(${poly});--dx:${(Math.cos(ang) * (300 + r * 40)).toFixed(0)}px;--dy:${(Math.sin(ang) * (300 + q * 40) - 120).toFixed(0)}px;--rot:${((q - 1.5) * 50 + (r - 1.5) * 30).toFixed(0)}deg">${art}</div>`);
        }
        const el = U.el("div", { class: "bfx-ko", style: { "--boss": b.color, "--a1": b.arena[0], "--a2": b.arena[1] }, "aria-hidden": "true",
            html: `<div class="bk-bg"></div><div class="bk-boss">${art}<svg class="bk-cracks" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M50 50 L30 10 M50 50 L80 20 M50 50 L90 60 M50 50 L60 95 M50 50 L10 70 M30 10 L20 0 M80 20 L95 8 M10 70 L0 76" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg></div>
                <div class="bk-shards">${pieces.join("")}</div><div class="bk-text"><small>${U.esc(b.name.toUpperCase())}</small><b>DEFEATED!</b></div>` });
        document.getElementById("overlay").appendChild(el);
        c.cleanup(() => el.remove());
        requestAnimationFrame(() => el.classList.add("in"));
        Sound.play("boom");
        FX.shake(12, 500);
        await c.wait(700);
        el.classList.add("crack");
        Sound.play("thud");
        await c.wait(600);
        el.classList.add("shatter");
        FX.flash("#fff", 400, 0.8);
        Sound.play("boom");
        const center = { x: innerWidth / 2, y: innerHeight * 0.45 };
        FX.burst({ x: center.x, y: center.y, n: 90, colors: ["#fff", b.color, "#ffd23f", "#ff5c6c"], shape: "star", speed: [250, 750], gravity: 500, life: [0.7, 1.5], size: [3, 9] });
        await c.wait(1700);
        el.classList.add("out");
        await c.wait(350);
    }

    return { info, svg, inner, arena, chaos, enrage, intro, phase, ko, list: Object.keys(B) };
})();
