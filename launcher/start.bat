@echo off
setlocal enabledelayedexpansion
title M.DoT Enterprises Launcher

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%.."
set "BASE_DIR=%CD%"

:: 1. Check & start Image Service (port 8000)
netstat -ano | findstr :8000 | findstr LISTENING >nul 2>&1
if %errorlevel% neq 0 (
    start "MDot-ImageService" /min cmd /c "cd /d "%BASE_DIR%\image-service" && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
)

:: 2. Check & start Backend (port 8080)
netstat -ano | findstr :8080 | findstr LISTENING >nul 2>&1
if %errorlevel% neq 0 (
    if exist "%BASE_DIR%\backend\target\studio-pro-1.0.0.jar" (
        start "MDot-Backend" /min cmd /c "cd /d "%BASE_DIR%\backend" && java -jar target\studio-pro-1.0.0.jar"
    ) else (
        start "MDot-Backend" /min cmd /c "cd /d "%BASE_DIR%\backend" && mvnw.cmd spring-boot:run"
    )
)

:: 3. Check & start Frontend (port 5173)
netstat -ano | findstr :5173 | findstr LISTENING >nul 2>&1
if %errorlevel% neq 0 (
    start "MDot-Frontend" /min cmd /c "cd /d "%BASE_DIR%\frontend" && npm run dev -- --host 0.0.0.0"
)

:: 4. Wait for Frontend to respond
set RETRIES=0
:WAIT_LOOP
powershell -Command "try { $r = (Invoke-WebRequest -Uri 'http://localhost:5173' -UseBasicParsing -TimeoutSec 1); if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if %errorlevel% equ 0 goto LAUNCH_BROWSER

set /a RETRIES+=1
if %RETRIES% geq 20 goto LAUNCH_BROWSER
timeout /t 1 /nobreak >nul
goto WAIT_LOOP

:LAUNCH_BROWSER
:: 5. Launch in dedicated Chrome App Mode (Looks like a real Windows Desktop Software)
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=http://localhost:5173/
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --app=http://localhost:5173/
) else (
    start http://localhost:5173/
)
