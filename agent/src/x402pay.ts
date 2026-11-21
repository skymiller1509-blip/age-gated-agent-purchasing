/**
 * x402 payment from the agent side.
 *
 * Live path (needs CCD_ADDRESS + CCD_PRIVATE_KEY, testnet only), using the
 * documented SDK calls from @x402/concordium's client example:
 *   import { ExactConcordiumScheme } from "@x402/concordium/exact/client";
 *   import { buildBasicAccountSigner, AccountAddress } from "@concordium/web-sdk";
 *   const signer = { accountAddress: AccountAddress.fromBase58(addr),
 *                    signer: buildBasicAccountSigner(privateKey) };
 *   const scheme = new ExactConcordiumScheme(signer);
 *   const { x402Version, payload } = await scheme.createPaymentPayload(2, requirements);
 * The client validates the requirements, builds the CCD transfer, signs as
 * sender, and returns the serialized payload. The requirements must include
 * extra.feePayer (the sponsor), and the fee is sponsored, so the agent
 * never needs CCD for gas.
 *
 * Demo path (no key configured): returns a mock PaymentPayload with the
 * exact v2 shape and `payload: { demo: true }`. The merchant's demo
 * facilitator only accepts payloads that match the 402 quote exactly and
 * carry demo: true. Labelled DEMO everywhere.
 */
import { AccountAddress, buildBasicAccountSigner } from '@concordium/web-sdk';
import { ExactConcordiumScheme } from '@x402/concordium/exact/client';
import type { PaymentPayload, PaymentRequirements } from '@x402/core/types';
import { CCD_ADDRESS, CCD_PRIVATE_KEY } from './config.js';

export function hasLiveKey(): boolean {
    return Boolean(CCD_ADDRESS && CCD_PRIVATE_KEY);
}

export async function createPaymentPayload(
    requirements: PaymentRequirements,
): Promise<PaymentPayload> {
    if (!hasLiveKey()) {
        return {
            x402Version: 2,
            accepted: requirements,
            payload: { demo: true },
        };
    }
    const signer = {
        accountAddress: AccountAddress.fromBase58(CCD_ADDRESS),
        signer: buildBasicAccountSigner(CCD_PRIVATE_KEY),
    };
    const scheme = new ExactConcordiumScheme(signer);
    const { x402Version, payload } = await scheme.createPaymentPayload(2, requirements);
    return { x402Version, accepted: requirements, payload };
}

/** Base64-encode a PaymentPayload for the X-PAYMENT header. */
export function encodeXPayment(payload: PaymentPayload): string {
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}
