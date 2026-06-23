// Ambient frost-mote particle field for the launcher background. Pure canvas,
// no dependencies. Soft ice-blue/gold motes drifting upward with a gentle sway.
(function () {
  const canvas = document.getElementById('fx');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, motes = [];

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    const count = Math.min(90, Math.round((w * h) / 22000));
    motes = [];
    for (let i = 0; i < count; i++) motes.push(spawn(true));
  }

  function spawn(initial) {
    const gold = Math.random() < 0.18;
    return {
      x: Math.random() * w,
      y: initial ? Math.random() * h : h + 10,
      r: 0.6 + Math.random() * 2.1,
      sp: 0.15 + Math.random() * 0.6,          // rise speed
      sway: 0.3 + Math.random() * 0.9,
      phase: Math.random() * Math.PI * 2,
      a: 0.15 + Math.random() * 0.5,            // alpha
      gold
    };
  }

  function tick() {
    ctx.clearRect(0, 0, w, h);
    for (const m of motes) {
      m.y -= m.sp;
      m.phase += 0.01;
      const x = m.x + Math.sin(m.phase) * m.sway;
      if (m.y < -10) Object.assign(m, spawn(false));
      const col = m.gold ? '216,169,63' : '170,210,235';
      const g = ctx.createRadialGradient(x, m.y, 0, x, m.y, m.r * 4);
      g.addColorStop(0, `rgba(${col},${m.a})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, m.y, m.r * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', resize);
  resize();
  tick();
})();
