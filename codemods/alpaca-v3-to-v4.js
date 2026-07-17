/**
 * jscodeshift codemod: @alpacahq/alpaca-trade-api 3.x -> 4.0
 *
 * Rewrites the *mechanical* parts of the migration and leaves a
 * `// TODO(alpaca-codemod): ...` comment wherever a human must verify a
 * semantic change (return-shape changes, field renames, etc.).
 *
 * Usage:
 *   npx jscodeshift -t codemods/alpaca-v3-to-v4.js "src/**\/*.{js,ts}"
 *   npx jscodeshift -t codemods/alpaca-v3-to-v4.js --dry --print src/bot.ts
 *   # TypeScript: add --parser=tsx (or --parser=ts) and --extensions=ts,tsx
 *
 * Options:
 *   --instanceName=alpaca   Extra identifier name(s, comma-separated) to treat
 *                           as a bound Alpaca client (in addition to immutable
 *                           clients constructed from an SDK Alpaca import).
 *
 * What it does NOT do (flags with TODO instead): historical market-data calls
 * changed from AsyncGenerator/Map to array/object, latest/snapshot field
 * shapes changed, news/corporate-actions now return a paginated response, and
 * crypto needs a `loc` param. See MIGRATION.md.
 */

"use strict";

/** snake_case / kebab -> camelCase (leaves already-camel keys untouched). */
function toCamel(key) {
    return key.replace(/[-_]([a-z0-9])/gi, (_, c) => c.toUpperCase());
}

