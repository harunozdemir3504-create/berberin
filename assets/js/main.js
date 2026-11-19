/* =========================================================
   BERBERİNN — main.js
   Navigation, reveal animations, smart hero video player,
   bento gallery + lightbox. No dependencies.
   ========================================================= */
(() => {
  'use strict';

  const MEDIA = window.BERBERINN_MEDIA || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.matchMedia('(max-width: 1023px)').matches;
  const portraitScreen = window.matchMedia('(max-aspect-ratio: 1/1)').matches;
  const saveData = !!(navigator.connection && navigator.connection.saveData);

  /* ---------------- Nav ---------------- */
  const nav = $('#siteNav');
  const mcta = $('.mobile-cta');
  const onScroll = () => {
    const y = window.scrollY;
    nav.classList.toggle('is-scrolled', y > 20);
    if (mcta) mcta.classList.toggle('is-visible', y > window.innerHeight * 0.35);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const menuBtn = $('#menuBtn');
  const menu = $('#mobileMenu');
  const setMenu = (open) => {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Menüyü kapat' : 'Menüyü aç');
    menu.hidden = !open;
  };
  menuBtn?.addEventListener('click', () => setMenu(menu.hidden));
  $$('#mobileMenu a').forEach((a) => a.addEventListener('click', () => setMenu(false)));

  // Active section highlight
  const links = $$('.nav-link');
  const secObs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((l) => l.classList.toggle('is-active', l.getAttribute('href') === '#' + e.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  ['hizmetler', 'ustalik', 'galeri', 'konum'].forEach((id) => { const el = document.getElementById(id); el && secObs.observe(el); });

  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------------- Reveal ---------------- */
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); revealObs.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  const observeReveal = (el) => revealObs.observe(el);
  $$('[data-reveal]').forEach(observeReveal);

  /* ---------------- Card cursor glow ---------------- */
  const bindGlow = (el) => {
    el.addEventListener('pointermove', (ev) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${ev.clientX - r.left}px`);
      el.style.setProperty('--my', `${ev.clientY - r.top}px`);
    });
  };
  $$('[data-glow]').forEach(bindGlow);

  /* ---------------- Marquee (seamless clone) ---------------- */
  $$('[data-marquee]').forEach((m) => {
    const track = $('.marquee-track', m);
    Array.from(track.children).forEach((li) => {
      const c = li.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      track.appendChild(c);
    });
    track.style.setProperty('--dur', `${Math.max(30, track.children.length * 3.2)}s`);
  });

  /* =========================================================
     HERO VIDEO
     mode "reel"     → FFmpeg ile üretilmiş showreel (loop + Ken Burns)
     mode "segments" → Ham uzun video; JS en iyi aralıklar arasında
                       kararma/açılma + Ken Burns ile geçiş yapar
     mode "none"     → Sinematik CSS yer tutucu
     ========================================================= */
  const hero = MEDIA.hero || { mode: 'none' };
  const heroMedia = $('#heroMedia');
  const heroKB = $('#heroKB');
  const video = $('#heroVideo');
  const placeholder = $('.hero-placeholder', heroMedia);

  if (hero.poster && placeholder) {
    placeholder.style.backgroundImage = `url("${hero.poster}")`;
    placeholder.classList.add('has-photo');
  }

  const markReady = () => heroMedia.classList.add('is-ready');
  const tryPlay = () => {
    video.muted = true;
    video.defaultMuted = true;
    const p = video.play();
    if (p && p.catch) p.catch(() => {});
  };

  function setupReel() {
    const fallbackSrc = (hero.sources && hero.sources[0] && hero.sources[0].src) || null;
    const primarySrc = (portraitScreen && hero.mobile) ? hero.mobile : fallbackSrc;
    if (!primarySrc) return;

    // iOS Safari & Android Chrome autoplay uyumluluğu için tüm bayraklar
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.loop = true;
    video.preload = 'auto';
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('autoplay', '');
    if (hero.poster) video.poster = hero.poster;

    let triedFallback = false;
    video.addEventListener('error', () => {
      if (!triedFallback && fallbackSrc && video.src.indexOf(fallbackSrc) === -1) {
        triedFallback = true;
        video.src = fallbackSrc;
        video.load();
        tryPlay();
      }
    });

    const revealVideo = () => { markReady(); tryPlay(); };
    video.addEventListener('loadeddata', revealVideo, { once: true });
    video.addEventListener('canplay', revealVideo, { once: true });
    video.addEventListener('playing', markReady, { once: true });

    video.src = primarySrc;
    video.load();
    tryPlay();

    // Pil/veri tasarrufu modunda ilk autoplay engellenirse ilk dokunuşta veya kaydırmada başlat
    const unlock = () => { tryPlay(); if (!video.paused) markReady(); };
    ['touchstart', 'pointerdown', 'scroll'].forEach((ev) => {
      window.addEventListener(ev, unlock, { once: true, passive: true });
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && video.paused) tryPlay();
    });
  }

  class SegmentPlayer {
    constructor(vid, kb, segments, opts = {}) {
      this.v = vid; this.kb = kb;
      this.segments = segments || [];
      this.fadeMs = opts.fadeMs || 850;
      this.segLen = opts.segLen || 5;
      this.count = opts.count || 4;
      this.idx = 0; this.busy = false; this.kbFlip = false;
      this.tick = this.tick.bind(this);
    }
    start() {
      const v = this.v;
      v.loop = false;
      v.addEventListener('loadedmetadata', () => {
        if (!this.segments.length) this.segments = evenSegments(v.duration, this.count, this.segLen);
        this.jump(0, true);
      }, { once: true });
      v.addEventListener('ended', () => this.next());
      v.preload = 'auto';
      v.src = hero.src;
      v.load();
    }
    setSegments(segs) {
      if (!segs || !segs.length) return;
      this.segments = segs;
      this.idx = this.idx % segs.length;
    }
    jump(i, first) {
      const v = this.v;
      const [s] = this.segments[i];
      const onSeeked = () => {
        v.removeEventListener('seeked', onSeeked);
        this.kenBurns();
        tryPlay();
        v.classList.remove('is-dim');
        if (first) { v.addEventListener('playing', markReady, { once: true }); requestAnimationFrame(this.tick); }
        this.busy = false;
      };
      v.addEventListener('seeked', onSeeked);
      v.currentTime = s;
    }
    next() {
      if (this.busy) return;
      this.busy = true;
      this.v.classList.add('is-dim');
      setTimeout(() => {
        this.idx = (this.idx + 1) % this.segments.length;
        this.jump(this.idx);
      }, this.fadeMs);
    }
    tick() {
      const seg = this.segments[this.idx];
      if (seg && !this.busy && this.v.currentTime >= seg[1] - this.fadeMs / 1000) this.next();
      requestAnimationFrame(this.tick);
    }
    kenBurns() {
      // Each segment: slow zoom in or out with a different origin
      const seg = this.segments[this.idx];
      const dur = Math.max(2, seg[1] - seg[0]);
      const origins = ['30% 40%', '70% 35%', '50% 60%', '40% 50%', '60% 45%'];
      const zoomIn = (this.kbFlip = !this.kbFlip);
      const from = zoomIn ? 1.03 : 1.15;
      const to = zoomIn ? 1.15 : 1.03;
      const kb = this.kb;
      kb.style.transition = 'none';
      kb.style.transformOrigin = origins[this.idx % origins.length];
      kb.style.transform = `scale(${from})`;
      void kb.offsetWidth; // reflow
      kb.style.transition = `transform ${dur + 1}s linear`;
      kb.style.transform = `scale(${to})`;
    }
  }

  function evenSegments(duration, count = 4, len = 5) {
    if (!isFinite(duration) || duration <= 0) return [[0, len]];
    if (duration <= len * 1.5) return [[0, duration]];
    const startMin = duration * 0.08;
    const startMax = Math.max(startMin, duration * 0.92 - len);
    const n = Math.max(1, Math.min(count, Math.floor((startMax - startMin) / (len + 1)) + 1));
    const segs = [];
    for (let i = 0; i < n; i++) {
      const s = n === 1 ? startMin : startMin + ((startMax - startMin) * i) / (n - 1);
      segs.push([+s.toFixed(2), +Math.min(duration, s + len).toFixed(2)]);
    }
    return segs;
  }

  /* In-browser scene analysis (desktop only): samples frames from a hidden
     copy of the video and scores sharpness, motion, exposure & colour. */
  async function analyzeVideo(src, duration, count, len) {
    const W = 96, H = 54;
    const probe = document.createElement('video');
    probe.muted = true; probe.preload = 'auto'; probe.playsInline = true; probe.src = src;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true });

    const seek = (t) => new Promise((res, rej) => {
      const to = setTimeout(() => rej(new Error('seek timeout')), 3000);
      probe.addEventListener('seeked', () => { clearTimeout(to); res(); }, { once: true });
      probe.currentTime = t;
    });
    const grab = () => { ctx.drawImage(probe, 0, 0, W, H); return ctx.getImageData(0, 0, W, H).data; };

    await new Promise((res, rej) => {
      if (probe.readyState >= 1) return res();
      probe.addEventListener('loadedmetadata', res, { once: true });
      probe.addEventListener('error', rej, { once: true });
    });

    const K = 16;
    const a = duration * 0.05, b = Math.max(a, duration * 0.95 - len);
    const samples = [];
    for (let i = 0; i < K; i++) {
      const t = a + ((b - a) * i) / (K - 1) + len * 0.4;
      await seek(t); const f1 = grab();
      await seek(Math.min(duration - 0.05, t + 0.4)); const f2 = grab();
      let lum = 0, sharp = 0, motion = 0, rg = 0, yb = 0;
      const L = new Float32Array(W * H);
      for (let p = 0, q = 0; p < f1.length; p += 4, q++) {
        const r = f1[p], g = f1[p + 1], bl = f1[p + 2];
        const y = 0.299 * r + 0.587 * g + 0.114 * bl;
        L[q] = y; lum += y;
        rg += Math.abs(r - g); yb += Math.abs(0.5 * (r + g) - bl);
        motion += Math.abs(y - (0.299 * f2[p] + 0.587 * f2[p + 1] + 0.114 * f2[p + 2]));
      }
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const k = y * W + x;
        sharp += Math.abs(4 * L[k] - L[k - 1] - L[k + 1] - L[k - W] - L[k + W]);
      }
      const n = W * H;
      samples.push({ t: t - len * 0.4, lum: lum / n, sharp: sharp / n, motion: motion / n, color: (rg + yb) / n });
    }
    probe.removeAttribute('src'); probe.load();

    const rank = (key) => {
      const sorted = samples.map((s) => s[key]).sort((x, y) => x - y);
      return (v) => sorted.indexOf(v) / Math.max(1, sorted.length - 1);
    };
    const rs = rank('sharp'), rm = rank('motion'), rc = rank('color');
    samples.forEach((s) => {
      const exposure = 1 - Math.min(1, Math.abs(s.lum - 115) / 115);
      const cutPenalty = s.motion > 60 ? 0.6 : 0; // probable hard cut / camera shake
      s.score = 0.38 * rs(s.sharp) + 0.3 * rm(s.motion) + 0.17 * exposure + 0.15 * rc(s.color) - cutPenalty - (s.lum < 30 ? 0.5 : 0);
    });
    const picked = [];
    samples.slice().sort((x, y) => y.score - x.score).forEach((s) => {
      if (picked.length < count && picked.every((p) => Math.abs(p.t - s.t) >= len + 1)) picked.push(s);
    });
    return picked.sort((x, y) => x.t - y.t).map((s) => [+s.t.toFixed(2), +Math.min(duration, s.t + len).toFixed(2)]);
  }

  function setupSegments() {
    if (!hero.src) return;
    if (hero.poster) video.poster = hero.poster;
    const player = new SegmentPlayer(video, heroKB, hero.segments, {
      segLen: hero.segmentLength || 5, count: hero.segmentCount || 4, fadeMs: 850
    });
    player.start();
    if (!(hero.segments && hero.segments.length) && !isMobile && !saveData) {
      video.addEventListener('loadedmetadata', () => {
        const d = video.duration;
        if (!isFinite(d) || d < 20) return;
        const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000));
        Promise.race([analyzeVideo(hero.src, d, hero.segmentCount || 4, hero.segmentLength || 5), timeout])
          .then((segs) => player.setSegments(segs))
          .catch(() => { /* even spacing stays active */ });
      }, { once: true });
    }
  }

  // Mobilde pil tasarrufu / saveData olsa bile showreel oynatılsın
  if (hero.mode === 'reel') setupReel();
  else if (hero.mode === 'segments' && !reduceMotion) setupSegments();

  /* =========================================================
     USTA PORTRAIT
     ========================================================= */
  if (MEDIA.portrait) {
    const frame = $('#ustaPortrait');
    const img = new Image();
    img.alt = 'Usta Hakan Çetinkaya – Berberinn Bornova';
    img.loading = 'lazy'; img.decoding = 'async';
    img.onload = () => { frame.querySelector('.portrait-placeholder')?.remove(); };
    img.src = MEDIA.portrait;
    frame.prepend(img);
  }

  /* =========================================================
     BENTO GALLERY
     ========================================================= */
  const PLACEHOLDERS = [
    { type: 'placeholder', title: 'Skin Fade', tag: 'Saç', icon: 'i-scissors', layout: 'big' },
    { type: 'placeholder', title: 'Sakal Hattı', tag: 'Sakal', icon: 'i-razor', layout: 'tall' },
    { type: 'placeholder', title: 'Sıcak Havlu', tag: 'Ritüel', icon: 'i-sparkle' },
    { type: 'placeholder', title: 'Klasik Makas', tag: 'Saç', icon: 'i-comb' },
    { type: 'placeholder', title: 'Salon', tag: 'Berberinn', icon: 'logo-mark', layout: 'wide' },
    { type: 'placeholder', title: 'Damat Tıraşı', tag: 'Özel Gün', icon: 'i-crown', layout: 'tall' },
    { type: 'placeholder', title: 'VIP Bakım', tag: 'Cilt', icon: 'i-sparkle' },
    { type: 'placeholder', title: 'Taper Fade', tag: 'Saç', icon: 'i-scissors' },
    { type: 'placeholder', title: 'Usta İşi', tag: 'Detay', icon: 'i-razor', layout: 'wide' }
  ];
  const items = (MEDIA.gallery && MEDIA.gallery.length) ? MEDIA.gallery : PLACEHOLDERS;
  const grid = $('#galleryGrid');

  const layoutFor = (it, i) => {
    if (it.layout) return it.layout;
    if (i === 0) return 'big';
    if (it.orientation === 'portrait') return 'tall';
    if (it.orientation === 'landscape') return 'wide';
    return '';
  };

  const clipObs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const v = e.target;
      if (e.isIntersecting) { if (v.preload === 'none') { v.preload = 'metadata'; v.src = v.dataset.src; } v.play().catch(() => {}); }
      else v.pause();
    });
  }, { threshold: 0.35 });

  items.forEach((it, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    const lay = layoutFor(it, i);
    btn.className = `tile${lay ? ' tile--' + lay : ''}${it.type === 'placeholder' ? ' tile--ph' : ''}`;
    btn.style.setProperty('--d', `${(i % 4) * 80}ms`);
    btn.dataset.index = i;
    btn.setAttribute('aria-label', `${it.title || it.alt || 'Galeri görseli'} – büyüt`);

    let icon = 'i-expand';
    if (it.type === 'image') {
      if (it.lqip) btn.style.backgroundImage = `url("${it.lqip}")`;
      const img = new Image();
      img.loading = 'lazy'; img.decoding = 'async';
      img.alt = it.alt || 'Berberinn Bornova galeri';
      if (it.width && it.height) { img.width = it.width; img.height = it.height; }
      img.onload = () => img.classList.add('is-loaded');
      img.src = it.thumb || it.full;
      btn.appendChild(img);
    } else if (it.type === 'video') {
      icon = 'i-play';
      const v = document.createElement('video');
      v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
      v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
      if (it.poster) v.poster = it.poster;
      v.dataset.src = it.src;
      btn.appendChild(v);
      if (!reduceMotion) clipObs.observe(v);
    } else {
      btn.style.setProperty('--px', `${20 + ((i * 37) % 60)}%`);
      btn.style.setProperty('--py', `${15 + ((i * 23) % 50)}%`);
      btn.insertAdjacentHTML('beforeend', `<svg class="ph-icon" aria-hidden="true"><use href="#${it.icon}"/></svg>`);
    }

    const title = it.title || it.alt || '';
    btn.insertAdjacentHTML('beforeend',
      `<span class="tile-cap"><span>${it.tag ? `<small>${it.tag}</small>` : ''}<b>${escapeHtml(title)}</b></span>` +
      `<span class="tile-ico"><svg aria-hidden="true"><use href="#${icon}"/></svg></span></span>`);
    btn.addEventListener('click', () => openLightbox(i));
    grid.appendChild(btn);
    observeReveal(btn);
  });

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  /* =========================================================
     LIGHTBOX
     ========================================================= */
  const lb = $('#lightbox');
  const lbMedia = $('.lb-media', lb);
  const lbTitle = $('.lb-title', lb);
  const lbCount = $('.lb-count', lb);
  let lbIndex = 0, lastFocus = null;

  function renderLB() {
    const it = items[lbIndex];
    lbMedia.innerHTML = '';
    let el;
    if (it.type === 'image') {
      el = new Image();
      el.alt = it.alt || '';
      el.src = it.full || it.thumb;
      if (it.lqip) el.style.background = `center/cover url("${it.lqip}")`;
    } else if (it.type === 'video') {
      el = document.createElement('video');
      el.src = it.src; el.muted = true; el.loop = true; el.playsInline = true; el.autoplay = true; el.controls = true;
      if (it.poster) el.poster = it.poster;
    } else {
      el = document.createElement('div');
      el.className = 'lb-ph tile tile--ph is-in';
      el.style.cursor = 'default';
      el.innerHTML = `<svg class="ph-icon" aria-hidden="true"><use href="#${it.icon}"/></svg>`;
    }
    lbMedia.appendChild(el);
    lbTitle.textContent = it.title || it.alt || '';
    lbCount.textContent = `${String(lbIndex + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`;
  }
  function openLightbox(i) {
    lastFocus = document.activeElement;
    lbIndex = i; renderLB();
    lb.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    $('.lb-close', lb).focus();
  }
  function closeLightbox() {
    lb.hidden = true; lbMedia.innerHTML = '';
    document.documentElement.style.overflow = '';
    lastFocus && lastFocus.focus();
  }
  function step(dir) {
    lbMedia.classList.add('is-leaving');
    setTimeout(() => {
      lbMedia.classList.remove('is-leaving');
      lbIndex = (lbIndex + dir + items.length) % items.length;
      renderLB();
    }, 260);
  }
  $$('[data-lb-close]', lb).forEach((b) => b.addEventListener('click', closeLightbox));
  $('.lb-prev', lb).addEventListener('click', () => step(-1));
  $('.lb-next', lb).addEventListener('click', () => step(1));
  document.addEventListener('keydown', (e) => {
    if (lb.hidden) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
  });
  let tx = 0;
  lb.addEventListener('touchstart', (e) => { tx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
  }, { passive: true });
})();
