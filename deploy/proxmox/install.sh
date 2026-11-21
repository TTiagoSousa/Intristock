#!/usr/bin/env bash
# Instala o IntriStock dentro de uma VM Debian 13 (o vm-create.sh chama-o pelo
# cloud-init; também se pode correr à mão dentro da VM). Corre como root, a partir
# do repo já clonado em /opt/intristock.
#
# Deixa a correr: PostgreSQL, Garage (S3) e ClickHouse locais, o backend como serviço
# systemd (127.0.0.1:3000), o downloader e o simulador (Python) como serviços também, e o
# nginx na porta 80 a servir o frontend e a encaminhar /api.
#
# Pode correr-se outra vez sem estragar nada: os segredos, a base de dados e o
# storage que já existem ficam como estão.
#
# Variáveis (todas opcionais):
#   APP_URL         endereço por onde se abre a app (omissão: http://<IP da VM>)
#   ADMIN_EMAIL     login do primeiro utilizador, fica ADMIN (omissão: admin)
#   ADMIN_PASSWORD  password dele (omissão: gera-se uma aleatória, mostrada uma vez no fim
#                   da instalação; não fica escrita em lado nenhum)
#   TZ_NAME         fuso horário (omissão: Europe/Lisbon)
set -euo pipefail

# O Debian cloud só traz o locale C; um LANG herdado faria o perl/apt avisar a cada comando
export LANG=C.UTF-8 LC_ALL=C.UTF-8
export PATH="/usr/local/bin:$PATH"
export npm_config_update_notifier=false PRISMA_HIDE_UPDATE_MESSAGE=1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"

require_root

TZ_NAME="${TZ_NAME:-Europe/Lisbon}"
# O vm-create.sh lê este ficheiro para mostrar o progresso no host
STEP_FILE="$APP_HOME/install-step"

ip_address() { hostname -I 2>/dev/null | awk '{print $1}'; }
APP_URL="${APP_URL:-http://$(ip_address)}"
APP_URL="${APP_URL%/}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin}"
# Sem password escolhida gera-se uma (só conta se a conta for criada agora)
ADMIN_PASSWORD_GENERATED=""
if [ -z "${ADMIN_PASSWORD:-}" ]; then
  ADMIN_PASSWORD="$(openssl rand -base64 18 | tr -d '\n/+=')"
  ADMIN_PASSWORD_GENERATED="yes"
fi

# Depois de o utilizador da app existir, o passo escreve-se como ele: a pasta é dele, e o
# root não escreve em pastas da app (um link lá posto levava a escrita para outro sítio)
step() {
  mkdir -p "$APP_HOME"
  if id "$APP_USER" >/dev/null 2>&1; then
    printf '%s\n' "$1" | as_app tee "$STEP_FILE" >/dev/null || true
  else
    printf '%s\n' "$1" > "$STEP_FILE"
  fi
  msg "$1"
}

# --- sistema --------------------------------------------------------------------------

step "Programas do sistema"
ensure_system_packages
configure_security_updates

msg "Fuso horário: $TZ_NAME"
ln -sf "/usr/share/zoneinfo/$TZ_NAME" /etc/localtime
echo "$TZ_NAME" > /etc/timezone

step "Node.js"
ensure_node

# --- utilizador da app ----------------------------------------------------------------

if ! id "$APP_USER" >/dev/null 2>&1; then
  msg "A criar o utilizador de sistema $APP_USER…"
  useradd --system --home-dir "$APP_HOME" --create-home --shell /usr/sbin/nologin "$APP_USER"
fi
mkdir -p "$APP_HOME"
chown -R "$APP_USER:$APP_USER" "$APP_HOME"
# O código é do root (a app só o lê); compila-se num diretório da app em $BUILDS_DIR
secure_repo
scrub_credentials_file

# --- PostgreSQL -----------------------------------------------------------------------

step "Base de dados (PostgreSQL)"
systemctl enable --now postgresql >/dev/null

mkdir -p "$CONFIG_DIR"
chmod 750 "$CONFIG_DIR"

if [ -f "$BACKEND_ENV" ]; then
  msg "Configuração existente em $BACKEND_ENV — mantida (segredos e base de dados)."
  # Reaproveita a password da base de dados para o caso de ser preciso recriar o role
  DB_PASS="$(sed -n 's#^DATABASE_URL="postgresql://[^:]*:\([^@]*\)@.*#\1#p' "$BACKEND_ENV")"
else
  DB_PASS="$(random_secret 24 | tr -d '/+=')"
fi

if ! runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
  runuser -u postgres -- psql -qc "CREATE ROLE $DB_USER LOGIN PASSWORD '$DB_PASS';"
fi
if ! runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
  runuser -u postgres -- psql -qc "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
fi

# --- configuração ---------------------------------------------------------------------

if [ ! -f "$BACKEND_ENV" ]; then
  msg "A gerar $BACKEND_ENV…"
  cat > "$BACKEND_ENV" <<EOF
# Configuração do backend do IntriStock. Edita com:  intristock-config
# (abre um menu e reinicia o backend se houver alterações)

NODE_ENV=production
HOST=127.0.0.1
PORT=${BACKEND_PORT}
TZ=${TZ_NAME}

DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}"

# Endereço por onde se abre a app (CORS). Com https à frente, o cookie fica "secure".
FRONTEND_URL="${APP_URL}"

JWT_SECRET="$(random_secret 48)"
JWT_USER_SECRET="$(random_secret 48)"

# ⚠ NÃO ALTERAR: cifra as chaves das APIs guardadas na base de dados. Se mudar,
# deixam de abrir e o admin tem de as voltar a meter em Definições → APIs.
# Guarda uma cópia fora da VM (o backup diário também a leva).
ENCRYPTION_KEY="$(random_secret 32)"

