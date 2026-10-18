import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Activity, Book, BookOpen, Brain, Check, CheckCircle, CheckSquare, ChevronRight, Coffee, Droplet, Droplets,
  Dumbbell, Footprints, GripVertical, HardDrive, Heart, History, LayoutGrid, Leaf, Loader, LogOut, Mail, Menu,
  Minus, Moon, Music, NotebookPen, Pause, Pencil, Play, Plus, RotateCcw, Smile, Square, Star, Sun, Timer,
  Trash2, X, XCircle, Zap,
} from "lucide-react";
import {
  Btn, PageHeader, SectionHead, PanelHead, SegBars, Ring, MoodFace, MoodPicker, MOOD_LABELS, EmptyState,
  usePopover, FlameMark, LogoTile, cx,
} from "./ui";
import { supabase } from "./supabase";
import type { SupabaseUser } from "./supabase";
import { IS_DESKTOP } from "./desktop";
import { chooseStart, isNewer, canStartOffline } from "./sync";

/* ============================== Storage helpers ============================== */

const STORAGE_KEY = "sanctum-state-v1";

function migrateState(parsed: any) {
  if (!parsed) return null;
  if (!parsed.journalEntries) parsed.journalEntries = [];
  if (!parsed.familiar) parsed.familiar = { name: "Ember", color: "#a855f7", affection: 0 };
  if (!parsed.dashboardWidgets) parsed.dashboardWidgets = ["habits", "tasks"];
  if (!parsed.rpg) parsed.rpg = defaultRpgState();
  if (!parsed.processedEssenceLog) parsed.processedEssenceLog = { habits: 0, tasks: 0, focusMs: 0 };
  if (!parsed.theme) parsed.theme = "amethyst";
  return parsed;
}

function loadStateLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? migrateState(JSON.parse(raw)) : null;
  } catch { return null; }
}

function saveStateLocal(state: any) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

/** The account's saved copy. `ok: false` means Supabase couldn't be reached, which is
 *  NOT the same as "no saved copy yet" — the two must never be confused, or a new or
 *  offline device would upload its blank copy over the real data. */
async function loadStateRemote(userId: string): Promise<{ ok: true; state: any | null } | { ok: false }> {
  try {
    const query = supabase
      .from("sanctum_state")
      .select("state")
      .eq("user_id", userId)
      .maybeSingle();
    const timedOut = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000));
    const result = await Promise.race([query, timedOut]);
    if (!result || result.error) return { ok: false };
    return { ok: true, state: result.data ? migrateState(result.data.state) : null };
  } catch {
    return { ok: false };
  }
}

async function saveStateRemote(userId: string, state: any): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("sanctum_state")
      .upsert({ user_id: userId, state }, { onConflict: "user_id" });
    return !error;
  } catch {
    return false;
  }
}

/* ============================== Types ============================== */

type Habit = {
  id: number;
  name: string;
  description?: string;
  frequency: "daily" | "weekly";
  color: string;
  icon: string;
};
type HabitCompletion = { habitId: number; date: string };
type Task = {
  id: number;
  title: string;
  description?: string;
  status: "todo" | "done";
  priority: "low" | "medium" | "high";
  category?: string;
  completedAt?: string;
};
type FocusSession = { id: number; durationMinutes: number; label: string; startedAt: string };
type HealthLog = { id: number; type: string; value: number; unit: string; loggedAt: string };
type FastSession = {
  id: number;
  protocol: string;
  targetHours: number;
  startedAt: string;
  endedAt?: string;
  status: "active" | "completed" | "broken";
};
type JournalEntry = {
  id: number;
  date: string; // YYYY-MM-DD, one primary entry per day
  text: string;
  mood: number | null; // 1-5, mirrors health mood scale
  updatedAt: string;
};
type Familiar = {
  name: string;
  color: string;
  affection: number;
};
type WidgetId = "habits" | "tasks" | "focus" | "vitality" | "fast" | "journal" | "lofi";
type ThemeId = "amethyst" | "emerald" | "bloodmoon" | "frostbound" | "solarflare";

type GearTier = "common" | "rare" | "epic";
type GearSlot = "weapon" | "armor" | "trinket";
type Gear = {
  id: string;
  slot: GearSlot;
  name: string;
  tier: GearTier;
  atk: number;
  def: number;
  hp: number;
};
type BattleLogLine = { side: "player" | "enemy" | "system"; text: string };
type BattleRecord = {
  id: number;
  enemyName: string;
  enemyTier: number;
  won: boolean;
  essenceSpent: number;
  essenceGained: number;
  gearDropped?: string;
  at: string;
};
type RpgState = {
  lifetimeEssence: number;
  essenceBalance: number;
  level: number;
  equipped: { weapon: Gear | null; armor: Gear | null; trinket: Gear | null };
  inventory: Gear[];
  battleHistory: BattleRecord[];
};

let idCounter = 1000;
function nextId() {
  return ++idCounter;
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

/* ============================== Seed data ============================== */

/* ============================== Theme Palettes ============================== */

type ThemePalette = {
  id: ThemeId;
  label: string;
  description: string;
  swatch: string; // a representative hue for the picker dot
  vars: {
    accent: string;        // primary accent hue (was amber 38 88% 52%)
    accentSoft: string;    // lighter accent for text (was 38 88% 58-62%)
    accentDeep: string;    // darker accent for gradients (was 38 88% 30-45%)
    accent2: string;       // secondary/violet accent (was 270 60% 60%)
    accent2Soft: string;   // lighter secondary (was 270 60% 66-72%)
    bg: string;            // page background (was 228 38% 7%)
    bgPanel: string;       // sidebar/header background (was 228 36% 8%)
    bgCard: string;        // card background (was 228 34% 10%)
    border: string;        // base border hue (was 228 25% 16%)
  };
  /** Design B ("sleek arcane") colours, each "H S% L%": the bright accent used for
   *  buttons and highlights, the second accent (violet in Amethyst), and the page ground. */
  ui: { accent: string; accent2: string; ground: string };
};

const THEMES: Record<ThemeId, ThemePalette> = {
  amethyst: {
    id: "amethyst",
    label: "Amethyst",
    description: "The original Sanctum — gold and violet candlelight.",
    swatch: "linear-gradient(135deg, hsl(38 88% 52%), hsl(270 60% 60%))",
    vars: {
      accent: "38 88% 52%", accentSoft: "38 88% 60%", accentDeep: "38 88% 38%",
      accent2: "270 60% 60%", accent2Soft: "270 60% 72%",
      bg: "228 38% 7%", bgPanel: "228 36% 8%", bgCard: "228 34% 10%", border: "228 25% 16%",
    },
    ui: { accent: "37 86% 63%", accent2: "254 100% 71%", ground: "233 33% 5%" },
  },
  emerald: {
    id: "emerald",
    label: "Emerald Coven",
    description: "Moss, malachite, and witchlight green.",
    swatch: "linear-gradient(135deg, hsl(150 70% 45%), hsl(160 50% 55%))",
    vars: {
      accent: "150 70% 45%", accentSoft: "150 65% 55%", accentDeep: "150 70% 30%",
      accent2: "168 55% 50%", accent2Soft: "168 55% 64%",
      bg: "160 30% 6%", bgPanel: "160 28% 7%", bgCard: "158 26% 9%", border: "158 20% 16%",
    },
    ui: { accent: "152 58% 56%", accent2: "172 60% 52%", ground: "165 32% 4.5%" },
  },
  bloodmoon: {
    id: "bloodmoon",
    label: "Blood Moon",
    description: "Crimson runes under an eclipsed sky.",
    swatch: "linear-gradient(135deg, hsl(355 75% 50%), hsl(15 70% 50%))",
    vars: {
      accent: "355 75% 52%", accentSoft: "355 70% 62%", accentDeep: "355 75% 36%",
      accent2: "15 70% 50%", accent2Soft: "15 70% 64%",
      bg: "350 30% 6%", bgPanel: "350 28% 7%", bgCard: "350 24% 9%", border: "350 20% 17%",
    },
    ui: { accent: "356 82% 65%", accent2: "18 85% 62%", ground: "350 30% 5%" },
  },
  frostbound: {
    id: "frostbound",
    label: "Frostbound",
    description: "Glacial blue, silver frost, winter stillness.",
    swatch: "linear-gradient(135deg, hsl(195 80% 55%), hsl(210 50% 65%))",
    vars: {
      accent: "195 80% 55%", accentSoft: "195 75% 65%", accentDeep: "195 80% 38%",
      accent2: "215 50% 62%", accent2Soft: "215 55% 74%",
      bg: "215 32% 7%", bgPanel: "215 30% 8%", bgCard: "215 26% 10%", border: "215 20% 17%",
    },
    ui: { accent: "196 85% 62%", accent2: "224 88% 72%", ground: "218 38% 5%" },
  },
  solarflare: {
    id: "solarflare",
    label: "Solar Flare",
    description: "Molten orange and ember red, desert dusk.",
    swatch: "linear-gradient(135deg, hsl(25 90% 55%), hsl(45 90% 55%))",
    vars: {
      accent: "25 90% 55%", accentSoft: "25 85% 64%", accentDeep: "25 90% 38%",
      accent2: "45 90% 55%", accent2Soft: "45 85% 65%",
      bg: "20 30% 7%", bgPanel: "20 28% 8%", bgCard: "18 24% 10%", border: "18 22% 17%",
    },
    ui: { accent: "27 92% 60%", accent2: "45 95% 60%", ground: "20 32% 5%" },
  },
};

/*
 * How the theme reaches every page. The pages were drawn in Amethyst's colours,
 * so each colour is written relative to that theme:
 *   hsl(var(--accent-h) var(--accent-s) 62%)   the accent's hue, a set lightness
 *   hsl(var(--bg-h) calc(var(--bg-s) * 0.9) 10%) the background's hue, a bit less saturated
 * and the Tailwind classes text-amber-*, bg-violet-* etc. read --th-amber-* and
 * --th-violet-* (see tailwind.config.js). In Amethyst every value works out to
 * exactly the original colour; other themes swap in their own hues.
 */
// Tailwind's amber and violet shades as [hue, saturation %, lightness %].
const TW_AMBER: Record<number, [number, number, number]> = {
  50: [48.0, 100.0, 96.08], 100: [48.0, 96.49, 88.82], 200: [48.0, 96.64, 76.67], 300: [45.94, 96.69, 64.51], 400: [43.26, 96.41, 56.27], 500: [37.69, 92.13, 50.2], 600: [32.13, 94.62, 43.73], 700: [25.96, 90.48, 37.06], 800: [22.73, 82.5, 31.37], 900: [21.71, 77.78, 26.47], 950: [20.91, 91.67, 14.12],
};
const TW_VIOLET: Record<number, [number, number, number]> = {
  50: [250.0, 100.0, 97.65], 100: [251.43, 91.3, 95.49], 200: [250.5, 95.24, 91.76], 300: [252.5, 94.74, 85.1], 400: [255.14, 91.74, 76.27], 500: [258.31, 89.53, 66.27], 600: [262.12, 83.26, 57.84], 700: [263.39, 69.96, 50.39], 800: [263.36, 69.3, 42.16], 900: [263.5, 67.42, 34.9], 950: [261.18, 72.65, 22.94],
};

function hslParts(value: string): [number, number, number] {
  const [h, s, l] = value.split(/\s+/).map((part) => parseFloat(part));
  return [h, s, l];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** A Tailwind palette moved to a theme's hue, with saturation scaled to match. */
function shadeVars(name: string, palette: Record<number, [number, number, number]>, base: string, target: string) {
  const [baseH, baseS] = hslParts(base);
  const [h, s] = hslParts(target);
  return Object.entries(palette).map(([shade, [th, ts, tl]]) => {
    const hue = round2((((h + th - baseH) % 360) + 360) % 360);
    const sat = round2(Math.min(100, (ts * s) / baseS));
    return `--th-${name}-${shade}: ${hue} ${sat}% ${tl}%;`;
  }).join("\n");
}

/** The CSS variables for a theme, ready to go inside a :root { } rule. */
function themeCssVars(theme: ThemePalette): string {
  const v = theme.vars;
  const base = THEMES.amethyst.vars;
  const [ah, as] = hslParts(v.accent);
  const [a2h, a2s] = hslParts(v.accent2);
  const [bh, bs] = hslParts(v.bg);
  return [
    `--accent: ${v.accent};`, `--accent-soft: ${v.accentSoft};`, `--accent-deep: ${v.accentDeep};`,
    `--accent2: ${v.accent2};`, `--accent2-soft: ${v.accent2Soft};`,
    `--bg: ${v.bg};`, `--bg-panel: ${v.bgPanel};`, `--bg-card: ${v.bgCard};`, `--border: ${v.border};`,
    `--accent-h: ${ah}; --accent-s: ${as}%;`,
    `--accent2-h: ${a2h}; --accent2-s: ${a2s}%;`,
    `--bg-h: ${bh}; --bg-s: ${bs}%;`,
    shadeVars("amber", TW_AMBER, base.accent, v.accent),
    shadeVars("violet", TW_VIOLET, base.accent2, v.accent2),
    `--ui-accent: ${theme.ui.accent}; --ui-accent2: ${theme.ui.accent2}; --ui-ground: ${theme.ui.ground};`,
    `--ui-on-accent: ${hslParts(theme.ui.accent)[0]} 45% 7%;`,
  ].join("\n");
}

/**
 * Sets the theme before the app first draws, from the copy saved on this
 * device, so the loading and sign-in screens already use it. Once the study
 * is open, SanctumApp's own <style> takes over (it comes later in the page).
 */
export function applySavedTheme() {
  let id: ThemeId = "amethyst";
  try { id = (loadStateLocal()?.theme as ThemeId) ?? "amethyst"; } catch { /* keep Amethyst */ }
  const theme = THEMES[id] ?? THEMES.amethyst;
  let el = document.getElementById("sanctum-theme") as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = "sanctum-theme";
    document.head.appendChild(el);
  }
  el.textContent = `:root {\n${themeCssVars(theme)}\n}`;
}

/** Adds transparency to a colour given as #rrggbb or hsl(…). */
function withAlpha(color: string, alpha: number): string {
  if (color.startsWith("#") && color.length === 7) {
    return color + Math.round(alpha * 255).toString(16).padStart(2, "0");
  }
  if (color.startsWith("hsl(") && color.endsWith(")") && !color.includes("/")) {
    return `${color.slice(0, -1)} / ${alpha})`;
  }
  return color;
}


function defaultRpgState(): RpgState {
  return {
    lifetimeEssence: 0,
    essenceBalance: 0,
    level: 1,
    equipped: { weapon: null, armor: null, trinket: null },
    inventory: [],
    battleHistory: [],
  };
}

function seedState() {
  return {
    habits: [
      { id: 1, name: "Morning meditation", description: "10 minutes of stillness", frequency: "daily", color: "#c084fc", icon: "brain" },
      { id: 2, name: "Drink water", description: "Stay hydrated", frequency: "daily", color: "#60a5fa", icon: "droplets" },
      { id: 3, name: "Read", description: "20 pages minimum", frequency: "daily", color: "#f59e0b", icon: "book-open" },
    ] as Habit[],
    habitCompletions: [] as HabitCompletion[],
    tasks: [
      { id: 1, title: "Plan the week ahead", priority: "medium", status: "todo", category: "Planning" },
      { id: 2, title: "Reply to important emails", priority: "high", status: "todo", category: "Work" },
    ] as Task[],
    focusSessions: [] as FocusSession[],
    healthLogs: [] as HealthLog[],
    fastSessions: [] as FastSession[],
    journalEntries: [] as JournalEntry[],
    familiar: { name: "Ember", color: "#a855f7", affection: 0 } as Familiar,
    dashboardWidgets: ["habits", "tasks"] as WidgetId[],
    rpg: defaultRpgState(),
    // Tracks how much of each source has already been converted to Essence, so re-renders don't double-grant.
    processedEssenceLog: { habits: 0, tasks: 0, focusMs: 0 },
    theme: "amethyst" as ThemeId,
  };
}

/* ============================== App State Hook ============================== */

type SyncStatus = "syncing" | "synced" | "offline";

/**
 * Desktop mode is local-only and stores state in Documents/Sanctum/sanctum-data.json.
 * Website mode stores a local recovery copy and syncs to the signed-in account.
 * For website sync, this device reads the account's copy before uploading changes,
 * so a blank/new device cannot overwrite existing data. Offline changes are queued
 * until the account can be reached again.
 */
function useSanctumStore(user: SupabaseUser | null) {
  const [state, setState] = useState<any>(() => loadStateLocal() ?? seedState());
  const [status, setStatus] = useState<SyncStatus>("syncing");
  const [ready, setReady] = useState(false);

  // The desktop app writes a readable JSON file in Documents/Sanctum. The browser
  // storage copy is retained as a recovery/migration backup, but isn't the primary store.
  const desktopLoaded = useRef(false);
  const localSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userId = user?.id ?? null;
  const userIdRef = useRef<string | null>(userId);
  userIdRef.current = userId;
  const latest = useRef<any>(state); // newest state, for timers and focus checks
  const remoteReady = useRef(false); // true once the account's copy has been read
  const pushedAt = useRef(0); // _changedAt of the copy last saved to the account
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushNow = useCallback(async () => {
    saveTimer.current = null;
    const uid = userIdRef.current;
    if (!uid || !remoteReady.current) return;
    const snapshot = latest.current;
    setStatus("syncing");
    const ok = await saveStateRemote(uid, snapshot);
    if (uid !== userIdRef.current) return;
    if (ok) {
      pushedAt.current = Math.max(pushedAt.current, snapshot._changedAt ?? 0);
      setStatus("synced");
    } else {
      setStatus("offline");
      // Try again shortly unless a newer change already queued its own save.
      if (!saveTimer.current) saveTimer.current = setTimeout(pushNow, 15000);
    }
  }, []);

  // Change the state: stamps the change with the time and the account it belongs to.
  const setAppState = useCallback((updater: any) => {
    setState((prev: any) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (next === prev) return prev;
      if (IS_DESKTOP) {
        const { _owner: _discardedOwner, ...localOnly } = next;
        return { ...localOnly, _changedAt: Date.now() };
      }
      return { ...next, _changedAt: Date.now(), _owner: userIdRef.current ?? next._owner };
    });
  }, []);

  // Desktop-only startup. Load the JSON file first, recover from the browser copy
  // if it is newer, then make sure a usable file exists before showing the app.
  useEffect(() => {
    if (!IS_DESKTOP) return;
    let cancelled = false;

    const loadDesktopState = async () => {
      let fileState: any = null;
      try {
        const contents = await invoke<string | null>("load_local_state");
        if (contents) {
          try { fileState = migrateState(JSON.parse(contents)); }
          catch (error) { console.error("Sanctum data file could not be parsed; trying the local recovery copy.", error); }
        }
      } catch (error) {
        console.error("Sanctum could not read its local data file; trying the local recovery copy.", error);
      }
      if (cancelled) return;

      const browserState = loadStateLocal();
      let loaded = fileState;
      if (browserState && (!loaded || (browserState._changedAt ?? 0) > (loaded._changedAt ?? 0))) {
        loaded = browserState;
      }
      if (!loaded) loaded = latest.current ?? seedState();

      // Account ownership is not relevant in local-only desktop mode.
      const { _owner: _discardedOwner, ...localOnly } = loaded;
      loaded = { ...localOnly, _changedAt: loaded._changedAt ?? Date.now() };
      desktopLoaded.current = true;
      latest.current = loaded;
      saveStateLocal(loaded);
      setState(loaded);

      try {
        await invoke("save_local_state", { contents: JSON.stringify(loaded, null, 2) });
        if (!cancelled) setStatus("synced");
      } catch (error) {
        console.error("Sanctum could not write its local data file.", error);
        if (!cancelled) setStatus("offline");
      }
      if (!cancelled) setReady(true);
    };

    void loadDesktopState();
    return () => { cancelled = true; };
  }, []);

  // Save every change immediately to browser recovery storage. For desktop, also
  // queue a file write; for the website, queue the existing account sync instead.
  useEffect(() => {
    latest.current = state;
    if (IS_DESKTOP) {
      if (!desktopLoaded.current) return;
      saveStateLocal(state);
      if (localSaveTimer.current) clearTimeout(localSaveTimer.current);
      setStatus("syncing");
      const snapshot = state;
      localSaveTimer.current = setTimeout(() => {
        invoke("save_local_state", { contents: JSON.stringify(snapshot, null, 2) })
          .then(() => setStatus("synced"))
          .catch((error) => {
            console.error("Sanctum could not save its local data file.", error);
            setStatus("offline");
          });
      }, 200);
      return;
    }

    saveStateLocal(state);
    if (remoteReady.current && userIdRef.current && (state._changedAt ?? 0) > pushedAt.current) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(pushNow, 1500);
    }
  }, [state, pushNow]);

  const adoptRemote = useCallback((remote: any, uid: string) => {
    const owned = { ...remote, _owner: uid };
    pushedAt.current = remote._changedAt ?? 0;
    latest.current = owned;
    setState(owned);
  }, []);

  // After sign-in: read the account's copy (retrying while offline), then decide what to keep.
  useEffect(() => {
    if (IS_DESKTOP) return;
    remoteReady.current = false;
    pushedAt.current = 0;
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    if (!userId) { setReady(false); return; }

    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    setReady(false);
    setStatus("syncing");

    const attempt = async (delay: number) => {
      const res = await loadStateRemote(userId);
      if (cancelled) return;
      if (!res.ok) {
        setStatus("offline");
        if (canStartOffline(latest.current, userId)) setReady(true);
        retry = setTimeout(() => attempt(Math.min(delay * 2, 60000)), delay);
        return;
      }
      const local = latest.current;
      const choice = chooseStart(local, res.state, userId);
      remoteReady.current = true;
      if (choice.use === "remote") {
        adoptRemote(res.state, userId);
        setStatus("synced");
      } else {
        const base = choice.use === "local" ? local : seedState();
        const stamped = { ...base, _owner: userId, _changedAt: Math.max(Date.now(), (base._changedAt ?? 0) + 1) };
        setState(stamped); // the save effect uploads it
      }
      setReady(true);
    };
    attempt(5000);
    return () => { cancelled = true; if (retry) clearTimeout(retry); };
  }, [userId, adoptRemote]);

  // Coming back to the window: pick up anything saved from another device meanwhile.
  useEffect(() => {
    if (IS_DESKTOP || !userId) return;
    let lastCheck = 0;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      if (!remoteReady.current || saveTimer.current || Date.now() - lastCheck < 10000) return;
      lastCheck = Date.now();
      const before = latest.current;
      const res = await loadStateRemote(userId);
      // Skip if anything changed here while we were asking.
      if (!res.ok || !res.state || latest.current !== before || saveTimer.current) return;
      if (isNewer(res.state, before)) adoptRemote(res.state, userId);
    };
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [userId, adoptRemote]);

  /** Send any queued change right away (used before signing out). */
  const flush = useCallback(async () => {
    if (!saveTimer.current) return;
    clearTimeout(saveTimer.current);
    await pushNow();
  }, [pushNow]);

  return [state, setAppState, status, ready, flush] as const;
}

