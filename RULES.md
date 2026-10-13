# Callout rules used by the simulator

Sources:
- **SOG**: `SOGs Full Document 4.17.2026 (1).pdf`, text copy `sog.txt`. Line numbers below are from that copy.
- **CBA**: `24 - 26 Signed Agreement (2).pdf`, OCR copy `cba_ocr.txt`. Line numbers below are from that copy.

The contract (CBA) does not set a callout order. It leaves scheduling to the SOGs ("If this policy references any process that is not in the CBA, this policy shall be final", SOG 100.17.03, line 1203). The order comes from SOG 100.17B (short-notice openings) and the Mandatory Overtime List (SOG 100.17.08).

## What a "callout" is in this tool

Clicking a name on the calendar picks that entry. The opening starts as that entry's exact hours, and the scheduler can change the start and end (for example someone leaving at noon, SOG 100.17B.05). The entry can be a full 24-hour shift (08:00 to 08:00, CBA 7.3, line 588) or a partial one such as 08-20 or 20-08. The scheduler picks how much notice there is. The default is "less than 24 hours", because that's a typical sick call.

| Notice | Rule that applies |
| --- | --- |
| Less than 24 hours | SOG 100.17B.04, "Less than 24 hours of notice" (lines 1509-1520) |
| 24 to 72 hours | SOG 100.17B.04, "More than 24 hours of notice (less than 72)" (lines 1493-1507) |
| 72 hours up to one full rotation (6-7 days) | SOG 100.17B.04, "More than 72 hours of notice" (lines 1481-1491); short-notice definition 100.17B.03 (lines 1471-1474) |
| More than one full rotation | SOG 100.17.09(7)(a)-(d) (lines 1325-1350) |

## Before anyone is called

1. **Is a fill needed at all?** If the remaining crew still makes a legal ambulance with two paramedics, nothing more is done (SOG 100.50.06, lines 1929-1935). The calendar doesn't show licenses, so the tool shows this as a reminder.
2. **Management goes first.** Management has first right of refusal on short-notice openings, before any notice goes to employees (SOG 100.17B.06, lines 1545-1548). For openings with more notice, admin staff may take it after volunteers and before mandates (SOG 100.17.09(7)(c), lines 1344-1346).
3. **Volunteers.** The opening is posted in the scheduling software, and any qualified employee may take it. Minimum wait: 1 hour if under 24 hours of notice (lines 1509-1513), 4 hours for 24 to 72 hours (lines 1493-1497) and over 72 hours (lines 1481-1484), and 12 hours with more than a full rotation (lines 1329-1334). If a full-timer volunteers for the whole opening or at least 12 hours of it (whichever is less) with under 72 hours of notice, they move to the bottom of the Mandatory Overtime List and the hours count as mandated (lines 1522-1531).
   - With more than a full rotation of notice, volunteers are taken in **Voluntary Overtime List** order (line 1329). That list starts in seniority order, most senior first, and then re-sorts by fewest overtime hours worked (lines 1260-1266). Part-time staff, LTEs and volunteers are offered it next (lines 1336-1342).
   - With short notice, the SOG gives no order among volunteers.

## The mandate order (the main list)

**Rule M1. Use the Mandatory Overtime List.** Mandates go to the "top-most eligible employee" on the Mandatory Overtime List (SOG 100.17B.02, line 1467; 100.17.10, line 1357; lines 1484, 1498). The list starts in **reverse seniority** (least senior first), is reset every January 1 at 08:00, and changes by occurrence: whoever is mandated goes to the bottom (lines 1255-1258, 1268-1274, 1362).

**Rule M2. Under 24 hours of notice, the holdover crew goes first, for the first 24 hours.** With less than 24 hours of notice, the mandate goes to the top-most eligible employee "that is currently covering the ambulance schedule up to the point of the schedule vacancy" (lines 1513-1518). The tool reads this as anyone whose scheduled time runs right up to the moment the opening starts. Someone who is on until 12:00 counts too; the tool notes how many hours of the opening they're already working. This applies to the first 24 hours of the opening, which covers a whole one-shift callout.

- *Ambiguous:* the SOG doesn't say who is mandated inside the first 24 hours when nobody on duty can cover it (always true for a callout on the second day of a tour). Hours past the first 24 go to the "More than 24 hours" process (line 1519). The tool shows on-duty staff first, then a separate group titled "management's decision" listing everyone else in Mandatory list order, and never presents it as the rule (Astra review A01; SOG 100.17B.05 and 100.17B.07 give management judgment). Any hours past 24 get their own list. **Ask the department which reading they use.**
- *Ambiguous:* if the holdover crew had a trade or Kelly substitution, "currently covering" means whoever is actually on the schedule then. The tool reads the schedule.

