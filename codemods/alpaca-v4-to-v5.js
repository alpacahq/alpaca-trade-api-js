/**
 * jscodeshift codemod: @alpacahq/alpaca-trade-api 4.x -> 5.0
 *
 * Applies generated-contract renames that are mechanical and flags semantic
 * changes for manual review. It deliberately does not rewrite SSE control flow,
 * REORG/REO values, removed APIs, or string-valued activity flags.
 *
 * Usage:
 *   npx jscodeshift -t codemods/alpaca-v4-to-v5.js --parser=tsx \
 *     --extensions=ts,tsx src
 */

"use strict";

const PACKAGE_NAMES = new Set([
    "@alpacahq/alpaca-trade-api",
    "@alpacahq/alpaca-trade-api/rest",
]);

const MODEL_SUFFIXES = [
    "",
    "FromJSON",
    "FromJSONTyped",
    "ToJSON",
    "ToJSONTyped",
];

function modelRenames(oldName, newName) {
    const entries = MODEL_SUFFIXES.map((suffix) => [
        `${oldName}${suffix}`,
        `${newName}${suffix}`,
    ]);
    entries.push([
        `instanceOf${oldName}`,
        `instanceOf${newName}`,
    ]);
    return entries;
}

const GENERATED_RENAMES = new Map([
    ...modelRenames(
        "PostOrderRequestTakeProfit",
        "CreateOrderRequestTakeProfit",
    ),
    ...modelRenames(
        "PostOrderRequestStopLoss",
        "CreateOrderRequestStopLoss",
    ),
    ...modelRenames("PostOrderRequest", "CreateOrderRequest").filter(
        ([oldName]) => oldName !== "PostOrderRequest",
    ),
    ["PostOrderOperationRequest", "PostOrderRequest"],
    ...modelRenames(
        "GetOptionsContracts200Response",
        "OptionContractsResponse",
    ),
    ...modelRenames(
        "GetV2CorporateActionsAnnouncements200ResponseInner",
        "CorporateAnnouncement",
    ),
    ...modelRenames(
        "GetV2CorporateActionsAnnouncementsId200Response",
        "CorporateAnnouncement",
    ),
    ["GetTokenizationRequestsIssuerEnum", "TokenizationIssuer"],
]);

const REMOVED_MARKET_DATA_MEMBERS = new Map([
    [
        "CryptoPerpetualFuturesApi",
        "the generated crypto perpetual-futures API was removed upstream",
    ],
    [
        "cryptoPerpLatestBars",
        "the crypto perpetual-futures bars operation was removed upstream",
    ],
    [
        "cryptoPerpLatestBarsRaw",
        "the crypto perpetual-futures bars operation was removed upstream",
    ],
    [
        "cryptoPerpLatestFuturesPricing",
        "the crypto perpetual-futures pricing operation was removed upstream",
    ],
    [
        "cryptoPerpLatestFuturesPricingRaw",
        "the crypto perpetual-futures pricing operation was removed upstream",
    ],
    [
        "cryptoPerpLatestOrderbooks",
        "the crypto perpetual-futures orderbooks operation was removed upstream",
    ],
    [
        "cryptoPerpLatestOrderbooksRaw",
        "the crypto perpetual-futures orderbooks operation was removed upstream",
    ],
    [
        "cryptoPerpLatestQuotes",
        "the crypto perpetual-futures quotes operation was removed upstream",
    ],
    [
        "cryptoPerpLatestQuotesRaw",
        "the crypto perpetual-futures quotes operation was removed upstream",
    ],
    [
        "cryptoPerpLatestTrades",
        "the crypto perpetual-futures trades operation was removed upstream",
    ],
    [
        "cryptoPerpLatestTradesRaw",
        "the crypto perpetual-futures trades operation was removed upstream",
    ],
    [
        "cryptoPerpetualFutures",
        "the crypto perpetual-futures API was removed upstream; remove or replace this call",
    ],
    ["IndexApi", "the generated index-values API was removed upstream"],
    ["indexLatestValues", "the latest index-values operation was removed upstream"],
    [
        "indexLatestValuesRaw",
        "the latest index-values operation was removed upstream",
    ],
    ["indexValues", "the historical index-values operation was removed upstream"],
    [
        "indexValuesRaw",
        "the historical index-values operation was removed upstream",
    ],
    [
        "indices",
        "the index-values API was removed upstream; remove or replace this call",
    ],
    ["getIndexValues", "the index-values operation was removed upstream"],
    ["iterateIndexValues", "the ergonomic index iterator was removed"],
    [
        "collectIndexValuesBySymbol",
        "the ergonomic index collector was removed",
    ],
    ["toIndexValue", "the index-value shape helper was removed"],
    ["toIndexValuesBySymbol", "the index-value shape helper was removed"],
]);

const CORPORATE_ACTION_TYPES = new Map(
    ["Spinoff", "Merger", "Split", "Reorg", "Dividend"].map((value) => [
        value.toLowerCase(),
        value,
    ]),
);

const TRADING_DIVIDEND_MODELS = new Set([
    "CDIVActivityV2",
    "CommonCDIVActivityV2",
    "DIVSPDActivityV2",
    "OpcaCDIVActivityV2",
]);

