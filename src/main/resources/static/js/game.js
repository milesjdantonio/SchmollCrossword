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
        typos: 0, itemsUsed: 0,  // wrong letters typed, shop items used (campaign stars)
        celebrating: false,  // the win cinematic is playing
        result: null         // what the result banner says once the puzzle is finished
    };
    const difficultyFor = { daily: Settings.get("difficulty"), unlimited: Settings.get("difficulty") };
    const lastPuzzle = {};   // slot -> the last puzzle loaded, so coming back to it doesn't fetch a new one
    const savedGames = {};   // slot -> a copy of that slot's game
    let loadCounter = 0;     // ignore a slow answer if the player has already asked for something else
    let lastInput = performance.now(), idleSaid = false, clockStoppedUntil = 0, clockHeld = false;

    // Each daily difficulty is its own puzzle, so its own "slot"; Unlimited has one slot
    // Campaign levels (#level) each have their own slot too: "campaign-garden-3"
    const slotFor = (mode, difficulty) => (mode === "level" ? Campaign.slotName() : mode === "daily" ? "daily-" + difficulty : "unlimited");
    const slotOf = puzzle => (puzzle.special ? `special-${puzzle.special}` : puzzle.mode === "campaign" ? `campaign-${puzzle.world}-${puzzle.level}` : slotFor(puzzle.mode, puzzle.difficulty));
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

    // ---------------------------------------------------------------------------------------------
    // Daily scores: { "20261007-easy": { date, difficulty, seconds, points, surrendered }, ... }
    // ---------------------------------------------------------------------------------------------
    const SCORES_KEY = "schmoll.dailyScores";
    function scores() {
        try { return JSON.parse(localStorage.getItem(SCORES_KEY)) || {}; } catch (err) { return {}; }
    }
    function saveDailyScore(puzzle, points, surrendered = false) { return saveScore(scoreKey(puzzle), puzzle.difficulty, points, surrendered); }
    function saveScore(key, difficulty, points, surrendered = false, stars, attempts, keepBest = false) {
        const all = scores();
        if (all[key] && !(keepBest && points > (all[key].points || 0))) return false;   // already completed (and not beaten)
        // (Checks, Reveals and stars too: the leaderboard's server works the points out from them)
        all[key] = { date: new Date().toISOString().slice(0, 10), difficulty, seconds: game.seconds, points, surrendered,
            checked: game.squaresChecked || 0, revealed: game.squaresRevealed || 0, ...(stars ? { stars } : {}), ...(attempts ? { attempts } : {}) };
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
    // Saved at most every 400 ms: render() asks after every keystroke, and each save re-writes every saved puzzle.
    // A pending save is written at once when the page is hidden or closed, and before another puzzle takes over.
    let saveTimer = 0, savingOff = false;
    // Settings > Reset: nothing is saved again before the page reloads (the reload's own save used to put the
    // puzzle you were playing straight back)
    function stopSaving() { savingOff = true; clearTimeout(saveTimer); saveTimer = 0; }
    function saveProgress() { if (!saveTimer) saveTimer = setTimeout(flushProgress, 400); }
    function flushProgress() {
        clearTimeout(saveTimer);
        saveTimer = 0;
        if (!game.puzzle || savingOff) return;
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
        // campaign levels are fixed puzzles: keep them (and their games), except boss fights, which always start over
        for (const [slot, saved] of Object.entries(all)) {
            if (!slot.startsWith("campaign-") || !saved || !saved.puzzle || !saved.state) continue;
            lastPuzzle[slot] = saved.puzzle;
            if (!slot.endsWith("-5")) savedGames[slot] = saved.state;
        }
    }
    function snapshot() {
        return JSON.parse(JSON.stringify({
            seed: game.puzzle.seed, print: fingerprint(game.puzzle), letters: game.letters, wrong: game.wrong, revealed: game.revealed, locked: game.locked,
            seconds: game.seconds, solved: game.solved, surrendered: game.surrendered, checks: game.checks,
            squaresChecked: game.squaresChecked, squaresRevealed: game.squaresRevealed, typos: game.typos, itemsUsed: game.itemsUsed,
            row: game.row, col: game.col, direction: game.direction, result: game.result
        }));
    }
    function restore(saved) {
        Object.assign(game, {
            letters: saved.letters, wrong: saved.wrong, revealed: saved.revealed, seconds: saved.seconds,
            locked: saved.locked || saved.letters.map(row => row.map(() => false)),      // older saves had no locks
            solved: saved.solved, surrendered: saved.surrendered, squaresChecked: saved.squaresChecked,
            squaresRevealed: saved.squaresRevealed, checks: saved.checks || 0, typos: saved.typos || 0, itemsUsed: saved.itemsUsed || 0,
            row: saved.row, col: saved.col, direction: saved.direction, celebrating: false
        });
        // games saved before the redesign kept the banner text instead of a result
        game.result = saved.result || (saved.winShown ? { title: saved.winTitle, text: saved.winText, kind: saved.surrendered ? "surrender" : "win" } : null);
    }

    // ---------------------------------------------------------------------------------------------
    // The timer: counts while the puzzle is on screen and nothing else is playing
    // ---------------------------------------------------------------------------------------------
    setInterval(() => {
        if (!game.puzzle || game.solved || document.hidden || puzzleEl.hidden || gameViewEl.hidden || FX.playing) return;
        if (performance.now() < clockStoppedUntil || clockHeld) return;   // a campaign Time Stop item, or a boss still getting ready
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
            if (r.left > 0) el.textContent = `${r.left} of ${r.limit} Left Today`;
            else {
                const m = Math.ceil(r.nextInSeconds / 60), h = Math.floor(m / 60);
                el.textContent = `0 of ${r.limit} Left · Next in ${h ? h + "h " : ""}${m % 60}m`;
            }
            el.classList.toggle("out", r.left === 0);
            el.classList.toggle("low", r.left > 0 && r.left <= 3);
        } catch (err) {
            el.textContent = "";
        }
    }

    // Unlimited opens on a picker, not a puzzle: a new Unlimited puzzle only starts when the player picks one, and an
    // unfinished one can be picked up again for free.
    const pickerEl = $("#un-picker");
    function hidePicker() { pickerEl.hidden = true; gameViewEl.classList.remove("picking"); }
    function unlimitedUnfinished() {
        if (!lastPuzzle.unlimited) return false;
        const st = game.puzzle && slotOf(game.puzzle) === "unlimited" ? game : savedGames.unlimited;
        return !st || !st.solved;
    }
    function showPicker() {
        loadCounter++;                                         // a load still on its way won't open over the picker
        statusEl.hidden = true;
        puzzleEl.hidden = true;
        gameViewEl.classList.add("picking");
        pickerEl.innerHTML = "";
        const grid = U.el("div", { class: "un-cards" });
        const card = (cls, title, sub, onclick) => grid.appendChild(U.el("button", { type: "button", class: "un-card " + cls, onclick: e => { e.currentTarget.blur(); Sound.play("select"); onclick(); } },
            U.el("b", { text: title }), sub ? U.el("small", { text: sub }) : null));
        if (unlimitedUnfinished()) card("continue", "Continue", cap(lastPuzzle.unlimited.difficulty), () => { hidePicker(); difficultyFor.unlimited = lastPuzzle.unlimited.difficulty; showPuzzleFor("unlimited"); });
        for (const d of ["easy", "medium", "hard", "challenge"]) card(d, cap(d), d === "challenge" ? "6×6 to 9×9" : "5×5", () => { hidePicker(); difficultyFor.unlimited = d; loadPuzzle("unlimited", d); });
        card("boss", "Boss", "A Random Boss", () => { hidePicker(); Campaign.playSpecial("unlimited"); });
        pickerEl.append(U.el("h2", { class: "un-title", text: "Pick a Puzzle" }), grid);
        pickerEl.hidden = false;
    }

    async function loadPuzzle(mode, difficulty) {
        hidePicker();
        const myLoad = ++loadCounter;
        statusEl.innerHTML = "";
        statusEl.append(U.el("span", { class: "spinner", "aria-hidden": "true" }),
            "Generating clues…");
        statusEl.classList.remove("error");
        statusEl.hidden = false;
        puzzleEl.hidden = true;
        try {
            let url = mode === "level" ? Campaign.apiUrl() : "/api/" + mode + "?difficulty=" + encodeURIComponent(difficulty);
            if (mode === "unlimited" && difficulty === "hard" && Settings.get("hardWords")) url += "&hardWords=true";
            if (mode === "daily") { const d = dayKey(new Date()); url += `&date=${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`; }   // the player's own date (time zones)
            const response = await fetch(url);
            if (response.status === 429) { drawUnlimitedLeft(); throw new Error("you've used today's Unlimited puzzles. Come back later, or play today's Daily (those are always free)."); }
            if (!response.ok) throw new Error("the server answered " + response.status);
            const puzzle = await response.json();
            if (myLoad !== loadCounter) return;
            if (mode === "level") Object.assign(puzzle, { world: Campaign.playing.world, level: Campaign.playing.level, special: Campaign.playing.special || undefined });   // which level it is
            lastPuzzle[slotOf(puzzle)] = puzzle;
            if (mode === "unlimited") drawUnlimitedLeft();
            if (U.view() !== mode || (mode === "daily" && difficultyFor.daily !== difficulty) || (mode === "level" && slotOf(puzzle) !== Campaign.slotName())) return;   // they moved on
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
        if (saveTimer) flushProgress();
        clockStoppedUntil = 0;
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
                squaresChecked: 0, squaresRevealed: 0, checks: 0, typos: 0, itemsUsed: 0, celebrating: false, result: null
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
        if (puzzle.mode === "campaign") return Campaign.cardInfo(puzzle) || {};
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
        if (Campaign.isBossLevel(game.puzzle)) return;                            // bosses have their own full-screen intro
        titlePlaying = true;
        FX.cinematic(c => w.titleCard(c, cardInfo(game.puzzle))).then(() => { titlePlaying = false; });
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
    // Squares the boss erased or changed: each gets a clear mark until its letter changes again, and clicking it puts your letter back (the
    // user's rule). "r,c" -> { kind: "erased"|"changed", ch: the letter there now, was: yours before the boss }
    const hits = new Map();
    let hitsFor = "";
    // compare the board with how it was before the boss did something, and mark what it took or changed
    // (letters it wrote that are RIGHT, like an ability's gift, aren't marked)
    function markBossChanges(before) {
        if (!game.puzzle || game.solved || !before) return;
        let n = 0;
        before.forEach((row, r) => row.forEach((was, c) => {
            const now = game.letters[r] && game.letters[r][c];
            if (now === undefined || was === now) return;
            const k = r + "," + c, prev = hits.get(k), mine = prev && prev.ch === was ? prev.was : was;   // hit twice: still YOUR letter
            if (was && !now) hits.set(k, { kind: "erased", ch: "", was: mine });
            else if (now && now !== game.puzzle.solution[r][c]) hits.set(k, { kind: "changed", ch: now, was: mine });
            else return;
            n++;
        }));
        if (!n) return;
        render();
        if (!U.store.get("restoreTip", false)) {                // the first time: say how to undo it
            U.store.set("restoreTip", true);
            FX.toast({ icon: "✕", kicker: "BOSS FIGHT", title: "Click a Marked Square", text: "It puts back the letter the boss took.", ms: 4500 });
        }
    }
    // a marked square clicked: your letter comes back (only while the boss's letter, or the gap, is still there)
    function restoreHit(row, col) {
        const k = row + "," + col, hit = hits.get(k);
        if (!hit || game.solved || isLocked(row, col) || game.letters[row][col] !== hit.ch) return false;
        if (game.cells[row][col].classList.contains("bird-taken")) return false;    // an angel bird has it: only the bird gives it back
        hits.delete(k);
        game.letters[row][col] = hit.was;
        game.wrong[row][col] = false;
        U.restart(game.cells[row][col], "flip");
        Sound.play("type", { row, col });
        Bus.emit("restore", { row, col, letter: hit.was });
        return true;
    }
    // Rewrite Fate (the Celestial Rift's ability): every marked square gets your letter back at once
    function restoreAllHits() {
        let n = 0;
        for (const k of [...hits.keys()]) { const [r, c] = k.split(",").map(Number); if (restoreHit(r, c)) n++; }
        if (n) { render(); checkForWin(); }
        return n;
    }
    const hitCount = () => [...hits.entries()].filter(([k, h]) => { const [r, c] = k.split(",").map(Number); return !isLocked(r, c) && game.letters[r] && game.letters[r][c] === h.ch; }).length;
    // A square is locked once it's revealed, or checked and found right: it can't be typed over or erased
    const isLocked = (row, col) => game.revealed[row][col] || game.locked[row][col];
    function render() {
        if (!game.puzzle) return;
        const hk = game.puzzle.mode + ":" + game.puzzle.seed;
        if (hitsFor !== hk) { hits.clear(); hitsFor = hk; }
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
                // the boss's marks: gone as soon as the square's letter changes again (you typed, or a letter came back)
                const hk = row + "," + col, hit = hits.get(hk);
                if (hit && letter !== hit.ch) hits.delete(hk);
                const shown = hits.get(hk), mark = cell.querySelector(".hit-mark");
                if (shown && !game.solved) {
                    const m = mark || cell.appendChild(U.el("span", { class: "hit-mark", "aria-hidden": "true" }));
                    m.className = "hit-mark " + shown.kind;
                    cell.title = shown.kind === "erased" ? "The boss erased this letter. Click to bring it back." : "The boss changed this letter. Click to bring yours back.";
                } else if (mark) { mark.remove(); cell.removeAttribute("title"); }
            }
        }
        boardEl.classList.toggle("solved", game.solved && !game.surrendered);
        boardEl.dataset.dir = game.direction;
        boardEl.classList.toggle("surrendered", game.surrendered);
        document.querySelectorAll("#helpers button:not(#report-btn)").forEach(b => { b.disabled = game.solved; });
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
            if (item && !U.touch()) scrollClueIntoList(item);
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
                // right: every letter is correct (only right words count in a boss fight, so spamming letters does nothing)
                Bus.emit("word", { entry, cells, right: cells.every(([r, c]) => game.letters[r][c] === game.puzzle.solution[r][c]) });
                cells.forEach(([r, c], i) => setTimeout(() => game.cells[r] && U.restart(game.cells[r][c], "wave"), i * 50));
            }
        }
        saveProgress();
    }

    // Keep the active clue visible inside its own scrolling list, without moving the page (scrollIntoView also
    // scrolls the whole window, which made the page jump when you clicked a square)
    function scrollClueIntoList(item) {
        let box = item.parentElement;
        while (box && box !== document.body) {
            const oy = getComputedStyle(box).overflowY;
            if ((oy === "auto" || oy === "scroll") && box.scrollHeight > box.clientHeight) break;
            box = box.parentElement;
        }
        if (!box || box === document.body) return;
        const b = box.getBoundingClientRect(), r = item.getBoundingClientRect();
        if (r.top < b.top) box.scrollBy({ top: r.top - b.top - 6, behavior: "smooth" });
        else if (r.bottom > b.bottom) box.scrollBy({ top: r.bottom - b.bottom + 6, behavior: "smooth" });
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
        if (p && p.mode === "campaign") { pointsTodayEl.textContent = Campaign.bestLine(p); return; }
        if (record) parts.push(record.surrendered ? `Today's ${cap(p.difficulty)}: Revealed` : `Today's ${cap(p.difficulty)}: ${record.points} pts`);
        if (streaks.current > 0) parts.push(`\u{1F525} ${streaks.current}-Day Streak`);
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
        const boss = isDaily ? all[today + "-boss"] : null;                 // the Daily Boss button gets its ✓ too
        $("#boss-mode").classList.toggle("done", !!boss);
    }

    // ---------------------------------------------------------------------------------------------
    // Winning
    // ---------------------------------------------------------------------------------------------
    // the fastest saved daily at this difficulty (null: none yet)
    function bestTime(difficulty) {
        const t = Object.values(scores()).filter(r => r.difficulty === difficulty && !r.surrendered && typeof r.seconds === "number").map(r => r.seconds);
        return t.length ? Math.min(...t) : null;
    }
    function isSolved() {
        const size = game.puzzle.size;
        for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
            if (!isBlock(row, col) && game.letters[row][col] !== game.puzzle.solution[row][col]) return false;
        }
        return true;
    }

    // Today's dailies that aren't done yet. A saved score counts, and so does a board that's solved on screen in
    // this visit (a solve whose score was saved before), so the mascot never asks for one you finished.
    function dailiesLeft(seed) {
        const all = scores(), day = seedDay(seed);
        return ["easy", "medium", "hard", "challenge", "boss"].filter(d => {
            if (all[day + "-" + d]) return false;
            if (d === "boss") return true;                      // the Daily Boss: done once its score is saved
            const slot = "daily-" + d;
            if (game.puzzle && slotOf(game.puzzle) === slot) return !game.solved;
            const other = savedGames[slot];
            return !(other && other.solved && seedDay(other.seed) === day);
        });
    }

    function checkForWin() {
        if (game.solved || !isSolved()) return false;
        if (game.puzzle.mode === "campaign" && Campaign.nextPhase(game)) return false;     // a boss's phase 2 starts instead
        game.solved = true;
        const p = game.puzzle;
        const info = { mode: p.mode, difficulty: p.difficulty, seconds: game.seconds, checked: game.squaresChecked, revealed: game.squaresRevealed, checks: game.checks };
        if (p.mode === "daily") {
            const dayWasDone = todayIsDone(scores()), before = bestTime(p.difficulty);
            info.breakdown = scoreBreakdown(p.difficulty, game.seconds, game.squaresChecked, game.squaresRevealed);
            info.points = info.breakdown.total;
            info.counted = saveDailyScore(p, info.points);
            info.scoreKey = scoreKey(p);
            info.firstToday = info.counted && !dayWasDone;
            info.streak = calculateStreaks(scores()).current;
            info.left = dailiesLeft(p.seed);
            if (!info.counted) info.note = "This daily was already completed, so no extra points.";
            else if (before != null && game.seconds < before) info.best = before;     // a new personal best for this difficulty
        } else if (p.mode === "campaign") {
            Object.assign(info, Campaign.onWin(game, p));
            // the Daily Boss is the 5th daily: points, the streak, the week. Every attempt costs 40, and the day's BEST
            // score is kept, so a rematch can still improve it
            if (info.campaign && info.campaign.special === "daily") {
                const day = (Campaign.playing.date || "").replace(/-/g, "") || dayKey(new Date());
                const dayWasDone = todayIsDone(scores());
                info.daily = true;
                const lost = info.campaign.priorTries || 0;                 // the attempts before this one
                info.breakdown = bossScoreBreakdown(info.campaign.stars, game.squaresChecked, game.squaresRevealed, lost);
                info.points = info.breakdown.total;
                const before = scores()[day + "-boss"];
                info.counted = saveScore(day + "-boss", "boss", info.points, false, info.campaign.stars, lost + 1, true);
                if (before && info.counted) info.note = `New best today: ${info.points} points (it was ${before.points}).`;
                info.scoreKey = day + "-boss";
                info.firstToday = info.counted && !dayWasDone;
                info.streak = calculateStreaks(scores()).current;
                info.left = dailiesLeft(Number(day + "0"));
                if (!info.counted) info.note = `Your best today is still ${before ? before.points : 0} points.`;
            }
        } else {
            info.note = "Unlimited puzzles don't earn points.";
        }
        info.unlocked = Achievements.onWin(info, Worlds.current.id);
        game.result = {
            kind: "win",
            title: "Solved",
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
        const w = Worlds.current, puzzle = game.puzzle;
        Mascot.hush();
        // the win animations follow the board while they play (FX.anchor)
        const unanchor = FX.anchor(boardEl);
        try {
            if (info.campaign && info.campaign.boss) await FX.cinematic(c => Campaign.bossFinale(c, game));
            if (w && w.celebrate) await FX.cinematic(c => w.celebrate(c, { boardEl, game, info }));
        } finally { unanchor(); }
        if (info.campaign && info.campaign.boss && info.campaign.firstClear) await FX.cinematic(c => Campaign.storyAfterBoss(c, info));   // its page goes into the Everbook
        // the Cursed Angel beaten for the first time: the story is over, so the credits roll after its epilogue
        // (skipping the epilogue doesn't skip them: each has its own skip)
        if (info.campaign && info.campaign.boss && info.campaign.firstClear && info.campaign.epilogue && game.puzzle === puzzle) await Credits.show({ ending: true });
        // they moved on to another puzzle or page during the animation: don't open these results over it
        // (they wait behind the board's Results button for when they come back)
        if (game.puzzle !== puzzle) return;
        game.celebrating = false;
        if (!["daily", "unlimited", "level"].includes(U.view())) { render(); return; }
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
            `<div class="streak-text"><span class="streak-num">${n}</span><span class="streak-label">Day Streak · Best ${streaks.best}</span></div>` });
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
            U.el("small", { class: "res-kicker", text: info.campaign ? (info.campaign.special ? "BOSS" : `${info.campaign.world === "rift" ? "SECRET WORLD" : "WORLD " + (info.campaign.si + 1)} · ${info.campaign.boss ? "BOSS FIGHT" : "LEVEL " + info.campaign.level}`) : (p.mode === "daily" ? "DAILY" : "UNLIMITED") + " · " + p.difficulty.toUpperCase() }),
            U.el("h2", { id: "res-title", class: "res-title", text: info.campaign ? (info.campaign.boss ? "Boss Defeated" : "Level Cleared") : U.pick(["Solved", "Brilliant", "Nailed It", "Well Done"]) }),
            U.el("div", { class: "res-time" }, U.el("span", { text: "TIME" }), U.el("b", { text: U.fmtTime(info.seconds) })));
        if (info.best != null) {
            card.appendChild(U.el("div", { class: "res-pb" }, U.el("b", { text: "New Personal Best" }), U.el("span", { text: `${cap(p.difficulty)} · ${U.fmtTime(info.best - info.seconds)} faster` })));
            setTimeout(() => { if (card.isConnected) Sound.play("achievement"); }, 700);
        }
        const tally = U.el("div", { class: "res-tally" });
        card.appendChild(tally);
        if (info.breakdown && (info.counted || info.daily)) {           // (a Daily Boss rematch shows what it scored even when it isn't a new best)
            const b = info.breakdown;
            const rows = b.boss ? [["Beat the Boss", b.base, "+"], [`Stars (${"★".repeat(b.stars)}${"☆".repeat(3 - b.stars)})`, b.speed, "+"]]
                : [["Solved (" + cap(p.difficulty) + ")", b.base, "+"], ["Speed Bonus", b.speed, "+"]];
            if (b.tries) rows.push([`Earlier Attempts (${b.lostTries})`, b.tries, "−"]);
            if (b.check) rows.push(["Check Penalty", b.check, "−"]);
            if (b.reveal) rows.push(["Reveal Penalty", b.reveal, "−"]);
            rows.forEach(([label, value, sign], i) => {
                const v = U.el("b", { text: sign + "0" });
                tally.appendChild(U.el("div", { class: "res-row", style: { "--i": i } }, U.el("span", { text: label }), v));
                setTimeout(() => { if (!card.isConnected) return; FX.countUp(v, value, { dur: 500, fmt: x => sign + Math.round(x) }); Sound.play("coin"); }, 350 + i * 260);
            });
            const total = U.el("b", { text: "0" });
            tally.appendChild(U.el("div", { class: "res-row total", style: { "--i": rows.length } }, U.el("span", { text: "Total" }), total));
            setTimeout(() => { if (!card.isConnected) return; FX.countUp(total, b.total, { dur: 900 }); Sound.play("sparkle"); }, 350 + rows.length * 260);
        }
        if (info.campaign) campaignResults(card, info.campaign);
        if (info.note) card.appendChild(U.el("p", { class: "res-note", text: info.note }));
        if ((p.mode === "daily" || info.daily) && info.counted && typeof Leaderboard !== "undefined") {
            const box = U.el("div", { class: "res-leader" });               // the World Leaderboard: post this daily
            card.appendChild(box);
            Leaderboard.after({ key: info.scoreKey, ...scores()[info.scoreKey] }, box);
        }
        if (p.mode === "daily" || info.daily) {
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
        if (info.campaign && info.campaign.special) {
            const k = info.campaign.special;
            actions.appendChild(U.el("button", { type: "button", class: "btn primary", text: k === "daily" ? "Fight Again" : "New Boss", onclick: () => { closeResults(); Campaign.playSpecial(k); } }));
            actions.appendChild(U.el("button", { type: "button", class: "btn", text: k === "daily" ? "Back to Daily" : "Back to Unlimited", onclick: () => { closeResults(); Campaign.backToMode(); } }));
        } else if (info.campaign) {
            const n = info.campaign.next;
            if (n) actions.appendChild(U.el("button", { type: "button", class: "btn primary", text: n.level === 1 ? `On to ${Worlds.byId[n.world].name}` : n.level === 5 ? "Boss" : `Level ${n.level}`, onclick: () => { closeResults(); Campaign.next(n); } }));
            actions.appendChild(U.el("button", { type: "button", class: "btn", text: "Map", onclick: () => { closeResults(); location.hash = "#campaign"; } }));
        } else if (p.mode === "daily" && info.left && info.left.length) {
            const next = info.left[0];
            if (next === "boss") actions.appendChild(U.el("button", { type: "button", class: "btn primary", text: "Fight Today's Boss", onclick: () => { closeResults(); Campaign.playSpecial("daily"); } }));
            else actions.appendChild(U.el("button", { type: "button", class: "btn primary", text: `Play ${cap(next)}`, onclick: () => { closeResults(); switchDifficulty("daily", next); } }));
        } else if (p.mode === "unlimited") {
            actions.appendChild(U.el("button", { type: "button", class: "btn primary", text: "New Puzzle", onclick: () => { closeResults(); showPicker(); } }));
        }
        if (!info.campaign) actions.appendChild(U.el("button", { type: "button", class: "btn", text: "Share", onclick: e => share(info, e.currentTarget) }));
        // after a boss fight there's no going back to the board: the buttons above move you on
        const bossEnd = !!(info.campaign && info.campaign.boss);
        if (!bossEnd) {
            actions.appendChild(U.el("button", { type: "button", class: "btn ghost", text: "See Board", onclick: closeResults }));
            modal.addEventListener("pointerdown", e => { if (e.target === modal) closeResults(); });
        } else modal.classList.add("locked");
        overlay.appendChild(modal);
        requestAnimationFrame(() => modal.classList.add("in"));
        const first = actions.querySelector("button");
        if (first) setTimeout(() => first.focus({ preventScroll: true }), 300);
        Bus.emit("results", info);
    }
    // the campaign part of the results card: stars that pop in one by one, what earned them, coins
    function campaignResults(card, c) {
        const row = U.el("div", { class: "res-stars", "aria-label": `${c.stars} of 3 stars` });
        for (let i = 0; i < 3; i++) {
            const star = U.el("span", { class: "res-star", text: "★" });
            row.appendChild(star);
            if (i < c.stars) setTimeout(() => { if (!star.isConnected) return; star.classList.add("on"); Sound.play("coin"); }, 450 + i * 330);
        }
        card.appendChild(row);
        card.appendChild(U.el("ul", { class: "res-earned" }, ...c.earned.map(([text, ok]) => U.el("li", { class: ok ? "ok" : "", text: (ok ? "★ " : "☆ ") + text }))));
        card.appendChild(U.el("p", { class: "res-coins", text: `+${c.coins} Coins · 🪙 ${c.totalCoins}` }));
        if (c.newAbility) {
            card.appendChild(U.el("div", { class: "res-ability" }, U.el("span", { class: "ra-icon", text: c.newAbility.icon }),
                U.el("span", {}, U.el("small", { text: "NEW ABILITY UNLOCKED" }), U.el("b", { text: `${c.newAbility.name} · ${c.freeUses} Free Uses` }))));
            setTimeout(() => { if (card.isConnected) Sound.play("sparkle"); }, 1400);
        }
        // a boss beaten for the first time gives your hero new parts (hero.js), said on the results
        if (c.heroGifts && c.heroGifts.length) {
            card.appendChild(U.el("div", { class: "res-ability res-hero" }, U.el("span", { class: "ra-icon", text: "🎁" }),
                U.el("span", {}, U.el("small", { text: "NEW FOR YOUR HERO" }), U.el("b", { text: c.heroGifts.join(" · ") }))));
            setTimeout(() => { if (card.isConnected) Sound.play("sparkle"); }, 1900);
        }
        if (c.newWorld) card.appendChild(U.el("p", { class: "res-unlock", text: `New World Unlocked: ${c.newWorld.icon} ${c.newWorld.name}` }));
        if (c.finished) card.appendChild(U.el("p", { class: "res-unlock", text: "You Beat the Whole Campaign 🏆" }));
        if (c.secret) card.appendChild(U.el("p", { class: "res-unlock secret", text: `A Secret World Has Opened: ${c.secret.icon} ${c.secret.name}` }));
        if (c.epilogue) card.appendChild(U.el("p", { class: "res-unlock secret", text: "The Cursed Angel Is Beaten. The Everbook Is Safe." }));
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
        if (info.streak > 1) lines.push(`\u{1F525} ${info.streak}-Day Streak`);
        if (!info.checked && !info.revealed) lines.push("\u{1F9E0} No hints");
        const text = lines.join("\n");
        const done = () => { button.textContent = "Copied"; setTimeout(() => { button.textContent = "Share"; }, 1600); };
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
        if (!cells.length) { Sound.play("right"); return; }      // all locked already (so all right): nothing to check, and no charge
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
        if (scope === "puzzle" && !(await U.ask({ title: "Reveal the Whole Puzzle?", text: "This counts as giving up: 0 points, and it won't count toward your streak.", yes: "Reveal it", no: "Keep trying" }))) return;
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
        let text = game.puzzle.mode === "campaign" ? "Level not cleared. Play it again from the map." : "Better luck next time.";
        if (game.puzzle.mode === "daily") {
            const counted = saveDailyScore(game.puzzle, 0, true);
            text = counted ? "0 points, and it doesn't count toward your streak." : "This daily was already completed earlier.";
        }
        game.result = { kind: "surrender", title: "Puzzle Revealed", text };
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
    // A title card doesn't block the board: a key or click skips it (FX.cinematic) and still counts
    let titlePlaying = false;
    const blocked = () => !game.puzzle || (FX.playing && !titlePlaying) || !!overlay.querySelector(".results.in") || document.documentElement.classList.contains("intro-on");
    function touched() { lastInput = performance.now(); idleSaid = false; }

    function clickCell(row, col) {
        if (blocked()) return;
        touched();
        const restored = !game.solved && restoreHit(row, col);   // a square the boss hit: the click puts your letter back
        if (row === game.row && col === game.col) { if (!restored) toggleDirection(); }
        else {
            game.row = row;
            game.col = col;
            if (game.direction === "across" && !game.acrossAt[row][col]) game.direction = "down";
            if (game.direction === "down" && !game.downAt[row][col]) game.direction = "across";
            // the word this way is finished but the crossing word isn't: you most likely want the crossing word
            const here = game.direction === "across" ? game.acrossAt[row][col] : game.downAt[row][col];
            const other = game.direction === "across" ? game.downAt[row][col] : game.acrossAt[row][col];
            if (here && other && isFull(here) && !isFull(other)) game.direction = other.direction;
            if (!restored) Sound.play("move");
        }
        render();
        if (restored) checkForWin();
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
        const wasFull = isFull(currentEntry());           // correcting a finished word: move one square at a time
        if (!isLocked(row, col)) {                       // locked squares (revealed, or checked right): the cursor just moves on
            if (letter !== game.puzzle.solution[row][col] && game.letters[row][col] !== letter) game.typos = (game.typos || 0) + 1;
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
        const empty = ([r, c]) => game.letters[r][c] === "";
        if (wasFull) {
            if (index < cells.length - 1) [game.row, game.col] = cells[index + 1];
        } else {
            // the next empty square in this word (wrapping back to the start), else the next unfinished word
            const next = cells.slice(index + 1).find(empty) || cells.slice(0, index).find(empty);
            if (next) [game.row, game.col] = next;
            else if (!goToNextUnfinished()) { if (index < cells.length - 1) [game.row, game.col] = cells[index + 1]; }
            else return;
        }
        render();
    }
    // Is every square of this word filled in?
    function isFull(entry) {
        return !!entry && cellsOf(entry).every(([r, c]) => game.letters[r][c] !== "");
    }
    // Jump to the first empty square of the next word that isn't finished (false if every word is finished)
    function goToNextUnfinished() {
        const entries = allEntries(), start = entries.indexOf(currentEntry());
        for (let i = 1; i <= entries.length; i++) {
            const entry = entries[(start + i) % entries.length];
            if (!isFull(entry)) { selectEntry(entry); return true; }
        }
        return false;
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
        if (event.key === "Escape" && overlay.querySelector(".results.in:not(.locked)")) { closeResults(); return; }
        if (overlay.querySelector(".results.locked")) return;          // a boss's end screen: no typing on the board behind it
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
        const send = U.el("button", { type: "button", class: "btn primary", text: "Send Report" });
        modal.appendChild(U.el("div", { class: "res-card ask-card report-card" },
            U.el("h2", { id: "report-title", class: "res-title ask-title", text: "Report a Problem" }),
            U.el("label", { for: "report-clue", text: "Which Part?" }), select,
            U.el("label", { for: "report-text", text: "What's Wrong?" }), text, count, err,
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
                FX.toast({ icon: "\u2705", kicker: "REPORT SENT", title: "Thank You", text: "It's saved with this puzzle so it can be fixed." });
                Sound.play("right");
            } catch (e) {
                err.textContent = e.message.startsWith("You've") || e.message.startsWith("The report") ? e.message : "Couldn't reach the server. Please try again.";
                send.disabled = false;
                send.textContent = "Send Report";
            }
        });
        overlay.appendChild(modal);
        requestAnimationFrame(() => modal.classList.add("in"));
        setTimeout(() => text.focus({ preventScroll: true }), 80);
    }

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
    $("#new-puzzle").addEventListener("click", e => { e.currentTarget.blur(); Sound.play("select"); showPicker(); });   // back to the picker, not straight into a paid puzzle
    // Daily Boss / Unlimited Boss: a boss race against today's boss, or a random one (campaign.js)
    $("#boss-mode").addEventListener("click", e => { e.currentTarget.blur(); Sound.play("select"); Campaign.playSpecial(U.view() === "unlimited" ? "unlimited" : "daily"); });

    // ---------------------------------------------------------------------------------------------
    // Showing the game screen (called by app.js for #daily and #unlimited)
    // ---------------------------------------------------------------------------------------------
    function show(view) {
        const level = view === "level" ? Campaign.titles() : null;
        $("#game-title").textContent = level ? level.title : view === "daily" ? "Daily Puzzle" : "Unlimited";
        $("#game-subtitle").textContent = level ? level.sub : view === "daily"
            ? new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
            : "";
        $("#new-puzzle").hidden = view !== "unlimited";
        $("#boss-mode").hidden = view !== "daily" && view !== "unlimited";
        $("#boss-mode").textContent = "Boss";                // just "Boss", on Daily and on Unlimited
        $("#unlimited-left").hidden = view !== "unlimited";
        if (view === "unlimited") drawUnlimitedLeft();
        document.querySelectorAll(".difficulty button[data-difficulty]").forEach(b => b.classList.toggle("active", b.dataset.difficulty === difficultyFor[view]));
        drawDifficultyMarks();
        gameViewEl.classList.toggle("unlimited", view === "unlimited");
        if (view === "unlimited") showPicker();
        else { hidePicker(); showPuzzleFor(view); }
    }
    function showPuzzleFor(view) {
        const slot = slotFor(view, difficultyFor[view]);
        // past the player's midnight with the page still open: yesterday's dailies are replaced by today's
        const stale = p => view === "daily" && p && seedDay(p.seed) !== dayKey(new Date());
        if (stale(lastPuzzle[slot])) { delete lastPuzzle[slot]; delete savedGames[slot]; }
        if (game.puzzle && slotOf(game.puzzle) === slot && !stale(game.puzzle)) {
            loadCounter++;
            statusEl.hidden = true;
            puzzleEl.hidden = false;
            playTitleCard();
            Bus.emit("resume", { puzzle: game.puzzle });      // the same puzzle again: a boss fight puts its panel, arena and music back
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

    // Campaign: start a level over (it was finished or given up, or it's a boss fight)
    // (true: it starts over; false: a level in progress was kept)
    function restartSlot(slot) {
        const saved = game.puzzle && slotOf(game.puzzle) === slot ? snapshot() : savedGames[slot];
        if (saved && !saved.solved && !saved.surrendered && !slot.endsWith("-5")) return false;     // keep a level in progress
        delete savedGames[slot];
        if (game.puzzle && slotOf(game.puzzle) === slot) game.puzzle = null;
        return true;
    }
    // Daily / Unlimited Boss: a new fight gets a new copy of its puzzle (a Rematch keeps the one it has: restartSlot)
    function forgetSlot(slot) {
        delete savedGames[slot];
        delete lastPuzzle[slot];
        if (game.puzzle && slotOf(game.puzzle) === slot) game.puzzle = null;
    }
    // Campaign boss fights: the boss won (or the clock ran out)
    function endLoss({ title, text }) {
        if (!game.puzzle || game.solved) return;
        game.solved = true;
        game.surrendered = true;
        game.result = { kind: "surrender", title, text };
        render();
    }
    // Boss fight abilities: fill in n right letters (a "hint"), or the boss wipes n of yours (never locked ones)
    function giveLetters(n) {
        if (!game.puzzle || game.solved) return;
        const open = scopeCells("puzzle").filter(([r, c]) => game.letters[r][c] !== game.puzzle.solution[r][c]);
        for (const [r, c] of open.sort(() => Math.random() - 0.5).slice(0, n)) {
            game.letters[r][c] = game.puzzle.solution[r][c];
            game.wrong[r][c] = false;
            game.locked[r][c] = true;
            U.restart(game.cells[r][c], "flip");
        }
        render();
        checkForWin();
    }
    function eraseLetters(n) {
        if (!game.puzzle || game.solved) return;
        const filled = scopeCells("puzzle").filter(([r, c]) => game.letters[r][c] && !isLocked(r, c));
        for (const [r, c] of filled.sort(() => Math.random() - 0.5).slice(0, n)) {
            game.letters[r][c] = "";
            game.wrong[r][c] = false;
            U.restart(game.cells[r][c], "shake");
        }
        render();
    }

    // Boss moves that change your letters: [[row, col, letter], ...] ("" wipes it). Locked squares are never touched.
    function setLetters(list) {
        if (!game.puzzle || game.solved) return 0;
        let n = 0;
        for (const [r, c, letter] of list) {
            if (isLocked(r, c) || isBlock(r, c)) continue;
            game.letters[r][c] = letter;
            game.wrong[r][c] = false;
            U.restart(game.cells[r][c], "shake");
            n++;
        }
        render();
        return n;
    }
    // Auto-Fill: the right letters in these squares, locked in
    function fillCells(list) {
        if (!game.puzzle || game.solved) return;
        list.forEach(([r, c], i) => {
            game.letters[r][c] = game.puzzle.solution[r][c];
            game.wrong[r][c] = false;
            game.locked[r][c] = true;
            game.cells[r][c].style.setProperty("--d", (i * 90) + "ms");
            U.restart(game.cells[r][c], "flip");
        });
        render();
        checkForWin();
    }
    // Boss moves: Reboot unlocks your locked letters (not revealed ones); returns the squares it unlocked
    function unlockLetters() {
        const out = [];
        if (!game.puzzle) return out;
        for (const [r, c] of scopeCells("puzzle")) if (game.locked[r][c] && !game.revealed[r][c]) { game.locked[r][c] = false; out.push([r, c]); }
        render();
        return out;
    }
    // Red Pen: mark squares as wrong (or clear the marks) without counting as a Check
    function markCells(list, on) {
        for (const [r, c] of list) if (game.wrong[r]) game.wrong[r][c] = on;
        render();
    }
    // the squares holding a wrong letter
    const wrongCells = () => (game.puzzle ? scopeCells("puzzle").filter(([r, c]) => game.letters[r][c] && game.letters[r][c] !== game.puzzle.solution[r][c]) : []);
    // Truth Mirage: mark the wrong letters (like Check, but free); the marks go when you type over them
    function markWrong() {
        for (const [r, c] of wrongCells()) { game.wrong[r][c] = true; U.restart(game.cells[r][c], "shake"); }
        render();
    }

    // Campaign shop items. A free reveal fills squares in like Reveal but doesn't count as using it (no penalty,
    // the "no Reveal" star stays); the letters lock like revealed ones.
    function revealFree(scope) {
        if (!game.puzzle || game.solved) return 0;
        let n = 0;
        for (const [row, col] of scopeCells(scope)) {
            if (game.letters[row][col] === game.puzzle.solution[row][col]) continue;
            game.letters[row][col] = game.puzzle.solution[row][col];
            game.wrong[row][col] = false;
            game.locked[row][col] = true;
            game.cells[row][col].style.setProperty("--d", (n++ * 40) + "ms");
            U.restart(game.cells[row][col], "flip");
        }
        checkForWin();
        render();
        return n;
    }
    // wipe every wrong letter (not locked ones); returns how many
    function clearWrong() {
        if (!game.puzzle || game.solved) return 0;
        let n = 0;
        for (const [row, col] of scopeCells("puzzle")) {
            const letter = game.letters[row][col];
            if (!letter || isLocked(row, col) || letter === game.puzzle.solution[row][col]) continue;
            game.letters[row][col] = "";
            game.wrong[row][col] = false;
            U.restart(game.cells[row][col], "shake");
            n++;
        }
        render();
        return n;
    }
    // lock every right letter (so a boss can't erase it); returns how many
    function lockRight() {
        if (!game.puzzle || game.solved) return 0;
        let n = 0;
        for (const [row, col] of scopeCells("puzzle")) {
            if (isLocked(row, col) || game.letters[row][col] !== game.puzzle.solution[row][col]) continue;
            game.locked[row][col] = true;
            U.restart(game.cells[row][col], "lock-in");
            n++;
        }
        render();
        return n;
    }
    // Campaign boss phases: swap in the boss's next puzzle, keeping the clock (and the Check/Reveal counts) going
    function startPhase(puzzle) {
        if (saveTimer) flushProgress();
        Worlds.board("reset");
        game.puzzle = puzzle;
        const blank = v => puzzle.solution.map(row => Array.from(row, () => v));
        Object.assign(game, { letters: blank(""), wrong: blank(false), revealed: blank(false), locked: blank(false), solved: false, surrendered: false, celebrating: false, result: null });
        indexEntries(puzzle);
        drawBoard(puzzle);
        drawClues(puzzle);
        const first = puzzle.across[0];
        Object.assign(game, { row: first.row, col: first.col, direction: "across" });
        doneWords = null;
        Worlds.board("attach", boardEl, game);
        drawTimer();
        render();
        lastInput = performance.now();
        Bus.emit("puzzle", { fresh: false, puzzle, phase: true });
    }
    // stop the clock for a while
    // hold the clock until released (a boss fight waiting for the boss's puzzle)
    function holdClock(on) { clockHeld = !!on; }
    function stopClock(seconds) { clockStoppedUntil = Math.max(clockStoppedUntil, performance.now()) + seconds * 1000; }
    const clockStopped = () => Math.max(0, (clockStoppedUntil - performance.now()) / 1000);
    // how many squares are right, of how many
    function progress() {
        if (!game.puzzle) return { right: 0, total: 1 };
        const cells = scopeCells("puzzle");
        return { right: cells.filter(([r, c]) => game.letters[r][c] === game.puzzle.solution[r][c]).length, total: cells.length };
    }

    restoreProgress();
    addEventListener("pagehide", flushProgress);
    document.addEventListener("visibilitychange", () => { if (document.hidden && saveTimer) flushProgress(); });

    return {
        restartSlot, forgetSlot, endLoss, stopSaving, checkWin: checkForWin, markBossChanges, restoreAllHits, hitCount, giveLetters, eraseLetters, setLetters, fillCells, wrongCells, markWrong, isLocked, unlockLetters, markCells, startPhase, revealFree, clearWrong, lockRight, stopClock, holdClock, clockStopped, progress,
        openReport,
        state: game, difficultyFor, scores, show, showPuzzleFor, loadPuzzle, drawDifficultyMarks, streakBadge, render,
        cellsOf, cellEl: (r, c) => (game.cells[r] ? game.cells[r][c] : null),
        openCells: () => game.cells.flat().filter(c => !c.classList.contains("block")),
        closeResults, playTitleCard
    };
})();
