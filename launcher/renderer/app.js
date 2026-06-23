// Oathbound Realms launcher — renderer logic. Talks to the main process only
// through the safe `window.oath` bridge (see preload.js).
const $ = (id) => document.getElementById(id);
let mode = 'login';
let manifest = null;

function setStatus(msg, kind) {
  const el = $('authStatus');
  el.textContent = msg || '';
  el.className = 'status' + (kind ? ' ' + kind : '');
}

// ---- login / create tabs ----
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
  t.classList.add('active');
  mode = t.dataset.mode;
  $('pass2Field').style.display = mode === 'create' ? 'flex' : 'none';
  $('submitBtn').querySelector('span').textContent = mode === 'create' ? 'Create Account' : 'Log In';
  setStatus('');
}));

$('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = $('f_user').value.trim();
  const pass = $('f_pass').value;
  const pin = $('f_pin').value.trim();
  if (user.length < 3) return setStatus('Account name must be at least 3 characters.', 'err');
  if (pass.length < 6) return setStatus('Password must be at least 6 characters.', 'err');
  if (!/^\d{4,6}$/.test(pin)) return setStatus('PIN must be 4–6 digits.', 'err');

  $('submitBtn').disabled = true;
  try {
    if (mode === 'create') {
      if (pass !== $('f_pass2').value) { setStatus('Passwords do not match.', 'err'); return; }
      setStatus('Creating account…');
      const r = await window.oath.register(user, pass, pin);
      if (!r.ok) return setStatus(friendly(r), 'err');
      setStatus('Account created — logging in…', 'ok');
    }
    const lr = await window.oath.login(user, pass, pin);
    if (!lr.ok) return setStatus(friendly(lr), 'err');
    enterMain(lr.data);
  } finally {
    $('submitBtn').disabled = false;
  }
});

function friendly(r) {
  const code = r?.data?.error;
  if (code === 'account_already_exists') return 'That account name is taken.';
  if (code === 'invalid_username') return 'Invalid account name (3–17 letters/numbers).';
  if (code === 'invalid_password') return 'Password must be 6–16 characters.';
  if (code === 'invalid_pin') return 'PIN must be 4–6 digits.';
  if (code === 'invalid_credentials') return 'Wrong account, password, or PIN.';
  if (code === 'network') return 'Cannot reach the realm service. Is it online?';
  return r?.data?.message || 'Something went wrong. Try again.';
}

// ---- settings ----
$('cfg_realm').addEventListener('change', () => window.oath.setRealm($('cfg_realm').value));
$('browseWow').addEventListener('click', async () => {
  const p = await window.oath.pickWow();
  if (p) $('cfg_wow').value = p;
});

// ---- main view ----
function enterMain(account) {
  $('loginView').style.display = 'none';
  $('mainView').style.display = 'flex';
  $('whoami').textContent = (account?.username || '') + '  ·  Account #' + (account?.accountId || '?');
  renderFeed('news');
  setHero();
  refreshPlayState();
}

function setHero() {
  const n = (manifest && manifest.news && manifest.news[0]) || null;
  const t = document.getElementById('heroTitle');
  const b = document.getElementById('heroBody');
  if (!n || !t) return;
  t.textContent = n.title || 'Oathbound Realms';
  if (b) b.textContent = n.body || '';
}

$('logoutBtn').addEventListener('click', () => {
  $('mainView').style.display = 'none';
  $('loginView').style.display = 'flex';
  $('f_pass').value = ''; $('f_pin').value = '';
  setStatus('');
});

document.querySelectorAll('.ftab').forEach((t) => t.addEventListener('click', () => {
  document.querySelectorAll('.ftab').forEach((x) => x.classList.remove('active'));
  t.classList.add('active');
  renderFeed(t.dataset.feed);
}));

