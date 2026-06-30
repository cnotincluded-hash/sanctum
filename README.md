# sanctum

A cozy personal productivity and health dashboard — part wizard's study, part
RPG character sheet. Track habits, focus sessions, tasks, fasting windows, and
health metrics while leveling up an XP/progression system.

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


- This is a fully client-side app. There's no server, no database, and no
account system; everything you track stays on the device and in the browser
you're using it in.

[(https://sanctumdash.netlify.app/)]   


[Edit in StackBlitz next generation editor ⚡️](https://stackblitz.com/~/github.com/cnotincluded-hash/sanctum)
