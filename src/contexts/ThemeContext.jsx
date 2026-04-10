import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    // Check local storage or default to 'claro-1'
    return localStorage.getItem('theme') || 'claro-1';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    
    // Remove all possible theme classes to avoid conflicts
    root.classList.remove(
      'light', 'dark',
      'claro-1', 'claro-2', 'claro-3',
      'dark-1', 'dark-2', 'dark-3'
    );

    // Add current specific theme class (e.g., 'dark-2')
    root.classList.add(theme);
    
    // Add generic 'dark' class if the theme is one of the dark variants.
    // This allows Tailwind's 'dark:' modifier to work.
    if (theme.startsWith('dark')) {
      root.classList.add('dark');
    } else {
      root.classList.add('light');
    }

    localStorage.setItem('theme', theme);
  }, [theme]);

  // Toggles between the primary light (claro-1) and primary dark (dark-1) themes
  const toggleTheme = () => {
    setTheme((prevTheme) => {
      if (prevTheme.startsWith('claro')) return 'dark-1';
      return 'claro-1';
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};