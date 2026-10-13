/**
 * AI Avatar Study: data collection web app.
 *
 * doPost  saves one finished run (1 row in `participants`, 1 row per video in `responses`)
 *         or a drop-out marker (1 row in `partials`).
 * doGet   ?action=next_sequence&ids=S1,S2,S3,S4[&test=1]
 *         returns the next sequence: (number of completed runs) mod (number of sequences).
 *
 * The web app URL is public, so everything sent here is checked. Anything that
 * doesn't look exactly like a payload from our site is dropped without writing.
 * This is spam filtering, not security.
 *
 * After editing this file: Deploy > Manage deployments > (pencil) Edit > Version: New version > Deploy.
 * Do NOT use "New deployment": that creates a new URL and the site stops saving.
 */

var SCRIPT_VERSION = 2;           // reported by doGet, so you can check a redeploy took effect
var APP_VERSION_PREFIX = '1a.';   // must match the start of app_version in study.config.json
var MAX_BYTES = 50000;            // bigger payloads are rejected
var LOCK_WAIT_MS = 20000;

var SHEET_PARTICIPANTS = 'participants';
var SHEET_RESPONSES = 'responses';
var SHEET_PARTIALS = 'partials';

// Background questions (docs/QUESTIONNAIRE.md, block DEMO). Stored as the option label.
var DEMO_ITEMS = [
  'DEMO_age', 'DEMO_gender', 'DEMO_country', 'DEMO_english',
  'DEMO_education', 'DEMO_occupation',
  'DEMO_online_shop', 'DEMO_social_media', 'DEMO_ai_tools', 'DEMO_ai_seen'
];

// Columns (docs/DATA_SCHEMA.md). Values are always written under the column with the
// same name in the sheet's header row, never by position. A column missing from an
// existing sheet is added at the end, so adding questions never shifts existing data.
var PARTICIPANT_COLUMNS = [
  'participant_id', 'app_version', 'is_test', 'started_at', 'consented_at', 'submitted_at',
  'total_duration_s', 'sequence_id', 'assignment_method', 'device_class',
  'sound_check_attempts', 'sound_check_passed',
  'DEMO_age', 'DEMO_gender', 'DEMO_country', 'DEMO_english',
  'DEMO_education', 'DEMO_occupation', 'DEMO_occupation_other',
  'DEMO_online_shop', 'DEMO_social_media', 'DEMO_ai_tools', 'DEMO_ai_seen',
  'ATT_1', 'att_passed',
  'CMP_trust', 'CMP_buy', 'CMP_why', 'CMP_noticed',
  'completion_code',
  'received_at'
];

var RATING_ITEMS = [
  'MC_expressive', 'MC_warm',
  'TR_1', 'TR_2', 'TR_3', 'TR_4', 'TR_5',
  'NAT_1', 'NAT_2', 'NAT_3', 'NAT_4', 'NAT_5',
  'LIK_1', 'LIK_2', 'LIK_3', 'LIK_4', 'LIK_5',
  'ENG_1', 'ENG_2', 'ENG_3',
  'PI_1', 'PI_2', 'PI_3'
];

var RESPONSE_COLUMNS = [
  'participant_id', 'is_test', 'sequence_id', 'position', 'condition', 'product', 'video_file',
  'video_duration_s', 'watch_time_s', 'watch_completed', 'pauses', 'replays',
  'block_started_at', 'block_submitted_at', 'item_order'
].concat(RATING_ITEMS);

var PARTIAL_COLUMNS = [
  'received_at', 'participant_id', 'app_version', 'is_test', 'sequence_id',
  'last_screen', 'last_screen_type', 'started_at', 'consented_at', 'sent_at', 'device_class'
];

// Godspeed scales (NAT, LIK) are 5 point; everything else is 7 point.
function itemMax(id) {
  return /^(NAT|LIK)_/.test(id) ? 5 : 7;
}

// ---------------------------------------------------------------- doPost

function doPost(e) {
  try {
    var body = e && e.postData && e.postData.contents;
    if (!body || body.length > MAX_BYTES) return reply({ ok: false });

    var data = JSON.parse(body);
    if (!data || typeof data !== 'object') return reply({ ok: false });

    if (data.kind === 'partial') return savePartial(data);
    return saveComplete(data);
  } catch (err) {
    return reply({ ok: false });
  }
}

