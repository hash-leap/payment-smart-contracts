// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import { IAxelar }  from "./../interfaces/IAxelar.sol";

contract MyAxelarMock is IAxelar {
    function sendToken(
        string calldata destinationChain,
        string calldata destinationAddress,
        string calldata symbol,
        uint256 amount
    ) external {
        // complete
    }
}