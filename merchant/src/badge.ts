/**
 * Badge check against the official Concordium Agent Registry MCP service.
 *
 * Endpoint (docs, "Use the Agent Registry" guide + MCP service reference):
 *   GET https://agent-registry-mcp.concordium.com/v1/check-badge/{badge}
 * where {badge} is the agent's Base58Check token address. No auth.
 * The rule the docs state: resolve tokenAddress via CIS-8004 agent_of;
 * confirm owner + status is Active + card SHA-256 equals metadata_hash.
 *
 * Live behaviour verified 2026-11-19:
 * - Valid badged agent (testnet token 1300) -> HTTP 200, badge_valid true,
 *   all checks true, issues [].
 * - Revoked agent (testnet token 11) -> HTTP 200, badge_valid false,
 *   status "Revoked".
 * - Registered agent with a dead card (testnet token 0) -> HTTP 200,
 *   badge_valid false (card fetch 404, hash mismatch, no badge).
 * - Malformed address -> HTTP 400 {"error":"bad_request", ...}.
 *
 * A refusal is a normal result, never an exception. Only network failures
 * and unexpected responses throw.
 */
import { MCP_BASE } from './config.js';

export type BadgeCheck = {
    tokenAddress: string;
    /** True only when every check in the service response passed. */
    valid: boolean;
    /** On-chain status, e.g. "Active" or "Revoked". Undefined when unknown. */
    status?: string;
    /** Owner account from the on-chain record, if the service returned one. */
    ownerAccount?: string;
    /** Human-readable reasons when the badge is not valid. */
    issues: string[];
    /** Raw service response, kept for the UI and for debugging. */
    raw: unknown;
};

export async function checkBadge(tokenAddress: string): Promise<BadgeCheck> {
    const url = `${MCP_BASE}/v1/check-badge/${encodeURIComponent(tokenAddress)}`;
    let res: Response;
    try {
        res = await fetch(url, { method: 'GET' });
    } catch (err) {
        throw new Error(`badge check request failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (res.status === 400) {
        let detail = '';
        try {
            const body = (await res.json()) as { message?: string };
            detail = body.message ?? '';
        } catch {
            detail = '';
        }
        return {
            tokenAddress,
            valid: false,
            issues: [detail || 'Address is neither a CIS-8004 badge token address nor a Concordium account address.'],
            raw: { httpStatus: 400, message: detail },
        };
    }

    if (!res.ok) {
        throw new Error(`badge check failed with HTTP ${res.status}`);
    }

    const body = (await res.json()) as Record<string, unknown>;
    const issues: string[] = [];
    const rawIssues = body.issues;
    if (Array.isArray(rawIssues)) {
        for (const issue of rawIssues) {
            if (issue && typeof issue === 'object' && 'message' in issue) {
                issues.push(String((issue as { message: unknown }).message));
            }
        }
    }
    const onChain = (body.on_chain ?? {}) as Record<string, unknown>;
    return {
        tokenAddress,
        valid: body.badge_valid === true,
        status: typeof onChain.status === 'string' ? onChain.status : undefined,
        ownerAccount:
            typeof onChain.owner_account === 'string' ? onChain.owner_account : undefined,
        issues,
        raw: body,
    };
}
