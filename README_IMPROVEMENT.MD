# EvilHooked-Evilginx — lab README (improved)

Authorized cybersecurity education and isolated red/blue-team labs only. Do not point this stack at real user accounts, production identity providers, or networks you do not own.

This file is the corrected documentation for the archive. The original `README.md` mixed a Google-only binary kit with unused YAML at the repo root and skipped the Linux VPS steps that actually fail in class (nested folders, DNS port 53, headless Chrome).

**Release in this tree:** 4.3.0-beta.2 (binary Evilginx + Node sidecar). There is **no Go source** here.

---

## What this repo is

A **reverse-proxy MITM lab kit** (Evilginx-class) plus a **Node.js “puppet” sidecar**.

| Component | Role | In this archive |
| --- | --- | --- |
| Evilginx binary | TLS-terminating reverse proxy, lab DNS on 53, HTTPS on 443, local capture API on 9092 | Linux `evilginx` and Windows `evilginx.exe` — **prebuilt** |
| `puppet-bridge` | Express sidecar on **127.0.0.1:1000**. Talks to Chrome over CDP (**9222**) when reverse-proxy rewriting is not enough | Node source (several files are minified) |
| Phishlet YAML | Host mapping, filters, `puppet:` upstream | **Runnable kit ships `google.yaml` only** |
| Root `phishlets/` | Extra YAML (Yahoo, iCloud, Blockchain, Portbase) | **Not loaded by `START.sh` / `START.bat`** |
| `playwright/` | Python package `invisible-playwright` (stealth Firefox wrapper) | **Not** Microsoft’s Playwright test runner and **not** started by this kit |

Default kit config is **mirror** mode (`evilhooked/puppet-google.json`). If `mode` is omitted, the bridge code falls back to **assist**.

---

## Real directory layout

The zip nests both OS kits under one parent. Students routinely start in the wrong folder.

```
EvilHooked-Evilginx-main/
├── LICENSE
├── README.md                          # original (inaccurate tree / CLI)
├── README_IMPROVEMENT.MD              # this file
├── phishlets/                         # extra YAML — not used by starters
├── playwright/                        # invisible-playwright (unused by START.*)
└── EvilHooked_Google_linux_amd64/
    ├── EvilHooked_Google_linux_amd64/ # ← Linux VPS kit (use this)
    │   ├── START.sh
    │   ├── install.txt
    │   ├── evilhooked/
    │   │   ├── puppet-google.json
    │   │   ├── start-evilginx.sh
    │   │   ├── start-puppet-chrome.sh
    │   │   ├── evilginx-config/config.json
    │   │   └── evilginx/
    │   │       ├── evilginx            # Linux binary
    │   │       └── phishlets/google.yaml
    │   └── puppet-bridge/
    └── EvilHooked_Google_win_amd64/   # Windows kit (nested here, not a sibling of the zip root)
        ├── START.bat
        ├── START.ps1
        └── …
```

Linux working directory **must** be:

`…/EvilHooked_Google_linux_amd64/EvilHooked_Google_linux_amd64/`

If `ls` does not show `START.sh`, `evilhooked/`, and `puppet-bridge/`, you are in the wrong folder.

---

## How the pieces connect (lab)

```
Lab browser  --HTTPS:443 / DNS:53-->  Evilginx binary
                                         |
                                         | YAML puppet.upstream
                                         v
                                  puppet-bridge :1000
                                         |
                                         | CDP
                                         v
                                  Chrome / Chromium :9222
                                         |
                                         v
                                  capture POST :9092
```

The Google phishlet’s `puppet:` block is the integration point:

- `enabled: true`
- `mode: 'mirror'`
- `upstream: 'http://127.0.0.1:1000'`
- `hosts: accounts.google.com`

Bridge health JSON reports `transport`:

- `mirror-full-proxy` when mode is `mirror` or `hybrid`
- `evilginx-mitm-assist` otherwise

Do not expose **1000**, **9092**, or **9222** on the public internet. Only lab DNS/HTTPS (53/443) should be reachable from the student VLAN, if at all.

---

## Linux VPS — easy start (Ubuntu 22.04 / 24.04, amd64)

This is the missing guide. A cheap VPS has **no GUI**, **systemd-resolved on port 53**, and often **nginx/apache on 443**. The shipped `START.sh` will “run” and still be dead unless you fix those first.

### 0. Lab constraints (do this before DNS)

- Isolated lab domain you control (or `/etc/hosts` on student VMs only).
- No targeting of real Google / Yahoo / Apple / crypto accounts.
- VPS firewall: SSH plus 53/443 only. Keep CDP and the bridge localhost-only.

### 1. SSH in and go to the Linux kit

```bash
cd ~/EvilHooked-Evilginx-main/EvilHooked_Google_linux_amd64/EvilHooked_Google_linux_amd64
ls START.sh evilhooked puppet-bridge
```

Adjust the path if you unpacked elsewhere. Confirm you see the **Linux** binary:

```bash
file evilhooked/evilginx/evilginx
# expect: ELF 64-bit … not PE32 / evilginx.exe
```

### 2. Packages

