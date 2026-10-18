import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  BLOCKS, DENSITIES, THEMES, defaultState, selectVisiblePeriod,
  type Density, type State, type ThemeId,
} from "@/lib/budget";

const KEY = "safe-to-spend-v1";
type BudgetContextValue = { s: State | null; up: (patch: Partial<State>) => void };
const BudgetContext = createContext<BudgetContextValue | null>(null);
const validTheme = (id: unknown): ThemeId => (THEMES.some((t) => t.id === id) ? (id as ThemeId) : "sage");
const validDensity = (id: unknown): Density => (DENSITIES.some((d) => d.id === id) ? (id as Density) : "comfortable");

export function BudgetProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<State | null>(null);
  useEffect(() => {
    const defaults = defaultState();
    try {
      const raw = localStorage.getItem(KEY);
      const stored = raw ? JSON.parse(raw) : {};
      const merged = { ...defaults, ...stored, show: { ...defaults.show, ...stored.show } };
      if (!Object.values(merged.show).some(Boolean)) merged.show.weekly = true;
      merged.activePeriod = selectVisiblePeriod(merged.show, merged.activePeriod);
      if (!merged.topMode) merged.topMode = "auto";
      merged.theme = validTheme(stored.theme);
      merged.density = validDensity(stored.density);
      merged.onboarded = stored.onboarded === true;
      const order = Array.isArray(stored.layout) ? stored.layout : [];
      merged.layout = [...new Set([...order.filter((id: unknown) => BLOCKS.includes(id as typeof BLOCKS[number])), ...BLOCKS])];
      setS(merged);
    } catch { setS(defaults); }
  }, []);
  useEffect(() => { if (s) localStorage.setItem(KEY, JSON.stringify(s)); }, [s]);
  useEffect(() => {
    if (!s) return;
    document.documentElement.setAttribute("data-theme", s.theme);
    document.documentElement.setAttribute("data-density", s.density);
  }, [s]);
  const up = (patch: Partial<State>) => setS((current) => current ? { ...current, ...patch } : current);
  return <BudgetContext.Provider value={{ s, up }}>{children}</BudgetContext.Provider>;
}

export function useBudget() {
  const context = useContext(BudgetContext);
  if (!context) throw new Error("BudgetProvider is required");
  return context;
}
