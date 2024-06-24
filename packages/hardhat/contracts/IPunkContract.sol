//SPDX-License-Identifier: MIT
pragma solidity >=0.8.19 <0.9.0;

interface IPunkContract {
  function buyPunk(uint256 punkId) external payable;
  function transferPunk(address recipient, uint256 punkId) external;
}