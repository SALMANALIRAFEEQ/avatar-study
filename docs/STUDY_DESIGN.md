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

**Within subjects, 2 × 2 counterbalanced.** Each participant sees two videos: product A in one style and product B in the other. Using two different products avoids showing the same script twice, which participants would notice.

Four sequences, assigned in rotation so each is used equally:

| Sequence | Video 1 | Video 2 |
|---|---|---|
| S1 | Product A, neutral | Product B, warm |
| S2 | Product A, warm | Product B, neutral |
| S3 | Product B, neutral | Product A, warm |
| S4 | Product B, warm | Product A, neutral |

Why within subjects: with 20 to 40 participants, a between subjects design would have very little power. Within subjects lets each person serve as their own baseline. First video ratings can still be analyzed between subjects as a carryover check.

**Assignment:** the Apps Script `doGet` returns the next sequence based on the count of completed, non test submissions (count mod 4). If the request fails, fall back to random assignment and record `assignment_method = "random_fallback"`.

## Stimuli (Salman produces these; 4 videos)

- **Products:** two fictional products of similar price and appeal, so brand familiarity plays no role.
  - Product A: "Kora" insulated water bottle
  - Product B: "Lumo" rechargeable desk lamp
- **Same across all four videos:** same avatar, same voice, same background, same framing, same resolution, same script structure, length within 2 seconds of each other (target 30 to 40 s).
- **Only difference:** facial expression, voice tone and gesture.
  - Neutral: calm, flat intonation, minimal gestures, neutral face.
  - Warm: friendly smile, warmer and slightly more varied intonation, open gestures. **Not** over the top (that is the exaggerated level for the full study).
- Script per product: about 70 to 90 words. Same claims in both styles, word for word.
- Export H.264 MP4, 720p, AAC audio, under about 15 MB.
- Also produce a 3 second sound check clip of a voice saying one word (e.g. "orange").

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
