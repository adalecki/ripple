import { createContext, useContext, useState } from 'react';
import { PREFERENCES_CONFIG } from '../config/preferencesConfig';

type PreferenceValue = number | boolean | string;

export type PreferencesState = {
  [K in typeof PREFERENCES_CONFIG[number]['settings'][number]['prefId']]: PreferenceValue;
};

interface PreferencesContextValue {
  preferences: PreferencesState;
  updatePreferences: (newPreferences: PreferencesState) => void;
  resetPreferences: () => void;
}

export const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function getDefaultPreferences(): PreferencesState {
  const defaults: { [key: string]: PreferenceValue } = {};
  PREFERENCES_CONFIG.forEach(category => {
    category.settings.forEach(setting => {
      defaults[setting.prefId] = setting.defaultValue;
    });
  });
  return defaults as PreferencesState;
}

function loadStoredPreferences(): PreferencesState {
  const stored = localStorage.getItem('echo-preferences');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return { ...getDefaultPreferences(), ...parsed };
    } catch (e) {
      console.error('Failed to parse stored preferences:', e);
      return getDefaultPreferences();
    }
  }
  return getDefaultPreferences();
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<PreferencesState>(loadStoredPreferences);

  const updatePreferences = (newPreferences: PreferencesState) => {
    setPreferences(newPreferences);
    localStorage.setItem('echo-preferences', JSON.stringify(newPreferences));
  };

  const resetPreferences = () => {
    localStorage.removeItem('echo-preferences');
    const defaults = getDefaultPreferences();
    setPreferences(defaults);
    localStorage.setItem('echo-preferences', JSON.stringify(defaults));
  };

  return (
    <PreferencesContext.Provider value={{ preferences, updatePreferences, resetPreferences }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
}

export function usePreferencesValue<T extends keyof PreferencesState>(
  preferenceId: T
): PreferencesState[T] {
  const { preferences } = usePreferences();
  return preferences[preferenceId];
}