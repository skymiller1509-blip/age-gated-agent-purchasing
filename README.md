# Age-Gated Agent Purchasing

**Agents need ID too.**

**31/31 tests pass. Badge check verified live: a badged agent passes all 15 checks, a revoked one is refused.**

> **Demo video:** TODO — not filmed yet. See `VIDEO-SCRIPT.md` for the script (up to 3 minutes, film on the phone from the live shop).
>
> **Submission:** [Concordium Trusted Agents Hackathon](https://www.encodeclub.com/programmes/concordium-trusted-agents-hackathon) (Encode Club). Checkpoint 1: 22 Nov 2026 (done). Final submissions: 9 Dec 2026, 23:59 UTC.
>
> **Code:** https://github.com/skymiller1509-blip/age-gated-agent-purchasing (public, published 2026-11-21).

An AI shopping agent buys an age-restricted item
for a human, but the sale only goes through after the merchant checks two
things: the agent's Verified by Concordium badge (a verified human stands
behind it) and a zero-knowledge proof that the human is 18+, without
seeing any personal data. The agent pays with x402. If either check
fails, the sale is refused, with the reason on screen.

Built solo at the Encode Club Concordium Trusted Agents Hackathon, Nov–Dec 2026.

## Hackathon Requirements Met

Concordium Trusted Agents Hackathon (Encode Club), final submissions 9 Dec 2026, 23:59 UTC. Each requirement, with proof:

