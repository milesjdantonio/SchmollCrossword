// Schmoll Crossword: draws the puzzle from the server (Step 19), lets you play it (Step 20-22),
// and switches between the Home, Daily and Unlimited screens (Step 23).

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

const homeViewEl = document.getElementById("home-view");
const gameViewEl = document.getElementById("game-view");
const gameTitleEl = document.getElementById("game-title");
const gameSubtitleEl = document.getElementById("game-subtitle");
const newPuzzleEl = document.getElementById("new-puzzle");
const dailyStatusEl = document.getElementById("daily-status");
const homeStreakEl = document.getElementById("home-streak");

const todayText = () =>
    new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
document.getElementById("today-date").textContent = todayText();

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
    solved: false,       // true once every square is right (or the whole puzzle was revealed)
    surrendered: false,  // true if "Reveal puzzle" was used: 0 points (Step 22)
    wrong: [],           // wrong[row][col]    = true if Check marked this square wrong
    revealed: [],        // revealed[row][col] = true if Reveal filled this square (stays marked)
    squaresChecked: 0,   // for the score: every square looked at by Check
    squaresRevealed: 0   // for the score: every square filled in by Reveal
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

function saveDailyScore(puzzle, points, surrendered = false) {
    const scores = loadDailyScores();
    if (scores[puzzle.seed]) return false;   // already completed today (at any difficulty): no extra points
    scores[puzzle.seed] = {
        date: new Date().toISOString().slice(0, 10),
        difficulty: puzzle.difficulty,
        seconds: game.seconds,
        points: points,
        surrendered: surrendered
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
    drawCountdown();   // the home screen's "next daily in ..." (Step 23)
    if (!game.puzzle || game.solved || document.hidden || puzzleEl.hidden || gameViewEl.hidden) return;
    game.seconds++;
    drawTimer();
}, 1000);

function drawTimer() {
    const minutes = Math.floor(game.seconds / 60);
    const seconds = String(game.seconds % 60).padStart(2, "0");
    timerEl.textContent = minutes + ":" + seconds;
}

// Ask the server for a puzzle, then draw it.
// mode "daily":     today's puzzle at that difficulty (saved on the server, so fast after the first time)
// mode "unlimited": a brand-new puzzle (Claude writes its clues, so it takes a few seconds)
const lastPuzzle = {};      // mode -> the last puzzle loaded, so coming back to a mode doesn't fetch a new one
let loadCounter = 0;        // ignore a slow answer if the player has already asked for something else

async function loadPuzzle(mode, difficulty) {
    const myLoad = ++loadCounter;
    statusEl.textContent = mode === "daily"
        ? "Loading today's " + difficulty + " puzzle… (the first one of the day takes a few seconds)"
        : "Making a new " + difficulty + " puzzle… (Claude is writing the clues, this takes a few seconds)";
    statusEl.classList.remove("error");
    statusEl.hidden = false;
    puzzleEl.hidden = true;

    try {
        const response = await fetch("/api/" + mode + "?difficulty=" + encodeURIComponent(difficulty));
        if (!response.ok) {
            throw new Error("The server answered " + response.status);
        }
        const puzzle = await response.json();   // the JSON from Puzzle.toJson()
        if (myLoad !== loadCounter) return;      // the player moved on while we waited
        lastPuzzle[mode] = puzzle;
        startGame(puzzle);
        statusEl.hidden = true;
        puzzleEl.hidden = false;
    } catch (err) {
        if (myLoad !== loadCounter) return;
        statusEl.textContent = "Couldn't load the puzzle: " + err.message;
        statusEl.classList.add("error");
    }
}

// Each mode keeps its own game while you visit the other one (Step 24 will also keep it across page reloads)
const savedGames = {};      // mode -> a copy of that mode's game

function snapshot() {
    return JSON.parse(JSON.stringify({
        seed: game.puzzle.seed, letters: game.letters, wrong: game.wrong, revealed: game.revealed,
        seconds: game.seconds, solved: game.solved, surrendered: game.surrendered,
        squaresChecked: game.squaresChecked, squaresRevealed: game.squaresRevealed,
        row: game.row, col: game.col, direction: game.direction,
        winShown: !winEl.hidden, winTitle: winEl.querySelector("h2").textContent, winText: winDetailsEl.textContent
    }));
}

function restore(saved) {
    Object.assign(game, {
        letters: saved.letters, wrong: saved.wrong, revealed: saved.revealed, seconds: saved.seconds,
        solved: saved.solved, surrendered: saved.surrendered, squaresChecked: saved.squaresChecked,
        squaresRevealed: saved.squaresRevealed, row: saved.row, col: saved.col, direction: saved.direction
    });
    winEl.querySelector("h2").textContent = saved.winTitle;
    winDetailsEl.textContent = saved.winText;
    winEl.hidden = !saved.winShown;
}

