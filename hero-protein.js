// =====================================================
//  hero-protein.js — "Cu brings life"
//  Copper ions drift through the hero. Chapter by chapter, a
//  Renaissance-era drawing blooms in at the centre as copper
//  arrives: first the copper core of cytochrome c oxidase,
//  then animals from invertebrates to vertebrates to mammals,
//  ending with Leonardo's Vitruvian Man. Each comes with a
//  copper protein characteristic of it, then crossfades into
//  the next, passing its copper on. Plain Canvas 2D.
//
//  Drawings (public domain, via Wikimedia Commons), converted
//  to cream line art in assets/sketches/:
//  - jellyfish, octopus, fish: C. Gessner, Historiae animalium IV (1604 ed.)
//  - frog: A. J. Rösel von Rosenhof, Historia naturalis ranarum, 1758
//  - bear: Leonardo da Vinci, A Bear Walking, c. 1490
//  - human: Leonardo da Vinci, Vitruvian Man, c. 1490
//
//  Science notes (labels say "characteristic of", not "first appeared in"):
//  - Cytochrome c oxidase (CuA/CuB) powers aerobic respiration in all animals.
//  - Type-3 Cu proteins (tyrosinases) are ancient in animals; arthropod and
//    mollusc hemocyanins evolved independently from different tyrosinase
//    subclasses (Aguilera et al., BMC Evol Biol 2013) — convergent Cu O2 carriers.
//  - Ceruloplasmin is the multicopper ferroxidase of vertebrate plasma.
//  - Lysyl oxidase (Cu) crosslinks collagen/elastin in connective tissue.
//  - Dopamine β-hydroxylase (Cu) makes noradrenaline in mammalian nervous systems.
//  - ATP7A/ATP7B pump Cu in human cells; their loss causes Menkes/Wilson disease.
// =====================================================

