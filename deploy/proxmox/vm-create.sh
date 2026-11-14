#!/usr/bin/env bash
# IntriStock — instalador em VM para o Proxmox VE.
#
# Corre na SHELL DO HOST do Proxmox, como root:
#
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/TTiagoSousa/Intristock/main/deploy/proxmox/vm-create.sh)"
#
# De um espelho próprio (Forgejo, Gitea, GitLab, servidor git qualquer), diz-se de onde
# vem o código com REPO_URL — e as atualizações passam a vir também daí:
#
#   REPO_URL=https://git.exemplo.pt/eu/intristock.git \
#     bash -c "$(curl -fsSL https://git.exemplo.pt/eu/intristock/raw/branch/main/deploy/proxmox/vm-create.sh)"
#
# Cria uma VM Debian 13 (imagem cloud oficial) e instala lá dentro o IntriStock:
# Node, PostgreSQL, Garage (S3), nginx e o backend como serviço systemd.
#
# Como chega lá: o cloud-init só instala o agente da VM e o git. Depois, pelo agente,
# o script entrega a configuração (password do admin, token do repo — nunca ficam
# escritas no host) e arranca a instalação, mostrando o progresso aqui.
#
# Modo sem menus: NONINTERACTIVE=1 e as variáveis que quiseres mudar:
#   VMID VM_NAME STORAGE SNIPPET_STORAGE DISK_GB CORES RAM_MB BRIDGE
#   NET_MODE (dhcp|static) IP (ex. 192.168.0.70/24) GATEWAY VLAN DNS ONBOOT (1|0)
#   VM_USER VM_PASSWORD SSH_KEY_FILE INSTALL_REF (latest|main|staging|develop)
#   REPO_URL REPO_TOKEN APP_URL ADMIN_EMAIL ADMIN_PASSWORD
# Os validadores check_* só são chamados através do ask().
# shellcheck disable=SC2329
set -euo pipefail

APP="IntriStock"
BACKTITLE="$APP · instalador VM para Proxmox VE"

BOLD=$'\033[1m'; DIM=$'\033[2m'; CYAN=$'\033[1;36m'; GREEN=$'\033[1;32m'
YELLOW=$'\033[1;33m'; RED=$'\033[1;31m'; RESET=$'\033[0m'

msg()  { printf '%s ➜%s %s\n' "$CYAN" "$RESET" "$*"; }
ok()   { printf '%s ✓%s %s\n' "$GREEN" "$RESET" "$*"; }
warn() { printf '%s !%s %s\n' "$YELLOW" "$RESET" "$*" >&2; }
die()  { printf '%s ✗%s %s\n' "$RED" "$RESET" "$*" >&2; exit 1; }

header() {
  clear 2>/dev/null || true
  printf "%s" "$CYAN"
  cat <<'EOF'

   ___       _        _ ____  _             _
  |_ _|_ __ | |_ _ __(_) ___|| |_ ___   ___| | __
   | || '_ \| __| '__| \___ \| __/ _ \ / __| |/ /
   | || | | | |_| |  | |___) | || (_) | (__|   <
  |___|_| |_|\__|_|  |_|____/ \__\___/ \___|_|\_\

EOF
  printf '%s  %sGestão de empresas e ferramentas financeiras · instalador VM para Proxmox VE%s\n\n' "$RESET" "$DIM" "$RESET"
}

# --- verificações -----------------------------------------------------------------------

[ "$(id -u)" -eq 0 ] || die "Corre isto como root no host do Proxmox VE."
command -v qm >/dev/null || die "Não encontrei o qm — isto corre no host do Proxmox VE, não dentro de uma VM."

# --- ajudas -----------------------------------------------------------------------------

