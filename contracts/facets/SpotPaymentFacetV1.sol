//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/******************************************************************************\
* Author: Nasir Jamal <nas@hashleap.io> (https://twitter.com/_nasj)
* Description: Contract to transfer money between different parties along
* additional functionalities like tagging, etc.
/******************************************************************************/

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}
contract SpotPaymentFacetV1 {
    IERC20 private token;

    event TransferSuccessEvent(address sender, string text, uint256 amount, address recipient);

    /// @notice takes the erc20 token and sends to the to address
    /// @param _sender is the token sender address
    /// @param _recipient is the token being sent to
    /// @param _erc20Address is the address of the erc20 token that we need to update
    /// @param _amount is the amount being sent by the sender
    function transfer(address _sender, address _recipient, address _erc20Address, uint256 _amount) external returns(bool){
        token = IERC20(_erc20Address);

        require(token.balanceOf(_sender) >= _amount, "Sender does not have enough tokens");

        emit TransferSuccessEvent(_sender, "sending with HashLeap", _amount, _recipient);

        return token.transferFrom(_sender, _recipient, _amount);
    }

}