function startGame(puzzle) {
    // Remember the game we're leaving, in case the player comes back to that mode
    if (game.puzzle && game.puzzle.mode !== puzzle.mode) savedGames[game.puzzle.mode] = snapshot();

    // Same grid as before (only the difficulty changed)? Keep what the player typed.
    const sameGrid = game.puzzle && game.puzzle.seed === puzzle.seed && game.puzzle.mode === puzzle.mode;
    const saved = savedGames[puzzle.mode];
    const restoring = !sameGrid && saved && saved.seed === puzzle.seed;
    game.puzzle = puzzle;
    if (restoring) {
        restore(saved);
    } else if (!sameGrid) {
        game.letters = puzzle.solution.map(row => Array.from(row, () => ""));
        game.wrong = puzzle.solution.map(row => Array.from(row, () => false));
        game.revealed = puzzle.solution.map(row => Array.from(row, () => false));
        game.seconds = 0;
        game.solved = false;
        game.surrendered = false;
        game.squaresChecked = 0;
        game.squaresRevealed = 0;
        winEl.hidden = true;
    }
    drawTimer();
    drawPointsToday();
    indexEntries(puzzle);
    drawBoard(puzzle);
    drawClues(puzzle);

    if (!sameGrid && !restoring) {
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
    boardEl.classList.toggle("solved", game.solved && !game.surrendered);
    boardEl.classList.toggle("surrendered", game.surrendered);
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
            cell.classList.toggle("wrong", game.wrong[row][col]);
            cell.classList.toggle("revealed", game.revealed[row][col]);
        }
    }
    // Check/Reveal buttons do nothing once the puzzle is finished
    document.querySelectorAll("#helpers button").forEach(b => { b.disabled = game.solved; });
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
    if (record) {
        parts.push(record.surrendered ? "Today's daily: surrendered (0 pts)"
                                      : "Today's daily: " + record.points + " pts (" + record.difficulty + ")");
    }
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
    const help = game.squaresChecked + game.squaresRevealed > 0
        ? " (" + game.squaresChecked + " squares checked, " + game.squaresRevealed + " revealed)" : "";

    winEl.querySelector("h2").textContent = "You solved it!";
    if (puzzle.mode !== "daily") {
        winDetailsEl.textContent = "Time: " + time + ". Unlimited puzzles don't earn points.";
    } else {
        const points = calculateScore(puzzle.difficulty, game.seconds, game.squaresChecked, game.squaresRevealed);
        const counted = saveDailyScore(puzzle, points);
        winDetailsEl.textContent = counted
            ? "Time: " + time + " · " + points + " points for today's daily (" + puzzle.difficulty + ")" + help + "."
            : "Time: " + time + ". Today's daily was already completed, so no extra points.";
    }
    winEl.hidden = false;
    drawPointsToday();
}

// ---------------------------------------------------------------------------------------------
// Check and Reveal (Step 22)
// ---------------------------------------------------------------------------------------------

// The open squares a scope covers: the selected square, its word, or the whole puzzle
function scopeCells(scope) {
    if (scope === "square") return [[game.row, game.col]];
    if (scope === "word") return entryCells(currentEntry());
    const cells = [];
    for (let row = 0; row < game.puzzle.size; row++) {
        for (let col = 0; col < game.puzzle.size; col++) {
            if (!isBlock(row, col)) cells.push([row, col]);
        }
    }
    return cells;
}

// Check: mark wrong letters (empty squares aren't marked). Costs 5 points per square in the scope.
function check(scope) {
    const cells = scopeCells(scope);
    game.squaresChecked += cells.length;
    for (const [row, col] of cells) {
        const letter = game.letters[row][col];
        game.wrong[row][col] = letter !== "" && letter !== game.puzzle.solution[row][col];
    }
    render();
}

// Reveal: fill in the right letter wherever it's empty or wrong. Costs 10 points per square filled.
// Revealing the whole puzzle is a surrender.
function reveal(scope) {
    if (scope === "puzzle" && !confirm("Reveal the whole puzzle? This counts as giving up: 0 points, and it won't count toward your streak.")) {
        return;
    }
    for (const [row, col] of scopeCells(scope)) {
        if (game.letters[row][col] !== game.puzzle.solution[row][col]) {
            game.letters[row][col] = game.puzzle.solution[row][col];
            game.revealed[row][col] = true;
            game.wrong[row][col] = false;
            game.squaresRevealed++;
        }
    }
    if (scope === "puzzle") {
        surrender();
    } else {
        checkForWin();     // a reveal can finish the puzzle
    }
    render();
}

function surrender() {
    game.solved = true;
    game.surrendered = true;
    boardEl.classList.add("surrendered");
    winEl.querySelector("h2").textContent = "Puzzle revealed";
    if (game.puzzle.mode === "daily") {
        const counted = saveDailyScore(game.puzzle, 0, true);
        winDetailsEl.textContent = counted
            ? "You surrendered today's daily: 0 points, and it doesn't count toward your streak."
            : "Puzzle revealed. Today's daily was already completed earlier.";
    } else {
        winDetailsEl.textContent = "Puzzle revealed.";
    }
    winEl.hidden = false;
    drawPointsToday();
}

