# Instalar no Proxmox (VM)

Um script no host do Proxmox cria uma VM Debian 13 e instala lá dentro tudo o que a
app precisa. Sem Docker e sem Coolify.

```
┌──────────────────────────── VM (Debian 13, cloud-init) ────────────────────────────┐
│                                                                                    │
│   nginx :80 ──┬── /        → /var/www/intristock   (frontend, ficheiros)            │
│               └── /api/*   → 127.0.0.1:3000        (backend, systemd)               │
│                                    │                    │                          │
│                         PostgreSQL 17 (localhost)   Garage S3 (127.0.0.1:3900)      │
│                                    │                                               │
│        downloader + simulador (Python, systemd) ── ClickHouse (127.0.0.1:8123)      │
└────────────────────────────────────────────────────────────────────────────────────┘
```

| Peça | Onde |
|---|---|
| Código | `/opt/intristock` (clone do repo, dono **root**; a app só o lê) |
| Builds | `/opt/intristock-builds/<data>-<commit>` (da app: dependências, `dist`, `.venv`), o que corre em `/opt/intristock-builds/current`; fica também o anterior |
| Configuração do backend | `/etc/intristock/backend.env` |
| Configuração do frontend | `/etc/intristock/frontend.env` (só conta no build) |
| Configuração dos backups | `/etc/intristock/backup.env` (cópia externa, dias que se guardam) |
| Serviços | `intristock.service` (backend), `intristock-downloader`, `intristock-simulator`, `garage.service`, `clickhouse-server`, `nginx`, `postgresql` |
| Frontend publicado | `/var/www/intristock` |
| Base de dados | PostgreSQL local, base e utilizador `intristock` |
| Documentos (faturas) | Garage em `/var/lib/garage`, bucket `intristock` |
| Velas do simulador | ClickHouse local (repositório apt da ClickHouse, canal LTS), base e utilizador `intristock` |
| Apps Python | `apps/downloader` e `apps/simulator` de cada build, cada uma com o seu `.venv` |
| Atualizações | pedido da app em `/var/lib/intristock/updates/request`; estado, log e lock em `/var/lib/intristock-state` (root) |
| Backups | `/var/backups/intristock`: base de dados, configuração e documentos, todos os dias às 03:30 (ver §6) |
| Credenciais geradas | `/root/intristock-credentials.txt` (sem a password do admin; guarda uma cópia fora da VM e apaga-o) |

## 1. Criar e instalar

Na **Shell do host** do Proxmox (Datacenter → nó → Shell), uma linha:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/TTiagoSousa/Intristock/main/deploy/proxmox/vm-create.sh)"
```

### A partir de um espelho (Forgejo, Gitea, GitLab, servidor próprio)

O instalador funciona com qualquer servidor git. Quem tiver um espelho do repositório
no seu Forgejo ou Gitea diz de onde vem o código com `REPO_URL`, e descarrega o script
do próprio espelho:

```bash
# Forgejo / Gitea
REPO_URL=https://git.exemplo.pt/eu/intristock.git \
  bash -c "$(curl -fsSL https://git.exemplo.pt/eu/intristock/raw/branch/main/deploy/proxmox/vm-create.sh)"

# GitLab
REPO_URL=https://gitlab.exemplo.pt/eu/intristock.git \
  bash -c "$(curl -fsSL https://gitlab.exemplo.pt/eu/intristock/-/raw/main/deploy/proxmox/vm-create.sh)"
```


- **As atualizações seguem a origem**: uma VM instalada a partir de um espelho vai lá
  buscar as versões novas. O espelho tem de copiar **também as tags** (os espelhos de
  pull do Forgejo e do Gitea copiam-nas sozinhos) — é por elas que as versões chegam.
  Uma versão nova só aparece na VM depois de o espelho sincronizar: no Forgejo, por
  omissão, de 8 em 8 horas (Definições do repositório → Intervalo de sincronização, ou
  «Sincronizar agora»).
- **A VM precisa sempre do GitHub**: a biblioteca dos gráficos
  ([OpenChartsCandle](https://github.com/TTiagoSousa/OpenChartsCandle)) instala-se do
  GitHub pela tag que está no `apps/frontend/package.json`, venha o IntriStock de onde
  vier. Sem acesso ao GitHub o build do frontend falha, na instalação e nas atualizações.
- **Sem `REPO_URL`**, o instalador experimenta o repositório oficial no GitHub e depois o
  espelho do autor, e usa o primeiro que responder.
- **Repositório privado**: passa-se o token com `REPO_TOKEN=…`; serve para o
  clone e para as atualizações. Na VM fica em `/etc/intristock/git-credentials` (só
  root), não no `.git/config`. O repositório oficial é público: não precisa de token. Para descarregar o próprio script, o `curl` também
  precisa dele: `curl -fsSL -H "Authorization: token <TOKEN>" <url do vm-create.sh>`.

A origem é confirmada **antes** de a VM ser criada: um endereço errado ou um
repositório privado sem token param logo ali, com a explicação.

Abre um menu:

- **Default** — próximo ID livre, primeiro storage ativo, 32 GB, 2 CPUs, 4 GB de RAM,
  DHCP, DNS do host, endereço `http://<IP da VM>`, a **última versão**.
