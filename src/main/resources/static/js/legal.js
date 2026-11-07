// FAQ, Privacy Notice and Terms of Use. Opened from Settings > Help & Legal.
//   Legal.open("faq" | "privacy" | "terms")
// Written to match what the code really does (LeaderboardController, ReportController, RateLimiter, game storage).
// If that changes, change these too, and the "Last updated" date.
const Legal = (() => {
    const UPDATED = "November 7, 2026";
    const REPO = "https://github.com/milesjdantonio/SchmollCrossword";
    const p = (...parts) => U.el("p", {}, ...parts);
    const a = (text, href) => U.el("a", { href, text, target: "_blank", rel: "noopener" });
    const go = (text, doc) => U.el("button", { type: "button", class: "link-btn", text, onclick: () => open(doc) });
    const ul = (...items) => U.el("ul", {}, ...items.map(i => U.el("li", {}, ...(Array.isArray(i) ? i : [i]))));
    const h = text => U.el("h3", { text });
    const qa = (q, ...answer) => U.el("details", { class: "lg-qa" }, U.el("summary", { text: q }), U.el("div", {}, ...answer));

    const DOCS = {
        faq: { title: "FAQ", body: () => [
            h("The Game"),
            qa("Is it free? Will there ever be ads?",
                p("It's free, with no ads and nothing to buy. The word list it's built from is licensed for non-commercial use only, so it will stay that way.")),
            qa("Do I need an account?",
                p("No. Your progress, stats and settings are saved in your browser on this device. Clearing your browser's site data, or Settings > Reset > Erase All Data, removes them. Erase Campaign Data removes just the campaign.")),
            qa("Is this the New York Times Mini?",
                p("No. Schmoll Crossword is an independent project. It isn't affiliated with or endorsed by The New York Times or any other publisher. Its puzzles, clues, art and music are its own or credited in the Credits.")),
            qa("A clue is wrong or unfair. What do I do?",
                p("Use Report a Problem under any puzzle. Say what's wrong; it helps fix that clue for everyone.")),
            h("Security and Privacy"),
            qa("What do you know about me?",
                p("Almost nothing. No account, no email, no tracking. If you choose to join the leaderboard, your first name, a last initial if you add one, and daily scores are stored. The ", go("Privacy Notice", "privacy"), " lists everything.")),
            qa("How do I remove my name from the leaderboard?",
                p("Stats > World Leaderboard > Remove My Name, Settings > Reset > Erase Leaderboard Data, or the button in the Privacy Notice. It deletes your name and every score you posted, on every day.")),
            qa("Can someone put code or a link in their name or a report?",
                p("No. Names can only be letters (with ' or - between them), and everything people type is shown as plain text, never as code. The site only runs its own scripts: a strict security policy blocks anything else, and it can't be shown inside another site's frame.")),
            qa("Does the site use cookies, analytics or trackers?",
                p("No. There are no cookies, no analytics and no third-party scripts. Fonts, music and sounds are served from this site, so your browser doesn't contact anyone else.")),
            qa("Does the AI see anything about me?",
                p("No. New clues are written on our server by Claude, an AI model made by Anthropic. Only a puzzle's answer words are sent to it, never anything about you. Your browser never talks to Anthropic, and the API key never leaves the server.")),
            qa("Can people cheat on the leaderboard?",
                p("The server works out every score itself from the puzzle's results, so a made-up point total won't count. Solve times come from the player's browser, so a determined cheater could fake a fast time. Names that break the ", go("Terms", "terms"), " can be removed.")),
            qa("I found a security problem. How do I report it?",
                p("Please report it privately: on the ", a("source code page", REPO), ", open the Security tab and choose Report a Vulnerability. Please don't post the details publicly before it's fixed.")),
            h("Credits and Licenses"),
            qa("Who made the music, fonts and words?",
                p("Every song, sound pack, font and word list is credited by name in the Credits (Settings > Help & Legal > Credits). The recorded music and sound effects are public domain (CC0), except five boss songs under Creative Commons licenses that need credit (CC BY 3.0, and one CC BY-SA 4.0), credited there; the fonts are under the SIL Open Font License; the word list comes from SCOWL and Spread the Word(list).")),
            qa("Can I use the code or the puzzles?",
                p("The code is under the MIT License: use it, change it and share it, keeping the copyright notice. The word lists, puzzles and clues are under ", a("CC BY-NC-SA 4.0", "https://creativecommons.org/licenses/by-nc-sa/4.0/"), ": non-commercial use only, with credit, under the same license. The repository's NOTICE.md lists what covers what.")),
            qa("Who made the game?",
                p("Miles D'Antonio, assisted by Claude, an AI model by Anthropic, with the code, the worlds and the clues. The music composed for the game was composed by Claude.")),
        ] },
        privacy: { title: "Privacy Notice", body: () => [
            p("Schmoll Crossword is a free game with no accounts, no ads and no tracking. This notice explains the little it does keep."),
            h("On Your Device"),
            p("Your progress, scores, streaks, stats, coins, achievements, settings and your campaign hero (its look and the name you give it) are saved in your browser's storage on this device. They aren't sent to us, except for what you choose to post to the leaderboard (below). Erase them any time with Settings > Reset (Erase Campaign Data, Erase Leaderboard Data or Erase All Data), or by clearing this site's data in your browser."),
            p("Your browser also makes a random ID once, so the leaderboard can tell your scores apart from other players'. It isn't linked to who you are, and it's never shown to anyone."),
            h("The World Leaderboard (Optional)"),
            p("If you choose to join, we store the first name you pick (and a last initial, if you add one), that random ID, and each daily's score and solve time, by day. Your name and points are shown publicly on that day's leaderboard, and each day's board is deleted after 30 days. Don't use a name you'd rather keep private."),
            p("You can remove all of it at any time:"),
            U.el("p", {}, U.el("button", { type: "button", class: "btn", id: "lg-forget", text: "Remove My Name", onclick: () => Leaderboard.askForget() })),
            h("Report a Problem"),
            p("If you send a report, we store what you typed, the puzzle and clue it's about, and which world you were in. No name or IP address is saved with it. Please don't include personal details in the message."),
            h("Server Logs and Limits"),
            p("To stop abuse (limits on posting and reports), the server keeps your IP address in its memory for at most 24 hours. It's never written to disk, and it's gone when the server restarts. The company that hosts the site may keep standard access logs, such as IP addresses and times, for its own security."),
            h("What We Don't Do"),
            ul("No cookies, analytics, ads or third-party trackers.", "No selling or sharing of your information.",
                "No emails or accounts.", "Fonts, music and sounds come from this site, not from other companies."),
            h("AI-Written Clues"),
            p("New clues are written on our server by Claude, an AI model made by Anthropic. Only a puzzle's answer words are sent, never anything about you."),
            h("Children"),
            p("Schmoll Crossword is for everyone and doesn't ask anyone's age. The leaderboard is the only place a name is collected, and it's optional. If you're under 13, please don't post your name to the leaderboard. If you're a parent and your child did, use Remove My Name on their device, or contact us below and we'll delete it."),
            h("Contact"),
            p("Questions or a request to delete something: open an issue on the ", a("source code page", REPO), ". Please don't post personal details there; say what you need and we'll reply."),
            h("Changes"),
            p("If this notice changes, the date below changes too."),
            U.el("p", { class: "lg-date", text: "Last updated " + UPDATED }),
        ] },
        terms: { title: "Terms of Use", body: () => [
            p("By playing Schmoll Crossword you agree to these terms. They're short, and meant to keep the game fair and safe."),
            h("The Game"),
            p("Schmoll Crossword is a free game, offered as it is. It may change, have mistakes, be offline at times, or stop. Puzzles and clues are made by a program and an AI model, so a clue can occasionally be wrong; please report it."),
            h("Playing Fair"),
            ul("Use your own first name, or a nickname, on the leaderboard. Don't pretend to be someone else.",
                "No offensive, hateful or harassing names. Some words are blocked, and any name can be removed.",
                "Don't try to break, overload or get around the site's limits, and don't post fake results.",
                "Don't use the site to collect other players' information."),
            p("We can remove leaderboard entries, and block abuse, at our discretion."),
            h("Content and Licenses"),
            p("The code is under the MIT License. The word lists, puzzles and clues are under ", a("CC BY-NC-SA 4.0", "https://creativecommons.org/licenses/by-nc-sa/4.0/"),
                ", so they may be reused only non-commercially, with credit and under the same license. Music, sounds and fonts belong to their authors under the licenses in the Credits. Schmoll Crossword isn't affiliated with The New York Times or any other publisher."),
            h("No Warranty"),
            p("The game is provided without any warranty. As far as the law allows, its makers aren't liable for any loss or damage from using it, including lost progress or scores. Your progress lives in your browser, so clearing it erases it."),
            h("Privacy"),
            p("The ", go("Privacy Notice", "privacy"), " explains what's stored and how to remove it."),
            h("Changes"),
            p("These terms may change. If they do, the date below changes, and playing after that means you accept the new terms."),
            U.el("p", { class: "lg-date", text: "Last updated " + UPDATED }),
        ] },
    };

    let modal = null, closing = 0;
    function open(doc) {
        const d = DOCS[doc];
        if (!d) return;
        clearTimeout(closing);
        if (!modal) {
            modal = U.el("div", { class: "lg-modal", role: "dialog", "aria-modal": "true" });
            modal.addEventListener("pointerdown", e => { if (e.target === modal) close(); });
            addEventListener("keydown", e => { if (modal && modal.isConnected && e.key === "Escape") { e.preventDefault(); close(); } }, true);
            addEventListener("hashchange", () => { if (modal && modal.isConnected) close(); });
        }
        modal.setAttribute("aria-label", d.title);
        modal.innerHTML = "";
        const tabs = U.el("nav", { class: "lg-tabs" }, ...Object.entries(DOCS).map(([k, x]) =>
            U.el("button", { type: "button", class: k === doc ? "on" : "", text: x.title, onclick: () => open(k) })));
        const card = U.el("div", { class: "lg-card" },
            U.el("header", { class: "lg-head" }, U.el("h2", { text: d.title }), U.el("button", { type: "button", class: "btn lg-close", text: "Close", onclick: close })),
            tabs, U.el("div", { class: "lg-body" }, ...d.body()));
        modal.appendChild(card);
        // only offer Remove My Name when there's a name to remove
        const f = card.querySelector("#lg-forget");
        if (f && !Leaderboard.hasName()) f.replaceWith(U.el("small", { class: "lg-none", text: "You haven't joined the leaderboard on this device." }));
        if (!modal.isConnected) { document.body.appendChild(modal); requestAnimationFrame(() => modal.classList.add("in")); }
        card.querySelector(".lg-body").scrollTop = 0;
        card.querySelector(".lg-close").focus();
    }
    function close() {
        if (!modal) return;
        modal.classList.remove("in");
        const m = modal;
        closing = setTimeout(() => m.remove(), 200);
    }
    return { open };
})();
