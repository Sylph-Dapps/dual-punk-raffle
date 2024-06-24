//SPDX-License-Identifier: MIT
pragma solidity >=0.8.19 <0.9.0;

interface IFacilitated {
  function getFacilitator() external view returns (address _address);
}