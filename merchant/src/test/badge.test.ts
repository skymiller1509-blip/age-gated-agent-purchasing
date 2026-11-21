/**
 * Live badge-check tests against the official registry service.
 * These hit the network. They verify the exact behaviour the merchant
 * relies on: a valid badged agent passes, a revoked one is refused, a
 * registered agent with a dead card is refused, a malformed address is a 400.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBadge } from '../badge.js';

const BADGED = 'JyP9UGK4ajaPRQGJQiDpi'; // testnet token 1300, Active
const REVOKED = 'JyP9U6SVHZgayqA5XfHfA'; // testnet token 11, Revoked
const DEAD_CARD = 'JyP9TtQC3HCNrTYR3sc2T'; // testnet token 0, Active but card 404

test('valid badged agent passes every check', async () => {
    const result = await checkBadge(BADGED);
    assert.equal(result.valid, true);
    assert.equal(result.status, 'Active');
    assert.deepEqual(result.issues, []);
});

test('revoked agent is refused with a reason', async () => {
    const result = await checkBadge(REVOKED);
    assert.equal(result.valid, false);
    assert.equal(result.status, 'Revoked');
    assert.ok(result.issues.length > 0);
    assert.match(result.issues[0], /not Active/i);
});

test('registered agent with a dead card is refused', async () => {
    const result = await checkBadge(DEAD_CARD);
    assert.equal(result.valid, false);
    assert.equal(result.status, 'Active');
    assert.ok(result.issues.some((i) => /card/i.test(i)));
});

test('malformed address is refused, not an exception', async () => {
    const result = await checkBadge('not-an-address');
    assert.equal(result.valid, false);
    assert.ok(result.issues.length > 0);
});
