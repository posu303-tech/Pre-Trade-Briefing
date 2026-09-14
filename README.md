# Pre-Market Technical Brief - Sell-Side Trading Desk

Institutional pre-market technical brief and intraday trade planning terminal for BTC, ETH, SOL, and XAUT.

## GitHub Pages Deployment (Automatic)

This repository includes a ready-to-run GitHub Actions workflow (`.github/workflows/deploy.yml`).

### Quick Setup:
1. Go to your GitHub repository: **Settings** > **Pages**.
2. Under **Build and deployment** > **Source**, select **GitHub Actions**.
3. Push any commit to `main` (or run the workflow manually under the **Actions** tab).
4. GitHub Pages will build and publish your site at `https://<your-username>.github.io/<repo-name>/`.

---

## Alternative Deployments

### 1. Vercel / Netlify / Cloudflare Pages
- **Framework Preset:** Vite
- **Build Command:** `npm run build:client` (or `npm run build`)
- **Output Directory:** `dist`

### 2. Local Development
```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Open in browser at http://localhost:3000
```

### 3. Production Node Server
```bash
npm run build
npm start
```
