# Component Tracker

[![Node.js](https://img.shields.io/badge/Node.js-22.13+-green)](https://nodejs.org/en)
![Architecture](https://img.shields.io/badge/architecture-local--first-blue)
[![Database](https://img.shields.io/badge/database-SQLite-lightgrey)](https://sqlite.org/)
![Status](https://img.shields.io/badge/status-stable-brightgreen)
![Vue](https://img.shields.io/badge/frontend-Vue%203-42b883)
[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-red.svg)](LICENSE)
[![Donate](https://img.shields.io/badge/Donate-PayPal-blue)](https://paypal.me/yumera)

---

Component Tracker is a local-first web application for managing electronic
components in personal workshops and small labs.

All data is stored locally in a single SQLite file. No cloud services, no
external database server – the app runs on your own computer and is usable
from any browser on your local network (including a phone).

---

## Features

**Components**
- Fast list with filters (stock status, categories, nested locations), multi-token search and sorting
- Quick `+ / −` stock changes directly in the list (Shift = ±10)
- Side panel for viewing and editing without leaving the list – everything on one screen
- Separate tabs for a large photo (full-screen zoom), parameters and stock history
- Bulk actions: move to location, change category, delete
- CSV and text export of the filtered or selected list
- Duplicate detection by MPN with "add to existing stock"

**Stock and locations**
- The same component can be stored in several locations, each with its own quantity
- Nested locations (Cabinet › Drawer › Box), created on the fly by typing a path
- Every stock change is logged (initial, quick change, manual edit, move)
- Printable QR labels per location – scanning one opens that location's component list

**Online lookup (Element14 / Mouser)**
- All enabled services are queried in parallel and results are merged by MPN
- Up to 25 candidates per service instead of only the first hit
- Variants are grouped into families (e.g. `NE555D` / `NE555DR` / `NE555DRG4`) with package, lifecycle status and supplier stock
- Shows when a candidate is already in your inventory
- Field-by-field preview: choose exactly which values overwrite the form
- Catalog parameters are intentionally not imported (no units, duplicates, customs/RoHS data) – key values stay in the description, details in the datasheet; the Parameters tab is for your own notes
- Results are cached for 24 h to save API quota

**Local-first**
- Images are downloaded and stored locally when a component is saved; datasheets on demand
- One-click consistent backup (`VACUUM INTO`) with download from the browser
- English and Serbian UI, light / dark / system theme
- Update check against `version_info.json`

---

## Installation

### Prerequisites

- **Node.js 22.13 or newer** (https://nodejs.org/) – the app uses Node's built-in SQLite module, so no native build tools are needed.

### Quick start

1. Download the repository (green **Code → Download ZIP** button on GitHub, then unzip) or clone it:
   ```bash
   git clone https://github.com/YuMERA/component-tracker.git
   ```
2. Start the app:
   - **Windows:** double-click `start_app.bat`
   - **macOS / Linux:** run `./start.sh` in a terminal

The first start installs dependencies and builds the frontend (about a minute, internet required).
Later starts take a few seconds. The browser opens automatically at http://localhost:3000.
To stop the app, close the window (or press Ctrl+C).

### Updating

Download the new version and either unzip it over the existing folder or replace the folder and copy
your `data/` folder into it. The start script detects the change and reinstalls / rebuilds only what is needed.
Your data in `data/` is never touched by an update.

### Manual start

```bash
npm install
npm run build
npm start
```

### Windows installer (`setup.exe`) – experimental

A single `ComponentTracker-setup-<version>.exe` that needs **nothing else** on the computer (no Node.js, no npm):

| What | Where |
|---|---|
| Program | `C:\Program Files\ComponentTracker\` |
| Data (database, images, datasheets, backups, logs) | `C:\ProgramData\ComponentTracker\` |
| Windows service | "Component Tracker" – starts with Windows, restarts itself if it stops |
| Shortcut | "Component Tracker" on the desktop and in the Start menu |
| Firewall rule | "Component Tracker" (private networks) – so a phone on the LAN can open it |

The shortcut opens the browser; if the service is not running, it starts the app first.
Installing a new setup over the old one stops the service, copies the database to
`backups\inventory-before-upgrade-<date>.db`, replaces the program and starts it again.
Uninstalling removes the program, service, shortcut and firewall rule – **the data folder is kept**.

Windows shows "Windows protected your PC" because the program is not code-signed:
**More info → Run anyway**.

Building the installer (Windows, Node 22.13+, [Inno Setup 6](https://jrsoftware.org/isinfo.php)):

```bash
npm run build:setup        # → release/ComponentTracker-setup-<version>.exe
npm run build:exe          # only release/ComponentTracker/ComponentTracker.exe, without the installer
```

The service wrapper is [WinSW](https://github.com/winsw/winsw) 2.12 (MIT license, `installer/winsw/`).

### Releasing a new version (maintainer checklist)

1. Raise `"version"` in `package.json` (e.g. `3.0.0` → `3.0.1`).
2. `npm run build:setup` → `release/ComponentTracker-setup-<version>.exe`.
3. Test it: run the new setup over the installed version. The database is copied to
   `C:\ProgramData\ComponentTracker\backups\inventory-before-upgrade-<date>.db` first.
4. Commit and push, then on GitHub: **Releases → Draft a new release**, tag `v<version>`,
   write what is new and drag the setup `.exe` into the assets.
5. In `version_info.json` set `latest_version`, point `download_url` to that release page and add
   an entry to `versions`. Commit and push it: every running copy checks this file at start and
   shows "A new version is available" in Settings.

Users update the same way as they installed: download the new setup and run it. Data is kept.

### Configuration (optional `.env`)

From the source folder the `.env` file sits in the project root; the installed program reads it from
`C:\ProgramData\ComponentTracker\.env`.

| Variable | Default | Purpose |
|---|---|---|
| `APP_PORT` | `3000` | HTTP port |
| `CT_DATA_DIR` | `data/` (installed: `C:\ProgramData\ComponentTracker`) | Data folder (environment variable, not `.env`) |
| `VERSION_URL` | GitHub raw `version_info.json` | Update check source |
| `GITHUB_TOKEN` | – | Only needed while the repository is private |

API keys for Element14 and Mouser are entered in **Settings → API services** and stored in the local database.

### Development

```bash
npm run dev
```

Starts the API server on :3000 (auto-restart on changes) and the Vite dev server with hot reload on http://localhost:5173.

The in-app **Guide** (`client/src/guide/content.js`) uses screenshots from `client/public/guide-shots/`.
After UI changes, refresh them (Windows with Edge, or set `CHROME_PATH`):

```bash
npm run guide:screens        # both languages; or: npm run guide:screens -- sr
```

The script starts the app with made-up demo data in a temporary folder – your own database is never used.

---

## Data and Backup

Everything the app stores lives in `data/` (ignored by git):

```
data/
├── inventory.db      SQLite database
├── images/           local copies of component images
├── datasheets/       local copies of datasheets
└── backups/          backups created from Settings
```

Backups are created from **Settings → Backup** and can be downloaded from the browser.
To restore, stop the app and replace `data/inventory.db` with a backup file.
Copying the whole `data/` folder is a complete backup including images and datasheets.

---

## Tech Stack

- **Backend:** Node.js, Express 5, SQLite (`node:sqlite`), versioned migrations
- **Frontend:** Vue 3, PrimeVue 4, Vue Router, vue-i18n, Vite
- **Lookup providers:** Element14 (Farnell) and Mouser search APIs

---

## Project Structure

```
component-tracker/
├── server/
│   ├── index.js              Express app: API, local files, built frontend
│   ├── config.js             Paths, port, .env
│   ├── db/                   Connection + versioned migrations
│   ├── routes/               components, catalog (categories/locations), system
│   ├── services/             Business logic: stock, locations, files, backup, updates
│   └── providers/            Element14 / Mouser + merging, variant families, cache
├── client/
│   ├── index.html
│   └── src/
│       ├── App.vue           Shell: navigation, global component panel
│       ├── views/            Dashboard, Components, Locations, Categories, Settings
│       ├── components/       Component panel, lookup dialog, filters, stock editor…
│       ├── i18n/             sr.json, en.json
│       ├── store.js          Shared state
│       └── api.js            All API calls
├── data/                     Local data (git-ignored)
├── version_info.json         Release notes / update feed
├── start_app.bat / start.sh  Quick start (Windows / macOS, Linux)
├── scripts/                  prepare.mjs (start scripts), build-exe / build-setup (Windows installer), make-icon
├── installer/                Inno Setup script, Windows service (WinSW) config, app icon
└── vite.config.js
```

---

## Security and Deployment Notes

This application is intended for local use. It listens on all network interfaces so that phones on
the same network can open QR-label links; Windows may ask to allow Node.js through the firewall.

For remote access use a VPN (for example WireGuard) and do not expose the app directly to the
internet. Authentication is not enforced.

---

## License

This project is licensed under the Creative Commons
Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0).

Commercial use is NOT permitted.

See the LICENSE file for full details.
