# 달성 수학 10분 · 심화 문항

교재의 차시별 QR을 찍으면 그 차시 심화 문항이 태블릿에 열리고, 최종 답을 쓰면 바로 ⭕/❌로 채점됩니다.

- 사이트 (Cloudflare): https://2027-math10.mathedu.workers.dev/
- 차시 주소: `4-1/#07` 처럼 `#차시번호`
- 학년 폴더: `4-1/` (3-1, 5-1, 6-1은 준비 중)

## 폴더

| 경로 | 내용 |
|---|---|
| `index.html` | 학년 선택 첫 화면 |
| `assets/` | 모든 학년이 같이 쓰는 디자인(`quiz.css`)과 채점 엔진(`quiz.js`) |
| `4-1/data.js` | 4-1 문항·정답 데이터 |
| `4-1/img/` | 4-1 문제 그림 |
| `admin/` | 관리 페이지 QR 보관함 (`/admin`, 로그인 필요) — 학년별 `data.js`를 읽어 QR을 화면에서 바로 그림 |
| `src/worker.js` | `/admin` 로그인 잠금 (Cloudflare Worker) |
| `tools/deploy.sh` | 빌드·배포 스크립트 |

## 관리 페이지

- 첫 화면 맨 아래 **관리** → 로그인 → QR 보관함 (PNG·ZIP 내려받기, 인쇄)
- 단원 × 차시 목록 전체의 QR이 미리 나옴. `data.js`에 학년·차시를 넣고 배포하면 보관함에도 저절로 추가됨
- 아이디는 `wrangler.jsonc` 의 `ADMIN_ID`, 비밀번호는 Cloudflare 비밀값에만 있음 (GitHub에 없음)
- 비밀번호 바꾸기: `npx wrangler secret put ADMIN_PASSWORD`

## 배포 (Cloudflare Workers)

- **자동:** GitHub `main` 에 올리면 Cloudflare가 알아서 빌드·배포 (빌드 명령 `bash tools/deploy.sh --build-only`, 배포 명령 `npx wrangler deploy`)
- **수동:** `bash tools/deploy.sh` (이 컴퓨터에 wrangler 로그인 필요)

사이트 파일(`index.html`, `assets/`, 학년 폴더, `admin/`)만 `dist/`에 모아서 올립니다. 작업 파일은 올라가지 않습니다.

## 새 학년 추가

1. `4-1/` 폴더를 복사해 `5-1/` 처럼 이름을 바꿉니다.
2. `data.js`의 `GRADE`, `UNITS`, `LESSONS`와 `img/` 그림을 바꿉니다.
3. 맨 위 `index.html`에서 그 학년 칸을 링크로 바꿉니다.
4. `admin/index.html` 의 `GRADES` 에 학년이 있는지 확인하고 GitHub에 올립니다. QR은 보관함에 저절로 생깁니다.
