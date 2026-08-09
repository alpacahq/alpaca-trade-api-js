---
"@alpacahq/alpaca-trade-api": patch
---

Surface the crypto trade taker side on stream trades: `mapTrade` now maps the wire's `tks` field to `StreamTrade.takerSide` ("B"/"S", crypto only). Previously the field was dropped by the stream mapper even though the v1beta3 crypto stream delivers it and the REST `CryptoTrade` path already exposed it.
