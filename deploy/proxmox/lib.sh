#!/usr/bin/env bash
# Funções partilhadas pelo install.sh, update.sh, config.sh e backup.sh. Correm dentro
# da VM, como root. Não se executa sozinho: faz-se `source`.

# Usadas pelos scripts que fazem source deste ficheiro.
# shellcheck disable=SC2034
APP_USER="${APP_USER:-intristock}"
APP_DIR="${APP_DIR:-/opt/intristock}"
APP_HOME="/var/lib/intristock"
CONFIG_DIR="/etc/intristock"
BACKEND_ENV="${BACKEND_ENV:-$CONFIG_DIR/backend.env}"
FRONTEND_ENV="${FRONTEND_ENV:-$CONFIG_DIR/frontend.env}"
WEB_ROOT="/var/www/intristock"
SERVICE="intristock"
BACKUP_DIR="/var/backups/intristock"
BACKEND_PORT=3000
# Onde a app pede atualizações e lê o progresso delas (ver configure_updater)
UPDATES_DIR="$APP_HOME/updates"
NODE_MAJOR="${NODE_MAJOR:-22}"

# Garage — o storage S3 dos documentos (faturas, comprovativos), só em localhost
GARAGE_VERSION="v2.1.0"
GARAGE_BIN="/usr/local/bin/garage"
GARAGE_CONFIG="/etc/garage.toml"
GARAGE_DIR="/var/lib/garage"
GARAGE_BUCKET="intristock"
GARAGE_KEY_NAME="intristock-app"

# ClickHouse — as velas de 1 minuto do simulador, só em localhost. Vem do repositório
# apt da ClickHouse (canal LTS); as atualizações de segurança do Debian não lhe mexem.
CLICKHOUSE_DATABASE="intristock"
CLICKHOUSE_APP_USER="intristock"

# As apps Python (cada uma com o seu venv em apps/<app>/.venv) e os serviços delas
PYTHON_APPS=(downloader simulator)

# Programas do sistema de que a app precisa. O update.sh volta a garantir esta lista
# em cada versão: uma versão nova que precise de outro programa só tem de o pôr aqui.
SYSTEM_PACKAGES=(
  ca-certificates curl git xz-utils openssl
  nginx postgresql
  build-essential python3 python3-venv gnupg
  tzdata cron whiptail nano
  unattended-upgrades
)

msg()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31mxx\033[0m %s\n' "$*" >&2; exit 1; }

require_root() { [ "$(id -u)" -eq 0 ] || die "Corre isto como root (sudo)."; }

random_secret() { openssl rand -base64 "$1" | tr -d '\n'; }
random_hex() { openssl rand -hex "$1" | tr -d '\n'; }

# Corre um comando como o utilizador da app, com o HOME dele (é lá que fica a cache
# do npm — fora do repo).
as_app() {
  runuser -u "$APP_USER" -- env HOME="$APP_HOME" PATH="/usr/local/bin:/usr/bin:/bin" "$@"
}

# Carrega o ambiente do backend para os comandos seguintes (o Prisma precisa do
# DATABASE_URL nas migrações).
load_env() {
  [ -f "$BACKEND_ENV" ] || die "Falta $BACKEND_ENV — corre primeiro o install.sh."
  set -a
  # shellcheck disable=SC1090
  . "$BACKEND_ENV"
  set +a
}

# Valor de uma linha KEY="valor" num ficheiro de ambiente, sem as aspas
env_value() { # env_value FILE KEY
  local line
  line="$(grep -m1 "^$2=" "$1" 2>/dev/null || true)"
  line="${line#*=}"
  line="${line%\"}"; line="${line#\"}"
  printf '%s' "$line"
}

# --- programas do sistema ------------------------------------------------------------

ensure_system_packages() {
  local missing=() pkg
  for pkg in "${SYSTEM_PACKAGES[@]}"; do
    dpkg -s "$pkg" >/dev/null 2>&1 || missing+=("$pkg")
  done
  if [ ${#missing[@]} -eq 0 ]; then
    msg "Programas do sistema: tudo instalado."
    return 0
  fi
  msg "A instalar programas do sistema: ${missing[*]}"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq "${missing[@]}" >/dev/null
}

install_node() {
  local arch tarball
  case "$(uname -m)" in
    x86_64) arch="x64" ;;
    aarch64) arch="arm64" ;;
    *) die "Arquitetura não suportada: $(uname -m)" ;;
  esac
  local base="https://nodejs.org/dist/latest-v${NODE_MAJOR}.x"
  tarball="$(curl -fsSL "$base/SHASUMS256.txt" | awk -v a="linux-${arch}.tar.xz" '$2 ~ a {print $2; exit}')"
  [ -n "$tarball" ] || die "Não encontrei o Node ${NODE_MAJOR} para linux-${arch}."
  msg "A instalar ${tarball%.tar.xz}…"
  local tmp; tmp="$(mktemp -d)"
  curl -fsSL "$base/$tarball" -o "$tmp/$tarball"
  ( cd "$tmp" && curl -fsSL "$base/SHASUMS256.txt" | grep " $tarball\$" | sha256sum -c - >/dev/null ) \
    || die "O checksum do Node não bate certo."
  tar -xJf "$tmp/$tarball" -C /usr/local --strip-components=1 \
    --exclude='*/CHANGELOG.md' --exclude='*/LICENSE' --exclude='*/README.md'
  rm -rf "$tmp"
}

