@echo off
setlocal enabledelayedexpansion
title APK Builder Pro - Windows Launcher

echo.
echo  +--------------------------------------------------+
echo  ^|        APK Builder Pro  ^|  Windows 11            ^|
echo  +--------------------------------------------------+
echo.

:: -------------------------------------------------------
:: STEP 1 - Load .env file
:: -------------------------------------------------------
if exist ".env" (
    echo  [1/7] Loading .env file...
    for /f "usebackq tokens=*" %%L in (`node -e "try{var c=require('fs').readFileSync('.env','utf8');c.split(/\r?\n/).forEach(function(l){var m=l.match(/^([^#\s][^=]*)=(.*)/);if(m)process.stdout.write('set \"'+m[1].trim()+'='+m[2]+'\"\n')});}catch(e){}"`) do (
        %%L
    )
    echo        .env loaded OK
) else (
    echo  [1/7] No .env file found.
    if exist ".env.example" (
        echo        TIP: Copy .env.example to .env and fill in your values.
    )
)

:: -------------------------------------------------------
:: STEP 2 - Check Node.js
:: -------------------------------------------------------
echo  [2/7] Checking Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Node.js is not installed.
    echo  Download from: https://nodejs.org
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%V in ('node -v') do set NODE_VER=%%V
echo        Node.js !NODE_VER! OK

:: -------------------------------------------------------
:: STEP 3 - Check / install pnpm
:: -------------------------------------------------------
echo  [3/7] Checking pnpm...
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo        pnpm not found. Installing via npm...
    call npm install -g pnpm
    if %errorlevel% neq 0 (
        echo  [ERROR] Failed to install pnpm.
        echo  Try: npm install -g pnpm
        pause
        exit /b 1
    )
)
for /f "tokens=*" %%V in ('pnpm -v') do set PNPM_VER=%%V
echo        pnpm v!PNPM_VER! OK

:: -------------------------------------------------------
:: STEP 4 - Check DATABASE_URL
:: -------------------------------------------------------
echo  [4/7] Checking DATABASE_URL...
if "!DATABASE_URL!"=="" (
    echo.
    echo  [WARN] DATABASE_URL is not set.
    echo  Get a free database at:
    echo    Neon     https://neon.tech
    echo    Supabase https://supabase.com
    echo    Local    postgresql://postgres:password@localhost:5432/apkbuilder
    echo.
    set /p "DBINPUT=  Paste your DATABASE_URL (or Enter to skip): "
    if not "!DBINPUT!"=="" (
        set "DATABASE_URL=!DBINPUT!"
        echo        DATABASE_URL set.
    ) else (
        echo  [WARN] Skipped. App may fail without a database.
    )
) else (
    echo        DATABASE_URL OK
)

:: Auto-generate SESSION_SECRET if missing
if "!SESSION_SECRET!"=="" (
    for /f "tokens=*" %%R in ('node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"') do set "SESSION_SECRET=%%R"
    echo        SESSION_SECRET auto-generated.
)

:: -------------------------------------------------------
:: STEP 5 - Install dependencies
:: Note: --no-frozen-lockfile lets pnpm download Windows-specific
:: native modules (e.g. rollup-win32) not in the Linux lockfile.
:: -------------------------------------------------------
echo.
echo  [5/7] Installing dependencies (first run may take a few minutes)...
call pnpm install --no-frozen-lockfile
if %errorlevel% neq 0 (
    echo  [ERROR] Dependency install failed.
    echo  Try running as Administrator, or delete node_modules and try again.
    pause
    exit /b 1
)
echo        Dependencies installed OK

:: -------------------------------------------------------
:: STEP 6 - Build API server
:: -------------------------------------------------------
echo.
echo  [6/7] Building API server...
set "NODE_ENV=development"
call pnpm --filter @workspace/api-server run build
if %errorlevel% neq 0 (
    echo  [ERROR] API server build failed. See output above.
    pause
    exit /b 1
)
echo        API server built OK

:: -------------------------------------------------------
:: STEP 7 - Database migrations
:: -------------------------------------------------------
echo.
echo  [7/7] Running database migrations...
if not "!DATABASE_URL!"=="" (
    call pnpm --filter @workspace/db run push
    if %errorlevel% neq 0 (
        echo  [WARN] Migration error - check DATABASE_URL is reachable.
    ) else (
        echo        Migrations done OK
    )
) else (
    echo  [SKIP] No DATABASE_URL - skipping migrations.
)

:: -------------------------------------------------------
:: Write env vars to temp file for server windows
:: -------------------------------------------------------
set "API_PORT=8080"
set "WEB_PORT=5173"
set "RUNTIME_FILE=%TEMP%\apkbuilder_runtime.cmd"

node -e "var fs=require('fs'),p=process.env,f=p.TEMP+'\\apkbuilder_runtime.cmd';var lines=['@echo off'];function add(k,v){lines.push('set \"'+k+'='+(v||'')+'\"');}add('DATABASE_URL',p.DATABASE_URL);add('SESSION_SECRET',p.SESSION_SECRET);add('NODE_ENV','development');fs.writeFileSync(f,lines.join('\r\n')+'\r\n');"

:: -------------------------------------------------------
:: Launch API server in a new window
:: -------------------------------------------------------
echo.
echo  Starting API server on port !API_PORT!...
start "APK Builder - API Server (port !API_PORT!)" cmd /k "cd /d "%~dp0" & call "!RUNTIME_FILE!" & set PORT=!API_PORT! & node --enable-source-maps artifacts\api-server\dist\index.mjs"

echo  Waiting 8 seconds for API server to be ready...
timeout /t 8 /nobreak >nul

:: -------------------------------------------------------
:: Launch Vite frontend
:: BASE_PATH=/ enables the /api proxy to port 8080
:: -------------------------------------------------------
echo  Starting frontend on port !WEB_PORT!...
start "APK Builder - Frontend (port !WEB_PORT!)" cmd /k "cd /d "%~dp0" & set PORT=!WEB_PORT! & set BASE_PATH=/ & pnpm --filter @workspace/apk-builder run dev"

echo  Waiting 6 seconds for frontend to start...
timeout /t 6 /nobreak >nul

:: -------------------------------------------------------
:: Open browser
:: -------------------------------------------------------
echo  Opening browser...
start "" "http://localhost:!WEB_PORT!"

echo.
echo  +--------------------------------------------------+
echo  ^|        APK Builder Pro is running!               ^|
echo  ^|                                                  ^|
echo  ^|  Frontend : http://localhost:!WEB_PORT!                ^|
echo  ^|  API      : http://localhost:!API_PORT!/api          ^|
echo  ^|                                                  ^|
echo  ^|  Close the two server windows to stop.          ^|
echo  +--------------------------------------------------+
echo.
echo  Press any key to close this launcher window...
pause >nul
endlocal
