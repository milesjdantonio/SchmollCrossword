// Schmoll Crossword: draws today's puzzle from the server (Step 19) and lets you play it (Step 20).

const statusEl = document.getElementById("status");
const puzzleEl = document.getElementById("puzzle");
const boardEl = document.getElementById("board");
const acrossEl = document.getElementById("across-clues");
const downEl = document.getElementById("down-clues");
const clueBarEl = document.getElementById("clue-bar");
const timerEl = document.getElementById("timer");
const winEl = document.getElementById("win");
const winDetailsEl = document.getElementById("win-details");
const pointsTodayEl = document.getElementById("points-today");

document.getElementById("puzzle-date").textContent =
    new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

// ---------------------------------------------------------------------------------------------
// Game state: everything about the current game lives here
// ---------------------------------------------------------------------------------------------
const game = {
    puzzle: null,        // the JSON from the server
    letters: [],         // what the player typed: letters[row][col] ("" = empty)
    row: 0,              // the selected square
    col: 0,
    direction: "across", // "across" or "down"
    acrossAt: [],        // acrossAt[row][col] = the Across entry covering that square (or null)
    downAt: [],          // downAt[row][col]   = the Down entry covering that square (or null)
    cells: [],           // cells[row][col]    = the square's <div> on the page
    clueItems: new Map(),// entry -> its <li> in the clue lists
    seconds: 0,          // the timer (Step 21)
    solved: false,       // true once every square is right
    checksUsed: 0,       // for the score (Step 22 adds Check/Reveal)
    revealsUsed: 0
};

// ---------------------------------------------------------------------------------------------
// Daily scores, saved in this browser: { "20261007": { date, difficulty, seconds, points }, ... }
// Keyed by the daily's seed, which is made from its date, so each daily puzzle has one entry.
// ---------------------------------------------------------------------------------------------
const SCORES_KEY = "schmoll.dailyScores";

function loadDailyScores() {
    try {
        return JSON.parse(localStorage.getItem(SCORES_KEY)) || {};
    } catch (err) {
        return {};   // storage blocked or unreadable: act as if nothing is saved
    }
}

function saveDailyScore(puzzle, points) {
    const scores = loadDailyScores();
    if (scores[puzzle.seed]) return false;   // already completed today (at any difficulty): no extra points
    scores[puzzle.seed] = {
        date: new Date().toISOString().slice(0, 10),
        difficulty: puzzle.difficulty,
        seconds: game.seconds,
        points: points
    };
    try {
        localStorage.setItem(SCORES_KEY, JSON.stringify(scores));
    } catch (err) {
        // storage blocked (e.g. private mode): the score just isn't remembered
    }
    return true;
}

// ---------------------------------------------------------------------------------------------
// Timer: counts up once a second while the page is visible and the puzzle isn't solved
// ---------------------------------------------------------------------------------------------
setInterval(() => {
    if (!game.puzzle || game.solved || document.hidden || puzzleEl.hidden) return;
    game.seconds++;
    drawTimer();
}, 1000);

function drawTimer() {
    const minutes = Math.floor(game.seconds / 60);
    const seconds = String(game.seconds % 60).padStart(2, "0");
    timerEl.textContent = minutes + ":" + seconds;
}

// Ask the server for today's puzzle at a difficulty, then draw it
async function loadPuzzle(difficulty) {
    statusEl.textContent = "Loading today's " + difficulty + " puzzle… (the first one of the day takes a few seconds)";
    statusEl.classList.remove("error");
    statusEl.hidden = false;
    puzzleEl.hidden = true;

    try {
        const response = await fetch("/api/daily?difficulty=" + encodeURIComponent(difficulty));
        if (!response.ok) {
            throw new Error("The server answered " + response.status);
        }
        const puzzle = await response.json();   // the JSON from Puzzle.toJson()
        startGame(puzzle);
        statusEl.hidden = true;
        puzzleEl.hidden = false;
    } catch (err) {
        statusEl.textContent = "Couldn't load the puzzle: " + err.message;
        statusEl.classList.add("error");
    }
}

