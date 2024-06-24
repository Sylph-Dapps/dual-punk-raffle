//SPDX-License-Identifier: MIT
pragma solidity >=0.8.19 <0.9.0;

interface IReferrerLookup {
  function getReferrer(address addr) external view returns (address referrer);
  function getAmountDeposited(address addr) external view returns (uint amount);
}