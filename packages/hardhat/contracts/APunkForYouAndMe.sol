// Make points mode toggleable from basic to referral

//SPDX-License-Identifier: MIT
pragma solidity >=0.8.19 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
//import "hardhat/console.sol";

interface IPunkContract {
  function buyPunk(uint256 punkId) external payable;
  function transferPunk(address recipient, uint256 punkId) external;
}

interface IPointsCalculator {
  function calculatePoints(address addr, uint value) external view returns (address[] memory, uint[] memory);
}

contract APunkForYouAndMe is Ownable {
  event Deposited(address user, uint amount);
  event WinnerSelected(address winner);
  event PunkPurchased(address buyer, uint punkId);
  event EthClaimed(address addr, uint amount);

  struct Entry {
    address addr;
    uint256 start;
    uint256 end;
  }

  IPointsCalculator public pointsCalculator;

  IPunkContract public punksContract;

  uint256 public totalPoints;
  mapping(address => uint256) public addressesToPoints;

  uint256 public targetBalance;
  uint256 public totalDeposited;
  Entry[] public entries;
  mapping(address => uint256) public addressesToAmountDeposited;
  mapping(address => bool) public addressesToClaimedStatus;

  address public winner;
  uint256 public purchaseDeadline;
  bool public ownerPurchased;
  bool public winnerPurchased;
  uint256 public postPunkPurchasesBalance;
  bool public inClaimsMode;

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

  /*function getNumDepositors() public view returns (uint num) {
    return depositors.length;
  }*/

  function depositWithReferrer(address referrer) public payable {
    require(referrers[msg.sender] == address(0) || referrers[msg.sender] == referrer, "Storage referrer must be unset or be the same referrer previously used");
    require(msg.sender != referrer, "Cannot refer yourself");
    require(addressesToAmountDeposited[referrer] > 0, "referrer must have previously deposited funds");
    referrers[msg.sender] = referrer;
    deposit();
  }

  function deposit() public payable {
    require(msg.sender == tx.origin, "Only EOAs");
    require(msg.sender != owner(), "No double dipping!");
    require(msg.value > 0.0001 ether, "Don't be cheap!");
    require(address(this).balance - msg.value < targetBalance, "Target already met");
    require(winner == address(0), "Winner already selected");

    address[] memory addresses;
    uint256[] memory pointAmounts;
    (addresses, pointAmounts) = pointsCalculator.calculatePoints(msg.sender, msg.value);
    for(uint i = 0; i < addresses.length; i++) {
      if(addresses[i] == address(0)) {
        break;
      }

      Entry memory newEntry = Entry(
        addresses[i],
        totalPoints,
        totalPoints + pointAmounts[i]
      );
      entries.push(newEntry);

      addressesToPoints[addresses[i]] += pointAmounts[i];
      totalPoints += pointAmounts[i];
    }

    totalDeposited += msg.value;
    postPunkPurchasesBalance += msg.value;
    addressesToAmountDeposited[msg.sender] += msg.value;

    emit Deposited(msg.sender, msg.value);
  }

  function selectWinner() public {
    require(address(this).balance >= targetBalance, "Target not yet reached");
    require(winner == address(0), "Winner has already been selected");

    uint256 randomNum = uint256(
      keccak256(
        abi.encodePacked(block.timestamp, block.prevrandao)
      )
    ) % address(this).balance;

    // Use binary search to find the entry where the start and end bound the generated value
    uint256 low = 0;
    uint256 high = entries.length - 1;

    while (low <= high) {
        uint256 mid = (low + high) / 2;
        Entry memory midEntry = entries[mid];

        if (randomNum >= midEntry.start && randomNum <= midEntry.end) {
            winner = midEntry.addr;
            break;
        } else if (randomNum < midEntry.start) {
            high = mid - 1;
        } else {
            low = mid + 1;
        }
    }

    purchaseDeadline = block.timestamp + 30 days;

    emit WinnerSelected(winner);
  }

  function buyPunk(uint punkId, uint amount) public {
    if(msg.sender == owner()) {
      require(!ownerPurchased, "Owner has already purchased a punk");
    } else if(msg.sender == winner) {
      require(!winnerPurchased, "Winner has already purchased a punk");
    } else {
      revert("Only the owner and the winner can call this function");
    }
    require(block.timestamp < purchaseDeadline, "deadline has passed");
    require(amount <= totalDeposited/2, "amount exceeds budget");

    punksContract.buyPunk{value: amount}(punkId);
    punksContract.transferPunk(msg.sender, punkId);

    postPunkPurchasesBalance -= amount;

    if (msg.sender == owner()) {
      ownerPurchased = true;
    } else if (msg.sender == winner) {
      winnerPurchased = true;
    }

    emit PunkPurchased(msg.sender, punkId);
  }

  function enterClaimsMode() public {
    require(
      // The owner can call the whole thing off before the winner has been drawn.
      (msg.sender == owner() && winner == address(0)) ||

      // Anyone can trigger claims mode if both the owner and winner have bought their punks...
      (ownerPurchased && winnerPurchased) ||

      // ...or if the purchase deadline is set and has passed.
      (purchaseDeadline != 0 && block.timestamp > purchaseDeadline),

      "Claims mode cannot be started yet"
    );
    inClaimsMode = true;
  }

  function getClaimAmount(address addr) public view returns (uint claimableAmount) {
    require(inClaimsMode, "Not in claims mode");

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

  // TODO add a sweep function that can be called after the claim period ends
  // TODO nix the winner's deposit and give it to everyone else
  function claim() public {
    require(inClaimsMode, "Not in claims mode");
    
    uint256 claimableAmount = getClaimAmount(msg.sender);
    require(claimableAmount > 0, "Nothing to claim");

    addressesToClaimedStatus[msg.sender] = true;
    (bool success,) = msg.sender.call{value: claimableAmount}("");
    if(!success) {
      revert("Failed to claim");
    }
    emit EthClaimed(msg.sender, claimableAmount);
  }

  receive() external payable {
    deposit();
  }
}