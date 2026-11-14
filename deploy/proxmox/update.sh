#!/usr/bin/env bash
# intristock-update — instala a versão seguinte (ou um branch, para testes) e põe-na
# a correr: fetch, checkout, programas da VM, dependências, build, migrações,
# frontend, units do systemd, nginx, restart.
#
# Uso (dentro da VM, como root):
#   intristock-update              # a versão seguinte à instalada (uma de cada vez)
#   intristock-update v1.4.0       # uma versão específica — tem de ser a seguinte
#   intristock-update develop      # um branch (testes)
#   FORCE=1 intristock-update      # recompilar mesmo sem nada novo
#
# Atualiza-se uma versão de cada vez: cada uma pode trazer passos próprios para a VM
# (deploy/proxmox/upgrades/<versão>.sh, programas novos no SYSTEM_PACKAGES) que
# contam com a anterior já instalada.
#
# O botão "Atualizar" da app escreve a versão em $UPDATES_DIR/request; uma unit .path
# do systemd corre então este script com --from-request. O progresso vai para
# status.json (lido pela app) e o output para update.log.
#
# Se um passo falhar, a versão anterior volta a ser posta, compilada e reiniciada, e a
# app continua a correr na versão que tinha.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"

require_root
export LANG=C.UTF-8 LC_ALL=C.UTF-8 PATH="/usr/local/bin:$PATH"
export npm_config_update_notifier=false PRISMA_HIDE_UPDATE_MESSAGE=1
cd "$APP_DIR"

STATUS_FILE="$UPDATES_DIR/status.json"
LOG_FILE="$UPDATES_DIR/update.log"
VERSION_RE='^v[0-9]+\.[0-9]+\.[0-9]+$'

json() { # escapa uma string para JSON
  local s="$1"
  s="${s//\\/\\\\}"; s="${s//\"/\\\"}"; s="${s//$'\n'/ }"; s="${s//$'\r'/}"
  printf '"%s"' "$s"
}

# status ESTADO PASSO MENSAGEM — escrito de forma atómica; a app lê-o de 2 em 2 s
status() {
  local finished=null
  case "$1" in success|failed) finished="$(json "$(date -Is)")" ;; esac
  {
    printf '{"state":%s,"target":%s,"from":%s,"step":%s,"message":%s,' \
      "$(json "$1")" "$(json "${TARGET_LABEL:-}")" "$(json "${FROM_LABEL:-}")" "$(json "$2")" "$(json "$3")"
    printf '"startedAt":%s,"finishedAt":%s}\n' "$(json "${STARTED_AT:-}")" "$finished"
  } > "$STATUS_FILE.tmp"
  chmod 644 "$STATUS_FILE.tmp"
  mv "$STATUS_FILE.tmp" "$STATUS_FILE"
}

installed_label() { # vX.Y.Z quando o HEAD é uma release, senão o commit curto
  as_app git describe --tags --exact-match --match 'v*' HEAD 2>/dev/null || as_app git rev-parse --short HEAD
}

# A release mais recente em que o código instalado assenta
installed_base() { as_app git describe --tags --abbrev=0 --match 'v*' HEAD 2>/dev/null || true; }

# A primeira release depois de $1 (ou a primeira de todas, sem $1)
next_release() {
  local base="$1" tag
  while read -r tag; do
    [[ "$tag" =~ $VERSION_RE ]] || continue
    if [ -z "$base" ] || [ "$(printf '%s\n%s\n' "$base" "$tag" | sort -V | tail -1)" = "$tag" ] && [ "$tag" != "$base" ]; then
      echo "$tag"
      return
    fi
  done < <(as_app git tag -l 'v*' --sort=v:refname)
}

