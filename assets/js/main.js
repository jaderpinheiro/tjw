/* ==========================================================================
   TJW Consultoria — orquestração de interface e movimento
   Lenis -> requestAnimationFrame (gsap.ticker) -> GSAP -> ScrollTrigger
   Todo o conteúdo existe no HTML; este arquivo apenas o aprimora.
   ========================================================================== */
(function () {
  'use strict';

  const doc = document.documentElement;
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.prototype.slice.call((c || document).querySelectorAll(s));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  if (reduced) doc.classList.add('no-motion');
  if (!hasGSAP) doc.classList.add('fallback');
  window.__tjwReady = true;

  // ---------------------------------------------------------------------------
  // Origem dos arquivos. A página pode ser servida pelo WordPress (InlineSyncPlugin,
  // que troca caminhos relativos por base_url + caminho) ou direto dos arquivos
  // estáticos. A base é sempre a pasta de onde este script foi carregado.
  // ---------------------------------------------------------------------------
  const PROD = 'https://www.tjwconsultoria.com.br';
  const script = document.currentScript || $('script[src*="assets/js/main.js"]');
  const BASE = script ? script.src.replace(/assets\/js\/main\.js(\?.*)?$/, '') : '';
  window.TJWAsset = (p) => (!p || /^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(p) || !BASE ? p : new URL(p, BASE).href);

  // Pré-visualização estática (arquivos .html sem WordPress): os links entre páginas
  // apontam para o domínio final; aqui eles voltam para os arquivos locais.
  const estatico = script && !/^([a-z]+:)?\/\//i.test(script.getAttribute('src') || '') && location.origin !== PROD;
  if (estatico) {
    const paginas = { '/': 'index.html', '/portfolio/': 'portfolio.html', '/campo/': 'campo.html' };
    $$('a[href^="' + PROD + '"]').forEach((a) => {
      const u = new URL(a.href);
      const local = paginas[u.pathname];
      if (!local) return;
      const atual = location.pathname.split('/').pop() || 'index.html';
      a.setAttribute('href', (local === atual && u.hash ? '' : BASE + local) + u.hash);
    });
  }

  const fmtBRL = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ---------------------------------------------------------------------------
  // Scroll suave (Lenis) sincronizado com GSAP/ScrollTrigger — instância única
  // ---------------------------------------------------------------------------
  let lenis = null;
  if (hasGSAP) {
    gsap.registerPlugin(ScrollTrigger);
    if (!reduced && typeof window.Lenis === 'function') {
      lenis = new Lenis({ lerp: 0.11, smoothWheel: true, wheelMultiplier: 1, touchMultiplier: 1.2 });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
      window.__tjwLenis = lenis;
    }
  }
  const headerH = () => ($('.site-header') ? $('.site-header').offsetHeight : 0);
  function scrollToEl(el) {
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: -headerH() + 1, duration: 1.3 });
    else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }

  // Âncoras internas
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href*="#"]');
    if (!a) return;
    const url = new URL(a.href, location.href);
    if (url.pathname !== location.pathname || !url.hash || url.hash === '#') return;
    const el = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (!el) return;
    e.preventDefault();
    closeMenu();
    scrollToEl(el);
    history.pushState(null, '', url.hash);
    const focusable = el.matches('h1,h2,h3,section,article') ? el : el.querySelector('h1,h2,h3');
    if (focusable) { focusable.setAttribute('tabindex', '-1'); focusable.focus({ preventScroll: true }); }
  });

  // ---------------------------------------------------------------------------
  // Cabeçalho + menu móvel
  // ---------------------------------------------------------------------------
  const header = $('.site-header');
  const toggle = $('.menu-toggle');
  const mnav = $('#menu-movel');
  let menuOpen = false, lastY = 0;
  function onScrollHeader(y) {
    if (!header) return;
    header.classList.toggle('is-solid', y > 24 || !header.hasAttribute('data-transparente'));
    const down = y > lastY + 4, up = y < lastY - 4;
    if (!menuOpen && y > window.innerHeight * 1.2 && down) header.classList.add('is-hidden');
    if (up || y < 120) header.classList.remove('is-hidden');
    lastY = y;
  }
  if (lenis) lenis.on('scroll', (l) => onScrollHeader(l.scroll));
  else window.addEventListener('scroll', () => onScrollHeader(window.scrollY), { passive: true });
  onScrollHeader(window.scrollY);
  // a barra reaparece quando recebe foco por teclado
  if (header) header.addEventListener('focusin', () => header.classList.remove('is-hidden'));

  function openMenu() {
    if (!mnav) return;
    menuOpen = true; mnav.classList.add('is-open'); mnav.removeAttribute('inert');
    toggle.setAttribute('aria-expanded', 'true'); toggle.querySelector('.lbl').textContent = 'Fechar';
    header.classList.add('is-solid'); header.classList.remove('is-hidden');
    if (lenis) lenis.stop(); else document.body.style.overflow = 'hidden';
    const first = mnav.querySelector('a'); if (first) first.focus();
  }
  function closeMenu() {
    if (!mnav || !menuOpen) return;
    menuOpen = false; mnav.classList.remove('is-open'); mnav.setAttribute('inert', '');
    toggle.setAttribute('aria-expanded', 'false'); toggle.querySelector('.lbl').textContent = 'Menu';
    if (lenis) lenis.start(); else document.body.style.overflow = '';
    onScrollHeader(window.scrollY);
  }
  if (toggle) toggle.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuOpen) { closeMenu(); toggle.focus(); }
    if (e.key === 'Tab' && menuOpen) {
      const f = [toggle].concat($$('a', mnav)); const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });
  window.matchMedia('(min-width: 1100px)').addEventListener('change', (m) => { if (m.matches) closeMenu(); });

  // ---------------------------------------------------------------------------
  // Estacas (navegação lateral por seção) + item ativo do menu
  // ---------------------------------------------------------------------------
  const secs = $$('[data-estaca]');
  if (secs.length && 'IntersectionObserver' in window) {
    const links = $$('.estacas a, .nav-main a[href^="#"]');
    const io = new IntersectionObserver((ents) => {
      ents.forEach((en) => {
        if (!en.isIntersecting) return;
        const id = en.target.id;
        links.forEach((l) => l.classList.toggle('is-active', l.getAttribute('href') === '#' + id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    secs.forEach((s) => io.observe(s));
  }

  // ---------------------------------------------------------------------------
  // Portfólio: ordenar, filtrar, painel de detalhe
  // ---------------------------------------------------------------------------
  const pf = $('[data-pf]');
  if (pf) {
    const list = $('.pf__lista', pf);
    const rows = $$('.pf__row', list);
    const total = $('[data-pf-total]', pf);
    const count = $('[data-pf-count]', pf);
    const det = $('.pf__detalhe', pf);
    let order = 'valor', filter = 'todos';
    function apply() {
      const first = new Map(rows.map((r) => [r, r.getBoundingClientRect().top]));
      const sorted = rows.slice().sort((a, b) => order === 'valor' ? (+b.dataset.valor - +a.dataset.valor) : (+a.dataset.ordem - +b.dataset.ordem));
      sorted.forEach((r) => list.appendChild(r.parentElement));
      let sum = 0, n = 0;
      rows.forEach((r) => { const show = filter === 'todos' || r.dataset.modal === filter; r.parentElement.hidden = !show; if (show) { sum += Math.round(+r.dataset.valor * 100); n++; } });
      if (total) total.textContent = filter === 'todos' ? 'R$ 270,5 milhões' : 'R$ ' + fmtBRL(sum / 100); // total geral conforme relatório
      if (count) count.textContent = n + (n === 1 ? ' contrato' : ' contratos');
      if (!reduced && hasGSAP) rows.forEach((r) => { if (r.parentElement.hidden) return; const d = first.get(r) - r.getBoundingClientRect().top; if (d) gsap.fromTo(r, { y: d }, { y: 0, duration: 0.7, ease: 'expo.out' }); });
      if (hasGSAP) ScrollTrigger.refresh();
    }
    $$('[data-ordem-btn]', pf).forEach((b) => b.addEventListener('click', () => {
      order = b.dataset.ordemBtn; $$('[data-ordem-btn]', pf).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); apply();
    }));
    $$('[data-filtro]', pf).forEach((b) => b.addEventListener('click', () => {
      filter = b.dataset.filtro; $$('[data-filtro]', pf).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); apply();
    }));
    function show(r) {
      if (!det) return;
      rows.forEach((x) => x.classList.toggle('is-hover', x === r));
      $('[data-d="cod"]', det).textContent = r.dataset.cod;
      $('[data-d="titulo"]', det).textContent = r.dataset.titulo;
      $('[data-d="cliente"]', det).textContent = r.dataset.cliente;
      $('[data-d="objeto"]', det).textContent = r.dataset.objeto;
      $('[data-d="valor"]', det).textContent = 'R$ ' + fmtBRL(+r.dataset.valor);
      $('[data-d="prazo"]', det).textContent = r.dataset.prazo + ' · ' + r.dataset.modelo;
      if (hasGSAP && !reduced) gsap.fromTo($$('dd,h3', det), { opacity: 0.35 }, { opacity: 1, duration: 0.35, stagger: 0.03 });
    }
    rows.forEach((r) => { r.addEventListener('mouseenter', () => show(r)); r.addEventListener('focus', () => show(r)); });
  }

  // ---------------------------------------------------------------------------
  // Mapa: ligação entre lista de UFs e estados
  // ---------------------------------------------------------------------------
  const mapa = $('[data-mapa]');
  if (mapa) {
    const items = $$('[data-uf]', $('.ufs'));
    const hl = (uf, on) => {
      $$('.uf[data-uf="' + uf + '"]', mapa).forEach((p) => p.classList.toggle('is-hover', on));
      items.forEach((i) => i.classList.toggle('is-hover', on && i.dataset.uf.split(' ').indexOf(uf) >= 0));
    };
    items.forEach((i) => {
      const ufs = i.dataset.uf.split(' ');
      i.addEventListener('mouseenter', () => ufs.forEach((u) => hl(u, true)));
      i.addEventListener('mouseleave', () => ufs.forEach((u) => hl(u, false)));
    });
    $$('.uf.on', mapa).forEach((p) => {
      p.addEventListener('mouseenter', () => hl(p.dataset.uf, true));
      p.addEventListener('mouseleave', () => hl(p.dataset.uf, false));
    });
  }

  // ---------------------------------------------------------------------------
  // Luz que acompanha o cursor (clientes, liderança, contato) e inclinação
  // ---------------------------------------------------------------------------
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (finePointer) {
    $$('.cliente, .pessoa').forEach((el) => {
      const tilt = !reduced && el.classList.contains('pessoa');
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        el.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
        el.style.setProperty('--my', (y * 100).toFixed(1) + '%');
        if (tilt) el.style.transform = 'rotateX(' + ((0.5 - y) * 5).toFixed(2) + 'deg) rotateY(' + ((x - 0.5) * 7).toFixed(2) + 'deg) translateZ(0)';
      });
      if (tilt) el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });

    const ct = $('.contato');
    if (ct && !reduced) {
      ct.addEventListener('pointermove', (e) => {
        const r = ct.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        ct.style.setProperty('--gx', (x * 100).toFixed(1) + '%');
        ct.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
        ct.style.setProperty('--px', (x - 0.5).toFixed(3));
        ct.style.setProperty('--py', (y - 0.5).toFixed(3));
      });
    }

    // etiquetas de parceiros: leve atração magnética
    if (!reduced) $$('.parceiros li').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * 0.18).toFixed(1) + 'px,' + ((e.clientY - r.top - r.height / 2) * 0.3).toFixed(1) + 'px)';
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  // Faixa de siglas: acelera com o scroll e inverte ao subir
  const faixa = $('.faixa__trilho');
  if (faixa && !reduced && faixa.getAnimations && 'IntersectionObserver' in window) {
    const anim = faixa.getAnimations()[0];
    let rodando = false, taxa = 1, yAnt = window.scrollY;
    const passo = () => {
      if (!rodando) return;
      const y = window.scrollY, v = y - yAnt; yAnt = y;
      const alvo = 1 + Math.max(-5, Math.min(7, v * 0.35));
      taxa += (alvo - taxa) * 0.08;
      anim.playbackRate = Math.abs(taxa) < 0.2 ? (taxa < 0 ? -0.2 : 0.2) : taxa;
      requestAnimationFrame(passo);
    };
    if (anim) new IntersectionObserver((ents) => {
      rodando = ents[0].isIntersecting;
      if (rodando) { yAnt = window.scrollY; requestAnimationFrame(passo); }
    }).observe(faixa);
  }

  // ---------------------------------------------------------------------------
  // Mini-mapa das UFs (reaproveita os contornos do mapa de atuação)
  // ---------------------------------------------------------------------------
  const miniMapa = $('[data-mini-mapa]');
  const mapaSvg = $('.mapa svg');
  if (miniMapa && mapaSvg) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', mapaSvg.getAttribute('viewBox'));
    svg.setAttribute('focusable', 'false');
    $$('.uf', mapaSvg).forEach((p) => {
      const c = document.createElementNS(ns, 'path');
      c.setAttribute('d', p.getAttribute('d'));
      c.setAttribute('class', p.classList.contains('on') ? 'uf on' : 'uf');
      svg.appendChild(c);
    });
    miniMapa.appendChild(svg);
  }

  // ---------------------------------------------------------------------------
  // Capacidades: desenhos animam só quando visíveis; profundidade pelo cursor
  // ---------------------------------------------------------------------------
  const capsEls = $$('.cap');
  if (capsEls.length && 'IntersectionObserver' in window) {
    const ioCap = new IntersectionObserver((ents) => ents.forEach((en) => en.target.classList.toggle('is-vivo', en.isIntersecting)), { rootMargin: '0px 0px -10% 0px' });
    capsEls.forEach((c) => ioCap.observe(c));
  } else capsEls.forEach((c) => c.classList.add('is-vivo'));
  if (finePointer && !reduced) {
    capsEls.forEach((c) => {
      c.addEventListener('pointermove', (e) => {
        const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        c.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
        c.style.setProperty('--my', (y * 100).toFixed(1) + '%');
        c.style.setProperty('--px', (x - 0.5).toFixed(3));
        c.style.setProperty('--py', (y - 0.5).toFixed(3));
      });
      c.addEventListener('pointerleave', () => { c.style.setProperty('--px', 0); c.style.setProperty('--py', 0); });
    });
  }

  // ---------------------------------------------------------------------------
  // Hero (canvas) — funciona mesmo sem GSAP (estático)
  // ---------------------------------------------------------------------------
  const heroEl = $('[data-hero]');
  let hero = null;
  if (heroEl && window.TJWHero && !!document.createElement('canvas').getContext) {
    try { hero = window.TJWHero.init($('.hero__canvas', heroEl), { reduced }); } catch (err) { hero = null; }
    if (hero) { const st = $('.hero__static', heroEl); if (st) st.remove(); }
  }
  // Camada opcional: sequência cinematográfica sob o traçado (data-hero-seq + data-frames)
  const heroBg = heroEl ? $('[data-hero-seq]', heroEl) : null;
  let heroSeq = null;
  if (heroBg && window.TJWSeq && !reduced) heroSeq = window.TJWSeq.init(heroBg, { base: window.TJWAsset(heroBg.dataset.heroSeq), count: +heroBg.dataset.frames, step: window.matchMedia('(max-width: 759px)').matches ? 2 : 1 });

  // Sequência real (campo)
  const seqWrap = $('[data-seq]');
  let seq = null;
  if (seqWrap && window.TJWSeq && !reduced) {
    const mobile = window.matchMedia('(max-width: 759px)').matches;
    seq = window.TJWSeq.init(seqWrap, { base: window.TJWAsset(seqWrap.dataset.seq), count: +seqWrap.dataset.frames, step: mobile ? 2 : 1 });
  }

  if (!hasGSAP) return;

  // ---------------------------------------------------------------------------
  // Animações (GSAP + ScrollTrigger)
  // ---------------------------------------------------------------------------
  const mm = gsap.matchMedia();

  // Entrada do hero
  if (heroEl) {
    const ins = $$('[data-in]', heroEl);
    if (reduced) gsap.set(ins, { opacity: 1 });
    else {
      gsap.fromTo($$('.hero__title .ln > span', heroEl), { y: 0, yPercent: 105 }, { y: 0, yPercent: 0, duration: 1.3, ease: 'expo.out', stagger: 0.09, delay: 0.25 });
      gsap.fromTo(ins, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08, delay: 0.55 });
    }
  }

  mm.add({ desk: '(min-width: 1000px)', mob: '(max-width: 999px)', motion: '(prefers-reduced-motion: no-preference)' }, (c) => {
    const { desk, motion } = c.conditions;

    // HERO: planta -> perspectiva, fixado durante a descida da câmera
    if (heroEl && motion) {
      const content = $('.hero__content', heroEl), stmt = $('.hero__statement', heroEl), nota = $('.hero__nota', heroEl), cue = $('.scroll-cue', heroEl);
      const tl = gsap.timeline({
        scrollTrigger: { trigger: heroEl, start: 'top top', end: desk ? '+=130%' : '+=90%', pin: true, scrub: 0.6, anticipatePin: 1,
          onUpdate: (s) => { if (hero) hero.setProgress(s.progress); if (heroSeq) heroSeq.setProgress(s.progress); } },
      });
      tl.to(content, { opacity: 0, y: -60, ease: 'none', duration: 0.32 }, 0)
        .to([nota, cue], { opacity: 0, duration: 0.1 }, 0)
        .fromTo(stmt, { opacity: 0, y: 30 }, { opacity: 1, y: 0, ease: 'power2.out', duration: 0.2 }, 0.52)
        .to(stmt, { opacity: 0, y: -20, ease: 'power2.in', duration: 0.14 }, 0.86);
    }

    // Revelações genéricas
    if (motion) {
      $$('[data-reveal]').forEach((el) => {
        gsap.from(el, { opacity: 0, y: 40, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
      });
      $$('[data-reveal-stagger]').forEach((g) => {
        gsap.from(g.children, { opacity: 0, y: 32, duration: 1, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: g, start: 'top 85%', once: true } });
      });
    }

    // Manifesto: palavras acendem com o scroll
    const man = $('.manifesto');
    if (man && motion) {
      if (!man.classList.contains('is-split')) {
        const walk = (node) => {
          Array.prototype.slice.call(node.childNodes).forEach((n) => {
            if (n.nodeType === 3) {
              const frag = document.createDocumentFragment();
              n.textContent.split(/(\s+)/).forEach((part) => {
                if (!part) return;
                if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(part));
                else { const s = document.createElement('span'); s.className = 'w'; s.textContent = part; frag.appendChild(s); }
              });
              n.replaceWith(frag);
            } else if (n.nodeType === 1) walk(n);
          });
        };
        walk(man); man.classList.add('is-split');
      }
      const words = $$('.w', man);
      gsap.to(words, { color: (i, el) => (el.closest('em') ? '#8a5708' : '#0b1a36'), stagger: 0.05, ease: 'none',
        scrollTrigger: { trigger: man, start: 'top 80%', end: 'bottom 45%', scrub: 0.4 } });
    }

    // Contadores (apenas números reais do relatório)
    $$('[data-count]').forEach((el) => {
      const end = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0);
      const fmt = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
      if (!motion) { el.textContent = fmt(end); return; }
      const o = { v: 0 };
      gsap.to(o, { v: end, duration: 1.8, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true }, onUpdate: () => { el.textContent = fmt(o.v); } });
    });

    // Desenhos técnicos (SVG) — traço progressivo
    $$('.draw-on').forEach((svg) => {
      const paths = $$('[data-draw]', svg);
      if (!motion) return;
      gsap.fromTo(paths, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut', stagger: 0.06, scrollTrigger: { trigger: svg, start: 'top 85%', once: true } });
      gsap.from($$('text, .gf', svg), { opacity: 0, duration: 0.8, delay: 0.9, stagger: 0.04, scrollTrigger: { trigger: svg, start: 'top 85%', once: true } });
    });

    // Capacidades: trilho horizontal fixado (desktop)
    const caps = $('.caps--h');
    if (caps && desk && motion) {
      const track = $('.caps__track', caps);
      const dist = () => Math.max(0, track.scrollWidth - window.innerWidth + parseFloat(getComputedStyle(caps).paddingLeft || 0) + 40);
      gsap.to(track, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: caps, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.5, invalidateOnRefresh: true, anticipatePin: 1 } });
    }

    // Linha do tempo (SVG): desenha conforme o scroll e um feixe percorre o traçado
    const lt = $('.linha-tempo__svg');
    if (lt && motion) {
      const caixa = lt.closest('.linha-tempo');
      const tl = gsap.timeline({ scrollTrigger: { trigger: lt, start: 'top 80%', end: 'bottom 55%', scrub: 0.5 } });
      tl.fromTo($$('[data-draw]', lt), { strokeDashoffset: 1 }, { strokeDashoffset: 0, ease: 'none', stagger: 0.05 })
        .from($$('.est', lt), { opacity: 0, scale: 0.4, transformOrigin: 'center', stagger: 0.04, ease: 'back.out(2)' }, 0.1);
      const rota = $('.lt-rota', lt), trem = $('.lt-trem', lt);
      if (rota && trem) {
        const L = rota.getTotalLength();
        const marcos = $$('.est', lt).map((e) => { const b = e.getBBox(); return { e, x: b.x + b.width / 2 }; });
        const anos = $$('.ano', lt).map((t) => ({ t, x: +t.getAttribute('x') }));
        const mover = (p) => {
          const pt = rota.getPointAtLength(p * L);
          trem.setAttribute('transform', 'translate(' + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1) + ')');
          marcos.forEach((m) => m.e.classList.toggle('on', pt.x >= m.x - 2));
          anos.forEach((a) => a.t.classList.toggle('on', pt.x >= a.x - 24));
          caixa.classList.toggle('is-viva', p > 0.985);
        };
        caixa.classList.add('is-ativa');
        mover(0);
        ScrollTrigger.create({ trigger: lt, start: 'top 78%', end: 'bottom 45%', scrub: 0.6, onUpdate: (st) => mover(st.progress) });
      }
    }
    // Linha do tempo em lista (telas estreitas)
    const ltl = $('.linha-tempo__lista');
    if (ltl && motion) gsap.from(ltl.children, { opacity: 0, x: 24, duration: 1, ease: 'expo.out', stagger: 0.12, scrollTrigger: { trigger: ltl, start: 'top 85%', once: true } });

    // Empresa: a estrutura ao fundo é desenhada conforme a leitura avança
    const est = $('.empresa__estrutura');
    if (est && motion) {
      const riscos = $$('[data-risco]', est);
      gsap.fromTo(riscos, { strokeDashoffset: 1 }, { strokeDashoffset: 0, ease: 'none', stagger: 0.06, scrollTrigger: { trigger: '#empresa', start: 'top 70%', end: 'bottom 70%', scrub: 0.8 } });
      gsap.fromTo($('.estrutura__txt', est), { opacity: 0 }, { opacity: 1, ease: 'none', scrollTrigger: { trigger: '#empresa', start: 'center 70%', end: 'bottom 70%', scrub: true } });
      gsap.fromTo(est, { yPercent: 10 }, { yPercent: -6, ease: 'none', scrollTrigger: { trigger: '#empresa', start: 'top bottom', end: 'bottom top', scrub: true } });
    }

    // Escala comprovada: visuais de apoio e régua de estaqueamento
    const num = $('.numeros');
    if (num && motion) {
      const st = () => ({ trigger: num, start: 'top 80%', once: true });
      gsap.fromTo($$('.faixa-contratos i', num), { scaleX: 0 }, { scaleX: 1, duration: 1.2, ease: 'expo.out', stagger: 0.05, delay: 0.3, clearProps: 'transform', scrollTrigger: st() });
      gsap.from($$('.anos-mini .losangos i', num), { scale: 0, opacity: 0, duration: 0.6, ease: 'back.out(2.4)', stagger: 0.07, delay: 0.5, scrollTrigger: st() });
      gsap.fromTo($$('.km-mini__luz', num), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 2, ease: 'power2.inOut', delay: 0.5, scrollTrigger: st() });
      gsap.from($$('.num__viz--mapa .uf.on', num), { fill: 'rgba(143,163,207,.08)', duration: 0.8, stagger: 0.18, delay: 0.8, scrollTrigger: st() });
      const reg = $('.regua__trilho');
      if (reg) gsap.fromTo(reg, { x: 0 }, { x: () => -Math.max(0, reg.scrollWidth - reg.parentNode.offsetWidth), ease: 'none', scrollTrigger: { trigger: reg.parentNode, start: 'top bottom', end: 'bottom top', scrub: 0.6, invalidateOnRefresh: true } });
    }

    // Clientes: siglas surgem por máscara; etiquetas de parceiros entram em sequência
    const cl = $('#clientes');
    if (cl && motion) {
      gsap.fromTo($$('.cliente .sigla', cl), { clipPath: 'inset(0 0 100% 0)', yPercent: 45 }, { clipPath: 'inset(0 0 0% 0)', yPercent: 0, duration: 1.3, ease: 'expo.out', stagger: 0.09, delay: 0.15, clearProps: 'transform', scrollTrigger: { trigger: $('.clientes', cl), start: 'top 85%', once: true } });
      gsap.from($$('.parceiros li', cl), { opacity: 0, y: 18, scale: 0.94, duration: 0.9, ease: 'back.out(1.7)', stagger: 0.05, scrollTrigger: { trigger: $('.parceiros', cl), start: 'top 88%', once: true } });
      gsap.fromTo($('.faixa', cl), { opacity: 0 }, { opacity: 1, duration: 1.4, ease: 'power2.out', scrollTrigger: { trigger: $('.faixa', cl), start: 'top 92%', once: true } });
    }

    // Liderança: nomes traçados da esquerda para a direita; barra dourada acompanha o scroll
    const lid = $('#lideranca');
    if (lid && motion) {
      gsap.fromTo($$('.pessoa h3', lid), { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 1.6, ease: 'expo.inOut', stagger: 0.22, clearProps: 'clipPath', scrollTrigger: { trigger: $('.lideranca', lid), start: 'top 80%', once: true } });
      gsap.from($$('.pessoa .papel, .pessoa .nota, .pessoa p', lid), { opacity: 0, y: 14, duration: 1, ease: 'expo.out', stagger: 0.06, delay: 0.5, scrollTrigger: { trigger: $('.lideranca', lid), start: 'top 80%', once: true } });
      const mem = $('.pessoa--memoria', lid);
      if (mem) gsap.fromTo(mem, { '--barra': 0 }, { '--barra': 1, ease: 'none', scrollTrigger: { trigger: mem, start: 'top 85%', end: 'bottom 55%', scrub: 0.6 } });
    }

    // Contato: título por palavras, linhas de relevo com profundidade no scroll
    const ct = $('#contato');
    if (ct && motion) {
      const tt = $('#contato-titulo', ct);
      if (tt && !tt.classList.contains('is-split')) {
        const mascara = (node) => { const m = document.createElement('span'); m.className = 'm'; const i = document.createElement('span'); i.appendChild(node); m.appendChild(i); return m; };
        Array.prototype.slice.call(tt.childNodes).forEach((n) => {
          if (n.nodeType === 3) {
            const frag = document.createDocumentFragment();
            n.textContent.split(/(\s+)/).forEach((part) => {
              if (!part) return;
              frag.appendChild(/^\s+$/.test(part) ? document.createTextNode(part) : mascara(document.createTextNode(part)));
            });
            n.replaceWith(frag);
          } else if (n.nodeType === 1) tt.replaceChild(mascara(n.cloneNode(true)), n);
        });
        tt.classList.add('is-split');
      }
      gsap.from($$('.m > span', tt), { yPercent: 115, duration: 1.4, ease: 'expo.out', stagger: 0.09, scrollTrigger: { trigger: tt, start: 'top 88%', once: true } });
      gsap.from($$('.canais > li', ct), { opacity: 0, x: 36, duration: 1.1, ease: 'expo.out', stagger: 0.12, scrollTrigger: { trigger: $('.canais', ct), start: 'top 88%', once: true } });
      gsap.fromTo($('.contato__bg svg', ct), { yPercent: 7, scale: 1.08 }, { yPercent: -7, scale: 1, ease: 'none', scrollTrigger: { trigger: ct, start: 'top bottom', end: 'bottom top', scrub: true } });
    }

    // Rodapé: a marca se aproxima e ganha foco; o letreiro sobe junto
    const ft = $('.site-footer');
    if (ft && motion) {
      const logo = $('.marca-luz', ft), letreiro = $('.rodape__marca', ft);
      if (logo) gsap.fromTo(logo, { scale: 0.8, opacity: 0, filter: 'blur(10px)' }, { scale: 1, opacity: 1, filter: 'blur(0px)', ease: 'power2.out', scrollTrigger: { trigger: ft, start: 'top 95%', end: 'top 65%', scrub: 0.7 } });
      if (letreiro) gsap.fromTo(letreiro, { yPercent: 40, opacity: 0, scale: 0.94 }, { yPercent: 0, opacity: 1, scale: 1, ease: 'power2.out', scrollTrigger: { trigger: letreiro, start: 'top bottom', end: 'bottom bottom', scrub: 0.7 } });
    }

    // Portfólio: barras crescem a partir da linha de base
    const bars = $$('.pf__bar i');
    if (bars.length && motion) {
      gsap.from(bars, { scaleX: 0, duration: 1.4, ease: 'expo.out', stagger: 0.05, scrollTrigger: { trigger: '.pf__lista', start: 'top 80%', once: true } });
    }

    // Campo: sequência real controlada pelo scroll
    const cs = $('.campo-seq');
    if (cs && seq && motion) {
      if (desk) {
        cs.classList.add('is-pinned');
        const steps = $$('.campo-step', cs);
        const tl = gsap.timeline({ scrollTrigger: { trigger: $('.campo-seq__stage', cs), start: 'top top', end: '+=180%', pin: true, scrub: 0.4, anticipatePin: 1, onUpdate: (s) => seq.setProgress(s.progress) } });
        steps.forEach((s, i) => {
          if (i > 0) tl.fromTo(s, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.4 }, i * 1.2 - 0.25);
          if (i < steps.length - 1) tl.to(s, { opacity: 0, y: -24, duration: 0.3 }, (i + 1) * 1.2 - 0.6);
        });
        tl.to({}, { duration: 0.6 });
        return () => cs.classList.remove('is-pinned');
      }
      ScrollTrigger.create({ trigger: $('.campo-seq__media', cs), start: 'top 85%', end: 'bottom 15%', scrub: true, onUpdate: (s) => seq.setProgress(s.progress) });
    }
  });

  // Galeria horizontal (desktop) — criada depois para ordem correta dos pins
  mm.add('(min-width: 1100px) and (prefers-reduced-motion: no-preference)', () => {
    const g = $('.galeria--h');
    if (!g) return;
    const track = $('.galeria__track', g);
    const dist = () => Math.max(0, track.scrollWidth - window.innerWidth + 40);
    gsap.to(track, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: g, start: 'center center', end: () => '+=' + dist(), pin: true, scrub: 0.5, invalidateOnRefresh: true, anticipatePin: 1 } });
    $$('.foto__img img', g).forEach((img) => gsap.fromTo(img, { scale: 1.15 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: g, start: 'top bottom', end: () => '+=' + (dist() + window.innerHeight), scrub: true } }));
  });

  // Mapa: arcos a partir de Goiânia
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    const arcs = $$('.mapa .arco');
    if (!arcs.length) return;
    arcs.forEach((p) => { const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; });
    gsap.to(arcs, { strokeDashoffset: 0, duration: 1.8, ease: 'power2.inOut', stagger: 0.18, scrollTrigger: { trigger: '.mapa', start: 'top 75%', once: true } });
    gsap.from('.mapa .pt, .mapa .pt-campo', { opacity: 0, duration: 0.6, stagger: 0.05, delay: 0.8, scrollTrigger: { trigger: '.mapa', start: 'top 75%', once: true } });
  });

  // Recalcular após fontes e imagens
  window.addEventListener('load', () => ScrollTrigger.refresh());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
})();
