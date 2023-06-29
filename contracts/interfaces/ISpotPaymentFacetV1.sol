// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/******************************************************************************\
* Author: Nasir Jamal <nas@hashleap.io> (https://twitter.com/_nasj)
* Description: Interface to transfer money between different parties along
* additional functionalities like tagging, etc.
/******************************************************************************/

interface ISpotPaymentFacetV1 {
    enum ContractType {
        NATIVE_TOKEN,
        ERC20
    }

    /// @notice takes the erc20 token and sends to the to address
    /// @param _recipient is the token being sent to
    /// @param _tokenSymbol is the symbold of the erc20 token that is being transferred
    /// @param _amount is the amount being sent by the sender
    /// @param _contractType is the enum to indicate if it is a native or erc20 transfer
    /// @param _tags is the set of tags associated with this transfer
    /// @param _paymentRef is the HashLeap payment reference e.g. invoice number or payment link identifier
    function transfer(
      address _recipient,
      string calldata _tokenSymbol,
      uint256 _amount,
      ContractType _contractType,
      bytes32[] calldata _tags,
      bytes32 _paymentRef,
      bytes32 _paymentType
    ) payable external returns(bool);

    /// @notice returns the address of the given token symbol
    /// @param _symbol is the token symbol
    function getTokenAddress(string calldata _symbol) external view returns(address);

    /// @notice the address of the given token
    /// @param _symbol is the token symbol
    /// @param _contractAddress is the address of the erc20 token contract
    function setTokenAddress(string calldata _symbol, address _contractAddress) external;

    /// @notice pauses all transfers, can only be called by the admin
    function pauseTransfers() external;

    /// @notice unpauses and restarts transfers, can only be called by the admin
    function restartTransfers() external;

    /// @notice returns a bolean value depending on if the contrat is paused or not
    function isPaused() external view returns(bool);

    /// @notice returns a count of all tokens accepted
    function getContractAddressCount() external view returns(uint16);

    /// @notice returns the total amount transferred using a specific token
    function getTotalAmountForToken(string calldata _tokenSymbol) external view returns(uint256);

    event TransferSuccess(
      address indexed sender, address indexed recipient,
      address indexed tokenAddress, string text, bytes32[] tags,
      uint256 amount, uint256 datetime, bytes32 paymentRef, bytes32 paymentType,
      uint256 blockNumber
    );
}