//SPDX-License-Identifier: MIT
pragma solidity >=0.8.19 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IPunkContract {
  function buyPunk(uint256 punkId) external payable;
  function transferPunk(address recipient, uint256 punkId) external;
}

contract APunkForYouAndMe is Ownable {
  event Deposited(address user, uint amount);
  event WinnerSelected(address winner);
  event PunkPurchased(address buyer, uint punkId);
  event EthClaimed(address addr, uint amount);

  struct Deposit {
    address depositor;
    uint256 start;
    uint256 end;
  }

  address public punksContract;

  uint256 public targetBalance;
  uint256 public totalDeposited;
  uint256 public postPunkPurchasesBalance;
  Deposit[] public deposits;
  mapping(address => uint256) public addressesToAmountDeposited;
  address public winner;
  uint256 public purchaseDeadline;
  bool public ownerPurchased;
  bool public winnerPurchased;
  bool public inClaimsMode;

  constructor() {}

  function setPunksContract(address addr) external onlyOwner {
    punksContract = addr;
  }

  function setTargetBalance(uint _targetBalance) external onlyOwner {
    require(winner == address(0));
    targetBalance = _targetBalance;
  }

  function getNumDeposits() public view returns (uint num) {
    return deposits.length;
  }

  function getAmountDeposited(address addr) public view returns (uint amount) {
    return addressesToAmountDeposited[addr];
  }

  /*function getNumDepositors() public view returns (uint num) {
    return depositors.length;
  }*/

  function deposit() public payable {
    require(msg.sender == tx.origin, "Only EOAs");
    require(msg.sender != owner(), "No double dipping!");
    require(msg.value > 0.0001 ether, "Don't be cheap!");
    require(address(this).balance - msg.value < targetBalance, "Target already met");
    require(winner == address(0), "Winner already selected");

    Deposit memory newDeposit = Deposit(
      msg.sender,
      address(this).balance - msg.value,
      address(this).balance - 1 // If the first depositor sends 5 wei, start and end are 0 and 4.
    );
    deposits.push(newDeposit);

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
    uint256 high = deposits.length - 1;

    while (low <= high) {
        uint256 mid = (low + high) / 2;
        Deposit memory midDeposit = deposits[mid];

        if (randomNum >= midDeposit.start && randomNum <= midDeposit.end) {
            winner = midDeposit.depositor;
            break;
        } else if (randomNum < midDeposit.start) {
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

    IPunkContract(punksContract).buyPunk{value: amount}(punkId);
    IPunkContract(punksContract).transferPunk(msg.sender, punkId);

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

    // The amount to claim should be the user's proportional share of the remainder relative to the amount they deposited
    return (postPunkPurchasesBalance * addressesToAmountDeposited[addr]) / totalDeposited;
  }

  // TODO add a sweep function that can be called after the claim period ends
  // TODO nix the winner's deposit and give it to everyone else
  function claim() public {
    require(inClaimsMode, "Not in claims mode");
    require(addressesToAmountDeposited[msg.sender] > 0, "No deposit to claim");

    uint256 claimableAmount = getClaimAmount(msg.sender);
    addressesToAmountDeposited[msg.sender] = 0;
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