//SPDX-License-Identifier: MIT
pragma solidity >=0.8.19 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IPointsCalculator.sol";
import "./IReferrerLookup.sol";

contract ReferralPointsCalculator is Ownable, IPointsCalculator {

  IReferrerLookup referrerLookup;

  constructor() {}

  function setReferrerLookup(address _referrerLookup) public onlyOwner {
    referrerLookup = IReferrerLookup(_referrerLookup);
  }

  function calculatePoints(address addr, uint value) external view returns (address[] memory, uint128[] memory) {
    address[] memory addresses = new address[](3);
    uint128[] memory points = new uint128[](3);

    // The base points are the amount of way sent to the contract
    // The effective points are doubled if using a referral from someone else
    uint128 numPoints = uint128(referrerLookup.getReferrer(addr) == address(0) ? value : value * 2);
    addresses[0] = addr;
    points[0] = numPoints;

    // The referrer gets 10% of the base points or the equivalant of their deposit amount in points, whichever is less
    address referrer = referrerLookup.getReferrer(addr);
    if (referrer != address(0)) {
      uint128 referrerPointsCap = uint128(referrerLookup.getAmountDeposited(referrer));
      uint128 referrerPossiblePoints = uint128(value / 10);
      addresses[1] = referrer;
      points[1] = referrerPossiblePoints < referrerPointsCap ? referrerPossiblePoints : referrerPointsCap;

      // The referrer's referrer gets 2% of the base points or the equivalant of their deposit amount in points, whichever is less
      address grandReferrer = referrerLookup.getReferrer(referrer);
      if (grandReferrer != address(0)) {
        uint128 grandReferrerPointsCap = uint128(referrerLookup.getAmountDeposited(grandReferrer));
        uint128 grandReferrerPossiblePoints = uint128(value / 50);
        addresses[2] = grandReferrer;
        points[2] = grandReferrerPossiblePoints < grandReferrerPointsCap ? grandReferrerPossiblePoints : grandReferrerPointsCap;
      }
    }

    return (addresses, points);
  }

}