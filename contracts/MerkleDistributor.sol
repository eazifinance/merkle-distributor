// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.0;

/* imports */
import "./interfaces/ICoreController.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IMerkleDistributorMigrator.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// @author eazi.finance
/// @title MerkleDistributor
/// @notice Allow EAZI to be claimable by eligible addresses
contract MerkleDistributor is IMerkleDistributorMigrator, Ownable, Pausable {
    /* using for */
    using Address for address;
    using SafeERC20 for IERC20;

    /* states */

    /// @notice claims starts
    uint64 public claimStarts;
    /// @notice claims deadline
    uint64 public claimDeadline;
    /// @notice Protocol CoreController
    ICoreController public coreController;
    /// @notice minimum savings provided
    uint256 public minimumBalanceRequired;

    /// @notice claimable token
    address public override token;
    /// @notice merkle root
    bytes32 public override merkleRoot;

    /// @notice Mapping of addresses claimed addresses
    mapping(address => bool) public override isClaimed;

    /// @notice Mapping of representatives
    mapping(address => address) public representatives;

    /* errors */

    /// @notice Thrown if claiming after deadline
    error PastDeadline();
    /// @notice Thrown if action happens before start
    error ActionPaused();
    /// @notice Thrown if address has already claimed
    error AlreadyClaimed();
    /// @notice Thrown if claiming claimer not a representative
    error InvalidRepresentative();
    /// @notice Thrown if address/amount are not part of Merkle tree
    error NotEligible();
    /// @notice Thrown if claimer not passing the minimum requirements
    error RequirementNotPassed();

    /* methods */

    /// @notice Creates a new MerkleDistributor contract
    /// @param token_ claimable
    /// @param merkleRoot_ of claimers
    /// @param claimDeadline_ to claim until
    /// @param claimStarts_ to be paused before
    /// @param minimumBalance_ required before claim
    /// @param coreController_ protocol coreController
    constructor(
        address token_,
        bytes32 merkleRoot_,
        uint64 claimStarts_,
        uint64 claimDeadline_,
        address coreController_,
        uint256 minimumBalance_
    ) {
        token = token_;
        merkleRoot = merkleRoot_;
        claimStarts = claimStarts_;
        claimDeadline = claimDeadline_;
        minimumBalanceRequired = minimumBalance_;
        coreController = ICoreController(coreController_);
    }

    /* methods */

    /// @notice Allows claiming tokens if address is part of merkle tree
    /// @param to address of claimer
    /// @param amount of tokens to claim
    /// @param proof merkle proof to prove address and amount are in tree
    function claim(
        address to,
        uint256 amount,
        bytes32[] calldata proof
    ) external override whenNotPaused {
        _claim(to, amount, proof, to);
    }

    /// @notice Allows claiming tokens on behalf of `claimer` if `claimer` is part of merkle tree
    /// @notice and msg.sender is a valid representative, usually voted by `claimer`'s community
    /// @param claimer address of claimer
    /// @param amount of tokens to claim
    /// @param proof merkle proof to prove address and amount are in tree
    function claimOnBehalfOf(
        address claimer,
        uint256 amount,
        bytes32[] calldata proof
    ) external override whenNotPaused {
        if (representatives[claimer] != msg.sender)
            revert InvalidRepresentative();

        _claim(claimer, amount, proof, msg.sender);
    }

    /// @notice Pause Claims
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice UnPause Claims
    function unPause() external onlyOwner {
        _unpause();
    }

    /// @notice return unclaimed token to treasury for community use
    function withdrawUnclaimed() external onlyOwner {
        if (block.timestamp < claimDeadline) {
            revert ActionPaused();
        }

        IERC20 _token = IERC20(token);
        uint256 balance = _token.balanceOf(address(this));
        _token.safeTransfer(msg.sender, balance);
        emit UnclaimedWithdrawn(balance, block.timestamp);
    }

    /// @notice Assigns/Unassign a Claimer representing a smart contract
    /// @dev in the case of a smart contract claimer where they assign
    /// @dev a rep to receive the claim, some through community votes
    function setRepresentative(address claimer, address representative)
        external
        onlyOwner
    {
        // Can only represent a contract
        if (!claimer.isContract()) {
            revert();
        }

        representatives[claimer] = representative;
        emit RepresentativeSet(claimer, representative);
    }

    /// @notice Sets/Update deadline
    /// @param newdeadline_ to claim until
    function setDeadline(uint64 newdeadline_) external onlyOwner {
        // Cache old deadline for use later
        uint64 former = claimDeadline;

        // Set new deadline
        claimDeadline = newdeadline_;

        // Emit event
        emit DeadlineUpdated(former, newdeadline_);
    }

    /// @notice Sets minimum savings requirements
    /// @param minimum_ amount of savings required to claim
    function setMinimumRequirement(uint256 minimum_) external onlyOwner {
        // Set new minimum requirement
        minimumBalanceRequired = minimum_;
    }

    /// @notice Sets protocol CoreController
    /// @param newcoreController_ new CoreController
    function setCoreController(address newcoreController_) external onlyOwner {
        // Set new coreController
        coreController = ICoreController(newcoreController_);
    }

    /* internal functions */
    function _claim(
        address claimer,
        uint256 amount,
        bytes32[] calldata proof,
        address recipient
    ) internal {
        // Throw when action happens before Start Time
        if (claimStarts > 0 && block.timestamp < claimStarts) {
            revert ActionPaused();
        }

        // Throw when action happens after deadline
        if (claimDeadline > 0 && block.timestamp > claimDeadline) {
            revert PastDeadline();
        }

        // Throw if claimer has already claimed tokens
        if (isClaimed[claimer]) {
            revert AlreadyClaimed();
        }

        // Verify the merkle proof.
        bytes32 node = keccak256(abi.encodePacked(claimer, amount));
        bool isValidNode = MerkleProof.verify(proof, merkleRoot, node);

        if (!isValidNode) {
            revert NotEligible();
        }

        if (address(coreController) != address(0x0)) {
            (uint256 savingsBalanceInBaseCurrency, , , , , ) = coreController
                .getAccountLiquidityData(recipient);

            if (savingsBalanceInBaseCurrency < minimumBalanceRequired)
                revert RequirementNotPassed();
        }

        // Mark address claimed
        isClaimed[claimer] = true;

        // Send the tokens
        IERC20(token).safeTransfer(recipient, amount);

        // Emit claimed event
        emit Claimed(claimer, amount);
    }
}