**Rule M3. 24 hours or more of notice: the whole list.** Everyone eligible, in Mandatory Overtime List order (lines 1484-1487, 1498-1503).

**Rule M4. Pass and unreachable.** Each shift-work employee gets one "pass" a year after the schedule is final; using it moves them to the bottom of the list (SOG 100.17.13, lines 1416-1425). With 24 to 72 hours of notice, someone who doesn't answer the first call is deemed unreachable, and the mandate moves to the next person (lines 1501-1503). Both depend on what happens on the phone, so the tool shows them as notes and doesn't change the order.

## Who must NOT be called (or mandated)

| # | Rule | Source | How the tool knows |
| --- | --- | --- | --- |
| X1 | The person who called out | (the opening itself) | Clicked name |
| X2 | Already scheduled on the ambulance for the whole opening. Someone covering only part of it is still listed, with a note saying how many hours they already have. | SOG 100.17.11(1), line 1389 | Schedule |
| X3 | Would work more than 96 hours in a row without 24 hours off. This counts mandated, voluntary and swap hours alike. | SOG 100.17.03, lines 1207-1209 | Schedule, in hours: the stretch of work that includes the opening, where any break under 24 hours doesn't reset it |
| X4 | On approved leave. The exemption covers everything from the end of their last scheduled shift to the start of their next one. | SOG 100.17.11(2)(a), lines 1390-1393 | **Not on the schedule.** The scheduler ticks a box. |
| X5 | Two Kelly days off in a row count as approved leave for the same stretch, without using one of the two leave spots (100.17.12) | SOG 100.17.11(2)(b), lines 1395-1396 | Suggested from the schedule: two days in a row on their own shift letter with no time worked or traded at all, inside the off-duty gap that holds the opening. Protection ends the moment they next start work. Shown as "probably Kelly". The scheduler can tick "Approved leave" (if it was leave, so it counts toward the two), "Two Kelly days off" (to confirm) or "Not protected" (if the guess is wrong or the Chief says so). |
| X6 | Voluntarily worked 20 hours or more of overtime in a row: exempt for the 24 hours before and after | SOG 100.17.11(3), lines 1398-1400 | **Not on the schedule.** Tick box. |
| X7 | Already scheduled 12 hours or more on three days in a row (08:00 to 08:00): exempt for the 24 hours on either side of those days | SOG 100.17.11(4), lines 1402-1404 | Schedule, in hours |
| X8 | Not 100% current on certifications or not approved to drive | SOG 100.17.06, lines 1233-1239 | **Not on the schedule.** Tick box. |
| X9 | **Nobody may be mandated; volunteers only**, full opening first, partials only if together they cover it, otherwise the leave is denied: (a) vacation or holiday leave on a CBA 9.1 holiday (blackout date); (b) a vacation request of less than 12 hours, on any day; (c) any leave asked for after the monthly deadline, except qualified sick leave, on any day. | CBA 10.2, lines 801-813; CBA 10.4, lines 824-832; SOG 100.17.09(6), lines 1319-1324 | The scheduler picks the reason. A short vacation also gives the caller no mandate protection. |

Limits and fine print shown in the tool:
- **Only two people at a time may be exempt for approved leave** (SOG 100.17.12, lines 1408-1411). If more than two are ticked, the tool warns, and the scheduler ticks "Not protected" for whoever the Chief names. It doesn't pick for the Chief. Kelly-day exemptions (X5) don't count toward the two (lines 1413-1414). That line cites "100.17.12(2)(b)", which looks like a typo for 100.17.11(2)(b).
- **Shift swaps are not approved leave** for mandate protection (CBA 7.7, lines 667-669).
- **Leave of less than 12 hours is not approved leave** for mandate protection (CBA 10.2, lines 806-808).
- SOG 100.17.12 was due for joint review by 8/31/2025 and is removed if both sides didn't approve it (lines 1443-1446). The tool keeps it, since it's still in the April 2026 SOG, but notes this.

## What the schedule can't tell the tool (shown as notes or tick boxes)

Approved leave (X4), 20-hour voluntary overtime (X6), certification status (X8), passes used, who is unreachable, part-time and volunteer availability, paramedic licensure (100.50.06), and the **current** Mandatory and Voluntary Overtime List order after mandates during the year.

## Placeholders

