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
})();

var priv = path.join(root, 'private');
if (fs.existsSync(path.join(priv, 'expected.json'))) {
  var ex = JSON.parse(fs.readFileSync(path.join(priv, 'expected.json'), 'utf8')); // real names live only in private/
  octKelly(path.join(priv, 'real-october-2026.ics'), path.join(priv, 'expected.json'), ex.kellySingle, ex.kellyPair, 'real');
}
sweep(path.join(priv, 'real-october-2026.ics'), path.join(priv, 'expected.json'), 'real October');

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
