# Deployment

IntriStock installs on a **Proxmox VE** host as a Debian 13 VM. There is no Docker image: the installer puts Node, PostgreSQL, Garage, ClickHouse, Python, nginx and the services straight on the VM. The full guide, in Portuguese, is [`deploy/proxmox/README.md`](../deploy/proxmox/README.md).

## Install

In the **host shell** of Proxmox (Datacenter → node → Shell), as root:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/TTiagoSousa/Intristock/main/deploy/proxmox/vm-create.sh)"
```

The script asks about the VM (ID, storage, disk, CPU, memory, network) and the app (address, admin), creates the VM from the official Debian cloud image and installs everything inside it, showing the progress. At the end it prints the address and the admin login; with the admin password left blank it generates a random one and prints it once (it is not written anywhere). Passwords and tokens are passed through the QEMU guest agent and are never written on the host.

Without menus: `NONINTERACTIVE=1` plus the variables you want to change (`VMID`, `STORAGE`, `DISK_GB`, `CORES`, `RAM_MB`, `NET_MODE`, `IP`, `GATEWAY`, `INSTALL_REF`, `APP_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`…). The header of `vm-create.sh` lists them all.

### From a mirror

The installer works with any git server. With a mirror on Forgejo, Gitea or GitLab, pass `REPO_URL` and download the script from the mirror:

```bash
REPO_URL=https://git.example.com/me/intristock.git \
  bash -c "$(curl -fsSL https://git.example.com/me/intristock/raw/branch/main/deploy/proxmox/vm-create.sh)"
```

The install then takes its updates from that mirror, so the mirror must copy the **tags** too (Forgejo and Gitea pull mirrors do). A new version only reaches the VM after the mirror syncs: on Forgejo every 8 hours by default (repository settings → mirror interval, or "Synchronize now"). A private mirror needs `REPO_TOKEN`.

Without `REPO_URL` the installer tries this GitHub repository first and then the author's Forgejo mirror, and uses the first that answers.

### The VM always needs GitHub

The chart library, [OpenChartsCandle](https://github.com/TTiagoSousa/OpenChartsCandle), is installed from GitHub at the tag in `apps/frontend/package.json`, wherever IntriStock itself comes from. Without access to GitHub the frontend build fails, both when installing and when updating.

## What runs where

| Piece | Where |
|---|---|
| Code | `/opt/intristock` (a clone of the repository, owned by **root**; the app only reads it) |
| Builds | `/opt/intristock-builds/<date>-<commit>`, owned by user `intristock` (dependencies, `dist`, `.venv`); the running one is `/opt/intristock-builds/current`, and the previous one is kept |
| Backend configuration | `/etc/intristock/backend.env` |
| Backup configuration | `/etc/intristock/backup.env` (external copy folder, retention) |
| Services | `intristock` (backend), `intristock-downloader`, `intristock-simulator`, `garage`, `clickhouse-server`, `nginx`, `postgresql` |
| Frontend | `/var/www/intristock` |
| Documents | Garage in `/var/lib/garage`, bucket `intristock` |
| Update state | request in `/var/lib/intristock/updates/request` (written by the app); status, log and lock in `/var/lib/intristock-state` (root) |
| Backups | `/var/backups/intristock`, every day at 03:30: the database and the configuration (14 days) and the Garage documents (3 days) |
| Generated credentials | `/root/intristock-credentials.txt` (without the admin password; keep a copy off the VM and delete it) |

## Updates

The admin updates from the app (Versions → Update). Behind it, `deploy/proxmox/update.sh` fetches the tags, checks out the next version, installs what the VM needs, builds it in a new directory next to the running one, dumps the database, applies the migrations, switches the `current` link and restarts the services, writing its progress for the app to show.

- **One version at a time.** Both the app and the script refuse to skip a version, so every migration and upgrade step runs in order.
- A version that needs a change on the VM ships it in `deploy/proxmox/upgrades/<version>.sh` or adds the package to `SYSTEM_PACKAGES` in `deploy/proxmox/lib.sh`.
- **Rollback.** Any failure (or the script stopping half-way) puts back the previous code, the previous build (no rebuild), the previous frontend and, if the migrations had started, the database from the dump taken right before them.
- **Health.** After the restart the backend must answer `GET /health` (which runs `SELECT 1`) and the workers must stay up.
- **Ownership.** The `intristock` user never writes anything root runs: the repository and the deploy scripts are root's, the update status lives in a root directory, and the app only writes the update request. Older VMs move to this layout on their first update.
- **Signed tags (optional).** With `/etc/intristock/release-signers` (SSH `allowed_signers`) or `/etc/intristock/release-key.asc` (GPG public key) on the VM, a tag without a valid signature is refused; without them the script only warns. `npm run release -- --push` signs the tag when git has `user.signingkey`. Tags are fetched without `--force`, so a tag the VM already has cannot change silently. New tags arrive through the hourly `intristock-fetch.timer`.

## After installing

1. Open the app and sign in with the admin from the end of the install. Change the password.
2. In Settings → APIs, enter the keys for the exchange rates (CurrencyBeacon) and the countries API. PropFirmMap needs no key. CoinGecko (the crypto exchanges, added to the platforms when you save it) works without one, and a free Demo key allows more requests.
3. Create the other users in Settings → Users.
