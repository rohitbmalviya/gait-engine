# 🦶 GaitPro — Advanced Gait Analysis Dashboard

A **100% client-side** gait analysis dashboard for biomechanical assessment. Analyze walking patterns from force data or video with skeleton tracking — no backend, no build step, no data ever leaves the browser.

![HTML5](https://img.shields.io/badge/HTML5-vanilla-orange) ![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow) ![Chart.js](https://img.shields.io/badge/Chart.js-4-ff6384) ![No Build](https://img.shields.io/badge/build-none-brightgreen)

---

## ✨ Features

- 📊 **Dashboard** — total steps, cadence, peak force, duration, and symmetry index at a glance, with asymmetry alerts
- 🎬 **Video Analysis** — play a walking video with a **MediaPipe skeleton overlay**, live joint angles (knee, hip, ankle, trunk lean), gait phase detection, and frame-by-frame stepping
- 📈 **Force-Time Graph** — ground reaction force curves for left vs right foot
- 🔬 **Gait Parameters** — step-by-step table and charts: peak force, contact time, cadence, loading rate, impulse
- ⚖️ **Symmetry analysis** — left/right comparison with configurable asymmetry alert thresholds
- ⚡ **Demo data included** — one click loads a real recorded walking session (video + skeleton CSV) from the bundled `1/` folder
- 📤 **CSV export** of full analysis results
- ⚙️ **Tunable detection settings** (force threshold, step duration limits) persisted in localStorage

## 🛠 Tech Stack

- **Vanilla JavaScript (ES6)** — no framework, no bundler, no dependencies to install
- **Chart.js 4** (via CDN) for all charts
- **Canvas API** for the skeleton overlay renderer
- Everything runs in the browser — works offline after first load

## 🚀 Setup & Run

No install, no build. Just serve the folder over HTTP:

```bash
cd gait-engine
python3 -m http.server 8000
```

Open **http://localhost:8000** 🎉

Any static server works (`npx serve`, VS Code Live Server, nginx, …).

> ⚠️ **Don't open `index.html` directly via `file://`** — browsers block `fetch()` on local files, so the "Load Demo Data" buttons can't read the bundled `1/` folder. Everything else still works, and the dashboard falls back to synthetic data with a notice.

## 🕹 Using the app

### Option 1 — Demo data (fastest)

Click **⚡ Load Demo Data**:

- On the **Dashboard** (or Data Import page) → loads the bundled skeleton CSV, converts it to force data, and runs the full analysis (~40 s walk, 56 steps)
- On the **Video Analysis** page → loads the bundled walking video **and** skeleton CSV, then starts playback with the skeleton overlay automatically

### Option 2 — Your own data

**Force CSV** (Data Import page):

```csv
timestamp,left_force,right_force
0.00,0.0,120.5
0.01,5.2,340.1
```

**Skeleton CSV** (Video Analysis page, or Data Import — it's auto-detected):
MediaPipe Pose format — `timestamp` + 33 landmarks × 4 columns (`x, y, z, visibility`), 133 columns total. Timestamps may be in seconds, milliseconds, or microseconds — the unit is auto-detected. Rows without landmark data (no person detected) are allowed.

**Video**: MP4, WebM, or MOV. (AVI files can't be played by browsers — convert to MP4 first.)

## 🗂 Project structure

```
gait-engine/
├── index.html          # Single-page app: all views (dashboard, import, video, …)
├── index.css           # Dark theme styling
├── app.js              # SPA navigation, state, event wiring, demo-data loading
├── data.js             # Demo data generator + CSV parsers (force & skeleton→force)
├── gait-engine.js      # Core analysis: step detection, cadence, symmetry, gait cycle
├── charts.js           # Dashboard/force/parameter charts (Chart.js)
├── skeleton-data.js    # MediaPipe CSV parser, joint angle math, gait phase detection
├── video-player.js     # Video playback + canvas skeleton overlay renderer
├── video-charts.js     # Joint angle timeline charts with playhead
├── 1/                  # Bundled demo recording (video .mp4 + skeleton .csv)
├── favicon.svg/.ico, apple-touch-icon.png, icon-*.png, site.webmanifest
└── robots.txt, sitemap.xml
```

Script load order matters and is already set in `index.html`: `data.js → gait-engine.js → charts.js → skeleton-data.js → video-player.js → video-charts.js → app.js`.

## 🧠 How the analysis works

1. **Step detection** — foot contact begins when force crosses the threshold (default 20 N) and ends when it drops below; contacts shorter than the minimum stance duration are discarded as noise
2. **Per-step metrics** — peak force, contact time, loading rate (force/time to peak), impulse (force × time), cadence from inter-step intervals
3. **Symmetry index** — `|L − R| / avg(L, R) × 100%` per parameter; alerts fire above the configured threshold (default 10%)
4. **Video mode** — joint angles computed from landmark triplets (e.g. knee = hip–knee–ankle angle); stance/swing phase from ankle height relative to hip
5. **Skeleton → force conversion** — when a skeleton CSV is used for the dashboard, ankle-height-based ground contact generates pseudo ground-reaction forces so the whole force pipeline works from video data alone

## ⚙️ Settings

Available in the **Settings** view, applied live and saved to localStorage:

| Setting | Default | Purpose |
|---|---|---|
| Force threshold | 20 N | Minimum force to count as foot contact |
| Min step duration | 200 ms | Filters out noise spikes |
| Max step duration | 2000 ms | Prevents merged steps |
| Asymmetry alert threshold | 10% | When to flag L/R differences |

## ☁️ Deployment

It's a static site — host it anywhere (GitHub Pages, Netlify, Vercel, S3):

1. Upload the whole folder (including `1/` if you want the demo button to work)
2. Replace the placeholder domain `gaitpro.example.com` with your real URL in `index.html` (canonical/OG/JSON-LD), `robots.txt`, and `sitemap.xml`
3. Submit `sitemap.xml` in [Google Search Console](https://search.google.com/search-console) to get indexed

---

Built by **Rohit Malviya** — full-stack developer.
