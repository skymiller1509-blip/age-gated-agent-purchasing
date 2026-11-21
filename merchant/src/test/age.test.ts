/**
 * Age-proof session tests: the statement, the challenge, the prove step,
 * and the VAR record (metadata only, no personal data).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    buildAgeStatement,
    createAgeSessionStore,
    issueChallenge,
    proveAge,
} from '../age.js';
import { DemoVerifier } from '../verifier.js';

const VAR_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'var-store', 'var.jsonl');

test('statement proves over-18 with a date-of-birth range', () => {
    const statement = buildAgeStatement() as Array<{
        statement: Array<{ type: string; attributeTag: string; lower: string; upper: string }>;
    }>;
    assert.ok(Array.isArray(statement));
    assert.equal(statement.length, 1);
    const range = statement[0].statement[0];
    assert.equal(range.type, 'AttributeInRange');
    assert.equal(range.attributeTag, 'dob');
    assert.equal(range.lower, '18000101');
    // Upper bound is 18 years ago (plus the SDK's one-day buffer).
    assert.match(range.upper, /^2008\d{4}$/);
    // The statement JSON-round-trips: it is what the API serves.
    assert.deepEqual(JSON.parse(JSON.stringify(statement)), statement);
});

test('challenges are unique 64-hex-char strings', () => {
    const store = createAgeSessionStore();
    const a = issueChallenge(store, '3dt3UMPzRASZndjmKpSWgCP2HhmoxZrgs8FDPtZjNHZzj13hhB');
    const b = issueChallenge(store, '3dt3UMPzRASZndjmKpSWgCP2HhmoxZrgs8FDPtZjNHZzj13hhB');
    assert.match(a, /^[0-9a-f]{64}$/);
    assert.notEqual(a, b);
});

test('prove accepts a verified demo proof and issues a token', async () => {
    const store = createAgeSessionStore();
    const challenge = issueChallenge(store, 'buyer');
    const outcome = await proveAge(store, new DemoVerifier(), {
        challenge,
        presentation: { demoResult: 'verified' },
        orderId: 'order-test-1',
    });
    assert.equal(outcome.ok, true);
    if (outcome.ok) assert.match(outcome.token, /^[0-9a-f-]{36}$/);
});

test('prove refuses a failed demo proof', async () => {
    const store = createAgeSessionStore();
    const challenge = issueChallenge(store, 'buyer');
    const outcome = await proveAge(store, new DemoVerifier(), {
        challenge,
        presentation: { demoResult: 'failed' },
        orderId: 'order-test-2',
    });
    assert.equal(outcome.ok, false);
});

test('prove refuses an unknown challenge', async () => {
    const store = createAgeSessionStore();
    const outcome = await proveAge(store, new DemoVerifier(), {
        challenge: '0'.repeat(64),
        presentation: { demoResult: 'verified' },
        orderId: 'order-test-3',
    });
    assert.equal(outcome.ok, false);
});

test('VAR record holds metadata only, no personal data', async () => {
    const store = createAgeSessionStore();
    const challenge = issueChallenge(store, 'buyer');
    await proveAge(store, new DemoVerifier(), {
        challenge,
        presentation: { demoResult: 'verified' },
        orderId: 'order-var-check',
    });
    const lines = (await readFile(VAR_FILE, 'utf8')).trim().split('\n');
    const last = JSON.parse(lines[lines.length - 1]) as Record<string, unknown>;
    assert.deepEqual(Object.keys(last).sort(), [
        'challenge',
        'network',
        'orderId',
        'result',
        'type',
        'verifiedAt',
    ]);
    assert.equal(last.orderId, 'order-var-check');
    assert.equal(last.result, 'verified');
});
