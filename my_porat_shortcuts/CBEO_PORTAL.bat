@echo off
title CBEO Bhinai Portal - Live Server
color 0A
cls

echo =========================================================================
echo   CBEO BHINAI PORTAL - LIVE SERVER AND CLOUD SYNC ENGINE
echo   District: AJMER , Block: Bhinai
echo =========================================================================
echo   Local URL : http://localhost:8089
echo   Cloud URL : https://jit9763.github.io/cbeo-bhinai-portal/
echo =========================================================================
echo.

cd /d "C:\Users\jiten\Desktop\cbeo"
set "PATH=%PATH%;C:\Program Files\nodejs"

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] Node.js not found in PATH. Opening live cloud portal in browser...
    start "" "https://jit9763.github.io/cbeo-bhinai-portal/"
    pause
    exit /b 0
)

echo [1/2] Checking local Node.js server on port 8089...
netstat -ano | findstr ":8089 " | findstr "LISTENING" >nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Server is already running.
) else (
    echo [OK] Starting background server...
    start "CBEO Node Server" /min cmd /c "node server.js"
    timeout /t 2 /nobreak >nul
)

echo [2/2] Opening portal in your browser...
start "" "http://localhost:8089"

echo.
echo =========================================================================
echo   SUCCESS: Portal is online at http://localhost:8089
echo   Auto-Sync is ACTIVE for PC and Mobile logins.
echo.
echo   You can close this window anytime.
echo   The server will keep running in the background.
echo =========================================================================
echo.
pause
