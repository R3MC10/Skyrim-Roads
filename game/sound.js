/* Sound: music and effects are made live with WebAudio. Recorded files (listed in audio.json) take over any effect
   or music track they cover, with the live sound as the fallback — see "recorded files" below.
   Music has five moods (day, night, dungeon, title, combat) that crossfade into each other. It starts only after
   the first tap, is quiet by default, and fades out while the app is in the background.

   Built to stay clean on phones [OURS]:
   - every sound starts and ends at exactly zero volume (linear attack, smooth exponential release, stop after it),
     so there are no clicks or pops;
   - one master chain: gentle low-pass → compressor → limiter, so many sounds at once never clip;
   - one short shared reverb and fixed send buses instead of a reverb send per note; cached noise and distortion
     curves; a cap on how many voices play at once — few audio nodes, little CPU;
   - a look-ahead music scheduler that skips (rather than bunches up) notes after a stall;
   - a minimum gap per sound effect, so twelve coins in a row sound like a jingle, not a buzz.
   Music: modal and Nordic — Dorian/Aeolian/Phrygian, slow string pads over a low drone, a short motif that comes
   back with variations, the odd horn call or choir; combat adds war drums. */
const SOUND = (() => {
  const KEY = "rotn_sound";
  let cfg = { music: 0.35, sfx: 0.6, amb: 0.5, mute: false };
  try { Object.assign(cfg, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { /* storage blocked */ }
  const saveCfg = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* ignore */ } };

  let ctx = null, out, master, musicBus, sfxBus, ambBus, verbIn, sends = {}, noiseBuf = null, gritCache = {};
  const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
  const rnd = (a, b) => a + Math.random() * (b - a), pick = (a) => a[Math.floor(Math.random() * a.length)];

  // ------------------------------------------------------------ the chain: buses → master → tone → compressor → limiter
  function init(ac) {
    if (ctx) return true;
    const AC = ac || window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = typeof AC === "function" && !ac ? new AC({ latencyHint: "playback" }) : new AC(); } catch (e) { try { ctx = new AC(); } catch (e2) { return false; } }
    const tone = ctx.createBiquadFilter(); tone.type = "lowpass"; tone.frequency.value = 9000; tone.Q.value = 0.5;   // takes the fizz off saws and noise
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.knee.value = 12; comp.ratio.value = 3.5; comp.attack.value = 0.006; comp.release.value = 0.25;
    // the limiter: straight up to 0.7, then a soft knee that can never pass 0.91 (a curve is far cheaper than a 2nd compressor)
    const lim = ctx.createWaveShaper(), n = 2049, cv = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i - 1024) / 1024, ax = Math.abs(x); cv[i] = Math.sign(x) * (ax < 0.7 ? ax : 0.7 + 0.25 * Math.tanh((ax - 0.7) / 0.25)); }
    lim.curve = cv;
    master = ctx.createGain(); master.gain.value = 0;
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 55; hp.Q.value = 0.6;   // phone speakers can't play sub-bass; it only makes the compressor pump
    master.connect(hp); hp.connect(tone); tone.connect(comp); comp.connect(lim); lim.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0; sfxBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = 0; ambBus.connect(master);   // the world around you: wind, rain, towns, caves, footsteps
    // one short, soft hall: 1.4 s, mono (a third of the old reverb's CPU), filtered noise faded in so it never clicks
    const verb = ctx.createConvolver(), sr = ctx.sampleRate, len = Math.round(sr * 1.4), ir = ctx.createBuffer(1, len, sr);
    for (let c = 0; c < 1; c++) {
      const d = ir.getChannelData(c); let lp = 0, mean = 0;
      for (let i = 0; i < len; i++) { lp += 0.35 * ((Math.random() * 2 - 1) - lp); d[i] = lp; mean += lp; }
      mean /= len;
      for (let i = 0; i < len; i++) { const fadeIn = Math.min(1, i / (sr * 0.008)); d[i] = (d[i] - mean) * fadeIn * Math.pow(1 - i / len, 3) * 1.6; }
    }
    verb.buffer = ir; verb.normalize = true;
    verbIn = ctx.createGain(); verbIn.gain.value = 0.5; verbIn.connect(verb); verb.connect(master);
    // fixed send buses for effects: dry, a little, some, a lot of reverb
    for (const [k, w] of [["dry", 0], ["lo", 0.15], ["mid", 0.35], ["hi", 0.65]]) {
      const g = ctx.createGain(); g.connect(sfxBus);
      if (w) { const s = ctx.createGain(); s.gain.value = w; g.connect(s); s.connect(verbIn); }
      sends[k] = g;
    }
    // two seconds of white noise, made once
    noiseBuf = ctx.createBuffer(1, sr * 2, sr);
    const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    applyVolume(true);
    return true;
  }
  function applyVolume(now = false) {
    if (!ctx) return;
    const t = ctx.currentTime, k = now ? 0.01 : 0.08;
    master.gain.setTargetAtTime(cfg.mute || hidden ? 0 : 1, t, k);
    musicBus.gain.setTargetAtTime(Math.pow(cfg.music, 1.3) * 0.9, t, 0.25);
    sfxBus.gain.setTargetAtTime(Math.pow(cfg.sfx, 1.3) * 1.1, t, k);
    ambBus.gain.setTargetAtTime(Math.pow(cfg.amb ?? 0.5, 1.3) * AMB_LEVEL, t, 0.3);
    for (const T of Object.values(tracks)) if (!T.routed && T === curTrack) T.el.volume = elVol();   // loops the WebView couldn't route
  }

  // ------------------------------------------------------------ voices (each one starts and ends at exactly zero)
  const voices = { music: [], sfx: [], amb: [] }, CAP = { music: 26, sfx: 32, amb: 16 };
  let fxScale = 1;   // per-effect loudness trim, set while an effect is being built
  function room(kind, t, end) {   // keep count of what will be sounding at the same time; refuse when full
    const v = voices[kind], now = ctx.currentTime;
    for (let i = v.length - 1; i >= 0; i--) if (v[i][1] < now) v.splice(i, 1);
    let n = 0; for (const [a, b] of v) if (a < end && b > t) n++;
    if (n >= CAP[kind]) return false;
    v.push([t, end]); return true;
  }
  /* attack a, hold h, then fade with time-constant r; returns the stop time */
  function envelope(p, t, peak, a, h, r) {
    p.setValueAtTime(0, t); p.linearRampToValueAtTime(peak, t + a);
    if (h > 0) p.setValueAtTime(peak, t + a + h);
    p.setTargetAtTime(0, t + a + Math.max(0, h), r);
    return t + a + Math.max(0, h) + r * 7;   // ~ -60 dB: silent enough to stop
  }
  function gainNode(dest) { const g = ctx.createGain(); g.gain.value = 0; g.connect(dest); return g; }
  /* one oscillator note into dest (a bus or a send). glide: end pitch ratio */
  function osc(freq, t, { type = "sine", vol = 0.2, a = 0.01, h = 0, r = 0.1, dest, cut = 0, q = 0.7, glide = 0, det = 0, kind = "sfx", vibrato = null } = {}) {
    const end = t + a + h + r * 7;
    if (!room(kind, t, end)) return;
    if (kind === "sfx") vol *= fxScale;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); if (det) o.detune.value = det;
    if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * glide), t + a + h + r * 2);
    if (vibrato) vibrato.connect(o.detune);
    const g = gainNode(dest);
    if (cut) { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = Math.min(cut, ctx.sampleRate / 2.2); f.Q.value = q; o.connect(f); f.connect(g); } else o.connect(g);
    envelope(g.gain, t, vol, a, h, r);
    o.start(t); o.stop(end + 0.02);
    return { o, g };
  }
  function noise(t, { type = "bandpass", freq = 1000, q = 1, vol = 0.3, a = 0.004, h = 0, r = 0.05, dest, sweep = 0, kind = "sfx" } = {}) {
    const end = t + a + h + r * 7;
    if (!room(kind, t, end)) return;
    if (kind === "sfx") vol *= fxScale;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = gainNode(dest);
    s.buffer = noiseBuf; s.loop = true; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(30, Math.min(ctx.sampleRate / 2.2, freq * sweep)), t + a + h + r * 3);
    s.connect(f); f.connect(g); envelope(g.gain, t, vol, a, h, r);
    s.start(t, Math.random() * 1.5); s.stop(end + 0.02);
  }
  function grit(amount) {   // soft clipping; odd length so silence stays exactly silent
    if (!gritCache[amount]) { const n = 1025, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i - 512) / 512; c[i] = (1 + amount) * x / (1 + amount * Math.abs(x)); } gritCache[amount] = c; }
    const ws = ctx.createWaveShaper(); ws.curve = gritCache[amount]; ws.oversample = "2x"; return ws;
  }

  // ------------------------------------------------------------ music: moods, layers, the composer
  const DORIAN = [0, 2, 3, 5, 7, 9, 10], AEOLIAN = [0, 2, 3, 5, 7, 8, 10], PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
  const MOODS = {
    //        root  scale     beat  chords (scale degrees, 2 bars each)  lead voice         motif density  extras
    day:     { root: 50, scale: DORIAN, beat: 0.8, chords: [0, 6, 3, 0, 4, 6, 3, 0], lead: "flute", alt: "pluck", reg: 12, dens: 0.7, cut: 1400, drone: 0.12, pad: 0.05, wet: 0.35, horn: 0.15 },
    night:   { root: 45, scale: AEOLIAN, beat: 1.05, chords: [0, 5, 2, 6, 0, 3, 5, 6], lead: "pluck", alt: "bell", reg: 12, dens: 0.45, cut: 900, drone: 0.11, pad: 0.05, wet: 0.5, horn: 0 },
    dungeon: { root: 38, scale: PHRYGIAN, beat: 1.3, chords: [0, 1, 0, 6, 0, 1, 5, 0], lead: "bell", alt: "bell", reg: 24, dens: 0.25, cut: 600, drone: 0.16, pad: 0.035, wet: 0.65, horn: 0, drips: true },
    title:   { root: 38, scale: AEOLIAN, beat: 0.95, chords: [0, 5, 6, 0, 3, 5, 6, 4], lead: "choir", alt: "horn", reg: 12, dens: 0.75, cut: 1100, drone: 0.15, pad: 0.05, wet: 0.55, horn: 0.35, drums: "slow" },
    combat:  { root: 38, scale: AEOLIAN, beat: 0.45, chords: [0, 0, 5, 6, 0, 0, 3, 4], lead: "strings", alt: "horn", reg: 12, dens: 0.8, cut: 1700, drone: 0.13, pad: 0.04, wet: 0.3, horn: 0.25, drums: "war" },
  };
  let mood = "day", wantMood = "day", layer = null, playing = false, timer = null;
  let beat = 0, nextBeat = 0, chordIx = 0, queue = [], motif = null, motifUses = 0, restBars = 0;

  function makeLayer(m) {
    const M = MOODS[m], t = ctx.currentTime;
    const L = { mood: m, gain: ctx.createGain(), padF: ctx.createBiquadFilter(), oscs: [], born: t };
    L.gain.gain.value = 0; L.gain.connect(musicBus);
    const send = ctx.createGain(); send.gain.value = M.wet; L.gain.connect(send); send.connect(verbIn);
    L.padF.type = "lowpass"; L.padF.frequency.value = M.cut; L.padF.Q.value = 0.6; L.padF.connect(L.gain);
    // a shared, slow vibrato for the flute and strings (in cents, so one LFO serves every note)
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 4.8; lg.gain.value = 9; lfo.connect(lg); L.vib = lg;
    // filter "breathing" on the pads
    const flfo = ctx.createOscillator(), fg = ctx.createGain(); flfo.frequency.value = 0.06; fg.gain.value = M.cut * 0.25; flfo.connect(fg); fg.connect(L.padF.frequency);
    // the drone: low root and fifth, soft waves only
    L.droneG = ctx.createGain(); L.droneG.gain.value = 0; L.droneG.connect(L.gain);
    const df = ctx.createBiquadFilter(); df.type = "lowpass"; df.frequency.value = 600; df.connect(L.droneG);
    L.drones = [[0, "triangle", 0.55], [7, "sine", 0.35], [12, "sine", 0.25]].map(([iv, type, v]) => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; g.gain.value = v; o.connect(g); g.connect(df);
      o.frequency.value = hz(droneRoot(M) + iv); o.start(t); return { o, iv };
    });
    L.droneG.gain.setTargetAtTime(M.drone * 0.6, t, 1.2);
    lfo.start(t); flfo.start(t);
    L.oscs = [...L.drones.map((d) => d.o), lfo, flfo];
    L.gain.gain.setTargetAtTime(1, t, 0.7);
    return L;
  }
  function dropLayer(L, quick = false) {
    if (!L) return;
    const t = ctx.currentTime;
    L.gain.gain.cancelScheduledValues(t); L.gain.gain.setValueAtTime(L.gain.gain.value, t); L.gain.gain.setTargetAtTime(0, t, quick ? 0.15 : 0.7);
    L.oscs.forEach((o) => { try { o.stop(t + (quick ? 1.5 : 5)); } catch (e) { /* already stopped */ } });
  }
  const droneRoot = (M) => (M.root < 45 ? M.root + 12 : M.root);   // keep the drone above ~70 Hz so phone speakers can play it
  const degHz = (M, deg, oct = 0) => { const n = M.scale.length, o = Math.floor(deg / n), d = ((deg % n) + n) % n; return hz(M.root + M.reg + oct + M.scale[d] + 12 * o); };

  // instruments (all into the current layer)
  function play(inst, freq, t, len, vol = 1) {
    const L = layer, kind = "music";
    if (!L) return;
    if (inst === "flute") {
      osc(freq, t, { type: "triangle", vol: 0.09 * vol, a: 0.09, h: len * 0.75, r: 0.18, dest: L.gain, kind, vibrato: L.vib });
      osc(freq * 2, t, { type: "sine", vol: 0.014 * vol, a: 0.12, h: len * 0.5, r: 0.15, dest: L.gain, kind });
    } else if (inst === "pluck") {
      osc(freq, t, { type: "triangle", vol: 0.11 * vol, a: 0.004, h: 0, r: 0.45, dest: L.gain, kind });
      osc(freq * 2, t, { type: "sine", vol: 0.03 * vol, a: 0.003, h: 0, r: 0.2, dest: L.gain, kind });
    } else if (inst === "bell") {
      osc(freq, t, { type: "sine", vol: 0.08 * vol, a: 0.004, h: 0, r: 0.9, dest: L.gain, kind });
      osc(freq * 2.76, t, { type: "sine", vol: 0.014 * vol, a: 0.003, h: 0, r: 0.35, dest: L.gain, kind });
    } else if (inst === "strings") {
      osc(freq, t, { type: "sawtooth", vol: 0.05 * vol, a: 0.03, h: len * 0.6, r: 0.12, dest: L.padF, kind, vibrato: L.vib });
    } else if (inst === "horn") {   // a far-off war horn: soft saw, filter opening during the swell
      if (!room(kind, t, t + len + 1.5)) return;
      const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = gainNode(L.gain);
      o.type = "sawtooth"; o.frequency.value = freq; f.type = "lowpass"; f.Q.value = 1.2;
      f.frequency.setValueAtTime(350, t); f.frequency.linearRampToValueAtTime(1000, t + 0.6); f.frequency.setTargetAtTime(500, t + 0.8, 0.6);
      o.connect(f); f.connect(g); const end = envelope(g.gain, t, 0.07 * vol, 0.45, len * 0.8, 0.35);
      o.start(t); o.stop(end + 0.02);
    } else if (inst === "choir") {   // a low male chant: detuned saw through two vowel formants
      if (!room(kind, t, t + len + 1.5)) return;
      const g = gainNode(L.gain), end = t + 0.6 + len * 0.85 + 0.45 * 7;
      const f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(); f1.type = f2.type = "bandpass";
      const vowel = pick([[600, 1000], [400, 800], [500, 900]]); f1.frequency.value = vowel[0]; f1.Q.value = 5; f2.frequency.value = vowel[1]; f2.Q.value = 6;
      f1.connect(g); f2.connect(g);
      [-8, 8].forEach((det) => { const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = freq; o.detune.value = det; o.connect(f1); o.connect(f2); o.start(t); o.stop(end + 0.02); });
      envelope(g.gain, t, 0.12 * vol, 0.6, len * 0.85, 0.45);
    }
  }
  function pad(degs, t, len) {   // a string chord: two detuned saws per note, slow swell, through the layer's filter
    const M = MOODS[mood];
    for (const d of degs) {
      const n = M.scale.length, f = hz(M.root + 12 + M.scale[((d % n) + n) % n] + 12 * Math.floor(d / n));   // pads around 150–400 Hz
      for (const det of [-7, 6]) osc(f, t, { type: "sawtooth", vol: M.pad, a: 1.4, h: len - 1.2, r: 0.7, dest: layer.padF, det, kind: "music" });
    }
  }
  function drum(t, vol, f0, dest) {   // frame drum / war drum: a falling sine thump and a soft skin noise
    osc(f0, t, { type: "sine", vol, a: 0.003, h: 0.02, r: 0.12, dest, glide: 0.55, kind: "music" });
    if (vol > 0.2) noise(t, { type: "lowpass", freq: 900, q: 0.5, vol: vol * 0.25, a: 0.002, r: 0.03, dest, kind: "music" });   // skin noise on the accents only
  }
  // the composer: a short motif per section that comes back moved up or down, with rests in between
  function newMotif(M) {
    const n = 3 + Math.floor(Math.random() * 3), notes = []; let d = pick([0, 2, 4, 4, 7]);
    const rhythm = pick([[1, 1, 2], [2, 1, 1], [1, 1, 1, 1], [1.5, 0.5, 2], [1, 2, 1], [3, 1]]);
    for (let i = 0; i < n; i++) { notes.push({ d, len: rhythm[i % rhythm.length] }); d += pick([-2, -1, -1, 1, 1, 2, 0]); d = Math.max(-2, Math.min(9, d)); }
    notes[notes.length - 1].len = Math.max(2, notes[notes.length - 1].len);   // phrases end on a held note
    return notes;
  }
  function planPhrase(M, startBeat) {
    if (!motif || motifUses >= 4) { motif = newMotif(M); motifUses = 0; }
    const shift = [0, pick([1, -1, 2]), 0, pick([-2, 3])][motifUses]; motifUses++;
    const inst = Math.random() < 0.8 ? M.lead : M.alt;
    let b = startBeat;
    const chordTones = (() => { const c = M.chords[chordIx]; return [c, c + 2, c + 4, c + 7]; })();
    for (const [i, n] of motif.entries()) {
      let d = n.d + shift;
      if (i === 0 || i === motif.length - 1) d = chordTones.reduce((best, x) => (Math.abs(x - d) < Math.abs(best - d) ? x : best), chordTones[0]);   // start and end on the chord
      queue.push({ beat: b, d, len: n.len, inst });
      b += n.len;
    }
    return b;
  }
  function scheduleBeat(t) {
    const M = MOODS[mood];
    // new chord every 2 bars
    if (beat % 8 === 0) {
      chordIx = (beat / 8) % M.chords.length;
      const c = M.chords[chordIx];
      pad([c, c + 2, c + 4], t, M.beat * 8 + 0.6);
      const n = M.scale.length, rootSemi = M.scale[((c % n) + n) % n];
      layer.drones.forEach(({ o, iv }) => o.frequency.setTargetAtTime(hz(droneRoot(M) + iv + (rootSemi > 6 ? rootSemi - 12 : rootSemi)), t, 0.9));
      if (M.horn && Math.random() < M.horn) { const n2 = M.scale.length; play("horn", hz(M.root + 12 + M.scale[((c % n2) + n2) % n2]), t + M.beat * 2, M.beat * 3, 0.9); }
    }
    // the melody
    if (!queue.length && beat % 4 === 0) {
      if (restBars > 0) restBars--;
      else if (Math.random() < M.dens) { planPhrase(M, beat); restBars = Math.random() < 0.5 ? 1 : 2; }
    }
    while (queue.length && queue[0].beat <= beat + 0.75) {
      const n = queue.shift(), off = (n.beat - beat) * M.beat;
      play(n.inst, degHz(M, n.d), t + Math.max(0, off), n.len * M.beat, 1);
    }
    // percussion
    if (M.drums === "war") {
      const pat = [1, 0, 0.45, 0, 0.8, 0, 0.45, 0.3][beat % 8];
      if (pat) drum(t, 0.32 * pat, beat % 4 === 0 ? 120 : 165, layer.gain);
      if (beat % 16 === 15 && Math.random() < 0.6) drum(t + M.beat / 2, 0.18, 190, layer.gain);
    } else if (M.drums === "slow") {
      if (beat % 4 === 0) drum(t, 0.3, 105, layer.gain); else if (beat % 8 === 6) drum(t, 0.16, 135, layer.gain);
    }
    if (M.drips && Math.random() < 0.07) noise(t + rnd(0, M.beat), { type: "bandpass", freq: rnd(2200, 3600), q: 22, vol: 0.06, a: 0.002, r: 0.03, dest: layer.gain, kind: "music" });
    beat++;
  }
  const LOOKAHEAD = 0.6, TICK = 90;
  function step() {
    if (!ctx || !playing || !layer) return;
    const now = ctx.currentTime;
    if (nextBeat < now - 0.05) { nextBeat = now + 0.05; queue = []; }   // the app stalled: skip, don't bunch notes up
    while (nextBeat < now + LOOKAHEAD) { scheduleBeat(nextBeat); nextBeat += MOODS[mood].beat; }
  }
  function startMusic() {
    if (!ctx || playing) return;
    playing = true; layer = makeLayer(mood); beat = 0; chordIx = 0; queue = []; motif = null; restBars = 1;
    nextBeat = ctx.currentTime + 0.2;
    if (!timer && typeof setInterval !== "undefined") timer = setInterval(step, TICK);
    step();
  }
  function stopMusic() {
    playing = false; if (timer) { clearInterval(timer); timer = null; }
    dropLayer(layer); layer = null; queue = [];
  }
  function switchMood(m) {
    if (!MOODS[m]) return;
    mood = m;
    if (!ctx || !playing) return;
    dropLayer(layer, ctx.currentTime - layer.born < 1.5); layer = makeLayer(m);   // flicking between moods: clear the short-lived ones fast
    queue = []; motif = null; motifUses = 0; restBars = 0;
    beat = Math.ceil(beat / 8) * 8;   // start the new mood on a fresh chord
    nextBeat = Math.max(nextBeat, ctx.currentTime + 0.15);
  }

  // ------------------------------------------------------------ effects (loudness roughly matched)
  const S = () => sends;
  const FX = {
    click(t) { noise(t, { type: "bandpass", freq: 3200, q: 2.5, vol: 0.16, a: 0.001, r: 0.008, dest: S().dry }); osc(1500, t, { vol: 0.05, a: 0.001, r: 0.012, dest: S().dry }); },
    page(t) { noise(t, { type: "bandpass", freq: 3800, q: 0.8, vol: 0.12, a: 0.02, h: 0.04, r: 0.03, sweep: 0.6, dest: S().dry }); },
    hit(t) {
      noise(t, { type: "bandpass", freq: rnd(1100, 1700), q: 1.3, vol: 0.45, a: 0.002, r: 0.03, dest: S().lo });
      osc(110, t, { vol: 0.55, a: 0.003, h: 0.02, r: 0.05, glide: 0.45, dest: S().lo });
    },
    clang(t) {
      [1900, 2650, 3720, 5100].forEach((f, i) => osc(f * rnd(0.97, 1.03), t, { vol: [0.06, 0.045, 0.03, 0.015][i], a: 0.001, r: 0.12 - i * 0.02, dest: S().mid }));
      noise(t, { type: "highpass", freq: 2500, vol: 0.12, a: 0.001, r: 0.012, dest: S().mid });
    },
    swing(t) { noise(t, { type: "bandpass", freq: 500, q: 2, vol: 0.2, a: 0.07, h: 0.02, r: 0.04, sweep: 5, dest: S().lo }); },
    spell(t) {
      noise(t, { type: "bandpass", freq: 400, q: 3, vol: 0.22, a: 0.08, h: 0.2, r: 0.08, sweep: 6, dest: S().mid });
      osc(330, t, { type: "triangle", vol: 0.07, a: 0.05, h: 0.25, r: 0.1, glide: 2, dest: S().mid });
      osc(495, t + 0.05, { vol: 0.04, a: 0.05, h: 0.2, r: 0.1, glide: 2, dest: S().hi });
    },
    coin(t) { for (let i = 0; i < 3; i++) { const f = rnd(2000, 3200), tt = t + i * 0.055 + rnd(0, 0.015); osc(f, tt, { vol: 0.05, a: 0.001, r: 0.06, dest: S().lo }); osc(f * 1.5, tt, { vol: 0.015, a: 0.001, r: 0.03, dest: S().lo }); } },
    levelup(t) {
      [62, 65, 69, 74, 77].forEach((n, i) => osc(hz(n), t + i * 0.11, { type: "triangle", vol: 0.1, a: 0.01, h: 0.15, r: 0.35, dest: S().hi }));
      osc(hz(86), t + 0.55, { vol: 0.035, a: 0.02, h: 0.3, r: 0.4, dest: S().hi });
    },
    quest(t) { [74, 81, 86].forEach((n, i) => osc(hz(n), t + i * 0.18, { vol: 0.09, a: 0.004, h: 0.05, r: 0.4, dest: S().hi })); },
    arrive(t) {
      osc(hz(57), t, { type: "sawtooth", vol: 0.07, a: 0.15, h: 0.2, r: 0.12, cut: 900, dest: S().mid });
      osc(hz(62), t + 0.42, { type: "sawtooth", vol: 0.08, a: 0.18, h: 0.45, r: 0.25, cut: 1000, dest: S().hi });
    },
    victory(t) { [[62, 0, 0.12], [69, 0.16, 0.12], [74, 0.32, 0.6]].forEach(([n, d, h]) => osc(hz(n), t + d, { type: "sawtooth", vol: 0.07, a: 0.03, h, r: h > 0.3 ? 0.3 : 0.06, cut: 1600, dest: S().mid })); },
    death(t) {
      osc(hz(38), t, { type: "sawtooth", vol: 0.12, a: 0.3, h: 1.2, r: 0.5, cut: 500, glide: 0.7, dest: S().hi });
      osc(hz(45), t + 0.2, { type: "sawtooth", vol: 0.07, a: 0.4, h: 1.0, r: 0.5, cut: 400, glide: 0.7, dest: S().hi });
    },
    chat(t) { osc(hz(81), t, { vol: 0.07, a: 0.004, r: 0.07, dest: S().lo }); osc(hz(86), t + 0.09, { vol: 0.06, a: 0.004, r: 0.1, dest: S().mid }); },
    potion(t) { for (let i = 0; i < 4; i++) osc(500 + i * 120 + rnd(0, 60), t + i * 0.07, { vol: 0.08, a: 0.004, h: 0.02, r: 0.025, glide: 1.8, dest: S().lo }); },
    shout(t) {   // the Voice: a deep, gritty blast and a rush of air
      if (!room("sfx", t, t + 1.8)) return;
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), ws = grit(25), f = ctx.createBiquadFilter(), g = gainNode(S().hi);
      o.type = "sawtooth"; o2.type = "triangle";
      o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(48, t + 1.1);
      o2.frequency.setValueAtTime(61, t); o2.frequency.exponentialRampToValueAtTime(30, t + 1.1);
      f.type = "lowpass"; f.frequency.setValueAtTime(2000, t); f.frequency.exponentialRampToValueAtTime(300, t + 1.1);
      const pre = ctx.createGain(); pre.gain.value = 0.6; o.connect(pre); o2.connect(pre); pre.connect(ws); ws.connect(f); f.connect(g);
      const end = envelope(g.gain, t, 0.2 * fxScale, 0.02, 0.75, 0.1);
      o.start(t); o2.start(t); o.stop(end + 0.02); o2.stop(end + 0.02);
      noise(t, { type: "lowpass", freq: 3000, vol: 0.28, a: 0.02, h: 0.5, r: 0.15, sweep: 0.1, dest: S().hi });
    },
    dragon(t) {   // a roar: rough low tone, wobbling, through a sweeping filter
      if (!room("sfx", t, t + 2.8)) return;
      const o = ctx.createOscillator(), l = ctx.createOscillator(), lg = ctx.createGain(), ws = grit(40), f = ctx.createBiquadFilter(), g = gainNode(S().hi);
      o.type = "sawtooth"; o.frequency.setValueAtTime(70, t); o.frequency.linearRampToValueAtTime(110, t + 0.5); o.frequency.exponentialRampToValueAtTime(45, t + 2.2);
      l.frequency.value = 23; lg.gain.value = 25; l.connect(lg); lg.connect(o.frequency);
      f.type = "bandpass"; f.Q.value = 1.2; f.frequency.setValueAtTime(300, t); f.frequency.linearRampToValueAtTime(900, t + 0.5); f.frequency.exponentialRampToValueAtTime(160, t + 2.2);
      const pre = ctx.createGain(); pre.gain.value = 0.6; o.connect(pre); pre.connect(ws); ws.connect(f); f.connect(g);
      const end = envelope(g.gain, t, 0.45 * fxScale, 0.25, 1.5, 0.12);
      o.start(t); l.start(t); o.stop(end + 0.02); l.stop(end + 0.02);
      noise(t + 0.1, { type: "bandpass", freq: 700, q: 0.8, vol: 0.2, a: 0.3, h: 1.2, r: 0.15, sweep: 0.3, dest: S().hi });
    },
  };
  // the shortest gap between two of the same effect (seconds); closer calls are dropped
  const GAP = { click: 0.045, page: 0.08, hit: 0.06, clang: 0.08, swing: 0.06, spell: 0.12, coin: 0.12, levelup: 1, quest: 0.6, arrive: 0.8, victory: 0.8, death: 1.5, chat: 0.25, potion: 0.3, shout: 1, dragon: 1.5 };
  // loudness trims, measured offline so effects sit together: interface ticks quiet, blows medium, big moments louder
  const TRIM = { click: 1.7, page: 0.7, chat: 1.7, hit: 0.55, clang: 2.2, swing: 3.9, spell: 1.45, coin: 1.95, potion: 1.5, levelup: 1, quest: 1.25, arrive: 2.05, victory: 1.9, death: 0.87, shout: 0.72, dragon: 1 };
  const lastAt = {};
  /* "spell-fire" → ["spell-fire", "spell"]: a specific name falls back to its general one */
  function chain(name) { const out = []; let n = name; while (n) { out.push(n); const i = n.lastIndexOf("-"); n = i > 0 ? n.slice(0, i) : ""; } return out; }
  function fire(name, t) {
    const ch = chain(name), base = ch.find((n) => FX[n]);
    if (lastAt[name] != null && Math.abs(t - lastAt[name]) < (GAP[name] || GAP[base] || 0.05)) return false;
    const rec = ch.find((n) => sfxBuf[n]?.length);
    if (!rec && !base) return false;
    lastAt[name] = t;
    if (rec) { try { playFile(rec, t, base || rec); } catch (e) { /* never break the game for a sound */ } return true; }
    fxScale = TRIM[base] || 1;
    try { FX[base](t); } catch (e) { /* never break the game for a sound */ }
    fxScale = 1;
    return true;
  }

  // ------------------------------------------------------------ recorded files (optional; the code above is the fallback)
  /* Files sit flat next to index.html and are listed in audio.json (a plain JSON array of file names), so a missing
     file never costs a request. No audio.json → everything stays procedural, exactly as before.
       sfx-<name>.mp3, sfx-<name>-2.mp3 …  an effect (numbered files are random variants). <name> is any SOUND.fx name;
                                           a longer name like "hit-axe" or "spell-fire" falls back to "hit" / "spell".
       amb-<event>.mp3                     replaces an ambience one-shot (wolf, owl, thunder, …); amb-step-<ground>.mp3
                                           replaces footsteps (snow, grass, stone, marsh, hoof).
       mus-<track>.mp3                     a music loop: title, town, inn, dungeon, combat, boss, night, explore, or a
                                           region: tundra pineforest snowfield marsh reach rift hotsprings coast ashlands.
     Effects are decoded once into memory (they're short); music streams from an <audio> element routed into the
     music bus, so the volume sliders, mute and the background fade all still apply. Under browser automation nothing
     is fetched unless the URL has ?audio (keeps screen tests quiet). */
  const FILE_VOL = { click: 0.3, page: 0.35, chat: 0.35, coin: 0.4, potion: 0.45, swing: 0.45, hit: 0.55, clang: 0.5, equip: 0.45,
    spell: 0.5, levelup: 0.5, quest: 0.5, arrive: 0.5, victory: 0.55, death: 0.55, shout: 0.65, dragon: 0.65 };
  const FILE_SEND = { hit: "lo", clang: "lo", swing: "lo", spell: "lo", shout: "lo", dragon: "lo" };   // recordings carry their own room; UI stays dry
  const MUS_FILE_VOL = 0.6;
  const REGION = { Whiterun: "tundra", Falkreath: "pineforest", "The Pale": "snowfield", Winterhold: "snowfield", Hjaalmarch: "marsh",
    "The Reach": "reach", "The Rift": "rift", Eastmarch: "hotsprings", Haafingar: "coast", Solstheim: "ashlands" };
  const sfxBuf = {}, musFile = {}, tracks = {}, badTrack = {};
  let filesAsked = false, filesReady = false, curTrack = null, lastSync = 0;
  function decode(ab) {   // both the old callback form (older WebViews) and the promise form
    return new Promise((res, rej) => { try { const p = ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); } catch (e) { rej(e); } });
  }
  function loadFiles() {
    if (filesAsked) return;
    filesAsked = true;
    let auto = true;
    try { auto = !(navigator.webdriver && !/[?&]audio\b/.test(location.search)); } catch (e) { /* no navigator */ }
    if (!auto || typeof fetch === "undefined") { filesReady = true; return; }
    const done = () => { if (!filesReady) { filesReady = true; syncMusic(); } };
    setTimeout(done, 2500);   // never hold the music back for long
    fetch("audio.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : [])).then((list) => {
      for (const f of Array.isArray(list) ? list : []) {
        const m = typeof f === "string" && f.match(/^(sfx|amb|mus)-([a-z0-9-]+?)(?:-(\d+))?\.(mp3|ogg|m4a)$/);
        if (!m) continue;
        if (m[1] === "mus") { musFile[m[2] + (m[3] ? "-" + m[3] : "")] = f; continue; }
        const key = (m[1] === "amb" ? "amb-" : "") + m[2];
        fetch(f).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(f)))).then(decode).then((b) => { (sfxBuf[key] ||= []).push(b); }).catch(() => { /* that file stays procedural */ });
      }
    }).catch(() => { /* no list: all procedural */ }).then(done);
  }
  /* play a decoded recording; base = the effect it stands in for (loudness, reverb) */
  function playFile(name, t, base, dest) {
    const list = sfxBuf[name], b = list[Math.floor(Math.random() * list.length)];
    if (!room(dest ? "amb" : "sfx", t, t + b.duration)) return;
    const s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = b;
    if (/^(hit|clang|swing|click|coin|amb-step)/.test(name)) s.playbackRate.value = rnd(0.95, 1.05);   // a little life in repeated sounds
    g.gain.value = dest ? 0.5 : FILE_VOL[base] ?? 0.5;
    s.connect(g); g.connect(dest || sends[FILE_SEND[base] || "dry"]);
    s.onended = () => { try { g.disconnect(); } catch (e) { /* ignore */ } };
    s.start(t);
  }
  function saveNow() { try { return window.__dbg?.save?.() || null; } catch (e) { return null; } }
  function region() {
    const s = saveNow(); if (!s || typeof G === "undefined" || !G.holdAt) return null;
    try { return REGION[G.holdAt([s.x, s.y])] || null; } catch (e) { return null; }
  }
  /* which loops suit the moment, best first */
  function wantedTracks() {
    const m = wantMood, sc = ambWant?.scene;
    if (m === "title") return ["title"];
    if (m === "combat") return [saveNow()?.dungeon?.room?.enemy?.boss ? "boss" : null, "combat"];
    if (m === "dungeon") return ["dungeon"];
    if (sc === "town" || sc === "forge") return ["town"];
    if (sc === "inn") return ["inn", "town"];
    const r = region();
    return m === "night" ? ["night", r, "explore"] : [r, "explore"];
  }
  const elVol = () => (cfg.mute || hidden ? 0 : Math.pow(cfg.music, 1.3) * 0.9 * MUS_FILE_VOL);
  function startTrack(key) {
    let T = tracks[key];
    if (!T) {
      const el = new Audio(); el.loop = true; el.preload = "auto"; el.src = musFile[key];
      T = { key, el, g: ctx.createGain(), routed: false, stopT: null };
      T.g.gain.value = 0; T.g.connect(musicBus);
      try { ctx.createMediaElementSource(el).connect(T.g); T.routed = true; } catch (e) { /* old WebView: plain element volume */ }
      el.addEventListener("error", () => { badTrack[key] = true; if (curTrack === T) { curTrack = null; syncMusic(); } });
      tracks[key] = T;
    }
    clearTimeout(T.stopT);
    const t = ctx.currentTime;
    T.g.gain.cancelScheduledValues(t); T.g.gain.setValueAtTime(T.g.gain.value, t); T.g.gain.setTargetAtTime(T.routed ? MUS_FILE_VOL : 1, t, 0.8);   // ~3 s crossfade
    if (!T.routed) T.el.volume = elVol();
    if (!hidden && T.el.paused) T.el.play()?.catch?.(() => { /* blocked until the next tap; unlock() retries */ });
    return T;
  }
  function fadeTrack(T) {
    const t = ctx.currentTime;
    T.g.gain.cancelScheduledValues(t); T.g.gain.setValueAtTime(T.g.gain.value, t); T.g.gain.setTargetAtTime(0, t, 0.7);
    if (!T.routed) T.el.volume = 0;
    clearTimeout(T.stopT); T.stopT = setTimeout(() => { if (curTrack !== T) T.el.pause(); }, 4500);
  }
  /* decides between a recorded loop and the procedural composer, and crossfades */
  function syncMusic() {
    if (!ctx || !unlocked) return;
    const on = !cfg.mute && cfg.music > 0;
    const key = on ? wantedTracks().find((k) => k && musFile[k] && !badTrack[k]) || null : null;
    if (key !== (curTrack ? curTrack.key : null)) {
      if (curTrack) fadeTrack(curTrack);
      curTrack = key ? startTrack(key) : null;
    }
    if (curTrack || !on) { if (playing) stopMusic(); } else if (!playing && filesReady) startMusic();
  }


  // ------------------------------------------------------------ ambience: the world around you ([OURS], all procedural)
  /* A few looping "beds" (filtered noise from the one shared buffer, a gain each, a slow wobble) that crossfade over
     ~2 s when the scene changes, plus sparse one-shot events (birds, drips, clangs, howls, footsteps) scheduled
     from a 250 ms timer and capped like other voices. Everything goes through ambBus → master → limiter. */
  const AMB_LEVEL = 0.55;   // the whole layer sits well under the music
  let ambWant = null, ambKey = "", ambTimer = null, nextStep = 0, stepFoot = 0;
  const beds = {};          // name → { g, nodes:[], target }
  const nextAt = {};        // event name → next time it may fire
  function lfo(freq, depth, dest) {   // a slow wobble on an AudioParam
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = freq; g.gain.value = depth; o.connect(g); g.connect(dest); o.start(); return o;
  }
  /* each bed: build(g) wires nodes into the bed's gain g and returns them (to stop later) */
  const BEDS = {
    wind(g, w) {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = w.cold ? 700 : 450; f.Q.value = 0.7;
      const gust = ctx.createGain(); gust.gain.value = 0.6; s.connect(f); f.connect(gust); gust.connect(g);
      const l1 = lfo(0.06 + Math.random() * 0.04, w.cold ? 260 : 180, f.frequency), l2 = lfo(0.11, 0.35, gust.gain);
      const nodes = [s, l1, l2];
      if (w.howl) {   // blizzard: a thin howling whistle on top
        const h = ctx.createBiquadFilter(); h.type = "bandpass"; h.frequency.value = 900; h.Q.value = 9; const hg = ctx.createGain(); hg.gain.value = 0.9;
        s.connect(h); h.connect(hg); hg.connect(g); nodes.push(lfo(0.09, 380, h.frequency), lfo(0.13, 0.6, hg.gain));
      }
      s.start(0, Math.random() * 1.5); return nodes;
    },
    rain(g) {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1400; const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 6500;
      s.connect(hp); hp.connect(lp); lp.connect(g); s.start(0, Math.random() * 1.5); return [s, lfo(0.05, 400, hp.frequency)];
    },
    water(g, w) {   // a river murmur, or the slow swell of the sea
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = w.sea ? 500 : 900; f.Q.value = 0.5;
      const amp = ctx.createGain(); amp.gain.value = 0.7; s.connect(f); f.connect(amp); amp.connect(g); s.start(0, Math.random() * 1.5);
      return [s, lfo(w.sea ? 0.09 : 0.3, w.sea ? 0.45 : 0.15, amp.gain), lfo(w.sea ? 0.09 : 0.2, 200, f.frequency)];
    },
    crowd(g, w) {   // the murmur of a town or a full inn: band-limited noise with a restless, speech-like wobble
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = w.inn ? 520 : 650; f.Q.value = 1.1;
      const f2 = ctx.createBiquadFilter(); f2.type = "lowpass"; f2.frequency.value = w.inn ? 1100 : 1600;
      const amp = ctx.createGain(); amp.gain.value = 0.6; s.connect(f); f.connect(f2); f2.connect(amp); amp.connect(g); s.start(0, Math.random() * 1.5);
      return [s, lfo(2.7, 0.18, amp.gain), lfo(4.3, 0.12, amp.gain), lfo(0.7, 180, f.frequency)];
    },
    hearth(g) {   // a low fire rumble (the pops are events)
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 380; s.connect(f); f.connect(g); s.start(0, Math.random() * 1.5);
      return [s, lfo(0.4, 60, f.frequency)];
    },
    cave(g, w) {   // a deep room tone: a soft hollow drone and a far-off rumble
      const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = 73.4;
      const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = 110.3;
      const og = ctx.createGain(); og.gain.value = 0.25; o.connect(og); o2.connect(og); og.connect(g);
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 220; s.connect(f); f.connect(g);
      o.start(); o2.start(); s.start(0, Math.random() * 1.5);
      const nodes = [o, o2, s, lfo(0.05, 0.12, og.gain)];
      if (w.dwemer) {   // steam in the pipes
        const h = ctx.createBufferSource(); h.buffer = noiseBuf; h.loop = true;
        const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 3200; const hg = ctx.createGain(); hg.gain.value = 0.18;
        h.connect(hp); hp.connect(hg); hg.connect(g); h.start(0, Math.random() * 1.5); nodes.push(h, lfo(0.17, 0.12, hg.gain));
      }
      return nodes;
    },
  };
  // how loud each bed sits (before ambBus), tuned offline so the layer stays even
  const BED_VOL = { wind: 0.5, rain: 0.07, water: 0.3, crowd: 0.3, hearth: 0.26, cave: 0.12 };
  function setBed(name, level, opts, keyExtra = "") {
    const id = name + keyExtra, b = beds[id], t = ctx.currentTime;
    if (level <= 0) { if (b && b.target > 0) { b.g.gain.setTargetAtTime(0, t, 0.6); b.target = 0; b.die = t + 4.5; } return; }
    const vol = BED_VOL[name] * level;
    if (b) { if (Math.abs(b.target - vol) > 0.001) { b.g.gain.setTargetAtTime(vol, t, 0.6); b.target = vol; b.die = 0; } return; }
    const g = ctx.createGain(); g.gain.value = 0; g.connect(ambBus);
    let nodes = [];
    try { nodes = BEDS[name](g, opts || {}); } catch (e) { return; }
    g.gain.setTargetAtTime(vol, t, 0.6);   // fades in over ~2 s
    beds[id] = { g, nodes, target: vol, die: 0, name };
  }
  function reapBeds() {
    const t = ctx.currentTime;
    for (const [id, b] of Object.entries(beds)) if (b.die && t > b.die) {
      for (const n of b.nodes) { try { n.stop(); } catch (e) { /* not started */ } try { n.disconnect(); } catch (e) { /* ignore */ } }
      try { b.g.disconnect(); } catch (e) { /* ignore */ }
      delete beds[id];
    }
  }
  /* one-shots: { every: mean seconds between, when: (w) => bool, play: (t, w) => {} } */
  const A = (f, t, o) => osc(f, t, { ...o, kind: "amb", dest: o.dest || ambBus });
  const N = (t, o) => noise(t, { ...o, kind: "amb", dest: o.dest || ambBus });
  const EVENTS = {
    bird: { every: 7, when: (w) => w.scene === "wild" && w.tod !== "night" && w.leafy && !w.wet,
      play(t) { const f = rnd(2600, 4200), n = 2 + Math.floor(Math.random() * 4); for (let i = 0; i < n; i++) A(f * rnd(0.92, 1.1), t + i * rnd(0.07, 0.12), { vol: 0.035, a: 0.006, r: 0.03, glide: rnd(1.15, 1.45) }); } },
    cricket: { every: 2.2, when: (w) => w.scene === "wild" && w.tod === "night" && !w.coldLand && !w.wet,
      play(t) { const f = rnd(4300, 5200); for (let i = 0; i < 3; i++) A(f, t + i * 0.045, { vol: 0.012, a: 0.003, r: 0.008 }); } },
    owl: { every: 45, when: (w) => w.scene === "wild" && w.tod === "night" && w.leafy,
      play(t) { [0, 0.55, 0.85].forEach((d, i) => A(i === 0 ? 420 : 395, t + d, { vol: 0.05, a: 0.04, h: 0.12, r: 0.08, glide: 0.92, cut: 1200 })); } },
    wolf: { every: 110, when: (w) => w.scene === "wild" && w.tod === "night",
      play(t) { A(rnd(440, 520), t, { type: "triangle", vol: 0.04, a: 0.5, h: 1.4, r: 0.6, glide: 0.75, cut: 1400, dest: sends.hi || ambBus }); } },
    thunder: { every: 22, when: (w) => w.weather === "storm",
      play(t) { N(t, { type: "lowpass", freq: 260, vol: 0.5, a: 0.3, h: 1.2, r: 0.9, sweep: 0.5 }); N(t + 0.05, { type: "lowpass", freq: 900, vol: 0.18, a: 0.01, h: 0.15, r: 0.2 }); } },
    hammer: { every: 6, when: (w) => w.scene === "town",
      play(t) { const n = 2 + Math.floor(Math.random() * 2); for (let i = 0; i < n; i++) { [1700, 2400, 3300].forEach((f, k) => A(f * rnd(0.98, 1.02), t + i * 0.42, { vol: [0.022, 0.014, 0.008][k], a: 0.001, r: 0.09, cut: 3500, dest: sends.mid || ambBus })); } } },
    clink: { every: 5, when: (w) => w.scene === "inn",
      play(t) { const f = rnd(2300, 2900); A(f, t, { vol: 0.03, a: 0.001, r: 0.05 }); A(f * 1.37, t + 0.01, { vol: 0.016, a: 0.001, r: 0.04 }); } },
    crackle: { every: 0.6, when: (w) => w.scene === "inn",
      play(t) { const n = 1 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) N(t + i * rnd(0.02, 0.08), { type: "bandpass", freq: rnd(1500, 4500), q: 1.5, vol: 0.09, a: 0.001, r: 0.006 }); } },
    drip: { every: 3.2, when: (w) => w.scene === "dungeon",
      play(t) { const f = rnd(700, 1200); A(f, t, { vol: 0.05, a: 0.002, r: 0.04, glide: 1.9, dest: sends.hi || ambBus }); } },
    rumble: { every: 30, when: (w) => w.scene === "dungeon",
      play(t) { N(t, { type: "lowpass", freq: 180, vol: 0.4, a: 0.8, h: 1.2, r: 0.8 }); } },
    gears: { every: 4, when: (w) => w.scene === "dungeon" && w.dwemer,
      play(t) { for (let i = 0; i < 4; i++) N(t + i * 0.16, { type: "bandpass", freq: 2400, q: 4, vol: 0.06, a: 0.001, r: 0.01, dest: sends.mid || ambBus }); } },
    bellows: { every: 4.5, when: (w) => w.scene === "forge",
      play(t) { N(t, { type: "lowpass", freq: 500, vol: 0.22, a: 0.5, h: 0.3, r: 0.25 }); } },
    anvil: { every: 3, when: (w) => w.scene === "forge",
      play(t) { const n = 2 + Math.floor(Math.random() * 2); for (let i = 0; i < n; i++) [1900, 2650, 3720].forEach((f, k) => A(f * rnd(0.98, 1.02), t + i * 0.36, { vol: [0.05, 0.035, 0.02][k], a: 0.001, r: 0.12, dest: sends.mid || ambBus })); } },
    roar: { every: 14, when: (w) => w.raid,
      play(t) { A(rnd(60, 80), t, { type: "sawtooth", vol: 0.12, a: 0.3, h: 1.1, r: 0.4, glide: 0.6, cut: 420, dest: sends.hi || ambBus }); N(t + 0.1, { type: "lowpass", freq: 500, vol: 0.12, a: 0.3, h: 1, r: 0.3 }); } },
  };
  /* footsteps: soft, their pace follows your speed; crunch on snow, thud on grass, tap on stone; hooves when riding */
  function footstep(t, w) {
    const g = w.ground, fk = "amb-step-" + (w.riding ? "hoof" : ["snow", "stone", "marsh"].includes(g) ? g : "grass");
    if (sfxBuf[fk]?.length) { playFile(fk, t, "step", ambBus); return; }
    if (w.riding) {   // a two-beat clop, two hooves close together
      [0, 0.09].forEach((d) => { N(t + d, { type: "bandpass", freq: g === "snow" ? 1400 : 900, q: 1.4, vol: 0.07, a: 0.001, r: 0.02 }); A(160, t + d, { vol: 0.05, a: 0.002, r: 0.03, glide: 0.6 }); });
    } else if (g === "snow") N(t, { type: "bandpass", freq: rnd(2200, 3200), q: 0.9, vol: 0.08, a: 0.01, h: 0.03, r: 0.03 });
    else if (g === "stone") { N(t, { type: "bandpass", freq: rnd(1600, 2200), q: 1.5, vol: 0.06, a: 0.001, r: 0.015 }); A(180, t, { vol: 0.02, a: 0.002, r: 0.02, glide: 0.7 }); }
    else if (g === "marsh") N(t, { type: "bandpass", freq: rnd(600, 900), q: 2, vol: 0.07, a: 0.01, h: 0.02, r: 0.04, sweep: 1.6 });
    else N(t, { type: "lowpass", freq: rnd(700, 1000), vol: 0.09, a: 0.003, r: 0.03 });
    if (w.cart && Math.random() < 0.18) A(rnd(160, 240), t + 0.05, { type: "sawtooth", vol: 0.012, a: 0.08, h: 0.12, r: 0.08, glide: 1.25, cut: 900 });
  }
  function ambStep(force) {
    if (!ctx || !ambWant || (!force && (ctx.state !== "running" || hidden))) return;
    const t = ctx.currentTime, w = ambWant;
    reapBeds();
    if (t - lastSync > 3) { lastSync = t; try { syncMusic(); } catch (e) { /* never break the game */ } }   // region / boss changes
    if (!(cfg.amb > 0) || cfg.mute) return;
    for (const [name, ev] of Object.entries(EVENTS)) {
      if (!ev.when(w)) { nextAt[name] = 0; continue; }
      if (!nextAt[name]) { nextAt[name] = t + rnd(0.3, 1) * ev.every; continue; }
      if (t >= nextAt[name]) { try { if (sfxBuf["amb-" + name]?.length) playFile("amb-" + name, t + 0.05, name, ambBus); else ev.play(t + 0.05, w); } catch (e) { /* never break the game */ } nextAt[name] = t + ev.every * rnd(0.6, 1.5); }
    }
    if (w.moving && w.scene === "wild") {
      const every = w.riding ? 0.62 : Math.max(0.42, 0.62 / Math.max(0.6, Math.min(1.6, w.speed || 1)));
      if (nextStep < t - 1) nextStep = t + 0.1;
      while (nextStep < t + 0.3) { footstep(nextStep, w); nextStep += every * rnd(0.95, 1.05); }
    } else nextStep = 0;
  }
  /* the scene → which beds, how loud */
  function applyAmb() {
    if (!ctx || !ambWant) return;
    if (!(cfg.amb > 0) || cfg.mute) { for (const b of Object.values(beds)) setBed(b.name, 0, null, Object.keys(beds).find((k) => beds[k] === b).slice(b.name.length)); return; }
    const w = ambWant, out = w.scene !== "dungeon" && w.scene !== "inn";
    const windLv = !out ? 0 : w.weather === "blizzard" || w.weather === "ashstorm" ? 0.8 : w.weather === "snow" ? 0.75 : w.weather === "storm" ? 0.55 : w.weather === "rain" ? 0.4 : w.scene === "town" ? 0.3 : w.coldLand ? 0.9 : 0.7;
    setBed("wind", windLv, { cold: w.coldLand, howl: w.weather === "blizzard" }, w.weather === "blizzard" ? "+howl" : w.coldLand ? "+cold" : "");
    // a wind bed built for a different weather fades out
    for (const id of Object.keys(beds)) if (beds[id].name === "wind" && id !== "wind" + (w.weather === "blizzard" ? "+howl" : w.coldLand ? "+cold" : "")) setBed("wind", 0, null, id.slice(4));
    setBed("rain", out && (w.weather === "rain" || w.weather === "storm") ? (w.weather === "storm" ? 1.4 : 1) : 0);
    setBed("water", out && w.water ? (w.scene === "town" ? 0.5 : 1) : 0, { sea: w.sea }, w.sea ? "+sea" : "");
    for (const id of Object.keys(beds)) if (beds[id].name === "water" && id !== "water" + (w.sea ? "+sea" : "")) setBed("water", 0, null, id.slice(5));
    setBed("crowd", w.scene === "town" ? (w.tod === "night" ? 0.35 : 1) : w.scene === "inn" ? 0.5 : w.scene === "forge" ? 0.15 : 0, { inn: w.scene === "inn" }, w.scene === "inn" ? "+inn" : "");
    for (const id of Object.keys(beds)) if (beds[id].name === "crowd" && id !== "crowd" + (w.scene === "inn" ? "+inn" : "")) setBed("crowd", 0, null, id.slice(5));
    setBed("hearth", w.scene === "inn" ? 1 : w.scene === "forge" ? 0.8 : 0);
    setBed("cave", w.scene === "dungeon" ? 1 : 0, { dwemer: w.dwemer }, w.dwemer ? "+dw" : "");
    for (const id of Object.keys(beds)) if (beds[id].name === "cave" && id !== "cave" + (w.dwemer ? "+dw" : "")) setBed("cave", 0, null, id.slice(4));
  }
  function startAmb() {
    if (!ctx || ambTimer || typeof setInterval === "undefined") return;
    ambTimer = setInterval(ambStep, 250);
  }

  // ------------------------------------------------------------ waking up, sleeping, and the phone's background
  let unlocked = false, hidden = typeof document !== "undefined" && document.hidden, sleepT = null;
  function unlock() {
    if (!unlocked) { if (!init()) return; unlocked = true; loadFiles(); }
    if (ctx.state !== "running" && !hidden) ctx.resume?.().catch(() => {});
    syncMusic();
    if (curTrack && curTrack.el.paused && !hidden) curTrack.el.play()?.catch?.(() => {});   // a loop the phone blocked: this tap may free it
    startAmb(); applyAmb();
  }
  if (typeof document !== "undefined") {
    ["pointerdown", "keydown", "touchstart"].forEach((ev) => document.addEventListener(ev, unlock, { capture: true, passive: true }));   // stays on: also wakes audio the phone stopped
    const away = () => {
      hidden = true; if (!ctx) return;
      applyVolume();
      if (curTrack) { const T = curTrack; setTimeout(() => { if (hidden) T.el.pause(); }, 250); }
      clearTimeout(sleepT); sleepT = setTimeout(() => { if (hidden) ctx.suspend?.().catch(() => {}); }, 250);   // fade out, then sleep
    };
    const back = () => {
      hidden = false; if (!ctx) return;
      clearTimeout(sleepT);
      (ctx.resume ? ctx.resume() : Promise.resolve()).catch(() => {}).then(() => {
        if (playing) { queue = []; nextBeat = ctx.currentTime + 0.25; }
        nextStep = 0; for (const k of Object.keys(nextAt)) nextAt[k] = 0;
        applyVolume();
        if (curTrack && curTrack.el.paused) curTrack.el.play()?.catch?.(() => {});
      });
    };
    document.addEventListener("visibilitychange", () => (document.hidden ? away() : back()));
    window.addEventListener?.("pagehide", away); window.addEventListener?.("pageshow", () => { if (!document.hidden) back(); });
    document.addEventListener("freeze", away); document.addEventListener("resume", () => { if (!document.hidden) back(); });
  }
  const ready = () => ctx && unlocked && !cfg.mute && !hidden && ctx.state === "running";
  return {
    fx(name, delay = 0) {
      if (!ready() || !cfg.sfx || !chain(name).some((n) => FX[n] || sfxBuf[n]?.length)) return;
      fire(name, ctx.currentTime + 0.02 + delay);
    },
    /* plays a short fight: a few blows, then a win or loss sting */
    fight(r) {
      if (!ready() || !cfg.sfx) return;
      const n = Math.min(6, Math.max(2, r?.fight?.log?.length || 3));
      for (let i = 0; i < n; i++) this.fx(i % 3 === 2 ? "clang" : i % 2 ? "swing" : "hit", i * 0.2);
      this.fx(r?.died ? "death" : "victory", n * 0.2 + 0.15);
    },
    mood(m) {
      if (!MOODS[m] || m === wantMood) return;
      wantMood = m; switchMood(m);
      try { syncMusic(); } catch (e) { /* never break the game */ }
    },
    /* every effect name that will make a sound (procedural ones plus any recorded extras such as "equip") */
    get FX() { const o = {}; for (const k of Object.keys(FX)) o[k] = true; for (const k of Object.keys(sfxBuf)) if (!k.startsWith("amb-")) o[k] = true; return o; },
    /* what's around you: { scene: wild|town|inn|forge|dungeon, weather, tod, ground, leafy, coldLand, wet, water, sea,
       dwemer, raid, moving, speed, riding, cart } — call it whenever any of that may have changed (cheap) */
    ambience(w) {
      if (!w) return;
      const key = JSON.stringify(w);
      if (key === ambKey) return;
      const was = ambWant?.scene; ambKey = key; ambWant = { ...w };
      if (ctx && unlocked) { applyAmb(); if (was !== w.scene) try { syncMusic(); } catch (e) { /* never break the game */ } }
    },
    get settings() { return { ...cfg }; },
    set(k, v) {
      cfg[k] = v; saveCfg();
      if (!ctx) return;
      applyVolume();
      syncMusic();
      if (k === "amb" || k === "mute") applyAmb();
    },
    get state() { return { ctx: ctx?.state || "none", unlocked, mood, music: playing, voices: voices.music.length + voices.sfx.length + voices.amb.length, amb: ambWant?.scene || null, beds: Object.keys(beds), ambVoices: voices.amb.length, track: curTrack ? curTrack.key : null, files: Object.keys(sfxBuf).length + Object.keys(musFile).length }; },
    /* for tests and the offline renderer: drive the same engine on any AudioContext */
    _test: {
      init: () => { const ok = init(); unlocked = true; if (ctx) { master.gain.value = 1; musicBus.gain.value = Math.pow(cfg.music, 1.3) * 0.9; sfxBus.gain.value = Math.pow(cfg.sfx, 1.3) * 1.1; ambBus.gain.value = Math.pow(cfg.amb ?? 0.5, 1.3) * AMB_LEVEL; } return ok; },
      FX, step, fire, get ctx() { return ctx; },
      amb: (w) => { ambWant = { ...w }; ambKey = ""; if (ambBus) ambBus.gain.value = Math.pow(cfg.amb ?? 0.5, 1.3) * AMB_LEVEL; applyAmb(); },
      ambStep: () => ambStep(true), EVENTS, BEDS,
      startMusic: () => { if (timer) { clearInterval(timer); timer = null; } playing = true; layer = makeLayer(mood); beat = 0; chordIx = 0; queue = []; motif = null; restBars = 1; nextBeat = ctx.currentTime + 0.2; step(); },
      setMood: (m) => { mood = m; wantMood = m; if (playing) switchMood(m); },
    },
  };
})();
