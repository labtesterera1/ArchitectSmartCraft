# ArchitectSmartCraft

A PWA for creating architecture diagrams and getting plain-language explanations of existing ones. Works offline, installs to your home screen / app list, and runs on both desktop (Edge) and Android (Chrome).

## Project structure

```
ArchitectSmartCraft/
├── index.html              # App shell
├── manifest.json           # PWA manifest (icons, name, colors)
├── sw.js                   # Service worker (offline caching)
├── css/
│   └── theme.css           # Design tokens — instrument-panel aesthetic
├── js/
│   ├── main.js              # Router — wires modules to nav buttons
│   ├── storage.js           # IndexedDB wrapper (shared by all modules)
│   └── version.js           # App version — bump this on every release
├── modules/
│   ├── create-diagram/
│   │   └── create-diagram.js     # Module 1: build diagrams
│   ├── analyze-diagram/
│   │   └── analyze-diagram.js    # Module 2: upload + explain diagrams
│   └── settings/
│       ├── settings.js           # API config, export/import, install logic
│       └── settings-view.js      # Settings screen UI
└── assets/
    ├── logo.svg
    ├── logo-maskable.svg
    ├── icon-192.png
    ├── icon-512.png
    └── icon-maskable-512.png
```

Each module only talks to `storage.js` for data — never to IndexedDB directly. That's what keeps them independent: you can rebuild `create-diagram.js` from scratch and nothing in `analyze-diagram.js` or `settings.js` breaks.

## How to deploy and test (GitHub Pages)

Service workers and the install prompt **require HTTPS** (or localhost). GitHub Pages gives you free HTTPS hosting, which is the easiest path to testing on your Android phone.

### 1. Push this code to your repo

```bash
git clone https://github.com/labtesterera1/ArchitectSmartCraft.git
cd ArchitectSmartCraft
# copy all the files from this delivery into this folder
git add .
git commit -m "Initial PWA shell: storage, modules, manifest, service worker"
git push origin main
```

### 2. Enable GitHub Pages

1. Go to your repo on GitHub → **Settings** → **Pages**
2. Under "Build and deployment", set **Source** to "Deploy from a branch"
3. Set **Branch** to `main` and folder to `/ (root)`
4. Save. GitHub will give you a URL like:
   `https://labtesterera1.github.io/ArchitectSmartCraft/`
5. Wait 1–2 minutes for the first deploy, then open that URL

### 3. Test on laptop (Edge)

1. Open the GitHub Pages URL in Edge
2. You should see the app shell load with the Create / Analyze / Settings nav
3. Go to **Settings** → click **Install app** (or use Edge's menu → Apps → "Install this site as an app")
4. Confirm it opens in its own window, no browser chrome

### 4. Test on Android (Chrome)

1. Open the same GitHub Pages URL in Chrome on your phone
2. Chrome should show an install banner, or go to Settings → **Install app**
3. Confirm it adds an icon to your home screen and opens full-screen

### 5. Test offline mode

1. With the app open once (so the service worker has cached it), turn on airplane mode
2. Reload the app — it should still load from cache
3. Diagrams and analyses you've saved should still be there (IndexedDB persists locally regardless of network)

## Version bumping

Whenever you change any file:

1. Bump `APP_VERSION` in `js/version.js`
2. Bump `CACHE_VERSION` in `sw.js` to the same value

This forces the service worker to drop the old cache and fetch your new files instead of serving stale ones. Skipping this step is the most common reason a PWA "doesn't update" after you've pushed new code.

## API keys (optional)

Go to **Settings** in the app to add a Groq, Cerebras, or Mistral API key. This enables automatic explanations in the Analyze module. Keys are stored only in IndexedDB on your device — never sent anywhere except directly to the provider you choose. If you skip this, Analyze still works — you just type the explanation yourself instead of generating it.

## What's built so far

- **Create Diagram (v4)** — real icon-based top toolbar (zoom in/out, fit-to-view, undo/redo, delete, download PNG) and an icon-tile shape palette beside the canvas with **13 shapes** (box, process, circle, decision, triangle, database/cylinder, hexagon, input/output parallelogram, cloud, callout, actor/person, document, text), drag nodes to position, drag from edge handles to connect nodes, **fill color picker** (7 swatches, appears as a floating toolbar on a selected node), **waypoints** — double-click/double-tap a connector to add a routing point, drag it to reshape the line, double-click/double-tap a waypoint to remove it, click to select + delete, double-click/double-tap to rename, undo/redo history, scroll to zoom + drag to pan, connector line-style picker (straight / curved / right-angle), save/load, Download as PNG (waypoints and fill colors included in the exported image)
- **Analyze Diagram (v2)** — upload an image, choose one of three explanation styles (step-by-step, real-world example, suggestions) via toggle buttons, each generated on demand and cached per upload, **works fully without an API key** — write your own explanation manually any time
- **Settings** — API key config (masked as a password field with a Show/Hide toggle), install button, export/import all data as JSON
- **Storage** — IndexedDB wrapper with three stores: diagrams, analyses, settings
- **PWA shell** — manifest, service worker, offline caching, installable on both platforms

## What's not built yet (future iterations)

- Connector labels (text on the line itself)
- Multi-select, copy/paste in the diagram editor
- Snapping/alignment guides
- Custom color picker beyond the 7 preset swatches
- Any additional modules beyond Create / Analyze / Settings
