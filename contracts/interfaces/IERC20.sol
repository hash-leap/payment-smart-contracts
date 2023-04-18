// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/******************************************************************************\
* Author: Nasir Jamal <nas@hashleap.io> (https://twitter.com/_nasj)
* Description: Contract to transfer money between different parties along
* additional functionalities like tagging, etc.
/******************************************************************************/

/// @notice standard ERC20 interface
interface IERC20 {
    function totalSupply() external view returns (uint);

    function balanceOf(address account) external view returns (uint256);

    function transfer(address recipient, uint amount) external returns (bool);

    function allowance(address owner, address spender) external view returns (uint);

    function approve(address spender, uint amount) external returns (bool);

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);

    event Transfer(address indexed from, address indexed to, uint value);
    event Approval(address indexed owner, address indexed spender, uint value);
}
