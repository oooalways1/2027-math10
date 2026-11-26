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
| `qr/4-1/` | 차시별 QR 이미지 01~36 + ZIP (GitHub에는 안 올림, `tools/make_qr.py`로 다시 만듦) |
| `admin/` | 관리 페이지 QR 보관함 (`/admin`, 로그인 필요) |
| `src/worker.js` | `/admin` 로그인 잠금 (Cloudflare Worker) |
| `tools/` | QR 만들기, 배포 스크립트 |

## 관리 페이지

- 첫 화면 맨 아래 **관리** → 로그인 → QR 보관함 (PNG·ZIP 내려받기, 인쇄)
- 아이디는 `wrangler.jsonc` 의 `ADMIN_ID`, 비밀번호는 Cloudflare 비밀값에만 있음 (GitHub에 없음)
- 비밀번호 바꾸기: `npx wrangler secret put ADMIN_PASSWORD`

## 배포 (Cloudflare Workers)

```
bash tools/deploy.sh
```

사이트 파일(`index.html`, `assets/`, 학년 폴더)만 `dist/`에 모아서 올립니다. 작업 파일은 올라가지 않습니다.

## 새 학년 추가

1. `4-1/` 폴더를 복사해 `5-1/` 처럼 이름을 바꿉니다.
2. `data.js`의 `GRADE`, `UNITS`, `LESSONS`와 `img/` 그림을 바꿉니다.
3. 맨 위 `index.html`에서 그 학년 칸을 링크로 바꿉니다.
4. `python tools/make_qr.py 5-1` 로 QR(문항 없는 차시 포함)을 만들고, `bash tools/deploy.sh` 로 배포합니다.
