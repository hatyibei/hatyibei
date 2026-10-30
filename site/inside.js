/* はちべえ絵巻 — inside the television.
 * Click the lit window in scene 一: the painting zooms toward it (near things faster than far),
 * the screen's light fills the view, and you come out inside the farm on the screen —
 * painted planes standing at different depths, drifting apart as you look around.
 * Seeds sown here grow in real time and are still growing when you come back.
 */
(() => {
  const { inside, fig, chick } = window.EMAKI;
  const view = window.EMAKI_VIEW;
  const root = document.documentElement;
  const el = document.getElementById('inside');
  const rig = el.querySelector('.rig');
  const flash = document.getElementById('flash');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STORE = 'emaki-farm-v1';

  // depth of each plane (px toward the viewer; negative is farther away)
  const PLANES = [
    { key: 'far', z: -900, a: .7 },
    { key: 'mist', z: -620, a: 1 },
    { key: 'mid', z: -420, a: .9 },
    { key: 'mist', z: -260, a: .8 },
    { key: 'field', z: -120, a: 1 },
    { key: 'near', z: 140, a: 1 },
  ];
  const PERSPECTIVE = 900;

  // ---------- the farm's memory ----------
  const load = () => {
    try { return JSON.parse(localStorage.getItem(STORE)) || { plots: [] }; } catch { return { plots: [] }; }
  };
  const save = st => { try { localStorage.setItem(STORE, JSON.stringify(st)); } catch { /* the farm forgets */ } };
  // seed → sprout in under a minute, leaves in minutes, a flower in an hour, fruit the next day
  const STAGES = [0, 25e3, 4 * 60e3, 60 * 60e3, 24 * 60 * 60e3];
  const stageOf = t => { const age = Date.now() - t; let s = 0; STAGES.forEach((ms, i) => { if (age >= ms) s = i; }); return s; };
  const WORDS = ['種', '芽', '葉', '花', '実'];

  let built = false, planes = [], plotEls = [], state = load(), W = 0, H = 0;

  const build = () => {
    W = innerWidth; H = innerHeight;
    rig.textContent = '';
    planes = [];
    plotEls = [];
    const colors = view.colors(), dpr = Math.min(view.dpr, 1.5);
    for (const P of PLANES) {
      // every plane is scaled so that, at rest, it fills the view as if it were at the screen
      const s = (PERSPECTIVE - P.z) / PERSPECTIVE;
      const wrap = document.createElement('div');
      wrap.className = `plane ${P.key}`;
      wrap.dataset.z = P.z;
      const pw = W * 1.25, ph = H;
      wrap.style.width = `${pw}px`; wrap.style.height = `${ph}px`;
      wrap.style.transform = `translate(-50%, -50%) translateZ(${P.z}px) scale(${s})`;
      if (P.key !== 'mist') {
        const c = document.createElement('canvas');
        wrap.appendChild(c);
        window.BRUSH.paintCanvas(c, pw, ph, colors, dpr, B => inside[P.key](B), P.z & 0xff);
      }
      if (P.key === 'mid') wrap.appendChild(residents(pw, ph));
      if (P.key === 'field') plots(wrap, pw, ph, colors, dpr);
      rig.appendChild(wrap);
      planes.push({ el: wrap, z: P.z, s, a: P.a });
    }
    built = true;
  };

  // villagers, chickens and the cow's neighbours live on the middle plane (SVG, so they move)
  const residents = (pw, ph) => {
    const u = ph / 100, vw = pw / u;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${vw} 100`);
    svg.setAttribute('class', 'residents');
    svg.innerHTML = `
      <g class="pace" style="--d:${vw * .16}px; --t:30s">${fig(vw * .34, 80, .5)}</g>
      <g class="pace" style="--d:-${vw * .08}px; --t:22s">${fig(vw * .8, 80, .46, { flip: true, load: true })}</g>
      <g transform="translate(${vw * .5} 81) scale(.45)">${chick(0, 0)}${chick(9, 1, 'b')}${chick(-8, 1.5)}</g>
      ${Array.from({ length: 9 }, (_, i) => `<circle class="kodama" style="--i:${i}" cx="${vw * (.12 + i * .095)}" cy="${62 + (i * 37 % 17)}" r="${.7 + (i % 3) * .25}"/>`).join('')}`;
    return svg;
  };

  const plots = (wrap, pw, ph, colors, dpr) => {
    const u = ph / 100;
    inside.plots(pw / u).forEach((p, i) => {
      const b = document.createElement('button');
      b.className = 'plot';
      b.style.left = `${(p.x - 9) * u}px`;
      b.style.top = `${(p.y - 22) * u}px`;
      b.style.width = `${18 * u}px`;
      b.style.height = `${26 * u}px`;
      const c = document.createElement('canvas');
      b.appendChild(c);
      const tag = document.createElement('span');
      b.appendChild(tag);
      b.addEventListener('click', () => sow(i));
      wrap.appendChild(b);
      plotEls[i] = { b, c, tag, stage: -1, w: 18 * u, h: 26 * u, colors, dpr };
    });
    refreshPlots(true);
  };

  const refreshPlots = force => {
    plotEls.forEach((p, i) => {
      const t = state.plots[i];
      const st = t ? stageOf(t) : -1;
      if (st === p.stage && !force) return;
      p.stage = st;
      p.b.setAttribute('aria-label', t ? `畑 ${i + 1}：${WORDS[st]}` : `畑 ${i + 1}：種をまく`);
      p.tag.textContent = t ? WORDS[st] : '';
      const ctx = p.c.getContext('2d');
      if (!t) { p.c.width = p.c.height = 1; ctx.clearRect(0, 0, 1, 1); return; }
      window.BRUSH.paintCanvas(p.c, p.w, p.h, p.colors, p.dpr, B => inside.plant(B, st), 31 + i);
    });
  };

  const sow = i => {
    if (state.plots[i]) {
      // touching a plant just rustles it
      const p = plotEls[i].b;
      p.classList.remove('rustle'); void p.offsetWidth; p.classList.add('rustle');
      window.SOUND?.knock(1);
      return;
    }
    state.plots[i] = Date.now();
    save(state);
    window.SOUND?.knock(2);
    refreshPlots();
  };
  setInterval(() => { if (INSIDE.active) refreshPlots(); }, 5000);

  // ---------- looking around ----------
  let look = { x: 0, y: 0, tx: 0, ty: 0 }, depth = 0, raf = 0;
  const onMove = e => {
    const p = e.touches ? e.touches[0] : e;
    look.tx = (p.clientX / innerWidth - .5) * 2;
    look.ty = (p.clientY / innerHeight - .5) * 2;
  };
  const tick = () => {
    look.x += (look.tx - look.x) * .06;
    look.y += (look.ty - look.y) * .06;
    const drift = reduced ? 0 : Math.sin(performance.now() / 4000) * .15;
    rig.style.transform = `translateZ(${depth}px) rotateY(${(look.x + drift) * 4}deg) rotateX(${-look.y * 2.5}deg) translateX(${-look.x * 30}px)`;
    raf = requestAnimationFrame(tick);
  };

  // ---------- going in and coming out ----------
  const tween = (ms, fn) => new Promise(res => {
    if (reduced) { fn(1); res(); return; }
    const t0 = performance.now();
    const step = now => {
      const t = Math.min(1, (now - t0) / ms);
      fn(t);
      t < 1 ? requestAnimationFrame(step) : res();
    };
    requestAnimationFrame(step);
  });
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  const INSIDE = {
    active: false,
    busy: false,
    async enter(target) {
      if (this.active || this.busy) return;
      this.busy = true;
      const r = target.getBoundingClientRect();
      const zm = view.zoom;
      zm.ox = r.left + r.width / 2; zm.oy = r.top + r.height / 2;
      window.SOUND?.knock(1);
      flash.style.setProperty('--ox', `${zm.ox}px`);
      flash.style.setProperty('--oy', `${zm.oy}px`);
      // 1. lean in toward the window; the screen's light grows until it is all there is
      await tween(1700, t => {
        const e = ease(t);
        zm.z = 1 + e * e * 22;
        flash.style.opacity = Math.max(0, (e - .45) / .55);
      });
      if (!built || W !== innerWidth || H !== innerHeight || root.dataset.time !== this.time) build();
      this.time = root.dataset.time;
      view.hidden = true;
      el.hidden = false;
      el.setAttribute('aria-hidden', 'false');
      this.active = true;
      addEventListener('pointermove', onMove);
      addEventListener('touchmove', onMove, { passive: true });
      cancelAnimationFrame(raf); tick();
      // 2. the light thins into mist; the farm's planes come forward out of it
      await tween(1900, t => {
        const e = ease(t);
        flash.style.opacity = 1 - e;
        depth = -700 * (1 - e);
        planes.forEach((p, i) => { p.el.style.opacity = Math.max(0, Math.min(p.a, e * 1.6 - i * .08)); });
      });
      depth = 0;
      el.querySelector('.leave').focus({ preventScroll: true });
      this.busy = false;
    },
    async leave() {
      if (!this.active || this.busy) return;
      this.busy = true;
      window.SOUND?.knock(1);
      await tween(1100, t => {
        const e = ease(t);
        flash.style.opacity = e;
        depth = -700 * e;
      });
      el.hidden = true;
      el.setAttribute('aria-hidden', 'true');
      this.active = false;
      cancelAnimationFrame(raf);
      removeEventListener('pointermove', onMove);
      removeEventListener('touchmove', onMove);
      view.hidden = false;
      const zm = view.zoom;
      await tween(1500, t => {
        const e = ease(t);
        flash.style.opacity = 1 - e;
        zm.z = 1 + (1 - e) * (1 - e) * 22;
      });
      zm.z = 1;
      document.querySelector('#yofukashi .portal')?.focus({ preventScroll: true });
      this.busy = false;
    },
  };
  el.querySelector('.leave').addEventListener('click', () => INSIDE.leave());
  addEventListener('keydown', e => { if (e.key === 'Escape' && INSIDE.active) INSIDE.leave(); });
  addEventListener('resize', () => { if (INSIDE.active) build(); else built = false; });
  window.INSIDE = INSIDE;
})();
