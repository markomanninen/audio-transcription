#!/usr/bin/env python3
"""
Real-time Transcription Monitor
Shows detailed progress indication during transcription operations.
"""

import requests
import time
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class TranscriptionMonitor:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url.rstrip('/')
        
    def get_status(self, file_id: int) -> Optional[Dict[str, Any]]:
        """Get detailed transcription status."""
        try:
            response = requests.get(f"{self.base_url}/api/transcription/{file_id}/status", timeout=5)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"[ERROR] Error getting status: {e}")
            return None
    
    def start_action(self, file_id: int, action: str = "auto") -> Optional[Dict[str, Any]]:
        """Start a transcription action with monitoring."""
        print(f"[TARGET] Starting '{action}' action for file {file_id}...")
        
        try:
            response = requests.post(
                f"{self.base_url}/api/transcription/{file_id}/action",
                params={"action": action},
                timeout=300  # 5 minutes timeout
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"[ERROR] Error executing action: {e}")
            return None
    
    def monitor_with_action(self, file_id: int, action: str = "auto", interval: int = 2):
        """Monitor transcription with initial action and real-time updates."""
        print(f"[SEARCH] Starting transcription monitor for file {file_id}")
        print("=" * 60)
        
        # Get initial status
        initial_status = self.get_status(file_id)
        if not initial_status:
            print("[ERROR] Failed to get initial status")
            return
        
        self.print_detailed_status(initial_status)
        print("=" * 60)
        
        # Start the action in background and monitor
        import threading
        action_result = {"result": None, "error": None, "completed": False}
        
        def run_action():
            try:
                result = self.start_action(file_id, action)
                action_result["result"] = result
                action_result["completed"] = True
                if result:
                    print(f"\n[OK] Action completed: {result.get('action', 'unknown')}")
                    print(f"[TEXT] {result.get('message', 'No message')}")
                    if 'segments' in result:
                        print(f"🧩 Final segments: {result['segments']}")
                else:
                    action_result["error"] = "No result returned"
            except Exception as e:
                action_result["error"] = str(e)
                action_result["completed"] = True
                print(f"\n[ERROR] Action failed: {e}")
        
        # Start action in background
        action_thread = threading.Thread(target=run_action, daemon=True)
        action_thread.start()
        
        # Monitor progress
        last_progress = -1
        last_stage = ""
        start_time = time.time()
        
        try:
            while not action_result["completed"]:
                status = self.get_status(file_id)
                if status:
                    current_progress = status.get('progress', 0) * 100
                    current_stage = status.get('transcription_stage', 'unknown')
                    current_status = status.get('status', 'unknown')
                    
                    # Show updates when progress or stage changes
                    if current_progress != last_progress or current_stage != last_stage:
                        elapsed = time.time() - start_time
                        print(f"⏱️  {elapsed:.1f}s | [STATS] {current_progress:.1f}% | 🔄 {current_status} | [TEXT] {current_stage}")
                        
                        if status.get('segments_created', 0) > 0:
                            print(f"    📑 Segments created: {status['segments_created']}")
                        
                        if status.get('whisper_model_loaded'):
                            print(f"    🤖 Model: {status['whisper_model_loaded']}")
                        
                        if status.get('audio_transformed'):
                            print(f"    [AUDIO] Audio transformed: ✅")
                        
                        last_progress = current_progress
                        last_stage = current_stage
                
                time.sleep(interval)
            
            # Final status check
            print("\n" + "=" * 60)
            final_status = self.get_status(file_id)
            if final_status:
                print("🏁 Final Status:")
                self.print_detailed_status(final_status)
            
        except KeyboardInterrupt:
            print("\n👋 Monitoring stopped by user")
    
    def print_detailed_status(self, status: Dict[str, Any]):
        """Print comprehensive status information."""
        print(f"📁 File: {status.get('filename', 'Unknown')}")
        print(f"🆔 ID: {status.get('file_id', 'Unknown')}")
        print(f"[STATS] Status: {status.get('status', 'Unknown')}")
        print(f"📈 Progress: {status.get('progress', 0) * 100:.1f}%")
        print(f"🧩 Segments: {status.get('segments_created', 0)}")
        print(f"🔄 Can Resume: {'✅' if status.get('can_resume', False) else '❌'}")
        print(f"⚠️  Is Stuck: {'🚨 YES' if status.get('is_stuck', False) else '[OK] No'}")
        print(f"[TEXT] Stage: {status.get('transcription_stage', 'Unknown')}")
        print(f"🤖 Model: {status.get('whisper_model_loaded') or 'Not loaded'}")
        print(f"[AUDIO] Audio Transformed: {'✅' if status.get('audio_transformed', False) else '❌'}")
        
        if status.get('interruption_count', 0) > 0:
            print(f"🔄 Interruptions: {status['interruption_count']}")
        
        if status.get('recovery_attempts', 0) > 0:
            print(f"🏥 Recovery Attempts: {status['recovery_attempts']}")
        
        if status.get('error_message'):
            print(f"💥 Error: {status['error_message']}")
        
        if status.get('started_at'):
            print(f"🕐 Started: {status['started_at']}")
        
        if status.get('duration'):
            duration = status['duration']
            mins = int(duration // 60)
            secs = int(duration % 60)
            print(f"⏱️  Audio Duration: {mins}m {secs}s")

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Real-time Transcription Monitor")
    parser.add_argument("file_id", type=int, help="Audio file ID to monitor")
    parser.add_argument("--action", choices=["auto", "resume", "restart", "continue"], 
                       default="auto", help="Action to perform")
    parser.add_argument("--url", default="http://localhost:8000", help="Backend URL")
    parser.add_argument("--interval", type=int, default=2, help="Update interval in seconds")
    parser.add_argument("--status-only", action="store_true", help="Only show status, don't start action")
    
    args = parser.parse_args()
    
    monitor = TranscriptionMonitor(args.url)
    
    if args.status_only:
        print(f"[SEARCH] Getting status for file {args.file_id}")
        status = monitor.get_status(args.file_id)
        if status:
            monitor.print_detailed_status(status)
        else:
            print("[ERROR] Failed to get status")
    else:
        monitor.monitor_with_action(args.file_id, args.action, args.interval)

if __name__ == "__main__":
    main()