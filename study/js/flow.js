// Screen sequence and navigation. All participant state lives in one object
// (`state`) that is saved to localStorage after every step, so a reload resumes
// where the participant was instead of losing the run.

import { saveProgress, clearProgress, getLocalResults, clearLocalResults, clearCompleted, sendPartial } from './storage.js';
import { screens as renderers, visibleSubblocks } from './screens.js';
import { toast, el } from './util.js';

// consent → sound check → about you → (video → rating screens) × N → comparison → saving → debrief
export function buildScreenList(config, state) {
  const list = [{ type: 'consent' }, { type: 'soundcheck' }, { type: 'block', block: 'DEMO' }];
  state.videos.forEach((vd, index) => {
    list.push({ type: 'video', index });
    const subs = visibleSubblocks(config, vd.position);
    subs.forEach((sb, j) => list.push({
      type: 'rating', index, sub: sb.id, part: j + 1, parts: subs.length, last: j === subs.length - 1,
    }));
  });
  list.push({ type: 'block', block: 'CMP' }, { type: 'saving' }, { type: 'debrief' });
  return list;
}

export function startFlow({ config, state, debug, assignmentPromise }) {
  const root = document.getElementById('app');
  const progressBar = document.querySelector('.progress');
  const progressFill = document.getElementById('progress-fill');
  const stepLabel = document.getElementById('step-label');
  let current = null; // { destroy? } returned by the active screen

  const ctx = {
    config,
    state,
    debug,
    assignmentPromise,
    list: buildScreenList(config, state),
    persist: () => saveProgress(state),
    next: () => show(state.screen + 1),
    rebuild() { ctx.list = buildScreenList(config, state); },
    enableBackGuard,
  };

  function show(index) {
    current?.destroy?.();
    current = null;
    state.screen = index;
    ctx.persist();

    const screen = ctx.list[index];
    root.replaceChildren();
    root.dataset.screen = screen.type;
    stepLabel.textContent = labelFor(screen, config, state);
    // Restart the fade-in animation for each new screen.
    root.classList.remove('screen-enter');
    void root.offsetWidth;
    root.classList.add('screen-enter');
    window.scrollTo(0, 0);
    root.focus({ preventScroll: true });

    // Progress bar only counts screens the participant works through.
    const pct = Math.round((index / (ctx.list.length - 1)) * 100);
    progressFill.style.width = `${pct}%`;
    progressBar.setAttribute('aria-valuenow', String(pct));

    current = renderers[screen.type](root, screen, ctx) || null;
    if (debug) renderDebugPanel(ctx, screen);
  }

  // After consent, the browser back button would throw the participant out of the
  // study. Keep them on the page and explain instead.
  let guardOn = false;
  function enableBackGuard() {
    if (guardOn) return;
    guardOn = true;
    history.pushState({ studyGuard: true }, '');
    window.addEventListener('popstate', () => {
      history.pushState({ studyGuard: true }, '');
      toast('Going back is not possible in this study. Please use the buttons on the page.');
    });
  }
  if (state.consented_at) enableBackGuard();

  // Record where people drop out. pagehide covers closing the tab; visibilitychange
  // covers switching apps on a phone, which is often the last event we get.
  const reportLeave = () => sendPartial(state, config, ctx.list[state.screen]?.type || '');
  window.addEventListener('pagehide', reportLeave);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reportLeave(); });

  show(state.screen || 0);
}

// Short "where am I" label for the header.
function labelFor(screen, config, state) {
  const n = state.videos.length;
  switch (screen.type) {
    case 'consent': return 'Welcome';
    case 'soundcheck': return 'Sound check';
    case 'block': {
      const b = config.blocks[screen.block];
      return b.nav_label || b.title;
    }
    case 'video': return `Video ${screen.index + 1} of ${n}`;
    case 'rating': return `Video ${screen.index + 1} · Questions`;
    default: return 'Finish';
  }
}

let debugCollapsed = false;

function renderDebugPanel(ctx, screen) {
  const panel = document.getElementById('debug-panel');
  const { state } = ctx;
  const results = getLocalResults();
  const seq = state.sequence_id
    ? `${state.sequence_id} (${state.assignment_method}): ` +
      state.videos.map((v) => `${v.product}/${v.condition}`).join(' → ')
    : 'not assigned yet';

  panel.hidden = false;
  panel.classList.toggle('collapsed', debugCollapsed);
  panel.replaceChildren(
    el('button', {
      type: 'button',
      class: 'debug-title',
      onclick: () => { debugCollapsed = !debugCollapsed; panel.classList.toggle('collapsed', debugCollapsed); },
    }, 'DEBUG · is_test=true (tap to hide/show)'),
    el('div', {}, `Sequence: ${seq}`),
    el('div', {}, `Screen ${state.screen + 1}/${ctx.list.length}: ${screen.type}${screen.sub ? ' ' + screen.sub : ''}${screen.block ? ' ' + screen.block : ''}`),
    el('div', { class: 'debug-actions' },
      el('button', { type: 'button', onclick: () => { clearProgress(); location.reload(); } }, 'New participant'),
      el('button', {
        type: 'button',
        disabled: results.length === 0,
        onclick: () => downloadJson(results, `local_results_${Date.now()}.json`),
      }, `Download saved (${results.length})`),
      el('button', {
        type: 'button',
        disabled: results.length === 0,
        onclick: () => { if (confirm('Delete all locally saved results in this browser?')) { clearLocalResults(); clearCompleted(); renderDebugPanel(ctx, screen); } },
      }, 'Clear saved'),
    ),
  );
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