ensure_node() {
  if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" != "$NODE_MAJOR" ]; then
    install_node
  fi
  msg "Node $(node -v), npm $(npm -v)"
}

# --- Garage (S3 local) ----------------------------------------------------------------

garage() { "$GARAGE_BIN" -c "$GARAGE_CONFIG" "$@"; }

garage_installed_version() {
  [ -x "$GARAGE_BIN" ] || return 0
  "$GARAGE_BIN" --version 2>/dev/null | awk '{print $2}' | sed 's/^v//'
}

install_garage_binary() {
  local arch
  case "$(uname -m)" in
    x86_64) arch="x86_64-unknown-linux-musl" ;;
    aarch64) arch="aarch64-unknown-linux-musl" ;;
    *) die "Arquitetura não suportada pelo Garage: $(uname -m)" ;;
  esac
  msg "A instalar o Garage ${GARAGE_VERSION}…"
  local tmp; tmp="$(mktemp)"
  curl -fsSL "https://garagehq.deuxfleurs.fr/_releases/${GARAGE_VERSION}/${arch}/garage" -o "$tmp" \
    || die "Não consegui descarregar o Garage ${GARAGE_VERSION}."
  install -m 755 "$tmp" "$GARAGE_BIN"
  rm -f "$tmp"
}

# Instala (ou atualiza para a versão do GARAGE_VERSION) e deixa o serviço a correr.
# O que já existe — configuração, dados, chave — fica como está.
ensure_garage() {
  if [ "$(garage_installed_version)" != "${GARAGE_VERSION#v}" ]; then
    install_garage_binary
    GARAGE_CHANGED=1
  fi

  if ! id garage >/dev/null 2>&1; then
    useradd --system --home-dir "$GARAGE_DIR" --shell /usr/sbin/nologin garage
  fi
  mkdir -p "$GARAGE_DIR/meta" "$GARAGE_DIR/data"
  chown -R garage:garage "$GARAGE_DIR"

  if [ ! -f "$GARAGE_CONFIG" ]; then
    msg "A gerar $GARAGE_CONFIG…"
    cat > "$GARAGE_CONFIG" <<EOF
# Garage do IntriStock: um só nó, só em localhost. O backend fala com ele pelo S3.
metadata_dir = "${GARAGE_DIR}/meta"
data_dir = "${GARAGE_DIR}/data"
db_engine = "sqlite"
replication_factor = 1

rpc_bind_addr = "127.0.0.1:3901"
rpc_public_addr = "127.0.0.1:3901"
rpc_secret = "$(random_hex 32)"

[s3_api]
s3_region = "garage"
api_bind_addr = "127.0.0.1:3900"
root_domain = ".s3.garage.localhost"

[admin]
api_bind_addr = "127.0.0.1:3903"
admin_token = "$(random_secret 32)"
EOF
  fi
  chown root:garage "$GARAGE_CONFIG"
  chmod 640 "$GARAGE_CONFIG"

  cat > /etc/systemd/system/garage.service <<EOF
[Unit]
Description=Garage (S3 do IntriStock)
After=network-online.target
Wants=network-online.target

[Service]
User=garage
Group=garage
ExecStart=${GARAGE_BIN} -c ${GARAGE_CONFIG} server
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=${GARAGE_DIR}

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable garage >/dev/null 2>&1
  if [ "${GARAGE_CHANGED:-}" = 1 ]; then systemctl restart garage; else systemctl start garage; fi

  for _ in $(seq 1 30); do
    garage status >/dev/null 2>&1 && return 0
    sleep 1
  done
  die "O Garage não arrancou. Logs: journalctl -u garage -n 50"
}

