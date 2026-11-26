/* 달성 수학 10분 — 손글씨 (모든 학년이 같이 씀)
   1) ✏️ 필기: 문제 화면 위에 펜으로 직접 풀이 (태블릿 펜·손가락)
   2) ✍️ 손글씨 답: 답 칸 옆 버튼 → 손으로 쓰면 글자로 바꿔 답 칸에 자동으로 넣음
      → 학생이 답 칸을 보고 맞으면 그대로, 틀리게 들어갔으면 직접 고침
   글자 인식: 구글 필기 인식 (쓴 획의 좌표만 보냄. 이름 등 다른 정보는 보내지 않음)
   인식이 안 되면(인터넷·서비스 문제) 키보드로 쓰면 됨. */

/* ============================================================
   공통: 캔버스에 획 그리기
   ============================================================ */
function inkCanvasSetup(canvas, cssW, cssH) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  return ctx;
}
function inkDrawStroke(ctx, s) {
  const p = s.pts;
  if (!p.length) return;
  ctx.save();
  ctx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over';
  ctx.strokeStyle = s.color || '#1d2433';
  ctx.fillStyle = s.color || '#1d2433';
  ctx.lineWidth = s.width;
  if (p.length === 1) {
    ctx.beginPath(); ctx.arc(p[0][0], p[0][1], s.width / 2, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
    ctx.stroke();
  }
  ctx.restore();
}
const inkEvents = e => (e.getCoalescedEvents && e.getCoalescedEvents().length ? e.getCoalescedEvents() : [e]);

/* ============================================================
   1) ✏️ 필기 — 화면 위에 펜으로 쓰기
   ============================================================ */
const scratch = {
  key: null, strokes: new Map(), on: false, pan: false, tool: 'pen', color: '#1d2433', penSeen: false,
  canvas: null, ctx: null, cur: null, fab: null, bar: null,
};

function scratchInit() {
  if (scratch.canvas) return;
  const c = document.createElement('canvas');
  c.id = 'scratch';
  c.setAttribute('aria-hidden', 'true');
  document.body.append(c);
  scratch.canvas = c;

  scratch.fab = Object.assign(document.createElement('button'), { type: 'button', className: 'scratchfab', textContent: '✏️ 필기' });
  scratch.fab.title = '화면에 펜으로 풀이를 써요';
  scratch.fab.addEventListener('click', () => scratchMode(true));
  document.body.append(scratch.fab);

  const bar = document.createElement('div');
  bar.className = 'scratchbar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', '필기 도구');
  const tools = [
    ['pen', '#1d2433', '검정 펜'], ['pen', '#d6402f', '빨강 펜'], ['pen', '#2f6fde', '파랑 펜'],
  ];
  for (const [tool, color, label] of tools) {
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'tool color' });
    b.dataset.tool = tool; b.dataset.color = color; b.title = label; b.setAttribute('aria-label', label);
    b.innerHTML = `<span style="background:${color}"></span>`;
    bar.append(b);
  }
  const mk = (cls, text, title, fn) => {
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'tool ' + cls, textContent: text, title });
    b.addEventListener('click', fn); bar.append(b); return b;
  };
  mk('eraser', '🧽 지우개', '지우개', () => scratchTool('eraser'));
  mk('undo', '↶', '되돌리기', () => { const s = scratchStrokes(); s.pop(); scratchRedraw(); });
  mk('clear', '🗑', '모두 지우기', () => { scratchStrokes().length = 0; scratchRedraw(); });
  scratch.protBtn = mk('protractor', '📐 각도기', '각도기를 꺼내요 (끌어서 옮기고, ↻ 손잡이로 돌려요)', () => measureToggle('protractor'));
  scratch.rulerBtn = mk('ruler', '📏 자', '자를 꺼내요 (끌어서 옮기고, ↻ 손잡이로 돌려요)', () => measureToggle('ruler'));
  scratch.panBtn = mk('pan', '✋ 화면 움직이기', '필기를 잠깐 멈추고 화면을 위아래로 움직여요', () => scratchPan(!scratch.pan));
  mk('done primary', '필기 끝', '필기를 끝내요 (쓴 것은 남아요)', () => scratchMode(false));
  bar.querySelectorAll('.tool.color').forEach(b => b.addEventListener('click', () => { scratch.color = b.dataset.color; scratchTool('pen'); }));
  document.body.append(bar);
  scratch.bar = bar;

  c.addEventListener('pointerdown', e => {
    if (!scratch.on || scratch.pan) return;
    if (e.pointerType === 'pen') scratch.penSeen = true;
    if (scratch.penSeen && e.pointerType === 'touch') return; // 펜을 쓰면 손바닥 터치는 무시
    e.preventDefault();
    c.setPointerCapture(e.pointerId);
    const erase = scratch.tool === 'eraser';
    scratch.cur = { color: scratch.color, width: erase ? 28 : 3, erase, pts: [[e.pageX, e.pageY]] };
    scratchStrokes().push(scratch.cur);
    inkDrawStroke(scratch.ctx, scratch.cur);
  });
  c.addEventListener('pointermove', e => {
    if (!scratch.cur) return;
    e.preventDefault();
    for (const ev of inkEvents(e)) {
      const last = scratch.cur.pts[scratch.cur.pts.length - 1];
      scratch.cur.pts.push([ev.pageX, ev.pageY]);
      inkDrawStroke(scratch.ctx, { ...scratch.cur, pts: [last, [ev.pageX, ev.pageY]] });
    }
  });
  const end = () => { scratch.cur = null; };
  c.addEventListener('pointerup', end);
  c.addEventListener('pointercancel', end);

  window.addEventListener('resize', scratchFit);
  const app = document.getElementById('app');
  if (app && 'ResizeObserver' in window) new ResizeObserver(() => scratchFit()).observe(app);
  scratchTool('pen');
}
function scratchStrokes() {
  if (!scratch.strokes.has(scratch.key)) scratch.strokes.set(scratch.key, []);
  return scratch.strokes.get(scratch.key);
}
function scratchFit() {
  if (!scratch.canvas) return;
  const d = document.documentElement;
  const w = Math.max(d.scrollWidth, d.clientWidth), h = Math.max(d.scrollHeight, document.body.scrollHeight);
  if (scratch.canvas.width === Math.round(w * (window.devicePixelRatio || 1)) && scratch.canvas.style.height === h + 'px') return;
  scratch.ctx = inkCanvasSetup(scratch.canvas, w, h);
  scratchRedraw();
}
function scratchRedraw() {
  if (!scratch.ctx) return;
  scratch.ctx.clearRect(0, 0, scratch.canvas.width, scratch.canvas.height);
  if (scratch.key) for (const s of scratchStrokes()) inkDrawStroke(scratch.ctx, s);
}
function scratchTool(tool) {
  scratch.tool = tool;
  scratch.bar.querySelectorAll('.tool.color').forEach(b => b.setAttribute('aria-pressed', String(tool === 'pen' && b.dataset.color === scratch.color)));
  scratch.bar.querySelector('.eraser').setAttribute('aria-pressed', String(tool === 'eraser'));
  scratchPan(false);
}
function scratchPan(on) {
  scratch.pan = on;
  scratch.panBtn.setAttribute('aria-pressed', String(on));
  scratch.panBtn.textContent = on ? '✏️ 다시 쓰기' : '✋ 화면 움직이기';
  document.body.classList.toggle('scratch-drawing', scratch.on && !on);
}
function scratchMode(on) {
  scratch.on = on;
  document.body.classList.toggle('scratch-on', on);
  if (!on) { measureHide('protractor'); measureHide('ruler'); }
  scratchPan(false);
  scratchFit();
}
/* quiz.js 의 route() 가 화면을 바꿀 때마다 부름. key 가 없으면(목록 화면) 필기 숨김 */
function scratchSwitch(key) {
  scratchInit();
  if (!key || key !== scratch.key) { measureHide('protractor'); measureHide('ruler'); }
  if (!key) scratchMode(false);
  scratch.key = key;
  document.body.classList.toggle('scratch-avail', !!key);
  requestAnimationFrame(() => { scratchFit(); scratchRedraw(); });
}

