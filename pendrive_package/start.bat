@echo off
setlocal enabledelayedexpansion
title M.DoT Enterprises

set "BASE_DIR=%~dp0"
cd /d "%BASE_DIR%"

:: 1. Start Python Image Service (port 8000)
netstat -ano | findstr :8000 | findstr LISTENING >nul 2>&1
if %errorlevel% neq 0 (
    start "MDot-ImageService" /min cmd /c "cd /d "%BASE_DIR%image-service" && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
)

:: 2. Start Java Spring Boot App Server (port 8080 - serves frontend + API)
netstat -ano | findstr :8080 | findstr LISTENING >nul 2>&1
if %errorlevel% neq 0 (
    start "MDot-AppServer" /min cmd /c "cd /d "%BASE_DIR%app-server" && java -jar studio-pro-1.0.0.jar"
)

:: 3. Wait for app server to be ready
set RETRIES=0
:WAIT_LOOP
powershell -Command "try { $r = (Invoke-WebRequest -Uri 'http://localhost:8080/api/health' -UseBasicParsing -TimeoutSec 1); if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if %errorlevel% equ 0 goto LAUNCH_BROWSER

set /a RETRIES+=1
if %RETRIES% geq 25 goto LAUNCH_BROWSER
timeout /t 1 /nobreak >nul
goto WAIT_LOOP

:LAUNCH_BROWSER
:: 4. Launch in Chrome App Mode (looks like native desktop software)
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=http://localhost:8080/
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --app=http://localhost:8080/
) else (
    start http://localhost:8080/
)
