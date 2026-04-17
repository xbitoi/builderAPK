@echo off
setlocal enabledelayedexpansion
title APK Builder Pro

echo.
echo  +--------------------------------------------------+
echo  ^|        APK Builder Pro  ^|  Local Launcher        ^|
echo  +--------------------------------------------------+
echo.

:: ── Load .env if it exists ────────────────────────────────────────────────────
if exist ".env" (
    echo  Loading .env ...
    for /f "usebackq delims=" %%L in (`node -e "try{var c=require('fs').readFileSync('.env','utf8');c.split(/\r?\n/).forEach(function(l){var m=l.match(/^([^#\s][^=]*)=(.*)/);if(m)process.stdout.write('set \"'+m[1].trim()+'='+m[2]+'\"\n')});}catch(e){}"`) do %%L
    echo  .env loaded OK
)

:: ── Check Node.js ─────────────────────────────────────────────────────────────
where node >nul 2>&1
if !errorlevel! neq 0 (
    echo  [ERROR] Node.js not installed.
    echo  Download from: https://nodejs.org
    echo  Or run:  winget install OpenJS.NodeJS
    pause & exit /b 1
)
for /f "tokens=*" %%V in ('node -v') do set NODE_VER=%%V
echo  Node.js !NODE_VER! OK

:: ── Check / install pnpm ──────────────────────────────────────────────────────
where pnpm >nul 2>&1
if !errorlevel! neq 0 (
    echo  Installing pnpm ...
    call npm install -g pnpm
    if !errorlevel! neq 0 (
        echo  [ERROR] Failed to install pnpm.
        pause & exit /b 1
    )
)
for /f "tokens=*" %%V in ('pnpm -v') do set PNPM_VER=%%V
echo  pnpm !PNPM_VER! OK

:: ── Require DATABASE_URL ──────────────────────────────────────────────────────
if "!DATABASE_URL!"=="" (
    echo.
    echo  DATABASE_URL is required.
    echo  Get a free PostgreSQL database at: https://neon.tech
    echo.
    :askdb
    set /p "DATABASE_URL=  Paste your DATABASE_URL: "
    if "!DATABASE_URL!"=="" ( echo  Cannot be empty. & goto askdb )
    echo.
    echo  TIP: Save it to a .env file so you don't have to enter it next time:
    echo       DATABASE_URL=!DATABASE_URL!
    echo.
)

:: ── Auto-generate SESSION_SECRET if not set ───────────────────────────────────
if "!SESSION_SECRET!"=="" (
    node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))" > "%TEMP%\apkbuilder_secret.tmp" 2>nul
    set /p SESSION_SECRET=< "%TEMP%\apkbuilder_secret.tmp"
    del "%TEMP%\apkbuilder_secret.tmp" >nul 2>&1
)

set "NODE_ENV=development"

:: ── Install dependencies ──────────────────────────────────────────────────────
echo.
echo  Checking dependencies ...

:: If node_modules exists but missing Windows-native rollup, reinstall
if exist "node_modules" (
    dir /b /s "node_modules\@rollup\rollup-win32*" >nul 2>&1
    if !errorlevel! neq 0 (
        echo  Removing Linux/macOS node_modules — reinstalling for Windows ...
        rmdir /s /q node_modules 2>nul
    )
)

call pnpm install --no-frozen-lockfile
if !errorlevel! neq 0 (
    echo  [ERROR] Dependency installation failed.
    echo  Make sure you have internet access and try again.
    pause & exit /b 1
)
echo  Dependencies OK

:: ── Build API server ──────────────────────────────────────────────────────────
echo.
echo  Building API server ...
call pnpm --filter @workspace/api-server run build
if !errorlevel! neq 0 (
    echo  [ERROR] API server build failed. Check the error above.
    pause & exit /b 1
)
echo  Build OK

:: ── Run database migrations ───────────────────────────────────────────────────
echo.
echo  Running database migrations ...
call pnpm --filter @workspace/db run push
if !errorlevel! neq 0 (
    echo  [WARN] Migration step returned a warning - check your DATABASE_URL.
) else (
    echo  Migrations OK
)

:: ── Start server ──────────────────────────────────────────────────────────────
set "PORT=8080"
echo.
echo  +-------------------------------------------------+
echo  ^|  Server running at  http://localhost:!PORT!      ^|
echo  ^|  Close this window to stop APK Builder Pro      ^|
echo  +-------------------------------------------------+
echo.

:: Open browser after a short delay — run in background (no /wait)
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:!PORT!"

:: Start the Node server
node --enable-source-maps artifacts\api-server\dist\index.mjs
set EXIT_CODE=!errorlevel!

echo.
if !EXIT_CODE! neq 0 (
    echo  [ERROR] Server stopped unexpectedly ^(exit code !EXIT_CODE!^).
    echo  Check the error messages above.
) else (
    echo  Server stopped.
)
echo.
pause
