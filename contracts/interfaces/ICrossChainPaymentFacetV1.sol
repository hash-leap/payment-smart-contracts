// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/******************************************************************************\
* Author: Nasir Jamal <nas@hashleap.io> (https://twitter.com/_nasj)
* Description: Interface to transfer tokens cross chain between different parties 
* along with additional functionalities like tagging, etc.
/******************************************************************************/

interface ICrossChainPaymentFacetV1 {

    /// @notice takes the erc20 token and sends to another evm chain
    /// @param _sourceChain is the chain from where the token is sent from
    /// @param _targetChain is the chain where the token is being sent to
    /// @param _recipient is the address token being sent to
    /// @param _amount is the amount being sent by the sender
    function transfer(
      string calldata _sourceChain, 
      string calldata _targetChain, 
      string calldata _recipient,
      string calldata _tokenSymbol,
      uint256 _amount,
      address _tokenContractAddress,
      string calldata _paymentRef,
      string[] calldata _tags
    ) external returns(bool);

    function getAxelarContract(string calldata chainName) external view returns (address);
    function setAxelarContract(string calldata chainName, address contractAddress) external;

    event CrossChainTransferSuccess(
      address indexed sender, string indexed recipient,
      string indexed tokenSymbol, string text,
      uint256 amount, uint256 datetime, string[] tags,
      string paymentRef, string targetChain, string sourceChain
    );
}