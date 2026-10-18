// Shared building blocks for Sanctum's look (design B, "sleek arcane").
// The matching classes live in sanctum.css.
import { useEffect, useRef, useState, type ReactNode, type ButtonHTMLAttributes } from "react";

export function cx(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

/* ------------------------------ Buttons ------------------------------ */

type BtnVariant = "primary" | "glass" | "quiet" | "danger" | "good";
export function Btn({
  variant = "glass", size, icon, wide, className, children, type = "button", ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm"; icon?: ReactNode; wide?: boolean }) {
  return (
    <button
      type={type}
      className={cx("btn", `btn-${variant}`, size === "sm" && "btn-sm", !children && "btn-icon", wide && "btn-wide", className)}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

/* ------------------------------ Headings ------------------------------ */

/** Page title block: eyebrow, big serif title, a line under it, actions on the right. */
export function PageHeader({ eyebrow, title, sub, actions }: { eyebrow: string; title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-5 px-2 pt-3">
      <div className="min-w-0">
        <div className="eyebrow" style={{ fontSize: 13, letterSpacing: "0.14em" }}>{eyebrow}</div>
        <h1 className="display mt-2.5" style={{ fontSize: "clamp(44px, 6vw, 64px)" }}>{title}</h1>
        {sub && <p className="sub mt-3" style={{ fontSize: 16 }}>{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </header>
  );
}

/** Small uppercase section heading with an optional action on the right. */
export function SectionHead({ children, action, id }: { children: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-2 pt-1">
      <h2 id={id} className="eyebrow" style={{ fontSize: 13 }}>{children}</h2>
      {action}
    </div>
  );
}

/** Panel header: icon tile, title, a note on the right. */
export function PanelHead({ icon, title, note, children }: { icon: ReactNode; title: ReactNode; note?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span aria-hidden="true" className="icon-tile">{icon}</span>
      <h3 className="m-0 truncate" style={{ fontSize: 16, fontWeight: 700, color: "#f0f1f8" }}>{title}</h3>
      {note !== undefined && <span className="ml-auto sub shrink-0" style={{ fontSize: 13 }}>{note}</span>}
      {children}
    </div>
  );
}

/* ------------------------------ Data bits ------------------------------ */

/** Row of short bars: `done` of `total` filled. */
export function SegBars({ total, done, color = "accent" }: { total: number; done: number; color?: "accent" | "accent2" }) {
  const count = Math.max(1, Math.min(total, 10));
  const filled = total > 10 ? Math.round((done / total) * 10) : done;
  const on = color === "accent" ? "hsl(var(--ui-accent))" : "hsl(var(--ui-accent2))";
  return (
    <div className="flex gap-1" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} style={{ flex: 1, height: 5, borderRadius: 999, background: i < filled ? on : "rgba(255,255,255,0.1)" }} />
      ))}
    </div>
  );
}

/** Circular progress ring with content in the middle. */
export function Ring({ pct, size = 200, stroke = 12, color = "hsl(var(--ui-accent))", dotted = true, children }: { pct: number; size?: number; stroke?: number; color?: string; dotted?: boolean; children?: ReactNode }) {
  const r = (size - stroke) / 2 - 2;
  const circ = 2 * Math.PI * r;
  const c = size / 2;
  const p = Math.max(0, Math.min(1, pct));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ fill: "none" }}>
        <circle cx={c} cy={c} r={r} style={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: stroke }} />
        {dotted && <circle cx={c} cy={c} r={r - stroke - 4} style={{ stroke: "rgba(255,255,255,0.07)", strokeWidth: 1, strokeDasharray: "2 7" }} />}
        {p > 0 && (
          <circle cx={c} cy={c} r={r} transform={`rotate(-90 ${c} ${c})`}
            style={{ stroke: color, strokeWidth: stroke, strokeLinecap: "round", strokeDasharray: `${circ * p} ${circ}`, transition: "stroke-dasharray 0.8s ease" }} />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

/** Line-drawn mood face, 1 (low) to 5 (bright). */
export function MoodFace({ level, size = 22, selected = false }: { level: number; size?: number; selected?: boolean }) {
  const mouths = ["M8.5 16.2q3.5-3 7 0", "M8.5 15.8q3.5-1.4 7 0", "M8.5 15.2h7", "M8.5 14.6q3.5 2.4 7 0", "M8 13.8q4 4.2 8 0"];
  const color = selected ? "hsl(var(--ui-accent))" : "var(--label)";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ fill: "none", stroke: color, strokeWidth: selected ? 1.7 : 1.5, strokeLinecap: "round" }}>
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="9" cy="10" r="0.9" style={{ fill: color }} />
      <circle cx="15" cy="10" r="0.9" style={{ fill: color }} />
      <path d={mouths[Math.max(1, Math.min(5, level)) - 1]} />
    </svg>
  );
}
export const MOOD_LABELS = ["low", "a bit down", "okay", "good", "bright"];

