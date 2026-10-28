#!/usr/bin/env bash
# Start Google Chrome / Chromium with CDP for EvilHooked mirror (off-screen / background).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROFILE="$ROOT/evilhooked/chrome-profile-cdp"
PORT="${CDP_PORT:-9222}"
mkdir -p "$PROFILE"

# Wipe leftover session junk for a clean login each stack start
DEFAULT="$PROFILE/Default"
if [[ -d "$DEFAULT" ]]; then
  rm -f "$DEFAULT"/Cookies "$DEFAULT"/Cookies-journal \
        "$DEFAULT"/"Login Data" "$DEFAULT"/"Login Data-journal" \
        "$DEFAULT"/"Web Data" "$DEFAULT"/"Web Data-journal" \
        "$DEFAULT"/History "$DEFAULT"/History-journal 2>/dev/null || true
fi

pkill -f "remote-debugging-port=${PORT}|chrome-profile-cdp" 2>/dev/null || true
sleep 1

CHROME=""
for c in \
  google-chrome \
  google-chrome-stable \
  chromium \
  chromium-browser \
  "/usr/bin/google-chrome" \
  "/usr/bin/chromium-browser"
do
  if command -v "$c" >/dev/null 2>&1; then CHROME="$c"; break; fi
  if [[ -x "$c" ]]; then CHROME="$c"; break; fi
done

if [[ -z "$CHROME" ]]; then
  echo "ERROR: Chrome/Chromium not found"
  exit 1
fi

echo "Starting Chrome CDP on port $PORT (profile: $PROFILE)"
nohup "$CHROME" \
  --remote-debugging-port="$PORT" \
  --user-data-dir="$PROFILE" \
  --no-first-run \
  --no-default-browser-check \
  --disable-default-apps \
  --window-position=-32000,-32000 \
  --window-size=1366,768 \
  about:blank \
  >/tmp/evilhooked-cdp.log 2>&1 &

for i in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1; then
    echo "Chrome CDP ready on port $PORT"
    exit 0
  fi
  sleep 0.25
done
echo "ERROR: CDP not ready — see /tmp/evilhooked-cdp.log"
exit 1
