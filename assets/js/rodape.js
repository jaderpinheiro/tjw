/* ==========================================================================
   TJW Consultoria — cena do rodapé
   Relevo em curvas de nível, via férrea em curva e um feixe de luz que
   percorre o trilho; o reflexo da marca "TJW CONSULTORIA" acompanha o feixe.
   Canvas 2D. Pausa fora da tela. Com movimento reduzido, desenha um quadro.
   ========================================================================== */
(function () {
  'use strict';

  const footer = document.querySelector('.site-footer');
  const cv = footer && footer.querySelector('.rodape__cena');
  if (!cv || !cv.getContext) return;
  const ctx = cv.getContext('2d');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const marca = footer.querySelector('.rodape__marca svg');
  const brilho = document.getElementById('rodape-brilho');

  const CICLO = 10500;      // ms: uma passagem completa do feixe + intervalo
  const TRAVESSIA = 8600;   // ms: tempo do feixe sobre o trilho
  const BITOLA = 5.5;       // meia distância entre trilhos (px)
  const DORMENTE = 11;      // meio comprimento do dormente (px)

  let w = 0, h = 0, dpr = 1, via = [], comp = 0, rastro = 360;
  let ativo = false, visivel = false, raf = 0, poeira = [];
  const cursor = { x: -9999, y: -9999, a: 0, alvo: 0 };

  function bez(p, t) {
    const u = 1 - t;
    return [
      u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0],
      u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1],
    ];
  }

  function medir() {
    const r = footer.getBoundingClientRect();
    w = r.width; h = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Traçado: entra baixo pela esquerda, contorna o relevo e sai alto à direita
    const P = [[-0.06 * w, 0.94 * h], [0.3 * w, 0.42 * h], [0.6 * w, 1.08 * h], [1.06 * w, 0.26 * h]];
    via = []; comp = 0;
    let ant = null;
    for (let i = 0; i <= 480; i++) {
      const p = bez(P, i / 480);
      if (ant) comp += Math.hypot(p[0] - ant[0], p[1] - ant[1]);
      via.push({ x: p[0], y: p[1], s: comp, nx: 0, ny: 0 });
      ant = p;
    }
    for (let i = 0; i < via.length; i++) {
      const a = via[Math.max(0, i - 1)], b = via[Math.min(via.length - 1, i + 1)];
      const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
      via[i].nx = -dy / L; via[i].ny = dx / L;
    }
    rastro = Math.min(420, w * 0.34);

    const n = Math.round(Math.min(70, w / 22));
    poeira = [];
    for (let i = 0; i < n; i++) poeira.push({ x: Math.random() * w, y: Math.random() * h, r: 0.4 + Math.random() * 1.2, v: 0.05 + Math.random() * 0.18, f: Math.random() * 6.28 });
  }

  // Ponto da via na distância s (busca binária pelo comprimento acumulado)
  function em(s) {
    if (s <= 0) return via[0];
    if (s >= comp) return via[via.length - 1];
    let lo = 0, hi = via.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (via[m].s < s) lo = m; else hi = m; }
    const a = via[lo], b = via[hi], k = (s - a.s) / ((b.s - a.s) || 1);
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, nx: a.nx, ny: a.ny };
  }

  function relevo(t) {
    const n = 15, gap = h / (n - 4);
    ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) {
      const base = (i - 1.5) * gap;
      ctx.beginPath();
      for (let x = -12; x <= w + 12; x += 8) {
        let y = base
          + Math.sin(x * 0.0041 + t * 0.00016 + i * 0.55) * 24
          + Math.sin(x * 0.0107 - t * 0.0001 + i * 1.3) * 8;
        if (cursor.a > 0.01) {
          const dx = x - cursor.x, dy = y - cursor.y;
          y += cursor.a * 34 * Math.exp(-(dx * dx + dy * dy) / 26000) * (dy < 0 ? -1 : 1);
        }
        if (x === -12) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      const ouro = i === 5 || i === 10;
      ctx.strokeStyle = ouro ? 'rgba(210,155,50,.2)' : 'rgba(143,163,207,' + (i % 4 === 0 ? 0.11 : 0.055) + ')';
      ctx.stroke();
    }
  }

  function trilhos() {
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(143,163,207,.1)';
    ctx.beginPath();
    for (let s = 0; s < comp; s += 15) {
      const p = em(s);
      ctx.moveTo(p.x - p.nx * DORMENTE, p.y - p.ny * DORMENTE);
      ctx.lineTo(p.x + p.nx * DORMENTE, p.y + p.ny * DORMENTE);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(174,184,205,.2)';
    [-1, 1].forEach((lado) => {
      ctx.beginPath();
      via.forEach((p, i) => {
        const x = p.x + p.nx * BITOLA * lado, y = p.y + p.ny * BITOLA * lado;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });
  }

  function feixe(cab) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    // dormentes iluminados pela passagem
    ctx.lineWidth = 1.2;
    const ini = Math.max(0, Math.floor((cab - rastro) / 15) * 15);
    for (let s = ini; s <= Math.min(cab + 40, comp); s += 15) {
      const d = cab - s, k = d >= 0 ? 1 - d / rastro : 1 + d / 40;
      if (k <= 0) continue;
      const p = em(s);
      ctx.strokeStyle = 'rgba(252,212,114,' + (k * k * 0.55).toFixed(3) + ')';
      ctx.beginPath();
      ctx.moveTo(p.x - p.nx * DORMENTE, p.y - p.ny * DORMENTE);
      ctx.lineTo(p.x + p.nx * DORMENTE, p.y + p.ny * DORMENTE);
      ctx.stroke();
    }

    // rastro sobre os dois trilhos
    const partes = 30;
    for (let k = 0; k < partes; k++) {
      const s1 = cab - (rastro * k) / partes, s2 = cab - (rastro * (k + 1)) / partes;
      if (s1 < 0 || s2 > comp) continue;
      const a = em(Math.min(s1, comp)), b = em(Math.max(s2, 0)), f = 1 - k / partes;
      ctx.lineWidth = 0.8 + f * 1.6;
      ctx.strokeStyle = 'rgba(252,212,114,' + (f * f * 0.9).toFixed(3) + ')';
      [-1, 1].forEach((lado) => {
        ctx.beginPath();
        ctx.moveTo(a.x + a.nx * BITOLA * lado, a.y + a.ny * BITOLA * lado);
        ctx.lineTo(b.x + b.nx * BITOLA * lado, b.y + b.ny * BITOLA * lado);
        ctx.stroke();
      });
    }

    // cabeça do feixe
    if (cab >= 0 && cab <= comp) {
      const p = em(cab);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 120);
      g.addColorStop(0, 'rgba(252,212,114,.5)');
      g.addColorStop(0.18, 'rgba(210,155,50,.2)');
      g.addColorStop(1, 'rgba(210,155,50,0)');
      ctx.fillStyle = g;
      ctx.fillRect(p.x - 120, p.y - 120, 240, 240);
      ctx.fillStyle = '#fff4d6';
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.6, 0, 6.2832); ctx.fill();
    }
    ctx.restore();
    return cab >= 0 && cab <= comp ? em(cab) : null;
  }

  function particulas(t, cabeca) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    poeira.forEach((p) => {
      p.y -= p.v; p.x += Math.sin(t * 0.0004 + p.f) * 0.12;
      if (p.y < -4) { p.y = h + 4; p.x = Math.random() * w; }
      let a = 0.12 + Math.sin(t * 0.0015 + p.f) * 0.08;
      if (cabeca) { const d = Math.hypot(p.x - cabeca.x, p.y - cabeca.y); if (d < 180) a += (1 - d / 180) * 0.6; }
      ctx.fillStyle = 'rgba(228,186,91,' + Math.max(0, a).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
    });
    ctx.restore();
  }

  function luzCursor() {
    if (cursor.a < 0.01) return;
    const g = ctx.createRadialGradient(cursor.x, cursor.y, 0, cursor.x, cursor.y, 260);
    g.addColorStop(0, 'rgba(143,163,207,' + (0.09 * cursor.a).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(143,163,207,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cursor.x - 260, cursor.y - 260, 520, 520);
  }

  // Reflexo da marca: segue o feixe; com o cursor sobre ela, segue o cursor
  function reflexo(cabeca) {
    if (!marca || !brilho) return;
    const r = marca.getBoundingClientRect(), f = footer.getBoundingClientRect();
    const topo = r.top - f.top, esq = r.left - f.left;
    let x = null;
    if (cursor.a > 0.5 && cursor.y > topo - 40 && cursor.y < topo + r.height + 40) x = cursor.x;
    else if (cabeca) x = cabeca.x;
    const vx = x === null ? -400 : ((x - esq) / r.width) * 1000;
    brilho.setAttribute('gradientTransform', 'translate(' + vx.toFixed(1) + ' 0)');
  }

  function quadro(t) {
    ctx.clearRect(0, 0, w, h);
    cursor.a += (cursor.alvo - cursor.a) * 0.06;
    relevo(t);
    trilhos();
    const fase = t % CICLO;
    const cab = reduced ? comp * 0.62 : (fase / TRAVESSIA) * (comp + rastro);
    const cabeca = feixe(cab);
    if (!reduced) particulas(t, cabeca);
    luzCursor();

    // transição suave com a seção anterior e leitura do texto à esquerda
    const topo = ctx.createLinearGradient(0, 0, 0, Math.min(160, h * 0.25));
    topo.addColorStop(0, 'rgba(1,7,20,1)'); topo.addColorStop(1, 'rgba(1,7,20,0)');
    ctx.fillStyle = topo; ctx.fillRect(0, 0, w, Math.min(160, h * 0.25));

    reflexo(cabeca);
  }

  function laco(t) {
    if (!ativo) return;
    quadro(t);
    raf = requestAnimationFrame(laco);
  }
  function iniciar() {
    if (ativo || reduced) return;
    ativo = true; raf = requestAnimationFrame(laco);
  }
  function parar() { ativo = false; cancelAnimationFrame(raf); }

  medir();
  quadro(performance.now());

  if ('ResizeObserver' in window) {
    new ResizeObserver(() => { medir(); if (!ativo) quadro(performance.now()); }).observe(footer);
  } else {
    window.addEventListener('resize', () => { medir(); quadro(performance.now()); });
  }

  if (reduced) return;

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((ents) => { visivel = ents[0].isIntersecting; visivel ? iniciar() : parar(); }, { rootMargin: '120px 0px' }).observe(footer);
  } else { visivel = true; iniciar(); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) parar(); else if (visivel) iniciar(); });

  footer.addEventListener('pointermove', (e) => {
    const r = footer.getBoundingClientRect();
    cursor.x = e.clientX - r.left; cursor.y = e.clientY - r.top; cursor.alvo = 1;
  });
  footer.addEventListener('pointerleave', () => { cursor.alvo = 0; });
})();
