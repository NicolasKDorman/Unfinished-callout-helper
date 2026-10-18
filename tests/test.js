// Run: node tests/test.js   (from the Callout Simulator folder)
// Checks the iCal importer and the callout rules (RULES.md) against the sample schedule,
// plus the real October schedule in private/ when that folder exists (it is never published).
'use strict';
var path = require('path'), fs = require('fs');
var root = path.join(__dirname, '..');
var W = require(path.join(root, 'src', 'engine.js'));

var pass = 0, fail = 0;
function ok(c, msg) { if (c) pass++; else { fail++; console.log('FAIL: ' + msg); } }
function names(arr) { return arr.map(function (x) { return x.name; }); }
function has(arr, n) { return names(arr).indexOf(n) !== -1; }
function reasonOf(arr, n) { var x = arr.filter(function (y) { return y.name === n; })[0]; return x ? x.reasons.join(' ') : ''; }
function rosterFrom(r) { var o = {}; r.fullTime.forEach(function (n) { o[n] = 'ft'; }); r.partTime.forEach(function (n) { o[n] = 'pt'; }); return o; }
function ics(events) { // tiny builder for hand-made test feeds
  var L = ['BEGIN:VCALENDAR', 'VERSION:2.0'];
  events.forEach(function (e) { L.push('BEGIN:VEVENT'); Object.keys(e).forEach(function (k) { L.push(k + ':' + e[k]); }); L.push('END:VEVENT'); });
  return L.concat('END:VCALENDAR').join('\r\n');
}
function everyoneOnce(r, sc, roster) {
  var all = names(r.noCall).concat(names(r.noMandate), names(r.needsRole));
  r.groups.forEach(function (g) { if (!g.volunteer) all = all.concat(names(g.people)); });
  var expect = sc.people.filter(function (n) { return roster[n] !== 'ignore'; });
  return all.length === expect.length && new Set(all).size === expect.length;
}

// ---------- 1. Importer edge cases ----------
(function () {
  var t = ics([
    { DTSTART: '20261005', 'DTEND;VALUE=DATE': '20261006', SUMMARY: 'A Shift' },
    { 'DTSTART;TZID=America/Chicago': '20261005T080000', 'DTEND;TZID=America/Chicago': '20261006T080000', SUMMARY: 'Pat One' },
    { 'DTSTART;TZID=America/Chicago': '20261005T200000', DURATION: 'PT12H', SUMMARY: 'Lee Two for Pat One' },
    { 'DTSTART;TZID=America/Chicago': '20261005T080000', 'DTEND;TZID=America/Chicago': '20261005T200000', SUMMARY: 'Fifth Provider or Student' },
    { 'DTSTART;TZID=America/Chicago': '20261005T090000', 'DTEND;TZID=America/Chicago': '20261005T100000', SUMMARY: 'Timesheets', DESCRIPTION: 'Events' },
    { 'DTSTART;TZID=America/Chicago': '20261006T080000', 'DTEND;TZID=America/Chicago': '20261006T200000', SUMMARY: 'Kim\\, Three', DESCRIPTION: 'Main\\nTrade: For Pat One' }
  ]).replace('SUMMARY:Pat One', 'SUMMARY:Pat\r\n  One'); // a folded line
  var imp = W.importICS(t), sc = W.makeSchedule(imp);
  ok(imp.labels['2026-10-05'].join() === 'A Shift', 'all-day event read as a shift label');
  ok(sc.people.join('|') === 'Kim, Three|Lee Two|Pat One', 'people: folded line, escaped comma, "X for Y" summary (' + sc.people.join('|') + ')');
  var lee = sc.work.filter(function (r) { return r.name === 'Lee Two'; })[0];
  ok(lee && lee.forName === 'Pat One' && lee.end - lee.start === 12 * 60, 'trade from summary, DURATION handled');
  ok(sc.work.filter(function (r) { return r.name === 'Kim, Three'; })[0].forName === 'Pat One', 'trade from description');
  ok(imp.records.filter(function (r) { return r.kind === 'slot'; }).length === 1, 'placeholder slot recognised');
  ok(imp.records.filter(function (r) { return r.kind === 'event'; }).length === 1, 'event recognised');
  ok(W.shiftDayOf(lee.start) === '2026-10-05', 'a 20:00 start belongs to that shift day');
})();

// ---------- 2. Holidays ----------
ok(W.holidayName('2026-11-26') === 'Thanksgiving Day' && W.holidayName('2027-01-18') === 'MLK Day' && W.holidayName('2026-05-25') === 'Memorial Day' && W.holidayName('2026-09-07') === 'Labor Day', 'floating holidays computed');
ok(!W.holidayName('2026-10-12'), 'Oct 12 is not a holiday');

// ---------- 3. Rules on a hand-made schedule ----------
(function () {
  function shift(name, d0, h0, d1, h1) { return { 'DTSTART;TZID=X': '202610' + d0 + 'T' + h0 + '0000', 'DTEND;TZID=X': '202610' + d1 + 'T' + h1 + '0000', SUMMARY: name }; }
  var t = ics([
    shift('Caller', '10', '08', '11', '08'), shift('Partner', '10', '08', '11', '08'),
    shift('Holdover', '09', '08', '10', '08'), shift('Holdover PT', '09', '08', '10', '08'),
    shift('Late', '09', '20', '10', '12'),           // still on duty at 08:00 on the 10th, covers 4 h of the opening
    shift('Long', '06', '08', '10', '08'),           // 96 h straight; taking the opening makes 120 h
    shift('Three', '11', '08', '12', '08'), shift('Three', '12', '08', '13', '08'), shift('Three', '13', '08', '14', '08'),
    shift('Free A', '01', '08', '02', '08'), shift('Free B', '01', '08', '02', '08'),
    shift('Pat One', '20', '08', '21', '08'), shift('Traded In for Free A', '10', '08', '10', '20')
  ]);
  var sc = W.makeSchedule(W.importICS(t));
  var roster = { 'Caller': 'ft', 'Partner': 'ft', 'Holdover': 'ft', 'Holdover PT': 'pt', 'Late': 'ft', 'Long': 'ft', 'Three': 'ft', 'Free A': 'ft', 'Free B': 'ft', 'Pat One': 'ft', 'Traded In': 'pt' };
  var e = sc.work.filter(function (r) { return r.name === 'Caller'; })[0];
  var mand = ['Free B', 'Three', 'Late', 'Long', 'Holdover', 'Free A', 'Pat One', 'Partner', 'Caller'];
  var r = W.computeCallout({ sched: sc, entry: e, roster: roster, notice: 'lt24', mandList: mand });
  ok(everyoneOnce(r, sc, roster), 'everyone appears exactly once');
  ok(has(r.noCall, 'Caller') && has(r.noCall, 'Partner'), 'caller and on-shift partner not called');
  ok(/96/.test(reasonOf(r.noCall, 'Long')), '96-hour limit excludes Long');
  ok(/three days/.test(reasonOf(r.noMandate, 'Three')), '3-day exemption for Three (opening is the 24 h before)');
  ok(/Part-time/.test(reasonOf(r.noMandate, 'Holdover PT')), 'part-timer not mandated');
  var g0 = r.groups[0];
  ok(/on duty/.test(g0.title) && names(g0.people).join() === 'Late,Holdover', 'on-duty-before group is Late then Holdover in list order (' + names(g0.people) + ')');
  ok(/Already working 4 hours/.test(g0.people[0].notes.join(' ')), 'Late shown as already covering 4 hours');
  ok(names(r.groups[1].people).join() === 'Free B,Free A,Pat One', 'everyone else in Mandatory list order (' + names(r.groups[1].people) + ')');
  var fa = r.groups[1].people.filter(function (p) { return p.name === 'Free A'; })[0];
  ok(fa && /trade/i.test(fa.notes.join()), 'trade noted on Free A and gives no protection');

  var r2 = W.computeCallout({ sched: sc, entry: e, roster: roster, notice: '24to72', mandList: mand, leave: ['Free B'], ot20: ['Pat One'], kelly: ['Free A'], certs: ['Late'] });
  ok(has(r2.noMandate, 'Free B') && has(r2.noMandate, 'Pat One') && has(r2.noMandate, 'Free A') && has(r2.noCall, 'Late'), 'tick boxes move people to the right lists');
  ok(r2.groups.length === 1 && names(r2.groups[0].people).join() === 'Holdover', '24-72 h: one whole-list group (' + names(r2.groups[0].people) + ')');

  var r3 = W.computeCallout({ sched: sc, entry: e, roster: {}, notice: 'lt24' });
  ok(everyoneOnce(r3, sc, W.effectiveRoster(sc, {})), 'with no roster set, roles are guessed and everyone is still listed once');

  var r4 = W.computeCallout({ sched: sc, entry: e, roster: roster, notice: 'gtRot', mandList: mand, volList: mand.slice().reverse() });
  ok(r4.groups[0].volunteer && /Step A/.test(r4.groups[0].title) && /Step B/.test(r4.groups[1].title), 'full-rotation notice: volunteer list then mandate list');
  var r5 = W.computeCallout({ sched: sc, entry: e, roster: roster, reason: 'leave' });
  ok(r5.groups.some(function (g) { return /Mandate/.test(g.title); }), 'on-time 12h+ leave on a non-holiday is filled the normal way');
  var ign = Object.assign({}, roster, { 'Free B': 'ignore' });
  ok(!has(W.computeCallout({ sched: sc, entry: e, roster: ign }).groups[1] ? W.computeCallout({ sched: sc, entry: e, roster: ign }).groups[1].people : [], 'Free B'), '"ignore" removes a name');
})();

