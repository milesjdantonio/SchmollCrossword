// Sound (redesign): every sound and every bit of music is made in code with the Web Audio API.
// No sound files, so nothing to download and no licenses to check.
//
//   Sound.play("word")      plays the current world's version of a sound (or the shared one)
//   Sound.tone({...})       one note: frequency f (sliding to f2), wave type, start t, length d, volume v...
//   Sound.noise({...})      a burst of filtered noise (whooshes, scratches, crashes, crowds)
//   Sound.music             the world's ambient loop (Settings > Music), and short jingles
//
// Browsers only allow sound after the first click or key press, so the engine wakes up then.

const Sound = (() => {
    let ctx = null, master, fxBus, musBus, echoIn, noiseBuf = null, crushCurve = null;
    const gates = {};

    function init() {
        if (ctx) {
            if (ctx.state === "suspended" && !document.hidden) ctx.resume();
            return true;
        }
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return false;
        ctx = new AudioCtx();
        const comp = ctx.createDynamicsCompressor();     // keeps loud moments from clipping
        comp.threshold.value = -16;
        comp.ratio.value = 4;
        master = ctx.createGain();
        master.gain.value = Settings.get("volume");
        master.connect(comp).connect(ctx.destination);
        fxBus = ctx.createGain();
        fxBus.gain.value = Settings.get("sound") ? 0.8 : 0;
        fxBus.connect(master);
        musBus = ctx.createGain();
        musBus.gain.value = 0.55;
        musBus.connect(master);
        // an echo (a delay that feeds back into itself) for spacey, dreamy sounds
        echoIn = ctx.createGain();
        const delay = ctx.createDelay(1), feedback = ctx.createGain(), wet = ctx.createGain();
        delay.delayTime.value = 0.27;
        feedback.gain.value = 0.38;
        wet.gain.value = 0.55;
        echoIn.connect(delay);
        delay.connect(feedback).connect(delay);
        delay.connect(wet).connect(master);
        // 1.5 seconds of white noise, reused by every noise() call
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
        const data = noiseBuf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        // a gentle distortion curve, for crunchy arcade sounds
        crushCurve = new Float32Array(1024);
        for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; crushCurve[i] = Math.tanh(x * 5); }
        return true;
    }
    for (const type of ["pointerdown", "keydown", "touchstart"]) {
        addEventListener(type, () => { if (init()) Music.wake(); }, { capture: true, passive: true });
    }
    document.addEventListener("visibilitychange", () => {
        if (!ctx) return;
        if (document.hidden) ctx.suspend(); else ctx.resume();
    });
    Settings.on((key, value) => {
        if (!ctx) return;
        if (key === "volume") master.gain.setTargetAtTime(value, ctx.currentTime, 0.05);
        if (key === "sound") fxBus.gain.setTargetAtTime(value ? 0.8 : 0, ctx.currentTime, 0.05);
    });

    const ready = () => ctx && ctx.state === "running";
    const busFor = name => (name === "music" ? musBus : fxBus);

    // ---- building blocks ----
    function tone({ f = 440, f2, type = "sine", t = 0, d = 0.15, v = 0.2, a = 0.006, bus, filt, echo = 0, crush = false, detune = 0, vib = 0 }) {
        if (!ctx) return;
        const start = ctx.currentTime + t;
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(f, start);
        if (f2) osc.frequency.exponentialRampToValueAtTime(f2, start + d);
        if (detune) osc.detune.value = detune;
        if (vib) {                                         // vibrato: a slow wobble in pitch
            const lfo = ctx.createOscillator(), depth = ctx.createGain();
            lfo.frequency.value = 5.5;
            depth.gain.value = vib;
            lfo.connect(depth).connect(osc.frequency);
            lfo.start(start);
            lfo.stop(start + d + 0.05);
        }
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(v, start + a);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + d);
        let out = osc;
        if (crush) { const sh = ctx.createWaveShaper(); sh.curve = crushCurve; out.connect(sh); out = sh; }
        if (filt) {
            const fl = ctx.createBiquadFilter();
            fl.type = filt.type || "lowpass";
            fl.frequency.value = filt.f;
            fl.Q.value = filt.q || 0.8;
            out.connect(fl);
            out = fl;
        }
        out.connect(gain).connect(busFor(bus));
        if (echo) { const send = ctx.createGain(); send.gain.value = echo; gain.connect(send).connect(echoIn); }
        osc.start(start);
        osc.stop(start + d + 0.05);
    }
    function noise({ t = 0, d = 0.2, v = 0.2, type = "bandpass", f = 1000, f2, q = 1, a = 0.005, bus, echo = 0 }) {
        if (!ctx) return;
        const start = ctx.currentTime + t;
        const src = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), gain = ctx.createGain();
        src.buffer = noiseBuf;
        src.loop = true;
        fl.type = type;
        fl.frequency.setValueAtTime(f, start);
        if (f2) fl.frequency.exponentialRampToValueAtTime(f2, start + d);
        fl.Q.value = q;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(v, start + a);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + d);
        src.connect(fl).connect(gain).connect(busFor(bus));
        if (echo) { const send = ctx.createGain(); send.gain.value = echo; gain.connect(send).connect(echoIn); }
        src.start(start, Math.random());
        src.stop(start + d + 0.05);
    }
    const midi = n => 440 * 2 ** ((n - 69) / 12);       // MIDI note number -> frequency
    const chord = (t, notes, opts) => notes.forEach(n => tone({ ...opts, t, f: midi(n) }));

    // ---- the shared sound library (a world can replace any of these with its own version) ----
    const LIB = {
        select: () => { tone({ f: 1320, type: "triangle", d: 0.05, v: 0.06 }); tone({ t: 0.04, f: 1760, type: "triangle", d: 0.07, v: 0.05 }); },
        nav: () => { noise({ f: 400, f2: 3200, d: 0.22, v: 0.1, q: 0.8 }); tone({ f: 520, f2: 880, type: "triangle", d: 0.16, v: 0.05 }); },
        whoosh: () => noise({ f: 250, f2: 2800, d: 0.45, v: 0.18, q: 0.7 }),
        pop: () => tone({ f: 600, f2: 1200, type: "sine", d: 0.08, v: 0.12 }),
        thud: () => { tone({ f: 140, f2: 55, d: 0.22, v: 0.4 }); noise({ type: "lowpass", f: 700, d: 0.1, v: 0.2 }); },
        boom: () => { tone({ f: 120, f2: 32, d: 1.1, v: 0.6 }); noise({ type: "lowpass", f: 1800, f2: 120, d: 0.9, v: 0.4 }); },
        sparkle: () => [1, 1.25, 1.5, 2].forEach((m, i) => tone({ t: i * 0.05, f: 1568 * m, d: 0.22, v: 0.05, echo: 0.3 })),
        coin: () => { tone({ f: 988, type: "square", d: 0.07, v: 0.05 }); tone({ t: 0.06, f: 1319, type: "square", d: 0.18, v: 0.05 }); },
        type: () => tone({ f: 1100, type: "triangle", d: 0.05, v: 0.08 }),
        erase: () => tone({ f: 700, type: "triangle", d: 0.05, v: 0.06 }),
        move: () => {},
        word: () => [0, 4, 7].forEach((n, i) => tone({ t: i * 0.07, f: midi(76 + n), type: "triangle", d: 0.18, v: 0.1 })),
        wrong: () => { tone({ f: 330, f2: 300, d: 0.16, v: 0.16 }); tone({ t: 0.13, f: 300, f2: 250, d: 0.22, v: 0.14 }); },
        right: () => [0, 7, 12].forEach((n, i) => tone({ t: i * 0.06, f: midi(79 + n), type: "sine", d: 0.25, v: 0.08 })),
        reveal: () => { tone({ f: 880, f2: 1320, d: 0.2, v: 0.08 }); tone({ t: 0.1, f: 660, d: 0.25, v: 0.06 }); },
        flip: () => noise({ f: 2600, f2: 5200, d: 0.07, v: 0.1, q: 2 }),
        win: () => [60, 64, 67, 72, 76].forEach((n, i) => tone({ t: i * 0.12, f: midi(n), type: "triangle", d: i === 4 ? 0.9 : 0.25, v: 0.12 })),
        streak: () => { noise({ type: "highpass", f: 2000, d: 0.5, v: 0.06 }); [67, 72, 79].forEach((n, i) => tone({ t: i * 0.09, f: midi(n), type: "triangle", d: 0.35, v: 0.09 })); },
        achievement: () => { [72, 76, 79, 84].forEach((n, i) => tone({ t: i * 0.08, f: midi(n), type: "square", d: 0.14, v: 0.04 })); tone({ t: 0.34, f: midi(88), type: "triangle", d: 0.6, v: 0.08, echo: 0.3 }); },
        title: () => { LIB.whoosh(); tone({ t: 0.15, f: midi(67), type: "triangle", d: 0.4, v: 0.1 }); tone({ t: 0.3, f: midi(72), type: "triangle", d: 0.6, v: 0.1 }); },
        tile: i => tone({ f: midi(72 + (i % 8) * 2), type: "triangle", d: 0.09, v: 0.07 }),
        start: () => { [48, 55, 60, 64, 67, 72].forEach((n, i) => tone({ t: i * 0.05, f: midi(n), type: "sawtooth", d: 0.5, v: 0.03, filt: { f: 2400 } })); tone({ f: 90, f2: 40, d: 0.5, v: 0.4 }); },
        toggle: on => tone({ f: on ? 880 : 520, f2: on ? 1320 : 360, type: "triangle", d: 0.1, v: 0.08 }),
        blip: () => { tone({ f: 740, f2: 990, type: "triangle", d: 0.06, v: 0.045 }); tone({ t: 0.06, f: 990, f2: 1320, type: "triangle", d: 0.06, v: 0.035 }); },
        mascot: () => { tone({ f: 700, f2: 1400, type: "sine", d: 0.12, v: 0.07 }); tone({ t: 0.1, f: 1400, f2: 1000, type: "sine", d: 0.1, v: 0.05 }); }
    };

    // play("word") -> the current world's "word" sound if it has one, otherwise the shared one
    function play(name, ...args) {
        if (!Settings.get("sound") || !init() || !ready()) return;
        const now = performance.now();
        const gap = name === "type" || name === "tile" ? 28 : 45;   // no machine-gun repeats
        if (now - (gates[name] || 0) < gap) return;
        gates[name] = now;
        const world = typeof Worlds !== "undefined" && Worlds.current;
        const fn = (world && world.sounds && world.sounds[name]) || LIB[name];
        try { if (fn) fn(...args); } catch (err) { console.error("Sound", name, err); }
    }

    // ---- music: a little step sequencer. A world's music is { bpm, tick(step, t) }: tick schedules the notes
    //      for one sixteenth-note step at time offset t (seconds from now). It only plays with Settings > Music on.
    const Music = (() => {
        let timer = 0, step = 0, nextAt = 0, def = null;
        function tick() {
            if (!ready() || !def) return;
            const sixteenth = 60 / def.bpm / 4;
            if (nextAt < ctx.currentTime) nextAt = ctx.currentTime + 0.05;
            while (nextAt < ctx.currentTime + 0.25) {
                try { def.tick(step, nextAt - ctx.currentTime); } catch (err) { console.error(err); stop(); return; }
                nextAt += sixteenth;
                step++;
            }
        }
        function start(musicDef) {
            stop();
            def = musicDef;
            if (!def || !Settings.get("music") || !ready()) return;
            step = 0;
            nextAt = ctx.currentTime + 0.1;
            musBus.gain.cancelScheduledValues(ctx.currentTime);
            musBus.gain.setValueAtTime(0.0001, ctx.currentTime);
            musBus.gain.exponentialRampToValueAtTime(0.55, ctx.currentTime + 2.5);    // fade in
            timer = setInterval(tick, 60);
        }
        function stop() { clearInterval(timer); timer = 0; }
        function wake() {                                   // first click: start the music if it should be on
            const world = typeof Worlds !== "undefined" && Worlds.current;
            if (!timer && Settings.get("music") && world && world.music) start(world.music);
        }
        return { start, stop, wake, get playing() { return !!timer; } };
    })();
    Settings.on((key, value) => {
        if (key !== "music") return;
        if (value) { init(); Music.wake(); } else Music.stop();
    });

    return { play, tone, noise, chord, midi, init, Music, LIB, get ctx() { return ctx; } };
})();
