/* はちべえ絵巻 — the brush.
 * Re-paints each scene's SVG with a simulated 筆: a stroke is a bundle of bristles that
 * load at the 起筆, swell, run dry into 飛白 and lift off at the end; a wash bleeds into
 * the paper and pools at its edge. Moving things (residents, smoke, links) stay as SVG.
 */
(() => {
  const WASH_DABS = 26;
  // painting by hand: lights and backlit figures are painted too, only motion stays SVG
  const KEEP_HAND = '.portal, .pace, .peck, .puff, .bob, .swing, .carry, .think, .armor, .hachi, a, .kousatsu, .keep, .lamp-halo, .torch, .thread, .flow, text';
  const KEEP = '.pace, .peck, .puff, .bob, .swing, .carry, .think, .armor, .hachi, a, .kousatsu, .keep, .tv, .tv-halo, .lamp, .lamp-halo, .torch, .backlit, .thread, .flow, text';

  const hash = (i, s) => {
    let h = Math.imul(i | 0, 374761393) ^ Math.imul(s | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const noise = (x, s) => {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return hash(i, s) * (1 - u) + hash(i + 1, s) * u;
  };
  const rng = seed => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

  let canFilter = null;
  const filterOK = ctx => {
    if (canFilter === null) canFilter = typeof ctx.filter === 'string';
    return canFilter;
  };

  // ---------- a stroke ----------
  // pts: [[x, y], ...] in canvas px. w: brush width in px.
  const stroke = (ctx, pts, w, rgb, alpha, seed, dryOverride) => {
    const n = pts.length;
    if (n < 2) return;
    const L = [0];
    for (let i = 1; i < n; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = L[n - 1];
    if (total < .5) return;
    const r = rng(seed * 7919 + 13);
    const normals = pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
      return [-dy / d, dx / d];
    });
    const shortStroke = total < w * 6;
    // 起筆 presses hard, the body eases off and breathes, 収筆 lifts away
    const press = .9 + r() * .5, lift = .18 + r() * .2;
    const prof = t => {
      const head = 1 + press * Math.exp(-t * 14) * .6;
      const out = Math.min(1, .08 + (1 - t) / lift);
      return head * out * (.78 + .22 * Math.sin(t * Math.PI * (1 + r() * .0)));
    };

    // the wet body underneath, slightly bled
    ctx.save();
    if (filterOK(ctx)) ctx.filter = `blur(${Math.max(.6, w * .18)}px)`;
    ctx.strokeStyle = `rgba(${rgb}, ${alpha * .22})`;
    ctx.lineWidth = w * .9;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    ctx.restore();

    // bristles
    const nb = Math.max(4, Math.min(22, Math.round(w * 2.4)));
    const dry = dryOverride ?? (shortStroke ? .08 : Math.min(1.1, .35 + r() * .5 + total / (w * 120)));
    ctx.lineCap = 'round';
    for (let b = 0; b < nb; b++) {
      const off = (nb === 1 ? 0 : (b / (nb - 1)) * 2 - 1) + (r() - .5) * .2;
      const load = 1.05 + r() * .25 - Math.abs(off) * .35;
      const thirst = dry * (.5 + r() * 1.1);
      const thr = .32 + r() * .2;
      const ns = seed * 31 + b * 17;
      ctx.lineWidth = Math.max(.5, (w / nb) * 2.3);
      let open = false, inkSum = 0, cnt = 0;
      const flush = () => {
        if (!open) return;
        ctx.strokeStyle = `rgba(${rgb}, ${Math.min(1, alpha * (inkSum / cnt))})`;
        ctx.stroke();
        open = false; inkSum = 0; cnt = 0;
      };
      for (let i = 0; i < n; i++) {
        const t = L[i] / total;
        const ww = w * prof(t) * (.88 + .24 * noise(L[i] * .04, ns));
        const ink = load - thirst * t * (.7 + .6 * noise(L[i] * .02, ns + 5)) + (noise(L[i] * .3, ns + 9) - .5) * .35 * dry;
        const x = pts[i][0] + normals[i][0] * off * ww * .5;
        const y = pts[i][1] + normals[i][1] * off * ww * .5;
        if (ink > thr) {
          if (!open) { ctx.beginPath(); ctx.moveTo(x, y); open = true; } else ctx.lineTo(x, y);
          inkSum += Math.min(1, ink); cnt++;
        } else flush();
      }
      flush();
    }
    // ink pooled where the brush first touched
    const [sx, sy] = pts[0];
    ctx.fillStyle = `rgba(${rgb}, ${alpha * .35})`;
    ctx.beginPath(); ctx.arc(sx, sy, w * .42, 0, Math.PI * 2); ctx.fill();
  };

  // ---------- a wash ----------
  const wash = (ctx, path, rgb, alpha, blurPx, edgeW, bbox, seed) => {
    // uneven ink inside the shape: a few soft dabs, heavier toward one side
    if (bbox && bbox.width * bbox.height > 4) {
      const r = rng(seed * 104729 + 7);
      ctx.save();
      ctx.clip(path);
      if (filterOK(ctx)) ctx.filter = `blur(${blurPx * 1.6}px)`;
      const side = r() < .5 ? 0 : 1;
      for (let i = 0; i < WASH_DABS; i++) {
        const u = side ? 1 - Math.pow(r(), 1.8) : Math.pow(r(), 1.8);
        const x = bbox.x + bbox.width * (r() * .9 + .05), y = bbox.y + bbox.height * u;
        const rx = Math.max(bbox.width, bbox.height) * (.08 + r() * .2);
        ctx.fillStyle = `rgba(${rgb}, ${alpha * (.25 + r() * .35)})`;
        ctx.beginPath(); ctx.ellipse(x, y, rx, rx * (.35 + r() * .5), (r() - .5) * .6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.filter = 'none';
      ctx.restore();
    }
    if (filterOK(ctx)) {
      ctx.filter = `blur(${blurPx}px)`;
      ctx.fillStyle = `rgba(${rgb}, ${alpha * .45})`;
      ctx.fill(path);
      ctx.filter = 'none';
    }
    ctx.fillStyle = `rgba(${rgb}, ${alpha * .45})`;
    ctx.fill(path);
    // 墨溜まり: as the wash dries the pigment gathers at its edge
    if (filterOK(ctx)) ctx.filter = `blur(${blurPx * .3}px)`;
    ctx.strokeStyle = `rgba(${rgb}, ${alpha * .55})`;
    ctx.lineWidth = edgeW;
    ctx.stroke(path);
    ctx.filter = 'none';
  };

  // ---------- reading the SVG ----------
  const toD = el => {
    const n = k => parseFloat(el.getAttribute(k)) || 0;
    switch (el.tagName) {
      case 'path': return el.getAttribute('d');
      case 'rect': { const x = n('x'), y = n('y'), w = n('width'), h = n('height'); return `M${x} ${y} L${x + w} ${y} L${x + w} ${y + h} L${x} ${y + h} Z`; }
      case 'circle': { const cx = n('cx'), cy = n('cy'), r = n('r'); return `M${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy} Z`; }
      case 'ellipse': { const cx = n('cx'), cy = n('cy'), rx = n('rx'), ry = n('ry'); return `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`; }
    }
    return null;
  };
  const subpaths = d => d.split(/(?=M)/).map(s => s.trim()).filter(Boolean);

  const opacityOf = (el, svg) => {
    let o = 1;
    for (let e = el; e && e !== svg; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity);
    return o;
  };

  // ---------- painting by hand: primitives in viewBox units ----------
  // A scene can bring its own `paint(B)` instead of having its SVG traced.
  const painter = (ctx, k, margin, dpr, colors, seed0) => {
    const P = ([x, y]) => [dpr * (x * k + margin), dpr * (y * k + margin)];
    const px = v => v * k * dpr;
    let seed = seed0;
    const r = rng(seed0 * 977 + 3);
    // Catmull-Rom through the control points, sampled about every 1.2 device px
    const spline = cps => {
      const p = cps.map(P);
      if (p.length === 2) {
        const [a, b] = p, n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.2));
        return Array.from({ length: n + 1 }, (_, i) => [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]);
      }
      const out = [];
      for (let i = 0; i < p.length - 1; i++) {
        const p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(p.length - 1, i + 2)];
        const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 1.2));
        for (let j = 0; j < n; j++) {
          const t = j / n, t2 = t * t, t3 = t2 * t;
          out.push([0, 1].map(c => .5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
        }
      }
      out.push(p[p.length - 1]);
      return out;
    };
    const B = {
      r,
      // 中鋒: an ordinary stroke
      stroke(cps, w, o = {}) {
        stroke(ctx, spline(cps), px(w), o.shu ? colors.shu : colors.line, o.a ?? .9, seed++, o.dry);
      },
      // 側筆: the side of the brush, broad and dry
      side(cps, w, o = {}) {
        stroke(ctx, spline(cps), px(w), colors.line, o.a ?? .5, seed++, o.dry ?? 1);
      },
      // 没骨: a shape made of a single wet blot, no outline
      blob(cx, cy, rx, ry, o = {}) {
        const a = o.a ?? .5, rot = o.rot ?? 0, ink = o.shu ? colors.shu : colors.line;
        const [X, Y] = P([cx, cy]);
        const RX = px(rx), RY = px(ry);
        const s = seed++;
        const edge = th => 1 + (noise(th * 3 + s, s) - .5) * (o.rough ?? .35);
        const shape = sc => {
          ctx.beginPath();
          for (let i = 0; i <= 48; i++) {
            const th = i / 48 * Math.PI * 2, e = edge(th) * sc;
            const x = Math.cos(th) * RX * e, y = Math.sin(th) * RY * e;
            const xr = X + x * Math.cos(rot) - y * Math.sin(rot), yr = Y + x * Math.sin(rot) + y * Math.cos(rot);
            i ? ctx.lineTo(xr, yr) : ctx.moveTo(xr, yr);
          }
          ctx.closePath();
        };
        if (filterOK(ctx)) ctx.filter = `blur(${Math.max(1, Math.min(RX, RY) * .25)}px)`;
        ctx.fillStyle = `rgba(${ink}, ${a * .55})`;
        shape(1.08); ctx.fill();
        ctx.filter = 'none';
        ctx.fillStyle = `rgba(${ink}, ${a * .45})`;
        shape(.92); ctx.fill();
        if (filterOK(ctx)) ctx.filter = `blur(${Math.max(.6, dpr * .5)}px)`;
        ctx.strokeStyle = `rgba(${ink}, ${a * .35})`;
        ctx.lineWidth = Math.max(1, dpr * .9);
        shape(.95); ctx.stroke();
        ctx.filter = 'none';
      },
      // 苔点 / 米点: dots of ink
      dot(x, y, rr, o = {}) {
        B.blob(x, y, rr * (o.wide ?? 1), rr, { a: o.a ?? .75, rough: .5, rot: o.rot ?? (r() - .5) * .5 });
      },
      // paper laid down to hide what is behind; soft at the edge so it reads as mist
      paper(poly, soft = 2) {
        const pts = poly.map(P);
        const path = () => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
        ctx.fillStyle = colors.paperCss;
        if (filterOK(ctx)) { ctx.filter = `blur(${px(soft)}px)`; path(); ctx.fill(); ctx.filter = 'none'; }
        ctx.save(); ctx.globalAlpha = .85; path(); ctx.fill(); ctx.restore();
      },
      // light that is not ink: a lit window, a screen
      glow(x, y, w, h, css, a = 1, soft = 1) {
        const [X, Y] = P([x, y]);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = css;
        if (filterOK(ctx)) ctx.filter = `blur(${px(soft)}px)`;
        ctx.fillRect(X, Y, px(w), px(h));
        ctx.restore();
      },
      time: colors.time,
      // a cluster of pine needles, fanned upward
      needles(cx, cy, rad, o = {}) {
        const a = o.a ?? .8, n = o.n ?? 15, spread = o.spread ?? 2.6, tilt = o.tilt ?? 0;
        B.blob(cx, cy - rad * .25, rad * 1.05, rad * .38, { a: (o.wash ?? .16), rough: .5 });
        for (let i = 0; i < n; i++) {
          const th = -Math.PI / 2 + tilt + (i / (n - 1) - .5) * spread + (r() - .5) * .12;
          const len = rad * (.75 + r() * .35);
          B.stroke([[cx, cy], [cx + Math.cos(th) * len, cy + Math.sin(th) * len * .55]], .55, { a, dry: .2 });
        }
      },
    };
    return B;
  };

  // Paint every still element of `svg` onto `canvas` (which overhangs the svg by `margin` px).
  const paint = (svg, canvas, margin, colors, dpr, byHand) => {
    if (byHand) {
      const box = svg.getBoundingClientRect();
      const W = box.width + margin * 2, H = box.height + margin * 2;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const el of svg.querySelectorAll('path, rect, circle, ellipse')) if (!el.closest(KEEP_HAND)) el.style.visibility = 'hidden';
      byHand(painter(ctx, box.height / 100, margin, dpr, colors, 11));
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = grain(ctx);
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
      return;
    }
    const box = svg.getBoundingClientRect();
    const W = box.width + margin * 2, H = box.height + margin * 2;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const unit = box.height / 100;              // px per viewBox unit
    const scale = Math.max(.6, unit / 4);       // brush size relative to the design size
    const els = [...svg.querySelectorAll('path, rect, circle, ellipse')];
    let seed = 1;
    for (const el of els) {
      seed++;
      if (el.closest(KEEP)) continue;
      const cls = el.classList;
      const fillAttr = el.getAttribute('fill');
      if (fillAttr === 'transparent') continue;
      const d = toD(el);
      if (!d) continue;
      const m = el.getCTM();
      if (!m) continue;
      const op = opacityOf(el, svg);
      const T = [dpr * m.a, dpr * m.b, dpr * m.c, dpr * m.d, dpr * (m.e + margin), dpr * (m.f + margin)];
      const rgbFill = cls.contains('shu') ? colors.shu : colors.line;

      if (cls.contains('base') || fillAttr === 'var(--paper)') {
        ctx.setTransform(...T);
        ctx.fillStyle = colors.paperCss;
        ctx.fill(new Path2D(d));
      }
      if (cls.contains('wash') || cls.contains('wash2') || cls.contains('sil') || cls.contains('shu')) {
        const a = cls.contains('sil') ? .85 : cls.contains('shu') ? .9 : cls.contains('wash2') ? colors.wash * 2 : colors.wash;
        ctx.setTransform(...T);
        wash(ctx, new Path2D(d), rgbFill, a * op * (cls.contains('wash') || cls.contains('wash2') ? 1.5 : 1), 2.2 * scale * dpr, (1.6 * scale) / (m.a || 1), cls.contains('sil') || cls.contains('shu') ? null : el.getBBox(), seed);
      }
      if (cls.contains('ln') || cls.contains('shu-ln')) {
        const w = (cls.contains('thick') ? 7 : cls.contains('thin') ? 2.2 : 4.2) * scale * dpr;
        const rgb = cls.contains('shu-ln') ? colors.shu : colors.line;
        const a = (cls.contains('thin') ? .8 : .92) * op;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        for (const sub of subpaths(d)) {
          const tmp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          tmp.setAttribute('d', sub);
          el.parentNode.insertBefore(tmp, el);
          const len = tmp.getTotalLength();
          const step = Math.max(.25, 1.6 / (m.a || 1));
          const k = Math.max(2, Math.ceil(len / step));
          const pts = [];
          for (let i = 0; i <= k; i++) {
            const p = tmp.getPointAtLength((i / k) * len);
            pts.push([dpr * (m.a * p.x + m.c * p.y + m.e + margin), dpr * (m.b * p.x + m.d * p.y + m.f + margin)]);
          }
          tmp.remove();
          stroke(ctx, pts, w, rgb, a, seed);
          seed += 3;
        }
      }
      el.style.visibility = 'hidden';
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // the paper drinks some of the ink unevenly
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = grain(ctx);
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
  };

  let grainPattern = null;
  const grain = ctx => {
    if (grainPattern) return grainPattern;
    const c = document.createElement('canvas');
    c.width = c.height = 192;
    const g = c.getContext('2d');
    const r = rng(42);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(0,0,0,${.03 + r() * .1})`;
      g.beginPath();
      g.ellipse(r() * 192, r() * 192, .4 + r() * 2.6, .3 + r() * .9, r() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
    grainPattern = ctx.createPattern(c, 'repeat');
    return grainPattern;
  };

  // Paint a free-standing canvas by hand. Units: 100 = canvas height; B.W is the width in units.
  const paintCanvas = (canvas, wPx, hPx, colors, dpr, fn, seed = 5) => {
    canvas.width = Math.round(wPx * dpr); canvas.height = Math.round(hPx * dpr);
    canvas.style.width = `${wPx}px`; canvas.style.height = `${hPx}px`;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const B = painter(ctx, hPx / 100, 0, dpr, colors, seed);
    B.W = wPx / (hPx / 100);
    fn(B);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = grain(ctx);
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
  };

  window.BRUSH = { paint, paintCanvas, stroke, hash, noise };
})();
