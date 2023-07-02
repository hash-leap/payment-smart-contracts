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
import { LibDiamond } from "../libraries/LibDiamond.sol";

contract SpotPaymentFacetV1 is ISpotPaymentFacetV1 {
    IERC20 private token;
    bool private pause;

    // Count of all accepted token symbols
    uint16 private contractAddressCount;

    // Accepted Token symbol list
    string[] private _tokenSymbols;

    // Total for each ERC20 or native token
    mapping(string => uint256) private totalTransfers;

    // Token symbols and their contract addresses
    mapping(string => address) private _tokenAddresses;

    /// @notice takes the erc20 token and sends to the recipient address
    /// @param _recipient is the token being sent to
    /// @param _tokenSymbol is the symbold of the erc20 token that is being transferred
    /// @dev for native token transfers send AddressZero for _tokenContractAddress
    /// @param _amount is the amount being sent by the sender to the reciever
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
    ) payable external returns(bool){
        require(!isPaused(), "Transfers are paused");
        require(_recipient != address(0), "Recipient with zero address");
        require(_amount > 0, "Error: Amount must be greater than zero");

        require(msg.sender != _recipient, "Same account transfer is not allowed");
        address _tokenAddress = address(0);

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
            _tokenAddress = _tokenAddresses[_tokenSymbol];

            require(_tokenAddress != address(0), "Invalid token passed");

            token = IERC20(_tokenAddress);

            // Make sure the user has approved the amount before hitting this function
            // require allowance to be at least the amount being deposited
            // Set the allowance to existing allowance for this contract + amount for this transaction
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

        totalTransfers[_tokenSymbol] += _amount;

        emit TransferSuccess(
            msg.sender,
            _recipient,
            _tokenAddress,
            "HashLeap",
            _tags,
            _amount,
            block.timestamp,
            _paymentRef,
            _paymentType,
            block.number
        );

        return true;
    }

    /// @notice returns the address of the given token symbol
    /// @param _symbol is the token symbol
    function getTokenAddress(string calldata _symbol) external view returns(address) {
        return _tokenAddresses[_symbol];
    }

    /// @notice the address of the given token
    /// @param _symbol is the token symbol
    /// @param _contractAddress is the address of the erc20 token contract
    function setTokenAddress(string calldata _symbol, address _contractAddress) external {
        LibDiamond.enforceIsContractOwner();
        _tokenAddresses[_symbol] = _contractAddress;

        bool _present;
        for(uint i = 0; i < contractAddressCount; i++) {
            if (keccak256(abi.encodePacked(_tokenSymbols[i])) == keccak256(abi.encodePacked(_symbol))) {
                _present = true;
                break;
            }
        }
        if (!_present) {
           contractAddressCount += 1;
           _tokenSymbols.push(_symbol);
        }
    }

    /// @notice returns a count of all tokens accepted
    function getContractAddressCount() external view returns (uint16) {
        return contractAddressCount;
    }

    /// @notice pauses all transfers, can only be called by the admin
    function pauseTransfers() external {
        LibDiamond.enforceIsContractOwner();
        pause = true;
    }

    /// @notice unpauses and restarts transfers, can only be called by the admin
    function restartTransfers() external {
        LibDiamond.enforceIsContractOwner();
        pause = false;
    }

    /// @notice returns a bolean value depending on if the contrat is paused or not
    function isPaused() public view returns(bool) {
        return pause;
    }

    /// @notice returns the total amount transferred using a specific token
    function getTotalAmountForToken(string calldata _tokenSymbol) external view returns(uint256) {
        LibDiamond.enforceIsContractOwner();
        return _getTransferAmount(_tokenSymbol);
    }

    function _getTransferAmount(string calldata _tokenSymbol) internal view returns(uint256) {
        return totalTransfers[_tokenSymbol];
    }
}