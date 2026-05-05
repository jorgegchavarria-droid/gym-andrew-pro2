@echo off
echo ========================================
echo   GYM ANDREW PRO - DEPLOYMENT SCRIPT
echo ========================================
echo.

:: Check if Git is installed
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed!
    echo Please download and install Git from: https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
)

echo [SUCCESS] Git is installed
echo.

:: Get GitHub username
set /p github_user="Enter your GitHub username: "
if "%github_user%"=="" (
    echo [ERROR] Username cannot be empty!
    pause
    exit /b 1
)

:: Get repository name
set /p repo_name="Enter repository name (default: gym-andrew-pro): "
if "%repo_name%"=="" set repo_name=gym-andrew-pro

echo.
echo Initializing Git repository...
git init
if %errorlevel% neq 0 (
    echo [ERROR] Failed to initialize Git repository!
    pause
    exit /b 1
)

echo Adding all files...
git add .
if %errorlevel% neq 0 (
    echo [ERROR] Failed to add files!
    pause
    exit /b 1
)

echo Creating initial commit...
git commit -m "Initial commit - Gym Andrew Pro Production Ready"
if %errorlevel% neq 0 (
    echo [ERROR] Failed to create commit!
    pause
    exit /b 1
)

echo Adding remote origin...
git remote add origin https://github.com/%github_user%/%repo_name%.git
if %errorlevel% neq 0 (
    echo [ERROR] Failed to add remote origin!
    echo Make sure your GitHub repository exists at: https://github.com/%github_user%/%repo_name%
    pause
    exit /b 1
)

echo Setting main branch...
git branch -M main
if %errorlevel% neq 0 (
    echo [ERROR] Failed to set main branch!
    pause
    exit /b 1
)

echo Pushing to GitHub...
git push -u origin main
if %errorlevel% neq 0 (
    echo [ERROR] Failed to push to GitHub!
    echo Make sure you have proper permissions and the repository exists
    pause
    exit /b 1
)

echo.
echo ========================================
echo   SUCCESS! Code pushed to GitHub
echo ========================================
echo.
echo Repository URL: https://github.com/%github_user%/%repo_name%
echo.
echo Next steps:
echo 1. Go to https://vercel.com
echo 2. Import your repository: %github_user%/%repo_name%
echo 3. Configure deployment settings
echo 4. Deploy!
echo.
echo Press any key to open Vercel...
pause >nul
start https://vercel.com
