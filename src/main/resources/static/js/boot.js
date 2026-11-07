// Runs in the page's <head>, before anything is drawn (an external file, so the Content-Security-Policy can forbid
// inline scripts: see SecurityHeaders.java).
//
// Everything the game keeps in the browser (localStorage, all JSON, all under "schmoll."):
//   settings       Settings in util.js: difficulty, world, light/dark, sound levels, zoom...
//   progress       game.js: each puzzle slot's puzzle and game in progress ("daily-easy", "campaign-garden-3"...)
//   dailyScores    game.js: finished dailies, "20261107-easy" -> { points, seconds, checked, revealed, ticket... }
//   achievements   achievements.js: unlocked ones and the counts behind them
//   campaign       campaign.js: levels, stars, coins, items, abilities, the hero, story flags, Daily Boss attempts
//   companions     companions.js: how far each mascot's story has got
//   rift           corruption.js: a Celestial Rift corruption level in progress
//   leaderboard    leaderboard.js: your name and which dailies were posted;  player: your random leaderboard id
//   introSeen, restoreTip, arcade.hi, fresh, noUnlimited: small flags
// "schmoll-damaged.<name>" holds a save that couldn't be read (below). sessionStorage: schmoll.noticeSeen (the
// update page) and schmoll.adminKey (admin.html). Nothing is ever sent to the server except leaderboard posts.
// A fresh start, once per browser: every score,
// streak, saved game, achievement and the campaign go; settings, the intro and your leaderboard name stay.
// (Raise FRESH to wipe everyone's stats again; a brand-new player has nothing to wipe.)
try {
    const FRESH = "1", KEEP = ["schmoll.settings", "schmoll.introSeen", "schmoll.player", "schmoll.fresh"];
    if (localStorage.getItem("schmoll.fresh") !== FRESH) {
        for (const k of Object.keys(localStorage)) {
            if (!k.startsWith("schmoll.") || KEEP.includes(k)) continue;
            if (k === "schmoll.leaderboard") {                       // keep the name, forget what was posted
                const n = JSON.parse(localStorage.getItem(k)) || {};
                localStorage.setItem(k, JSON.stringify(n.first ? { first: n.first, initial: n.initial } : {}));
            } else localStorage.removeItem(k);
        }
        localStorage.setItem("schmoll.fresh", FRESH);
    }
} catch (err) { /* storage blocked: nothing saved anyway */ }

// Damaged saves: a value that isn't readable (a crash mid-write, an edited save, a browser bug) would stop the game
// from starting, so it's moved aside to "schmoll-damaged.<name>" (kept, not lost) and the game starts that part
// fresh. app.js tells the player which part was reset.
try {
    const OBJECTS = ["settings", "progress", "dailyScores", "achievements", "campaign", "companions", "leaderboard"];
    const damaged = [];
    for (const k of Object.keys(localStorage)) {
        if (!k.startsWith("schmoll.")) continue;
        const raw = localStorage.getItem(k);
        let ok = true;
        try {
            const v = JSON.parse(raw);
            if (OBJECTS.includes(k.slice(8)) && (v === null || typeof v !== "object" || Array.isArray(v))) ok = false;
        } catch (err) { ok = false; }
        if (ok) continue;
        localStorage.setItem("schmoll-damaged." + k.slice(8), raw);
        localStorage.removeItem(k);
        damaged.push(k.slice(8));
    }
    if (damaged.length) window.SCHMOLL_DAMAGED = damaged;
} catch (err) { /* storage blocked: nothing saved anyway */ }

// Older saves can hold Unlimited's puzzle, its counts and achievements, an Unlimited Boss fight and the Allow
// Harder Words setting, a mode the game no longer has. Drop them, once per browser.
try {
    if (localStorage.getItem("schmoll.noUnlimited") !== "1") {
        const edit = (key, fn) => {
            const v = JSON.parse(localStorage.getItem(key) || "null");
            if (v && typeof v === "object") { fn(v); localStorage.setItem(key, JSON.stringify(v)); }
        };
        edit("schmoll.progress", p => { delete p.unlimited; delete p["special-unlimited"]; });
        edit("schmoll.achievements", a => {
            if (a.unlocked) { delete a.unlocked.unlimited10; delete a.unlocked.unlimited50; }
            if (a.counts) delete a.counts.unlimited;
        });
        edit("schmoll.campaign", c => { if (c.playing && c.playing.special === "unlimited") c.playing = c.lastPlaying || null; });
        edit("schmoll.settings", s => { delete s.hardWords; });
        localStorage.setItem("schmoll.noUnlimited", "1");
    }
} catch (err) { /* storage blocked or a damaged save: nothing to clean */ }

// Apply the saved world and mode before the page is drawn, so nothing flashes
try {
    const s = JSON.parse(localStorage.getItem("schmoll.settings")) || {};
    const world = { classic: "classic", paper: "paper", space: "space", garden: "garden", arcade: "arcade", snow: "snow", squirrel: "squirrel", ocean: "ocean", candy: "candy", library: "library", volcano: "volcano", sky: "sky", desert: "desert", robot: "robot", carnival: "carnival", rain: "rain", rift: "rift" }[s.design] || "classic";
    document.documentElement.dataset.world = world;
    document.documentElement.dataset.theme = s.theme === "dark" ? "dark" : "light";   // every world has both modes
} catch (err) { /* storage blocked: the Notebook world, light */ }