```bash
sudo apt-get update
sudo apt-get install -y curl ca-certificates gnupg python3 unzip fonts-liberation

# Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # v20.x is fine

# Headless display + Chromium (required: puppet-google.json has "headless": false)
sudo apt-get install -y xvfb chromium-browser || sudo apt-get install -y xvfb chromium
```

If `chromium` / `chromium-browser` is missing on your image, install Google Chrome’s amd64 `.deb` from Google’s repo, or the stack cannot open CDP.

### 3. Free the ports Evilginx needs

```bash
sudo ss -lntup | grep -E ':53|:443|:1000|:9222|:9092' || true
```

**Port 53 (systemd-resolved)** — typical Ubuntu VPS failure:

```bash
sudo mkdir -p /etc/systemd/resolved.conf.d
echo -e '[Resolve]\nDNSStubListener=no' | sudo tee /etc/systemd/resolved.conf.d/no-stub.conf
sudo systemctl restart systemd-resolved
sudo ln -sf /run/systemd/resolve/resolv.conf /etc/resolv.conf
```

**Port 443** — stop the default web server if present:

```bash
sudo systemctl stop nginx apache2 2>/dev/null || true
sudo systemctl disable nginx apache2 2>/dev/null || true
```

**Firewall** (example):

```bash
sudo ufw allow OpenSSH
sudo ufw allow 53
sudo ufw allow 443
sudo ufw enable
```

Do **not** `ufw allow 1000`, `9222`, or `9092`.

### 4. Virtual display (headless VPS)

Chrome is started off-screen, not headless. Without `DISPLAY`, CDP never comes up (`/tmp/evilhooked-cdp.log`).

```bash
# persist for this SSH session
export DISPLAY=:99
sudo mkdir -p /tmp
# if Xvfb is not already running:
if ! pgrep -a Xvfb | grep -q ':99'; then
  sudo Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX >/tmp/xvfb.log 2>&1 &
fi
sleep 1
xdpyinfo -display :99 >/dev/null && echo "Xvfb OK"
```

If you start the kit with `sudo`, **pass DISPLAY through**:

```bash
sudo --preserve-env=DISPLAY env DISPLAY=:99 bash START.sh
```

**Chrome as root:** many VPS images refuse Chrome without extra flags. If CDP stays down, edit `evilhooked/start-puppet-chrome.sh` and add these flags next to the existing `--remote-debugging-port` line:

```
--no-sandbox
--disable-dev-shm-usage
--disable-gpu
```

(`/dev/shm` is often tiny on a VPS; that flag avoids Chrome crashes.)

### 5. Point the kit at *your* lab domain and VPS IP

Three places must agree. The shipped defaults (`evilhooked.com`, `google.auth.com`, `127.0.0.1`) will not work on a public VPS as-is.

**A. DNS (at your registrar)** — for a lab zone you own, e.g. `lab.example.com`:

- `A` record: `lab.example.com` → VPS public IPv4  
- `A` record: `*.lab.example.com` → same IPv4  

Wait until `dig +short lab.example.com` returns the VPS.

**B. Evilginx config** — `evilhooked/evilginx-config/config.json`:

- `general.domain` → `lab.example.com`  
- `general.external_ipv4` → the VPS public IPv4 (not `127.0.0.1`)  
- `phishlets.google.hostname` → e.g. `google.lab.example.com`  

You can also set these in the Evilginx console after start (`config domain …`, `config ipv4 …`). Editing the JSON before first start avoids a blank lab.

**C. Bridge config** — `evilhooked/puppet-google.json`:

- `phishDomain` → the same hostname you will use in the lab (must match the phishlet hostname scheme)  
- `redirectAfterCapture` → a URL on that lab hostname  
- leave `host` as `127.0.0.1` and `port` as `1000`

### 6. Start the stack

```bash
cd ~/EvilHooked-Evilginx-main/EvilHooked_Google_linux_amd64/EvilHooked_Google_linux_amd64
chmod +x START.sh evilhooked/evilginx/evilginx evilhooked/start-evilginx.sh evilhooked/start-puppet-chrome.sh
sudo --preserve-env=DISPLAY env DISPLAY=:99 bash START.sh
```

First run runs `npm install` inside `puppet-bridge`. Keep this terminal open: `start-evilginx.sh` `wait`s on the Evilginx process.

The binary is started as:

`evilginx -p <phishlets dir> -c <evilginx-config> -developer`

`-developer` uses the built-in lab CA (browsers will warn unless you install that CA on lab clients).

### 7. Prove it is up (same VPS)

```bash
curl -fsS http://127.0.0.1:1000/health
curl -fsS http://127.0.0.1:9222/json/version
sudo ss -lntup | grep -E ':53|:443|:1000|:9222|:9092'
```

Expect:

- `/health` → JSON with `"ok": true`, `"phishlet": "google"`, `"mode": "mirror"`
- `/json/version` → Chrome/Chromium Browser JSON
- listeners on 53, 443, 1000, 9222; 9092 after Evilginx is ready

From a **lab client** (not from the public internet unless that is your isolated range):

