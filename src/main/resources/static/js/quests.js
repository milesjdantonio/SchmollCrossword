// Weekly Quests: three goals a week (one for the dailies, one for the campaign, one for how you solve), the same for
// everyone that week, new every Sunday at midnight. Each one gives a reward the moment it's done: a board colour
// (any world's board in gold, midnight, rose or mint) or a part for your hero; finishing all three gives the week's
// badge. A reward is marked given (and saved) before it's applied, so a reload never gives it twice.
//   Saved in this browser: schmoll.quests (this week's progress), schmoll.rewards (what you've won, the board colour on)
const Quests = (() => {
    const QUESTS_KEY = "schmoll.quests", REWARDS_KEY = "schmoll.rewards";

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

    // ---- the rewards ----
    // board colours: any world's board, in a new finish (css/quests.css)
    const FINISHES = [
        { id: "finish-gold", name: "Gold Board", swatch: ["#fff4cf", "#b8860b"] },
        { id: "finish-midnight", name: "Midnight Board", swatch: ["#1e2546", "#0a0d1c"] },
        { id: "finish-rose", name: "Rose Board", swatch: ["#fff0f4", "#c2456b"] },
        { id: "finish-mint", name: "Mint Board", swatch: ["#eefbf3", "#2f8f63"] }
    ];
    const REWARDS = [...FINISHES.map(f => ({ ...f, kind: "finish" })), ...Hero.QUEST_PARTS.map(p => ({ id: p.id, name: p.name, kind: "hero" }))];
    const REWARD = Object.fromEntries(REWARDS.map(r => [r.id, r]));
    const COINS = { id: "coins", name: "50 Coins", kind: "coins" };

    function rewards() {
        const r = U.store.get("rewards", null) || {};
        return { owned: Array.isArray(r.owned) ? r.owned : [], badges: Array.isArray(r.badges) ? r.badges : [], finish: typeof r.finish === "string" ? r.finish : "" };
    }
    const saveRewards = r => U.store.set("rewards", r);
    const owns = id => rewards().owned.includes(id);

    // ---- the week ----
    function weekOf(d = new Date()) { return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay())); }   // its Sunday
    function nextReset() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay() + 7); }
    function newWeek(week) {
        const R = U.rng(Number(week));
        const pick = list => list[Math.floor(R() * list.length)].id;
        const picks = [pick(POOL.daily), pick(POOL.campaign), pick(POOL.skill)];
        // each quest's reward: one you don't have yet (in a shuffled order that's the same all week), else coins
        const have = rewards().owned, left = REWARDS.filter(r => !have.includes(r.id)).map(r => [R(), r.id]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
        const rewardFor = Object.fromEntries(picks.map((id, i) => [id, left[i] || COINS.id]));
        return { week, picks, rewardFor, progress: {}, sets: {}, done: {}, granted: {}, badge: false };
    }
    function state() {
        const week = weekOf();
        let s = U.store.get("quests", null);
        if (!s || s.week !== week || !Array.isArray(s.picks)) { s = newWeek(week); U.store.set("quests", s); }
        return s;
    }
    const rewardOf = id => REWARD[id] || COINS;

    // ---- progress: every solved puzzle (game.js's "win") ----
    function onWin(info) {
        const s = state(), moved = [];
        for (const id of s.picks) {
            const q = QUEST[id];
            if (!q || s.done[id]) continue;
            const before = s.progress[id] || 0;
            if (q.set) {
                const v = q.set(info);
                if (v && !(s.sets[id] || []).includes(v)) (s.sets[id] = s.sets[id] || []).push(v);
                s.progress[id] = (s.sets[id] || []).length;
            } else s.progress[id] = before + (q.add(info) || 0);
            if (s.progress[id] === before) continue;
            const done = s.progress[id] >= q.target;
            if (done) s.done[id] = true;
            moved.push({ id, text: q.text, n: Math.min(q.target, s.progress[id]), target: q.target, done, reward: done ? rewardOf(s.rewardFor[id]).name : null });
        }
        U.store.set("quests", s);
        // the rewards: marked given and saved first, then applied (a reload in between can't give one twice)
        for (const m of moved) if (m.done) grant(s, m.id);
        if (s.picks.every(id => s.done[id]) && !s.badge) {
            s.badge = true;
            U.store.set("quests", s);
            const r = rewards();
            if (!r.badges.includes(s.week)) { r.badges.push(s.week); saveRewards(r); }
            moved.push({ id: "badge", text: "All Three This Week", n: 3, target: 3, done: true, reward: "This Week's Badge", badge: s.week });
        }
        if (moved.length) info.quests = moved;            // the results card shows them (game.js showResults)
        return moved;
    }
    function grant(s, id) {
        if (s.granted[id]) return;
        s.granted[id] = true;
        U.store.set("quests", s);
        const reward = rewardOf(s.rewardFor[id]);
        if (reward.kind === "coins") { if (typeof Campaign !== "undefined" && Campaign.addCoins) Campaign.addCoins(50); return; }
        const r = rewards();
        if (!r.owned.includes(reward.id)) r.owned.push(reward.id);
        saveRewards(r);
    }
    Bus.on("win", info => { try { onWin(info); } catch (err) { console.error("quests", err); } });

    // ---- the board colour you've chosen ----
    function applyFinish() {
        const f = rewards().finish;
        if (f && owns(f)) document.documentElement.dataset.finish = f.replace("finish-", "");
        else delete document.documentElement.dataset.finish;
    }
    function setFinish(id) {
        const r = rewards();
        r.finish = id && r.owned.includes(id) ? id : "";
        saveRewards(r);
        applyFinish();
    }
    applyFinish();

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
    function timeLeft() {
        const ms = nextReset() - new Date(), h = Math.floor(ms / 36e5), dd = Math.floor(h / 24);
        return dd ? `${dd}d ${h % 24}h` : `${h}h ${Math.floor(ms / 6e4) % 60}m`;
    }
    function draw(el) {
        if (!el) return;
        const s = state(), r = rewards();
        const head = U.el("header", { class: "card-head" }, U.el("h2", { text: "Weekly Quests" }), U.el("span", { class: "kicker", text: `New Quests in ${timeLeft()}` }));
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
        // what you've won: board colours to put on, and your badges
        const finishes = U.el("div", { class: "qx-finishes", role: "group", "aria-label": "Board colour" },
            U.el("small", { text: "Board Colour" }),
            swatch("", "World's Own", null, !r.finish, true),
            ...FINISHES.map(f => swatch(f.id, f.name, f.swatch, r.finish === f.id, r.owned.includes(f.id))));
        const badges = r.badges.length ? U.el("div", { class: "qx-badges" }, U.el("small", { text: `${r.badges.length} ${r.badges.length === 1 ? "Badge" : "Badges"}` }),
            ...r.badges.slice(-8).map(w => U.el("span", { class: "qx-medal small", title: "Week of " + w, html: badgeSvg(w) }))) : null;
        el.replaceChildren(head, U.el("ol", { class: "qx-list" }, ...rows), U.el("div", { class: "qx-won" }, finishes, badges));
    }
    function rewardChip(reward, done) {
        const r = reward.kind === "finish" ? REWARD[reward.id] : null;
        return U.el("span", { class: "qx-reward" + (done ? " got" : ""), title: done ? `${reward.name}: yours` : `Reward: ${reward.name}` },
            r ? U.el("i", { class: "qx-sw", style: { "--a": r.swatch[0], "--b": r.swatch[1] } }) : reward.kind === "hero" ? U.icon("hero") : U.icon("coin"),
            U.el("span", { text: reward.name }));
    }
    function swatch(id, name, colors, on, have) {
        const b = U.el("button", { type: "button", class: "qx-swatch" + (on ? " on" : "") + (have ? "" : " locked"), "aria-pressed": String(on), disabled: !have,
            title: have ? name : `${name}: won in the Weekly Quests`, style: colors ? { "--a": colors[0], "--b": colors[1] } : {} }, U.el("span", { class: "sr", text: name }));
        b.addEventListener("click", () => { Sound.play("select"); setFinish(id); draw(b.closest(".quests-card")); });
        return b;
    }

    return { owns, onWin, draw, badgeSvg, FINISHES, setFinish, state };
})();
