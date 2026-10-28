#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
chmod +x evilhooked/evilginx/evilginx evilhooked/start-evilginx.sh evilhooked/start-puppet-chrome.sh 2>/dev/null || true
exec bash evilhooked/start-evilginx.sh