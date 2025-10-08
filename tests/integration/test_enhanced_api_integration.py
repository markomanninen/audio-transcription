#!/usr/bin/env python3
"""
Enhanced Transcription System - API Integration Tests
Tests all API endpoints with detailed progress tracking.
"""

import requests
import json
import time
import tempfile
import os
import sys
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

class ProgressTracker:
    """Track API test progress with detailed reporting."""
    
    def __init__(self, total_tests: int):
        self.total_tests = total_tests
        self.current_test = 0
        self.passed = 0
        self.failed = 0
        self.start_time = datetime.now()
        
    def start_test(self, test_name: str, description: str = ""):
        """Start a new test with progress indication."""
        self.current_test += 1
        elapsed = (datetime.now() - self.start_time).total_seconds()
        progress = (self.current_test / self.total_tests) * 100
        
        print(f"\n{'='*70}")
        print(f"🧪 TEST {self.current_test}/{self.total_tests} ({progress:.1f}%) - {elapsed:.1f}s elapsed")
        print(f"📋 {test_name}")
        if description:
            print(f"💭 {description}")
        print(f"{'='*70}")
        
    def pass_test(self, details: str = ""):
        """Mark current test as passed."""
        self.passed += 1
        print(f"✅ PASSED: {details}")
        
    def fail_test(self, error: str = ""):
        """Mark current test as failed."""
        self.failed += 1
        print(f"❌ FAILED: {error}")
        
    def summary(self):
        """Print final test summary."""
        elapsed = (datetime.now() - self.start_time).total_seconds()
        
        print(f"\n{'='*70}")
        print(f"📊 API INTEGRATION TEST SUMMARY")
        print(f"{'='*70}")
        print(f"🏃 Total Tests: {self.total_tests}")
        print(f"✅ Passed: {self.passed}")
        print(f"❌ Failed: {self.failed}")
        print(f"⏱️  Total Time: {elapsed:.1f}s")
        
        if self.failed == 0:
            print(f"🎉 ALL API TESTS PASSED!")
            print(f"🔥 The enhanced API is working correctly!")
        else:
            print(f"💥 {self.failed} TESTS FAILED")
            print(f"🐛 Please review API implementation")
        
        success_rate = (self.passed / self.total_tests) * 100 if self.total_tests > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")

