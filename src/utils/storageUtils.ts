export const APP_VERSION = '1.0.0';

export const STORAGE_KEYS = {
  meta: 'ripple:meta',
  preferences: 'ripple:preferences',
  protocols: 'ripple:protocols',
  schemes: 'ripple:schemes'
} as const;

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
  const stored = localStorage.getItem(STORAGE_KEYS.meta);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as RippleMeta;
  } catch (e) {
    console.error('Failed to parse stored metadata:', e);
    return null;
  }
}

function writeMeta(): void {
  const existing = getMeta();
  const meta: RippleMeta = {
    version: APP_VERSION,
    lastSeen: existing ? existing.lastSeen : APP_VERSION
  };
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
    writeMeta();
  } catch (e) {
    console.error('Storage migration failed:', e);
  }
}