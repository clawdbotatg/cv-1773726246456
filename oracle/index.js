/**
 * IntentTip Oracle Skeleton
 *
 * Polls TipCreated events and resolves tips via resolveTipPush().
 * Currently uses placeholder resolution logic.
 *
 * TODO: Replace placeholder resolution with actual criteria evaluation
 * TODO: Replace oracle wallet with client-controlled hot wallet
 * TODO: Add cloud KMS for production key management
 */

const { ethers } = require("ethers");

// Config — use env vars in production
const RPC_URL = process.env.RPC_URL || "https://base-mainnet.g.alchemy.com/v2/YOUR_KEY";
const ORACLE_PRIVATE_KEY = process.env.ORACLE_PRIVATE_KEY || ""; // TODO: client provides oracle hot wallet
const TIPJAR_ADDRESS = process.env.TIPJAR_ADDRESS || ""; // Set after deployment

const TIPJAR_ABI = [
  "event TipCreated(uint256 indexed tipId, address indexed tipper, uint256 amount, uint8 mode, bytes32 criteriaHash, uint256 expiry)",
  "function resolveTipPush(uint256 tipId, address recipient) external",
  "function getTip(uint256 tipId) external view returns (tuple(address tipper, uint256 amount, uint8 mode, uint8 status, address matchedRecipient, uint256 expiry, bool rejectionUsed, bytes32 criteriaHash))",
];

async function main() {
  if (!ORACLE_PRIVATE_KEY || !TIPJAR_ADDRESS) {
    console.error("Set ORACLE_PRIVATE_KEY and TIPJAR_ADDRESS env vars");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(ORACLE_PRIVATE_KEY, provider);
  const tipJar = new ethers.Contract(TIPJAR_ADDRESS, TIPJAR_ABI, wallet);

  console.log(`Oracle started. Watching TipJar at ${TIPJAR_ADDRESS}`);
  console.log(`Oracle wallet: ${wallet.address}`);

  // Poll for new TipCreated events
  let lastBlock = await provider.getBlockNumber();

  setInterval(async () => {
    try {
      const currentBlock = await provider.getBlockNumber();
      if (currentBlock <= lastBlock) return;

      const events = await tipJar.queryFilter("TipCreated", lastBlock + 1, currentBlock);

      for (const event of events) {
        const { tipId, criteriaHash } = event.args;
        console.log(`New tip #${tipId} with criteria hash ${criteriaHash}`);

        // TODO: Actual resolution logic based on criteria
        // For now, this is a placeholder that does NOT auto-resolve
        // In production: parse criteria, query on-chain data, determine winner
        console.log(`Tip #${tipId} queued for manual resolution (placeholder)`);
      }

      lastBlock = currentBlock;
    } catch (err) {
      console.error("Poll error:", err.message);
    }
  }, 15_000); // Poll every 15s
}

main().catch(console.error);
