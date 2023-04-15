//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.14;

contract SpotPaymentFacetV1 {
    event TestEvent(address something);

    function test1Func1() external pure returns(uint a){
        a = 2;
        return a;
    }
}