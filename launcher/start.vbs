Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
strDir = FSO.GetParentFolderName(WScript.ScriptFullName)
WshShell.Run "cmd /c """ & strDir & "\start.bat""", 0, False
Set WshShell = Nothing
Set FSO = Nothing
