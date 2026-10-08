// Schmoll Crossword: the screens around the game (redesign).
//   Home: today's three dailies, Unlimited, the streak (with fire) and this week, the worlds
//   Stats: tiles that count up, a calendar heatmap, best/average times, achievements, history
//   Settings: the world picker (live previews), mode, sound, effects, timer, intro, difficulty
//   The top bar (sound and world buttons), screen switching (#daily, #stats...), and the start-up intro.

const App = (() => {
    const $ = U.$;
    const root = document.documentElement;
    const screens = { home: $("#home-view"), game: $("#game-view"), stats: $("#stats-view"), settings: $("#settings-view") };
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

    // ---------------------------------------------------------------------------------------------
    // Switching worlds (with the new world's transition)
    // ---------------------------------------------------------------------------------------------
    let switching = false;
    async function switchWorld(id) {
        if (switching || id === Settings.get("design")) return;
        switching = true;
        const w = Worlds.byId[id];
        Sound.play("whoosh");
        await FX.transition(w.transition, () => {
            Settings.set("design", id);
            refreshWorldUI();
        });
        switching = false;
        Mascot.react("hello", { mood: "wow" });
    }
    function refreshWorldUI() {
        const w = Worlds.current;
        $("#world-toggle .wt-icon").textContent = w.icon;
        $("#world-toggle").title = "World: " + w.name;
        const v = U.view();
        if (v === "home") drawHome();
        if (v === "settings") drawSettings();
        if (v === "stats") drawStats();
        document.querySelectorAll(".world-card").forEach(c => c.classList.toggle("on", c.dataset.wid === w.id));
        root.classList.toggle("mode-locked", w.modes.length < 2);
    }

    // a card for each world, with a little live preview of its scene
    function worldCards(container, { compact = false } = {}) {
        container.innerHTML = "";
        for (const w of Worlds.list) {
            const card = U.el("button", { type: "button", class: "world-card" + (w.id === Settings.get("design") ? " on" : "") + (compact ? " compact" : ""), "data-wid": w.id, "aria-label": "Switch to the " + w.name + " world" },
                U.el("canvas", { class: "wc-preview", "aria-hidden": "true" }),
                U.el("span", { class: "wc-label" }, U.el("b", {}, U.el("i", { text: w.icon }), " " + w.name), compact ? null : U.el("small", { text: w.tagline })));
            container.appendChild(card);
            card.addEventListener("click", () => switchWorld(w.id));
        }
        // draw the previews once laid out; animate one while it's hovered
        requestAnimationFrame(() => container.querySelectorAll(".world-card").forEach(card => {
            const cv = card.querySelector("canvas");
            let anim = null, raf = 0, last = 0;
            try { anim = Worlds.preview(cv, card.dataset.wid, Settings.get("theme")); } catch (err) { console.error(err); }
            const loop = now => { const dt = U.clamp((now - last) / 1000, 0, 0.05); last = now; anim.step(dt); raf = requestAnimationFrame(loop); };
            card.addEventListener("pointerenter", () => { if (anim && !raf && U.motion() !== "still") { last = performance.now(); raf = requestAnimationFrame(loop); } });
            card.addEventListener("pointerleave", () => { cancelAnimationFrame(raf); raf = 0; });
        }));
    }

    // ---------------------------------------------------------------------------------------------
    // Screens: the part of the URL after "#" picks one (so Back and bookmarks work)
    // ---------------------------------------------------------------------------------------------
    let firstShow = true;
    function showView() {
        const view = U.view();
        const gameView = view === "daily" || view === "unlimited";
        document.querySelectorAll(".modes a").forEach(a => a.classList.toggle("active", a.dataset.view === view));
        for (const [name, el] of Object.entries(screens)) {
            const on = name === view || (name === "game" && gameView);
            if (on && el.hidden) U.restart(el, "enter");
            el.hidden = !on;
        }
        Game.closeResults();
        root.dataset.view = gameView ? "game" : view;
        $("#world-pop").hidden = true;
        $("#world-toggle").setAttribute("aria-expanded", "false");
        Mascot.away = mascotInTheWay();
        if (!firstShow) Sound.play("nav");
        firstShow = false;
        if (view === "home") drawHome();
        else if (view === "stats") drawStats();
        else if (view === "settings") drawSettings();
        else Game.show(view);
        scrollTo({ top: 0 });
    }

    // on a phone-sized game screen the mascot and its speech bubble would cover the board
    function mascotInTheWay() {
        const v = U.view();
        return (v === "daily" || v === "unlimited") && innerWidth < 900 && (U.touch() || innerWidth < 780);
    }
    addEventListener("resize", U.debounce(() => { if (!root.classList.contains("intro-on")) Mascot.away = mascotInTheWay(); }, 200));

    // ---------------------------------------------------------------------------------------------
    // Home
    // ---------------------------------------------------------------------------------------------
    function greeting() {
        const h = new Date().getHours();
        return h < 5 ? "Up late?" : h < 12 ? "Good morning!" : h < 17 ? "Good afternoon!" : h < 22 ? "Good evening!" : "Night owl mode.";
    }
    function drawHome() {
        $("#greeting").textContent = greeting();
        $("#today-date").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
        const all = Game.scores(), today = dayKey(new Date());
        let solved = 0;
        document.querySelectorAll(".daily-chip").forEach((chip, i) => {
            const record = all[today + "-" + chip.dataset.difficulty];
            const state = chip.querySelector(".chip-state");
            chip.classList.toggle("done", !!record && !record.surrendered);
            chip.classList.toggle("given-up", !!record && !!record.surrendered);
            chip.style.setProperty("--i", i);
            if (!record) state.textContent = "Play ▶";
            else if (record.surrendered) state.textContent = "Revealed";
            else { state.textContent = `✓ ${record.points} pts · ${U.fmtTime(record.seconds || 0)}`; solved++; }
        });
        $("#daily-status").textContent = solved === 3 ? "All three done today! \u{1F3C6}" : solved ? `${solved} of 3 done today.` : "Three new puzzles are ready.";
        drawCountdown();
        const streaks = calculateStreaks(all);
        const holder = $("#home-streak");
        holder.innerHTML = "";
        holder.appendChild(Game.streakBadge(streaks));
        // this week, Monday to Sunday
        const week = $("#home-week");
        week.innerHTML = "";
        const now = new Date(), monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i), key = dayKey(d);
            const n = ["easy", "medium", "hard"].filter(x => all[key + "-" + x] && !all[key + "-" + x].surrendered).length + (all[key] && !all[key].surrendered ? 1 : 0);
            week.appendChild(U.el("div", { class: "wk-day" + (key === today ? " today" : "") + (d > now ? " future" : ""), "data-n": Math.min(3, n), title: d.toDateString() + (n ? ` · ${n} solved` : "") },
                U.el("span", { text: d.toLocaleDateString(undefined, { weekday: "narrow" }) }),
                U.el("i", { text: n ? "✓" : "" })));
        }
        const ach = Achievements.load(), got = Object.keys(ach.unlocked);
        $("#home-ach").textContent = got.length ? `${got.length}/${Achievements.LIST.length} achievements · ` + Achievements.LIST.filter(a => ach.unlocked[a.id]).slice(-5).map(a => a.icon).join(" ") : `0/${Achievements.LIST.length} achievements. Solve a puzzle to start!`;
        worldCards($("#home-worlds"), { compact: true });
    }
    function drawCountdown() {
        if (screens.home.hidden) return;
        const now = new Date(), midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const total = Math.max(0, Math.floor((midnight - now) / 1000));
        const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
        $("#countdown").innerHTML = `New dailies in <b>${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s</b>`;
        if (total === 0) drawHome();
    }
    setInterval(drawCountdown, 1000);
    // the heatmap shows as many weeks as fit, so redraw it when the window changes size
    addEventListener("resize", U.debounce(() => { if (!screens.stats.hidden) drawHeatmap(Game.scores()); }, 200));
    document.querySelectorAll(".daily-chip").forEach(chip => chip.addEventListener("click", () => { Game.difficultyFor.daily = chip.dataset.difficulty; }));

    // ---------------------------------------------------------------------------------------------
    // Stats
    // ---------------------------------------------------------------------------------------------
    const dayOf = key => key.slice(0, 8);
    const keyDate = key => new Date(Number(key.slice(0, 4)), Number(key.slice(4, 6)) - 1, Number(key.slice(6, 8)));
    function drawStats() {
        const all = Game.scores(), keys = Object.keys(all).sort().reverse();
        const solved = keys.filter(k => !all[k].surrendered);
        const times = solved.map(k => all[k].seconds).filter(s => typeof s === "number");
        const streaks = calculateStreaks(all);
        const points = solved.reduce((sum, k) => sum + (all[k].points || 0), 0);
        const ach = Achievements.load();
        const tiles = [
            [points, "total points", v => Math.round(v)],
            [solved.length, solved.length === 1 ? "daily solved" : "dailies solved", v => Math.round(v)],
            [streaks.current, "current streak", v => Math.round(v)],
            [streaks.best, "best streak", v => Math.round(v)],
            [times.length ? Math.min(...times) : null, "best time", v => U.fmtTime(Math.round(v))],
            [times.length ? times.reduce((a, b) => a + b, 0) / times.length : null, "average time", v => U.fmtTime(Math.round(v))],
            [Object.keys(ach.unlocked).length, "achievements", v => Math.round(v) + "/" + Achievements.LIST.length]
        ];
        const tilesEl = $("#stat-tiles");
        tilesEl.innerHTML = "";
        tiles.forEach(([value, label, fmt], i) => {
            const v = U.el("div", { class: "value", text: value == null ? "–" : fmt(0) });
            tilesEl.appendChild(U.el("div", { class: "stat-tile", style: { "--i": i } }, v, U.el("div", { class: "label", text: label })));
            if (value != null) setTimeout(() => FX.countUp(v, value, { dur: 900, fmt }), 120 + i * 70);
        });
        const s = $("#stats-streak");
        s.innerHTML = "";
        s.appendChild(Game.streakBadge(streaks));
        drawHeatmap(all);
        drawTimes(all, solved);
        $("#ach-count").textContent = (() => { const r = Achievements.render($("#ach-grid")); return `${r.got} of ${r.total} unlocked`; })();
        // history
        const rowsEl = $("#history-rows");
        rowsEl.innerHTML = "";
        for (const key of keys.slice(0, 60)) {
            const r = all[key];
            rowsEl.appendChild(U.el("tr", {},
                U.el("td", { text: keyDate(key).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }) }),
                U.el("td", {}, U.el("span", { class: "diff-tag " + (r.difficulty || ""), text: r.difficulty || "" })),
                U.el("td", { class: "num", text: typeof r.seconds === "number" ? U.fmtTime(r.seconds) : "–" }),
                U.el("td", { class: "num", text: r.surrendered ? "revealed" : String(r.points) })));
        }
        $("#history").hidden = keys.length === 0;
        $("#no-history").hidden = keys.length > 0;
    }
    // a calendar heatmap of the last few months (as many weeks as fit the card): darker = more dailies solved that day
    function drawHeatmap(all) {
        const per = {};
        for (const k of Object.keys(all)) if (!all[k].surrendered) per[dayOf(k)] = (per[dayOf(k)] || 0) + 1;
        const el = $("#heatmap");
        el.innerHTML = "";
        const now = new Date(), WEEKS = U.clamp(Math.floor((el.clientWidth || 400) / 24), 10, 26);
        el.style.setProperty("--weeks", WEEKS);
        $("#heatmap-title").textContent = `Last ${WEEKS} weeks`;
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() - (WEEKS - 1) * 7);
        let lastMonth = -1;
        for (let w = 0; w < WEEKS; w++) {
            const col = U.el("div", { class: "hm-col" });
            const first = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7);
            // name each month above its first week (skipped when only one week of it shows, so labels don't collide)
            const next = new Date(first.getFullYear(), first.getMonth(), first.getDate() + 7);
            const label = first.getMonth() !== lastMonth && (w > 0 || next.getMonth() === first.getMonth());
            col.appendChild(U.el("span", { class: "hm-month", text: label ? first.toLocaleDateString(undefined, { month: "short" }) : "" }));
            lastMonth = first.getMonth();
            for (let d = 0; d < 7; d++) {
                const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d), key = dayKey(day), n = Math.min(3, per[key] || 0);
                col.appendChild(U.el("i", { class: "hm-cell" + (day > now ? " future" : "") + (key === dayKey(now) ? " today" : ""), "data-n": n, style: { "--d": (w * 7 + d) * 6 + "ms" }, title: `${day.toDateString()}: ${n} solved` }));
            }
            el.appendChild(col);
        }
    }
    // best and average times by difficulty, as bars
    function drawTimes(all, solved) {
        const el = $("#times-chart");
        el.innerHTML = "";
        const rows = ["easy", "medium", "hard"].map(d => {
            const t = solved.filter(k => all[k].difficulty === d && typeof all[k].seconds === "number").map(k => all[k].seconds);
            return { d, n: t.length, best: t.length ? Math.min(...t) : 0, avg: t.length ? t.reduce((a, b) => a + b, 0) / t.length : 0 };
        });
        const max = Math.max(60, ...rows.map(r => r.avg));
        for (const r of rows) {
            el.appendChild(U.el("div", { class: "tc-row" },
                U.el("span", { class: "tc-label diff-tag " + r.d, text: cap(r.d) }),
                U.el("div", { class: "tc-bars" },
                    U.el("i", { class: "tc-avg", style: { "--w": (r.avg / max * 100).toFixed(1) + "%" }, title: "Average" }),
                    U.el("i", { class: "tc-best", style: { "--w": (r.best / max * 100).toFixed(1) + "%" }, title: "Best" })),
                U.el("span", { class: "tc-val", text: r.n ? `best ${U.fmtTime(r.best)} · avg ${U.fmtTime(Math.round(r.avg))}` : "no solves yet" })));
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Settings
    // ---------------------------------------------------------------------------------------------
    const form = $("#settings-form");
    function drawSettings() {
        worldCards($("#world-cards"));
        const f = form.elements, s = Settings.all();
        for (const input of f.difficulty) input.checked = input.value === s.difficulty;
        // Deep Space and Neon Arcade only come in dark: show that, without changing the saved choice
        const w = Worlds.current, locked = w.modes.length < 2;
        for (const input of f.theme) { input.checked = input.value === (locked ? w.modes[0] : s.theme); input.disabled = locked; }
        for (const input of f.effects) input.checked = input.value === s.effects;
        f.hardWords.checked = s.hardWords;
        f.showTimer.checked = s.showTimer;
        f.sound.checked = s.sound;
        f.intro.checked = s.intro;
        f.volume.value = Math.round(s.volume * 100);
        $("#mode-note").hidden = !locked;
        $("#mode-note").textContent = `${w.name} is always ${w.modes[0]}.`;
    }
    form.addEventListener("change", e => {
        const input = e.target;
        if (!input.name) return;
        if (input.type === "checkbox") { Settings.set(input.name, input.checked); Sound.play("toggle", input.checked); }
        else if (input.type === "range") Settings.set(input.name, Number(input.value) / 100);
        else { Settings.set(input.name, input.value); Sound.play("select"); }
    });
    form.elements.volume.addEventListener("input", e => Settings.set("volume", Number(e.target.value) / 100));
    $("#replay-intro").addEventListener("click", () => { sessionStorage.removeItem("schmoll.introSeen"); intro(true); });
    $("#reset-data").addEventListener("click", async () => {
        if (!(await U.ask({ title: "Clear all your data?", text: "Your saved progress, daily scores, streaks, achievements and settings. This can't be undone.", yes: "Clear it", no: "Cancel" }))) return;
        try { for (const k of Object.keys(localStorage)) if (k.startsWith("schmoll.")) localStorage.removeItem(k); } catch (err) { /* nothing saved */ }
        location.hash = "";
        location.reload();
    });

    // ---------------------------------------------------------------------------------------------
    // The top bar: sound and world buttons
    // ---------------------------------------------------------------------------------------------
    function drawTools() {
        $("#sound-toggle").classList.toggle("off", !Settings.get("sound"));
        $("#sound-toggle").setAttribute("aria-pressed", String(Settings.get("sound")));
    }
    $("#sound-toggle").addEventListener("click", e => { Settings.set("sound", !Settings.get("sound")); Sound.play("toggle", true); e.currentTarget.blur(); });
    const pop = $("#world-pop");
    $("#world-toggle").addEventListener("click", e => {
        e.stopPropagation();
        const open = pop.hidden;
        pop.hidden = !open;
        e.currentTarget.setAttribute("aria-expanded", String(open));
        if (open) { worldCards($("#world-pop-cards"), { compact: true }); Sound.play("select"); }
    });
    document.addEventListener("pointerdown", e => { if (!pop.hidden && !pop.contains(e.target) && !e.target.closest("#world-toggle")) pop.hidden = true; });
    pop.addEventListener("click", e => { if (e.target.closest(".world-card")) pop.hidden = true; });
    Settings.on(key => {
        if (key === "sound") drawTools();
        if (key === "theme") refreshWorldUI();
    });
    // every button and link gets a little "select" sound
    document.addEventListener("pointerdown", e => {
        if (e.target.closest("#board, .key, .m-face")) return;
        if (e.target.closest("button, a, label, .clues li")) Sound.play("select");
    }, true);

    // ---------------------------------------------------------------------------------------------
    // The start-up intro.
    //   1. PRESS START, over the live world scene: letter tiles float up past you, rays turn slowly, the six
    //      world icons bob, and a ticker scrolls along the bottom.
    //   2. A shockwave, a crossword grid draws itself across the screen, and the logo builds itself out of tiles
    //      (each one landing with a puff), then a shine sweeps across it.
    //   3. "1 ACROSS" types out the tagline, the worlds orbit the logo and burst, and the current world adds its
    //      own flourish before its screen transition takes you in.
    // ---------------------------------------------------------------------------------------------
    const LOGO = [];
    [..."SCHMOLL"].forEach((ch, i) => LOGO.push({ ch, r: 0, c: i }));
    [..."ROSSWORD"].forEach((ch, i) => LOGO.push({ ch, r: i + 1, c: 1 }));      // CROSSWORD goes down from SCHMOLL's C
    const TAGLINE = "A tiny crossword. Three fresh ones every day.";
    const TICKER = ["Three fresh puzzles every day", "Six worlds to explore", "Streaks, stats & achievements", "Unlimited puzzles on demand", "Every sound is made in code", "Free, no ads"];

    // floating tiles for the start screen: far ones small and blurry, near ones big and sharp
    function floatingTiles(n) {
        const letters = "SCHMOLLCROSSWORD";
        return Array.from({ length: n }, (_, i) => {
            const depth = Math.random(), s = Math.round(22 + depth * 46);
            return `<i class="it-tile" style="--x:${(Math.random() * 100).toFixed(1)}vw;--s:${s}px;--d:${(-Math.random() * 16).toFixed(1)}s;--t:${(15 - depth * 7).toFixed(1)}s;` +
                `--r:${(Math.random() * 80 - 40).toFixed(0)}deg;--b:${((1 - depth) * 2.6).toFixed(1)}px;--o:${(0.3 + depth * 0.55).toFixed(2)}">${letters[i % letters.length]}</i>`;
        }).join("");
    }
    // a crossword grid that draws itself out from the middle of the screen, with black squares popping in
    function sketchGrid() {
        const W = innerWidth, H = innerHeight, G = U.clamp(Math.min(W, H) / 8, 46, 92), cx = W / 2, cy = H / 2;
        const far = Math.hypot(cx, cy);
        let out = `<svg class="intro-grid" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">`;
        for (let x = cx % G; x < W; x += G) out += `<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${H}" pathLength="1" style="animation-delay:${Math.round(Math.abs(x - cx) / far * 500)}ms"/>`;
        for (let y = cy % G; y < H; y += G) out += `<line x1="0" y1="${y.toFixed(1)}" x2="${W}" y2="${y.toFixed(1)}" pathLength="1" style="animation-delay:${Math.round(Math.abs(y - cy) / far * 500)}ms"/>`;
        for (let x = cx % G - G; x < W; x += G) for (let y = cy % G - G; y < H; y += G) {
            if (Math.random() > 0.09) continue;
            const d = Math.hypot(x + G / 2 - cx, y + G / 2 - cy);
            out += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${G.toFixed(1)}" height="${G.toFixed(1)}" style="animation-delay:${Math.round(300 + d / far * 700)}ms"/>`;
        }
        return out + "</svg>";
    }

    async function intro(force = false) {
        const box = $("#intro");
        let seen = false;
        try { seen = sessionStorage.getItem("schmoll.introSeen") === "1"; } catch (err) { /* blocked */ }
        if (!force && (!Settings.get("intro") || seen || U.motion() === "still")) { box.hidden = true; return false; }
        try { sessionStorage.setItem("schmoll.introSeen", "1"); } catch (err) { /* blocked */ }
        root.classList.add("intro-on");
        box.hidden = false;
        box.classList.remove("go");
        const ticker = TICKER.map(t => `<span>&#9733; ${U.esc(t)}</span>`).join("");
        box.innerHTML = `
            <div class="intro-rays" aria-hidden="true"></div>
            <div class="intro-tiles" aria-hidden="true">${floatingTiles(U.motion() === "lite" ? 12 : 26)}</div>
            <div class="intro-press">
                <div class="intro-mini" aria-hidden="true"><i>S</i><i>C</i><i class="b"></i><i>R</i></div>
                <button type="button" class="intro-start">PRESS START</button>
                <div class="intro-worlds" aria-hidden="true">${Worlds.list.map((w, i) => `<span class="iw" style="--i:${i}">${w.icon}</span>`).join("")}</div>
                <small>click anywhere or press any key · sound on \u{1F50A}</small>
            </div>
            <div class="intro-ticker" aria-hidden="true"><div>${ticker}${ticker}</div></div>`;
        Mascot.away = true;
        await new Promise(resolve => {
            const go = () => { removeEventListener("keydown", go, true); box.removeEventListener("pointerdown", go); resolve(); };
            addEventListener("keydown", go, true);
            box.addEventListener("pointerdown", go);
        });
        Sound.init();
        Sound.play("start");
        const css = getComputedStyle(root), colors = ["--accent", "--accent-2", "--ink"].map(v => css.getPropertyValue(v).trim() || "#ffffff");
        const bp = U.center(box.querySelector(".intro-start"));
        FX.ring({ x: bp.x, y: bp.y, color: colors[0], r1: Math.hypot(innerWidth, innerHeight) * 0.6, dur: 0.9, width: 16, glow: false });
        FX.burst({ x: bp.x, y: bp.y, n: 40, colors, shape: "star", speed: [200, 700], gravity: 300, drag: 1.2, life: [0.6, 1.1], size: [3, 7] });
        FX.shake(6, 260);
        box.classList.add("go");

        // the logo builds itself over a self-drawing grid
        box.querySelector(".intro-press").remove();
        box.querySelector(".intro-ticker").remove();
        box.insertAdjacentHTML("beforeend", sketchGrid() + `
            <div class="intro-stage">
                <div class="intro-logo" aria-label="Schmoll Crossword"><div class="intro-orbit" aria-hidden="true">${Worlds.list.map((w, i) => `<span class="io" style="--i:${i};--n:${Worlds.list.length}"><b>${w.icon}</b></span>`).join("")}</div></div>
                <p class="intro-tag"><span class="it-clue">1 ACROSS</span><span class="it-type"></span><i class="it-caret"></i></p>
                <small class="intro-skip">click to continue</small>
            </div>`);
        const logo = box.querySelector(".intro-logo"), stage = box.querySelector(".intro-stage"), orbit = box.querySelector(".intro-orbit");
        let skipped = false;
        const skip = () => { skipped = true; };
        box.addEventListener("pointerdown", skip);
        addEventListener("keydown", skip, true);
        const pause = async ms => { for (let t = 0; t < ms && !skipped; t += 50) await U.wait(50); };
        LOGO.forEach((t, i) => {
            const tile = U.el("span", { class: "logo-tile" + (t.r === 0 && t.c === 1 ? " cross" : ""), text: t.ch, style: { gridRow: t.r + 1, gridColumn: t.c + 1, "--i": i } });
            logo.appendChild(tile);
            const from = U.pick([[0, -320], [0, 320], [-320, 0], [320, 0]]);
            tile.animate([
                { transform: `translate(${from[0]}px, ${from[1]}px) rotate(${U.rand(-120, 120)}deg) scale(.3)`, opacity: 0 },
                { transform: "translate(0,0) rotate(0) scale(1.2)", opacity: 1, offset: 0.75 },
                { transform: "none", opacity: 1 }
            ], { duration: 520, delay: 450 + i * 75, easing: "cubic-bezier(.2,.8,.3,1)", fill: "backwards" });
            setTimeout(() => {
                if (skipped) return;
                Sound.play("tile", i);
                const p = U.center(tile);
                FX.burst({ x: p.x, y: p.y, n: 7, colors, shape: "circle", speed: [60, 180], gravity: 120, drag: 2.5, life: [0.3, 0.6], size: [1.5, 3.5] });
            }, 450 + i * 75 + 390);
        });
        await pause(450 + LOGO.length * 75 + 450);
        if (!skipped) {
            stage.classList.add("landed");
            Sound.play("title");
            // "1 ACROSS": the tagline types itself out
            const typeEl = stage.querySelector(".it-type");
            for (let i = 0; i < TAGLINE.length && !skipped; i++) {
                typeEl.textContent = TAGLINE.slice(0, i + 1);
                if (TAGLINE[i] !== " " && i % 2 === 0) Sound.play("type");
                await U.wait(32);
            }
            typeEl.textContent = TAGLINE;
            // the worlds orbit the logo, then burst one by one
            orbit.classList.add("on");
            await pause(1300);
            if (!skipped) {
                orbit.querySelectorAll(".io b").forEach((icon, i) => setTimeout(() => {
                    const p = U.center(icon);
                    FX.burst({ x: p.x, y: p.y, n: 14, colors, shape: "star", speed: [80, 260], gravity: 100, drag: 1.6, life: [0.5, 0.9], size: [2.5, 5] });
                    Sound.play("pop");
                    icon.classList.add("gone");
                }, i * 90));
                await pause(Worlds.list.length * 90 + 150);
            }
            if (!skipped) {
                const w = Worlds.current;
                if (w.introFlourish) { try { w.introFlourish(logo); } catch (err) { console.error(err); } }
                await pause(1600);
            }
        }
        box.removeEventListener("pointerdown", skip);
        removeEventListener("keydown", skip, true);
        await FX.transition(Worlds.current.transition, () => {
            box.hidden = true;
            box.innerHTML = "";
            box.classList.remove("go");
            root.classList.remove("intro-on");
            Mascot.away = mascotInTheWay();
        });
        Game.playTitleCard();
        Mascot.react("hello", { mood: "happy" });
        return true;
    }

    // ---------------------------------------------------------------------------------------------
    // Start
    // ---------------------------------------------------------------------------------------------
    Worlds.use(Settings.get("design"));
    refreshWorldUI();
    drawTools();
    addEventListener("hashchange", showView);
    showView();
    intro().then(played => { if (!played) setTimeout(() => Mascot.react("hello", { mood: "happy" }), 900); });

    return { switchWorld, showView, intro };
})();
