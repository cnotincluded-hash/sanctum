<img src="assets/app-icon.png" width="96" alt="Sanctum icon">

# Sanctum

A cozy personal productivity and health dashboard — part wizard's study, part
RPG character sheet. Track habits, focus sessions, tasks, fasting windows, and
health metrics while leveling up an XP/progression system.

Use it on the web at **https://cnotincluded-hash.github.io/sanctum/**, or
install the desktop app for Windows and Mac. Both sign in to the same account,
so your study is the same everywhere.

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

Enter your email and Sanctum sends you a sign-in email. In the desktop app,
type the **code** from that email (the link in it only opens the website).

The code only appears in the email once the Supabase email template includes
it — a one-time setup:

1. In Supabase, open **Authentication → Emails → Templates → Magic Link**
   (in older dashboards: **Authentication → Email Templates**).
2. Add a line with the code to the message body, for example:
   ```html
   <p>Or type this code in Sanctum: <strong>{{ .Token }}</strong></p>
   ```
3. Click **Save**.

The website accepts both the link and the code.

## Your data

Your study is saved to your Sanctum account (Supabase) and on each device you
use, so the website, your phone and the desktop app all show the same thing.

- **Every change** is saved on the device straight away and to your account a
  moment later. The account icon at the bottom of the sidebar shows whether
  the latest change has reached your account.
- **Offline.** On a device you've used before, Sanctum opens with what's on
  that device and sends your changes when the connection comes back.
- **A new device** waits until it has loaded your account's data before it
  opens, so it can never replace your data with a blank study.
- **Several devices.** When you switch back to Sanctum, it picks up changes
  made elsewhere. If two devices change things while both are offline, the
  most recent change wins.
- **Signing out** sends any unsent change first.

## Run and build it yourself

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev        # the website at http://localhost:5173/sanctum/
npm run build      # the website's files in dist/ (deployed by deploy.yml)
```

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
deploying on every push to `main` as before.

1. Raise the version in `package.json`, `src-tauri/tauri.conf.json` and
   `src-tauri/Cargo.toml`, for example to `1.1.0`.
2. Commit, then either open **Actions → Build desktop installers → Run
   workflow**, or push a tag: `git tag v1.1.0 && git push --tags`.
3. When both builds are green, open **Releases**, check the draft and click
   **Publish release**.

## Project structure

| Path | What it is |
| --- | --- |
| `src/App.tsx` | The whole app: pages, components, state and styling |
| `src/sync.ts` | The rules for keeping devices and your account in step |
| `src/desktop.ts` | The few differences in the desktop app (links open in your browser) |
| `src/supabase.ts` | The connection to your Supabase project |
| `vite.config.ts` | Builds the website for `/sanctum/` and the desktop app for its own root |
| `src-tauri/` | The desktop app shell: window, icons, installer settings (`tauri.conf.json`) |
| `assets/app-icon.svg` | The app icon. After editing, export a 1024 px PNG to `assets/app-icon.png` and run `npx tauri icon assets/app-icon.png` |
| `.github/workflows/deploy.yml` | Publishes the website to GitHub Pages |
| `.github/workflows/build-desktop.yml` | Builds the Windows and Mac installers |

## Tech stack

React 18, TypeScript, Vite, Tailwind CSS and [lucide-react](https://lucide.dev/)
icons; [Supabase](https://supabase.com) for sign-in and sync; [Tauri](https://tauri.app)
for the desktop app.

## License

Personal project — not licensed for redistribution or commercial use.

© Caffeine Not Included
