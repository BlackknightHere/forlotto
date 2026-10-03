@echo off
chcp 65001 >nul
title Lotto Lung Meaw - do not close this window while using the app
cd /d "%~dp0"
if not exist "node_modules" (
  echo [!] Please run "1-install.bat" first
  pause
  exit /b 1
)
if not exist "dist\index.html" call npm run build
node server/index.js --open
pause
