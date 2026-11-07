// Achievements: little goals, saved in this browser (schmoll.achievements). Unlocked ones pop up as a toast
// and show on the results screen and the Stats page.

const Achievements = (() => {
    const LIST = [
        { id: "first", icon: "\u{1F389}", name: "First Solve", desc: "Solve your first puzzle." },
        { id: "hard", icon: "\u{1F48E}", name: "Hardcore", desc: "Solve a Hard puzzle." },
        { id: "hat", icon: "\u{1F3A9}", name: "Hat Trick", desc: "Solve Easy, Medium and Hard on the same day." },
        { id: "speed60", icon: "⚡", name: "Lightning", desc: "Solve a puzzle in under a minute." },
        { id: "speed30", icon: "\u{1F680}", name: "Ludicrous Speed", desc: "Solve a puzzle in under 30 seconds." },
        { id: "clean", icon: "\u{1F9FC}", name: "No Peeking", desc: "Solve a Hard puzzle without Check or Reveal." },
        { id: "streak3", icon: "\u{1F525}", name: "On Fire", desc: "Reach a 3-day streak." },
        { id: "streak7", icon: "\u{1F30B}", name: "Unstoppable", desc: "Reach a 7-day streak." },
        { id: "streak30", icon: "\u{1F451}", name: "Royalty", desc: "Reach a 30-day streak." },
        { id: "night", icon: "\u{1F989}", name: "Night Owl", desc: "Solve a puzzle between midnight and 5 AM." },
        { id: "early", icon: "\u{1F413}", name: "Early Bird", desc: "Solve a puzzle between 5 and 7 AM." },
        { id: "archive10", icon: "\u{1F570}️", name: "Time Traveler", desc: "Solve 10 puzzles from the Daily Archive." },
        { id: "worlds", icon: "\u{1F5FA}️", name: "World Traveler", desc: "Solve a puzzle in every world." },
        { id: "comeback", icon: "\u{1FA79}", name: "Never Give Up", desc: "Solve a puzzle after 3 or more Checks." },
        { id: "perfect", icon: "\u{1F4AF}", name: "Perfect Score", desc: "Score 300 points on a normal daily." },
        { id: "challenger", icon: "\u{1F3D4}️", name: "Challenger", desc: "Solve a Challenge puzzle." },
        { id: "summit", icon: "\u{1F9D7}", name: "Summit", desc: "Solve a daily Challenge without Check or Reveal." },
        // 18 more, to make 50
        { id: "easy1", icon: "\u{1F331}", name: "Warm-Up", desc: "Solve an Easy puzzle." },
        { id: "medium1", icon: "\u{1F3AF}", name: "Middle Ground", desc: "Solve a Medium puzzle." },
        { id: "speed20", icon: "\u{1F3CE}️", name: "Blink and You'll Miss It", desc: "Solve a puzzle in under 20 seconds." },
        { id: "solves25", icon: "\u{1F4DA}", name: "Regular", desc: "Solve 25 puzzles." },
        { id: "solves100", icon: "\u{1F9E0}", name: "Crossword Fan", desc: "Solve 100 puzzles." },
        { id: "archive50", icon: "\u{1F5C3}️", name: "Archivist", desc: "Solve 50 puzzles from the Daily Archive." },
        { id: "hard10", icon: "\u{1FAA8}", name: "Hard Worker", desc: "Solve 10 Hard puzzles." },
        { id: "streak14", icon: "\u{1F4C5}", name: "Two Weeks Strong", desc: "Reach a 14-day streak." },
        { id: "grand", icon: "\u{1F3DF}️", name: "Grand Slam", desc: "Solve all five dailies in one day, the boss included." },
        { id: "points1000", icon: "\u{1F4B0}", name: "Big Scorer", desc: "Earn 1,000 daily points in total." },
        // the campaign
        { id: "cm-first", icon: "\u{1F97E}", name: "First Steps", desc: "Clear your first campaign level.", campaign: true },
        { id: "cm-boss", icon: "⚔️", name: "Boss Buster", desc: "Beat your first boss.", campaign: true },
        { id: "cm-half", icon: "\u{1F6E1}️", name: "Halfway There", desc: "Beat 8 bosses.", campaign: true },
        { id: "cm-all", icon: "\u{1F3C6}", name: "Legend of the Map", desc: "Beat every boss.", campaign: true },
        { id: "cm-stars", icon: "\u{1F31F}", name: "Star Collector", desc: "Earn 50 stars in the campaign.", campaign: true },
        { id: "cm-perfect", icon: "\u{1F48E}", name: "Perfect World", desc: "Get 3 stars on every level of one world, boss included.", campaign: true },
        { id: "cm-untouched", icon: "\u{1F47B}", name: "Untouchable", desc: "Beat a boss without any of its attacks hitting you.", campaign: true },
        { id: "cm-wall", icon: "\u{1F9F1}", name: "Brick Wall", desc: "Block 3 attacks in one fight by finishing words.", campaign: true },
        { id: "cm-combo", icon: "\u{1F525}", name: "Combo King", desc: "Reach a ×5 combo in a boss fight.", campaign: true },
        { id: "cm-bare", icon: "✊", name: "Bare Hands", desc: "Beat a boss without using any abilities or items.", campaign: true },
        { id: "cm-arsenal", icon: "\u{1F9F0}", name: "Arsenal", desc: "Use 3 different abilities in one boss fight, and win.", campaign: true },
        { id: "cm-close", icon: "⏱️", name: "Photo Finish", desc: "Win a boss race when the boss was 90% done or more.", campaign: true },
        { id: "cm-1up", icon: "\u{1F579}️", name: "Second Wind", desc: "Win a boss fight after your Extra Life saved you.", campaign: true },
        { id: "cm-expert", icon: "\u{1F480}", name: "Expert Slayer", desc: "Beat a boss on Expert.", campaign: true },
        { id: "cm-shop", icon: "\u{1F6CD}️", name: "Shopaholic", desc: "Buy 10 things in the shop.", campaign: true },
        { id: "cm-world", icon: "\u{1F3C1}", name: "World Champion", desc: "Clear all five levels of a world.", campaign: true },
        { id: "cm-counter", icon: "\u{1F504}", name: "Turnabout", desc: "Counter 3 boss attacks in one fight.", campaign: true },
        { id: "cm-dailyboss", icon: "\u{1F4C6}", name: "Boss of the Day", desc: "Beat today's boss on Daily.", campaign: true },
        { id: "cm-flawless", icon: "✨", name: "Flawless Race", desc: "Beat a boss with 3 stars.", campaign: true },
        { id: "cm-phase", icon: "\u{1F300}", name: "Phase Breaker", desc: "Beat a boss with 3 or more phases.", campaign: true },
        { id: "cm-void", icon: "\u{1F30C}", name: "Into the Void", desc: "Beat the Void, the final boss.", campaign: true },
        { id: "cm-coins", icon: "\u{1FA99}", name: "Treasure Hoard", desc: "Have 1,000 coins at once.", campaign: true },
        { id: "cm-75", icon: "\u{1F3C5}", name: "Completionist", desc: "Clear all 75 campaign levels.", campaign: true },
        // the secret world, the Celestial Rift: hidden until they're unlocked
        { id: "rf-enter", icon: "\u{1F320}", name: "Through the Rift", desc: "Clear a level in the Celestial Rift.", campaign: true, secret: true },
        { id: "rf-pure", icon: "\u{1F56F}️", name: "Pure Light", desc: "Clear a Celestial Rift level with the corruption never above 25%.", campaign: true, secret: true },
        { id: "rf-angel", icon: "\u{1FAB6}", name: "Fallen Angel", desc: "Beat the Cursed Angel.", campaign: true, secret: true },
        { id: "rf-halo", icon: "\u{1F607}", name: "Halo Breaker", desc: "Beat the Cursed Angel with 3 stars.", campaign: true, secret: true },
        { id: "rf-perfect", icon: "\u{1F31F}", name: "Starlit", desc: "Get 3 stars on every Celestial Rift level, the angel included.", campaign: true, secret: true }
    ];
    const blank = () => ({ unlocked: {}, counts: {}, worlds: {} });
    const load = () => ({ ...blank(), ...U.store.get("achievements", {}) });

    // Check everything after a win; returns the newly unlocked achievements
    function onWin(info, worldId) {
        const fromCampaign = info.campaignStats ? campaign(info.campaignStats) : [];
        const data = load(), got = [...fromCampaign];
        const unlock = id => {
            if (data.unlocked[id]) return;
            data.unlocked[id] = new Date().toISOString().slice(0, 10);
            got.push(LIST.find(a => a.id === id));
        };
        unlock("first");
        if (info.difficulty === "hard") unlock("hard");
        if (info.difficulty === "challenge") unlock("challenger");
        if (info.seconds < 60) unlock("speed60");
        if (info.seconds < 30) unlock("speed30");
        if (info.seconds < 20) unlock("speed20");
        if (info.difficulty === "easy") unlock("easy1");
        if (info.difficulty === "medium") unlock("medium1");
        data.counts.solves = (data.counts.solves || 0) + 1;
        if (data.counts.solves >= 25) unlock("solves25");
        if (data.counts.solves >= 100) unlock("solves100");
        if (info.difficulty === "hard") { data.counts.hard = (data.counts.hard || 0) + 1; if (data.counts.hard >= 10) unlock("hard10"); }
        if (info.difficulty === "hard" && !info.checked && !info.revealed) unlock("clean");
        const hour = new Date().getHours();
        if (hour < 5) unlock("night");
        if (hour >= 5 && hour < 7) unlock("early");
        if (info.checks >= 3) unlock("comeback");
        if (info.mode === "archive") {
            data.counts.archive = (data.counts.archive || 0) + 1;
            if (data.counts.archive >= 10) unlock("archive10");
            if (data.counts.archive >= 50) unlock("archive50");
        }
        data.worlds[worldId] = true;
        if (Worlds.list.every(w => w.plain || w.secret || data.worlds[w.id])) unlock("worlds");      // (the secret world doesn't count)
        if ((info.mode === "daily" || info.daily) && info.counted) {
            if (info.mode === "daily" && info.points >= 300 && info.difficulty !== "challenge") unlock("perfect");
            if (info.left && !info.left.some(d => ["easy", "medium", "hard"].includes(d))) unlock("hat");   // the three normal dailies
            if (info.mode === "daily" && info.difficulty === "challenge" && !info.checked && !info.revealed) unlock("summit");
            if (info.streak >= 3) unlock("streak3");
            if (info.streak >= 7) unlock("streak7");
            if (info.streak >= 14) unlock("streak14");
            if (info.left && !info.left.length) unlock("grand");                                   // all five, the boss too
            data.counts.points = (data.counts.points || 0) + (info.points || 0);
            if (data.counts.points >= 1000) unlock("points1000");
            if (info.streak >= 30) unlock("streak30");
        }
        U.store.set("achievements", data);
        return got;
    }

    // Campaign achievements: checked after a campaign win
    // and after buying something in the shop. Returns the newly unlocked ones.
    function campaign(st) {
        const data = load(), got = [];
        const unlock = id => {
            if (data.unlocked[id]) return;
            data.unlocked[id] = new Date().toISOString().slice(0, 10);
            got.push(LIST.find(a => a.id === id));
        };
        if (st.levels >= 1) unlock("cm-first");
        if (st.bosses >= 1) unlock("cm-boss");
        if (st.bosses >= 8) unlock("cm-half");
        if (st.allBosses && st.bosses >= st.allBosses) unlock("cm-all");
        if (st.stars >= 50) unlock("cm-stars");
        if (st.perfectWorld) unlock("cm-perfect");
        if (st.bought >= 10) unlock("cm-shop");
        if (st.worldDone) unlock("cm-world");
        if (st.allLevels && st.levels >= st.allLevels) unlock("cm-75");
        if (st.totalCoins >= 1000) unlock("cm-coins");
        if (st.special === "daily") unlock("cm-dailyboss");
        if (st.boss && st.hits != null) {
            if (st.hits === 0) unlock("cm-untouched");
            if (st.blocks >= 3) unlock("cm-wall");
            if (st.combo >= 5) unlock("cm-combo");
            if (st.used === 0) unlock("cm-bare");
            if (st.kinds >= 3) unlock("cm-arsenal");
            if (st.closest >= 0.9) unlock("cm-close");
            if (st.lifeUsed) unlock("cm-1up");
            if (st.difficulty === "expert") unlock("cm-expert");
            if (st.counters >= 3) unlock("cm-counter");
            if (st.bossStars === 3) unlock("cm-flawless");
            if (st.phases >= 3 && st.phaseReached === st.phases) unlock("cm-phase");
            if (st.world === "space" && !st.special) unlock("cm-void");
        }
        if (st.world === "rift" && !st.special) {
            unlock("rf-enter");
            if (st.corruptPeak != null && st.corruptPeak <= 25) unlock("rf-pure");
            if (st.boss) { unlock("rf-angel"); if (st.bossStars === 3) unlock("rf-halo"); }
            if (st.riftPerfect) unlock("rf-perfect");
        }
        if (got.length) U.store.set("achievements", data);
        return got;
    }

    function announce(list) {
        list.forEach((a, i) => setTimeout(() => {
            Sound.play("achievement");
            FX.toast({ icon: a.icon, kicker: "ACHIEVEMENT UNLOCKED", title: a.name, text: a.desc, cls: "ach" });
        }, 600 + i * 1100));
    }

    // The grid on the Stats page
    function render(container) {
        const data = load();
        container.innerHTML = "";
        for (const a of LIST) {
            const when = data.unlocked[a.id], hidden = a.secret && !when;     // a secret one stays a secret until it's yours
            container.appendChild(U.el("div", { class: "ach-tile" + (when ? " got" : "") + (hidden ? " secret" : ""), title: when ? `Unlocked ${when}` : "Locked" },
                U.el("span", { class: "ach-icon", text: when ? a.icon : "\u{1F512}" }),
                U.el("b", { text: hidden ? "Secret" : a.name }),
                U.el("small", { text: hidden ? "Keep playing to find it." : a.desc })));
        }
        return { got: Object.keys(data.unlocked).length, total: LIST.length };
    }

    return { LIST, onWin, campaign, announce, render, load };
})();
