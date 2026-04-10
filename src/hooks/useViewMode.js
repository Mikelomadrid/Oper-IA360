import { useState, useEffect } from 'react';

export function useViewMode(key, defaultMode = 'grid') {
  const [viewMode, setViewMode] = useState(() => {
    try {
      const saved = localStorage.getItem(`viewMode_${key}`);
      return saved && ['grid', 'list'].includes(saved) ? saved : defaultMode;
    } catch (e) {
      return defaultMode;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(`viewMode_${key}`, viewMode);
    } catch (e) {
      console.error("Failed to save view mode", e);
    }
  }, [viewMode, key]);

  return { viewMode, setViewMode };
}