import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getSyncItem, setSyncItem, CACHE_KEYS } from '../utils/cacheUtils';

export type DefaultPitchesView = 'my' | 'all';

interface UserPreferences {
  /** In desktop view, show song details (deity, language, tempo, etc.) by default. When false, only song name shows; details expand on hover. */
  showSongDetailsInDesktop: boolean;
  /** Default view when opening Pitches tab: 'my' = My Pitches, 'all' = All Pitches */
  defaultPitchesView: DefaultPitchesView;
}

const DEFAULT_PREFS: UserPreferences = {
  showSongDetailsInDesktop: true,
  defaultPitchesView: 'my',
};

interface UserPreferencesContextValue extends UserPreferences {
  setShowSongDetailsInDesktop: (value: boolean) => void;
  setDefaultPitchesView: (value: DefaultPitchesView) => void;
}

const UserPreferencesContext = createContext<UserPreferencesContextValue | null>(null);

function loadPrefs(): UserPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const detailsRaw = getSyncItem(CACHE_KEYS.USER_PREF_SHOW_SONG_DETAILS);
    const pitchesRaw = getSyncItem(CACHE_KEYS.USER_PREF_DEFAULT_PITCHES);
    return {
      showSongDetailsInDesktop: detailsRaw !== 'false',
      defaultPitchesView: (pitchesRaw === 'all' ? 'all' : 'my') as DefaultPitchesView,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export const UserPreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [prefs, setPrefs] = useState<UserPreferences>(loadPrefs);

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  const setShowSongDetailsInDesktop = useCallback((value: boolean) => {
    setSyncItem(CACHE_KEYS.USER_PREF_SHOW_SONG_DETAILS, value ? 'true' : 'false');
    setPrefs((p) => ({ ...p, showSongDetailsInDesktop: value }));
  }, []);

  const setDefaultPitchesView = useCallback((value: DefaultPitchesView) => {
    setSyncItem(CACHE_KEYS.USER_PREF_DEFAULT_PITCHES, value);
    setPrefs((p) => ({ ...p, defaultPitchesView: value }));
  }, []);

  const value: UserPreferencesContextValue = {
    ...prefs,
    setShowSongDetailsInDesktop,
    setDefaultPitchesView,
  };

  return (
    <UserPreferencesContext.Provider value={value}>
      {children}
    </UserPreferencesContext.Provider>
  );
};

export function useUserPreferences(): UserPreferencesContextValue {
  const ctx = useContext(UserPreferencesContext);
  if (!ctx) {
    return {
      ...DEFAULT_PREFS,
      setShowSongDetailsInDesktop: () => {},
      setDefaultPitchesView: () => {},
    };
  }
  return ctx;
}
