# IntentTip V1 — User Journeys

## Journey 1: Create a Tip (Tipper)
1. User lands on / → sees live feed of tips, stats bar (total burned, total tipped, active count)
2. Clicks "Create Tip" → navigates to /create
3. **Step 1 - Criteria:** Types criteria text (e.g., "Tip whoever burned the most CLAWD this month")
4. **Step 2 - Amount:** Enters CLAWD amount. Sees fee breakdown: 95% to winner, 4.5% burned, 0.5% creator fee. USD value shown.
5. **Step 3 - Mode:** Toggles AutoSend (auto-release on oracle match) or RequireApproval (tipper must approve)
6. **Three-button flow:** Connect Wallet → Switch to Base → Approve CLAWD → Create Tip
7. Tx confirms → redirected to /manage with new tip visible

## Journey 2: Manage Tips (Tipper)
1. User goes to /manage → sees all their tips with status badges
2. **Matched tip (RequireApproval mode):**
   - Sees matched recipient (Address component), amount breakdown
   - Can "Approve & Release" → executes 3-way split (winner/burn/creator)
   - Can "Reject Match" → first rejection resets to Open, second auto-refunds
3. **Expired tip:** Shows "Reclaim" button → full refund, no fees
4. **Open tip:** Shows "Waiting for match" status

## Journey 3: Oracle Resolution (Automated)
1. Oracle script polls TipCreated events
2. Evaluates criteria against on-chain data
3. Calls resolveTipPush(tipId, winnerAddress)
4. AutoSend: immediate 3-way split
5. RequireApproval: sets matchedRecipient, tipper notified via event

## Journey 4: View Feed (Anyone)
1. Landing page shows real-time feed of TipCreated, TipReleased, TipRefunded events
2. Stats bar: total CLAWD burned, total tipped, total creator fees, active tip count
3. Each tip card shows: tipper (Address), amount (+ USD), status, criteria hash