- **Seniority order** isn't in any of the three documents (CBA Article 4 defines it as most recent hire date, with a number drawing for current employees, lines ~425-446). Until a scheduler sets it, the tool shows a banner and labels every call list "practice only".
- **The Mandatory and Voluntary Overtime Lists** start from seniority (reverse and forward). The scheduler can reorder them and move people to the bottom as mandates happen. They're saved in that browser only.
- **Part-time staff** are not on the Mandatory Overtime List. They're offered openings as volunteers (SOG 100.17.04, 100.17.09(7)(b)).

## Reading the rotation from the schedule

The schedule (an iCal file from Aladtec) is the only source of truth. The tool never stores shifts, crews or Kelly days. It works them out again from every schedule it loads, so ordinary changes need no upkeep:

| Change | What the tool does |
| --- | --- |
| Two people trade shifts | Reads the trade from the entry. The worker counts as working, the original owner counts as off but not protected (CBA 7.7). |
| Someone switches crews or shift letters | Their home shift is the letter they own most hours on in the loaded schedule. Nothing to re-enter. |
| New hire | Shows up as "new". Role is guessed from hours (120+ hours per 4 weeks means full-time), and the scheduler confirms once. A new full-timer joins the Mandatory list at the top and the Voluntary list at the bottom, because they're the least senior (SOG 100.17.08). |
| Full-time to part-time, or back | Their role setting decides. If the hours stop matching (full-time under 40 a month, or part-time over 160), the tool flags it for a one-click change. |
| Someone leaves, or is on long leave | Their list places are kept and they're skipped while they're not on the schedule. The tool asks whether they left. |
| The Chief changes the rotation (CBA 7.2) | Home shifts and Kelly days are re-read from the new schedule. If the shift labels change (for example A/B/C becomes Red/Gold/Black), the tool says so and asks for a quick check. |
| No shift labels in the feed | Kelly days can't be read, so the tool says so and the scheduler uses the Kelly tick box. |

**Kelly days:** a full-timer with no time worked or traded on two days in a row of their own shift letter is shown as *probably* on Kelly days, protected from the end of their last work to the start of their next. It is a suggestion, not a fact: it can also be leave (which counts toward the two-person limit) or something else. The tick boxes confirm it, re-label it as leave, or remove it. A single such day gives no protection; the tool notes it in case it was leave.

Checked on the October 2026 schedule: the 2027 Master Calendar's 168-day Kelly cycle, run backwards, matches 59 of 62 crew-days in October. That confirms the reading. The tool doesn't use the cycle, though, because a rotation change would break it.

**Limits:** the tool sees one loaded file. Shifts before the file starts or after it ends are unknown, which can hide a 96-hour stretch or a 3-day block at the edges, so the tool warns when an opening is within 4 days of either end. The fix is loading a file that spans a few days more.

## Fixes after the independent review (REVIEW-ASTRA-20261013.md)

| Finding | Change |
| --- | --- |
| F01 | Reasons are now: sick or emergency; approved 12h+ leave on time; vacation under 12 h; late leave. The last two, and leave on a holiday, are volunteer-only (X9). |
| F02, F03 | Kelly is a suggestion that can be confirmed, changed to leave, or removed ("Not protected"). It's worked out in real clock time, ends when they return, and partly worked days don't count as days off. |
| F04 | Anyone in the file as a trade owner, and any saved full-timer missing from the file, stays on the lists (the missing ones carry a warning). |
| F05 | The opening's start and end can be edited. Each person's legal hours are kept, even when only part is within the 96-hour limit, and mandates are limited to the unprotected hours. Hours past the first 24 get their own list. |
| F06 | The volunteer-credit step shows only under 72 hours, and includes restoring the original person. The 1-hour adjacent exception is shown. |
| F07 | The practice-only warning stays until seniority and both overtime lists are built, and it warns if seniority changes afterwards. |
| F08 | New full-timers are placed provisionally and flagged so the scheduler puts them in the right spot. The Voluntary list is described as hours-ordered after January. |
| F09 | Tick boxes clear on every new opening or time change. The 20-hour box says "within 24 h of", which covers before and after. |
| F10 | UTC and other time zones are converted to Chicago time, not the viewer's computer time. |
| F11 | Overlaps are counted once. Exact duplicates, cancelled entries and older versions of an entry are dropped, and the file notes say so. |
| F12 | Added: the 12-hour part-time posting window, notification methods per notice level, the 60-hour notice deadline, the Chief's power to shorten waits, the pass procedure at every notice level, and the mid-shift note. |

Still open, for the department: rule M2 (who is mandated inside 24 h when nobody on duty can cover it), whether break hours count toward the 96-hour limit (the tool counts the whole span), whether SOG 100.17.12 is still in force, and how exactly 24 h or 72 h of notice is classified. Out of scope: monthly bidding and finalization, the special-event list, leave approval and payroll.

