#!/usr/bin/env bash
# Funções partilhadas pelo install.sh, update.sh, config.sh e backup.sh. Correm dentro
# da VM, como root. Não se executa sozinho: faz-se `source`.
#
# Quem é dono de quê (o utilizador da app nunca escreve no que o root corre):
#   $APP_DIR        o repositório git — root:root. Os scripts de deploy, este lib.sh e
#                   os upgrades/*.sh que o root corre vêm daqui. A app só o lê (o
#                   backend corre o git para saber a versão instalada e as notas).
#   $BUILDS_DIR     root:root. Cada build é um diretório da app (o código exportado do
#                   git, node_modules, dist, .venv) e o $CURRENT_LINK aponta para o que
#                   está a correr. O root não corre nada lá de dentro.
#   $STATE_DIR      root:intristock 750 — o estado, o log e o lock das atualizações e o
#                   resultado do último backup. A app lê, só o root escreve.
#   $UPDATES_DIR    da app: só lá escreve o `request`. O status.json e o update.log são
#                   links (dela) para o $STATE_DIR; o root nunca escreve lá dentro.

# Usadas pelos scripts que fazem source deste ficheiro.
# shellcheck disable=SC2034
APP_USER="${APP_USER:-intristock}"
APP_DIR="${APP_DIR:-/opt/intristock}"
APP_HOME="/var/lib/intristock"
CONFIG_DIR="/etc/intristock"
BACKEND_ENV="${BACKEND_ENV:-$CONFIG_DIR/backend.env}"
FRONTEND_ENV="${FRONTEND_ENV:-$CONFIG_DIR/frontend.env}"
# Backups: a cópia externa e os dias que se guardam (ver backup.sh)
BACKUP_ENV="$CONFIG_DIR/backup.env"
# O token de um repositório privado (o "store" do git, só root), fora do .git/config
GIT_CREDENTIALS="$CONFIG_DIR/git-credentials"
# Chaves públicas das releases. Com um destes ficheiros, o update.sh só põe tags com
# uma assinatura válida (SSH: formato allowed_signers; GPG: a chave pública em ASCII).
# Sem nenhum, avisa e continua.
RELEASE_SIGNERS="$CONFIG_DIR/release-signers"
RELEASE_KEY="$CONFIG_DIR/release-key.asc"
CREDS_FILE="/root/intristock-credentials.txt"
WEB_ROOT="/var/www/intristock"
SERVICE="intristock"
BACKUP_DIR="/var/backups/intristock"
BACKEND_PORT=3000
DB_NAME="${DB_NAME:-intristock}"
DB_USER="${DB_USER:-intristock}"
# Um diretório por build: compila-se ao lado do que está a correr e troca-se o link
BUILDS_DIR="/opt/intristock-builds"
CURRENT_LINK="$BUILDS_DIR/current"
# Onde a app pede atualizações (ver configure_updater) e onde o root escreve o estado
UPDATES_DIR="$APP_HOME/updates"
STATE_DIR="/var/lib/intristock-state"

# O Node fica fixado numa versão (e no SHA-256 de cada tarball): uma versão nova do Node
# entra numa release do IntriStock, não no dia em que sai.
NODE_VERSION="22.23.5"
NODE_SHA256_X64="cdeb8670a0c81f51b4dc4ac61919f9b1ad917b304bf8221eb939570663d240f8"
NODE_SHA256_ARM64="2babb9eb5264860d540849f4b064a6fbdebcdc323657d9d382ce23d313fd5e09"

# Garage — o storage S3 dos documentos (faturas, comprovativos), só em localhost. O
# SHA-256 de cada binário muda com o GARAGE_VERSION (o site do Garage não publica os
# checksums: calcula-se ao fixar a versão).
GARAGE_VERSION="v2.1.0"
GARAGE_SHA256_X86_64="543b0414d1464ab855ebe9b843938a5e5361fd24436891ce3dff9e03d02839d8"
GARAGE_SHA256_AARCH64="65a1bedc9b6d5a2df788b55e81cb0013129326478fd94cf83a844ab278e8055f"
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

