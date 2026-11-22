// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Test-only helper: a receiver that rejects native currency transfers.
/// Used to verify that failed payouts and refunds revert safely.
contract RejectingReceiver {
    receive() external payable {
        revert("RejectingReceiver: refuses funds");
    }
}