module.exports = function transformer(file, api, options) {
    const j = api.jscodeshift;
    const root = j(file.source);
    let mutated = false;
    const packageName = "@alpacahq/alpaca-trade-api";

    const report = (msg) => api.report(`${file.path}: ${msg}`);

    // Provenance is stored by lexical Scope object + identifier name. A plain
    // spelling match is never enough: nested parameters/locals/classes resolve
    // to a different scope and therefore cannot inherit outer SDK provenance.
    const createBindings = () => new Map();
    const bindingScope = (path) =>
        path?.value?.type === "Identifier"
            ? path.scope?.lookup(path.value.name)
            : undefined;
    const setBinding = (bindings, path, value = true) => {
        const scope = bindingScope(path);
        if (!scope) return false;
        let names = bindings.get(scope);
        if (!names) {
            names = new Map();
            bindings.set(scope, names);
        }
        if (names.has(path.value.name)) return false;
        names.set(path.value.name, value);
        return true;
    };
    const setScopedBinding = (bindings, scope, name, value = true) => {
        if (!scope) return false;
        let names = bindings.get(scope);
        if (!names) {
            names = new Map();
            bindings.set(scope, names);
        }
        if (names.has(name)) return false;
        names.set(name, value);
        return true;
    };
    const getBinding = (bindings, path) => {
        const scope = bindingScope(path);
        return scope
            ? bindings.get(scope)?.get(path.value.name)
            : undefined;
    };
    const hasBinding = (bindings, path) =>
        getBinding(bindings, path) !== undefined;
    const writes = createBindings();
    const writeInfo = (path) => {
        const scope = bindingScope(path);
        if (!scope) return undefined;
        let names = writes.get(scope);
        if (!names) {
            names = new Map();
            writes.set(scope, names);
        }
        let info = names.get(path.value.name);
        if (!info) {
            info = { declarations: 0, initializers: 0, assignments: 0 };
            names.set(path.value.name, info);
        }
        return info;
    };
    root.find(j.VariableDeclarator).forEach((p) => {
        if (p.value.id.type !== "Identifier") return;
        const info = writeInfo(p.get("id"));
        if (!info) return;
        info.declarations++;
        if (p.value.init) info.initializers++;
    });
    const recordAssignmentTarget = (path) => {
        if (!path?.value) return;
        if (path.value.type === "Identifier") {
            const info = writeInfo(path);
            if (info) info.assignments++;
            return;
        }
        if (
            path.value.type === "RestElement" ||
            path.value.type === "SpreadElement"
        ) {
            recordAssignmentTarget(path.get("argument"));
            return;
        }
        if (path.value.type === "AssignmentPattern") {
            recordAssignmentTarget(path.get("left"));
            return;
        }
        if (path.value.type === "ArrayPattern") {
            path.get("elements").each(recordAssignmentTarget);
            return;
        }
        if (path.value.type === "ObjectPattern") {
            path.get("properties").each((property) => {
                if (
                    property.value.type === "RestElement" ||
                    property.value.type === "SpreadElement"
                ) {
                    recordAssignmentTarget(property.get("argument"));
                } else {
                    recordAssignmentTarget(property.get("value"));
                }
            });
        }
    };
    root.find(j.AssignmentExpression).forEach((p) => {
        recordAssignmentTarget(p.get("left"));
    });
    root.find(j.ForInStatement).forEach((p) => {
        if (p.value.left.type !== "VariableDeclaration") {
            recordAssignmentTarget(p.get("left"));
        }
    });
    root.find(j.ForOfStatement).forEach((p) => {
        if (p.value.left.type !== "VariableDeclaration") {
            recordAssignmentTarget(p.get("left"));
        }
    });
    root.find(j.UpdateExpression).forEach((p) => {
        if (p.value.argument.type === "Identifier") {
            const info = writeInfo(p.get("argument"));
            if (info) info.assignments++;
        }
    });
    const isStableDeclaration = (path) => {
        const info = getBinding(writes, path);
        return (
            info?.declarations === 1 &&
            info.initializers === 1 &&
            info.assignments === 0
        );
    };
    const hasLaterWrite = (scope, name) =>
        (writes.get(scope)?.get(name)?.assignments ?? 0) > 0;
    const reportedBindings = createBindings();
    const markAmbiguous = (bindings, path, message) => {
        const added = setBinding(bindings, path);
        if (added && setBinding(reportedBindings, path)) {
            report(`manual review — ${message}; left unchanged`);
        }
        return added;
    };
    const markScopedAmbiguous = (bindings, scope, name, message) => {
        const added = setScopedBinding(bindings, scope, name);
        if (
            added &&
            setScopedBinding(reportedBindings, scope, name)
        ) {
            report(`manual review — ${message}; left unchanged`);
        }
        return added;
    };
    const propagateAliases = (bindings, ambiguousBindings, kind) => {
        let added;
        do {
            added = false;
            root.find(j.VariableDeclarator).forEach((p) => {
                if (
                    p.value.id.type === "Identifier" &&
                    p.value.init?.type === "Identifier"
                ) {
                    const value = getBinding(bindings, p.get("init"));
                    if (value !== undefined) {
                        if (isStableDeclaration(p.get("id"))) {
                            added =
                                setBinding(bindings, p.get("id"), value) || added;
                        } else {
                            markAmbiguous(
                                ambiguousBindings,
                                p.get("id"),
                                `ambiguous ${kind} binding ${p.value.id.name}`,
                            );
                        }
                    } else if (
                        hasBinding(ambiguousBindings, p.get("init"))
                    ) {
                        markAmbiguous(
                            ambiguousBindings,
                            p.get("id"),
                            `ambiguous ${kind} binding ${p.value.id.name}`,
                        );
                    }
                }
            });
            root.find(j.AssignmentExpression, { operator: "=" }).forEach((p) => {
                if (
                    p.value.left.type === "Identifier" &&
                    p.value.right.type === "Identifier"
                ) {
                    const value = getBinding(bindings, p.get("right"));
                    if (
                        value !== undefined ||
                        hasBinding(ambiguousBindings, p.get("right"))
                    ) {
                        markAmbiguous(
                            ambiguousBindings,
                            p.get("left"),
                            `assignment-based ${kind} binding ${p.value.left.name}`,
                        );
                    }
                }
            });
        } while (added);
    };

    // --- 1. Normalize imports and identify Alpaca client instances ---------
    const constructors = createBindings();
    const ambiguousConstructors = createBindings();

    root.find(j.ImportDeclaration, { source: { value: packageName } }).forEach((p) => {
        const specifiers = p.value.specifiers || [];
        const defaultSpecifier = specifiers.find(
            (specifier) => specifier.type === "ImportDefaultSpecifier",
        );
        const namespaceSpecifier = specifiers.find(
            (specifier) => specifier.type === "ImportNamespaceSpecifier",
        );

        for (const specifier of specifiers) {
            if (specifier.type === "ImportDefaultSpecifier") {
                const local = specifier.local || j.identifier("Alpaca");
                const scope = p.scope.lookup(local.name);
                if (hasLaterWrite(scope, local.name)) {
                    markScopedAmbiguous(
                        ambiguousConstructors,
                        scope,
                        local.name,
                        `ambiguous constructor binding ${local.name}`,
                    );
                } else {
                    setScopedBinding(constructors, scope, local.name);
                }
            } else if (
                specifier.type === "ImportSpecifier" &&
                specifier.imported.name === "Alpaca"
            ) {
                const local = specifier.local || specifier.imported;
                const scope = p.scope.lookup(local.name);
                if (hasLaterWrite(scope, local.name)) {
                    markScopedAmbiguous(
                        ambiguousConstructors,
                        scope,
                        local.name,
                        `ambiguous constructor binding ${local.name}`,
                    );
                } else {
                    setScopedBinding(constructors, scope, local.name);
                }
            }
        }

        if (defaultSpecifier && namespaceSpecifier) {
            const local = defaultSpecifier.local || j.identifier("Alpaca");
            const sourceText =
                p.value.source.extra?.raw ??
                JSON.stringify(p.value.source.value);
            const suffix = file.source.slice(
                p.value.source.end,
                p.value.end,
            );
            const importKeyword =
                p.value.importKind === "type" ? "import type" : "import";
            const namedBinding =
                local.name === "Alpaca"
                    ? "Alpaca"
                    : `Alpaca as ${local.name}`;
            const firstComment = p.value.comments?.[0];
            const commentPrefix =
                typeof firstComment?.start === "number" &&
                typeof p.value.start === "number"
                    ? file.source.slice(firstComment.start, p.value.start)
                    : "";
            const parseImport = (source) =>
                j(source).find(j.ImportDeclaration).nodes()[0];
            const namedImport = parseImport(
                `${commentPrefix}${importKeyword} { ${namedBinding} } from ${sourceText}${suffix}`,
            );
            const namespaceImport = parseImport(
                `\n${importKeyword} * as ${namespaceSpecifier.local.name} from ${sourceText}${suffix}`,
            );
            p.replace(namedImport, namespaceImport);
            mutated = true;
            return;
        }

        p.value.specifiers = specifiers.map((specifier) => {
            if (specifier.type !== "ImportDefaultSpecifier") return specifier;
            const local = specifier.local || j.identifier("Alpaca");
            const replacement = j.importSpecifier(j.identifier("Alpaca"), local);
            if (local.name === "Alpaca") replacement.local = null;
            replacement.comments = specifier.comments;
            mutated = true;
            return replacement;
        });
    });

    const isPackageRequire = (path) => {
        const node = path?.value;
        return (
            node &&
            node.type === "CallExpression" &&
            node.callee.type === "Identifier" &&
            node.callee.name === "require" &&
            !path.get("callee").scope.lookup("require") &&
            node.arguments.length === 1 &&
            (node.arguments[0].type === "StringLiteral" ||
                node.arguments[0].type === "Literal") &&
            node.arguments[0].value === packageName
        );
    };

    root.find(j.VariableDeclarator).forEach((p) => {
        if (!isPackageRequire(p.get("init"))) return;
        if (p.value.id.type === "Identifier") {
            const local = p.value.id;
            const scope = p.scope.lookup(local.name);
            if (isStableDeclaration(p.get("id"))) {
                setScopedBinding(constructors, scope, local.name);
            } else {
                markAmbiguous(
                    ambiguousConstructors,
                    p.get("id"),
                    `ambiguous constructor binding ${local.name}`,
                );
            }
            const property = j.objectProperty(j.identifier("Alpaca"), local);
            property.shorthand = local.name === "Alpaca";
            p.value.id = j.objectPattern([property]);
            mutated = true;
            return;
        }
        if (p.value.id.type !== "ObjectPattern") return;
        for (const property of p.value.id.properties) {
            if (
                property.type !== "ObjectProperty" &&
                property.type !== "Property"
            ) {
                continue;
            }
            const key = property.key;
            const value = property.value;
            if (
                (key.name === "default" || key.value === "default") &&
                value.type === "Identifier"
            ) {
                const scope = p.scope.lookup(value.name);
                property.key = j.identifier("Alpaca");
                property.shorthand = value.name === "Alpaca";
                if (hasLaterWrite(scope, value.name)) {
                    markScopedAmbiguous(
                        ambiguousConstructors,
                        scope,
                        value.name,
                        `ambiguous constructor binding ${value.name}`,
                    );
                } else {
                    setScopedBinding(constructors, scope, value.name);
                }
                mutated = true;
            } else if (
                (key.name === "Alpaca" || key.value === "Alpaca") &&
                value.type === "Identifier"
            ) {
                const scope = p.scope.lookup(value.name);
                if (hasLaterWrite(scope, value.name)) {
                    markScopedAmbiguous(
                        ambiguousConstructors,
                        scope,
                        value.name,
                        `ambiguous constructor binding ${value.name}`,
                    );
                } else {
                    setScopedBinding(constructors, scope, value.name);
                }
            }
        }
    });

    propagateAliases(
        constructors,
        ambiguousConstructors,
        "constructor",
    );

    const instances = createBindings();
    const ambiguousInstances = createBindings();
    const programPath = root.find(j.Program).paths()[0];
    if (options.instanceName) {
        for (const n of String(options.instanceName).split(",")) {
            const name = n.trim();
            if (name) {
                const scope = programPath?.scope.lookup(name);
                const info = scope ? writes.get(scope)?.get(name) : undefined;
                if (!scope) continue;
                if (!info || (
                    info.declarations === 1 &&
                    info.initializers === 1 &&
                    info.assignments === 0
                )) {
                    setScopedBinding(instances, scope, name);
                } else {
                    markScopedAmbiguous(
                        ambiguousInstances,
                        scope,
                        name,
                        `ambiguous client binding ${name}`,
                    );
                }
            }
        }
    }
    root.find(j.NewExpression).forEach((p) => {
        if (p.value.callee.type !== "Identifier") return;
        const callee = p.get("callee");
        const constructorProven = hasBinding(constructors, callee);
        const constructorAmbiguous = hasBinding(
            ambiguousConstructors,
            callee,
        );
        if (!constructorProven && !constructorAmbiguous) return;
        const parent = p.parent.value;
        const target =
            parent?.type === "VariableDeclarator" &&
            parent.id.type === "Identifier"
                ? p.parent.get("id")
                : parent?.type === "AssignmentExpression" &&
                    parent.left.type === "Identifier"
                  ? p.parent.get("left")
                  : undefined;
        if (target) {
            if (
                constructorProven &&
                parent.type === "VariableDeclarator" &&
                isStableDeclaration(target)
            ) {
                setBinding(instances, target);
            } else {
                markAmbiguous(
                    ambiguousInstances,
                    target,
                    parent.type === "AssignmentExpression"
                        ? `assignment-based client binding ${target.value.name}`
                        : `ambiguous client binding ${target.value.name}`,
                );
            }
        }
        if (!constructorProven) return;
        // rename `secretKey` -> `secret` in the constructor options object
        const arg = p.value.arguments[0];
        if (arg && arg.type === "ObjectExpression") {
            for (const prop of arg.properties) {
                if (prop.key && (prop.key.name === "secretKey" || prop.key.value === "secretKey")) {
                    prop.key = j.identifier("secret");
                    mutated = true;
                }
            }
        }
    });

    propagateAliases(instances, ambiguousInstances, "client");

    const isInstance = (path) => hasBinding(instances, path);

    /** Attach a leading `// TODO(alpaca-codemod): msg` to the enclosing statement. */
    const addTodo = (path, msg) => {
        let p = path;
        while (p && !(p.value && /Statement|Declaration/.test(p.value.type))) p = p.parent;
        const stmt = p ? p.value : null;
        if (!stmt) return;
        stmt.comments = stmt.comments || [];
        const already = stmt.comments.some((c) => /alpaca-codemod/.test(c.value));
        if (!already) {
            stmt.comments.unshift(j.commentLine(` TODO(alpaca-codemod): ${msg}`, true, false));
        }
        report(`flagged for manual review — ${msg}`);
    };

    // helpers to build the new namespaced member callee, e.g. alpaca.trading.orders.market
    const member = (objNode, names) => names.reduce((acc, n) => j.memberExpression(acc, j.identifier(n)), objNode);
    const objExpr = (pairs) =>
        j.objectExpression(pairs.map(([k, v]) => j.objectProperty(j.identifier(k), v)));

    // --- 2. Trading method map (mechanical, safe to rewrite) ---------------
    // Each entry: new namespaced path + a function mapping old args -> new args.
    const passthrough = (args) => args;
    const none = () => [];
    const wrap1 = (key) => (args) => (args.length ? [objExpr([[key, args[0]]])] : []);

    const tradingMap = {
        getAccount: { to: ["trading", "account", "getAccount"], args: none },
        getAccountConfigurations: { to: ["trading", "accountConfigurations", "getAccountConfig"], args: none },
        updateAccountConfigurations: {
            to: ["trading", "accountConfigurations", "patchAccountConfig"],
            args: wrap1("accountConfigurations"),
        },
        getAccountActivities: { to: ["trading", "accountActivities", "getAccountActivities"], args: passthrough },
        getPortfolioHistory: {
            to: ["trading", "portfolioHistory", "getAccountPortfolioHistory"],
            args: passthrough,
            todo: "rename keys date_start->start, date_end->end, extended_hours->extendedHours",
        },
        getOrders: { to: ["trading", "orders", "getAllOrders"], args: passthrough },
        getOrder: { to: ["trading", "orders", "getOrderByOrderID"], args: wrap1("orderId") },
        getOrderByClientOrderId: { to: ["trading", "orders", "getOrderByClientOrderId"], args: wrap1("clientOrderId") },
        replaceOrder: {
            to: ["trading", "orders", "patchOrderByOrderId"],
            args: (a) => [objExpr([["orderId", a[0]], ["patchOrderRequest", a[1] || objExpr([])]])],
            todo: "camelCase the patch body keys (limit_price->limitPrice, etc.)",
        },
        cancelOrder: { to: ["trading", "orders", "deleteOrderByOrderID"], args: wrap1("orderId") },
        cancelAllOrders: { to: ["trading", "orders", "deleteAllOrders"], args: none },
        getPositions: { to: ["trading", "positions", "getAllOpenPositions"], args: none },
        getPosition: { to: ["trading", "positions", "getOpenPosition"], args: wrap1("symbolOrAssetId") },
        closePosition: { to: ["trading", "positions", "deleteOpenPosition"], args: wrap1("symbolOrAssetId") },
        closeAllPositions: { to: ["trading", "closeAllPositions"], args: none },
        getAssets: { to: ["trading", "assets", "getV2Assets"], args: passthrough, todo: "rename asset_class->assetClass" },
        getAsset: { to: ["trading", "assets", "getV2AssetsSymbolOrAssetId"], args: wrap1("symbolOrAssetId") },
        getCalendar: { to: ["trading", "calendar", "legacyCalendar"], args: passthrough },
        getClock: { to: ["trading", "clock", "legacyClock"], args: none },
        getWatchlists: { to: ["trading", "watchlists", "getWatchlists"], args: none },
        getWatchlist: { to: ["trading", "watchlists", "getWatchlistById"], args: wrap1("watchlistId") },
        addWatchlist: {
            to: ["trading", "watchlists", "postWatchlist"],
            args: (a) => [objExpr([["updateWatchlistRequest", objExpr([["name", a[0]], ["symbols", a[1] || j.identifier("undefined")]])]])],
        },
        addToWatchlist: {
            to: ["trading", "watchlists", "addAssetToWatchlist"],
            args: (a) => [objExpr([["watchlistId", a[0]], ["addAssetToWatchlistRequest", objExpr([["symbol", a[1]]])]])],
        },
        updateWatchlist: {
            to: ["trading", "watchlists", "updateWatchlistById"],
            args: (a) => [objExpr([["watchlistId", a[0]], ["updateWatchlistRequest", a[1] || objExpr([])]])],
        },
        deleteWatchlist: { to: ["trading", "watchlists", "deleteWatchlistById"], args: wrap1("watchlistId") },
        deleteFromWatchlist: {
            to: ["trading", "watchlists", "removeAssetFromWatchlist"],
            args: (a) => [objExpr([["watchlistId", a[0]], ["symbol", a[1]]])],
        },
    };

    // Market-data calls: flag only (return shape / fields changed). Don't rewrite.
    const marketDataFlag = {
        getBarsV2: "use marketData.getStockBarsFor(symbol, opts) -> Bar[] (was AsyncGenerator)",
        getMultiBarsV2: "use marketData.getStockBars({ symbols, ...opts }) -> { [sym]: Bar[] } (was Map)",
        getMultiBarsAsyncV2: "use marketData.iterateStockBars({ symbols, ...opts })",
        getTradesV2: "use marketData.getStockTradesFor(symbol, opts) (was AsyncGenerator)",
        getMultiTradesV2: "use marketData.getStockTrades({ symbols, ...opts }) (was Map)",
        getMultiTradesAsyncV2: "use marketData.iterateStockTrades({ symbols, ...opts })",
        getQuotesV2: "use marketData.getStockQuotesFor(symbol, opts) (was AsyncGenerator)",
        getMultiQuotesV2: "use marketData.getStockQuotes({ symbols, ...opts }) (was Map)",
        getMultiQuotesAsyncV2: "use marketData.iterateStockQuotes({ symbols, ...opts })",
        getLatestTrade: "use marketData.stocks.stockLatestTradeSingle({ symbol }) or marketData.getLatestPrice(symbol); fields changed (trade.Price -> trade.p)",
        getLatestTrades: "use marketData.stocks.stockLatestTrades({ symbols }) -> { trades } (was Map)",
        getLatestQuote: "use marketData.stocks.stockLatestQuoteSingle({ symbol })",
        getLatestQuotes: "use marketData.stocks.stockLatestQuotes({ symbols }) (was Map)",
        getLatestBar: "use marketData.stocks.stockLatestBarSingle({ symbol })",
        getLatestBars: "use marketData.stocks.stockLatestBars({ symbols }) (was Map)",
        getSnapshot: "use marketData.stocks.stockSnapshotSingle({ symbol })",
        getSnapshots: "use marketData.stocks.stockSnapshots({ symbols })",
        getCryptoTrades: "use marketData.getCryptoTrades({ symbols, ...opts }); generated crypto.* needs a loc param",
        getCryptoQuotes: "use marketData.getCryptoQuotes({ symbols, ...opts }); generated crypto.* needs a loc param",
        getCryptoBars: "use marketData.getCryptoBars({ symbols, ...opts }); generated crypto.* needs a loc param",
        getLatestCryptoTrades: "use marketData.crypto.cryptoLatestTrades({ loc: 'us', symbols })",
        getLatestCryptoQuotes: "use marketData.crypto.cryptoLatestQuotes({ loc: 'us', symbols })",
        getLatestCryptoBars: "use marketData.crypto.cryptoLatestBars({ loc: 'us', symbols })",
        getCryptoSnapshots: "use marketData.crypto.cryptoSnapshots({ loc: 'us', symbols })",
        getCryptoOrderbooks: "use marketData.crypto.cryptoLatestOrderbooks({ loc: 'us', symbols })",
        getOptionChain: "use marketData.options.optionChain({ underlyingSymbol, ...opts })",
        getOptionBars: "use marketData.options.optionBars({ symbols, ...opts })",
        getOptionTrades: "use marketData.options.optionTrades({ symbols, ...opts })",
        getOptionLatestTrades: "use marketData.options.optionLatestTrades({ symbols })",
        getOptionLatestQuotes: "use marketData.options.optionLatestQuotes({ symbols })",
        getOptionSnapshots: "use marketData.options.optionSnapshots({ symbols })",
        getNews: "use marketData.news.news(opts) -> { news, nextPageToken } (was an array); or marketData.collectNews(opts)",
        getCorporateActions: "use marketData.corporateActions.corporateActions({ symbols, ...opts })",
        newTimeframe: "use timeFrame(amount, unit) and TimeFrameUnit.* (MIN->Minute, etc.)",
    };

    // Streaming accessor (property) -> factory call.
    const streamAccessor = {
        data_stream_v2: { to: ["marketData", "stockStream"], todo: "pass a feed, e.g. stockStream({ feed: 'iex' })" },
        crypto_stream_v1beta3: { to: ["marketData", "cryptoStream"] },
        news_stream: { to: ["marketData", "newsStream"] },
        option_stream: { to: ["marketData", "optionStream"], todo: "pass a feed, e.g. optionStream({ feed: 'indicative' })" },
        trade_ws: { to: ["trading", "stream"] },
    };

    // Streaming handler renames. Applied only to proven stream variables.
    const handlerRenames = {
        onStockTrade: "onTrade",
        onStockQuote: "onQuote",
        onStockBar: "onBar",
        onStockUpdatedBar: "onUpdatedBar",
        onStockDailyBar: "onDailyBar",
        onStatuses: "onStatus",
        onLulds: "onLuld",
        onOrderUpdate: "onTradeUpdate",
    };

    // --- 3. createOrder -> ergonomic builder -------------------------------
    const camelObject = (obj) => {
        if (!obj || obj.type !== "ObjectExpression") return obj;
        for (const prop of obj.properties) {
            if (prop.key && prop.key.type === "Identifier") prop.key = j.identifier(toCamel(prop.key.name));
            else if (prop.key && (prop.key.type === "Literal" || prop.key.type === "StringLiteral") && typeof prop.key.value === "string") {
                prop.key = j.identifier(toCamel(prop.key.value));
            }
            if (prop.value && prop.value.type === "ObjectExpression") camelObject(prop.value);
        }
        return obj;
    };
    const literalOf = (obj, name) => {
        if (!obj || obj.type !== "ObjectExpression") return undefined;
        const p = obj.properties.find((pr) => pr.key && (pr.key.name === name || pr.key.value === name));
        return p && p.value && (p.value.type === "Literal" || p.value.type === "StringLiteral") ? p.value.value : undefined;
    };
    const typeToMethod = { market: "market", limit: "limit", stop: "stop", stop_limit: "stopLimit", trailing_stop: "trailingStop" };

    root.find(j.CallExpression, { callee: { type: "MemberExpression", property: { name: "createOrder" } } })
        .filter((p) => isInstance(p.get("callee").get("object")))
        .forEach((p) => {
            const obj = p.value.arguments[0];
            const orderClass = literalOf(obj, "order_class");
            const type = literalOf(obj, "type");
            let method = "submit";
            if (orderClass && ["bracket", "oco", "oto"].includes(orderClass)) method = orderClass;
            else if (type && typeToMethod[type]) method = typeToMethod[type];

            const body = camelObject(obj);
            if (method !== "submit" && body && body.type === "ObjectExpression") {
                // the ergonomic method implies `type`/`orderClass`; drop them
                body.properties = body.properties.filter(
                    (pr) => pr.key && pr.key.name !== "type" && pr.key.name !== "orderClass",
                );
            }
            p.value.callee = member(p.value.callee.object, ["trading", "orders", method]);
            p.value.arguments = [body];
            mutated = true;
            if (method === "submit") addTodo(p, "could not infer order kind from a literal `type`; using orders.submit()");
        });

    // --- 4. Trading method renames -----------------------------------------
    root.find(j.CallExpression, { callee: { type: "MemberExpression" } })
        .filter((p) => {
            const prop = p.value.callee.property;
            return (
                isInstance(p.get("callee").get("object")) &&
                prop &&
                prop.name in tradingMap
            );
        })
        .forEach((p) => {
            const spec = tradingMap[p.value.callee.property.name];
            p.value.callee = member(p.value.callee.object, spec.to);
            p.value.arguments = spec.args(p.value.arguments);
            mutated = true;
            if (spec.todo) addTodo(p, spec.todo);
        });

    // --- 5. Market-data calls: flag only -----------------------------------
    root.find(j.CallExpression, { callee: { type: "MemberExpression" } })
        .filter((p) => {
            const prop = p.value.callee.property;
            return (
                isInstance(p.get("callee").get("object")) &&
                prop &&
                prop.name in marketDataFlag
            );
        })
        .forEach((p) => addTodo(p, marketDataFlag[p.value.callee.property.name]));

    // --- 6. Streaming accessors (property access -> factory call) ----------
    // Each call to the factory creates a NEW stream, so only rewrite the safe
    // `const ws = alpaca.data_stream_v2` assignment pattern. Inline uses get a
    // TODO instead (rewriting them could create multiple stream instances).
    const ambiguousStreamVariables = createBindings();
    root.find(j.MemberExpression)
        .filter((p) => {
            const prop = p.value.property;
            const object = p.get("object");
            return (
                prop &&
                prop.name in streamAccessor &&
                (isInstance(object) ||
                    (object.value.type === "Identifier" &&
                        object.value.name === "alpaca"))
            );
        })
        .forEach((p) => {
            const spec = streamAccessor[p.value.property.name];
            const object = p.get("object");
            const parentType = p.parent.value.type;
            const isAssignment =
                (parentType === "VariableDeclarator" && p.parent.value.init === p.value) ||
                (parentType === "AssignmentExpression" && p.parent.value.right === p.value);
            if (!isInstance(object)) {
                const targetPath =
                    parentType === "VariableDeclarator"
                        ? p.parent.get("id")
                        : parentType === "AssignmentExpression"
                          ? p.parent.get("left")
                          : undefined;
                if (targetPath?.value.type === "Identifier") {
                    setBinding(ambiguousStreamVariables, targetPath);
                }
                report(
                    `manual review — ambiguous stream accessor on ${object.value.name}; left unchanged`,
                );
                return;
            }
            if (isAssignment) {
                const targetPath =
                    parentType === "VariableDeclarator"
                        ? p.parent.get("id")
                        : p.parent.get("left");
                const stableDeclaration =
                    parentType === "VariableDeclarator" &&
                    targetPath.value.type === "Identifier" &&
                    isStableDeclaration(targetPath);
                if (!stableDeclaration) {
                    if (targetPath.value.type === "Identifier") {
                        markAmbiguous(
                            ambiguousStreamVariables,
                            targetPath,
                            parentType === "AssignmentExpression"
                                ? `assignment-based stream binding ${targetPath.value.name}`
                                : `ambiguous stream binding ${targetPath.value.name}`,
                        );
                    }
                    return;
                }
                j(p).replaceWith(j.callExpression(member(p.value.object, spec.to), []));
                mutated = true;
                if (spec.todo) addTodo(p, spec.todo);
            } else {
                addTodo(p, `replace ${p.value.property.name} with ${spec.to.join(".")}() — assign it once to a variable (each call creates a new stream)`);
            }
        });

    // --- 7. Streaming handler + subscribe renames --------------------------
    const streamKinds = createBindings();
    const memberPath = (callPath) => {
        const names = [];
        let current = callPath.get("callee");
        while (
            current?.value?.type === "MemberExpression" &&
            !current.value.computed &&
            current.value.property.type === "Identifier"
        ) {
            names.unshift(current.value.property.name);
            current = current.get("object");
        }
        return current?.value?.type === "Identifier"
            ? { root: current, names }
            : undefined;
    };
    const streamFactoryKind = (callPath) => {
        if (callPath?.value?.type !== "CallExpression") return undefined;
        const path = memberPath(callPath);
        if (!path || !isInstance(path.root)) return undefined;
        const dotted = path.names.join(".");
        if (dotted === "trading.stream") return "trading";
        if (
            dotted === "marketData.stockStream" ||
            dotted === "marketData.cryptoStream" ||
            dotted === "marketData.newsStream" ||
            dotted === "marketData.optionStream"
        ) {
            return "marketData";
        }
        return undefined;
    };
    root.find(j.VariableDeclarator).forEach((p) => {
        if (p.value.id.type === "Identifier") {
            const kind = streamFactoryKind(p.get("init"));
            if (kind) {
                if (isStableDeclaration(p.get("id"))) {
                    setBinding(streamKinds, p.get("id"), kind);
                } else {
                    markAmbiguous(
                        ambiguousStreamVariables,
                        p.get("id"),
                        `ambiguous stream binding ${p.value.id.name}`,
                    );
                }
            }
        }
    });
    root.find(j.AssignmentExpression, { operator: "=" }).forEach((p) => {
        if (p.value.left.type === "Identifier") {
            const kind = streamFactoryKind(p.get("right"));
            if (kind) {
                markAmbiguous(
                    ambiguousStreamVariables,
                    p.get("left"),
                    `assignment-based stream binding ${p.value.left.name}`,
                );
            }
        }
    });
    propagateAliases(
        streamKinds,
        ambiguousStreamVariables,
        "stream",
    );

    root.find(j.CallExpression, { callee: { type: "MemberExpression" } }).forEach((p) => {
        if (p.value.callee.object.type !== "Identifier") return;
        const object = p.get("callee").get("object");
        const receiver = p.value.callee.object.name;
        const prop = p.value.callee.property;
        if (!prop) return;
        if (
            hasBinding(ambiguousStreamVariables, object) ||
            (receiver === "alpaca" && !isInstance(object))
        ) {
            if (
                prop.name in handlerRenames ||
                prop.name === "subscribe"
            ) {
                report(
                    `manual review — unproven stream receiver ${receiver}; left unchanged`,
                );
            }
            return;
        }
        const kind = getBinding(streamKinds, object);
        if (!kind) return;
        if (prop.name in handlerRenames) {
            prop.name = handlerRenames[prop.name];
            mutated = true;
        } else if (prop.name === "subscribe") {
            const channels =
                p.value.arguments.length === 1 &&
                p.value.arguments[0].type === "ArrayExpression"
                    ? p.value.arguments[0].elements
                    : undefined;
            const exactlyTradeUpdates =
                channels?.length === 1 &&
                channels[0] &&
                channels[0].value === "trade_updates";
            if (kind === "trading" && exactlyTradeUpdates) {
                prop.name = "subscribeTradeUpdates";
                p.value.arguments = [];
                mutated = true;
            } else if (kind === "marketData") {
                report(
                    `manual review — subscribe call on market-data stream ${receiver}; left unchanged`,
                );
            } else {
                const reason =
                    channels && channels.length > 1
                        ? "multiple subscription channels"
                        : "arguments are not exactly [\"trade_updates\"]";
                report(
                    `manual review — unsupported trading stream subscribe on ${receiver} (${reason}); left unchanged`,
                );
            }
        }
    });

    return mutated ? root.toSource({ quote: "double" }) : null;
};

