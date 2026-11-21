#!/usr/bin/env bash
# intristock-update — instala a versão seguinte (ou um branch, para testes) e põe-na
# a correr: fetch, verificação da tag, checkout, programas da VM, build num diretório
# novo, backup da base de dados, migrações, frontend, units do systemd, nginx, restart.
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
# $STATE_DIR/status.json e o output para $STATE_DIR/update.log (a app lê-os pelos links
# no $UPDATES_DIR).
#
# A versão nova compila-se num diretório à parte ($BUILDS_DIR), com a anterior a correr;
# só no fim o link $CURRENT_LINK passa para ela. Se um passo falhar (ou o script sair a
# meio por qualquer motivo), volta tudo atrás: o link para o build anterior, o frontend
# anterior e, se as migrações já tinham começado, a base de dados do backup feito logo
# antes delas.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"

require_root
export LANG=C.UTF-8 LC_ALL=C.UTF-8 PATH="/usr/local/bin:$PATH"
export npm_config_update_notifier=false PRISMA_HIDE_UPDATE_MESSAGE=1
cd "$APP_DIR"

STATUS_FILE="$STATE_DIR/status.json"
LOG_FILE="$STATE_DIR/update.log"
LOCK_FILE="$STATE_DIR/update.lock"
VERSION_RE='^v[0-9]+\.[0-9]+\.[0-9]+$'
LAST_STATE=""

# status ESTADO PASSO MENSAGEM — escrito de forma atómica; a app lê-o de 2 em 2 s
status() {
  local finished=null
  LAST_STATE="$1"
  case "$1" in success|failed) finished="$(json_str "$(date -Is)")" ;; esac
  {
    printf '{"state":%s,"target":%s,"from":%s,"step":%s,"message":%s,' \
      "$(json_str "$1")" "$(json_str "${TARGET_LABEL:-}")" "$(json_str "${FROM_LABEL:-}")" "$(json_str "$2")" "$(json_str "$3")"
    printf '"startedAt":%s,"finishedAt":%s}\n' "$(json_str "${STARTED_AT:-}")" "$finished"
  } > "$STATUS_FILE.tmp"
  chown root:"$APP_USER" "$STATUS_FILE.tmp"
  chmod 640 "$STATUS_FILE.tmp"
  mv -f "$STATUS_FILE.tmp" "$STATUS_FILE"
}

installed_label() { # vX.Y.Z quando o HEAD é uma release, senão o commit curto
  rgit describe --tags --exact-match --match 'v*' HEAD 2>/dev/null || rgit rev-parse --short HEAD
}

# A release mais recente em que o código instalado assenta
installed_base() { rgit describe --tags --abbrev=0 --match 'v*' HEAD 2>/dev/null || true; }

# A primeira release depois de $1 (ou a primeira de todas, sem $1)
next_release() {
  local base="$1" tag
  while read -r tag; do
    [[ "$tag" =~ $VERSION_RE ]] || continue
    if [ -z "$base" ] || [ "$(printf '%s\n%s\n' "$base" "$tag" | sort -V | tail -1)" = "$tag" ] && [ "$tag" != "$base" ]; then
      echo "$tag"
      return
    fi
  done < <(rgit tag -l 'v*' --sort=v:refname)
}

