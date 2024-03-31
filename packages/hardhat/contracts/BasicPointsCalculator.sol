//SPDX-License-Identifier: MIT
pragma solidity >=0.8.19 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract BasicPointsCalculator is Ownable {

  constructor() {}

  function calculatePoints(address addr, uint value) external pure returns (address[] memory, uint[] memory) {
    address[] memory addresses = new address[](3);
    uint[] memory points = new uint[](3);

    addresses[0] = addr;
    points[0] = value;

    return (addresses, points);
  }

}