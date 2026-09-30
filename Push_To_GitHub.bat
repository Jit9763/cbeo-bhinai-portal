@echo off
title Push CBEO Bhinai Portal to GitHub
echo ========================================================
echo   Pushing CBEO Bhinai Portal to GitHub (Jit9763)
echo ========================================================
echo.
echo Make sure you have created the repository 'cbeo-bhinai-portal' on GitHub:
echo https://github.com/new (Name: cbeo-bhinai-portal, Public)
echo.
git branch -M main
git push -u origin main
echo.
echo Done! If push succeeded, activate GitHub Pages in Settings -> Pages -> Deploy from branch (main).
pause
