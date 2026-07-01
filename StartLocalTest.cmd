@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0WumingTown-Command.ps1" -Mode StartWeb %*
set "exitCode=%ERRORLEVEL%"
echo.
if not "%exitCode%"=="0" echo StartLocalTest failed with exit code %exitCode%.
pause
exit /b %exitCode%
