@echo off
chcp 65001 >nul
title CBEO Bhinai Portal - Live Node.js Server ^& Auto-Sync Engine
color 0A
cls

echo =========================================================================
echo   कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)
echo   CBEO Bhinai Portal - Live Server, 24x7 Cloud ^& Mobile Sync Engine
echo =========================================================================
echo   लोकल पोर्टल यूआरएल : http://localhost:8089
echo   क्लाउड पोर्टल      : https://jit9763.github.io/cbeo-bhinai-portal/
echo   जिला (District)   : अजमेर (AJMER) [Strict Permanent Standard]
echo =========================================================================
echo.

cd /d "C:\Users\jiten\Desktop\cbeo"

:: 1. चेक करें कि Node.js इनस्टॉल है या नहीं
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    if not exist "C:\Program Files\nodejs\node.exe" (
        color 0C
        echo [चेतावनी] Node.js नहीं मिला, सीधे ब्राउज़र में स्टैटिक पोर्टल खोला जा रहा है...
        start "" "https://jit9763.github.io/cbeo-bhinai-portal/"
        pause
        exit /b 0
    )
)

:: 2. सर्वर पहले से चल रहा है या नया चालू करना है
netstat -ano | findstr ":8089 " | findstr "LISTENING" >nul
if %ERRORLEVEL% EQU 0 (
    echo [✓] CBEO Node.js सर्वर पहले से पोर्ट 8089 पर सक्रिय है।
) else (
    echo [⚡] CBEO Node.js सर्वर (पोर्ट 8089) प्रारंभ किया जा रहा है...
    start "CBEO Node Server (Port 8089)" /min cmd /c "node server.js"
    timeout /t 2 /nobreak >nul
)

:: 3. ब्राउज़र में पोर्टल तुरंत खोलें
echo [🌐] ब्राउज़र में पोर्टल खोला जा रहा है...
start "" "http://localhost:8089"

echo.
echo =========================================================================
echo   ✓ पोर्टल सफलतापूर्वक शुरू हो गया है!
echo   ✓ ऑटो-सिंक सक्रिय: जब भी आप PC या मोबाइल (Jitendra लॉगिन) से कोई भी
echo     सेटिंग बदलेंगे, वह Google Sheets, GitHub और सभी डिवाइस पर तुरंत लागू होगी।
echo =========================================================================
echo.
echo   [P] गिटहब व क्लाउड पर अभी मैन्युअल पुश करें (Push Now)
echo   [Q] सर्वर विंडो बंद करें (Exit)
echo.

:LOOP
set /p opt="कमांड दर्ज करें (P / Q) [डिफ़ॉल्ट रूप से सर्वर चालू रहेगा]: "
if /i "%opt%"=="p" (
    echo.
    echo क्लाउड व गिटहब पर सेटिंग्स पुश की जा रही हैं...
    python scripts/sync_all_settings_to_cloud.py
    git add .
    git commit -m "auto(portal): live settings push [%DATE% %TIME%]"
    git push origin main
    echo [✓] सेटिंग्स लाइव हो गईं!
    echo.
    goto LOOP
)
if /i "%opt%"=="q" exit /b 0
goto LOOP
