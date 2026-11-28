// The sound board for /demo/sounds.html: each row plays a sound's takes (audio/sfx/ui/) one after another
const ROWS = [
    ["Typing", "click", 5, "Every world (the Neon Arcade keeps its chiptune)"],
    ["Erasing", "back", 4, ""],
    ["Tick", "tick", 3, "Dealing the squares"],
    ["Flip", "pluck", 2, ""],
    ["Word finished", "confirm", 4, "Also achievements and the win"],
    ["Right", "maximize", 4, "A right check, a streak"],
    ["Wrong", "error", 4, ""],
    ["Reveal and title card", "open", 4, ""],
    ["Coins and sparkle", "glass", 5, "Sparkles play three at once, higher"],
    ["Pop", "drop", 4, ""],
    ["Thud", "minimize", 4, ""],
    ["Pop", "drop", 4, ""]
].filter((r, i, a) => a.findIndex(x => x[1] === r[1]) === i);   // (menu clicks and each world's sound are played by the game itself: try them there)
const board = document.getElementById("board");
for (const [title, group, n, note] of ROWS) {
    const row = document.createElement("p");
    const b = document.createElement("button");
    b.type = "button"; b.className = "dx-btn"; b.textContent = title;
    let i = 0;
    b.addEventListener("click", () => { new Audio(`/audio/sfx/ui/${group}${(i % n) + 1}.mp3`).play(); i++; });
    const s = document.createElement("span"); s.textContent = note ? "  " + note : "";
    row.append(b, s);
    board.appendChild(row);
}
