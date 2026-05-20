# Deployment Guide

## Prerequisites

- **Node.js** 18+ and npm 9+
- **Telegram Bot Token** (from [@BotFather](https://t.me/botfather))
- **OpenRouter API Key** (from [openrouter.ai](https://openrouter.ai/keys))
- **Server/VPS** (any Linux/Windows/macOS with Node.js)

## Quick Start (Local Development)

### 1. Clone & Install

```bash
git clone <repository-url>
cd telegram-ai-bot
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```env
BOT_TOKEN=your_telegram_bot_token
OPENROUTER_API_KEY=your_openrouter_api_key

NODE_ENV=development
LOG_LEVEL=debug
SESSION_TIMEOUT=3600000
MAX_HISTORY_LENGTH=20
RATE_LIMIT_MESSAGES=20
RATE_LIMIT_IMAGES=5
```

### 3. Run Locally

**Development** (with auto-reload):
```bash
npm run dev
```

Expected output:
```
✅ Bot started successfully!
Bot: @YourBotUsername
ID: 1234567890
Name: YourBotName
============================================================
Bot is now listening for messages...
```

**Type Check**:
```bash
npm run type-check
```

**Lint**:
```bash
npm run lint
```

### 4. Test

1. Open Telegram, search for your bot (@YourBotUsername)
2. Send `/start` → Should see welcome message
3. Send `/help` → Should see command list
4. Send text message → Should get streaming AI response
5. Send `/new` → Should clear history

## Production Deployment

### Option 1: PM2 (Recommended for VPS/Dedicated Servers)

#### Setup

```bash
# Install PM2 globally
npm install -g pm2

# Build project
npm run build

# Start with PM2
pm2 start dist/index.js --name "telegram-ai-bot"

# Verify running
pm2 list
pm2 logs telegram-ai-bot

# Setup auto-restart on reboot
pm2 startup
pm2 save
```

#### Configuration File (ecosystem.config.js)

For more control, create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'telegram-ai-bot',
      script: './dist/index.js',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
    },
  ],
};
```

Start:
```bash
pm2 start ecosystem.config.js
pm2 startup
pm2 save
```

#### PM2 Commands

```bash
pm2 start telegram-ai-bot          # Start
pm2 stop telegram-ai-bot           # Stop
pm2 restart telegram-ai-bot        # Restart
pm2 delete telegram-ai-bot         # Remove
pm2 logs telegram-ai-bot           # View logs (live)
pm2 logs telegram-ai-bot --lines 50 # View last 50 lines
pm2 monit                          # Monitor (CPU, memory)
```

#### Updating Code with PM2

```bash
git pull origin master
npm install
npm run build
pm2 restart telegram-ai-bot
```

### Option 2: Docker (Recommended for Containers/Cloud)

#### Dockerfile

Create `Dockerfile` in project root:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Create logs directory
RUN mkdir -p logs

# Expose port (for future webhook mode)
EXPOSE 3000

# Run bot
CMD ["node", "dist/index.js"]
```

#### .dockerignore

```
node_modules
npm-debug.log
.env
.env.local
dist
logs
.git
.gitignore
README.md
```

#### Build & Run

```bash
# Build image
docker build -t telegram-ai-bot:latest .

# Run container with env file
docker run -d \
  --name telegram-ai-bot \
  --restart unless-stopped \
  --env-file .env \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/uploads:/app/uploads \
  telegram-ai-bot:latest

# View logs
docker logs -f telegram-ai-bot

# Stop container
docker stop telegram-ai-bot

# Remove container
docker rm telegram-ai-bot
```

#### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  telegram-ai-bot:
    build: .
    container_name: telegram-ai-bot
    restart: unless-stopped
    env_file: .env
    volumes:
      - ./logs:/app/logs
      - ./uploads:/app/uploads
    environment:
      NODE_ENV: production
      LOG_LEVEL: info
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

Run:
```bash
docker-compose up -d
docker-compose logs -f
docker-compose down
```

### Option 3: Systemd Service (Linux VPS)

Create `/etc/systemd/system/telegram-ai-bot.service`:

```ini
[Unit]
Description=Telegram AI Bot
After=network.target

[Service]
Type=simple
User=botuser
WorkingDirectory=/home/botuser/telegram-ai-bot
Environment="NODE_ENV=production"
EnvironmentFile=/home/botuser/telegram-ai-bot/.env
ExecStart=/usr/bin/node /home/botuser/telegram-ai-bot/dist/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Enable & Start:

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable auto-start on boot
sudo systemctl enable telegram-ai-bot

# Start service
sudo systemctl start telegram-ai-bot

# View status
sudo systemctl status telegram-ai-bot

# View logs
journalctl -u telegram-ai-bot -f

# Stop service
sudo systemctl stop telegram-ai-bot
```

## Environment Configuration

### Required Variables

| Variable | Example | Notes |
|----------|---------|-------|
| `BOT_TOKEN` | `123456789:ABCdefGHIjklMNOpqrsTUVwxyz` | From @BotFather |
| `OPENROUTER_API_KEY` | `sk-or-xxxxx...` | From openrouter.ai |

### Optional Variables (Production Tuning)

| Variable | Default | Recommended | Notes |
|----------|---------|-------------|-------|
| `NODE_ENV` | `development` | `production` | Production mode |
| `LOG_LEVEL` | `info` | `warn` or `error` | Reduce log verbosity |
| `SESSION_TIMEOUT` | `3600000` | `3600000` | 1 hour (suitable for most cases) |
| `MAX_HISTORY_LENGTH` | `20` | `20` | Balance memory vs context |
| `RATE_LIMIT_MESSAGES` | `20` | `20` | msgs/minute per user |
| `RATE_LIMIT_IMAGES` | `5` | `5` | images/minute per user |
| `OPENROUTER_TIMEOUT` | `120000` | `120000` | 2 min for free tier cold starts |
| `OPENROUTER_TEXT_MODEL` | `meta-llama/llama-3.3-70b-instruct:free` | Same or upgrade | Text model |
| `OPENROUTER_VISION_MODEL` | `google/gemma-3-27b-it:free` | Same or upgrade | Image analysis model |
| `OPENROUTER_TEMPERATURE` | `0.7` | `0.7` | Creativity (0-2) |
| `OPENROUTER_MAX_TOKENS` | `2048` | `2048` | Response length |
| `SHOW_TYPING_INDICATOR` | `true` | `true` | UX feature |
| `OPENROUTER_APP_URL` | — | `https://yoursite.com` | OpenRouter ranking (optional) |
| `OPENROUTER_APP_TITLE` | — | `My AI Bot` | OpenRouter ranking (optional) |

### .env File Best Practices

**Create `.env.example`** (committed to git):
```env
BOT_TOKEN=your_telegram_bot_token_here
OPENROUTER_API_KEY=your_openrouter_api_key_here

NODE_ENV=production
LOG_LEVEL=info
SESSION_TIMEOUT=3600000
MAX_HISTORY_LENGTH=20
RATE_LIMIT_MESSAGES=20
RATE_LIMIT_IMAGES=5
```

**Never commit `.env`** with real credentials:
```bash
# Add to .gitignore
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
echo "logs/" >> .gitignore
echo "uploads/" >> .gitignore
echo "dist/" >> .gitignore
```

## Pre-Deployment Checklist

- [ ] Node.js 18+ installed
- [ ] All dependencies installed (`npm install`)
- [ ] `.env` file created with real credentials
- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] No linting errors (`npm run lint`)
- [ ] Manual testing completed (all commands, text, images, files)
- [ ] `NODE_ENV=production` in `.env`
- [ ] `LOG_LEVEL=warn` or `info` (not `debug`)
- [ ] Logs directory writable (`./logs/`)
- [ ] Uploads directory writable (`./uploads/`)

## Post-Deployment Verification

### 1. Check Bot is Responding

```bash
# From Telegram, send /start
# Should receive welcome message within 5 seconds
```

### 2. Check Logs

```bash
# PM2
pm2 logs telegram-ai-bot

# Docker
docker logs telegram-ai-bot

# Systemd
journalctl -u telegram-ai-bot -f

# Look for:
# ✅ Bot started successfully!
# Bot is now listening for messages...
```

### 3. Test Message Flow

1. Send `/help` → Check for command list
2. Send text message → Check for streaming response
3. Send image → Check for vision analysis
4. Send PDF → Check for document parsing
5. Check `logs/combined.log` exists
6. Check `logs/error.log` (should be empty or minimal)

### 4. Monitor Memory Usage

```bash
# PM2
pm2 monit

# Docker
docker stats telegram-ai-bot

# Target: <100MB per 100 sessions
```

## Troubleshooting

### Bot Not Responding

**Check 1: BOT_TOKEN Valid?**
```bash
# Test with curl
curl -s "https://api.telegram.org/bot{BOT_TOKEN}/getMe" | jq .ok
# Should output: true
```

**Check 2: Logs**
```bash
tail -f logs/error.log
# Look for authentication or parsing errors
```

**Check 3: Process Running?**
```bash
# PM2
pm2 list

# Docker
docker ps | grep telegram-ai-bot

# Systemd
systemctl status telegram-ai-bot
```

### OpenRouter API Errors

**"Unauthorized (401)"**
- Verify `OPENROUTER_API_KEY` is correct
- Check key hasn't expired in OpenRouter dashboard
- Ensure key starts with `sk-or-`

**"Rate Limited (429)"**
- Check OpenRouter quota/balance
- Adjust `RATE_LIMIT_MESSAGES` and `RATE_LIMIT_IMAGES` if needed
- Consider upgrading from free to paid models

**"Timeout (120s)"**
- Expected on free tier (cold starts 60–120s)
- Increase `OPENROUTER_TIMEOUT` to 180000 (3 min) if persistent
- Consider paid models for faster responses

### Memory Leaks

**Monitor**:
```bash
pm2 monit
# Memory should stabilize after 1 hour
```

**If Growing**:
1. Check `SESSION_TIMEOUT` (default 1 hour) — may need shorter
2. Verify uploaded files are being cleaned up
3. Check conversation history truncation (MAX_HISTORY_LENGTH)
4. Restart bot: `pm2 restart telegram-ai-bot`

### Message Not Updating During Streaming

**Cause**: Telegram "content too similar" error
**Solution**: 1s throttle already in place (`text.handler.ts` line 78)

**If Still Happening**:
- Increase throttle: `UPDATE_INTERVAL = 2000` in `text.handler.ts`
- Rebuild: `npm run build`
- Restart: `pm2 restart telegram-ai-bot`

### Large File Upload Fails

**Check**: File size <10MB
```bash
# In logs/error.log, look for:
# "File too large: {size} > 10485760"
```

**Adjust**:
```env
# In .env, MAX_FILE_SIZE not exposed, but limits.ts has:
# MAX_DOCUMENT_SIZE: 50 * 1024 * 1024
# This is Telegram's limit, not configurable
```

### PDF/DOCX Not Parsing

**Check**: File format valid
```bash
# In logs/error.log, look for parse errors
# Example: "Failed to parse PDF: Invalid PDF structure"
```

**Solution**:
1. Test with sample PDF from internet
2. If specific PDFs fail, they may be corrupted or encrypted
3. Check `file-parser.ts` for detailed error

## Scaling Strategies

### For <1k Concurrent Users (Current)

- **Single Node.js instance** with PM2 or Systemd
- **In-memory sessions** (Map-based)
- **Long polling** (not webhook)
- **Local file storage** for uploads

### For 1k–10k Users (Phase 2)

- **Redis session storage** (replace Map)
- **Still single Node.js** (but with persistent storage)
- **Or multiple instances** behind load balancer (Redis shared)

### For 10k+ Users (Phase 3+)

- **Webhook mode** instead of long polling
- **Load balancer** (nginx, HAProxy)
- **Multiple Node.js instances**
- **Redis for sessions**
- **Database for analytics** (PostgreSQL, MongoDB)
- **Message queue** for backpressure (Bull, RabbitMQ)

## Monitoring & Logging

### Log Files

```
logs/
├── combined.log    # All logs (info level)
└── error.log       # Errors only
```

**Rotation** (optional, using winston-daily-rotate-file):
```typescript
// Add to logger.ts if needed
const DailyRotateFile = require('winston-daily-rotate-file');
transports.push(new DailyRotateFile({
  filename: 'logs/app-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
}));
```

### Key Metrics to Monitor

| Metric | Tool | Target |
|--------|------|--------|
| **Uptime** | PM2, Docker stats | >99% |
| **Memory** | `pm2 monit`, `docker stats` | <100MB per 100 sessions |
| **Response Time** | Check logs | <2s (text), <3s (image) |
| **Error Rate** | `logs/error.log` | <1% |
| **API Calls** | `logs/combined.log` | Track cost |

### Health Check Endpoint (Future)

For webhook mode, add health check:
```typescript
// src/bot/health.ts
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: Date.now() });
});
```

## Security Hardening

### Production Checklist

- [ ] Never commit `.env` with credentials
- [ ] Use strong, unique OpenRouter API key
- [ ] Rotate bot token if compromised
- [ ] Enable firewall on VPS (only port 443 if webhook)
- [ ] Keep Node.js updated (`nvm install 20`)
- [ ] Keep dependencies updated (`npm audit fix`)
- [ ] Monitor logs for suspicious activity
- [ ] Rate limit enabled and reasonable
- [ ] Error messages don't expose stack traces (CHECK)

### Rate Limiting

Default: 20 messages/min, 5 images/min per user.

**Adjust in `.env`**:
```env
RATE_LIMIT_MESSAGES=30  # Allow 30/min if relaxed
RATE_LIMIT_IMAGES=10    # Allow 10/min if relaxed
```

### Bot Restart Safety

Graceful shutdown (SIGTERM/SIGINT):
1. Stop accepting new messages
2. Finish current handlers
3. Save all sessions
4. Close connections
5. Exit with code 0

**Handled automatically** in `src/index.ts`.

## Cost Optimization

### Model Selection

**Free Tier** (default):
- `meta-llama/llama-3.3-70b-instruct:free` (text)
- `google/gemma-3-27b-it:free` (vision)
- Cost: $0 (but slow cold starts 60–120s)

**Budget Tier**:
- `mistral-7b:free` (faster than llama)
- Cost: $0 (check OpenRouter rankings)

**Balanced**:
- `gpt-3.5-turbo:free` (via OpenRouter)
- `claude-2:free` (via OpenRouter)
- Cost: $0 (limited quota)

**Production**:
- `gpt-4o` ($0.005 per 1k input, $0.015 per 1k output)
- `claude-3-opus` ($0.015/$0.075)
- Cost: Monitor API usage in OpenRouter dashboard

**Switch Model**:
```env
OPENROUTER_TEXT_MODEL=gpt-3.5-turbo
OPENROUTER_VISION_MODEL=claude-3-opus
```

### Traffic Management

- Monitor API calls in `logs/combined.log`
- Calculate monthly cost: (messages × tokens/msg × model_price)
- Set budget alerts in OpenRouter dashboard
- Consider token limits if cost unexpected

## Backup & Recovery

### Session Backup (Phase 2+)

Currently, sessions are **not persistent** (lost on restart with in-memory storage).

**To Enable Persistence**:
1. Add Redis integration to `storage.service.ts`
2. Sessions auto-save to Redis
3. On restart, sessions restored from Redis

### Database Backup

When analytics database added (Phase 3):
```bash
# PostgreSQL
pg_dump dbname > backup.sql
psql dbname < backup.sql

# MongoDB
mongodump --uri="mongodb://..." --out ./backup
mongorestore --uri="mongodb://..." ./backup
```

### Code Backup

```bash
git push origin main
# Or deploy from GitHub directly
```

## Maintenance Tasks

### Weekly

- Check `logs/error.log` for recurring errors
- Monitor memory usage (`pm2 monit`)
- Verify bot responding to test messages

### Monthly

- Update dependencies: `npm update`
- Check for security advisories: `npm audit`
- Review API costs in OpenRouter dashboard
- Backup database (if applicable)

### Quarterly

- Update Node.js if new version available
- Review and tune rate limits
- Test graceful shutdown
- Rehearse disaster recovery
