# Demo script (up to 3 minutes)

Film on a phone, from the live shop page. The loud moment is in the
first 20 seconds.

## 0:00–0:20 — The twin test (the wow)

Open the shop. Tap "Run the twin test".

Two identical agents, same code, same request. One is registered and
badged, the other is not. On screen: Agent A SERVED, Agent B REFUSED.
Say: "The only difference between them is the badge. That is what
Concordium adds."

## 0:20–1:20 — The real purchase

Tap "Buy with my agent". The three-proofs panel ticks up live:

1. Badge — the merchant checks the agent's Verified by Concordium badge.
2. Age 18+ — tap "Approve in my wallet". The wallet shows one request:
   "Shop requests proof you are over 18". Tap approve. The panel ticks.
   Say: "The shop learned one fact, over 18. It saw no name, no birth
   date, no ID."
3. Payment — the agent pays with x402. The fee is sponsored, so the
   agent never needs gas money. The panel ticks. "Sale confirmed."

Point at the panel: "Three proofs, zero personal data."

## 1:20–2:00 — The refusals (part of the product, not errors)

Tap "Replay: unbadged agent". The sale is refused at the badge gate,
with the reason on screen.

Tap "Replay: age declined". The sale is refused at the age gate, with
the reason on screen. No payment is taken in either case.

## 2:00–2:30 — What it is

One flow, end to end. Four Concordium components: Agent Registry and
badge, Verify and Access, x402 payments, sponsored transactions. No
custom smart contract; the trust sits in Concordium's own contracts.

## 2:30–3:00 — Path to production

Mainnet uses the same contracts (CIS-8004 index 10082). On mainnet the
age proof is a real ID check, not a self-attested testnet one. Real
merchants use a regulated identity provider, keep audit records in an
encrypted store, and settle in stablecoins over x402. The audit trail
(VRA/VAA anchors plus the agent's on-chain record) supports EU AI Act
record keeping.
