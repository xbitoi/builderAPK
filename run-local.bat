@echo off
setlocal enabledelayedexpansion
title APK Builder Pro - Launcher

echo.
echo  +--------------------------------------------------+
echo  ^|        APK Builder Pro  ^|  Windows 11            ^|
echo  +--------------------------------------------------+
echo.

:: -------------------------------------------------------
:: STEP 1 - Load .env file into this window's environment
:: -------------------------------------------------------
if exist ".env" (
    echo  [1/7] Loading .env ...
    for /f "usebackq delims=" %%L in (`node -e "try{var c=require('fs').readFileSync('.env','utf8');c.split(/\r?\n/).forEach(function(l){var m=l.match(/^([^#\s][^=]*)=(.*)/);if(m)process.stdout.write('set \"'+m[1].trim()+'='+m[2]+'\"\n')});}catch(e){}"`) do %%L
    echo        .env loaded OK
) else (
    echo  [1/7] No .env found - will ask for DATABASE_URL below.
)

:: -------------------------------------------------------
:: STEP 2 - Check Node.js
:: -------------------------------------------------------
echo  [2/7] Checking Node.js ...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Node.js is not installed.
    echo  Download from: https://nodejs.org
    pause & exit /b 1
)
for /f "tokens=*" %%V in ('node -v') do set NODE_VER=%%V
echo        Node.js !NODE_VER! OK

:: -------------------------------------------------------
:: STEP 3 - Check pnpm
:: -------------------------------------------------------
echo  [3/7] Checking pnpm ...
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo        Installing pnpm via npm ...
    call npm install -g pnpm
    if %errorlevel% neq 0 (
        echo  [ERROR] Could not install pnpm. Run as Administrator.
        pause & exit /b 1
    )
)
for /f "tokens=*" %%V in ('pnpm -v') do set PNPM_VER=%%V
echo        pnpm v!PNPM_VER! OK

:: -------------------------------------------------------
:: STEP 4 - Require DATABASE_URL
:: -------------------------------------------------------
echo  [4/7] Checking DATABASE_URL ...
if "!DATABASE_URL!"=="" (
    echo.
    echo  DATABASE_URL is required. Get a free PostgreSQL database:
    echo    Neon     -^> https://neon.tech      (recommended)
    echo    Supabase -^> https://supabase.com
    echo    Local    -^> postgresql://postgres:password@localhost:5432/apkbuilder
    echo.
    :askdb
    set /p "DATABASE_URL=  Paste your DATABASE_URL and press Enter: "
    if "!DATABASE_URL!"=="" (
        echo  DATABASE_URL cannot be empty. Please paste a value.
        goto askdb
    )
    echo.
    echo  TIP: Add this line to a .env file so you do not need to paste it next time:
    echo  DATABASE_URL=!DATABASE_URL!
    echo.
)
echo        DATABASE_URL OK

:: Auto-generate SESSION_SECRET if missing
if "!SESSION_SECRET!"=="" (
    for /f "tokens=*" %%R in ('node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"') do set "SESSION_SECRET=%%R"
    echo        SESSION_SECRET auto-generated
)

set "NODE_ENV=development"

:: -------------------------------------------------------
:: STEP 5 - Fix Rollup Windows native modules if needed,
::          then install all dependencies
:: -------------------------------------------------------
echo.
echo  [5/7] Checking dependencies ...

:: Detect missing rollup Windows binary
dir /b /s "node_modules\*rollup-win32*" >nul 2>&1
if %errorlevel% neq 0 (
    if exist "node_modules" (
        echo        Detected Linux node_modules - removing to reinstall for Windows ...
        rmdir /s /q node_modules
        echo        Removed. Reinstalling ...
    )
)

call pnpm install --no-frozen-lockfile
if %errorlevel% neq 0 (
    echo  [ERROR] Dependency install failed.
    echo  Try: delete the node_modules folder and run this file again.
    pause & exit /b 1
)
echo        Dependencies OK

:: -------------------------------------------------------
:: STEP 6 - Build API server
:: -------------------------------------------------------
echo.
echo  [6/7] Building API server ...
call pnpm --filter @workspace/api-server run build
if %errorlevel% neq 0 (
    echo  [ERROR] Build failed. See output above.
    pause & exit /b 1
)
echo        API server built OK

:: -------------------------------------------------------
:: STEP 7 - Database migrations
:: -------------------------------------------------------
echo.
echo  [7/7] Running database migrations ...
call pnpm --filter @workspace/db run push
if %errorlevel% neq 0 (
    echo  [WARN] Migration error - check DATABASE_URL is reachable.
) else (
    echo        Migrations OK
)

:: -------------------------------------------------------
:: Launch servers
:: The new CMD windows inherit ALL env vars from this window
:: (DATABASE_URL, SESSION_SECRET, NODE_ENV) automatically.
:: No temp file needed.
:: -------------------------------------------------------
set "API_PORT=8080"
set "WEB_PORT=5173"

echo.
echo  Starting API server on port !API_PORT! ...
start "APK Builder - API Server" cmd /k "cd /d %~dp0 && set PORT=!API_PORT! && node --enable-source-maps artifacts\api-server\dist\index.mjs"

echo  Waiting 8 seconds for API to start ...
timeout /t 8 /nobreak >nul

echo  Starting frontend on port !WEB_PORT! ...
start "APK Builder - Frontend" cmd /k "cd /d %~dp0 && set PORT=!WEB_PORT! && set BASE_PATH=/ && pnpm --filter @workspace/apk-builder run dev"

echo  Waiting 6 seconds for frontend to start ...
timeout /t 6 /nobreak >nul

echo  Opening browser ...
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
pause
endlocal
