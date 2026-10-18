<img src="assets/app-icon.png" width="96" alt="Sanctum icon">

# Sanctum

A cozy personal productivity and health dashboard — part wizard's study, part
RPG character sheet. Track habits, focus sessions, tasks, fasting windows, and
health metrics while leveling up an XP/progression system.

Use it on the web at **https://cnotincluded-hash.github.io/sanctum/**, or
install the desktop app for Windows and Mac. The website can sync through a
Sanctum account. The desktop app is local-only: it opens without sign-in and
stores your study in a JSON file on your computer.

A Caffeine Not Included tool.

## What it does

| Section | Name in app | What it tracks |
|---|---|---|
| Overview | **Sanctum** | Level/XP, today's stats, active streaks, your widgets and your dragon familiar |
| Habits | **Grimoire** | Daily/weekly rituals with color-coded streaks |
| Tasks | **Quests** | To-dos with priority, category, and completion |
| Focus | **Focus** | Pomodoro-style timer with session history |
| Health | **Vitality** | Daily water, sleep, steps, mood, and exercise |
| Fasting | **Fast** | Intermittent fasting windows (16:8, 18:6, 20:4, 24h, custom) |
| Journal | **Journal** | One entry a day with a mood |
| Music | **Lofi** | Live lofi streams to study to |
| RPG | **Ascent** | A character and familiar that grow from your real progress — see `ASCENT.md` |

Completing habits, finishing tasks, and logging focus minutes all earn XP and
level you up — `(habit completions × 10) + (focus minutes × 0.5) + (tasks
done × 20)`, leveling every 100 XP.

Pick a theme at the bottom of the sidebar (Amethyst, Emerald Coven, Blood Moon,
Frostbound or Solar Flare); every page takes on its colours.

### The look

Sanctum's design is "sleek arcane": frosted-glass panels over a dark ground lit
by two soft glows, Instrument Serif for headings and numbers, Manrope for
everything else. Each theme sets three colours for it (an accent, a second
accent and the ground) in `THEMES` in `src/App.tsx`; the shared pieces
(buttons, panels, rings, mood faces) live in `src/ui.tsx` and `src/sanctum.css`.

## Desktop app

### Download

Get the latest version from the [Releases](../../releases) page:

| Your computer | File to download |
| --- | --- |
| Windows 10 or 11 | `Sanctum_x.x.x_x64_en-US.msi` (or the `-setup.exe`) |
| Mac, Apple Silicon or Intel, macOS 11 or later | `Sanctum_x.x.x_universal.dmg` |

### Install

Sanctum isn't code-signed yet, so your computer asks you to confirm it the first time.

**Windows**

1. Run the `.msi` or `-setup.exe`.
2. If a blue *Windows protected your PC* box appears, click **More info**, then **Run anyway**.

**Mac**

1. Open the `.dmg` and drag **Sanctum** into **Applications**.
2. Open Sanctum. When macOS says it can't check the app, click **Done**.
3. Open **System Settings → Privacy & Security**, scroll down to the message about Sanctum, click **Open Anyway** and confirm.

If macOS says the app *is damaged and can't be opened*, run this once in Terminal, then open it again:

```
xattr -cr "/Applications/Sanctum.app"
```

### Signing in

The installed desktop app does **not** require an account or internet access.
Open Sanctum and start using it straight away. The website version continues to
use email sign-in for account sync.

### Your desktop data

The desktop app automatically saves your study to:

- **Windows:** `%USERPROFILE%\Documents\Sanctum\sanctum-data.json`
- **Mac:** `~/Documents/Sanctum/sanctum-data.json`

The file is ordinary JSON, so you can copy it to back up your data. Sanctum also
keeps a small browser-storage recovery copy and can use it if it is newer than
the file (for example, when upgrading from an earlier desktop build).

Desktop changes stay on this computer; they are not uploaded to an account.
The website version remains separate and continues to use Supabase for account
sync, with Sanctum's own Supabase project built in (`src/supabase.ts`). To point
a build at a different project, copy `.env.example` to `.env` and fill in
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The desktop app doesn't use
these.

## Run and build it yourself

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev        # the website at http://localhost:5173/sanctum/
npm run build      # the website's files in dist/ (deployed by deploy.yml)
```

The website deploys itself whenever `main` changes. That needs **Settings →
Pages → Build and deployment → Source** set to **GitHub Actions**; with
"Deploy from a branch" GitHub serves the unbuilt source and the page is blank.

For the desktop app you also need [Rust](https://rustup.rs) and the
[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your
system (Microsoft C++ Build Tools on Windows, Xcode Command Line Tools on Mac).

```bash
npm run desktop        # run the desktop app from this folder
npm run desktop:build  # make an installer in src-tauri/target/release/bundle
```

### Release a new desktop version

The **Build desktop installers** workflow builds the Windows and Mac
installers on GitHub and puts them in a draft release. The website keeps
deploying on every change to `main` as before.

1. Raise the version in `package.json`, `src-tauri/tauri.conf.json` and
   `src-tauri/Cargo.toml`, for example to `1.1.0`.
2. Commit, then either open **Actions → Build desktop installers → Run
   workflow**, or push a tag: `git tag v1.1.0 && git push --tags`.
3. When both builds are green, open **Releases**, check the draft and click
   **Publish release**.

## Project structure

| Path | What it is |
| --- | --- |
| `src/App.tsx` | The app: pages, state, themes and sync |
| `src/ui.tsx` | Shared building blocks for the look: buttons, panels, rings, mood faces, menus |
| `src/sanctum.css` | The look's styles: glass panels, type, buttons, fields, motion |
| `src/sync.ts` | The rules for keeping devices and your account in step |
| `src/desktop.ts` | The few differences in the desktop app (links open in your browser) |
| `public/player.html` | The lofi player page on the website. The desktop app plays streams through it, because YouTube won't play an embed that doesn't come from a website (its "Error 153") |
| `src/supabase.ts` | Website-only connection to your Supabase project |
| `vite.config.ts` | Builds the website for `/sanctum/` and the desktop app for its own root |
| `src-tauri/` | The desktop app shell: window, icons, installer settings (`tauri.conf.json`) |
| `assets/app-icon.svg` | The app icon. After editing, export a 1024 px PNG to `assets/app-icon.png` and run `npx tauri icon assets/app-icon.png` |
| `.github/workflows/deploy.yml` | Publishes the website to GitHub Pages |
| `.github/workflows/build-desktop.yml` | Builds the Windows and Mac installers |

## Tech stack

React 18, TypeScript, Vite, Tailwind CSS and [lucide-react](https://lucide.dev/)
icons; Instrument Serif and Manrope fonts, bundled with the app through
[Fontsource](https://fontsource.org) so they work offline; [Supabase](https://supabase.com) for sign-in and sync; [Tauri](https://tauri.app)
for the desktop app.

## License

Personal project — not licensed for redistribution or commercial use.

© Caffeine Not Included
