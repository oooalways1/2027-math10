/* 달성 수학 10분 — 공통 채점·화면 엔진 (모든 학년이 같이 씀)
   각 학년 폴더의 data.js 가 GRADE, UNITS, LESSONS 를 정의합니다. */

/* ================= 채점 ================= */
const noSpace = s => String(s).replace(/\s+/g, '');
const UNIT_WORDS = ['°', '도', '개', '명', '칸', '배', '권', 'cm', 'm'];

function parseNum(raw, unit) {
  let s = String(raw).trim();
  // 대분수 "2 1/4" 는 띄어쓰기를 지우기 전에 처리
  const mixed = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)\s*$/);
  if (mixed) return +mixed[1] + (+mixed[2]) / (+mixed[3]);
  s = noSpace(s).replace(/,/g, '').replace(/[.!~]+$/, '').replace(/(입니다|이에요|예요|이요|이다)$/, '');
  const units = unit ? [unit, ...UNIT_WORDS] : UNIT_WORDS;
  for (const u of units) if (u && s.endsWith(u)) { s = s.slice(0, -u.length); break; }
  s = s.replace(/°$/, '');
  let m;
  if (/^-?\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  if ((m = s.match(/^(\d+)\/(\d+)$/)) && +m[2] !== 0) return +m[1] / +m[2];
  return koreanNum(s);
}

/* 한글로 쓴 수: 두 개, 세 배, 열두, 스물다섯, 백오십, 삼십이 … */
const KO_NATIVE_TENS = { 열: 10, 스물: 20, 스무: 20, 서른: 30, 마흔: 40, 쉰: 50, 예순: 60, 일흔: 70, 여든: 80, 아흔: 90 };
const KO_NATIVE_ONES = { 하나: 1, 한: 1, 둘: 2, 두: 2, 셋: 3, 세: 3, 석: 3, 넷: 4, 네: 4, 넉: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9 };
const KO_SINO_DIGITS = { 영: 0, 공: 0, 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9 };
const KO_SINO_UNITS = { 십: 10, 백: 100, 천: 1000 };
const KO_NATIVE_RE = new RegExp(`^(${Object.keys(KO_NATIVE_TENS).join('|')})?(${Object.keys(KO_NATIVE_ONES).sort((a, b) => b.length - a.length).join('|')})?$`);

function koreanNum(s) {
  if (!s) return NaN;
  // 고유어: 하나~아흔아홉
  const n = s.match(KO_NATIVE_RE);
  if (n && (n[1] || n[2])) return (KO_NATIVE_TENS[n[1]] || 0) + (KO_NATIVE_ONES[n[2]] || 0);
  // 한자어: 일~구천구백구십구 (앞에 고유어가 아닌 글자만)
  let total = 0, cur = null;
  for (const ch of s) {
    if (ch in KO_SINO_DIGITS) { if (cur !== null) return NaN; cur = KO_SINO_DIGITS[ch]; }
    else if (ch in KO_SINO_UNITS) { total += (cur === null ? 1 : cur) * KO_SINO_UNITS[ch]; cur = null; }
    else return NaN;
  }
  return total + (cur || 0);
}
const sameNum = (a, b) => Math.abs(a - b) < 1e-9;

function normWord(s) {
  return noSpace(s)
    .replace(/[.,·!?~'"()\[\]<>「」『』:;\-]/g, '')
    .replace(/(입니다|이에요|예요|이요|요)$/, '');
}

function gradePart(p, v) {
  switch (p.kind) {
    case 'num':   return sameNum(parseNum(v || '', p.unit), p.ans);
    case 'word':  return p.ans.some(a => normWord(a) === normWord(v || ''));
    case 'choice': {
      const sel = (v || []).slice().sort((a, b) => a - b);
      const ans = p.ans.slice().sort((a, b) => a - b);
      return sel.length === ans.length && sel.every((x, i) => x === ans[i]);
    }
    case 'essay': {
      const t = noSpace(v || '');
      return p.groups.every(g => g.some(k => t.includes(noSpace(k))));
    }
    case 'nums': {
      // 쉼표·띄어쓰기·'와/과' 로 나눈 수들이 정답과 똑같아야 정답 (순서 상관없음)
      const toks = String(v || '').split(/[,，、\s/]+|와|과|그리고/).map(t => t.trim()).filter(Boolean);
      const vals = toks.map(t => parseNum(t, p.unit));
      if (!vals.length || vals.some(isNaN)) return false;
      const uniq = [...new Set(vals)].sort((a, b) => a - b);
      const ans = p.ans.slice().sort((a, b) => a - b);
      return uniq.length === ans.length && uniq.every((x, i) => sameNum(x, ans[i]));
    }
  }
  return false;
}

/* ================= 저장 (이 기기에만) ================= */
const STORE = 'dalseong10-' + GRADE + '-v1';
function loadState() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; } }
function saveState(s) { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (e) {} }
let state = loadState();

