@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >/dev/null 2>nul
if errorlevel 1 (
  echo [!] Node.js is not installed. Please install it from https://nodejs.org  (LTS version^)
  pause
  exit /b 1
)
echo Installing... please wait
call npm install
if errorlevel 1 goto fail
call npm run build
if errorlevel 1 goto fail
echo.
echo ==== DONE! Double-click "2-open-app.bat" to start ====
pause
exit /b 0
:fail
echo [!] Install failed. Please send a screenshot of this window.
pause
exit /b 1
