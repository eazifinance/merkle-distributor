// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.0;

/* imports */
import "@openzeppelin/contracts/utils/Address.sol";
import "./interfaces/IMerkleDistributorVesting.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/finance/VestingWallet.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// @author eazi.finance
/// @title MerkleDistributor
/// @notice Allow EAZI to be claimable by eligible addresses
contract MerkleDistributorVesting is
    Ownable,
    Pausable,
    IMerkleDistributorVesting
{
    /* using for */
    using Address for address;
    using SafeERC20 for IERC20;

    /* states */

    /// @notice claims starts
    uint64 public claimStarts;
    /// @notice claims deadline
    uint64 public claimDeadline;

    /// @notice claimable token
    address public override token;
    /// @notice percentage to release
    uint256 public releasePercent;
    /// @notice distribution merkle root
    bytes32 public override merkleRoot;
    /// @notice vesting duration in seconds
    uint64 public vestingDuration;

    /// @notice Mapping of addresses claimed addresses
    mapping(address => bool) public override isClaimed;

    /* errors */

    /// @notice Thrown if claiming after deadline
    error PastDeadline();
    /// @notice Thrown if action happens before start
    error ActionPaused();
    /// @notice Thrown if address has already claimed
    error AlreadyClaimed();
    /// @notice Thrown if address/amount are not part of Merkle tree
    error NotEligible();

    /* methods */

    /// @notice Creates a new MerkleDistributor contract
    /// @param token_ claimable
    /// @param merkleRoot_ of claimers
    /// @param claimDeadline_ to claim until
    /// @param claimStarts_ to be paused before
    constructor(
        address token_,
        bytes32 merkleRoot_,
        uint64 claimStarts_,
        uint64 claimDeadline_
    ) {
        token = token_;
        releasePercent = 30;
        merkleRoot = merkleRoot_;
        vestingDuration = 90 days;
        claimStarts = claimStarts_;
        claimDeadline = claimDeadline_;
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

    /// @notice Sets/Update release percent
    /// @param newpercent_ to release immediately before vesting
    function setReleasePercent(uint256 newpercent_) external onlyOwner {
        // Cache old percent for use later
        uint256 former = releasePercent;

        // Set new percent
        releasePercent = newpercent_;

        // Emit event
        emit ReleasePercentUpdated(former, newpercent_);
    }

    /// @notice Sets/Update vesting duration
    /// @param newduration_ of the vesting wallet
    function setVestingDuration(uint64 newduration_) external onlyOwner {
        // 90 days deducted from every possible duration(180 days or 360 days)
        // Since 90 days will be added to the VestingWallet Duration
        if (newduration_ < 90 days || newduration_ > 270 days) {
            revert();
        }

        uint64 former = vestingDuration;

        vestingDuration = newduration_;

        // Emit event
        emit VestingDurationUpdated(former, newduration_);
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

        // Mark address claimed
        isClaimed[claimer] = true;

        uint256 releaseAmount = percentOf(releasePercent, amount);
        uint256 vestingAmount = amount - releaseAmount;

        IERC20 _token = IERC20(token);
        // Send the tokens(released) to recipient
        _token.safeTransfer(recipient, releaseAmount);

        VestingWallet vestingWallet = new VestingWallet(
            recipient,
            claimStarts + 90 days,
            vestingDuration
        );

        address vestingWalletAddr = address(vestingWallet);

        emit VestingWalletCreated(recipient, vestingWalletAddr);

        // Send the tokens(unreleased) to VestingWallet
        _token.safeTransfer(vestingWalletAddr, vestingAmount);

        // Emit claimed event
        emit Claimed(claimer, releaseAmount);
    }

    function percentOf(uint256 percent, uint256 value)
        internal
        pure
        returns (uint256)
    {
        return ((value * percent) / 100);
    }
}
