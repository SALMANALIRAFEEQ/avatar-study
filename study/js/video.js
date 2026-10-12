// Gated video player: no native controls (so no scrubbing), custom play/pause,
// a read-only progress bar, and watch tracking. The flow decides what to do on end.

import { el } from './util.js';
import { icon, iconSvg } from './icons.js';

const cache = new Map(); // src -> <video> already buffering

function makeVideoElement() {
  const v = document.createElement('video');
  v.playsInline = true;                 // stay inline on iPhone instead of native fullscreen
  v.setAttribute('playsinline', '');
  v.setAttribute('webkit-playsinline', '');
  v.disablePictureInPicture = true;
  v.setAttribute('disablepictureinpicture', '');
  v.disableRemotePlayback = true;
  v.setAttribute('controlslist', 'nodownload noplaybackrate noremoteplayback nofullscreen');
  v.preload = 'auto';
  v.addEventListener('contextmenu', (e) => e.preventDefault());
  return v;
}

// Start buffering the next video while the participant is answering questions.
// Best effort: some phones on data saver ignore preload.
export function preloadVideo(src) {
  if (cache.has(src)) return;
  const v = makeVideoElement();
  v.src = src;
  v.load();
  cache.set(src, v);
}

export function preloadImage(src) {
  const img = new Image();
  img.src = src;
}

/**
 * Mount the player into `container`.
 *   metrics      object updated in place: video_duration_s, watch_time_s, watch_completed, pauses, replays
 *   onProgress   called now and then so the caller can persist metrics
 *   onEnded      called each time playback reaches the end
 * Returns { destroy }.
 */
