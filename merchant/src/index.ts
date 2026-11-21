/**
 * Demo merchant backend (plain node:http, no framework).
 *
 * Serves the demo shop frontend and the merchant API:
 * - GET  /api/health            server + mode + verified contract facts
 * - GET  /api/config            public config for the shop UI
 * - POST /api/twin-test         live badge check on both twin-test agents
 * - POST /api/orders            { agentTokenAddress } -> order + badge gate
 * - GET  /api/orders/:id        order status
 * - GET  /api/age/challenge?address=   -> { challenge }
 * - GET  /api/age/statement            -> the ZK statement the server accepts
 * - POST /api/age/prove        { orderId, challenge, presentation } -> { token }
 * - POST /api/orders/:id/pay   -> HTTP 402 + PaymentRequired (age must be verified)
 * - POST /api/orders/:id/settle { paymentPayload } -> verify + settle -> confirm
 * - POST /facilitator/verify   x402 facilitator endpoint
 * - POST /facilitator/settle   x402 facilitator endpoint
 *
 * The three gates run in order: badge, age, pay. A refusal at any gate is
 * a final order state with a reason, never a crash.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    CHAIN_ID,
    CIS8004,
    CIS8,
    DEMO_MODE,
    EXPLORER_BASE,
    GRPC_ENDPOINT,
    ITEM,
    MERCHANT_PAYTO,
    OUR_AGENT_TOKEN_ADDRESS,
    PORT,
    TWIN_TEST,
} from './config.js';
import { buildAgeStatement, createAgeSessionStore, issueChallenge, isTokenValid, proveAge } from './age.js';
import { DemoVerifier, RemoteVerifierService, type Verifier } from './verifier.js';
import { VERIFIER_SERVICE_URL } from './config.js';
import {
    buildPaymentRequired,
    buildRequirements,
    createFacilitator,
    verifyPayment,
} from './payments.js';
import {
    createOrder,
    createOrderStore,
    markAgeRefused,
    markAgeVerified,
    markConfirmed,
    markPaymentRefused,
    runBadgeGate,
    runTwinTest,
} from './flow.js';
import type { PaymentPayload } from '@x402/core/types';

const WEB_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'web');
const MIME: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
};

const ageStore = createAgeSessionStore();
const orders = createOrderStore();
const statement = buildAgeStatement();
const facilitator = createFacilitator();
const verifier: Verifier = DEMO_MODE
    ? new DemoVerifier()
    : new RemoteVerifierService(VERIFIER_SERVICE_URL);

function sendJson(res: ServerResponse, status: number, body: unknown): void {
    const text = JSON.stringify(body);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
    });
    res.end(text);
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
        size += chunk.length;
        if (size > 64 * 1024) throw new Error('Body too large.');
        chunks.push(chunk as Buffer);
    }
    if (chunks.length === 0) return {};
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
}

async function serveStatic(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let path = url.pathname === '/' ? '/index.html' : url.pathname;
    if (path.includes('..')) return false;
    try {
        const data = await readFile(join(WEB_DIR, path));
        res.writeHead(200, {
            'Content-Type': MIME[extname(path)] ?? 'application/octet-stream',
            'Access-Control-Allow-Origin': '*',
        });
        res.end(data);
        return true;
    } catch {
        return false;
    }
}

const server = createServer(async (req, res) => {
    try {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const path = url.pathname;

        if (req.method === 'GET' && path === '/api/health') {
            sendJson(res, 200, {
                ok: true,
                demoMode: DEMO_MODE,
                network: 'testnet',
                chainId: CHAIN_ID,
                cis8004: { index: CIS8004.index, moduleRef: CIS8004.moduleRef },
                cis8: { index: CIS8.index, moduleRef: CIS8.moduleRef },
                grpc: GRPC_ENDPOINT,
                explorer: EXPLORER_BASE,
                facilitatorMode: facilitator.mode,
            });
            return;
        }

        if (req.method === 'GET' && path === '/api/config') {
            sendJson(res, 200, {
                demoMode: DEMO_MODE,
                network: 'testnet',
                chainId: CHAIN_ID,
                explorer: EXPLORER_BASE,
                item: ITEM,
                merchantPayTo: MERCHANT_PAYTO,
                twinTest: TWIN_TEST,
                ourAgentTokenAddress: OUR_AGENT_TOKEN_ADDRESS || null,
                cis8004: { index: CIS8004.index },
                cis8: { index: CIS8.index },
            });
            return;
        }

        if (req.method === 'POST' && path === '/api/twin-test') {
            const result = await runTwinTest();
            sendJson(res, 200, result);
            return;
        }

        if (req.method === 'POST' && path === '/api/orders') {
            const body = await readJsonBody(req);
            const agentTokenAddress = body.agentTokenAddress;
            if (typeof agentTokenAddress !== 'string' || !agentTokenAddress) {
                sendJson(res, 400, { error: 'agentTokenAddress is required.' });
                return;
            }
            const order = createOrder(orders, agentTokenAddress);
            await runBadgeGate(order);
            sendJson(res, 200, order);
            return;
        }

        const orderMatch = path.match(/^\/api\/orders\/([^/]+)(\/(pay|settle))?$/);
        if (orderMatch) {
            const order = orders.get(orderMatch[1]);
            if (!order) {
                sendJson(res, 404, { error: 'Order not found.' });
                return;
            }
            if (req.method === 'GET' && !orderMatch[2]) {
                sendJson(res, 200, order);
                return;
            }
            if (req.method === 'POST' && orderMatch[3] === 'pay') {
                if (order.stage !== 'payment-requested' || !order.ageToken) {
                    sendJson(res, 409, {
                        error: 'Payment is not available for this order yet.',
                        stage: order.stage,
                        refusalReason: order.refusalReason ?? 'Badge and age checks must pass first.',
                    });
                    return;
                }
                const requirements = buildRequirements();
                sendJson(res, 402, buildPaymentRequired(requirements));
                return;
            }
            if (req.method === 'POST' && orderMatch[3] === 'settle') {
                const body = await readJsonBody(req);
                const payload = body.paymentPayload as PaymentPayload | undefined;
                if (!payload || typeof payload !== 'object') {
                    sendJson(res, 400, { error: 'paymentPayload is required.' });
                    return;
                }
                const requirements = buildRequirements();
                const verified = await verifyPayment(facilitator, {
                    payload,
                    requirements,
                    ageVerified: Boolean(order.ageToken) && order.stage === 'payment-requested',
                });
                if (!verified.isValid) {
                    markPaymentRefused(order, verified.invalidReason ?? 'Payment verification failed.');
                    sendJson(res, 402, { error: verified.invalidReason, order });
                    return;
                }
                const settled = await facilitator.settle(payload, requirements);
                if (!settled.success) {
                    markPaymentRefused(order, settled.errorReason ?? 'Settlement failed.');
                    sendJson(res, 402, { error: settled.errorReason, order });
                    return;
                }
                markConfirmed(order, settled.transaction);
                sendJson(res, 200, order);
                return;
            }
        }

        if (req.method === 'GET' && path === '/api/age/challenge') {
            const address = url.searchParams.get('address');
            if (!address) {
                sendJson(res, 400, { error: 'address query parameter is required.' });
                return;
            }
            sendJson(res, 200, { challenge: issueChallenge(ageStore, address) });
            return;
        }

        if (req.method === 'GET' && path === '/api/age/statement') {
            sendJson(res, 200, { statement });
            return;
        }

        if (req.method === 'POST' && path === '/api/age/prove') {
            const body = await readJsonBody(req);
            const orderId = body.orderId;
            const challenge = body.challenge;
            const presentation = body.presentation;
            if (typeof orderId !== 'string' || typeof challenge !== 'string') {
                sendJson(res, 400, { error: 'orderId and challenge are required.' });
                return;
            }
            const order = orders.get(orderId);
            if (!order) {
                sendJson(res, 404, { error: 'Order not found.' });
                return;
            }
            if (order.stage !== 'age-pending') {
                sendJson(res, 409, { error: 'This order is not waiting for an age proof.', stage: order.stage });
                return;
            }
            const outcome = await proveAge(ageStore, verifier, {
                challenge,
                presentation,
                orderId,
            });
            if (!outcome.ok) {
                markAgeRefused(order, outcome.reason);
                sendJson(res, 400, { error: outcome.reason, order });
                return;
            }
            markAgeVerified(order, outcome.token);
            sendJson(res, 200, { token: outcome.token, order });
            return;
        }

        if (req.method === 'GET' && path === '/api/age/token') {
            const token = url.searchParams.get('token');
            sendJson(res, 200, { valid: typeof token === 'string' && isTokenValid(ageStore, token) });
            return;
        }

        if (req.method === 'POST' && path === '/facilitator/verify') {
            const body = await readJsonBody(req);
            const result = await verifyPayment(facilitator, {
                payload: body.paymentPayload as PaymentPayload,
                requirements: body.paymentRequirements as never,
                ageVerified: true,
            });
            sendJson(res, 200, result);
            return;
        }

        if (req.method === 'POST' && path === '/facilitator/settle') {
            const body = await readJsonBody(req);
            const result = await facilitator.settle(
                body.paymentPayload as PaymentPayload,
                body.paymentRequirements as never,
            );
            sendJson(res, 200, result);
            return;
        }

        if (req.method === 'GET') {
            if (await serveStatic(req, res)) return;
            sendJson(res, 404, { error: 'Not found.' });
            return;
        }

        sendJson(res, 405, { error: 'Method not allowed.' });
    } catch (err) {
        sendJson(res, 500, { error: err instanceof Error ? err.message : 'Internal error.' });
    }
});

server.listen(PORT, () => {
    console.log(`Merchant listening on http://localhost:${PORT} (demo mode: ${DEMO_MODE}, facilitator: ${facilitator.mode})`);
});
