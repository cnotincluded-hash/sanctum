import { useState, useEffect, useRef, useCallback } from "react";
import {
  Trophy, CheckCircle, Brain, BookOpen, Flame, Plus, Book, Check, X, Trash2, Undo2,
  Droplets, Dumbbell, Pencil, Star, Heart, Zap, Sun, Moon, Coffee, Music, Leaf,
  CheckSquare, Play, Square, Pause, RotateCcw, Droplet, Footprints, Smile, Minus,
  LayoutDashboard, Timer, Activity, XCircle, History, Menu,
} from "lucide-react";

/* ============================== Storage helpers ============================== */

const STORAGE_KEY = "sanctum-state-v1";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
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

let idCounter = 1000;
function nextId() {
  return ++idCounter;
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

/* ============================== Seed data ============================== */

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

type DragonPose = "idle" | "reading" | "questing" | "focusing" | "tending" | "sleeping" | "cheer";

const DRAGON_FLAVOR: Record<DragonPose, string[]> = {
  idle: ["watching the candlelight", "curled on a warm stone", "tail flicking idly"],
  reading: ["nose in a spellbook", "scanning old runes", "humming over the grimoire"],
  questing: ["sharpening its claws", "eyeing the quest board", "pacing with anticipation"],
  focusing: ["perched in silent vigil", "eyes half-closed, focused", "matching your breathing"],
  tending: ["sniffing a vial of water", "stretching its wings", "counting your steps"],
  sleeping: ["dozing through the fast", "snoring tiny puffs of smoke", "dreaming of feasts to come"],
  cheer: ["delighted!", "doing a little spin", "very proud of you"],
};

function useDragonFlavor(pose: DragonPose) {
  const [line, setLine] = useState(() => DRAGON_FLAVOR[pose][0]);
  useEffect(() => {
    const options = DRAGON_FLAVOR[pose];
    setLine(options[Math.floor(Math.random() * options.length)]);
  }, [pose]);
  return line;
}

/** Pure SVG/CSS tiny dragon. `size` in px. `pose` changes posture/eye state. */
function DragonSprite({ pose, size = 56, bounce = false }: { pose: DragonPose; size?: number; bounce?: boolean }) {
  const bodyColor = "hsl(270 55% 46%)";
  const bellyColor = "hsl(38 80% 60%)";
  const wingColor = "hsl(270 60% 60%)";
  const eyesClosed = pose === "sleeping" || pose === "focusing";
  const tilt = pose === "reading" ? -8 : pose === "questing" ? 6 : 0;

  return (
    <div
      className={cn("relative select-none", bounce && "dragon-bounce")}
      style={{ width: size, height: size }}
      title={pose}
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
          <text x="68" y="20" fontSize="10" fill="hsl(38 80% 65%)" fontFamily="Georgia, serif" className="dragon-zzz">z</text>
        )}
        {/* book for reading pose */}
        {pose === "reading" && (
          <rect x="38" y="76" width="24" height="4" rx="1" fill="hsl(38 80% 60%)" opacity={0.85} />
        )}
        {/* cheer sparkle */}
        {pose === "cheer" && (
          <text x="68" y="22" fontSize="11" fill="hsl(38 88% 62%)" className="dragon-sparkle">✦</text>
        )}
      </svg>
    </div>
  );
}

/** Small persistent corner companion shown on every page. */
function DragonCorner({ pose, bounce }: { pose: DragonPose; bounce: boolean }) {
  const line = useDragonFlavor(pose);
  return (
    <div
      className="fixed bottom-4 right-4 z-30 flex items-end gap-2 pointer-events-none"
      aria-hidden="true"
    >
      <div
        className="hidden sm:block rounded-lg px-2.5 py-1.5 text-[11px] italic text-slate-300 mb-1"
        style={{ background: "hsl(228 36% 10% / 0.85)", border: "1px solid hsl(228 25% 20%)", backdropFilter: "blur(4px)" }}
      >
        {line}
      </div>
      <div
        className="rounded-full p-1.5"
        style={{ background: "hsl(228 36% 10% / 0.7)", border: "1px solid hsl(38 88% 52% / 0.2)", boxShadow: "0 0 20px rgba(0,0,0,0.4)" }}
      >
        <DragonSprite pose={pose} size={48} bounce={bounce} />
      </div>
    </div>
  );
}

