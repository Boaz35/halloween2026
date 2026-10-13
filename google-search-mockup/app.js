(() => {
  'use strict';

  // ---------------------------------------------------------------------------
  // Tuning. Every value can also be overridden from the URL for rehearsal, e.g.
  //   index.html?creepy=7.4&freeze=2000
  // ---------------------------------------------------------------------------
  const params = new URLSearchParams(location.search);
  const num = (key, fallback) => (params.has(key) ? Number(params.get(key)) : fallback);
  const CONFIG = {
    VIDEO_SRC: params.get('video') || 'media/scare.mp4',
    FREEZE_MS: num('freeze', 2000),          // hold on the first frame before playing
    CREEPY_AT: num('creepy', 4.8),           // seconds into the clip where the scene turns -> full screen
    INTRO_GLITCH_MS: num('introGlitch', 450),
    TAKEOVER_GLITCH_MS: num('takeoverGlitch', 650),
    GLITCH_VOLUME: num('glitchVol', 0.9),     // 0..1, the digital-noise burst at the takeover
    LOOP_AT_END: params.get('loop') === '1', // otherwise freeze on the last frame
  };

  const THUMB_BASE = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:';
  const COL_TARGET = 236;
  const COL_GAP = 10;
  const ROW_GAP = 16;
  const META_H = 40;

  const $ = (sel) => document.querySelector(sel);
  const grid = $('#grid');
  const video = $('#scare');
  const fx = $('#fx');
  const ctx = fx.getContext('2d');
  const root = document.documentElement;

  let state = 'idle'; // idle -> intro -> frozen -> playing -> takeover

  // ---------------------------------------------------------------- render
  document.querySelectorAll('[data-icon]').forEach((el) => {
    el.innerHTML = window.ICONS[el.dataset.icon] || '';
  });

  const chipsEl = $('#chips');
  window.CHIPS.forEach((chip, i) => {
    const el = document.createElement('a');
    el.className = 'chip';
    const img = document.createElement('img');
    img.className = 'chip-img';
    img.alt = '';
    img.referrerPolicy = 'no-referrer';
    img.src = chip.img || THUMB_BASE + window.RESULTS[(i * 7) % window.RESULTS.length].src;
    const label = document.createElement('span');
    label.textContent = chip.label;
    el.append(img, label);
    chipsEl.append(el);
  });

  const PLAY_ICON = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  const cards = window.RESULTS.map((item) => {
    const card = document.createElement('div');
    card.className = 'card';

    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    const img = document.createElement('img');
    img.alt = item.title;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.src = THUMB_BASE + item.src;
    thumb.append(img);

    if (item.badge) {
      const badge = document.createElement('div');
      badge.className = 'badge';
      const isVideo = item.badge.startsWith('Video');
      badge.innerHTML = (isVideo ? PLAY_ICON : '') + '<span></span>';
      badge.lastChild.textContent = item.badge.replace(/\s*·\s*/g, ' · ');
      thumb.append(badge);
    }

    const meta = document.createElement('div');
    meta.className = 'meta';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = item.title;
    const source = document.createElement('div');
    source.className = 'source';
    const favSrc = window.FAVICONS[item.site];
    let fav;
    if (favSrc) {
      fav = document.createElement('img');
      fav.src = favSrc;
      fav.alt = '';
    } else {
      fav = document.createElement('span');
      fav.classList.add('fav-generic');
    }
    fav.classList.add('fav');
    const site = document.createElement('span');
    site.textContent = item.site;
    source.append(fav, site);
    meta.append(title, source);

    card.append(thumb, meta);
    grid.append(card);
    return { card, thumb, ratio: item.h / item.w };
  });

  // Masonry: fixed-width columns, each card goes into the currently shortest column.
  function layout() {
    const width = grid.clientWidth;
    const cols = Math.max(2, Math.round((width + COL_GAP) / (COL_TARGET + COL_GAP)));
    const colW = (width - COL_GAP * (cols - 1)) / cols;
    const heights = new Array(cols).fill(0);
    for (const c of cards) {
      const col = heights.indexOf(Math.min(...heights));
      const h = Math.round(colW * c.ratio);
      c.thumb.style.height = h + 'px';
      c.card.style.width = colW + 'px';
      c.card.style.left = col * (colW + COL_GAP) + 'px';
      c.card.style.top = heights[col] + 'px';
      heights[col] += h + META_H + ROW_GAP;
    }
    grid.style.height = Math.max(...heights) + 'px';
  }
  layout();
  addEventListener('resize', () => {
    layout();
    sizeCanvas();
  });

  // ------------------------------------------------------- lock everything
  // Scrolling is the only thing that works. After the takeover, not even that.
  const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']);
  const block = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  addEventListener('keydown', (e) => {
    if (state !== 'takeover' && SCROLL_KEYS.has(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) return;
    block(e);
  }, { capture: true });
  for (const type of ['contextmenu', 'dragstart', 'selectstart', 'auxclick', 'dblclick', 'copy', 'cut', 'paste']) {
    addEventListener(type, block, { capture: true });
  }
  addEventListener('mousedown', (e) => {
    // No focus changes, no text selection, no middle-click autoscroll.
    e.preventDefault();
  }, { capture: true });
  addEventListener('wheel', (e) => { if (state === 'takeover') block(e); }, { capture: true, passive: false });
  addEventListener('touchmove', (e) => { if (state === 'takeover') block(e); }, { capture: true, passive: false });

  addEventListener('click', (e) => {
    block(e);
    if (state !== 'idle') return;
    const thumb = e.target.closest && e.target.closest('.thumb');
    if (thumb) start(thumb);
  }, { capture: true });

  // ---------------------------------------------------------------- video
  video.src = CONFIG.VIDEO_SRC;
  video.loop = CONFIG.LOOP_AT_END;
  video.load();
  video.addEventListener('error', () => {
    console.warn('[mockup] Could not load the scare video at', CONFIG.VIDEO_SRC);
  });

  async function start(thumb) {
    state = 'intro';

    // Unlock audio playback while we still hold the click's user activation.
    video.muted = false;
    const unlock = video.play();
    video.pause();
    if (unlock) unlock.catch(() => {});
    video.currentTime = 0;
    unlockAudio();

    const img = thumb.querySelector('img');
    const badge = thumb.querySelector('.badge');
    await glitch({
      ms: CONFIG.INTRO_GLITCH_MS,
      rect: () => thumb.getBoundingClientRect(),
      source: (t) => (t < 0.45 ? img : Math.random() < 0.3 ? img : video),
      onMid: () => {
        thumb.classList.add('playing');
        thumb.append(video);
        if (badge) badge.remove();
      },
    });

    state = 'frozen';
    await wait(CONFIG.FREEZE_MS);

    state = 'playing';
    video.play().catch((err) => console.warn('[mockup] play() failed', err));
    watchForCreepy();
  }

  function watchForCreepy() {
    const tick = () => {
      if (state !== 'playing') return;
      if (video.currentTime >= CONFIG.CREEPY_AT || video.ended) {
        takeover();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function takeover() {
    state = 'takeover';
    const tileRect = video.parentElement.getBoundingClientRect();
    if (document.activeElement) document.activeElement.blur();
    root.classList.add('takeover');
    glitchSound(CONFIG.TAKEOVER_GLITCH_MS);
    glitch({
      ms: CONFIG.TAKEOVER_GLITCH_MS,
      source: () => video,
      // Snap back and forth between the tile and the full screen for the first few frames.
      rect: (t) => (t < 0.35 && Math.random() < 0.5 ? tileRect : fullRect()),
      intensity: 1.6,
    });
  }

  // ----------------------------------------------------------- glitch sound
  // Synthesised on the fly: no audio file needed.
  let audio = null;

  // Must run inside the click so the browser lets us make sound later.
  function unlockAudio() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx || audio) return;
    audio = new Ctx();
    audio.resume().catch(() => {});
  }

  function glitchSound(ms) {
    if (!audio) return;
    const now = audio.currentTime;
    const dur = ms / 1000 + 0.15;

    // White noise source.
    const noiseBuf = audio.createBuffer(1, Math.ceil(audio.sampleRate * dur), audio.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = audio.createBufferSource();
    noise.buffer = noiseBuf;

    // Band-pass that jumps around = "data" chatter.
    const band = audio.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 2;

    // Square-wave beeps at random pitches = digital corruption.
    const beep = audio.createOscillator();
    beep.type = 'square';
    const beepGain = audio.createGain();
    beepGain.gain.value = 0.18;

    // Hard clipping for a broken-speaker edge.
    const crush = audio.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = i / 128 - 1;
      curve[i] = Math.round(x * 4) / 4; // 3-bit staircase
    }
    crush.curve = curve;

    // Stutter gate: hard on/off chops.
    const gate = audio.createGain();
    gate.gain.setValueAtTime(0, now);
    const out = audio.createGain();
    out.gain.value = CONFIG.GLITCH_VOLUME;

    let t = now;
    const end = now + ms / 1000;
    const stutter = [];
    while (t < end) {
      const len = rand(0.015, 0.07);
      const on = Math.random() < 0.72;
      gate.gain.setValueAtTime(on ? rand(0.6, 1) : 0, t);
      band.frequency.setValueAtTime(rand(300, 6000), t);
      beep.frequency.setValueAtTime(rand(80, 2400), t);
      stutter.push([t - now, on]);
      t += len;
    }
    gate.gain.setValueAtTime(0, end);

    noise.connect(band).connect(crush);
    beep.connect(beepGain).connect(crush);
    crush.connect(gate).connect(out).connect(audio.destination);

    // Low impact thump right at the snap.
    const thump = audio.createOscillator();
    const thumpGain = audio.createGain();
    thump.frequency.setValueAtTime(120, now);
    thump.frequency.exponentialRampToValueAtTime(35, now + 0.25);
    thumpGain.gain.setValueAtTime(0.8, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    thump.connect(thumpGain).connect(out);

    noise.start(now);
    beep.start(now);
    thump.start(now);
    noise.stop(now + dur);
    beep.stop(now + dur);
    thump.stop(now + 0.35);

    // Chop the clip's own audio in step with the gate, so the signal sounds broken too.
    for (const [offset, on] of stutter) {
      setTimeout(() => { video.volume = on ? 0.15 : 1; }, offset * 1000);
    }
    setTimeout(() => { video.volume = 1; }, ms);
  }

  // ---------------------------------------------------------------- glitch
  let dpr = 1;
  function sizeCanvas() {
    dpr = window.devicePixelRatio || 1;
    fx.width = Math.round(innerWidth * dpr);
    fx.height = Math.round(innerHeight * dpr);
  }
  sizeCanvas();

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);
  const fullRect = () => ({ left: 0, top: 0, width: innerWidth, height: innerHeight });

  function mediaSize(src) {
    if (src instanceof HTMLVideoElement) return [src.videoWidth, src.videoHeight];
    return [src.naturalWidth, src.naturalHeight];
  }

  // Draw `src` into rect r with object-fit: cover.
  function drawCover(src, r, dx = 0) {
    const [w, h] = mediaSize(src);
    if (!w || !h) {
      ctx.fillStyle = '#000';
      ctx.fillRect(r.left + dx, r.top, r.width, r.height);
      return;
    }
    const scale = Math.max(r.width / w, r.height / h);
    const sw = r.width / scale;
    const sh = r.height / scale;
    try {
      ctx.drawImage(src, (w - sw) / 2, (h - sh) / 2, sw, sh, r.left + dx, r.top, r.width, r.height);
    } catch {
      ctx.fillStyle = '#000';
      ctx.fillRect(r.left + dx, r.top, r.width, r.height);
    }
  }

  function glitchFrame(src, r, k) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.left - 60, r.top, r.width + 120, r.height);
    ctx.clip();

    // Rare full blackout / inverted frame.
    const roll = Math.random();
    if (roll < 0.08) {
      ctx.fillStyle = '#000';
      ctx.fillRect(r.left, r.top, r.width, r.height);
      ctx.restore();
      return;
    }

    drawCover(src, r, rand(-6, 6) * k);

    // Torn horizontal slices.
    const slices = Math.round(rand(3, 9) * k);
    for (let i = 0; i < slices; i++) {
      const y = r.top + Math.random() * r.height;
      const h = rand(2, r.height * 0.12);
      ctx.save();
      ctx.beginPath();
      ctx.rect(r.left - 60, y, r.width + 120, h);
      ctx.clip();
      drawCover(src, r, rand(-40, 40) * k);
      ctx.restore();
    }

    // RGB split bars.
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 3 * k; i++) {
      const y = r.top + Math.random() * r.height;
      const h = rand(4, r.height * 0.18);
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,0,70,0.45)' : 'rgba(0,255,230,0.4)';
      ctx.fillRect(r.left + rand(-12, 12) * k, y, r.width, h);
    }

    if (roll > 0.85) {
      ctx.globalCompositeOperation = 'difference';
      ctx.fillStyle = '#fff';
      ctx.fillRect(r.left, r.top, r.width, r.height);
    }

    // Scan-line noise.
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 14 * k; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.8)';
      ctx.fillRect(r.left, r.top + Math.random() * r.height, r.width, rand(1, 2));
    }
    ctx.restore();
  }

  function glitch({ ms, rect, source, onMid, intensity = 1 }) {
    return new Promise((resolve) => {
      fx.style.display = 'block';
      const t0 = performance.now();
      let midDone = false;
      const frame = (now) => {
        const t = Math.min(1, (now - t0) / ms);
        if (!midDone && t >= 0.5) {
          midDone = true;
          if (onMid) onMid();
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, innerWidth, innerHeight);
        // Some frames show the clean picture underneath, so it stutters rather than strobes.
        if (Math.random() < 0.8) glitchFrame(source(t), rect(t), intensity);
        if (t < 1) {
          requestAnimationFrame(frame);
        } else {
          ctx.clearRect(0, 0, innerWidth, innerHeight);
          fx.style.display = 'none';
          resolve();
        }
      };
      requestAnimationFrame(frame);
    });
  }
})();
