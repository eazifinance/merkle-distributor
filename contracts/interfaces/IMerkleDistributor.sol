// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

// Allows anyone to claim a token if they exist in a merkle root.
interface IMerkleDistributor {
    /// @notice Emitted after a successful claim
    /// @param to recipient of claim
    /// @param amount of tokens claimed
    event Claimed(address indexed to, uint256 amount);

    /// @notice Emitted after deadline updated
    /// @param former former deadline
    /// @param deadline new deadline value
    event DeadlineUpdated(uint256 former, uint256 deadline);

    /// @notice Emitted after a successful withdrawal of unclaimed token
    /// @param total amount unclaimed
    /// @param timestamp withdrawn at
    event UnclaimedWithdrawn(uint256 total, uint256 timestamp);

    // Returns the address of the token distributed by this contract.
    function token() external view returns (address);

    // Returns the merkle root of the merkle tree containing account balances available to claim.
    function merkleRoot() external view returns (bytes32);

    // Returns true if the address has been marked claimed.
    function isClaimed(address claimer) external view returns (bool);

    // Claim the given amount of the token to the given address. Reverts if the inputs are invalid.
    function claim(
        address to,
        uint256 amount,
        bytes32[] calldata proof
    ) external;
}
