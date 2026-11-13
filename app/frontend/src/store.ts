import { create } from "zustand";
import type { User } from "./types";

interface AppState {
  user: User | null;
  setUser: (u: User | null) => void;
  previewPlayer: boolean; // editor si prohlíží web jako hráč
  togglePreview: () => void;
  omnibox: boolean;
  setOmnibox: (v: boolean) => void;
  sidebarOpen: boolean;
  setSidebar: (v: boolean) => void;
}

export const useApp = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  previewPlayer: false,
  togglePreview: () => set((s) => ({ previewPlayer: !s.previewPlayer })),
  omnibox: false,
  setOmnibox: (omnibox) => set({ omnibox }),
  sidebarOpen: false,
  setSidebar: (sidebarOpen) => set({ sidebarOpen }),
}));

export const isEditor = (u: User | null | undefined) =>
  !!u && (u.role === "admin" || u.role === "editor");

export const isAdmin = (u: User | null | undefined) => u?.role === "admin";

// ---------- vzhled ----------
const THEMES = ["pergamen", "noc", "krev", "popel", "hvozd", "mraz", "poust"] as const;
const MODES = ["light", "dark", "auto"] as const;
export type Theme = (typeof THEMES)[number];
export type Mode = (typeof MODES)[number];

interface ThemeState {
  theme: Theme;
  mode: Mode;
  setTheme: (t: Theme) => void;
  setMode: (m: Mode) => void;
}

export const useTheme = create<ThemeState>((set) => ({
  theme: (localStorage.getItem("mont-theme") as Theme) || "pergamen",
  mode: (localStorage.getItem("mont-theme-mode") as Mode) || "auto",
  setTheme: (theme) => {
    localStorage.setItem("mont-theme", theme);
    applyTheme(theme, useTheme.getState().mode);
    set({ theme });
  },
  setMode: (mode) => {
    localStorage.setItem("mont-theme-mode", mode);
    applyTheme(useTheme.getState().theme, mode);
    set({ mode });
  },
}));

export const THEME_LABELS: Record<Theme, string> = {
  pergamen: "Pergamen", noc: "Noc", krev: "Krev a zlato", popel: "Popel",
  hvozd: "Hvozd", mraz: "Mráz", poust: "Poušť",
};
export const MODE_LABELS: Record<Mode, string> = {
  light: "Světlá", dark: "Tmavá", auto: "Auto",
};

export function applyTheme(theme: Theme, mode: Mode) {
  const dark = mode === "dark"
    || (mode === "auto" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.mode = dark ? "dark" : "light";
  document.documentElement.classList.toggle("dark", dark);
}

export function initTheme() {
  const { theme, mode } = useTheme.getState();
  applyTheme(theme, mode);
  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (useTheme.getState().mode === "auto") applyTheme(theme, "auto");
  });
}
