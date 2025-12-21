#!/usr/bin/env bash
set -Eeuo pipefail

# === Metrics Service Deploy Script ===
# Usage: SSH_IDENTITY=~/.ssh/id_ed25519_spark_selectel ./deploy.sh

# === конфиг ===
SSH_HOST="${SSH_HOST:-91.186.212.172}"
SSH_USER="${SSH_USER:-root}"
SSH_PORT="${SSH_PORT:-22}"
SSH_IDENTITY="${SSH_IDENTITY:-}"
REMOTE_DIR="${REMOTE_DIR:-/root/metrics}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

# === ssh/scp опции ===
SSH_OPTS=(-p "${SSH_PORT}" -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=60 -o ServerAliveCountMax=10)
SCP_OPTS=(-P "${SSH_PORT}" -o StrictHostKeyChecking=accept-new)
[[ -n "${SSH_IDENTITY}" ]] && { SSH_OPTS+=(-i "${SSH_IDENTITY}"); SCP_OPTS+=(-i "${SSH_IDENTITY}"); }

remote() { ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" "bash -lc 'unset DOCKER_HOST; $*'"; }

echo "=== Metrics Service Deploy ==="
echo "Target: ${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}"
echo ""

echo "[1/4] Syncing files -> ${REMOTE_DIR}"
ssh "${SSH_OPTS[@]}" "${SSH_USER}@${SSH_HOST}" "mkdir -p '${REMOTE_DIR}'"
rsync -az --delete \
  --exclude .git \
  --exclude node_modules \
  --exclude .cache \
  --exclude dist \
  --exclude .idea \
  --exclude .DS_Store \
  -e "ssh ${SSH_OPTS[*]}" \
  ./ "${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/"

echo "[2/4] Building backend (with Chrome - takes longer)"
remote "cd '${REMOTE_DIR}' && docker compose -f '${COMPOSE_FILE}' build metrics-backend"

echo "[3/4] Building frontend"
remote "cd '${REMOTE_DIR}' && docker compose -f '${COMPOSE_FILE}' build metrics-frontend"

echo "[4/4] Starting containers"
remote "cd '${REMOTE_DIR}' && docker compose -f '${COMPOSE_FILE}' up -d"

echo ""
echo "✅ Deploy complete!"
echo "🌐 https://metric.pizza.ew-production.ru"
