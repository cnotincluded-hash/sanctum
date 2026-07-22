# Sanctum

A cozy personal productivity and health dashboard — part wizard's study, part
RPG character sheet. Track habits, focus sessions, tasks, fasting windows, and
health metrics while leveling up an XP/progression system.

![Sanctum](https://img.shields.io/badge/built%20with-React%20%2B%20Vite-7c3aed)
![License](https://img.shields.io/badge/license-personal%20use-555)

## What it does

Sanctum has six sections, themed as an arcane study:

| Section | Name in app | What it tracks |
|---|---|---|
| Overview | **Sanctum** | Level/XP bar, today's stats, active streaks |
| Habits | **Grimoire** | Daily/weekly rituals with color-coded streaks |
| Tasks | **Quests** | To-dos with priority, category, and completion |
| Focus | **Focus** | Pomodoro-style timer with session history |
| Health | **Vitality** | Daily water, sleep, steps, mood, and exercise |
| Fasting | **Fast** | Intermittent fasting windows (16:8, 18:6, 20:4, 24h, custom) |

Completing habits, finishing tasks, and logging focus minutes all earn XP and
level you up — `(habit completions × 10) + (focus minutes × 0.5) + (tasks
done × 20)`, leveling every 100 XP.

## Tech stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- [lucide-react](https://lucide.dev/) for icons
- No backend — all data is stored in the browser's `localStorage`

This is a fully client-side app. There's no server, no database, and no
account system; everything you track stays on the device and in the browser
you're using it in.

## Running locally

```bash
npm install
npm run dev
```

Then open the local URL Vite prints (usually `http://localhost:5173`).

## Building for production

```bash
npm run build
```

Outputs a static `dist/` folder you can deploy anywhere that serves static
files (Netlify, Vercel, GitHub Pages, etc.). See `DEPLOY.md` for a Netlify
walkthrough.

## Project structure

```
src/
  App.tsx        — entire app: pages, components, state, styling
  main.tsx       — React entry point
  index.css      — Tailwind directives
index.html
tailwind.config.js
postcss.config.js
vite.config.ts
```

Everything — pages, UI primitives, and the in-memory data store — currently
lives in `App.tsx` as a single file by design, ported directly from a larger
multi-package Replit project to make it easy to drop into tools like
StackBlitz or CodeSandbox without managing a workspace.

## Data & privacy

All habits, tasks, focus sessions, health logs, and fasts are stored in your
browser's `localStorage`, scoped to whatever URL you're using. That means:

- Nothing is sent to a server.
- Data does not sync across browsers or devices.
- Clearing your browser's site data for that URL will erase your Sanctum
  data.

## License

Personal project — not licensed for redistribution or commercial use.
