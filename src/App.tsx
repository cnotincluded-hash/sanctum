import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import {
  Trophy, CheckCircle, Brain, BookOpen, Flame, Plus, Book, Check, X, Trash2, Undo2,
  Droplets, Dumbbell, Pencil, Star, Heart, Zap, Sun, Moon, Coffee, Music, Leaf,
  CheckSquare, Play, Square, Pause, RotateCcw, Droplet, Footprints, Smile, Minus,
  LayoutDashboard, Timer, Activity, XCircle, History, Menu, NotebookPen,
} from "lucide-react";

/* ============================== Storage helpers ============================== */

const STORAGE_KEY = "sanctum-state-v1";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.journalEntries) parsed.journalEntries = [];
    if (!parsed.familiar) parsed.familiar = { name: "Ember", color: "#a855f7", affection: 0 };
    if (!parsed.dashboardWidgets) parsed.dashboardWidgets = ["habits", "tasks"];
    if (!parsed.rpg) parsed.rpg = defaultRpgState();
    if (!parsed.processedEssenceLog) parsed.processedEssenceLog = { habits: 0, tasks: 0, focusMs: 0 };
    if (!parsed.theme) parsed.theme = "amethyst";
    return parsed;
  } catch {
    return null;
  }
}
function saveState(state: any) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
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
  },
};


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

function useSanctumStore() {
  const [state, setState] = useState(() => loadState() ?? seedState());

  useEffect(() => {
    saveState(state);
  }, [state]);

  return [state, setState] as const;
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

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5) return { text: "Burning the midnight oil.", sub: "The sanctum is yours alone." };
  if (h < 10) return { text: "Good morning, scholar.", sub: "The day is fresh and awaiting your will." };
  if (h < 13) return { text: "Good day.", sub: "Stay the course — great works take time." };
  if (h < 17) return { text: "Afternoon light.", sub: "Your studies continue, archmage." };
  if (h < 21) return { text: "Good evening.", sub: "The candle burns bright in the study." };
  return { text: "The hour grows late.", sub: "Rest beckons, but there's still time." };
}

/* ============================== Reusable UI bits ============================== */

function Card({ children, className, style, onClick }: any) {
  return (
    <div
      onClick={onClick}
      className={cn("rounded-xl border", className)}
      style={{ borderColor: "hsl(228 25% 16%)", ...style }}
    >
      {children}
    </div>
  );
}
function CardContent({ children, className }: any) {
  return <div className={className}>{children}</div>;
}
function Button({ children, className, style, onClick, disabled, variant, size }: any) {
  const base = "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes: Record<string, string> = { sm: "h-7 px-2.5 text-xs", lg: "h-12 px-6 text-base", default: "h-9 px-4 text-sm" };
  const variants: Record<string, string> = {
    default: "bg-amber-500 text-slate-950 hover:bg-amber-400",
    outline: "border bg-transparent",
    secondary: "bg-slate-700 text-slate-100 hover:bg-slate-600",
    destructive: "bg-red-600 text-white hover:bg-red-500",
    ghost: "bg-transparent hover:bg-white/5",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(base, sizes[size || "default"], variants[variant || "default"], className)}
      style={style}
    >
      {children}
    </button>
  );
}
function Input({ className, style, ...props }: any) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-slate-500",
        className
      )}
      style={{ borderColor: "hsl(228 25% 20%)", color: "inherit", ...style }}
    />
  );
}
function ArcaneDivider({ children, className }: any) {
  return (
    <div className={cn("flex items-center gap-2 uppercase tracking-[0.15em] text-[11px] font-semibold", className)}>
      {children}
      <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, hsl(228 25% 20%), transparent)" }} />
    </div>
  );
}

/* ============================== Dragon Familiar ============================== */

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