for (const button of document.querySelectorAll("#helpers button")) {
    button.addEventListener("click", () => {
        button.blur();   // keep the keyboard on the puzzle
        if (game.solved) return;
        if (button.dataset.action === "check") check(button.dataset.scope);
        else reveal(button.dataset.scope);
    });
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
    if (!game.revealed[game.row][game.col]) {        // revealed squares are locked: the cursor just moves on
        game.letters[game.row][game.col] = letter;
        game.wrong[game.row][game.col] = false;      // a new letter clears the Check mark
    }
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
    const clear = (row, col) => {
        if (game.revealed[row][col]) return;          // revealed squares stay
        game.letters[row][col] = "";
        game.wrong[row][col] = false;
    };
    if (game.letters[game.row][game.col] !== "" && !game.revealed[game.row][game.col]) {
        clear(game.row, game.col);                    // clear this square
    } else {
        const cells = entryCells(currentEntry());
        const index = cells.findIndex(([r, c]) => r === game.row && c === game.col);
        if (index > 0) {
            [game.row, game.col] = cells[index - 1];  // step back and clear that square
            clear(game.row, game.col);
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
    if (!game.puzzle || puzzleEl.hidden || gameViewEl.hidden) return;   // no typing on the Home screen
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

// ---------------------------------------------------------------------------------------------
// Screens and modes (Step 23). The part of the URL after "#" picks the screen:
//   (nothing) = Home,  #daily = Daily,  #unlimited = Unlimited
// so the browser's Back button and bookmarks work.
// ---------------------------------------------------------------------------------------------
const difficultyFor = { daily: "medium", unlimited: "medium" };   // the difficulty each mode last used

function currentView() {
    const view = location.hash.replace("#", "");
    return view === "daily" || view === "unlimited" ? view : "home";
}

function showView() {
    const view = currentView();
    document.querySelectorAll(".modes a").forEach(a => a.classList.toggle("active", a.dataset.view === view));
    homeViewEl.hidden = view !== "home";
    gameViewEl.hidden = view === "home";

    if (view === "home") {
        drawHome();
        return;
    }
    gameTitleEl.textContent = view === "daily" ? "Daily puzzle" : "Unlimited";
    gameSubtitleEl.textContent = view === "daily" ? todayText() : "A new puzzle every time · no points";
    newPuzzleEl.hidden = view !== "unlimited";
    document.querySelectorAll(".difficulty button[data-difficulty]").forEach(b =>
        b.classList.toggle("active", b.dataset.difficulty === difficultyFor[view]));

    if (game.puzzle && game.puzzle.mode === view) return;   // already showing this mode's game
    if (lastPuzzle[view]) {
        startGame(lastPuzzle[view]);                      // come back to the puzzle you left
        statusEl.hidden = true;
        puzzleEl.hidden = false;
    } else {
        loadPuzzle(view, difficultyFor[view]);
    }
}

// Home screen: today's daily status, the countdown, and the streak
function drawHome() {
    const scores = loadDailyScores();
    const today = scores[dayKey(new Date())];
    if (!today) {
        dailyStatusEl.textContent = "Today's puzzle is ready.";
    } else if (today.surrendered) {
        dailyStatusEl.textContent = "Today: revealed (0 pts).";
    } else {
        dailyStatusEl.textContent = "Done today: " + today.points + " pts (" + today.difficulty + ").";
    }
    const streaks = calculateStreaks(scores);
    homeStreakEl.textContent = streaks.best > 0
        ? "Streak: " + streaks.current + (streaks.current === 1 ? " day" : " days") + " · best " + streaks.best
        : "";
    drawCountdown();
}

// "Next daily in 5h 12m 30s" (until midnight, your time)
function drawCountdown() {
    if (homeViewEl.hidden) return;
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const total = Math.max(0, Math.floor((midnight - now) / 1000));
    const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
    const done = !!loadDailyScores()[dayKey(now)];
    const base = dailyStatusEl.textContent.split(" Next daily")[0];
    dailyStatusEl.textContent = done ? base + " Next daily in " + h + "h " + m + "m " + s + "s." : base;
    if (total === 0) drawHome();   // midnight: a new daily is out
}

// Difficulty buttons. Daily: same grid, different clues (your letters stay). Unlimited: a new puzzle.
for (const button of document.querySelectorAll(".difficulty button[data-difficulty]")) {
    button.addEventListener("click", () => {
        const view = currentView();
        difficultyFor[view] = button.dataset.difficulty;
        document.querySelectorAll(".difficulty button[data-difficulty]").forEach(b => b.classList.remove("active"));
        button.classList.add("active");
        button.blur();       // so Space/Enter go to the puzzle, not back to the button
        loadPuzzle(view, button.dataset.difficulty);
    });
}

// Unlimited: "New puzzle" button
newPuzzleEl.addEventListener("click", () => {
    newPuzzleEl.blur();
    loadPuzzle("unlimited", difficultyFor.unlimited);
});

window.addEventListener("hashchange", showView);
showView();
