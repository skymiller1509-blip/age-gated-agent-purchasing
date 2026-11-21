/**
 * Verification Audit Record (VAR) store.
 *
 * The VAR holds metadata only, never personal data: order id, challenge,
 * result, timestamp, network. No name, no date of birth, no ID document,
 * no credential. If the VAR is lost, the merchant loses the ability to
 * prove a verification to a regulator even though the proof exists
 * on-chain, so the demo keeps VARs in a small local file store.
 *
 * In production this belongs in an encrypted, audited database. For the
 * hackathon demo a JSON-lines file is enough, and it is gitignored.
 */
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type VarRecord = {
    type: 'var';
    orderId: string;
    challenge: string;
    result: 'verified' | 'failed';
    verifiedAt: string;
    network: 'testnet';
};

const VAR_FILE = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'var-store',
    'var.jsonl',
);

export async function writeVar(record: VarRecord): Promise<void> {
    await mkdir(dirname(VAR_FILE), { recursive: true });
    await appendFile(VAR_FILE, JSON.stringify(record) + '\n', 'utf8');
}