# Primeira vez: dá capacidade ao nó, cria o bucket e a chave da app, e escreve as
# variáveis S3 no ambiente do backend. A chave é gerada aqui e importada — assim
# não se depende do formato do output do "garage key create".
setup_garage_storage() {
  if [ -n "$(env_value "$BACKEND_ENV" S3_ACCESS_KEY)" ]; then
    msg "Storage S3 já configurado — mantido."
    return 0
  fi

  msg "A preparar o storage S3 (Garage)…"
  if ! garage layout show 2>/dev/null | grep -q "dc1"; then
    local node_id
    node_id="$(garage node id -q 2>/dev/null | cut -d@ -f1)"
    [ -n "$node_id" ] || die "Não consegui ler o id do nó do Garage."
    garage layout assign -z dc1 -c 20G "$node_id" >/dev/null
    garage layout apply --version 1 >/dev/null
  fi

  garage bucket info "$GARAGE_BUCKET" >/dev/null 2>&1 || garage bucket create "$GARAGE_BUCKET" >/dev/null

  local key_id secret
  key_id="GK$(random_hex 12)"
  secret="$(random_hex 32)"
  garage key import --yes -n "$GARAGE_KEY_NAME" "$key_id" "$secret" >/dev/null
  garage bucket allow --read --write --owner "$GARAGE_BUCKET" --key "$key_id" >/dev/null

  set_env_value "$BACKEND_ENV" S3_PROVIDER "garage"
  set_env_value "$BACKEND_ENV" S3_ENDPOINT "http://127.0.0.1:3900"
  set_env_value "$BACKEND_ENV" S3_REGION "garage"
  set_env_value "$BACKEND_ENV" S3_BUCKET "$GARAGE_BUCKET"
  set_env_value "$BACKEND_ENV" S3_ACCESS_KEY "$key_id"
  set_env_value "$BACKEND_ENV" S3_SECRET_KEY "$secret"
}

# --- ClickHouse -----------------------------------------------------------------------

# Instala o servidor (se faltar) e escreve a configuração da VM: só em localhost, pouca
# memória e sem as tabelas de métricas, que numa VM pequena gastavam disco e CPU.
ensure_clickhouse() {
  if ! dpkg -s clickhouse-server >/dev/null 2>&1; then
    msg "A instalar o ClickHouse (LTS)…"
    curl -fsSL 'https://packages.clickhouse.com/rpm/lts/repodata/repomd.xml.key' \
      | gpg --dearmor --yes -o /usr/share/keyrings/clickhouse-keyring.gpg \
      || die "Não consegui descarregar a chave do repositório da ClickHouse."
    echo "deb [signed-by=/usr/share/keyrings/clickhouse-keyring.gpg arch=$(dpkg --print-architecture)] https://packages.clickhouse.com/deb lts main" \
      > /etc/apt/sources.list.d/clickhouse.list
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq clickhouse-server clickhouse-client >/dev/null
    CLICKHOUSE_CHANGED=1
  fi

  local config="/etc/clickhouse-server/config.d/intristock.xml" before=""
  [ -f "$config" ] && before="$(cat "$config")"
  cat > "$config" <<EOF
<!-- ClickHouse do IntriStock (escrito pelo instalador; é reescrito em cada atualização) -->
<clickhouse>
    <listen_host replace="replace">127.0.0.1</listen_host>
    <logger>
        <level>warning</level>
    </logger>
    <!-- A VM partilha a memória com o Postgres, o backend e o simulador -->
    <max_server_memory_usage_to_ram_ratio>0.4</max_server_memory_usage_to_ram_ratio>
    <mark_cache_size>268435456</mark_cache_size>
    <metric_log remove="1"/>
    <asynchronous_metric_log remove="1"/>
    <trace_log remove="1"/>
    <text_log remove="1"/>
    <part_log remove="1"/>
    <processors_profile_log remove="1"/>
</clickhouse>
EOF
  [ "$before" = "$(cat "$config")" ] || CLICKHOUSE_CHANGED=1
  chown root:clickhouse "$config"
  chmod 640 "$config"

  systemctl enable clickhouse-server >/dev/null 2>&1
  if [ "${CLICKHOUSE_CHANGED:-}" = 1 ]; then systemctl restart clickhouse-server; else systemctl start clickhouse-server; fi
}

