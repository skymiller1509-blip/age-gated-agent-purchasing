/**
 * End-to-end HTTP tests: spawn the real merchant server and drive the
 * whole flow over HTTP — twin test, happy path, and both refusal paths.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 8799;
const BASE = `http://localhost:${PORT}`;
const MERCHANT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

let server: ChildProcess;

async function waitForHealth(): Promise<void> {
    const deadline = Date.now() + 15000;
    for (;;) {
        try {
            const res = await fetch(`${BASE}/api/health`);
            if (res.ok) return;
        } catch {
            // not up yet
        }
        if (Date.now() > deadline) throw new Error('merchant server did not come up');
        await new Promise((r) => setTimeout(r, 200));
    }
}

test.before(async () => {
    server = spawn('node', ['dist/index.js'], {
        cwd: MERCHANT_DIR,
        env: { ...process.env, PORT: String(PORT), DEMO_MODE: 'true' },
        stdio: 'ignore',
    });
    await waitForHealth();
});

test.after(() => {
    server?.kill();
});

async function post(path: string, body: unknown) {
    const res = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json()) as Record<string, any> };
}

test('health reports demo mode and the verified contracts', async () => {
    const res = await fetch(`${BASE}/api/health`);
    const body = (await res.json()) as Record<string, any>;
    assert.equal(body.ok, true);
    assert.equal(body.demoMode, true);
    assert.equal(body.network, 'testnet');
    assert.equal(body.chainId, 'ccd:4221332d34e1694168c2a0c0b3fd0f27');
    assert.equal(body.cis8004.index, 12802);
    assert.equal(body.cis8.index, 12801);
});

test('shop page is served', async () => {
    const res = await fetch(`${BASE}/`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /Three proofs, zero personal data/);
});

test('twin test splits live over HTTP', async () => {
    const { status, json } = await post('/api/twin-test', {});
    assert.equal(status, 200);
    assert.equal(json.split, true);
    assert.equal(json.badged.valid, true);
    assert.equal(json.unbadged.valid, false);
});

test('full happy path over HTTP: badge, age, 402, settle, confirm', async () => {
    const created = await post('/api/orders', { agentTokenAddress: 'JyP9UGK4ajaPRQGJQiDpi' });
    assert.equal(created.status, 200);
    assert.equal(created.json.stage, 'age-pending');
    const orderId = created.json.id as string;

    const challengeRes = await fetch(`${BASE}/api/age/challenge?address=buyer`);
    const { challenge } = (await challengeRes.json()) as { challenge: string };
    const proved = await post('/api/age/prove', {
        orderId,
        challenge,
        presentation: { demoResult: 'verified' },
    });
    assert.equal(proved.status, 200);
    assert.equal(proved.json.order.stage, 'payment-requested');

    const pay = await post(`/api/orders/${orderId}/pay`, {});
    assert.equal(pay.status, 402);
    assert.equal(pay.json.x402Version, 2);
    assert.equal(pay.json.accepts[0].scheme, 'exact');

    const settled = await post(`/api/orders/${orderId}/settle`, {
        paymentPayload: {
            x402Version: 2,
            accepted: pay.json.accepts[0],
            payload: { demo: true },
        },
    });
    assert.equal(settled.status, 200);
    assert.equal(settled.json.stage, 'confirmed');
    assert.match(settled.json.transaction as string, /^demo:/);
});

test('refusal: unbadged agent never reaches the age step', async () => {
    const created = await post('/api/orders', { agentTokenAddress: 'JyP9U6SVHZgayqA5XfHfA' });
    assert.equal(created.json.stage, 'badge-refused');
    const pay = await post(`/api/orders/${created.json.id}/pay`, {});
    assert.equal(pay.status, 409);
});

test('refusal: declined age proof never reaches payment', async () => {
    const created = await post('/api/orders', { agentTokenAddress: 'JyP9UGK4ajaPRQGJQiDpi' });
    const orderId = created.json.id as string;
    const challengeRes = await fetch(`${BASE}/api/age/challenge?address=buyer`);
    const { challenge } = (await challengeRes.json()) as { challenge: string };
    const proved = await post('/api/age/prove', {
        orderId,
        challenge,
        presentation: { demoResult: 'failed' },
    });
    assert.equal(proved.status, 400);
    assert.equal(proved.json.order.stage, 'age-refused');
    const pay = await post(`/api/orders/${orderId}/pay`, {});
    assert.equal(pay.status, 409);
});
