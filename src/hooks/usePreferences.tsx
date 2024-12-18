import { createContext, useContext, useState } from 'react';
import { PREFERENCES_CONFIG } from '../config/preferencesConfig';

// Type for individual preference values
type PreferenceValue = number | boolean | string;

// Type for the full preferences object, dynamically generated from config
export type PreferencesState = {
  [K in typeof PREFERENCES_CONFIG[number]['settings'][number]['prefId']]: PreferenceValue;
};

// Type for the context value
interface PreferencesContextValue {
  preferences: PreferencesState;
  updatePreferences: (newPreferences: PreferencesState) => void;
  resetPreferences: () => void;
}

// Create the context
export const PreferencesContext = createContext<PreferencesContextValue | null>(null);

// Initialize default preferences from config
function getDefaultPreferences(): PreferencesState {
  const defaults: { [key: string]: PreferenceValue } = {};
  PREFERENCES_CONFIG.forEach(category => {
    category.settings.forEach(setting => {
      defaults[setting.prefId] = setting.defaultValue;
    });
  });
  return defaults as PreferencesState;
}

// Load preferences from localStorage
function loadStoredPreferences(): PreferencesState {
  const stored = localStorage.getItem('echo-preferences');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Merge with defaults to handle new preferences added to config
      return { ...getDefaultPreferences(), ...parsed };
    } catch (e) {
      console.error('Failed to parse stored preferences:', e);
      return getDefaultPreferences();
    }
  }
  return getDefaultPreferences();
}

// Provider component
export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<PreferencesState>(loadStoredPreferences);

  // Update all preferences and persist to localStorage
  const updatePreferences = (newPreferences: PreferencesState) => {
    setPreferences(newPreferences);
    localStorage.setItem('echo-preferences', JSON.stringify(newPreferences));
  };

  // Reset all preferences to defaults
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

// Custom hook to use preferences
export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
}

// Utility hook for components that only need to read preferences
export function usePreferencesValue<T extends keyof PreferencesState>(
  preferenceId: T
): PreferencesState[T] {
  const { preferences } = usePreferences();
  return preferences[preferenceId];
}