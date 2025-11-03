#!/usr/bin/env python3
"""
Test runner for project export/import integration tests.
Runs in the proper environment with correct Python paths.
"""
import os
import sys
import subprocess
from pathlib import Path

def run_e2e_test():
    """Run the end-to-end test from the backend directory context."""
    # Get paths
    script_dir = Path(__file__).parent
    root_dir = script_dir.parent.parent
    backend_dir = root_dir / "backend"
    test_file = script_dir / "test_project_export_import_e2e.py"
    
    if not test_file.exists():
        print(f"❌ Test file not found: {test_file}")
        return False
    
    if not backend_dir.exists():
        print(f"❌ Backend directory not found: {backend_dir}")
        return False
    
    print("🧪 Running Project Export/Import E2E Test")
    print(f"📁 Working directory: {backend_dir}")
    print(f"🐍 Test script: {test_file}")
    
    try:
        # Run the test from backend directory with proper environment
        result = subprocess.run([
            sys.executable, str(test_file)
        ], 
        cwd=str(backend_dir),
        env={**os.environ, 'PYTHONPATH': str(backend_dir)},
        capture_output=False,
        text=True
        )
        
        return result.returncode == 0
        
    except Exception as e:
        print(f"❌ Failed to run test: {e}")
        return False

if __name__ == "__main__":
    success = run_e2e_test()
    sys.exit(0 if success else 1)