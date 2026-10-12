// Renders question items from config. Nothing here knows the question text;
// it all comes from study.config.json.

import { el } from './util.js';
import { icon } from './icons.js';

let formCounter = 0;

/**
 * Build a form for a list of items (already in display order).
 *   header    node shown above the items (screen title etc.)
 *   scale     scale definition from config.scales (for rating subblocks), or null
 *   onSubmit  called with {itemId: value} once every required item is answered
 */
export function renderItemsForm({ header, intro, items, scale = null, submitLabel = 'Continue', onSubmit }) {
  const formId = `f${++formCounter}`;
  const errorBox = el('p', { class: 'form-error', role: 'alert', hidden: true });

  const form = el('form', { class: 'items-form', novalidate: true },
    header,
    intro && el('p', { class: 'block-intro' }, intro),
    items.map((item) => renderItem(item, scale, formId)),
    errorBox,
    el('button', { type: 'submit', class: 'btn btn-primary' }, el('span', {}, submitLabel), icon('arrow', { size: 20 })),
  );

  // Clear an item's error as soon as it gets answered.
  form.addEventListener('change', (e) => {
    const box = e.target.closest('.item');
    if (box) box.classList.remove('has-error');
    if (!form.querySelector('.item.has-error')) errorBox.hidden = true;
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const answers = {};
    const missing = [];
    for (const item of items) {
      const value = readValue(form, item, scale, formId);
      // Rating and choice items are required by default; free text is optional by default.
      const required = item.required ?? item.type !== 'text';
      if (required && value === null) missing.push(item.id);
      else answers[item.id] = value ?? '';
    }
    form.querySelectorAll('.item').forEach((box) => {
      box.classList.toggle('has-error', missing.includes(box.dataset.itemId));
    });
    if (missing.length) {
      errorBox.textContent = missing.length === 1
        ? 'Please answer the highlighted question to continue.'
        : `Please answer the ${missing.length} highlighted questions to continue.`;
      errorBox.hidden = false;
      const first = form.querySelector('.item.has-error');
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      first.querySelector('input, textarea')?.focus({ preventScroll: true });
      return;
    }
    form.querySelector('button[type=submit]').disabled = true;
    onSubmit(answers);
  });

  return form;
}

function itemKind(item, scale) {
  if (item.type) return item.type; // 'single' | 'text'
  if (!scale) throw new Error(`Item ${item.id} has no type and no scale`);
  if (scale.type === 'semantic_differential') return 'sd';
  return scale.labels ? 'likert_labeled' : 'likert_numbered';
}

function renderItem(item, scale, formId) {
  const kind = itemKind(item, scale);
  const name = `${formId}_${item.id}`;
  const box = el('fieldset', { class: `item item--${kind}`, 'data-item-id': item.id });
  const errorText = el('span', { class: 'item-error' }, 'Please choose an answer.');

  if (kind === 'single') {
    box.append(
      el('legend', { class: 'item-text' }, item.text),
      el('div', { class: 'choice-list' },
        item.options.map((label, i) => choice(name, String(i), label))),
      errorText,
    );
  } else if (kind === 'text') {
    const max = item.max || 500;
    const counter = el('span', { class: 'char-count' }, `0 / ${max}`);
    const area = el('textarea', { id: name, name, rows: 3, maxlength: max });
    area.addEventListener('input', () => { counter.textContent = `${area.value.length} / ${max}`; });
    box.append(
      el('legend', { class: 'item-text' },
        el('label', { for: name }, item.text),
        item.required === false && el('span', { class: 'optional' }, ' (optional)')),
      area,
      counter,
    );
  } else if (kind === 'likert_labeled') {
    box.append(
      el('legend', { class: 'item-text' }, item.text),
      el('div', { class: 'likert-labeled', style: `--points:${scale.points}` },
        scale.labels.map((label, i) => choice(name, String(i + 1), label))),
      errorText,
    );
  } else if (kind === 'likert_numbered') {
    const [lo, hi] = scale.endpoints;
    box.append(
      el('legend', { class: 'item-text' }, item.text),
      el('div', { class: 'scale-row', style: `--points:${scale.points}` },
        range(scale.points).map((n) =>
          pointButton(name, n, `${n} of ${scale.points}${n === 1 ? `, ${lo}` : ''}${n === scale.points ? `, ${hi}` : ''}`, String(n)))),
      el('div', { class: 'scale-ends', 'aria-hidden': 'true' }, el('span', {}, lo), el('span', {}, hi)),
      errorText,
    );
  } else if (kind === 'sd') {
    // Semantic differential: two anchor words, unnumbered points between them.
    box.append(
      el('legend', { class: 'visually-hidden' }, `${item.left} to ${item.right}`),
      el('div', { class: 'sd-anchors', 'aria-hidden': 'true' },
        el('span', {}, item.left), el('span', {}, item.right)),
      el('div', { class: 'scale-row scale-row-sd', style: `--points:${scale.points}` },
        range(scale.points).map((n) =>
          pointButton(name, n, `${n} of ${scale.points}, from ${item.left} to ${item.right}`, ''))),
      errorText,
    );
  }
  return box;
}

function choice(name, value, label) {
  return el('label', { class: 'choice' },
    el('input', { type: 'radio', name, value }),
    el('span', { class: 'choice-label' }, label));
}

function pointButton(name, n, ariaLabel, visibleText) {
  return el('label', { class: 'point' },
    el('input', { type: 'radio', name, value: String(n), 'aria-label': ariaLabel }),
    el('span', { class: 'point-dot' }, visibleText));
}

function readValue(form, item, scale, formId) {
  const name = `${formId}_${item.id}`;
  const kind = itemKind(item, scale);
  if (kind === 'text') {
    const v = form.querySelector(`[name="${name}"]`).value.trim();
    return v === '' ? null : v.slice(0, item.max || 500);
  }
  const checked = form.querySelector(`input[name="${name}"]:checked`);
  if (!checked) return null;
  if (kind === 'single') {
    const i = Number(checked.value);
    return item.values ? item.values[i] : item.options[i];
  }
  return Number(checked.value); // raw scale point, 1..N
}

const range = (n) => Array.from({ length: n }, (_, i) => i + 1);

// Plain text screen helper (consent, debrief, messages).
export function paragraphs(lines) {
  return lines.map((t) => el('p', {}, t));
}
