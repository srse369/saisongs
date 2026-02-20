# Using Sai Songs Offline

The app can run without an internet connection after you've loaded it at least once while online.

## How It Works

1. **First visit (online required)**  
   Open the app in your browser while connected to the internet. The service worker will cache the HTML, CSS, and JavaScript files.

2. **Later visits (offline)**  
   After that, you can open the app when offline. The browser will serve the cached files.

## Steps to Use Offline

### 1. Visit the app once while online

- Open the app in your browser (e.g. `https://your-saisongs-domain.com` or `http://localhost:5111` in production).
- Wait for the page to fully load.
- Optionally use **Take Offline** (editors/admins) to cache songs, singers, pitches, templates, and sessions.

### 2. Open the app when offline

- Use the same URL you used before.
- Or use **Add to Home Screen** (mobile) or **Install** (desktop) to create a shortcut.
- The app shell (HTML, CSS, JS) loads from cache; data comes from IndexedDB if you ran Take Offline.

### 3. Production build required

Offline support is enabled only in the **production build**. In development (`npm run dev`), the service worker is not registered.

To test offline locally:

```bash
npm run build
npm run preview   # Serves the built app, usually at http://localhost:4173
```

Then open the preview URL once while online, then try again with the network disabled.

## What Gets Cached

| When        | What                                      |
|-------------|-------------------------------------------|
| On install  | `/`, `/index.html`, `/logo1.png`, `/manifest.json` |
| On first load | JS and CSS bundles (e.g. `/assets/index-*.js`) |
| Take Offline | Songs, singers, pitches, templates, sessions (IndexedDB) |

## Troubleshooting

- **Blank page offline** – Visit the app once while online so the JS/CSS bundles are cached.
- **"No internet" in dev** – Use a production build; the service worker is disabled in dev.
- **Stale app after update** – Clear site data or use the app’s cache clear option in the status dropdown.
