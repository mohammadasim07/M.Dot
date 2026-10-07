@echo off
setlocal enabledelayedexpansion
title M.DoT Enterprises - Installation Setup
color 0b

echo ============================================================
echo   M.DoT Enterprises - 1-Click Installer
echo   Client: Shoeb Akther
echo   Developed by: Mohammad Asim
echo ============================================================
echo.

:: 1. Check Java
echo [1/5] Checking Java Environment...
where java >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Java is not installed on this PC!
    echo Please install Java 17 or higher (Oracle JDK or Eclipse Temurin).
    echo Opening download page...
    start https://adoptium.net/temurin/releases/
    pause
    exit /b 1
)
echo [OK] Java is installed.

:: 2. Check Python
echo.
echo [2/5] Checking Python Environment...
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Python is not installed on this PC!
    echo Please install Python 3.10 or higher.
    echo Opening download page...
    start https://www.python.org/downloads/
    pause
    exit /b 1
)
echo [OK] Python is installed.

:: 3. Copy Application Files to Local Drive (C:\MDotEnterprises)
echo.
echo [3/5] Installing Application to C:\MDotEnterprises...
if not exist "C:\MDotEnterprises" mkdir "C:\MDotEnterprises"
xcopy /E /I /Y "%~dp0app-server" "C:\MDotEnterprises\app-server" >nul
xcopy /E /I /Y "%~dp0image-service" "C:\MDotEnterprises\image-service" >nul
copy /Y "%~dp0start.bat" "C:\MDotEnterprises\" >nul
copy /Y "%~dp0START_STUDIO.vbs" "C:\MDotEnterprises\" >nul
copy /Y "%~dp0STOP_STUDIO.bat" "C:\MDotEnterprises\" >nul
echo [OK] Files installed to C:\MDotEnterprises.

:: 4. Install Python Dependencies
echo.
echo [4/5] Checking & installing image processing packages...
cd /d "C:\MDotEnterprises\image-service"
python -m pip install -r requirements.txt >nul 2>&1
echo [OK] Dependencies ready.

:: 5. Create Desktop Shortcuts
echo.
echo [5/5] Creating Desktop Shortcuts...
powershell -Command "$WshShell = New-Object -ComObject WScript.Shell; $Desktop = [System.Environment]::GetFolderPath('Desktop'); $AppLnk = Join-Path $Desktop 'M.DoT Enterprises.lnk'; $Shortcut = $WshShell.CreateShortcut($AppLnk); $Shortcut.TargetPath = 'wscript.exe'; $Shortcut.Arguments = '\"C:\MDotEnterprises\START_STUDIO.vbs\"'; $Shortcut.WorkingDirectory = 'C:\MDotEnterprises'; $Shortcut.Description = 'Launch M.DoT Enterprises Studio'; if (Test-Path 'C:\Program Files\Google\Chrome\Application\chrome.exe') { $Shortcut.IconLocation = 'C:\Program Files\Google\Chrome\Application\chrome.exe,0' }; $Shortcut.Save(); $StopLnk = Join-Path $Desktop 'Stop M.DoT Enterprises.lnk'; $StopShortcut = $WshShell.CreateShortcut($StopLnk); $StopShortcut.TargetPath = 'C:\MDotEnterprises\STOP_STUDIO.bat'; $StopShortcut.WorkingDirectory = 'C:\MDotEnterprises'; $StopShortcut.Description = 'Stop M.DoT Enterprises'; $StopShortcut.IconLocation = '$env:SystemRoot\System32\shell32.dll,27'; $StopShortcut.Save();"
echo [OK] Desktop shortcuts created!

echo.
echo ============================================================
echo   INSTALLATION COMPLETED SUCCESSFULLY!
echo ============================================================
echo.
echo You can now remove your pen drive.
echo Launching M.DoT Enterprises now...
timeout /t 2 >nul
start "" "C:\MDotEnterprises\START_STUDIO.vbs"
exit /b 0
