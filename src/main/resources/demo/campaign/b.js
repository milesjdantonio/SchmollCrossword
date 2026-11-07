// Option B, The Everbook: the campaign is the book from the story. It opens on its contents (every world a
// chapter, the page each boss holds), each world is a two-page spread (its scene, companion and boss on the left,
// its five levels on the right), and the shop, skills, hero and help are bookmark tabs on the book's edge.

(async () => {
    const { el, icon } = Demo;
    const $ = id => document.getElementById(id);
    try {
        await Demo.load();
    } catch (err) {
        document.body.append(el("p", { class: "eb-fail", text: "The level data couldn't be loaded. Is the local server running?" }));
        return;
    }
    const map = Demo.map, main = map.filter(s => !s.secret);
    const look = Hero.fix({ name: "Tess" });
    const start = Demo.next();
    let view = "contents", si = start.si, sel = start.l;
    const worldName = i => Worlds.byId[map[i].world].name;

    // ---- the bar: back, stars and coins only (everything else is in the book) ----
    $("eb-back").append(icon("back"));
    $("eb-back").addEventListener("click", () => Demo.said("In the game this goes back to Home."));
    const t = Demo.totals();
    $("eb-stars").append(icon("star"), el("b", { text: String(t.stars) }), el("span", { text: ` / ${t.max}` }));
    $("eb-coins").append(U.icon("coin"), el("b", { text: String(Demo.sample.coins) }));

    // ---- bookmark tabs ----
    const TABS = [["contents", "Contents", "list"], ["shop", "Shop", "bag"], ["skills", "Skills", "bolt"], ["hero", "Hero", "hero"], ["help", "Help", "help"]];
    function drawTabs() {
        $("eb-tabs").replaceChildren(...TABS.map(([id, name, ic]) => el("button", { type: "button", class: "eb-tab" + (view === id ? " on" : ""), "aria-current": view === id ? "page" : "false",
            onclick: () => turn(id) }, icon(ic), el("span", { text: name }))));
    }

    // ---- the pages ----
    function pips(i) {
        const box = el("span", { class: "eb-pips", "aria-hidden": "true" });
        for (let l = 1; l <= 5; l++) box.append(el("i", { class: Demo.rec(i, l) ? "on" : "" }));
        return box;
    }
    function contents() {
        const left = $("eb-left"), right = $("eb-right"), nx = Demo.next();
        left.append(
            el("h1", { class: "eb-book-title", text: "The Everbook" }),
            el("p", { class: "eb-prose", text: "Every word there is, in one book. The Void tore it into fifteen pages and gave one to each boss. Win them back." }),
            el("div", { class: "eb-owner" }, el("div", { class: "eb-owner-hero", html: Hero.svg(look) }),
                el("div", {}, el("b", { text: look.name }), el("p", { text: `${t.pages} of ${t.worlds} pages won back` }), pagesBar())),
            el("button", { type: "button", class: "eb-ribbon", onclick: () => { si = nx.si; sel = nx.l; turn("chapter"); } },
                icon("ribbon"), el("span", {}, el("small", { text: "Continue" }), el("b", { text: `${worldName(nx.si)} ${nx.l === 5 ? "Boss" : nx.l}` }))));
        right.append(el("h2", { class: "eb-h", text: "Contents" }));
        const list = el("ol", { class: "eb-toc" });
        map.forEach((s, i) => {
            const open = Demo.worldOpen(i), hidden = s.secret && !open, w = Worlds.byId[s.world];
            const line = el("li", { "data-world": hidden ? null : s.world, "data-theme": hidden ? null : Demo.modeFor(w), class: (open ? "" : "shut") + (i === nx.si ? " here" : "") });
            const b = el("button", { type: "button", disabled: !open, onclick: () => { si = i; sel = i === nx.si ? nx.l : 1; turn("chapter"); },
                "aria-label": hidden ? "A missing page" : `${w.name}, ${Demo.done(i)} of 5 cleared${open ? "" : ", locked"}` },
                el("span", { class: "eb-toc-n", text: hidden ? "?" : String(i + 1) }),
                el("span", { class: "eb-toc-name", text: hidden ? "A missing page" : w.name }),
                el("span", { class: "eb-toc-dots", "aria-hidden": "true" }),
                hidden ? el("span") : (open ? pips(i) : icon("lock", "eb-toc-lock")));
            line.append(b);
            list.append(line);
        });
        right.append(list);
    }
    function pagesBar() {
        const bar = el("span", { class: "eb-pagesbar", "aria-hidden": "true" });
        main.forEach(s => bar.append(el("i", { class: Demo.rec(map.indexOf(s), 5) ? "on" : "" })));
        return bar;
    }

    function chapter() {
        const s = map[si], w = Worlds.byId[s.world], left = $("eb-left"), right = $("eb-right"), boss = Bosses.info(s.world);
        const won = !!Demo.rec(si, 5), open = Demo.worldOpen(si);
        left.append(el("div", { class: "eb-ch-head" }, el("span", { class: "eb-ch-n", text: s.secret ? "?" : String(si + 1) }), el("h1", { class: "eb-ch-title", text: w.name })));
        const plate = el("div", { class: "eb-plate" + (open ? "" : " shut") }, el("canvas", { class: "eb-plate-scene", "aria-hidden": "true" }));
        if (!open) plate.append(el("p", { class: "eb-plate-lock" }, icon("lock"), el("span", { text: `Beat ${Bosses.info(map[si - 1].world).name} to open this chapter.` })));
        left.append(plate);
        const people = el("div", { class: "eb-people" });
        if (w.mascot) {
            const line = (typeof Companions !== "undefined" && Companions.level(s.world, Math.min(sel, 4))) || "";
            people.append(el("figure", { class: "eb-who" }, Demo.companion(s.world, 64), el("figcaption", {}, el("b", { text: w.mascot.name }), el("q", { text: line }))));
        }
        people.append(el("figure", { class: "eb-who boss" + (won ? " won" : "") }, el("div", { class: "eb-boss-mini", html: Bosses.svg(s.world) }),
            el("figcaption", {}, el("b", { text: boss.name }), el("span", { text: won ? "Page won back" : "Holds this page" }))));
        left.append(people);
        requestAnimationFrame(() => Demo.scene(plate.querySelector("canvas"), s.world, Demo.modeFor(w)));

        right.append(el("h2", { class: "eb-h", text: "Levels" }));
        const list = el("ol", { class: "eb-levels" });
        for (const l of [1, 2, 3, 4, 5]) {
            const lv = Demo.level(si, l), isNext = Demo.next().si === si && Demo.next().l === l;
            const item = el("li", { class: `eb-lv${lv.boss ? " boss" : ""}${l === sel ? " sel" : ""}${lv.open ? "" : " shut"}${lv.rec ? " done" : ""}` });
            const row = el("button", { type: "button", class: "eb-lv-row", "aria-expanded": l === sel ? "true" : "false", onclick: () => { sel = sel === l ? 0 : l; redraw(); } },
                el("span", { class: "eb-lv-n" }, lv.boss ? icon("crown") : el("b", { text: String(l) })),
                el("span", { class: "eb-lv-name" }, el("b", { text: lv.boss ? lv.bossInfo.name : (lv.lesson ? lv.lesson.name : lv.label) }),
                    el("small", { text: lv.boss ? `Boss · ${lv.phases} Phase${lv.phases > 1 ? "s" : ""} · Threat ${Powers.threat(si, 15).stars} of 5` : `${lv.label} · Par ${Demo.fmt(lv.par)}` })),
                lv.rec ? Demo.stars(lv.rec.stars) : isNext ? el("span", { class: "eb-next", text: "Next" }) : !lv.open ? icon("lock", "eb-lv-lock") : el("span"));
            item.append(row);
            if (l === sel) item.append(detail(lv));
            list.append(item);
        }
        right.append(list);
    }
    function detail(lv) {
        const box = el("div", { class: "eb-lv-detail" });
        if (lv.boss) {
            box.append(el("p", { class: "eb-prose", text: `“${lv.bossInfo.taunt}”` }));
            box.append(el("p", { class: "eb-moves" }, el("b", { text: "Its moves: " }), lv.moves.map(m => m.name).join(", ") + "."));
        } else if (lv.lesson) {
            box.append(el("p", { class: "eb-prose", text: lv.lesson.practise }), el("p", { class: "eb-tip" }, icon("spark"), el("span", { text: lv.lesson.tip })));
        }
        const goals = [lv.boss ? "Beat the boss" : "Solve it", "No items", Demo.cap(lv.goal)], got = lv.rec ? lv.rec.stars : 0;
        box.append(el("ul", { class: "eb-goals" }, ...goals.map((g, i) => el("li", { class: i < got ? "got" : "" }, icon("star"), el("span", { text: g })))));
        if (lv.prize) box.append(el("p", { class: "eb-small" }, icon("bolt"), el("span", { text: lv.rec ? ` You unlocked ${lv.prize.name} here.` : ` Clear it to unlock ${lv.prize.name}.` })));
        box.append(el("button", { type: "button", class: "eb-play", disabled: !lv.open,
            onclick: () => Demo.said(`In the game this starts ${lv.boss ? "the fight with " + lv.bossInfo.name : lv.worldName + " " + lv.l}.`) },
            icon(lv.open ? "play" : "lock"), el("span", { text: !lv.open ? (lv.l > 1 ? `Clear Level ${lv.l - 1} First` : "Locked") : lv.boss ? "Fight" : lv.rec ? "Play Again" : "Play" })));
        return box;
    }

    const ITEMS = [["Letter Reveal", "Shows the right letter in one square.", 15], ["Word Reveal", "Fills in the selected word.", 45], ["Clear Wrong", "Wipes every wrong letter.", 12],
        ["Lock Right", "Locks every right letter in place.", 20], ["Time Stop", "Stops your clock for 30 seconds.", 35], ["Level Clear", "Clears a normal level, with 1 star.", 150]];
    function shop() {
        $("eb-left").append(el("h1", { class: "eb-book-title small", text: "The Shop" }), el("p", { class: "eb-prose", text: "Coins come from stars and first clears. Items work in any level; a boss fight takes abilities instead." }),
            el("p", { class: "eb-purse" }, U.icon("coin"), el("b", { text: String(Demo.sample.coins) }), el("span", { text: " coins" })));
        $("eb-right").append(el("h2", { class: "eb-h", text: "Items" }), el("ul", { class: "eb-shop" }, ...ITEMS.map(([n, d, p]) => el("li", {}, el("div", {}, el("b", { text: n }), el("p", { text: d })),
            el("button", { type: "button", class: "eb-buy", onclick: () => Demo.said(`In the game this buys ${n}.`) }, U.icon("coin"), el("span", { text: String(p) }))))));
    }
    function skills() {
        const owned = Powers.ABILITIES.filter(a => { const i = map.findIndex(s => s.world === a.world); return i >= 0 && Demo.rec(i, 1); });
        $("eb-left").append(el("h1", { class: "eb-book-title small", text: "Skills" }), el("p", { class: "eb-prose", text: "Each world teaches three. Take any three you've learned into a boss fight." }),
            el("ol", { class: "eb-kit" }, ...owned.slice(0, 3).map((a, i) => el("li", { style: { "--c": a.fx && a.fx.color } }, el("small", { text: `Key ${i + 1}` }), el("b", { text: a.name })))));
        $("eb-right").append(el("h2", { class: "eb-h", text: `Learned (${owned.length})` }), el("ul", { class: "eb-skills" }, ...owned.map(a => el("li", { style: { "--c": a.fx && a.fx.color } }, el("b", { text: a.name }), el("p", { text: a.desc })))));
    }
    function hero() {
        $("eb-left").append(el("div", { class: "eb-hero-big", html: Hero.svg(look) }), el("h1", { class: "eb-book-title small", text: look.name }),
            el("button", { type: "button", class: "eb-play quiet", onclick: () => Demo.said("In the game this opens the hero maker.") }, el("span", { text: "Change Your Hero" })));
        const beaten = main.filter(s => Demo.rec(map.indexOf(s), 5));
        $("eb-right").append(el("h2", { class: "eb-h", text: "Gifts" }), el("p", { class: "eb-prose", text: "Every boss you beat gives your hero a hat, an outfit and something to hold." }),
            el("ul", { class: "eb-gifts" }, ...beaten.map(s => el("li", {}, el("b", { text: Bosses.info(s.world).name }), el("span", { text: "3 new parts" })))));
    }
    function help() {
        $("eb-left").append(el("h1", { class: "eb-book-title small", text: "How to Play" }), el("p", { class: "eb-prose", text: "Each level practises one crossword skill and earns up to three stars. The fifth is the world's boss: a race to finish your puzzle before it finishes its own." }));
        $("eb-right").append(el("h2", { class: "eb-h", text: "Chapters" }), el("ol", { class: "eb-shop plain" }, ...["Levels and Stars", "Lessons", "Items", "Boss Races", "Abilities", "Attacks and Counters"].map(n => el("li", {}, el("b", { text: n })))));
    }

    // ---- turning pages ----
    let turning = false;
    function redraw() {
        $("eb-left").replaceChildren();
        $("eb-right").replaceChildren();
        if (view === "chapter") {
            Worlds.use(map[si].world);
            document.documentElement.dataset.world = map[si].world;
        }
        ({ contents, chapter, shop, skills, hero, help })[view]();
        drawTabs();
        drawTurns();
    }
    function turn(to, dir = 1) {
        if (turning) return;
        turning = true;
        view = to;
        const book = $("eb-book");
        book.style.setProperty("--dir", dir);
        book.classList.add("turning");
        setTimeout(() => {
            redraw();
            book.classList.remove("turning");
            book.classList.add("turned");
            setTimeout(() => { book.classList.remove("turned"); turning = false; }, 380);
        }, 260);
    }
    function drawTurns() {
        const prev = $("eb-prev"), next = $("eb-next");
        const set = (b, label, fn, hide) => { b.hidden = hide; b.replaceChildren(...label); b.onclick = fn; };
        if (view !== "chapter") {
            const nx = Demo.next();
            set(prev, [], null, true);
            set(next, [el("span", { text: `Open ${worldName(nx.si)}` }), icon("next")], () => { si = nx.si; sel = nx.l; turn("chapter"); }, false);
            return;
        }
        const p = si - 1, n = si + 1, nOk = map[n] && !(map[n].secret && !Demo.worldOpen(n));
        set(prev, [icon("prev"), el("span", { text: p >= 0 ? worldName(p) : "Contents" })], () => { if (p >= 0) { si = p; sel = 1; turn("chapter", -1); } else turn("contents", -1); }, false);
        set(next, [el("span", { text: nOk ? worldName(n) : "Contents" }), icon("next")], () => { if (nOk) { si = n; sel = 1; turn("chapter"); } else turn("contents"); }, false);
    }
    addEventListener("keydown", e => {
        if (e.key === "ArrowRight" && !$("eb-next").hidden) $("eb-next").click();
        if (e.key === "ArrowLeft" && !$("eb-prev").hidden) $("eb-prev").click();
    });

    // the book opens on its contents, in the world you're in
    Worlds.use(map[si].world);
    redraw();
})();