- **Advanced** — ecrã a ecrã, já preenchido com a sugestão:
  - ID e nome (valida se o ID está livre);
  - storage do disco e dos snippets (lista com o espaço livre);
  - disco, CPUs, RAM;
  - bridge, **DHCP ou IP fixo**, VLAN opcional, DNS do host ou próprio;
  - arrancar com o host;
  - **endereço da app**: IP da VM ou domínio próprio;
  - login e password do admin da app (login em branco = `admin`; password em branco = uma
    aleatória, mostrada **uma vez** no fim e não escrita em lado nenhum — guarda-a);
  - utilizador e password da VM (para a consola) e chave SSH opcional;
  - versão: a última, ou um branch (`main`, `staging`, `develop`) para testes.

Um valor inválido volta a ser pedido. No fim aparece o ecrã **Revisão**: *Criar* ou
*Editar*.

O que o script faz: descarrega a imagem cloud oficial do Debian 13, cria a VM, liga o
cloud-init (só instala o agente da VM e o git — sem segredos), arranca-a, e depois,
pelo agente, entrega a configuração e corre o `install.sh` lá dentro, mostrando cada
passo. A password do admin e o token **nunca ficam escritos no host**.

Sem menus (automação): `NONINTERACTIVE=1` e as variáveis que quiseres mudar — a lista
está no cabeçalho do `vm-create.sh`.

```bash
NONINTERACTIVE=1 STORAGE=local-lvm NET_MODE=static IP=192.168.0.70/24 GATEWAY=192.168.0.1 \
  APP_URL=https://intristock.example.com \
  bash -c "$(curl -fsSL https://raw.githubusercontent.com/TTiagoSousa/Intristock/main/deploy/proxmox/vm-create.sh)"
```

> O cloud-init de cada VM fica num snippet (`intristock-<ID>-vendor.yaml`, no storage
> de snippets). Não o apagues enquanto a VM existir — o Proxmox lê-o em cada arranque.
> Se nenhum storage aceitar snippets, o script ativa-os no `local`.

## 2. Primeiro arranque

Abre o endereço da app e entra com o login do admin (`admin` por omissão) e a password
que escolheste ou a que o instalador gerou e mostrou no fim. Antes de tudo aparece o
assistente: escolhes as APIs e metes as chaves.

| API | Fornecedor | Chave |
|---|---|---|
| Moedas e cotações | CurrencyBeacon (`https://api.currencybeacon.com/v1`) | conta grátis em currencybeacon.com |
| Países | Country State City (`https://api.countrystatecity.in/v1`) | conta grátis em countrystatecity.in |
| Exchanges de cripto (opcional) | CoinGecko (`https://api.coingecko.com/api/v3`) | sem chave funciona; a Demo, grátis em coingecko.com, dá mais pedidos |

As chaves ficam **cifradas** na base de dados (com a `ENCRYPTION_KEY` do
`backend.env`). A seguir os países, as moedas e as exchanges (nas plataformas) sincronizam sozinhos, e entram os
**impostos e as plataformas pré-definidos** (IVA de Portugal continental, Espanha,
França, Alemanha, Itália e Reino Unido; os principais bancos portugueses, corretoras e
exchanges).

Se escolheste uma password fraca (ou `admin`), **muda-a** em Definições → Segurança antes
de abrires a app à internet.

## 3. Domínio e SSL

No Nginx Proxy Manager: `intristock.example.com` → `http://<IP da VM>:80`, com SSL.
O cookie de sessão fica `secure` sozinho quando se entra por https e continua a
funcionar quando se entra pelo IP em http.

Se mudares o endereço depois, ajusta o `FRONTEND_URL` com o `intristock-config`.

## 4. Configurar

Dentro da VM:

```bash
sudo intristock-config             # menu com o backend, o frontend e os backups
sudo intristock-config backend     # o backend.env inteiro no nano
sudo intristock-config frontend    # o frontend.env inteiro no nano
sudo intristock-config backup      # o backup.env inteiro no nano
```

No menu, ↑/↓ escolhe, Enter abre a caixa para alterar, **Guardar** aplica: o backend é
reiniciado e, se mudou o frontend, o site é compilado e publicado outra vez. As
alteradas ficam marcadas com `*`.