/** Larger featured dragon for the dashboard. */
function DragonFeature({ pose, bounce }: { pose: DragonPose; bounce: boolean }) {
  const line = useDragonFlavor(pose);
  return (
    <div className="flex items-center gap-4 px-2">
      <DragonSprite pose={pose} size={84} bounce={bounce} />
      <div>
        <div className="text-xs uppercase tracking-[0.15em] text-slate-500 font-semibold mb-0.5">Your familiar</div>
        <div className="text-sm text-slate-300 italic">{line}</div>
      </div>
    </div>
  );
}

/* ============================== Dashboard Page ============================== */

function DashboardPage({ state, dragonPose, dragonBounce }: { state: any; dragonPose: DragonPose; dragonBounce: boolean }) {
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
        <DragonFeature pose={dragonPose} bounce={dragonBounce} />
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

/* ============================== Layout ============================== */

const NAV_LINKS = [
  { id: "dashboard", label: "Sanctum", icon: LayoutDashboard, sub: "Overview" },
  { id: "habits", label: "Grimoire", icon: Book, sub: "Rituals" },
  { id: "tasks", label: "Quests", icon: CheckSquare, sub: "Missions" },
  { id: "focus", label: "Focus", icon: Timer, sub: "Deep Work" },
  { id: "health", label: "Vitality", icon: Activity, sub: "Health" },
  { id: "fast", label: "Fast", icon: Flame, sub: "Fasting" },
];

const PARTICLES = [
  { top: "14%", left: "72%", color: "hsl(38 88% 52%)", size: "w-1 h-1" },
  { top: "28%", left: "8%", color: "hsl(270 60% 60%)", size: "w-1 h-1" },
  { top: "48%", left: "88%", color: "hsl(38 88% 52%)", size: "w-0.5 h-0.5" },
  { top: "72%", left: "5%", color: "hsl(270 60% 60%)", size: "w-0.5 h-0.5" },
  { top: "85%", left: "78%", color: "hsl(38 88% 52%)", size: "w-1 h-1" },
  { top: "18%", left: "45%", color: "hsl(270 60% 60%)", size: "w-0.5 h-0.5" },
  { top: "62%", left: "55%", color: "hsl(38 88% 52%)", size: "w-0.5 h-0.5" },
  { top: "38%", left: "32%", color: "hsl(270 60% 60%)", size: "w-1 h-1" },
  { top: "92%", left: "40%", color: "hsl(38 88% 52%)", size: "w-0.5 h-0.5" },
  { top: "55%", left: "20%", color: "hsl(270 60% 60%)", size: "w-1 h-1" },
];

export default function SanctumApp() {
  const [state, setState] = useSanctumStore();
  const [page, setPage] = useState("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [dragonBounce, setDragonBounce] = useState(false);
  const prevCompletionsRef = useRef({ habits: 0, tasksDone: 0 });

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

  const hasActiveFocus = false; // focus timer state is local to FocusPage; corner uses page-based pose below
  const hasActiveFast = state.fastSessions.some((f: FastSession) => f.status === "active");

  const dragonPose: DragonPose = dragonBounce
    ? "cheer"
    : page === "habits"
    ? "reading"
    : page === "tasks"
    ? "questing"
    : page === "focus"
    ? "focusing"
    : page === "health"
    ? "tending"
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
      default: return <DashboardPage state={state} dragonPose={dragonPose} dragonBounce={dragonBounce} />;
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: "hsl(228 38% 7%)", color: "#e2e8f0", fontFamily: "Georgia, 'Times New Roman', serif" }}>
      <style>{`
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
        <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] rounded-full opacity-[0.06]" style={{ background: "radial-gradient(circle, hsl(38 88% 52%) 0%, transparent 70%)", filter: "blur(60px)" }} />
        <div className="absolute top-[55%] right-[10%] w-96 h-96 rounded-full opacity-[0.08]" style={{ background: "radial-gradient(circle, hsl(270 60% 60%) 0%, transparent 70%)", filter: "blur(56px)" }} />
        <div className="absolute bottom-[15%] left-[38%] w-72 h-72 rounded-full opacity-[0.05]" style={{ background: "radial-gradient(circle, hsl(258 60% 65%) 0%, transparent 70%)", filter: "blur(40px)" }} />
        {PARTICLES.map((p, i) => (
          <div key={i} className={cn("absolute rounded-full", p.size)} style={{ top: p.top, left: p.left, background: p.color, boxShadow: `0 0 6px 1px ${p.color}` }} />
        ))}
      </div>

      {/* Sidebar (desktop) */}
      <aside className="w-60 border-r flex-col hidden md:flex relative z-10" style={{ borderColor: "hsl(228 25% 16%)", background: "hsl(228 36% 8%)", boxShadow: "4px 0 32px rgba(0,0,0,0.4)" }}>
        <div className="absolute top-0 left-0 right-0 h-px pointer-events-none" style={{ background: "linear-gradient(90deg, transparent, hsl(38 88% 52% / 0.5), transparent)" }} />
        <div className="absolute top-0 left-0 right-0 h-40 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% -10%, hsl(38 88% 52% / 0.10) 0%, transparent 70%)" }} />
        <div className="p-5 relative border-b" style={{ borderColor: "hsl(228 25% 16% / 0.6)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, hsl(38 88% 30%), hsl(38 88% 52%))", boxShadow: "0 0 16px hsl(38 88% 52% / 0.45)" }}>
              <span className="text-sm">⚗</span>
            </div>
            <div>
              <h1 className="text-lg font-serif font-bold leading-none" style={{ color: "hsl(38 88% 58%)", textShadow: "0 0 20px hsl(38 88% 52% / 0.4)" }}>Sanctum</h1>
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
                className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative text-left", active ? "text-amber-400 font-semibold" : "text-slate-400 hover:text-slate-200")}
                style={active ? { background: "linear-gradient(135deg, hsl(38 88% 52% / 0.12), hsl(270 60% 60% / 0.06))", borderLeft: "2px solid hsl(38 88% 52% / 0.7)" } : {}}>
                <Icon className="w-4 h-4 shrink-0" />
                <span className="text-sm">{link.label}</span>
                {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" style={{ boxShadow: "0 0 6px hsl(38 88% 52%)" }} />}
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t mt-auto" style={{ borderColor: "hsl(228 25% 16% / 0.4)" }}>
          <div className="flex items-center justify-center gap-3">
            <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, transparent, hsl(38 88% 52% / 0.2))" }} />
            <span className="text-amber-400/50 text-xs select-none">✦</span>
            <span className="text-violet-400/50 text-xs select-none">✦</span>
            <span className="text-amber-400/50 text-xs select-none">✦</span>
            <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, hsl(38 88% 52% / 0.2), transparent)" }} />
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative z-10">
        {/* Mobile header */}
        <header className="h-14 border-b backdrop-blur-sm flex items-center px-4 md:hidden justify-between" style={{ borderColor: "hsl(228 25% 16%)", background: "hsl(228 36% 8% / 0.8)" }}>
          <div className="flex items-center">
            <span className="mr-2 text-lg">⚗</span>
            <h1 className="text-xl font-serif font-bold" style={{ color: "hsl(38 88% 58%)" }}>Sanctum</h1>
          </div>
          <button onClick={() => setMobileNavOpen((v) => !v)} className="p-2 text-slate-400">
            <Menu className="w-5 h-5" />
          </button>
        </header>
        {mobileNavOpen && (
          <div className="md:hidden border-b grid grid-cols-3 gap-1 p-2" style={{ borderColor: "hsl(228 25% 16%)", background: "hsl(228 36% 8%)" }}>
            {NAV_LINKS.map((link) => {
              const Icon = link.icon;
              const active = page === link.id;
              return (
                <button key={link.id} onClick={() => { setPage(link.id); setMobileNavOpen(false); }}
                  className={cn("flex flex-col items-center gap-1 py-2.5 rounded-lg text-xs", active ? "text-amber-400 bg-amber-500/10" : "text-slate-400")}>
                  <Icon className="w-4 h-4" />
                  {link.label}
                </button>
              );
            })}
          </div>
        )}
        <div className="flex-1 overflow-auto p-6 lg:p-10">
          <div className="max-w-4xl mx-auto">{renderPage()}</div>
        </div>
      </main>

      <DragonCorner pose={dragonPose} bounce={dragonBounce} />
    </div>
  );
}
