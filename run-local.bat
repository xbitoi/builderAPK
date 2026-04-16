@echo off
setlocal enabledelayedexpansion
title APK Builder Pro

echo.
echo  +--------------------------------------------------+
echo  ^|        APK Builder Pro  ^|  Local Launcher        ^|
echo  +--------------------------------------------------+
echo.

:: Load .env if it exists
if exist ".env" (
    echo  Loading .env ...
    for /f "usebackq delims=" %%L in (`node -e "try{var c=require('fs').readFileSync('.env','utf8');c.split(/\r?\n/).forEach(function(l){var m=l.match(/^([^#\s][^=]*)=(.*)/);if(m)process.stdout.write('set \"'+m[1].trim()+'='+m[2]+'\"\n')});}catch(e){}"`) do %%L
    echo  .env loaded OK
)

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js not installed. Download from: https://nodejs.org
    pause & exit /b 1
)
for /f "tokens=*" %%V in ('node -v') do set NODE_VER=%%V
echo  Node.js !NODE_VER! OK

:: Check pnpm
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo  Installing pnpm ...
    call npm install -g pnpm
    if %errorlevel% neq 0 ( echo  [ERROR] Install pnpm failed. & pause & exit /b 1 )
)

:: Require DATABASE_URL
if "!DATABASE_URL!"=="" (
    echo.
    echo  DATABASE_URL is required.
    echo  Get a free database at: https://neon.tech
    echo.
    :askdb
    set /p "DATABASE_URL=  Paste your DATABASE_URL: "
    if "!DATABASE_URL!"=="" ( echo  Cannot be empty. & goto askdb )
    echo.
    echo  TIP: Save it to a .env file: DATABASE_URL=!DATABASE_URL!
    echo.
)

:: Auto-generate SESSION_SECRET
if "!SESSION_SECRET!"=="" (
    for /f "tokens=*" %%R in ('node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"') do set "SESSION_SECRET=%%R"
)

set "NODE_ENV=development"

:: Install dependencies (--no-frozen-lockfile gets Windows native modules)
echo.
echo  Installing dependencies ...
if exist "node_modules" (
    dir /b /s "node_modules\*rollup-win32*" >nul 2>&1
    if %errorlevel% neq 0 (
        echo  Removing Linux node_modules, reinstalling for Windows ...
        rmdir /s /q node_modules
    )
)
call pnpm install --no-frozen-lockfile
if %errorlevel% neq 0 ( echo  [ERROR] Install failed. & pause & exit /b 1 )
echo  Dependencies OK

:: Build API server
echo.
echo  Building API server ...
call pnpm --filter @workspace/api-server run build
if %errorlevel% neq 0 ( echo  [ERROR] Build failed. & pause & exit /b 1 )
echo  Build OK

:: Run database migrations
echo.
echo  Running database migrations ...
call pnpm --filter @workspace/db run push
if %errorlevel% neq 0 ( echo  [WARN] Migration warning - check DATABASE_URL. ) else ( echo  Migrations OK )

:: Start server (serves API + frontend on same port)
set "PORT=8080"
echo.
echo  Starting server on http://localhost:!PORT! ...
echo  (Close this window to stop)
echo.

start "" "http://localhost:!PORT!"
node --enable-source-maps artifacts\api-server\dist\index.mjs
