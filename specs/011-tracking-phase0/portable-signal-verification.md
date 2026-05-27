# Portable And Signal Verification

| Check | Expected | Result | Notes |
| --- | --- | --- | --- |
| Tasker normal phrase | `source=tasker-voice`, `displaced=false` | Not run | Requires phone Tasker profile |
| Tasker checkout phrase | `source=tasker-voice`, `displaced=true` | Not run | Requires phone Tasker profile |
| Assistant interception | Shared devices do not consume phrase | Not run | Treat interception as failure |
| Signal `/track` | `source=signal-text`, `displaced=false` | Covered by automated tests | Manual relay run still recommended |
| Signal `/checkout` | `source=signal-text`, `displaced=true` | Covered by automated tests | Manual relay run still recommended |
| Signal photo caption | `source=signal-photo`, `photo_ref` preserved | Covered by automated tests | Manual attachment availability still recommended |
| Search latency | Records appear within 10 seconds | Not run | Verify with `/api/tracks/search` |

Blocker: physical phone/Signal relay end-to-end verification was not executed in this coding environment.
