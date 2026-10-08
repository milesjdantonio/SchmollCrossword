// Sound effects (design pass), made in code with the browser's Web Audio API: no sound files, so no licenses.
// A sound is a few short notes. Each note is an "oscillator" (a tone generator: sine = soft, triangle = a bit
// brighter) shaped by a "gain" (volume) envelope: quick fade in, gentle fade out. That's what makes it a pluck
// or a chime instead of a beep.
//
// Sound is ON by default (Settings / the speaker button turn it off). Browsers only allow sound after the
// first click or key press on the page, so nothing plays before that.

const Sound = (() => {
    let ctx = null;          // the AudioContext, made on the first sound (browsers want a click first anyway)
    let master = null;       // one volume knob for everything
    let enabled = true;
    let lastTypeAt = 0;

    // note(frequency in Hz, start delay in s, length in s, waveform, volume)
    // Each design gets its own "instrument": a list of notes per sound moment.
    const C5 = 523.25, D5 = 587.33, E5 = 659.25, G5 = 783.99, A5 = 880, C6 = 1046.5, E6 = 1318.5, G4 = 392, E4 = 329.63;
    const INSTRUMENTS = {
        classic: {
            type:   [[C6, 0, 0.06, "triangle", 0.10]],
            erase:  [[G5, 0, 0.06, "triangle", 0.07]],
            word:   [[E5, 0, 0.12, "triangle", 0.14], [G5, 0.07, 0.12, "triangle", 0.14], [C6, 0.14, 0.2, "triangle", 0.14]],
            wrong:  [[E4, 0, 0.14, "sine", 0.18], [E4 * 0.94, 0.12, 0.2, "sine", 0.16]],
            reveal: [[A5, 0, 0.1, "sine", 0.12], [E5, 0.08, 0.16, "sine", 0.1]],
            win:    [[C5, 0, 0.18, "triangle", 0.16], [E5, 0.12, 0.18, "triangle", 0.16], [G5, 0.24, 0.18, "triangle", 0.16],
                     [C6, 0.36, 0.5, "triangle", 0.18], [E6, 0.5, 0.6, "sine", 0.08]],
            streak: [[G4, 0, 0.2, "triangle", 0.12], [C5, 0.1, 0.2, "triangle", 0.12], [G5, 0.2, 0.45, "triangle", 0.14]]
        },
        garden: {   // chimes and soft plucks
            type:   [[E6, 0, 0.18, "sine", 0.07], [E6 * 2, 0, 0.08, "sine", 0.015]],
            erase:  [[A5, 0, 0.12, "sine", 0.05]],
            word:   [[G5, 0, 0.5, "sine", 0.12], [C6, 0.09, 0.5, "sine", 0.11], [E6, 0.18, 0.7, "sine", 0.1]],
            wrong:  [[D5 * 0.75, 0, 0.25, "sine", 0.16]],
            reveal: [[C6, 0, 0.3, "sine", 0.09], [G5, 0.1, 0.4, "sine", 0.08]],
            win:    [[C5, 0, 0.9, "sine", 0.12], [E5, 0.15, 0.9, "sine", 0.12], [G5, 0.3, 0.9, "sine", 0.12],
                     [C6, 0.45, 1.2, "sine", 0.12], [E6, 0.6, 1.4, "sine", 0.08], [G5 * 2, 0.9, 1.6, "sine", 0.05]],
            streak: [[G5, 0, 0.6, "sine", 0.1], [C6, 0.12, 0.8, "sine", 0.1]]
        }
    };

    function setup() {
        if (ctx) return true;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return false;
        ctx = new AudioCtx();
        master = ctx.createGain();
        master.gain.value = 0.9;
        master.connect(ctx.destination);
        return true;
    }

    function note(freq, delay, length, wave, volume) {
        const start = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = wave;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);           // quick fade in (no click)
        gain.gain.exponentialRampToValueAtTime(0.0001, start + length);          // gentle fade out
        osc.connect(gain).connect(master);
        osc.start(start);
        osc.stop(start + length + 0.05);
    }

    // play("word") plays the current design's version of that moment (Classic's if the design has none)
    function play(name) {
        if (!enabled || !setup()) return;
        if (ctx.state === "suspended") ctx.resume();
        if (name === "type") {                      // very fast typing: don't stack clicks on top of each other
            const now = performance.now();
            if (now - lastTypeAt < 35) return;
            lastTypeAt = now;
        }
        const design = document.documentElement.dataset.design;
        const instrument = INSTRUMENTS[design] || INSTRUMENTS.classic;
        const notes = instrument[name] || INSTRUMENTS.classic[name] || [];
        try {
            for (const n of notes) note(...n);
        } catch (err) { /* audio not available: play silently */ }
    }

    return {
        play,
        setEnabled(on) { enabled = on; },
        get enabled() { return enabled; },
        // a design can add its own instrument: Sound.addInstrument("ocean", { type: [...], ... })
        addInstrument(design, notes) { INSTRUMENTS[design] = notes; }
    };
})();
