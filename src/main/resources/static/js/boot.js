// Runs in the page's <head>, before anything is drawn (an external file, so the Content-Security-Policy can forbid
// inline scripts: see SecurityHeaders.java).
// A fresh start, once per browser (the user, 2026-10-10: "reset my stats" after the testing builds): every score,
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

// Apply the saved world and mode before the page is drawn, so nothing flashes
try {
    const s = JSON.parse(localStorage.getItem("schmoll.settings")) || {};
    const world = { classic: "classic", paper: "paper", space: "space", garden: "garden", arcade: "arcade", snow: "snow", squirrel: "squirrel", ocean: "ocean", candy: "candy", library: "library", volcano: "volcano", sky: "sky", desert: "desert", robot: "robot", carnival: "carnival", rain: "rain" }[s.design] || "classic";
    document.documentElement.dataset.world = world;
    document.documentElement.dataset.theme = s.theme === "dark" ? "dark" : "light";   // every world has both modes
} catch (err) { /* storage blocked: the Notebook world, light */ }
