// The World Leaderboard: today's dailies, posted under a first name and, if the player likes, a last initial
// ("Miles" or "Miles D."), ranked by each player's total points for the day.
//
//   Leaderboard.after(record, box)   on the results screen: post this daily (asks for a name the first time)
//   Leaderboard.drawHome(el, count)  the Home card: today's top 50 in two columns, your place, and the player count
//   Leaderboard.drawFull(el)         the Stats page: today's top 50
//
// The server (LeaderboardController.java) checks the name, works out the points itself and keeps one entry per daily.
// Names are only ever put on the page with textContent, never as HTML.

const Leaderboard = (() => {
    const LETTERS = /^\p{L}(?:\p{L}|['-](?=\p{L})){0,11}$/u;
    // a random id for this browser, made once; it ties your dailies together and is never shown
    function playerId() {
        let id = U.store.get("player", null);
        if (!id || !/^[a-zA-Z0-9-]{16,64}$/.test(id)) {
            id = crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join("");
            U.store.set("player", id);
        }
        return id;
    }
    const me = () => U.store.get("leaderboard", {});
    const saveMe = o => U.store.set("leaderboard", { ...me(), ...o });
    const display = n => (n && n.first ? (n.initial ? `${n.first} ${n.initial}.` : n.first) : "");
    const dateOf = day => `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}`;
    const todayKey = () => { const d = new Date(); return String(d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()); };

    // A start ticket for a daily that's just begun (the server signs when it started, so a posted time can be
    // checked); null if the server can't be reached (the score still counts, without the speed bonus)
    async function ticket(day, difficulty) {
        try {
            const r = await fetch("/api/leaderboard/start", { method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ date: dateOf(day), difficulty }) });
            return r.ok ? (await r.json()).ticket || null : null;
        } catch (err) {
            return null;
        }
    }

    // post one saved daily ({ key: "20261009-easy", seconds, checked, revealed, stars, ticket }); resolves to the board
    async function post(rec) {
        const n = me(), [day, difficulty] = rec.key.split("-");
        const r = await fetch("/api/leaderboard", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ player: playerId(), first: n.first, initial: n.initial || "", date: dateOf(day), difficulty, seconds: rec.seconds,
                checked: rec.checked || 0, revealed: rec.revealed || 0, stars: rec.stars || undefined, attempts: rec.attempts || undefined, ticket: rec.ticket || undefined }) });
        if (!r.ok) {
            let msg = r.status === 429 ? "Too many posts. Try again later." : "Couldn't post your score.";
            try { const j = await r.json(); if (j && typeof j.message === "string" && r.status === 400) msg = j.message; } catch (err) { /* not JSON */ }
            throw new Error(msg);
        }
        const posted = me().posted || {};
        posted[rec.key] = rec.points || true;                // (the Daily Boss can be posted again with a better score)
        saveMe({ posted: Object.fromEntries(Object.entries(posted).filter(([k]) => k.slice(0, 8) >= todayKey().slice(0, 6) + "01")) });   // keep a month
        return r.json();
    }
    // today's other dailies that weren't posted yet (solved before you picked a name)
    async function postRest(scores) {
        const posted = me().posted || {}, day = todayKey();
        let board = null;
        for (const [key, s] of Object.entries(scores)) {
            const done = posted[key] === true || (typeof posted[key] === "number" && posted[key] >= s.points);
            if (key.slice(0, 8) !== day || done || s.surrendered || typeof s.checked !== "number") continue;
            try { board = await post({ key, ...s }); } catch (err) { /* skip that one */ }
        }
        return board;
    }

    // Remove My Name (the privacy notice): the server deletes everything this browser posted, on every day, and the
    // name is forgotten here too, so nothing is posted again until a new name is picked
    async function forget() {
        const r = await fetch("/api/leaderboard/forget", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ player: playerId() }) });
        if (!r.ok) throw new Error(r.status === 429 ? "Too many requests. Try again later." : "Couldn't reach the leaderboard. Try again later.");
        U.store.set("leaderboard", {});
        return (await r.json()).removed;
    }
    // Settings > Erase Leaderboard Data: the same, and this browser gets a new player id. If the server can't be
    // reached nothing is erased here either, so the id that can still remove those scores isn't lost.
    async function eraseAll() {
        await forget();
        U.store.remove("leaderboard");
        U.store.remove("player");
    }
    async function askForget(after) {
        const ok = await U.ask({ title: "Remove Your Name?", text: "Your name and every score you've posted are deleted from the leaderboard, on every day. Your own stats stay on this device.", yes: "Remove", no: "Keep" });
        if (!ok) return;
        try { await forget(); FX.toast({ icon: "✓", kicker: "LEADERBOARD", title: "Your Name Was Removed", ms: 2600 }); }
        catch (err) { FX.toast({ icon: "⚠️", kicker: "LEADERBOARD", title: "Not Removed", text: err.message, ms: 3200 }); }
        if (after) after();
    }

    // a name form: First name, and an optional last initial
    function nameForm(onDone, { label = "Post", note = "" } = {}) {
        const n = me();
        const first = U.el("input", { type: "text", class: "lb-first", maxlength: 12, autocomplete: "given-name", placeholder: "First name", "aria-label": "First name", value: n.first || "" });
        const init = U.el("input", { type: "text", class: "lb-init", maxlength: 1, autocomplete: "off", placeholder: "Initial", "aria-label": "Last initial (optional)", value: n.initial || "" });
        const err = U.el("small", { class: "lb-err", "aria-live": "polite" });
        const btn = U.el("button", { type: "submit", class: "btn primary small", text: label });
        const form = U.el("form", { class: "lb-form" }, first, init, btn, err);
        if (note) form.prepend(U.el("small", { class: "lb-note", text: note }));
        // typing in here must not type into the crossword
        form.addEventListener("keydown", e => e.stopPropagation());
        form.addEventListener("submit", async e => {
            e.preventDefault();
            const f = first.value.trim(), i = init.value.trim().replace(".", "");
            if (!LETTERS.test(f)) { err.textContent = "First name: letters only, up to 12."; first.focus(); return; }
            if (i && !/^\p{L}$/u.test(i)) { err.textContent = "Initial: one letter, or leave it empty."; init.focus(); return; }
            saveMe({ first: f[0].toUpperCase() + f.slice(1), initial: i.toUpperCase() });
            btn.disabled = true; err.textContent = "";
            try { await onDone(); }
            catch (ex) { err.textContent = ex.message; btn.disabled = false; saveMe({ first: n.first, initial: n.initial }); }
        });
        return form;
    }

    // the board as a list (names as text only); columns: 2 lays a long list out in two columns, top to bottom
    function list(board, max, { columns = 1 } = {}) {
        const rows = (board.top || []).slice(0, max);
        const two = columns === 2 && rows.length > 6;
        const ol = U.el("ol", { class: "lb-list" + (two ? " two" : ""), style: two ? { "--rows": String(Math.ceil(rows.length / 2)) } : null });
        for (const r of rows) ol.appendChild(U.el("li", { class: "lb-row" + (board.you && board.you.rank === r.rank ? " me" : "") },
            U.el("span", { class: "lb-rank", text: String(r.rank) }), U.el("span", { class: "lb-name", text: r.name }),
            U.el("span", { class: "lb-dailies", text: (r.dailies || []).map(d => ({ easy: "E", medium: "M", hard: "H", challenge: "★", boss: "⚔" })[d] || "").join(" ") }),
            U.el("b", { class: "lb-points", text: r.points + " pts" })));
        if (!rows.length) ol.appendChild(U.el("li", { class: "lb-empty", text: "No scores yet today. Be the first." }));
        // your place when it's below the list: its own row underneath (in two columns it runs under both)
        if (board.you && !rows.some(r => r.rank === board.you.rank)) {
            const far = U.el("li", { class: "lb-row me far" },
                U.el("span", { class: "lb-rank", text: String(board.you.rank) }), U.el("span", { class: "lb-name", text: board.you.name }),
                U.el("span", { class: "lb-dailies", text: "" }), U.el("b", { class: "lb-points", text: board.you.points + " pts" }));
            if (!two) ol.appendChild(far);
            else return U.el("div", { class: "lb-wrap" }, ol, U.el("ol", { class: "lb-list lb-you", start: String(board.you.rank) }, far));
        }
        return ol;
    }
    async function fetchBoard() {
        const r = await fetch(`/api/leaderboard?date=${dateOf(todayKey())}&player=${encodeURIComponent(playerId())}`);
        if (!r.ok) throw new Error("offline");
        return r.json();
    }

    // the results screen of a counted daily: post it (or ask for a name first)
    function after(rec, box) {
        const show = board => {
            box.innerHTML = "";
            const you = board && board.you;
            box.append(U.el("small", { class: "lb-kicker", text: "WORLD LEADERBOARD" }),
                U.el("p", { class: "lb-line", text: you ? `${you.name} is #${you.rank} of ${board.players} today, with ${you.points} pts.` : "Posted." }),
                U.el("a", { class: "lb-link", href: "#stats", text: "See the Leaderboard ›" }));
        };
        const go = async () => { let board = await post(rec); board = (await postRest(Game.scores())) || board; show(board); };
        if (me().first && me().off !== true) {
            box.append(U.el("small", { class: "lb-kicker", text: "WORLD LEADERBOARD" }), U.el("p", { class: "lb-line", text: "Posting…" }));
            go().catch(e => { box.innerHTML = ""; box.append(U.el("small", { class: "lb-kicker", text: "WORLD LEADERBOARD" }), U.el("p", { class: "lb-line", text: e.message })); });
        } else {
            box.append(U.el("small", { class: "lb-kicker", text: "WORLD LEADERBOARD" }), nameForm(go, { note: "Post your score under your first name. A last initial is optional." }));
        }
    }

    // Home: today's top 50 across the bottom of the page
    async function drawHome(el, count) {
        if (!el) return;
        try {
            const board = await fetchBoard();
            el.innerHTML = "";
            el.appendChild(list(board, 50, { columns: 2 }));
            if (count) count.textContent = board.players ? `${board.players} ${board.players === 1 ? "Player" : "Players"} Today` : "";
            if (!me().first) el.appendChild(U.el("p", { class: "lb-hint" }, "Solve a daily to join, or ", U.el("a", { class: "lb-link", href: "#stats", text: "pick your name" }), "."));
        } catch (err) { el.textContent = "The leaderboard is offline right now."; if (count) count.textContent = ""; }
    }
    async function drawFull(el) {
        if (!el) return;
        el.innerHTML = "";
        const head = U.el("header", { class: "card-head" }, U.el("h2", { class: "ico ico-trophy", text: "World Leaderboard" }), U.el("span", { class: "kicker", text: "Today" }));
        el.appendChild(head);
        const body = U.el("div", { class: "lb-body", text: "Loading…" });
        el.appendChild(body);
        try {
            const board = await fetchBoard();
            body.textContent = "";
            body.appendChild(U.el("p", { class: "lb-count", text: `${board.players} ${board.players === 1 ? "Player" : "Players"} Today` }));
            body.appendChild(list(board, 50));
            const n = me();
            const edit = U.el("div", { class: "lb-me" });
            edit.appendChild(U.el("span", { text: n.first ? `You post as ${display(n)}` : "Pick a name to post your dailies." }));
            edit.appendChild(nameForm(async () => { await postRest(Game.scores()); drawFull(el); }, { label: n.first ? "Save" : "Join" }));
            if (n.first) edit.appendChild(U.el("button", { type: "button", class: "link-btn lb-forget", text: "Remove My Name", onclick: () => askForget(() => drawFull(el)) }));
            body.appendChild(edit);
        } catch (err) { body.textContent = "The leaderboard is offline right now."; }
    }

    return { after, drawHome, drawFull, playerId, askForget, eraseAll, ticket, hasName: () => !!me().first };
})();
