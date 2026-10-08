@echo off
setlocal EnableDelayedExpansion
title CBEO Bhinai Portal - Live Server ^& GitHub Auto-Sync Engine
color 0A
cls

echo =========================================================================
echo   कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)
echo   CBEO Bhinai Portal - Live Server, Auto-Save ^& GitHub Push Engine
echo =========================================================================
echo   लोकल यूआरएल      : http://localhost:8089
echo   गिटहब रिपॉजिटरी   : https://github.com/Jit9763/cbeo-bhinai-portal
echo   जिला (District)  : अजमेर (AJMER) [Strict Permanent Standard]
echo =========================================================================
echo.

cd /d "%~dp0"

:: 1. Verify Node.js Environment
set NODE_EXE=
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set "NODE_EXE=node"
) else (
    if exist "C:\Program Files\nodejs\node.exe" (
        set "NODE_EXE=C:\Program Files\nodejs\node.exe"
    )
)

if "%NODE_EXE%"=="" (
    color 0C
    echo [ERROR] Node.js आपके सिस्टम में नहीं मिला!
    echo कृपया https://nodejs.org/ से Node.js इनस्टॉल करें।
    echo.
    echo सीधे ब्राउज़र में स्टैटिक पोर्टल खोला जा रहा है...
    start "" "index.html"
    pause
    exit /b 1
)

:: 2. Check and terminate lingering process on Port 8089 to attach live console
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8089 " ^| findstr "LISTENING"') do (
    set OLD_PID=%%a
    if defined OLD_PID (
        echo [INFO] पोर्ट 8089 पर पूर्व में चल रही प्रक्रिया (PID: !OLD_PID!) को रीस्टार्ट किया जा रहा है...
        taskkill /F /PID !OLD_PID! >nul 2>&1
        timeout /t 1 /nobreak >nul
    )
)

:: 3. Launch Default Browser after 1.5 seconds in background
start /b "" powershell -Command "Start-Sleep -Milliseconds 1500; Start-Process 'http://localhost:8089'"

:: 4. Start Live Server in foreground with auto-push logs
echo [STARTING] CBEO भिनाय ऑटो-सिंक सर्वर चालू हो रहा है...
echo [INFO] पोर्टल में कोई भी सेटिंग या डेटा बदलने पर यह स्वतः सेव होकर GitHub पर पुश हो जाएगा।
echo [INFO] सर्वर को चालू रखने के लिए कृपया यह विंडो बंद न करें।
echo =========================================================================
echo.

"%NODE_EXE%" server.js

echo.
echo [INFO] सर्वर बंद हो गया है।
pause