json_str() { # escapa uma string para JSON
  local s="$1"
  s="${s//\\/\\\\}"; s="${s//\"/\\\"}"; s="${s//$'\n'/ }"; s="${s//$'\r'/}"
  printf '"%s"' "$s"
}

# Corre um comando como o utilizador da app, com o HOME dele (é lá que fica a cache
# do npm e do pip — fora do código).
as_app() {
  runuser -u "$APP_USER" -- env HOME="$APP_HOME" PATH="/usr/local/bin:/usr/bin:/bin" "$@"
}

# O git do root no repositório. Sem hooks nem fsmonitor: numa VM antiga o .git foi da
# app, e o que lá tivesse ficado não pode correr como root.
rgit() { git -C "$APP_DIR" -c core.hooksPath=/dev/null -c core.fsmonitor=false "$@"; }

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
  local arch sha
  case "$(uname -m)" in
    x86_64) arch="x64"; sha="$NODE_SHA256_X64" ;;
    aarch64) arch="arm64"; sha="$NODE_SHA256_ARM64" ;;
    *) die "Arquitetura não suportada: $(uname -m)" ;;
  esac
  local tarball="node-v${NODE_VERSION}-linux-${arch}.tar.xz"
  msg "A instalar o Node ${NODE_VERSION}…"
  local tmp; tmp="$(mktemp -d)"
  curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/$tarball" -o "$tmp/$tarball" \
    || die "Não consegui descarregar o Node ${NODE_VERSION}."
  printf '%s  %s\n' "$sha" "$tmp/$tarball" | sha256sum -c - >/dev/null \
    || die "O checksum do Node não bate certo."
  tar -xJf "$tmp/$tarball" -C /usr/local --strip-components=1 \
    --exclude='*/CHANGELOG.md' --exclude='*/LICENSE' --exclude='*/README.md'
  rm -rf "$tmp"
}

ensure_node() {
  if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node')" != "$NODE_VERSION" ]; then
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
  local arch sha
  case "$(uname -m)" in
    x86_64) arch="x86_64-unknown-linux-musl"; sha="$GARAGE_SHA256_X86_64" ;;
    aarch64) arch="aarch64-unknown-linux-musl"; sha="$GARAGE_SHA256_AARCH64" ;;
    *) die "Arquitetura não suportada pelo Garage: $(uname -m)" ;;
  esac
  msg "A instalar o Garage ${GARAGE_VERSION}…"
  local tmp; tmp="$(mktemp)"
  curl -fsSL "https://garagehq.deuxfleurs.fr/_releases/${GARAGE_VERSION}/${arch}/garage" -o "$tmp" \
    || die "Não consegui descarregar o Garage ${GARAGE_VERSION}."
  if ! printf '%s  %s\n' "$sha" "$tmp" | sha256sum -c - >/dev/null; then
    rm -f "$tmp"
    die "O checksum do Garage ${GARAGE_VERSION} não bate certo."
  fi
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

# --- o repositório (do root) -----------------------------------------------------------

# O código é do root: o utilizador da app só o lê. Numa VM antiga o repositório era da
# app; aqui passa a ser do root, os hooks que lá estivessem saem e o token do URL (se
# houver) vai para um ficheiro só do root.
secure_repo() {
  chown -R root:root "$APP_DIR"
  chmod -R go-w "$APP_DIR"
  find "$APP_DIR/.git/hooks" -type f ! -name '*.sample' -delete 2>/dev/null || true
  rm -f "$APP_DIR/.git/info/attributes"
  # O backend (a app) corre o git aqui para ler a versão: o git recusa um repo de outro
  # dono sem isto
  git config --system --get-all safe.directory 2>/dev/null | grep -qxF "$APP_DIR" \
    || git config --system --add safe.directory "$APP_DIR"
  move_repo_token
}