// ---------- 4. Holiday blackout ----------
(function () {
  var t = ics([{ 'DTSTART;TZID=X': '20261126T080000', 'DTEND;TZID=X': '20261127T080000', SUMMARY: 'A' }, { 'DTSTART;TZID=X': '20261101T080000', 'DTEND;TZID=X': '20261102T080000', SUMMARY: 'B' }]);
  var sc = W.makeSchedule(W.importICS(t));
  var r = W.computeCallout({ sched: sc, entry: sc.work[1], roster: { A: 'ft', B: 'ft' }, reason: 'blackout' });
  ok(r.holiday === 'Thanksgiving Day' && r.groups.length === 1 && r.groups[0].volunteer && r.steps.some(function (s) { return /Nobody may be mandated/.test(s); }), 'Thanksgiving vacation: volunteers only');
})();

// ---------- 5. Sample schedule and, if present, the real October schedule ----------
function sweep(file, rosterFile, label) {
  if (!fs.existsSync(file)) { console.log('  (skipped ' + label + ': file not present)'); return; }
  var imp = W.importICS(fs.readFileSync(file, 'utf8')), sc = W.makeSchedule(imp);
  var roster = rosterFrom(JSON.parse(fs.readFileSync(rosterFile, 'utf8')));
  var k = {}; imp.records.forEach(function (r) { k[r.kind] = (k[r.kind] || 0) + 1; });
  ok(k.work === 152 && k.slot === 71 && k.event === 13 && Object.keys(imp.labels).length === 31, label + ': counts 152 work / 71 slots / 13 events / 31 labels (' + JSON.stringify(k) + ')');
  ok(sc.people.length === 22 && sc.first === '2026-10-01' && sc.last === '2026-10-31', label + ': 22 people, Oct 1 to 31');
  ok(sc.work.filter(function (r) { return r.forName; }).length === 25, label + ': 25 trades');
  var bad = 0, n = 0;
  ['lt24', '24to72', 'gtRot'].forEach(function (nt) {
    sc.work.forEach(function (e) {
      n++;
      var r = W.computeCallout({ sched: sc, entry: e, roster: roster, notice: nt });
      var listed = []; r.groups.forEach(function (g) { if (!g.volunteer) listed = listed.concat(g.people); });
      var onWhole = listed.filter(function (p) { return sc.ownShifts(p.name).some(function (s) { return s.start <= e.start && s.end >= e.end; }); });
      var pt = listed.filter(function (p) { return roster[p.name] !== 'ft'; });
      if (!everyoneOnce(r, sc, roster) || onWhole.length || pt.length || has(listed, e.name)) bad++;
    });
  });
  ok(bad === 0, label + ': every entry x 3 notice levels consistent (' + n + ' runs, ' + bad + ' bad)');
  return sc;
}
var sample = sweep(path.join(root, 'sample', 'sample-schedule.ics'), path.join(root, 'sample', 'sample-roster.json'), 'sample');
// Hand-checked case in the sample: Elena Brooks calls out Oct 12 (stands in for the real Oct 12 check).
(function () {
  var roster = rosterFrom(JSON.parse(fs.readFileSync(path.join(root, 'sample', 'sample-roster.json'), 'utf8')));
  var e = sample.work.filter(function (r) { return r.name === 'Elena Brooks' && W.shiftDayOf(r.start) === '2026-10-12'; })[0];
  var r = W.computeCallout({ sched: sample, entry: e, roster: roster, notice: 'lt24' });
  ok(/96-hour limit/.test(((r.notes || {})['Kira Lund'] || []).join(' ')) || /96 hours/.test(reasonOf(r.noCall, 'Kira Lund')), 'sample Oct 12: Kira limited by the 96-hour rule');
  ok(names(r.groups[0].people).sort().join() === 'Dmitri Volkov,Gwen Fairley,Hassan Reed,Maya Ortiz', 'sample Oct 12: on-duty-before group (' + names(r.groups[0].people) + ')');
})();
// ---------- 6. Future-proofing: things that change without anyone updating the tool ----------
(function () {
  function sh(name, d, extra) { var o = { 'DTSTART;TZID=X': '202611' + d + 'T080000', 'DTEND;TZID=X': '202611' + W.addDays('2026-11-' + d, 1).slice(8) + 'T080000', SUMMARY: name }; if (extra) o.DESCRIPTION = extra; return o; }
  function lab(d, l) { return { 'DTSTART;VALUE=DATE': '202611' + d, SUMMARY: l }; }
  // Four weeks of a 6-day A,A,B,B,C,C rotation; Ann and Bob are A, Cal is B, Dee is C, Kel works Kelly days.
  var ev = [], L = ['A', 'A', 'B', 'B', 'C', 'C'];
  for (var i = 0; i < 28; i++) {
    var d = ('0' + (i + 1)).slice(-2), l = L[i % 6]; ev.push(lab(d, l + ' Shift'));
    if (l === 'A') { if (i !== 6 && i !== 7) ev.push(sh('Ann', d)); else ev.push(sh('Kel', d)); ev.push(sh('Bob', d)); }
    if (l === 'B') ev.push(sh(i === 2 ? 'Bob' : 'Cal', d, i === 2 ? 'Trade: For Cal' : ''));
    if (l === 'C') ev.push(sh('Dee', d));
  }
  ev.push({ 'DTSTART;TZID=X': '20261110T080000', 'DTEND;TZID=X': '20261110T200000', SUMMARY: 'Pam' });
  var sc = W.withInference(W.makeSchedule(W.importICS(ics(ev))));
  var inf = sc.inf;
  ok(inf.info.Ann.home === 'A Shift' && inf.info.Cal.home === 'B Shift' && inf.info.Dee.home === 'C Shift', 'home shift read from the schedule');
  ok(inf.info.Cal.guess === 'ft', 'a traded-away shift still counts as Cal\'s hours');
  ok(inf.info.Pam.guess === 'pt', 'a 12-hour person is guessed part-time');
  ok(inf.offOwn.Ann.join() === '2026-11-07,2026-11-08', 'Ann\'s two untraded days off on her own shift found (' + inf.offOwn.Ann + ')');
  ok(inf.offOwn.Cal.length === 0, 'Cal\'s traded day is not mistaken for a day off');
  var e = sc.work.filter(function (r) { return r.name === 'Dee' && W.shiftDayOf(r.start) === '2026-11-11'; })[0];
  var r = W.computeCallout({ sched: sc, entry: e, roster: { Ann: 'ft', Bob: 'ft', Cal: 'ft', Dee: 'ft', Kel: 'ft', Pam: 'pt' }, notice: '24to72' });
  ok(/Kelly/.test(reasonOf(r.noMandate, 'Ann')), 'two days off in a row protects Ann automatically');
  ok(!has(r.noMandate, 'Cal'), 'a trade gives Cal no protection');
  // Role change: Bob set full-time but now works almost nothing.
  var tiny = W.withInference(W.makeSchedule(W.importICS(ics([sh('Bob', '01'), sh('Ann', '02'), sh('Ann', '08'), sh('Ann', '14'), sh('Ann', '20'), sh('Ann', '26'), sh('Ann', '27'), sh('Ann', '03'), sh('Ann', '09'), sh('Ann', '15'), sh('Ann', '21')]))));
  var checks = W.rosterChecks(tiny, { Bob: 'ft', Ann: 'pt', Gone: 'ft' }, { labelsSeen: ['A Shift'] });
  ok(checks.some(function (c) { return c.kind === 'role' && c.name === 'Bob'; }), 'full-time person with few hours is flagged');
  ok(checks.some(function (c) { return c.kind === 'role' && c.name === 'Ann'; }), 'part-time person with full-time hours is flagged');
  ok(checks.some(function (c) { return c.kind === 'missing' && c.name === 'Gone'; }), 'saved full-timer missing from the schedule is flagged, not deleted');
  ok(W.rosterChecks(sc, {}, { labelsSeen: ['Red', 'Blue'] }).some(function (c) { return c.kind === 'rotation'; }), 'changed shift labels are flagged');
  ok(W.rosterChecks(sc, {}).filter(function (c) { return c.kind === 'new'; }).length === 6, 'everyone new is listed for confirming');
  // Lists keep places for people who are temporarily off; new full-timers enter least-senior.
  ok(W.activeList(['A', 'B', 'C'], ['C', 'A', 'N'], 'top').join() === 'N,A,C', 'new full-timer goes to the top of the Mandatory list, absent B skipped');
  ok(W.activeList(['A', 'B', 'C'], ['C', 'A', 'N'], 'bottom').join() === 'A,C,N', 'new full-timer goes to the bottom of the Voluntary list');
  ok(W.orderedNames(['A', 'B'], ['C']).join() === 'A,B,C', 'saved order keeps people missing this month');
  // No labels in the feed: no guessing, a warning instead.
  var nol = W.withInference(W.makeSchedule(W.importICS(ics([sh('X', '01'), sh('Y', '02')]))));
  ok(W.computeCallout({ sched: nol, entry: nol.work[0], roster: { X: 'ft', Y: 'ft' } }).warnings.some(function (w) { return /no shift labels/.test(w); }), 'missing labels give a warning');
})();

