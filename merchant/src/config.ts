/**
 * Verified configuration for the Age-Gated Agent Purchasing merchant.
 *
 * Every value below comes from a live check or from the SDK's own constants:
 * - Chain id, gRPC endpoint and explorer come from `@x402/concordium`
 *   (CONCORDIUM_TESTNET_CAIP2 etc.), not from memory.
 * - CIS-8004 / CIS-8 testnet indexes and module refs were re-confirmed live
 *   on 2026-11-19 via the official MCP service's `contract_info` tool.
 * - The twin-test badge addresses were verified live on 2026-11-19 via
 *   `GET /v1/check-badge/{address}`: token 1300 is a valid badged agent,
 *   token 11 is revoked. Both are public testnet agents used as stand-ins
 *   until our own agent is registered; swap them via env vars.
 * - The item and price are the demo shop's own choice (the docs' own
 *   example for age-gated goods is a bottle of wine).
 */
import {
    CONCORDIUM_TESTNET_CAIP2,
    CONCORDIUM_TESTNET_EXPLORER,
    CONCORDIUM_TESTNET_GRPC,
} from '@x402/concordium';

export const NETWORK = 'testnet' as const;
export const CHAIN_ID = CONCORDIUM_TESTNET_CAIP2;
export const GRPC_ENDPOINT = CONCORDIUM_TESTNET_GRPC; // grpc.testnet.concordium.com:20000
export const EXPLORER_BASE = CONCORDIUM_TESTNET_EXPLORER; // https://ccdexplorer.io/testnet

/** CIS-8004 Agent Registry on testnet (verified live via contract_info). */
export const CIS8004 = {
    index: 12802,
    subindex: 0,
    moduleRef:
        '0e57473715d1c2a364fa626b8783688db32b7fac9d0e2fc97043da91e1a7d3eb',
} as const;

/** CIS-8 cross-chain key registry on testnet (verified live via contract_info). */
export const CIS8 = {
    index: 12801,
    subindex: 0,
    moduleRef:
        '3236c12fade1b559935906df2e0e43a372234eac5d40599d6e6cb12cdd6b9afd',
} as const;

export const MCP_BASE = 'https://agent-registry-mcp.concordium.com';
export const INDEXER_BASE = 'https://agent-registry-indexer.concordium.com';

/** The demo shop sells one age-restricted item: a bottle of wine, 5 CCD. */
export const ITEM = {
    id: 'wine-2021',
    name: 'Bottle of wine (2021)',
    description: 'Age-restricted item. The buyer must prove they are 18 or older.',
    priceMicroCcd: '5000000', // 5 CCD, 6 decimals
} as const;

/**
 * Twin-test badge addresses (public testnet agents, verified live 2026-11-19).
 * BADGED is token 1300: Active, card fetched, hash matches, badge present.
 * UNBADGED is token 11: Revoked on chain, so the badge check refuses it.
 * These are stand-ins. Once our own agent is registered, set
 * OUR_AGENT_TOKEN_ADDRESS and the twin test uses it as the badged side.
 */
export const TWIN_TEST = {
    badged: process.env.BADGED_TOKEN_ADDRESS ?? 'JyP9UGK4ajaPRQGJQiDpi',
    unbadged: process.env.UNBADGED_TOKEN_ADDRESS ?? 'JyP9U6SVHZgayqA5XfHfA',
} as const;

/**
 * Merchant account that receives the payment (base58check).
 * Must be set via MERCHANT_PAYTO in live mode. In demo mode the placeholder
 * below is used and no real payment is ever made. The default is deliberately
 * NOT a real account: never point a demo at somebody else's address.
 */
export const MERCHANT_PAYTO = process.env.MERCHANT_PAYTO ?? 'DEMO-MERCHANT-NOT-SET';

/**
 * DEMO_MODE (default true): the age proof is simulated by DemoVerifier and
 * the payment is simulated by the demo facilitator, so the whole flow can
 * run end to end without a wallet. The badge check is always live.
 * Set DEMO_MODE=false and configure SPONSOR_ADDRESS / SPONSOR_PRIVATE_KEY
 * and VERIFIER_SERVICE_URL for the live path.
 */
export const DEMO_MODE = process.env.DEMO_MODE !== 'false';

export const PORT = Number(process.env.PORT ?? 8787);

/** Sponsor account for the x402 facilitator (live mode only). */
export const SPONSOR_ADDRESS = process.env.SPONSOR_ADDRESS ?? '';
export const SPONSOR_PRIVATE_KEY = process.env.SPONSOR_PRIVATE_KEY ?? '';

/** URL of a deployed Concordium Verifier Service (live mode only). */
export const VERIFIER_SERVICE_URL = process.env.VERIFIER_SERVICE_URL ?? '';

/** Our own agent's token address, once registered (live mode). */
export const OUR_AGENT_TOKEN_ADDRESS = process.env.OUR_AGENT_TOKEN_ADDRESS ?? '';
