// The sound board for /demo/sounds.html: each row plays a sound's recordings (audio/sfx/rec/) one take after another
const ROWS = [
    ["Typing", "tap", 5, "Every world without its own material"],
    ["Typing: wood", "wood", 5, "Notebook, Garden, Acorn Woods, Haunted Library, Desert"],
    ["Typing: snow", "snow", 5, "Snow Day"],
    ["Typing: metal", "metal", 5, "Robot Factory, Deep Space (and a finished word in the Robot Factory)"],
    ["Typing: candy clack", "clack", 5, "Candy Hills, Big Top Carnival; also a right letter and a pop"],
    ["Typing: underwater", "soft", 5, "Coral Reef"],
    ["Menu click", "click", 4, "Buttons"],
    ["Switch", "switch", 4, "Toggles and Pencil"],
    ["Hover blip", "roll", 3, ""],
    ["Page change", "slide", 4, "Changing screens; dealing the squares"],
    ["Flip", "place", 2, ""],
    ["Word finished", "stack", 6, ""],
    ["Wrong", "thud", 3, "A wrong check"],
    ["Reveal and title card", "fan", 1, ""],
    ["Coins", "coins", 1, ""],
    ["Sparkle", "glass", 5, "Played three at once, higher"],
    ["Achievement and streak", "bell", 2, "With chips"],
    ["Win", "handle", 2, "With the bell"],
    ["Changing worlds", "cloth", 1, ""]
];
const board = document.getElementById("board");
for (const [title, group, n, note] of ROWS) {
    const row = document.createElement("p");
    const b = document.createElement("button");
    b.type = "button"; b.className = "dx-btn"; b.textContent = title;
    let i = 0;
    b.addEventListener("click", () => { new Audio(`/audio/sfx/rec/${group}${(i % n) + 1}.mp3`).play(); i++; });
    const s = document.createElement("span"); s.textContent = note ? "  " + note : "";
    row.append(b, s);
    board.appendChild(row);
}
