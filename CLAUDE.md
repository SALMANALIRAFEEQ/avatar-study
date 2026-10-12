# Avatar Emotion Pilot Study

Context file for the coding assistant. Read this first, then everything in `docs/`.

## What this project is

A small online experiment (a pilot study) built by Salman Ali Rafeeq as supporting evidence for his research master's application to Prof Kaoru Sumi's PAHAI Lab (Future University Hakodate, Japan).

Participants watch short AI avatar product videos that differ **only in emotional style** (neutral vs warm), then rate the presenter's trustworthiness, naturalness and likeability, their engagement, and their purchase intention. The results become a one page summary for the professor.

**Priority order:** data integrity > methodological correctness > works well on phones > visual polish. A plain page that collects clean data beats a beautiful one that loses responses.

## Stack (decided, do not change without asking)

| Part | Choice | Why |
|---|---|---|
| Frontend | Plain HTML, CSS, vanilla JS (ES modules). No framework, no build step. | Deploys on GitHub Pages as is; easy for Salman to maintain. |
| Hosting | Separate GitHub repo `avatar-study`, served at `https://salmanalirafeeq.github.io/avatar-study/` | Free, already familiar. |
| Data storage | Google Apps Script web app that appends rows to a Google Sheet. Frontend POSTs JSON. | Free, no server to run, data lands where Salman can see it. |
| Videos | Self hosted MP4 (H.264 + AAC, under about 15 MB each) in `study/media/` | YouTube adds suggestions, ads and controls we can't lock. |
| Analysis (Phase 1b) | Python 3.11+, pandas, scipy, pingouin, statsmodels, matplotlib | Standard, citable, deterministic. **No LLM or AI in the analysis.** |

## Hosting and deployment (zero cost: keep it that way)

- **Repo is public.** GitHub Pages is free only for public repos on GitHub Free. Never commit response data, exports or anything personal (`analysis/data/` is gitignored).
- **Pages source: "Deploy from a branch", branch `main`, folder `/ (root)`.** Do NOT add custom GitHub Actions workflows, CI, or a build step. GitHub's built in Pages deploy is all we use.
- Pages can only publish from root or `/docs`, so the whole repo is published. Add a root `index.html` that redirects to `study/` so the participant link is `https://salmanalirafeeq.github.io/avatar-study/`. Add an empty `.nojekyll` file at root so Pages serves files as is.
- All paths in the site must be **relative** (e.g. `media/A_warm.mp4`, not `/media/...`), because the site lives under `/avatar-study/study/`, not the domain root.
- **No secrets anywhere.** No API keys, no GitHub tokens, no paid services. The Apps Script web app URL sits in the public config; that is expected.
- Because the URL is public, `doPost` must reject junk: check the payload has the expected `app_version` prefix, required fields and value ranges, cap payload size (e.g. 50 KB), and silently drop anything invalid. Not real security, just spam filtering.
- **Apps Script redeploys:** after editing `Code.gs`, Salman must use Deploy → Manage deployments → Edit → New version, so the web app URL stays the same. Creating a "New deployment" gives a new URL and breaks the site. The README must say this clearly.
- Keep total media under about 100 MB (Pages site limit is 1 GB, bandwidth soft limit 100 GB/month; we are far below).

## Repository layout (target)

```
avatar-study/
  CLAUDE.md
  docs/                      research decisions (source of truth)
  study/                     the participant facing site (GitHub Pages root or /study)
    index.html
    css/style.css
    js/app.js                boot, routing between screens
    js/flow.js               screen sequence and state machine
    js/render.js             renders items from config
    js/video.js              gated video player, watch time tracking
    js/assign.js             counterbalanced sequence assignment
    js/storage.js            submit, retry, localStorage backup
    config/study.config.json all text, items, conditions, video paths
    media/                   videos + sound check clip
  backend/apps_script/
    Code.gs                  doPost (save), doGet (next sequence)
    README.md                deployment steps for Salman
  analysis/                  Phase 1b
    analyze.py
    requirements.txt
    data/                    raw exports (gitignored)
    output/                  report, charts, summary.json
```

## Hard rules

1. **Config driven.** All study text, items, scales, conditions and video paths live in `study/config/study.config.json`. Do not hardcode question text in JS. `docs/QUESTIONNAIRE.md` is the source the config is built from.
2. **N conditions.** The pilot uses 2 emotional styles and 2 products. The full study will use 4 styles. Code must handle any number of conditions and sequences from config.
3. **No personal data.** No names, emails, phone numbers, IP addresses or precise location. Participant ID is a random UUID generated in the browser. Store only device class (mobile / desktop), not the full user agent.
4. **Mobile first.** Most participants will be on Android phones in Pakistan, often on slow connections. Test at 360 px width. Videos use `playsinline`. Preload the next video while the participant answers questions.
5. **Video gating.** The participant cannot continue until the video has played to the end. Forward seeking is blocked. Record actual watched seconds, video duration, pauses and replays.
6. **Never lose data silently.** Retry failed submissions with backoff, keep unsent payloads in localStorage and resend on next load, and show the completion code only after the server confirms the save.
7. **Debug mode.** `?debug=1` shows the assigned sequence, allows skipping videos, and marks rows `is_test=true`. Test rows must never be mixed into analysis.
8. **Research decisions are not code decisions.** Anything in `docs/STUDY_DESIGN.md`, `docs/QUESTIONNAIRE.md` or `docs/ANALYSIS_PLAN.md` (items, wording, scales, exclusions, tests) must not be changed without asking Salman first. If something there looks wrong, flag it.
9. **No third party trackers**, analytics, cookie banners or ads. At most one Google Font.
10. Keep code readable for someone with web development (JS, PHP) experience but new to research tooling. Short comments explaining why, not what.

## Current phase

**Phase 1a: participant site + questionnaire + data saving.** See `docs/PHASES.md` for tasks and acceptance criteria. Phase 1b (analysis) starts only after 1a passes its checklist and a test run with 3 to 5 people.

## Key docs

- `docs/STUDY_DESIGN.md`: design, conditions, counterbalancing, flow, exclusions, ethics
- `docs/QUESTIONNAIRE.md`: every item with its ID and scale
- `docs/DATA_SCHEMA.md`: exactly what gets saved
- `docs/PHASES.md`: build plan with acceptance criteria
- `docs/ANALYSIS_PLAN.md`: Phase 1b statistics (pre specified)
- `docs/study.config.example.json`: starter config
