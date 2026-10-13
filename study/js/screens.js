// One render function per screen type. Each gets (root, screen, ctx) and may
// return { destroy } for cleanup. Text comes from config, never from here,
// except for short UI instructions (buttons, hints, error messages).

import { el, nowIso, shuffle, completionCode } from './util.js';
import { renderItemsForm, paragraphs, rich } from './render.js';
import { mountGatedVideo, preloadVideo, preloadImage } from './video.js';
import { buildPayload, submitPayload, markCompleted, clearProgress } from './storage.js';
import { icon } from './icons.js';
import { START_WAIT_MS, randomAssignment } from './assign.js';

// Items with only_position (the attention check) appear only after that video.
export function visibleItems(subblock, position) {
  return subblock.items.filter((it) => !it.only_position || it.only_position === position);
}
export function visibleSubblocks(config, position) {
  return config.blocks.RATING.subblocks.filter((sb) => visibleItems(sb, position).length > 0);
}

// Shuffled orders are stored in state so a reload shows the same order that gets recorded.
function stableOrder(ctx, key, ids, doShuffle) {
  const { orders } = ctx.state;
  if (!orders[key]) orders[key] = doShuffle ? shuffle(ids) : ids.slice();
  return orders[key];
}

function videoLabel(ctx, index) {
  return `Video ${index + 1} of ${ctx.state.videos.length}`;
}

// Small context line, title, optional lead paragraph(s).
// Title and intro may contain **highlighted** words from the config.
function pageHead({ kicker, title, lead, intro, extra }) {
  return el('header', { class: 'page-head' },
    kicker && el('p', { class: 'kicker' }, kicker),
    el('h1', {}, rich(title)),
    lead && el('p', { class: 'lead' }, lead),
    intro && el('div', { class: 'intro' }, ...paragraphs(intro)),
    extra);
}

const primaryBtn = (label, attrs = {}) =>
  el('button', { type: 'button', class: 'btn btn-primary', ...attrs }, label);

// Completion code with a copy button. Clipboard needs https; otherwise select the text.
function codeBox(code) {
  const value = el('span', { class: 'code-value' }, code);
  const copyBtn = el('button', { type: 'button', class: 'btn btn-secondary btn-compact' }, 'Copy code');
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code);
      copyBtn.textContent = 'Copied';
    } catch {
      const range = document.createRange();
      range.selectNodeContents(value);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
      copyBtn.textContent = 'Selected, copy it now';
    }
  });
  return el('div', { class: 'code-box' },
    el('span', { class: 'code-label' }, 'Your completion code'),
    value,
    copyBtn);
}

