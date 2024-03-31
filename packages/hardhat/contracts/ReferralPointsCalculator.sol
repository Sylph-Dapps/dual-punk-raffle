//SPDX-License-Identifier: MIT
pragma solidity >=0.8.19 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
//import "hardhat/console.sol";

interface IReferrerLookup {
  function getReferrer(address addr) external view returns (address referrer);
  function getAmountDeposited(address addr) external view returns (uint amount);
}

contract ReferralPointsCalculator is Ownable {

  IReferrerLookup referrerLookup;

  constructor() {}

  function setReferrerLookup(address _referrerLookup) public onlyOwner {
    referrerLookup = IReferrerLookup(_referrerLookup);
  }

  function calculatePoints(address addr, uint value) external view returns (address[] memory, uint[] memory) {
    address[] memory addresses = new address[](3);
    uint[] memory points = new uint[](3);

    // The base points are the amount of way sent to the contract
    // The effective points are doubled if using a referral from someone else
    uint numPoints = referrerLookup.getReferrer(addr) == address(0) ? value : value * 2;
    addresses[0] = addr;
    points[0] = numPoints;

    // The referrer gets 10% of the base points or the equivalant of their deposit amount in points, whichever is less
    address referrer = referrerLookup.getReferrer(addr);
    if (referrer != address(0)) {
      uint referrerPointsCap = referrerLookup.getAmountDeposited(referrer);
      uint referrerPossiblePoints = value / 10;
      addresses[1] = referrer;
      points[1] = referrerPossiblePoints < referrerPointsCap ? referrerPossiblePoints : referrerPointsCap;

      // The referrer's referrer gets 2% of the base points or the equivalant of their deposit amount in points, whichever is less
      address grandReferrer = referrerLookup.getReferrer(referrer);
      if (grandReferrer != address(0)) {
        uint grandReferrerPointsCap = referrerLookup.getAmountDeposited(grandReferrer);
        uint grandReferrerPossiblePoints = value / 50;
        addresses[2] = grandReferrer;
        points[2] = grandReferrerPossiblePoints < grandReferrerPointsCap ? grandReferrerPossiblePoints : grandReferrerPointsCap;
      }
    }

    return (addresses, points);
  }

}