# Oathbound Realms — Build the installer & distribute the game

This is the **admin** guide: build the launcher `.exe`, host the game client so the
launcher can install it on players' PCs, and hand players a single installer.

## 1. Build the launcher installer (.exe)

```
cd clean/launcher
npm install
npm run dist
```

Output: `clean/launcher/dist/Oathbound Realms Setup 0.1.0.exe` — an NSIS installer
(lets the user pick an install dir, makes desktop + start-menu shortcuts). The app
icon comes from `build/icon.png` (swap it for your own 512×512 square any time).

> First `npm run dist` downloads Electron + NSIS toolchain (a few hundred MB) — give
> it time. Re-runs are fast. Output is gitignored (`dist/`).

## 2. Bake in your realm address BEFORE building

Players' launchers need to reach **your** server, so set these in `config.json`
(they get bundled into the installer):

```json
{
  "backendUrl": "http://YOUR_PUBLIC_IP:8787",
  "realmHost":  "YOUR_PUBLIC_IP",
  "wowPath": "",
  "version": "0.1.0"
}
```

Use your public IP or a DDNS hostname (see `docs/SERVER_HOSTING.md`). Players can also
change these in the launcher's **Settings**, but baking them in means it just works.

## 3. Host the game client (so "Install Game" works)

The launcher's **Install Game** button downloads a **zip of your 3.3.5a client** (the
folder that contains `Wow.exe`, `Data/`, etc.) and extracts it on the player's PC.

1. Zip your client folder → `oathbound-client.zip` (the zip's contents should include
   `Wow.exe` — at the root or one folder deep; the launcher searches for it).
2. Put it at a **direct download URL**. Options:
   - **Simplest for testing:** drop the zip in `services/solana-wallet-portal/public/`
     → it's served at `http://YOUR_PUBLIC_IP:8787/oathbound-client.zip`.
     (Fine for a handful of testers; it uses your home upload bandwidth.)
   - **For scale:** upload to a cloud bucket / CDN / file host that gives a **direct**
     download link (not a preview page).
3. Set the URL in `services/solana-wallet-portal/data/launcher-manifest.json`:
   ```json
   "client": { "url": "http://YOUR_PUBLIC_IP:8787/oathbound-client.zip", "version": "3.3.5a" }
   ```
   (No launcher rebuild needed — the manifest is fetched live.)

## 4. What players do

1. Run **Oathbound Realms Setup .exe** → installs the launcher.
2. Open it → **Install Game** → pick a folder → it downloads + extracts the client.
3. **Create Account** (name + password + PIN) → **PLAY**.

That's it — one installer, then everything else happens inside the launcher.

## Notes
- The launcher writes `realmlist.wtf` for the player automatically on Play (root +
  every `Data/<locale>/`), pointing at `realmHost`.
- Ship updates by editing the manifest (`version`, `news`, `events`, `changelog`,
  `files[]` for patch files, `client.url` for a new full client). No rebuild needed
  unless you change launcher code.
- The **server** must be reachable from the internet for any of this to work — see
  `docs/SERVER_HOSTING.md`.