/* ============================== Derived calculations ============================== */

function computeSummary(state: any) {
  const today = todayStr();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const completedHabitIds = new Set(
    state.habitCompletions.filter((c: HabitCompletion) => c.date === today).map((c: HabitCompletion) => c.habitId)
  );
  const habitsCompletedToday = completedHabitIds.size;
  const totalHabits = state.habits.length;

  const totalFocusMinutesToday = state.focusSessions
    .filter((s: FocusSession) => new Date(s.startedAt) >= todayStart)
    .reduce((sum: number, s: FocusSession) => sum + s.durationMinutes, 0);

  const doneTasksToday = state.tasks.filter((t: Task) => {
    if (t.status !== "done" || !t.completedAt) return false;
    return new Date(t.completedAt) >= todayStart;
  });
  const tasksCompletedToday = doneTasksToday.length;
  const pendingTasks = state.tasks.filter((t: Task) => t.status !== "done").length;

  const allDoneTasks = state.tasks.filter((t: Task) => t.status === "done");
  const totalFocusMinutesAll = state.focusSessions.reduce((sum: number, s: FocusSession) => sum + s.durationMinutes, 0);

  const xp = state.habitCompletions.length * 10 + totalFocusMinutesAll * 0.5 + allDoneTasks.length * 20;
  const xpInt = Math.floor(xp);
  const xpPerLevel = 100;
  const level = Math.floor(xpInt / xpPerLevel) + 1;
  const xpToNextLevel = xpPerLevel - (xpInt % xpPerLevel);

  const completionsByHabit: Record<number, Set<string>> = {};
  for (const c of state.habitCompletions as HabitCompletion[]) {
    if (!completionsByHabit[c.habitId]) completionsByHabit[c.habitId] = new Set();
    completionsByHabit[c.habitId].add(c.date);
  }

  const currentStreaks: { habitId: number; habitName: string; streak: number; color: string }[] = [];
  for (const habit of state.habits as Habit[]) {
    const datesSet = completionsByHabit[habit.id] ?? new Set<string>();
    let streak = 0;
    const checkDate = new Date();
    const completedToday = datesSet.has(today);
    if (!completedToday) checkDate.setDate(checkDate.getDate() - 1);
    for (let i = 0; i < 365; i++) {
      const dateStr = checkDate.toISOString().split("T")[0];
      if (datesSet.has(dateStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else break;
    }
    if (streak > 0) {
      currentStreaks.push({ habitId: habit.id, habitName: habit.name, streak, color: habit.color });
    }
  }
  currentStreaks.sort((a, b) => b.streak - a.streak);

  return {
    xp: xpInt,
    level,
    xpToNextLevel,
    habitsCompletedToday,
    totalHabits,
    totalFocusMinutesToday,
    currentStreaks: currentStreaks.slice(0, 5),
    tasksCompletedToday,
    pendingTasks,
  };
}

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

/* ============================== RPG Engine ============================== */

const ESSENCE_PER_LEVEL = 100;
const HABIT_ESSENCE = 5;
const TASK_ESSENCE: Record<Priority, number> = { low: 10, medium: 15, high: 25 };
const ESSENCE_PER_FOCUS_MIN = 1;

/** Computes how much *new* Essence should be granted based on counters that have grown since last sync,
 *  and returns an updated processedEssenceLog + the delta. Pure function — no mutation. */
function syncEssence(state: any) {
  const log = state.processedEssenceLog ?? { habits: 0, tasks: 0, focusMs: 0 };

  const habitsCount = state.habitCompletions.length;
  const newHabits = Math.max(0, habitsCount - log.habits);
  const habitEssence = newHabits * HABIT_ESSENCE;

  const doneTasks = state.tasks.filter((t: Task) => t.status === "done");
  // Sum essence for done tasks by priority, then compare to what's already been counted (by count, simplification).
  const tasksCount = doneTasks.length;
  const newTasksCount = Math.max(0, tasksCount - log.tasks);
  // Approximate: take the newest N done tasks (by completedAt) as the "new" ones for essence purposes.
  const sortedDone = [...doneTasks].sort((a: Task, b: Task) => new Date(a.completedAt || 0).getTime() - new Date(b.completedAt || 0).getTime());
  const newlyDone = sortedDone.slice(log.tasks, log.tasks + newTasksCount);
  const taskEssence = newlyDone.reduce((sum: number, t: Task) => sum + (TASK_ESSENCE[t.priority as Priority] ?? 10), 0);

  const totalFocusMs = state.focusSessions.reduce((sum: number, s: FocusSession) => sum + s.durationMinutes * 60000, 0);
  const newFocusMs = Math.max(0, totalFocusMs - log.focusMs);
  const focusEssence = Math.floor(newFocusMs / 60000) * ESSENCE_PER_FOCUS_MIN;

  const delta = habitEssence + taskEssence + focusEssence;
  const nextLog = { habits: habitsCount, tasks: tasksCount, focusMs: totalFocusMs };
  return { delta, nextLog };
}

function rpgLevelFromEssence(lifetimeEssence: number) {
  return Math.floor(lifetimeEssence / ESSENCE_PER_LEVEL) + 1;
}

/** Derived combat stats from level + equipped gear. */
function computeRpgStats(rpg: RpgState) {
  const level = rpg.level;
  const baseHp = 40 + level * 8;
  const baseAtk = 6 + level * 2;
  const baseDef = 3 + Math.floor(level * 1.2);
  const baseSpeed = 5 + Math.floor(level * 0.6);

  let hp = baseHp, atk = baseAtk, def = baseDef;
  for (const slot of ["weapon", "armor", "trinket"] as GearSlot[]) {
    const g = rpg.equipped[slot];
    if (g) { hp += g.hp; atk += g.atk; def += g.def; }
  }
  return { hp, atk, def, speed: baseSpeed };
}

const GEAR_NAMES: Record<GearSlot, Record<GearTier, string[]>> = {
  weapon: {
    common: ["Apprentice's Wand", "Worn Dagger", "Oak Staff"],
    rare: ["Runed Blade", "Storm Wand", "Twilight Rapier"],
    epic: ["Starfire Scepter", "Voidedge Blade", "Dragonbone Staff"],
  },
  armor: {
    common: ["Cloth Robe", "Leather Vest", "Traveler's Cloak"],
    rare: ["Enchanted Mail", "Runic Robes", "Shadowweave Cloak"],
    epic: ["Astral Plate", "Phoenix Mantle", "Voidsteel Armor"],
  },
  trinket: {
    common: ["Copper Charm", "Lucky Coin", "Glass Bead"],
    rare: ["Moonstone Ring", "Whisper Amulet", "Ember Sigil"],
    epic: ["Heart of the Nebula", "Eternity Band", "Sigil of the Archmage"],
  },
};
const GEAR_TIER_MULT: Record<GearTier, number> = { common: 1, rare: 1.8, epic: 3 };

function rollGear(enemyTier: number): Gear {
  const slots: GearSlot[] = ["weapon", "armor", "trinket"];
  const slot = slots[Math.floor(Math.random() * slots.length)];
  const roll = Math.random();
  const tier: GearTier = enemyTier >= 4 && roll < 0.25 ? "epic" : roll < 0.55 ? "rare" : "common";
  const names = GEAR_NAMES[slot][tier];
  const name = names[Math.floor(Math.random() * names.length)];
  const mult = GEAR_TIER_MULT[tier];
  const base = 2 + enemyTier;
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    slot,
    name,
    tier,
    atk: slot === "weapon" ? Math.round(base * mult * 1.4) : Math.round(base * mult * 0.4),
    def: slot === "armor" ? Math.round(base * mult * 1.4) : Math.round(base * mult * 0.4),
    hp: slot === "armor" ? Math.round(base * mult * 4) : Math.round(base * mult * 1.5),
  };
}

type Enemy = { name: string; tier: number; hp: number; atk: number; def: number; speed: number; emoji: string };

const ENEMY_TIERS: Enemy[] = [
  { name: "Slime", tier: 1, hp: 30, atk: 6, def: 2, speed: 3, emoji: "🟢" },
  { name: "Goblin", tier: 1, hp: 38, atk: 8, def: 3, speed: 6, emoji: "👺" },
  { name: "Skeleton", tier: 2, hp: 52, atk: 11, def: 5, speed: 5, emoji: "💀" },
  { name: "Dire Wolf", tier: 2, hp: 60, atk: 13, def: 4, speed: 9, emoji: "🐺" },
  { name: "Wraith", tier: 3, hp: 75, atk: 17, def: 7, speed: 8, emoji: "👻" },
  { name: "Stone Golem", tier: 3, hp: 110, atk: 14, def: 14, speed: 2, emoji: "🗿" },
  { name: "Wyvern", tier: 4, hp: 130, atk: 22, def: 10, speed: 10, emoji: "🐉" },
  { name: "Lich King", tier: 5, hp: 180, atk: 28, def: 14, speed: 7, emoji: "☠️" },
];

/** Simulates a full turn-based battle (player+familiar vs enemy) and returns a log + outcome. */
function simulateBattle(playerStats: { hp: number; atk: number; def: number; speed: number }, familiarBonus: number, enemy: Enemy, specialUsed: boolean) {
  const log: BattleLogLine[] = [];
  let pHp = playerStats.hp;
  let eHp = enemy.hp;
  const pAtk = playerStats.atk + familiarBonus;
  const playerFirst = playerStats.speed >= enemy.speed;

  log.push({ side: "system", text: `A wild ${enemy.name} appears!` });

  let turn = 0;
  while (pHp > 0 && eHp > 0 && turn < 30) {
    turn++;
    const order = playerFirst ? ["player", "enemy"] : ["enemy", "player"];
    for (const actor of order) {
      if (pHp <= 0 || eHp <= 0) break;
      if (actor === "player") {
        let dmg = Math.max(2, pAtk - enemy.def + Math.floor(Math.random() * 5));
        if (specialUsed && turn === 1) {
          dmg = Math.round(dmg * 1.8);
          log.push({ side: "player", text: `Your familiar unleashes a surge! ${dmg} damage!` });
        } else {
          log.push({ side: "player", text: `You strike for ${dmg} damage.` });
        }
        eHp -= dmg;
      } else {
        const dmg = Math.max(1, enemy.atk - playerStats.def + Math.floor(Math.random() * 4));
        log.push({ side: "enemy", text: `${enemy.name} hits you for ${dmg} damage.` });
        pHp -= dmg;
      }
    }
  }

  const won = eHp <= 0 && pHp > 0;
  log.push({ side: "system", text: won ? `Victory! ${enemy.name} has been defeated.` : `Defeat... you retreat to recover.` });
  return { won, log, remainingHp: Math.max(0, pHp) };
}

/* ============================== Greeting ============================== */

function getGreeting(now = new Date()) {
  const h = now.getHours();
  if (h < 5) return { lead: "Still awake,", sub: "The sanctum is yours alone." };
  if (h < 12) return { lead: "Good morning,", sub: "The day is fresh and awaiting your will." };
  if (h < 17) return { lead: "Good afternoon,", sub: "Stay the course — great works take time." };
  if (h < 22) return { lead: "Good evening,", sub: "The candle burns bright in the study." };
  return { lead: "The hour grows late,", sub: "Rest beckons, but there's still time." };
}

/** "Friday, 16 October" */
function formatLongDate(d = new Date()) {
  return `${d.toLocaleDateString("en-GB", { weekday: "long" })}, ${d.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}`;
}

/** Re-renders every `ms` so clocks and timers stay current. */
function useNow(ms = 1000, enabled = true) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms, enabled]);
  return now;
}

/** Current streak (consecutive days up to today or yesterday) for every ritual. */
function habitStreaks(state: any): Record<number, number> {
  const byHabit: Record<number, Set<string>> = {};
  for (const c of state.habitCompletions as HabitCompletion[]) (byHabit[c.habitId] ??= new Set()).add(c.date);
  const out: Record<number, number> = {};
  const today = todayStr();
  for (const h of state.habits as Habit[]) {
    const dates = byHabit[h.id] ?? new Set<string>();
    const d = new Date();
    if (!dates.has(today)) d.setDate(d.getDate() - 1);
    let n = 0;
    while (n < 3650 && dates.has(d.toISOString().split("T")[0])) { n++; d.setDate(d.getDate() - 1); }
    out[h.id] = n;
  }
  return out;
}

/** Focus minutes for each day of this week, Monday first. */
function focusThisWeek(state: any) {
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, () => 0);
  for (const s of state.focusSessions as FocusSession[]) {
    const t = new Date(s.startedAt);
    const idx = Math.floor((t.getTime() - monday.getTime()) / 86_400_000);
    if (idx >= 0 && idx < 7) days[idx] += s.durationMinutes;
  }
  return { days, todayIdx: (now.getDay() + 6) % 7 };
}

/* ============================== Ember, the familiar ============================== */

type DragonPose = "idle" | "reading" | "questing" | "focusing" | "tending" | "sleeping" | "cheer" | "petted";

const DRAGON_FLAVOR: Record<DragonPose, string[]> = {
  idle: ["watching the candlelight", "curled on a warm stone", "tail flicking idly"],
  reading: ["nose in a spellbook", "scanning old runes", "humming over the grimoire"],
  questing: ["sharpening its claws", "eyeing the quest board", "pacing with anticipation"],
  focusing: ["perched in silent vigil", "eyes half-closed, focused", "matching your breathing"],
  tending: ["sniffing a vial of water", "stretching its wings", "counting your steps"],
  sleeping: ["dozing through the fast", "snoring tiny puffs of smoke", "dreaming of feasts to come"],
  cheer: ["delighted!", "doing a little spin", "very proud of you"],
  petted: ["nuzzling your hand", "purring softly", "leaning into the pets"],
};

const PET_MESSAGES = [
  "You're doing great, you know that?",
  "One step at a time. I believe in you.",
  "Proud of you today.",
  "Rest is productive too.",
  "Small wins still count.",
  "I'll be right here.",
  "You've got this.",
];

const FAMILIAR_COLORS = ["#a855f7", "#f59e0b", "#34d399", "#60a5fa", "#f472b6", "#ef4444", "#94a3b8", "#22d3ee"];

function useDragonFlavor(pose: DragonPose) {
  const [line, setLine] = useState(() => DRAGON_FLAVOR[pose][0]);
  useEffect(() => {
    const options = DRAGON_FLAVOR[pose];
    setLine(options[Math.floor(Math.random() * options.length)]);
  }, [pose]);
  return line;
}

/** Mixes a hex colour toward white (lighten > 0) or black (lighten < 0). */
function hslShade(hex: string, lighten: number) {
  const num = parseInt(hex.replace("#", ""), 16);
  let r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
  const mix = (c: number) => Math.max(0, Math.min(255, Math.round(c + (lighten > 0 ? (255 - c) * lighten : c * lighten))));
  r = mix(r); g = mix(g); b = mix(b);
  return `rgb(${r}, ${g}, ${b})`;
}

