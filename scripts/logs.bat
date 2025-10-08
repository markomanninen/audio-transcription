@echo off
REM Log Inspector Batch Script for Audio Transcription Docker Application
REM Usage: logs.bat [container] [filter] [tail]
REM Examples:
REM   logs.bat                     # Show recent backend logs
REM   logs.bat frontend            # Show frontend logs
REM   logs.bat backend transcription # Show transcription logs
REM   logs.bat backend error 50    # Show last 50 error logs

setlocal enabledelayedexpansion

REM Default values
set CONTAINER=audio-transcription-backend-1
set FILTER=""
set TAIL=100

REM Parse arguments
if "%1"=="frontend" set CONTAINER=audio-transcription-frontend-1
if "%1"=="ollama" set CONTAINER=audio-transcription-ollama-1
if "%1"=="redis" set CONTAINER=audio-transcription-redis-1
if "%1"=="backend" set CONTAINER=audio-transcription-backend-1

if not "%2"=="" set FILTER=%2
if not "%3"=="" set TAIL=%3

echo.
echo 📋 Inspecting %CONTAINER% logs...
echo 🔍 Filter: %FILTER%
echo 📄 Lines: %TAIL%
echo ------------------------------------------------------------

REM Get logs and apply filter if specified
if %FILTER%=="" (
    docker logs %CONTAINER% --tail %TAIL%
) else (
    docker logs %CONTAINER% --tail %TAIL% | findstr /i "%FILTER%"
)

echo.
echo 📊 Log inspection complete
pause