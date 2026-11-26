/* 달성 수학 10분 — 📐 각도기 · 📏 자 (필기 모드에서, 모든 학년이 같이 씀)
   끌어서 옮기고, 파란 ↻ 손잡이로 돌림.
   각도기: 중심(+)을 꼭짓점에, 밑금을 한 변에 맞추고, 빨간 바늘 끝 동그라미를 끌어 다른 변에 맞추면
           바깥 눈금(오른쪽이 0)·안쪽 눈금(왼쪽이 0) 각도가 나옴.
   자: 0을 한 끝에 맞추고 빨간 표시를 다른 끝으로 끌면 길이가 나옴.
   돌리기·바늘은 1° 단위, 자 표시는 1mm 단위로 맞춰짐 → 그림이 정확하면 해설지 답과 똑같이 나옴. */

const SVGNS = 'http://www.w3.org/2000/svg';
const measure = { protractor: null, ruler: null };
const toDeg = r => r * 180 / Math.PI, toRad = d => d * Math.PI / 180;

function svgEl(tag, attrs, parent) {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
  if (parent) parent.append(n);
  return n;
}
/* 화면에서의 방향(dx, dy) → 도구 안쪽 좌표 (도구가 rot° 돌아가 있을 때) */
function toLocal(dx, dy, rot) {
  const r = toRad(rot), c = Math.cos(r), s = Math.sin(r);
  return [dx * c + dy * s, -dx * s + dy * c];
}

/* 도구를 담는 층: 페이지 크기에 맞춰 잘라서, 도구가 화면 밖으로 나가도 페이지가 옆으로 밀리지 않게 */
function measureLayer() {
  let layer = document.getElementById('measurelayer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'measurelayer';
    document.body.append(layer);
  }
  return layer;
}

function measureButton(kind) {
  return typeof scratch === 'object' ? (kind === 'protractor' ? scratch.protBtn : scratch.rulerBtn) : null;
}
function measureToggle(kind) {
  const t = measure[kind];
  if (t && t.svg.style.display !== 'none') measureHide(kind);
  else measureShow(kind);
}
function measureHide(kind) {
  const t = measure[kind];
  if (t) t.svg.style.display = 'none';
  const b = measureButton(kind);
  if (b) b.setAttribute('aria-pressed', 'false');
}
function measureShow(kind) {
  if (!measure[kind]) measure[kind] = kind === 'protractor' ? buildProtractor() : buildRuler();
  const t = measure[kind];
  // 지금 보이는 화면 가운데쯤에 꺼냄
  if (kind === 'protractor') { t.x = scrollX + innerWidth / 2; t.y = scrollY + innerHeight * 0.55; }
  else { t.x = scrollX + Math.max(30, innerWidth / 2 - t.len / 2); t.y = scrollY + innerHeight * 0.4; }
  t.rot = 0;
  t.svg.style.display = '';
  t.place();
  const b = measureButton(kind);
  if (b) b.setAttribute('aria-pressed', 'true');
}

/* ---------- 그림 맞춤점 (data.js 의 FIGURE_POINTS) ---------- */
const SNAP_PX = 22, SNAP_DEG = 3;
const angDiff = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);
function figurePoints() {
  const table = typeof FIGURE_POINTS === 'object' ? FIGURE_POINTS : {};
  const out = [];
  document.querySelectorAll('img[data-fig]').forEach(img => {
    const P = table[img.dataset.fig];
    if (!P || !img.naturalWidth || !img.clientWidth) return;
    const r = img.getBoundingClientRect(), k = img.clientWidth / img.naturalWidth;
    const ox = r.left + img.clientLeft + scrollX, oy = r.top + img.clientTop + scrollY;
    P.forEach(p => out.push({ x: ox + p.v[0] * k, y: oy + p.v[1] * k, rays: p.rays }));
  });
  return out;
}
/* 도구 중심(각도기 중심 / 자의 0)을 꼭짓점 가까이 놓으면 딱 붙임 */
function snapCenter(t) {
  let best = null, bd = SNAP_PX;
  for (const p of figurePoints()) { const d = Math.hypot(p.x - t.x, p.y - t.y); if (d < bd) { bd = d; best = p; } }
  t.snap = best;
  if (best) { t.x = best.x; t.y = best.y; }
  t.svg.classList.toggle('snapped', !!best);
}
/* 돌리기: 꼭짓점에 붙어 있으면 밑금(자)을 선 방향에 딱 맞춤. 화면 각도 = -(수학 각도) */
function snapRotation(t, raw, bothEnds) {
  if (t.snap) for (const a of t.snap.rays) for (const c of bothEnds ? [-a, 180 - a] : [-a]) if (angDiff(raw, c) < SNAP_DEG) return ((c % 360) + 360) % 360;
  return Math.round(raw);
}

