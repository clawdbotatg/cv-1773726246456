# IntentTip V1 — Build Plan

## Overview
On-chain bounty tipping protocol. Users deposit CLAWD tips with verifiable criteria. Oracle resolves winner and pushes payout. 4.5% burn + 0.5% creator fee. 30-day refund guarantee.

## Smart Contract: TipJar.sol
- Struct Tip: tipId, tipper, amount (net), mode (AutoSend|RequireApproval), status (Open|Matched|Released|Refunded), matchedRecipient, expiry, rejectionUsed
- Immutable: clawdToken (0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07), burnAddress (0xdead), creatorWallet (0xC99F74bC7c065d8c51BD724Da898d44F775a8a19)
- Fee split: 95% winner, 4.5% burn, 0.5% creator (dust to creator)
- AccessControl: DEFAULT_ADMIN_ROLE → client, ORACLE_ROLE → oracle hot wallet
- Functions: createTip, resolveTipPush, approveAndRelease, rejectMatch, reclaimTip
- Security: ReentrancyGuard, SafeERC20, CEI, all config immutable, no pause/upgrade

## Frontend (SE2 Next.js)
- / Live Feed: real-time tip events, stats bar
- /create: step-by-step tip creation with fee breakdown
- /manage: tipper dashboard (approve/reject/reclaim)
- Three-button flow, USD values, Address components, DaisyUI theming

## Oracle (Node.js skeleton)
- Polls TipCreated events, placeholder resolution logic
- Calls resolveTipPush via oracle wallet

## Deploy Target
- Base mainnet (contracts)
- IPFS (frontend)

## Client
- All admin/owner roles → 0xC99F74bC7c065d8c51BD724Da898d44F775a8a19
