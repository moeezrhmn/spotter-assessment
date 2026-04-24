#!/bin/bash
# Redeploy script — run this every time you push new code.
# Usage: bash deploy.sh (run as root on the VPS)

set -e

APP_DIR=/var/www/spotter
export PATH="$HOME/.local/bin:$PATH"

echo "==> Pulling latest code..."
cd $APP_DIR
git pull origin main

echo "==> Updating backend dependencies..."
cd $APP_DIR/backend
uv pip install -r requirements.txt

echo "==> Running migrations and collectstatic..."
.venv/bin/python manage.py migrate
.venv/bin/python manage.py collectstatic --noinput

echo "==> Rebuilding frontend..."
cd $APP_DIR/frontend
npm install
VITE_API_URL=https://trip-api.quanter.dev npm run build

echo "==> Restarting backend service..."
systemctl restart spotter-backend

echo "==> Reloading nginx..."
nginx -t && systemctl reload nginx

echo "==> Deploy complete!"
systemctl status spotter-backend --no-pager