# Storage dos documentos (Garage local) — preenchido pelo instalador
EOF
fi
chown root:"$APP_USER" "$BACKEND_ENV"
chmod 640 "$BACKEND_ENV"

if [ ! -f "$FRONTEND_ENV" ]; then
  cat > "$FRONTEND_ENV" <<EOF
# Configuração do frontend do IntriStock. Só conta no build: depois de mudar,
# o intristock-config volta a compilar e a publicar o site.
#
# A API vai pelo mesmo endereço do site (/api), através do nginx desta VM.
VITE_API_URL="/api"
EOF
fi
chmod 644 "$FRONTEND_ENV"

# --- Garage ---------------------------------------------------------------------------

step "Storage dos documentos (Garage)"
ensure_garage
setup_garage_storage

# --- ClickHouse -----------------------------------------------------------------------

step "Velas do simulador (ClickHouse)"
ensure_clickhouse
setup_clickhouse_access

# --- build e base de dados ------------------------------------------------------------

# Compila-se num diretório novo (o que estiver a correr, numa reinstalação, não se toca)
# e só no fim o $CURRENT_LINK passa para ele
step "Compilar a app (alguns minutos)"
PREV_BUILD="$(current_build)"
BUILD_DIR="$(new_build_dir HEAD)"
build_app

step "Migrações da base de dados"
migrate_db
publish_frontend

# --- serviços (lib.sh) ----------------------------------------------------------------

step "Serviços e nginx"
switch_current "$BUILD_DIR"
configure_service
configure_workers
configure_oom
configure_updater
restart_backend
configure_nginx
install_commands
configure_backups
prune_builds "$PREV_BUILD"
cleanup_legacy_build

# --- primeiro utilizador --------------------------------------------------------------

# Direto na base de dados: não há registo público. A password é a escolhida ou a gerada
USERS="$(runuser -u postgres -- psql -d "$DB_NAME" -tAc 'SELECT count(*) FROM "User"')"
ADMIN_CREATED=""
if [ "$USERS" = "0" ]; then
  msg "A criar a conta ${ADMIN_EMAIL} (ADMIN)…"
  load_env
  if ( cd "$CURRENT_LINK/apps/backend" && as_app env DATABASE_URL="$DATABASE_URL" \
        ADMIN_EMAIL="$ADMIN_EMAIL" ADMIN_PASSWORD="$ADMIN_PASSWORD" \
        node "$SCRIPT_DIR/create-admin.cjs" ); then
    ADMIN_CREATED="yes"
  else
    warn "Não consegui criar a conta ${ADMIN_EMAIL}."
  fi
fi

# --- credenciais ----------------------------------------------------------------------

# A password do admin não fica escrita: quem a escolheu sabe-a, e a gerada só aparece
# uma vez, no fim da instalação.
# O resto já está no backend.env; este ficheiro é uma cópia para guardar fora da VM.
if [ -n "$ADMIN_CREATED" ] || [ ! -f "$CREDS_FILE" ]; then
  load_env
  {
    echo "IntriStock — credenciais geradas na instalação ($(date '+%Y-%m-%d %H:%M'))"
    echo
    echo "Guarda uma cópia disto fora da VM (um gestor de passwords) e apaga o ficheiro:"
    echo "  shred -u ${CREDS_FILE}"
    echo
    echo "App:             ${APP_URL}"
    [ -n "$ADMIN_CREATED" ] && echo "Login:           ${ADMIN_EMAIL}"
    echo
    echo "Base de dados:   ${DATABASE_URL}"
    echo "ENCRYPTION_KEY:  ${ENCRYPTION_KEY}   (nunca mudar)"
  } > "$CREDS_FILE"
  chmod 600 "$CREDS_FILE"
fi

step "Pronto"

# A password só aparece se foi gerada aqui (a escolhida, quem a escolheu sabe-a). A que
# vem do vm-create.sh (gerada no host e mostrada lá) conta como escolhida, por isso não
# chega ao log da instalação.
shown_password="(a que escolheste)"
[ "$ADMIN_PASSWORD" = "admin" ] && shown_password="admin"
[ -n "$ADMIN_PASSWORD_GENERATED" ] \
  && shown_password="$(printf '\033[1;33m%s\033[0m   (gerada — guarda-a já, não volta a aparecer)' "$ADMIN_PASSWORD")"

cat <<EOF

$(printf '\033[1;32m')IntriStock instalado.$(printf '\033[0m')

  App:            ${APP_URL}
$( [ -n "$ADMIN_CREATED" ] && printf '  Login:          %s\n  Password:       %s\n' "$ADMIN_EMAIL" "$shown_password")
  Credenciais:    ${CREDS_FILE}   (só root — guarda uma cópia fora da VM e apaga-o)
  Configurar:     intristock-config     (backend, frontend e backups, num menu)
  Atualizar:      intristock-update     (a versão seguinte à instalada)
  Logs:           journalctl -u ${SERVICE} -f
                  journalctl -u ${SERVICE}-downloader -u ${SERVICE}-simulator -f
  Backups:        ${BACKUP_DIR}   (todos os dias às 03:30: base de dados, configuração e documentos)

  Ao abrir a app pela primeira vez, o admin mete as chaves das APIs de moedas
  e de países — os países, as moedas, os impostos e as plataformas entram logo.
$( [ -n "$ADMIN_CREATED" ] && [ "$ADMIN_PASSWORD" = "admin" ] && printf '\n  \033[1;33m⚠ A password do admin é "admin". Muda-a em Definições → Segurança antes de abrir a app à internet.\033[0m\n')

EOF
