import AlpacaSdk from "@alpacahq/alpaca-trade-api";

const primary = new AlpacaSdk({ keyId: "key", secretKey: "secret" });
const secondary = new AlpacaSdk({ keyId: "key", secretKey: "secret" });

const SafeCtor = AlpacaSdk;
const safeCtorClient = new SafeCtor({ keyId: "key", secretKey: "secret" });
safeCtorClient.getAccount();

let MutableCtor = AlpacaSdk;
MutableCtor = OtherCtor;
const mutableCtorClient = new MutableCtor({ secretKey: "leave" });
mutableCtorClient.getAccount();

let LateCtor;
const beforeCtorAssignment = new LateCtor({ secretKey: "leave" });
LateCtor = AlpacaSdk;
const afterCtorAssignment = new LateCtor({ secretKey: "leave" });
beforeCtorAssignment.getAccount();
afterCtorAssignment.getAccount();

const safeClientAlias = primary;
safeClientAlias.getAccount();

let unrelatedClient = new AlpacaSdk({ keyId: "key", secretKey: "secret" });
unrelatedClient = getOtherClient();
unrelatedClient.getAccount();

let provenReassignedClient = primary;
provenReassignedClient = secondary;
provenReassignedClient.getAccount();

let lateClient;
lateClient.getAccount();
lateClient = primary;
lateClient.getAccount();

let destructuredClient = primary;
({ client: destructuredClient } = replacement);
destructuredClient.getAccount();

const safeUpdates = primary.trade_ws;
const safeStreamAlias = safeUpdates;
safeStreamAlias.onOrderUpdate(handleOrder);
safeStreamAlias.subscribe(["trade_updates"]);

let unrelatedStream = primary.trade_ws;
unrelatedStream = makeStream();
unrelatedStream.onOrderUpdate(handleOrder);
unrelatedStream.subscribe(["trade_updates"]);

let provenReassignedStream = primary.trade_ws;
provenReassignedStream = secondary.trade_ws;
provenReassignedStream.onOrderUpdate(handleOrder);
provenReassignedStream.subscribe(["trade_updates"]);

let lateStream;
lateStream.onOrderUpdate(handleOrder);
lateStream = primary.trade_ws;
lateStream.onOrderUpdate(handleOrder);
lateStream.subscribe(["trade_updates"]);

let destructuredStream = primary.trade_ws;
[destructuredStream] = replacementStreams;
destructuredStream.onOrderUpdate(handleOrder);
