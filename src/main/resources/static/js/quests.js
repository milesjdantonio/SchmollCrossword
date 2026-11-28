// Daily Quests: three small goals a day (the same for everyone, new at the player's midnight), 20 coins each, and a
// board colour for all three.
// Weekly Quests: three goals a week (one for the dailies, one for the campaign, one for how you solve), the same for
// everyone that week, new every Sunday at midnight. Each one gives a reward from the Collection (collection.js) the
// moment it's done: a rarer board colour, a letter style or a part for your hero; all three give the week's badge.
// A reward is marked given (and saved) before it's applied, so a reload never gives it twice.
//   Saved in this browser: schmoll.quests (this week's progress), schmoll.dayquests (today's); what you've won is
//   the Collection's (schmoll.rewards)
const Quests = (() => {

    // ---- the quests ----
    const isDaily = i => (i.mode === "daily" && i.counted !== false && !i.practice) || (i.daily && i.counted !== false);
    const isLevel = i => !!(i.campaign && !i.campaign.special);
    const sizeNow = () => (Game.state.puzzle ? Game.state.puzzle.size : 0);
    const today = () => dayKey(new Date());
    const POOL = {
        daily: [
            { id: "dailies7", text: "Solve 7 Dailies", target: 7, add: i => (isDaily(i) ? 1 : 0) },
            { id: "days4", text: "Solve a Daily on 4 Different Days", target: 4, set: i => (isDaily(i) ? today() : null) },
            { id: "hard3", text: "Solve 3 Hard Dailies", target: 3, add: i => (isDaily(i) && i.difficulty === "hard" ? 1 : 0) },
            { id: "challenge2", text: "Solve 2 Challenge Dailies", target: 2, add: i => (isDaily(i) && i.difficulty === "challenge" ? 1 : 0) },
            { id: "boss2", text: "Beat Today's Boss on 2 Days", target: 2, set: i => (i.campaign && i.campaign.special === "daily" ? today() : null) }
        ],
        campaign: [
            { id: "levels5", text: "Clear 5 Campaign Levels", target: 5, add: i => (isLevel(i) ? 1 : 0) },
            { id: "stars10", text: "Earn 10 Stars in the Campaign", target: 10, add: i => (isLevel(i) ? i.campaign.stars || 0 : 0) },
            { id: "boss1", text: "Beat a Campaign Boss", target: 1, add: i => (isLevel(i) && i.campaign.boss ? 1 : 0) },
            { id: "three2", text: "Get 3 Stars on 2 Levels", target: 2, add: i => (isLevel(i) && i.campaign.stars >= 3 ? 1 : 0) }
        ],
        skill: [
            { id: "nohint3", text: "Solve 3 Puzzles Without Check or Reveal", target: 3, add: i => (!i.checked && !i.revealed ? 1 : 0) },
            { id: "clean3", text: "Solve 3 Puzzles Without a Wrong Letter", target: 3, add: i => (!i.mistakes ? 1 : 0) },
            { id: "fast1", text: "Solve a 5×5 in Under 1:30", target: 1, add: i => (sizeNow() === 5 && i.seconds < 90 ? 1 : 0) },
            { id: "archive3", text: "Solve 3 Puzzles From the Daily Archive", target: 3, add: i => (i.archive ? 1 : 0) },
            { id: "worlds3", text: "Solve Puzzles in 3 Different Worlds", target: 3, set: () => (Worlds.current ? Worlds.current.id : null) }
        ]
    };
    const QUEST = Object.fromEntries(Object.values(POOL).flat().map(q => [q.id, q]));
    // today's: small, one solve or two each
    const DAY_POOL = [
        { id: "d-easy", text: "Solve Today's Easy", target: 1, add: i => (isDaily(i) && i.difficulty === "easy" ? 1 : 0) },
        { id: "d-medium", text: "Solve Today's Medium", target: 1, add: i => (isDaily(i) && i.difficulty === "medium" ? 1 : 0) },
        { id: "d-hard", text: "Solve Today's Hard", target: 1, add: i => (isDaily(i) && i.difficulty === "hard" ? 1 : 0) },
        { id: "d-two", text: "Solve 2 Dailies", target: 2, add: i => (isDaily(i) ? 1 : 0) },
        { id: "d-boss", text: "Beat Today's Boss", target: 1, add: i => (i.campaign && i.campaign.special === "daily" ? 1 : 0) },
        { id: "d-level", text: "Clear a Campaign Level", target: 1, add: i => (isLevel(i) ? 1 : 0) },
        { id: "d-stars", text: "Get 3 Stars on a Campaign Level", target: 1, add: i => (isLevel(i) && i.campaign.stars >= 3 ? 1 : 0) },
        { id: "d-archive", text: "Solve a Puzzle From the Archive", target: 1, add: i => (i.archive ? 1 : 0) },
        { id: "d-clean", text: "Solve a Puzzle Without a Wrong Letter", target: 1, add: i => (!i.mistakes ? 1 : 0) },
        { id: "d-nohint", text: "Solve a Daily Without Check or Reveal", target: 1, add: i => (isDaily(i) && !i.checked && !i.revealed ? 1 : 0) },
        { id: "d-fast", text: "Solve a Puzzle in Under 2:00", target: 1, add: i => (i.seconds < 120 ? 1 : 0) }
    ];
    const DAY_QUEST = Object.fromEntries(DAY_POOL.map(q => [q.id, q]));
    const DAY_COINS = 20, FALLBACK_COINS = 50;

    // ---- the rewards: the Collection's, or coins once you have everything ----
    const COINS = { id: "coins", name: `${FALLBACK_COINS} Coins`, kind: "coins" };
    const rewardOf = id => Collection.ITEMS[id] || COINS;
    const rewards = () => Collection.store(), saveRewards = r => Collection.save(r);
    const owns = id => Collection.owns(id);
    const nameOf = r => (r.kind === "colour" ? `${r.name} Board` : r.kind === "letters" ? `${r.name} Letters` : r.name);
    const shuffled = (ids, R) => ids.map(id => [R(), id]).sort((a, b) => a[0] - b[0]).map(x => x[1]);

    // ---- the week ----
    function weekOf(d = new Date()) { return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay())); }   // its Sunday
    function nextReset() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay() + 7); }
    function newWeek(week) {
        const R = U.rng(Number(week));
        const pick = list => list[Math.floor(R() * list.length)].id;
        const picks = [pick(POOL.daily), pick(POOL.campaign), pick(POOL.skill)];
        // each quest's reward: one you don't have yet (shuffled the same way all week), else coins
        const left = shuffled(Collection.weeklyPool(), R);
        const rewardFor = Object.fromEntries(picks.map((id, i) => [id, left[i] || COINS.id]));
        return { week, picks, rewardFor, progress: {}, sets: {}, done: {}, granted: {}, badge: false };
    }
    function state() {
        const week = weekOf();
        let s = U.store.get("quests", null);
        if (!s || s.week !== week || !Array.isArray(s.picks)) { s = newWeek(week); U.store.set("quests", s); }
        return s;
    }
    // ---- today ----
    function dayState() {
        const day = dayKey(new Date());
        let s = U.store.get("dayquests", null);
        if (!s || s.day !== day || !Array.isArray(s.picks)) {
            const R = U.rng(Number(day) * 7 + 3), pool = DAY_POOL.map(q => [R(), q.id]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
            const colours = shuffled(Collection.dailyPool(), R);
            s = { day, picks: pool.slice(0, 3), bonusReward: colours[0] || COINS.id, progress: {}, sets: {}, done: {}, granted: {}, bonus: false };
            U.store.set("dayquests", s);
        }
        return s;
    }
    function nextDay() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); }
    const coins = n => { if (typeof Campaign !== "undefined" && Campaign.addCoins) Campaign.addCoins(n); };

    // one quest's progress from one solve: true if it moved
    function advance(s, q, info) {
        const before = s.progress[q.id] || 0;
        if (q.set) {
            const v = q.set(info);
            if (v && !(s.sets[q.id] || []).includes(v)) (s.sets[q.id] = s.sets[q.id] || []).push(v);
            s.progress[q.id] = (s.sets[q.id] || []).length;
        } else s.progress[q.id] = before + (q.add(info) || 0);
        if (s.progress[q.id] >= q.target) s.done[q.id] = true;
        return s.progress[q.id] !== before;
    }

    // ---- progress: every solved puzzle (game.js's "win") ----
    function onWin(info) {
        const moved = [];
        // today's (coins, marked given and saved before they're added)
        const d = dayState();
        for (const id of d.picks) {
            const q = DAY_QUEST[id];
            if (!q || d.done[id] || !advance(d, q, info)) continue;
            moved.push({ id, scope: "Today", text: q.text, n: Math.min(q.target, d.progress[id]), target: q.target, done: !!d.done[id], reward: d.done[id] ? `${DAY_COINS} Coins` : null });
        }
        const newly = d.picks.filter(id => d.done[id] && !d.granted[id]);
        newly.forEach(id => { d.granted[id] = true; });
        const bonus = d.picks.every(id => d.done[id]) && !d.bonus;
        if (bonus) d.bonus = true;
        U.store.set("dayquests", d);
        if (newly.length) coins(newly.length * DAY_COINS);
        if (bonus) {
            const reward = rewardOf(d.bonusReward);
            if (reward.kind === "coins") coins(FALLBACK_COINS); else Collection.give(reward.id);
            moved.push({ id: "day-bonus", scope: "Today", text: "All Three Today", n: 3, target: 3, done: true, reward: nameOf(reward) });
        }
        // this week's
        const s = state();
        for (const id of s.picks) {
            const q = QUEST[id];
            if (!q || s.done[id] || !advance(s, q, info)) continue;
            moved.push({ id, scope: "This Week", text: q.text, n: Math.min(q.target, s.progress[id]), target: q.target, done: !!s.done[id], reward: s.done[id] ? nameOf(rewardOf(s.rewardFor[id])) : null });
        }
        U.store.set("quests", s);
        // the rewards: marked given and saved first, then applied (a reload in between can't give one twice)
        for (const m of moved) if (m.done && m.scope === "This Week" && m.id !== "badge") grant(s, m.id);
        if (s.picks.every(id => s.done[id]) && !s.badge) {
            s.badge = true;
            U.store.set("quests", s);
            const r = rewards();
            if (!r.badges.includes(s.week)) { r.badges.push(s.week); saveRewards(r); }
            moved.push({ id: "badge", scope: "This Week", text: "All Three This Week", n: 3, target: 3, done: true, reward: "This Week's Badge", badge: s.week });
        }
        if (moved.length) info.quests = moved;            // the results card shows them (game.js showResults)
        return moved;
    }
    function grant(s, id) {
        if (s.granted[id]) return;
        s.granted[id] = true;
        U.store.set("quests", s);
        const reward = rewardOf(s.rewardFor[id]);
        if (reward.kind === "coins") coins(FALLBACK_COINS);
        else Collection.give(reward.id);
    }
    Bus.on("win", info => { try { onWin(info); } catch (err) { console.error("quests", err); } });

    // ---- a week's badge: a medal in its own colours and shape (the same for everyone that week) ----
    const BADGE_COLORS = [["#ffcf3a", "#e2343e"], ["#7ad7ff", "#2f5fd0"], ["#8be07a", "#2f8f63"], ["#ffb3d1", "#a03a8a"], ["#ffd08a", "#c8641e"], ["#c9b8ff", "#5a3ac8"]];
    function badgeSvg(week) {
        const n = Number(week) || 0, R = U.rng(n), [face, ribbon] = BADGE_COLORS[Math.floor(R() * BADGE_COLORS.length)];
        const points = 5 + Math.floor(R() * 4), d = new Date(+week.slice(0, 4), +week.slice(4, 6) - 1, +week.slice(6));
        const star = Array.from({ length: points * 2 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / points, r = i % 2 ? 9 : 19; return `${(32 + Math.cos(a) * r).toFixed(1)},${(40 + Math.sin(a) * r).toFixed(1)}`; }).join(" ");
        const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        return `<svg viewBox="0 0 64 80" aria-hidden="true"><path d="M20 2 L32 22 L44 2 L52 2 L38 28 L26 28 L12 2Z" fill="${ribbon}" stroke="#2b2233" stroke-width="2.5" stroke-linejoin="round"/>` +
            `<circle cx="32" cy="46" r="26" fill="${face}" stroke="#2b2233" stroke-width="3"/><circle cx="32" cy="46" r="19" fill="none" stroke="#fff" stroke-width="2" opacity=".55"/>` +
            `<polygon points="${star}" transform="translate(0 6)" fill="#fff" stroke="#2b2233" stroke-width="2" stroke-linejoin="round"/>` +
            `<text x="32" y="78" text-anchor="middle" font-size="9" font-weight="800" fill="currentColor">${U.esc(label)}</text></svg>`;
    }

    // ---- Home's card ----
    function timeLeft(until) {
        const ms = until - new Date(), h = Math.floor(ms / 36e5), dd = Math.floor(h / 24);
        return dd ? `${dd}d ${h % 24}h` : `${h}h ${Math.floor(ms / 6e4) % 60}m`;
    }
    function draw(el) {
        if (!el) return;
        const s = state(), r = rewards();
        const head = U.el("header", { class: "card-head" }, U.el("h2", { text: "Quests" }));
        // today's: one line each, coins on the right
        const d = dayState(), dayAll = d.picks.every(id => d.done[id]);
        const today = U.el("section", { class: "qx-day" },
            U.el("header", { class: "qx-sub" }, U.el("h3", { text: "Today" }), U.el("span", { text: dayAll ? "All Done · Back Tomorrow" : `New in ${timeLeft(nextDay())}` })),
            U.el("ol", { class: "qx-day-list" }, ...d.picks.map(id => {
                const q = DAY_QUEST[id], n = Math.min(q.target, d.progress[id] || 0), done = !!d.done[id];
                return U.el("li", { class: "qd" + (done ? " done" : "") },
                    U.el("span", { class: "qd-check", "aria-hidden": "true" }, done ? U.icon("check") : null),
                    U.el("span", { class: "qd-text", text: q.text + (q.target > 1 && !done ? ` (${n} of ${q.target})` : "") }),
                    U.el("span", { class: "qx-reward" + (done ? " got" : "") }, U.icon("coin"), U.el("span", { text: `${DAY_COINS}` })));
            }), U.el("li", { class: "qd qd-bonus" + (d.bonus ? " done" : "") },
                U.el("span", { class: "qd-text", text: "All Three" }), rewardChip(rewardOf(d.bonusReward), d.bonus))));
        const weekHead = U.el("header", { class: "qx-sub" }, U.el("h3", { text: "This Week" }), U.el("span", { text: `New Quests in ${timeLeft(nextReset())}` }));
        const rows = s.picks.map(id => {
            const q = QUEST[id], n = Math.min(q.target, s.progress[id] || 0), done = !!s.done[id], reward = rewardOf(s.rewardFor[id]);
            return U.el("li", { class: "qx" + (done ? " done" : "") },
                U.el("span", { class: "qx-text" }, U.el("b", { text: q.text }), U.el("span", { class: "qx-bar", "aria-hidden": "true" }, U.el("i", { style: { width: (n / q.target * 100) + "%" } }))),
                U.el("span", { class: "qx-n", text: done ? "Done" : `${n} of ${q.target}` }),
                rewardChip(reward, done));
        });
        const all = s.picks.every(id => s.done[id]);
        rows.push(U.el("li", { class: "qx qx-badge" + (all ? " done" : "") },
            U.el("span", { class: "qx-text" }, U.el("b", { text: "Finish All Three" }), U.el("small", { text: all ? "This week's badge is yours." : "This week's badge" })),
            U.el("span", { class: "qx-medal", html: badgeSvg(s.week) })));
        // what you've won: what's on your board now (and the Collection to change it), and your badges
        const colour = Collection.ITEMS[Collection.equipped("colour")], letters = Collection.ITEMS[Collection.equipped("letters")];
        const looks = U.el("button", { type: "button", class: "qx-look", onclick: () => { Sound.play("select"); Collection.open("colour"); } },
            U.el("span", { class: "qx-look-pic", html: Collection.colourPreview(colour || { cell: "#ffffff", grid: "#c8ccd4", ink: "#2b2233" }) }),
            U.el("span", { class: "qx-look-text" }, U.el("b", { text: "Collection" }),
                U.el("small", { text: `${colour ? colour.name : "World's Own"} Board · ${letters ? letters.name : "World's Own"} Letters` })),
            U.el("span", { class: "chip-state", text: "Open" }));
        const badges = r.badges.length ? U.el("div", { class: "qx-badges" }, U.el("small", { text: `${r.badges.length} ${r.badges.length === 1 ? "Badge" : "Badges"}` }),
            ...r.badges.slice(-8).map(w => U.el("span", { class: "qx-medal small", title: "Week of " + w, html: badgeSvg(w) }))) : null;
        el.replaceChildren(head, today, weekHead, U.el("ol", { class: "qx-list" }, ...rows), U.el("div", { class: "qx-won" }, looks, badges));
    }
    function rewardChip(reward, done) {
        const picture = reward.kind === "colour" ? U.el("i", { class: "qx-sw", style: { "--a": reward.cell, "--b": reward.grid } })
            : reward.kind === "letters" ? U.el("i", { class: "qx-ab", text: "Ab", style: { fontFamily: reward.font, fontWeight: reward.weight } })
            : reward.kind === "hero" ? U.icon("hero") : U.icon("coin");
        const label = reward.kind === "colour" ? `${reward.name} Board` : reward.kind === "letters" ? `${reward.name} Letters` : reward.name;
        return U.el("span", { class: "qx-reward" + (done ? " got" : "") + (reward.rarity ? " r-" + reward.rarity : ""), title: (done ? `${label}: yours` : `Reward: ${label}`) + (reward.rarity ? ` (${reward.rarity})` : "") },
            picture, U.el("span", { text: label }));
    }
    Bus.on("collection", () => { const el = document.getElementById("home-quests"); if (el && !el.closest("[hidden]")) draw(el); });

    return { owns, onWin, draw, badgeSvg, state, dayState };
})();
