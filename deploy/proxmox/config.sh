#!/usr/bin/env bash
# intristock-config — a configuração do backend e do frontend num só sítio.
#
#   intristock-config              menu: ↑/↓ escolhe, Enter edita, "Guardar" aplica
#   intristock-config backend      abre o backend.env inteiro no nano
#   intristock-config frontend     abre o frontend.env inteiro no nano
#
# O backend só lê o ambiente ao arrancar: guardar reinicia-o. O frontend só o lê no
# build: guardar volta a compilar e a publicar o site.
#
# A base de dados, os segredos JWT e a ENCRYPTION_KEY não aparecem no menu: mudá-los
# por engano tirava toda a gente da sessão ou deixava as chaves das APIs ilegíveis.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck source=lib.sh
. "$SCRIPT_DIR/lib.sh"

require_root
[ -f "$BACKEND_ENV" ] || die "Falta $BACKEND_ENV — corre primeiro o install.sh."
export LANG=C.UTF-8 LC_ALL=C.UTF-8 PATH="/usr/local/bin:$PATH"

ok() { printf '\033[1;32m ✓\033[0m %s\n' "$*"; }

apply_frontend() {
  msg "O frontend só lê a configuração no build — a compilar e a publicar…"
  build_frontend && publish_frontend && ok "Frontend publicado com a configuração nova."
}

# --- modo ficheiro inteiro -------------------------------------------------------------

raw_edit() { # raw_edit backend|frontend
  local which="$1" file
  if [ "$which" = frontend ]; then file="$FRONTEND_ENV"; else file="$BACKEND_ENV"; fi
  cp -p "$file" "$file.bak"
  ${EDITOR:-nano} "$file"
  if cmp -s "$file" "$file.bak"; then msg "Sem alterações."; exit 0; fi

  if [ "$which" = backend ] && [ "$(env_value "$file" ENCRYPTION_KEY)" != "$(env_value "$file.bak" ENCRYPTION_KEY)" ]; then
    cp -p "$file.bak" "$file"
    die "A ENCRYPTION_KEY não pode mudar — o ficheiro anterior foi reposto. As chaves das APIs guardadas deixavam de abrir."
  fi

  if [ "$which" = frontend ]; then
    apply_frontend
  else
    restart_backend && ok "Configuração aplicada, backend reiniciado."
  fi
  exit 0
}

case "${1:-}" in
  backend|--raw) raw_edit backend ;;
  frontend) raw_edit frontend ;;
esac
command -v whiptail >/dev/null || raw_edit backend

# --- o que aparece no menu -------------------------------------------------------------

# FICHEIRO|CHAVE|descrição|tipo — tipo: url, secret ou text
SETTINGS=(
  "backend|FRONTEND_URL|Endereço por onde se abre a app, ex. https://intristock.exemplo.pt (CORS).|url"
  "backend|TZ|Fuso horário do servidor, ex. Europe/Lisbon.|text"
  "backend|S3_ENDPOINT|Storage dos documentos. Por omissão o Garage desta VM: http://127.0.0.1:3900|url"
  "backend|S3_BUCKET|Bucket dos documentos.|text"
  "backend|S3_REGION|Região do storage (no Garage: garage).|text"
  "backend|S3_ACCESS_KEY|Chave de acesso ao storage.|text"
  "backend|S3_SECRET_KEY|Segredo do storage.|secret"
  "frontend|VITE_API_URL|Onde o site chama a API. Por omissão /api (o nginx desta VM).|text"
)

file_of() { if [ "$1" = frontend ]; then echo "$FRONTEND_ENV"; else echo "$BACKEND_ENV"; fi; }

declare -A CURRENT=() PENDING=()
for entry in "${SETTINGS[@]}"; do
  IFS='|' read -r where key _ _ <<<"$entry"
  CURRENT[$key]="$(env_value "$(file_of "$where")" "$key")"
done

value_of() { if [ -n "${PENDING[$1]+x}" ]; then printf '%s' "${PENDING[$1]}"; else printf '%s' "${CURRENT[$1]}"; fi; }

shown() { # como um valor aparece na lista
  local value="$1" kind="$2"
  if [ -z "$value" ]; then echo "(vazio)"; return; fi
  if [ "$kind" = secret ]; then
    if [ "${#value}" -gt 10 ]; then echo "${value:0:4}…${value: -4}"; else echo "(definido)"; fi
    return
  fi
  if [ "${#value}" -gt 50 ]; then echo "${value:0:47}…"; else echo "$value"; fi
}

BACKTITLE="IntriStock · configuração"
wt() { whiptail --backtitle "$BACKTITLE" "$@" 3>&1 1>&2 2>&3; }
TERM_COLS="$(tput cols 2>/dev/null || echo 80)"
TERM_ROWS="$(tput lines 2>/dev/null || echo 24)"
W=$(( TERM_COLS - 4 < 96 ? TERM_COLS - 4 : 96 ))
H() { local h="$1" max=$(( TERM_ROWS - 3 )); [ "$h" -le "$max" ] || h="$max"; echo "$h"; }

