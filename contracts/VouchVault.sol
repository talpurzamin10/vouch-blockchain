// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title VouchVault — transparent emergency medical fundraising escrow
/// @notice The contract enforces on-chain voting and payments; it cannot establish
/// off-chain medical truth. Verifiers must inspect evidence off-chain and may collude.
contract VouchVault is AccessControl, ReentrancyGuard {
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    uint8 public constant REQUIRED_APPROVALS = 2;
    uint8 public constant REQUIRED_REJECTIONS = 2;

    enum CampaignStatus { Active, ApprovedAndReleased, Rejected, Expired }
    struct Campaign {
        uint256 id;
        address payable beneficiary;
        string title;
        bytes32 proofHash;
        uint256 goalAmount;
        uint256 totalRaised;
        uint256 deadline;
        uint8 approvalCount;
        uint8 rejectionCount;
        CampaignStatus status;
    }

    uint256 public campaignCount;
    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(address => uint256)) public donations;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event CampaignCreated(uint256 indexed campaignId, address indexed beneficiary, uint256 goalAmount, uint256 deadline, bytes32 proofHash);
    event DonationReceived(uint256 indexed campaignId, address indexed donor, uint256 amount);
    event VerifierVoted(uint256 indexed campaignId, address indexed verifier, bool approved);
    event FundsReleased(uint256 indexed campaignId, address indexed beneficiary, uint256 amount);
    event CampaignRejected(uint256 indexed campaignId);
    event CampaignExpired(uint256 indexed campaignId);
    event RefundClaimed(uint256 indexed campaignId, address indexed donor, uint256 amount);

    constructor(address[3] memory initialVerifiers) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        for (uint256 i; i < 3; ++i) {
            require(initialVerifiers[i] != address(0), "Invalid verifier address");
            for (uint256 j; j < i; ++j) require(initialVerifiers[i] != initialVerifiers[j], "Duplicate verifier");
            _grantRole(VERIFIER_ROLE, initialVerifiers[i]);
        }
    }

    function createCampaign(address payable beneficiary, string calldata title, bytes32 proofHash, uint256 goalAmount, uint256 durationSeconds) external returns (uint256 id) {
        require(beneficiary != address(0), "Invalid beneficiary");
        require(goalAmount > 0, "Goal must be > 0");
        require(durationSeconds >= 1 hours, "Duration too short");
        require(proofHash != bytes32(0), "Proof hash required");
        id = ++campaignCount;
        uint256 deadline = block.timestamp + durationSeconds;
        campaigns[id] = Campaign(id, beneficiary, title, proofHash, goalAmount, 0, deadline, 0, 0, CampaignStatus.Active);
        emit CampaignCreated(id, beneficiary, goalAmount, deadline, proofHash);
    }

    function donate(uint256 campaignId) external payable {
        Campaign storage c = campaigns[campaignId];
        require(c.id != 0, "Campaign does not exist");
        require(c.status == CampaignStatus.Active, "Campaign not active");
        require(block.timestamp < c.deadline, "Campaign deadline passed");
        require(msg.value > 0, "Donation must be > 0");
        c.totalRaised += msg.value;
        donations[campaignId][msg.sender] += msg.value;
        emit DonationReceived(campaignId, msg.sender, msg.value);
    }

    function voteOnCampaign(uint256 campaignId, bool approve) external onlyRole(VERIFIER_ROLE) nonReentrant {
        Campaign storage c = campaigns[campaignId];
        require(c.id != 0, "Campaign does not exist");
        require(c.status == CampaignStatus.Active, "Campaign already finalized");
        require(block.timestamp < c.deadline, "Campaign deadline passed");
        require(!hasVoted[campaignId][msg.sender], "Verifier already voted");
        hasVoted[campaignId][msg.sender] = true;
        emit VerifierVoted(campaignId, msg.sender, approve);
        if (approve) {
            ++c.approvalCount;
            if (c.approvalCount >= REQUIRED_APPROVALS) {
                require(c.totalRaised > 0, "No funds to release");
                c.status = CampaignStatus.ApprovedAndReleased;
                uint256 amount = c.totalRaised;
                (bool ok,) = c.beneficiary.call{value: amount}("");
                require(ok, "Transfer to beneficiary failed");
                emit FundsReleased(campaignId, c.beneficiary, amount);
            }
        } else {
            ++c.rejectionCount;
            if (c.rejectionCount >= REQUIRED_REJECTIONS) {
                c.status = CampaignStatus.Rejected;
                emit CampaignRejected(campaignId);
            }
        }
    }

    function claimRefund(uint256 campaignId) external nonReentrant {
        Campaign storage c = campaigns[campaignId];
        require(c.id != 0, "Campaign does not exist");
        if (c.status == CampaignStatus.Active && block.timestamp >= c.deadline) {
            c.status = CampaignStatus.Expired;
            emit CampaignExpired(campaignId);
        }
        require(c.status == CampaignStatus.Rejected || c.status == CampaignStatus.Expired, "Campaign not eligible for refund");
        uint256 amount = donations[campaignId][msg.sender];
        require(amount > 0, "No refundable balance");
        donations[campaignId][msg.sender] = 0;
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        require(ok, "Refund transfer failed");
        emit RefundClaimed(campaignId, msg.sender, amount);
    }
}
