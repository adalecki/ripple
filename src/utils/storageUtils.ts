import { CHANGELOG } from "../config/changelog";

export const APP_VERSION = CHANGELOG[0].version;

export const STORAGE_KEYS = {
  meta: 'ripple:meta',
  preferences: 'ripple:preferences',
  protocols: 'ripple:protocols',
  schemes: 'ripple:schemes'
}

export interface RippleMeta {
  version: string;
  lastSeen: string;
}

const LEGACY_KEY_MAP: [legacy: string, current: string][] = [
  ['echo-preferences', STORAGE_KEYS.preferences],
  ['ripple-protocols', STORAGE_KEYS.protocols],
  ['ripple-reformat-schemes', STORAGE_KEYS.schemes]
];

export function getMeta(): RippleMeta | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.meta);
    if (!stored) return null;
    return JSON.parse(stored) as RippleMeta;
  } catch (e) {
    console.error('Failed to read stored metadata:', e);
    return null;
  }
}

function writeMeta(lastSeen: string): void {
  const meta: RippleMeta = { version: APP_VERSION, lastSeen };
  localStorage.setItem(STORAGE_KEYS.meta, JSON.stringify(meta));
}

export function migrateStorage(): void {
  try {
    for (const [legacyKey, currentKey] of LEGACY_KEY_MAP) {
      const legacyValue = localStorage.getItem(legacyKey);
      if (legacyValue === null) continue;
      if (localStorage.getItem(currentKey) === null) {
        localStorage.setItem(currentKey, legacyValue);
      }
      //localStorage.removeItem(legacyKey); //not yet removing legacy keys, no need to and prevents rollback; remove them down the line
    }
    writeMeta(getMeta()?.lastSeen ?? APP_VERSION);
  } catch (e) {
    console.error('Storage migration failed:', e);
  }
}

export function hasUnseenChanges(): boolean {
  const meta = getMeta();
  if (!meta) return false;
  return CHANGELOG.findIndex(entry => entry.version === meta.lastSeen) !== 0;
}

export function markChangelogSeen(): void {
  try {
    writeMeta(APP_VERSION);
  } catch (e) {
    console.error('Failed to record changelog as seen:', e);
  }
}