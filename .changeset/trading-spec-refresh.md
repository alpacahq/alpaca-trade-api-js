---
"@alpacahq/alpaca-trade-api": minor
---

Refresh the Trading API models from the latest Alpaca OpenAPI spec. This is an
additive, non-breaking update: new `AssetClass` values (`crypto_perp`,
`treasury`, `corporate`, `global_equity`, `us_index`, `us_equity_chain`), new
`OptionContractType`, `OptionContractStyle`, `LocateStatus`, `AssetAttribute`,
and `CryptoChain` types, plus additional fields on `Account`,
`AccountConfigurations`, `OptionContract`, `Exchange`, `Locate`, and related
models. No operations were added, removed, or renamed.