A base de dados, os segredos JWT e a `ENCRYPTION_KEY` não aparecem no menu.

> ⚠ **A `ENCRYPTION_KEY` não se muda.** Cifra as chaves das APIs; com outra chave elas
> deixam de abrir e o admin tem de as voltar a meter. O `intristock-config` recusa
> gravar uma alteração a essa linha.

As chaves das APIs não vão aqui — o admin muda-as na app, em **Definições → APIs**, onde
também estão os botões para **atualizar países, moedas e cotações**.

## 5. Atualizar

Atualiza-se **uma versão de cada vez**: a seguir à v1.2.0 só se pode instalar a v1.3.0,
nunca saltar para a v1.5.0. Cada versão pode trazer passos próprios para a VM que
contam com a anterior já instalada.

**Pela app (admin):** Definições → **Versões** → *Atualizar para vX.Y.Z*. A janela mostra
cada passo e recarrega a página no fim. Voltar para trás não é permitido.

**Pela consola (dentro da VM):**

```bash
sudo intristock-update            # a versão seguinte à instalada
sudo intristock-update v1.4.0     # tem de ser a seguinte
sudo intristock-update develop    # um branch (testes)
sudo FORCE=1 intristock-update    # recompilar mesmo sem nada novo
```

Passos: versão (e a assinatura da tag) → **programas da VM** → compilar → **backup da
base de dados** → migrações → publicar → serviços → reiniciar.

- **Compila-se ao lado.** A versão nova vai para um diretório novo em
  `/opt/intristock-builds` enquanto a anterior continua a correr; só no passo dos serviços
  o link `current` passa para ela. Ficam sempre o build atual e o anterior.
- **Backup antes das migrações.** Logo antes de migrar faz-se um dump
  (`/var/backups/intristock/intristock-pre-vX.Y.Z-<data>.sql.gz`, mais a configuração).
- **Se um passo falhar** — ou o script parar a meio por qualquer motivo — **volta sozinho
  à versão anterior**: o código, o link para o build anterior (sem compilar outra vez), o
  frontend e, se as migrações já tinham começado, a base de dados desse dump. A app
  continua na versão que tinha. O que se escrever na app entre o dump e a falha perde-se
  na reposição; as tabelas do ClickHouse (das apps Python) não voltam atrás.
- **Saúde.** Depois de reiniciar, o backend tem de responder ao `GET /health` (que vai à
  base de dados) e o downloader e o simulador têm de ficar a correr sem reinícios.

O passo **programas da VM** é o que trata de "programas novos": volta a garantir a lista
`SYSTEM_PACKAGES` do `lib.sh`, a versão do Node e a do Garage (as duas fixadas, com o
SHA-256 de cada ficheiro), o ClickHouse, e corre `deploy/proxmox/upgrades/<versão>.sh` se
essa versão trouxer um. As atualizações de segurança do Debian correm sozinhas todos os
dias (`unattended-upgrades`) — não esperam por uma versão nova do IntriStock.

Como o botão funciona: o backend corre sem privilégios e só escreve
`/var/lib/intristock/updates/request`; a unit `intristock-updater.path` (root) vê o
ficheiro e corre `update.sh --from-request`, que escreve o progresso em `status.json` e
o output em `update.log`, em `/var/lib/intristock-state` (do root; a app lê-os pelos
links em `updates/`). Logs: `journalctl -u intristock-updater`.

As versões novas chegam à VM pelo `intristock-fetch.timer` (de hora a hora, como root:
o `.git` é do root, e a app já não o pode mudar) e em cada atualização.

### Quem é dono de quê

O utilizador da app (`intristock`) nunca escreve em nada que o root corra: o
repositório (`/opt/intristock`, com os scripts de deploy, o `lib.sh` e os `upgrades/`) é
do root; a app só é dona dos builds (`/opt/intristock-builds/<build>`), da pasta dela
(`/var/lib/intristock`) e do pedido de atualização. O estado das atualizações vive num
diretório do root.

Uma VM instalada antes disto passa a este esquema sozinha na primeira atualização: o
repositório passa a ser do root, os hooks do git saem, o token do repositório (se houver)
sai do `.git/config`, o log e o estado mudam de sítio, os serviços passam para o build
novo e as dependências antigas de dentro do repo são apagadas no fim. Essa primeira vez
ainda corre a etapa 1 do `update.sh` antigo.

### Tags assinadas (opcional)

Por omissão o `update.sh` só **avisa** que a tag não foi verificada. Para só aceitar
releases assinadas, põe na VM a chave pública de quem as assina:

- **SSH** — `/etc/intristock/release-signers`, no formato `allowed_signers` do git:
  ```
  tiago@exemplo.pt namespaces="git" ssh-ed25519 AAAA…
  ```
