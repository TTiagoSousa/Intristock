# Deployment

IntriStock installs on a **Proxmox VE** host as a Debian 13 VM. There is no Docker image: the installer puts Node, PostgreSQL, Garage, ClickHouse, Python, nginx and the services straight on the VM. The full guide, in Portuguese, is [`deploy/proxmox/README.md`](../deploy/proxmox/README.md).

## Install

In the **host shell** of Proxmox (Datacenter → node → Shell), as root:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/TTiagoSousa/Intristock/main/deploy/proxmox/vm-create.sh)"
```

The script asks about the VM (ID, storage, disk, CPU, memory, network) and the app (address, admin), creates the VM from the official Debian cloud image and installs everything inside it, showing the progress. At the end it prints the address and the admin login. Passwords and tokens are passed through the QEMU guest agent and are never written on the host.

Without menus: `NONINTERACTIVE=1` plus the variables you want to change (`VMID`, `STORAGE`, `DISK_GB`, `CORES`, `RAM_MB`, `NET_MODE`, `IP`, `GATEWAY`, `INSTALL_REF`, `APP_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`…). The header of `vm-create.sh` lists them all.

### From a mirror

The installer works with any git server. With a mirror on Forgejo, Gitea or GitLab, pass `REPO_URL` and download the script from the mirror:

```bash
REPO_URL=https://git.example.com/me/intristock.git \
  bash -c "$(curl -fsSL https://git.example.com/me/intristock/raw/branch/main/deploy/proxmox/vm-create.sh)"
```

The install then takes its updates from that mirror, so the mirror must copy the **tags** too (Forgejo and Gitea pull mirrors do). A private mirror needs `REPO_TOKEN`.

## What runs where

| Piece | Where |
|---|---|
| Code | `/opt/intristock` (a clone of the repository, user `intristock`) |
| Backend configuration | `/etc/intristock/backend.env` |
| Services | `intristock` (backend), `intristock-downloader`, `intristock-simulator`, `garage`, `clickhouse-server`, `nginx`, `postgresql` |
| Frontend | `/var/www/intristock` |
| Documents | Garage in `/var/lib/garage`, bucket `intristock` |
| Database backups | `/var/backups/intristock`, every day at 03:30, kept for 14 days |
| Generated credentials | `/root/intristock-credentials.txt` |

## Updates

The admin updates from the app (Versions → Update). Behind it, `deploy/proxmox/update.sh` fetches the tags, checks out the next version, installs what the VM needs, rebuilds, applies the migrations and restarts the services, writing its progress for the app to show.

- **One version at a time.** Both the app and the script refuse to skip a version, so every migration and upgrade step runs in order.
- A version that needs a change on the VM ships it in `deploy/proxmox/upgrades/<version>.sh` or adds the package to `SYSTEM_PACKAGES` in `deploy/proxmox/lib.sh`.

## After installing

1. Open the app and sign in with the admin from the end of the install. Change the password.
2. In Settings → APIs, enter the keys for the exchange rates (CurrencyBeacon) and the countries API. PropFirmMap needs no key.
3. Create the other users in Settings → Users.
