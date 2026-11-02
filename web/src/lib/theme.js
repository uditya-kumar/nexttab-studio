import { useCallback, useState } from "react";

// The theme lives on <html data-theme>. index.html sets it before first paint from the same
// storage key, so the page never flashes the wrong colors.
const KEY = "nexttab.theme";

export const currentTheme = () => document.documentElement.dataset.theme || "dark";

export function useTheme() {
  const [theme, setThemeState] = useState(currentTheme);
  const setTheme = useCallback((next) => {
    document.documentElement.dataset.theme = next;
    localStorage.setItem(KEY, next);
    setThemeState(next);
  }, []);
  return [theme, setTheme];
}
