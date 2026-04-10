import { useTheme as useContextTheme } from "@/contexts/ThemeContext";

// Re-export the hook from context to maintain backward compatibility
// with components importing from '@/hooks/useTheme'
export function useTheme() {
  return useContextTheme();
}