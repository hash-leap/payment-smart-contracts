// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/******************************************************************************\
* Author: Nasir Jamal <nas@hashleap.io> (https://twitter.com/_nasj)
* Description: Contract to transfer money between different parties along
* additional functionalities like tagging, etc.
/******************************************************************************/

interface ISpotPaymentFacetV1 {
    enum ContractType {
        NATIVE_TOKEN,
        ERC20
    }

    /// @notice takes the erc20 token and sends to the to address
    /// @param _recipient is the token being sent to
    /// @param _tokenContractAddress is the address of the erc20 token that we need to update
    /// @param _amount is the amount being sent by the sender
    /// @param _contractType is the enum to indicate if it is a native or erc20 transfer
    /// @param _tags is the set of tags associated with this transfer
    /// @param _paymentRef is the HashLeap payment reference e.g. invoice number or payment link identifier
    function transfer(
      address _recipient,
      address _tokenContractAddress,
      uint256 _amount,
      ContractType _contractType,
      string[] calldata _tags,
      string calldata _paymentRef
    ) payable external returns(bool);

    function getContractAddressCount() external view returns(uint16);
    function getContractAddressAt(uint16 index) external view returns(address);
    function getTransferAmount(address _contractAddress) external view returns(uint256);

    event TransferSuccess(
      address indexed sender, address indexed recipient,
      address indexed tokenAddress, string text, string[] tags,
      uint256 amount, uint256 datetime, string paymentRef
    );
}