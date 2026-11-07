// Option A, World Stage: one world at a time, its whole road on one screen. The five levels and the boss sit on a
// road across the world's own scene; the level you pick (the next one, to start with) opens in a panel beside it,
// never over it; a strip of named worlds runs along the bottom. Everything else (shop, skills, hero, book, help)
// lives in one Pack.

(async () => {
    const { el, icon } = Demo;
    const $ = id => document.getElementById(id);
    const phone = matchMedia("(max-width: 760px)");

    try {
        await Demo.load();
    } catch (err) {
        document.body.append(el("p", { class: "ws-fail", text: "The level data couldn't be loaded. Is the local server running?" }));
        return;
    }
    const map = Demo.map;
    const start = Demo.next();
    let si = start.si, sel = start.l;
    const look = Hero.fix({ name: "Tess" });

    // where the five stops sit on the stage, in % of its box: across on a computer, climbing on a phone
    const SPOTS = {
        wide: [[10, 70], [28, 38], [47, 66], [66, 34], [86, 58]],
        tall: [[26, 87], [72, 71], [28, 54], [72, 37], [50, 15]]
    };
    const spots = () => SPOTS[phone.matches ? "tall" : "wide"];

    // a smooth road through the stops (Catmull-Rom turned into curves)
    function road(pts) {
        let d = `M ${pts[0][0]} ${pts[0][1]}`;
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
            const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
            d += ` C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p2[0]} ${p2[1]}`;
        }
        return d;
    }

    // ---- the top bar ----
    $("ws-back").append(icon("back"));
    $("ws-back").addEventListener("click", () => Demo.said("In the game this goes back to Home."));
    const t = Demo.totals();
    $("ws-stars").append(icon("star"), el("b", { text: `${t.stars}` }), el("span", { text: ` / ${t.max}` }));
    $("ws-coins").append(U.icon("coin"), el("b", { text: String(Demo.sample.coins) }));
    $("ws-pack-open").prepend(icon("bag"));

    function drawBar() {
        const s = map[si], w = Worlds.byId[s.world];
        $("ws-world").textContent = w.name;
        $("ws-where").textContent = s.secret ? "Secret World" : `World ${si + 1} of ${map.filter(x => !x.secret).length} · ${Bosses.info(s.world).name}'s World`;
    }

    // ---- the stage ----
    function drawStage(animate) {
        const s = map[si], pts = spots(), open = Demo.worldOpen(si);
        const stops = $("ws-stops");
        stops.replaceChildren();
        const full = road(pts);
        $("ws-road-bed").setAttribute("d", full);
        $("ws-road-ahead").setAttribute("d", full);
        // the part of the road already travelled: up to the furthest stop reached
        const reached = [1, 2, 3, 4, 5].filter(l => Demo.levelOpen(si, l)).length;
        $("ws-road-done").setAttribute("d", reached > 1 ? road(pts.slice(0, reached)) : "");
        $("ws-stage").classList.toggle("is-locked", !open);
        const nxt = Demo.next();
        for (const l of [1, 2, 3, 4, 5]) {
            const lv = Demo.level(si, l), [x, y] = pts[l - 1];
            const isNext = nxt.si === si && nxt.l === l;
            const state = lv.rec ? "done" : lv.open ? "open" : "locked";
            const stop = el("button", {
                type: "button", class: `ws-stop ${state}${lv.boss ? " boss" : ""}${isNext ? " next" : ""}${l === sel ? " sel" : ""}`,
                style: { "--x": x + "%", "--y": y + "%", "--i": l },
                "aria-pressed": l === sel ? "true" : "false",
                "aria-label": `${lv.boss ? "Boss: " + lv.bossInfo.name : "Level " + l + ": " + (lv.lesson ? lv.lesson.name : lv.label)}, ${lv.rec ? lv.rec.stars + " of 3 stars" : lv.open ? "not played yet" : "locked"}`,
                onclick: () => select(l)
            });
            const disc = el("span", { class: "ws-disc" });
            if (lv.boss) disc.append(el("span", { class: "ws-boss-art", html: Bosses.svg(s.world) }));
            else disc.append(el("b", { text: String(l) }));
            if (state === "locked") disc.append(icon("lock", "ws-lock"));
            stop.append(disc);
            const tag = el("span", { class: "ws-tag" }, el("b", { text: lv.boss ? lv.bossInfo.name : (lv.lesson ? lv.lesson.name : lv.label) }));
            if (lv.rec) tag.append(Demo.stars(lv.rec.stars));
            else if (isNext) tag.append(el("small", { text: "Next" }));
            else if (!lv.open) tag.append(el("small", { text: lv.boss ? "Boss" : lv.label }));
            else tag.append(el("small", { text: lv.label }));
            stop.append(tag);
            stops.append(stop);
            if (isNext && open) {
                const hero = el("div", { class: "ws-hero", style: { "--x": x + "%", "--y": y + "%" }, html: Hero.svg(look), "aria-hidden": "true" });
                stops.append(hero);
            }
        }
        // locked world: what opens it
        const locked = $("ws-locked");
        locked.hidden = open;
        if (!open) {
            const prev = map[si - 1];
            locked.replaceChildren(icon("lock", "ws-locked-icon"), el("p", { text: `Beat ${Bosses.info(prev.world).name} in ${Worlds.byId[prev.world].name} to open ${Worlds.byId[s.world].name}.` }));
        }
        // neighbours
        for (const [id, k] of [["ws-prev", -1], ["ws-next", 1]]) {
            const b = $(id), n = si + k, there = map[n];
            b.hidden = !there || (there.secret && !Demo.worldOpen(n));
            if (b.hidden) continue;
            b.replaceChildren(icon(k < 0 ? "prev" : "next"), el("span", { text: Worlds.byId[there.world].name }));
            b.setAttribute("aria-label", `${k < 0 ? "Previous" : "Next"} world: ${Worlds.byId[there.world].name}`);
        }
        if (animate) $("ws-stage").classList.remove("deal"), void $("ws-stage").offsetWidth, $("ws-stage").classList.add("deal");
    }

    // ---- the panel: the selected level ----
    function factRow(...items) { return el("p", { class: "ws-facts" }, ...items.filter(Boolean).map(x => el("span", {}, ...[].concat(x)))); }
    function drawPanel() {
        const lv = Demo.level(si, sel), s = map[si], w = Worlds.byId[s.world], panel = $("ws-panel");
        panel.replaceChildren();
        const head = el("div", { class: "ws-p-head" });
        if (lv.boss) head.append(el("div", { class: "ws-p-boss", html: Bosses.svg(s.world) }));
        else {
            head.append(Demo.companion(s.world, phone.matches ? 52 : 68));
            const line = typeof Companions !== "undefined" && Companions.level(s.world, sel);
            if (line && w.mascot) head.append(el("p", { class: "ws-p-says" }, el("b", { text: w.mascot.name }), " " + line));
        }
        panel.append(head);
        const body = el("div", { class: "ws-p-body" });
        panel.append(body);
        body.append(el("h2", { class: "ws-p-title", text: lv.boss ? lv.bossInfo.name : `${w.name} ${sel}` }));
        if (lv.boss) {
            body.append(el("p", { class: "ws-p-taunt", text: `“${lv.bossInfo.taunt}”` }));
            const th = Powers.threat(si, 15);
            const mins = Math.max(2, Math.round((lv.par * lv.phases * 0.8) / 60));
            body.append(factRow([icon("crown"), `${lv.phases} Phase${lv.phases > 1 ? "s" : ""}`], [icon("clock"), `About ${mins} Minutes`], [icon("target"), `Threat ${th.stars} of 5`]));
            const moves = el("details", { class: "ws-p-moves" }, el("summary", { text: `Its ${lv.moves.length} Moves` }));
            for (const m of lv.moves) moves.append(el("p", {}, el("b", { text: m.name }), " It " + m.desc + "."));
            body.append(moves);
            const kit = Powers.ABILITIES.filter(a => a.world === s.world);
            body.append(el("h3", { text: "Your Abilities" }), el("ul", { class: "ws-p-kit" }, ...kit.map((a, i) => el("li", { style: { "--c": a.fx && a.fx.color } }, el("b", { text: a.name }), el("small", { text: `Key ${i + 1}` })))));
        } else {
            body.append(factRow(lv.label, lv.size === 5 ? "5×5" : null, [icon("clock"), `Par ${Demo.fmt(lv.par)}`]));
            if (lv.lesson) body.append(el("section", { class: "ws-p-lesson" },
                el("h3", { text: lv.lesson.name }),
                el("p", { text: lv.lesson.practise }),
                el("p", { class: "ws-p-tip" }, icon("spark"), el("span", { text: lv.lesson.tip }))));
        }
        const goals = lv.boss ? ["Beat the boss", "No items", lv.goal] : ["Solve it", "No items", lv.goal];
        const earned = lv.rec ? lv.rec.stars : 0;
        body.append(el("h3", { text: "Stars" }), el("ul", { class: "ws-p-stars" }, ...goals.map((g, i) => el("li", { class: i < earned ? "got" : "" }, icon("star"), el("span", { text: Demo.cap(g) })))));
        if (lv.prize) body.append(el("p", { class: "ws-p-prize" }, icon("bolt"), el("span", { text: lv.rec ? `You unlocked ${lv.prize.name} here.` : `Clear it to unlock ${lv.prize.name}.` })));
        if (lv.rec) body.append(el("p", { class: "ws-p-best" }, icon("check"), el("span", { text: `Best: ${Demo.fmt(lv.rec.seconds)}` })));
        const go = el("div", { class: "ws-p-go" });
        const play = el("button", { type: "button", class: "ws-play", disabled: !lv.open,
            onclick: () => Demo.said(`In the game this starts ${lv.boss ? "the fight with " + lv.bossInfo.name : w.name + " " + sel}.`) },
            icon(lv.open ? "play" : "lock"), el("span", { text: !lv.open ? "Locked" : lv.boss ? "Fight" : lv.rec ? "Play Again" : "Play" }));
        go.append(play);
        if (!lv.open) go.append(el("p", { class: "ws-p-why", text: sel > 1 ? `Clear level ${sel - 1} first.` : "Open this world first." }));
        panel.append(go);
        panel.classList.toggle("is-boss", lv.boss);
    }

    // ---- the strip of worlds ----
    function drawStrip() {
        const strip = $("ws-strip");
        strip.replaceChildren();
        map.forEach((s, i) => {
            const w = Worlds.byId[s.world], open = Demo.worldOpen(i), hidden = s.secret && !open;
            const tile = el("button", { type: "button", class: `ws-tile${i === si ? " on" : ""}${open ? "" : " shut"}`, "aria-current": i === si ? "true" : "false",
                "aria-label": hidden ? "Secret world, hidden" : `${w.name}: ${Demo.done(i)} of 5 cleared${open ? "" : ", locked"}`,
                onclick: () => go(i) });
            const thumb = el("canvas", { class: "ws-thumb", "aria-hidden": "true" });
            tile.append(thumb);
            tile.append(el("span", { class: "ws-tile-name", text: hidden ? "?" : w.name }));
            const pips = el("span", { class: "ws-pips", "aria-hidden": "true" });
            for (let l = 1; l <= 5; l++) pips.append(el("i", { class: Demo.rec(i, l) ? "on" : "" }));
            tile.append(pips);
            if (!open) tile.append(icon("lock", "ws-tile-lock"));
            strip.append(tile);
            if (!hidden) requestAnimationFrame(() => { try { Worlds.preview(thumb, s.world, Demo.modeFor(w)); } catch (err) { /* no preview */ } });
        });
        const on = strip.children[si];
        if (on) on.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    }

    // ---- switching worlds and levels ----
    function select(l) {
        sel = l;
        document.querySelectorAll(".ws-stop").forEach((b, i) => { b.classList.toggle("sel", i + 1 === l); b.setAttribute("aria-pressed", i + 1 === l ? "true" : "false"); });
        drawPanel();
    }
    let switching = false;
    function go(i) {
        if (i === si || switching || !map[i] || (map[i].secret && !Demo.worldOpen(i))) return;
        switching = true;
        const dir = i > si ? 1 : -1;
        document.body.classList.add("leaving");
        document.body.style.setProperty("--dir", dir);
        setTimeout(() => {
            si = i;
            const nxt = Demo.next();
            sel = nxt.si === si ? nxt.l : Demo.worldOpen(si) ? (Demo.done(si) >= 5 ? 5 : 1) : 1;
            Worlds.use(map[si].world);
            drawBar(); drawStage(true); drawPanel(); drawStrip();
            document.body.classList.remove("leaving");
            switching = false;
        }, 260);
    }
    $("ws-prev").addEventListener("click", () => go(si - 1));
    $("ws-next").addEventListener("click", () => go(si + 1));
    addEventListener("keydown", e => {
        if (e.target.closest("input, textarea, select") || !$("ws-pack").hidden) return;
        if (e.key === "ArrowLeft") go(si - 1);
        else if (e.key === "ArrowRight") go(si + 1);
        else if (/^[1-5]$/.test(e.key)) select(Number(e.key));
    });
    // a swipe across the stage on a touch screen changes world
    let touchX = null;
    $("ws-stage").addEventListener("touchstart", e => { touchX = e.touches[0].clientX; }, { passive: true });
    $("ws-stage").addEventListener("touchend", e => {
        if (touchX == null) return;
        const dx = e.changedTouches[0].clientX - touchX;
        touchX = null;
        if (Math.abs(dx) > 60) go(si + (dx < 0 ? 1 : -1));
    });
    // on a phone the panel is a sheet: its handle opens and closes it
    $("ws-panel").addEventListener("click", e => {
        if (phone.matches && (e.target === $("ws-panel") || e.target.closest(".ws-p-title, .ws-p-head"))) $("ws-panel").classList.toggle("up");
    });
    phone.addEventListener("change", () => { drawStage(false); drawPanel(); });

    // ---- the Pack: shop, skills, hero, book and help in one place ----
    const TABS = [["shop", "Shop", "bag"], ["skills", "Skills", "bolt"], ["hero", "Hero", "hero"], ["book", "Book", "book"], ["help", "How to Play", "help"]];
    const ITEMS = [["Letter Reveal", "Shows the right letter in one square.", 15], ["Word Reveal", "Fills in the selected word.", 45], ["Clear Wrong", "Wipes every wrong letter.", 12],
        ["Lock Right", "Locks every right letter in place.", 20], ["Time Stop", "Stops your clock for 30 seconds.", 35], ["Level Clear", "Clears a normal level, with 1 star.", 150]];
    let tab = "shop";
    function drawPack() {
        $("ws-tabs").replaceChildren(...TABS.map(([id, name, ic]) => el("button", { type: "button", role: "tab", class: "ws-tab", "aria-selected": tab === id ? "true" : "false",
            onclick: () => { tab = id; drawPack(); } }, icon(ic), el("span", { text: name }))));
        const body = $("ws-pack-body");
        body.replaceChildren();
        if (tab === "shop") body.append(el("ul", { class: "ws-shop" }, ...ITEMS.map(([n, d, p]) => el("li", {}, el("div", {}, el("b", { text: n }), el("p", { text: d })),
            el("button", { type: "button", class: "ws-buy", onclick: () => Demo.said(`In the game this buys ${n}.`) }, U.icon("coin"), el("span", { text: String(p) }))))));
        if (tab === "skills") {
            const owned = Powers.ABILITIES.filter(a => { const i = map.findIndex(s => s.world === a.world); return i >= 0 && Demo.rec(i, 1); });
            body.append(el("p", { class: "ws-pack-note", text: `${owned.length} unlocked. Take any three into a boss fight.` }),
                el("ul", { class: "ws-skills" }, ...owned.map(a => el("li", { style: { "--c": a.fx && a.fx.color } }, el("b", { text: a.name }), el("p", { text: a.desc })))));
        }
        if (tab === "hero") body.append(el("div", { class: "ws-hero-card" }, el("div", { class: "ws-hero-big", html: Hero.svg(look) }),
            el("div", {}, el("h3", { text: look.name || "Your Hero" }), el("p", { text: "Every boss you beat gives your hero a hat, an outfit and something to hold." }),
                el("button", { type: "button", class: "ws-play small", onclick: () => Demo.said("In the game this opens the hero maker.") }, el("span", { text: "Change Your Hero" })))));
        if (tab === "book") {
            const tt = Demo.totals();
            body.append(el("p", { class: "ws-pack-note", text: `${tt.pages} of ${tt.worlds} pages of the Everbook won back.` }),
                el("ol", { class: "ws-pages" }, ...map.filter(s => !s.secret).map((s, i) => el("li", { class: Demo.rec(i, 5) ? "got" : "" },
                    el("span", { text: Worlds.byId[s.world].name }), Demo.rec(i, 5) ? icon("check") : el("small", { text: Bosses.info(s.world).name })))));
        }
        if (tab === "help") body.append(el("p", { class: "ws-pack-note", text: "Pick a stop on the road to see what it asks of you, then Play. Arrows, a swipe or the strip below change world." }));
    }
    let lastFocus = null;
    $("ws-pack-open").addEventListener("click", () => { lastFocus = document.activeElement; $("ws-pack").hidden = false; drawPack(); $("ws-pack-close").focus(); });
    const closePack = () => { $("ws-pack").hidden = true; if (lastFocus) lastFocus.focus(); };
    $("ws-pack-close").append(icon("close"));
    $("ws-pack-close").addEventListener("click", closePack);
    $("ws-pack").addEventListener("click", e => { if (e.target === $("ws-pack")) closePack(); });
    addEventListener("keydown", e => { if (e.key === "Escape" && !$("ws-pack").hidden) closePack(); });

    // ---- first draw ----
    Worlds.use(map[si].world);
    drawBar(); drawStage(true); drawPanel(); drawStrip();
})();
