"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "ps-theme";
const COOKIE = "ps-theme";

type ThemeContextValue = {
  theme: Theme;
  resolved: "light" | "dark";
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && systemPrefersDark());
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  root.dataset.theme = theme;
  return dark ? "dark" : "light";
}

function readStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "light" || value === "dark" || value === "system") return value;
  } catch {
    // Storage can be blocked. The cookie or default still applies.
  }
  return null;
}

export function ThemeProvider({
  initialTheme = "system",
  children,
}: {
  initialTheme?: Theme;
  children: ReactNode;
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = readStoredTheme();
    if (stored && stored !== theme) setThemeState(stored);
    // Only run once: the server cookie is the starting point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setResolved(applyTheme(theme));
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Ignore blocked storage.
    }
    document.cookie = `${COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (theme === "system") setResolved(applyTheme("system"));
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);

  const value = useMemo(
    () => ({ theme, resolved, setTheme }),
    [theme, resolved, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
