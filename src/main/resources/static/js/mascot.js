// The mascot: each world's little guide (Pip the pencil, Nova the robot, Bumble the bee, Bit the pixel critter).
// It sits in the corner, blinks, bobs, looks toward what you're doing, and talks in a speech bubble that types
// itself out. It reacts to the game through the Bus: finished words, checks, reveals, wins, idling...
// Click it for a tip.

const Mascot = (() => {
    const root = U.el("div", { class: "mascot", html: `
        <div class="m-bubble hide" aria-live="polite"><span class="m-name"></span><p></p><i class="m-next" aria-hidden="true"></i></div>
        <button class="m-face" type="button" aria-label="Ask the mascot for a tip"><canvas width="320" height="320"></canvas></button>` });
    document.body.appendChild(root);
    const cv = root.querySelector("canvas"), g = cv.getContext("2d");
    const bubble = root.querySelector(".m-bubble"), text = root.querySelector(".m-bubble p"), nameEl = root.querySelector(".m-name");
    const face = root.querySelector(".m-face");

    // the state each world's draw function gets
    const st = { t: 0, blink: 0, mood: "idle", look: 0, talk: 0, excite: 0, hop: 0 };
    let blinkIn = 2.5, moodFor = 0, typing = 0, hideTimer = 0, raf = 0, last = 0, lastSaid = "", tipIdx = 0, lastWordLine = 0;

    const SHARED = {
        tips: [
            "Click a square twice (or press Space) to switch between Across and Down.",
            "Tab and Enter jump to the next clue. Shift+Tab goes back.",
            "Check a square costs 5 points; Reveal costs 10. Use them wisely!",
            "Revealing the whole puzzle counts as giving up: no points, no streak.",
            "Solve any one of today's dailies to keep your streak alive.",
            "Faster solves earn a speed bonus: 100 points, minus 10 for each full minute.",
            "Try a different world in Settings. Each one has its own win animation!",
            "Hard puzzles use rarer words, and they're worth 200 points."
        ],
        word: ["Nice!", "Got one!", "Good word!"],
        wrong: ["A few of those need another look."],
        right: ["Everything so far is right!"],
        idle: ["Stuck? Try a crossing word."],
        reveal: ["Here's a little help."],
        surrender: ["No worries, every puzzle teaches you something.", "We'll get the next one!"],
        hello: ["Hi! Let's solve some puzzles."],
        start: ["Tap a square and start typing!"],
        win: ["You did it!"],
        streak: ["Your streak's on fire!"],
        achievement: ["Ooh, a new achievement!"]
    };
    const world = () => Worlds.current;
    function lineFor(event, info) {
        // in the campaign it talks about your lesson, your boss and the story (campaign.js)
        const camp = typeof Campaign !== "undefined" && Campaign.mascotLine ? Campaign.mascotLine(event, info) : null;
        if (camp) return camp;
        const w = world(), list = (w && w.lines && w.lines[event]) || SHARED[event] || SHARED.tips;
        let line = U.pick(list);
        if (list.length > 1 && line === lastSaid) line = U.pick(list);
        return line;
    }

    // ---- the animation loop (paused when the mascot is hidden) ----
    function frame(now) {
        raf = 0;
        const dt = U.clamp((now - last) / 1000, 0, 0.05);       // a frame can be stamped just before "last": never step backwards
        last = now;
        st.t += dt;
        blinkIn -= dt;
        if (blinkIn < 0) { st.blink = 1; blinkIn = U.rand(2.2, 5); }
        st.blink = Math.max(0, st.blink - dt * 7);
        if (moodFor > 0) { moodFor -= dt; if (moodFor <= 0) st.mood = "idle"; }
        st.talk = typing > 0 ? 0.5 + 0.5 * Math.sin(st.t * 22) : Math.max(0, st.talk - dt * 6);
        st.excite = Math.max(0, st.excite - dt * 0.8);
        st.hop = Math.max(0, st.hop - dt * 3);
        st.look += ((Mascot.lookAt ?? 0) - st.look) * Math.min(1, dt * 4);
        g.setTransform(2, 0, 0, 2, 0, 0);
        g.clearRect(0, 0, 160, 160);
        const w = world();
        if (w && w.mascot) { try { w.mascot.draw(g, st); } catch (err) { console.error("mascot", err); } }
        if (!root.classList.contains("away") && !document.hidden && U.motion() !== "still") raf = requestAnimationFrame(frame);
    }
    function wake() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }

    // ---- talking ----
    let typeTimer = 0;
    // a list of lines plays one after another (a companion's hello, then its tip...)
    function say(line, { mood = "happy", quiet = false, hold = 7000, then = null } = {}) {
        if (Array.isArray(line)) {
            const lines = line.filter(Boolean);
            if (!lines.length) return;
            const rest = lines.slice(1);
            return say(lines[0], { mood, quiet, hold: rest.length ? 3800 : hold, then: rest.length ? () => say(rest, { mood, quiet, hold }) : null });
        }
        if (!line) return;
        lastSaid = line;
        clearInterval(typeTimer);
        clearTimeout(hideTimer);
        setMood(mood, 3);
        bubble.classList.remove("hide");
        U.restart(bubble, "pop");
        // no sound when it talks: it talks on its own (tips, idle hints), and sounds should only answer the player
        let n = 0;
        typing = 1;
        text.textContent = "";
        typeTimer = setInterval(() => {
            n += 2;
            text.textContent = line.slice(0, n);
            if (n >= line.length) {
                clearInterval(typeTimer);
                typing = 0;
                hideTimer = setTimeout(() => { if (then) then(); else bubble.classList.add("hide"); }, hold);
            }
        }, 24);
        wake();
    }
    function setMood(mood, seconds = 2.5) {
        st.mood = mood;
        moodFor = seconds;
        if (mood === "happy" || mood === "wow") { st.hop = 1; st.excite = 1; }
        wake();
    }
    function react(event, opts = {}) { say(lineFor(event), opts); }
    function hush() { clearInterval(typeTimer); clearTimeout(hideTimer); typing = 0; bubble.classList.add("hide"); }

    face.addEventListener("click", () => {
        st.hop = 1;
        Sound.play("mascot");
        // in the campaign your companion tells you its story, one click at a time (companions.js)
        const story = typeof Companions !== "undefined" ? Companions.click() : null;
        if (story) return say(story, { mood: "happy", quiet: true, hold: 10000 });
        say(SHARED.tips[tipIdx++ % SHARED.tips.length], { mood: "happy", quiet: true });
    });
    bubble.addEventListener("click", () => bubble.classList.add("hide"));

    // ---- reactions ----
    Bus.on("world", w => {
        hush();                                   // the old world's mascot stops mid-sentence
        nameEl.textContent = w.mascot ? w.mascot.name : "";
        wake();
    });
    Bus.on("type", info => { Mascot.lookAt = info && info.col != null ? U.clamp((info.col - 2) / 2, -1, 1) : 0; });
    Bus.on("word", () => {
        setMood("happy", 1.6);
        const now = performance.now();
        if (now - lastWordLine > 9000 && Math.random() < 0.55) { lastWordLine = now; react("word", { mood: "happy", quiet: true, hold: 2500 }); }
    });
    Bus.on("check", ({ anyWrong, anyFilled }) => {
        if (anyWrong) react("wrong", { mood: "sad" });
        else if (anyFilled) react("right", { mood: "happy" });
    });
    Bus.on("reveal", () => react("reveal", { mood: "wow", hold: 3000 }));
    Bus.on("idle", () => react("idle", { mood: "idle" }));
    Bus.on("surrender", () => react("surrender", { mood: "sad" }));
    Bus.on("results", info => {
        if (info.campaign) { const camp = lineFor("win", info); if (camp) return say(camp, { mood: "happy", hold: 9000 }); }
        let line = info.best != null ? "A new personal best! " + lineFor("win") : lineFor("win");
        if (info.firstToday && info.streak > 1) line += ` That's a ${info.streak}-day streak!`;
        else if (info.mode === "daily" && info.left && info.left.length) line += ` Still to play today: ${info.left.join(", ")}.`;
        else if (info.mode === "daily" && info.left && !info.left.length) line += " That's every daily done for today!";
        say(line, { mood: "happy", hold: 9000 });
    });
    Bus.on("puzzle", ({ fresh }) => { if (fresh && !Mascot.startedOnce) { Mascot.startedOnce = true; setTimeout(() => react("start", { mood: "happy" }), 2200); } });

    return {
        say, react, setMood, wake,
        lookAt: 0, startedOnce: false,
        set away(on) { root.classList.toggle("away", on); if (!on) wake(); },
        hush
    };
})();