function saveComplete(data) {
  var p = data.participant;
  var rs = data.responses;
  if (!validParticipant(p) || !Array.isArray(rs) || rs.length < 1 || rs.length > 10) return reply({ ok: false });
  for (var i = 0; i < rs.length; i++) {
    if (!validResponse(rs[i], p)) return reply({ ok: false });
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(LOCK_WAIT_MS);
  try {
    var ps = prepareSheet(SHEET_PARTICIPANTS, PARTICIPANT_COLUMNS);
    // A retry of a run that was already saved: confirm again, write nothing.
    if (columnHas(ps, 'participant_id', p.participant_id)) {
      return reply({ ok: true, participant_id: p.participant_id, duplicate: true });
    }

    var now = new Date().toISOString();
    var rsSheet = prepareSheet(SHEET_RESPONSES, RESPONSE_COLUMNS);
    var rrows = rs.map(function (r) { return rowFor(rsSheet.header, r, now); });

    // Responses first: if anything fails midway, the participant row (which marks the
    // run as saved) is missing and the site's retry writes everything again.
    rsSheet.sheet.getRange(rsSheet.sheet.getLastRow() + 1, 1, rrows.length, rsSheet.header.length).setValues(rrows);
    ps.sheet.appendRow(rowFor(ps.header, p, now));
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  return reply({ ok: true, participant_id: p.participant_id });
}

function savePartial(d) {
  if (!isUuid(d.participant_id) || !validVersion(d.app_version) || typeof d.is_test !== 'boolean') return reply({ ok: false });
  if (!isIntIn(d.last_screen, 0, 200) || !isShortString(d.last_screen_type, 30)) return reply({ ok: false });

  var lock = LockService.getScriptLock();
  lock.waitLock(LOCK_WAIT_MS);
  try {
    var pt = prepareSheet(SHEET_PARTIALS, PARTIAL_COLUMNS);
    pt.sheet.appendRow(rowFor(pt.header, d, new Date().toISOString()));
  } finally {
    lock.releaseLock();
  }
  return reply({ ok: true });
}

// ---------------------------------------------------------------- doGet

function doGet(e) {
  var params = (e && e.parameter) || {};
  if (params.action !== 'next_sequence') return reply({ ok: false });

  var ids = String(params.ids || '').split(',').filter(function (s) { return /^S\d{1,2}$/.test(s); });
  if (ids.length < 1) return reply({ ok: false });
  var wantTest = params.test === '1';

  // Count completed runs of the same kind, so debug runs rotate among themselves
  // and never shift the rotation for real participants. Read only: no lock needed.
  var count = 0;
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PARTICIPANTS);
  if (sheet && sheet.getLastRow() > 1) {
    var col = readHeader(sheet).indexOf('is_test') + 1;
    if (col > 0) {
      var values = sheet.getRange(2, col, sheet.getLastRow() - 1, 1).getValues();
      for (var i = 0; i < values.length; i++) {
        var isTest = values[i][0] === true || values[i][0] === 'TRUE';
        if (isTest === wantTest) count++;
      }
    }
  }
  return reply({ ok: true, sequence_id: ids[count % ids.length], completed: count, script_version: SCRIPT_VERSION });
}

// ---------------------------------------------------------------- validation

function validParticipant(p) {
  if (!p || typeof p !== 'object') return false;
  if (!isUuid(p.participant_id) || !validVersion(p.app_version) || typeof p.is_test !== 'boolean') return false;
  if (!isIso(p.started_at) || !isIso(p.consented_at) || !isIso(p.submitted_at)) return false;
  if (!isNumIn(p.total_duration_s, 0, 86400)) return false;
  if (!/^S\d{1,2}$/.test(p.sequence_id)) return false;
  if (['rotation', 'random_fallback', 'debug_forced'].indexOf(p.assignment_method) < 0) return false;
  if (p.assignment_method === 'debug_forced' && !p.is_test) return false;
  if (['mobile', 'desktop', 'tablet'].indexOf(p.device_class) < 0) return false;
  if (!isIntIn(p.sound_check_attempts, 0, 20) || typeof p.sound_check_passed !== 'boolean') return false;
  for (var i = 0; i < DEMO_ITEMS.length; i++) if (!isShortString(p[DEMO_ITEMS[i]], 80)) return false;
  if (!isText(p.DEMO_occupation_other, 100)) return false;
  if (!(p.ATT_1 === null || isIntIn(p.ATT_1, 1, 7)) || typeof p.att_passed !== 'boolean') return false;
  if (['video1', 'video2', 'none'].indexOf(p.CMP_trust) < 0 || ['video1', 'video2', 'none'].indexOf(p.CMP_buy) < 0) return false;
  if (!isText(p.CMP_why, 500) || !isText(p.CMP_noticed, 500)) return false;
  if (!/^[A-Z0-9]{6}$/.test(p.completion_code)) return false;
  return true;
}

function validResponse(r, p) {
  if (!r || typeof r !== 'object') return false;
  if (r.participant_id !== p.participant_id || r.is_test !== p.is_test || r.sequence_id !== p.sequence_id) return false;
  if (!isIntIn(r.position, 1, 10)) return false;
  if (!/^[a-z_]{1,30}$/.test(r.condition) || !/^[A-Z]{1,3}$/.test(r.product)) return false;
  if (!/^[\w.-]{1,80}$/.test(r.video_file)) return false;
  if (!(r.video_duration_s === null || isNumIn(r.video_duration_s, 0, 3600))) return false;
  if (!isNumIn(r.watch_time_s, 0, 36000) || typeof r.watch_completed !== 'boolean') return false;
  if (!isIntIn(r.pauses, 0, 10000) || !isIntIn(r.replays, 0, 10000)) return false;
  if (!isIso(r.block_started_at) || !isIso(r.block_submitted_at)) return false;
  if (!isShortString(r.item_order, 1000)) return false;
  for (var i = 0; i < RATING_ITEMS.length; i++) {
    if (!isIntIn(r[RATING_ITEMS[i]], 1, itemMax(RATING_ITEMS[i]))) return false;
  }
  return true;
}

function validVersion(v) { return typeof v === 'string' && v.indexOf(APP_VERSION_PREFIX) === 0 && v.length <= 20; }
function isUuid(v) { return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v); }
function isIso(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(v); }
function isIntIn(v, lo, hi) { return typeof v === 'number' && v % 1 === 0 && v >= lo && v <= hi; }
function isNumIn(v, lo, hi) { return typeof v === 'number' && isFinite(v) && v >= lo && v <= hi; }
function isShortString(v, max) { return typeof v === 'string' && v.length > 0 && v.length <= max; }
function isText(v, max) { return typeof v === 'string' && v.length <= max; }

