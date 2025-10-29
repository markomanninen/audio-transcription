#!/usr/bin/env python3
"""
Comprehensive Audio Transcription System Monitor
Cross-platform status checker with real segment progress tracking and detailed datetime information

Usage:
    python scripts/status.py              # Quick status check
    python scripts/status.py --watch      # Continuous monitoring  
    python scripts/status.py --segments   # Show detailed segment progress
    python scripts/status.py --files      # Show all files with detailed datetime info
    python scripts/status.py --recent     # Show recent activity with timestamps
    python scripts/status.py --zombies    # Check for zombie processes
"""

import sys
import time
import json
import subprocess
from datetime import datetime
from urllib.request import urlopen, Request
from urllib.error import URLError

class TranscriptionMonitor:
    def __init__(self, base_url="http://localhost:8000"):
        self.base_url = base_url
        self.container_name = "audio-transcription-backend-1"
    
    def get_json(self, endpoint, timeout=5):
        """Get JSON data from API endpoint"""
        try:
            url = f"{self.base_url}{endpoint}"
            req = Request(url)
            with urlopen(req, timeout=timeout) as response:
                data = response.read().decode('utf-8')
                return json.loads(data)
        except Exception as e:
            return {"error": str(e)}
    
    def run_docker_query(self, python_code):
        """Run Python code inside Docker container"""
        try:
            # Use subprocess.run with list instead of shell=True for better cross-platform support
            result = subprocess.run([
                "docker", "exec", self.container_name, 
                "python3", "-c", python_code
            ], capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                return result.stdout.strip()
            else:
                # Return stderr for debugging
                return f"Error: {result.stderr.strip()}"
        except Exception as e:
            return f"Exception: {str(e)}"
    
    def get_processing_files(self):
        """Get files currently being processed with segment counts"""
        python_code = '''
import sqlite3, json
try:
    conn = sqlite3.connect("/app/data/transcriptions.db")
    cursor = conn.cursor()
    
    # Get processing files
    cursor.execute("""
        SELECT af.id, af.original_filename, af.transcription_progress, 
               af.error_message, af.duration, af.transcription_started_at,
               af.updated_at, af.created_at,
               COUNT(s.id) as segment_count
        FROM audio_files af
        LEFT JOIN segments s ON af.id = s.audio_file_id  
        WHERE af.transcription_status = 'PROCESSING'
        GROUP BY af.id
    """)
    
    rows = cursor.fetchall()
    files = []
    
    for row in rows:
        files.append({
            "id": row[0],
            "filename": row[1], 
            "progress": row[2],
            "error_message": row[3],
            "duration": row[4],
            "started_at": row[5],
            "updated_at": row[6],
            "created_at": row[7],
            "segment_count": row[8]
        })
    
    conn.close()
    print(json.dumps(files))
except Exception as e:
    print("[]")
'''
        
        result = self.run_docker_query(python_code)
        if result:
            try:
                return json.loads(result)
            except:
                pass
        return []
    
    def get_system_stats(self):
        """Get overall system statistics"""
        python_code = '''
import sqlite3, json
try:
    conn = sqlite3.connect("/app/data/transcriptions.db")
    cursor = conn.cursor()
    
    cursor.execute("SELECT transcription_status, COUNT(*) FROM audio_files GROUP BY transcription_status")
    stats = dict(cursor.fetchall())
    
    conn.close()
    print(json.dumps(stats))
except:
    print("{}")
'''
        
        result = self.run_docker_query(python_code)
        if result:
            try:
                return json.loads(result)
            except:
                pass
        return {}
    
    def parse_stage_info(self, error_msg):
        """Extract stage and elapsed time from error message"""
        if not error_msg or not error_msg.startswith("Stage: "):
            return None, None
        
        stage_info = error_msg[7:]  # Remove "Stage: "
        
        if "(" in stage_info and "elapsed)" in stage_info:
            parts = stage_info.split("(")
            stage = parts[0].strip()
            elapsed = parts[1].replace("elapsed)", "").strip()
            return stage, elapsed
        
        return stage_info, None
    
    def estimate_completion(self, segment_count, duration, elapsed_time):
        """Estimate completion percentage and ETA"""
        if not duration or duration <= 0:
            return None, None
        
        # Rough estimate: 1 segment per 3 seconds of audio
        estimated_total = max(int(duration / 3), 1)
        completion_pct = min((segment_count / estimated_total) * 100, 99)
        
        # Calculate ETA if we have elapsed time
        eta = None
        if elapsed_time and segment_count > 0:
            try:
                elapsed_seconds = float(elapsed_time.replace('s', ''))
                rate = segment_count / elapsed_seconds
                if rate > 0:
                    remaining_segments = estimated_total - segment_count
                    eta_seconds = remaining_segments / rate
                    eta = eta_seconds
            except:
                pass
        
        return completion_pct, eta
    
    def format_time(self, seconds):
        """Format seconds into readable time"""
        if not seconds:
            return "Unknown"
        
        try:
            seconds = float(seconds)
            if seconds > 3600:
                return f"{seconds/3600:.1f}h"
            elif seconds > 60:
                return f"{seconds/60:.1f}m"
            else:
                return f"{seconds:.0f}s"
        except:
            return str(seconds)
    
    def get_detailed_file_info(self):
        """Get detailed information about all files and their segments"""
        try:
            # Direct database query
            result = subprocess.run([
                "docker", "exec", self.container_name, "python3", "-c",
                """
import sqlite3, json
conn = sqlite3.connect('/app/data/transcriptions.db')
cursor = conn.cursor()
cursor.execute('SELECT id, original_filename, transcription_status, transcription_progress, created_at, updated_at, file_path, duration, transcription_started_at, transcription_completed_at FROM audio_files')
files = []
for row in cursor.fetchall():
    file_id, filename, status, progress, created, updated, path, duration, started, completed = row
    cursor.execute('SELECT COUNT(*) FROM segments WHERE audio_file_id = ?', (file_id,))
    segment_count = cursor.fetchone()[0]
    files.append({
        'id': file_id,
        'filename': filename, 
        'status': status,
        'progress': progress,
        'created_at': created,
        'updated_at': updated,
        'file_path': path,
        'duration': duration,
        'started_at': started,
        'completed_at': completed,
        'segment_count': segment_count
    })
conn.close()
print(json.dumps(files))
                """
            ], capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                return json.loads(result.stdout.strip())
            else:
                print(f"Debug - Error: {result.stderr}")
                return []
        except Exception as e:
            print(f"Debug - Exception: {e}")
            return []
    
    def show_file_details(self):
        """Show detailed information about all files"""
        files = self.get_detailed_file_info()
        
        if not files:
            print("📁 No files found in database")
            return
        
        print(f"📁 Found {len(files)} file(s) in database:")
        print("=" * 80)
        
        for file_info in files:
            status_emoji = {
                "COMPLETED": "✅", 
                "PROCESSING": "🔄", 
                "FAILED": "❌", 
                "PENDING": "⏳"
            }.get(file_info["status"], "📄")
            
            print(f"{status_emoji} {file_info['filename']}")
            print(f"   [STATS] Status: {file_info['status']} ({file_info['progress']}%)")
            print(f"   🕒 Duration: {self.format_time(file_info['duration'])}")
            print(f"   📅 Uploaded: {file_info['created_at']}")
            
            # Enhanced datetime information
            if file_info.get('started_at'):
                print(f"   🚀 Started: {file_info['started_at']}")
            if file_info.get('completed_at'):
                print(f"   🏁 Completed: {file_info['completed_at']}")
                
                # Calculate transcription duration if both start and end times exist
                if file_info.get('started_at'):
                    try:
                        from datetime import datetime
                        start_time = datetime.fromisoformat(file_info['started_at'].replace('Z', '+00:00'))
                        end_time = datetime.fromisoformat(file_info['completed_at'].replace('Z', '+00:00'))
                        transcription_duration = (end_time - start_time).total_seconds()
                        print(f"   ⏱️  Transcription took: {self.format_time(transcription_duration)}")
                    except:
                        pass
            elif file_info.get('started_at') and file_info["status"] == "PROCESSING":
                # Show how long it's been processing
                try:
                    from datetime import datetime
                    start_time = datetime.fromisoformat(file_info['started_at'].replace('Z', '+00:00'))
                    now = datetime.now()
                    processing_time = (now - start_time).total_seconds()
                    print(f"   ⏳ Processing for: {self.format_time(processing_time)}")
                except:
                    pass
            
            if file_info.get('updated_at') and file_info['updated_at'] != file_info['created_at']:
                print(f"   🔄 Last updated: {file_info['updated_at']}")
            
            # Show segment information
            segment_count = file_info['segment_count']
            if segment_count > 0:
                print(f"   🗣️  Segments: {segment_count} created")
            else:
                print("   🗣️  Segments: None created yet")
            
            print(f"   📁 Path: {file_info['file_path']}")
            print("-" * 80)
    
    def monitor_single_file(self, file_id, interval=3):
        """Monitor a specific file's transcription progress"""
        print(f"👁️  Monitoring File ID {file_id}")
        print("=" * 50)
        print("Press Ctrl+C to stop monitoring")
        print()
        
        try:
            while True:
                # Clear screen
                print("\033[2J\033[H", end="")
                
                print(f"👁️  File ID {file_id} - {datetime.now().strftime('%H:%M:%S')}")
                print("=" * 60)
                
                # Get specific file info - use simple direct query
                result = subprocess.run([
                    "docker", "exec", self.container_name, "python3", "-c",
                    f"""
import sqlite3, json
conn = sqlite3.connect('/app/data/transcriptions.db')
cursor = conn.cursor()
cursor.execute('SELECT id, original_filename, transcription_status, transcription_progress, transcription_started_at, transcription_completed_at, error_message, created_at, file_path, duration, format FROM audio_files WHERE id = {file_id}')
row = cursor.fetchone()
if row:
    file_id, filename, status, progress, started, completed, error, created, path, duration, file_format = row
    cursor.execute('SELECT COUNT(*) FROM segments WHERE audio_file_id = {file_id}')
    segment_count = cursor.fetchone()[0]
    cursor.execute('SELECT id, text, start_time, end_time, speaker_id FROM segments WHERE audio_file_id = {file_id} ORDER BY start_time DESC LIMIT 5')
    recent_segments = cursor.fetchall()
    file_info = {{'id': file_id, 'filename': filename, 'status': status, 'progress': progress, 'duration': duration, 'format': file_format, 'created_at': created, 'started_at': started, 'completed_at': completed, 'error_message': error, 'file_path': path, 'segment_count': segment_count, 'recent_segments': recent_segments}}
    print(json.dumps(file_info))
else:
    print('null')
conn.close()
                    """
                ], capture_output=True, text=True, timeout=30)
                
                if result.returncode == 0 and result.stdout.strip() != "null":
                    try:
                        file_info = json.loads(result.stdout.strip())
                        
                        status_emoji = {
                            "COMPLETED": "✅", 
                            "PROCESSING": "🔄", 
                            "FAILED": "❌", 
                            "PENDING": "⏳"
                        }.get(file_info["status"], "📄")
                        
                        print(f"{status_emoji} {file_info['filename']}")
                        print(f"🆔 File ID: {file_info['id']}")
                        print(f"[STATS] Status: {file_info['status']} ({file_info['progress']}%)")
                        print(f"🕒 Duration: {self.format_time(file_info['duration'])}")
                        
                        if file_info['started_at']:
                            print(f"🚀 Started: {file_info['started_at']}")
                        if file_info['completed_at']:
                            print(f"🏁 Completed: {file_info['completed_at']}")
                        
                        # Segments info
                        segment_count = file_info['segment_count']
                        print(f"🗣️  Segments: {segment_count} created")
                        
                        if segment_count > 0:
                            # Calculate progress estimate
                            estimated_total = max(int(file_info['duration'] / 3), 1)
                            completion_pct = min((segment_count / estimated_total) * 100, 99)
                            print(f"📈 Estimated completion: {completion_pct:.1f}%")
                            
                            print("[TEXT] Latest segments:")
                            for seg_id, text, start, end, speaker in file_info['recent_segments']:
                                speaker_info = f" (Speaker {speaker})" if speaker else ""
                                print(f"   {start:.1f}s-{end:.1f}s{speaker_info}: {text[:50]}...")
                        
                        if file_info['error_message']:
                            print(f"⚠️  Stage: {file_info['error_message']}")
                        
                        print(f"📁 Path: {file_info['file_path']}")
                        
                    except Exception as e:
                        print(f"[ERROR] Error parsing file data: {e}")
                else:
                    print(f"[ERROR] File ID {file_id} not found")
                
                print(f"\\n🔄 Refreshing in {interval} seconds... (Ctrl+C to stop)")
                time.sleep(interval)
                
        except KeyboardInterrupt:
            print("\\n👋 Monitoring stopped")
    
    def check_system_health(self):
        """Check if system is running"""
        health = self.get_json("/health")
        
        if "error" in health:
            print("[ERROR] System Status: OFFLINE")
            print(f"   Error: {health['error']}")
            return False
        
        print("[OK] System Status: ONLINE")
        if 'transcription_service' in health:
            ts = health['transcription_service']
            print(f"🤖 Model: {ts.get('model_size', 'Unknown')} ({ts.get('status', 'Unknown')})")
        
        return True
    
    def check_for_zombies(self):
        """Check for zombie transcription processes and orphaned database records"""
        print("[SEARCH] Checking for zombie processes...")
        
        # Check for orphaned PROCESSING records without active processes
        python_code = '''
import sqlite3, json
try:
    conn = sqlite3.connect("/app/data/transcriptions.db")
    cursor = conn.cursor()
    
    # Find files stuck in PROCESSING state
    cursor.execute("""
        SELECT id, original_filename, transcription_started_at, error_message
        FROM audio_files 
        WHERE transcription_status = 'PROCESSING'
    """)
    
    processing_files = cursor.fetchall()
    zombies = []
    
    for row in processing_files:
        file_id, filename, started_at, error_msg = row
        zombies.append({
            "id": file_id,
            "filename": filename,
            "started_at": started_at,
            "error_message": error_msg
        })
    
    conn.close()
    print(json.dumps(zombies))
except Exception as e:
    print("[]")
'''
        
        zombies = []
        result = self.run_docker_query(python_code)
        if result:
            try:
                zombies = json.loads(result)
            except:
                pass
        
        # Check if there are active Python processes
        process_check = '''
import subprocess, json
try:
    result = subprocess.run(['ps', 'aux'], capture_output=True, text=True)
    processes = []
    for line in result.stdout.split('\\n'):
        if 'python' in line and ('whisper' in line or 'transcrib' in line or 'spawn_main' in line):
            processes.append(line.strip())
    print(json.dumps(processes))
except:
    print("[]")
'''
        
        active_processes = []
        proc_result = self.run_docker_query(process_check)
        if proc_result:
            try:
                active_processes = json.loads(proc_result)
            except:
                pass
        
        if zombies:
            print(f"⚠️  Found {len(zombies)} zombie transcription(s):")
            for zombie in zombies:
                print(f"   🧟 File ID {zombie['id']}: {zombie['filename']}")
                if zombie['started_at']:
                    print(f"      Started: {zombie['started_at']}")
                if zombie['error_message']:
                    print(f"      Last stage: {zombie['error_message'][:50]}...")
        
        if active_processes:
            print(f"🔄 Found {len(active_processes)} active transcription process(es):")
            for proc in active_processes:
                if 'spawn_main' in proc:
                    # Extract CPU and memory usage
                    parts = proc.split()
                    if len(parts) >= 11:
                        cpu = parts[2]
                        mem = parts[3]
                        print(f"   🧠 High-resource process: CPU {cpu}%, Memory {mem}%")
                else:
                    print(f"   🐍 {proc[:80]}...")
        
        # Auto-cleanup zombies if no active processes
        if zombies and not active_processes:
            return self.cleanup_zombies(zombies)
        elif zombies and active_processes:
            print("⚠️  Zombies detected but processes are active - manual intervention may be needed")
            return False
        else:
            print("[OK] No zombie processes detected")
            return True
    
    def cleanup_zombies(self, zombies):
        """Clean up zombie transcription records"""
        if not zombies:
            return True
        
        print(f"� Cleaning up {len(zombies)} zombie transcription(s)...")
        
        zombie_ids = [str(z['id']) for z in zombies]
        cleanup_code = f'''
import sqlite3
try:
    conn = sqlite3.connect("/app/data/transcriptions.db")
    cursor = conn.cursor()
    
    # Reset zombie transcriptions to PENDING
    cursor.execute("""
        UPDATE audio_files 
        SET transcription_status = 'PENDING',
            transcription_progress = 0,
            error_message = 'Reset from zombie state by monitor',
            transcription_started_at = NULL,
            transcription_completed_at = NULL
        WHERE id IN ({",".join(zombie_ids)})
    """)
    
    conn.commit()
    conn.close()
    print("SUCCESS")
except Exception as e:
    print(f"ERROR: {{e}}")
'''
        
        result = self.run_docker_query(cleanup_code)
        
        if result and "SUCCESS" in result:
            print("[OK] Zombie cleanup completed successfully")
            print("💡 Affected files have been reset to PENDING status")
            return True
        else:
            print(f"[ERROR] Zombie cleanup failed: {result}")
            return False
    
    def show_processing_details(self, show_segments=False):
        """Show detailed processing information"""
        processing_files = self.get_processing_files()
        
        if not processing_files:
            print("[OK] No files currently being processed")
            return
        
        print(f"🔄 Active Transcriptions: {len(processing_files)}")
        print("=" * 60)
        
        for file_info in processing_files:
            print(f"\n📄 File: {file_info['filename']}")
            print(f"[STATS] Progress: {file_info['progress']:.1%}")
            
            # Show timing information
            if file_info.get('started_at'):
                print(f"🚀 Started: {file_info['started_at']}")
                
                # Calculate processing time
                try:
                    from datetime import datetime
                    start_time = datetime.fromisoformat(file_info['started_at'].replace('Z', '+00:00'))
                    now = datetime.now()
                    processing_time = (now - start_time).total_seconds()
                    print(f"⏳ Processing for: {self.format_time(processing_time)}")
                except:
                    pass
            
            if file_info.get('updated_at'):
                print(f"🔄 Last updated: {file_info['updated_at']}")
            
            stage, elapsed = self.parse_stage_info(file_info['error_message'])
            if stage:
                print(f"⚙️  Stage: {stage}")
            if elapsed:
                print(f"⏱️  Stage elapsed: {elapsed}")
            
            # Detailed segment analysis
            if show_segments and "Finalizing" in (stage or ""):
                segment_count = file_info['segment_count']
                duration = file_info['duration']
                
                print(f"[TEXT] Segments Created: {segment_count:,}")
                
                if duration:
                    completion_pct, eta = self.estimate_completion(segment_count, duration, elapsed)
                    
                    if completion_pct is not None:
                        print(f"📈 Segment Progress: {completion_pct:.1f}%")
                        
                        if completion_pct < 25:
                            print("   Status: 🐌 Just started - This will take a while")
                        elif completion_pct < 50:
                            print("   Status: 🔄 Still working - Not even halfway")
                        elif completion_pct < 75:
                            print("   Status: 📈 Making progress")
                        elif completion_pct < 95:
                            print("   Status: 🏃 Getting close to done")
                        else:
                            print("   Status: ✨ Actually almost finished!")
                    
                    if eta:
                        print(f"⏰ Estimated remaining: {self.format_time(eta)}")
                    
                    print(f"[AUDIO] Audio duration: {self.format_time(duration)}")
    
    def show_recent_activity(self, limit=5):
        """Show recent transcription activity with timestamps"""
        python_code = f'''
import sqlite3, json
try:
    conn = sqlite3.connect("/app/data/transcriptions.db")
    cursor = conn.cursor()
    
    # Get recent activity (files that have been updated recently)
    cursor.execute("""
        SELECT af.id, af.original_filename, af.transcription_status, 
               af.created_at, af.updated_at, af.transcription_started_at, 
               af.transcription_completed_at, af.duration,
               COUNT(s.id) as segment_count
        FROM audio_files af
        LEFT JOIN segments s ON af.id = s.audio_file_id  
        GROUP BY af.id
        ORDER BY af.updated_at DESC
        LIMIT {limit}
    """)
    
    rows = cursor.fetchall()
    files = []
    
    for row in rows:
        files.append({{
            "id": row[0],
            "filename": row[1], 
            "status": row[2],
            "created_at": row[3],
            "updated_at": row[4],
            "started_at": row[5],
            "completed_at": row[6],
            "duration": row[7],
            "segment_count": row[8]
        }})
    
    conn.close()
    print(json.dumps(files))
except Exception as e:
    print("[]")
'''
        
        result = self.run_docker_query(python_code)
        files = []
        if result:
            try:
                files = json.loads(result)
            except:
                pass
        
        if not files:
            print("[LIST] No recent activity found")
            return
        
        print(f"[LIST] Recent Activity (last {len(files)} files):")
        print("=" * 60)
        
        for file_info in files:
            status_emoji = {
                "COMPLETED": "✅", 
                "PROCESSING": "🔄", 
                "FAILED": "❌", 
                "PENDING": "⏳"
            }.get(file_info["status"], "📄")
            
            print(f"{status_emoji} {file_info['filename']}")
            print(f"   [STATS] Status: {file_info['status']}")
            
            # Show relevant timestamps based on status
            if file_info['status'] == 'COMPLETED' and file_info.get('completed_at'):
                print(f"   🏁 Completed: {file_info['completed_at']}")
                if file_info.get('started_at'):
                    try:
                        from datetime import datetime
                        start_time = datetime.fromisoformat(file_info['started_at'].replace('Z', '+00:00'))
                        end_time = datetime.fromisoformat(file_info['completed_at'].replace('Z', '+00:00'))
                        duration = (end_time - start_time).total_seconds()
                        print(f"   ⏱️  Took: {self.format_time(duration)} (for {self.format_time(file_info['duration'])} audio)")
                    except:
                        pass
            elif file_info['status'] == 'PROCESSING' and file_info.get('started_at'):
                print(f"   🚀 Started: {file_info['started_at']}")
                try:
                    from datetime import datetime
                    start_time = datetime.fromisoformat(file_info['started_at'].replace('Z', '+00:00'))
                    now = datetime.now()
                    processing_time = (now - start_time).total_seconds()
                    print(f"   ⏳ Processing for: {self.format_time(processing_time)}")
                except:
                    pass
            elif file_info['status'] == 'PENDING':
                print(f"   📅 Uploaded: {file_info['created_at']}")
            
            if file_info['segment_count'] > 0:
                print(f"   🗣️  Segments: {file_info['segment_count']}")
            
            print(f"   🔄 Last activity: {file_info['updated_at']}")
            print()

    def show_system_overview(self):
        """Show system overview with statistics"""
        print("[TARGET] Audio Transcription System Status")
        print("=" * 50)
        print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()
        
        # System health
        if not self.check_system_health():
            print("\n💡 To start: docker compose up -d")
            return False
        
        # Check for zombies
        print()
        self.check_for_zombies()
        
        # System statistics
        stats = self.get_system_stats()
        if stats:
            print("\n[STATS] System Statistics:")
            total = sum(stats.values())
            for status, count in stats.items():
                emoji = {"COMPLETED": "✅", "PROCESSING": "🔄", "FAILED": "❌", "PENDING": "⏳"}.get(status, "📄")
                print(f"   {emoji} {status}: {count}")
            print(f"   📈 Total files: {total}")
        
        print("\n💡 Quick Access:")
        print("   Web UI: http://localhost:3000")
        print("   API: http://localhost:8000/docs")
        
        return True
    
    def monitor_continuous(self, interval=3, show_segments=False):
        """Continuous monitoring mode"""
        print("🔄 Continuous Monitor Mode")
        print(f"Refreshing every {interval}s - Press Ctrl+C to stop")
        print()
        
        try:
            while True:
                # Clear screen
                print("\033[2J\033[H", end="")
                
                if self.show_system_overview():
                    print()
                    self.show_processing_details(show_segments)
                
                time.sleep(interval)
                
        except KeyboardInterrupt:
            print("\n👋 Monitoring stopped")

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Audio Transcription System Monitor")
    parser.add_argument("--watch", action="store_true", help="Continuous monitoring mode")
    parser.add_argument("--segments", action="store_true", help="Show detailed segment progress")
    parser.add_argument("--zombies", action="store_true", help="Check for and clean up zombie processes")
    parser.add_argument("--files", action="store_true", help="Show detailed information about all files")
    parser.add_argument("--recent", action="store_true", help="Show recent transcription activity with timestamps")
    parser.add_argument("--monitor-file", type=int, help="Monitor specific file ID in real-time")
    parser.add_argument("--interval", type=int, default=3, help="Refresh interval for watch mode")
    parser.add_argument("--url", default="http://localhost:8000", help="Backend URL")
    
    args = parser.parse_args()
    
    monitor = TranscriptionMonitor(args.url)
    
    try:
        if args.zombies:
            print("🧟 Zombie Process Check Mode")
            print("=" * 40)
            monitor.check_for_zombies()
        elif args.files:
            print("📁 Detailed File Information")
            print("=" * 40)
            monitor.show_file_details()
        elif args.recent:
            print("[LIST] Recent Activity")
            print("=" * 40)
            monitor.show_recent_activity()
        elif args.monitor_file:
            monitor.monitor_single_file(args.monitor_file, args.interval)
        elif args.watch:
            monitor.monitor_continuous(args.interval, args.segments)
        else:
            if monitor.show_system_overview():
                print()
                monitor.show_processing_details(args.segments)
                
    except KeyboardInterrupt:
        print("\n👋 Goodbye!")
    except Exception as e:
        print(f"[ERROR] Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()