/**
 * Shopping agent service.
 *
 * Two ways to run it:
 * - Service: `node dist/index.js` starts an HTTP server on AGENT_PORT
 *   (default 8788) with POST /buy { merchantUrl?, agentTokenAddress?,
 *   orderId?, demoAge? }.
 * - CLI: `node dist/index.js buy [--merchant URL] [--agent-token ADDR]
 *   [--order-id ID] [--demo-age verified|failed]`
 *
 * The agent never holds buyer data. It only carries the buy instruction
 * and the payment. The merchant enforces the badge and age gates.
 */
import { createServer } from 'node:http';
import { AGENT_PORT, AGENT_TOKEN_ADDRESS, MERCHANT_URL } from './config.js';
import { describeMode, runBuy } from './buy.js';

function parseArgs(argv: string[]): Record<string, string> {
    const out: Record<string, string> = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
            out[key] = argv[i + 1] ?? '';
            i++;
        }
    }
    return out;
}

async function main(): Promise<void> {
    const [command, ...rest] = process.argv.slice(2);

    if (command === 'buy') {
        const args = parseArgs(rest);
        const outcome = await runBuy({
            merchantUrl: args.merchant,
            agentTokenAddress: args.agentToken,
            orderId: args.orderId,
            demoAge: args.demoAge === 'failed' ? 'failed' : 'verified',
        });
        if (outcome.ok) {
            console.log('Sale confirmed.');
            console.log(JSON.stringify(outcome.order, null, 2));
        } else {
            console.log(`Sale refused at ${outcome.stage}: ${outcome.reason}`);
            process.exitCode = 1;
        }
        return;
    }

    if (command && command !== 'serve') {
        console.log('Usage:');
        console.log('  node dist/index.js            start the agent service');
        console.log('  node dist/index.js buy [--merchant URL] [--agent-token ADDR] [--order-id ID] [--demo-age verified|failed]');
        process.exitCode = 2;
        return;
    }

    const server = createServer(async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        try {
            if (req.method === 'GET' && req.url === '/health') {
                res.writeHead(200);
                res.end(JSON.stringify({ ok: true, mode: describeMode(), merchantUrl: MERCHANT_URL }));
                return;
            }
            if (req.method === 'POST' && req.url === '/buy') {
                const chunks: Buffer[] = [];
                for await (const chunk of req) chunks.push(chunk as Buffer);
                const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as Record<string, unknown>;
                const outcome = await runBuy({
                    merchantUrl: typeof body.merchantUrl === 'string' ? body.merchantUrl : undefined,
                    agentTokenAddress:
                        typeof body.agentTokenAddress === 'string' ? body.agentTokenAddress : AGENT_TOKEN_ADDRESS,
                    orderId: typeof body.orderId === 'string' ? body.orderId : undefined,
                    demoAge: body.demoAge === 'failed' ? 'failed' : 'verified',
                });
                res.writeHead(outcome.ok ? 200 : 409);
                res.end(JSON.stringify(outcome));
                return;
            }
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Not found.' }));
        } catch (err) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error.' }));
        }
    });

    server.listen(AGENT_PORT, () => {
        console.log(`Agent listening on http://localhost:${AGENT_PORT} (${describeMode()})`);
    });
}

main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
});