(function () {
  const canvas = document.getElementById('hero-protein');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const CREAM = '255,250,234';
  const COPPER = '232,168,103';
  const N_IONS = 10, IONS_PER_CHAPTER = 2;
  // timing (seconds)
  const REVEAL_START = 0.2, REVEAL_TIME = 1.2, LABEL_START = 0.55, LABEL_TIME = 0.6;
  const HOLD = 3.2, HOLD_LAST = 5, CROSSFADE = 0.85;

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp01 = x => Math.max(0, Math.min(1, x));
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  // ---------- Chapters ----------
  const CHAPTERS = [
    { img: null,        group: 'All animals',  cu: 'Cytochrome c oxidase',   note: 'CuA · CuB — aerobic respiration',             credit: '' },
    { img: 'jellyfish', group: 'Cnidaria',     cu: 'Tyrosinase',             note: 'Ancient type-3 copper enzyme',                credit: 'After C. Gessner, Historiae animalium' },
    { img: 'octopus',   group: 'Mollusca',     cu: 'Hemocyanin',             note: 'Copper O₂ carrier · blue blood',              credit: 'After C. Gessner, Historiae animalium' },
    { img: 'fish',      group: 'Vertebrates',  cu: 'Ceruloplasmin',          note: 'Multicopper ferroxidase of the blood',        credit: 'After C. Gessner, Historiae animalium' },
    { img: 'frog',      group: 'Amphibia',     cu: 'Lysyl oxidase',          note: 'Crosslinks collagen & elastin',               credit: 'A. J. Rösel von Rosenhof, 1758' },
    { img: 'bear',      group: 'Mammalia',     cu: 'Dopamine β-hydroxylase', note: 'Noradrenaline synthesis',                     credit: 'Leonardo da Vinci, A Bear Walking, c. 1490' },
    { img: 'human',     group: 'Homo sapiens', cu: 'ATP7A · ATP7B',          note: 'Copper transport · Menkes & Wilson disease',  credit: 'Leonardo da Vinci, Vitruvian Man, c. 1490' },
  ];
  CHAPTERS.forEach(ch => {
    if (!ch.img) return;
    ch.image = new Image();
    ch.image.decoding = 'async';
    ch.image.src = `assets/sketches/${ch.img}.webp`;
  });
  const ready = ch => !ch.image || (ch.image.complete && ch.image.naturalWidth > 0);

  let W = 0, H = 0, S = 1, dpr = 1, G = 1, cx = 0, cy = 0, wide = true;
  let ions, bursts, stages, current = 0, nextVisit = 1;
  const pointer = { x: -1e4, y: -1e4 };

  // ---------- Stages: one per visible chapter (two overlap during a crossfade) ----------
  function layoutBox(ch) {
    if (!ch.image || !ch.image.naturalWidth) return { x: cx - G * 0.45, y: cy - G * 0.45, w: G * 0.9, h: G * 0.9 };
    const iw = ch.image.naturalWidth, ih = ch.image.naturalHeight;
    const k = Math.min((G * 1.25) / iw, G / ih);
    const w = iw * k, h = ih * k;
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }

  function startStage(i) {
    current = i % CHAPTERS.length;
    const ch = CHAPTERS[current];
    const st = { ci: current, ch, t: 0, out: -1, box: layoutBox(ch), held: [], waiting: !ready(ch) };
    stages.push(st);
    if (!st.waiting) for (let k = 0; k < IONS_PER_CHAPTER; k++) sendIon(st, k * 0.25, true);
    return st;
  }

  // ---------- Ions ----------
  function spawnIon(ion, fromEdge) {
    ion.x = fromEdge ? (Math.random() < 0.5 ? rand(-0.05, 0.05) : rand(0.95, 1.05)) * W : rand(0, W);
    ion.y = rand(0.08, 0.95) * H;
    ion.vx = rand(-1, 1) * 0.15; ion.vy = rand(-1, 1) * 0.15;
    ion.state = 'free'; ion.alpha = fromEdge ? 0 : 1; ion.trail = [];
    ion.phase = rand(0, 6.28); ion.r = rand(0.8, 1.15);
    return ion;
  }
  function sendIon(st, delay, stay) {
    const free = ions.filter(i => i.state === 'free' && i.alpha > 0.6);
    if (!free.length) return;
    const b = st.box;
    const ion = free.reduce((p, i) => (Math.hypot(i.x - cx, i.y - cy) < Math.hypot(p.x - cx, p.y - cy) ? i : p));
    const to = { x: b.x + rand(0.3, 0.7) * b.w, y: b.y + rand(0.3, 0.7) * b.h };
    Object.assign(ion, {
      state: 'seek', t: -delay, to, stay, stage: st, from: { x: ion.x, y: ion.y },
      ctrl: { x: (ion.x + to.x) / 2 + rand(-1, 1) * S * 0.12, y: Math.min(ion.y, to.y) - rand(0.04, 0.12) * S },
      dur: rand(1, 1.3),
    });
  }
  // a fading chapter passes its copper on: its ions scatter outward
  function release(st) {
    st.held.forEach(ion => {
      const a = rand(0, 6.283);
      ion.state = 'free'; ion.alpha = 1; ion.stage = null;
      ion.vx = Math.cos(a) * rand(0.5, 0.9); ion.vy = Math.sin(a) * rand(0.5, 0.9);
    });
    st.held = [];
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    wide = !window.matchMedia('(max-width: 900px)').matches;
    const stageW = wide ? W * 0.58 : W; // on desktop the stage is the right 58% of the hero
    S = Math.max(1, Math.min(stageW, H * 1.1));
    if (!W || !H) return;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    G = Math.min(S * 0.54, H * 0.48);
    cx = wide ? W - stageW * 0.45 : W * 0.5; cy = H * 0.4;
    bursts = [];
    ions = Array.from({ length: N_IONS }, () => spawnIon({}, false));
    stages = [];
    startStage(current);
  }
  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 150); });
  window.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top;
  });
  resize();

  // ---------- Simulation ----------
  function step(dt, time) {
    stages.forEach(st => {
      if (st.waiting) {
        st.t += dt;
        if (ready(st.ch)) { st.waiting = false; st.t = 0; st.box = layoutBox(st.ch); for (let k = 0; k < IONS_PER_CHAPTER; k++) sendIon(st, k * 0.25, true); }
        else if (st.t > 4) { st.out = 1; startStage(st.ci + 1); } // image failed: skip it
        return;
      }
      st.t += dt;
      const hold = st.ci === CHAPTERS.length - 1 ? HOLD_LAST : HOLD;
      if (st.out < 0 && st.t > hold) { st.out = 0; release(st); startStage(st.ci + 1); }
      if (st.out >= 0) st.out = Math.min(1, st.out + dt / CROSSFADE);
    });
    stages = stages.filter(st => st.out < 1);

    // occasional extra visits keep the current drawing alive
    const live = stages.find(st => st.out < 0 && !st.waiting && st.t > REVEAL_START + REVEAL_TIME);
    nextVisit -= dt;
    if (live && nextVisit <= 0) { sendIon(live, 0, false); nextVisit = rand(1.4, 2.2); }

    bursts = bursts.filter(b => (b.t += dt) < 1.2);

    ions.forEach(ion => {
      if (ion.state === 'free') {
        ion.alpha = Math.min(1, ion.alpha + dt * 0.6);
        const fx = Math.sin(ion.y / (S * 0.18) + time * 0.4 + ion.phase) * 0.012;
        const fy = Math.cos(ion.x / (S * 0.2) + time * 0.3 + ion.phase) * 0.012 - 0.002;
        const dx = pointer.x - ion.x, dy = pointer.y - ion.y, d = Math.hypot(dx, dy);
        const pull = d < S * 0.3 ? 0.02 * (1 - d / (S * 0.3)) : 0;
        ion.vx = (ion.vx + fx + (pull * dx) / (d || 1)) * 0.985;
        ion.vy = (ion.vy + fy + (pull * dy) / (d || 1)) * 0.985;
        ion.x += ion.vx * dt * 60; ion.y += ion.vy * dt * 60;
        if (ion.x < -0.1 * W || ion.x > 1.1 * W || ion.y < -0.1 * H || ion.y > 1.05 * H) spawnIon(ion, true);
      } else if (ion.state === 'seek') {
        ion.t += dt / ion.dur;
        if (ion.t < 0) return;
        if (ion.stage.out >= 0) { ion.state = 'free'; ion.stage = null; return; } // its chapter moved on
        const t = easeInOut(Math.min(1, ion.t)), u = 1 - t;
        ion.x = u * u * ion.from.x + 2 * u * t * ion.ctrl.x + t * t * ion.to.x;
        ion.y = u * u * ion.from.y + 2 * u * t * ion.ctrl.y + t * t * ion.to.y;
        if (ion.t >= 1) {
          bursts.push({ x: ion.to.x, y: ion.to.y, t: 0, big: ion.stay });
          if (ion.stay) { ion.state = 'held'; ion.trail = []; ion.stage.held.push(ion); }
          else spawnIon(ion, true);
        }
      }
      if (!Number.isFinite(ion.x) || !Number.isFinite(ion.y)) spawnIon(ion, true); // never draw a lost ion
      if (ion.state !== 'held') {
        ion.trail.push({ x: ion.x, y: ion.y });
        if (ion.trail.length > (ion.state === 'seek' ? 18 : 10)) ion.trail.shift();
      }
    });
  }

  // ---------- Render ----------
  // text sizes match the site's type scale in styles.css (--fs-label, --fs-small, --fs-body)
  const TYPE = { label: 14, credit: 15, note: 17, title: 28, ion: 12 };
  // vertical positions of the caption lines under the plate, shared by labels and progress ticks
  const labelLayout = () => {
    const group = cy + G / 2 + 18 + 34;
    const title = group + 40, note = title + 30, credit = note + 25;
    return { group, title, note, credit, ticks: credit + 30 };
  };
  // same faces as the site: serif for the protein name, sans for everything else
  const SANS = '"DM Sans", "Helvetica Neue", Arial, sans-serif';
  const labelFont = px => `500 ${px}px ${SANS}`;
  const sansFont = px => `400 ${px}px ${SANS}`;
  const serifFont = px => `400 ${px}px "Source Serif 4", Georgia, serif`;
  const comp = document.createElement('canvas'), cctx = comp.getContext('2d');

  // Cytochrome c oxidase: an engraved armillary of orbits around its two copper centres
  function drawOxidase(time, k, a) {
    const R = G * 0.36;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = `rgba(${CREAM},${0.3 * a * k})`;
    for (let i = 1; i < 12; i++) {
      ctx.beginPath();
      ctx.ellipse(0, 0, R * 1.2 * Math.abs(Math.cos((i / 12) * Math.PI)), R * 1.2, 0, 0, 6.283);
      ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0, 0, R * 1.2, 0, 6.283); ctx.stroke();
    ctx.strokeStyle = `rgba(${CREAM},${0.8 * a})`;
    const rings = 9;
    for (let i = 0; i < rings; i++) {
      const p = clamp01(k * (rings * 0.5 + 1) - i * 0.5);
      if (!p) continue;
      ctx.save();
      ctx.rotate((i / rings) * Math.PI + time * 0.05 * (i % 2 ? 1 : -1));
      ctx.beginPath();
      ctx.ellipse(0, 0, R, R * (0.18 + 0.08 * (i % 3)), 0, 0, 6.283 * easeOut(p));
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    if (k > 0.6) {
      const kk = (k - 0.6) / 0.4;
      [[-0.32, -0.22, 'CuA'], [0.3, 0.2, 'CuB']].forEach(([x, y, label], i) => {
        const p = { x: cx + x * R, y: cy + y * R }, pulse = 1 + Math.sin(time * 3 + i) * 0.15;
        const hg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 22 * pulse);
        hg.addColorStop(0, `rgba(${COPPER},${0.65 * kk * a})`);
        hg.addColorStop(1, `rgba(${COPPER},0)`);
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.arc(p.x, p.y, 22 * pulse, 0, 6.283); ctx.fill();
        ctx.fillStyle = `rgba(${COPPER},${kk * a})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 6.283); ctx.fill();
        ctx.fillStyle = `rgba(${CREAM},${0.85 * kk * a})`;
        ctx.font = labelFont(TYPE.label);
        ctx.fillText(label, p.x + 10, p.y - 8);
      });
    }
  }

  // drawing blooms out from its centre through a soft radial mask
  function drawSketch(st, r, a) {
    const { box: b, ch } = st;
    if (r >= 1) {
      ctx.globalAlpha = a;
      ctx.drawImage(ch.image, b.x, b.y, b.w, b.h);
      ctx.globalAlpha = 1;
      return;
    }
    const pw = Math.ceil(b.w * dpr), ph = Math.ceil(b.h * dpr);
    if (comp.width !== pw || comp.height !== ph) { comp.width = pw; comp.height = ph; }
    cctx.setTransform(1, 0, 0, 1, 0, 0);
    cctx.globalCompositeOperation = 'copy';
    cctx.drawImage(ch.image, 0, 0, pw, ph);
    cctx.globalCompositeOperation = 'destination-in';
    const R = Math.hypot(pw, ph) / 2, edge = R * 0.35, reach = Math.max(1, r * (R + edge));
    const g = cctx.createRadialGradient(pw / 2, ph / 2, 0, pw / 2, ph / 2, reach);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(Math.max(0, 1 - edge / reach), 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    cctx.fillStyle = g;
    cctx.fillRect(0, 0, pw, ph);
    ctx.globalAlpha = a * Math.min(1, r * 1.6);
    ctx.drawImage(comp, b.x, b.y, b.w, b.h);
    ctx.globalAlpha = 1;
  }

  function drawStage(st, time) {
    if (st.waiting) return;
    const out = st.out < 0 ? 0 : easeInOut(st.out);
    const a = 1 - out;
    const r = easeOut(clamp01((st.t - REVEAL_START) / REVEAL_TIME));

    // gentle drift: the outgoing drawing breathes out, the incoming one settles in
    const s = 1 + 0.03 * out - 0.03 * (1 - r);
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy);
    if (!st.ch.image) drawOxidase(time, r, a);
    else if (r > 0) drawSketch(st, r, a);
    st.held.forEach(ion => drawIon(ion, time, a));
    ctx.restore();

    // labels: incoming fade in late, outgoing fade out early, so they never overlap
    const k = easeOut(clamp01((st.t - LABEL_START) / LABEL_TIME)) * (1 - clamp01(st.out / 0.4));
    if (k <= 0) return;
    const ch = st.ch, L = labelLayout();
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(${CREAM},${0.7 * k})`;
    ctx.font = labelFont(TYPE.label);
    ctx.letterSpacing = '0.01em';
    ctx.fillText(`${String(st.ci + 1).padStart(2, '0')} / ${String(CHAPTERS.length).padStart(2, '0')}  ·  ${ch.group}`, cx, L.group);
    ctx.letterSpacing = '0px';
    ctx.fillStyle = `rgba(${COPPER},${k})`;
    ctx.font = serifFont(TYPE.title);
    ctx.fillText(ch.cu, cx, L.title);
    ctx.fillStyle = `rgba(${CREAM},${0.85 * k})`;
    ctx.font = sansFont(TYPE.note);
    ctx.fillText(ch.note, cx, L.note);
    if (ch.credit) {
      ctx.fillStyle = `rgba(${CREAM},${0.6 * k})`;
      ctx.font = sansFont(TYPE.credit);
      ctx.fillText(ch.credit, cx, L.credit);
    }
    ctx.textAlign = 'start';
  }

  function drawFrame() {
    // fixed specimen-plate corner marks and progress ticks, shared by all chapters
    const half = G * 0.66, top = cy - G / 2 - 18, bottom = cy + G / 2 + 18, m = 14;
    ctx.strokeStyle = `rgba(${CREAM},0.35)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    [[cx - half, top, 1, 1], [cx + half, top, -1, 1], [cx - half, bottom, 1, -1], [cx + half, bottom, -1, -1]].forEach(([x, y, sx, sy]) => {
      ctx.moveTo(x, y + sy * m); ctx.lineTo(x, y); ctx.lineTo(x + sx * m, y);
    });
    ctx.stroke();

    const n = CHAPTERS.length, gap = 16, y0 = labelLayout().ticks;
    for (let i = 0; i < n; i++) {
      const x = cx + (i - (n - 1) / 2) * gap, on = i === current;
      ctx.fillStyle = on ? `rgba(${COPPER},0.95)` : `rgba(${CREAM},${i < current ? 0.55 : 0.2})`;
      ctx.beginPath(); ctx.arc(x, y0, on ? 3 : 2, 0, 6.283); ctx.fill();
    }
  }

  function drawIon(ion, time, extraAlpha = 1) {
    const textFade = wide ? 0.25 + 0.75 * clamp01((ion.x - W * 0.3) / (W * 0.18)) : 1;
    const ia = ion.alpha * extraAlpha * textFade, seek = ion.state === 'seek';
    const r = S * 0.0062 * ion.r * (seek ? 1.15 : 1) * (1 + Math.sin(time * 2.4 + ion.phase) * 0.1);
    for (let i = 1; i < ion.trail.length; i++) {
      const k = i / ion.trail.length;
      ctx.strokeStyle = `rgba(${COPPER},${k * ia * (seek ? 0.55 : 0.25)})`;
      ctx.lineWidth = r * k * 1.1;
      ctx.beginPath();
      ctx.moveTo(ion.trail[i - 1].x, ion.trail[i - 1].y);
      ctx.lineTo(ion.trail[i].x, ion.trail[i].y);
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(ion.x, ion.y, 0, ion.x, ion.y, r * 7);
    g.addColorStop(0, `rgba(${COPPER},${0.5 * ia})`);
    g.addColorStop(1, `rgba(${COPPER},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(ion.x, ion.y, r * 7, 0, 6.283); ctx.fill();
    ctx.fillStyle = `rgba(255,236,206,${ia})`;
    ctx.beginPath(); ctx.arc(ion.x, ion.y, r, 0, 6.283); ctx.fill();
    if (seek && ion.t > 0) {
      ctx.fillStyle = `rgba(${CREAM},${0.7 * Math.sin(Math.min(1, ion.t) * Math.PI)})`;
      ctx.font = labelFont(TYPE.ion);
      ctx.fillText('Cu', ion.x + r * 2.4, ion.y - r * 1.8);
    }
  }

  function draw(time) {
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round';
    drawFrame();
    stages.forEach(st => drawStage(st, time));

    bursts.forEach(b => {
      const k = b.t / 1.2, R = b.big ? S * 0.06 : S * 0.035;
      ctx.strokeStyle = `rgba(${COPPER},${(1 - k) * 0.8})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(b.x, b.y, 4 + easeOut(k) * R, 0, 6.283); ctx.stroke();
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, R * 0.8);
      g.addColorStop(0, `rgba(${COPPER},${(1 - k) * 0.45})`);
      g.addColorStop(1, `rgba(${COPPER},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(b.x, b.y, R * 0.8, 0, 6.283); ctx.fill();
    });

    ions.forEach(ion => { if (ion.state !== 'held') drawIon(ion, time); });
  }

  // ---------- Loop ----------
  if (reduceMotion) {
    // static: the final chapter, fully drawn
    const ch = CHAPTERS[CHAPTERS.length - 1];
    const show = () => {
      if (!ions) resize();
      if (!ions) return;
      current = CHAPTERS.length - 1;
      ions.forEach(i => (i.state = 'free'));
      stages = [{ ci: current, ch, t: 99, out: -1, box: layoutBox(ch), held: [], waiting: false }];
      draw(0);
    };
    if (ready(ch)) show(); else ch.image.addEventListener('load', show);
    return;
  }

  let last = performance.now(), running = true;
  function frame(now) {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
    if (!ions) resize(); // canvas had no size yet on first call
    if (ions) { step(dt, now / 1000); draw(now / 1000); }
    if (running) requestAnimationFrame(frame);
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
      else if (!e.isIntersecting) running = false;
    }).observe(canvas);
  }
  requestAnimationFrame(frame);
})();
