"use client";

import { formatEther } from "viem";
import { useScaffoldEventHistory, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { useClawdPrice } from "~~/hooks/useClawdPrice";
import { Address } from "~~/components/scaffold-eth";

export default function Home() {
  const clawdPrice = useClawdPrice();

  const { data: nextTipId } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "nextTipId",
    watch: true,
  });

  const { data: tipEvents } = useScaffoldEventHistory({
    contractName: "TipJar",
    eventName: "TipCreated",
    fromBlock: 0n,
    watch: true,
  });

  const { data: releaseEvents } = useScaffoldEventHistory({
    contractName: "TipJar",
    eventName: "TipReleased",
    fromBlock: 0n,
    watch: true,
  });

  const { data: refundEvents } = useScaffoldEventHistory({
    contractName: "TipJar",
    eventName: "TipRefunded",
    fromBlock: 0n,
    watch: true,
  });

  // Stats
  const totalTipped = tipEvents?.reduce((sum, e) => sum + (e.args.amount ?? 0n), 0n) ?? 0n;
  const totalBurned = releaseEvents?.reduce((sum, e) => sum + (e.args.burnAmount ?? 0n), 0n) ?? 0n;
  const totalCreatorFees = releaseEvents?.reduce((sum, e) => sum + (e.args.creatorAmount ?? 0n), 0n) ?? 0n;
  const activeTips = Number(nextTipId ?? 0n) - (releaseEvents?.length ?? 0) - (refundEvents?.length ?? 0);

  const fmtUsd = (wei: bigint) => {
    const val = parseFloat(formatEther(wei)) * clawdPrice;
    return val > 0 ? ` (~$${val.toFixed(2)})` : "";
  };

  return (
    <div className="flex flex-col items-center gap-8 py-8 px-4">
      {/* Stats Bar */}
      <div className="stats stats-vertical lg:stats-horizontal shadow bg-base-100 w-full max-w-4xl">
        <div className="stat">
          <div className="stat-title">Total Tipped</div>
          <div className="stat-value text-lg">{parseFloat(formatEther(totalTipped)).toLocaleString()} CLAWD</div>
          <div className="stat-desc">{fmtUsd(totalTipped)}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Total Burned 🔥</div>
          <div className="stat-value text-lg">{parseFloat(formatEther(totalBurned)).toLocaleString()} CLAWD</div>
          <div className="stat-desc">{fmtUsd(totalBurned)}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Creator Fees</div>
          <div className="stat-value text-lg">{parseFloat(formatEther(totalCreatorFees)).toLocaleString()} CLAWD</div>
          <div className="stat-desc">{fmtUsd(totalCreatorFees)}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Active Tips</div>
          <div className="stat-value text-lg">{Math.max(0, activeTips)}</div>
        </div>
      </div>

      {/* Live Feed */}
      <div className="w-full max-w-4xl">
        <h2 className="text-2xl font-bold mb-4">Live Tip Feed</h2>
        <div className="space-y-3">
          {tipEvents && tipEvents.length > 0 ? (
            [...tipEvents].reverse().map((event, i) => (
              <div key={i} className="card bg-base-100 shadow-sm">
                <div className="card-body p-4 flex flex-row items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="badge badge-primary">#{event.args.tipId?.toString()}</span>
                    <Address address={event.args.tipper} />
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold">
                      {parseFloat(formatEther(event.args.amount ?? 0n)).toLocaleString()} CLAWD
                    </span>
                    <span className="text-sm opacity-60">{fmtUsd(event.args.amount ?? 0n)}</span>
                  </div>
                  <span className={`badge ${event.args.mode === 0 ? "badge-success" : "badge-warning"}`}>
                    {event.args.mode === 0 ? "Auto" : "Approval"}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center opacity-60 py-12">No tips yet. Be the first!</div>
          )}
        </div>
      </div>

      {/* Contract Address */}
      <div className="text-center mt-8 text-sm opacity-70">
        <p>TipJar Contract:</p>
        <Address address={undefined} />
      </div>
    </div>
  );
}
