# Tracking Design Principles

Tracking should be one motion. Retrieval should be one question.

## 1. Track anything, organize never

The moment tracking requires a decision — "what category?", "what name?", "is this worth tracking?" — you've lost. Tracking is "this thing exists, it's here." Anything beyond that is friction, and friction kills the habit.

There is no taxonomy. There are no categories. There is no naming standard. Two tracking records for the same item, with different wording, is fine — that's a retrieval problem, not a tracking problem. Solve it at retrieval time, where the cognitive load is lower because you're already motivated (you need to find something).

## 2. Retrieval over inventory completeness

The system does not need to know about everything you own to be useful. It needs to answer the questions you actually ask. A system that knows about 30% of your stuff and answers every question about those items is far more valuable than one that knows about 80% but requires curation effort to maintain.

Never require a "complete inventory" as a precondition. The system is useful from the first tracking record.

## 3. The system tolerates lapses, and helps you re-enter

You will stop using it for a week, a month, three months. Re-entry must cost nothing. No backlog to process, no "out of date" warnings, no catching-up tax. The system that punishes you for lapses is the system you abandon.

After a lapse, the system *may offer* a re-entry path — suggesting zones most likely to have drifted, or surfacing recent searches that didn't get answered. It does not demand re-engagement; it lowers the activation cost when you choose to re-engage.

If a maintenance task is technically necessary (e.g., something physically moved and the system doesn't know), it surfaces only when you ask a question the stale data can't answer — never as a standing chore.

## 4. The inventory is a model, not a ledger

The system tries to be the territory — that's the whole point. When you ask "where is the drill?", you want an answer that gives you a real starting place: "last seen on the top shelf, 6 days ago" is the kind of answer that makes the system useful. Without it, you might as well not have a system. A best-guess starting point is far better than no information, even when the guess turns out to be wrong, because you check the suggested location first and *then* start looking around.

But the system is a *best guess*, not an authoritative ledger. Items move without being tracked. Records go stale. The inventory's job is to give you the highest-quality starting point available, not to be a perfect mirror.

The distinction matters because:

- **Staleness is not failure.** A 6-month-old "last seen" record is still better than no record, as long as it's understood as "last seen," not "definitely there."
- **Trying to make the inventory perfectly accurate is the Big Inventory trap.** Don't audit. Don't reconcile. Don't try to track every move.
- **State and context belong in the model.** "Checked out, working on deck" is a perfectly valid tracked location, and the system should treat that with the same machinery as "on the top shelf." There is no separate "state" concept — temporary status is just part of the most recent tracked text.
- **Verification is a prompt mechanism, not a discipline.** The system surfaces follow-ups ("you tracked this as 'checked out' two days ago — still accurate?") to keep the model fresh without requiring you to remember to update it.

The system being approximate is what makes it sustainable. The system being a model of reality is what makes it useful. Both are required.

## 5. Friction observation lives in-system

When the system fails you ("I asked where the X was, it said Y, X wasn't at Y"), the failure is recorded by *tracking it* — same motion as any other tracking event. No separate friction log. No discipline. The system being used is the system being observed.

## 6. Active support, never required

This is the ADHD-specific principle and the thing that distinguishes this system from "just a bunch of notes with smart search."

ADHD is not a motivation problem — you *want* to keep the system useful, you just forget to. The system therefore actively helps you remember: it notices conditions where prompting would help (you looked up an item recently — did you put it back?; you haven't touched zone X in months; you've tracked "can't find Y" three times — want to sweep?) and offers a relevant action.

Every prompt obeys four rules:

- **Dismissible at zero cost.** "Not now" never produces follow-up nagging.
- **Never accumulates.** No "5 items need attention" counter. No badges. No streak. No visible debt.
- **Specific and actionable.** A prompt with concrete context ("did you put the drill back?") beats a generic one ("review your inventory") every time. The generic prompts are valid but should be rare.
- **The system continues to work whether you take every offer or ignore every offer.** Prompts are scaffolding, not obligation.

What this rules out: notifications that demand attention, unread counters, streaks, "X items overdue" badges, gamification framing — anything that converts time-since-action into visible guilt.

What this rules in: loop-closure checks after retrieval, occasional zone-staleness suggestions, pattern-noticing ("you keep asking about this thing — want help locating it?"), gentle re-entry offers after lapses.

The distinction matters: a system that demands compliance is one more tax on an already-taxed executive function. A system that offers timely scaffolding is the prosthesis the executive function needed.
