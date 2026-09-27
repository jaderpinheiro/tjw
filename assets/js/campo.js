/* ==========================================================================
   Registros de campo — filtros e visualizador (dialog nativo)
   Sem JS, a grade completa continua visível e cada imagem tem legenda.
   ========================================================================== */
(function () {
  'use strict';
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.prototype.slice.call((c || document).querySelectorAll(s));
  const fotos = $$('.grade .foto');
  if (!fotos.length) return;

  // ---- filtros ----
  let cat = 'todas', rod = 'todas';
  const cont = $('[data-contador]');
  function aplicar() {
    let n = 0;
    fotos.forEach((f) => {
      const ok = (cat === 'todas' || f.dataset.cat === cat) && (rod === 'todas' || f.dataset.rod === rod);
      f.hidden = !ok; if (ok) n++;
    });
    if (cont) cont.textContent = n;
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  }
  $$('[data-f-cat]').forEach((b) => b.addEventListener('click', () => { cat = b.dataset.fCat; $$('[data-f-cat]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); aplicar(); }));
  $$('[data-f-rod]').forEach((b) => b.addEventListener('click', () => { rod = b.dataset.fRod; $$('[data-f-rod]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); aplicar(); }));

  // ---- visualizador ----
  const dlg = $('.lightbox');
  if (!dlg || typeof dlg.showModal !== 'function') return;
  const img = $('[data-lb-img]', dlg), atv = $('[data-lb-atv]', dlg), meta = $('[data-lb-meta]', dlg), pos = $('[data-lb-pos]', dlg), mapa = $('[data-lb-mapa]', dlg);
  let atual = -1, origem = null;
  const visiveis = () => fotos.filter((f) => !f.hidden);
  function mostrar(i) {
    const lista = visiveis(); if (!lista.length) return;
    atual = (i + lista.length) % lista.length;
    const f = lista[atual], th = $('img', f);
    img.src = window.TJWAsset ? window.TJWAsset(f.dataset.full) : f.dataset.full; img.width = +f.dataset.w; img.height = +f.dataset.h; img.alt = th.alt;
    atv.textContent = $('.atv', f).textContent;
    meta.innerHTML = $('.meta', f).innerHTML;
    pos.textContent = (atual + 1) + ' / ' + lista.length;
    if (f.dataset.mapa) { mapa.href = f.dataset.mapa; mapa.hidden = false; } else mapa.hidden = true;
  }
  fotos.forEach((f) => {
    const b = $('button.abrir', f);
    if (b) b.addEventListener('click', () => { origem = b; mostrar(visiveis().indexOf(f)); dlg.showModal(); if (window.__tjwLenis) window.__tjwLenis.stop(); });
  });
  dlg.addEventListener('click', (e) => {
    const a = e.target.closest('[data-lb]');
    if (a) { const k = a.dataset.lb; if (k === 'close') dlg.close(); else mostrar(atual + (k === 'next' ? 1 : -1)); return; }
    if (e.target === dlg) dlg.close();
  });
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); mostrar(atual + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); mostrar(atual - 1); }
  });
  dlg.addEventListener('close', () => { img.removeAttribute('src'); if (window.__tjwLenis) window.__tjwLenis.start(); if (origem) origem.focus(); });
})();
