#!/usr/bin/env python3
"""Test script to validate download progress parsing."""

import re
import subprocess

def test_progress_parsing():
    """Test the regex patterns against actual Docker log output."""
    
    # Sample log lines from actual output
    test_lines = [
        "79%|██████████████████████████████▍       | 2.28G/2.88G [32:13<05:02, 2.09MiB/s]",
        "76%|████████████████████████████▉         | 2.19G/2.88G [31:01<16:11, 760kiB/s]",
        "62%|████████████████████             | 1.79G/2.88G [25:42<19:45, 967kiB/s]",
        "30%|█████████▍                          | 879M/2.88G [14:52<1:07:17, 537kiB/s]"
    ]
    
    # Pattern to match progress
    pattern = r'(\d+)%\|[^|]*\|\s*([0-9.]+)([KMGT]?)B?/([0-9.]+)([KMGT]?)B?\s*\[[^<]*<[^,]*,\s*([0-9.]+)([KMGT]?)iB/s\]'
    
    print("Testing progress parsing patterns:")
    print("-" * 50)
    
    for line in test_lines:
        match = re.search(pattern, line)
        if match:
            percent = int(match.group(1))
            downloaded_val = float(match.group(2))
            downloaded_unit = match.group(3) or 'M'
            total_val = float(match.group(4))
            total_unit = match.group(5) or 'G'
            speed_val = float(match.group(6))
            speed_unit = match.group(7) or 'K'
            
            print(f"✅ Line: {line}")
            print(f"   Progress: {percent}%")
            print(f"   Downloaded: {downloaded_val}{downloaded_unit}B")
            print(f"   Total: {total_val}{total_unit}B")
            print(f"   Speed: {speed_val}{speed_unit}iB/s")
            print()
        else:
            print(f"❌ Failed to parse: {line}")
            print()

def test_actual_logs():
    """Test against actual Docker logs."""
    try:
        result = subprocess.run([
            "docker", "logs", "--tail", "10", 
            "audio-transcription-backend-1"
        ], capture_output=True, text=True, timeout=5)
        
        if result.returncode == 0:
            logs = result.stdout + result.stderr
            print("Recent Docker logs:")
            print("-" * 50)
            print(logs)
            
            # Test pattern matching
            pattern = r'(\d+)%\|[^|]*\|\s*([0-9.]+)([KMGT]?)B?/([0-9.]+)([KMGT]?)B?\s*\[[^<]*<[^,]*,\s*([0-9.]+)([KMGT]?)iB/s\]'
            
            lines = logs.split('\n')
            for line in lines:
                if '%' in line and '|' in line:
                    match = re.search(pattern, line)
                    if match:
                        print(f"\n✅ Parsed: {match.groups()}")
                    else:
                        print(f"\n❌ Could not parse: {line}")
        else:
            print("Failed to get Docker logs")
            
    except Exception as e:
        print(f"Error getting logs: {e}")

if __name__ == "__main__":
    test_progress_parsing()
    print("\n" + "="*60 + "\n")
    test_actual_logs()