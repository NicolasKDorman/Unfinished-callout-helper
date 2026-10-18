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
- **A vacation request of less than 12 hours is not approved leave** for mandate protection (CBA 10.2, lines 806-808). This is about vacation requests only, not sick or emergency leave.
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
| New hire | Shows up as "new". Role is guessed from hours (120+ hours per 4 weeks means full-time), and the scheduler confirms once. A new full-timer is placed provisionally (top of the Mandatory list, bottom of the Voluntary list) and flagged on each list that lacks them until the scheduler places them. The Voluntary list is hours-ordered after January, so the bottom is not necessarily right (SOG 100.17.08). |
| Full-time to part-time, or back | Their role setting decides. If the hours stop matching (full-time under 40 a month, or part-time over 160), the tool flags it for a one-click change. |
| Someone leaves, or is on long leave | Their list places are kept. A saved full-timer who is missing from the schedule is still offered in the call lists with a warning, and has tick-box rows like everyone else, so leave or lapsed certifications can be marked. The tool asks whether they left. |
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
| RR01 | The tick-box table now uses the same people as the engine (`candidates`), so a saved full-timer missing from the file has leave, Kelly, cert and other rows. |
| RR02, RR03 | Legal hours under the 96-hour limit come from one search (`legalSet`) that tries the opening in 15-minute pieces from the start and from each point 24 hours after existing work, taking a piece only if the block it joins, together with all pieces already taken, stays within 96 hours. The most hours wins. So a legal middle portion is found when both ends are blocked, every offered piece set is safe together, and a few minutes of remaining capacity is kept (no 15-minute minimum is in the source). |
| RR04 | Each call-list group clips every row to its own window (first 24 hours, hours after, or the whole opening). Volunteer rows show "Can volunteer for" (legal hours), not the mandate span. |
| RR05 | List checks cover both the Mandatory and the Voluntary list, each on its own, and the app passes both. A name placed on one list still warns for the other. |
| RR06 | "The Chief may shorten the wait" shows only for the 24-to-72-hour and under-24-hour notice levels, where SOG 100.17B.04 says it (the more-than-72-hour paragraph only sets the four-hour minimum). The wait is a manual check; the tool has no clock. Long-notice case-by-case posting exceptions (SOG 100.17.09(7)(a)-(b)) are not modelled. |

Still open, for the department: rule M2 (who is mandated inside 24 h when nobody on duty can cover it), whether break hours count toward the 96-hour limit (the tool counts the whole span), whether SOG 100.17.12 is still in force, and how exactly 24 h or 72 h of notice is classified. Out of scope: monthly bidding and finalization, the special-event list, leave approval and payroll.

## Vacation and leave requests

The "Vacation request" view answers three questions for a request for future time off: can it be approved, how is the opening it creates filled, and what protection does the requester get. It reuses the callout engine's eligibility logic (`computeCallout`), so who is not called or mandated is decided by the same rules (X1 to X9 above). Sick leave is not a vacation request; use the callout view for a sick call.

Line numbers: CBA lines are from `cba_ocr.txt`, SOG lines from `sog.txt`.

### The rules, with sources

