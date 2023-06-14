// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/******************************************************************************\
* Author: Nasir Jamal <nas@hashleap.io> (https://twitter.com/_nasj)
* Description: Interface to set and charge subscription payments
/******************************************************************************/

interface ISubscriptionFacetV1 {
  // every plan will have an owner and an owner can have many plans
  struct SubscriptionPlan {
    uint256 fee;
    bool autoRenew;
    address owner;
    uint256 duration; // in seconds
    uint256 paymentInterval; // in seconds,
    bytes32 title;
    // mapping(address => uint256) subscribers;
  }

  function createPlan(uint256 _price, bool _autoRenew, uint256 _duration, uint256 _paymentInterval, bytes32 _title) external returns(bool);
  function stopPlan(uint256 _planId) external;
  function subscribe(uint256 _planId, address _tokenContractAddress) external;
  function chargeFee(uint256 _planId, address _tokenContractAddress, address _subscriberAddress) external;
  function cancelSubscription(uint256 _planId) external;
  function forcedCancellation(uint256 _planId, address _subscriberAddress) external;
  function getPlan(uint256 _planId) external view returns (SubscriptionPlan memory plan);
  function isPlanActive(uint256 _planId) external view returns(bool);
  function isSubscriptionOwnerPaused(address _subscriptionOwner) external view returns(bool);

  /// @dev following functions requires the caller to be diamond contract owner
  function pauseSubscriptionOwner(address _subscriptionOwner) external;
  function restoreSubscriptionOwner(address _subscriptionOwner) external;
  function removeSubscriptionOwner(address _subscriptionOwner) external;
  function setBaseContractFee(uint256 _basisPoints) external;
  function transferBalance(address payable _recipient, uint _amount) external;
  function transferERC20Balance(address _erc20Address, address payable _recipient, uint _amount) external;


  error NotSubscriptionOwner(address owner, address caller);
  error PausedSubscriptionOwner(address _subscriptionOwner);
  error BlockedSubscriptionOwner(address _subscriptionOwner);
  error PlanNotFound(uint256 givePlanId);
  error ZeroAddressTransfer();

  event NewPlan(uint256 planId, uint256 duration, uint256 fee, bool autoRenew, address subscriptionOwner);
  event NewSubscription(uint256 planId, address subscriptionOwner, address subscriber, uint256 startTime, uint256 endTime, uint256 totalFee);
  event ChargeSuccess(uint256 planId, address subscriptionOwner, address subscriber, uint256 startTime, uint256 endTime, uint256 amount);
}