class APIIntegrationTest:
    """Enhanced API integration test suite with progress tracking."""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.test_file_id = None
        self.progress = ProgressTracker(12)  # Total number of API tests
        
    def make_request(self, method: str, endpoint: str, **kwargs):
        """Make API request with detailed logging."""
        url = f"{self.base_url}{endpoint}"
        print(f"🌐 {method.upper()} {endpoint}")
        
        try:
            response = self.session.request(method, url, **kwargs)
            
            # Log request details
            if kwargs.get('json'):
                print(f"📤 Request Body: {json.dumps(kwargs['json'], indent=2)}")
            if kwargs.get('params'):
                print(f"📤 Query Params: {kwargs['params']}")
                
            # Log response
            print(f"📥 Response: {response.status_code} - {len(response.content)} bytes")
            
            if response.headers.get('content-type', '').startswith('application/json'):
                try:
                    response_json = response.json()
                    print(f"📝 Response Body: {json.dumps(response_json, indent=2)[:500]}...")
                except:
                    print(f"📝 Response Body: {response.text[:200]}...")
            
            return response
            
        except Exception as e:
            print(f"💥 Request Error: {e}")
            raise
    
    def assert_response(self, response: requests.Response, expected_status: int = 200, 
                       message: str = ""):
        """Assert response status with detailed error reporting."""
        if response.status_code != expected_status:
            error_msg = f"Expected {expected_status}, got {response.status_code}"
            if message:
                error_msg = f"{message}: {error_msg}"
            
            try:
                error_body = response.json()
                error_msg += f" - {error_body}"
            except:
                error_msg += f" - {response.text[:200]}"
            
            raise AssertionError(error_msg)
    
    def create_test_audio_file(self) -> str:
        """Create minimal test audio file."""
        print("🎵 Creating test audio file...")
        
        temp_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        temp_file.close()
        
        # Create minimal WAV file
        with open(temp_file.name, 'wb') as f:
            # Basic WAV header for a short silent file
            f.write(b'RIFF')
            f.write((36).to_bytes(4, 'little'))  # File size - 8
            f.write(b'WAVE')
            f.write(b'fmt ')
            f.write((16).to_bytes(4, 'little'))  # Subchunk1 size
            f.write((1).to_bytes(2, 'little'))   # Audio format (PCM)
            f.write((1).to_bytes(2, 'little'))   # Number of channels
            f.write((16000).to_bytes(4, 'little'))  # Sample rate
            f.write((32000).to_bytes(4, 'little'))  # Byte rate
            f.write((2).to_bytes(2, 'little'))   # Block align
            f.write((16).to_bytes(2, 'little'))  # Bits per sample
            f.write(b'data')
            f.write((0).to_bytes(4, 'little'))   # Data size (silence)
        
        print(f"✅ Created test audio: {temp_file.name}")
        return temp_file.name
    
    def test_1_health_endpoint(self):
        """Test 1: Health check endpoint."""
        self.progress.start_test("Health Endpoint", "Basic health check")
        
        try:
            response = self.make_request('GET', '/health')
            self.assert_response(response, 200, "Health check")
            
            data = response.json()
            assert 'status' in data, "Health response should contain status"
            
            self.progress.pass_test(f"Health status: {data.get('status', 'unknown')}")
            
        except Exception as e:
            self.progress.fail_test(str(e))
            raise
    
    def test_2_upload_endpoint(self):
        """Test 2: File upload endpoint."""
        self.progress.start_test("Upload Endpoint", "File upload functionality")
        
        audio_file_path = None
        try:
            # Create test file
            audio_file_path = self.create_test_audio_file()
            
            # Upload file
            with open(audio_file_path, 'rb') as f:
                files = {'file': ('test_audio.wav', f, 'audio/wav')}
                data = {'project_id': 1}
                
                response = self.make_request('POST', '/api/upload/', files=files, data=data)
                self.assert_response(response, 200, "File upload")
                
                upload_data = response.json()
                assert 'id' in upload_data, "Upload response should contain file ID"
                
                self.test_file_id = upload_data['id']
                self.progress.pass_test(f"Uploaded file with ID: {self.test_file_id}")
                
        except Exception as e:
            self.progress.fail_test(str(e))
            raise
        finally:
            if audio_file_path and os.path.exists(audio_file_path):
                os.unlink(audio_file_path)
                print("🧹 Cleaned up test audio file")
    
    def test_3_status_endpoint(self):
        """Test 3: Enhanced status endpoint."""
        self.progress.start_test("Enhanced Status Endpoint", "Get detailed transcription status")
        
        try:
            response = self.make_request('GET', f'/api/transcription/{self.test_file_id}/status')
            self.assert_response(response, 200, "Status check")
            
            status_data = response.json()
            
            # Verify enhanced status fields
            required_fields = [
                'file_id', 'filename', 'status', 'progress', 'segments_created',
                'can_resume', 'is_stuck', 'transcription_stage', 'last_processed_segment',
                'audio_transformed', 'whisper_model_loaded', 'interruption_count',
                'recovery_attempts', 'checkpoint'
            ]
            
            missing_fields = [field for field in required_fields if field not in status_data]
            
            assert len(missing_fields) == 0, f"Missing required fields: {missing_fields}"
            assert status_data['file_id'] == self.test_file_id, "File ID should match"
            
            self.progress.pass_test(f"All {len(required_fields)} enhanced fields present")
            
        except Exception as e:
            self.progress.fail_test(str(e))
            raise
    
    def test_4_action_endpoint_auto(self):
        """Test 4: Action endpoint with auto action."""
        self.progress.start_test("Auto Action Endpoint", "Automatic action determination")
        
        try:
            response = self.make_request('POST', f'/api/transcription/{self.test_file_id}/action',
                                       params={'action': 'auto'})
            self.assert_response(response, 200, "Auto action")
            
            action_data = response.json()
            assert 'action' in action_data, "Action response should contain action type"
            assert 'message' in action_data, "Action response should contain message"
            
            self.progress.pass_test(f"Auto action: {action_data['action']} - {action_data['message']}")
            
        except Exception as e:
            self.progress.fail_test(str(e))
            raise
    
    def test_5_action_endpoint_start(self):
        """Test 5: Action endpoint with start action."""
        self.progress.start_test("Start Action Endpoint", "Start transcription")
        
        try:
            response = self.make_request('POST', f'/api/transcription/{self.test_file_id}/action',
                                       params={'action': 'start'})
            self.assert_response(response, 200, "Start action")
            
            action_data = response.json()
            assert action_data['action'] == 'start', "Action should be 'start'"
            
            self.progress.pass_test(f"Start action successful: {action_data['message']}")
            
        except Exception as e:
            self.progress.fail_test(str(e))
            raise
    
    def test_6_progress_monitoring(self):
        """Test 6: Progress monitoring during transcription."""
        self.progress.start_test("Progress Monitoring", "Monitor transcription progress")
        
        try:
            # Monitor progress for up to 60 seconds
            max_wait = 60
            start_time = time.time()
            last_progress = -1
            
            while time.time() - start_time < max_wait:
                response = self.make_request('GET', f'/api/transcription/{self.test_file_id}/status')
                self.assert_response(response, 200, "Progress check")
                
                status_data = response.json()
                current_progress = status_data.get('progress', 0) * 100
                current_status = status_data.get('status', 'unknown')
                current_stage = status_data.get('transcription_stage', 'unknown')
                
                if current_progress != last_progress:
                    elapsed = time.time() - start_time
                    print(f"⏱️  {elapsed:.1f}s | 📈 {current_progress:.1f}% | 🔄 {current_status} | 📝 {current_stage}")
                    last_progress = current_progress
                
                if current_status in ['completed', 'failed']:
                    break
                    
                time.sleep(3)
            
            # Final status check
            response = self.make_request('GET', f'/api/transcription/{self.test_file_id}/status')
            final_status = response.json()
            
            self.progress.pass_test(f"Final status: {final_status['status']} ({final_status.get('progress', 0)*100:.1f}%)")
            
        except Exception as e:
            self.progress.fail_test(str(e))
            raise
    
    def test_7_action_endpoint_resume(self):
        """Test 7: Action endpoint with resume action."""
        self.progress.start_test("Resume Action Endpoint", "Resume transcription")
        
        try:
            response = self.make_request('POST', f'/api/transcription/{self.test_file_id}/action',
                                       params={'action': 'resume'})
            self.assert_response(response, 200, "Resume action")
            
            action_data = response.json()
            assert action_data['action'] == 'resume', "Action should be 'resume'"
            
            self.progress.pass_test(f"Resume action: {action_data['message']}")
            
        except Exception as e:
            self.progress.fail_test(str(e))
            raise
    
    def test_8_force_restart_endpoint(self):
        """Test 8: Force restart endpoint."""
        self.progress.start_test("Force Restart Endpoint", "Force restart transcription")
        
        try:
            response = self.make_request('POST', f'/api/transcription/{self.test_file_id}/force-restart')
            self.assert_response(response, 200, "Force restart")
            
            restart_data = response.json()
            
            # Verify restart response
            expected_fields = ['deleted_segments', 'message', 'new_status']
            for field in expected_fields:
                assert field in restart_data, f"Restart response should contain {field}"
            
            deleted_count = restart_data.get('deleted_segments', 0)
            self.progress.pass_test(f"Restart successful: deleted {deleted_count} segments")
            
        except Exception as e:
            self.progress.fail_test(str(e))
            raise
    
    def test_9_segments_endpoint(self):
        """Test 9: Segments endpoint."""
        self.progress.start_test("Segments Endpoint", "Get transcription segments")
        
        try:
            response = self.make_request('GET', f'/api/transcription/{self.test_file_id}/segments')
            self.assert_response(response, 200, "Get segments")
            
            segments_data = response.json()
            
            # Verify segments structure
            assert isinstance(segments_data, list), "Segments should be a list"
            
            # If there are segments, verify their structure
            if segments_data:
                segment = segments_data[0]
                required_segment_fields = ['id', 'start_time', 'end_time', 'text']
                missing_segment_fields = [field for field in required_segment_fields if field not in segment]
                
                assert len(missing_segment_fields) == 0, f"Segment missing fields: {missing_segment_fields}"
            
            self.progress.pass_test(f"Retrieved {len(segments_data)} segments")
            
        except Exception as e:
            self.progress.fail_test(str(e))
            raise
    
    def test_10_download_endpoint(self):
        """Test 10: Download endpoint."""
        self.progress.start_test("Download Endpoint", "Download transcription")
        
        try:
            response = self.make_request('GET', f'/api/transcription/{self.test_file_id}/download',
                                       params={'format': 'json'})
            self.assert_response(response, 200, "Download transcription")
            
            # Verify download response
            content_type = response.headers.get('content-type', '')
            
            if 'application/json' in content_type:
                download_data = response.json()
                assert 'transcription' in download_data or 'segments' in download_data, \
                    "Download should contain transcription data"
            
            self.progress.pass_test(f"Download successful ({len(response.content)} bytes)")
            
        except Exception as e:
            self.progress.fail_test(str(e))
            raise
    
    def test_11_error_handling(self):
        """Test 11: Error handling with invalid requests."""
        self.progress.start_test("Error Handling", "Test API error responses")
        
        try:
            # Test 1: Invalid file ID
            response = self.make_request('GET', '/api/transcription/99999/status')
            assert response.status_code == 404, "Should return 404 for invalid file ID"
            
            # Test 2: Invalid action
            response = self.make_request('POST', f'/api/transcription/{self.test_file_id}/action',
                                       params={'action': 'invalid_action'})
            assert response.status_code == 400, "Should return 400 for invalid action"
            
            # Test 3: Upload without file
            response = self.make_request('POST', '/api/upload/', data={'project_id': 1})
            assert response.status_code == 400, "Should return 400 for upload without file"
            
            self.progress.pass_test("All error scenarios handled correctly")
            
        except Exception as e:
            self.progress.fail_test(str(e))
            raise
    
    def test_12_api_consistency(self):
        """Test 12: API response consistency."""
        self.progress.start_test("API Consistency", "Verify consistent API responses")
        
        try:
            # Multiple status requests should be consistent
            responses = []
            for i in range(3):
                response = self.make_request('GET', f'/api/transcription/{self.test_file_id}/status')
                self.assert_response(response, 200, f"Consistency check {i+1}")
                responses.append(response.json())
                time.sleep(1)
            
            # Verify file_id consistency
            file_ids = [r['file_id'] for r in responses]
            assert all(fid == self.test_file_id for fid in file_ids), \
                "File ID should be consistent across requests"
            
            # Verify status field presence
            for i, response_data in enumerate(responses):
                required_fields = ['file_id', 'filename', 'status', 'progress']
                missing = [f for f in required_fields if f not in response_data]
                assert len(missing) == 0, f"Response {i+1} missing fields: {missing}"
            
            self.progress.pass_test("API responses are consistent")
            
        except Exception as e:
            self.progress.fail_test(str(e))
            raise
    
    def run_all_tests(self):
        """Run all API integration tests."""
        print("🚀 ENHANCED TRANSCRIPTION API INTEGRATION TESTS")
        print("="*80)
        print(f"🕐 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"🌐 Backend URL: {self.base_url}")
        print("="*80)
        
        test_methods = [
            self.test_1_health_endpoint,
            self.test_2_upload_endpoint,
            self.test_3_status_endpoint,
            self.test_4_action_endpoint_auto,
            self.test_5_action_endpoint_start,
            self.test_6_progress_monitoring,
            self.test_7_action_endpoint_resume,
            self.test_8_force_restart_endpoint,
            self.test_9_segments_endpoint,
            self.test_10_download_endpoint,
            self.test_11_error_handling,
            self.test_12_api_consistency
        ]
        
        try:
            for test_method in test_methods:
                test_method()
                time.sleep(0.5)  # Brief pause between tests
                
        except Exception as e:
            print(f"\n💥 Test suite failed with error: {e}")
        
        self.progress.summary()
        return self.progress.failed == 0

def main():
    """Main test runner."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Enhanced Transcription API Integration Tests")
    parser.add_argument("--url", default="http://localhost:8000", help="Backend URL")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose logging")
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Run tests
    test_suite = APIIntegrationTest(args.url)
    success = test_suite.run_all_tests()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()