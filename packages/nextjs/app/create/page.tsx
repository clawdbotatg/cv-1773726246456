"use client";

import { useState } from "react";
import { parseEther, formatEther, keccak256, toBytes } from "viem";
import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useClawdPrice } from "~~/hooks/useClawdPrice";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";

export default function CreateTip() {
  const { address, chain } = useAccount();
  const clawdPrice = useClawdPrice();
  const [step, setStep] = useState(1);
  const [criteria, setCriteria] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<0 | 1>(0); // 0=AutoSend, 1=RequireApproval
  const [isApproving, setIsApproving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [approveCooldown, setApproveCooldown] = useState(false);

  const { data: tipJarInfo } = useDeployedContractInfo("TipJar");
  const tipJarAddress = tipJarInfo?.address;

  const parsedAmount = amount ? parseEther(amount) : 0n;
  const winnerAmount = (parsedAmount * 9500n) / 10000n;
  const burnAmount = (parsedAmount * 450n) / 10000n;
  const creatorAmount = parsedAmount - winnerAmount - burnAmount;

  const { data: allowance } = useScaffoldReadContract({
    contractName: "CLAWD",
    functionName: "allowance",
    args: [address, tipJarAddress],
    watch: true,
  });

  const { data: balance } = useScaffoldReadContract({
    contractName: "CLAWD",
    functionName: "balanceOf",
    args: [address],
    watch: true,
  });

  const { writeContractAsync: approveWrite } = useScaffoldWriteContract("CLAWD");
  const { writeContractAsync: createTipWrite } = useScaffoldWriteContract("TipJar");

  const needsApproval = !allowance || allowance < parsedAmount;
  const wrongNetwork = chain?.id !== 8453 && chain?.id !== 31337;
  const notConnected = !address;

  const usdValue = parseFloat(amount || "0") * clawdPrice;

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await approveWrite({ functionName: "approve", args: [tipJarAddress!, parsedAmount] });
      setApproveCooldown(true);
      setTimeout(() => setApproveCooldown(false), 4000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsApproving(false);
    }
  };

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const criteriaHash = keccak256(toBytes(criteria));
      await createTipWrite({
        functionName: "createTip",
        args: [parsedAmount, mode, criteriaHash],
      });
      // Reset form
      setCriteria("");
      setAmount("");
      setStep(1);
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 py-8 px-4">
      <div className="w-full max-w-lg">
        {/* Progress Steps */}
        <ul className="steps steps-horizontal w-full mb-8">
          <li className={`step ${step >= 1 ? "step-primary" : ""}`}>Criteria</li>
          <li className={`step ${step >= 2 ? "step-primary" : ""}`}>Amount</li>
          <li className={`step ${step >= 3 ? "step-primary" : ""}`}>Confirm</li>
        </ul>

        {/* Step 1: Criteria */}
        {step === 1 && (
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h2 className="card-title">What&apos;s the criteria?</h2>
              <p className="text-sm opacity-60">Describe who should receive this tip.</p>
              <textarea
                className="textarea textarea-bordered w-full h-32"
                placeholder="e.g., Tip whoever burned the most CLAWD this month"
                value={criteria}
                onChange={e => setCriteria(e.target.value)}
              />
              <div className="card-actions justify-end mt-4">
                <button
                  className="btn btn-primary"
                  disabled={!criteria.trim()}
                  onClick={() => setStep(2)}
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Amount + Mode */}
        {step === 2 && (
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h2 className="card-title">How much CLAWD?</h2>
              {balance !== undefined && (
                <p className="text-sm opacity-60">
                  Balance: {parseFloat(formatEther(balance)).toLocaleString()} CLAWD
                  {clawdPrice > 0 && ` (~$${(parseFloat(formatEther(balance)) * clawdPrice).toFixed(2)})`}
                </p>
              )}
              <input
                type="number"
                className="input input-bordered w-full"
                placeholder="Amount in CLAWD"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                min="1"
              />
              {usdValue > 0 && (
                <p className="text-sm opacity-60">≈ ${usdValue.toFixed(2)} USD</p>
              )}

              {/* Fee breakdown */}
              {parsedAmount > 0n && (
                <div className="bg-base-200 rounded-lg p-3 mt-2 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Winner (95%)</span>
                    <span>{parseFloat(formatEther(winnerAmount)).toLocaleString()} CLAWD</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Burned 🔥 (4.5%)</span>
                    <span>{parseFloat(formatEther(burnAmount)).toLocaleString()} CLAWD</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Creator (0.5%)</span>
                    <span>{parseFloat(formatEther(creatorAmount)).toLocaleString()} CLAWD</span>
                  </div>
                </div>
              )}

              {/* Mode toggle */}
              <div className="form-control mt-4">
                <label className="label cursor-pointer">
                  <span className="label-text">
                    {mode === 0 ? "Auto-Send (oracle resolves → instant payout)" : "Require Approval (you approve the match)"}
                  </span>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={mode === 1}
                    onChange={e => setMode(e.target.checked ? 1 : 0)}
                  />
                </label>
              </div>

              <div className="card-actions justify-between mt-4">
                <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
                <button
                  className="btn btn-primary"
                  disabled={!amount || parsedAmount === 0n}
                  onClick={() => setStep(3)}
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Confirm + Action */}
        {step === 3 && (
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h2 className="card-title">Confirm Your Tip</h2>
              <div className="space-y-2 text-sm">
                <p><strong>Criteria:</strong> {criteria}</p>
                <p><strong>Amount:</strong> {parseFloat(amount).toLocaleString()} CLAWD {usdValue > 0 && `(~$${usdValue.toFixed(2)})`}</p>
                <p><strong>Mode:</strong> {mode === 0 ? "Auto-Send" : "Require Approval"}</p>
                <p><strong>Expiry:</strong> 30 days from creation</p>
              </div>

              {/* Three-button flow */}
              <div className="card-actions justify-center mt-6">
                {notConnected ? (
                  <RainbowKitCustomConnectButton />
                ) : wrongNetwork ? (
                  <button className="btn btn-warning btn-lg" disabled>
                    Switch to Base
                  </button>
                ) : needsApproval ? (
                  <button
                    className="btn btn-primary btn-lg"
                    disabled={isApproving || approveCooldown}
                    onClick={handleApprove}
                  >
                    {isApproving || approveCooldown ? (
                      <><span className="loading loading-spinner loading-sm" /> Approving...</>
                    ) : (
                      "Approve CLAWD"
                    )}
                  </button>
                ) : (
                  <button
                    className="btn btn-success btn-lg"
                    disabled={isCreating}
                    onClick={handleCreate}
                  >
                    {isCreating ? (
                      <><span className="loading loading-spinner loading-sm" /> Creating Tip...</>
                    ) : (
                      "Create Tip"
                    )}
                  </button>
                )}
              </div>

              <button className="btn btn-ghost btn-sm mt-2" onClick={() => setStep(2)}>← Back</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
