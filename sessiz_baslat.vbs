Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\zovi\.gemini\antigravity\scratch\mor-mektup-web"
WshShell.Run "python server.py", 0, False
