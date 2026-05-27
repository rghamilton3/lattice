# Research: Web Archival And Inbox Evolution

## Decision: Use two capture paths into one archive model

**Decision**: Accept desktop rendered HTML from stock SingleFile through a bearer-token agent endpoint, and accept URL-only archive requests through a separate bearer-token endpoint that enqueues local monolith work. Both write `archives` rows and local archive bytes.

**Rationale**: SingleFile covers JS-rendered and logged-in pages because it captures the browser-rendered DOM. Monolith covers mobile/share/hotkey/scripted contexts where only a URL is available. One archive model keeps search, supersession, inbox review, and retention behavior consistent.

**Alternatives considered**: Server-side URL-only capture for everything was rejected because JS-rendered docs frequently degrade. A custom browser extension was deferred because stock SingleFile can POST saved pages. Headless browser capture was deferred because Chromium operations and memory pressure are not justified for v1.

## Decision: Store archive bytes as content-addressed local files

**Decision**: Store HTML artifacts under local spine-controlled storage using a hash-derived filename, with SQLite rows recording metadata, technical quality, and supersession.

**Rationale**: Content-addressed storage avoids duplicate bytes, gives a stable integrity key, and satisfies local-first durability. SQLite remains the metadata source of truth while large HTML bytes stay out of the database.

**Alternatives considered**: Storing only URLs fails the durability goal. Storing HTML blobs in SQLite makes backups possible but inflates the primary DB and complicates serving raw files. External object storage violates self-hosting/local-first constraints.

## Decision: Index extracted archive text through QMD markdown source files

**Decision**: Generate markdown index files for current good archive text and include an `archives` collection in QMD search setup. Default search maps only `quality = 'good'` and non-superseded rows.

**Rationale**: Existing capture/local-file/working-doc search already uses QMD over generated markdown files. Reusing that path keeps indexing consistent and avoids direct manipulation of QMD internals.

**Alternatives considered**: Adding a second search index would duplicate retrieval logic. Hand-migrating QMD tables is prohibited by the constitution.

## Decision: Use an in-process URL archive queue for v1

**Decision**: Implement URL-only jobs with a bounded in-process queue and a single worker that invokes the local `monolith` CLI with a 30-second timeout.

**Rationale**: Single-user capture volume is low, and the feature does not require durable background queue semantics yet. Avoiding BullMQ/Redis preserves deployment simplicity and self-hosting posture.

**Alternatives considered**: BullMQ was rejected for v1 because it would add Redis and a new operational dependency. Synchronous URL archiving inside the HTTP request was rejected because slow URLs would tie up request handling and make timeouts harder to communicate.

## Decision: Classify technical quality conservatively

**Decision**: Classify monolith output as `good`, `degraded`, or `failed` using technical heuristics: missing artifact, suspiciously short extracted text, browser-rendering-required copy, or mostly empty app-shell HTML shapes.

**Rationale**: The classifier should identify incomplete captures, not judge the value of content. Conservative degradation ensures important JS-heavy pages are recoverable through SingleFile.

**Alternatives considered**: Editorial quality scoring was rejected because the spec keeps value judgment with the user. Marking every successful monolith run as good would hide common SPA failures.

## Decision: Supersede rather than delete degraded history

**Decision**: When a good rendered capture arrives for a URL with an existing degraded or failed current archive, mark older rows as superseded and keep their files unless the user explicitly deletes them.

**Rationale**: Storage is cheap, degraded output may contain salvageable content, and retaining history prevents accidental loss during replacement flows.

**Alternatives considered**: Replacing rows in-place would lose traceability. Deleting old artifacts automatically would violate the user's explicit requirement.

## Decision: Extend the existing inbox with item types

**Decision**: Add inbox item type discrimination for captures, recapture items, and recently captured archive review items while keeping one inbox surface and a reusable action row component.

**Rationale**: The inbox is already where user judgment happens. Type-specific action rows allow different verbs and shortcuts without inventing a parallel archive queue.

**Alternatives considered**: A separate archive review page was rejected because it creates queue fragmentation. A fully generic workflow engine was rejected as premature abstraction.

## Decision: Keep Signal as attention only

**Decision**: Emit Signal attention messages only from spine-side decisions when notification posture allows them. Do not store completion state in Signal messages or require Signal to resolve inbox state.

**Rationale**: Surface/spine remains the source of truth. Signal helps the user notice actionable recapture items but must not become a second task system.

**Alternatives considered**: Sending every archive event was rejected as noisy. Encoding action state in Signal replies was rejected because it splits state and increases failure modes.

## Decision: Defer SingleFile wrapper prompt

**Decision**: Start with stock SingleFile configured to POST the saved page, URL, title, and token. Add a minimal why-saved wrapper only if the absence of a prompt is felt after real use.

**Rationale**: Stock extension support is the smallest useful integration. Optional `why_saved` can still be accepted by the endpoint for future clients.

**Alternatives considered**: Forking SingleFile now was rejected because it adds maintenance burden before proving the missing prompt matters.
