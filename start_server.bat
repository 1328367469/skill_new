@echo off
title AI EffiHub Server Launcher
cd /d "%~dp0"
echo ==================================================
echo             AI EffiHub Server Launcher
echo ==================================================
echo.
echo Attempting to start the backend server using the system Python...
echo.
"C:\software\python\python.exe" server.py
if errorlevel 1 (
    echo.
    echo [ERROR] Failed to start server. If this is a permission issue,
    echo         please right-click this batch file and select:
    echo         "Run as Administrator" (以管理员身份运行)
    echo.
)
pause
