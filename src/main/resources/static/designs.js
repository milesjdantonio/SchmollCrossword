// Designs (see DESIGN.md): a design is a whole look. Its colors live in style.css
// (:root[data-design="name"]); its decorations and animations live in a small module registered here.
//
// Every design module may offer these functions (any can be left out):
//   update(game, boardEl)            after every change to the game (letters typed or erased, etc.)
//   wordDone(entry, cells, boardEl)  a word was just filled in
//   celebrate(game, { instant })     the puzzle was solved (instant = coming back to an already-solved puzzle)
//   clear()                          the design was switched off, or a new puzzle started
//
// Adding a design = one CSS block + one JS file that calls Designs.register(...) + a radio button in Settings.

const Designs = (() => {
    const modules = {};
    let active = null;            // the name of the design that's drawing right now
    let puzzleKey = null;         // which puzzle the "finished words" below belong to
    let doneWords = new Set();    // the words that were already full at the last update

    const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

    function register(name, module) {
        modules[name] = module;
    }

    function call(name, fn, ...args) {
        const module = modules[name];
        if (module && typeof module[fn] === "function") module[fn](...args);
    }

    // The squares of an entry, in order
    function cellsOf(entry) {
        const cells = [];
        for (let i = 0; i < entry.length; i++) {
            cells.push(entry.direction === "across" ? [entry.row, entry.col + i] : [entry.row + i, entry.col]);
        }
        return cells;
    }

    // Called by app.js after every render
    function update(game, boardEl, design) {
        if (active !== design) {               // the player switched designs: clean up the old one
            if (active) call(active, "clear");
            active = design;
        }
        if (!game.puzzle) return;

        // A different puzzle: clear the old decorations, and don't treat already-full words as "just finished"
        const key = game.puzzle.mode + ":" + game.puzzle.seed;
        const isNewPuzzle = key !== puzzleKey;
        if (isNewPuzzle) {
            call(active, "clear");
            puzzleKey = key;
        }

        call(active, "update", game, boardEl);

        // Which words are full now? Any that weren't before were just finished.
        const full = new Set();
        const justDone = [];
        for (const entry of [...game.puzzle.across, ...game.puzzle.down]) {
            const cells = cellsOf(entry);
            if (!cells.every(([r, c]) => game.letters[r][c] !== "")) continue;
            const id = entry.direction + entry.number;
            full.add(id);
            if (!isNewPuzzle && !doneWords.has(id)) justDone.push([entry, cells]);
        }
        doneWords = full;
        if (justDone.length && !game.solved) Sound.play("word");
        for (const [entry, cells] of justDone) call(active, "wordDone", entry, cells, boardEl);
    }

    function celebrate(game, options = {}) {
        call(active, "celebrate", game, { instant: !!options.instant || reduceMotion() });
    }

    return { register, update, celebrate, reduceMotion, cellsOf };
})();

// -------------------------------------------------------------------------------------------------
// Classic: paper and pencil. A quick shimmer when a word is finished, paper confetti when you win.
// (The paper texture, letter pops and hand-drawn borders are plain CSS in style.css.)
// -------------------------------------------------------------------------------------------------
Designs.register("classic", (() => {
    const COLORS = ["#e07a3f", "#f2c94c", "#5aa3a0", "#d4607a", "#7b8fd8", "#8bbf6a"];

    function wordDone(entry, cells, boardEl) {
        if (Designs.reduceMotion()) return;
        const size = Math.round(Math.sqrt(boardEl.children.length));
        cells.forEach(([r, c], i) => {
            const cell = boardEl.children[r * size + c];
            if (!cell) return;
            cell.classList.remove("shimmer");
            void cell.offsetWidth;                         // restart the animation if it was already running
            cell.style.setProperty("--delay", i * 60 + "ms");
            cell.classList.add("shimmer");
            setTimeout(() => cell.classList.remove("shimmer"), 900 + i * 60);
        });
    }

    // Paper scraps burst out of the board and flutter down
    function celebrate(game, { instant }) {
        if (instant) return;
        clear();
        const board = document.getElementById("board");
        const box = board.getBoundingClientRect();
        const layer = document.createElement("div");
        layer.className = "confetti-layer";
        layer.setAttribute("aria-hidden", "true");
        const originX = box.left + box.width / 2, originY = box.top + box.height / 3;
        for (let i = 0; i < 90; i++) {
            const bit = document.createElement("span");
            bit.className = "confetti";
            const angle = Math.random() * Math.PI * 2;
            const speed = 180 + Math.random() * 320;
            bit.style.cssText =
                `left:${originX}px; top:${originY}px; background:${COLORS[i % COLORS.length]};` +
                `--dx:${(Math.cos(angle) * speed).toFixed(0)}px; --dy:${(Math.sin(angle) * speed - 200).toFixed(0)}px;` +
                `--fall:${(window.innerHeight * (0.6 + Math.random() * 0.5)).toFixed(0)}px;` +
                `--spin:${(Math.random() * 1080 - 540).toFixed(0)}deg; --w:${6 + Math.random() * 8}px;` +
                `animation-delay:${(Math.random() * 0.15).toFixed(2)}s; animation-duration:${(2.2 + Math.random() * 1.6).toFixed(2)}s;`;
            layer.appendChild(bit);
        }
        document.body.appendChild(layer);
        board.classList.add("bounce");
        setTimeout(() => board.classList.remove("bounce"), 900);
        setTimeout(() => layer.remove(), 4500);
    }

    function clear() {
        document.querySelectorAll(".confetti-layer").forEach(n => n.remove());
    }

    return { wordDone, celebrate, clear };
})());