/* ================= 화면 ================= */
const app = document.getElementById('app');
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(c));
  return n;
};

function figure(src, alt) {
  const img = el('img', { src: 'img/' + src, alt: alt || '문제 그림', loading: 'lazy' });
  img.addEventListener('click', () => openZoom(img.src));
  return el('figure', {}, img, el('figcaption', {}, '그림을 누르면 크게 볼 수 있어요'));
}
function dataTable(t) {
  const tbl = el('table', { class: 'data' });
  if (t.caption) tbl.append(el('caption', {}, t.caption));
  t.rows.forEach((r, i) => tbl.append(el('tr', {}, r.map((c, j) => el(i === 0 || j === 0 ? 'th' : 'td', {}, c)))));
  return el('div', { class: 'tablewrap' }, tbl);
}

/* ================= 목차 ================= */
// 단원마다 LESSONS_PER_UNIT 개 차시: 1단원 01~06, 2단원 07~12 …
const PER_UNIT = typeof LESSONS_PER_UNIT === 'number' ? LESSONS_PER_UNIT : 6;
const TOC = Object.keys(UNITS).map(Number).sort((a, b) => a - b).flatMap(u =>
  Array.from({ length: PER_UNIT }, (_, k) => {
    const no = String((u - 1) * PER_UNIT + k + 1).padStart(2, '0');
    return { no, unit: u, ready: !!LESSONS[no], title: LESSONS[no] ? LESSONS[no].title : '' };
  }));
const READY = TOC.filter(t => t.ready);
const tocItem = no => TOC.find(t => t.no === no);

function lessonNav(no, where) {
  const i = READY.findIndex(t => t.no === no);
  const prev = i > 0 ? READY[i - 1] : (i === -1 ? [...READY].reverse().find(t => t.no < no) : null);
  const next = i >= 0 ? READY[i + 1] : READY.find(t => t.no > no);
  const btn = (t, label) => t
    ? el('a', { class: 'navbtn', href: '#' + t.no, title: `${t.no}차시 ${t.title}` }, label)
    : el('span', { class: 'navbtn off', 'aria-disabled': 'true' }, label);
  const sel = el('select', { class: 'tocsel', 'aria-label': '차시 목차에서 고르기' });
  sel.append(el('option', { value: '' }, '📋 단원 목록으로'));
  for (const [u, name] of Object.entries(UNITS)) {
    const items = TOC.filter(t => t.unit == u && (t.ready || t.no === no));
    if (!items.length) continue;
    const g = el('optgroup', { label: name });
    items.forEach(t => g.append(el('option', { value: t.no, selected: t.no === no }, `${t.no}차시 ${t.ready ? t.title : '(준비 중)'}`)));
    sel.append(g);
  }
  sel.addEventListener('change', () => { location.hash = sel.value; });
  const unitList = el('a', { class: 'navbtn mid', href: '#u' + (tocItem(no) || {}).unit }, '📋 차시 목록');
  return el('nav', { class: 'lessonnav ' + where, 'aria-label': '차시 이동' },
    btn(prev, '◀ 이전 차시'), where === 'top' ? sel : unitList, btn(next, '다음 차시 ▶'));
}

// 'Ⅱ. 각도' → ['Ⅱ', '각도']
const splitUnit = name => { const m = String(name).match(/^\s*([^.\s]+)\.\s*(.+)$/); return m ? [m[1], m[2]] : ['', name]; };

/* 단원 목록: 네모 칸 6개 (3×2) */
function renderIndex() {
  document.title = `달성 수학 10분 ${GRADE} 심화`;
  app.replaceChildren(
    el('header', { class: 'top' },
      el('div', { class: 'eyebrow' }, '대구광역시달성교육지원청'),
      el('h1', {}, `달성 수학 10분 ${GRADE} · 심화 문항`),
      el('div', { class: 'pages' }, '단원을 고르세요')),
    el('div', { class: 'unitgrid' }, Object.entries(UNITS).map(([u, name]) => {
      const [roman, title] = splitUnit(name);
      const n = READY.filter(t => t.unit == u).length;
      return el('a', { class: 'unitbox' + (n ? '' : ' empty'), href: '#u' + u },
        el('span', { class: 'roman' }, roman),
        el('span', { class: 'uname' }, title),
        el('span', { class: 'ucount' }, n ? `심화 문항 ${n}차시` : '준비 중'));
    })),
    el('p', { style: 'text-align:center;margin-top:28px' }, el('a', { class: 'back', href: '../' }, '← 학년 선택'))
  );
  window.scrollTo(0, 0);
}

