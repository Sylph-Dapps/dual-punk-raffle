//SPDX-License-Identifier: MIT
pragma solidity >=0.8.19 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IPunkContract.sol";
import "./IPointsCalculator.sol";
import "./IReferrerLookup.sol";
import "./IFacilitated.sol";

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

contract APunkForYouAndMe is Ownable, IReferrerLookup, IFacilitated {
  event Deposited(address user, uint amount);
  event WinnerSelected(address winner, address selectWinnerCaller);
  event PunkPurchased(address buyer, uint punkId);
  event EthClaimed(address addr, uint amount);

  struct Entry {
    address addr;
    uint128 start;
    uint128 end;
  }

  IPointsCalculator public pointsCalculator;

  IPunkContract public punksContract;

  uint128 public totalPoints;
  mapping(address => uint128) public addressesToPoints;

  uint256 public targetBalance;
  uint256 public totalDeposited;
  Entry[] public entries;
  mapping(address => uint256) public addressesToAmountDeposited;
  mapping(address => bool) public addressesToClaimedStatus;

  uint64 public revealBlock;
  address public winner;
  address public selectWinnerCaller;
  uint256 public purchaseDeadline;
  bool public ownerPurchased;
  bool public winnerPurchased;
  uint256 public postPunkPurchasesBalance;
  bool public inClaimsMode;
  uint256 public claimDeadline;

  mapping(address => address) referrers;

  constructor() {}

  function setEntryCalculator(address addr) external onlyOwner {
    pointsCalculator = IPointsCalculator(addr);
  }

  function setPunksContract(address addr) external onlyOwner {
    punksContract = IPunkContract(addr);
  }

  function setTargetBalance(uint _targetBalance) external onlyOwner {
    require(winner == address(0));
    targetBalance = _targetBalance;
  }

  function getNumEntries() public view returns (uint num) {
    return entries.length;
  }

  function getAmountDeposited(address addr) public view returns (uint amount) {
    return addressesToAmountDeposited[addr];
  }

  function getReferrer(address addr) external view returns (address referrer) {
    return referrers[addr];
  }

  function getPointsForAddress(address addr) public view returns (uint points) {
    return addressesToPoints[addr];
  }

  function getFacilitator() external view returns (address _address) {
    return selectWinnerCaller;
  }

  function depositWithReferrer(address referrer) public payable {
    if(referrers[msg.sender] != address(0) && referrers[msg.sender] != referrer) revert InvalidReferrer();
    if(msg.sender == referrer) revert CannotReferSelf();
    if(addressesToAmountDeposited[referrer] == 0) revert ReferrerMustHaveDeposited();

    referrers[msg.sender] = referrer;
    deposit();
  }

  function deposit() public payable {
    if(msg.sender != tx.origin) revert OnlyEOAs();
    if(msg.sender == owner()) revert NoDoubleDipping();
    if(msg.value < 0.0001 ether) revert NotEnoughEth();
    if(address(this).balance - msg.value >= targetBalance) revert TargetAlreadyMet();
    if(winner != address(0)) revert WinnerAlreadySelected();

    address[] memory addresses;
    uint128[] memory pointAmounts;
    (addresses, pointAmounts) = pointsCalculator.calculatePoints(msg.sender, msg.value);

    uint128 _totalPoints = totalPoints;

    for(uint i = 0; i < addresses.length;) {
      if(addresses[i] == address(0)) {
        break;
      }

      Entry memory newEntry = Entry(
        addresses[i],
        _totalPoints,
        _totalPoints + pointAmounts[i]
      );
      entries.push(newEntry);

      addressesToPoints[addresses[i]] += pointAmounts[i];
      _totalPoints += pointAmounts[i];

      unchecked { i++; }
    }

    totalPoints = _totalPoints;

    totalDeposited += msg.value;
    addressesToAmountDeposited[msg.sender] += msg.value;

    emit Deposited(msg.sender, msg.value);
  }

  function commitToBlock() public {
    if(address(this).balance < targetBalance) revert TargetNotMet();
    if(winner != address(0)) revert WinnerAlreadySelected();

    if (revealBlock == 0 || block.number > revealBlock + 256) {
        revealBlock = uint64(block.number + 50);
    } else {
        revert AlreadyCommitted();
    }
  }

  function selectWinner() public {
    if(revealBlock == 0) revert HaveNotCommittedToABlock();
    if(block.number <= revealBlock) revert HaveNotPassedCommittedBlock();
    if(block.number > revealBlock + 256) revert MissedCommittedBlock();
    if(winner != address(0)) revert WinnerAlreadySelected();

    // Pick a number between 0 and the the total number of points
    uint256 randomNum = uint256(
      keccak256(
        abi.encodePacked(
          blockhash(revealBlock),
          block.prevrandao,
          block.timestamp
        )
      )
    ) % totalPoints;

    // Use binary search to find the entry where the start and end bound the randomly selected value
    uint256 low = 0;
    uint256 high = entries.length - 1;

    while (low <= high) {
        uint256 mid = (low + high) / 2;
        Entry memory midEntry = entries[mid];

        if (randomNum >= midEntry.start && randomNum <= midEntry.end) {
            winner = midEntry.addr; // The address who made that deposit is the winner
            break;
        } else if (randomNum < midEntry.start) {
            high = mid - 1;
        } else {
            low = mid + 1;
        }
    }

    postPunkPurchasesBalance = address(this).balance;
    purchaseDeadline = block.timestamp + 365 days;
    selectWinnerCaller = msg.sender;

    emit WinnerSelected(winner, selectWinnerCaller);
  }

  function buyPunk(uint punkId, uint amount) public {
    if(msg.sender == owner()) {
      if(ownerPurchased) revert OwnerAlreadyPurchased();
    } else if(msg.sender == winner) {
      if(winnerPurchased) revert WinnerAlreadyPurchased();
    } else {
      revert AddressCannotBuyPunk();
    }
    if(block.timestamp >= purchaseDeadline) revert DeadlineHasPassed();
    if(amount > totalDeposited/2) revert AmountExceedsBudget();

    postPunkPurchasesBalance -= amount;

    if (msg.sender == owner()) {
      ownerPurchased = true;
    } else if (msg.sender == winner) {
      winnerPurchased = true;
    }

    punksContract.buyPunk{value: amount}(punkId);
    punksContract.transferPunk(msg.sender, punkId);

    emit PunkPurchased(msg.sender, punkId);
  }

  function enterClaimsMode() public {
    if(!(
      // The owner can call the whole thing off before the winner has been drawn.
      (msg.sender == owner() && winner == address(0)) ||

      // Anyone can trigger claims mode if both the owner and winner have bought their punks...
      (ownerPurchased && winnerPurchased) ||

      // ...or if the purchase deadline is set and has passed.
      (purchaseDeadline != 0 && block.timestamp > purchaseDeadline)
    )) {
      revert CannotStartClaimsMode();
    }
    inClaimsMode = true;
    claimDeadline = block.timestamp + 60 days;
  }

  function getClaimAmount(address addr) public view returns (uint claimableAmount) {
    if(!inClaimsMode) revert NotInClaimsMode();

    // After all funds have been claimed or swept there is nothing left to claim
    if(address(this).balance == 0) {
      return 0;
    }

    // The winner doesn't get to reclaim any of their deposit. They are taking home a punk!
    if(addr == winner) {
      return 0;
    }

    // If you've already claimed you have no amount left to claim.
    if(addressesToClaimedStatus[addr]) {
      return 0;
    }

    // The amount to claim should be the user's proportional share of the remainder (minus the winner's contribution) relative to the amount they deposited
    return (postPunkPurchasesBalance * addressesToAmountDeposited[addr]) / (totalDeposited - addressesToAmountDeposited[winner]);
  }

  function claim() public {
    if(!inClaimsMode) revert NotInClaimsMode();

    uint256 claimableAmount = getClaimAmount(msg.sender);
    if(claimableAmount == 0) revert NothingToClaim();

    addressesToClaimedStatus[msg.sender] = true;
    (bool success,) = msg.sender.call{value: claimableAmount}("");
    if(!success) {
      revert FailedToClaim();
    }
    emit EthClaimed(msg.sender, claimableAmount);
  }

  function sweep() public onlyOwner() {
    if(block.timestamp < claimDeadline) revert ClaimsPeriodStillActive();
    (bool success,) = msg.sender.call{value: address(this).balance}("");
    if(!success) {
      revert FailedToSweep();
    }
  }

  receive() external payable {
    deposit();
  }
}