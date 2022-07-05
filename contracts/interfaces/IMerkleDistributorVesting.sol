// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./IMerkleDistributor.sol";

// Allows anyone to claim a token if they exist in a merkle root.
interface IMerkleDistributorVesting is IMerkleDistributor {
    /// @notice Emitted after release percent is set
    /// @param former percent to be updated from
    /// @param current percent to be utilized
    event ReleasePercentUpdated(uint256 former, uint256 current);

    /// @notice Emitted after vesting duration is set
    /// @param former duration to be updated from
    /// @param current duration to be utilized
    event VestingDurationUpdated(uint64 former, uint64 current);

    /// @notice Emitted after vesting wallet created
    /// @param beneficiary to receive the vested tokens
    /// @param vestingWallet address of the VestingWallet contracts
    event VestingWalletCreated(address beneficiary, address vestingWallet);
}
