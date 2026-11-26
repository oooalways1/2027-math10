/* 달성 수학 10분 — 공통 채점·화면 엔진 (모든 학년이 같이 씀)
   각 학년 폴더의 data.js 가 GRADE, UNITS, UNIT_ICONS, LESSONS 를 정의합니다. */

/* ================= 채점 ================= */
const noSpace = s => String(s).replace(/\s+/g, '');
const UNIT_WORDS = ['°', '도', '개', '명', '칸', '배', '권', 'cm', 'm'];

function parseNum(raw, unit) {
  let s = String(raw).trim();
  // 대분수 "2 1/4" 는 띄어쓰기를 지우기 전에 처리
  const mixed = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)\s*$/);
  if (mixed) return +mixed[1] + (+mixed[2]) / (+mixed[3]);
  s = noSpace(s).replace(/,/g, '');
  const units = unit ? [unit, ...UNIT_WORDS] : UNIT_WORDS;
  for (const u of units) if (u && s.endsWith(u)) { s = s.slice(0, -u.length); break; }
  s = s.replace(/°$/, '');
  let m;
  if (/^-?\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  if ((m = s.match(/^(\d+)\/(\d+)$/)) && +m[2] !== 0) return +m[1] / +m[2];
  return NaN;
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
  return el('figure', {}, img, el('figcaption', {}, '🔍 그림을 누르면 크게 볼 수 있어요'));
}
function dataTable(t) {
  const tbl = el('table', { class: 'data' });
  if (t.caption) tbl.append(el('caption', {}, t.caption));
  t.rows.forEach((r, i) => tbl.append(el('tr', {}, r.map((c, j) => el(i === 0 || j === 0 ? 'th' : 'td', {}, c)))));
  return el('div', { class: 'tablewrap' }, tbl);
}
const lessonDone = no => { const st = state[no] || {}; return LESSONS[no].qs.every((q, i) => (st[i] || {}).ok); };

function renderIndex() {
  document.title = `달성 수학 10분 ${GRADE} 심화`;
  app.replaceChildren(
    el('header', { class: 'hero' },
      el('div', { class: 'chips' }, el('span', { class: 'chip' }, '✨ 달성 수학 10분'), el('span', { class: 'chip' }, GRADE + ' 심화 문항')),
      el('h1', {}, el('span', { class: 'no' }, GRADE), '차시를 골라요'),
      el('p', {}, '교재의 QR을 찍으면 그 차시로 바로 들어가요.')),
    ...Object.entries(UNITS).map(([u, name]) => [
      el('div', { class: 'unitname' }, UNIT_ICONS[u] || '📘', name),
      el('div', { class: 'list' }, Object.entries(LESSONS).filter(([, L]) => L.unit == u).map(([no, L]) =>
        el('a', { class: 'lesson', href: '#' + no },
          el('span', { class: 'num' }, no),
          el('span', { class: 't' }, L.title, el('span', { class: 'p' }, L.pages)),
          lessonDone(no) ? el('span', { class: 'done', title: '모두 맞힘' }, '⭐') : null)))
    ]),
    el('p', { class: 'foot', style: 'margin-top:32px' }, el('a', { class: 'back', href: '../' }, '← 학년 선택'))
  );
}

function renderLesson(no) {
  const L = LESSONS[no];
  document.title = `${no}차시 ${L.title} · 달성 수학 10분`;
  const st = state[no] = state[no] || {};

  const fill = el('div', { class: 'fill' });
  const ptxt = el('span', { class: 'txt' });
  const clear = el('div');
  const updateScore = () => {
    const n = L.qs.filter((q, i) => (st[i] || {}).ok).length;
    fill.style.width = (n / L.qs.length * 100) + '%';
    ptxt.textContent = `${n} / ${L.qs.length} 정답`;
    clear.replaceChildren(...(n === L.qs.length ? [el('div', { class: 'allclear' }, '🎉 모두 맞혔어요! 멋져요!')] : []));
  };

  const blocks = [
    el('header', { class: 'hero' },
      el('div', { class: 'chips' },
        el('span', { class: 'chip' }, (UNIT_ICONS[L.unit] || '📘') + ' ' + UNITS[L.unit]),
        el('span', { class: 'chip' }, '📖 ' + L.pages)),
      el('h1', {}, el('span', { class: 'no' }, no), L.title),
      el('p', {}, '연습장에 풀고, 최종 답만 쓰고 채점해요.'),
      el('div', { class: 'progress' }, el('div', { class: 'bar' }, fill), ptxt)),
  ];
  if (L.shared) {
    blocks.push(el('section', { class: 'card shared' },
      el('div', { class: 'qtext' }, '📌 ' + L.shared.text),
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
          placeholder: p.kind === 'nums' ? '예: 10, 20, 30' : '답',
          'aria-label': (p.label || '답') + ' 입력',
        });
        inp.value = saved || '';
        inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) check(); });
        part.append(inp);
        if (p.unit) part.append(el('span', { class: 'unit' }, p.unit));
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
        if (p.multi) box.append(el('div', { class: 'hint' }, '👆 알맞은 것을 모두 누르세요'));
        part.append(box);
        if (p.stack) part.style.width = '100%';
        getters.push(() => sel.slice());
      } else if (p.kind === 'essay') {
        const ta = el('textarea', { class: 'ans', placeholder: p.placeholder || '까닭을 쓰세요', 'aria-label': (p.label || '답') + ' 입력' });
        ta.value = saved || '';
        part.append(ta);
        part.style.width = '100%';
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

  blocks.push(clear, el('p', { class: 'foot' }, el('a', { class: 'back', href: '#' }, `← ${GRADE} 차시 목록`)));
  app.replaceChildren(...blocks);
  updateScore();
  window.scrollTo(0, 0);
}

function route() {
  const no = decodeURIComponent(location.hash.slice(1)).replace(/[^0-9]/g, '').padStart(2, '0');
  if (LESSONS[no]) renderLesson(no); else renderIndex();
}

/* 그림 크게 보기 */
const zoom = document.getElementById('zoom');
function openZoom(src) { zoom.querySelector('img').src = src; zoom.classList.add('open'); }
zoom.addEventListener('click', () => zoom.classList.remove('open'));
document.addEventListener('keydown', e => { if (e.key === 'Escape') zoom.classList.remove('open'); });

window.addEventListener('hashchange', route);
route();
