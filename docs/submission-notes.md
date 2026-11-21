# Submission notes

## What was built

Age-Gated Agent Purchasing. An AI shopping agent buys an age-restricted
item for a human, but the sale only goes through after the merchant
checks two things: the agent's Verified by Concordium badge (a verified
human stands behind it) and a zero-knowledge proof that the human is 18+,
without seeing any personal data. The agent pays with x402. If either
check fails, the sale is refused, with the reason on screen.

The demo opens with a twin test: two identical agents, same code, same
request. One is registered and badged, the other is not. The merchant
serves the first and refuses the second, on screen, in seconds.

## Concordium components used

- Agent Registry (CIS-8004) and the Verified by Concordium badge: the
  trust anchor. The merchant checks the badge live via the official
  registry service before anything else.
- Concordium ID / Verify and Access: the over-18 proof. One fact, binary
  yes/no, no personal data stored. Verification against the account
  (Option 2), the docs' recommended method when a payment follows.
- x402 payments (exact scheme, native CCD): the agent pays on its own
  inside a normal HTTP request/response, HTTP 402 plus the X-PAYMENT
  header.
- Sponsored transactions (Protocol 10): the facilitator pays the fee, so
  the agent never needs CCD for gas.
- No custom smart contract. Registration is a call to the existing
  CIS-8004 contract; the age proof is off-chain ZKP plus VRA/VAA anchors;
  payment is a plain CCD transfer via x402.

## Verified facts (all checked live 2026-11-19)

- Testnet CIS-8004 index 12802, CIS-8 index 12801 (official MCP service
  `contract_info`). Chain id `ccd:4221332d34e1694168c2a0c0b3fd0f27`.
- Badge check verified live: a valid badged agent (testnet token 1300)
  passes all 15 checks; a revoked agent (token 11) is refused; a
  registered agent with a dead card (token 0) is refused.
- Testnet gRPC `grpc.testnet.concordium.com:20000`; explorer
  `https://ccdexplorer.io/testnet` (both from the @x402/concordium SDK's
  own network table).

## Honest limits

- This entry builds a purpose-built demo agent. The brief says "take an
  AI agent you already run"; the builder does not run one. Stated plainly.
- Testnet identities are issued without verification. The demo proves the
  flow end to end, but the age attribute on testnet is self-attested, not
  a real ID check.
- In demo mode the age proof and the payment are simulated (labelled DEMO
  everywhere). The badge check is always live. Live mode needs a deployed
  Verifier Service and a sponsor key; see verifier/README.md.

## Path to production

Mainnet: same contracts at the mainnet addresses (CIS-8004 index 10082,
CIS-8 index 10081). Registration on mainnet needs a real verified
identity, so the age proof becomes a real check. Real merchants use a
regulated identity provider, keep VARs in an encrypted audited store, run
the Verifier Service in their own VPC, and hold the backend signing key in
KMS/HSM or an MPC wallet service. Payments move to Protocol-Level Tokens
(stablecoins such as EURR/USDR) settled over x402. The audit trail
supports EU AI Act record keeping (Article 12).