function startGame(puzzle) {
    // Same grid as before (only the difficulty changed)? Keep what the player typed.
    const sameGrid = game.puzzle && game.puzzle.seed === puzzle.seed && game.puzzle.mode === puzzle.mode;
    game.puzzle = puzzle;
    if (!sameGrid) {
        game.letters = puzzle.solution.map(row => Array.from(row, () => ""));
        game.seconds = 0;
        game.solved = false;
        game.checksUsed = 0;
        game.revealsUsed = 0;
        winEl.hidden = true;
        boardEl.classList.remove("solved");
    }
    drawTimer();
    drawPointsToday();
    indexEntries(puzzle);
    drawBoard(puzzle);
    drawClues(puzzle);

    if (!sameGrid) {
        const first = puzzle.across[0];
        game.row = first.row;
        game.col = first.col;
        game.direction = "across";
    }
    render();
}

// For every square, remember which Across and Down entry it belongs to
function indexEntries(puzzle) {
    const empty = () => puzzle.solution.map(row => Array.from(row, () => null));
    game.acrossAt = empty();
    game.downAt = empty();
    for (const e of puzzle.across) {
        for (let i = 0; i < e.length; i++) game.acrossAt[e.row][e.col + i] = e;
    }
    for (const e of puzzle.down) {
        for (let i = 0; i < e.length; i++) game.downAt[e.row + i][e.col] = e;
    }
}

// ---------------------------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------------------------

// One <div> per square. "." in a solution row = black square.
function drawBoard(puzzle) {
    boardEl.innerHTML = "";
    boardEl.style.setProperty("--size", puzzle.size);
    boardEl.classList.toggle("solved", game.solved);
    game.cells = [];
    for (let row = 0; row < puzzle.size; row++) {
        game.cells.push([]);
        for (let col = 0; col < puzzle.size; col++) {
            const cell = document.createElement("div");
            cell.className = "cell";
            if (isBlock(row, col)) {
                cell.classList.add("block");
            } else {
                const number = puzzle.numbers[row][col];
                if (number > 0) {
                    const label = document.createElement("span");
                    label.className = "number";
                    label.textContent = number;
                    cell.appendChild(label);
                }
                const letter = document.createElement("span");
                letter.className = "letter";
                cell.appendChild(letter);
                cell.addEventListener("click", () => clickCell(row, col));
            }
            boardEl.appendChild(cell);
            game.cells[row].push(cell);
        }
    }
}

// "1  Smell like gym socks" for each entry; clicking a clue jumps to its word
function drawClues(puzzle) {
    game.clueItems = new Map();
    fillClueList(acrossEl, puzzle.across);
    fillClueList(downEl, puzzle.down);
}

function fillClueList(listEl, entries) {
    listEl.innerHTML = "";
    for (const entry of entries) {
        const item = document.createElement("li");
        const number = document.createElement("span");
        number.className = "clue-number";
        number.textContent = entry.number;
        const text = document.createElement("span");
        text.textContent = entry.clue;   // textContent (not innerHTML), so clue text can never inject HTML
        item.append(number, text);
        item.addEventListener("click", () => selectEntry(entry));
        listEl.appendChild(item);
        game.clueItems.set(entry, item);
    }
}

// Update the page to match the game state: letters, highlights, the current clue
function render() {
    const current = currentEntry();
    const size = game.puzzle.size;
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            if (isBlock(row, col)) continue;
            const cell = game.cells[row][col];
            cell.querySelector(".letter").textContent = game.letters[row][col];
            cell.classList.toggle("in-word", current !== null && entryCovers(current, row, col));
            cell.classList.toggle("selected", row === game.row && col === game.col);
        }
    }
    for (const [entry, item] of game.clueItems) {
        item.classList.toggle("active", entry === current);
    }
    if (current) {
        clueBarEl.textContent = "";
        const label = document.createElement("strong");
        label.textContent = current.number + (current.direction === "across" ? "A" : "D");
        clueBarEl.append(label, " " + current.clue);
    }
}

