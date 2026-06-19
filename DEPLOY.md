# Life RPG — Deployment Guide

## Files

| File | Purpose |
|------|---------|
| `index.html` | Main app (all CSS + JS inlined) |
| `manifest.webmanifest` | PWA manifest (required for installability) |
| `icon.svg` | App icon (referenced by manifest) |

All three files must be deployed together in the same directory.

> **Optional:** Create `icon-192.png` and `icon-512.png` from `icon.svg` using any SVG→PNG tool (e.g. Inkscape, Figma, or `rsvg-convert`) for best Android/Chrome compatibility. If they're missing, the SVG icon is used as fallback.

---

## Option 1 — GitHub Pages (free, recommended)

```bash
# 1. Create a new GitHub repo named "life-rpg" (or any name)
#    at https://github.com/new

# 2. Push the files
git init
git add index.html manifest.webmanifest icon.svg
git commit -m "Initial Life RPG deployment"
git remote add origin https://github.com/YOUR_USERNAME/life-rpg.git
git push -u origin main

# 3. Enable GitHub Pages
#    → Repo Settings → Pages → Source: Deploy from branch → main / root → Save

# 4. Your app is live at:
#    https://YOUR_USERNAME.github.io/life-rpg/
```

---

## Option 2 — Netlify Drop (drag and drop, ~10 seconds)

1. Go to **https://app.netlify.com/drop**
2. Drag the entire `LifeRPG/` folder onto the page
3. Netlify instantly deploys and gives you a URL like `https://random-name-123.netlify.app`
4. (Optional) Click "Claim your site" to get a custom subdomain

---

## Option 3 — Vercel (one command)

```bash
# Install Vercel CLI (once)
npm i -g vercel

# Deploy from the LifeRPG folder
cd /path/to/LifeRPG
vercel

# Follow the prompts — select "No framework" / static site
# Your app deploys to: https://life-rpg.vercel.app (or similar)
```

---

## Installing on iPhone (Safari)

1. Open Safari and navigate to your deployed URL
2. Tap the **Share button** (box with arrow pointing up, bottom toolbar)
3. Scroll down and tap **"Add to Home Screen"**
4. Edit the name if desired, tap **"Add"**
5. The app icon appears on your home screen — launch it for full-screen experience

> The app uses `apple-mobile-web-app-status-bar-style: black-translucent` so it extends under the Dynamic Island / notch. Safe area insets prevent content from being hidden behind the home indicator.

---

## Installing on Android Chrome

1. Open Chrome and navigate to your deployed URL
2. Tap the **three-dot menu** (top right)
3. Tap **"Add to Home screen"** (or "Install app" if shown as a banner)
4. Tap **"Add"** in the dialog
5. The app icon appears in your app drawer and home screen

---

## Local Testing (no server needed)

Open `index.html` directly in Chrome or Firefox. Note: the Service Worker won't register from `file://` URLs (browsers block SW on file:// by default), but all other features work.

To test the full PWA including SW:

```bash
# Python 3 one-liner (serves on http://localhost:8000)
python3 -m http.server 8000 --directory /path/to/LifeRPG

# Or using npx serve
npx serve /path/to/LifeRPG
```

Then open `http://localhost:8000` in Chrome and check DevTools → Application → Service Workers.
