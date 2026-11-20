/* Sound: all music and effects are made live with WebAudio (no sound files).
   Music has four moods: day, night, dungeon, combat. It starts only after the first tap,
   is quiet by default, and goes silent while the app is in the background. */
const SOUND = (() => {
  const KEY = "rotn_sound";
  let cfg = { music: 0.35, sfx: 0.6, mute: false };
  try { Object.assign(cfg, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { /* storage blocked */ }
  const saveCfg = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* ignore */ } };

  let ctx = null, master, musicBus, sfxBus, verb, verbIn, drone = null, sched = null;
  let mood = "day", nextBeat = 0, beat = 0, phrase = [], chordIx = 0, melIx = 3, wantMood = "day";
  const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

  // ------------------------------------------------------------ moods
  const MOODS = {
    //       root    scale (semitones)          beat s  melody  octave  drone filter  chords (semitones from root)
    day:     { root: 50, scale: [0, 2, 3, 5, 7, 9, 10], beat: 0.85, dens: 0.55, oct: 12, cut: 900, chords: [0, -2, -4, -2], voice: "flute", drone: 0.16 },
    night:   { root: 45, scale: [0, 2, 3, 5, 7, 8, 10], beat: 1.25, dens: 0.28, oct: 24, cut: 520, chords: [0, -4, -2, 0], voice: "bell", drone: 0.13 },
    dungeon: { root: 38, scale: [0, 1, 3, 5, 7, 8, 10], beat: 1.4, dens: 0.16, oct: 24, cut: 330, chords: [0, 1, 0, -2], voice: "bell", drone: 0.2 },
    combat:  { root: 38, scale: [0, 2, 3, 5, 7, 8, 10], beat: 0.42, dens: 0.5, oct: 12, cut: 1500, chords: [0, 0, -4, -2], voice: "strings", drone: 0.18, drums: true },
  };

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 6; master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    // a cheap hall reverb: decaying stereo noise
    verb = ctx.createConvolver();
    const len = ctx.sampleRate * 2.8, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    verb.buffer = ir;
    verbIn = ctx.createGain(); verbIn.gain.value = 0.55; verbIn.connect(verb); verb.connect(master);
    applyVolume();
    return true;
  }
  function applyVolume() {
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.setTargetAtTime(cfg.mute ? 0 : 1.5, t, 0.05);
    musicBus.gain.setTargetAtTime(cfg.music * 0.6, t, 0.2);
    sfxBus.gain.setTargetAtTime(cfg.sfx, t, 0.05);
  }

  // ------------------------------------------------------------ building blocks
  function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function tone(freq, t, dur, { type = "triangle", vol = 0.2, a = 0.02, bus = sfxBus, wet = 0.3, cut = 0, vib = 0, glide = 0 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * glide), t + dur);
    let last = o;
    if (cut) { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = cut; o.connect(f); last = f; }
    if (vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5; lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + a + dur + 0.1); }
    last.connect(g); env(g, t, a, vol, dur);
    g.connect(bus);
    if (wet) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(verbIn); }
    o.start(t); o.stop(t + a + dur + 0.1);
  }
  let noiseBuf = null;
  function noise(t, dur, { type = "bandpass", freq = 1000, q = 1, vol = 0.3, a = 0.005, bus = sfxBus, sweep = 0, wet = 0.15 } = {}) {
    if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(30, freq * sweep), t + dur);
    s.connect(f); f.connect(g); env(g, t, a, vol, dur); g.connect(bus);
    if (wet) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(verbIn); }
    s.start(t, Math.random()); s.stop(t + a + dur + 0.1);
  }
  function grit(amount = 30) {
    const ws = ctx.createWaveShaper(), n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = (1 + amount) * x / (1 + amount * Math.abs(x)); }
    ws.curve = c; return ws;
  }
  function drum(t, vol = 0.5, f0 = 130) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.25);
    o.connect(g); env(g, t, 0.004, vol, 0.35); g.connect(musicBus); o.start(t); o.stop(t + 0.45);
    noise(t, 0.06, { type: "lowpass", freq: 600, vol: vol * 0.3, bus: musicBus, wet: 0.1 });
  }

  // ------------------------------------------------------------ the drone (always on while music plays)
  function startDrone() {
    if (drone) return;
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = "lowpass"; f.frequency.value = MOODS[mood].cut; f.Q.value = 0.7;
    g.gain.value = 0.0001; f.connect(g); g.connect(musicBus);
    const w = ctx.createGain(); w.gain.value = 0.35; g.connect(w); w.connect(verbIn);
    const oscs = [[0, "sawtooth", 0.5, -6], [7, "sawtooth", 0.35, 5], [12, "triangle", 0.4, 0], [-12, "sine", 0.6, 0]].map(([iv, type, vol, det]) => {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.detune.value = det; og.gain.value = vol;
      o.connect(og); og.connect(f); o.start(); return { o, iv };
    });
    // slow breathing of the filter
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 140; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    drone = { f, g, oscs, lfo };
    setDrone(0, true);
  }
  function setDrone(chordShift, now = false) {
    if (!drone) return;
    const m = MOODS[mood], t = ctx.currentTime, k = now ? 0.05 : 1.2;
    drone.oscs.forEach(({ o, iv }) => o.frequency.setTargetAtTime(hz(m.root - 12 + chordShift + iv), t, k));
    drone.f.frequency.setTargetAtTime(m.cut, t, 1.5);
    drone.g.gain.setTargetAtTime(m.drone, t, 1.5);
  }
  function stopDrone() {
    if (!drone) return;
    const d = drone; drone = null; const t = ctx.currentTime;
    d.g.gain.setTargetAtTime(0.0001, t, 0.4);
    setTimeout(() => { d.oscs.forEach(({ o }) => o.stop()); d.lfo.stop(); }, 2500);
  }

  // ------------------------------------------------------------ the melody scheduler
  function voice(freq, t, len) {
    const v = MOODS[mood].voice;
    if (v === "flute") { tone(freq, t, len * 0.9, { type: "triangle", vol: 0.13, a: 0.09, bus: musicBus, wet: 0.45, vib: 3 }); tone(freq * 2, t, len * 0.6, { type: "sine", vol: 0.025, a: 0.1, bus: musicBus, wet: 0.5 }); }
    else if (v === "bell") { tone(freq, t, 2.4, { type: "sine", vol: 0.1, a: 0.005, bus: musicBus, wet: 0.7 }); tone(freq * 2.76, t, 1.1, { type: "sine", vol: 0.025, a: 0.005, bus: musicBus, wet: 0.7 }); }
    else { tone(freq, t, len * 0.8, { type: "sawtooth", vol: 0.06, a: 0.04, bus: musicBus, wet: 0.3, cut: 1800 }); }
  }
  function newPhrase(m) {
    const n = 3 + Math.floor(Math.random() * 4), out = [];
    for (let i = 0; i < n; i++) {
      melIx += [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)];
      melIx = Math.max(0, Math.min(m.scale.length + 4, melIx));
      out.push({ ix: melIx, len: Math.random() < 0.3 ? 2 : 1 });
    }
    out[out.length - 1].len = 3;   // phrases end on a held note
    return out;
  }
  let hold = 0;
  function step() {
    if (!ctx || !drone) return;
    const m = MOODS[mood];
    while (nextBeat < ctx.currentTime + 0.4) {
      const t = nextBeat;
      if (beat % 8 === 0) { chordIx = (chordIx + 1) % m.chords.length; setDrone(m.chords[chordIx]); }
      if (m.drums) { if (beat % 4 === 0) drum(t, 0.45); else if (beat % 4 === 2) drum(t, 0.3, 160); else if (Math.random() < 0.3) drum(t, 0.15, 200); }
      if (hold > 0) hold--;
      else if (phrase.length) {
        const n = phrase.shift(), deg = m.scale[n.ix % m.scale.length] + 12 * Math.floor(n.ix / m.scale.length);
        voice(hz(m.root + m.oct + deg), t, n.len * m.beat);
        hold = n.len - 1;
      } else if (Math.random() < m.dens * 0.35) phrase = newPhrase(m);
      else if (mood === "dungeon" && Math.random() < 0.08) noise(t, 0.05, { type: "bandpass", freq: 2500 + Math.random() * 1500, q: 18, vol: 0.08, bus: musicBus, wet: 0.9 });   // a drip
      beat++; nextBeat += m.beat;
    }
  }
  function startMusic() {
    if (!ctx || sched) return;
    startDrone(); nextBeat = ctx.currentTime + 0.3; sched = setInterval(step, 150);
  }
  function stopMusic() { clearInterval(sched); sched = null; stopDrone(); }

  // ------------------------------------------------------------ effects
  const FX = {
    click(t) { tone(1200, t, 0.03, { type: "square", vol: 0.03, wet: 0, cut: 2500 }); },
    page(t) { noise(t, 0.12, { type: "highpass", freq: 2500, vol: 0.06, wet: 0 }); },
    hit(t) { noise(t, 0.09, { freq: 1300 + Math.random() * 600, q: 1.5, vol: 0.5 }); tone(95, t, 0.12, { type: "sine", vol: 0.5, wet: 0.05, glide: 0.5 }); },
    clang(t) { [1900, 2650, 3700].forEach((f) => tone(f * (0.95 + Math.random() * 0.1), t, 0.35, { type: "sine", vol: 0.05, a: 0.002, wet: 0.3 })); noise(t, 0.04, { freq: 3000, vol: 0.2 }); },
    swing(t) { noise(t, 0.18, { type: "bandpass", freq: 600, q: 2, vol: 0.18, a: 0.06, sweep: 4, wet: 0.05 }); },
    spell(t) { noise(t, 0.5, { type: "bandpass", freq: 400, q: 3, vol: 0.25, a: 0.05, sweep: 6 }); tone(330, t, 0.5, { type: "sawtooth", vol: 0.05, glide: 2, cut: 1500 }); },
    coin(t) { for (let i = 0; i < 3; i++) tone(2100 + Math.random() * 1400, t + i * 0.06 + Math.random() * 0.02, 0.18, { type: "sine", vol: 0.06, a: 0.002, wet: 0.2 }); },
    levelup(t) { [62, 65, 69, 74, 77].forEach((n, i) => tone(hz(n), t + i * 0.11, 1.4, { type: "triangle", vol: 0.12, a: 0.01, wet: 0.6 })); tone(hz(86), t + 0.55, 1.6, { type: "sine", vol: 0.04, wet: 0.8 }); },
    quest(t) { [74, 81, 86].forEach((n, i) => tone(hz(n), t + i * 0.18, 1.8, { type: "sine", vol: 0.09, a: 0.005, wet: 0.7 })); },
    arrive(t) { tone(hz(57), t, 0.5, { type: "sawtooth", vol: 0.09, a: 0.12, cut: 900, wet: 0.5 }); tone(hz(62), t + 0.45, 1.1, { type: "sawtooth", vol: 0.1, a: 0.15, cut: 1000, wet: 0.6 }); },
    victory(t) { [[62, 0], [69, 0.16], [74, 0.32]].forEach(([n, d]) => tone(hz(n), t + d, d === 0.32 ? 1.2 : 0.3, { type: "sawtooth", vol: 0.09, a: 0.03, cut: 1600, wet: 0.5 })); },
    death(t) { tone(hz(38), t, 2.5, { type: "sawtooth", vol: 0.14, a: 0.3, cut: 500, glide: 0.7, wet: 0.6 }); tone(hz(45), t + 0.2, 2.2, { type: "sawtooth", vol: 0.08, a: 0.4, cut: 400, glide: 0.7, wet: 0.6 }); },
    potion(t) { for (let i = 0; i < 4; i++) tone(500 + i * 120 + Math.random() * 60, t + i * 0.07, 0.08, { type: "sine", vol: 0.08, glide: 1.8, wet: 0.1 }); },
    shout(t) {   // the Voice: a deep distorted blast with a rush of air
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), ws = grit(40), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = "sawtooth"; o2.type = "square"; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(48, t + 1.1);
      o2.frequency.setValueAtTime(61, t); o2.frequency.exponentialRampToValueAtTime(30, t + 1.1);
      f.type = "lowpass"; f.frequency.setValueAtTime(2200, t); f.frequency.exponentialRampToValueAtTime(300, t + 1.1);
      o.connect(ws); o2.connect(ws); ws.connect(f); f.connect(g); env(g, t, 0.02, 0.22, 1.1); g.connect(sfxBus);
      const w = ctx.createGain(); w.gain.value = 0.8; g.connect(w); w.connect(verbIn);
      o.start(t); o2.start(t); o.stop(t + 1.3); o2.stop(t + 1.3);
      noise(t, 1.2, { type: "lowpass", freq: 3000, vol: 0.35, a: 0.01, sweep: 0.1, wet: 0.6 });
    },
    dragon(t) {   // a roar: rough low tone, wobbling, through a sweeping filter
      const o = ctx.createOscillator(), l = ctx.createOscillator(), lg = ctx.createGain(), ws = grit(60), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = "sawtooth"; o.frequency.setValueAtTime(70, t); o.frequency.linearRampToValueAtTime(110, t + 0.5); o.frequency.exponentialRampToValueAtTime(45, t + 2.2);
      l.frequency.value = 23; lg.gain.value = 25; l.connect(lg); lg.connect(o.frequency);
      f.type = "bandpass"; f.Q.value = 1.2; f.frequency.setValueAtTime(300, t); f.frequency.linearRampToValueAtTime(900, t + 0.5); f.frequency.exponentialRampToValueAtTime(160, t + 2.2);
      o.connect(ws); ws.connect(f); f.connect(g); env(g, t, 0.25, 0.3, 2.0); g.connect(sfxBus);
      const w = ctx.createGain(); w.gain.value = 0.9; g.connect(w); w.connect(verbIn);
      o.start(t); l.start(t); o.stop(t + 2.5); l.stop(t + 2.5);
      noise(t + 0.1, 2, { type: "bandpass", freq: 700, q: 0.8, vol: 0.25, a: 0.3, sweep: 0.3, wet: 0.7 });
    },
  };

  // ------------------------------------------------------------ public
  let unlocked = false;
  function unlock() {
    if (unlocked) return;
    if (!init()) return;
    unlocked = true;
    ctx.resume?.();
    if (!cfg.mute && cfg.music > 0) startMusic();
  }
  ["pointerdown", "keydown", "touchstart"].forEach((ev) => document.addEventListener(ev, unlock, { capture: true, passive: true }));
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend?.(); else { ctx.resume?.(); nextBeat = Math.max(nextBeat, ctx.currentTime + 0.2); }
  });
  const ready = () => ctx && unlocked && !cfg.mute && ctx.state !== "suspended";
  return {
    fx(name, delay = 0) { if (!ready() || !cfg.sfx || !FX[name]) return; try { FX[name](ctx.currentTime + 0.01 + delay); } catch (e) { /* never break the game for a sound */ } },
    /* plays a short fight: a few blows, then a win or loss sting */
    fight(r) {
      if (!ready() || !cfg.sfx) return;
      const n = Math.min(6, Math.max(2, r?.fight?.log?.length || 3));
      for (let i = 0; i < n; i++) this.fx(i % 3 === 2 ? "clang" : i % 2 ? "swing" : "hit", i * 0.2);
      this.fx(r.died ? "death" : "victory", n * 0.2 + 0.15);
    },
    mood(m) {
      if (!MOODS[m] || m === wantMood) return;
      wantMood = m; mood = m; phrase = []; hold = 0;
      if (ctx && drone) { chordIx = 0; setDrone(0); nextBeat = Math.max(nextBeat, ctx.currentTime + 0.1); }
    },
    get settings() { return { ...cfg }; },
    set(k, v) {
      cfg[k] = v; saveCfg();
      if (!ctx) return;
      applyVolume();
      if (cfg.mute || cfg.music <= 0) stopMusic(); else if (unlocked) startMusic();
    },
    get state() { return { ctx: ctx?.state || "none", unlocked, mood, music: !!sched }; },
  };
})();
