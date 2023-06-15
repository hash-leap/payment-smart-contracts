// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/******************************************************************************\
* Author: Nasir Jamal <nas@hashleap.io> (https://twitter.com/_nasj)
* Description: Interface to transfer tokens cross chain between different parties 
* along with additional functionalities like tagging, etc.
/******************************************************************************/

interface ICrossChainPaymentFacetV1 {

    /// @notice Moves erc20 token across another evm chains using Axelar
    /// @param _sourceChain is the chain token is sent from
    /// @param _targetChain is the chain token being sent to
    /// @param _recipient is the address of recipient, token is being sent to
    /// @param _tokenSymbol is the symbol of token on the chain e.g. USDC
    /// @param _amount is the number of tokens being transferred to recipient in atomic units
    /// @param _tokenContractAddress is the address of the erc 20 token
    /// @param _paymentRef is hashleap payment reference or identifier so the transaction even can be associated with hashleap
    /// @param _tags is an array of tags that we want to emit with the event 
    /// @return boolean is true when completed successfully
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

    /// @notice View the axelar gateway contract address
    /// @param chainName is name of the chain e.g. polygon or make sure it is same as in their docs
    function getAxelarContract(string calldata chainName) external view returns (address);

    /// @notice Only admin can set or update the axelar contract addresses
    /// @param chainName is name of the chain e.g. polygon or make sure it is same as in their docs
    /// @param contractAddress is the smart contract address for the chain
    function setAxelarContract(string calldata chainName, address contractAddress) external;

    event CrossChainTransferSuccess(
      address indexed sender, string indexed recipient,
      string indexed tokenSymbol, string text,
      uint256 amount, uint256 datetime, string[] tags,
      string paymentRef, string targetChain, string sourceChain
    );
}