---
"@alpacahq/alpaca-trade-api": patch
---

Scope WebSocket events, disconnects, pings, and keepalive timers to their
originating connection; surface malformed/decode/mapper and trading protocol
errors without crashing; and report reconnect only after auth and
re-subscription dispatch.
