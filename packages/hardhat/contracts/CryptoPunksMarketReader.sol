//SPDX-License-Identifier: MIT
pragma solidity ^0.4.8;

import "./CryptoPunksMarket.sol";

contract CryptoPunksMarketReader {
  CryptoPunksMarket public punksContract;

  function setPunksContract(address _addr) public {
    punksContract = CryptoPunksMarket(_addr);
  }

  function ownerOf(uint punkId) public returns (address addr) {
    return punksContract.punkIndexToAddress(punkId);
  }
}