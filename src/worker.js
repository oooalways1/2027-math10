/* 달성 수학 10분 — 관리 페이지 잠금 (Cloudflare Worker)
   /admin 아래만 이 코드를 거치고, 나머지 페이지는 그냥 정적 파일로 나갑니다.
   비밀번호는 코드나 GitHub에 없고 Cloudflare 비밀값(ADMIN_PASSWORD)에만 있습니다.
     설정:  npx wrangler secret put ADMIN_PASSWORD   */

const COOKIE = 'dalseong_admin';
const SESSION_HOURS = 12;
const enc = new TextEncoder();

const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function hmac(key, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
}
async function sameText(a, b) {
  // 길이·내용이 달라도 걸리는 시간이 같게 비교
  const [x, y] = await Promise.all([a, b].map(s => crypto.subtle.digest('SHA-256', enc.encode(String(s)))));
  const u = new Uint8Array(x), v = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < u.length; i++) diff |= u[i] ^ v[i];
  return diff === 0;
}
const sessionKey = env => 'session:' + env.ADMIN_PASSWORD;

async function makeSession(env) {
  const exp = String(Date.now() + SESSION_HOURS * 3600e3);
  return exp + '.' + await hmac(sessionKey(env), exp);
}
async function validSession(req, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const m = (req.headers.get('Cookie') || '').match(new RegExp(COOKIE + '=([0-9]+)\\.([A-Za-z0-9_-]+)'));
  if (!m || Number(m[1]) < Date.now()) return false;
  return sameText(m[2], await hmac(sessionKey(env), m[1]));
}

const noStore = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Referrer-Policy': 'no-referrer' };
const redirect = (to, extra = {}) => new Response(null, { status: 303, headers: { Location: to, ...noStore, ...extra } });

function loginPage(message = '', status = 200) {
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>관리자 로그인 · 달성 수학 10분</title>
<style>
  :root { color-scheme: light; --bg:#f4f6f9; --card:#fff; --ink:#1d2433; --muted:#5d6779; --line:#d9dee7; --accent:#2f6fde; --bad:#d6402f; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; background:var(--bg); color:var(--ink);
    font-family:"Pretendard","Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",system-ui,sans-serif; padding:16px; }
  form { width:100%; max-width:360px; background:var(--card); border:2px solid var(--line); border-radius:16px; padding:24px; }
  .eyebrow { font-size:14px; color:var(--muted); font-weight:600; }
  h1 { font-size:22px; margin:2px 0 18px; }
  label { display:block; font-size:15px; font-weight:600; margin:12px 0 6px; }
  input { width:100%; font:inherit; font-size:18px; padding:10px 12px; border:2px solid #b8c0cd; border-radius:10px; }
  input:focus { outline:none; border-color:var(--accent); }
  button { width:100%; margin-top:18px; font:inherit; font-weight:700; font-size:18px; padding:11px; border:none; border-radius:12px; background:var(--accent); color:#fff; cursor:pointer; }
  .msg { color:var(--bad); font-weight:600; margin:12px 0 0; font-size:15px; }
  .back { display:block; text-align:center; margin-top:14px; color:var(--accent); font-size:14px; text-decoration:none; }
</style></head><body>
<form method="post" action="/admin/login">
  <div class="eyebrow">달성 수학 10분</div>
  <h1>관리자 로그인</h1>
  <label for="id">아이디</label><input id="id" name="id" autocomplete="username" required autofocus>
  <label for="pw">비밀번호</label><input id="pw" name="pw" type="password" autocomplete="current-password" required>
  ${message ? `<p class="msg">${message}</p>` : ''}
  <button type="submit">로그인</button>
  <a class="back" href="/">← 첫 화면</a>
</form></body></html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', ...noStore } });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (!(path === '/admin' || path.startsWith('/admin/'))) return env.ASSETS.fetch(req);
    if (path === '/admin') return redirect('/admin/');

    if (path === '/admin/login') {
      if (req.method === 'GET') return (await validSession(req, env)) ? redirect('/admin/') : loginPage();
      if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
      if (!env.ADMIN_PASSWORD) return loginPage('관리자 비밀번호가 아직 설정되지 않았어요.', 503);
      const form = await req.formData();
      const ok = (await sameText(form.get('id') || '', env.ADMIN_ID || 'admin')) & (await sameText(form.get('pw') || '', env.ADMIN_PASSWORD));
      if (!ok) {
        await new Promise(r => setTimeout(r, 800)); // 마구 넣어 보기 늦추기
        return loginPage('아이디 또는 비밀번호가 맞지 않아요.', 401);
      }
      const cookie = `${COOKIE}=${await makeSession(env)}; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}`;
      return redirect('/admin/', { 'Set-Cookie': cookie });
    }

    if (path === '/admin/logout') {
      return redirect('/admin/login', { 'Set-Cookie': `${COOKIE}=; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0` });
    }

    if (!(await validSession(req, env))) return redirect('/admin/login');

    const res = await env.ASSETS.fetch(req);
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(noStore)) out.headers.set(k, v);
    return out;
  },
};
