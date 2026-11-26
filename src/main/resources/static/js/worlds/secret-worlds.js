// The four secret worlds found off the campaign's road (campaign.js SECRETS), each with its own scene in light and
// dark. Each brings its parent world's companion, sounds and title card along (the parent's companion goes with you),
// and has its own short win.
//   The Great Hollow (off Acorn Woods): inside a giant hollow oak, glowing fungi, hanging roots, a hoard of acorns
//   Atlantis (off the Coral Reef): a drowned city that still keeps its lights on, kelp, caustics, a sea king's statue
//   The Sunken Dunes (off the Desert): dunes swallowing ruins, sand streaming off the crests, something long beneath
//   The Lava Cave (off Volcano Island): a cavern of stalactites over a river of lava, lava falls, embers, obsidian
(() => {
    const TAU = Math.PI * 2;
    const lerp = (a, b, k) => a + (b - a) * k;
    const grad = (g, y0, y1, stops) => { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; };
    const radial = (g, x, y, r, stops) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; };
    const lite = () => U.motion() === "lite";

    // a short win for a secret world: a burst of the world's own shapes from the board, a ring, and a shimmer
    // The board: a mark in each typed square and a trim along each finished word (Worlds.decoBoard), plus a little
    // burst as you type and as a word finishes. line() and wavy() are paths along a word at an offset from its top or left.
    const line = (cells, across, off, pad = 0.06) => { const [r0, c0] = cells[0], n = cells.length; return across ? `M${c0 + pad} ${r0 + off}H${c0 + n - pad}` : `M${c0 + off} ${r0 + pad}V${r0 + n - pad}`; };
    const wavy = (cells, across, off, amp, waves) => {
        const [r0, c0] = cells[0], n = cells.length, steps = n * 8, pts = [];
        for (let i = 0; i <= steps; i++) { const u = 0.08 + i / steps * (n - 0.16), w = Math.sin(i / steps * waves * TAU) * amp; pts.push(across ? [c0 + u, r0 + off + w] : [c0 + off + w, r0 + u]); }
        return "M" + pts.map(([x, y]) => x.toFixed(3) + " " + y.toFixed(3)).join("L");
    };
    function deco(id, { marks, word, typeColors, typeShape = "circle", doneColors, doneShape = "star", rise = false }) {
        return Worlds.decoBoard({
            id,
            mark: r => marks[Math.floor(r(0) * marks.length)],
            word,
            type(cell) {
                const p = U.center(cell);
                FX.burst({ x: p.x, y: p.y + p.h * 0.25, n: 7, colors: typeColors, shape: typeShape, angle: -Math.PI / 2, spread: 1.4, speed: [40, 120], gravity: rise ? -80 : 300, drag: 1.5, life: [0.35, 0.6], size: [1.5, 3] });
            },
            wordDone(entry, cells) {
                cells.forEach(([r, c], i) => setTimeout(() => {
                    const cell = Game.cellEl(r, c);
                    if (!cell) return;
                    const p = U.center(cell);
                    FX.burst({ x: p.x, y: p.y, n: 5, colors: doneColors, shape: doneShape, speed: [40, 120], gravity: rise ? -60 : 100, life: [0.5, 0.8], size: [3, 5], spin: 4 });
                }, i * 60));
            }
        });
    }

    function winOf(colors, shape) {
        return async (c, { boardEl }) => {
            if (!boardEl) return;
            const r = boardEl.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
            FX.ring({ x, y, color: colors[0], r0: 20, r1: Math.max(r.width, r.height), dur: 0.9, width: 12 });
            FX.burst({ x, y, n: 70, colors, shape, speed: [200, 700], gravity: 260, drag: 1, life: [1.4, 2.4], size: [6, 12], spin: 4 });
            await c.wait(500);
            FX.burst({ x, y: r.top, n: 40, colors, shape: "star", speed: [120, 420], gravity: 120, life: [1, 1.8], size: [5, 9] });
            await c.wait(1200);
        };
    }
    function register(o) {
        const P = Worlds.byId[o.parent] || {};
        Worlds.register({
            modes: ["dark", "light"], secret: true, board: {},
            titleCard: P.titleCard, sounds: P.sounds, transition: P.transition, mascot: P.mascot, lines: P.lines, introFlourish: P.introFlourish,
            ...o
        });
    }

    // ------------------------------------------------------------------------------------------------------------
    // The Great Hollow
    // ------------------------------------------------------------------------------------------------------------
    // The board: an acorn, a toadstool or an oak leaf in each typed square; a root runs along every finished word
    const hollowBoard = deco("hw", {
        marks: [
            `<ellipse cy=".012" rx=".026" ry=".032" class="hw-nut"/><path d="M-.034 -.006Q0 -.05 .034 -.006Z" class="hw-cap"/><path d="M0 -.03V-.045" class="hw-line"/>`,
            `<path d="M-.006 .04V.005H.006V.04Z" class="hw-stem"/><path d="M-.04 .008Q0 -.05 .04 .008Z" class="hw-shroom"/><circle cx="-.012" cy="-.01" r=".006" class="hw-spot"/><circle cx=".014" cy="-.004" r=".005" class="hw-spot"/>`,
            `<path d="M0 -.045Q.035 -.02 .02 .02Q0 .045 0 .045Q0 .045 -.02 .02Q-.035 -.02 0 -.045Z" class="hw-leaf"/><path d="M0 -.035V.05" class="hw-line"/>`
        ],
        word(entry, cells, rnd, g, across) {
            U.svg("path", { d: wavy(cells, across, 0.92, 0.012, cells.length * 0.7), class: "hw-root", pathLength: "1" }, g);
            const [r0, c0] = cells[0];
            for (let i = 0; i < cells.length; i++) {
                if (rnd(i) < 0.45) continue;
                const u = i + 0.5, x = across ? c0 + u : c0 + 0.92, y = across ? r0 + 0.92 : r0 + u;
                U.svg("path", { d: across ? `M${x} ${y}q.03 .03 .06 .02` : `M${x} ${y}q.03 .03 .02 .06`, class: "hw-root thin", pathLength: "1" }, g);
                U.svg("ellipse", { cx: (across ? x + 0.06 : x + 0.02).toFixed(3), cy: (across ? y + 0.02 : y + 0.06).toFixed(3), rx: ".018", ry: ".01", class: "hw-sprout" }, g);
            }
        },
        typeColors: ["#8a5a2b", "#c8681c", "#e3a35a"],
        doneColors: ["#ffd36b", "#7dffd4", "#e3a35a"]
    });
    register({
        id: "hollow", name: "The Great Hollow", icon: "🌰", tagline: "Inside the Oldest Oak.", parent: "squirrel",
        scene: SecretScenes.hollow, board: hollowBoard, celebrate: winOf(["#ffb347", "#b9773e", "#7dffd4", "#ffd36b"], "acorn")
    });

    // ------------------------------------------------------------------------------------------------------------
    // Atlantis
    // ------------------------------------------------------------------------------------------------------------
    // The board: a pearl, a coral sprig or a little trident in each typed square; a golden wave band along finished words
    const atlantisBoard = deco("at", {
        marks: [
            `<circle r=".026" class="at-pearl"/><circle cx="-.009" cy="-.009" r=".007" class="at-shine"/>`,
            `<path d="M0 .045V0M0 .01L-.025 -.02M-.025 -.02V-.04M0 0L.022 -.028M.022 -.028V-.045M-.012 -.01L-.03 .002" class="at-coral"/>`,
            `<path d="M0 .045V-.03M-.024 -.012V-.04M.024 -.012V-.04M-.024 -.012H.024M0 -.03L0 -.048" class="at-tri"/>`
        ],
        word(entry, cells, rnd, g, across) {
            U.svg("path", { d: wavy(cells, across, 0.915, 0.014, cells.length * 1.5), class: "at-band", pathLength: "1" }, g);
            U.svg("path", { d: line(cells, across, 0.955), class: "at-band thin", pathLength: "1" }, g);
            const [r0, c0] = cells[0];
            for (let i = 0; i < cells.length; i++) {
                const u = i + 0.5;
                U.svg("circle", { cx: (across ? c0 + u : c0 + 0.955).toFixed(3), cy: (across ? r0 + 0.955 : r0 + u).toFixed(3), r: ".014", class: "at-bead" }, g);
            }
        },
        typeColors: ["#bfe8ff", "#ffffff", "#7fd4ff"], rise: true,
        doneColors: ["#ffd98a", "#ffffff", "#5fd0e8"]
    });
    register({
        id: "atlantis", name: "Atlantis", icon: "🔱", tagline: "The City Below the Reef.", parent: "ocean",
        scene: SecretScenes.atlantis, board: atlantisBoard, celebrate: winOf(["#5fd0e8", "#ffd98a", "#ffffff", "#2a8fd6"], "bubble")
    });

    // ------------------------------------------------------------------------------------------------------------
    // The Sunken Dunes
    // ------------------------------------------------------------------------------------------------------------
    // The board: a worm's track, a buried ring or a scatter of grains in each typed square; sand ripples along finished words
    const dunesBoard = deco("dn", {
        marks: [
            `<path d="M-.045 .02Q-.03 -.02 -.012 .01T.022 0T.048 -.03" class="dn-track"/>`,
            `<circle r=".022" class="dn-ring"/><circle r=".008" class="dn-grain"/>`,
            `<circle cx="-.02" cy=".01" r=".007" class="dn-grain"/><circle cx=".012" cy="-.015" r=".006" class="dn-grain"/><circle cx=".022" cy=".018" r=".008" class="dn-grain"/><circle cx="-.004" cy="-.03" r=".005" class="dn-grain"/>`
        ],
        word(entry, cells, rnd, g, across) {
            U.svg("path", { d: wavy(cells, across, 0.895, 0.01, cells.length * 2), class: "dn-ripple", pathLength: "1" }, g);
            U.svg("path", { d: wavy(cells, across, 0.94, 0.01, cells.length * 2), class: "dn-ripple thin", pathLength: "1" }, g);
        },
        typeColors: ["#e0b872", "#c9974f", "#f2d39a"],
        doneColors: ["#f6d48f", "#ffffff", "#e0a95f"]
    });
    register({
        id: "dunes", name: "The Sunken Dunes", icon: "🪱", tagline: "Something Swims Beneath the Sand.", parent: "desert",
        scene: SecretScenes.dunes, board: dunesBoard, celebrate: winOf(["#f6d48f", "#e0a95f", "#ffffff", "#c47f3e"], "circle")
    });

    // ------------------------------------------------------------------------------------------------------------
    // The Lava Cave
    // ------------------------------------------------------------------------------------------------------------
    // The board: a crystal, an ember or a drop of magma in each typed square; a glowing lava vein along finished words
    const caveBoard = deco("lc", {
        marks: [
            `<path d="M0 -.045L.018 -.012L.012 .035H-.012L-.018 -.012Z" class="lc-crystal"/><path d="M0 -.045V.035" class="lc-facet"/>`,
            `<circle r=".02" class="lc-ember"/><circle r=".008" class="lc-core"/>`,
            `<path d="M0 -.04Q.026 -.002 .02 .018A.02 .02 0 0 1 -.02 .018Q-.026 -.002 0 -.04Z" class="lc-drop"/>`
        ],
        word(entry, cells, rnd, g, across) {
            const [r0, c0] = cells[0], n = cells.length, pts = [];
            for (let i = 0; i <= n * 3; i++) { const u = 0.08 + i / (n * 3) * (n - 0.16), j = (rnd(i) - 0.5) * 0.05; pts.push(across ? [c0 + u, r0 + 0.92 + j] : [c0 + 0.92 + j, r0 + u]); }
            const d = "M" + pts.map(([x, y]) => x.toFixed(3) + " " + y.toFixed(3)).join("L");
            U.svg("path", { d, class: "lc-vein-glow", pathLength: "1" }, g);
            U.svg("path", { d, class: "lc-vein", pathLength: "1" }, g);
        },
        typeColors: ["#ff6a1f", "#ffb02e", "#ffe08a"], typeShape: "spark", rise: true,
        doneColors: ["#ff5a1f", "#ffb02e", "#fff1a0"], doneShape: "spark"
    });

    register({
        id: "cave", name: "The Lava Cave", icon: "🌋", tagline: "Under the Volcano, Something Burns.", parent: "volcano",
        scene: SecretScenes.cave, board: caveBoard, celebrate: winOf(["#ff5a1f", "#ffb02e", "#fff1a0", "#3a2a5a"], "spark")
    });
})();
