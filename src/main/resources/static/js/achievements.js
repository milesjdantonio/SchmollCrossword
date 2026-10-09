// Achievements: little goals, saved in this browser (schmoll.achievements). Unlocked ones pop up as a toast
// and show on the results screen and the Stats page. Test wins (the temporary Win button) never count.

const Achievements = (() => {
    const LIST = [
        { id: "first", icon: "\u{1F389}", name: "First Solve", desc: "Solve your first puzzle." },
        { id: "hard", icon: "\u{1F48E}", name: "Hardcore", desc: "Solve a Hard puzzle." },
        { id: "hat", icon: "\u{1F3A9}", name: "Hat Trick", desc: "Solve all three dailies in one day." },
        { id: "speed60", icon: "⚡", name: "Lightning", desc: "Solve a puzzle in under a minute." },
        { id: "speed30", icon: "\u{1F680}", name: "Ludicrous Speed", desc: "Solve a puzzle in under 30 seconds." },
        { id: "clean", icon: "\u{1F9FC}", name: "No Peeking", desc: "Solve a Hard puzzle without Check or Reveal." },
        { id: "streak3", icon: "\u{1F525}", name: "On Fire", desc: "Reach a 3-day streak." },
        { id: "streak7", icon: "\u{1F30B}", name: "Unstoppable", desc: "Reach a 7-day streak." },
        { id: "streak30", icon: "\u{1F451}", name: "Royalty", desc: "Reach a 30-day streak." },
        { id: "night", icon: "\u{1F989}", name: "Night Owl", desc: "Solve a puzzle between midnight and 5 AM." },
        { id: "early", icon: "\u{1F413}", name: "Early Bird", desc: "Solve a puzzle between 5 and 7 AM." },
        { id: "unlimited10", icon: "♾️", name: "Can't Stop", desc: "Solve 10 Unlimited puzzles." },
        { id: "worlds", icon: "\u{1F5FA}️", name: "World Traveler", desc: "Solve a puzzle in every world." },
        { id: "comeback", icon: "\u{1FA79}", name: "Never Give Up", desc: "Solve a puzzle after 3 or more Checks." },
        { id: "perfect", icon: "\u{1F4AF}", name: "Perfect Score", desc: "Score 300 points on a normal daily." },
        { id: "challenger", icon: "\u{1F3D4}️", name: "Challenger", desc: "Solve a Challenge puzzle." },
        { id: "summit", icon: "\u{1F9D7}", name: "Summit", desc: "Solve a daily Challenge without Check or Reveal." },
        // the campaign (the user asked for campaign achievements, 2026-10-08)
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
        { id: "cm-close", icon: "⏱️", name: "Photo Finish", desc: "Beat a boss with less than 10 seconds left.", campaign: true },
        { id: "cm-1up", icon: "\u{1F579}️", name: "Second Wind", desc: "Win a boss fight after your Extra Life saved you.", campaign: true },
        { id: "cm-expert", icon: "\u{1F480}", name: "Expert Slayer", desc: "Beat a boss on Expert.", campaign: true },
        { id: "cm-shop", icon: "\u{1F6CD}️", name: "Shopaholic", desc: "Buy 10 things in the shop.", campaign: true }
    ];
    const blank = () => ({ unlocked: {}, counts: {}, worlds: {} });
    const load = () => ({ ...blank(), ...U.store.get("achievements", {}) });

    // Check everything after a win; returns the newly unlocked achievements
    function onWin(info, worldId) {
        const fromCampaign = info.campaignStats ? campaign(info.campaignStats) : [];
        if (info.test) return fromCampaign;
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
        if (info.difficulty === "hard" && !info.checked && !info.revealed) unlock("clean");
        const hour = new Date().getHours();
        if (hour < 5) unlock("night");
        if (hour >= 5 && hour < 7) unlock("early");
        if (info.checks >= 3) unlock("comeback");
        if (info.mode === "unlimited") {
            data.counts.unlimited = (data.counts.unlimited || 0) + 1;
            if (data.counts.unlimited >= 10) unlock("unlimited10");
        }
        data.worlds[worldId] = true;
        if (Worlds.list.every(w => w.plain || data.worlds[w.id])) unlock("worlds");
        if (info.mode === "daily" && info.counted) {
            if (info.points >= 300 && info.difficulty !== "challenge") unlock("perfect");
            if (info.left && !info.left.some(d => d !== "challenge")) unlock("hat");          // the three normal dailies
            if (info.difficulty === "challenge" && !info.checked && !info.revealed) unlock("summit");
            if (info.streak >= 3) unlock("streak3");
            if (info.streak >= 7) unlock("streak7");
            if (info.streak >= 30) unlock("streak30");
        }
        U.store.set("achievements", data);
        return got;
    }

    // Campaign achievements: checked after a campaign win (test wins count, like the campaign itself in the beta)
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
        if (st.boss && st.hits != null) {
            if (st.hits === 0) unlock("cm-untouched");
            if (st.blocks >= 3) unlock("cm-wall");
            if (st.combo >= 5) unlock("cm-combo");
            if (st.used === 0) unlock("cm-bare");
            if (st.kinds >= 3) unlock("cm-arsenal");
            if (st.left < 10) unlock("cm-close");
            if (st.lifeUsed) unlock("cm-1up");
            if (st.difficulty === "expert") unlock("cm-expert");
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
            const when = data.unlocked[a.id];
            container.appendChild(U.el("div", { class: "ach-tile" + (when ? " got" : ""), title: when ? `Unlocked ${when}` : "Locked" },
                U.el("span", { class: "ach-icon", text: when ? a.icon : "\u{1F512}" }),
                U.el("b", { text: a.name }),
                U.el("small", { text: a.desc })));
        }
        return { got: Object.keys(data.unlocked).length, total: LIST.length };
    }

    return { LIST, onWin, campaign, announce, render, load };
})();
