/**
 * Payment tests: the 402 requirements shape, the demo facilitator's
 * verify/settle, and the rule that payment is refused when the age
 * proof is not verified.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAIN_ID, ITEM, MERCHANT_PAYTO } from '../config.js';
import {
    buildPaymentRequired,
    buildRequirements,
    createFacilitator,
    verifyPayment,
} from '../payments.js';
import type { PaymentPayload } from '@x402/core/types';

const requirements = buildRequirements();

function demoPayload(overrides: Partial<PaymentPayload> = {}): PaymentPayload {
    return {
        x402Version: 2,
        accepted: requirements,
        payload: { demo: true },
        ...overrides,
    };
}

test('402 requirements match the verified x402 v2 shape', () => {
    assert.equal(requirements.scheme, 'exact');
    assert.equal(requirements.network, CHAIN_ID);
    assert.equal(requirements.asset, 'CCD');
    assert.equal(requirements.amount, ITEM.priceMicroCcd);
    assert.equal(requirements.payTo, MERCHANT_PAYTO);
    assert.ok(typeof requirements.extra.feePayer === 'string');
    const body = buildPaymentRequired(requirements);
    assert.equal(body.x402Version, 2);
    assert.equal(body.accepts.length, 1);
    assert.equal(body.accepts[0], requirements);
});

test('demo facilitator accepts a payload that matches the quote', async () => {
    const facilitator = createFacilitator();
    assert.equal(facilitator.mode, 'demo');
    const verified = await facilitator.verify(demoPayload(), requirements);
    assert.equal(verified.isValid, true);
    const settled = await facilitator.settle(demoPayload(), requirements);
    assert.equal(settled.success, true);
    assert.match(settled.transaction, /^demo:[0-9a-f]{64}$/);
    assert.equal(settled.network, CHAIN_ID);
});

test('demo facilitator refuses a wrong amount', async () => {
    const facilitator = createFacilitator();
    const wrong = demoPayload({
        accepted: { ...requirements, amount: '1' },
    });
    const verified = await facilitator.verify(wrong, requirements);
    assert.equal(verified.isValid, false);
    assert.match(verified.invalidReason ?? '', /Amount/);
});

test('demo facilitator refuses a wrong recipient', async () => {
    const facilitator = createFacilitator();
    const wrong = demoPayload({
        accepted: { ...requirements, payTo: 'someone-else' },
    });
    const verified = await facilitator.verify(wrong, requirements);
    assert.equal(verified.isValid, false);
    assert.match(verified.invalidReason ?? '', /Recipient/);
});

test('demo facilitator refuses a payload without the demo marker', async () => {
    const facilitator = createFacilitator();
    const wrong = demoPayload({ payload: { txHash: 'abc' } });
    const verified = await facilitator.verify(wrong, requirements);
    assert.equal(verified.isValid, false);
});

test('payment is refused when the age proof is not verified', async () => {
    const facilitator = createFacilitator();
    const result = await verifyPayment(facilitator, {
        payload: demoPayload(),
        requirements,
        ageVerified: false,
    });
    assert.equal(result.isValid, false);
    assert.match(result.invalidReason ?? '', /Age proof/);
});
