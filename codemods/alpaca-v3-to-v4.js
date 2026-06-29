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
 *                           as an Alpaca client (in addition to auto-detected
 *                           `new Alpaca(...)` variables and `alpaca`).
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

    const report = (msg) => api.report(`${file.path}: ${msg}`);

    // --- 1. Identify Alpaca client instances -------------------------------
    const instances = new Set(["alpaca"]);
    if (options.instanceName) {
        for (const n of String(options.instanceName).split(",")) {
            if (n.trim()) instances.add(n.trim());
        }
    }
    root.find(j.NewExpression, { callee: { name: "Alpaca" } }).forEach((p) => {
        const parent = p.parent.value;
        if (parent && parent.type === "VariableDeclarator" && parent.id.type === "Identifier") {
            instances.add(parent.id.name);
        }
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

    const isInstance = (node) => node && node.type === "Identifier" && instances.has(node.name);

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

    // Streaming handler renames (called on the stream object, any receiver).
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
        .filter((p) => isInstance(p.value.callee.object))
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
            return isInstance(p.value.callee.object) && prop && prop.name in tradingMap;
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
            return isInstance(p.value.callee.object) && prop && prop.name in marketDataFlag;
        })
        .forEach((p) => addTodo(p, marketDataFlag[p.value.callee.property.name]));

    // --- 6. Streaming accessors (property access -> factory call) ----------
    // Each call to the factory creates a NEW stream, so only rewrite the safe
    // `const ws = alpaca.data_stream_v2` assignment pattern. Inline uses get a
    // TODO instead (rewriting them could create multiple stream instances).
    root.find(j.MemberExpression)
        .filter((p) => {
            const prop = p.value.property;
            return isInstance(p.value.object) && prop && prop.name in streamAccessor;
        })
        .forEach((p) => {
            const spec = streamAccessor[p.value.property.name];
            const parentType = p.parent.value.type;
            const isAssignment =
                (parentType === "VariableDeclarator" && p.parent.value.init === p.value) ||
                (parentType === "AssignmentExpression" && p.parent.value.right === p.value);
            if (isAssignment) {
                j(p).replaceWith(j.callExpression(member(p.value.object, spec.to), []));
                mutated = true;
                if (spec.todo) addTodo(p, spec.todo);
            } else {
                addTodo(p, `replace ${p.value.property.name} with ${spec.to.join(".")}() — assign it once to a variable (each call creates a new stream)`);
            }
        });

    // --- 7. Streaming handler + subscribe renames --------------------------
    root.find(j.CallExpression, { callee: { type: "MemberExpression" } }).forEach((p) => {
        const prop = p.value.callee.property;
        if (!prop) return;
        if (prop.name in handlerRenames) {
            prop.name = handlerRenames[prop.name];
            mutated = true;
        } else if (
            prop.name === "subscribe" &&
            p.value.arguments.length === 1 &&
            p.value.arguments[0].type === "ArrayExpression" &&
            p.value.arguments[0].elements.some((e) => e && (e.value === "trade_updates"))
        ) {
            prop.name = "subscribeTradeUpdates";
            p.value.arguments = [];
            mutated = true;
        }
    });

    return mutated ? root.toSource({ quote: "double" }) : null;
};

