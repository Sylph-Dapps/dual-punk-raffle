//SPDX-License-Identifier: MIT
pragma solidity >=0.8.19 <0.9.0;

interface IPointsCalculator {
  function calculatePoints(address addr, uint value) external view returns (address[] memory, uint128[] memory);
}