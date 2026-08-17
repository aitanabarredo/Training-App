# Training Trail

Your personal training tracker — flexible daily plan, per-set logging with a live "last time" reference, warm-up/cooldown checklists, progress charts, and an AI trainer check-in.

Built with Vite + React, same stack as bicing-app.

## 1. Run it locally

In VS Code, open this folder, then **Open in Integrated Terminal** (right-click the folder, or Terminal → New Terminal) and run:

```
npm install
npm run dev
```

Open the URL it prints (usually `http://localhost:5173`). Everything you log is saved in your browser (`localStorage`) — nothing leaves your machine at this stage.

## 2. Push it to GitHub

Same as bicing-app:

1. Create a new empty repo on GitHub (no README/gitignore, this folder already has one).
2. In this folder's terminal:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin <your-repo-url>
   git push -u origin main
   ```
   Or use **GitHub Desktop** if you'd rather avoid the terminal: File → Add Local Repository → select this folder → Publish repository.

## 3. Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import the GitHub repo you just created.
2. Vercel auto-detects Vite — leave the defaults (Build Command `npm run build`, Output Directory `dist`).
3. **Before your first deploy**, add one environment variable (this is what powers the "Ask your trainer" AI check-in):
   - Go to your new Vercel project → **Settings → Environment Variables**
   - Add `ANTHROPIC_API_KEY` = your own Anthropic API key (get one at [console.anthropic.com](https://console.anthropic.com))
   - Apply it to Production, Preview, and Development
4. Click **Deploy**. You'll get a live `.vercel.app` URL.

Without the API key, everything works except the "Ask your trainer" button — the plan, logging, warm-ups, cooldowns, and progress charts are all local and don't need it.

## Notes

- Data lives in your browser's `localStorage`, per-device. There's no login and no shared backend, so it won't sync between your phone and laptop unless you add one later.
- The "Quick reads" in the Trainer tab are instant and local (no API key needed) — they compare your last two sessions per exercise.
- The "Ask your trainer" button calls `/api/trainer`, a small serverless function in `api/trainer.js` that keeps your API key server-side instead of exposing it in the browser.
- To reset the plan to the original weekly split, use **Plan → Reset to default plan**.
