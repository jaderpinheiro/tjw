/* ==========================================================================
   Sequência de quadros controlada pelo scroll (registro de vídeo real)
   API: TJWSeq.init(wrap, { base, count, ext, step }) -> { setProgress(p) }
   - Carrega quadros só quando a seção se aproxima da viewport.
   - No mobile usa 1 a cada `step` quadros.
   - Mantém a imagem estática (poster) até o primeiro quadro estar pronto.
   ========================================================================== */
(function () {
  'use strict';

  function init(wrap, o) {
    const count = o.count | 0, step = Math.max(1, o.step | 0 || 1);
    const ids = [];
    for (let i = 1; i <= count; i += step) ids.push(i);
    if (ids[ids.length - 1] !== count) ids.push(count);

    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    wrap.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const frames = new Array(ids.length);
    let W = 0, H = 0, dpr = 1, current = -1, target = 0, started = false, raf = 0;

    const src = (n) => o.base + 'f' + String(n).padStart(3, '0') + '.' + (o.ext || 'webp');

    function resize() {
      const r = wrap.getBoundingClientRect();
      W = r.width; H = r.height; dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(W * dpr)); canvas.height = Math.max(1, Math.round(H * dpr));
      current = -1; paint();
    }
    function nearestLoaded(i) {
      for (let d = 0; d < frames.length; d++) {
        if (frames[i - d] && frames[i - d].ok) return i - d;
        if (frames[i + d] && frames[i + d].ok) return i + d;
      }
      return -1;
    }
    function paint() {
      raf = 0;
      const i = nearestLoaded(target);
      if (i < 0 || i === current) return;
      const img = frames[i].img;
      const s = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
      const w = img.naturalWidth * s, h = img.naturalHeight * s;
      ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
      current = i;
      wrap.classList.add('is-live');
    }
    function request() { if (!raf) raf = requestAnimationFrame(paint); }

    function load() {
      if (started) return; started = true;
      // ordem de carga: primeiro, último, meio e depois o restante (preview rápido do movimento)
      const order = [0, ids.length - 1, Math.floor(ids.length / 2)];
      for (let k = 1; k < ids.length - 1; k++) if (order.indexOf(k) < 0) order.push(k);
      let inflight = 0, q = 0;
      const next = () => {
        while (inflight < 6 && q < order.length) {
          const k = order[q++];
          const img = new Image();
          img.decoding = 'async';
          frames[k] = { img, ok: false };
          inflight++;
          img.onload = () => { frames[k].ok = true; inflight--; if (Math.abs(k - target) < 3 || current < 0) { current = -1; request(); } next(); };
          img.onerror = () => { inflight--; next(); };
          img.src = src(ids[k]);
        }
      };
      next();
    }

    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) { load(); io.disconnect(); } }, { rootMargin: '120% 0px' });
    io.observe(wrap);
    window.addEventListener('resize', resize);
    resize();

    return {
      setProgress(p) {
        const t = Math.round(Math.min(1, Math.max(0, p)) * (ids.length - 1));
        if (t !== target) { target = t; request(); }
      },
      load,
    };
  }

  window.TJWSeq = { init };
})();
