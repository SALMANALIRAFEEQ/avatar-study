# How to start the coding assistant

## Setup (once)

1. Create an empty GitHub repo named `avatar-study` and clone it.
2. Copy `CLAUDE.md` into the repo root and the `docs/` folder into `avatar-study/docs/`.
3. Open the repo with Claude Code (or any coding assistant) and paste the prompt below.

## First prompt (paste as is)

```
Read CLAUDE.md and every file in docs/ before writing any code.

Then:
1. Summarize back to me in 10 lines or fewer: what we are building, the stack, and the Phase 1a steps. List anything in the docs that looks inconsistent or unclear.
2. Wait for my OK.
3. After my OK, do Phase 1a step 1 (scaffold) and step 8 (placeholder media) so we can run the site locally. Tell me exactly how to run it and what to check.

Work one step at a time from docs/PHASES.md. After each step, tell me what to test and wait.
Do not change anything in STUDY_DESIGN.md, QUESTIONNAIRE.md or ANALYSIS_PLAN.md without asking me.
```

## Later prompts

- Next step: `Continue with Phase 1a step N.`
- Before launch: `Go through the Phase 1a acceptance checklist and tell me which items pass, which fail, and how you checked each one.`
- Start analysis: `Phase 1a is accepted. Start Phase 1b step 1. Build the fake data generator first and test the analysis on it before we touch real data.`

## Things only Salman can do

- Produce the four real avatar videos + thumbnails + sound check clip (see STUDY_DESIGN.md, Stimuli).
- Create the Google Sheet and deploy the Apps Script (the assistant writes the README steps).
- Run the soft launch with 3 to 5 people, then recruit 30 to 40 participants.
- Read and code the free text answers.
