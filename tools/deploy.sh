#!/usr/bin/env bash
# 사이트 파일만 dist/ 에 모아서 Cloudflare Workers 로 올립니다.
#
#   bash tools/deploy.sh               이 컴퓨터에서 빌드 + 배포 (wrangler 로그인 필요)
#   bash tools/deploy.sh --build-only  빌드만 — Cloudflare 자동 배포(GitHub 연결)의 빌드 명령
#
# 올리는 것: index.html, assets/, 학년 폴더(3-1, 4-1 …), admin/
# 안 올리는 것: 작업 파일(md, hwp 그림, qr/, tools/, .git …)
# QR 보관함은 admin 화면이 학년별 data.js 를 읽어 브라우저에서 직접 그립니다 (빌드에 파이썬 불필요).
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf dist
mkdir -p dist/admin
cp index.html dist/
cp -r assets dist/
for d in [0-9]-[0-9]; do
  [ -d "$d" ] && cp -r "$d" dist/
done
cp admin/index.html dist/admin/   # 로그인해야 열림 — src/worker.js

echo "올릴 파일:"; (cd dist && find . -type f | sort)
[ "${1:-}" = "--build-only" ] && exit 0
npx --yes wrangler@4 deploy
