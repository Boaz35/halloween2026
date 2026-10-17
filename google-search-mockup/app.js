(() => {
  'use strict';

  // ---------------------------------------------------------------------------
  // Tuning. Every value can also be overridden from the URL for rehearsal, e.g.
  //   index.html?crash=2.5&loading=3000
  // ---------------------------------------------------------------------------
  const params = new URLSearchParams(location.search);
  const num = (key, fallback) => (params.has(key) ? Number(params.get(key)) : fallback);
  const CONFIG = {
    VIDEO_SRC: params.get('video') || 'media/scare.mp4',
    POSTER_SRC: params.get('poster') || 'media/first-frame.jpg', // the clip's first frame
    FREEZE_MS: num('freeze', 2),             // hold on the first frame before playing
    INTRO_GLITCH_MS: num('introGlitch', 450),
    // The crash sequence, all while the characters are still cute (the clip cuts to creepy at 6.0 s):
    // tile glitch -> Chrome "Aw, Snap!" crash page -> glitch back to the page, the tile keeps
    // playing -> glitch -> Google loading screen -> glitch -> full-screen clip, which hits the cut.
    CRASH_AT: num('crash', 2.5),             // clip time (s) where the crash starts
    REBOOT_AT: num('reboot', 4),             // clip time (s) where the tile glitches into the loading screen
    CUT_AT: num('cut', 6),                   // clip time (s) of the hard cut from cute to creepy
    CLIP_FPS: num('fps', 24),
    REVEAL_FRAMES: num('revealFrames', 12),  // cute frames at full screen before the cut (12 @ 24fps = 0.5 s)
    MORPH_FX_MS: num('morphFx', 500),        // the violent visual hit on the cute -> creepy frame
    MORPH_VOLUME: num('morphVol', 0.9),      // 0..1, the horror stinger on the morph
    MORPH_SWELL: params.get('swell') !== '0', // reverse swell building into the morph
    CRASH_GLITCH_MS: num('crashGlitch', 250),
    ERROR_MS: num('error', 3000),            // crash page stays up this long, or until a click
    BACK_GLITCH_MS: num('backGlitch', 300),
    LOADING_GLITCH_MS: num('loadingGlitch', 300),
    LOADING_MS: num('loading', 3000),
    TAKEOVER_GLITCH_MS: num('takeoverGlitch', 500),
    GLITCH_VOLUME: num('glitchVol', 0.9),     // 0..1, the digital-noise burst at the takeover
    // Auto mode: nobody clicked an image -> every thumbnail turns into the clip by itself.
    AUTO_AFTER_MS: num('auto', 30000),       // 0 disables auto mode
    AUTO_STAGGER_MS: num('stagger', 90),     // delay between one thumbnail and the next
    AUTO_GLITCH_MS: num('autoGlitch', 300),
    AUTO_FREEZE_MS: num('autoFreeze', 2),    // first-frame hold per thumbnail before it plays
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
  const screenEl = $('#screen'); // the fake browser screens (crash page, loading)
  const sctx = screenEl.getContext('2d');
  const root = document.documentElement;

  // idle -> intro -> frozen -> playing -> takeover   (an image was clicked)
  // idle -> auto -> takeover                         (nobody clicked for AUTO_AFTER_MS)
  let state = 'idle';

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

  // In auto mode the clip starts muted (browsers forbid sound before any user gesture).
  // The first key press or tap afterwards gives us that gesture, so bring the sound in.
  const onGesture = () => {
    if (state !== 'auto' && state !== 'takeover') return;
    unlockAudio();
    if (video.muted) video.muted = false;
  };
  addEventListener('pointerdown', onGesture, { capture: true });
  addEventListener('keydown', onGesture, { capture: true });

  addEventListener('click', (e) => {
    block(e);
    if (state !== 'idle') return;
    const thumb = e.target.closest && e.target.closest('.thumb');
    if (thumb) start(thumb);
    else restartAutoTimer(); // any click counts as activity; scrolling does not
  }, { capture: true });

  // ---------------------------------------------------------------- video
  // The first frame as a still: shown the instant a tile switches (before the clip has
  // decoded anything) and drawn by the glitch while a clip has no frame yet.
  const poster = new Image();
  poster.src = CONFIG.POSTER_SRC;

  video.src = CONFIG.VIDEO_SRC;
  video.poster = CONFIG.POSTER_SRC;
  video.loop = CONFIG.LOOP_AT_END;
  video.load();
  video.addEventListener('error', () => {
    console.warn('[mockup] Could not load the scare video at', CONFIG.VIDEO_SRC);
  });

  // Auto mode starts a dozen copies of the clip. Download it once while the visitor
  // looks around, and point every copy at that single in-memory file.
  let clipUrl = CONFIG.VIDEO_SRC;
  if (CONFIG.AUTO_AFTER_MS > 0) {
    fetch(CONFIG.VIDEO_SRC)
      .then((res) => (res.ok ? res.blob() : Promise.reject(res.status)))
      .then((blob) => { clipUrl = URL.createObjectURL(blob); })
      .catch(() => {}); // fall back to streaming each copy from the server
  }

  // Auto mode starts after AUTO_AFTER_MS without a click. Only clicks reset the countdown.
  let autoTimer = 0;
  function restartAutoTimer() {
    clearTimeout(autoTimer);
    if (CONFIG.AUTO_AFTER_MS > 0) autoTimer = setTimeout(startAuto, CONFIG.AUTO_AFTER_MS);
  }
  restartAutoTimer();

  async function start(thumb) {
    state = 'intro';
    clearTimeout(autoTimer);

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
        // The first frame lands here; the hold is timed from this moment, so the
        // rest of the glitch plays over the already-running clip.
        thumb.classList.add('playing');
        thumb.append(video);
        if (badge) badge.remove();
        state = 'frozen';
        setTimeout(() => {
          state = 'playing';
          video.play().catch((err) => console.warn('[mockup] play() failed', err));
          watchForCrash();
        }, CONFIG.FREEZE_MS);
      },
    });
  }

  // ------------------------------------------------------------ auto mode
  // Every thumbnail on screen glitches into the clip, one after another. The first one
  // gets the main video element; when it hits CRASH_AT the usual crash sequence follows.
  // Thumbnails scrolled into view later join the wave.
  const converted = new Set();
  let nextSlot = 0;
  let observer = null;
  let heroTaken = false;

  function startAuto() {
    if (state !== 'idle') return;
    state = 'auto';
    if (navigator.userActivation && navigator.userActivation.hasBeenActive) unlockAudio();

    const inView = (el) => {
      const r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < innerHeight;
    };
    cards
      .filter((c) => inView(c.thumb))
      .sort((a, b) => a.thumb.getBoundingClientRect().top - b.thumb.getBoundingClientRect().top
        || a.thumb.getBoundingClientRect().left - b.thumb.getBoundingClientRect().left)
      .forEach((c) => queueTile(c.thumb));

    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) queueTile(entry.target);
    });
    cards.forEach((c) => observer.observe(c.thumb));
  }

  function queueTile(thumb) {
    if (converted.has(thumb) || state !== 'auto') return;
    converted.add(thumb);
    const now = performance.now();
    const at = Math.max(now, nextSlot);
    nextSlot = at + CONFIG.AUTO_STAGGER_MS;
    setTimeout(() => convertTile(thumb), at - now);
  }

  async function convertTile(thumb) {
    if (state !== 'auto') return;
    // Claimed synchronously: the element only moves into the tile mid-glitch.
    const isHero = !heroTaken;
    heroTaken = true;
    let clip = video;
    if (isHero) {
      // Sound only if the visitor already interacted with the page (e.g. a scroll key).
      const mayPlaySound = navigator.userActivation && navigator.userActivation.hasBeenActive;
      video.muted = !mayPlaySound;
      video.currentTime = 0;
    } else {
      clip = document.createElement('video');
      clip.src = clipUrl;
      clip.poster = CONFIG.POSTER_SRC;
      clip.muted = true;
      clip.playsInline = true;
      clip.preload = 'auto';
    }

    const img = thumb.querySelector('img');
    const badge = thumb.querySelector('.badge');
    await glitch({
      ms: CONFIG.AUTO_GLITCH_MS,
      rect: () => thumb.getBoundingClientRect(),
      source: (t) => (t < 0.45 ? img : Math.random() < 0.3 ? img : clip),
      intensity: 0.8,
      onMid: () => {
        thumb.classList.add('playing');
        thumb.append(clip);
        if (badge) badge.remove();
        setTimeout(() => {
          if (state !== 'auto') return;
          clip.play().catch(() => {
            // Unmuted autoplay refused: fall back to a silent start.
            if (!clip.muted) {
              clip.muted = true;
              clip.play().catch(() => {});
            }
          });
          if (isHero) watchForCrash();
        }, CONFIG.AUTO_FREEZE_MS);
      },
    });
  }

  function watchForCrash() {
    const tick = () => {
      if (state !== 'playing' && state !== 'auto') return;
      if (video.currentTime >= CONFIG.CRASH_AT || video.ended) {
        takeover();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  async function takeover() {
    state = 'takeover';
    if (observer) observer.disconnect();
    if (document.activeElement) document.activeElement.blur();
    root.classList.add('locked');
    // All clips (auto mode has many) pause together, so none of them reaches the creepy
    // cut before the full-screen reveal.
    const clips = [...document.querySelectorAll('.thumb video')];
    const pauseAll = () => clips.forEach((v) => v.pause());
    const playAll = () => clips.forEach((v) => v.play().catch(() => {}));
    const tileRect = () => video.parentElement.getBoundingClientRect();

    // 1. The tile breaks up.
    pauseAll();
    glitchSound(CONFIG.CRASH_GLITCH_MS);
    await glitch({ ms: CONFIG.CRASH_GLITCH_MS, source: () => video, rect: tileRect, intensity: 1.6 });

    // 2. Chrome crash page, until it times out or the visitor clicks.
    //    That click also counts as the gesture that unlocks sound (see onGesture).
    drawCrashPage();
    screenEl.style.display = 'block';
    const stopHover = crashPageHover();
    await clickOrTimeout(CONFIG.ERROR_MS);
    stopHover();

    // 3. Glitch back to the page; the tile carries on with the cute part.
    glitchSound(CONFIG.BACK_GLITCH_MS);
    await glitch({
      ms: CONFIG.BACK_GLITCH_MS,
      source: (t) => (t < 0.5 ? screenEl : video),
      rect: (t) => (t < 0.5 ? fullRect() : tileRect()),
      intensity: 1.4,
      onMid: () => {
        screenEl.style.display = 'none';
        playAll();
      },
    });
    await untilClipTime(CONFIG.REBOOT_AT);
    pauseAll();

    // 4. Glitch into the Google loading screen.
    glitchSound(CONFIG.LOADING_GLITCH_MS);
    await glitch({
      ms: CONFIG.LOADING_GLITCH_MS,
      source: (t) => (t < 0.5 ? video : screenEl),
      rect: (t) => (t < 0.5 ? tileRect() : fullRect()),
      intensity: 1.4,
      onMid: () => {
        drawLoading(0, 0);
        screenEl.style.display = 'block';
      },
    });

    // 5. Google loading screen. Meanwhile the hidden clip seeks to just before the cut, so
    //    it can start the instant the loading screen goes away.
    video.currentTime = Math.max(0, CONFIG.CUT_AT - CONFIG.REVEAL_FRAMES / CONFIG.CLIP_FPS);
    const t0 = performance.now();
    await new Promise((resolve) => {
      const tick = (now) => {
        const t = Math.min(1, (now - t0) / CONFIG.LOADING_MS);
        drawLoading(t, now - t0);
        if (t < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });

    // 6. Glitch out of the loading screen, then the clip at full screen, clean: only
    //    REVEAL_FRAMES cute frames, then the hard cut to creepy.
    glitchSound(CONFIG.TAKEOVER_GLITCH_MS);
    await glitch({ ms: CONFIG.TAKEOVER_GLITCH_MS, source: () => screenEl, rect: fullRect, intensity: 1.6 });
    // Reveal on the first frame playback actually presents, so the paused frame isn't
    // shown any longer than one frame.
    const reveal = () => {
      root.classList.add('takeover');
      screenEl.style.display = 'none';
      if (CONFIG.MORPH_SWELL) morphSwell(Math.max(0.05, CONFIG.CUT_AT - video.currentTime));
    };
    if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(reveal);
    else video.addEventListener('playing', reveal, { once: true });
    video.play().catch(reveal);
    onFrameAt(CONFIG.CUT_AT, cutHit);
  }

  // Call `fn` as the first frame at or after clip time `seconds` is presented.
  function onFrameAt(seconds, fn) {
    if (!video.requestVideoFrameCallback) {
      untilClipTime(seconds).then(fn);
      return;
    }
    const check = (now, meta) => {
      if (meta.mediaTime >= seconds - 0.001) fn();
      else video.requestVideoFrameCallback(check);
    };
    video.requestVideoFrameCallback(check);
  }

  // 7. The cute -> creepy frame: the horror stinger and the violent visual hit.
  function cutHit() {
    morphStinger();
    glitch({ ms: CONFIG.MORPH_FX_MS, draw: drawMorph });
  }

  function clickOrTimeout(ms) {
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        removeEventListener('pointerdown', done, true);
        resolve();
      };
      const timer = setTimeout(done, ms);
      addEventListener('pointerdown', done, true);
    });
  }

  function untilClipTime(seconds) {
    return new Promise((resolve) => {
      const tick = () => {
        if (video.currentTime >= seconds || video.ended || video.paused) resolve();
        else requestAnimationFrame(tick);
      };
      tick();
    });
  }

  // ------------------------------------------------------- fake system screens
  const UI_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  const googleLogo = new Image();
  googleLogo.src = 'data:image/svg+xml,' + encodeURIComponent(window.ICONS.logo);

  function wrapLines(text, maxWidth) {
    const lines = [];
    let line = '';
    for (const word of text.split(' ')) {
      const next = line ? line + ' ' + word : word;
      if (line && sctx.measureText(next).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  // Clickable areas of the crash page, filled in by drawCrashPage.
  const crashTargets = { learn: null, reload: null };
  const shield = $('#shield');

  // While the crash page is up the cursor comes back, and the link and the button react
  // to hover like the real ones. Returns a function that ends it.
  function crashPageHover() {
    root.classList.add('show-cursor');
    let hover = null;
    const hit = (r, x, y) => r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    const onMove = (e) => {
      const next = hit(crashTargets.reload, e.clientX, e.clientY) ? 'reload'
        : hit(crashTargets.learn, e.clientX, e.clientY) ? 'learn' : null;
      if (next === hover) return;
      hover = next;
      shield.classList.toggle('over-cta', !!hover);
      drawCrashPage(hover);
    };
    addEventListener('pointermove', onMove, true);
    return () => {
      removeEventListener('pointermove', onMove, true);
      root.classList.remove('show-cursor');
      shield.classList.remove('over-cta');
    };
  }

  // Chrome's crashed-tab page ("Aw, Snap!"). `hover` is 'learn', 'reload' or null.
  function drawCrashPage(hover = null) {
    const w = innerWidth;
    const h = innerHeight;
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sctx.fillStyle = '#fff';
    sctx.fillRect(0, 0, w, h);

    const colW = Math.min(600, w - 48);
    const x = (w - colW) / 2;
    let y = Math.max(40, h * 0.22);

    // Sad-tab icon: a page with a folded corner and a frowning face.
    const s = 72 / 24;
    sctx.save();
    sctx.translate(x, y);
    sctx.scale(s, s);
    sctx.strokeStyle = '#5f6368';
    sctx.fillStyle = '#5f6368';
    sctx.lineWidth = 1.6;
    sctx.lineJoin = 'round';
    sctx.lineCap = 'round';
    sctx.beginPath();
    sctx.moveTo(4, 2); sctx.lineTo(14, 2); sctx.lineTo(20, 8); sctx.lineTo(20, 22); sctx.lineTo(4, 22); sctx.closePath();
    sctx.moveTo(14, 2); sctx.lineTo(14, 8); sctx.lineTo(20, 8);
    sctx.stroke();
    for (const ex of [9, 15]) {
      sctx.beginPath();
      sctx.moveTo(ex - 1.3, 11.2); sctx.lineTo(ex + 1.3, 13.8);
      sctx.moveTo(ex + 1.3, 11.2); sctx.lineTo(ex - 1.3, 13.8);
      sctx.stroke();
    }
    sctx.beginPath();
    sctx.arc(12, 20.2, 3.4, Math.PI * 1.2, Math.PI * 1.8);
    sctx.stroke();
    sctx.restore();
    y += 72 + 40;

    sctx.textAlign = 'left';
    sctx.textBaseline = 'top';
    sctx.fillStyle = '#202124';
    sctx.font = `500 ${w < 500 ? 22 : 26}px ${UI_FONT}`;
    sctx.fillText('Aw, Snap!', x, y);
    y += 50;

    sctx.fillStyle = '#5f6368';
    sctx.font = `15px ${UI_FONT}`;
    for (const line of wrapLines('Something went wrong while displaying this webpage.', colW)) {
      sctx.fillText(line, x, y);
      y += 22;
    }
    y += 12;
    sctx.font = `12px ${UI_FONT}`;
    sctx.fillText('Error code: STATUS_ACCESS_VIOLATION', x, y);
    y += 56;

    // "Learn more" link on the left, blue Reload button on the right.
    sctx.fillStyle = '#1a73e8';
    sctx.font = `500 14px ${UI_FONT}`;
    sctx.textBaseline = 'middle';
    sctx.fillText('Learn more', x, y + 18);
    const learnW = sctx.measureText('Learn more').width;
    crashTargets.learn = { x, y: y + 6, w: learnW, h: 24 };
    if (hover === 'learn') sctx.fillRect(x, y + 27, learnW, 1);
    const btnW = 82;
    const bx = x + colW - btnW;
    crashTargets.reload = { x: bx, y, w: btnW, h: 36 };
    sctx.fillStyle = hover === 'reload' ? '#1765cc' : '#1a73e8';
    if (hover === 'reload') {
      sctx.shadowColor = 'rgba(60, 64, 67, 0.3)';
      sctx.shadowBlur = 3;
      sctx.shadowOffsetY = 1;
    }
    sctx.beginPath();
    sctx.roundRect(bx, y, btnW, 36, 4);
    sctx.fill();
    sctx.shadowColor = 'transparent';
    sctx.fillStyle = '#fff';
    sctx.textAlign = 'center';
    sctx.fillText('Reload', bx + btnW / 2, y + 18);
  }

  // Google reloading: white page, thin blue progress bar on top, logo and the four
  // bouncing Google dots. `t` is 0..1 through LOADING_MS, `ms` the time elapsed.
  function drawLoading(t, ms) {
    const w = innerWidth;
    const h = innerHeight;
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sctx.fillStyle = '#fff';
    sctx.fillRect(0, 0, w, h);

    // Progress bar that crawls but never quite finishes.
    sctx.fillStyle = '#1a73e8';
    sctx.fillRect(0, 0, w * (0.08 + 0.8 * (1 - (1 - t) ** 2)), 3);

    const logoW = Math.min(272, w * 0.6);
    const logoH = logoW * (30 / 92);
    const cy = h * 0.42;
    if (googleLogo.naturalWidth) sctx.drawImage(googleLogo, (w - logoW) / 2, cy - logoH, logoW, logoH);

    const colors = ['#4285f4', '#ea4335', '#fbbc05', '#34a853'];
    const gap = 22;
    colors.forEach((color, i) => {
      const bounce = Math.abs(Math.sin(ms / 260 - i * 0.55)) * 12;
      sctx.fillStyle = color;
      sctx.beginPath();
      sctx.arc(w / 2 + (i - 1.5) * gap, cy + 52 - bounce, 6, 0, Math.PI * 2);
      sctx.fill();
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

  // ----------------------------------------------------------- morph sound
  const noiseBuffer = (seconds, channels = 1) => {
    const buf = audio.createBuffer(channels, Math.ceil(audio.sampleRate * seconds), audio.sampleRate);
    for (let c = 0; c < channels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return buf;
  };

  // Breath sucked in backwards during the last cute moment, cut dead on the morph.
  function morphSwell(seconds) {
    if (!audio) return;
    const now = audio.currentTime;
    const end = now + seconds;
    const out = audio.createGain();
    out.gain.value = CONFIG.MORPH_VOLUME;
    out.connect(audio.destination);

    const src = audio.createBufferSource();
    src.buffer = noiseBuffer(seconds + 0.05, 2);
    const bp = audio.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(350, now);
    bp.frequency.exponentialRampToValueAtTime(4200, end);
    const g = audio.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.7, end);
    g.gain.setValueAtTime(0, end);
    src.connect(bp).connect(g).connect(out);

    const rumble = audio.createOscillator();
    rumble.frequency.setValueAtTime(38, now);
    rumble.frequency.exponentialRampToValueAtTime(70, end);
    const rg = audio.createGain();
    rg.gain.setValueAtTime(0.0001, now);
    rg.gain.exponentialRampToValueAtTime(0.5, end);
    rg.gain.setValueAtTime(0, end);
    rumble.connect(rg).connect(out);

    src.start(now);
    src.stop(end + 0.01);
    rumble.start(now);
    rumble.stop(end + 0.01);
  }

  // The jump-scare stinger: impact + sub boom, a dissonant cluster with screeching
  // Psycho-style high strings sliding up, a demonic growl underneath, all in a big reverb.
  function morphStinger() {
    if (!audio) return;
    const now = audio.currentTime;
    // Everything, reverb tail included, fades out gently at the end.
    const master = audio.createGain();
    master.gain.setValueAtTime(CONFIG.MORPH_VOLUME, now);
    master.gain.setValueAtTime(CONFIG.MORPH_VOLUME, now + 4.5);
    master.gain.linearRampToValueAtTime(0, now + 7.5);
    const comp = audio.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    master.connect(comp).connect(audio.destination);

    // Big dark hall: stereo noise impulse with an exponential tail.
    const verb = audio.createConvolver();
    const irLen = 3.5;
    const ir = audio.createBuffer(2, Math.ceil(audio.sampleRate * irLen), audio.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    }
    verb.buffer = ir;
    const wet = audio.createGain();
    wet.gain.value = 0.55;
    verb.connect(wet).connect(master);
    const bus = audio.createGain(); // dry + reverb send
    bus.connect(master);
    bus.connect(verb);

    const grit = audio.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(2.5 * (i / 512 - 1));
    grit.curve = curve;
    grit.connect(bus);

    const run = (node, start, stop) => { node.start(start); node.stop(stop); };

    // Impact.
    const hit = audio.createBufferSource();
    hit.buffer = noiseBuffer(0.4, 2);
    const hitLp = audio.createBiquadFilter();
    hitLp.type = 'lowpass';
    hitLp.frequency.setValueAtTime(5000, now);
    hitLp.frequency.exponentialRampToValueAtTime(300, now + 0.3);
    const hitG = audio.createGain();
    hitG.gain.setValueAtTime(1.1, now);
    hitG.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    hit.connect(hitLp).connect(hitG).connect(bus);
    run(hit, now, now + 0.4);

    // Sub boom.
    const boom = audio.createOscillator();
    boom.frequency.setValueAtTime(75, now);
    boom.frequency.exponentialRampToValueAtTime(26, now + 1.4);
    const boomG = audio.createGain();
    boomG.gain.setValueAtTime(1.5, now);
    boomG.gain.exponentialRampToValueAtTime(0.001, now + 2);
    boom.connect(boomG).connect(master);
    run(boom, now, now + 2.1);

    // Dissonant cluster: minor seconds and tritones over three octaves.
    const cluster = [110, 116.54, 155.56, 220, 233.08, 311.13, 329.63, 440, 466.16, 622.25];
    const clusterLp = audio.createBiquadFilter();
    clusterLp.type = 'lowpass';
    clusterLp.frequency.setValueAtTime(9000, now);
    clusterLp.frequency.exponentialRampToValueAtTime(900, now + 2.8);
    const clusterG = audio.createGain();
    clusterG.gain.setValueAtTime(0, now);
    clusterG.gain.linearRampToValueAtTime(0.16, now + 0.005);
    clusterG.gain.exponentialRampToValueAtTime(0.06, now + 0.3);
    clusterG.gain.exponentialRampToValueAtTime(0.001, now + 3.6);
    clusterLp.connect(clusterG).connect(grit);
    for (const f of cluster) {
      const o = audio.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = rand(-14, 14);
      o.connect(clusterLp);
      run(o, now, now + 3.7);
    }

    // Screeching high strings: stabbing, trembling, sliding up two semitones.
    const vib = audio.createOscillator();
    vib.frequency.value = 9;
    run(vib, now, now + 3.3);
    for (const f of [1318.5, 1396.9, 1480]) {
      const o = audio.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, now);
      o.frequency.exponentialRampToValueAtTime(f * 1.12, now + 3);
      const depth = audio.createGain();
      depth.gain.value = f * 0.018;
      vib.connect(depth).connect(o.frequency);
      const bp = audio.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f * 1.5;
      bp.Q.value = 1.5;
      const g = audio.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.09, now + 0.01);
      g.gain.setValueAtTime(0.09, now + 1.2);
      g.gain.exponentialRampToValueAtTime(0.001, now + 3.2);
      o.connect(bp).connect(g).connect(bus);
      run(o, now, now + 3.3);
    }

    // Demonic growl: detuned low saws, sinking, with a fast rattle on the loudness.
    // The rattle sits before the envelope, so the envelope fades it to true silence.
    const growlLp = audio.createBiquadFilter();
    growlLp.type = 'lowpass';
    growlLp.frequency.value = 420;
    const rattleG = audio.createGain();
    rattleG.gain.value = 0.75;
    const rattle = audio.createOscillator();
    rattle.frequency.value = 17;
    const rattleDepth = audio.createGain();
    rattleDepth.gain.value = 0.25;
    rattle.connect(rattleDepth).connect(rattleG.gain);
    const growlG = audio.createGain();
    growlG.gain.setValueAtTime(0, now);
    growlG.gain.linearRampToValueAtTime(0.5, now + 0.12);
    growlG.gain.setValueAtTime(0.5, now + 1.5);
    growlG.gain.exponentialRampToValueAtTime(0.0001, now + 5.5);
    growlLp.connect(rattleG).connect(growlG).connect(grit);
    run(rattle, now, now + 5.6);
    for (const [f, type] of [[46, 'sawtooth'], [46.8, 'sawtooth'], [23, 'square']]) {
      const o = audio.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f, now);
      o.frequency.exponentialRampToValueAtTime(f * 0.75, now + 5.5);
      o.connect(growlLp);
      run(o, now, now + 5.6);
    }
  }

  // ---------------------------------------------------------------- glitch
  let dpr = 1;
  function sizeCanvas() {
    dpr = window.devicePixelRatio || 1;
    fx.width = screenEl.width = Math.round(innerWidth * dpr);
    fx.height = screenEl.height = Math.round(innerHeight * dpr);
  }
  sizeCanvas();

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);
  const fullRect = () => ({ left: 0, top: 0, width: innerWidth, height: innerHeight });

  // A clip that hasn't decoded a frame yet is drawn as its first-frame still.
  function drawable(src) {
    if (src instanceof HTMLVideoElement && !src.videoWidth && poster.naturalWidth) return poster;
    return src;
  }

  function mediaSize(src) {
    if (src instanceof HTMLVideoElement) return [src.videoWidth, src.videoHeight];
    if (src instanceof HTMLCanvasElement) return [src.width, src.height];
    return [src.naturalWidth, src.naturalHeight];
  }

  // Draw `src` into rect r with object-fit: cover.
  function drawCover(src, r, dx = 0, target = ctx) {
    src = drawable(src);
    const [w, h] = mediaSize(src);
    if (!w || !h) {
      target.fillStyle = '#000';
      target.fillRect(r.left + dx, r.top, r.width, r.height);
      return;
    }
    const scale = Math.max(r.width / w, r.height / h);
    const sw = r.width / scale;
    const sh = r.height / scale;
    try {
      target.drawImage(src, (w - sw) / 2, (h - sh) / 2, sw, sh, r.left + dx, r.top, r.width, r.height);
    } catch {
      target.fillStyle = '#000';
      target.fillRect(r.left + dx, r.top, r.width, r.height);
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

  // --------------------------------------------------------- morph visual
  // The cute -> creepy frame: white/red flash and an inverted strobe, a camera punch-in
  // that springs back with shake and roll, RGB channels torn apart, bands ripped
  // sideways, then decaying aftershocks (red flickers, blackouts).
  const channels = [0, 1, 2].map(() => document.createElement('canvas'));
  let morphFrame = 0;

  function rgbSplit(src, d) {
    const w = innerWidth;
    const h = innerHeight;
    const ow = 640;
    const oh = Math.round((ow * h) / w);
    const tints = ['#f00', '#0f0', '#00f'];
    const offsets = [[-d, -d * 0.25], [0, 0], [d, d * 0.35]];
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    channels.forEach((c, i) => {
      if (c.width !== ow || c.height !== oh) { c.width = ow; c.height = oh; }
      const cx = c.getContext('2d');
      cx.globalCompositeOperation = 'source-over';
      drawCover(src, { left: 0, top: 0, width: ow, height: oh }, 0, cx);
      cx.globalCompositeOperation = 'multiply';
      cx.fillStyle = tints[i];
      cx.fillRect(0, 0, ow, oh);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(c, offsets[i][0], offsets[i][1], w, h);
    });
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawMorph(t) {
    const targets = [video, fx];
    if (t >= 1) {
      for (const el of targets) { el.style.transform = ''; el.style.filter = ''; }
      morphFrame = 0;
      return;
    }
    const f = morphFrame++;
    const w = innerWidth;
    const h = innerHeight;
    const k = (1 - t) ** 2; // strength, decaying
    const spike = Math.random() < 0.18 * (1 - t) ? 1 : 0; // random aftershock

    // Camera: punch-in that springs back, shake and roll.
    const scale = 1 + 0.28 * (1 - t) ** 3 + spike * 0.05;
    const tx = rand(-1, 1) * (34 * k + spike * 18);
    const ty = rand(-1, 1) * (24 * k + spike * 12);
    const rot = rand(-1, 1) * (2.4 * k + spike);
    const transform = `translate(${tx}px, ${ty}px) rotate(${rot}deg) scale(${scale})`;
    const strobe = f >= 2 && f < 8 && f % 2 === 1; // after the white and red flash frames
    const filter = strobe
      ? 'invert(1) contrast(2.2)'
      : `contrast(${1 + 0.9 * k + spike * 0.5}) saturate(${1 + 2.2 * k}) brightness(${1 + rand(-0.35, 0.45) * k})`;
    for (const el of targets) { el.style.transform = transform; el.style.filter = filter; }

    // First frames: flash white, then blood red.
    if (f === 0) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); return; }
    if (f === 1) { ctx.fillStyle = '#b00000'; ctx.fillRect(0, 0, w, h); return; }

    // Torn colour channels for most of the effect.
    if (t < 0.7 || spike) rgbSplit(video, 30 * k + 4 + spike * 16);

    // Bands ripped sideways (copied from what was just drawn).
    if (t < 0.55 || spike) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const bands = Math.round(4 + 10 * k);
      for (let i = 0; i < bands; i++) {
        const y = Math.random() * fx.height;
        const bh = rand(4, fx.height * 0.08);
        const dx = rand(-1, 1) * fx.width * 0.12 * (k + spike * 0.5);
        ctx.drawImage(fx, 0, y, fx.width, bh, dx, y, fx.width, bh);
      }
      ctx.restore();
    }

    // Aftershocks: red flickers and blackouts.
    if (Math.random() < 0.3 * k + spike * 0.4) {
      ctx.fillStyle = `rgba(150, 0, 0, ${rand(0.25, 0.6)})`;
      ctx.fillRect(0, 0, w, h);
    } else if (Math.random() < 0.08 * k) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
    }
  }

  // Several glitches can run at once (auto mode); one animation loop draws them all.
  const effects = new Set();
  let looping = false;

  // `draw(t)` replaces the standard glitch frame for effects with their own look.
  function glitch({ ms, rect, source, onMid, draw, intensity = 1 }) {
    return new Promise((resolve) => {
      effects.add({ ms, rect, source, onMid, draw, intensity, resolve, t0: performance.now(), midDone: false });
      if (!looping) {
        looping = true;
        fx.style.display = 'block';
        requestAnimationFrame(drawEffects);
      }
    });
  }

  function drawEffects(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const e of effects) {
      const t = Math.min(1, Math.max(0, now - e.t0) / e.ms);
      if (!e.midDone && t >= 0.5) {
        e.midDone = true;
        if (e.onMid) e.onMid();
      }
      if (t >= 1) {
        if (e.draw) e.draw(1);
        effects.delete(e);
        e.resolve();
        continue;
      }
      if (e.draw) e.draw(t);
      // Some frames show the clean picture underneath, so it stutters rather than strobes.
      else if (Math.random() < 0.8) glitchFrame(e.source(t), e.rect(t), e.intensity);
    }
    if (effects.size) {
      requestAnimationFrame(drawEffects);
    } else {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      fx.style.display = 'none';
      looping = false;
    }
  }
})();
