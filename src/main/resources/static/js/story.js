// The campaign's story (the user, 2026-10-09: "the story is about getting a bunch of pages back for a book"):
// the Lexicon, the book that holds every word in every world, was torn apart by the Void; its 15 pages fell into
// the 15 worlds and their bosses took them. Three cinematics and a book you can open:
//   Story.intro(c, pages)            the opening: the Lexicon, the Void tearing it apart, the pages scattering
//   Story.page(c, pages, world)      after a boss's first defeat: its page flies into the book
//   Story.finale(c, pages)           the last page: the book is whole, the words pour back into the worlds
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
                <div class="lx-gem"></div><b class="lx-title">THE LEXICON</b><small class="lx-sub">every word in every world</small></div></div>
            <div class="lx-spread">
                <div class="lx-page lx-left">${showSlots ? `<h3 class="lx-h">The Pages</h3><div class="lx-slots">${slots}</div><p class="lx-count"><b>${pages.filter(p => p.won).length}</b> of ${pages.length} pages</p>` : linesHtml(14)}</div>
                <div class="lx-page lx-right"><div class="lx-right-inner">${linesHtml(16)}</div></div>
            </div>
        </div>`;
    }
    const linesHtml = n => `<div class="lx-lines">${Array.from({ length: n }, (_, i) => `<i style="width:${(62 + ((i * 37) % 33))}%"></i>`).join("")}</div>`;
    // one page of the Lexicon: the world's name in its own lettering, an illustration of its boss, lines of text
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
    function storyMusic(c) {
        Sound.music("story", { v: 0.36, fade: 0.8 });
        c.cleanup(() => { if (Sound.musicPlaying === "story") Sound.stopMusic(1.4); });
    }
    async function intro(c, pages) {
        const el = stage("lx-intro"), scene = el.querySelector(".lx-scene"), stop = ambience(el, { letters: true });
        storyMusic(c);
        c.cleanup(() => { stop(); el.remove(); });
        // 1. the Lexicon
        scene.innerHTML = `<div class="lx-hero">${bookHtml(pages, { open: false })}</div>`;
        const book = scene.querySelector(".lx-book");
        say(el, "Long ago, every word in every world was kept in one book: the Lexicon.");
        chime([60, 64, 67, 72], 0.18, "sine", 0.06);
        await c.wait(3200);
        // 2. it opens and the words rise out of it
        book.classList.add("open");
        say(el, "As long as it was whole, every word meant something, and every world could speak.");
        const rise = U.el("div", { class: "lx-words" });
        scene.appendChild(rise);
        "PAGEWORDLEXICONSTORYCLUE".split("").forEach((ch, i) => { const s = U.el("span", { text: ch, style: { left: (20 + Math.random() * 60) + "%", animationDelay: (i * 90) + "ms" } }); rise.appendChild(s); });
        chime([67, 71, 74, 79], 0.14, "triangle", 0.05);
        await c.wait(3200);
        if (c.skipped) return;
        // 3. the Void tears it apart
        const voidEl = U.el("div", { class: "lx-void", html: `<div class="lx-vortex"></div><div class="lx-void-boss">${Bosses.svg("space")}</div>` });
        scene.appendChild(voidEl);
        requestAnimationFrame(() => voidEl.classList.add("in"));
        say(el, "Then the Void came, and tore the Lexicon apart.");
        Sound.tone({ f: 70, f2: 35, d: 1.6, v: 0.25 });
        await c.wait(1500);
        FX.shake(14, 700);
        FX.flash("#e8dcff", 300, 0.5);
        book.classList.add("torn");
        rise.remove();
        const burst = U.el("div", { class: "lx-scatter" });
        scene.appendChild(burst);
        const center = (() => { const r = book.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })();
        pages.forEach((p, i) => {
            const leaf = U.el("div", { class: "lx-mini-leaf", style: { "--c": p.color } });
            burst.appendChild(leaf);
            const a = (i / pages.length) * Math.PI * 2 + Math.random() * 0.3, d = Math.max(innerWidth, innerHeight) * 0.75;
            if (!still()) leaf.animate([{ transform: `translate(${center.x}px, ${center.y}px) rotate(0) scale(.6)`, opacity: 1 },
                { transform: `translate(${center.x + Math.cos(a) * d}px, ${center.y + Math.sin(a) * d}px) rotate(${720 * (Math.random() < 0.5 ? -1 : 1)}deg) scale(1.1)`, opacity: 0.9 }],
                { duration: 1700 + Math.random() * 500, delay: i * 40, easing: "cubic-bezier(.2,.6,.4,1)", fill: "forwards" });
        });
        Sound.tone({ f: 900, f2: 200, d: 0.8, v: 0.05, type: "sawtooth" });
        await c.wait(2300);
        if (c.skipped) return;
        // 4. fifteen pages, fifteen worlds, fifteen bosses
        voidEl.classList.add("out");
        scene.querySelector(".lx-hero").classList.add("out");
        burst.remove();
        const grid = U.el("div", { class: "lx-worlds", html: pages.map((p, i) => `<div class="lx-world" style="--c:${p.color};--i:${i}"><div class="lx-world-boss">${Bosses.svg(p.world)}</div><div class="lx-mini-leaf held"></div><small>${U.esc(p.name)}</small></div>`).join("") });
        scene.appendChild(grid);
        say(el, "Fifteen pages fell into fifteen worlds, and in every one, a boss took its page and won't give it back.");
        chime([57, 60, 64, 57, 60, 65], 0.1, "triangle", 0.04);
        await c.wait(4200);
        if (c.skipped) return;
        // 5. your quest
        grid.classList.add("out");
        const title = U.el("div", { class: "lx-titlecard", html: `<small>A SCHMOLL CROSSWORD STORY</small><b>The Lost Lexicon</b><em>Win back every page, solve your way through every world, and make the book whole again.</em>` });
        scene.appendChild(title);
        requestAnimationFrame(() => title.classList.add("in"));
        el.querySelector(".lx-caption").classList.remove("in");
        chime([60, 67, 72, 76, 79, 84], 0.12, "sine", 0.07);
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
        storyMusic(c);
        c.cleanup(() => { stop(); el.remove(); });
        const before = pages.map((q, j) => (j === i ? { ...q, won: false } : q));
        scene.innerHTML = `<div class="lx-boss-gone">${Bosses.svg(world)}</div><div class="lx-hero">${bookHtml(before)}</div>`;
        const right = scene.querySelector(".lx-right-inner"), slot = scene.querySelector(`.lx-slot[data-i="${i}"]`);
        say(el, `${p.boss} lets go of the ${p.name} page…`);
        await c.wait(1100);
        // the page itself, flying from the boss into the right-hand page
        right.innerHTML = leafHtml(p, i, pages.length);
        const leaf = right.querySelector(".lx-leaf"), bossBox = scene.querySelector(".lx-boss-gone").getBoundingClientRect(), dest = right.getBoundingClientRect();
        Sound.tone({ f: 300, f2: 900, d: 0.5, v: 0.05, type: "sine" });
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
        chime([72, 76, 79, 84], 0.1, "triangle", 0.07);
        say(el, won >= pages.length ? "The last page is back where it belongs." : `The ${p.name} page is back in the Lexicon. ${pages.length - won} still missing.`);
        await c.wait(3000);
        el.classList.add("out");
        await c.wait(450);
    }

    // =============================================================================================
    // The finale: every page is back
    // =============================================================================================
    async function finale(c, pages) {
        const el = stage("lx-finale"), scene = el.querySelector(".lx-scene"), stop = ambience(el, { letters: true, color: "#ffe9a8" });
        storyMusic(c);
        c.cleanup(() => { stop(); el.remove(); });
        scene.innerHTML = `<div class="lx-hero">${bookHtml(pages)}</div>`;
        const book = scene.querySelector(".lx-book");
        say(el, "Fifteen pages. Every one of them won back.");
        await c.wait(2200);
        book.classList.remove("open");
        book.classList.add("whole");
        say(el, "The Lexicon is whole again.");
        chime([60, 64, 67, 72, 76, 79], 0.15, "sine", 0.07);
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
        const end = U.el("div", { class: "lx-titlecard end", html: `<small>THE LOST LEXICON</small><b>The End</b><em>You won back every page. Thank you for playing Schmoll Crossword.</em>` });
        scene.appendChild(end);
        requestAnimationFrame(() => end.classList.add("in"));
        el.querySelector(".lx-caption").classList.remove("in");
        chime([67, 72, 76, 79, 84, 88], 0.16, "sine", 0.07);
        for (let k = 0; k < 4; k++) setTimeout(() => FX.burst({ x: innerWidth * (0.2 + Math.random() * 0.6), y: innerHeight * (0.2 + Math.random() * 0.3), n: 50, colors: ["#ffe066", "#ff5c6c", "#7ad7ff", "#fff"], shape: "star", speed: [150, 450], gravity: 200, life: [0.8, 1.4], size: [2, 5] }), still() ? 0 : 600 + k * 500);
        await c.wait(5000);
        el.classList.add("out");
        await c.wait(500);
    }

    // =============================================================================================
    // The book itself: the pages you've won (click one to read it)
    // =============================================================================================
    function openBook(pages, { onReplay } = {}) {
        const modal = U.el("div", { class: "lx-modal", role: "dialog", "aria-modal": "true", "aria-label": "The Lexicon" });
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

    return { intro, page, finale, openBook };
})();
