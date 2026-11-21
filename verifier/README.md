# Verifier Service

The merchant never handles cryptography itself. A real deployment verifies
the buyer's zero-knowledge proof with the Concordium Verifier Service:
open-source, self-hosted, distributed as a Docker container. It is the
middleware between the backend and ZKP operations: the backend sends the
user's proof to it, it validates the proof against chain state and returns
Verified or Failed.

## Why this folder has no compose file yet

Docker is NOT available on the build VM, so the Verifier Service cannot
run here. Do not invent an image name or a config for it. When a host
with Docker is available:

1. Find the Verifier Service in the official Concordium docs ("Integrate
   verification flow" under Verify and Access) and the official
   `Concordium/concordium-dapp-examples` repo (`gallery/verifier` shows
   the same flow verified in-process with the Rust SDK: challenge,
   statement, prove, auth token).
2. Run it pointing at the public testnet node `grpc.testnet.concordium.com`
   on port 20000 (the port the environment setup guide and the x402 SDK
   agree on; the Verify and Access guide's mention of 20001 for testnet
   disagrees, so confirm it against the node you connect to).
3. Set `VERIFIER_SERVICE_URL` to its base URL and `DEMO_MODE=false` on
   the merchant. The merchant's `RemoteVerifierService`
   (`merchant/src/verifier.ts`) posts `{ challenge, presentation }` to
   `<VERIFIER_SERVICE_URL>/verify` and expects `{ "valid": true }` back.
   Confirm that exact shape from the Verifier Service deployment docs
   before going live; the shape was not verified against a live service.

## Demo mode

Until then the merchant runs `DemoVerifier` (DEMO_MODE=true, the default).
It accepts a proof object carrying `demoResult: "verified" | "failed"`, so
the twin test and the refusal replays run end to end without a wallet.
It is labelled DEMO everywhere and must never be used in live mode.
