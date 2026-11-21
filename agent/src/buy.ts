/**
 * The agent-side buy flow, against a merchant base URL.
 *
 * Steps (the agent only moves after the merchant's gates pass):
 * 1. Create the order (or reuse an existing order id). The merchant runs
 *    the badge gate; a refused badge ends the buy here with a reason.
 * 2. Age: in demo mode the agent simulates the buyer's wallet tap by
 *    posting a demo presentation to the merchant's prove endpoint.
 *    In live mode the buyer proves in their own wallet (shop page) and the
 *    agent is given the order id after the proof; the agent never sees or
 *    handles the proof itself.
 * 3. Ask for payment: POST /pay. The merchant answers HTTP 402 with the
 *    PaymentRequired body when badge + age have passed.
 * 4. Build the x402 payment payload (live SDK signing, or demo mock).
 * 5. Settle: POST /settle with the payload in the body and in the
 *    X-PAYMENT header (base64 JSON, per the x402 spec).
 */
import { AGENT_TOKEN_ADDRESS, DEMO_MODE, MERCHANT_URL } from './config.js';
import { createPaymentPayload, encodeXPayment, hasLiveKey } from './x402pay.js';
import type { PaymentRequired } from '@x402/core/types';

export type BuyOutcome =
    | { ok: true; order: Record<string, unknown> }
    | { ok: false; stage: string; reason: string };

type OrderJson = Record<string, unknown> & { id: string; stage: string };

async function postJson(url: string, body: unknown, extraHeaders: Record<string, string> = {}) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
        body: JSON.stringify(body),
    });
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
        json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
        json = { raw: text };
    }
    return { status: res.status, json };
}

async function getJson(url: string) {
    const res = await fetch(url);
    return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

export async function runBuy(opts: {
    merchantUrl?: string;
    agentTokenAddress?: string;
    orderId?: string;
    demoAge?: 'verified' | 'failed';
}): Promise<BuyOutcome> {
    const base = (opts.merchantUrl ?? MERCHANT_URL).replace(/\/$/, '');
    const agentTokenAddress = opts.agentTokenAddress ?? AGENT_TOKEN_ADDRESS;

    let order: OrderJson;
    if (opts.orderId) {
        const got = await getJson(`${base}/api/orders/${opts.orderId}`);
        if (got.status !== 200) return { ok: false, stage: 'unknown', reason: 'Order not found.' };
        order = got.json as OrderJson;
    } else {
        const created = await postJson(`${base}/api/orders`, { agentTokenAddress });
        if (created.status !== 200) {
            return { ok: false, stage: 'unknown', reason: String(created.json.error ?? 'Order failed.') };
        }
        order = created.json as OrderJson;
    }

    if (order.stage === 'badge-refused') {
        return {
            ok: false,
            stage: 'badge-refused',
            reason: String(order.refusalReason ?? 'Agent badge check failed.'),
        };
    }

    // Gate 2: age proof.
    if (order.stage === 'age-pending') {
        if (!DEMO_MODE) {
            return {
                ok: false,
                stage: 'age-pending',
                reason:
                    'Live mode: the buyer must prove their age in their own wallet first (shop page), then run the agent with the order id.',
            };
        }
        const challengeRes = await getJson(
            `${base}/api/age/challenge?address=${encodeURIComponent(agentTokenAddress)}`,
        );
        const challenge = String(challengeRes.json.challenge ?? '');
        const proved = await postJson(`${base}/api/age/prove`, {
            orderId: order.id,
            challenge,
            presentation: { demoResult: opts.demoAge ?? 'verified' },
        });
        if (proved.status !== 200) {
            return {
                ok: false,
                stage: 'age-refused',
                reason: String(proved.json.error ?? 'Age proof failed.'),
            };
        }
        order = proved.json.order as OrderJson;
    }

    if (order.stage !== 'payment-requested') {
        return { ok: false, stage: order.stage, reason: 'Order is not ready for payment.' };
    }

    // Gate 3: payment. The merchant answers 402 with the quote.
    const payRes = await postJson(`${base}/api/orders/${order.id}/pay`, {});
    if (payRes.status !== 402) {
        return {
            ok: false,
            stage: order.stage,
            reason: String(payRes.json.error ?? `Expected HTTP 402, got ${payRes.status}.`),
        };
    }
    const required = payRes.json as unknown as PaymentRequired;
    const requirements = required.accepts?.[0];
    if (!requirements) {
        return { ok: false, stage: 'payment-requested', reason: '402 response has no payment requirements.' };
    }

    const paymentPayload = await createPaymentPayload(requirements);
    const settled = await postJson(
        `${base}/api/orders/${order.id}/settle`,
        { paymentPayload },
        { 'X-PAYMENT': encodeXPayment(paymentPayload) },
    );
    if (settled.status !== 200) {
        return {
            ok: false,
            stage: 'payment-refused',
            reason: String(settled.json.error ?? 'Settlement failed.'),
        };
    }
    return { ok: true, order: settled.json as Record<string, unknown> };
}

export function describeMode(): string {
    return DEMO_MODE
        ? 'demo mode (simulated age proof and payment; badge check is live)'
        : hasLiveKey()
          ? 'live mode (real x402 signing)'
          : 'live mode requested but no CCD key configured';
}
