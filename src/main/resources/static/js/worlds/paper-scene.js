// The Notebook's page (paper.js uses it, with its doodles). Day: a real notebook page under a desk lamp: paper
// with fibres and a little tooth, faintly wavy ruled lines, the red margin, a spiral binding down the left with
// steel coils, ghost marks of things rubbed out, and things left lying on it in the corners, each with its own soft
// shadow: a yellow pencil, an eraser and its crumbs, a mug of coffee seen from above (steam curling off it), a
// sticky note lifting at one corner, a paper clip. Night: a blueprint on a drafting table: cyanotype paper,
// mottled, with a fine and a coarse grid, dimension lines, a title block, tape at the corners, a compass and a
// ruler lying on it, under the cool cone of a desk lamp.
//   PaperScene.page(W, H, opts) -> { draw(g, t, dt), resize(w, h) }: the page and its things (doodles are drawn
//   over it by paper.js)
const PaperScene = (() => {
    const TAU = Math.PI * 2;
    function paint(w, h, fn) { const c = Worlds.canvas(w, h), g = c.getContext("2d"); fn(g); return c; }
    // a soft shadow under a shape: drawn as a blurred dark copy, offset down and right (the lamp is up and left)
    function shadow(g, fn, blur = 10, off = 6, a = 0.28) {
        g.save(); g.filter = `blur(${blur}px)`; g.globalAlpha = a; g.translate(off * 0.7, off); g.fillStyle = "#2a2018"; fn(g, true); g.restore();
    }

    function page(W, H, opts) {
        const dark = opts.theme === "dark", preview = !!opts.preview;
        let base = null, things = null, steam = [], k = 1;
        function setup() {
            k = preview ? 0.5 : U.clamp(Math.min(W, H) / 900, 0.6, 1.15);
            const R = U.rng(1999);
            base = paint(W, H, g => {
                if (dark) {
                    // cyanotype blue, mottled where the chemistry pooled
                    g.fillStyle = "#123a6e"; g.fillRect(0, 0, W, H);
                    for (let i = 0; i < 60; i++) {
                        const x = R() * W, y = R() * H, r = 60 + R() * 260, light = R() < 0.5;
                        const mg = g.createRadialGradient(x, y, 0, x, y, r);
                        mg.addColorStop(0, light ? "rgba(70,130,200,.14)" : "rgba(5,25,60,.18)"); mg.addColorStop(1, "rgba(0,0,0,0)");
                        g.fillStyle = mg; g.fillRect(x - r, y - r, r * 2, r * 2);
                    }
                    g.lineWidth = 1; g.strokeStyle = "rgba(220,235,255,.07)";
                    g.beginPath(); for (let x = 0; x < W; x += 24) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); } for (let y = 0; y < H; y += 24) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); } g.stroke();
                    g.strokeStyle = "rgba(220,235,255,.15)";
                    g.beginPath(); for (let x = 0; x < W; x += 120) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); } for (let y = 0; y < H; y += 120) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); } g.stroke();
                    // a border frame, dimension lines, and the title block in the corner
                    g.strokeStyle = "rgba(230,240,255,.5)"; g.lineWidth = 2; g.strokeRect(14.5, 14.5, W - 29, H - 29);
                    g.lineWidth = 1; g.strokeRect(20.5, 20.5, W - 41, H - 41);
                    g.strokeStyle = "rgba(230,240,255,.35)"; g.fillStyle = "rgba(230,240,255,.55)"; g.font = "11px 'Share Tech Mono', monospace";
                    const dim = (x1, y1, x2, y2, label) => {
                        g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
                        const a = Math.atan2(y2 - y1, x2 - x1);
                        for (const [x, y, d] of [[x1, y1, 1], [x2, y2, -1]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a + 0.35) * 9 * d, y + Math.sin(a + 0.35) * 9 * d); g.moveTo(x, y); g.lineTo(x + Math.cos(a - 0.35) * 9 * d, y + Math.sin(a - 0.35) * 9 * d); g.stroke(); }
                        g.save(); g.translate((x1 + x2) / 2, (y1 + y2) / 2); g.rotate(a); g.fillText(label, -g.measureText(label).width / 2, -5); g.restore();
                    };
                    if (!preview) { dim(40, H - 44, W * 0.3, H - 44, "1200 mm"); dim(42, H * 0.25, 42, H * 0.65, "640"); dim(W - 42, 60, W - 42, H * 0.35, "R 18"); }
                    const tw = Math.min(260, W * 0.3), th = 62, tx = W - 21 - tw, ty = H - 21 - th;
                    g.strokeStyle = "rgba(230,240,255,.55)"; g.strokeRect(tx + 0.5, ty + 0.5, tw, th); g.beginPath(); g.moveTo(tx, ty + 24.5); g.lineTo(tx + tw, ty + 24.5); g.moveTo(tx + tw * 0.62 + 0.5, ty + 24); g.lineTo(tx + tw * 0.62 + 0.5, ty + th); g.stroke();
                    if (!preview) { g.fillText("SCHMOLL CROSSWORD", tx + 8, ty + 16); g.fillText("GRID / DAILY", tx + 8, ty + 44); g.fillText("SHEET 1/1", tx + tw * 0.62 + 8, ty + 44); }
                    // tape at the corners
                    for (const [x, y, r] of [[30, 30, -0.7], [W - 30, 30, 0.7], [30, H - 30, 0.7]]) {
                        g.save(); g.translate(x, y); g.rotate(r); g.fillStyle = "rgba(240,236,210,.28)"; g.fillRect(-34, -11, 68, 22); g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(-34, -11, 68, 5); g.restore();
                    }
                    return;
                }
                // paper: warm off-white, with fibres and tooth
                const pg = g.createLinearGradient(0, 0, W, H);
                pg.addColorStop(0, "#fdfaf1"); pg.addColorStop(1, "#f6efdf");
                g.fillStyle = pg; g.fillRect(0, 0, W, H);
                g.strokeStyle = "rgba(150,130,100,.08)"; g.lineWidth = 0.6;
                for (let i = 0; i < (preview ? 150 : 900); i++) { const x = R() * W, y = R() * H, a = R() * TAU, l = 3 + R() * 9; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 1) * l * 0.5, y + Math.sin(a + 1) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
                // ruled lines, each a little wavy and a little faded in places
                g.lineWidth = 1;
                for (let y = 96; y < H; y += 34) {
                    g.strokeStyle = `rgba(80,140,210,${(0.2 + R() * 0.08).toFixed(3)})`;
                    g.beginPath(); for (let x = 0; x <= W; x += 40) g[x ? "lineTo" : "moveTo"](x, y + 0.5 + Math.sin(x * 0.004 + y) * 0.5); g.stroke();
                }
                const mx = preview ? W * 0.14 : Math.max(70, W * 0.065);
                g.strokeStyle = "rgba(226,72,60,.5)"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(mx, 0); g.lineTo(mx, H); g.stroke();
                g.strokeStyle = "rgba(226,72,60,.22)"; g.beginPath(); g.moveTo(mx + 3, 0); g.lineTo(mx + 3, H); g.stroke();
                // ghosts of things rubbed out
                for (let i = 0; i < (preview ? 2 : 6); i++) {
                    const x = mx + 40 + R() * (W - mx - 80), y = 120 + R() * (H - 200), w = 40 + R() * 110;
                    const eg = g.createRadialGradient(x, y, 0, x, y, w);
                    eg.addColorStop(0, "rgba(140,140,150,.07)"); eg.addColorStop(1, "rgba(140,140,150,0)");
                    g.fillStyle = eg; g.fillRect(x - w, y - w, w * 2, w * 2);
                    g.strokeStyle = "rgba(90,90,100,.06)"; g.lineWidth = 1.4;
                    g.beginPath(); for (let j = 0; j < 4; j++) { g.moveTo(x - w * 0.5, y - 8 + j * 5 + R() * 3); g.lineTo(x + w * 0.4, y - 10 + j * 5 + R() * 3); } g.stroke();
                }
                // the spiral binding: punched holes, and steel coils looping through them
                if (W > 640 || preview) {
                    const hx = mx * 0.36, step = preview ? 22 : 30;
                    for (let y = 30; y < H - 10; y += step) {
                        g.fillStyle = "rgba(60,50,40,.18)"; g.beginPath(); g.ellipse(hx + 1, y + 2, 5 * k + 1, 6 * k + 1, 0, 0, TAU); g.fill();
                        g.fillStyle = "#3a3530"; g.beginPath(); g.ellipse(hx, y, 5 * k, 6 * k, 0, 0, TAU); g.fill();
                        const cg = g.createLinearGradient(0, y - 8, 0, y + 8);
                        cg.addColorStop(0, "#f2f4f6"); cg.addColorStop(0.45, "#a7adb6"); cg.addColorStop(0.55, "#6d737c"); cg.addColorStop(1, "#c9ced4");
                        g.strokeStyle = "rgba(40,30,20,.25)"; g.lineWidth = 5 * k + 2;
                        g.beginPath(); g.moveTo(-4, y - 6 * k + 3); g.quadraticCurveTo(hx * 0.5, y - 12 * k + 3, hx + 1, y + 2); g.stroke();
                        g.strokeStyle = cg; g.lineWidth = 4 * k;
                        g.beginPath(); g.moveTo(-4, y - 6 * k); g.quadraticCurveTo(hx * 0.5, y - 12 * k, hx, y); g.stroke();
                    }
                }
                // the lamp: warm light pooling from the upper left, the far corner in shade
                const lg = g.createRadialGradient(W * 0.25, -H * 0.1, 0, W * 0.25, -H * 0.1, Math.hypot(W, H) * 0.95);
                lg.addColorStop(0, "rgba(255,236,190,.22)"); lg.addColorStop(0.6, "rgba(255,236,190,0)"); lg.addColorStop(1, "rgba(90,60,30,.12)");
                g.fillStyle = lg; g.fillRect(0, 0, W, H);
            });
            // the things on the page, each painted once with its shadow (the mug's steam moves, drawn live)
            things = paint(W, H, g => {
                const s = k;
                if (dark) {
                    // a drafting compass, legs open, and a steel ruler, in pale line
                    if (!preview) {
                        g.save(); g.translate(W * 0.9, H * 0.72); g.rotate(-0.5);
                        g.strokeStyle = "rgba(230,240,255,.7)"; g.lineWidth = 2.5 * s; g.lineCap = "round";
                        g.beginPath(); g.moveTo(0, 0); g.lineTo(-38 * s, 120 * s); g.moveTo(0, 0); g.lineTo(38 * s, 120 * s); g.stroke();
                        g.fillStyle = "rgba(230,240,255,.7)"; g.beginPath(); g.arc(0, 0, 7 * s, 0, TAU); g.fill(); g.fillRect(-3 * s, -24 * s, 6 * s, 20 * s);
                        g.restore();
                        g.save(); g.translate(W * 0.06, H * 0.82); g.rotate(-0.08);
                        g.strokeStyle = "rgba(230,240,255,.55)"; g.lineWidth = 1.5; g.strokeRect(0, 0, Math.min(420, W * 0.4) * s, 34 * s);
                        for (let i = 0; i < Math.min(420, W * 0.4) * s; i += 8 * s) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, (i / (8 * s)) % 5 ? 8 * s : 15 * s); g.stroke(); }
                        g.restore();
                    }
                    return;
                }
                // a pencil lying across the lower right corner
                const pencil = (x, y, rot, len) => {
                    shadow(g, (gg) => { gg.save(); gg.translate(x, y); gg.rotate(rot); gg.fillRect(-len / 2, -7 * s, len, 14 * s); gg.restore(); }, 6, 7 * s, 0.32);
                    g.save(); g.translate(x, y); g.rotate(rot);
                    const body = g.createLinearGradient(0, -7 * s, 0, 7 * s);
                    body.addColorStop(0, "#ffe27a"); body.addColorStop(0.35, "#f5c32a"); body.addColorStop(0.65, "#e0a815"); body.addColorStop(1, "#b98510");
                    g.fillStyle = body; g.fillRect(-len / 2 + 30 * s, -7 * s, len - 52 * s, 14 * s);
                    g.strokeStyle = "rgba(150,100,10,.5)"; g.lineWidth = 1; g.beginPath(); g.moveTo(-len / 2 + 30 * s, -2 * s); g.lineTo(len / 2 - 22 * s, -2 * s); g.moveTo(-len / 2 + 30 * s, 2.5 * s); g.lineTo(len / 2 - 22 * s, 2.5 * s); g.stroke();
                    const ferrule = g.createLinearGradient(0, -7 * s, 0, 7 * s);
                    ferrule.addColorStop(0, "#f4f6f8"); ferrule.addColorStop(0.5, "#9aa1aa"); ferrule.addColorStop(1, "#d6dadf");
                    g.fillStyle = ferrule; g.fillRect(len / 2 - 22 * s, -7.5 * s, 12 * s, 15 * s);
                    g.fillStyle = "#ef8fa4"; g.beginPath(); g.roundRect(len / 2 - 11 * s, -7 * s, 11 * s, 14 * s, 3 * s); g.fill();
                    g.fillStyle = "#e8c99a"; g.beginPath(); g.moveTo(-len / 2 + 30 * s, -7 * s); g.lineTo(-len / 2 + 8 * s, -1.5 * s); g.lineTo(-len / 2 + 8 * s, 1.5 * s); g.lineTo(-len / 2 + 30 * s, 7 * s); g.fill();
                    g.fillStyle = "#3a3533"; g.beginPath(); g.moveTo(-len / 2 + 12 * s, -2.4 * s); g.lineTo(-len / 2, 0); g.lineTo(-len / 2 + 12 * s, 2.4 * s); g.fill();
                    g.restore();
                };
                // the mug, from above: a ring of shadow, the glazed rim, coffee with a highlight, the handle
                const mug = (x, y, r) => {
                    shadow(g, gg => { gg.beginPath(); gg.arc(x, y, r * 1.08, 0, TAU); gg.fill(); gg.beginPath(); gg.ellipse(x + r * 1.15, y, r * 0.35, r * 0.22, 0, 0, TAU); gg.fill(); }, 14, 12 * s, 0.35);
                    g.fillStyle = "#c8503c"; g.beginPath(); g.ellipse(x + r * 1.12, y, r * 0.36, r * 0.24, 0, 0, TAU); g.fill();
                    g.fillStyle = "#f6efe2"; g.beginPath(); g.ellipse(x + r * 1.12, y, r * 0.2, r * 0.1, 0, 0, TAU); g.fill();
                    const rim = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.2, x, y, r);
                    rim.addColorStop(0, "#e4705a"); rim.addColorStop(1, "#a83c2c");
                    g.fillStyle = rim; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
                    const cf = g.createRadialGradient(x + r * 0.2, y + r * 0.2, r * 0.1, x, y, r * 0.82);
                    cf.addColorStop(0, "#6b3d20"); cf.addColorStop(1, "#2e1608");
                    g.fillStyle = cf; g.beginPath(); g.arc(x, y, r * 0.82, 0, TAU); g.fill();
                    g.strokeStyle = "rgba(210,160,110,.45)"; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r * 0.78, 0, TAU); g.stroke();
                    g.fillStyle = "rgba(255,255,255,.35)"; g.beginPath(); g.ellipse(x - r * 0.35, y - r * 0.35, r * 0.18, r * 0.08, -0.7, 0, TAU); g.fill();
                    g.strokeStyle = "rgba(150,95,45,.14)"; g.lineWidth = 4; g.beginPath(); g.arc(x + r * 0.5, y - r * 1.4, r * 0.95, 0.3, TAU - 0.5); g.stroke();
                };
                // a sticky note, lifting at its lower right corner
                const note = (x, y, w, rot) => {
                    shadow(g, gg => { gg.save(); gg.translate(x, y); gg.rotate(rot); gg.fillRect(0, 0, w, w); gg.restore(); }, 8, 6 * s, 0.25);
                    g.save(); g.translate(x, y); g.rotate(rot);
                    const ng = g.createLinearGradient(0, 0, w, w);
                    ng.addColorStop(0, "#fff59a"); ng.addColorStop(1, "#f6e05e");
                    g.fillStyle = ng; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, 0); g.lineTo(w, w * 0.78); g.quadraticCurveTo(w * 0.92, w * 0.9, w * 0.78, w); g.lineTo(0, w); g.closePath(); g.fill();
                    g.fillStyle = "#e3c94a"; g.beginPath(); g.moveTo(w, w * 0.78); g.quadraticCurveTo(w * 0.86, w * 0.84, w * 0.78, w); g.quadraticCurveTo(w * 0.83, w * 0.86, w, w * 0.78); g.fill();
                    g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(0, 0, w, w * 0.12);
                    g.strokeStyle = "rgba(60,60,90,.6)"; g.lineWidth = 1.6; g.lineCap = "round";
                    g.beginPath(); for (let i = 0; i < 3; i++) { const yy = w * (0.32 + i * 0.18); g.moveTo(w * 0.14, yy); for (let xx = w * 0.14; xx < w * (0.72 - i * 0.12); xx += 5) g.lineTo(xx, yy + Math.sin(xx * 0.6) * 1.6); } g.stroke();
                    g.restore();
                };
                const clip = (x, y, rot) => {
                    g.save(); g.translate(x, y); g.rotate(rot);
                    g.strokeStyle = "rgba(40,30,20,.2)"; g.lineWidth = 3.5 * s; g.beginPath(); g.roundRect(2, 3, 18 * s, 50 * s, 9 * s); g.stroke();
                    const cg = g.createLinearGradient(0, 0, 20 * s, 0); cg.addColorStop(0, "#d9dde2"); cg.addColorStop(0.5, "#8d949c"); cg.addColorStop(1, "#e6e9ec");
                    g.strokeStyle = cg; g.lineWidth = 2.6 * s; g.beginPath(); g.roundRect(0, 0, 18 * s, 50 * s, 9 * s); g.stroke(); g.beginPath(); g.roundRect(4 * s, 8 * s, 10 * s, 36 * s, 5 * s); g.stroke();
                    g.restore();
                };
                const eraser = (x, y, rot) => {
                    shadow(g, gg => { gg.save(); gg.translate(x, y); gg.rotate(rot); gg.fillRect(0, 0, 54 * s, 24 * s); gg.restore(); }, 6, 6 * s, 0.3);
                    g.save(); g.translate(x, y); g.rotate(rot);
                    g.fillStyle = "#f4a6b4"; g.beginPath(); g.roundRect(0, 0, 54 * s, 24 * s, 5 * s); g.fill();
                    g.fillStyle = "#3f73c8"; g.fillRect(20 * s, 0, 22 * s, 24 * s);
                    g.fillStyle = "rgba(255,255,255,.3)"; g.fillRect(0, 0, 54 * s, 5 * s);
                    g.restore();
                    g.fillStyle = "rgba(230,150,165,.7)";
                    for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(x - 18 * s + R2() * 40 * s, y + 34 * s + R2() * 18 * s, 2.4 * s, 1.2 * s, R2() * 3, 0, TAU); g.fill(); }
                };
                const R2 = U.rng(77);
                if (preview) { pencil(W * 0.75, H * 0.85, -0.35, 150); return; }
                pencil(W - 130 * s, H - 70 * s, -0.42, 300 * s);
                eraser(W - 330 * s, H - 64 * s, 0.25);
                mug(110 * s + Math.max(0, W * 0.02), H - 100 * s, 62 * s);
                note(W - 150 * s, 92 * s, 118 * s, 0.08);
                clip(W - 64 * s, 70 * s, 0.5);
                steamAt = { x: 110 * s + Math.max(0, W * 0.02), y: H - 100 * s, r: 62 * s };
            });
            steam = Array.from({ length: preview || dark ? 0 : 5 }, (_, i) => ({ ph: i / 5, sway: R() * TAU }));
        }
        let steamAt = null;
        setup();
        return {
            resize(w, h) { W = w; H = h; setup(); },
            draw(g, t, dt) {
                g.drawImage(base, 0, 0);
                if (dark) {                                      // the lamp's cool cone, breathing a little
                    const lg = g.createRadialGradient(W * 0.72, -H * 0.15, 0, W * 0.72, -H * 0.15, Math.hypot(W, H) * 0.8);
                    lg.addColorStop(0, `rgba(200,225,255,${(0.16 + 0.02 * Math.sin(t * 0.7)).toFixed(3)})`); lg.addColorStop(0.55, "rgba(200,225,255,0)");
                    g.fillStyle = lg; g.fillRect(0, 0, W, H);
                }
                g.drawImage(things, 0, 0);
                if (steamAt) {                                   // steam off the coffee, curling and thinning as it rises
                    for (const st of steam) {
                        const p = (t * 0.18 + st.ph) % 1;
                        g.strokeStyle = `rgba(255,255,255,${(0.32 * Math.sin(p * Math.PI)).toFixed(3)})`; g.lineWidth = 6 + p * 10; g.lineCap = "round";
                        const x0 = steamAt.x + Math.sin(st.sway) * steamAt.r * 0.3, y0 = steamAt.y - p * steamAt.r * 2.4;
                        g.beginPath(); g.moveTo(x0, y0 + 14); g.bezierCurveTo(x0 + Math.sin(t + st.sway) * 18, y0, x0 - Math.sin(t * 1.3 + st.sway) * 18, y0 - 20, x0 + Math.sin(t * 0.8 + st.sway) * 10, y0 - 34); g.stroke();
                    }
                }
            }
        };
    }
    return { page };
})();
