// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./IMerkleDistributor.sol";

// Allows anyone(potential migrators) to claim a token if they exist in a merkle root.
interface IMerkleDistributorMigrator is IMerkleDistributor {
    /// @notice Emitted after claimer representative is set
    /// @param claimer original claimer
    /// @param rep set recipient
    event RepresentativeSet(address claimer, address rep);

    // Claim the given amount of the token to the msg.sender on behalf of claimer. Reverts if the inputs are invalid.
    function claimOnBehalfOf(
        address claimer,
        uint256 amount,
        bytes32[] calldata proof
    ) external;
}