# Corre uma query como o utilizador da app; a password vai num ficheiro de
# configuração do cliente, não na linha de comandos
clickhouse_query() {
  local client result=0
  client="$(mktemp --suffix=.xml)"
  chmod 600 "$client"
  cat > "$client" <<EOF
<config>
    <host>127.0.0.1</host>
    <user>${CLICKHOUSE_APP_USER}</user>
    <password>$(env_value "$BACKEND_ENV" CLICKHOUSE_PASSWORD)</password>
</config>
EOF
  clickhouse-client --config-file "$client" -q "$1" || result=$?
  rm -f "$client"
  return $result
}

# O utilizador da app (a password fica no backend.env, gerada na primeira vez) e a base
# dela. As tabelas são das apps Python, que aplicam as migrations ao arrancar.
setup_clickhouse_access() {
  if [ -z "$(env_value "$BACKEND_ENV" CLICKHOUSE_PASSWORD)" ]; then
    msg "A preparar o acesso ao ClickHouse…"
    set_env_value "$BACKEND_ENV" CLICKHOUSE_URL "http://127.0.0.1:8123"
    set_env_value "$BACKEND_ENV" CLICKHOUSE_DATABASE "$CLICKHOUSE_DATABASE"
    set_env_value "$BACKEND_ENV" CLICKHOUSE_USER "$CLICKHOUSE_APP_USER"
    set_env_value "$BACKEND_ENV" CLICKHOUSE_PASSWORD "$(random_hex 24)"
  fi

  local users="/etc/clickhouse-server/users.d/intristock.xml" hash
  hash="$(printf '%s' "$(env_value "$BACKEND_ENV" CLICKHOUSE_PASSWORD)" | sha256sum | awk '{print $1}')"
  cat > "$users" <<EOF
<!-- O utilizador do IntriStock (escrito pelo instalador a partir do backend.env) -->
<clickhouse>
    <users>
        <${CLICKHOUSE_APP_USER}>
            <password_sha256_hex>${hash}</password_sha256_hex>
            <networks>
                <ip>127.0.0.1</ip>
                <ip>::1</ip>
            </networks>
            <profile>default</profile>
            <quota>default</quota>
        </${CLICKHOUSE_APP_USER}>
    </users>
</clickhouse>
EOF
  chown root:clickhouse "$users"
  chmod 640 "$users"

  # Os utilizadores recarregam-se sozinhos em poucos segundos, e o servidor pode ainda
  # estar a arrancar
  for _ in $(seq 1 60); do
    if clickhouse_query "CREATE DATABASE IF NOT EXISTS ${CLICKHOUSE_DATABASE}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  die "O ClickHouse não respondeu. Logs: journalctl -u clickhouse-server -n 50"
}

# set_env_value FILE KEY VALUE — substitui a linha, ou acrescenta-a no fim
set_env_value() {
  K="$2" V="$3" awk '
    BEGIN { k = ENVIRON["K"]; v = ENVIRON["V"] }
    index($0, k "=") == 1 && !done { print k "=\"" v "\""; done = 1; next }
    { print }
    END { if (!done) print k "=\"" v "\"" }
  ' "$1" > "$1.new" && cat "$1.new" > "$1" && rm -f "$1.new"
}

# --- build e publicação ------------------------------------------------------------------

# Dependências e build dos dois lados. O frontend é compilado com as variáveis do
# frontend.env (por omissão a API em /api, que o nginx encaminha para o backend).
build_app() {
  load_env
  msg "A instalar dependências do backend (npm ci)…"
  # --include=dev: o build precisa do Nest CLI e do TypeScript, e o NODE_ENV=production
  # do ambiente faria o npm saltá-los
  ( cd "$APP_DIR/apps/backend" && as_app npm ci --include=dev --no-audit --no-fund )
  msg "A compilar o backend…"
  # O prisma.config.ts lê o DATABASE_URL mesmo só para gerar o cliente
  ( cd "$APP_DIR/apps/backend" && as_app env DATABASE_URL="$DATABASE_URL" npm run build )
  build_frontend
  build_python_apps
}

