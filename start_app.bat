@echo off
title Component Tracker Startup

echo Starting Node server...
start cmd /k "npm start"

echo Waiting for server to boot...
timeout /t 3 >nul

echo Opening browser...
start http://localhost:3000

echo Done.