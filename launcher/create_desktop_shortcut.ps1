$WshShell = New-Object -ComObject WScript.Shell
$LauncherDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$DesktopPaths = @(
    "C:\Users\Lenovo\OneDrive\Desktop",
    "C:\Users\Lenovo\Desktop",
    [System.Environment]::GetFolderPath('Desktop')
) | Select-Object -Unique

foreach ($Desktop in $DesktopPaths) {
    if (Test-Path $Desktop) {
        # 1. Main App Shortcut (Starts silently without black command prompts)
        $AppLnk = Join-Path $Desktop "M.DoT Enterprises.lnk"
        $Shortcut = $WshShell.CreateShortcut($AppLnk)
        $Shortcut.TargetPath = "wscript.exe"
        $Shortcut.Arguments = "`"$LauncherDir\start.vbs`""
        $Shortcut.WorkingDirectory = $LauncherDir
        $Shortcut.Description = "Open M.DoT Enterprises ID Card Studio"
        if (Test-Path "C:\Program Files\Google\Chrome\Application\chrome.exe") {
            $Shortcut.IconLocation = "C:\Program Files\Google\Chrome\Application\chrome.exe,0"
        }
        $Shortcut.Save()
        Write-Host "Created Desktop Shortcut: $AppLnk"

        # 2. Stop App Shortcut
        $StopLnk = Join-Path $Desktop "Stop M.DoT Enterprises.lnk"
        $StopShortcut = $WshShell.CreateShortcut($StopLnk)
        $StopShortcut.TargetPath = Join-Path $LauncherDir "stop.bat"
        $StopShortcut.WorkingDirectory = $LauncherDir
        $StopShortcut.Description = "Stop M.DoT Enterprises Services"
        $StopShortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,27" # Red power/eject icon
        $StopShortcut.Save()
        Write-Host "Created Desktop Shortcut: $StopLnk"
    }
}
