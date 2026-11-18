#!/usr/bin/env sh
# Igual que publicar.cmd, para macOS/Linux. Requiere Node.js 22+ y cloudflared
# (macOS: brew install cloudflared · Linux: https://github.com/cloudflare/cloudflared/releases).
set -e
cd "$(dirname "$0")"
[ -d node_modules ] || npm install
[ -d backend/node_modules ] || (cd backend && npm install)
npm run build
(cd backend && node src/start-all.js --con-frontend) &
BACKEND=$!
trap 'kill $BACKEND 2>/dev/null' EXIT INT TERM
sleep 8
echo "Copia el link https://....trycloudflare.com que aparece abajo y compártelo."
cloudflared tunnel --url http://localhost:4000
