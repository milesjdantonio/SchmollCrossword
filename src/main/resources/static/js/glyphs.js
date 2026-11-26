// The game's own icons, drawn for it (no emoji anywhere). Each icon is a list of shapes on a 32 x 32 grid, so the same
// drawing becomes an inline SVG on the page and a sprite on a canvas (the particles). Emoji in the game's text are
// only names for these: Glyph.fill puts text into an element with every emoji replaced by its drawn icon.
//   Glyph.svg(key, cls)        the icon as SVG markup (key: an icon name or an emoji)
//   Glyph.node(key, cls)       the same as an element
//   Glyph.fill(el, text)       el's content: the text, each emoji in it drawn as its icon
//   Glyph.html(str)            a string of HTML with its emoji swapped for icons
//   Glyph.strip(text)          the text without emoji (for titles and labels read aloud)
//   Glyph.sprite(key, px)      a canvas with the icon drawn px wide (cached), or null for an unknown key
//   Glyph.has(text)            does the text contain an emoji
const Glyph = (() => {
    const INK = "#2b2233";
    // ---- shape helpers: each returns SVG path data ----
    const n1 = v => Math.round(v * 10) / 10;
    const C = (cx, cy, r) => `M${n1(cx - r)} ${n1(cy)}a${n1(r)} ${n1(r)} 0 1 0 ${n1(r * 2)} 0a${n1(r)} ${n1(r)} 0 1 0 ${n1(-r * 2)} 0Z`;
    const E = (cx, cy, rx, ry) => `M${n1(cx - rx)} ${n1(cy)}a${n1(rx)} ${n1(ry)} 0 1 0 ${n1(rx * 2)} 0a${n1(rx)} ${n1(ry)} 0 1 0 ${n1(-rx * 2)} 0Z`;
    const P = (...pts) => "M" + pts.map(([x, y]) => `${n1(x)} ${n1(y)}`).join("L") + "Z";
    const L = (...pts) => "M" + pts.map(([x, y]) => `${n1(x)} ${n1(y)}`).join("L");
    const ST = (cx, cy, R, r, n, rot = -Math.PI / 2) => P(...Array.from({ length: n * 2 }, (_, i) => { const a = rot + i * Math.PI / n, rr = i % 2 ? r : R; return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]; }));
    const RR = (x, y, w, h, r = 3) => `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
    // a part: [d, fill, line width (0: none), line colour]
    const f = (d, fill, w = 2, s = INK) => [d, fill, w, s];
    const line = (d, s, w = 2.4) => [d, "none", w, s];
    const shine = (x, y, rx = 2.6, ry = 1.8) => f(E(x, y, rx, ry), "rgba(255,255,255,.7)", 0);

    // ---- the icons ----
    const flower = (petal, mid = "#ffd23f") => [...Array.from({ length: 5 }, (_, i) => { const a = i / 5 * Math.PI * 2 - Math.PI / 2; return f(C(16 + Math.cos(a) * 7, 16 + Math.sin(a) * 7, 6), petal); }), f(C(16, 16, 4.5), mid)];
    const square = c => [f(RR(5, 5, 22, 22, 4), c), shine(10, 10, 3, 2)];
    const dot = c => [f(C(16, 16, 11), c), shine(12, 11, 3.5, 2.4)];
    const face = (skin, mouth, extra = []) => [f(C(16, 17, 12), skin), f(C(11.5, 15, 1.8), INK, 0), f(C(20.5, 15, 1.8), INK, 0), line(mouth, INK, 2), ...extra];
    const cloud = (c = "#f4f8ff") => f("M8 23A6 6 0 0 1 8.5 11.3A7.5 7.5 0 0 1 22.5 9.5A6.5 6.5 0 0 1 24.5 23Z", c);
    const tree = (c, c2) => [f(RR(14.5, 18, 3, 10, 1), "#7a4a24"), f(C(16, 13, 9), c), f(C(19, 15, 5), c2, 0), shine(12, 9, 3, 2)];
    const pen = (body, tip) => [f(P([6, 26], [9, 19], [22, 6], [26, 10], [13, 23]), body), f(P([6, 26], [9, 19], [13, 23]), tip), f(P([22, 6], [24, 4], [28, 8], [26, 10]), "#ff9fb4")];
    const I = {
        star: [f(ST(16, 16.5, 13, 5.6, 5), "#ffd23f"), shine(12, 12, 2.4, 1.6)],
        star2: [f(ST(16, 16.5, 13, 5.6, 5), "#fff6d8")],
        sparkle: [f(ST(14, 15, 11, 3.2, 4), "#fff1a0", 1.6), f(ST(25, 7, 5, 1.6, 4), "#fff6d8", 1.2), f(ST(24, 25, 3.5, 1.2, 4), "#ffd23f", 1)],
        shooting: [line("M4 26L16 14", "#ffd23f", 3), f(ST(20, 11, 9, 3.6, 5), "#ffd23f")],
        flame: [f("M16 3C21 9 26 13 25 20C24.5 26 20.5 29 16 29C11 29 7 26 7 20.5C7 15 11 12 12 7C14 11 15 13 16 15C17 11 17 7 16 3Z", "#ff7a1f"), f("M16 14C19 18 21 21 20 24C19 27.5 13 27.5 12 24C11 21 14 18 16 14Z", "#ffd23f", 0)],
        bubble: [f(C(16, 16, 11), "rgba(190,235,255,.45)", 1.8, "#4fa8d8"), f(E(12, 11.5, 3.4, 2.2), "#fff", 0), f(C(21, 21, 1.4), "#fff", 0)],
        wind: [line("M4 12H19C23 12 24 6.5 20 6.5C17.5 6.5 17 9 17.5 10", "#7aa8d8", 2.6), line("M4 18H24C28 18 28.5 24 25 24C22.5 24 22 22 22.5 21", "#7aa8d8", 2.6), line("M6 24H14", "#7aa8d8", 2.6)],
        acorn: [f(E(16, 19, 8, 9.5), "#c8843f"), f("M6.5 15C6.5 9 25.5 9 25.5 15Q16 18 6.5 15Z", "#6e4429"), f(RR(15, 4.5, 2.5, 6, 1), "#6e4429"), shine(12.5, 20, 1.6, 3)],
        peanut: [f("M11 6C17 4 20 9 18 13C17 15 21 17 21 21C21 27 13 29 10 25C8 22 12 19 11 16C9 12 6 8 11 6Z", "#d9a868"), line("M12 11h3M13 21h4", "#a8743a", 1.4)],
        leaf: [f("M5 27C5 14 14 5 27 5C27 18 18 27 5 27Z", "#5fb84a"), line("M5 27L21 11M11 21V15M15 17H20", "#2f7a2a", 1.6)],
        leafAutumn: [f("M5 27C5 14 14 5 27 5C27 18 18 27 5 27Z", "#e3772b"), line("M5 27L21 11M11 21V15M15 17H20", "#8a3a14", 1.6)],
        maple: [f(P([16, 3], [19, 10], [26, 7], [23, 14], [29, 17], [22, 19], [24, 26], [17, 22], [16, 29], [15, 22], [8, 26], [10, 19], [3, 17], [9, 14], [6, 7], [13, 10]), "#d9472b"), line("M16 29V12", "#7a1a0a", 1.4)],
        seedling: [line("M16 29V14", "#3f8a3a", 2.6), f("M16 16C10 16 6 12 6 7C12 7 16 10 16 16Z", "#7be36b"), f("M16 13C16 7 20 4 26 4C26 10 22 13 16 13Z", "#5fb84a")],
        wheat: [line("M16 29V5", "#b8862a", 2), ...[8, 13, 18].flatMap(y => [f(E(12.5, y, 3, 4.5), "#e8b84a", 1.4), f(E(19.5, y, 3, 4.5), "#e8b84a", 1.4)])],
        clover: [...[[11, 11], [21, 11], [11, 21], [21, 21]].map(([x, y]) => f(C(x, y, 5.5), "#5fb84a")), line("M16 16L24 29", "#2f7a2a", 2)],
        wave: [f("M3 20C8 12 14 12 16 18C18 24 24 24 29 16V29H3Z", "#3fa0d8"), line("M5 18C8 13 12 13 13 16", "#fff", 2.4)],
        bolt: [f(P([19, 2], [7, 18], [15, 18], [12, 30], [26, 12], [17, 12], [21, 2]), "#ffd23f"), shine(15, 9, 1.4, 2.6)],
        swirl: [line("M16 16C16 14 19 14 19 16.5C19 20 13 20.5 12.5 16C12 11 19 9.5 22 13C25.5 17.5 22 25 15.5 24.5C8 24 5 16.5 8 10.5", "#6b8cff", 3)],
        arrowsCycle: [line("M24 12A9 9 0 0 0 8 11", "#4f86d9", 3), f(P([24, 4], [26, 13], [18, 12]), "#4f86d9", 0), line("M8 20A9 9 0 0 0 24 21", "#4f86d9", 3), f(P([8, 28], [6, 19], [14, 20]), "#4f86d9", 0)],
        snowflake: [line("M16 3V29M4.7 9.5L27.3 22.5M4.7 22.5L27.3 9.5", "#7fc4ff", 3), line("M12 5L16 9L20 5M12 27L16 23L20 27M5 15L9 13M27 17L23 19", "#7fc4ff", 2), f(C(16, 16, 2.5), "#fff", 0)],
        ice: [f(P([16, 3], [28, 9], [28, 23], [16, 29], [4, 23], [4, 9]), "#bfe8ff"), f(P([16, 3], [28, 9], [16, 15], [4, 9]), "#e8f8ff", 0), line("M16 15V29M16 15L28 9M16 15L4 9", "#7ab8e0", 1.4), line("M4 9L16 3L28 9L28 23L16 29L4 23Z", INK, 2)],
        volcano: [f(P([3, 29], [12, 12], [20, 12], [29, 29]), "#6a4a3a"), f("M12 12Q16 15 20 12L18 9Q16 8 14 9Z", "#ff6a1f"), line("M14 13L12 22M18 13L20 20", "#ff8a1f", 2.4), f(C(12, 5, 3), "#9a9098", 0), f(C(17, 4, 2.5), "#b0a8b0", 0)],
        sand: [f("M3 26C7 15 25 15 29 26Z", "#d9a868"), ...[[10, 22], [15, 20], [20, 23], [24, 24], [13, 24]].map(([x, y]) => f(C(x, y, 1), "#a8743a", 0))],
        drop: [f("M16 3C21 11 25 16 25 21A9 9 0 0 1 7 21C7 16 11 11 16 3Z", "#4fb3e0"), shine(12.5, 19, 1.8, 3.2)],
        splash: [f("M11 4C14 9 16 12 16 15A5 5 0 0 1 6 15C6 12 8 9 11 4Z", "#4fb3e0"), f("M22 12C24.5 16 26 18 26 20.5A4 4 0 0 1 18 20.5C18 18 19.5 16 22 12Z", "#7fd4ff"), f("M12 22C13.5 24.5 14.5 26 14.5 27A2.5 2.5 0 0 1 9.5 27C9.5 26 10.5 24.5 12 22Z", "#4fb3e0")],
        ghost: [f("M7 28V14A9 9 0 0 1 25 14V28L21 25L16 28L11 25Z", "#f4f0ff"), f(E(12.5, 14, 1.8, 2.6), INK, 0), f(E(19.5, 14, 1.8, 2.6), INK, 0), f(E(16, 20, 2, 2.4), INK, 0)],
        steam: [line("M9 27C6 22 12 19 9 14C7 10 10 7 10 5", "#c8c4d8", 2.6), line("M16 27C13 22 19 19 16 14C14 10 17 7 17 5", "#c8c4d8", 2.6), line("M23 27C20 22 26 19 23 14C21 10 24 7 24 5", "#c8c4d8", 2.6)],
        burst: [f(ST(16, 16, 14.5, 7, 9, 0), "#ffb02e"), f(ST(16, 16, 8, 4, 9, 0.3), "#fff1a0", 0)],
        anger: [line("M5 12C10 12 12 10 12 5M20 5C20 10 22 12 27 12M27 20C22 20 20 22 20 27M12 27C12 22 10 20 5 20", "#e2483c", 3.4)],
        lock: [line("M10 15V10A6 6 0 0 1 22 10V15", INK, 3), f(RR(6.5, 14, 19, 15, 3), "#f2c14a"), f(C(16, 20.5, 2.2), INK, 0), f(RR(15, 21, 2, 4.5, 1), INK, 0)],
        unlock: [line("M10 15V10A6 6 0 0 1 21.5 8", INK, 3), f(RR(6.5, 14, 19, 15, 3), "#9be07a"), f(C(16, 20.5, 2.2), INK, 0), f(RR(15, 21, 2, 4.5, 1), INK, 0)],
        cloud: [cloud(), shine(13, 14, 3, 1.6)],
        rainCloud: [cloud("#c8d0e0"), line("M10 26L8.5 30M16 26L14.5 30M22 26L20.5 30", "#4f86d9", 2.2)],
        snowCloud: [cloud("#e0e8f4"), ...[[10, 28], [16, 29], [22, 28]].map(([x, y]) => f(C(x, y, 1.6), "#fff", 1, "#7fa8d8"))],
        stormCloud: [cloud("#8a93a8"), f(P([17, 20], [12, 27], [16, 27], [14, 31], [21, 24], [17, 24], [19, 20]), "#ffd23f", 1.4)],
        fog: [line("M4 10H22M8 16H28M4 22H20M10 28H26", "#b8bccb", 3)],
        tornado: [line("M4 6H28M7 11H25M10 16H22M12 21H20M14 26H18", "#b0a08a", 3)],
        sun: [...Array.from({ length: 8 }, (_, i) => { const a = i / 8 * Math.PI * 2; return f(P([16 + Math.cos(a - 0.2) * 9, 16 + Math.sin(a - 0.2) * 9], [16 + Math.cos(a) * 15, 16 + Math.sin(a) * 15], [16 + Math.cos(a + 0.2) * 9, 16 + Math.sin(a + 0.2) * 9]), "#ffb02e", 1.2); }), f(C(16, 16, 7.5), "#ffd23f"), shine(13.5, 13.5, 2, 1.4)],
        sunrise: [f("M5 22A11 11 0 0 1 27 22Z", "#ffd23f"), line("M16 6V9M7 10L9 12M25 10L23 12M3 18H6M29 18H26", "#ffb02e", 2.4), line("M2 22H30M6 27H26", "#4f86d9", 2.4)],
        moon: [f("M20 4A12 12 0 1 0 28 22A9 9 0 1 1 20 4Z", "#fff3b0"), f(C(12, 18, 1.6), "rgba(200,170,90,.5)", 0)],
        newMoon: [f(C(16, 16, 12), "#3a3550"), f(C(12, 12, 2.4), "#2a2640", 0), f(C(20, 19, 3), "#2a2640", 0)],
        scroll: [f(RR(7, 5, 18, 22, 2), "#f3e2b8"), f(E(7, 7, 3, 3), "#e0c890"), f(E(25, 25, 3, 3), "#e0c890"), line("M11 11H21M11 15H21M11 19H18", "#a8864a", 1.6)],
        page: [f(P([7, 3], [20, 3], [26, 9], [26, 29], [7, 29]), "#fffdf6"), f(P([20, 3], [20, 9], [26, 9]), "#e0d8c8"), line("M11 14H22M11 18H22M11 22H19", "#a8b8d0", 1.6)],
        news: [f(RR(4, 7, 24, 19, 2), "#f0ece0"), f(RR(7, 10, 8, 6, 1), "#b8b0a0", 0), line("M18 11H25M18 15H25M7 19H25M7 22H22", "#8a8478", 1.6)],
        swap: [line("M6 11H24M20 6L25 11L20 16", "#4f86d9", 2.8), line("M26 21H8M12 16L7 21L12 26", "#e2483c", 2.8)],
        arrowR: [line("M5 16H25M18 9L25 16L18 23", INK, 3)],
        arrowL: [line("M27 16H7M14 9L7 16L14 23", INK, 3)],
        arrowD: [line("M16 5V25M9 18L16 25L23 18", INK, 3)],
        arrowUD: [line("M16 4V28M10 10L16 4L22 10M10 22L16 28L22 22", INK, 3)],
        arrowLR: [line("M4 16H28M10 10L4 16L10 22M22 10L28 16L22 22", INK, 3)],
        undo: [line("M10 12H20A6 6 0 0 1 20 24H12", "#4f86d9", 3), f(P([4, 12], [11, 6], [11, 18]), "#4f86d9", 0)],
        shuffle: [line("M4 9H9C16 9 16 23 23 23H27M4 23H9C16 23 16 9 23 9H27", "#a35fd6", 2.6), f(P([25, 5], [29, 9], [25, 13]), "#a35fd6", 0), f(P([25, 19], [29, 23], [25, 27]), "#a35fd6", 0)],
        rewind: [f(P([16, 8], [5, 16], [16, 24]), "#4f86d9"), f(P([27, 8], [16, 16], [27, 24]), "#4f86d9")],
        fastForward: [f(P([5, 8], [16, 16], [5, 24]), "#4f86d9"), f(P([16, 8], [27, 16], [16, 24]), "#4f86d9")],
        pause: [f(RR(8, 6, 6, 20, 2), "#4f86d9"), f(RR(18, 6, 6, 20, 2), "#4f86d9")],
        shell: [f("M16 4L28 22Q16 30 4 22Z", "#f4d6c0"), line("M16 4L10 24M16 4L16 26M16 4L22 24M16 4L6 22M16 4L26 22", "#c8987a", 1.4)],
        oyster: [f(E(16, 21, 13, 6), "#a69dc0"), f("M3 21Q16 6 29 21Z", "#8f86a8"), f(C(16, 20, 4), "#fffaf0"), shine(15, 18.5, 1.4, 1)],
        squirrel: [f("M23 28C30 26 31 15 26 9C22 5 17 8 20 12C24 16 24 22 18 24Z", "#c8681c"), f(E(14, 21, 7, 7), "#e0883a"), f(C(11, 12, 5.5), "#e0883a"), f(P([8, 8], [9, 3], [12, 7]), "#c8681c", 1.4), f(C(9.5, 11.5, 1.2), INK, 0), f(E(14, 23, 3.5, 3.5), "#f6dcb0", 0)],
        check: [line("M6 17L13 24L26 8", "#4f8f3a", 4.4)],
        cross: [line("M8 8L24 24M24 8L8 24", "#e2483c", 4.4)],
        brick: [f(RR(3, 7, 26, 18, 2), "#c8603a"), line("M3 13H29M3 19H29M11 7V13M21 7V13M7 13V19M16 13V19M25 13V19M11 19V25M21 19V25", "#7a2a14", 1.4)],
        hole: [f(E(16, 19, 13, 7), "#3a2a20"), f(E(16, 20, 10, 5), "#120808", 0)],
        mirror: [f(E(16, 15, 9, 12), "#e8c66a"), f(E(16, 15, 6.5, 9.5), "#bfe8ff", 0), line("M12 10L15 7M12 15L18 9", "#fff", 1.8), f(RR(14, 26, 4, 4, 1), "#c9a64a")],
        hourglass: [f(P([8, 4], [24, 4], [24, 6], [17, 16], [24, 26], [24, 28], [8, 28], [8, 26], [15, 16], [8, 6]), "rgba(220,240,255,.6)"), f(P([11, 8], [21, 8], [16, 14]), "#f2c66b", 0), f(P([16, 18], [22, 26], [10, 26]), "#f2c66b", 0), f(RR(6, 2, 20, 3, 1), "#8a5a2b"), f(RR(6, 27, 20, 3, 1), "#8a5a2b")],
        stopwatch: [f(C(16, 18, 11), "#f4f8ff"), f(RR(13.5, 2, 5, 4, 1), "#e2483c"), line("M16 18V11M16 18L20 21", INK, 2.4)],
        chains: [f(E(11, 13, 6, 8), "none", 3, "#8a8aa0"), f(E(21, 19, 6, 8), "none", 3, "#a8a8bc")],
        eraser: [f(P([4, 20], [14, 10], [22, 18], [12, 28], [8, 28]), "#ff9fb4"), f(P([14, 10], [20, 4], [28, 12], [22, 18]), "#4f86d9"), line("M4 28H28", INK, 2)],
        sleep: [line("M6 9H14L6 19H14", "#7f9fd8", 2.6), line("M17 15H24L17 24H24", "#9fb8e8", 2.2), line("M24 5H28L24 10H28", "#bfd0f0", 1.8)],
        warning: [f(P([16, 3], [30, 28], [2, 28]), "#ffcf3f"), f(RR(14.5, 11, 3, 9, 1.4), INK, 0), f(C(16, 24, 1.8), INK, 0)],
        candle: [f(RR(11, 14, 10, 15, 2), "#fff6e0"), line("M16 14V11", INK, 1.6), f("M16 3C19 7 19 10 16 11C13 10 13 7 16 3Z", "#ffb02e"), f(E(16, 13.5, 6, 1.6), "#f0e0c0", 0)],
        lamp: [f("M4 20Q16 30 28 20Q16 24 4 20Z", "#c8843f"), f("M24 19C27 15 27 12 25 10C23 13 22 16 24 19Z", "#ffb02e"), f(E(16, 21, 10, 3), "#e0a050", 1.4)],
        bug: [f(E(16, 18, 7, 9), "#7bbf4a"), f(C(16, 8, 4), "#4a8a3a"), line("M9 14L4 11M9 19L3 19M9 24L4 27M23 14L28 11M23 19L29 19M23 24L28 27M14 5L12 2M18 5L20 2", INK, 1.6), line("M16 10V27", "#4a8a3a", 1.4)],
        worm: [line("M4 22C8 14 12 14 14 18C16 22 20 22 22 16C23 13 26 12 28 14", "#e88aa0", 5), f(C(27.5, 13.5, 2.6), "#e88aa0", 1.4), f(C(28, 12.5, 0.8), INK, 0)],
        coin: [f(C(16, 16, 12), "#f2c14a"), f(C(16, 16, 8), "none", 1.6, "#b8860b"), shine(12, 11, 2.6, 1.6)],
        umbrella: [f("M3 16A13 13 0 0 1 29 16Q25.5 13 22.5 16Q19 13 16 16Q13 13 9.5 16Q6.5 13 3 16Z", "#5f7fd8"), line("M16 16V26A3 3 0 0 1 10 26", INK, 2.4)],
        scorpion: [f(E(15, 21, 7, 4.5), "#b8501f"), line("M21 20C27 18 28 10 23 7", "#b8501f", 3.4), f(P([23, 7], [20, 5], [24, 4]), "#e2483c", 1), line("M9 19L5 15M9 23L4 25M12 25L10 29M18 25L19 29", INK, 1.6), f(C(6, 14, 2.6), "#b8501f", 1.4)],
        rose: flower("#e2483c", "#ffb3a0"), cherry: flower("#ffb3d0", "#ff5f98"), blossom: flower("#ffe066", "#e8a01a"), hibiscus: flower("#ff6a5a", "#ffd23f"), florette: flower("#ffffff", "#ffd23f"),
        wilted: [line("M16 29V16C16 12 20 11 22 14", "#6a7a3a", 2.4), f(C(22.5, 17, 4.5), "#a8764a"), f(C(19, 19, 3.5), "#8a5a3a")],
        sponge: [f(RR(5, 9, 22, 15, 4), "#ffd23f"), ...[[10, 14], [16, 18], [21, 13], [23, 20], [11, 20]].map(([x, y]) => f(C(x, y, 1.6), "#e0a01a", 0))],
        candy: [f(P([4, 10], [9, 16], [4, 22]), "#ff5f98"), f(P([28, 10], [23, 16], [28, 22]), "#ff5f98"), f(E(16, 16, 8, 6.5), "#ff8fbf"), line("M12 11L14 21M17 10L19 21", "#fff", 2)],
        lolly: [line("M16 18V30", "#fff", 3.4), line("M16 18V30", INK, 0.8), f(C(16, 11, 9), "#ff5fa2"), line("M16 11m-4.5 0a4.5 4.5 0 1 1 4.5 4.5", "#fff", 2.4)],
        dango: [line("M6 28L27 5", "#c8a070", 2), f(C(11, 22, 4.5), "#ffb3d0"), f(C(16, 16, 4.5), "#fffaf0"), f(C(21, 10, 4.5), "#a6e36b")],
        cupcake: [f(P([8, 17], [24, 17], [21, 29], [11, 29]), "#c8843f"), f("M6 18C6 10 26 10 26 18Z", "#ff9fcf"), f(C(16, 9, 2.6), "#e2483c"), line("M12 18V28M16 18V29M20 18V28", "#a8642a", 1.2)],
        pie: [f("M3 20Q16 26 29 20L27 26Q16 30 5 26Z", "#d9a35c"), f("M3 20Q16 8 29 20Q16 24 3 20Z", "#fffaf0"), f(C(16, 14, 2.4), "#e2483c", 1)],
        honey: [f("M7 13C7 30 25 30 25 13Z", "#f2b030"), f(RR(8, 8, 16, 5, 2), "#c8843f"), f("M12 13C12 17 14 17 14 20C14 22 17 22 17 19V13Z", "#ffd76a", 0)],
        butter: [f(P([4, 18], [18, 12], [28, 16], [14, 22]), "#ffe680"), f(P([4, 18], [14, 22], [14, 26], [4, 22]), "#f0c840"), f(P([14, 22], [28, 16], [28, 20], [14, 26]), "#e0b030")],
        lemon: [f(E(16, 16, 12, 9), "#ffe14a"), f(E(4.5, 16, 1.6, 2), "#ffe14a", 1.4), shine(12, 12, 3, 1.6)],
        temple: [f(P([3, 12], [16, 4], [29, 12]), "#e8c890"), f(RR(5, 12, 22, 3, 1), "#d8b880"), ...[7, 13, 19, 25].map(x => f(RR(x - 1, 15, 3, 10, 1), "#f0dca8", 1.4)), f(RR(3, 25, 26, 4, 1), "#d8b880")],
        dunes: [f("M2 26C8 14 14 14 20 26Z", "#e0b872"), f("M12 26C18 16 24 16 30 26Z", "#c9974f"), f(C(24, 8, 4), "#ffcf3f", 1.4)],
        pencil: pen("#ffd23f", "#f3e6cc"), crayon: pen("#4f86d9", "#4f86d9"), fountain: [f(P([16, 2], [24, 14], [20, 28], [12, 28], [8, 14]), "#3a3a5a"), line("M16 6V18", "#c9a64a", 1.6), f(C(16, 18, 2), "#c9a64a", 0)],
        speaker: [f(P([4, 12], [10, 12], [17, 6], [17, 26], [10, 20], [4, 20]), "#4f86d9"), line("M21 11C24 14 24 18 21 21M24 7C29 12 29 20 24 25", INK, 2.2)],
        mute: [f(P([4, 12], [10, 12], [17, 6], [17, 26], [10, 20], [4, 20]), "#8a8aa0"), line("M21 12L28 20M28 12L21 20", "#e2483c", 2.6)],
        party: [f(P([4, 28], [10, 12], [20, 22]), "#ffcf3f"), line("M10 12L20 22", INK, 1.6), ...[[20, 6, "#e2483c"], [26, 10, "#4f86d9"], [24, 16, "#7be36b"], [16, 4, "#ff5fa2"]].map(([x, y, c]) => f(C(x, y, 2), c, 1))],
        confetti: [f(C(16, 20, 9), "#ffcf3f"), ...[[8, 6, "#e2483c"], [16, 4, "#4f86d9"], [24, 7, "#7be36b"], [28, 14, "#ff5fa2"], [4, 13, "#a35fd6"]].map(([x, y, c]) => f(RR(x - 1.5, y - 1.5, 3, 3, 1), c, 1))],
        firecracker: [f(RR(9, 10, 14, 18, 2), "#e2483c"), line("M16 10C16 6 20 6 20 3", INK, 1.6), f(ST(21, 3, 4, 1.6, 6), "#ffd23f", 1)],
        dove: [f("M4 18C8 12 14 12 18 15L28 8C27 15 24 20 18 22C13 25 7 24 4 18Z", "#ffffff"), f("M12 15C14 10 18 7 22 7C20 11 17 14 12 15Z", "#eef2ff"), f(C(8.5, 16, 1), INK, 0), f(P([3.5, 17], [1, 18.5], [4, 19]), "#ffb02e", 0.8)],
        trident: [line("M16 30V9", "#d9a93a", 3), line("M8 4V11Q16 15 24 11V4M16 3V11", "#d9a93a", 2.8), f(P([6, 6], [8, 2], [10, 6]), "#d9a93a", 1), f(P([14, 5], [16, 1], [18, 5]), "#d9a93a", 1), f(P([22, 6], [24, 2], [26, 6]), "#d9a93a", 1)],
        invader: [f(P([8, 10], [24, 10], [24, 13], [27, 13], [27, 22], [24, 22], [24, 19], [21, 19], [21, 22], [11, 22], [11, 19], [8, 19], [8, 22], [5, 22], [5, 13], [8, 13]), "#ff2bd6", 1.4), f(RR(11, 13, 3, 3, 0), INK, 0), f(RR(18, 13, 3, 3, 0), INK, 0), f(RR(10, 7, 3, 3, 0), "#ff2bd6", 1), f(RR(19, 7, 3, 3, 0), "#ff2bd6", 1)],
        joystick: [f(RR(5, 20, 22, 8, 3), "#3a3a5a"), line("M16 20V9", INK, 2.6), f(C(16, 8, 4.5), "#e2483c"), f(C(24, 24, 1.8), "#ffd23f", 0)],
        gamepad: [f("M7 11H25A5 5 0 0 1 29 17L27 24A3 3 0 0 1 22 25L19 21H13L10 25A3 3 0 0 1 5 24L3 17A5 5 0 0 1 7 11Z", "#5a5a7a"), line("M9 16H13M11 14V18", "#fff", 2), f(C(21, 15, 1.6), "#ff2bd6", 0), f(C(24, 17, 1.6), "#2bf0ff", 0)],
        tv: [f(RR(3, 8, 26, 18, 3), "#5a5a7a"), f(RR(6, 11, 16, 12, 2), "#2bf0ff", 0), line("M11 3L16 8L21 3", INK, 2), f(C(25.5, 13, 1.4), "#ff2bd6", 0)],
        floppy: [f(RR(5, 5, 22, 22, 2), "#4f86d9"), f(RR(10, 5, 12, 8, 1), "#e8eef8", 0), f(RR(9, 17, 14, 10, 1), "#f4f8ff", 0)],
        symbols: [f(RR(4, 4, 24, 24, 4), "#a35fd6"), line("M9 11H15M12 8V14M18 19L23 24M23 19L18 24M17 11H23", "#fff", 2)],
        signal: [f(RR(5, 20, 4, 8, 1), "#7be36b"), f(RR(12, 15, 4, 13, 1), "#7be36b"), f(RR(19, 9, 4, 19, 1), "#7be36b"), f(RR(26, 4, 3, 24, 1), "#c8e8b8")],
        bomb: [f(C(14, 19, 10), "#2b2233"), line("M20 10L23 6", INK, 2.4), f(ST(25, 5, 5, 2, 6), "#ffb02e", 1), f(E(10, 15, 2.6, 1.8), "rgba(255,255,255,.4)", 0)],
        tree: tree("#5fb84a", "#4a9a3a"), pine: [f(RR(14.5, 24, 3, 6, 1), "#7a4a24"), f(P([16, 2], [26, 15], [21, 15], [28, 25], [4, 25], [11, 15], [6, 15]), "#2f8a5a")],
        palm: [line("M16 29C17 22 17 15 15 10", "#8a5a2a", 3), ...[[-1, 0.4], [1, 0.4], [-1, -0.3], [1, -0.3]].map(([s, k]) => f(`M15 10Q${15 + s * 8} ${4 + k * 10} ${15 + s * 13} ${10 + k * 6}Q${15 + s * 7} ${8 + k * 4} 15 10Z`, "#3f9a5a", 1.4))],
        cactus: [f(RR(13, 5, 6, 24, 3), "#4f9a4a"), f(RR(6, 10, 4, 10, 2), "#4f9a4a"), f(RR(22, 8, 4, 10, 2), "#4f9a4a"), line("M10 18H13M19 15H22", "#4f9a4a", 4)],
        planet: [f(C(16, 16, 9), "#c9a6ff"), line("M3 20C3 16 29 9 29 13C29 17 3 24 3 20Z", "#f2c14a", 2), shine(12.5, 12.5, 2.4, 1.6)],
        globe: [f(C(16, 16, 12), "#4fa6e0"), f("M9 8C13 9 12 14 9 16C7 18 10 22 8 25C5 21 5 12 9 8Z", "#5fb84a", 0), f("M19 6C22 9 24 12 21 15C19 17 22 21 24 22C27 18 27 10 19 6Z", "#5fb84a", 0)],
        heart: [f("M16 28C2 18 3 6 11 6C14 6 16 9 16 9C16 9 18 6 21 6C29 6 30 18 16 28Z", "#ff6a9a"), shine(10.5, 11, 2.2, 1.4)],
        heartWhite: [f("M16 28C2 18 3 6 11 6C14 6 16 9 16 9C16 9 18 6 21 6C29 6 30 18 16 28Z", "#ffffff")],
        heartGreen: [f("M16 28C2 18 3 6 11 6C14 6 16 9 16 9C16 9 18 6 21 6C29 6 30 18 16 28Z", "#5fd06a")],
        note: [f(E(10, 24, 5, 4), INK, 0), line("M14.5 23V5L24 8", INK, 2.6)],
        notes: [f(E(8, 25, 4.5, 3.5), INK, 0), f(E(22, 21, 4.5, 3.5), INK, 0), line("M12 24V7L26 4V20", INK, 2.4)],
        hush: [f(C(16, 16, 12), "#ffd76a"), f(C(11.5, 13, 1.6), INK, 0), f(C(20.5, 13, 1.6), INK, 0), f(RR(15, 16, 3, 12, 1.4), "#ffcf9a", 1.2), line("M11 21H14M18 21H21", INK, 1.6)],
        plane: [f(P([3, 16], [29, 5], [18, 28], [15, 19]), "#ffffff"), f(P([15, 19], [29, 5], [12, 22]), "#e0e8f4"), line("M15 19L29 5", INK, 1.4)],
        kite: [f(P([16, 2], [26, 13], [16, 22], [6, 13]), "#e2483c"), f(P([16, 2], [26, 13], [16, 13]), "#ffd23f", 0), line("M16 22C14 25 18 27 15 30", INK, 1.6)],
        mitten: [f("M9 29V15C9 10 11 7 15 7C19 7 21 10 21 14L24 12C27 11 28 14 26 16L21 21V29Z", "#e2483c"), f(RR(8, 25, 14, 4, 1), "#f4f0ff", 1.4)],
        bandage: [f(RR(3, 12, 26, 9, 4), "#e8c8a0"), f(RR(11, 12, 10, 9, 1), "#f6e0c8", 0), ...[[13, 15], [16, 18], [19, 15]].map(([x, y]) => f(C(x, y, 0.8), "#a8864a", 0))],
        feather: [f("M26 3C14 5 8 13 7 25L9 25C12 18 18 12 26 3Z", "#ffffff"), line("M27 3L5 29", INK, 1.6), line("M12 18L9 16M15 14L12 11M18 10L16 7", "#b0a8c8", 1.2)],
        skull: [f("M16 4C24 4 28 9 27 16C27 20 23 21 23 24V27H9V24C9 21 5 20 5 16C4 9 8 4 16 4Z", "#f4f0e8"), f(E(11.5, 15.5, 3, 3.4), INK, 0), f(E(20.5, 15.5, 3, 3.4), INK, 0), line("M13 27V24M16 27V24M19 27V24", INK, 1.4)],
        owl: [f(E(16, 18, 11, 11), "#8a5a3b"), f(C(11, 15, 4.5), "#fff6e0"), f(C(21, 15, 4.5), "#fff6e0"), f(C(11, 15, 2), INK, 0), f(C(21, 15, 2), INK, 0), f(P([16, 18], [14, 21], [18, 21]), "#ffb02e", 1), f(P([6, 9], [9, 4], [11, 10]), "#8a5a3b", 1.4), f(P([26, 9], [23, 4], [21, 10]), "#8a5a3b", 1.4)],
        octopus: [f(E(16, 12, 10, 9), "#a35fd6"), line("M8 18C6 24 9 26 7 29M12 20C11 25 14 27 12 30M20 20C21 25 18 27 20 30M24 18C26 24 23 26 25 29", "#a35fd6", 3), f(C(12, 12, 2), "#fff", 0), f(C(20, 12, 2), "#fff", 0)],
        camel: [f("M3 22C5 16 9 14 12 16C13 11 17 10 19 14C21 10 24 10 25 14L28 10L30 12L27 17C27 21 24 22 22 22Z", "#d9a868"), line("M7 22V29M11 22V29M19 22V29M23 22V29", INK, 2)],
        mountain: [f(P([2, 28], [14, 6], [22, 18], [25, 13], [30, 28]), "#8a8aa0"), f(P([14, 6], [18, 13], [15, 12], [12, 14], [10, 12]), "#ffffff", 1.2)],
        tophat: [f(RR(9, 6, 14, 16, 1), "#2b2233"), f(RR(4, 21, 24, 4, 2), "#2b2233"), f(RR(9, 17, 14, 3, 0), "#e2483c", 0)],
        fleur: [f("M16 3C19 7 19 12 16 18C13 12 13 7 16 3Z", "#d9a93a"), f("M15 17C10 18 6 14 7 10C9 13 12 14 15 14Z", "#d9a93a"), f("M17 17C22 18 26 14 25 10C23 13 20 14 17 14Z", "#d9a93a"), f(RR(10, 17, 12, 3, 1), "#d9a93a"), f("M16 20V28M12 28H20", "none", 2.4, "#d9a93a")],
        question: [line("M10 11C10 3 22 3 22 10C22 15 16 15 16 20", "#a35fd6", 3.6), f(C(16, 26, 2.2), "#a35fd6", 0)],
        chair: [f(RR(9, 4, 14, 12, 2), "#a8743a"), f(RR(8, 16, 16, 4, 1), "#c8945a"), line("M10 20V29M22 20V29", "#7a4a24", 2.6)],
        book: [f("M3 7Q9 5 16 8V27Q9 24 3 26Z", "#fffdf6"), f("M29 7Q23 5 16 8V27Q23 24 29 26Z", "#f6ecd2"), line("M6 12Q10 11 13 12M6 16Q10 15 13 16M19 12Q22 11 26 12M19 16Q22 15 26 16", "#a8b8d0", 1.2)],
        bookBlue: [f(RR(6, 4, 20, 24, 2), "#4f86d9"), f(RR(9, 4, 2, 24, 0), "#2f5fa8", 0), line("M14 10H22M14 14H20", "#fff", 1.6)],
        books: [f(RR(4, 8, 6, 20, 1), "#e2483c"), f(RR(11, 5, 6, 23, 1), "#4f86d9"), f(P([19, 9], [24, 7], [29, 27], [24, 29]), "#7be36b")],
        magnifier: [f(C(13, 13, 8), "rgba(190,235,255,.6)", 2.6), line("M19 19L28 28", INK, 4)],
        juggle: [f(C(8, 14, 4), "#e2483c"), f(C(16, 7, 4), "#ffd23f"), f(C(24, 14, 4), "#4f86d9"), line("M6 26Q16 18 26 26", "#a35fd6", 2)],
        shield: [f("M16 3L27 7V15C27 22 22 27 16 29C10 27 5 22 5 15V7Z", "#4f86d9"), f("M16 6L24 9V15C24 20 20 24 16 26Z", "#7fa8e8", 0)],
        gift: [f(RR(5, 13, 22, 15, 2), "#e2483c"), f(RR(4, 9, 24, 5, 1), "#ff6a6a"), f(RR(14.5, 9, 3, 19, 0), "#ffd23f", 0), line("M16 9C12 3 8 6 12 9M16 9C20 3 24 6 20 9", INK, 1.8)],
        map: [f(P([3, 7], [11, 4], [21, 7], [29, 4], [29, 25], [21, 28], [11, 25], [3, 28]), "#f3e2b8"), line("M11 4V25M21 7V28", "#c8a86a", 1.4), line("M6 20L10 15L15 18L19 12L25 15", "#e2483c", 1.8)],
        rocket: [f("M16 2C22 7 22 17 20 22H12C10 17 10 7 16 2Z", "#f4f8ff"), f(C(16, 12, 3), "#4f86d9"), f(P([12, 18], [6, 24], [12, 23]), "#e2483c"), f(P([20, 18], [26, 24], [20, 23]), "#e2483c"), f("M13 22Q16 31 19 22Z", "#ffb02e")],
        horn: [f("M4 12L18 8V24L4 20Z", "#f2c14a"), f(E(20, 16, 4, 9), "#f2c14a"), line("M22 16H29", INK, 2)],
        abacus: [f(RR(4, 5, 24, 22, 2), "none", 2.6, "#a8743a"), ...[11, 16, 21].flatMap((y, r) => [line(`M5 ${y}H27`, "#a8743a", 1.4), ...[0, 1, 2].map(k => f(C(9 + k * 5 + r * 3, y, 2.2), ["#e2483c", "#4f86d9", "#ffd23f"][k], 1))])],
        eyes: [f(E(10, 16, 6, 8), "#fff"), f(E(22, 16, 6, 8), "#fff"), f(C(11, 17, 3), INK, 0), f(C(23, 17, 3), INK, 0)],
        trophy: [f("M9 4H23V11C23 16 20 19 16 19C12 19 9 16 9 11Z", "#f2c14a"), line("M9 7H5C5 12 7 13 9 13M23 7H27C27 12 25 13 23 13", "#f2c14a", 2.2), f(RR(14, 19, 4, 5, 0), "#f2c14a", 1.4), f(RR(9, 24, 14, 4, 1), "#a8743a")],
        medal: [f(P([10, 3], [16, 12], [22, 3]), "#4f86d9", 1.4), f(C(16, 19, 8), "#c8c8d8"), f(C(16, 19, 5), "#e8e8f0", 0)],
        wrench: [line("M7 25L19 13", "#8a8aa0", 4.4), f("M18 14A7 7 0 1 1 26 6L22 10L24 12L28 8A7 7 0 0 1 18 14Z", "#8a8aa0")],
        bolt2: [f(P([10, 4], [22, 4], [26, 10], [22, 16], [10, 16], [6, 10]), "#9aa4b4"), f(RR(13.5, 16, 5, 12, 1), "#7a8494")],
        gear: [f(ST(16, 16, 13, 10, 8, 0), "#9aa4b4"), f(C(16, 16, 4.5), "#4a5260", 0)],
        robotArm: [line("M5 27L12 17L22 12", "#8a95a8", 5), f(C(12, 17, 3), "#ffc43d"), f(P([21, 7], [28, 9], [27, 16], [21, 14]), "#5a6578")],
        battery: [f(RR(4, 9, 22, 14, 2), "#f4f8ff"), f(RR(26, 13, 3, 6, 1), INK, 0), f(RR(7, 12, 12, 8, 1), "#7be36b", 0)],
        bulb: [f("M16 3A9 9 0 0 1 21 20V23H11V20A9 9 0 0 1 16 3Z", "#ffe14a"), f(RR(11, 23, 10, 5, 1), "#9aa4b4"), line("M13 19L16 13L19 19", "#c8a01a", 1.4)],
        die: [f(RR(5, 5, 22, 22, 4), "#ffffff"), ...[[11, 11], [21, 11], [16, 16], [11, 21], [21, 21]].map(([x, y]) => f(C(x, y, 2), INK, 0))],
        target: [f(C(16, 16, 12), "#ffffff"), f(C(16, 16, 8.5), "#e2483c", 0), f(C(16, 16, 5), "#ffffff", 0), f(C(16, 16, 2), "#e2483c", 0)],
        cart: [f(P([4, 6], [8, 6], [11, 20], [25, 20], [28, 10], [9, 10]), "#4f86d9"), f(C(13, 25, 2.4), INK, 0), f(C(23, 25, 2.4), INK, 0)],
        swords: [line("M6 6L26 26M26 6L6 26", "#9aa4b4", 3.4), line("M10 21L6 25M22 21L26 25", "#a8743a", 4)],
        snowman: [f(C(16, 22, 8), "#fff"), f(C(16, 10, 6), "#fff"), f(C(14, 9, 1), INK, 0), f(C(18, 9, 1), INK, 0), f(P([16, 11], [21, 12], [16, 12.5]), "#ff8a2a", 0)],
        rainbow: [...[["#e2483c", 13], ["#ffb02e", 10.5], ["#ffe14a", 8], ["#7be36b", 5.5]].map(([c, r]) => line(`M${16 - r} 26A${r} ${r} 0 0 1 ${16 + r} 26`, c, 3))],
        knot: [line("M12 12V8A4 4 0 1 0 8 12H24A4 4 0 1 0 20 8V24A4 4 0 1 0 24 20H8A4 4 0 1 0 12 24Z", INK, 2.2)],
        asterisk: [line("M16 4V28M5.6 10L26.4 22M5.6 22L26.4 10", "#a35fd6", 3.2)],
        devil: face("#a35fd6", "M10 21Q16 26 22 21", [f(P([6, 8], [8, 2], [11, 7]), "#a35fd6", 1.4), f(P([26, 8], [24, 2], [21, 7]), "#a35fd6", 1.4)]),
        angry: face("#ff7a5a", "M11 24Q16 20 21 24", [line("M8 11L14 13M24 11L18 13", INK, 2)]),
        cold: face("#9fd0ff", "M10 22H22", [line("M11 22V24M14 22V24M17 22V24M20 22V24", INK, 1.2)]),
        hot: face("#ff7a5a", "M11 22Q16 26 21 22", [f("M26 6C28 9 28 11 26 12C24 11 24 9 26 6Z", "#7fd4ff", 1)]),
        melt: face("#ffd76a", "M11 21Q16 24 21 21", [f("M8 27Q10 31 12 27Q14 31 16 28Z", "#ffd76a", 1.4)]),
        sneeze: face("#ffd76a", "M12 22Q16 24 20 22", [f(E(26, 20, 4, 3), "#bfe8ff", 1.2)]),
        monkey: [f(C(16, 16, 11), "#a8743a"), f(E(16, 18, 7, 6), "#e8c49a", 0), f(RR(7, 12, 18, 5, 2.5), "#a8743a", 1.6)],
        fist: [f(RR(7, 9, 18, 17, 5), "#ffcf9a"), line("M11 9V16M16 9V16M21 9V16", "#c8945a", 1.4)],
        hand: [f("M9 29V14C9 12 12 12 12 14V7C12 5 15 5 15 7V6C15 4 18 4 18 6V8C18 6 21 6 21 8V18L23 15C24 13 27 14 26 16L21 25V29Z", "#ffcf9a")],
        rock: [f(P([4, 24], [8, 12], [16, 6], [25, 10], [28, 22], [20, 27], [10, 27]), "#9a8e86"), f(P([16, 6], [25, 10], [18, 14]), "#b4aaa2", 0)],
    };
    const COLOR = { brown: "#a8743a", yellow: "#ffd23f", blue: "#4f86d9", green: "#7be36b", red: "#e2483c", orange: "#ff8a2a", purple: "#a35fd6", black: "#2b2233", white: "#ffffff" };
    for (const [k, c] of Object.entries(COLOR)) { I["sq-" + k] = square(c); I["dot-" + k] = dot(c); }

    // ---- every emoji the game used, and its icon ----
    const EMOJI = {
        "✨": "sparkle", "🔥": "flame", "🫧": "bubble", "💨": "wind", "🌬": "wind", "🌰": "acorn", "🥜": "peanut", "🌿": "leaf", "🍃": "leaf", "★": "star", "⭐": "star", "🌟": "star",
        "☆": "star2", "🌊": "wave", "⚡": "bolt", "🌩": "stormCloud", "🌀": "swirl", "❄": "snowflake", "🌨": "snowCloud", "🌋": "volcano", "🟫": "sq-brown", "🟤": "dot-brown",
        "💧": "drop", "💦": "splash", "👻": "ghost", "♨": "steam", "💥": "burst", "💢": "anger", "🔒": "lock", "🔓": "unlock", "🧊": "ice", "🥶": "cold", "☁": "cloud", "🌫": "fog",
        "🌧": "rainCloud", "☀": "sun", "🌅": "sunrise", "📜": "scroll", "📄": "page", "📃": "page", "🗞": "news", "⇄": "swap", "🔀": "shuffle", "🔁": "arrowsCycle", "🔄": "arrowsCycle",
        "🌱": "seedling", "🌾": "wheat", "🍀": "clover", "☘": "clover", "🐚": "shell", "🦪": "oyster", "🐿": "squirrel", "✓": "check", "✔": "check", "✅": "check", "🧱": "brick",
        "🕳": "hole", "⚫": "dot-black", "⚪": "dot-white", "🪞": "mirror", "💫": "sparkle", "✦": "sparkle", "✧": "sparkle", "✳": "asterisk", "✴": "sparkle", "❇": "sparkle", "✱": "asterisk",
        "⏳": "hourglass", "⌛": "hourglass", "⏱": "stopwatch", "⏲": "stopwatch", "🌑": "newMoon", "🌙": "moon", "☾": "moon", "⛓": "chains", "⌫": "eraser", "💤": "sleep", "⚠": "warning",
        "🕯": "candle", "🪔": "lamp", "🐛": "bug", "🪱": "worm", "🪙": "coin", "☂": "umbrella", "🦂": "scorpion", "🌹": "rose", "🌸": "cherry", "🌼": "blossom", "🌺": "hibiscus",
        "❀": "florette", "✿": "florette", "🥀": "wilted", "🧽": "sponge", "🍬": "candy", "🍭": "lolly", "🍡": "dango", "🧁": "cupcake", "🥧": "pie", "🍯": "honey", "🧈": "butter",
        "🍋": "lemon", "🏛": "temple", "🏜": "dunes", "✏": "pencil", "✎": "pencil", "🖊": "pencil", "🖍": "crayon", "🖋": "fountain", "✒": "fountain", "🔊": "speaker", "🔉": "speaker",
        "🔈": "speaker", "🔇": "mute", "🎉": "party", "🎊": "confetti", "🧨": "firecracker", "🕊": "dove", "🔱": "trident", "👾": "invader", "🕹": "joystick", "🎮": "gamepad",
        "📺": "tv", "💾": "floppy", "🔣": "symbols", "📶": "signal", "💣": "bomb", "🌳": "tree", "🌲": "pine", "🌴": "palm", "🌵": "cactus", "🌪": "tornado", "🪐": "planet",
        "🌍": "globe", "🩷": "heart", "🤍": "heartWhite", "💚": "heartGreen", "🎶": "notes", "🎵": "note", "♪": "note", "♫": "notes", "♩": "note", "🤫": "hush", "🙈": "monkey",
        "✈": "plane", "🛩": "plane", "🪁": "kite", "🧤": "mitten", "✊": "fist", "✋": "hand", "🩹": "bandage", "🪶": "feather", "☠": "skull", "💀": "skull", "🦉": "owl", "🦑": "octopus",
        "🐙": "octopus", "🐪": "camel", "🏔": "mountain", "🎩": "tophat", "⚜": "fleur", "❓": "question", "🪑": "chair", "📖": "book", "📘": "bookBlue", "📚": "books", "🔍": "magnifier",
        "🤹": "juggle", "🛡": "shield", "🎁": "gift", "🟨": "sq-yellow", "🟦": "sq-blue", "🟩": "sq-green", "🟥": "sq-red", "🟧": "sq-orange", "⬛": "sq-black", "⬜": "sq-white",
        "🔴": "dot-red", "🟡": "dot-yellow", "🟣": "dot-purple", "🔵": "dot-blue", "🟢": "dot-green", "🗺": "map", "🚀": "rocket", "📯": "horn", "🧮": "abacus", "👀": "eyes",
        "🫠": "melt", "🏆": "trophy", "🥈": "medal", "🔧": "wrench", "🔩": "bolt2", "⚙": "gear", "🦾": "robotArm", "🔋": "battery", "💡": "bulb", "🎲": "die", "🎯": "target",
        "🛒": "cart", "⚔": "swords", "⛄": "snowman", "🌈": "rainbow", "⌘": "knot", "😈": "devil", "😡": "angry", "🤬": "angry", "🥵": "hot", "🤧": "sneeze", "🪨": "rock",
        "🍂": "leafAutumn", "🍁": "maple", "🌠": "shooting", "🏛️": "temple", "🔺": "warning", "🍦": "cupcake", "🧸": "squirrel", "🎪": "party", "🎈": "party",
        "→": "arrowR", "➡": "arrowR", "←": "arrowL", "↓": "arrowD", "↕": "arrowUD", "↔": "arrowLR", "↩": "undo", "⏪": "rewind", "⏩": "fastForward", "⏭": "fastForward", "⏸": "pause",
        "✕": "cross", "❌": "cross", "✖": "cross", "☾": "moon", "🌙": "moon", "🌞": "sun"
    };
    // the emoji we look for (anything pictographic, plus the arrows and symbols the game used as icons)
    const FIND = /(?:[\u{1F000}-\u{1FAFF}]|[←-⇿⌀-⏿☀-➿⬀-⯿])️?/gu;
    const keyOf = e => (e || "").replace(/️/g, "");
    const nameOf = key => I[key] ? key : EMOJI[keyOf(key)] || null;
    const has = text => typeof text === "string" && (FIND.lastIndex = 0, FIND.test(text));

    function svg(key, cls = "") {
        const name = nameOf(key) || "sparkle";
        return `<svg class="glyph ${cls}" viewBox="0 0 32 32" aria-hidden="true" focusable="false">` + I[name].map(([d, fill, w, s]) =>
            `<path d="${d}" fill="${fill}"${w ? ` stroke="${s}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"` : ""}/>`).join("") + "</svg>";
    }
    function node(key, cls = "") { const t = document.createElement("template"); t.innerHTML = svg(key, cls); return t.content.firstChild; }
    function fill(el, value) { el.textContent = value == null ? "" : String(value); return el; }
    // (only in the text between tags: an emoji inside an attribute is dropped, never turned into markup)
    const html = str => (has(str) ? String(str).split(/(<[^>]*>)/).map(part => part.startsWith("<") ? part.replace(FIND, "") : part.replace(FIND, m => svg(m, "inline"))).join("") : str);
    const strip = text => (has(text) ? String(text).replace(FIND, "").replace(/\s{2,}/g, " ").replace(/^\s+|\s+$/g, "") : text);
    // a canvas sprite of an icon (for the particles), drawn from the same shapes
    const paths = new Map(), sprites = new Map();
    function sprite(key, px = 64) {
        const name = nameOf(key);
        if (!name) return null;
        const id = name + "|" + px;
        if (sprites.has(id)) return sprites.get(id);
        const c = document.createElement("canvas"); c.width = c.height = px;
        const g = c.getContext("2d"); g.scale(px / 32, px / 32); g.lineJoin = "round"; g.lineCap = "round";
        for (const [d, fl, w, s] of I[name]) {
            let p = paths.get(d); if (!p) { p = new Path2D(d); paths.set(d, p); }
            if (fl !== "none") { g.fillStyle = fl; g.fill(p); }
            if (w) { g.strokeStyle = s; g.lineWidth = w; g.stroke(p); }
        }
        sprites.set(id, c);
        return c;
    }
    // Every way text reaches the page goes through these: setting an element's text or HTML draws its emoji as icons,
    // and a title or label read aloud has them taken out. (Text without emoji takes the browser's own path.)
    const text = Object.getOwnPropertyDescriptor(Node.prototype, "textContent"), inner = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML"), setAttr = Element.prototype.setAttribute;
    function fillRaw(el, value) {
        if (!has(value)) { text.set.call(el, value); return; }
        el.replaceChildren(...nodesOf(value));
    }
    // strings handed to append, prepend, replaceChildren, before and after: their emoji become icons too
    const nodesOf = str => { const parts = []; let last = 0; FIND.lastIndex = 0;
        for (const m of str.matchAll(FIND)) { if (m.index > last) parts.push(document.createTextNode(str.slice(last, m.index))); parts.push(node(m[0], "inline")); last = m.index + m[0].length; }
        if (last < str.length) parts.push(document.createTextNode(str.slice(last)));
        return parts; };
    const convert = args => args.flatMap(a => (typeof a === "string" && has(a) ? nodesOf(a) : [a]));
    for (const proto of [Element.prototype, DocumentFragment.prototype]) for (const m of ["append", "prepend", "replaceChildren"]) { const orig = proto[m]; if (orig) proto[m] = function (...args) { return orig.apply(this, convert(args)); }; }
    for (const m of ["before", "after"]) { const orig = Element.prototype[m]; if (orig) Element.prototype[m] = function (...args) { return orig.apply(this, convert(args)); }; }
    Object.defineProperty(HTMLElement.prototype, "textContent", { configurable: true, get() { return text.get.call(this); }, set(v) { fillRaw(this, v == null ? "" : String(v)); } });
    Object.defineProperty(HTMLElement.prototype, "innerHTML", { configurable: true, get() { return inner.get.call(this); }, set(v) { inner.set.call(this, typeof v === "string" ? html(v) : v); } });
    Element.prototype.setAttribute = function (name, value) { return setAttr.call(this, name, (name === "title" || name === "aria-label" || name === "alt" || name === "placeholder") && typeof value === "string" ? strip(value) : value); };
    // every icon as a CSS image too (--g-name), for the stylesheets' ::before and ::after pictures (set once, at load)
    const style = document.createElement("style");
    style.textContent = ":root{" + Object.keys(I).map(k => `--g-${k}:url("data:image/svg+xml,${encodeURIComponent(svg(k).replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"'))}")`).join(";") + "}";
    document.head.appendChild(style);
    return { svg, node, fill, html, strip, sprite, has, names: () => Object.keys(I), EMOJI, FIND };
})();