| # | Rule | Source |
| --- | --- | --- |
| V1 | **Guaranteed yearly leave.** Requests for the whole following calendar year are due **October 15** (on the department form and in the scheduling software), in **full 24-hour shifts**. Only **one** shift-work employee may be off on a given day. If several asked for the same date, **highest seniority** gets it. Finalized by **November 1**. The total asked for cannot exceed the projected vacation and holiday leave due. | CBA 10.2, lines 787-800 |
| V2 | **Monthly requests (leave through the year).** After the yearly process, leave may still be requested. It must be in **before the 25th of the month before the schedule is finalized**: the deadline is **the 24th at 23:59, two months before the leave month** (the CBA's example: January 24 for March). Made in the scheduling software. If several people ask for the same leave on the same day, the **first one submitted** gets it. The CBA says "same leave of any timeframe on the same day", so this is a first-come rule, not a one-per-day limit. | CBA 10.2, lines 801-810 |
| V3 | **12-hour minimum.** A request is not less than 12 hours. A shorter vacation request may still be approved, but the hours **must be filled without a mandate**, and it is **not approved leave for mandate protection**. | CBA 10.2, lines 805-808 |
| V4 | **Late requests.** Any leave request except qualified sick leave that comes in after the V2 deadline may be approved by the Chief or designee, but **follows the blackout policy** (V5), with an answer in a timely manner. | CBA 10.2, lines 811-813 |
| V5 | **Blackout dates.** Every CBA 9.1 holiday is blacked out for vacation. Vacation or holiday leave may still be requested; approval is **provisional**. Covered voluntarily: approved. Would need a mandate: **denied**. Approval or denial is due on or before the day the ambulance schedule for that week is finalized (CBA points to Article 7, Section 7.9, which is **not in the contract copy we have**, so the tool cannot give that date). | CBA 10.4, lines 824-832; holidays CBA 9.1, lines 730-743 |
| V6 | **Leave types.** Comp time uses "the same process and timeframes" as vacation. Holiday leave "shall be scheduled as designated in Article 10, Section 2". So vacation, holiday leave and comp time follow V1 to V5. | CBA 7.5, lines 652-653; CBA 9.2, lines 744-749 |
| V7 | **Filling the opening when it is known before the monthly finalizing process starts** (an on-time request): (1) qualified volunteers and part-time or LTE staff, anything left after 23:59 on the last day of the month goes to (2); (2) from the 1st to 23:59 on the 5th only full-time staff may bid, awarded in **Voluntary Overtime List** order, going through the month's vacancies in date order, with more consecutive hours winning a clash; (3) administrative staff, volunteers, LTE or part-time; (4) all qualified staff re-bid until noon on the 10th, then first come first served; (5) anything left is **mandated by 5 pm on the 13th** (next business day if the 13th is a weekend or holiday), and then the next month's schedule is final. | SOG 100.17.09(1)-(5), lines 1284-1317 |
| V8 | **Mandating in the monthly process.** Chronological order of the month; the top-most eligible person on the **Mandatory Overtime List** takes the first vacancy for as many hours as policy and the CBA allow, then moves to the bottom; the next vacancy goes to the next top-most eligible person. Notice is by email (the software's automatic email is enough). The yearly "pass" only applies after finalization, so it is **not** offered here. | SOG 100.17.10(1)(a), lines 1355-1371; pass SOG 100.17.13, lines 1416-1425 |
| V9 | **Vacancy from tentatively approved leave treated as a blackout date** (holiday, late, or under 12 hours): filled by any full-time or part-time employee who agrees to work the **full** vacancy, first come first served, then by people who agree to work **portions** as long as the vacancy gets completely filled. **At no time is anyone mandated.** If it can't be completely filled, the leave is denied. | SOG 100.17.09(6), lines 1319-1324; CBA 10.2, 10.4 |
| V10 | **Not used for leave requests:** 100.17.09(7) and (8) and SOG 100.17B are for sick time and unplanned emergency leave. | SOG 100.17.09(7)-(8), lines 1325-1354 |
| V11 | **Approved leave protects from mandates** from the end of the person's last shift before the leave to the start of their next shift. | SOG 100.17.11(2)(a), lines 1390-1393 |
| V12 | **Only two employees at a time** may be exempt from mandates for approved leave. A third may still request. If approved, the Chief gives notice of which days they are **not** exempt. Two contiguous Kelly days off don't count toward the two. | SOG 100.17.12, lines 1406-1414 |
| V13 | Shift swaps are not approved leave. | CBA 7.7, lines 660-673 |
| V14 | The Chief or designee approves leave requests. | SOG 100.50.04, line 1907 |

### How the tool applies them

- **The opening** is the requester's own scheduled shifts inside the dates, clipped to the start and end times entered. Shifts that run into each other are one opening. Each opening is split at the 08:00 day boundaries around a holiday and at month changes, because the deadline and the blackout rule belong to the day and month.
- **Which process:** an on-time request on a normal day, 12 hours or more, is a **monthly** fill (V7, V8). A holiday day, a late request or a request under 12 hours is **volunteers only** (V9). The tool never uses the short-notice process (SOG 100.17B) for a leave request.
- **Late** means the submitted date is after the 24th, two months before the first day of the part. **On time** needs a submitted date; if none is entered the tool assumes on time and says so.
- **Guaranteed yearly** means the part is in the year after the submitted date, the submitted date is on or before October 15, and the part is whole 08:00-to-08:00 days. A holiday day in it still follows V5.
- **Conflicts the tool can see:** it can't see anyone's leave. The scheduler ticks the people who are already off on those days ("Approved leave" in the tick table). In the yearly process one other person already off is a conflict (V1); the tool also compares seniority when both are on the seniority list. In the monthly process the CBA gives no one-per-day limit, so the tool only tells the scheduler that the first request submitted wins. Two or more others ticked means the requester would be a third person off, and V12 applies.
- **Order of fills:** parts of one request are filled in date order. In the monthly process, anyone assumed mandated for an earlier part moves to the bottom of the Mandatory list before the next part (V8). The readout says this assumes nobody volunteered for the earlier part.
- **"Tentative Approval" seats on the schedule:** in the October file the seat appears on 30 of the 31 days, all 24 hours, regardless of crew. That doesn't look like a mark for leave, so the tool treats it as a standing seat and ignores it. If a future file shows them on only some days, the tool says they might be pending leave ("probably"), as a hint and not a fact.

### Where the reading is uncertain (both readings, and the one the tool takes)

1. **When the monthly process "starts".** SOG 100.17.09(1) closes on "the last day of the month", step 2 starts on "the 1st", and the CBA example puts the request deadline on January 24 for March. Reading A (taken): for leave in month M, step 1 runs until 23:59 on the last day of M-2, bids run on the 1st to 5th of **M-1**, the re-bid ends at noon on the 10th of M-1, mandates go out by 5 pm on the 13th of M-1, and M's schedule is final then. Reading B: the whole process sits one month later. A runs together with the CBA's January 24 for March; B leaves a gap with no step between them. **Ask the department to confirm the dates.**
2. **Does the 12-hour minimum apply to one request or one day?** The CBA says "these requests shall not be less than 12 hours". The tool counts the total hours of the request, because that is what is submitted. A request made of two separate 8-hour days totals 16 and passes.
3. **A holiday inside a long request.** The blackout (V5) is "on a blackout date". The tool splits the request and applies it only to the holiday days; the other days are treated normally. The alternative, treating the whole request as provisional, is stricter than the text.
4. **Yearly leave on a holiday.** V1 gives guaranteed leave, V5 says a holiday is blacked out for vacation. The tool lets the blackout win, because 10.4 speaks of the specific dates.
5. **A late request that the Chief approves.** V4 says it follows the blackout policy, so the tool uses V9 (volunteers only). Whether the Chief can instead choose to mandate is not allowed by V9's "at no time shall any employee be mandated".
6. **Whether late and holiday leave, once approved, protect the requester.** The CBA only removes protection for requests under 12 hours (V3). The tool says an approved holiday or late request of 12+ hours counts as approved leave (V11) and uses one of the two spots. Ask the department.
7. **The "one shift-work employee off per day" limit** is written into the yearly process only. The tool does not apply it to monthly requests.
8. **Which department answers "protected by approved leave" counts.** V12 counts people exempt at the same time. The tool counts the people ticked as off on any day of the request, which is the safe, higher count.
9. **Comp time on a holiday.** Comp time follows the vacation process (V6), but the blackout text (V5) names only vacation and holiday leave. The tool treats comp time on a contract holiday as an ordinary request and tells the scheduler to confirm with the department. The stricter reading (blackout applies to comp time too) would make it provisional.
