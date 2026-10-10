// Runs in the page's <head>, before anything is drawn (an external file, so the Content-Security-Policy can forbid
// inline scripts: see SecurityHeaders.java).
// Apply the saved world and mode before the page is drawn, so nothing flashes
try {
    const s = JSON.parse(localStorage.getItem("schmoll.settings")) || {};
    const world = { classic: "classic", paper: "paper", space: "space", garden: "garden", arcade: "arcade", snow: "snow", squirrel: "squirrel", ocean: "ocean", candy: "candy", library: "library", volcano: "volcano", sky: "sky", desert: "desert", robot: "robot", carnival: "carnival", rain: "rain" }[s.design] || "classic";
    document.documentElement.dataset.world = world;
    document.documentElement.dataset.theme = s.theme === "dark" ? "dark" : "light";   // every world has both modes
} catch (err) { /* storage blocked: the Notebook world, light */ }
