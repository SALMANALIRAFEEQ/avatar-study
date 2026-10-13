// Boot: load config, restore or create participant state, start the flow.

import { uuidv4, nowIso, deviceClass, el } from './util.js';
import { loadProgress, clearProgress, getCompleted, clearCompleted, flushOutbox } from './storage.js';
import { assignSequence } from './assign.js';
import { startFlow } from './flow.js';

const root = document.getElementById('app');

function fatal(message, detail) {
  root.replaceChildren(el('h1', {}, 'Something went wrong'), el('p', {}, message));
  if (detail) root.append(el('pre', { class: 'error-detail' }, detail));
}

// Catch config mistakes (e.g. a sequence pointing at a video that isn't listed)
// before a participant hits them halfway through.
function validateConfig(c) {
  const problems = [];
  for (const key of ['app_version', 'conditions', 'products', 'videos', 'sequences', 'sound_check', 'scales', 'consent', 'blocks', 'debrief']) {
    if (!c[key]) problems.push(`missing "${key}"`);
  }
  if (problems.length) return problems;
  for (const [sid, steps] of Object.entries(c.sequences)) {
    steps.forEach((s, i) => {
      if (!c.conditions[s.condition]) problems.push(`${sid} step ${i + 1}: unknown condition "${s.condition}"`);
      if (!c.products[s.product]) problems.push(`${sid} step ${i + 1}: unknown product "${s.product}"`);
      if (!c.videos[`${s.product}_${s.condition}`]) problems.push(`${sid} step ${i + 1}: no video "${s.product}_${s.condition}"`);
    });
  }
  for (const sb of c.blocks.RATING?.subblocks || []) {
    if (!c.scales[sb.scale]) problems.push(`RATING ${sb.id}: unknown scale "${sb.scale}"`);
  }
  for (const [bid, b] of Object.entries(c.blocks)) {
    for (const it of b.items || []) {
      if (it.other && !(it.other.id && it.options?.[it.other.index] !== undefined)) {
        problems.push(`${bid} ${it.id}: "other" needs an id and a valid option index`);
      }
    }
    // Every item must be on exactly one page, or it would never be asked.
    if (b.pages) {
      const onPages = b.pages.flatMap((pg) => pg.items);
      for (const it of b.items) {
        const n = onPages.filter((id) => id === it.id).length;
        if (n !== 1) problems.push(`${bid}: item ${it.id} is on ${n} pages (must be exactly 1)`);
      }
      for (const id of onPages) {
        if (!b.items.some((it) => it.id === id)) problems.push(`${bid}: page lists unknown item ${id}`);
      }
    }
  }
  return problems;
}

function newState(config, debug) {
  return {
    participant_id: uuidv4(),
    app_version: config.app_version,
    is_test: debug,
    started_at: nowIso(),
    consented_at: null,
    submitted_at: null,
    sequence_id: null,
    assignment_method: null,
    device_class: deviceClass(),
    sound_check_attempts: 0,
    sound_check_passed: false,
    answers: {},     // DEMO and CMP answers
    videos: [],      // one entry per video position, filled at consent
    orders: {},      // shuffled item orders, keyed by screen
    screen: 0,
    completion_code: null,
    saved: false,
  };
}

async function boot() {
  const params = new URLSearchParams(location.search);
  const debug = params.get('debug') === '1';
  if (debug) document.documentElement.classList.add('debug');

  let config;
  try {
    const res = await fetch('config/study.config.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    config = await res.json();
  } catch (err) {
    fatal('The study could not be loaded. Please check your internet connection and reload the page.', debug ? String(err) : null);
    return;
  }

  const problems = validateConfig(config);
  if (problems.length) {
    fatal('The study is not set up correctly. Please contact the researcher.', problems.join('\n'));
    return;
  }

  if (config.study_title) {
    document.getElementById('brand-name').textContent = config.study_title;
    document.title = config.study_title;
  }

  // Resend any finished run a previous visit couldn't deliver (runs in the background).
  flushOutbox(config);

  if (debug && params.get('reset') === '1') { clearProgress(); clearCompleted(); }

  // Resume an unfinished run, but never mix a debug run with a real one.
  let state = loadProgress(config.app_version);
  if (state && state.is_test !== debug) state = null;

  if (!state && !debug) {
    const done = getCompleted();
    if (done) {
      root.replaceChildren(
        el('h1', {}, 'Thank you'),
        el('p', {}, 'You have already taken part in this study from this device.'),
        done.completion_code && el('div', { class: 'code-box' },
          el('span', { class: 'code-label' }, 'Your completion code'),
          el('span', { class: 'code-value' }, done.completion_code)),
      );
      return;
    }
  }

  if (!state) state = newState(config, debug);

  // Ask for a sequence in the background while they read the consent page.
  const assignmentPromise = state.sequence_id
    ? Promise.resolve({ sequence_id: state.sequence_id, assignment_method: state.assignment_method })
    : assignSequence(config, { debug, forcedSequence: params.get('seq') });

  startFlow({ config, state, debug, assignmentPromise });
}

boot();
