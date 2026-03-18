//SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import { DeployTipJar } from "./DeployTipJar.s.sol";

contract DeployScript is ScaffoldETHDeploy {
  function run() external {
    DeployTipJar deployTipJar = new DeployTipJar();
    deployTipJar.run();
  }
}