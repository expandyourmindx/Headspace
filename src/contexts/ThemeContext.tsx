import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeId, PALETTES } from '../themes/palettes';

interface ThemeContextType {
  currentThemeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
  applyTheme: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentThemeId, setCurrentThemeId] = useState<ThemeId>('default');

  const applyTheme = (id: ThemeId) => {
    const palette = PALETTES[id] || PALETTES.default;
    Object.entries(palette).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
  };

  // Keep theme styles loaded when theme variable changes
  useEffect(() => {
    applyTheme(currentThemeId);
  }, [currentThemeId]);

  const setThemeId = (id: ThemeId) => {
    setCurrentThemeId(id);
    applyTheme(id);
  };

  return (
    <ThemeContext.Provider value={{ currentThemeId, setThemeId, applyTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
