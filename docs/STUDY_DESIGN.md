# Study Design (Pilot)

## Purpose

A pilot for the proposed master's research "Emotional Expression and Persuasion in Generative AI Avatars for Digital Marketing". The full research question asks how avatar emotional expression affects trust, engagement and persuasion, and at what point expressiveness reduces credibility. The full study will compare four styles (neutral, warm, enthusiastic, exaggerated). **This pilot tests only the first step: neutral vs warm.**

Goals of the pilot:
1. Show the procedure works end to end (videos, questionnaire, data, analysis).
2. Check that the emotion manipulation is noticed (manipulation check).
3. Get first effect size estimates and scale reliabilities to plan the full study.

It is **exploratory**. It is not powered to prove anything, and the write up must say so.

## Expected direction (stated in advance)

- Warm > neutral on perceived warmth (manipulation check).
- Warm > neutral on likeability, engagement and purchase intention.
- Trust and naturalness: open question. The proposal predicts an inverted U across four levels; at the warm level trust may rise or stay flat.

## Design

**Within subjects, one product, order counterbalanced.** Each participant watches both versions of the same product video (Kora bottle): one with the neutral presenter style and one with the warm style.

> Changed 2026-10-13 (Salman's decision, app_version 1a.2.0). The second product (Lumo lamp) was not produced, so the original 2 × 2 design (product A in one style, product B in the other) was replaced by this one. As a result, participants see the same product and nearly the same script twice, so they are likely to notice that the presenter's style differs. That raises the risk of demand effects, and the second viewing is a familiar one. Report this as a limitation; the first-video ratings (between subjects) are the cleaner check.

Two sequences, assigned in rotation so each is used equally:

| Sequence | Video 1 | Video 2 |
|---|---|---|
| S1 | Kora, neutral | Kora, warm |
| S2 | Kora, warm | Kora, neutral |

Why within subjects: with 20 to 40 participants, a between subjects design would have very little power. Within subjects lets each person serve as their own baseline. First video ratings can still be analyzed between subjects as a carryover check.

**Assignment:** the Apps Script `doGet` returns the next sequence based on the count of completed, non test submissions (count mod 2, the number of sequences). If the request fails, fall back to random assignment and record `assignment_method = "random_fallback"`.

## Stimuli

### Planned specification

- **Products:** two fictional products of similar price and appeal, so brand familiarity plays no role. (Only product A was produced; see "As produced" below.)
  - Product A: "Kora" insulated water bottle
  - Product B: "Lumo" rechargeable desk lamp
- **Same across all four videos:** same avatar, same voice, same background, same framing, same resolution, same script structure, length within 2 seconds of each other (target 30 to 40 s).
- **Only difference:** facial expression, voice tone and gesture.
  - Neutral: calm, flat intonation, minimal gestures, neutral face.
  - Warm: friendly smile, warmer and slightly more varied intonation, open gestures. **Not** over the top (that is the exaggerated level for the full study).
- Script per product: about 70 to 90 words. Same claims in both styles, word for word.
- Export H.264 MP4, 720p, AAC audio, under about 15 MB.
- Also produce a 3 second sound check clip of a voice saying one word (e.g. "orange").

### As produced (2026-10-13)

- **Source files** (kept locally in `assets/`, not in the repository): `Kora Video 1.mp4` = neutral, `Kora video 2.mp4` = warm (mapping confirmed by Salman). Generated with Google's video tool; 1080p, burned-in captions.
- **Script fix:** the neutral version contained one sentence the warm version does not ("Experience perfect temperature all day long."). It was cut out at a shot change, with sound and picture kept in sync: `assets/Kora Video 3.mp4` (full quality master), used for `study/media/A_neutral.mp4`. Salman to review the edit.
- **Length:** neutral 25.7 s, warm 27.4 s (within 2 s of each other; shorter than the 30 to 40 s target).
- **Web versions** (`study/media/`): 1280 × 720 H.264, AAC 128 kb/s, constant 30 fps, fast start, subtitle track and metadata removed. Loudness matched at -16.5 LUFS (warm turned down 1.8 dB, neutral 0.6 dB). Only the overall level changed; intonation is untouched.
- **Thumbnails:** a frame at 4.5 s from each video, where both presenters say the same sentence.
- **Known remaining differences** (can't be fixed by editing; report them, or regenerate the videos):
  - background tone: cool grey (neutral) vs warmer beige (warm)
  - the presenter's face looks slightly different between the two generations
  - opening line: "Meet Kora," (neutral) vs "Kora. Meet Kora." (warm)
  - price spoken as "Rs 2,900" (neutral) vs "2900 rupees" (warm)
  - the burned-in captions highlight different words
- **Both** videos show the caption typo "Meat Kora" (for "Meet Kora"). It's equal across conditions, but visible.
- **Sound check clip:** computer voice (Windows speech) saying "orange".

## Participant flow

1. **Welcome + consent:** purpose in plain words, about 8 to 10 minutes, voluntary, can stop anytime, anonymous, 18+ only, contact email. Discloses that the presenters are digitally generated (AI) presenters. Must tick "I agree" to continue.
2. **Sound check:** play the clip, choose the word heard from 4 options. Wrong answer: ask them to turn sound on and retry (max 3 tries, record attempts).
3. **About you:** short background questions (see QUESTIONNAIRE.md, block DEMO).
4. **Video 1** (gated) → **Rating block** for video 1.
5. **Video 2** (gated) → **Rating block** for video 2.
6. **Comparison block:** forced choices and open comments.
7. **Debrief:** what the study tested, thank you, completion code (shown only after save confirmed).

Scale blocks appear in a fixed order; items inside each block are shuffled per participant. Record the shown order.

## Exclusion rules (pre specified, applied in analysis, not in the site)

A participant is excluded from the main analysis if any of these are true:
1. `is_test = true`
2. Failed the attention check (ATT_1)
3. Did not complete both videos (`watch_completed = false` on either)
4. Never passed the sound check
5. Total completion time under 3 minutes
6. Gave the same answer to every rating item in both blocks (straight lining)

Report how many were excluded and why.

## Recruitment

Friends, classmates, LinkedIn and WhatsApp groups. Target 30 to 40 completed, minimum 20. Note in the write up that this is a convenience sample.

## Ethics

- Informed consent page, 18+ only, anonymous, no identifying data stored.
- AI disclosure up front (ethically required and realistic, since AI ad disclosure is becoming standard).
- Products are fictional; debrief says so.
- Data used only for this pilot and the application.