# O venv de cada app Python e as dependências fixas do requirements.txt. Uma versão
# sem a app (a reposição de uma anterior) salta-a.
build_python_apps() {
  local app dir
  for app in "${PYTHON_APPS[@]}"; do
    dir="$APP_DIR/apps/$app"
    [ -f "$dir/requirements.txt" ] || continue
    msg "A instalar as dependências do $app (pip)…"
    # Um venv de um Python que já não existe (o Debian mudou de versão) faz-se de novo
    if [ -e "$dir/.venv" ] && ! "$dir/.venv/bin/python" -c 'import sys' >/dev/null 2>&1; then
      rm -rf "$dir/.venv"
    fi
    [ -x "$dir/.venv/bin/python" ] || ( cd "$dir" && as_app python3 -m venv .venv )
    ( cd "$dir" && as_app .venv/bin/pip install --quiet --disable-pip-version-check -r requirements.txt )
  done
}

build_frontend() {
  msg "A instalar dependências do frontend (npm ci)…"
  ( cd "$APP_DIR/apps/frontend" && as_app npm ci --include=dev --no-audit --no-fund )
  msg "A compilar o frontend…"
  local frontend_vars=()
  if [ -f "$FRONTEND_ENV" ]; then
    while IFS= read -r line; do
      [[ "$line" =~ ^VITE_[A-Z0-9_]+= ]] || continue
      frontend_vars+=("${line%%=*}=$(env_value "$FRONTEND_ENV" "${line%%=*}")")
    done < "$FRONTEND_ENV"
  fi
  ( cd "$APP_DIR/apps/frontend" && as_app env "${frontend_vars[@]}" npm run build )
}

migrate_db() {
  msg "A aplicar as migrações da base de dados…"
  load_env
  ( cd "$APP_DIR/apps/backend" && as_app env DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy )
}

