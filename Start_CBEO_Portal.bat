@echo off
setlocal EnableDelayedExpansion
title CBEO Bhinai Official Portal - Server Engine
color 0B
cls

echo ========================================================
echo   CBEO Bhinai Official Portal ^& Node Server
echo ========================================================
echo   Portal URL: http://localhost:8089
echo ========================================================
echo.

cd /d "%~dp0"

:: Check if Node.js is available
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    if not exist "C:\Program Files\nodejs\node.exe" (
        echo [INFO] Node.js not found, opening static portal in browser...
        start "" "index.html"
        pause
        exit /b 0
    )
)

:: Check if server is already running on port 8089
netstat -ano | findstr ":8089 " | findstr "LISTENING" >nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] CBEO server is already running on port 8089.
) else (
    echo [STARTING] Starting CBEO Node.js Server on port 8089...
    if exist "C:\Program Files\nodejs\node.exe" (
        start "CBEO Node Server" /min "C:\Program Files\nodejs\node.exe" server.js
    ) else (
        start "CBEO Node Server" /min cmd /c "node server.js"
    )
    timeout /t 2 /nobreak >nul
)

echo.
echo [BROWSER] Opening CBEO Portal in your browser...
start "" "http://localhost:8089"

echo.
echo ========================================================
echo   CBEO Portal is LIVE: http://localhost:8089
echo   Keep this window open to maintain local server session.
echo ========================================================
echo.
pause
