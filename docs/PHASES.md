# Build Phases

Work one step at a time. After each step, tell Salman what to test and wait for his confirmation before the next.

## Phase 1a: Participant site, questionnaire, data saving

### Steps

1. **Scaffold** the repo layout from CLAUDE.md. Add `.gitignore` (ignore `analysis/data/`, `.env`, OS files). Copy `docs/study.config.example.json` to `study/config/study.config.json`. Add root `index.html` (redirect to `study/`) and empty `.nojekyll`. Add `DEPLOY.md` with the exact GitHub Pages steps (Settings → Pages → Deploy from a branch → main / root) and the Apps Script setup. No `.github/workflows/`.
2. **Screen flow** (`flow.js`, `app.js`): consent → sound check → demographics → video 1 → ratings 1 → video 2 → ratings 2 → comparison → saving → debrief. State kept in one object; back button disabled after consent (use history API so browser back doesn't lose state, show a warning instead).
3. **Item rendering** (`render.js`) from config: Likert (7 point labeled), semantic differential (5 or 7 point), single choice, free text. Shuffle items inside blocks, record order. Required validation with a clear message.
4. **Gated video** (`video.js`): continue button appears only on `ended`; block forward seeking; track watch time, pauses, replays; handle slow loading with a visible loading state; preload next video.
5. **Assignment** (`assign.js`): request next sequence from Apps Script `doGet`; fallback to random.
6. **Storage** (`storage.js`): build payload exactly per DATA_SCHEMA.md; POST with retry (3 tries, backoff); localStorage queue for unsent payloads; resend on load; `sendBeacon` partials.
7. **Apps Script** (`backend/apps_script/Code.gs` + README): `doPost` writes participants / responses / partials sheets with fixed column order and a lock (`LockService`) to avoid concurrent write clashes; `doGet` returns next sequence. README walks Salman through creating the Sheet, pasting the script, deploying as web app ("Execute as: me", "Who has access: anyone"), and putting the URL into config.
8. **Placeholder media**: until real videos exist, generate four short placeholder MP4s (colored card + text label like "Product A, warm") and a sound check clip, so the flow can be tested.
9. **Style**: clean, calm, readable; large tap targets (min 44 px); progress bar; works at 360 px.
10. **Debug mode** per CLAUDE.md.

### Acceptance checklist (all must pass)

- [ ] Full run on an Android phone and a desktop browser without errors, **on the live GitHub Pages URL** (not only localhost), with videos loading from relative paths.
- [ ] Repo has no workflows folder, no secrets, no data files; Pages deploys from main / root.
- [ ] A malformed POST (wrong fields, out of range values) sent to the Apps Script URL writes nothing to the sheet.
- [ ] Cannot continue past a video before it ends (outside debug mode); seeking forward is blocked.
- [ ] Required items block continuing; nothing is pre selected.
- [ ] After a run, `participants` has 1 row and `responses` has 2 rows with every column in DATA_SCHEMA.md filled correctly.
- [ ] 8 consecutive test runs produce each sequence S1 and S2 exactly four times (one product, two orders since 2026-10-13).
- [ ] With network turned off at submit, the payload is queued and sent on next load; no completion code shown until saved.
- [ ] `?debug=1` rows have `is_test = true`.
- [ ] Changing a question's text in config changes it on screen with no code change.
- [ ] Adding a third condition in config works without code changes (test locally, then revert).
- [ ] Average completion time 8 to 10 minutes for a real tester.

### Then: soft launch

Salman runs 3 to 5 people he knows, checks the sheet, fixes issues. Rows from the soft launch are marked as test (manually or via debug) and excluded.

## Phase 1b: Results evaluation system

Starts after Phase 1a is accepted. Follow `docs/ANALYSIS_PLAN.md` exactly.

### Steps

1. `analysis/requirements.txt` and a short README (how to export the sheets to CSV and run the script).
2. `analyze.py`: load → validate columns → apply exclusions → score scales → reliability → descriptives → tests → charts → report.
3. Output to `analysis/output/`: `report.html` (self contained, readable by Salman), `summary.json` (all numbers), `figures/*.png`, `exclusions.csv`, `open_text.csv` (free text answers with condition labels, for manual reading).
4. A **synthetic data generator** (`make_fake_data.py`) that writes CSVs in the real schema with a known built in effect, used to test that the analysis recovers it. Run tests against fake data before real data exists.
5. `one_page_summary_template.md`: fill in template for the one page summary for Prof Sumi (sections: aim, method, participants, results with effect sizes, limitations, next steps).

### Acceptance checklist

- [ ] On fake data with a built in effect, the script recovers the right direction and roughly the right effect size.
- [ ] Re running gives identical output (fixed random seeds).
- [ ] Exclusion counts match a manual check on a small dataset.
- [ ] Report clearly states it is a pilot and shows effect sizes with 95% CIs, not just p values.

## Phase 2 (later, not now)

Extend to four styles (neutral, warm, enthusiastic, exaggerated), add between subjects or Latin square design as needed, possibly an interactive version. Do not build for this yet beyond keeping conditions config driven.
