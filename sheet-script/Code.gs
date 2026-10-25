/**
 * Parking pass backend for the Nagar Kirtan sevadar parking sheet.
 *
 * Paste this whole file into the Sheet: Extensions > Apps Script, replace
 * Code.gs, Save. Then Deploy > New deployment > Web app:
 *   Execute as: Me    Who has access: Anyone
 * Copy the Web app URL into app/public/data/parking.json (scriptUrl).
 *
 * Admin PIN: Project Settings (gear) > Script properties > Add property
 *   ADMIN_PIN = <your pin>
 *
 * The pass list is the first tab whose row 1 has a "Pass ID" header. The
 * script uses these headers (any order, case does not matter):
 *   Pass ID, License Plate, Category, Status, Phone Number, Notes,
 *   Check-In Time, Check-Out Time (added if missing)
 * Status is set to "Checked In" or "Checked Out". Every scan is also written
 * to a "Scan Log" tab (created if missing).
 */

var IN = 'Checked In';
var OUT = 'Checked Out';

function doGet(e) {
  return handle_((e && e.parameter) || {});
}

function doPost(e) {
  var body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'Bad request' });
  }
  return handle_(body);
}

function handle_(req) {
  try {
    var action = String(req.action || '');
    switch (action) {
      case 'ping':
        return json_({ ok: true });
      case 'lookup':
        return json_(lookup_(req));
      case 'checkin':
        return json_(withLock_(function () { return checkIn_(req); }));
      case 'checkout':
        return json_(withLock_(function () { return checkOut_(req); }));
      case 'undo':
        return json_(withLock_(function () { return undo_(req); }));
      case 'inside':
        return json_(inside_());
      case 'adminList':
        requirePin_(req);
        return json_(adminList_());
      case 'adminAdd':
        requirePin_(req);
        return json_(withLock_(function () { return adminAdd_(req); }));
      case 'adminCheck':
        requirePin_(req);
        return json_({ ok: true });
      default:
        return json_({ ok: false, error: 'Unknown action' });
    }
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

// ---------------------------------------------------------------------------

function lookup_(req) {
  var t = table_();
  var row = findRow_(t, req.passId);
  if (!row) return { ok: true, found: false, passId: normId_(req.passId), insideCount: countInside_(t) };
  return { ok: true, found: true, pass: passOut_(t, row), insideCount: countInside_(t) };
}

function checkIn_(req) {
  var t = table_();
  var row = findRow_(t, req.passId);
  if (!row) return { ok: true, result: 'notFound', passId: normId_(req.passId) };
  var before = snapshot_(t, row);
  if (isInside_(t, row) && !req.force) {
    return { ok: true, result: 'alreadyInside', pass: passOut_(t, row), insideCount: countInside_(t) };
  }
  var now = new Date();
  if (isInside_(t, row) && req.force) {
    // Missed checkout: close the old visit first.
    setCell_(t, row, 'check-out time', now);
    log_('Check-out (missed, fixed at gate)', t, row, req.gate);
  }
  setCell_(t, row, 'status', IN);
  setCell_(t, row, 'check-in time', now);
  setCell_(t, row, 'check-out time', '');
  log_('Check-in', t, row, req.gate);
  return { ok: true, result: 'checkedIn', pass: passOut_(t, row), before: before, insideCount: countInside_(t) };
}

function checkOut_(req) {
  var t = table_();
  var row = findRow_(t, req.passId);
  if (!row) return { ok: true, result: 'notFound', passId: normId_(req.passId) };
  if (!isInside_(t, row)) {
    return { ok: true, result: 'notInside', pass: passOut_(t, row), insideCount: countInside_(t) };
  }
  var before = snapshot_(t, row);
  setCell_(t, row, 'status', OUT);
  setCell_(t, row, 'check-out time', new Date());
  log_('Check-out', t, row, req.gate);
  return { ok: true, result: 'checkedOut', pass: passOut_(t, row), before: before, insideCount: countInside_(t) };
}

function undo_(req) {
  var t = table_();
  var row = findRow_(t, req.passId);
  if (!row || !req.before) return { ok: false, error: 'Nothing to undo' };
  var b = req.before;
  setCell_(t, row, 'status', b.status || '');
  setCell_(t, row, 'check-in time', b.checkIn ? new Date(b.checkIn) : '');
  setCell_(t, row, 'check-out time', b.checkOut ? new Date(b.checkOut) : '');
  log_('Undo', t, row, req.gate);
  return { ok: true, result: 'undone', pass: passOut_(t, row), insideCount: countInside_(t) };
}

function inside_() {
  var t = table_();
  var list = [];
  for (var r = 0; r < t.rows.length; r++) {
    if (isInside_(t, r + 2)) list.push(passOut_(t, r + 2));
  }
  list.sort(function (a, b) { return String(b.checkIn).localeCompare(String(a.checkIn)); });
  return { ok: true, insideCount: list.length, passes: list };
}

function adminList_() {
  var t = table_();
  var list = [];
  for (var r = 0; r < t.rows.length; r++) {
    var row = r + 2;
    if (!normId_(get_(t, row, 'pass id'))) continue;
    var p = passOut_(t, row);
    p.phone = String(get_(t, row, 'phone number') || '');
    list.push(p);
  }
  return { ok: true, passes: list, insideCount: countInside_(t) };
}

function adminAdd_(req) {
  var p = req.pass || {};
  var id = normId_(p.id);
  var plate = String(p.plate || '').trim().toUpperCase();
  if (!id) return { ok: false, error: 'Pass ID is required' };
  if (!plate) return { ok: false, error: 'License plate is required' };
  var t = table_();
  if (findRow_(t, id)) return { ok: false, error: 'Pass ID ' + id + ' already exists' };
  var values = t.headers.map(function (h) {
    var k = h.toLowerCase();
    if (k === 'pass id') return /^\d+$/.test(id) ? Number(id) : id;
    if (k === 'license plate') return plate;
    if (k === 'category') return String(p.category || '').trim();
    if (k === 'phone number') return String(p.phone || '').trim();
    if (k === 'notes') return String(p.notes || '').trim();
    return '';
  });
  t.sheet.appendRow(values);
  var newRow = t.sheet.getLastRow();
  // Keep phone numbers as text so leading zeros / + survive.
  var phoneCol = t.col['phone number'];
  if (phoneCol) t.sheet.getRange(newRow, phoneCol).setNumberFormat('@').setValue(String(p.phone || '').trim());
  t = table_();
  return { ok: true, pass: passOut_(t, findRow_(t, id)) };
}

// --- Sheet helpers ---------------------------------------------------------

function table_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var sheet = null;
  for (var i = 0; i < sheets.length; i++) {
    var lastCol = sheets[i].getLastColumn();
    if (!lastCol) continue;
    var hdr = sheets[i].getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
      return String(h).trim().toLowerCase();
    });
    if (hdr.indexOf('pass id') !== -1) { sheet = sheets[i]; break; }
  }
  if (!sheet) throw new Error('No tab with a "Pass ID" header in row 1');

  var lastCol2 = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol2).getValues()[0].map(function (h) { return String(h).trim(); });
  ['Status', 'Check-In Time', 'Check-Out Time'].forEach(function (name) {
    var has = headers.some(function (h) { return h.toLowerCase() === name.toLowerCase(); });
    if (!has) {
      headers.push(name);
      sheet.getRange(1, headers.length).setValue(name);
    }
  });
  var col = {};
  headers.forEach(function (h, i) { col[h.toLowerCase()] = i + 1; });
  var n = Math.max(sheet.getLastRow() - 1, 0);
  var rows = n ? sheet.getRange(2, 1, n, headers.length).getValues() : [];
  return { sheet: sheet, headers: headers, col: col, rows: rows };
}

