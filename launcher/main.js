// Oathbound Realms launcher — Electron main process.
// Handles: secure IPC to the portal backend (account create/login + manifest),
// realmlist rewrite + launching Wow.exe (Play), update check + file download.
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const { spawn } = require('node:child_process');

const CONFIG_PATH = path.join(__dirname, 'config.json');

function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); }
  catch { return { backendUrl: 'http://127.0.0.1:8787', realmHost: '127.0.0.1', wowPath: '', version: '0.1.0' }; }
}
function writeConfig(cfg) { fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2)); }

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 940,
    minHeight: 620,
    backgroundColor: '#0a0f14',
    title: 'Oathbound Realms',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ---- backend calls --------------------------------------------------------
async function backend(pathname, body) {
  const cfg = readConfig();
  const res = await fetch(cfg.backendUrl.replace(/\/$/, '') + pathname, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-json */ }
  return { ok: res.ok, status: res.status, data };
}

// The update feed (manifest) can be hosted anywhere — set config.manifestUrl to a
// free static host (GitHub raw/Pages, Cloudflare Pages, …) so updates work even when
// the game server is offline. Falls back to the portal's endpoint.
async function getManifest() {
  const cfg = readConfig();
  const url = (cfg.manifestUrl && cfg.manifestUrl.trim())
    ? cfg.manifestUrl.trim()
    : cfg.backendUrl.replace(/\/$/, '') + '/api/launcher/manifest';
  try {
    const res = await fetch(url);
    let data = null;
    try { data = await res.json(); } catch { /* non-json */ }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: { error: 'network', message: String(err.message || err) } };
  }
}

ipcMain.handle('config:get', () => readConfig());

// Is the game already installed? (wowPath set + Wow.exe present)
ipcMain.handle('launcher:isInstalled', () => {
  const cfg = readConfig();
  const installed = !!cfg.wowPath && fs.existsSync(path.join(cfg.wowPath, 'Wow.exe'));
  return { installed, wowPath: cfg.wowPath || '' };
});

ipcMain.handle('account:register', async (_e, { username, password, pin }) => {
  try { return await backend('/api/launcher/register', { username, password, pin }); }
  catch (err) { return { ok: false, status: 0, data: { error: 'network', message: String(err.message || err) } }; }
});

ipcMain.handle('account:login', async (_e, { username, password, pin }) => {
  try { return await backend('/api/launcher/login', { username, password, pin }); }
  catch (err) { return { ok: false, status: 0, data: { error: 'network', message: String(err.message || err) } }; }
});

ipcMain.handle('launcher:manifest', async () => {
  try { return await getManifest(); }
  catch (err) { return { ok: false, status: 0, data: { error: 'network', message: String(err.message || err) } }; }
});

ipcMain.handle('launcher:pickWow', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Select your Wow.exe',
    properties: ['openFile'],
    filters: [{ name: 'WoW client', extensions: ['exe'] }]
  });
  if (r.canceled || !r.filePaths[0]) return null;
  const exe = r.filePaths[0];
  const cfg = readConfig();
  cfg.wowPath = path.dirname(exe);
  writeConfig(cfg);
  return cfg.wowPath;
});

ipcMain.handle('config:setRealm', async (_e, host) => {
  const cfg = readConfig();
  cfg.realmHost = String(host || '').trim() || cfg.realmHost;
  writeConfig(cfg);
  return cfg.realmHost;
});

// Point the client at the realm: write "set realmlist <host>" to the root and
// every Data/<locale>/realmlist.wtf, then launch Wow.exe.
ipcMain.handle('launcher:play', async () => {
  const cfg = readConfig();
  if (!cfg.wowPath) return { ok: false, error: 'no_wow_path' };
  const exe = path.join(cfg.wowPath, 'Wow.exe');
  if (!fs.existsSync(exe)) return { ok: false, error: 'wow_exe_missing' };

  const line = `set realmlist ${cfg.realmHost}\n`;
  const targets = [path.join(cfg.wowPath, 'realmlist.wtf')];
  const dataDir = path.join(cfg.wowPath, 'Data');
  try {
    for (const entry of await fsp.readdir(dataDir, { withFileTypes: true })) {
      if (entry.isDirectory() && /^[a-z]{2}[A-Z]{2}$/.test(entry.name)) {
        targets.push(path.join(dataDir, entry.name, 'realmlist.wtf'));
      }
    }
  } catch { /* no Data dir; root realmlist still written */ }
  for (const t of targets) {
    try { await fsp.writeFile(t, line, 'utf8'); } catch { /* ignore unwritable */ }
  }

  try {
    const child = spawn(exe, [], { cwd: cfg.wowPath, detached: true, stdio: 'ignore' });
    child.unref();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: 'launch_failed', message: String(err.message || err) };
  }
});

// Update check: compare local config.version to the manifest version.
ipcMain.handle('launcher:checkUpdate', async () => {
  const cfg = readConfig();
  const m = await getManifest();
  if (!m.ok || !m.data) return { ok: false };
  const remote = String(m.data.version || '0.0.0');
  return { ok: true, local: cfg.version, remote, updateAvailable: remote !== cfg.version, files: m.data.files || [] };
});

