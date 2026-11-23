#!/usr/bin/env sh
# Component Tracker – pokretanje na macOS / Linux (par za start_app.bat)
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
    echo
    echo "[!] Node.js nije instaliran / Node.js is not installed."
    echo "    Preuzmi / Download: https://nodejs.org  (LTS, 22.13+)"
    echo
    exit 1
fi

node scripts/prepare.mjs || exit 1

OPEN_BROWSER=1 exec node --disable-warning=ExperimentalWarning server/index.js
