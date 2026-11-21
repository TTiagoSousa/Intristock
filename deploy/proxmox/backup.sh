#!/usr/bin/env bash
# Backup do IntriStock em /var/backups/intristock (só root). Corre pelo cron todos os
# dias às 03:30 (/etc/cron.d/intristock-backup); pode correr-se à mão.
#
#   intristock-<data>.sql.gz           a base de dados (pg_dump)
#   intristock-config-<data>.tar.gz    /etc/intristock e /etc/garage.toml: a ENCRYPTION_KEY,
#                                      os segredos JWT, as chaves do S3 — sem eles o dump
#                                      não chega para repor a app
#   intristock-garage-<data>.tar       os documentos (faturas, comprovativos): um snapshot
#                                      dos metadados do Garage e os blocos
#
# Guardam-se BACKUP_KEEP_DAYS dias (14) e os documentos BACKUP_GARAGE_KEEP_DAYS (3), que
# são maiores. Com BACKUP_COPY_DIR (uma pasta fora do disco da VM: NFS, SMB, um disco
# montado) cada backup diário é copiado também para lá. Os três estão no
# /etc/intristock/backup.env (intristock-config).
#
# Com um rótulo (backup.sh pre-v1.4.0 — o que o update.sh faz antes das migrações) só a
# base de dados e a configuração, sem cópia externa.
#
# Uma falha sai com erro e fica escrita no log do cron (/var/log/intristock-backup.log),
# no journal (journalctl -t intristock-backup) e em /var/lib/intristock-state/backup.json.
#
# Repor a base de dados (com a app parada: systemctl stop intristock intristock-downloader intristock-simulator):
#   gunzip -c <ficheiro>.sql.gz | runuser -u postgres -- psql -d intristock
# Repor a configuração:  tar -xzf <ficheiro>-config-….tar.gz -C /
# Repor os documentos (com o Garage parado: systemctl stop garage):
#   tar -xf <ficheiro>-garage-….tar -C /var/lib/garage
#   o snapshot dos metadados fica em meta/snapshots/<data>: copia-o por cima de
#   meta/db.sqlite e chown -R garage:garage /var/lib/garage
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"

require_root

LABEL="${1:-}"
STAMP="${BACKUP_STAMP:-$(date +%Y%m%d-%H%M%S)}"
SAFE_LABEL="$(printf '%s' "$LABEL" | tr -c 'A-Za-z0-9._-' '_')"
PREFIX="${SAFE_LABEL:+$SAFE_LABEL-}"

setting() { # setting CHAVE OMISSÃO — do backup.env, ou a omissão
  local value=""
  [ -f "$BACKUP_ENV" ] && value="$(env_value "$BACKUP_ENV" "$1")"
  printf '%s' "${value:-$2}"
}
KEEP_DAYS="${KEEP_DAYS:-$(setting BACKUP_KEEP_DAYS 14)}"
GARAGE_KEEP_DAYS="${GARAGE_KEEP_DAYS:-$(setting BACKUP_GARAGE_KEEP_DAYS 3)}"
COPY_DIR="$(setting BACKUP_COPY_DIR "")"
[[ "$KEEP_DAYS" =~ ^[0-9]+$ ]] || die "BACKUP_KEEP_DAYS tem de ser um número de dias (está '$KEEP_DAYS')."
[[ "$GARAGE_KEEP_DAYS" =~ ^[0-9]+$ ]] || die "BACKUP_GARAGE_KEEP_DAYS tem de ser um número de dias (está '$GARAGE_KEEP_DAYS')."

CURRENT=""
FILES=()

# O resultado do último backup, para quem o quiser mostrar (a app pode lê-lo)
backup_status() { # backup_status ok|failed MENSAGEM
  [ -d "$STATE_DIR" ] || return 0
  local list="" f
  for f in "${FILES[@]}"; do list+="${list:+,}$(json_str "$f")"; done
  printf '{"state":%s,"label":%s,"at":%s,"message":%s,"files":[%s]}\n' \
    "$(json_str "$1")" "$(json_str "$LABEL")" "$(json_str "$(date -Is)")" "$(json_str "$2")" "$list" \
    > "$STATE_DIR/backup.json.tmp"
  chown root:"$APP_USER" "$STATE_DIR/backup.json.tmp" 2>/dev/null || true
  chmod 640 "$STATE_DIR/backup.json.tmp"
  mv -f "$STATE_DIR/backup.json.tmp" "$STATE_DIR/backup.json"
}

