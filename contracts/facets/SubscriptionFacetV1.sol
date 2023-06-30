//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/******************************************************************************\
* @title SubscriptionFacetV1
* @author Nasir Jamal <nas@hashleap.io> (https://twitter.com/_nasj)
* @dev: Contract to set and charge subscription payments
*
* High level functionality:
* 1. Anyone should be able to use the subscription protocol to create subscription plans
* 2. The protocol should not limit how many subscription plans someone can have
* 3. The protocol will take a minor fee for each subscription payment
* 4. To start with, the fee will be 0, it should be updateable by the admin but rarely updated and only after communicating with the community.
* 5. The Fee will stay in the protocol and on hitting certain value they will be transferred to another wallet / treasury.
* 6. Admin should have the ability to pause/disable a subscription owner if many ppl vote or complain against it.
* 7. The protocol should segregate how many subscriptions each address/owner has.
* 8. We should be able to aggregate the value of each subscription over a period of time.
* 9. We should have a function to take the money out of the contract, only accessible to the contract admin
/******************************************************************************/
 
import "@openzeppelin/contracts/utils/structs/BitMaps.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { LibDiamond } from "../libraries/LibDiamond.sol";
import { ISubscriptionFacetV1 } from "../interfaces/ISubscriptionFacetV1.sol";

/**
 * @notice SubscriptionFacet contract for charging users on regular frequency for the plans they have subscribed for
 * @dev An owner can have multiple subscription plans attached to their address
 * @dev A subscriber can have multiple plans attached to their address
 * @dev Subscriber should be able to manually cancel or renew their subscriptions in advance before the next due payment
 * @dev An Owner or a Subscriber is identified by a wallet address
 *
 */
contract SubscriptionFacetV1 is ISubscriptionFacetV1 {
  IERC20 public token;

  uint8 public constant MINIMUM_DURATION = 7;
  uint16 public constant MAXIMUM_DURATION = 365;
  uint16 private protocolFeeBasisPoints = 0;

  // Paused subscription owners
  mapping(address => bool) private pausedSubscriptionOwners;

  // Blacklisted subscription owners
  mapping(address => bool) private blackListedSubscriptionOwners;

  // Store subscriptions a subscriber has subscribed to
  // uint in the nested mapping is planId
  mapping(address => mapping(bytes8 => bool)) private subscribers;

  // Plans active for a subscription owner
  mapping(address => bytes8[]) private ownerActivePlans;
  mapping(address => mapping(bytes8 => bool)) private ownerPlanTracker;

  /// @dev address is the address of the subscriber
  /// @dev bytes8 in the mapping is the plan id
  /// @dev SubscriberPlanPayments has subscriber plan times
  mapping(address => mapping(bytes8 => SubscriberPlanTime)) private subscriberPlanTime;

  // Stores all subscription plan details mapped by their sequence
  mapping(bytes8 => SubscriptionPlan) private plans;

  modifier onlySubscriptionOwner(bytes8 planId) {
    /**
     *
     * @dev all plans should have an owner i.e. non zero address
     * if no owner is set on the plan struct then it means there
     * is no plan present with that planId hash given
     */
    if (plans[planId].owner == address(0)) {
      revert PlanNotFound(planId);
    }

    address _planOwner = plans[planId].owner;

    if (msg.sender != _planOwner) {
      revert NotSubscriptionOwner(_planOwner, msg.sender);
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
  modifier checkPausedOwners(bytes8 _planId) {
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

  /**
   * @notice Creates a subscription plan
   * @param _price is the full price of subscription for the duration
   * @param _autoRenew is the flag to automatically renew at the end of the duration
   * @param _duration is the full duration of the subscription
   * @param _paymentInterval is frequency at which the user will be charged
   * @param _title is simple user friendly text
   * @return boolean is true when completed successfully
   */
  function createPlan(
    uint256 _price,
    bool _autoRenew,
    uint256 _duration,
    uint256 _paymentInterval,
    bytes32 _title
  ) external checkPausedOwner checkBlackListOwner returns (bytes8)
  {
    bytes32 hash = keccak256(abi.encode(block.prevrandao, _price, _duration, _title, msg.sender));
    bytes8 planKey = bytes8(hash);

    require(_duration >= MINIMUM_DURATION && _duration <= MAXIMUM_DURATION, "Subscription: invalid duration");

    plans[planKey] = SubscriptionPlan(_price, _autoRenew, msg.sender, _duration, _paymentInterval, _title);
    ownerPlanTracker[msg.sender][planKey] = true;
    ownerActivePlans[msg.sender].push(planKey);
    emit NewPlan(planKey, _duration, _price, _autoRenew, msg.sender);

    return planKey;
  }

  // #### FUNCTIONS REQUIRING CALLER TO BE SUBSCRIPTION OWNER
  /**
   * @notice stops a subscription plan, can only be called by the subscription owner
   * @param _planId is the plan
   */
  function stopPlan(bytes8 _planId) public onlySubscriptionOwner(_planId){
    bytes8[] memory _activePlans = ownerActivePlans[msg.sender];

    for( uint i = 0; i < _activePlans.length; i++) {
      if(_activePlans[i] == _planId) {
        delete ownerActivePlans[msg.sender][i];
        break;
      }
    }

    delete ownerPlanTracker[msg.sender][_planId];
    emit PlanStopped(_planId, block.timestamp);
  }

  /**
   * @notice Must be called by an active subscription owner
   * @param _planId is the plan
   * @param _subscriberAddress is the subscriber being cancelled by the plan owner
   */
  function forcedCancellation(bytes8 _planId, address _subscriberAddress) external checkPausedOwners(_planId) onlySubscriptionOwner(_planId) {
    require(subscribers[_subscriberAddress][_planId] == true, "Plan: not subscribed");

    delete subscribers[_subscriberAddress][_planId];
    emit SubscriptionCancelledByOwner(_planId, _subscriberAddress, block.timestamp);
  }

  /**
   * @notice Must be called by subscriber to cancel the subscription
   * @param _planId is the plan
   */
  function cancelSubscription(bytes8 _planId) external {
    getPlan(_planId);
    require(subscribers[msg.sender][_planId] == true, "Plan: not subscribed");

    delete subscribers[msg.sender][_planId];
    emit SubscriptionCancelledBySubscriber(_planId, msg.sender, block.timestamp);
  }

  // #### Any one can subscribe to a plan by calling this function
  /**
   * @notice Subscriber must approve the amount before calling this function
   * @param _planId is the plan
   * @param _tokenContractAddress is ERC20 token contract that the user will be charged with
   * @param _subscriptionOwner is the address of the owner to check if the plan is active
  */
  function subscribe(bytes8 _planId, address _tokenContractAddress, address _subscriptionOwner) external checkPausedOwners(_planId) {
    if (isPlanActiveForOwner(_subscriptionOwner,_planId) != true ) {
      revert PlanNotActive(_planId);
    }

    require(subscribers[msg.sender][_planId] != true, "Plan: already subscribed");
    subscribers[msg.sender][_planId] = true;

    SubscriptionPlan storage plan = plans[_planId];

    uint256 startTime = block.timestamp;
    uint256 endTime = startTime + (plan.duration * 1 days);

    subscriberPlanTime[msg.sender][_planId].planEndTime = endTime;
    subscriberPlanTime[msg.sender][_planId].planStartTime = startTime;

    chargeFee(_planId, _tokenContractAddress, msg.sender);

    emit NewSubscription(_planId, plan.owner, msg.sender, startTime, endTime, plan.fee);
  }

  /**
   * @notice Subscriber must approve the amount before calling this function
   * @dev We will still charge the subscription fee even if the plan is inactive
   * @dev because the is still subscribed to that. Subscription must be explicitly cancelled to stop charge
   * @param _planId is the plan for which the user is being charged
   * @param _tokenContractAddress is the erc20 token contract address for the payment
   * @param _subscriberAddress is the address from which payment will be taken
   */
  function chargeFeeBySubscriptionOwner(
    bytes8 _planId, address _tokenContractAddress, address _subscriberAddress
  ) public onlySubscriptionOwner(_planId)
  {
    chargeFee(_planId, _tokenContractAddress, _subscriberAddress);
  }

  function chargeFee(
    bytes8 _planId, address _tokenContractAddress, address _subscriberAddress
  ) internal checkPausedOwners(_planId)
  {
    SubscriptionPlan memory plan = getPlan(_planId);

    require(subscribers[_subscriberAddress][_planId] == true, "Plan: not subscribed");

    token = IERC20(_tokenContractAddress);
    uint256 charge = plan.fee / (plan.duration / plan.paymentInterval);

    // require allowance to be at least the amount being charged
    require(
      token.allowance(_subscriberAddress, address(this)) >= charge,
      "Insufficient allowance"
    );

    // require users balance to be greater than or equal to the amount being charged
    require(
      token.balanceOf(_subscriberAddress) >= charge,
      "Insufficient token balance"
    );

    SubscriberPlanTime storage planTimes = subscriberPlanTime[_subscriberAddress][_planId];

    uint256 startTime;
    if (planTimes.previousEndTime > 0) {
      startTime = planTimes.previousEndTime;
    } else {
      // Use block timestamp on first charge which is run straight after the subscribing
      startTime = block.timestamp;
    }

    /// @notice clients may charge 3 days in advance and in case of failure may retry 3 times until giving up or cancelling user subscription
    uint256 timeWithBuffer = block.timestamp + 3 days;

    /// @dev if the previousEndTime is set for the subscriber plan that means it is not the first payment
    /// and we must compare with the previous payment end date to prevent double payment
    uint256 previousEndTime = planTimes.previousEndTime;
    if (previousEndTime > 0) {
      require((timeWithBuffer + (plan.paymentInterval * 1 days)) > previousEndTime, "Duplicate subscription payment");

      startTime = startTime + 1;
    }

    uint256 endTime = startTime + (plan.paymentInterval * 1 days);
    require(endTime <=  planTimes.planEndTime && block.timestamp < planTimes.planEndTime, "Plan Renewal required");

    SafeERC20.safeTransferFrom(token, _subscriberAddress, plan.owner, charge);

    subscriberPlanTime[_subscriberAddress][_planId].previousStartTime = startTime;
    subscriberPlanTime[_subscriberAddress][_planId].previousEndTime = endTime;

    emit ChargeSuccess(_planId, plan.owner, _subscriberAddress, startTime, endTime, charge);
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
  /// @return deducted fee in basis points
  function getProtocolFee() external view returns(uint256) {
    return protocolFeeBasisPoints;
  }

  /// @dev We still return false even if the plan doesn't exist
  function isPlanSubscribed(bytes8 _planId, address _subscriberAddress) external view returns(bool) {
    return !!subscribers[_subscriberAddress][_planId];
  }

  function isPlanActiveForOwner(address _subscriptionOwner, bytes8 _planId) public view returns(bool) {
    return ownerPlanTracker[_subscriptionOwner][_planId];
  }

  /**
   * @notice finds and returns the plan details
   * @param _planId is the autogenerated sequential id of the plan when it was created
   * @return _plan is SubscriptionPlan for the _planId
   */
  function getPlan(bytes8 _planId) public view returns (SubscriptionPlan memory _plan) {
    _plan = plans[_planId];
    if (_plan.owner == address(0)) {
      revert PlanNotFound(_planId);
    }
    return _plan;
  }

  // #### FUNCTIONS THAT REQUIRE THE CALLER TO BE DIAMOND CONTRACT OWNER
  /**
   * @notice This is mainly to be used in case someone mistakenly sends tokens to the contract
   * only contract owner can call this
   * @param _recipient is the address where the tokens are sent to
   * @param _amount is the amount being transferred
   */
  function transferBalance(address payable _recipient, uint _amount) external nonZeroAddress(_recipient) {
    LibDiamond.enforceIsContractOwner();

    require(address(this).balance >= _amount, "Insufficient balance in the contract");
    _recipient.transfer(_amount);

    emit TransferNativeBalance(_recipient, _amount);
  }

  /// @dev Get the smart contract's balance of erc20 tokens
  function erc20Balance(address _erc20Address) external view returns(uint256) {
    return IERC20(_erc20Address).balanceOf(address(this));
  }

  /// @dev Get the smart contract's balance of native tokens
  function nativeBalance() external view returns(uint256) {
    return address(this).balance;
  }

  /**
   * @notice To take the protocol fee out periodically
   * @param _erc20Address is the contract address of the erc20 Token
   * @param _recipient is the address where the tokens are sent to
   * @param _amount is the amount being transferred
   */
  function transferERC20Balance(address _erc20Address, address payable _recipient, uint _amount) external nonZeroAddress(_recipient) {
    LibDiamond.enforceIsContractOwner();

    token = IERC20(_erc20Address);
    require(token.balanceOf(address(this)) >= _amount, "Insufficient token balance in the contract");
    require(token.transfer(_recipient, _amount), "Token transfer failed");

    emit TransferERCBalance(_erc20Address, _recipient, _amount);
  }

  /// @notice Sets the base contract fee to be charged by the protocol
  /// @param _basisPoints is the fee deducted on each subscription payment
  function setProtocolFee(uint16 _basisPoints) external {
    LibDiamond.enforceIsContractOwner();
    protocolFeeBasisPoints = _basisPoints;

    emit ProtocolFeeUpdated(_basisPoints, block.timestamp);
  }

  /// @notice This is forced removal of a subscription owner and all the plans they own
  /// @notice This should only take place in exceptional circumstances i.e. fraudulant use
  /// @notice A step before using this nuclear option, ideally, the owner should be first paused / deactivated
  function removeSubscriptionOwner(address _subscriptionOwner) external {
    LibDiamond.enforceIsContractOwner();

    for (uint256 i=0; i < ownerActivePlans[_subscriptionOwner].length; i++) {
      bytes8 planId = ownerActivePlans[_subscriptionOwner][i];

      delete ownerPlanTracker[_subscriptionOwner][planId];
      delete ownerActivePlans[_subscriptionOwner][i];
    }
    blackListedSubscriptionOwners[_subscriptionOwner] = true;

    emit SubscriptionOwnerRemoved(_subscriptionOwner, block.timestamp);
  }

  // Only to be used in severe situations e.g.
  // Owner lost pvt key or reports of suspicious activities from the community
  /// @notice Pauses all activities for a subscription owner
  /// @notice Can only be called by the owner of the contract
  /// @param _subscriptionOwner is the address of the owner
  function pauseSubscriptionOwner(address _subscriptionOwner) external {
    LibDiamond.enforceIsContractOwner();
    pausedSubscriptionOwners[_subscriptionOwner] = true;

    emit SubscriptionOwnerPaused(_subscriptionOwner, block.timestamp);
  }

  /// @notice Unpauses and restores a subscription owner
  /// @notice Can only be called by the owner of the contract
  /// @param _subscriptionOwner is the address of the owner
  function restoreSubscriptionOwner(address _subscriptionOwner) external {
    LibDiamond.enforceIsContractOwner();
    delete pausedSubscriptionOwners[_subscriptionOwner];

    emit SubscriptionOwnerRestored(_subscriptionOwner, block.timestamp);
  }

}