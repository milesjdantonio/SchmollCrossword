// Reward boxes: every finished quest gives a box (quests.js), and opening one is a little show.
//   1. The box drops in and shakes harder and harder, then bursts open in a flash of light.
//   2. A reel of rewards spins past a marker, ticking as each one goes by, slows down and lands.
//   3. The reward is revealed in its rarity's colour, with Use It and Open the Next One.
// What a box gives is decided before the spin, by its odds (a Weekly Box is far better than a Daily Box, and only a
// Weekly Box can be legendary), from the things you don't own yet: never a repeat. Coins are a possible prize too.
// Unopened boxes are saved (Collection's store, "boxes"), so a reload never loses or repeats one.
const Boxes = (() => {
    const KINDS = {
        daily: { name: "Daily Box", odds: { common: 52, uncommon: 30, rare: 14, epic: 4, legendary: 0 }, coins: [[30, "common"], [60, "uncommon"], [120, "rare"]], colors: ["#3ab0e0", "#1f6fa8", "#ffd23f"] },
        weekly: { name: "Weekly Box", odds: { common: 0, uncommon: 18, rare: 44, epic: 30, legendary: 8 }, coins: [[150, "rare"], [300, "epic"]], colors: ["#8a4fd0", "#4a2290", "#ffcf3a"] }
    };
    const COIN_CHANCE = { daily: 0.18, weekly: 0.08 };

    // ---- the saved boxes ----
    const list = () => Collection.store().boxes;
    function add(kind, from) {
        const r = Collection.store();
        r.boxes.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), kind, from });
        Collection.save(r);
    }
    const count = () => list().length;

    // ---- what a box gives ----
    function coinItem(amount, rarity) { return { id: "coins-" + amount, kind: "coins", name: `${amount} Coins`, amount, rarity }; }
    function roll(kind) {
        const k = KINDS[kind] || KINDS.daily, pool = Collection.unowned();
        if (!pool.length || Math.random() < COIN_CHANCE[kind]) { const [a, r] = k.coins[Math.floor(Math.random() * k.coins.length)]; return coinItem(a, r); }
        // a rarity by the odds; if there's nothing left of it, the nearest rarity that still has something
        const order = Collection.RARITIES, weights = order.map(r => k.odds[r] || 0), total = weights.reduce((a, b) => a + b, 0);
        let x = Math.random() * total, pick = order[0];
        for (let i = 0; i < order.length; i++) { if ((x -= weights[i]) < 0) { pick = order[i]; break; } }
        const at = order.indexOf(pick), allowed = r => kind === "weekly" || r !== "legendary";
        for (let d = 0; d < order.length; d++) for (const i of [at - d, at + d]) {
            const r = order[i];
            if (!r || !allowed(r)) continue;
            const left = pool.filter(p => p.rarity === r);
            if (left.length) return left[Math.floor(Math.random() * left.length)];
        }
        const [a, r] = k.coins[0];
        return coinItem(a, r);
    }
    function give(item) {
        if (item.kind === "coins") { if (typeof Campaign !== "undefined" && Campaign.addCoins) Campaign.addCoins(item.amount); }
        else Collection.give(item.id);
    }

    // ---- pictures ----
    function boxSvg(kind, size = 120) {
        const [body, dark, ribbon] = (KINDS[kind] || KINDS.daily).colors;
        return `<svg viewBox="0 0 120 120" width="${size}" height="${size}" aria-hidden="true">
            <ellipse cx="60" cy="108" rx="40" ry="7" fill="rgba(0,0,0,.25)"/>
            <g class="bx-body"><rect x="18" y="52" width="84" height="54" rx="6" fill="${body}" stroke="#2b2233" stroke-width="3.5"/>
            <rect x="18" y="52" width="84" height="12" fill="${dark}" opacity=".35"/>
            <rect x="53" y="52" width="14" height="54" fill="${ribbon}" stroke="#2b2233" stroke-width="3"/></g>
            <g class="bx-lid"><rect x="12" y="38" width="96" height="18" rx="5" fill="${body}" stroke="#2b2233" stroke-width="3.5"/>
            <rect x="53" y="38" width="14" height="18" fill="${ribbon}" stroke="#2b2233" stroke-width="3"/>
            <path d="M60 38 C44 18 28 30 46 38 Z M60 38 C76 18 92 30 74 38 Z" fill="${ribbon}" stroke="#2b2233" stroke-width="3" stroke-linejoin="round"/>
            ${kind === "weekly" ? `<path d="M96 22 l3 7 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1z" fill="#fff6c0" stroke="#2b2233" stroke-width="2"/>` : ""}</g></svg>`;
    }
    function picture(item) {
        if (Collection.KIND[item.kind]) { const p = Collection.preview(item); p.classList.add("bx-pic"); return p; }
        if (item.kind === "hero") {                                           // the part itself, on a hero
            const look = Hero.fix({ name: "Hero", top: 0, outfit: 0, item: 0, [item.key]: item.index });
            return U.el("span", { class: "bx-pic bx-hero", html: Hero.svg(look, "", { still: true }) });
        }
        return U.el("span", { class: "bx-pic bx-coins" }, U.icon("coin"), U.el("b", { text: String(item.amount) }));
    }
    const label = item => (item.kind === "hero" ? `${item.name} (for your hero)` : Collection.nameOf(item));
    const ABOUT = { colour: "Put it on any world's board.", letters: "The letters on any world's board.", effect: "It bursts over the board when you solve.",
        trail: "A puff from every letter you type.", highlight: "The square and the word you're on.", hero: "Find it in the hero maker.", coins: "Spend them in the Collection or the campaign's shop." };

    // ---- the show ----
    let layer = null;
    const motion = () => U.motion() !== "still";
    const wait = ms => new Promise(r => setTimeout(r, motion() ? ms : 0));
    function openAll() {
        if (layer || !count()) return;
        layer = U.el("div", { class: "results in bx-layer", role: "dialog", "aria-modal": "true", "aria-label": "Opening a box" });
        const stage = U.el("div", { class: "bx-stage" });
        layer.appendChild(stage);
        document.getElementById("overlay").appendChild(layer);
        const onKey = e => { if (e.key === "Escape" && layer && layer.classList.contains("can-close")) { e.stopPropagation(); close(); } };
        document.addEventListener("keydown", onKey, true);
        function close() {
            document.removeEventListener("keydown", onKey, true);
            if (layer) layer.remove();
            layer = null;
            Bus.emit("collection");
        }
        Mascot.hush();
        openNext(stage, close);
    }
    async function openNext(stage, close) {
        const boxes = list();
        if (!boxes.length) { close(); return; }
        const box = boxes[0], k = KINDS[box.kind] || KINDS.daily;
        layer.classList.remove("can-close");
        // 1. the box: drops in, then you open it (or it opens by itself after a moment)
        const boxEl = U.el("button", { type: "button", class: "bx-box drop", "aria-label": `Open your ${k.name}`, html: boxSvg(box.kind, 180) });
        const caption = U.el("p", { class: "bx-caption" }, U.el("b", { text: k.name }), U.el("span", { text: box.from || "" }));
        const hint = U.el("p", { class: "bx-hint", text: "Tap to Open" });
        stage.replaceChildren(U.el("div", { class: "bx-glow", style: { "--c": k.colors[0] } }), boxEl, caption, hint);
        Sound.play("thud");
        await new Promise(res => { let done = false; const go = () => { if (done) return; done = true; res(); }; boxEl.addEventListener("click", go, { once: true }); setTimeout(go, motion() ? 2600 : 0); });
        hint.remove();
        // 2. it shakes harder and harder, then bursts open
        for (let i = 0; i < 3; i++) { boxEl.classList.remove("shake"); void boxEl.offsetWidth; boxEl.style.setProperty("--k", 1 + i * 0.6); boxEl.classList.add("shake"); Sound.play("pop"); await wait(380 - i * 60); }
        // the prize is decided now, and saved straight away (taken off the box list in the same write)
        const item = roll(box.kind);
        const r = Collection.store();
        r.boxes = r.boxes.filter(b => b.id !== box.id);
        Collection.save(r);
        give(item);
        boxEl.classList.add("burst");
        Sound.play("reveal");
        const b = boxEl.getBoundingClientRect();
        if (typeof FX !== "undefined") { FX.flash(k.colors[2], 380, 0.6); FX.burst({ x: b.left + b.width / 2, y: b.top + b.height / 2, n: 40, colors: [k.colors[2], "#ffffff", k.colors[0]], shape: "star", speed: [160, 420], gravity: 260, life: [0.6, 1.1], size: [4, 9] }); }
        await wait(550);
        // 3. the reel: fillers from everything, the prize near the end, a marker in the middle
        await spin(stage, item, box.kind);
        // 4. the reveal
        const color = Collection.RARITY_COLOR[item.rarity];
        const canUse = !!Collection.KIND[item.kind];
        const left = list().length;
        const actions = U.el("div", { class: "res-actions" },
            canUse ? U.el("button", { type: "button", class: "btn primary", text: "Use It", onclick: () => { Collection.equip(item.kind, item.id); Sound.play("select"); useBtnDone(); } }) : null,
            left ? U.el("button", { type: "button", class: canUse ? "btn" : "btn primary", text: `Open the Next One (${left})`, onclick: () => { Sound.play("select"); openNext(stage, close); } }) : null,
            U.el("button", { type: "button", class: "btn ghost", text: left ? "Later" : "Done", onclick: () => close() }));
        const reveal = U.el("div", { class: "bx-reveal r-" + item.rarity, style: { "--rc": color } },
            U.el("small", { class: "bx-rarity", text: Collection.RARITY_NAME[item.rarity] || "" }),
            U.el("div", { class: "bx-prize" }, picture(item)),
            U.el("h2", { text: label(item) }),
            U.el("p", { text: ABOUT[item.kind] || "" }),
            actions);
        function useBtnDone() { const u = actions.querySelector(".btn.primary"); if (u) { u.textContent = "In Use"; u.disabled = true; } }
        stage.appendChild(reveal);
        layer.classList.add("can-close");
        if (item.rarity === "epic" || item.rarity === "legendary") Sound.play("win"); else Sound.play("achievement");
        const pr = reveal.querySelector(".bx-prize").getBoundingClientRect();
        if (typeof FX !== "undefined") FX.burst({ x: pr.left + pr.width / 2, y: pr.top + pr.height / 2, n: item.rarity === "legendary" ? 80 : 36, colors: [color, "#ffffff", "#ffe27a"], shape: "rect", speed: [140, 440], gravity: 380, life: [0.8, 1.4], size: [5, 9] });
        const first = actions.querySelector("button");
        if (first) first.focus({ preventScroll: true });
    }

    // The reel: about 50 cards slide past the marker, fast at first then slowing to a stop on the prize. A tick
    // plays as each card passes the marker (it can't be skipped mid-spin, but with reduced motion it's instant).
    async function spin(stage, prize, kind) {
        const CARD = 132, N = 52, AT = 46;
        const everything = Collection.everything();
        const k = KINDS[kind] || KINDS.daily;
        const weighted = () => {                                                // fillers look like what the box can give
            const r = Math.random() * 100;
            let acc = 0, rarity = "common";
            for (const x of Collection.RARITIES) { acc += k.odds[x] + (x === "legendary" ? 3 : 0); if (r < acc) { rarity = x; break; } }
            const same = everything.filter(x => x.rarity === rarity);
            return same.length ? same[Math.floor(Math.random() * same.length)] : everything[Math.floor(Math.random() * everything.length)];
        };
        const items = Array.from({ length: N }, (_, i) => (i === AT ? prize : weighted()));
        const kindName = { colour: "Board", letters: "Letters", effect: "Win Effect", trail: "Trail", highlight: "Highlight", hero: "Hero", coins: "Coins" };
        const strip = U.el("div", { class: "bx-strip" }, ...items.map(it => U.el("div", { class: "bx-card r-" + it.rarity, style: { "--rc": Collection.RARITY_COLOR[it.rarity] } },
            picture(it), U.el("b", { text: it.name }), U.el("small", { text: kindName[it.kind] || "" }))));
        const reel = U.el("div", { class: "bx-reel" }, strip, U.el("i", { class: "bx-marker", "aria-hidden": "true" }));
        stage.replaceChildren(reel);
        const width = reel.clientWidth || 800;
        const end = AT * CARD + CARD / 2 - width / 2 + (Math.random() - 0.5) * CARD * 0.6;     // land somewhere on the prize's card
        if (!motion()) { strip.style.transform = `translateX(${-end}px)`; reel.classList.add("landed"); return; }
        const T = 5200, start = performance.now(), ease = x => 1 - Math.pow(1 - x, 4);
        let lastCard = -1;
        await new Promise(res => {
            const step = now => {
                const x = Math.min(1, (now - start) / T), pos = ease(x) * end;
                strip.style.transform = `translateX(${-pos}px)`;
                const card = Math.floor((pos + width / 2) / CARD);
                if (card !== lastCard) { lastCard = card; Sound.play("tile", card); }
                if (x < 1) requestAnimationFrame(step); else res();
            };
            requestAnimationFrame(step);
        });
        reel.classList.add("landed");
        strip.children[AT].classList.add("won");
        await wait(700);
        reel.classList.add("done");
        await wait(250);
    }

    return { add, count, openAll, boxSvg, KINDS };
})();
