//SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/******************************************************************************\
* @title SubscriptionFacetV1
* @author Nasir Jamal <nas@hashleap.io> (https://twitter.com/_nasj)
* @dev: Contract to transfer tokens between different parties along with
* additional functionalities like tagging, etc.
/******************************************************************************/
 
import "@openzeppelin/contracts/utils/structs/BitMaps.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { LibDiamond } from "../libraries/LibDiamond.sol";
import { ISubscriptionFacetV1 } from "../interfaces/ISubscriptionFacetV1.sol";


/// @notice SubscriptionFacet contract for charging users on regular frequency for the plans they have subscribed for
/// @dev An owner can have multiple subscription plans attached to their address
/// @dev A subscriber can have multiple plans attached to their address
contract SubscriptionFacetV1 is ISubscriptionFacetV1 {
  using BitMaps for BitMaps.BitMap;

  uint256 public constant MINIMUM_DURATION = 1 days;
  uint256 public constant MAXIMUM_DURATION = 365 days;

  // Stores all subscription plan details mapped by their sequence
  mapping(uint256 => SubscriptionPlan) private plans;
  // total number of subscription plans to keep track off
  uint256 private numPlans;
  BitMaps.BitMap private activePlanIds;

  // subscriptionOwners = plan[] // a subset of plans

  // plan = subscriber[] // a subset of subscriber

  // Store subscriptions a subscriber has subscribed to
  // uint in the nested mapping is planId
  mapping(address => mapping(uint => bool)) private subscribers;

  // Number of subscription plans allowed for a subscription owner
  mapping(address => uint256) private plansAllowed;

  // Plans active for a subscription owner
  mapping(address => uint256[]) private plansActive;

  modifier onlySubscriptionOwner(uint256 planId, address owner) {
    if (msg.sender != plans[planId].owner) {
      revert NotSubscriptionOwner(owner, msg.sender);
    }
      _;
  }

  modifier canCreatePlans() {
    uint256 currentPlanNum = plansActive[msg.sender].length;
    if (plansAllowed[msg.sender] >= currentPlanNum) {
      revert MaxPlanCountReached(msg.sender, currentPlanNum, plansAllowed[msg.sender]);
    }
      _;
  }

  // Potentially move all subscription owner related stuff to a different contract or library
  function addSubscriptionOwner(address _owner, uint256 _plansAllowed) external {
    LibDiamond.enforceIsContractOwner();
    plansAllowed[_owner] = _plansAllowed;
  }

  function removeSubscriptionOwner(address _owner) external {
    LibDiamond.enforceIsContractOwner();
    plansAllowed[_owner] = 0;

    for (uint256 i=0; i < plansActive[_owner].length; i++) {
      activePlanIds.unset(plansActive[_owner][i]);
    }
    delete plansActive[_owner];
  }

  function createPlan(uint256 price, bool autoRenew, uint256 duration, uint256 paymentInterval) external canCreatePlans {
    require(duration >= MINIMUM_DURATION && duration <= MAXIMUM_DURATION, "Subscription: invalid duration");

    numPlans++;
    plans[numPlans] = SubscriptionPlan(price, autoRenew, msg.sender, duration, paymentInterval);
    activePlanIds.set(numPlans);
    plansActive[msg.sender].push(numPlans);

    emit NewPlan(numPlans, duration, price, autoRenew, msg.sender);
  }

  function removePlan(uint256 _planId) public onlySubscriptionOwner(_planId, msg.sender){
    if (plansActive[msg.sender].length > 0) {
      activePlanIds.unset(_planId);

      uint256 itemIndex;
      for (uint256 i=0; i < plansActive[msg.sender].length; i++) {
        if (plansActive[msg.sender][i] == _planId) {
          itemIndex = i;
          break;
        }
      }
      plansActive[msg.sender][itemIndex] = plansActive[msg.sender][plansActive[msg.sender].length - 1];
      plansActive[msg.sender].pop();
    }
  }

  function subscribe(uint256 _planId, address _tokenContractAddress) external payable {
    SubscriptionPlan storage plan = plans[_planId];

    require(activePlanIds.get(_planId) == true, "Subscription: plan not found");
    require(subscribers[msg.sender][_planId] != true, "Subscription: already subscribed");

    uint256 startTime = block.timestamp;
    uint256 endTime = startTime + plan.duration;

    IERC20(_tokenContractAddress).approve(address(this), plan.fee);

    chargeFee(_planId);

    emit NewSubscription(_planId, msg.sender, startTime, endTime);
  }

  function chargeFee(uint256 _planId) public {
    SubscriptionPlan storage plan = plans[_planId];
    require(subscribers[msg.sender][_planId] == true, "Subscription: not subscribed");

    // TODO: Fix the below two lines for paymentFrequncy instead of charging all at once
    IERC20(plan.owner).transferFrom(msg.sender, plan.owner, plan.fee); 
    emit ChargeSuccess(_planId, msg.sender, 0, 100);
  }

  function cancelSubscription(uint256 _planId) external {
    require(activePlanIds.get(_planId) == true, "Subscription: plan not found");
    require(subscribers[msg.sender][_planId] == true, "Subscription: not subscribed");
    subscribers[msg.sender][_planId] = false;
    // TODO: Add logic to not take out money
  }

  function getPlan(uint256 _planId) external view returns (uint256 duration, uint256 fee, bool autoRenew, address owner) {
    require(activePlanIds.get(_planId) == true, "Subscription: plan not found");

    SubscriptionPlan storage plan = plans[_planId];
    duration = plan.duration;
    fee = plan.fee;
    autoRenew = plan.autoRenew;
    owner = plan.owner;
  }

}