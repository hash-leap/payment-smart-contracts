//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.14;

contract SpotPaymentFacet {
    event TestEvent(address something);

    function test1Func1() external pure returns(uint a){
        a = 1;
        return a;
    }

    function supportsInterface(bytes4 _interfaceID) external view returns (bool) {}
}