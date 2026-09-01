import { migrateStorage, getMeta, STORAGE_KEYS, APP_VERSION } from '../storageUtils';

const LEGACY_PREFS = 'echo-preferences';
const LEGACY_PROTOCOLS = 'ripple-protocols';
const LEGACY_SCHEMES = 'ripple-reformat-schemes';

describe('migrateStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  test('fresh install writes meta and creates no data keys', () => {
    migrateStorage();

    expect(getMeta()).toEqual({ version: APP_VERSION, lastSeen: APP_VERSION });
    expect(localStorage.getItem(STORAGE_KEYS.preferences)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.protocols)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.schemes)).toBeNull();
  });

  test('moves each legacy key verbatim', () => {
    const prefs = JSON.stringify({ maxTransferVolume: 250 });
    const protocols = JSON.stringify([{ id: 1, name: 'A' }]);
    const schemes = JSON.stringify([{ id: 1, name: 'B' }]);
    localStorage.setItem(LEGACY_PREFS, prefs);
    localStorage.setItem(LEGACY_PROTOCOLS, protocols);
    localStorage.setItem(LEGACY_SCHEMES, schemes);

    migrateStorage();

    expect(localStorage.getItem(STORAGE_KEYS.preferences)).toBe(prefs);
    expect(localStorage.getItem(STORAGE_KEYS.protocols)).toBe(protocols);
    expect(localStorage.getItem(STORAGE_KEYS.schemes)).toBe(schemes);
    //expect(localStorage.getItem(LEGACY_PREFS)).toBeNull();
    //expect(localStorage.getItem(LEGACY_PROTOCOLS)).toBeNull();
    //expect(localStorage.getItem(LEGACY_SCHEMES)).toBeNull();
  });

  // Covers the old-tab-resurrects-legacy-key path during a deploy.
  test('existing new key wins over a legacy key', () => {
    localStorage.setItem(STORAGE_KEYS.preferences, JSON.stringify({ maxTransferVolume: 500 }));
    localStorage.setItem(LEGACY_PREFS, JSON.stringify({ maxTransferVolume: 250 }));

    migrateStorage();

    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.preferences)!)).toEqual({ maxTransferVolume: 500 });
    //expect(localStorage.getItem(LEGACY_PREFS)).toBeNull();
  });

  test('moves unparseable legacy values without throwing', () => {
    localStorage.setItem(LEGACY_PREFS, 'not json');

    expect(() => migrateStorage()).not.toThrow();
    expect(localStorage.getItem(STORAGE_KEYS.preferences)).toBe('not json');
    //expect(localStorage.getItem(LEGACY_PREFS)).toBeNull();
  });

  test('preserves lastSeen while advancing version', () => {
    localStorage.setItem(STORAGE_KEYS.meta, JSON.stringify({ version: '0.9.0', lastSeen: '0.9.0' }));

    migrateStorage();

    expect(getMeta()).toEqual({ version: APP_VERSION, lastSeen: '0.9.0' });
  });

  test('replaces unparseable meta', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem(STORAGE_KEYS.meta, '{{{');

    migrateStorage();

    expect(getMeta()).toEqual({ version: APP_VERSION, lastSeen: APP_VERSION });
  });

  test('is idempotent across repeated boots', () => {
    localStorage.setItem(LEGACY_PREFS, JSON.stringify({ maxTransferVolume: 250 }));

    migrateStorage();
    const afterFirst = { ...localStorage };
    migrateStorage();

    expect({ ...localStorage }).toEqual(afterFirst);
  });

  test('retains the legacy key when the write fails', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem(LEGACY_PREFS, JSON.stringify({ maxTransferVolume: 250 }));
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    expect(() => migrateStorage()).not.toThrow();

    jest.restoreAllMocks();
    expect(localStorage.getItem(LEGACY_PREFS)).not.toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.preferences)).toBeNull();
  });
});