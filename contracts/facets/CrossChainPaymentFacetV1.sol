//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/******************************************************************************\
* @title CrossChainPaymentFacetV1
* @author Nasir Jamal <nas@hashleap.io> (https://twitter.com/_nasj)
* @dev: Contract to transfer tokens cross chain between different parties along with
* additional functionalities like tagging, etc.
/******************************************************************************/
 
import { IAxelar } from "../interfaces/IAxelar.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { LibDiamond } from "../libraries/LibDiamond.sol";
import { ICrossChainPaymentFacetV1 } from "./../interfaces/ICrossChainPaymentFacetV1.sol";

contract CrossChainPaymentFacetV1 is ICrossChainPaymentFacetV1 {
  IERC20 private token;

  mapping(bytes32 => address) private axelarContracts;

  /// @notice Only admin can set or update the axelar contract addresses
  /// @param chainName is name of the chain e.g. polygon or make sure it is same as in their docs
  /// @param contractAddress is the smart contract address for the chain
  function setAxelarContract(string calldata chainName, address contractAddress) external {
    LibDiamond.enforceIsContractOwner();
    axelarContracts[keccak256(bytes(chainName))] = contractAddress;
  }

  /// @notice View the axelar gateway contract address
  /// @param chainName is name of the chain e.g. polygon or make sure it is same as in their docs
  function getAxelarContract(string calldata chainName) external view returns (address) {
    return axelarContracts[keccak256(bytes(chainName))];
  }

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
  ) external returns(bool){

    address sourceChainAddress = axelarContracts[keccak256(bytes(_sourceChain))] ;

    require (sourceChainAddress != address(0x0), "Source chain address not set");

    token = IERC20(_tokenContractAddress);

    require (_tokenContractAddress != address(0x0), "Wrong token contract");

    token.transferFrom(msg.sender, address(this), _amount);

    token.approve(sourceChainAddress, _amount);

    IAxelar axelar = IAxelar(sourceChainAddress);

    axelar.sendToken(
      _targetChain, // destination chain name
      _recipient, // some destination wallet address (should be your own)
      _tokenSymbol, // asset symbol
      _amount // amount (in atomic units)
    );

    emit CrossChainTransferSuccess(
      msg.sender,
      _recipient,
      _tokenSymbol,
      "HashLeap",
      _amount,
      block.timestamp,
      _tags,
      _paymentRef,
      _targetChain,
      _sourceChain
    );

    return true;
  }
}