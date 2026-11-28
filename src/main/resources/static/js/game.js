// The game itself: loading puzzles from the server, the board, typing, Check/Reveal, the timer, scoring,
// saving progress, and the results screen.
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
        pencil: [],          // pencil[row][col]: that letter is a guess (shown lighter)
        pencilMode: false,   // the Pencil button is on
        squaresChecked: 0, squaresRevealed: 0, checks: 0,
        typos: 0, itemsUsed: 0,  // wrong letters typed, shop items used (campaign stars)
        celebrating: false,  // the win cinematic is playing
        result: null         // what the result banner says once the puzzle is finished
    };
    const difficultyFor = { daily: Settings.get("difficulty") };
    const lastPuzzle = {};   // slot -> the last puzzle loaded, so coming back to it doesn't fetch a new one
    const savedGames = {};   // slot -> a copy of that slot's game
    let solveWas = "";        // the last --solve written (render)
    // the board's width as --bw, for the size of its letters on the play stage (play.css), set only when it changes
    if (window.ResizeObserver) new ResizeObserver(([e]) => {
        const w = Math.round(e.contentRect.width);
        if (w && String(w) + "px" !== boardEl.style.getPropertyValue("--bw")) boardEl.style.setProperty("--bw", w + "px");
    }).observe(boardEl);
    let loadCounter = 0;     // ignore a slow answer if the player has already asked for something else
    let lastInput = performance.now(), idleSaid = false, clockStoppedUntil = 0, clockHeld = false;

    // Each daily difficulty is its own puzzle, so its own "slot"
    // Campaign levels (#level) each have their own slot too: "campaign-garden-3"
    // The Daily Archive (#past): an earlier day's daily, practice only, each one its own slot: "archive-2026-11-02-hard"
    let pastDate = "";
    const slotFor = (mode, difficulty) => (mode === "level" ? Campaign.slotName() : mode === "past" ? `archive-${pastDate}-${difficulty}` : "daily-" + difficulty);
    const slotOf = puzzle => (puzzle.special ? `special-${puzzle.special}` : puzzle.mode === "campaign" ? `campaign-${puzzle.world}-${puzzle.level}`
        : puzzle.mode === "archive" ? `archive-${puzzle.date}-${puzzle.difficulty}` : slotFor(puzzle.mode, puzzle.difficulty));
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
            checked: game.squaresChecked || 0, revealed: game.squaresRevealed || 0, ...(stars ? { stars } : {}), ...(attempts ? { attempts } : {}),
            ...(game.ticket && difficulty !== "boss" ? { ticket: game.ticket } : {}) };
        U.saveRaw(SCORES_KEY, JSON.stringify(all));      // (says so if it couldn't)
        return true;
    }

    // Daily Archive solves (practice): { "20261102-hard": { seconds, surrendered, checked, revealed, at } }, the
    // first solve of each kept (a practice run never touches the day's own score, which lives in the daily scores)
    const ARCHIVE_KEY = "schmoll.archive";
    function archiveRecords() {
        try { return JSON.parse(localStorage.getItem(ARCHIVE_KEY)) || {}; } catch (err) { return {}; }
    }
    function saveArchiveRecord(puzzle, surrendered) {
        const all = archiveRecords(), key = puzzle.date.replace(/-/g, "") + "-" + puzzle.difficulty;
        if (all[key] && !all[key].surrendered) return false;
        all[key] = { seconds: game.seconds, surrendered, checked: game.squaresChecked || 0, revealed: game.squaresRevealed || 0, at: Date.now() };
        U.saveRaw(ARCHIVE_KEY, JSON.stringify(all));
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
        const mine = slotOf(game.puzzle);
        all[mine] = { puzzle: game.puzzle, state: snapshot(), difficulty: game.puzzle.difficulty, at: Date.now() };
        // the archive keeps its 12 most recently played games (finished ones go first)
        const past = Object.keys(all).filter(k => k.startsWith("archive-") && k !== mine)
            .sort((a, b) => (all[a].state && all[a].state.solved ? 0 : 1) - (all[b].state && all[b].state.solved ? 0 : 1) || (all[a].at || 0) - (all[b].at || 0));
        while (past.length > 11) delete all[past.shift()];
        try {
            localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
        } catch (err) {
            // full: finished puzzles are only kept to show their board again, so they go first
            for (const k of Object.keys(all)) if (k !== mine && all[k] && all[k].state && all[k].state.solved) delete all[k];
            U.saveRaw(PROGRESS_KEY, JSON.stringify(all));
        }
    }
    // A short fingerprint of a puzzle's answers and clues: saved letters only go back onto the exact same puzzle
    const fingerprint = p => U.hash(JSON.stringify([p.solution, p.across.map(e => e.clue), p.down.map(e => e.clue)]));
    // A saved game that doesn't fit its puzzle (damaged, or from an old version) is skipped instead of restored
    const grid = (g, n) => Array.isArray(g) && g.length === n && g.every(r => Array.isArray(r) && r.length === n);
    function sane(saved) {
        const p = saved && saved.puzzle, s = saved && saved.state;
        if (!p || !s || typeof s !== "object" || !Array.isArray(p.solution) || !Array.isArray(p.across) || !Array.isArray(p.down)) return false;
        const n = p.solution.length;
        return n > 0 && grid(s.letters, n) && grid(s.wrong, n) && grid(s.revealed, n) && (s.locked == null || grid(s.locked, n));
    }
    function restoreProgress() {
        const all = loadProgress();
        for (const slot of ["daily-easy", "daily-medium", "daily-hard", "daily-challenge"]) {
            const saved = all[slot];
            if (!sane(saved)) continue;
            if (seedDay(saved.puzzle.seed) !== dayKey(new Date())) continue;                       // an old daily
            if (saved.state.print == null) saved.state.print = fingerprint(saved.puzzle);           // saved before fingerprints
            // dailies are always fetched again (the server just reads its saved file), so a daily that was
            // regenerated on the server replaces the old copy
            savedGames[slot] = saved.state;
        }
        // campaign levels and archive dailies are fixed puzzles: keep them (and their games), except boss fights, which always start over
        for (const [slot, saved] of Object.entries(all)) {
            if (!(slot.startsWith("campaign-") || slot.startsWith("archive-")) || !sane(saved)) continue;
            lastPuzzle[slot] = saved.puzzle;
            if (!slot.endsWith("-5")) savedGames[slot] = saved.state;
        }
    }
    function snapshot() {
        return JSON.parse(JSON.stringify({
            seed: game.puzzle.seed, print: fingerprint(game.puzzle), letters: game.letters, wrong: game.wrong, revealed: game.revealed, locked: game.locked, pencil: game.pencil,
            seconds: game.seconds, solved: game.solved, surrendered: game.surrendered, checks: game.checks,
            squaresChecked: game.squaresChecked, squaresRevealed: game.squaresRevealed, typos: game.typos, itemsUsed: game.itemsUsed,
            row: game.row, col: game.col, direction: game.direction, result: game.result, ticket: game.ticket || null, revealWords: game.revealWords || 0
        }));
    }
    function restore(saved) {
        Object.assign(game, {
            letters: saved.letters, wrong: saved.wrong, revealed: saved.revealed, seconds: saved.seconds,
            locked: saved.locked || saved.letters.map(row => row.map(() => false)),      // older saves had no locks
            pencil: saved.pencil || saved.letters.map(row => row.map(() => false)),
            solved: saved.solved, surrendered: saved.surrendered, squaresChecked: saved.squaresChecked,
            squaresRevealed: saved.squaresRevealed, checks: saved.checks || 0, typos: saved.typos || 0, itemsUsed: saved.itemsUsed || 0,
            row: saved.row, col: saved.col, direction: saved.direction, celebrating: false, ticket: saved.ticket || null, revealWords: saved.revealWords || 0
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
    const bonusEl = $("#time-bonus"), bonusPts = $("#time-bonus-pts"), bonusLeft = $("#time-bonus-left");
    function drawTimer() {
        timerEl.textContent = U.fmtTime(game.seconds);
        // a daily that still counts: the time bonus now, and how long until it drops
        const p = game.puzzle;
        const show = !!p && p.mode === "daily" && !game.solved && dailyStanding(seedDay(p.seed)) !== "past";
        bonusEl.hidden = !show;
        if (!show) return;
        const { bonus, left } = timeBonusNow(p.size, game.seconds);
        bonusPts.textContent = "+" + bonus;
        bonusLeft.textContent = left == null ? "" : U.fmtTime(left);
        bonusEl.classList.toggle("soon", left != null && left <= 10);
        bonusEl.classList.toggle("gone", bonus === 0);
        bonusEl.title = left == null ? "No time bonus left" : `Time bonus: +${bonus}. It drops to +${Math.max(0, bonus - SCORING.timeBonusStep)} in ${U.fmtTime(left)}.`;
    }

    // Midnight with a daily on screen: say so once when the day changes (the puzzle still counts for its own day for
    // 15 minutes) and again when those minutes are up (from then on it's practice). A tab left open overnight asks
    // the same when it's looked at again. A finished daily is simply replaced by today's.
    let midnightAsked = "";
    async function checkMidnight() {
        const p = game.puzzle;
        if (!p || p.mode !== "daily" || U.view() !== "daily" || puzzleEl.hidden || document.hidden || FX.playing) return;
        const day = seedDay(p.seed), standing = dailyStanding(day);
        if (standing === "today" || game.celebrating) return;
        if (document.querySelector(".results, .ask-modal, .lg-modal")) return;      // after the open dialog closes
        if (game.solved) { show("daily", { fresh: true }); return; }                 // nothing to lose: today's replaces it
        if (midnightAsked === day + standing) return;
        midnightAsked = day + standing;
        const yes = await U.ask(standing === "grace"
            ? { title: "It's a New Day", text: "Today's puzzles are ready. Finish this one in the next 15 minutes and it still counts for its day. After that it's practice.", yes: "Go to Today's", no: "Keep Playing" }
            : { title: "This Puzzle Is From an Earlier Day", text: "Today's puzzles are ready. You can finish this one for practice, with no points or streak.", yes: "Go to Today's", no: "Keep Playing" });
        if (yes && U.view() === "daily" && game.puzzle === p) show("daily", { fresh: true });
    }
    setInterval(checkMidnight, 15000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) setTimeout(checkMidnight, 800); });

    // ---------------------------------------------------------------------------------------------
    // Loading puzzles
    // ---------------------------------------------------------------------------------------------
    async function loadPuzzle(mode, difficulty) {
        const myLoad = ++loadCounter;
        statusEl.innerHTML = "";
        statusEl.append(U.el("span", { class: "spinner", "aria-hidden": "true" }),
            "Generating clues…");
        statusEl.classList.remove("error");
        statusEl.hidden = false;
        puzzleEl.hidden = true;
        try {
            const date = pastDate;
            let url = mode === "level" ? Campaign.apiUrl() : mode === "past" ? `/api/archive?date=${date}&difficulty=${encodeURIComponent(difficulty)}` : "/api/" + mode + "?difficulty=" + encodeURIComponent(difficulty);
            if (mode === "daily") { const d = dayKey(new Date()); url += `&date=${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`; }   // the player's own date (time zones)
            const puzzle = await U.fetchJson(url);
            if (myLoad !== loadCounter) return;
            if (mode === "level") Object.assign(puzzle, { world: Campaign.playing.world, level: Campaign.playing.level, special: Campaign.playing.special || undefined });   // which level it is
            if (mode === "past") Object.assign(puzzle, { mode: "archive", date, kinds: pastKinds || undefined });
            lastPuzzle[slotOf(puzzle)] = puzzle;
            if (U.view() !== mode || (mode !== "level" && difficultyFor[mode] !== difficulty) || (mode === "past" && date !== pastDate) || (mode === "level" && slotOf(puzzle) !== Campaign.slotName())) return;   // they moved on
            startGame(puzzle);
            statusEl.hidden = true;
            puzzleEl.hidden = false;
            playTitleCard();
        } catch (err) {
            if (myLoad !== loadCounter || U.view() !== mode) return;
            U.failCard(statusEl, err, { retry: () => { if (U.view() === mode) loadPuzzle(mode, difficulty); } });
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
                letters: blank(""), wrong: blank(false), revealed: blank(false), locked: blank(false), pencil: blank(false), seconds: 0, solved: false, surrendered: false,
                squaresChecked: 0, squaresRevealed: 0, checks: 0, typos: 0, itemsUsed: 0, celebrating: false, result: null, ticket: null, revealWords: 0
            });
        }
        drawRevealWords();
        // today's daily: a start ticket from the server, so the leaderboard can trust the time (a game restored without
        // one gets one only if it has hardly started, or its time wouldn't match)
        if (puzzle.mode === "daily" && !game.solved && !game.ticket && game.seconds < 90 && dailyStanding(seedDay(puzzle.seed)) === "today" && typeof Leaderboard !== "undefined") {
            Leaderboard.ticket(seedDay(puzzle.seed), puzzle.difficulty).then(t => { if (t && game.puzzle === puzzle && !game.ticket) { game.ticket = t; saveProgress(); } });
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
        fitPhone();
    }

    // A screen reader hears the clue when the word changes, how long it is and what's in it so far, and "Solved" at the
    // end (a hidden polite live region, so it waits for whatever is being read)
    let liveEl = null;
    function speak(text) {
        if (!liveEl) { liveEl = U.el("p", { class: "sr", "aria-live": "polite", role: "status" }); document.body.appendChild(liveEl); }
        liveEl.textContent = "";
        requestAnimationFrame(() => { liveEl.textContent = text; });
    }
    function announce(entry) {
        const cells = cellsOf(entry), letters = cells.map(([r, c]) => game.letters[r][c] || "blank").join(", ");
        speak(`${entry.number} ${entry.direction === "across" ? "Across" : "Down"}: ${entry.clue}. ${cells.length} letters: ${letters}.`);
    }
    Bus.on("win", () => speak("Solved."));

    // On a phone the on-screen keyboard sits over the bottom of the page: bring the timer row to the top of the
    // screen so the clue, the whole board and the keyboard are all in view (the title and the tabs are a scroll up)
    const phoneQuery = matchMedia("(pointer: coarse) and (max-width: 780px)");
    function fitPhone() {
        if (!phoneQuery.matches) return;
        requestAnimationFrame(() => {
            const hud = document.querySelector("#puzzle .hud-row");
            if (!hud || !hud.offsetParent) return;
            const top = Math.max(0, hud.getBoundingClientRect().top + scrollY - 16);
            if (Math.abs(scrollY - top) > 4) scrollTo({ top, behavior: U.motion() === "full" ? "smooth" : "auto" });
        });
    }

    function cardInfo(puzzle) {
        if (puzzle.mode === "campaign") return Campaign.cardInfo(puzzle) || {};
        const past = puzzle.mode === "archive", d = past ? new Date(puzzle.date + "T12:00") : new Date();
        return {
            mode: puzzle.mode, difficulty: puzzle.difficulty,
            kicker: past ? "FROM THE ARCHIVE" : "TODAY'S DAILY",
            title: "Daily · " + cap(puzzle.difficulty),
            sub: d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }),
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
                if (isBlock(row, col)) { cell.classList.add("block"); cell.setAttribute("aria-hidden", "true"); }
                else {
                    cell.setAttribute("role", "img");
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
        if (U.motion() === "full") U.restart(boardEl.parentElement, "drop");          // (the play stage: the board lands from above)
        // the deal over, take its animation off: while it's on, every square is its own layer, so a world's board
        // decorations (the Garden's vines) were drawn over the letters
        const dealt = boardEl.firstChild;
        clearTimeout(dealTimer);
        dealTimer = setTimeout(() => { if (boardEl.firstChild === dealt) boardEl.classList.remove("deal"); }, 600 + puzzle.size * puzzle.size * 20);
    }
    let dealTimer = 0;

    // The first time the play stage is drawn, the browser builds the GPU programs for everything on it, which stalls
    // that frame. While Home sits idle, a stand-in of the stage (a copy of the screen with a sample board, clue bar and
    // clues) is drawn once at near-zero opacity and removed: nothing is fetched and the real screen isn't touched. The
    // play stage's rules hang off the page root (html[data-view="game"]), so they're copied onto the stand-in.
    let stageWarmed = false;
    async function warmStage() {
        if (stageWarmed || game.puzzle) return;
        stageWarmed = true;
        const PREFIX = 'html[data-view="game"]:not(.boss-stage):not(.in-boss)';
        const split = sel => { const out = []; let depth = 0, start = 0;
            for (let i = 0; i < sel.length; i++) { const ch = sel[i]; if (ch === "(") depth++; else if (ch === ")") depth--; else if (ch === "," && !depth) { out.push(sel.slice(start, i)); start = i + 1; } }
            return out.concat(sel.slice(start)).map(s => s.trim()); };
        const copy = rules => {
            let css = "";
            for (const r of rules) {
                if (r instanceof CSSMediaRule) { const inner = copy(r.cssRules); if (inner) css += `@media ${r.conditionText}{${inner}}`; continue; }
                if (!(r instanceof CSSStyleRule) || !r.selectorText.includes(PREFIX)) continue;
                const sels = split(r.selectorText).filter(s => s.startsWith(PREFIX)).map(s => ".warm-play" + s.slice(PREFIX.length));
                if (sels.length) css += `${sels.join(",")}{${r.style.cssText}}`;
            }
            return css;
        };
        let css = "";
        for (const sheet of document.styleSheets) { try { if (sheet.href && /play\.css/.test(sheet.href)) css += copy(sheet.cssRules); } catch (err) { /* not readable */ } }
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(css + ".warm-play{position:fixed;inset:0;z-index:2147483000;opacity:.004;pointer-events:none;overflow:hidden}");
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
        // the stand-in: the screen's own markup, a 5x5 board mid-solve, the spotlight and both clue lists
        const view = gameViewEl.cloneNode(true);
        view.hidden = false;
        view.querySelectorAll("[hidden]").forEach(el => { if (el.id === "puzzle") el.hidden = false; });
        view.querySelector("#status").hidden = true;
        const board = view.querySelector("#board"), word = "CRANE", blocks = new Set(["0,4", "4,0"]);
        board.style.setProperty("--size", 5);
        board.dataset.dir = "across";
        for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
            const cell = U.el("div", { class: "cell", style: { "--i": r * 5 + c } });
            if (blocks.has(r + "," + c)) cell.classList.add("block");
            else {
                if (r === 0 || c === 0) cell.append(U.el("span", { class: "num", text: String(r * 5 + c + 1) }));
                const ch = r === 1 ? word[c] : r === 2 && c < 2 ? "AB"[c] : "";
                cell.append(U.el("span", { class: "ltr", text: ch }));
                cell.classList.toggle("filled", !!ch);
                cell.classList.toggle("in-word", r === 1);
                cell.classList.toggle("selected", r === 1 && c === 2);
                if (r === 2 && c === 1) cell.classList.add("pencil");
                if (r === 3 && c === 3) cell.classList.add("locked");
            }
            board.append(cell);
        }
        const bar = view.querySelector("#clue-bar");
        bar.append(U.el("span", { class: "cb-num", text: "5A" }), U.el("span", { class: "cb-dir", text: "" }), U.el("span", { class: "cb-text", text: "Tall wading bird" }),
            U.el("span", { class: "cb-slots" }, ...[...word].map((ch, i) => U.el("i", { class: "cb-slot" + (i === 2 ? " cur" : ""), text: ch })), U.el("small", { text: "5 Letters" })),
            U.el("span", { class: "cb-cross" }, U.el("b", { text: "3 Down" }), U.el("span", { text: "Sample clue" })));
        for (const id of ["#across-clues", "#down-clues"]) {
            const list = view.querySelector(id);
            for (let i = 0; i < 5; i++) list.append(U.el("li", { class: i === 1 && id === "#across-clues" ? "active" : i === 0 ? "done" : "", style: { "--i": i, "--k": (i / 5).toFixed(2) } },
                U.el("span", { class: "clue-num", text: String(i + 1) }), U.el("span", { class: "clue-text", text: "A sample clue for the board" })));
        }
        // (it keeps the screen's ids, which its styles use; it's added at the end of the page, so anything looking one
        // up still finds the real screen first, and it's gone within a second)
        const holder = U.el("div", { class: "warm-play", "aria-hidden": "true", inert: "" }, U.el("main", {}, view));
        document.body.append(holder);
        try {
            await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(res))));
            await U.wait(700);
        } finally {
            holder.remove();
            document.adoptedStyleSheets = document.adoptedStyleSheets.filter(s => s !== sheet);
        }
        await warmTitleCard();
        Anim.warm(Worlds.current && Worlds.current.rive ? [Worlds.current.rive] : []);     // (the win's Rive set piece, loaded ahead)
    }
    // The world's title card is the biggest first-time cost of all: it's played once, unseen and unheard (its sounds,
    // bursts and shakes held back for that moment), and cut short.
    async function warmTitleCard() {
        const w = Worlds.current;
        if (!w || !w.titleCard || U.motion() === "still" || FX.playing || ["daily", "level"].includes(U.view())) return;
        const held = { play: Sound.play, burst: FX.burst, shake: FX.shake, flash: FX.flash, ring: FX.ring }, none = () => {};
        Object.assign(Sound, { play: none });
        Object.assign(FX, { burst: none, shake: none, flash: none, ring: none });
        document.documentElement.classList.add("tc-warming");
        const cleanups = [], c = { skipped: false, wait: ms => U.wait(Math.min(ms, 450)), cleanup: fn => cleanups.push(fn), later: none };
        const d = new Date();
        try {
            await w.titleCard(c, { mode: "daily", difficulty: "medium", kicker: "TODAY'S DAILY", title: "Daily · Medium",
                sub: d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }), stardate: "2026.01.01" });
        } catch (err) { console.error("warm title card", err); }
        finally {
            for (const fn of cleanups) { try { fn(); } catch (err) { /* already gone */ } }
            document.documentElement.classList.remove("tc-warming");
            Object.assign(Sound, { play: held.play });
            Object.assign(FX, { burst: held.burst, shake: held.shake, flash: held.flash, ring: held.ring });
        }
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
        if (!game.pencil || game.pencil.length !== size) game.pencil = game.puzzle.solution.map(row => Array.from(row, () => false));
        let filled = 0, open = 0;
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                if (isBlock(row, col)) continue;
                open++;
                const cell = game.cells[row][col], letter = game.letters[row][col];
                if (letter) filled++;
                // (only a letter that changed is written: writing every square's text each time made the browser restyle
                // and lay out the whole board with every key)
                const ltr = cell._ltr || (cell._ltr = cell.querySelector(".ltr"));
                if (ltr.textContent !== letter) ltr.textContent = letter;
                if (game.pencil[row][col] && (!letter || isLocked(row, col))) game.pencil[row][col] = false;
                cell.classList.toggle("filled", !!letter);
                cell.classList.toggle("pencil", game.pencil[row][col]);
                cell.classList.toggle("in-word", current !== null && entryCovers(current, row, col));
                cell.classList.toggle("selected", row === game.row && col === game.col && !game.solved);
                cell.classList.toggle("wrong", game.wrong[row][col]);
                cell.classList.toggle("revealed", game.revealed[row][col]);
                cell.classList.toggle("locked", game.locked[row][col] && !game.revealed[row][col]);
                // what a screen reader says for the square (written only when it changes)
                const num = game.puzzle.numbers[row][col];
                const say = `Row ${row + 1}, column ${col + 1}${num ? `, number ${num}` : ""}: ${letter || "blank"}${game.pencil[row][col] ? ", pencilled" : ""}${isLocked(row, col) ? ", locked" : ""}`;
                if (cell._say !== say) { cell._say = say; cell.setAttribute("aria-label", say); }
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
        if (boardEl.dataset.dir !== game.direction) boardEl.dataset.dir = game.direction;
        boardEl.classList.toggle("surrendered", game.surrendered);
        document.querySelectorAll("#helpers button:not(#report-btn)").forEach(b => { b.disabled = game.solved; });
        drawRevealWords();                     // (Reveal Word stays off once a boss phase's 10 are used)
        // which words are full now? Any that weren't before were just finished
        const key = game.puzzle.mode + ":" + game.puzzle.seed;
        const full = new Set(), justDone = [];
        for (const entry of allEntries()) {
            const cells = cellsOf(entry), isFull = cells.every(([r, c]) => game.letters[r][c] !== "");
            const item = game.clueItems.get(entry);
            if (item) {
                item.classList.toggle("active", entry === current); item.classList.toggle("done", isFull);
                const k = (cells.filter(([r, c]) => game.letters[r][c] !== "").length / cells.length).toFixed(2);
                if (item._k !== k) { item._k = k; item.style.setProperty("--k", k); }
            }
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
        if (current && current !== lastClue) announce(current);
        lastClue = current;
        if (current) {
            clueBarEl.innerHTML = "";
            clueBarEl.append(
                U.el("span", { class: "cb-num", text: current.number + (current.direction === "across" ? "A" : "D") }),
                U.el("span", { class: "cb-dir", "aria-hidden": "true", text: current.direction === "across" ? "→" : "↓" }),
                U.el("span", { class: "cb-text", text: current.clue }));
            drawSpotlight(current);
        }
        // the progress ring
        const k = open ? filled / open : 0;
        ringEl.style.strokeDashoffset = String(100 - k * 100);
        pctEl.textContent = Math.round(k * 100) + "%";
        // the world behind the puzzle starts faded and gets its colour back as the squares fill (play.css). (--solve is
        // set only on what uses it, the world's background and the journey: on the page's root it restyled every
        // element on the page with every letter.)
        const solve = (game.solved || U.motion() !== "full" ? 1 : k).toFixed(3);
        if (solve !== solveWas) { solveWas = solve; for (const n of document.querySelectorAll("#world-bg, .jr")) n.style.setProperty("--solve", solve); }
        drawBanner();
        // every square filled and it isn't solved: something is wrong somewhere (said once each time the board fills up)
        const fullNow = open > 0 && filled === open && !game.solved && !isSolved();
        if (fullNow && !boardFull && doneWords && doneKey === key) notQuite();
        boardFull = fullNow;
        Worlds.board("update", game, boardEl);
        if (justDone.length && !game.solved) {
            Sound.play("word");
            for (const [entry, cells] of justDone) {
                Worlds.board("wordDone", entry, cells, boardEl, game);
                // right: every letter is correct (only right words count in a boss fight, so spamming letters does nothing)
                Bus.emit("word", { entry, cells, right: cells.every(([r, c]) => game.letters[r][c] === game.puzzle.solution[r][c]) });
                cells.forEach(([r, c], i) => setTimeout(() => game.cells[r] && U.restart(game.cells[r][c], "wave"), i * 50));
            }
            ripple(justDone[0][1]);
        }
        saveProgress();
    }

    // Under the active clue: the answer so far, one slot a letter (the square you're on is ringed), and the clue
    // that crosses the square you're on. In a boss fight each slot shows what's on its square (snow, ink, a fake
    // letter, a boss's mark...) and the crossing clue follows the clue tricks: Campaign.syncSlots keeps them in step.
    function drawSpotlight(current) {
        const boss = Campaign.isBossLevel(game.puzzle), cells = cellsOf(current);
        clueBarEl.append(U.el("span", { class: "cb-slots", "aria-hidden": "true" },
            ...cells.map(([r, c]) => {
                const hit = boss && hits.get(r + "," + c);
                return U.el("i", { class: "cb-slot" + (r === game.row && c === game.col ? " cur" : "") + (game.pencil[r][c] ? " pen" : "") + (isLocked(r, c) ? " lock" : "") + (hit ? " hit-" + hit.kind : ""), "data-rc": r + "," + c },
                    U.el("span", { class: "ltr", text: game.letters[r][c] }));
            }),
            U.el("small", { text: `${cells.length} Letters` })));
        const other = (current.direction === "across" ? game.downAt : game.acrossAt)[game.row][game.col];
        clueBarEl._cross = other || null;
        if (other) clueBarEl.append(U.el("span", { class: "cb-cross" }, U.el("b", { text: `${other.number} ${other.direction === "across" ? "Across" : "Down"}` }), U.el("span", { text: other.clue })));
        if (boss) Campaign.syncSlots();
    }
    // a finished word sends a wave out across the rest of the board
    function ripple(from) {
        if (U.motion() !== "full" || !from.length) return;
        const cr = from.reduce((n, [r]) => n + r, 0) / from.length, cc = from.reduce((n, [, c]) => n + c, 0) / from.length;
        const inWord = new Set(from.map(([r, c]) => r + "," + c));
        game.cells.forEach((row, r) => row.forEach((cell, c) => {
            if (inWord.has(r + "," + c)) return;
            cell.style.setProperty("--rd", Math.hypot(r - cr, c - cc).toFixed(2));
            U.restart(cell, "ripple");
        }));
    }
    // In a campaign level your hero stands beside the board (the play stage) and reacts to how it's going
    const heroEl = U.el("div", { class: "ps-hero", "aria-hidden": "true", hidden: true });
    boardEl.parentElement.append(heroEl);
    let heroFor = "";
    function drawStageHero() {
        const p = game.puzzle, look = p && p.mode === "campaign" && !p.special && !Campaign.isBossLevel(p) ? Campaign.hero() : null;
        heroEl.hidden = !look;
        if (!look) { heroFor = ""; return; }
        const key = JSON.stringify(look);
        if (key !== heroFor) { heroFor = key; heroEl.innerHTML = Hero.svg(look); }
    }
    const heroDo = what => { if (!heroEl.hidden && U.motion() !== "still") U.restart(heroEl, what); };
    Bus.on("puzzle", drawStageHero);
    Bus.on("resume", drawStageHero);
    Bus.on("word", () => heroDo("hop"));
    Bus.on("win", () => heroDo("cheer"));
    let boardFull = false;
    function notQuite() {
        heroDo("oops");
        U.restart(boardEl, "nope");
        Sound.play("wrong");
        FX.toast({ icon: "!", kicker: "ALMOST", title: "Something's Not Right", text: "Every square is filled, but at least one letter is wrong.", cls: "nope-toast", ms: 3400 });
    }
    // Flow: letters typed one after another without a long pause. Only for the feel of it: the board glows.
    let flow = 0, flowAt = 0, flowTimer = 0;
    function setFlow(n) {
        flow = n;
        const chip = $("#flow-chip"), wrap = boardEl.parentElement;
        wrap.classList.toggle("flowing", n >= 6);
        wrap.style.setProperty("--flow", Math.min(1, n / 16).toFixed(2));
        chip.hidden = n < 6;
        if (n >= 6) { chip.textContent = `Flow ×${n}`; if (n === 6 || n % 5 === 0) U.restart(chip, "pop"); }
    }
    function flowType() {
        const now = performance.now();
        setFlow(now - flowAt < 3500 ? flow + 1 : 1);
        flowAt = now;
        clearTimeout(flowTimer);
        flowTimer = setTimeout(() => setFlow(0), 3600);
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
        if (p && p.mode === "archive") { pointsTodayEl.textContent = "Practice"; return; }
        if (record) parts.push(record.surrendered ? `Today's ${cap(p.difficulty)}: Revealed` : `Today's ${cap(p.difficulty)}: ${record.points} pts`);
        if (streaks.current > 0) parts.push(`\u{1F525} ${streaks.current}-Day Streak`);
        pointsTodayEl.textContent = parts.join(" · ");
    }

    // Daily difficulty buttons get a ✓ (or ×) for today's finished dailies
    function drawDifficultyMarks() {
        const all = scores(), today = dayKey(new Date()), isDaily = U.view() === "daily", isPast = U.view() === "past" && !!pastDate;
        const practice = isPast ? archiveRecords() : null, pastDay = isPast ? pastDate.replace(/-/g, "") : "";
        document.querySelectorAll(".difficulty button[data-difficulty]").forEach(b => {
            const k = b.dataset.difficulty, own = isPast ? all[pastDay + "-" + k] : null;
            const record = isDaily ? all[today + "-" + k] : isPast ? (own && !own.surrendered ? own : practice[pastDay + "-" + k] || own) : null;
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

    // the archive day's other dailies not solved yet (on the day or in practice)
    function archiveLeft(p) {
        const all = scores(), rec = archiveRecords(), day = p.date.replace(/-/g, "");
        const done = k => (all[day + "-" + k] && !all[day + "-" + k].surrendered) || (rec[day + "-" + k] && !rec[day + "-" + k].surrendered);
        return (p.kinds || ["easy", "medium", "hard", "challenge"]).filter(k => k !== p.difficulty && !done(k));
    }
    function checkForWin() {
        if (game.solved || !isSolved()) return false;
        if (game.puzzle.mode === "campaign" && Campaign.nextPhase(game)) return false;     // a boss's phase 2 starts instead
        game.solved = true;
        drawTimer();
        const p = game.puzzle;
        const info = { mode: p.mode, difficulty: p.difficulty, seconds: game.seconds, checked: game.squaresChecked, revealed: game.squaresRevealed, checks: game.checks };
        if (p.mode === "archive") {
            // the Daily Archive: practice. The first solve is remembered for the calendar
            saveArchiveRecord(p, false);
            Object.assign(info, { practice: true, counted: false, archive: true, date: p.date, left: archiveLeft(p) });
        } else if (p.mode === "daily" && dailyStanding(seedDay(p.seed)) === "past") {
            // an earlier day's daily finished after the 15 minutes past midnight: practice
            Object.assign(info, { practice: true, counted: false, left: [], note: "This was an earlier day's daily, so it was practice: no points or streak." });
        } else if (p.mode === "daily") {
            const dayWasDone = todayIsDone(scores()), before = bestTime(p.difficulty);
            info.breakdown = scoreBreakdown(p, game.seconds, game.squaresChecked, game.squaresRevealed);
            info.points = info.breakdown.total;
            info.counted = saveDailyScore(p, info.points);
            info.day = seedDay(p.seed);
            info.grace = dailyStanding(info.day) === "grace";
            const day3 = ["easy", "medium", "hard"].map(d => scores()[info.day + "-" + d]);     // the day's three, for Triple Time
            if (day3.every(r => r && !r.surrendered && typeof r.seconds === "number")) info.trio = day3.reduce((a, r) => a + r.seconds, 0);
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
            const bossDay = info.campaign && info.campaign.special === "daily" ? (Campaign.playing.date || "").replace(/-/g, "") || dayKey(new Date()) : null;
            if (bossDay && dailyStanding(bossDay) === "past") {
                Object.assign(info, { practice: true, counted: false, note: "This was an earlier day's Boss, so it was practice: no points or streak." });
            } else if (bossDay) {
                const day = bossDay;
                const dayWasDone = todayIsDone(scores());
                info.daily = true;
                const lost = info.campaign.priorTries || 0;                 // the attempts before this one
                info.breakdown = bossScoreBreakdown(p, info.campaign.stars, game.squaresChecked, game.squaresRevealed, lost);
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
        if (!["daily", "level", "past"].includes(U.view())) { render(); return; }
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
            U.el("small", { class: "res-kicker", text: info.archive ? `ARCHIVE · ${new Date(p.date + "T12:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }).toUpperCase()} · ${p.difficulty.toUpperCase()}` : (info.campaign ? (info.campaign.special ? "BOSS" : `${(Worlds.byId[info.campaign.world] || {}).secret ? "SECRET WORLD" : "WORLD " + (info.campaign.si + 1)} · ${info.campaign.boss ? "BOSS FIGHT" : "LEVEL " + info.campaign.level}`) : "DAILY · " + p.difficulty.toUpperCase()) + (info.practice ? " · PRACTICE" : "") }),
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
            const per = SCORING.perSquare[b.boss ? "boss" : p.difficulty];
            const rows = b.boss ? [[`${b.squares} Squares × ${per}`, b.base, "+"], [`Stars (${"★".repeat(b.stars)}${"☆".repeat(3 - b.stars)})`, b.speed, "+"]]
                : [[`${b.squares} Squares × ${per}`, b.base, "+"], ["Time Bonus", b.speed, "+"]];
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
            actions.appendChild(U.el("button", { type: "button", class: "btn primary", text: "Fight Again", onclick: () => { closeResults(); Campaign.playSpecial(k); } }));
            actions.appendChild(U.el("button", { type: "button", class: "btn", text: "Back to Daily", onclick: () => { closeResults(); Campaign.backToMode(); } }));
        } else if (info.campaign) {
            const n = info.campaign.next;
            if (n) actions.appendChild(U.el("button", { type: "button", class: "btn primary", text: n.level === 1 ? `On to ${Worlds.byId[n.world].name}` : n.level === 5 ? "Boss" : `Level ${n.level}`, onclick: () => { closeResults(); Campaign.next(n); } }));
            actions.appendChild(U.el("button", { type: "button", class: "btn", text: "Map", onclick: () => { closeResults(); location.hash = "#campaign"; } }));
        } else if (info.archive) {
            const next = info.left && info.left[0];
            if (next) actions.appendChild(U.el("button", { type: "button", class: "btn primary", text: `Play ${cap(next)}`, onclick: () => { closeResults(); switchDifficulty("past", next); } }));
            actions.appendChild(U.el("button", { type: "button", class: next ? "btn" : "btn primary", text: "Archive", onclick: () => { closeResults(); location.hash = "#archive"; } }));
        } else if (p.mode === "daily" && info.left && info.left.length) {
            const next = info.left[0];
            if (next === "boss") actions.appendChild(U.el("button", { type: "button", class: "btn primary", text: "Fight Today's Boss", onclick: () => { closeResults(); Campaign.playSpecial("daily"); } }));
            else actions.appendChild(U.el("button", { type: "button", class: "btn primary", text: `Play ${cap(next)}`, onclick: () => { closeResults(); switchDifficulty("daily", next); } }));
        }
        if (!info.campaign || info.daily) actions.appendChild(U.el("button", { type: "button", class: "btn", text: "Share", onclick: e => share(info, e.currentTarget) }));
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
        card.appendChild(U.el("p", { class: "res-coins" }, `+${c.coins} Coins · `, U.icon("coin"), " " + c.totalCoins));
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
    // The result as text to paste anywhere. It never gives away an answer: the grid only shows how each square was
    // done (🟩 typed, 🟨 checked, 🟦 revealed, ⬛ a black square).
    const SITE = "schmollcrossword.com";
    function shareText(info) {
        const p = game.puzzle;
        const key = info.daily ? (Campaign.playing.date || "").replace(/-/g, "") : seedDay(p.seed);
        const date = /^\d{8}$/.test(key) ? new Date(+key.slice(0, 4), +key.slice(4, 6) - 1, +key.slice(6)).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
        const score = info.archive ? " · From the Archive" : info.practice ? " · Practice" : info.counted || info.daily ? ` · ${info.points} pts` : "";
        const lines = [`Schmoll Crossword${date ? " · " + date : ""}`];
        if (info.daily) {
            const stars = info.campaign && info.campaign.stars || 0;
            lines.push(`Boss: ${Campaign.titles().title.replace(/^Boss: /, "")} ⚔️ ${"★".repeat(stars)}${"☆".repeat(3 - stars)}${score}`);
        } else {
            lines.push(`${cap(p.difficulty)} ✅ ${U.fmtTime(info.seconds)}${score}`);
            for (let r = 0; r < p.size; r++) {
                let row = "";
                for (let c = 0; c < p.size; c++) row += isBlock(r, c) ? "⬛️" : game.revealed[r][c] ? "\u{1F7E6}" : game.locked[r][c] ? "\u{1F7E8}" : "\u{1F7E9}";
                lines.push(row);
            }
            if (!info.checked && !info.revealed) lines.push("\u{1F9E0} No Hints");
        }
        if (info.streak > 1 && !info.practice) lines.push(`\u{1F525} ${info.streak}-Day Streak`);
        lines.push(SITE);
        return lines.join("\n");
    }
    async function share(info, button) {
        const text = shareText(info);
        const said = t => { button.textContent = t; setTimeout(() => { if (button.isConnected) button.textContent = "Share"; }, 1600); };
        // phones and tablets: the system's share sheet (messages, apps); a cancelled share does nothing
        if (navigator.share && U.touch()) {
            try { await navigator.share({ text }); return; } catch (err) { if (err && err.name === "AbortError") return; }
        }
        try {
            await navigator.clipboard.writeText(text);
            said("Copied");
        } catch (err) {
            copyBox(text);                                   // no clipboard (an old browser, or permission refused)
        }
    }
    // The text in a box, selected, to copy by hand
    function copyBox(text) {
        const area = U.el("textarea", { class: "copy-text", readonly: true, rows: String(text.split("\n").length), "aria-label": "Your result" });
        area.value = text;
        const close = U.el("button", { type: "button", class: "btn primary", text: "Done" });
        const modal = U.el("div", { class: "results ask-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "copy-title" },
            U.el("div", { class: "res-card ask-card" }, U.el("h2", { id: "copy-title", class: "res-title ask-title", text: "Copy Your Result" }),
                U.el("p", { class: "ask-text", text: U.touch() ? "Press and hold the text to copy it." : "It's selected: press Ctrl+C (⌘C on a Mac)." }),
                area, U.el("div", { class: "res-actions" }, close)));
        const done = () => { removeEventListener("keydown", onKey, true); U.dialog.close(modal); modal.classList.remove("in"); modal.classList.add("out"); setTimeout(() => modal.remove(), 300); };
        const onKey = e => { if (e.key === "Escape" && U.dialog.top(modal)) { e.preventDefault(); e.stopPropagation(); done(); } };
        close.addEventListener("click", done);
        modal.addEventListener("pointerdown", e => { if (e.target === modal) done(); });
        addEventListener("keydown", onKey, true);
        U.dialog.open(modal);
        overlay.appendChild(modal);
        requestAnimationFrame(() => { modal.classList.add("in"); area.focus(); area.select(); });
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
    // Check: wrong letters get crossed out; right ones are LOCKED in (a check mark in the corner) so they can't
    // be changed. 1 point per square in the scope; squares that are already locked aren't checked (or charged) again.
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
    // Reveal: fill in the right letter wherever it's empty or wrong, 5 points per square; a right letter is locked for
    // free. All = surrender.
    // In a boss fight, Reveal Word can be used at most this many times a phase (it would otherwise win the race)
    const REVEAL_WORDS_PER_PHASE = 10;
    const revealWordsCapped = () => !!game.puzzle && Campaign.isBossLevel(game.puzzle);
    function drawRevealWords() {
        const btn = document.querySelector('#helpers button[data-action="reveal"][data-scope="word"]');
        if (!btn) return;
        const capped = revealWordsCapped(), left = REVEAL_WORDS_PER_PHASE - (game.revealWords || 0);
        btn.textContent = capped ? `Word · ${left}` : "Word";
        btn.disabled = !!game.solved || (capped && left <= 0);
        btn.title = capped ? `${left} Reveal Word${left === 1 ? "" : "s"} left this phase` : "";
    }
    async function reveal(scope) {
        if (scope === "puzzle" && !(await U.ask({ title: "Reveal the Whole Puzzle?", text: "This counts as giving up: 0 points, and it won't count toward your streak.", yes: "Reveal it", no: "Keep trying" }))) return;
        if (scope === "word" && revealWordsCapped() && (game.revealWords || 0) >= REVEAL_WORDS_PER_PHASE) {
            FX.toast({ icon: "🔒", kicker: "REVEAL", title: "No Reveal Words Left", text: `You've used all ${REVEAL_WORDS_PER_PHASE} for this phase.`, ms: 2400 });
            return;
        }
        const before = game.squaresRevealed;
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
        if (scope === "word" && game.squaresRevealed > before) { game.revealWords = (game.revealWords || 0) + 1; drawRevealWords(); }
        Sound.play("reveal");
        Bus.emit("reveal", { scope });
        if (scope === "puzzle") surrender();
        else checkForWin();
        render();
    }
    function surrender() {
        game.solved = true;
        game.surrendered = true;
        drawTimer();
        let text = game.puzzle.mode === "campaign" ? "Level not cleared. Play it again from the map." : "Better luck next time.";
        if (game.puzzle.mode === "archive") {
            saveArchiveRecord(game.puzzle, true);
            text = "Practice, so nothing is lost. Try another day from the Archive.";
        } else if (game.puzzle.mode === "daily" && dailyStanding(seedDay(game.puzzle.seed)) === "past") {
            text = "This was an earlier day's daily, so nothing was saved.";
        } else if (game.puzzle.mode === "daily") {
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
    function typeLetter(letter, pencil = false) {
        touched();
        const row = game.row, col = game.col, cell = game.cells[row][col];
        const wasFull = isFull(currentEntry());           // correcting a finished word: move one square at a time
        if (!isLocked(row, col)) {                       // locked squares (revealed, or checked right): the cursor just moves on
            if (letter !== game.puzzle.solution[row][col] && game.letters[row][col] !== letter) game.typos = (game.typos || 0) + 1;
            game.letters[row][col] = letter;
            game.wrong[row][col] = false;
            if (game.pencil[row]) game.pencil[row][col] = pencil || game.pencilMode;
            flowType();
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
        setFlow(0);
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
        if (/^[a-zA-Z]$/.test(key)) typeLetter(key.toUpperCase(), event.shiftKey && !event.getModifierState("CapsLock"));
        else if (key === "Backspace" || key === "Delete") backspace();
        else if (key === "ArrowLeft") moveArrow(0, -1);
        else if (key === "ArrowRight") moveArrow(0, 1);
        else if (key === "ArrowUp") moveArrow(-1, 0);
        else if (key === "ArrowDown") moveArrow(1, 0);
        // (on a button or a link, Space, Enter and Tab do what they always do: press it, or move to the next control)
        else if ((key === " " || key === "Tab" || key === "Enter") && event.target.closest && event.target.closest("button, a[href], [role='button'], summary")) return;
        else if (key === " ") toggleDirection();
        else if (key === "Tab" || key === "Enter") moveToEntry(event.shiftKey ? -1 : 1);
        else return;
        event.preventDefault();
    });

    // a button clicked with the mouse lets go of the focus, so Space and Enter go back to the board (pressed from the
    // keyboard, it keeps the focus: detail is 0 then)
    puzzleEl.addEventListener("click", e => { const btn = e.target.closest("button"); if (btn && e.detail > 0) btn.blur(); });

    // the on-screen keyboard (touch screens): "⇄" switches Across/Down, "⌫" is Backspace, the pencil key is Pencil
    const KEY_ROWS = ["QWERTYUIOP", "ASDFGHJKL✎", "⇄ZXCVBNM⌫"];
    document.querySelectorAll("#keyboard .key-row").forEach((rowEl, i) => {
        for (const key of [...KEY_ROWS[i]]) {
            const b = U.el("button", { type: "button", class: "key", text: key === "✎" ? "" : key, "data-key": key });
            if (key === "⇄") { b.classList.add("wide"); b.setAttribute("aria-label", "Switch Across/Down"); }
            if (key === "⌫") { b.classList.add("wide"); b.setAttribute("aria-label", "Backspace"); }
            if (key === "✎") { b.classList.add("pen-key"); b.setAttribute("aria-label", "Pencil"); b.setAttribute("aria-pressed", "false"); b.append(U.icon("pencil")); }
            rowEl.appendChild(b);
        }
    });
    $("#keyboard").addEventListener("click", event => {
        const b = event.target.closest(".key");
        if (!b || blocked() || game.solved) return;
        const key = b.dataset.key;
        if (key === "⌫") backspace();
        else if (key === "⇄") toggleDirection();
        else if (key === "✎") setPencil(!game.pencilMode);
        else typeLetter(key);
    });
    clueBarEl.addEventListener("click", () => { if (game.puzzle && !game.solved && !blocked()) toggleDirection(); });
    // Pencil: letters typed while it's on (or with Shift held) are guesses, shown lighter
    const pencilBtn = $("#pencil-btn");
    pencilBtn.prepend(U.icon("pencil"));
    function setPencil(on) {                                       // the button above the board and the keyboard's key
        game.pencilMode = on;
        for (const b of [pencilBtn, ...document.querySelectorAll("#keyboard .pen-key")]) b.setAttribute("aria-pressed", on ? "true" : "false");
        Sound.play("toggle");
    }
    pencilBtn.addEventListener("click", () => { setPencil(!game.pencilMode); pencilBtn.blur(); });
    // leaving the puzzle: a campaign level goes back to its world, anything else goes Home
    const exitBtn = $("#game-exit");
    exitBtn.append(U.icon("back"));
    exitBtn.addEventListener("click", () => { location.hash = U.view() === "level" && Campaign.playing && !Campaign.playing.special ? "#campaign" : U.view() === "past" ? "#archive" : "#"; });
    // the board leans a little toward the pointer (the full-screen layout, with a mouse)
    const tilt = { x: 0, y: 0, tx: 0, ty: 0, raf: 0 };
    function tiltStep() {
        tilt.x += (tilt.tx - tilt.x) * 0.08; tilt.y += (tilt.ty - tilt.y) * 0.08;
        const wrap = boardEl.parentElement;
        wrap.style.setProperty("--tx", tilt.x.toFixed(4));
        wrap.style.setProperty("--ty", tilt.y.toFixed(4));
        tilt.raf = Math.abs(tilt.tx - tilt.x) + Math.abs(tilt.ty - tilt.y) > 0.002 && !gameViewEl.hidden ? requestAnimationFrame(tiltStep) : 0;
    }
    const tiltTo = (x, y) => { tilt.tx = x; tilt.ty = y; if (!tilt.raf) tilt.raf = requestAnimationFrame(tiltStep); };
    gameViewEl.addEventListener("pointermove", e => {
        if (e.pointerType !== "mouse" || U.motion() !== "full" || !game.puzzle) return;
        tiltTo(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5);
    });
    gameViewEl.addEventListener("pointerleave", () => tiltTo(0, 0));
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
        const kind = U.el("select", { id: "report-kind" },
            ...[["wrong-answer", "The answer is wrong"], ["unclear-clue", "The clue is unclear or fits another word"], ["typo", "A typo"],
                ["offensive", "Something offensive"], ["technical", "Something isn't working"], ["other", "Something else"]]
                .map(([value, label]) => U.el("option", { value, text: label })));
        kind.value = "unclear-clue";
        const text = U.el("textarea", { id: "report-text", maxlength: "1000", placeholder: "Anything else we should know? (optional)" });
        const count = U.el("small", { class: "count", text: "0 / 1000" });
        const err = U.el("p", { class: "report-err", "aria-live": "polite" });
        const cancel = U.el("button", { type: "button", class: "btn ghost", text: "Cancel" });
        const send = U.el("button", { type: "button", class: "btn primary", text: "Send Report" });
        modal.appendChild(U.el("div", { class: "res-card ask-card report-card" },
            U.el("h2", { id: "report-title", class: "res-title ask-title", text: "Report a Problem" }),
            U.el("label", { for: "report-clue", text: "Which Part?" }), select,
            U.el("label", { for: "report-kind", text: "What Kind of Problem?" }), kind,
            U.el("label", { for: "report-text", text: "Details" }), text, count, err,
            U.el("div", { class: "res-actions" }, cancel, send),
            U.el("p", { class: "report-mail" }, "Or write to ", U.el("a", { href: "mailto:schmollcrossword@gmail.com", text: "schmollcrossword@gmail.com" }))));
        const needsText = () => kind.value === "other";
        kind.addEventListener("change", () => { text.placeholder = needsText() ? "What's wrong?" : "Anything else we should know? (optional)"; });
        const close = () => { removeEventListener("keydown", onKey, true); U.dialog.close(modal); modal.classList.remove("in"); modal.classList.add("out"); setTimeout(() => modal.remove(), 300); };
        const onKey = e => { if (e.key === "Escape" && U.dialog.top(modal)) { e.preventDefault(); e.stopPropagation(); close(); } };
        addEventListener("keydown", onKey, true);
        U.dialog.open(modal);
        text.addEventListener("input", () => { count.textContent = `${text.value.length} / 1000`; });
        cancel.addEventListener("click", close);
        modal.addEventListener("pointerdown", e => { if (e.target === modal) close(); });
        send.addEventListener("click", async () => {
            if (needsText() && !text.value.trim()) { err.textContent = "Please say what's wrong first."; text.focus(); return; }
            send.disabled = true;
            send.textContent = "Sending…";
            err.textContent = "";
            try {
                const response = await fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ seed: p.seed, mode: p.mode, difficulty: p.difficulty, clue: select.value, message: text.value.trim(), world: Worlds.current.id, category: kind.value }) });
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

    // Difficulty buttons: switch to that difficulty's daily
    function switchDifficulty(view, difficulty) {
        difficultyFor[view] = difficulty;
        document.querySelectorAll(".difficulty button[data-difficulty]").forEach(b => b.classList.toggle("active", b.dataset.difficulty === difficulty));
        showPuzzleFor(view);
    }
    for (const button of document.querySelectorAll(".difficulty button[data-difficulty]")) {
        button.addEventListener("click", () => { button.blur(); Sound.play("select"); switchDifficulty(U.view(), button.dataset.difficulty); });
    }
    // The Daily Boss: a race against today's boss (campaign.js)
    $("#boss-mode").addEventListener("click", e => { e.currentTarget.blur(); Sound.play("select"); Campaign.playSpecial("daily"); });

    // ---------------------------------------------------------------------------------------------
    // Showing the game screen (called by app.js for #daily and campaign levels)
    // ---------------------------------------------------------------------------------------------
    function show(view, opts) {
        const level = view === "level" ? Campaign.titles() : null;
        if (view === "past" && !pastDate) { location.hash = "#archive"; return; }      // (a reload on #past: pick a day first)
        $("#game-title").textContent = level ? level.title : view === "past" ? "Daily Archive" : "Daily Puzzle";
        $("#game-subtitle").textContent = level ? level.sub
            : (view === "past" ? new Date(pastDate + "T12:00") : new Date()).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }) + (view === "past" ? " · Practice" : "");
        $("#boss-mode").hidden = view !== "daily";
        document.querySelectorAll(".difficulty button[data-difficulty]").forEach(b => { b.hidden = view === "past" && !!pastKinds && !pastKinds.includes(b.dataset.difficulty); });
        document.querySelectorAll(".difficulty button[data-difficulty]").forEach(b => b.classList.toggle("active", b.dataset.difficulty === difficultyFor[view]));
        drawDifficultyMarks();
        showPuzzleFor(view, opts);
    }
    // The Daily Archive: play an earlier day's daily (kinds: which of the day's dailies the archive has)
    let pastKinds = null;
    function playPast(date, difficulty, kinds) {
        pastDate = date;
        pastKinds = kinds || null;
        difficultyFor.past = difficulty;
        if (U.view() === "past") show("past");
        else location.hash = "#past";
    }
    // fresh: today's daily even if an earlier day's is still in its 15 minutes (the midnight question's Go to Today's)
    function showPuzzleFor(view, { fresh = false } = {}) {
        const slot = slotFor(view, difficultyFor[view]);
        // past the player's midnight with the page still open: yesterday's dailies are replaced by today's, except the
        // one being played in its 15 minutes after midnight (it still counts for its day)
        const inGrace = p => p === game.puzzle && !game.solved && dailyStanding(seedDay(p.seed)) === "grace";
        const stale = p => view === "daily" && p && seedDay(p.seed) !== dayKey(new Date()) && (fresh || !inGrace(p));
        if (stale(lastPuzzle[slot])) { delete lastPuzzle[slot]; delete savedGames[slot]; }
        if (game.puzzle && slotOf(game.puzzle) === slot && !stale(game.puzzle)) {
            loadCounter++;
            statusEl.hidden = true;
            puzzleEl.hidden = false;
            playTitleCard();
            Bus.emit("resume", { puzzle: game.puzzle });      // the same puzzle again: a boss fight puts its panel, arena and music back
            fitPhone();
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
        if (key === "difficulty") difficultyFor.daily = Settings.get("difficulty");
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
    // The Daily Boss: a new fight gets a new copy of its puzzle (a Rematch keeps the one it has: restartSlot)
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
        Object.assign(game, { letters: blank(""), wrong: blank(false), revealed: blank(false), locked: blank(false), solved: false, surrendered: false, celebrating: false, result: null, revealWords: 0 });
        drawRevealWords();
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
        state: game, difficultyFor, scores, archiveRecords, playPast, savedSlot: slot => savedGames[slot] || null, show, showPuzzleFor, loadPuzzle, warmStage, drawDifficultyMarks, streakBadge, render,
        cellsOf, cellEl: (r, c) => (game.cells[r] ? game.cells[r][c] : null),
        openCells: () => game.cells.flat().filter(c => !c.classList.contains("block")),
        closeResults, playTitleCard
    };
})();
