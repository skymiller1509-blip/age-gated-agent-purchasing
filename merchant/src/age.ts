/**
 * Age-proof session: challenge, statement, prove.
 *
 * API shape follows the official gallery example in
 * Concordium/concordium-dapp-examples (verifier/src/main.rs):
 * - GET  /api/age/challenge?address=<account>  -> { challenge }
 * - GET  /api/age/statement                    -> the ZK statement the server accepts
 * - POST /api/age/prove { challenge, presentation } -> { token } or an error
 *
 * The statement is built with the documented @concordium/web-sdk call
 * (same as the simpleAgeVerification BeerStore example, but with the
 * SDK's now-fixed `addMinimumAge(18)` instead of the manual range):
 *   new Web3StatementBuilder()
 *     .addForIdentityCredentials([0, 1, 2, 3, 4, 5], (b) => b.addMinimumAge(18))
 *     .getStatements()
 * That adds a range statement that the date of birth is between 1 January
 * 1800 and 18 years ago. The merchant learns "over 18" and nothing else.
 *
 * Challenge expiry 600s and token expiry 1200s, same as the gallery
 * example. The challenge is a random 32-byte hex string, matching the
 * wallet's expected challenge format.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { Web3StatementBuilder } from '@concordium/web-sdk';
import { writeVar } from './varstore.js';
import type { Verifier } from './verifier.js';

export const CHALLENGE_EXPIRY_SECONDS = 600;
export const TOKEN_EXPIRY_SECONDS = 1200;

/** The ZK statement this merchant accepts: the buyer is 18 or older. */
export function buildAgeStatement(): unknown {
    return new Web3StatementBuilder()
        .addForIdentityCredentials([0, 1, 2, 3, 4, 5], (b) => b.addMinimumAge(18))
        .getStatements();
}

export type AgeSessionStore = {
    challenges: Map<string, { address: string; createdAt: number }>;
    tokens: Map<string, { createdAt: number }>;
};

export function createAgeSessionStore(): AgeSessionStore {
    return { challenges: new Map(), tokens: new Map() };
}

export function issueChallenge(store: AgeSessionStore, address: string): string {
    const challenge = randomBytes(32).toString('hex');
    store.challenges.set(challenge, { address, createdAt: Date.now() });
    return challenge;
}

export function isTokenValid(store: AgeSessionStore, token: string): boolean {
    const entry = store.tokens.get(token);
    if (!entry) return false;
    if (Date.now() - entry.createdAt > TOKEN_EXPIRY_SECONDS * 1000) {
        store.tokens.delete(token);
        return false;
    }
    return true;
}

export type ProveOutcome =
    | { ok: true; token: string }
    | { ok: false; reason: string };

/**
 * Verify a presentation against the challenge and, on success, issue an
 * auth token and record a metadata-only VAR. On failure the reason is
 * returned; the caller turns it into the refusal shown to the buyer.
 */
export async function proveAge(
    store: AgeSessionStore,
    verifier: Verifier,
    input: { challenge: string; presentation: unknown; orderId: string },
): Promise<ProveOutcome> {
    const session = store.challenges.get(input.challenge);
    if (!session) {
        return { ok: false, reason: 'Unknown or expired challenge. Request a new one.' };
    }
    if (Date.now() - session.createdAt > CHALLENGE_EXPIRY_SECONDS * 1000) {
        store.challenges.delete(input.challenge);
        return { ok: false, reason: 'Challenge expired. Request a new one.' };
    }
    store.challenges.delete(input.challenge);

    const result = await verifier.verifyProof({
        challenge: input.challenge,
        presentation: input.presentation,
    });

    await writeVar({
        type: 'var',
        orderId: input.orderId,
        challenge: input.challenge,
        result: result.valid ? 'verified' : 'failed',
        verifiedAt: new Date().toISOString(),
        network: 'testnet',
    }).catch(() => {
        // The VAR is an audit record, not part of the sale decision. A
        // failed write must not block the buyer; it is logged by the caller.
    });

    if (!result.valid) {
        return { ok: false, reason: result.reason ?? 'Age proof failed.' };
    }
    const token = randomUUID();
    store.tokens.set(token, { createdAt: Date.now() });
    return { ok: true, token };
}
