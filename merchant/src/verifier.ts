/**
 * Age-proof verification.
 *
 * The merchant never handles cryptography itself. A real deployment verifies
 * the buyer's zero-knowledge proof with the Concordium Verifier Service
 * (open-source, self-hosted, Docker container; see verifier/README.md).
 * The gallery example in the official Concordium dapp-examples repo verifies
 * proofs the same way: challenge -> presentation -> cryptographic verify
 * against chain state -> auth token.
 *
 * This module defines the one interface the merchant needs and two
 * implementations:
 * - DemoVerifier: DEMO ONLY. Accepts a proof object that carries
 *   `demoResult: "verified" | "failed"`, so the twin test and the refusal
 *   replays can run end to end without a wallet. It never touches the chain
 *   and must never be used in live mode.
 * - RemoteVerifierService: talks to a deployed Verifier Service over HTTP.
 *   The exact request/response shape of the Verifier Service is NOT in the
 *   plan and was not verified, so this implementation posts the presentation
 *   to VERIFIER_SERVICE_URL and expects `{ "valid": true }` back, and throws
 *   a descriptive error otherwise. Wire it to your Verifier Service
 *   deployment and confirm the shape from its docs before going live.
 *
 * The verifier returns a binary result only. It never sees or stores a
 * name, date of birth, or ID document.
 */

export type ProofInput = {
    /** The 64-hex-char challenge issued for this order. */
    challenge: string;
    /** The verifiable presentation from the buyer's wallet (opaque to us). */
    presentation: unknown;
};

export type VerifyResult = {
    valid: boolean;
    reason?: string;
};

export interface Verifier {
    verifyProof(input: ProofInput): Promise<VerifyResult>;
}

/**
 * DEMO ONLY verifier. Used when DEMO_MODE is on. The proof object is
 * expected to carry `demoResult: "verified" | "failed"`; anything else is
 * refused. This simulates the wallet approve / decline tap so the flow,
 * the refusal states and the UI can be tested without a wallet.
 */
export class DemoVerifier implements Verifier {
    async verifyProof(input: ProofInput): Promise<VerifyResult> {
        const presentation = input.presentation as Record<string, unknown> | null;
        if (!presentation || typeof presentation !== 'object') {
            return { valid: false, reason: 'Demo proof must be an object with demoResult.' };
        }
        if (presentation.demoResult === 'verified') {
            return { valid: true };
        }
        if (presentation.demoResult === 'failed') {
            return { valid: false, reason: 'Buyer declined the proof or is under 18 (demo).' };
        }
        return {
            valid: false,
            reason: 'Demo proof needs demoResult "verified" or "failed".',
        };
    }
}

/**
 * Talks to a deployed Concordium Verifier Service.
 * Shape not verified against a live service: confirm it from the Verifier
 * Service deployment docs before use. Throws when unconfigured.
 */
export class RemoteVerifierService implements Verifier {
    constructor(private readonly url: string) {
        if (!url) {
            throw new Error(
                'VERIFIER_SERVICE_URL is not set. The live age-proof path needs a deployed Concordium Verifier Service.',
            );
        }
    }

    async verifyProof(input: ProofInput): Promise<VerifyResult> {
        let res: Response;
        try {
            res = await fetch(this.url.replace(/\/$/, '') + '/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    challenge: input.challenge,
                    presentation: input.presentation,
                }),
            });
        } catch (err) {
            throw new Error(
                `Verifier Service request failed: ${err instanceof Error ? err.message : String(err)}`,
            );
        }
        if (!res.ok) {
            return { valid: false, reason: `Verifier Service returned HTTP ${res.status}.` };
        }
        const body = (await res.json()) as { valid?: unknown; reason?: unknown };
        return {
            valid: body.valid === true,
            reason: typeof body.reason === 'string' ? body.reason : undefined,
        };
    }
}