/** Five mood buttons. */
export function MoodPicker({ value, onChange, size = 44 }: { value: number | null; onChange: (v: number) => void; size?: number }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Mood">
      {[1, 2, 3, 4, 5].map((n) => {
        const on = value === n;
        return (
          <button key={n} type="button" onClick={() => onChange(n)} aria-pressed={on} aria-label={`Mood ${n} of 5, ${MOOD_LABELS[n - 1]}`}
            className="flex items-center justify-center rounded-xl transition-colors hover:bg-white/5"
            style={{ width: size, height: size, border: on ? "1px solid hsl(var(--ui-accent))" : "1px solid transparent", background: on ? "rgba(255,255,255,0.07)" : "transparent" }}>
            <MoodFace level={n} selected={on} />
          </button>
        );
      })}
    </div>
  );
}

/** Dashed empty state with an optional action. */
export function EmptyState({ icon, children, action }: { icon?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-3 rounded-[18px] border border-dashed p-6 text-center"
      style={{ borderColor: "rgba(255,255,255,0.12)" }}>
      {icon && <span aria-hidden="true" style={{ color: "var(--label)" }}>{icon}</span>}
      <p className="sub m-0" style={{ fontSize: 14 }}>{children}</p>
      {action}
    </div>
  );
}

/* ------------------------------ Popover ------------------------------ */

/** Open/close state for a small menu, closing on outside click or Escape. */
export function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return { open, setOpen, ref };
}

/* ------------------------------ Icons ------------------------------ */

/** The Sanctum alembic. */
export function AlembicIcon({ size = 22, color = "hsl(var(--ui-accent))" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ fill: "none", stroke: color, strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" }}>
      <path d="M9.5 3h5" /><path d="M10.5 3v5.2L5.6 17.6A2.3 2.3 0 0 0 7.6 21h8.8a2.3 2.3 0 0 0 2-3.4L13.5 8.2V3" /><path d="M8 14.5h8" />
    </svg>
  );
}

/** Solid flame used for streaks. */
export function FlameMark({ size = 12, color = "hsl(var(--ui-accent))" }: { size?: number; color?: string }) {
  return (
    <svg width={size * (10 / 12)} height={size} viewBox="0 0 24 28" aria-hidden="true" style={{ fill: color, stroke: "none", flexShrink: 0 }}>
      <path d="M12 1c1.5 4.5 7 7.5 7 14a7 7 0 0 1-14 0c0-3 1.6-5 3.2-6.4 0 3 1.3 4.6 3 4.6 0-4.7-1.7-7.6.8-12.2z" />
    </svg>
  );
}

/** Logo tile used in the sidebar and sign-in screen. */
export function LogoTile({ size = 40 }: { size?: number }) {
  return (
    <div aria-hidden="true" className="flex items-center justify-center shrink-0"
      style={{ width: size, height: size, borderRadius: size * 0.3, background: "#11121e", border: "1px solid rgba(255,255,255,0.12)" }}>
      <AlembicIcon size={Math.round(size * 0.55)} />
    </div>
  );
}
