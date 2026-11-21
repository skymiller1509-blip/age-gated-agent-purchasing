/**
 * Static checks on the demo shop page: the twin test, the three-proofs
 * panel, both refusal states, and the demo-mode banner must all be there.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PAGE = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '..',
    'web',
    'index.html',
);

test('shop page has the twin test, proofs panel and refusal states', async () => {
    const html = await readFile(PAGE, 'utf8');
    assert.match(html, /twin test/i);
    assert.match(html, /Three proofs, zero personal data/);
    assert.match(html, /Personal data seen/);
    assert.match(html, /Sale refused/);
    assert.match(html, /Sale confirmed/);
    assert.match(html, /DEMO MODE/);
    assert.match(html, /Approve in my wallet/);
    assert.match(html, /Simulate approval \(demo\)/);
    assert.match(html, /requestVerifiablePresentation/);
});
