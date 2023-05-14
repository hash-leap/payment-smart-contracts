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
    address indexed sender, address indexed recipient,
    string indexed tokenSymbol, string text,
    uint256 amount, uint256 datetime,
    uint256 blockNumber, string targetChain, string sourceChain
  );

  mapping(bytes32 => address) private axelarContracts;

  constructor() {
    axelarContracts[keccak256(bytes('avalanche'))] = 0xC249632c2D40b9001FE907806902f63038B737Ab;
    axelarContracts[keccak256(bytes('binance'))] = 0x4D147dCb984e6affEEC47e44293DA442580A3Ec0;
  }

  // Only admin can update the axelar contract addresses
  function setAxelarContract(string calldata chainName, address contractAddress) external {
    LibDiamond.enforceIsContractOwner();
    axelarContracts[keccak256(bytes(chainName))] = contractAddress;
  }

  // View the axelar contract addresses
  function getAxelarContract(string calldata chainName) external view returns (address) {
    return axelarContracts[keccak256(bytes(chainName))];
  }

  function crossChainTransfer(
    string memory _sourceChain, 
    string memory _targetChain, 
    address _recipient,
    string memory _tokenSymbol,
    uint256 _amount
  ) external {

    token.approve(axelarContracts[keccak256(bytes(_sourceChain))], _amount);

    IAxelar axelar = IAxelar(axelarContracts[keccak256(bytes(_sourceChain))]);
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

