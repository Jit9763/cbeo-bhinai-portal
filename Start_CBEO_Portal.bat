@echo off
title CBEO Bhinai Official Portal & Node-SQLite Server
echo ========================================================
echo   कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)
echo   आधिकारिक सूचना, डायरेक्टरी, समान परीक्षा एवं VM सर्वर
echo ========================================================
echo.
echo Starting Universal Node.js + SQLite Dynamic Engine...
if exist "C:\Program Files\nodejs\node.exe" (
  start "" "C:\Program Files\nodejs\node.exe" server.js
  timeout /t 2 >nul
  start "" "http://localhost:8089"
) else (
  echo Node.js not found in standard path, opening static portal directly...
  start "" "index.html"
)
exit
