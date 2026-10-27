/* ==========================================================================
   Advanced Vehicle Dynamics — site behavior
   1. Scroll-scrubbed car (frame sequence on a canvas) + story cards that enter/exit
   2. Reveal-in / reveal-out for every section card
   3. Mouse interaction on everything marked data-fx
   4. Floating "Contact Now" sheet, nav, contact form
   ========================================================================== */
(() => {
  'use strict';

  const cfg = Object.assign({ formEndpoint: '', email: '', phoneTel: '+17203832490' }, window.AVD_CONFIG || {});
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ------------------------------------------------------------------
     1. SCROLL-SCRUBBED CAR
     ------------------------------------------------------------------ */
  const FRAME_COUNT = 241;
  const hasStory = !!$('#top .stage, #top #stage');   // other pages (e.g. diagnose.html) have no car story
  const story = $('#top');
  const stage = $('#stage');
  const wrap = $('#carWrap');
  const canvas = $('#car');
  const ctx = hasStory ? canvas.getContext('2d') : null;
  const loader = $('#loader');
  const loaderBar = $('#loaderBar');
  const loaderText = $('#loaderText');
  const scrollHint = $('#scrollHint');

  const base = ''; // flat layout: frames f001.webp … f241.webp sit in the site root
  const pad = (n) => String(n).padStart(3, '0');

  const frames = new Array(FRAME_COUNT).fill(null);
  let loadedCount = 0;
  let dirty = true;

  // load coarse-to-fine so scrubbing works before everything has arrived
  const order = [];
  const seen = new Set();
  [24, 12, 6, 3, 1].forEach((step) => {
    for (let i = 0; i < FRAME_COUNT; i += step) if (!seen.has(i)) { seen.add(i); order.push(i); }
  });

  function loadFrame(i) {
    return new Promise((resolve) => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => {
        frames[i] = im; loadedCount++; dirty = true;
        const pct = Math.round((loadedCount / FRAME_COUNT) * 100);
        loaderBar.style.width = pct + '%';
        loaderText.textContent = 'Warming up ' + pct + '%';
        if (loadedCount >= 12 && frames[0]) loader.classList.add('done');
        resolve();
      };
      im.onerror = () => resolve();
      im.src = base + 'f' + pad(i + 1) + '.webp';
    });
  }
  (async function loadAll() {
    if (!hasStory) return;
    let cursor = 0;
    const worker = async () => { while (cursor < order.length) await loadFrame(order[cursor++]); };
    await Promise.all(Array.from({ length: 6 }, worker));
    loader.classList.add('done');
  })();

  function drawFrame(idx) {
    let im = frames[idx];
    if (!im) {
      for (let d = 1; d < FRAME_COUNT; d++) {
        if (frames[idx - d]) { im = frames[idx - d]; break; }
        if (frames[idx + d]) { im = frames[idx + d]; break; }
      }
    }
    if (!im) return;
    ctx.drawImage(im, 0, 0, canvas.width, canvas.height);
  }

  // ----- layout: how big the car canvas is, and whether we're on a tall (phone) screen
  let vw = innerWidth, vh = innerHeight, tall = false, canvasW = 1280, canvasH = 720, baseCy = 0;
  function layout() {
    vw = innerWidth; vh = innerHeight;
    const aspect = vw / vh;
    tall = aspect < 1.2;
    stage.classList.toggle('is-tall', tall);
    let s;
    if (!tall) s = aspect >= 1.45 ? vh / 720 : Math.max(vw / 1280, (vh / 720) * 0.9);
    else s = (vw / 1280) * 1.3;
    canvasW = 1280 * s; canvasH = 720 * s;
    wrap.style.setProperty('--cw', canvasW + 'px');
    wrap.style.setProperty('--ch', canvasH + 'px');
    baseCy = tall ? -(vh / 2) + vh * 0.4 : 0;
    dirty = true;
  }
  addEventListener('resize', hasStory ? layout : () => { vw = innerWidth; vh = innerHeight; });
  if (hasStory) layout();

  // ----- story beats (cards that slide/fade in and out as you scroll)
  const beats = $$('.beat').map((el) => {
    const [a, b] = el.dataset.in.split(',').map(Number);
    const [c, d] = el.dataset.out.split(',').map(Number);
    return {
      el, a, b, c, d,
      side: el.dataset.side || 'left',
      shift: Number(el.dataset.shift || 0),
      scale: Number(el.dataset.scale || 1)
    };
  });

  function updateBeats(p) {
    if (!hasStory) return;
    let cx = 0, cs = 1;
    for (const B of beats) {
      const enter = 1 - smooth(B.a, B.b, p);
      const exit = smooth(B.c, B.d, p);
      const vis = (1 - enter) * (1 - exit);
      const dir = B.side === 'right' ? 1 : B.side === 'left' ? -1 : 0;
      const out = (enter + exit);
      B.el.style.opacity = vis.toFixed(3);
      B.el.style.setProperty('--bx', (dir * out * 80).toFixed(1) + 'px');
      B.el.style.setProperty('--by', (dir === 0 ? out * 46 : 0).toFixed(1) + 'px');
      B.el.classList.toggle('is-active', vis > 0.6);
      cx += vis * B.shift;
      cs += vis * (B.scale - 1);
    }
    if (tall) { cx = 0; cs = 1; }
    wrap.style.setProperty('--cx', (cx * vw).toFixed(1) + 'px');
    wrap.style.setProperty('--cy', baseCy.toFixed(1) + 'px');
    wrap.style.setProperty('--cs', cs.toFixed(4));
  }

  // ----- the main loop
  let targetP = 0, curP = 0, lastIdx = -1;
  let mx = 0, my = 0, pmx = 0, pmy = 0;      // mouse (-0.5..0.5) for car parallax
  const fab = $('#fab');
  const sheet = $('#sheet');
  const fabBtn = $('#fabBtn');
  const bar = $('.scrollbar i');
  let contactInView = false;
  let fabForced = false;

  function tick() {
    if (hasStory) {
      const rect = story.getBoundingClientRect();
      const total = rect.height - vh;
      targetP = clamp(-rect.top / total, 0, 1);
      curP = reduceMotion ? targetP : lerp(curP, targetP, 0.18);
      if (Math.abs(targetP - curP) < 0.0004) curP = targetP;

      const idx = Math.round(curP * (FRAME_COUNT - 1));
      if (idx !== lastIdx || dirty) { drawFrame(idx); lastIdx = idx; dirty = false; }
    } else {
      curP = 1;
    }

    updateBeats(curP);

    // mouse parallax on the car
    pmx = lerp(pmx, mx, 0.07); pmy = lerp(pmy, my, 0.07);
    if (hasStory) {
      wrap.style.setProperty('--pxm', (pmx * -26).toFixed(2) + 'px');
      wrap.style.setProperty('--pym', (pmy * -16).toFixed(2) + 'px');
      scrollHint.style.opacity = (1 - smooth(0, 0.025, curP)).toFixed(3);
    }

    // floating Contact Now: appears after the hero, hides at the form
    // (on phones the story cards already carry buttons, so the bar waits until the story ends)
    fab.classList.toggle('is-on', fabForced || ((tall ? curP > 0.985 : curP > 0.13) && !contactInView));

    // page progress bar
    const docH = document.documentElement.scrollHeight - vh;
    bar.style.width = (clamp(scrollY / docH, 0, 1) * 100).toFixed(2) + '%';

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  /* ------------------------------------------------------------------
     2. REVEAL IN / OUT
     ------------------------------------------------------------------ */
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const el = e.target;
      if (e.isIntersecting) el.dataset.s = 'in';
      else el.dataset.s = e.boundingClientRect.top < 0 ? 'above' : 'below';
    }
  }, { threshold: 0.12, rootMargin: '-5% 0px -5% 0px' });
  $$('.reveal').forEach((el) => { el.dataset.s = 'below'; io.observe(el); });
  // lets other scripts (diagnose.js) animate cards they add later
  window.AVD_reveal = (el) => { el.dataset.s = 'below'; io.observe(el); };

  if ($('#contact')) {
    new IntersectionObserver((entries) => {
      contactInView = entries[0].isIntersecting;
    }, { threshold: 0, rootMargin: '0px 0px -35% 0px' }).observe($('#contact'));
  }

  /* ------------------------------------------------------------------
     3. MOUSE INTERACTION
     ------------------------------------------------------------------ */
  const glow = $('.cursor-glow');
  if (finePointer && !reduceMotion) {
    let current = null;

    const resetFx = (el) => {
      if (!el) return;
      ['--tx', '--ty', '--rx', '--ry'].forEach((v) => el.style.removeProperty(v));
      const img = el.querySelector(':scope > img');
      if (img) { img.style.removeProperty('--px'); img.style.removeProperty('--py'); }
    };

    document.addEventListener('pointermove', (e) => {
      mx = e.clientX / innerWidth - 0.5;
      my = e.clientY / innerHeight - 0.5;
      glow.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      glow.classList.add('on');

      const el = e.target.closest ? e.target.closest('[data-fx]') : null;
      if (el !== current) { resetFx(current); current = el; }
      if (!el) return;

      const r = el.getBoundingClientRect();
      const x = clamp((e.clientX - r.left) / r.width, 0, 1);
      const y = clamp((e.clientY - r.top) / r.height, 0, 1);
      const kinds = el.dataset.fx;
      el.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
      el.style.setProperty('--my', (y * 100).toFixed(1) + '%');

      if (kinds.includes('tilt')) {
        el.style.setProperty('--rx', ((0.5 - y) * 7).toFixed(2) + 'deg');
        el.style.setProperty('--ry', ((x - 0.5) * 9).toFixed(2) + 'deg');
      }
      if (kinds.includes('magnet')) {
        el.style.setProperty('--tx', ((x - 0.5) * 14).toFixed(1) + 'px');
        el.style.setProperty('--ty', ((y - 0.5) * 10).toFixed(1) + 'px');
      }
      if (kinds.includes('nudge')) {
        el.style.setProperty('--tx', ((x - 0.5) * 5).toFixed(1) + 'px');
        el.style.setProperty('--ty', ((y - 0.5) * 3).toFixed(1) + 'px');
      }
      if (kinds.includes('pan')) {
        const img = el.querySelector(':scope > img');
        if (img) {
          img.style.setProperty('--px', ((0.5 - x) * 26).toFixed(1) + 'px');
          img.style.setProperty('--py', ((0.5 - y) * 18).toFixed(1) + 'px');
        }
      }
    }, { passive: true });

    document.addEventListener('pointerleave', () => {
      glow.classList.remove('on'); resetFx(current); current = null; mx = my = 0;
    });
    document.documentElement.addEventListener('mouseleave', () => {
      glow.classList.remove('on'); resetFx(current); current = null; mx = my = 0;
    });
  }

  /* ------------------------------------------------------------------
     4. NAV, CONTACT SHEET, FORM
     ------------------------------------------------------------------ */
  // burger menu
  const burger = $('#burger');
  const navLinks = $('#navLinks');
  burger.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
  });
  navLinks.addEventListener('click', (e) => {
    if (e.target.closest('a')) { navLinks.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); }
  });

  // anchor links jump into a story section smoothly but clear the fixed nav
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = $(id);
      if (!target) return;
      e.preventDefault();
      const y = id === '#top' ? 0 : target.getBoundingClientRect().top + scrollY - 20;
      scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  });

  // fat Contact Now -> sheet with Call / Text / Message
  function setSheet(open) {
    sheet.classList.toggle('open', open);
    fabBtn.setAttribute('aria-expanded', String(open));
    fabForced = open;
  }
  fabBtn.addEventListener('click', (e) => { e.stopPropagation(); setSheet(!sheet.classList.contains('open')); });
  $$('[data-open-sheet]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); setSheet(true); }));
  sheet.addEventListener('click', (e) => { if (e.target.closest('a')) setSheet(false); });
  document.addEventListener('click', (e) => { if (!e.target.closest('#fab')) setSheet(false); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setSheet(false); });

  // contact form
  const form = $('#contactForm');
  const note = $('#formNote');
  const say = (msg, kind) => { note.textContent = msg; note.className = 'form-note ' + (kind || ''); };

  // arriving from the problem checker: prefill vehicle + message
  if (form) {
    try {
      const raw = sessionStorage.getItem('avd_prefill');
      if (raw) {
        sessionStorage.removeItem('avd_prefill');
        const pf = JSON.parse(raw);
        if (pf.vehicle && form.elements.vehicle) form.elements.vehicle.value = String(pf.vehicle).slice(0, 120);
        if (pf.message && form.elements.message) form.elements.message.value = String(pf.message).slice(0, 1500);
      }
    } catch (err) { /* storage unavailable — ignore */ }
  }

  if (form) form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.elements.website.value) return;                       // honeypot
    const d = Object.fromEntries(new FormData(form).entries());
    d.fleet = form.elements.fleet.checked ? 'Yes' : 'No';
    delete d.website;
    if (!(d.name || '').trim() || !(d.phone || '').trim()) {
      say('Please add your name and phone number so we can reach you.', 'err');
      return;
    }
    const body =
      `Name: ${d.name}\nPhone: ${d.phone}\nVehicle: ${d.vehicle || '-'}\nFleet inquiry: ${d.fleet}\n\n${d.message || ''}`;

    if (cfg.formEndpoint) {
      try {
        const res = await fetch(cfg.formEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(d)
        });
        if (!res.ok) throw new Error('bad response');
        form.reset();
        say("Thanks! We got your message and will reach out soon.", 'ok');
      } catch (err) {
        say('Something went wrong sending that. Please call or text (720) 383-2490.', 'err');
      }
      return;
    }
    if (cfg.email) {
      location.href = `mailto:${cfg.email}?subject=${encodeURIComponent('Website inquiry — ' + d.name)}&body=${encodeURIComponent(body)}`;
      say('Opening your email app…', 'ok');
      return;
    }
    location.href = `sms:${cfg.phoneTel}?&body=${encodeURIComponent(body)}`;
    say('Opening your messages app — tap send to text us.', 'ok');
  });

  if ($('#year')) $('#year').textContent = new Date().getFullYear();
})();
