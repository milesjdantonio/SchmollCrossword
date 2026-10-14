// Schmoll Crossword: the screens around the game (redesign).
//   Home: today's five dailies, Unlimited, the streak (with fire) and this week, the worlds
//   Stats: tiles that count up, a calendar heatmap, best/average times, achievements, history
//   Settings: the world picker (live previews), mode, sound, effects, timer, intro, difficulty
//   The top bar (How to Play, world and sound buttons, each next to Settings), screen switching (#daily, #stats...),
//   and the start-up intro.

const App = (() => {
    const $ = U.$;
    const root = document.documentElement;
    const screens = { home: $("#home-view"), game: $("#game-view"), campaign: $("#campaign-view"), stats: $("#stats-view"), settings: $("#settings-view") };
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

    // ---------------------------------------------------------------------------------------------
    // Switching worlds (with the new world's transition)
    // ---------------------------------------------------------------------------------------------
    let switching = false;
    async function switchWorld(id) {
        if (switching || id === Settings.get("design")) return;
        switching = true;
        const w = Worlds.byId[id];
        Sound.play("worldSwap");
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
        document.querySelectorAll(".world-card, .world-classic-bar").forEach(c => c.classList.toggle("on", c.dataset.wid === w.id));
        root.classList.toggle("mode-locked", w.modes.length < 2);
    }

    // a card for each world, with a little live preview of its scene
    function worldCards(container, { compact = false } = {}) {
        container.innerHTML = "";
        for (const w of Worlds.list) {
            if (w.plain) continue;                    // Classic isn't a card: it's the plain bar underneath
            if (w.secret && !Campaign.secretOpen()) continue;   // the Celestial Rift: only once the Void is beaten
            const card = U.el("button", { type: "button", class: "world-card" + (w.id === Settings.get("design") ? " on" : "") + (compact ? " compact" : ""), "data-wid": w.id, "aria-label": "Switch to the " + w.name + " world" },
                U.el("canvas", { class: "wc-preview", "aria-hidden": "true" }),
                U.el("span", { class: "wc-label" }, U.el("b", {}, U.el("i", { text: w.icon }), " " + w.name), null));
            container.appendChild(card);
            card.addEventListener("click", () => switchWorld(w.id));
        }
        // the Classic world: a plain bar across the bottom
        const plain = Worlds.list.find(w => w.plain);
        if (plain) {
            const on = plain.id === Settings.get("design");
            const bar = U.el("button", { type: "button", class: "world-classic-bar" + (on ? " on" : ""), "data-wid": plain.id, "aria-label": "Switch to the plain Classic page" },
                U.el("b", { text: plain.name }));
            bar.addEventListener("click", () => switchWorld(plain.id));
            container.appendChild(bar);
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
        const gameView = view === "daily" || view === "unlimited" || view === "level";
        if (!Campaign.onView(view)) return;          // campaign screens wear the campaign's worlds (and #level needs a level)
        // a level lights up Campaign, but the Daily and Unlimited Boss belong to their own screens (the user's rule)
        const tab = view === "level" ? (Campaign.playing && Campaign.playing.special) || "campaign" : view;
        document.querySelectorAll(".modes a").forEach(a => a.classList.toggle("active", a.dataset.view === tab));
        for (const [name, el] of Object.entries(screens)) {
            const on = name === view || (name === "game" && gameView);
            if (on && el.hidden) U.restart(el, "enter");
            el.hidden = !on;
        }
        Game.closeResults();
        root.dataset.view = gameView ? "game" : view;
        closePops();
        Mascot.away = mascotInTheWay();
        if (!firstShow) Sound.play("nav");
        firstShow = false;
        if (view === "home") drawHome();
        else if (view === "stats") drawStats();
        else if (view === "settings") drawSettings();
        // a campaign level needs the map first (which world it is, its difficulty); after a reload it isn't loaded yet
        else if (view === "level") Campaign.ready().then(() => { if (U.view() === "level") Game.show(view); }, () => Game.show(view));
        else if (view !== "campaign") Game.show(view);
        scrollTo({ top: 0 });
    }

    // on a phone-sized game screen the mascot and its speech bubble would cover the board
    function mascotInTheWay() {
        const v = U.view();
        return (v === "daily" || v === "unlimited" || v === "level") && innerWidth < 900 && (U.touch() || innerWidth < 780);
    }
    addEventListener("resize", U.debounce(() => { if (!root.classList.contains("intro-on")) Mascot.away = mascotInTheWay(); }, 200));

    // ---------------------------------------------------------------------------------------------
    // Home
    // ---------------------------------------------------------------------------------------------
    let homeDay = "";                  // the day Home was last drawn for
    function greeting() {
        const h = new Date().getHours();
        return h < 5 ? "Up Late?" : h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : h < 22 ? "Good Evening" : "Night Owl Mode";
    }
    function drawHome() {
        homeDay = dayKey(new Date());
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
            if (!record) state.textContent = "Play";
            else if (record.surrendered) state.textContent = "Revealed";
            else { state.textContent = `✓ ${record.points} pts · ${U.fmtTime(record.seconds || 0)}`; solved++; }
        });
        if (all[today + "-boss"] && !all[today + "-boss"].surrendered) solved++;          // the Daily Boss is the 5th daily
        const total = document.querySelectorAll(".daily-chip").length + 1;
        $("#daily-status").textContent = solved === total ? "All Done for Today" : solved ? `${solved} of ${total} Done Today` : "";
        drawCountdown();
        const streaks = calculateStreaks(all);
        const holder = $("#home-streak");
        holder.innerHTML = "";
        holder.appendChild(Game.streakBadge(streaks));
        // this week, Sunday to Saturday (the user's choice, like the heatmap on Stats)
        const week = $("#home-week");
        week.innerHTML = "";
        const now = new Date(), sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
        for (let i = 0; i < 7; i++) {
            const d = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i), key = dayKey(d);
            const n = ["easy", "medium", "hard", "challenge", "boss"].filter(x => all[key + "-" + x] && !all[key + "-" + x].surrendered).length + (all[key] && !all[key].surrendered ? 1 : 0);
            week.appendChild(U.el("div", { class: "wk-day" + (key === today ? " today" : "") + (d > now ? " future" : ""), "data-n": Math.min(5, n), title: d.toDateString() + (n ? ` · ${n} solved` : "") },
                U.el("span", { text: d.toLocaleDateString(undefined, { weekday: "narrow" }) }),
                U.el("i", { text: n ? "✓" : "" })));
        }
        const ach = Achievements.load(), got = Object.keys(ach.unlocked);
        $("#home-ach").textContent = got.length ? `${got.length} of ${Achievements.LIST.length} Achievements  ` + Achievements.LIST.filter(a => ach.unlocked[a.id]).slice(-5).map(a => a.icon).join(" ") : `0 of ${Achievements.LIST.length} Achievements`;
        Campaign.drawHomeCard();
        Leaderboard.drawHome($("#home-leaderboard"), $("#home-lb-count"));
    }
    function drawCountdown() {
        if (screens.home.hidden) return;
        const now = new Date(), midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const total = Math.max(0, Math.floor((midnight - now) / 1000));
        const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
        $("#countdown").innerHTML = `New Puzzles in <b>${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s</b>`;
        // the greeting follows the clock without a reload (Good Morning turns into Good Afternoon at noon), and a new
        // day redraws everything (checked by date: a tab in the background can miss the exact second of midnight)
        const g = $("#greeting"), hello = greeting();
        if (g.textContent !== hello) g.textContent = hello;
        if (homeDay !== dayKey(now)) drawHome();
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
        Leaderboard.drawFull($("#stats-leaderboard"));
        const all = Game.scores(), keys = Object.keys(all).sort().reverse();
        const solved = keys.filter(k => !all[k].surrendered);
        const times = solved.map(k => all[k].seconds).filter(s => typeof s === "number");
        const streaks = calculateStreaks(all);
        const points = solved.reduce((sum, k) => sum + (all[k].points || 0), 0);
        const ach = Achievements.load();
        const tiles = [
            [points, "Total Points", v => Math.round(v)],
            [solved.length, solved.length === 1 ? "Daily Solved" : "Dailies Solved", v => Math.round(v)],
            [streaks.current, "Current Streak", v => Math.round(v)],
            [streaks.best, "Best Streak", v => Math.round(v)],
            [times.length ? Math.min(...times) : null, "Best Time", v => U.fmtTime(Math.round(v))],
            [times.length ? times.reduce((a, b) => a + b, 0) / times.length : null, "Average Time", v => U.fmtTime(Math.round(v))],
            [Object.keys(ach.unlocked).length, "Achievements", v => Math.round(v) + "/" + Achievements.LIST.length]
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
                U.el("td", { class: "num", text: r.surrendered ? "Revealed" : String(r.points) })));
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
        $("#heatmap-title").textContent = `Last ${WEEKS} Weeks`;
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
                const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d), key = dayKey(day), n = Math.min(5, per[key] || 0);
                col.appendChild(U.el("i", { class: "hm-cell" + (day > now ? " future" : "") + (key === dayKey(now) ? " today" : ""), "data-n": n, style: { "--d": (w * 7 + d) * 6 + "ms" }, title: `${day.toDateString()}: ${n} solved` }));
            }
            el.appendChild(col);
        }
    }
    // best and average times by difficulty, as bars (the Daily Boss's wins too: saved as difficulty "boss")
    function drawTimes(all, solved) {
        const el = $("#times-chart");
        el.innerHTML = "";
        const rows = ["easy", "medium", "hard", "challenge", "boss"].map(d => {
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
                U.el("span", { class: "tc-val", text: r.n ? `Best ${U.fmtTime(r.best)} · Average ${U.fmtTime(Math.round(r.avg))}` : "No Solves Yet" })));
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
        f.intro.checked = s.intro;
        syncSound();
        $("#mode-note").hidden = !locked;
        $("#mode-note").textContent = `${w.name} is always ${w.modes[0]}.`;
    }
    form.addEventListener("submit", e => e.preventDefault());      // (was an inline onsubmit: the CSP forbids those)
    form.addEventListener("change", e => {
        const input = e.target;
        if (!input.name) return;
        if (input.type === "checkbox") { Settings.set(input.name, input.checked); Sound.play("toggle", input.checked); }
        else if (input.type === "range") Settings.set(input.name, Number(input.value) / 100);
        else { Settings.set(input.name, input.value); Sound.play("select"); }
    });
    // About & credits: report a problem with the puzzle you're playing (or go play one first)
    $("#about-report").addEventListener("click", () => {
        if (Game.state.puzzle) Game.openReport();
        else location.hash = "#daily";
    });
    $("#replay-intro").addEventListener("click", () => intro(true));
    // Reset: everything, or just the leaderboard or the campaign (the user, 2026-10-13)
    function eraseAndReload(remove) {
        Game.stopSaving();
        try { remove(); } catch (err) { /* nothing saved */ }
        location.hash = "";
        location.reload();
    }
    $("#reset-data").addEventListener("click", async () => {
        if (!(await U.ask({ title: "Erase All Data?", text: "Your saved progress, daily scores, streaks, achievements and settings. This can't be undone.", yes: "Erase", no: "Cancel" }))) return;
        eraseAndReload(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("schmoll.")) localStorage.removeItem(k); });
    });
    $("#reset-campaign").addEventListener("click", async () => {
        if (!(await U.ask({ title: "Erase Campaign Data?", text: "Your levels, stars, coins, items, abilities, hero and story. Daily scores, streaks and achievements stay. This can't be undone.", yes: "Erase", no: "Cancel" }))) return;
        eraseAndReload(() => {
            // today's Boss attempts are kept, so erasing can't hand out fresh attempts
            const old = U.store.get("campaign", {});
            if (old.specials) U.store.set("campaign", { specials: old.specials }); else U.store.remove("campaign");
            U.store.remove("companions");
            const progress = U.store.get("progress", {});
            for (const slot of Object.keys(progress)) if (slot.startsWith("campaign-") || slot.startsWith("special-")) delete progress[slot];
            U.store.set("progress", progress);
        });
    });
    $("#reset-leaderboard").addEventListener("click", async () => {
        if (!(await U.ask({ title: "Erase Leaderboard Data?", text: "Your name and every score you've posted come off the World Leaderboard, on every day. Your own scores and stats stay on this device.", yes: "Erase", no: "Cancel" }))) return;
        try {
            await Leaderboard.eraseAll();
            FX.toast({ icon: "✓", kicker: "LEADERBOARD", title: "Leaderboard Data Erased", ms: 2600 });
        } catch (err) {
            FX.toast({ icon: "⚠️", kicker: "LEADERBOARD", title: "Not Erased", text: err.message, ms: 3200 });
        }
    });

    // ---------------------------------------------------------------------------------------------
    // Sound: every option (the user, 2026-10-10: the sound button should "open up all the sound options like boss
    // fight music and other sounds"). Built the same way in Settings > Sound and in the sound button's menu; both show
    // the same settings, so changing one moves the other (syncSound).
    //   Sound (everything on or off) and Volume; Level Music (each campaign level's chill song), Boss Music (the boss
    //   fights, the story, winning and losing) and Music Volume (both; the same setting as the sliders in a level and
    //   in a boss fight); Effects Volume, Boss Fight Effects (the bosses' moves
    //   and your abilities), Typing Sounds and Click Sounds.
    // ---------------------------------------------------------------------------------------------
    const SOUND_GROUPS = [
        { key: "all", rows: [["switch", "sound", "All Sound"], ["range", "volume", "Volume"]] },
        { key: "music", head: "Music", rows: [["switch", "levelMusic", "Level Music"], ["switch", "bossMusic", "Boss Music"], ["range", "musicVolume", "Music Volume"]] },
        { key: "fx", head: "Effects", rows: [["range", "fxVolume", "Effects Volume"], ["range", "bossFxVolume", "Boss Fight Effects"], ["switch", "typingSounds", "Typing Sounds"], ["switch", "clickSounds", "Click Sounds"]] }
    ];
    const SOUND_KEYS = new Set(SOUND_GROUPS.flatMap(g => g.rows.map(r => r[1])));
    const soundOn = key => Settings.get(key) !== false;              // the switches (older saves may not have the new ones)
    const level = key => Math.round(U.clamp(Settings.get(key) ?? 1, 0, 1) * 100);
    // a short sound at the new level when a slider is let go, so you hear what you picked
    const PREVIEW = {
        volume: () => Sound.play("word"),
        fxVolume: () => Sound.play("word"),
        bossFxVolume: () => Sound.custom(() => {
            Sound.tone({ f: 196, f2: 98, d: 0.35, v: 0.3, type: "sawtooth", filt: { f: 900 }, boss: true });
            Sound.tone({ t: 0.08, f: 392, f2: 784, d: 0.3, v: 0.12, type: "triangle", boss: true });
        })
    };
    function soundControls(box) {
        box.innerHTML = "";
        for (const g of SOUND_GROUPS) {
            const group = U.el("div", { class: "snd-group", "data-group": g.key }, g.head ? U.el("h3", { class: "snd-head", text: g.head }) : null);
            for (const [kind, key, label] of g.rows) {
                if (kind === "switch") {
                    const input = U.el("input", { type: "checkbox", "data-skey": key });
                    input.addEventListener("change", () => {
                        Settings.set(key, input.checked);
                        Sound.play("toggle", input.checked);
                    });
                    group.appendChild(U.el("label", { class: "switch snd-row" + (key === "sound" ? " snd-master" : "") }, input, U.el("span", { class: "track" }), label));
                } else {
                    const input = U.el("input", { type: "range", min: "0", max: "100", step: "5", "data-skey": key });
                    const out = U.el("output", { "data-sout": key });
                    input.addEventListener("input", () => {
                        Settings.set(key, Number(input.value) / 100);
                        // turning a volume up turns its sound back on
                        if (Number(input.value) > 0 && key === "volume" && !Settings.get("sound")) Settings.set("sound", true);
                        if (Number(input.value) > 0 && key === "musicVolume" && !soundOn("bossMusic") && !soundOn("levelMusic")) { Settings.set("bossMusic", true); Settings.set("levelMusic", true); }
                        syncSound();
                    });
                    input.addEventListener("change", () => { if (PREVIEW[key]) PREVIEW[key](); });
                    const row = U.el("label", { class: "range snd-row" }, U.el("span", { class: "snd-label", text: label }), input, out);
                    // the mouse wheel moves it too
                    row.addEventListener("wheel", e => {
                        e.preventDefault();
                        input.value = U.clamp(Number(input.value) + (e.deltaY < 0 ? 5 : -5), 0, 100);
                        input.dispatchEvent(new Event("input"));
                    }, { passive: false });
                    group.appendChild(row);
                }
            }
            box.appendChild(group);
        }
        syncSound();
    }
    function syncSound() {
        for (const input of document.querySelectorAll("[data-skey]")) {
            const key = input.dataset.skey;
            if (input.type === "checkbox") input.checked = key === "sound" ? !!Settings.get("sound") : soundOn(key);
            else if (document.activeElement !== input) input.value = level(key);
        }
        for (const out of document.querySelectorAll("[data-sout]")) out.textContent = level(out.dataset.sout) + "%";
        // with all sound off the rest is dimmed (still changeable); the music volume dims with the music off
        for (const g of document.querySelectorAll(".snd-group")) g.classList.toggle("dim", g.dataset.group !== "all" && !Settings.get("sound"));
        for (const r of document.querySelectorAll('[data-skey="musicVolume"]')) r.closest(".snd-row").classList.toggle("dim", !soundOn("bossMusic") && !soundOn("levelMusic"));
    }
    soundControls($("#sound-controls"));
    soundControls($("#sound-pop-controls"));
    Settings.on(key => { if (SOUND_KEYS.has(key)) syncSound(); });

    // ---------------------------------------------------------------------------------------------
    // The top bar: How to Play (howto.js), the world menu and the sound menu, right after Settings
    // ---------------------------------------------------------------------------------------------
    function drawTools() {
        $("#sound-toggle").classList.toggle("off", !Settings.get("sound"));
        $("#sound-toggle").title = Settings.get("sound") ? "Sound" : "Sound: Off";
    }
    // a menu that opens under its button; only one is open at a time, and a click elsewhere or Escape closes it
    const pops = [];
    function closePops() { for (const p of pops) p.set(false); }
    function popMenu(btn, pop, onOpen) {
        const set = open => { pop.hidden = !open; btn.setAttribute("aria-expanded", String(open)); };
        pops.push({ set, pop });
        btn.addEventListener("click", e => {
            e.stopPropagation();
            const open = pop.hidden;
            closePops();
            set(open);
            if (open) { if (onOpen) onOpen(); Sound.play("select"); }
        });
        document.addEventListener("pointerdown", e => { if (!pop.hidden && !pop.contains(e.target) && !btn.contains(e.target)) set(false); });
        addEventListener("keydown", e => { if (e.key === "Escape" && !pop.hidden) { e.stopPropagation(); set(false); btn.focus({ preventScroll: true }); } }, true);
        return set;
    }
    const pop = $("#world-pop");
    popMenu($("#world-toggle"), pop, () => worldCards($("#world-pop-cards"), { compact: true }));
    popMenu($("#sound-toggle"), $("#sound-pop"), syncSound);
    pop.addEventListener("click", e => { if (e.target.closest(".world-card")) closePops(); });
    // Light / dark, right in the world menu (the same setting as Settings > Mode)
    const drawPopMode = () => pop.querySelectorAll(".pop-mode button").forEach(b => {
        const on = b.dataset.mode === Settings.get("theme");
        b.classList.toggle("active", on);
        b.setAttribute("aria-pressed", String(on));
    });
    pop.querySelectorAll(".pop-mode button").forEach(b => b.addEventListener("click", () => {
        if (Settings.get("theme") === b.dataset.mode) return;
        Settings.set("theme", b.dataset.mode);
        Sound.play("toggle", b.dataset.mode === "dark");
        worldCards($("#world-pop-cards"), { compact: true });     // the previews show the new mode
    }));
    drawPopMode();
    Settings.on(key => { if (key === "theme") drawPopMode(); });
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
    // The start-up intro. It plays the very first time someone opens the game, in every world, Classic included; after
    // that only when the "Play Intro on Open" setting is on (off by default; the user, 2026-10-09). "Reduce motion"
    // skips it, and Settings can replay it.
    //   1. PRESS START, over the live world scene: letter tiles float up past you, rays turn slowly, the 15 bosses
    //      parade along the bottom, and a ticker scrolls under them (no world emoji: the user's request).
    //   2. A shockwave, a crossword grid draws itself across the screen, and the logo builds itself out of tiles
    //      (each one landing with a puff), then a shine sweeps across it.
    //   3. The logo holds a moment, and the current world adds its own flourish before its screen transition
    //      takes you in.
    // ---------------------------------------------------------------------------------------------
    const LOGO = [];
    [..."SCHMOLL"].forEach((ch, i) => LOGO.push({ ch, r: 0, c: i }));
    [..."ROSSWORD"].forEach((ch, i) => LOGO.push({ ch, r: i + 1, c: 1 }));      // CROSSWORD goes down from SCHMOLL's C
    const TICKER = ["Five New Puzzles Every Day", "15 Worlds to Explore", "15 Bosses to Race", "A Brand New Puzzle Every Time", "Streaks, Stats and Achievements", "Free. No Ads."];

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
        // the very first visit always gets the intro; after that only with the "Play Intro on Open" setting (off by default)
        const firstVisit = !U.store.get("introSeen", false);
        if (!force && ((!firstVisit && !Settings.get("intro")) || U.motion() === "still")) { box.hidden = true; return false; }
        U.store.set("introSeen", true);
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
            </div>
            <div class="intro-bosses" aria-hidden="true">${typeof Bosses !== "undefined" ? Bosses.list.map((w, i) => `<span class="ib" style="--i:${i}">${Bosses.svg(w)}</span>`).join("") : ""}</div>
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
        const parade = box.querySelector(".intro-bosses");
        if (parade) { parade.classList.add("leave"); setTimeout(() => parade.remove(), 600); }
        box.insertAdjacentHTML("beforeend", sketchGrid() + `
            <div class="intro-stage">
                <div class="intro-logo" aria-label="Schmoll Crossword"></div>
            </div>`);
        const logo = box.querySelector(".intro-logo"), stage = box.querySelector(".intro-stage");
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
            await pause(1100);                          // just the logo (the user: no line of text under it)
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
