//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/******************************************************************************\
* @title CrossPaymentFacetV1
* @author Nasir Jamal <nas@hashleap.io> (https://twitter.com/_nasj)
* @dev: Contract to transfer tokens cross chain between different parties along with
* additional functionalities like tagging, etc.
/******************************************************************************/
 
import { IAxelar } from "../interfaces/IAxelar.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { LibDiamond } from "../libraries/LibDiamond.sol";

contract CrossChainPaymentFacetV1 {
  IERC20 private token;

  event TransferSuccess(
    address indexed sender, string indexed recipient,
    string indexed tokenSymbol, string text,
    uint256 amount, uint256 datetime,
    uint256 blockNumber, string targetChain, string sourceChain
  );

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
    string memory _sourceChain, 
    string memory _targetChain, 
    string memory _recipient,
    string memory _tokenSymbol,
    uint256 _amount,
    address _tokenContractAddress
  ) external {

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

    emit TransferSuccess(
      msg.sender,
      _recipient,
      _tokenSymbol,
      "HashLeap",
      _amount,
      block.timestamp,
      block.number,
      _targetChain,
      _sourceChain
    );
  }
}