export const screens = {
  consent(root, screen, ctx) {
    const { consent } = ctx.config;
    const box = el('input', { type: 'checkbox', id: 'consent-box' });
    const btn = primaryBtn('Start the study', { disabled: true });
    box.addEventListener('change', () => { btn.disabled = !box.checked; });

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Starting…';
      const { state } = ctx;
      state.consented_at = nowIso();
      // The sequence request started when this page opened. Don't keep a participant
      // waiting for a slow answer: after START_WAIT_MS, assign at random (recorded as such).
      const assigned = await Promise.race([
        ctx.assignmentPromise,
        new Promise((resolve) => setTimeout(() => resolve(null), START_WAIT_MS)),
      ]) || randomAssignment(ctx.config);
      state.sequence_id = assigned.sequence_id;
      state.assignment_method = assigned.assignment_method;
      state.videos = ctx.config.sequences[state.sequence_id].map((s, i) => {
        const v = ctx.config.videos[`${s.product}_${s.condition}`];
        return {
          position: i + 1,
          product: s.product,
          condition: s.condition,
          video_file: v.file,
          thumb: v.thumb,
          video_duration_s: null,
          watch_time_s: 0,
          watch_completed: false,
          pauses: 0,
          replays: 0,
          block_started_at: null,
          block_submitted_at: null,
          item_order: [],
          answers: {},
        };
      });
      ctx.rebuild();
      ctx.enableBackGuard();
      ctx.next();
    });

    const section = (title, ...content) => el('section', { class: 'section' }, title && el('h2', {}, title), ...content);

    // Every section is optional so an older or shorter config still renders.
    root.append(
      pageHead({ title: consent.title, intro: consent.intro || (consent.lead ? [consent.lead] : null) }),
      consent.highlights && el('dl', { class: 'facts' },
        consent.highlights.map((h) => el('div', { class: 'fact' },
          h.label && el('dt', {}, h.label),
          el('dd', {}, h.text)))),
      consent.steps && section(consent.steps_title,
        el('ol', { class: 'steps' },
          consent.steps.map((s, i) => el('li', { class: 'step' },
            el('span', { class: 'step-num', 'aria-hidden': 'true' }, String(i + 1)),
            el('div', {},
              el('p', { class: 'step-title' }, s.title),
              el('p', { class: 'step-text' }, s.text)))))),
      consent.tips && section(consent.tips_title,
        el('ul', { class: 'list' }, consent.tips.map((t) => el('li', {}, t)))),
      section(consent.body_title, el('div', { class: 'prose prose-small' }, ...paragraphs(consent.body))),
      el('div', { class: 'consent-block' },
        el('label', { class: 'checkbox', for: 'consent-box' },
          box,
          el('span', { class: 'checkbox-mark', 'aria-hidden': 'true' }),
          el('span', { class: 'checkbox-text' }, consent.checkbox)),
        btn,
        el('p', { class: 'hint' }, 'If you do not want to take part, simply close this page.')),
    );
  },

  soundcheck(root, screen, ctx) {
    const { state, config } = ctx;
    const sc = config.sound_check;
    // Start buffering the first video while they do the sound check and background questions.
    if (state.videos[0]) preloadVideo(state.videos[0].video_file);

    const audio = new Audio(sc.file);
    audio.preload = 'auto';
    let played = false;

    const playBtn = el('button', { type: 'button', class: 'btn btn-secondary btn-compact' },
      icon('play', { size: 18 }), el('span', {}, 'Play sound'));
    const status = el('p', { class: 'audio-status', role: 'status' }, 'Not played yet');
    const panel = el('div', { class: 'audio-panel' }, playBtn, status);
    audio.addEventListener('playing', () => { status.textContent = 'Playing…'; });
    audio.addEventListener('ended', () => { status.textContent = 'Played. You can play it again if you need to.'; });

    const feedback = el('p', { class: 'form-error', role: 'alert', hidden: true });
    const options = stableOrder(ctx, 'soundcheck', sc.options, true);
    const list = el('div', { class: 'options' },
      options.map((word) => el('label', { class: 'option' },
        el('input', { type: 'radio', name: 'soundcheck', value: word, disabled: true }),
        el('span', { class: 'option-mark', 'aria-hidden': 'true' }),
        el('span', { class: 'option-text' }, word))));
    const question = el('fieldset', { class: 'item' },
      el('legend', { class: 'item-text' }, 'Which word did you hear?'),
      list);
    const checkBtn = primaryBtn('Check answer', { disabled: true });
    const attemptsLeft = () => sc.max_attempts - state.sound_check_attempts;

    playBtn.addEventListener('click', () => {
      audio.currentTime = 0;
      audio.play().catch(() => {
        feedback.textContent = 'The sound could not be played. Please check your connection and try again.';
        feedback.hidden = false;
      });
      if (!played) {
        played = true;
        list.querySelectorAll('input').forEach((i) => { i.disabled = false; });
      }
    });
    list.addEventListener('change', () => { checkBtn.disabled = false; });

    checkBtn.addEventListener('click', () => {
      const choice = list.querySelector('input:checked')?.value;
      if (!choice) return;
      state.sound_check_attempts += 1;
      if (choice === sc.correct) {
        state.sound_check_passed = true;
        audio.pause();
        ctx.next();
        return;
      }
      ctx.persist();
      list.querySelectorAll('input').forEach((i) => { i.checked = false; });
      checkBtn.disabled = true;
      if (attemptsLeft() > 0) {
        feedback.textContent = 'That was not the word. Please turn your sound on or turn the volume up, then play the sound again.';
        feedback.hidden = false;
      } else {
        // Out of tries: let them continue; the analysis excludes people who never passed.
        feedback.textContent = 'We could not confirm your sound. The videos have speech, so please make sure your sound is on before continuing.';
        feedback.hidden = false;
        question.hidden = true;
        panel.hidden = true;
        checkBtn.textContent = 'Continue';
        checkBtn.disabled = false;
        checkBtn.onclick = () => { audio.pause(); ctx.next(); };
      }
    });

    root.append(
      pageHead({
        kicker: 'Before you start',
        title: 'Sound check',
        lead: 'The videos have speech. Turn your sound on or use headphones, play the sound, then choose the word you hear.',
      }),
      panel,
      question,
      feedback,
      checkBtn,
    );
    return { destroy: () => audio.pause() };
  },

  block(root, screen, ctx) {
    const block = ctx.config.blocks[screen.block];
    // A block can be split over several pages (config "pages"); each page is its own screen.
    const page = block.pages ? block.pages[screen.page] : null;
    const ids = page ? page.items : block.items.map((it) => it.id);
    const key = page ? `${screen.block}_p${screen.page + 1}` : screen.block;
    const order = stableOrder(ctx, key, ids, block.shuffle);
    const items = order.map((id) => block.items.find((it) => it.id === id));

    let thumbs = null;
    if (block.show_thumbnails) {
      thumbs = el('div', { class: 'thumbs' },
        ctx.state.videos.map((vd, i) => el('figure', { class: 'thumb' },
          el('img', {
            src: vd.thumb, alt: `Still from video ${i + 1}`, loading: 'eager',
            onerror: (e) => { e.target.style.visibility = 'hidden'; }, // empty frame instead of a broken icon
          }),
          el('figcaption', {}, `Video ${i + 1}`))));
    }

    const form = renderItemsForm({
      header: pageHead({
        kicker: page && `${block.title} · Page ${screen.page + 1} of ${block.pages.length}`,
        title: (page && page.title) || block.title,
        extra: thumbs,
      }),
      items,
      onSubmit: (answers) => {
        Object.assign(ctx.state.answers, answers);
        ctx.next();
      },
    });
    root.append(form);
  },

  video(root, screen, ctx) {
    const vd = ctx.state.videos[screen.index];
    const vs = ctx.config.video_screen || {};
    const hintDone = vs.hint_done || 'You can watch it again if you like, or continue.';
    const continueBtn = primaryBtn('Continue', { hidden: !vd.watch_completed });
    const hint = el('p', { class: 'player-hint' },
      vd.watch_completed ? hintDone : (vs.hint || 'Watch to the end with the sound on. The Continue button appears when the video ends.'));
    const playerBox = el('div');

    continueBtn.addEventListener('click', () => ctx.next());

    root.append(
      pageHead({ kicker: videoLabel(ctx, screen.index), title: vs.title || 'Please watch this video' }),
      // Shown before every video: where to direct attention (text in config).
      vs.note && el('p', { class: 'note' }, rich(vs.note)),
      playerBox,
      hint,
      continueBtn,
    );

    const player = mountGatedVideo({
      container: playerBox,
      src: vd.video_file,
      poster: vd.thumb,
      metrics: vd,
      onProgress: ctx.persist,
      onEnded: () => {
        continueBtn.hidden = false;
        hint.textContent = hintDone;
      },
    });

    if (ctx.debug) {
      root.append(el('button', {
        type: 'button',
        class: 'btn btn-debug',
        onclick: () => ctx.next(), // watch_completed stays as it really is
      }, 'Skip video (debug)'));
    }
    return player;
  },

  rating(root, screen, ctx) {
    const { config, state } = ctx;
    const vd = state.videos[screen.index];
    const sb = config.blocks.RATING.subblocks.find((s) => s.id === screen.sub);
    const scale = config.scales[sb.scale];

    if (!vd.block_started_at) vd.block_started_at = nowIso();
    // Buffer the next video while they answer.
    const nextVd = state.videos[screen.index + 1];
    if (nextVd) preloadVideo(nextVd.video_file);
    else if (screen.part === 1) state.videos.forEach((v) => preloadImage(v.thumb));

    const key = `rating_${vd.position}_${sb.id}`;
    const order = stableOrder(ctx, key, visibleItems(sb, vd.position).map((it) => it.id), sb.shuffle);
    const items = order.map((id) => sb.items.find((it) => it.id === id));

    root.append(
      renderItemsForm({
        header: pageHead({
          kicker: `${videoLabel(ctx, screen.index)} · Page ${screen.part} of ${screen.parts}`,
          title: config.blocks.RATING.title,
        }),
        intro: sb.intro,
        items,
        scale,
        onSubmit: (answers) => {
          Object.assign(vd.answers, answers);
          if (screen.last) {
            vd.block_submitted_at = nowIso();
            vd.item_order = visibleSubblocks(config, vd.position)
              .flatMap((s) => state.orders[`rating_${vd.position}_${s.id}`] || []);
          }
          ctx.next();
        },
      }),
    );
  },

  saving(root, screen, ctx) {
    const { state, config } = ctx;
    const statusText = el('span', { role: 'status' }, 'Saving your answers. Please keep this page open.');
    const spinner = el('span', { class: 'spinner', 'aria-hidden': 'true' });
    const retryBtn = primaryBtn('Try again', { hidden: true });
    root.append(
      pageHead({ title: 'Almost done' }),
      el('p', { class: 'status-line' }, spinner, statusText),
      retryBtn,
    );

    // Fixed once, so a retry or reload sends the same submission.
    if (!state.submitted_at) state.submitted_at = nowIso();
    if (!state.completion_code) state.completion_code = completionCode();
    ctx.persist();

    async function attempt() {
      retryBtn.hidden = true;
      spinner.hidden = false;
      statusText.textContent = 'Saving your answers. Please keep this page open.';
      try {
        const payload = buildPayload(state, config);
        const res = await submitPayload(payload, config);
        if (!res.ok) throw new Error('Server did not confirm the save');
        state.saved = true;
        if (!state.is_test) markCompleted(state);
        ctx.next();
      } catch (err) {
        console.error(err);
        spinner.hidden = true;
        statusText.textContent = 'Your answers could not be saved yet. Please check your connection and tap Try again.';
        retryBtn.hidden = false;
      }
    }
    retryBtn.addEventListener('click', attempt);
    attempt();
  },

  debrief(root, screen, ctx) {
    const { state, config } = ctx;
    const d = config.debrief;
    // Never show a code unless the save was confirmed.
    if (!state.saved) {
      root.append(el('p', { class: 'form-error' }, 'Your answers have not been saved yet. Please reload the page.'));
      return;
    }

    root.append(
      pageHead({ kicker: 'Study complete', title: d.title }),
      el('div', { class: 'prose' }, ...paragraphs(d.body)),
    );
    if (d.show_completion_code) root.append(codeBox(state.completion_code));
    root.append(el('p', { class: 'hint' }, 'You can now close this page.'));
    clearProgress();
  },
};
