#!/usr/bin/env python3
"""
Smart Development Runner for Audio Transcription App

This script intelligently manages both backend (FastAPI) and frontend (Vite) services
with automatic port detection, health checking, and restart capabilities.

Usage:
    python dev_runner.py [options]

Options:
    --backend-only    Start only the backend service
    --frontend-only   Start only the frontend service
    --restart         Kill existing processes and restart
    --check           Check if services are running
    --stop            Stop all running services
    --logs            Show logs from running services

Features:
    - Smart port detection and conflict resolution
    - Health checks for both services
    - Automatic restart on failure
    - Clean shutdown handling
    - Colored output for better UX
    - Service dependency checking
"""

import argparse
import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path
from typing import Dict, List

import psutil
import requests


class Colors:
    """ANSI color codes for terminal output."""
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    PURPLE = '\033[95m'
    CYAN = '\033[96m'
    WHITE = '\033[97m'
    BOLD = '\033[1m'
    END = '\033[0m'


class DevRunner:
    def __init__(self):
        self.root_dir = Path(__file__).parent
        self.backend_dir = self.root_dir / "backend"
        self.frontend_dir = self.root_dir / "frontend"
        self.is_shutting_down = False
        self.skip_final_cleanup = False
        
        # Load port configuration from central config
        self.ports = self._load_port_config()
        self.backend_port = self.ports['backend']
        self.frontend_port = self.ports['frontend']
        self.redis_port = self.ports['redis']
        self.ollama_port = self.ports['ollama']
        
        # Process tracking - environment-specific PID files
        self.processes: Dict[str, subprocess.Popen] = {}
        env_suffix = self._get_environment_suffix()
        self.pids_file = self.root_dir / f".dev_runner_pids_{env_suffix}.json"
        
        # Service URLs
        self.backend_url = f"http://localhost:{self.backend_port}"
        self.frontend_url = f"http://localhost:{self.frontend_port}"
        self.redis_url = f"redis://localhost:{self.redis_port}/0"
        self.ollama_url = f"http://localhost:{self.ollama_port}"

    def _get_environment_suffix(self) -> str:
        """Get environment suffix for PID files."""
        if os.getenv('VITE_E2E_MODE') in ['1', 'true']:
            return 'e2e'
        elif os.getenv('NODE_ENV') == 'test':
            return 'test'
        elif os.getenv('DOCKER_ENV') in ['1', 'true']:
            return 'docker'
        else:
            return 'dev'

    def _load_port_config(self) -> Dict[str, int]:
        """Load port configuration from central config file."""
        print("DEBUG: Loading port configuration...")
        try:
            config_file = self.root_dir / "port-config.json"
            if config_file.exists():
                with open(config_file) as f:
                    config = json.load(f)
                
                # Determine environment
                environment = 'development'  # Default
                if os.getenv('VITE_E2E_MODE') in ['1', 'true']:
                    environment = 'e2e'
                elif os.getenv('NODE_ENV') == 'test':
                    environment = 'test'
                elif os.getenv('DOCKER_ENV') in ['1', 'true']:
                    environment = 'docker'
                
                print(f"DEBUG: Environment detected as: {environment}")
                ports = config.get(environment, config['development'])
                print(f"DEBUG: Loaded ports: {ports}")
                return ports
            else:
                print("FATAL: Port config file not found at port-config.json")
                print("Create port-config.json or fix the configuration")
                sys.exit(1)
        except Exception as e:
            print(f"FATAL: Failed to load port config: {e}")
            sys.exit(1)

    def log(self, message: str, color: str = Colors.WHITE, service: str = "MAIN"):
        """Print colored log message with timestamp."""
        timestamp = time.strftime("%H:%M:%S")
        print(f"{Colors.BOLD}[{timestamp}]{Colors.END} {color}[{service}]{Colors.END} {message}")

    def error(self, message: str, service: str = "ERROR"):
        """Print error message."""
        self.log(message, Colors.RED, service)

    def success(self, message: str, service: str = "SUCCESS"):
        """Print success message."""
        self.log(message, Colors.GREEN, service)

    def warning(self, message: str, service: str = "WARNING"):
        """Print warning message."""
        self.log(message, Colors.YELLOW, service)

    def info(self, message: str, service: str = "INFO"):
        """Print info message."""
        self.log(message, Colors.BLUE, service)

    # REMOVED: find_available_port - NO FALLBACK PORTS ALLOWED
    # System must use configured ports only

    def get_python_executable(self) -> str:
        """Get the correct Python executable (virtual environment if available)."""
        # First check if we have a VIRTUAL_ENV environment variable
        venv_path = os.environ.get('VIRTUAL_ENV')
        if venv_path:
            python_exe = os.path.join(venv_path, 'bin', 'python')
            if os.path.exists(python_exe):
                return python_exe
        
        # Check for .venv in the project root
        venv_python = self.root_dir / '.venv' / 'bin' / 'python'
        if venv_python.exists():
            return str(venv_python)
        
        # Fallback to system Python (current executable)
        return sys.executable

    def is_port_free(self, port: int) -> bool:
        """Check if a port is available - using lsof to avoid TIME_WAIT issues."""
        try:
            # Use lsof to check if ANY process is using the port
            result = subprocess.run(
                ['lsof', '-ti', f':{port}'],
                capture_output=True,
                text=True,
                timeout=2
            )
            # If lsof returns any PIDs, port is busy
            return result.returncode != 0 or not result.stdout.strip()
        except (subprocess.TimeoutExpired, FileNotFoundError):
            # Fallback to socket method if lsof not available
            import socket
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                try:
                    s.bind(('localhost', port))
                    return True
                except OSError:
                    return False

    def is_service_running(self, service: str) -> bool:
        """Check if a service is running."""
        try:
            if service == "redis":
                # Use redis-cli ping instead of Python module
                result = subprocess.run(
                    ["redis-cli", "-p", str(self.redis_port), "ping"],
                    capture_output=True, text=True, timeout=2
                )
                return result.returncode == 0 and "PONG" in result.stdout
            elif service == "ollama":
                response = requests.get(f"{self.ollama_url}/api/tags", timeout=2)
                return response.status_code == 200
            elif service == "backend":
                response = requests.get(f"{self.backend_url}/health", timeout=2)
                return response.status_code == 200
            elif service == "frontend":
                response = requests.get(self.frontend_url, timeout=2)
                return response.status_code == 200
        except Exception:
            return False
        return False

    def is_docker_compose_running(self) -> bool:
        """Check if Docker Compose services are running."""
        try:
            result = subprocess.run(
                ["docker", "compose", "ps", "--services", "--filter", "status=running"],
                cwd=self.root_dir,
                capture_output=True, text=True, timeout=2
            )
            if result.returncode == 0 and result.stdout.strip():
                services = result.stdout.strip().split('\n')
                return len(services) > 0 and services[0] != ''
        except (subprocess.TimeoutExpired, subprocess.CalledProcessError, FileNotFoundError):
            # If Docker is stuck/unresponsive, treat as not running
            pass
        return False

    def get_docker_services(self) -> List[str]:
        """Get list of running Docker Compose services."""
        if getattr(self, 'skip_docker', False):
            return []
            
        try:
            result = subprocess.run(
                ["docker", "compose", "ps", "--services", "--filter", "status=running"],
                cwd=self.root_dir,
                capture_output=True, text=True, timeout=2
            )
            if result.returncode == 0 and result.stdout.strip():
                return result.stdout.strip().split('\n')
        except (subprocess.TimeoutExpired, subprocess.CalledProcessError, FileNotFoundError):
            # If Docker is stuck/unresponsive, treat as no services running
            pass
        return []

    def stop_docker_services(self, services: List[str]) -> bool:
        """Attempt to stop Docker Compose services automatically."""
        if getattr(self, 'skip_docker', False):
            return True
        if not services:
            return True

        service_list = ', '.join(services)
        self.warning(f"Attempting to stop Docker services: {service_list}")

        # Try both docker compose and docker-compose for compatibility
        commands = [
            ["docker", "compose", "stop", *services],
            ["docker-compose", "stop", *services]
        ]

        for cmd in commands:
            try:
                result = subprocess.run(
                    cmd,
                    cwd=self.root_dir,
                    capture_output=True,
                    text=True,
                    timeout=40
                )
                if result.returncode == 0:
                    self.success(f"Docker services stopped: {service_list}")
                    return True

                message = result.stderr.strip() or result.stdout.strip()
                if message:
                    self.warning(f"{' '.join(cmd)}: {message}")
            except FileNotFoundError:
                continue
            except subprocess.TimeoutExpired:
                self.error(f"{' '.join(cmd)} timed out while stopping Docker services")
                return False

        self.error(f"Failed to stop Docker services automatically: {service_list}")
        self.info("Please stop them manually and run the script again")
        return False

    def is_docker_backend_running(self) -> bool:
        """Check if backend is running in Docker."""
        docker_services = self.get_docker_services()
        return 'backend' in docker_services

    def is_docker_frontend_running(self) -> bool:
        """Check if frontend is running in Docker."""
        docker_services = self.get_docker_services()
        return 'frontend' in docker_services

    def warn_about_docker_conflicts(self):
        """Warn about potential Docker conflicts."""
        docker_services = self.get_docker_services()

        if not docker_services:
            return True  # No conflicts if no Docker services

        self.info(f"Docker Compose services detected: {', '.join(docker_services)}")

        app_services = [s for s in docker_services if s in ['backend', 'frontend']]
        auto_stopped: List[str] = []

        if app_services:
            self.warning(f"Docker app services running: {', '.join(app_services)}")
            self.warning("Local dev cannot reuse the same ports while these containers are up")

            stopped_targets = app_services.copy()
            if not self.stop_docker_services(app_services):
                return False

            auto_stopped = stopped_targets
            # Give Docker a moment to stop containers before re-checking
            for _ in range(5):
                time.sleep(1)
                docker_services = self.get_docker_services()
                if not any(service in docker_services for service in stopped_targets):
                    break
            else:
                docker_services = self.get_docker_services()

        if auto_stopped:
            self.success(f"Automatically stopped Docker app services: {', '.join(auto_stopped)}")
            if not docker_services:
                self.info("No Docker services remaining after cleanup")
                return True
            else:
                self.info(f"Remaining Docker services: {', '.join(docker_services)}")

        # Docker uses different external ports than local dev:
        # - Docker backend: 8080 (external) → 8000 (internal)
        # - Local backend: 8000 (direct)
        # - Docker frontend: 3000 (external) → 5173 (internal)
        # - Local frontend: 5173 (direct)
        # - Redis/Ollama: Same ports (6379, 11434) - shared between Docker and local

        # Check for actual port conflicts by testing if our dev ports are in use
        conflicts = []
        if 'backend' in docker_services and not self.is_port_free(self.backend_port):
            # Only a conflict if Docker backend is using our dev port
            conflicts.append("backend (port 8000 in use)")
        if 'frontend' in docker_services and not self.is_port_free(self.frontend_port):
            # Only a conflict if Docker frontend is using our dev port
            conflicts.append("frontend (port 5173 in use)")

        if conflicts:
            self.error("Port conflicts detected!")
            self.error(f"Conflicting services: {', '.join(conflicts)}")
            self.warning("This shouldn't happen with correct Docker configuration.")
            self.warning("Choose one of these options:")
            self.info("1. Use Docker only:")
            self.info("   docker-compose logs -f")
            self.info("")
            self.info("2. Stop conflicting Docker services:")
            self.info("   docker-compose stop backend frontend")
            self.info("   npm run dev")
            self.info("")
            self.info("3. Stop all Docker services:")
            self.info("   docker-compose down")
            self.info("   npm run dev")
            return False

        # Inform about hybrid mode
        app_services = [s for s in docker_services if s in ['backend', 'frontend']]
        support_services = [s for s in docker_services if s in ['redis', 'ollama']]

        if app_services and support_services:
            self.info(f"Hybrid mode: Docker app services ({', '.join(app_services)}) + support services ({', '.join(support_services)})")
            self.warning("Local dev will NOT start since Docker app services are running")
            self.info("To run local dev, stop Docker app services: docker-compose stop backend frontend")
            return False
        elif app_services:
            self.info(f"Docker app services running: {', '.join(app_services)}")
            self.warning("Local dev will NOT start since Docker app services are running")
            self.info("To run local dev, stop Docker app services: docker-compose stop backend frontend")
            return False
        elif support_services:
            self.success(f"Hybrid mode: Using Docker support services: {', '.join(support_services)}")
            self.success("Local dev will use Docker Redis and Ollama")

        return True

    def is_docker_service_running(self, service: str) -> bool:
        """Check if a service is running in Docker."""
        try:
            # Check for Docker containers
            result = subprocess.run(
                ["docker", "ps", "--format", "{{.Names}}", "--filter", f"name={service}"],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode == 0 and result.stdout.strip():
                container_names = result.stdout.strip().split('\n')
                # Look for containers with the service name
                for name in container_names:
                    if service in name.lower():
                        return True
        except (subprocess.TimeoutExpired, subprocess.CalledProcessError, FileNotFoundError):
            pass
        return False

    def get_service_source(self, service: str) -> str:
        """Determine if service is running via Docker, local process, or not at all."""
        if self.is_service_running(service):
            if self.is_docker_service_running(service):
                return "docker"
            else:
                return "local"
        return "none"

    def start_redis(self) -> bool:
        """Start Redis service."""
        source = self.get_service_source("redis")
        
        if source == "docker":
            self.success("Redis running in Docker - using existing instance", "REDIS")
            return True
        elif source == "local":
            self.success("Redis already running locally", "REDIS")
            return True
        
        self.info("Starting Redis service...", "REDIS")
        
        # Try to start Redis via brew services first
        try:
            result = subprocess.run(["brew", "services", "start", "redis"], 
                                  capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                # Wait a moment for Redis to start
                time.sleep(2)
                if self.is_service_running("redis"):
                    self.success("Redis started via brew services", "REDIS")
                    return True
        except (subprocess.TimeoutExpired, subprocess.CalledProcessError, FileNotFoundError):
            pass
        
        # Fallback: try to start Redis directly
        try:
            process = subprocess.Popen(
                ["redis-server", "--port", str(self.redis_port)],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=True
            )
            self.processes['redis'] = process
            
            # Wait for Redis to start
            time.sleep(2)
            if self.is_service_running("redis"):
                self.success(f"Redis started on port {self.redis_port}", "REDIS")
                return True
            else:
                self.error("Redis failed to start", "REDIS")
                return False
        except FileNotFoundError:
            self.error("Redis not found - please install with: brew install redis", "REDIS")
            return False
        except Exception as e:
            self.error(f"Failed to start Redis: {e}", "REDIS")
            return False

    def start_ollama(self) -> bool:
        """Start Ollama service."""
        source = self.get_service_source("ollama")
        
        if source == "docker":
            self.success("Ollama running in Docker - using existing instance", "OLLAMA")
            return True
        elif source == "local":
            self.success("Ollama already running locally", "OLLAMA")
            return True
        
        self.info("Starting Ollama service...", "OLLAMA")
        
        # Try to start Ollama
        try:
            process = subprocess.Popen(
                ["ollama", "serve"],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=True
            )
            self.processes['ollama'] = process
            
            # Wait for Ollama to start (it takes a bit longer)
            self.info("Waiting for Ollama to initialize...", "OLLAMA")
            time.sleep(5)
            
            # Check if it's responding
            for attempt in range(10):  # Try for 10 seconds
                if self.is_service_running("ollama"):
                    self.success(f"Ollama started on port {self.ollama_port}", "OLLAMA")
                    return True
                time.sleep(1)
            
            self.error("Ollama failed to start properly", "OLLAMA")
            return False
            
        except FileNotFoundError:
            self.warning("Ollama not found - AI features will be disabled", "OLLAMA")
            self.info("Install with: curl -fsSL https://ollama.ai/install.sh | sh", "OLLAMA")
            return True  # Not critical for basic functionality
        except Exception as e:
            self.warning(f"Failed to start Ollama: {e} - AI features will be disabled", "OLLAMA")
            return True  # Not critical for basic functionality

    def ensure_ollama_model(self) -> bool:
        """Ensure the default Ollama model is available."""
        if not self.is_service_running("ollama"):
            return False
        
        try:
            # Check if the model is available
            response = requests.get(f"{self.ollama_url}/api/tags", timeout=5)
            if response.status_code == 200:
                models = response.json().get('models', [])
                model_names = [model.get('name', '') for model in models]
                
                default_model = "llama3.2:1b"
                if any(default_model in name for name in model_names):
                    self.success(f"Ollama model {default_model} available", "OLLAMA")
                    return True
                else:
                    self.info(f"Pulling default model {default_model}...", "OLLAMA")
                    # Pull model in background (this can take a while)
                    subprocess.Popen(
                        ["ollama", "pull", default_model],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL
                    )
                    self.info(f"Model {default_model} is being downloaded in background", "OLLAMA")
                    return True
        except Exception as e:
            self.warning(f"Could not check Ollama models: {e}", "OLLAMA")
        
        return True
    
    def kill_port(self, port: int) -> bool:
        """Kill any process running on the specified port with FORCE."""
        killed = False
        pids_to_kill = []

        # Find all processes on this port
        for proc in psutil.process_iter(['pid', 'name']):
            try:
                connections = proc.net_connections()
                for conn in connections:
                    if hasattr(conn, 'laddr') and conn.laddr and conn.laddr.port == port:
                        pids_to_kill.append((proc.info['pid'], proc.info['name']))
                        break
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.TimeoutExpired, AttributeError):
                continue

        # FORCE KILL with kill -9
        for pid, name in pids_to_kill:
            try:
                subprocess.run(['kill', '-9', str(pid)], check=False, capture_output=True)
                self.warning(f"Force killed {name} (PID {pid}) on port {port}")
                killed = True
            except Exception:
                pass

        return killed

    def check_dependencies(self) -> bool:
        """Check if all required dependencies are available."""
        self.info("Checking dependencies...")
        
        # Check Python environment - look for virtual environment or required packages
        venv_detected = False
        
        # Method 1: Check VIRTUAL_ENV environment variable
        if os.environ.get('VIRTUAL_ENV'):
            venv_detected = True
            self.success("Virtual environment detected via VIRTUAL_ENV")
        
        # Method 2: Check if we're in a virtual environment by looking at sys.prefix
        elif hasattr(sys, 'real_prefix') or (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix):
            venv_detected = True
            self.success("Virtual environment detected via sys.prefix")
        
        # Method 3: Check if required packages are available (fallback)
        else:
            try:
                import importlib
                if importlib.util.find_spec("fastapi") is not None and importlib.util.find_spec("uvicorn") is not None:
                    venv_detected = True
                    self.warning("No virtual environment detected, but required packages are available")
            except Exception:
                # Ignore any issues checking specs
                pass
        
        if not venv_detected:
            self.error("No Python virtual environment detected and required packages not found.")
            self.info("Please run: source .venv/bin/activate")
            return False
        
        # Check if backend dependencies are installed
        try:
            import importlib
            if importlib.util.find_spec("fastapi") is not None and importlib.util.find_spec("uvicorn") is not None:
                self.success("Backend dependencies: OK")
            else:
                self.error("Missing backend dependencies: fastapi or uvicorn not installed")
                self.info("Run: cd backend && pip install -r requirements.txt")
                return False
        except ImportError:
            # importlib should be available, but if not, report missing deps
            self.error("Could not verify backend dependencies (importlib missing)")
            return False
        
        # Check if frontend dependencies are installed
        if not (self.frontend_dir / "node_modules").exists():
            self.error("Frontend dependencies not installed")
            self.info("Run: cd frontend && npm install")
            return False
        
        self.success("Frontend dependencies: OK")

        # Check FFmpeg
        try:
            subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
            self.success("FFmpeg: OK")
        except (subprocess.CalledProcessError, FileNotFoundError):
            # For test environment, FFmpeg is optional (AI corrections don't need it)
            env = os.getenv('NODE_ENV', 'development')
            if env == 'test':
                self.warning("FFmpeg not found (optional for test environment)")
                self.info("Install with: brew install ffmpeg (needed for transcription features)")
            else:
                self.error("FFmpeg not found")
                self.info("Install with: brew install ffmpeg")
                return False

        return True

    def setup_environment(self):
        """Set up environment variables for local development."""
        env_file = self.backend_dir / ".env"
        
        if not env_file.exists():
            self.info("Creating .env file from example...")
            example_file = self.backend_dir / ".env.example"
            if example_file.exists():
                # Copy and modify for local development
                content = example_file.read_text()
                # Update for local services
                content = content.replace("redis://redis:6379/0", f"redis://localhost:{self.redis_port}/0")
                content = content.replace("http://ollama:11434", f"http://localhost:{self.ollama_port}")
                # Use separate dev database to avoid conflicts with e2e tests
                content = content.replace("DATABASE_URL=sqlite:///./data/transcriptions.db", 
                                        "DATABASE_URL=sqlite:///./data/dev_transcriptions.db")
                env_file.write_text(content)
                self.success("Created .env file with local development settings")
            else:
                self.error(".env.example not found!")
                return False
        else:
            # Check if existing .env uses the correct dev database
            content = env_file.read_text()
            updated = False
            
            if "dev_transcriptions.db" not in content and "transcriptions.db" in content:
                content = content.replace("DATABASE_URL=sqlite:///./data/transcriptions.db", 
                                        "DATABASE_URL=sqlite:///./data/dev_transcriptions.db")
                updated = True
            
            # Update Redis URL if needed
            if "redis://redis:6379" in content:
                content = content.replace("redis://redis:6379/0", f"redis://localhost:{self.redis_port}/0")
                updated = True
            
            # Update Ollama URL if needed
            if "http://ollama:11434" in content:
                content = content.replace("http://ollama:11434", f"http://localhost:{self.ollama_port}")
                updated = True
            
            if updated:
                env_file.write_text(content)
                self.success("Updated .env for local development")
        
        return True

    def health_check(self, service: str, url: str, timeout: int = 30) -> bool:
        """Check if a service is healthy."""
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            try:
                if service == "backend":
                    response = requests.get(f"{url}/health", timeout=2)
                    if response.status_code == 200:
                        return True
                elif service == "frontend":
                    response = requests.get(url, timeout=2)
                    if response.status_code == 200:
                        return True
            except requests.RequestException:
                pass
            
            time.sleep(1)
        
        return False

    def start_backend(self) -> bool:
        """Start the backend service."""
        # Check if backend is running in Docker
        if self.is_docker_backend_running():
            self.error("Backend is running in Docker - cannot start local backend")
            self.info("Use 'docker-compose stop backend' to stop Docker backend first")
            return False

        self.info("Starting backend service...", "BACKEND")

        # STRICT PORT CHECK - NO FALLBACKS
        if not self.is_port_free(self.backend_port):
            self.error(f"Port {self.backend_port} is already in use", "BACKEND")
            self.error("Cannot start backend - port is busy", "BACKEND")
            self.info("Kill the process using the port or run: npm run dev:cleanup", "BACKEND")
            return False

        self.info(f"Using backend port: {self.backend_port}", "BACKEND")
        
        # Prepare environment
        env = os.environ.copy()
        env['PORT'] = str(self.backend_port)
        # Ensure we use the development database
        env['DATABASE_URL'] = 'sqlite:///./data/dev_transcriptions.db'
        env['DEBUG'] = 'True'
        
        # Start uvicorn WITHOUT --reload (no auto-restart chaos)
        python_exe = self.get_python_executable()
        cmd = [
            python_exe, "-m", "uvicorn",
            "app.main:app",
            "--host", "0.0.0.0",
            "--port", str(self.backend_port)
        ]
        
        # CREATE LOG FILE TO CAPTURE ALL BACKEND OUTPUT
        backend_log_path = self.root_dir / "backend_output.log"
        backend_log_file = open(backend_log_path, 'w')
        self.info(f"Logging backend output to: {backend_log_path}", "BACKEND")

        try:
            process = subprocess.Popen(
                cmd,
                cwd=self.backend_dir,
                env=env,
                stdout=backend_log_file,
                stderr=subprocess.STDOUT,
                universal_newlines=True,
                bufsize=1  # Line buffered
            )
            
            self.processes['backend'] = process
            self.info(f"Backend starting on {self.backend_url}", "BACKEND")
            
            # Simple startup monitoring - just check if process and health endpoint work
            start_time = time.time()
            while time.time() - start_time < 10:  # Wait up to 10 seconds for startup
                time.time() - start_time
                
                # Check if process died
                if process.poll() is not None:
                    self.error("Backend process died during startup", "BACKEND")
                    # Show stderr if available
                    try:
                        stderr_output = process.stderr.read()
                        if stderr_output:
                            for line in stderr_output.splitlines()[-10:]:  # Last 10 lines
                                self.error(f"  {line.strip()}", "BACKEND")
                    except Exception:
                        # Ignore stderr read errors but log for debugging
                        self.debug("Error reading backend stderr during startup")
                    return False
                
                # Check if healthy (this will test if the server is responding)
                if self.is_service_running("backend"):
                    self.success(f"Backend healthy at {self.backend_url}", "BACKEND")
                    return True
                
                # Wait before next check
                time.sleep(0.5)
            
            # If we get here, health check failed but process is still running
            if process.poll() is None:
                self.warning("Backend started but health check failed", "BACKEND")
                return True  # Let it run and see what happens
            else:
                self.error("Backend failed to start", "BACKEND")
                return False
                
        except Exception as e:
            self.error(f"Failed to start backend: {e}", "BACKEND")
            return False

    def start_frontend(self) -> bool:
        """Start the frontend service."""
        # Check if frontend is running in Docker
        if self.is_docker_frontend_running():
            self.error("Frontend is running in Docker - cannot start local frontend")
            self.info("Use 'docker-compose stop frontend' to stop Docker frontend first")
            return False

        self.info("Starting frontend service...", "FRONTEND")

        # STRICT PORT CHECK - NO FALLBACKS
        if not self.is_port_free(self.frontend_port):
            self.error(f"Port {self.frontend_port} is already in use", "FRONTEND")
            self.error("Cannot start frontend - port is busy", "FRONTEND")
            self.info("Kill the process using the port or run: npm run dev:cleanup", "FRONTEND")
            return False

        self.info(f"Using configured frontend port: {self.frontend_port}", "FRONTEND")
        
        # Prepare environment
        env = os.environ.copy()
        env['VITE_API_BASE_URL'] = self.backend_url
        # Mark as dev mode (not e2e)
        env['VITE_DEV_MODE'] = '1'
        
        # Start Vite dev server
        cmd = ["npm", "run", "dev", "--", "--port", str(self.frontend_port), "--host"]

        # CREATE LOG FILE TO CAPTURE ALL FRONTEND OUTPUT
        frontend_log_path = self.root_dir / "frontend_output.log"
        frontend_log_file = open(frontend_log_path, 'w')
        self.info(f"Logging frontend output to: {frontend_log_path}", "FRONTEND")

        try:
            process = subprocess.Popen(
                cmd,
                cwd=self.frontend_dir,
                env=env,
                stdout=frontend_log_file,
                stderr=subprocess.STDOUT,
                universal_newlines=True
            )
            
            self.processes['frontend'] = process
            self.info(f"Frontend starting on {self.frontend_url}", "FRONTEND")
            
            # Wait for health check
            if self.health_check("frontend", self.frontend_url):
                self.success(f"Frontend healthy at {self.frontend_url}", "FRONTEND")
                return True
            else:
                self.error("Frontend health check failed", "FRONTEND")
                return False
                
        except Exception as e:
            self.error(f"Failed to start frontend: {e}", "FRONTEND")
            return False

    def save_pids(self):
        """Save process PIDs to file for later cleanup."""
        pids = {
            service: proc.pid for service, proc in self.processes.items()
        }
        pids['backend_port'] = self.backend_port
        pids['frontend_port'] = self.frontend_port
        
        with open(self.pids_file, 'w') as f:
            json.dump(pids, f)

    def load_pids(self) -> Dict:
        """Load saved PIDs."""
        if self.pids_file.exists():
            try:
                with open(self.pids_file, 'r') as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                pass
        return {}

    def terminate_process_tree(self, proc: psutil.Process, label: str, wait_timeout: float = 3.0):
        """Terminate a process and all of its children."""
        try:
            children = proc.children(recursive=True)
        except psutil.NoSuchProcess:
            return

        for child in children:
            try:
                child.terminate()
            except psutil.NoSuchProcess:
                continue

        _, alive = psutil.wait_procs(children, timeout=wait_timeout)
        for child in alive:
            try:
                child.kill()
            except psutil.NoSuchProcess:
                continue

        try:
            proc.terminate()
        except psutil.NoSuchProcess:
            return

        try:
            proc.wait(timeout=wait_timeout)
        except (psutil.TimeoutExpired, psutil.NoSuchProcess):
            try:
                proc.kill()
            except psutil.NoSuchProcess:
                pass

    def stop_services(self):
        """Stop all running services."""
        self.info("Stopping services...")
        
        # Stop tracked processes
        for service, process in self.processes.items():
            if process and process.poll() is None:
                self.warning(f"Terminating {service}...")
                try:
                    ps_proc = psutil.Process(process.pid)
                    self.terminate_process_tree(ps_proc, service, wait_timeout=5)
                except psutil.NoSuchProcess:
                    continue
        
        # Stop any processes from previous runs OF THE SAME ENVIRONMENT
        saved_pids = self.load_pids()
        current_env = self._get_environment_suffix()
        for service, pid in saved_pids.items():
            if service.endswith('_port'):
                continue
            try:
                ps_proc = psutil.Process(pid)
                if ps_proc.is_running():
                    self.warning(f"Killing saved {service} process tree (PID {pid}) from {current_env} environment")
                    self.terminate_process_tree(ps_proc, service, wait_timeout=5)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        
        # For Redis, only stop if we started it locally (not if it's running in Docker)
        if 'redis' not in self.processes:
            redis_source = self.get_service_source("redis")
            if redis_source == "local":
                try:
                    self.info("Stopping locally managed Redis...")
                    subprocess.run(["brew", "services", "stop", "redis"], 
                                 capture_output=True, timeout=10)
                except Exception:
                    pass
            elif redis_source == "docker":
                self.info("Redis running in Docker - leaving it running")
        
        # For Ollama, only mention if it's running in Docker
        if 'ollama' not in self.processes:
            ollama_source = self.get_service_source("ollama")
            if ollama_source == "docker":
                self.info("Ollama running in Docker - leaving it running")
        
        # Clean up PIDs file
        if self.pids_file.exists():
            self.pids_file.unlink()
        
        # Run aggressive cleanup to catch orphaned processes
        self.aggressive_cleanup()
        
        self.success("Development services stopped")

    def aggressive_cleanup(self):
        """Aggressively clean up development processes for current environment only."""
        current_env = self._get_environment_suffix()
        self.warning(f"Performing cleanup of {current_env} environment processes...")
        
        killed_count = 0
        
        # Only target processes on OUR environment's ports
        target_backend_port = self.backend_port
        target_frontend_port = self.frontend_port
        
        # Kill uvicorn processes on our backend port
        try:
            for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                cmdline = ' '.join(proc.info['cmdline'] or [])
                if ('uvicorn' in proc.info['name'] or 'uvicorn' in cmdline):
                    # Kill if it contains our app module OR is running on our specific port
                    should_kill = False
                    if 'main:app' in cmdline:
                        # Check if it's running on our port
                        try:
                            connections = proc.net_connections()
                            for conn in connections:
                                if (hasattr(conn, 'laddr') and conn.laddr and 
                                    conn.laddr.port == target_backend_port):
                                    should_kill = True
                                    break
                        except (psutil.AccessDenied, psutil.NoSuchProcess, AttributeError):
                            pass
                    
                    if should_kill:
                        try:
                            proc.terminate()
                            proc.wait(timeout=3)
                            self.warning(f"Killed {current_env} uvicorn process (PID {proc.info['pid']}) on port {target_backend_port}")
                            killed_count += 1
                        except (psutil.NoSuchProcess, psutil.TimeoutExpired):
                            try:
                                proc.kill()
                                killed_count += 1
                            except psutil.NoSuchProcess:
                                pass
        except Exception as e:
            self.warning(f"Error cleaning uvicorn processes: {e}")
        
        # Kill node/vite processes on our frontend port
        try:
            for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                if proc.info['name'] in ['node', 'Node']:
                    cmdline = ' '.join(proc.info['cmdline'] or [])
                    if 'vite' in cmdline or 'dev' in cmdline:
                        # Check if it's using our frontend port
                        should_kill = False
                        try:
                            connections = proc.net_connections()
                            for conn in connections:
                                if (hasattr(conn, 'laddr') and conn.laddr and 
                                    conn.laddr.port == target_frontend_port):
                                    should_kill = True
                                    break
                        except (psutil.AccessDenied, psutil.NoSuchProcess, psutil.TimeoutExpired, AttributeError):
                            pass
                        
                        if should_kill:
                            try:
                                proc.terminate()
                                proc.wait(timeout=3)
                                self.warning(f"Killed {current_env} node/vite process (PID {proc.info['pid']}) on port {target_frontend_port}")
                                killed_count += 1
                            except (psutil.NoSuchProcess, psutil.TimeoutExpired):
                                try:
                                    proc.kill()
                                    killed_count += 1
                                except psutil.NoSuchProcess:
                                    pass
        except Exception as e:
            self.warning(f"Error cleaning node processes: {e}")
        
        if killed_count > 0:
            self.success(f"Killed {killed_count} orphaned {current_env} environment processes")
        else:
            self.info(f"No orphaned {current_env} environment processes found")

    def check_services(self) -> Dict[str, bool]:
        """Check which services are currently running."""
        status = {}
        
        # Check backend
        status['backend'] = self.is_service_running("backend")
        
        # Check frontend
        status['frontend'] = self.is_service_running("frontend")
        
        # Check Redis with source info
        redis_source = self.get_service_source("redis")
        status['redis'] = redis_source != "none"
        status['redis_source'] = redis_source
        
        # Check Ollama with source info
        ollama_source = self.get_service_source("ollama")
        status['ollama'] = ollama_source != "none"
        status['ollama_source'] = ollama_source
        
        return status

    def show_logs(self):
        """Show logs from running services."""
        self.info("Showing service logs (Ctrl+C to stop)...")
        
        try:
            while True:
                for service, process in self.processes.items():
                    if process and process.poll() is None:
                        # Read available output
                        while True:
                            try:
                                line = process.stdout.readline()
                                if line:
                                    print(f"{Colors.CYAN}[{service.upper()}]{Colors.END} {line.rstrip()}")
                                else:
                                    break
                            except Exception:
                                break
                
                time.sleep(0.1)
        except KeyboardInterrupt:
            self.info("Stopped showing logs")

    def signal_handler(self, signum, frame):
        """Handle shutdown signals."""
        if self.is_shutting_down:
            # Prevent reentrant calls - just exit immediately
            sys.exit(0)

        self.is_shutting_down = True
        self.skip_final_cleanup = True
        # Use print directly to avoid reentrant call issues
        print("\n[WARNING] Received shutdown signal, cleaning up...")
        try:
            self.stop_services()
        except Exception:
            # Best-effort stop; log and continue
            self.debug("stop_services raised an exception during shutdown")
        sys.exit(0)

    def run(self, backend_only=False, frontend_only=False, restart=False, check=False, stop=False, cleanup=False, logs=False, docker_status=False, skip_docker=False):
        """Main run method."""
        # Set up signal handlers
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
        
        # Store skip_docker flag for Docker methods
        self.skip_docker = skip_docker
        
        try:
            if stop:
                self.stop_services()
                return
            
            if cleanup:
                self.aggressive_cleanup()
                return
            
            if docker_status:
                self.info("Checking Docker status...")
                docker_services = self.get_docker_services()
                
                if docker_services:
                    self.success(f"Docker Compose services running: {', '.join(docker_services)}")
                    
                    # Show detailed Docker info
                    try:
                        result = subprocess.run(
                            ["docker", "compose", "ps", "--format", "table"],
                            cwd=self.root_dir,
                            capture_output=True, text=True, timeout=5
                        )
                        if result.returncode == 0:
                            print("\n" + result.stdout)
                    except Exception:
                        pass
                    
                    # Check for conflicts
                    conflicts = []
                    if 'backend' in docker_services:
                        conflicts.append("backend (blocks local backend)")
                    if 'frontend' in docker_services:
                        conflicts.append("frontend (blocks local frontend)")
                    
                    if conflicts:
                        self.warning("Potential conflicts:")
                        for conflict in conflicts:
                            self.warning(f"  - {conflict}")
                        self.info("\nTo resolve:")
                        self.info("  Option 1: Use Docker only - docker-compose logs -f")
                        self.info("  Option 2: Stop conflicting services - docker-compose stop backend frontend")
                        self.info("  Option 3: Stop all Docker - docker-compose down")
                else:
                    self.info("No Docker Compose services running")
                
                # Check individual services
                self.info("\nIndividual service status:")
                for service in ['backend', 'frontend', 'redis', 'ollama']:
                    source = self.get_service_source(service)
                    if source == "docker":
                        self.success(f"  {service}: Running in Docker")
                    elif source == "local":
                        self.success(f"  {service}: Running locally")
                    else:
                        self.info(f"  {service}: Not running")
                return
            
            if check:
                status = self.check_services()
                for service, running in status.items():
                    if service.endswith('_source'):
                        continue
                    
                    if service in ['redis', 'ollama'] and running:
                        source = status.get(f'{service}_source', 'unknown')
                        source_text = f" ({source})" if source != 'unknown' else ""
                        status_text = f"RUNNING{source_text}"
                        color = Colors.GREEN
                    else:
                        status_text = "RUNNING" if running else "STOPPED"
                        color = Colors.GREEN if running else Colors.RED
                    
                    self.log(f"{service}: {status_text}", color)
                return
            
            if restart:
                self.stop_services()
                time.sleep(2)

            # ALWAYS clean up any existing dev processes before starting
            # Check if PORTS are in use (not if services respond)
            backend_port_busy = not self.is_port_free(self.backend_port)
            frontend_port_busy = not self.is_port_free(self.frontend_port)

            if backend_port_busy or frontend_port_busy:
                self.warning("Found processes using dev ports - cleaning up...")
                if backend_port_busy:
                    self.warning(f"Killing process on backend port {self.backend_port}")
                    self.kill_port(self.backend_port)
                if frontend_port_busy:
                    self.warning(f"Killing process on frontend port {self.frontend_port}")
                    self.kill_port(self.frontend_port)

                # Wait for ports to actually free up - OS needs time after kill -9
                self.warning("Waiting for OS to free ports (this can take up to 15 seconds)...")
                time.sleep(5)  # Initial longer wait

                # Verify ports are actually free now
                max_retries = 10  # More retries
                for i in range(max_retries):
                    backend_free = self.is_port_free(self.backend_port)
                    frontend_free = self.is_port_free(self.frontend_port)

                    if backend_free and frontend_free:
                        break

                    if i < max_retries - 1:
                        self.warning(f"Ports still busy, waiting... ({i+1}/{max_retries})")
                        time.sleep(1.5)
                    else:
                        self.error("Ports still busy after cleanup!")
                        self.error("Manual cleanup needed - run: npm run dev:cleanup")
                        self.error("Or wait 30 seconds and try again")
                        return

                self.success("Cleanup complete - ports are free")

            # Dependency checks
            if not self.check_dependencies():
                return
            
            if not self.setup_environment():
                return
            
            # Check for Docker conflicts
            if not self.warn_about_docker_conflicts():
                self.error("Cannot proceed due to Docker service conflicts")
                self.info("Please resolve conflicts and try again")
                return
            
            # Start supporting services first
            self.info("Starting supporting services...")
            
            # Start Redis (required)
            if not self.start_redis():
                self.error("Redis is required for the application to work")
                return
            
            # Start Ollama (optional, for AI features)
            self.start_ollama()
            
            # Ensure Ollama model is available (non-blocking)
            if self.is_service_running("ollama"):
                self.ensure_ollama_model()
            
            # Start main services
            if not frontend_only:
                if not self.start_backend():
                    return
            
            if not backend_only:
                if not self.start_frontend():
                    return
            
            # Save PIDs for cleanup
            self.save_pids()
            
            # Show status
            self.success("=== Development Environment Ready ===")
            if not frontend_only:
                self.success(f"Backend:  {self.backend_url}")
                self.success(f"API Docs: {self.backend_url}/docs")
            if not backend_only:
                self.success(f"Frontend: {self.frontend_url}")
            
            # Show supporting services status
            redis_source = self.get_service_source("redis")
            if redis_source != "none":
                source_text = f" ({redis_source})" if redis_source != "local" else ""
                self.success(f"Redis:    {self.redis_url}{source_text}")
            
            ollama_source = self.get_service_source("ollama")
            if ollama_source != "none":
                source_text = f" ({ollama_source})" if ollama_source != "local" else ""
                self.success(f"Ollama:   {self.ollama_url} (AI features enabled){source_text}")
            else:
                self.warning("Ollama:   Not running (AI features disabled)")
            
            self.info("Press Ctrl+C to stop all services")
            
            if logs:
                self.show_logs()
            else:
                # Keep the script running - NO AUTO-RESTART
                # If a service dies, the user must manually restart
                while True:
                    time.sleep(1)
                    # Monitor but DO NOT auto-restart
                    for service, process in list(self.processes.items()):
                        if process.poll() is not None:
                            self.error(f"{service} process died!")
                            self.error("Please restart manually with: npm run dev:restart")
                            # Exit immediately - don't continue running with dead services
                            sys.exit(1)
        
        except KeyboardInterrupt:
            pass
        finally:
            # Only stop services if we're not just checking status
            if not self.skip_final_cleanup and not (check or stop or cleanup or docker_status):
                self.stop_services()


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(description="Smart Development Runner for Audio Transcription App")
    parser.add_argument("--backend-only", action="store_true", help="Start only the backend service")
    parser.add_argument("--frontend-only", action="store_true", help="Start only the frontend service")
    parser.add_argument("--restart", action="store_true", help="Kill existing processes and restart")
    parser.add_argument("--check", action="store_true", help="Check if services are running")
    parser.add_argument("--stop", action="store_true", help="Stop all running services")
    parser.add_argument("--cleanup", action="store_true", help="Aggressively clean up all orphaned development processes")
    parser.add_argument("--skip-docker", action="store_true", help="Skip Docker checks (use when Docker is unresponsive)")
    parser.add_argument("--logs", action="store_true", help="Show logs from running services")
    parser.add_argument("--docker-status", action="store_true", help="Show Docker Compose status")
    
    args = parser.parse_args()
    
    runner = DevRunner()
    runner.run(
        backend_only=args.backend_only,
        frontend_only=args.frontend_only,
        restart=args.restart,
        check=args.check,
        stop=args.stop,
        cleanup=args.cleanup,
        logs=args.logs,
        docker_status=args.docker_status,
        skip_docker=args.skip_docker
    )
if __name__ == "__main__":
    main()
