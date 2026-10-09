// Sound (redesign): every sound is made in code with the Web Audio API.
// No sound files, so nothing to download and no licenses to check.
//
//   Sound.play("word")      plays the current world's version of a sound (or the shared one)
//   Sound.tone({...})       one note: frequency f (sliding to f2), wave type, start t, length d, volume v...
//   Sound.noise({...})      a burst of filtered noise (whooshes, scratches, crashes, crowds)
//
// Browsers only allow sound after the first click or key press, so the engine wakes up then.

const Sound = (() => {
    let ctx = null, master, fxBus, echoIn, noiseBuf = null, crushCurve = null;
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
        // a gentle low-pass on everything takes the harsh edge off high, bright sounds
        const soften = ctx.createBiquadFilter();
        soften.type = "lowpass";
        soften.frequency.value = 6500;
        master.connect(soften).connect(comp).connect(ctx.destination);
        fxBus = ctx.createGain();
        fxBus.gain.value = Settings.get("sound") ? 0.6 : 0;
        fxBus.connect(master);
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
        addEventListener(type, () => init(), { capture: true, passive: true });
    }
    document.addEventListener("visibilitychange", () => {
        if (!ctx) return;
        if (document.hidden) ctx.suspend(); else ctx.resume();
    });
    Settings.on((key, value) => {
        if (!ctx) return;
        if (key === "volume") master.gain.setTargetAtTime(value, ctx.currentTime, 0.05);
        if (key === "sound") fxBus.gain.setTargetAtTime(value ? 0.6 : 0, ctx.currentTime, 0.05);
    });

    const ready = () => ctx && ctx.state === "running";

    // ---- building blocks ----
    function tone({ f = 440, f2, type = "sine", t = 0, d = 0.15, v = 0.2, a = 0.006, filt, echo = 0, crush = false, detune = 0, vib = 0 }) {
        if (!ctx) return;
        v *= quiet;                                        // small, frequent sounds play softer (see play)
        if (f > 1800) v *= 0.5;                            // very high notes sound piercing: turn them down
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
        out.connect(gain).connect(fxBus);
        if (echo) { const send = ctx.createGain(); send.gain.value = echo; gain.connect(send).connect(echoIn); }
        osc.start(start);
        osc.stop(start + d + 0.05);
    }
    function noise({ t = 0, d = 0.2, v = 0.2, type = "bandpass", f = 1000, f2, q = 1, a = 0.005, echo = 0 }) {
        if (!ctx) return;
        v *= quiet;
        // No crash or clap sounds (the owner asked, 2026-10-08): short bursts of noise (claps, clicks, hi-hats,
        // crackles) and hissy high-pass noise (cymbal crashes) are skipped everywhere. Soft whooshes, wind and
        // low rumbles still play.
        if (d < 0.25 || type === "highpass") return;
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
        src.connect(fl).connect(gain).connect(fxBus);
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
    // The sounds that happen all the time (clicks, moving, typing) are kept quiet, so they never feel in your face
    const SOFT = { select: 0.35, nav: 0.45, move: 0.35, type: 0.55, erase: 0.5, flip: 0.4, tile: 0.6, toggle: 0.5, blip: 0.4 };
    let quiet = 1;
    function play(name, ...args) {
        if (!Settings.get("sound") || !init() || !ready()) return;
        const now = performance.now();
        const gap = name === "type" || name === "tile" ? 28 : 45;   // no machine-gun repeats
        if (now - (gates[name] || 0) < gap) return;
        gates[name] = now;
        const world = typeof Worlds !== "undefined" && Worlds.current;
        const fn = (world && world.sounds && world.sounds[name]) || LIB[name];
        quiet = SOFT[name] || 1;
        try { if (fn) fn(...args); } catch (err) { console.error("Sound", name, err); } finally { quiet = 1; }
    }


    // ---- recorded sounds and boss music (free CC0 sound libraries, see static/audio/CREDITS.txt) ----
    // sample("punch")  plays audio/sfx/punch.mp3 (loaded the first time it's asked for; a sound that isn't loaded
    //                  yet just doesn't play that once)
    // music("paper-loop", { loop, rate, then })  plays a music track from audio/music, fading out the one before.
    //                  then: a track that starts when this one ends (a boss's intro runs into its fight loop)
    const buffers = {}, loadingBuf = {};
    function load(path) {
        if (buffers[path]) return Promise.resolve(buffers[path]);
        if (loadingBuf[path]) return loadingBuf[path];              // already on its way (preloaded): wait for that one
        if (!ctx) return Promise.resolve(null);
        loadingBuf[path] = fetch(path).then(r => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
            .then(b => new Promise((ok, no) => ctx.decodeAudioData(b, ok, no)))
            .then(buf => { buffers[path] = buf; return buf; })
            .catch(() => { delete loadingBuf[path]; return null; });    // a failed download can be tried again later
        return loadingBuf[path];
    }
    function preload(names) { if (init()) names.forEach(n => load(n.includes("/") ? n : `audio/sfx/${n}.mp3`)); }
    // A decoded song is big (about 50 MB for 2.5 minutes), so only the last few songs stay in memory
    const MUSIC_KEEP = 3, musicUsed = [];
    function keepSong(path) {
        const i = musicUsed.indexOf(path);
        if (i >= 0) musicUsed.splice(i, 1);
        musicUsed.push(path);
        while (musicUsed.length > MUSIC_KEEP) { const old = musicUsed.shift(); if (!track || `audio/music/${track.name}.mp3` !== old) { delete buffers[old]; delete loadingBuf[old]; } }
    }
    // start loading a song now, so it can play the moment it's needed (a boss's next phase)
    function preloadMusic(name) { if (!init() || !name) return; const path = `audio/music/${name}.mp3`; keepSong(path); load(path); }
    function sample(name, { v = 0.5, rate = 1, t = 0 } = {}) {
        if (!Settings.get("sound") || !init() || !ready()) return;
        const path = `audio/sfx/${name}.mp3`, buf = buffers[path];
        if (!buf) { load(path); return; }
        const src = ctx.createBufferSource(), gain = ctx.createGain();
        src.buffer = buf;
        src.playbackRate.value = rate;
        gain.gain.value = v;
        src.connect(gain).connect(fxBus);
        src.start(ctx.currentTime + t);
    }
    // music has its own volume, under the sound effects, and follows the Sound and Boss music settings
    let musicBus = null, track = null;
    const musicOn = () => Settings.get("sound") && Settings.get("bossMusic") !== false;
    // songs.json: each boss song's loop points. A song file starts with its build-up (the user's design: the intro is
    // music that builds up and runs straight into the song), the song proper starts at "hit", then the browser loops
    // [loopStart, loopEnd] exactly, forever (built so the seam can't be heard; see audio/CREDITS.txt)
    let songs = null;
    const songList = () => songs || (songs = fetch("audio/music/songs.json").then(r => (r.ok ? r.json() : {})).catch(() => ({})));
    async function music(name, { loop = true, v = 0.32, fade = 0.8, rate = 1, then = null, thenOpts = {}, offset = 0, fromLoop = false } = {}) {
        if (!init()) return;
        if (!musicBus) { musicBus = ctx.createGain(); musicBus.gain.value = musicOn() ? 1 : 0; musicBus.connect(master); }
        stopMusic(fade);
        if (!name) return;
        const path = `audio/music/${name}.mp3`;
        keepSong(path);
        let started;
        const me = (track = { name, gain: null, src: null, hit: 0, t0: 0, rate, offset, ready: new Promise(r => (started = r)) });
        const [buf, list] = await Promise.all([buffers[path] || load(path), songList()]);
        if (!buf || track !== me) { started(false); return; }
        const info = list[name];
        const src = ctx.createBufferSource(), gain = ctx.createGain();
        src.buffer = buf;
        src.loop = loop;
        src.playbackRate.value = rate;
        if (!loop && then) src.onended = () => { if (track === me) music(then, { v, fade: 0.05, ...thenOpts }); };
        if (loop && info && info.loopEnd) { src.loopStart = info.loopStart; src.loopEnd = Math.min(info.loopEnd, buf.duration); }
        else if (loop) { src.loopStart = 0.03; src.loopEnd = buf.duration - 0.03; }      // skip the MP3's silent padding
        if (fromLoop && info && info.loopStart) offset = info.loopStart;               // skip the intro (a fight that's already going)
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(v, ctx.currentTime + 0.25);
        src.connect(gain).connect(musicBus);
        src.start(0, offset);
        me.gain = gain;
        me.src = src;
        Object.assign(me, { hit: (info && info.hit) || 0, t0: ctx.currentTime, offset });
        started(true);
    }
    // Resolves when the playing song's build-up reaches the song proper (its "hit"), so a cinematic's big moment can
    // land on the downbeat. Right away when there's no music (or it's off); never later than max ms.
    async function buildDone(max = 12000) {
        const me = track;
        if (!me || !musicOn()) return;
        const ok = await Promise.race([me.ready, new Promise(r => setTimeout(() => r(false), 4000))]);
        if (!ok || track !== me || !me.hit) return;
        const pos = me.offset + (ctx.currentTime - me.t0) * me.rate, wait = (me.hit - pos) / me.rate;
        if (wait > 0) await new Promise(r => setTimeout(r, Math.min(max, wait * 1000)));
    }
    function stopMusic(fade = 0.8) {
        const old = track;
        track = null;
        if (!old || !old.src || !ctx) return;
        old.gain.gain.cancelScheduledValues(ctx.currentTime);
        old.gain.gain.setValueAtTime(old.gain.gain.value, ctx.currentTime);
        old.gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + fade);
        old.src.stop(ctx.currentTime + fade + 0.05);
    }
    Settings.on(key => {
        if (musicBus && (key === "sound" || key === "bossMusic")) musicBus.gain.setTargetAtTime(musicOn() ? 1 : 0, ctx.currentTime, 0.1);
    });

    // a one-off sound written somewhere else (each campaign ability and boss move has its own, see powers.js)
    function custom(fn, ...args) {
        if (!Settings.get("sound") || !init() || !ready() || !fn) return;
        try { fn(...args); } catch (err) { console.error("Sound", err); }
    }

    const hasSong = async name => !!(await songList())[name];
    return { play, custom, sample, preload, preloadMusic, music, stopMusic, hasSong, buildDone, get musicPlaying() { return track ? track.name : null; }, tone, noise, chord, midi, init, LIB, get ctx() { return ctx; } };
})();
