@echo off
setlocal EnableExtensions

if /I "%~1"==":backend" goto backend
if /I "%~1"==":frontend" goto frontend

set "SCRIPT_PATH=%~f0"
set "PAUSE_ON_EXIT=1"
if /I "%~1"=="--no-pause" (
  set "PAUSE_ON_EXIT=0"
  shift
)
if /I "%~1"=="--check" set "PAUSE_ON_EXIT=0"

set "ROOT=%~dp0"
set "LOG_DIR=%ROOT%logs"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

call :resolve_python
if errorlevel 1 (
  call :wait_for_key
  exit /b 1
)

if /I "%~1"=="--check" (
  echo [OK] Python: %PYTHON_EXE%
  echo [OK] Backend dependencies available.
  echo [INFO] Logs will be written to: %LOG_DIR%
  exit /b 0
)

set "START_BACKEND=1"
set "START_FRONTEND=1"

call :port_in_use 8000
if not errorlevel 1 (
  call :url_available http://127.0.0.1:8000/health
  if errorlevel 1 (
    echo [ERROR] Port 8000 belongs to another process and AulaRed cannot reuse it.
    call :wait_for_key
    exit /b 1
  )
  set "START_BACKEND=0"
  echo [OK] Backend is already running on port 8000; reusing it.
)

call :port_in_use 5173
if not errorlevel 1 (
  call :url_available http://127.0.0.1:5173/
  if errorlevel 1 (
    echo [ERROR] Port 5173 belongs to another process and AulaRed cannot reuse it.
    call :wait_for_key
    exit /b 1
  )
  set "START_FRONTEND=0"
  echo [OK] Frontend is already running on port 5173; reusing it.
)

echo ============================================================>> "%LOG_DIR%\launcher.log"
echo [%DATE% %TIME%] Starting AulaRed debug services>> "%LOG_DIR%\launcher.log"
echo Starting AulaRed in debug mode...
echo   Frontend: http://127.0.0.1:5173
echo   Backend : http://127.0.0.1:8000
echo   Logs    : %LOG_DIR%

if "%START_BACKEND%"=="1" start "AulaRed Backend" /B "%ComSpec%" /d /c call "%SCRIPT_PATH%" :backend "%PYTHON_EXE%"
if "%START_FRONTEND%"=="1" start "AulaRed Frontend" /B "%ComSpec%" /d /c call "%SCRIPT_PATH%" :frontend

echo Services started. Use Ctrl+C only in their own windows, or close the AulaRed processes.
echo This window stays open so you can read startup errors.
call :wait_for_key
exit /b 0

:resolve_python
if not defined PYTHON_EXE (
  for %%P in (python.exe) do set "PYTHON_EXE=%%~$PATH:P"
  if not defined PYTHON_EXE (
    if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" (
      set "PYTHON_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
    )
  )
)

if not defined PYTHON_EXE (
  echo [ERROR] Python was not found. Set PYTHON_EXE to a Python executable and run this file again.
  exit /b 1
)

"%PYTHON_EXE%" -c "import bcrypt, cryptography, fastapi, multipart, PIL, qrcode, uvicorn" >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Python is missing one or more backend dependencies.
  echo         Install them with: "%PYTHON_EXE%" -m pip install -r "%ROOT%api\requirements.txt"
  exit /b 1
)
exit /b 0

:port_in_use
netstat -ano | findstr /R /C:":%~1 .*LISTENING" >nul 2>&1
exit /b %ERRORLEVEL%

:url_available
powershell.exe -NoLogo -NoProfile -Command "try { $response = Invoke-WebRequest -UseBasicParsing -Uri '%~1' -TimeoutSec 3; if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { exit 0 }; exit 1 } catch { exit 1 }" >nul 2>&1
exit /b %ERRORLEVEL%

:wait_for_key
if "%PAUSE_ON_EXIT%"=="1" (
  echo.
  echo Press any key to close this launcher window...
  pause >nul
)
exit /b 0

:backend
set "ROOT=%~dp0"
set "LOG_DIR=%ROOT%logs"
set "PYTHON_EXE=%~2"
echo [%DATE% %TIME%] Backend starting on http://127.0.0.1:8000>> "%LOG_DIR%\backend.log"
cd /d "%ROOT%"
"%PYTHON_EXE%" -m uvicorn api.app:app --host 0.0.0.0 --port 8000 --log-level debug --access-log >> "%LOG_DIR%\backend.log" 2>&1
echo [%DATE% %TIME%] Backend stopped with exit code %ERRORLEVEL%>> "%LOG_DIR%\backend.log"
exit /b

:frontend
set "ROOT=%~dp0"
set "LOG_DIR=%ROOT%logs"
echo [%DATE% %TIME%] Frontend starting on http://127.0.0.1:5173>> "%LOG_DIR%\frontend.log"
cd /d "%ROOT%frontend"
call npm.cmd run dev -- --host 0.0.0.0 --port 5173 >> "%LOG_DIR%\frontend.log" 2>&1
echo [%DATE% %TIME%] Frontend stopped with exit code %ERRORLEVEL%>> "%LOG_DIR%\frontend.log"
exit /b
