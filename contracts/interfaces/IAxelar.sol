// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IAxelar {
    function sendToken(
        string calldata destinationChain,
        string calldata destinationAddress,
        string calldata symbol,
        uint256 amount
    ) external;
}