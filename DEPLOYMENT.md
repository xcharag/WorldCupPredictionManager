# Deployment Guide

## Coolify Deployment

The `docker-compose.yml` follows Coolify's standard pattern:

### Network Architecture
- **Backend**: Internal `app-net` only (not exposed)
- **Frontend**: Both `app-net` + `coolify` network (exposed via Traefik)
- Includes 120s timeout labels for OAuth and slow connections
- Health checks configured with appropriate start periods

### Quick Deploy to Coolify

1. Create new service from Git repository
2. Set environment variables (see below)
3. Deploy - Coolify auto-generates routing labels
4. Access via your domain

### Required Environment Variables

```env
# URLs (match your Coolify domain)
FRONTEND_URL=https://your-domain.com
BACKEND_URL=https://your-domain.com

# Database
MONGODB_URI=mongodb://user:password@host:port/worldcup2026

# JWT
JWT_SECRET=your-super-long-random-secret-key
JWT_EXPIRES_IN=7d

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Email
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM="Mundial 2026 <your-email@gmail.com>"
```

---

## Gateway Timeout Issues (504 errors)

The docker-compose.yml includes 120s timeout labels, but if you still experience timeouts:

### Solution 1: Increase Coolify/Traefik Timeouts

Add these labels to your Coolify deployment or `docker-compose.yml`:

```yaml
services:
  frontend:
    labels:
      # Increase Traefik timeouts (Coolify uses Traefik)
      - "traefik.http.services.your-app.loadbalancer.server.timeout.read=120s"
      - "traefik.http.services.your-app.loadbalancer.server.timeout.write=120s"
      - "traefik.http.services.your-app.loadbalancer.server.timeout.idle=120s"
```

**Or in Coolify UI:**
1. Go to your service → Advanced → Labels
2. Add:
   - `traefik.http.services.your-service-name.loadbalancer.server.timeout.read=120s`
   - `traefik.http.services.your-service-name.loadbalancer.server.timeout.write=120s`

### Solution 2: Environment-Specific Settings

For production, ensure these environment variables are set properly:

```env
# Backend
NODE_ENV=production
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://your-domain.com
BACKEND_URL=https://your-domain.com

# MongoDB connection
MONGODB_URI=mongodb://user:pass@host:port/dbname
# Add connection timeout if needed
# MONGODB_URI=mongodb://user:pass@host:port/dbname?connectTimeoutMS=10000&socketTimeoutMS=45000
```

### Solution 3: Health Check Configuration

Ensure your health checks don't interfere with application startup:

```yaml
healthcheck:
  test: ["CMD", "wget", "-qO-", "http://localhost:5000/api/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s  # Give backend time to connect to MongoDB
```

### Solution 4: Check Backend Logs

Common causes of slow responses:
- MongoDB connection timeout
- Redis connection timeout  
- External API calls (Football-data.org, email service)
- Memory/CPU limits too low

Check logs with:
```bash
docker compose logs -f backend
```

Look for:
- `MongoDB connected` - should appear quickly
- `[Redis] Connected` - should appear quickly
- Any uncaught errors or warnings

### Solution 5: Resource Limits

Ensure adequate resources in `docker-compose.yml`:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

## Common 504 Scenarios

### Scenario 1: Google OAuth Timeout
**Symptom**: Users click "Continue with Google" and get 504 after redirect  
**Cause**: OAuth callback takes too long  
**Fix**: Increase Traefik read timeout to 120s (see Solution 1)

### Scenario 2: Initial Page Load Timeout
**Symptom**: First visit to site gets 504, subsequent visits work  
**Cause**: Backend warming up / MongoDB connection  
**Fix**: Increase health check `start_period` to 60s

### Scenario 3: /api/auth/me Timeout
**Symptom**: Users logged out randomly with network errors  
**Cause**: Token validation timing out  
**Fix**: Check MongoDB performance, add indexes:

```javascript
// In backend/src/models/User.js - ensure these indexes exist
userSchema.index({ email: 1 });
userSchema.index({ nickname: 1 });
userSchema.index({ googleId: 1 }, { sparse: true });
```

### Scenario 4: Slow Database Queries
Add indexes to frequently queried fields. Run in MongoDB:

```javascript
db.users.createIndex({ email: 1 })
db.users.createIndex({ nickname: 1 })
db.users.createIndex({ googleId: 1 }, { sparse: true })
db.matches.createIndex({ matchDate: 1 })
db.matchpredictions.createIndex({ user: 1, match: 1 })
db.tournamentpredictions.createIndex({ user: 1, group: 1 })
```

## Monitoring

Add these to your backend `.env` to help debug:

```env
# Enable detailed logging
DEBUG=express:*
NODE_ENV=production
```

Then check which requests are slow:
```bash
docker compose logs backend | grep "ms"
```

## Performance Optimization

### 1. Enable Redis Caching
Redis is already configured but optional. Ensure `REDIS_URL` is set:
```env
REDIS_URL=redis://user:password@host:port/db
```

### 2. MongoDB Connection Pooling
Already configured in `backend/src/config/db.js`:
```javascript
maxPoolSize: 10,
serverSelectionTimeoutMS: 10000,
socketTimeoutMS: 45000,
```

### 3. Nginx Buffering
Already enabled in `frontend/nginx.conf` with optimized settings.

## Still Having Issues?

1. Check Coolify service logs
2. Verify all environment variables are set correctly
3. Ensure MongoDB and Redis are accessible from backend
4. Test backend health endpoint: `curl https://your-domain.com/api/health`
5. Monitor backend response times in logs
