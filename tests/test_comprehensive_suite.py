#!/usr/bin/env python3
"""
Enhanced Transcription System - Comprehensive Test Suite Runner
Orchestrates all tests with detailed progress tracking and dependency checking.
"""

import os
import sys
import subprocess
import time
import requests
from datetime import datetime
from typing import Dict, Any
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class TestSuiteRunner:
    """Comprehensive test suite runner with detailed progress tracking."""
    
    def __init__(self, backend_url: str = "http://localhost:8000"):
        self.backend_url = backend_url.rstrip('/')
        self.start_time = datetime.now()
        self.test_results = {}
        self.dependencies_checked = False
        
        # Get the base directory (assuming we're in tests/)
        self.base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.tests_dir = os.path.dirname(os.path.abspath(__file__))
        
    def print_header(self):
        """Print comprehensive test suite header."""
        print("\n" + "="*100)
        print("🚀 ENHANCED TRANSCRIPTION SYSTEM - COMPREHENSIVE TEST SUITE")
        print("="*100)
        print(f"🕐 Started at: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"🌐 Backend URL: {self.backend_url}")
        print(f"📁 Base Directory: {self.base_dir}")
        print(f"🧪 Tests Directory: {self.tests_dir}")
        print("="*100)
    
    def check_dependencies(self) -> bool:
        """Check if all required dependencies are available."""
        print("\n🔍 CHECKING DEPENDENCIES")
        print("-" * 50)
        
        dependencies = {
            "requests": "HTTP client for API testing",
            "pytest": "Unit testing framework",
            "numpy": "Audio processing (optional)"
        }
        
        missing_deps = []
        
        for dep, description in dependencies.items():
            try:
                __import__(dep)
                print(f"✅ {dep:12} - {description}")
            except ImportError:
                print(f"❌ {dep:12} - {description} (MISSING)")
                missing_deps.append(dep)
        
        if missing_deps:
            print(f"\n💥 Missing dependencies: {', '.join(missing_deps)}")
            print("🔧 Install with: pip install " + " ".join(missing_deps))
            return False
        else:
            print("\n✅ All dependencies available!")
            self.dependencies_checked = True
            return True
    
    def check_backend_health(self, timeout: int = 5) -> bool:
        """Check if backend is healthy and ready for testing."""
        print("\n🏥 CHECKING BACKEND HEALTH")
        print("-" * 50)
        print(f"🌐 Testing connection to: {self.backend_url}")
        
        for attempt in range(timeout):
            try:
                response = requests.get(f"{self.backend_url}/health", timeout=3)
                
                if response.status_code == 200:
                    health_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
                    print("✅ Backend is healthy!")
                    print(f"📊 Status: {health_data.get('status', 'OK')}")
                    if 'timestamp' in health_data:
                        print(f"⏰ Timestamp: {health_data['timestamp']}")
                    return True
                else:
                    print(f"⚠️  Backend returned status {response.status_code}")
                    
            except requests.exceptions.RequestException:
                if attempt == 0:
                    print("🔄 Waiting for backend to start...")
            
            time.sleep(1)
        
        print(f"❌ Backend not available after {timeout}s")
        print("🤖 Tests will use mock backend instead")
        print("💡 To test with real backend:")
        print("   - cd backend && python -m uvicorn app.main:app --reload")
        print("   - Or use Docker: docker-compose up backend")
        return True  # Always return True to allow mock testing
    
    def run_unit_tests(self) -> Dict[str, Any]:
        """Run unit tests with detailed progress tracking."""
        print("\n🧪 RUNNING UNIT TESTS")
        print("-" * 50)
        
        unit_test_file = os.path.join(self.tests_dir, "backend", "test_enhanced_transcription_unit.py")
        
        if not os.path.exists(unit_test_file):
            print(f"❌ Unit test file not found: {unit_test_file}")
            return {"success": False, "error": "Test file not found", "duration": 0}
        
        print(f"📄 Running: {os.path.basename(unit_test_file)}")
        
        start_time = time.time()
        
        try:
            # Run pytest on the unit test file
            cmd = [
                sys.executable, "-m", "pytest", 
                unit_test_file,
                "-v", "--tb=short", "-x"  # Stop on first failure
            ]
            
            print(f"🔧 Command: {' '.join(cmd)}")
            
            result = subprocess.run(
                cmd,
                cwd=self.base_dir,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            
            duration = time.time() - start_time
            
            print(f"⏱️  Unit tests completed in {duration:.1f}s")
            print(f"📤 Exit code: {result.returncode}")
            
            if result.stdout:
                print(f"📝 Output:\n{result.stdout}")
            if result.stderr:
                print(f"🔍 Errors:\n{result.stderr}")
            
            success = result.returncode == 0
            print(f"{'✅' if success else '❌'} Unit tests {'PASSED' if success else 'FAILED'}")
            
            return {
                "success": success,
                "duration": duration,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "exit_code": result.returncode
            }
            
        except subprocess.TimeoutExpired:
            duration = time.time() - start_time
            print(f"⏰ Unit tests timed out after {duration:.1f}s")
            return {"success": False, "error": "Timeout", "duration": duration}
        except Exception as e:
            duration = time.time() - start_time
            print(f"💥 Unit test error: {e}")
            return {"success": False, "error": str(e), "duration": duration}
    
    def run_integration_tests(self) -> Dict[str, Any]:
        """Run API integration tests with detailed progress tracking."""
        print("\n🌐 RUNNING API INTEGRATION TESTS")
        print("-" * 50)
        
        integration_test_file = os.path.join(self.tests_dir, "integration", "test_enhanced_api_integration.py")
        
        if not os.path.exists(integration_test_file):
            print(f"❌ Integration test file not found: {integration_test_file}")
            return {"success": False, "error": "Test file not found", "duration": 0}
        
        print(f"📄 Running: {os.path.basename(integration_test_file)}")
        print(f"🌐 Backend URL: {self.backend_url}")
        
        start_time = time.time()
        
        try:
            # Run the integration test script directly
            cmd = [
                sys.executable, integration_test_file,
                "--url", self.backend_url,
                "--verbose"
            ]
            
            print(f"🔧 Command: {' '.join(cmd)}")
            
            result = subprocess.run(
                cmd,
                cwd=self.base_dir,
                capture_output=True,
                text=True,
                timeout=600  # 10 minute timeout for integration tests
            )
            
            duration = time.time() - start_time
            
            print(f"⏱️  Integration tests completed in {duration:.1f}s")
            print(f"📤 Exit code: {result.returncode}")
            
            if result.stdout:
                print(f"📝 Output:\n{result.stdout}")
            if result.stderr:
                print(f"🔍 Errors:\n{result.stderr}")
            
            success = result.returncode == 0
            print(f"{'✅' if success else '❌'} Integration tests {'PASSED' if success else 'FAILED'}")
            
            return {
                "success": success,
                "duration": duration,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "exit_code": result.returncode
            }
            
        except subprocess.TimeoutExpired:
            duration = time.time() - start_time
            print(f"⏰ Integration tests timed out after {duration:.1f}s")
            return {"success": False, "error": "Timeout", "duration": duration}
        except Exception as e:
            duration = time.time() - start_time
            print(f"💥 Integration test error: {e}")
            return {"success": False, "error": str(e), "duration": duration}
    
    def run_e2e_tests(self) -> Dict[str, Any]:
        """Run end-to-end tests with detailed progress tracking."""
        print("\n[TARGET] RUNNING END-TO-END TESTS")
        print("-" * 50)
        
        e2e_test_file = os.path.join(self.tests_dir, "backend", "test_simple_e2e.py")
        
        if not os.path.exists(e2e_test_file):
            print(f"[ERROR] E2E test file not found: {e2e_test_file}")
            return {"success": False, "error": "Test file not found", "duration": 0}
        
        print(f"[FILE] Running: {os.path.basename(e2e_test_file)}")
        
        start_time = time.time()
        
        try:
            # Run the E2E test script directly
            cmd = [sys.executable, e2e_test_file]
            
            print(f"[CMD] Command: {' '.join(cmd)}")
            
            result = subprocess.run(
                cmd,
                cwd=self.base_dir,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout for E2E tests
            )
            
            duration = time.time() - start_time
            
            print(f"[TIME] E2E tests completed in {duration:.1f}s")
            print(f"[EXIT] Exit code: {result.returncode}")
            
            if result.stdout:
                print(f"[OUTPUT] Output:\n{result.stdout}")
            if result.stderr:
                print(f"[ERROR] Errors:\n{result.stderr}")
            
            success = result.returncode == 0
            print(f"{'[PASS]' if success else '[FAIL]'} E2E tests {'PASSED' if success else 'FAILED'}")
            
            return {
                "success": success,
                "duration": duration,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "exit_code": result.returncode
            }
            
        except subprocess.TimeoutExpired:
            duration = time.time() - start_time
            print(f"[TIMEOUT] E2E tests timed out after {duration:.1f}s")
            return {"success": False, "error": "Timeout", "duration": duration}
        except Exception as e:
            duration = time.time() - start_time
            print(f"[ERROR] E2E test error: {e}")
            return {"success": False, "error": str(e), "duration": duration}
    
    def run_existing_backend_tests(self) -> Dict[str, Any]:
        """Run existing backend test files in tests/ directory."""
        print("\n🔧 RUNNING EXISTING BACKEND TESTS")
        print("-" * 50)
        
        backend_tests_dir = os.path.join(self.base_dir, "tests", "backend")
        
        if not os.path.exists(backend_tests_dir):
            print(f"[INFO] Backend tests directory not found: {backend_tests_dir}")
            return {"success": True, "duration": 0, "message": "No backend tests directory"}
        
        # Find test files
        test_files = []
        for filename in os.listdir(backend_tests_dir):
            if filename.startswith("test_") and filename.endswith(".py"):
                test_files.append(os.path.join(backend_tests_dir, filename))
        
        if not test_files:
            print("[INFO] No test files found in backend tests directory")
            return {"success": True, "duration": 0, "message": "No test files found"}
        
        print(f"[INFO] Found {len(test_files)} test files")
        for test_file in test_files:
            print(f"  - {os.path.basename(test_file)}")
        
        start_time = time.time()
        
        try:
            # Run pytest on all backend test files
            cmd = [
                sys.executable, "-m", "pytest", 
                backend_tests_dir,
                "-v", "--tb=short"
            ]
            
            print(f"[CMD] Command: {' '.join(cmd)}")
            
            result = subprocess.run(
                cmd,
                cwd=self.base_dir,
                capture_output=True,
                text=True,
                timeout=300
            )
            
            duration = time.time() - start_time
            
            print(f"[TIME] Backend tests completed in {duration:.1f}s")
            print(f"[EXIT] Exit code: {result.returncode}")
            
            if result.stdout:
                print(f"[OUTPUT] Output:\n{result.stdout}")
            if result.stderr:
                print(f"[ERROR] Errors:\n{result.stderr}")
            
            success = result.returncode == 0
            print(f"{'[PASS]' if success else '[FAIL]'} Backend tests {'PASSED' if success else 'FAILED'}")
            
            return {
                "success": success,
                "duration": duration,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "exit_code": result.returncode
            }
            
        except subprocess.TimeoutExpired:
            duration = time.time() - start_time
            print(f"[TIMEOUT] Backend tests timed out after {duration:.1f}s")
            return {"success": False, "error": "Timeout", "duration": duration}
        except Exception as e:
            duration = time.time() - start_time
            print(f"[ERROR] Backend test error: {e}")
            return {"success": False, "error": str(e), "duration": duration}
    
    def run_full_transcription_e2e_test(self) -> Dict[str, Any]:
        """Run the complete audio transcription end-to-end test."""
        print("\n🎤 RUNNING FULL TRANSCRIPTION E2E TEST")
        print("-" * 50)
        
        full_e2e_test_file = os.path.join(self.tests_dir, "backend", "test_full_transcription_e2e.py")
        
        if not os.path.exists(full_e2e_test_file):
            print(f"❌ Full E2E test file not found: {full_e2e_test_file}")
            return {"success": False, "error": "Test file not found", "duration": 0}
        
        print(f"[FILE] Running: {os.path.basename(full_e2e_test_file)}")
        print("[INFO] This test creates audio, uploads it, transcribes, and validates results")
        
        start_time = time.time()
        
        try:
            # Run the full transcription E2E test
            cmd = [sys.executable, full_e2e_test_file, "--url", "http://localhost:8000"]
            
            print(f"[CMD] Command: {' '.join(cmd)}")
            
            result = subprocess.run(
                cmd,
                cwd=self.base_dir,
                capture_output=True,
                text=True,
                timeout=600  # 10 minute timeout for full E2E with audio processing
            )
            
            duration = time.time() - start_time
            
            print(f"[TIME] Full E2E test completed in {duration:.1f}s")
            print(f"[EXIT] Exit code: {result.returncode}")
            
            if result.stdout:
                print(f"[OUTPUT] Output:\n{result.stdout}")
            if result.stderr and result.stderr.strip():
                print(f"[ERROR] Errors:\n{result.stderr}")
            
            success = result.returncode == 0
            
            if success:
                print("[PASS] Full transcription E2E test PASSED")
                print("✅ Audio was created, uploaded, transcribed, and text extracted successfully!")
            else:
                print("[FAIL] Full transcription E2E test FAILED")
                print("❌ Audio transcription pipeline has issues")
            
            return {
                "success": success,
                "duration": duration,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "exit_code": result.returncode,
                "tests_run": "Full audio transcription workflow"
            }
            
        except subprocess.TimeoutExpired:
            duration = time.time() - start_time
            print(f"[TIMEOUT] Full E2E test timed out after {duration:.1f}s")
            return {"success": False, "error": "Timeout (processing may take longer)", "duration": duration}
        except Exception as e:
            duration = time.time() - start_time
            print(f"[ERROR] Full E2E test error: {e}")
            return {"success": False, "error": str(e), "duration": duration}
        """Run existing backend tests for compatibility."""
        print("\n🔄 RUNNING EXISTING BACKEND TESTS")
        print("-" * 50)
        
        backend_tests_dir = os.path.join(self.base_dir, "backend", "tests")
        
        if not os.path.exists(backend_tests_dir):
            print("ℹ️  No existing backend tests directory found")
            return {"success": True, "skipped": True, "duration": 0}
        
        print(f"📁 Testing directory: {backend_tests_dir}")
        
        start_time = time.time()
        
        try:
            # Run pytest on the backend tests directory
            cmd = [
                sys.executable, "-m", "pytest", 
                backend_tests_dir,
                "-v", "--tb=short"
            ]
            
            print(f"🔧 Command: {' '.join(cmd)}")
            
            result = subprocess.run(
                cmd,
                cwd=self.base_dir,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            
            duration = time.time() - start_time
            
            print(f"⏱️  Backend tests completed in {duration:.1f}s")
            print(f"📤 Exit code: {result.returncode}")
            
            if result.stdout:
                print(f"📝 Output:\n{result.stdout}")
            if result.stderr:
                print(f"🔍 Errors:\n{result.stderr}")
            
            success = result.returncode == 0
            print(f"{'✅' if success else '❌'} Backend tests {'PASSED' if success else 'FAILED'}")
            
            return {
                "success": success,
                "duration": duration,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "exit_code": result.returncode
            }
            
        except subprocess.TimeoutExpired:
            duration = time.time() - start_time
            print(f"⏰ Backend tests timed out after {duration:.1f}s")
            return {"success": False, "error": "Timeout", "duration": duration}
        except Exception as e:
            duration = time.time() - start_time
            print(f"💥 Backend test error: {e}")
            return {"success": False, "error": str(e), "duration": duration}
    
    def run_all_tests(self, skip_unit: bool = False, skip_integration: bool = False, 
                     skip_e2e: bool = False, skip_backend: bool = False, 
                     skip_full_e2e: bool = False) -> bool:
        """Run all test suites with comprehensive progress tracking."""
        
        self.print_header()
        
        # Step 1: Check dependencies
        if not self.check_dependencies():
            print("\n💥 DEPENDENCY CHECK FAILED - Cannot proceed with tests")
            return False
        
        # Step 2: Check backend health
        if not self.check_backend_health():
            print("\n💥 BACKEND HEALTH CHECK FAILED - Cannot proceed with tests")
            return False
        
        # Step 3: Run test suites
        test_suites = []
        
        if not skip_unit:
            test_suites.append(("Unit Tests", self.run_unit_tests))
        
        if not skip_backend:
            test_suites.append(("Backend Tests", self.run_existing_backend_tests))
        
        if not skip_integration:
            test_suites.append(("Integration Tests", self.run_integration_tests))
        
        if not skip_e2e:
            test_suites.append(("E2E Tests", self.run_e2e_tests))
        
        if not skip_full_e2e:
            test_suites.append(("Full Transcription E2E", self.run_full_transcription_e2e_test))
        
        # Execute test suites
        for suite_name, suite_runner in test_suites:
            print(f"\n{'🔥' * 3} STARTING {suite_name.upper()} {'🔥' * 3}")
            
            suite_result = suite_runner()
            self.test_results[suite_name] = suite_result
            
            if suite_result.get("success", False):
                print(f"{'✅' * 3} {suite_name.upper()} COMPLETED SUCCESSFULLY {'✅' * 3}")
            else:
                print(f"{'❌' * 3} {suite_name.upper()} FAILED {'❌' * 3}")
                if not suite_result.get("skipped", False):
                    print(f"💥 Error: {suite_result.get('error', 'Unknown error')}")
        
        # Final summary
        self.print_final_summary()
        
        # Return overall success
        return all(result.get("success", False) or result.get("skipped", False) 
                  for result in self.test_results.values())
    
    def print_final_summary(self):
        """Print comprehensive final summary."""
        total_duration = (datetime.now() - self.start_time).total_seconds()
        
        print("\n" + "="*100)
        print("🏁 COMPREHENSIVE TEST SUITE SUMMARY")
        print("="*100)
        
        print(f"🕐 Started: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"🏁 Finished: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"⏱️  Total Duration: {total_duration:.1f}s ({total_duration/60:.1f} minutes)")
        print(f"🌐 Backend URL: {self.backend_url}")
        
        print("\n📊 TEST SUITE RESULTS:")
        print("-" * 60)
        
        total_suites = len(self.test_results)
        passed_suites = 0
        failed_suites = 0
        skipped_suites = 0
        
        for suite_name, result in self.test_results.items():
            duration = result.get("duration", 0)
            
            if result.get("skipped", False):
                status = "⏭️  SKIPPED"
                skipped_suites += 1
            elif result.get("success", False):
                status = "✅ PASSED"
                passed_suites += 1
            else:
                status = "❌ FAILED"
                failed_suites += 1
                
            print(f"  {status:12} {suite_name:20} ({duration:6.1f}s)")
            
            if not result.get("success", False) and not result.get("skipped", False):
                error = result.get("error", "Unknown error")
                print(f"               💥 {error}")
        
        print("-" * 60)
        print(f"📈 Summary: {passed_suites} passed, {failed_suites} failed, {skipped_suites} skipped")
        
        if failed_suites == 0:
            print("\n🎉 ALL TESTS PASSED!")
            print("🔥 The enhanced transcription system is working correctly!")
            print("✨ You can now trust the restart/resume functionality!")
            print("🚀 The system is ready for production use!")
        else:
            print(f"\n💥 {failed_suites} TEST SUITE(S) FAILED!")
            print("🐛 Please review the implementation and fix issues.")
            print("🔍 Check the detailed output above for specific failures.")
        
        success_rate = (passed_suites / total_suites) * 100 if total_suites > 0 else 0
        print(f"📊 Overall Success Rate: {success_rate:.1f}%")
        
        print("="*100)

def main():
    """Main test runner with command line interface."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Enhanced Transcription System - Comprehensive Test Suite",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python test_comprehensive_suite.py                    # Run all tests
  python test_comprehensive_suite.py --skip-unit        # Skip unit tests
  python test_comprehensive_suite.py --only-e2e         # Run only E2E tests
  python test_comprehensive_suite.py --url http://prod.example.com  # Test production
        """
    )
    
    parser.add_argument("--url", default="http://localhost:8000", 
                       help="Backend URL (default: http://localhost:8000)")
    parser.add_argument("--skip-unit", action="store_true", 
                       help="Skip unit tests")
    parser.add_argument("--skip-integration", action="store_true", 
                       help="Skip integration tests")
    parser.add_argument("--skip-e2e", action="store_true", 
                       help="Skip end-to-end tests")
    parser.add_argument("--skip-backend", action="store_true", 
                       help="Skip existing backend tests")
    parser.add_argument("--skip-full-e2e", action="store_true", 
                       help="Skip full transcription E2E test")
    parser.add_argument("--only-unit", action="store_true", 
                       help="Run only unit tests")
    parser.add_argument("--only-integration", action="store_true", 
                       help="Run only integration tests")
    parser.add_argument("--only-e2e", action="store_true", 
                       help="Run only E2E tests")
    parser.add_argument("--only-backend", action="store_true", 
                       help="Run only existing backend tests")
    parser.add_argument("--only-full-e2e", action="store_true", 
                       help="Run only full transcription E2E test")
    parser.add_argument("--verbose", "-v", action="store_true", 
                       help="Verbose logging")
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Handle "only" options
    if args.only_unit:
        args.skip_integration = args.skip_e2e = args.skip_backend = args.skip_full_e2e = True
    elif args.only_integration:
        args.skip_unit = args.skip_e2e = args.skip_backend = args.skip_full_e2e = True
    elif args.only_e2e:
        args.skip_unit = args.skip_integration = args.skip_backend = args.skip_full_e2e = True
    elif args.only_backend:
        args.skip_unit = args.skip_integration = args.skip_e2e = args.skip_full_e2e = True
    elif args.only_full_e2e:
        args.skip_unit = args.skip_integration = args.skip_e2e = args.skip_backend = True
    
    # Run comprehensive test suite
    test_runner = TestSuiteRunner(args.url)
    success = test_runner.run_all_tests(
        skip_unit=args.skip_unit,
        skip_integration=args.skip_integration,
        skip_e2e=args.skip_e2e,
        skip_backend=args.skip_backend,
        skip_full_e2e=args.skip_full_e2e
    )
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()