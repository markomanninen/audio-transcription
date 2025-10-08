@echo off
REM Quick transcription status check

echo.
echo ====================================
echo    TRANSCRIPTION SYSTEM STATUS
echo ====================================
echo.

echo Checking service health...
curl -s http://localhost:8000/health | findstr "healthy" >nul
if %errorlevel%==0 (
    echo [✓] Backend service is running
) else (
    echo [X] Backend service is NOT running
    echo.
    echo To start services: docker compose up -d
    goto end
)

echo.
echo Checking frontend...
curl -s http://localhost:3000 >nul 2>&1
if %errorlevel%==0 (
    echo [✓] Frontend is running at http://localhost:3000
) else (
    echo [X] Frontend is NOT running
)

echo.
echo ====================================
echo   QUICK ACCESS COMMANDS
echo ====================================
echo.
echo View transcriptions: http://localhost:3000
echo API documentation:   http://localhost:8000/docs
echo Service logs:        docker logs audio-transcription-backend-1
echo.

:end
pause