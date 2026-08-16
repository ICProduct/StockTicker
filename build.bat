@echo off
setlocal
cd /d "%~dp0"

echo [StockTicker] Running checks and creating the release package...
call npm run build
if errorlevel 1 (
  echo.
  echo Build failed. Review the error message above.
  pause
  exit /b 1
)

echo.
echo Release package and SHA-256 file are available in:
echo %~dp0build
pause
