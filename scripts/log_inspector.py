#!/usr/bin/env python3
"""
Log Inspector for Audio Transcription Docker Application

This script provides easy access to Docker container logs with filtering and formatting.
Usage examples:
    python log_inspector.py                          # Show recent backend logs
    python log_inspector.py --container frontend     # Show frontend logs
    python log_inspector.py --filter transcription   # Filter for transcription-related logs
    python log_inspector.py --tail 100 --since 5m   # Show last 100 lines from last 5 minutes
    python log_inspector.py --live                   # Follow logs in real-time
"""

import subprocess
import argparse
import sys
import re
from datetime import datetime, timedelta
from typing import List, Optional


class LogInspector:
    def __init__(self):
        self.containers = {
            'backend': 'audio-transcription-backend-1',
            'frontend': 'audio-transcription-frontend-1', 
            'ollama': 'audio-transcription-ollama-1',
            'redis': 'audio-transcription-redis-1'
        }
        
        self.filter_patterns = {
            'transcription': r'transcription|whisper|segments|resume|restart|completed|failed',
            'upload': r'upload|file.*upload|multipart',
            'api': r'POST|GET|PUT|DELETE|HTTP/1.1',
            'error': r'error|ERROR|exception|Exception|failed|FAILED',
            'database': r'sqlalchemy|SELECT|INSERT|UPDATE|DELETE|database',
            'ai': r'ollama|openrouter|llm|ai.*analysis|corrections',
            'performance': r'progress|speed|duration|elapsed|memory|cpu',
            'segments': r'segments|INSERT INTO segments|segment.*created'
        }

    def get_container_name(self, container: str) -> str:
        """Get full container name from short name."""
        if container in self.containers:
            return self.containers[container]
        
        # If it's already a full name, return as-is
        if 'audio-transcription' in container:
            return container
            
        # Default to backend if not specified
        return self.containers['backend']

    def check_container_exists(self, container_name: str) -> bool:
        """Check if container exists and is running."""
        try:
            result = subprocess.run(
                ['docker', 'ps', '--format', '{{.Names}}'],
                capture_output=True, text=True, check=True
            )
            return container_name in result.stdout
        except subprocess.CalledProcessError:
            return False

    def get_logs(self, container: str, tail: Optional[int] = None, 
                 since: Optional[str] = None, follow: bool = False) -> str:
        """Get logs from specified container."""
        container_name = self.get_container_name(container)
        
        if not self.check_container_exists(container_name):
            print(f"❌ Container '{container_name}' not found or not running")
            print("Available containers:")
            self.list_containers()
            return ""

        cmd = ['docker', 'logs', container_name]
        
        if tail:
            cmd.extend(['--tail', str(tail)])
        if since:
            cmd.extend(['--since', since])
        if follow:
            cmd.append('--follow')

        try:
            if follow:
                # For follow mode, stream output directly
                subprocess.run(cmd)
                return ""
            else:
                result = subprocess.run(cmd, capture_output=True, text=True, check=True)
                return result.stdout
        except subprocess.CalledProcessError as e:
            print(f"❌ Error getting logs: {e}")
            return ""

    def filter_logs(self, logs: str, filter_pattern: str, case_sensitive: bool = False) -> str:
        """Filter logs using regex pattern."""
        if not logs:
            return ""
            
        # Get predefined pattern or use custom pattern
        pattern = self.filter_patterns.get(filter_pattern, filter_pattern)
        
        flags = 0 if case_sensitive else re.IGNORECASE
        regex = re.compile(pattern, flags)
        
        filtered_lines = []
        for line in logs.split('\n'):
            if regex.search(line):
                filtered_lines.append(line)
        
        return '\n'.join(filtered_lines)

    def format_logs(self, logs: str, highlight_errors: bool = True) -> str:
        """Format logs with colors and highlighting."""
        if not logs:
            return ""
            
        formatted_lines = []
        for line in logs.split('\n'):
            if not line.strip():
                continue
                
            # Color coding for different log levels
            if highlight_errors:
                if re.search(r'ERROR|error|FAILED|failed|exception', line, re.IGNORECASE):
                    line = f"🔴 {line}"
                elif re.search(r'WARNING|warning|WARN', line, re.IGNORECASE):
                    line = f"🟡 {line}"
                elif re.search(r'INFO|info', line, re.IGNORECASE):
                    line = f"ℹ️  {line}"
                elif re.search(r'completed|success|✅', line, re.IGNORECASE):
                    line = f"✅ {line}"
                elif re.search(r'transcription|whisper', line, re.IGNORECASE):
                    line = f"🎵 {line}"
                elif re.search(r'segments.*created|INSERT INTO segments', line, re.IGNORECASE):
                    line = f"📝 {line}"
            
            formatted_lines.append(line)
        
        return '\n'.join(formatted_lines)

    def list_containers(self):
        """List available containers."""
        try:
            result = subprocess.run(
                ['docker', 'ps', '--format', 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'],
                capture_output=True, text=True, check=True
            )
            print(result.stdout)
        except subprocess.CalledProcessError as e:
            print(f"❌ Error listing containers: {e}")

    def show_filter_help(self):
        """Show available filter patterns."""
        print("📋 Available filter patterns:")
        for name, pattern in self.filter_patterns.items():
            print(f"  {name:12} - {pattern}")
        print("\n💡 You can also use custom regex patterns")


def main():
    parser = argparse.ArgumentParser(
        description="Inspect Docker logs for Audio Transcription application",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s                                    # Show recent backend logs
  %(prog)s --container frontend               # Show frontend logs  
  %(prog)s --filter transcription             # Filter transcription logs
  %(prog)s --filter "error|failed"            # Custom regex filter
  %(prog)s --tail 50 --since 10m              # Last 50 lines from 10 minutes
  %(prog)s --live                             # Follow logs in real-time
  %(prog)s --list-containers                  # Show available containers
  %(prog)s --show-filters                     # Show available filter patterns
        """
    )
    
    parser.add_argument('--container', '-c', 
                       choices=['backend', 'frontend', 'ollama', 'redis'],
                       default='backend',
                       help='Container to inspect (default: backend)')
    
    parser.add_argument('--filter', '-f', 
                       help='Filter logs by pattern (use --show-filters for options)')
    
    parser.add_argument('--tail', '-t', type=int, default=100,
                       help='Number of lines to show (default: 100)')
    
    parser.add_argument('--since', '-s', 
                       help='Show logs since time (e.g., 10m, 1h, 2023-01-01)')
    
    parser.add_argument('--live', '-l', action='store_true',
                       help='Follow logs in real-time')
    
    parser.add_argument('--case-sensitive', action='store_true',
                       help='Case-sensitive filtering')
    
    parser.add_argument('--no-format', action='store_true',
                       help='Disable color formatting')
    
    parser.add_argument('--list-containers', action='store_true',
                       help='List available containers')
    
    parser.add_argument('--show-filters', action='store_true',
                       help='Show available filter patterns')

    args = parser.parse_args()
    
    inspector = LogInspector()
    
    # Handle special commands
    if args.list_containers:
        inspector.list_containers()
        return
        
    if args.show_filters:
        inspector.show_filter_help()
        return
    
    # Get logs
    print(f"📋 Inspecting {args.container} container logs...")
    if args.since:
        print(f"⏰ Since: {args.since}")
    if args.filter:
        print(f"🔍 Filter: {args.filter}")
    print("-" * 60)
    
    logs = inspector.get_logs(
        container=args.container,
        tail=args.tail if not args.live else None,
        since=args.since,
        follow=args.live
    )
    
    if args.live:
        return  # Live mode handles output directly
    
    if not logs:
        print("📭 No logs found")
        return
    
    # Apply filtering
    if args.filter:
        logs = inspector.filter_logs(logs, args.filter, args.case_sensitive)
        if not logs:
            print(f"📭 No logs found matching filter: {args.filter}")
            return
    
    # Apply formatting
    if not args.no_format:
        logs = inspector.format_logs(logs)
    
    print(logs)
    
    # Show summary
    line_count = len([l for l in logs.split('\n') if l.strip()])
    print(f"\n📊 Summary: {line_count} log lines displayed")


if __name__ == '__main__':
    main()