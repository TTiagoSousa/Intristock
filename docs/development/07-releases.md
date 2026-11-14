# 7. Releases

## Commits

[Conventional Commits](https://www.conventionalcommits.org/) in English, with a scope: `feat(finances): …`, `fix(payments): …`, `docs: …`, `ci: …`, `chore(release): vX.Y.Z`. A `!` or a `BREAKING CHANGE:` line marks a breaking change.

## Branches

`develop` (daily work) → `staging` (next release) → `main` (released, the default). Code moves forward only with `git merge --ff-only`; `staging` and `main` can't be deleted or force-pushed and need the CI to pass.

## Making a release

```bash
git checkout develop
npm run release -- --prepare          # version, package files, CHANGELOG, releases/vX.Y.Z/en.md
# write releases/vX.Y.Z/pt-PT.md
git add -A && git commit -m "chore(release): vX.Y.Z" && git push origin develop
# wait for the CI
git checkout staging && git merge --ff-only develop && git push origin staging
git checkout main && git merge --ff-only staging && git push origin main
# wait for the CI
npm run release -- --push             # annotated tag vX.Y.Z, pushed
```

The tag starts `.github/workflows/release.yml`, which checks that the tag matches the versions in the package files and is on `main`, and creates the GitHub Release with the English notes and the Portuguese ones folded below.

## Release notes

`releases/vX.Y.Z/en.md` and `pt-PT.md`: the first line is the title (`vX.Y.Z — title`), then `### Features`, `### Fixes` and `### Improvements` with one `- ` line each. The app reads the file in the interface language and falls back to the tag message.

## How it reaches the installs

Each install reads the tags of its git origin every few minutes. The admin is told about the next version and updates from Versions → Update, one version at a time. A release that needs something new on the VM adds `deploy/proxmox/upgrades/<version>.sh` or a package in `SYSTEM_PACKAGES`.
