#!/usr/bin/env bash
# Cloudflare Pages 에 사이트만 골라서 올립니다.
# 사용법:  bash tools/deploy.sh
# 처음 한 번:  npx wrangler login   (브라우저에서 Cloudflare 승인)
# 올리는 것: index.html, assets/, 학년 폴더(3-1, 4-1 …), admin/(+qr)  — 작업 파일(md, hwp 그림)은 안 올림
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf dist
mkdir -p dist
cp index.html dist/
cp -r assets dist/
for d in [0-9]-[0-9]; do
  [ -d "$d" ] && cp -r "$d" dist/
done
# 관리 페이지 + QR 보관함 (로그인해야 열림 — src/worker.js)
mkdir -p dist/admin
cp admin/index.html dist/admin/
cp -r qr dist/admin/qr

echo "올릴 파일:"; (cd dist && find . -type f | sort)
[ "${1:-}" = "--build-only" ] && exit 0
npx --yes wrangler@4 deploy
