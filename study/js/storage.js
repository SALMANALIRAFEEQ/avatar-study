// Payload building and saving.
// With an Apps Script URL in the config, runs are POSTed there (with retries, and an
// "outbox" in localStorage for anything that couldn't be sent). Without one, runs are
// kept in this browser only (local testing).

import { secondsBetween } from './util.js';

const PROGRESS_KEY = 'avatar_study_progress_v1';
const COMPLETED_KEY = 'avatar_study_completed_v1';
const LOCAL_RESULTS_KEY = 'avatar_study_local_results_v1';
const OUTBOX_KEY = 'avatar_study_outbox_v1';
const RETRY_DELAYS_MS = [0, 2000, 6000]; // 3 tries with backoff
const PROGRESS_MAX_AGE_MS = 12 * 60 * 60 * 1000; // stale runs are discarded, not resumed

export function isEndpointConfigured(config) {
  return /^https:\/\/script\.google\.com\//.test(config.endpoint_url || '');
}

// localStorage can throw (private mode, storage full); never let that break the study.
function readJson(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
function remove(key) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

// ---- In-progress state (so a reload or Android tab discard doesn't lose a run) ----

export function saveProgress(state) {
  writeJson(PROGRESS_KEY, { ...state, saved_at: Date.now() });
}

export function loadProgress(appVersion) {
  const s = readJson(PROGRESS_KEY);
  if (!s || s.app_version !== appVersion || Date.now() - s.saved_at > PROGRESS_MAX_AGE_MS) return null;
  return s;
}

export function clearProgress() { remove(PROGRESS_KEY); }

export function markCompleted(state) {
  writeJson(COMPLETED_KEY, {
    participant_id: state.participant_id,
    completion_code: state.completion_code,
    is_test: state.is_test,
  });
}
export function getCompleted() { return readJson(COMPLETED_KEY); }
export function clearCompleted() { remove(COMPLETED_KEY); }

// ---- Payload, exactly per docs/DATA_SCHEMA.md ----

function ratingItems(config) {
  return config.blocks.RATING.subblocks.flatMap((sb) => sb.items);
}

export function buildPayload(state, config) {
  const attItems = ratingItems(config).filter((it) => it.correct !== undefined);
  const perVideoItems = ratingItems(config).filter((it) => it.correct === undefined);

  // Attention check answers are stored once, on the participant row.
  const att = {};
  for (const it of attItems) {
    const v = state.videos.map((vd) => vd.answers[it.id]).find((x) => x !== undefined);
    att[it.id] = v ?? null;
  }
  const attPassed = attItems.every((it) => att[it.id] === it.correct);

  const participant = {
    participant_id: state.participant_id,
    app_version: state.app_version,
    is_test: state.is_test,
    started_at: state.started_at,
    consented_at: state.consented_at,
    submitted_at: state.submitted_at,
    total_duration_s: secondsBetween(state.consented_at, state.submitted_at),
    sequence_id: state.sequence_id,
    assignment_method: state.assignment_method,
    device_class: state.device_class,
    sound_check_attempts: state.sound_check_attempts,
    sound_check_passed: state.sound_check_passed,
  };
  // Each item is one column; an "Other" write-in gets its own column right after it.
  const addBlock = (items) => {
    for (const it of items) {
      participant[it.id] = state.answers[it.id] ?? (it.type === 'text' ? '' : null);
      if (it.other) participant[it.other.id] = state.answers[it.other.id] ?? '';
    }
  };
  addBlock(config.blocks.DEMO.items);
  Object.assign(participant, att, { att_passed: attPassed });
  addBlock(config.blocks.CMP.items);
  participant.completion_code = state.completion_code;

  const responses = state.videos.map((vd) => {
    const row = {
      participant_id: state.participant_id,
      is_test: state.is_test,
      sequence_id: state.sequence_id,
      position: vd.position,
      condition: vd.condition,
      product: vd.product,
      video_file: vd.video_file.split('/').pop(),
      video_duration_s: vd.video_duration_s,
      watch_time_s: Math.round(vd.watch_time_s * 10) / 10,
      watch_completed: vd.watch_completed,
      pauses: vd.pauses,
      replays: vd.replays,
      block_started_at: vd.block_started_at,
      block_submitted_at: vd.block_submitted_at,
      item_order: vd.item_order.join(','),
    };
    for (const it of perVideoItems) row[it.id] = vd.answers[it.id] ?? null;
    return row;
  });

  return { participant, responses };
}

// ---- Saving ----

export async function submitPayload(payload, config) {
  if (!isEndpointConfigured(config)) {
    // Local mode: keep every finished run in this browser so it can be inspected/downloaded.
    const all = readJson(LOCAL_RESULTS_KEY) || [];
    all.push(payload);
    if (!writeJson(LOCAL_RESULTS_KEY, all)) throw new Error('Could not save locally (storage full or blocked).');
    return { ok: true, participant_id: payload.participant.participant_id, local: true };
  }

  // Into the outbox first, so the run survives even if the page is closed mid-request.
  addToOutbox(payload);
  let lastError;
  for (const delay of RETRY_DELAYS_MS) {
    if (delay) await sleep(delay);
    try {
      const res = await postJson(config.endpoint_url, payload);
      if (res.ok && res.participant_id === payload.participant.participant_id) {
        removeFromOutbox(payload.participant.participant_id);
        return res;
      }
      lastError = new Error('Server did not confirm the save');
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

// text/plain avoids the CORS preflight that Apps Script can't answer.
async function postJson(url, data) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000); // Apps Script can be slow on mobile data
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(data),
      signal: ctrl.signal,
    });
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Outbox: runs finished but not yet confirmed by the server ----

function addToOutbox(payload) {
  const box = (readJson(OUTBOX_KEY) || []).filter((p) => p.participant.participant_id !== payload.participant.participant_id);
  box.push(payload);
  writeJson(OUTBOX_KEY, box);
}

function removeFromOutbox(id) {
  writeJson(OUTBOX_KEY, (readJson(OUTBOX_KEY) || []).filter((p) => p.participant.participant_id !== id));
}

// Called on every page load: resend anything a previous visit couldn't deliver.
// The server ignores duplicates, so resending a run that did arrive is harmless.
export async function flushOutbox(config) {
  if (!isEndpointConfigured(config)) return;
  for (const payload of readJson(OUTBOX_KEY) || []) {
    try {
      const res = await postJson(config.endpoint_url, payload);
      if (res.ok) removeFromOutbox(payload.participant.participant_id);
    } catch { /* try again next load */ }
  }
}

// ---- Partials: a small "got as far as screen N" marker when someone leaves early ----

let lastPartialScreen = -1;

export function sendPartial(state, config, screenType, totalScreens) {
  if (!isEndpointConfigured(config) || !state.consented_at || state.saved) return;
  if (state.screen === lastPartialScreen || !navigator.sendBeacon) return; // once per screen is enough
  lastPartialScreen = state.screen;
  const body = JSON.stringify({
    kind: 'partial',
    participant_id: state.participant_id,
    app_version: state.app_version,
    is_test: state.is_test,
    sequence_id: state.sequence_id,
    last_screen: state.screen,
    last_screen_type: screenType,
    total_screens: totalScreens,
    started_at: state.started_at,
    consented_at: state.consented_at,
    sent_at: new Date().toISOString(),
    device_class: state.device_class,
  });
  navigator.sendBeacon(config.endpoint_url, new Blob([body], { type: 'text/plain;charset=utf-8' }));
}

export function getLocalResults() { return readJson(LOCAL_RESULTS_KEY) || []; }
export function clearLocalResults() { remove(LOCAL_RESULTS_KEY); }
