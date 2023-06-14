//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/******************************************************************************\
* @title SubscriptionFacetV1
* @author Nasir Jamal <nas@hashleap.io> (https://twitter.com/_nasj)
* @dev: Contract to set and charge subscription payments
/******************************************************************************/
 
import "@openzeppelin/contracts/utils/structs/BitMaps.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { LibDiamond } from "../libraries/LibDiamond.sol";
import { ISubscriptionFacetV1 } from "../interfaces/ISubscriptionFacetV1.sol";

// High level functionality:
// 1. Anyone should be able to use the subscription protocol to create subscription plans
// 2. The protocol should not limit how many subscription plans someone can have
// 3. The protocol will take a minor fee for each subscription payment
// 4. To start with, the fee will be 0, it should be updateable by the admin but rarely updated and only after communicating with the community.
// 5. The Fee will stay in the protocol and on hitting certain value they will be transferred to another wallet / treasury.
// 6. Admin should have the ability to pause/disable a subscription owner if many ppl vote or complain against it.
// 7. The protocol should segregate how many subscriptions each address/owner has.
// 8. We should be able to aggregate the value of each subscription over a period of time.
// 9. We should have a function to take the money out of the contract, only accessible to the contract admin


/// @notice SubscriptionFacet contract for charging users on regular frequency for the plans they have subscribed for
/// @dev An owner can have multiple subscription plans attached to their address
/// @dev A subscriber can have multiple plans attached to their address
/// @dev Subscriber should be able to manually cancel or renew their subscriptions in advance before the next due payment
contract SubscriptionFacetV1 is ISubscriptionFacetV1 {
  using BitMaps for BitMaps.BitMap;
  IERC20 public token;

  uint256 public constant MINIMUM_DURATION = 7;
  uint256 public constant MAXIMUM_DURATION = 365;
  uint256 public constant DEFAULT_APPROVAL_MULTIPLIER = 5;
  uint256 private feeBasisPoints = 0;

  // Stores all subscription plan details mapped by their sequence
  mapping(uint256 => SubscriptionPlan) private plans;

  // Total number of subscription plans to keep track off
  uint256 private numPlans;
  BitMaps.BitMap private activePlanIds;


  // Store subscriptions a subscriber has subscribed to
  // uint in the nested mapping is planId
  mapping(address => mapping(uint => bool)) private subscribers;

  // Plans active for a subscription owner
  mapping(address => uint256[]) private ownerActivePlanTracker;
  mapping(address => mapping(uint => bool)) private plansActive;

  // Paused subscription owners
  mapping(address => bool) private pausedSubscriptionOwners;

  // Blacklisted subscription owners
  mapping(address => bool) private blackListedSubscriptionOwners;

  modifier onlySubscriptionOwner(uint256 planId, address owner) {
    if (msg.sender != plans[planId].owner) {
      revert NotSubscriptionOwner(owner, msg.sender);
    }
    _;
  }

  modifier nonZeroAddress(address _recipient) {
    if (_recipient == address(0)) {
      revert ZeroAddressTransfer();
    }
    _;
  }

  /// @dev Use this modifier for all functions that use subscriptions
  modifier checkPausedOwners(uint256 _planId) {
    SubscriptionPlan storage plan = plans[_planId];

    if (plan.owner == address(0)) {
      revert PlanNotFound(_planId);
    }

    if (pausedSubscriptionOwners[plan.owner] == true ){
      revert PausedSubscriptionOwner(plan.owner);
    }
    _;
  }

  /// @dev Use this modifier for all functions that use subscriptions
  modifier checkPausedOwner() {
    if (pausedSubscriptionOwners[msg.sender] == true ){
      revert PausedSubscriptionOwner(msg.sender);
    }
    _;
  }

  /// @dev Use this modifier for all functions that use subscriptions
  modifier checkBlackListOwner() {
    if (blackListedSubscriptionOwners[msg.sender] == true ){
      revert BlockedSubscriptionOwner(msg.sender);
    }
    _;
  }

  /// @notice Creates a subscription plan
  /// @param _price is the full price of subscription for the duration
  /// @param _autoRenew is the flag to automatically renew at the end of the duration
  /// @param _duration is the full duration of the subscription
  /// @param _paymentInterval is frequency at which the user will be charged
  /// @param _title is simple user friendly text
  /// @return boolean is true when completed successfully
  function createPlan(uint256 _price, bool _autoRenew, uint256 _duration, uint256 _paymentInterval, bytes32 _title) external checkPausedOwner checkBlackListOwner returns (bool){
    require(_duration >= MINIMUM_DURATION && _duration <= MAXIMUM_DURATION, "Subscription: invalid duration");

    plans[numPlans] = SubscriptionPlan(_price, _autoRenew, msg.sender, _duration, _paymentInterval, _title);
    activePlanIds.set(numPlans);
    plansActive[msg.sender][numPlans] = true;
    ownerActivePlanTracker[msg.sender].push(numPlans);
    emit NewPlan(numPlans, _duration, _price, _autoRenew, msg.sender);

    numPlans++;
    return true;
  }

  // #### FUNCTIONS REQUIRING CALLER TO BE SUBSCRIPTION OWNER
  function stopPlan(uint256 _planId) public onlySubscriptionOwner(_planId, msg.sender){
    activePlanIds.unset(_planId);

    delete ownerActivePlanTracker[msg.sender][_planId];
    delete plansActive[msg.sender][_planId];
  }

  function forcedCancellation(uint256 _planId, address _subscriberAddress) external checkPausedOwners(_planId) onlySubscriptionOwner(_planId, msg.sender) {
    require(subscribers[_subscriberAddress][_planId] == true, "Plan: not subscribed");

    delete subscribers[_subscriberAddress][_planId];
  }

  // #### Any one can subscribe to a plan by calling this function
  /// @notice Subscriber must approve the amount before calling this function
  function subscribe(uint256 _planId, address _tokenContractAddress) external checkPausedOwners(_planId) {
    if (activePlanIds.get(_planId) != true) {
      revert PlanNotFound(_planId);
    }

    SubscriptionPlan storage plan = plans[_planId];

    require(subscribers[msg.sender][_planId] != true, "Plan: already subscribed");

    uint256 startTime = block.timestamp;
    uint256 endTime = startTime + (plan.duration * 1 days);

    subscribers[msg.sender][_planId] = true;
    chargeFee(_planId, _tokenContractAddress, msg.sender);

    emit NewSubscription(_planId, plan.owner, msg.sender, startTime, endTime, plan.fee);
  }

  /// @notice Subscriber must approve the amount before calling this function 
  function chargeFee(uint256 _planId, address _tokenContractAddress, address _subscriberAddress) public checkPausedOwners(_planId) {
    if (activePlanIds.get(_planId) != true) {
      revert PlanNotFound(_planId);
    }

    SubscriptionPlan storage plan = plans[_planId];

    require(subscribers[_subscriberAddress][_planId] == true, "Plan: not subscribed");

    token = IERC20(_tokenContractAddress);
    uint256 charge = plan.fee / (plan.duration / plan.paymentInterval);

    // require allowance to be at least the amount being charged
    require(
      token.allowance(_subscriberAddress, address(this)) >= charge,
      "Insufficient allowance"
    );

    // require users balance to be greater than or equal to the charged amount
    require(
      token.balanceOf(_subscriberAddress) >= charge,
      "Insufficient token balance"
    );

    SafeERC20.safeTransferFrom(token, _subscriberAddress, plan.owner, charge);

    uint256 startTime = block.timestamp;
    // TODO: Prevent double charging for the same period
    uint256 endTime = startTime + (plan.paymentInterval * 1 days);

    emit ChargeSuccess(_planId, plan.owner, _subscriberAddress, startTime, endTime, charge);
  }

  function cancelSubscription(uint256 _planId) external checkPausedOwners(_planId) {
    require(subscribers[msg.sender][_planId] == true, "Plan: not subscribed");

    delete subscribers[msg.sender][_planId];
  }

  // ##### COMMON GETTER FUNCTIONS
  /// @notice Helper function to check if a subscription owner has been paused
  /// @param _subscriptionOwner is the address of the owner
  function isSubscriptionOwnerPaused(address _subscriptionOwner) external view returns(bool) {
    bool isPaused = pausedSubscriptionOwners[_subscriptionOwner] == true;
    return isPaused;
  }

  function isSubscriptionOwnerblackListed(address _subscriptionOwner) external view returns(bool) {
    bool isBlocked = blackListedSubscriptionOwners[_subscriptionOwner] == true;
    return isBlocked;
  }

  /// @notice the fee deducted from every subscription fee for the protocol
  /// @return deducted fee in percentage
  function getBaseContractFee() external view returns(uint256) {
    return feeBasisPoints;
  }

  /// @dev We still return false even if the plan doesn't exist
  function isPlanSubscribed(uint256 _planId, address _subscriberAddress) external view returns(bool) {
    return !!subscribers[_subscriberAddress][_planId];
  }

  function isPlanActive(uint256 _planId) external view returns(bool) {
    return activePlanIds.get(_planId);
  }

  function isPlanActiveForOwner(address _subscriptionOwner, uint256 _planId) external view returns(bool) {
    return plansActive[_subscriptionOwner][_planId];
  }

  /// @notice finds and returns the plan details
  /// @param _planId is the autogenerated sequential id of the plan when it was created
  /// @return _plan is SubscriptionPlan for the _planId
  function getPlan(uint256 _planId) public view returns (SubscriptionPlan memory _plan) {
    require(activePlanIds.get(_planId) == true, "Subscription: plan not found");

    _plan = plans[_planId];
    return _plan;
  }

  // #### FUNCTIONS THAT REQUIRE THE CALLER TO BE DIAMOND CONTRACT OWNER
  /// @notice This is mainly to be used in case someone mistakenly sends tokens to the contract
  /// @param _recipient is the address where the tokens are sent to
  /// @param _amount is the amount being transferred
  function transferBalance(address payable _recipient, uint _amount) external nonZeroAddress(_recipient) {
    LibDiamond.enforceIsContractOwner();

    require(address(this).balance >= _amount, "Insufficient balance in the contract");
    _recipient.transfer(_amount);
  }

  /// @dev Get the smart contract's balance of erc20 tokens
  function erc20Balance(address _erc20Address) external view returns(uint256) {
    return IERC20(_erc20Address).balanceOf(address(this));
  }

  /// @dev Get the smart contract's balance of native tokens
  function nativeBalance() external view returns(uint256) {
    return address(this).balance;
  }

  /// @notice To take the protocol fee out periodically
  /// @param _erc20Address is the contract address of the erc20 Token
  /// @param _recipient is the address where the tokens are sent to
  /// @param _amount is the amount being transferred
  function transferERC20Balance(address _erc20Address, address payable _recipient, uint _amount) external nonZeroAddress(_recipient) {
    LibDiamond.enforceIsContractOwner();

    token = IERC20(_erc20Address);
    require(token.balanceOf(address(this)) >= _amount, "Insufficient token balance in the contract");
    require(token.transfer(_recipient, _amount), "Token transfer failed");
  }

  /// @notice Sets the base contract fee to be charged by the protocol
  /// @param _basisPoints is the fee deducted on each subscription payment
  function setBaseContractFee(uint256 _basisPoints) external {
    LibDiamond.enforceIsContractOwner();
    feeBasisPoints = _basisPoints;
  }

  /// @notice This is forced removal of a subscription owner and all the plans they own
  /// @notice This should only take place in exceptional circumstances i.e. fraudulant use
  /// @notice A step before using this nuclear option, ideally, the owner should be first paused / deactivated
  function removeSubscriptionOwner(address _subscriptionOwner) external {
    LibDiamond.enforceIsContractOwner();

    for (uint256 i=0; i < ownerActivePlanTracker[_subscriptionOwner].length; i++) {
      uint256 planId = ownerActivePlanTracker[_subscriptionOwner][i];
      activePlanIds.unset(planId);

      delete plansActive[_subscriptionOwner][planId];
    }
    blackListedSubscriptionOwners[_subscriptionOwner] = true;
  }

  // Only to be used in severe situations e.g.
  // Owner lost pvt key or reports of suspicious activities from the community
  /// @notice Pauses all activities for a subscription owner
  /// @notice Can only be called by the owner of the contract
  /// @param _subscriptionOwner is the address of the owner
  function pauseSubscriptionOwner(address _subscriptionOwner) external {
    LibDiamond.enforceIsContractOwner();
    pausedSubscriptionOwners[_subscriptionOwner] = true;
  }

  /// @notice Unpauses and restores a subscription owner
  /// @notice Can only be called by the owner of the contract
  /// @param _subscriptionOwner is the address of the owner
  function restoreSubscriptionOwner(address _subscriptionOwner) external {
    LibDiamond.enforceIsContractOwner();
    delete pausedSubscriptionOwners[_subscriptionOwner];
  }

}