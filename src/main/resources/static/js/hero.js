// The player's own hero. Drawn like the bosses (bosses.js): an SVG character on a 240 x 240 canvas,
// ink outlines, gradients, and the same animated parts (bz-float, bz-eyes, bz-sway), built from parts you pick.
//
//   Hero.svg(look, cls, { still })   an <svg> of the hero (each copy gets its own gradient ids)
//   Hero.inner(look, { still })      the same without the <svg> wrapper, to place inside another SVG (the map)
//   Hero.maker({ look, first, beaten })  the editor: resolves with the new look (or null if it was closed); beaten =
//                                    the bosses you've beaten (each one's hat, outfit and item are yours to pick)
//   Hero.giftNames(world)            the names of the three parts that world's boss gives
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
    const COLORS = ["#ffb84d", "#ff7f98", "#7fd1ff", "#8be38b", "#c49bff", "#ffd84d", "#ff8a5c", "#5fd4c4", "#f5efe3", "#a6b3c6", "#d6a77a", "#7b8cff",
        "#ffcf9e", "#b07a52", "#7a5236", "#ff5f5f", "#3fa66b", "#e0e0ff", "#2f6fb5", "#6b4fa0", "#b8f0a0"];
    const ACCENTS = ["#e5484d", "#ff9f1c", "#ffd23f", "#3fbf5f", "#2f8fe0", "#7a4fd6", "#ff6fb5", "#ffffff", "#5a5f6e", "#2b2233",
        "#7a4a2a", "#f2c56b", "#c8572a", "#00a6a6", "#9be15d", "#ff4d94", "#8b5cf6"];
    // (fruit bodies wear their own colours, so the Colour row hides for them)
    const BODIES = ["Round", "Bean", "Block", "Pear", "Tall", "Blob", "Strawberry", "Watermelon Slice", "Apple", "Orange", "Lemon", "Peach"];
    const EYES = ["Dots", "Big", "Happy", "Starry", "Glasses", "Sleepy", "Wink", "Shades", "Determined", "Hearts", "Dizzy", "One Eye"];
    const MOUTHS = ["Smile", "Grin", "Surprised", "Cheeky", "Cat", "Fangs", "Tongue", "Big Smile", "Whistle", "Flat", "Buck Teeth", "Worried", "Zigzag"];
    const FACES = ["Blush", "Nothing", "Freckles", "Mustache", "Bandage", "Star Cheeks", "Whiskers", "Sweat Drop", "Face Paint"];
    const TOPS = ["Nothing", "Tuft", "Beanie", "Cap", "Crown", "Bow", "Wizard Hat", "Headphones", "Sprout", "Spiky", "Top Hat", "Pirate Hat", "Flower", "Horns", "Halo", "Bandana", "Cowboy Hat", "Chef Hat", "Viking Helmet",
        // the bosses' gifts (GIFT below)
        "Pencil Crown", "Thistle Crown", "Acorn Cap", "Gumdrop Crown", "Octopus Hat", "Fur Hat", "Storm Cloud", "Aviator Cap", "Pharaoh Headdress", "Jester Hat", "Pixel Crown", "Candle Crown", "Antenna", "Flame Crown", "Space Helmet", "Cursed Halo",
        "Squirrel Ears", "Coral Crown", "Sand Goggles", "Miner's Helmet",
        // won in the Weekly Quests (QUEST_PARTS below)
        "Laurel Wreath", "Explorer Hat"];
    const OUTFITS = ["Nothing", "Scarf", "Cape", "Bow Tie", "Backpack", "Medal", "Belt", "Wings", "Overalls", "Necklace", "Tie", "Apron", "Sash",
        "Paper Ruff", "Vine Sash", "Leaf Scarf", "Candy Sash", "Life Ring", "Fur Collar", "Raincoat", "Jetpack", "Broad Collar", "Striped Vest", "Pixel Armor", "Ghost Shroud", "Robo Armor", "Scale Armor", "Planet Ring", "Fallen Wings",
        "Fluffy Tail", "Pearl Necklace", "Desert Wrap", "Ember Cloak",
        "Star Sash", "Quest Satchel"];
    const ITEMS = ["Nothing", "Pencil", "Book", "Star Wand", "Lantern", "Magnifier", "Sword", "Shield", "Balloon", "Umbrella", "Key", "Flag", "Ice Cream", "Fishing Rod", "Trophy",
        "Giant Eraser", "Watering Can", "Owl Plush", "Lollipop", "Trident", "Ice Axe", "Lightning Bolt", "Kite", "Ankh Staff", "Popcorn", "Game Controller", "Ghost Friend", "Wrench", "Torch", "Telescope", "Feather Quill",
        "Giant Acorn", "Conch Shell", "Hourglass", "Pickaxe",
        "Golden Pencil", "Compass"];
    const PARTS = { body: BODIES, eyes: EYES, mouth: MOUTHS, face: FACES, top: TOPS, outfit: OUTFITS, item: ITEMS };


    // ---------------------------------------------------------------------------------------------
    // The bosses' gifts:
    // each boss you beat unlocks a hat, an outfit and something to hold, in its world's style. They're the last 16 of
    // each list (so saved heroes keep their parts), in the map's order; the editor only offers the ones you've won.
    // ---------------------------------------------------------------------------------------------
    const GIFT_WORLDS = ["paper", "garden", "squirrel", "candy", "ocean", "snow", "rain", "sky", "desert", "carnival", "arcade", "library", "robot", "volcano", "space", "rift", "hollow", "atlantis", "dunes", "cave"];
    const GIFT_TOPS = [
        // The Big Eraser: a crown of pencils
        (t, c) => [-28, 0, 28].map(a => `<g transform="rotate(${a} 120 ${t + 12})"><rect x="113" y="${t - 26}" width="14" height="34" fill="${c}" ${st(3)}/><path d="M113 ${t - 26} L120 ${t - 38} L127 ${t - 26}Z" fill="#f2d2a2" ${st(3)}/><path d="M118 ${t - 34} L120 ${t - 38} L122 ${t - 34}Z" fill="${INK}"/><rect x="112" y="${t + 4}" width="16" height="8" rx="2" fill="#ff8fa8" ${st(3)}/></g>`).join(""),
        // Queen Thistle: a crown of thistles
        (t, c, S) => [-1, 0, 1].map(k => { const x = 120 + k * S.hw * 0.62, y = t + 2 - (k ? 0 : 6); return `<path d="M${x} ${y + 14} V${y + 4}" stroke="#3f8a34" stroke-width="4"/><ellipse cx="${x}" cy="${y + 2}" rx="9" ry="8" fill="#5fae4a" ${st(3)}/><path d="M${x - 6} ${y - 1} l4 4 M${x + 6} ${y - 1} l-4 4 M${x} ${y - 4} v5" stroke="#2f6a2a" stroke-width="1.5"/>` +
            Array.from({ length: 7 }, (_, i) => { const a = -Math.PI * (0.15 + i * 0.7 / 6); return `<path d="M${x} ${y - 4} L${f1(x + Math.cos(a) * 15)} ${f1(y - 4 + Math.sin(a) * 15)}" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M${x} ${y - 4} L${f1(x + Math.cos(a) * 15)} ${f1(y - 4 + Math.sin(a) * 15)}" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`; }).join(""); }).join("") +
            `<path d="M${120 - S.hw * 0.75} ${t + 14} Q120 ${t + 4} ${120 + S.hw * 0.75} ${t + 14}" fill="none" stroke="#3f8a34" stroke-width="5" stroke-linecap="round"/>`,
        // Old Grumbleowl: an acorn cap
        (t, c, S) => { const w = Math.min(S.hw + 8, 60); return `<path d="M${120 - w} ${t + 18} Q${120 - w} ${t - 18} 120 ${t - 20} Q${120 + w} ${t - 18} ${120 + w} ${t + 18} Q120 ${t + 28} ${120 - w} ${t + 18}Z" fill="#8a5a2b" ${st(4)}/>` +
            Array.from({ length: 5 }, (_, i) => `<path d="M${120 - w + 10 + i * (w - 5) / 2} ${t + 16} Q${120 - w + 18 + i * (w - 5) / 2} ${t - 2} ${120 - w + 26 + i * (w - 5) / 2} ${t + 16}" fill="none" stroke="#5e3a1a" stroke-width="2"/>`).join("") +
            `<path d="M${120 - w + 6} ${t + 2} Q120 ${t - 14} ${120 + w - 6} ${t + 2}" fill="none" stroke="#5e3a1a" stroke-width="2"/><path d="M120 ${t - 20} Q124 ${t - 32} 132 ${t - 34}" fill="none" ${st(6)}/><path d="M120 ${t - 20} Q124 ${t - 32} 132 ${t - 34}" fill="none" stroke="#6b4219" stroke-width="3" stroke-linecap="round"/>`; },
        // King Sourgum: a crown of gumdrops
        (t, c, S) => { const w = Math.min(S.hw + 4, 56); return `<rect x="${120 - w}" y="${t + 4}" width="${w * 2}" height="14" rx="7" fill="${c}" ${st(3.5)}/>` +
            ["#ff5fa2", "#7ad7ff", "#ffd23f", "#7dff6b", "#c08bff"].map((g, i) => { const x = 120 - w * 0.8 + i * w * 0.4; return `<path d="M${x - 10} ${t + 6} Q${x - 10} ${t - 14} ${x} ${t - 14} Q${x + 10} ${t - 14} ${x + 10} ${t + 6}Z" fill="${g}" ${st(3)}/><circle cx="${x - 3}" cy="${t - 6}" r="1.4" fill="#fff"/><circle cx="${x + 3}" cy="${t - 1}" r="1.2" fill="#fff"/><circle cx="${x - 1}" cy="${t + 2}" r="1" fill="#fff"/>`; }).join(""); },
        // The Kraken: a little octopus sitting on its head
        (t, c) => `<g>${[-1, 1].map(k => `<path d="M${120 + k * 14} ${t + 6} Q${120 + k * 40} ${t + 4} ${120 + k * 44} ${t + 24} Q${120 + k * 46} ${t + 34} ${120 + k * 38} ${t + 32}" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M${120 + k * 14} ${t + 6} Q${120 + k * 40} ${t + 4} ${120 + k * 44} ${t + 24} Q${120 + k * 46} ${t + 34} ${120 + k * 38} ${t + 32}" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"/>`).join("")}
            <path d="M96 ${t + 8} C96 ${t - 26} 144 ${t - 26} 144 ${t + 8} Q120 ${t + 14} 96 ${t + 8}Z" fill="${c}" ${st(4)}/><circle cx="110" cy="${t - 6}" r="5" fill="#fff" ${st(2)}/><circle cx="130" cy="${t - 6}" r="5" fill="#fff" ${st(2)}/><circle cx="111" cy="${t - 5}" r="2.4" fill="${INK}"/><circle cx="131" cy="${t - 5}" r="2.4" fill="${INK}"/><circle cx="106" cy="${t - 16}" r="3" fill="#fff" opacity=".5"/></g>`,
        // The Yeti: a fur hat with ear flaps
        (t, c, S) => { const w = Math.min(S.hw + 6, 58); return [-1, 1].map(k => `<path d="M${120 + k * (w - 6)} ${t + 14} Q${120 + k * (w + 4)} ${t + 30} ${120 + k * (w - 2)} ${t + 52} Q${120 + k * (w - 16)} ${t + 46} ${120 + k * (w - 18)} ${t + 18}Z" fill="#f5efe3" ${st(3.5)}/>`).join("") +
            `<path d="M${120 - w + 6} ${t + 10} C${120 - w + 6} ${t - 24} ${120 + w - 6} ${t - 24} ${120 + w - 6} ${t + 10}Z" fill="${c}" ${st(4)}/><path d="${fuzzy(120, t + 12, w, 11, 26)}" fill="#ffffff" ${st(3.5)}/>`; },
        // Thunderhead: a little storm cloud floating over its head
        (t) => `<g class="bz-float"><g fill="#8a95a3" ${st(3.5)}><circle cx="102" cy="${t - 14}" r="13"/><circle cx="120" cy="${t - 22}" r="16"/><circle cx="140" cy="${t - 14}" r="13"/><rect x="96" y="${t - 18}" width="48" height="16" rx="8"/></g><g fill="#a6b0bd"><circle cx="117" cy="${t - 26}" r="7"/></g>
            <path d="M118 ${t - 4} L112 ${t + 8} H120 L114 ${t + 20} L128 ${t + 2} H120 L124 ${t - 4}Z" fill="#ffe066" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M100 ${t} v6 M140 ${t} v6" stroke="#7fb2ff" stroke-width="3" stroke-linecap="round"/></g>`,
        // Sir Squall: an aviator's cap with goggles
        (t, c, S) => { const w = Math.min(S.hw + 6, 60); return `<path d="M${120 - w} ${t + 26} C${120 - w} ${t - 18} ${120 + w} ${t - 18} ${120 + w} ${t + 26} L${120 + w - 8} ${t + 40} L${120 + w - 14} ${t + 26} Q120 ${t + 10} ${120 - w + 14} ${t + 26} L${120 - w + 8} ${t + 40}Z" fill="#8a5a3c" ${st(4)}/>` +
            `<path d="M120 ${t - 12} V${t + 14}" stroke="#6b4429" stroke-width="2"/>` + [-1, 1].map(k => `<circle cx="${120 + k * 17}" cy="${t + 14}" r="11" fill="#bfe6ff" stroke="${c}" stroke-width="5"/><circle cx="${120 + k * 17}" cy="${t + 14}" r="11" fill="none" ${st(2)}/><path d="M${120 + k * 17 - 5} ${t + 10} q3 -3 7 -2" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/>`).join("") +
            `<path d="M114 ${t + 14} H126" stroke="${c}" stroke-width="5"/>`; },
        // The Sphinx: a pharaoh's striped headdress with a cobra
        (t, c, S) => { const w = Math.min(S.hw + 10, 62); return `<path d="M${120 - w + 10} ${t + 20} C${120 - w + 10} ${t - 20} ${120 + w - 10} ${t - 20} ${120 + w - 10} ${t + 20} L${120 + w} ${t + 66} L${120 + w - 18} ${t + 66} L${120 + w - 22} ${t + 24} Q120 ${t + 14} ${120 - w + 22} ${t + 24} L${120 - w + 18} ${t + 66} L${120 - w} ${t + 66}Z" fill="#ffd23f" ${st(4)}/>` +
            [0, 1, 2, 3].map(i => `<path d="M${120 - w + 8 + i * 0} ${t + 30 + i * 9} L${120 - w + 2} ${t + 34 + i * 9} M${120 + w - 8} ${t + 30 + i * 9} L${120 + w - 2} ${t + 34 + i * 9}" stroke="${c}" stroke-width="5"/>`).join("") +
            `<path d="M${120 - w + 16} ${t + 4} Q120 ${t - 10} ${120 + w - 16} ${t + 4}" fill="none" stroke="${c}" stroke-width="5"/><path d="M120 ${t + 18} C110 ${t + 6} 112 ${t - 8} 120 ${t - 8} C128 ${t - 8} 130 ${t + 6} 120 ${t + 18}Z" fill="#3fbf5f" ${st(2.5)}/><circle cx="118" cy="${t - 2}" r="1.5" fill="${INK}"/>`; },
        // The Ringmaster: a jester's hat with bells
        (t, c) => { const dk = shade(c, -0.35); return `<path d="M82 ${t + 16} Q76 ${t - 12} 56 ${t - 18} Q78 ${t - 34} 100 ${t - 6} Z" fill="${c}" ${st(3.5)}/><path d="M158 ${t + 16} Q164 ${t - 12} 184 ${t - 18} Q162 ${t - 34} 140 ${t - 6} Z" fill="${dk}" ${st(3.5)}/>` +
            `<path d="M96 ${t + 10} Q104 ${t - 30} 120 ${Math.max(8, t - 40)} Q136 ${t - 30} 144 ${t + 10}Z" fill="#ffd23f" ${st(3.5)}/><path d="M80 ${t + 12} Q120 ${t - 2} 160 ${t + 12} L160 ${t + 22} Q120 ${t + 8} 80 ${t + 22}Z" fill="${INK}"/>` +
            [[56, t - 18], [184, t - 18], [120, Math.max(8, t - 40)]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="#ffd23f" ${st(2.5)}/><path d="M${x - 3} ${y + 1} H${x + 3}" stroke="${INK}" stroke-width="1.5"/>`).join(""); },
        // Glitch: an 8-bit crown
        (t, c) => `<g ${st(3)}><path d="M88 ${t + 14} V${t - 10} H96 V${t - 2} H104 V${t - 18} H112 V${t - 2} H128 V${t - 18} H136 V${t - 2} H144 V${t - 10} H152 V${t + 14}Z" fill="#ffd23f"/></g>
            <rect x="94" y="${t + 2}" width="8" height="8" fill="${c}"/><rect x="116" y="${t + 2}" width="8" height="8" fill="#2bf0ff"/><rect x="138" y="${t + 2}" width="8" height="8" fill="${c}"/><rect x="88" y="${t - 10}" width="8" height="4" fill="#fff6a0"/>`,
        // The Phantom Librarian: a ring of three dripping candles
        (t, c, S) => { const w = Math.min(S.hw, 50); return `<path d="M${120 - w} ${t + 12} Q120 ${t + 2} ${120 + w} ${t + 12}" fill="none" stroke="#c9902f" stroke-width="6" stroke-linecap="round"/>` +
            [-1, 0, 1].map(k => { const x = 120 + k * w * 0.62, h = k ? 20 : 26, y = t + 8 - (k ? 0 : 4); return `<rect x="${x - 6}" y="${y - h}" width="12" height="${h}" rx="2" fill="#f6ecd2" ${st(3)}/><path d="M${x - 6} ${y - h + 4} q3 6 0 10" fill="none" stroke="#e6d8b8" stroke-width="3"/><path d="M${x} ${y - h - 2} Q${x - 6} ${y - h - 10} ${x} ${y - h - 20} Q${x + 6} ${y - h - 10} ${x} ${y - h - 2}Z" fill="${c === "#2b2233" ? "#7fe0c4" : "#ffcf3f"}" class="bz-glow" stroke="${INK}" stroke-width="1.5"/>`; }).join(""); },
        // Mega Unit X: a springy antenna with a blinking light
        (t, c, S) => `<path d="M${120 - S.hw * 0.6} ${t + 12} Q120 ${t - 4} ${120 + S.hw * 0.6} ${t + 12}" fill="none" stroke="#8a95a3" stroke-width="7" stroke-linecap="round"/><path d="M${120 - S.hw * 0.6} ${t + 12} Q120 ${t - 4} ${120 + S.hw * 0.6} ${t + 12}" fill="none" ${st(2)}/>
            <path d="M120 ${t + 4} q-8 -6 0 -10 q8 -4 0 -10 q-8 -4 0 -10 q8 -4 0 -8" fill="none" stroke="#5a6470" stroke-width="3"/><circle cx="120" cy="${t - 36}" r="8" fill="${c}" ${st(3)} class="bz-glow"/><circle cx="117" cy="${t - 39}" r="2.5" fill="#fff"/>`,
        // Magma Wyrm: a crown of flames
        (t, c, S) => { const w = Math.min(S.hw + 2, 54); return `<g class="bz-glow">` + [-2, -1, 0, 1, 2].map(k => { const x = 120 + k * w * 0.42, h = 28 - Math.abs(k) * 6; return `<path d="M${x - 9} ${t + 8} Q${x - 12} ${t - h * 0.4} ${x} ${t - h} Q${x + 12} ${t - h * 0.4} ${x + 9} ${t + 8}Z" fill="#ff7a1f" ${st(3)}/><path d="M${x - 4} ${t + 6} Q${x - 5} ${t - h * 0.2} ${x} ${t - h * 0.55} Q${x + 5} ${t - h * 0.2} ${x + 4} ${t + 6}Z" fill="#ffe066"/>`; }).join("") + `</g><rect x="${120 - w}" y="${t + 4}" width="${w * 2}" height="10" rx="5" fill="${c}" ${st(3)}/>`; },
        // The Void: a glass space helmet with an antenna
        (t, c, S) => { const rx = Math.min(S.w + 14, 92), ry = S.eyeY - t + 30, cy = S.eyeY - 2; return `<ellipse cx="120" cy="${cy}" rx="${rx}" ry="${ry}" fill="#bfe6ff" fill-opacity=".18" ${st(4)}/><path d="M${120 - rx * 0.62} ${cy - ry * 0.55} Q${120 - rx * 0.4} ${cy - ry * 0.85} ${120 - rx * 0.1} ${cy - ry * 0.92}" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".7"/>` +
            `<path d="M${120 - rx} ${cy + 4} Q120 ${cy + ry * 0.4} ${120 + rx} ${cy + 4}" fill="none" stroke="${c}" stroke-width="7"/><path d="M${120 + rx * 0.5} ${cy - ry * 0.86} L${120 + rx * 0.66} ${Math.max(10, cy - ry - 16)}" ${st(3)}/><circle cx="${120 + rx * 0.66}" cy="${Math.max(10, cy - ry - 16)}" r="5" fill="#ffe066" ${st(2)} class="bz-glow"/>`; },
        // The Cursed Angel: a cracked halo, glowing violet through the cracks
        (t) => `<g class="bz-glow"><ellipse cx="120" cy="${t - 16}" rx="32" ry="8.5" fill="none" stroke="#b48cff" stroke-width="12" opacity=".35"/>
            <path d="M88 ${t - 16} A32 8.5 0 0 1 142 ${t - 23}" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round"/><path d="M146 ${t - 20} A32 8.5 0 0 1 96 ${t - 9}" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round"/>
            <path d="M88 ${t - 16} A32 8.5 0 0 1 142 ${t - 23}" fill="none" stroke="#ffd06b" stroke-width="5" stroke-linecap="round"/><path d="M146 ${t - 20} A32 8.5 0 0 1 96 ${t - 9}" fill="none" stroke="#ffd06b" stroke-width="5" stroke-linecap="round"/>
            <path d="M152 ${t - 30} l6 -2 l-2 6Z" fill="#ffd06b" stroke="${INK}" stroke-width="1.5"/><path d="M118 ${t - 26} l3 4 l-4 3" stroke="#7a3cff" stroke-width="2" fill="none"/></g>`,
        // The Giant Squirrel: furry ears with tufts
        (t, c, S) => { const w = Math.min(S.hw, 52); return [-1, 1].map(k => `<path d="M${120 + k * (w - 18)} ${t + 14} L${120 + k * (w - 4)} ${t - 26} L${120 + k * (w + 8)} ${t + 10}Z" fill="#c8681c" ${st(3.5)}/><path d="M${120 + k * (w - 10)} ${t + 8} L${120 + k * (w - 3)} ${t - 14} L${120 + k * (w + 3)} ${t + 6}Z" fill="#ffb0a0"/><path d="M${120 + k * (w - 4)} ${t - 26} q${k * 4} -10 ${k * 10} -12 M${120 + k * (w - 4)} ${t - 26} q${k * -2} -10 ${k * 2} -14" stroke="#a8521a" stroke-width="3" stroke-linecap="round" fill="none"/>`).join(""); },
        // Poseidon: a crown of coral with a pearl
        (t, c, S) => { const w = Math.min(S.hw + 2, 54); return `<path d="M${120 - w} ${t + 14} H${120 + w}" ${st(9)}/><path d="M${120 - w} ${t + 14} H${120 + w}" stroke="#d9a93a" stroke-width="5" stroke-linecap="round"/>` +
            [-0.7, -0.25, 0.25, 0.7].map((k, i) => `<path d="M${f1(120 + k * w)} ${t + 12} V${t - 6 - (i % 3 ? 10 : 0)} M${f1(120 + k * w)} ${t} l${i % 2 ? 8 : -8} -10" stroke="${INK}" stroke-width="8" stroke-linecap="round" fill="none"/><path d="M${f1(120 + k * w)} ${t + 12} V${t - 6 - (i % 3 ? 10 : 0)} M${f1(120 + k * w)} ${t} l${i % 2 ? 8 : -8} -10" stroke="#ff7a8a" stroke-width="4" stroke-linecap="round" fill="none"/>`).join("") +
            `<circle cx="120" cy="${t + 6}" r="6" fill="#f4fbff" ${st(2.5)}/>`; },
        // The Sandworm: sand goggles pushed up on the head
        (t, c, S) => { const w = Math.min(S.hw + 4, 56); return `<path d="M${120 - w} ${t + 18} Q120 ${t + 8} ${120 + w} ${t + 18}" fill="none" ${st(9)}/><path d="M${120 - w} ${t + 18} Q120 ${t + 8} ${120 + w} ${t + 18}" fill="none" stroke="#8a5424" stroke-width="5"/>` +
            [-1, 1].map(k => `<circle cx="${120 + k * 17}" cy="${t + 12}" r="12" fill="#ffd27a" stroke="${INK}" stroke-width="3.5"/><circle cx="${120 + k * 17}" cy="${t + 12}" r="7" fill="#5fd0d8" opacity=".85"/><circle cx="${117 + k * 17}" cy="${t + 9}" r="2.4" fill="#fff"/>`).join(""); },
        // The Lava Beast: a miner's helmet with a glowing lamp
        (t, c, S) => { const w = Math.min(S.hw + 6, 58); return `<path d="M${120 - w} ${t + 22} C${120 - w} ${t - 18} ${120 + w} ${t - 18} ${120 + w} ${t + 22}Z" fill="#3a2a2e" ${st(4)}/><path d="M${120 - w - 6} ${t + 22} H${120 + w + 6}" ${st(8)}/><path d="M${120 - w - 6} ${t + 22} H${120 + w + 6}" stroke="#5a4448" stroke-width="4" stroke-linecap="round"/>` +
            `<g class="bz-glow"><circle cx="120" cy="${t}" r="10" fill="#ffd03e" ${st(3)}/><circle cx="120" cy="${t}" r="18" fill="#ffb02e" opacity=".25"/></g><path d="M${120 - w + 10} ${t + 6} Q${120 - w + 18} ${t - 6} ${120 - w + 30} ${t - 10}" stroke="#ff6a1f" stroke-width="3" fill="none" opacity=".8"/>`; }
    ];
    // outfits: { back, front } (either may be missing)
    // the Weekly Quests' hats: a laurel wreath and an explorer's hat
    const QUEST_TOPS = [
        (t, c, S) => {
            const w = Math.min(S.hw + 6, 60);
            return [-1, 1].map(k => {
                const P = [[120 + k * 6, t - 6], [120 + k * w * 0.7, t - 12], [120 + k * w, t + 16]];
                const at = u => [0, 1].map(j => (1 - u) * (1 - u) * P[0][j] + 2 * u * (1 - u) * P[1][j] + u * u * P[2][j]);
                const path = `M${P[0][0]} ${P[0][1]} Q${f1(P[1][0])} ${P[1][1]} ${f1(P[2][0])} ${P[2][1]}`;
                return `<path d="${path}" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="${path}" fill="none" stroke="#6b8f2a" stroke-width="3" stroke-linecap="round"/>` +
                    [0.12, 0.3, 0.48, 0.66, 0.84].map((u, i) => { const [x, y] = at(u), side = i % 2 ? -1 : 1;
                        return `<ellipse cx="${f1(x)}" cy="${f1(y + side * 5)}" rx="8" ry="4" transform="rotate(${f1(k * (20 + u * 50) + side * 18)} ${f1(x)} ${f1(y + side * 5)})" fill="#8cc63f" ${st(2.5)}/>`; }).join("");
            }).join("") + `<circle cx="120" cy="${t - 8}" r="4" fill="#ffd23f" ${st(2.5)}/>`;
        },
        (t, c) => `<path d="M58 ${t + 14} Q120 ${t + 2} 182 ${t + 14} Q120 ${t + 28} 58 ${t + 14}Z" fill="#c8a46a" ${st(4)}/>` +
            `<path d="M86 ${t + 12} C86 ${t - 32} 154 ${t - 32} 154 ${t + 12}Z" fill="#dcbb80" ${st(4)}/><path d="M87 ${t + 3} Q120 ${t + 11} 153 ${t + 3} L154 ${t + 12} Q120 ${t + 20} 86 ${t + 12}Z" fill="${c}"/>` +
            `<path d="M100 ${t - 16} Q120 ${t - 24} 140 ${t - 16}" fill="none" stroke="#fff" stroke-width="3" opacity=".5"/>`
    ];
    const GIFT_OUTFITS = [
        // a crumpled paper ruff
        { front: (c, S) => { const y = S.mouthY + 22, w = S.w - 4; return `<path d="${Array.from({ length: 13 }, (_, i) => { const x = 120 - w + i * w / 6; return `${i ? "L" : "M"}${f1(x)} ${f1(y + (i % 2 ? 14 : 0) + Math.sin(i / 12 * Math.PI) * 10)}`; }).join("")} L${120 + w} ${y + 22} Q120 ${y + 40} ${120 - w} ${y + 22}Z" fill="#ffffff" ${st(3.5)}/>` +
            [0, 1, 2].map(i => `<path d="M${120 - w + 6} ${y + 18 + i * 6} Q120 ${y + 34 + i * 6} ${120 + w - 6} ${y + 18 + i * 6}" fill="none" stroke="#9ab4e0" stroke-width="1.6"/>`).join("") + `<path d="M${120 - w + 14} ${y + 4} V${y + 34}" stroke="#f0a0a0" stroke-width="2"/>`; } },
        // a sash of vines and little flowers
        { front: (c, S) => { const x1 = 120 - S.w * 0.72, y1 = S.eyeY + 24, x2 = 120 + S.w * 0.62, y2 = Math.min(200, S.mouthY + 44);
            return `<path d="M${x1} ${y1} Q${(x1 + x2) / 2 + 10} ${(y1 + y2) / 2 - 14} ${x2} ${y2}" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M${x1} ${y1} Q${(x1 + x2) / 2 + 10} ${(y1 + y2) / 2 - 14} ${x2} ${y2}" fill="none" stroke="#3f8a34" stroke-width="5" stroke-linecap="round"/>` +
                [0.2, 0.45, 0.7, 0.9].map((u, i) => { const x = x1 + (x2 - x1) * u, y = y1 + (y2 - y1) * u - Math.sin(u * Math.PI) * 10; return i % 2 ? `<path d="M${f1(x)} ${f1(y)} q8 -10 14 -4 q-6 10 -14 4Z" fill="#5fae4a" ${st(2)}/>` : `<circle cx="${f1(x)}" cy="${f1(y)}" r="6" fill="${c}" ${st(2.5)}/><circle cx="${f1(x)}" cy="${f1(y)}" r="2.2" fill="#ffd23f"/>`; }).join(""); } },
        // a scarf of autumn leaves
        { front: (c, S) => { const y = S.mouthY + 20, w = S.w - 8; return Array.from({ length: 9 }, (_, i) => { const u = i / 8, x = 120 - w + u * 2 * w, yy = y + Math.sin(u * Math.PI) * 16, col = ["#e8792b", "#d9542a", "#f2b13a", "#c9642d"][i % 4];
            return `<path d="M${f1(x - 10)} ${f1(yy)} Q${f1(x)} ${f1(yy - 9)} ${f1(x + 10)} ${f1(yy)} Q${f1(x)} ${f1(yy + 9)} ${f1(x - 10)} ${f1(yy)}Z" fill="${col}" ${st(2.5)} transform="rotate(${f1((u - 0.5) * 60)} ${f1(x)} ${f1(yy)})"/>`; }).join("") +
            `<path d="M140 ${y + 14} Q146 ${y + 36} 138 ${y + 50}" fill="none" stroke="${INK}" stroke-width="2"/><path d="M134 ${y + 50} q4 -8 10 -4 q-4 8 -10 4Z" fill="#d9542a" ${st(2)}/>`; } },
        // a candy-cane sash with a wrapped sweet
        { front: (c, S) => { const x1 = 120 - S.w * 0.72, y1 = S.eyeY + 24, x2 = 120 + S.w * 0.62, y2 = Math.min(200, S.mouthY + 44);
            return `<path d="M${x1} ${y1} L${x1 + 14} ${y1 - 10} L${x2 + 6} ${y2 - 12} L${x2 - 8} ${y2}Z" fill="#ffffff" ${st(3.5)}/>` + [0.15, 0.35, 0.55, 0.75].map(u => { const x = x1 + 4 + (x2 - x1) * u, y = y1 - 4 + (y2 - y1) * u; return `<path d="M${f1(x - 4)} ${f1(y + 8)} L${f1(x + 8)} ${f1(y - 6)} L${f1(x + 14)} ${f1(y - 2)} L${f1(x + 2)} ${f1(y + 12)}Z" fill="#e5484d"/>`; }).join("") +
                `<g transform="translate(${f1((x1 + x2) / 2 + 4)} ${f1((y1 + y2) / 2 - 4)})"><ellipse rx="9" ry="7" fill="${c}" ${st(2.5)}/><path d="M-9 0 L-17 -6 L-17 6Z M9 0 L17 -6 L17 6Z" fill="${c}" ${st(2.5)}/></g>`; } },
        // a life ring round the middle
        { front: (c, S) => { const y = Math.min(178, S.mouthY + 38), rx = S.w + 8; return `<ellipse cx="120" cy="${y}" rx="${rx}" ry="16" fill="none" stroke="${INK}" stroke-width="18"/><ellipse cx="120" cy="${y}" rx="${rx}" ry="16" fill="none" stroke="#ffffff" stroke-width="12"/>` +
            [-0.6, 0, 0.6].map(u => `<path d="M${f1(120 + u * rx - 8)} ${f1(y + 15 - Math.abs(u) * 5)} L${f1(120 + u * rx + 8)} ${f1(y + 15 - Math.abs(u) * 5)}" stroke="#e5484d" stroke-width="12"/>`).join("") + `<path d="M${120 - rx} ${y} Q${120 - rx - 10} ${y - 20} ${120 - rx + 6} ${y - 30}" fill="none" stroke="#c9a46a" stroke-width="3"/>`; } },
        // a fluffy fur collar
        { front: (c, S) => { const y = S.mouthY + 26, w = S.w - 2; return `<path d="${fuzzy(120, y, w, 15, 30, 1.08, 0.9)}" fill="#ffffff" ${st(3.5)}/><path d="${fuzzy(120, y - 2, w - 10, 8, 22, 1.08, 0.9)}" fill="#f2ece2"/><circle cx="120" cy="${y + 6}" r="5" fill="${c}" ${st(2.5)}/>`; } },
        // a raincoat
        { front: (c, S) => { const y0 = S.mouthY + 16, half = Math.min(S.bw || S.w - 4, 62), dk = shade(c, -0.3);
            return `<path d="M${120 - half} ${y0 + 6} Q120 ${y0 + 20} ${120 + half} ${y0 + 6} L${120 + half - 4} 200 L${126} 200 L120 ${y0 + 22} L114 200 L${120 - half + 4} 200Z" fill="${c}" ${st(3.5)}/>` +
                `<path d="M${120 - 20} ${y0 + 6} L120 ${y0 + 22} L${120 + 20} ${y0 + 6} L${120 + 12} ${y0 - 2} L120 ${y0 + 8} L${120 - 12} ${y0 - 2}Z" fill="${dk}" ${st(3)}/>` + [0, 1, 2].filter(i => y0 + 32 + i * 14 < 194).map(i => `<circle cx="${110}" cy="${y0 + 32 + i * 14}" r="3.5" fill="#fff" ${st(2)}/>`).join(""); } },
        // a jetpack
        { back: (c, S) => { const x = 120 + S.w - 14, y = S.eyeY + 10; return [0, 1].map(i => `<rect x="${x - 4 + i * 22}" y="${y}" width="20" height="56" rx="9" fill="${i ? shade(c, -0.25) : c}" ${st(3.5)}/><path d="M${x + 6 + i * 22} ${y + 56} Q${x - 2 + i * 22} ${y + 76} ${x + 6 + i * 22} ${y + 90} Q${x + 14 + i * 22} ${y + 76} ${x + 6 + i * 22} ${y + 56}Z" fill="#ff9f1c" class="bz-glow"/><path d="M${x + 6 + i * 22} ${y + 58} Q${x + 2 + i * 22} ${y + 70} ${x + 6 + i * 22} ${y + 78} Q${x + 10 + i * 22} ${y + 70} ${x + 6 + i * 22} ${y + 58}Z" fill="#ffe066"/>`).join(""); } },
        // a gold and lapis broad collar
        { front: (c, S) => { const y = S.mouthY + 16, w = S.w - 6; return [0, 1, 2].map(i => `<path d="M${120 - w + i * 6} ${y + i * 2} Q120 ${y + 26 + i * 10} ${120 + w - i * 6} ${y + i * 2}" fill="none" stroke="${INK}" stroke-width="10"/><path d="M${120 - w + i * 6} ${y + i * 2} Q120 ${y + 26 + i * 10} ${120 + w - i * 6} ${y + i * 2}" fill="none" stroke="${["#ffd23f", "#2f8fe0", c][i]}" stroke-width="6" stroke-dasharray="${i === 1 ? "4 3" : "none"}"/>`).join(""); } },
        // a striped ringmaster's vest
        { front: (c, S) => { const y0 = S.mouthY + 18, half = Math.min(S.bw || S.w - 6, 56); return `<path d="M${120 - half} ${y0} Q${120 - half - 4} 170 ${120 - half + 10} 198 L114 198 L120 ${y0 + 10} L126 198 L${120 + half - 10} 198 Q${120 + half + 4} 170 ${120 + half} ${y0} Q120 ${y0 + 14} ${120 - half} ${y0}Z" fill="#e5484d" ${st(3.5)}/>` +
            [-0.6, -0.3, 0.3, 0.6].map(u => `<path d="M${f1(120 + u * half)} ${y0 + 6} V196" stroke="#ffffff" stroke-width="5" opacity=".9"/>`).join("") + [0, 1, 2].map(i => `<circle cx="130" cy="${y0 + 24 + i * 14}" r="3.5" fill="#ffd23f" ${st(2)}/>`).join(""); } },
        // blocky pixel armour with a heart
        { front: (c, S) => { const y0 = S.mouthY + 18, w = Math.min(S.bw || S.w - 8, 48); return `<path d="M${120 - w} ${y0} H${120 + w} V${y0 + 36} H${120 + w - 8} V${y0 + 44} H${120 - w + 8} V${y0 + 36} H${120 - w}Z" fill="${c}" ${st(3)}/><path d="M${120 - w} ${y0} H${120 + w} V${y0 + 6} H${120 - w}Z" fill="#fff" opacity=".35"/>` +
            `<path d="M112 ${y0 + 14} H116 V${y0 + 12} H120 V${y0 + 14} H124 V${y0 + 12} H128 V${y0 + 14} H132 V${y0 + 22} H128 V${y0 + 26} H124 V${y0 + 30} H116 V${y0 + 26} H112 V${y0 + 22} H108 V${y0 + 14}Z" fill="#ff2b6d" stroke="${INK}" stroke-width="2"/>`; } },
        // a ghostly shroud over the shoulders
        { back: (c, S) => `<path d="M${120 - S.w - 6} ${S.eyeY + 20} Q${120 - S.w - 22} ${S.eyeY + 90} ${120 - S.w - 4} 208 Q${120 - S.w + 4} 198 ${120 - S.w + 12} 210 Q${120 - S.w + 18} 196 ${120 - S.w + 26} 208 L${120 + S.w - 26} 208 Q${120 + S.w - 18} 196 ${120 + S.w - 12} 210 Q${120 + S.w - 4} 198 ${120 + S.w + 4} 208 Q${120 + S.w + 22} ${S.eyeY + 90} ${120 + S.w + 6} ${S.eyeY + 20}Z" fill="#e9fff8" fill-opacity=".8" ${st(3.5)}/>`,
          front: (c, S) => `<path d="M${120 - S.w + 4} ${S.mouthY + 22} Q120 ${S.mouthY + 40} ${120 + S.w - 4} ${S.mouthY + 22}" fill="none" stroke="#bff3e4" stroke-width="7" stroke-linecap="round" opacity=".85"/>` },
        // robot armour with a glowing core
        { front: (c, S) => { const y0 = S.mouthY + 18, w = Math.min(S.bw || S.w - 8, 46); return `<rect x="${120 - w}" y="${y0}" width="${w * 2}" height="${Math.min(44, 202 - y0)}" rx="8" fill="#a7b2c0" ${st(3.5)}/><rect x="${120 - w + 6}" y="${y0 + 6}" width="${w * 2 - 12}" height="6" rx="3" fill="#dfe6ee"/>` +
            [[-1, 1], [1, 1]].map(([k]) => `<circle cx="${120 + k * (w - 7)}" cy="${y0 + 7}" r="2.4" fill="#5a6470"/>`).join("") + `<circle cx="120" cy="${y0 + 26}" r="9" fill="${c}" ${st(3)} class="bz-glow"/><circle cx="117" cy="${y0 + 23}" r="2.6" fill="#fff"/>`; } },
        // dragon-scale armour
        { front: (c, S) => { const y0 = S.mouthY + 20, w = Math.min(S.bw || S.w - 8, 46); let out = ""; for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - (r % 2); i++) { const x = 120 - w + 12 + i * (w * 2 - 24) / (3 - (r % 2)) + (r % 2 ? (w - 12) / 3 : 0), y = y0 + r * 12; out += `<path d="M${f1(x - 10)} ${y} Q${f1(x)} ${y + 18} ${f1(x + 10)} ${y} Q${f1(x)} ${y + 6} ${f1(x - 10)} ${y}Z" fill="${r % 2 ? "#ff7a1f" : c}" ${st(2.5)}/>`; } return out; } },
        // a ring round it like a planet's
        { back: (c, S) => `<path d="M${120 - S.w - 30} ${S.mouthY + 14} A${S.w + 30} 18 0 0 1 ${120 + S.w + 30} ${S.mouthY + 14}" fill="none" stroke="${INK}" stroke-width="12"/><path d="M${120 - S.w - 30} ${S.mouthY + 14} A${S.w + 30} 18 0 0 1 ${120 + S.w + 30} ${S.mouthY + 14}" fill="none" stroke="${c}" stroke-width="6"/>`,
          front: (c, S) => `<path d="M${120 + S.w + 30} ${S.mouthY + 14} A${S.w + 30} 18 0 0 1 ${120 - S.w - 30} ${S.mouthY + 14}" fill="none" stroke="${INK}" stroke-width="12"/><path d="M${120 + S.w + 30} ${S.mouthY + 14} A${S.w + 30} 18 0 0 1 ${120 - S.w - 30} ${S.mouthY + 14}" fill="none" stroke="${c}" stroke-width="6"/><path d="M${120 + S.w + 18} ${S.mouthY + 20} A${S.w + 18} 10 0 0 1 ${120 - S.w - 18} ${S.mouthY + 20}" fill="none" stroke="#ffe066" stroke-width="2" opacity=".7"/>` },
        // the Cursed Angel's fallen wings: one white, one black
        { back: (c, S) => { const y = S.eyeY + 26; return [-1, 1].map(k => { const x = 120 + k * (S.w - 12), dark = k > 0, e = Math.min(48, 120 - S.w - 4);
            return `<path d="M${x} ${y} C${x + k * e * 0.4} ${y - 52} ${x + k * (e + 6)} ${y - 54} ${x + k * (e + 10)} ${y - 22} C${x + k * (e + 2)} ${y - 18} ${x + k * (e + 8)} ${y} ${x + k * (e + 2)} ${y + 6} C${x + k * (e - 4)} ${y + 10} ${x + k * (e - 2)} ${y + 26} ${x + k * (e - 10)} ${y + 28} C${x + k * (e * 0.5)} ${y + 40} ${x + k * 12} ${y + 40} ${x} ${y + 30}Z" fill="${dark ? "#1c1230" : "#ffffff"}" ${st(4)}/>` +
                `<path d="M${x + k * 10} ${y + 2} Q${x + k * (e * 0.6)} ${y - 22} ${x + k * (e + 4)} ${y - 18} M${x + k * 10} ${y + 16} Q${x + k * (e * 0.55)} ${y + 6} ${x + k * (e - 2)} ${y + 8}" fill="none" stroke="${dark ? "#9b6bff" : INK}" stroke-width="2" opacity="${dark ? 0.8 : 0.3}"/>` +
                (dark ? `<circle cx="${x + k * (e + 8)}" cy="${y - 20}" r="3" fill="#b48cff" class="bz-glow"/>` : ""); }).join(""); } },
        // The Giant Squirrel: a big fluffy tail curling up behind
        { back: (c, S) => { const x = 120 + S.w - 10, y = S.mouthY + 30, h = Math.min(70, y - 40); return `<path d="M${x} ${y} C${x + 46} ${y} ${x + 52} ${y - h * 0.7} ${x + 34} ${y - h} C${x + 22} ${y - h - 10} ${x + 4} ${y - h + 6} ${x + 12} ${y - h + 14} C${x + 30} ${y - h + 14} ${x + 30} ${y - 10} ${x} ${y - 4}Z" fill="#e0883a" ${st(3.5)}/><path d="M${x + 26} ${y - h * 0.4} q8 -10 4 -22 M${x + 14} ${y - h * 0.2} q10 -6 10 -18" stroke="#fff0d8" stroke-width="3" fill="none" opacity=".6"/>`; } },
        // Poseidon: a string of pearls
        { front: (c, S) => { const y = S.mouthY + 16, w = Math.min(S.w - 6, 44); return Array.from({ length: 9 }, (_, i) => { const a = Math.PI * (0.15 + i * 0.7 / 8), x = 120 - Math.cos(a) * w, yy = y + Math.sin(a) * 16; return `<circle cx="${f1(x)}" cy="${f1(yy)}" r="${i === 4 ? 6 : 4.2}" fill="#f4fbff" stroke="${INK}" stroke-width="2"/><circle cx="${f1(x - 1.3)}" cy="${f1(yy - 1.3)}" r="1.4" fill="#fff"/>`; }).join(""); } },
        // The Sandworm: a striped desert wrap round the neck and shoulders
        { front: (c, S) => { const y = S.mouthY + 14, w = Math.min(S.w - 2, 48); return `<path d="M${120 - w} ${y} Q120 ${y + 22} ${120 + w} ${y} L${120 + w - 4} ${y + 16} Q120 ${y + 38} ${120 - w + 4} ${y + 16}Z" fill="#e8b66d" ${st(3.5)}/><path d="M${120 - w + 4} ${y + 7} Q120 ${y + 28} ${120 + w - 4} ${y + 7}" stroke="#b0753a" stroke-width="3" fill="none"/><path d="M${120 + w - 12} ${y + 10} l6 26 l-12 -4z" fill="#e8b66d" ${st(3)}/>`; } },
        // The Lava Beast: a cloak with a glowing ember hem
        { back: (c, S) => { const y = S.eyeY + 20, w = S.w + 10; return `<path d="M${120 - w + 14} ${y} Q${120 - w - 14} ${y + 70} ${120 - w - 4} ${Math.min(214, y + 110)} H${120 + w + 4} Q${120 + w + 14} ${y + 70} ${120 + w - 14} ${y}Z" fill="#2a1c20" ${st(3.5)}/><path d="M${120 - w - 4} ${Math.min(214, y + 110)} H${120 + w + 4}" stroke="#ff6a1f" stroke-width="5" class="bz-glow"/>`; } }
    ];
    // the Weekly Quests' outfits: a sash of stars and an explorer's satchel
    const QUEST_OUTFITS = [
        { front: (c, S) => { const x1 = 120 - S.w * 0.72, y1 = S.eyeY + 24, x2 = 120 + S.w * 0.62, y2 = Math.min(200, S.mouthY + 44), mx = (x1 + x2) / 2 + 10, my = (y1 + y2) / 2 - 14;
            const path = `M${f1(x1)} ${f1(y1)} Q${f1(mx)} ${f1(my)} ${f1(x2)} ${f1(y2)}`;
            return `<path d="${path}" fill="none" stroke="${INK}" stroke-width="15" stroke-linecap="round"/><path d="${path}" fill="none" stroke="#2f5fd0" stroke-width="10" stroke-linecap="round"/>` +
                [0.2, 0.45, 0.7, 0.92].map(u => { const x = (1 - u) * (1 - u) * x1 + 2 * u * (1 - u) * mx + u * u * x2, y = (1 - u) * (1 - u) * y1 + 2 * u * (1 - u) * my + u * u * y2;
                    return `<path d="${star(x, y, 6.5, 2.8)}" fill="#ffd23f" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`; }).join(""); } },
        { front: (c, S) => { const x1 = 120 - S.w * 0.62, y1 = S.eyeY + 20, x2 = 120 + S.w * 0.52, y2 = Math.min(194, S.mouthY + 38);
            return `<path d="M${f1(x1)} ${f1(y1)} L${f1(x2)} ${f1(y2)}" stroke="${INK}" stroke-width="10" stroke-linecap="round"/><path d="M${f1(x1)} ${f1(y1)} L${f1(x2)} ${f1(y2)}" stroke="#8a5a3c" stroke-width="6" stroke-linecap="round"/>` +
                `<g transform="translate(${f1(x2)} ${f1(y2)})"><rect x="-17" y="-4" width="34" height="27" rx="6" fill="#b07a3e" ${st(3.5)}/><path d="M-17 3 Q0 14 17 3 V-4 H-17Z" fill="#8a5a3c" ${st(3)}/><circle cx="0" cy="9" r="3.2" fill="#ffd23f" ${st(2)}/></g>`; } }
    ];
    const GIFT_ITEMS = [
        // a giant eraser
        () => `<g transform="translate(206 112) rotate(-14)"><rect x="-22" y="-26" width="28" height="30" rx="5" fill="#ff9fb4" ${st(3.5)}/><rect x="4" y="-26" width="18" height="30" rx="3" fill="#4f86d9" ${st(3.5)}/><path d="M-18 -18 h18" stroke="#fff" stroke-width="3" opacity=".6"/></g>`,
        // a watering can
        () => `<g transform="translate(200 112)"><path d="M-20 -20 H12 V12 Q12 18 6 18 H-14 Q-20 18 -20 12Z" fill="#3fbf5f" ${st(3.5)}/><path d="M12 -12 L26 -26 L30 -22 L14 -4" fill="#3fbf5f" ${st(3)}/><path d="M-20 -14 Q-34 -14 -34 0 Q-34 10 -20 8" fill="none" ${st(4)}/><path d="M28 -30 l3 -4 m-1 7 l4 -2" stroke="#7fb2ff" stroke-width="2.5" stroke-linecap="round"/></g>`,
        // a little owl plush
        () => `<g transform="translate(206 104)"><ellipse cx="0" cy="0" rx="17" ry="20" fill="#8a5a3b" ${st(3.5)}/><ellipse cx="0" cy="6" rx="10" ry="11" fill="#d9b48a"/><path d="M-14 -16 L-10 -26 L-4 -18 M14 -16 L10 -26 L4 -18" fill="#8a5a3b" ${st(3)}/>` +
            [-1, 1].map(k => `<circle cx="${k * 7}" cy="-8" r="6" fill="#fff" ${st(2)}/><circle cx="${k * 7}" cy="-7" r="3" fill="${INK}"/>`).join("") + `<path d="M-3 -2 L0 3 L3 -2Z" fill="#ffb21e" ${st(1.5)}/></g>`,
        // a swirl lollipop
        () => `<g transform="translate(206 128) rotate(-8)"><rect x="-2.5" y="-54" width="5" height="56" fill="#fff" ${st(2.5)}/><circle cy="-70" r="20" fill="#ff5fa2" ${st(3.5)}/><path d="M0 -70 m-2 0 a2 2 0 1 1 4 0 a6 6 0 1 1 -12 0 a10 10 0 1 1 20 0 a14 14 0 1 1 -28 0" fill="none" stroke="#fff" stroke-width="3.5"/></g>`,
        // a golden trident
        () => `<g transform="translate(206 130) rotate(-10)"><rect x="-3" y="-88" width="6" height="96" rx="2" fill="#c9902f" ${st(3)}/><path d="M-20 -86 V-104 M0 -90 V-112 M20 -86 V-104" ${st(6)}/><path d="M-20 -86 V-104 M0 -90 V-112 M20 -86 V-104" stroke="#ffd23f" stroke-width="3" stroke-linecap="round"/><path d="M-20 -86 Q0 -74 20 -86" fill="none" ${st(6)}/><path d="M-20 -86 Q0 -74 20 -86" fill="none" stroke="#ffd23f" stroke-width="3"/></g>`,
        // an ice axe
        () => `<g transform="translate(206 128) rotate(-18)"><rect x="-3.5" y="-80" width="7" height="84" rx="3" fill="#8a5a3c" ${st(3)}/><path d="M-26 -78 Q-6 -86 0 -82 Q6 -86 20 -80 L18 -72 Q6 -76 0 -74 Q-8 -76 -26 -70Z" fill="#cfeeff" ${st(3)}/><path d="M-22 -74 Q-10 -78 -4 -78" stroke="#fff" stroke-width="2" fill="none"/></g>`,
        // a bolt of lightning
        () => `<g transform="translate(206 124) rotate(-10)" class="bz-glow"><path d="M6 -96 L-16 -48 L-2 -48 L-14 -2 L18 -60 L4 -60 L16 -96Z" fill="#ffe066" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M8 -88 L-6 -56" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></g>`,
        // a diamond kite
        () => `<g transform="translate(206 128)"><path d="M0 0 Q-10 -40 -14 -66" fill="none" stroke="${INK}" stroke-width="1.6"/><g transform="translate(-14 -88) rotate(-12)"><path d="M0 -24 L18 0 L0 26 L-18 0Z" fill="#4fa3e8" ${st(3)}/><path d="M0 -24 L0 26 M-18 0 L18 0" stroke="${INK}" stroke-width="2"/><path d="M0 -24 L18 0 L0 0Z" fill="#ffd23f"/><path d="M0 26 Q8 36 0 44 Q-8 52 2 60" fill="none" stroke="#e5484d" stroke-width="2.5"/></g></g>`,
        // an ankh staff
        () => `<g transform="translate(206 130) rotate(-6)"><rect x="-3.5" y="-78" width="7" height="86" rx="3" fill="#ffd23f" ${st(3)}/><path d="M-16 -78 H16" ${st(8)}/><path d="M-16 -78 H16" stroke="#ffd23f" stroke-width="4" stroke-linecap="round"/><ellipse cx="0" cy="-94" rx="10" ry="14" fill="none" ${st(8)}/><ellipse cx="0" cy="-94" rx="10" ry="14" fill="none" stroke="#ffd23f" stroke-width="4"/></g>`,
        // a box of popcorn
        () => `<g transform="translate(206 116)"><path d="M-16 -18 L16 -18 L12 16 L-12 16Z" fill="#ffffff" ${st(3.5)}/><path d="M-9 -18 L-7 16 M0 -18 V16 M9 -18 L7 16" stroke="#e5484d" stroke-width="5"/>` +
            [[-12, -22], [-4, -27], [5, -24], [13, -21], [0, -32], [-9, -30], [9, -31]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5.5" fill="#fff4c8" ${st(2)}/>`).join("") + `</g>`,
        // a game controller
        () => `<g transform="translate(204 112) rotate(-8)"><path d="M-26 -10 Q-26 -20 -14 -20 H14 Q26 -20 26 -10 L30 10 Q32 20 22 18 L12 8 H-12 L-22 18 Q-32 20 -30 10Z" fill="#5a5f6e" ${st(3.5)}/><path d="M-16 -10 V0 M-21 -5 H-11" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"/><circle cx="12" cy="-10" r="3.5" fill="#ff2bd6"/><circle cx="19" cy="-4" r="3.5" fill="#2bf0ff"/></g>`,
        // a little ghost friend floating by the hand
        () => `<g transform="translate(212 92)" class="bz-float"><path d="M-16 6 C-16 -22 16 -22 16 6 L16 20 L10 15 L4 21 L-2 15 L-8 21 L-16 16Z" fill="#effffa" stroke="#7fd8c0" stroke-width="3"/><circle cx="-6" cy="-2" r="3" fill="${INK}"/><circle cx="6" cy="-2" r="3" fill="${INK}"/><ellipse cx="0" cy="7" rx="3" ry="4" fill="${INK}"/></g>`,
        // a wrench
        () => `<g transform="translate(206 128) rotate(-24)"><rect x="-4" y="-66" width="8" height="66" rx="4" fill="#a7b2c0" ${st(3)}/><path d="M-14 -66 Q-16 -86 0 -88 Q16 -86 14 -66 L6 -66 L6 -78 L-6 -78 L-6 -66Z" fill="#a7b2c0" ${st(3)}/></g>`,
        // a burning torch
        () => `<g transform="translate(206 128) rotate(-10)"><path d="M-5 -2 L-8 -58 H8 L5 -2Z" fill="#8a5a3c" ${st(3)}/><rect x="-10" y="-60" width="20" height="8" rx="2" fill="#5a5f6e" ${st(2.5)}/><g class="bz-glow"><path d="M0 -60 Q-16 -76 -2 -100 Q2 -84 10 -86 Q16 -72 0 -60Z" fill="#ff7a1f" ${st(2.5)}/><path d="M0 -62 Q-7 -72 0 -86 Q6 -74 0 -62Z" fill="#ffe066"/></g></g>`,
        // a brass telescope
        () => `<g transform="translate(206 120) rotate(-32)"><rect x="-6" y="-14" width="12" height="28" rx="3" fill="#7a4a2a" ${st(3)}/><rect x="-8" y="-46" width="16" height="34" rx="3" fill="#e0b020" ${st(3)}/><rect x="-11" y="-74" width="22" height="30" rx="3" fill="#ffd23f" ${st(3)}/><ellipse cx="0" cy="-74" rx="11" ry="4" fill="#bfe6ff" ${st(2)}/></g>`,
        // the angel's feather quill
        () => `<g transform="translate(206 128) rotate(-16)"><path d="M0 4 L-3 -10 L3 -10Z" fill="#e8c66a" ${st(2)}/><path d="M0 -10 C-22 -40 -14 -84 6 -104 C10 -76 16 -40 0 -10Z" fill="#ffffff" ${st(3)}/><path d="M0 -10 Q-2 -60 6 -104" fill="none" stroke="#9b6bff" stroke-width="2"/>` +
            [0, 1, 2, 3].map(i => `<path d="M${-1 + i * 0.8} ${-26 - i * 18} l-9 -6" stroke="#c49bff" stroke-width="1.6"/>`).join("") + `<circle cx="7" cy="-102" r="3" fill="#ffd06b" class="bz-glow"/></g>`,
        // The Giant Squirrel: an acorn nearly as big as your head
        () => `<g transform="translate(204 126)"><ellipse cx="0" cy="-20" rx="20" ry="24" fill="#b9773e" ${st(3.5)}/><path d="M-24 -30 a24 16 0 0 1 48 0z" fill="#6e4429" ${st(3.5)}/><path d="M0 -46 v-10" ${st(6)}/><path d="M-10 -18 q3 -9 10 -9" stroke="#f2d2a2" stroke-width="3" fill="none" stroke-linecap="round"/></g>`,
        // Poseidon: a conch shell
        () => `<g transform="translate(204 120) rotate(-20)"><path d="M-14 0 C-22 -24 -4 -52 14 -46 C24 -42 22 -26 12 -20 C22 -14 18 0 4 4 Z" fill="#ffd7c4" ${st(3.5)}/><path d="M-6 -6 Q4 -24 12 -38 M2 0 Q10 -14 14 -24" stroke="#e8a08a" stroke-width="2.5" fill="none"/><path d="M14 -46 l6 -8" ${st(4)}/></g>`,
        // The Sandworm: an hourglass running
        () => `<g transform="translate(204 124)"><rect x="-18" y="-60" width="36" height="6" rx="2" fill="#8a5424" ${st(3)}/><rect x="-18" y="-4" width="36" height="6" rx="2" fill="#8a5424" ${st(3)}/><path d="M-13 -54 C-13 -36 -2 -32 0 -29 C2 -32 13 -36 13 -54Z M-13 -4 C-13 -22 -2 -26 0 -29 C2 -26 13 -22 13 -4Z" fill="#dff3ff" ${st(2.5)}/><path d="M-8 -50 Q0 -40 8 -50Z M-11 -4 Q0 -16 11 -4Z" fill="#e8b66d"/><path d="M0 -29 V-6" stroke="#e8b66d" stroke-width="1.6"/></g>`,
        // The Lava Beast: a pickaxe with a glowing head
        () => `<g transform="translate(204 128) rotate(-18)"><rect x="-4" y="-80" width="8" height="80" rx="3" fill="#8a5a3c" ${st(3)}/><path d="M-30 -74 Q0 -96 30 -74 L26 -68 Q0 -84 -26 -68Z" fill="#5a4448" ${st(3)}/><path d="M-30 -74 l-4 6 M30 -74 l4 6" stroke="#ff8a2a" stroke-width="3" stroke-linecap="round" class="bz-glow"/></g>`
    ];
    // the Weekly Quests' things to hold: a golden pencil and a compass
    const QUEST_ITEMS = [
        () => `<g transform="translate(206 128) rotate(-18)"><rect x="-6" y="-66" width="12" height="64" fill="#ffcf3a" ${st(3)}/><path d="M-6 -66 L0 -84 L6 -66Z" fill="#f2d2a2" ${st(3)}/><path d="M-2 -78 L0 -84 L2 -78Z" fill="${INK}"/>` +
            `<rect x="-6" y="-8" width="12" height="8" fill="#c8ccd8" ${st(3)}/><path d="M-1.5 -60 V-12" stroke="#fff6c0" stroke-width="2.5"/><path d="${star(16, -70, 7, 3)}" fill="#fff6c0" class="bz-glow"/></g>`,
        () => `<g transform="translate(206 114)"><rect x="-3.5" y="-27" width="7" height="7" rx="2" fill="#e0b020" ${st(2.5)}/><circle r="20" fill="#e0b020" ${st(3.5)}/><circle r="14" fill="#fffaf0" ${st(2)}/>` +
            `<path d="M0 -12 L4 0 L-4 0Z" fill="#e5484d"/><path d="M0 12 L4 0 L-4 0Z" fill="#5a6474"/><circle r="2.2" fill="${INK}"/><path d="M0 -14 V-11 M14 0 H11 M0 14 V11 M-14 0 H-11" stroke="${INK}" stroke-width="1.5"/></g>`
    ];
    GIFT_TOPS.push(...QUEST_TOPS);
    GIFT_OUTFITS.push(...QUEST_OUTFITS);
    GIFT_ITEMS.push(...QUEST_ITEMS);
    // which list index each quest part has (after the 20 bosses' gifts), for Quests (quests.js)
    const QUEST_PARTS = [
        { id: "hero-laurel", key: "top", index: 19 + GIFT_WORLDS.length },
        { id: "hero-explorer", key: "top", index: 20 + GIFT_WORLDS.length },
        { id: "hero-starsash", key: "outfit", index: 13 + GIFT_WORLDS.length },
        { id: "hero-satchel", key: "outfit", index: 14 + GIFT_WORLDS.length },
        { id: "hero-goldpencil", key: "item", index: 15 + GIFT_WORLDS.length },
        { id: "hero-compass", key: "item", index: 16 + GIFT_WORLDS.length }
    ];
    QUEST_PARTS.forEach(q => { q.name = PARTS[q.key][q.index]; });
    const GIFT = {};
    GIFT_WORLDS.forEach((w, i) => { GIFT[w] = { top: 19 + i, outfit: 13 + i, item: 15 + i }; });
    // which parts are still locked: { top: Set, outfit: Set, item: Set } for the bosses you haven't beaten
    function locked(beaten) {
        const out = { top: new Set(), outfit: new Set(), item: new Set() };
        if (!beaten) return out;
        for (const w of GIFT_WORLDS) if (!beaten.includes(w)) for (const k of ["top", "outfit", "item"]) out[k].add(GIFT[w][k]);
        // the Weekly Quests' parts stay locked until a quest gives them
        for (const q of QUEST_PARTS) if (!(typeof Quests !== "undefined" && Quests.owns(q.id))) out[q.key].add(q.index);
        return out;
    }
    const giftNames = world => (GIFT[world] ? [TOPS[GIFT[world].top], OUTFITS[GIFT[world].outfit], ITEMS[GIFT[world].item]] : null);

    // a fuzzy outline around an ellipse (fur), like the bosses'
    function fuzzy(cx, cy, rx, ry, n = 36, out = 1.06, inn = 0.95) {
        let d = "";
        for (let i = 0; i <= n; i++) {
            const a = (i / n) * Math.PI * 2, b = ((i + 0.5) / n) * Math.PI * 2;
            const p = [cx + Math.cos(a) * rx * inn, cy + Math.sin(a) * ry * inn], q = [cx + Math.cos(b - Math.PI / n) * rx * out, cy + Math.sin(b - Math.PI / n) * ry * out];
            d += i === 0 ? `M${f1(p[0])} ${f1(p[1])}` : `Q${f1(q[0])} ${f1(q[1])} ${f1(p[0])} ${f1(p[1])}`;
        }
        return d + "Z";
    }

    const pick = a => Math.floor(Math.random() * a.length);
    // a random part that isn't locked (lock: a Set of locked indexes)
    const pickOpen = (list, lock, from = 0) => { const ok = list.map((_, i) => i).filter(i => i >= from && !(lock && lock.has(i))); return ok[Math.floor(Math.random() * ok.length)]; };
    function random(name = "Hero", beaten = null) {
        const L = locked(beaten);
        return { name, body: pick(BODIES), color: COLORS[pick(COLORS)], eyes: pick(EYES), mouth: pick(MOUTHS), face: pick(FACES), top: pickOpen(TOPS, L.top), topColor: ACCENTS[pick(ACCENTS)],
            outfit: pickOpen(OUTFITS, L.outfit), outfitColor: ACCENTS[pick(ACCENTS)], item: pickOpen(ITEMS, L.item, 1) };
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
        if (kind >= 19 && GIFT_TOPS[kind - 19]) return GIFT_TOPS[kind - 19](t, c, S);
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
        if (kind >= 13) { const g = GIFT_OUTFITS[kind - 13]; return g && g.back ? g.back(c, S) : ""; }
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
        if (kind >= 13) { const g = GIFT_OUTFITS[kind - 13]; return g && g.front ? g.front(c, S) : ""; }
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
        if (kind >= 15 && GIFT_ITEMS[kind - 15]) return GIFT_ITEMS[kind - 15]();
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
    function maker({ look, first = false, beaten = null } = {}) {
        return new Promise(done => {
            const L = locked(beaten), lockOf = key => L[key] || null;
            let cur = fix(look || random("Hero", beaten));
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
                        U.el("button", { type: "button", class: "hm-arrow", "aria-label": `Previous ${label}`, html: chev(-1), onclick: () => set(key, step(key, list, -1)) }),
                        val,
                        U.el("button", { type: "button", class: "hm-arrow", "aria-label": `Next ${label}`, html: chev(1), onclick: () => set(key, step(key, list, 1)) })));
            };
            // the next part along that isn't locked (bosses not beaten yet keep theirs)
            const step = (key, list, d) => { const lock = lockOf(key); let v = cur[key]; for (let i = 0; i < list.length; i++) { v = (v + d + list.length) % list.length; if (!lock || !lock.has(v)) return v; } return cur[key]; };
            // (a secret world's 3 gifts aren't counted until that world is open: no spoilers)
            const hiddenSecrets = !beaten ? 0 : ["rift", "hollow", "atlantis", "dunes", "cave"].filter(w => !beaten.includes(w) && !(typeof Campaign !== "undefined" && Campaign.secretOpen(w))).length;
            const left = L.top.size + L.outfit.size + L.item.size - hiddenSecrets * 3;
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
                    cur.outfit ? swatches("Outfit Colour", "outfitColor", ACCENTS) : "",
                    beaten && left ? U.el("p", { class: "hm-locked", text: `🎁 ${left} more parts to win: every boss you beat gives your hero a hat, an outfit and something to hold, and the Weekly Quests give more.` }) : "");
            }
            const close = value => { removeEventListener("keydown", onKey, true); U.dialog.close(modal); modal.classList.remove("in"); setTimeout(() => modal.remove(), 250); done(value); };
            const onKey = e => { if (e.key === "Escape" && !first && U.dialog.top(modal)) { e.preventDefault(); close(null); } };
            addEventListener("keydown", onKey, true);
            U.dialog.open(modal);
            const actions = U.el("div", { class: "hm-actions" },
                U.el("button", { type: "button", class: "btn", text: "Surprise Me", onclick: () => { cur = fix({ ...random(cur.name, beaten), name: cur.name }); Sound.play("pop"); draw(); } }),
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

    return { svg, inner, maker, random, fix, cleanName, giftNames, GIFT_WORLDS, COLORS, ACCENTS, QUEST_PARTS };
})();
