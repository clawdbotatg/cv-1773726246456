// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import "../contracts/TipJar.sol";

contract DeployTipJar is ScaffoldETHDeploy {
    function run() external ScaffoldEthDeployerRunner {
        // CLAWD token on Base
        address clawdToken = 0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07;
        address burnAddress = 0x000000000000000000000000000000000000dEaD;
        // Client wallet — all admin roles
        address creatorWallet = 0xC99F74bC7c065d8c51BD724Da898d44F775a8a19;
        uint256 minTipAmount = 1e18;       // 1 CLAWD minimum
        uint256 maxTipAmount = 1_000_000e18; // 1M CLAWD maximum
        // Admin = client, oracle = client (client will grant to oracle hot wallet)
        address admin = creatorWallet;
        address oracle = creatorWallet;

        new TipJar(
            clawdToken,
            burnAddress,
            creatorWallet,
            minTipAmount,
            maxTipAmount,
            admin,
            oracle
        );
    }
}
