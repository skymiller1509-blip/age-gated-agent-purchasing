/**
 * Order flow: the three gates in order — badge, age, pay.
 *
 * Stages: created -> badge-checked -> age-verified -> payment-requested
 * (402) -> paid -> confirmed, with refusal at any gate.
 * A refusal is a final state with a reason, not an error. The merchant
 * never takes payment before the badge and the age proof both pass.
 */
import { randomUUID } from 'node:crypto';
import { checkBadge, type BadgeCheck } from './badge.js';
import { TWIN_TEST } from './config.js';

export type OrderStage =
    | 'created'
    | 'badge-refused'
    | 'age-pending'
    | 'age-refused'
    | 'payment-requested'
    | 'payment-refused'
    | 'confirmed';

export type Order = {
    id: string;
    agentTokenAddress: string;
    stage: OrderStage;
    badge?: BadgeCheck;
    ageToken?: string;
    refusalReason?: string;
    transaction?: string;
    createdAt: string;
};

export type OrderStore = Map<string, Order>;

export function createOrderStore(): OrderStore {
    return new Map();
}

export function createOrder(store: OrderStore, agentTokenAddress: string): Order {
    const order: Order = {
        id: randomUUID(),
        agentTokenAddress,
        stage: 'created',
        createdAt: new Date().toISOString(),
    };
    store.set(order.id, order);
    return order;
}

/** Gate 1: the merchant checks the agent's badge (live REST call). */
export async function runBadgeGate(order: Order): Promise<Order> {
    const badge = await checkBadge(order.agentTokenAddress);
    order.badge = badge;
    if (!badge.valid) {
        order.stage = 'badge-refused';
        order.refusalReason =
            badge.issues[0] ??
            'Agent badge check failed. The merchant cannot verify a human stands behind this agent.';
    } else {
        order.stage = 'age-pending';
    }
    return order;
}

/** Gate 2 result: the age proof passed, the order may proceed to payment. */
export function markAgeVerified(order: Order, ageToken: string): Order {
    order.ageToken = ageToken;
    order.stage = 'payment-requested';
    return order;
}

/** Gate 2 result: the age proof failed or was declined. */
export function markAgeRefused(order: Order, reason: string): Order {
    order.stage = 'age-refused';
    order.refusalReason = reason;
    return order;
}

/** Gate 3 result: the facilitator refused the payment. */
export function markPaymentRefused(order: Order, reason: string): Order {
    order.stage = 'payment-refused';
    order.refusalReason = reason;
    return order;
}

/** Gate 3 result: payment settled, the sale is confirmed. */
export function markConfirmed(order: Order, transaction: string): Order {
    order.stage = 'confirmed';
    order.transaction = transaction;
    return order;
}

export type TwinTestResult = {
    /** The badged side. Expected to pass. */
    badged: BadgeCheck;
    /** The unbadged side. Expected to fail. */
    unbadged: BadgeCheck;
    /** True when the two sides differ exactly as the demo promises. */
    split: boolean;
};

/**
 * The twin test: two identical buy requests side by side, from two agents
 * with the same code and the same balance. One carries a valid badge, the
 * other does not. Both badge checks run live against the registry.
 * The only difference between the two is the badge.
 */
export async function runTwinTest(): Promise<TwinTestResult> {
    const [badged, unbadged] = await Promise.all([
        checkBadge(TWIN_TEST.badged),
        checkBadge(TWIN_TEST.unbadged),
    ]);
    return { badged, unbadged, split: badged.valid && !unbadged.valid };
}
