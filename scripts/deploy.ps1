#!/usr/bin/env pwsh
# Quick deployment script for audio transcription app

Write-Host "Quick Deploy Script" -ForegroundColor Cyan

# Restart services without rebuilding (for code changes)
if ($args[0] -eq "quick" -or $args.Count -eq 0) {
    Write-Host "Restarting services (code changes only)..." -ForegroundColor Yellow
    docker-compose restart backend frontend
    
        Write-Host "Waiting for backend to be ready... (checking ports 8000, 8080, 8081)" -ForegroundColor Yellow
        $backendReady = $false
        $portsToCheck = @(8000, 8080, 8081)
        do {
            Start-Sleep -Seconds 2
            foreach ($p in $portsToCheck) {
                try {
                    $uri = "http://localhost:${p}/health"
                    $response = Invoke-RestMethod -Uri $uri -Method GET -TimeoutSec 3 -ErrorAction Stop
                    if ($response) {
                        Write-Host "\nBackend responded on port ${p}." -ForegroundColor Green
                        $backendReady = $true
                        break
                    }
                } catch {
                    Write-Host "." -NoNewline -ForegroundColor DarkGray
                }
            }
        } while (-not $backendReady)
    
    Write-Host ""
    Write-Host "Services restarted!" -ForegroundColor Green
}

# Full rebuild (for dependency changes)
elseif ($args[0] -eq "build") {
    Write-Host "Full rebuild (dependency changes)..." -ForegroundColor Yellow
    docker-compose down
    docker-compose build
    docker-compose up -d
    
    Write-Host "Waiting for backend to be ready... (checking ports 8000, 8080, 8081)" -ForegroundColor Yellow
    $backendReady = $false
    $portsToCheck = @(8000, 8080, 8081)
    do {
        Start-Sleep -Seconds 2
        foreach ($p in $portsToCheck) {
            try {
                $uri = "http://localhost:${p}/health"
                $response = Invoke-RestMethod -Uri $uri -Method GET -TimeoutSec 3 -ErrorAction Stop
                if ($response) {
                    Write-Host "\nBackend responded on port ${p}." -ForegroundColor Green
                    $backendReady = $true
                    break
                }
            } catch {
                Write-Host "." -NoNewline -ForegroundColor DarkGray
            }
        }
    } while (-not $backendReady)
    
    Write-Host ""
    Write-Host "Full rebuild complete!" -ForegroundColor Green
}

# Backend only
elseif ($args[0] -eq "backend") {
    Write-Host "Restarting backend only..." -ForegroundColor Yellow
    docker-compose restart backend
    Write-Host "Backend restarted!" -ForegroundColor Green
}

# Frontend only  
elseif ($args[0] -eq "frontend") {
    Write-Host "Restarting frontend only..." -ForegroundColor Yellow
    docker-compose restart frontend
    Write-Host "Frontend restarted!" -ForegroundColor Green
}

# Help
else {
    Write-Host "Usage:" -ForegroundColor White
    Write-Host "  ./deploy.ps1 quick     - Restart services (default)" -ForegroundColor Gray
    Write-Host "  ./deploy.ps1 build     - Full rebuild" -ForegroundColor Gray  
    Write-Host "  ./deploy.ps1 backend   - Restart backend only" -ForegroundColor Gray
    Write-Host "  ./deploy.ps1 frontend  - Restart frontend only" -ForegroundColor Gray
}

Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Backend:  http://localhost:8000" -ForegroundColor Cyan