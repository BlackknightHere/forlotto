@echo off
chcp 65001 >nul
title Lotto Lung Meaw - do not close this window while using the app
cd /d "%~dp0"
if not exist "node_modules" (
  echo [!] Please run "1-install.bat" first
  pause
  exit /b 1
)
node server\needs-build.js
set NB=%errorlevel%
if "%NB%"=="2" (
  echo Installing new version... please wait
  call npm install || goto fail
)
if not "%NB%"=="0" (
  echo Updating app... please wait
  call npm run build || goto fail
)
node server/index.js --open
if errorlevel 1 pause
exit /b
:fail
echo [!] Update failed. Please send a screenshot of this window.
pause
exit /b 1
