// The Daily Archive (#archive): every earlier day's dailies, to replay for practice (no points, no streak).
// A month calendar where each day shows which of its puzzles you've solved (on the day, or here in practice), and
// the picked day's puzzles with Play, Continue or how it went. Playing one opens #past (game.js playPast).
const Archive = (() => {
    const $ = U.$;
    const KINDS = ["easy", "medium", "hard", "challenge"];
    const SIZE = { easy: "5×5", medium: "5×5", hard: "5×5", challenge: "6×6 to 9×9" };
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
    const key = date => date.replace(/-/g, "");
    let days = null, byDate = new Map(), loading = null, month = "", picked = "";

    // what happened to one puzzle: solved on the day (with its points), solved here, revealed, started, or nothing yet
    function stateOf(date, kind) {
        const own = Game.scores()[key(date) + "-" + kind], practice = Game.archiveRecords()[key(date) + "-" + kind];
        if (own && !own.surrendered) return { kind: "day", text: `On the Day · ${U.fmtTime(own.seconds || 0)}`, done: true };
        if (practice && !practice.surrendered) return { kind: "practice", text: `Solved · ${U.fmtTime(practice.seconds || 0)}`, done: true };
        const saved = Game.savedSlot(`archive-${date}-${kind}`);
        if (saved && !saved.solved && saved.letters && saved.letters.some(r => r.some(Boolean))) return { kind: "started", text: "Continue", done: false };
        if (own || practice) return { kind: "revealed", text: "Revealed · Play Again", done: false };
        return { kind: "new", text: "Play", done: false };
    }

    async function load() {
        if (days) return days;
        if (!loading) loading = U.fetchJson("/api/archive/days").then(r => {
            days = (r && r.days) || [];
            byDate = new Map(days.map(d => [d.date, d.kinds]));
            return days;
        }).finally(() => { loading = null; });
        return loading;
    }

    async function show() {
        const status = $("#arc-status"), grid = $("#arc-grid");
        if (!days) {
            status.hidden = false;
            status.classList.remove("error");
            status.replaceChildren(U.el("span", { class: "spinner", "aria-hidden": "true" }), "Opening the Archive…");
        }
        try {
            await load();
        } catch (err) {
            if (U.view() !== "archive") return;
            grid.hidden = true;
            U.failCard(status, err, { retry: () => { if (U.view() === "archive") show(); } });
            return;
        }
        if (U.view() !== "archive") return;
        status.hidden = true;
        if (!days.length) {
            status.hidden = false;
            status.textContent = "The Archive fills up as the days go by. Come back tomorrow.";
            return;
        }
        grid.hidden = false;
        if (!picked || !byDate.has(picked)) picked = firstUnfinished();
        if (!month) month = picked.slice(0, 7);
        draw();
    }

    // the newest day with something left to solve (or simply the newest)
    function firstUnfinished() {
        const d = days.find(d => d.kinds.some(k => !stateOf(d.date, k).done));
        return (d || days[0]).date;
    }
    const monthsWithDays = () => [...new Set(days.map(d => d.date.slice(0, 7)))].sort();

    function draw() {
        drawSummary();
        drawCalendar();
        drawDay();
    }

    function drawSummary() {
        let done = 0, total = 0;
        for (const d of days) for (const k of d.kinds) { total++; if (stateOf(d.date, k).done) done++; }
        $("#arc-summary").textContent = `Practice: No Points or Streak · ${done} of ${total} Solved`;
    }

    function drawCalendar() {
        const [y, m] = month.split("-").map(Number), first = new Date(y, m - 1, 1), daysIn = new Date(y, m, 0).getDate();
        $("#arc-month").textContent = first.toLocaleDateString(undefined, { month: "long", year: "numeric" });
        const months = monthsWithDays(), i = months.indexOf(month);
        $("#arc-prev").disabled = i <= 0;
        $("#arc-next").disabled = i < 0 || i >= months.length - 1;
        const cal = $("#arc-cal");
        cal.replaceChildren();
        for (let k = 0; k < first.getDay(); k++) cal.appendChild(U.el("span", { class: "arc-blank", "aria-hidden": "true" }));
        for (let d = 1; d <= daysIn; d++) {
            const date = `${month}-${String(d).padStart(2, "0")}`, kinds = byDate.get(date);
            if (!kinds) { cal.appendChild(U.el("span", { class: "arc-day off", "aria-hidden": "true" }, U.el("b", { text: String(d) }))); continue; }
            const states = kinds.map(k => [k, stateOf(date, k)]), solved = states.filter(([, s]) => s.done).length;
            const label = new Date(date + "T12:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) + `: ${solved} of ${kinds.length} solved`;
            const btn = U.el("button", { type: "button", class: "arc-day" + (date === picked ? " on" : "") + (solved === kinds.length ? " full" : ""), "data-date": date, "aria-label": label, "aria-pressed": String(date === picked) },
                U.el("b", { text: String(d) }),
                U.el("span", { class: "arc-pips", "aria-hidden": "true" }, ...KINDS.map(k => U.el("i", { class: `k-${k}` + (!kinds.includes(k) ? " none" : states.find(([x]) => x === k)[1].done ? " done" : "") }))));
            btn.addEventListener("click", () => {
                Sound.play("select"); picked = date; drawCalendar(); drawDay();
                // (narrow screens: the day's puzzles are under the calendar, so bring them into view)
                if (matchMedia("(max-width: 980px)").matches) $("#arc-day").scrollIntoView({ behavior: U.motion() === "full" ? "smooth" : "auto", block: "nearest" });
            });
            cal.appendChild(btn);
        }
    }

    function drawDay() {
        const kinds = byDate.get(picked) || [], states = kinds.map(k => [k, stateOf(picked, k)]);
        $("#arc-day-title").textContent = new Date(picked + "T12:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
        $("#arc-day-count").textContent = `${states.filter(([, s]) => s.done).length} of ${kinds.length} Solved`;
        const chips = $("#arc-chips");
        chips.replaceChildren(...states.map(([k, st], i) => {
            const chip = U.el("button", { type: "button", class: "daily-chip arc-chip" + (k === "challenge" ? " challenge" : "") + (st.done ? " done" : "") + (st.kind === "revealed" ? " given-up" : ""), style: { "--i": i } },
                U.el("span", { class: "chip-text" }, U.el("span", { class: "chip-name", text: cap(k) }), U.el("span", { class: "chip-size", text: SIZE[k] })),
                U.el("span", { class: "chip-state", text: st.done ? "✓ " + st.text : st.text }));
            chip.addEventListener("click", () => { Sound.play("select"); Game.playPast(picked, k, kinds); });
            return chip;
        }));
    }

    function step(by) {
        const months = monthsWithDays(), i = months.indexOf(month) + by;
        if (i < 0 || i >= months.length) return;
        Sound.play("select");
        month = months[i];
        drawCalendar();
    }
    $("#arc-prev").append(U.icon("back"));
    $("#arc-next").append(U.icon("back"));
    $("#arc-prev").addEventListener("click", () => step(-1));
    $("#arc-next").addEventListener("click", () => step(1));
    $(".arc-back").append(U.icon("back"));
    // Surprise Me: a random puzzle you haven't solved yet, from any day
    $("#arc-random").addEventListener("click", () => {
        if (!days) return;
        const open = [];
        for (const d of days) for (const k of d.kinds) if (!stateOf(d.date, k).done) open.push([d.date, k, d.kinds]);
        const pick = open.length ? U.pick(open) : null;
        if (!pick) { FX.toast({ icon: "🏆", kicker: "DAILY ARCHIVE", title: "Every Puzzle Solved", text: "There's nothing left in the Archive. New days arrive daily.", ms: 3500 }); return; }
        Sound.play("select");
        Game.playPast(...pick);
    });
    // arrow keys move between days on the calendar
    $("#arc-cal").addEventListener("keydown", e => {
        const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
        if (!(e.key in moves) || !days) return;
        const at = new Date(picked + "T12:00");
        at.setDate(at.getDate() + moves[e.key]);
        const next = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
        if (!byDate.has(next)) return;
        e.preventDefault();
        picked = next;
        month = next.slice(0, 7);
        drawCalendar(); drawDay();
        const btn = $(`#arc-cal [data-date="${next}"]`);
        if (btn) btn.focus();
    });

    // the Home card's line: how much of the archive is solved
    async function homeLine(el) {
        try { await load(); } catch (err) { return; }
        let done = 0, total = 0;
        for (const d of days) for (const k of d.kinds) { total++; if (stateOf(d.date, k).done) done++; }
        el.textContent = total ? `${days.length} Days · ${done} of ${total} Solved` : "Opens After Today";
    }

    return { show, homeLine };
})();
