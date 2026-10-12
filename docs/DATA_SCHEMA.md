# Data Schema

## Transport

When the participant finishes, the site POSTs **one JSON payload per participant** to the Apps Script web app (Content-Type `text/plain` to avoid a CORS preflight). The script writes:

- **2 rows** to sheet `responses` (one per video, long format, best for analysis)
- **1 row** to sheet `participants` (per participant fields)

The script returns `{"ok": true, "participant_id": "..."}`. The site shows the completion code only after `ok: true`.

Also save a **partial** payload to sheet `partials` if a participant drops out after consent (on `visibilitychange` / `pagehide` via `navigator.sendBeacon`), so drop off points can be counted. Partials are never used in the main analysis.

## Sheet `participants` (one row per participant)

| Column | Type | Notes |
|---|---|---|
| participant_id | string (UUID v4) | generated in browser |
| app_version | string | e.g. "1a.0.3" from config |
| is_test | bool | true if `?debug=1` |
| started_at | ISO 8601 UTC | consent page shown |
| consented_at | ISO 8601 UTC | |
| submitted_at | ISO 8601 UTC | |
| total_duration_s | number | consent to submit |
| sequence_id | string | S1 to S4 |
| assignment_method | string | "rotation" or "random_fallback" |
| device_class | string | "mobile" / "desktop" / "tablet" |
| sound_check_attempts | int | |
| sound_check_passed | bool | |
| DEMO_age, DEMO_gender, DEMO_country, DEMO_online_shop, DEMO_ai_seen | string | stored as the option label |
| ATT_1 | int | raw answer |
| att_passed | bool | ATT_1 == 5 |
| CMP_trust, CMP_buy | string | "video1" / "video2" / "none" |
| CMP_why, CMP_noticed | string | free text, trimmed |
| completion_code | string | short random code, e.g. "KL7Q2M" |

## Sheet `responses` (one row per participant per video)

| Column | Type | Notes |
|---|---|---|
| participant_id | string | |
| is_test | bool | repeated for safe filtering |
| sequence_id | string | |
| position | int | 1 or 2 |
| condition | string | "neutral" / "warm" (later also "enthusiastic", "exaggerated") |
| product | string | "A" / "B" |
| video_file | string | file name from config |
| video_duration_s | number | from the media element |
| watch_time_s | number | seconds actually played |
| watch_completed | bool | reached `ended` |
| pauses | int | |
| replays | int | |
| block_started_at, block_submitted_at | ISO 8601 UTC | rating block timing |
| item_order | string | item IDs in the order shown, comma separated |
| MC_expressive, MC_warm | int 1 to 7 | |
| TR_1 to TR_5 | int 1 to 7 | |
| NAT_1 to NAT_5 | int 1 to 5 | |
| LIK_1 to LIK_5 | int 1 to 5 | |
| ENG_1 to ENG_3 | int 1 to 7 | |
| PI_1 to PI_3 | int 1 to 7 | |

## Rules

- Store raw numeric answers. Never store computed scale scores in the sheet; analysis computes them.
- Times in UTC.
- If the sheet columns don't exist yet, Code.gs creates the header row from the payload keys on first write, in a fixed column order defined in Code.gs (not payload order).
- Analysis reads a CSV export of each sheet (`analysis/data/participants.csv`, `analysis/data/responses.csv`).
