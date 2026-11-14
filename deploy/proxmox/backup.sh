#!/usr/bin/env bash
# Dump da base de dados para /var/backups/intristock, comprimido, mantendo 14 dias.
# Corre pelo cron (/etc/cron.d/intristock-backup); pode correr-se à mão.
#
# Os documentos (faturas) vivem no Garage, em /var/lib/garage — o backup da VM no
# Proxmox apanha-os junto com o resto.
#
# Repor:  gunzip -c <ficheiro> | runuser -u postgres -- psql -d intristock
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"

KEEP_DAYS="${KEEP_DAYS:-14}"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

file="$BACKUP_DIR/intristock-$(date +%Y%m%d-%H%M).sql.gz"
runuser -u postgres -- pg_dump --clean --if-exists intristock | gzip > "$file.tmp"
mv "$file.tmp" "$file"
chmod 600 "$file"

find "$BACKUP_DIR" -name 'intristock-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
msg "Backup: $file ($(du -h "$file" | cut -f1))"
