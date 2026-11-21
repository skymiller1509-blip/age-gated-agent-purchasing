/**
 * Agent configuration.
 * Chain id and gRPC endpoint come from `@x402/concordium` itself.
 * The agent's own token address is set once it is registered; until then
 * the twin-test badged stand-in is the default (public testnet agent,
 * token 1300, verified live).
 */
import { CONCORDIUM_TESTNET_CAIP2, CONCORDIUM_TESTNET_GRPC } from '@x402/concordium';

export const CHAIN_ID = CONCORDIUM_TESTNET_CAIP2;
export const GRPC_ENDPOINT = CONCORDIUM_TESTNET_GRPC;

export const MERCHANT_URL = process.env.MERCHANT_URL ?? 'http://localhost:8787';
export const AGENT_PORT = Number(process.env.AGENT_PORT ?? 8788);
export const DEMO_MODE = process.env.DEMO_MODE !== 'false';

/** Our agent's registry token address, once registered. */
export const AGENT_TOKEN_ADDRESS =
    process.env.AGENT_TOKEN_ADDRESS ?? 'JyP9UGK4ajaPRQGJQiDpi';

/** Live payment key (testnet only). Never commit a real key. */
export const CCD_ADDRESS = process.env.CCD_ADDRESS ?? '';
export const CCD_PRIVATE_KEY = process.env.CCD_PRIVATE_KEY ?? '';
