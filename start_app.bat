@echo off
title Component Tracker
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo [!] Node.js nije instaliran / Node.js is not installed.
    echo     Preuzmi / Download: https://nodejs.org  ^(LTS, 22.13 ili noviji / or newer^)
    echo.
    start https://nodejs.org
    pause
    exit /b 1
)

node scripts\prepare.mjs
if errorlevel 1 (
    pause
    exit /b 1
)

set OPEN_BROWSER=1
node --disable-warning=ExperimentalWarning server\index.js
if errorlevel 1 pause
