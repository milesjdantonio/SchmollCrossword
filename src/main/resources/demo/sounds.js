// The sound board for /demo/sounds.html: each row plays a sound's takes (audio/sfx/ui/) one after another
const ROWS = [
    ["Typing", "click", 5, "Every world (the Neon Arcade keeps its chiptune)"],
    ["Erasing", "back", 4, ""],
    ["Menu click", "select", 5, "Buttons"],
    ["Changing screens", "switch", 4, ""],
    ["Toggle", "toggle", 4, "Switches and Pencil"],
    ["Tick", "tick", 3, "Hover, dealing the squares"],
    ["Flip", "pluck", 2, ""],
    ["Word finished", "confirm", 4, "Also achievements and the win"],
    ["Right", "maximize", 4, "A right check, a streak"],
    ["Wrong", "error", 4, ""],
    ["Reveal and title card", "open", 4, ""],
    ["Coins and sparkle", "glass", 5, "Sparkles play three at once, higher"],
    ["Pop", "drop", 4, ""],
    ["Thud", "minimize", 4, ""],
    ["Changing worlds", "scroll", 4, ""]
];
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
