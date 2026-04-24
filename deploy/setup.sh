#!/bin/bash
# First-time server setup. Run once as root on your Ubuntu VPS.
# Usage: bash setup.sh <your-github-repo-url>
# Example: bash setup.sh https://github.com/yourname/spotter-assesment-task.git

set -e

REPO_URL=${1:?"Usage: bash setup.sh <github-repo-url>"}
APP_DIR=/var/www/spotter

echo "==> Installing system packages..."
apt update && apt upgrade -y
apt install -y nginx git python3 python3-pip python3-venv curl nodejs npm

echo "==> Installing uv..."
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"

echo "==> Cloning repo..."
mkdir -p $APP_DIR
git clone "$REPO_URL" $APP_DIR
chown -R www-data:www-data $APP_DIR

echo "==> Setting up Python virtualenv..."
cd $APP_DIR/backend
uv venv .venv
uv pip install -r requirements.txt

echo "==> Creating .env file..."
cat > $APP_DIR/backend/.env <<EOF
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))")
DEBUG=False
ALLOWED_HOSTS=trip-api.quanter.dev
ORS_API_KEY=REPLACE_ME
CORS_ALLOWED_ORIGINS=https://trip.quanter.dev
EOF
echo ">>> IMPORTANT: edit $APP_DIR/backend/.env and set ORS_API_KEY"

echo "==> Running migrations and collectstatic..."
cd $APP_DIR/backend
.venv/bin/python manage.py migrate
.venv/bin/python manage.py collectstatic --noinput

echo "==> Building frontend..."
cd $APP_DIR/frontend
npm install
VITE_API_URL=https://trip-api.quanter.dev npm run build

echo "==> Setting up log directory..."
mkdir -p /var/log/spotter
chown www-data:www-data /var/log/spotter

echo "==> Installing systemd service..."
cp $APP_DIR/deploy/spotter-backend.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable spotter-backend
systemctl start spotter-backend

echo "==> Configuring nginx..."
cp $APP_DIR/deploy/nginx.conf /etc/nginx/sites-available/spotter
ln -sf /etc/nginx/sites-available/spotter /etc/nginx/sites-enabled/spotter
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo ""
echo "==> Done! Next steps:"
echo "  1. Edit $APP_DIR/backend/.env and set ORS_API_KEY"
echo "  2. In Cloudflare: add A records for trip.quanter.dev and trip-api.quanter.dev pointing to this server's IP"
echo "  3. Set Cloudflare SSL mode to 'Full' for both subdomains"
echo "  4. Run: systemctl restart spotter-backend"
