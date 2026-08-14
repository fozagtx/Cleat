#!/bin/bash
set -euo pipefail

REGISTRY="us-central1-docker.pkg.dev"
PROJECT_ID="cleat-505513"
NETWORK="cleat"

export DOCKER_CONFIG="/var/lib/cleat-docker"
mkdir -p "${DOCKER_CONFIG}"
docker-credential-gcr configure-docker --registries="${REGISTRY}"
docker network create "${NETWORK}" 2>/dev/null || true
docker volume create cleat-mysql >/dev/null
docker rm -f caddy proxy redis indexer mysql >/dev/null 2>&1 || true

metadata() {
  curl -fsS -H "Metadata-Flavor: Google" \
    "http://metadata.google.internal/computeMetadata/v1/instance/attributes/$1"
}

access_token() {
  curl -fsS -H "Metadata-Flavor: Google" \
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token" \
    | tr ',' '\n' | awk -F'"' '/access_token/ {print $4}'
}

secret_value() {
  local secret_name="$1" token encoded
  token="$(access_token)"
  encoded="$(curl -fsS \
    -H "Authorization: Bearer ${token}" \
    "https://secretmanager.googleapis.com/v1/projects/${PROJECT_ID}/secrets/${secret_name}/versions/latest:access" \
    | tr ',' '\n' | awk -F'"' '/"data":/ {print $4}')"
  printf '%s' "${encoded}" | tr '_-' '/+' | base64 -d
}

docker run -d --restart always \
  --name mysql \
  --network "${NETWORK}" \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=flare_ftso_indexer \
  -v cleat-mysql:/var/lib/mysql \
  mysql:8.4

until docker exec mysql mysqladmin ping -proot --silent; do
  sleep 3
done

docker run -d --restart always \
  --name indexer \
  --network "${NETWORK}" \
  -p 127.0.0.1:8080:8080 \
  "${REGISTRY}/${PROJECT_ID}/cleat/coston2-indexer:65a3b809-r9"

until curl -fsS http://127.0.0.1:8080/health >/dev/null; do
  sleep 10
done

docker run -d --restart always \
  --name redis \
  --network "${NETWORK}" \
  redis:7-alpine redis-server --save "" --appendonly no

docker run -d --restart always \
  --name proxy \
  --network "${NETWORK}" \
  -p 6663:6663 \
  -e "PROXY_PRIVATE_KEY=$(secret_value cleat-proxy-key)" \
  -e "DIRECT_API_KEY=$(secret_value cleat-direct-api-key)" \
  "${REGISTRY}/${PROJECT_ID}/cleat/extension-proxy:v0.0.18-cleat2"

DOMAIN="$(metadata proxy-domain)"
docker run -d --restart always \
  --name caddy \
  --network "${NETWORK}" \
  -p 80:80 \
  -p 443:443 \
  caddy:2-alpine caddy reverse-proxy --from "https://${DOMAIN}" --to "proxy:6664"
