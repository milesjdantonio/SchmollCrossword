// The campaign's story (the user, 2026-10-09: "the story is about getting a bunch of pages back for a book"):
// the Everbook, the book that holds every word in every world, was torn apart by the Void; its 15 pages fell into
// the 15 worlds and their bosses took them. Three cinematics and a book you can open:
//   Story.intro(c, pages)            the opening: the Everbook, the Void tearing it apart, its pages flying to the 15 bosses
//   Story.page(c, pages, world)      after a boss's first defeat: its page flies into the book
//   Story.finale(c, pages)           the last page: the book is whole, the words pour back into the worlds
//   Story.epilogue(c, pages, hero)   the Cursed Angel beaten (the secret world, 2026-10-14): it falls, the rift closes,
//                                    the Everbook is clasped shut for good, and your hero keeps it
//   Story.openBook(pages)            the book itself (from the 📖 button on the map): the pages you've won
// pages = [{ world, name (the world), boss, color, won }] in map order (Campaign.storyPages()).
// c comes from FX.cinematic (skippable).
const Story = (() => {
    const $ = sel => document.querySelector(sel);
    const still = () => U.motion() === "still";
    const chime = (notes, step = 0.12, type = "triangle", v = 0.07) => notes.forEach((n, i) => Sound.tone({ t: i * step, f: Sound.midi(n), type, d: 0.6, v }));
    const say = (el, text) => { const p = el.querySelector(".lx-caption"); p.classList.remove("in"); void p.offsetWidth; p.textContent = text; p.classList.add("in"); };

    // ---- the book, drawn in HTML/CSS: a leather cover with gold, and an open spread of two parchment pages ----
    function bookHtml(pages, { open = true, showSlots = true } = {}) {
        const slots = pages.map((p, i) => `<button type="button" class="lx-slot${p.won ? " won" : ""}" data-i="${i}" style="--c:${p.color}" ${p.won ? "" : "disabled"} title="${U.esc(p.won ? p.name + ": " + p.boss + "'s page" : "Page " + (i + 1) + ": not won yet")}"><b>${i + 1}</b><small>${U.esc(p.won ? p.name : "?")}</small></button>`).join("");
        return `<div class="lx-book${open ? " open" : ""}">
            <div class="lx-cover"><div class="lx-cover-inner"><i class="lx-corner tl"></i><i class="lx-corner tr"></i><i class="lx-corner bl"></i><i class="lx-corner br"></i>
                <div class="lx-gem"></div><b class="lx-title">THE EVERBOOK</b><small class="lx-sub">every word in every world</small></div></div>
            <div class="lx-spread">
                <div class="lx-page lx-left">${showSlots ? `<h3 class="lx-h">The Pages</h3><div class="lx-slots">${slots}</div><p class="lx-count"><b>${pages.filter(p => p.won).length}</b> of ${pages.length} pages</p>` : linesHtml(14)}</div>
                <div class="lx-page lx-right"><div class="lx-right-inner">${linesHtml(16)}</div></div>
            </div>
        </div>`;
    }
    const linesHtml = n => `<div class="lx-lines">${Array.from({ length: n }, (_, i) => `<i style="width:${(62 + ((i * 37) % 33))}%"></i>`).join("")}</div>`;
    // one page of the Everbook: the world's name in its own lettering, an illustration of its boss, lines of text
    function leafHtml(p, i, total) {
        return `<div class="lx-leaf" data-world="${p.world}" style="--c:${p.color}">
            <div class="lx-leaf-band"></div>
            <b class="lx-leaf-title">${U.esc(p.name)}</b>
            <div class="lx-leaf-art">${typeof Bosses !== "undefined" ? Bosses.svg(p.world) : ""}</div>
            ${linesHtml(5)}
            <small class="lx-leaf-num">Page ${i + 1} of ${total}</small>
        </div>`;
    }
    function stage(cls) {
        const el = U.el("div", { class: "lx-stage " + cls, "aria-hidden": "true", html: `<canvas class="lx-fx"></canvas><div class="lx-scene"></div><p class="lx-caption"></p><p class="lx-skip">Click to skip</p>` });
        document.getElementById("overlay").appendChild(el);
        requestAnimationFrame(() => el.classList.add("in"));
        return el;
    }
    // floating dust and glowing letters in the background of the story scenes
    function ambience(el, { letters = false, color = "#ffd98a" } = {}) {
        const cv = el.querySelector(".lx-fx"), ctx = cv.getContext("2d"), dots = [];
        const fit = () => { cv.width = innerWidth; cv.height = innerHeight; };
        fit();
        for (let i = 0; i < 70; i++) dots.push({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, v: 8 + Math.random() * 20, s: 1 + Math.random() * 2, ch: letters && Math.random() < 0.45 ? String.fromCharCode(65 + Math.floor(Math.random() * 26)) : null, ph: Math.random() * 6 });
        let raf = 0, last = performance.now();
        const loop = now => {
            if (!el.isConnected) return;
            raf = requestAnimationFrame(loop);
            const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
            ctx.clearRect(0, 0, cv.width, cv.height);
            for (const d of dots) {
                d.y -= d.v * dt; d.x += Math.sin(now / 1500 + d.ph) * 0.2;
                if (d.y < -20) { d.y = innerHeight + 10; d.x = Math.random() * innerWidth; }
                ctx.globalAlpha = 0.25 + Math.sin(now / 700 + d.ph) * 0.2;
                ctx.fillStyle = color;
                if (d.ch) { ctx.font = `700 ${10 + d.s * 5}px Georgia, serif`; ctx.fillText(d.ch, d.x, d.y); }
                else { ctx.beginPath(); ctx.arc(d.x, d.y, d.s, 0, 7); ctx.fill(); }
            }
        };
        if (!still()) raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }
    // a leaf flying from one point to another, flipping over as it goes (Web Animations)
    function flyLeaf(leaf, from, to, ms = 1200, spin = 1) {
        if (still()) return Promise.resolve();
        const r = leaf.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const dx0 = from.x - cx, dy0 = from.y - cy, dx1 = to.x - cx, dy1 = to.y - cy;
        return leaf.animate([
            { transform: `translate(${dx0}px, ${dy0}px) scale(.25) rotateY(0deg) rotate(${-30 * spin}deg)`, opacity: 0 },
            { transform: `translate(${(dx0 + dx1) / 2}px, ${(dy0 + dy1) / 2 - 140}px) scale(.9) rotateY(${180 * spin}deg) rotate(${15 * spin}deg)`, opacity: 1, offset: 0.55 },
            { transform: `translate(${dx1}px, ${dy1}px) scale(1) rotateY(${360 * spin}deg) rotate(0deg)`, opacity: 1 }
        ], { duration: ms, easing: "cubic-bezier(.3,.1,.3,1)", fill: "forwards" }).finished.catch(() => null);
    }

    // =============================================================================================
    // The opening
    // =============================================================================================
    // the story's own music (Once Upon a Time by TAD, CC0) under every cutscene; it fades out when the scene ends
    // Each cutscene's music is scored to it (the user, 2026-10-10: "make the story music follow the story animation"):
    // story (the intro), story-page and story-finale, composed for the game so every change lands on a scene (the
    // Void tearing the book, the pages scattering, the title...). The scenes wait for it to start, up to 1.5 s.
    // With the music off, the book's own little chimes play instead.
    const scored = () => Sound.bossMusicOn;            // (Boss Music above 0)
    async function storyMusic(c, name) {
        c.cleanup(() => { if (Sound.musicPlaying === name) Sound.stopMusic(1.4); });
        if (!scored()) return;
        await Promise.race([Sound.music(name, { loop: false, v: 0.38, fade: 0.6 }), c.wait(1500)]);
    }
    const sfx = fn => { if (!scored()) fn(); };          // a sound the score already plays
    async function intro(c, pages) {
        const el = stage("lx-intro"), scene = el.querySelector(".lx-scene"), stop = ambience(el, { letters: true });
        c.cleanup(() => { stop(); el.remove(); });
        await storyMusic(c, "story");
        // 1. the Everbook, whole: all fifteen pages in it, whether or not you've won them back yet (the user's rule)
        const whole = pages.map(p => ({ ...p, won: true }));
        scene.innerHTML = `<div class="lx-hero">${bookHtml(whole, { open: false })}</div>`;
        const book = scene.querySelector(".lx-book");
        say(el, "Long ago, every word in every world was kept in one book: the Everbook.");
        sfx(() => chime([60, 64, 67, 72], 0.18, "sine", 0.06));
        await c.wait(3200);
        // 2. it opens and the words rise out of it
        book.classList.add("open");
        say(el, "As long as it was whole, every word meant something, and every world could speak.");
        const rise = U.el("div", { class: "lx-words" });
        scene.appendChild(rise);
        "PAGEWORDCLUESTORYBOOKVERB".split("").forEach((ch, i) => { const s = U.el("span", { text: ch, style: { left: (20 + Math.random() * 60) + "%", animationDelay: (i * 90) + "ms" } }); rise.appendChild(s); });
        sfx(() => chime([67, 71, 74, 79], 0.14, "triangle", 0.05));
        await c.wait(3200);
        if (c.skipped) return;
        // 3. the Void tears it apart
        const voidEl = U.el("div", { class: "lx-void", html: `<div class="lx-vortex"></div><div class="lx-void-boss">${Bosses.svg("space")}</div>` });
        scene.appendChild(voidEl);
        requestAnimationFrame(() => voidEl.classList.add("in"));
        say(el, "Then the Void came, and tore the Everbook apart.");
        sfx(() => Sound.tone({ f: 70, f2: 35, d: 1.6, v: 0.25 }));
        await c.wait(1500);
        FX.shake(14, 700);
        FX.flash("#e8dcff", 300, 0.5);
        book.classList.add("torn");
        rise.remove();
        const center = (() => { const r = book.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })();
        sfx(() => Sound.tone({ f: 900, f2: 200, d: 0.8, v: 0.05, type: "sawtooth" }));
        await c.wait(800);
        if (c.skipped) return;
        // 4. the pages go out to the fifteen bosses: each one flies from the torn book to its boss, who grabs it
        voidEl.classList.add("out");
        scene.querySelector(".lx-hero").classList.add("out");
        const grid = U.el("div", { class: "lx-worlds dealing measure", html: pages.map((p, i) => `<div class="lx-world" style="--c:${p.color};--i:${i}"><div class="lx-world-boss">${Bosses.svg(p.world)}</div><div class="lx-mini-leaf held"></div><small>${U.esc(p.name)}</small></div>`).join("") });
        scene.appendChild(grid);
        // where each boss's page ends up, measured before the bosses start moving in
        const spots = [...grid.querySelectorAll(".lx-mini-leaf.held")].map(h => { const r = h.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
        grid.classList.remove("measure");
        say(el, "Its fifteen pages fell into fifteen worlds, and in every one, a boss grabbed its page and won't give it back.");
        const flights = U.el("div", { class: "lx-scatter" });
        scene.appendChild(flights);
        const worlds = [...grid.querySelectorAll(".lx-world")];
        pages.forEach((p, i) => {
            const land = () => {
                if (!el.isConnected) return;
                worlds[i].classList.add("got");
                FX.burst({ x: spots[i].x, y: spots[i].y, n: 14, colors: ["#fff", "#ffd98a", p.color], shape: "star", speed: [60, 180], gravity: 90, life: [0.4, 0.8], size: [2, 4] });
                sfx(() => Sound.tone({ f: Sound.midi(64 + (i % 5) * 3), d: 0.25, v: 0.04, type: "triangle" }));
            };
            if (still()) { land(); return; }
            const leaf = U.el("div", { class: "lx-mini-leaf", style: { "--c": p.color } });
            flights.appendChild(leaf);
            const t = spots[i], up = 120 + Math.random() * 120, side = (Math.random() - 0.5) * 160, spin = Math.random() < 0.5 ? -1 : 1;
            leaf.animate([
                { transform: `translate(${center.x}px, ${center.y}px) rotate(0) scale(.5)`, opacity: 0 },
                { transform: `translate(${(center.x + t.x) / 2 + side}px, ${Math.min(center.y, t.y) - up}px) rotate(${360 * spin}deg) scale(1.15)`, opacity: 1, offset: 0.5 },
                { transform: `translate(${t.x}px, ${t.y}px) rotate(${734 * spin}deg) scale(.6)`, opacity: 1 }
            ], { duration: 1000, delay: 300 + i * 160, easing: "cubic-bezier(.35,.1,.35,1)", fill: "both" })
                .finished.then(() => { leaf.remove(); land(); }, () => null);
        });
        sfx(() => chime([57, 60, 64, 57, 60, 65], 0.1, "triangle", 0.04));
        await c.wait(300 + pages.length * 160 + 1000 + 2000);          // the title lands where the score expects it (8 s after the tear starts)
        if (c.skipped) return;
        // 5. your quest
        grid.classList.add("out");
        const title = U.el("div", { class: "lx-titlecard", html: `<small>A SCHMOLL CROSSWORD STORY</small><b>The Lost Everbook</b><em>Win back every page, solve your way through every world, and make the book whole again.</em>` });
        scene.appendChild(title);
        requestAnimationFrame(() => title.classList.add("in"));
        el.querySelector(".lx-caption").classList.remove("in");
        sfx(() => chime([60, 67, 72, 76, 79, 84], 0.12, "sine", 0.07));
        await c.wait(3800);
        el.classList.add("out");
        await c.wait(500);
    }

    // =============================================================================================
    // A page won: it flies out of the beaten boss and into its slot in the book
    // =============================================================================================
    async function page(c, pages, world) {
        const i = pages.findIndex(p => p.world === world);
        if (i < 0) return;
        const p = pages[i], el = stage("lx-pagewin"), scene = el.querySelector(".lx-scene"), stop = ambience(el, { color: p.color });
        c.cleanup(() => { stop(); el.remove(); });
        await storyMusic(c, "story-page");
        const before = pages.map((q, j) => (j === i ? { ...q, won: false } : q));
        scene.innerHTML = `<div class="lx-boss-gone">${Bosses.svg(world)}</div><div class="lx-hero">${bookHtml(before)}</div>`;
        const right = scene.querySelector(".lx-right-inner"), slot = scene.querySelector(`.lx-slot[data-i="${i}"]`);
        say(el, `${p.boss} lets go of the ${p.name} page…`);
        await c.wait(1100);
        // the page itself, flying from the boss into the right-hand page
        right.innerHTML = leafHtml(p, i, pages.length);
        const leaf = right.querySelector(".lx-leaf"), bossBox = scene.querySelector(".lx-boss-gone").getBoundingClientRect(), dest = right.getBoundingClientRect();
        sfx(() => Sound.tone({ f: 300, f2: 900, d: 0.5, v: 0.05, type: "sine" }));
        await flyLeaf(leaf, { x: bossBox.left + bossBox.width / 2, y: bossBox.top + bossBox.height / 2 }, { x: dest.left + dest.width / 2, y: dest.top + dest.height / 2 }, 1300);
        leaf.classList.add("glow");
        // ...and its slot lights up, the count goes up
        slot.classList.add("won", "just");
        slot.disabled = false;
        slot.querySelector("small").textContent = p.name;
        const won = pages.filter(q => q.won).length;
        scene.querySelector(".lx-count").innerHTML = `<b>${won}</b> of ${pages.length} pages`;
        const sr = slot.getBoundingClientRect();
        FX.burst({ x: sr.left + sr.width / 2, y: sr.top + sr.height / 2, n: 30, colors: ["#fff", "#ffd98a", p.color], shape: "star", speed: [80, 260], gravity: 120, life: [0.5, 1], size: [2, 5] });
        sfx(() => chime([72, 76, 79, 84], 0.1, "triangle", 0.07));
        say(el, won >= pages.length ? "The last page is back where it belongs." : `The ${p.name} page is back in the Everbook. ${pages.length - won} still missing.`);
        await c.wait(3000);
        el.classList.add("out");
        await c.wait(450);
    }

    // =============================================================================================
    // The finale: every page is back
    // =============================================================================================
    async function finale(c, pages) {
        const el = stage("lx-finale"), scene = el.querySelector(".lx-scene"), stop = ambience(el, { letters: true, color: "#ffe9a8" });
        c.cleanup(() => { stop(); el.remove(); });
        await storyMusic(c, "story-finale");
        scene.innerHTML = `<div class="lx-hero">${bookHtml(pages)}</div>`;
        const book = scene.querySelector(".lx-book");
        say(el, "Fifteen pages. Every one of them won back.");
        await c.wait(2200);
        book.classList.remove("open");
        book.classList.add("whole");
        say(el, "The Everbook is whole again.");
        sfx(() => chime([60, 64, 67, 72, 76, 79], 0.15, "sine", 0.07));
        await c.wait(1800);
        if (c.skipped) return;
        FX.flash("#fff6d8", 500, 0.7);
        // the words pour out of it, back into every world
        const ring = U.el("div", { class: "lx-orbs", html: pages.map((p, i) => `<div class="lx-orb" style="--c:${p.color};--a:${(i / pages.length) * 360}deg"><span>${U.esc(p.name)}</span></div>`).join("") });
        scene.appendChild(ring);
        const r = book.getBoundingClientRect(), o = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        for (let k = 0; k < 6; k++) setTimeout(() => FX.burst({ x: o.x, y: o.y, n: 40, colors: ["#fff", "#ffe066", ...pages.slice(k * 2, k * 2 + 3).map(p => p.color)], shape: "star", speed: [200, 600], gravity: 80, life: [0.8, 1.6], size: [2, 6] }), still() ? 0 : k * 380);
        say(el, "Every word flies home. The worlds can speak again, and the Void is closed for good.");
        await c.wait(4200);
        if (c.skipped) return;
        ring.classList.add("out");
        scene.querySelector(".lx-hero").classList.add("out");
        const end = U.el("div", { class: "lx-titlecard end", html: `<small>THE LOST EVERBOOK</small><b>The End</b><em>You won back every page. Thank you for playing Schmoll Crossword.</em>` });
        scene.appendChild(end);
        requestAnimationFrame(() => end.classList.add("in"));
        el.querySelector(".lx-caption").classList.remove("in");
        sfx(() => chime([67, 72, 76, 79, 84, 88], 0.16, "sine", 0.07));
        for (let k = 0; k < 4; k++) setTimeout(() => FX.burst({ x: innerWidth * (0.2 + Math.random() * 0.6), y: innerHeight * (0.2 + Math.random() * 0.3), n: 50, colors: ["#ffe066", "#ff5c6c", "#7ad7ff", "#fff"], shape: "star", speed: [150, 450], gravity: 200, life: [0.8, 1.4], size: [2, 5] }), still() ? 0 : 600 + k * 500);
        await c.wait(5000);
        el.classList.add("out");
        await c.wait(500);
    }

    // The epilogue: the Cursed Angel falls, its rift heals, and the Everbook is closed for good
    async function epilogue(c, pages, hero) {
        const el = stage("lx-epilogue"), scene = el.querySelector(".lx-scene"), stop = ambience(el, { letters: true, color: "#ffe7a3" });
        c.cleanup(() => { stop(); el.remove(); });
        await storyMusic(c, "story-finale");
        scene.innerHTML = `<div class="lx-sky"><div class="lx-tear"></div><div class="lx-angel">${typeof Bosses !== "undefined" ? Bosses.svg("rift") : ""}</div><i class="lx-vigil"></i></div>`;
        say(el, "The Cursed Angel wanted every word for itself.");
        await c.wait(2400);
        if (c.skipped) return;
        scene.querySelector(".lx-angel").classList.add("fall");
        sfx(() => chime([76, 72, 69, 64, 60, 57], 0.13, "sine", 0.06));
        FX.shake(8, 600);
        const a = scene.querySelector(".lx-angel").getBoundingClientRect(), ao = { x: a.left + a.width / 2, y: a.top + a.height / 2 };
        for (let k = 0; k < 4; k++) setTimeout(() => FX.burst({ x: ao.x, y: ao.y + k * 40, n: 30, colors: ["#ffffff", "#1c1230", "#ffe7a3", "#9b6bff"], shape: "petal", speed: [120, 380], gravity: 160, life: [1, 1.8], size: [6, 11], spin: 3 }), still() ? 0 : k * 260);
        say(el, "Now its light goes out, feather by feather.");
        await c.wait(2600);
        if (c.skipped) return;
        scene.querySelector(".lx-tear").classList.add("heal");
        FX.flash("#fff6d8", 600, 0.6);
        say(el, "The rift in the sky closes. Vigil shines in its place, keeping watch again, over everyone this time.");
        sfx(() => chime([72, 76, 79, 84, 88], 0.15, "sine", 0.06));
        scene.querySelector(".lx-vigil").classList.add("in");
        await c.wait(3800);
        if (c.skipped) return;
        scene.querySelector(".lx-sky").classList.add("out");
        scene.insertAdjacentHTML("beforeend", `<div class="lx-hero lx-keeper">${bookHtml(pages)}<i class="lx-clasp"></i>${hero && typeof Hero !== "undefined" ? `<div class="lx-keeper-hero">${Hero.svg(hero)}</div>` : ""}</div>`);
        const book = scene.querySelector(".lx-keeper .lx-book");
        book.classList.remove("open"); book.classList.add("whole");
        await c.wait(600);
        scene.querySelector(".lx-clasp").classList.add("lock");
        sfx(() => chime([60, 67, 72, 79], 0.1, "triangle", 0.07));
        const r = book.getBoundingClientRect(), o = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        FX.ring({ x: o.x, y: o.y, color: "#ffd06b", r1: Math.max(innerWidth, innerHeight) * 0.5, width: 12, dur: 1.2 });
        FX.burst({ x: o.x, y: o.y, n: 60, colors: ["#fff6d8", "#ffd06b", "#c49bff"], shape: "star", speed: [150, 500], gravity: 60, life: [1, 1.8], size: [2, 6] });
        say(el, `The Everbook is clasped shut, and ${hero && hero.name ? hero.name : "you"} will keep it safe. No one will ever tear it again.`);
        await c.wait(4200);
        if (c.skipped) return;
        scene.querySelector(".lx-keeper").classList.add("out");
        const end = U.el("div", { class: "lx-titlecard end", html: `<small>THE LOST EVERBOOK · EPILOGUE</small><b>The End</b><em>You saved every word, twice. Thank you for playing Schmoll Crossword.</em>` });
        scene.appendChild(end);
        requestAnimationFrame(() => end.classList.add("in"));
        el.querySelector(".lx-caption").classList.remove("in");
        sfx(() => chime([67, 72, 76, 79, 84, 88, 91], 0.15, "sine", 0.07));
        for (let k = 0; k < 5; k++) setTimeout(() => FX.burst({ x: innerWidth * (0.15 + Math.random() * 0.7), y: innerHeight * (0.15 + Math.random() * 0.35), n: 50, colors: ["#ffe7a3", "#c49bff", "#ffffff", "#ffd06b"], shape: "star", speed: [150, 450], gravity: 160, life: [0.8, 1.5], size: [2, 5] }), still() ? 0 : 500 + k * 480);
        await c.wait(5200);
        el.classList.add("out");
        await c.wait(500);
    }

    // =============================================================================================
    // The book itself: the pages you've won (click one to read it)
    // =============================================================================================
    function openBook(pages, { onReplay } = {}) {
        const modal = U.el("div", { class: "lx-modal", role: "dialog", "aria-modal": "true", "aria-label": "The Everbook" });
        modal.innerHTML = `<div class="lx-modal-inner">${bookHtml(pages)}<div class="lx-modal-btns">${onReplay ? `<button type="button" class="btn lx-replay">&#9654; Watch the story again</button>` : ""}<button type="button" class="btn primary lx-close">Close the book</button></div></div>`;
        const close = () => { modal.classList.add("out"); setTimeout(() => modal.remove(), 250); removeEventListener("keydown", onKey); };
        const onKey = e => { if (e.key === "Escape") close(); };
        addEventListener("keydown", onKey);
        modal.addEventListener("click", e => { if (e.target === modal) close(); });
        modal.querySelector(".lx-close").addEventListener("click", close);
        if (onReplay) modal.querySelector(".lx-replay").addEventListener("click", () => { close(); setTimeout(onReplay, 280); });
        const right = modal.querySelector(".lx-right-inner");
        const show = i => { right.innerHTML = leafHtml(pages[i], i, pages.length); modal.querySelectorAll(".lx-slot").forEach(s => s.classList.toggle("sel", +s.dataset.i === i)); Sound.play("flip"); };
        modal.querySelectorAll(".lx-slot.won").forEach(s => s.addEventListener("click", () => show(+s.dataset.i)));
        const first = pages.findIndex(p => p.won);
        if (first >= 0) show(pages.length - 1 - [...pages].reverse().findIndex(p => p.won));
        else right.innerHTML = `<p class="lx-empty">No pages yet. Beat a world's boss to win back its page.</p>`;
        document.body.appendChild(modal);
        requestAnimationFrame(() => modal.classList.add("in"));
        modal.querySelector(".lx-close").focus();
    }

    return { intro, page, finale, epilogue, openBook };
})();
