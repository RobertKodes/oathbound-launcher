# Oathbound Realms — Launcher

A custom Electron launcher: **create/log in to an account (name + password + PIN)**,
read **News / Events / Update Log**, **check for updates + download**, and **Play**
(it rewrites `realmlist.wtf` and launches `Wow.exe`).

## One-time setup
1. **Logo** — save the Oathbound logo as `renderer/assets/oathbound-logo.png`
   (see `renderer/assets/README.txt`). Without it, a styled text title is shown.
2. **Backend** — the launcher talks to the portal for account creation/login.
   Start it (from `services/solana-wallet-portal`): `npm install` then `npm start`
   (defaults to `http://127.0.0.1:8787`). It needs MySQL up + its `.env` configured.
   The PIN table migration `018_oath_account_pin.sql` must be applied to `acore_auth`.
3. **Launcher** — from this folder:
   ```
   npm install
   npm start
   ```

## Configure (in the launcher → Settings, or edit `config.json`)
- **Realm address** — the realm IP players connect to (written into `realmlist.wtf`).
- **Game folder** — the folder containing `Wow.exe` (3.3.5a client).
- `backendUrl` in `config.json` — where the portal is hosted.

## How accounts work
- **Create Account** sends name + password + PIN to the portal, which creates a
  normal AzerothCore account (SRP6 — the realm authenticates with name + password)
  and stores the **PIN** (scrypt-hashed) as an extra launcher-login factor.
- **Log In** re-checks name + password + PIN before enabling Play. Reuse the same
  account every time. The server never stores the raw password or PIN.

## Content (News / Events / Update Log)
Edited server-side in `services/solana-wallet-portal/data/launcher-manifest.json`
and served at `/api/launcher/manifest` — no launcher rebuild needed.

## Packaging (later)
`npm run dist` (electron-builder) — add an `electron-builder` config + an icon when
you're ready to ship a signed installer.
