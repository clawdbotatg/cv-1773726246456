"use client";

import { useState } from "react";
import { formatEther } from "viem";
import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract, useScaffoldEventHistory } from "~~/hooks/scaffold-eth";
import { useClawdPrice } from "~~/hooks/useClawdPrice";
import { Address, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";

const STATUS_LABELS = ["Open", "Matched", "Released", "Refunded"];
const STATUS_COLORS = ["badge-info", "badge-warning", "badge-success", "badge-ghost"];

function TipCard({ tipId, clawdPrice }: { tipId: number; clawdPrice: number }) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isReclaiming, setIsReclaiming] = useState(false);

  const { data: tip } = useScaffoldReadContract({
    contractName: "TipJar",
    functionName: "getTip",
    args: [BigInt(tipId)],
    watch: true,
  });

  const { writeContractAsync: approveRelease } = useScaffoldWriteContract("TipJar");
  const { writeContractAsync: rejectMatch } = useScaffoldWriteContract("TipJar");
  const { writeContractAsync: reclaimTip } = useScaffoldWriteContract("TipJar");

  if (!tip) return null;

  const status = Number(tip.status);
  const amount = tip.amount;
  const isExpired = Date.now() / 1000 > Number(tip.expiry);
  const canReclaim = (status === 0 || status === 1) && isExpired;
  const usd = clawdPrice > 0 ? ` (~$${(parseFloat(formatEther(amount)) * clawdPrice).toFixed(2)})` : "";

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold">Tip #{tipId}</span>
            <span className={`badge ${STATUS_COLORS[status]}`}>{STATUS_LABELS[status]}</span>
          </div>
          <div className="text-right">
            <span className="font-mono">{parseFloat(formatEther(amount)).toLocaleString()} CLAWD</span>
            <span className="text-sm opacity-60">{usd}</span>
          </div>
        </div>

        {tip.matchedRecipient !== "0x0000000000000000000000000000000000000000" && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm opacity-60">Matched to:</span>
            <Address address={tip.matchedRecipient} />
          </div>
        )}

        <div className="text-xs opacity-50">
          Expires: {new Date(Number(tip.expiry) * 1000).toLocaleDateString()}
          {tip.rejectionUsed && " • Rejection used"}
        </div>

        {/* Actions */}
        <div className="card-actions justify-end mt-2">
          {status === 1 && (
            <>
              <button
                className="btn btn-success btn-sm"
                disabled={isApproving}
                onClick={async () => {
                  setIsApproving(true);
                  try {
                    await approveRelease({ functionName: "approveAndRelease", args: [BigInt(tipId)] });
                  } catch (e) { console.error(e); }
                  finally { setIsApproving(false); }
                }}
              >
                {isApproving ? <><span className="loading loading-spinner loading-xs" /> Releasing...</> : "Approve & Release"}
              </button>
              <button
                className="btn btn-error btn-sm"
                disabled={isRejecting}
                onClick={async () => {
                  setIsRejecting(true);
                  try {
                    await rejectMatch({ functionName: "rejectMatch", args: [BigInt(tipId)] });
                  } catch (e) { console.error(e); }
                  finally { setIsRejecting(false); }
                }}
              >
                {isRejecting ? <><span className="loading loading-spinner loading-xs" /> Rejecting...</> : "Reject"}
              </button>
            </>
          )}
          {canReclaim && (
            <button
              className="btn btn-warning btn-sm"
              disabled={isReclaiming}
              onClick={async () => {
                setIsReclaiming(true);
                try {
                  await reclaimTip({ functionName: "reclaimTip", args: [BigInt(tipId)] });
                } catch (e) { console.error(e); }
                finally { setIsReclaiming(false); }
              }}
            >
              {isReclaiming ? <><span className="loading loading-spinner loading-xs" /> Reclaiming...</> : "Reclaim"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ManageTips() {
  const { address } = useAccount();
  const clawdPrice = useClawdPrice();

  const { data: tipEvents } = useScaffoldEventHistory({
    contractName: "TipJar",
    eventName: "TipCreated",
    fromBlock: 0n,
    watch: true,
    filters: { tipper: address },
  });

  if (!address) {
    return (
      <div className="flex flex-col items-center gap-6 py-16">
        <RainbowKitCustomConnectButton />
      </div>
    );
  }

  const myTipIds = tipEvents?.map(e => Number(e.args.tipId ?? 0)) ?? [];

  return (
    <div className="flex flex-col items-center gap-6 py-8 px-4">
      <div className="w-full max-w-lg">
        <h2 className="text-2xl font-bold mb-4">Your Tips</h2>
        {myTipIds.length === 0 ? (
          <div className="text-center opacity-60 py-12">
            No tips yet. <a href="/create" className="link link-primary">Create one</a>
          </div>
        ) : (
          <div className="space-y-3">
            {[...myTipIds].reverse().map(id => (
              <TipCard key={id} tipId={id} clawdPrice={clawdPrice} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
