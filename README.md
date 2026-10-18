# Unnamed Municipality EMS Callout Helper

**Unfinished. For testing.**

A tool for schedulers. When someone calls out of a shift, or asks for future time off, it shows:

- **who to call, in order**, and why each person is in that spot, and
- **who must NOT be called or mandated**, and why.

The rules come from the union contract (2024-26 agreement) and the department SOGs (sections 100.17 and 100.17B). `RULES.md` lists every rule with its section number.

## How to open it

1. Download **`Callout Helper.html`**.
2. Double-click it. It opens in your web browser (Edge, Chrome, Firefox or Safari).

Nothing to install, and it works without internet. Nothing you load or click is sent anywhere.

## Loading the schedule

The schedule always comes from Aladtec. You never type a schedule into this tool.

1. In Aladtec, download the schedule as an **iCal (.ics)** file. Include a few days before and after the dates you care about.
2. Click **Load schedule (.ics)** and choose the file, or drag the file onto the page.

The tool remembers the last schedule you loaded on this computer. Load a fresh one whenever the schedule changes. No schedule yet? Click **Try it with a made-up sample schedule**.

## How to use it

1. Go to the right month with the arrows.
2. **Click the name of the person calling out.** Each name is one block of time (for example 08-20 or 20-08), so you can call out a whole shift or part of one.
3. On the right, pick **how much notice** you have and **why the shift is open**.
4. Read down the right side:
   - **Before you call anyone**: the steps the SOG says come first.
   - **Call in this order**: everyone who can be mandated, in order, with notes such as "already working 4 hours of this opening".
   - **Do NOT call**: people who can't work it at all, and why.
   - **Do NOT mandate**: people protected from a mandate who may still volunteer (part-timers, approved leave, two Kelly days off).
5. If something isn't on the schedule (approved leave, 20+ hours of voluntary overtime, lapsed certifications, or a Kelly day the tool missed), open **Things the schedule does not show** and tick it.

## Vacation requests

Click **Vacation request** at the top to switch from callouts. Click the name of the person asking for time off, on the shift where it starts (click the same person on a later shift to stretch the dates). Pick the kind of leave (vacation, holiday leave or comp time) and enter the date the request was submitted. Sick leave isn't a vacation request; use **Callout** for that.

The right side shows:

1. **Can it be approved?** Granted normally, provisional (a holiday blackout date or a late request: only if volunteers cover it), under the 12-hour minimum (volunteers only, no mandate), or a conflict (someone else already off, or more than two people protected by approved leave). A request that crosses a holiday or a month is split into parts, each judged on its own.
2. **How the opening gets filled.** Which SOG process applies given the timing, with the dates, then the ordered lists: part-time and volunteers first, full-time bids in Voluntary list order, then mandates in Mandatory list order for anything left. Who can't be called or mandated is shown with reasons, the same as for a callout.
3. **The requester's protection.** The window they are protected from mandates once approved, and whether it uses one of the two leave spots.

The schedule can't show approved leave. Tick anyone already off in **Things the schedule does not show** and the two-person limit is checked. The tool lists everything else the scheduler must check (who asked first, banked hours, the date the schedule is finalized). `RULES.md` section "Vacation and leave requests" lists the rules and where the tool had to choose between two readings; those need a department answer.

## Setting up once: Roster and lists

The tool keeps only what the schedule can't show:

- **Who is full-time.** The tool guesses from hours worked. Confirm it once. After that, it only asks again when something changes, such as a new name, someone missing, or hours that no longer fit their role.
- **Seniority**, most senior at the top. It isn't in any department document, so set it once. Until you do, call lists are labeled "practice only".
- **The Mandatory and Voluntary Overtime Lists.** Build them from seniority with one button. When someone is mandated or uses their yearly pass, click **To bottom**.

Crews, shift letters, trades and Kelly days are never entered here. They're read fresh from every schedule. So shift trades, crew changes, new hires, and people going part-time or full-time don't break the tool. If the Chief changes the rotation, the tool notices and asks for a quick check.

These settings are saved **in that browser on that computer only**. Clearing the browser's data erases them.

## What it can't know

Licensure, who answers the phone, who already used their pass, and part-timer or volunteer availability. The scheduler always makes the final call. If the tool and the SOG ever disagree, the SOG wins. Please report it.

## For whoever maintains it

- `Callout Helper.html`: the file people use. It's **built** from `src/`. Don't edit it by hand.
- `src/engine.js`: iCal import, reading the rotation, and the rules. `src/app.js`: the screen. `src/page.html`: layout and styles.
- `sample/`: a made-up October schedule and roster, used by the tests and the "Try it" button.
- Rebuild after any change: `node tools/build.js`. Run the checks: `node tests/test.js` (needs [Node.js](https://nodejs.org)).
- Never commit real schedules. `private/` is ignored by git for that reason.
