#!/usr/bin/env bash
# Deploy / cập nhật Jazz Corner trên VPS CentOS 7 (chạy bằng root).
# Theo cách các app khác trên máy chủ này đang chạy: Node ở /opt/node22,
# systemd giữ app, nginx làm proxy, chứng chỉ HTTPS do acme.sh cấp.
#   Lần đầu / cập nhật: bash scripts/deploy-server.sh
# Biến tuỳ chỉnh: DOMAIN, APP_PORT, APP_DIR
set -euo pipefail

DOMAIN="${DOMAIN:-jazz-corner.thceramics.admirable.site}"
APP_PORT="${APP_PORT:-3050}"
APP_DIR="${APP_DIR:-/opt/jazz-corner}"
APP_USER="jazz-corner"
ENV_FILE="/etc/jazz-corner/environment"
REPO="https://github.com/Deocomate/jazz-corner.git"
export PATH=/opt/node22/bin:$PATH

say() { printf '\n▶ %s\n' "$*"; }

say "Tài khoản chạy app và mã nguồn"
id "$APP_USER" >/dev/null 2>&1 || useradd -r -m -d "$APP_DIR" -s /sbin/nologin "$APP_USER"
if [ -d "$APP_DIR/.git" ]; then
  (cd "$APP_DIR" && git pull --ff-only)
else
  git clone "$REPO" "$APP_DIR.tmp" && cp -a "$APP_DIR.tmp/." "$APP_DIR/" && rm -rf "$APP_DIR.tmp"
fi

say "Cài thư viện và build CSS"
cd "$APP_DIR"
npm ci --include=dev
npm run build
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

say "Biến môi trường ($ENV_FILE, giữ nguyên nếu đã có)"
if [ ! -f "$ENV_FILE" ]; then
  mkdir -p "$(dirname "$ENV_FILE")"
  cat > "$ENV_FILE" <<EOF
PORT=$APP_PORT
APP_NAME=Jazz Corner
SESSION_SECRET=$(node -p 'require("crypto").randomBytes(32).toString("hex")')
APP_TIMEZONE=Asia/Ho_Chi_Minh
NODE_ENV=production
EOF
  chmod 640 "$ENV_FILE"
  chown root:"$APP_USER" "$ENV_FILE"
fi

say "Dịch vụ systemd"
cat > /etc/systemd/system/jazz-corner.service <<EOF
[Unit]
Description=Jazz Corner (Node, Express, SQLite)
After=network.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=/opt/node22/bin/node --disable-warning=ExperimentalWarning src/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable jazz-corner >/dev/null 2>&1
systemctl restart jazz-corner
sleep 3
curl -fsS "http://127.0.0.1:$APP_PORT/healthz"; echo

say "nginx + chứng chỉ HTTPS cho $DOMAIN"
CONF="/etc/nginx/conf.d/$DOMAIN.conf"
CRT="/etc/nginx/ssl/$DOMAIN.crt"
KEY="/etc/nginx/ssl/$DOMAIN.key"
if [ ! -f "$CRT" ]; then
  cat > "$CONF" <<EOF
server {
	listen 80;
	server_name $DOMAIN;
	location /.well-known/acme-challenge/ { root /var/www/acme; }
	location / { return 301 https://$DOMAIN\$request_uri; }
}
EOF
  nginx -t && systemctl reload nginx
  /root/.acme.sh/acme.sh --issue -d "$DOMAIN" -w /var/www/acme --keylength ec-256
  /root/.acme.sh/acme.sh --install-cert -d "$DOMAIN" --ecc \
    --fullchain-file "$CRT" --key-file "$KEY" --reloadcmd "systemctl reload nginx"
fi
cat > "$CONF" <<EOF
server {
	listen 80;
	server_name $DOMAIN;
	location /.well-known/acme-challenge/ { root /var/www/acme; }
	location / { return 301 https://$DOMAIN\$request_uri; }
}

server {
	listen 443 ssl;
	server_name $DOMAIN;

	access_log /var/log/nginx/$DOMAIN.access.log;
	error_log /var/log/nginx/$DOMAIN.error.log;

	ssl_certificate $CRT;
	ssl_certificate_key $KEY;
	ssl_protocols TLSv1.2;
	ssl_prefer_server_ciphers on;
	add_header Strict-Transport-Security "max-age=31536000" always;

	client_max_body_size 5m;

	location / {
		proxy_pass http://127.0.0.1:$APP_PORT;
		proxy_http_version 1.1;
		proxy_set_header Host \$host;
		proxy_set_header X-Real-IP \$remote_addr;
		proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto \$scheme;
		proxy_read_timeout 60s;
	}
}
EOF
nginx -t && systemctl reload nginx

say "Kiểm tra"
curl -fsS "https://$DOMAIN/healthz"; echo
echo "Xong: https://$DOMAIN"
