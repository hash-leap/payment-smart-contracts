// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/******************************************************************************\
* Author: Nasir Jamal <nas@hashleap.io> (https://twitter.com/_nasj)
* Description: Contract to transfer money between different parties along
* additional functionalities like tagging, etc.
/******************************************************************************/

interface ISubscriptionFacetV1 {
  // every plan will have an owner and an owner can have many plans
  struct SubscriptionPlan {
    uint256 fee;
    bool autoRenew;
    address owner;
    uint256 duration; // in seconds
    uint256 paymentInterval; // in seconds
    // mapping(address => uint256) subscribers;
  }

  function addSubscriptionOwner(address _owner, uint256 _plansAllowed) external;
  function createPlan(uint256 price, bool autoRenew, uint256 duration, uint256 paymentInterval) external;
  function removePlan(uint256 _planId) external;
  function subscribe(uint256 _planId, address _tokenContractAddress) external payable;
  function cancelSubscription(uint256 _planId) external;
  function getPlan(uint256 _planId) external view returns (uint256 duration, uint256 fee, bool autoRenew, address owner);


  error NotSubscriptionOwner(address owner, address caller);
  error MaxPlanCountReached(address caller, uint256 activePlansCount, uint256 plansAllowedCount);

  event NewPlan(uint256 planId, uint256 duration, uint256 fee, bool autoRenew, address subscriptionOwner);
  event NewSubscription(uint256 planId, address subscriber, uint256 startTime, uint256 endTime);
  event ChargeSuccess(uint256 planId, address subscriber, uint256 startTime, uint256 endTime);
}