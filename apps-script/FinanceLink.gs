/**
 * Garage ← Finance link (read-only).
 *
 * Lets the Garage app show a car's loan balance and its insurance sinking fund
 * straight from the Finance (Ledger) Google Sheet, so Garage never stores them
 * itself. It mirrors the existing link the other way (Ledger's script reads
 * Garage's Sheet via GARAGE_ID).
 *
 * Setup (once):
 *   1. In Garage's Apps Script project, add this file (File › New › Script, name it FinanceLink).
 *   2. Project Settings › Script Properties › Add: FINANCE_SHEET_ID = the ID of your Finance Sheet
 *      (the long part of its address between /d/ and /edit).
 *   3. In Code.gs, inside doPost, right after the secret-word check, route the new action:
 *        if (body.action === 'finance') return <your JSON reply>(garageFinance_());
 *      ("body" and the reply helper are whatever your doPost already uses for other actions.)
 *   4. Deploy › Manage deployments › ✏️ › New version › Deploy.
 *
 * It only reads the readable "Accounts" and "Goals" tabs that Ledger writes
 * (never the private _data tab) and never writes anything.
 */
function garageFinance_() {
  var id = PropertiesService.getScriptProperties().getProperty('FINANCE_SHEET_ID');
  if (!id) return { fin: null, finError: 'Add FINANCE_SHEET_ID to Garage\'s Script Properties' };
  var ss;
  try { ss = SpreadsheetApp.openById(id); } catch (e) { return { fin: null, finError: 'Cannot open the Finance Sheet: ' + (e && e.message || e) }; }
  var acc = gfTable_(ss, 'Accounts'), goals = gfTable_(ss, 'Goals');
  return {
    fin: {
      at: new Date().toISOString(),
      accounts: acc.map(function (r) {
        var owed = gfNum_(r['owed']);
        return { name: gfText_(r['account']), type: gfText_(r['type']).toLowerCase(), balance: gfNum_(r['balance']), owed: owed === null ? null : Math.abs(owed) };
      }).filter(function (a) { return a.name; }),
      goals: goals.map(function (r) {
        return { name: gfText_(r['goal']), type: gfText_(r['type']), target: gfNum_(r['target']), saved: gfNum_(r['set aside (manual goals)']),
                 due: gfDate_(r['target date']), achieved: /^(true|yes|1)$/i.test(gfText_(r['achieved'])) };
      }).filter(function (g) { return g.name; })
    }
  };
}

/** Rows of a tab as objects keyed by lower-case header (row 1). Missing tab -> []. */
function gfTable_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  var v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  var head = v[0].map(function (h) { return String(h).trim().toLowerCase(); });
  return v.slice(1).map(function (row) { var o = {}; head.forEach(function (h, i) { if (h) o[h] = row[i]; }); return o; });
}
function gfText_(x) { return x === null || x === undefined ? '' : String(x).trim(); }
function gfNum_(x) {
  if (x === '' || x === null || x === undefined) return null;
  var n = typeof x === 'number' ? x : Number(String(x).replace(/[^0-9.\-]/g, ''));
  return isFinite(n) ? Math.round(n * 100) / 100 : null;
}
function gfDate_(x) {
  if (x instanceof Date) return Utilities.formatDate(x, 'Asia/Kuala_Lumpur', 'yyyy-MM-dd');
  var s = gfText_(x);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '';
}
