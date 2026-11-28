// The Collection: looks for your board that you win from the quests' boxes (quests.js, boxes.js) or buy with coins.
//   Board colours: 100 of them, for any world's board (its squares, the lines between them, the black squares and
//   the letters), in families, each common, uncommon, rare, epic or legendary. Legendary ones only come from boxes.
//   Letter styles: the lettering on the board, in the game's own fonts.
//   Win effects: a burst over the board when you solve. Typing trails: a puff from each letter you type.
//   Highlights: the colours of the square and the word you're on.
//   The hero parts the Weekly Quests give (hero.js QUEST_PARTS) are owned here too.
// Collection.open() is the menu (from Home's Quests card and Settings): every colour and style, a preview of each,
// Use / Buy / where to win it. The beta's Unlock All (campaign.js) opens everything.
//   Saved in this browser: schmoll.rewards { owned: [ids], badges: [weeks], finish: id, letters: id, boxes: [unopened] }
const Collection = (() => {
    const RARITY = { c: "common", u: "uncommon", r: "rare", e: "epic", l: "legendary" };
    const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];
    const PRICE = { common: 80, uncommon: 130, rare: 200, epic: 450, legendary: null };
    const RARITY_NAME = { common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary" };
    const RARITY_COLOR = { common: "#8a8f98", uncommon: "#3aa860", rare: "#2f7ad8", epic: "#8a4fd0", legendary: "#e0a020" };
    // (the plainer half of the commons are uncommon)
    const UNCOMMON = new Set(["Lagoon", "Brick", "Olive", "Denim", "Clay", "Stone", "Teal", "Plum", "Mustard", "Navy", "Iron", "Moss", "Bamboo", "Wheat",
        "Pine", "Blueberry", "Caramel", "Vanilla", "Raspberry", "Honey", "Newsprint", "Poster", "Slab", "Geometric", "Chunky"]);
    const rank = x => RARITIES.indexOf(x.rarity);

    // name, family, rarity, square, lines, letters
    const COLOUR_ROWS = [
        ["Paper", "Classics", "c", "#fffdf6", "#2b2b33", "#1e1e24"], ["Ink", "Classics", "c", "#f4f1ea", "#1d2a44", "#1d2a44"],
        ["Slate", "Classics", "c", "#eef1f4", "#4a5562", "#1f2933"], ["Charcoal", "Classics", "c", "#2a2b30", "#111215", "#f1f1f3"],
        ["Cream", "Classics", "c", "#fff8e6", "#8a6a3a", "#3a2a10"], ["Sky", "Classics", "c", "#eef7ff", "#3a86d6", "#12345a"],
        ["Grass", "Classics", "c", "#f1fbe9", "#4a9a3a", "#183a10"], ["Sunflower", "Classics", "c", "#fffbe0", "#e0a800", "#3a2e00"],
        ["Tomato", "Classics", "c", "#fff1ee", "#d6412f", "#4a120a"], ["Grape", "Classics", "c", "#f6f0ff", "#6a3fc0", "#2a1450"],
        ["Lagoon", "Classics", "c", "#eaf8fb", "#1b7a8c", "#0d3440"], ["Brick", "Classics", "c", "#fbefe8", "#a2462d", "#401808"],
        ["Olive", "Classics", "c", "#f7f7e6", "#6b7a2a", "#2a3010"], ["Denim", "Classics", "c", "#eef2fb", "#3a5a9a", "#182848"],
        ["Clay", "Classics", "c", "#fbf0e6", "#b06a3a", "#40220e"], ["Stone", "Classics", "c", "#f2f0ec", "#7a756d", "#2a2826"],
        ["Teal", "Classics", "c", "#e8faf6", "#188a78", "#0a3a32"], ["Plum", "Classics", "c", "#fbeff6", "#8a2a64", "#3a0a2a"],
        ["Mustard", "Classics", "c", "#fdf6dc", "#b8901a", "#3a2e08"], ["Navy", "Classics", "c", "#eef0f8", "#1e2a5a", "#141c40"],
        ["Ruby", "Gems", "r", "#fff0f2", "#b0102e", "#4a0010"], ["Emerald", "Gems", "r", "#ecfbf2", "#0f8a4a", "#063a1e"],
        ["Sapphire", "Gems", "r", "#eef3ff", "#1f4fc8", "#0e2260"], ["Amethyst", "Gems", "r", "#f6effd", "#8a4fd0", "#361460"],
        ["Topaz", "Gems", "r", "#fff6e6", "#e08a10", "#4a2a00"], ["Garnet", "Gems", "r", "#fbeef0", "#7a1428", "#3a0812"],
        ["Jade", "Gems", "r", "#eefaf2", "#3a9a6a", "#143a26"], ["Aquamarine", "Gems", "r", "#ecfbfb", "#3abcc0", "#0e4446"],
        ["Citrine", "Gems", "r", "#fffbe2", "#d8b400", "#3e3400"], ["Peridot", "Gems", "r", "#f6fde6", "#7ab81a", "#2a4206"],
        ["Turquoise", "Gems", "r", "#e8fbf8", "#1ab0a0", "#08403a"], ["Lapis", "Gems", "r", "#eef0fb", "#26389a", "#121a4a"],
        ["Opal", "Gems", "e", "#f8f6ff", "#9aa8d8", "#2e3456"], ["Onyx", "Gems", "e", "#1a1a1e", "#000000", "#e8e8ee"],
        ["Pearl", "Gems", "e", "#fffefa", "#d8d0c2", "#3a362e"], ["Moonstone", "Gems", "e", "#f2f4fb", "#8a94b8", "#262c44"],
        ["Obsidian", "Gems", "e", "#15121c", "#2e2540", "#e6def8"], ["Tanzanite", "Gems", "e", "#f2efff", "#4a3ab8", "#1e1650"],
        ["Rose Quartz", "Gems", "r", "#fff2f5", "#e090a8", "#4a1e2a"], ["Malachite", "Gems", "r", "#e8f8ee", "#1a7a4a", "#08301c"],
        ["Gold", "Metals", "e", "#fff4cf", "#b8860b", "#3a2a00"], ["Silver", "Metals", "r", "#f6f7f9", "#9aa0aa", "#2a2e36"],
        ["Bronze", "Metals", "r", "#fbefe2", "#a8682a", "#3a220a"], ["Copper", "Metals", "r", "#fff0e8", "#c0603a", "#401c0c"],
        ["Platinum", "Metals", "e", "#fbfbfd", "#c0c6d0", "#2c3038"], ["Rose Gold", "Metals", "e", "#fff2ee", "#d88a78", "#4a221a"],
        ["Iron", "Metals", "c", "#e8e9ec", "#4e5258", "#1c1e22"], ["Brass", "Metals", "r", "#fdf6e0", "#b89a3a", "#3a300e"],
        ["Chrome", "Metals", "e", "#f4f8fb", "#5a6a7a", "#10181e"],
        ["Forest", "Nature", "c", "#eef6ec", "#2f5a2a", "#142a10"], ["Meadow", "Nature", "c", "#f6fbea", "#8ab83a", "#2a3a0e"],
        ["Autumn", "Nature", "c", "#fff3e6", "#c0582a", "#401a08"], ["Glacier", "Nature", "c", "#f0fbff", "#7ac0d8", "#12384a"],
        ["Desert", "Nature", "c", "#fdf3e2", "#c89a5a", "#44300e"], ["Volcano", "Nature", "r", "#2a1410", "#6a1a0a", "#ffd8b8"],
        ["Coral", "Nature", "r", "#fff0ec", "#f07a5a", "#4a1a0e"], ["Moss", "Nature", "c", "#f0f4e6", "#5a6a2a", "#222a0a"],
        ["Bamboo", "Nature", "c", "#f8fbe8", "#9ab04a", "#2e3812"], ["Lavender", "Nature", "r", "#f8f2ff", "#a07ad8", "#3a2260"],
        ["Cherry Blossom", "Nature", "r", "#fff4f8", "#f0a0bc", "#4a1a2c"], ["Wheat", "Nature", "c", "#fffaea", "#d0b060", "#403408"],
        ["Pine", "Nature", "c", "#eaf3ee", "#1e4a3a", "#0a2018"], ["Storm", "Nature", "r", "#e6eaf0", "#3a4a5e", "#141c26"],
        ["Sunset", "Nature", "e", "#fff1e8", "#e8603a", "#4a1808"], ["Dawn", "Nature", "r", "#fff6f2", "#f0a090", "#4a2218"],
        ["Dusk", "Nature", "e", "#2a2440", "#141024", "#ffd8e8"], ["Aurora", "Nature", "l", "#0f1e2a", "#1ac090", "#d8fff2"],
        ["Deep Sea", "Nature", "e", "#0e2236", "#041220", "#bfe8ff"], ["Rose", "Nature", "r", "#fff0f4", "#c2456b", "#4a1020"],
        ["Mint", "Sweets", "c", "#eefbf3", "#2f8f63", "#10301f"], ["Bubblegum", "Sweets", "c", "#fff0f8", "#ff6fb5", "#4a0a2a"],
        ["Lemon", "Sweets", "c", "#fffde0", "#f0d020", "#3a3200"], ["Lime", "Sweets", "c", "#f6ffe6", "#7ad020", "#263a00"],
        ["Peach", "Sweets", "c", "#fff4ec", "#f0a070", "#4a2210"], ["Blueberry", "Sweets", "c", "#eef0ff", "#4a5ad0", "#161e50"],
        ["Licorice", "Sweets", "r", "#1c1418", "#000000", "#ffd0e0"], ["Caramel", "Sweets", "c", "#fdf2e0", "#b8742a", "#40240a"],
        ["Cocoa", "Sweets", "r", "#3a2418", "#1e120a", "#ffe8d0"], ["Vanilla", "Sweets", "c", "#fffcf0", "#e0d0a0", "#3a3218"],
        ["Raspberry", "Sweets", "c", "#fff0f4", "#d0305a", "#4a0a1c"], ["Cotton Candy", "Sweets", "r", "#fdf2ff", "#a8c8ff", "#3a2a5a"],
        ["Matcha", "Sweets", "r", "#f2f8e6", "#6a8a3a", "#22300e"], ["Honey", "Sweets", "c", "#fff8e0", "#e0a020", "#3e2a00"],
        ["Watermelon", "Sweets", "r", "#fff0f0", "#2f9a4a", "#8a1020"],
        ["Blueprint", "Retro", "r", "#1e4a8c", "#cfe2ff", "#ffffff"], ["Chalkboard", "Retro", "r", "#2c3a30", "#c8d0c4", "#f4f6ee"],
        ["Newsprint", "Retro", "c", "#f2f0e8", "#3a3a3a", "#1a1a1a"], ["Sepia", "Retro", "r", "#f4e8d0", "#7a5a3a", "#3a2818"],
        ["Terminal", "Retro", "e", "#0a140a", "#1a3a1a", "#5aff7a"], ["Pocket Console", "Retro", "e", "#c4cfa1", "#4a5a2a", "#1f2a10"],
        ["Synthwave", "Retro", "e", "#1a0f2e", "#ff3ca0", "#ffd8f8"], ["Vaporwave", "Retro", "e", "#fde8ff", "#46c8e0", "#6a2a8a"],
        ["Neon Pink", "Retro", "r", "#1a0a16", "#ff2a9a", "#ffd0ee"], ["Neon Green", "Retro", "r", "#0a1a10", "#2aff7a", "#d8ffe6"],
        ["Arcade", "Retro", "r", "#0e0e2a", "#ffd000", "#ffffff"],
        ["Midnight", "Legends", "e", "#1e2546", "#0a0d1c", "#eef1ff"], ["Royal", "Legends", "l", "#2a1450", "#e0b020", "#fff2c8"],
        ["Starlight", "Legends", "l", "#0a0a24", "#8a7aff", "#fff8d8"], ["Phoenix", "Legends", "l", "#2a0a06", "#ff7a1a", "#ffe0a0"],
        ["Eclipse", "Legends", "l", "#08080c", "#ffb020", "#ffe8b0"]
    ];
    const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const COLOURS = COLOUR_ROWS.map(([name, family, r, cell, grid, ink]) => ({ id: "board-" + slug(name), kind: "colour", name, family, rarity: UNCOMMON.has(name) ? "uncommon" : RARITY[r], cell, grid, ink }))
        .map((x, i) => ({ ...x, i })).sort((a, b) => rank(a) - rank(b) || a.i - b.i);            // common first, legendary last
    const FAMILIES = [...new Set(COLOURS.map(c => c.family))];

    // name, font, weight, size (1 = the board's usual), rarity
    const LETTER_ROWS = [
        ["Handwritten", "'Patrick Hand', cursive", 400, 1.05, "c"], ["Rounded", "'Quicksand', sans-serif", 700, 1, "c"], ["Friendly", "'Nunito', sans-serif", 800, 1, "c"],
        ["Bubbly", "'Fredoka', sans-serif", 600, 1, "c"], ["Soft", "'Comfortaa', sans-serif", 700, .95, "c"], ["Poster", "'Lilita One', sans-serif", 400, 1, "c"],
        ["Slab", "'Patua One', serif", 400, 1, "c"], ["Geometric", "'Josefin Sans', sans-serif", 700, 1.05, "c"], ["Chunky", "'Baloo 2', sans-serif", 800, 1, "c"],
        ["Typewriter", "'Courier Prime', monospace", 700, 1.05, "r"], ["Terminal", "'VT323', monospace", 400, 1.3, "r"], ["Robot", "'Share Tech Mono', monospace", 400, 1.05, "r"],
        ["Futuristic", "'Orbitron', sans-serif", 700, .85, "r"], ["Sporty", "'Russo One', sans-serif", 400, .95, "r"], ["Scribble", "'Caveat', cursive", 700, 1.25, "r"],
        ["Tech", "'Exo 2', sans-serif", 800, 1, "r"], ["Pixel", "'Press Start 2P', monospace", 400, .62, "e"], ["Marquee", "'Bungee', sans-serif", 400, .85, "e"],
        ["Western", "'Rye', serif", 400, .9, "e"], ["Royal", "'Cinzel', serif", 700, .95, "e"], ["Storybook", "'IM Fell English SC', serif", 400, 1.05, "e"],
        ["Script", "'Pacifico', cursive", 400, .85, "l"], ["Retro Script", "'Shrikhand', cursive", 400, .85, "l"]
    ];
    const LETTERS = LETTER_ROWS.map(([name, font, weight, scale, r]) => ({ id: "letters-" + slug(name), kind: "letters", name, font, weight, scale, rarity: UNCOMMON.has(name) ? "uncommon" : RARITY[r] }))
        .map((x, i) => ({ ...x, i })).sort((a, b) => rank(a) - rank(b) || a.i - b.i);

    // win effects: name, rarity, the burst (FX.burst options; several for the grand ones)
    const RAINBOW = ["#ff4a5a", "#ffcf3a", "#3aa0ff", "#3ac47a", "#b06aff", "#ff8a2a"];
    const EFFECT_ROWS = [
        ["Confetti", "c", [{ shape: "rect", colors: RAINBOW, n: 90, speed: [260, 620], gravity: 520, size: [6, 10] }]],
        ["Stars", "c", [{ shape: "star", colors: ["#ffe27a", "#ffffff", "#ffd23f"], n: 50, speed: [200, 520], gravity: 220, size: [6, 11] }]],
        ["Bubbles", "u", [{ shape: "bubble", colors: ["#bfe8ff", "#e0f7ff", "#ffffff"], n: 40, speed: [120, 320], gravity: -140, drag: 1.6, size: [8, 16], life: [1.4, 2.2] }]],
        ["Petals", "u", [{ shape: "petal", colors: ["#ffb3c8", "#ff8fb0", "#fff0f4"], n: 60, speed: [160, 420], gravity: 140, drag: 1.8, size: [8, 12], life: [1.6, 2.4], wobble: 2 }]],
        ["Autumn Leaves", "u", [{ shape: "leaf", colors: ["#e0702a", "#c8401a", "#f0b030"], n: 50, speed: [160, 420], gravity: 160, drag: 1.8, size: [9, 13], life: [1.6, 2.4], wobble: 2 }]],
        ["Snowfall", "r", [{ shape: "flake", colors: ["#ffffff", "#d8f0ff"], n: 60, speed: [100, 300], gravity: 60, drag: 1.6, size: [7, 12], life: [2, 3] }]],
        ["Pixels", "r", [{ shape: "pixel", colors: ["#39ff88", "#ff3ca0", "#3ae0ff", "#ffd000"], n: 70, speed: [220, 560], gravity: 500, size: [6, 9] }]],
        ["Sparks", "r", [{ shape: "spark", colors: ["#ffb020", "#ff6a1a", "#ffe08a"], n: 60, speed: [300, 700], gravity: 400, glow: true, size: [3, 5] }]],
        ["Hearts", "r", [{ shape: "text", text: "♥", colors: ["#ff4a7a", "#ff8fb0", "#e0203a"], n: 34, speed: [180, 460], gravity: 260, size: [14, 22] }]],
        ["Music", "e", [{ shape: "text", text: ["♪", "♫", "♬"], colors: ["#8a5ad8", "#3aa0ff", "#ff6aa8"], n: 34, speed: [160, 420], gravity: -40, drag: 1.4, size: [16, 24], life: [1.6, 2.2], wobble: 2 }]],
        ["Gold Rush", "e", [{ shape: "circle", colors: ["#ffd23f", "#f0a800", "#fff0a0"], n: 70, speed: [260, 640], gravity: 700, glow: true, size: [5, 8] }, { shape: "star", colors: ["#ffffff"], n: 16, speed: [100, 300], gravity: 0, size: [5, 8] }]],
        ["Fireworks", "l", [{ shape: "spark", colors: ["#ff4a5a", "#ffd23f"], n: 50, speed: [340, 620], gravity: 220, glow: true, size: [3, 5], at: [-0.3, -0.25] },
            { shape: "spark", colors: ["#3aa0ff", "#ffffff"], n: 50, speed: [340, 620], gravity: 220, glow: true, size: [3, 5], at: [0.3, -0.3], delay: 0.35 },
            { shape: "spark", colors: ["#3ac47a", "#ffe27a"], n: 60, speed: [380, 700], gravity: 220, glow: true, size: [3, 5], at: [0, -0.05], delay: 0.7 }]],
        ["Galaxy", "l", [{ shape: "star", colors: ["#c8b8ff", "#8a7aff", "#ffffff"], n: 70, speed: [120, 520], gravity: 0, drag: 1.2, size: [5, 10], life: [1.6, 2.4], glow: true },
            { shape: "spark", colors: ["#6a4aff", "#3ae0ff"], n: 40, speed: [300, 600], gravity: 0, glow: true, size: [2, 4] }]]
    ];
    const EFFECTS = EFFECT_ROWS.map(([name, r, bursts]) => ({ id: "effect-" + slug(name), kind: "effect", name, rarity: RARITY[r], bursts }));
    // typing trails: a small puff from the square (the same particles, smaller)
    const TRAIL_ROWS = [
        ["Sparkle", "c", { shape: "star", colors: ["#ffe27a", "#ffffff"], n: 6, speed: [60, 150], gravity: 80, size: [3, 5], life: [0.4, 0.6] }],
        ["Dust", "c", { shape: "circle", colors: ["#d8d0c2", "#ffffff"], n: 8, speed: [40, 120], gravity: 40, size: [2, 4], life: [0.4, 0.6] }],
        ["Confetti", "u", { shape: "rect", colors: RAINBOW, n: 7, speed: [80, 180], gravity: 380, size: [3, 5], life: [0.4, 0.65] }],
        ["Bubbles", "u", { shape: "bubble", colors: ["#bfe8ff", "#ffffff"], n: 4, speed: [30, 90], gravity: -120, size: [4, 7], life: [0.6, 0.9] }],
        ["Petals", "r", { shape: "petal", colors: ["#ffb3c8", "#ff8fb0"], n: 5, speed: [50, 130], gravity: 90, size: [5, 7], life: [0.6, 0.9] }],
        ["Snow", "r", { shape: "flake", colors: ["#ffffff", "#d8f0ff"], n: 5, speed: [40, 110], gravity: 50, size: [4, 7], life: [0.6, 0.9] }],
        ["Pixels", "r", { shape: "pixel", colors: ["#39ff88", "#ff3ca0", "#3ae0ff"], n: 7, speed: [70, 170], gravity: 300, size: [3, 5], life: [0.4, 0.6] }],
        ["Hearts", "e", { shape: "text", text: "♥", colors: ["#ff4a7a", "#ff8fb0"], n: 4, speed: [50, 120], gravity: -60, size: [9, 13], life: [0.6, 0.9] }],
        ["Embers", "e", { shape: "spark", colors: ["#ffb020", "#ff6a1a"], n: 7, speed: [80, 200], gravity: -80, glow: true, size: [2, 3], life: [0.4, 0.7] }],
        ["Rainbow", "l", { shape: "star", colors: RAINBOW, n: 10, speed: [70, 190], gravity: 60, glow: true, size: [3, 6], life: [0.5, 0.8] }]
    ];
    const TRAILS = TRAIL_ROWS.map(([name, r, burst]) => ({ id: "trail-" + slug(name), kind: "trail", name, rarity: RARITY[r], burst }));
    // highlights: the square you're on, the word you're on
    const HIGHLIGHT_ROWS = [
        ["Lemon", "c", "#ffd54a", "#fff2a8"], ["Mint", "c", "#7ee0b0", "#d6f7e8"], ["Sky", "c", "#7fc4ff", "#d8ecff"], ["Peach", "c", "#ffb08a", "#ffe3d6"],
        ["Lilac", "u", "#c8a8ff", "#ece2ff"], ["Rose", "u", "#ff8fb0", "#ffe0ea"], ["Lime", "u", "#c8f05a", "#f0fbd0"],
        ["Aqua", "r", "#5ae0e0", "#d6f8f8"], ["Coral", "r", "#ff7a6a", "#ffe0db"], ["Gold", "r", "#f0c020", "#fff1c0"],
        ["Neon", "e", "#39ff88", "#d8ffe8"], ["Electric", "e", "#5a7aff", "#dfe5ff"], ["Sunset", "e", "#ff9a3a", "#ffe1c4"],
        ["Aurora", "l", "#3ae0b0", "#e6dcff"], ["Royal", "l", "#b080ff", "#ffe7a0"]
    ];
    const HIGHLIGHTS = HIGHLIGHT_ROWS.map(([name, r, sel, word]) => ({ id: "highlight-" + slug(name), kind: "highlight", name, rarity: RARITY[r], sel, word }));
    const byRank = list => list.map((x, i) => ({ ...x, i })).sort((a, b) => rank(a) - rank(b) || a.i - b.i);
    EFFECTS.splice(0, EFFECTS.length, ...byRank(EFFECTS));
    TRAILS.splice(0, TRAILS.length, ...byRank(TRAILS));
    HIGHLIGHTS.splice(0, HIGHLIGHTS.length, ...byRank(HIGHLIGHTS));

    const HERO = (typeof Hero !== "undefined" ? Hero.QUEST_PARTS : []).map(p => ({ id: p.id, kind: "hero", name: p.name, key: p.key, index: p.index, rarity: "epic" }));
    const EVERYTHING = () => [...COLOURS, ...LETTERS, ...EFFECTS, ...TRAILS, ...HIGHLIGHTS, ...HERO];
    const ITEMS = Object.fromEntries(EVERYTHING().map(x => [x.id, x]));
    // what each kind is called, and which saved field says the one in use
    const KIND = {
        colour: { tab: "Board Colours", field: "finish", list: COLOURS, suffix: "Board" },
        letters: { tab: "Letter Styles", field: "letters", list: LETTERS, suffix: "Letters" },
        effect: { tab: "Win Effects", field: "effect", list: EFFECTS, suffix: "Win Effect" },
        trail: { tab: "Typing Trails", field: "trail", list: TRAILS, suffix: "Typing Trail" },
        highlight: { tab: "Highlights", field: "highlight", list: HIGHLIGHTS, suffix: "Highlight" }
    };
    const nameOf = x => (KIND[x.kind] ? `${x.name} ${KIND[x.kind].suffix}` : x.name);

    // ---- what you own ----
    function store() {
        const r = U.store.get("rewards", null) || {};
        const str = k => (typeof r[k] === "string" ? r[k] : "");
        return { owned: Array.isArray(r.owned) ? r.owned : [], badges: Array.isArray(r.badges) ? r.badges : [], boxes: Array.isArray(r.boxes) ? r.boxes : [],
            finish: str("finish"), letters: str("letters"), effect: str("effect"), trail: str("trail"), highlight: str("highlight") };
    }
    const save = r => U.store.set("rewards", r);
    const beta = () => typeof Campaign !== "undefined" && !!Campaign.betaUnlocked;
    const owns = id => beta() || store().owned.includes(id);
    function give(id) {
        const r = store();
        if (!r.owned.includes(id)) { r.owned.push(id); save(r); }
    }
    // what a box can still give: everything you don't own yet (a box never gives a repeat)
    const unowned = () => { const have = store().owned; return EVERYTHING().filter(x => !have.includes(x.id)); };

    // ---- putting them on ----
    let styleEl = null;
    function apply() {
        const r = store(), root = document.documentElement;
        const c = r.finish && owns(r.finish) ? ITEMS[r.finish] : null, l = r.letters && owns(r.letters) ? ITEMS[r.letters] : null;
        if (!styleEl) { styleEl = document.createElement("style"); styleEl.id = "collection-style"; document.head.appendChild(styleEl); }
        let css = "";
        if (c) {
            const dark = luminance(c.cell) < 0.35, block = mix(c.grid, "#000000", dark ? 0.5 : 0.35);
            css += `html[data-finish] #board{--cell:${c.cell};--cell-ink:${c.ink};--grid:${c.grid};--block:repeating-linear-gradient(45deg,${block} 0 2.2px,${c.grid} 2.2px 6px);--solved:${mix(c.cell, c.grid, 0.2)}}` +
                `html[data-finish] #board .cell .num{color:${mix(c.ink, c.cell, 0.35)}}`;
            root.dataset.finish = c.id;
        } else delete root.dataset.finish;
        if (l) { css += `html[data-letters] #board{--font-cell:${l.font};--cell-weight:${l.weight};--letter-scale:${l.scale}}`; root.dataset.letters = l.id; }
        else delete root.dataset.letters;
        const h = r.highlight && owns(r.highlight) ? ITEMS[r.highlight] : null;
        if (h) { css += `html[data-highlight] #board{--sel:${h.sel};--word:${h.word}}`; root.dataset.highlight = h.id; }
        else delete root.dataset.highlight;
        if (styleEl.textContent !== css) styleEl.textContent = css;
    }
    function equip(kind, id) {
        const r = store();
        if (id && !owns(id)) return;
        if (!KIND[kind]) return;
        r[KIND[kind].field] = id || "";
        save(r);
        apply();
    }
    const equipped = kind => { const id = KIND[kind] ? store()[KIND[kind].field] : ""; return id && owns(id) ? id : ""; };
    // the win effect and the typing trail, played (game.js's "win" and "type")
    function playEffect(item, x, y) {
        if (!item || typeof FX === "undefined") return;
        for (const b of item.bursts) FX.burst({ ...b, x: x + (b.at ? b.at[0] * 420 : 0), y: y + (b.at ? b.at[1] * 420 : 0), delay: b.delay || 0 });
    }
    function center(el) { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }
    Bus.on("win", () => {
        const e = ITEMS[equipped("effect")], board = document.getElementById("board");
        if (e && board) setTimeout(() => { if (board.isConnected) playEffect(e, ...center(board)); }, 350);
    });
    Bus.on("type", ({ row, col }) => {
        const t = ITEMS[equipped("trail")];
        if (!t || typeof Game === "undefined") return;
        const cell = Game.cellEl(row, col);
        if (cell) { const [x, y] = center(cell); FX.burst({ ...t.burst, x, y }); }
    });
    function buy(id) {
        const x = ITEMS[id], price = x && PRICE[x.rarity];
        if (!x || !price || owns(id) || typeof Campaign === "undefined" || !Campaign.spendCoins(price)) return false;
        give(id);
        return true;
    }

    // ---- small colour helpers ----
    const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    function mix(a, b, t) { const pa = rgb(a), pb = rgb(b); return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join(""); }
    function luminance(h) { const [r, g, b] = rgb(h).map(v => v / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }

    // ---- the pictures ----
    // a board colour: a little 3x3 board with a black square and three letters
    function colourPreview(c) {
        const block = mix(c.grid, "#000000", luminance(c.cell) < 0.35 ? 0.5 : 0.35);
        const cells = ["C", "A", "T", "", "#", "O", "", "", "P"].map((ch, i) => ch === "#"
            ? `<rect x="${3 + (i % 3) * 19}" y="${3 + Math.floor(i / 3) * 19}" width="17" height="17" rx="2.5" fill="${block}"/>`
            : `<rect x="${3 + (i % 3) * 19}" y="${3 + Math.floor(i / 3) * 19}" width="17" height="17" rx="2.5" fill="${c.cell}"/>` + (ch ? `<text x="${11.5 + (i % 3) * 19}" y="${16.5 + Math.floor(i / 3) * 19}" text-anchor="middle" font-size="11" font-weight="800" fill="${c.ink}">${ch}</text>` : ""));
        return `<svg viewBox="0 0 62 62" aria-hidden="true"><rect width="62" height="62" rx="6" fill="${c.grid}"/>${cells.join("")}</svg>`;
    }
    function lettersPreview(l) {
        const box = U.el("span", { class: "cl-letters", "aria-hidden": "true" }, U.el("span", { text: "Ab" }));
        if (l) Object.assign(box.style, { fontFamily: l.font, fontWeight: l.weight, fontSize: `calc(2.2rem * ${l.scale})` });
        return box;
    }
    // a win effect or a typing trail: a little burst of its particles, drawn still (press it to see it move)
    const SHAPE = {
        rect: c => `<rect x="-5" y="-2.5" width="10" height="5" rx="1" fill="${c}"/>`,
        pixel: c => `<rect x="-3.5" y="-3.5" width="7" height="7" fill="${c}"/>`,
        star: c => `<path d="M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6Z" fill="${c}"/>`,
        spark: c => `<path d="M-6 0 L6 0" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/><circle cx="6" r="1.6" fill="#fff"/>`,
        bubble: c => `<circle r="4.5" fill="none" stroke="${c}" stroke-width="1.6"/><circle cx="-1.6" cy="-1.6" r="1" fill="#fff"/>`,
        petal: c => `<ellipse rx="3" ry="5.5" fill="${c}"/>`,
        leaf: c => `<path d="M0 -6 Q5 0 0 6 Q-5 0 0 -6Z" fill="${c}"/><path d="M0 -5 V5" stroke="rgba(0,0,0,.3)" stroke-width="1"/>`,
        flake: c => `<path d="M0 -6 V6 M-5.2 -3 L5.2 3 M-5.2 3 L5.2 -3" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/>`,
        circle: c => `<circle r="3.4" fill="${c}"/>`,
        heart: c => `<path d="M0 5 C-7 0 -5 -6 0 -2.5 C5 -6 7 0 0 5Z" fill="${c}"/>`,
        note: c => `<path d="M1 -6 V3" stroke="${c}" stroke-width="1.8"/><ellipse cx="-1.2" cy="3.6" rx="2.6" ry="2" fill="${c}"/><path d="M1 -6 Q5 -5 4 -2" fill="none" stroke="${c}" stroke-width="1.6"/>`
    };
    const shapeOf = b => (b.shape === "text" ? (String(b.text).includes("♥") || b.text === "♥" ? "heart" : "note") : SHAPE[b.shape] ? b.shape : "circle");
    function burstPreview(x) {
        const b = x.bursts ? x.bursts[0] : x.burst, colors = x.bursts ? x.bursts.flatMap(q => q.colors) : b.colors, shape = SHAPE[shapeOf(b)];
        const n = x.kind === "trail" ? 7 : 11;
        const bits = Array.from({ length: n }, (_, i) => {
            const a = i / n * Math.PI * 2 + (i % 2) * 0.3, r = (i % 3 === 0 ? 22 : i % 3 === 1 ? 15 : 9) * (x.kind === "trail" ? 0.8 : 1), k = 0.8 + (i % 3) * 0.25;
            return `<g transform="translate(${(31 + Math.cos(a) * r).toFixed(1)} ${(31 + Math.sin(a) * r).toFixed(1)}) rotate(${(i * 47) % 360}) scale(${k.toFixed(2)})">${shape(colors[i % colors.length])}</g>`;
        }).join("");
        const middle = x.kind === "trail" ? `<rect x="22" y="22" width="18" height="18" rx="3" fill="#fffdf6"/><text x="31" y="35.5" text-anchor="middle" font-size="11" font-weight="800" fill="#2b2233">A</text>` : "";
        return U.el("span", { class: "cl-burst", "aria-hidden": "true", html: `<svg viewBox="0 0 62 62"><defs><radialGradient id="clb"><stop offset="0" stop-color="#3a3058"/><stop offset="1" stop-color="#1c1628"/></radialGradient></defs><rect width="62" height="62" rx="6" fill="url(#clb)"/>${middle}${bits}</svg>` });
    }
    // a highlight: a little board with the word and the square you're on lit
    function highlightPreview(h) {
        const cells = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => {
            const fill = i === 4 ? h.sel : i === 3 || i === 5 ? h.word : "#ffffff";
            return `<rect x="${3 + (i % 3) * 19}" y="${3 + Math.floor(i / 3) * 19}" width="17" height="17" rx="2.5" fill="${fill}"/>`;
        });
        return `<svg viewBox="0 0 62 62" aria-hidden="true"><rect width="62" height="62" rx="6" fill="#3a3448"/>${cells.join("")}<text x="31" y="36" text-anchor="middle" font-size="11" font-weight="800" fill="#2b2233">A</text></svg>`;
    }
    function preview(x) {
        if (x.kind === "colour") return U.el("span", { class: "cl-board", html: colourPreview(x) });
        if (x.kind === "letters") return lettersPreview(x);
        if (x.kind === "effect" || x.kind === "trail") return burstPreview(x);
        if (x.kind === "highlight") return U.el("span", { class: "cl-board", html: highlightPreview(x) });
        return null;
    }
    const DEFAULT_PICTURE = {
        colour: () => U.el("span", { class: "cl-world", "aria-hidden": "true", html: colourPreview({ cell: "#ffffff", grid: "#c8ccd4", ink: "#2b2233" }) }),
        letters: () => lettersPreview(null),
        effect: () => U.el("span", { class: "cl-burst none", "aria-hidden": "true" }, U.el("b", { text: "None" })),
        trail: () => U.el("span", { class: "cl-burst none trail", "aria-hidden": "true" }, U.el("b", { text: "None" })),
        highlight: () => U.el("span", { class: "cl-world", "aria-hidden": "true", html: highlightPreview({ sel: "#ffd54a", word: "#fff2a8" }) })
    };

    // ---- the menu ----
    let tab = "colour", show = "All", rarity = "All", layer = null;
    function open(which = "colour") {
        tab = which;
        if (layer) layer.remove();
        layer = U.el("div", { class: "results in coll-layer", role: "dialog", "aria-modal": "true", "aria-label": "Collection" });
        const close = () => { if (!layer) return; layer.remove(); layer = null; document.removeEventListener("keydown", onKey, true); Bus.emit("collection"); };
        const onKey = e => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
        document.addEventListener("keydown", onKey, true);
        layer.addEventListener("pointerdown", e => { if (e.target === layer) close(); });
        const card = U.el("div", { class: "coll-card" });
        layer.appendChild(card);
        document.getElementById("overlay").appendChild(layer);
        const draw = () => {
            const coins = typeof Campaign !== "undefined" ? Campaign.coins : 0;
            const head = U.el("header", { class: "coll-head" },
                U.el("h2", { text: "Collection" }),
                U.el("span", { class: "coll-coins", title: "Coins: earned in the campaign and the quests" }, U.icon("coin"), U.el("b", { text: String(coins) })),
                U.el("button", { type: "button", class: "coll-close", "aria-label": "Close", onclick: close }, U.icon("close")));
            const tabs = U.el("div", { class: "coll-tabs", role: "tablist" },
                ...Object.entries(KIND).map(([k, info]) => U.el("button", { type: "button", role: "tab", "aria-selected": String(tab === k), class: tab === k ? "on" : "", onclick: () => { Sound.play("select"); tab = k; draw(); } },
                    U.el("b", { text: info.tab }), U.el("small", { text: `${info.list.filter(x => owns(x.id)).length} of ${info.list.length}` }))));
            // the list (common first, legendary last), All / Owned on top, and down the right side a button for each rarity
            const all = KIND[tab].list;
            const byRarity = list => (show === "Owned" ? list.filter(x => owns(x.id)) : list).filter(x => rarity === "All" || x.rarity === rarity);
            const main = U.el("div", { class: "coll-main" });
            main.appendChild(U.el("div", { class: "coll-filters" }, ...["All", "Owned"].map(f =>
                U.el("button", { type: "button", class: "coll-chip" + (show === f ? " on" : ""), "aria-pressed": String(show === f), text: f, onclick: () => { Sound.play("select"); show = f; draw(); } }))));
            const list = byRarity(all), on = equipped(tab);
            main.appendChild(U.el("div", { class: "coll-grid" + (tab === "letters" ? " letters" : "") },
                rarity === "All" && show === "All" ? tile({ id: "", name: tab === "effect" || tab === "trail" ? "None" : "World's Own", rarity: "" }, DEFAULT_PICTURE[tab](), on === "", true, tab) : null,
                ...list.map(x => tile(x, preview(x), on === x.id, owns(x.id), tab))));
            if (!list.length) main.appendChild(U.el("p", { class: "coll-empty", text: "Nothing here yet." }));
            const rail = U.el("nav", { class: "coll-rail", "aria-label": "Rarity" }, ...["All", ...RARITIES].map(r => {
                const of = r === "All" ? all : all.filter(x => x.rarity === r), n = of.length, have = of.filter(x => owns(x.id)).length;
                return U.el("button", { type: "button", class: "coll-rarity" + (rarity === r ? " on" : ""), "aria-pressed": String(rarity === r), style: RARITY_COLOR[r] ? { "--rc": RARITY_COLOR[r] } : {},
                    onclick: () => { Sound.play("select"); rarity = r; draw(); } },
                    U.el("b", { text: RARITY_NAME[r] || r }), U.el("small", { text: `${have} of ${n}` }));
            }));
            card.replaceChildren(head, tabs, U.el("div", { class: "coll-body" }, main, rail));
        };
        function tile(x, picture, on, have, kind) {
            const price = PRICE[x.rarity];
            const action = on ? U.el("span", { class: "cl-state on", text: "In Use" })
                : have ? U.el("button", { type: "button", class: "btn small", text: "Use", onclick: () => { Sound.play("select"); equip(kind, x.id); draw(); } })
                : price ? U.el("button", { type: "button", class: "btn small buy", onclick: () => {
                    if (buy(x.id)) { Sound.play("coin"); equip(kind, x.id); draw(); } else { Sound.play("wrong"); FX.toast({ icon: "🪙", kicker: "COLLECTION", title: "Not Enough Coins", text: `${x.name} costs ${price}. Earn coins in the campaign and the quests.`, ms: 2600 }); }
                } }, U.icon("coin"), " " + price)
                : U.el("span", { class: "cl-state", text: "From Weekly Boxes" });
            // a win effect or a trail plays when its picture is pressed
            if (x.id && (kind === "effect" || kind === "trail")) {
                picture = U.el("button", { type: "button", class: "cl-play", title: "See it", "aria-label": `See ${x.name}` }, picture);
                picture.addEventListener("click", () => { const [cx, cy] = center(picture); if (kind === "effect") playEffect(x, cx, cy); else for (let i = 0; i < 3; i++) setTimeout(() => FX.burst({ ...x.burst, x: cx, y: cy }), i * 120); });
            }
            return U.el("div", { class: "cl-tile" + (on ? " on" : "") + (have ? "" : " locked") + (x.rarity ? " r-" + x.rarity : ""), style: x.rarity ? { "--rc": RARITY_COLOR[x.rarity] } : {} },
                picture,
                U.el("span", { class: "cl-name" }, U.el("b", { text: x.name }), x.rarity ? U.el("small", { text: RARITY_NAME[x.rarity] }) : U.el("small", { text: "Default" })),
                action);
        }
        draw();
        const first = card.querySelector(".coll-close");
        if (first) first.focus({ preventScroll: true });
    }

    apply();
    return { COLOURS, LETTERS, EFFECTS, TRAILS, HIGHLIGHTS, HERO, ITEMS, KIND, FAMILIES, RARITIES, RARITY_NAME, RARITY_COLOR, owns, give, equip, equipped, apply, open, store, save, unowned,
        colourPreview, lettersPreview, preview, nameOf, playEffect, PRICE, everything: EVERYTHING };
})();
