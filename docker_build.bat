@echo off
title AI EffiHub Docker Packager
cd /d "%~dp0"
echo ==================================================
echo             AI EffiHub Docker Packager
echo ==================================================
echo.
echo Checking if Docker Daemon is running...
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running or current user lacks socket permission.
    echo         Please ensure Docker Desktop is started.
    echo         If permissions are restricted, please right-click this batch file
    echo         and select "Run as Administrator" (以管理员身份运行).
    echo.
    pause
    exit /b
)
echo [SUCCESS] Docker is active.
echo.
echo Building Docker image 'ai-effihub'...
docker build -t ai-effihub .
if errorlevel 1 (
    echo.
    echo [ERROR] Docker build failed.
    echo.
    pause
    exit /b
)
echo.
echo ==================================================
echo [SUCCESS] Image 'ai-effihub' built successfully!
echo ==================================================
echo.
echo Creating host database file (if not exists) to prevent directory mount gotcha...
if not exist data.db type nul > data.db
echo.
echo To run the container with persistent database mapping:
echo.
echo    docker run -d -p 8234:8234 --name ai-effihub -v "%cd%/data.db:/app/data.db" ai-effihub
echo.
echo After running, open your browser and access the platform at:
echo    👉 http://localhost:8234/
echo.
pause
