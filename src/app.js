/* Page code: load schedule, calendar, sidebar, roster and lists. Logic lives in engine.js. */
(function () {
  'use strict';
  var W = window.CalloutEngine;
  var KEY = 'callout-helper-settings-v2', SCHED_KEY = 'callout-helper-schedule-v2';
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // ---------- Saved settings (this browser only). Only what the schedule can't show. ----------
  // roles: {name: 'ft'|'pt'|'ignore'}   seniority/mand/vol: ordered names   labelsSeen: last import's shift labels
  function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function store(k, v) { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); return true; } catch (e) { return false; } }
  var S = load(KEY) || {};
  S.roles = S.roles || {}; S.seniority = S.seniority || []; S.mand = S.mand || []; S.vol = S.vol || [];
  function save() { store(KEY, S); }
  function listsReady() { return S.seniority.length > 0 && S.mand.length > 0 && S.vol.length > 0; }

  var sched = null, checks = [], short = {};
  // Short calendar names: first name, plus last-name letters only where first names clash.
  function makeShort(names) {
    var out = {}, by = {};
    names.forEach(function (n) { var f = n.split(' ')[0]; (by[f] = by[f] || []).push(n); });
    Object.keys(by).forEach(function (f) {
      by[f].forEach(function (n) {
        if (by[f].length === 1) { out[n] = f; return; }
        var rest = n.split(' ').slice(1).join(' '), k = 1;
        while (k < rest.length && by[f].some(function (m) { return m !== n && m.split(' ').slice(1).join(' ').slice(0, k) === rest.slice(0, k); })) k++;
        out[n] = f + ' ' + rest.slice(0, k) + '.';
      });
    });
    return out;
  }
  function sn(n) { return short[n] || n; }
  var state = { mode: 'callout', vac: { person: '', from: null, to: null, submitted: '', type: 'vacation' }, year: 0, month: 0, pick: null, from: null, to: null, notice: 'lt24', reason: 'sick', leave: [], kelly: [], unprot: [], ot20: [], certs: [] };
  var tickOpen = false;

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function btn(text, fn, cls, disabled) { var b = el('button', 'small' + (cls ? ' ' + cls : ''), text); b.type = 'button'; b.disabled = !!disabled; b.onclick = fn; return b; }

  // ---------- Loading a schedule ----------
  function useSchedule(text, label, remember) {
    var imp = W.importICS(text);
    if (!imp.records.length) { alert('No schedule entries were found in that file. Make sure it is an iCal (.ics) calendar file.'); return false; }
    sched = W.withInference(W.makeSchedule(imp, label));
    if (remember && !store(SCHED_KEY, JSON.stringify({ label: label, text: text }))) {
      // Too big to keep: it still works now, it just needs loading again next time.
    }
    var every = sched.people.slice(); sched.work.forEach(function (r) { if (r.forName && every.indexOf(r.forName) === -1) every.push(r.forName); });
    short = makeShort(every);
    checks = W.rosterChecks(sched, S.roles, { labelsSeen: S.labelsSeen, mand: S.mand, vol: S.vol });
    (sched.notes || []).forEach(function (x) { checks.push({ name: '', kind: 'file', text: 'Schedule file: ' + x }); });
    S.labelsSeen = sched.inf.labelsSeen; save();
    var today = new Date(), ti = today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate());
    var start = ti >= sched.first && ti <= sched.last ? ti : sched.first;
    state.year = +start.slice(0, 4); state.month = +start.slice(5, 7) - 1; state.pick = null;
    $('sourceLabel').textContent = label + ', ' + W.fmt(sched.first) + ' to ' + W.fmt(sched.last);
    $('welcome').hidden = true; $('main').hidden = false;
    drawAll();
    if (checks.length) openRoster();
    return true;
  }
  function readFile(file) {
    var r = new FileReader();
    r.onload = function () { useSchedule(String(r.result), file.name.replace(/\.ics$/i, ''), true); };
    r.readAsText(file);
  }

  // ---------- Banner: what needs a look ----------
  function drawBanner() {
    var b = $('banner'); b.innerHTML = '';
    var ftSet = W.effectiveRoster(sched, S.roles), anyFt = Object.keys(ftSet).some(function (n) { return ftSet[n] === 'ft'; });
    var msgs = [];
    if (checks.length) msgs.push(checks.length + (checks.length === 1 ? ' thing' : ' things') + ' changed since the last schedule (new names or hours that don\'t match a role).');
    if (!listsReady() && anyFt) msgs.push('The seniority and overtime lists are not set up yet, so the call order is practice only.');
    else if (S.seniority.length && S.listsFrom !== S.seniority.join('|') && !S.listsEdited) msgs.push('Seniority changed after the overtime lists were built. Check the lists.');
    if (!msgs.length) { b.hidden = true; return; }
    b.hidden = false;
    b.appendChild(el('span', null, msgs.join(' ')));
    b.appendChild(btn('Review', openRoster));
  }

  // ---------- Calendar ----------
  function drawCalendar() {
    $('monthTitle').textContent = MONTHS[state.month] + ' ' + state.year;
    var grid = $('grid'); grid.innerHTML = '';
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(function (d) { grid.appendChild(el('div', 'dow', d)); });
    var first = new Date(Date.UTC(state.year, state.month, 1)).getUTCDay();
    var days = new Date(Date.UTC(state.year, state.month + 1, 0)).getUTCDate();
    for (var i = 0; i < first; i++) grid.appendChild(el('div', 'day empty'));
    for (var d = 1; d <= days; d++) grid.appendChild(dayCell(state.year + '-' + pad(state.month + 1) + '-' + pad(d), d));
  }
  // One function call per day, so each click handler keeps its own entry.
  function dayCell(iso, d) {
    var cell = el('div', 'day'), head = el('div', 'dhead');
    head.appendChild(el('span', 'dnum', String(d)));
    var lab = sched.inf.dayLabel[iso], hol = W.holidayName(iso);
    if (lab) head.appendChild(el('span', 'lab', lab));
    if (hol) { cell.classList.add('holiday'); head.appendChild(el('span', 'hol', hol)); }
    cell.appendChild(head);
    var entries = sched.onDay(iso).filter(function (r) { return r.kind !== 'event'; });
    if (!entries.length && (iso < sched.first || iso > sched.last)) cell.classList.add('outside');
    entries.forEach(function (r) {
      var row = el('div', 'entry' + (r.kind === 'slot' ? ' slot' : ''));
      if (r.kind === 'work') {
        var b = el('button', 'name', sn(r.name)); b.type = 'button'; b.title = r.name;
        b.setAttribute('aria-label', r.name + (state.mode === 'vacation' ? ' asks for leave, ' : ' calls out, ') + W.fmtT(r.start) + ' to ' + W.fmtT(r.end));
        if (state.mode === 'callout' && state.pick && state.pick.id === r.id) b.classList.add('picked');
        if (state.mode === 'vacation' && state.vac.person === r.name && state.vac.from != null && r.start < state.vac.to && r.end > state.vac.from) b.classList.add('picked');
        if (S.roles[r.name] === 'ignore') b.classList.add('ignored');
        b.onclick = function () { if (state.mode === 'vacation') pickVacation(r); else pick(r); };
        row.appendChild(b);
      } else row.appendChild(el('span', 'slotname', r.name));
      var t = el('span', 'span', W.shortSpan(r)); row.appendChild(t);
      if (r.forName) { row.title = 'Trade: ' + r.name + ' working for ' + r.forName; row.appendChild(el('span', 'trade', 'for ' + sn(r.forName))); }
      cell.appendChild(row);
    });
    return cell;
  }
  // Tick boxes belong to one opening: a new click or new times clear them (they are facts about that time).
  function clearTicks() { state.leave = []; state.kelly = []; state.unprot = []; state.ot20 = []; state.certs = []; }
  function pick(r) {
    clearTicks(); state.pick = r; state.from = r.start; state.to = r.end;
    drawCalendar(); drawSidebar(); $('side').scrollTop = 0;
  }
  // Vacation mode: a click picks the person and their shift; clicking the same person again stretches the dates to include that shift.
  function pickVacation(r) {
    var v = state.vac;
    if (v.person !== r.name || v.from == null) { clearTicks(); v.person = r.name; v.from = r.start; v.to = r.end; }
    else { v.from = Math.min(v.from, r.start); v.to = Math.max(v.to, r.end); }
    drawCalendar(); drawSidebar(); $('side').scrollTop = 0;
  }
  function setMode(m) {
    if (state.mode === m) return;
    state.mode = m; clearTicks();
    $('modeCallout').className = 'mode' + (m === 'callout' ? ' on' : ''); $('modeVacation').className = 'mode' + (m === 'vacation' ? ' on' : '');
    $('modeCallout').setAttribute('aria-pressed', String(m === 'callout')); $('modeVacation').setAttribute('aria-pressed', String(m === 'vacation'));
    if (sched) { drawCalendar(); drawSidebar(); }
  }
  // Opening start/end inputs, in department time (minutes since 1970 as wall clock).
  function toInput(t) { var d = new Date(t * 60000); return d.toISOString().slice(0, 16); }
  function dateBox(label, value, onchange) {
    var wrap = el('label', 'sel'); wrap.appendChild(el('span', null, label));
    var i = el('input'); i.type = 'date'; i.value = value || ''; i.onchange = function () { onchange(i.value); };
    wrap.appendChild(i); return wrap;
  }
  function fromInput(v) { var m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)$/.exec(v); return m ? W.wall(+m[1], +m[2], +m[3], +m[4], +m[5]) : null; }
  function timeBox(label, value, onchange) {
    var wrap = el('label', 'sel'); wrap.appendChild(el('span', null, label));
    var i = el('input'); i.type = 'datetime-local'; i.value = toInput(value); i.step = 900;
    i.onchange = function () { var t = fromInput(i.value); if (t != null) onchange(t); };
    wrap.appendChild(i); return wrap;
  }

  // ---------- Sidebar ----------
  function drawSidebar() {
    if (state.mode === 'vacation') { drawVacation(); return; }
    var side = $('result'); side.innerHTML = '';
    if (!state.pick) {
      side.appendChild(el('h2', null, 'Who calls out?'));
      side.appendChild(el('p', 'hint big', 'Click a person\'s name on the calendar. This side will show who to call, in order, and who must not be called.'));
      return;
    }
    var r = W.computeCallout({ sched: sched, entry: state.pick, from: state.from, to: state.to, notice: state.notice, reason: state.reason, roster: S.roles,
      mandList: listsReady() ? S.mand : null, volList: listsReady() ? S.vol : null,
      leave: state.leave, kelly: state.kelly, unprot: state.unprot, ot20: state.ot20, certs: state.certs });
    side.appendChild(el('h2', null, r.caller + ' calls out'));
    side.appendChild(el('div', 'sub', r.opening + (r.holiday ? ', ' + r.holiday : '')));
    var opts = el('div', 'opts');
    var times = el('div', 'times');
    times.appendChild(timeBox('Opening starts', state.from, function (t) { state.from = t; clearTicks(); drawSidebar(); }));
    times.appendChild(timeBox('Opening ends', state.to, function (t) { state.to = t; clearTicks(); drawSidebar(); }));
    opts.appendChild(times);
    opts.appendChild(el('div', 'hint', 'Change these if only part of the shift is open, for example someone leaving at noon.'));
    opts.appendChild(selectBox('How much notice?', W.NOTICE, state.notice, function (v) { state.notice = v; drawSidebar(); }));
    opts.appendChild(selectBox('Why is the shift open?', W.REASONS, state.reason, function (v) { state.reason = v; drawSidebar(); }));
    side.appendChild(opts);
    r.warnings.forEach(function (w) { side.appendChild(el('div', 'warn', w)); });

    var steps = el('details', 'steps'); steps.open = true;
    steps.appendChild(el('summary', null, 'Before you call anyone (' + r.steps.length + ' steps)'));
    var ol = el('ol'); r.steps.forEach(function (s) { ol.appendChild(el('li', null, s)); }); steps.appendChild(ol);
    side.appendChild(steps);

    var ticks = el('details', 'tickbox'); ticks.open = tickOpen; ticks.ontoggle = function () { tickOpen = ticks.open; };
    var marked = state.leave.length + state.kelly.length + state.unprot.length + state.ot20.length + state.certs.length;
    ticks.appendChild(el('summary', null, 'Things the schedule does not show' + (marked ? ' (' + marked + ' marked)' : '')));
    ticks.appendChild(el('p', 'hint', 'Tick anyone this applies to for this opening only (they clear when you pick another opening). "Not protected" is for when the Chief says someone on leave or Kelly days can still be mandated, or the tool guessed a Kelly day wrong.'));
    ticks.appendChild(tickTable());
    side.appendChild(ticks);

    side.appendChild(el('h3', 'callhead', 'Call in this order'));
    if (!listsReady()) side.appendChild(el('div', 'warn', 'Practice only: the seniority and overtime lists have not been set up, so these positions are not real yet. Open \"Roster and lists\".'));
    drawGroups(side, r);
  }
  // The ordered call groups and the two "do not" lists, shared by callouts and vacation requests.
  function drawGroups(side, r) {
    var n = 0;
    r.groups.forEach(function (g) {
      side.appendChild(el('div', 'gtitle' + (g.discretion ? ' discretion' : ''), g.title));
      if (g.note) side.appendChild(el('div', 'gnote', g.note));
      var list = el('ol', 'calllist');
      if (!g.people.length) list.appendChild(el('li', 'none', 'Nobody in this group.'));
      g.people.forEach(function (p) {
        var li = el('li'); li.value = ++n;
        li.appendChild(el('strong', null, p.name));
        if (p.why) li.appendChild(el('span', 'why', p.why));
        (p.notes || []).forEach(function (x) { li.appendChild(el('span', 'why note', x)); });
        list.appendChild(li);
      });
      side.appendChild(list);
    });
    side.appendChild(el('h3', 'nohead', 'Do NOT call'));
    var nc = el('ul', 'nolist'); r.noCall.forEach(function (x) { nc.appendChild(personLine(x)); }); side.appendChild(nc);
    if (r.noMandate.length) {
      side.appendChild(el('h3', 'nohead soft', 'Do NOT mandate (may still volunteer)'));
      var nm = el('ul', 'nolist soft'); r.noMandate.forEach(function (x) { nm.appendChild(personLine(x)); }); side.appendChild(nm);
    }
  }
  function personLine(x) { var li = el('li'); li.appendChild(el('strong', null, x.name)); x.reasons.forEach(function (r) { li.appendChild(el('span', 'why', r)); }); return li; }
  function selectBox(label, options, value, onchange) {
    var wrap = el('label', 'sel'); wrap.appendChild(el('span', null, label));
    var s = el('select');
    Object.keys(options).forEach(function (k) { var o = el('option', null, options[k]); o.value = k; if (k === value) o.selected = true; s.appendChild(o); });
    s.onchange = function () { onchange(s.value); }; wrap.appendChild(s); return wrap;
  }
  function tickTable() {
    var cols = [['leave', 'Approved leave'], ['kelly', 'Two Kelly days off'], ['unprot', 'Not protected'], ['ot20', 'Within 24 h of 20+ h voluntary OT'], ['certs', 'Certs lapsed or can\'t drive']];
    var t = el('table', 'ticks'), hr = el('tr'); hr.appendChild(el('th', null, 'Name'));
    cols.forEach(function (c) { hr.appendChild(el('th', null, c[1])); }); t.appendChild(hr);
    // The same people the engine can offer, including saved full-timers who are not on this schedule.
    W.candidates(sched, S.roles).forEach(function (n) {
      var tr = el('tr'); tr.appendChild(el('td', 'tn', n + (sched.people.indexOf(n) === -1 ? ' (not on this schedule)' : '')));
      cols.forEach(function (c) {
        var td = el('td'), cb = el('input'); cb.type = 'checkbox';
        cb.checked = state[c[0]].indexOf(n) !== -1; cb.setAttribute('aria-label', n + ': ' + c[1]);
        cb.onchange = function () { var a = state[c[0]], i = a.indexOf(n); if (cb.checked && i === -1) a.push(n); else if (!cb.checked && i !== -1) a.splice(i, 1); drawSidebar(); };
        td.appendChild(cb); tr.appendChild(td);
      });
      t.appendChild(tr);
    });
    return t;
  }


  // ---------- Vacation requests ----------
  function isoOfWall(t) { return new Date(t * 60000).toISOString().slice(0, 10); }
  function drawVacation() {
    var side = $('result'); side.innerHTML = '';
    var v = state.vac;
    side.appendChild(el('h2', null, 'Vacation request'));
    if (!v.person || v.from == null) {
      side.appendChild(el('p', 'hint big', 'Click the name of the person asking for time off, on the shift where it starts. Click the same person on a later shift to stretch the dates over it. This side will show whether the leave can be granted and how the opening is filled.'));
      return;
    }
    var r = W.computeVacation({ sched: sched, person: v.person, from: v.from, to: v.to, submitted: v.submitted, type: v.type, roster: S.roles,
      mandList: listsReady() ? S.mand : null, volList: listsReady() ? S.vol : null, seniority: S.seniority,
      leave: state.leave, kelly: state.kelly, unprot: state.unprot, ot20: state.ot20, certs: state.certs });
    side.appendChild(el('div', 'sub', v.person + ', ' + r.range));
    var opts = el('div', 'opts');
    opts.appendChild(selectBox('Who asks?', (function () { var o = {}; sched.people.forEach(function (n) { o[n] = n; }); return o; })(), v.person, function (x) { clearTicks(); v.person = x; drawCalendar(); drawSidebar(); }));
    var times = el('div', 'times');
    times.appendChild(timeBox('Leave starts', v.from, function (t) { v.from = t; drawCalendar(); drawSidebar(); }));
    times.appendChild(timeBox('Leave ends', v.to, function (t) { v.to = t; drawCalendar(); drawSidebar(); }));
    opts.appendChild(times);
    opts.appendChild(el('div', 'hint', 'Only the person\'s own shifts between these times are covered. Change the times for a partial day.'));
    opts.appendChild(selectBox('Kind of leave', W.LEAVE_TYPES, v.type, function (x) { v.type = x; drawSidebar(); }));
    opts.appendChild(dateBox('Date the request was submitted (blank = on time)', v.submitted, function (x) { v.submitted = x; drawSidebar(); }));
    opts.appendChild(btn('Start over with another shift', function () { v.person = ''; v.from = null; clearTicks(); drawCalendar(); drawSidebar(); }, 'wide'));
    side.appendChild(opts);
    r.warnings.forEach(function (w) { side.appendChild(el('div', 'warn', w)); });
    if (r.status === 'none') return;

    var ticks = el('details', 'tickbox'); ticks.open = tickOpen; ticks.ontoggle = function () { tickOpen = ticks.open; };
    var marked = state.leave.length + state.kelly.length + state.unprot.length + state.ot20.length + state.certs.length;
    ticks.appendChild(el('summary', null, 'Things the schedule does not show' + (marked ? ' (' + marked + ' marked)' : '')));
    ticks.appendChild(el('p', 'hint', 'Tick \"Approved leave\" for anyone who is already off on these days; the two-person limit and the yearly one-per-day rule are checked from that. The other boxes work as they do for a callout.'));
    ticks.appendChild(tickTable());
    side.appendChild(ticks);

    side.appendChild(el('h3', 'vhead', '1. Can it be approved?'));
    var top = el('div', 'verdict ' + (r.status === 'ok' ? '' : r.status)); top.appendChild(el('strong', null, r.statusText));
    if (r.total != null) top.appendChild(el('span', null, r.typeName + ', ' + hoursTxt(r.total) + (r.yearly ? ', guaranteed yearly request' : '') + (r.parts.length > 1 ? ', ' + r.parts.length + ' parts' : '') + '.'));
    side.appendChild(top);
    r.parts.forEach(function (p) {
      var box = el('div', 'verdict ' + (p.verdict.level === 'ok' ? '' : p.verdict.level));
      box.appendChild(el('strong', null, (r.parts.length > 1 ? 'Part ' + p.n + ' (' + p.label + '): ' : '') + p.verdict.title));
      box.appendChild(el('span', null, p.verdict.text));
      if (p.deadline) box.appendChild(el('span', 'why', p.deadline));
      side.appendChild(box);
    });
    r.verdicts.forEach(function (x) { var box = el('div', 'verdict ' + x.level); box.appendChild(el('strong', null, x.title)); box.appendChild(el('span', null, x.text)); side.appendChild(box); });

    side.appendChild(el('h3', 'vhead', '2. How the opening gets filled'));
    if (!listsReady()) side.appendChild(el('div', 'warn', 'Practice only: the seniority and overtime lists have not been set up, so these positions are not real yet. Open \"Roster and lists\".'));
    if (r.unknownHours) side.appendChild(el('div', 'hint', 'No schedule for these dates, so there is no list of who could fill it yet.'));
    r.parts.forEach(function (p) {
      if (!p.callout) return;
      var d = el('details', 'vpart'); d.open = p.n === 1;
      d.appendChild(el('summary', null, (r.parts.length > 1 ? 'Part ' + p.n + ': ' : '') + p.label + (p.volunteersOnly ? ' (volunteers only)' : ' (monthly process)')));
      var st = el('details', 'steps'); st.open = true; st.appendChild(el('summary', null, 'Which process applies (' + p.callout.steps.length + ' steps)'));
      var ol = el('ol'); p.callout.steps.forEach(function (s) { ol.appendChild(el('li', null, s)); }); st.appendChild(ol); d.appendChild(st);
      if (p.mandated.length) d.appendChild(el('div', 'hint', 'If nobody volunteers, this part falls to ' + p.mandated.join(', ') + '. They then go to the bottom of the Mandatory list before the next part is filled.'));
      p.callout.warnings.forEach(function (w) { if (!/Schedule file:/.test(w)) d.appendChild(el('div', 'warn', w)); });
      drawGroups(d, p.callout);
      side.appendChild(d);
    });

    side.appendChild(el('h3', 'vhead', '3. The requester\'s protection'));
    var pb = el('div', 'verdict ' + (r.protection.applies ? '' : 'prov')); pb.appendChild(el('span', null, r.protection.text)); side.appendChild(pb);

    side.appendChild(el('h3', 'vhead', 'What the scheduler must check'));
    var ul = el('ul', 'vcheck'); r.checks.forEach(function (x) { ul.appendChild(el('li', null, x)); }); side.appendChild(ul);
  }
  function hoursTxt(m) { var h = Math.round(m / 60 * 4) / 4; return h + (h === 1 ? ' hour' : ' hours'); }

  // ---------- Roster and lists screen ----------
  function openRoster() { $('settings').hidden = false; $('main').hidden = true; drawRoster(); }
  function closeRoster() {
    // Anything shown on the review screen counts as confirmed once the scheduler leaves it.
    var roles = W.effectiveRoster(sched, S.roles);
    sched.people.forEach(function (n) { if (!S.roles[n]) S.roles[n] = roles[n]; });
    save(); checks = W.rosterChecks(sched, S.roles, { mand: S.mand, vol: S.vol });
    $('settings').hidden = true; $('main').hidden = false; drawAll();
  }
  var ROLE = { ft: 'Full-time', pt: 'Part-time', ignore: 'Not on the lists' };
  function drawRoster() {
    var box = $('lists'); box.innerHTML = '';
    if (checks.length) {
      var c = el('div', 'listcol checks');
      c.appendChild(el('h3', null, 'Please check'));
      var ul = el('ul'); checks.forEach(function (x) { ul.appendChild(el('li', null, x.text)); }); c.appendChild(ul);
      c.appendChild(el('p', 'hint', 'Change a role below if a guess is wrong. Leaving this screen confirms the rest.'));
      box.appendChild(c);
    }
    var roles = W.effectiveRoster(sched, S.roles);
    var rc = el('div', 'listcol');
    rc.appendChild(el('h3', null, 'Who is who'));
    rc.appendChild(el('p', 'hint', 'Only full-time staff are on the overtime lists. Crews, shifts and Kelly days are read from each schedule, so they never need entering here.'));
    var tb = el('table', 'roles');
    var all = sched.people.slice();
    Object.keys(S.roles).forEach(function (n) { if (all.indexOf(n) === -1) all.push(n); });
    all.forEach(function (n) {
      var tr = el('tr'), i = sched.inf.info[n];
      tr.appendChild(el('td', 'tn', n));
      var s = el('select'); s.setAttribute('aria-label', 'Role for ' + n);
      Object.keys(ROLE).forEach(function (k) { var o = el('option', null, ROLE[k]); o.value = k; if ((S.roles[n] || roles[n]) === k) o.selected = true; s.appendChild(o); });
      s.onchange = function () { S.roles[n] = s.value; save(); checks = W.rosterChecks(sched, S.roles, { mand: S.mand, vol: S.vol }); drawRoster(); };
      var td = el('td'); td.appendChild(s); tr.appendChild(td);
      var detail = i ? i.hoursPer28 + ' hrs / 4 wks' + (i.home ? ', ' + (i.home === 'KELLY' ? 'Kelly crew' : i.home) : '') : 'not on this schedule';
      tr.appendChild(el('td', 'hint', detail));
      tb.appendChild(tr);
    });
    rc.appendChild(tb); box.appendChild(rc);

    var ft = all.filter(function (n) { return (S.roles[n] || roles[n]) === 'ft'; });
    var cur = sched.people.filter(function (n) { return roles[n] === 'ft'; });
    listCol(box, 'seniority', 'Seniority (most senior at the top)', 'From the contract (Article 4). Used to start the overtime lists.', W.orderedNames(S.seniority, ft, function (n) { return S.roles[n] !== 'ignore'; }), cur);
    listCol(box, 'mand', 'Mandatory Overtime List (next to be mandated at the top)', 'Starts least senior first, then changes by mandates. After someone is mandated or uses their yearly pass, click "To bottom" (not for a mandate of 1 hour or less right next to their own shift). Place a new full-timer where the department says.', W.activeList(S.mand, ft, 'top'), cur);
    listCol(box, 'vol', 'Voluntary Overtime List (first offered at the top)', 'Starts most senior first; after that, fewest voluntary fill-in overtime hours at the top. Keep it matching the department\'s posted list. Place a new full-timer where the department says.', W.activeList(S.vol, ft, 'bottom'), cur);
  }
  function listCol(box, k, title, hint, order, current) {
    var col = el('div', 'listcol');
    col.appendChild(el('h3', null, title)); col.appendChild(el('p', 'hint', hint));
    var ol = el('ol', 'editlist');
    order.forEach(function (n, i) {
      var li = el('li'); li.appendChild(el('span', 'ln', n + (current.indexOf(n) === -1 ? ' (not on this schedule; place kept)' : '')));
      li.appendChild(btn('Up', function () { move(k, order, i, i - 1); }, '', i === 0));
      li.appendChild(btn('Down', function () { move(k, order, i, i + 1); }, '', i === order.length - 1));
      if (k !== 'seniority') li.appendChild(btn('To bottom', function () { move(k, order, i, order.length - 1); }, '', i === order.length - 1));
      ol.appendChild(li);
    });
    col.appendChild(ol);
    if (k === 'seniority') col.appendChild(btn('Restart both overtime lists from this order (as on January 1)', function () {
      if (!confirm('This replaces the Mandatory and Voluntary lists with fresh lists built from seniority. Continue?')) return;
      S.seniority = order.slice(); S.mand = order.slice().reverse(); S.vol = order.slice(); S.listsFrom = S.seniority.join('|'); S.listsEdited = false; save(); drawRoster();
    }, 'wide'));
    box.appendChild(col);
  }
  function move(k, order, from, to) {
    if (to < 0 || to >= order.length) return;
    var x = order.splice(from, 1)[0]; order.splice(to, 0, x);
    S[k] = order.slice(); if (k !== 'seniority') S.listsEdited = true; save(); drawRoster();
  }

  function drawAll() { drawBanner(); drawCalendar(); drawSidebar(); }

  // ---------- Wiring ----------
  function shiftMonth(n) { var m = state.month + n; state.year += Math.floor(m / 12); state.month = ((m % 12) + 12) % 12; drawCalendar(); }
  $('prev').onclick = function () { shiftMonth(-1); };
  $('next').onclick = function () { shiftMonth(1); };
  $('modeCallout').onclick = function () { setMode('callout'); };
  $('modeVacation').onclick = function () { setMode('vacation'); };
  $('openSettings').onclick = function () { if (sched) openRoster(); };
  $('closeSettings').onclick = closeRoster;
  ['fileInput', 'fileInput2'].forEach(function (id) { $(id).onchange = function () { if (this.files[0]) readFile(this.files[0]); this.value = ''; }; });
  $('loadSample').onclick = function () { useSchedule(document.getElementById('sample-ics').textContent, 'Sample schedule (made-up names)', false); };
  $('resetAll').onclick = function () {
    if (!confirm('Erase the saved roles, seniority, overtime lists and schedule on this computer?')) return;
    try { localStorage.removeItem(KEY); localStorage.removeItem(SCHED_KEY); } catch (e) { /* ignore */ }
    location.reload();
  };
  ['dragover', 'drop'].forEach(function (ev) {
    document.addEventListener(ev, function (e) { e.preventDefault(); if (ev === 'drop' && e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]); });
  });
  var saved = load(SCHED_KEY);
  if (saved && saved.text) useSchedule(saved.text, saved.label, false);
  else { $('welcome').hidden = false; $('main').hidden = true; }
  if (!document.getElementById('sample-ics')) $('loadSample').hidden = true;
})();
