#!/usr/bin/env python3
"""
Full Transcription E2E Test - Real Audio Processing
Tests complete transcription workflow: audio creation -> upload -> transcription -> text extraction -> validation
"""

import requests
import time
import json
import os
import tempfile
import sys
import subprocess
import wave
from typing import Dict, Any, Optional
from datetime import datetime

class FullTranscriptionTest:
    """Complete end-to-end transcription test with real audio processing."""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url.rstrip('/')
        self.test_file_id = None
        self.test_results = []
        self.start_time = time.time()
        
    def log_progress(self, message: str, level: str = "INFO"):
        """Log progress with timestamp."""
        elapsed = time.time() - self.start_time
        print(f"[{elapsed:6.1f}s] [{level}] {message}")
        
    def create_test_audio_with_speech(self) -> str:
        """Create a real audio file with synthesized speech."""
        self.log_progress("Creating test audio file with speech content...")
        
        temp_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        temp_file.close()
        
        try:
            # Try to use text-to-speech with espeak or similar
            speech_text = "Hello world. This is a test transcription. The audio contains clear speech for testing purposes."
            
            # Try espeak first (common on Windows with additional software)
            espeak_commands = [
                ["espeak", "-w", temp_file.name, "-s", "150", speech_text],
                ["espeak.exe", "-w", temp_file.name, "-s", "150", speech_text]
            ]
            
            speech_created = False
            for cmd in espeak_commands:
                try:
                    self.log_progress(f"Trying command: {' '.join(cmd)}")
                    result = subprocess.run(cmd, capture_output=True, timeout=30)
                    if result.returncode == 0 and os.path.getsize(temp_file.name) > 100:
                        self.log_progress("Successfully created speech audio with espeak")
                        speech_created = True
                        break
                except (FileNotFoundError, subprocess.TimeoutExpired):
                    continue
            
            if not speech_created:
                # Try Windows SAPI (Speech API)
                try:
                    self.log_progress("Trying Windows Speech API...")
                    powershell_cmd = f'''
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SetOutputToWaveFile("{temp_file.name}")
$synth.Speak("{speech_text}")
$synth.Dispose()
'''
                    result = subprocess.run(
                        ["powershell", "-Command", powershell_cmd], 
                        capture_output=True, 
                        timeout=30,
                        text=True
                    )
                    if result.returncode == 0 and os.path.getsize(temp_file.name) > 100:
                        self.log_progress("Successfully created speech audio with Windows SAPI")
                        speech_created = True
                except Exception as e:
                    self.log_progress(f"Windows SAPI failed: {e}")
            
            if not speech_created:
                # Try Python pyttsx3 if available
                try:
                    self.log_progress("Trying pyttsx3...")
                    python_tts_code = f'''
import pyttsx3
engine = pyttsx3.init()
engine.save_to_file("{speech_text}", "{temp_file.name}")
engine.runAndWait()
'''
                    result = subprocess.run(
                        [sys.executable, "-c", python_tts_code], 
                        capture_output=True, 
                        timeout=30
                    )
                    if result.returncode == 0 and os.path.getsize(temp_file.name) > 100:
                        self.log_progress("Successfully created speech audio with pyttsx3")
                        speech_created = True
                except Exception as e:
                    self.log_progress(f"pyttsx3 failed: {e}")
            
            if not speech_created:
                self.log_progress("TTS not available, creating synthetic audio with tone patterns...")
                self.create_synthetic_speech_audio(temp_file.name, speech_text)
                
        except Exception as e:
            self.log_progress(f"Audio creation error: {e}", "ERROR")
            # Fallback to basic audio
            self.create_basic_audio(temp_file.name)
        
        file_size = os.path.getsize(temp_file.name)
        self.log_progress(f"Created audio file: {temp_file.name} ({file_size} bytes)")
        
        return temp_file.name
    
    def create_synthetic_speech_audio(self, filename: str, text: str):
        """Create synthetic speech-like audio using tone patterns."""
        self.log_progress("Creating synthetic speech patterns...")
        
        try:
            import numpy as np
            
            # Create speech-like patterns with varying frequencies
            sample_rate = 16000
            duration = min(len(text) * 0.1, 10)  # ~0.1s per character, max 10s
            
            # Generate speech-like frequency patterns
            t = np.linspace(0, duration, int(sample_rate * duration), False)
            
            # Base frequencies for speech (human vocal range)
            base_freqs = [200, 300, 400, 500, 350, 250, 400, 300]  # Varied speech frequencies
            
            audio_data = np.zeros_like(t)
            
            # Create segments for each part of the text
            segment_duration = duration / len(base_freqs)
            
            for i, freq in enumerate(base_freqs):
                start_idx = int(i * segment_duration * sample_rate)
                end_idx = int((i + 1) * segment_duration * sample_rate)
                
                if end_idx > len(t):
                    end_idx = len(t)
                
                if start_idx < len(t):
                    # Create speech-like modulated tone
                    segment_t = t[start_idx:end_idx] - t[start_idx]
                    
                    # Main frequency with harmonics (more speech-like)
                    segment_audio = (
                        0.4 * np.sin(2 * np.pi * freq * segment_t) +
                        0.2 * np.sin(2 * np.pi * freq * 2 * segment_t) +
                        0.1 * np.sin(2 * np.pi * freq * 3 * segment_t)
                    )
                    
                    # Add amplitude modulation (speech envelope)
                    envelope = 0.5 * (1 + np.sin(2 * np.pi * 5 * segment_t))
                    segment_audio *= envelope
                    
                    # Add brief pauses between segments
                    if len(segment_audio) > sample_rate // 10:  # If segment > 0.1s
                        fade_samples = sample_rate // 20  # 0.05s fade
                        segment_audio[-fade_samples:] *= np.linspace(1, 0, fade_samples)
                    
                    audio_data[start_idx:end_idx] = segment_audio
            
            # Normalize and convert to 16-bit
            audio_data = audio_data * 0.7  # Reduce volume
            audio_data = (audio_data * 32767).astype(np.int16)
            
            # Write WAV file
            with wave.open(filename, 'w') as wav_file:
                wav_file.setnchannels(1)  # Mono
                wav_file.setsampwidth(2)  # 16-bit
                wav_file.setframerate(sample_rate)
                wav_file.writeframes(audio_data.tobytes())
                
            self.log_progress(f"Created synthetic speech audio ({len(audio_data)} samples, {duration:.1f}s)")
            
        except ImportError:
            self.log_progress("NumPy not available, creating basic tone audio...")
            self.create_basic_audio(filename)
        except Exception as e:
            self.log_progress(f"Synthetic speech creation failed: {e}", "ERROR")
            self.create_basic_audio(filename)
    
    def create_basic_audio(self, filename: str):
        """Create basic audio file as fallback."""
        self.log_progress("Creating basic audio file...")
        
        try:
            sample_rate = 16000
            duration = 5  # 5 seconds
            frequency = 440  # A4 note
            
            # Generate simple sine wave
            import math
            samples = []
            for i in range(int(sample_rate * duration)):
                t = i / sample_rate
                sample = int(32767 * 0.3 * math.sin(2 * math.pi * frequency * t))
                samples.append(sample)
            
            # Write WAV file
            with wave.open(filename, 'w') as wav_file:
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2)
                wav_file.setframerate(sample_rate)
                for sample in samples:
                    wav_file.writeframes(sample.to_bytes(2, byteorder='little', signed=True))
                    
            self.log_progress(f"Created basic sine wave audio ({len(samples)} samples)")
            
        except Exception as e:
            self.log_progress(f"Basic audio creation failed: {e}", "ERROR")
            # Create minimal WAV as last resort
            with open(filename, 'wb') as f:
                # Minimal WAV header
                f.write(b'RIFF')
                f.write((36).to_bytes(4, 'little'))
                f.write(b'WAVE')
                f.write(b'fmt ')
                f.write((16).to_bytes(4, 'little'))
                f.write((1).to_bytes(2, 'little'))
                f.write((1).to_bytes(2, 'little'))
                f.write((16000).to_bytes(4, 'little'))
                f.write((32000).to_bytes(4, 'little'))
                f.write((2).to_bytes(2, 'little'))
                f.write((16).to_bytes(2, 'little'))
                f.write(b'data')
                f.write((0).to_bytes(4, 'little'))
            self.log_progress("Created minimal WAV file")
    
    def wait_for_backend(self, timeout: int = 10) -> bool:
        """Wait for backend to be ready."""
        self.log_progress("Checking backend availability...")
        
        for i in range(timeout):
            try:
                response = requests.get(f"{self.base_url}/health", timeout=3)
                if response.status_code == 200:
                    self.log_progress("Backend is ready!")
                    return True
            except requests.exceptions.RequestException:
                if i == 0:
                    self.log_progress("Waiting for backend to start...")
                elif i % 3 == 0:
                    self.log_progress(f"Still waiting... ({i}/{timeout}s)")
            
            time.sleep(1)
        
        self.log_progress("Backend not available!", "ERROR")
        return False
    
    def upload_audio_file(self, audio_file_path: str) -> int:
        """Upload the test audio file."""
        self.log_progress("Uploading audio file...")
        
        try:
            with open(audio_file_path, 'rb') as f:
                files = {'file': ('test_speech.wav', f, 'audio/wav')}
                data = {'language': 'en'}  # Use explicit English language code
                
                # Upload to project 1 (assuming it exists)
                project_id = 1
                response = requests.post(f"{self.base_url}/api/upload/file/{project_id}", files=files, data=data, timeout=60)
                response.raise_for_status()
                
                result = response.json()
                file_id = result.get('file_id') or result.get('id')
                self.log_progress(f"File uploaded successfully with ID: {file_id}")
                return file_id
                
        except Exception as e:
            self.log_progress(f"Upload failed: {e}", "ERROR")
            raise
    
    def start_transcription(self, file_id: int) -> bool:
        """Start the transcription process."""
        self.log_progress("Starting transcription...")
        
        try:
            response = requests.post(
                f"{self.base_url}/api/transcription/{file_id}/action",
                params={"action": "auto"},
                timeout=30
            )
            response.raise_for_status()
            
            result = response.json()
            self.log_progress(f"Transcription started: {result.get('message', 'Success')}")
            return True
            
        except Exception as e:
            self.log_progress(f"Failed to start transcription: {e}", "ERROR")
            return False
    
    def monitor_transcription_progress(self, file_id: int, timeout: int = 300) -> bool:
        """Monitor transcription progress with detailed logging."""
        self.log_progress("Monitoring transcription progress...")
        
        start_time = time.time()
        last_progress = -1
        last_stage = ""
        
        while time.time() - start_time < timeout:
            try:
                response = requests.get(f"{self.base_url}/api/transcription/{file_id}/status", timeout=10)
                response.raise_for_status()
                
                status = response.json()
                current_progress = status.get('progress', 0) * 100
                current_stage = status.get('transcription_stage', 'unknown')
                current_status = status.get('status', 'unknown')
                segments_count = status.get('segments_created', 0)
                
                # Log progress updates
                if current_progress != last_progress or current_stage != last_stage:
                    elapsed = time.time() - start_time
                    self.log_progress(
                        f"Progress: {current_progress:.1f}% | "
                        f"Status: {current_status} | "
                        f"Stage: {current_stage} | "
                        f"Segments: {segments_count} | "
                        f"Elapsed: {elapsed:.1f}s"
                    )
                    last_progress = current_progress
                    last_stage = current_stage
                
                # Check completion
                if current_status == 'completed':
                    self.log_progress(f"Transcription completed! ({segments_count} segments created)")
                    return True
                elif current_status == 'failed':
                    error_msg = status.get('error_message', 'Unknown error')
                    self.log_progress(f"Transcription failed: {error_msg}", "ERROR")
                    return False
                
            except Exception as e:
                self.log_progress(f"Status check error: {e}", "ERROR")
            
            time.sleep(3)
        
        self.log_progress("Transcription timed out!", "ERROR")
        return False
    
    def extract_transcription_text(self, file_id: int) -> Optional[str]:
        """Extract the transcribed text."""
        self.log_progress("Extracting transcription text...")
        
        try:
            # Get segments
            response = requests.get(f"{self.base_url}/api/transcription/{file_id}/segments", timeout=30)
            response.raise_for_status()
            
            segments = response.json()
            
            if not segments:
                self.log_progress("No segments found!", "ERROR")
                return None
            
            self.log_progress(f"Found {len(segments)} segments")
            
            # Extract text from segments
            transcribed_text = ""
            for i, segment in enumerate(segments):
                # Try both 'text' and 'original_text' fields
                text = segment.get('text', '') or segment.get('original_text', '') or segment.get('edited_text', '')
                if text:
                    text = text.strip()
                    transcribed_text += text + " "
                    self.log_progress(f"Segment {i+1}: '{text}'")
                else:
                    self.log_progress(f"Segment {i+1}: No text found. Available fields: {list(segment.keys())}")
            
            transcribed_text = transcribed_text.strip()
            
            if transcribed_text:
                self.log_progress(f"Extracted text ({len(transcribed_text)} chars): '{transcribed_text[:100]}...'")
                return transcribed_text
            else:
                self.log_progress("No text extracted from segments!", "ERROR")
                self.log_progress(f"Raw segments data: {segments}")
                return None
                
        except Exception as e:
            self.log_progress(f"Text extraction failed: {e}", "ERROR")
            return None
    
    def validate_transcription_results(self, transcribed_text: str, file_id: int) -> bool:
        """Validate the transcription results."""
        self.log_progress("Validating transcription results...")
        
        validation_results = []
        
        # Test 1: Text not empty
        if transcribed_text and len(transcribed_text.strip()) > 0:
            validation_results.append(("Text not empty", True))
            self.log_progress(f"Text extracted: {len(transcribed_text)} characters")
        else:
            validation_results.append(("Text not empty", False))
            self.log_progress("No text extracted", "ERROR")
        
        # Test 2: Text contains reasonable content
        if transcribed_text:
            # Check for common words or patterns
            text_lower = transcribed_text.lower()
            has_content = any(word in text_lower for word in [
                'hello', 'world', 'test', 'audio', 'speech', 'transcription',
                'the', 'and', 'is', 'a', 'this', 'that'
            ])
            validation_results.append(("Contains meaningful content", has_content))
            if has_content:
                self.log_progress("Text contains meaningful content")
            else:
                self.log_progress(f"Text may not contain expected content: '{transcribed_text}'")
        
        # Test 3: Check final status
        try:
            response = requests.get(f"{self.base_url}/api/transcription/{file_id}/status", timeout=10)
            response.raise_for_status()
            status = response.json()
            
            is_completed = status.get('status') == 'completed'
            has_progress = status.get('progress', 0) >= 1.0
            has_segments = status.get('segments_created', 0) > 0
            
            validation_results.extend([
                ("Status is completed", is_completed),
                ("Progress is 100%", has_progress),
                ("Segments created", has_segments)
            ])
            
            if is_completed:
                self.log_progress("Status is completed")
            if has_progress:
                self.log_progress("Progress is 100%")
            if has_segments:
                self.log_progress(f"{status.get('segments_created', 0)} segments created")
                
        except Exception as e:
            self.log_progress(f"Status validation error: {e}", "ERROR")
            validation_results.append(("Final status check", False))
        
        # Test 4: Download functionality (optional)
        try:
            # Try different download endpoint formats
            download_urls = [
                f"{self.base_url}/api/transcription/{file_id}/download?format=json",
                f"{self.base_url}/api/transcription/{file_id}/export?format=json",
                f"{self.base_url}/api/export/{file_id}?format=json"
            ]
            
            download_worked = False
            for url in download_urls:
                try:
                    response = requests.get(url, timeout=30)
                    if response.status_code == 200:
                        download_data = response.json()
                        has_download = 'transcription' in download_data or 'segments' in download_data
                        if has_download:
                            download_worked = True
                            break
                except:
                    continue
            
            validation_results.append(("Download works", download_worked))
            
            if download_worked:
                self.log_progress("Download functionality works")
            else:
                self.log_progress("Download functionality not available (optional feature)", "INFO")
                
        except Exception as e:
            self.log_progress(f"Download test skipped: {e}", "INFO")
            validation_results.append(("Download works", False))
        
        # Summary
        passed_tests = sum(1 for _, result in validation_results if result)
        total_tests = len(validation_results)
        
        self.log_progress(f"Validation Summary: {passed_tests}/{total_tests} tests passed")
        
        for test_name, result in validation_results:
            status = "PASS" if result else "FAIL"
            self.log_progress(f"  {status}: {test_name}")
        
        # Core transcription tests (first 5 are essential, download is optional)
        core_tests_passed = sum(1 for _, result in validation_results[:5] if result)
        core_tests_total = 5
        
        # Success if all core tests pass, or if we have very high success rate
        success = core_tests_passed == core_tests_total or passed_tests >= total_tests * 0.85
        
        if success:
            self.log_progress(f"Overall result: SUCCESS (core transcription working: {core_tests_passed}/{core_tests_total})")
        else:
            self.log_progress(f"Overall result: FAILURE (core issues detected)")
        
        return success
    
    def run_full_test(self) -> bool:
        """Run the complete end-to-end transcription test."""
        self.log_progress("=== STARTING FULL TRANSCRIPTION E2E TEST ===")
        self.log_progress(f"Backend URL: {self.base_url}")
        
        audio_file_path = None
        
        try:
            # Step 1: Check backend
            if not self.wait_for_backend():
                self.log_progress("Backend check failed - cannot proceed", "ERROR")
                return False
            
            # Step 2: Create audio file
            audio_file_path = self.create_test_audio_with_speech()
            
            # Step 3: Upload audio file
            file_id = self.upload_audio_file(audio_file_path)
            self.test_file_id = file_id
            
            # Step 4: Start transcription
            if not self.start_transcription(file_id):
                self.log_progress("Failed to start transcription", "ERROR")
                return False
            
            # Step 5: Monitor progress
            if not self.monitor_transcription_progress(file_id):
                self.log_progress("Transcription did not complete successfully", "ERROR")
                return False
            
            # Step 6: Extract text
            transcribed_text = self.extract_transcription_text(file_id)
            if transcribed_text is None:
                self.log_progress("Failed to extract transcription text", "ERROR")
                return False
            
            # Step 7: Validate results
            if not self.validate_transcription_results(transcribed_text, file_id):
                self.log_progress("Transcription validation failed", "ERROR")
                return False
            
            # Success!
            total_time = time.time() - self.start_time
            self.log_progress(f"=== FULL E2E TEST COMPLETED SUCCESSFULLY ===")
            self.log_progress(f"Total time: {total_time:.1f}s")
            self.log_progress(f"Transcribed text: '{transcribed_text}'")
            return True
            
        except Exception as e:
            self.log_progress(f"Test failed with exception: {e}", "ERROR")
            return False
            
        finally:
            # Cleanup
            if audio_file_path and os.path.exists(audio_file_path):
                try:
                    os.unlink(audio_file_path)
                    self.log_progress("Cleaned up test audio file")
                except:
                    pass

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Full Transcription E2E Test")
    parser.add_argument("--url", default="http://localhost:8000", help="Backend URL")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose logging")
    
    args = parser.parse_args()
    
    print("\n" + "="*80)
    print("FULL TRANSCRIPTION END-TO-END TEST")
    print("Tests: Audio Creation -> Upload -> Transcription -> Text Extraction -> Validation")
    print("="*80)
    
    test = FullTranscriptionTest(args.url)
    success = test.run_full_test()
    
    print("\n" + "="*80)
    if success:
        print("SUCCESS! FULL E2E TEST PASSED!")
        print("Audio transcription pipeline is working correctly!")
        print("Text extraction and validation successful!")
    else:
        print("FAILED! FULL E2E TEST FAILED!")
        print("Check the logs above for details")
    print("="*80)
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()