function hslShade(hex: string, lighten: number) {
  // crude lighten/darken for a hex color by mixing toward white/black
  const num = parseInt(hex.replace("#", ""), 16);
  let r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
  const mix = (c: number) => Math.max(0, Math.min(255, Math.round(c + (lighten > 0 ? (255 - c) * lighten : c * lighten))));
  r = mix(r); g = mix(g); b = mix(b);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Pure SVG/CSS tiny dragon. `size` in px. `pose` changes posture/eye state. */
function DragonSprite({ pose, size = 56, bounce = false, color = "#a855f7", onPet }: { pose: DragonPose; size?: number; bounce?: boolean; color?: string; onPet?: () => void }) {
  const bodyColor = color;
  const bellyColor = hslShade(color, 0.45);
  const wingColor = hslShade(color, 0.15);
  const eyesClosed = pose === "sleeping" || pose === "focusing";
  const happyEyes = pose === "petted" || pose === "cheer";
  const tilt = pose === "reading" ? -8 : pose === "questing" ? 6 : pose === "petted" ? -4 : 0;

  return (
    <div
      className={cn("relative select-none", bounce && "dragon-bounce", onPet && "cursor-pointer")}
      style={{ width: size, height: size }}
      title={onPet ? "Pet your familiar" : pose}
      onClick={onPet}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        style={{ transform: `rotate(${tilt}deg)`, transition: "transform 0.4s ease" }}
        className={pose === "idle" ? "dragon-float" : pose === "focusing" ? "dragon-breathe" : ""}
      >
        {/* tail */}
        <path d="M 30 78 Q 12 80 14 66 Q 16 76 30 72 Z" fill={bodyColor} />
        {/* wings */}
        <path d="M 38 40 Q 16 28 18 14 Q 34 22 44 38 Z" fill={wingColor} opacity={0.85} className={pose === "cheer" ? "dragon-wing-flap" : ""} />
        <path d="M 62 40 Q 84 28 82 14 Q 66 22 56 38 Z" fill={wingColor} opacity={0.85} className={pose === "cheer" ? "dragon-wing-flap" : ""} />
        {/* body */}
        <ellipse cx="50" cy="62" rx="26" ry="22" fill={bodyColor} />
        {/* belly */}
        <ellipse cx="50" cy="68" rx="15" ry="12" fill={bellyColor} opacity={0.9} />
        {/* head */}
        <circle cx="50" cy="36" r="20" fill={bodyColor} />
        {/* snout */}
        <ellipse cx="50" cy="44" rx="10" ry="7" fill={bellyColor} opacity={0.9} />
        {/* horns */}
        <path d="M 38 22 L 34 10 L 42 20 Z" fill={bellyColor} />
        <path d="M 62 22 L 66 10 L 58 20 Z" fill={bellyColor} />
        {/* eyes */}
        {eyesClosed ? (
          <>
            <path d="M 40 34 Q 44 37 48 34" stroke="#1a1530" strokeWidth="2.2" fill="none" strokeLinecap="round" />
            <path d="M 52 34 Q 56 37 60 34" stroke="#1a1530" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          </>
        ) : happyEyes ? (
          <>
            <path d="M 39 35 Q 43 31 47 35" stroke="#1a1530" strokeWidth="2.4" fill="none" strokeLinecap="round" />
            <path d="M 53 35 Q 57 31 61 35" stroke="#1a1530" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="43" cy="34" r="3.4" fill="#1a1530" />
            <circle cx="57" cy="34" r="3.4" fill="#1a1530" />
            <circle cx="44" cy="33" r="1" fill="white" />
            <circle cx="58" cy="33" r="1" fill="white" />
          </>
        )}
        {/* nostrils */}
        <circle cx="46" cy="46" r="1" fill="#1a1530" opacity={0.6} />
        <circle cx="54" cy="46" r="1" fill="#1a1530" opacity={0.6} />
        {/* spine spikes */}
        <path d="M 50 16 L 53 22 L 47 22 Z" fill={bellyColor} />
        <path d="M 36 46 L 31 49 L 36 52 Z" fill={bellyColor} opacity={0.8} />
        <path d="M 64 46 L 69 49 L 64 52 Z" fill={bellyColor} opacity={0.8} />
        {/* sleeping zzz */}
        {pose === "sleeping" && (
          <text x="68" y="20" fontSize="10" fill={hslShade(color, 0.4)} fontFamily="Georgia, serif" className="dragon-zzz">z</text>
        )}
        {/* book for reading pose */}
        {pose === "reading" && (
          <rect x="38" y="76" width="24" height="4" rx="1" fill={bellyColor} opacity={0.85} />
        )}
        {/* cheer / petted sparkle */}
        {(pose === "cheer" || pose === "petted") && (
          <text x="68" y="22" fontSize="11" fill="hsl(38 88% 62%)" className="dragon-sparkle">{pose === "petted" ? "♥" : "✦"}</text>
        )}
      </svg>
    </div>
  );
}

/** Small persistent corner companion shown on every page. */
function DragonCorner({ pose, bounce, familiar, onPet }: { pose: DragonPose; bounce: boolean; familiar: Familiar; onPet: () => void }) {
  const line = useDragonFlavor(pose);
  return (
    <div className="fixed bottom-4 right-4 z-30 flex items-end gap-2" aria-hidden="true">
      <div
        className="hidden sm:block rounded-lg px-2.5 py-1.5 text-[11px] italic text-slate-300 mb-1 pointer-events-none"
        style={{ background: "hsl(228 36% 10% / 0.85)", border: "1px solid hsl(228 25% 20%)", backdropFilter: "blur(4px)" }}
      >
        {familiar.name}: {line}
      </div>
      <div
        className="rounded-full p-1.5"
        style={{ background: "hsl(228 36% 10% / 0.7)", border: "1px solid hsl(38 88% 52% / 0.2)", boxShadow: "0 0 20px rgba(0,0,0,0.4)" }}
      >
        <DragonSprite pose={pose} size={48} bounce={bounce} color={familiar.color} onPet={onPet} />
      </div>
    </div>
  );
}

/** Larger featured dragon for the dashboard, with naming/color editing and petting. */
function DragonFeature({ pose, bounce, familiar, setState, onPet }: { pose: DragonPose; bounce: boolean; familiar: Familiar; setState: any; onPet: () => void }) {
  const line = useDragonFlavor(pose);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(familiar.name);
  const [petMsg, setPetMsg] = useState<string | null>(null);

  const handlePet = () => {
    onPet();
    if (Math.random() < 0.55) {
      const msg = PET_MESSAGES[Math.floor(Math.random() * PET_MESSAGES.length)];
      setPetMsg(msg);
      setTimeout(() => setPetMsg(null), 2800);
    }
  };

  const saveName = () => {
    const trimmed = nameDraft.trim();
    setState((s: any) => ({ ...s, familiar: { ...s.familiar, name: trimmed || s.familiar.name } }));
    setEditing(false);
  };
  const setColor = (color: string) => {
    setState((s: any) => ({ ...s, familiar: { ...s.familiar, color } }));
  };

  return (
    <div className="flex items-start gap-4 px-2 relative">
      <DragonSprite pose={pose} size={84} bounce={bounce} color={familiar.color} onPet={handlePet} />
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          {editing ? (
            <Input
              autoFocus
              value={nameDraft}
              onChange={(e: any) => setNameDraft(e.target.value)}
              onKeyDown={(e: any) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setNameDraft(familiar.name); setEditing(false); } }}
              onBlur={saveName}
              className="h-7 px-2 text-sm w-32"
              maxLength={20}
            />
          ) : (
            <button onClick={() => setEditing(true)} className="text-xs uppercase tracking-[0.15em] text-slate-500 font-semibold hover:text-amber-400 transition-colors flex items-center gap-1">
              {familiar.name} <Pencil className="w-2.5 h-2.5 opacity-60" />
            </button>
          )}
        </div>
        <div className="text-sm text-slate-300 italic min-h-[1.25rem]">{petMsg ? `"${petMsg}"` : line}</div>
        <div className="flex gap-1.5 mt-2">
          {FAMILIAR_COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)}
              className={cn("w-4 h-4 rounded-full border transition-transform hover:scale-115", familiar.color === c ? "border-white scale-115" : "border-transparent")}
              style={{ background: c, boxShadow: familiar.color === c ? `0 0 6px ${c}` : "none" }} />
          ))}
        </div>
        {familiar.affection > 0 && (
          <div className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1">
            <Heart className="w-2.5 h-2.5 text-pink-400" fill="currentColor" /> {familiar.affection} pets given
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================== Dashboard Page ============================== */

function DashboardPage({ state, setState, dragonPose, dragonBounce, onPetFamiliar }: { state: any; setState: any; dragonPose: DragonPose; dragonBounce: boolean; onPetFamiliar: () => void }) {
  const summary = computeSummary(state);
  const { text: greeting, sub: greetingSub } = getGreeting();
  const xpIntoLevel = summary.xp % 100;

  return (
    <div className="space-y-8 animate-in">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-4xl font-serif font-bold" style={{ color: "hsl(38 88% 62%)", textShadow: "0 0 40px hsl(38 88% 52% / 0.25)" }}>
            {greeting}
          </h1>
          <p className="text-slate-400 italic">{greetingSub}</p>
        </div>
        <DragonFeature pose={dragonPose} bounce={dragonBounce} familiar={state.familiar} setState={setState} onPet={onPetFamiliar} />
      </header>

      <Card
        className="relative overflow-hidden border-amber-500/20"
        style={{ background: "linear-gradient(135deg, hsl(228 38% 9%), hsl(270 30% 11%), hsl(228 38% 9%))" }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{ background: "linear-gradient(90deg, transparent, hsl(38 88% 52% / 0.35), hsl(270 60% 60% / 0.2), transparent)" }}
        />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 0% 0%, hsl(38 88% 52% / 0.10) 0%, transparent 55%)" }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 100% 100%, hsl(270 60% 60% / 0.08) 0%, transparent 50%)" }} />

        <CardContent className="pt-6 pb-5 px-6 relative">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center border border-amber-500/30"
                  style={{ background: "hsl(38 88% 52% / 0.12)", boxShadow: "0 0 24px hsl(38 88% 52% / 0.25)" }}
                >
                  <Trophy className="w-7 h-7 text-amber-400" />
                </div>
                <div
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold flex items-center justify-center"
                  style={{ boxShadow: "0 0 10px hsl(38 88% 52% / 0.6)" }}
                >
                  {summary.level}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-[0.15em] font-semibold mb-0.5 flex items-center gap-1.5">
                  <span className="text-amber-400/60 text-[10px]">✦</span>
                  Level {summary.level} Archmage
                </div>
                <div className="text-3xl font-serif font-bold text-amber-400" style={{ textShadow: "0 0 30px hsl(38 88% 52% / 0.35)" }}>
                  {summary.xp.toLocaleString()} <span className="text-xl text-amber-400/70">XP</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400">{summary.xpToNextLevel} to next level</div>
            </div>
          </div>
          <div className="relative h-1.5 rounded-full bg-amber-500/10 overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full rounded-full"
              style={{ width: `${xpIntoLevel}%`, background: "linear-gradient(90deg, hsl(270 60% 60%), hsl(38 88% 52%))" }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={<BookOpen className="w-4 h-4" />} label="Rituals" value={`${summary.habitsCompletedToday} / ${summary.totalHabits}`} sub="completed today" accentColor="hsl(38 88% 52%)" />
        <StatCard icon={<CheckCircle className="w-4 h-4" />} label="Quests" value={String(summary.tasksCompletedToday)} sub={`done · ${summary.pendingTasks} pending`} accentColor="hsl(270 60% 66%)" />
        <StatCard icon={<Brain className="w-4 h-4" />} label="Focus" value={`${summary.totalFocusMinutesToday} min`} sub="channeled today" accentColor="hsl(210 80% 65%)" />
      </div>

      {summary.currentStreaks.length > 0 && (
        <div>
          <ArcaneDivider className="mb-4 text-slate-500">
            <Flame className="w-3 h-3 text-amber-400" /> Active Streaks
          </ArcaneDivider>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {summary.currentStreaks.map((s) => (
              <Card key={s.habitId} className="border-white/5" style={{ background: "hsl(228 34% 10%)" }}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0" style={{ background: `${s.color}15`, border: `1px solid ${s.color}25` }}>
                    🔥
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{s.habitName}</div>
                    <div className="text-xs text-slate-400">{s.streak} day streak</div>
                  </div>
                  <div className="text-2xl font-serif font-bold text-amber-400 shrink-0" style={{ textShadow: "0 0 12px hsl(38 88% 52% / 0.4)" }}>
                    {s.streak}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <DashboardWidgetGrid state={state} setState={setState} />
    </div>
  );
}

/** Drag-and-drop reorderable widget grid for the dashboard. */
function DashboardWidgetGrid({ state, setState }: { state: any; setState: any }) {
  const widgets: WidgetId[] = state.dashboardWidgets ?? [];
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const available = (Object.keys(WIDGET_REGISTRY) as WidgetId[]).filter((id) => !widgets.includes(id));

  const handleAdd = (id: WidgetId) => {
    setState((s: any) => ({ ...s, dashboardWidgets: [...(s.dashboardWidgets ?? []), id] }));
  };
  const handleRemove = (id: WidgetId) => {
    setState((s: any) => ({ ...s, dashboardWidgets: (s.dashboardWidgets ?? []).filter((w: WidgetId) => w !== id) }));
  };
  const handleDragStart = (index: number) => setDraggedIndex(index);
  const handleDragOver = (index: number) => setOverIndex(index);
  const handleDrop = () => {
    if (draggedIndex === null || overIndex === null || draggedIndex === overIndex) {
      setDraggedIndex(null); setOverIndex(null); return;
    }
    setState((s: any) => {
      const list = [...(s.dashboardWidgets ?? [])];
      const [moved] = list.splice(draggedIndex, 1);
      list.splice(overIndex, 0, moved);
      return { ...s, dashboardWidgets: list };
    });
    setDraggedIndex(null);
    setOverIndex(null);
  };
  const handleDragEnd = () => { setDraggedIndex(null); setOverIndex(null); };

  return (
    <div>
      <ArcaneDivider className="mb-4 text-slate-500">
        <span className="text-amber-400/50 text-[8px]">✦</span> Your Widgets
      </ArcaneDivider>

      {widgets.length === 0 ? (
        <Card className="border-dashed border-white/10 bg-transparent mb-3">
          <CardContent className="p-6 text-center text-sm text-slate-400 italic">
            No widgets yet — add one below to bring parts of Sanctum onto your dashboard.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
          {widgets.map((id, index) => (
            <WidgetShell
              key={id}
              id={id}
              index={index}
              draggedIndex={draggedIndex}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              onRemove={() => handleRemove(id)}
            >
              <WidgetBody id={id} state={state} setState={setState} />
            </WidgetShell>
          ))}
        </div>
      )}

      <AddWidgetMenu available={available} onAdd={handleAdd} />
    </div>
  );
}

function StatCard({ icon, label, value, sub, accentColor }: any) {
  return (
    <Card className="relative overflow-hidden border-white/5" style={{ background: "hsl(228 34% 10%)" }}>
      <div className="absolute top-0 left-0 right-0 h-px pointer-events-none" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}30, transparent)` }} />
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-sm font-medium mb-3" style={{ color: accentColor }}>
          {icon} {label}
        </div>
        <div className="text-2xl font-serif font-bold" style={{ color: accentColor, textShadow: `0 0 20px ${accentColor}40` }}>
          {value}
        </div>
        <p className="text-xs text-slate-400 mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}

/* ============================== Dashboard Widgets ============================== */

const WIDGET_REGISTRY: Record<WidgetId, { label: string; icon: any; color: string }> = {
  habits: { label: "Grimoire", icon: Book, color: "hsl(38 88% 58%)" },
  tasks: { label: "Quests", icon: CheckSquare, color: "hsl(270 60% 72%)" },
  focus: { label: "Focus", icon: Timer, color: "hsl(210 80% 72%)" },
  vitality: { label: "Vitality", icon: Activity, color: "hsl(142 60% 60%)" },
  fast: { label: "Fast", icon: Flame, color: "hsl(38 70% 60%)" },
  journal: { label: "Journal", icon: NotebookPen, color: "hsl(38 70% 70%)" },
  lofi: { label: "Lofi", icon: Music, color: "hsl(270 60% 72%)" },
};

/** Chrome wrapper: drag handle, label, remove button, drag/drop event plumbing. */
function WidgetShell({
  id, index, draggedIndex, onDragStart, onDragOver, onDrop, onDragEnd, onRemove, children,
}: {
  id: WidgetId; index: number; draggedIndex: number | null;
  onDragStart: (i: number) => void; onDragOver: (i: number) => void; onDrop: () => void; onDragEnd: () => void;
  onRemove: () => void; children: ReactNode;
}) {
  const meta = WIDGET_REGISTRY[id];
  const Icon = meta.icon;
  const isDragging = draggedIndex === index;
  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(index); }}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
      onDragEnd={onDragEnd}
      className={cn("transition-opacity", isDragging && "opacity-40")}
    >
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-[0.12em] font-semibold" style={{ color: meta.color }}>
          <span className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 -ml-1 mr-0.5" title="Drag to reorder">
            <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor"><circle cx="2" cy="2" r="1.3" /><circle cx="8" cy="2" r="1.3" /><circle cx="2" cy="7" r="1.3" /><circle cx="8" cy="7" r="1.3" /><circle cx="2" cy="12" r="1.3" /><circle cx="8" cy="12" r="1.3" /></svg>
          </span>
          <Icon className="w-3.5 h-3.5" /> {meta.label}
        </div>
        <button onClick={onRemove} className="text-slate-600 hover:text-red-400 transition-colors p-1 rounded" title="Remove widget">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {children}
    </div>
  );
}

/** Picker for adding a new widget to the dashboard. */
function AddWidgetMenu({ available, onAdd }: { available: WidgetId[]; onAdd: (id: WidgetId) => void }) {
  const [open, setOpen] = useState(false);
  if (available.length === 0) {
    return (
      <p className="text-xs text-slate-500 italic text-center py-2">All widgets are already on your dashboard.</p>
    );
  }
  return (
    <div className="relative">
      <Button variant="outline" size="sm" className="border-dashed border-white/15 text-slate-400 hover:text-amber-400 hover:border-amber-500/30 w-full" onClick={() => setOpen((v) => !v)}>
        <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Widget
      </Button>
      {open && (
        <div className="absolute z-20 mt-1.5 w-full rounded-lg border p-1.5 grid gap-1" style={{ background: "hsl(228 36% 10%)", borderColor: "hsl(228 25% 18%)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
          {available.map((id) => {
            const meta = WIDGET_REGISTRY[id];
            const Icon = meta.icon;
            return (
              <button key={id} onClick={() => { onAdd(id); setOpen(false); }}
                className="flex items-center gap-2 px-2.5 py-2 rounded-md text-sm text-slate-300 hover:bg-white/5 transition-colors text-left">
                <Icon className="w-4 h-4" style={{ color: meta.color }} /> {meta.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* -- Compact widget bodies, each a stripped-down view of its full page -- */

function HabitsWidget({ state, setState }: { state: any; setState: any }) {
  const today = todayStr();
  const completedToday = new Set(state.habitCompletions.filter((c: HabitCompletion) => c.date === today).map((c: HabitCompletion) => c.habitId));
  const handleToggle = (id: number, done: boolean) => {
    setState((s: any) => ({
      ...s,
      habitCompletions: done
        ? s.habitCompletions.filter((c: HabitCompletion) => !(c.habitId === id && c.date === today))
        : [...s.habitCompletions, { habitId: id, date: today }],
    }));
  };
  if (state.habits.length === 0) return <EmptyWidgetNote text="No rituals yet — add some in the Grimoire." />;
  return (
    <Card className="border-white/5" style={{ background: "hsl(228 34% 10%)" }}>
      <CardContent className="p-3 space-y-1.5">
        {state.habits.slice(0, 6).map((h: Habit) => {
          const done = completedToday.has(h.id);
          return (
            <button key={h.id} onClick={() => handleToggle(h.id, done)}
              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors text-left">
              <div className={cn("w-4 h-4 rounded border-2 flex items-center justify-center shrink-0", done ? "border-amber-400 bg-amber-400/80" : "border-amber-500/30")}>
                {done && <Check className="w-2.5 h-2.5 text-slate-950" />}
              </div>
              <span className={cn("text-sm flex-1 truncate", done && "line-through text-slate-500")}>{h.name}</span>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

function TasksWidget({ state, setState }: { state: any; setState: any }) {
  const todo = state.tasks.filter((t: Task) => t.status !== "done").slice(0, 6);
  const toggle = (id: number) => {
    setState((s: any) => ({ ...s, tasks: s.tasks.map((t: Task) => (t.id === id ? { ...t, status: "done", completedAt: new Date().toISOString() } : t)) }));
  };
  if (todo.length === 0) return <EmptyWidgetNote text="No active quests — the realm is at peace." />;
  return (
    <Card className="border-white/5" style={{ background: "hsl(228 34% 10%)" }}>
      <CardContent className="p-3 space-y-1.5">
        {todo.map((t: Task) => {
          const ps = priorityStyle[t.priority as Priority] ?? priorityStyle.medium;
          return (
            <button key={t.id} onClick={() => toggle(t.id)} className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors text-left">
              <div className="w-4 h-4 rounded border-2 border-violet-400/30 shrink-0" />
              <span className="text-sm flex-1 truncate">{t.title}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0 capitalize" style={{ color: ps.color, background: ps.bg }}>{t.priority}</span>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

function FocusWidget({ state }: { state: any }) {
  const todayMin = state.focusSessions
    .filter((s: FocusSession) => new Date(s.startedAt).toDateString() === new Date().toDateString())
    .reduce((sum: number, s: FocusSession) => sum + s.durationMinutes, 0);
  const recent = state.focusSessions.slice(0, 3);
  return (
    <Card className="border-white/5" style={{ background: "hsl(228 34% 10%)" }}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-serif font-bold text-sky-300">{todayMin} min</div>
            <div className="text-xs text-slate-400">channeled today</div>
          </div>
          <Brain className="w-7 h-7 text-sky-400/40" />
        </div>
        {recent.length > 0 && (
          <div className="space-y-1 pt-1 border-t border-white/5">
            {recent.map((s: FocusSession) => (
              <div key={s.id} className="flex items-center justify-between text-xs text-slate-400">
                <span className="truncate italic">{s.label}</span>
                <span className="shrink-0 text-sky-300 font-medium">{s.durationMinutes}m</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function VitalityWidget({ state }: { state: any }) {
  const today = todayStr();
  const todayLogs = state.healthLogs.filter((l: HealthLog) => l.loggedAt.split("T")[0] === today);
  const latestByType: Record<string, number> = {};
  for (const log of todayLogs) latestByType[log.type] = log.value;
  return (
    <Card className="border-white/5" style={{ background: "hsl(228 34% 10%)" }}>
      <CardContent className="p-3 grid grid-cols-5 gap-1.5">
        {METRICS.map((m) => {
          const Icon = m.icon;
          const val = latestByType[m.key];
          return (
            <div key={m.key} className="flex flex-col items-center text-center py-1">
              <Icon className="w-3.5 h-3.5 mb-1" style={{ color: m.color }} />
              <span className="text-xs font-semibold" style={{ color: val !== undefined ? m.color : "#475569" }}>
                {val !== undefined ? formatValue(m.key, val) : "—"}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function FastWidget({ state }: { state: any }) {
  const current = state.fastSessions.find((f: FastSession) => f.status === "active");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!current) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [current]);

  if (!current) return <EmptyWidgetNote text="No active fast. Start one from the Fast page." />;

  const elapsed = now - new Date(current.startedAt).getTime();
  const targetMs = current.targetHours * 3_600_000;
  const pct = Math.min(1, elapsed / targetMs);
  return (
    <Card className="border-white/5" style={{ background: "hsl(228 34% 10%)" }}>
      <CardContent className="p-4 flex items-center gap-4">
        <CircleProgress pct={pct} size={56} strokeWidth={6} color="hsl(38 88% 50%)" />
        <div>
          <div className="text-sm font-semibold">{current.protocol} fast</div>
          <div className="text-xs text-slate-400">{formatHours(elapsed)}h of {current.targetHours}h</div>
        </div>
      </CardContent>
    </Card>
  );
}

function JournalWidget({ state, setState }: { state: any; setState: any }) {
  const today = todayStr();
  const entry: JournalEntry | undefined = state.journalEntries.find((e: JournalEntry) => e.date === today);
  const [text, setText] = useState(entry?.text ?? "");
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = (val: string) => {
    setState((s: any) => {
      const existing = s.journalEntries.find((e: JournalEntry) => e.date === today);
      const updated: JournalEntry = { id: existing?.id ?? nextId(), date: today, text: val, mood: existing?.mood ?? null, updatedAt: new Date().toISOString() };
      const journalEntries = existing ? s.journalEntries.map((e: JournalEntry) => (e.date === today ? updated : e)) : [...s.journalEntries, updated];
      return { ...s, journalEntries };
    });
  };
  const handleChange = (val: string) => {
    setText(val);
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => persist(val), 900);
  };

  return (
    <Card className="border-white/5" style={{ background: "hsl(228 34% 10%)" }}>
      <CardContent className="p-3">
        <textarea
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Quick thought for today..."
          rows={3}
          className="w-full rounded-md border bg-transparent px-2.5 py-2 text-sm outline-none resize-none placeholder:text-slate-500"
          style={{ borderColor: "hsl(228 25% 18%)", color: "inherit" }}
        />
      </CardContent>
    </Card>
  );
}

function EmptyWidgetNote({ text }: { text: string }) {
  return (
    <Card className="border-dashed border-white/10 bg-transparent">
      <CardContent className="p-4 text-center text-xs text-slate-500 italic">{text}</CardContent>
    </Card>
  );
}

function WidgetBody({ id, state, setState }: { id: WidgetId; state: any; setState: any }) {
  switch (id) {
    case "habits": return <HabitsWidget state={state} setState={setState} />;
    case "tasks": return <TasksWidget state={state} setState={setState} />;
    case "focus": return <FocusWidget state={state} />;
    case "vitality": return <VitalityWidget state={state} />;
    case "fast": return <FastWidget state={state} />;
    case "journal": return <JournalWidget state={state} setState={setState} />;
    case "lofi": return <LofiPlayer compact />;
    default: return null;
  }
}

/* ============================== Habits Page (Grimoire) ============================== */

const ICON_MAP: Record<string, any> = {
  brain: Brain, droplets: Droplets, "book-open": BookOpen, dumbbell: Dumbbell,
  pencil: Pencil, star: Star, heart: Heart, zap: Zap, sun: Sun, moon: Moon,
  coffee: Coffee, music: Music, leaf: Leaf,
};
function HabitIcon({ icon, color }: { icon?: string; color?: string }) {
  const bg = color || "#f59e0b";
  const LucideIcon = icon ? ICON_MAP[icon] : null;
  return (
    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: `${bg}18`, border: `1px solid ${bg}28`, boxShadow: `0 0 12px ${bg}15` }}>
      {LucideIcon ? <LucideIcon className="w-4 h-4" style={{ color: bg }} /> : <span className="text-xs" style={{ color: bg }}>✦</span>}
    </div>
  );
}
const HABIT_COLORS = ["#c084fc", "#60a5fa", "#f59e0b", "#34d399", "#f472b6", "#fb923c", "#a78bfa"];
const FREQUENCIES = ["daily", "weekly"] as const;

function HabitsPage({ state, setState }: { state: any; setState: any }) {
  const today = todayStr();
  const completedToday = new Set(state.habitCompletions.filter((c: HabitCompletion) => c.date === today).map((c: HabitCompletion) => c.habitId));

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", frequency: "daily" as "daily" | "weekly", color: HABIT_COLORS[0] });
  const [formError, setFormError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const handleComplete = (id: number) => {
    setState((s: any) => ({ ...s, habitCompletions: [...s.habitCompletions, { habitId: id, date: today }] }));
  };
  const handleUndo = (id: number) => {
    setState((s: any) => ({
      ...s,
      habitCompletions: s.habitCompletions.filter((c: HabitCompletion) => !(c.habitId === id && c.date === today)),
    }));
  };
  const handleCreate = () => {
    if (!form.name.trim()) { setFormError("Name is required."); return; }
    const newHabit: Habit = { id: nextId(), name: form.name.trim(), description: form.description || undefined, frequency: form.frequency, color: form.color, icon: "star" };
    setState((s: any) => ({ ...s, habits: [...s.habits, newHabit] }));
    setShowForm(false);
    setForm({ name: "", description: "", frequency: "daily", color: HABIT_COLORS[0] });
    setFormError("");
  };
  const handleDelete = (id: number) => {
    setState((s: any) => ({
      ...s,
      habits: s.habits.filter((h: Habit) => h.id !== id),
      habitCompletions: s.habitCompletions.filter((c: HabitCompletion) => c.habitId !== id),
    }));
    setConfirmDelete(null);
  };

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-4xl font-serif font-bold" style={{ color: "hsl(38 88% 62%)", textShadow: "0 0 40px hsl(38 88% 52% / 0.2)" }}>Grimoire</h1>
          <p className="text-slate-400 italic mt-1">Your daily rituals and sacred spells.</p>
        </div>
        <Button variant="outline" className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10" onClick={() => setShowForm((v: boolean) => !v)}>
          {showForm ? <X className="w-4 h-4 mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />}
          {showForm ? "Cancel" : "New Ritual"}
        </Button>
      </div>

      {showForm && (
        <Card className="border-amber-500/25 relative overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(228 38% 9%), hsl(270 30% 10%))" }}>
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, hsl(38 88% 52% / 0.4), transparent)" }} />
          <CardContent className="p-5 space-y-4">
            <h2 className="font-serif text-lg font-semibold flex items-center gap-2">
              <span className="text-amber-400/60 text-sm">✦</span> Scribe a new ritual
            </h2>
            <div className="space-y-3">
              <Input placeholder="Ritual name *" value={form.name} onChange={(e: any) => { setForm((f: any) => ({ ...f, name: e.target.value })); setFormError(""); }} />
              <Input placeholder="Description (optional)" value={form.description} onChange={(e: any) => setForm((f: any) => ({ ...f, description: e.target.value }))} />
              <div className="flex gap-2">
                {FREQUENCIES.map((freq) => (
                  <button key={freq} onClick={() => setForm((f: any) => ({ ...f, frequency: freq }))}
                    className={cn("px-3 py-1.5 rounded-lg border text-sm capitalize transition-colors",
                      form.frequency === freq ? "border-amber-500/50 bg-amber-500/12 text-amber-400 font-semibold" : "border-white/10 text-slate-400 hover:border-amber-500/30")}>
                    {freq}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap items-center">
                <span className="text-xs text-slate-400">Hue:</span>
                {HABIT_COLORS.map((color) => (
                  <button key={color} onClick={() => setForm((f: any) => ({ ...f, color }))}
                    className={cn("w-6 h-6 rounded-full border-2 transition-transform hover:scale-110", form.color === color ? "border-white scale-110" : "border-transparent")}
                    style={{ background: color, boxShadow: form.color === color ? `0 0 8px ${color}` : "none" }} />
                ))}
              </div>
              {formError && <p className="text-red-400 text-sm">{formError}</p>}
              <Button onClick={handleCreate} className="w-full">✦ Add Ritual</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {state.habits.length === 0 ? (
        <Card className="border-dashed border-white/10 bg-transparent">
          <CardContent className="flex flex-col items-center justify-center h-48 text-center p-6">
            <Book className="w-10 h-10 text-amber-400/25 mb-4" />
            <p className="text-slate-400 mb-4 italic">Your grimoire is empty. Scribe your first ritual.</p>
            <Button onClick={() => setShowForm(true)}>✦ Add Ritual</Button>
          </CardContent>
        </Card>
      ) : (
        <div>
          <ArcaneDivider className="mb-4 text-slate-500 text-[10px]">
            <span className="text-amber-400/50 text-[8px]">✦</span> Daily Rituals
          </ArcaneDivider>
          <div className="grid gap-2.5">
            {state.habits.map((habit: Habit) => {
              const done = completedToday.has(habit.id);
              const isDeleting = confirmDelete === habit.id;
              const accentColor = habit.color || "#f59e0b";
              return (
                <Card key={habit.id} className={cn("overflow-hidden border-l-4 transition-all duration-300", done && "opacity-65")}
                  style={{ borderLeftColor: accentColor, borderRightColor: "hsl(228 25% 16%)", borderTopColor: "hsl(228 25% 16%)", borderBottomColor: "hsl(228 25% 16%)", background: done ? "hsl(228 34% 9%)" : "linear-gradient(135deg, hsl(228 34% 10%), hsl(228 30% 11%))" }}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <HabitIcon icon={habit.icon} color={habit.color} />
                    <div className="flex-1 min-w-0">
                      <h3 className={cn("font-semibold text-base", done && "line-through text-slate-500")}>{habit.name}</h3>
                      {habit.description && <p className="text-xs text-slate-400 truncate">{habit.description}</p>}
                      <p className="text-xs text-slate-500 capitalize mt-0.5 tracking-wide">{habit.frequency}</p>
                    </div>
                    {isDeleting ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-slate-400 italic">Remove?</span>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(habit.id)}>Yes</Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>No</Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => setConfirmDelete(habit.id)} className="text-slate-500 hover:text-red-400 transition-colors p-1 rounded" title="Delete ritual">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <Button size="sm" variant={done ? "secondary" : "outline"}
                          className={cn("min-w-[90px]", done ? "border-green-500/25 text-green-400 bg-green-500/8" : "border-amber-500/25 text-amber-400 hover:bg-amber-500/10")}
                          onClick={() => (done ? handleUndo(habit.id) : handleComplete(habit.id))}>
                          {done ? (<><Check className="w-3 h-3 mr-1.5 inline" />Done</>) : "Complete"}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== Tasks Page (Quests) ============================== */

const PRIORITIES = ["low", "medium", "high"] as const;
type Priority = (typeof PRIORITIES)[number];
const priorityStyle: Record<Priority, { color: string; bg: string; border: string }> = {
  low: { color: "#60a5fa", bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.25)" },
  medium: { color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.25)" },
  high: { color: "#f87171", bg: "rgba(248,113,113,0.10)", border: "rgba(248,113,113,0.30)" },
};

function TasksPage({ state, setState }: { state: any; setState: any }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", priority: "medium" as Priority, category: "" });
  const [formError, setFormError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const toggleTask = (id: number, currentStatus: string) => {
    const newStatus = currentStatus === "done" ? "todo" : "done";
    setState((s: any) => ({
      ...s,
      tasks: s.tasks.map((t: Task) => (t.id === id ? { ...t, status: newStatus, completedAt: newStatus === "done" ? new Date().toISOString() : undefined } : t)),
    }));
  };
  const handleCreate = () => {
    if (!form.title.trim()) { setFormError("Title is required."); return; }
    const newTask: Task = { id: nextId(), title: form.title.trim(), description: form.description || undefined, status: "todo", priority: form.priority, category: form.category || undefined };
    setState((s: any) => ({ ...s, tasks: [...s.tasks, newTask] }));
    setShowForm(false);
    setForm({ title: "", description: "", priority: "medium", category: "" });
    setFormError("");
  };
  const handleDelete = (id: number) => {
    setState((s: any) => ({ ...s, tasks: s.tasks.filter((t: Task) => t.id !== id) }));
    setConfirmDelete(null);
  };

  const todo = state.tasks.filter((t: Task) => t.status !== "done");
  const done = state.tasks.filter((t: Task) => t.status === "done");

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-4xl font-serif font-bold" style={{ color: "hsl(270 60% 72%)", textShadow: "0 0 40px hsl(270 60% 60% / 0.25)" }}>Quests</h1>
          <p className="text-slate-400 italic mt-1">Active endeavors and bounties.</p>
        </div>
        <Button variant="outline" className="border-violet-400/30 text-violet-300 hover:bg-violet-500/10" onClick={() => setShowForm((v: boolean) => !v)}>
          {showForm ? <X className="w-4 h-4 mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />}
          {showForm ? "Cancel" : "New Quest"}
        </Button>
      </div>

      {showForm && (
        <Card className="border-violet-400/25 relative overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(228 38% 9%), hsl(270 30% 10%))" }}>
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, hsl(270 60% 60% / 0.4), transparent)" }} />
          <CardContent className="p-5 space-y-4">
            <h2 className="font-serif text-lg font-semibold flex items-center gap-2">
              <span className="text-violet-300/60 text-sm">⚔</span> Embark on a new quest
            </h2>
            <div className="space-y-3">
              <Input placeholder="Quest title *" value={form.title} onChange={(e: any) => { setForm((f: any) => ({ ...f, title: e.target.value })); setFormError(""); }} />
              <Input placeholder="Description (optional)" value={form.description} onChange={(e: any) => setForm((f: any) => ({ ...f, description: e.target.value }))} />
              <Input placeholder="Category (e.g. Learning, Wellness)" value={form.category} onChange={(e: any) => setForm((f: any) => ({ ...f, category: e.target.value }))} />
              <div className="flex gap-2">
                {PRIORITIES.map((p) => {
                  const s = priorityStyle[p];
                  return (
                    <button key={p} onClick={() => setForm((f: any) => ({ ...f, priority: p }))}
                      className="px-3 py-1.5 rounded-lg border text-sm capitalize transition-all"
                      style={form.priority === p ? { borderColor: s.border, background: s.bg, color: s.color, fontWeight: 600 } : { borderColor: "hsl(228 25% 20%)", color: "#94a3b8" }}>
                      {p}
                    </button>
                  );
                })}
              </div>
              {formError && <p className="text-red-400 text-sm">{formError}</p>}
              <Button onClick={handleCreate} className="w-full" style={{ background: "hsl(270 60% 55%)", color: "white" }}>⚔ Add Quest</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {state.tasks.length === 0 ? (
        <Card className="border-dashed border-white/10 bg-transparent">
          <CardContent className="flex flex-col items-center justify-center h-48 text-center p-6">
            <CheckSquare className="w-10 h-10 text-violet-400/25 mb-4" />
            <p className="text-slate-400 mb-4 italic">No active quests. The realm is at peace.</p>
            <Button onClick={() => setShowForm(true)}>⚔ Embark on Quest</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {todo.length > 0 && (
            <div>
              <ArcaneDivider className="mb-3 text-slate-500 text-[10px]"><span className="text-violet-300/50 text-[8px]">⚔</span> Active</ArcaneDivider>
              <div className="space-y-2">
                {todo.map((task: Task) => (
                  <TaskRow key={task.id} task={task} onToggle={toggleTask} onDelete={handleDelete} confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete} />
                ))}
              </div>
            </div>
          )}
          {done.length > 0 && (
            <div>
              <ArcaneDivider className="mb-3 text-slate-600 text-[10px]"><span className="text-[8px]">✓</span> Completed</ArcaneDivider>
              <div className="space-y-2">
                {done.map((task: Task) => (
                  <TaskRow key={task.id} task={task} onToggle={toggleTask} onDelete={handleDelete} confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, onToggle, onDelete, confirmDelete, setConfirmDelete }: any) {
  const done = task.status === "done";
  const askingDelete = confirmDelete === task.id;
  const ps = priorityStyle[task.priority as Priority] ?? priorityStyle.medium;
  return (
    <Card className={cn("transition-all duration-200 border-white/5", done && "opacity-55")} style={{ background: "hsl(228 34% 10%)" }}>
      <CardContent className="p-4 flex items-start gap-4">
        <button onClick={() => onToggle(task.id, task.status)}
          className={cn("mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all duration-200",
            done ? "border-amber-400 bg-amber-400/80 text-slate-950" : "border-amber-500/35 hover:border-amber-400/70 hover:bg-amber-500/10")}>
          {done && <Check className="w-3 h-3" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className={cn("font-medium text-sm leading-snug", done && "line-through text-slate-500")}>{task.title}</p>
          {task.description && <p className="text-xs text-slate-400 mt-1 truncate">{task.description}</p>}
          <div className="flex gap-2 mt-2 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full border font-medium capitalize" style={{ color: ps.color, background: ps.bg, borderColor: ps.border }}>{task.priority}</span>
            {task.category && <span className="text-xs px-2 py-0.5 rounded-full border border-white/10 text-slate-400">{task.category}</span>}
          </div>
        </div>
        {askingDelete ? (
          <div className="flex items-center gap-2 shrink-0 self-center">
            <span className="text-xs text-slate-400 italic">Remove?</span>
            <Button size="sm" variant="destructive" onClick={() => onDelete(task.id)}>Yes</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>No</Button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(task.id)} className="self-center text-slate-500 hover:text-red-400 transition-colors p-1 rounded shrink-0" title="Delete quest">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </CardContent>
    </Card>
  );
}

/* ============================== Focus Page ============================== */

const PRESETS = [
  { label: "15 min", minutes: 15 },
  { label: "25 min", minutes: 25 },
  { label: "30 min", minutes: 30 },
  { label: "45 min", minutes: 45 },
  { label: "60 min", minutes: 60 },
];

function FocusPage({ state, setState }: { state: any; setState: any }) {
  const [selectedMinutes, setSelectedMinutes] = useState(25);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [label, setLabel] = useState("Deep Work");
  const [sessionSaved, setSessionSaved] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const customInputRef = useRef<HTMLInputElement>(null);

  const saveSession = useCallback((minutes: number) => {
    if (minutes < 1) return;
    const newSession: FocusSession = { id: nextId(), durationMinutes: minutes, label, startedAt: new Date().toISOString() };
    setState((s: any) => ({ ...s, focusSessions: [newSession, ...s.focusSessions] }));
  }, [label, setState]);

  useEffect(() => {
    if (!isActive && !isPaused) {
      setTimeLeft(selectedMinutes * 60);
      setSessionSaved(false);
    }
  }, [selectedMinutes, isActive, isPaused]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isActive && !isPaused && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    } else if (isActive && timeLeft === 0 && !sessionSaved) {
      setIsActive(false);
      setSessionSaved(true);
      saveSession(selectedMinutes);
    }
    return () => clearInterval(interval);
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

  const isPreset = PRESETS.some((p) => p.minutes === selectedMinutes);
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const progress = ((selectedMinutes * 60 - timeLeft) / (selectedMinutes * 60)) * 100;
  const isFinished = timeLeft === 0;

  return (
    <div className="space-y-8 max-w-xl mx-auto animate-in">
      <div className="text-center">
        <h1 className="text-4xl font-serif font-bold" style={{ color: "hsl(210 80% 72%)", textShadow: "0 0 40px hsl(210 80% 65% / 0.25)" }}>Focus</h1>
        <p className="text-slate-400 italic mt-1">Channel your arcane concentration.</p>
      </div>

      {!isActive && !isPaused && (
        <div className="flex flex-wrap gap-2 justify-center">
          {PRESETS.map((d) => (
            <button key={d.minutes} onClick={() => { setSelectedMinutes(d.minutes); setShowCustom(false); }}
              className={cn("px-4 py-2 rounded-full border text-sm font-medium transition-all duration-200",
                selectedMinutes === d.minutes && isPreset ? "border-amber-400/60 bg-amber-500/15 text-amber-300" : "border-white/10 text-slate-400 hover:border-amber-400/40")}>
              {d.label}
            </button>
          ))}
          {!showCustom ? (
            <button onClick={() => { setShowCustom(true); setCustomInput(String(selectedMinutes)); setTimeout(() => customInputRef.current?.focus(), 50); }}
              className={cn("px-4 py-2 rounded-full border text-sm font-medium transition-all duration-200 flex items-center gap-1.5",
                !isPreset ? "border-amber-400/60 bg-amber-500/15 text-amber-300" : "border-white/10 text-slate-400 hover:border-amber-400/40")}>
              <Pencil className="w-3 h-3" /> {!isPreset ? `${selectedMinutes} min` : "Custom"}
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <Input ref={customInputRef} type="number" value={customInput} onChange={(e: any) => setCustomInput(e.target.value)}
                onKeyDown={(e: any) => { if (e.key === "Enter") applyCustomDuration(); if (e.key === "Escape") { setShowCustom(false); setCustomInput(""); } }}
                className="w-20 h-9 text-center rounded-full" min={1} max={480} placeholder="min" />
              <button onClick={applyCustomDuration} className="w-9 h-9 rounded-full border border-amber-500/50 bg-amber-500/15 text-amber-300 flex items-center justify-center"><Check className="w-4 h-4" /></button>
              <button onClick={() => { setShowCustom(false); setCustomInput(""); }} className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center text-slate-400">✕</button>
            </div>
          )}
        </div>
      )}

      <Card className={cn("overflow-hidden relative transition-all duration-500", isFinished ? "border-green-500/30" : "border-amber-500/15")}
        style={{ background: "linear-gradient(135deg, hsl(228 38% 9%), hsl(270 30% 10%), hsl(228 38% 9%))" }}>
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: isFinished ? "linear-gradient(90deg, transparent, rgba(52,211,153,0.5), transparent)" : "linear-gradient(90deg, transparent, hsl(38 88% 52% / 0.35), hsl(270 60% 60% / 0.2), transparent)" }} />
        <div className="absolute top-0 left-0 w-full h-0.5 bg-white/5">
          <div className="h-full transition-all duration-1000 ease-linear" style={{ width: `${progress}%`, background: isFinished ? "#22c55e" : "linear-gradient(90deg, hsl(270 60% 60%), hsl(38 88% 52%))" }} />
        </div>
        <CardContent className="p-10 flex flex-col items-center gap-7 relative">
          <div className={cn("text-7xl sm:text-8xl font-serif font-light tracking-tight tabular-nums transition-colors duration-500", isPaused && "opacity-50")}
            style={{ color: isFinished ? "hsl(142 70% 65%)" : "hsl(38 88% 62%)", textShadow: isFinished ? "0 0 40px rgba(52,211,153,0.35)" : "0 0 40px hsl(38 88% 52% / 0.3)" }}>
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </div>
          {isFinished && <div className="text-green-400 font-semibold text-sm flex items-center gap-1.5"><span>✦</span> Session complete! Well channeled.</div>}
          <Input value={label} onChange={(e: any) => setLabel(e.target.value)}
            className="text-center text-base bg-transparent border-t-0 border-x-0 border-b rounded-none px-2 max-w-xs italic"
            placeholder="What are you focusing on?" disabled={isActive} />
          <div className="flex items-center gap-3">
            {isFinished ? (
              <Button size="lg" className="rounded-full px-8" onClick={handleReset} style={{ background: "hsl(38 88% 45%)" }}><RotateCcw className="w-4 h-4 mr-2" /> New Session</Button>
            ) : !isActive && !isPaused ? (
              <Button size="lg" className="rounded-full px-12" onClick={handleStart} style={{ background: "linear-gradient(135deg, hsl(38 88% 45%), hsl(38 82% 52%))" }}><Play className="w-4 h-4 mr-2" /> Begin</Button>
            ) : (
              <>
                {isActive ? (
                  <Button size="lg" variant="outline" className="rounded-full border-amber-500/30 text-amber-400 hover:bg-amber-500/10" onClick={handlePause}><Pause className="w-4 h-4 mr-2" /> Pause</Button>
                ) : (
                  <Button size="lg" className="rounded-full px-8" onClick={handleStart} style={{ background: "linear-gradient(135deg, hsl(38 88% 45%), hsl(38 82% 52%))" }}><Play className="w-4 h-4 mr-2" /> Resume</Button>
                )}
                <Button size="lg" variant="secondary" className="rounded-full" onClick={handleStop}><Square className="w-4 h-4 mr-2" /> Stop</Button>
              </>
            )}
          </div>
          {isPaused && <p className="text-xs text-slate-400 italic">Paused — the flame waits</p>}
        </CardContent>
      </Card>

      {state.focusSessions.length > 0 && (
        <div>
          <ArcaneDivider className="mb-3 text-slate-500 text-[10px]"><span className="text-amber-400/50 text-[8px]">✦</span> Recent Sessions</ArcaneDivider>
          <div className="space-y-2">
            {state.focusSessions.slice(0, 6).map((session: FocusSession) => (
              <Card key={session.id} className="border-white/5" style={{ background: "hsl(228 34% 10%)" }}>
                <CardContent className="p-3.5 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate italic">{session.label}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{new Date(session.startedAt).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</div>
                  </div>
                  <div className="font-bold shrink-0 text-amber-400">{session.durationMinutes} min</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== Health Page (Vitality) ============================== */

type MetricKey = "water" | "sleep" | "steps" | "mood" | "exercise";
const METRICS: { key: MetricKey; label: string; icon: any; unit: string; color: string; step: number; min: number; max: number }[] = [
  { key: "water", label: "Water", icon: Droplet, unit: "cups", color: "#60a5fa", step: 1, min: 0, max: 20 },
  { key: "sleep", label: "Sleep", icon: Moon, unit: "hrs", color: "#a78bfa", step: 0.5, min: 0, max: 16 },
  { key: "steps", label: "Steps", icon: Footprints, unit: "k", color: "#34d399", step: 1000, min: 0, max: 50000 },
  { key: "mood", label: "Mood", icon: Smile, unit: "/5", color: "#f59e0b", step: 1, min: 1, max: 5 },
  { key: "exercise", label: "Exercise", icon: Dumbbell, unit: "min", color: "#fb923c", step: 5, min: 0, max: 300 },
];
function formatValue(key: MetricKey, v: number) {
  if (key === "steps") return v >= 1000 ? (v / 1000).toFixed(1) : String(v);
  if (key === "sleep" || key === "exercise") return v % 1 === 0 ? String(v) : v.toFixed(1);
  return String(v);
}

function HealthPage({ state, setState }: { state: any; setState: any }) {
  const today = todayStr();
  const todayLogs = state.healthLogs.filter((l: HealthLog) => l.loggedAt.split("T")[0] === today);
  const latestByType: Record<string, number> = {};
  for (const log of todayLogs) latestByType[log.type] = log.value;

  const [activeKey, setActiveKey] = useState<MetricKey | null>(null);
  const [inputVal, setInputVal] = useState<number>(0);
  const [saved, setSaved] = useState<Set<MetricKey>>(new Set());

  const openLog = (key: MetricKey) => {
    const m = METRICS.find((m) => m.key === key)!;
    setInputVal(latestByType[key] ?? m.step);
    setActiveKey(key);
  };
  const handleLog = () => {
    if (!activeKey) return;
    const newLog: HealthLog = { id: nextId(), type: activeKey, value: inputVal, unit: activeKey, loggedAt: new Date().toISOString() };
    setState((s: any) => ({ ...s, healthLogs: [...s.healthLogs, newLog] }));
    setSaved((prev) => new Set([...prev, activeKey]));
    setTimeout(() => setSaved((prev) => { const s = new Set(prev); s.delete(activeKey!); return s; }), 2000);
    setActiveKey(null);
  };

  return (
    <div className="space-y-8 animate-in">
      <div>
        <h1 className="text-4xl font-serif font-bold" style={{ color: "hsl(142 60% 60%)", textShadow: "0 0 40px hsl(142 60% 50% / 0.2)" }}>Vitality</h1>
        <p className="text-slate-400 italic mt-1">Tend to your physical and spiritual vessels.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {METRICS.map((m) => {
          const Icon = m.icon;
          const val = latestByType[m.key] ?? 0;
          const isActive = activeKey === m.key;
          const justSaved = saved.has(m.key);
          return (
            <div key={m.key} className="space-y-2">
              <Card onClick={() => !isActive && openLog(m.key)} className="cursor-pointer transition-all duration-200 border-white/5"
                style={{ background: "hsl(228 34% 10%)", ...(isActive ? { borderColor: m.color + "50" } : {}), ...(justSaved ? { borderColor: "rgba(52,211,153,0.4)" } : {}) }}>
                <CardContent className="p-5 flex flex-col items-center text-center">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: m.color + "18", border: `1px solid ${m.color}28` }}>
                    <Icon className="w-5 h-5" style={{ color: m.color }} />
                  </div>
                  <div className="text-2xl font-serif font-bold mb-0.5" style={{ color: m.color, textShadow: `0 0 16px ${m.color}40` }}>
                    {formatValue(m.key, val)}<span className="text-xs font-normal text-slate-400 ml-1">{m.unit}</span>
                  </div>
                  <div className="text-xs text-slate-400 uppercase tracking-wide font-medium">{m.label}</div>
                  {justSaved && <div className="mt-2 text-green-400 text-xs font-semibold flex items-center gap-1"><Check className="w-3 h-3" /> Logged!</div>}
                </CardContent>
              </Card>
              {isActive && (
                <Card className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(228 38% 9%), hsl(270 30% 10%))", borderColor: m.color + "35" }}>
                  <CardContent className="p-4 space-y-3">
                    <p className="text-sm font-medium text-center" style={{ color: m.color }}>Log {m.label}</p>
                    <div className="flex items-center gap-2 justify-center">
                      <Button size="icon" variant="outline" className="h-9 w-9 rounded-full border-white/10" onClick={() => setInputVal((v) => Math.max(m.min, +(v - m.step).toFixed(2)))}><Minus className="w-4 h-4" /></Button>
                      <Input type="number" value={inputVal} onChange={(e: any) => setInputVal(Number(e.target.value))} className="w-20 text-center font-bold text-lg h-9" min={m.min} max={m.max} step={m.step} />
                      <Button size="icon" variant="outline" className="h-9 w-9 rounded-full border-white/10" onClick={() => setInputVal((v) => Math.min(m.max, +(v + m.step).toFixed(2)))}><Plus className="w-4 h-4" /></Button>
                    </div>
                    {m.key === "mood" && (
                      <div className="flex justify-center gap-1.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button key={n} onClick={() => setInputVal(n)} className={cn("w-8 h-8 rounded-full text-sm transition-all", inputVal === n ? "scale-125 ring-1 ring-amber-400/40" : "hover:scale-110 hover:bg-amber-500/10")}>
                            {["😞", "😕", "😐", "🙂", "😄"][n - 1]}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setActiveKey(null)} className="flex-1">Cancel</Button>
                      <Button size="sm" onClick={handleLog} className="flex-1 border-amber-500/30 text-amber-400 hover:bg-amber-500/10" variant="outline">✦ Log</Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          );
        })}
      </div>

      <Card className="border-white/5" style={{ background: "hsl(228 34% 9%)" }}>
        <CardContent className="p-5">
          <p className="text-sm text-slate-400 text-center italic">✦ Tap any vessel above to log your daily measures. Values accumulate throughout the day.</p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ============================== Fasting Page ============================== */

const PROTOCOLS = [
  { id: "16:8", label: "16 : 8", hours: 16, desc: "Fast 16h, eat in 8h window" },
  { id: "18:6", label: "18 : 6", hours: 18, desc: "Fast 18h, eat in 6h window" },
  { id: "20:4", label: "20 : 4", hours: 20, desc: "Fast 20h, eat in 4h window" },
  { id: "24h", label: "24h", hours: 24, desc: "Full day fast" },
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
function CircleProgress({ pct, size = 220, strokeWidth = 12, color = "hsl(38 88% 42%)" }: any) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(pct, 1));
  const cx = size / 2;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(245,158,11,0.1)" strokeWidth={strokeWidth} />
      <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000 ease-linear" />
    </svg>
  );
}

function FastingPage({ state, setState }: { state: any; setState: any }) {
  const currentFast = state.fastSessions.find((f: FastSession) => f.status === "active");
  const history = state.fastSessions.filter((f: FastSession) => f.status !== "active").sort((a: FastSession, b: FastSession) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  const [selectedProtocol, setSelectedProtocol] = useState<ProtocolId>("16:8");
  const [customHours, setCustomHours] = useState(20);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleStart = () => {
    const proto = PROTOCOLS.find((p) => p.id === selectedProtocol)!;
    const hours = selectedProtocol === "custom" ? customHours : proto.hours;
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
  const ringColor = isComplete ? "hsl(142 60% 45%)" : pct > 0.75 ? "hsl(38 88% 42%)" : "hsl(38 88% 52%)";

  return (
    <div className="space-y-8 animate-in">
      <header>
        <h1 className="text-4xl font-serif font-bold flex items-center gap-2 text-amber-400">
          <Moon className="w-8 h-8" /> Fast
        </h1>
        <p className="text-slate-400 italic mt-1">Clarity through restraint.</p>
      </header>

      {currentFast ? (
        <div className="space-y-6">
          <Card className="relative overflow-hidden border-amber-500/20" style={{ background: "linear-gradient(135deg, hsl(228 36% 10%), hsl(228 30% 9%), hsl(270 25% 10%))" }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 0%, hsl(38 88% 52% / 0.08) 0%, transparent 65%)" }} />
            <CardContent className="p-8 flex flex-col items-center text-center relative">
              <div className="relative mb-4">
                <CircleProgress pct={pct} color={ringColor} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {isComplete ? <CheckCircle className="w-8 h-8 text-green-500 mb-1" /> : <Flame className="w-8 h-8 mb-1 text-amber-400" />}
                  <div className="text-3xl font-serif font-bold tabular-nums">{formatDuration(elapsed)}</div>
                  <div className="text-xs text-slate-400 mt-1">elapsed</div>
                </div>
              </div>
              <div className="mt-2 space-y-1 text-sm text-slate-400">
                <div><span className="font-semibold text-white">{currentFast.protocol}</span> protocol · {currentFast.targetHours}h target</div>
                {isComplete ? <div className="text-green-500 font-semibold">✓ Goal reached!</div> : <div>{formatDuration(remainingMs)} remaining</div>}
                <div className="text-xs">Started {new Date(currentFast.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button size="lg" className="rounded-full px-8 bg-green-600 hover:bg-green-500 text-white" onClick={() => handleEnd("completed")}><CheckCircle className="w-4 h-4 mr-2" /> Complete</Button>
                <Button size="lg" variant="outline" className="rounded-full border-red-500/40 text-red-400 hover:bg-red-500/10" onClick={() => handleEnd("broken")}><XCircle className="w-4 h-4 mr-2" /> Break</Button>
              </div>
            </CardContent>
          </Card>
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-white/5" style={{ background: "hsl(228 34% 10%)" }}><CardContent className="p-4 text-center"><div className="text-2xl font-serif font-bold">{formatHours(elapsed)}h</div><div className="text-xs text-slate-400 mt-1">Elapsed</div></CardContent></Card>
            <Card className="border-white/5" style={{ background: "hsl(228 34% 10%)" }}><CardContent className="p-4 text-center"><div className="text-2xl font-serif font-bold">{Math.round(pct * 100)}%</div><div className="text-xs text-slate-400 mt-1">Complete</div></CardContent></Card>
            <Card className="border-white/5" style={{ background: "hsl(228 34% 10%)" }}><CardContent className="p-4 text-center"><div className="text-2xl font-serif font-bold">{formatHours(remainingMs)}h</div><div className="text-xs text-slate-400 mt-1">Remaining</div></CardContent></Card>
          </div>
        </div>
      ) : (
        <Card className="border-amber-500/15" style={{ background: "hsl(228 34% 10%)" }}>
          <CardContent className="p-7 space-y-6">
            <div>
              <h2 className="font-serif text-xl font-semibold mb-1">Begin a fast</h2>
              <p className="text-sm text-slate-400">Choose your protocol and begin your fasting window.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {PROTOCOLS.map((p) => (
                <button key={p.id} onClick={() => setSelectedProtocol(p.id)}
                  className={cn("rounded-xl border-2 p-4 text-left transition-all duration-200 hover:border-amber-500/40 hover:bg-amber-500/5",
                    selectedProtocol === p.id ? "border-amber-500 bg-amber-500/10" : "border-white/10 bg-white/[0.02]")}>
                  <div className="font-serif font-bold text-lg leading-tight">{p.label}</div>
                  <div className="text-xs text-slate-400 mt-1 leading-snug">{p.desc}</div>
                </button>
              ))}
            </div>
            {selectedProtocol === "custom" && (
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-slate-400 whitespace-nowrap">Target hours:</label>
                <input type="number" min={1} max={72} value={customHours} onChange={(e) => setCustomHours(Number(e.target.value))}
                  className="w-24 px-3 py-2 rounded-lg border border-white/10 bg-transparent text-center font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
              </div>
            )}
            <Button size="lg" className="w-full rounded-full text-base font-semibold" onClick={handleStart}><Moon className="w-5 h-5 mr-2" /> Start Fast</Button>
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <div>
          <h2 className="font-serif text-xl font-semibold mb-3 flex items-center gap-2"><History className="w-5 h-5 text-slate-400" /> Past Fasts</h2>
          <div className="space-y-2">
            {history.slice(0, 8).map((f: FastSession) => {
              const dur = f.endedAt ? new Date(f.endedAt).getTime() - new Date(f.startedAt).getTime() : 0;
              const achieved = dur / 3_600_000;
              const successPct = Math.round((achieved / f.targetHours) * 100);
              return (
                <Card key={f.id} className="border-white/5" style={{ background: "hsl(228 34% 9%)" }}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", f.status === "completed" ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-400")}>
                      {f.status === "completed" ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{f.protocol} fast</div>
                      <div className="text-xs text-slate-400">{new Date(f.startedAt).toLocaleDateString([], { month: "short", day: "numeric" })} · {achieved.toFixed(1)}h of {f.targetHours}h</div>
                    </div>
                    <div className={cn("text-sm font-bold shrink-0", f.status === "completed" ? "text-green-500" : "text-slate-400")}>{Math.min(successPct, 100)}%</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== Journal Page ============================== */

const MOOD_EMOJI = ["😞", "😕", "😐", "🙂", "😄"];

function JournalPage({ state, setState }: { state: any; setState: any }) {
  const today = todayStr();
  const todayEntry: JournalEntry | undefined = state.journalEntries.find((e: JournalEntry) => e.date === today);

  const [text, setText] = useState(todayEntry?.text ?? "");
  const [mood, setMood] = useState<number | null>(todayEntry?.mood ?? null);
  const [savedFlash, setSavedFlash] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setText(todayEntry?.text ?? "");
    setMood(todayEntry?.mood ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  const persist = useCallback((nextText: string, nextMood: number | null) => {
    setState((s: any) => {
      const existing = s.journalEntries.find((e: JournalEntry) => e.date === today);
      const entry: JournalEntry = {
        id: existing?.id ?? nextId(),
        date: today,
        text: nextText,
        mood: nextMood,
        updatedAt: new Date().toISOString(),
      };
      const journalEntries = existing
        ? s.journalEntries.map((e: JournalEntry) => (e.date === today ? entry : e))
        : [...s.journalEntries, entry];

      // Mirror mood into health logs so it ties into the Vitality mood metric.
      let healthLogs = s.healthLogs;
      if (nextMood !== null) {
        const newLog: HealthLog = { id: nextId(), type: "mood", value: nextMood, unit: "mood", loggedAt: new Date().toISOString() };
        healthLogs = [...s.healthLogs, newLog];
      }
      return { ...s, journalEntries, healthLogs };
    });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }, [setState, today]);

  const handleTextChange = (val: string) => {
    setText(val);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => persist(val, mood), 900);
  };
  const handleMoodSelect = (val: number) => {
    const next = mood === val ? null : val;
    setMood(next);
    persist(text, next);
  };

  const pastEntries = state.journalEntries
    .filter((e: JournalEntry) => e.date !== today)
    .sort((a: JournalEntry, b: JournalEntry) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-8 animate-in">
      <div>
        <h1 className="text-4xl font-serif font-bold flex items-center gap-2" style={{ color: "hsl(38 70% 70%)", textShadow: "0 0 40px hsl(38 70% 60% / 0.2)" }}>
          <Pencil className="w-7 h-7" /> Journal
        </h1>
        <p className="text-slate-400 italic mt-1">A page for today's thoughts.</p>
      </div>

      <Card className="border-amber-500/15 relative overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(228 38% 9%), hsl(270 30% 10%))" }}>
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, hsl(38 88% 52% / 0.35), transparent)" }} />
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold">
              {new Date(today + "T00:00:00").toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
            </h2>
            {savedFlash && <span className="text-xs text-green-400 flex items-center gap-1"><Check className="w-3 h-3" /> Saved</span>}
          </div>

          <div>
            <p className="text-xs text-slate-400 mb-2 uppercase tracking-wide">How are you feeling?</p>
            <div className="flex gap-2">
              {MOOD_EMOJI.map((emoji, i) => {
                const val = i + 1;
                const selected = mood === val;
                return (
                  <button key={val} onClick={() => handleMoodSelect(val)}
                    className={cn("w-10 h-10 rounded-full text-lg flex items-center justify-center transition-all", selected ? "scale-125 ring-2 ring-amber-400/50 bg-amber-500/10" : "hover:scale-110 hover:bg-white/5 opacity-70")}>
                    {emoji}
                  </button>
                );
              })}
            </div>
          </div>

          <textarea
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="What happened today? What's on your mind?"
            rows={8}
            className="w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none resize-none placeholder:text-slate-500"
            style={{ borderColor: "hsl(228 25% 20%)", color: "inherit", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
          />
          <p className="text-xs text-slate-500 italic">Saves automatically as you write.</p>
        </CardContent>
      </Card>

      {pastEntries.length > 0 && (
        <div>
          <ArcaneDivider className="mb-3 text-slate-500 text-[10px]"><span className="text-amber-400/50 text-[8px]">✦</span> Past Entries</ArcaneDivider>
          <div className="space-y-2">
            {pastEntries.slice(0, 14).map((entry: JournalEntry) => (
              <Card key={entry.id} className="border-white/5" style={{ background: "hsl(228 34% 10%)" }}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium">
                      {new Date(entry.date + "T00:00:00").toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                    </span>
                    {entry.mood && <span className="text-base">{MOOD_EMOJI[entry.mood - 1]}</span>}
                  </div>
                  <p className="text-sm text-slate-400 line-clamp-3 whitespace-pre-wrap">{entry.text || <span className="italic text-slate-600">No notes — mood only.</span>}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== Lofi Player ============================== */

const LOFI_STATIONS = [
  { id: "X4VbdwhkE10", label: "lofi hip hop radio — beats to relax/study to", by: "Lofi Girl" },
  { id: "JD-kMIpDfnY", label: "lofi hip hop radio — beats to sleep/chill to", by: "Lofi Girl" },
  { id: "4xDzrJKXOOY", label: "synthwave radio — beats to chill/game to", by: "Lofi Girl" },
  { id: "E2vONfzoyRI", label: "jazz lofi radio — beats to chill/study to", by: "Lofi Girl" },
  { id: "b4g8Uz7KP1A", label: "Lo-Fi Girl LIVE — cozy lofi hip hop 24/7", by: "Lo-Fi Girl LIVE" },
];


function LofiPlayer({ compact = false }: { compact?: boolean }) {
  const [stationIdx, setStationIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const station = LOFI_STATIONS[stationIdx];
  // mute=0 is blocked by most browsers' autoplay policy unless muted; start muted, user unmutes via the player's own controls.
  const src = `https://www.youtube-nocookie.com/embed/${station.id}?autoplay=1&mute=1`;
  const watchUrl = `https://www.youtube.com/watch?v=${station.id}`;

  return (
    <Card className="border-violet-400/15 relative overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(228 38% 9%), hsl(270 30% 10%))" }}>
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, hsl(270 60% 60% / 0.35), transparent)" }} />
      <CardContent className={cn("space-y-3", compact ? "p-3" : "p-5")}>
        <div className="flex items-center justify-between gap-2">
          <h3 className={cn("font-serif font-semibold flex items-center gap-2", compact ? "text-sm" : "text-lg")}>
            <Music className="w-4 h-4 text-violet-300" /> Lofi Study Stream
          </h3>
          {!playing ? (
            <Button size="sm" onClick={() => setPlaying(true)} style={{ background: "hsl(270 55% 50%)", color: "white" }}>
              <Play className="w-3.5 h-3.5 mr-1.5" /> Play
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setPlaying(false)}>
              <Pause className="w-3.5 h-3.5 mr-1.5" /> Stop
            </Button>
          )}
        </div>

        {playing && (
          <div className="rounded-lg overflow-hidden border border-white/10" style={{ aspectRatio: "16/9" }}>
            <iframe
              key={station.id}
              src={src}
              title={station.label}
              allow="autoplay; encrypted-media"
              allowFullScreen
              className="w-full h-full"
              style={{ border: 0 }}
            />
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {LOFI_STATIONS.map((s, i) => (
            <button key={s.id} onClick={() => setStationIdx(i)}
              className={cn("px-2.5 py-1 rounded-full border text-[11px] transition-colors", i === stationIdx ? "border-violet-400/50 bg-violet-500/15 text-violet-300" : "border-white/10 text-slate-400 hover:border-violet-400/30")}>
              {s.label.split(" — ")[0]}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-slate-500 italic">Streamed live via YouTube · curated by {station.by}</p>
          <a href={watchUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-violet-300 hover:text-violet-200 underline shrink-0">
            Open in YouTube ↗
          </a>
        </div>
        <p className="text-[10px] text-slate-600 italic">
          Starts muted (browser autoplay policy) — use the player's own volume control to unmute. If the embed doesn't
          load, use the YouTube link above.
        </p>
      </CardContent>
    </Card>
  );
}

/* ============================== Ascent (RPG) Page ============================== */

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
  const slotLabel = slot === "weapon" ? "Weapon" : slot === "armor" ? "Armor" : "Trinket";
  return (
    <div className="rounded-lg border p-2.5" style={{ borderColor: gear ? `${GEAR_TIER_COLOR[gear.tier]}40` : "hsl(228 25% 18%)", background: "hsl(228 34% 9%)" }}>
      <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">{slotLabel}</div>
      {gear ? (
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-semibold truncate" style={{ color: GEAR_TIER_COLOR[gear.tier] }}>{gear.name}</div>
            <div className="text-[10px] text-slate-500">+{gear.atk} ATK · +{gear.def} DEF · +{gear.hp} HP</div>
          </div>
          {onUnequip && <button onClick={onUnequip} className="text-slate-600 hover:text-red-400 shrink-0"><X className="w-3 h-3" /></button>}
        </div>
      ) : (
        <div className="text-xs text-slate-600 italic">Empty</div>
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
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [battleLog]);

  const battleTokenRef = useRef(0);

  const handleBattle = () => {
    if (!canAfford || battling) return;
    setBattling(true);
    setBattleResult(null);
    setBattleLog([]);

    const { won, log, remainingHp } = simulateBattle(stats, familiarBonus, enemy, useSpecial && activeStreakCount > 0);
    const essenceGained = won ? 20 + enemy.tier * 12 : 0;
    const gearDropped = won && Math.random() < 0.6 ? rollGear(enemy.tier) : undefined;

    // Token guards against overlapping reveal loops if a battle is somehow triggered twice.
    const myToken = ++battleTokenRef.current;

    // Reveal log lines progressively for a sense of motion.
    let i = 0;
    const reveal = () => {
      if (battleTokenRef.current !== myToken) return; // a newer battle started; abandon this reveal
      if (i >= log.length) return; // safety: nothing left to reveal
      setBattleLog((prev) => [...prev, log[i]]);
      i++;
      if (i < log.length) {
        setTimeout(reveal, 380);
      } else {
        setState((s: any) => {
          const newInventory = gearDropped ? [...s.rpg.inventory, gearDropped] : s.rpg.inventory;
          const record: BattleRecord = {
            id: nextId(),
            enemyName: enemy.name,
            enemyTier: enemy.tier,
            won,
            essenceSpent: battleCost,
            essenceGained,
            gearDropped: gearDropped?.name,
            at: new Date().toISOString(),
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

  const handleEquip = (gear: Gear) => {
    setState((s: any) => ({ ...s, rpg: { ...s.rpg, equipped: { ...s.rpg.equipped, [gear.slot]: gear } } }));
  };
  const handleUnequip = (slot: GearSlot) => {
    setState((s: any) => ({ ...s, rpg: { ...s.rpg, equipped: { ...s.rpg.equipped, [slot]: null } } }));
  };

  return (
    <div className="space-y-8 animate-in">
      <div>
        <h1 className="text-4xl font-serif font-bold flex items-center gap-2" style={{ color: "hsl(270 60% 72%)", textShadow: "0 0 40px hsl(270 60% 60% / 0.25)" }}>
          <Zap className="w-7 h-7" /> The Ascent
        </h1>
        <p className="text-slate-400 italic mt-1">Your deeds in the waking world echo here.</p>
      </div>

      {/* Character + Essence panel */}
      <Card className="relative overflow-hidden border-violet-400/20" style={{ background: "linear-gradient(135deg, hsl(228 38% 9%), hsl(270 30% 11%), hsl(228 38% 9%))" }}>
        <div className="absolute top-0 left-0 right-0 h-px pointer-events-none" style={{ background: "linear-gradient(90deg, transparent, hsl(270 60% 60% / 0.4), transparent)" }} />
        <CardContent className="p-6 relative">
          <div className="flex flex-wrap items-start gap-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl flex items-center justify-center shrink-0" style={{ background: "hsl(270 50% 16%)", border: "1px solid hsl(270 60% 50% / 0.3)" }}>
                <PixelSprite grid={PLAYER_SPRITE} palette={PLAYER_PALETTE} pixelSize={8} />
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.15em] text-slate-400 font-semibold mb-0.5">Level {rpg.level} Adventurer</div>
                <div className="text-2xl font-serif font-bold text-violet-300">{rpg.lifetimeEssence.toLocaleString()} <span className="text-base text-violet-300/60">Lifetime Essence</span></div>
                <div className="text-sm text-amber-300 font-medium mt-0.5">{rpg.essenceBalance.toLocaleString()} Essence available</div>
              </div>
            </div>

            <div className="flex-1 min-w-[180px]">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Level progress</span><span>{essenceIntoLevel} / {ESSENCE_PER_LEVEL}</span>
              </div>
              <div className="relative h-1.5 rounded-full bg-violet-500/10 overflow-hidden">
                <div className="absolute top-0 left-0 h-full rounded-full" style={{ width: `${essenceIntoLevel}%`, background: "linear-gradient(90deg, hsl(270 60% 55%), hsl(38 88% 52%))" }} />
              </div>
              <div className="grid grid-cols-4 gap-2 mt-4">
                <StatPip label="HP" value={stats.hp} color="#34d399" />
                <StatPip label="ATK" value={stats.atk} color="#f87171" />
                <StatPip label="DEF" value={stats.def} color="#60a5fa" />
                <StatPip label="SPD" value={stats.speed} color="#fbbf24" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-5">
            <GearSlotCard slot="weapon" gear={rpg.equipped.weapon} onUnequip={() => handleUnequip("weapon")} />
            <GearSlotCard slot="armor" gear={rpg.equipped.armor} onUnequip={() => handleUnequip("armor")} />
            <GearSlotCard slot="trinket" gear={rpg.equipped.trinket} onUnequip={() => handleUnequip("trinket")} />
          </div>

          <p className="text-[11px] text-slate-500 italic mt-4">
            Essence flows in passively as you complete habits, quests, and focus sessions — your level rises on its own.
            Spend banked Essence below to challenge enemies for gear and bonus Essence.
          </p>
        </CardContent>
      </Card>

      {/* Inventory */}
      {rpg.inventory.length > 0 && (
        <div>
          <ArcaneDivider className="mb-3 text-slate-500 text-[10px]"><span className="text-violet-300/50 text-[8px]">⚔</span> Inventory</ArcaneDivider>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {rpg.inventory.map((g) => (
              <button key={g.id} onClick={() => handleEquip(g)} className="rounded-lg border p-2.5 text-left hover:bg-white/5 transition-colors" style={{ borderColor: `${GEAR_TIER_COLOR[g.tier]}30`, background: "hsl(228 34% 10%)" }}>
                <div className="text-xs font-semibold truncate" style={{ color: GEAR_TIER_COLOR[g.tier] }}>{g.name}</div>
                <div className="text-[10px] text-slate-500 capitalize">{g.slot} · {g.tier}</div>
                <div className="text-[10px] text-slate-500 mt-1">+{g.atk} ATK · +{g.def} DEF · +{g.hp} HP</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Battle arena */}
      <div>
        <ArcaneDivider className="mb-3 text-slate-500 text-[10px]"><Flame className="w-3 h-3 text-amber-400" /> Battle Arena</ArcaneDivider>
        <Card className="border-white/5 overflow-hidden" style={{ background: "hsl(228 34% 9%)" }}>
          <CardContent className="p-5 space-y-4">
            <div className="flex flex-wrap gap-2">
              {availableEnemies.map((e, i) => (
                <button key={e.name} onClick={() => { setSelectedEnemyIdx(i); setBattleResult(null); setBattleLog([]); }}
                  disabled={battling}
                  className={cn("px-3 py-1.5 rounded-full border text-xs font-medium transition-colors flex items-center gap-1.5", i === selectedEnemyIdx ? "border-amber-500/50 bg-amber-500/12 text-amber-300" : "border-white/10 text-slate-400 hover:border-amber-500/30")}>
                  <span>{e.emoji}</span> {e.name} <span className="text-[10px] opacity-60">T{e.tier}</span>
                </button>
              ))}
            </div>
            {maxUnlockedTier < 5 && (
              <p className="text-[11px] text-slate-500 italic">Higher-tier enemies unlock as you level up (reach level {maxUnlockedTier * 3 + 1} for the next tier).</p>
            )}

            <div className="flex items-center justify-center gap-10 py-4">
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-lg flex items-center justify-center" style={{ background: "hsl(270 50% 14%)", border: "1px solid hsl(270 60% 50% / 0.25)" }}>
                  <PixelSprite grid={PLAYER_SPRITE} palette={PLAYER_PALETTE} pixelSize={6} />
                </div>
                <span className="text-[10px] text-slate-400">You + {state.familiar.name}</span>
              </div>
              <div className="text-2xl text-slate-600">VS</div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-lg flex items-center justify-center" style={{ background: "hsl(0 40% 12%)", border: "1px solid hsl(0 50% 40% / 0.25)" }}>
                  <PixelSprite grid={ENEMY_SPRITES[enemy.name]} palette={ENEMY_PALETTES[enemy.name]} pixelSize={6} />
                </div>
                <span className="text-[10px] text-slate-400">{enemy.name}</span>
              </div>
            </div>

            {activeStreakCount > 0 && (
              <label className="flex items-center gap-2 text-xs text-slate-400 justify-center">
                <input type="checkbox" checked={useSpecial} onChange={(e) => setUseSpecial(e.target.checked)} className="accent-amber-500" />
                Use familiar's surge ability (boosted by your {activeStreakCount} active streak{activeStreakCount > 1 ? "s" : ""})
              </label>
            )}

            {(battleLog.length > 0) && (
              <div className="rounded-lg border border-white/10 p-3 max-h-40 overflow-y-auto space-y-1 text-xs" style={{ background: "hsl(228 38% 7%)" }}>
                {battleLog.filter(Boolean).map((line, i) => (
                  <div key={i} className={cn(line.side === "player" ? "text-sky-300" : line.side === "enemy" ? "text-red-300" : "text-amber-300 font-semibold")}>
                    {line.text}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            )}

            {battleResult && (
              <div className={cn("text-center text-sm font-semibold", battleResult.won ? "text-green-400" : "text-red-400")}>
                {battleResult.won ? "Victory!" : "Defeated — Essence spent, no loss beyond that."}
                {battleResult.gear && <span className="text-violet-300"> Found: {battleResult.gear.name}!</span>}
              </div>
            )}

            <div className="flex items-center justify-center gap-3">
              <Button size="lg" className="rounded-full px-8" disabled={!canAfford || battling} onClick={handleBattle} style={{ background: canAfford ? "linear-gradient(135deg, hsl(0 65% 45%), hsl(15 70% 50%))" : undefined }}>
                {battling ? "Fighting..." : `Battle (${battleCost} Essence)`}
              </Button>
            </div>
            {!canAfford && <p className="text-center text-xs text-slate-500 italic">Not enough Essence — complete more habits, quests, or focus time to earn more.</p>}
          </CardContent>
        </Card>
      </div>

      {rpg.battleHistory.length > 0 && (
        <div>
          <ArcaneDivider className="mb-3 text-slate-500 text-[10px]"><History className="w-3 h-3" /> Battle History</ArcaneDivider>
          <div className="space-y-1.5">
            {rpg.battleHistory.slice(0, 8).map((b: BattleRecord) => (
              <Card key={b.id} className="border-white/5" style={{ background: "hsl(228 34% 10%)" }}>
                <CardContent className="p-3 flex items-center justify-between gap-3 text-xs">
                  <span className={cn("font-medium", b.won ? "text-green-400" : "text-red-400")}>{b.won ? "Won" : "Lost"} vs {b.enemyName}</span>
                  <span className="text-slate-500">{new Date(b.at).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                  {b.gearDropped && <span className="text-violet-300 truncate">{b.gearDropped}</span>}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatPip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center rounded-lg border border-white/5 py-1.5" style={{ background: "hsl(228 34% 9%)" }}>
      <div className="text-base font-serif font-bold" style={{ color }}>{value}</div>
      <div className="text-[9px] text-slate-500 uppercase tracking-wide">{label}</div>
    </div>
  );
}

/* ============================== Layout ============================== */

const NAV_LINKS = [
  { id: "dashboard", label: "Sanctum", icon: LayoutDashboard, sub: "Overview" },
  { id: "habits", label: "Grimoire", icon: Book, sub: "Rituals" },
  { id: "tasks", label: "Quests", icon: CheckSquare, sub: "Missions" },
  { id: "focus", label: "Focus", icon: Timer, sub: "Deep Work" },
  { id: "health", label: "Vitality", icon: Activity, sub: "Health" },
  { id: "fast", label: "Fast", icon: Flame, sub: "Fasting" },
  { id: "journal", label: "Journal", icon: NotebookPen, sub: "Reflection" },
  { id: "lofi", label: "Lofi", icon: Music, sub: "Ambience" },
  { id: "ascent", label: "Ascent", icon: Zap, sub: "RPG" },
];

const PARTICLES = [
  { top: "14%", left: "72%", colorVar: "accent", size: "w-1 h-1" },
  { top: "28%", left: "8%", colorVar: "accent2", size: "w-1 h-1" },
  { top: "48%", left: "88%", colorVar: "accent", size: "w-0.5 h-0.5" },
  { top: "72%", left: "5%", colorVar: "accent2", size: "w-0.5 h-0.5" },
  { top: "85%", left: "78%", colorVar: "accent", size: "w-1 h-1" },
  { top: "18%", left: "45%", colorVar: "accent2", size: "w-0.5 h-0.5" },
  { top: "62%", left: "55%", colorVar: "accent", size: "w-0.5 h-0.5" },
  { top: "38%", left: "32%", colorVar: "accent2", size: "w-1 h-1" },
  { top: "92%", left: "40%", colorVar: "accent", size: "w-0.5 h-0.5" },
  { top: "55%", left: "20%", colorVar: "accent2", size: "w-1 h-1" },
];

/** Compact theme picker — row of swatch dots, always visible in the sidebar/header. */
function ThemeSwitcher({ activeTheme, onSelect, compact = false }: { activeTheme: ThemeId; onSelect: (id: ThemeId) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const current = THEMES[activeTheme] ?? THEMES.amethyst;

  if (compact) {
    return (
      <div className="flex items-center justify-center gap-2 py-1.5">
        {(Object.values(THEMES) as ThemePalette[]).map((t) => (
          <button key={t.id} onClick={() => onSelect(t.id)} title={t.label}
            className={cn("w-5 h-5 rounded-full border-2 transition-transform", activeTheme === t.id ? "scale-110 border-white/70" : "border-transparent hover:scale-105")}
            style={{ background: t.swatch }} />
        ))}
      </div>
    );
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border text-xs transition-colors hover:bg-white/5"
        style={{ borderColor: `hsl(${current.vars.border})` }}>
        <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: current.swatch }} />
        <span className="text-slate-300 flex-1 text-left">{current.label}</span>
        <span className="text-slate-500 text-[10px]">Theme</span>
      </button>
      {open && (
        <div className="absolute z-30 bottom-full mb-1.5 w-full rounded-lg border p-1.5 grid gap-1"
          style={{ background: `hsl(${current.vars.bgPanel})`, borderColor: `hsl(${current.vars.border})`, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
          {(Object.values(THEMES) as ThemePalette[]).map((t) => (
            <button key={t.id} onClick={() => { onSelect(t.id); setOpen(false); }}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left hover:bg-white/5 transition-colors">
              <span className="w-4 h-4 rounded-full shrink-0" style={{ background: t.swatch, boxShadow: activeTheme === t.id ? `0 0 8px hsl(${t.vars.accent} / 0.6)` : "none" }} />
              <div className="min-w-0">
                <div className={cn("text-xs font-medium", activeTheme === t.id ? "text-white" : "text-slate-300")}>{t.label}</div>
                <div className="text-[10px] text-slate-500 truncate">{t.description}</div>
              </div>
              {activeTheme === t.id && <Check className="w-3 h-3 ml-auto shrink-0 text-slate-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SanctumApp() {
  const [state, setState] = useSanctumStore();
  const [page, setPage] = useState("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [dragonBounce, setDragonBounce] = useState(false);
  const [petted, setPetted] = useState(false);
  const prevCompletionsRef = useRef({ habits: 0, tasksDone: 0 });
  const theme = THEMES[(state.theme as ThemeId) ?? "amethyst"] ?? THEMES.amethyst;

  // Trigger a cheer bounce whenever a habit completion or task completion count increases.
  useEffect(() => {
    const habitsCount = state.habitCompletions.length;
    const tasksDoneCount = state.tasks.filter((t: Task) => t.status === "done").length;
    const prev = prevCompletionsRef.current;
    if (habitsCount > prev.habits || tasksDoneCount > prev.tasksDone) {
      setDragonBounce(true);
      const timeout = setTimeout(() => setDragonBounce(false), 750);
      prevCompletionsRef.current = { habits: habitsCount, tasksDone: tasksDoneCount };
      return () => clearTimeout(timeout);
    }
    prevCompletionsRef.current = { habits: habitsCount, tasksDone: tasksDoneCount };
  }, [state.habitCompletions, state.tasks]);

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

  const hasActiveFast = state.fastSessions.some((f: FastSession) => f.status === "active");

  const dragonPose: DragonPose = petted
    ? "petted"
    : dragonBounce
    ? "cheer"
    : page === "habits"
    ? "reading"
    : page === "tasks"
    ? "questing"
    : page === "focus"
    ? "focusing"
    : page === "health"
    ? "tending"
    : page === "journal"
    ? "reading"
    : page === "ascent"
    ? "questing"
    : page === "fast"
    ? (hasActiveFast ? "sleeping" : "idle")
    : "idle";

  const renderPage = () => {
    switch (page) {
      case "habits": return <HabitsPage state={state} setState={setState} />;
      case "tasks": return <TasksPage state={state} setState={setState} />;
      case "focus": return <FocusPage state={state} setState={setState} />;
      case "health": return <HealthPage state={state} setState={setState} />;
      case "fast": return <FastingPage state={state} setState={setState} />;
      case "journal": return <JournalPage state={state} setState={setState} />;
      case "lofi": return <LofiPlayer />;
      case "ascent": return <AscentPage state={state} setState={setState} />;
      default: return <DashboardPage state={state} setState={setState} dragonPose={dragonPose} dragonBounce={dragonBounce || petted} onPetFamiliar={handlePetFamiliar} />;
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: `hsl(${theme.vars.bg})`, color: "#e2e8f0", fontFamily: "Georgia, 'Times New Roman', serif" }}>
      <style>{`
        :root {
          --accent: ${theme.vars.accent};
          --accent-soft: ${theme.vars.accentSoft};
          --accent-deep: ${theme.vars.accentDeep};
          --accent2: ${theme.vars.accent2};
          --accent2-soft: ${theme.vars.accent2Soft};
          --bg: ${theme.vars.bg};
          --bg-panel: ${theme.vars.bgPanel};
          --bg-card: ${theme.vars.bgCard};
          --border: ${theme.vars.border};
        }
        .font-serif { font-family: Georgia, 'Times New Roman', serif; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .animate-in { animation: fade-in 0.4s ease-out; }
        input::placeholder { color: #64748b; }
        input { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

        @keyframes dragon-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        .dragon-float { animation: dragon-float 3.2s ease-in-out infinite; }
        @keyframes dragon-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.035); } }
        .dragon-breathe { animation: dragon-breathe 2.6s ease-in-out infinite; }
        @keyframes dragon-bounce-kf {
          0% { transform: scale(1) translateY(0) rotate(0deg); }
          25% { transform: scale(1.18) translateY(-10px) rotate(-6deg); }
          50% { transform: scale(1.05) translateY(-2px) rotate(4deg); }
          75% { transform: scale(1.12) translateY(-6px) rotate(-2deg); }
          100% { transform: scale(1) translateY(0) rotate(0deg); }
        }
        .dragon-bounce { animation: dragon-bounce-kf 0.7s ease-out; }
        @keyframes dragon-wing-flap-kf { 0%, 100% { opacity: 0.85; } 50% { opacity: 1; transform: scaleY(1.15); } }
        .dragon-wing-flap { animation: dragon-wing-flap-kf 0.5s ease-in-out infinite; transform-origin: center; }
        @keyframes dragon-zzz-kf { 0% { opacity: 0; transform: translateY(0); } 50% { opacity: 1; } 100% { opacity: 0; transform: translateY(-8px); } }
        .dragon-zzz { animation: dragon-zzz-kf 2.4s ease-in-out infinite; }
        @keyframes dragon-sparkle-kf { 0%, 100% { opacity: 0.4; transform: scale(0.9); } 50% { opacity: 1; transform: scale(1.2); } }
        .dragon-sparkle { animation: dragon-sparkle-kf 0.8s ease-in-out infinite; }
      `}</style>

      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] rounded-full opacity-[0.06]" style={{ background: `radial-gradient(circle, hsl(${theme.vars.accent}) 0%, transparent 70%)`, filter: "blur(60px)" }} />
        <div className="absolute top-[55%] right-[10%] w-96 h-96 rounded-full opacity-[0.08]" style={{ background: `radial-gradient(circle, hsl(${theme.vars.accent2}) 0%, transparent 70%)`, filter: "blur(56px)" }} />
        <div className="absolute bottom-[15%] left-[38%] w-72 h-72 rounded-full opacity-[0.05]" style={{ background: `radial-gradient(circle, hsl(${theme.vars.accent2}) 0%, transparent 70%)`, filter: "blur(40px)" }} />
        {PARTICLES.map((p, i) => (
          <div key={i} className={cn("absolute rounded-full", p.size)} style={{ top: p.top, left: p.left, background: p.colorVar === "accent" ? `hsl(${theme.vars.accent})` : `hsl(${theme.vars.accent2})`, boxShadow: `0 0 6px 1px ${p.colorVar === "accent" ? `hsl(${theme.vars.accent})` : `hsl(${theme.vars.accent2})`}` }} />
        ))}
      </div>

      {/* Sidebar (desktop) */}
      <aside className="w-60 border-r flex-col hidden md:flex relative z-10" style={{ borderColor: `hsl(${theme.vars.border})`, background: `hsl(${theme.vars.bgPanel})`, boxShadow: "4px 0 32px rgba(0,0,0,0.4)" }}>
        <div className="absolute top-0 left-0 right-0 h-px pointer-events-none" style={{ background: `linear-gradient(90deg, transparent, hsl(${theme.vars.accent} / 0.5), transparent)` }} />
        <div className="absolute top-0 left-0 right-0 h-40 pointer-events-none" style={{ background: `radial-gradient(ellipse at 50% -10%, hsl(${theme.vars.accent} / 0.10) 0%, transparent 70%)` }} />
        <div className="p-5 relative border-b" style={{ borderColor: `hsl(${theme.vars.border} / 0.6)` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, hsl(${theme.vars.accentDeep}), hsl(${theme.vars.accent}))`, boxShadow: `0 0 16px hsl(${theme.vars.accent} / 0.45)` }}>
              <span className="text-sm">⚗</span>
            </div>
            <div>
              <h1 className="text-lg font-serif font-bold leading-none" style={{ color: `hsl(${theme.vars.accentSoft})`, textShadow: `0 0 20px hsl(${theme.vars.accent} / 0.4)` }}>Sanctum</h1>
              <p className="text-[9px] tracking-[0.18em] text-slate-500 mt-0.5 uppercase">Your Arcane Study</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-2.5 py-4 space-y-0.5">
          {NAV_LINKS.map((link) => {
            const Icon = link.icon;
            const active = page === link.id;
            return (
              <button key={link.id} onClick={() => setPage(link.id)}
                className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative text-left", !active && "text-slate-400 hover:text-slate-200")}
                style={active ? { color: `hsl(${theme.vars.accentSoft})`, fontWeight: 600, background: `linear-gradient(135deg, hsl(${theme.vars.accent} / 0.12), hsl(${theme.vars.accent2} / 0.06))`, borderLeft: `2px solid hsl(${theme.vars.accent} / 0.7)` } : {}}>
                <Icon className="w-4 h-4 shrink-0" />
                <span className="text-sm">{link.label}</span>
                {active && <div className="ml-auto w-1.5 h-1.5 rounded-full shrink-0" style={{ background: `hsl(${theme.vars.accent})`, boxShadow: `0 0 6px hsl(${theme.vars.accent})` }} />}
              </button>
            );
          })}
        </nav>
        <div className="px-3 pb-3">
          <ThemeSwitcher activeTheme={state.theme} onSelect={(id) => setState((s: any) => ({ ...s, theme: id }))} />
        </div>
        <div className="p-4 border-t mt-auto" style={{ borderColor: `hsl(${theme.vars.border} / 0.4)` }}>
          <div className="flex items-center justify-center gap-3">
            <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, transparent, hsl(${theme.vars.accent} / 0.2))` }} />
            <span className="text-xs select-none" style={{ color: `hsl(${theme.vars.accent} / 0.5)` }}>✦</span>
            <span className="text-xs select-none" style={{ color: `hsl(${theme.vars.accent2} / 0.5)` }}>✦</span>
            <span className="text-xs select-none" style={{ color: `hsl(${theme.vars.accent} / 0.5)` }}>✦</span>
            <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, hsl(${theme.vars.accent} / 0.2), transparent)` }} />
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative z-10">
        {/* Mobile header */}
        <header className="h-14 border-b backdrop-blur-sm flex items-center px-4 md:hidden justify-between" style={{ borderColor: `hsl(${theme.vars.border})`, background: `hsl(${theme.vars.bgPanel} / 0.8)` }}>
          <div className="flex items-center">
            <span className="mr-2 text-lg">⚗</span>
            <h1 className="text-xl font-serif font-bold" style={{ color: `hsl(${theme.vars.accentSoft})` }}>Sanctum</h1>
          </div>
          <button onClick={() => setMobileNavOpen((v) => !v)} className="p-2 text-slate-400">
            <Menu className="w-5 h-5" />
          </button>
        </header>
        {mobileNavOpen && (
          <div className="md:hidden border-b grid grid-cols-3 gap-1 p-2" style={{ borderColor: `hsl(${theme.vars.border})`, background: `hsl(${theme.vars.bgPanel})` }}>
            {NAV_LINKS.map((link) => {
              const Icon = link.icon;
              const active = page === link.id;
              return (
                <button key={link.id} onClick={() => { setPage(link.id); setMobileNavOpen(false); }}
                  className="flex flex-col items-center gap-1 py-2.5 rounded-lg text-xs"
                  style={active ? { color: `hsl(${theme.vars.accentSoft})`, background: `hsl(${theme.vars.accent} / 0.1)` } : { color: "#94a3b8" }}>
                  <Icon className="w-4 h-4" />
                  {link.label}
                </button>
              );
            })}
            <div className="col-span-3 pt-1">
              <ThemeSwitcher activeTheme={state.theme} onSelect={(id) => setState((s: any) => ({ ...s, theme: id }))} compact />
            </div>
          </div>
        )}
        <div className="flex-1 overflow-auto p-6 lg:p-10">
          <div className="max-w-4xl mx-auto">{renderPage()}</div>
        </div>
      </main>

      <DragonCorner pose={dragonPose} bounce={dragonBounce || petted} familiar={state.familiar} onPet={handlePetFamiliar} />
    </div>
  );
}