function esc(s) { return String(s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

function renderFeed(which) {
  const feed = $('feed');
  const items = (manifest && manifest[which]) || [];
  if (!items.length) { feed.innerHTML = '<div class="empty">Nothing here yet.</div>'; return; }
  feed.innerHTML = items.map((it) => {
    if (which === 'changelog') {
      const notes = (it.notes || []).map((n) => '<li>' + esc(n) + '</li>').join('');
      return `<div class="entry"><div class="date">v${esc(it.version)}</div><ul>${notes}</ul></div>`;
    }
    return `<div class="entry"><div class="date">${esc(it.date)}</div><h3>${esc(it.title)}</h3><p>${esc(it.body)}</p></div>`;
  }).join('');
}

// ---- install / play (one adaptive button: INSTALL GAME -> PLAY) ----
async function doInstall() {
  const folder = await window.oath.pickFolder();
  if (!folder) return;
  $('playBtn').disabled = true; $('installBtn').disabled = true;
  $('progress').style.display = 'block';
  $('updateLabel').textContent = 'Installing game…';
  const r = await window.oath.installGame(folder);
  $('progress').style.display = 'none';
  $('playBtn').disabled = false; $('installBtn').disabled = false;
  if (r.ok) {
    $('updateLabel').textContent = r.foundExe ? 'Game installed — press Play!' : 'Downloaded, but Wow.exe not found in that folder.';
  } else {
    const m = { no_client_url: 'No game download is configured yet (the realm admin must set it).', no_folder: 'Pick an install folder first.', install_failed: 'Install failed — check your connection.' };
    $('updateLabel').textContent = m[r.error] || 'Install failed.';
  }
  refreshPlayState();
}

async function refreshPlayState() {
  const s = await window.oath.isInstalled();
  const span = $('playBtn').querySelector('span');
  if (s.installed) {
    span.textContent = 'PLAY';
    $('playBtn').dataset.mode = 'play';
    $('installBtn').textContent = 'Repair / Reinstall';
    $('installBtn').style.display = 'inline-block';
  } else {
    span.textContent = 'INSTALL GAME';
    $('playBtn').dataset.mode = 'install';
    $('installBtn').style.display = 'none';
  }
}

$('installBtn').addEventListener('click', doInstall);

$('playBtn').addEventListener('click', async () => {
  if ($('playBtn').dataset.mode === 'install') { doInstall(); return; }
  $('playBtn').disabled = true;
  const r = await window.oath.play();
  $('playBtn').disabled = false;
  if (!r.ok) {
    const m = { no_wow_path: 'Game not installed yet — press Install Game.', wow_exe_missing: 'Wow.exe not found — use Repair / Reinstall.', launch_failed: 'Could not launch the game.' };
    alert(m[r.error] || 'Could not start the game.');
  }
});

window.oath.onInstallProgress((p) => {
  const pct = p.pct || 0;
  $('progressBar').style.width = pct + '%';
  if (p.phase === 'download') {
    const mb = p.total ? ` (${Math.round((p.received||0)/1048576)}/${Math.round(p.total/1048576)} MB)` : '';
    const pt = (p.parts && p.parts > 1) ? ` [part ${p.part}/${p.parts}]` : '';
    $('progressText').textContent = `Downloading ${pct}%${mb}${pt}`;
  } else if (p.phase === 'extract') {
    $('progressText').textContent = 'Extracting game files…';
  } else if (p.phase === 'done') {
    $('progressText').textContent = 'Done';
  }
});

$('updateBtn').addEventListener('click', async () => {
  $('updateLabel').textContent = 'Checking…';
  const r = await window.oath.checkUpdate();
  if (!r.ok) { $('updateLabel').textContent = 'Update check failed.'; return; }
  if (r.updateAvailable) {
    $('updateLabel').textContent = `Update available: v${r.remote}`;
    $('downloadBtn').style.display = 'inline-block';
  } else {
    $('updateLabel').textContent = 'Up to date.';
    $('downloadBtn').style.display = 'none';
  }
});

$('downloadBtn').addEventListener('click', async () => {
  $('progress').style.display = 'block';
  const r = await window.oath.download();
  $('progress').style.display = 'none';
  $('updateLabel').textContent = r.ok ? `Downloaded ${r.downloaded}/${r.total} files.` : 'Download failed.';
  if (r.ok) $('downloadBtn').style.display = 'none';
  loadManifest();
});

window.oath.onDownloadProgress((p) => {
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
  $('progressBar').style.width = pct + '%';
  $('progressText').textContent = `${p.done}/${p.total} — ${p.name}`;
});

// ---- boot ----
async function loadManifest() {
  const r = await window.oath.manifest();
  if (r.ok && r.data) {
    manifest = r.data;
    $('verLabel').textContent = 'v' + (manifest.version || '0.0.0');
    setHero();
    if ($('mainView').style.display !== 'none') {
      const active = document.querySelector('.ftab.active')?.dataset.feed || 'news';
      renderFeed(active);
    }
  }
}

(async function init() {
  if (!window.oath) return;  // running in a plain web preview (no Electron bridge) — visuals only
  const cfg = await window.oath.getConfig();
  $('cfg_realm').value = cfg.realmHost || '';
  $('cfg_wow').value = cfg.wowPath || '';
  await loadManifest();
})();