function normId_(v) {
  return String(v == null ? '' : v).trim().replace(/^#/, '').replace(/^pass\s*#?\s*/i, '').trim().toUpperCase();
}

function findRow_(t, id) {
  var want = normId_(id);
  if (!want) return 0;
  var c = t.col['pass id'] - 1;
  for (var r = 0; r < t.rows.length; r++) {
    if (normId_(t.rows[r][c]) === want) return r + 2;
  }
  return 0;
}

function get_(t, row, key) {
  var c = t.col[key];
  if (!c) return '';
  return t.rows[row - 2][c - 1];
}

function setCell_(t, row, key, value) {
  var c = t.col[key];
  if (!c) return;
  t.sheet.getRange(row, c).setValue(value);
  t.rows[row - 2][c - 1] = value;
}

function isInside_(t, row) {
  return String(get_(t, row, 'status')).trim().toLowerCase() === IN.toLowerCase();
}

function countInside_(t) {
  var n = 0;
  for (var r = 0; r < t.rows.length; r++) if (isInside_(t, r + 2)) n++;
  return n;
}

function iso_(v) {
  return v instanceof Date ? v.toISOString() : (v ? String(v) : '');
}

function snapshot_(t, row) {
  return {
    status: String(get_(t, row, 'status') || ''),
    checkIn: iso_(get_(t, row, 'check-in time')),
    checkOut: iso_(get_(t, row, 'check-out time')),
  };
}

function passOut_(t, row) {
  return {
    id: normId_(get_(t, row, 'pass id')),
    plate: String(get_(t, row, 'license plate') || '').trim().toUpperCase(),
    category: String(get_(t, row, 'category') || ''),
    notes: String(get_(t, row, 'notes') || ''),
    status: String(get_(t, row, 'status') || ''),
    inside: isInside_(t, row),
    checkIn: iso_(get_(t, row, 'check-in time')),
    checkOut: iso_(get_(t, row, 'check-out time')),
  };
}

function log_(what, t, row, gate) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var log = ss.getSheetByName('Scan Log');
  if (!log) {
    log = ss.insertSheet('Scan Log');
    log.appendRow(['Time', 'Action', 'Pass ID', 'License Plate', 'Gate']);
    log.setFrozenRows(1);
  }
  log.appendRow([new Date(), what, normId_(get_(t, row, 'pass id')), get_(t, row, 'license plate'), String(gate || '')]);
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, error: 'Busy, try again' };
  try {
    return fn();
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

function requirePin_(req) {
  var pin = PropertiesService.getScriptProperties().getProperty('ADMIN_PIN');
  if (!pin) throw new Error('ADMIN_PIN is not set in Script properties');
  if (String(req.pin || '') !== String(pin)) throw new Error('Wrong PIN');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
