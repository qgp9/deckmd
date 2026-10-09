@echo off
rem Double-click or run from a terminal: starts serve.ps1 regardless of the execution policy. Arguments are passed through.
rem NOT TESTED ON WINDOWS YET (see the note at the top of serve.ps1).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" %*
if errorlevel 1 pause
