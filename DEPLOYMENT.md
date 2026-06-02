# Deployment Guide — School Accounting System

## Prerequisites

- **Ubuntu 24.04** (or similar Debian-based distro)
- **Node.js 20+** (via nvm or NodeSource)
- **PostgreSQL 16+**
- **Git**

---

## 1. Install Node.js

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc

# Install Node.js 20 LTS
nvm install 20
nvm use 20
nvm alias default 20
```

## 2. Install PostgreSQL

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Set postgres password
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
```

## 3. Clone the Repository

```bash
cd /opt
sudo git clone https://github.com/ijesoft/shcool-accounting-system.git
sudo chown -R $(whoami):$(whoami) shcool-accounting-system
cd shcool-accounting-system
```

## 4. Install Dependencies

```bash
npm ci --production
```

## 5. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/school_accounting?schema=public"
REDIS_URL="redis://localhost:6379"
SESSION_SECRET="<generate-a-random-32-char-string>"
NEXT_PUBLIC_APP_NAME="School Accounting System"
NEXT_PUBLIC_APP_URL="http://your-domain.com"
DB_PASSWORD=postgres
```

Generate a secure session secret:

```bash
openssl rand -base64 32
```

## 6. Set Up Database

```bash
# Create database
sudo -u postgres psql -c "CREATE DATABASE school_accounting;"

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Seed database (creates roles, permissions, entities, admin user)
npx tsx scripts/seed.ts
```

## 7. Build the Application

```bash
npm run build
```

## 8. Install PM2

```bash
sudo npm install -g pm2

# Start the app with PM2
pm2 start npm --name "school-accounting" -- start

# Save PM2 process list (survives reboots)
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

## 9. Verify Deployment

```bash
# Check PM2 status
pm2 status
pm2 logs school-accounting

# Test the app
curl http://localhost:3000/api/v1/health 2>/dev/null || \
curl http://localhost:3000
```

## 10. (Optional) Set Up Reverse Proxy with Nginx

```bash
sudo apt install -y nginx

sudo tee /etc/nginx/sites-available/school-accounting <<EOF
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/school-accounting /etc/nginx/sites-enabled/
sudo systemctl restart nginx
```

## 11. (Optional) Set Up SSL with Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## PM2 Commands Reference

```bash
# View status
pm2 status

# View logs
pm2 logs school-accounting

# Restart
pm2 restart school-accounting

# Stop
pm2 stop school-accounting

# Delete from PM2
pm2 delete school-accounting

# Monitor
pm2 monit

# Show app info
pm2 info school-accounting
```

---

## Default Login

- **Email:** admin@school.edu
- **Password:** admin123

---

## Troubleshooting

### PostgreSQL not running

```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Build fails — out of memory

```bash
# Increase Node.js memory
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

### PM2 app crashes on start

```bash
# Check logs for errors
pm2 logs school-accounting --lines 100

# Common issues:
# - DATABASE_URL incorrect
# - Missing database
# - SESSION_SECRET too short
```

### Port 3000 already in use

```bash
# Find what's using port 3000
sudo lsof -i :3000

# Kill the process
sudo kill -9 <PID>

# Or change the port in .env:
# NEXT_PUBLIC_APP_URL="http://localhost:3001"
# And start with: pm2 start npm --name "school-accounting" -- start -- -p 3001
```
