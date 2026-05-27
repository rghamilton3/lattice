# Accessibility And Language Notes

- Persistent Surface UI changed: no. Phase 0 implementation is API, database, Signal relay, and device setup documentation only.
- Keyboard/focus/labels: N/A because no browser UI components were added or changed.
- Non-color-only displaced state: API returns explicit boolean `displaced`; documentation examples show textual true/false values.
- Bilingual delivery: N/A for Phase 0 because no end-user UI copy or translation resources were introduced.
- English-only copy review: Signal replies are short operational confirmations already in existing relay style; new reply is `Tracked: <text>`.
- CLI/terminal accessibility: curl examples use explicit headers and JSON bodies; errors are HTTP status based with concise JSON `error` responses for validation failures.
