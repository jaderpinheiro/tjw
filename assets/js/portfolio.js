/* ==========================================================================
   TJW Consultoria — página de portfólio
   Filtro e ordenação dos contratos, dicas dos gráficos, vídeo de campo e
   movimento de entrada. Sem JS, todo o conteúdo continua visível e completo.
   ========================================================================== */
(function () {
  'use strict';

  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.prototype.slice.call((c || document).querySelectorAll(s));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const brl = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ---------------------------------------------------------------------------
  // Contratos: filtro por modal e ordenação (cronológica ou por valor)
  // ---------------------------------------------------------------------------
  const lista = $('[data-casos]');
  const ctrl = $('[data-casos-ctrl]');
  if (lista && ctrl) {
    const casos = $$('.caso', lista);
    const nEl = $('[data-casos-n]', ctrl), totEl = $('[data-casos-total]', ctrl);
    let filtro = 'todos', ordem = 'ordem';

    function alternar() {
      casos.filter((c) => !c.hidden).forEach((c, i) => c.classList.toggle('is-inv', i % 2 === 1));
    }
    function aplicar() {
      const antes = new Map(casos.map((c) => [c, c.getBoundingClientRect().top]));
      casos.slice()
        .sort((a, b) => ordem === 'valor' ? (+b.dataset.valor - +a.dataset.valor) : (+a.dataset.ordem - +b.dataset.ordem))
        .forEach((c) => lista.appendChild(c));
      let soma = 0, n = 0;
      casos.forEach((c) => {
        const ok = filtro === 'todos' || c.dataset.modal === filtro;
        c.hidden = !ok;
        if (ok) { soma += Math.round(+c.dataset.valor * 100); n++; }
      });
      alternar();
      nEl.textContent = n + (n === 1 ? ' contrato' : ' contratos');
      totEl.textContent = filtro === 'todos' ? 'R$ 270,5 milhões' : 'R$ ' + brl(soma / 100);
      if (hasGSAP && !reduced) {
        casos.forEach((c) => {
          if (c.hidden) return;
          const d = antes.get(c) - c.getBoundingClientRect().top;
          if (d && Math.abs(d) < window.innerHeight * 3) gsap.fromTo(c, { y: d }, { y: 0, duration: 0.8, ease: 'expo.out', clearProps: 'transform' });
        });
      }
      if (hasGSAP) ScrollTrigger.refresh();
    }
    const grupo = (attr, set) => $$('[' + attr + ']', ctrl).forEach((b) => b.addEventListener('click', () => {
      set(b.getAttribute(attr));
      $$('[' + attr + ']', ctrl).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      aplicar();
    }));
    grupo('data-f', (v) => { filtro = v; });
    grupo('data-o', (v) => { ordem = v; });
    alternar();
  }

  // ---------------------------------------------------------------------------
  // Gráficos: dica ao passar o cursor ou focar pelo teclado
  // ---------------------------------------------------------------------------
  $$('[data-grafico]').forEach((g) => {
    const dica = $('.grafico__dica', g);
    if (!dica) return;
    const mostrar = (el, x, y) => {
      dica.textContent = el.dataset.dica;
      dica.hidden = false;
      const r = g.getBoundingClientRect(), w = dica.offsetWidth, h = dica.offsetHeight;
      const px = Math.min(Math.max(8, x - r.left + 14), r.width - w - 8);
      const py = Math.max(8, y - r.top - h - 14);
      dica.style.transform = 'translate(' + px + 'px,' + py + 'px)';
    };
    $$('[data-dica]', g).forEach((el) => {
      el.addEventListener('pointermove', (e) => mostrar(el, e.clientX, e.clientY));
      el.addEventListener('focus', () => { const r = el.getBoundingClientRect(); mostrar(el, r.left + r.width / 2, r.top); });
      el.addEventListener('pointerleave', () => { dica.hidden = true; });
      el.addEventListener('blur', () => { dica.hidden = true; });
    });
  });

  // ---------------------------------------------------------------------------
  // Vídeo de campo: carrega e toca apenas quando visível
  // ---------------------------------------------------------------------------
  $$('[data-video] video').forEach((v) => {
    if (reduced || !('IntersectionObserver' in window)) return;
    new IntersectionObserver((ents) => {
      if (ents[0].isIntersecting) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
      else v.pause();
    }, { threshold: 0.25 }).observe(v);
  });

  // Camada cinematográfica opcional da abertura: <div class="pf-hero__media" data-cinema="...mp4">
  // Só em telas largas, sem movimento reduzido e sem economia de dados; a foto continua como pôster.
  const cinema = $('.pf-hero__media[data-cinema]');
  const economia = navigator.connection && navigator.connection.saveData;
  if (cinema && !reduced && !economia && window.matchMedia('(min-width: 900px)').matches) {
    const v = document.createElement('video');
    v.className = 'pf-hero__video';
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
    v.setAttribute('aria-hidden', 'true');
    v.src = window.TJWAsset ? window.TJWAsset(cinema.dataset.cinema) : cinema.dataset.cinema;
    v.addEventListener('canplay', () => { v.classList.add('is-on'); const p = v.play(); if (p && p.catch) p.catch(() => {}); }, { once: true });
    cinema.appendChild(v);
  }

  if (!hasGSAP) return;

  // ---------------------------------------------------------------------------
  // Movimento
  // ---------------------------------------------------------------------------
  const hero = $('[data-pf-hero]');
  if (hero) {
    const linhas = $$('.hero__title .ln > span', hero), ins = $$('[data-in]', hero);
    if (reduced) gsap.set(linhas, { yPercent: 0, y: 0 });
    else {
      gsap.fromTo(linhas, { y: 0, yPercent: 105 }, { yPercent: 0, duration: 1.4, ease: 'expo.out', stagger: 0.1, delay: 0.2 });
      gsap.from(ins, { opacity: 0, y: 20, duration: 1.1, ease: 'expo.out', stagger: 0.08, delay: 0.45 });
      gsap.fromTo($('.pf-hero__img', hero), { scale: 1.18 }, { scale: 1.04, duration: 2.6, ease: 'power3.out' });
    }
  }

  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
    if (hero) {
      gsap.to($('.pf-hero__media', hero), { yPercent: 18, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
      gsap.to($('.pf-hero__conteudo', hero), { yPercent: -10, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: hero, start: 'center center', end: 'bottom top', scrub: true } });
    }

    // Contratos: imagem abre por cortina, ficha entra em seguida
    $$('.caso').forEach((c) => {
      const vis = $('.caso__visual', c), img = $('img', vis);
      const tl = gsap.timeline({ scrollTrigger: { trigger: c, start: 'top 80%', once: true } });
      tl.fromTo(vis, { clipPath: 'inset(12% 12% 12% 12%)', opacity: 0.4 }, { clipPath: 'inset(0% 0% 0% 0%)', opacity: 1, duration: 1.3, ease: 'expo.out', clearProps: 'clipPath' })
        .from($$('.caso__cod, h3, .caso__tags, .caso__valor', c), { opacity: 0, y: 24, duration: 1, ease: 'expo.out', stagger: 0.07 }, 0.15)
        .from($('.caso__barra i', c), { scaleX: 0, duration: 1.4, ease: 'expo.out' }, 0.45)
        .from($$('.caso__ficha > div', c), { opacity: 0, x: 18, duration: 0.8, ease: 'expo.out', stagger: 0.05 }, 0.4);
      if (img) gsap.fromTo(img, { yPercent: -6, scale: 1.14 }, { yPercent: 6, scale: 1.04, ease: 'none', scrollTrigger: { trigger: c, start: 'top bottom', end: 'bottom top', scrub: true } });
    });

    // Gráficos crescem a partir da linha de base
    const evo = $('#evolucao');
    if (evo) {
      gsap.from($$('.coluna__barra i', evo), { scaleY: 0, duration: 1.5, ease: 'expo.out', stagger: 0.12, scrollTrigger: { trigger: $('.colunas', evo), start: 'top 80%', once: true } });
      gsap.from($$('.coluna__val, .coluna__info', evo), { opacity: 0, y: 10, duration: 0.8, delay: 0.6, stagger: 0.05, scrollTrigger: { trigger: $('.colunas', evo), start: 'top 80%', once: true } });
      $$('.barras', evo).forEach((b) => gsap.from($$('.barra__trilho i', b), { scaleX: 0, duration: 1.4, ease: 'expo.out', stagger: 0.1, scrollTrigger: { trigger: b, start: 'top 85%', once: true } }));
    }

    // Registros: mosaico revelado em sequência
    const vit = $('.vitrine');
    if (vit) {
      gsap.fromTo(vit.children, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'expo.inOut', stagger: 0.08, clearProps: 'clipPath', scrollTrigger: { trigger: vit, start: 'top 80%', once: true } });
      $$('img', vit).forEach((im) => gsap.fromTo(im, { scale: 1.15 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: im.closest('figure'), start: 'top bottom', end: 'bottom top', scrub: true } }));
    }

    // Tabela
    const tab = $('.tabela tbody');
    if (tab) gsap.from($$('.tab-barra i', tab), { scaleX: 0, transformOrigin: 'left', duration: 1.2, ease: 'expo.out', stagger: 0.04, scrollTrigger: { trigger: tab, start: 'top 85%', once: true } });
  });
})();
