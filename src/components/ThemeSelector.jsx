import React from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const themes = [
  { id: "claro-1", label: "Claro 1", color: "#4F2DEC" }, // Indigo
  { id: "claro-2", label: "Claro 2", color: "#222222" }, // Monochrome
  { id: "claro-3", label: "Claro 3", color: "#4B6BFF" }, // Corporate Blue

  { id: "dark-1", label: "Dark 1", color: "#f97316" }, // Warm Orange
  { id: "dark-2", label: "Dark 2", color: "#06b6d4" }, // Cyber Cyan
  { id: "dark-3", label: "Dark 3", color: "#FFFFFF" }, // High Contrast White
];

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="p-4 bg-background border rounded-lg shadow-xl w-full max-w-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-foreground">Seleccionar Tema</h3>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        {/* Columna Izquierda: Claros */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-semibold mb-2">Claro</p>
          {themes.slice(0, 3).map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={cn(
                "flex items-center gap-3 w-full p-2 rounded-md transition-all hover:bg-muted border border-transparent",
                theme === t.id ? "bg-muted border-primary/50 ring-1 ring-ring" : ""
              )}
            >
              <span
                style={{ backgroundColor: t.color }}
                className="w-5 h-5 rounded-full border border-border shadow-sm flex items-center justify-center shrink-0"
              >
                {theme === t.id && (
                  <Check className="w-3 h-3 text-white mix-blend-difference" strokeWidth={3} />
                )}
              </span>
              <span className="text-sm font-medium">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Columna Derecha: Oscuros */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-semibold mb-2">Oscuro</p>
          {themes.slice(3).map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={cn(
                "flex items-center gap-3 w-full p-2 rounded-md transition-all hover:bg-muted border border-transparent",
                theme === t.id ? "bg-muted border-primary/50 ring-1 ring-ring" : ""
              )}
            >
              <span
                style={{ backgroundColor: t.color }}
                className="w-5 h-5 rounded-full border border-border shadow-sm flex items-center justify-center shrink-0"
              >
                {theme === t.id && (
                  <Check className="w-3 h-3 text-black mix-blend-difference" strokeWidth={3} />
                )}
              </span>
              <span className="text-sm font-medium">{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}