//SPDX-License-Identifier: MIT
pragma solidity >=0.8.19 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IFacilitated.sol";

error IllegalState();
error NotFacilitator();
error NoBalance();

contract AndALittleSomethingForSomeoneElse is Ownable {
  event FacilitatedContractSet(address facilitatedContract);
  event Deposited(uint256 amount);
  event Withdrawn();
  event Sealed();
  event UnsealingStarted(uint256 timestamp);
  event Unsealed();
  event Claimed(address indexed claimer);

  enum State {
    Unsealed,
    Sealed,
    Unsealing,
    Claimed
  }
  State private _state;
  uint256 public unsealingTimestamp;
  uint256 public constant UNSEALING_PERIOD = 7 days;
  IFacilitated public facilitatedContract;

  constructor() {
    _state = State.Unsealed;
  }

  function setFacilitatedContract(address _facilitatedContract) external onlyOwner {
    if(currentState() != State.Unsealed) revert IllegalState();
    facilitatedContract = IFacilitated(_facilitatedContract);
    emit FacilitatedContractSet(_facilitatedContract);
  }

  function deposit() external payable onlyOwner {
    if(currentState() == State.Claimed) revert IllegalState();
    emit Deposited(msg.value);
  }

  function seal() external onlyOwner {
    if(currentState() != State.Unsealed && currentState() != State.Unsealing) revert IllegalState();
    _state = State.Sealed;
    emit Sealed();
  }

  function unseal() external onlyOwner {
    if(currentState() != State.Sealed) revert IllegalState();
    _state = State.Unsealing;
    unsealingTimestamp = block.timestamp;
    emit UnsealingStarted(unsealingTimestamp);
  }

  function withdraw() external onlyOwner {
    if(currentState() != State.Unsealed) revert IllegalState();
    uint256 balance = address(this).balance;
    if(balance == 0) revert NoBalance();
    _state = State.Unsealed;
    payable(owner()).transfer(address(this).balance);
    emit Withdrawn();
  }

  function claim() external {
    if(facilitatedContract.getFacilitator() != msg.sender) revert NotFacilitator();
    uint256 balance = address(this).balance;
    if(balance == 0) revert NoBalance();
    _state = State.Claimed;
    payable(msg.sender).transfer(balance);
    emit Claimed(msg.sender);
  }

  function currentState() public view returns (State) {
    if (_state == State.Unsealing && block.timestamp >= unsealingTimestamp + UNSEALING_PERIOD) {
      return State.Unsealed;
    }
    return _state;
  }

  function getState() external view returns (string memory) {
    State __state = currentState();
    if (__state == State.Sealed) return "Sealed";
    if (__state == State.Unsealing) return "Unsealing";
    if (__state == State.Unsealed) return "Unsealed";
    if (__state == State.Claimed) return "Claimed";
    return "Unknown";
  }
}