```bash
dig @VPS_IP google.lab.example.com
curl -vkI https://google.lab.example.com/
```

You should see a TLS response from the proxy (certificate warning in developer mode is expected).

### 8. Stop

In the start terminal: `Ctrl+C`, then:

```bash
sudo pkill -f 'evilhooked/evilginx/evilginx' || true
sudo pkill -f 'puppet-bridge/src/index.js' || true
sudo pkill -f 'chrome-profile-cdp|remote-debugging-port=9222' || true
```

---

## Windows (course laptops)

Kit path:

`EvilHooked_Google_linux_amd64/EvilHooked_Google_win_amd64/`

Need: Node 18+, Chrome, **Administrator** PowerShell (ports 53/443).

```powershell
cd ...\EvilHooked_Google_win_amd64
.\START.bat
# or
powershell -ExecutionPolicy Bypass -File .\START.ps1
```

Same health checks against `http://127.0.0.1:1000/health` and `http://127.0.0.1:9222/json/version`. Stop Windows DNS/IIS if bind fails.

---

## Console notes (lab operator)

Shipped `install.txt` / start scripts expect, inside the Evilginx window:

- `config domain <your-lab-domain>`
- `lures create google`
- `lures get-url N` (N is the lure id printed by Evilginx)

Do not use unverified extra subcommands from the old README (`sessions print`, `sessions export`, `phishlets install`). Use whatever the binary’s `help` actually lists.

---

## Files students should actually read

| File | Why |
| --- | --- |
| `install.txt` | Honest: no Go source, Node sidecar, start one-liners |
| `evilhooked/puppet-google.json` | Bridge mode, ports, CDP, capture URL |
| `evilhooked/evilginx/phishlets/google.yaml` | `proxy_hosts`, `puppet:`, filters |
| `evilhooked/evilginx-config/config.json` | Bind domain / IP / phishlet hostname |
| `puppet-bridge/src/load-config.js` | Readable defaults (`mode` → `assist` if omitted) |
| `puppet-bridge/src/index.js` | Entry: `node src/index.js <config.json>` |
| `evilhooked/start-evilginx.sh` | Real process graph for Linux |

Several `puppet-bridge/src/*.js` and `mirror/*.js` files are **minified**. Pretty-print before assigning code-reading homework.

---

## Troubleshooting (VPS)

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `Failed to bind port 53` | systemd-resolved stub | Disable `DNSStubListener` (step 3) |
| `Failed to bind port 443` | nginx/apache/caddy | Stop those units |
| `Chrome/Chromium not found` | No browser package | Install `chromium` or Chrome `.deb` |
| `CDP not ready` / empty `/tmp/evilhooked-cdp.log` | No `DISPLAY` | Xvfb + `sudo --preserve-env=DISPLAY` |
| Chrome dies immediately as root | Sandbox + small `/dev/shm` | `--no-sandbox --disable-dev-shm-usage` on the Chrome line |
| `bridge not up` | npm / Node | `cd puppet-bridge && npm install && node -v` (≥ 18) |
| Health OK, public HTTPS fails | DNS or `external_ipv4` still 127.0.0.1 | Fix A records + `config.json` |
| TLS errors on clients | `-developer` lab CA | Install the lab CA on class browsers, or accept only in the isolated lab profile |
| Wrong architecture | Started Windows exe on Linux | `file evilhooked/evilginx/evilginx` must be ELF |

Debug leftovers:

- CDP: `/tmp/evilhooked-cdp.log`
- Bridge: `cd puppet-bridge && node src/index.js ../evilhooked/puppet-google.json`
- Health: `curl -sS http://127.0.0.1:1000/health`

---

## Blue-team lab angles (this tool, not generic phishing slides)

Ask students to detect the **class** of proxy, in an isolated range:

- Unexpected DNS responder on 53 that answers only the lab zone (or all queries) from the VPS  
- HTTPS certificate that is not the real IdP CA (`-developer` / on-the-fly issuance)  
- Rewritten `Content-Security-Policy` in phishlet `sub_filters`  
- Local Chrome with `--remote-debugging-port=9222`  
- Node listening on 1000 and POSTs to `/puppet/capture` on 9092  
- Why **mirror** exists: some origin checks fail on a pure reverse proxy, so the kit drives a real browser and relays UI  

Defenders: revoke sessions, not only passwords, after cookie theft. MFA that is phished in-session is not a complete control against this class of proxy.

---

## What not to treat as part of the assignment

- Building Evilginx from `github.com/karma9874/evilginx2` — **no Go tree is in this zip**; `install.txt` says so. Upstream Evilginx is historically associated with Kuba Gretzky (`kgretzky`), not this kit’s branding.
- Root `phishlets/*.yaml` other than Google — **not** started by this kit.
- `playwright/` as the way the proxy runs — it is a separate unused Python project in the dump.
- Telegram / “campaign success rate” language — not a course interface.

---

## License

MIT. See `LICENSE` (Copyright 2025 EvilWhale).

Use only with written authorization, on isolated infrastructure, with a data-handling plan for anything the proxy might store under `evilhooked/captures/`.
