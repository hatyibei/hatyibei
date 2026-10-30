/* はちべえ絵巻 — scroll engine, ink mountains, mist, residents. */
(() => {
  const { scenes, notebook } = window.EMAKI;
  const root = document.documentElement;
  const stage = document.getElementById('stage');
  const world = document.getElementById('world');
  const bg = document.getElementById('bg');
  const fg = document.getElementById('fg');
  const bctx = bg.getContext('2d');
  const fctx = fg.getContext('2d');
  const sheet = document.getElementById('sheet');
  const sheetBody = sheet.querySelector('.sheet-body');
  const bar = document.getElementById('scrollbar');
  const hint = document.getElementById('hint');
  const stamp = document.getElementById('stamp');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- state ----------
  let W = 0, H = 0, U = 0, DPR = 1, GROUND = 0;
  let worldW = 0, maxP = 0;
  let p = 0, target = 0, vel = 0;
  const items = []; // { el, x, w, scene }

  // ---------- noise ----------
  const hash = (i, s) => {
    let h = Math.imul(i | 0, 374761393) ^ Math.imul(s | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const vnoise = (x, s) => {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return hash(i, s) * (1 - u) + hash(i + 1, s) * u;
  };
  const fbm = (x, s) => {
    let a = .5, t = 0, n = 0, fr = 1;
    for (let o = 0; o < 5; o++) { t += a * vnoise(x * fr, s + o * 31); n += a; a *= .5; fr *= 2.03; }
    return t / n;
  };

  // ---------- mountain layers (far → near) ----------
  const LAYERS = [
    { f: .05, base: .46, amp: .3, a: .2, fade: .24, sc: 1.1, seed: 11, ridged: true, dots: 0, gap: .45 },
    { f: .13, base: .55, amp: .24, a: .28, fade: .2, sc: .7, seed: 23, ridged: true, dots: .35, gap: .5 },
    { f: .28, base: .64, amp: .15, a: .32, fade: .16, sc: .48, seed: 37, ridged: false, dots: .9, gap: .55 },
    { f: .52, base: .72, amp: .09, a: .36, fade: .12, sc: .34, seed: 41, ridged: false, dots: 1.1, gap: .6 },
    { f: 1, base: .815, amp: .012, a: .12, fade: .08, sc: .25, seed: 53, ridged: false, dots: 0, gap: 0 },
  ];
  // 余白: hills come in groups with open mist between them
  const presence = (L, x) => {
    if (!L.gap) return 1;
    const v = fbm(x / (H * L.sc * 3.2), L.seed + 99);
    const t = Math.min(1, Math.max(0, (v - L.gap + .14) / .2));
    return t * t * (3 - 2 * t);
  };
  const ridge = (L, x) => {
    let n = fbm(x / (H * L.sc), L.seed);
    n = Math.min(1, Math.max(0, (n - .22) / .56));
    if (L.ridged) n = Math.pow(1 - Math.abs(2 * n - 1) * .9, 1.7) * .55 + n * .45;
    const m = presence(L, x);
    return H * L.base - H * L.amp * n * (.2 + .8 * m) + H * .05 * (1 - m);
  };

  // ---------- colors from CSS ----------
  let C = {};
  const readColors = () => {
    const cs = getComputedStyle(root);
    const rgb = k => cs.getPropertyValue(k).trim();
    C = {
      ink: rgb('--ink'), mist: rgb('--mist'), spirit: rgb('--spirit'),
      shu: rgb('--shu'), mistK: parseFloat(rgb('--mist-k')) || .6,
      time: root.dataset.time,
    };
  };

  // ---------- tiled mountain rendering ----------
  const TILE = 512;
  const tiles = new Map();
  const renderTile = (li, k) => {
    const L = LAYERS[li];
    const c = document.createElement('canvas');
    c.width = Math.ceil(TILE * DPR); c.height = Math.ceil(H * DPR);
    const g = c.getContext('2d');
    g.scale(DPR, DPR);
    const x0 = k * TILE, step = 2;
    const pts = [];
    for (let x = -step; x <= TILE + step; x += step) pts.push([x, ridge(L, x0 + x)]);
    const fadeAt = x => H * L.fade * (.65 + vnoise((x0 + x) / 90, L.seed + 2) * .7);
    const m = x => presence(L, x0 + x);
    // a pale wash under each ridge, thinning to nothing: the mist is what's left out
    for (let i = 0; i < pts.length - 1; i++) {
      const [x, y] = pts[i];
      const len = fadeAt(x), a = L.a * .55 * (.2 + .8 * m(x));
      const gr = g.createLinearGradient(0, y, 0, y + len);
      gr.addColorStop(0, `rgba(${C.ink}, ${a})`);
      gr.addColorStop(.3, `rgba(${C.ink}, ${a * .45})`);
      gr.addColorStop(1, `rgba(${C.ink}, 0)`);
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(x, y); g.lineTo(pts[i + 1][0], pts[i + 1][1]);
      g.lineTo(pts[i + 1][0], y + len); g.lineTo(x, y + len);
      g.closePath(); g.fill();
    }
    // 米点: the hills are built from soft horizontal dots, thick at the crest, thinning into mist
    if (L.dots) {
      // dots live on a world grid so neighbouring tiles agree; draw the ones that reach into this tile
      const cell = 24, pad = 40;
      const c0 = Math.floor((x0 - pad) / cell), c1 = Math.floor((x0 + TILE + pad) / cell);
      const per = Math.round(cell * L.dots);
      for (let c = c0; c <= c1; c++) {
        for (let j = 0; j < per; j++) {
          const id = c * 997 + j;
          const gx = (c + hash(id, L.seed + 61)) * cell;
          const x = gx - x0;
          const mm = presence(L, gx);
          if (hash(id, L.seed + 62) > mm * 1.1) continue;
          const fd = H * L.fade * (.65 + vnoise(gx / 90, L.seed + 2) * .7);
          // most dots crowd the crest; a few wander down into the mist
          const t = Math.pow(hash(id, L.seed + 63), 2.3);
          const y = ridge(L, gx) + t * fd * .85 + H * .002;
          const big = hash(id, L.seed + 66);
          const rr = H * (.003 + .006 * L.f) * (.45 + big * big * 1.4);
          const a = Math.min(.85, L.a * (1.2 + hash(id, L.seed + 67) * 1.1) * Math.pow(1 - t, 1.6) * (.35 + .65 * mm));
          if (a < .015) continue;
          g.save();
          g.translate(x, y);
          g.rotate((hash(id, L.seed + 65) - .5) * .3);
          g.scale(1.6 + big * .9, .75);
          const gr = g.createRadialGradient(0, 0, 0, 0, 0, rr);
          gr.addColorStop(0, `rgba(${C.ink}, ${a})`);
          gr.addColorStop(.45, `rgba(${C.ink}, ${a * .8})`);
          gr.addColorStop(1, `rgba(${C.ink}, 0)`);
          g.fillStyle = gr;
          g.beginPath(); g.arc(0, 0, rr, 0, Math.PI * 2); g.fill();
          g.restore();
        }
      }
    }
    // the crest: a dry, broken line, only where the hill is present
    g.lineCap = 'round';
    for (let i = 0; i < pts.length - 1; i++) {
      const [x, y] = pts[i];
      const dry = vnoise((x0 + x) / 17, L.seed + 40);
      const a = L.a * 1.25 * m(x) * (dry > .35 ? 1 : dry / .35);
      if (a < .02 || !L.gap) continue;
      g.strokeStyle = `rgba(${C.ink}, ${Math.min(.85, a)})`;
      g.lineWidth = (.6 + L.f * 1.6) * (.7 + dry * .8);
      g.beginPath(); g.moveTo(x, y); g.lineTo(pts[i + 1][0], pts[i + 1][1]); g.stroke();
    }
    return c;
  };
  const getTile = (li, k) => {
    const key = li * 100000 + k;
    let t = tiles.get(key);
    if (!t) {
      t = renderTile(li, k);
      tiles.set(key, t);
      if (tiles.size > 90) tiles.delete(tiles.keys().next().value);
    }
    return t;
  };

  // ---------- mist, birds, sky, spirits ----------
  let mist = [], birds = [], stars = [], spirits = [];
  const seedAmbient = () => {
    mist = [];
    LAYERS.forEach((L, li) => {
      const n = Math.ceil(W / 260) + 3;
      for (let i = 0; i < n; i++) {
        const r = hash(i * 7 + li * 101, 3);
        mist.push({
          li, x: hash(i, li + 90) * (W + 800), y: H * (L.base + .015 + r * .05),
          rx: W * (.22 + r * .32), ry: H * (.035 + hash(i, li + 7) * .05),
          v: (4 + hash(i, li + 13) * 10) * (li % 2 ? 1 : -1), a: .5 + r * .5,
        });
      }
    });
    birds = Array.from({ length: 5 }, (_, i) => ({
      x: W * (.4 + i * .07 + hash(i, 61) * .05), y: H * (.16 + hash(i, 62) * .1),
      s: U * (.012 + hash(i, 63) * .008), ph: hash(i, 64) * 6, v: 14 + hash(i, 65) * 6,
    }));
    stars = Array.from({ length: 70 }, (_, i) => ({
      x: hash(i, 71) * W, y: hash(i, 72) * H * .5, r: .4 + hash(i, 73) * 1.1, ph: hash(i, 74) * 6,
    }));
    spirits = Array.from({ length: Math.round(worldW / U * 2.4) }, (_, i) => ({
      x: hash(i, 81) * worldW, y: GROUND - U * (.03 + hash(i, 82) * .22),
      r: U * (.006 + hash(i, 83) * .006), ph: hash(i, 84) * 6, gone: 0, dy: 0,
    }));
  };

  const drawMist = (ctx, li, t, camX) => {
    const L = LAYERS[li];
    const k = C.mistK;
    // a soft band of paper at the foot of this layer
    const y0 = H * (L.base - .02), y1 = H * (L.base + L.fade * .9);
    const band = ctx.createLinearGradient(0, y0, 0, y1);
    band.addColorStop(0, `rgba(${C.mist}, 0)`);
    band.addColorStop(.5, `rgba(${C.mist}, ${.7 * k})`);
    band.addColorStop(1, `rgba(${C.mist}, ${.95 * k})`);
    ctx.fillStyle = band;
    ctx.fillRect(0, y0, W, H - y0);
    // drifting puffs
    for (const m of mist) {
      if (m.li !== li) continue;
      const span = W + m.rx * 2;
      let x = (m.x - camX * L.f * 1.1 + (reduced ? 0 : t * m.v)) % span;
      if (x < 0) x += span;
      x -= m.rx;
      ctx.save();
      ctx.translate(x, m.y);
      ctx.scale(1, m.ry / m.rx);
      const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, m.rx);
      gr.addColorStop(0, `rgba(${C.mist}, ${Math.min(1, m.a * k * 1.1)})`);
      gr.addColorStop(1, `rgba(${C.mist}, 0)`);
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(0, 0, m.rx, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  };

  const drawSky = (t) => {
    const tm = C.time;
    if (tm === 'night') {
      for (const s of stars) {
        const a = .35 + .35 * Math.sin(t * 1.3 + s.ph);
        bctx.fillStyle = `rgba(235, 230, 214, ${a})`;
        bctx.beginPath(); bctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); bctx.fill();
      }
      const mx = W * .3, my = H * .17, r = U * .045;
      const halo = bctx.createRadialGradient(mx, my, r * .8, mx, my, r * 5);
      halo.addColorStop(0, 'rgba(240, 235, 215, .22)'); halo.addColorStop(1, 'rgba(240, 235, 215, 0)');
      bctx.fillStyle = halo; bctx.beginPath(); bctx.arc(mx, my, r * 5, 0, Math.PI * 2); bctx.fill();
      bctx.fillStyle = 'rgba(242, 237, 220, .92)';
      bctx.beginPath(); bctx.arc(mx, my, r, 0, Math.PI * 2); bctx.fill();
      return;
    }
    const sun = { morning: [.34, .31, .045, .45], day: [.4, .13, .04, .12], evening: [.3, .37, .065, .7] }[tm];
    if (sun) {
      const [sx, sy, sr, a] = sun;
      bctx.fillStyle = C.shu;
      bctx.globalAlpha = a;
      bctx.beginPath(); bctx.arc(W * sx, H * sy, U * sr, 0, Math.PI * 2); bctx.fill();
      bctx.globalAlpha = 1;
    }
    if (reduced) return;
    bctx.strokeStyle = `rgba(${C.ink}, .7)`;
    bctx.lineWidth = 1.3;
    for (const b of birds) {
      let x = (b.x - t * b.v) % (W + 200);
      if (x < -100) x += W + 200;
      const flap = Math.sin(t * 5 + b.ph) * b.s * .5;
      bctx.beginPath();
      bctx.moveTo(x - b.s, b.y + flap);
      bctx.quadraticCurveTo(x - b.s * .4, b.y - b.s * .3, x, b.y + b.s * .15);
      bctx.quadraticCurveTo(x + b.s * .4, b.y - b.s * .3, x + b.s, b.y + flap);
      bctx.stroke();
    }
  };

  const drawSpirits = (t, camX) => {
    const night = C.time === 'night', eve = C.time === 'evening';
    const base = night ? .95 : eve ? .6 : .38;
    for (const s of spirits) {
      const sx = s.x - camX;
      if (sx < -40 || sx > W + 40) continue;
      if (s.gone) {
        s.dy -= .9; s.gone -= 1;
        if (s.gone <= 0) { s.gone = 0; s.dy = 0; s.x = camX + Math.random() * W; }
      }
      const a = base * (.6 + .4 * Math.sin(t * 1.7 + s.ph)) * (s.gone ? s.gone / 160 : 1);
      if (a <= 0) continue;
      const y = s.y + Math.sin(t * .8 + s.ph) * U * .012 + s.dy;
      const x = sx + Math.cos(t * .5 + s.ph) * U * .01;
      const R = s.r * (night ? 4.2 : 3);
      const gr = fctx.createRadialGradient(x, y, 0, x, y, R);
      gr.addColorStop(0, `rgba(${C.spirit}, ${a})`);
      gr.addColorStop(.25, `rgba(${C.spirit}, ${a * .55})`);
      gr.addColorStop(1, `rgba(${C.spirit}, 0)`);
      fctx.fillStyle = gr;
      fctx.beginPath(); fctx.arc(x, y, R, 0, Math.PI * 2); fctx.fill();
    }
  };

  const drawGroundMist = (t, camX) => {
    const k = C.mistK;
    const y0 = GROUND - U * .06;
    const gr = fctx.createLinearGradient(0, y0, 0, H);
    gr.addColorStop(0, `rgba(${C.mist}, 0)`);
    gr.addColorStop(.35, `rgba(${C.mist}, ${.28 * k})`);
    gr.addColorStop(1, `rgba(${C.mist}, ${.9 * k})`);
    fctx.fillStyle = gr;
    fctx.fillRect(0, y0, W, H - y0);
    if (reduced) return;
    for (let i = 0; i < 6; i++) {
      const rx = W * (.25 + hash(i, 91) * .2), span = W + rx * 2;
      let x = (hash(i, 92) * span - camX * 1.15 + t * (10 + i * 3)) % span;
      if (x < 0) x += span;
      x -= rx;
      const y = GROUND + U * (.0 + hash(i, 93) * .05);
      fctx.save(); fctx.translate(x, y); fctx.scale(1, .12);
      const g = fctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, `rgba(${C.mist}, ${.45 * k})`); g.addColorStop(1, `rgba(${C.mist}, 0)`);
      fctx.fillStyle = g; fctx.beginPath(); fctx.arc(0, 0, rx, 0, Math.PI * 2); fctx.fill();
      fctx.restore();
    }
  };

  // ---------- scenes → DOM ----------
  const SVGNS = 'http://www.w3.org/2000/svg';
  const buildScenes = () => {
    world.textContent = '';
    items.length = 0;

    const title = document.createElement('section');
    title.className = 'scene title';
    title.innerHTML = `
      <div class="kotoba">
        <h1>はちべえ絵巻</h1>
        <p class="sub">hatyibei の、頭の中の村。</p>
        <p class="sub">右から左へ、時の順に。</p>
        <button class="seal" aria-label="旅人の手帳をひらく">八</button>
      </div>`;
    title.querySelector('.seal').addEventListener('click', openNotebook);
    world.appendChild(title);
    items.push({ el: title, scene: null });

    for (const s of scenes) {
      const el = document.createElement('section');
      el.className = 'scene';
      el.id = s.id;
      el.setAttribute('aria-label', s.title);
      const art = document.createElementNS(SVGNS, 'svg');
      art.setAttribute('class', 'art');
      art.setAttribute('viewBox', `0 0 ${s.w} 100`);
      art.setAttribute('role', 'button');
      art.setAttribute('tabindex', '0');
      art.setAttribute('aria-label', `${s.title} — 詳しく見る`);
      art.innerHTML = `<g class="drawing">${s.svg}</g>`;
      art.addEventListener('click', e => {
        if (e.target.closest('a, .armor')) return;
        if (e.target.closest('.portal')) { window.INSIDE?.enter(e.target.closest('.portal')); return; }
        openScene(s);
      });
      art.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        const portal = e.target.closest('.portal');
        portal ? window.INSIDE?.enter(portal) : openScene(s);
      });
      const k = document.createElement('div');
      k.className = 'kotoba';
      k.innerHTML = `<span class="no">${s.no}</span><h2>${s.title}</h2><p class="era">${s.era}</p>` +
        s.kotoba.map(l => `<p>${l}</p>`).join('');
      const more = document.createElement('button');
      more.className = 'more';
      more.textContent = 'つづきを読む';
      more.addEventListener('click', () => openScene(s));
      k.appendChild(more);
      const paintC = document.createElement('canvas');
      paintC.className = 'paint';
      paintC.setAttribute('aria-hidden', 'true');
      el.append(paintC, art, k);
      world.appendChild(el);
      items.push({ el, art, paint: paintC, scene: s, dirty: true });
    }

    const armor = world.querySelector('.armor');
    const ban = e => { e.stopPropagation(); e.preventDefault(); banished(); };
    armor.addEventListener('click', ban);
    armor.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') ban(e); });

    // focusing something scrolls it into view
    world.addEventListener('focusin', e => {
      const it = items.find(i => i.el.contains(e.target));
      if (it) target = centerP(it);
    });

    // scrollbar marks
    const marks = bar.querySelector('.marks');
    marks.textContent = '';
    items.forEach((it, i) => {
      const b = document.createElement('button');
      b.dataset.label = it.scene ? `${it.scene.no}　${it.scene.title}` : '序';
      b.setAttribute('aria-label', b.dataset.label);
      b.addEventListener('click', () => { target = centerP(it); });
      marks.appendChild(b);
      it.mark = b;
    });
  };

  const layout = () => {
    const ratio = maxP ? p / maxP : 0;
    W = innerWidth; H = innerHeight;
    DPR = Math.min(devicePixelRatio || 1, 2);
    U = Math.min(H, W * 1.15);
    GROUND = H * .8;
    world.style.setProperty('--ground', `${GROUND}px`);
    world.style.setProperty('--u', `${U}px`);
    for (const c of [bg, fg]) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); }
    bctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    fctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    tiles.clear();

    const artH = U * .46, gapIn = U * .05, gap = U * .2;
    for (const it of items) {
      let w;
      const kw = it.el.querySelector('.kotoba').offsetWidth;
      if (it.scene) {
        const aw = it.scene.w / 100 * artH;
        it.art.style.height = `${artH}px`;
        it.art.style.width = `${aw}px`;
        w = aw + gapIn + kw;
      } else {
        w = kw;
      }
      it.w = w;
      it.el.style.width = `${w}px`;
    }
    const first = items[0].w, last = items[items.length - 1].w;
    const padR = Math.max(U * .15, (W - first) / 2), padL = Math.max(U * .15, (W - last) / 2);
    worldW = padR + padL + items.reduce((a, it) => a + it.w, 0) + gap * (items.length - 1);
    let xr = worldW - padR;
    for (const it of items) { it.x = xr - it.w; it.el.style.left = `${it.x}px`; xr = it.x - gap; }
    world.style.width = `${worldW}px`;
    maxP = Math.max(0, worldW - W);
    p = target = ratio * maxP;
    items.forEach(it => { it.mark.style.left = `${100 - (centerP(it) / maxP) * 100}%`; });
    PAINT_M = Math.round(U * .06);
    for (const it of items) {
      if (!it.paint) continue;
      it.paint.style.left = `${-PAINT_M}px`;
      it.paint.style.bottom = `calc(100% - var(--ground) - ${PAINT_M}px)`;
      it.dirty = true;
    }
    seedAmbient();
  };

  // ---------- brushwork: repaint one scene per frame, nearest first ----------
  let PAINT_M = 0;
  const hexRgb = h => {
    h = h.trim().replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
  };
  const brushColors = () => {
    const cs = getComputedStyle(root);
    return {
      line: hexRgb(cs.getPropertyValue('--line')), shu: hexRgb(cs.getPropertyValue('--shu')),
      paperCss: cs.getPropertyValue('--paper').trim(), wash: parseFloat(cs.getPropertyValue('--wash')) || .13,
      time: root.dataset.time, glow: cs.getPropertyValue('--glow').trim(), screen: cs.getPropertyValue('--screen').trim(),
    };
  };
  const paintNext = camX => {
    if (!window.BRUSH) return;
    let best = null, bd = Infinity;
    for (const it of items) {
      if (!it.dirty || !it.paint) continue;
      const d = Math.abs(it.x + it.w / 2 - (camX + W / 2));
      if (d < bd) { bd = d; best = it; }
    }
    if (!best) return;
    window.BRUSH.paint(best.art, best.paint, PAINT_M, brushColors(), DPR, best.scene.paint);
    best.dirty = false;
  };

  const centerP = it => Math.min(maxP, Math.max(0, maxP - (it.x + it.w / 2 - W / 2)));

  // ---------- frame ----------
  let last = performance.now(), activeIdx = -1;
  const frame = now => {
    const dt = Math.min(.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    if (vel) { target += vel * dt; vel *= Math.pow(.04, dt); if (Math.abs(vel) < 5) vel = 0; }
    target = Math.min(maxP, Math.max(0, target));
    p += (target - p) * Math.min(1, dt * (reduced ? 30 : 7));
    const camX = maxP - p;
    // diving into a picture: everything scales toward one point, the near things fastest
    const zm = view.zoom;
    if (zm.z !== 1) {
      const zt = (k, el) => { el.style.transformOrigin = `${zm.ox}px ${zm.oy}px`; el.style.transform = `scale(${Math.pow(zm.z, k)})`; };
      world.style.transformOrigin = '0 0';
      world.style.transform = `translate(${zm.ox}px,${zm.oy}px) scale(${zm.z}) translate(${-zm.ox}px,${-zm.oy}px) translate3d(${-camX}px,0,0)`;
      zt(.3, bg); zt(.75, fg);
    } else {
      world.style.transform = `translate3d(${-camX}px,0,0)`;
      if (bg.style.transform) { bg.style.transform = ''; fg.style.transform = ''; }
    }
    if (view.hidden) { requestAnimationFrame(frame); return; }

    bctx.clearRect(0, 0, W, H);
    drawSky(t);
    LAYERS.forEach((L, li) => {
      const lx = camX * L.f;
      const k0 = Math.floor(lx / TILE), k1 = Math.floor((lx + W) / TILE);
      for (let k = k0; k <= k1; k++) bctx.drawImage(getTile(li, k), k * TILE - lx, 0, TILE, H);
      if (li < LAYERS.length - 1) drawMist(bctx, li, t, camX);
    });

    paintNext(camX);

    fctx.clearRect(0, 0, W, H);
    drawGroundMist(t, camX);
    drawSpirits(t, camX);

    bar.querySelector('.fill').style.width = `${maxP ? (p / maxP) * 100 : 0}%`;
    let best = 0, bd = Infinity;
    items.forEach((it, i) => { const d = Math.abs(centerP(it) - p); if (d < bd) { bd = d; best = i; } });
    if (best !== activeIdx) {
      items.forEach((it, i) => it.mark.classList.toggle('on', i === best));
      activeIdx = best;
    }
    if (p > 30) hint.classList.add('gone');
    if (window.SOUND?.on) {
      // water is loudest when a river scene is in the middle of the view
      let w = 0;
      for (const it of items) {
        if (!it.scene?.water) continue;
        const d = Math.abs(it.x + it.w / 2 - (camX + W / 2)) / (W * .9);
        w = Math.max(w, 1 - Math.min(1, d));
      }
      window.SOUND.setWater(w);
    }
    requestAnimationFrame(frame);
  };

  // ---------- what the inside of the television needs from here ----------
  const view = {
    zoom: { z: 1, ox: 0, oy: 0 },
    hidden: false,
    colors: () => brushColors(),
    get dpr() { return DPR; },
  };
  window.EMAKI_VIEW = view;

  // ---------- input ----------
  stage.addEventListener('wheel', e => {
    e.preventDefault();
    if (window.INSIDE?.active) return;
    const m = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? H : 1;
    target += (e.deltaY - e.deltaX) * m;
    vel = 0;
  }, { passive: false });

  let drag = null, justDragged = false;
  stage.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    drag = { id: e.pointerId, x0: e.clientX, x: e.clientX, y0: e.clientY, t: performance.now(), v: 0, moved: false };
    vel = 0;
  });
  stage.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(e.clientX - drag.x0) > 6) {
      drag.moved = true;
      stage.setPointerCapture(e.pointerId);
      stage.classList.add('dragging');
    }
    if (!drag.moved) return;
    const now = performance.now();
    target += dx;
    p += dx; // follow the finger 1:1
    drag.v = dx / Math.max(1, now - drag.t) * 1000;
    drag.x = e.clientX; drag.t = now;
  });
  const endDrag = e => {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.moved) {
      vel = Math.abs(drag.v) > 60 ? drag.v : 0;
      justDragged = true;
      setTimeout(() => { justDragged = false; }, 0);
    } else {
      poke(e.clientX, e.clientY);
    }
    stage.classList.remove('dragging');
    drag = null;
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  stage.addEventListener('click', e => { if (justDragged) { e.stopPropagation(); e.preventDefault(); } }, true);

  // touching a spirit sends it drifting up
  const poke = (x, y) => {
    const camX = maxP - p;
    for (const s of spirits) {
      const sx = s.x - camX;
      if (!s.gone && Math.hypot(sx - x, s.y - y) < Math.max(18, s.r * 5)) { s.gone = 160; return; }
    }
  };

  let typed = '';
  addEventListener('keydown', e => {
    if (sheet.open || window.INSIDE?.active) return;
    const step = W * .6;
    if (['ArrowLeft', 'ArrowDown', 'PageDown'].includes(e.key) || (e.key === ' ' && e.target === document.body)) { target += step; e.preventDefault(); }
    else if (['ArrowRight', 'ArrowUp', 'PageUp'].includes(e.key)) { target -= step; e.preventDefault(); }
    else if (e.key === 'Home') target = 0;
    else if (e.key === 'End') target = maxP;
    if (e.key.length === 1) {
      typed = (typed + e.key).slice(-5);
      if (typed === '/give') { typed = ''; banished(); }
    }
  });

  // ---------- sheet ----------
  const openSheet = html => {
    sheetBody.innerHTML = html;
    sheet.showModal();
    sheet.scrollTop = 0;
    window.SOUND?.knock(2);
  };
  const openScene = s => {
    const links = s.links ? `<ul class="links">${s.links.map(([l, h]) => `<li><a href="${h}" target="_blank" rel="noopener">${l}</a></li>`).join('')}</ul>` : '';
    openSheet(`<h2 id="sheet-title">${s.no}　${s.title}</h2><p class="era">${s.era}</p>${s.more}${links}`);
    if (s.demo === 'bridge') mountBridge(sheetBody);
    if (s.feed === 'zenn') sheetBody.insertAdjacentHTML('beforeend', zennList());
  };
  function openNotebook() { openSheet(notebook + reposList()); }

  // ---------- the real things behind the pictures ----------
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmtDate = d => { const t = new Date(d); return isNaN(t) ? '' : `${t.getFullYear()}.${String(t.getMonth() + 1).padStart(2, '0')}.${String(t.getDate()).padStart(2, '0')}`; };
  const feeds = { zenn: null, repos: null };

  // Prefer the snapshot the deploy job wrote; fall back to asking the source directly.
  const getJSON = async (...urls) => {
    for (const u of urls) {
      try {
        const r = await fetch(u);
        if (r.ok) return await r.json();
      } catch { /* try the next one */ }
    }
    return null;
  };
  const loadFeeds = async () => {
    const z = await getJSON('data/zenn.json', 'https://zenn.dev/api/articles?username=hatyibei&order=latest');
    if (z?.articles) {
      feeds.zenn = z.articles.slice(0, 12).map(a => ({
        title: a.title, emoji: a.emoji, date: a.published_at, likes: a.liked_count,
        url: a.url || `https://zenn.dev${a.path}`,
      }));
      hangTanzaku();
    }
    const g = await getJSON('data/github.json', 'https://api.github.com/users/hatyibei/repos?sort=pushed&per_page=30');
    if (Array.isArray(g)) {
      feeds.repos = g.filter(r => !r.fork && r.name !== 'hatyibei').slice(0, 8).map(r => ({
        name: r.name, desc: r.description, url: r.html_url, pushed: r.pushed_at, stars: r.stargazers_count, lang: r.language,
      }));
    }
  };

  // Zenn articles go up on the 高札 as paper strips, newest on the right.
  const hangTanzaku = () => {
    const slot = document.querySelector('#terakoya .tanzaku-slot');
    if (!slot || !feeds.zenn?.length) return;
    const cut = (t, n) => (t.length > n ? t.slice(0, n - 1) + '…' : t);
    slot.innerHTML = feeds.zenn.slice(0, 4).map((a, i) => {
      const x = 258 - i * 8;
      return `<a href="${esc(a.url)}" target="_blank" rel="noopener" aria-label="${esc(a.title)}">
        <rect class="base" x="${x - 3}" y="54" width="6" height="30"/><rect class="ln thin" x="${x - 3}" y="54" width="6" height="30"/>
        <text class="svg-text v" x="${x}" y="56" font-size="3">${esc(cut(a.title, 9))}</text></a>`;
    }).join('');
  };

  const zennList = () => {
    if (!feeds.zenn?.length) return `<ul class="links"><li><a href="https://zenn.dev/hatyibei" target="_blank" rel="noopener">Zenn</a></li></ul>`;
    return `<h3>高札（Zenn）</h3><ul class="feed">${feeds.zenn.map(a =>
      `<li><a href="${esc(a.url)}" target="_blank" rel="noopener"><span class="emoji">${esc(a.emoji)}</span>${esc(a.title)}</a><span class="meta">${fmtDate(a.date)}${a.likes ? ` · ♥ ${a.likes}` : ''}</span></li>`).join('')}</ul>`;
  };

  const reposList = () => {
    if (!feeds.repos?.length) return '';
    return `<h3>最近手を入れた畑（GitHub）</h3><ul class="feed">${feeds.repos.map(r =>
      `<li><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.name)}</a>${r.desc ? `<span class="desc">${esc(r.desc)}</span>` : ''}<span class="meta">${fmtDate(r.pushed)}${r.lang ? ` · ${esc(r.lang)}` : ''}${r.stars ? ` · ★ ${r.stars}` : ''}</span></li>`).join('')}</ul>`;
  };

  // 橋: walk a request across zero-config-cli-bridge's real layers (from its README).
  const mountBridge = host => {
    host.insertAdjacentHTML('beforeend', `
      <h3>渡してみる</h3>
      <div class="bridge-demo">
        <div class="asks">
          <button data-ask="list">「cli/cli の open な issue を見せて」</button>
          <button data-ask="delete">「issue を消して」</button>
          <button data-ask="sneak">「消して」が第一層をすり抜けたら</button>
        </div>
        <ol class="lanes"></ol>
        <p class="note">各層の動きは <a href="https://www.npmjs.com/package/zero-config-cli-bridge" target="_blank" rel="noopener">README</a> に書かれた設計どおり。トークンは橋を渡らない。</p>
      </div>`);
    const lanes = host.querySelector('.lanes');
    const flows = {
      list: [
        ['ok', 'エージェント', 'gh_issue_list { repo: "cli/cli", state: "open" } を呼ぶ'],
        ['ok', '第一層　自制', 'ツールは読み取り専用と書いてある。読むだけなので、通す'],
        ['ok', '第二層　関所', 'create / delete / edit / close / merge … は含まれない。通す'],
        ['ok', '村の外へ', 'gh issue list --repo cli/cli --state open を、手元の gh で実行（CI=true、3秒で打ち切り）'],
        ['ok', '戻り', '結果を最大2000字に切って返す。認証は手元の gh のまま、エージェントは鍵を見ない'],
      ],
      delete: [
        ['ok', 'エージェント', '「issue を消して」と頼まれる'],
        ['stop', '第一層　自制', 'ツールの説明が読み取り専用なので、呼ぶ前に断る。橋には来ない'],
      ],
      sneak: [
        ['ok', 'エージェント', 'それでも gh issue delete を通そうとする'],
        ['pass', '第一層　自制', 'すり抜けた'],
        ['stop', '第二層　関所', '"delete" を見つけて止める ── Mutating commands are blocked'],
      ],
    };
    let run = 0;
    host.querySelectorAll('[data-ask]').forEach(b => b.addEventListener('click', () => {
      const id = ++run;
      lanes.textContent = '';
      flows[b.dataset.ask].forEach(([kind, who, what], i) => {
        setTimeout(() => {
          if (id !== run) return;
          const li = document.createElement('li');
          li.className = kind;
          li.innerHTML = `<b>${who}</b><span>${what}</span>`;
          lanes.appendChild(li);
          window.SOUND?.knock(kind === 'stop' ? 2 : 1);
        }, reduced ? 0 : i * 650);
      });
    }));
  };
  document.getElementById('notebook-btn').addEventListener('click', openNotebook);
  sheet.addEventListener('click', e => { if (e.target === sheet) sheet.close(); });

  // ---------- the armor ----------
  function banished() {
    stamp.innerHTML = '<div class="box">追放<small>管理者権限の濫用につき（十五歳）</small></div>';
    stamp.classList.remove('on');
    void stamp.offsetWidth;
    stamp.classList.add('on');
    document.getElementById('goso')?.classList.add('banned');
    window.SOUND?.thud();
  }

  // ---------- sound ----------
  const soundBtn = document.getElementById('sound-btn');
  soundBtn.addEventListener('click', () => {
    const on = window.SOUND.toggle();
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.textContent = on ? '音 ◉' : '音 ○';
    window.SOUND.setTime(root.dataset.time);
  });

  // ---------- time of day ----------
  let timeMode = 'auto';
  const timeFromClock = () => {
    const h = new Date().getHours();
    return h >= 5 && h < 9 ? 'morning' : h >= 9 && h < 16 ? 'day' : h >= 16 && h < 19 ? 'evening' : 'night';
  };
  const applyTime = () => {
    const tm = timeMode === 'auto' ? timeFromClock() : timeMode;
    if (root.dataset.time !== tm || !C.time) {
      root.dataset.time = tm;
      window.SOUND?.setTime(tm);
      readColors();
      tiles.clear();
      items.forEach(it => { it.dirty = true; });
      document.querySelector('meta[name="theme-color"]').content = getComputedStyle(root).getPropertyValue('--paper').trim();
    }
    document.querySelectorAll('.times button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.time === timeMode)));
  };
  document.querySelectorAll('.times button').forEach(b => b.addEventListener('click', () => { timeMode = b.dataset.time; applyTime(); }));
  setInterval(() => { if (timeMode === 'auto') applyTime(); }, 60000);

  // ---------- boot ----------
  buildScenes();
  applyTime();
  layout();
  const sceneFromHash = () => items.find(it => it.scene && it.scene.id === location.hash.slice(1));
  const start = sceneFromHash();
  if (start) p = target = centerP(start);
  addEventListener('hashchange', () => { const it = sceneFromHash(); if (it) target = centerP(it); });
  addEventListener('resize', () => { layout(); });
  loadFeeds();
  document.fonts?.ready.then(() => layout());
  requestAnimationFrame(t => { last = t; frame(t); });
})();
