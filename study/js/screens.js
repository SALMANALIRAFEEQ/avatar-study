// One render function per screen type. Each gets (root, screen, ctx) and may
// return { destroy } for cleanup. Text comes from config, never from here,
// except for short UI instructions (buttons, hints, error messages).

import { el, nowIso, shuffle, completionCode } from './util.js';
import { renderItemsForm, paragraphs } from './render.js';
import { mountGatedVideo, preloadVideo, preloadImage } from './video.js';
import { buildPayload, submitPayload, markCompleted, clearProgress } from './storage.js';
import { icon } from './icons.js';

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

// Icon + small label + title at the top of every screen.
function screenHead({ iconName, eyebrow, title, lead, extra }) {
  return el('header', { class: 'screen-head' },
    el('div', { class: 'head-row' },
      icon(iconName, { size: 20, className: 'head-icon' }),
      eyebrow && el('p', { class: 'eyebrow' }, eyebrow)),
    el('h1', {}, title),
    lead && el('p', { class: 'lead' }, lead),
    extra);
}

const arrowBtn = (label, attrs = {}) =>
  el('button', { type: 'button', class: 'btn btn-primary', ...attrs }, el('span', {}, label), icon('arrow', { size: 20 }));

// Completion code with a copy button. Clipboard needs https; otherwise select the text.
function codeBox(code) {
  const value = el('span', { class: 'code-value' }, code);
  const copyLabel = el('span', {}, 'Copy code');
  const copyBtn = el('button', { type: 'button', class: 'copy-btn' }, icon('copy', { size: 18 }), copyLabel);
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code);
      copyLabel.textContent = 'Copied';
      copyBtn.classList.add('copied');
    } catch {
      const range = document.createRange();
      range.selectNodeContents(value);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
      copyLabel.textContent = 'Selected, copy it now';
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
    const btn = arrowBtn('Start', { disabled: true });
    box.addEventListener('change', () => { btn.disabled = !box.checked; });

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.firstChild.textContent = 'Starting…';
      const { state } = ctx;
      state.consented_at = nowIso();
      const assigned = await ctx.assignmentPromise;
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

    // Every section is optional so an older or shorter config still renders.
    root.append(
      screenHead({ iconName: 'sparkle', title: consent.title, lead: consent.lead }),
      consent.highlights && el('ul', { class: 'chips' },
        consent.highlights.map((h) => el('li', { class: 'chip' }, icon(h.icon, { size: 18 }), el('span', {}, h.text)))),
      consent.steps && el('section', { class: 'card' },
        el('h2', {}, consent.steps_title),
        el('ol', { class: 'steps' },
          consent.steps.map((s, i) => el('li', { class: 'step' },
            el('span', { class: 'step-icon' }, icon(s.icon, { size: 18 }), el('span', { class: 'step-num' }, i + 1)),
            el('div', {},
              el('p', { class: 'step-title' }, s.title),
              el('p', { class: 'step-text' }, s.text)))))),
      consent.tips && el('section', { class: 'card card-tint' },
        el('h2', {}, consent.tips_title),
        el('ul', { class: 'tips' },
          consent.tips.map((t) => el('li', {}, icon('check', { size: 16 }), el('span', {}, t))))),
      el('section', { class: 'card prose' },
        consent.body_title && el('h2', {}, consent.body_title),
        ...paragraphs(consent.body)),
      el('label', { class: 'consent-check', for: 'consent-box' },
        box,
        el('span', { class: 'check-box', 'aria-hidden': 'true' }, icon('check', { size: 16 })),
        el('span', {}, consent.checkbox)),
      btn,
      el('p', { class: 'hint' }, 'If you do not agree, simply close this page.'),
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

    const playBtn = el('button', { type: 'button', class: 'sound-btn', 'aria-label': 'Play sound' },
      icon('volume', { size: 34 }));
    const playLabel = el('p', { class: 'sound-label' }, 'Tap to play the sound');
    const panel = el('div', { class: 'sound-panel' }, playBtn, playLabel);
    audio.addEventListener('playing', () => playBtn.classList.add('is-playing'));
    audio.addEventListener('ended', () => playBtn.classList.remove('is-playing'));
    audio.addEventListener('pause', () => playBtn.classList.remove('is-playing'));
    const feedback = el('p', { class: 'form-error', role: 'alert', hidden: true });
    const options = stableOrder(ctx, 'soundcheck', sc.options, true);
    const list = el('div', { class: 'choice-list' },
      options.map((word) => el('label', { class: 'choice' },
        el('input', { type: 'radio', name: 'soundcheck', value: word, disabled: true }),
        el('span', { class: 'choice-label' }, word))));
    const checkBtn = el('button', { type: 'button', class: 'btn btn-primary', disabled: true }, 'Check');
    const attemptsLeft = () => sc.max_attempts - state.sound_check_attempts;

    playBtn.addEventListener('click', () => {
      audio.currentTime = 0;
      audio.play().catch(() => {
        feedback.textContent = 'The sound could not be played. Please check your connection and try again.';
        feedback.hidden = false;
      });
      playLabel.textContent = 'Tap to play again';
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
        list.closest('fieldset').hidden = true;
        panel.hidden = true;
        checkBtn.textContent = 'Continue';
        checkBtn.disabled = false;
        checkBtn.onclick = () => { audio.pause(); ctx.next(); };
      }
    });

    root.append(
      screenHead({
        iconName: 'headphones',
        eyebrow: 'Before we start',
        title: 'Sound check',
        lead: 'The videos have speech. Please turn your sound on or use headphones, play the sound, then choose the word you hear.',
      }),
      panel,
      el('fieldset', { class: 'item' }, el('legend', { class: 'item-text' }, 'Which word did you hear?'), list),
      feedback,
      checkBtn,
    );
    return { destroy: () => audio.pause() };
  },

  block(root, screen, ctx) {
    const block = ctx.config.blocks[screen.block];
    const ids = block.items.map((it) => it.id);
    const order = stableOrder(ctx, screen.block, ids, block.shuffle);
    const items = order.map((id) => block.items.find((it) => it.id === id));

    let thumbs = null;
    if (block.show_thumbnails) {
      thumbs = el('div', { class: 'thumbs' },
        ctx.state.videos.map((vd, i) => el('figure', { class: 'thumb' },
          el('img', {
            src: vd.thumb, alt: `Still from video ${i + 1}`, loading: 'eager',
            onerror: (e) => { e.target.style.visibility = 'hidden'; }, // grey box instead of a broken icon
          }),
          el('figcaption', {}, `Video ${i + 1}`))));
    }

    const form = renderItemsForm({
      header: screenHead({
        iconName: block.icon || (block.show_thumbnails ? 'compare' : 'user'),
        title: block.title,
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
    const continueBtn = arrowBtn('Continue', { hidden: !vd.watch_completed });
    const hintText = el('span', {}, 'Please watch the whole video with sound on. The Continue button appears when it ends.');
    const hint = el('p', { class: 'hint hint-box' }, icon('headphones', { size: 18 }), hintText);
    const playerBox = el('div');

    continueBtn.addEventListener('click', () => ctx.next());

    root.append(
      screenHead({ iconName: 'video', eyebrow: videoLabel(ctx, screen.index), title: 'Please watch this video' }),
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
        hintText.textContent = 'You can watch it again if you like, or continue.';
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

    const dots = el('div', { class: 'part-dots', 'aria-hidden': 'true' },
      Array.from({ length: screen.parts }, (_, i) =>
        el('span', { class: i + 1 < screen.part ? 'dot done' : i + 1 === screen.part ? 'dot current' : 'dot' })));

    root.append(
      renderItemsForm({
        header: screenHead({
          iconName: 'clipboard',
          eyebrow: `${videoLabel(ctx, screen.index)} · Part ${screen.part} of ${screen.parts}`,
          title: config.blocks.RATING.title,
          extra: dots,
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
    const status = el('p', { role: 'status' }, 'Saving your answers. Please keep this page open…');
    const retryBtn = el('button', { type: 'button', class: 'btn btn-primary', hidden: true }, 'Try again');
    root.append(el('div', { class: 'center-screen' },
      el('div', { class: 'spinner spinner-lg', 'aria-hidden': 'true' }),
      el('h1', {}, 'Almost done'),
      status,
      retryBtn));

    // Fixed once, so a retry or reload sends the same submission.
    if (!state.submitted_at) state.submitted_at = nowIso();
    if (!state.completion_code) state.completion_code = completionCode();
    ctx.persist();

    async function attempt() {
      retryBtn.hidden = true;
      status.textContent = 'Saving your answers. Please keep this page open…';
      try {
        const payload = buildPayload(state, config);
        const res = await submitPayload(payload, config);
        if (!res.ok) throw new Error('Server did not confirm the save');
        state.saved = true;
        if (!state.is_test) markCompleted(state);
        ctx.next();
      } catch (err) {
        console.error(err);
        status.textContent = 'Your answers could not be saved yet. Please check your connection and tap Try again.';
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
      el('div', { class: 'done-badge' }, icon('check', { size: 40 })),
      el('h1', { class: 'center' }, d.title),
      el('div', { class: 'card prose' }, ...paragraphs(d.body)),
    );
    if (d.show_completion_code) root.append(codeBox(state.completion_code));
    root.append(el('p', { class: 'hint' }, 'You can now close this page.'));
    clearProgress();
  },
};