/* 끌기: mode 'move' = 옮기기, 'rotate' = 돌리기(손잡이가 도구 안에서 handleAngle° 방향에 있음), 함수 = 그 밖 */
function measureDrag(t, target, mode, handleAngle) {
  target.addEventListener('pointerdown', e => {
    e.preventDefault();
    e.stopPropagation();
    target.setPointerCapture(e.pointerId);
    const sx = e.pageX, sy = e.pageY, ox = t.x, oy = t.y;
    const move = ev => {
      if (mode === 'move') { t.x = ox + ev.pageX - sx; t.y = oy + ev.pageY - sy; snapCenter(t); }
      else if (mode === 'rotate') { t.rot = snapRotation(t, toDeg(Math.atan2(ev.pageY - t.y, ev.pageX - t.x)) - handleAngle, t.kind === 'protractor'); }
      else mode(ev);
      t.place();
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  });
}

/* ---------------- 📐 각도기 ---------------- */
function buildProtractor() {
  const R = Math.round(Math.min(230, Math.max(150, innerWidth * 0.34)));
  const E = R + 12, L = Math.round(R * 1.32), S = L + 34;
  const svg = svgEl('svg', { class: 'measure protractor', width: 2 * S, height: 2 * S, viewBox: `${-S} ${-S} ${2 * S} ${2 * S}` });
  const g = svgEl('g', {}, svg);
  svgEl('path', { class: 'mbody', d: `M ${-E} 16 L ${-E} 0 A ${E} ${E} 0 0 1 ${E} 0 L ${E} 16 Z` }, g);
  svgEl('path', { class: 'mline', d: `M ${-R * 0.42} 0 A ${R * 0.42} ${R * 0.42} 0 0 1 ${R * 0.42} 0` }, g);
  for (let a = 0; a <= 180; a++) {
    const len = a % 10 === 0 ? 16 : a % 5 === 0 ? 11 : 6;
    const c = Math.cos(toRad(a)), s = Math.sin(toRad(a));
    svgEl('line', { class: 'tick', x1: E * c, y1: -E * s, x2: (E - len) * c, y2: -(E - len) * s }, g);
    if (a % 10 === 0) {
      const r1 = E - 28, r2 = E - 50;
      svgEl('text', { class: 'num out', x: r1 * c, y: -r1 * s, transform: `rotate(${90 - a} ${r1 * c} ${-r1 * s})` }, g).textContent = a;        // 바깥: 오른쪽이 0
      svgEl('text', { class: 'num in', x: r2 * c, y: -r2 * s, transform: `rotate(${90 - a} ${r2 * c} ${-r2 * s})` }, g).textContent = 180 - a;  // 안쪽: 왼쪽이 0
    }
  }
  svgEl('line', { class: 'base', x1: -E, y1: 0, x2: E, y2: 0 }, g);   // 밑금
  svgEl('circle', { class: 'center', cx: 0, cy: 0, r: 3.5 }, g);
  svgEl('path', { class: 'centerx', d: 'M -10 0 L 10 0 M 0 -10 L 0 10' }, g);
  // 빨간 바늘: 끝 동그라미를 끌어 다른 변에 맞춤
  const armG = svgEl('g', {}, g);
  svgEl('line', { class: 'arm', x1: 0, y1: 0, x2: L, y2: 0 }, armG);
  const knob = svgEl('circle', { class: 'knob', cx: L, cy: 0, r: 15 }, armG);
  // 돌리기 손잡이: 밑금 왼쪽 끝 바깥
  const rotG = svgEl('g', { class: 'rotate' }, g);
  svgEl('circle', { class: 'handle', cx: -(E + 24), cy: 0, r: 17 }, rotG);
  svgEl('text', { class: 'handletxt', x: -(E + 24), y: 1 }, rotG).textContent = '↻';
  // 읽은 값 (도구와 같이 돌지 않음)
  const ro = svgEl('g', { class: 'readout' }, svg);
  svgEl('rect', { x: -118, y: 28, width: 236, height: 34, rx: 10 }, ro);
  const roText = svgEl('text', { x: 0, y: 46 }, ro);
  const tOut = svgEl('tspan', { class: 'out' }, roText);
  svgEl('tspan', {}, roText).textContent = '  ·  ';
  const tIn = svgEl('tspan', { class: 'in' }, roText);
  measureLayer().append(svg);

  const t = { kind: 'protractor', svg, x: 0, y: 0, rot: 0, arm: 60, R, S };
  t.place = () => {
    svg.style.left = (t.x - S) + 'px';
    svg.style.top = (t.y - S) + 'px';
    g.setAttribute('transform', `rotate(${t.rot})`);
    armG.setAttribute('transform', `rotate(${-t.arm})`);
    t.out = t.arm;
    t.in = 180 - t.arm;
    tOut.textContent = `바깥 눈금 ${t.out}°`;
    tIn.textContent = `안쪽 눈금 ${t.in}°`;
  };
  measureDrag(t, svg.querySelector('.mbody'), 'move');
  measureDrag(t, rotG, 'rotate', 180);
  measureDrag(t, knob, ev => {
    const [lx, ly] = toLocal(ev.pageX - t.x, ev.pageY - t.y, t.rot);
    let a = toDeg(Math.atan2(-ly, lx));
    if (a < 0) a = a < -90 ? 180 : 0;
    t.arm = Math.round(a);
    // 꼭짓점에 붙어 있으면, 선 가까이 온 바늘을 선에 딱 맞춤 (도구 안 각도 = 선의 각도 + 돌린 각도)
    if (t.snap) for (const r of t.snap.rays) {
      const c = ((((r + t.rot) % 360) + 540) % 360) - 180;
      if (c >= 0 && c <= 180 && Math.abs(a - c) < SNAP_DEG) { t.arm = Math.round(c); break; }
    }
  });
  return t;
}

/* ---------------- 📏 자 ---------------- */
function buildRuler() {
  const PXCM = 96 / 2.54, CM = 15, len = Math.round(PXCM * CM), H = 58, S = len + 74;
  const svg = svgEl('svg', { class: 'measure ruler', width: 2 * S, height: 2 * S, viewBox: `${-S} ${-S} ${2 * S} ${2 * S}` });
  const g = svgEl('g', {}, svg);
  svgEl('rect', { class: 'mbody', x: -14, y: 0, width: len + 28, height: H, rx: 6 }, g);
  for (let mm = 0; mm <= CM * 10; mm++) {
    const x = mm * PXCM / 10, l = mm % 10 === 0 ? 18 : mm % 5 === 0 ? 12 : 7;
    svgEl('line', { class: 'tick', x1: x, y1: 0, x2: x, y2: l }, g);
    if (mm % 10 === 0) svgEl('text', { class: 'num', x, y: 31 }, g).textContent = mm / 10;
  }
  svgEl('text', { class: 'unitcm', x: len - 4, y: H - 8 }, g).textContent = 'cm';
  // 빨간 표시: 끌면 0부터의 길이가 나옴
  const mk = svgEl('g', {}, g);
  svgEl('line', { class: 'arm', x1: 0, y1: -8, x2: 0, y2: H }, mk);
  const mknob = svgEl('path', { class: 'knob', d: 'M -13 -30 L 13 -30 L 0 -8 Z' }, mk);
  const lab = svgEl('text', { class: 'rlabel', x: 0, y: -36 }, mk);
  // 돌리기 손잡이: 자 오른쪽 끝 바깥 (0 눈금 기준으로 돌아감)
  const rotG = svgEl('g', { class: 'rotate' }, g);
  svgEl('circle', { class: 'handle', cx: len + 42, cy: 0, r: 17 }, rotG);
  svgEl('text', { class: 'handletxt', x: len + 42, y: 1 }, rotG).textContent = '↻';
  measureLayer().append(svg);

  const t = { kind: 'ruler', svg, x: 0, y: 0, rot: 0, mm: 30, len, S, PXCM };
  t.place = () => {
    svg.style.left = (t.x - S) + 'px';
    svg.style.top = (t.y - S) + 'px';
    g.setAttribute('transform', `rotate(${t.rot})`);
    mk.setAttribute('transform', `translate(${t.mm * PXCM / 10} 0)`);
    t.cm = t.mm / 10;
    lab.textContent = String(t.cm) + ' cm';
  };
  measureDrag(t, svg.querySelector('.mbody'), 'move');
  measureDrag(t, rotG, 'rotate', 0);
  measureDrag(t, mknob, ev => {
    const [lx] = toLocal(ev.pageX - t.x, ev.pageY - t.y, t.rot);
    t.mm = Math.max(0, Math.min(CM * 10, Math.round(lx / (PXCM / 10))));
  });
  return t;
}