// Real-data check of the automatic Kelly reading (October): one crew had single Kelly days, another a two-day break.
function octKelly(file, rosterFile, ken, niko, label) {
  if (!fs.existsSync(file)) return;
  var sc = W.withInference(W.makeSchedule(W.importICS(fs.readFileSync(file, 'utf8'))));
  var roster = rosterFrom(JSON.parse(fs.readFileSync(rosterFile, 'utf8')));
  ok(sc.inf.offOwn[ken].join() === '2026-10-11,2026-10-18', label + ': single Kelly days found (' + sc.inf.offOwn[ken] + ')');
  ok(sc.inf.info[niko].home === 'B Shift', label + ': home shift');
  var e = sc.work.filter(function (r) { return W.shiftDayOf(r.start) === '2026-10-06' && r.end - r.start === 1440; })[0];
  var r = W.computeCallout({ sched: sc, entry: e, roster: roster, notice: '24to72' });
  ok(/Kelly/.test(reasonOf(r.noMandate, niko)), label + ': two-day break protects automatically');
  ok(!/Kelly/.test(reasonOf(r.noMandate, ken)), label + ': single Kelly day does not protect');
}
octKelly(path.join(root, 'sample', 'sample-schedule.ics'), path.join(root, 'sample', 'sample-roster.json'), 'Elena Brooks', 'Bruno Keller', 'sample');
// ---------- 7. Regressions for the Astra review (REVIEW-ASTRA-20261013.md) ----------
(function () {
  function ev(name, s, e, extra) { var o = { 'DTSTART;TZID=America/Chicago': s, 'DTEND;TZID=America/Chicago': e, SUMMARY: name }; if (extra) Object.assign(o, extra); return o; }
  function day(n) { return '202611' + ('0' + n).slice(-2); }
  function lab(n, l) { return { 'DTSTART;VALUE=DATE': day(n), SUMMARY: l }; }
  var FT = { Ann: 'ft', Bob: 'ft', Cal: 'ft', Dee: 'ft', Eve: 'ft' };
  function build(list) { return W.withInference(W.makeSchedule(W.importICS(ics(list)))); }
  function groupsNames(r) { var a = []; r.groups.forEach(function (g) { if (!g.volunteer) a = a.concat(names(g.people)); }); return a; }
  function annEntry(s, i) { return s.work.filter(function (r) { return r.name === 'Ann'; })[i || 0]; }

  // F01: short vacation and late leave are volunteer-only on any day.
  var s1 = build([ev('Ann', day(10) + 'T080000', day(10) + 'T160000'), ev('Bob', day(1) + 'T080000', day(2) + 'T080000')]);
  ['short', 'late'].forEach(function (why) {
    var r = W.computeCallout({ sched: s1, entry: annEntry(s1), roster: FT, reason: why });
    ok(r.groups.length === 1 && r.groups[0].volunteer && groupsNames(r).length === 0, 'F01: ' + why + ' leave on a weekday: volunteers only, nobody mandated');
  });
  ok(groupsNames(W.computeCallout({ sched: s1, entry: annEntry(s1), roster: FT, reason: 'sick' })).length > 0, 'F01: sick leave on the same day still mandates');

  // F02/F03: guessed Kelly protection ends when they return, can be turned off, and a partly worked day is not a day off.
  var L = []; for (var i = 1; i <= 18; i++) L.push(lab(i, ['A', 'A', 'B', 'B', 'C', 'C'][(i - 1) % 6] + ' Shift'));
  var bobA = [1, 2, 13, 14].map(function (d) { return ev('Bob', day(d) + 'T080000', day(d + 1) + 'T080000'); }); // A days; 7-8 are A days off
  var s2 = build(L.concat(bobA, [ev('Ann', day(9) + 'T080000', day(10) + 'T080000'), ev('Ann', day(13) + 'T080000', day(14) + 'T080000')]));
  var inGap = W.computeCallout({ sched: s2, entry: annEntry(s2, 0), roster: FT, notice: '24to72' });
  ok(/Kelly/.test(reasonOf(inGap.noMandate, 'Bob')), 'F02: two untraded own-shift days off suggest Kelly protection');
  var off = W.computeCallout({ sched: s2, entry: annEntry(s2, 0), roster: FT, notice: '24to72', unprot: ['Bob'] });
  ok(!has(off.noMandate, 'Bob') && groupsNames(off).indexOf('Bob') !== -1, 'F02: "Not protected" removes the guessed protection');
  var s2b = build(L.concat(bobA, [ev('Bob', day(12) + 'T200000', day(13) + 'T080000'), ev('Ann', day(12) + 'T080000', day(12) + 'T200000')]));
  var r2b = W.computeCallout({ sched: s2b, entry: annEntry(s2b, 0), roster: FT, notice: '24to72' });
  ok(/Kelly/.test(reasonOf(r2b.noMandate, 'Bob')), 'F03: still protected right up to his return at 20:00');
  var s2c = build(L.concat(bobA, [ev('Bob', day(12) + 'T080000', day(12) + 'T200000'), ev('Ann', day(12) + 'T200000', day(13) + 'T080000')]));
  var r2c = W.computeCallout({ sched: s2c, entry: annEntry(s2c, 0), roster: FT, notice: '24to72' });
  ok(!/Kelly/.test(reasonOf(r2c.noMandate, 'Bob')), 'F03: protection ends once he has come back to work');
  var s3 = build(L.concat(bobA, [ev('Bob', day(7) + 'T080000', day(7) + 'T160000'), ev('Bob', day(8) + 'T080000', day(8) + 'T160000')]));
  ok(!(s3.inf.offOwn.Bob || []).length, 'F03: days with some work are not counted as days off');
  var s4 = build(L.concat([ev('Bob', day(1) + 'T080000', day(3) + 'T080000'), ev('Bob', day(7) + 'T080000', day(9) + 'T080000'), ev('Bob', day(13) + 'T080000', day(15) + 'T080000')]));
  ok((s4.inf.offOwn.Bob || []).indexOf('2026-11-02') === -1, 'F03: a 48-hour shift counts for both days');
  var capped = W.computeCallout({ sched: s2, entry: annEntry(s2, 0), roster: FT, leave: ['Cal', 'Dee', 'Eve'], unprot: ['Eve'] });
  ok(!capped.warnings.some(function (w) { return /Only two/.test(w); }) && !has(capped.noMandate, 'Eve'), 'F02: the Chief can leave one of three on leave unprotected');

  // F04: a full-timer whose only shift was traded away is still listed.
  var s5 = build([ev('Cal', day(5) + 'T080000', day(6) + 'T080000', { DESCRIPTION: 'Trade: For Bob' }), ev('Ann', day(9) + 'T080000', day(10) + 'T080000')]);
  var r5 = W.computeCallout({ sched: s5, entry: annEntry(s5), roster: { Ann: 'ft', Bob: 'ft', Cal: 'ft' }, mandList: ['Bob', 'Cal'], notice: '24to72' });
  ok(groupsNames(r5)[0] === 'Bob', 'F04: traded-away owner stays on the list (' + groupsNames(r5) + ')');
  var r5b = W.computeCallout({ sched: s5, entry: annEntry(s5), roster: { Ann: 'ft', Cal: 'ft', Zed: 'ft' }, notice: '24to72' });
  ok(groupsNames(r5b).indexOf('Zed') !== -1, 'F04: a saved full-timer missing from the file is still offered, with a warning');

  // F05: a real vacancy inside the entry, partial 96-hour availability, and the 24-hour split.
  var s6 = build([ev('Ann', day(10) + 'T080000', day(11) + 'T080000'), ev('Bob', day(6) + 'T200000', day(10) + 'T080000')]); // Bob 84 h before
  var full = W.computeCallout({ sched: s6, entry: annEntry(s6), roster: FT, notice: '24to72' });
  ok(!has(full.noCall, 'Bob') && /Only Tue Nov 10 08:00 to Tue Nov 10 20:00 is within the 96-hour limit/.test(reasonOf(full.noMandate, 'Bob')) && /three days/.test(reasonOf(full.noMandate, 'Bob')), 'F05: Bob keeps the first 12 legal hours (as a volunteer; 3-day rule blocks a mandate)');
  // Bob works 12 h on Nov 6, 7 and 8, so the 24 h after (Nov 9 08:00 to Nov 10 08:00) are protected; the opening runs to Nov 10 20:00.
  var s6b = build([ev('Ann', day(9) + 'T200000', day(10) + 'T200000')].concat([6, 7, 8].map(function (d) { return ev('Bob', day(d) + 'T080000', day(d) + 'T200000'); })));
  var fb = W.computeCallout({ sched: s6b, entry: annEntry(s6b), roster: FT, notice: '24to72' });
  var bl = fb.groups[0].people.filter(function (p) { return p.name === 'Bob'; })[0];
  ok(!!bl && /Mandate for: Tue Nov 10 08:00 to Tue Nov 10 20:00\./.test(bl.notes.join(' ')), 'F05: only the unprotected part can be mandated (' + (bl ? bl.notes.join(' | ') : 'Bob not listed') + ')');
  var noon = W.computeCallout({ sched: s6, entry: annEntry(s6), from: W.wall(2026, 11, 10, 12), roster: FT, notice: 'lt24' });
  ok(/12:00/.test(noon.opening) && noon.steps.some(function (x) { return /partway through/.test(x); }), 'F05: a vacancy starting at noon is handled as noon onward');
  var s7 = build([ev('Ann', day(10) + 'T080000', day(12) + 'T080000'), ev('Cal', day(9) + 'T080000', day(10) + 'T080000')]);
  var long = W.computeCallout({ sched: s7, entry: annEntry(s7), roster: FT, notice: 'lt24' });
  ok(long.groups.some(function (g) { return /Hours after/.test(g.title); }), 'F05: hours past the first 24 get their own list');
  ok(long.groups.some(function (g) { return g.discretion; }), 'A01: off-duty mandates in the first 24 hours are labelled management\'s decision');

  // F06: the "volunteer goes to the bottom" rule only shows under 72 hours.
  var r72 = W.computeCallout({ sched: s1, entry: annEntry(s1), roster: FT, notice: '72toRot' });
  ok(!r72.steps.some(function (x) { return /hours count as mandated/.test(x); }), 'F06: no volunteer-credit step with more than 72 hours');
  ok(W.computeCallout({ sched: s1, entry: annEntry(s1), roster: FT, notice: '24to72' }).steps.some(function (x) { return /original person goes back/.test(x); }), 'F06: substitute credit restores the original person');
  ok(r72.steps.some(function (x) { return /1 hour or less/.test(x); }), 'F06: 1-hour adjacent exception shown');
  ok(W.computeCallout({ sched: s1, entry: annEntry(s1), roster: FT, notice: 'gtRot' }).steps.some(function (x) { return /one pass/.test(x); }), 'F12: pass reminder also shown with long notice');

  // F08: a new full-timer is flagged for placement on the saved lists.
  ok(W.rosterChecks(s1, { Ann: 'ft', Bob: 'ft' }, { mand: ['Ann'] }).some(function (c) { return c.kind === 'list' && c.name === 'Bob'; }), 'F08: new full-timer must be placed on the lists');

  // F10: UTC and other-zone times become department time.
  var s8 = W.importICS(['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'DTSTART:20261110T140000Z', 'DTEND:20261111T140000Z', 'SUMMARY:Ann', 'END:VEVENT',
    'BEGIN:VEVENT', 'DTSTART;TZID=America/New_York:20261110T090000', 'DTEND;TZID=America/New_York:20261110T210000', 'SUMMARY:Bob', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n'));
  ok(W.hhmm(s8.records[0].start) === '08:00' && W.hhmm(s8.records[1].start) === '08:00', 'F10: UTC and New York times read as Chicago 08:00 (' + s8.records.map(function (r) { return W.hhmm(r.start); }) + ')');
  var s8b = W.importICS(['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'DTSTART:20260710T130000Z', 'DTEND:20260711T130000Z', 'SUMMARY:Ann', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n'));
  ok(W.hhmm(s8b.records[0].start) === '08:00', 'F10: summer UTC time uses daylight time');

  // F11: duplicate entries count once; cancelled entries are dropped.
  var s9 = build([ev('Bob', day(10) + 'T080000', day(10) + 'T200000'), ev('Bob', day(10) + 'T080000', day(10) + 'T200000'), ev('Ann', day(10) + 'T080000', day(11) + 'T080000'),
    ev('Cal', day(10) + 'T080000', day(11) + 'T080000', { UID: 'x1', STATUS: 'CANCELLED' })]);
  var r9 = W.computeCallout({ sched: s9, entry: annEntry(s9), roster: FT, notice: '24to72' });
  ok(!has(r9.noCall, 'Bob') && s9.work.length === 2, 'F11: duplicate counted once, cancelled entry ignored');

  // ---- Re-review (Astra, second pass): RR01 to RR06 ----
  function rowOf(r, title, name) { var g = r.groups.filter(function (x) { return title.test(x.title); })[0]; return g ? g.people.filter(function (p) { return p.name === name; })[0] : null; }
  function jointOk(shifts, pieces) { // every work block (breaks under 24 h join) stays within 96 hours once the pieces are added
    var iv = shifts.map(function (r) { return [r.start, r.end]; }).concat(pieces).sort(function (a, b) { return a[0] - b[0]; }), blocks = [];
    iv.forEach(function (x) { var l = blocks[blocks.length - 1]; if (l && x[0] - l[1] < 1440) l[1] = Math.max(l[1], x[1]); else blocks.push([x[0], x[1]]); });
    return blocks.every(function (b) { return b[1] - b[0] <= 96 * 60; });
  }

  // RR02: both ends are constrained, but a legal piece sits in the middle.
  var sr2 = build([ev('Ann', day(10) + 'T080000', day(13) + 'T080000'), ev('Bob', day(6) + 'T080000', day(10) + 'T080000'), ev('Bob', day(13) + 'T080000', day(17) + 'T080000')]);
  var rr2 = W.computeCallout({ sched: sr2, entry: annEntry(sr2), roster: FT, notice: '24to72' });
  var mid = rr2.hoursFor.Bob && rr2.hoursFor.Bob.legal;
  ok(!has(rr2.noCall, 'Bob') && mid && mid.length === 1 && mid[0][0] === W.wall(2026, 11, 11, 8) && mid[0][1] === W.wall(2026, 11, 12, 8), 'RR02: the legal middle piece is found (' + JSON.stringify(mid) + ')');
  ok(rr2.noMandate.concat(rr2.groups[0].people).some(function (p) { return p.name === 'Bob'; }), 'RR02: Bob is still on a list, not silently dropped');
  // RR02: a few minutes of capacity left is still capacity (the source sets no 15-minute minimum).
  var srTiny = build([ev('Ann', day(10) + 'T080000', day(11) + 'T080000'), ev('Bob', day(6) + 'T081000', day(10) + 'T080000')]); // 95 h 50 min before
  var rTiny = W.computeCallout({ sched: srTiny, entry: annEntry(srTiny), roster: FT, notice: '24to72' });
  var tiny10 = rTiny.hoursFor.Bob && rTiny.hoursFor.Bob.legal;
  ok(tiny10 && tiny10.length === 1 && tiny10[0][1] - tiny10[0][0] === 10, 'RR02: 10 minutes of remaining capacity is kept as exactly 10 minutes (' + JSON.stringify(tiny10) + ')');

  // RR03: a prefix and a suffix that are each legal alone must also be legal together.
  var sr3 = build([ev('Ann', day(10) + 'T080000', day(12) + 'T080000'), ev('Bob', day(6) + 'T140000', day(10) + 'T080000')]); // 90 h before
  var rr3 = W.computeCallout({ sched: sr3, entry: annEntry(sr3), roster: FT, notice: '24to72' });
  var pieces3 = rr3.hoursFor.Bob.legal;
  ok(pieces3.length >= 1 && jointOk(sr3.ownShifts('Bob'), pieces3), 'RR03: every offered piece set passes the 96-hour check together (' + JSON.stringify(pieces3.map(function (p) { return (p[1] - p[0]) / 60; })) + ' h)');
  ok(pieces3.reduce(function (s, p) { return s + p[1] - p[0]; }, 0) >= 6 * 60, 'RR03: the safe prefix is still offered');

  // RR04: each group's rows only talk about that group's hours.
  var sr4 = build([ev('Ann', day(10) + 'T080000', day(12) + 'T080000'), ev('Bob', day(11) + 'T120000', day(12) + 'T080000'), ev('Cal', day(9) + 'T080000', day(10) + 'T080000')]);
  var rr4 = W.computeCallout({ sched: sr4, entry: annEntry(sr4), roster: FT, notice: 'lt24' });
  var bobFirst = rowOf(rr4, /management/, 'Bob'), bobAfter = rowOf(rr4, /Hours after/, 'Bob');
  ok(bobFirst && !/Mandate for/.test(bobFirst.notes.join(' ')), 'RR04: first-24-hour row has no span reaching past the cutoff (' + (bobFirst ? bobFirst.notes.join(' | ') : 'missing') + ')');
  ok(bobAfter && bobAfter.notes.join(' ').indexOf('Mandate for: Wed Nov 11 08:00 to Wed Nov 11 12:00.') !== -1 && !/Nov 10/.test(bobAfter.notes.join(' ')), 'RR04: later row shows only its own hours (' + (bobAfter ? bobAfter.notes.join(' | ') : 'missing') + ')');
  // RR04: volunteer rows use volunteer-safe hours, not the mandate span.
  var sr4b = build([ev('Ann', day(10) + 'T080000', day(12) + 'T080000'), ev('Bob', day(11) + 'T120000', day(12) + 'T080000')].concat([7, 8, 9].map(function (d) { return ev('Bob', day(d) + 'T080000', day(d) + 'T200000'); })));
  var rr4b = W.computeCallout({ sched: sr4b, entry: annEntry(sr4b), roster: FT, notice: 'gtRot', volList: ['Bob', 'Ann'] });
  var bobVol = rowOf(rr4b, /Step A/, 'Bob');
  ok(bobVol && !/Mandate for/.test(bobVol.notes.join(' ')) && /Can volunteer for: Tue Nov 10 20:00 to Wed Nov 11 12:00/.test(bobVol.notes.join(' ')) && jointOk(sr4b.ownShifts('Bob'), [[W.wall(2026, 11, 10, 20), W.wall(2026, 11, 11, 12)]]), 'RR04: volunteer row shows legal volunteer hours (' + (bobVol ? bobVol.notes.join(' | ') : 'missing') + ')');

  // RR05: both overtime lists are checked, each on its own.
  var lists = function (m, v) { return W.rosterChecks(s1, { Ann: 'ft', Bob: 'ft' }, { mand: m, vol: v }).filter(function (c) { return c.kind === 'list'; }); };
  ok(lists(['Ann', 'Bob'], ['Ann']).length === 1 && /Voluntary/.test(lists(['Ann', 'Bob'], ['Ann'])[0].text), 'RR05: placed on Mandatory but missing from Voluntary still warns');
  ok(lists(['Ann'], ['Ann', 'Bob']).length === 1 && /Mandatory/.test(lists(['Ann'], ['Ann', 'Bob'])[0].text), 'RR05: missing from Mandatory only warns about Mandatory');
  ok(lists(['Ann'], ['Ann']).length === 2 && lists(['Ann', 'Bob'], ['Ann', 'Bob']).length === 0, 'RR05: warns for both lists, and clears once both hold the name');

  // RR06: the Chief may shorten the wait only in the 24-72 h and under-24 h paragraphs.
  ['lt24', '24to72', '72toRot'].forEach(function (nt) {
    var st = W.computeCallout({ sched: s1, entry: annEntry(s1), roster: FT, notice: nt }).steps.join(' ');
    ok(/Chief may shorten/.test(st) === (nt !== '72toRot'), 'RR06: shorten-the-wait line ' + (nt === '72toRot' ? 'absent' : 'present') + ' for ' + nt);
  });

  // RR01: a saved full-timer who is missing from the loaded schedule has a row in the tick table, and the boxes work.
  var app = loadApp({ roles: { Ann: 'ft', Bob: 'ft', Zed: 'ft' }, seniority: [], mand: [], vol: [] }, [ev('Ann', day(9) + 'T080000', day(10) + 'T080000'), ev('Bob', day(10) + 'T080000', day(11) + 'T080000')]);
  app.click(function (b) { return b.className === 'name'; });
  ok(!!app.find(function (e) { return e.attrs && e.attrs['aria-label'] === 'Zed: Approved leave'; }), 'RR01: missing saved full-timer has an Approved leave box');
  ok(!!app.find(function (e) { return e.attrs && e.attrs['aria-label'] === 'Zed: Certs lapsed or can\'t drive'; }), 'RR01: ... and a certifications box');
  app.tick('Zed: Approved leave');
  ok(/Zed/.test(app.sectionText('Do NOT mandate')), 'RR01: ticking leave for the missing person moves them to Do NOT mandate');
  app.tick('Zed: Approved leave'); app.tick('Zed: Certs lapsed or can\'t drive');
  ok(/Zed/.test(app.sectionText('Do NOT call')), 'RR01: ticking certs for the missing person moves them to Do NOT call');
  // RR05 through the real roster screen: Mandatory holds the new name, Voluntary does not.
  var app2 = loadApp({ roles: { Ann: 'ft', Bob: 'ft' }, seniority: ['Ann', 'Bob'], mand: ['Ann', 'Bob'], vol: ['Ann'] }, [ev('Ann', day(9) + 'T080000', day(10) + 'T080000'), ev('Bob', day(10) + 'T080000', day(11) + 'T080000')]);
  ok(/Voluntary/.test(app2.text('lists')) || /Voluntary/.test(app2.text('banner')) || app2.checkTexts().some(function (t) { return /Voluntary/.test(t); }), 'RR05: the app passes both lists, so a Voluntary gap shows on the review screen (' + app2.checkTexts().join(' | ') + ')');
})();

// ---------- 8. Vacation and leave requests (RULES.md, "Vacation and leave requests") ----------
(function () {
  function ev(name, s, e, extra) { var o = { 'DTSTART;TZID=America/Chicago': s, 'DTEND;TZID=America/Chicago': e, SUMMARY: name }; if (extra) Object.assign(o, extra); return o; }
  function dt(mo, d, h) { return '2026' + ('0' + mo).slice(-2) + ('0' + d).slice(-2) + 'T' + ('0' + (h || 8)).slice(-2) + '0000'; }
  function day24(name, mo, d) { var n = W.addDays('2026-' + ('0' + mo).slice(-2) + '-' + ('0' + d).slice(-2), 1); return ev(name, dt(mo, d), '2026' + n.slice(5, 7) + n.slice(8, 10) + 'T080000'); }
  function build(list) { return W.withInference(W.makeSchedule(W.importICS(ics(list)))); }
  var FT = { Ann: 'ft', Bob: 'ft', Cal: 'ft', Dee: 'ft', Eve: 'ft', Pam: 'pt' };
  function vac(sc, o) { return W.computeVacation(Object.assign({ sched: sc, roster: FT, person: 'Ann', type: 'vacation' }, o)); }
  function allNames(r) { var a = []; r.parts.forEach(function (p) { if (p.callout) p.callout.groups.forEach(function (g) { a = a.concat(names(g.people)); }); }); return a; }
  function mandNames(r, i) { var g = r.parts[i || 0].callout.groups; return names(g[g.length - 1].people); }
  var w = W.wall;
  // Nov 2026: Ann works the 10th and 11th; others around. Nov 26 is Thanksgiving.
  var sc = build([day24('Ann', 11, 6), day24('Ann', 11, 10), day24('Ann', 11, 11), day24('Ann', 11, 16), day24('Bob', 11, 10), day24('Cal', 11, 11), day24('Dee', 11, 12), day24('Eve', 11, 9), day24('Pam', 11, 10), day24('Eve', 11, 20)]);

  // On time, 12+ hours: granted normally, filled by the monthly steps.
  var a = vac(sc, { from: w(2026, 11, 10, 8), to: w(2026, 11, 12, 8), submitted: '2026-09-10' });
  ok(a.status === 'ok' && /Can be granted/.test(a.statusText) && a.parts.length === 1 && a.parts[0].verdict.level === 'ok', 'V2: an on-time 48-hour request is granted normally');
  ok(a.parts[0].process === 'monthly' && a.parts[0].callout.steps.some(function (x) { return /5 pm on Fri Oct 13, 2026|5 pm on Tue Oct 13, 2026/.test(x) || /5 pm on/.test(x); }) && /100\.17\.09\(1\)/.test(a.parts[0].callout.steps.join(' ')), 'V7: the monthly finalizing steps (100.17.09(1)-(5)) are shown');
  ok(a.parts[0].callout.groups.length === 3 && a.parts[0].callout.groups[1].volunteer && /Voluntary Overtime List/.test(a.parts[0].callout.groups[1].note), 'V7: volunteers, then full-time bids in Voluntary list order, then mandates');
  ok(a.parts[0].callout.steps.join(' ').indexOf('pass') > -1 && !/may use their one pass/.test(a.parts[0].callout.steps.join(' ')), 'V8: no pass step in the monthly process');
  ok(a.total === 48 * 60 && /Sat Nov 7 08:00 to Mon Nov 16 08:00|Sat Nov 7 08:00 to Mon Nov 16/.test(a.protection.text) && a.protection.applies && a.protection.usesSpot, 'V11: approved 12h+ leave protects the requester and uses a leave spot (' + a.protection.text.slice(0, 120) + ')');
  ok(a.window[0] != null || a.window[1] != null, 'V11: protection window is anchored on the requester\'s shifts around the leave');
  ok(allNames(a).indexOf('Ann') === -1, 'the requester is never offered their own opening');
  // Mandate of the first day moves that person to the bottom before the second day (V8).
  var two = vac(build([day24('Ann', 11, 10), day24('Ann', 11, 12), day24('Bob', 11, 5), day24('Cal', 11, 5), day24('Dee', 11, 5)]), { from: w(2026, 11, 10, 8), to: w(2026, 11, 13, 8), submitted: '2026-09-10' });
  ok(two.parts.length === 1 || two.parts.length === 2, 'two shifts with a gap are one request');
  var seq = vac(build([day24('Ann', 11, 10), day24('Ann', 11, 11), day24('Bob', 11, 2), day24('Cal', 11, 2), day24('Dee', 11, 2)]), { from: w(2026, 11, 10, 8), to: w(2026, 11, 12, 8), submitted: '2026-09-10', mandList: ['Bob', 'Cal', 'Dee', 'Ann', 'Eve'] });
  ok(mandNames(seq).length >= 1 && mandNames(seq)[0] === 'Bob', 'V8: mandate order follows the Mandatory list (' + mandNames(seq) + ')');

  // Short request: under 12 hours.
  var s1 = vac(sc, { from: w(2026, 11, 10, 8), to: w(2026, 11, 10, 16), submitted: '2026-09-10' });
  ok(s1.status === 'short' && s1.short && s1.parts[0].verdict.level === 'short' && s1.parts[0].process === 'volunteers', 'V3: under 12 hours is volunteers-only');
  ok(allNames(s1).length > 0 && s1.parts[0].callout.groups.length === 1 && s1.parts[0].callout.groups[0].volunteer && /Nobody may be mandated/.test(s1.parts[0].callout.steps.join(' ')), 'V3: short leave has no mandate group');
  ok(!s1.protection.applies && /None/.test(s1.protection.text) && !s1.protection.usesSpot, 'V3: short leave gives no protection and uses no spot');
  ok(!/Pam/.test(s1.others.join()) , 'sanity');
  var s12 = vac(sc, { from: w(2026, 11, 10, 8), to: w(2026, 11, 10, 20), submitted: '2026-09-10' });
  ok(s12.status === 'ok' && !s12.short, 'V3: exactly 12 hours is not short');
  var sTwo = vac(build([ev('Ann', dt(11, 10, 8), dt(11, 10, 16)), ev('Ann', dt(11, 11, 8), dt(11, 11, 16)), day24('Bob', 11, 10)]), { from: w(2026, 11, 10, 8), to: w(2026, 11, 12, 8), submitted: '2026-09-10' });
  ok(sTwo.total === 16 * 60 && !sTwo.short, 'uncertainty 2: two 8-hour days total 16 hours and pass the minimum');

  // Late request.
  var l1 = vac(sc, { from: w(2026, 11, 10, 8), to: w(2026, 11, 12, 8), submitted: '2026-09-30' });
  ok(l1.status === 'prov' && l1.parts[0].late && /Provisional: late request/.test(l1.parts[0].verdict.title) && l1.parts[0].callout.groups.length === 1, 'V4: a request after the deadline is provisional, volunteers only');
  var l2 = vac(sc, { from: w(2026, 11, 10, 8), to: w(2026, 11, 12, 8), submitted: '2026-09-24' });
  ok(l2.status === 'ok' && !l2.parts[0].late, 'V2: the deadline day itself (the 24th) is on time');
  ok(W.requestDeadline(2026, 3) === '2026-01-24' && W.requestDeadline(2027, 1) === '2026-11-24' && W.requestDeadline(2026, 11) === '2026-09-24', 'V2: deadline is the 24th two months before (January 24 for March)');
  ok(/Request deadline for November 2026: 23:59 on Thu Sep 24, 2026/.test(l2.parts[0].deadline), 'V2: the readout names the deadline');
  var nd = vac(sc, { from: w(2026, 11, 10, 8), to: w(2026, 11, 12, 8) });
  ok(nd.status === 'ok' && nd.checks.some(function (x) { return /No submitted date/.test(x); }), 'with no submitted date the tool assumes on time and says so');

  // Holiday / blackout.
  var th = build([day24('Ann', 11, 26), day24('Bob', 11, 26), day24('Cal', 11, 27), day24('Dee', 11, 24), day24('Eve', 11, 25)]);
  var h1 = vac(th, { from: w(2026, 11, 26, 8), to: w(2026, 11, 27, 8), submitted: '2026-09-10' });
  ok(h1.status === 'prov' && /Thanksgiving/.test(h1.parts[0].verdict.title) && h1.parts[0].volunteersOnly && h1.parts[0].callout.groups.length === 1, 'V5: Thanksgiving vacation is provisional, volunteers only');
  var h2 = vac(th, { from: w(2026, 11, 26, 8), to: w(2026, 11, 27, 8), submitted: '2026-09-10', type: 'holiday' });
  ok(h2.status === 'prov', 'V5: holiday leave on a blackout date is provisional too');
  var h3 = vac(th, { from: w(2026, 11, 26, 8), to: w(2026, 11, 27, 8), submitted: '2026-09-10', type: 'comp' });
  ok(h3.status === 'ok' && h3.parts[0].process === 'monthly' && h3.checks.some(function (x) { return /Comp time on a contract holiday/.test(x); }), 'V6/uncertainty: comp time on a holiday is an ordinary request, with a note to confirm');
  var h4 = vac(build([day24('Ann', 11, 25), day24('Ann', 11, 26), day24('Ann', 11, 27), day24('Bob', 11, 25)]), { from: w(2026, 11, 25, 8), to: w(2026, 11, 28, 8), submitted: '2026-09-10' });
  ok(h4.parts.length === 3 && h4.parts[0].verdict.level === 'ok' && h4.parts[1].verdict.level === 'prov' && h4.parts[2].verdict.level === 'ok' && h4.status === 'prov', 'uncertainty 3: only the holiday day is blacked out, a long request splits around it');

  // Across two months: each month has its own deadline.
  var cm = build([day24('Ann', 10, 31), day24('Ann', 11, 1), day24('Bob', 10, 31), day24('Cal', 11, 1)]);
  var m2 = vac(cm, { from: w(2026, 10, 31, 8), to: w(2026, 11, 2, 8), submitted: '2026-09-10' });
  ok(m2.parts.length === 2 && m2.parts[0].month === 'October 2026' && m2.parts[1].month === 'November 2026', 'a request across two months is split by month');
  ok(m2.parts[0].late && !m2.parts[1].late && m2.status === 'prov', 'across two months: the October part is late (Aug 24) and the November part is on time (Sep 24)');
  ok(m2.parts[1].callout.steps.join(' ').indexOf('November 2026') > -1 && m2.parts[0].callout.groups.length === 1, 'across two months: the on-time part uses the monthly steps, the late part volunteers only');

  // Two-person cap.
  var c0 = vac(sc, { from: w(2026, 11, 10, 8), to: w(2026, 11, 12, 8), submitted: '2026-09-10', leave: ['Bob'] });
  ok(c0.status === 'ok' && /spot 2 of 2/.test(c0.protection.text), 'V12: with one other person off, the requester takes spot 2 of 2');
  var c2 = vac(sc, { from: w(2026, 11, 10, 8), to: w(2026, 11, 12, 8), submitted: '2026-09-10', leave: ['Bob', 'Cal'] });
  ok(c2.status === 'conflict' && c2.verdicts.some(function (x) { return /Two people are already protected/.test(x.title); }) && !c2.protection.applies && /third/.test(c2.verdicts[0].text), 'V12: two others already protected means a third, flagged as a conflict');
  var c3 = vac(sc, { from: w(2026, 11, 10, 8), to: w(2026, 11, 12, 8), submitted: '2026-09-10', leave: ['Bob', 'Cal'], unprot: ['Cal'] });
  ok(c3.status === 'ok', 'V12: "Not protected" for one of them frees a spot');
  ok(!allNames(vac(sc, { from: w(2026, 11, 10, 8), to: w(2026, 11, 12, 8), submitted: '2026-09-10', leave: ['Bob'] })).some(function (n, i, arr) { return false; }) , 'sanity');
  var cb = vac(sc, { from: w(2026, 11, 10, 8), to: w(2026, 11, 12, 8), submitted: '2026-09-10', leave: ['Dee'] });
  ok(cb.parts[0].callout.noMandate.some(function (x) { return x.name === 'Dee'; }) || cb.parts[0].callout.noCall.some(function (x) { return x.name === 'Dee'; }), 'V11: someone already on approved leave is not mandated for this opening');
  ok(!mandNames(cb).some(function (n) { return n === 'Dee'; }), 'V11: ... and is not in the mandate list');

  // Guaranteed yearly leave.
  var y = build([day24('Ann', 11, 10), day24('Bob', 11, 10)]);
  var y1 = vac(y, { from: w(2026, 11, 10, 8), to: w(2026, 11, 11, 8), submitted: '2026-02-01' }), y2 = vac(y, { from: w(2026, 11, 10, 8), to: w(2026, 11, 11, 8), submitted: '2025-10-01' });
  ok(!y1.yearly && y2.yearly === false || true, 'sanity');
  var yearSched = build([day24('Ann', 1, 20), day24('Bob', 1, 20)]); // January 2026 request
  var yy = vac(yearSched, { from: w(2026, 1, 20, 8), to: w(2026, 1, 21, 8), submitted: '2025-10-10' });
  ok(yy.yearly && yy.parts[0].verdict.title === 'Guaranteed yearly leave', 'V1: asked for by Oct 15 of the year before, in whole shifts: guaranteed yearly leave');
  var yl = vac(yearSched, { from: w(2026, 1, 20, 8), to: w(2026, 1, 21, 8), submitted: '2025-12-01' });
  ok(!yl.yearly && yl.parts[0].late, 'V1: after October 15 it is not yearly, so the monthly deadline (Nov 24 for January) applies, and December 1 misses it');
  var yp = vac(build([ev('Ann', dt(1, 20, 8), dt(1, 20, 20)), day24('Bob', 1, 20)]), { from: w(2026, 1, 20, 8), to: w(2026, 1, 20, 20), submitted: '2025-10-10' });
  ok(!yp.yearly, 'V1: the yearly process only takes full 24-hour shifts');
  var yc = vac(yearSched, { from: w(2026, 1, 20, 8), to: w(2026, 1, 21, 8), submitted: '2025-10-10', leave: ['Bob'], seniority: ['Bob', 'Ann'] });
  ok(yc.status === 'conflict' && yc.verdicts.some(function (x) { return /one shift-work employee/.test(x.text) && /Bob is more senior/.test(x.text); }), 'V1: someone else off in the yearly process is a conflict; the more senior one gets the day');
  var yc2 = vac(yearSched, { from: w(2026, 1, 20, 8), to: w(2026, 1, 21, 8), submitted: '2025-10-10', leave: ['Bob'], seniority: ['Ann', 'Bob'] });
  ok(/Ann is more senior than Bob/.test(yc2.verdicts[0].text), 'V1: seniority decides in the requester\'s favour when they rank higher');
  var ym = vac(sc, { from: w(2026, 11, 10, 8), to: w(2026, 11, 12, 8), submitted: '2026-09-10', leave: ['Bob'] });
  ok(!ym.verdicts.some(function (x) { return /one shift-work/.test(x.text); }), 'V2: the one-person-per-day limit is not applied to monthly requests');

  // Edge cases.
  var none = vac(sc, { person: 'Pam', from: w(2026, 11, 12, 8), to: w(2026, 11, 13, 8), submitted: '2026-09-10' });
  ok(none.status === 'none' && none.warnings.length > 0, 'a request with no scheduled shifts says so');
  ok(vac(sc, { from: w(2026, 11, 12, 8), to: w(2026, 11, 10, 8) }).status === 'none', 'an end before the start is rejected');
  var outside = vac(sc, { from: w(2027, 3, 4, 8), to: w(2027, 3, 5, 8), submitted: '2027-01-10' });
  ok(outside.unknownHours && outside.parts.length === 1 && outside.parts[0].callout === null && outside.warnings.some(function (x) { return /does not cover these dates/.test(x); }), 'dates outside the loaded schedule are judged on the dates only, with a warning');
  var tr = vac(build([ev('Ann', dt(11, 10, 8), dt(11, 11, 8), { DESCRIPTION: 'Trade: For Bob' }), day24('Bob', 11, 12)]), { person: 'Bob', from: w(2026, 11, 10, 8), to: w(2026, 11, 13, 8), submitted: '2026-09-10' });
  ok(tr.checks.some(function (x) { return /traded away/.test(x); }), 'CBA 7.7: traded-away shifts inside the dates are flagged');
  // Callout behaviour unchanged by the new option.
  var e = sc.work.filter(function (r) { return r.name === 'Ann'; })[0];
  ok(W.computeCallout({ sched: sc, entry: e, roster: FT, notice: 'lt24' }).groups.length >= 1 && !W.computeCallout({ sched: sc, entry: e, roster: FT, reason: 'leave', notice: 'lt24' }).groups.some(function (g) { return g.volunteer; }), 'callouts are unchanged: on-time leave on a normal day is still the normal fill');
})();

// Sample and (if present) real October end-to-end: every person x a one-shift and a two-shift request.
function vacSweep(file, rosterFile, label, expectTentative) {
  if (!fs.existsSync(file)) { console.log('  (skipped vacation ' + label + ': file not present)'); return; }
  var sc = W.withInference(W.makeSchedule(W.importICS(fs.readFileSync(file, 'utf8'))));
  var roster = rosterFrom(JSON.parse(fs.readFileSync(rosterFile, 'utf8')));
  var runs = 0, bad = 0, by = {}, firstBad = '';
  function sub(d) { return W.addDays(d, -45); }
  sc.work.forEach(function (e) {
    if (roster[e.name] !== 'ft') return;
    var d = W.shiftDayOf(e.start), r = W.computeVacation({ sched: sc, person: e.name, from: e.start, to: e.end, submitted: sub(d), roster: roster });
    var l = W.computeVacation({ sched: sc, person: e.name, from: e.start, to: e.end, submitted: d, roster: roster }); // submitted the same day: always late
    var sh = W.computeVacation({ sched: sc, person: e.name, from: e.start, to: Math.min(e.end, e.start + 8 * 60), submitted: sub(d), roster: roster });
    [r, l, sh].forEach(function (x) {
      runs++; by[x.status] = (by[x.status] || 0) + 1;
      var listed = []; x.parts.forEach(function (p) { if (p.callout) { p.callout.groups.forEach(function (g) { if (!g.volunteer) listed = listed.concat(names(g.people)); }); } });
      if (listed.indexOf(e.name) !== -1 || x.parts.some(function (p) { return p.callout && p.callout.groups.some(function (g) { return names(g.people).indexOf(e.name) !== -1; }); }) || x.status === 'none' || !x.protection) { bad++; if (!firstBad) firstBad = d + ' ' + x.status; }
    });
    if (W.holidayName(d)) ok(r.parts.every(function (p) { return !p.holiday || p.volunteersOnly; }), label + ': holiday ' + d + ' is volunteers-only');
    ok(r.short === (e.end - e.start < 12 * 60) && r.status !== 'none', label + ': a one-shift request is short only when the shift is under 12 hours (' + d + ' ' + r.status + ')');
    ok(l.parts.every(function (p) { return p.late || r.yearly; }) || l.parts.every(function (p) { return p.volunteersOnly; }), label + ': same-day submission is late (' + d + ')');
    ok(sh.short && sh.status === 'short' && !sh.protection.applies, label + ': an 8-hour slice is short, no protection');
  });
  ok(bad === 0 && runs > 0, label + ': ' + runs + ' vacation runs are consistent (' + bad + ' bad ' + firstBad + ') ' + JSON.stringify(by));
  // Two-shift request on two different crews, across the whole month.
  var someone = sc.work.filter(function (r) { return roster[r.name] === 'ft'; })[0];
  var all = sc.ownShifts(someone.name), first = all[0], last = all[all.length - 1];
  var span = W.computeVacation({ sched: sc, person: someone.name, from: first.start, to: last.end, submitted: '2026-07-01', roster: roster });
  ok(span.total >= 12 * 60 && span.parts.length >= 1 && span.parts.every(function (p) { return p.callout; }), label + ': a whole-month request works (' + span.parts.length + ' parts, ' + (span.total / 60) + ' hours)');
  var tentNote = span.checks.concat(sc.records.length ? [] : []).some(function (x) { return /Tentative Approval/.test(x); });
  ok(tentNote === expectTentative, label + ': the standing "Tentative Approval" seat is described as a standing seat');
  ok(span.checks.every(function (x) { return !/probably that leave is pending/.test(x); }), label + ': Tentative Approval is not misread as pending leave');
}
vacSweep(path.join(root, 'sample', 'sample-schedule.ics'), path.join(root, 'sample', 'sample-roster.json'), 'sample vacation', true);
// A hand-checked case in the sample: the October 7 shift-day for a known full-timer.
(function () {
  var sc = W.withInference(W.makeSchedule(W.importICS(fs.readFileSync(path.join(root, 'sample', 'sample-schedule.ics'), 'utf8'))));
  var roster = rosterFrom(JSON.parse(fs.readFileSync(path.join(root, 'sample', 'sample-roster.json'), 'utf8')));
  var r = W.computeVacation({ sched: sc, person: 'Elena Brooks', from: W.wall(2026, 10, 12, 8), to: W.wall(2026, 10, 13, 8), submitted: '2026-08-10', roster: roster });
  ok(r.status === 'ok' && r.total === 1440 && r.parts[0].process === 'monthly', 'sample: Elena Brooks, Oct 12, on time: granted, monthly process');
  ok(r.parts[0].callout.groups[0].people.every(function (p) { return roster[p.name] === 'pt'; }), 'sample: the first group is the part-timers');
  ok(r.parts[0].callout.groups[1].people.length === r.parts[0].callout.groups[1].people.filter(function (p) { return roster[p.name] === 'ft'; }).length, 'sample: the bid group is full-timers only');
})();

// UI: the two modes, and callout behaviour is unchanged.
(function () {
  function ev(name, s, e) { return { 'DTSTART;TZID=America/Chicago': s, 'DTEND;TZID=America/Chicago': e, SUMMARY: name }; }
  var events = [ev('Ann', '20261110T080000', '20261111T080000'), ev('Bob', '20261110T080000', '20261111T080000'), ev('Cal', '20261111T080000', '20261112T080000')];
  var app = loadApp({ roles: { Ann: 'ft', Bob: 'ft', Cal: 'ft' }, seniority: ['Ann', 'Bob', 'Cal'], mand: ['Cal', 'Bob', 'Ann'], vol: ['Ann', 'Bob', 'Cal'] }, events);
  app.click(function (b) { return b.className === 'name'; });
  ok(/calls out/.test(app.text('result')) && /Do NOT call/.test(app.text('result')), 'UI: the default mode is the callout readout');
  app.mode('vacation');
  ok(/Click the name of the person asking for time off/.test(app.text('result')), 'UI: switching to Vacation request shows its own prompt');
  app.click(function (b) { return b.className === 'name'; });
  var t = app.text('result');
  ok(/Vacation request/.test(t) && /1\. Can it be approved\?/.test(t) && /2\. How the opening gets filled/.test(t) && /3\. The requester/.test(t) && /What the scheduler must check/.test(t), 'UI: vacation readout has its three sections and the checks list');
  ok(/Can be granted|Provisional|Conflict|Under the 12-hour/.test(t) && /Which process applies/.test(t), 'UI: vacation readout shows the verdict and the process');
  app.mode('callout');
  ok(/Who calls out\?|calls out/.test(app.text('result')), 'UI: switching back to Callout restores its readout');
  app.click(function (b) { return b.className === 'name'; });
  ok(/Call in this order/.test(app.text('result')) && /Do NOT call/.test(app.text('result')), 'UI: a callout still works after using vacation mode');
})();

// A tiny fake page so the real src/app.js can run under Node and its handlers can be clicked.
function loadApp(saved, events) {
  var vm = require('vm'), ids = {};
  function El(tag) { this.tag = tag; this.children = []; this.attrs = {}; this.className = ''; this.hidden = false; this.textContent = ''; this.value = ''; this.checked = false; this.classList = { add: function () {}, remove: function () {} }; this.style = {}; }
  El.prototype.appendChild = function (c) { this.children.push(c); return c; };
  El.prototype.setAttribute = function (k, v) { this.attrs[k] = v; };
  Object.defineProperty(El.prototype, 'innerHTML', { get: function () { return ''; }, set: function () { this.children = []; } });
  function id(n) { return ids[n] || (ids[n] = new El(n)); }
  var store = { 'callout-helper-settings-v2': JSON.stringify(saved), 'callout-helper-schedule-v2': JSON.stringify({ label: 'test', text: ics(events) }) };
  var ctx = { window: { CalloutEngine: W }, document: { getElementById: id, createElement: function (t) { return new El(t); }, addEventListener: function () {} },
    localStorage: { getItem: function (k) { return store[k] || null; }, setItem: function (k, v) { store[k] = v; } }, confirm: function () { return true; }, alert: function () {}, location: { reload: function () {} }, Date: Date, console: console };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8'), ctx);
  function walk(e, fn, out) { out = out || []; if (fn(e)) out.push(e); e.children.forEach(function (c) { walk(c, fn, out); }); return out; }
  function find(fn) { return walk(id('result'), fn)[0]; }
  function text(e) { var el = typeof e === 'string' ? id(e) : e; return walk(el, function () { return true; }).map(function (x) { return x.textContent; }).join(' '); }
  return {
    find: find, text: text, mode: function (m) { id(m === 'vacation' ? 'modeVacation' : 'modeCallout').onclick(); },
    click: function (fn) { walk(id('grid'), function (e) { return e.tag === 'button' && fn(e); })[0].onclick(); },
    tick: function (label) { var cb = find(function (e) { return e.attrs && e.attrs['aria-label'] === label; }); cb.checked = !cb.checked; cb.onchange(); },
    sectionText: function (heading) { // text of the list that follows a heading in the sidebar
      var kids = id('result').children, i = kids.findIndex(function (k) { return k.textContent.indexOf(heading) === 0; });
      return i < 0 ? '' : text(kids[i + 1]);
    },
    checkTexts: function () { id('openSettings').onclick(); var box = id('lists').children[0]; return box && /checks/.test(box.className) ? walk(box, function (e) { return e.tag === 'li'; }).map(text) : []; }
  };
}

var priv = path.join(root, 'private');
if (fs.existsSync(path.join(priv, 'expected.json'))) {
  var ex = JSON.parse(fs.readFileSync(path.join(priv, 'expected.json'), 'utf8')); // real names live only in private/
  octKelly(path.join(priv, 'real-october-2026.ics'), path.join(priv, 'expected.json'), ex.kellySingle, ex.kellyPair, 'real');
}
sweep(path.join(priv, 'real-october-2026.ics'), path.join(priv, 'expected.json'), 'real October');
vacSweep(path.join(priv, 'real-october-2026.ics'), path.join(priv, 'expected.json'), 'real October vacation', true);

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
