# 🎯 IntentTip V1 — On-Chain Bounty Tipping Protocol

Deposit CLAWD tips with verifiable criteria. An oracle resolves the winner and pushes payout. 4.5% burn + 0.5% creator fee on every successful tip. 30-day refund guarantee.

## Live Contract

- **TipJar:** [`0x13f6Bae029A90756fA9236079853382B2050D623`](https://basescan.org/address/0x13f6Bae029A90756fA9236079853382B2050D623) on Base
- **CLAWD Token:** [`0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07`](https://basescan.org/address/0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07) on Base
- **Admin/Oracle Admin:** `0xC99F74bC7c065d8c51BD724Da898d44F775a8a19` (client multisig)

## How It Works

1. **Create Tip:** Deposit CLAWD with criteria (e.g., "tip whoever burned the most CLAWD this month")
2. **Oracle Resolves:** Oracle script evaluates criteria and calls `resolveTipPush()` with the winner
3. **Payout:** 95% to winner, 4.5% burned 🔥, 0.5% to creator
4. **Safety:** Tipper can reject matches (1 free rejection, 2nd = auto-refund) or reclaim after 30 days (full refund, no fees)

## Fee Structure

| Recipient | Percentage |
|-----------|-----------|
| Winner | 95% |
| Burn 🔥 | 4.5% |
| Creator | 0.5% |

## Architecture

- **Smart Contract:** `TipJar.sol` — Solidity ^0.8.20, OpenZeppelin AccessControl + ReentrancyGuard + SafeERC20
- **Frontend:** Scaffold-ETH 2 (Next.js) — Live feed, tip creation, management dashboard
- **Oracle:** Node.js skeleton — polls events, placeholder resolution logic

## Development

```bash
# Install
yarn install

# Run local
yarn chain    # start local chain
yarn deploy   # deploy contract
yarn start    # start frontend

# Test
cd packages/foundry && forge test
```

## Security

- All config immutable (no admin can change fees/addresses)
- No pause, no upgradeability — passes Walkaway Test
- ReentrancyGuard + CEI on all fund-moving functions
- SafeERC20 for all CLAWD transfers
- Fee-on-transfer safe (measures balance delta)
- 4 audit issues filed (all Low severity, all addressed)

## Oracle Setup

The oracle hot wallet needs ORACLE_ROLE granted by the admin:

```bash
# Admin grants oracle role
cast send 0x13f6Bae029A90756fA9236079853382B2050D623 \
  "grantRole(bytes32,address)" \
  0x68e79a7bf1e0bc45d0a330c573bc367f9cf464fd326078812f301165fbda4ef1 \
  <ORACLE_WALLET_ADDRESS> \
  --private-key <ADMIN_KEY> \
  --rpc-url https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
```

## Environment Variables

See `.env.example` for required environment variables.

## Built by CLAWD Bot for LeftClaw Services — Job #10
