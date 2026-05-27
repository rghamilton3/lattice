# HA Voice Verification

| Check | Expected | Result | Notes |
| --- | --- | --- | --- |
| Printing Room Atom Echo reachable | Device accepts phrase | Not run | Requires physical device |
| Normal phrase | `source=ha-voice:printing-room`, `displaced=false` | Not run | Use `track drill is on the top shelf` |
| Checkout phrase | `source=ha-voice:printing-room`, `displaced=true` | Not run | Use `check out drill working on the deck` |
| Search latency | Record appears within 5 seconds | Not run | Verify with `/api/tracks/search?q=drill` |
| Fallback phrase | Manual smoke phrase inserts | Not run | Use if intent parsing fails |

Blocker: physical HA Voice device verification was not executed in this coding environment.
