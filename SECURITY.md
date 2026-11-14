# Security policy

## Supported versions

Only the latest release receives security fixes. Installs update one version at a time from Versions → Update, so keep yours current before reporting.

| Version | Supported |
|---|---|
| Latest `1.x` | Yes |
| Older versions | No |

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report it privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability** ([direct link](https://github.com/TTiagoSousa/Intristock/security/advisories/new)). Include:

- the affected version or commit;
- what an attacker can do and how (the requests or steps that reproduce it);
- any idea you have for a fix.

You can expect a first answer within a week. Once the problem is confirmed, a fix is prepared in private and released as a new version, and the advisory is published with credit to you (unless you prefer to stay anonymous).

## Scope

IntriStock is self-hosted: each install runs on its own VM with its own admin. Relevant problems are, for example:

- authentication or session bypass, privilege escalation (a user reaching admin routes, a company member going beyond the permissions of their role);
- one user reading or changing another user's personal finances or another company's data;
- leaks of the API keys stored encrypted in the settings, or of uploaded documents;
- injection (SQL, command, script) through any input;
- problems in the Proxmox installer or the update script that expose the VM.

Problems that need full access to the VM or the database, and the default `admin` / `admin` login before it is changed on first use, are out of scope.