publish_frontend() {
  msg "A publicar o frontend em $WEB_ROOT…"
  mkdir -p "$WEB_ROOT"
  rm -rf "${WEB_ROOT:?}"/*
  cp -r "$APP_DIR/apps/frontend/dist/." "$WEB_ROOT/"
  chown -R root:root "$WEB_ROOT"
  chmod -R a+rX "$WEB_ROOT"
}

restart_backend() {
  msg "A reiniciar o backend…"
  systemctl restart "$SERVICE"
  restart_workers
  wait_backend
}

# O downloader e o simulador leem o mesmo backend.env: reiniciam com o backend. Uma
# versão que não os tenha (a reposição de uma anterior) deixa-os parados.
restart_workers() {
  local app unit
  for app in "${PYTHON_APPS[@]}"; do
    unit="${SERVICE}-${app}"
    [ -f "/etc/systemd/system/${unit}.service" ] || continue
    if [ -d "$APP_DIR/apps/$app/intristock_$app" ]; then
      systemctl restart "$unit"
    else
      systemctl stop "$unit" 2>/dev/null || true
    fi
  done
}

# Espera até o backend responder (o Nest demora uns segundos a arrancar)
wait_backend() {
  for _ in $(seq 1 60); do
    if curl -fsS "http://127.0.0.1:${BACKEND_PORT}/" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  warn "O backend não respondeu em 60 s. Logs: journalctl -u $SERVICE -n 100"
  return 1
}

# --- serviços --------------------------------------------------------------------------

# A unit do systemd e o site do nginx são (re)escritos pelo install.sh e pelo
# intristock-update, para as mudanças no repo chegarem às VMs já instaladas.
configure_service() {
msg "A configurar o serviço $SERVICE…"
cat > "/etc/systemd/system/${SERVICE}.service" <<EOF
[Unit]
Description=IntriStock (backend)
After=network-online.target postgresql.service garage.service
Wants=network-online.target garage.service
Requires=postgresql.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}/apps/backend
EnvironmentFile=${BACKEND_ENV}
Environment=APP_DIR=${APP_DIR}
Environment=SYSTEM_UPDATES_DIR=${UPDATES_DIR}
ExecStart=/usr/local/bin/node dist/src/main.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable "$SERVICE" >/dev/null
}

# O downloader (velas da Binance → ClickHouse) e o simulador: um serviço cada, com o
# ambiente do backend. Um pedido ou uma simulação a meio quando param voltam à fila ao
# arrancarem, por isso não se espera por eles mais de 30 s.
configure_workers() {
  msg "A configurar o downloader e o simulador…"
  local app description nice
  for app in "${PYTHON_APPS[@]}"; do
    case "$app" in
      downloader) description="IntriStock (downloader das velas)"; nice=0 ;;
      simulator) description="IntriStock (simulador)"; nice=10 ;;
    esac
    cat > "/etc/systemd/system/${SERVICE}-${app}.service" <<EOF
[Unit]
Description=${description}
After=network-online.target postgresql.service clickhouse-server.service
Wants=network-online.target
Requires=postgresql.service clickhouse-server.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}/apps/${app}
EnvironmentFile=${BACKEND_ENV}
Environment=PYTHONUNBUFFERED=1
ExecStart=${APP_DIR}/apps/${app}/.venv/bin/python -m intristock_${app}
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
Nice=${nice}
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true

[Install]
WantedBy=multi-user.target
EOF
  done
  systemctl daemon-reload
  for app in "${PYTHON_APPS[@]}"; do systemctl enable "${SERVICE}-${app}" >/dev/null 2>&1; done
}

configure_nginx() {
msg "A configurar o nginx…"
cat > /etc/nginx/sites-available/intristock <<EOF
# O protocolo que o browser usou de facto: um proxy à frente (ex. Nginx Proxy
# Manager) termina o https e manda X-Forwarded-Proto; aberto pelo IP não há
# cabeçalho e vale o deste nginx. O backend usa-o para o cookie "secure".
map \$http_x_forwarded_proto \$intristock_proto {
    default \$http_x_forwarded_proto;
    ""      \$scheme;
}

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root ${WEB_ROOT};
    index index.html;

    # Documentos dos pagamentos (até 15 MB) passam pelo backend
    client_max_body_size 20m;

    location /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT}/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$intristock_proto;
        proxy_set_header Connection "";
        proxy_read_timeout 5m;
    }

    # Ficheiros com hash no nome: podem ficar em cache para sempre
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }

    location = /index.html { add_header Cache-Control "no-cache"; }

    # SPA: qualquer rota volta ao index.html
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
ln -sf /etc/nginx/sites-available/intristock /etc/nginx/sites-enabled/intristock
rm -f /etc/nginx/sites-enabled/default
nginx -t >/dev/null 2>&1 || { nginx -t; die "Configuração do nginx inválida."; }
systemctl enable --now nginx >/dev/null
systemctl reload nginx
}

# Atualizações pela app. O backend corre sem privilégios e só escreve
# $UPDATES_DIR/request com a versão; esta unit .path (root) vê o ficheiro aparecer e
# corre o update.sh, que escreve o progresso em status.json e o output em update.log.
configure_updater() {
  msg "A configurar as atualizações pela app…"
  mkdir -p "$UPDATES_DIR"
  chown "$APP_USER:$APP_USER" "$UPDATES_DIR"
  chmod 755 "$UPDATES_DIR"

  cat > /etc/systemd/system/intristock-updater.path <<EOF
[Unit]
Description=IntriStock — pedidos de atualização vindos da app

[Path]
PathExists=${UPDATES_DIR}/request
Unit=intristock-updater.service

[Install]
WantedBy=multi-user.target
EOF

  cat > /etc/systemd/system/intristock-updater.service <<EOF
[Unit]
Description=IntriStock — atualização pedida na app

[Service]
Type=oneshot
Environment=LANG=C.UTF-8 LC_ALL=C.UTF-8
ExecStart=/usr/bin/bash ${APP_DIR}/deploy/proxmox/update.sh --from-request
EOF

  systemctl daemon-reload
  systemctl enable --now intristock-updater.path >/dev/null 2>&1
}

# intristock-update / intristock-config. Em /usr/bin e não em /usr/local/bin: o PATH
# de um "sudo" nem sempre inclui /usr/local/bin.
install_commands() {
  local dir; dir="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
  chmod +x "$dir"/*.sh
  ln -sf "$dir/update.sh" /usr/bin/intristock-update
  ln -sf "$dir/config.sh" /usr/bin/intristock-config
}

configure_backups() {
  mkdir -p "$BACKUP_DIR"
  chmod 700 "$BACKUP_DIR"
  cat > /etc/cron.d/intristock-backup <<EOF
# Dump diário da base de dados às 03:30 (guarda 14 dias). Um snapshot da VM com o
# Postgres a correr nem sempre é consistente; o dump é.
30 3 * * * root ${APP_DIR}/deploy/proxmox/backup.sh >/var/log/intristock-backup.log 2>&1
EOF
  systemctl enable --now cron >/dev/null
}

# Atualizações de segurança do Debian, sozinhas. As da app vêm pela secção Versões;
# as do sistema operativo não podem esperar por uma versão nova do IntriStock.
configure_security_updates() {
  cat > /etc/apt/apt.conf.d/20auto-upgrades <<EOF
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
}