# ======================================================================================
# Etapa 1 — decide o alvo, verifica a tag, faz checkout e corre a cópia *nova* deste
# script: o checkout pode ter mudado o lib.sh ou este ficheiro.
# ======================================================================================
if [ "${INTRISTOCK_STAGE:-1}" = 1 ]; then
  prepare_update_dirs

  # Uma atualização de cada vez (o lock passa para a etapa 2)
  exec 9>"$LOCK_FILE"
  flock -n 9 || die "Já há uma atualização a correr."

  TARGET="${1:-next}"
  if [ "$TARGET" = "--from-request" ]; then
    [ -e "$UPDATES_DIR/request" ] || [ -L "$UPDATES_DIR/request" ] || exit 0
    # Lido como a app (o ficheiro é dela: um link para um ficheiro do root não se lê) e
    # apagado logo: enquanto existir, a unit .path volta a disparar
    TARGET="$(as_app head -c 64 "$UPDATES_DIR/request" 2>/dev/null | tr -d '[:space:]' || true)"
    rm -f "$UPDATES_DIR/request"
    if ! [[ "$TARGET" =~ $VERSION_RE ]]; then
      STARTED_AT="$(date -Is)"
      status failed request "Pedido de atualização inválido: '$TARGET'"
      die "Pedido de atualização inválido: '$TARGET'"
    fi
  fi

  : > "$LOG_FILE"
  chown root:"$APP_USER" "$LOG_FILE"
  chmod 640 "$LOG_FILE"
  exec > >(tee -a "$LOG_FILE") 2>&1

  STARTED_AT="$(date -Is)"
  TARGET_LABEL="$TARGET"
  CHECKED_OUT=""
  BEFORE=""
  status running fetch "A procurar versões"

  # Qualquer saída com erro nesta etapa (um die, um comando que falha, um sinal): o
  # código volta ao que estava e a app vê "failed". O exec da etapa 2 não passa por aqui.
  stage1_exit() {
    local rc=$?
    [ "$rc" -ne 0 ] || return 0
    if [ -n "$CHECKED_OUT" ]; then rgit checkout --quiet --force "$BEFORE" || true; fi
    if [ "$LAST_STATE" = running ]; then
      status failed fetch "Não consegui descarregar ou pôr a ${TARGET_LABEL} (ver update.log)"
    fi
  }
  trap stage1_exit EXIT
  trap 'exit 143' TERM INT HUP

  # O código passa a ser do root antes de o root correr o git nele
  secure_repo
  FROM_LABEL="$(installed_label)"
  BEFORE="$(rgit rev-parse HEAD)"
  status running fetch "A procurar versões"

  # Sem --force: uma tag que esta VM já tem não muda em silêncio (só uma tag nova entra)
  msg "A ir buscar versões à origem…"
  fetch_rc=0
  fetch_out="$(rgit fetch --quiet --tags origin 2>&1)" || fetch_rc=$?
  [ -z "$fetch_out" ] || printf '%s\n' "$fetch_out"
  if [ "$fetch_rc" -ne 0 ]; then
    if grep -q 'would clobber existing tag' <<<"$fetch_out"; then
      status failed fetch "Uma tag que esta VM já tinha mudou na origem — recusada. Vê o update.log."
      die "Uma tag que esta VM já tinha mudou na origem. Confirma no repositório oficial antes de continuar (git -C $APP_DIR fetch --tags origin)."
    fi
    status failed fetch "Não consegui ir buscar as versões à origem (ver update.log)"
    die "Não consegui ir buscar as versões à origem."
  fi

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

  if [[ "$TARGET" =~ $VERSION_RE ]]; then
    rgit rev-parse -q --verify "refs/tags/$TARGET" >/dev/null \
      || { status failed fetch "A versão $TARGET não existe"; die "A versão $TARGET não existe."; }
    # A partir daqui o root corre o lib.sh e os upgrades/*.sh desta tag
    verify_release_tag "$TARGET" \
      || { status failed fetch "A assinatura da $TARGET não é válida — atualização recusada"; die "A assinatura da $TARGET não é válida."; }
    msg "A pôr a versão $TARGET…"
    CHECKED_OUT=1
    rgit checkout --quiet --force "refs/tags/$TARGET"
  else
    rgit rev-parse -q --verify "refs/remotes/origin/$TARGET" >/dev/null \
      || { status failed fetch "O branch $TARGET não existe"; die "O branch $TARGET não existe."; }
    warn "Um branch não é uma release: não há assinatura para verificar."
    msg "A pôr o branch $TARGET…"
    CHECKED_OUT=1
    rgit checkout --quiet --force "$TARGET" 2>/dev/null \
      || rgit checkout --quiet --force -b "$TARGET" "origin/$TARGET"
    rgit reset --quiet --hard "origin/$TARGET"
  fi

  INTRISTOCK_STAGE=2 INTRISTOCK_LOCKED=1 BEFORE="$BEFORE" TARGET_LABEL="$TARGET_LABEL" \
    FROM_LABEL="$FROM_LABEL" STARTED_AT="$STARTED_AT" exec bash "$SCRIPT_DIR/update.sh"
