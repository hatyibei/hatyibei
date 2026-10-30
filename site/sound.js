/* はちべえ絵巻 — sound. Everything is synthesized; there are no audio files.
 * Wind always, birds by day, 鈴虫 by night, water near the river scenes, 拍子木 on touch.
 */
(() => {
  let ac = null, master = null, on = false;
  let time = 'morning', water = 0;
  let windGain, waterGain, noiseBuf;
  let birdTimer = 0, bugTimer = 0;

  const makeNoise = () => {
    const len = ac.sampleRate * 2;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) { b = (b + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = b * 3.5; } // brown-ish
    return buf;
  };
  const loop = (filterType, freq, q) => {
    const src = ac.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const f = ac.createBiquadFilter();
    f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain(); g.gain.value = 0;
    src.connect(f).connect(g).connect(master);
    src.start();
    return { g, f };
  };

  const init = () => {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain();
    master.gain.value = 0;
    master.connect(ac.destination);
    noiseBuf = makeNoise();
    const wind = loop('bandpass', 380, .6);
    windGain = wind.g;
    // the wind rises and falls on its own
    const lfo = ac.createOscillator(), lfoAmt = ac.createGain();
    lfo.frequency.value = .07; lfoAmt.gain.value = 160;
    lfo.connect(lfoAmt).connect(wind.f.frequency); lfo.start();
    waterGain = loop('lowpass', 900, .3).g;
    const hiss = loop('highpass', 3200, .2);
    hiss.g.gain.value = .006;
    hiss.g.disconnect(); hiss.g.connect(waterGain);
  };

  const chirp = () => {
    const t = ac.currentTime, pan = ac.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - .8;
    pan.connect(master);
    const n = 2 + Math.floor(Math.random() * 3), base = 2600 + Math.random() * 1600;
    for (let i = 0; i < n; i++) {
      const o = ac.createOscillator(), g = ac.createGain(), s = t + i * (.09 + Math.random() * .05);
      o.type = 'sine';
      o.frequency.setValueAtTime(base, s);
      o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * .3), s + .06);
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(.045, s + .01);
      g.gain.exponentialRampToValueAtTime(.0001, s + .08);
      o.connect(g).connect(pan); o.start(s); o.stop(s + .1);
    }
  };

  // 鈴虫: a high tone, tremolo'd into a "riiin"
  const suzumushi = () => {
    const t = ac.currentTime, dur = .35 + Math.random() * .35;
    const o = ac.createOscillator(), g = ac.createGain(), am = ac.createOscillator(), amG = ac.createGain();
    const pan = ac.createStereoPanner();
    pan.pan.value = Math.random() * 1.4 - .7;
    o.frequency.value = 4200 + Math.random() * 500;
    am.frequency.value = 38; amG.gain.value = .5;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(.022, t + .03);
    g.gain.setValueAtTime(.022, t + dur - .06);
    g.gain.linearRampToValueAtTime(0, t + dur);
    am.connect(amG).connect(g.gain);
    o.connect(g).connect(pan).connect(master);
    o.start(t); am.start(t); o.stop(t + dur); am.stop(t + dur);
  };

  // 拍子木: two dry knocks of wood
  const hyoshigi = (k = 1) => {
    if (!on) return;
    const t = ac.currentTime;
    for (let i = 0; i < k; i++) {
      const s = t + i * .16;
      const src = ac.createBufferSource(); src.buffer = noiseBuf;
      const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 9;
      const g = ac.createGain();
      g.gain.setValueAtTime(.9, s); g.gain.exponentialRampToValueAtTime(.0001, s + .09);
      src.connect(f).connect(g).connect(master); src.start(s, Math.random()); src.stop(s + .1);
      const o = ac.createOscillator(), og = ac.createGain();
      o.frequency.value = 820 - i * 60;
      og.gain.setValueAtTime(.09, s); og.gain.exponentialRampToValueAtTime(.0001, s + .07);
      o.connect(og).connect(master); o.start(s); o.stop(s + .08);
    }
  };

  // the seal coming down: a low thud
  const thud = () => {
    if (!on) return;
    const t = ac.currentTime + .05;
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(48, t + .25);
    g.gain.setValueAtTime(.5, t); g.gain.exponentialRampToValueAtTime(.0001, t + .4);
    o.connect(g).connect(master); o.start(t); o.stop(t + .45);
  };

  const tick = () => {
    if (!on) return;
    const now = performance.now();
    const day = time === 'morning' || time === 'day';
    if (day && now > birdTimer) { chirp(); birdTimer = now + (time === 'morning' ? 1500 : 3500) + Math.random() * 4000; }
    if (time === 'night' && now > bugTimer) { suzumushi(); bugTimer = now + 900 + Math.random() * 1800; }
    if (time === 'evening' && now > bugTimer) { suzumushi(); bugTimer = now + 3000 + Math.random() * 5000; }
    const t = ac.currentTime;
    windGain.gain.setTargetAtTime(time === 'night' ? .05 : .08, t, .8);
    waterGain.gain.setTargetAtTime(water * .22, t, .4);
  };
  setInterval(tick, 250);

  window.SOUND = {
    get on() { return on; },
    toggle() {
      if (!ac) init();
      on = !on;
      if (on) ac.resume();
      master.gain.setTargetAtTime(on ? .9 : 0, ac.currentTime, .3);
      return on;
    },
    setTime(t) { time = t; },
    setWater(v) { water = v; },
    knock: hyoshigi,
    thud,
  };
})();
