# Sanctum — Deploy Guide (Netlify)

Sanctum is a static React + Vite app — no backend, no database. Everything
lives in the browser (state is kept in `localStorage`), which makes Netlify a
good fit: build once, deploy a folder of static files, get a permanent URL.

## Option A: Deploy via Netlify CLI (fastest, from your own machine)

This assumes you've unzipped the `sanctum-stackblitz` project locally and have
Node.js installed.

```bash
cd sanctum-stackblitz
npm install
npm run build
```

This produces a `dist/` folder — that's the entire built app.

Install the Netlify CLI if you don't have it:

```bash
npm install -g netlify-cli
```

Then deploy:

```bash
netlify deploy --prod
```

- First time, it'll ask you to log in (opens a browser).
- When asked for a publish directory, point it at `dist`.
- When asked to link to an existing site or create a new one, choose "create
  a new site" unless you already made one in the Netlify dashboard.

You'll get a permanent URL like `https://sanctum-xyz123.netlify.app`.

## Option B: Drag-and-drop deploy (no CLI, no terminal)

1. Run the build locally first (same as above):
   ```bash
   npm install
   npm run build
   ```
2. Go to [app.netlify.com](https://app.netlify.com) and log in.
3. On the dashboard, find the "Deploy manually" / drag-and-drop area (usually
   on the **Sites** tab).
4. Drag your `dist` folder directly onto that area.
5. Netlify uploads it and gives you a live URL within seconds.

This method has no auto-redeploy — if you change the code later, you'll need
to rebuild and drag the new `dist` folder in again.

## Option C: Connect a Git repo (best long-term — auto-redeploys on push)

If you push this project to GitHub first:

1. In Netlify, click **Add new site → Import an existing project**.
2. Connect your GitHub account and pick the repo.
3. Set build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Click **Deploy**.

From then on, every time you push a change to the repo, Netlify rebuilds and
redeploys automatically — no manual steps.

## Renaming your site

By default Netlify gives you a random subdomain like
`https://chimerical-eclair-4f2a91.netlify.app`. You can rename it for free:

1. Go to **Site settings → General → Site details**.
2. Click **Change site name**.
3. Pick something like `sanctum-app` (subject to availability) — your URL
   becomes `https://sanctum-app.netlify.app`.

## A note on your data

Sanctum stores habits, tasks, focus sessions, health logs, and fasts in your
browser's `localStorage`, scoped to the URL you're using. That means:

- Data won't follow you between different browsers or devices.
- Clearing your browser's site data for that URL will wipe your Sanctum data.
- This is why getting one **stable, permanent URL** (rather than bouncing
  between StackBlitz preview links) matters — it's effectively where your
  data lives.

## Troubleshooting

**Blank page after deploy** — almost always a routing/base-path issue. Since
Sanctum is a single page with no client-side router, this is unlikely, but if
it happens, check the browser console for a 404 on a JS or CSS file and
confirm the publish directory was set to `dist`, not the project root.

**Old version still showing** — Netlify caches aggressively. Do a hard
refresh (Ctrl/Cmd + Shift + R) or redeploy.
