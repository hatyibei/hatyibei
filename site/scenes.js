/* はちべえ絵巻 — scenes.
 * Each scene: a picture (SVG, viewBox W×100, ground at y≈96) and its 詞書 (kotoba).
 * Order = time. The scroll is read right → left, so scenes[0] sits at the right end.
 */
(() => {
  // ---------- brush helpers ----------
  const fig = (x, y, s = 1, o = {}) => {
    const flip = o.flip ? -1 : 1;
    const body = o.sit
      ? `<path class="sil" d="M-2.6 -13 Q0 -14.6 2.6 -13 L4.6 -4.2 Q0 -2.6 -5 -4.2 Z"/>`
      : `<path class="sil" d="M-2.4 -13.6 Q0 -15 2.4 -13.6 L3.8 -5 Q0 -4 -3.8 -5 Z"/><path class="ln thin" d="M-1.6 -5 L-2.6 0 M1.6 -5 L2.4 0"/>`;
    const hat = o.kasa ? `<path class="sil" d="M-6.8 -17.6 Q0 -24.5 6.8 -17.6 Q0 -19.2 -6.8 -17.6Z"/>` : '';
    const staff = o.staff ? `<path class="ln" d="M-4.6 -15 L-6.4 0"/>` : '';
    const load = o.load ? `<path class="ln" d="M-8 -14.5 L8 -13.5"/><rect class="wash2" x="5" y="-13.4" width="5" height="5"/><rect class="wash2" x="-10" y="-14.4" width="5" height="5"/>` : '';
    const box = o.box ? `<rect class="sil" x="2.6" y="-12.5" width="5" height="4.4"/>` : '';
    return `<g class="${o.cls || ''}" transform="translate(${x} ${y}) scale(${s * flip} ${s})">${body}<circle class="sil" cx="0" cy="-16.8" r="2.5"/>${hat}${staff}${load}${box}</g>`;
  };

  const pine = (x, y, h = 40, lean = 1) => {
    let s = `<path class="ln thick" d="M${x} ${y} Q${x + 5 * lean} ${y - h * .5} ${x - 3 * lean} ${y - h * .98}"/>`;
    [[.48, 15, 4], [.66, 12, -3], [.82, 10, 3], [.97, 6, -1]].forEach(([t, r, dx]) => {
      const cx = x + dx * lean, cy = y - h * t;
      // a tier of needles: a few overlapping dabs, flat on top, ragged underneath
      const dabs = [[-r * .45, 0, r * .62], [r * .4, .6, r * .6], [0, -.8, r * .5]];
      for (const [ox, oy, rr] of dabs) {
        s += `<ellipse class="base" cx="${cx + ox}" cy="${cy + oy}" rx="${rr}" ry="${rr * .34}"/>`;
        s += `<ellipse class="wash2" cx="${cx + ox}" cy="${cy + oy}" rx="${rr}" ry="${rr * .34}"/>`;
      }
      let d = `M${cx - r} ${cy + 1.2}`;
      for (let i = 1; i <= 5; i++) d += ` Q${cx - r + (i - .5) * r * .4} ${cy - r * .3 - (i % 2) * 1.2} ${cx - r + i * r * .4} ${cy + (i % 2 ? -.4 : .8)}`;
      s += `<path class="ln thin" d="${d}"/>`;
      s += `<path class="ln thin" style="opacity:.6" d="M${cx - r * .7} ${cy + 2} l1 1.6 M${cx - r * .2} ${cy + 2.2} l.6 1.8 M${cx + r * .35} ${cy + 1.8} l1 1.6"/>`;
    });
    return s;
  };

  const tree = (x, y, h = 40) => {
    let s = `<path class="ln thick" d="M${x} ${y} L${x} ${y - h * .5} M${x} ${y - h * .38} L${x - 6} ${y - h * .58} M${x} ${y - h * .45} L${x + 5} ${y - h * .62}"/>`;
    [[-7, .62, 9], [6, .66, 10], [0, .8, 12], [-4, .92, 8], [7, .86, 7]].forEach(([dx, t, r]) => {
      s += `<circle class="base" cx="${x + dx}" cy="${y - h * t}" r="${r}"/><circle class="wash2" cx="${x + dx}" cy="${y - h * t}" r="${r}"/>`;
    });
    s += `<path class="ln thin" d="M${x - 14} ${y - h * .6} Q${x - 10} ${y - h * 1.05} ${x + 2} ${y - h * 1.02} Q${x + 16} ${y - h * .95} ${x + 15} ${y - h * .62}"/>`;
    return s;
  };

  const grass = (x, y, n = 3) => {
    let d = '';
    for (let i = 0; i < n; i++) d += `M${x + i * 2} ${y} Q${x + i * 2 - 1} ${y - 4} ${x + i * 2 - 3 + i} ${y - 6 - (i % 2) * 2} `;
    return `<path class="ln thin" d="${d}"/>`;
  };

  const ground = (w, y = 96) =>
    `<path class="ln" d="M${w * .04} ${y} Q${w * .25} ${y - 1.5} ${w * .5} ${y} T${w * .96} ${y - .5}"/>` +
    `<path class="ln thin" style="opacity:.5" d="M${w * .1} ${y + 2.5} L${w * .3} ${y + 2.2} M${w * .55} ${y + 2.8} L${w * .82} ${y + 2.4}"/>`;

  const chick = (x, y, cls = '') =>
    `<g class="peck ${cls}"><path class="sil" d="M${x - 4} ${y - 3.5} Q${x - 5} ${y - 7.5} ${x - 1.5} ${y - 7.5} L${x - 2} ${y - 9.8} L${x - .2} ${y - 8.6} Q${x + 3} ${y - 9} ${x + 4.5} ${y - 6} Q${x + 3} ${y - 1.6} ${x - 1} ${y - 1.8} Z"/><path class="ln thin" d="M${x - 1} ${y - 2} L${x - 1.4} ${y} M${x + 1} ${y - 2} L${x + 1.2} ${y}"/></g>`;

  const puffs = (x, y) =>
    ['', 'b', 'c'].map(c => `<circle class="wash2 puff ${c}" cx="${x}" cy="${y}" r="2.4" filter="url(#smoke)"/>`).join('');

  const hut = (x, y, label) =>
    `<path class="base" d="M${x - 17} ${y - 24} L${x} ${y - 37} L${x + 17} ${y - 24} Z"/><rect class="base" x="${x - 12}" y="${y - 24}" width="24" height="24"/><rect class="wash" x="${x - 12}" y="${y - 24}" width="24" height="24"/><path class="wash2" d="M${x - 17} ${y - 24} L${x} ${y - 37} L${x + 17} ${y - 24} Z"/>` +
    `<path class="ln" d="M${x - 19} ${y - 23} L${x} ${y - 38} L${x + 19} ${y - 23}"/>` +
    `<path class="ln" d="M${x - 12} ${y - 24} L${x - 12} ${y} M${x + 12} ${y - 24} L${x + 12} ${y}"/>` +
    `<rect class="lamp" x="${x - 4}" y="${y - 18}" width="8" height="7"/>` +
    `<path class="ln thin" d="M${x + 17} ${y} L${x + 17} ${y - 20}"/><rect class="base" x="${x + 13}" y="${y - 36}" width="8" height="19"/><rect class="wash2" x="${x + 13}" y="${y - 36}" width="8" height="19"/>` +
    `<text class="svg-text v" x="${x + 17}" y="${y - 34.5}" font-size="${label.length > 5 ? 2.9 : 3.6}">${label}</text>`;

  const quad = (p0, p1, p2, t) => [
    (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
    (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1],
  ];

  // ---------- 1. 夜更かしの窓 ----------
  const s1 = (() => {
    let thatch = '';
    for (let i = 0; i < 9; i++) thatch += `M${73 + i * 7} 26 L${64 + i * 10} 49 `;
    return `
      ${pine(16, 96, 62)}
      <path class="base" d="M38 51 L70 23 L130 23 L162 51 Z"/><path class="wash2" d="M38 51 L70 23 L130 23 L162 51 Z"/>
      <path class="ln thick" d="M36 52 L70 22 L130 22 L164 52"/>
      <path class="ln thin" d="${thatch}"/>
      <rect class="base" x="48" y="51" width="104" height="45"/><rect class="wash" x="48" y="51" width="104" height="45"/>
      <path class="ln" d="M48 52 L48 96 M152 52 L152 96"/>
      <path class="ln thin" d="M48 62 L152 62"/>
      <path class="wash2" d="M58 96 L58 69 L76 69 L76 96 Z"/>
      <path class="ln" d="M58 96 L58 69 L76 69 L76 96"/>
      <rect class="tv-halo" x="94" y="64" width="46" height="27" rx="4"/>
      <rect class="tv" x="100" y="68" width="34" height="19"/>
      <circle class="backlit" cx="111" cy="76.5" r="3"/>
      <path class="backlit" d="M104.5 87 Q111 79.5 117.5 87 Z"/>
      <circle class="backlit" cx="124" cy="79.4" r="2.3"/>
      <path class="backlit" d="M119.6 87 Q124 81.5 128.4 87 Z"/>
      <path class="ln" d="M100 68 L134 68 L134 87 L100 87 Z"/>
      ${puffs(100, 18)}
      ${chick(84, 96)}${chick(93, 96, 'b')}
      <path class="ln thin" d="M168 96 L168 84 M216 96 L216 84 M168 87.5 L216 87.5 M168 91.5 L216 91.5"/>
      <ellipse class="base" cx="192" cy="82" rx="14" ry="7"/><ellipse class="wash" cx="192" cy="82" rx="14" ry="7"/>
      <path class="ln" d="M178 82 Q180 74.5 192 75 Q204 75 206 80 Q205 88 192 89 Q180 89 178 82 Z"/>
      <ellipse class="sil" cx="207" cy="78" rx="4.2" ry="3"/>
      <path class="ln thin" d="M207 75 L206 72.5 M209 75.4 L210 73"/>
      <ellipse class="sil" cx="187" cy="80" rx="3.2" ry="2"/><ellipse class="sil" cx="196" cy="84" rx="2.5" ry="1.6"/>
      <path class="ln" d="M183 88 L183 95.5 M187 88.5 L187 95.5 M198 88.5 L198 95.5 M202 88 L202 95.5"/>
      <path class="ln thin" d="M178 80 Q175 84 176.5 88"/>
      ${ground(220)}`;
  })();

  // ---------- 2. 書きかけの物語 ----------
  const s2 = `
    ${tree(26, 96, 72)}
    <path class="base" d="M66 53 Q100 37 134 53 L128 55.5 Q100 45 72 55.5 Z"/><path class="wash2" d="M66 53 Q100 37 134 53 L128 55.5 Q100 45 72 55.5 Z"/>
    <path class="ln thick" d="M64 54 Q100 36 136 54"/>
    <path class="ln" d="M78 55 L78 96 M122 55 L122 96"/>
    <path class="ln" d="M88 84 L116 84 M90 84 L90 90 M114 84 L114 90"/>
    <rect x="97" y="81.4" width="10" height="2.6" fill="var(--paper)" class="ln thin"/>
    ${fig(103, 92, 1, { sit: true, flip: true })}
    <path class="ln thin" d="M98.5 79 L96 83.4"/>
    <g class="think"><path class="wash2" d="M120 26 L120 16 L123 16 L123 13 L126 16 L129 13 L132 16 L135 16 L135 26 Z M126 26 L126 21 L129 21 L129 26"/></g>
    <g class="think b"><circle class="wash2" cx="146" cy="38" r="5.4"/><circle class="wash2" cx="141.6" cy="33" r="2"/><circle class="wash2" cx="150.4" cy="33" r="2"/></g>
    <g class="think c"><path class="wash2" d="M96 14 Q104 6 112 12 Q108 10 106 14 Q112 15 116 22 Q106 17 100 20 Q102 17 96 14 Z"/><path class="ln thin" d="M88 30 L100 22"/></g>
    ${grass(140, 96, 3)}${grass(58, 96, 4)}
    ${ground(170)}`;

  // ---------- 3. 五層の洞窟 ----------
  const s3 = (() => {
    let steps = '', torches = '';
    for (let k = 0; k < 5; k++) {
      const y = 62 + k * 7, x1 = 94 + k * 3, x2 = 132 - k * 3;
      steps += `M${x1} ${y} L${x2} ${y} `;
      torches += `<circle class="torch" cx="${x1 + 2 + (k % 2) * (x2 - x1 - 4)}" cy="${y - 2}" r="1.3"/>`;
    }
    let shun = '';
    [[40, 46], [52, 34], [64, 26], [150, 22], [168, 30], [184, 44], [196, 58], [30, 64], [204, 74]].forEach(([x, y]) => {
      shun += `M${x} ${y} Q${x + 2} ${y + 6} ${x - 1} ${y + 12} `;
    });
    return `
      <path class="base" d="M8 96 L30 42 Q58 10 110 18 Q160 6 202 42 L224 96 Z"/><path class="wash" d="M8 96 L30 42 Q58 10 110 18 Q160 6 202 42 L224 96 Z"/>
      <path class="ln thick" d="M8 96 L30 42 Q58 10 110 18 Q160 6 202 42 L224 96"/>
      <path class="ln thin" d="${shun}"/>
      <path class="sil" d="M80 96 Q82 54 113 52 Q144 54 146 96 Z"/>
      <path class="ln thin" style="stroke: var(--paper); opacity: .55" d="${steps}"/>
      ${torches}
      ${fig(156, 96, .82)}${fig(164, 96, .78)}${fig(171, 96, .84)}${fig(178, 96, .8)}
      <g class="hachi">${fig(186, 96, .82)}</g>
      <g class="armor" role="button" tabindex="0" aria-label="鎧に触れる">
        <rect x="190" y="52" width="24" height="46" fill="transparent"/>
        <path class="sil" d="M195.4 67 Q202 58.6 208.6 67 Z"/>
        <path class="shu-ln" d="M199 61.5 L196.2 55 M205 61.5 L207.8 55"/>
        <path class="wash2" d="M195 68.4 L209 68.4 L211 84 L193 84 Z"/>
        <path class="ln" d="M195 68.4 L209 68.4 L211 84 L193 84 Z M194 73.5 L210 73.5 M193.6 78.6 L210.4 78.6"/>
        <path class="ln" d="M202 84 L202 96 M197 96 L207 96"/>
      </g>
      ${ground(230)}`;
  })();

  // ---------- 4. 道標の石 ----------
  const s4 = (() => {
    const stones = [[28, 36, '基本情報'], [70, 31, '応用情報'], [112, 40, 'セキュリティ'], [152, 30, 'Java']];
    let s = `<path class="wash" d="M190 92 Q120 86 62 90 Q30 92 0 88 L0 96 L190 96 Z"/>
             <path class="ln thin" d="M190 92 Q120 86 62 90 Q30 92 0 88"/>`;
    stones.forEach(([x, h, label]) => {
      const top = 96 - h;
      s += `<path class="wash2" d="M${x - 6.5} 96 L${x - 6.5} ${top + 5} Q${x} ${top - 2} ${x + 6.5} ${top + 5} L${x + 6.5} 96 Z"/>`;
      s += `<path class="ln" d="M${x - 6.5} 96 L${x - 6.5} ${top + 5} Q${x} ${top - 2} ${x + 6.5} ${top + 5} L${x + 6.5} 96"/>`;
      s += `<text class="svg-text v" x="${x}" y="${top + 6}" font-size="${label.length > 4 ? 3.8 : 4.6}">${label}</text>`;
      s += grass(x + 8, 96, 3);
    });
    s += `<g class="pace" style="--d:-120px; --t:46s">${fig(176, 92, .85, { kasa: true, staff: true, flip: true })}</g>`;
    return s + ground(190);
  })();

  // ---------- 5. 分校 ----------
  const s5 = (() => {
    let windows = '', heads = [];
    for (let i = 0; i < 5; i++) {
      const x = 40 + i * 32;
      windows += `<rect class="lamp" x="${x}" y="54" width="22" height="16"/><rect class="ln" x="${x}" y="54" width="22" height="16"/>`;
      const hx = x + 6 + (i % 3) * 4, hy = 63 + (i % 2) * 2;
      heads.push([hx, hy]);
      windows += `<circle class="sil" cx="${hx}" cy="${hy}" r="2.2"/><path class="sil" d="M${hx - 3.6} 70 Q${hx} ${hy + 2} ${hx + 3.6} 70 Z"/>`;
    }
    const thread = 'M' + heads.map(([x, y]) => `${x} ${y - 3.5}`).join(' L');
    return `
      ${tree(212, 96, 60)}
      <path class="base" d="M18 45 L40 31 L190 31 L212 45 Z"/><path class="wash2" d="M18 45 L40 31 L190 31 L212 45 Z"/>
      <path class="ln thick" d="M16 46 L40 30 L190 30 L214 46"/>
      <rect class="base" x="30" y="45" width="170" height="51"/><rect class="wash" x="30" y="45" width="170" height="51"/>
      <path class="ln" d="M30 46 L30 96 M200 46 L200 96 M30 78 L200 78"/>
      ${windows}
      <path class="shu-ln thread" d="${thread}"/>
      <path class="ln" d="M108 30 L108 20 L122 20 L122 30"/>
      <rect class="base" x="108" y="20" width="14" height="10"/><path class="base" d="M103 20.5 L115 12 L127 20.5 Z"/><path class="wash2" d="M103 20.5 L115 12 L127 20.5 Z"/><path class="ln" d="M102 21 L115 11.5 L128 21"/>
      <g class="swing"><path class="ln" d="M115 20 L115 22"/><path class="sil" d="M112 27.5 Q112 22 115 22 Q118 22 118 27.5 Z"/></g>
      <path class="wash2" d="M106 96 L106 82 L124 82 L124 96 Z"/><path class="ln" d="M106 96 L106 82 L124 82 L124 96"/>
      <g class="pace" style="--d:38px; --t:12s">${fig(140, 96, .62)}</g>
      <g class="pace" style="--d:-30px; --t:15s">${fig(88, 96, .58, { flip: true })}</g>
      ${ground(230)}`;
  })();

  // ---------- 6. 水路と鐘 ----------
  const s6 = (() => {
    const tower = (x, faint) => `
      <g ${faint ? 'opacity=".42"' : ''}>
        <path class="ln" d="M${x - 10} 96 L${x - 4} 32 M${x + 10} 96 L${x + 4} 32 M${x - 8.4} 78 L${x + 8.4} 78 M${x - 7} 62 L${x + 7} 62 M${x - 5.6} 46 L${x + 5.6} 46 M${x - 8.4} 78 L${x + 7} 62 M${x - 7} 62 L${x + 5.6} 46"/>
        <path class="wash2" d="M${x - 9} 32 L${x} 23 L${x + 9} 32 Z"/><path class="ln" d="M${x - 10} 32.5 L${x} 22.5 L${x + 10} 32.5 M${x - 6} 32 L${x + 6} 32"/>
      </g>`;
    return `
      <path class="wash" d="M0 86 Q120 83 240 86 L240 96 L0 96 Z"/>
      <path class="ln" d="M0 86 Q120 83 240 86"/>
      <path class="ln thin flow" stroke-dasharray="7 9" d="M6 90 L234 90"/>
      <path class="ln thin flow" stroke-dasharray="4 11" style="animation-duration:4.2s" d="M14 93.4 L226 93.4"/>
      ${tower(38, true)}${tower(204, false)}
      <path class="ln thin" stroke-dasharray="2 3" d="M38 34 Q121 18 204 34"/>
      <g class="carry" style="--d:166px"><path class="ln thin" d="M38 32 L38 34.5"/><path class="sil" d="M35 40 Q35 34.5 38 34.5 Q41 34.5 41 40 Z"/></g>
      <path class="ln" d="M104 80 L104 96 M122 80 L122 96"/><rect class="wash2" x="104" y="84" width="18" height="6"/>
      ${fig(132, 86, .9, { flip: true })}
      <path class="ln" d="M126 72 L121 84"/>
      ${grass(70, 86, 4)}${grass(160, 86, 3)}${grass(226, 86, 4)}`;
  })();

  // ---------- 7. 飛脚 ----------
  const s7 = `
    <path class="ln thin" d="M0 96 Q115 94 230 96"/>
    ${hut(26, 96, 'DevOps')}${hut(115, 96, 'Redmine')}${hut(204, 96, 'チャット')}
    <g class="pace" style="--d:150px; --t:7s">${fig(42, 96, .9, { load: true })}</g>
    ${grass(64, 96, 3)}${grass(156, 96, 4)}
    ${ground(230)}`;

  // ---------- 8. 橋 ----------
  const s8 = (() => {
    const P0 = [36, 88], P1 = [125, 42], P2 = [214, 88];
    let posts = '';
    for (let i = 0; i <= 10; i++) {
      const [x, y] = quad(P0, P1, P2, i / 10);
      posts += `M${x.toFixed(1)} ${(y - 1).toFixed(1)} L${x.toFixed(1)} ${(y - 9).toFixed(1)} `;
    }
    const top = quad(P0, P1, P2, .5);
    return `
      <path class="wash" d="M56 92 Q125 89 194 92 L194 100 L56 100 Z"/>
      <path class="ln thin flow" stroke-dasharray="6 10" d="M64 95 L186 95"/>
      <path class="ln thin flow" stroke-dasharray="3 12" style="animation-duration:4s" d="M74 98 L176 98"/>
      <path class="ln thick" d="M${P0} Q${P1} ${P2}"/>
      <path class="ln" d="M36 92 Q125 48 214 92"/>
      <path class="ln thin" d="M36 80 Q125 34 214 80"/>
      <path class="ln thin" d="${posts}"/>
      <path class="ln" d="M84 70 L84 96 M166 70 L166 96"/>
      <g class="bob">${fig(top[0], top[1] - 1, .85, { box: true, flip: true })}</g>
      <rect class="wash2" x="6" y="80" width="22" height="16"/><rect class="ln" x="6" y="80" width="22" height="16"/>
      <text class="svg-text" x="17" y="91" font-size="6" text-anchor="middle">CLI</text>
      <path class="ln thin" d="M10 80 L13 74 L17 76 M22 80 L24 72"/>
      <path class="ln" d="M232 96 L232 64"/><rect class="wash2" x="226" y="58" width="12" height="30"/><rect class="ln thin" x="226" y="58" width="12" height="30"/>
      <text class="svg-text v" x="232" y="60.5" font-size="4.2">設定いらずの橋</text>
      ${grass(196, 92, 3)}${grass(40, 92, 3)}
      <path class="ln" d="M0 92 L56 92 M194 92 L250 92"/>`;
  })();

  // ---------- 9. 峠の茶屋 ----------
  const s9 = (() => {
    let ribs = '';
    for (let i = 0; i <= 6; i++) ribs += `M185 37 L${157 + i * 9.4} ${50 - Math.sin(i / 6 * Math.PI) * 3} `;
    return `
      <path class="base" d="M26 48 L48 32 L146 32 L168 48 Z"/><path class="wash2" d="M26 48 L48 32 L146 32 L168 48 Z"/>
      <path class="ln thick" d="M24 49 L48 31 L146 31 L170 49"/>
      <rect class="base" x="36" y="48" width="122" height="48"/><rect class="wash" x="36" y="48" width="122" height="48"/>
      <path class="ln" d="M36 49 L36 96 M158 49 L158 96"/>
      <rect class="sil" x="74" y="49" width="13" height="20"/><rect class="sil" x="88.5" y="49" width="13" height="20"/>
      <text x="80.5" y="62.5" font-size="8" text-anchor="middle" fill="var(--paper)" font-family="Yuji Syuku, serif">診</text>
      <text x="95" y="62.5" font-size="8" text-anchor="middle" fill="var(--paper)" font-family="Yuji Syuku, serif">断</text>
      <path class="wash2" d="M74 96 L74 72 L102 72 L102 96 Z"/>
      <g class="swing"><path class="ln thin" d="M50 49 L50 53"/><ellipse class="lamp-halo" cx="50" cy="59" rx="9" ry="10"/><ellipse class="lamp" cx="50" cy="59" rx="4.4" ry="6"/><ellipse class="ln thin" cx="50" cy="59" rx="4.4" ry="6"/></g>
      <path class="shu" d="M155 50.5 Q185 33 215 50.5 Q185 46 155 50.5 Z"/>
      <path class="shu-ln" style="opacity:.5" d="${ribs}"/>
      <path class="ln" d="M185 40 L185 96"/>
      <rect class="shu" x="160" y="80" width="50" height="4"/>
      <path class="ln" d="M163 84 L163 96 M207 84 L207 96"/>
      ${fig(176, 82, .85, { sit: true, flip: true })}
      <path class="ln thin" d="M194 80 L197 80 L197 76.5 L193.5 76.5 Z"/>${puffs(195, 72)}
      <path class="sil" d="M222 96 Q216 96 216.5 91 Q217.4 87 221 87 L220.6 83.5 L222.6 85.4 L224.6 83.6 L224.6 87 Q227.8 88.4 227 96 Z"/>
      <path class="ln" d="M227 95 Q232 94 231 89"/>
      ${ground(234)}`;
  })();

  // ---------- 10. 寺子屋 ----------
  const s10 = (() => {
    let kids = '';
    [[62, 0], [80, 0], [98, 0], [70, 1], [88, 1], [106, 1]].forEach(([x, r]) => {
      kids += fig(x + r * 2, 80 + r * 0, .62, { sit: true });
    });
    return `
      ${pine(206, 96, 66, -1)}
      <path class="base" d="M14 47 Q38 45 56 30 L150 30 Q168 45 192 47 L182 51 L24 51 Z"/><path class="wash2" d="M14 47 Q38 45 56 30 L150 30 Q168 45 192 47 L182 51 L24 51 Z"/>
      <path class="ln thick" d="M12 47 Q38 45 56 29 L150 29 Q168 45 194 47"/>
      <path class="ln" d="M24 51 L182 51"/>
      <rect class="base" x="34" y="51" width="138" height="45"/><rect class="wash" x="34" y="51" width="138" height="29"/>
      <path class="ln" d="M36 51 L36 96 M170 51 L170 96 M30 80 L176 80 M30 83 L176 83"/>
      <path class="ln thin" d="M36 96 L36 83 M170 96 L170 83 M74 83 L74 96 M132 83 L132 96"/>
      <rect x="120" y="54" width="16" height="22" fill="var(--paper)" class="ln thin"/>
      <text class="svg-text v" x="128" y="57" font-size="7" font-family="Yuji Syuku, serif">学</text>
      ${kids}
      ${fig(150, 80, .9, { flip: true })}
      <path class="ln thin" d="M146 70 L137 64"/>
      <rect class="lamp" x="42" y="58" width="5" height="7"/><rect class="lamp" x="160" y="58" width="5" height="7"/>
      <path class="ln" d="M90 96 L90 86 L116 86 L116 96 M90 90 L116 90"/>
      <g class="kousatsu">
        <path class="ln" d="M232 96 L232 52 M262 96 L262 52"/>
        <path class="base" d="M226 50 L247 42 L268 50 Z"/><path class="wash2" d="M226 50 L247 42 L268 50 Z"/><path class="ln" d="M225 50.5 L247 41.5 L269 50.5"/>
        <rect class="base" x="230" y="52" width="34" height="34"/><rect class="ln" x="230" y="52" width="34" height="34"/>
        <g class="tanzaku-slot"><text class="svg-text v" x="247" y="56" font-size="3.6" text-anchor="start">記事は Zenn に</text></g>
      </g>
      ${ground(272)}`;
  })();

  // ---------- 11. 峠 ----------
  const s11 = (() => {
    const signs = [
      [200, 'GitHub', 'https://github.com/hatyibei'],
      [222, 'X', 'https://x.com/hatyibeiSE'],
      [244, 'Zenn', 'https://zenn.dev/hatyibei'],
    ];
    let posts = '';
    signs.forEach(([x, label, href], i) => {
      const top = 62 + i * 3;
      posts += `<a href="${href}" target="_blank" rel="noopener" aria-label="${label}">
        <path class="ln" d="M${x} 96 L${x} ${top}"/>
        <rect class="wash2" x="${x - 6}" y="${top - 2}" width="12" height="24"/><rect class="ln thin" x="${x - 6}" y="${top - 2}" width="12" height="24"/>
        <text class="svg-text v" x="${x}" y="${top + 1}" font-size="4.6">${label}</text>
        <rect x="${x - 7}" y="${top - 3}" width="14" height="${99 - top}" fill="transparent"/></a>`;
    });
    return `
      <g opacity=".3">${pine(28, 46, 40)}</g>
      <g opacity=".55">${pine(70, 58, 46, -1)}</g>
      <path class="base" d="M260 96 Q180 92 124 72 Q72 52 0 44 L0 100 L260 100 Z"/><path class="wash" d="M260 96 Q180 92 124 72 Q72 52 0 44 L0 100 L260 100 Z"/>
      <path class="ln thick" d="M260 96 Q180 92 124 72 Q72 52 0 44"/>
      <g class="bob">${fig(146, 81, 1, { kasa: true, staff: true, flip: true })}</g>
      ${posts}
      ${grass(110, 69, 3)}${grass(172, 89, 4)}`;
  })();

  const scenes = [
    {
      id: 'yofukashi', no: '一', title: '夜更かしの窓', era: '七つの頃', w: 220, svg: s1,
      kotoba: ['父と夜更かしして、', 'テレビの中の牧場をのぞいていた。', '畑が育ち、村人が暮らしていた。', '画面の向こうに、世界があった。'],
      more: `<p>PS2 の牧場物語。手をかけた畑や動物が育っていくこと、そしてその世界の住民が、そこでちゃんと暮らしているとわかったこと。それが楽しくて、楽しくて仕方がなかった。</p><p>七つの頃の、夜の部屋と、テレビの光と、隣にいた父。画面の向こうに世界がある、という感覚は、今もそのまま残っている。</p>`,
    },
    {
      id: 'monogatari', no: '二', title: '書きかけの物語', era: '十四の頃', w: 170, svg: s2,
      kotoba: ['ぬいぐるみ遊びの続きのように、', '頭の中の世界を', '文字にしはじめた。'],
      more: `<p>子どもの頃から、頭の中に世界を作って、その中で物語を進める遊びをしていた。中学二年の頃、それを少しだけ小説として書いた。</p><p>頭の中の世界を外に出す、最初の試み。</p>`,
    },
    {
      id: 'goso', no: '三', title: '五層の洞窟', era: '十五の頃', w: 230, svg: s3,
      kotoba: ['友と五人で、', '五層あるRPGの鯖を営んだ。', '仕組みを組み、街を建て、', 'クエストを書いた。', 'そしてある日――'],
      more: `<p>Minecraft のRPGマルチサーバーを、友だち五人で運営していた。プラグインやコマンドを設定し、マップや街を作り、クエストや設定を考えた。</p><p>仕組みと、空間と、物語。世界を作るための三つを、このとき全部触っていた。</p><p>……そのあとのことは、洞窟の前の鎧に聞いてください。</p>`,
    },
    {
      id: 'michishirube', no: '四', title: '道標の石', era: '十七〜二十', w: 190, svg: s4,
      kotoba: ['世界の仕組みを語る言葉を、', 'ひとつずつ拾った。'],
      more: `<p>2019年、十七歳で基本情報技術者に合格。2020年に KCS福岡情報専門学校（3年課程）へ入学し、在学中に応用情報技術者、情報セキュリティマネジメント、Oracle Java Silver SE 11 を取得した。</p>`,
    },
    {
      id: 'bunkou', no: '五', title: '分校', era: '卒業制作', w: 230, svg: s5,
      kotoba: ['人が集まり、すれ違い、', '話しかけられる場所を作った。', '教室に、人の気配を通した。'],
      more: `<p>卒業制作は、oVice のような仮想オフィスをモチーフにした「仮想学校」。チームのリーダーとして、企画・設計・サーバー構築・実装をひと通り担当し、Java で WebSocket のリアルタイム通信を組んだ。</p><p>マイクラの鯖と同じで、作っていたのは「人が住む場所」だった。</p>`,
    },
    {
      water: true, id: 'suiro', no: '六', title: '水路と鐘', era: '二〇二三〜二〇二五', w: 240, svg: s6,
      kotoba: ['すでにある世界の、', '手入れをした。', '水路を見回り、', '鐘を新しい櫓へ移した。'],
      more: `<p>2023年4月、SIer（株式会社エスシーシー）に新卒で入社。クレジットカード会社向けスマホアプリの保守開発で、Java / Oracle DB / SQL を使って機能改善、不具合調査、データ調査をしていた。</p><p>2024年4月〜2025年2月は、PUSH 通知基盤のマイグレーションを担当。移行設計と、Shell Script によるバッチを作った。</p><p>壊さずに、手をかけ続ける。牧場と同じ仕事。</p>`,
    },
    {
      id: 'hikyaku', no: '七', title: '飛脚', era: '二〇二五', w: 230, svg: s7,
      kotoba: ['道具と道具のあいだを走る、', '飛脚をつくった。', '住民が、自分で動きはじめた。'],
      more: `<p>2025年8月、社内の AI テックリードチームへ異動。Azure DevOps・Redmine・チャットツールをつなぐ進捗管理エージェントを、Python + Azure OpenAI で企画から導入まで担当した。</p><p>頭の中の世界を、具体にできる。それに感動したのが、AI に本気になったきっかけ。</p>`,
    },
    {
      id: 'hashi', no: '八', title: '橋', era: 'zero-config-cli-bridge', w: 250, svg: s8, demo: 'bridge', water: true,
      kotoba: ['村の外にある力を、', '村へ通す橋。', '設定は、いらない。', '渡れるものと、渡れないもの。'],
      more: `<p>手元の CLI を、そのまま AI エージェントの道具として使えるようにする MCP ミドルウェア。設定ゼロで、ローカルの力をエージェントの世界へ渡す。</p>`,
      links: [['npm', 'https://www.npmjs.com/package/zero-config-cli-bridge'], ['GitHub', 'https://github.com/hatyibei/zero-config-cli-bridge']],
    },
    {
      id: 'chaya', no: '九', title: '峠の茶屋', era: 'gen-diag.com', w: 234, svg: s9,
      kotoba: ['峠の茶屋では、', 'ちょっとした占いが出る。', '一人ひとりに合わせて。'],
      more: `<p>LLM で一人ひとりに合わせた診断コンテンツを生成する「バズ診断」プラットフォーム。自分で作って、自分で営んでいる店。</p>`,
      links: [['gen-diag.com', 'https://gen-diag.com']],
    },
    {
      id: 'terakoya', no: '十', title: '寺子屋', era: '勉強会・出張授業・Zenn', w: 272, svg: s10, feed: 'zenn',
      kotoba: ['見てきた世界の話を、', '次の人に。', '高札には、書いたものを貼る。'],
      more: `<p>社内で AI 勉強会を主催し、高校生向けに AI の出張授業をした。</p><p>高札には、Zenn に書いた記事を貼っている。</p>`,
    },
    {
      id: 'touge', no: '十一', title: '峠', era: '二〇二六〜', w: 260, svg: s11,
      kotoba: ['現場へ出る。', '人の暮らす場所に入り込んで、', 'そこで作る。', 'この先は、まだ霧の中。'],
      more: `<p>2026年7月、AI スタートアップ（株式会社Kiva）に Forward Deployed Engineer として転職。</p><p>小学生の頃に好きだった時代劇の八兵衛は、町を歩き、現場の人の中に入って、情と直感で動く人だった。その名前を借りて、今は本当に現場へ出ている。</p>`,
      links: [['GitHub', 'https://github.com/hatyibei'], ['X', 'https://x.com/hatyibeiSE'], ['Zenn', 'https://zenn.dev/hatyibei']],
    },
  ];

  const notebook = `
    <h2>旅人の手帳</h2>
    <p class="era">急ぎの旅人のための、ふつうの経歴</p>
    <p><strong>hatyibei</strong>（はちべえ）— AI Engineer / Forward Deployed Engineer。LLM プロダクトとエージェントを、企画から現場への導入まで作る。</p>
    <h3>経歴</h3>
    <table>
      <tr><td>2026.07–</td><td>株式会社Kiva — Forward Deployed Engineer</td></tr>
      <tr><td>2025.08–2026</td><td>SIer 社内 AI テックリードチーム — 進捗管理エージェント（Python + Azure OpenAI。Azure DevOps / Redmine / チャット連携）を企画から導入まで。社内 AI 勉強会の主催、高校生向け AI 出張授業</td></tr>
      <tr><td>2024.04–2025.02</td><td>PUSH 通知基盤のマイグレーション（移行設計、Shell バッチ）</td></tr>
      <tr><td>2023.04–</td><td>株式会社エスシーシー — カード会社向けスマホアプリの保守開発（Java / Oracle DB / SQL）</td></tr>
      <tr><td>2020–2023</td><td>KCS福岡情報専門学校。卒業制作「仮想学校」（リーダー。Java / WebSocket）</td></tr>
    </table>
    <h3>作ったもの</h3>
    <ul>
      <li><a href="https://gen-diag.com" target="_blank" rel="noopener">gen-diag.com</a> — LLM によるパーソナライズ診断プラットフォーム</li>
      <li><a href="https://www.npmjs.com/package/zero-config-cli-bridge" target="_blank" rel="noopener">zero-config-cli-bridge</a> — ローカル CLI を AI エージェントのツールにする設定ゼロの MCP ミドルウェア</li>
    </ul>
    <h3>資格</h3>
    <p>基本情報技術者（2019）、応用情報技術者、情報セキュリティマネジメント、Oracle Java Silver SE 11</p>
    <h3>名前</h3>
    <p>小学生の頃に好きだった時代劇『八丁堀の七人』の八兵衛から。</p>
    <ul class="links">
      <li><a href="https://github.com/hatyibei" target="_blank" rel="noopener">GitHub</a></li>
      <li><a href="https://x.com/hatyibeiSE" target="_blank" rel="noopener">X</a></li>
      <li><a href="https://zenn.dev/hatyibei" target="_blank" rel="noopener">Zenn</a></li>
    </ul>`;

  window.EMAKI = { scenes, notebook };
})();
