#!/bin/sh
set -e

echo "=== Rahatio Slave Node Installer ==="

# Detect OS
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$ARCH" in
    x86_64|amd64) ARCH="amd64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

GO_VERSION="1.22.5"
GO_TAR="go${GO_VERSION}.${OS}-${ARCH}.tar.gz"
GO_URL="https://go.dev/dl/${GO_TAR}"

# Install Go if not present
if ! command -v go >/dev/null 2>&1; then
    echo "[install] Go not found, installing Go ${GO_VERSION}..."
    cd /tmp
    curl -sLO "$GO_URL"
    tar -C /usr/local -xzf "$GO_TAR"
    export PATH="/usr/local/go/bin:$PATH"
    echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.profile
    echo "[install] Go installed: $(go version)"
else
    echo "[install] Go found: $(go version)"
fi

# Clone or update project
PROJECT_DIR="/opt/rahatio/slave"
if [ ! -d "$PROJECT_DIR" ]; then
    echo "[install] Creating project directory..."
    mkdir -p "$PROJECT_DIR"
fi

cd "$PROJECT_DIR"

# Download slave source from GitHub
echo "[install] Downloading slave source..."
curl -sL "https://github.com/asbajans/rr/archive/main.tar.gz" | tar -xz --strip-components=2 "rr-main/slave/" -C "$PROJECT_DIR" 2>/dev/null || {
    echo "[install] Download failed, checking existing files..."
}

# Build
echo "[install] Building slave binary..."
cd "$PROJECT_DIR"
go mod tidy
go build -o /usr/local/bin/rahatio-slave ./cmd/slave/

# Create config if not exists
if [ ! -f "$PROJECT_DIR/slave.yaml" ]; then
    echo "[install] Creating default config..."
    cat > "$PROJECT_DIR/slave.yaml" << 'CONF'
api:
  base_url: "https://api.rahatio.com.tr"
  api_key: "YOUR_API_KEY"
  hmac_secret: "YOUR_HMAC_SECRET"
  store_code: "YOUR_STORE_CODE"
  timeout: 30

sync:
  interval: "@every 5m"
  categories:
    - products
    - stocks
    - orders

database:
  path: "/opt/rahatio/slave/data/slave.db"

server:
  port: 8080
CONF
    echo "[install] Config created at $PROJECT_DIR/slave.yaml"
    echo "  >> Edit this file with your API credentials"
fi

# Create systemd service
if command -v systemctl >/dev/null 2>&1; then
    echo "[install] Creating systemd service..."
    cat > /etc/systemd/system/rahatio-slave.service << 'UNIT'
[Unit]
Description=Rahatio Slave Node
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/rahatio/slave
ExecStart=/usr/local/bin/rahatio-slave -config /opt/rahatio/slave/slave.yaml
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
UNIT

    systemctl daemon-reload
    echo "[install] Service created. Start with: systemctl start rahatio-slave"
    echo "  Enable on boot: systemctl enable rahatio-slave"
fi

echo ""
echo "=== Installation Complete ==="
echo ""
echo "Next steps:"
echo "  1. Edit /opt/rahatio/slave/slave.yaml with your store credentials"
echo "  2. Start the service: systemctl start rahatio-slave"
echo "  3. Check logs: journalctl -u rahatio-slave -f"
echo "  4. Health check: curl http://localhost:8080/health"
