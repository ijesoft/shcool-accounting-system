# Deployment Guide

## Prerequisites

- Docker & Docker Compose
- Node.js 20+ & npm
- PM2 (`npm i -g pm2`)
- OpenVPN client connected to `10.8.0.0/24` network

## Architecture

```
nginx (10.8.0.1) → school-accounting (10.8.0.2:3002)
                         ↓
                    PostgreSQL (localhost:5440, docker)
```

## 1. PostgreSQL (Docker)

```bash
# Start the database container
cd /home/ubuntu/Github/shcool-accounting-system/docker
docker compose up -d db
```

The database runs on `localhost:5440` with the following credentials:

| Setting     | Value                    |
| ----------- | ------------------------ |
| Host        | localhost                |
| Port        | 5440                     |
| Database    | school_accounting        |
| User        | postgres                 |
| Password    | postgres                 |

## 2. Run Migrations

```bash
# Run Prisma migrations
cd /home/ubuntu/Github/shcool-accounting-system
npx prisma db push --schema prisma/schema.prisma
```

Or use the Docker migration service:

```bash
cd /home/ubuntu/Github/shcool-accounting-system/docker
docker compose up migrate
```

## 3. Next.js App (PM2)

The PM2 ecosystem config is at `ecosystem.config.js` with the following environment variables:

| Variable         | Value                                                              |
| ---------------- | ------------------------------------------------------------------ |
| DATABASE_URL     | postgresql://postgres:postgres@localhost:5440/school_accounting?schema=public |
| SESSION_SECRET   | school-accounting-secret-key-32chars                               |
| NODE_ENV         | production                                                         |

### Start the app

```bash
cd /home/ubuntu/Github/shcool-accounting-system
pm2 start ecosystem.config.js
```

### Save process list (survives reboot)

```bash
pm2 save
```

### Setup PM2 auto-start on boot

```bash
pm2 startup
# Follow the command output to enable the systemd service
```

### PM2 commands

```bash
pm2 status school-accounting    # Check status
pm2 logs school-accounting      # View logs
pm2 restart school-accounting   # Restart
pm2 stop school-accounting      # Stop
```

## 4. Firewall

Allow nginx proxy access from `10.8.0.1`:

```bash
sudo ufw allow from 10.8.0.1 to any port 3002 comment "demo.ijesoft.app from jerome nginx proxy"
```

## 5. Nginx Config (on 10.8.0.1)

```nginx
server {
    listen 443 ssl;
    http2 on;
    server_name demo.ijesoft.app;

    ssl_certificate     /etc/letsencrypt/live/demo.ijesoft.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/demo.ijesoft.app/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 50M;

    location / {
        proxy_pass         http://10.8.0.2:3002;
        proxy_http_version 1.1;
        proxy_set_header   Host              $http_host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        upgrade;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300;
    }
}
```

## 6. OpenVPN

Connect to the OpenVPN network so the nginx server can reach this machine:

```bash
sudo openvpn --config /home/ubuntu/isaac-server.ovpn
```

This machine gets IP `10.8.0.2` on the `10.8.0.0/24` network.

## Full Start Sequence

```bash
# 1. Connect OpenVPN
sudo openvpn --config /home/ubuntu/isaac-server.ovpn

# 2. Start PostgreSQL
cd /home/ubuntu/Github/shcool-accounting-system/docker
docker compose up -d db

# 3. Run migrations
cd /home/ubuntu/Github/shcool-accounting-system
npx prisma db push

# 4. Start Next.js app
pm2 start ecosystem.config.js

# 5. Allow firewall rule (one-time)
sudo ufw allow from 10.8.0.1 to any port 3002 comment "demo.ijesoft.app from jerome nginx proxy"

# 6. Save PM2
pm2 save
```

## Verify

```bash
# Check app is running
curl -sI https://demo.ijesoft.app/
# Expected: HTTP/2 307 → /login
```