fi

# ======================================================================================
# Etapa 2 — prepara a VM, compila ao lado e troca para o código novo; se algo falhar,
# volta atrás.
# ======================================================================================

# Chamada pela etapa 1 de uma versão anterior a esta (uma VM antiga): o lock, o estado e
# o log ainda estavam no $UPDATES_DIR, que é da app. Passam para o $STATE_DIR.
if [ -z "${INTRISTOCK_LOCKED:-}" ]; then
  prepare_update_dirs
  exec 8>"$LOCK_FILE"
  flock -n 8 || die "Já há uma atualização a correr."
  chown root:"$APP_USER" "$LOG_FILE"
  chmod 640 "$LOG_FILE"
  exec > >(tee -a "$LOG_FILE") 2>&1
fi

STEP="prepare"
PREV_BUILD=""
NEW_BUILD=""
PRE_DUMP=""
MIGRATING=""
PUBLISHED=""
CONFIGURED=""
FINISHED=""

# Cada parte do rollback corre num subshell com set -e: um die ou um comando que falha
# acaba só essa parte (o rollback continua e escreve o estado final). Num contexto
# testado (if, ||, &&) o bash ignora o set -e, por isso o resultado vem no RB_RC.
attempt() { # attempt FUNÇÃO — marca ok="" se falhar
  ( set -e; "$@" )
  RB_RC=$?
  [ "$RB_RC" -eq 0 ] || ok=""
  return 0
}

rb_checkout() { rgit checkout --quiet --force "$BEFORE"; }
rb_restore_db() { stop_app; restore_db "$PRE_DUMP"; }

# O build anterior continua compilado: basta voltar a apontar para ele
rb_previous_build() {
  BUILD_DIR="$PREV_BUILD"
  [ -z "$CONFIGURED" ] || switch_current "$PREV_BUILD"
  [ -z "$PUBLISHED" ] || publish_frontend
  if [ -n "$CONFIGURED" ]; then configure_service; configure_workers; fi
  if [ -n "$CONFIGURED$MIGRATING" ]; then restart_backend; fi
}

# VM antiga (o build era no próprio repo) e as units já apontam para o link: compila-se
# a versão anterior num diretório novo
rb_rebuild() {
  BUILD_DIR="$(new_build_dir "$BEFORE")"
  build_app
  publish_frontend
  switch_current "$BUILD_DIR"
  configure_service
  configure_workers
  restart_backend
}

# VM antiga com as units por mudar: o código anterior continua compilado no repo
rb_legacy_in_place() {
  BUILD_DIR="$APP_DIR"
  [ -z "$PUBLISHED" ] || publish_frontend
  if [ -n "$MIGRATING" ]; then restart_backend; fi
}

