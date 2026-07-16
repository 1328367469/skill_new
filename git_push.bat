@echo off
title AI EffiHub Git Pusher
cd /d "%~dp0"
echo ==================================================
echo             AI EffiHub Git Pusher
echo ==================================================
echo.
echo This tool will help you push the codebase to your GitHub repository.
echo.
set /p repo_url="Please enter your GitHub Repository URL (e.g., https://github.com/username/repo.git): "
if "%repo_url%"=="" (
    echo.
    echo [ERROR] Repository URL cannot be empty.
    pause
    exit /b
)
echo.
echo Adding remote origin...
git remote remove origin >nul 2>&1
git remote add origin %repo_url%
echo.
echo Staging changes...
git add .
echo.
echo Committing changes...
git commit -m "Initialize AI EffiHub with SQLite deduplication and multi-threaded server" >nul 2>&1
echo.
echo Pushing code to main branch...
git push -u origin main
echo.
if errorlevel 1 (
    echo.
    echo [ERROR] Push failed. Please make sure:
    echo         1. The GitHub repository is empty.
    echo         2. You have configured your Git credentials.
    echo.
) else (
    echo.
    echo [SUCCESS] Code successfully pushed to GitHub!
    echo.
)
pause
