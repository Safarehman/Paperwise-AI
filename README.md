# PaperWise AI

Turns scanned pages into clean, styled documents. React + Vite frontend,
with two small Netlify functions that talk to Claude so your API key stays private.

You do NOT need to install anything on your computer. Netlify builds this for you
in the cloud. Everything below happens in your web browser.

---

## What you need first
1. A free GitHub account  ->  https://github.com
2. Your Netlify account (you already have one)
3. An Anthropic API key with a little credit  ->  https://console.anthropic.com
   (This is what pays for each scan. Keep it secret.)

---

## Step 1 — Put this project on GitHub (drag & drop, no coding)
1. Go to https://github.com and click **New repository**. Name it "paperwise". Create it.
2. On the new repo page, click **Add file -> Upload files**.
3. Unzip this folder on your computer, then drag ALL the files and folders into the
   upload box. (Do not upload a `node_modules` folder if one exists — it isn't needed.)
4. Click **Commit changes**.

## Step 2 — Connect Netlify
1. In Netlify: **Add new site -> Import an existing project -> GitHub**.
2. Pick your "paperwise" repository.
3. Netlify reads the settings automatically (build command `npm run build`, publish
   folder `dist`). Just click **Deploy**.

## Step 3 — Add your secret key
1. In your new site: **Site configuration -> Environment variables -> Add a variable**.
2. Key:   ANTHROPIC_API_KEY
   Value: (paste your Anthropic key)
3. Save, then go to **Deploys -> Trigger deploy -> Deploy site** so it picks up the key.

## Step 4 — Open your live site
Click the site link Netlify gives you. Upload a photo of a page and watch it organize.

---

## Making changes later
Edit files right on GitHub (pencil icon) and commit — Netlify rebuilds automatically.
No tools on your computer required.

## What each part does
- `src/App.jsx` .............. the whole app (interface + logic)
- `netlify/functions/organize.js` .. reads a scanned page with Claude
- `netlify/functions/customize.js` .. the "Customize with AI" design chat
- `netlify.toml` ............. tells Netlify how to build
- everything else ........... standard React/Vite project files
