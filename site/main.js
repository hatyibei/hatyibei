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
    { f: .05, base: .44, amp: .28, a: .2, fade: .24, sc: 1.1, seed: 11, ridged: true, trees: 0 },
    { f: .13, base: .53, amp: .22, a: .3, fade: .2, sc: .7, seed: 23, ridged: true, trees: 0 },
    { f: .28, base: .62, amp: .14, a: .38, fade: .17, sc: .48, seed: 37, ridged: false, trees: .3 },
    { f: .52, base: .71, amp: .09, a: .5, fade: .14, sc: .34, seed: 41, ridged: false, trees: .5 },
    { f: 1, base: .815, amp: .012, a: .18, fade: .1, sc: .25, seed: 53, ridged: false, trees: 0 },
  ];
  const ridge = (L, x) => {
    let n = fbm(x / (H * L.sc), L.seed);
    n = Math.min(1, Math.max(0, (n - .22) / .56));
    if (L.ridged) n = Math.pow(1 - Math.abs(2 * n - 1) * .9, 1.7) * .55 + n * .45;
    return H * L.base - H * L.amp * n;
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
    // wash: each column is ink at the ridge, dissolving downward into paper — the mist is what's left out
    const fadeAt = x => H * L.fade * (.65 + vnoise((x0 + x) / 90, L.seed + 2) * .7);
    for (let i = 0; i < pts.length - 1; i++) {
      const [x, y] = pts[i];
      const len = fadeAt(x);
      const gr = g.createLinearGradient(0, y, 0, y + len);
      gr.addColorStop(0, `rgba(${C.ink}, ${L.a})`);
      gr.addColorStop(.25, `rgba(${C.ink}, ${L.a * .55})`);
      gr.addColorStop(.6, `rgba(${C.ink}, ${L.a * .16})`);
      gr.addColorStop(1, `rgba(${C.ink}, 0)`);
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(x, y); g.lineTo(pts[i + 1][0], pts[i + 1][1]);
      g.lineTo(pts[i + 1][0], y + len); g.lineTo(x, y + len);
      g.closePath(); g.fill();
    }
    // 皴 — a few hanging strokes for the grain of the rock
    for (let x = 0; x <= TILE; x += 4) {
      const r = hash(x0 + x, L.seed + 7);
      if (r > .07) continue;
      const y = ridge(L, x0 + x);
      const len = fadeAt(x) * (.1 + hash(x0 + x, L.seed + 9) * .25);
      const gr = g.createLinearGradient(0, y, 0, y + len);
      gr.addColorStop(0, `rgba(${C.ink}, ${L.a * .9})`);
      gr.addColorStop(1, `rgba(${C.ink}, 0)`);
      g.strokeStyle = gr;
      g.lineWidth = .8 + r * 8;
      g.beginPath(); g.moveTo(x, y + 1); g.quadraticCurveTo(x + (r - .08) * 40, y + len * .5, x - 3, y + len); g.stroke();
    }
    // ridge line, drawn twice with a little wobble like a brush
    g.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      g.strokeStyle = `rgba(${C.ink}, ${Math.min(.85, L.a * (pass ? .7 : 1.35))})`;
      g.lineWidth = (.7 + L.f * 1.8) * (pass ? 2.2 : 1);
      g.beginPath();
      pts.forEach(([x, y], i) => {
        const w = pass ? (vnoise((x0 + x) / 23, L.seed + 40) - .5) * 1.6 : 0;
        i ? g.lineTo(x, y + w) : g.moveTo(x, y + w);
      });
      g.stroke();
    }
    // trees on the ridge
    if (L.trees) {
      const sz = H * (.008 + L.f * .02);
      for (let x = 0; x <= TILE; x += 7) {
        const r = hash(x0 + x, L.seed + 3);
        if (r > L.trees * .32) continue;
        const y = ridge(L, x0 + x) + sz * .15;
        const h = sz * (1 + hash(x0 + x, L.seed + 5) * 1.3);
        g.strokeStyle = `rgba(${C.ink}, ${L.a * 1.6})`;
        g.fillStyle = `rgba(${C.ink}, ${L.a * 1.1})`;
        g.lineWidth = Math.max(.6, h * .06);
        g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - h); g.stroke();
        for (let t = 0; t < 3; t++) {
          const ty = y - h * (.45 + t * .22), rx = h * (.34 - t * .08);
          g.beginPath(); g.ellipse(x, ty, rx, rx * .32, 0, 0, Math.PI * 2); g.fill();
        }
      }
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
      const mx = W * .74, my = H * .2, r = U * .045;
      const halo = bctx.createRadialGradient(mx, my, r * .8, mx, my, r * 5);
      halo.addColorStop(0, 'rgba(240, 235, 215, .22)'); halo.addColorStop(1, 'rgba(240, 235, 215, 0)');
      bctx.fillStyle = halo; bctx.beginPath(); bctx.arc(mx, my, r * 5, 0, Math.PI * 2); bctx.fill();
      bctx.fillStyle = 'rgba(242, 237, 220, .92)';
      bctx.beginPath(); bctx.arc(mx, my, r, 0, Math.PI * 2); bctx.fill();
      return;
    }
    const sun = { morning: [.7, .3, .045, .45], day: [.62, .14, .04, .12], evening: [.3, .37, .065, .7] }[tm];
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
        openScene(s);
      });
      art.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openScene(s); } });
      const k = document.createElement('div');
      k.className = 'kotoba';
      k.innerHTML = `<span class="no">${s.no}</span><h2>${s.title}</h2><p class="era">${s.era}</p>` +
        s.kotoba.map(l => `<p>${l}</p>`).join('');
      const more = document.createElement('button');
      more.className = 'more';
      more.textContent = 'つづきを読む';
      more.addEventListener('click', () => openScene(s));
      k.appendChild(more);
      el.append(art, k);
      world.appendChild(el);
      items.push({ el, art, scene: s });
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
    seedAmbient();
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
    world.style.transform = `translate3d(${-camX}px,0,0)`;

    bctx.clearRect(0, 0, W, H);
    drawSky(t);
    LAYERS.forEach((L, li) => {
      const lx = camX * L.f;
      const k0 = Math.floor(lx / TILE), k1 = Math.floor((lx + W) / TILE);
      for (let k = k0; k <= k1; k++) bctx.drawImage(getTile(li, k), k * TILE - lx, 0, TILE, H);
      if (li < LAYERS.length - 1) drawMist(bctx, li, t, camX);
    });

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
    requestAnimationFrame(frame);
  };

  // ---------- input ----------
  stage.addEventListener('wheel', e => {
    e.preventDefault();
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
    if (sheet.open) return;
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
  };
  const openScene = s => {
    const links = s.links ? `<ul class="links">${s.links.map(([l, h]) => `<li><a href="${h}" target="_blank" rel="noopener">${l}</a></li>`).join('')}</ul>` : '';
    openSheet(`<h2 id="sheet-title">${s.no}　${s.title}</h2><p class="era">${s.era}</p>${s.more}${links}`);
  };
  function openNotebook() { openSheet(notebook); }
  document.getElementById('notebook-btn').addEventListener('click', openNotebook);
  sheet.addEventListener('click', e => { if (e.target === sheet) sheet.close(); });

  // ---------- the armor ----------
  function banished() {
    stamp.innerHTML = '<div class="box">追放<small>管理者権限の濫用につき（十五歳）</small></div>';
    stamp.classList.remove('on');
    void stamp.offsetWidth;
    stamp.classList.add('on');
    document.getElementById('goso')?.classList.add('banned');
  }

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
      readColors();
      tiles.clear();
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
  const jump = location.hash.slice(1);
  const start = items.find(it => it.scene && it.scene.id === jump);
  if (start) p = target = centerP(start);
  addEventListener('resize', () => { layout(); });
  document.fonts?.ready.then(() => layout());
  requestAnimationFrame(t => { last = t; frame(t); });
})();
