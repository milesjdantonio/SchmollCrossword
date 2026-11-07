// Option C, Journey Line: today's scrolling map, made clear. Each world is exactly one screen tall, so its five
// levels and its boss are always seen together; a named list of worlds with their progress replaces the row of tiny
// icons; a level's details open beside it on the map instead of over it; Continue always takes you to the next level.

(async () => {
    const { el, icon } = Demo;
    const $ = id => document.getElementById(id);
    const phone = matchMedia("(max-width: 760px)");
    try {
        await Demo.load();
    } catch (err) {
        document.body.append(el("p", { class: "jl-fail", text: "The level data couldn't be loaded. Is the local server running?" }));
        return;
    }
    const map = Demo.map, mainCount = map.filter(s => !s.secret).length;
    const nx = Demo.next();
    let current = -1, pop = null;

    // the road through a world's stops, top to bottom (the same curve maths as the game's map)
    const SPOTS = { wide: [[30, 9], [64, 28], [32, 47], [66, 65], [48, 86]], tall: [[28, 8], [70, 27], [30, 46], [70, 64], [50, 86]] };
    function road(pts) {
        let d = `M ${pts[0][0]} ${pts[0][1]}`;
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
            d += ` C ${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6}, ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6}, ${p2[0]} ${p2[1]}`;
        }
        return d;
    }

    // ---- the bar ----
    $("jl-back").append(icon("back"));
    $("jl-back").addEventListener("click", () => Demo.said("In the game this goes back to Home."));
    const t = Demo.totals();
    $("jl-stars").append(icon("star"), el("b", { text: String(t.stars) }), el("span", { text: ` / ${t.max}` }));
    $("jl-coins").append(U.icon("coin"), el("b", { text: String(Demo.sample.coins) }));
    $("jl-more").append(icon("list"));
    const MENU = [["Shop", "bag"], ["Skills", "bolt"], ["Hero", "hero"], ["Book", "book"], ["How to Play", "help"]];
    $("jl-menu").append(...MENU.map(([n, ic]) => el("button", { type: "button", role: "menuitem", onclick: () => { closeMenus(); Demo.said(`In the game this opens ${n === "Book" ? "the Everbook" : n === "How to Play" ? "How to Play" : "the " + n.toLowerCase()}.`); } }, icon(ic), el("span", { text: n }))));
    $("jl-more").addEventListener("click", e => { e.stopPropagation(); const open = $("jl-menu").hidden; closeMenus(); $("jl-menu").hidden = !open; $("jl-more").setAttribute("aria-expanded", String(open)); });
    $("jl-where").addEventListener("click", e => { e.stopPropagation(); const open = !document.body.classList.contains("rail-open"); closeMenus(); document.body.classList.toggle("rail-open", open); $("jl-where").setAttribute("aria-expanded", String(open)); });
    function closeMenus() {
        $("jl-menu").hidden = true; $("jl-more").setAttribute("aria-expanded", "false");
        document.body.classList.remove("rail-open"); $("jl-where").setAttribute("aria-expanded", "false");
    }
    addEventListener("click", e => { if (!e.target.closest(".jl-menu, .jl-rail, .jl-pop, .jl-stop")) { closeMenus(); closePop(); } });
    addEventListener("keydown", e => { if (e.key === "Escape") { closeMenus(); closePop(); } });

    // ---- the rail: every world by name, with its progress ----
    const rail = $("jl-rail");
    map.forEach((s, i) => {
        const w = Worlds.byId[s.world], open = Demo.worldOpen(i), hidden = s.secret && !open;
        const pips = el("span", { class: "jl-pips", "aria-hidden": "true" });
        for (let l = 1; l <= 5; l++) pips.append(el("i", { class: Demo.rec(i, l) ? "on" : "" }));
        rail.append(el("button", { type: "button", class: "jl-rail-item" + (open ? "" : " shut"), "data-i": i, "data-world": hidden ? null : s.world, "data-theme": hidden ? null : Demo.modeFor(w),
            "aria-label": hidden ? "Secret world" : `${w.name}, ${Demo.done(i)} of 5 cleared${open ? "" : ", locked"}`,
            onclick: () => { closeMenus(); goTo(i); } },
            el("span", { class: "jl-rail-n", text: hidden ? "?" : String(i + 1) }), el("span", { class: "jl-rail-name", text: hidden ? "Secret" : w.name }), open ? pips : icon("lock", "jl-rail-lock")));
    });

    // ---- the map: one screen per world ----
    const sections = map.map((s, i) => {
        const w = Worlds.byId[s.world], open = Demo.worldOpen(i), boss = Bosses.info(s.world);
        const sec = el("section", { class: "jl-world" + (open ? "" : " shut"), id: "world-" + i, "data-i": i, "data-world": s.world, "data-theme": Demo.modeFor(w), "aria-label": w.name });
        const info = el("div", { class: "jl-info" },
            el("h2", { text: s.secret && !open ? "?" : w.name }),
            el("p", { class: "jl-info-sub", text: (s.secret ? "Secret World" : `World ${i + 1} of ${mainCount}`) + ` · Boss: ${boss.name}` }),
            el("p", { class: "jl-info-progress" }, el("b", { text: `${Demo.done(i)} of 5` }), " cleared · ", el("b", { text: `${Demo.starsIn(i)}` }), " of 15 stars"));
        if (w.mascot && open) {
            const line = typeof Companions !== "undefined" && Companions.level(s.world, 1);
            info.append(el("div", { class: "jl-says" }, Demo.companion(s.world, 52), el("p", {}, el("b", { text: w.mascot.name }), " " + (line || ""))));
        }
        if (!open) info.append(el("p", { class: "jl-lockline" }, icon("lock"), el("span", { text: i > 0 ? `Beat ${Bosses.info(map[i - 1].world).name} to open it.` : "Locked." })));
        const trail = el("div", { class: "jl-trail" });
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 100 100"); svg.setAttribute("preserveAspectRatio", "none"); svg.setAttribute("class", "jl-road"); svg.setAttribute("aria-hidden", "true");
        trail.append(svg);
        sec.append(info, trail);
        return sec;
    });
    $("jl-map").append(...sections);

    function drawTrail(i) {
        const sec = sections[i], trail = sec.querySelector(".jl-trail"), svg = trail.querySelector("svg"), pts = SPOTS[phone.matches ? "tall" : "wide"], s = map[i];
        trail.querySelectorAll(".jl-stop").forEach(n => n.remove());
        const reached = [1, 2, 3, 4, 5].filter(l => Demo.levelOpen(i, l)).length;
        svg.innerHTML = `<path class="jl-road-bed" d="${road(pts)}"/><path class="jl-road-ahead" d="${road(pts)}"/>` + (reached > 1 ? `<path class="jl-road-done" d="${road(pts.slice(0, reached))}"/>` : "");
        for (const l of [1, 2, 3, 4, 5]) {
            const lv = Demo.level(i, l), [x, y] = pts[l - 1], isNext = nx.si === i && nx.l === l;
            const stop = el("button", { type: "button", class: `jl-stop ${lv.rec ? "done" : lv.open ? "open" : "locked"}${lv.boss ? " boss" : ""}${isNext ? " next" : ""}${x > 50 ? " flip" : ""}`,
                style: { "--x": x + "%", "--y": y + "%" }, "data-l": l,
                "aria-label": `${lv.boss ? "Boss: " + lv.bossInfo.name : "Level " + l + ": " + (lv.lesson ? lv.lesson.name : lv.label)}, ${lv.rec ? lv.rec.stars + " of 3 stars" : lv.open ? "not played yet" : "locked"}`,
                onclick: e => { e.stopPropagation(); openPop(i, l); } });
            const disc = el("span", { class: "jl-disc" }, lv.boss ? el("span", { class: "jl-boss-art", html: Bosses.svg(s.world) }) : el("b", { text: String(l) }));
            if (!lv.open) disc.append(icon("lock", "jl-lock"));
            const label = el("span", { class: "jl-label" }, el("b", { text: lv.boss ? lv.bossInfo.name : (lv.lesson ? lv.lesson.name : lv.label) }),
                lv.rec ? Demo.stars(lv.rec.stars) : el("small", { text: isNext ? "Next" : lv.boss ? "Boss" : lv.label }));
            stop.append(disc, label);
            trail.append(stop);
        }
    }
    sections.forEach((s, i) => drawTrail(i));
    phone.addEventListener("change", () => { closePop(); sections.forEach((s, i) => drawTrail(i)); });

    // ---- a level's details, beside it ----
    function closePop() { if (pop) { pop.remove(); pop = null; } document.querySelectorAll(".jl-stop.sel").forEach(n => n.classList.remove("sel")); }
    function openPop(i, l) {
        closePop();
        const lv = Demo.level(i, l), trail = sections[i].querySelector(".jl-trail"), stop = trail.querySelector(`.jl-stop[data-l="${l}"]`);
        stop.classList.add("sel");
        const [x, y] = SPOTS[phone.matches ? "tall" : "wide"][l - 1];
        pop = el("div", { class: "jl-pop" + (x > 50 ? " left" : ""), role: "dialog", "aria-label": lv.boss ? lv.bossInfo.name : `${lv.worldName} ${l}`, style: { "--x": x + "%", "--y": y + "%" } });
        pop.append(el("button", { type: "button", class: "jl-pop-close", "aria-label": "Close", onclick: closePop }, icon("close")));
        pop.append(el("h3", { text: lv.boss ? lv.bossInfo.name : `${lv.worldName} ${l}` }));
        pop.append(el("p", { class: "jl-pop-facts", text: lv.boss ? `Boss · ${lv.phases} Phase${lv.phases > 1 ? "s" : ""} · Threat ${Powers.threat(i, 15).stars} of 5` : `${lv.label} · Par ${Demo.fmt(lv.par)}` }));
        if (lv.boss) pop.append(el("p", { class: "jl-pop-text", text: `“${lv.bossInfo.taunt}”` }));
        else if (lv.lesson) pop.append(el("p", { class: "jl-pop-lesson" }, el("b", { text: lv.lesson.name + ". " }), lv.lesson.practise));
        const got = lv.rec ? lv.rec.stars : 0;
        pop.append(el("ul", { class: "jl-pop-goals" }, ...[lv.boss ? "Beat the boss" : "Solve it", "No items", Demo.cap(lv.goal)].map((g, k) => el("li", { class: k < got ? "got" : "" }, icon("star"), el("span", { text: g })))));
        if (lv.prize) pop.append(el("p", { class: "jl-pop-text" }, icon("bolt"), el("span", { text: lv.rec ? ` You unlocked ${lv.prize.name} here.` : ` Unlocks ${lv.prize.name}.` })));
        pop.append(el("button", { type: "button", class: "jl-play", disabled: !lv.open, onclick: () => Demo.said(`In the game this starts ${lv.boss ? "the fight with " + lv.bossInfo.name : lv.worldName + " " + l}.`) },
            icon(lv.open ? "play" : "lock"), el("span", { text: !lv.open ? (l > 1 ? `Clear Level ${l - 1} First` : "Locked") : lv.boss ? "Fight" : lv.rec ? "Play Again" : "Play" })));
        (phone.matches ? document.body : trail).append(pop);
        pop.querySelector(".jl-play").focus({ preventScroll: true });
    }

    // ---- which world is in view: its scene behind everything, its name in the rail and the bar ----
    const io = new IntersectionObserver(entries => {
        for (const e of entries) if (e.isIntersecting) setCurrent(Number(e.target.dataset.i));
    }, { threshold: 0.55 });
    sections.forEach(s => io.observe(s));
    function setCurrent(i) {
        if (i === current) return;
        current = i;
        Worlds.use(map[i].world);
        rail.querySelectorAll(".jl-rail-item").forEach(b => b.classList.toggle("on", Number(b.dataset.i) === i));
        const w = Worlds.byId[map[i].world];
        $("jl-where").replaceChildren(el("span", { text: map[i].secret ? "Secret World" : `${i + 1}. ${w.name}` }), icon("next", "jl-chev"));
    }
    function goTo(i, then) {
        sections[i].scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
        if (then) setTimeout(then, 650);
    }

    // ---- Continue: always the next level ----
    $("jl-continue").append(icon("play"), el("span", {}, el("small", { text: "Continue" }), el("b", { text: `${Worlds.byId[map[nx.si].world].name} ${nx.l === 5 ? "Boss" : nx.l}` })));
    $("jl-continue").addEventListener("click", e => { e.stopPropagation(); goTo(nx.si, () => openPop(nx.si, nx.l)); });

    // start on the world you're in
    sections[nx.si].scrollIntoView({ block: "start" });
    setCurrent(nx.si);
})();
