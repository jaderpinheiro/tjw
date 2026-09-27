/* ==========================================================================
   Hero "Traçado" — visualização conceitual (canvas 2D, sem dependências)
   Relevo procedural com curvas de nível; o corredor da via deforma o terreno
   (corte/aterro). A câmera desce da vista em planta até a perspectiva da via.
   Camadas: curvas de nível em canvas fora da tela (redesenhadas só quando a
   câmera muda) + composição barata da "luz de levantamento" + traçado.
   API: TJWHero.init(el, { reduced }) -> { setProgress(p), destroy() }
   ========================================================================== */
(function () {
  'use strict';

  // ---------- Ruído determinístico ----------
  function hash(x, z) {
    let h = (x * 374761393 + z * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function vnoise(x, z) {
    const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
    const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
    const u = smooth(xf), v = smooth(zf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, z) {
    let s = 0, amp = 0.55, f = 1;
    for (let o = 0; o < 5; o++) { s += amp * vnoise(x * f + o * 17.3, z * f - o * 9.1); f *= 2.02; amp *= 0.5; }
    return s;
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  // ---------- Geometria do traçado (conceitual) ----------
  const Z0 = 0, Z1 = 2600;
  function axisX(z) { return 120 * Math.sin(z / 540) + 52 * Math.sin(z / 236 + 1.3) - 40; }
  function axisDX(z) { return (120 / 540) * Math.cos(z / 540) + (52 / 236) * Math.cos(z / 236 + 1.3); }
  function grade(z) { return 44 + 26 * Math.sin(z / 980 + 0.4); }

  function terrain(x, z) {
    const n = fbm(x * 0.0019 + 3.1, z * 0.0019 - 1.7);
    const h = n * 190 - 30 + 30 * Math.sin((x + z) * 0.0012);
    const w = sstep(110, 30, Math.abs(x - axisX(z))); // plataforma + taludes (corte/aterro)
    return lerp(h, grade(z), w);
  }

  // ---------- Curvas de nível (marching squares) ----------
  function contours(step, levelStep) {
    const X0 = -1300, X1 = 1300, ZA = -700, ZB = 3000;
    const nx = Math.ceil((X1 - X0) / step), nz = Math.ceil((ZB - ZA) / step);
    const H = new Float32Array((nx + 1) * (nz + 1));
    let hmin = Infinity, hmax = -Infinity;
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const h = terrain(X0 + i * step, ZA + j * step); H[j * (nx + 1) + i] = h;
      if (h < hmin) hmin = h; if (h > hmax) hmax = h;
    }
    const TABLE = [null, [2, 3], [1, 2], [1, 3], [0, 1], [0, 3, 1, 2], [0, 2], [0, 3], [0, 3], [0, 2], [0, 1, 2, 3], [0, 1], [1, 3], [1, 2], [2, 3]];
    const segs = [], idx = [], ex = [0, 0, 0, 0], ez = [0, 0, 0, 0];
    for (let L = Math.ceil(hmin / levelStep) * levelStep; L < hmax; L += levelStep) {
      const isIndex = Math.round(L / levelStep) % 5 === 0 ? 1 : 0;
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const p = j * (nx + 1) + i;
        const a = H[p], b = H[p + 1], c = H[p + nx + 2], d = H[p + nx + 1];
        const code = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0);
        if (code === 0 || code === 15) continue;
        const x = X0 + i * step, z = ZA + j * step;
        ex[0] = x + step * (L - a) / (b - a); ez[0] = z;             // topo
        ex[1] = x + step; ez[1] = z + step * (L - b) / (c - b);       // direita
        ex[2] = x + step * (L - d) / (c - d); ez[2] = z + step;       // base
        ex[3] = x; ez[3] = z + step * (L - a) / (d - a);              // esquerda
        const T = TABLE[code];
        for (let s = 0; s < T.length; s += 2) { segs.push(ex[T[s]], L, ez[T[s]], ex[T[s + 1]], L, ez[T[s + 1]]); idx.push(isIndex); }
      }
    }
    return { segs: new Float32Array(segs), idx: new Uint8Array(idx) };
  }

  // Malha do modelo digital de terreno (MDT): linhas que acompanham o relevo
  function terrainMesh(spacing, ds) {
    const lines = [];
    for (let x = -960; x <= 960; x += spacing) {
      const l = []; for (let z = -160; z <= 2500; z += ds) l.push(x, terrain(x, z), z); lines.push(new Float32Array(l));
    }
    for (let z = -160; z <= 2500; z += spacing) {
      const l = []; for (let x = -960; x <= 960; x += ds) l.push(x, terrain(x, z), z); lines.push(new Float32Array(l));
    }
    return lines;
  }

  function sampleAxis(ds) {
    const pts = [];
    for (let z = Z0; z <= Z1; z += ds) {
      const dx = axisDX(z), len = Math.hypot(dx, 1);
      pts.push({ x: axisX(z), y: grade(z) + 0.6, z, nx: 1 / len, nz: -dx / len });
    }
    return pts;
  }

  function init(el, opts) {
    opts = opts || {};
    const reduced = !!opts.reduced;
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    el.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const layer = document.createElement('canvas');
    const lctx = layer.getContext('2d');
    if (!ctx || !lctx) return null;

    const mobile = window.matchMedia('(max-width: 759px)').matches;
    const hover = window.matchMedia('(hover: hover)').matches;
    const lowPower = mobile || (navigator.hardwareConcurrency || 8) <= 4;
    const C = contours(lowPower ? 30 : 22, lowPower ? 16 : 12);
    const mesh = terrainMesh(lowPower ? 80 : 60, lowPower ? 24 : 16);
    const axis = sampleAxis(4);

    let W = 0, H = 0, dpr = 1, raf = 0, visible = true;
    let camDirty = true, frameDirty = true;
    let progress = 0, reveal = reduced ? 1 : 0, fade = reduced ? 1 : 0;
    let mx = 0.66, my = 0.4, tmx = mx, tmy = my, pointerActive = false;
    const t0 = performance.now();
    let cam = null;

    function resize() {
      const r = el.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      dpr = Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 2);
      canvas.width = layer.width = Math.round(W * dpr);
      canvas.height = layer.height = Math.round(H * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      camDirty = frameDirty = true;
    }

    // Câmera: planta (p=0) -> perspectiva baixa sobre a via (p=1)
    function camera(p) {
      const e = ease(clamp(p, 0, 1));
      const port = H > W;
      // vista final: câmera de drone recuada antes do km 0, mirando 600 m à frente no eixo
      const zS = -70, zA = 620, lx = axisX(zS);
      const head = Math.atan2(axisX(zA) - lx, zA - zS);
      const plan = { x: axisX(980), y: 1700, z: 980, yaw: port ? -0.52 : -0.66, pitch: Math.PI / 2 };
      const low = { x: lx, y: grade(0) + (port ? 70 : 52), z: zS, yaw: head, pitch: port ? 0.26 : 0.2 };
      const k = sstep(0, 0.85, e);
      return {
        x: lerp(plan.x, low.x, k), z: lerp(plan.z, low.z, k),
        y: Math.exp(lerp(Math.log(plan.y), Math.log(low.y), sstep(0.05, 1, e))),
        yaw: lerp(plan.yaw, low.yaw, sstep(0.1, 0.9, e)),
        pitch: lerp(plan.pitch, low.pitch, sstep(0.25, 1, e)),
        f: Math.max(W, H) * lerp(port ? 1.05 : 0.82, port ? 0.9 : 0.72, e),
        ox: lerp(port ? 0 : W * 0.2, 0, sstep(0.2, 0.9, e)),
        oy: lerp(port ? -H * 0.2 : -H * 0.02, -H * 0.08, sstep(0.2, 0.9, e)),
        fogFar: lerp(4200, 2600, p), fogNear: lerp(1600, 120, p),
      };
    }
    function projector(c) {
      const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw), cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
      const cxs = W / 2 + c.ox, cys = H / 2 + c.oy, f = c.f;
      const P = function (x, y, z, out) {
        const dx = x - c.x, dy = y - c.y, dz = z - c.z;
        const rx = dx * cy - dz * sy, rz = dx * sy + dz * cy;
        const zc = -dy * sp + rz * cp, yc = dy * cp + rz * sp;
        if (zc < 1.5) return false;
        out[0] = cxs + f * rx / zc; out[1] = cys - f * yc / zc; P.z = zc; return true;
      };
      P.z = 0;
      return P;
    }

    // Camada 1 — curvas de nível
    function drawContours() {
      const proj = projector(cam), a = [0, 0], b = [0, 0];
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lctx.clearRect(0, 0, W, H);
      const B = 6, paths = [], ipaths = [];
      for (let i = 0; i < B; i++) { paths.push(new Path2D()); ipaths.push(new Path2D()); }
      const S = C.segs, I = C.idx, n = I.length, m = 40, span = cam.fogFar - cam.fogNear;
      for (let s = 0, k = 0; k < n; s += 6, k++) {
        if (!proj(S[s], S[s + 1], S[s + 2], a)) continue;
        const z1 = proj.z;
        if (!proj(S[s + 3], S[s + 4], S[s + 5], b)) continue;
        if ((a[0] < -m && b[0] < -m) || (a[0] > W + m && b[0] > W + m) || (a[1] < -m && b[1] < -m) || (a[1] > H + m && b[1] > H + m)) continue;
        const t = clamp(((z1 + proj.z) / 2 - cam.fogNear) / span, 0, 0.999);
        const P = I[k] ? ipaths[(t * B) | 0] : paths[(t * B) | 0];
        P.moveTo(a[0], a[1]); P.lineTo(b[0], b[1]);
      }
      lctx.strokeStyle = '#fff'; lctx.lineCap = 'round';
      for (let i = 0; i < B; i++) {
        const al = 1 - i / B;
        lctx.globalAlpha = al * 0.36; lctx.lineWidth = 0.7; lctx.stroke(paths[i]);
        lctx.globalAlpha = al * 0.66; lctx.lineWidth = 1.05; lctx.stroke(ipaths[i]);
      }
      // malha MDT: surge durante a descida da câmera
      const meshA = sstep(0.3, 0.8, progress);
      if (meshA > 0.01) {
        const mp = []; for (let i = 0; i < B; i++) mp.push(new Path2D());
        for (const L of mesh) {
          let on = false, prev = null;
          for (let s = 0; s < L.length; s += 3) {
            if (!proj(L[s], L[s + 1], L[s + 2], a)) { on = false; continue; }
            const t = clamp((proj.z - cam.fogNear) / span, 0, 0.999), P = mp[(t * B) | 0];
            if (on && prev === P) P.lineTo(a[0], a[1]); else { if (on) prev.lineTo(a[0], a[1]); P.moveTo(a[0], a[1]); }
            on = true; prev = P;
          }
        }
        lctx.lineWidth = 0.6;
        for (let i = 0; i < B; i++) { lctx.globalAlpha = (1 - i / B) * 0.24 * meshA; lctx.stroke(mp[i]); }
      }
      lctx.globalAlpha = 1;
    }

    // Camada 2 — traçado
    function drawAxis() {
      const proj = projector(cam), a = [0, 0], b = [0, 0];
      const nShow = Math.max(2, Math.floor(axis.length * reveal));
      const railA = sstep(0.18, 0.55, progress), axisA = 1 - sstep(0.45, 0.8, progress);
      const line = (off, alpha, width, color, dash) => {
        ctx.beginPath();
        let on = false;
        for (let i = 0; i < nShow; i++) {
          const q = axis[i];
          if (proj(q.x + q.nx * off, q.y, q.z + q.nz * off, a)) { if (!on) { ctx.moveTo(a[0], a[1]); on = true; } else ctx.lineTo(a[0], a[1]); }
          else on = false;
        }
        ctx.setLineDash(dash || []); ctx.globalAlpha = alpha; ctx.lineWidth = width; ctx.strokeStyle = color; ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
      };
      line(-62, 0.34 * fade, 0.9, '#d29b32', [6, 7]); // faixa de domínio (conceitual)
      line(62, 0.34 * fade, 0.9, '#d29b32', [6, 7]);
      if (axisA > 0.01) { line(0, 0.2 * axisA, 7, '#d29b32'); line(0, 0.95 * axisA, 1.8, '#fcd472'); }
      if (railA > 0.01) {
        line(-2.6, 0.95 * railA, 1.5, '#e4ba5b');
        line(2.6, 0.95 * railA, 1.5, '#e4ba5b');
        ctx.beginPath();
        for (let i = 0; i < nShow; i++) {
          const q = axis[i], dxc = q.x - cam.x, dzc = q.z - cam.z;
          if (dxc * dxc + dzc * dzc > 810000) continue;
          if (proj(q.x - q.nx * 4.4, q.y - 0.3, q.z - q.nz * 4.4, a) && proj(q.x + q.nx * 4.4, q.y - 0.3, q.z + q.nz * 4.4, b)) { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
        }
        ctx.strokeStyle = '#a57521'; ctx.lineWidth = 1; ctx.globalAlpha = 0.55 * railA; ctx.stroke(); ctx.globalAlpha = 1;
      }
      // estaqueamento conceitual a cada 200 m
      ctx.font = '500 10px "JetBrains Mono", ui-monospace, monospace';
      ctx.textBaseline = 'middle';
      let lx = -1e9, ly = -1e9;
      for (let i = 0; i < nShow; i += 50) {
        const q = axis[i];
        if (!proj(q.x - q.nx * 16, q.y, q.z - q.nz * 16, a) || !proj(q.x + q.nx * 16, q.y, q.z + q.nz * 16, b)) continue;
        const al = clamp(1 - proj.z / (cam.fogFar * 0.9), 0, 1) * fade;
        if (al < 0.05 || Math.hypot(b[0] - lx, b[1] - ly) < 28) continue; // evita rótulos sobrepostos no horizonte
        lx = b[0]; ly = b[1];
        ctx.globalAlpha = al * 0.9; ctx.strokeStyle = '#fcd472'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        const mtr = Math.round(q.z);
        ctx.fillStyle = '#e4ba5b'; ctx.globalAlpha = al * 0.8;
        ctx.fillText(Math.floor(mtr / 1000) + '+' + String(mtr % 1000).padStart(3, '0'), b[0] + 8, b[1]);
      }
      ctx.globalAlpha = 1;
    }

    function render() {
      if (camDirty) { cam = camera(progress); drawContours(); camDirty = false; }
      frameDirty = false;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = fade; ctx.drawImage(layer, 0, 0); ctx.globalAlpha = 1;
      // "luz de levantamento": tinge as curvas com um gradiente radial que segue o cursor
      ctx.globalCompositeOperation = 'source-atop';
      const R = Math.max(canvas.width, canvas.height) * 0.62;
      const gx = mx * canvas.width, gy = my * canvas.height;
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, R);
      g.addColorStop(0, '#c9d6f5'); g.addColorStop(0.42, '#6f86bf'); g.addColorStop(1, '#2d4580');
      ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawAxis();
    }

    function loop(now) {
      raf = 0;
      if (!visible) return;
      const t = now - t0;
      const nr = ease(clamp((t - 350) / 2600, 0, 1)), nf = clamp(t / 1400, 0, 1);
      if (nr !== reveal || nf !== fade) { reveal = nr; fade = nf; frameDirty = true; }
      if (!pointerActive) { tmx = 0.6 + Math.sin(t * 0.00021) * 0.22; tmy = 0.42 + Math.cos(t * 0.00017) * 0.2; }
      const px = mx, py = my;
      mx += (tmx - mx) * 0.06; my += (tmy - my) * 0.06;
      if (Math.abs(mx - px) > 0.0002 || Math.abs(my - py) > 0.0002) frameDirty = true;
      if (frameDirty || camDirty) render();
      raf = requestAnimationFrame(loop);
    }
    function kick() {
      if (reduced) { render(); return; }
      if (!raf && visible) raf = requestAnimationFrame(loop);
    }

    const onMove = (e) => { pointerActive = true; const r = el.getBoundingClientRect(); tmx = (e.clientX - r.left) / r.width; tmy = (e.clientY - r.top) / r.height; };
    const onResize = () => { resize(); kick(); };
    const io = new IntersectionObserver((ents) => { visible = ents[0].isIntersecting; if (visible) { frameDirty = true; kick(); } }, { threshold: 0 });
    io.observe(el);
    if (!reduced && hover) window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('resize', onResize);
    resize();
    kick();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { frameDirty = true; kick(); });

    return {
      setProgress(p) { p = clamp(p, 0, 1); if (p !== progress) { progress = p; camDirty = true; kick(); } },
      destroy() { cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener('pointermove', onMove); window.removeEventListener('resize', onResize); canvas.remove(); },
    };
  }

  window.TJWHero = { init };
})();
