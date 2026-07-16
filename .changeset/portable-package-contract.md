---
"@alpacahq/alpaca-trade-api": patch
---

Keep the REST runtime and declarations free of Node, WebSocket, and msgpack
requirements for strict Node/no-DOM and edge consumers; align REST-only exports;
and ship the migration guide plus a binding- and flow-safe v3-to-v4 codemod.