function hexHue(hex: string): { hue: number; sat: number } {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = ((num >> 16) & 255) / 255, g = ((num >> 8) & 255) / 255, b = (num & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return { hue: 0, sat: 0 };
  const l = (max + min) / 2;
  const sat = d / (1 - Math.abs(2 * l - 1));
  let hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hue = (hue * 60 + 360) % 360;
  return { hue, sat };
}

/**
 * Ember, drawn in the redesign's style. `color` is the familiar's chosen colour;
 * horns, belly and spines use the theme accent unless that is too close to the
 * body colour, when they use a pale tint instead. `pose` changes the eye and extras.
 */
function DragonSprite({ pose, size = 56, bounce = false, color = "#a855f7", accentHue = 37, onPet, petLabel }: {
  pose: DragonPose; size?: number; bounce?: boolean; color?: string; accentHue?: number; onPet?: () => void; petLabel?: string;
}) {
  const { hue, sat } = hexHue(color);
  const hueGap = Math.min(Math.abs(hue - accentHue), 360 - Math.abs(hue - accentHue));
  const trim = sat > 0.25 && hueGap < 40 ? hslShade(color, 0.6) : "hsl(var(--ui-accent))";
  const wingBack = hslShade(color, -0.55);
  const tail = hslShade(color, -0.42);
  const body = hslShade(color, -0.25);
  const head = hslShade(color, -0.12);
  const snout = hslShade(color, 0.02);
  const wingFront = hslShade(color, 0.18);
  const ink = hslShade(color, -0.75);
  const eyesClosed = pose === "sleeping" || pose === "focusing";
  const happy = pose === "petted" || pose === "cheer";
  const tilt = pose === "reading" ? -6 : pose === "questing" ? 5 : pose === "petted" ? -4 : 0;
  const motion = bounce ? "dragon-bounce" : pose === "idle" ? "dragon-float" : pose === "focusing" || pose === "sleeping" ? "dragon-breathe" : "";

  const art = (
    <svg viewBox="0 0 200 200" width={size} height={size} aria-hidden="true"
      style={{ transform: `rotate(${tilt}deg)`, transition: "transform 0.4s ease", overflow: "visible" }}>
      <path d="M96 104 C 82 70, 70 52, 52 44 C 60 62, 58 74, 66 86 C 56 84, 50 92, 46 100 C 60 98, 72 104, 84 116 Z" style={{ fill: wingBack }} />
      <path d="M78 168 C 48 176, 26 160, 32 140 C 36 128, 50 126, 56 134 C 48 132, 42 140, 46 148 C 52 160, 70 160, 84 154 Z" style={{ fill: tail }} />
      <path d="M33 141 L 20 128 L 39 131 Z" style={{ fill: trim }} />
      <path d="M70 170 C 62 132, 78 104, 108 102 C 138 100, 152 128, 146 170 Z" style={{ fill: body }} />
      <path d="M92 170 C 88 144, 98 122, 114 120 C 130 120, 136 144, 132 170 Z" style={{ fill: trim, opacity: 0.92 }} />
      <path d="M97 138 Q 114 144 131 138 M95 150 Q 114 156 133 150 M94 162 Q 114 168 134 162" style={{ fill: "none", stroke: "rgba(0,0,0,0.18)", strokeWidth: 2 }} />
      <g className={pose === "cheer" ? "dragon-wing-flap" : undefined}>
        <path d="M84 118 C 72 88, 74 62, 92 46 C 94 64, 100 72, 110 78 C 100 82, 98 92, 102 100 C 94 104, 88 110, 84 118 Z" style={{ fill: wingFront }} />
        <path d="M90 50 C 90 70, 94 86, 86 112 M99 76 C 96 88, 92 98, 88 110" style={{ fill: "none", stroke: tail, strokeWidth: 2 }} />
      </g>
      <ellipse cx="102" cy="171" rx="12" ry="6" style={{ fill: wingBack }} />
      <ellipse cx="132" cy="171" rx="12" ry="6" style={{ fill: wingBack }} />
      <path d="M112 108 C 112 92, 118 82, 128 76 L 146 86 C 140 94, 136 104, 134 116 Z" style={{ fill: body }} />
      <path d="M100 104 L 104 93 L 110 103 Z M88 114 L 90 103 L 97 112 Z" style={{ fill: trim }} />
      <path d="M114 70 C 114 50, 132 40, 150 44 C 166 48, 182 58, 182 72 C 182 84, 170 90, 156 90 C 136 92, 114 88, 114 70 Z" style={{ fill: head }} />
      <path d="M156 64 C 168 64, 182 66, 182 74 C 182 84, 170 88, 158 86 Z" style={{ fill: snout }} />
      <path d="M124 54 C 116 40, 110 30, 98 26 C 108 36, 112 46, 118 60 Z" style={{ fill: trim }} />
      <path d="M138 47 C 134 32, 128 22, 118 16 C 126 28, 128 38, 130 50 Z" style={{ fill: trim, opacity: 0.8 }} />
      <path d="M118 74 L 102 70 L 116 84 Z" style={{ fill: tail }} />
      {eyesClosed ? (
        <path d="M140 67 Q 149 72 158 67" style={{ fill: "none", stroke: ink, strokeWidth: 2.6, strokeLinecap: "round" }} />
      ) : happy ? (
        <path d="M140 69 Q 149 60 158 69" style={{ fill: "none", stroke: ink, strokeWidth: 2.6, strokeLinecap: "round" }} />
      ) : (
        <>
          <path d="M140 66 C 144 60, 154 60, 158 66 C 154 72, 144 72, 140 66 Z" style={{ fill: "#fff6dc" }} />
          <ellipse cx="149" cy="66" rx="2.2" ry="5" style={{ fill: "#14102a" }} />
          <circle cx="151" cy="63" r="1.4" style={{ fill: "#ffffff" }} />
          <path d="M138 59 Q 148 53 160 58" style={{ fill: "none", stroke: wingBack, strokeWidth: 2.5, strokeLinecap: "round" }} />
        </>
      )}
      <circle cx="175" cy="70" r="1.8" style={{ fill: ink }} />
      <path d="M160 82 Q 170 85 178 80" style={{ fill: "none", stroke: ink, strokeWidth: 2, strokeLinecap: "round" }} />
      <ellipse cx="148" cy="78" rx="6" ry="3.5" style={{ fill: "#ff9ec4", opacity: happy ? 0.7 : 0.45 }} />
      {pose === "sleeping" && <text x="168" y="36" className="dragon-zzz" style={{ fill: "var(--sub)", fontSize: 26, fontFamily: "var(--font-display)" }}>z</text>}
      {pose === "cheer" && <text x="172" y="40" className="dragon-sparkle" style={{ fill: "hsl(var(--ui-accent))", fontSize: 26 }}>✦</text>}
      {pose === "petted" && <text x="170" y="40" className="dragon-sparkle" style={{ fill: "#ff8fb4", fontSize: 26 }}>♥</text>}
    </svg>
  );

  if (!onPet) return <div className={cx("select-none", motion)} style={{ width: size, height: size }}>{art}</div>;
  return (
    <button type="button" onClick={onPet} aria-label={petLabel ?? "Pet your familiar"} title={petLabel ?? "Pet your familiar"}
      className={cx("select-none rounded-full", motion)} style={{ width: size, height: size, padding: 0, border: 0, background: "transparent", cursor: "pointer" }}>
      {art}
    </button>
  );
}

/** Small companion in the corner of every page except the dashboard. */
function DragonCorner({ pose, bounce, familiar, onPet, accentHue }: { pose: DragonPose; bounce: boolean; familiar: Familiar; onPet: () => void; accentHue: number }) {
  const line = useDragonFlavor(pose);
  return (
    <div className="fixed bottom-4 right-4 z-30 flex items-end gap-2">
      <div className="hidden sm:block popover px-3 py-2 mb-1 pointer-events-none" style={{ fontSize: 12, color: "var(--text-3)", borderRadius: 12 }}>
        <span style={{ color: "var(--text)", fontWeight: 600 }}>{familiar.name}</span> · {line}
      </div>
      <div className="popover flex items-center justify-center" style={{ width: 64, height: 64, borderRadius: "50%" }}>
        <DragonSprite pose={pose} size={52} bounce={bounce} color={familiar.color} accentHue={accentHue} onPet={onPet} petLabel={`Pet ${familiar.name}`} />
      </div>
    </div>
  );
}

/* ============================== Dashboard ============================== */

type NavFn = (page: string) => void;
type StartFocusFn = (minutes: number) => void;

function DashboardPage({ state, setState, dragonPose, dragonBounce, onPetFamiliar, onNavigate, onStartFocus, accentHue }: {
  state: any; setState: any; dragonPose: DragonPose; dragonBounce: boolean; onPetFamiliar: () => void;
  onNavigate: NavFn; onStartFocus: StartFocusFn; accentHue: number;
}) {
  useNow(60_000); // keeps the greeting and date current
  const summary = computeSummary(state);
  const { lead, sub } = getGreeting();
  const quick = usePopover();
  const [quickText, setQuickText] = useState("");

  const addQuickQuest = () => {
    const title = quickText.trim();
    if (!title) return;
    const task: Task = { id: nextId(), title, status: "todo", priority: "medium" };
    setState((s: any) => ({ ...s, tasks: [...s.tasks, task] }));
    setQuickText("");
    quick.setOpen(false);
  };

  return (
    <div className="flex flex-col gap-[18px] animate-in">
      <header className="flex flex-wrap items-end justify-between gap-5 px-2 pt-3">
        <div className="min-w-0">
          <div className="eyebrow" style={{ fontSize: 13, letterSpacing: "0.14em" }}>{formatLongDate()}</div>
          <h1 className="display mt-2.5" style={{ fontSize: "clamp(44px, 6vw, 66px)" }}>{lead} <em>scholar.</em></h1>
          <p className="sub mt-3" style={{ fontSize: 16 }}>{sub}</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <div className="relative" ref={quick.ref}>
            <Btn variant="glass" icon={<Plus className="w-4 h-4" />} aria-expanded={quick.open} onClick={() => quick.setOpen(!quick.open)}>Quick add</Btn>
            {quick.open && (
              <div className="popover absolute right-0 z-40 mt-2 p-3" style={{ width: 300 }}>
                <label htmlFor="quick-quest" className="field-label">New quest</label>
                <div className="flex gap-2">
                  <input id="quick-quest" autoFocus className="field" placeholder="What needs doing?" value={quickText}
                    onChange={(e) => setQuickText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addQuickQuest()} />
                  <Btn variant="primary" icon={<Plus className="w-4 h-4" />} aria-label="Add quest" onClick={addQuickQuest} disabled={!quickText.trim()} />
                </div>
                <p className="label mt-2 mb-0" style={{ fontSize: 12 }}>Added to Quests as medium priority.</p>
              </div>
            )}
          </div>
          <Btn variant="primary" icon={<Play className="w-3.5 h-3.5" fill="currentColor" />} onClick={() => onStartFocus(25)}>Start focus</Btn>
        </div>
      </header>

      <div className="flex flex-wrap gap-[18px]">
        <LevelCard summary={summary} />
        <FamiliarCard pose={dragonPose} bounce={dragonBounce} familiar={state.familiar} setState={setState} onPet={onPetFamiliar} accentHue={accentHue} />
      </div>

      <StatTiles state={state} summary={summary} />

      <DashboardWidgetGrid state={state} setState={setState} onNavigate={onNavigate} onStartFocus={onStartFocus} />
    </div>
  );
}

function LevelCard({ summary }: { summary: ReturnType<typeof computeSummary> }) {
  const into = summary.xp % 100;
  return (
    <section aria-label="Level and experience" className="glass flex flex-wrap items-center justify-center sm:justify-start gap-x-[34px] gap-y-5"
      style={{ flex: "2 1 480px", minHeight: 272, padding: "26px 30px" }}>
      <Ring pct={into / 100} size={200} stroke={12}>
        <div className="eyebrow" style={{ letterSpacing: "0.2em" }}>Level</div>
        <div className="display tnum" style={{ fontSize: 80, lineHeight: 0.95 }}>{summary.level}</div>
        <div className="sub" style={{ fontSize: 13, fontWeight: 600 }}>{into}%</div>
      </Ring>
      <div className="min-w-0 flex-1" style={{ minWidth: 220 }}>
        <span className="chip chip-round" style={{ fontSize: 13, padding: "6px 12px", border: "1px solid var(--edge)" }}>
          <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: "hsl(var(--ui-accent))" }} />
          Archmage
        </span>
        <div className="display tnum mt-3.5" style={{ fontSize: 60 }}>
          {summary.xp.toLocaleString()} <span style={{ fontSize: 26, color: "var(--sub)" }}>XP</span>
        </div>
        <div className="sub mt-2" style={{ fontSize: 15 }}>{summary.xpToNextLevel} XP until Level {summary.level + 1}</div>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="chip">Ritual +10</span>
          <span className="chip">Quest +20</span>
          <span className="chip">Focus +½ per min</span>
        </div>
      </div>
    </section>
  );
}

