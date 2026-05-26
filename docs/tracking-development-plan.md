# Tracking — Implementation Plan

An ADHD-aware inventory and location tracking system, built as a new content category inside the existing Lattice infrastructure. Track loosely, retrieve by question, active support without obligation. Voice-first capture with the Atom Echo as the primary in-home device and Tasker-on-phone as the portable complement.

This plan is a sequence of usable milestones, not a feature checklist. Each phase leaves you with something you actually use. If a phase starts to feel like it's going to take more than a week or two, the right move is to scope it down, not push through.

Modeled on the Lattice plan structure and integrates with Lattice's deployed infrastructure — same spine, same surface, parallel content category alongside `captures`, `archives`, and `local_files`. This is the same pattern Lattice's Phase 5 used to add web archives.

---

## Architecture summary

- **Tracking record** — the single data structure produced by every tracking path. Free-form text plus minimal metadata. Append-only. Newest record wins at retrieval time; older records become location history. Stored in a new `tracks` table in the Lattice spine's SQLite.
- **Tracking paths** — concrete entry points that produce tracking records:
  - HA Voice via Atom Echo (primary, in-home, hands-free via wake word)
  - Tasker-triggered voice via Google Assistant on phone (primary, portable / out-of-home)
  - Bluetooth button → Tasker (alternative for hands-busy with phone in pocket)
  - Signal-text / photo / voice (secondary, universal fallback; voice depends on Lattice's transcription path being restored)
  - Desktop hotkey (secondary)
  - Lattice surface form (deferred to Phase 4)

  Each path supports two commands: a *track* command (records the item's location in its expected place; `displaced: false`) and a *checkout* command (records the item as away from its expected place; `displaced: true`). All paths converge on one append point: `POST /api/agent/track` on the Lattice spine.
- **Retrieval** — natural-language query returns a ranked list of tracking records with timestamps. Match logic is keyword (Phase 1) or semantic via QMD (Phase 5+). The most recent matching record is the answer; older records show as history.
- **Board view (Phase 4)** — a kanban-style view of tracked items organized into free-text bins (e.g., "desk," "drawer," "top shelf"). Drag-and-drop between bins is itself a tracking event — creates a new record with `source: "surface-drag"` and `supersedes` set to the prior current record. Items are derived from tracked noun phrases; bins are created lazily. Complements voice tracking for bulk-relocation moments.
- **Prompt channel** — the system surfaces *offers* (not notifications) at moments where action would help. v1 ships one prompt: loop-closure after retrieval. Prompts are dismissible at zero cost and never accumulate. Reuses Lattice's positive-dismissal component pattern.
- **Failure-into-track loop** — when retrieval is wrong or empty and you locate the item another way, the act of locating it is itself a tracking record (with the new location). There is no "correct the database" mode; the system observes itself by being used wrongly.
- **Lattice integration** — the tracking system is a new content category, not a separate deployment. Reuses the existing spine, auth (Caddy + Authentik / bearer token for agent routes), domain, backups, surface infrastructure, notification posture toggle, "where you were" frame, and positive-dismissal action rows.

---

## The tracking record

Every tracking path produces a record of this shape. Pre-committed; not user-specified.

```json
{
  "text":         "drill is on the garage top shelf, blue case",
  "captured_at":  "2026-05-26T14:30:12Z",
  "source":       "ha-voice:<area>" | "tasker-voice" | "bt-button" |
                  "signal-voice" | "signal-text" | "signal-photo" |
                  "hotkey" | "surface-form" | "surface-drag",
  "displaced":    false,
  "photo_ref":    null | "/var/lib/lattice/tracks/photos/<hash>.jpg",
  "supersedes":   null | <id of prior tracking record>
}
```

### Field decisions and rationale

- **`text` is one free-form string, not separate `item` + `location` fields.** Parsing "[item] [location]" at tracking time reintroduces a decision ("which part is the item?"), which violates Principle 1. Retrieval works fine on a single text blob because the matcher is semantic — you don't need parsed fields for "where is the drill?" to find "drill is on the garage top shelf."
- **No `tags`, no `category`, no `zone` field.** Categorization at tracking time is the Principle 1 trap. The `source` field's area suffix (e.g., `ha-voice:printing-room`) provides spatial provenance automatically for HA Voice paths, without the user having to mention it.
- **`captured_at` is system-set, not user-provided.** Named to match Lattice's `captures` table convention; the user's job is to track, not to remember timestamps.
- **`photo_ref` is optional and not parsed.** For Signal-photo tracks, the image is stored and the caption indexed. The image itself is not OCR'd in v1.
- **`supersedes` is opt-in, not auto-set.** v1 surfaces a possible-duplicate prompt at tracking time and lets you decide. No auto-supersession.
- **`displaced` is a boolean, not a status enum.** It answers one question: *should I look in the normal place, or do I already know it's not there?* The "why" (lent to friend, in use on a project, broken, lost) stays in the free-text `text` field — there is no separate status enum. The boolean is set by which command was used, not by parsing text. An item's current displaced state is the value of its newest track. Tracking an item normally (`/track`) sets it back to `false`; an item is "checked back in" simply by being tracked in its expected place.

### Spine schema

```sql
CREATE TABLE tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  captured_at TEXT NOT NULL,        -- ISO 8601, client-provided
  ingested_at TEXT NOT NULL,        -- ISO 8601, spine-set
  source TEXT NOT NULL,
  displaced INTEGER NOT NULL DEFAULT 0,  -- 0 = normal/expected location, 1 = not where it usually is
  photo_ref TEXT,
  supersedes INTEGER REFERENCES tracks(id)
);

CREATE INDEX idx_tracks_captured_at ON tracks(captured_at);
CREATE INDEX idx_tracks_text_fts ON tracks(text);  -- or use SQLite FTS5 virtual table
CREATE INDEX idx_tracks_displaced ON tracks(displaced);

-- Query log for the loop-closure prompt mechanism
CREATE TABLE track_queries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  queried_at TEXT NOT NULL,
  opened_track_id INTEGER REFERENCES tracks(id),  -- set when user opens a result
  loop_closed_at TEXT,                            -- set when prompt was answered
  loop_outcome TEXT                               -- 'still_accurate' | 'moved' | 'skipped' | 'expired'
);

-- Bins for the Phase 4 board view. Created lazily; not used in Phase 0/1.
-- Defined here so the schema is forward-compatible from day one.
CREATE TABLE bins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  archived_at TEXT                    -- soft delete; bins are append-only too
);
```

---

## Tracking paths

### HA Voice via Atom Echo (primary in-home)

User says wake-word + tracking phrase. HA's voice pipeline transcribes locally (via Nabu Cloud STT for Phase 0 — see Phase 0 below). Custom sentence trigger matches `track {content}`. HA automation fires a webhook POST to `https://lattice.rghsoftware.com/api/agent/track`.

**Example flow**:

> User: "OK Nabu, track the drill is on the top shelf, blue case"
> [LED on Echo blinks blue, then green]
> System: tracking record created with `source: "ha-voice:printing-room"`, `text: "the drill is on the top shelf, blue case"`

**Why this is the in-home primary**: it's the only tracking path that survives the phone-not-with-you failure mode. The Echo is always in the room, always listening, always ready. Marginal cost of additional coverage (more Echos in more rooms) is ~$13/device plus 30 minutes of setup.

**Area-aware provenance**: HA knows which Echo is in which area. The automation derives the area from the device that received the command, so `source` encodes the room automatically. Natural phrasing in the track ("the drill is on the top shelf") plus automatic spatial context.

**Two voice commands, two sentence triggers**:

- `"track {content}"` → POST with `displaced: false`. The default; for recording where things are in their normal places.
- `"check out {content}"` → POST with `displaced: true`. For recording when you're grabbing something to use elsewhere, lent it, or otherwise know it's not in its usual place.

Both create tracking records via the same endpoint; the only difference is the `displaced` field. The user picks the command based on intent at the moment of speaking — no sub-decision during the track.

**Phase 0 scope**: one Atom Echo in the printing room only. Other rooms remain coverage gaps until Phase 5+ adds more devices.

**The wake-word phrase to test**: `track` is the primary candidate. Worth pre-flighting in Phase 0 because "track" can collide with Google Assistant intents (package tracking, fitness tracking) — though HA Voice's sentence triggers own their own intent space and shouldn't have this problem. If it misfires, fall back to `log` or `track this` (two-word phrases) for distinctiveness. The `check out` variant should be tested for similar collisions, with fallback to `loan out` or `take {content}`.

### Tasker-triggered voice via Google Assistant on phone (primary portable)

User says "OK Google, run track in Tasker with [content]" (sets `displaced: false`) or "OK Google, run checkout in Tasker with [content]" (sets `displaced: true`). Google Assistant transcribes, passes the content as a Tasker variable. The corresponding Tasker task POSTs to `https://lattice.rghsoftware.com/api/agent/track` with `text: <content>`, `source: "tasker-voice"`, and the appropriate `displaced` value.

No server-side transcription needed — Google does the STT. This matters specifically because Lattice's Hermes pipeline was removed; relying on Android's built-in STT keeps tracking independent of any future transcription infrastructure.

**Prerequisite**: TV hotword detection disabled (already established). Google Home speakers stay unplugged (already established). These ensure "OK Google" routes cleanly to the phone.

**Wake-word collision check**: Same concern as HA Voice — "track" might collide with Google Assistant's built-in tracking intents, and "checkout" might collide with shopping intents. Pre-flight by testing both before relying on them. Fall back to more distinctive Tasker task names (`trackit`, `logit`, `loanit`) if needed.

### Bluetooth button → Tasker (alternative)

Flic or generic BLE button paired with phone. Press → Tasker task → records voice via Android STT (`Get Voice` action) → POST. Useful when voice activation is unreliable (noisy environments, voice-confused arbitration) or when discretion matters.

### Signal paths (secondary)

Sent to the existing Lattice Signal contact. Lattice's signal-cli relay already supports slash-command routing, so the discriminator is `/track` or `/checkout` at the start of the message:

- **Signal-text (track)**: `/track [content]` → POST with `displaced: false`. Example: `/track drill is on the top shelf, blue case`.
- **Signal-text (checkout)**: `/checkout [content]` → POST with `displaced: true`. Example: `/checkout drill working on the deck for the weekend`.
- **Signal-photo**: photo with `/track [caption]` or `/checkout [caption]` as the message body. Image stored at `photo_ref`, caption indexed.
- **Signal-voice**: voice note prefixed by a `/track` or `/checkout` text message in the same conversation, OR (if Lattice's relay supports it) voice notes auto-parsed for a leading "track" or "check out" word in the transcript. Depends on Lattice's transcription path being restored; the tracking side just consumes whatever text Lattice produces.

The slash-command pattern is reused infrastructure, so no new Signal contact or routing logic. Same pattern Lattice already uses for `/capture`, `/url`, etc.

### Desktop hotkey (secondary)

Global hotkey opens a text input. Type, submit. `source: "hotkey"`. Use at the computer when faster than picking up the phone.

### Surface form (deferred)

Web form integrated into the Lattice surface, available from any browser. `source: "surface-form"`. Deferred to Phase 4 when the surface gets a tracking view.

---

## Retrieval

A single natural-language query against the `tracks` table returns a ranked list of records.

**Query examples**:

- *"Where is the drill?"* — locate a specific item
- *"Do I have a 13mm wrench?"* — existence check
- *"What's in the garage top shelf?"* — zone query (works because records mention locations)
- *"Anything about the spare drill bits?"* — recall when you can't remember the exact phrasing

**Response shape**:

```
Top match (most recent):
  "drill is on the garage top shelf, blue case"
  tracked 6 days ago via ha-voice:garage

History (older tracks mentioning "drill"):
  "drill on workbench" — 2 months ago
  "drill in basement, charging" — 4 months ago
```

**Implementation decisions**:

- **Phase 1 uses keyword/FTS search** against `tracks.text`. Add SQLite FTS5 virtual table if performance demands. Semantic search via QMD (the embedding store Lattice already uses) is a Phase 5+ refinement once the workflow is validated.
- **Always show top match + history**, with relative timestamps. Recency makes confidence visible without requiring a confidence score.
- **No "results: 0" dead-ends.** When nothing matches, retrieval returns adjacent matches with a note ("Nothing exact. Closest matches: ...").
- **Retrieval logs the query** to `track_queries`. This data feeds the loop-closure prompt mechanism.

---

## Prompt mechanisms

### v1: loop-closure after retrieval

The single prompt shipped in Phase 1. Highest signal-to-friction ratio.

**Trigger conditions** (all must be true):

- The user ran a tracking query in the past 14 days, AND
- The user opened a result (i.e., `track_queries.opened_track_id` is set), AND
- At least 12 hours have passed since the query, AND
- No subsequent tracking record's text matches the opened track's key noun phrases, AND
- The prompt has not already fired for this query (`loop_closed_at` is null).

**Surface point**: appears as a "follow-up" item in the Lattice surface's existing inbox or a new "tracking follow-ups" lane. Not pushed via notification. The notification posture toggle in Lattice controls whether attention pings fire for follow-ups.

**Prompt content**:

For non-displaced tracks (the default):
```
You looked up "drill" 2 days ago.
Last tracked as: drill is on the garage top shelf, blue case

[Still there]   [No — here's where it is now]   [Skip]
```

For displaced tracks (last track was via `/checkout` or "check out"):
```
You looked up "drill" 2 days ago.
Last tracked as: drill working on the deck for the weekend
(checked out)

[Still out]   [No — here's where it is now]   [Skip]
```

The prompt echoes the opened track's text verbatim. The affirmative button label varies based on the opened track's `displaced` value — "Still there" vs. "Still out" — but both produce `loop_outcome: 'still_accurate'`. The cosmetic difference makes the prompt read naturally for both cases.

**Action semantics** (uses Lattice's positive-dismissal component):

- **Still accurate** → updates `track_queries.loop_outcome = 'still_accurate'`, `loop_closed_at = now()`. The opened track stands. No follow-up.
- **No — here's where it is now** → opens the tracking flow with `supersedes` pre-filled to the opened track's ID. The user records the new location/state. `loop_outcome = 'moved'`.
- **Skip** → `loop_outcome = 'skipped'`, dismissed. Does not reappear. No backlog. No counter.

**Expiration**: 14 days after the query. If `loop_closed_at` is still null, the prompt disappears and `loop_outcome = 'expired'`.

### v2+ prompts (Phase 5+)

Concrete candidates, in priority order. Each obeys the four rules from Principle 6 and ships individually, not in a batch.

- **Differentiated check-in frequency for displaced items**. Displaced items may warrant more frequent loop-closure prompts than items in their normal place — they're inherently more likely to be forgotten about. Phase 5+ refinement: shorter trigger threshold (e.g., 24 hours instead of 12) and/or shorter expiration window for displaced items. Worth testing in Phase 2/3 before committing — overly aggressive prompts on displaced items could become the nag pattern Principle 6 is designed to avoid.
- **Zone staleness offer**. If a zone (derived from `source` area suffixes) has had no tracking records or successful retrievals in 60+ days, surface "haven't seen the garage in a while — want to do a quick walkthrough?" Max once per zone per quarter.
- **Pattern-noticing offer**. If the same query phrase has been issued 3+ times in 30 days, surface "you keep asking about [X] — want help getting [X] pinned down?"
- **Re-entry support**. After 14+ days of no tracking events or queries, on next surface arrival show "Welcome back. Here's what's most likely to have moved: [list of high-activity zones inferred from history]. Nothing here is overdue."
- **Possible-duplicate at tracking time**. When a new track's noun phrase strongly overlaps with an existing record, surface "Looks like this might be an update to [old record]. Mark as moved?" Default: no auto-action.

---

## Phase 0 — Setup checklist

**Goal**: All capture paths can write a tracking record to the spine, and the spine can return a search result. No workflow features yet — just the substrate.

This is concrete enough to do in a long afternoon or one weekend session if all the pieces are at hand.

### Spine changes

1. **Add migration** `spine/migrations/NNN_tracks.sql` creating the `tracks` and `track_queries` tables (schema above).
2. **Add route** `POST /api/agent/track` with bearer-token auth (same middleware as `/api/agent/capture` and `/api/agent/index`). Accepts `{ text, captured_at, source, photo_ref?, supersedes? }`, validates with TypeBox, inserts. Returns `{ id }`.
3. **Add route** `GET /api/tracks/search?q=<query>` — runs LIKE / FTS5 against `tracks.text`, returns ranked results. Auth via Lattice's standard surface auth.
4. **Add route** `POST /api/tracks/queries/:id/open` — sets `opened_track_id` and `queried_at`. Called by the surface when the user opens a result.
5. **Static endpoint smoke test** — `curl` a track in, `curl` a search out, confirm round-trip works.

### Device setup

6. **Disable TV hotword detection** (Settings → Google Assistant → "Hey Google" → off for the TV).
7. **Confirm Google Home speakers stay unplugged** during testing.
8. **HA Voice setup**:
   - Configure Assist Pipeline with **Nabu Cloud STT** (you already pay for it; fastest setup; not architecturally pure but correct for "working product" priority — Phase 5+ can migrate to Jetson-hosted Whisper).
   - Flash the Atom Echo via ESPHome web flasher.
   - Pair Echo to HA. Assign it to area "Printing Room".
   - Create two custom sentence triggers:
     - `track {content}` → POST with `displaced: false`
     - `check out {content}` → POST with `displaced: true`
   - Create HA automations that fire on the triggers and POST to `https://lattice.rghsoftware.com/api/agent/track` with:
     ```yaml
     # for "track" trigger
     text: "{{ trigger.slots.content }}"
     source: "ha-voice:{{ trigger.device_area | slugify }}"
     displaced: false
     captured_at: "{{ now().isoformat() }}"
     ```
     The `check out` automation differs only in `displaced: true`.
   - Test both phrases. If they collide with Google Assistant intents (they shouldn't, but worth verifying), fall back to `log` / `track this` and `loan out` / `take this`.
9. **Tasker setup on phone**:
   - Install Tasker if not already present.
   - Create two tasks:
     - `track` (or `trackit` if collision testing demands): HTTP POST to `https://lattice.rghsoftware.com/api/agent/track` with body `{ text: %par1, source: "tasker-voice", displaced: false, captured_at: <timestamp> }`.
     - `checkout` (or `loanit` if collision testing demands): same as above but with `displaced: true`.
   - Test both: "OK Google, run track in Tasker with the drill is on the top shelf" and "OK Google, run checkout in Tasker with the drill working on the deck" → both records appear at the spine with appropriate `displaced` values.
10. **Signal setup**:
    - No new contact needed. Reuse the existing Lattice Signal contact.
    - Add `/track` and `/checkout` to the slash-command set in Lattice's signal-cli relay routing. Both route to `POST /api/agent/track`; the relay sets `displaced` based on which command was used. Messages starting with `/capture` continue routing to the existing capture endpoint.
    - Photo + `/track [caption]` or `/checkout [caption]` routes the photo to the tracking path with the caption indexed.
    - Test by sending `/track test from signal` and `/checkout test displacement from signal`. Confirm both records appear at the spine with appropriate `displaced` values and `source: "signal-text"`.

### Verification

**Done when**:

1. Each tracking path successfully writes a record to `tracks` and the record is searchable via `/api/tracks/search`.
2. You can stand in the printing room, say "OK Nabu, track [something]", and see the record appear within ~5 seconds.
3. You can pull out your phone anywhere with cell/WiFi, say "OK Google, run track in Tasker with [something]", and see the record appear.
4. The TV doesn't intercept "OK Google" anywhere in the house.

**Time estimate**: One long session (5–8 hours) if all components are at hand. The HA Voice + Atom Echo configuration is the longest pole; the spine route is short; the Tasker setup is short.

---

## Phase 1 — Define and ship the v1 workflow

**Goal**: The track-and-retrieve-and-loop-close workflow is fully runnable end to end. You can track, query, and respond to the loop-closure prompt.

**Scope**:

- All Phase 0 tracking paths are now considered "live." Use them naturally during the phase.
- Retrieval surface, minimum viable: either extend the Lattice surface with a basic tracking search view, OR (faster) hit `/api/tracks/search` directly from a desktop browser bookmark / curl alias for the duration of Phase 2. Don't block Phase 1 on surface integration — a CLI/curl retrieval mechanism is fine for a few weeks.
- **Loop-closure prompt v1**: implement the trigger conditions and three-action prompt. Surface it via either:
  - The Lattice surface's existing inbox (treat follow-ups as a new item type with the same positive-dismissal action row), OR
  - A daily Signal message via the Lattice notification posture (Standard mode fires it; Quiet suppresses) listing pending follow-ups with reply syntax to act on them
- **Lightweight duplicate detection at tracking time**: at spine-side, on insert, run a quick check — does the new track's text share a strong noun phrase (2+ word substring, case-insensitive) with any record from the past 90 days? If yes, the API response includes `possible_duplicates: [...]`. The user-facing decision happens at the surface or via a Signal reply — for Phase 1, accept that this might fire too often and refine in Phase 3.

**Deferred**:

- All v2+ prompts.
- Polished tracking view in the surface (Phase 4).
- Semantic retrieval via QMD (Phase 5+).
- Photo OCR.
- Auto-supersession beyond the duplicate prompt.

**Done when**:

- You can complete a full cycle (track → query → loop-closure prompt → response) without consulting documentation.
- The tracking action is reflexive enough that you do it without deliberation.
- You've successfully run the loop-closure prompt at least three times on real items.

**Time estimate**: An evening or two beyond Phase 0, assuming the spine and surface cooperate. The biggest risk is over-engineering the prompt mechanism; the simplest possible implementation is fine.

---

## Phase 2 — First real use period

**Goal**: Catch what the design got wrong before adding more.

**Scope**:

- Zero new features. Zero workflow changes. Zero "improvements."
- Use the workflow for every item-location event you happen to notice. Do not seek out items to track. Do not "do an inventory." If you walk into the printing room and notice you're putting a spool of filament on the shelf, track it. If you don't notice, don't.
- Use retrieval whenever you would have otherwise gone searching. Even if you suspect the system won't know, *ask first*. No-result queries are signal.
- When retrieval is wrong or empty and you locate the item another way, track the actual location. Don't fix the database; let the new record stand.
- Engage with the loop-closure prompt when it fires. Even "skip" is data.

**Friction surfaces in-system.** Frustrations get tracked the same way items do, with a `friction:` prefix in the text:
- `"friction: tried to find the spare drill bits, no results, ended up looking in three places"`
- `"friction: voice activation in the printing room missed twice while the printer was running"`
- `"friction: loop-closure prompt fired while I was busy and I just hit skip without thinking"`

These are searchable in Phase 3 review and are the primary input for Phase 4+ decisions.

**Coverage gaps**: rooms without the Atom Echo (and without you carrying your phone) will produce zero tracking records. That's expected. The Phase 3 review evaluates whether those gaps drove real friction, which informs Phase 5+ device-deployment priority.

**Duration**: Three weeks minimum. Two is novelty effect. Four is fine. Six gets diminishing returns vs. fixing things.

**Done when**: Three weeks have elapsed since Phase 1 ended. Wall-clock time, not "three weeks of consistent use." Inconsistent use is also signal.

**Time estimate**: Three to four weeks of wall time. No active design time.

---

## Phase 3 — Honest review

**Goal**: Read what use revealed, decide what to do next.

**Scope**:

- Query `tracks.text` for records starting with `friction:`. Read them all.
- Query `track_queries` for `loop_outcome = 'skipped'` and `loop_outcome = 'expired'`. Look for patterns.
- Query `track_queries` for queries that produced no results AND were followed by no subsequent tracking record matching the item. Were those items eventually found? Why or why not?
- Sample a dozen random tracks and ask: would I find this if I needed it? Try the relevant queries and see.
- Evaluate workflow assumptions:
  - **Free-form text instead of structured fields**: Are retrievals returning the right answers, or are you having to phrase queries oddly to match tracks?
  - **Voice-first tracking via wake word**: Is "OK Nabu, track ..." surviving real-room conditions (printer running, hands busy)? Is "OK Google, run track in Tasker with ..." surviving the latency of Assistant arbitration?
  - **Coverage gaps**: How many friction tracks reference rooms without the Echo? Does this justify Phase 4/5 deployment of more devices?
  - **Loop-closure prompt as v1**: Did it help? Did it become noise? Did it catch real drift?
  - **No auto-supersession**: Are duplicate records piling up, or is the duplicate prompt sufficient?
- Identify the **single biggest friction**.
- Pick **at most 3 changes** for Phase 4+.

**Output**: One paragraph of conclusion. A bulleted list of at most three changes, each specifying what specifically changes and why.

**Done when**: The paragraph and the list exist in writing.

**Time estimate**: One sitting, 60–90 minutes.

---

## Phase 4 — Surface integration

**Goal**: Tracking has first-class presence in the Lattice surface, not a CLI/curl side channel. Both the search view and the board view are core deliverables — neither is "if time permits."

**Scope** (specifics depend on Phase 3 outcomes):

### Search view

- Search box, results list with top-match + history, location tags from `source` field, photo thumbnails if `photo_ref` set.
- **Tracking reading view** — open a tracking record, see history of all tracks mentioning this item, see related zone tracks.
- Tracking history accessible via a `/track/:id` URL (mirrors Lattice's content-type URL pattern).
- Surface form as a tracking path — text input + optional photo upload + submit. `source: "surface-form"`.

### Board view (drag-and-drop binning)

A kanban-style board where items are cards organized into bins (free-text labels for locations like "desk," "drawer," "top shelf," "garage pegboard"). Core Phase 4 deliverable, not optional.

- **Items are derived, not explicit.** An item is a noun phrase that's been tracked at least once. The board shows one card per item; current location = newest tracking record's location. Fuzzy duplicate detection from Phase 1 means "drill" and "the drill" may initially appear as separate cards, with a "merge these?" affordance available.
- **Bins are free-text labels, created lazily.** No predefined taxonomy. Three creation paths:
  - From an existing track (right-click a card or location phrase → "use 'top shelf' as a bin")
  - Manually (type a name in a "New bin" input)
  - (Phase 5+) auto-suggested from clustering of `source` area suffixes and common location phrases
- **Displaced items get a visual indicator.** Cards whose most recent tracking record has `displaced: true` show a distinguishing visual (border color, small badge, or similar). At-a-glance, "what did I leave somewhere I need to bring back?" is answerable. A filter toggle in the board header shows only displaced items.
- **Drag-and-drop creates a new tracking record.** Dragging card X from bin A to bin B inserts a new track:
  ```
  text: "<item phrase> in <bin B name>"
  source: "surface-drag"
  displaced: false
  supersedes: <id of previous current record>
  ```
  Drag-to-bin always sets `displaced: false` (you're putting it somewhere defined, not checking it out). Marking an item as displaced from the board view is a separate explicit action (right-click → "mark as checked out" → text input for context). Old records remain. Append-only preserved. Location history is intact — the drag history *is* the move history.
- **Multi-bin items: not allowed.** Newest record wins; a card lives in one bin. Items whose current text doesn't clearly match any bin live in an **"Unbinned"** lane on the side. Displaced items appear in their last-known bin with the displaced indicator, OR in a dedicated "Checked Out" lane (depending on Phase 4 design preference — test both, pick what reads better).
- **No drag-to-merge.** Merging items is a separate explicit action with a confirmation, not a drag side-effect. Drag is reserved for "move location," not "consolidate identity."

### Follow-ups lane

- Pending loop-closure prompts surfaced as inbox items with the existing positive-dismissal action row component. Affirmative verb varies based on the opened track's `displaced` value: `Still there` for non-displaced, `Still out` for displaced. Other verbs are consistent: `No — here's where it is now` / `Skip`.
- "Where you were" frame extended to surface pending tracking follow-ups when applicable.

**Deferred**:

- Multi-item batch tracking from the surface (other than via drag-and-drop).
- Map-style or zone-style visualizations. Possibly never — the system is about retrieval and binning, not spatial browsing.
- Editing of tracking records (append-only stays — if a record is wrong, supersede it via a new track).
- Auto-bin suggestions (Phase 5+).
- Lattice adoption of the board/drag-and-drop component for non-tracking content. Evidence-based decision later; the drag infrastructure is built generically enough that Lattice could adopt it if Phase 2/3 use of Lattice surfaces an analogous need.

**Done when**: You'd reach for the surface (search OR board) for tracking interaction before reaching for `/api/tracks/search` directly OR voice-tracking individual location updates that could have been a single drag.

**Time estimate**: A weekend to a long weekend, reusing existing Lattice surface infrastructure and components. The board view's drag-and-drop adds material work over a search-only surface — budget the longer end if drag is the unfamiliar piece.

---

## Phase 5+ — Driven by real friction

After Phase 4, next moves depend on what continued use reveals. Concrete candidates, in rough priority order:

- **Semantic retrieval via QMD**. If keyword search has been missing too often (failed retrievals followed by manual finds with different wording), index `tracks` in the QMD collection alongside captures and archives. This is the workflow change with the highest expected payoff once the workflow is validated.
- **Additional Atom Echos in coverage-gap rooms**. Garage, kitchen, basement — whichever Phase 3 surfaces as the biggest gap. Each one costs ~$13 plus 30 minutes of setup.
- **SONOFF NSPanel Pro deployment** for a central location (kitchen wall is the canonical fit). Combines wake-word voice tracking with a touchscreen display that can surface follow-ups visually. This is the right next-device after Atom Echos prove the model.
- **Local STT migration**. Move HA's STT from Nabu Cloud to local Whisper on the Jetson Nano (where Obico is). Eliminates cloud dependency; aligns with Lattice's self-hosting principles. Specifically deferred from Phase 0 because Jetson setup is its own project; doing this now would block Phase 1.
- **v2 prompts**, one at a time, in this order:
  1. Possible-duplicate at tracking time (refined version with better matching).
  2. Zone staleness offer.
  3. Re-entry support after lapses.
  4. Pattern-noticing offer.
- **Photo OCR**. If photo tracks are common but captions aren't enough, run OCR over images and index the extracted text.
- **Image-content retrieval**. "Show me pictures of the garage shelves" — multimodal embeddings make this cheap; useful if photo-heavy tracking dominates.
- **Dedicated Android app**. Once the workflow is validated and Tasker-on-phone friction is concrete, an Android app can earn its place: home-screen widget for one-tap tracking, Quick Settings tile, native notification actions for loop-closure prompts, structured photo workflow, App Actions integration for cleaner voice triggering. Designed against real Phase 2/3 data, not in advance.
- **NFC tags at zone entries**. Tap phone to tag → triggers Tasker task with zone pre-filled. Low-effort spatial anchoring if Phase 3 reveals you keep forgetting to mention the zone.
- **Google Hubs / Nest Hubs as prompt-display surfaces**. They can't capture, but HA can push notification cards to them via the cast integration. The loop-closure prompt could surface visually on a kitchen Hub at breakfast.
- **Multi-user scope**. Household / partner / shared zones. Defer indefinitely; the personal case is hard enough.

Do not plan these specifically before Phase 3 prioritizes them.

---

## Cross-cutting concerns

### Append-only discipline

Never modify or delete a tracking record. If an item moved, track the new location with `supersedes` set. The "newest wins" rule is what makes append-only safe. Updating in place reintroduces the question "should I edit the old one or create a new one?" — exactly the decision the workflow is designed to avoid.

### Friction is data, not failure

A `friction:` prefixed track is a successful interaction with the system, not a broken one. The system learns by being used poorly. Don't apologize for friction tracks in Phase 3 review — they're the most valuable records you produced.

### The system can detect, the user decides

(Borrowed from Lattice's cross-cutting concerns, applies equally here.) The system can flag possible duplicates, flag stale zones, flag retrieval misses — but the editorial call belongs to the user. Auto-supersession, auto-categorization, auto-deletion are all rejected by default. A flag is information; an action is yours.

### Notifications are for attention, not for state

If the loop-closure prompt surfaces via Signal (or any notification channel), it does so as an attention ping with enough context to be useful from the phone, not as the prompt itself. Pending-prompt state lives in the Lattice surface and persists across notification dismissals. Mirrors Lattice's notification discipline.

### Working product over architectural purity, with two exceptions

This project's priority is a working prototype for workflow validation, not artifact-quality code. Use Nabu Cloud now and migrate to local STT later. Wire HA automations directly to the spine without a custom integration layer. Don't extract shared libraries between Lattice and the tracking system until both have shipped.

Two disciplines remain non-negotiable even in "working product" mode:

1. **Append-only / newest-wins for tracks.** Not for purity — for not corrupting Phase 2's friction signal. Editing records in place during the prototype destroys the data you'd use to evaluate the workflow.
2. **Friction tracking goes through the same channel as item tracking.** If you skip writing friction tracks because "this is just a prototype," you lose the only output that justifies the prototype existing.

### Backups

The Lattice spine already has daily SQLite backup discipline. The new `tracks` table is in the same SQLite, so it's covered. The `tracks/photos/` directory needs to be added to the file-backup set if photo tracking is used.

### Migrations

The `tracks` table migration goes in `spine/migrations/` per Lattice convention. Forward-only, applied on startup. Don't `ALTER TABLE` by hand.

---

## Honest time estimate

- Phase 0: one long session, 5–8 hours.
- Phase 1: an evening or two beyond Phase 0.
- Phase 2: three to four weeks of wall time, no active design.
- Phase 3: 60–90 minutes.
- Phase 4: a weekend.
- Phase 5+: indefinite, driven by Phase 3 outcomes.

Roughly one month elapsed to the end of Phase 3, with maybe 10 hours of active design and implementation. Phase 4 is the next significant build. Compared to upfront-designing everything: usually months of design, no use, a system that doesn't survive the first bad Tuesday.

---

## Definition of "done" for the whole project

There isn't one. The tracking system is something you'll use indefinitely and evolve. The thing being built is a working substrate for "what do I own and where is it" — a place where tracking is reflexive, retrieval is trustworthy, and the system actively scaffolds executive function without obligating it.

Phase 4 is roughly where it crosses from "prototype" to "the system I trust to find my stuff" — at which point the architectural questions (stay integrated with Lattice, extract a common library, separate deployments) can be answered with real data instead of speculation.

The thing to most avoid: over-building Phase 1 before living with Phase 2. The friction surfaces faster than design can predict — and friction is the only honest input to what Phase 5+ should look like.
