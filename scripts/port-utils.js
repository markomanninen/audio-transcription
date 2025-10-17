#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load port configuration
const configPath = path.join(__dirname, '..', 'port-config.json');
const portConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Determine environment
function getEnvironment() {
  // Check environment variables first
  if (process.env.VITE_E2E_MODE === '1' || process.env.VITE_E2E_MODE === 'true') {
    return 'e2e';
  }
  if (process.env.NODE_ENV === 'test') {
    return 'test';
  }
  if (process.env.DOCKER_ENV === '1' || process.env.DOCKER_ENV === 'true') {
    return 'docker';
  }
  
  // Check if we're in Docker by looking for Docker-specific files
  if (fs.existsSync('/.dockerenv') || fs.existsSync('/proc/1/cgroup')) {
    return 'docker';
  }
  
  // Default to development
  return 'development';
}

// Get ports for current environment
function getPorts() {
  const env = getEnvironment();
  return portConfig[env] || portConfig.development;
}

// Get specific service port
function getPort(service) {
  const ports = getPorts();
  return ports[service];
}

// Get base URLs for services
function getUrls() {
  const ports = getPorts();
  const host = process.env.HOST || 'localhost';
  
  return {
    backend: `http://${host}:${ports.backend}`,
    frontend: `http://${host}:${ports.frontend}`,
    redis: `redis://${host}:${ports.redis}`,
    ollama: `http://${host}:${ports.ollama}`
  };
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  const service = process.argv[3];
  
  switch (command) {
    case 'env':
      console.log(getEnvironment());
      break;
    case 'port':
      if (service) {
        console.log(getPort(service));
      } else {
        console.log(JSON.stringify(getPorts(), null, 2));
      }
      break;
    case 'url':
      if (service) {
        const urls = getUrls();
        console.log(urls[service]);
      } else {
        console.log(JSON.stringify(getUrls(), null, 2));
      }
      break;
    case 'config':
      console.log(JSON.stringify({ environment: getEnvironment(), ports: getPorts(), urls: getUrls() }, null, 2));
      break;
    default:
      console.log('Usage: node port-utils.js <command> [service]');
      console.log('Commands:');
      console.log('  env           - Show current environment');
      console.log('  port [svc]    - Show port(s)');
      console.log('  url [svc]     - Show URL(s)');
      console.log('  config        - Show full config');
      console.log('Services: backend, frontend, redis, ollama');
  }
}

module.exports = {
  getEnvironment,
  getPorts,
  getPort,
  getUrls
};