function FamiliarCard({ pose, bounce, familiar, setState, onPet, accentHue }: {
  pose: DragonPose; bounce: boolean; familiar: Familiar; setState: any; onPet: () => void; accentHue: number;
}) {
  const line = useDragonFlavor(pose);
  const [petMsg, setPetMsg] = useState<string | null>(null);
  const edit = usePopover();
  const [nameDraft, setNameDraft] = useState(familiar.name);
  const pets = familiar.affection ?? 0;
  const bond = pets === 0 ? 0 : (pets % 50 === 0 ? 50 : pets % 50);

  const pet = () => {
    onPet();
    if (Math.random() < 0.55) {
      setPetMsg(PET_MESSAGES[Math.floor(Math.random() * PET_MESSAGES.length)]);
      setTimeout(() => setPetMsg(null), 2800);
    }
  };
  const saveName = () => {
    const trimmed = nameDraft.trim();
    setState((s: any) => ({ ...s, familiar: { ...s.familiar, name: trimmed || s.familiar.name } }));
  };
  const setColor = (color: string) => setState((s: any) => ({ ...s, familiar: { ...s.familiar, color } }));

  return (
    <section aria-label="Your familiar" className="glass relative flex flex-col" style={{ flex: "1 1 300px", minHeight: 272, padding: "24px 24px 22px", zIndex: edit.open ? 30 : undefined }}>
      <div className="flex items-center gap-4">
        <div className="relative flex items-center justify-center shrink-0"
          style={{ width: 128, height: 128, borderRadius: "50%", background: "radial-gradient(circle at 50% 46%, hsl(var(--ui-accent2) / 0.5), hsl(var(--ui-accent2) / 0.08) 62%, hsl(var(--ui-accent2) / 0) 72%)" }}>
          <div aria-hidden="true" className="absolute" style={{ inset: 8, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.10)" }} />
          <DragonSprite pose={pose} size={112} bounce={bounce} color={familiar.color} accentHue={accentHue} onPet={pet} petLabel={`Pet ${familiar.name}`} />
        </div>
        <div className="min-w-0">
          <div className="eyebrow" style={{ letterSpacing: "0.18em" }}>Familiar</div>
          <div className="flex items-center gap-1.5">
            <div className="display truncate" style={{ fontSize: 42, lineHeight: 1.05 }}>{familiar.name}</div>
            <div className="relative" ref={edit.ref}>
              <Btn variant="quiet" size="sm" aria-label={`Rename or recolour ${familiar.name}`} aria-expanded={edit.open}
                icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => { setNameDraft(familiar.name); edit.setOpen(!edit.open); }} />
              {edit.open && (
                <div className="popover absolute left-0 z-40 mt-2 p-3" style={{ width: 248 }}>
                  <label htmlFor="familiar-name" className="field-label">Name</label>
                  <input id="familiar-name" className="field" maxLength={20} value={nameDraft} autoFocus
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { saveName(); edit.setOpen(false); } }} />
                  <div className="field-label mt-3">Colour</div>
                  <div className="flex flex-wrap gap-1.5">
                    {FAMILIAR_COLORS.map((c) => (
                      <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Colour ${c}`} aria-pressed={familiar.color === c}
                        className="rounded-full" style={{ width: 26, height: 26, background: c, border: familiar.color === c ? "2px solid #fff" : "2px solid transparent", boxShadow: familiar.color === c ? `0 0 8px ${c}` : "none" }} />
                    ))}
                  </div>
                  <Btn variant="primary" size="sm" wide className="mt-3" onClick={() => { saveName(); edit.setOpen(false); }}>Done</Btn>
                </div>
              )}
            </div>
          </div>
          <div className="sub" style={{ fontSize: 14 }} aria-live="polite">{petMsg ? `“${petMsg}”` : line.charAt(0).toUpperCase() + line.slice(1)}</div>
        </div>
      </div>
      <div className="mt-auto pt-4">
        <div className="flex justify-between sub" style={{ fontSize: 13 }}>
          <span>Affection</span>
          <span style={{ color: "#e4e6f1", fontWeight: 600 }}>{pets} {pets === 1 ? "pet" : "pets"}</span>
        </div>
        <div className="track mt-2" role="progressbar" aria-label="Affection toward the next bond" aria-valuemin={0} aria-valuemax={50} aria-valuenow={bond}>
          <div className="fill fill-2" style={{ width: `${(bond / 50) * 100}%` }} />
        </div>
        <Btn variant="glass" wide className="mt-3.5" onClick={pet}
          icon={<Heart className="w-[15px] h-[15px]" fill="#ff8fb4" stroke="none" />}>Pet {familiar.name}</Btn>
      </div>
    </section>
  );
}

function StatTiles({ state, summary }: { state: any; summary: ReturnType<typeof computeSummary> }) {
  const questsTotal = summary.tasksCompletedToday + summary.pendingTasks;
  const { days, todayIdx } = focusThisWeek(state);
  const maxDay = Math.max(1, ...days);
  const best = summary.currentStreaks[0];
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const weekLabel = days.slice(0, todayIdx + 1).map((m, i) => `${dayNames[i]} ${m}`).join(", ");

  return (
    <div className="flex flex-wrap gap-[18px]">
      <div className="tile" style={{ flex: "1 1 200px", minHeight: 132, padding: "20px 22px" }}>
        <div className="flex items-center justify-between">
          <span className="sub" style={{ fontSize: 13, fontWeight: 600 }}>Rituals</span>
          <Book className="w-[18px] h-[18px] label" strokeWidth={1.7} aria-hidden="true" />
        </div>
        <div className="display tnum mt-2.5" style={{ fontSize: 42 }}>{summary.habitsCompletedToday}<span className="muted">/{summary.totalHabits}</span></div>
        <div className="mt-3.5"><SegBars total={summary.totalHabits} done={summary.habitsCompletedToday} /></div>
      </div>
      <div className="tile" style={{ flex: "1 1 200px", minHeight: 132, padding: "20px 22px" }}>
        <div className="flex items-center justify-between">
          <span className="sub" style={{ fontSize: 13, fontWeight: 600 }}>Quests done</span>
          <CheckSquare className="w-[18px] h-[18px] label" strokeWidth={1.7} aria-hidden="true" />
        </div>
        <div className="display tnum mt-2.5" style={{ fontSize: 42 }}>{summary.tasksCompletedToday}<span className="muted">/{questsTotal}</span></div>
        <div className="mt-3.5"><SegBars total={questsTotal} done={summary.tasksCompletedToday} color="accent2" /></div>
      </div>
      <div className="tile flex flex-col" style={{ flex: "1 1 200px", minHeight: 132, padding: "20px 22px" }}>
        <div className="flex items-center justify-between">
          <span className="sub" style={{ fontSize: 13, fontWeight: 600 }}>Focus this week</span>
          <Timer className="w-[18px] h-[18px] label" strokeWidth={1.7} aria-hidden="true" />
        </div>
        <div className="mt-auto flex items-end justify-between gap-3 pt-2.5">
          <div className="display tnum" style={{ fontSize: 42 }}>{summary.totalFocusMinutesToday}<span style={{ fontSize: 22, color: "var(--sub)" }}>m today</span></div>
          <div role="img" aria-label={`Focus minutes this week: ${weekLabel}`} className="flex items-end gap-1" style={{ height: 34 }}>
            {days.map((m, i) => (
              <span key={i} style={{
                width: 6, borderRadius: 3,
                height: i > todayIdx ? 3 : Math.max(3, Math.round((m / maxDay) * 34)),
                background: i === todayIdx ? "hsl(var(--ui-accent))" : i > todayIdx ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.24)",
              }} />
            ))}
          </div>
        </div>
      </div>
      <div className="tile flex flex-col" style={{ flex: "1 1 200px", minHeight: 132, padding: "20px 22px" }}>
        <div className="flex items-center justify-between">
          <span className="sub" style={{ fontSize: 13, fontWeight: 600 }}>Longest streak</span>
          <FlameMark size={18} />
        </div>
        <div className="display tnum mt-2.5" style={{ fontSize: 42 }}>{best?.streak ?? 0}<span style={{ fontSize: 22, color: "var(--sub)" }}> {best?.streak === 1 ? "day" : "days"}</span></div>
        <div className="mt-auto sub truncate" style={{ fontSize: 13 }}>{best ? best.habitName : "Complete a ritual to start one"}</div>
      </div>
    </div>
  );
}

/* ============================== Dashboard widgets ============================== */

const WIDGET_REGISTRY: Record<WidgetId, { label: string; icon: any; color: string }> = {
  habits: { label: "Grimoire", icon: Book, color: "hsl(var(--ui-accent))" },
  tasks: { label: "Quests", icon: CheckSquare, color: "hsl(var(--ui-accent2))" },
  focus: { label: "Focus", icon: Timer, color: "#7cc8ff" },
  vitality: { label: "Vitality", icon: Activity, color: "#4fd1a1" },
  fast: { label: "Fast", icon: Moon, color: "hsl(var(--ui-accent))" },
  journal: { label: "Journal", icon: Pencil, color: "#f4c38a" },
  lofi: { label: "Lofi", icon: Music, color: "hsl(var(--ui-accent2))" },
};

function DashboardWidgetGrid({ state, setState, onNavigate, onStartFocus }: { state: any; setState: any; onNavigate: NavFn; onStartFocus: StartFocusFn }) {
  const widgets: WidgetId[] = state.dashboardWidgets ?? [];
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const add = usePopover();
  const available = (Object.keys(WIDGET_REGISTRY) as WidgetId[]).filter((id) => !widgets.includes(id));
  const notes = widgetNotes(state);

  const handleAdd = (id: WidgetId) => setState((s: any) => ({ ...s, dashboardWidgets: [...(s.dashboardWidgets ?? []), id] }));
  const handleRemove = (id: WidgetId) => setState((s: any) => ({ ...s, dashboardWidgets: (s.dashboardWidgets ?? []).filter((w: WidgetId) => w !== id) }));
  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= widgets.length) return;
    setState((s: any) => {
      const list = [...(s.dashboardWidgets ?? [])];
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved);
      return { ...s, dashboardWidgets: list };
    });
  };
  const handleDrop = () => {
    if (draggedIndex !== null && overIndex !== null) move(draggedIndex, overIndex);
    setDraggedIndex(null); setOverIndex(null);
  };

  return (
    <>
      <SectionHead id="widgets-heading" action={
        <div className="relative" ref={add.ref}>
          <Btn variant="glass" icon={<Plus className="w-[15px] h-[15px]" />} aria-expanded={add.open} disabled={available.length === 0}
            title={available.length === 0 ? "All widgets are on your dashboard" : undefined} onClick={() => add.setOpen(!add.open)}>Add widget</Btn>
          {add.open && available.length > 0 && (
            <div className="popover absolute right-0 z-40 mt-2 p-1.5 grid grid-cols-1 gap-0.5" style={{ width: 220 }}>
              {available.map((id) => {
                const meta = WIDGET_REGISTRY[id];
                const Icon = meta.icon;
                return (
                  <button key={id} type="button" onClick={() => { handleAdd(id); add.setOpen(false); }}
                    className="flex items-center gap-2.5 rounded-xl px-3 text-left hover:bg-white/5" style={{ minHeight: 44, fontSize: 14, color: "var(--text-2)" }}>
                    <Icon className="w-4 h-4" strokeWidth={1.8} style={{ color: meta.color }} /> {meta.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      }>Widgets</SectionHead>

      {widgets.length === 0 ? (
        <EmptyState>No widgets yet. Use Add widget to bring parts of Sanctum onto your dashboard.</EmptyState>
      ) : (
        <div className="flex flex-wrap gap-[18px]" aria-labelledby="widgets-heading">
          {widgets.map((id, index) => (
            <WidgetPanel key={id} id={id} index={index} count={widgets.length} note={notes[id]}
              dragging={draggedIndex === index} dropTarget={overIndex === index && draggedIndex !== null && draggedIndex !== index}
              onDragStart={() => setDraggedIndex(index)} onDragOver={() => setOverIndex(index)} onDrop={handleDrop}
              onDragEnd={() => { setDraggedIndex(null); setOverIndex(null); }}
              onMove={(dir) => move(index, index + dir)} onRemove={() => handleRemove(id)}>
              <WidgetBody id={id} state={state} setState={setState} onNavigate={onNavigate} onStartFocus={onStartFocus} />
            </WidgetPanel>
          ))}
        </div>
      )}
    </>
  );
}

/** A widget's glass panel: header, drag handle, move and remove controls. */
function WidgetPanel({ id, index, count, note, dragging, dropTarget, onDragStart, onDragOver, onDrop, onDragEnd, onMove, onRemove, children }: {
  id: WidgetId; index: number; count: number; note?: string; dragging: boolean; dropTarget: boolean;
  onDragStart: () => void; onDragOver: () => void; onDrop: () => void; onDragEnd: () => void;
  onMove: (dir: -1 | 1) => void; onRemove: () => void; children: ReactNode;
}) {
  const meta = WIDGET_REGISTRY[id];
  const Icon = meta.icon;
  const panelRef = useRef<HTMLElement>(null);
  return (
    <section ref={panelRef} aria-label={meta.label}
      onDragOver={(e) => { e.preventDefault(); onDragOver(); }} onDrop={(e) => { e.preventDefault(); onDrop(); }}
      className="glass widget flex flex-col"
      style={{ flex: "1 1 380px", height: 288, padding: "22px 24px", opacity: dragging ? 0.4 : 1, outline: dropTarget ? "2px dashed hsl(var(--ui-accent) / 0.6)" : undefined, outlineOffset: 4 }}>
      <div className="widget-head relative flex items-center gap-2.5 mb-2.5">
        <span aria-hidden="true" className="icon-tile"><Icon className="w-4 h-4" strokeWidth={1.8} style={{ color: meta.color }} /></span>
        <h3 className="m-0 truncate" style={{ fontSize: 16, fontWeight: 700, color: "#f0f1f8" }}>{meta.label}</h3>
        <span className="widget-note ml-auto sub shrink-0 truncate" style={{ fontSize: 13 }}>{note}</span>
        <div className="widget-tools absolute flex items-center gap-1" style={{ right: -8, top: "50%", transform: "translateY(-50%)" }}>
          <span draggable title="Drag to move" aria-hidden="true"
            onDragStart={(e) => { if (panelRef.current) e.dataTransfer.setDragImage(panelRef.current, 24, 24); e.dataTransfer.effectAllowed = "move"; onDragStart(); }}
            onDragEnd={onDragEnd}
            className="flex items-center justify-center rounded-lg hover:bg-white/5" style={{ width: 32, height: 32, cursor: "grab", color: "var(--label)" }}>
            <GripVertical className="w-4 h-4" />
          </span>
          <button type="button" className="sr-only focus:not-sr-only btn btn-glass btn-sm" onClick={() => onMove(-1)} disabled={index === 0}>Move earlier</button>
          <button type="button" className="sr-only focus:not-sr-only btn btn-glass btn-sm" onClick={() => onMove(1)} disabled={index === count - 1}>Move later</button>
          <button type="button" onClick={onRemove} aria-label={`Remove ${meta.label} widget`} title="Remove widget"
            className="flex items-center justify-center rounded-lg hover:bg-white/5" style={{ width: 32, height: 32, color: "var(--label)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </section>
  );
}

function WidgetBody({ id, state, setState, onNavigate, onStartFocus }: { id: WidgetId; state: any; setState: any; onNavigate: NavFn; onStartFocus: StartFocusFn }) {
  switch (id) {
    case "habits": return <HabitsWidget state={state} setState={setState} onNavigate={onNavigate} />;
    case "tasks": return <TasksWidget state={state} setState={setState} />;
    case "focus": return <FocusWidget onStartFocus={onStartFocus} />;
    case "vitality": return <VitalityWidget state={state} onNavigate={onNavigate} />;
    case "fast": return <FastWidget state={state} onNavigate={onNavigate} />;
    case "journal": return <JournalWidget state={state} setState={setState} />;
    case "lofi": return <LofiPlayer compact />;
    default: return null;
  }
}

/** Notes shown in each widget header ("2 of 3 today", "2 open", …). */
function widgetNotes(state: any): Partial<Record<WidgetId, string>> {
  const today = todayStr();
  const done = new Set(state.habitCompletions.filter((c: HabitCompletion) => c.date === today).map((c: HabitCompletion) => c.habitId));
  const open = state.tasks.filter((t: Task) => t.status !== "done").length;
  const fast = state.fastSessions.find((f: FastSession) => f.status === "active");
  return {
    habits: state.habits.length ? `${done.size} of ${state.habits.length} today` : undefined,
    tasks: `${open} open`,
    focus: "Deep work",
    vitality: "Today",
    fast: fast ? `${fast.protocol} · ${fast.targetHours}h` : "Not fasting",
    journal: "Saves as you type",
    lofi: "Live",
  };
}

function HabitsWidget({ state, setState, onNavigate }: { state: any; setState: any; onNavigate: NavFn }) {
  const today = todayStr();
  const doneToday = new Set(state.habitCompletions.filter((c: HabitCompletion) => c.date === today).map((c: HabitCompletion) => c.habitId));
  const streaks = habitStreaks(state);
  const toggle = (id: number, done: boolean) => setState((s: any) => ({
    ...s,
    habitCompletions: done
      ? s.habitCompletions.filter((c: HabitCompletion) => !(c.habitId === id && c.date === today))
      : [...s.habitCompletions, { habitId: id, date: today }],
  }));
  if (state.habits.length === 0) {
    return <EmptyState action={<Btn size="sm" onClick={() => onNavigate("habits")}>Open the Grimoire</Btn>}>No rituals yet.</EmptyState>;
  }
  return (
    <div className="scroll-y -mx-1 px-1 flex-1">
      {state.habits.map((h: Habit, i: number) => {
        const done = doneToday.has(h.id);
        return (
          <button key={h.id} type="button" aria-pressed={done} onClick={() => toggle(h.id, done)}
            className={cx("row-btn", i < state.habits.length - 1 && "divider")} style={{ color: done ? "var(--sub)" : "var(--text)", fontWeight: done ? 400 : 500 }}>
            <span aria-hidden="true" className={cx("check", done && "is-on")}>{done && <Check className="w-3.5 h-3.5" strokeWidth={3.2} />}</span>
            <span className="truncate" style={{ textDecoration: done ? "line-through" : undefined }}>{h.name}</span>
            <span className="chip chip-round ml-auto" aria-label={`${streaks[h.id] ?? 0} day streak`}><FlameMark size={12} />{streaks[h.id] ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
}

const PRIORITY_LOOK: Record<string, { bar: string; bg: string; text: string; label: string }> = {
  high: { bar: "#ff8a7a", bg: "rgba(255,138,122,0.12)", text: "#ffb3a8", label: "High" },
  medium: { bar: "#f2c46b", bg: "rgba(242,196,107,0.12)", text: "#f6d697", label: "Medium" },
  low: { bar: "#7cc8ff", bg: "rgba(124,200,255,0.12)", text: "#b3e0ff", label: "Low" },
};
const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

function TasksWidget({ state, setState }: { state: any; setState: any }) {
  const [draft, setDraft] = useState("");
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const open = state.tasks.filter((t: Task) => t.status !== "done").sort((a: Task, b: Task) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  const doneToday = state.tasks.filter((t: Task) => t.status === "done" && t.completedAt && new Date(t.completedAt) >= todayStart);
  const rows = [...open, ...doneToday];
  const toggle = (id: number) => setState((s: any) => ({
    ...s,
    tasks: s.tasks.map((t: Task) => t.id !== id ? t : t.status === "done"
      ? { ...t, status: "todo", completedAt: undefined }
      : { ...t, status: "done", completedAt: new Date().toISOString() }),
  }));
  const add = () => {
    const title = draft.trim();
    if (!title) return;
    setState((s: any) => ({ ...s, tasks: [...s.tasks, { id: nextId(), title, status: "todo", priority: "medium" } as Task] }));
    setDraft("");
  };
  return (
    <>
      <div className="scroll-y -mx-1 px-1 flex-1 min-h-0">
        {rows.length === 0 && <p className="sub m-0 py-4 text-center" style={{ fontSize: 14 }}>No quests yet. The realm is at peace.</p>}
        {rows.map((t: Task, i: number) => {
          const isDone = t.status === "done";
          const look = PRIORITY_LOOK[t.priority] ?? PRIORITY_LOOK.medium;
          return (
            <button key={t.id} type="button" aria-pressed={isDone} onClick={() => toggle(t.id)}
              title={isDone ? "Mark as not done" : "Mark as done"}
              className={cx("row-btn", i < rows.length - 1 && "divider")} style={{ minHeight: 52, gap: 12 }}>
              <span aria-hidden="true" style={{ width: 4, height: 26, borderRadius: 4, flexShrink: 0, background: isDone ? "rgba(255,255,255,0.18)" : look.bar }} />
              <span className="flex-1 min-w-0 truncate" style={{ fontSize: 15, fontWeight: isDone ? 400 : 500, color: isDone ? "var(--label)" : "#f0f1f8", textDecoration: isDone ? "line-through" : undefined }}>{t.title}</span>
              {isDone
                ? <span className="chip" style={{ borderColor: "transparent", color: "var(--sub)" }}>Done</span>
                : <span className="chip" style={{ borderColor: "transparent", background: look.bg, color: look.text }}>{look.label}{t.category ? ` · ${t.category}` : ""}</span>}
            </button>
          );
        })}
      </div>
      <div className="well mt-2.5 flex items-center gap-2" style={{ padding: "0 6px 0 14px", borderRadius: 13 }}>
        <label htmlFor="widget-quick-quest" className="sr-only-x">Add a quest</label>
        <Plus className="w-[15px] h-[15px] shrink-0 label" aria-hidden="true" />
        <input id="widget-quick-quest" className="flex-1 min-w-0 bg-transparent outline-none" style={{ minHeight: 44, fontSize: 14, color: "#f0f1f8", border: 0 }}
          placeholder="Add a quest…" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <span aria-hidden="true" style={{ padding: "3px 7px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.12)", fontSize: 11, fontWeight: 600, color: "var(--sub)" }}>Enter</span>
      </div>
    </>
  );
}

const WIDGET_FOCUS_PRESETS = [15, 25, 45, 60];

function FocusWidget({ onStartFocus }: { onStartFocus: StartFocusFn }) {
  const [minutes, setMinutes] = useState(25);
  return (
    <>
      <div className="flex-1 flex items-center justify-center">
        <div className="display tnum" style={{ fontSize: "clamp(64px, 9vw, 96px)", letterSpacing: "-0.02em" }}>{String(minutes).padStart(2, "0")}:00</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {WIDGET_FOCUS_PRESETS.map((m) => (
          <button key={m} type="button" className="seg" aria-pressed={minutes === m} aria-label={`${m} minutes`} onClick={() => setMinutes(m)}>{m}</button>
        ))}
        <Btn variant="primary" className="ml-auto" style={{ padding: "0 22px" }} icon={<Play className="w-3.5 h-3.5" fill="currentColor" />} onClick={() => onStartFocus(minutes)}>Begin</Btn>
      </div>
    </>
  );
}

function VitalityWidget({ state, onNavigate }: { state: any; onNavigate: NavFn }) {
  const today = todayStr();
  const latest: Record<string, number> = {};
  for (const log of state.healthLogs as HealthLog[]) if (log.loggedAt.split("T")[0] === today) latest[log.type] = log.value;
  return (
    <div className="flex-1 grid grid-cols-5 gap-2 content-center">
      {METRICS.map((m) => {
        const Icon = m.icon;
        const val = latest[m.key];
        return (
          <button key={m.key} type="button" onClick={() => onNavigate("health")} title={`Log ${m.label.toLowerCase()} on the Vitality page`}
            className="well flex flex-col items-center justify-center gap-1.5 px-1 hover:bg-white/5 transition-colors" style={{ borderRadius: 16, height: 150 }}>
            <Icon className="w-[18px] h-[18px]" strokeWidth={1.7} style={{ color: m.color }} aria-hidden="true" />
            <span className="display tnum" style={{ fontSize: 28 }}>{val !== undefined ? formatValue(m.key, val) : "–"}</span>
            <span className="label" style={{ fontSize: 11, fontWeight: 600 }}>{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function FastWidget({ state, onNavigate }: { state: any; onNavigate: NavFn }) {
  const current = state.fastSessions.find((f: FastSession) => f.status === "active");
  const now = useNow(1000, !!current);
  if (!current) {
    return <EmptyState icon={<Moon className="w-6 h-6" strokeWidth={1.6} />} action={<Btn size="sm" onClick={() => onNavigate("fast")}>Start a fast</Btn>}>No fast running.</EmptyState>;
  }
  const elapsed = now - new Date(current.startedAt).getTime();
  const pct = elapsed / (current.targetHours * 3_600_000);
  return (
    <div className="flex-1 flex items-center gap-6">
      <Ring pct={pct} size={150} stroke={10} dotted={false} color={pct >= 1 ? "#4fd1a1" : "hsl(var(--ui-accent))"}>
        <div className="display tnum" style={{ fontSize: 34 }}>{formatHours(elapsed)}h</div>
        <div className="sub" style={{ fontSize: 12, fontWeight: 600 }}>{Math.min(100, Math.round(pct * 100))}%</div>
      </Ring>
      <div className="min-w-0">
        <div style={{ fontSize: 16, fontWeight: 700 }}>{pct >= 1 ? "Goal reached" : "Fasting"}</div>
        <div className="sub mt-1" style={{ fontSize: 14 }}>{formatHours(Math.max(0, current.targetHours * 3_600_000 - elapsed))}h to go of {current.targetHours}h</div>
        <Btn size="sm" className="mt-3" onClick={() => onNavigate("fast")}>Open Fast</Btn>
      </div>
    </div>
  );
}

/** Saves today's journal entry (and mirrors the mood into Vitality, like the Journal page). */
function useTodayJournal(state: any, setState: any) {
  const today = todayStr();
  const entry: JournalEntry | undefined = state.journalEntries.find((e: JournalEntry) => e.date === today);
  const save = useCallback((text: string, mood: number | null, moodChanged: boolean) => {
    setState((s: any) => {
      const existing = s.journalEntries.find((e: JournalEntry) => e.date === today);
      const next: JournalEntry = { id: existing?.id ?? nextId(), date: today, text, mood, updatedAt: new Date().toISOString() };
      const journalEntries = existing ? s.journalEntries.map((e: JournalEntry) => (e.date === today ? next : e)) : [...s.journalEntries, next];
      const healthLogs = moodChanged && mood !== null
        ? [...s.healthLogs, { id: nextId(), type: "mood", value: mood, unit: "mood", loggedAt: new Date().toISOString() } as HealthLog]
        : s.healthLogs;
      return { ...s, journalEntries, healthLogs };
    });
  }, [setState, today]);
  return { today, entry, save };
}

function JournalWidget({ state, setState }: { state: any; setState: any }) {
  const { entry, save } = useTodayJournal(state, setState);
  const [text, setText] = useState(entry?.text ?? "");
  const [mood, setMood] = useState<number | null>(entry?.mood ?? null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onText = (val: string) => {
    setText(val);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(val, mood, false), 900);
  };
  const onMood = (val: number) => {
    const next = mood === val ? null : val;
    setMood(next);
    save(text, next, true);
  };
  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2.5">
      <div className="flex items-center gap-1">
        <span className="sub mr-auto" style={{ fontSize: 13 }}>Mood</span>
        <MoodPicker value={mood} onChange={onMood} />
      </div>
      <label htmlFor="widget-journal" className="sr-only-x">Today's journal entry</label>
      <textarea id="widget-journal" className="field flex-1 min-h-0" placeholder={`What's on your mind ${new Date().getHours() >= 17 ? "tonight" : "today"}?`}
        value={text} onChange={(e) => onText(e.target.value)} />
    </div>
  );
}

/* ============================== Grimoire (rituals) ============================== */

const ICON_MAP: Record<string, any> = {
  brain: Brain, droplets: Droplets, "book-open": BookOpen, dumbbell: Dumbbell,
  pencil: Pencil, star: Star, heart: Heart, zap: Zap, sun: Sun, moon: Moon,
  coffee: Coffee, music: Music, leaf: Leaf,
};
function HabitIcon({ icon, color }: { icon?: string; color?: string }) {
  const c = color || "#f59e0b";
  const LucideIcon = (icon && ICON_MAP[icon]) || Star;
  return (
    <span aria-hidden="true" className="flex items-center justify-center shrink-0"
      style={{ width: 40, height: 40, borderRadius: 12, background: `${c}1f`, border: `1px solid ${c}33` }}>
      <LucideIcon className="w-[18px] h-[18px]" strokeWidth={1.8} style={{ color: c }} />
    </span>
  );
}
const HABIT_COLORS = ["#c084fc", "#60a5fa", "#f59e0b", "#34d399", "#f472b6", "#fb923c", "#a78bfa"];
const FREQUENCIES = ["daily", "weekly"] as const;

function HabitsPage({ state, setState }: { state: any; setState: any }) {
  const today = todayStr();
  const completedToday = new Set(state.habitCompletions.filter((c: HabitCompletion) => c.date === today).map((c: HabitCompletion) => c.habitId));
  const streaks = habitStreaks(state);
  const best = Math.max(0, ...Object.values(streaks));

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", frequency: "daily" as "daily" | "weekly", color: HABIT_COLORS[0] });
  const [formError, setFormError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const handleComplete = (id: number) => setState((s: any) => ({ ...s, habitCompletions: [...s.habitCompletions, { habitId: id, date: today }] }));
  const handleUndo = (id: number) => setState((s: any) => ({
    ...s, habitCompletions: s.habitCompletions.filter((c: HabitCompletion) => !(c.habitId === id && c.date === today)),
  }));
  const handleCreate = () => {
    if (!form.name.trim()) { setFormError("Give the ritual a name."); return; }
    const newHabit: Habit = { id: nextId(), name: form.name.trim(), description: form.description || undefined, frequency: form.frequency, color: form.color, icon: "star" };
    setState((s: any) => ({ ...s, habits: [...s.habits, newHabit] }));
    setShowForm(false);
    setForm({ name: "", description: "", frequency: "daily", color: HABIT_COLORS[0] });
    setFormError("");
  };
  const handleDelete = (id: number) => {
    setState((s: any) => ({ ...s, habits: s.habits.filter((h: Habit) => h.id !== id), habitCompletions: s.habitCompletions.filter((c: HabitCompletion) => c.habitId !== id) }));
    setConfirmDelete(null);
  };

  return (
    <div className="flex flex-col gap-[18px] animate-in">
      <PageHeader eyebrow="Study" title="Grimoire" sub="Your daily rituals and sacred spells."
        actions={<Btn variant={showForm ? "glass" : "primary"} icon={showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "New ritual"}</Btn>} />

      <div className="flex flex-wrap gap-[18px]">
        <div className="tile" style={{ flex: "1 1 200px", padding: "20px 22px" }}>
          <div className="sub" style={{ fontSize: 13, fontWeight: 600 }}>Today</div>
          <div className="display tnum mt-2.5" style={{ fontSize: 42 }}>{completedToday.size}<span className="muted">/{state.habits.length}</span></div>
          <div className="mt-3.5"><SegBars total={state.habits.length} done={completedToday.size} /></div>
        </div>
        <div className="tile" style={{ flex: "1 1 200px", padding: "20px 22px" }}>
          <div className="flex items-center justify-between"><span className="sub" style={{ fontSize: 13, fontWeight: 600 }}>Longest streak</span><FlameMark size={18} /></div>
          <div className="display tnum mt-2.5" style={{ fontSize: 42 }}>{best}<span style={{ fontSize: 22, color: "var(--sub)" }}> {best === 1 ? "day" : "days"}</span></div>
        </div>
        <div className="tile" style={{ flex: "1 1 200px", padding: "20px 22px" }}>
          <div className="sub" style={{ fontSize: 13, fontWeight: 600 }}>Rituals kept, all time</div>
          <div className="display tnum mt-2.5" style={{ fontSize: 42 }}>{state.habitCompletions.length}</div>
        </div>
      </div>

      {showForm && (
        <section aria-label="New ritual" className="glass" style={{ padding: "24px 26px" }}>
          <PanelHead icon={<Plus className="w-4 h-4" style={{ color: "hsl(var(--ui-accent))" }} />} title="Scribe a new ritual" />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ritual-name" className="field-label">Name</label>
              <input id="ritual-name" className="field" autoFocus placeholder="Morning meditation" value={form.name}
                onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setFormError(""); }} onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
            </div>
            <div>
              <label htmlFor="ritual-desc" className="field-label">Description <span className="label">(optional)</span></label>
              <input id="ritual-desc" className="field" placeholder="10 minutes of stillness" value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <div className="field-label">How often</div>
              <div className="flex gap-2">
                {FREQUENCIES.map((freq) => (
                  <button key={freq} type="button" className="seg capitalize" aria-pressed={form.frequency === freq} onClick={() => setForm((f) => ({ ...f, frequency: freq }))}>{freq}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="field-label">Colour</div>
              <div className="flex flex-wrap items-center gap-2" style={{ minHeight: 44 }}>
                {HABIT_COLORS.map((color) => (
                  <button key={color} type="button" aria-label={`Colour ${color}`} aria-pressed={form.color === color} onClick={() => setForm((f) => ({ ...f, color }))}
                    className="rounded-full" style={{ width: 28, height: 28, background: color, border: form.color === color ? "2px solid #fff" : "2px solid transparent", boxShadow: form.color === color ? `0 0 10px ${color}` : "none" }} />
                ))}
              </div>
            </div>
          </div>
          {formError && <p className="mt-3 mb-0" style={{ color: "#ffb3a8", fontSize: 14 }} role="alert">{formError}</p>}
          <div className="mt-5 flex justify-end gap-2.5">
            <Btn variant="quiet" onClick={() => setShowForm(false)}>Cancel</Btn>
            <Btn variant="primary" icon={<Plus className="w-4 h-4" />} onClick={handleCreate}>Add ritual</Btn>
          </div>
        </section>
      )}

      {state.habits.length === 0 ? (
        <EmptyState icon={<Book className="w-7 h-7" strokeWidth={1.5} />} action={<Btn variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setShowForm(true)}>Add a ritual</Btn>}>
          Your grimoire is empty. Scribe your first ritual.
        </EmptyState>
      ) : (
        <section aria-label="Rituals" className="glass" style={{ padding: "8px 24px" }}>
          {state.habits.map((habit: Habit, i: number) => {
            const done = completedToday.has(habit.id);
            const asking = confirmDelete === habit.id;
            return (
              <div key={habit.id} className={cx("flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5", i < state.habits.length - 1 && "divider")}>
                <button type="button" aria-pressed={done} aria-label={done ? `Undo ${habit.name} for today` : `Complete ${habit.name}`}
                  onClick={() => (done ? handleUndo(habit.id) : handleComplete(habit.id))} className="flex items-center justify-center rounded-full"
                  style={{ width: 44, height: 44, margin: "-10px", border: 0, background: "transparent", cursor: "pointer" }}>
                  <span aria-hidden="true" className={cx("check", done && "is-on")}>{done && <Check className="w-3.5 h-3.5" strokeWidth={3.2} />}</span>
                </button>
                <HabitIcon icon={habit.icon} color={habit.color} />
                <div className="flex-1 min-w-[140px]">
                  <div style={{ fontSize: 16, fontWeight: 600, color: done ? "var(--sub)" : "#f0f1f8", textDecoration: done ? "line-through" : undefined }}>{habit.name}</div>
                  <div className="sub" style={{ fontSize: 13 }}>
                    <span className="capitalize">{habit.frequency}</span>{habit.description ? ` · ${habit.description}` : ""}
                  </div>
                </div>
                <span className="chip chip-round" aria-label={`${streaks[habit.id] ?? 0} day streak`}><FlameMark size={12} />{streaks[habit.id] ?? 0}</span>
                {asking ? (
                  <div className="flex items-center gap-2">
                    <span className="sub" style={{ fontSize: 13 }}>Remove it and its history?</span>
                    <Btn variant="danger" size="sm" onClick={() => handleDelete(habit.id)}>Remove</Btn>
                    <Btn variant="quiet" size="sm" onClick={() => setConfirmDelete(null)}>Keep</Btn>
                  </div>
                ) : (
                  <Btn variant="quiet" size="sm" aria-label={`Delete ${habit.name}`} title="Delete ritual" icon={<Trash2 className="w-4 h-4" />} onClick={() => setConfirmDelete(habit.id)} />
                )}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

/* ============================== Quests (tasks) ============================== */

const PRIORITIES = ["low", "medium", "high"] as const;
type Priority = (typeof PRIORITIES)[number];

function TasksPage({ state, setState }: { state: any; setState: any }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", priority: "medium" as Priority, category: "" });
  const [formError, setFormError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [quick, setQuick] = useState("");

  const toggleTask = (id: number, currentStatus: string) => {
    const newStatus = currentStatus === "done" ? "todo" : "done";
    setState((s: any) => ({
      ...s,
      tasks: s.tasks.map((t: Task) => (t.id === id ? { ...t, status: newStatus, completedAt: newStatus === "done" ? new Date().toISOString() : undefined } : t)),
    }));
  };
  const addTask = (task: Omit<Task, "id" | "status">) => setState((s: any) => ({ ...s, tasks: [...s.tasks, { id: nextId(), status: "todo", ...task }] }));
  const handleCreate = () => {
    if (!form.title.trim()) { setFormError("Give the quest a title."); return; }
    addTask({ title: form.title.trim(), description: form.description || undefined, priority: form.priority, category: form.category || undefined });
    setShowForm(false);
    setForm({ title: "", description: "", priority: "medium", category: "" });
    setFormError("");
  };
  const handleQuick = () => {
    if (!quick.trim()) return;
    addTask({ title: quick.trim(), priority: "medium" });
    setQuick("");
  };
  const handleDelete = (id: number) => {
    setState((s: any) => ({ ...s, tasks: s.tasks.filter((t: Task) => t.id !== id) }));
    setConfirmDelete(null);
  };

  const todo = state.tasks.filter((t: Task) => t.status !== "done").sort((a: Task, b: Task) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  const done = state.tasks.filter((t: Task) => t.status === "done")
    .sort((a: Task, b: Task) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime());

  const rowProps = { onToggle: toggleTask, onDelete: handleDelete, confirmDelete, setConfirmDelete };

  return (
    <div className="flex flex-col gap-[18px] animate-in">
      <PageHeader eyebrow="Study" title="Quests" sub="Active endeavours and bounties."
        actions={<Btn variant={showForm ? "glass" : "primary"} icon={showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "New quest"}</Btn>} />

      {showForm && (
        <section aria-label="New quest" className="glass" style={{ padding: "24px 26px" }}>
          <PanelHead icon={<Plus className="w-4 h-4" style={{ color: "hsl(var(--ui-accent2))" }} />} title="Embark on a new quest" />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="quest-title" className="field-label">Title</label>
              <input id="quest-title" className="field" autoFocus placeholder="Reply to important emails" value={form.title}
                onChange={(e) => { setForm((f) => ({ ...f, title: e.target.value })); setFormError(""); }} onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
            </div>
            <div>
              <label htmlFor="quest-desc" className="field-label">Description <span className="label">(optional)</span></label>
              <input id="quest-desc" className="field" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label htmlFor="quest-cat" className="field-label">Category <span className="label">(optional)</span></label>
              <input id="quest-cat" className="field" placeholder="Work, Home, Learning…" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <div className="field-label">Priority</div>
              <div className="flex flex-wrap gap-2">
                {PRIORITIES.map((p) => {
                  const look = PRIORITY_LOOK[p];
                  const on = form.priority === p;
                  return (
                    <button key={p} type="button" className="seg" aria-pressed={on} onClick={() => setForm((f) => ({ ...f, priority: p }))}
                      style={on ? { background: look.bg, borderColor: look.bar, color: look.text } : undefined}>
                      <span aria-hidden="true" className="inline-block mr-2 align-middle" style={{ width: 8, height: 8, borderRadius: 2, background: look.bar }} />{look.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          {formError && <p className="mt-3 mb-0" style={{ color: "#ffb3a8", fontSize: 14 }} role="alert">{formError}</p>}
          <div className="mt-5 flex justify-end gap-2.5">
            <Btn variant="quiet" onClick={() => setShowForm(false)}>Cancel</Btn>
            <Btn variant="primary" icon={<Plus className="w-4 h-4" />} onClick={handleCreate}>Add quest</Btn>
          </div>
        </section>
      )}

      <section aria-label="Active quests" className="glass" style={{ padding: "22px 24px" }}>
        <PanelHead icon={<CheckSquare className="w-4 h-4" strokeWidth={1.8} style={{ color: "hsl(var(--ui-accent2))" }} />} title="Active" note={`${todo.length} open`} />
        <div className="mt-2">
          {todo.length === 0 && <p className="sub m-0 py-5 text-center" style={{ fontSize: 14 }}>No open quests. The realm is at peace.</p>}
          {todo.map((task: Task, i: number) => <TaskRow key={task.id} task={task} last={i === todo.length - 1} {...rowProps} />)}
        </div>
        <div className="well mt-3 flex items-center gap-2" style={{ padding: "0 6px 0 14px", borderRadius: 13 }}>
          <label htmlFor="page-quick-quest" className="sr-only-x">Quick add a quest</label>
          <Plus className="w-[15px] h-[15px] shrink-0 label" aria-hidden="true" />
          <input id="page-quick-quest" className="flex-1 min-w-0 bg-transparent outline-none" style={{ minHeight: 44, fontSize: 14, color: "#f0f1f8", border: 0 }}
            placeholder="Add a quest…" value={quick} onChange={(e) => setQuick(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleQuick()} />
          <span aria-hidden="true" style={{ padding: "3px 7px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.12)", fontSize: 11, fontWeight: 600, color: "var(--sub)" }}>Enter</span>
        </div>
      </section>

      {done.length > 0 && (
        <section aria-label="Completed quests" className="glass" style={{ padding: "22px 24px" }}>
          <PanelHead icon={<Check className="w-4 h-4" strokeWidth={2} style={{ color: "#4fd1a1" }} />} title="Completed" note={`${done.length}`} />
          <div className="mt-2">
            {done.slice(0, 30).map((task: Task, i: number) => <TaskRow key={task.id} task={task} last={i === Math.min(done.length, 30) - 1} {...rowProps} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function TaskRow({ task, last, onToggle, onDelete, confirmDelete, setConfirmDelete }: any) {
  const done = task.status === "done";
  const asking = confirmDelete === task.id;
  const look = PRIORITY_LOOK[task.priority] ?? PRIORITY_LOOK.medium;
  return (
    <div className={cx("flex flex-wrap items-center gap-x-3.5 gap-y-2 py-3", !last && "divider")}>
      <button type="button" aria-pressed={done} aria-label={done ? `Mark "${task.title}" as not done` : `Complete "${task.title}"`} onClick={() => onToggle(task.id, task.status)}
        className="flex items-center justify-center" style={{ width: 44, height: 44, margin: "-10px", border: 0, background: "transparent", cursor: "pointer" }}>
        <span aria-hidden="true" className={cx("check", done && "is-on")}>{done && <Check className="w-3.5 h-3.5" strokeWidth={3.2} />}</span>
      </button>
      <span aria-hidden="true" style={{ width: 4, height: 30, borderRadius: 4, flexShrink: 0, background: done ? "rgba(255,255,255,0.18)" : look.bar }} />
      <div className="flex-1 min-w-[160px]">
        <div style={{ fontSize: 15, fontWeight: done ? 400 : 600, color: done ? "var(--label)" : "#f0f1f8", textDecoration: done ? "line-through" : undefined }}>{task.title}</div>
        {task.description && <div className="sub truncate" style={{ fontSize: 13 }}>{task.description}</div>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {!done && <span className="chip" style={{ borderColor: "transparent", background: look.bg, color: look.text }}>{look.label}</span>}
        {task.category && <span className="chip">{task.category}</span>}
        {done && task.completedAt && <span className="chip" style={{ borderColor: "transparent" }}>{new Date(task.completedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
      </div>
      {asking ? (
        <div className="flex items-center gap-2">
          <Btn variant="danger" size="sm" onClick={() => onDelete(task.id)}>Remove</Btn>
          <Btn variant="quiet" size="sm" onClick={() => setConfirmDelete(null)}>Keep</Btn>
        </div>
      ) : (
        <Btn variant="quiet" size="sm" aria-label={`Delete "${task.title}"`} title="Delete quest" icon={<Trash2 className="w-4 h-4" />} onClick={() => setConfirmDelete(task.id)} />
      )}
    </div>
  );
}

/* ============================== Focus ============================== */

const PRESETS = [15, 25, 30, 45, 60];

type FocusRequest = { minutes: number; nonce: number } | null;

function FocusPage({ state, setState, request, onRequestHandled }: { state: any; setState: any; request: FocusRequest; onRequestHandled: () => void }) {
  // A request from the dashboard ("Start focus", the Focus widget's Begin) starts the timer straight away.
  const [selectedMinutes, setSelectedMinutes] = useState(() => request?.minutes ?? 25);
  const [timeLeft, setTimeLeft] = useState(() => (request?.minutes ?? 25) * 60);
  const [isActive, setIsActive] = useState(() => !!request);
  const [isPaused, setIsPaused] = useState(false);
  const [label, setLabel] = useState("Deep work");
  const [sessionSaved, setSessionSaved] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customInput, setCustomInput] = useState("");

  const saveSession = useCallback((minutes: number) => {
    if (minutes < 1) return;
    const newSession: FocusSession = { id: nextId(), durationMinutes: minutes, label, startedAt: new Date().toISOString() };
    setState((s: any) => ({ ...s, focusSessions: [newSession, ...s.focusSessions] }));
  }, [label, setState]);

  useEffect(() => {
    if (!isActive && !isPaused) { setTimeLeft(selectedMinutes * 60); setSessionSaved(false); }
  }, [selectedMinutes, isActive, isPaused]);

  // Declared after the effect above so a new request wins over its reset.
  useEffect(() => {
    if (!request) return;
    setSelectedMinutes(request.minutes);
    setTimeLeft(request.minutes * 60);
    setSessionSaved(false);
    setIsPaused(false);
    setIsActive(true);
    onRequestHandled(); // so coming back to this page later doesn't start it again
  }, [request?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isActive && !isPaused && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    } else if (isActive && timeLeft === 0 && !sessionSaved) {
      setIsActive(false);
      setSessionSaved(true);
      saveSession(selectedMinutes);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isActive, isPaused, timeLeft, sessionSaved, selectedMinutes, saveSession]);

  const applyCustomDuration = () => {
    const val = parseInt(customInput, 10);
    if (!isNaN(val) && val >= 1 && val <= 480) setSelectedMinutes(val);
    setShowCustom(false);
    setCustomInput("");
  };
  const handleStart = () => {
    if (isPaused) { setIsPaused(false); setIsActive(true); return; }
    setIsActive(true); setIsPaused(false); setSessionSaved(false);
  };
  const handlePause = () => { setIsPaused(true); setIsActive(false); };
  const handleStop = () => {
    const elapsed = Math.floor((selectedMinutes * 60 - timeLeft) / 60);
    setIsActive(false); setIsPaused(false); setTimeLeft(selectedMinutes * 60);
    if (elapsed >= 1) saveSession(elapsed);
  };
  const handleReset = () => { setIsActive(false); setIsPaused(false); setTimeLeft(selectedMinutes * 60); setSessionSaved(false); };

  const isPreset = PRESETS.includes(selectedMinutes);
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const progress = (selectedMinutes * 60 - timeLeft) / (selectedMinutes * 60);
  const isFinished = timeLeft === 0;
  const idle = !isActive && !isPaused;
  const summary = computeSummary(state);
  const { days, todayIdx } = focusThisWeek(state);
  const weekTotal = days.reduce((a, b) => a + b, 0);
  const maxDay = Math.max(1, ...days);

  return (
    <div className="flex flex-col gap-[18px] animate-in">
      <PageHeader eyebrow="Study" title="Focus" sub="Channel your arcane concentration." />

      <div className="flex flex-wrap gap-[18px]">
        <section aria-label="Focus timer" className="glass flex flex-col items-center gap-6" style={{ flex: "2 1 460px", padding: "30px 28px" }}>
          <Ring pct={progress} size={300} stroke={12} color={isFinished ? "#4fd1a1" : "hsl(var(--ui-accent))"}>
            <div className="display tnum" role="timer" aria-live="off" style={{ fontSize: 84, letterSpacing: "-0.02em", opacity: isPaused ? 0.55 : 1 }}>
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </div>
            <div className="sub mt-1" style={{ fontSize: 13, fontWeight: 600 }}>
              {isFinished ? "Session complete" : isPaused ? "Paused" : isActive ? "Focusing" : `${selectedMinutes} minutes`}
            </div>
          </Ring>

          <div className="w-full max-w-sm">
            <label htmlFor="focus-label" className="sr-only-x">What are you focusing on?</label>
            <input id="focus-label" className="field text-center" value={label} onChange={(e) => setLabel(e.target.value)} disabled={isActive} placeholder="What are you focusing on?" />
          </div>

          {idle && !isFinished && (
            <div className="flex flex-wrap justify-center gap-2">
              {PRESETS.map((m) => (
                <button key={m} type="button" className="seg" aria-pressed={selectedMinutes === m && !showCustom} aria-label={`${m} minutes`}
                  onClick={() => { setSelectedMinutes(m); setShowCustom(false); }}>{m}</button>
              ))}
              {!showCustom ? (
                <button type="button" className="seg" aria-pressed={!isPreset} onClick={() => { setShowCustom(true); setCustomInput(String(selectedMinutes)); }}>
                  {!isPreset ? `${selectedMinutes} min` : "Custom"}
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <label htmlFor="focus-custom" className="sr-only-x">Minutes</label>
                  <input id="focus-custom" type="number" className="field text-center" style={{ width: 88 }} autoFocus min={1} max={480} value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") applyCustomDuration(); if (e.key === "Escape") { setShowCustom(false); setCustomInput(""); } }} />
                  <Btn variant="glass" aria-label="Use this length" icon={<Check className="w-4 h-4" />} onClick={applyCustomDuration} />
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-2.5">
            {isFinished ? (
              <Btn variant="primary" icon={<RotateCcw className="w-4 h-4" />} onClick={handleReset}>New session</Btn>
            ) : idle ? (
              <Btn variant="primary" style={{ padding: "0 34px" }} icon={<Play className="w-3.5 h-3.5" fill="currentColor" />} onClick={handleStart}>Begin</Btn>
            ) : (
              <>
                {isActive
                  ? <Btn variant="glass" icon={<Pause className="w-4 h-4" />} onClick={handlePause}>Pause</Btn>
                  : <Btn variant="primary" icon={<Play className="w-3.5 h-3.5" fill="currentColor" />} onClick={handleStart}>Resume</Btn>}
                <Btn variant="glass" icon={<Square className="w-3.5 h-3.5" />} onClick={handleStop}>Stop and save</Btn>
              </>
            )}
          </div>
          {isFinished && <p className="m-0" style={{ color: "#8ce6c4", fontSize: 14, fontWeight: 600 }} role="status">Well channelled. The session is saved.</p>}
        </section>

        <div className="flex flex-col gap-[18px]" style={{ flex: "1 1 260px" }}>
          <div className="tile" style={{ padding: "20px 22px" }}>
            <div className="sub" style={{ fontSize: 13, fontWeight: 600 }}>Today</div>
            <div className="display tnum mt-2.5" style={{ fontSize: 42 }}>{summary.totalFocusMinutesToday}<span style={{ fontSize: 22, color: "var(--sub)" }}> min</span></div>
          </div>
          <div className="tile" style={{ padding: "20px 22px" }}>
            <div className="flex items-center justify-between">
              <span className="sub" style={{ fontSize: 13, fontWeight: 600 }}>This week</span>
              <span className="sub tnum" style={{ fontSize: 13 }}>{weekTotal} min</span>
            </div>
            <div role="img" aria-label={`Focus minutes this week: ${days.slice(0, todayIdx + 1).join(", ")}`} className="mt-4 flex items-end justify-between gap-2" style={{ height: 70 }}>
              {days.map((m, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                  <span style={{ width: "100%", maxWidth: 14, borderRadius: 4, height: i > todayIdx ? 3 : Math.max(3, Math.round((m / maxDay) * 52)), background: i === todayIdx ? "hsl(var(--ui-accent))" : i > todayIdx ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.24)" }} />
                  <span className="label" style={{ fontSize: 11, fontWeight: 600 }}>{"MTWTFSS"[i]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {state.focusSessions.length > 0 && (
        <section aria-label="Recent sessions" className="glass" style={{ padding: "22px 24px" }}>
          <PanelHead icon={<History className="w-4 h-4" strokeWidth={1.8} style={{ color: "#7cc8ff" }} />} title="Recent sessions" />
          <div className="mt-2">
            {state.focusSessions.slice(0, 8).map((session: FocusSession, i: number, arr: FocusSession[]) => (
              <div key={session.id} className={cx("flex items-center justify-between gap-3 py-3", i < arr.length - 1 && "divider")}>
                <div className="min-w-0">
                  <div className="truncate" style={{ fontSize: 15, fontWeight: 600 }}>{session.label}</div>
                  <div className="sub" style={{ fontSize: 13 }}>{new Date(session.startedAt).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</div>
                </div>
                <div className="display tnum shrink-0" style={{ fontSize: 28 }}>{session.durationMinutes}<span style={{ fontSize: 15, color: "var(--sub)" }}> min</span></div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ============================== Vitality ============================== */

type MetricKey = "water" | "sleep" | "steps" | "mood" | "exercise";
const METRICS: { key: MetricKey; label: string; icon: any; unit: string; color: string; step: number; min: number; max: number }[] = [
  { key: "water", label: "Water", icon: Droplet, unit: "cups", color: "#7cc8ff", step: 1, min: 0, max: 20 },
  { key: "sleep", label: "Sleep", icon: Moon, unit: "hrs", color: "#a891ff", step: 0.5, min: 0, max: 16 },
  { key: "steps", label: "Steps", icon: Footprints, unit: "k", color: "#4fd1a1", step: 1000, min: 0, max: 50000 },
  { key: "mood", label: "Mood", icon: Smile, unit: "/5", color: "#f2c46b", step: 1, min: 1, max: 5 },
  { key: "exercise", label: "Exercise", icon: Dumbbell, unit: "min", color: "#ff9f6e", step: 5, min: 0, max: 300 },
];
function formatValue(key: MetricKey, v: number) {
  if (key === "steps") return v >= 1000 ? (v / 1000).toFixed(1) : String(v);
  if (key === "sleep" || key === "exercise") return v % 1 === 0 ? String(v) : v.toFixed(1);
  return String(v);
}

function HealthPage({ state, setState }: { state: any; setState: any }) {
  const today = todayStr();
  const latestByType: Record<string, number> = {};
  for (const log of state.healthLogs as HealthLog[]) if (log.loggedAt.split("T")[0] === today) latestByType[log.type] = log.value;

  const [activeKey, setActiveKey] = useState<MetricKey | null>(null);
  const [inputVal, setInputVal] = useState<number>(0);
  const [justSaved, setJustSaved] = useState<MetricKey | null>(null);
  const active = METRICS.find((m) => m.key === activeKey) ?? null;

  const openLog = (key: MetricKey) => {
    const m = METRICS.find((x) => x.key === key)!;
    setInputVal(latestByType[key] ?? (key === "mood" ? 3 : m.step));
    setActiveKey(activeKey === key ? null : key);
  };
  const handleLog = () => {
    if (!activeKey) return;
    const newLog: HealthLog = { id: nextId(), type: activeKey, value: inputVal, unit: activeKey, loggedAt: new Date().toISOString() };
    setState((s: any) => ({ ...s, healthLogs: [...s.healthLogs, newLog] }));
    setJustSaved(activeKey);
    setTimeout(() => setJustSaved(null), 2000);
    setActiveKey(null);
  };
  const clamp = (v: number, m: typeof METRICS[number]) => Math.min(m.max, Math.max(m.min, +v.toFixed(2)));

  return (
    <div className="flex flex-col gap-[18px] animate-in">
      <PageHeader eyebrow="Body & mind" title="Vitality" sub="Tend to your physical and spiritual vessels." />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-[18px]">
        {METRICS.map((m) => {
          const Icon = m.icon;
          const val = latestByType[m.key];
          const on = activeKey === m.key;
          return (
            <button key={m.key} type="button" onClick={() => openLog(m.key)} aria-expanded={on} aria-label={`${m.label}: ${val !== undefined ? `${formatValue(m.key, val)} ${m.unit}` : "not logged today"}. Log ${m.label.toLowerCase()}`}
              className="tile flex flex-col text-left transition-colors hover:bg-white/[0.07]"
              style={{ padding: "20px 22px", minHeight: 150, borderColor: on ? m.color : justSaved === m.key ? "rgba(79,209,161,0.6)" : undefined }}>
              <span className="flex items-center justify-between w-full">
                <span className="sub" style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</span>
                <Icon className="w-[18px] h-[18px]" strokeWidth={1.7} style={{ color: m.color }} aria-hidden="true" />
              </span>
              <span className="display tnum mt-auto pt-4" style={{ fontSize: 46 }}>
                {val !== undefined ? formatValue(m.key, val) : "–"}<span style={{ fontSize: 18, color: "var(--sub)" }}> {m.unit}</span>
              </span>
              <span className="mt-1" style={{ fontSize: 12, fontWeight: 600, color: justSaved === m.key ? "#8ce6c4" : "var(--label)" }}>
                {justSaved === m.key ? "Logged" : val !== undefined ? "Today" : "Tap to log"}
              </span>
            </button>
          );
        })}
      </div>

      {active && (
        <section aria-label={`Log ${active.label}`} className="glass flex flex-wrap items-center gap-5" style={{ padding: "22px 24px" }}>
          <PanelHead icon={<active.icon className="w-4 h-4" strokeWidth={1.8} style={{ color: active.color }} />} title={`Log ${active.label.toLowerCase()}`} />
          <div className="flex items-center gap-2">
            <Btn variant="glass" aria-label="Less" icon={<Minus className="w-4 h-4" />} onClick={() => setInputVal((v) => clamp(v - active.step, active))} />
            <label htmlFor="vital-value" className="sr-only-x">{active.label} ({active.unit})</label>
            <input id="vital-value" type="number" className="field text-center tnum" style={{ width: 110, fontSize: 18, fontWeight: 700 }}
              value={inputVal} min={active.min} max={active.max} step={active.step} onChange={(e) => setInputVal(Number(e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && handleLog()} />
            <Btn variant="glass" aria-label="More" icon={<Plus className="w-4 h-4" />} onClick={() => setInputVal((v) => clamp(v + active.step, active))} />
            <span className="sub" style={{ fontSize: 14 }}>{active.unit}</span>
          </div>
          {active.key === "mood" && <MoodPicker value={inputVal} onChange={(v) => setInputVal(v)} />}
          <div className="ml-auto flex gap-2.5">
            <Btn variant="quiet" onClick={() => setActiveKey(null)}>Cancel</Btn>
            <Btn variant="primary" icon={<Check className="w-4 h-4" />} onClick={handleLog}>Log it</Btn>
          </div>
        </section>
      )}

      <p className="sub m-0 px-2" style={{ fontSize: 14 }}>Tap a measure to log it. The latest value for today is shown; your journal mood is logged here too.</p>
    </div>
  );
}

/* ============================== Fast ============================== */

const PROTOCOLS = [
  { id: "16:8", label: "16 : 8", hours: 16, desc: "Fast 16h, eat in an 8h window" },
  { id: "18:6", label: "18 : 6", hours: 18, desc: "Fast 18h, eat in a 6h window" },
  { id: "20:4", label: "20 : 4", hours: 20, desc: "Fast 20h, eat in a 4h window" },
  { id: "24h", label: "24h", hours: 24, desc: "A full day" },
  { id: "custom", label: "Custom", hours: 0, desc: "Set your own target" },
] as const;
type ProtocolId = (typeof PROTOCOLS)[number]["id"];

function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function formatHours(ms: number) {
  return (ms / 3_600_000).toFixed(1);
}

function FastingPage({ state, setState }: { state: any; setState: any }) {
  const currentFast = state.fastSessions.find((f: FastSession) => f.status === "active");
  const history = state.fastSessions.filter((f: FastSession) => f.status !== "active")
    .sort((a: FastSession, b: FastSession) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  const [selectedProtocol, setSelectedProtocol] = useState<ProtocolId>("16:8");
  const [customHours, setCustomHours] = useState(20);
  const now = useNow(1000, !!currentFast);

  const handleStart = () => {
    const proto = PROTOCOLS.find((p) => p.id === selectedProtocol)!;
    const hours = selectedProtocol === "custom" ? Math.max(1, Math.min(72, customHours || 1)) : proto.hours;
    const newFast: FastSession = { id: nextId(), protocol: selectedProtocol, targetHours: hours, startedAt: new Date().toISOString(), status: "active" };
    setState((s: any) => ({ ...s, fastSessions: [...s.fastSessions, newFast] }));
  };
  const handleEnd = (status: "completed" | "broken") => {
    setState((s: any) => ({
      ...s,
      fastSessions: s.fastSessions.map((f: FastSession) => (f.id === currentFast.id ? { ...f, status, endedAt: new Date().toISOString() } : f)),
    }));
  };

  const elapsed = currentFast ? now - new Date(currentFast.startedAt).getTime() : 0;
  const targetMs = currentFast ? currentFast.targetHours * 3_600_000 : 0;
  const pct = targetMs > 0 ? elapsed / targetMs : 0;
  const isComplete = pct >= 1;
  const remainingMs = Math.max(0, targetMs - elapsed);

  return (
    <div className="flex flex-col gap-[18px] animate-in">
      <PageHeader eyebrow="Body & mind" title="Fast" sub="Clarity through restraint." />

      {currentFast ? (
        <>
          <section aria-label="Current fast" className="glass flex flex-wrap items-center justify-center gap-x-10 gap-y-6" style={{ padding: "30px 28px" }}>
            <Ring pct={pct} size={260} stroke={12} color={isComplete ? "#4fd1a1" : "hsl(var(--ui-accent))"}>
              <div className="eyebrow">{isComplete ? "Goal reached" : "Elapsed"}</div>
              <div className="display tnum mt-1" style={{ fontSize: 46 }}>{formatDuration(elapsed)}</div>
              <div className="sub mt-1" style={{ fontSize: 13, fontWeight: 600 }}>{Math.min(100, Math.round(pct * 100))}%</div>
            </Ring>
            <div className="min-w-[220px]">
              <span className="chip chip-round" style={{ fontSize: 13, padding: "6px 12px", border: "1px solid var(--edge)" }}>
                <Moon className="w-3.5 h-3.5" style={{ color: "hsl(var(--ui-accent))" }} aria-hidden="true" /> {currentFast.protocol} fast
              </span>
              <div className="display tnum mt-3.5" style={{ fontSize: 44 }}>{currentFast.targetHours}<span style={{ fontSize: 22, color: "var(--sub)" }}> hour target</span></div>
              <div className="sub mt-2" style={{ fontSize: 15 }}>
                {isComplete ? "You've reached your goal." : `${formatDuration(remainingMs)} to go`} · started {new Date(currentFast.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <Btn variant="good" icon={<CheckCircle className="w-4 h-4" />} onClick={() => handleEnd("completed")}>Complete</Btn>
                <Btn variant="danger" icon={<XCircle className="w-4 h-4" />} onClick={() => handleEnd("broken")}>Break fast</Btn>
              </div>
            </div>
          </section>
          <div className="flex flex-wrap gap-[18px]">
            {[["Elapsed", `${formatHours(elapsed)}h`], ["Complete", `${Math.min(100, Math.round(pct * 100))}%`], ["Remaining", `${formatHours(remainingMs)}h`]].map(([k, v]) => (
              <div key={k} className="tile" style={{ flex: "1 1 160px", padding: "20px 22px" }}>
                <div className="sub" style={{ fontSize: 13, fontWeight: 600 }}>{k}</div>
                <div className="display tnum mt-2.5" style={{ fontSize: 42 }}>{v}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <section aria-label="Begin a fast" className="glass" style={{ padding: "24px 26px" }}>
          <PanelHead icon={<Moon className="w-4 h-4" strokeWidth={1.8} style={{ color: "hsl(var(--ui-accent))" }} />} title="Begin a fast" note="Choose a protocol" />
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {PROTOCOLS.map((p) => {
              const on = selectedProtocol === p.id;
              return (
                <button key={p.id} type="button" aria-pressed={on} onClick={() => setSelectedProtocol(p.id)}
                  className="well text-left transition-colors hover:bg-white/5" style={{ padding: "16px 16px", borderRadius: 16, borderColor: on ? "hsl(var(--ui-accent))" : undefined, background: on ? "hsl(var(--ui-accent) / 0.1)" : undefined }}>
                  <div className="display" style={{ fontSize: 30 }}>{p.label}</div>
                  <div className="sub mt-1.5" style={{ fontSize: 13, lineHeight: 1.35 }}>{p.desc}</div>
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
            {selectedProtocol === "custom" ? (
              <div>
                <label htmlFor="fast-hours" className="field-label">Target hours</label>
                <input id="fast-hours" type="number" min={1} max={72} className="field tnum" style={{ width: 120 }} value={customHours} onChange={(e) => setCustomHours(Number(e.target.value))} />
              </div>
            ) : <span />}
            <Btn variant="primary" icon={<Moon className="w-4 h-4" />} onClick={handleStart}>Start fast</Btn>
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section aria-label="Past fasts" className="glass" style={{ padding: "22px 24px" }}>
          <PanelHead icon={<History className="w-4 h-4" strokeWidth={1.8} style={{ color: "var(--label)" }} />} title="Past fasts" />
          <div className="mt-2">
            {history.slice(0, 8).map((f: FastSession, i: number, arr: FastSession[]) => {
              const dur = f.endedAt ? new Date(f.endedAt).getTime() - new Date(f.startedAt).getTime() : 0;
              const achieved = dur / 3_600_000;
              const ok = f.status === "completed";
              return (
                <div key={f.id} className={cx("flex items-center gap-3.5 py-3", i < arr.length - 1 && "divider")}>
                  <span aria-hidden="true" className="flex items-center justify-center shrink-0" style={{ width: 32, height: 32, borderRadius: 10, background: ok ? "rgba(79,209,161,0.14)" : "rgba(255,138,122,0.12)", color: ok ? "#8ce6c4" : "#ffb3a8" }}>
                    {ok ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{f.protocol} fast <span className="sub" style={{ fontWeight: 400 }}>· {ok ? "completed" : "broken"}</span></div>
                    <div className="sub" style={{ fontSize: 13 }}>{new Date(f.startedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · {achieved.toFixed(1)}h of {f.targetHours}h</div>
                  </div>
                  <div className="display tnum shrink-0" style={{ fontSize: 26, color: ok ? "var(--ink)" : "var(--sub)" }}>{Math.min(100, Math.round((achieved / f.targetHours) * 100))}%</div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

/* ============================== Journal ============================== */

function JournalPage({ state, setState }: { state: any; setState: any }) {
  const { today, entry, save } = useTodayJournal(state, setState);
  const [text, setText] = useState(entry?.text ?? "");
  const [mood, setMood] = useState<number | null>(entry?.mood ?? null);
  const [savedFlash, setSavedFlash] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setText(entry?.text ?? "");
    setMood(entry?.mood ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  const flash = () => { setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1500); };
  const handleTextChange = (val: string) => {
    setText(val);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => { save(val, mood, false); flash(); }, 900);
  };
  const handleMoodSelect = (val: number) => {
    const next = mood === val ? null : val;
    setMood(next);
    save(text, next, true);
    flash();
  };

  const pastEntries = state.journalEntries
    .filter((e: JournalEntry) => e.date !== today)
    .sort((a: JournalEntry, b: JournalEntry) => b.date.localeCompare(a.date));

  return (
    <div className="flex flex-col gap-[18px] animate-in">
      <PageHeader eyebrow="Body & mind" title="Journal" sub="A page for today's thoughts." />

      <section aria-label="Today's entry" className="glass flex flex-col gap-4" style={{ padding: "26px 28px" }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="display m-0" style={{ fontSize: 34 }}>{formatLongDate(new Date(today + "T12:00:00"))}</h2>
          <span className="sub" style={{ fontSize: 13, color: savedFlash ? "#8ce6c4" : undefined }} role="status">{savedFlash ? "Saved" : "Saves as you write"}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="sub" style={{ fontSize: 14 }}>How are you feeling?</span>
          <MoodPicker value={mood} onChange={handleMoodSelect} />
        </div>
        <label htmlFor="journal-text" className="sr-only-x">Today's journal entry</label>
        <textarea id="journal-text" className="field" rows={10} value={text} onChange={(e) => handleTextChange(e.target.value)}
          placeholder="What happened today? What's on your mind?" />
      </section>

      {pastEntries.length > 0 && (
        <section aria-label="Past entries" className="glass" style={{ padding: "22px 24px" }}>
          <PanelHead icon={<NotebookPen className="w-4 h-4" strokeWidth={1.8} style={{ color: "#f4c38a" }} />} title="Past entries" note={`${pastEntries.length}`} />
          <div className="mt-2">
            {pastEntries.slice(0, 14).map((e: JournalEntry, i: number, arr: JournalEntry[]) => (
              <article key={e.id} className={cx("py-3.5", i < arr.length - 1 && "divider")}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="m-0" style={{ fontSize: 15, fontWeight: 700 }}>{new Date(e.date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</h3>
                  {e.mood && <span title={`Mood ${e.mood} of 5, ${MOOD_LABELS[e.mood - 1]}`}><MoodFace level={e.mood} selected size={20} /></span>}
                </div>
                <p className="sub mt-1.5 mb-0 whitespace-pre-wrap line-clamp-3" style={{ fontSize: 14, lineHeight: 1.55 }}>
                  {e.text || <span className="label">No notes, just a mood.</span>}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ============================== Lofi ============================== */

const LOFI_STATIONS = [
  { id: "X4VbdwhkE10", label: "lofi hip hop radio — beats to relax/study to", by: "Lofi Girl" },
  { id: "JD-kMIpDfnY", label: "lofi hip hop radio — beats to sleep/chill to", by: "Lofi Girl" },
  { id: "4xDzrJKXOOY", label: "synthwave radio — beats to chill/game to", by: "Lofi Girl" },
  { id: "E2vONfzoyRI", label: "jazz lofi radio — beats to chill/study to", by: "Lofi Girl" },
  { id: "b4g8Uz7KP1A", label: "Lo-Fi Girl LIVE — cozy lofi hip hop 24/7", by: "Lo-Fi Girl LIVE" },
];

/** The website's copy of public/player.html, used by the desktop app to play streams. */
const PLAYER_RELAY = "https://cnotincluded-hash.github.io/sanctum/player.html";

function LofiPlayer({ compact = false }: { compact?: boolean }) {
  const [stationIdx, setStationIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const station = LOFI_STATIONS[stationIdx];
  // Browsers block sound on autoplay, so the stream starts muted; unmute with the player's own control.
  // The desktop app plays through public/player.html on the website: YouTube needs to know which
  // site an embed is on (else "Error 153"), and the app's own tauri:// pages can't tell it.
  const src = IS_DESKTOP
    ? `${PLAYER_RELAY}?v=${station.id}`
    : `https://www.youtube-nocookie.com/embed/${station.id}?autoplay=1&mute=1`;
  const watchUrl = `https://www.youtube.com/watch?v=${station.id}`;

  const body = (
    <div className={cx("flex flex-col gap-3", compact && "flex-1 min-h-0 scroll-y")}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate" style={{ fontSize: compact ? 14 : 16, fontWeight: 700 }}>{station.label.split(" — ")[0]}</div>
          <div className="sub truncate" style={{ fontSize: 13 }}>{station.label.split(" — ")[1] ?? ""} · {station.by}</div>
        </div>
        {playing
          ? <Btn variant="glass" size={compact ? "sm" : undefined} icon={<Pause className="w-4 h-4" />} onClick={() => setPlaying(false)}>Stop</Btn>
          : <Btn variant="primary" size={compact ? "sm" : undefined} icon={<Play className="w-3.5 h-3.5" fill="currentColor" />} onClick={() => setPlaying(true)}>Play</Btn>}
      </div>
      {playing && (
        <div className="overflow-hidden" style={{ aspectRatio: "16 / 9", borderRadius: 16, border: "1px solid var(--edge)" }}>
          <iframe key={station.id} src={src} title={station.label} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin" className="w-full h-full" style={{ border: 0 }} />
        </div>
      )}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Stations">
        {LOFI_STATIONS.map((s, i) => (
          <button key={s.id} type="button" className="seg" style={compact ? { minHeight: 36, fontSize: 12, padding: "0 10px" } : { fontSize: 13 }}
            aria-pressed={i === stationIdx} onClick={() => setStationIdx(i)}>{s.label.split(" — ")[0]}</button>
        ))}
      </div>
      {!compact && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="sub m-0" style={{ fontSize: 13 }}>Streams start muted; unmute in the player. If one won't load, open it on YouTube.</p>
          <a href={watchUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "hsl(var(--ui-accent2))", fontWeight: 600 }}>Open in YouTube ↗</a>
        </div>
      )}
    </div>
  );

  if (compact) return body;
  return (
    <div className="flex flex-col gap-[18px] animate-in">
      <PageHeader eyebrow="Leisure" title="Lofi" sub="Live streams to study to." />
      <section aria-label="Lofi player" className="glass" style={{ padding: "24px 26px" }}>{body}</section>
    </div>
  );
}

/* ============================== Ascent (RPG) ============================== */

/** Chunky pixel-block sprite renderer. Takes a small grid of color indices and renders as squares. */
function PixelSprite({ grid, palette, pixelSize = 6, className }: { grid: number[][]; palette: Record<number, string>; pixelSize?: number; className?: string }) {
  return (
    <div className={cn("inline-block leading-none select-none", className)} style={{ imageRendering: "pixelated" }}>
      {grid.map((row, y) => (
        <div key={y} style={{ display: "flex" }}>
          {row.map((cell, x) => (
            <div key={x} style={{ width: pixelSize, height: pixelSize, background: cell === 0 ? "transparent" : palette[cell] }} />
          ))}
        </div>
      ))}
    </div>
  );
}

// 0 = transparent. Small hand-authored pixel grids, arcane-mage themed.
const PLAYER_SPRITE: number[][] = [
  [0, 0, 1, 1, 1, 0, 0],
  [0, 1, 2, 1, 2, 1, 0],
  [0, 1, 3, 3, 3, 1, 0],
  [0, 0, 1, 1, 1, 0, 0],
  [0, 4, 1, 1, 1, 4, 0],
  [0, 0, 1, 5, 1, 0, 0],
  [0, 0, 1, 0, 1, 0, 0],
];
const PLAYER_PALETTE = { 1: "#2d2a4a", 2: "#fde68a", 3: "#7c3aed", 4: "#a855f7", 5: "#f59e0b" };

const ENEMY_SPRITES: Record<string, number[][]> = {
  Slime: [
    [0, 0, 1, 1, 1, 0, 0],
    [0, 1, 1, 1, 1, 1, 0],
    [1, 1, 2, 1, 2, 1, 1],
    [1, 1, 1, 1, 1, 1, 1],
    [0, 1, 1, 1, 1, 1, 0],
  ],
  Goblin: [
    [0, 1, 0, 0, 0, 1, 0],
    [0, 1, 2, 2, 2, 1, 0],
    [0, 2, 2, 3, 2, 2, 0],
    [0, 0, 2, 2, 2, 0, 0],
    [0, 4, 2, 2, 2, 4, 0],
  ],
  Skeleton: [
    [0, 0, 1, 1, 1, 0, 0],
    [0, 1, 2, 1, 2, 1, 0],
    [0, 0, 1, 1, 1, 0, 0],
    [0, 1, 1, 1, 1, 1, 0],
    [0, 0, 1, 0, 1, 0, 0],
  ],
  "Dire Wolf": [
    [1, 0, 0, 0, 0, 1, 0],
    [1, 1, 2, 2, 1, 1, 0],
    [1, 2, 2, 2, 2, 1, 0],
    [0, 1, 1, 1, 1, 0, 0],
    [0, 1, 0, 0, 1, 0, 0],
  ],
  Wraith: [
    [0, 1, 1, 1, 1, 1, 0],
    [1, 1, 2, 1, 2, 1, 1],
    [1, 1, 1, 1, 1, 1, 1],
    [1, 0, 1, 0, 1, 0, 1],
    [0, 1, 0, 1, 0, 1, 0],
  ],
  "Stone Golem": [
    [0, 1, 1, 1, 1, 1, 0],
    [1, 1, 2, 1, 2, 1, 1],
    [1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1],
    [0, 1, 0, 1, 0, 1, 0],
  ],
  Wyvern: [
    [0, 1, 0, 0, 0, 1, 0],
    [1, 1, 1, 1, 1, 1, 1],
    [0, 1, 2, 1, 2, 1, 0],
    [0, 0, 1, 1, 1, 0, 0],
    [0, 1, 0, 0, 0, 1, 0],
  ],
  "Lich King": [
    [0, 0, 1, 1, 1, 0, 0],
    [0, 1, 3, 1, 3, 1, 0],
    [0, 1, 1, 1, 1, 1, 0],
    [1, 1, 1, 1, 1, 1, 1],
    [0, 1, 0, 1, 0, 1, 0],
  ],
};
const ENEMY_PALETTES: Record<string, Record<number, string>> = {
  Slime: { 1: "#16a34a", 2: "#052e16" },
  Goblin: { 1: "#166534", 2: "#22c55e", 3: "#dc2626", 4: "#78350f" },
  Skeleton: { 1: "#e2e8f0", 2: "#1e293b" },
  "Dire Wolf": { 1: "#1e293b", 2: "#475569" },
  Wraith: { 1: "#4c1d95", 2: "#ddd6fe" },
  "Stone Golem": { 1: "#57534e", 2: "#facc15" },
  Wyvern: { 1: "#991b1b", 2: "#fde047" },
  "Lich King": { 1: "#e2e8f0", 2: "#ef4444", 3: "#a855f7" },
};

const GEAR_TIER_COLOR: Record<GearTier, string> = { common: "#94a3b8", rare: "#60a5fa", epic: "#c084fc" };

function GearSlotCard({ slot, gear, onUnequip }: { slot: GearSlot; gear: Gear | null; onUnequip?: () => void }) {
  const slotLabel = slot === "weapon" ? "Weapon" : slot === "armor" ? "Armour" : "Trinket";
  return (
    <div className="well" style={{ padding: "12px 14px", borderColor: gear ? `${GEAR_TIER_COLOR[gear.tier]}55` : undefined }}>
      <div className="eyebrow" style={{ fontSize: 10 }}>{slotLabel}</div>
      {gear ? (
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate" style={{ fontSize: 14, fontWeight: 700, color: GEAR_TIER_COLOR[gear.tier] }}>{gear.name}</div>
            <div className="sub" style={{ fontSize: 12 }}>+{gear.atk} ATK · +{gear.def} DEF · +{gear.hp} HP</div>
          </div>
          {onUnequip && <Btn variant="quiet" size="sm" aria-label={`Unequip ${gear.name}`} icon={<X className="w-4 h-4" />} onClick={onUnequip} />}
        </div>
      ) : (
        <div className="label mt-1.5" style={{ fontSize: 13 }}>Empty</div>
      )}
    </div>
  );
}

function AscentPage({ state, setState }: { state: any; setState: any }) {
  const rpg: RpgState = state.rpg;
  const stats = computeRpgStats(rpg);
  const essenceIntoLevel = rpg.lifetimeEssence % ESSENCE_PER_LEVEL;

  const [selectedEnemyIdx, setSelectedEnemyIdx] = useState(0);
  const [battling, setBattling] = useState(false);
  const [battleLog, setBattleLog] = useState<BattleLogLine[]>([]);
  const [battleResult, setBattleResult] = useState<{ won: boolean; gear?: Gear } | null>(null);
  const [useSpecial, setUseSpecial] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);

  const activeStreakCount = computeSummary(state).currentStreaks.length;
  const familiarBonus = activeStreakCount * 2; // small combat perk for keeping streaks alive

  const maxUnlockedTier = Math.min(5, Math.ceil(rpg.level / 3));
  const availableEnemies = ENEMY_TIERS.filter((e) => e.tier <= maxUnlockedTier);
  const enemy = availableEnemies[selectedEnemyIdx] ?? availableEnemies[0];
  const battleCost = 15 + enemy.tier * 10;
  const canAfford = rpg.essenceBalance >= battleCost;

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [battleLog]);

  const battleTokenRef = useRef(0);

  const handleBattle = () => {
    if (!canAfford || battling) return;
    setBattling(true);
    setBattleResult(null);
    setBattleLog([]);

    const { won, log } = simulateBattle(stats, familiarBonus, enemy, useSpecial && activeStreakCount > 0);
    const essenceGained = won ? 20 + enemy.tier * 12 : 0;
    const gearDropped = won && Math.random() < 0.6 ? rollGear(enemy.tier) : undefined;

    // Token guards against overlapping reveal loops if a battle is somehow triggered twice.
    const myToken = ++battleTokenRef.current;
    let i = 0;
    const reveal = () => {
      if (battleTokenRef.current !== myToken) return;
      if (i >= log.length) return;
      setBattleLog((prev) => [...prev, log[i]]);
      i++;
      if (i < log.length) {
        setTimeout(reveal, 380);
      } else {
        setState((s: any) => {
          const newInventory = gearDropped ? [...s.rpg.inventory, gearDropped] : s.rpg.inventory;
          const record: BattleRecord = {
            id: nextId(), enemyName: enemy.name, enemyTier: enemy.tier, won,
            essenceSpent: battleCost, essenceGained, gearDropped: gearDropped?.name, at: new Date().toISOString(),
          };
          return {
            ...s,
            rpg: {
              ...s.rpg,
              essenceBalance: s.rpg.essenceBalance - battleCost + essenceGained,
              inventory: newInventory,
              battleHistory: [record, ...s.rpg.battleHistory].slice(0, 30),
            },
          };
        });
        setBattleResult({ won, gear: gearDropped });
        setBattling(false);
      }
    };
    reveal();
  };

  const handleEquip = (gear: Gear) => setState((s: any) => ({ ...s, rpg: { ...s.rpg, equipped: { ...s.rpg.equipped, [gear.slot]: gear } } }));
  const handleUnequip = (slot: GearSlot) => setState((s: any) => ({ ...s, rpg: { ...s.rpg, equipped: { ...s.rpg.equipped, [slot]: null } } }));

  const statList: [string, number, string][] = [["HP", stats.hp, "#4fd1a1"], ["ATK", stats.atk, "#ff8a7a"], ["DEF", stats.def, "#7cc8ff"], ["SPD", stats.speed, "#f2c46b"]];

  return (
    <div className="flex flex-col gap-[18px] animate-in">
      <PageHeader eyebrow="Leisure" title="The Ascent" sub="Your deeds in the waking world echo here." />

      <section aria-label="Your character" className="glass" style={{ padding: "26px 28px" }}>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
          <div className="flex items-center gap-5">
            <div className="flex items-center justify-center shrink-0" style={{ width: 96, height: 96, borderRadius: 24, background: "radial-gradient(circle at 50% 45%, hsl(var(--ui-accent2) / 0.45), hsl(var(--ui-accent2) / 0.08) 70%)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <PixelSprite grid={PLAYER_SPRITE} palette={PLAYER_PALETTE} pixelSize={9} />
            </div>
            <div>
              <span className="chip chip-round" style={{ border: "1px solid var(--edge)" }}>
                <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: "hsl(var(--ui-accent2))" }} /> Level {rpg.level} adventurer
              </span>
              <div className="display tnum mt-2.5" style={{ fontSize: 48 }}>{rpg.essenceBalance.toLocaleString()} <span style={{ fontSize: 22, color: "var(--sub)" }}>Essence to spend</span></div>
              <div className="sub mt-1" style={{ fontSize: 14 }}>{rpg.lifetimeEssence.toLocaleString()} earned in all</div>
            </div>
          </div>
          <div className="flex-1 min-w-[240px]">
            <div className="flex justify-between sub" style={{ fontSize: 13 }}><span>Level progress</span><span className="tnum">{essenceIntoLevel} / {ESSENCE_PER_LEVEL}</span></div>
            <div className="track mt-2"><div className="fill fill-2" style={{ width: `${essenceIntoLevel}%` }} /></div>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {statList.map(([label, value, color]) => (
                <div key={label} className="well text-center" style={{ padding: "10px 4px" }}>
                  <div className="display tnum" style={{ fontSize: 28, color }}>{value}</div>
                  <div className="eyebrow" style={{ fontSize: 10 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <GearSlotCard slot="weapon" gear={rpg.equipped.weapon} onUnequip={() => handleUnequip("weapon")} />
          <GearSlotCard slot="armor" gear={rpg.equipped.armor} onUnequip={() => handleUnequip("armor")} />
          <GearSlotCard slot="trinket" gear={rpg.equipped.trinket} onUnequip={() => handleUnequip("trinket")} />
        </div>
        <p className="sub mt-4 mb-0" style={{ fontSize: 13 }}>
          Essence flows in as you complete rituals, quests and focus sessions, and your level rises on its own. Spend it below to challenge enemies for gear and more Essence.
        </p>
      </section>

      {rpg.inventory.length > 0 && (
        <section aria-label="Inventory" className="glass" style={{ padding: "22px 24px" }}>
          <PanelHead icon={<Star className="w-4 h-4" strokeWidth={1.8} style={{ color: "hsl(var(--ui-accent2))" }} />} title="Inventory" note="Select an item to equip it" />
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {rpg.inventory.map((g) => (
              <button key={g.id} type="button" onClick={() => handleEquip(g)} className="well text-left transition-colors hover:bg-white/5" style={{ padding: "12px 14px", borderColor: `${GEAR_TIER_COLOR[g.tier]}44` }}>
                <div className="truncate" style={{ fontSize: 14, fontWeight: 700, color: GEAR_TIER_COLOR[g.tier] }}>{g.name}</div>
                <div className="sub capitalize" style={{ fontSize: 12 }}>{g.slot === "armor" ? "armour" : g.slot} · {g.tier}</div>
                <div className="label mt-1" style={{ fontSize: 12 }}>+{g.atk} ATK · +{g.def} DEF · +{g.hp} HP</div>
              </button>
            ))}
          </div>
        </section>
      )}

      <section aria-label="Battle arena" className="glass" style={{ padding: "22px 24px" }}>
        <PanelHead icon={<Zap className="w-4 h-4" strokeWidth={1.8} style={{ color: "hsl(var(--ui-accent))" }} />} title="Battle arena" note={`${rpg.essenceBalance} Essence`} />
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Choose an enemy">
          {availableEnemies.map((e, i) => (
            <button key={e.name} type="button" className="seg flex items-center gap-2" aria-pressed={i === selectedEnemyIdx} disabled={battling}
              onClick={() => { setSelectedEnemyIdx(i); setBattleResult(null); setBattleLog([]); }}>
              <PixelSprite grid={ENEMY_SPRITES[e.name]} palette={ENEMY_PALETTES[e.name]} pixelSize={2} /> {e.name} <span className="label" style={{ fontSize: 11 }}>T{e.tier}</span>
            </button>
          ))}
        </div>
        {maxUnlockedTier < 5 && <p className="sub mt-2.5 mb-0" style={{ fontSize: 13 }}>Stronger enemies unlock as you level up (next tier at level {maxUnlockedTier * 3 + 1}).</p>}

        <div className="flex items-center justify-center gap-10 py-6">
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center justify-center" style={{ width: 76, height: 76, borderRadius: 20, background: "hsl(var(--ui-accent2) / 0.14)", border: "1px solid hsl(var(--ui-accent2) / 0.3)" }}>
              <PixelSprite grid={PLAYER_SPRITE} palette={PLAYER_PALETTE} pixelSize={7} />
            </div>
            <span className="sub" style={{ fontSize: 12 }}>You + {state.familiar.name}</span>
          </div>
          <div className="display muted" style={{ fontSize: 36 }}>vs</div>
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center justify-center" style={{ width: 76, height: 76, borderRadius: 20, background: "rgba(255,138,122,0.1)", border: "1px solid rgba(255,138,122,0.3)" }}>
              <PixelSprite grid={ENEMY_SPRITES[enemy.name]} palette={ENEMY_PALETTES[enemy.name]} pixelSize={7} />
            </div>
            <span className="sub" style={{ fontSize: 12 }}>{enemy.name}</span>
          </div>
        </div>

        {activeStreakCount > 0 && (
          <label className="flex items-center justify-center gap-2.5 sub" style={{ fontSize: 14, minHeight: 44 }}>
            <input type="checkbox" checked={useSpecial} onChange={(e) => setUseSpecial(e.target.checked)} style={{ width: 18, height: 18, accentColor: "hsl(var(--ui-accent))" }} />
            Use {state.familiar.name}'s surge (boosted by your {activeStreakCount} active streak{activeStreakCount > 1 ? "s" : ""})
          </label>
        )}

        {battleLog.length > 0 && (
          <div className="well scroll-y mt-3 p-3.5 space-y-1" style={{ maxHeight: 180, fontSize: 13 }} aria-live="polite">
            {battleLog.filter(Boolean).map((line, i) => (
              <div key={i} style={{ color: line.side === "player" ? "#9fd6ff" : line.side === "enemy" ? "#ffb3a8" : "hsl(var(--ui-accent))", fontWeight: line.side === "system" ? 700 : 500 }}>{line.text}</div>
            ))}
            <div ref={logEndRef} />
          </div>
        )}

        {battleResult && (
          <p className="text-center mt-3 mb-0" style={{ fontSize: 15, fontWeight: 700, color: battleResult.won ? "#8ce6c4" : "#ffb3a8" }} role="status">
            {battleResult.won ? "Victory!" : "Defeated. The Essence is spent, nothing more is lost."}
            {battleResult.gear && <span style={{ color: "hsl(var(--ui-accent2))" }}> Found: {battleResult.gear.name}!</span>}
          </p>
        )}

        <div className="mt-4 flex flex-col items-center gap-2">
          <Btn variant="primary" disabled={!canAfford || battling} onClick={handleBattle} icon={<Zap className="w-4 h-4" />}>
            {battling ? "Fighting…" : `Battle · ${battleCost} Essence`}
          </Btn>
          {!canAfford && <p className="sub m-0" style={{ fontSize: 13 }}>Not enough Essence yet. Complete rituals, quests or focus time to earn more.</p>}
        </div>
      </section>

      {rpg.battleHistory.length > 0 && (
        <section aria-label="Battle history" className="glass" style={{ padding: "22px 24px" }}>
          <PanelHead icon={<History className="w-4 h-4" strokeWidth={1.8} style={{ color: "var(--label)" }} />} title="Battle history" />
          <div className="mt-2">
            {rpg.battleHistory.slice(0, 8).map((b: BattleRecord, i: number, arr: BattleRecord[]) => (
              <div key={b.id} className={cx("flex flex-wrap items-center gap-x-3 gap-y-1 py-3", i < arr.length - 1 && "divider")} style={{ fontSize: 14 }}>
                <span style={{ fontWeight: 700, color: b.won ? "#8ce6c4" : "#ffb3a8" }}>{b.won ? "Won" : "Lost"}</span>
                <span>against {b.enemyName}</span>
                {b.gearDropped && <span className="chip" style={{ color: "hsl(var(--ui-accent2))" }}>{b.gearDropped}</span>}
                <span className="sub ml-auto" style={{ fontSize: 13 }}>{new Date(b.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ============================== Layout ============================== */

const NAV_GROUPS: { label: string; links: { id: string; label: string; icon: any }[] }[] = [
  { label: "Study", links: [
    { id: "dashboard", label: "Sanctum", icon: LayoutGrid },
    { id: "habits", label: "Grimoire", icon: Book },
    { id: "tasks", label: "Quests", icon: CheckSquare },
    { id: "focus", label: "Focus", icon: Timer },
  ] },
  { label: "Body & mind", links: [
    { id: "health", label: "Vitality", icon: Activity },
    { id: "fast", label: "Fast", icon: Moon },
    { id: "journal", label: "Journal", icon: Pencil },
  ] },
  { label: "Leisure", links: [
    { id: "lofi", label: "Lofi", icon: Music },
    { id: "ascent", label: "Ascent", icon: Zap },
  ] },
];

/** The ground and its two glows, used behind every screen. */
function Backdrop() {
  return (
    <>
      <div aria-hidden="true" className="sx-glow sx-glow-a" />
      <div aria-hidden="true" className="sx-glow sx-glow-b" />
    </>
  );
}

function ThemeDots({ theme, ring = "#10111b" }: { theme: ThemePalette; ring?: string }) {
  return (
    <span aria-hidden="true" className="flex shrink-0">
      <span style={{ width: 14, height: 14, borderRadius: "50%", background: `hsl(${theme.ui.accent})`, boxShadow: `0 0 0 2px ${ring}` }} />
      <span style={{ width: 14, height: 14, marginLeft: -5, borderRadius: "50%", background: `hsl(${theme.ui.accent2})`, boxShadow: `0 0 0 2px ${ring}` }} />
    </span>
  );
}

/** "Theme · Amethyst" button with a menu of the five themes. */
function ThemeMenu({ activeTheme, onSelect }: { activeTheme: ThemeId; onSelect: (id: ThemeId) => void }) {
  const pop = usePopover();
  const current = THEMES[activeTheme] ?? THEMES.amethyst;
  return (
    <div className="relative" ref={pop.ref}>
      <button type="button" onClick={() => pop.setOpen(!pop.open)} aria-expanded={pop.open} aria-haspopup="true"
        className="btn btn-glass btn-wide" style={{ justifyContent: "flex-start", minHeight: 48, padding: "8px 12px", gap: 10, whiteSpace: "normal", textAlign: "left", lineHeight: 1.25 }}>
        <ThemeDots theme={current} />
        <span>Theme · {current.label}</span>
        <ChevronRight className="w-3.5 h-3.5 ml-auto label" aria-hidden="true" />
      </button>
      {pop.open && (
        <div className="popover absolute bottom-full left-0 z-50 mb-2 p-1.5 grid grid-cols-1 gap-0.5" style={{ width: 280 }} role="menu" aria-label="Themes">
          {(Object.values(THEMES) as ThemePalette[]).map((t) => {
            const on = t.id === activeTheme;
            return (
              <button key={t.id} type="button" role="menuitemradio" aria-checked={on} onClick={() => { onSelect(t.id); pop.setOpen(false); }}
                className="flex items-center gap-3 rounded-xl px-3 text-left hover:bg-white/5" style={{ minHeight: 52 }}>
                <ThemeDots theme={t} ring="hsl(var(--ui-ground))" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate" style={{ fontSize: 14, fontWeight: on ? 700 : 600, color: on ? "#fff" : "var(--text-2)" }}>{t.label}</span>
                  <span className="block truncate sub" style={{ fontSize: 12 }}>{t.description}</span>
                </span>
                {on && <Check className="w-4 h-4 shrink-0" style={{ color: "hsl(var(--ui-accent))" }} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const STATUS_DOT: Record<SyncStatus, string> = { synced: "#4fd1a1", syncing: "#f2c46b", offline: "#ff8a7a" };

/** Website: who's signed in and whether the latest change has reached the account. */
function AccountRow({ status, user, onSignOut }: { status: SyncStatus; user: SupabaseUser; onSignOut: () => void }) {
  const pop = usePopover();
  const email = user?.email ?? "";
  const short = status === "syncing" ? "Saving…" : status === "offline" ? "Offline · will sync" : "Synced";
  const long = status === "syncing" ? "Saving to your account…"
    : status === "offline" ? "Offline. Changes are kept on this device and sent when you reconnect."
    : "Everything is saved to your account.";
  return (
    <div className="relative" ref={pop.ref}>
      <button type="button" onClick={() => pop.setOpen(!pop.open)} aria-expanded={pop.open} aria-label={`${long} Account menu for ${email}`} title={long}
        className="flex w-full items-center gap-2.5 rounded-xl text-left hover:bg-white/5" style={{ padding: "6px 10px", minHeight: 48 }}>
        <span aria-hidden="true" className="flex items-center justify-center shrink-0 display"
          style={{ width: 34, height: 34, borderRadius: "50%", background: "#1b1c2b", border: "1px solid rgba(255,255,255,0.14)", fontSize: 18 }}>
          {(email[0] ?? "S").toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block" style={{ fontSize: 14, fontWeight: 600, color: "#e4e6f1" }}>Signed in</span>
          <span className="flex items-center gap-1.5 sub" style={{ fontSize: 12 }} role="status" aria-live="polite">
            {status === "syncing"
              ? <Loader className="w-3 h-3 animate-spin" style={{ color: STATUS_DOT.syncing }} aria-hidden="true" />
              : <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_DOT[status] }} />}
            {short}
          </span>
        </span>
      </button>
      {pop.open && (
        <div className="popover absolute bottom-full left-0 z-50 mb-2 p-1.5" style={{ width: 260 }}>
          <div className="px-3 py-2.5 divider mb-1">
            <div className="label" style={{ fontSize: 12 }}>Signed in as</div>
            <div className="truncate" style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{email}</div>
            <div className="sub mt-1" style={{ fontSize: 12 }}>{long}</div>
          </div>
          <button type="button" onClick={() => { pop.setOpen(false); onSignOut(); }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 hover:bg-white/5" style={{ minHeight: 44, fontSize: 14, color: "#ffb3a8" }}>
            <LogOut className="w-4 h-4" aria-hidden="true" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/** Desktop app: the study is saved in a file on this computer. */
function LocalSaveRow({ status }: { status: SyncStatus }) {
  const label = status === "syncing" ? "Saving…" : status === "offline" ? "Couldn't save the file" : "Saved on this computer";
  return (
    <div className="flex items-center gap-2.5" style={{ padding: "6px 10px", minHeight: 48 }}
      title={`${label}. Data file: Documents/Sanctum/sanctum-data.json`}>
      <span aria-hidden="true" className="flex items-center justify-center shrink-0" style={{ width: 34, height: 34, borderRadius: "50%", background: "#1b1c2b", border: "1px solid rgba(255,255,255,0.14)" }}>
        <HardDrive className="w-4 h-4 label" />
      </span>
      <span className="min-w-0">
        <span className="block" style={{ fontSize: 14, fontWeight: 600, color: "#e4e6f1" }}>This computer</span>
        <span className="flex items-center gap-1.5 sub truncate" style={{ fontSize: 12 }} role="status" aria-live="polite">
          <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_DOT[status], flexShrink: 0 }} />{label}
        </span>
      </span>
    </div>
  );
}

/* ============================== Sign-in and loading ============================== */

function AuthScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resent, setResent] = useState(false);

  const handleSend = async () => {
    if (!email.trim()) { setError("Please enter your email."); return; }
    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      // A sign-in link can only bring you back to the website; the desktop app signs in with the code.
      options: IS_DESKTOP ? {} : { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    if (sent) setResent(true);
    setSent(true);
  };

  const handleVerify = async () => {
    const token = code.replace(/\s/g, "");
    if (!/^\d{6,10}$/.test(token)) { setError("Enter the code from the email — it's a row of digits."); return; }
    setVerifying(true);
    setError("");
    const { error: err } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: "email" });
    setVerifying(false);
    // On success the session listener in SanctumApp opens the study.
    if (err) setError("That code didn't work. Check it, or send a new email — each code works only once.");
  };

  return (
    <div className="sx-app relative min-h-screen flex items-center justify-center overflow-hidden px-4 py-10">
      <Backdrop />
      <div className="relative z-10 w-full max-w-sm flex flex-col gap-7">
        <div className="flex flex-col items-center text-center">
          <LogoTile size={56} />
          <h1 className="display mt-4" style={{ fontSize: 56 }}>Sanctum</h1>
          <p className="sub mt-2" style={{ fontSize: 15 }}>Your arcane study awaits.</p>
        </div>

        <div className="glass flex flex-col gap-5" style={{ padding: "26px 26px" }}>
          {!sent ? (
            <>
              <div>
                <h2 className="m-0" style={{ fontSize: 18, fontWeight: 700 }}>Sign in</h2>
                <p className="sub mt-1.5 mb-0" style={{ fontSize: 14 }}>
                  {IS_DESKTOP
                    ? "Enter your email and we'll send you a sign-in code — no password needed."
                    : "Enter your email and we'll send you a sign-in link and code — no password needed."}
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <label htmlFor="auth-email" className="sr-only-x">Email</label>
                <input id="auth-email" type="email" aria-label="Email" autoComplete="email" autoFocus className="field" placeholder="you@example.com"
                  value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} onKeyDown={(e) => e.key === "Enter" && handleSend()} />
                {error && <p className="m-0" style={{ color: "#ffb3a8", fontSize: 14 }} role="alert">{error}</p>}
                <Btn variant="primary" wide onClick={handleSend} disabled={loading}>{loading ? "Sending…" : "Send sign-in email"}</Btn>
              </div>
              <p className="label m-0 text-center" style={{ fontSize: 12 }}>First time? An account is created automatically.</p>
            </>
          ) : (
            <>
              <div className="text-center">
                <span aria-hidden="true" className="icon-tile mx-auto" style={{ width: 44, height: 44, borderRadius: 14 }}><Mail className="w-5 h-5" style={{ color: "hsl(var(--ui-accent))" }} /></span>
                <h2 className="mt-3 mb-0" style={{ fontSize: 18, fontWeight: 700 }}>Check your email</h2>
                <p className="sub mt-1.5 mb-0" style={{ fontSize: 14 }}>
                  {IS_DESKTOP ? "We sent a sign-in code to " : "We sent a sign-in link and code to "}
                  <span style={{ color: "hsl(var(--ui-accent))" }}>{email}</span>.
                  {IS_DESKTOP ? " Type the code here." : " Click the link, or type the code here."}
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <label htmlFor="auth-code" className="sr-only-x">Sign-in code</label>
                <input id="auth-code" type="text" inputMode="numeric" autoComplete="one-time-code" aria-label="Sign-in code" maxLength={12} autoFocus
                  className="field text-center tnum" style={{ fontSize: 20, letterSpacing: "0.3em" }} placeholder="Sign-in code"
                  value={code} onChange={(e) => { setCode(e.target.value); setError(""); }} onKeyDown={(e) => e.key === "Enter" && handleVerify()} />
                {error && <p className="m-0" style={{ color: "#ffb3a8", fontSize: 14 }} role="alert">{error}</p>}
                <Btn variant="primary" wide onClick={handleVerify} disabled={verifying}>{verifying ? "Signing in…" : "Sign in"}</Btn>
              </div>
              <div className="flex items-center justify-between gap-3">
                <Btn variant="quiet" size="sm" onClick={() => { setSent(false); setCode(""); setError(""); setResent(false); }}>Use a different email</Btn>
                <Btn variant="quiet" size="sm" onClick={handleSend} disabled={loading}>{loading ? "Sending…" : resent ? "Sent again" : "Send a new email"}</Btn>
              </div>
            </>
          )}
        </div>

        <p className="label text-center m-0" style={{ fontSize: 12 }}>Your study syncs across all your devices.</p>
      </div>
    </div>
  );
}

/** Full-screen message shown while starting up. */
function StudySplash({ message, onSignOut }: { message: string; onSignOut?: () => void }) {
  return (
    <div className="sx-app relative min-h-screen flex items-center justify-center overflow-hidden px-6">
      <Backdrop />
      <div className="relative z-10 flex flex-col items-center gap-4 text-center" style={{ maxWidth: 380 }}>
        <LogoTile size={56} />
        <div role="status" className="sub" style={{ fontSize: 15 }}>{message}</div>
        {onSignOut && <Btn variant="glass" onClick={onSignOut}>Sign out</Btn>}
      </div>
    </div>
  );
}

/* ============================== The app ============================== */

export default function SanctumApp() {
  // ── Auth state ──────────────────────────────────────────────────────────────
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(!IS_DESKTOP);

  useEffect(() => {
    if (IS_DESKTOP) {
      setUser(null);
      setAuthLoading(false);
      return;
    }
    let mounted = true;
    // The website keeps account sign-in and cross-device sync.
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      setAuthLoading(false);
    }).catch(() => {
      if (mounted) setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setUser(session?.user ?? null);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  // ── App state ────────────────────────────────────────────────────────────────
  const [state, setState, syncStatus, ready, flushSync] = useSanctumStore(user);

  const handleSignOut = async () => {
    await flushSync(); // don't leave the last change unsent
    await supabase.auth.signOut();
    setUser(null);
  };
  const [page, setPage] = useState("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [dragonBounce, setDragonBounce] = useState(false);
  const [petted, setPetted] = useState(false);
  const [focusRequest, setFocusRequest] = useState<FocusRequest>(null);
  const mainRef = useRef<HTMLElement>(null);
  const prevCompletionsRef = useRef<{ habits: number; tasksDone: number } | null>(null);
  const theme = THEMES[(state.theme as ThemeId) ?? "amethyst"] ?? THEMES.amethyst;
  const accentHue = hslParts(theme.ui.accent)[0];

  // Trigger a cheer bounce whenever a habit completion or task completion count increases.
  useEffect(() => {
    const habitsCount = state.habitCompletions.length;
    const tasksDoneCount = state.tasks.filter((t: Task) => t.status === "done").length;
    const prev = prevCompletionsRef.current;
    // The first counts after the study opens (or loads from the account) are a baseline, not a celebration.
    if (!ready) return;
    if (prev && (habitsCount > prev.habits || tasksDoneCount > prev.tasksDone)) {
      setDragonBounce(true);
      const timeout = setTimeout(() => setDragonBounce(false), 750);
      prevCompletionsRef.current = { habits: habitsCount, tasksDone: tasksDoneCount };
      return () => clearTimeout(timeout);
    }
    prevCompletionsRef.current = { habits: habitsCount, tasksDone: tasksDoneCount };
  }, [state.habitCompletions, state.tasks, ready]);

  const handlePetFamiliar = useCallback(() => {
    setState((s: any) => ({ ...s, familiar: { ...s.familiar, affection: (s.familiar.affection ?? 0) + 1 } }));
    setPetted(true);
    setTimeout(() => setPetted(false), 1400);
  }, [setState]);

  // Sync Essence + RPG level whenever habit/task/focus data changes, in one batched update.
  useEffect(() => {
    setState((s: any) => {
      const { delta, nextLog } = syncEssence(s);
      if (delta <= 0) return s;
      const newLifetime = (s.rpg?.lifetimeEssence ?? 0) + delta;
      const newLevel = rpgLevelFromEssence(newLifetime);
      return {
        ...s,
        processedEssenceLog: nextLog,
        rpg: {
          ...(s.rpg ?? defaultRpgState()),
          lifetimeEssence: newLifetime,
          essenceBalance: (s.rpg?.essenceBalance ?? 0) + delta,
          level: newLevel,
        },
      };
    });
  }, [state.habitCompletions, state.tasks, state.focusSessions, setState]);

  const goTo = useCallback((next: string) => {
    setPage(next);
    setMobileNavOpen(false);
    mainRef.current?.scrollTo({ top: 0 });
  }, []);
  const startFocus = useCallback((minutes: number) => {
    setFocusRequest({ minutes, nonce: Date.now() });
    goTo("focus");
  }, [goTo]);

  // ── Auth gates ──────────────────────────────────────────────────────────────
  // IMPORTANT: these early returns must come AFTER every hook above, or React
  // throws error #310 (hook count mismatch between renders).
  if (authLoading) return <StudySplash message="Awakening the study…" />;
  if (!IS_DESKTOP && !user) return <AuthScreen />;
  if (!ready) {
    return syncStatus === "offline" ? (
      <StudySplash
        message="Can't reach your saved study yet. Check your internet connection — Sanctum keeps trying."
        onSignOut={handleSignOut}
      />
    ) : (
      <StudySplash message="Opening your study…" />
    );
  }

  const hasActiveFast = state.fastSessions.some((f: FastSession) => f.status === "active");

  const dragonPose: DragonPose = petted
    ? "petted"
    : dragonBounce
    ? "cheer"
    : page === "habits" || page === "journal"
    ? "reading"
    : page === "tasks" || page === "ascent"
    ? "questing"
    : page === "focus"
    ? "focusing"
    : page === "health"
    ? "tending"
    : page === "fast"
    ? (hasActiveFast ? "sleeping" : "idle")
    : "idle";

  const setTheme = (id: ThemeId) => setState((s: any) => ({ ...s, theme: id }));

  const renderPage = () => {
    switch (page) {
      case "habits": return <HabitsPage state={state} setState={setState} />;
      case "tasks": return <TasksPage state={state} setState={setState} />;
      case "focus": return <FocusPage state={state} setState={setState} request={focusRequest} onRequestHandled={() => setFocusRequest(null)} />;
      case "health": return <HealthPage state={state} setState={setState} />;
      case "fast": return <FastingPage state={state} setState={setState} />;
      case "journal": return <JournalPage state={state} setState={setState} />;
      case "lofi": return <LofiPlayer />;
      case "ascent": return <AscentPage state={state} setState={setState} />;
      default: return (
        <DashboardPage state={state} setState={setState} dragonPose={dragonPose} dragonBounce={dragonBounce || petted}
          onPetFamiliar={handlePetFamiliar} onNavigate={goTo} onStartFocus={startFocus} accentHue={accentHue} />
      );
    }
  };

  const account = IS_DESKTOP
    ? <LocalSaveRow status={syncStatus} />
    : user ? <AccountRow status={syncStatus} user={user} onSignOut={handleSignOut} /> : null;

  const navGroups = (onPick: (id: string) => void) => NAV_GROUPS.map((group) => (
    <div key={group.label} className="flex flex-col gap-[3px]">
      <div className="eyebrow" style={{ padding: "0 12px 6px" }}>{group.label}</div>
      {group.links.map((link) => {
        const Icon = link.icon;
        const active = page === link.id;
        return (
          <button key={link.id} type="button" className="nav-btn" aria-current={active ? "page" : undefined} onClick={() => onPick(link.id)}>
            <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.7} aria-hidden="true" />
            {link.label}
            {active && <span aria-hidden="true" className="nav-dot" />}
          </button>
        );
      })}
    </div>
  ));

  return (
    <div className="sx-app relative flex h-screen overflow-hidden md:gap-[18px] md:p-[18px]">
      <style>{`:root {\n${themeCssVars(theme)}\n}`}</style>
      <Backdrop />

      {/* Sidebar (tablet and up) */}
      <aside className="glass relative z-20 hidden md:flex shrink-0 flex-col" style={{ width: 248, padding: "22px 14px 18px", gap: 22 }}>
        <div className="flex items-center gap-3" style={{ padding: "0 6px" }}>
          <LogoTile />
          <div className="display" style={{ fontSize: 28 }}>Sanctum</div>
        </div>
        <nav aria-label="Sanctum sections" className="flex min-h-0 flex-1 flex-col gap-[22px] scroll-y">{navGroups(goTo)}</nav>
        <div className="flex flex-col gap-2.5">
          <ThemeMenu activeTheme={state.theme} onSelect={setTheme} />
          {account}
        </div>
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        {/* Top bar (phones) */}
        <header className="md:hidden relative z-30 m-3 mb-0 glass flex items-center justify-between" style={{ padding: "10px 10px 10px 14px", borderRadius: 18 }}>
          <div className="flex items-center gap-2.5">
            <LogoTile size={34} />
            <span className="display" style={{ fontSize: 24 }}>Sanctum</span>
          </div>
          <Btn variant="quiet" aria-label={mobileNavOpen ? "Close menu" : "Open menu"} aria-expanded={mobileNavOpen}
            icon={mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />} onClick={() => setMobileNavOpen((v) => !v)} />
        </header>
        {mobileNavOpen && (
          <div className="md:hidden relative z-30 mx-3 mt-2 glass flex flex-col gap-5 scroll-y" style={{ padding: "18px 12px", maxHeight: "75vh", borderRadius: 18 }}>
            <nav aria-label="Sanctum sections" className="grid gap-5 sm:grid-cols-3">{navGroups(goTo)}</nav>
            <div className="flex flex-col gap-2.5">
              <ThemeMenu activeTheme={state.theme} onSelect={setTheme} />
              {account}
            </div>
          </div>
        )}

        <main ref={mainRef} className="flex-1 min-h-0 scroll-y">
          <div className="mx-auto w-full px-3 pt-3 pb-28 md:px-1.5 md:pt-0" style={{ maxWidth: 1180 }}>{renderPage()}</div>
        </main>
      </div>

      {page !== "dashboard" && (
        <DragonCorner pose={dragonPose} bounce={dragonBounce || petted} familiar={state.familiar} onPet={handlePetFamiliar} accentHue={accentHue} />
      )}
    </div>
  );
}