// ---------------------------------------------------------------- helpers

// Free text starting with = + - @ would run as a formula in Sheets. Prefix it so it stays text.
function cell(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string' && /^[=+\-@]/.test(v)) return "'" + v;
  return v;
}

function readHeader(sheet) {
  if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
}

// Returns { sheet, header }, creating the sheet and adding any missing columns
// (at the end) to its header row. Call inside the lock.
function prepareSheet(name, columns) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  var header = readHeader(sheet);
  var missing = columns.filter(function (c) { return header.indexOf(c) < 0; });
  if (missing.length) {
    sheet.getRange(1, header.length + 1, 1, missing.length).setValues([missing]);
    header = header.concat(missing);
    if (sheet.getFrozenRows() === 0) sheet.setFrozenRows(1);
  }
  return { sheet: sheet, header: header };
}

// One row in the sheet's own column order, matched by column name.
function rowFor(header, obj, now) {
  return header.map(function (h) { return h === 'received_at' ? now : cell(obj[h]); });
}

function columnHas(prepared, columnName, value) {
  var sheet = prepared.sheet;
  var col = prepared.header.indexOf(columnName) + 1;
  var last = sheet.getLastRow();
  if (col < 1 || last < 2) return false;
  var found = sheet.getRange(2, col, last - 1, 1).createTextFinder(value).matchEntireCell(true).findNext();
  return found !== null;
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------- manual setup

// Run this from the editor (select testSetup, press Run) to create the three sheets,
// or to add new columns to existing ones, and to grant the script permission.
function testSetup() {
  prepareSheet(SHEET_PARTICIPANTS, PARTICIPANT_COLUMNS);
  prepareSheet(SHEET_RESPONSES, RESPONSE_COLUMNS);
  prepareSheet(SHEET_PARTIALS, PARTIAL_COLUMNS);
  Logger.log('Sheets ready (script version ' + SCRIPT_VERSION + ').');
}
