// The game itself: loading puzzles from the server, the board, typing, Check/Reveal, the timer, scoring,
// saving progress, and the results screen. (Steps 19-24 and the design pass, rebuilt for the worlds.)
//
// It tells the rest of the page what happens through the Bus:
//   "puzzle" (a puzzle started), "type", "erase", "word" (a word was filled), "check", "reveal", "idle",
//   "win" (just solved), "results" (the results screen opened), "surrender"

const Game = (() => {
    const $ = U.$;
    const statusEl = $("#status"), puzzleEl = $("#puzzle"), boardEl = $("#board"), gameViewEl = $("#game-view");
    const acrossEl = $("#across-clues"), downEl = $("#down-clues"), clueBarEl = $("#clue-bar"), timerEl = $("#timer");
    const ringEl = $("#progress-ring"), pctEl = $("#progress-pct"), pointsTodayEl = $("#points-today"), bannerEl = $("#result-banner");
    const overlay = $("#overlay");

    // ---------------------------------------------------------------------------------------------
    // Game state: everything about the current game lives here
    // ---------------------------------------------------------------------------------------------
    const game = {
        puzzle: null,        // the JSON from the server
        letters: [],         // what the player typed: letters[row][col] ("" = empty)
        row: 0, col: 0,      // the selected square
        direction: "across",
        acrossAt: [], downAt: [],   // the Across / Down entry covering each square (or null)
        cells: [],           // cells[row][col] = the square's <div>
        clueItems: new Map(),// entry -> its <li> in the clue lists
        seconds: 0,          // the timer
        solved: false,       // every square right (or the whole puzzle revealed)
        surrendered: false,  // "Reveal puzzle" was used: 0 points
        wrong: [], revealed: [],
        squaresChecked: 0, squaresRevealed: 0, checks: 0,
        testWin: false,      // the temporary Win (test) button was used: nothing is saved
        celebrating: false,  // the win cinematic is playing
        result: null         // what the result banner says once the puzzle is finished
    };
    const difficultyFor = { daily: Settings.get("difficulty"), unlimited: Settings.get("difficulty") };
    const lastPuzzle = {};   // slot -> the last puzzle loaded, so coming back to it doesn't fetch a new one
    const savedGames = {};   // slot -> a copy of that slot's game
    let loadCounter = 0;     // ignore a slow answer if the player has already asked for something else
    let lastInput = performance.now(), idleSaid = false;

    // Each daily difficulty is its own puzzle, so its own "slot"; Unlimited has one slot
    const slotFor = (mode, difficulty) => (mode === "daily" ? "daily-" + difficulty : "unlimited");
    const slotOf = puzzle => slotFor(puzzle.mode, puzzle.difficulty);
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

    // ---------------------------------------------------------------------------------------------
    // Daily scores: { "20261007-easy": { date, difficulty, seconds, points, surrendered }, ... }
    // ---------------------------------------------------------------------------------------------
    const SCORES_KEY = "schmoll.dailyScores";
    function scores() {
        try { return JSON.parse(localStorage.getItem(SCORES_KEY)) || {}; } catch (err) { return {}; }
    }
    function saveDailyScore(puzzle, points, surrendered = false) {
        const all = scores(), key = scoreKey(puzzle);
        if (all[key]) return false;              // already completed: no extra points
        all[key] = { date: new Date().toISOString().slice(0, 10), difficulty: puzzle.difficulty, seconds: game.seconds, points, surrendered };
        try { localStorage.setItem(SCORES_KEY, JSON.stringify(all)); } catch (err) { /* storage blocked */ }
        return true;
    }

    // ---------------------------------------------------------------------------------------------
    // Progress: each slot's puzzle and game, saved so a reload doesn't lose them
    // ---------------------------------------------------------------------------------------------
    const PROGRESS_KEY = "schmoll.progress";
    function loadProgress() {
        try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; } catch (err) { return {}; }
    }
    function saveProgress() {
        if (!game.puzzle || game.testWin) return;   // a test win is never saved
        const all = loadProgress();
        all[slotOf(game.puzzle)] = { puzzle: game.puzzle, state: snapshot(), difficulty: game.puzzle.difficulty };
        try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(all)); } catch (err) { /* storage blocked or full */ }
    }
    // A short fingerprint of a puzzle's answers and clues: saved letters only go back onto the exact same puzzle
    const fingerprint = p => U.hash(JSON.stringify([p.solution, p.across.map(e => e.clue), p.down.map(e => e.clue)]));
    function restoreProgress() {
        const all = loadProgress();
        for (const slot of ["daily-easy", "daily-medium", "daily-hard", "daily-challenge", "unlimited"]) {
            const saved = all[slot];
            if (!saved || !saved.puzzle || !saved.state) continue;
            if (slot !== "unlimited" && seedDay(saved.puzzle.seed) !== dayKey(new Date())) continue;   // an old daily
            if (saved.state.print == null) saved.state.print = fingerprint(saved.puzzle);           // saved before fingerprints
            // dailies are always fetched again (the server just reads its saved file), so a daily that was
            // regenerated on the server replaces the old copy; Unlimited puzzles can't be fetched again, so keep them
            if (slot === "unlimited") lastPuzzle[slot] = saved.puzzle;
            savedGames[slot] = saved.state;
            if (slot === "unlimited" && saved.difficulty) difficultyFor.unlimited = saved.difficulty;
        }
    }
    function snapshot() {
        return JSON.parse(JSON.stringify({
            seed: game.puzzle.seed, print: fingerprint(game.puzzle), letters: game.letters, wrong: game.wrong, revealed: game.revealed, locked: game.locked,
            seconds: game.seconds, solved: game.solved, surrendered: game.surrendered, checks: game.checks,
            squaresChecked: game.squaresChecked, squaresRevealed: game.squaresRevealed,
            row: game.row, col: game.col, direction: game.direction, result: game.result
        }));
    }
    function restore(saved) {
        Object.assign(game, {
            letters: saved.letters, wrong: saved.wrong, revealed: saved.revealed, seconds: saved.seconds,
            locked: saved.locked || saved.letters.map(row => row.map(() => false)),      // older saves had no locks
            solved: saved.solved, surrendered: saved.surrendered, squaresChecked: saved.squaresChecked,
            squaresRevealed: saved.squaresRevealed, checks: saved.checks || 0,
            row: saved.row, col: saved.col, direction: saved.direction, testWin: false, celebrating: false
        });
        // games saved before the redesign kept the banner text instead of a result
        game.result = saved.result || (saved.winShown ? { title: saved.winTitle, text: saved.winText, kind: saved.surrendered ? "surrender" : "win" } : null);
    }

    // ---------------------------------------------------------------------------------------------
    // The timer: counts while the puzzle is on screen and nothing else is playing
    // ---------------------------------------------------------------------------------------------
    setInterval(() => {
        if (!game.puzzle || game.solved || document.hidden || puzzleEl.hidden || gameViewEl.hidden || FX.playing) return;
        game.seconds++;
        drawTimer();
        if (game.seconds % 5 === 0) saveProgress();
        if (!idleSaid && performance.now() - lastInput > 50000) { idleSaid = true; Bus.emit("idle"); }
    }, 1000);
    function drawTimer() {
        timerEl.textContent = U.fmtTime(game.seconds);
    }

    // ---------------------------------------------------------------------------------------------
    // Loading puzzles
    // ---------------------------------------------------------------------------------------------
    // Unlimited: each player gets 10 a day (they're paid Claude calls); the server says how many are left
    async function drawUnlimitedLeft() {
        const el = $("#unlimited-left");
        try {
            const r = await (await fetch("/api/unlimited/left")).json();
            if (r.left > 0) el.textContent = `${r.left} of ${r.limit} left today`;
            else {
                const m = Math.ceil(r.nextInSeconds / 60), h = Math.floor(m / 60);
                el.textContent = `0 of ${r.limit} left · next in ${h ? h + "h " : ""}${m % 60}m`;
            }
            el.classList.toggle("out", r.left === 0);
            el.classList.toggle("low", r.left > 0 && r.left <= 3);
        } catch (err) {
            el.textContent = "";
        }
    }

    async function loadPuzzle(mode, difficulty) {
        const myLoad = ++loadCounter;
        statusEl.innerHTML = "";
        statusEl.append(U.el("span", { class: "spinner", "aria-hidden": "true" }),
            "Generating clues…");
        statusEl.classList.remove("error");
        statusEl.hidden = false;
        puzzleEl.hidden = true;
        try {
            let url = "/api/" + mode + "?difficulty=" + encodeURIComponent(difficulty);
            if (mode === "unlimited" && difficulty === "hard" && Settings.get("hardWords")) url += "&hardWords=true";
            const response = await fetch(url);
            if (response.status === 429) { drawUnlimitedLeft(); throw new Error("you've used today's Unlimited puzzles. Come back later, or play today's Daily (those are always free)."); }
            if (!response.ok) throw new Error("the server answered " + response.status);
            const puzzle = await response.json();
            if (myLoad !== loadCounter) return;
            lastPuzzle[slotOf(puzzle)] = puzzle;
            if (mode === "unlimited") drawUnlimitedLeft();
            if (U.view() !== mode || (mode === "daily" && difficultyFor.daily !== difficulty)) return;   // they moved on
            startGame(puzzle);
            statusEl.hidden = true;
            puzzleEl.hidden = false;
            playTitleCard();
        } catch (err) {
            if (myLoad !== loadCounter || U.view() !== mode) return;
            statusEl.textContent = "Couldn't load the puzzle: " + err.message;
            statusEl.classList.add("error");
        }
    }

    let pendingCard = false;
    function startGame(puzzle) {
        if (game.puzzle && slotOf(game.puzzle) !== slotOf(puzzle)) savedGames[slotOf(game.puzzle)] = snapshot();
        const sameGrid = game.puzzle && game.puzzle.seed === puzzle.seed && game.puzzle.mode === puzzle.mode && fingerprint(game.puzzle) === fingerprint(puzzle);
        const saved = savedGames[slotOf(puzzle)];
        const restoring = !sameGrid && saved && saved.seed === puzzle.seed && (saved.print == null || saved.print === fingerprint(puzzle));
        if (!sameGrid) Worlds.board("reset");
        game.puzzle = puzzle;
        if (restoring) restore(saved);
        else if (!sameGrid) {
            const blank = v => puzzle.solution.map(row => Array.from(row, () => v));
            Object.assign(game, {
                letters: blank(""), wrong: blank(false), revealed: blank(false), locked: blank(false), seconds: 0, solved: false, surrendered: false,
                squaresChecked: 0, squaresRevealed: 0, checks: 0, testWin: false, celebrating: false, result: null
            });
        }
        drawTimer();
        drawPointsToday();
        indexEntries(puzzle);
        drawBoard(puzzle);
        drawClues(puzzle);
        const fresh = !sameGrid && !restoring;
        if (fresh) {
            const first = puzzle.across[0];
            game.row = first.row;
            game.col = first.col;
            game.direction = "across";
            pendingCard = true;
        }
        doneWords = null;
        Worlds.board("attach", boardEl, game);
        render();
        drawDifficultyMarks();
        if (game.solved && !game.surrendered) Worlds.board("restoreSolved", boardEl, game);
        lastInput = performance.now();
        idleSaid = false;
        Bus.emit("puzzle", { fresh, puzzle });
    }

    function cardInfo(puzzle) {
        const d = new Date();
        return {
            mode: puzzle.mode, difficulty: puzzle.difficulty,
            kicker: puzzle.mode === "daily" ? "TODAY'S DAILY" : "UNLIMITED",
            title: (puzzle.mode === "daily" ? "Daily" : "Unlimited") + " · " + cap(puzzle.difficulty),
            sub: puzzle.mode === "daily" ? d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : "A brand-new puzzle, just for you",
            stardate: `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`
        };
    }
    // The world's title card, the first time a puzzle is shown
    function playTitleCard() {
        if (!pendingCard || !game.puzzle || gameViewEl.hidden || puzzleEl.hidden) return;
        if (document.documentElement.classList.contains("intro-on")) return;     // it plays after the intro
        pendingCard = false;
        const w = Worlds.current;
        if (!w || !w.titleCard || U.motion() === "still") return;
        FX.cinematic(c => w.titleCard(c, cardInfo(game.puzzle)));
    }

    function indexEntries(puzzle) {
        const empty = () => puzzle.solution.map(row => Array.from(row, () => null));
        game.acrossAt = empty();
        game.downAt = empty();
        for (const e of puzzle.across) for (let i = 0; i < e.length; i++) game.acrossAt[e.row][e.col + i] = e;
        for (const e of puzzle.down) for (let i = 0; i < e.length; i++) game.downAt[e.row + i][e.col] = e;
    }

    // ---------------------------------------------------------------------------------------------
    // Drawing
    // ---------------------------------------------------------------------------------------------
    function drawBoard(puzzle) {
        boardEl.innerHTML = "";
        boardEl.style.setProperty("--size", puzzle.size);
        boardEl.classList.toggle("big", puzzle.size > 5);              // Challenge mode's 7x7 grid: smaller letters
        game.cells = [];
        for (let row = 0; row < puzzle.size; row++) {
            game.cells.push([]);
            for (let col = 0; col < puzzle.size; col++) {
                const last = puzzle.size - 1;
                const corner = row === 0 && col === 0 ? " c-tl" : row === 0 && col === last ? " c-tr" : row === last && col === 0 ? " c-bl" : row === last && col === last ? " c-br" : "";
                const cell = U.el("div", { class: "cell" + corner, style: { "--i": row * puzzle.size + col } });
                if (isBlock(row, col)) cell.classList.add("block");
                else {
                    const number = puzzle.numbers[row][col];
                    if (number > 0) cell.appendChild(U.el("span", { class: "num", text: number }));
                    cell.appendChild(U.el("span", { class: "ltr" }));
                    cell.addEventListener("click", () => clickCell(row, col));
                }
                boardEl.appendChild(cell);
                game.cells[row].push(cell);
            }
        }
        U.restart(boardEl, "deal");
    }
    function drawClues(puzzle) {
        game.clueItems = new Map();
        fillClueList(acrossEl, puzzle.across);
        fillClueList(downEl, puzzle.down);
    }
    function fillClueList(listEl, entries) {
        listEl.innerHTML = "";
        entries.forEach((entry, i) => {
            const item = U.el("li", { style: { "--i": i } },
                U.el("span", { class: "clue-num", text: entry.number }),
                U.el("span", { class: "clue-text", text: entry.clue }));   // text, never HTML
            item.addEventListener("click", () => selectEntry(entry));
            listEl.appendChild(item);
            game.clueItems.set(entry, item);
        });
    }

    let lastClue = null, doneWords = null, doneKey = "";
    // A square is locked once it's revealed, or checked and found right: it can't be typed over or erased
    const isLocked = (row, col) => game.revealed[row][col] || game.locked[row][col];
    function render() {
        if (!game.puzzle) return;
        const current = currentEntry(), size = game.puzzle.size;
        let filled = 0, open = 0;
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                if (isBlock(row, col)) continue;
                open++;
                const cell = game.cells[row][col], letter = game.letters[row][col];
                if (letter) filled++;
                cell.querySelector(".ltr").textContent = letter;
                cell.classList.toggle("filled", !!letter);
                cell.classList.toggle("in-word", current !== null && entryCovers(current, row, col));
                cell.classList.toggle("selected", row === game.row && col === game.col && !game.solved);
                cell.classList.toggle("wrong", game.wrong[row][col]);
                cell.classList.toggle("revealed", game.revealed[row][col]);
                cell.classList.toggle("locked", game.locked[row][col] && !game.revealed[row][col]);
            }
        }
        boardEl.classList.toggle("solved", game.solved && !game.surrendered);
        boardEl.classList.toggle("surrendered", game.surrendered);
        document.querySelectorAll("#helpers button:not(#test-win):not(#report-btn)").forEach(b => { b.disabled = game.solved; });   // the test button stays on, to replay the win
        // which words are full now? Any that weren't before were just finished
        const key = game.puzzle.mode + ":" + game.puzzle.seed;
        const full = new Set(), justDone = [];
        for (const entry of allEntries()) {
            const cells = cellsOf(entry), isFull = cells.every(([r, c]) => game.letters[r][c] !== "");
            const item = game.clueItems.get(entry);
            if (item) { item.classList.toggle("active", entry === current); item.classList.toggle("done", isFull); }
            if (!isFull) continue;
            const id = entry.direction + entry.number;
            full.add(id);
            if (doneWords && doneKey === key && !doneWords.has(id)) justDone.push([entry, cells]);
        }
        doneWords = full;
        doneKey = key;
        // keep the active clue in view in its list
        if (current && current !== lastClue) {
            const item = game.clueItems.get(current);
            if (item && item.scrollIntoView && !U.touch()) item.scrollIntoView({ block: "nearest", behavior: "smooth" });
            U.restart(clueBarEl, "slide");
        }
        lastClue = current;
        if (current) {
            clueBarEl.innerHTML = "";
            clueBarEl.append(
                U.el("span", { class: "cb-num", text: current.number + (current.direction === "across" ? "A" : "D") }),
                U.el("span", { class: "cb-dir", "aria-hidden": "true", text: current.direction === "across" ? "→" : "↓" }),
                U.el("span", { class: "cb-text", text: current.clue }));
        }
        // the progress ring
        const k = open ? filled / open : 0;
        ringEl.style.strokeDashoffset = String(100 - k * 100);
        pctEl.textContent = Math.round(k * 100) + "%";
        drawBanner();
        Worlds.board("update", game, boardEl);
        if (justDone.length && !game.solved) {
            Sound.play("word");
            for (const [entry, cells] of justDone) {
                Worlds.board("wordDone", entry, cells, boardEl, game);
                Bus.emit("word", { entry, cells });
                cells.forEach(([r, c], i) => setTimeout(() => game.cells[r] && U.restart(game.cells[r][c], "wave"), i * 50));
            }
        }
        saveProgress();
    }

    function drawBanner() {
        const r = game.result;
        bannerEl.hidden = !r;
        if (!r) return;
        bannerEl.className = "result-banner " + (r.kind || "win");
        bannerEl.innerHTML = "";
        bannerEl.append(U.el("b", { text: r.title }), U.el("span", { text: r.text }));
        if (r.kind === "win" && !game.celebrating) bannerEl.append(U.el("button", { type: "button", class: "btn small", text: "Results", onclick: () => showResults(r.info || null) }));
    }

    // "Today's medium: 240 pts · 🔥 3"
    function drawPointsToday() {
        const p = game.puzzle, all = scores();
        const record = p && p.mode === "daily" ? all[scoreKey(p)] : null;
        const streaks = calculateStreaks(all), parts = [];
        if (record) parts.push(record.surrendered ? `Today's ${p.difficulty}: revealed (0 pts)` : `Today's ${p.difficulty}: ${record.points} pts`);
        if (streaks.current > 0) parts.push(`\u{1F525} ${streaks.current}-day streak`);
        pointsTodayEl.textContent = parts.join(" · ");
    }

    // Daily difficulty buttons get a ✓ (or ×) for today's finished dailies
    function drawDifficultyMarks() {
        const all = scores(), today = dayKey(new Date()), isDaily = U.view() === "daily";
        document.querySelectorAll(".difficulty button[data-difficulty]").forEach(b => {
            const record = isDaily ? all[today + "-" + b.dataset.difficulty] : null;
            b.classList.toggle("done", !!record && !record.surrendered);
            b.classList.toggle("given-up", !!record && !!record.surrendered);
        });
    }

    // ---------------------------------------------------------------------------------------------
    // Winning
    // ---------------------------------------------------------------------------------------------
    function isSolved() {
        const size = game.puzzle.size;
        for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
            if (!isBlock(row, col) && game.letters[row][col] !== game.puzzle.solution[row][col]) return false;
        }
        return true;
    }

    function checkForWin() {
        if (game.solved || !isSolved()) return false;
        game.solved = true;
        const p = game.puzzle;
        const info = { mode: p.mode, difficulty: p.difficulty, seconds: game.seconds, checked: game.squaresChecked, revealed: game.squaresRevealed, checks: game.checks, test: game.testWin };
        if (game.testWin) {
            info.title = "Test win";
            info.note = "The test button filled this in, so nothing was saved.";
        } else if (p.mode === "daily") {
            const dayWasDone = todayIsDone(scores());
            info.breakdown = scoreBreakdown(p.difficulty, game.seconds, game.squaresChecked, game.squaresRevealed);
            info.points = info.breakdown.total;
            info.counted = saveDailyScore(p, info.points);
            info.firstToday = info.counted && !dayWasDone;
            info.streak = calculateStreaks(scores()).current;
            const all = scores();
            info.left = ["easy", "medium", "hard", "challenge"].filter(d => !all[seedDay(p.seed) + "-" + d]);
            if (!info.counted) info.note = "This daily was already completed, so no extra points.";
        } else {
            info.note = "Unlimited puzzles don't earn points, just glory.";
        }
        info.unlocked = Achievements.onWin(info, Worlds.current.id);
        game.result = {
            kind: "win",
            title: game.testWin ? "Test win" : "Solved!",
            text: `${U.fmtTime(game.seconds)}` + (info.counted ? ` · ${info.points} pts` : ""),
            info
        };
        game.celebrating = true;
        render();
        drawPointsToday();
        drawDifficultyMarks();
        Bus.emit("win", info);
        celebrate(info);
        return true;
    }

    async function celebrate(info) {
        const w = Worlds.current;
        Mascot.hush();
        if (w && w.celebrate) await FX.cinematic(c => w.celebrate(c, { boardEl, game, info }));
        game.celebrating = false;
        render();
        if (info.firstToday && info.streak > 0) Sound.play("streak");
        showResults(info);                 // new achievements are shown on the results card
    }

    // ---------------------------------------------------------------------------------------------
    // The results screen
    // ---------------------------------------------------------------------------------------------
    function streakBadge(streaks) {
        const n = streaks.current, level = n === 0 ? 0 : n < 3 ? 1 : n < 7 ? 2 : 3;
        return U.el("div", { class: "streak-badge", "data-level": level, html:
            `<div class="fire" aria-hidden="true"><span class="flame f1"></span><span class="flame f2"></span><span class="flame f3"></span>` +
            `<span class="ember e1"></span><span class="ember e2"></span><span class="ember e3"></span></div>` +
            `<div class="streak-text"><span class="streak-num">${n}</span><span class="streak-label">day streak · best ${streaks.best}</span></div>` });
    }

    function showResults(info) {
        if (!info) info = game.result && game.result.info;
        if (!info) return;
        closeResults();
        const p = game.puzzle;
        const modal = U.el("div", { class: "results", role: "dialog", "aria-modal": "true", "aria-labelledby": "res-title" });
        const card = U.el("div", { class: "res-card" });
        modal.appendChild(card);
        card.append(
            U.el("div", { class: "res-rays", "aria-hidden": "true" }),
            U.el("small", { class: "res-kicker", text: (p.mode === "daily" ? "DAILY" : "UNLIMITED") + " · " + p.difficulty.toUpperCase() }),
            U.el("h2", { id: "res-title", class: "res-title", text: info.test ? "Test win!" : U.pick(["Solved!", "Brilliant!", "Nailed it!", "Well done!"]) }),
            U.el("div", { class: "res-time" }, U.el("span", { text: "TIME" }), U.el("b", { text: U.fmtTime(info.seconds) })));
        const tally = U.el("div", { class: "res-tally" });
        card.appendChild(tally);
        if (info.breakdown && info.counted) {
            const b = info.breakdown;
            const rows = [["Solved (" + p.difficulty + ")", b.base, "+"], ["Speed bonus", b.speed, "+"]];
            if (b.check) rows.push(["Check penalty", b.check, "−"]);
            if (b.reveal) rows.push(["Reveal penalty", b.reveal, "−"]);
            rows.forEach(([label, value, sign], i) => {
                const v = U.el("b", { text: sign + "0" });
                tally.appendChild(U.el("div", { class: "res-row", style: { "--i": i } }, U.el("span", { text: label }), v));
                setTimeout(() => { FX.countUp(v, value, { dur: 500, fmt: x => sign + Math.round(x) }); Sound.play("coin"); }, 350 + i * 260);
            });
            const total = U.el("b", { text: "0" });
            tally.appendChild(U.el("div", { class: "res-row total", style: { "--i": rows.length } }, U.el("span", { text: "Total" }), total));
            setTimeout(() => { FX.countUp(total, b.total, { dur: 900 }); Sound.play("sparkle"); }, 350 + rows.length * 260);
        }
        if (info.note) card.appendChild(U.el("p", { class: "res-note", text: info.note }));
        if (p.mode === "daily" && !info.test) {
            const s = calculateStreaks(scores());
            card.appendChild(U.el("div", { class: "res-streak" }, streakBadge(s)));
        }
        if (info.unlocked && info.unlocked.length) {
            // new achievements pop in one at a time once the points have counted up
            const start = info.breakdown && info.counted ? 1900 : 700;
            const ach = U.el("div", { class: "res-ach", style: { "--d": start + "ms" } }, U.el("small", { text: info.unlocked.length > 1 ? "ACHIEVEMENTS UNLOCKED" : "ACHIEVEMENT UNLOCKED" }));
            info.unlocked.forEach((a, i) => {
                const item = U.el("span", { class: "res-ach-item", title: a.desc, style: { "--d": start + 200 + i * 450 + "ms" } }, U.el("i", { text: a.icon }), U.el("span", {}, U.el("b", { text: a.name }), U.el("small", { text: a.desc })));
                ach.appendChild(item);
                setTimeout(() => { if (item.isConnected) Sound.play("achievement"); }, start + 200 + i * 450);
            });
            card.appendChild(ach);
        }
        const actions = U.el("div", { class: "res-actions" });
        card.appendChild(actions);
        if (p.mode === "daily" && info.left && info.left.length) {
            const next = info.left[0];
            actions.appendChild(U.el("button", { type: "button", class: "btn primary", text: `Play ${cap(next)} ▶`, onclick: () => { closeResults(); switchDifficulty("daily", next); } }));
        } else if (p.mode === "unlimited") {
            actions.appendChild(U.el("button", { type: "button", class: "btn primary", text: "New puzzle ▶", onclick: () => { closeResults(); loadPuzzle("unlimited", difficultyFor.unlimited); } }));
        }
        if (!info.test) actions.appendChild(U.el("button", { type: "button", class: "btn", text: "Share", onclick: e => share(info, e.currentTarget) }));
        actions.appendChild(U.el("button", { type: "button", class: "btn ghost", text: "See the board", onclick: closeResults }));
        modal.addEventListener("pointerdown", e => { if (e.target === modal) closeResults(); });
        overlay.appendChild(modal);
        requestAnimationFrame(() => modal.classList.add("in"));
        const first = actions.querySelector("button");
        if (first) setTimeout(() => first.focus({ preventScroll: true }), 300);
        Bus.emit("results", info);
    }
    function closeResults() {
        const m = overlay.querySelector(".results");
        if (!m) return;
        m.classList.remove("in");
        m.classList.add("out");
        setTimeout(() => m.remove(), 300);
    }
    function share(info, button) {
        const p = game.puzzle;
        const lines = [`Schmoll Crossword · ${p.mode === "daily" ? "Daily" : "Unlimited"} (${cap(p.difficulty)})`, `✅ Solved in ${U.fmtTime(info.seconds)}` + (info.counted ? ` · ${info.points} pts` : "")];
        if (info.streak > 1) lines.push(`\u{1F525} ${info.streak}-day streak`);
        if (!info.checked && !info.revealed) lines.push("\u{1F9E0} No hints");
        const text = lines.join("\n");
        const done = () => { button.textContent = "Copied!"; setTimeout(() => { button.textContent = "Share"; }, 1600); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => prompt("Copy your result:", text));
        else prompt("Copy your result:", text);
    }

    // ---------------------------------------------------------------------------------------------
    // Check and Reveal
    // ---------------------------------------------------------------------------------------------
    function scopeCells(scope) {
        if (scope === "square") return [[game.row, game.col]];
        if (scope === "word") return cellsOf(currentEntry());
        const cells = [];
        for (let row = 0; row < game.puzzle.size; row++) for (let col = 0; col < game.puzzle.size; col++) if (!isBlock(row, col)) cells.push([row, col]);
        return cells;
    }
    // Check: mark wrong letters (empty squares aren't marked). 5 points per square in the scope.
    // Check: wrong letters get crossed out; right ones are LOCKED in (a check mark in the corner) so they can't
    // be changed. Squares that are already locked aren't checked (or charged for) again.
    function check(scope) {
        const cells = scopeCells(scope).filter(([row, col]) => !isLocked(row, col));
        game.squaresChecked += cells.length;
        game.checks++;
        let anyWrong = false, anyFilled = false;
        for (const [row, col] of cells) {
            const letter = game.letters[row][col];
            if (letter) anyFilled = true;
            game.wrong[row][col] = letter !== "" && letter !== game.puzzle.solution[row][col];
            if (game.wrong[row][col]) { anyWrong = true; U.restart(game.cells[row][col], "shake"); }
            else if (letter) { game.locked[row][col] = true; U.restart(game.cells[row][col], "lock-in"); }
        }
        Sound.play(anyWrong ? "wrong" : "right");
        Bus.emit("check", { anyWrong, anyFilled });
        render();
    }
    // Reveal: fill in the right letter wherever it's empty or wrong. 10 points per square. All = surrender.
    async function reveal(scope) {
        if (scope === "puzzle" && !(await U.ask({ title: "Reveal the whole puzzle?", text: "This counts as giving up: 0 points, and it won't count toward your streak.", yes: "Reveal it", no: "Keep trying" }))) return;
        let n = 0;
        for (const [row, col] of scopeCells(scope)) {
            if (game.letters[row][col] !== game.puzzle.solution[row][col]) {
                game.letters[row][col] = game.puzzle.solution[row][col];
                game.revealed[row][col] = true;
                game.wrong[row][col] = false;
                game.squaresRevealed++;
                const cell = game.cells[row][col];
                cell.style.setProperty("--d", (n++ * 40) + "ms");
                U.restart(cell, "flip");
            } else if (!game.revealed[row][col] && !game.locked[row][col]) {
                // already right (e.g. it belongs to a crossing word you filled in): the reveal confirms it,
                // so it locks too, with no penalty
                game.locked[row][col] = true;
                game.wrong[row][col] = false;
                U.restart(game.cells[row][col], "lock-in");
            }
        }
        Sound.play("reveal");
        Bus.emit("reveal", { scope });
        if (scope === "puzzle") surrender();
        else checkForWin();
        render();
    }
    function surrender() {
        game.solved = true;
        game.surrendered = true;
        let text = "Better luck next time.";
        if (game.puzzle.mode === "daily") {
            const counted = saveDailyScore(game.puzzle, 0, true);
            text = counted ? "0 points, and it doesn't count toward your streak." : "This daily was already completed earlier.";
        }
        game.result = { kind: "surrender", title: "Puzzle revealed", text };
        drawPointsToday();
        drawDifficultyMarks();
        Bus.emit("surrender");
    }

    // ---------------------------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------------------------
    const isBlock = (row, col) => game.puzzle.solution[row][col] === ".";
    const inGrid = (row, col) => row >= 0 && col >= 0 && row < game.puzzle.size && col < game.puzzle.size;
    function currentEntry() {
        const across = game.acrossAt[game.row][game.col], down = game.downAt[game.row][game.col];
        return game.direction === "across" ? across || down : down || across;
    }
    function entryCovers(entry, row, col) {
        if (entry.direction === "across") return row === entry.row && col >= entry.col && col < entry.col + entry.length;
        return col === entry.col && row >= entry.row && row < entry.row + entry.length;
    }
    function cellsOf(entry) {
        const cells = [];
        if (!entry) return cells;
        for (let i = 0; i < entry.length; i++) cells.push(entry.direction === "across" ? [entry.row, entry.col + i] : [entry.row + i, entry.col]);
        return cells;
    }
    const allEntries = () => [...game.puzzle.across, ...game.puzzle.down];

    // ---------------------------------------------------------------------------------------------
    // Actions
    // ---------------------------------------------------------------------------------------------
    const blocked = () => !game.puzzle || FX.playing || !!overlay.querySelector(".results.in") || document.documentElement.classList.contains("intro-on");
    function touched() { lastInput = performance.now(); idleSaid = false; }

    function clickCell(row, col) {
        if (blocked()) return;
        touched();
        if (row === game.row && col === game.col) toggleDirection();
        else {
            game.row = row;
            game.col = col;
            if (game.direction === "across" && !game.acrossAt[row][col]) game.direction = "down";
            if (game.direction === "down" && !game.downAt[row][col]) game.direction = "across";
            Sound.play("move");
        }
        render();
    }
    function toggleDirection() {
        const other = game.direction === "across" ? "down" : "across";
        if ((other === "across" ? game.acrossAt : game.downAt)[game.row][game.col]) { game.direction = other; Sound.play("flip"); }
        render();
    }
    function selectEntry(entry) {
        if (blocked()) return;
        touched();
        const cells = cellsOf(entry);
        const firstEmpty = cells.find(([r, c]) => game.letters[r][c] === "") || cells[0];
        [game.row, game.col] = firstEmpty;
        game.direction = entry.direction;
        render();
    }
    function typeLetter(letter) {
        touched();
        const row = game.row, col = game.col, cell = game.cells[row][col];
        if (!isLocked(row, col)) {                       // locked squares (revealed, or checked right): the cursor just moves on
            game.letters[row][col] = letter;
            game.wrong[row][col] = false;
            U.restart(cell, "typed");
            Sound.play("type", { row, col });
            Worlds.board("type", cell, row, col, game);
            Bus.emit("type", { row, col, letter });
        }
        if (checkForWin()) return;
        const cells = cellsOf(currentEntry());
        const index = cells.findIndex(([r, c]) => r === game.row && c === game.col);
        const nextEmpty = cells.slice(index + 1).find(([r, c]) => game.letters[r][c] === "");
        if (nextEmpty) [game.row, game.col] = nextEmpty;
        else if (index < cells.length - 1) [game.row, game.col] = cells[index + 1];
        else { moveToEntry(+1); return; }
        render();
    }
    function backspace() {
        touched();
        const clear = (row, col) => {
            if (isLocked(row, col)) return;
            if (game.letters[row][col] !== "") { Sound.play("erase"); Bus.emit("erase", { row, col }); }
            game.letters[row][col] = "";
            game.wrong[row][col] = false;
        };
        if (game.letters[game.row][game.col] !== "" && !isLocked(game.row, game.col)) clear(game.row, game.col);
        else {
            const cells = cellsOf(currentEntry());
            const index = cells.findIndex(([r, c]) => r === game.row && c === game.col);
            if (index > 0) { [game.row, game.col] = cells[index - 1]; clear(game.row, game.col); }
        }
        render();
    }
    function moveArrow(dRow, dCol) {
        touched();
        const wanted = dCol !== 0 ? "across" : "down";
        if (game.direction !== wanted && (wanted === "across" ? game.acrossAt : game.downAt)[game.row][game.col]) {
            game.direction = wanted;
            render();
            return;
        }
        let row = game.row + dRow, col = game.col + dCol;
        while (inGrid(row, col) && isBlock(row, col)) { row += dRow; col += dCol; }
        if (inGrid(row, col)) { game.row = row; game.col = col; Sound.play("move"); }
        render();
    }
    function moveToEntry(step) {
        const entries = allEntries();
        const index = entries.indexOf(currentEntry());
        selectEntry(entries[(index + step + entries.length) % entries.length]);
    }

    // ---------------------------------------------------------------------------------------------
    // Keyboard, on-screen keyboard, buttons
    // ---------------------------------------------------------------------------------------------
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && overlay.querySelector(".results.in")) { closeResults(); return; }
        if (!game.puzzle || puzzleEl.hidden || gameViewEl.hidden || blocked()) return;
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.target.closest && event.target.closest("input, select, textarea")) return;
        if (game.solved) return;
        const key = event.key;
        if (/^[a-zA-Z]$/.test(key)) typeLetter(key.toUpperCase());
        else if (key === "Backspace" || key === "Delete") backspace();
        else if (key === "ArrowLeft") moveArrow(0, -1);
        else if (key === "ArrowRight") moveArrow(0, 1);
        else if (key === "ArrowUp") moveArrow(-1, 0);
        else if (key === "ArrowDown") moveArrow(1, 0);
        else if (key === " ") toggleDirection();
        else if (key === "Tab" || key === "Enter") moveToEntry(event.shiftKey ? -1 : 1);
        else return;
        event.preventDefault();
    });

    // the on-screen keyboard (touch screens): "⇄" switches Across/Down, "⌫" is Backspace
    const KEY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "⇄ZXCVBNM⌫"];
    document.querySelectorAll("#keyboard .key-row").forEach((rowEl, i) => {
        for (const key of [...KEY_ROWS[i]]) {
            const b = U.el("button", { type: "button", class: "key", text: key, "data-key": key });
            if (key === "⇄") { b.classList.add("wide"); b.setAttribute("aria-label", "Switch Across/Down"); }
            if (key === "⌫") { b.classList.add("wide"); b.setAttribute("aria-label", "Backspace"); }
            rowEl.appendChild(b);
        }
    });
    $("#keyboard").addEventListener("click", event => {
        const b = event.target.closest(".key");
        if (!b || blocked() || game.solved) return;
        const key = b.dataset.key;
        if (key === "⌫") backspace();
        else if (key === "⇄") toggleDirection();
        else typeLetter(key);
    });
    clueBarEl.addEventListener("click", () => { if (game.puzzle && !game.solved && !blocked()) toggleDirection(); });
    document.querySelectorAll(".clue-step").forEach(b => b.addEventListener("click", () => {
        if (game.puzzle && !game.solved && !blocked()) moveToEntry(Number(b.dataset.step));
    }));
    for (const button of document.querySelectorAll("#helpers button[data-action]")) {
        button.addEventListener("click", () => {
            button.blur();
            if (game.solved || blocked()) return;
            if (button.dataset.action === "check") check(button.dataset.scope);
            else reveal(button.dataset.scope);
        });
    }
    // ---------------------------------------------------------------------------------------------
    // Report a problem: which clue (or the whole puzzle) and what's wrong. Saved on the server with the puzzle's
    // seed (see ReportController.java), so the puzzle can be found again.
    // ---------------------------------------------------------------------------------------------
    $("#report-btn").addEventListener("click", () => { if (game.puzzle) openReport(); });
    function openReport() {
        const p = game.puzzle;
        const modal = U.el("div", { class: "results ask-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "report-title" });
        const select = U.el("select", { id: "report-clue" }, U.el("option", { value: "", text: "The whole puzzle" }),
            ...[...p.across, ...p.down].map(e => U.el("option", { value: `${e.number}${e.direction === "across" ? "A" : "D"}: ${e.clue}`,
                text: `${e.number} ${e.direction === "across" ? "Across" : "Down"}: ${e.clue}` })));
        const current = game.direction === "across" ? game.acrossAt[game.row][game.col] : game.downAt[game.row][game.col];
        if (current) select.value = `${current.number}${current.direction === "across" ? "A" : "D"}: ${current.clue}`;
        const text = U.el("textarea", { id: "report-text", maxlength: "1000", placeholder: "What's wrong? (a clue that fits another word, a misspelling, an offensive word...)" });
        const count = U.el("small", { class: "count", text: "0 / 1000" });
        const err = U.el("p", { class: "report-err", "aria-live": "polite" });
        const cancel = U.el("button", { type: "button", class: "btn ghost", text: "Cancel" });
        const send = U.el("button", { type: "button", class: "btn primary", text: "Send report" });
        modal.appendChild(U.el("div", { class: "res-card ask-card report-card" },
            U.el("h2", { id: "report-title", class: "res-title ask-title", text: "Report a problem" }),
            U.el("label", { for: "report-clue", text: "Which part?" }), select,
            U.el("label", { for: "report-text", text: "What's wrong?" }), text, count, err,
            U.el("div", { class: "res-actions" }, cancel, send)));
        const close = () => { removeEventListener("keydown", onKey, true); modal.classList.remove("in"); modal.classList.add("out"); setTimeout(() => modal.remove(), 300); };
        const onKey = e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } };
        addEventListener("keydown", onKey, true);
        text.addEventListener("input", () => { count.textContent = `${text.value.length} / 1000`; });
        cancel.addEventListener("click", close);
        modal.addEventListener("pointerdown", e => { if (e.target === modal) close(); });
        send.addEventListener("click", async () => {
            if (!text.value.trim()) { err.textContent = "Please say what's wrong first."; text.focus(); return; }
            send.disabled = true;
            send.textContent = "Sending…";
            err.textContent = "";
            try {
                const response = await fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ seed: p.seed, mode: p.mode, difficulty: p.difficulty, clue: select.value, message: text.value.trim(), world: Worlds.current.id }) });
                if (response.status === 429) throw new Error("You've sent a lot of reports recently. Please try again later.");
                if (!response.ok) throw new Error("The report couldn't be saved (" + response.status + ").");
                close();
                FX.toast({ icon: "\u2705", kicker: "REPORT SENT", title: "Thank you!", text: "It's saved with this puzzle so it can be fixed." });
                Sound.play("right");
            } catch (e) {
                err.textContent = e.message.startsWith("You've") || e.message.startsWith("The report") ? e.message : "Couldn't reach the server. Please try again.";
                send.disabled = false;
                send.textContent = "Send report";
            }
        });
        overlay.appendChild(modal);
        requestAnimationFrame(() => modal.classList.add("in"));
        setTimeout(() => text.focus({ preventScroll: true }), 80);
    }

    // TEMPORARY (to be removed): fills in every answer one square at a time and plays the win. Saves nothing.
    // Press it again to watch the win again: after a test win the board is cleared and refilled; on a puzzle you
    // really solved, only the win animation replays (your solve stays saved).
    $("#test-win").addEventListener("click", async event => {
        event.currentTarget.blur();
        if (!game.puzzle || blocked()) return;
        if (game.solved && !game.testWin) {
            const info = (game.result && game.result.info) || { mode: game.puzzle.mode, difficulty: game.puzzle.difficulty, seconds: game.seconds, test: true };
            game.celebrating = true;
            render();
            celebrate(info);
            return;
        }
        if (game.solved) {                               // a test win: start over with an empty board
            const blank = v => game.puzzle.solution.map(row => Array.from(row, () => v));
            Object.assign(game, { letters: blank(""), wrong: blank(false), revealed: blank(false), locked: blank(false), solved: false, surrendered: false, result: null, celebrating: false });
            doneWords = null;
            Worlds.board("reset");
            Worlds.board("attach", boardEl, game);
            render();
            await U.wait(300);
        }
        game.testWin = true;
        const size = game.puzzle.size;
        for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
            if (isBlock(row, col) || game.letters[row][col] === game.puzzle.solution[row][col]) continue;
            game.letters[row][col] = game.puzzle.solution[row][col];
            game.wrong[row][col] = false;
            if (isSolved()) break;
            U.restart(game.cells[row][col], "typed");
            Sound.play("type");
            Worlds.board("type", game.cells[row][col], row, col, game);
            render();
            await U.wait(55);
        }
        checkForWin();
    });

    // Difficulty buttons. Daily: switch to that difficulty's daily. Unlimited: a new puzzle.
    function switchDifficulty(view, difficulty) {
        difficultyFor[view] = difficulty;
        document.querySelectorAll(".difficulty button[data-difficulty]").forEach(b => b.classList.toggle("active", b.dataset.difficulty === difficulty));
        if (view === "daily") showPuzzleFor("daily");
        else loadPuzzle(view, difficulty);
    }
    for (const button of document.querySelectorAll(".difficulty button[data-difficulty]")) {
        button.addEventListener("click", () => { button.blur(); Sound.play("select"); switchDifficulty(U.view(), button.dataset.difficulty); });
    }
    $("#new-puzzle").addEventListener("click", e => { e.currentTarget.blur(); loadPuzzle("unlimited", difficultyFor.unlimited); });

    // ---------------------------------------------------------------------------------------------
    // Showing the game screen (called by app.js for #daily and #unlimited)
    // ---------------------------------------------------------------------------------------------
    function show(view) {
        $("#game-title").textContent = view === "daily" ? "Daily puzzle" : "Unlimited";
        $("#game-subtitle").textContent = view === "daily"
            ? new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
            : "A brand-new puzzle every time · no points";
        $("#new-puzzle").hidden = view !== "unlimited";
        $("#unlimited-left").hidden = view !== "unlimited";
        if (view === "unlimited") drawUnlimitedLeft();
        document.querySelectorAll(".difficulty button[data-difficulty]").forEach(b => b.classList.toggle("active", b.dataset.difficulty === difficultyFor[view]));
        drawDifficultyMarks();
        showPuzzleFor(view);
    }
    function showPuzzleFor(view) {
        const slot = slotFor(view, difficultyFor[view]);
        if (game.puzzle && slotOf(game.puzzle) === slot) {
            loadCounter++;
            statusEl.hidden = true;
            puzzleEl.hidden = false;
            playTitleCard();
            return;
        }
        if (lastPuzzle[slot]) {
            loadCounter++;
            startGame(lastPuzzle[slot]);
            statusEl.hidden = true;
            puzzleEl.hidden = false;
            playTitleCard();
        } else {
            loadPuzzle(view, difficultyFor[view]);
        }
    }

    // a different world: redraw the board's decorations in the new style
    Bus.on("world", () => {
        if (!game.puzzle) return;
        doneWords = null;
        Worlds.board("attach", boardEl, game);
        render();
        if (game.solved && !game.surrendered) Worlds.board("restoreSolved", boardEl, game);
    });
    Settings.on(key => {
        if (key === "difficulty") {
            difficultyFor.daily = Settings.get("difficulty");
            if (!lastPuzzle.unlimited) difficultyFor.unlimited = Settings.get("difficulty");
        }
        if (key === "showTimer") document.documentElement.classList.toggle("no-timer", !Settings.get("showTimer"));
    });
    document.documentElement.classList.toggle("no-timer", !Settings.get("showTimer"));

    restoreProgress();

    return {
        openReport,
        state: game, difficultyFor, scores, show, showPuzzleFor, loadPuzzle, drawDifficultyMarks, streakBadge, render,
        cellsOf, cellEl: (r, c) => (game.cells[r] ? game.cells[r][c] : null),
        openCells: () => game.cells.flat().filter(c => !c.classList.contains("block")),
        closeResults, playTitleCard
    };
})();
