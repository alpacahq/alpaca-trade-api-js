/**
 * Per-endpoint surface tests for the Trading API.
 *
 * One case per generated method on every `trading.*` facade accessor: each
 * invokes the real typed method against a single-route mock and asserts it hits
 * the expected verb + path (a mismatch 404s -> throws). A coverage guard keeps
 * this in lockstep with `capabilities` (see endpoints.shared.ts), and the
 * streaming factory is referenced by name to round out the surface.
 */
import { describe, expect, it } from 'vitest';

import { createMockAlpaca } from '../src/testing';
import * as streaming from '../src/streaming';
import { type EndpointCase, runEndpointCases } from './endpoints.shared';

const cases: EndpointCase[] = [
    // --- trading.account -------------------------------------------------
    {
        accessor: 'trading.account',
        method: 'getAccount',
        verb: 'GET',
        path: /^\/v2\/account$/,
        kind: 'object',
        call: (a) => a.trading.account.getAccount(),
    },

    // --- trading.accountActivities --------------------------------------
    {
        accessor: 'trading.accountActivities',
        method: 'getAccountActivities',
        verb: 'GET',
        path: /^\/v2\/account\/activities$/,
        kind: 'array',
        call: (a) => a.trading.accountActivities.getAccountActivities({}),
    },
    {
        accessor: 'trading.accountActivities',
        method: 'getAccountActivitiesByActivityType',
        verb: 'GET',
        path: /^\/v2\/account\/activities\/[^/]+$/,
        kind: 'array',
        call: (a) => a.trading.accountActivities.getAccountActivitiesByActivityType({ activityType: 'FILL' }),
    },

    // --- trading.accountConfigurations ----------------------------------
    {
        accessor: 'trading.accountConfigurations',
        method: 'getAccountConfig',
        verb: 'GET',
        path: /^\/v2\/account\/configurations$/,
        kind: 'object',
        call: (a) => a.trading.accountConfigurations.getAccountConfig(),
    },
    {
        accessor: 'trading.accountConfigurations',
        method: 'patchAccountConfig',
        verb: 'PATCH',
        path: /^\/v2\/account\/configurations$/,
        kind: 'object',
        call: (a) => a.trading.accountConfigurations.patchAccountConfig({}),
    },

    // --- trading.assets --------------------------------------------------
    {
        accessor: 'trading.assets',
        method: 'getV2Assets',
        verb: 'GET',
        path: /^\/v2\/assets$/,
        kind: 'array',
        call: (a) => a.trading.assets.getV2Assets({}),
    },
    {
        accessor: 'trading.assets',
        method: 'getV2AssetsSymbolOrAssetId',
        verb: 'GET',
        path: /^\/v2\/assets\/[^/]+$/,
        kind: 'object',
        call: (a) => a.trading.assets.getV2AssetsSymbolOrAssetId({ symbolOrAssetId: 'AAPL' }),
    },
    {
        accessor: 'trading.assets',
        method: 'getOptionsContracts',
        verb: 'GET',
        path: /^\/v2\/options\/contracts$/,
        kind: 'object',
        call: (a) => a.trading.assets.getOptionsContracts({}),
    },
    {
        accessor: 'trading.assets',
        method: 'getOptionContractSymbolOrId',
        verb: 'GET',
        path: /^\/v2\/options\/contracts\/[^/]+$/,
        kind: 'object',
        call: (a) => a.trading.assets.getOptionContractSymbolOrId({ symbolOrId: 'AAPL240119C00050000' }),
    },
    {
        accessor: 'trading.assets',
        method: 'usCorporates',
        verb: 'GET',
        path: /^\/v2\/assets\/fixed_income\/us_corporates$/,
        kind: 'object',
        call: (a) => a.trading.assets.usCorporates({}),
    },
    {
        accessor: 'trading.assets',
        method: 'usTreasuries',
        verb: 'GET',
        path: /^\/v2\/assets\/fixed_income\/us_treasuries$/,
        kind: 'object',
        call: (a) => a.trading.assets.usTreasuries({}),
    },

    // --- trading.calendar ------------------------------------------------
    {
        accessor: 'trading.calendar',
        method: 'calendar',
        verb: 'GET',
        path: /^\/v3\/calendar\/[^/]+$/,
        kind: 'object',
        call: (a) => a.trading.calendar.calendar({ market: 'us_equity' as any }),
    },
    {
        accessor: 'trading.clock',
        method: 'clock',
        verb: 'GET',
        path: /^\/v3\/clock$/,
        kind: 'object',
        call: (a) => a.trading.clock.clock({}),
    },
    {
        accessor: 'trading.calendar',
        method: 'legacyCalendar',
        verb: 'GET',
        path: /^\/v2\/calendar$/,
        kind: 'array',
        call: (a) => a.trading.calendar.legacyCalendar({}),
    },
    {
        accessor: 'trading.clock',
        method: 'legacyClock',
        verb: 'GET',
        path: /^\/v2\/clock$/,
        kind: 'object',
        call: (a) => a.trading.clock.legacyClock(),
    },

    // --- trading.corporateActions ---------------------------------------
    {
        accessor: 'trading.corporateActions',
        method: 'getV2CorporateActionsAnnouncements',
        verb: 'GET',
        path: /^\/v2\/corporate_actions\/announcements$/,
        kind: 'array',
        call: (a) =>
            a.trading.corporateActions.getV2CorporateActionsAnnouncements({
                caTypes: ['merger'] as any,
                since: '2024-01-01' as any,
                until: '2024-01-31' as any,
            }),
    },
    {
        accessor: 'trading.corporateActions',
        method: 'getV2CorporateActionsAnnouncementsId',
        verb: 'GET',
        path: /^\/v2\/corporate_actions\/announcements\/[^/]+$/,
        kind: 'object',
        call: (a) => a.trading.corporateActions.getV2CorporateActionsAnnouncementsId({ id: 'ann-1' }),
    },

    // --- trading.cryptoFunding ------------------------------------------
    {
        accessor: 'trading.cryptoFunding',
        method: 'createCryptoTransferForAccount',
        verb: 'POST',
        path: /^\/v2\/wallets\/transfers$/,
        kind: 'object',
        call: (a) => a.trading.cryptoFunding.createCryptoTransferForAccount({ createCryptoTransferRequest: { amount: '1', address: '0xabc' } as any }),
    },
    {
        accessor: 'trading.cryptoFunding',
        method: 'getCryptoFundingTransfer',
        verb: 'GET',
        path: /^\/v2\/wallets\/transfers\/[^/]+$/,
        kind: 'object',
        call: (a) => a.trading.cryptoFunding.getCryptoFundingTransfer({ transferId: 't-1' }),
    },
    {
        accessor: 'trading.cryptoFunding',
        method: 'listCryptoFundingTransfers',
        verb: 'GET',
        path: /^\/v2\/wallets\/transfers$/,
        kind: 'object',
        call: (a) => a.trading.cryptoFunding.listCryptoFundingTransfers(),
    },
    {
        accessor: 'trading.cryptoFunding',
        method: 'getCryptoTransferEstimate',
        verb: 'GET',
        path: /^\/v2\/wallets\/fees\/estimate$/,
        kind: 'object',
        call: (a) => a.trading.cryptoFunding.getCryptoTransferEstimate({}),
    },
    {
        accessor: 'trading.cryptoFunding',
        method: 'listCryptoFundingWallets',
        verb: 'GET',
        path: /^\/v2\/wallets$/,
        kind: 'object',
        call: (a) => a.trading.cryptoFunding.listCryptoFundingWallets({}),
    },
    {
        accessor: 'trading.cryptoFunding',
        method: 'createWhitelistedAddress',
        verb: 'POST',
        path: /^\/v2\/wallets\/whitelists$/,
        kind: 'object',
        call: (a) => a.trading.cryptoFunding.createWhitelistedAddress({ createWhitelistedAddressRequest: { address: '0xabc', asset: 'USDT' } as any }),
    },
    {
        accessor: 'trading.cryptoFunding',
        method: 'deleteWhitelistedAddress',
        verb: 'DELETE',
        path: /^\/v2\/wallets\/whitelists\/[^/]+$/,
        kind: 'void',
        call: (a) => a.trading.cryptoFunding.deleteWhitelistedAddress({ whitelistedAddressId: 'w-1' }),
    },
    {
        accessor: 'trading.cryptoFunding',
        method: 'listWhitelistedAddress',
        verb: 'GET',
        path: /^\/v2\/wallets\/whitelists$/,
        kind: 'object',
        call: (a) => a.trading.cryptoFunding.listWhitelistedAddress(),
    },

    // --- trading.cryptoPerpetualsAccountVitals --------------------------
    {
        accessor: 'trading.cryptoPerpetualsAccountVitals',
        method: 'getCryptoPerpAccountVitals',
        verb: 'GET',
        path: /^\/v2\/perpetuals\/account_vitals$/,
        kind: 'object',
        call: (a) => a.trading.cryptoPerpetualsAccountVitals.getCryptoPerpAccountVitals(),
    },

    // --- trading.cryptoPerpetualsFunding --------------------------------
    {
        accessor: 'trading.cryptoPerpetualsFunding',
        method: 'createCryptoPerpTransferForAccount',
        verb: 'POST',
        path: /^\/v2\/perpetuals\/wallets\/transfers$/,
        kind: 'object',
        call: (a) => a.trading.cryptoPerpetualsFunding.createCryptoPerpTransferForAccount({ createCryptoTransferRequest: { amount: '1', address: '0xabc' } as any }),
    },
    {
        accessor: 'trading.cryptoPerpetualsFunding',
        method: 'getCryptoPerpFundingTransfer',
        verb: 'GET',
        path: /^\/v2\/perpetuals\/wallets\/transfers\/[^/]+$/,
        kind: 'object',
        call: (a) => a.trading.cryptoPerpetualsFunding.getCryptoPerpFundingTransfer({ transferId: 't-1' }),
    },
    {
        accessor: 'trading.cryptoPerpetualsFunding',
        method: 'getCryptoPerpTransferEstimate',
        verb: 'GET',
        path: /^\/v2\/perpetuals\/wallets\/fees\/estimate$/,
        kind: 'object',
        call: (a) => a.trading.cryptoPerpetualsFunding.getCryptoPerpTransferEstimate({}),
    },
    {
        accessor: 'trading.cryptoPerpetualsFunding',
        method: 'listCryptoPerpFundingTransfers',
        verb: 'GET',
        path: /^\/v2\/perpetuals\/wallets\/transfers$/,
        kind: 'object',
        call: (a) => a.trading.cryptoPerpetualsFunding.listCryptoPerpFundingTransfers(),
    },
    {
        accessor: 'trading.cryptoPerpetualsFunding',
        method: 'listCryptoPerpFundingWallets',
        verb: 'GET',
        path: /^\/v2\/perpetuals\/wallets$/,
        kind: 'object',
        call: (a) => a.trading.cryptoPerpetualsFunding.listCryptoPerpFundingWallets({}),
    },
    {
        accessor: 'trading.cryptoPerpetualsFunding',
        method: 'createWhitelistedPerpAddress',
        verb: 'POST',
        path: /^\/v2\/perpetuals\/wallets\/whitelists$/,
        kind: 'object',
        call: (a) => a.trading.cryptoPerpetualsFunding.createWhitelistedPerpAddress({ createWhitelistedPerpAddressRequest: { address: '0xabc', asset: 'USDT' } as any }),
    },
    {
        accessor: 'trading.cryptoPerpetualsFunding',
        method: 'deleteWhitelistedPerpAddress',
        verb: 'DELETE',
        path: /^\/v2\/perpetuals\/wallets\/whitelists\/[^/]+$/,
        kind: 'void',
        call: (a) => a.trading.cryptoPerpetualsFunding.deleteWhitelistedPerpAddress({ whitelistedAddressId: 'w-1' }),
    },
    {
        accessor: 'trading.cryptoPerpetualsFunding',
        method: 'listWhitelistedPerpAddress',
        verb: 'GET',
        path: /^\/v2\/perpetuals\/wallets\/whitelists$/,
        kind: 'object',
        call: (a) => a.trading.cryptoPerpetualsFunding.listWhitelistedPerpAddress(),
    },

    // --- trading.cryptoPerpetualsLeverage -------------------------------
    {
        accessor: 'trading.cryptoPerpetualsLeverage',
        method: 'getCryptoPerpAccountLeverage',
        verb: 'GET',
        path: /^\/v2\/perpetuals\/leverage$/,
        kind: 'object',
        call: (a) => a.trading.cryptoPerpetualsLeverage.getCryptoPerpAccountLeverage({}),
    },
    {
        accessor: 'trading.cryptoPerpetualsLeverage',
        method: 'setCryptoPerpAccountLeverage',
        verb: 'POST',
        path: /^\/v2\/perpetuals\/leverage$/,
        kind: 'object',
        call: (a) => a.trading.cryptoPerpetualsLeverage.setCryptoPerpAccountLeverage({}),
    },

    // --- trading.events --------------------------------------------------
    {
        accessor: 'trading.events',
        method: 'subscribeToActivitiesSSE',
        verb: 'GET',
        path: /^\/v2beta1\/events\/activities$/,
        kind: 'array',
        call: (a) => a.trading.events.subscribeToActivitiesSSE({}),
    },

    // --- trading.locates -------------------------------------------------
    {
        accessor: 'trading.locates',
        method: 'createLocates',
        verb: 'POST',
        path: /^\/v1\/locates$/,
        kind: 'object',
        call: (a) => a.trading.locates.createLocates({ createLocateRequest: { symbol: 'AAPL', qty: 100 } }),
    },
    {
        accessor: 'trading.locates',
        method: 'getLocate',
        verb: 'GET',
        path: /^\/v1\/locates\/[^/]+$/,
        kind: 'object',
        call: (a) => a.trading.locates.getLocate({ locateId: 'loc_123' }),
    },
    {
        accessor: 'trading.locates',
        method: 'listLocateQuotes',
        verb: 'GET',
        path: /^\/v1\/locates\/quotes$/,
        kind: 'object',
        call: (a) => a.trading.locates.listLocateQuotes({ symbols: 'AAPL' }),
    },
    {
        accessor: 'trading.locates',
        method: 'listLocates',
        verb: 'GET',
        path: /^\/v1\/locates$/,
        kind: 'object',
        call: (a) => a.trading.locates.listLocates({}),
    },

    // --- trading.orders --------------------------------------------------
    {
        accessor: 'trading.orders',
        method: 'getAllOrders',
        verb: 'GET',
        path: /^\/v2\/orders$/,
        kind: 'array',
        call: (a) => a.trading.orders.getAllOrders({}),
    },
    {
        accessor: 'trading.orders',
        method: 'postOrder',
        verb: 'POST',
        path: /^\/v2\/orders$/,
        kind: 'object',
        call: (a) => a.trading.orders.postOrder({ postOrderRequest: { symbol: 'AAPL', qty: '1', side: 'buy', type: 'market', time_in_force: 'day' } as any }),
    },
    {
        accessor: 'trading.orders',
        method: 'getOrderByOrderID',
        verb: 'GET',
        path: /^\/v2\/orders\/[^/]+$/,
        kind: 'object',
        call: (a) => a.trading.orders.getOrderByOrderID({ orderId: 'o-1' }),
    },
    {
        accessor: 'trading.orders',
        method: 'getOrderByClientOrderId',
        verb: 'GET',
        path: /^\/v2\/orders:by_client_order_id$/,
        kind: 'object',
        call: (a) => a.trading.orders.getOrderByClientOrderId({ clientOrderId: 'c-1' }),
    },
    {
        accessor: 'trading.orders',
        method: 'patchOrderByOrderId',
        verb: 'PATCH',
        path: /^\/v2\/orders\/[^/]+$/,
        kind: 'object',
        call: (a) => a.trading.orders.patchOrderByOrderId({ orderId: 'o-1', patchOrderRequest: { qty: '2' } as any }),
    },
    {
        accessor: 'trading.orders',
        method: 'deleteOrderByOrderID',
        verb: 'DELETE',
        path: /^\/v2\/orders\/[^/]+$/,
        kind: 'void',
        call: (a) => a.trading.orders.deleteOrderByOrderID({ orderId: 'o-1' }),
    },
    {
        accessor: 'trading.orders',
        method: 'deleteAllOrders',
        verb: 'DELETE',
        path: /^\/v2\/orders$/,
        kind: 'array',
        call: (a) => a.trading.orders.deleteAllOrders(),
    },

    // --- trading.portfolioHistory ---------------------------------------
    {
        accessor: 'trading.portfolioHistory',
        method: 'getAccountPortfolioHistory',
        verb: 'GET',
        path: /^\/v2\/account\/portfolio\/history$/,
        kind: 'object',
        call: (a) => a.trading.portfolioHistory.getAccountPortfolioHistory({}),
    },

    // --- trading.positions ----------------------------------------------
    {
        accessor: 'trading.positions',
        method: 'getAllOpenPositions',
        verb: 'GET',
        path: /^\/v2\/positions$/,
        kind: 'array',
        call: (a) => a.trading.positions.getAllOpenPositions(),
    },
    {
        accessor: 'trading.positions',
        method: 'getOpenPosition',
        verb: 'GET',
        path: /^\/v2\/positions\/[^/]+$/,
        kind: 'object',
        call: (a) => a.trading.positions.getOpenPosition({ symbolOrAssetId: 'AAPL' }),
    },
    {
        accessor: 'trading.positions',
        method: 'deleteAllOpenPositions',
        verb: 'DELETE',
        path: /^\/v2\/positions$/,
        kind: 'array',
        call: (a) => a.trading.positions.deleteAllOpenPositions({}),
    },
    {
        accessor: 'trading.positions',
        method: 'deleteOpenPosition',
        verb: 'DELETE',
        path: /^\/v2\/positions\/[^/]+$/,
        kind: 'object',
        call: (a) => a.trading.positions.deleteOpenPosition({ symbolOrAssetId: 'AAPL' }),
    },
    {
        accessor: 'trading.positions',
        method: 'optionExercise',
        verb: 'POST',
        path: /^\/v2\/positions\/[^/]+\/exercise$/,
        kind: 'void',
        call: (a) => a.trading.positions.optionExercise({ symbolOrContractId: 'AAPL240119C00050000' }),
    },
    {
        accessor: 'trading.positions',
        method: 'optionDoNotExercise',
        verb: 'POST',
        path: /^\/v2\/positions\/[^/]+\/do-not-exercise$/,
        kind: 'void',
        call: (a) => a.trading.positions.optionDoNotExercise({ symbolOrContractId: 'AAPL240119C00050000' }),
    },

    // --- trading.tokenization -------------------------------------------
    {
        accessor: 'trading.tokenization',
        method: 'getTokenizationRequests',
        verb: 'GET',
        path: /^\/v2\/tokenization\/requests$/,
        kind: 'array',
        call: (a) => a.trading.tokenization.getTokenizationRequests({}),
    },
    {
        accessor: 'trading.tokenization',
        method: 'postTokenizationMint',
        verb: 'POST',
        path: /^\/v2\/tokenization\/mint$/,
        kind: 'object',
        call: (a) => a.trading.tokenization.postTokenizationMint({ tokenizationMintRequest: { symbol: 'AAPLx' } as any }),
    },

    // --- trading.watchlists ---------------------------------------------
    {
        accessor: 'trading.watchlists',
        method: 'getWatchlists',
        verb: 'GET',
        path: /^\/v2\/watchlists$/,
        kind: 'array',
        call: (a) => a.trading.watchlists.getWatchlists(),
    },
    {
        accessor: 'trading.watchlists',
        method: 'getWatchlistById',
        verb: 'GET',
        path: /^\/v2\/watchlists\/[^/]+$/,
        kind: 'object',
        call: (a) => a.trading.watchlists.getWatchlistById({ watchlistId: 'wl-1' }),
    },
    {
        accessor: 'trading.watchlists',
        method: 'getWatchlistByName',
        verb: 'GET',
        path: /^\/v2\/watchlists:by_name$/,
        kind: 'object',
        call: (a) => a.trading.watchlists.getWatchlistByName({ name: 'mylist' }),
    },
    {
        accessor: 'trading.watchlists',
        method: 'postWatchlist',
        verb: 'POST',
        path: /^\/v2\/watchlists$/,
        kind: 'object',
        call: (a) => a.trading.watchlists.postWatchlist({ updateWatchlistRequest: { name: 'mylist', symbols: [] } as any }),
    },
    {
        accessor: 'trading.watchlists',
        method: 'updateWatchlistById',
        verb: 'PUT',
        path: /^\/v2\/watchlists\/[^/]+$/,
        kind: 'object',
        call: (a) => a.trading.watchlists.updateWatchlistById({ watchlistId: 'wl-1' }),
    },
    {
        accessor: 'trading.watchlists',
        method: 'updateWatchlistByName',
        verb: 'PUT',
        path: /^\/v2\/watchlists:by_name$/,
        kind: 'object',
        call: (a) => a.trading.watchlists.updateWatchlistByName({ name: 'mylist' }),
    },
    {
        accessor: 'trading.watchlists',
        method: 'addAssetToWatchlist',
        verb: 'POST',
        path: /^\/v2\/watchlists\/[^/]+$/,
        kind: 'object',
        call: (a) => a.trading.watchlists.addAssetToWatchlist({ watchlistId: 'wl-1' }),
    },
    {
        accessor: 'trading.watchlists',
        method: 'addAssetToWatchlistByName',
        verb: 'POST',
        path: /^\/v2\/watchlists:by_name$/,
        kind: 'object',
        call: (a) => a.trading.watchlists.addAssetToWatchlistByName({ name: 'mylist' }),
    },
    {
        accessor: 'trading.watchlists',
        method: 'removeAssetFromWatchlist',
        verb: 'DELETE',
        path: /^\/v2\/watchlists\/[^/]+\/[^/]+$/,
        kind: 'object',
        call: (a) => a.trading.watchlists.removeAssetFromWatchlist({ watchlistId: 'wl-1', symbol: 'AAPL' }),
    },
    {
        accessor: 'trading.watchlists',
        method: 'deleteWatchlistById',
        verb: 'DELETE',
        path: /^\/v2\/watchlists\/[^/]+$/,
        kind: 'void',
        call: (a) => a.trading.watchlists.deleteWatchlistById({ watchlistId: 'wl-1' }),
    },
    {
        accessor: 'trading.watchlists',
        method: 'deleteWatchlistByName',
        verb: 'DELETE',
        path: /^\/v2\/watchlists:by_name$/,
        kind: 'void',
        call: (a) => a.trading.watchlists.deleteWatchlistByName({ name: 'mylist' }),
    },
];

describe('Trading API surface (per-endpoint)', () => {
    runEndpointCases('trading', cases);
});

describe('Trading streaming surface', () => {
    it('exposes the trading.stream factory by name', () => {
        const alpaca = createMockAlpaca([]);
        const stream = alpaca.trading.stream({
            pingIntervalMs: 0,
            wsFactory: () => new FakeSocket() as unknown as streaming.WebSocketLike,
        });
        expect(stream).toBeInstanceOf(streaming.TradingStream);
    });
});

/** Minimal non-connecting socket so constructing a stream touches no network. */
class FakeSocket {
    on(): this {
        return this;
    }
    send(): void {}
    close(): void {}
    terminate(): void {}
    ping(): void {}
}
