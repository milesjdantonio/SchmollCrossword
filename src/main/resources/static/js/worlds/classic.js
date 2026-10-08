// The CLASSIC world: a plain, quiet page. It's what a first-time player sees until they pick a world.
//   Light: a white page. Dark: a near-black page. No animated scene, no board decorations, no mascot, no intro.
//   Title card: a simple card that fades in and out. Win: a small burst of confetti.

(() => {
    // the background: a flat colour (the picker's preview also sketches a little grid so the card isn't blank)
    function scene(W, H, opts) {
        const night = opts.theme === "dark", preview = !!opts.preview;
        return {
            resize(w, h) { W = w; H = h; },
            draw(g) {
                g.fillStyle = night ? "#121214" : "#ffffff";
                g.fillRect(0, 0, W, H);
                if (!preview) return;
                const s = Math.min(W, H) * 0.13, x0 = W / 2 - s * 2.5, y0 = H / 2 - s * 2.5;
                g.strokeStyle = night ? "#5a5a64" : "#1a1a1a";
                g.lineWidth = 1;
                for (let i = 0; i <= 5; i++) {
                    g.beginPath(); g.moveTo(x0 + i * s, y0); g.lineTo(x0 + i * s, y0 + 5 * s); g.stroke();
                    g.beginPath(); g.moveTo(x0, y0 + i * s); g.lineTo(x0 + 5 * s, y0 + i * s); g.stroke();
                }
                g.fillStyle = night ? "#5a5a64" : "#1a1a1a";
                for (const [r, c] of [[0, 4], [4, 0]]) g.fillRect(x0 + c * s, y0 + r * s, s, s);
            }
        };
    }

    async function titleCard(c, info) {
        const card = U.el("div", { class: "tc tc-classic", "aria-hidden": "true", html: `
            <div class="tcx-card"><small>${U.esc(info.kicker)}</small><h2>${U.esc(info.title)}</h2><p>${U.esc(info.sub)}</p></div>` });
        document.getElementById("overlay").appendChild(card);
        c.cleanup(() => card.remove());
        await c.wait(1300);
        if (c.skipped) return;
        card.classList.add("out");
        await c.wait(300);
    }

    async function celebrate(c, { boardEl }) {
        if (U.motion() === "still") return;
        const b = boardEl.getBoundingClientRect();
        FX.burst({ x: b.left + b.width / 2, y: b.top + b.height * 0.3, n: 60, colors: ["#2a62c9", "#e8a320", "#3a9a52", "#d64545", "#7a5cc8"], shape: "rect", angle: -Math.PI / 2, spread: 1, speed: [250, 600], gravity: 600, drag: 0.6, life: [1.4, 2.2], size: [6, 9] });
        Sound.play("win");
        await c.wait(1600);
    }

    Worlds.register({
        id: "classic", name: "Classic", icon: "▦", tagline: "A plain, quiet page. No extras.",
        modes: ["light", "dark"],
        scene, titleCard, celebrate, sounds: {}, transition: "fade", plain: true
    });
})();
