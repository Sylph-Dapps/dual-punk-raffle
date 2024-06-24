//SPDX-License-Identifier: MIT
pragma solidity >=0.8.19 <0.9.0;

import "./IPointsCalculator.sol";

// BasicPointsCalculator simply gives two points per every 1 wei deposited
contract BasicPointsCalculator is IPointsCalculator {

  constructor() {}

  function calculatePoints(address addr, uint value) external view returns (address[] memory, uint128[] memory) {
    address[] memory addresses = new address[](3);
    uint128[] memory points = new uint128[](3);

    addresses[0] = addr;
    points[0] = uint128(value * 2);
    return (addresses, points);
  }

}