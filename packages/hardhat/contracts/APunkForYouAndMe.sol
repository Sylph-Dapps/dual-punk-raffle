/*
Implement allowlist
Implement project mode
 - compile list of founders and key community members and map to contract addresses
 - require ping from address to enable for each project
*/

//SPDX-License-Identifier: MIT
pragma solidity >=0.8.19 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./IPunkContract.sol";
import "./IReferrerLookup.sol";
import "./IFacilitated.sol";
import "./Errors.sol";

contract APunkForYouAndMe is Ownable, IReferrerLookup, IFacilitated {
  event Deposited(address user, uint amount);
  event WinnerSelected(address winner, address selectWinnerCaller);
  event PunkPurchased(address buyer, uint punkId);
  event EthClaimed(address addr, uint amount);

  IPunkContract public punksContract;

  // Vars for the various contribution modes' features
  enum ContributionMode {
    Allowlist, // In allowlist mode only addresses on the allowlist can contribute
    Projects, // In projects mode holders of particular projects can contribute along with allowlist members
    Basic, // In basic mode everyone can contribute with a 2x multiplier on points
    Referrerals // In this mode everyone can contribute at 1x but with the referrals mechanic
  }
  ContributionMode private contributionMode;
  mapping(address => bool) allowedProjects;
  mapping(address => address) referrers;

  // Vars for point tracking
  struct Entry {
    address addr;
    uint128 start;
    uint128 end;
  }
  Entry[] public entries;
  uint128 public totalPoints;
  mapping(address => uint128) public addressesToPoints;

  // Vars for ETH tracking
  uint256 public targetBalance;
  uint256 public totalDeposited;
  mapping(address => uint256) public addressesToAmountDeposited;
  mapping(address => bool) public addressesToClaimedStatus;

  // Vars for the climax and denouement: raffle resolution, punk purchasing, and ETH claiming
  uint64 public revealBlock;
  address public winner;
  address public selectWinnerCaller;
  uint256 public purchaseDeadline;
  bool public ownerPurchased;
  bool public winnerPurchased;
  uint256 public postPunkPurchasesBalance;
  bool public inClaimsMode;
  uint256 public claimDeadline;

  constructor() {}

  function setContributionMode(ContributionMode mode) external onlyOwner {
    contributionMode = mode;
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

  function getReferrer(address addr) public view returns (address referrer) {
    return referrers[addr];
  }

  function getPointsForAddress(address addr) public view returns (uint points) {
    return addressesToPoints[addr];
  }

  function getFacilitator() external view returns (address _address) {
    return selectWinnerCaller;
  }

  function depositFromAllowlist() public payable {
    // Once referral mode is activated, contributing as an allowlist member would net more points,
    // and that is unfair to the little guys who waited to get to contribute, so deactivate
    // allowlist contributions.
    if(contributionMode == ContributionMode.Referrerals) revert InvalidContributionMode();
    deposit();
  }

  function depositWithProject(address project) public payable {
    // Like allowlist mode, once referral mode is activated we need to so deactivate project-based
    // contributions in the spirit of fairness to the general public.
    if(contributionMode == ContributionMode.Referrerals) revert InvalidContributionMode();
    if(!allowedProjects[project]) revert InvalidProject(); // TODO implement allowing projects
    if(IERC721(project).balanceOf(msg.sender) == 0) revert NotAHolder();

    deposit();
  }

  function depositWithReferrer(address referrer) public payable {
    if(contributionMode != ContributionMode.Referrerals) revert InvalidContributionMode();
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

    if(contributionMode == ContributionMode.Referrerals) {
      // Referral mode requires computing points for multiple addresses
      address[] memory addresses;
      uint128[] memory pointAmounts;
      (addresses, pointAmounts) = calculateReferralModePoints(msg.sender, msg.value);
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
    } else {
      // Basic is a straight multiplication to determine the number of points for msg.sender
      uint128 pointsAmount = uint128(msg.value * 2);
      Entry memory newEntry = Entry(
        msg.sender,
        totalPoints,
        totalPoints + pointsAmount
      );
      entries.push(newEntry);
      addressesToPoints[msg.sender] += pointsAmount;
      totalPoints += pointsAmount;
    }

    totalDeposited += msg.value;
    addressesToAmountDeposited[msg.sender] += msg.value;

    emit Deposited(msg.sender, msg.value);
  }

  function calculateReferralModePoints(address addr, uint value) public view returns (address[] memory, uint128[] memory) {
    address[] memory addresses = new address[](3);
    uint128[] memory points = new uint128[](3);

    // The base points are the amount of wei sent to the contract
    // The effective points are doubled if using a referral from someone else
    uint128 numPoints = uint128(getReferrer(addr) == address(0) ? value : value * 2);
    addresses[0] = addr;
    points[0] = numPoints;

    // The referrer gets 10% of the base points or the equivalant of their deposit amount in points, whichever is less
    address referrer = getReferrer(addr);
    if (referrer != address(0)) {
      uint128 referrerPointsCap = uint128(getAmountDeposited(referrer));
      uint128 referrerPossiblePoints = uint128(value / 10);
      addresses[1] = referrer;
      points[1] = referrerPossiblePoints < referrerPointsCap ? referrerPossiblePoints : referrerPointsCap;

      // The referrer's referrer gets 2% of the base points or the equivalant of their deposit amount in points, whichever is less
      address grandReferrer = getReferrer(referrer);
      if (grandReferrer != address(0)) {
        uint128 grandReferrerPointsCap = uint128(getAmountDeposited(grandReferrer));
        uint128 grandReferrerPossiblePoints = uint128(value / 50);
        addresses[2] = grandReferrer;
        points[2] = grandReferrerPossiblePoints < grandReferrerPointsCap ? grandReferrerPossiblePoints : grandReferrerPointsCap;
      }
    }

    return (addresses, points);
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