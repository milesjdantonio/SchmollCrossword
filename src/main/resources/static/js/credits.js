// The credits. Settings > Help & Legal > Credits opens a full-screen roll that scrolls up by itself (wheel, drag or keys scroll it too) while the
// background moves through every world, with a calm level song playing (the Level Music slider
// applies). Escape, the Close button or reaching the end closes it and puts the player's own world back.
// Every music credit comes from audio/credits.json (made from audio/CREDITS.txt, so the two always agree).
// Credits.show({ ending: true }) also rolls them after the Cursed Angel's epilogue, the end of the story: worlds only (no boss arenas), it
// resolves when they close, and puts back the world being played instead of the Settings one.
const Credits = (() => {
    const SONG = "level-sky-2";                // Napping On A Cloud by congusbongus (CC0): calm, and it loops
    const WORLD_MS = 6500;                     // how long each world shows behind the roll
    const SPEED = 38;                          // pixels a second
    let open = false;

    const section = (title, ...rows) => U.el("section", { class: "cr-sec" }, U.el("h2", { text: title }), ...rows);
    const line = (role, name) => U.el("p", { class: "cr-line" }, role ? U.el("span", { class: "cr-role", text: role }) : null, U.el("b", { text: name }));
    const note = text => U.el("p", { class: "cr-note", text });
    const link = (text, href) => U.el("a", { href, text, target: "_blank", rel: "noopener" });

    function roll(data) {
        const songs = list => U.el("ul", { class: "cr-songs" }, ...list.map(s => U.el("li", {},
            U.el("b", {}, link(s.title, "https://opengameart.org/content/" + s.page)), U.el("span", { text: s.author + (s.license ? " · " + s.license : "") }))));
        return U.el("div", { class: "cr-roll" },
            U.el("div", { class: "cr-logo", "aria-hidden": "true" }, ..."SCHMOLL".split("").map(ch => U.el("i", { text: ch }))),
            U.el("h1", { class: "cr-title", text: "Schmoll Crossword" }),
            section("Made By", line("Created by", "Miles D'Antonio"),
                line("Assisted by", "Claude, an AI model by Anthropic"),
                note("Claude assisted with the code, worlds, bosses, story and clues.")),
            section("Word List",
                line("SCOWL", "Kevin Atkinson"),
                line("Spread the Word(list)", "Brooke Husic and Enrique Henestroza Anguiano"),
                U.el("p", { class: "cr-note" }, "Adapted and shared under ", link("CC BY-NC-SA 4.0", "https://creativecommons.org/licenses/by-nc-sa/4.0/"), ". The puzzles and clues made from it are shared the same way, so the game stays free and non-commercial. SCOWL's own notice ships with the list.")),
            section("Boss Music", songs(data.boss)),
            section("Level Music", songs(data.level)),
            section("Composed for the Game", ...data.composed.map(t => U.el("p", { class: "cr-line" }, U.el("b", { text: t }))),
                U.el("p", { class: "cr-note" }, "Composed by Claude and played with the ", link("GeneralUser GS", "https://schristiancollins.com/generaluser.php"), " SoundFont by S. Christian Collins.")),
            section("Sound Effects", line("", "Kenney"), note("Impact, Interface, Sci-fi, RPG Audio and Music Jingles packs."),
                note("Most other sounds are made live in code.")),
            section("Fonts", note("Nunito, Caveat, Patrick Hand, Orbitron, Exo 2, Fredoka, Press Start 2P, VT323, Quicksand, Patua One, Baloo 2, Lilita One, IM Fell English SC, Courier Prime, Bungee, Comfortaa, Rye, Russo One, Share Tech Mono, Shrikhand, Pacifico, Josefin Sans and Cinzel."),
                note("All under the SIL Open Font License, served from this site.")),
            section("Licenses",
                U.el("p", { class: "cr-note" }, "Code: MIT License, © 2026 Miles D'Antonio. ", link("Source on GitHub", "https://github.com/milesjdantonio/SchmollCrossword"), "."),
                U.el("p", { class: "cr-note" }, "Word lists, puzzles and clues: ", link("CC BY-NC-SA 4.0", "https://creativecommons.org/licenses/by-nc-sa/4.0/"), ". Fonts: SIL Open Font License."),
                U.el("p", { class: "cr-note" }, "Music and sound effects: public domain (CC0 1.0), except four boss songs under ", link("CC BY 3.0", "https://creativecommons.org/licenses/by/3.0/"), " and one under ", link("CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/"), ", marked above and credited to their authors. Our edited copy of that one is shared under CC BY-SA 4.0 too. Composed music: MIT."),
                note("Schmoll Crossword is an independent project, not affiliated with any newspaper or puzzle publisher.")),
            section("Thank You", note("For playing.")),
            U.el("div", { class: "cr-end" }));
    }

    async function show({ ending: afterStory = false } = {}) {
        if (open) return;
        open = true;
        let closed;
        const finished = new Promise(r => { closed = r; });
        const data = await fetch("audio/credits.json").then(r => r.json()).catch(() => ({ boss: [], level: [], composed: [] }));
        const own = afterStory && Worlds.current ? Worlds.current.id : Settings.get("design");
        const worlds = Worlds.list.filter(w => !w.plain && (!w.secret || (w.id === "rift" ? Campaign.secretEarned() : Campaign.secretOpen(w.id)))).map(w => w.id);      // (no spoilers: only once it's really unlocked)
        const still = U.motion() === "still";
        const stage = U.el("div", { class: "cr-stage", role: "dialog", "aria-modal": "true", "aria-label": "Credits" });
        const scroller = U.el("div", { class: "cr-scroll", tabindex: "-1" });
        const label = U.el("span", { class: "cr-world" });
        const close = U.el("button", { type: "button", class: "btn cr-close", text: "Close" });
        scroller.appendChild(roll(data));
        stage.append(U.el("div", { class: "cr-veil" }), scroller, U.el("div", { class: "cr-bar" }, label, close));
        document.body.appendChild(stage);
        U.dialog.open(stage);
        document.documentElement.classList.add("credits-on");
        const wasAway = Mascot.away;
        Mascot.away = true;
        requestAnimationFrame(() => stage.classList.add("in"));
        scroller.focus();
        Sound.levelSong(SONG, { v: 0.5, fade: 1.5 });

        // behind the roll, in a random order: every world's calm scene, and (from Settings) every boss's arena going
        // wild (its own chaos from a boss's later phase: chaos.js). After the story's end the bosses are beaten, so it's
        // the worlds alone. A shuffled bag, so each one shows once before any repeats.
        const bossScenes = afterStory ? [] : Chaos.worlds.filter(id => Worlds.byId[id] && Bosses.info(id) && (!Worlds.byId[id].secret || Campaign.secretEarned())).map(id => ({ id, boss: true }));
        const scenes = [...worlds.map(id => ({ id })), ...bossScenes];
        let bag = [], shown = null;
        const draw = () => {
            if (!bag.length) bag = scenes.slice().sort(() => Math.random() - 0.5);
            let s = bag.pop();
            if (shown && s.id === shown.id && s.boss === shown.boss && bag.length) { bag.unshift(s); s = bag.pop(); }
            return s;
        };
        const arenaOff = () => { const a = document.getElementById("boss-arena"); if (a) { Bosses.chaos(a.dataset.world, 0); a.classList.remove("cr-show", "phase2", "enraged"); } };
        const nextWorld = () => {
            const s = shown = draw();
            Worlds.use(s.id);
            if (s.boss) {
                const a = Bosses.arena(s.id, "credits-" + s.id);
                a.classList.add("cr-show", "phase2");
                Bosses.chaos(s.id, 4, { showcase: true });          // the wildest it gets, and every one of its set pieces
            } else arenaOff();
            label.textContent = s.boss ? `${Bosses.info(s.id).name} · ${Worlds.byId[s.id].name}` : Worlds.byId[s.id].name;
            label.classList.remove("in"); void label.offsetWidth; label.classList.add("in");
        };
        arenaOff();
        nextWorld();
        const worldTimer = still ? 0 : setInterval(nextWorld, WORLD_MS);

        // the roll scrolls itself; a wheel, drag, touch or key takes over for a moment, then it carries on from where
        // the player left it. Only real input pauses it (a world change used to shift the text, which looked like the
        // player scrolling, so it stopped for a moment at every new world).
        let raf = 0, last = performance.now(), pausedUntil = 0, pos = 0, ending = false;
        const hold = () => { pausedUntil = performance.now() + 2500; };
        const step = now => {
            raf = requestAnimationFrame(step);
            const dt = Math.min(0.25, Math.max(0, (now - last) / 1000)); last = now;     // a slow frame catches up instead of stalling
            if (now < pausedUntil) { pos = scroller.scrollTop; return; }
            pos += SPEED * dt;
            scroller.scrollTop = pos;
            if (!ending && pos >= scroller.scrollHeight - scroller.clientHeight - 2) { ending = true; cancelAnimationFrame(raf); setTimeout(() => { if (open) done(); }, 4000); }
        };
        if (!still) raf = requestAnimationFrame(step);
        scroller.addEventListener("wheel", hold, { passive: true });
        scroller.addEventListener("pointerdown", hold);
        scroller.addEventListener("touchmove", hold, { passive: true });
        const onKey = e => {
            if (e.key === "Escape") { if (!U.dialog.top(stage)) return; e.preventDefault(); done(); }
            else if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", " ", "Home", "End"].includes(e.key)) hold();
        };
        addEventListener("keydown", onKey, true);
        addEventListener("hashchange", done);                 // Back, or any link: the credits close with the page change

        function done() {
            if (!open) return;
            open = false;
            cancelAnimationFrame(raf);
            clearInterval(worldTimer);
            removeEventListener("keydown", onKey, true);
            removeEventListener("hashchange", done);
            Sound.levelSong(null, { fade: 1.2 });
            arenaOff();
            stage.classList.remove("in");
            U.dialog.close(stage);
            document.documentElement.classList.remove("credits-on");
            Worlds.use(afterStory ? own : Settings.get("design") || own);
            Mascot.away = wasAway;
            setTimeout(() => { stage.remove(); closed(); }, 500);
        }
        close.addEventListener("click", done);
        return finished;
    }

    // opened from Settings > Help & Legal, with FAQ, Privacy and Terms
    for (const b of document.querySelectorAll(".help-legal [data-open]")) {
        b.addEventListener("click", () => { b.blur(); Sound.play("select"); if (b.dataset.open === "credits") show(); else Legal.open(b.dataset.open); });
    }
    return { show };
})();
