// Renders question items from config. Nothing here knows the question text;
// it all comes from study.config.json.

import { el } from './util.js';

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
    el('div', { class: 'items' }, items.map((item) => renderItem(item, scale, formId))),
    errorBox,
    el('button', { type: 'submit', class: 'btn btn-primary' }, submitLabel),
  );

  // Clear an item's error as soon as it gets answered (or its "Other" box gets typed in).
  const clearError = (e) => {
    const box = e.target.closest('.item');
    if (box) box.classList.remove('has-error');
    if (!form.querySelector('.item.has-error')) errorBox.hidden = true;
  };
  form.addEventListener('change', clearError);
  form.addEventListener('input', clearError);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const answers = {};
    const problems = new Map(); // item id -> message shown above its options
    for (const item of items) {
      const value = readValue(form, item, scale, formId);
      // Rating and choice items are required by default; free text is optional by default.
      const required = item.required ?? item.type !== 'text';
      if (required && value === null) { problems.set(item.id, 'Please choose an answer.'); continue; }
      answers[item.id] = value ?? '';
      if (item.other) {
        // The write-in is stored in its own column; empty unless "Other" was chosen.
        const other = readOther(form, item, formId);
        if (other === null) problems.set(item.id, 'Please fill in the box below "Other".');
        else answers[item.other.id] = other;
      }
    }
    form.querySelectorAll('.item').forEach((box) => {
      const msg = problems.get(box.dataset.itemId);
      box.classList.toggle('has-error', Boolean(msg));
      if (msg) box.querySelector('.item-error').textContent = msg;
    });
    if (problems.size) {
      errorBox.textContent = problems.size === 1
        ? 'Please answer the marked question to continue.'
        : `Please answer the ${problems.size} marked questions to continue.`;
      errorBox.hidden = false;
      const first = form.querySelector('.item.has-error');
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const target = first.querySelector('.other-field:not([hidden]) input') || first.querySelector('input, textarea');
      target?.focus({ preventScroll: true });
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
  const errId = `${name}_err`;
  const box = el('fieldset', { class: `item item--${kind}`, 'data-item-id': item.id, 'aria-describedby': errId });
  const errorText = el('p', { class: 'item-error', id: errId }, 'Please choose an answer.');

  if (kind === 'single') {
    const optionsEl = el('div', { class: 'options' },
      item.options.map((label, i) => option(name, String(i), label)));
    box.append(el('legend', { class: 'item-text' }, item.text), errorText, optionsEl);
    if (item.other) addOtherField(optionsEl, item, name);
  } else if (kind === 'text') {
    const max = item.max || 500;
    const counter = el('span', { class: 'char-count' }, `0 / ${max}`);
    const area = el('textarea', { id: name, name, rows: 3, maxlength: max });
    area.addEventListener('input', () => { counter.textContent = `${area.value.length} / ${max}`; });
    box.removeAttribute('aria-describedby');
    box.append(
      el('legend', { class: 'item-text' },
        el('label', { for: name }, item.text),
        item.required === false && el('span', { class: 'optional' }, ' (optional)')),
      area,
      counter,
    );
  } else if (kind === 'likert_labeled') {
    // A list of labelled rows on phones, a horizontal scale on wider screens (CSS decides).
    box.append(
      el('legend', { class: 'item-text' }, item.text),
      errorText,
      el('div', { class: 'scale scale--labeled', style: `--points:${scale.points}` },
        scale.labels.map((label, i) => stop(name, i + 1, { text: label }))),
    );
  } else if (kind === 'likert_numbered') {
    const [lo, hi] = scale.endpoints;
    const n = scale.points;
    box.append(
      el('legend', { class: 'item-text' }, item.text),
      errorText,
      el('div', { class: 'scale scale--numbered', style: `--points:${n}` },
        range(n).map((v) => stop(name, v, {
          text: String(v),
          ariaLabel: `${v} of ${n}${v === 1 ? `, ${lo}` : ''}${v === n ? `, ${hi}` : ''}`,
        }))),
      el('div', { class: 'scale-ends', 'aria-hidden': 'true' }, el('span', {}, lo), el('span', {}, hi)),
    );
  } else if (kind === 'sd') {
    // Semantic differential: two anchor words, unnumbered points between them.
    box.append(
      el('legend', { class: 'visually-hidden' }, `${item.left} to ${item.right}`),
      errorText,
      el('div', { class: 'sd-anchors', 'aria-hidden': 'true' },
        el('span', {}, item.left), el('span', {}, item.right)),
      el('div', { class: 'scale scale--sd', style: `--points:${scale.points}` },
        range(scale.points).map((v) => stop(name, v, {
          ariaLabel: `${v} of ${scale.points}, from ${item.left} to ${item.right}`,
        }))),
    );
  }
  return box;
}

// "Other" with a write-in: the text box sits right under the Other option and only
// shows (and is only required) while that option is selected.
function addOtherField(optionsEl, item, name) {
  const id = `${name}_other`;
  const input = el('input', { type: 'text', id, name: id, maxlength: item.other.max || 100, autocomplete: 'off', class: 'text-input' });
  const field = el('div', { class: 'other-field', hidden: true },
    el('label', { class: 'other-label', for: id }, item.other.label || 'Please specify'),
    input);
  optionsEl.children[item.other.index].after(field);
  optionsEl.addEventListener('change', (e) => {
    if (e.target.type !== 'radio') return;
    field.hidden = Number(e.target.value) !== item.other.index;
    if (!field.hidden) input.focus();
  });
}

// '' when Other isn't chosen, the trimmed text when it is, null when it's chosen but empty.
function readOther(form, item, formId) {
  const name = `${formId}_${item.id}`;
  const checked = form.querySelector(`input[name="${name}"]:checked`);
  if (!checked || Number(checked.value) !== item.other.index) return '';
  const text = form.querySelector(`[name="${name}_other"]`).value.trim();
  return text === '' ? null : text.slice(0, item.other.max || 100);
}

// Config text can mark key words with **double asterisks**; they show in the accent colour.
// Built from text nodes (never innerHTML), so config text can't inject markup.
export function rich(text) {
  return String(text).split(/\*\*(.+?)\*\*/g)
    .map((part, i) => (i % 2 ? el('strong', { class: 'hl' }, part) : part))
    .filter((part) => part !== '');
}

// A full-width answer row (single choice).
function option(name, value, label) {
  return el('label', { class: 'option' },
    el('input', { type: 'radio', name, value }),
    el('span', { class: 'option-mark', 'aria-hidden': 'true' }),
    el('span', { class: 'option-text' }, label));
}

// One point on a scale.
function stop(name, value, { text = null, ariaLabel = null } = {}) {
  return el('label', { class: 'stop' },
    el('input', { type: 'radio', name, value: String(value), 'aria-label': ariaLabel }),
    el('span', { class: 'stop-mark', 'aria-hidden': 'true' }),
    text !== null && el('span', { class: 'stop-text' }, text));
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
  return lines.map((t) => el('p', {}, rich(t)));
}
