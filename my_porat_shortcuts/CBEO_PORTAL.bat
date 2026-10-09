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

echo [1/3] Checking Node.js environment...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not found in PATH!
    echo Opening Cloud Portal in browser...
    start "" "https://jit9763.github.io/cbeo-bhinai-portal/"
    echo.
    pause
    exit /b 1
)

echo [2/3] Checking if Server is already running on port 8089...
netstat -ano | findstr ":8089 " | findstr "LISTENING" >nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Server is already running on port 8089.
    echo [3/3] Opening portal in browser...
    start "" "http://localhost:8089"
    echo.
    echo =========================================================================
    echo   Portal is ready at http://localhost:8089
    echo   Any settings you change will sync to Cloud / GitHub automatically.
    echo =========================================================================
    echo.
    pause
    exit /b 0
)

echo [3/3] Opening browser and starting Server...
start "" "http://localhost:8089"
echo.
echo =========================================================================
echo   SERVER IS RUNNING! (Port: 8089)
echo   Do NOT close this window while editing settings.
echo   When you finish editing, you can close this window to stop the server.
echo =========================================================================
echo.

node server.js

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Server stopped with error code %ERRORLEVEL%.
    pause
)
