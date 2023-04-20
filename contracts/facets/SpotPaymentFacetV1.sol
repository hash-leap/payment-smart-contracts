//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/******************************************************************************\
* Author: Nasir Jamal <nas@hashleap.io> (https://twitter.com/_nasj)
* Description: Contract to transfer money between different parties along
* additional functionalities like tagging, etc.
/******************************************************************************/

import { ISpotPaymentFacetV1 } from "../interfaces/ISpotPaymentFacetV1.sol";
import { IERC20 } from "../interfaces/IERC20.sol";

contract SpotPaymentFacetV1 is ISpotPaymentFacetV1 {
    IERC20 private token;

    /// @notice takes the erc20 token and sends to the to address
    /// @param _recipient is the token being sent to
    /// @param _erc20Address is the address of the erc20 token that we need to update
    /// @param _amount is the amount being sent by the sender
    function transfer(address _recipient, address _erc20Address, uint256 _amount, ContractType _contractType) payable external returns(bool){

        address msgSender = msg.sender;

        // handle contract types
        if (_contractType == ContractType.NATIVE_TOKEN) {
            // check if the eth has sent
            require(msg.value > 0, "No eth was sent");

            // require tokens sent to be greater than or equal to the _amount
            require(
                msg.value >= _amount, "Insufficient tokens sent"
            );

            // revert the transaction if the tokens sent are in excess of 10% of the amount
            // this would either mean a bug in client code or a malicious user
            // in either case we should revert the transaction instead of keeping or
            // sending the excess back and incurring gas fee
            uint percentage = _amount * 10 / 100;
            require(msg.value - percentage <= _amount, "Tokens sent were more than 10% of the amount");

            // override amount with msg.value
            _amount = msg.value;

            (bool sent,) = payable(_recipient).call{value:_amount}(""); // add gas limit before going live
            require(sent, "Failed to send Ether");

        } else if (_contractType == ContractType.ERC20) {
            token = IERC20(_erc20Address);

            // Make sure the user has approved the amount before hitting this function
            // require allowance to be at least the amount being deposited
            require(
                token.allowance(msgSender, address(this)) >= _amount,
                "Insufficient allowance"
            );

            // require users balance to be greater than or equal to the _amount
            require(
                token.balanceOf(msgSender) >= _amount,
                "Insufficient token balance"
            );

            // transfer the tokens to the recipient
            require(
                token.transferFrom(msgSender, _recipient, _amount),
                "Transfer failed"
            );
        } else {
            // Invalid contract type
            revert("Invalid contract type");
        }

        emit TransferSuccessEvent(msgSender, "sending with HashLeap", _amount, _recipient);

        return true;
    }

}