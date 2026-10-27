// =====================================================
//  fx.js — motion & interaction layer (all pages)
//  Smooth scroll, word-mask reveals, scroll-scrubbed
//  mission text, spotlight cards, magnetic buttons,
//  custom cursor, nav behaviour, ambient Cu fields.
//  Everything degrades to a static page under
//  prefers-reduced-motion or without JS.
// =====================================================
(() => {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  root.classList.add('fx');
  if (reduce) { root.classList.add('fx-reduced'); return; }

  const clamp01 = v => Math.max(0, Math.min(1, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  // ---------- Smooth scroll (Lenis, if it loaded) ----------
  // Loaded async from the CDN so it never delays the intro.
  let lenis = null;
  const initLenis = () => {
    if (lenis || !window.Lenis) return;
    lenis = new window.Lenis({ lerp: 0.1, wheelMultiplier: 0.9, smoothWheel: true });
    root.classList.add('lenis');
  };
  initLenis();
  const lenisTag = document.getElementById('lenis-js');
  if (!lenis && lenisTag) lenisTag.addEventListener('load', initLenis);

  // ---------- Split text into masked words ----------
  function splitWords(el, cls = 'w') {
    let i = 0;
    const walk = node => {
      [...node.childNodes].forEach(child => {
        if (child.nodeType === 3) {
          const parts = child.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach(p => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
            const outer = document.createElement('span');
            outer.className = cls;
            const inner = document.createElement('span');
            inner.className = cls + 'i';
            inner.textContent = p;
            inner.style.setProperty('--i', i++);
            outer.appendChild(inner);
            frag.appendChild(outer);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') {
          walk(child);
        }
      });
    };
    walk(el);
    el.style.setProperty('--n', i);
    return i;
  }

  // Headlines: hero, page heroes, section titles, band titles
  const heads = document.querySelectorAll(
    '.hero h1, .page-hero h1, .page-hero h2, .section-title, .recruiting-band h2, .pi-info h2, .pub-year'
  );
  heads.forEach(h => { splitWords(h); h.classList.add('split'); });

  // ---------- Intro sequence (hero / page hero) ----------
  const intro = document.querySelector('.hero-content, .page-hero .container');
  setTimeout(() => {
    root.classList.add('is-loaded');
    if (intro) intro.querySelectorAll('.split').forEach(h => h.classList.add('in'));
  }, 60);

  // ---------- Reveal on scroll ----------
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      io.unobserve(e.target);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.split, .divider, .section-label').forEach(el => {
    if (intro && intro.contains(el)) return;
    io.observe(el);
  });

  // ---------- Mission band: words light up as you scroll ----------
  const mission = document.querySelector('.mission-band p');
  let missionWords = [];
  if (mission) {
    splitWords(mission, 'sw');
    missionWords = [...mission.querySelectorAll('.swi')];
    mission.classList.add('scrub');
  }

  // ---------- Nav: progress line + hide on scroll down ----------
  const nav = document.querySelector('nav');
  const bar = document.createElement('div');
  bar.className = 'nav-progress';
  if (nav) nav.appendChild(bar);

  // ---------- Hero parallax targets ----------
  const hero = document.querySelector('.hero');
  const heroContent = document.querySelector('.hero-content');
  const heroCanvas = document.querySelector('.hero-canvas');
  if (hero) {
    const cue = document.createElement('div');
    cue.className = 'scroll-cue';
    cue.setAttribute('aria-hidden', 'true');
    hero.appendChild(cue);
  }

  let lastY = scrollY, navHidden = false;
  function onScroll(y) {
    const vh = innerHeight;
    const docH = document.documentElement.scrollHeight - vh;
    bar.style.transform = `scaleX(${docH > 0 ? clamp01(y / docH) : 0})`;

    const dy = y - lastY;
    if (nav) {
      const hide = y > vh * 0.6 && dy > 2;
      const show = dy < -2 || y < vh * 0.6;
      if (hide && !navHidden) { nav.classList.add('nav-hidden'); navHidden = true; }
      else if (show && navHidden) { nav.classList.remove('nav-hidden'); navHidden = false; }
      nav.classList.toggle('nav-solid', y > 10);
    }
    lastY = y;

    if (hero && heroContent && y < vh * 1.2) {
      const p = clamp01(y / (hero.offsetHeight * 0.85));
      heroContent.style.transform = `translate3d(0, ${y * 0.28}px, 0)`;
      heroContent.style.opacity = 1 - p * 1.1;
      if (heroCanvas) heroCanvas.style.transform = `translate3d(0, ${y * 0.12}px, 0)`;
    }

    if (missionWords.length) {
      const r = mission.getBoundingClientRect();
      const p = clamp01((vh * 0.82 - r.top) / (r.height + vh * 0.25));
      const lit = Math.round(p * missionWords.length);
      missionWords.forEach((w, i) => w.classList.toggle('lit', i < lit));
    }
  }
  addEventListener('scroll', () => onScroll(scrollY), { passive: true });
  onScroll(scrollY);

  // ---------- Spotlight on cards ----------
  document.querySelectorAll('.highlight-card, .resource-card, .pub-item, .team-card')
    .forEach(card => {
      card.classList.add('spot');
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - r.left}px`);
        card.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    });

  // ---------- Buttons: rolling arrow + magnetic pull ----------
  document.querySelectorAll('.btn').forEach(btn => {
    btn.classList.add('btn-fx');
    const arrow = document.createElement('span');
    arrow.className = 'btn-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.innerHTML = '<span>↗</span><span>↗</span>';
    btn.appendChild(arrow);
    if (!finePointer) return;
    btn.addEventListener('pointermove', e => {
      const r = btn.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.22;
      const y = (e.clientY - r.top - r.height / 2) * 0.35;
      btn.style.transform = `translate(${x}px, ${y}px)`;
    });
    btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
  });

  // ---------- Custom cursor (mouse / trackpad only) ----------
  let cursor = null;
  if (finePointer) {
    root.classList.add('has-cursor');
    cursor = { dot: document.createElement('div'), ring: document.createElement('div'),
               x: -100, y: -100, rx: -100, ry: -100, shown: false };
    cursor.dot.className = 'cursor-dot';
    cursor.ring.className = 'cursor-ring';
    document.body.append(cursor.ring, cursor.dot);
    addEventListener('pointermove', e => {
      cursor.x = e.clientX; cursor.y = e.clientY;
      if (!cursor.shown) { cursor.rx = cursor.x; cursor.ry = cursor.y; root.classList.add('cursor-on'); cursor.shown = true; }
      const hot = e.target.closest && e.target.closest('a, button, .spot');
      root.classList.toggle('cursor-hot', !!(hot && hot.matches('a, button')));
    }, { passive: true });
    document.addEventListener('pointerleave', () => { root.classList.remove('cursor-on'); cursor.shown = false; });
    addEventListener('pointerdown', () => root.classList.add('cursor-press'));
    addEventListener('pointerup', () => root.classList.remove('cursor-press'));
  }

  // ---------- Ambient copper-ion fields (page heroes, bands) ----------
  const COPPER = '232,168,103';
  function glowSprite(r) {
    const c = document.createElement('canvas');
    c.width = c.height = r * 2;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(r, r, 0, r, r, r);
    grd.addColorStop(0, 'rgba(255,240,215,1)');
    grd.addColorStop(0.12, `rgba(${COPPER},0.9)`);
    grd.addColorStop(0.4, `rgba(${COPPER},0.18)`);
    grd.addColorStop(1, `rgba(${COPPER},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, r * 2, r * 2);
    return c;
  }
  const sprite = glowSprite(32);

  function field(host, density) {
    const cv = document.createElement('canvas');
    cv.className = 'cu-field';
    cv.setAttribute('aria-hidden', 'true');
    host.prepend(cv);
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, dpr = 1, ions = [], visible = false, t = 0;
    const ptr = { x: -1e4, y: -1e4 };
    function resize() {
      const r = host.getBoundingClientRect();
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = r.width; H = r.height;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(40, Math.max(12, (W * H) / density)));
      ions = Array.from({ length: n }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: 0, vy: 0, s: 0.5 + Math.random() * 0.9, ph: Math.random() * 6.28
      }));
    }
    host.addEventListener('pointermove', e => {
      const r = host.getBoundingClientRect();
      ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top;
    });
    host.addEventListener('pointerleave', () => { ptr.x = ptr.y = -1e4; });
    new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) loop(); }).observe(host);
    addEventListener('resize', resize);
    resize();

    let raf = 0;
    function loop() {
      cancelAnimationFrame(raf);
      if (!visible) return;
      raf = requestAnimationFrame(loop);
      t += 0.004;
      ctx.clearRect(0, 0, W, H);
      // flow-field drift + gentle pointer attraction
      for (const p of ions) {
        const a = Math.sin(p.x * 0.004 + t * 3) + Math.cos(p.y * 0.005 - t * 2);
        p.vx += Math.cos(a * 1.6) * 0.012 * p.s;
        p.vy += Math.sin(a * 1.6) * 0.012 * p.s;
        const dx = ptr.x - p.x, dy = ptr.y - p.y, d = Math.hypot(dx, dy);
        if (d < 220 && d > 1) { p.vx += dx / d * 0.03; p.vy += dy / d * 0.03; }
        p.vx *= 0.97; p.vy *= 0.97;
        p.x += p.vx; p.y += p.vy;
        if (p.x < -40) p.x = W + 40; if (p.x > W + 40) p.x = -40;
        if (p.y < -40) p.y = H + 40; if (p.y > H + 40) p.y = -40;
      }
      // coordination "bonds" between nearby ions
      ctx.lineWidth = 0.6;
      for (let i = 0; i < ions.length; i++) {
        for (let j = i + 1; j < ions.length; j++) {
          const a = ions[i], b = ions[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 150) {
            ctx.strokeStyle = `rgba(255,250,234,${(1 - d / 150) * 0.16})`;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      ctx.globalCompositeOperation = 'lighter';
      for (const p of ions) {
        const pulse = 0.75 + 0.25 * Math.sin(t * 8 + p.ph);
        const r = (9 + p.s * 9) * pulse;
        ctx.globalAlpha = 0.55 + 0.35 * p.s;
        ctx.drawImage(sprite, p.x - r, p.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  document.querySelectorAll('.page-hero').forEach(h => field(h, 26000));
  document.querySelectorAll('.recruiting-band').forEach(h => field(h, 30000));

  // ---------- Single rAF: smooth scroll, cursor ----------
  function tick(time) {
    if (lenis) lenis.raf(time);
    if (cursor && cursor.shown) {
      cursor.rx = lerp(cursor.rx, cursor.x, 0.18);
      cursor.ry = lerp(cursor.ry, cursor.y, 0.18);
      cursor.dot.style.transform = `translate3d(${cursor.x}px, ${cursor.y}px, 0)`;
      cursor.ring.style.transform = `translate3d(${cursor.rx}px, ${cursor.ry}px, 0)`;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