rollback() {
  local failed_step="$STEP" ok=1 restored=""
  trap '' TERM INT HUP
  set +e
  warn "O passo '$failed_step' falhou — a voltar à $FROM_LABEL."
  status running rollback "O passo '$failed_step' falhou — a repor a $FROM_LABEL"

  attempt rb_checkout

  # As migrações começaram: o código antigo não pode correr no schema novo
  if [ -n "$MIGRATING" ]; then
    if [ -n "$PRE_DUMP" ] && [ -s "$PRE_DUMP" ]; then
      msg "A repor a base de dados de antes das migrações…"
      attempt rb_restore_db
      [ "$RB_RC" -ne 0 ] || restored=1
    else
      warn "Não há backup de antes das migrações para repor."
      ok=""
    fi
  fi

  if [ -n "$PREV_BUILD" ]; then
    attempt rb_previous_build
  elif [ -n "$CONFIGURED" ]; then
    attempt rb_rebuild
  else
    attempt rb_legacy_in_place
  fi

  # O build que falhou já não serve
  if [ -n "$NEW_BUILD" ] && [ "$(current_build)" != "$NEW_BUILD" ]; then rm -rf "$NEW_BUILD"; fi

  if [ -n "$ok" ]; then
    status failed "$failed_step" "A atualização para a $TARGET_LABEL falhou em '$failed_step'. Continua a correr a $FROM_LABEL${restored:+ (base de dados reposta do backup de antes das migrações)}."
  else
    status failed "$failed_step" "A atualização falhou em '$failed_step' e a reposição também. Vê o update.log."
  fi
  FINISHED=1
  exit 1
}

# Qualquer saída com erro (set -e, um die, um sinal) passa pelo rollback
on_exit() {
  local rc=$?
  [ -z "$FINISHED" ] || return 0
  [ "$rc" -ne 0 ] || return 0
  rollback
}
trap on_exit EXIT
trap 'exit 143' TERM INT HUP

# O código é do root; o token e a password do admin saem de onde a app lê (VMs antigas)
secure_repo
scrub_credentials_file

AFTER="$(rgit rev-parse HEAD)"
PREV_BUILD="$(current_build)"

if [ "$BEFORE" = "$AFTER" ] && [ "${FORCE:-}" != "1" ]; then
  msg "Já está em dia (${TARGET_LABEL}). Para recompilar na mesma: FORCE=1 intristock-update"
  status success "done" "Já está na $TARGET_LABEL"
  FINISHED=1
  exit 0
fi

msg "A atualizar ${FROM_LABEL} → ${TARGET_LABEL}"
rgit log --oneline "$BEFORE..$AFTER" 2>/dev/null | head -20 || true

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
  ensure_backup_env
  local hook="$SCRIPT_DIR/upgrades/${TARGET_LABEL}.sh"
  if [ -f "$hook" ]; then
    msg "Passo próprio da ${TARGET_LABEL}: $hook"
    bash "$hook"
  fi
}

# O dump de antes das migrações (é o que o rollback repõe). O mais perto possível delas:
# o que se escrever na app entre o dump e uma falha perde-se na reposição.
backup_before_migrate() {
  local stamp; stamp="$(date +%Y%m%d-%H%M%S)"
  PRE_DUMP="$(backup_db_file "pre-$TARGET_LABEL" "$stamp")"
  BACKUP_STAMP="$stamp" bash "$SCRIPT_DIR/backup.sh" "pre-$TARGET_LABEL"
  [ -s "$PRE_DUMP" ] || die "O backup de antes da atualização não ficou em $PRE_DUMP."
}

step system "A preparar os programas da VM";        prepare_system
step build "A instalar dependências e a compilar"
NEW_BUILD="$(new_build_dir HEAD)"
BUILD_DIR="$NEW_BUILD"
build_app
step backup "A guardar uma cópia da base de dados";  backup_before_migrate
step migrate "A aplicar as migrações";               MIGRATING=1; migrate_db
step publish "A publicar o frontend";                PUBLISHED=1; publish_frontend
step configure "A atualizar serviços e nginx"
CONFIGURED=1
switch_current "$NEW_BUILD"
configure_service
configure_workers
configure_oom
configure_updater
install_commands
configure_backups
configure_nginx
step restart "A reiniciar o backend";                restart_backend

FINISHED=1
status success "done" "Atualizado para a $TARGET_LABEL"
msg "Atualizado para a $TARGET_LABEL."

# Ficam o build novo e o anterior (para o próximo rollback); numa VM antiga sai o build
# que estava dentro do repo
prune_builds "$PREV_BUILD" || warn "Não consegui apagar os builds antigos em $BUILDS_DIR."
cleanup_legacy_build || warn "Não consegui apagar o build antigo de dentro de $APP_DIR."