export function mountGatedVideo({ container, src, poster, metrics, onProgress, onEnded }) {
  const video = cache.get(src) || makeVideoElement();
  cache.delete(src);
  if (!video.getAttribute('src')) video.src = src;
  if (poster) video.poster = poster;

  const overlayBtn = el('button', { type: 'button', class: 'overlay-btn' },
    el('span', { class: 'overlay-icon' }, icon('play', { size: 22 })),
    el('span', { class: 'overlay-label' }, 'Play video'));
  const spinner = el('div', { class: 'spinner', 'aria-hidden': 'true' });
  const message = el('p', { class: 'player-message', role: 'status' });
  const overlay = el('div', { class: 'player-overlay' }, overlayBtn, spinner, message);

  const toggleBtn = el('button', { type: 'button', class: 'player-toggle', 'aria-label': 'Play' },
    icon('play', { size: 20 }));
  const setToggleIcon = (name) => { toggleBtn.firstChild.innerHTML = iconSvg(name, 20); };
  const fill = el('div', { class: 'player-track-fill' });
  const track = el('div', { class: 'player-track', 'aria-hidden': 'true' }, fill);
  const time = el('span', { class: 'player-time' }, '0:00');

  container.append(el('div', { class: 'player' },
    el('div', { class: 'video-frame' }, video, overlay),
    el('div', { class: 'player-bar' }, toggleBtn, track, time),
  ));

  const ac = new AbortController();
  const on = (target, type, fn) => target.addEventListener(type, fn, { signal: ac.signal });

  let lastTime = 0;       // for accumulating watched seconds
  let furthest = 0;       // furthest point reached in this playthrough; seeking past it is undone
  let playRequested = false;
  let slowTimer = null;
  let sinceSave = 0;
  let destroyed = false;

  const setState = (s) => { overlay.dataset.state = s; };
  setState(video.readyState >= 1 ? 'ready' : 'loading-idle');
  const showMessage = (t) => { message.textContent = t; message.hidden = !t; };
  showMessage('');

  function play() {
    playRequested = true;
    if (video.ended) return replay();
    if (video.readyState < 3) {
      setState('loading');
      clearTimeout(slowTimer);
      slowTimer = setTimeout(() => {
        if (video.readyState < 3) showMessage('The video is loading slowly. Please wait a moment…');
      }, 8000);
    }
    video.play().catch(() => {
      // Autoplay rules or a load failure. Let them tap again.
      setState('paused');
    });
  }

  function replay() {
    metrics.replays += 1;
    furthest = 0;
    lastTime = 0;
    video.currentTime = 0;
    video.play().catch(() => setState('paused'));
  }

  function fmt(s) {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  }

  on(overlayBtn, 'click', play);
  on(toggleBtn, 'click', () => (video.paused || video.ended ? play() : video.pause()));
  on(video, 'click', () => { if (!video.paused) video.pause(); });

  function onMetadata() {
    metrics.video_duration_s = Math.round(video.duration * 10) / 10;
    time.textContent = `0:00 / ${fmt(video.duration)}`;
    if (!playRequested) setState('ready');
  }
  on(video, 'loadedmetadata', onMetadata);
  // A preloaded video may already have its metadata, so the event won't fire again.
  if (video.readyState >= 1) onMetadata();
  on(video, 'waiting', () => { if (playRequested) setState('loading'); });
  on(video, 'playing', () => {
    clearTimeout(slowTimer);
    showMessage('');
    setState('playing');
    toggleBtn.setAttribute('aria-label', 'Pause');
    setToggleIcon('pause');
  });

  on(video, 'timeupdate', () => {
    const t = video.currentTime;
    const delta = t - lastTime;
    // Only count normal forward playback; ignore jumps (seeks, replays).
    if (!video.seeking && delta > 0 && delta < 1.5) {
      metrics.watch_time_s += delta;
      sinceSave += delta;
    }
    lastTime = t;
    furthest = Math.max(furthest, t);
    if (video.duration) {
      fill.style.width = `${Math.min(100, (t / video.duration) * 100)}%`;
      time.textContent = `${fmt(t)} / ${fmt(video.duration)}`;
    }
    if (sinceSave > 5) { sinceSave = 0; onProgress?.(); }
  });

  // There are no seek controls, but some browsers still offer them (e.g. fullscreen
  // on iOS, keyboard shortcuts). Undo any jump forward past what was watched.
  on(video, 'seeking', () => {
    if (video.currentTime > furthest + 0.5) video.currentTime = furthest;
    lastTime = video.currentTime;
  });

  on(video, 'pause', () => {
    toggleBtn.setAttribute('aria-label', 'Play');
    setToggleIcon('play');
    if (video.ended || destroyed) return; // the end of the video also fires 'pause'
    metrics.pauses += 1;
    setState('paused');
    overlayBtn.querySelector('.overlay-label').textContent = 'Continue watching';
    overlayBtn.querySelector('.overlay-icon').innerHTML = iconSvg('play', 22);
    onProgress?.();
  });

  on(video, 'ended', () => {
    metrics.watch_completed = true;
    fill.style.width = '100%';
    setState('ended');
    overlayBtn.querySelector('.overlay-label').textContent = 'Watch again';
    overlayBtn.querySelector('.overlay-icon').innerHTML = iconSvg('replay', 22);
    toggleBtn.setAttribute('aria-label', 'Watch again');
    setToggleIcon('replay');
    onProgress?.();
    onEnded?.();
  });

  on(video, 'error', () => {
    clearTimeout(slowTimer);
    setState('error');
    showMessage('The video could not be loaded. Please check your connection and try again.');
    overlayBtn.querySelector('.overlay-label').textContent = 'Try again';
    playRequested = false;
    // Retrying: reload the source from where we were.
    overlayBtn.addEventListener('click', () => {
      const at = furthest;
      showMessage('');
      video.load();
      video.addEventListener('loadedmetadata', () => { video.currentTime = at; }, { once: true });
    }, { once: true, signal: ac.signal });
  });

  // Phones pause media when the tab is hidden anyway; doing it ourselves keeps the count honest.
  on(document, 'visibilitychange', () => {
    if (document.hidden && !video.paused) video.pause();
  });

  return {
    destroy() {
      destroyed = true;
      clearTimeout(slowTimer);
      ac.abort();
      video.pause();
      video.removeAttribute('src');
      video.load(); // frees the network connection and decoder
    },
  };
}
