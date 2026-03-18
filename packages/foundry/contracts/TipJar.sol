// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TipJar
 * @notice On-chain bounty tipping protocol for CLAWD token.
 *         Users deposit tips with criteria. Oracle resolves winner.
 *         4.5% burn + 0.5% creator fee on every successful tip.
 *         30-day refund guarantee.
 */
contract TipJar is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Types ───────────────────────────────────────────────────
    enum Mode { AutoSend, RequireApproval }
    enum Status { Open, Matched, Released, Refunded }

    struct Tip {
        address tipper;
        uint256 amount; // net CLAWD received (fee-on-transfer safe)
        Mode mode;
        Status status;
        address matchedRecipient;
        uint256 expiry;
        bool rejectionUsed;
        bytes32 criteriaHash;
    }

    // ─── Constants & Immutables ──────────────────────────────────
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    uint256 public constant WINNER_BPS = 9500;
    uint256 public constant BURN_BPS = 450;
    uint256 public constant CREATOR_BPS = 50;
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant TIP_DURATION = 30 days;

    IERC20 public immutable clawdToken;
    address public immutable burnAddress;
    address public immutable creatorWallet;
    uint256 public immutable minTipAmount;
    uint256 public immutable maxTipAmount;

    // ─── State ───────────────────────────────────────────────────
    uint256 public nextTipId;
    mapping(uint256 => Tip) public tips;

    // ─── Events ──────────────────────────────────────────────────
    event TipCreated(uint256 indexed tipId, address indexed tipper, uint256 amount, Mode mode, bytes32 criteriaHash, uint256 expiry);
    event TipMatched(uint256 indexed tipId, address indexed recipient);
    event TipReleased(uint256 indexed tipId, address indexed recipient, uint256 winnerAmount, uint256 burnAmount, uint256 creatorAmount);
    event TipRefunded(uint256 indexed tipId, address indexed tipper, uint256 amount);
    event MatchRejected(uint256 indexed tipId, bool autoRefunded);

    // ─── Errors ──────────────────────────────────────────────────
    error AmountTooLow();
    error AmountTooHigh();
    error NotTipper();
    error InvalidStatus();
    error NotExpired();
    error ZeroRecipient();
    error ZeroAmount();

    // ─── Constructor ─────────────────────────────────────────────
    constructor(
        address _clawdToken,
        address _burnAddress,
        address _creatorWallet,
        uint256 _minTipAmount,
        uint256 _maxTipAmount,
        address _admin,
        address _oracle
    ) {
        clawdToken = IERC20(_clawdToken);
        burnAddress = _burnAddress;
        creatorWallet = _creatorWallet;
        minTipAmount = _minTipAmount;
        maxTipAmount = _maxTipAmount;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ORACLE_ROLE, _oracle);
    }

    // ─── Core Functions ──────────────────────────────────────────

    /**
     * @notice Create a tip by depositing CLAWD tokens.
     * @param amount The amount of CLAWD to transfer (pre fee-on-transfer).
     * @param mode AutoSend or RequireApproval.
     * @param criteriaHash keccak256 of the criteria text.
     */
    function createTip(uint256 amount, Mode mode, bytes32 criteriaHash) external nonReentrant returns (uint256 tipId) {
        if (amount == 0) revert ZeroAmount();

        // Fee-on-transfer safe: measure actual received
        uint256 balBefore = clawdToken.balanceOf(address(this));
        clawdToken.safeTransferFrom(msg.sender, address(this), amount);
        uint256 netAmount = clawdToken.balanceOf(address(this)) - balBefore;

        if (netAmount < minTipAmount) revert AmountTooLow();
        if (netAmount > maxTipAmount) revert AmountTooHigh();

        tipId = nextTipId++;
        uint256 expiry = block.timestamp + TIP_DURATION;

        tips[tipId] = Tip({
            tipper: msg.sender,
            amount: netAmount,
            mode: mode,
            status: Status.Open,
            matchedRecipient: address(0),
            expiry: expiry,
            rejectionUsed: false,
            criteriaHash: criteriaHash
        });

        emit TipCreated(tipId, msg.sender, netAmount, mode, criteriaHash, expiry);
    }

    /**
     * @notice Oracle resolves a tip by assigning a recipient.
     *         AutoSend: immediately splits and transfers.
     *         RequireApproval: sets matchedRecipient for tipper approval.
     */
    function resolveTipPush(uint256 tipId, address recipient) external onlyRole(ORACLE_ROLE) nonReentrant {
        if (recipient == address(0)) revert ZeroRecipient();
        Tip storage tip = tips[tipId];
        if (tip.status != Status.Open) revert InvalidStatus();

        if (tip.mode == Mode.AutoSend) {
            tip.status = Status.Released;
            tip.matchedRecipient = recipient;
            _executeSplit(tipId, tip.amount, recipient);
        } else {
            tip.status = Status.Matched;
            tip.matchedRecipient = recipient;
            emit TipMatched(tipId, recipient);
        }
    }

    /**
     * @notice Tipper approves a matched tip, releasing funds.
     */
    function approveAndRelease(uint256 tipId) external nonReentrant {
        Tip storage tip = tips[tipId];
        if (msg.sender != tip.tipper) revert NotTipper();
        if (tip.status != Status.Matched) revert InvalidStatus();

        tip.status = Status.Released;
        _executeSplit(tipId, tip.amount, tip.matchedRecipient);
    }

    /**
     * @notice Tipper rejects a match. First rejection resets to Open.
     *         Second rejection auto-refunds.
     */
    function rejectMatch(uint256 tipId) external nonReentrant {
        Tip storage tip = tips[tipId];
        if (msg.sender != tip.tipper) revert NotTipper();
        if (tip.status != Status.Matched) revert InvalidStatus();

        if (!tip.rejectionUsed) {
            tip.rejectionUsed = true;
            tip.status = Status.Open;
            tip.matchedRecipient = address(0);
            emit MatchRejected(tipId, false);
        } else {
            tip.status = Status.Refunded;
            clawdToken.safeTransfer(tip.tipper, tip.amount);
            emit TipRefunded(tipId, tip.tipper, tip.amount);
            emit MatchRejected(tipId, true);
        }
    }

    /**
     * @notice Tipper reclaims an expired tip. Full refund, no fees.
     */
    function reclaimTip(uint256 tipId) external nonReentrant {
        Tip storage tip = tips[tipId];
        if (msg.sender != tip.tipper) revert NotTipper();
        if (tip.status != Status.Open && tip.status != Status.Matched) revert InvalidStatus();
        if (block.timestamp < tip.expiry) revert NotExpired();

        tip.status = Status.Refunded;
        clawdToken.safeTransfer(tip.tipper, tip.amount);
        emit TipRefunded(tipId, tip.tipper, tip.amount);
    }

    // ─── Internal ────────────────────────────────────────────────

    function _executeSplit(uint256 tipId, uint256 amount, address recipient) internal {
        uint256 winnerAmount = (amount * WINNER_BPS) / BPS_DENOMINATOR;
        uint256 burnAmount = (amount * BURN_BPS) / BPS_DENOMINATOR;
        uint256 creatorAmount = amount - winnerAmount - burnAmount; // absorbs dust

        clawdToken.safeTransfer(recipient, winnerAmount);
        clawdToken.safeTransfer(burnAddress, burnAmount);
        clawdToken.safeTransfer(creatorWallet, creatorAmount);

        emit TipReleased(tipId, recipient, winnerAmount, burnAmount, creatorAmount);
    }

    // ─── View Functions ──────────────────────────────────────────

    function getTip(uint256 tipId) external view returns (Tip memory) {
        return tips[tipId];
    }
}