valid_ipv4() {
  local ip="$1" IFS=. octets
  [[ "$ip" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] || return 1
  read -r -a octets <<<"$ip"
  for o in "${octets[@]}"; do [ "$o" -le 255 ] || return 1; done
}
valid_cidr() {
  [[ "$1" == */* ]] || return 1
  valid_ipv4 "${1%/*}" && [[ "${1#*/}" =~ ^[0-9]{1,2}$ ]] && [ "${1#*/}" -ge 1 ] && [ "${1#*/}" -le 32 ]
}
valid_hostname() { [[ "$1" =~ ^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$ ]]; }
valid_int() { [[ "$1" =~ ^[0-9]+$ ]] && [ "$1" -ge "$2" ] && [ "$1" -le "$3" ]; }
id_taken() { qm status "$1" >/dev/null 2>&1 || pct status "$1" >/dev/null 2>&1; }

active_storages() { # active_storages <content> → "nome tipo livre"
  pvesm status -content "$1" 2>/dev/null \
    | awk 'NR>1 && $3=="active" {printf "%s %s %.1fG\n", $1, $2, $6/1024/1024}'
}
first_storage() { active_storages "$1" | awk 'NR==1 {print $1}'; }
bridges() { ip -o link show type bridge 2>/dev/null | awk -F': ' '{print $2}' | cut -d@ -f1; }
host_dns() { awk '/^nameserver/ {print $2; exit}' /etc/resolv.conf; }
random_password() { tr -dc 'A-Za-z0-9' </dev/urandom | head -c 16; }

# Se um repositório git responde, pelo protocolo HTTP normal do git (/info/refs) — o
# mesmo no GitHub, Forgejo, Gitea, GitLab ou num servidor próprio. Com token, entra
# como "oauth2", que todos eles aceitam para tokens de acesso.
repo_reachable() { # repo_reachable URL [TOKEN]
  local url="${1%/}" auth=()
  [ -n "${2:-}" ] && auth=(-u "oauth2:$2")
  curl -fsS -m 15 -o /dev/null "${auth[@]}" "${url}/info/refs?service=git-upload-pack" 2>/dev/null
}

first_reachable_repo() {
  local candidate
  for candidate in "${REPO_CANDIDATES[@]}"; do
    if repo_reachable "$candidate" "$REPO_TOKEN"; then echo "$candidate"; return 0; fi
  done
  return 1
}

# --- valores por omissão ----------------------------------------------------------------

VMID="${VMID:-$(pvesh get /cluster/nextid)}"
VM_NAME="${VM_NAME:-intristock}"
STORAGE="${STORAGE:-$(first_storage images)}"
SNIPPET_STORAGE="${SNIPPET_STORAGE:-$(first_storage snippets)}"
DISK_GB="${DISK_GB:-32}"
CORES="${CORES:-2}"
# O build do frontend e do backend precisa de memória; com 2 GB o npm pode rebentar
RAM_MB="${RAM_MB:-4096}"
BRIDGE="${BRIDGE:-$(bridges | head -1)}"
BRIDGE="${BRIDGE:-vmbr0}"
NET_MODE="${NET_MODE:-$([ -n "${IP:-}" ] && [ "${IP:-}" != dhcp ] && echo static || echo dhcp)}"
IP="${IP:-}"
GATEWAY="${GATEWAY:-}"
VLAN="${VLAN:-}"
DNS="${DNS:-}"
ONBOOT="${ONBOOT:-1}"
VM_USER="${VM_USER:-admin}"
VM_PASSWORD="${VM_PASSWORD:-}"
SSH_KEY_FILE="${SSH_KEY_FILE:-}"
INSTALL_REF="${INSTALL_REF:-latest}"
# De onde vem o código (e as versões novas). Sem REPO_URL, usa-se a primeira destas
# que responder: o repositório oficial no GitHub e o espelho no Forgejo do autor.
# Quem tiver um espelho próprio passa REPO_URL ou escolhe "Outro" nos menus.
REPO_CANDIDATES=(
  "https://github.com/TTiagoSousa/Intristock.git"
  "https://forgejo.home-sousa.me/Tiago/intristock.git"
)
REPO_URL="${REPO_URL:-}"
REPO_TOKEN="${REPO_TOKEN:-}"
APP_URL="${APP_URL:-}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin}"
VM_PASSWORD_GENERATED=""

# --- diálogos ---------------------------------------------------------------------------

# O whiptail escreve a resposta no stderr; troca-se com o stdout para a apanhar
wt() { whiptail --backtitle "$BACKTITLE" "$@" 3>&1 1>&2 2>&3; }

# Os tamanhos seguem o terminal: a shell web do Proxmox tem muitas vezes 24 linhas ou
# menos, e uma caixa maior do que o ecrã faz o whiptail falhar em vez de desenhar
TERM_COLS="$(tput cols 2>/dev/null || echo 80)"
TERM_ROWS="$(tput lines 2>/dev/null || echo 24)"
W=$(( TERM_COLS - 4 < 76 ? TERM_COLS - 4 : 76 ))
H() { local h="$1" max=$(( TERM_ROWS - 3 )); [ "$h" -le "$max" ] || h="$max"; echo "$h"; }

abort() {
  local where="${1:-instalador}" rc="${2:-1}"
  clear 2>/dev/null || true
  if [ "$rc" = 255 ]; then
    die "Parado em \"$where\" — carregaste em Esc ou o diálogo não coube no terminal (${TERM_COLS}x${TERM_ROWS}). Nada foi criado."
  fi
  die "Cancelado em \"$where\" — nada foi criado."
}
invalid() { wt --title "Valor inválido" --msgbox "$1" "$(H 9)" "$W" || true; }

# ask VAR "título" "texto" validador [args…] — volta a pedir até o validador aceitar
ask() {
  local var="$1" title="$2" text="$3" value; shift 3
  while :; do
    value="$(wt --title "$title" --inputbox "$text" "$(H 11)" "$W" "${!var}")" || abort "$title" $?
    if [ $# -eq 0 ] || "$@" "$value"; then printf -v "$var" '%s' "$value"; return; fi
    invalid "\"$value\" não é válido para: $title"
  done
}

# radio VAR "título" "texto" tag descrição [tag descrição …]
radio() {
  local var="$1" title="$2" text="$3" items=() n=0 choice; shift 3
  while [ $# -ge 2 ]; do
    items+=("$1" "$2" "$([ "$1" = "${!var}" ] && echo ON || echo OFF)"); shift 2; n=$((n + 1))
  done
  choice="$(wt --title "$title" --radiolist "$text\n\n(Espaço escolhe, Enter confirma)" \
    "$(H $((n + 10)))" "$W" "$n" "${items[@]}")" || abort "$title" $?
  printf -v "$var" '%s' "$choice"
}

check_vmid() { valid_int "$1" 100 999999999 && ! id_taken "$1"; }
check_cores() { valid_int "$1" 1 128; }
check_ram() { valid_int "$1" 2048 1048576; }
check_disk() { valid_int "$1" 16 10000; }
check_vlan() { [ -z "$1" ] || valid_int "$1" 1 4094; }
check_url() { [[ "$1" =~ ^https?://[^/[:space:]]+$ ]]; }
check_nonempty() { [ -n "$1" ]; }
check_dns() { local d; for d in $1; do valid_ipv4 "$d" || return 1; done; [ -n "$1" ]; }
check_ssh_file() { [ -z "$1" ] || [ -r "$1" ]; }
check_login() { [[ "$1" =~ ^[A-Za-z0-9._@+-]+$ ]]; }

# pick_storage VAR conteúdo "título" "explicação" — com uma só hipótese não há o que escolher
pick_storage() {
  local var="$1" args=() name type free
  while read -r name type free; do args+=("$name" "$type · ${free} livres"); done < <(active_storages "$2")
  [ ${#args[@]} -gt 0 ] || return 0
  if [ ${#args[@]} -eq 2 ]; then printf -v "$var" '%s' "${args[0]}"; return; fi
  radio "$var" "$3" "$4" "${args[@]}"
}

advanced_settings() {
  ask VMID "ID da VM" "ID da VM (tem de estar livre)." check_vmid
  ask VM_NAME "Nome" "Nome da VM (também é o hostname)." valid_hostname

  pick_storage STORAGE images "Storage do disco" "Onde se cria o disco da VM (sistema, app, base de dados e documentos)."
  pick_storage SNIPPET_STORAGE snippets "Storage dos snippets" "Onde fica o ficheiro de cloud-init desta VM (pequeno, sem segredos)."

  ask DISK_GB "Disco" "Tamanho do disco em GB. A base de dados e os documentos vivem dentro da VM." check_disk
  ask CORES "CPUs" "Número de CPUs." check_cores
  ask RAM_MB "Memória" "RAM em MB (mínimo 2048; o build da app precisa de memória)." check_ram

  local bridge_args=() b
  while read -r b; do bridge_args+=("$b" "Linux bridge"); done < <(bridges)
  if [ ${#bridge_args[@]} -eq 2 ]; then
    BRIDGE="${bridge_args[0]}"
  elif [ ${#bridge_args[@]} -gt 2 ]; then
    radio BRIDGE "Rede" "Bridge do Proxmox para a placa de rede da VM." "${bridge_args[@]}"
  else
    ask BRIDGE "Rede" "Bridge do Proxmox para a placa de rede da VM." check_nonempty
  fi

  radio NET_MODE "Endereço IPv4" "Como é que a VM obtém o IP?" \
    dhcp "Automático (DHCP)" \
    static "IP fixo"
  if [ "$NET_MODE" = static ]; then
    ask IP "IP fixo" "Endereço IPv4 com prefixo, ex. 192.168.0.70/24" valid_cidr
    [ -n "$GATEWAY" ] || GATEWAY="$(printf '%s' "${IP%/*}" | awk -F. '{print $1"."$2"."$3".1"}')"
    ask GATEWAY "Gateway" "Gateway IPv4, ex. 192.168.0.1" valid_ipv4
  else
    IP=""; GATEWAY=""
  fi
  ask VLAN "VLAN" "Tag VLAN (em branco para nenhuma)." check_vlan

  local dns_mode
  dns_mode="$([ -n "$DNS" ] && echo custom || echo host)"
  radio dns_mode "DNS" "Que servidor DNS deve a VM usar?" \
    host "O mesmo do host do Proxmox ($(host_dns))" \
    custom "Servidor(es) próprio(s)"
  if [ "$dns_mode" = custom ]; then
    [ -n "$DNS" ] || DNS="$(host_dns)"
    ask DNS "Servidores DNS" "Um ou mais IPv4, separados por espaços." check_dns
  else
    DNS=""
  fi

  local boot_args=() rc=0
  [ "$ONBOOT" = 1 ] || boot_args+=(--defaultno)
  wt "${boot_args[@]}" --title "Arranque" --yesno "Arrancar a VM quando o host do Proxmox arranca?" "$(H 8)" "$W" || rc=$?
  case "$rc" in 0) ONBOOT=1 ;; 1) ONBOOT=0 ;; *) abort "Arranque" "$rc" ;; esac

  local url_mode
  url_mode="$([ -n "$APP_URL" ] && echo domain || echo ip)"
  radio url_mode "Endereço da app" "Por onde vais abrir o IntriStock?" \
    ip "Pelo IP da VM, em http" \
    domain "Por um domínio próprio (ex. atrás do Nginx Proxy Manager)"
  if [ "$url_mode" = domain ]; then
    [ -n "$APP_URL" ] || APP_URL="https://intristock.example.com"
    ask APP_URL "Endereço da app" "Endereço completo com http(s)://, sem barra no fim." check_url
  else
    APP_URL=""
  fi

  ask ADMIN_EMAIL "Login do admin" "Login da primeira conta da app (administrador). Por omissão: admin" check_login
  local pw
  pw="$(wt --title "Password do admin" --passwordbox "Password da conta '$ADMIN_EMAIL'. Em branco fica a de omissão: admin" "$(H 9)" "$W" "")" \
    || abort "Password do admin" $?
  ADMIN_PASSWORD="${pw:-admin}"

  ask VM_USER "Utilizador da VM" "Utilizador para entrar na consola/SSH da VM (com sudo)." valid_hostname
  pw="$(wt --title "Password da VM" --passwordbox "Password de '$VM_USER' na VM. Em branco gera-se uma (mostrada no fim)." "$(H 9)" "$W" "")" \
    || abort "Password da VM" $?
  VM_PASSWORD="$pw"
  ask SSH_KEY_FILE "Chave SSH" "Ficheiro com chave(s) SSH públicas para '$VM_USER' (opcional, ex. /root/.ssh/id_ed25519.pub)." check_ssh_file

  radio INSTALL_REF "Versão" "O que instalar?" \
    latest "A última versão (recomendado)" \
    main "Branch main" \
    staging "Branch staging (candidata)" \
    develop "Branch develop (desenvolvimento)"
}

settings_text() {
  local net
  if [ "$NET_MODE" = static ]; then net="IP fixo $IP, gw $GATEWAY"; else net="DHCP"; fi
  printf '%s\n' \
    "ID / nome        $VMID / $VM_NAME" \
    "Storage          $STORAGE (snippets: ${SNIPPET_STORAGE:-local, a ativar})" \
    "CPU / RAM        $CORES CPUs, ${RAM_MB} MB" \
    "Disco            ${DISK_GB} GB" \
    "Rede             $BRIDGE, $net${VLAN:+, VLAN $VLAN}" \
    "DNS              ${DNS:-o mesmo do host}" \
    "Arranque         $([ "$ONBOOT" = 1 ] && echo sim || echo não)" \
    "Endereço da app  ${APP_URL:-http://<IP da VM>}" \
    "Admin da app     $ADMIN_EMAIL / $([ "$ADMIN_PASSWORD" = admin ] && echo 'admin (omissão)' || echo '(escolhida)')" \
    "Utilizador VM    $VM_USER$([ -n "$SSH_KEY_FILE" ] && echo " + chave SSH")" \
    "Versão           $([ "$INSTALL_REF" = latest ] && echo 'a última' || echo "branch $INSTALL_REF")"
}

interactive() {
  local mode rc
  mode="$(wt --title "$APP" --menu "Cria uma VM Debian 13 com o $APP, PostgreSQL, Garage e nginx.\n\nComo queres configurar?" \
    "$(H 13)" "$W" 2 \
    "Default" "Valores por omissão" \
    "Advanced" "Configurar passo a passo")" || abort "$APP" $?
  [ "$mode" = Advanced ] && advanced_settings

  while :; do
    rc=0
    wt --title "Revisão" --yes-button "Criar" --no-button "Editar" \
      --yesno "$(settings_text)" "$(H 18)" "$W" || rc=$?
    case "$rc" in
      0) return ;;
      1) advanced_settings ;;
      *) abort "Revisão" "$rc" ;;
    esac
  done
}

# --- configuração -----------------------------------------------------------------------

header
# FORCE_DIALOGS=1 mostra os diálogos sem terminal (para testar o instalador)
if [ "${NONINTERACTIVE:-}" != "1" ] && { [ -t 0 ] || [ "${FORCE_DIALOGS:-}" = 1 ]; } && command -v whiptail >/dev/null; then
  interactive
  header
else
  msg "Modo sem menus — a usar as variáveis de ambiente."
fi

# As mesmas verificações nos dois modos (o sem menus nunca passou pelos diálogos)
check_vmid "$VMID" || die "O ID $VMID é inválido ou já está em uso."
valid_hostname "$VM_NAME" || die "Nome inválido: $VM_NAME"
[ -n "$STORAGE" ] || die "Não há storage para o disco da VM (STORAGE)."
if [ "$NET_MODE" = static ]; then
  valid_cidr "$IP" || die "IP fixo inválido '$IP' — usa IPv4 com prefixo, ex. 192.168.0.70/24."
  valid_ipv4 "$GATEWAY" || die "O IP fixo precisa de um GATEWAY válido (veio '$GATEWAY')."
fi
check_vlan "$VLAN" || die "VLAN inválida: $VLAN"
check_ssh_file "$SSH_KEY_FILE" || die "Não consigo ler a chave SSH: $SSH_KEY_FILE"
check_login "$ADMIN_EMAIL" || die "Login do admin inválido: $ADMIN_EMAIL"
if [ -n "$APP_URL" ]; then APP_URL="${APP_URL%/}"; check_url "$APP_URL" || die "APP_URL inválido: $APP_URL"; fi
if [ -z "$VM_PASSWORD" ]; then VM_PASSWORD="$(random_password)"; VM_PASSWORD_GENERATED=1; fi

# Sem nenhum storage de snippets, ativa-os no "local" (é só mais um tipo de conteúdo
# permitido na pasta /var/lib/vz, nada é movido)
if [ -z "$SNIPPET_STORAGE" ]; then
  pvesm status -storage local >/dev/null 2>&1 || die "Nenhum storage aceita snippets e não há o storage 'local'. Ativa 'Snippets' num storage em Datacenter → Storage."
  current="$(awk '/^dir: local$/ {f=1; next} f && /^[a-z]+:/ {f=0} f && $1=="content" {print $2}' /etc/pve/storage.cfg)"
  msg "A ativar snippets no storage 'local'…"
  pvesm set local --content "${current:+$current,}snippets" >/dev/null
  SNIPPET_STORAGE="local"
fi

printf '%s\n' "${BOLD}Configuração${RESET}"; settings_text | sed 's/^/  /'; echo

# --- origem do código -------------------------------------------------------------------

# Confirmado antes de criar a VM: um endereço errado ou um repo privado sem token
# só falhava lá dentro, minutos depois, no clone
if [ -z "$REPO_URL" ]; then
  msg "A procurar a origem do código…"
  REPO_URL="$(first_reachable_repo)" \
    || die "Nenhuma origem do código respondeu (${REPO_CANDIDATES[*]}). Indica a tua com REPO_URL=… (ou nos menus, em Outro)."
else
  repo_reachable "$REPO_URL" "$REPO_TOKEN" \
    || die "O repositório $REPO_URL não responde. Confirma o endereço; se for privado, falta o token (REPO_TOKEN)."
fi
ok "Código de $REPO_URL"

# --- imagem do Debian -------------------------------------------------------------------

HOST_ARCH="$(dpkg --print-architecture 2>/dev/null || echo amd64)"
IMAGE_NAME="debian-13-genericcloud-${HOST_ARCH}.qcow2"
IMAGE_URL="https://cloud.debian.org/images/cloud/trixie/latest/${IMAGE_NAME}"
IMAGE_CACHE="/var/lib/vz/template/cache/${IMAGE_NAME}"
mkdir -p "$(dirname "$IMAGE_CACHE")"

# Reaproveita a imagem descarregada há menos de 7 dias
if [ ! -f "$IMAGE_CACHE" ] || [ -n "$(find "$IMAGE_CACHE" -mtime +7 2>/dev/null)" ]; then
  msg "A descarregar a imagem cloud do Debian 13 (${HOST_ARCH})…"
  curl -fL --progress-bar "$IMAGE_URL" -o "$IMAGE_CACHE.tmp" || die "Não consegui descarregar $IMAGE_URL"
  mv "$IMAGE_CACHE.tmp" "$IMAGE_CACHE"
fi
ok "Imagem $IMAGE_NAME"

# --- VM ---------------------------------------------------------------------------------

NET="virtio,bridge=${BRIDGE}"
[ -n "$VLAN" ] && NET="${NET},tag=${VLAN}"

msg "A criar a VM $VMID ($VM_NAME)…"
qm create "$VMID" \
  --name "$VM_NAME" \
  --memory "$RAM_MB" --cores "$CORES" --cpu host \
  --ostype l26 --machine q35 \
  --net0 "$NET" \
  --scsihw virtio-scsi-single \
  --agent enabled=1 \
  --serial0 socket --vga serial0 \
  --onboot "$ONBOOT" \
  --tags intristock \
  --description "$APP — instalado pelo deploy/proxmox/vm-create.sh" >/dev/null

# Se um passo daqui para a frente falhar, a VM fica (os logs dizem porquê)
on_exit() {
  local rc=$?
  if [ "$rc" -ne 0 ]; then
    warn "A instalação falhou. A VM $VMID ficou para poderes ver: qm terminal $VMID (ou a consola no Proxmox)"
    warn "Para a apagar: qm stop $VMID; qm destroy $VMID --purge"
  fi
}
trap on_exit EXIT

msg "A importar o disco para $STORAGE…"
if qm disk import --help >/dev/null 2>&1; then
  qm disk import "$VMID" "$IMAGE_CACHE" "$STORAGE" >/dev/null
else
  qm importdisk "$VMID" "$IMAGE_CACHE" "$STORAGE" >/dev/null
fi
DISK_VOLUME="$(qm config "$VMID" | awk '/^unused0:/ {print $2}')"
[ -n "$DISK_VOLUME" ] || die "Não encontrei o disco importado na configuração da VM."
qm set "$VMID" --scsi0 "${DISK_VOLUME},discard=on,ssd=1,iothread=1" --boot order=scsi0 >/dev/null
qm resize "$VMID" scsi0 "${DISK_GB}G" >/dev/null
ok "Disco de ${DISK_GB} GB"

# --- cloud-init -------------------------------------------------------------------------

# Só o mínimo, sem segredos: o agente da VM (por onde o host fala com ela) e o git.
# Este ficheiro tem de continuar a existir enquanto a VM existir — o Proxmox
# volta a lê-lo em cada arranque.
SNIPPET_NAME="intristock-${VMID}-vendor.yaml"
SNIPPET_PATH="$(pvesm path "${SNIPPET_STORAGE}:snippets/${SNIPPET_NAME}")"
mkdir -p "$(dirname "$SNIPPET_PATH")"
cat > "$SNIPPET_PATH" <<'EOF'
#cloud-config
package_update: true
packages:
  - qemu-guest-agent
  - git
  - ca-certificates
  - curl
runcmd:
  - [systemctl, enable, --now, qemu-guest-agent]
EOF

IPCONFIG="ip=dhcp"
[ "$NET_MODE" = static ] && IPCONFIG="ip=${IP},gw=${GATEWAY}"

ci_args=(
  --ide2 "${STORAGE}:cloudinit"
  --ciuser "$VM_USER" --cipassword "$VM_PASSWORD"
  --ipconfig0 "$IPCONFIG"
  --cicustom "vendor=${SNIPPET_STORAGE}:snippets/${SNIPPET_NAME}"
)
[ -n "$DNS" ] && ci_args+=(--nameserver "$DNS")
[ -n "$SSH_KEY_FILE" ] && ci_args+=(--sshkeys "$SSH_KEY_FILE")
qm set "$VMID" "${ci_args[@]}" >/dev/null
ok "Cloud-init configurado"

msg "A arrancar a VM…"
qm start "$VMID"

# --- agente da VM -----------------------------------------------------------------------

# Saída de um comando corrido dentro da VM (o qm devolve JSON com o "out-data").
# Nunca falha: logo a seguir ao arranque o agente às vezes não responde a tempo, e uma
# resposta perdida conta como "ainda nada" — quem chama volta a perguntar.
guest() {
  { qm guest exec "$VMID" --timeout 60 -- "$@" 2>/dev/null || true; } \
    | perl -MJSON::PP -0777 -ne 'my $j = eval { decode_json($_) } || {}; print $j->{"out-data"} // ""'
}

# guest_write CAMINHO MODO — escreve o stdin num ficheiro dentro da VM, pelo agente.
# Repete até 6 vezes: o agente pode demorar a responder enquanto o Debian acaba de
# arrancar. Escrever o mesmo ficheiro outra vez não faz mal.
guest_write() {
  local path="$1" mode="$2" content
  content="$(cat)"
  for _ in 1 2 3 4 5 6; do
    if printf '%s\n' "$content" | qm guest exec "$VMID" --pass-stdin 1 --timeout 30 -- \
        bash -c "umask 077; mkdir -p \"\$(dirname '$path')\"; cat > '$path'; chmod $mode '$path'" >/dev/null 2>&1; then
      return 0
    fi
    sleep 10
  done
  return 1
}

msg "À espera do agente da VM (o cloud-init instala-o no primeiro arranque)…"
for _ in $(seq 1 120); do
  qm agent "$VMID" ping >/dev/null 2>&1 && break
  sleep 5
done
qm agent "$VMID" ping >/dev/null 2>&1 \
  || die "O agente da VM não respondeu em 10 minutos. Vê a consola da VM: a rede/DNS chegaram lá?"
ok "Agente a responder"

for _ in $(seq 1 60); do
  [ -n "$(guest hostname -I | awk '{print $1}')" ] && break
  sleep 2
done
VM_IP="$(guest hostname -I | awk '{print $1}')"
[ -n "$VM_IP" ] || die "A VM não tem IP. Confirma a bridge, o IP e o gateway (qm config $VMID)."
APP_URL="${APP_URL:-http://$VM_IP}"
ok "Rede: $VM_IP"

# O agente é instalado pelo cloud-init no mesmo apt que o git, e pode responder antes
# de o resto estar pronto. Espera-se que o cloud-init termine e que o git exista.
msg "À espera que o cloud-init termine…"
for _ in $(seq 1 90); do
  ci_status="$(guest cloud-init status 2>/dev/null)"
  case "$ci_status" in *done*|*error*|*degraded*) break ;; esac
  sleep 5
done
for _ in $(seq 1 30); do
  [ -n "$(guest sh -c 'command -v git')" ] && break
  sleep 5
done
[ -n "$(guest sh -c 'command -v git')" ] || die "O git não ficou instalado na VM (o cloud-init falhou?). Vê: qm guest exec $VMID -- cloud-init status --long"
ok "Cloud-init terminado"

# --- instalação -------------------------------------------------------------------------

# Com token, vai no URL do clone para o intristock-update conseguir ir buscar
# versões. Fica dentro da VM (.git/config do repo), nunca no host.
CLONE_URL="$REPO_URL"
if [ -n "$REPO_TOKEN" ]; then
  CLONE_URL="$(printf '%s' "$REPO_URL" | sed -E "s#^https://#https://oauth2:${REPO_TOKEN}@#")"
fi

# A configuração entra pelo stdin do agente: não toca no disco do host
{
  printf 'APP_URL=%q\n' "$APP_URL"
  printf 'ADMIN_EMAIL=%q\n' "$ADMIN_EMAIL"
  printf 'ADMIN_PASSWORD=%q\n' "$ADMIN_PASSWORD"
  printf 'INSTALL_REF=%q\n' "$INSTALL_REF"
  printf 'CLONE_URL=%q\n' "$CLONE_URL"
} | guest_write /root/intristock-install.env 600 \
  || die "O agente da VM não aceitou a configuração (6 tentativas). Vê a VM: qm terminal $VMID"

# O arranque da instalação: clona, escolhe a versão e corre o install.sh em fundo,
# a escrever o passo atual e o resultado em /var/lib/intristock
guest_write /root/intristock-bootstrap.sh 700 <<'BOOT' \
  || die "O agente da VM não aceitou o arranque da instalação (6 tentativas). Vê a VM: qm terminal $VMID"
#!/bin/bash
set -uo pipefail
STEP=/var/lib/intristock/install-step
RESULT=/var/lib/intristock/install-result
LOG=/var/log/intristock-install.log
mkdir -p /var/lib/intristock
# Só uma instalação de cada vez: o host pode repetir o arranque se o agente não
# lhe responder, e uma segunda cópia sai logo aqui
exec 9>/var/lib/intristock/bootstrap.lock
flock -n 9 || exit 0
rm -f "$RESULT"
set -a; . /root/intristock-install.env; set +a
# A configuração (password do admin, token) sai daqui no fim, corra bem ou mal
trap "shred -u /root/intristock-install.env 2>/dev/null || rm -f /root/intristock-install.env" EXIT
echo "Descarregar o código" > "$STEP"
: > "$LOG"
# Até 5 tentativas: logo a seguir ao arranque a rede ou o DNS podem ainda não estar firmes
if [ ! -d /opt/intristock/.git ]; then
  for attempt in 1 2 3 4 5; do
    rm -rf /opt/intristock
    echo "git clone (tentativa $attempt)" >> "$LOG"
    git clone --quiet "$CLONE_URL" /opt/intristock >> "$LOG" 2>&1 && break
    sleep 10
  done
  [ -d /opt/intristock/.git ] || { echo "fail:clone" > "$RESULT"; exit 1; }
fi
cd /opt/intristock
REF="$INSTALL_REF"
if [ "$REF" = latest ]; then
  REF="$(git tag -l "v*" --sort=-v:refname | head -1)"
  REF="${REF:-main}"
fi
git checkout --quiet "$REF" >> "$LOG" 2>&1 || { echo "fail:checkout $REF" > "$RESULT"; exit 1; }
if bash deploy/proxmox/install.sh >> "$LOG" 2>&1; then
  echo ok > "$RESULT"
else
  echo "fail:install" > "$RESULT"
fi
BOOT

# Arranca em fundo e volta logo. Se o agente não responder, repete-se: o lock do
# bootstrap garante que nunca correm duas instalações. Pára de repetir assim que a
# instalação tiver começado (já escreveu o primeiro passo).
started=""
for _ in 1 2 3 4 5 6; do
  qm guest exec "$VMID" --timeout 20 -- \
    bash -c 'nohup bash /root/intristock-bootstrap.sh >/dev/null 2>&1 &' >/dev/null 2>&1 || true
  sleep 5
  if [ -n "$(guest cat /var/lib/intristock/install-step)" ]; then started=1; break; fi
  sleep 5
done
[ -n "$started" ] || die "A instalação não arrancou dentro da VM (6 tentativas). Vê a VM: qm terminal $VMID"

msg "A instalar dentro da VM (uns minutos — o build da app é o passo mais demorado)…"
last_step=""
result=""
for _ in $(seq 1 360); do
  current="$(guest cat /var/lib/intristock/install-step | head -1)"
  if [ -n "$current" ] && [ "$current" != "$last_step" ]; then
    printf '   %s·%s %s\n' "$DIM" "$RESET" "$current"
    last_step="$current"
  fi
  result="$(guest cat /var/lib/intristock/install-result | head -1)"
  [ -n "$result" ] && break
  sleep 10
done

if [ "$result" != ok ]; then
  warn "Últimas linhas do registo da instalação (/var/log/intristock-install.log):"
  guest tail -n 40 /var/log/intristock-install.log | sed 's/^/   /' >&2
  die "A instalação não terminou bem (${result:-sem resposta em 60 minutos})."
fi

cat <<EOF

${GREEN}${APP} está pronto.${RESET}

  Abrir:          ${BOLD}${APP_URL}${RESET}
  Login da app:   ${ADMIN_EMAIL} / $([ "$ADMIN_PASSWORD" = admin ] && echo admin || echo '(a que escolheste)')
                  ao entrar pela primeira vez, mete as chaves das APIs de moedas e de países
  VM:             $VMID ($VM_IP)
  Entrar na VM:   consola do Proxmox$([ -n "$SSH_KEY_FILE" ] && echo " ou ssh ${VM_USER}@${VM_IP} (com a chave)")
                  utilizador ${VM_USER}, password $([ -n "$VM_PASSWORD_GENERATED" ] && echo "${BOLD}${VM_PASSWORD}${RESET} (gerada — guarda-a)" || echo '(a que escolheste)')
  Configurar:     sudo intristock-config     (backend e frontend)
  Atualizar:      sudo intristock-update     (ou na app: Definições → Versões)
  Credenciais:    sudo cat /root/intristock-credentials.txt

EOF
[ "$ADMIN_PASSWORD" = admin ] && warn "A password do admin da app é 'admin'. Muda-a em Definições → Segurança antes de abrir a app à internet."
exit 0
