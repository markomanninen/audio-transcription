#!/usr/bin/env python3
"""
Comprehensive transcription debugging script.
This will systematically test every component and log everything.
"""

import requests
import time
import json
import subprocess
import sys
from datetime import datetime

def log(message):
    timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    print(f"[{timestamp}] {message}")
    sys.stdout.flush()

def run_command(cmd, description):
    log(f"EXEC: {description}")
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
        log(f"EXIT CODE: {result.returncode}")
        if result.stdout:
            log(f"STDOUT: {result.stdout.strip()}")
        if result.stderr:
            log(f"STDERR: {result.stderr.strip()}")
        return result.returncode == 0, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        log(f"TIMEOUT: Command timed out after 30s")
        return False, "", "Timeout"
    except Exception as e:
        log(f"ERROR: {e}")
        return False, "", str(e)

def make_request(method, url, data=None, timeout=10):
    log(f"HTTP {method}: {url}")
    if data:
        log(f"DATA: {json.dumps(data, indent=2)}")
    
    try:
        if method == "GET":
            response = requests.get(url, timeout=timeout)
        elif method == "POST":
            response = requests.post(url, json=data, timeout=timeout)
        
        log(f"RESPONSE: {response.status_code}")
        
        try:
            response_data = response.json()
            log(f"RESPONSE BODY: {json.dumps(response_data, indent=2)}")
        except:
            log(f"RESPONSE BODY (text): {response.text[:500]}")
        
        return response.status_code, response.text
    except requests.exceptions.Timeout:
        log(f"REQUEST TIMEOUT after {timeout}s")
        return None, "TIMEOUT"
    except requests.exceptions.ConnectionError:
        log(f"CONNECTION ERROR")
        return None, "CONNECTION_ERROR"
    except Exception as e:
        log(f"REQUEST ERROR: {e}")
        return None, str(e)

def check_container_health():
    log("=== CONTAINER HEALTH CHECK ===")
    
    # Check container status
    success, stdout, stderr = run_command("docker ps --filter name=transcribe-backend-1 --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'", "Container status")
    
    # Check container restart count
    success, stdout, stderr = run_command("docker inspect transcribe-backend-1 --format '{{.RestartCount}}'", "Restart count")
    
    # Check container uptime
    success, stdout, stderr = run_command("docker inspect transcribe-backend-1 --format '{{.State.StartedAt}}'", "Container start time")
    
    return True

def check_backend_endpoints():
    log("=== BACKEND ENDPOINT CHECK ===")
    
    base_url = "http://localhost:8000"
    
    # Health check
    status, response = make_request("GET", f"{base_url}/health")
    if status != 200:
        log("CRITICAL: Health check failed!")
        return False
    
    # Transcription status
    status, response = make_request("GET", f"{base_url}/api/transcription/1/status")
    if not status:
        log("CRITICAL: Status endpoint failed!")
        return False
    
    return True

def monitor_logs_realtime():
    log("=== STARTING REAL-TIME LOG MONITORING ===")
    
    # Start log monitoring in background
    log_process = subprocess.Popen(
        ["docker", "logs", "-f", "transcribe-backend-1"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        universal_newlines=True,
        bufsize=1
    )
    
    return log_process

def trigger_transcription_and_monitor():
    log("=== TRIGGERING TRANSCRIPTION WITH FULL MONITORING ===")
    
    # Start log monitoring
    log_monitor = monitor_logs_realtime()
    
    # Wait a moment for log stream to start
    time.sleep(2)
    
    try:
        # Trigger transcription
        transcription_data = {
            "include_diarization": True,
            "model_size": "base", 
            "language": None
        }
        
        log("TRIGGERING TRANSCRIPTION...")
        status, response = make_request("POST", "http://localhost:8000/api/transcription/1/transcribe", transcription_data, timeout=30)
        
        if status == 202:
            log("SUCCESS: Transcription queued (202)")
        elif status == 200:
            log("SUCCESS: Transcription started (200)")
        elif not status:
            log("CRITICAL: Transcription request failed - no response")
            return False
        else:
            log(f"UNEXPECTED: Status {status}")
        
        # Monitor for 30 seconds
        log("MONITORING FOR 30 SECONDS...")
        
        for i in range(30):
            time.sleep(1)
            
            # Check status every 5 seconds
            if i % 5 == 0:
                status, response = make_request("GET", "http://localhost:8000/api/transcription/1/status", timeout=5)
                if not status:
                    log(f"STATUS CHECK FAILED at {i}s")
                    break
        
        return True
        
    finally:
        # Stop log monitoring
        log_monitor.terminate()
        log("=== LOG MONITORING STOPPED ===")

def check_service_stability():
    log("=== SERVICE STABILITY CHECK ===")
    
    for i in range(10):
        log(f"Stability check {i+1}/10")
        
        # Quick health check
        status, response = make_request("GET", "http://localhost:8000/health", timeout=5)
        if not status:
            log(f"STABILITY FAILURE at check {i+1}")
            return False
        
        time.sleep(2)
    
    log("STABILITY CHECK PASSED")
    return True

def analyze_recent_logs():
    log("=== ANALYZING RECENT LOGS ===")
    
    # Get last 100 lines of logs
    success, stdout, stderr = run_command("docker logs transcribe-backend-1 --tail 100", "Recent logs")
    
    if success and stdout:
        # Look for specific patterns
        lines = stdout.split('\n')
        
        error_count = sum(1 for line in lines if 'ERROR' in line.upper())
        exception_count = sum(1 for line in lines if 'Exception' in line or 'Traceback' in line)
        restart_count = sum(1 for line in lines if 'Started server' in line or 'Started reloader' in line)
        
        log(f"ANALYSIS: {error_count} errors, {exception_count} exceptions, {restart_count} restarts in last 100 log lines")
        
        # Show recent errors
        for line in lines[-20:]:
            if any(keyword in line.upper() for keyword in ['ERROR', 'EXCEPTION', 'TRACEBACK', 'FAILED']):
                log(f"RECENT ERROR: {line.strip()}")

def main():
    log("=" * 60)
    log("COMPREHENSIVE TRANSCRIPTION DEBUGGING SESSION")
    log("=" * 60)
    
    # Step 1: Basic health
    if not check_container_health():
        log("ABORT: Container health check failed")
        return False
    
    # Step 2: Endpoint checks
    if not check_backend_endpoints():
        log("ABORT: Backend endpoint check failed") 
        return False
    
    # Step 3: Analyze existing logs
    analyze_recent_logs()
    
    # Step 4: Stability check
    if not check_service_stability():
        log("ABORT: Service stability check failed")
        return False
    
    # Step 5: Trigger transcription with monitoring
    if not trigger_transcription_and_monitor():
        log("ABORT: Transcription trigger failed")
        return False
    
    log("=" * 60)
    log("DEBUG SESSION COMPLETED - CHECK LOGS ABOVE FOR ISSUES")
    log("=" * 60)
    
    return True

if __name__ == "__main__":
    main()