/* ============================================================
   2) ✍️ 손글씨 답 — 쓰면 글자로 바꿔 답 칸에 넣기
   ============================================================ */
const pad = { el: null, canvas: null, ctx: null, strokes: [], cur: null, t0: 0, target: null, part: null, timer: null, seq: 0, cands: [], chosen: 0 };

function padInit() {
  if (pad.el) return;
  const el = document.createElement('div');
  el.id = 'inkpad';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', '손글씨로 답 쓰기');
  el.innerHTML = `
    <div class="sheet">
      <div class="padhead"><b>✍️ 손글씨로 답 쓰기</b><span class="padlabel"></span><button type="button" class="padx" aria-label="닫기">✕</button></div>
      <div class="padarea"><canvas></canvas><div class="padguide">여기에 답을 쓰세요</div></div>
      <div class="padtools">
        <button type="button" class="tool undo">↶ 되돌리기</button>
        <button type="button" class="tool clear">🗑 지우기</button>
        <span class="padstatus" aria-live="polite"></span>
      </div>
      <div class="padcands" aria-label="인식된 답 후보"></div>
      <div class="padfoot">
        <span class="padnote">답 칸에 들어간 답이 맞는지 꼭 확인하고, 틀리면 직접 고쳐요.</span>
        <button type="button" class="padok">✓ 넣기</button>
      </div>
    </div>`;
  document.body.append(el);
  pad.el = el;
  pad.canvas = el.querySelector('canvas');
  el.querySelector('.padx').addEventListener('click', () => padClose(false));
  el.addEventListener('click', e => { if (e.target === el) padClose(false); });
  el.querySelector('.undo').addEventListener('click', () => { pad.strokes.pop(); padRedraw(); padSchedule(0); });
  el.querySelector('.clear').addEventListener('click', () => { pad.strokes = []; padRedraw(); padSetCands([]); padStatus(''); });
  el.querySelector('.padok').addEventListener('click', () => padClose(true));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && el.classList.contains('open')) padClose(false); });

  const c = pad.canvas;
  const pos = e => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  c.addEventListener('pointerdown', e => {
    e.preventDefault();
    c.setPointerCapture(e.pointerId);
    clearTimeout(pad.timer);
    if (!pad.strokes.length) pad.t0 = performance.now();
    const [x, y] = pos(e);
    pad.cur = { pts: [[x, y]], t: [Math.round(performance.now() - pad.t0)] };
    pad.strokes.push(pad.cur);
    el.querySelector('.padguide').hidden = true;
    inkDrawStroke(pad.ctx, { width: 5, pts: pad.cur.pts });
  });
  c.addEventListener('pointermove', e => {
    if (!pad.cur) return;
    e.preventDefault();
    for (const ev of inkEvents(e)) {
      const [x, y] = pos(ev), last = pad.cur.pts[pad.cur.pts.length - 1];
      pad.cur.pts.push([x, y]);
      pad.cur.t.push(Math.round(performance.now() - pad.t0));
      inkDrawStroke(pad.ctx, { width: 5, pts: [last, [x, y]] });
    }
  });
  const end = () => { if (pad.cur) { pad.cur = null; padSchedule(450); } };
  c.addEventListener('pointerup', end);
  c.addEventListener('pointercancel', end);
}
function padRedraw() {
  pad.ctx.clearRect(0, 0, pad.canvas.width, pad.canvas.height);
  for (const s of pad.strokes) inkDrawStroke(pad.ctx, { width: 5, pts: s.pts });
  pad.el.querySelector('.padguide').hidden = pad.strokes.length > 0;
}
function padStatus(t) { pad.el.querySelector('.padstatus').textContent = t; }
function padSchedule(ms) {
  clearTimeout(pad.timer);
  if (!pad.strokes.length) return;
  pad.timer = setTimeout(padRecognize, ms);
}

