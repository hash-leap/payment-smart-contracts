// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/******************************************************************************\
* Author: Nasir Jamal <nas@hashleap.io> (https://twitter.com/_nasj)
* Description: Contract to transfer money between different parties along
* additional functionalities like tagging, etc.
/******************************************************************************/

interface ISpotPaymentFacetV1 {
    /// @notice Transfers the token to the address
    /// @param _sender The address of the token sender
    /// @param _recipient The address of the token receiver
    /// @param _erc20Address The address of the ERC20 token on the chain
    /// @param _amount The amount to be transferred from the _sender to the _receiver
    /// @return `true` if completed successfully
    function transfer(address _sender, address _recipient, address _erc20Address, uint256 _amount) external returns(bool);

    event TransferSuccessEvent(address sender, string text, uint256 amount, address recipient);
}