"use client";

import { Moon, Sun } from "lucide-react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type LandingTheme = "light" | "dark";

const STORAGE_KEY = "cleat-theme";

const ThemeContext = createContext<{
  theme: LandingTheme;
  setTheme: (theme: LandingTheme) => void;
}>({
  theme: "light",
  setTheme: () => undefined,
});

export function useLandingTheme() {
  return useContext(ThemeContext);
}

export function LandingThemeProvider({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const [theme, setTheme] = useState<LandingTheme>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") setTheme(saved);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [ready, theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <div className={`landing ${className ?? ""}`} data-theme={theme}>
        <div aria-hidden className="landing-grain" />
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useLandingTheme();
  const next = theme === "light" ? "dark" : "light";

  return (
    <button
      aria-label={`Switch to ${next} mode`}
      className={`${className} !size-10 !justify-center !px-0`}
      onClick={() => setTheme(next)}
      title={`Switch to ${next} mode`}
      type="button"
    >
      {theme === "light" ? <Sun aria-hidden size={16} /> : <Moon aria-hidden size={16} />}
    </button>
  );
}
