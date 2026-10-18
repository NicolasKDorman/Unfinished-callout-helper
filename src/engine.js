/* Unnamed Municipality EMS callout engine.
   Pure logic, no page code. Rules and their sources are in RULES.md.
   The schedule comes from an iCal (.ics) file, such as Aladtec's calendar feed.
   Times are kept as "wall clock minutes": the local date and time written in the
   feed, counted as minutes, so daylight saving never moves a shift. */
(function (root) {
  'use strict';
  var MIN = 60000, HOUR = 60, DAY = 1440, SHIFT_START = 8 * HOUR; // shift days run 08:00 to 08:00 (CBA 7.3)

  // ---------- Time helpers ----------
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function wall(y, mo, d, h, mi) { return Date.UTC(y, mo - 1, d, h || 0, mi || 0) / MIN; }
  function isoOf(t) { return new Date(t * MIN).toISOString().slice(0, 10); }
  function isoToWall(iso) { var p = iso.split('-'); return wall(+p[0], +p[1], +p[2]); }
  function addDays(iso, n) { return isoOf(isoToWall(iso) + n * DAY); }
  function shiftDayOf(t) { return isoOf(t - SHIFT_START); }
  function shiftStart(iso) { return isoToWall(iso) + SHIFT_START; }
  function hhmm(t) { var d = new Date(t * MIN); return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()); }
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmt(iso) { var d = new Date(isoToWall(iso) * MIN); return DOW[d.getUTCDay()] + ' ' + MON[d.getUTCMonth()] + ' ' + d.getUTCDate(); }
  function fmtT(t) { return fmt(isoOf(t)) + ' ' + hhmm(t); }
  function hours(m) { var h = Math.round(m / HOUR * 4) / 4; return h + (h === 1 ? ' hour' : ' hours'); }
  // Aladtec style short times: 08-20, 20-08
  function shortSpan(r) { return pad(new Date(r.start * MIN).getUTCHours()) + '-' + pad(new Date(r.end * MIN).getUTCHours()); }

  // ---------- Contract holidays (CBA 9.1), computed for any year ----------
  function nthWeekday(y, mo, dow, n) { // n = 1..5, or -1 for last
    if (n > 0) { var first = new Date(Date.UTC(y, mo - 1, 1)).getUTCDay(); return 1 + ((dow - first + 7) % 7) + (n - 1) * 7; }
    var lastDate = new Date(Date.UTC(y, mo, 0)).getUTCDate(), lastDow = new Date(Date.UTC(y, mo - 1, lastDate)).getUTCDay();
    return lastDate - ((lastDow - dow + 7) % 7);
  }
  function holidayName(iso) {
    var y = +iso.slice(0, 4), md = iso.slice(5), list = {};
    list['01-01'] = "New Year's Day";
    list['01-' + pad(nthWeekday(y, 1, 1, 3))] = 'MLK Day';
    list['05-' + pad(nthWeekday(y, 5, 1, -1))] = 'Memorial Day';
    list['07-04'] = 'Independence Day';
    list['09-' + pad(nthWeekday(y, 9, 1, 1))] = 'Labor Day';
    list['11-' + pad(nthWeekday(y, 11, 4, 4))] = 'Thanksgiving Day';
    list['12-24'] = 'Christmas Eve Day'; list['12-25'] = 'Christmas Day'; list['12-31'] = "New Year's Eve Day";
    return list[md] || '';
  }

  // ---------- Time zones ----------
  // Every time is turned into the department's local clock (CBA 7.3: shifts start at 08:00 there).
  var DEPT_TZ = 'America/Chicago', fmtCache = {};
  function zoneOk(tz) { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch (e) { return false; } }
  function zoneWallMs(ms, tz) { // the clock reading in tz at instant ms, as a UTC-based ms number
    var f = fmtCache[tz] || (fmtCache[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }));
    var p = {}; f.formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
  }
  function zonedToInstant(y, mo, d, h, mi, tz) {
    var target = Date.UTC(y, mo - 1, d, h, mi), guess = target;
    for (var i = 0; i < 3; i++) guess = target - (zoneWallMs(guess, tz) - guess);
    return guess;
  }
  function instantToDeptWall(ms) { return zoneWallMs(ms, DEPT_TZ) / MIN; }

  // ---------- iCal reading ----------
  function unesc(s) { return s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1'); }
  function parseICS(text) {
    var lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/), evs = [], cur = null;
    lines.forEach(function (l) {
      if (/^BEGIN:VEVENT$/i.test(l)) { cur = {}; return; }
      if (/^END:VEVENT$/i.test(l)) { if (cur) evs.push(cur); cur = null; return; }
      if (!cur) return;
      var i = l.indexOf(':'); if (i < 0) return;
      var parts = l.slice(0, i).split(';'), params = {};
      parts.slice(1).forEach(function (p) { var j = p.indexOf('='); if (j > 0) params[p.slice(0, j).toUpperCase()] = p.slice(j + 1).replace(/^"|"$/g, ''); });
      cur[parts[0].toUpperCase()] = { val: l.slice(i + 1), params: params };
    });
    return evs;
  }
  function parseTime(p) {
    var m = /^(\d{4})(\d\d)(\d\d)(?:T(\d\d)(\d\d)(\d\d)?(Z)?)?$/.exec(p.val.trim());
    if (!m) return null;
    if (!m[4] || p.params.VALUE === 'DATE') return { t: wall(+m[1], +m[2], +m[3]), allDay: true };
    var tz = p.params.TZID;
    if (m[7]) return { t: instantToDeptWall(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])), allDay: false };
    if (tz && tz !== DEPT_TZ && zoneOk(tz)) return { t: instantToDeptWall(zonedToInstant(+m[1], +m[2], +m[3], +m[4], +m[5], tz)), allDay: false };
    return { t: wall(+m[1], +m[2], +m[3], +m[4], +m[5]), allDay: false }; // department time, or no zone given
  }
  function parseDuration(v) {
    var m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(v.trim());
    return m ? (+(m[1] || 0)) * DAY + (+(m[2] || 0)) * HOUR + (+(m[3] || 0)) : null;
  }
  // Placeholders on the schedule that are not people.
  var SLOT_RE = /fifth provider|tentative approv|ride along|\bstudent\b|\bmedic\b|^open\b|open shift|vacan|unfilled/i;

  /* Returns {records, labels, skipped, notes, first, last}.
     record: {id, name, start, end, kind: 'work'|'slot'|'event', forName} */
  function importICS(text) {
    var recs = [], labels = {}, skipped = 0, notes = [], byUid = {}, repeats = 0, cancelled = 0, dups = 0;
    var evs = parseICS(text);
    // Keep only the newest version of each entry (UID + RECURRENCE-ID, highest SEQUENCE); drop cancelled ones.
    evs.forEach(function (e, i) {
      var uid = e.UID ? e.UID.val + '|' + (e['RECURRENCE-ID'] ? e['RECURRENCE-ID'].val : '') : 'no-uid-' + i;
      var seq = e.SEQUENCE ? +e.SEQUENCE.val || 0 : 0;
      if (!byUid[uid] || seq >= byUid[uid].seq) byUid[uid] = { e: e, seq: seq, i: i };
    });
    var seen = {};
    Object.keys(byUid).map(function (k) { return byUid[k]; }).sort(function (a, b) { return a.i - b.i; }).forEach(function (x) {
      var e = x.e;
      if (e.STATUS && /cancel/i.test(e.STATUS.val)) { cancelled++; return; }
      if (e.RRULE) repeats++;
      var s = e.DTSTART && parseTime(e.DTSTART);
      if (!s) { skipped++; return; }
      var sum = unesc((e.SUMMARY || { val: '' }).val).trim(), desc = unesc((e.DESCRIPTION || { val: '' }).val);
      var end = e.DTEND ? parseTime(e.DTEND) : null, endT = end ? end.t : null;
      if (endT == null && e.DURATION) { var du = parseDuration(e.DURATION.val); if (du != null) endT = s.t + du; }
      if (s.allDay) { // shift labels such as "A Shift", one per day the item covers
        var last = endT && endT > s.t ? endT : s.t + DAY;
        for (var t = s.t; t < last; t += DAY) { var iso = isoOf(t); (labels[iso] = labels[iso] || []).push(sum); }
        return;
      }
      if (endT == null || endT <= s.t) endT = s.t + HOUR;
      var kind = 'work', name = sum, forName = '';
      if (/(^|\n)\s*events?\s*($|\n)/i.test(desc) || /^events?:/i.test(sum)) kind = 'event';
      else if (SLOT_RE.test(sum)) kind = 'slot';
      var m = /^(.*?)\s+for\s+(.+)$/i.exec(sum);
      if (kind === 'work' && m) { name = m[1].trim(); forName = m[2].trim(); }
      var dm = /(?:^|\n)\s*(?:trade[:\s]*)?for\s+([^\n]+)/i.exec(desc);
      if (kind === 'work' && !forName && dm) forName = dm[1].trim();
      var key = [kind, name, s.t, endT, forName].join('|');
      if (seen[key]) { dups++; return; }
      seen[key] = 1;
      recs.push({ name: name, start: s.t, end: endT, kind: kind, forName: forName, n: recs.length });
    });
    if (cancelled) notes.push(cancelled + ' cancelled entries were left out.');
    if (dups) notes.push(dups + ' duplicate entries were counted once.');
    if (repeats) notes.push(repeats + ' repeating entries only show their first date. Check the file was exported as single shifts.');
    // Same start time: keep the feed's own order, which is how Aladtec lists positions.
    recs.sort(function (a, b) { return a.start - b.start || a.n - b.n; });
    recs.forEach(function (r, i) { r.id = i; });
    var times = recs.map(function (r) { return r.start; });
    return { records: recs, labels: labels, skipped: skipped, notes: notes,
      first: times.length ? shiftDayOf(Math.min.apply(null, times)) : null,
      last: times.length ? shiftDayOf(Math.max.apply(null, times)) : null };
  }

  // ---------- Schedule object ----------
  function makeSchedule(imp, label) {
    var work = imp.records.filter(function (r) { return r.kind === 'work'; });
    var people = [];
    function addP(n) { if (n && people.indexOf(n) === -1) people.push(n); }
    work.forEach(function (r) { addP(r.name); addP(r.forName); }); // trade owners count too (F04)
    people.sort();
    var byDay = {};
    imp.records.forEach(function (r) { var d = shiftDayOf(r.start); (byDay[d] = byDay[d] || []).push(r); });
    var own = {};
    work.forEach(function (r) { (own[r.name] = own[r.name] || []).push(r); });
    return { label: label || 'Imported schedule', records: imp.records, work: work, people: people, labels: imp.labels,
      byDay: byDay, first: imp.first, last: imp.last, skipped: imp.skipped, notes: imp.notes || [],
      ownShifts: function (n) { return own[n] || []; },
      onDay: function (iso) { return byDay[iso] || []; } };
  }
  function withInference(sc) { sc.inf = infer(sc); return sc; }

  // ---------- Interval helpers ----------
  function overlap(a0, a1, b0, b1) { return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0)); }
  function merge(iv, gap) { // union of [start,end] pairs; pieces closer than `gap` join up
    iv = iv.slice().sort(function (a, b) { return a[0] - b[0]; });
    var out = [];
    iv.forEach(function (x) { var l = out[out.length - 1]; if (l && x[0] - l[1] < (gap || 0.5)) l[1] = Math.max(l[1], x[1]); else out.push([x[0], x[1]]); });
    return out;
  }
  function ivs(shifts) { return shifts.map(function (r) { return [r.start, r.end]; }); }
  function covered(shifts, o0, o1) { // minutes of [o0,o1) already scheduled, counting overlaps once (F11)
    return merge(ivs(shifts)).reduce(function (s, x) { return s + overlap(x[0], x[1], o0, o1); }, 0);
  }
  function coveredIv(windows, o0, o1) { return merge(windows).reduce(function (s, x) { return s + overlap(x[0], x[1], o0, o1); }, 0); }
  function freeParts(shifts, o0, o1) { // parts of the opening this person isn't already working
    var out = [], t = o0;
    merge(ivs(shifts)).forEach(function (x) { if (x[1] <= t || x[0] >= o1) return; if (x[0] > t) out.push([t, x[0]]); t = Math.max(t, x[1]); });
    if (t < o1) out.push([t, o1]);
    return out;
  }
  // Block (breaks under 24 hours don't reset it) of work-interval pairs `iv` that holds [a,b), as a length.
  function blockLen(iv, a, b) {
    var blocks = merge(iv.concat([[a, b]]), DAY);
    for (var j = 0; j < blocks.length; j++) if (blocks[j][0] <= a && blocks[j][1] >= b) return blocks[j][1] - blocks[j][0];
    return b - a;
  }
  /* The hours of the free parts of an opening that this person may legally work under the 96-hour limit
     (SOG 100.17.03), as one set that is safe TOGETHER (RR02, RR03). Whole free parts are used when they pass.
     Otherwise the opening is walked in 15-minute pieces (then 1-minute ones at the edge), taking a piece only
     if the block it joins, with every piece already taken, stays within 96 hours. The walk is tried from the
     opening's start and from each point a full 24-hour rest after existing work, and the most hours wins
     (earliest on a tie), so an interior legal stretch is found when both ends are blocked. */
  function legalSet(shifts, free) {
    var LIM = 96 * HOUR, STEP = 15, base = ivs(shifts);
    var all = merge(base.concat(free), DAY);
    var whole = free.every(function (p) { return all.some(function (b) { return b[0] <= p[0] && b[1] >= p[1] && b[1] - b[0] <= LIM; }); });
    if (whole) return { full: true, pieces: free.map(function (p) { return [p[0], p[1]]; }) };
    var lo = free[0][0], hi = free[free.length - 1][1], starts = {};
    starts[lo] = 1; free.forEach(function (p) { starts[p[0]] = 1; });
    merge(base).forEach(function (x) { var s = x[1] + DAY; if (s > lo && s < hi) starts[s] = 1; });
    var best = null, bestTot = -1;
    Object.keys(starts).map(Number).sort(function (a, b) { return a - b; }).forEach(function (s) {
      var work = base.slice(), got = [];
      function fits(t0, t1) { return blockLen(work, t0, t1) <= LIM; }
      function take(t0, t1) { work.push([t0, t1]); got.push([t0, t1]); }
      free.forEach(function (p) {
        var t = Math.max(p[0], s);
        while (t < p[1]) {
          var c1 = Math.min(t + STEP, p[1]);
          if (fits(t, c1)) take(t, c1);
          else if (fits(t, t + 1)) { for (var m = c1 - t - 1; m >= 1; m--) if (fits(t, t + m)) { take(t, t + m); break; } }
          t = c1;
        }
      });
      var tot = total(got);
      if (tot > bestTot) { best = got; bestTot = tot; }
    });
    return { full: false, pieces: merge(best || [], 0.5) };
  }
  // X7: windows of 24 hours before and after any three shift days in a row with 12+ hours each.
  function threeDayWindows(shifts, o0, o1) {
    var out = [], d0 = shiftDayOf(o0), n = Math.ceil((o1 - o0) / DAY) + 4;
    for (var k = -5; k <= n; k++) {
      var d = addDays(d0, k), ok = true;
      for (var j = 0; j < 3 && ok; j++) { var s = shiftStart(addDays(d, j)); if (covered(shifts, s, s + DAY) < 12 * HOUR) ok = false; }
      if (!ok) continue;
      var a = shiftStart(d), b = a + 3 * DAY, txt = fmt(d) + ' to ' + fmt(addDays(d, 2));
      out.push({ from: a - DAY, to: a, text: txt }, { from: b, to: b + DAY, text: txt });
    }
    return out;
  }

  var NOTICE = {
    lt24: 'Less than 24 hours',
    '24to72': '24 to 72 hours',
    '72toRot': 'More than 72 hours, less than one full A,A,B,B,C,C rotation (6 or 7 days)',
    gtRot: 'More than one full rotation'
  };
  // Why the shift is open. Leave that must be covered by volunteers only: CBA 10.2 and 10.4, SOG 100.17.09(6).
  var REASONS = {
    sick: 'Sick or emergency (including sick leave)',
    leave: 'Approved vacation, holiday or comp leave, 12+ hours, asked for on time',
    short: 'Vacation of less than 12 hours',
    late: 'Leave asked for after the deadline (not sick leave)'
  };

  /* Keep a saved list valid without losing anyone's place.
     keep(n) says whether a saved name still belongs (default: always). New names go to the bottom. */
  function orderedNames(saved, names, keep) {
    var out = (saved || []).filter(function (n) { return !keep || keep(n); });
    names.forEach(function (n) { if (out.indexOf(n) === -1) out.push(n); });
    return out;
  }

  /* ---------- Reading the rotation from the schedule itself ----------
     Nothing here is stored. Every import works these out again, so crew changes,
     trades, new hires and rotation changes show up on their own. All of it is by real
     clock time, so a 48-hour shift or a part-day counts for every day it touches. */
  var FT_GUESS = 120, PT_FLAG = 40, FT_FLAG = 160; // owned hours per 28 days
  function infer(sc) {
    var freq = {};
    Object.keys(sc.labels).forEach(function (d) { sc.labels[d].forEach(function (l) { freq[l] = (freq[l] || 0) + 1; }); });
    var dayLabel = {};
    Object.keys(sc.labels).forEach(function (d) {
      var best = null;
      sc.labels[d].forEach(function (l) { if (freq[l] >= 3 && (!best || freq[l] > freq[best])) best = l; });
      if (best) dayLabel[d] = best;
    });
    // Owned time: their own shifts plus shifts someone works for them in a trade. Worked time: only their own.
    var owned = {}, worked = {};
    sc.work.forEach(function (r) {
      var o = r.forName && r.forName !== r.name ? r.forName : r.name;
      (owned[o] = owned[o] || []).push([r.start, r.end]);
      (worked[r.name] = worked[r.name] || []).push([r.start, r.end]);
    });
    var days = [], d0 = sc.first, info = {};
    if (d0) for (var d = d0; d <= sc.last; d = addDays(d, 1)) days.push(d);
    var span = days.length || 28;
    sc.people.forEach(function (n) {
      var ow = owned[n] || [], byL = {}, tot = 0, top = null;
      var total = merge(ow).reduce(function (s, x) { return s + x[1] - x[0]; }, 0) / HOUR;
      days.forEach(function (dd) {
        var l = dayLabel[dd]; if (!l) return;
        var h = coveredIv(ow, shiftStart(dd), shiftStart(dd) + DAY) / HOUR;
        if (h) { byL[l] = (byL[l] || 0) + h; tot += h; if (!top || byL[l] > byL[top]) top = l; }
      });
      var per28 = total * 28 / span, guess = per28 >= FT_GUESS ? 'ft' : 'pt', home = '';
      if (guess === 'ft' && top) home = byL[top] / tot >= 0.75 ? top : 'KELLY';
      info[n] = { hoursPer28: Math.round(per28), guess: guess, home: home };
    });
    // Days on their own shift letter with no time worked or traded at all: a Kelly day or leave.
    var offOwn = {};
    sc.people.forEach(function (n) {
      var h = info[n].home; if (!h || h === 'KELLY') return;
      offOwn[n] = days.filter(function (dd) { return dayLabel[dd] === h && coveredIv(owned[n] || [], shiftStart(dd), shiftStart(dd) + DAY) === 0; });
    });
    var labelsSeen = Object.keys(freq).filter(function (l) { return freq[l] >= 3; }).sort();
    return { dayLabel: dayLabel, info: info, offOwn: offOwn, labelsSeen: labelsSeen, worked: worked,
      hasLabels: Object.keys(dayLabel).length > 0 };
  }

  // The off-duty gap (end of last work to start of next work) that holds time t.
  function gapAround(shifts, t) {
    var m = merge(ivs(shifts)), from = -Infinity, to = Infinity;
    for (var i = 0; i < m.length; i++) { if (m[i][1] <= t) from = m[i][1]; else if (m[i][0] > t) { to = m[i][0]; break; } else return null; }
    return [from, to];
  }
  // Two untraded own-shift days off in a row inside that gap (SOG 100.17.11(2)(b)): a suggestion, not a fact.
  function kellyGuess(inf, sc, n, t) {
    var off = inf.offOwn[n]; if (!off || !off.length) return null;
    var g = gapAround(sc.ownShifts(n), t); if (!g) return null;
    var inside = off.filter(function (d) { return shiftStart(d) >= g[0] && shiftStart(d) + DAY <= g[1]; });
    for (var i = 0; i + 1 < inside.length; i++) if (addDays(inside[i], 1) === inside[i + 1]) return { pair: [inside[i], inside[i + 1]], window: g };
    return inside.length ? { single: inside, window: g } : null;
  }

  function minus(pieces, windows) { // remove windows from pieces
    var out = pieces.slice();
    windows.forEach(function (w) {
      var next = [];
      out.forEach(function (p) {
        if (w[1] <= p[0] || w[0] >= p[1]) { next.push(p); return; }
        if (w[0] > p[0]) next.push([p[0], w[0]]);
        if (w[1] < p[1]) next.push([w[1], p[1]]);
      });
      out = next;
    });
    return out;
  }
  function intersect(a, b) {
    var out = [];
    a.forEach(function (x) { b.forEach(function (y) { var s = Math.max(x[0], y[0]), e = Math.min(x[1], y[1]); if (e > s) out.push([s, e]); }); });
    return merge(out);
  }
  function total(p) { return p.reduce(function (s, x) { return s + x[1] - x[0]; }, 0); }
  function spans(p) { return p.map(function (x) { return fmtT(x[0]) + ' to ' + fmtT(x[1]); }).join(' and '); }

  /* Everyone who can be offered an opening: the loaded schedule's people plus saved full-timers who are not in it
     (they carry a warning), minus anyone set to "Not on the lists". The tick-box table uses the same list (RR01). */
  function candidates(sc, saved, roster) {
    roster = roster || effectiveRoster(sc, saved);
    var people = sc.people.slice();
    Object.keys(saved || {}).forEach(function (n) { if (saved[n] === 'ft' && people.indexOf(n) === -1) people.push(n); });
    return people.filter(function (n) { return roster[n] !== 'ignore'; });
  }

  /* opts: {sched, entry (a work record), from, to (optional: the real vacancy inside or around the entry),
            notice, reason, roster {name: 'ft'|'pt'|'ignore'}, mandList, volList,
            leave, kelly, unprot, ot20, certs: arrays of names} */
  function computeCallout(opts) {
    var sc = opts.sched, e = opts.entry, caller = e.name;
    var o0 = opts.from != null ? opts.from : e.start, o1 = opts.to != null ? opts.to : e.end;
    var notice = opts.notice || 'lt24', reason = opts.reason || 'sick';
    if (reason === 'blackout') reason = 'leave'; // old name for holiday leave
    var inf = sc.inf || infer(sc), roster = effectiveRoster(sc, opts.roster);
    var leave = opts.leave || [], kelly = opts.kelly || [], unprot = opts.unprot || [], ot20 = opts.ot20 || [], certs = opts.certs || [];
    var people = candidates(sc, opts.roster, roster);
    var ft = people.filter(function (n) { return roster[n] === 'ft'; });
    var mandList = activeList(opts.mandList, ft, 'top'), volList = activeList(opts.volList, ft, 'bottom');
    var holiday = holidayName(shiftDayOf(o0));
    var res = { entry: e, caller: caller, from: o0, to: o1, notice: notice, reason: reason, holiday: holiday,
      opening: fmtT(o0) + ' to ' + fmtT(o1) + ' (' + hours(o1 - o0) + ')',
      steps: [], groups: [], noCall: [], noMandate: [], needsRole: [], warnings: [], notes: {}, hoursFor: {} };

    if (o1 <= o0) { res.warnings.push('The opening has no length. Check the start and end times.'); return res; }
    if (sc.first && o0 - 4 * DAY < shiftStart(sc.first)) res.warnings.push('The loaded schedule starts ' + fmt(sc.first) + '. Shifts before that are unknown, so the on-duty crew, Kelly days and the 96-hour and 3-day checks may be incomplete. Load a schedule that starts earlier.');
    if (sc.last && o1 + 4 * DAY > shiftStart(sc.last) + DAY) res.warnings.push('The loaded schedule ends ' + fmt(sc.last) + '. Shifts after that are unknown, so Kelly days and the 96-hour and 3-day checks may be incomplete.');
    if (!inf.hasLabels) res.warnings.push('This schedule has no shift labels (like "A Shift"), so Kelly days can\'t be read from it. Use the Kelly tick box.');
    var capCount = leave.filter(function (n) { return unprot.indexOf(n) === -1; }).length;
    if (capCount > 2) res.warnings.push(capCount + ' people are marked on approved leave. Only two may be protected for approved leave at a time (SOG 100.17.12); the Chief says who is not protected on which days. Tick "Not protected" for anyone the Chief names. Kelly days don\'t count toward the two.');
    (sc.notes || []).forEach(function (x) { res.warnings.push('Schedule file: ' + x); });

    var volOnly = reason === 'short' || reason === 'late' || (reason === 'leave' && !!holiday && !opts.noBlackout); // noBlackout: comp time on a holiday (RULES.md V6, uncertainty 9)
    var avail = [], volunteers = [];
    people.forEach(function (n) {
      var shifts = sc.ownShifts(n), noCall = [], noMand = [], notes = [], spn = [];
      if (n === caller) { res.noCall.push({ name: n, reasons: ['Called out for this opening.'] }); return; }
      var free = freeParts(shifts, o0, o1);
      if (!free.length) { res.noCall.push({ name: n, reasons: ['Already on the ambulance for this whole opening (SOG 100.17.11(1)).'] }); return; }
      if (total(free) < o1 - o0) spn.push('Already working ' + hours(o1 - o0 - total(free)) + ' of this opening; could cover ' + spans(free) + '.');
      var legal = merge(legalSet(shifts, free).pieces);
      if (!legal.length) noCall.push('No part of this opening can be worked without going over 96 hours in a row without a 24-hour break (SOG 100.17.03).');
      else if (total(legal) < total(free)) spn.push('Only ' + spans(legal) + ' is within the 96-hour limit (SOG 100.17.03).');
      if (certs.indexOf(n) !== -1) noCall.push('Marked as not current on certifications or not cleared to drive (SOG 100.17.06).');
      if (sc.people.indexOf(n) === -1) notes.push('Not on the loaded schedule at all. Make sure they are not on leave before calling.');
      var traded = sc.work.filter(function (r) { return r.forName === n && r.name !== n && overlap(r.start, r.end, o0 - DAY, o1 + DAY); });
      if (traded.length) notes.push('Traded time near this opening to ' + traded[0].name + '. A trade is not approved leave, so it gives no mandate protection (CBA 7.7).');
      if (noCall.length) { res.noCall.push({ name: n, reasons: noCall.concat(spn, notes) }); return; }

      // Mandate protection, as time windows.
      var prot = [], why = [];
      var g = gapAround(shifts, o0) || gapAround(shifts, legal[0][0]) || [o0, o1];
      var isUnprot = unprot.indexOf(n) !== -1;
      if (roster[n] === 'pt') { prot.push([o0, o1]); why.push('Part-time: not on the Mandatory Overtime List. May volunteer (SOG 100.17.04, 100.17.09(7)(b)).'); }
      if (!isUnprot) {
        if (leave.indexOf(n) !== -1) { prot.push(g); why.push('Marked on approved leave: protected from the end of their last shift to the start of their next (SOG 100.17.11(2)(a)).'); }
        if (kelly.indexOf(n) !== -1) { prot.push(g); why.push('Marked on two Kelly days off in a row, which counts as approved leave without using one of the two leave spots (SOG 100.17.11(2)(b), 100.17.12).'); }
        else if (roster[n] === 'ft' && leave.indexOf(n) === -1) {
          var kg = kellyGuess(inf, sc, n, legal[0][0]);
          if (kg && kg.pair) { prot.push(kg.window); why.push('Probably two Kelly days off (' + fmt(kg.pair[0]) + ' and ' + fmt(kg.pair[1]) + ': off on their own shift with no trade), read from the schedule (SOG 100.17.11(2)(b)). If it was approved leave instead, tick "Approved leave" so it counts toward the two-person limit. If they are not protected, tick "Not protected".'); }
          else if (kg && kg.single) notes.push('Off on their own shift ' + kg.single.map(fmt).join(', ') + ' with no trade. One Kelly day gives no protection; if it was approved leave, tick "Approved leave".');
        }
      } else notes.push('Marked "Not protected", so leave and Kelly protection are ignored for this opening.');
      if (ot20.indexOf(n) !== -1) { prot.push([o0, o1]); why.push('Marked as within 24 hours before or after 20+ hours of voluntary overtime in a row (SOG 100.17.11(3)).'); }
      threeDayWindows(shifts, o0, o1).forEach(function (w) {
        if (overlap(w.from, w.to, o0, o1)) { prot.push([w.from, w.to]); why.push('Scheduled 12+ hours on three days in a row (' + w.text + '); protected for the 24 hours next to them (SOG 100.17.11(4)).'); }
      });
      var mand = minus(legal, merge(prot));
      res.notes[n] = spn.concat(notes);
      res.hoursFor[n] = { free: free, legal: legal, mand: mand, why: uniq(why), gen: notes };
      volunteers.push(n);
      if (!mand.length) res.noMandate.push({ name: n, reasons: uniq(why).concat(spn, notes) });
      else avail.push(n);
    });

    /* One row for a call list. w0 and w1 are the hours this group is about, so every span shown is clipped to
       them (RR04). A volunteer row shows the legal hours; a mandate row shows the mandatable hours. */
    function line(n, which, list, w0, w1, vol) {
      var h = res.hoursFor[n], extra = [], win = [[w0, w1]], whole = w0 === o0 && w1 === o1;
      var fc = intersect(h.free, win), lc = intersect(h.legal, win), mc = intersect(h.mand, win), len = w1 - w0;
      if (total(fc) < len) extra.push('Already working ' + hours(len - total(fc)) + ' of ' + (whole ? 'this opening' : 'this part of the opening') + '; could cover ' + (fc.length ? spans(fc) : 'none of it') + '.');
      if (vol) { if (total(lc) < len) extra.push('Can volunteer for: ' + (lc.length ? spans(lc) : 'none of it') + '.'); }
      else {
        if (total(lc) < total(fc)) extra.push('Only ' + spans(lc) + ' is within the 96-hour limit (SOG 100.17.03).');
        if (total(mc) < len) extra.push('Mandate for: ' + (mc.length ? spans(mc) : 'none of it') + '.' + (total(mc) < total(lc) ? ' ' + h.why.join(' ') : ''));
      }
      return { name: n, why: '#' + (list.indexOf(n) + 1) + ' on the ' + which + ' Overtime List', notes: extra.concat(h.gen) };
    }
    function inOrder(subset, list, which, w0, w1, vol) {
      return list.filter(function (n) { return subset.indexOf(n) !== -1; }).map(function (n) { return line(n, which, list, w0 == null ? o0 : w0, w1 == null ? o1 : w1, vol); });
    }
    var passStep = 'A person being mandated may use their one pass for the year, said out loud to the person issuing the mandate at the time. They go to the bottom of the Mandatory list, the pass is dated on the posted list and emailed to them, and you move to the next name (SOG 100.17.13).';
    var listStep = 'After someone is mandated, move them to the bottom of the Mandatory list. Exception: a mandate of 1 hour or less right next to hours they are already working does not count (SOG 100.17.08).';

    if (volOnly) {
      var why0 = reason === 'short' ? 'a vacation of less than 12 hours (CBA 10.2)' : reason === 'late' ? 'leave asked for after the deadline, which follows the blackout policy (CBA 10.2, 10.4)' : 'leave on a contract holiday, a blackout date (' + holiday + ', CBA 10.4)';
      res.steps.push('This opening is ' + why0 + '. Nobody may be mandated. Cover it only with volunteers; if it can\'t be fully covered, the leave is denied (CBA 10.2, 10.4; SOG 100.17.09(6)).');
      res.steps.push('Offer it to full-time and part-time staff. The first person to take the whole opening gets it; people taking part of it only count if together the whole opening gets covered.');
      if (reason === 'short') res.steps.push('Leave of less than 12 hours is not approved leave for mandate protection, so the caller can still be mandated elsewhere (CBA 10.2).');
      res.groups.push({ title: 'May volunteer (first come, first served)', note: 'Nobody can be mandated for this opening.', volunteer: true,
        people: volunteers.map(function (n) { return { name: n, why: roster[n] === 'pt' ? 'Part-time' : '', notes: res.notes[n] || [] }; }) });
      res.noMandate = res.noMandate.filter(function () { return false; });
      return res;
    }
    if (opts.process === 'monthly') { // a vacation request known before the monthly finalizing process (SOG 100.17.09(1)-(5))
      (opts.monthSteps || []).forEach(function (x) { res.steps.push(x); });
      var ptv = volunteers.filter(function (n) { return roster[n] === 'pt'; });
      var offerM = volList.filter(function (n) { return volunteers.indexOf(n) !== -1; });
      res.groups.push({ title: 'First: part-time, LTE and qualified volunteers', note: 'Posted before the full-time bidding window (SOG 100.17.09(1)). No order is given among them.', volunteer: true,
        people: ptv.map(function (n) { return { name: n, why: 'Part-time', notes: res.notes[n] || [] }; }) });
      res.groups.push({ title: 'Then: full-time bids, awarded in this order', note: 'Voluntary Overtime List order (SOG 100.17.09(2)). Protected people may still bid.', volunteer: true,
        people: offerM.map(function (n) { return line(n, 'Voluntary', volList, o0, o1, true); }) });
      res.groups.push({ title: 'Last: if hours are still open, mandate in this order', note: 'Top-most eligible person on the Mandatory Overtime List for as many hours as allowed, then the next for what is left (SOG 100.17.10(1)(a)).', people: inOrder(avail, mandList, 'Mandatory') });
      return res;
    }
    if (reason === 'leave') res.steps.push('Approved leave of 12+ hours, asked for on time, on a non-holiday: fill it the normal way for the notice you have.');

    res.steps.push('First check whether a fill is needed: if the remaining crew still gives a legal two-paramedic ambulance, no one is called (SOG 100.50.06).');
    if (notice === 'gtRot') {
      res.steps.push('Post it in the scheduling software for full-time staff for at least 12 hours, offered in Voluntary Overtime List order (SOG 100.17.09(7)(a)).');
      res.steps.push('If no full-timer takes it, post it for part-time, LTE and qualified volunteers for at least 12 hours, and no longer than the full-time posting (SOG 100.17.09(7)(b)).');
      res.steps.push('Admin staff may then take it, before any mandate (SOG 100.17.09(7)(c)).');
      res.steps.push('Mandates go out as early as possible, starting one full rotation before the opening. Tell the person in person or by phone and also by email (SOG 100.17.09(7)(d), 100.17.10(1)(b)).');
      res.steps.push(passStep); res.steps.push(listStep);
      var offer = volList.filter(function (n) { return volunteers.indexOf(n) !== -1; });
      res.groups.push({ title: 'Step A. Offer to full-time volunteers in this order', note: 'Voluntary Overtime List order (fewest voluntary overtime hours first). Protected people may still volunteer.', volunteer: true,
        people: offer.map(function (n) { return line(n, 'Voluntary', volList, o0, o1, true); }) });
      res.groups.push({ title: 'Step B. If nobody volunteers, mandate in this order', note: 'Top-most eligible person for as many hours as allowed, then the next for what is left (SOG 100.17.10).', people: inOrder(avail, mandList, 'Mandatory') });
      return res;
    }

    res.steps.push('Management has first right to take a short-notice opening, before anyone is notified (SOG 100.17B.06).');
    res.steps.push('Post it in the scheduling software and wait at least ' + (notice === 'lt24' ? '1 hour' : '4 hours') + ' for a volunteer.' + (notice === '72toRot' ? '' : ' The Chief may shorten the wait, but not arbitrarily (SOG 100.17B.04).'));
    if (notice !== '72toRot') res.steps.push('With under 72 hours of notice, a full-timer who volunteers for the whole opening or at least 12 hours of it goes to the bottom of the Mandatory list, and the hours count as mandated. If they take over someone else\'s mandate, the original person goes back to their old spot (SOG 100.17B.04).');
    if (notice === '72toRot') res.steps.push('Mandate by email and phone call; leave a voicemail if they don\'t answer, or tell them face to face if they are on duty (still send the email). Every notice must go out at least 60 hours before the opening (SOG 100.17B.04).');
    if (notice === '24to72') res.steps.push('Mandate by phone call (a text only in addition). If the person does not answer the first call, leave a voicemail and move to the next person. You must actually speak to the person mandated, then email them before the hours start (SOG 100.17B.04).');
    if (notice === 'lt24') res.steps.push('Tell the mandated person directly, and email them before the hours start (SOG 100.17B.04).');
    if (o0 > e.start) res.steps.push('This opening starts partway through the shift. For mid-shift or mid-tour openings, management may use good-faith judgment to fill it (SOG 100.17B.05).');
    res.steps.push(passStep); res.steps.push(listStep);

    if (notice === 'lt24') {
      // "currently covering the ambulance schedule up to the point of the schedule vacancy", first 24 hours (SOG 100.17B.04)
      var cut = Math.min(o1, o0 + DAY);
      var hold = avail.filter(function (n) {
        return n !== caller && sc.ownShifts(n).some(function (r) { return r.start < o0 && r.end >= o0; }) && coveredIv(res.hoursFor[n].mand, o0, cut) > 0;
      });
      if (hold.length) res.groups.push({ title: 'Mandate first: on duty when the opening starts (' + fmtT(o0) + ')',
        note: 'They are working right up to the opening. For the first 24 hours, the top-most of them on the Mandatory list is mandated first (SOG 100.17B.04).', people: inOrder(hold, mandList, 'Mandatory', o0, cut) });
      var rest = avail.filter(function (n) { return hold.indexOf(n) === -1; });
      res.groups.push({ title: 'If that doesn\'t cover the first 24 hours: management\'s decision', discretion: true,
        note: 'The SOG does not say who is mandated when nobody on duty can cover it. This is the Mandatory list order, as one option for management to decide on (SOG 100.17B.04, 100.17B.05, 100.17B.07; RULES.md rule M2).',
        people: inOrder(rest.filter(function (n) { return coveredIv(res.hoursFor[n].mand, o0, cut) > 0; }), mandList, 'Mandatory', o0, cut) });
      if (o1 > cut) res.groups.push({ title: 'Hours after ' + fmtT(cut) + ': mandate in this order', note: 'Past the first 24 hours, the 24-to-72-hour process applies to the rest (SOG 100.17B.04).',
        people: inOrder(avail.filter(function (n) { return coveredIv(res.hoursFor[n].mand, cut, o1) > 0; }), mandList, 'Mandatory', cut, o1) });
      if (!hold.length) res.warnings.push('Nobody on duty right before ' + fmtT(o0) + ' can be mandated, and the SOG doesn\'t say what happens next. The list below is shown as management\'s decision, not a rule.');
    } else {
      res.groups.push({ title: 'Mandate in this order', note: 'Top-most eligible person on the Mandatory Overtime List for as many hours as allowed, then the next for what is left (SOG 100.17B.04).', people: inOrder(avail, mandList, 'Mandatory') });
    }
    return res;
  }

  /* ---------- Vacation and leave requests (RULES.md, "Vacation and leave requests") ---------- */
  var LEAVE_TYPES = { vacation: 'Vacation', holiday: 'Holiday leave', comp: 'Comp time' };
  function ymd(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }
  function monthBack(y, m, k) { var t = y * 12 + (m - 1) - k; return { y: Math.floor(t / 12), m: (t % 12) + 1 }; }
  function fmtY(iso) { return fmt(iso) + ', ' + iso.slice(0, 4); }
  function monthName(y, m) { return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1] + ' ' + y; }
  // The request deadline for leave in month (y,m): the 24th at 23:59 of the month two before (CBA 10.2: January 24 for March).
  function requestDeadline(y, m) { var b = monthBack(y, m, 2); return ymd(b.y, b.m, 24); }
  // 5 pm on the 13th of the month before, or the next business day (SOG 100.17.09(5)).
  function mandateDay(y, m) {
    var b = monthBack(y, m, 1), iso = ymd(b.y, b.m, 13);
    for (var i = 0; i < 10; i++) { var dw = new Date(isoToWall(iso) * MIN).getUTCDay(); if (dw !== 0 && dw !== 6 && !holidayName(iso)) break; iso = addDays(iso, 1); }
    return iso;
  }
  function monthlySteps(y, m) {
    var b = monthBack(y, m, 1), c = monthBack(y, m, 2), last = ymd(c.y, c.m, new Date(Date.UTC(c.y, c.m, 0)).getUTCDate());
    return [
      'Known before the monthly finalizing process, so it is filled in the monthly steps for ' + monthName(y, m) + ' (SOG 100.17.09(1)-(5); the dates assume the process for a month runs the month before, RULES.md uncertainty 1).',
      'Until 23:59 on ' + fmtY(last) + ': attempts to fill it with qualified volunteers and part-time or LTE staff (SOG 100.17.09(1)).',
      fmtY(ymd(b.y, b.m, 1)) + ' to 23:59 on ' + fmtY(ymd(b.y, b.m, 5)) + ': only full-time staff may bid, awarded in Voluntary Overtime List order, going through the month\'s openings in date order. If two bid on the same opening, the bid with more consecutive hours wins (SOG 100.17.09(2)).',
      'Then administrative staff, volunteers and part-time or LTE staff may be used (SOG 100.17.09(3)).',
      'All qualified staff may re-bid until noon on ' + fmtY(ymd(b.y, b.m, 10)) + '. After noon the hours go first come, first served; more consecutive hours wins a tie (SOG 100.17.09(4)).',
      'Anything left is mandated by 5 pm on ' + fmtY(mandateDay(y, m)) + ' (the 13th, or the next business day). After that the schedule for ' + monthName(y, m) + ' is final (SOG 100.17.09(5)). Mandates follow the Mandatory Overtime List in date order, each person moves to the bottom, and the notice is an email (SOG 100.17.10(1)(a)).',
      'There is no pass at this stage: the yearly pass only applies after the schedule is final (SOG 100.17.13).'
    ];
  }

  /* opts: {sched, person, from, to (wall minutes), submitted ('YYYY-MM-DD' or empty), type: vacation|holiday|comp,
            roster, mandList, volList, seniority, leave (others already off), kelly, unprot, ot20, certs}
     Answers: can it be approved, how the opening is filled, and what protection the requester gets. */
  function computeVacation(opts) {
    var sc = opts.sched, person = opts.person, o0 = opts.from, o1 = opts.to, type = LEAVE_TYPES[opts.type] ? opts.type : 'vacation', sub = opts.submitted || '';
    var res = { person: person, from: o0, to: o1, type: type, typeName: LEAVE_TYPES[type], submitted: sub, range: fmtT(o0) + ' to ' + fmtT(o1),
      verdicts: [], parts: [], checks: [], warnings: [], status: 'ok', statusText: '', total: null, yearly: false, protection: null, others: [], unknownHours: false };
    if (!(o1 > o0)) { res.status = 'none'; res.warnings.push('The end is not after the start. Check the dates.'); return res; }
    if (!person || sc.people.indexOf(person) === -1 && !sc.ownShifts(person).length) { res.status = 'none'; res.warnings.push('Pick the person asking for leave.'); return res; }
    var roster = effectiveRoster(sc, opts.roster), leaveTick = opts.leave || [], unprot = opts.unprot || [];
    var others = leaveTick.filter(function (n) { return n !== person && unprot.indexOf(n) === -1; });
    res.others = others;
    var d0 = shiftDayOf(o0), d1 = shiftDayOf(o1 - 1);
    var inFile = !!(sc.first && sc.last) && d0 >= sc.first && d1 <= sc.last;
    if (!inFile && sc.first) res.warnings.push('The loaded schedule covers ' + fmt(sc.first) + ' to ' + fmt(sc.last) + '. Part of these dates is outside it, so shifts on those days are not known.');

    // The opening: the requester's own scheduled time inside the dates.
    var clipped = merge(sc.ownShifts(person).filter(function (r) { return overlap(r.start, r.end, o0, o1); }).map(function (r) { return [Math.max(r.start, o0), Math.min(r.end, o1)]; }), 0.5);
    var pieces = []; // one piece per shift day
    if (clipped.length) {
      clipped.forEach(function (c) {
        for (var d = shiftDayOf(c[0]); shiftStart(d) < c[1]; d = addDays(d, 1)) pieces.push({ day: d, from: Math.max(c[0], shiftStart(d)), to: Math.min(c[1], shiftStart(d) + DAY) });
      });
      res.total = total(clipped);
    } else if (!inFile) { // no schedule for these dates: judge the dates only
      res.unknownHours = true;
      for (var dd = d0; dd <= d1; dd = addDays(dd, 1)) pieces.push({ day: dd, from: Math.max(o0, shiftStart(dd)), to: Math.min(o1, shiftStart(dd) + DAY) });
      res.warnings.push('The loaded schedule does not cover these dates, so the hours, the 12-hour minimum and who would fill the opening cannot be worked out. The answer below is about the dates only. Load the schedule once it is published.');
    } else {
      res.status = 'none'; res.statusText = 'No shifts to cover';
      res.warnings.push(person + ' has no scheduled shifts between these dates in the loaded schedule, so there is nothing to fill. A request for days off the schedule is only a question of approval.');
      return res;
    }
    if (res.total != null && res.total === 0) res.total = null;

    // Parts: adjacent days with the same holiday status and the same month are one opening.
    var parts = [];
    pieces.forEach(function (pc) {
      var hol = holidayName(pc.day), y = +pc.day.slice(0, 4), m = +pc.day.slice(5, 7), l = parts[parts.length - 1];
      if (l && l.to === pc.from && !!l.holiday === !!hol && l.y === y && l.m === m) { l.to = pc.to; l.days.push(pc.day); if (hol && l.holidays.indexOf(hol) === -1) l.holidays.push(hol); }
      else parts.push({ from: pc.from, to: pc.to, days: [pc.day], holiday: hol, holidays: hol ? [hol] : [], y: y, m: m });
    });
    var short = res.total != null && res.total < 12 * HOUR;
    res.short = short;

    // Guaranteed yearly leave: asked for in the year before, by October 15, in whole 24-hour shifts (CBA 10.2).
    var subY = sub ? +sub.slice(0, 4) : 0, wholeShifts = clipped.length ? clipped.every(function (c) { return (c[0] - SHIFT_START) % DAY === 0 && (c[1] - c[0]) % DAY === 0; }) : false;
    var yearlyWindow = !!sub && sub <= subY + '-10-15' && parts.every(function (p) { return p.y === subY + 1; });
    res.yearly = yearlyWindow && wholeShifts && !short;
    if (yearlyWindow && !res.yearly && !res.unknownHours) res.verdicts.push({ level: 'prov', title: 'Not a guaranteed yearly request', text: 'It was submitted in time for the yearly process, but the yearly process only takes full 24-hour shifts (CBA 10.2). This one is treated as an ordinary monthly request, which is on time.' });
    if (yearlyWindow && res.unknownHours) res.yearly = true;

    // Requester's remaining work, for the protection window.
    var mine = sc.ownShifts(person).map(function (r) { return [r.start, r.end]; });
    var left = minus(mine, clipped), firstFrom = parts[0].from, lastTo = parts[parts.length - 1].to;
    var before = left.filter(function (x) { return x[1] <= firstFrom; }).map(function (x) { return x[1]; }), after = left.filter(function (x) { return x[0] >= lastTo; }).map(function (x) { return x[0]; });
    res.window = [before.length ? Math.max.apply(null, before) : null, after.length ? Math.min.apply(null, after) : null];

    var ft = candidates(sc, opts.roster, roster).filter(function (n) { return roster[n] === 'ft'; });
    var mand = activeList(opts.mandList, ft, 'top');
    var worst = 0, RANK = { ok: 0, prov: 1, short: 2, conflict: 3 };
    function note(level) { if (RANK[level] > worst) worst = RANK[level]; }

    parts.forEach(function (p, i) {
      var late = !res.yearly && !!sub && sub > requestDeadline(p.y, p.m);
      var blackout = !!p.holiday && type !== 'comp';
      var volOnly = short || late || blackout;
      var reason = short ? 'short' : late ? 'late' : 'leave';
      var part = { n: i + 1, from: p.from, to: p.to, days: p.days, holiday: p.holiday ? p.holidays.join(', ') : '', late: late, month: monthName(p.y, p.m),
        label: fmtT(p.from) + ' to ' + fmtT(p.to) + ' (' + hours(p.to - p.from) + ')', volunteersOnly: volOnly, verdict: null, callout: null, mandated: [], deadline: '' };
      part.deadline = res.yearly ? '' : 'Request deadline for ' + monthName(p.y, p.m) + ': 23:59 on ' + fmtY(requestDeadline(p.y, p.m)) + ' (CBA 10.2).';
      if (short) part.verdict = { level: 'short', title: 'Under the 12-hour minimum', text: 'Only ' + hours(res.total) + ' in total. A vacation request is not less than 12 hours (CBA 10.2). It can still be approved, but only if the hours are covered without any mandate, and it is not approved leave, so it gives no mandate protection.' };
      else if (blackout) part.verdict = { level: 'prov', title: 'Provisional: blackout date (' + part.holiday + ')', text: 'Contract holidays are blacked out for vacation and holiday leave (CBA 10.4). It is approved only if volunteers cover the whole opening; if a mandate would be needed, it is denied. The answer is due on or before the day that week\'s schedule is finalized.' };
      else if (late) part.verdict = { level: 'prov', title: 'Provisional: late request', text: 'Submitted after the ' + fmtY(requestDeadline(p.y, p.m)) + ' deadline for ' + monthName(p.y, p.m) + '. The Chief or designee may approve it, but it follows the blackout policy: only if volunteers cover it, never by a mandate (CBA 10.2, 10.4; SOG 100.17.09(6)).' };
      else part.verdict = { level: 'ok', title: res.yearly ? 'Guaranteed yearly leave' : 'Can be approved', text: res.yearly ? 'Asked for by October 15 in whole 24-hour shifts, so it is guaranteed unless someone more senior asked for the same day. It is finalized by November 1 (CBA 10.2).' : (sub ? 'On time and 12 hours or more, so it is granted normally (CBA 10.2).' : 'Assumed on time (no submitted date entered) and 12 hours or more, so it is granted normally (CBA 10.2).') };
      note(part.verdict.level);

      if (!res.unknownHours) {
        var mdate = null;
        part.process = volOnly ? 'volunteers' : 'monthly';
        part.callout = computeCallout({ sched: sc, entry: { name: person, start: p.from, end: p.to, kind: 'work' }, from: p.from, to: p.to, notice: 'gtRot', reason: reason,
          process: volOnly ? null : 'monthly', monthSteps: volOnly ? null : monthlySteps(p.y, p.m), noBlackout: type === 'comp', roster: opts.roster, mandList: mand, volList: opts.volList,
          leave: leaveTick.filter(function (n) { return n !== person; }), kelly: opts.kelly, unprot: opts.unprot, ot20: opts.ot20, certs: opts.certs });
        if (!volOnly) { // who would be mandated if nobody volunteers: they go to the bottom before the next part (SOG 100.17.10(1)(a)i)
          var g = part.callout.groups[part.callout.groups.length - 1], rem = [[p.from, p.to]];
          g.people.forEach(function (x) { var nr = minus(rem, merge(part.callout.hoursFor[x.name].mand)); if (total(nr) < total(rem)) part.mandated.push(x.name); rem = nr; });
          mand = mand.filter(function (n) { return part.mandated.indexOf(n) === -1; }).concat(part.mandated);
        }
      }
      res.parts.push(part);
    });

    // Conflicts and the two-person limit.
    if (res.yearly && others.length) {
      var sen = opts.seniority || [], sp = sen.indexOf(person), more = others.filter(function (n) { var k = sen.indexOf(n); return sp !== -1 && k !== -1 && k < sp; });
      var cmp = sp === -1 ? 'Seniority is not set up here for ' + person + ', so the tool can\'t compare.' : (more.length ? more.join(', ') + (more.length > 1 ? ' are' : ' is') + ' more senior, so would get the day.' : person + ' is more senior than ' + others.join(', ') + ', so would get the day.');
      res.verdicts.push({ level: 'conflict', title: 'Conflict: someone else is off', text: 'Only one shift-work employee may be off on any given day in the yearly process, and the more senior one gets it (CBA 10.2). Marked as already off: ' + others.join(', ') + '. ' + cmp + ' The tool can\'t tell which days overlap; check.' });
      note('conflict');
    }
    var capOver = others.length >= 2;
    if (capOver) { res.verdicts.push({ level: 'conflict', title: 'Two people are already protected by approved leave', text: 'Only two employees at a time may be exempt from mandates for approved leave (SOG 100.17.12). Marked as already off: ' + others.join(', ') + '. This would be a third. The request may still be approved, but the Chief then says which days the requester is not exempt.' }); note('conflict'); }

    // The requester's protection.
    var win = res.window, wtxt = win[0] != null && win[1] != null ? fmtT(win[0]) + ' to ' + fmtT(win[1]) : win[0] != null ? 'from ' + fmtT(win[0]) + ' to the start of their next shift, which is not in the loaded schedule' : win[1] != null ? 'from their last shift, which is not in the loaded schedule, to ' + fmtT(win[1]) : 'unknown: the loaded schedule shows no shifts around these dates';
    var pr = { applies: false, usesSpot: false, window: win, text: '' };
    if (short) pr.text = 'None. A vacation request under 12 hours is not approved leave, so it gives no protection from mandates and does not use one of the two leave spots (CBA 10.2).';
    else if (capOver) pr.text = 'Probably none. Two other people are already protected, so this would be a third. If the Chief approves, the Chief names which days the requester can still be mandated (SOG 100.17.12). Window if protected: ' + wtxt + '.';
    else { pr.applies = true; pr.usesSpot = true; pr.text = 'Once approved: protected from mandates ' + wtxt + ' (from the end of the last shift before to the start of the next, SOG 100.17.11(2)(a)). This uses leave spot ' + (others.length + 1) + ' of 2 (SOG 100.17.12).' + (res.parts.some(function (p) { return p.volunteersOnly; }) ? ' For parts that are provisional, protection starts only if they are approved.' : ''); }
    pr.text += ' Two Kelly days off in a row are protected anyway and don\'t use a spot.';
    res.protection = pr;

    // Things the file cannot show.
    var tent = sc.records.filter(function (r) { return r.kind === 'slot' && /tentative/i.test(r.name); }), tdays = {};
    tent.forEach(function (r) { tdays[shiftDayOf(r.start)] = 1; });
    var tn = Object.keys(tdays).length, span = sc.first && sc.last ? Math.round((isoToWall(sc.last) - isoToWall(sc.first)) / DAY) + 1 : 0;
    if (tn && span && tn / span >= 0.8) res.checks.push('The schedule shows "Tentative Approval" seats on ' + tn + ' of ' + span + ' days. That is almost every day, so the tool reads it as a standing seat, not as pending leave.');
    else if (tn) { var tin = res.parts.reduce(function (a, p) { return a.concat(p.days.filter(function (d) { return tdays[d]; })); }, []); if (tin.length) res.checks.push('"Tentative Approval" appears on ' + tin.map(fmt).join(', ') + '. That probably means leave is pending on those days; check it.'); }
    if (!sub) res.checks.push('No submitted date was entered, so the tool assumed the request is on time. Enter it to check the ' + 'deadline.');
    res.checks.push('Whether anyone else asked for the same days first. In the monthly process the first request submitted gets the leave (CBA 10.2); the schedule doesn\'t show requests or when they came in.');
    res.checks.push('Whether ' + person + ' has enough ' + LEAVE_TYPES[type].toLowerCase() + ' hours banked (CBA 10.1 to 10.2, 9.2).');
    if (!others.length) res.checks.push('Who is already on approved leave. The schedule can\'t show it; tick them in "Things the schedule does not show" and the two-person limit is checked.');
    if (parts.some(function (p) { return p.holiday && type !== 'comp'; })) res.checks.push('The date this week\'s schedule is finalized, which is when the holiday answer is due. It is in a contract section (Article 7, Section 7.9) that is not in the copy used here.');
    if (type === 'comp' && parts.some(function (p) { return p.holiday; })) res.checks.push('Comp time on a contract holiday: the contract blacks out vacation and holiday leave only (CBA 10.4), so the tool treats comp time as an ordinary request. Confirm with the department.');
    if (sc.work.some(function (r) { return r.forName === person && r.name !== person && overlap(r.start, r.end, o0, o1); })) res.checks.push(person + ' has traded away shifts inside these dates. Those are not theirs to take leave from, and a trade is not approved leave (CBA 7.7).');

    res.status = ['ok', 'prov', 'short', 'conflict'][worst];
    res.statusText = { ok: 'Can be granted', prov: 'Provisional: only if volunteers cover it', short: 'Under the 12-hour minimum: volunteers only', conflict: 'Conflict to resolve' }[res.status];
    if (res.status === 'conflict' && res.parts.some(function (p) { return p.verdict.level === 'prov' || p.verdict.level === 'short'; })) res.statusText += ' (and parts are provisional)';
    return res;
  }
  function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }

  /* Roles: what the scheduler set wins; otherwise the guess from hours worked. */
  function effectiveRoster(sc, saved) {
    var inf = sc.inf || infer(sc), out = {};
    sc.people.forEach(function (n) { out[n] = (saved && saved[n]) || (inf.info[n] ? inf.info[n].guess : 'pt'); });
    Object.keys(saved || {}).forEach(function (n) { if (!out[n]) out[n] = saved[n]; });
    return out;
  }
  /* Things worth a second look after an import. Each is a plain sentence for the scheduler. */
  function rosterChecks(sc, saved, lists) {
    var inf = sc.inf || infer(sc), out = [];
    saved = saved || {}; lists = lists || {};
    sc.people.forEach(function (n) {
      var i = inf.info[n]; if (!i) return;
      if (!saved[n]) out.push({ name: n, kind: 'new', text: n + ' is new to the tool. Guessed ' + (i.guess === 'ft' ? 'full-time' : 'part-time') + ' from ' + i.hoursPer28 + ' hours per 4 weeks. Confirm it.' + (i.guess === 'ft' ? ' If they are full-time, also put them in the right place on the seniority and overtime lists.' : '') });
      else if (saved[n] === 'ft' && i.hoursPer28 < PT_FLAG) out.push({ name: n, kind: 'role', text: n + ' is set as full-time but has only ' + i.hoursPer28 + ' hours per 4 weeks on this schedule. If they went part-time, change it. If they are on leave, leave it.' });
      else if (saved[n] === 'pt' && i.hoursPer28 > FT_FLAG) out.push({ name: n, kind: 'role', text: n + ' is set as part-time but has ' + i.hoursPer28 + ' hours per 4 weeks. If they went full-time, change it and place them on the lists.' });
    });
    Object.keys(saved).forEach(function (n) {
      if (saved[n] === 'ft' && sc.people.indexOf(n) === -1) out.push({ name: n, kind: 'missing', text: n + ' is not on this schedule. They are still offered in the call lists with a warning. If they left, set them to "Not on the lists"; if they are on leave, tick it when you handle an opening.' });
      [['mand', 'Mandatory', 'top of'], ['vol', 'Voluntary', 'bottom of']].forEach(function (L) {
        if (saved[n] === 'ft' && lists[L[0]] && lists[L[0]].length && lists[L[0]].indexOf(n) === -1)
          out.push({ name: n, kind: 'list', list: L[0], text: n + ' is full-time but not on the saved ' + L[1] + ' Overtime List yet. Until you place them, they sit at the ' + L[2] + ' that list. Move them to the right spot.' });
      });
    });
    if (lists.labelsSeen && inf.labelsSeen.length && inf.labelsSeen.join() !== lists.labelsSeen.join())
      out.push({ name: '', kind: 'rotation', text: 'The shift labels changed (was ' + lists.labelsSeen.join(', ') + ', now ' + inf.labelsSeen.join(', ') + '). Crews and Kelly days are read fresh from each schedule, but check the call lists look right.' });
    return out;
  }
  /* The active list is the saved order cut down to current full-timers. A full-timer the list has
     never seen is placed provisionally (top of Mandatory, bottom of Voluntary) and flagged by rosterChecks. */
  function activeList(saved, ft, newAt) {
    var base = (saved || []).slice(), fresh = ft.filter(function (n) { return base.indexOf(n) === -1; });
    base = newAt === 'top' ? fresh.concat(base) : base.concat(fresh);
    return base.filter(function (n) { return ft.indexOf(n) !== -1; });
  }

  var api = { infer: infer, withInference: withInference, effectiveRoster: effectiveRoster, rosterChecks: rosterChecks, activeList: activeList, candidates: candidates,
    importICS: importICS, makeSchedule: makeSchedule, computeCallout: computeCallout, orderedNames: orderedNames,
    holidayName: holidayName, computeVacation: computeVacation, LEAVE_TYPES: LEAVE_TYPES, requestDeadline: requestDeadline, NOTICE: NOTICE, REASONS: REASONS, fmt: fmt, fmtT: fmtT, hhmm: hhmm, shortSpan: shortSpan, addDays: addDays,
    isoOf: isoOf, shiftDayOf: shiftDayOf, shiftStart: shiftStart, wall: wall, HOUR: HOUR, DAY: DAY, DEPT_TZ: DEPT_TZ };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CalloutEngine = api;
})(this);