/* 열기: 답 칸(target)과 문항 종류(part) */
function openInkPad(target, part, label) {
  padInit();
  pad.target = target; pad.part = part; pad.strokes = []; pad.cands = []; pad.chosen = 0;
  pad.before = target.value;
  pad.el.querySelector('.padlabel').textContent = label || '';
  pad.el.querySelector('.padok').textContent = part.kind === 'essay' ? '✓ 까닭 칸에 붙이기' : '✓ 넣기';
  padSetCands([]); padStatus('');
  pad.el.classList.add('open');
  document.body.classList.add('pad-open');
  const area = pad.el.querySelector('.padarea');
  const w = Math.min(area.clientWidth || 600, 900), h = part.kind === 'essay' ? 260 : 220;
  pad.ctx = inkCanvasSetup(pad.canvas, w, h);
  pad.ctx.strokeStyle = '#1d2433';
  padRedraw();
}
function padClose(apply) {
  clearTimeout(pad.timer);
  const t = pad.target, kind = pad.part && pad.part.kind;
  if (apply && t) {
    const pick = pad.cands[pad.chosen];
    if (kind === 'essay') {
      if (pick) { t.value = (t.value.trim() ? t.value.trim() + ' ' : '') + pick.text; }
    } else if (pick) {
      t.value = pick.text;
    }
  } else if (!apply && t && kind !== 'essay') {
    t.value = pad.before; // 닫기(✕) = 손글씨로 바꾼 것 취소
  }
  pad.el.classList.remove('open');
  document.body.classList.remove('pad-open');
  if (apply && t) {
    t.focus({ preventScroll: true });
    t.classList.remove('inkfilled'); void t.offsetWidth; t.classList.add('inkfilled');
    t.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

/* 후보 고르기 — 수를 묻는 칸이면 수로 읽히는 후보를 먼저 */
const INK_NUM_FIX = { O: '0', o: '0', '○': '0', 'ㅇ': '0', '〇': '0', D: '0', l: '1', I: '1', '|': '1', 'ㅣ': '1', '!': '1', i: '1', Z: '2', z: '2', S: '5', s: '5', b: '6', B: '8', g: '9', q: '9', '。': '.', '·': '.', '‧': '.' };
function inkNumText(s) {
  return String(s).replace(/\s+/g, '').split('').map(ch => INK_NUM_FIX[ch] || ch).join('');
}
function inkLooksNumber(s, unit) {
  return typeof parseNum === 'function' ? isFinite(parseNum(s, unit)) : /^\d+([.\/]\d+)?$/.test(s);
}
function inkRank(raw, part) {
  const seen = new Set(), out = [];
  const add = (text, good) => { text = String(text).trim(); if (text && !seen.has(text)) { seen.add(text); out.push({ text, good }); } };
  if (part.kind === 'num') {
    raw.forEach(c => { const t = inkNumText(c); if (inkLooksNumber(t, part.unit)) add(t, true); });
    raw.forEach(c => { if (!inkLooksNumber(inkNumText(c), part.unit)) add(c, false); });
  } else if (part.kind === 'nums') {
    raw.forEach(c => {
      const toks = String(c).split(/[,，、\s/]+/).filter(Boolean).map(inkNumText);
      if (toks.length && toks.every(t => inkLooksNumber(t, part.unit))) add(toks.join(', '), true);
    });
    raw.forEach(c => add(c, false));
  } else {
    raw.forEach(c => add(c, true));
  }
  return out.slice(0, 6);
}
function padSetCands(cands) {
  pad.cands = cands; pad.chosen = 0;
  const box = pad.el.querySelector('.padcands');
  box.replaceChildren();
  cands.forEach((c, i) => {
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'cand', textContent: c.text });
    b.setAttribute('aria-pressed', String(i === 0));
    b.addEventListener('click', () => {
      pad.chosen = i;
      box.querySelectorAll('.cand').forEach((x, k) => x.setAttribute('aria-pressed', String(k === i)));
      if (pad.part.kind !== 'essay') pad.target.value = c.text;
    });
    box.append(b);
  });
  // 1차: 가장 그럴듯한 답을 바로 답 칸에 넣음 (까닭 칸은 '붙이기'를 눌러야 들어감)
  if (cands[0] && pad.part.kind !== 'essay') pad.target.value = cands[0].text;
}