# ======================================================================================
# Etapa 1 — decide o alvo, faz checkout e corre a cópia *nova* deste script: o checkout
# pode ter mudado o lib.sh ou este ficheiro.
# ======================================================================================
if [ "${INTRISTOCK_STAGE:-1}" = 1 ]; then
  mkdir -p "$UPDATES_DIR"
  chown "$APP_USER:$APP_USER" "$UPDATES_DIR"

  # Uma atualização de cada vez (o lock passa para a etapa 2)
  exec 9>"$UPDATES_DIR/.lock"
  flock -n 9 || die "Já há uma atualização a correr."

  TARGET="${1:-next}"
  if [ "$TARGET" = "--from-request" ]; then
    [ -f "$UPDATES_DIR/request" ] || exit 0
    TARGET="$(tr -d '[:space:]' < "$UPDATES_DIR/request")"
    # Apagado logo: enquanto existir, a unit .path volta a disparar
    rm -f "$UPDATES_DIR/request"
    if ! [[ "$TARGET" =~ $VERSION_RE ]]; then
      STARTED_AT="$(date -Is)"
      status failed request "Pedido de atualização inválido: '$TARGET'"
      die "Pedido de atualização inválido: '$TARGET'"
    fi
  fi

  : > "$LOG_FILE"
  chmod 644 "$LOG_FILE"
  exec > >(tee -a "$LOG_FILE") 2>&1

  STARTED_AT="$(date -Is)"
  FROM_LABEL="$(installed_label)"
  TARGET_LABEL="$TARGET"
  status running fetch "A procurar versões"
  # Ainda nada mudou nesta etapa — só se regista a falha para a app
  set -E
  trap 'status failed fetch "Não consegui descarregar ou pôr a ${TARGET_LABEL} (ver update.log)"' ERR

  msg "A ir buscar versões à origem…"
  as_app git fetch --quiet --tags --force origin

  BASE="$(installed_base)"
  NEXT="$(next_release "$BASE")"
  if [ "$TARGET" = next ]; then
    if [ -z "$NEXT" ]; then
      msg "Já estás na versão mais recente (${FROM_LABEL})."
      status success "done" "Já está na versão mais recente"
      exit 0
    fi
    TARGET="$NEXT"
  fi
  TARGET_LABEL="$TARGET"

  # Uma versão de cada vez: só a seguinte à instalada (branches ficam de fora — são testes)
  if [[ "$TARGET" =~ $VERSION_RE ]] && [ "$TARGET" != "$NEXT" ]; then
    status failed fetch "Atualiza-se uma versão de cada vez: a seguir à ${BASE:-instalada} vem a ${NEXT:-nenhuma}"
    die "Atualiza-se uma versão de cada vez: a seguir à ${BASE:-instalada} vem a ${NEXT:-nenhuma}."
  fi

  BEFORE="$(as_app git rev-parse HEAD)"
  if [[ "$TARGET" =~ $VERSION_RE ]]; then
    as_app git rev-parse -q --verify "refs/tags/$TARGET" >/dev/null \
      || { status failed fetch "A versão $TARGET não existe"; die "A versão $TARGET não existe."; }
    msg "A pôr a versão $TARGET…"
    as_app git checkout --quiet --force "refs/tags/$TARGET"
  else
    as_app git rev-parse -q --verify "refs/remotes/origin/$TARGET" >/dev/null \
      || { status failed fetch "O branch $TARGET não existe"; die "O branch $TARGET não existe."; }
    msg "A pôr o branch $TARGET…"
    as_app git checkout --quiet --force "$TARGET" 2>/dev/null \
      || as_app git checkout --quiet --force -b "$TARGET" "origin/$TARGET"
    as_app git reset --quiet --hard "origin/$TARGET"
  fi

  INTRISTOCK_STAGE=2 BEFORE="$BEFORE" TARGET_LABEL="$TARGET_LABEL" FROM_LABEL="$FROM_LABEL" \
    STARTED_AT="$STARTED_AT" exec bash "$SCRIPT_DIR/update.sh"
fi

# ======================================================================================
# Etapa 2 — prepara a VM, compila e troca para o código novo; se algo falhar, volta atrás.
# ======================================================================================
AFTER="$(as_app git rev-parse HEAD)"

if [ "$BEFORE" = "$AFTER" ] && [ "${FORCE:-}" != "1" ]; then
  msg "Já está em dia (${TARGET_LABEL}). Para recompilar na mesma: FORCE=1 intristock-update"
  status success "done" "Já está na $TARGET_LABEL"
  exit 0
fi

msg "A atualizar ${FROM_LABEL} → ${TARGET_LABEL}"
as_app git log --oneline "$BEFORE..$AFTER" 2>/dev/null | head -20 || true

STEP=""
rollback() {
  local failed_step="$STEP"
  trap - ERR
  set +e
  warn "O passo '$failed_step' falhou — a voltar à $FROM_LABEL."
  status running rollback "O passo '$failed_step' falhou — a repor a $FROM_LABEL"
  if as_app git checkout --quiet --force "$BEFORE" \
      && build_app && publish_frontend && restart_backend; then
    status failed "$failed_step" "A atualização para a $TARGET_LABEL falhou em '$failed_step'. Continua a correr a $FROM_LABEL."
  else
    status failed "$failed_step" "A atualização falhou em '$failed_step' e a reposição também. Vê o update.log."
  fi
  exit 1
}
set -E
trap rollback ERR

step() { STEP="$1"; status running "$1" "$2"; }

# Os programas de que a versão nova precisa: os do SYSTEM_PACKAGES, o Node, a versão
# do Garage, o ClickHouse e, se existir, o passo próprio desta versão
# (upgrades/<versão>.sh)
prepare_system() {
  ensure_system_packages
  ensure_node
  ensure_garage
  ensure_clickhouse
  setup_clickhouse_access
  local hook="$SCRIPT_DIR/upgrades/${TARGET_LABEL}.sh"
  if [ -f "$hook" ]; then
    msg "Passo próprio da ${TARGET_LABEL}: $hook"
    bash "$hook"
  fi
}

step system "A preparar os programas da VM";        prepare_system
step build "A instalar dependências e a compilar";   build_app
step migrate "A aplicar as migrações";               migrate_db
step publish "A publicar o frontend";                publish_frontend
step configure "A atualizar serviços e nginx";       configure_service; configure_workers; configure_updater; install_commands
step restart "A reiniciar o backend";                restart_backend
configure_nginx

trap - ERR
status success "done" "Atualizado para a $TARGET_LABEL"
msg "Atualizado para a $TARGET_LABEL."
