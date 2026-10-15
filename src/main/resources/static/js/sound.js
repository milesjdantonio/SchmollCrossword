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
        master.gain.value = Settings.gain("volume");
        // a gentle low-pass on everything takes the harsh edge off high, bright sounds
        const soften = ctx.createBiquadFilter();
        soften.type = "lowpass";
        soften.frequency.value = 6500;
        master.connect(soften).connect(comp).connect(ctx.destination);
        fxBus = ctx.createGain();
        fxBus.gain.value = fxLevel();
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
        addEventListener(type, () => { init(); wakeSong(); }, { capture: true, passive: true });
    }
    document.addEventListener("visibilitychange", () => {
        if (!ctx) return;
        if (document.hidden) ctx.suspend(); else ctx.resume();
        // (the level song pauses with everything else: it's played through the same audio context)
    });
    // All Effects (Settings > Sound, and the sound button's menu), under the Master Volume; every volume follows the
    // loudness curve in Settings.gain
    function fxLevel() { return Settings.get("sound") ? 0.6 * Settings.gain("fxVolume") : 0; }
    Settings.on(key => {
        if (!ctx) return;
        if (key === "volume") master.gain.setTargetAtTime(Settings.gain("volume"), ctx.currentTime, 0.05);
        if (key === "sound" || key === "fxVolume") fxBus.gain.setTargetAtTime(fxLevel(), ctx.currentTime, 0.05);
    });

    const ready = () => ctx && ctx.state === "running";

    // ---- building blocks ----
    // Boss-fight sounds (powers.js and the spells files mark theirs boss: true) play at a level set for each move or
    // ability, from how loud each one measured, so none is louder than the boss music. bossLevel(x, ms): for the next ms, marked sounds play at x (the
    // quietest one wins when two overlap). Everything else is left alone. On top of that, the player's own Boss Fight
    // Effects volume (bossFxVolume, in the sound menu) scales all of them.
    const levels = [];
    function bossLevel(x, ms) { levels.push({ x, until: performance.now() + ms }); }
    function bossGain() {
        const now = performance.now();
        for (let i = levels.length - 1; i >= 0; i--) if (levels[i].until < now) levels.splice(i, 1);
        let g = 1;
        for (const l of levels) g = Math.min(g, l.x);
        return g * Settings.gain("bossFxVolume");
    }
    function tone({ f = 440, f2, type = "sine", t = 0, d = 0.15, v = 0.2, a = 0.006, filt, echo = 0, crush = false, detune = 0, vib = 0, boss = false }) {
        if (!ctx) return;
        v *= quiet;                                        // small, frequent sounds play softer (see play)
        if (boss) v *= bossGain();
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
    function noise({ t = 0, d = 0.2, v = 0.2, type = "bandpass", f = 1000, f2, q = 1, a = 0.005, echo = 0, boss = false }) {
        if (!ctx) return;
        v *= quiet;
        if (boss) v *= bossGain();
        // No crash or clap sounds : short bursts of noise (claps, clicks, hi-hats,
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
        // changing worlds: no noise at all, a soft rising
        // sweep of two sine voices that lands on a pair of bell notes
        // changing worlds: a soft, low rise into a warm two-note chord (no high sweep or bell)
        worldSwap: () => {
            tone({ f: 196, f2: 294, type: "sine", d: 0.5, v: 0.08, a: 0.1 });
            tone({ t: 0.22, f: midi(60), type: "sine", d: 0.8, v: 0.05, a: 0.04 });
            tone({ t: 0.3, f: midi(64), type: "sine", d: 0.8, v: 0.04, a: 0.04 });
        },
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
    // two groups the player can turn off on their own (the sound menu): typing on the board, and clicks in the menus
    const TYPING = { type: 1, erase: 1, move: 1 }, CLICKS = { select: 1, nav: 1, toggle: 1, blip: 1 };
    let quiet = 1;
    function play(name, ...args) {
        if (!Settings.get("sound") || !init() || !ready()) return;
        if ((TYPING[name] && Settings.get("typingSounds") === false) || (CLICKS[name] && Settings.get("clickSounds") === false)) return;
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
    function preloadMusic(name) { if (!init() || !name || !musicOn()) return; const path = `audio/music/${name}.mp3`; keepSong(path); load(path); }
    function sample(name, { v = 0.5, rate = 1, t = 0, boss = false } = {}) {
        if (boss) v *= bossGain();
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
    // Music: two buses under the Master Volume, each with its own slider and no switch:
    // Boss Music (boss songs, the story, winning and losing: music() below) and Level Music (levelSong()). A slider
    // at 0 is off: that kind of song isn't even downloaded.
    let musicBus = null, levelBus = null, track = null;
    const musicOn = () => !!Settings.get("sound") && (Settings.get("bossMusicVolume") ?? 1) > 0;
    const musicLevel = () => (Settings.get("sound") ? Settings.gain("bossMusicVolume") : 0);
    const levelLevel = () => (Settings.get("sound") ? Settings.gain("levelMusicVolume") : 0);
    const makeBus = () => {
        if (!musicBus) { musicBus = ctx.createGain(); musicBus.gain.value = musicLevel(); musicBus.connect(master); }
        if (!levelBus) { levelBus = ctx.createGain(); levelBus.gain.value = levelLevel(); levelBus.connect(master); }
    };
    // songs.json: each boss song's loop points. A song file starts with its build-up, the song proper starts at "hit", then the browser loops
    // [loopStart, loopEnd] exactly, forever (built so the seam can't be heard; see audio/CREDITS.txt)
    let songs = null;
    const songList = () => songs || (songs = fetch("audio/music/songs.json").then(r => (r.ok ? r.json() : {})).catch(() => ({})));
    async function music(name, { loop = true, v = 0.32, fade = 0.8, rate = 1, then = null, thenOpts = {}, offset = 0, fromLoop = false } = {}) {
        if (!init()) return;
        makeBus();
        stopMusic(fade);
        if (name) levelSong(null, { fade: Math.max(0.3, fade) });        // a boss song (or the win or lose music) takes over
        if (!name) return;
        const path = `audio/music/${name}.mp3`;
        let started;
        const me = (track = { name, gain: null, src: null, hit: 0, t0: 0, rate, offset, ready: new Promise(r => (started = r)), args: { loop, v, rate, then, thenOpts } });
        // music switched off: remember what would be playing, but don't download or decode it (a song is ~50 MB
        // decoded); it starts if music is switched back on (see Settings.on below)
        if (!musicOn()) { started(false); return; }
        keepSong(path);
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
        if (musicBus && (key === "sound" || key === "bossMusicVolume")) musicBus.gain.setTargetAtTime(musicLevel(), ctx.currentTime, 0.05);
        if (levelBus && (key === "sound" || key === "levelMusicVolume")) levelBus.gain.setTargetAtTime(levelLevel(), ctx.currentTime, 0.05);
        // Boss Music down to 0: the song stops (but is remembered, so turning it back up brings it back)
        if (key === "bossMusicVolume" && !musicOn() && track && track.src) { const { name, args } = track; stopMusic(0.4); track = { name, src: null, args, hit: 0, ready: Promise.resolve(false) }; }
        if (key === "sound" || key === "levelMusicVolume") { if (songOn()) wakeSong(); else pauseSong(); }
        // turned back up in the middle of a fight: the song that was skipped starts now (from its loop, no build-up)
        if ((key === "sound" || key === "bossMusicVolume") && musicOn() && track && !track.src && track.args && track.args.loop) {
            const { name, args } = track;
            music(name, { ...args, fade: 0.05, fromLoop: true });
        }
    });

    // ---- level songs ----
    // levelSong("level-garden-2") plays audio/music/level-garden-2.mp3, fading in; levelSong(null) fades it out.
    // It loops on itself: the file
    // plays once from the top, then [loopStart, loopEnd] from level-loops.json repeats forever with no gap, so it's
    // decoded and played like the boss songs (an <audio> element can't loop part of a file, and leaves a gap when
    // it loops the whole). Only one plays at a time and only it is kept decoded; it's under the Level Music slider (0
    // = off), and a boss song (or the win or lose music) stops it.
    let song = null, loops = null;
    const songOn = () => !!Settings.get("sound") && (Settings.get("levelMusicVolume") ?? 1) > 0;
    const loopList = () => loops || (loops = fetch("audio/music/level-loops.json").then(r => (r.ok ? r.json() : {})).catch(() => ({})));
    function levelSong(name, { v = 0.55, fade = 1.2 } = {}) {
        if (name && song && song.name === name) { wakeSong(); return; }
        const old = song;
        song = null;
        if (old && old.src && ctx) {
            old.gain.gain.cancelScheduledValues(ctx.currentTime);
            old.gain.gain.setValueAtTime(Math.max(0.0001, old.gain.gain.value), ctx.currentTime);
            old.gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + fade);
            old.src.stop(ctx.currentTime + fade + 0.05);
        }
        if (old) setTimeout(() => { if (old.gain) old.gain.disconnect(); old.buf = null; }, fade * 1000 + 200);
        if (!name) return;
        song = { name, v, src: null, buf: null, loop: null, gain: null, pos: 0, faded: false, loading: null };
        wakeSong();
    }
    // where the song is now (seconds into the file), counting the loops
    function songPos(me) {
        let p = me.pos0 + (ctx.currentTime - me.t0);
        const ls = me.src.loopStart, le = me.src.loopEnd;
        if (le > ls && p > le) p = ls + ((p - ls) % (le - ls));
        return p;
    }
    // Level Music turned down to 0: stop, but remember the spot to carry on from
    function pauseSong() {
        if (!song || !song.src) return;
        song.pos = songPos(song);
        song.src.stop();
        song.src = null;
    }
    // start (or carry on with) the level song; it's only downloaded and decoded while Level Music is above 0
    async function wakeSong() {
        if (!song || !songOn() || !init()) return;
        makeBus();
        const me = song;
        if (me.src) return;
        if (!me.buf) {
            if (!me.loading) me.loading = Promise.all([fetch(`audio/music/${me.name}.mp3`).then(r => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
                .then(b => new Promise((ok, no) => ctx.decodeAudioData(b, ok, no))), loopList()]).catch(() => null);
            const got = await me.loading;
            if (song !== me) return;
            if (!got) { me.loading = null; return; }                        // couldn't download it: tried again on the next click
            [me.buf, me.loop] = [got[0], got[1][me.name] || null];
        }
        if (me.src || !songOn()) return;
        if (!me.gain) { me.gain = ctx.createGain(); me.gain.gain.value = 0.0001; me.gain.connect(levelBus); }
        const src = ctx.createBufferSource(), L = me.loop, dur = me.buf.duration;
        src.buffer = me.buf;
        src.loop = true;
        if (L && L.loopEnd) { src.loopStart = L.loopStart; src.loopEnd = Math.min(L.loopEnd, dur); }
        else { src.loopStart = 0.03; src.loopEnd = dur - 0.03; }                // (a song with no loop points: the whole file)
        src.connect(me.gain);
        src.start(0, me.pos);
        Object.assign(me, { src, t0: ctx.currentTime, pos0: me.pos });
        if (!me.faded) {                                                         // the first time it starts: a slow fade in
            me.faded = true;
            me.gain.gain.setValueAtTime(0.0001, ctx.currentTime);
            me.gain.gain.exponentialRampToValueAtTime(me.v, ctx.currentTime + 2.5);
        }
    }

    // a one-off sound written somewhere else (each campaign ability and boss move has its own, see powers.js)
    function custom(fn, ...args) {
        if (!Settings.get("sound") || !init() || !ready() || !fn) return;
        try { fn(...args); } catch (err) { console.error("Sound", err); }
    }

    const hasSong = async name => !!(await songList())[name];
    return { play, custom, sample, bossLevel, preload, preloadMusic, music, stopMusic, hasSong, buildDone, levelSong, get levelSongName() { return song ? song.name : null; }, get bossMusicOn() { return musicOn(); }, get musicPlaying() { return track ? track.name : null; }, tone, noise, chord, midi, init, LIB, get ctx() { return ctx; } };
})();