- **GPG** — `/etc/intristock/release-key.asc`, a chave pública em ASCII
  (`gpg --armor --export <id>`).

Com um destes ficheiros, uma tag sem assinatura válida é **recusada** antes do checkout
(nada muda na VM). Os branches (testes) não são verificados.

Do lado de quem faz a release, o `npm run release -- --push` assina a tag (`git tag -s`)
quando o git tem `user.signingkey` (e, para SSH, `gpg.format ssh`); sem chave cria a tag
anotada como antes e avisa.

O `git fetch` das versões é **sem `--force`**: uma tag que a VM já tem não muda em
silêncio. Se mudar na origem, a atualização falha com "Uma tag que esta VM já tinha
mudou na origem" — confirma no repositório oficial antes de fazer seja o que for.

## 6. Manutenção

```bash
journalctl -u intristock -f                         # logs do backend
journalctl -u intristock-downloader -u intristock-simulator -f   # velas e simulações
systemctl status intristock intristock-downloader intristock-simulator garage clickhouse-server nginx postgresql
sudo /opt/intristock/deploy/proxmox/backup.sh       # backup agora
cat /var/lib/intristock-state/backup.json           # como correu o último
journalctl -t intristock-backup                     # as falhas
```

### Backups

Todos os dias às 03:30 (`/etc/cron.d/intristock-backup`, log em
`/var/log/intristock-backup.log`), em `/var/backups/intristock` (só root):

| Ficheiro | O que tem | Guarda-se |
|---|---|---|
| `intristock-<data>.sql.gz` | a base de dados (`pg_dump`) | 14 dias |
| `intristock-config-<data>.tar.gz` | `/etc/intristock` e `/etc/garage.toml`: a `ENCRYPTION_KEY`, os segredos JWT, as chaves do S3 — sem eles o dump não chega | 14 dias |
| `intristock-garage-<data>.tar` | os documentos: um snapshot dos metadados do Garage e os blocos | 3 dias |

**Cópia para fora da VM:** no `intristock-config` (secção backup, ou
`intristock-config backup`), `BACKUP_COPY_DIR` = uma pasta já montada (NFS, SMB, um
disco), ex. `/mnt/backups`. Cada backup diário é copiado para lá com a mesma retenção. Se
a pasta não existir (o disco não montou) o backup **falha** — para se ver.

**Quando falha:** sai com erro, fica no log do cron, no journal
(`journalctl -t intristock-backup`) e em `/var/lib/intristock-state/backup.json`
(`"state":"failed"` e a mensagem). O backend lê esse ficheiro de hora a hora e avisa os
admins no sino (`backup_failed`, uma vez por falha).

Repor (com a app parada: `systemctl stop intristock intristock-downloader intristock-simulator`):

```bash
gunzip -c /var/backups/intristock/<ficheiro>.sql.gz | sudo runuser -u postgres -- psql -d intristock
sudo tar -xzf /var/backups/intristock/intristock-config-<data>.tar.gz -C /
# documentos, com o Garage parado (systemctl stop garage):
sudo tar -xf /var/backups/intristock/intristock-garage-<data>.tar -C /var/lib/garage
#   o snapshot dos metadados fica em meta/snapshots/<data>: copia-o por cima de
#   meta/db.sqlite e depois chown -R garage:garage /var/lib/garage
```

O backup do Proxmox (vzdump) apanha a VM inteira; o dump diário é o que garante a base de
dados consistente. As velas do ClickHouse não entram: voltam a descarregar-se da Binance
quando uma simulação precisa delas.

### Memória

O simulador corre `núcleos − 1` simulações ao mesmo tempo (`SIMULATOR_PROCESSES` no
`backend.env` muda isso) e o ClickHouse fica com até 40 % da memória: com o simulador,
4 GB de RAM é o mínimo confortável. O serviço do simulador tem um teto (`MemoryHigh=45%`,
`MemoryMax=55%` da RAM) e é o primeiro que o OOM killer escolhe (`OOMScoreAdjust=500`); o
Postgres é o último (`OOMScoreAdjust=-500`, num drop-in do `postgresql@.service`).

### nginx

O site vai com gzip (JS, CSS, JSON, SVG) e com os cabeçalhos de segurança
(`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, uma
CSP e, só quando se entra por https, HSTS), em `/etc/nginx/snippets/intristock-headers.conf`.
A CSP deixa ligar à própria origem e, se o `VITE_API_URL` for um endereço completo, a esse.

## Reinstalar por cima

`sudo bash /opt/intristock/deploy/proxmox/install.sh` dentro da VM pode correr outra vez:
a configuração, os segredos, a base de dados e o storage que já existem ficam como estão.
