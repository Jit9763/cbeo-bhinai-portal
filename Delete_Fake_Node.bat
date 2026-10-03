@echo off
title Node Select App Fixer
echo ============================================================
echo   Removing fake 2-byte 'node' file from C:\Windows\System32
echo ============================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd -ArgumentList '/c del /f /q C:\Windows\System32\node && echo. && echo [SUCCESS] C:\Windows\System32\node successfully deleted! Real node.exe is now active. && pause' -Verb RunAs"
