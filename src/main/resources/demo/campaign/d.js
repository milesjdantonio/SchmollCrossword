// Option D, Stage and Everbook (A + B): A's World Stage is the screen (one world at a time, its whole road on its own
// scene, the worlds along the bottom); the panel beside the road is that world's page of the Everbook (B), and the
// Everbook itself opens from the bar, with the contents of the whole journey and its bookmarks: shop, skills, hero
// and help.

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
    const map = Demo.map, main = map.filter(s => !s.secret);
    const start = Demo.next();
    let si = start.si, sel = start.l;
    const look = Hero.fix({ name: "Tess" });
    const t = Demo.totals();
    const worldName = i => Worlds.byId[map[i].world].name;

    const SPOTS = { wide: [[10, 70], [28, 38], [47, 66], [66, 34], [86, 58]], tall: [[26, 87], [72, 71], [28, 54], [72, 37], [50, 15]] };
    const spots = () => SPOTS[phone.matches ? "tall" : "wide"];
    function road(pts) {
        let d = `M ${pts[0][0]} ${pts[0][1]}`;
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
            d += ` C ${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6}, ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6}, ${p2[0]} ${p2[1]}`;
        }
        return d;
    }

    // ---- the bar ----
    $("ws-back").append(icon("back"));
    $("ws-back").addEventListener("click", () => Demo.said("In the game this goes back to Home."));
    $("ws-stars").append(icon("star"), el("b", { text: String(t.stars) }), el("span", { text: ` / ${t.max}` }));
    $("ws-coins").append(U.icon("coin"), el("b", { text: String(Demo.sample.coins) }));
    $("dk-book-open").prepend(icon("book"));
    function drawBar() {
        const s = map[si], w = Worlds.byId[s.world];
        $("ws-world").textContent = w.name;
        $("ws-where").textContent = s.secret ? "Secret World" : `World ${si + 1} of ${main.length} · ${Bosses.info(s.world).name}'s World`;
    }

    // ---- the stage (A) ----
    function drawStage(animate) {
        const s = map[si], pts = spots(), open = Demo.worldOpen(si), stops = $("ws-stops");
        stops.replaceChildren();
        const full = road(pts);
        $("ws-road-bed").setAttribute("d", full);
        $("ws-road-ahead").setAttribute("d", full);
        const reached = [1, 2, 3, 4, 5].filter(l => Demo.levelOpen(si, l)).length;
        $("ws-road-done").setAttribute("d", reached > 1 ? road(pts.slice(0, reached)) : "");
        $("ws-stage").classList.toggle("is-locked", !open);
        const nxt = Demo.next();
        for (const l of [1, 2, 3, 4, 5]) {
            const lv = Demo.level(si, l), [x, y] = pts[l - 1], isNext = nxt.si === si && nxt.l === l;
            const state = lv.rec ? "done" : lv.open ? "open" : "locked";
            const stop = el("button", { type: "button", class: `ws-stop ${state}${lv.boss ? " boss" : ""}${isNext ? " next" : ""}${l === sel ? " sel" : ""}`,
                style: { "--x": x + "%", "--y": y + "%", "--i": l }, "aria-pressed": l === sel ? "true" : "false",
                "aria-label": `${lv.boss ? "Boss: " + lv.bossInfo.name : "Level " + l + ": " + (lv.lesson ? lv.lesson.name : lv.label)}, ${lv.rec ? lv.rec.stars + " of 3 stars" : lv.open ? "not played yet" : "locked"}`,
                onclick: () => select(l) });
            const disc = el("span", { class: "ws-disc" }, lv.boss ? el("span", { class: "ws-boss-art", html: Bosses.svg(s.world) }) : el("b", { text: String(l) }));
            if (state === "locked") disc.append(icon("lock", "ws-lock"));
            const tag = el("span", { class: "ws-tag" }, el("b", { text: lv.boss ? lv.bossInfo.name : (lv.lesson ? lv.lesson.name : lv.label) }));
            tag.append(lv.rec ? Demo.stars(lv.rec.stars) : el("small", { text: isNext ? "Next" : lv.boss ? "Boss" : lv.label }));
            stop.append(disc, tag);
            stops.append(stop);
            if (isNext && open) stops.append(el("div", { class: "ws-hero", style: { "--x": x + "%", "--y": y + "%" }, html: Hero.svg(look), "aria-hidden": "true" }));
        }
        const locked = $("ws-locked");
        locked.hidden = open;
        if (!open) locked.replaceChildren(icon("lock", "ws-locked-icon"), el("p", { text: `Beat ${Bosses.info(map[si - 1].world).name} in ${worldName(si - 1)} to open ${Worlds.byId[s.world].name}.` }));
        for (const [id, k] of [["ws-prev", -1], ["ws-next", 1]]) {
            const b = $(id), n = si + k, there = map[n];
            b.hidden = !there || (there.secret && !Demo.worldOpen(n));
            if (b.hidden) continue;
            b.replaceChildren(icon(k < 0 ? "prev" : "next"), el("span", { text: worldName(n) }));
            b.setAttribute("aria-label", `${k < 0 ? "Previous" : "Next"} world: ${worldName(n)}`);
        }
        if (animate) { $("ws-stage").classList.remove("deal"); void $("ws-stage").offsetWidth; $("ws-stage").classList.add("deal"); }
    }

    // ---- the panel: this world's page of the Everbook (B) ----
    function drawPanel() {
        const lv = Demo.level(si, sel), s = map[si], w = Worlds.byId[s.world], panel = $("ws-panel"), won = !!Demo.rec(si, 5);
        panel.replaceChildren();
        const body = el("div", { class: "ws-p-body" });
        body.append(el("div", { class: "dk-folio" },
            el("span", { class: "eb-ch-n", text: s.secret ? "?" : String(si + 1) }),
            won ? el("span", { class: "dk-seal" }, icon("check"), el("span", { text: "Page Won Back" })) : el("span", { class: "dk-held", text: `Held by ${Bosses.info(s.world).name}` })));
        body.append(el("h2", { class: "dk-title", text: lv.boss ? lv.bossInfo.name : `${w.name} ${sel}` }));
        if (lv.boss) {
            body.append(el("div", { class: "eb-plate dk-boss-plate" }, el("div", { class: "dk-boss-art", html: Bosses.svg(s.world) })));
            body.append(el("p", { class: "eb-prose", text: `“${lv.bossInfo.taunt}”` }));
            const mins = Math.max(2, Math.round((lv.par * lv.phases * 0.8) / 60));
            body.append(el("p", { class: "dk-facts", text: `${lv.phases} Phase${lv.phases > 1 ? "s" : ""} · About ${mins} Minutes · Threat ${Powers.threat(si, 15).stars} of 5` }));
            body.append(el("p", { class: "eb-moves" }, el("b", { text: "Its moves: " }), lv.moves.map(m => m.name).join(", ") + "."));
            const kit = Powers.ABILITIES.filter(a => a.world === s.world);
            body.append(el("p", { class: "eb-moves" }, el("b", { text: "Your abilities: " }), kit.map(a => a.name).join(", ") + "."));
        } else {
            body.append(el("p", { class: "dk-facts", text: `${lv.label} · Par ${Demo.fmt(lv.par)}` }));
            if (lv.lesson) body.append(el("h3", { class: "dk-lesson", text: lv.lesson.name }), el("p", { class: "eb-prose", text: lv.lesson.practise }),
                el("p", { class: "eb-tip" }, icon("spark"), el("span", { text: lv.lesson.tip })));
        }
        const got = lv.rec ? lv.rec.stars : 0;
        body.append(el("ul", { class: "eb-goals" }, ...[lv.boss ? "Beat the boss" : "Solve it", "No items", Demo.cap(lv.goal)].map((g, i) => el("li", { class: i < got ? "got" : "" }, icon("star"), el("span", { text: g })))));
        if (lv.prize) body.append(el("p", { class: "eb-small" }, icon("bolt"), el("span", { text: lv.rec ? ` You unlocked ${lv.prize.name} here.` : ` Clear it to unlock ${lv.prize.name}.` })));
        if (lv.rec) body.append(el("p", { class: "eb-small" }, icon("check"), el("span", { text: ` Best: ${Demo.fmt(lv.rec.seconds)}` })));
        // the companion's note in the margin
        if (w.mascot && !lv.boss) {
            const line = typeof Companions !== "undefined" && Companions.level(s.world, sel);
            if (line) body.append(el("figure", { class: "eb-who dk-note" }, Demo.companion(s.world, 52), el("figcaption", {}, el("b", { text: w.mascot.name }), el("q", { text: line }))));
        }
        panel.append(body);
        const go = el("div", { class: "ws-p-go" });
        go.append(el("button", { type: "button", class: "ws-play", disabled: !lv.open,
            onclick: () => Demo.said(`In the game this starts ${lv.boss ? "the fight with " + lv.bossInfo.name : w.name + " " + sel}.`) },
            icon(lv.open ? "play" : "lock"), el("span", { text: !lv.open ? (sel > 1 ? `Clear Level ${sel - 1} First` : "Locked") : lv.boss ? "Fight" : lv.rec ? "Play Again" : "Play" })));
        panel.append(go);
        panel.classList.toggle("is-boss", lv.boss);
    }

    // ---- the strip of worlds (A) ----
    function drawStrip() {
        const strip = $("ws-strip");
        strip.replaceChildren();
        map.forEach((s, i) => {
            const w = Worlds.byId[s.world], open = Demo.worldOpen(i), hidden = s.secret && !open;
            const tile = el("button", { type: "button", class: `ws-tile${i === si ? " on" : ""}${open ? "" : " shut"}`, "aria-current": i === si ? "true" : "false",
                "aria-label": hidden ? "Secret world, hidden" : `${w.name}: ${Demo.done(i)} of 5 cleared${open ? "" : ", locked"}`, onclick: () => go(i) });
            const thumb = el("canvas", { class: "ws-thumb", "aria-hidden": "true" });
            const pips = el("span", { class: "ws-pips", "aria-hidden": "true" });
            for (let l = 1; l <= 5; l++) pips.append(el("i", { class: Demo.rec(i, l) ? "on" : "" }));
            tile.append(thumb, el("span", { class: "ws-tile-name", text: hidden ? "?" : w.name }), pips);
            if (!open) tile.append(icon("lock", "ws-tile-lock"));
            strip.append(tile);
            if (!hidden) requestAnimationFrame(() => { try { Worlds.preview(thumb, s.world, Demo.modeFor(w)); } catch (err) { /* no preview */ } });
        });
        const on = strip.children[si];
        if (on) on.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    }

    function select(l) {
        sel = l;
        document.querySelectorAll(".ws-stop").forEach((b, i) => { b.classList.toggle("sel", i + 1 === l); b.setAttribute("aria-pressed", i + 1 === l ? "true" : "false"); });
        drawPanel();
    }
    let switching = false;
    function go(i, level) {
        if (switching || !map[i] || (map[i].secret && !Demo.worldOpen(i))) return;
        if (i === si) { if (level) select(level); return; }
        switching = true;
        document.body.classList.add("leaving");
        document.body.style.setProperty("--dir", i > si ? 1 : -1);
        setTimeout(() => {
            si = i;
            const nxt = Demo.next();
            sel = level || (nxt.si === si ? nxt.l : Demo.worldOpen(si) ? (Demo.done(si) >= 5 ? 5 : 1) : 1);
            Worlds.use(map[si].world);
            drawBar(); drawStage(true); drawPanel(); drawStrip();
            document.body.classList.remove("leaving");
            switching = false;
        }, 260);
    }
    $("ws-prev").addEventListener("click", () => go(si - 1));
    $("ws-next").addEventListener("click", () => go(si + 1));
    addEventListener("keydown", e => {
        if (e.target.closest("input, textarea, select") || !$("dk-book").hidden) return;
        if (e.key === "ArrowLeft") go(si - 1);
        else if (e.key === "ArrowRight") go(si + 1);
        else if (/^[1-5]$/.test(e.key)) select(Number(e.key));
    });
    let touchX = null;
    $("ws-stage").addEventListener("touchstart", e => { touchX = e.touches[0].clientX; }, { passive: true });
    $("ws-stage").addEventListener("touchend", e => {
        if (touchX == null) return;
        const dx = e.changedTouches[0].clientX - touchX;
        touchX = null;
        if (Math.abs(dx) > 60) go(si + (dx < 0 ? 1 : -1));
    });
    $("ws-panel").addEventListener("click", e => {
        if (phone.matches && (e.target === $("ws-panel") || e.target.closest(".dk-title, .dk-folio"))) $("ws-panel").classList.toggle("up");
    });
    phone.addEventListener("change", () => { drawStage(false); drawPanel(); });

    // ---- the Everbook (B): contents, shop, skills, hero, help ----
    const TABS = [["contents", "Contents", "list"], ["shop", "Shop", "bag"], ["skills", "Skills", "bolt"], ["hero", "Hero", "hero"], ["help", "Help", "help"]];
    let view = "contents";
    const pips = i => { const box = el("span", { class: "eb-pips", "aria-hidden": "true" }); for (let l = 1; l <= 5; l++) box.append(el("i", { class: Demo.rec(i, l) ? "on" : "" })); return box; };
    const closeBookThen = fn => { closeBook(); setTimeout(fn, 120); };
    const VIEWS = {
        contents() {
            const nx = Demo.next(), bar = el("span", { class: "eb-pagesbar", "aria-hidden": "true" });
            main.forEach(s => bar.append(el("i", { class: Demo.rec(map.indexOf(s), 5) ? "on" : "" })));
            $("eb-left").append(el("h1", { class: "eb-book-title", text: "The Everbook" }),
                el("p", { class: "eb-prose", text: "Every word there is, in one book. The Void tore it into fifteen pages and gave one to each boss. Win them back." }),
                el("div", { class: "eb-owner" }, el("div", { class: "eb-owner-hero", html: Hero.svg(look) }), el("div", {}, el("b", { text: look.name }), el("p", { text: `${t.pages} of ${t.worlds} pages won back` }), bar)),
                el("button", { type: "button", class: "eb-ribbon", onclick: () => closeBookThen(() => go(nx.si, nx.l)) }, icon("ribbon"),
                    el("span", {}, el("small", { text: "Continue" }), el("b", { text: `${worldName(nx.si)} ${nx.l === 5 ? "Boss" : nx.l}` }))));
            const list = el("ol", { class: "eb-toc" });
            map.forEach((s, i) => {
                const open = Demo.worldOpen(i), hidden = s.secret && !open, w = Worlds.byId[s.world];
                list.append(el("li", { "data-world": hidden ? null : s.world, "data-theme": hidden ? null : Demo.modeFor(w), class: (open ? "" : "shut") + (i === si ? " here" : "") },
                    el("button", { type: "button", disabled: !open, onclick: () => closeBookThen(() => go(i)), "aria-label": hidden ? "A missing page" : `${w.name}, ${Demo.done(i)} of 5 cleared${open ? "" : ", locked"}` },
                        el("span", { class: "eb-toc-n", text: hidden ? "?" : String(i + 1) }), el("span", { class: "eb-toc-name", text: hidden ? "A missing page" : w.name }),
                        el("span", { class: "eb-toc-dots", "aria-hidden": "true" }), hidden ? el("span") : open ? pips(i) : icon("lock", "eb-toc-lock"))));
            });
            $("eb-right").append(el("h2", { class: "eb-h", text: "Contents" }), list);
        },
        shop() {
            const ITEMS = [["Letter Reveal", "Shows the right letter in one square.", 15], ["Word Reveal", "Fills in the selected word.", 45], ["Clear Wrong", "Wipes every wrong letter.", 12],
                ["Lock Right", "Locks every right letter in place.", 20], ["Time Stop", "Stops your clock for 30 seconds.", 35], ["Level Clear", "Clears a normal level, with 1 star.", 150]];
            $("eb-left").append(el("h1", { class: "eb-book-title small", text: "The Shop" }), el("p", { class: "eb-prose", text: "Coins come from stars and first clears. Items work in any level; a boss fight takes abilities instead." }),
                el("p", { class: "eb-purse" }, U.icon("coin"), el("b", { text: String(Demo.sample.coins) }), el("span", { text: " coins" })));
            $("eb-right").append(el("h2", { class: "eb-h", text: "Items" }), el("ul", { class: "eb-shop" }, ...ITEMS.map(([n, d, p]) => el("li", {}, el("div", {}, el("b", { text: n }), el("p", { text: d })),
                el("button", { type: "button", class: "eb-buy", onclick: () => Demo.said(`In the game this buys ${n}.`) }, U.icon("coin"), el("span", { text: String(p) }))))));
        },
        skills() {
            const owned = Powers.ABILITIES.filter(a => { const i = map.findIndex(s => s.world === a.world); return i >= 0 && Demo.rec(i, 1); });
            $("eb-left").append(el("h1", { class: "eb-book-title small", text: "Skills" }), el("p", { class: "eb-prose", text: "Each world teaches three. Take any three you've learned into a boss fight." }),
                el("ol", { class: "eb-kit" }, ...owned.slice(0, 3).map((a, i) => el("li", { style: { "--c": a.fx && a.fx.color } }, el("small", { text: `Key ${i + 1}` }), el("b", { text: a.name })))));
            $("eb-right").append(el("h2", { class: "eb-h", text: `Learned (${owned.length})` }), el("ul", { class: "eb-skills" }, ...owned.map(a => el("li", { style: { "--c": a.fx && a.fx.color } }, el("b", { text: a.name }), el("p", { text: a.desc })))));
        },
        hero() {
            $("eb-left").append(el("div", { class: "eb-hero-big", html: Hero.svg(look) }), el("h1", { class: "eb-book-title small", text: look.name }),
                el("button", { type: "button", class: "eb-play quiet", onclick: () => Demo.said("In the game this opens the hero maker.") }, el("span", { text: "Change Your Hero" })));
            const beaten = main.filter(s => Demo.rec(map.indexOf(s), 5));
            $("eb-right").append(el("h2", { class: "eb-h", text: "Gifts" }), el("p", { class: "eb-prose", text: "Every boss you beat gives your hero a hat, an outfit and something to hold." }),
                el("ul", { class: "eb-gifts" }, ...beaten.map(s => el("li", {}, el("b", { text: Bosses.info(s.world).name }), el("span", { text: "3 new parts" })))));
        },
        help() {
            $("eb-left").append(el("h1", { class: "eb-book-title small", text: "How to Play" }), el("p", { class: "eb-prose", text: "Each level practises one crossword skill and earns up to three stars. The fifth is the world's boss: a race to finish your puzzle before it finishes its own." }));
            $("eb-right").append(el("h2", { class: "eb-h", text: "Chapters" }), el("ol", { class: "eb-shop plain" }, ...["Levels and Stars", "Lessons", "Items", "Boss Races", "Abilities", "Attacks and Counters"].map(n => el("li", {}, el("b", { text: n })))));
        }
    };
    function drawBook() {
        $("eb-left").replaceChildren(); $("eb-right").replaceChildren();
        VIEWS[view]();
        $("eb-tabs").replaceChildren(...TABS.map(([id, name, ic]) => el("button", { type: "button", class: "eb-tab" + (view === id ? " on" : ""), "aria-current": view === id ? "page" : "false",
            onclick: () => turn(id) }, icon(ic), el("span", { text: name }))));
    }
    function turn(to) {
        const book = $("eb-book");
        view = to;
        book.classList.add("turning");
        setTimeout(() => { drawBook(); book.classList.remove("turning"); book.classList.add("turned"); setTimeout(() => book.classList.remove("turned"), 380); }, 240);
    }
    let lastFocus = null;
    function openBook(to = "contents") {
        lastFocus = document.activeElement;
        view = to;
        drawBook();
        $("dk-book").hidden = false;
        requestAnimationFrame(() => $("dk-book").classList.add("in"));
        $("dk-book-close").focus();
    }
    function closeBook() {
        $("dk-book").classList.remove("in");
        $("dk-book").hidden = true;
        if (lastFocus) lastFocus.focus();
    }
    $("dk-book-open").addEventListener("click", () => openBook());
    $("dk-book-close").append(icon("close"));
    $("dk-book-close").addEventListener("click", closeBook);
    $("dk-book").addEventListener("click", e => { if (e.target === $("dk-book")) closeBook(); });
    addEventListener("keydown", e => { if (e.key === "Escape" && !$("dk-book").hidden) closeBook(); });

    Worlds.use(map[si].world);
    drawBar(); drawStage(true); drawPanel(); drawStrip();
})();
