# UI Status Inconsistency Problem - Debug Guide

**Date**: 2025-10-20  
**Issue**: Critical disconnect between API status endpoint and actual transcription progress in UI  
**Severity**: HIGH - UI shows inconsistent status information

## 🚨 PROBLEM DESCRIPTION

### The Core Issue
There is a **major disconnect** between what the API status endpoint reports and what the actual transcription service is doing:

- **API Status Endpoint**: Reports `status: "pending"` with `processing_stage: "model_ready_to_load"`
- **Actual UI State**: Shows active processing at 50.1% completion with "Transcribing audio - processing speech (606s)"
- **Backend Logs**: Show active transcription progress: `🎵 [TRANSCRIPTION] Progress: 50.1%`

### Specific File Affected
- **File ID**: 8
- **Filename**: `1/6 - Kaartintorpantie - Rainer.mp3`
- **Expected Behavior**: Status endpoint should reflect actual processing state
- **Actual Behavior**: Status endpoint shows cache-ready while transcription is running

## 🔍 EXACT SYMPTOMS

### API Response (WRONG)
```bash
curl -s "http://localhost:8080/api/transcription/8/status"
```
Returns:
```json
{
  "status": "pending",
  "processing_stage": "model_ready_to_load",
  "progress": 0.0,
  "error_message": "AI model is cached and ready. Click 'Start Transcription' to begin."
}
```

### UI Display (CORRECT)
- Status Badge: "PROCESSING"
- Progress: "50.1% complete"
- Stage: "Transcribing audio - processing speech (606s) (long running)"
- Right Panel: Shows active transcription details

### Backend Logs (CORRECT)
```
🎵 00:02:26 [TRANSCRIPTION] Progress: 46.7% - Transcribing audio - processing speech (440s) (long running)
```

## 🛠 HOW TO DEBUG WITH MCP

### 1. Check API vs UI Status
```javascript
// Use MCP Chrome DevTools to check UI data attributes
const file8Element = document.querySelector('[data-file-id="8"]');
console.log({
  fileId: file8Element.dataset.fileId,
  dataStatus: file8Element.dataset.status,
  actualBadgeText: file8Element.querySelector('.uppercase')?.textContent,
  actualButtonText: file8Element.querySelector('button')?.textContent
});
```

### 2. Monitor API Status Changes
```bash
# Create monitoring script
while true; do
  echo "=== $(date '+%H:%M:%S') - File 8 Status Monitor ==="
  curl -s "http://localhost:8080/api/transcription/8/status" | jq '{status, processing_stage, progress, error_message}'
  echo ""
  sleep 3
done
```

### 3. Check Transcription Service State
```bash
docker exec transcribe-backend-1 python -c "
from app.services.transcription_singleton import get_transcription_service, is_transcription_service_ready
print('Service ready:', is_transcription_service_ready())
try:
    service = get_transcription_service()
    print('Service exists:', service is not None)
    if service:
        print('Model loaded:', service.model is not None)
        print('Current file:', getattr(service, 'current_file_id', 'None'))
except Exception as e:
    print('Error:', str(e))
"
```

### 4. Check Backend Logs for Active Transcription
```bash
docker logs transcribe-backend-1 --tail 10 | grep -E "(🎵|TRANSCRIPTION|Processing)"
```

## 📁 DEBUG MONITOR FILES

### Create Status Monitor Script
```bash
# File: scripts/debug-status-monitor.sh
#!/bin/bash

echo "=== Audio Transcription Status Debug Monitor ==="
echo "Monitoring File 8 (1/6 - Kaartintorpantie - Rainer.mp3)"
echo "Press Ctrl+C to stop"
echo ""

while true; do
    echo "=== $(date '+%Y-%m-%d %H:%M:%S') ==="
    
    # API Status
    echo "🔌 API Status:"
    curl -s "http://localhost:8080/api/transcription/8/status" | jq '{
        status, 
        processing_stage, 
        progress, 
        error_message,
        updated_at
    }' || echo "❌ API call failed"
    
    # Backend Logs (last transcription message)
    echo ""
    echo "📋 Backend Logs:"
    docker logs transcribe-backend-1 --tail 5 | grep "🎵" | tail -1 || echo "No transcription logs found"
    
    # Service State
    echo ""
    echo "⚙️  Service State:"
    docker exec transcribe-backend-1 python -c "
from app.services.transcription_singleton import is_transcription_service_ready
print('Service ready:', is_transcription_service_ready())
" 2>/dev/null || echo "❌ Service check failed"
    
    echo ""
    echo "---"
    sleep 5
done
```

