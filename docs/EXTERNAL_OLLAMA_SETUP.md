# External Ollama Service Configuration Guide

This guide explains how to configure the Audio Transcription application to use an external Ollama service instead of the local Docker-based one.

## Overview

By default, the application runs Ollama locally using Docker. However, you can configure it to use:
- **Remote Ollama instances** (self-hosted on other servers)
- **Cloud-hosted Ollama services** (like those provided by cloud platforms)
- **Managed Ollama endpoints** (third-party services)

## Benefits of External Ollama

✅ **Performance**: Use powerful remote GPUs for faster inference  
✅ **Scalability**: Handle multiple concurrent requests  
✅ **Resource Management**: Offload compute from local machine  
✅ **Model Management**: Access to larger models and centralized model storage  
✅ **Team Sharing**: Multiple users can share the same Ollama instance  

## Configuration Methods

### Method 1: Environment Variables (Recommended for Production)

1. **Copy the example configuration**:
   ```bash
   cp backend/.env.external-ollama.example backend/.env
   ```

2. **Edit the configuration**:
   ```env
   # Enable external mode
   OLLAMA_EXTERNAL=true
   
   # External service URL
   OLLAMA_BASE_URL=https://your-ollama-service.com
   
   # Model configuration
   OLLAMA_MODEL=llama3.2:1b
   
   # Timeout for requests (increase for slower networks)
   OLLAMA_TIMEOUT=60
   
   # Optional: API key for authenticated services
   OLLAMA_API_KEY=your-bearer-token-here
   
   # SSL verification (set to false only for self-signed certs)
   OLLAMA_VERIFY_SSL=true
   ```

3. **Restart the application**:
   ```bash
   docker compose down
   docker compose up --build
   ```

### Method 2: UI Configuration (For Development/Testing)

1. Open the application in your browser
2. Click on the AI provider dropdown in the header
3. Select "⚙️ Advanced Settings"
4. In the Ollama section:
   - ✅ Check "Use External Ollama Service"
   - Enter your external Ollama URL
   - Configure API key if required
   - Set SSL verification preference
   - Select your model
5. Click "Save Changes"

## External Service Requirements

Your external Ollama service must:

### 1. API Compatibility
- Support the standard Ollama API endpoints:
  - `GET /api/tags` (for health checks)
  - `POST /api/generate` (for text generation)

### 2. Network Access
- Be accessible from your application server
- Allow CORS if accessed from browser (for development)

### 3. Model Availability
- Have the required model(s) installed
- Common models: `llama3.2:1b`, `llama3.2:3b`, `mistral:7b`, etc.

## Popular External Ollama Providers

### Self-Hosted Options

**1. Cloud VM with Ollama**:
```bash
# On your cloud server (Ubuntu/Debian)
curl -fsSL https://ollama.ai/install.sh | sh

# Start Ollama server (accessible externally)
OLLAMA_HOST=0.0.0.0:11434 ollama serve

# Pull models
ollama pull llama3.2:1b
ollama pull mistral:7b
```

**2. Docker on Remote Server**:
```bash
# On remote server
docker run -d \
  --name ollama \
  -p 11434:11434 \
  -v ollama:/root/.ollama \
  ollama/ollama

# Pull models
docker exec ollama ollama pull llama3.2:1b
```

### Cloud Platforms

**1. RunPod**: GPU instances with Ollama pre-installed  
**2. Vast.ai**: Cheap GPU rentals with custom Ollama setups  
**3. AWS/GCP/Azure**: VM instances with manual Ollama installation  

### Managed Services

**1. Ollama Cloud** (when available): Official hosted service  
**2. Third-party providers**: Various companies offering Ollama-compatible APIs  

## Security Considerations

### 1. Authentication
```env
# Use API keys for production
OLLAMA_API_KEY=your-secure-token-here
```

### 2. HTTPS/TLS
```env
# Always use HTTPS in production
OLLAMA_BASE_URL=https://your-service.com
OLLAMA_VERIFY_SSL=true
```

### 3. Network Security
- Use VPN or private networks when possible
- Restrict access to your Ollama service
- Consider firewall rules and IP whitelisting

### 4. Data Privacy
- Ensure your external service provider meets your privacy requirements
- Consider data residency and compliance requirements
- Review logs and data retention policies

## Troubleshooting

### Configuration Validator

Use the included validation script to test your external Ollama configuration:

