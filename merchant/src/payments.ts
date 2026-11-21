/**
 * x402 payments: the HTTP 402 answer, and the facilitator that verifies
 * and settles the payment.
 *
 * Wire shapes are the x402 v2 types from @x402/core (verified from the
 * installed package's own type declarations):
 * - PaymentRequirements: { scheme, network, asset, amount, payTo,
 *   maxTimeoutSeconds, extra }. The Concordium client requires
 *   extra.feePayer (the sponsor), per @x402/concordium's client docs.
 * - PaymentRequired (the 402 body): { x402Version: 2, resource, accepts }.
 * - PaymentPayload (the X-PAYMENT header, base64 JSON): { x402Version,
 *   accepted, payload }.
 * - VerifyResponse: { isValid, invalidReason?, payer? }.
 * - SettleResponse: { success, transaction, network, ... }.
 *
 * The merchant runs its own facilitator, because no official public
 * Concordium testnet facilitator URL exists in the docs (plan gap 2).
 * Live mode uses the SDK's own facilitator role:
 *   toConcordiumFacilitatorSigner(sponsorAddress, privateKey, { host, port, useTls })
 *   new ExactConcordiumScheme({ signer })  // from '@x402/concordium/exact/facilitator'
 * The facilitator sponsor signs and pays the fee, so the agent never needs
 * CCD for gas (Protocol 10 sponsored transactions).
 *
 * Demo mode (no sponsor key configured) uses a shape-checking stand-in:
 * it accepts a payload that matches the 402 quote exactly and carries
 * `demo: true`, and returns a mock transaction id prefixed `demo:`.
 * It is labelled DEMO everywhere and never touches the chain.
 */
import { randomBytes } from 'node:crypto';
import {
    CHAIN_ID,
    GRPC_ENDPOINT,
    ITEM,
    MERCHANT_PAYTO,
    SPONSOR_ADDRESS,
    SPONSOR_PRIVATE_KEY,
} from './config.js';
import { parseGrpcUrl, toConcordiumFacilitatorSigner } from '@x402/concordium';
import { ExactConcordiumScheme as FacilitatorScheme } from '@x402/concordium/exact/facilitator';
import type {
    PaymentPayload,
    PaymentRequired,
    PaymentRequirements,
    SettleResponse,
    VerifyResponse,
} from '@x402/core/types';

export function buildRequirements(): PaymentRequirements {
    return {
        scheme: 'exact',
        network: CHAIN_ID,
        asset: 'CCD',
        amount: ITEM.priceMicroCcd,
        payTo: MERCHANT_PAYTO,
        maxTimeoutSeconds: 300,
        // The Concordium client requires extra.feePayer. In live mode this
        // is the sponsor account. In demo mode it is the merchant placeholder
        // because no real sponsor is configured and no real payment is made.
        extra: { feePayer: SPONSOR_ADDRESS || MERCHANT_PAYTO },
    };
}

export function buildPaymentRequired(requirements: PaymentRequirements): PaymentRequired {
    return {
        x402Version: 2,
        resource: {
            url: '/api/orders/buy',
            description: `${ITEM.name} — ${ITEM.description}`,
        },
        accepts: [requirements],
    };
}

export type Facilitator = {
    mode: 'live' | 'demo';
    verify(payload: PaymentPayload, requirements: PaymentRequirements): Promise<VerifyResponse>;
    settle(payload: PaymentPayload, requirements: PaymentRequirements): Promise<SettleResponse>;
};

export function createFacilitator(): Facilitator {
    if (SPONSOR_ADDRESS && SPONSOR_PRIVATE_KEY) {
        const [host, port] = parseGrpcUrl(GRPC_ENDPOINT);
        const signer = toConcordiumFacilitatorSigner(SPONSOR_ADDRESS, SPONSOR_PRIVATE_KEY, {
            host,
            port,
            useTls: true,
        });
        const scheme = new FacilitatorScheme({ signer });
        return {
            mode: 'live',
            verify: (payload, requirements) => scheme.verify(payload, requirements),
            settle: (payload, requirements) => scheme.settle(payload, requirements),
        };
    }

    // DEMO stand-in. No chain access, no sponsor key.
    return {
        mode: 'demo',
        verify: async (payload, requirements) => {
            const problems = checkPayloadShape(payload, requirements);
            if (problems) return { isValid: false, invalidReason: problems };
            return { isValid: true, payer: 'demo-agent' };
        },
        settle: async (payload, requirements) => {
            const problems = checkPayloadShape(payload, requirements);
            if (problems) {
                return {
                    success: false,
                    errorReason: problems,
                    transaction: '',
                    network: CHAIN_ID,
                };
            }
            return {
                success: true,
                transaction: `demo:${randomBytes(32).toString('hex')}`,
                network: CHAIN_ID,
            };
        },
    };
}

/**
 * Demo shape check: the payload must be x402 v2, must accept exactly the
 * requirements from the 402 quote, and must carry `demo: true`.
 * Anything else is refused, same as a live facilitator would refuse a
 * mismatched payment.
 */
function checkPayloadShape(payload: PaymentPayload, requirements: PaymentRequirements): string | null {
    if (payload.x402Version !== 2) return 'Payload must be x402 version 2.';
    const accepted = payload.accepted;
    if (!accepted) return 'Payload has no accepted requirements.';
    if (accepted.scheme !== requirements.scheme) return 'Scheme does not match the 402 quote.';
    if (accepted.network !== requirements.network) return 'Network does not match the 402 quote.';
    if (accepted.asset !== requirements.asset) return 'Asset does not match the 402 quote.';
    if (accepted.amount !== requirements.amount) return 'Amount does not match the 402 quote.';
    if (accepted.payTo !== requirements.payTo) return 'Recipient does not match the 402 quote.';
    const inner = payload.payload as Record<string, unknown> | undefined;
    if (!inner || inner.demo !== true) {
        return 'Demo payload must carry demo: true. A real payment needs a sponsor key configured.';
    }
    return null;
}

/**
 * The merchant's facilitator verify step, following the documented
 * Verify & Pay flow: the ZKP requirement must be met (the age token is
 * valid), the payment details must match the 402 quote, and the
 * transaction status must be confirmed (live: via the facilitator and
 * the node; demo: shape check only).
 */
export async function verifyPayment(
    facilitator: Facilitator,
    input: { payload: PaymentPayload; requirements: PaymentRequirements; ageVerified: boolean },
): Promise<VerifyResponse> {
    if (!input.ageVerified) {
        return { isValid: false, invalidReason: 'Age proof not verified for this order.' };
    }
    return facilitator.verify(input.payload, input.requirements);
}
