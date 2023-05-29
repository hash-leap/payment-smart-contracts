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

  // Only admin can update the axelar contract addresses
  function setAxelarContract(string calldata chainName, address contractAddress) external {
    LibDiamond.enforceIsContractOwner();
    axelarContracts[keccak256(bytes(chainName))] = contractAddress;
  }

  // View the axelar contract addresses
  function getAxelarContract(string calldata chainName) external view returns (address) {
    return axelarContracts[keccak256(bytes(chainName))];
  }

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
    // e.g. set to USDC contract
    // token = IERC20(0x64544969ed7EBf5f083679233325356EbE738930) ;

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

