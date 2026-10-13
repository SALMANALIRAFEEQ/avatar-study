# Deploying the study

The site is plain HTML/CSS/JS served by GitHub Pages straight from the `main` branch. There is no build step and no GitHub Actions workflow. Responses go to Google Sheets through the Apps Script in `backend/apps_script/` (setup steps in its README).

## Before going live (checklist)

- [x] Real videos and thumbnails are in `study/media/` (Kora neutral and warm, 720p, about 2 MB each)
- [ ] Salman has reviewed the edited neutral video (`assets/Kora Video 3.mp4`)
- [ ] Sound check clip: the computer-voice "orange" is fine to keep, or replace `study/media/soundcheck.mp3`
- [ ] `endpoint_url` in the config is your Apps Script web app URL
- [ ] Test rows deleted from the Sheet, or left there (the analysis drops `is_test = TRUE` anyway)
- [ ] A full run on an Android phone and on a desktop, using the live URL

## 1. Make the repository public

GitHub Pages is free only for **public** repositories. While the repo is private there is no live site.

GitHub → the `avatar-study` repo → **Settings → General** → scroll to **Danger Zone → Change repository visibility → Make public**.

Before making it public, check that the repo contains no response data or exports. `analysis/data/` is gitignored for this reason.

## 2. Turn on GitHub Pages

**Settings → Pages**:

- Source: **Deploy from a branch**
- Branch: **main**, folder **/ (root)**
- Click **Save**

After a minute or two the site is live at:

```
https://salmanalirafeeq.github.io/avatar-study/
```

That is the participant link. It redirects to `study/`. For a test run add `?debug=1`. That marks the rows as test rows and lets you skip videos.

## 3. Updating the site later

Edit, commit, push to `main`. Pages redeploys automatically in about a minute. Participants who are already partway through keep their progress.

If you change questions or items after real data collection has started, also change `app_version` in the config so the rows can be told apart. Versions are major.minor.patch: raise the **patch** number (1a.2.0 to 1a.2.1) only when the screens stay the same, such as an added write-in box, so people partway through can continue. Raise the **minor** number (1a.2 to 1a.3) when screens or their order change; runs in progress then start again from the beginning. And keep `APP_VERSION_PREFIX` in `Code.gs` matching (see the Apps Script README).

## Running locally

From the repo folder:

```
python -m http.server 8000
```

Then open http://127.0.0.1:8000/study/?debug=1. Opening `index.html` directly from disk does not work, because the browser blocks loading the config file that way.

Local runs also save to the real Sheet while `endpoint_url` is set. Use `?debug=1` so they are marked as test rows.

## Placeholder media

`tools/make_placeholder_media.py` makes placeholder videos and a sound check clip for testing (needs ffmpeg). It skips files that already exist, so it never overwrites the real videos unless you pass `--force`.
