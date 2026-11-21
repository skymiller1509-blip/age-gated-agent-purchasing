/**
 * Agent payment tests: the demo payload shape and the X-PAYMENT encoding.
 * Self-contained: the requirements object is built here from the SDK's own
 * chain id, exactly as the merchant builds it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONCORDIUM_TESTNET_CAIP2 } from '@x402/concordium';
import type { PaymentPayload, PaymentRequirements } from '@x402/core/types';
import { createPaymentPayload, encodeXPayment, hasLiveKey } from '../x402pay.js';

const requirements: PaymentRequirements = {
    scheme: 'exact',
    network: CONCORDIUM_TESTNET_CAIP2,
    asset: 'CCD',
    amount: '5000000',
    payTo: 'DEMO-MERCHANT-NOT-SET',
    maxTimeoutSeconds: 300,
    extra: { feePayer: 'DEMO-MERCHANT-NOT-SET' },
};

test('demo payment payload has the exact x402 v2 shape', async () => {
    assert.equal(hasLiveKey(), false); // no key configured in tests
    const payload = await createPaymentPayload(requirements);
    assert.equal(payload.x402Version, 2);
    assert.deepEqual(payload.accepted, requirements);
    assert.deepEqual(payload.payload, { demo: true });
});

test('X-PAYMENT header round-trips the payload', async () => {
    const payload = await createPaymentPayload(requirements);
    const header = encodeXPayment(payload);
    const decoded = JSON.parse(Buffer.from(header, 'base64').toString('utf8')) as PaymentPayload;
    assert.deepEqual(decoded, payload);
});