valid_url() { [[ "$1" =~ ^https?://[^/[:space:]]+(/[^[:space:]]*)?$ ]]; }

stage() { # stage CHAVE VALOR — guarda a alteração, ou esquece-a se voltou ao valor gravado
  if [ "$2" = "${CURRENT[$1]}" ]; then unset "PENDING[$1]"; else PENDING[$1]="$2"; fi
}

edit_setting() { # edit_setting CHAVE descrição tipo
  local key="$1" text="$2" kind="$3" value rc
  while :; do
    rc=0
    value="$(wt --title "$key" --inputbox "$text\n\nEm branco limpa o valor. Cola com o botão direito do rato." \
      "$(H 12)" "$W" "$(value_of "$key")")" || rc=$?
    [ "$rc" -eq 0 ] || return 0
    value="$(printf '%s' "$value" | tr -d '\r' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
    if [[ "$value" == *'"'* ]]; then
      wt --title "Valor inválido" --msgbox "Os valores não podem ter aspas." "$(H 8)" "$W" || true
      continue
    fi
    if [ "$kind" = url ] && [ -n "$value" ]; then
      value="${value%/}"
      if ! valid_url "$value"; then
        wt --title "Valor inválido" --msgbox "Usa um endereço completo com http:// ou https://" "$(H 8)" "$W" || true
        continue
      fi
    fi
    break
  done
  stage "$key" "$value"
}

save_and_apply() {
  local key where backend_changed="" frontend_changed="" summary=""
  cp -p "$BACKEND_ENV" "$BACKEND_ENV.bak"
  cp -p "$FRONTEND_ENV" "$FRONTEND_ENV.bak"
  for entry in "${SETTINGS[@]}"; do
    IFS='|' read -r where key _ _ <<<"$entry"
    [ -n "${PENDING[$key]+x}" ] || continue
    set_env_value "$(file_of "$where")" "$key" "${PENDING[$key]}"
    summary+="  • $key\n"
    if [ "$where" = frontend ]; then frontend_changed=1; else backend_changed=1; fi
  done
  chown root:"$APP_USER" "$BACKEND_ENV"; chmod 640 "$BACKEND_ENV"
  chmod 644 "$FRONTEND_ENV"

  clear 2>/dev/null || true
  ok "Guardado (cópia anterior em .bak):"
  printf '%b' "$summary"
  [ -z "$frontend_changed" ] || apply_frontend
  if [ -n "$backend_changed" ]; then restart_backend && ok "Backend reiniciado — a configuração nova está ativa."; fi
}

choice=""
while :; do
  items=()
  for entry in "${SETTINGS[@]}"; do
    IFS='|' read -r where key _ kind <<<"$entry"
    mark=" "; [ -n "${PENDING[$key]+x}" ] && mark="*"
    items+=("$key" "$mark [$where] $(shown "$(value_of "$key")" "$kind")")
  done
  pending=${#PENDING[@]}
  save_label="  Guardar e aplicar"
  [ "$pending" -eq 0 ] || save_label="  Guardar as $pending alteração(ões) e aplicar"
  items+=("Guardar" "$save_label" \
          "Backend" "  Editar o backend.env inteiro no nano" \
          "Frontend" "  Editar o frontend.env inteiro no nano" \
          "Sair" "  Sair sem guardar")

  rc=0
  choice="$(wt --title "Configuração do IntriStock" --ok-button "Escolher" --cancel-button "Sair" \
    --default-item "$choice" \
    --menu "↑/↓ mover · Enter editar · as alteradas ficam com *" \
    "$(H 22)" "$W" "$(H 13)" "${items[@]}")" || rc=$?
  [ "$rc" -eq 0 ] || choice="Sair"

  case "$choice" in
    Guardar)
      if [ "$pending" -eq 0 ]; then
        wt --title "Nada para guardar" --msgbox "Não mudaste nenhum valor." "$(H 8)" "$W" || true
      else
        save_and_apply
        exit 0
      fi ;;
    Sair)
      if [ "$pending" -gt 0 ] && ! wt --title "Alterações por guardar" --defaultno \
          --yesno "$pending alteração(ões) por guardar. Sair na mesma?" "$(H 8)" "$W"; then
        choice=""
        continue
      fi
      clear 2>/dev/null || true
      msg "Nada guardado."
      exit 0 ;;
    Backend) clear 2>/dev/null || true; raw_edit backend ;;
    Frontend) clear 2>/dev/null || true; raw_edit frontend ;;
    *)
      for entry in "${SETTINGS[@]}"; do
        IFS='|' read -r where key text kind <<<"$entry"
        if [ "$key" = "$choice" ]; then edit_setting "$key" "$text" "$kind"; break; fi
      done ;;
  esac
done
