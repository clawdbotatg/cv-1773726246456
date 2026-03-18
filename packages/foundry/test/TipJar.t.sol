// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/TipJar.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockCLAWD is ERC20 {
    constructor() ERC20("CLAWD", "CLAWD") {
        _mint(msg.sender, 10_000_000e18);
    }
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract TipJarTest is Test {
    TipJar public tipJar;
    MockCLAWD public clawd;

    address admin = address(0xAD);
    address oracle = address(0x0C);
    address tipper = address(0x11);
    address winner = address(0x22);
    address burn = address(0xdEaD);
    address creator = address(0xCC);

    function setUp() public {
        clawd = new MockCLAWD();
        tipJar = new TipJar(
            address(clawd), burn, creator,
            1e18, 1_000_000e18, admin, oracle
        );
        clawd.mint(tipper, 100_000e18);
        vm.prank(tipper);
        clawd.approve(address(tipJar), type(uint256).max);
    }

    function test_createTip() public {
        vm.prank(tipper);
        uint256 tipId = tipJar.createTip(1000e18, TipJar.Mode.AutoSend, keccak256("test"));
        assertEq(tipId, 0);

        TipJar.Tip memory tip = tipJar.getTip(0);
        assertEq(tip.tipper, tipper);
        assertEq(tip.amount, 1000e18);
        assertEq(uint8(tip.status), uint8(TipJar.Status.Open));
    }

    function test_createTip_tooLow() public {
        vm.prank(tipper);
        vm.expectRevert(TipJar.AmountTooLow.selector);
        tipJar.createTip(0.5e18, TipJar.Mode.AutoSend, keccak256("test"));
    }

    function test_resolveTipPush_autoSend() public {
        vm.prank(tipper);
        tipJar.createTip(1000e18, TipJar.Mode.AutoSend, keccak256("test"));

        vm.prank(oracle);
        tipJar.resolveTipPush(0, winner);

        TipJar.Tip memory tip = tipJar.getTip(0);
        assertEq(uint8(tip.status), uint8(TipJar.Status.Released));

        // 95% to winner
        assertEq(clawd.balanceOf(winner), 950e18);
        // 4.5% burned
        assertEq(clawd.balanceOf(burn), 45e18);
        // 0.5% to creator
        assertEq(clawd.balanceOf(creator), 5e18);
    }

    function test_resolveTipPush_requireApproval() public {
        vm.prank(tipper);
        tipJar.createTip(1000e18, TipJar.Mode.RequireApproval, keccak256("test"));

        vm.prank(oracle);
        tipJar.resolveTipPush(0, winner);

        TipJar.Tip memory tip = tipJar.getTip(0);
        assertEq(uint8(tip.status), uint8(TipJar.Status.Matched));
        assertEq(tip.matchedRecipient, winner);
    }

    function test_approveAndRelease() public {
        vm.prank(tipper);
        tipJar.createTip(1000e18, TipJar.Mode.RequireApproval, keccak256("test"));
        vm.prank(oracle);
        tipJar.resolveTipPush(0, winner);

        vm.prank(tipper);
        tipJar.approveAndRelease(0);

        assertEq(clawd.balanceOf(winner), 950e18);
        assertEq(uint8(tipJar.getTip(0).status), uint8(TipJar.Status.Released));
    }

    function test_rejectMatch_first() public {
        vm.prank(tipper);
        tipJar.createTip(1000e18, TipJar.Mode.RequireApproval, keccak256("test"));
        vm.prank(oracle);
        tipJar.resolveTipPush(0, winner);

        vm.prank(tipper);
        tipJar.rejectMatch(0);

        TipJar.Tip memory tip = tipJar.getTip(0);
        assertEq(uint8(tip.status), uint8(TipJar.Status.Open));
        assertTrue(tip.rejectionUsed);
    }

    function test_rejectMatch_second_refunds() public {
        vm.prank(tipper);
        tipJar.createTip(1000e18, TipJar.Mode.RequireApproval, keccak256("test"));
        
        // First match + reject
        vm.prank(oracle);
        tipJar.resolveTipPush(0, winner);
        vm.prank(tipper);
        tipJar.rejectMatch(0);

        // Second match + reject
        vm.prank(oracle);
        tipJar.resolveTipPush(0, address(0x33));
        vm.prank(tipper);
        tipJar.rejectMatch(0);

        assertEq(uint8(tipJar.getTip(0).status), uint8(TipJar.Status.Refunded));
        assertEq(clawd.balanceOf(tipper), 100_000e18); // full refund
    }

    function test_reclaimTip() public {
        vm.prank(tipper);
        tipJar.createTip(1000e18, TipJar.Mode.AutoSend, keccak256("test"));

        // Warp past expiry
        vm.warp(block.timestamp + 31 days);

        vm.prank(tipper);
        tipJar.reclaimTip(0);

        assertEq(uint8(tipJar.getTip(0).status), uint8(TipJar.Status.Refunded));
        assertEq(clawd.balanceOf(tipper), 100_000e18);
    }

    function test_reclaimTip_notExpired() public {
        vm.prank(tipper);
        tipJar.createTip(1000e18, TipJar.Mode.AutoSend, keccak256("test"));

        vm.prank(tipper);
        vm.expectRevert(TipJar.NotExpired.selector);
        tipJar.reclaimTip(0);
    }

    function test_onlyOracle() public {
        vm.prank(tipper);
        tipJar.createTip(1000e18, TipJar.Mode.AutoSend, keccak256("test"));

        vm.prank(tipper); // not oracle
        vm.expectRevert();
        tipJar.resolveTipPush(0, winner);
    }

    function test_onlyTipper_approve() public {
        vm.prank(tipper);
        tipJar.createTip(1000e18, TipJar.Mode.RequireApproval, keccak256("test"));
        vm.prank(oracle);
        tipJar.resolveTipPush(0, winner);

        vm.prank(winner); // not tipper
        vm.expectRevert(TipJar.NotTipper.selector);
        tipJar.approveAndRelease(0);
    }

    function test_feeMath_noDust() public {
        // Test with odd amounts
        vm.prank(tipper);
        tipJar.createTip(999e18, TipJar.Mode.AutoSend, keccak256("test"));
        
        vm.prank(oracle);
        tipJar.resolveTipPush(0, winner);

        uint256 w = clawd.balanceOf(winner);
        uint256 b = clawd.balanceOf(burn);
        uint256 c = clawd.balanceOf(creator);
        assertEq(w + b + c, 999e18); // no dust lost
    }

    function test_zeroRecipient() public {
        vm.prank(tipper);
        tipJar.createTip(1000e18, TipJar.Mode.AutoSend, keccak256("test"));

        vm.prank(oracle);
        vm.expectRevert(TipJar.ZeroRecipient.selector);
        tipJar.resolveTipPush(0, address(0));
    }
}
