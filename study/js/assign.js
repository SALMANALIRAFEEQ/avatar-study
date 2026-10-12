// Counterbalanced sequence assignment.
// Normal case: ask the Apps Script for the next sequence (completed count mod N).
// If that is not set up yet or fails, pick at random and record that we did.

import { randomInt } from './util.js';
import { isEndpointConfigured } from './storage.js';

const TIMEOUT_MS = 6000;

export async function assignSequence(config, { debug, forcedSequence }) {
  const ids = Object.keys(config.sequences);

  if (debug && forcedSequence && ids.includes(forcedSequence)) {
    return { sequence_id: forcedSequence, assignment_method: 'debug_forced' };
  }

  if (isEndpointConfigured(config)) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      const url = `${config.endpoint_url}?action=next_sequence&ids=${ids.join(',')}${debug ? '&test=1' : ''}`;
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      const data = await res.json();
      if (data.ok && ids.includes(data.sequence_id)) {
        return { sequence_id: data.sequence_id, assignment_method: 'rotation' };
      }
    } catch (err) {
      console.warn('Sequence request failed, using random fallback', err);
    }
  }

  return { sequence_id: ids[randomInt(ids.length)], assignment_method: 'random_fallback' };
}
