// Rive and Motion, the two animation libraries (self-hosted in vendor/, MIT): loaded the first time something needs
// them, never with the page.
//   Anim.motion()                 the Motion library (motion.dev): animate(), stagger(), spring for page elements
//   Anim.rive()                   the Rive runtime (vendor/rive/rive.js + rive.wasm)
//   Anim.warm()                   start loading both now (while Home is idle), so the first win doesn't wait
//   Anim.play(name, opts)         plays rive/<name>.riv over the page and resolves when it's done:
//       rect: { x, y, w, h }      where (page coordinates; default the whole window)
//       artboard, machine         which artboard and state machine (default "Main" and "Main")
//       ms                        how long it plays before it fades out (default 3000)
//       follow: el                keep it over this element while it moves (the board)
//       inputs: { name: value }   state machine inputs to set once it's loaded
//     returns { done, fire(name), set(name, value), stop() }; done resolves to false if it couldn't play
// The .riv files are made in code by tools/rive (art scripts -> build.mjs), in the same style as the canvas scenes.
const Anim = (() => {
    let riveP = null, motionP = null;
    const script = src => new Promise((ok, fail) => {
        const s = document.createElement("script");
        s.src = src; s.async = true;
        s.onload = ok; s.onerror = () => fail(new Error("couldn't load " + src));
        document.head.appendChild(s);
    });
    function rive() {
        if (!riveP) riveP = script("vendor/rive/rive.js").then(() => {
            const r = window.rive;
            r.RuntimeLoader.setWasmUrl("vendor/rive/rive.wasm");
            r.Rive.suppressDeprecationWarnings = ["default-state-machine", "state-machine-inputs", "state-machines-param"];
            return r;
        }).catch(err => { riveP = null; throw err; });
        return riveP;
    }
    function motion() {
        if (!motionP) motionP = script("vendor/motion/motion.js").then(() => window.Motion).catch(err => { motionP = null; throw err; });
        return motionP;
    }
    const files = new Map();             // name -> the .riv's bytes (fetched once)
    const bytes = name => {
        if (!files.has(name)) files.set(name, fetch(`rive/${name}.riv`).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).catch(err => { files.delete(name); throw err; }));
        return files.get(name);
    };
    function warm(names = []) {
        rive().then(r => r.RuntimeLoader.awaitInstance && r.RuntimeLoader.awaitInstance()).catch(() => null);
        motion().catch(() => null);
        for (const n of names) bytes(n).catch(() => null);
    }

    function play(name, { rect = null, artboard = "Main", machine = "Main", ms = 3000, follow = null, inputs = {}, z = 950, fadeMs = 400, flip = false } = {}) {
        const none = { done: Promise.resolve(false), fire() {}, set() {}, stop() {} };
        if (U.motion() === "still") return none;
        const cv = document.createElement("canvas");
        cv.className = "anim-riv";
        cv.setAttribute("aria-hidden", "true");
        Object.assign(cv.style, { position: "fixed", pointerEvents: "none", zIndex: String(z), opacity: "0", transition: `opacity ${fadeMs}ms ease`, transform: flip ? "scaleX(-1)" : "" });
        const place = () => {
            const r = follow ? follow.getBoundingClientRect() : null;
            const box = rect ? (typeof rect === "function" ? rect(r) : rect) : r ? { x: r.left, y: r.top, w: r.width, h: r.height } : { x: 0, y: 0, w: innerWidth, h: innerHeight };
            Object.assign(cv.style, { left: box.x + "px", top: box.y + "px", width: box.w + "px", height: box.h + "px" });
            const d = Math.min(1.5, devicePixelRatio || 1), w = Math.round(box.w * d), h = Math.round(box.h * d);
            if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; if (inst) inst.resizeDrawingSurfaceToCanvas(d); }
        };
        let inst = null, stopped = false, raf = 0, finish;
        const done = new Promise(res => { finish = res; });
        const stop = (ok = true) => {
            if (stopped) return;
            stopped = true;
            cancelAnimationFrame(raf);
            cv.style.opacity = "0";
            setTimeout(() => { try { inst && inst.cleanup(); } catch (err) { /* already gone */ } cv.remove(); finish(ok); }, fadeMs);
        };
        place();
        document.body.appendChild(cv);
        if (follow) { const track = () => { if (stopped) return; place(); raf = requestAnimationFrame(track); }; raf = requestAnimationFrame(track); }
        Promise.all([rive(), bytes(name)]).then(([R, buf]) => {
            if (stopped) return;
            inst = new R.Rive({
                buffer: buf.slice(0), canvas: cv, artboard, stateMachines: machine, autoplay: true,
                layout: new R.Layout({ fit: R.Fit.Contain, alignment: R.Alignment.Center }),
                onLoad: () => {
                    if (stopped) return;
                    inst.resizeDrawingSurfaceToCanvas(Math.min(1.5, devicePixelRatio || 1));
                    for (const [k, v] of Object.entries(inputs)) handle.set(k, v);
                    cv.style.opacity = "1";
                    setTimeout(() => stop(true), ms);
                },
                onLoadError: () => stop(false)
            });
        }).catch(err => { console.warn("rive", name, err && err.message); stop(false); });
        const input = n => { try { return (inst && inst.stateMachineInputs(machine) || []).find(i => i.name === n); } catch (err) { return null; } };
        const handle = {
            done,
            fire(n) { const i = input(n); if (i && i.fire) i.fire(); },
            set(n, v) { const i = input(n); if (i) i.value = v; },
            stop: () => stop(true)
        };
        return handle;
    }
    return { rive, motion, warm, play };
})();