### Create UI Debug Script
```javascript
// File: debug/ui-status-debug.js
// Run this in browser console

function debugFileStatus(fileId) {
    const fileElement = document.querySelector(`[data-file-id="${fileId}"]`);
    if (!fileElement) {
        return { error: `File ${fileId} element not found` };
    }
    
    return {
        fileId: fileId,
        domStatus: fileElement.dataset.status,
        statusBadge: fileElement.querySelector('.uppercase')?.textContent,
        buttonText: fileElement.querySelector('button[class*="bg-"]')?.textContent?.trim(),
        isSelected: fileElement.dataset.selected === 'true',
        className: fileElement.className,
        // Try to get React Query cache data
        reactQueryCache: window.queryClient ? 
            window.queryClient.getQueryData(['transcription-status', parseInt(fileId), 'v3']) : 
            'Query client not accessible'
    };
}

// Debug File 8
console.log('File 8 Debug:', debugFileStatus('8'));

// Monitor status changes
setInterval(() => {
    console.log('File 8 Status Update:', debugFileStatus('8'));
}, 5000);
```

## 🔧 ROOT CAUSE ANALYSIS

### Probable Causes
1. **Orphaned Transcription Process**: Transcription service running but not properly tracked
2. **Status Endpoint Bug**: The `/api/transcription/{id}/status` endpoint not querying the active service
3. **React Query Cache Issue**: UI using stale cached data vs fresh API data
4. **Service Singleton Problem**: Transcription service not properly initialized but processing anyway

### Code Locations to Investigate
- `backend/app/api/transcription.py` - Status endpoint logic (lines 640-800)
- `backend/app/services/transcription_service.py` - `get_transcription_info()` method
- `backend/app/services/transcription_singleton.py` - Service ready state
- `frontend/src/components/Dashboard/FileList.tsx` - Status display logic

## 🚀 IMMEDIATE FIX ACTIONS

### 1. Force UI Refresh
```javascript
// In browser console
window.location.reload(true);
```

### 2. Check for Zombie Processes
```bash
# Look for orphaned transcription processes
docker exec transcribe-backend-1 python -c "
import psutil
for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
    if 'whisper' in str(proc.info).lower() or 'transcr' in str(proc.info).lower():
        print(proc.info)
"
```

### 3. Restart Backend to Clear State
```bash
docker restart transcribe-backend-1
```

## 📊 EXPECTED VS ACTUAL BEHAVIOR

| Component | Expected | Actual | Status |
|-----------|----------|--------|--------|
| API Status | `"status": "PROCESSING"` | `"status": "pending"` | ❌ WRONG |
| API Progress | `"progress": 50.1` | `"progress": 0.0` | ❌ WRONG |
| API Stage | Processing stage info | `"model_ready_to_load"` | ❌ WRONG |
| UI Badge | "PROCESSING" | "PROCESSING" | ✅ CORRECT |
| UI Progress | 50.1% | 50.1% | ✅ CORRECT |
| Backend Logs | Active progress | Active progress | ✅ CORRECT |

## 🎯 NEXT STEPS

1. **Identify** why status endpoint returns stale data
2. **Fix** the disconnect between transcription service and status endpoint
3. **Implement** proper status synchronization
4. **Add** monitoring to prevent future issues
5. **Test** with fresh transcription start to verify fix

---

**Note**: This issue indicates a fundamental problem with the transcription service architecture where the status tracking system is not properly connected to the actual processing engine.