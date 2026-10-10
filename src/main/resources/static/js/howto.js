// How to Play (built by Claude at the user's request, 2026-10-10): a short guide in two parts, Normal and Boss Fights.
//
//   HowTo.open("normal" | "boss")
//
// Opened from the ? in the top bar, the campaign map and a boss's level sheet. Plain text only (textContent).

const HowTo = (() => {
    const NORMAL = [
        ["The Goal", "Fill the grid so every Across and Down answer is right. A clue's number shows where its answer starts."],
        ["Moving Around", "Click a square to select it. Click it again, or press Space, to switch between Across and Down. The arrow keys move, Tab and Enter jump to the next clue, and Backspace deletes. Clicking a clue jumps to its answer."],
        ["On a Phone", "Use the keyboard under the board. ⇄ switches between Across and Down, and the arrows beside the clue step through the clues."],
        ["Check and Reveal", "Check a square, a word or the whole puzzle: wrong letters turn red and right ones lock. Reveal fills letters in. Check costs 5 points a square and Reveal 10. Revealing the whole puzzle counts as giving up."],
        ["Five Dailies", "Easy, Medium, Hard, a bigger Challenge grid and the Boss. Everyone gets the same puzzles, and they change at your midnight. Solve any one of them to keep your streak."],
        ["Points", "Easy 100, Medium 150, Hard 200 and Challenge 300, plus a speed bonus that shrinks every minute. Only your first solve of each daily counts. Unlimited is for practice, so it has no points."],
        ["World Leaderboard", "Post your day's total under your first name and last initial. The server works out the points itself."],
        ["The Campaign", "Fifteen worlds with five levels each. Every level practises a skill and earns up to three stars, and the fifth is a boss. Coins buy items and ability uses in the shop."],
        ["Worlds", "Pick a world in Settings or with the globe. Each one has its own look, sounds and animations, in light and dark."],
    ];
    const BOSS = [
        ["The Race", "You and the boss each get a board. Finish yours first to win. If the boss finishes its board first, you lose. The bar at the top shows who's ahead."],
        ["Phases", "Later bosses have more than one phase. Finish a board and the next, bigger one starts right away."],
        ["Attacks", "Every so often the boss winds up an attack. The warning box under the bar shows its name and a countdown. Finish any right word before it runs out to block it."],
        ["Fighting Back", "Some attacks put a target somewhere on the screen. Click it to turn the attack on the boss. If an attack lands, the warning box says how to undo it."],
        ["Lost Letters", "Squares the boss erases or changes get a ✕ or ⇄ mark. Click one to put your letter back."],
        ["Abilities", "Keys 1, 2 and 3. In the campaign, equip any three you've unlocked, on the boss's sheet or in the shop. Each use costs one, and coins buy more."],
        ["Close Calls", "When the boss is 85% done, the screen turns red and the warning box says so. Get far ahead and it gets angry: faster, with more attacks."],
        ["Stars", "One star for winning, two if the boss stayed under 85%, and three if it stayed under 60%."],
        ["The Boss on Daily", "Today's boss and the fifth daily. A win scores 250 plus 50 a star, minus Check and Reveal. Every earlier attempt takes 40 off, and your best of the day is kept."],
        ["The Boss on Unlimited", "A random boss. Rematch keeps the same boss and puzzle, and every earlier attempt takes 5 coins off a win. New Boss picks another one and counts as an Unlimited puzzle."],
        ["Their Abilities", "On Daily and Unlimited you get the boss's own world's three abilities, with 3 uses each, every attempt. There are no items, but Check and Reveal work."],
        ["Items", "In the campaign, shop items help out: Letter Reveal, Word Reveal, Clear Wrong, Lock Right and Time Stop, which freezes the boss in a fight. Campaign bosses have no Check or Reveal."],
    ];
    const TABS = [["normal", "Normal", NORMAL], ["boss", "Boss Fights", BOSS]];

    function open(tab = "normal") {
        if (document.querySelector("#overlay .howto-page")) return;
        const modal = U.el("div", { class: "results shop-page howto-page", role: "dialog", "aria-modal": "true", "aria-labelledby": "howto-title" });
        const card = U.el("div", { class: "shop-card howto-card" });
        modal.appendChild(card);
        const close = () => { modal.classList.remove("in"); modal.classList.add("out"); setTimeout(() => modal.remove(), 300); };
        const draw = () => {
            card.innerHTML = "";
            const tabs = U.el("div", { class: "shop-tabs", role: "tablist" }, ...TABS.map(([id, text]) => U.el("button", { type: "button", role: "tab", class: "shop-tab" + (tab === id ? " on" : ""), "aria-selected": tab === id ? "true" : "false", text,
                onclick: () => { tab = id; Sound.play("select"); draw(); card.querySelector(".shop-tab.on").focus({ preventScroll: true }); } })));
            card.append(U.el("div", { class: "shop-head" },
                U.el("div", { class: "shop-title" }, U.el("h2", { id: "howto-title", text: "How to Play" })),
                U.el("button", { type: "button", class: "btn ghost small", text: "Close", onclick: close })), tabs);
            const grid = U.el("div", { class: "ht-grid" });
            for (const [title, text] of TABS.find(t => t[0] === tab)[2]) grid.appendChild(U.el("section", { class: "ht-item" }, U.el("h3", { text: title }), U.el("p", { text })));
            card.appendChild(U.el("div", { class: "shop-scroll" }, grid));
        };
        draw();
        modal.addEventListener("pointerdown", e => { if (e.target === modal) close(); });
        modal.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Escape") close(); });   // (typing here never reaches the board)
        document.getElementById("overlay").appendChild(modal);
        requestAnimationFrame(() => { modal.classList.add("in"); const b = modal.querySelector(".shop-tab.on"); if (b) b.focus({ preventScroll: true }); });
        Sound.play("select");
    }

    document.getElementById("howto-btn").addEventListener("click", e => { e.currentTarget.blur(); open(U.view() === "level" && typeof Campaign !== "undefined" && Campaign.playing && Campaign.playing.level === 5 ? "boss" : "normal"); });
    return { open };
})();