```bash
# Test your configuration
python validate_ollama_config.py

# This will test:
# ✅ Connection to external service
# ✅ Health check endpoint
# ✅ Available models
# ✅ Text generation functionality
# ✅ Response quality
```

### Connection Issues

**Problem**: "Provider unavailable" error  
**Solutions**:
```bash
# Test connectivity manually
curl https://your-ollama-service.com/api/tags

# Check DNS resolution
nslookup your-ollama-service.com

# Test with timeout
curl --max-time 30 https://your-ollama-service.com/api/tags
```

**Problem**: SSL certificate errors  
**Solutions**:
```env
# For development with self-signed certs
OLLAMA_VERIFY_SSL=false

# Or add certificate to system trust store
```

### Authentication Issues

**Problem**: 401/403 errors  
**Solutions**:
```bash
# Test with API key
curl -H "Authorization: Bearer your-token" \
     https://your-ollama-service.com/api/tags

# Verify token format and permissions
```

### Performance Issues

**Problem**: Slow responses or timeouts  
**Solutions**:
```env
# Increase timeout for slow networks/models
OLLAMA_TIMEOUT=120

# Use smaller/faster models
OLLAMA_MODEL=llama3.2:1b
```

### Model Issues

**Problem**: "Model not found" errors  
**Solutions**:
```bash
# Check available models on remote service
curl https://your-ollama-service.com/api/tags

# Pull missing models on remote service
# (depends on your remote service access)
```

## Health Monitoring

The application automatically monitors external Ollama health:

- **Green dot** in UI = Service healthy and responsive
- **Red dot** in UI = Service unavailable or unhealthy
- Check browser console for detailed error messages
- Monitor backend logs for connection issues

## Performance Optimization

### 1. Model Selection
```env
# Faster models for real-time use
OLLAMA_MODEL=llama3.2:1b

# More accurate models for batch processing
OLLAMA_MODEL=llama3.2:3b
```

### 2. Timeouts
```env
# Adjust based on your network and model speed
OLLAMA_TIMEOUT=30  # Fast local network
OLLAMA_TIMEOUT=60  # Internet connection
OLLAMA_TIMEOUT=120 # Slow network or large models
```

### 3. Connection Pooling
The application automatically handles connection pooling and reuse for better performance.

## Migration from Local to External

### 1. Test External Service
```bash
# Test your external service first
curl https://your-ollama-service.com/api/tags
```

### 2. Update Configuration
```env
# Switch to external mode
OLLAMA_EXTERNAL=true
OLLAMA_BASE_URL=https://your-ollama-service.com
```

### 3. Restart Application
```bash
docker compose down
docker compose up
```

### 4. Verify Health
- Check the UI health indicator
- Test AI corrections functionality
- Monitor logs for any issues

## Cost Optimization

### Self-Hosted Options
- Use spot/preemptible instances for cost savings
- Scale down during off-hours
- Share instances across multiple applications

### Cloud Services
- Monitor usage and set billing alerts
- Choose appropriate instance sizes
- Consider reserved instances for steady workloads

## Support

If you encounter issues with external Ollama configuration:

1. **Check the logs**: `docker compose logs backend`
2. **Test connectivity**: Use curl to verify external service
3. **Review configuration**: Ensure all required settings are correct
4. **Check health endpoint**: Visit `/api/ai/health` in your browser
5. **Community support**: Check GitHub issues for similar problems

## Example Configurations

### Local Development with Remote Ollama
```env
DEBUG=true
OLLAMA_EXTERNAL=true
OLLAMA_BASE_URL=http://192.168.1.100:11434
OLLAMA_MODEL=llama3.2:1b
OLLAMA_VERIFY_SSL=false
```

### Production with Secure External Service
```env
DEBUG=false
OLLAMA_EXTERNAL=true
OLLAMA_BASE_URL=https://ollama.yourcompany.com
OLLAMA_MODEL=llama3.2:3b
OLLAMA_API_KEY=prod-token-here
OLLAMA_VERIFY_SSL=true
OLLAMA_TIMEOUT=60
```

### Hybrid Setup (External + OpenRouter Fallback)
```env
OLLAMA_EXTERNAL=true
OLLAMA_BASE_URL=https://your-ollama.com
DEFAULT_LLM_PROVIDER=ollama

# Fallback to OpenRouter if Ollama fails
OPENROUTER_API_KEY=sk-or-v1-your-key
```

---

This configuration makes your Audio Transcription application much more flexible and scalable by supporting external Ollama services while maintaining full compatibility with the existing local setup.