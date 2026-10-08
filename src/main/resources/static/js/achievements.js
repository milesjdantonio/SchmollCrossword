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
        { id: "perfect", icon: "\u{1F4AF}", name: "Perfect Score", desc: "Score 300 points on a daily." }
    ];
    const blank = () => ({ unlocked: {}, counts: {}, worlds: {} });
    const load = () => ({ ...blank(), ...U.store.get("achievements", {}) });

    // Check everything after a win; returns the newly unlocked achievements
    function onWin(info, worldId) {
        if (info.test) return [];
        const data = load(), got = [];
        const unlock = id => {
            if (data.unlocked[id]) return;
            data.unlocked[id] = new Date().toISOString().slice(0, 10);
            got.push(LIST.find(a => a.id === id));
        };
        unlock("first");
        if (info.difficulty === "hard") unlock("hard");
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
        if (Worlds.list.every(w => data.worlds[w.id])) unlock("worlds");
        if (info.mode === "daily" && info.counted) {
            if (info.points >= 300) unlock("perfect");
            if (info.left && info.left.length === 0) unlock("hat");
            if (info.streak >= 3) unlock("streak3");
            if (info.streak >= 7) unlock("streak7");
            if (info.streak >= 30) unlock("streak30");
        }
        U.store.set("achievements", data);
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

    return { LIST, onWin, announce, render, load };
})();
