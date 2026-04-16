@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
title APK Builder Pro — Windows Launcher

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║         APK Builder Pro  ^|  Windows 11           ║
echo  ╚══════════════════════════════════════════════════╝
echo.

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM  STEP 1 — Load .env file (must be first)
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
if exist ".env" (
    echo  [1/7] Loading .env file...
    for /f "usebackq tokens=*" %%L in (`node -e "try{const c=require('fs').readFileSync('.env','utf8');c.split(/\r?\n/).forEach(l=>{const m=l.match(/^([^#\s][^=]*)=(.*)/);if(m)process.stdout.write('set ^\"'+m[1].trim()+'='+m[2]+'^\"'+'\n')})}catch{}"`) do (
        %%L
    )
    echo        .env loaded [OK]
) else (
    echo  [1/7] No .env file found.
    if exist ".env.example" (
        echo        TIP: Copy .env.example to .env and fill in your values.
    )
)

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM  STEP 2 — Check Node.js (v18 or newer required)
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo  [2/7] Checking Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [ERROR] Node.js is not installed.
    echo  Download the LTS version from: https://nodejs.org
    echo.
    pause & exit /b 1
)
for /f "tokens=*" %%V in ('node -v') do set NODE_VER=%%V
echo        Node.js !NODE_VER! [OK]

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM  STEP 3 — Check / install pnpm
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo  [3/7] Checking pnpm...
where pnpm >nul 2>&1
if errorlevel 1 (
    echo        pnpm not found. Installing globally via npm...
    call npm install -g pnpm >nul 2>&1
    if errorlevel 1 (
        echo  [ERROR] Failed to install pnpm. Run as Administrator or install manually:
        echo  npm install -g pnpm
        pause & exit /b 1
    )
)
for /f "tokens=*" %%V in ('pnpm -v') do set PNPM_VER=%%V
echo        pnpm v!PNPM_VER! [OK]

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM  STEP 4 — Check DATABASE_URL
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo  [4/7] Checking DATABASE_URL...
if "!DATABASE_URL!"=="" (
    echo.
    echo  [WARN] DATABASE_URL is not set!
    echo  The app needs PostgreSQL. Get a free database at:
    echo    Neon     https://neon.tech
    echo    Supabase https://supabase.com
    echo    Local    postgresql://postgres:password@localhost:5432/apkbuilder
    echo.
    set /p "DBINPUT=  Paste your DATABASE_URL (or Enter to skip): "
    if not "!DBINPUT!"=="" (
        set "DATABASE_URL=!DBINPUT!"
        echo        DATABASE_URL set.
    ) else (
        echo  [WARN] Skipped. The app will fail without a database.
    )
) else (
    echo        DATABASE_URL [OK]
)

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM  Auto-generate SESSION_SECRET if missing
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
if "!SESSION_SECRET!"=="" (
    for /f "tokens=*" %%R in ('node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"') do set "SESSION_SECRET=%%R"
    echo        SESSION_SECRET auto-generated (add to .env to make permanent).
)

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM  STEP 5 — Install dependencies
REM  --no-frozen-lockfile allows pnpm to download Windows-specific
REM  native binaries (e.g. @rollup/rollup-win32-x64-msvc) that are
REM  not included in the Linux-generated lockfile.
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo  [5/7] Installing dependencies (first run may take a few minutes)...
call pnpm install --no-frozen-lockfile
if errorlevel 1 (
    echo  [ERROR] Dependency install failed. See output above.
    echo  Try running as Administrator, or delete node_modules and try again.
    pause & exit /b 1
)
echo        Dependencies installed [OK]

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM  STEP 6 — Build API server
REM  (we call 'build' + 'start' directly to avoid bash-only
REM   'export' command in the dev npm script)
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo  [6/7] Building API server...
set "NODE_ENV=development"
call pnpm --filter @workspace/api-server run build
if errorlevel 1 (
    echo  [ERROR] API server build failed. See output above.
    pause & exit /b 1
)
echo        API server built [OK]

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM  STEP 7 — Create / migrate database tables
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo  [7/7] Running database migrations...
if not "!DATABASE_URL!"=="" (
    call pnpm --filter @workspace/db run push
    if errorlevel 1 (
        echo  [WARN] Migration error — check DATABASE_URL is reachable.
    ) else (
        echo        Migrations done [OK]
    )
) else (
    echo  [SKIP] No DATABASE_URL — skipping migrations.
)

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM  Set ports
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
set "API_PORT=8080"
set "WEB_PORT=5173"

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM  Write resolved env vars to a temp file so both
REM  server windows inherit them safely (handles @ : / etc.)
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
node -e "const fs=require('fs'),p=process.env,f=p.TEMP+'\\apkbuilder_runtime.cmd';const lines=['@echo off'];const add=(k,v)=>lines.push('set \"'+k+'='+(v||'')+'\"');add('DATABASE_URL',p.DATABASE_URL);add('SESSION_SECRET',p.SESSION_SECRET);add('NODE_ENV','production');fs.writeFileSync(f,lines.join('\r\n')+'\r\n');"

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM  Launch API server in a new window
REM  (runs node directly — no bash 'export' needed)
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo  Starting API server on port !API_PORT!...
start "APK Builder — API (port !API_PORT!)" cmd /k ^
    "cd /d "%~dp0" ^& call "%TEMP%\apkbuilder_runtime.cmd" ^& set PORT=!API_PORT! ^& node --enable-source-maps artifacts\api-server\dist\index.mjs"

echo  Waiting 8 seconds for API server to be ready...
timeout /t 8 /nobreak >nul

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM  Launch Vite frontend dev server in a new window
REM  BASE_PATH=/ enables the local /api proxy to port 8080
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo  Starting frontend on port !WEB_PORT!...
start "APK Builder — Frontend (port !WEB_PORT!)" cmd /k ^
    "cd /d "%~dp0" ^& set PORT=!WEB_PORT! ^& set BASE_PATH=/ ^& pnpm --filter @workspace/apk-builder run dev"

echo  Waiting 6 seconds for frontend to start...
timeout /t 6 /nobreak >nul

REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REM  Open browser
REM ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo  Opening browser...
start "" "http://localhost:!WEB_PORT!"

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║         APK Builder Pro is running!              ║
echo  ║                                                  ║
echo  ║  Frontend :  http://localhost:!WEB_PORT!               ║
echo  ║  API      :  http://localhost:!API_PORT!/api         ║
echo  ║                                                  ║
echo  ║  Close the two server windows to stop.          ║
echo  ╚══════════════════════════════════════════════════╝
echo.
echo  Press any key to close this launcher window...
pause >nul
endlocal
