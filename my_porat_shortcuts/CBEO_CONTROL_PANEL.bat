@echo off
chcp 65001 >nul
title CBEO Bhinai Portal - Master Control Panel
color 0E

:MENU
cls
echo =========================================================================
echo   कार्यालय मुख्य ब्लॉक शिक्षा अधिकारी (CBEO), भिनाय (अजमेर)
echo   CBEO Bhinai Official Portal - मास्टर कंट्रोल पैनल
echo =========================================================================
echo.
echo   [1] गिटहब व क्लाउड पर सेटिंग्स तुरंत पुश करें (Push to GitHub & Cloud)
echo   [2] नोड सर्वर चालू करें व पोर्टल खोलें (Start Node.js Server on 8089)
echo   [3] क्लाउड सेटिंग्स की स्थिति जांचें (Check Live Cloud Sync Status)
echo   [4] बाहर निकलें (Exit)
echo.
echo =========================================================================
set /p choice="कृपया विकल्प चुनें (1-4): "

if "%choice%"=="1" goto PUSH
if "%choice%"=="2" goto SERVER
if "%choice%"=="3" goto CHECK
if "%choice%"=="4" goto EXIT

echo गलत विकल्प! पुनः प्रयास करें...
timeout /t 2 >nul
goto MENU

:PUSH
cls
call "C:\Users\jiten\Desktop\my porat\PUSH_SETTINGS_TO_GITHUB.bat"
goto MENU

:SERVER
cls
call "C:\Users\jiten\Desktop\my porat\START_CBEO_SERVER.bat"
goto MENU

:CHECK
cls
cd /d "C:\Users\jiten\Desktop\cbeo"
python -c "
import urllib.request, json
gas_url = 'https://script.google.com/macros/s/AKfycbywP9R-b1o66sR1nevpPo0NP5l-m0WOqpHakTrkWSa7Dg5ixwTMLV8Dhnq_k1WSydeb/exec'
try:
    with urllib.request.urlopen(gas_url + '?action=getPortalSettings&_t=123', timeout=10) as r:
        d = json.loads(r.read().decode())
        print('=== Cloud Settings Status ===')
        for k, v in d.get('settings', {}).items():
            if k == 'saman_mismatch_settings':
                print(f'• {k}: alert_active = {v.get(\"alert_active\")}')
            else:
                print(f'• {k}: OK')
except Exception as e:
    print('Error checking cloud:', e)
"
echo.
pause
goto MENU

:EXIT
exit /b 0
