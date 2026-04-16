@echo off
chcp 65001 >nul
title APK Builder Pro — Local Runner

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║        APK Builder Pro — Local Run       ║
echo  ╚══════════════════════════════════════════╝
echo.

REM ── Check Node.js ──────────────────────────────────────────
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js not found.
    echo  Download from: https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo  [OK] Node.js %NODE_VER%

REM ── Check pnpm (install if missing) ────────────────────────
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo  [INFO] pnpm not found. Installing...
    npm install -g pnpm
    if %errorlevel% neq 0 (
        echo  [ERROR] Failed to install pnpm.
        pause
        exit /b 1
    )
)
for /f "tokens=*" %%v in ('pnpm -v') do set PNPM_VER=%%v
echo  [OK] pnpm v%PNPM_VER%

REM ── Check PostgreSQL env var ────────────────────────────────
if "%DATABASE_URL%"=="" (
    echo.
    echo  [WARN] DATABASE_URL is not set.
    echo  Set it in a .env file or as an environment variable.
    echo  Example: DATABASE_URL=postgresql://user:pass@localhost:5432/apkbuilder
    echo.
    echo  You can create a free PostgreSQL database at:
    echo    https://neon.tech  or  https://supabase.com
    echo.
    set /p DBURL="  Paste your DATABASE_URL here (or press Enter to skip): "
    if not "!DBURL!"=="" (
        set DATABASE_URL=!DBURL!
    )
)

REM ── Load .env if present ────────────────────────────────────
if exist ".env" (
    echo  [INFO] Loading .env file...
    for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
        if not "%%a"=="" if not "%%b"=="" set "%%a=%%b"
    )
)

REM ── Install dependencies ────────────────────────────────────
echo.
echo  [INFO] Installing dependencies...
call pnpm install --frozen-lockfile 2>nul
if %errorlevel% neq 0 (
    call pnpm install
)
echo  [OK] Dependencies installed.

REM ── Set ports ───────────────────────────────────────────────
set API_PORT=8080
set WEB_PORT=5173
set PORT=%API_PORT%

REM ── Set Gemini AI Integration env vars (optional) ───────────
REM Uncomment and fill in if you have Replit AI Integration credentials:
REM set AI_INTEGRATIONS_GEMINI_API_KEY=your_key_here
REM set AI_INTEGRATIONS_GEMINI_BASE_URL=https://your-proxy-url

echo.
echo  [INFO] Starting API server on port %API_PORT%...
start "APK Builder — API Server" cmd /k "cd /d "%~dp0" && set PORT=%API_PORT% && pnpm --filter @workspace/api-server run dev"

echo  [INFO] Waiting for API server to start...
timeout /t 8 /nobreak >nul

echo  [INFO] Starting frontend on port %WEB_PORT%...
start "APK Builder — Frontend" cmd /k "cd /d "%~dp0" && set PORT=%WEB_PORT% && pnpm --filter @workspace/apk-builder run dev"

echo  [INFO] Waiting for frontend to start...
timeout /t 5 /nobreak >nul

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║           APK Builder Pro is ready!      ║
echo  ║                                          ║
echo  ║   Frontend:  http://localhost:%WEB_PORT%       ║
echo  ║   API:       http://localhost:%API_PORT%/api   ║
echo  ║                                          ║
echo  ║   Close this window to stop nothing.     ║
echo  ║   Close the two opened windows to stop.  ║
echo  ╚══════════════════════════════════════════╝
echo.

REM ── Open browser ────────────────────────────────────────────
start "" "http://localhost:%WEB_PORT%"

echo  [INFO] Browser opened. Press any key to exit this launcher.
pause >nul
