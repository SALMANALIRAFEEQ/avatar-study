# Saving responses to Google Sheets

The study site sends each finished run to a small Google Apps Script attached to a Google Sheet. The script checks the data and adds rows to three tabs:

- `participants`: one row per person
- `responses`: one row per person per video (two rows per person)
- `partials`: a short marker when someone leaves partway through. These are only used to count drop-outs, never in the analysis.

It costs nothing and there is no server to run. Setup takes about 10 minutes.

## 1. Create the Sheet

1. Go to https://sheets.google.com and create a blank spreadsheet.
2. Name it something like `Avatar Study Responses`.

## 2. Add the script

1. In the spreadsheet, open **Extensions → Apps Script**.
2. Delete everything in the `Code.gs` editor and paste in the full contents of [`Code.gs`](Code.gs) from this folder.
3. Click the save icon.
4. In the function dropdown at the top, choose **`testSetup`** and click **Run**.
5. Google asks for permission. Choose your account, then **Advanced → Go to (project name) (unsafe) → Allow**. The "unsafe" warning appears because you wrote the script yourself and Google hasn't reviewed it. That's normal.
6. Go back to the spreadsheet. You should now see the tabs `participants`, `responses` and `partials`, each with a header row.

## 3. Deploy it as a web app

1. In the Apps Script editor, click **Deploy → New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Set:
   - Description: `v1`
   - **Execute as: Me**
   - **Who has access: Anyone**
4. Click **Deploy** and copy the **Web app URL**. It looks like `https://script.google.com/macros/s/AKfy.../exec`.

"Anyone" is required because participants aren't signed in to your Google account. The script only adds rows and rejects anything that doesn't look like data from the study site. Nobody can read the Sheet through this URL.

## 4. Put the URL into the site

Open `study/config/study.config.json` and replace the placeholder:

```json
"endpoint_url": "https://script.google.com/macros/s/AKfy.../exec",
```

The site now saves to the Sheet. While the placeholder is still there, the site only saves into your own browser, which is useful for local testing.

## 5. Check it works

1. Open the web app URL with this added to the end: `?action=next_sequence&ids=S1,S2,S3,S4`.
   You should see something like `{"ok":true,"sequence_id":"S1","completed":0}`.
2. Do a full run of the study with `?debug=1` at the end of the site URL.
3. In the Sheet: `participants` should have 1 new row and `responses` 2 new rows, all with `is_test` = TRUE.
4. Delete those test rows before real data collection, or simply filter on `is_test`. The analysis drops them either way.

## Changing the script later (important)

After editing `Code.gs`, **do not** click "New deployment". That creates a **new URL** and the live site would keep sending to the old one.

Instead:

1. **Deploy → Manage deployments**
2. Click the **pencil (Edit)** icon on the existing deployment
3. **Version: New version**
4. Click **Deploy**

The URL stays the same.

## Good to know

- `APP_VERSION_PREFIX` at the top of `Code.gs` (currently `1a.`) must match the start of `app_version` in the config. If you change the version to `1b.0.0`, update the prefix too, or every submission will be rejected.
- The lists of questions in `Code.gs` (`DEMO_ITEMS`, `RATING_ITEMS` and the column lists) match the pilot questionnaire. If you add or remove a question in the config, update `Code.gs` too and redeploy. Otherwise submissions are rejected, or the new answers are not saved.
- Values are written under the column with the same name in the header row, so adding a question just adds a column at the end of the sheet. Existing rows never shift.
- To check which version of the script is live, open the web app URL with `?action=next_sequence&ids=S1` at the end and look at `script_version` in the reply.
- If the same run arrives twice (for example a retry after a slow connection), the script recognises the participant ID and writes it only once.
- Never share or commit exports of this Sheet: the repository is public.
