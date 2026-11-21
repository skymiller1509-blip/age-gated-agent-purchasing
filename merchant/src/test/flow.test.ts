/**
 * Order-flow tests: the badge gate and the twin test, both live.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createOrder,
    createOrderStore,
    runBadgeGate,
    runTwinTest,
} from '../flow.js';

test('badged agent passes the badge gate', async () => {
    const store = createOrderStore();
    const order = createOrder(store, 'JyP9UGK4ajaPRQGJQiDpi');
    await runBadgeGate(order);
    assert.equal(order.stage, 'age-pending');
    assert.equal(order.badge?.valid, true);
});

test('revoked agent is refused at the badge gate', async () => {
    const store = createOrderStore();
    const order = createOrder(store, 'JyP9U6SVHZgayqA5XfHfA');
    await runBadgeGate(order);
    assert.equal(order.stage, 'badge-refused');
    assert.ok(order.refusalReason && order.refusalReason.length > 0);
});

test('twin test splits: badged served, unbadged refused', async () => {
    const result = await runTwinTest();
    assert.equal(result.badged.valid, true);
    assert.equal(result.unbadged.valid, false);
    assert.equal(result.split, true);
});
