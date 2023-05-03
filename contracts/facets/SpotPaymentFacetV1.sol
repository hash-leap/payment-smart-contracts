//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/******************************************************************************\
* @title SpotPaymentFacetV1
* @author Nasir Jamal <nas@hashleap.io> (https://twitter.com/_nasj)
* @dev: Contract to transfer tokens between different parties along with
* additional functionalities like tagging, etc.
/******************************************************************************/
 
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ISpotPaymentFacetV1 } from "../interfaces/ISpotPaymentFacetV1.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

contract SpotPaymentFacetV1 is ISpotPaymentFacetV1 {
    IERC20 private token;
    bool lock;

    // stores the total for each ERC20 or native token
    mapping(address => uint256) private totalTransfers;

    // all contract addresses that we done transfers to
    address[] private addresses;

    // count of all contract addresses
    uint16 private contractAddressCount;

    /// @notice takes the erc20 token and sends to the recipient address
    /// @param _recipient is the token being sent to
    /// @param _tokenContractAddress is the address of the erc20 token that we need to update
    /// @dev for native token transfers send AddressZero for _tokenContractAddress
    /// @param _amount is the amount being sent by the sender to the reciever
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
    ) payable external returns(bool){
        require(!lock, "Error: Re-entering transfer method");
        require(_amount > 0, "Error: Amount must be greater than zero");

        lock = true;

        // store if this is the first time we are using an ERC20 or native token
        bool newAddress = _getTransferAmount(_tokenContractAddress) == 0;

        require(msg.sender != _recipient, "Same account transfer is not allowed");

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
            require(sent, "Failed to send Native Token");

        } else if (_contractType == ContractType.ERC20) {
            token = IERC20(_tokenContractAddress);

            // Make sure the user has approved the amount before hitting this function
            // require allowance to be at least the amount being deposited
            require(
                token.allowance(msg.sender, address(this)) >= _amount,
                "Insufficient allowance"
            );

            // require users balance to be greater than or equal to the _amount
            require(
                token.balanceOf(msg.sender) >= _amount,
                "Insufficient token balance"
            );

            // transfer the tokens to the recipient
            SafeERC20.safeTransferFrom(token, msg.sender, _recipient, _amount);
        } else {
            // Invalid contract type
            revert("Invalid contract type");
        }

        totalTransfers[_tokenContractAddress] += _amount;
        updateAddresses(_tokenContractAddress, newAddress);

        emit TransferSuccessEvent(
            msg.sender,
            _recipient,
            _tokenContractAddress,
            "HashLeap",
            _tags,
            _amount,
            block.timestamp,
            _paymentRef
        );

        lock = false;
        return true;
    }

    // returns the contract address count that have been used for transfers
    function getContractAddressCount() external view returns (uint16) {
        return contractAddressCount;
    }

    // returns the contract address present at the passed index
    function getContractAddressAt(uint16 index) external view returns(address) {
        return addresses[index];
    }

    // returns the total amount transferred to/from a contract
    // should only be called by the deployer of the contract
    function getTransferAmount(address _contractAddress) external view returns(uint256) {
        return _getTransferAmount(_contractAddress);
    }

    function _getTransferAmount(address _contractAddress) internal view returns(uint256) {
        return totalTransfers[_contractAddress];
    }

    // internal function to do some housekeeping on transfers
    // e.g. keeping an account of contract address list and positions
    function updateAddresses(address _contractAddress, bool newAddress) internal {
        if (newAddress) {
            addresses.push(_contractAddress);
            contractAddressCount += 1;
        }
    }
}