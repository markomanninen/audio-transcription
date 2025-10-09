#!/usr/bin/env python3
"""
Debug script to test Whisper model loading without the full application context.
This will help isolate the memory loading issue.
"""
import os
import sys
import traceback
import psutil
import time

def get_memory_usage():
    """Get current memory usage in MB"""
    process = psutil.Process()
    return process.memory_info().rss / 1024 / 1024

def test_whisper_loading():
    """Test Whisper model loading with detailed diagnostics"""
    print("🔍 DEBUG: Testing Whisper model loading...")
    print(f"🔍 Initial memory usage: {get_memory_usage():.1f}MB")
    
    # Test 1: Check if whisper is importable
    print("\n📦 Testing whisper import...")
    try:
        import whisper
        print("✅ Whisper imported successfully")
    except Exception as e:
        print(f"❌ Failed to import whisper: {e}")
        return False
    
    # Test 2: Check model cache
    print("\n📁 Checking model cache...")
    cache_dir = os.path.expanduser("~/.cache/whisper")
    print(f"Cache directory: {cache_dir}")
    
    if os.path.exists(cache_dir):
        files = os.listdir(cache_dir)
        print(f"Cache files: {files}")
        for file in files:
            if file.endswith('.pt'):
                file_path = os.path.join(cache_dir, file)
                size_mb = os.path.getsize(file_path) / (1024 * 1024)
                print(f"  {file}: {size_mb:.1f}MB")
    else:
        print("❌ Cache directory not found")
    
    # Test 3: Try loading smallest model first
    print("\n🧪 Testing tiny model loading...")
    try:
        print(f"Memory before tiny: {get_memory_usage():.1f}MB")
        tiny_model = whisper.load_model("tiny", device="cpu")
        print(f"✅ Tiny model loaded successfully")
        print(f"Memory after tiny: {get_memory_usage():.1f}MB")
        del tiny_model
        print(f"Memory after deletion: {get_memory_usage():.1f}MB")
    except Exception as e:
        print(f"❌ Failed to load tiny model: {e}")
        traceback.print_exc()
        return False
    
    # Test 4: Try loading base model
    print("\n🧪 Testing base model loading...")
    try:
        print(f"Memory before base: {get_memory_usage():.1f}MB")
        base_model = whisper.load_model("base", device="cpu")
        print(f"✅ Base model loaded successfully")
        print(f"Memory after base: {get_memory_usage():.1f}MB")
        
        # Test inference to make sure model works
        print("🎯 Testing model inference...")
        # Create a dummy audio array (1 second of silence)
        import numpy as np
        dummy_audio = np.zeros(16000, dtype=np.float32)
        result = base_model.transcribe(dummy_audio)
        print(f"✅ Inference test: '{result['text'].strip()}'")
        
        del base_model
        print(f"Memory after deletion: {get_memory_usage():.1f}MB")
    except Exception as e:
        print(f"❌ Failed to load base model: {e}")
        traceback.print_exc()
        return False
    
    print("\n✅ All tests passed!")
    return True

def test_docker_memory_limits():
    """Check Docker memory constraints"""
    print("\n🐳 Checking Docker memory limits...")
    
    # Check available memory
    memory = psutil.virtual_memory()
    print(f"Total memory: {memory.total / (1024**3):.1f}GB")
    print(f"Available memory: {memory.available / (1024**3):.1f}GB")
    print(f"Memory usage: {memory.percent}%")
    
    # Check if we're in a container
    if os.path.exists('/.dockerenv'):
        print("✅ Running in Docker container")
        
        # Try to read cgroup memory limit
        try:
            with open('/sys/fs/cgroup/memory/memory.limit_in_bytes', 'r') as f:
                limit = int(f.read().strip())
                if limit < memory.total:
                    print(f"🚨 Docker memory limit: {limit / (1024**3):.1f}GB")
                else:
                    print("✅ No Docker memory limit detected")
        except:
            print("⚠️  Could not read Docker memory limit")
    else:
        print("ℹ️  Not running in Docker")

if __name__ == "__main__":
    print("🚀 Starting Whisper debugging session...")
    print(f"Python version: {sys.version}")
    print(f"Platform: {sys.platform}")
    
    test_docker_memory_limits()
    
    success = test_whisper_loading()
    
    if success:
        print("\n🎉 Debug complete - Whisper loading appears to work!")
    else:
        print("\n💥 Debug failed - Found the issue!")
    
    print(f"Final memory usage: {get_memory_usage():.1f}MB")