// Download manifest files into the WoW folder (v1: simple sequential download).
ipcMain.handle('launcher:download', async (_e) => {
  const cfg = readConfig();
  if (!cfg.wowPath) return { ok: false, error: 'no_wow_path' };
  const m = await getManifest();
  const files = (m.ok && m.data && m.data.files) || [];
  let done = 0;
  for (const f of files) {
    try {
      const res = await fetch(f.url);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const dest = path.join(cfg.wowPath, f.path);
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      await fsp.writeFile(dest, buf);
      done += 1;
      if (win) win.webContents.send('download:progress', { done, total: files.length, name: f.path });
    } catch { /* skip failed file */ }
  }
  // mark local version current
  if (m.ok && m.data && m.data.version) { cfg.version = m.data.version; writeConfig(cfg); }
  return { ok: true, downloaded: done, total: files.length };
});

ipcMain.handle('open:external', (_e, url) => shell.openExternal(String(url)));

// ---- full game-client install (download + extract onto the player's PC) ----
ipcMain.handle('launcher:pickFolder', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Choose where to install Oathbound Realms',
    properties: ['openDirectory', 'createDirectory']
  });
  if (r.canceled || !r.filePaths[0]) return null;
  return r.filePaths[0];
});

async function downloadFile(url, dest, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const total = Number(res.headers.get('content-length') || 0);
  const out = fs.createWriteStream(dest);
  const reader = res.body.getReader();
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.length;
    out.write(Buffer.from(value));
    if (onProgress) onProgress(received, total);
  }
  await new Promise((resolve, reject) => { out.end(resolve); out.on('error', reject); });
}

// Download one or more part-URLs sequentially into a single dest. Parts are raw
// byte slices of the original zip, so concatenation rebuilds it (lets a >2GB client
// be hosted as <2GB chunks on GitHub Releases). onProgress(received, grandTotal, partIndex, partCount).
async function downloadParts(urls, dest, onProgress) {
  let grandTotal = 0;
  for (const u of urls) {
    try { const h = await fetch(u, { method: 'HEAD' }); grandTotal += Number(h.headers.get('content-length') || 0); } catch { /* size unknown */ }
  }
  const out = fs.createWriteStream(dest);
  try {
    let received = 0;
    for (let i = 0; i < urls.length; i++) {
      const res = await fetch(urls[i]);
      if (!res.ok) throw new Error('HTTP ' + res.status + ' on part ' + (i + 1));
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.length;
        out.write(Buffer.from(value));
        if (onProgress) onProgress(received, grandTotal, i + 1, urls.length);
      }
    }
  } finally {
    await new Promise((resolve, reject) => { out.end(resolve); out.on('error', reject); });
  }
}

function extractZip(zip, dir) {
  return new Promise((resolve, reject) => {
    const cmd = `Expand-Archive -LiteralPath '${zip.replace(/'/g, "''")}' -DestinationPath '${dir.replace(/'/g, "''")}' -Force`;
    const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd], { stdio: 'ignore' });
    ps.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('extract exit ' + code))));
    ps.on('error', reject);
  });
}

// Breadth-first search for the folder containing Wow.exe (the extracted client root).
async function findWowDir(root) {
  const queue = [root];
  let scanned = 0;
  while (queue.length && scanned < 4000) {
    const d = queue.shift();
    scanned += 1;
    let entries;
    try { entries = await fsp.readdir(d, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) if (e.isFile() && e.name.toLowerCase() === 'wow.exe') return d;
    for (const e of entries) if (e.isDirectory()) queue.push(path.join(d, e.name));
  }
  return null;
}

// Download the realm's client archive (from the manifest) and extract it into the
// chosen folder, then point the launcher at the extracted Wow.exe.
ipcMain.handle('launcher:installGame', async (_e, folder) => {
  const cfg = readConfig();
  const m = await getManifest();
  const client = m.ok && m.data && m.data.client;
  const parts = client && Array.isArray(client.parts) && client.parts.length
    ? client.parts
    : (client && client.url ? [client.url] : []);
  if (!parts.length) return { ok: false, error: 'no_client_url' };
  const dir = folder || cfg.wowPath;
  if (!dir) return { ok: false, error: 'no_folder' };

  const zip = path.join(os.tmpdir(), 'oathbound-client-' + Date.now() + '.zip');
  try {
    await fsp.mkdir(dir, { recursive: true });
    if (win) win.webContents.send('install:progress', { phase: 'download', pct: 0 });
    await downloadParts(parts, zip, (r, t, pi, pn) => {
      if (win) win.webContents.send('install:progress', { phase: 'download', pct: t ? Math.round((r / t) * 100) : 0, received: r, total: t, part: pi, parts: pn });
    });
    if (win) win.webContents.send('install:progress', { phase: 'extract', pct: 100 });
    await extractZip(zip, dir);
    const exeDir = await findWowDir(dir);
    if (exeDir) cfg.wowPath = exeDir;
    if (client.version) cfg.version = client.version;
    writeConfig(cfg);
    try { await fsp.unlink(zip); } catch { /* temp cleanup best-effort */ }
    if (win) win.webContents.send('install:progress', { phase: 'done', pct: 100 });
    return { ok: true, wowPath: cfg.wowPath, foundExe: !!exeDir };
  } catch (err) {
    try { await fsp.unlink(zip); } catch { /* ignore */ }
    return { ok: false, error: 'install_failed', message: String(err.message || err) };
  }
});
