# Oathbound Realms — Launcher

A custom dark-fantasy MMO realm (AzerothCore 3.3.5a + NPCBots, original systems, optional
Solana economy). **One installer — it downloads and installs the game for you.**

## Play (players)
1. Download the latest **Oathbound Realms Setup** from the [Releases](../../releases) page.
2. Run it → install the launcher.
3. Open the launcher → click **INSTALL GAME** (pick a folder; it auto-downloads + installs the
   whole client with our settings) → it turns into **PLAY**.
4. **Create Account** (name + password + PIN) → **PLAY**. That's it.

Updates arrive automatically: the launcher's **Check for Updates** pulls new patches from this
repo's release + the manifest below — no reinstall.

## How updates work (admin)
- `launcher-manifest.json` (this repo, raw) is the live feed: `version`, `news`, `events`,
  `changelog`, the `client` download, and `files[]` patch list. The launcher reads it from the
  raw URL set in `launcher/config.json` → `manifestUrl`.
- To ship an update: upload changed files to a Release, bump `version`, add them to `files[]`
  (`{ "url": "...", "path": "Data/patch-X.MPQ" }`), add a `changelog` note, commit. Players click
  **Check for Updates → Download**.
- Full client: put `oathbound-client.zip` on the `v0.1.0` Release (under 2 GB), or split it and
  fill `client.parts[]` (the launcher concatenates + extracts the chunks).

See `launcher/DISTRIBUTION.md` for the build + host details.
