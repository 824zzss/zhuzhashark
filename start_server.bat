@echo off
REM ZZSK launcher - serve the app folder over LAN so phones can connect
set "PORT=8848"
set "DIR=%~dp0"

REM Show LAN IPs for phone access
for /f "tokens=*" %%i in ('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notmatch 'Loopback'}).IPAddress -join ', '"') do set "LANIPS=%%i"
echo ============================================
echo  ZZSK is about to start on port %PORT%
echo  PC open:  http://127.0.0.1:%PORT%/
echo  Phone (same WiFi):  http://%LANIPS%:%PORT%/
echo  Keep this window open while using.
echo ============================================

REM Try Python first
where python >nul 2>nul
if %errorlevel%==0 (
  start "" "http://127.0.0.1:%PORT%/"
  python -m http.server %PORT% --bind 0.0.0.0 --directory "%DIR%"
  goto :eof
)
REM Try Windows Python launcher
where py >nul 2>nul
if %errorlevel%==0 (
  start "" "http://127.0.0.1:%PORT%/"
  py -m http.server %PORT% --bind 0.0.0.0 --directory "%DIR%"
  goto :eof
)
REM Try Node serve
where node >nul 2>nul
if %errorlevel%==0 (
  start "" "http://127.0.0.1:%PORT%/"
  npx --yes serve -l %PORT% "%DIR%"
  goto :eof
)
echo.
echo ERROR: Python or Node.js not found on this PC.
echo Install Python (https://python.org) or Node.js, then re-run this file.
echo (During install, tick "Add to PATH".)
pause
