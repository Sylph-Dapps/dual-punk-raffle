//SPDX-License-Identifier: MIT
pragma solidity >=0.8.19 <0.9.0;

import "./IFacilitated.sol";

contract DummyFacilitatedContract is IFacilitated {

  address public facilitator;

  function getFacilitator() external view returns (address _address) {
    return facilitator;
  }

  function setFacilitator(address _facilitator) public {
    facilitator = _facilitator;
  }

}