// "Today's daily: 240 pts (medium) · Streak 3 days (best 5)"
function drawPointsToday() {
    const puzzle = game.puzzle;
    const scores = loadDailyScores();
    const record = puzzle && puzzle.mode === "daily" ? scores[puzzle.seed] : null;
    const streaks = calculateStreaks(scores);
    const parts = [];
    if (record) parts.push("Today's daily: " + record.points + " pts (" + record.difficulty + ")");
    if (streaks.best > 0) {
        parts.push("Streak " + streaks.current + (streaks.current === 1 ? " day" : " days") + " (best " + streaks.best + ")");
    }
    pointsTodayEl.textContent = parts.join(" · ");
}

// ---------------------------------------------------------------------------------------------
// Win detection (Step 21)
// ---------------------------------------------------------------------------------------------

// Solved = every open square matches the solution
function isSolved() {
    const size = game.puzzle.size;
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            if (isBlock(row, col)) continue;
            if (game.letters[row][col] !== game.puzzle.solution[row][col]) return false;
        }
    }
    return true;
}

function checkForWin() {
    if (game.solved || !isSolved()) return;
    game.solved = true;
    boardEl.classList.add("solved");
    const time = timerEl.textContent;
    const puzzle = game.puzzle;

    if (puzzle.mode !== "daily") {
        winDetailsEl.textContent = "Time: " + time + ". Unlimited puzzles don't earn points.";
    } else {
        const points = calculateScore(puzzle.difficulty, game.seconds, game.checksUsed, game.revealsUsed);
        const counted = saveDailyScore(puzzle, points);
        winDetailsEl.textContent = counted
            ? "Time: " + time + " · " + points + " points for today's daily (" + puzzle.difficulty + ")."
            : "Time: " + time + ". Today's daily was already completed, so no extra points.";
    }
    winEl.hidden = false;
    drawPointsToday();
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

function isBlock(row, col) {
    return game.puzzle.solution[row][col] === ".";
}

function inGrid(row, col) {
    return row >= 0 && col >= 0 && row < game.puzzle.size && col < game.puzzle.size;
}

// The entry the cursor is in, in the current direction (falls back to the other direction)
function currentEntry() {
    const across = game.acrossAt[game.row][game.col];
    const down = game.downAt[game.row][game.col];
    if (game.direction === "across") return across || down;
    return down || across;
}

function entryCovers(entry, row, col) {
    if (entry.direction === "across") return row === entry.row && col >= entry.col && col < entry.col + entry.length;
    return col === entry.col && row >= entry.row && row < entry.row + entry.length;
}

// The squares of an entry, in order: [[row, col], ...]
function entryCells(entry) {
    const cells = [];
    for (let i = 0; i < entry.length; i++) {
        cells.push(entry.direction === "across" ? [entry.row, entry.col + i] : [entry.row + i, entry.col]);
    }
    return cells;
}

// All entries in clue order: 1A, 5A, ... then 1D, 2D, ...
function allEntries() {
    return [...game.puzzle.across, ...game.puzzle.down];
}

// ---------------------------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------------------------

function clickCell(row, col) {
    if (row === game.row && col === game.col) {
        toggleDirection();             // clicking the selected square again flips Across/Down
    } else {
        game.row = row;
        game.col = col;
        // keep the direction if this square has a word that way; otherwise switch
        if (game.direction === "across" && !game.acrossAt[row][col]) game.direction = "down";
        if (game.direction === "down" && !game.downAt[row][col]) game.direction = "across";
    }
    render();
}

function toggleDirection() {
    const other = game.direction === "across" ? "down" : "across";
    const otherAt = other === "across" ? game.acrossAt : game.downAt;
    if (otherAt[game.row][game.col]) game.direction = other;
    render();
}

// Jump to an entry: its first empty square, or its first square if it's full
function selectEntry(entry) {
    const cells = entryCells(entry);
    const firstEmpty = cells.find(([r, c]) => game.letters[r][c] === "") || cells[0];
    game.row = firstEmpty[0];
    game.col = firstEmpty[1];
    game.direction = entry.direction;
    render();
}

function typeLetter(letter) {
    game.letters[game.row][game.col] = letter;
    checkForWin();
    const entry = currentEntry();
    const cells = entryCells(entry);
    const index = cells.findIndex(([r, c]) => r === game.row && c === game.col);
    // next empty square later in this word; if none, move on to the next word
    const nextEmpty = cells.slice(index + 1).find(([r, c]) => game.letters[r][c] === "");
    if (nextEmpty) {
        [game.row, game.col] = nextEmpty;
    } else if (index < cells.length - 1) {
        [game.row, game.col] = cells[index + 1];
    } else {
        moveToEntry(+1);
        return;
    }
    render();
}

function backspace() {
    if (game.letters[game.row][game.col] !== "") {
        game.letters[game.row][game.col] = "";       // clear this square
    } else {
        const cells = entryCells(currentEntry());
        const index = cells.findIndex(([r, c]) => r === game.row && c === game.col);
        if (index > 0) {
            [game.row, game.col] = cells[index - 1];  // step back and clear that square
            game.letters[game.row][game.col] = "";
        }
    }
    render();
}

// Arrow keys: move one square, skipping black squares; the arrow's axis becomes the direction
function moveArrow(dRow, dCol) {
    const wanted = dCol !== 0 ? "across" : "down";
    if (game.direction !== wanted && (wanted === "across" ? game.acrossAt : game.downAt)[game.row][game.col]) {
        game.direction = wanted;       // first press on a new axis just turns the cursor
        render();
        return;
    }
    let row = game.row + dRow;
    let col = game.col + dCol;
    while (inGrid(row, col) && isBlock(row, col)) {
        row += dRow;
        col += dCol;
    }
    if (inGrid(row, col)) {
        game.row = row;
        game.col = col;
    }
    render();
}

// Tab / Shift+Tab / end of a word: go to the next (or previous) clue, wrapping around
function moveToEntry(step) {
    const entries = allEntries();
    const index = entries.indexOf(currentEntry());
    const next = entries[(index + step + entries.length) % entries.length];
    selectEntry(next);
}

// ---------------------------------------------------------------------------------------------
// Keyboard
// ---------------------------------------------------------------------------------------------

document.addEventListener("keydown", (event) => {
    if (!game.puzzle || puzzleEl.hidden) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;   // leave browser shortcuts alone
    if (game.solved) return;                                       // the board is locked once solved

    const key = event.key;
    if (/^[a-zA-Z]$/.test(key)) {
        typeLetter(key.toUpperCase());
    } else if (key === "Backspace" || key === "Delete") {
        backspace();
    } else if (key === "ArrowLeft") {
        moveArrow(0, -1);
    } else if (key === "ArrowRight") {
        moveArrow(0, 1);
    } else if (key === "ArrowUp") {
        moveArrow(-1, 0);
    } else if (key === "ArrowDown") {
        moveArrow(1, 0);
    } else if (key === " ") {
        toggleDirection();
    } else if (key === "Tab" || key === "Enter") {
        moveToEntry(event.shiftKey ? -1 : 1);
    } else {
        return;              // not ours: let the browser handle it
    }
    event.preventDefault();  // ours: stop the page scrolling, Tab leaving the board, etc.
});

// Difficulty buttons: same grid, different clues (your letters stay)
for (const button of document.querySelectorAll(".difficulty button")) {
    button.addEventListener("click", () => {
        document.querySelectorAll(".difficulty button").forEach(b => b.classList.remove("active"));
        button.classList.add("active");
        button.blur();       // so Space/Enter go to the puzzle, not back to the button
        loadPuzzle(button.dataset.difficulty);
    });
}

loadPuzzle("medium");
