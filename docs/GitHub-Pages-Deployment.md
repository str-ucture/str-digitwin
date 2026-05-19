# Deploying to GitHub Pages

This guide walks you through publishing the STR Digital Twin map to GitHub Pages without exposing any API keys in the repository.

---

## How secrets are kept out of the repo

All API keys live in **GitHub Actions secrets** — they are injected at build time as environment variables and baked into the compiled JS bundle. The `.env` file on your machine is listed in `.gitignore` and is never committed. The `.env.example` file contains only placeholder values and is safe to commit.

| Variable | What it is | Safe to expose? |
|---|---|---|
| `VITE_MAPBOX_TOKEN` | Mapbox GL JS access token | Yes — but restrict it to your Pages domain |
| `VITE_SUPABASE_URL` | Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Supabase public/anon key | Yes — designed for browser use |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key | **No** — backend scripts only, never in frontend |

---

## Step 1 — Create the GitHub repository

1. Go to [github.com](https://github.com) and click **New repository**.
2. Name it (e.g. `str-digitwin`). Choose **Private** if you want, Pages works with both.
3. Leave "Initialize repository" **unchecked** — you already have local files.
4. Click **Create repository**.

---

## Step 2 — Push the project

Open a terminal in the project root and run:

```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

> The `.gitignore` already excludes `node_modules/`, `dist/`, and all `.env` files, so no secrets or build artefacts will be uploaded.

---

## Step 3 — Add GitHub Actions secrets

These replace the values in your local `.env` file during CI builds.

1. On GitHub, open your repository and go to **Settings → Secrets and variables → Actions**.
2. Click **New repository secret** for each of the following:

| Secret name | Where to find the value |
|---|---|
| `VITE_MAPBOX_TOKEN` | [account.mapbox.com](https://account.mapbox.com) → Tokens |
| `VITE_SUPABASE_URL` | Supabase dashboard → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API → `anon public` |
| `VITE_BASE_PATH` | `/` for a user/org page, `/<repo-name>/` for a project page (e.g. `/str-digitwin/`) |

> Do **not** add `SUPABASE_SERVICE_ROLE_KEY` here — it is used only by local backend scripts and must never reach GitHub Actions or the browser bundle.

---

## Step 4 — Enable GitHub Pages

1. In your repository go to **Settings → Pages**.
2. Under **Source** select **GitHub Actions**.
3. Click **Save**.

That's it. The workflow file at [.github/workflows/deploy.yml](../.github/workflows/deploy.yml) already handles building and deploying automatically on every push to `main`.

---

## Step 5 — Restrict your Mapbox token (important)

Even though the Mapbox token ends up in the browser bundle, you can prevent it from being abused on other domains:

1. Go to [account.mapbox.com](https://account.mapbox.com) → **Tokens**.
2. Open the token you are using (or create a new one).
3. Under **URL restrictions**, add your GitHub Pages URL:
   - User/org page: `https://<your-username>.github.io`
   - Project page: `https://<your-username>.github.io/<repo-name>`
4. Save. Mapbox will now reject requests from any other origin.

---

## Step 6 — Verify the deployment

After pushing to `main`:

1. Go to **Actions** in your repository to watch the workflow run.
2. Once it turns green, visit the Pages URL shown in **Settings → Pages**.
3. The map should load with all data intact.

If the map is blank or tiles are missing, check the browser console for 401/403 errors — this usually means a secret name is mistyped or the Mapbox token is domain-restricted too narrowly.

---

## Supabase Row Level Security (optional but recommended)

The Supabase anon key is intentionally public, but you should ensure your database tables have **Row Level Security (RLS)** policies so anonymous users can only read the data you intend to expose.

1. In the Supabase dashboard go to **Authentication → Policies**.
2. For each table, enable RLS and add a `SELECT` policy for the `anon` role.
3. The seed migration in [supabase/migrations/001_initial.sql](../supabase/migrations/001_initial.sql) already enables RLS — verify the policies are in place after seeding.

---

## Local development

Nothing changes locally. Copy `.env.example` to `.env`, fill in your real values, and run:

```bash
npm install
npm run dev
```

The `.env` file is ignored by git so your keys stay on your machine.