module.exports = function transformer(file, api, options = {}) {
    const j = api.jscodeshift;
    const root = j(file.source);
    let mutated = false;
    const reports = new Set();

    const report = (key, message) => {
        if (reports.has(key)) return;
        reports.add(key);
        api.report(`${file.path}: manual review — ${message}`);
    };

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
            info = {
                declarations: 0,
                initializers: 0,
                assignments: 0,
            };
            names.set(path.value.name, info);
        }
        return info;
    };
    root.find(j.VariableDeclarator).forEach((path) => {
        if (path.value.id.type !== "Identifier") return;
        const info = writeInfo(path.get("id"));
        if (!info) return;
        info.declarations++;
        if (path.value.init) info.initializers++;
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
    root.find(j.AssignmentExpression).forEach((path) => {
        recordAssignmentTarget(path.get("left"));
    });
    root.find(j.ForInStatement).forEach((path) => {
        if (path.value.left.type !== "VariableDeclaration") {
            recordAssignmentTarget(path.get("left"));
        }
    });
    root.find(j.ForOfStatement).forEach((path) => {
        if (path.value.left.type !== "VariableDeclaration") {
            recordAssignmentTarget(path.get("left"));
        }
    });
    root.find(j.UpdateExpression).forEach((path) => {
        if (path.value.argument.type !== "Identifier") return;
        const info = writeInfo(path.get("argument"));
        if (info) info.assignments++;
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
    const propagateStableAliases = (bindings) => {
        let added;
        do {
            added = false;
            root.find(j.VariableDeclarator).forEach((path) => {
                if (
                    path.value.id.type !== "Identifier" ||
                    path.value.init?.type !== "Identifier" ||
                    !hasBinding(bindings, path.get("init")) ||
                    !isStableDeclaration(path.get("id"))
                ) {
                    return;
                }
                added =
                    setBinding(
                        bindings,
                        path.get("id"),
                        getBinding(bindings, path.get("init")),
                    ) || added;
            });
        } while (added);
    };

    const statementFor = (path) => {
        let current = path;
        while (
            current &&
            !(
                current.value &&
                /Statement|Declaration/.test(current.value.type)
            )
        ) {
            current = current.parent;
        }
        return current?.value;
    };

    const addTodo = (path, key, message) => {
        const statement = statementFor(path);
        if (statement) {
            statement.comments = statement.comments || [];
            const marker = `TODO(alpaca-codemod): ${message}`;
            const already = statement.comments.some((comment) =>
                comment.value.includes(marker),
            );
            if (!already) {
                statement.comments.unshift(
                    j.commentLine(` ${marker}`, true, false),
                );
                mutated = true;
            }
        }
        report(key, message);
    };

    const propertyName = (node) => {
        if (!node) return undefined;
        if (node.type === "Identifier") return node.name;
        if (
            node.type === "Literal" ||
            node.type === "StringLiteral"
        ) {
            return typeof node.value === "string"
                ? node.value
                : undefined;
        }
        return undefined;
    };

    const setPropertyName = (member, name) => {
        if (
            member.computed ||
            member.property.type === "Literal" ||
            member.property.type === "StringLiteral"
        ) {
            member.property =
                member.property.type === "StringLiteral"
                    ? j.stringLiteral(name)
                    : j.literal(name);
            member.computed = true;
        } else {
            member.property = j.identifier(name);
        }
    };

    const tradingNamespaces = createBindings();
    const marketDataNamespaces = createBindings();
    const marketDataShapeNamespaces = createBindings();
    const sdkNamespaces = createBindings();
    const alpacaConstructors = createBindings();

    root.find(j.ImportDeclaration).forEach((path) => {
        if (!PACKAGE_NAMES.has(String(path.value.source.value))) return;
        path.get("specifiers").each((specifierPath) => {
            const specifier = specifierPath.value;
            if (
                specifier.type === "ImportSpecifier" &&
                propertyName(specifier.imported) === "trading" &&
                specifier.local
            ) {
                const localPath = specifierPath.get("local");
                const scope = bindingScope(localPath);
                if (!hasLaterWrite(scope, localPath.value.name)) {
                    setBinding(tradingNamespaces, localPath);
                }
            } else if (
                specifier.type === "ImportSpecifier" &&
                propertyName(specifier.imported) === "marketData" &&
                specifier.local
            ) {
                const localPath = specifierPath.get("local");
                const scope = bindingScope(localPath);
                if (!hasLaterWrite(scope, localPath.value.name)) {
                    setBinding(marketDataNamespaces, localPath);
                }
            } else if (
                specifier.type === "ImportSpecifier" &&
                propertyName(specifier.imported) ===
                    "marketDataShapes" &&
                specifier.local
            ) {
                const localPath = specifierPath.get("local");
                const scope = bindingScope(localPath);
                if (!hasLaterWrite(scope, localPath.value.name)) {
                    setBinding(marketDataShapeNamespaces, localPath);
                }
            } else if (
                specifier.type === "ImportSpecifier" &&
                propertyName(specifier.imported) === "Alpaca" &&
                specifier.local
            ) {
                const localPath = specifierPath.get("local");
                const scope = bindingScope(localPath);
                if (!hasLaterWrite(scope, localPath.value.name)) {
                    setBinding(alpacaConstructors, localPath);
                }
            } else if (
                specifier.type === "ImportNamespaceSpecifier" &&
                specifier.local
            ) {
                const localPath = specifierPath.get("local");
                const scope = bindingScope(localPath);
                if (!hasLaterWrite(scope, localPath.value.name)) {
                    setBinding(sdkNamespaces, localPath);
                }
            }
        });
    });

    const isPackageRequire = (path) => {
        const node = path?.value;
        return (
            node?.type === "CallExpression" &&
            node.callee.type === "Identifier" &&
            node.callee.name === "require" &&
            !path.get("callee").scope.lookup("require") &&
            node.arguments.length === 1 &&
            (node.arguments[0].type === "Literal" ||
                node.arguments[0].type === "StringLiteral") &&
            PACKAGE_NAMES.has(String(node.arguments[0].value))
        );
    };

    root.find(j.VariableDeclarator).forEach((path) => {
        if (!isPackageRequire(path.get("init"))) return;
        if (path.value.id.type === "Identifier") {
            if (isStableDeclaration(path.get("id"))) {
                setBinding(sdkNamespaces, path.get("id"));
            }
            return;
        }
        if (path.value.id.type !== "ObjectPattern") return;
        path.get("id", "properties").each((propertyPath) => {
            const property = propertyPath.value;
            if (
                (property.type === "Property" ||
                    property.type === "ObjectProperty") &&
                propertyName(property.key) === "trading" &&
                property.value.type === "Identifier"
            ) {
                const valuePath = propertyPath.get("value");
                const scope = bindingScope(valuePath);
                if (!hasLaterWrite(scope, valuePath.value.name)) {
                    setBinding(tradingNamespaces, valuePath);
                }
            } else if (
                (property.type === "Property" ||
                    property.type === "ObjectProperty") &&
                propertyName(property.key) === "marketData" &&
                property.value.type === "Identifier"
            ) {
                const valuePath = propertyPath.get("value");
                const scope = bindingScope(valuePath);
                if (!hasLaterWrite(scope, valuePath.value.name)) {
                    setBinding(marketDataNamespaces, valuePath);
                }
            } else if (
                (property.type === "Property" ||
                    property.type === "ObjectProperty") &&
                propertyName(property.key) === "marketDataShapes" &&
                property.value.type === "Identifier"
            ) {
                const valuePath = propertyPath.get("value");
                const scope = bindingScope(valuePath);
                if (!hasLaterWrite(scope, valuePath.value.name)) {
                    setBinding(marketDataShapeNamespaces, valuePath);
                }
            } else if (
                (property.type === "Property" ||
                    property.type === "ObjectProperty") &&
                propertyName(property.key) === "Alpaca" &&
                property.value.type === "Identifier"
            ) {
                const valuePath = propertyPath.get("value");
                const scope = bindingScope(valuePath);
                if (!hasLaterWrite(scope, valuePath.value.name)) {
                    setBinding(alpacaConstructors, valuePath);
                }
            }
        });
    });

    const isSdkNamespaceObject = (path) =>
        (path.value?.type === "Identifier" &&
            hasBinding(sdkNamespaces, path)) ||
        isPackageRequire(path);
    const isTradingNamespaceObject = (path) => {
        if (
            path.value?.type === "Identifier" &&
            hasBinding(tradingNamespaces, path)
        ) {
            return true;
        }
        if (
            path.value?.type === "MemberExpression" &&
            propertyName(path.value.property) === "trading"
        ) {
            const sdkPath = path.get("object");
            return isSdkNamespaceObject(sdkPath);
        }
        return false;
    };
    const isTradingNamespaceMember = (path) =>
        path.value?.type === "MemberExpression" &&
        isTradingNamespaceObject(path.get("object"));
    const isMarketDataNamespaceObject = (path) => {
        if (
            path.value?.type === "Identifier" &&
            hasBinding(marketDataNamespaces, path)
        ) {
            return true;
        }
        if (
            path.value?.type === "MemberExpression" &&
            propertyName(path.value.property) === "marketData"
        ) {
            const sdkPath = path.get("object");
            return isSdkNamespaceObject(sdkPath);
        }
        return false;
    };
    const isMarketDataNamespaceMember = (path) =>
        path.value?.type === "MemberExpression" &&
        isMarketDataNamespaceObject(path.get("object"));
    const activityTypeObjects = createBindings();
    root.find(j.VariableDeclarator).forEach((path) => {
        if (
            path.value.id.type === "Identifier" &&
            path.value.init?.type === "MemberExpression" &&
            propertyName(path.value.init.property) === "ActivityType" &&
            isTradingNamespaceMember(path.get("init")) &&
            isStableDeclaration(path.get("id"))
        ) {
            setBinding(activityTypeObjects, path.get("id"));
            return;
        }
        if (
            path.value.id.type !== "ObjectPattern" ||
            !path.value.init ||
            !isTradingNamespaceObject(path.get("init"))
        ) {
            return;
        }
        path.get("id", "properties").each((propertyPath) => {
            const property = propertyPath.value;
            if (
                (property.type !== "Property" &&
                    property.type !== "ObjectProperty") ||
                propertyName(property.key) !== "ActivityType" ||
                property.value.type !== "Identifier"
            ) {
                return;
            }
            const valuePath = propertyPath.get("value");
            const scope = bindingScope(valuePath);
            if (!hasLaterWrite(scope, valuePath.value.name)) {
                setBinding(activityTypeObjects, valuePath);
            }
        });
    });
    propagateStableAliases(activityTypeObjects);
    const isActivityTypeObject = (path) =>
        (path.value?.type === "Identifier" &&
            hasBinding(activityTypeObjects, path)) ||
        (path.value?.type === "MemberExpression" &&
            propertyName(path.value.property) === "ActivityType" &&
            isTradingNamespaceMember(path));
    const isMarketDataShapesNamespace = (path) => {
        if (
            path.value?.type === "Identifier" &&
            hasBinding(marketDataShapeNamespaces, path)
        ) {
            return true;
        }
        if (
            path.value?.type === "MemberExpression" &&
            propertyName(path.value.property) === "marketDataShapes"
        ) {
            const sdkPath = path.get("object");
            return (
                sdkPath.value?.type === "Identifier" &&
                hasBinding(sdkNamespaces, sdkPath)
            );
        }
        return false;
    };

    const tradingLocalNames = new Set();
    const sdkLocalNames = new Set();
    root.find(j.ImportDeclaration).forEach((path) => {
        if (!PACKAGE_NAMES.has(String(path.value.source.value))) return;
        for (const specifier of path.value.specifiers || []) {
            if (
                specifier.type === "ImportSpecifier" &&
                propertyName(specifier.imported) === "trading" &&
                specifier.local
            ) {
                tradingLocalNames.add(specifier.local.name);
            } else if (
                specifier.type === "ImportNamespaceSpecifier" &&
                specifier.local
            ) {
                sdkLocalNames.add(specifier.local.name);
            }
        }
    });

    const renameGeneratedName = (name) => GENERATED_RENAMES.get(name);
    const isTradingTypeQualifier = (node) =>
        (node.type === "Identifier" &&
            tradingLocalNames.has(node.name)) ||
        (node.type === "TSQualifiedName" &&
            node.left.type === "Identifier" &&
            sdkLocalNames.has(node.left.name) &&
            node.right.type === "Identifier" &&
            node.right.name === "trading");

    const typeNodeName = (type) => {
        if (type?.type !== "TSTypeReference") return undefined;
        const name = type.typeName;
        if (
            name.type === "TSQualifiedName" &&
            isTradingTypeQualifier(name.left) &&
            name.right.type === "Identifier"
        ) {
            return name.right.name;
        }
        return undefined;
    };
    const typeName = (annotation) =>
        typeNodeName(annotation?.typeAnnotation);
    const isNamedCall = (call, names) =>
        call.callee.type === "MemberExpression" &&
        names.has(propertyName(call.callee.property));
    const objectArgument = (call) => {
        const first = call.arguments[0];
        return first?.type === "ObjectExpression" ? first : undefined;
    };

    const isAlpacaConstructor = (path) => {
        if (
            path.value?.type === "Identifier" &&
            hasBinding(alpacaConstructors, path)
        ) {
            return true;
        }
        if (
            path.value?.type !== "MemberExpression" ||
            propertyName(path.value.property) !== "Alpaca"
        ) {
            return false;
        }
        const objectPath = path.get("object");
        return (
            objectPath.value.type === "Identifier" &&
            hasBinding(sdkNamespaces, objectPath)
        );
    };
    const alpacaInstances = createBindings();
    const configuredInstanceNames = new Set(
        String(options.instanceName || "")
            .split(",")
            .map((name) => name.trim())
            .filter(Boolean),
    );
    if (configuredInstanceNames.size > 0) {
        root.find(j.Identifier).forEach((path) => {
            if (!configuredInstanceNames.has(path.value.name)) return;
            const scope = bindingScope(path);
            if (!scope || hasBinding(alpacaInstances, path)) return;
            if (hasLaterWrite(scope, path.value.name)) {
                report(
                    `ambiguous-instance-${path.value.name}`,
                    `--instanceName=${path.value.name} was ignored for a reassigned binding`,
                );
                return;
            }
            setBinding(alpacaInstances, path);
        });
    }
    root.find(j.NewExpression).forEach((path) => {
        if (!isAlpacaConstructor(path.get("callee"))) return;
        const parent = path.parent;
        if (
            parent.value?.type === "VariableDeclarator" &&
            parent.value.id.type === "Identifier" &&
            isStableDeclaration(parent.get("id"))
        ) {
            setBinding(alpacaInstances, parent.get("id"));
        }
    });
    propagateStableAliases(alpacaInstances);
    const isAlpacaInstance = (path) =>
        (path.value?.type === "Identifier" &&
            hasBinding(alpacaInstances, path)) ||
        (path.value?.type === "NewExpression" &&
            isAlpacaConstructor(path.get("callee")));
    const isFacadeNamespaceReceiver = (path, namespace) =>
        path.value?.type === "MemberExpression" &&
        propertyName(path.value.property) === namespace &&
        isAlpacaInstance(path.get("object"));
    const isFacadeAreaReceiver = (path, namespace, area) => {
        if (
            path.value?.type !== "MemberExpression" ||
            propertyName(path.value.property) !== area
        ) {
            return false;
        }
        const namespacePath = path.get("object");
        if (
            namespacePath.value.type !== "MemberExpression" ||
            propertyName(namespacePath.value.property) !== namespace
        ) {
            return false;
        }
        return isAlpacaInstance(namespacePath.get("object"));
    };

    const orderApis = createBindings();
    root.find(j.VariableDeclarator).forEach((path) => {
        if (
            path.value.id.type !== "Identifier" ||
            path.value.init?.type !== "NewExpression" ||
            path.value.init.callee.type !== "MemberExpression" ||
            propertyName(path.value.init.callee.property) !== "OrdersApi" ||
            !isTradingNamespaceMember(path.get("init", "callee")) ||
            !isStableDeclaration(path.get("id"))
        ) {
            return;
        }
        setBinding(orderApis, path.get("id"));
    });
    propagateStableAliases(orderApis);
    const isGeneratedOrdersReceiver = (path) =>
        (path.value?.type === "Identifier" &&
            hasBinding(orderApis, path)) ||
        isFacadeAreaReceiver(path, "trading", "orders");
    const orderMethodNames = new Set(["postOrder", "postOrderRaw"]);
    const isGeneratedOrderCall = (path) =>
        isNamedCall(path.value, orderMethodNames) &&
        isGeneratedOrdersReceiver(path.get("callee", "object"));

    const corporateActionsApis = createBindings();
    root.find(j.VariableDeclarator).forEach((path) => {
        if (
            path.value.id.type !== "Identifier" ||
            path.value.init?.type !== "NewExpression" ||
            path.value.init.callee.type !== "MemberExpression" ||
            propertyName(path.value.init.callee.property) !==
                "CorporateActionsApi" ||
            !isTradingNamespaceMember(path.get("init", "callee")) ||
            !isStableDeclaration(path.get("id"))
        ) {
            return;
        }
        setBinding(corporateActionsApis, path.get("id"));
    });
    propagateStableAliases(corporateActionsApis);
    const isGeneratedCorporateActionsReceiver = (path) =>
        (path.value?.type === "Identifier" &&
            hasBinding(corporateActionsApis, path)) ||
        isFacadeAreaReceiver(path, "trading", "corporateActions");
    const corporateActionsMethodNames = new Set([
        "getV2CorporateActionsAnnouncements",
        "getV2CorporateActionsAnnouncementsRaw",
    ]);
    const isGeneratedCorporateActionsCall = (path) =>
        isNamedCall(path.value, corporateActionsMethodNames) &&
        isGeneratedCorporateActionsReceiver(
            path.get("callee", "object"),
        );

    const eventsApis = createBindings();
    root.find(j.VariableDeclarator).forEach((path) => {
        if (
            path.value.id.type !== "Identifier" ||
            path.value.init?.type !== "NewExpression" ||
            path.value.init.callee.type !== "MemberExpression" ||
            propertyName(path.value.init.callee.property) !==
                "EventsApi" ||
            !isTradingNamespaceMember(path.get("init", "callee")) ||
            !isStableDeclaration(path.get("id"))
        ) {
            return;
        }
        setBinding(eventsApis, path.get("id"));
    });
    propagateStableAliases(eventsApis);
    const activitySseMethodNames = new Set([
        "subscribeToActivitiesSSE",
        "subscribeToActivitiesSSERaw",
    ]);
    const isGeneratedEventsReceiver = (path) =>
        (path.value?.type === "Identifier" &&
            hasBinding(eventsApis, path)) ||
        isFacadeAreaReceiver(path, "trading", "events");
    const isGeneratedActivitySseCall = (path) =>
        isNamedCall(path.value, activitySseMethodNames) &&
        isGeneratedEventsReceiver(path.get("callee", "object"));

    const removedMarketDataApiNames = new Set([
        "IndexApi",
        "CryptoPerpetualFuturesApi",
    ]);
    const removedMarketDataConstructors = createBindings();
    root.find(j.VariableDeclarator).forEach((path) => {
        if (
            path.value.id.type === "Identifier" &&
            path.value.init?.type === "MemberExpression" &&
            isMarketDataNamespaceMember(path.get("init")) &&
            removedMarketDataApiNames.has(
                propertyName(path.value.init.property),
            ) &&
            isStableDeclaration(path.get("id"))
        ) {
            setBinding(
                removedMarketDataConstructors,
                path.get("id"),
                propertyName(path.value.init.property),
            );
            return;
        }
        if (
            path.value.id.type !== "ObjectPattern" ||
            !path.value.init ||
            !isMarketDataNamespaceObject(path.get("init"))
        ) {
            return;
        }
        path.get("id", "properties").each((propertyPath) => {
            const property = propertyPath.value;
            const apiName =
                property.type === "Property" ||
                property.type === "ObjectProperty"
                    ? propertyName(property.key)
                    : undefined;
            if (
                !apiName ||
                !removedMarketDataApiNames.has(apiName) ||
                property.value.type !== "Identifier"
            ) {
                return;
            }
            const valuePath = propertyPath.get("value");
            const scope = bindingScope(valuePath);
            if (hasLaterWrite(scope, valuePath.value.name)) return;
            setBinding(
                removedMarketDataConstructors,
                valuePath,
                apiName,
            );
            addTodo(
                propertyPath,
                `removed-${apiName}`,
                REMOVED_MARKET_DATA_MEMBERS.get(apiName),
            );
        });
    });
    propagateStableAliases(removedMarketDataConstructors);

    const removedMarketDataApis = createBindings();
    root.find(j.VariableDeclarator).forEach((path) => {
        if (
            path.value.id.type !== "Identifier" ||
            path.value.init?.type !== "NewExpression" ||
            !isStableDeclaration(path.get("id"))
        ) {
            return;
        }
        const calleePath = path.get("init", "callee");
        const apiName =
            calleePath.value?.type === "MemberExpression" &&
            isMarketDataNamespaceMember(calleePath)
                ? propertyName(calleePath.value.property)
                : calleePath.value?.type === "Identifier"
                  ? getBinding(
                        removedMarketDataConstructors,
                        calleePath,
                    )
                  : undefined;
        if (!apiName || !removedMarketDataApiNames.has(apiName)) {
            return;
        }
        setBinding(
            removedMarketDataApis,
            path.get("id"),
            apiName,
        );
    });
    propagateStableAliases(removedMarketDataApis);
    const indexApiMethods = new Set([
        "getIndexValues",
        "indexLatestValues",
        "indexLatestValuesRaw",
        "indexValues",
        "indexValuesRaw",
    ]);
    const cryptoPerpetualFuturesApiMethods = new Set([
        "cryptoPerpLatestBars",
        "cryptoPerpLatestBarsRaw",
        "cryptoPerpLatestFuturesPricing",
        "cryptoPerpLatestFuturesPricingRaw",
        "cryptoPerpLatestOrderbooks",
        "cryptoPerpLatestOrderbooksRaw",
        "cryptoPerpLatestQuotes",
        "cryptoPerpLatestQuotesRaw",
        "cryptoPerpLatestTrades",
        "cryptoPerpLatestTradesRaw",
    ]);
    const isRemovedMarketDataMember = (path, name) => {
        const isNestedReceiver =
            path.parent?.value?.type === "MemberExpression" &&
            path.parent.value.object === path.value;
        if (
            name === "IndexApi" ||
            name === "CryptoPerpetualFuturesApi"
        ) {
            return (
                !isNestedReceiver &&
                isMarketDataNamespaceMember(path)
            );
        }
        if (name === "indices") {
            return (
                !isNestedReceiver &&
                isFacadeAreaReceiver(
                    path,
                    "marketData",
                    "indices",
                )
            );
        }
        if (name === "cryptoPerpetualFutures") {
            return (
                !isNestedReceiver &&
                isFacadeAreaReceiver(
                    path,
                    "marketData",
                    "cryptoPerpetualFutures",
                )
            );
        }
        const receiverPath = path.get("object");
        if (
            indexApiMethods.has(name) &&
            receiverPath.value?.type === "Identifier" &&
            getBinding(removedMarketDataApis, receiverPath) ===
                "IndexApi"
        ) {
            return true;
        }
        if (
            cryptoPerpetualFuturesApiMethods.has(name) &&
            receiverPath.value?.type === "Identifier" &&
            getBinding(removedMarketDataApis, receiverPath) ===
                "CryptoPerpetualFuturesApi"
        ) {
            return true;
        }
        if (
            name === "getIndexValues" &&
            isFacadeAreaReceiver(
                receiverPath,
                "marketData",
                "indices",
            )
        ) {
            return true;
        }
        if (
            [
                "iterateIndexValues",
                "collectIndexValuesBySymbol",
            ].includes(name)
        ) {
            return isFacadeNamespaceReceiver(
                receiverPath,
                "marketData",
            );
        }
        if (
            ["toIndexValue", "toIndexValuesBySymbol"].includes(
                name,
            )
        ) {
            return isMarketDataShapesNamespace(receiverPath);
        }
        return false;
    };

    const orderBodyBindings = createBindings();
    const stableObjectBindings = createBindings();
    const trackOrderBody = (objectPath) => {
        objectPath.get("properties").each((propertyPath) => {
            const property = propertyPath.value;
            if (
                (property.type !== "Property" &&
                    property.type !== "ObjectProperty") ||
                propertyName(property.key) !== "postOrderRequest" ||
                property.value.type !== "Identifier"
            ) {
                return;
            }
            setBinding(orderBodyBindings, propertyPath.get("value"));
        });
    };
    root.find(j.VariableDeclarator).forEach((path) => {
        if (
            path.value.id.type === "Identifier" &&
            path.value.init?.type === "ObjectExpression" &&
            isStableDeclaration(path.get("id"))
        ) {
            setBinding(
                stableObjectBindings,
                path.get("id"),
                path.value.init,
            );
        }
        if (
            path.value.id.type !== "Identifier" ||
            path.value.init?.type !== "ObjectExpression" ||
            typeName(path.value.id.typeAnnotation) !==
                "PostOrderOperationRequest"
        ) {
            return;
        }
        trackOrderBody(path.get("init"));
    });
    propagateStableAliases(stableObjectBindings);
    root.find(j.CallExpression).forEach((path) => {
        if (!isGeneratedOrderCall(path)) return;
        const request = objectArgument(path.value);
        if (request) trackOrderBody(path.get("arguments", 0));
    });

    const isTrackedOrderBodyType = (path) => {
        let current = path;
        while (current) {
            if (
                current.value?.type === "Identifier" &&
                hasBinding(orderBodyBindings, current)
            ) {
                return true;
            }
            if (
                current.value?.type === "VariableDeclarator" &&
                current.value.id.type === "Identifier" &&
                hasBinding(orderBodyBindings, current.get("id"))
            ) {
                return true;
            }
            current = current.parent;
        }
        return false;
    };

    root.find(j.MemberExpression).forEach((path) => {
        if (!isTradingNamespaceMember(path)) return;
        const oldName = propertyName(path.value.property);
        const newName = oldName && renameGeneratedName(oldName);
        if (!newName) return;
        setPropertyName(path.value, newName);
        mutated = true;
    });

    if (j.TSQualifiedName) {
        root.find(j.TSQualifiedName).forEach((path) => {
            if (!isTradingTypeQualifier(path.value.left)) return;
            const oldName = propertyName(path.value.right);
            if (oldName === "PostOrderRequest") {
                if (isTrackedOrderBodyType(path)) {
                    path.value.right = j.identifier(
                        "CreateOrderRequest",
                    );
                    mutated = true;
                } else {
                    report(
                        "ambiguous-post-order-request",
                        "`trading.PostOrderRequest` is ambiguous between the v4 body and v5 wrapper; review this type manually",
                    );
                }
                return;
            }
            const newName = oldName && renameGeneratedName(oldName);
            if (!newName) return;
            path.value.right = j.identifier(newName);
            mutated = true;
        });
    }

    const renameRequestProperty = (object) => {
        let changed = false;
        for (const property of object.properties) {
            if (
                property.type !== "Property" &&
                property.type !== "ObjectProperty"
            ) {
                continue;
            }
            if (propertyName(property.key) !== "postOrderRequest") continue;
            property.key = j.identifier("createOrderRequest");
            property.computed = false;
            if (property.shorthand) {
                property.shorthand = false;
            }
            changed = true;
        }
        if (changed) mutated = true;
        return changed;
    };
    const isCompatibleOrderRequest = (object) => {
        let hasCreateOrderRequest = false;
        for (const property of object.properties) {
            if (property.type === "SpreadElement") return false;
            if (
                property.type !== "Property" &&
                property.type !== "ObjectProperty"
            ) {
                continue;
            }
            const name = propertyName(property.key);
            if (property.computed && name === undefined) return false;
            if (name === "postOrderRequest") return false;
            if (name === "createOrderRequest") {
                hasCreateOrderRequest = true;
            }
        }
        return hasCreateOrderRequest;
    };
    const migrateCorporateActionRequest = (object) => {
        let provenCompatible = true;
        for (const property of object.properties) {
            if (property.type === "SpreadElement") {
                provenCompatible = false;
                continue;
            }
            if (
                (property.type !== "Property" &&
                    property.type !== "ObjectProperty") ||
                propertyName(property.key) !== "caTypes"
            ) {
                continue;
            }
            if (
                (property.value.type === "Literal" ||
                    property.value.type === "StringLiteral") &&
                typeof property.value.value === "string"
            ) {
                const values = property.value.value
                    .split(",")
                    .map((value) => value.trim());
                const canonical = values.map((value) =>
                    CORPORATE_ACTION_TYPES.get(value.toLowerCase()),
                );
                if (
                    values.some((value) => value === "") ||
                    canonical.some((value) => value === undefined)
                ) {
                    provenCompatible = false;
                    continue;
                }
                property.value = j.arrayExpression(
                    canonical.map((value) => j.stringLiteral(value)),
                );
                mutated = true;
            } else if (property.value.type !== "ArrayExpression") {
                provenCompatible = false;
            }
        }
        return provenCompatible;
    };
    const isCompatibleCorporateActionRequest = (object) => {
        for (const property of object.properties) {
            if (property.type === "SpreadElement") return false;
            if (
                property.type !== "Property" &&
                property.type !== "ObjectProperty"
            ) {
                continue;
            }
            const name = propertyName(property.key);
            if (property.computed && name === undefined) return false;
            if (
                name === "caTypes" &&
                property.value.type !== "ArrayExpression"
            ) {
                return false;
            }
        }
        return true;
    };

    root.find(j.CallExpression).forEach((path) => {
        if (isGeneratedOrderCall(path)) {
            const request = objectArgument(path.value);
            if (request) {
                renameRequestProperty(request);
            } else if (path.value.arguments[0]?.type === "Identifier") {
                const boundObject = getBinding(
                    stableObjectBindings,
                    path.get("arguments", 0),
                );
                if (
                    boundObject?.type === "ObjectExpression" &&
                    isCompatibleOrderRequest(boundObject)
                ) {
                    return;
                }
                addTodo(
                    path,
                    "variable-post-order-request",
                    "a variable-backed `postOrder` request was left unchanged because it may be shared; ensure this SDK call receives `{ createOrderRequest }`",
                );
            } else if (path.value.arguments.length > 0) {
                addTodo(
                    path,
                    "expression-post-order-request",
                    "an expression-backed `postOrder` request could not be migrated safely; ensure it returns `{ createOrderRequest }`",
                );
            }
        } else if (
            isNamedCall(path.value, orderMethodNames) &&
            path.value.callee.object.type === "MemberExpression" &&
            propertyName(path.value.callee.object.property) ===
                "orders" &&
            path.value.callee.object.object.type ===
                "MemberExpression" &&
            propertyName(
                path.value.callee.object.object.property,
            ) === "trading"
        ) {
            report(
                "unproven-orders-receiver",
                "an unproven `.trading.orders` receiver was left unchanged; construct or retain the client from an imported `Alpaca` binding",
            );
        }

        if (isGeneratedCorporateActionsCall(path)) {
            const request = objectArgument(path.value);
            if (request) {
                if (!migrateCorporateActionRequest(request)) {
                    addTodo(
                        path,
                        "inline-corporate-actions-request",
                        "the `caTypes` value could not be proven to be a v5 array; review this corporate-actions request",
                    );
                }
                return;
            }
            if (path.value.arguments[0]?.type === "Identifier") {
                const boundObject = getBinding(
                    stableObjectBindings,
                    path.get("arguments", 0),
                );
                if (
                    boundObject?.type === "ObjectExpression" &&
                    isCompatibleCorporateActionRequest(boundObject)
                ) {
                    return;
                }
                addTodo(
                    path,
                    "variable-corporate-actions-request",
                    "a variable-backed corporate-actions request was left unchanged because it may be shared; ensure `caTypes` is an array at this SDK call",
                );
            } else if (path.value.arguments.length > 0) {
                addTodo(
                    path,
                    "expression-corporate-actions-request",
                    "an expression-backed corporate-actions request could not be migrated safely; ensure `caTypes` is an array",
                );
            }
        } else if (
            isNamedCall(path.value, corporateActionsMethodNames) &&
            path.value.callee.object.type === "MemberExpression" &&
            propertyName(path.value.callee.object.property) ===
                "corporateActions" &&
            path.value.callee.object.object.type ===
                "MemberExpression" &&
            propertyName(
                path.value.callee.object.object.property,
            ) === "trading"
        ) {
            report(
                "unproven-corporate-actions-receiver",
                "an unproven `.trading.corporateActions` receiver was left unchanged; construct or retain the client from an imported `Alpaca` binding",
            );
        }
    });

    root.find(j.CallExpression).forEach((path) => {
        if (isGeneratedActivitySseCall(path)) {
            addTodo(
                path,
                "activity-sse",
                "activity SSE now returns an async subscription; migrate array-style consumption and close the stream explicitly",
            );
        } else if (
            isNamedCall(path.value, activitySseMethodNames) &&
            path.value.callee.object.type === "MemberExpression" &&
            propertyName(path.value.callee.object.property) ===
                "events" &&
            path.value.callee.object.object.type ===
                "MemberExpression" &&
            propertyName(
                path.value.callee.object.object.property,
            ) === "trading"
        ) {
            report(
                "unproven-events-receiver",
                "an unproven `.trading.events` receiver was left unchanged; construct or retain the client from an imported `Alpaca` binding",
            );
        }
    });

    const assetModels = createBindings();
    const announcementModels = createBindings();
    root.find(j.VariableDeclarator).forEach((path) => {
        if (path.value.id.type !== "Identifier") return;
        const modelName = typeName(path.value.id.typeAnnotation);
        const assertedModelName =
            path.value.init?.type === "TSAsExpression"
                ? typeNodeName(path.value.init.typeAnnotation)
                : undefined;
        if (
            modelName === "Assets" ||
            assertedModelName === "Assets"
        ) {
            setBinding(assetModels, path.get("id"));
        }
        if (
            modelName === "CorporateAnnouncement" ||
            assertedModelName === "CorporateAnnouncement"
        ) {
            setBinding(announcementModels, path.get("id"));
        }
    });
    propagateStableAliases(assetModels);
    propagateStableAliases(announcementModels);

    root.find(j.MemberExpression).forEach((path) => {
        const name = propertyName(path.value.property);
        if (!name) return;
        if (REMOVED_MARKET_DATA_MEMBERS.has(name)) {
            if (!isRemovedMarketDataMember(path, name)) return;
            addTodo(
                path,
                `removed-${name}`,
                REMOVED_MARKET_DATA_MEMBERS.get(name),
            );
        } else if (
            name === "easyToBorrow" &&
            path.value.object.type === "Identifier" &&
            hasBinding(assetModels, path.get("object"))
        ) {
            report(
                "easyToBorrow",
                "`easyToBorrow` was removed; inspect this access and use the `borrowStatus` enum when it is an Alpaca Asset",
            );
        } else if (
            (name === "corporateActionsId" ||
                name === "expirationDate") &&
            path.value.object.type === "Identifier" &&
            hasBinding(
                announcementModels,
                path.get("object"),
            )
        ) {
            report(
                `announcement-${name}`,
                `CorporateAnnouncement.${name} changed; inspect announcement field/date usage`,
            );
        }
    });

    const reorgReview =
        'do not mechanically rewrite historical "REORG"; use "REO" for new reorganizations and retain "REORG"/"WRM" for worthless removals';
    root.find(j.MemberExpression).forEach((path) => {
        if (
            propertyName(path.value.property) === "Reorg" &&
            isActivityTypeObject(path.get("object"))
        ) {
            report("reorg-enum", reorgReview);
        }
    });
    root.find(j.Literal, { value: "REORG" }).forEach(() => {
        report(
            "reorg-literal",
            reorgReview,
        );
    });
    if (j.StringLiteral) {
        root.find(j.StringLiteral, { value: "REORG" }).forEach(() => {
            report(
                "reorg-literal",
                reorgReview,
            );
        });
    }

    const dividendDetails = createBindings();
    const activityStreams = createBindings();
    const activityEvents = createBindings();

    const isActivitySubscription = (path) => {
        let candidatePath = path;
        if (candidatePath.value?.type === "AwaitExpression") {
            candidatePath = candidatePath.get("argument");
        }
        return (
            candidatePath.value?.type === "CallExpression" &&
            isGeneratedActivitySseCall(candidatePath)
        );
    };

    root.find(j.VariableDeclarator).forEach((path) => {
        if (path.value.id.type !== "Identifier") return;
        if (path.value.init && isActivitySubscription(path.get("init"))) {
            setBinding(activityStreams, path.get("id"));
        }
        const modelName = typeName(path.value.id.typeAnnotation);
        const assertedModelName =
            path.value.init?.type === "TSAsExpression"
                ? typeNodeName(path.value.init.typeAnnotation)
                : undefined;
        if (
            (modelName && TRADING_DIVIDEND_MODELS.has(modelName)) ||
            (assertedModelName &&
                TRADING_DIVIDEND_MODELS.has(assertedModelName))
        ) {
            setBinding(dividendDetails, path.get("id"));
        }
    });

    root.find(j.ForOfStatement).forEach((path) => {
        if (!path.value.await) return;
        const left = path.value.left;
        const rightPath = path.get("right");
        const isStream =
            isActivitySubscription(rightPath) ||
            (rightPath.value.type === "Identifier" &&
                hasBinding(activityStreams, rightPath));
        if (!isStream) return;
        if (
            left.type === "VariableDeclaration" &&
            left.declarations.length === 1 &&
            left.declarations[0].id.type === "Identifier"
        ) {
            setBinding(
                activityEvents,
                path.get("left", "declarations", 0, "id"),
            );
        }
    });

    const isActivityFlag = (path) => {
        if (
            path.value.type !== "MemberExpression" ||
            !["foreign", "special"].includes(
                propertyName(path.value.property),
            )
        ) {
            return false;
        }
        const objectPath = path.get("object");
        if (
            objectPath.value.type === "Identifier" &&
            hasBinding(dividendDetails, objectPath)
        ) {
            return true;
        }
        if (
            objectPath.value.type !== "MemberExpression" ||
            propertyName(objectPath.value.property) !== "details"
        ) {
            return false;
        }
        const eventPath = objectPath.get("object");
        return (
            eventPath.value.type === "Identifier" &&
            hasBinding(activityEvents, eventPath)
        );
    };

    const isTruthyContext = (path) => {
        const parent = path.parent?.value;
        if (!parent) return false;
        if (
            (parent.type === "IfStatement" ||
                parent.type === "ConditionalExpression" ||
                parent.type === "WhileStatement" ||
                parent.type === "DoWhileStatement") &&
            parent.test === path.value
        ) {
            return true;
        }
        if (parent.type === "LogicalExpression") return true;
        if (
            parent.type === "UnaryExpression" &&
            parent.operator === "!"
        ) {
            return true;
        }
        return (
            parent.type === "CallExpression" &&
            parent.callee.type === "Identifier" &&
            parent.callee.name === "Boolean" &&
            parent.arguments[0] === path.value
        );
    };

    root.find(j.MemberExpression).forEach((path) => {
        if (!isActivityFlag(path) || !isTruthyContext(path)) return;
        addTodo(
            path,
            "trading-dividend-flag",
            'Trading dividend flags are the strings "true"/"false"; compare explicitly instead of using truthiness',
        );
    });

    return mutated ? root.toSource() : undefined;
};
