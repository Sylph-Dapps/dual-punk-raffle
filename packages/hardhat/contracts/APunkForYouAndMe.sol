//SPDX-License-Identifier: MIT
pragma solidity >=0.8.19 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IPunkContract {
  function buyPunk(uint256 punkId) external payable;
  function transferPunk(address recipient, uint256 punkId) external;
}

contract APunkForYouAndMe is Ownable {
  event Deposited(address user, uint amount);
  event Withdrawn(address user, uint amount);
  event WinnerSelected(address winner);
  event PunkPurchased(address buyer, uint punkId);
  event EthClaimed(address addr, uint amount);

  address public punkContract; // TODO Set this
  
  uint256 public targetBalance;
  uint256 public totalDeposits;
  uint256 public remainingBalance;
  mapping(address => uint256) public deposits;
  address[] public depositors;
  address public winner;
  uint256 purchaseDeadline;
  bool ownerPurchased;
  bool winnerPurchased;
  bool public inClaimsMode;

  address public selectWinnerCaller;
  uint public gasToRefund;
  
  constructor() {}

  function setTargetBalance(uint _targetBalance) external onlyOwner {
    targetBalance = _targetBalance;
  }

  function getNumDepositors() public view returns (uint num) {
    return depositors.length;
  }

  function deposit() public payable {
    // TODO require a minimum donation to eliminate 1 wei spam
    require(msg.sender == tx.origin, "Only EOAs");
    //require(address(this).balance < targetBalance, "Target already met");
    require(msg.value > 0, "Deposit amount must be greater than zero.");

    if(deposits[msg.sender] == 0) {
      depositors.push(msg.sender);
    }
    deposits[msg.sender] += msg.value;
    totalDeposits += msg.value;
    remainingBalance += msg.value;
    
    emit Deposited(msg.sender, msg.value);
  }

  function withdraw(uint256 amount) public {
    // TODO Make this remove from deposits depositors array
    require(address(this).balance < targetBalance, "Target already met");
    require(deposits[msg.sender] >= amount, "Insufficient balance.");

    deposits[msg.sender] -= amount;
    totalDeposits -= amount;
    remainingBalance -= amount;

    (bool success,) = msg.sender.call{value: amount}("");
    if(!success) {
      revert("Failed to withdraw");
    }
    
    emit Withdrawn(msg.sender, amount);
  }

  function selectWinner() public {
    uint startingGas = gasleft();
    require(address(this).balance >= targetBalance, "Target not yet reached");
    //require(winner != address(0x0), "Winner already selected.");
    uint256 totalWeight = address(this).balance;

    //uint256 randomNum = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao))) % totalWeight;
    uint randomNum = totalWeight; // Exercise worst case

    uint256 cumulativeWeight = 0;
    for (uint256 i = 0; i < depositors.length; i++) {
        cumulativeWeight += deposits[depositors[i]];
        if (randomNum < cumulativeWeight) {
            winner = depositors[i];
            break;
        }
    }

    purchaseDeadline = block.timestamp + 30 days;

    emit WinnerSelected(winner);

    selectWinnerCaller = msg.sender;
    gasToRefund = (startingGas - gasleft()) * tx.gasprice;
  }

  function refundSelectWinnerGas() public {
    require(gasToRefund > 0, "gasToRefund must be greater than 0");
    require(address(this).balance > gasToRefund, "The contract must have enough ETH to refund the gas");
    require(selectWinnerCaller != address(0), "The selectWinnerCaller must be set");

    uint _gasToRefund = gasToRefund;
    gasToRefund = 0;
    
    address payable _selectWinnerCaller = payable(selectWinnerCaller);
    selectWinnerCaller = address(0);

    (bool success,) = _selectWinnerCaller.call{value: _gasToRefund}("");
    if(!success) {
      revert("Failed to refund gas");
    }
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
    require(amount <= totalDeposits/2, "amount exceeds budget");

    IPunkContract(punkContract).buyPunk{value: amount}(punkId);
    IPunkContract(punkContract).transferPunk(msg.sender, punkId);

    remainingBalance -= amount;

    if (msg.sender == owner()) {
      ownerPurchased = true;
    } else if (msg.sender == winner) {
      winnerPurchased = true;
    }

    if (ownerPurchased && winnerPurchased) {
      enterClaimsMode();
    }

    emit PunkPurchased(msg.sender, punkId);
  }

  function enterClaimsMode() public {
    require(
      // The owner can call the whole thing off before the winner has been drawn.
      (msg.sender == owner() && winner != address(0x0)) ||

      // Anyone can trigger claims mode if both the owner and winner have bought their punks...
      (ownerPurchased && winnerPurchased) ||

      // ...or if the purchase deadline has passed.
      (block.timestamp > purchaseDeadline),

      "Claims mode cannot be started yet"
    );
    inClaimsMode = true;
  }

  function claim() public {
    require(inClaimsMode, "Not in claims mode");
    require(deposits[msg.sender] > 0, "No deposits to claim");
    
    // The amount to claim should be the user's proportional share of the remainder relative to the amount they deposited
    uint256 claimableAmount = (remainingBalance * deposits[msg.sender]) / totalDeposits;
    deposits[msg.sender] = 0;
    remainingBalance -= claimableAmount;
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