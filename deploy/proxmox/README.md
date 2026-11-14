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
| Código | `/opt/intristock` (clone do repo, utilizador `intristock`) |
| Configuração do backend | `/etc/intristock/backend.env` |
| Configuração do frontend | `/etc/intristock/frontend.env` (só conta no build) |
| Serviços | `intristock.service` (backend), `intristock-downloader`, `intristock-simulator`, `garage.service`, `clickhouse-server`, `nginx`, `postgresql` |
| Frontend publicado | `/var/www/intristock` |
| Base de dados | PostgreSQL local, base e utilizador `intristock` |
| Documentos (faturas) | Garage em `/var/lib/garage`, bucket `intristock` |
| Velas do simulador | ClickHouse local (repositório apt da ClickHouse, canal LTS), base e utilizador `intristock` |
| Apps Python | `apps/downloader` e `apps/simulator`, cada uma com o seu `.venv` |
| Backups da base de dados | `/var/backups/intristock`, todos os dias às 03:30, 14 dias |
| Credenciais geradas | `/root/intristock-credentials.txt` |

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
  clone e para as atualizações. Para descarregar o próprio script, o `curl` também
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
  - login e password do admin da app (em branco = `admin` / `admin`);
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

Abre o endereço da app e entra com **`admin` / `admin`**. Antes de tudo aparece o
assistente: escolhes as APIs e metes as chaves.

| API | Fornecedor | Chave |
|---|---|---|
| Moedas e cotações | CurrencyBeacon (`https://api.currencybeacon.com/v1`) | conta grátis em currencybeacon.com |
| Países | Country State City (`https://api.countrystatecity.in/v1`) | conta grátis em countrystatecity.in |

As chaves ficam **cifradas** na base de dados (com a `ENCRYPTION_KEY` do
`backend.env`). A seguir os países e as moedas sincronizam sozinhos, e entram os
**impostos e as plataformas pré-definidos** (IVA de Portugal continental, Espanha,
França, Alemanha, Itália e Reino Unido; os principais bancos portugueses, corretoras e
exchanges).

**Muda a password do admin** em Definições → Segurança antes de abrires a app à internet.

## 3. Domínio e SSL

No Nginx Proxy Manager: `intristock.example.com` → `http://<IP da VM>:80`, com SSL.
O cookie de sessão fica `secure` sozinho quando se entra por https e continua a
funcionar quando se entra pelo IP em http.

Se mudares o endereço depois, ajusta o `FRONTEND_URL` com o `intristock-config`.

## 4. Configurar

Dentro da VM:

```bash
sudo intristock-config             # menu com o backend e o frontend
sudo intristock-config backend     # o backend.env inteiro no nano
sudo intristock-config frontend    # o frontend.env inteiro no nano
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

Passos: versão → **programas da VM** → compilar → base de dados → publicar → serviços
→ reiniciar. **Se um passo falhar, volta sozinho à versão anterior** e a app continua a
funcionar.

O passo **programas da VM** é o que trata de "programas novos": volta a garantir a lista
`SYSTEM_PACKAGES` do `lib.sh`, a versão do Node e a do Garage, o ClickHouse, e corre
`deploy/proxmox/upgrades/<versão>.sh` se essa versão trouxer um. As atualizações de
segurança do Debian correm sozinhas todos os dias (`unattended-upgrades`) — não esperam
por uma versão nova do IntriStock.

Como o botão funciona: o backend corre sem privilégios e só escreve
`/var/lib/intristock/updates/request`; a unit `intristock-updater.path` (root) vê o
ficheiro e corre `update.sh --from-request`, que escreve o progresso em `status.json` e
o output em `update.log`. Logs: `journalctl -u intristock-updater`.

## 6. Manutenção

```bash
journalctl -u intristock -f                         # logs do backend
journalctl -u intristock-downloader -u intristock-simulator -f   # velas e simulações
systemctl status intristock intristock-downloader intristock-simulator garage clickhouse-server nginx postgresql
sudo /opt/intristock/deploy/proxmox/backup.sh       # backup agora
gunzip -c /var/backups/intristock/<ficheiro>.sql.gz | sudo runuser -u postgres -- psql -d intristock   # repor
```

O backup do Proxmox (vzdump) apanha a VM inteira, incluindo os documentos do Garage;
o dump diário é o que garante a base de dados consistente. As velas do ClickHouse não
entram no dump: voltam a descarregar-se da Binance quando uma simulação precisa delas.

O simulador corre `núcleos − 1` simulações ao mesmo tempo (`SIMULATOR_PROCESSES` no
`backend.env` muda isso) e o ClickHouse fica com até 40 % da memória: com o simulador,
4 GB de RAM é o mínimo confortável.

## Reinstalar por cima

`sudo bash /opt/intristock/deploy/proxmox/install.sh` dentro da VM pode correr outra vez:
a configuração, os segredos, a base de dados e o storage que já existem ficam como estão.