async function inkRequest(ink, w, h, contentType) {
  const body = JSON.stringify({
    options: 'enable_pre_space',
    requests: [{ writing_guide: { writing_area_width: Math.round(w), writing_area_height: Math.round(h) }, ink, language: 'ko', max_num_results: 10, max_completions: 0 }],
  });
  const res = await fetch('https://inputtools.google.com/request?ime=handwriting&app=mobilesearch&cs=1&oe=UTF-8', {
    method: 'POST', headers: { 'Content-Type': contentType }, body, credentials: 'omit', referrerPolicy: 'no-referrer',
  });
  const data = await res.json();
  if (data[0] !== 'SUCCESS') throw new Error('recognize failed');
  return (data[1] && data[1][0] && data[1][0][1]) || [];
}
async function padRecognize() {
  if (!pad.strokes.length) return;
  const seq = ++pad.seq;
  const ink = pad.strokes.map(s => [s.pts.map(p => Math.round(p[0])), s.pts.map(p => Math.round(p[1])), s.t]);
  const w = parseFloat(pad.canvas.style.width), h = parseFloat(pad.canvas.style.height);
  padStatus('글자 읽는 중…');
  let raw;
  try {
    try { raw = await inkRequest(ink, w, h, 'application/json'); }
    catch (e) { raw = await inkRequest(ink, w, h, 'text/plain;charset=UTF-8'); }
  } catch (e) {
    if (seq === pad.seq) padStatus('글자를 읽지 못했어요. 키보드로 답 칸에 써 주세요.');
    return;
  }
  if (seq !== pad.seq || !pad.el.classList.contains('open')) return;
  const cands = inkRank(raw, pad.part);
  padSetCands(cands);
  padStatus(cands.length ? (pad.part.kind === 'essay' ? '알맞은 글을 고르고 붙이기를 누르세요' : '답 칸에 넣었어요. 다르면 아래에서 고르세요') : '글자를 읽지 못했어요. 다시 써 보세요.');
}