- [x] Checkpoint 1 done (22 Nov 2026): Encode Club registered, project created.
- [x] Code published: https://github.com/skymiller1509-blip/age-gated-agent-purchasing (public, 34 files, 21 Nov 2026).
- [x] Badge check verified live against the official registry: valid badged agent (testnet token 1300) passes all 15 checks; revoked agent (token 11) refused; registered agent with a dead card (token 0) refused; malformed address is a 400.
- [x] Demo script written (`docs/demo-script.md`) and video script written (`VIDEO-SCRIPT.md`, hook-first, up to 3 min).
- [ ] Agent registered with the builder's wallet — `build_agent_card` → host the card → `build_register` → sign → `verify_agent_card` → set the payment wallet (Eddie's step). Then set `OUR_AGENT_TOKEN_ADDRESS`.
- [ ] Buyer-side age-proof tap on the phone (Concordium ID app) for the live path (Eddie's step).
- [ ] Reown Project ID for the phone deep-link flow (Eddie's step).
- [ ] Demo video filmed on the phone from the live shop (Eddie's step).
- [ ] Final submission on Encode Club: description, public repo link, demo video link, CCDExplorer link, path to production (Eddie's step).

Demo failure-proofing: the badge check is live against the official registry service; the age proof and the payment are simulated and labelled DEMO in demo mode, so the whole flow runs end to end without a wallet. The video is filmed from the live shop, not from slides.

## Judging Highlights

- **Innovation:** the twin test — two identical agents, same code, same request, same balance. One is registered and carries the badge; the other is not. The merchant serves the first and refuses the second, on screen, in seconds.
- **Technical execution:** live badge check against the real Concordium registry (CIS-8004 index 12802, testnet); x402 exact-scheme payments with sponsored transactions (Protocol 10); zero-knowledge age proof that reveals one fact (18+) and no personal data; 31/31 tests pass.
- **Impact:** agents need ID too — a verified human behind the agent, and age-gated sales that work without the merchant ever seeing personal data.
- **Completeness:** the full flow runs end to end in demo mode (badge → age proof → 402 → pay → settle), with refusal paths built in and honest limits stated below.

## The demo makes the invisible visible

It opens with a **twin test**: two identical agents, same code, same
request, same balance. One is registered and carries the badge; the
other is not. The merchant serves the first and refuses the second, on
screen, in seconds. Then the real purchase runs under a **"Three proofs,
zero personal data"** panel: Badge yes, Age 18+ yes, Payment yes,
Personal data seen: none.

## One flow, end to end

```
buyer asks to buy → merchant checks the agent's badge (live)
  → buyer proves 18+ in their wallet (ZKP, one fact, binary yes/no)
  → merchant answers HTTP 402 with the price
  → agent pays with x402 (fee sponsored, no gas needed)
  → merchant verifies and settles → sale confirmed
```

Refusal is part of the product: an unbadged agent is refused at the
badge gate, a declined proof is refused at the age gate, and no payment
is taken in either case.

## Tech stack

- Node/TypeScript agent service (x402 exact scheme) + demo merchant backend (badge check, age proof, 402, facilitator) + static demo shop frontend
- Concordium: Agent Registry CIS-8004 badge (live check via the official registry service), Verify and Access ZKP age proof, x402 payments, sponsored transactions (Protocol 10). No custom smart contract.

## Try it yourself

```bash
npm install
npm run build
# terminal 1: the merchant (shop + API) on http://localhost:8787
npm run start:merchant
# terminal 2: the agent service on http://localhost:8788
npm run buy --workspace=agent
# open http://localhost:8787 in a browser
```

Or run the agent as a one-off buy:

```bash
node agent/dist/index.js buy --merchant http://localhost:8787
```

## Demo mode vs live mode

By default the merchant runs in **DEMO_MODE**: the badge check is live
(real REST calls to the official registry service), while the age proof
and the payment are simulated and labelled DEMO, so the whole flow runs
end to end without a wallet. Set `DEMO_MODE=false` and configure
`SPONSOR_ADDRESS` / `SPONSOR_PRIVATE_KEY` and `VERIFIER_SERVICE_URL`
for the live path. See `verifier/README.md` for the Verifier Service.

## Layout

```
agent/      shopping agent service (Node/TypeScript, x402 exact scheme)
merchant/   demo merchant backend (badge check, age proof, 402, facilitator)
verifier/   notes on the Concordium Verifier Service (Docker not on this VM)
web/        demo shop frontend (static; twin test, three-proofs panel)
docs/       demo script + submission notes
```

No `contracts/` folder: no custom smart contract is needed. Registration
is a call to the existing CIS-8004 contract; the age proof is off-chain
ZKP plus VRA/VAA anchors; payment is a plain CCD transfer via x402.

## Verified facts (checked live 2026-11-19)

- Testnet CIS-8004 index **12802**, CIS-8 index **12801** (official MCP
  service `contract_info`); chain id `ccd:4221332d34e1694168c2a0c0b3fd0f27`.
- Badge check verified live: valid badged agent (testnet token 1300)
  passes all 15 checks; revoked agent (token 11) is refused; registered
  agent with a dead card (token 0) is refused; malformed address is a 400.
- Testnet gRPC `grpc.testnet.concordium.com:20000`; explorer
  `https://ccdexplorer.io/testnet` (from the @x402/concordium SDK's own
  network table, which also resolves the docs' 20000 vs 20001 question
  in favour of 20000).
- Age statement built with the documented `@concordium/web-sdk` call
  `Web3StatementBuilder.addMinimumAge(18)` (the BeerStore example's TODO,
  fixed in the current SDK).

## Honest limits

- This entry builds a purpose-built demo agent. The brief says "take an
  AI agent you already run"; the builder does not run one.
- Testnet identities are issued without verification. The demo proves the
  flow end to end, but the age attribute on testnet is self-attested.
- No official public Concordium testnet x402 facilitator exists, so the
  merchant runs its own facilitator with the SDK's facilitator role.
- The Verifier Service needs a Docker host; Docker is not available on
  this VM, so the live age-proof path is wired as a clean, swappable
  module (`merchant/src/verifier.ts`) and is not running here.
- The twin test uses two public testnet agents as stand-ins (token 1300
  badged, token 11 revoked) until our own agent is registered.

## Still needs Eddie (not done here)

- Register the agent (needs his wallet): `build_agent_card` -> host the
  card -> `build_register` -> sign -> `verify_agent_card` -> set the
  payment wallet. Then set `OUR_AGENT_TOKEN_ADDRESS`.
- The buyer-side age-proof tap on his phone (Concordium ID app).
- A Reown Project ID for the phone deep-link flow.
- The demo video, filmed on his phone from the live shop.