/* 한 단원의 차시 목록 */
function renderUnit(u) {
  const name = UNITS[u];
  document.title = `${name} · 달성 수학 10분 ${GRADE}`;
  app.replaceChildren(
    el('header', { class: 'top' },
      el('div', { class: 'eyebrow' }, `달성 수학 10분 ${GRADE} · 심화 문항`),
      el('h1', {}, name)),
    el('div', { class: 'list' }, TOC.filter(t => t.unit == u).map(t => t.ready
      ? el('a', { href: '#' + t.no }, el('b', {}, t.no + '차시'), t.title, el('span', {}, LESSONS[t.no].pages))
      : el('div', { class: 'soonitem' }, el('b', {}, t.no + '차시'), '준비 중'))),
    el('p', { style: 'text-align:center;margin-top:28px' }, el('a', { class: 'back', href: '#' }, '← 단원 목록'))
  );
  window.scrollTo(0, 0);
}

function renderPending(no) {
  const t = tocItem(no);
  document.title = `${no}차시 · 달성 수학 10분`;
  app.replaceChildren(
    el('header', { class: 'top' },
      el('div', { class: 'eyebrow' }, `달성 수학 10분 ${GRADE} · ` + UNITS[t.unit]),
      el('h1', {}, el('span', { class: 'no' }, no), '차시')),
    lessonNav(no, 'top'),
    el('section', { class: 'card pending' },
      el('div', { class: 'big' }, '🛠️'),
      el('p', {}, `${no}차시 심화 문항은 아직 준비 중이에요.`),
      el('p', { class: 'sub' }, '위의 목록에서 다른 차시를 골라 풀어 보세요.')),
    el('p', { style: 'text-align:center' }, el('a', { class: 'back', href: '#u' + t.unit }, `← ${splitUnit(UNITS[t.unit]).join(' ')} 차시 목록`))
  );
  window.scrollTo(0, 0);
}

