// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/******************************************************************************\
* Author: Nasir Jamal <nas@hashleap.io> (https://twitter.com/_nasj)
* Description: Interface to set and charge subscription payments
/******************************************************************************/

/**
 * @notice SubscriptionFacet contract for charging users on regular frequency for the plans they have subscribed for
 * @dev An owner can have multiple subscription plans attached to their address
 * @dev A subscriber can have multiple plans attached to their address
 * @dev Subscriber should be able to manually cancel or renew their subscriptions in advance before the next due payment
 * @dev An Owner or a Subscriber is identified by a wallet address
 *
 */
interface ISubscriptionFacetV1 {
  // every plan will have an owner and an owner can have many plans
  struct SubscriptionPlan {
    uint256 fee;
    bool autoRenew;
    address owner;
    uint256 duration; // in seconds
    uint256 paymentInterval; // in seconds,
    bytes32 title;
  }

  struct SubscriberPlanTime {
    uint256 previousEndTime;
    uint256 previousStartTime;
    uint256 planEndTime;
    uint256 planStartTime;
  }

  /**
   * @notice Creates a subscription plan
   * @param _price is the full price of subscription for the duration
   * @param _autoRenew is the flag to automatically renew at the end of the duration
   * @param _duration is the full duration of the subscription
   * @param _paymentInterval is frequency at which the user will be charged
   * @param _title is simple user friendly text
   * @return boolean is true when completed successfully
   */
  function createPlan(uint256 _price, bool _autoRenew, uint256 _duration, uint256 _paymentInterval, bytes32 _title) external returns(bytes8);

  /**
   * @notice stops a subscription plan, can only be called by the subscription owner
   * @param _planId is the plan
   */
  function stopPlan(bytes8 _planId) external;

  /**
   * @notice Subscriber must approve the amount before calling this function
   * @param _planId is the plan
   * @param _tokenContractAddress is ERC20 token contract that the user will be charged with
   * @param _subscriptionOwner is the address of the owner to check if the plan is active
  */
  function subscribe(bytes8 _planId, address _tokenContractAddress, address _subscriptionOwner) external;

  /**
   * @notice Subscriber must approve the amount before calling this function
   * @dev We will still charge the subscription fee even if the plan is inactive
   * @dev because the is still subscribed to that. Subscription must be explicitly cancelled to stop charge
   * @param _planId is the plan for which the user is being charged
   * @param _tokenContractAddress is the erc20 token contract address for the payment
   * @param _subscriberAddress is the address from which payment will be taken
   */
  function chargeFeeBySubscriptionOwner(bytes8 _planId, address _tokenContractAddress, address _subscriberAddress) external;

  /**
   * @notice Must be called by an subscriber to cancel the subscription
   * @param _planId is the plan
   */
  function cancelSubscription(bytes8 _planId) external;

  /**
   * @notice Must be called by an active subscription owner
   * @param _planId is the plan
   * @param _subscriberAddress is the subscriber being cancelled by the plan owner
   */
  function forcedCancellation(bytes8 _planId, address _subscriberAddress) external;

  /**
   * @notice finds and returns the plan details
   * @param _planId is the first 8 bytes of the combination of plan parameters when it was created
   * @return _plan is SubscriptionPlan for the _planId
   */
  function getPlan(bytes8 _planId) external view returns (SubscriptionPlan memory _plan);

  function isPlanActiveForOwner(address _subscriptionOwner, bytes8 _planId) external view returns(bool);

  /// @notice Helper function to check if a subscription owner has been paused
  /// @param _subscriptionOwner is the address of the owner
  function isSubscriptionOwnerPaused(address _subscriptionOwner) external view returns(bool);

  /// @notice Helper function to check if a subscription owner has been banned
  /// @param _subscriptionOwner is the address of the owner
  function isSubscriptionOwnerblackListed(address _subscriptionOwner) external view returns(bool);

  /// @dev We still return false even if the plan doesn't exist
  function isPlanSubscribed(bytes8 _planId, address _subscriberAddress) external view returns(bool);

  /// @dev following functions requires the caller to be diamond contract owner

  // Only to be used in severe situations e.g.
  // Owner lost pvt key or reports of suspicious activities from the community
  /// @notice Pauses all activities for a subscription owner
  /// @notice Can only be called by the owner of the contract
  /// @param _subscriptionOwner is the address of the owner
  function pauseSubscriptionOwner(address _subscriptionOwner) external;

  /// @notice Unpauses and restores a subscription owner
  /// @notice Can only be called by the owner of the contract
  /// @param _subscriptionOwner is the address of the owner
  function restoreSubscriptionOwner(address _subscriptionOwner) external;

  /// @notice This is forced removal of a subscription owner and all the plans they own
  /// @notice This should only take place in exceptional circumstances i.e. fraudulant use
  /// @notice A step before using this nuclear option, ideally, the owner should be first paused / deactivated
  function removeSubscriptionOwner(address _subscriptionOwner) external;

  /// @notice Sets the protocol fee to be charged
  /// @param _basisPoints is the fee deducted on each subscription payment
  function setProtocolFee(uint16 _basisPoints) external;

  /// @notice the fee deducted from every subscription fee for the protocol
  /// @return deducted fee in basis points
  function getProtocolFee() external view returns(uint256);

  /**
   * @notice This is mainly to be used in case someone mistakenly sends tokens to the contract
   * only contract owner can call this
   * @param _recipient is the address where the tokens are sent to
   * @param _amount is the amount being transferred
   */
  function transferBalance(address payable _recipient, uint _amount) external;

  /**
   * @notice To take the protocol fee out periodically
   * @param _erc20Address is the contract address of the erc20 Token
   * @param _recipient is the address where the tokens are sent to
   * @param _amount is the amount being transferred
   */
  function transferERC20Balance(address _erc20Address, address payable _recipient, uint _amount) external;


  error NotSubscriptionOwner(address owner, address caller);
  error PausedSubscriptionOwner(address _subscriptionOwner);
  error BlockedSubscriptionOwner(address _subscriptionOwner);
  error PlanNotFound(bytes8 _planId);
  error PlanNotActive(bytes8 _planId);
  error ZeroAddressTransfer();

  event NewPlan(bytes8 planId, uint256 duration, uint256 fee, bool autoRenew, address subscriptionOwner);
  event NewSubscription(bytes8 planId, address subscriptionOwner, address subscriber, uint256 startTime, uint256 endTime, uint256 totalFee);
  event ChargeSuccess(bytes8 planId, address subscriptionOwner, address subscriber, uint256 startTime, uint256 endTime, uint256 amount);

  event PlanStopped(bytes8 _planId, uint256 _time);
  event SubscriptionCancelledByOwner(bytes8 _planId, address _subscriberAddress, uint256 time);
  event SubscriptionCancelledBySubscriber(bytes8 _planId, address _subscriberAddress, uint256 time);

  event TransferNativeBalance(address _recipient, uint _amount);
  event TransferERCBalance(address _erc20Address, address _recipient, uint _amount);
  event ProtocolFeeUpdated(uint256 _basisPoints, uint256 time);

  event SubscriptionOwnerRemoved(address _subscriptionOwner, uint256 time);
  event SubscriptionOwnerPaused(address _subscriptionOwner, uint256 time);
  event SubscriptionOwnerRestored(address _subscriptionOwner, uint256 time);
}