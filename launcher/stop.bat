@echo off
title Stopping M.DoT Enterprises...
echo ============================================================
echo   Stopping M.DoT Enterprises Services...
echo ============================================================
echo.

:: 1. Kill processes on port 5173 (Frontend)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)

:: 2. Kill processes on port 8080 (Spring Boot Backend)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8080 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)

:: 3. Kill processes on port 8000 (Python Image Service)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo [OK] All M.DoT Enterprises background services stopped.
timeout /t 2 >nul
