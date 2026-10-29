#!/usr/bin/env bash
# Bootstrap the WuppyCMS host after create-lightsail.sh.
#
# SSH into the instance and run:
#   ssh -i ~/.ssh/lightsail-default-key.pem ubuntu@<IP>
#   git clone https://github.com/fuatcangnc/wuppycms.git /opt/wuppycms
#   bash /opt/wuppycms/scripts/aws/bootstrap-lightsail.sh
#
# The Cloudflare workerd runtime is used via `wrangler dev --local` with a
# persistent D1/R2 state. This keeps the existing Cloudflare-compatible code
# working on the Lightsail VM; the site-template is served as static files.
set -euo pipefail

APP_DIR="/opt/wuppycms"
DATA_DIR="/var/lib/wuppycms"
SITE_DIR="/var/www/wuppycms-site"
REPO="https://github.com/fuatcangnc/wuppycms.git"
PNPM_VERSION="12.11.2"

echo "== packages"
sudo apt-get update
sudo apt-get install -y git curl ca-certificates caddy
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo corepack enable
sudo corepack prepare "pnpm@${PNPM_VERSION}" --activate

echo "== dirs"
sudo mkdir -p "$APP_DIR" "$DATA_DIR" "$SITE_DIR"
sudo chown -R ubuntu:ubuntu "$APP_DIR" "$DATA_DIR" "$SITE_DIR"

echo "== repo"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO" "$APP_DIR"
fi
cd "$APP_DIR"
git pull --ff-only

echo "== dependencies"
pnpm install

echo "== static site"
pnpm --dir apps/site-template install
pnpm --dir apps/site-template build
sudo rm -rf "$SITE_DIR"/*
sudo cp -a apps/site-template/dist/. "$SITE_DIR"/

echo "== builder"
pnpm --filter @wuppycms/builder build

echo "== D1 migrations (local persistent D1)"
pnpm --dir apps/builder exec wrangler d1 migrations apply wuppycms \
  --local --persist-to "$DATA_DIR/.wrangler/state"

echo "== systemd"
sudo tee /etc/systemd/system/wuppycms.service >/dev/null <<EOF
[Unit]
Description=WuppyCMS builder (Cloudflare workerd on Lightsail)
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=$APP_DIR/apps/builder
Environment=HOME=/home/ubuntu
Environment=PNPM_HOME=/home/ubuntu/.local/share/pnpm
Environment=PATH=/home/ubuntu/.local/share/pnpm:/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/bin/pnpm exec wrangler dev --local --ip 0.0.0.0 --port 8787 --persist-to $DATA_DIR/.wrangler/state
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

echo "== Caddy"
sudo tee /etc/caddy/Caddyfile >/dev/null <<'EOF'
wuppycms.com, www.wuppycms.com {
	root * /var/www/wuppycms-site
	encode gzip
	try_files {path} {path}/ /index.html
	file_server
}

docs.wuppycms.com, test.wuppycms.com {
	root * /var/www/wuppycms-site
	encode gzip
	try_files {path} {path}/ /index.html
	file_server
}

app.wuppycms.com {
	reverse_proxy 127.0.0.1:8787
}
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now wuppycms
sudo systemctl reload caddy 2>/dev/null || sudo systemctl restart caddy

cat <<MSG

Bootstrap complete.
Add the real secrets to $APP_DIR/apps/builder/.dev.vars, then:
  sudo systemctl restart wuppycms

Required values:
  GITHUB_TOKEN=...
  BETTER_AUTH_SECRET=...
  TOKEN_ENCRYPTION_KEY=...
  BETTER_AUTH_URL=https://app.wuppycms.com
  SITE_TEMPLATE_REPO=fuatcangnc/wuppycms-tailwind-starter

MSG
