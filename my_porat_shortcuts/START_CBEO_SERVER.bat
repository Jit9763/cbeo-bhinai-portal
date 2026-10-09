@echo off
chcp 65001 >nul
title CBEO Bhinai Portal - Node.js Server
color 0B
cls

echo =========================================================================
echo   कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)
echo   CBEO Bhinai Portal - Node.js Local Server (Port 8089)
echo =========================================================================
echo.

cd /d "C:\Users\jiten\Desktop\cbeo"

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    if not exist "C:\Program Files\nodejs\node.exe" (
        echo [चेतावनी] Node.js नहीं मिला, ब्राउज़र में सीधे पोर्टल खोला जा रहा है...
        start "" "index.html"
        pause
        exit /b 0
    )
)

echo सर्वर शुरू किया जा रहा है... (http://localhost:8089)
start "CBEO Node Server" cmd /c "node server.js"
timeout /t 2 /nobreak >nul
start "" "http://localhost:8089"

echo ✓ सर्वर चालू हो चुका है और ब्राउज़र में पोर्टल खुल गया है।
pause
