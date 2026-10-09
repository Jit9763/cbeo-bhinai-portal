@echo off
chcp 65001 >nul
title CBEO Bhinai Portal - GitHub & Cloud Settings Push Engine
color 0A
cls

echo =========================================================================
echo   कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)
echo   CBEO Bhinai Portal - GitHub Pages व Cloud Live Settings Push
echo =========================================================================
echo   जिला (District)  : अजमेर (AJMER)
echo   ब्लॉक (Block)    : भिनाय (Bhinai)
echo =========================================================================
echo.

cd /d "C:\Users\jiten\Desktop\cbeo"

echo [1/3] लोकल फाइलों व सेटिंग्स की जांच की जा रही है...
git status -s

echo.
echo [2/3] Google Apps Script क्लाउड पर सेटिंग्स सुरक्षित की जा रही हैं...
python scripts/sync_all_settings_to_cloud.py

echo.
echo [3/3] GitHub पर डेटा व सेटिंग्स पुश की जा रही हैं...
git add .
git commit -m "auto(portal): live settings and data sync by Jitendra Admin [%DATE% %TIME%]"
git push origin main

echo.
echo =========================================================================
echo   ✓ बधाई! सभी सेटिंग्स GitHub Pages व Google Sheets पर लाइव हो चुकी हैं।
echo   ✓ 57 स्कूलों व 25 PEEO के लिए नया अपडेट तुरंत लागू हो गया है।
echo =========================================================================
echo.
pause
