// The Collection: looks for your board that you win from the quests' boxes (quests.js, boxes.js) or buy with coins.
//   Board colours: 100 of them, for any world's board (its squares, the lines between them, the black squares and
//   the letters), in families, each common, uncommon, rare, epic or legendary. Legendary ones only come from boxes.
//   Letter styles: the lettering on the board, in the game's own fonts.
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

    const HERO = (typeof Hero !== "undefined" ? Hero.QUEST_PARTS : []).map(p => ({ id: p.id, kind: "hero", name: p.name, key: p.key, index: p.index, rarity: "epic" }));
    const ITEMS = Object.fromEntries([...COLOURS, ...LETTERS, ...HERO].map(x => [x.id, x]));

    // ---- what you own ----
    function store() {
        const r = U.store.get("rewards", null) || {};
        return { owned: Array.isArray(r.owned) ? r.owned : [], badges: Array.isArray(r.badges) ? r.badges : [], boxes: Array.isArray(r.boxes) ? r.boxes : [],
            finish: typeof r.finish === "string" ? r.finish : "", letters: typeof r.letters === "string" ? r.letters : "" };
    }
    const save = r => U.store.set("rewards", r);
    const beta = () => typeof Campaign !== "undefined" && !!Campaign.betaUnlocked;
    const owns = id => beta() || store().owned.includes(id);
    function give(id) {
        const r = store();
        if (!r.owned.includes(id)) { r.owned.push(id); save(r); }
    }
    // what a box can still give: everything you don't own yet (a box never gives a repeat)
    const unowned = () => { const have = store().owned; return [...COLOURS, ...LETTERS, ...HERO].filter(x => !have.includes(x.id)); };

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
        if (styleEl.textContent !== css) styleEl.textContent = css;
    }
    function equip(kind, id) {
        const r = store();
        if (id && !owns(id)) return;
        if (kind === "colour") r.finish = id || ""; else r.letters = id || "";
        save(r);
        apply();
    }
    const equipped = kind => { const r = store(); const id = kind === "colour" ? r.finish : r.letters; return id && owns(id) ? id : ""; };
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
            const nColour = COLOURS.filter(c => owns(c.id)).length, nLetters = LETTERS.filter(l => owns(l.id)).length;
            const head = U.el("header", { class: "coll-head" },
                U.el("h2", { text: "Collection" }),
                U.el("span", { class: "coll-coins", title: "Coins: earned in the campaign and the quests" }, U.icon("coin"), U.el("b", { text: String(coins) })),
                U.el("button", { type: "button", class: "coll-close", "aria-label": "Close", onclick: close }, U.icon("close")));
            const tabs = U.el("div", { class: "coll-tabs", role: "tablist" },
                ...[["colour", `Board Colours`, `${nColour} of ${COLOURS.length}`], ["letters", "Letter Styles", `${nLetters} of ${LETTERS.length}`]].map(([k, label, n]) =>
                    U.el("button", { type: "button", role: "tab", "aria-selected": String(tab === k), class: tab === k ? "on" : "", onclick: () => { Sound.play("select"); tab = k; draw(); } },
                        U.el("b", { text: label }), U.el("small", { text: n }))));
            // the list (common first, legendary last), and down the right side a button for each rarity
            const all = tab === "colour" ? COLOURS : LETTERS;
            const byRarity = list => (show === "Owned" ? list.filter(x => owns(x.id)) : list).filter(x => rarity === "All" || x.rarity === rarity);
            const main = U.el("div", { class: "coll-main" });
            main.appendChild(U.el("div", { class: "coll-filters" }, ...["All", "Owned"].map(f =>
                U.el("button", { type: "button", class: "coll-chip" + (show === f ? " on" : ""), "aria-pressed": String(show === f), text: f, onclick: () => { Sound.play("select"); show = f; draw(); } }))));
            if (tab === "colour") {
                const list = byRarity(COLOURS);
                const on = equipped("colour");
                main.appendChild(U.el("div", { class: "coll-grid" },
                    rarity === "All" && show === "All" ? tile({ id: "", name: "World's Own", rarity: "" }, U.el("span", { class: "cl-world", "aria-hidden": "true", html: colourPreview({ cell: "#ffffff", grid: "#c8ccd4", ink: "#2b2233" }) }), on === "", true, "colour") : null,
                    ...list.map(c => tile(c, U.el("span", { class: "cl-board", html: colourPreview(c) }), on === c.id, owns(c.id), "colour"))));
                if (!list.length) main.appendChild(U.el("p", { class: "coll-empty", text: "Nothing here yet." }));
            } else {
                const on = equipped("letters"), list = byRarity(LETTERS);
                main.appendChild(U.el("div", { class: "coll-grid letters" },
                    rarity === "All" && show === "All" ? tile({ id: "", name: "World's Own", rarity: "" }, lettersPreview(null), on === "", true, "letters") : null,
                    ...list.map(l => tile(l, lettersPreview(l), on === l.id, owns(l.id), "letters"))));
                if (!list.length) main.appendChild(U.el("p", { class: "coll-empty", text: "Nothing here yet." }));
            }
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
    return { COLOURS, LETTERS, HERO, ITEMS, FAMILIES, RARITIES, RARITY_NAME, RARITY_COLOR, owns, give, equip, equipped, apply, open, store, save, unowned, colourPreview, lettersPreview, PRICE };
})();