# Um token no URL do origin (https://oauth2:TOKEN@host/…) ficava no .git/config, que a
# app lê. Passa para o $GIT_CREDENTIALS (600, root) e o URL fica limpo.
move_repo_token() {
  local url scheme creds rest
  url="$(rgit remote get-url origin 2>/dev/null || true)"
  [[ "$url" =~ ^(https?)://([^/@]+)@(.+)$ ]] || return 0
  scheme="${BASH_REMATCH[1]}"; creds="${BASH_REMATCH[2]}"; rest="${BASH_REMATCH[3]}"
  mkdir -p "$CONFIG_DIR"
  ( umask 077; printf '%s://%s@%s\n' "$scheme" "$creds" "${rest%%/*}" > "$GIT_CREDENTIALS" )
  chown root:root "$GIT_CREDENTIALS"
  chmod 600 "$GIT_CREDENTIALS"
  rgit config credential.helper "store --file=$GIT_CREDENTIALS"
  rgit remote set-url origin "$scheme://$rest"
  msg "O token do repositório saiu do .git/config para $GIT_CREDENTIALS (só root)."
}

# A password do admin não fica escrita (as instalações antigas guardavam-na aqui)
scrub_credentials_file() {
  [ -f "$CREDS_FILE" ] || return 0
  if grep -q '^Password:' "$CREDS_FILE"; then
    sed -i '/^Password:/d' "$CREDS_FILE"
    msg "A password inicial do admin saiu de $CREDS_FILE."
  fi
}

# verify_release_tag TAG — com uma chave em $RELEASE_SIGNERS (SSH) ou $RELEASE_KEY (GPG),
# a tag tem de estar assinada por ela; sem nenhuma, só avisa.
verify_release_tag() {
  local tag="$1" gnupg rc
  if [ ! -f "$RELEASE_SIGNERS" ] && [ ! -f "$RELEASE_KEY" ]; then
    warn "Sem chave das releases ($RELEASE_SIGNERS ou $RELEASE_KEY): a assinatura da $tag não foi verificada."
    return 0
  fi
  if [ -f "$RELEASE_SIGNERS" ] \
      && rgit -c gpg.ssh.allowedSignersFile="$RELEASE_SIGNERS" verify-tag "$tag" >/dev/null 2>&1; then
    msg "A $tag está assinada por uma chave de $RELEASE_SIGNERS."
    return 0
  fi
  if [ -f "$RELEASE_KEY" ]; then
    gnupg="$(mktemp -d)"
    rc=1
    if gpg --homedir "$gnupg" --batch --quiet --import "$RELEASE_KEY" >/dev/null 2>&1 \
        && GNUPGHOME="$gnupg" rgit verify-tag "$tag" >/dev/null 2>&1; then
      rc=0
    fi
    rm -rf "$gnupg"
    if [ "$rc" -eq 0 ]; then
      msg "A $tag está assinada pela chave de $RELEASE_KEY."
      return 0
    fi
  fi
  warn "A $tag não tem uma assinatura válida das chaves da VM."
  return 1
}

# --- builds (um diretório por versão) ----------------------------------------------------

# O build a correr (o destino do link), ou vazio numa VM antiga, que compilava no repo
current_build() {
  local dir
  dir="$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)"
  [ -n "$dir" ] && [ -d "$dir" ] && printf '%s' "$dir"
  return 0
}

# A raiz do código que os serviços correm: o build atual ou, numa VM antiga, o repo
app_root() {
  if [ -d "$CURRENT_LINK" ]; then printf '%s' "$CURRENT_LINK"; else printf '%s' "$APP_DIR"; fi
}

# Onde se compila: o BUILD_DIR que o chamador escolheu ou o que está a correr
build_root() { printf '%s' "${BUILD_DIR:-$(app_root)}"; }

# new_build_dir REV — exporta o código do REV (sem o .git) para um diretório novo, da
# app, e escreve o caminho. O que está a correr não se toca.
new_build_dir() {
  local sha dir
  # Corre dentro de $(…), onde o set -e não chega: cada passo verifica-se à mão
  sha="$(rgit rev-parse --verify "$1^{commit}")" || return 1
  mkdir -p "$BUILDS_DIR" && chown root:root "$BUILDS_DIR" && chmod 755 "$BUILDS_DIR" || return 1
  dir="$BUILDS_DIR/$(date +%Y%m%d-%H%M%S)-${sha:0:12}"
  mkdir "$dir" || return 1
  rgit archive --format=tar "$sha" | tar -x -C "$dir" || return 1
  chown -R "$APP_USER:$APP_USER" "$dir" || return 1
  printf '%s' "$dir"
}

# switch_current DIR — o link passa para o DIR de uma vez (os serviços leem-no ao
# arrancar)
switch_current() {
  ln -sfn "$1" "$CURRENT_LINK.new"
  mv -Tf "$CURRENT_LINK.new" "$CURRENT_LINK"
}

# prune_builds [MANTER…] — apaga os builds que não são o atual nem os MANTER
prune_builds() {
  local cur d k skip
  cur="$(current_build)"
  [ -d "$BUILDS_DIR" ] || return 0
  for d in "$BUILDS_DIR"/*; do
    [ -d "$d" ] && [ ! -L "$d" ] || continue
    skip=""
    for k in "$cur" "$@"; do [ -n "$k" ] && [ "$d" = "$k" ] && skip=1; done
    [ -n "$skip" ] || rm -rf "$d"
  done
}

# Numa VM antiga as dependências e os builds ficavam dentro do repo. Depois de os
# serviços passarem para o $CURRENT_LINK já não servem.
cleanup_legacy_build() {
  local app
  [ -d "$CURRENT_LINK" ] || return 0
  rm -rf "$APP_DIR/apps/backend/node_modules" "$APP_DIR/apps/backend/dist" \
    "$APP_DIR/apps/backend/src/generated" \
    "$APP_DIR/apps/frontend/node_modules" "$APP_DIR/apps/frontend/dist"
  for app in "${PYTHON_APPS[@]}"; do rm -rf "$APP_DIR/apps/$app/.venv"; done
}

# --- build e publicação ------------------------------------------------------------------

# Dependências e build dos dois lados, no build_root. O frontend é compilado com as
# variáveis do frontend.env (por omissão a API em /api, que o nginx encaminha para o
# backend).
build_app() {
  local root; root="$(build_root)"
  load_env
  msg "A instalar dependências do backend (npm ci)…"
  # --include=dev: o build precisa do Nest CLI e do TypeScript, e o NODE_ENV=production
  # do ambiente faria o npm saltá-los
  ( cd "$root/apps/backend" && as_app npm ci --include=dev --no-audit --no-fund ) || return 1
  msg "A compilar o backend…"
  # O prisma.config.ts lê o DATABASE_URL mesmo só para gerar o cliente
  ( cd "$root/apps/backend" && as_app env DATABASE_URL="$DATABASE_URL" npm run build ) || return 1
  build_frontend || return 1
  build_python_apps
}

# O venv de cada app Python e as dependências fixas do requirements.txt. Uma versão
# sem a app (a reposição de uma anterior) salta-a.
build_python_apps() {
  local app dir root; root="$(build_root)"
  for app in "${PYTHON_APPS[@]}"; do
    dir="$root/apps/$app"
    [ -f "$dir/requirements.txt" ] || continue
    msg "A instalar as dependências do $app (pip)…"
    # Um venv de um Python que já não existe (o Debian mudou de versão) faz-se de novo
    if [ -e "$dir/.venv" ] && ! "$dir/.venv/bin/python" -c 'import sys' >/dev/null 2>&1; then
      rm -rf "$dir/.venv"
    fi
    [ -x "$dir/.venv/bin/python" ] || ( cd "$dir" && as_app python3 -m venv .venv ) || return 1
    ( cd "$dir" && as_app .venv/bin/pip install --quiet --disable-pip-version-check -r requirements.txt ) || return 1
  done
}

build_frontend() {
  local root; root="$(build_root)"
  msg "A instalar dependências do frontend (npm ci)…"
  ( cd "$root/apps/frontend" && as_app npm ci --include=dev --no-audit --no-fund ) || return 1
  msg "A compilar o frontend…"
  local frontend_vars=()
  if [ -f "$FRONTEND_ENV" ]; then
    while IFS= read -r line; do
      [[ "$line" =~ ^VITE_[A-Z0-9_]+= ]] || continue
      frontend_vars+=("${line%%=*}=$(env_value "$FRONTEND_ENV" "${line%%=*}")")
    done < "$FRONTEND_ENV"
  fi
  ( cd "$root/apps/frontend" && as_app env "${frontend_vars[@]}" npm run build )
}

migrate_db() {
  msg "A aplicar as migrações da base de dados…"
  load_env
  ( cd "$(build_root)/apps/backend" && as_app env DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy )
}

# O dist é da app: copia-se sem links simbólicos (um link podia apontar para um ficheiro
# do sistema e o nginx servi-lo)
publish_frontend() {
  local dist; dist="$(build_root)/apps/frontend/dist"
  [ -f "$dist/index.html" ] || die "Não há frontend compilado em $dist."
  msg "A publicar o frontend em $WEB_ROOT…"
  mkdir -p "$WEB_ROOT"
  rm -rf "${WEB_ROOT:?}"/*
  cp -R --no-dereference --no-preserve=ownership "$dist/." "$WEB_ROOT/"
  find "$WEB_ROOT" -type l -delete
  chown -R root:root "$WEB_ROOT"
  chmod -R a+rX,go-w "$WEB_ROOT"
}

# --- base de dados: backup antes de atualizar e reposição --------------------------------

# backup_db_file RÓTULO DATA — o nome do dump (o backup.sh e o update.sh usam o mesmo)
backup_db_file() {
  local label
  label="$(printf '%s' "${1:-}" | tr -c 'A-Za-z0-9._-' '_')"
  printf '%s/intristock-%s%s.sql.gz' "$BACKUP_DIR" "${label:+$label-}" "$2"
}

# dump_db FICHEIRO — pg_dump comprimido, escrito de uma vez
dump_db() {
  mkdir -p "$BACKUP_DIR"
  chmod 700 "$BACKUP_DIR"
  runuser -u postgres -- pg_dump --clean --if-exists "$DB_NAME" | gzip > "$1.tmp"
  chmod 600 "$1.tmp"
  mv -f "$1.tmp" "$1"
}

# Para o backend e os workers (ninguém escreve na base enquanto se repõe)
stop_app() {
  local app
  systemctl stop "$SERVICE" 2>/dev/null || true
  for app in "${PYTHON_APPS[@]}"; do systemctl stop "${SERVICE}-${app}" 2>/dev/null || true; done
}

# restore_db FICHEIRO — repõe um dump do backup.sh numa base nova com o mesmo nome. A
# atual fica de lado até a reposição acabar: se falhar, volta ela.
restore_db() {
  local dump="$1" aside="${DB_NAME}_before_restore"
  [ -s "$dump" ] || { warn "O dump $dump não existe ou está vazio."; return 1; }
  pgq() { runuser -u postgres -- psql -v ON_ERROR_STOP=1 -qtAc "$1"; }
  pgq "DROP DATABASE IF EXISTS \"$aside\";" || return 1
  pgq "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" >/dev/null || true
  pgq "ALTER DATABASE \"$DB_NAME\" RENAME TO \"$aside\";" || return 1
  if pgq "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\";" \
      && gunzip -c "$dump" | runuser -u postgres -- psql -v ON_ERROR_STOP=1 -q -d "$DB_NAME" >/dev/null; then
    pgq "DROP DATABASE \"$aside\";" || warn "Ficou a base $aside (a de antes da reposição): apaga-a à mão."
    msg "Base de dados reposta de $dump."
    return 0
  fi
  warn "A reposição de $dump falhou — volta a base como estava."
  pgq "DROP DATABASE IF EXISTS \"$DB_NAME\";" || true
  pgq "ALTER DATABASE \"$aside\" RENAME TO \"$DB_NAME\";" || true
  return 1
}

# --- serviços --------------------------------------------------------------------------

restart_backend() {
  msg "A reiniciar o backend…"
  systemctl restart "$SERVICE"
  restart_workers
  wait_backend || return 1
  check_workers
}

# O downloader e o simulador leem o mesmo backend.env: reiniciam com o backend. Uma
# versão que não os tenha (a reposição de uma anterior) deixa-os parados.
restart_workers() {
  local app unit root; root="$(app_root)"
  for app in "${PYTHON_APPS[@]}"; do
    unit="${SERVICE}-${app}"
    [ -f "/etc/systemd/system/${unit}.service" ] || continue
    if [ -d "$root/apps/$app/intristock_$app" ]; then
      systemctl restart "$unit"
    else
      systemctl stop "$unit" 2>/dev/null || true
    fi
  done
}

# O backend responde e chega à base de dados: GET /health (SELECT 1). Uma versão
# anterior sem /health (a reposição de uma antiga) responde 404, e aí vale o GET /.
backend_healthy() {
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' -m 5 "http://127.0.0.1:${BACKEND_PORT}/health" 2>/dev/null || true)"
  case "$code" in
    200) return 0 ;;
    404) curl -fsS -m 5 -o /dev/null "http://127.0.0.1:${BACKEND_PORT}/" 2>/dev/null ;;
    *) return 1 ;;
  esac
}

# Espera até o backend estar de pé (o Nest demora uns segundos a arrancar)
wait_backend() {
  for _ in $(seq 1 60); do
    backend_healthy && return 0
    sleep 1
  done
  warn "O backend não respondeu ao /health em 60 s. Logs: journalctl -u $SERVICE -n 100"
  return 1
}

# Os workers que deviam estar a correr continuam ativos e sem reinícios uns segundos
# depois (um que rebenta ao arrancar fica em ciclo de Restart=on-failure)
check_workers() {
  local app unit root restarts=() i=0 failed=""
  root="$(app_root)"
  local units=()
  for app in "${PYTHON_APPS[@]}"; do
    unit="${SERVICE}-${app}"
    [ -f "/etc/systemd/system/${unit}.service" ] && [ -d "$root/apps/$app/intristock_$app" ] || continue
    units+=("$unit")
    restarts+=("$(systemctl show -p NRestarts --value "$unit" 2>/dev/null || echo 0)")
  done
  [ ${#units[@]} -gt 0 ] || return 0
  sleep 10
  for unit in "${units[@]}"; do
    if ! systemctl is-active --quiet "$unit" \
        || [ "$(systemctl show -p NRestarts --value "$unit" 2>/dev/null || echo 0)" != "${restarts[$i]}" ]; then
      warn "O $unit não ficou a correr. Logs: journalctl -u $unit -n 100"
      failed=1
    fi
    i=$((i + 1))
  done
  [ -z "$failed" ]
}

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
WorkingDirectory=${CURRENT_LINK}/apps/backend
EnvironmentFile=${BACKEND_ENV}
# O repositório (só leitura): o backend lê lá a versão instalada e as notas
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
#
# Memória: o simulador (numpy, um processo por simulação) é o que pode crescer sem fim.
# Fica com um teto (MemoryHigh trava, MemoryMax mata só dentro dele) e é o primeiro que o
# OOM killer escolhe; o Postgres é o último (configure_oom).
configure_workers() {
  msg "A configurar o downloader e o simulador…"
  local app description nice limits
  for app in "${PYTHON_APPS[@]}"; do
    case "$app" in
      downloader)
        description="IntriStock (downloader das velas)"; nice=0
        limits="OOMScoreAdjust=200" ;;
      simulator)
        description="IntriStock (simulador)"; nice=10
        limits=$'MemoryHigh=45%\nMemoryMax=55%\nOOMScoreAdjust=500' ;;
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
WorkingDirectory=${CURRENT_LINK}/apps/${app}
EnvironmentFile=${BACKEND_ENV}
Environment=PYTHONUNBUFFERED=1
ExecStart=${CURRENT_LINK}/apps/${app}/.venv/bin/python -m intristock_${app}
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
Nice=${nice}
${limits}
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

# O Postgres é o último que o OOM killer escolhe. No Debian o servidor corre na unit
# postgresql@<versão>-main, por isso o drop-in vai para o modelo dela. Só conta no
# próximo arranque do Postgres; os processos que já correm mudam-se aqui.
configure_oom() {
  mkdir -p /etc/systemd/system/postgresql@.service.d
  cat > /etc/systemd/system/postgresql@.service.d/intristock.conf <<EOF
# Escrito pelo instalador do IntriStock: o OOM killer escolhe primeiro o simulador
# (OOMScoreAdjust=500) e nunca a base de dados antes dele
[Service]
OOMScoreAdjust=-500
EOF
  systemctl daemon-reload
  local pid
  if command -v pgrep >/dev/null; then
    for pid in $(pgrep -u postgres 2>/dev/null || true); do
      echo -500 > "/proc/$pid/oom_score_adj" 2>/dev/null || true
    done
  fi
}

configure_nginx() {
msg "A configurar o nginx…"
# A API vai pelo mesmo endereço (/api). Se o frontend a chamar noutro sítio, a CSP
# tem de deixar o browser ligar-se lá.
local api_url connect_src="'self'"
api_url="$(env_value "$FRONTEND_ENV" VITE_API_URL)"
if [[ "$api_url" =~ ^(https?://[^/]+) ]]; then connect_src+=" ${BASH_REMATCH[1]}"; fi

mkdir -p /etc/nginx/snippets
# Os cabeçalhos de segurança vão num ficheiro à parte: um add_header numa location
# apaga os do server, por isso cada location com add_header inclui este outra vez.
cat > /etc/nginx/snippets/intristock-headers.conf <<EOF
# Escrito pelo instalador do IntriStock (é reescrito em cada atualização)
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src ${connect_src}; worker-src 'self' blob:; frame-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" always;
# Só quando o browser entrou por https (o proxy à frente diz-o no X-Forwarded-Proto)
add_header Strict-Transport-Security \$intristock_hsts always;
EOF

cat > /etc/nginx/sites-available/intristock <<EOF
# O protocolo que o browser usou de facto: um proxy à frente (ex. Nginx Proxy
# Manager) termina o https e manda X-Forwarded-Proto; aberto pelo IP não há
# cabeçalho e vale o deste nginx. O backend usa-o para o cookie "secure".
map \$http_x_forwarded_proto \$intristock_proto {
    default \$http_x_forwarded_proto;
    ""      \$scheme;
}

# HSTS só em https (vazio = o nginx não manda o cabeçalho)
map \$intristock_proto \$intristock_hsts {
    https   "max-age=31536000";
    default "";
}

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    server_tokens off;

    root ${WEB_ROOT};
    index index.html;
    disable_symlinks on;

    # O JS, o CSS e o JSON da API vão comprimidos (o SSE dos testes ao vivo não)
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 5;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/javascript application/javascript application/json image/svg+xml application/xml;

    include /etc/nginx/snippets/intristock-headers.conf;

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
        include /etc/nginx/snippets/intristock-headers.conf;
        try_files \$uri =404;
    }

    location = /index.html {
        add_header Cache-Control "no-cache";
        include /etc/nginx/snippets/intristock-headers.conf;
    }

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

# Os diretórios das atualizações. O $STATE_DIR é do root (a app só lê); no
# $UPDATES_DIR, que é da app, tudo se faz como a app — o root nunca escreve lá dentro.
prepare_update_dirs() {
  local name
  if [ -L "$STATE_DIR" ] || { [ -e "$STATE_DIR" ] && [ ! -d "$STATE_DIR" ]; }; then rm -f "$STATE_DIR"; fi
  mkdir -p "$STATE_DIR"
  chown root:"$APP_USER" "$STATE_DIR"
  chmod 750 "$STATE_DIR"
  for name in status.json update.log; do
    [ -f "$STATE_DIR/$name" ] || install -m 640 -o root -g "$APP_USER" /dev/null "$STATE_DIR/$name"
  done

  as_app mkdir -p "$UPDATES_DIR"
  as_app chmod 755 "$UPDATES_DIR"
  # Numa VM antiga o log estava aqui (escrito pelo root): o que lá estava passa para o
  # novo, lido como a app
  if [ -f "$UPDATES_DIR/update.log" ] && [ ! -L "$UPDATES_DIR/update.log" ]; then
    as_app cat "$UPDATES_DIR/update.log" >> "$STATE_DIR/update.log" 2>/dev/null || true
  fi
  for name in status.json update.log; do
    as_app ln -sfn "$STATE_DIR/$name" "$UPDATES_DIR/$name"
  done
  as_app rm -f "$UPDATES_DIR/.lock" "$UPDATES_DIR/status.json.tmp"
}

# Atualizações pela app. O backend corre sem privilégios e só escreve
# $UPDATES_DIR/request com a versão; esta unit .path (root) vê o ficheiro aparecer e
# corre o update.sh, que escreve o progresso em status.json e o output em update.log
# (no $STATE_DIR; a app lê-os pelos links em $UPDATES_DIR).
#
# As tags novas: o .git é do root, por isso quem as vai buscar à origem é o
# intristock-fetch.timer (de hora a hora, sem --force: uma tag que já cá estava não
# muda).
configure_updater() {
  msg "A configurar as atualizações pela app…"
  prepare_update_dirs

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

  cat > /etc/systemd/system/intristock-fetch.service <<EOF
[Unit]
Description=IntriStock — ir buscar as versões novas à origem
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
Environment=HOME=/root LANG=C.UTF-8 LC_ALL=C.UTF-8
ExecStart=/usr/bin/git -C ${APP_DIR} -c core.hooksPath=/dev/null -c core.fsmonitor=false fetch --quiet --tags origin
EOF

  cat > /etc/systemd/system/intristock-fetch.timer <<EOF
[Unit]
Description=IntriStock — versões novas, de hora a hora

[Timer]
OnBootSec=5min
OnUnitActiveSec=1h
RandomizedDelaySec=5min

[Install]
WantedBy=timers.target
EOF

  systemctl daemon-reload
  systemctl enable --now intristock-updater.path >/dev/null 2>&1
  systemctl enable --now intristock-fetch.timer >/dev/null 2>&1
}

# intristock-update / intristock-config. Em /usr/bin e não em /usr/local/bin: o PATH
# de um "sudo" nem sempre inclui /usr/local/bin. Apontam para o repo, que é do root.
install_commands() {
  local dir; dir="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
  chmod 755 "$dir"/*.sh
  ln -sf "$dir/update.sh" /usr/bin/intristock-update
  ln -sf "$dir/config.sh" /usr/bin/intristock-config
}

# O backup.env (a cópia externa e os dias que se guardam), criado vazio na primeira vez
ensure_backup_env() {
  if [ ! -f "$BACKUP_ENV" ]; then
    mkdir -p "$CONFIG_DIR"
    cat > "$BACKUP_ENV" <<EOF
# Backups do IntriStock (backup.sh). Edita com:  intristock-config
#
# Uma pasta fora do disco da VM (NFS, SMB, um disco montado) para onde se copia cada
# backup diário. Em branco, os backups ficam só em ${BACKUP_DIR}.
BACKUP_COPY_DIR=""
# Dias que se guardam a base de dados e a configuração (por omissão 14)
BACKUP_KEEP_DAYS=""
# Dias que se guardam as cópias dos documentos do Garage, que são maiores (por omissão 3)
BACKUP_GARAGE_KEEP_DAYS=""
EOF
  fi
  chown root:root "$BACKUP_ENV"
  chmod 600 "$BACKUP_ENV"
}

configure_backups() {
  mkdir -p "$BACKUP_DIR"
  chmod 700 "$BACKUP_DIR"
  ensure_backup_env
  cat > /etc/cron.d/intristock-backup <<EOF
# Backup diário às 03:30: a base de dados, a configuração (/etc/intristock) e os
# documentos do Garage (ver backup.sh). Um snapshot da VM com o Postgres a correr nem
# sempre é consistente; o dump é. Uma falha fica no log, no journal e em
# ${STATE_DIR}/backup.json.
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
