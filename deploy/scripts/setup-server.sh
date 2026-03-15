#!/usr/bin/env bash
# setup-server.sh — first-time server setup for TaskTime
# Tested on: Ubuntu 22.04 LTS, Astra Linux SE 1.7+, Red OS 7.3+
# Run as root or with sudo privileges

set -euo pipefail

TASKTIME_USER="tasktime"
APP_DIR="/opt/tasktime"

echo "=== TaskTime Server Setup ==="
echo "OS: $(cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2 | tr -d '"')"

# ── 1. Detect package manager ─────────────────────────────────────────────────
if command -v apt-get &>/dev/null; then
  PKG_MANAGER="apt"
elif command -v dnf &>/dev/null; then
  PKG_MANAGER="dnf"
elif command -v yum &>/dev/null; then
  PKG_MANAGER="yum"
else
  echo "ERROR: Unsupported package manager. Install Docker manually."
  exit 1
fi

echo "Package manager: $PKG_MANAGER"

# ── 2. Install Docker + Docker Compose ────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "Installing Docker..."
  if [ "$PKG_MANAGER" = "apt" ]; then
    apt-get update -q
    apt-get install -y -q ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
      https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
      > /etc/apt/sources.list.d/docker.list
    apt-get update -q
    apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-compose-plugin
  else
    # RPM-based: Red OS, CentOS, etc.
    "$PKG_MANAGER" install -y docker docker-compose-plugin
  fi
  systemctl enable --now docker
  echo "Docker installed."
else
  echo "Docker already installed: $(docker --version)"
fi

# ── 3. Create system user ─────────────────────────────────────────────────────
if ! id "$TASKTIME_USER" &>/dev/null; then
  useradd --system --create-home --home-dir "$APP_DIR" --shell /bin/bash "$TASKTIME_USER"
  usermod -aG docker "$TASKTIME_USER"
  echo "Created user: $TASKTIME_USER"
else
  echo "User $TASKTIME_USER already exists."
fi

# ── 4. Create application directory ──────────────────────────────────────────
mkdir -p "$APP_DIR"/{env,logs,backups}
chown -R "$TASKTIME_USER:$TASKTIME_USER" "$APP_DIR"
echo "Application directory: $APP_DIR"

# ── 5. Configure firewall (optional, skip if not available) ──────────────────
if command -v ufw &>/dev/null; then
  ufw allow 80/tcp  comment "TaskTime HTTP"  2>/dev/null || true
  ufw allow 443/tcp comment "TaskTime HTTPS" 2>/dev/null || true
  echo "Firewall rules added (ufw)."
elif command -v firewall-cmd &>/dev/null; then
  firewall-cmd --permanent --add-service=http  2>/dev/null || true
  firewall-cmd --permanent --add-service=https 2>/dev/null || true
  firewall-cmd --reload 2>/dev/null || true
  echo "Firewall rules added (firewalld)."
fi

# ── 6. Setup cron for daily backup ───────────────────────────────────────────
CRON_LINE="0 3 * * * $APP_DIR/deploy/scripts/backup-postgres.sh >> $APP_DIR/logs/backup.log 2>&1"
if ! crontab -u "$TASKTIME_USER" -l 2>/dev/null | grep -q "backup-postgres"; then
  (crontab -u "$TASKTIME_USER" -l 2>/dev/null; echo "$CRON_LINE") | crontab -u "$TASKTIME_USER" -
  echo "Daily backup cron configured (3:00 AM)."
fi

# ── 7. Print next steps ───────────────────────────────────────────────────────
cat <<EOF

=== Setup complete! Next steps: ===

1. Clone the repository (as root or tasktime user):
   git clone https://github.com/your-org/tasktime-mvp.git $APP_DIR/app
   chown -R $TASKTIME_USER:$TASKTIME_USER $APP_DIR/app

2. Configure production environment:
   cp $APP_DIR/app/deploy/env/backend.production.env.example $APP_DIR/env/backend.production.env
   cp $APP_DIR/app/deploy/env/.env.production.example $APP_DIR/env/.env.production
   # Edit both files and fill in secrets

3. Link env files:
   ln -s $APP_DIR/env/backend.production.env $APP_DIR/app/deploy/env/backend.production.env
   ln -s $APP_DIR/env/.env.production $APP_DIR/app/deploy/env/.env.production

4. Deploy:
   cd $APP_DIR/app
   sudo -u $TASKTIME_USER bash deploy/scripts/deploy.sh production

5. Verify:
   curl http://localhost/api/health

EOF