function renderLesson(no) {
  const L = LESSONS[no];
  document.title = `${no}차시 ${L.title} · 달성 수학 10분`;
  const st = state[no] = state[no] || {};

  const scoreEl = el('div', { class: 'score' });
  const updateScore = () => {
    const n = L.qs.filter((q, i) => (st[i] || {}).ok).length;
    scoreEl.textContent = n ? `${L.qs.length}문제 중 ${n}문제 맞혔어요` + (n === L.qs.length ? ' 🎉' : '') : '';
  };

  const blocks = [
    el('header', { class: 'top' },
      el('div', { class: 'eyebrow' }, `달성 수학 10분 ${GRADE} · ` + UNITS[L.unit]),
      el('h1', {}, el('span', { class: 'no' }, no), L.title),
      el('div', { class: 'pages' }, L.pages + ' 심화 문항 · 연습장에 풀고 답만 쓰세요')),
    lessonNav(no, 'top'),
  ];
  if (L.shared) {
    blocks.push(el('section', { class: 'card shared' },
      el('div', { class: 'qtext' }, '※ ' + L.shared.text),
      L.shared.img ? figure(L.shared.img) : null,
      L.shared.table ? dataTable(L.shared.table) : null));
  }

  L.qs.forEach((q, qi) => {
    const qs = st[qi] = st[qi] || { v: [] };
    const card = el('section', { class: 'card' + (qs.ok ? ' is-ok' : '') });
    const getters = [];
    const partEls = [];
    const answers = el('div', { class: 'answers' });
    let row = null;

    q.parts.forEach((p, pi) => {
      const saved = qs.v[pi];
      const part = el('span', { class: 'part' });
      if (p.kind === 'num' || p.kind === 'word' || p.kind === 'nums') {
        const inp = el('input', {
          class: 'ans' + (p.kind === 'nums' || p.wide ? ' wide' : '') + (p.kind === 'word' ? ' word' : ''),
          type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
          inputmode: p.kind === 'num' ? 'decimal' : 'text',
          placeholder: p.kind === 'nums' ? '예: 10, 20, 30' : '',
          'aria-label': (p.label || '답') + ' 입력',
        });
        inp.value = saved || '';
        inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) check(); });
        part.append(inp);
        if (p.unit) part.append(el('span', { class: 'unit' }, p.unit));
        part.append(inkButton(inp, p, `${no}차시 ${qi + 1}번${p.label ? ' · ' + p.label : ''}`));
        getters.push(() => inp.value);
      } else if (p.kind === 'choice') {
        let sel = Array.isArray(saved) ? saved.slice() : [];
        const box = el('div', { class: 'choices' + (p.stack ? ' stack' : ''), role: 'group' });
        const btns = p.options.map((o, oi) => {
          const b = el('button', { type: 'button', class: 'opt', 'aria-pressed': String(sel.includes(oi)) }, o);
          b.addEventListener('click', () => {
            if (p.multi) sel = sel.includes(oi) ? sel.filter(x => x !== oi) : [...sel, oi];
            else sel = sel.includes(oi) ? [] : [oi];
            btns.forEach((bb, k) => bb.setAttribute('aria-pressed', String(sel.includes(k))));
          });
          return b;
        });
        box.append(...btns);
        if (p.multi) box.append(el('div', { class: 'hint' }, '알맞은 것을 모두 누르세요'));
        part.append(box);
        if (p.stack) part.style.width = '100%';
        getters.push(() => sel.slice());
      } else if (p.kind === 'essay') {
        const ta = el('textarea', { class: 'ans', placeholder: p.placeholder || '까닭을 쓰세요', 'aria-label': (p.label || '답') + ' 입력' });
        ta.value = saved || '';
        part.append(ta, inkButton(ta, p, `${no}차시 ${qi + 1}번${p.label ? ' · ' + p.label : ''}`));
        part.style.width = '100%';
        part.classList.add('essaypart');
        getters.push(() => ta.value);
      }
      partEls.push(part);

      if (p.join && row) {
        row.append(el('span', { class: 'arrow' }, '→'), part);
      } else {
        row = el('div', { class: 'row' });
        if (p.label) row.append(el('span', { class: 'lbl' }, p.label));
        row.append(part);
        answers.append(row);
      }
    });

    const result = el('div', { class: 'result', 'aria-live': 'polite' });
    const showResult = ok => {
      result.className = 'result ' + (ok ? 'ok' : 'bad');
      result.replaceChildren(el('span', { class: 'mark' }, ok ? '⭕' : '❌'), ok ? '정답이에요!' : '다시 생각해 보세요');
      card.classList.toggle('is-ok', ok);
    };
    function check() {
      const vals = getters.map(g => g());
      const each = q.parts.map((p, i) => gradePart(p, vals[i]));
      const ok = each.every(Boolean);
      if (q.parts.length > 1) partEls.forEach((pe, i) => { pe.classList.toggle('wrong', !each[i]); pe.classList.toggle('right', each[i]); });
      else { partEls[0].classList.toggle('wrong', !ok); partEls[0].classList.toggle('right', ok); }
      qs.v = vals; qs.ok = ok; qs.tried = true;
      saveState(state);
      showResult(ok);
      updateScore();
    }
    if (qs.tried) showResult(!!qs.ok);

    card.append(...[
      el('div', { class: 'qhead' }, el('div', { class: 'qno' }, String(qi + 1)), el('div', { class: 'qtext' }, q.text)),
      q.img ? figure(q.img) : null,
      q.table ? dataTable(q.table) : null,
      answers,
      el('div', { class: 'actions' }, el('button', { type: 'button', class: 'check', onclick: check }, '채점하기'), result),
    ].filter(Boolean));
    blocks.push(card);
  });

  blocks.push(scoreEl, lessonNav(no, 'bottom'));
  app.replaceChildren(...blocks);
  updateScore();
  window.scrollTo(0, 0);
}

// 손글씨 버튼 (assets/ink.js 가 있으면)
function inkButton(target, part, label) {
  if (typeof openInkPad !== 'function') return null;
  return el('button', { type: 'button', class: 'inkbtn', title: '손글씨로 쓰기', 'aria-label': '손글씨로 답 쓰기',
    onclick: () => openInkPad(target, part, label) }, '✍️');
}

function route() {
  const h = decodeURIComponent(location.hash.slice(1));
  const unit = h.match(/^u(\d+)$/);
  const raw = h.replace(/[^0-9]/g, '');
  const no = raw ? raw.padStart(2, '0') : '';
  if (unit && UNITS[unit[1]]) renderUnit(unit[1]);
  else if (LESSONS[no]) renderLesson(no);
  else if (tocItem(no)) renderPending(no);
  else renderIndex();
  if (typeof scratchSwitch === 'function') scratchSwitch(LESSONS[no] ? GRADE + '#' + no : null);
}

/* 그림 크게 보기 */
const zoom = document.getElementById('zoom');
function openZoom(src) { zoom.querySelector('img').src = src; zoom.classList.add('open'); }
zoom.addEventListener('click', () => zoom.classList.remove('open'));
document.addEventListener('keydown', e => { if (e.key === 'Escape') zoom.classList.remove('open'); });

window.addEventListener('hashchange', route);
route();