on_exit() {
  local rc=$?
  rm -f "$BACKUP_DIR"/*.tmp 2>/dev/null || true
  [ "$rc" -ne 0 ] || return 0
  local text="O backup do IntriStock${LABEL:+ ($LABEL)} falhou em: ${CURRENT:-início} (código $rc). Vê /var/log/intristock-backup.log."
  printf '\033[1;31mxx\033[0m %s\n' "$text" >&2
  logger -t intristock-backup -p user.err "$text" 2>/dev/null || true
  backup_status failed "$text" || true
}
trap on_exit EXIT

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# --- base de dados ---------------------------------------------------------------------
CURRENT="base de dados"
db_file="$(backup_db_file "$LABEL" "$STAMP")"
dump_db "$db_file"
FILES+=("$db_file")

# --- configuração ----------------------------------------------------------------------
CURRENT="configuração"
config_file="$BACKUP_DIR/intristock-config-${PREFIX}${STAMP}.tar.gz"
config_paths=(etc/intristock)
[ -f "$GARAGE_CONFIG" ] && config_paths+=("${GARAGE_CONFIG#/}")
tar -czf "$config_file.tmp" -C / "${config_paths[@]}"
chmod 600 "$config_file.tmp"
mv -f "$config_file.tmp" "$config_file"
FILES+=("$config_file")

# --- documentos (Garage) — só no backup diário ----------------------------------------
# Um snapshot dos metadados (o sqlite do Garage não se copia a meio de uma escrita) e os
# blocos tal como estão: são imutáveis, e um que apareça depois do snapshot só sobra.
garage_backup() {
  local out="$BACKUP_DIR/intristock-garage-${STAMP}.tar" snaps="$GARAGE_DIR/meta/snapshots" snap="" rc=0
  if garage meta snapshot >/dev/null 2>&1; then
    snap="$(find "$snaps" -mindepth 1 -maxdepth 1 -printf '%T@ %f\n' 2>/dev/null | sort -rn | awk 'NR==1 {print $2}' || true)"
  fi
  if [ -n "$snap" ]; then
    tar -cf "$out.tmp" --warning=no-file-changed -C "$GARAGE_DIR" "meta/snapshots/$snap" data || rc=$?
    # O Garage pode não apagar os snapshots pedidos à mão: ficam os dois mais recentes
    find "$snaps" -mindepth 1 -maxdepth 1 -printf '%T@ %f\n' | sort -rn | awk 'NR>2 {print $2}' \
      | while read -r old; do rm -rf "${snaps:?}/$old"; done || true
  else
    warn "O Garage não fez o snapshot dos metadados — vai a pasta meta como está (pode não ficar consistente)."
    tar -cf "$out.tmp" --warning=no-file-changed -C "$GARAGE_DIR" meta data || rc=$?
  fi
  # 1 = um ficheiro mudou enquanto se lia (o Garage está a correr): o tar fica bom
  [ "$rc" -le 1 ] || return "$rc"
  chmod 600 "$out.tmp"
  mv -f "$out.tmp" "$out"
  FILES+=("$out")
}

if [ -z "$LABEL" ] && [ -d "$GARAGE_DIR/data" ]; then
  CURRENT="documentos (Garage)"
  garage_backup
fi

# --- limpeza ---------------------------------------------------------------------------
CURRENT="limpeza dos antigos"
find "$BACKUP_DIR" -maxdepth 1 -name 'intristock-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
find "$BACKUP_DIR" -maxdepth 1 -name 'intristock-config-*.tar.gz' -mtime +"$KEEP_DAYS" -delete
find "$BACKUP_DIR" -maxdepth 1 -name 'intristock-garage-*.tar' -mtime +"$GARAGE_KEEP_DAYS" -delete

# --- cópia externa ---------------------------------------------------------------------
if [ -z "$LABEL" ] && [ -n "$COPY_DIR" ]; then
  CURRENT="cópia para $COPY_DIR"
  # Uma pasta que não existe é quase sempre um disco que não montou: falha, para se ver
  [ -d "$COPY_DIR" ] && [ -w "$COPY_DIR" ] \
    || die "A pasta da cópia externa ($COPY_DIR) não existe ou não se pode escrever — o disco está montado?"
  for f in "${FILES[@]}"; do
    name="$(basename "$f")"
    cp "$f" "$COPY_DIR/.$name.part"
    mv -f "$COPY_DIR/.$name.part" "$COPY_DIR/$name"
  done
  find "$COPY_DIR" -maxdepth 1 \( -name 'intristock-*.sql.gz' -o -name 'intristock-config-*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete
  find "$COPY_DIR" -maxdepth 1 -name 'intristock-garage-*.tar' -mtime +"$GARAGE_KEEP_DAYS" -delete
  msg "Cópia em $COPY_DIR."
fi

CURRENT=""
for f in "${FILES[@]}"; do msg "Backup: $f ($(du -h "$f" | cut -f1))"; done
backup_status ok "Backup feito${LABEL:+ ($LABEL)}: ${#FILES[@]} ficheiro(s)."
