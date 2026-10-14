@echo off
setlocal
cd /d "%~dp0"
if not exist "node_modules" (
  echo Dependencies are not installed yet.
  echo Run: npm install
  pause
  exit /b 1
)
start "WardLens Development" /D "%~dp0" cmd /k "npm run dev"
timeout /t 4 /nobreak >nul
start "" http://localhost:5173
endlocal
