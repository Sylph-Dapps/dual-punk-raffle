//SPDX-License-Identifier: MIT
pragma solidity >=0.8.19 <0.9.0;

contract EtherForwarder {

  address public addr;

  function setAddress(address _addr) public {
    addr = _addr;
  }

  function send() public payable {
    (bool _success,) = addr.call{value: msg.value}("");
    require(_success, "Failed to send");
  }
}