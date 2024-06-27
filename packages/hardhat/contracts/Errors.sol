//SPDX-License-Identifier: MIT
pragma solidity >=0.8.19 <0.9.0;

error InvalidContributionMode(); // Each deposit function can only be used during the corresponding modes
error InvalidProject(); // Don't allow deposits referencing unapproved projects
error NotAHolder(); // Don't allow deposits from users falsely claiming to hold an approved project
error InvalidReferrer(); // The referrer in storage must be unset or be the same referrer the sender previously used.
error CannotReferSelf(); // Points program operators hate this one weird trick!
error ReferrerMustHaveDeposited(); // In order to refer others, a user must have first deposited into the contract.
error OnlyEOAs(); // Let's not get into a mess where a smart contract address wins a punk and bad logic locks it away. EOAs only.
error NoDoubleDipping(); // Do not allow the contract owner to deposit. It will break `buyPunk` if they win.
error NotEnoughEth(); // Minimimum deposit size so we don't end up with people depositing miniscule amounts.
error TargetAlreadyMet(); // Do not allow more deposits after the balance reaches the target.
error AlreadyCommitted(); // The block to use for randomness is already valid (unset or fewer than 256 blocks before the current block)
error HaveNotCommittedToABlock(); // We can't select a winner until the we've committed to a block
error HaveNotPassedCommittedBlock(); // We cannot pick a winner until the current block passes the revealBlock so we can call blockhash on that block
error MissedCommittedBlock(); // We're too far beyond the committed block to use blockhash so have to re-set revealBlock
error WinnerAlreadySelected(); // No deposits after the winner has already been selected.
error TargetNotMet(); // Do not allow the winner to be selected until the balance reacheds the target.
error OwnerAlreadyPurchased(); // Only allow the owner to purchase one punk.
error WinnerAlreadyPurchased(); // Only allow the winner to purchase one punk.
error AddressCannotBuyPunk(); // Prevent calling `buyPunk` by anyone other than the contract owner and the winner.
error DeadlineHasPassed(); // Require the owner and winner to buy their punks within a certain timeframe.
error AmountExceedsBudget(); // The contract owner and the winner can each use no more than half of the amount deposited.
error CannotStartClaimsMode(); // Claims mode can only be started under certain conditions.
error NotInClaimsMode(); // Don't allow claims before we've entered claims mode.
error NothingToClaim(); // Do not allow anyone to claim if there is no balance for them to claim.
error FailedToClaim(); // Make sure transferring ETH is successful when calling `claim`.
error ClaimsPeriodStillActive(); // The owner cannot sweep funds until after claims mode has run for two months.
error FailedToSweep(); // Make sure transferring ETH is successful when calling `sweep`.
