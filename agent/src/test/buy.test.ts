/**
 * Agent buy-flow tests: the agent service drives the merchant end to end
 * in demo mode — happy path, badge refusal, and age refusal.
 * Spawns the real merchant server on a test port.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBuy } from '../buy.js';

const PORT = 8799;
const BASE = `http://localhost:${PORT}`;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const MERCHANT_DIR = join(ROOT, 'merchant');

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

test('agent completes a demo purchase end to end', async () => {
    const outcome = await runBuy({
        merchantUrl: BASE,
        agentTokenAddress: 'JyP9UGK4ajaPRQGJQiDpi',
    });
    assert.equal(outcome.ok, true);
    if (outcome.ok) {
        assert.equal((outcome.order as Record<string, unknown>).stage, 'confirmed');
        assert.match((outcome.order as Record<string, unknown>).transaction as string, /^demo:/);
    }
});

test('agent refuses to buy with an unbadged agent', async () => {
    const outcome = await runBuy({
        merchantUrl: BASE,
        agentTokenAddress: 'JyP9U6SVHZgayqA5XfHfA',
    });
    assert.equal(outcome.ok, false);
    if (!outcome.ok) assert.equal(outcome.stage, 'badge-refused');
});

test('agent stops when the age proof is declined', async () => {
    const outcome = await runBuy({
        merchantUrl: BASE,
        agentTokenAddress: 'JyP9UGK4ajaPRQGJQiDpi',
        demoAge: 'failed',
    });
    assert.equal(outcome.ok, false);
    if (!outcome.ok) assert.equal(outcome.stage, 'age-refused');
});
