import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployDiamond } from "../scripts/deploy";
import { getSelectors, FacetCutAction } from "../scripts/libraries/diamond";

import { ethers } from "hardhat";
import { expect } from "chai";
import { Contract } from "ethers";
import sinon from "sinon";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("SubscriptionFacetV1", async () => {
  let signers: SignerWithAddress[];
  let subscriptionFacetV1: Contract;
  let diamondAddress: string;
  let owner: SignerWithAddress;
  let nonOwner: SignerWithAddress;
  let myTestERC20: Contract;
  const randomPlanId = "0x9743bddfc05252bd";

  before(async () => {
    sinon.stub(console, "log");
  });

  after(() => {
    sinon.restore();
  });

  beforeEach(async () => {
    signers = await ethers.getSigners();
    owner = signers[0];
    nonOwner = signers[1];

    diamondAddress = await deployDiamond();

    const SubscriptionFacetV1Factory = await ethers.getContractFactory(
      "SubscriptionFacetV1"
    );
    subscriptionFacetV1 = await SubscriptionFacetV1Factory.connect(
      owner
    ).deploy();
    await subscriptionFacetV1.deployed();

    const diamondCutFacet = await ethers.getContractAt(
      "DiamondCutFacet",
      diamondAddress
    );

    await ethers.getContractAt("DiamondLoupeFacet", diamondAddress);

    await ethers.getContractAt("OwnershipFacet", diamondAddress);
    const selectors = getSelectors(subscriptionFacetV1);

    const tx = await diamondCutFacet.diamondCut(
      [
        {
          facetAddress: subscriptionFacetV1.address,
          action: FacetCutAction.Add,
          functionSelectors: selectors,
        },
      ],
      ethers.constants.AddressZero,
      "0x",
      { gasLimit: 900000 }
    );
    await tx.wait();

    subscriptionFacetV1 = await ethers.getContractAt(
      "SubscriptionFacetV1",
      diamondAddress
    );

    const myTestERC20Factory = await ethers.getContractFactory("MyTestERC20");
    myTestERC20 = await myTestERC20Factory.deploy();
    await myTestERC20.deployed();
  });

  describe("createPlan", () => {
    describe("when owner is paused", () => {
      it("should revert the transaction", async () => {
        await subscriptionFacetV1
          .connect(owner)
          .pauseSubscriptionOwner(nonOwner.address);
        await expect(
          subscriptionFacetV1
            .connect(nonOwner)
            .createPlan(
              1000,
              true,
              365,
              30,
              ethers.utils.formatBytes32String("Create to test plan")
            )
        ).to.be.revertedWithCustomError(
          subscriptionFacetV1,
          "PausedSubscriptionOwner"
        );
      });
    });

    describe("when owner is blacklisted", () => {
      it("should revert the transaction", async () => {
        await subscriptionFacetV1
          .connect(owner)
          .removeSubscriptionOwner(nonOwner.address);
        await expect(
          subscriptionFacetV1
            .connect(nonOwner)
            .createPlan(
              1000,
              true,
              365,
              30,
              ethers.utils.formatBytes32String("Create to test plan")
            )
        ).to.be.revertedWithCustomError(
          subscriptionFacetV1,
          "BlockedSubscriptionOwner"
        );
      });
    });

    describe("when duration is outside min-max bounds", () => {
      it("should revert the transaction if duration is less than minimum", async () => {
        await expect(
          subscriptionFacetV1
            .connect(nonOwner)
            .createPlan(
              1000,
              true,
              6,
              30,
              ethers.utils.formatBytes32String("Create to test plan")
            )
        ).to.be.revertedWith("Subscription: invalid duration");
      });

      it("should revert the transaction if duration is more than maximum", async () => {
        await expect(
          subscriptionFacetV1
            .connect(nonOwner)
            .createPlan(
              1000,
              true,
              366,
              30,
              ethers.utils.formatBytes32String("Create to test plan")
            )
        ).to.be.revertedWith("Subscription: invalid duration");
      });
    });

    describe("on successful plan creation", () => {
      it("should setup the plan correctly", async () => {
        const createTx = await subscriptionFacetV1
          .connect(nonOwner)
          .createPlan(
            1200,
            true,
            365,
            7,
            ethers.utils.formatBytes32String("Test plan")
          );

        const receipt = await createTx.wait();
        const planId = receipt.events[0].args[0];

        expect(createTx).to.emit(subscriptionFacetV1, "NewPlan");
        const plan = await subscriptionFacetV1.getPlan(planId);

        expect(plan.duration).to.eq(365);
        expect(plan.fee).to.eq(1200);
        expect(plan.autoRenew).to.eq(true);
        expect(plan.owner).to.eq(nonOwner.address);
        expect(plan.paymentInterval).to.eq(7);
        expect(ethers.utils.parseBytes32String(plan.title)).to.eq("Test plan");

        expect(
          await subscriptionFacetV1.isPlanActiveForOwner(
            nonOwner.address,
            planId
          )
        ).to.be.true;
        expect(
          await subscriptionFacetV1.isPlanActiveForOwner(
            nonOwner.address,
            planId
          )
        ).to.be.true;
      });
    });
  });

  describe("stopPlan", () => {
    let planId: string;
    beforeEach(async () => {
      const createTx = await subscriptionFacetV1
        .connect(nonOwner)
        .createPlan(
          1200,
          true,
          365,
          7,
          ethers.utils.formatBytes32String("Test plan")
        );

      const receipt = await createTx.wait();
      planId = receipt.events[0].args[0];
    });
    it("should not stop the plan if the caller is not subscriptionOwner", async () => {
      await expect(
        subscriptionFacetV1.connect(signers[4]).stopPlan(planId)
      ).to.be.revertedWithCustomError(
        subscriptionFacetV1,
        "NotSubscriptionOwner"
      );
    });

    it("should stop the plan if the caller is subscriptionOwner", async () => {
      let planIds: string[] = [];
      let createTx: any;
      let receipt: any;

      createTx = await subscriptionFacetV1
        .connect(nonOwner)
        .createPlan(
          1000,
          true,
          365,
          7,
          ethers.utils.formatBytes32String("Test plan1")
        );

      receipt = await createTx.wait();
      planIds.push(receipt.events[0].args[0]);

      createTx = await subscriptionFacetV1
        .connect(nonOwner)
        .createPlan(
          1200,
          true,
          365,
          14,
          ethers.utils.formatBytes32String("Test plan2")
        );
      receipt = await createTx.wait();
      planIds.push(receipt.events[0].args[0]);

      createTx = await subscriptionFacetV1
        .connect(nonOwner)
        .createPlan(
          1200,
          true,
          365,
          14,
          ethers.utils.formatBytes32String("Test plan3")
        );
      receipt = await createTx.wait();
      planIds.push(receipt.events[0].args[0]);

      await subscriptionFacetV1.connect(nonOwner).stopPlan(planIds[1]);

      expect(
        await subscriptionFacetV1.isPlanActiveForOwner(
          nonOwner.address,
          planIds[0]
        )
      ).to.be.true;
      expect(
        await subscriptionFacetV1.isPlanActiveForOwner(
          nonOwner.address,
          planIds[1]
        )
      ).to.be.false;
      expect(
        await subscriptionFacetV1.isPlanActiveForOwner(
          nonOwner.address,
          planIds[2]
        )
      ).to.be.true;
    });
  });

  describe("subscribe", () => {
    beforeEach(async () => {
      signers = await ethers.getSigners();
      owner = signers[0];
      nonOwner = signers[1];
    });

    describe("when subscription owner is paused", () => {
      it("should be reverted", async () => {
        const createTx = await subscriptionFacetV1
          .connect(nonOwner)
          .createPlan(
            1200,
            true,
            365,
            14,
            ethers.utils.formatBytes32String("Test plan2")
          );
        const receipt = await createTx.wait();
        const planId = receipt.events[0].args[0];

        await subscriptionFacetV1
          .connect(owner)
          .pauseSubscriptionOwner(nonOwner.address);

        await expect(
          subscriptionFacetV1
            .connect(signers[2])
            .subscribe(planId, myTestERC20.address, nonOwner.address)
        ).to.be.revertedWithCustomError(
          subscriptionFacetV1,
          "PausedSubscriptionOwner"
        );
      });
    });

    describe("when subscription plan is not found", () => {
      it("should be reverted", async () => {
        await expect(
          subscriptionFacetV1
            .connect(signers[2])
            .subscribe(
              randomPlanId,
              ethers.constants.AddressZero,
              nonOwner.address
            )
        ).to.be.revertedWithCustomError(subscriptionFacetV1, "PlanNotFound");
      });
    });

    describe("with a valid subscription plan", () => {
      let planId: string;
      beforeEach(async () => {
        const createTx = await subscriptionFacetV1
          .connect(nonOwner)
          .createPlan(
            1200,
            true,
            365,
            14,
            ethers.utils.formatBytes32String("Test plan2")
          );
        const receipt = await createTx.wait();
        planId = receipt.events[0].args[0];
      });

      describe("when msg sender already subscribed to the plan", () => {
        it("should be reverted", async () => {
          await myTestERC20.mint(signers[1].address, 2200);
          await myTestERC20.connect(signers[1]).approve(diamondAddress, 2200);

          await myTestERC20.mint(signers[2].address, 2200);
          await myTestERC20.connect(signers[2]).approve(diamondAddress, 2200);

          await subscriptionFacetV1
            .connect(signers[1])
            .subscribe(planId, myTestERC20.address, nonOwner.address);

          await subscriptionFacetV1
            .connect(signers[2])
            .subscribe(planId, myTestERC20.address, nonOwner.address);

          await expect(
            subscriptionFacetV1
              .connect(signers[2])
              .subscribe(planId, myTestERC20.address, nonOwner.address)
          ).to.be.revertedWith("Plan: already subscribed");
        });
      });

      describe("on successful subscription", () => {
        it("should set up all data", async () => {
          await myTestERC20.mint(signers[2].address, 2200);
          await myTestERC20.connect(signers[2]).approve(diamondAddress, 2200);

          expect(await myTestERC20.balanceOf(signers[2].address)).to.eq(2200);
          const subscribeTx = await subscriptionFacetV1
            .connect(signers[2])
            .subscribe(planId, myTestERC20.address, nonOwner.address);

          expect(await myTestERC20.balanceOf(signers[2].address)).to.eq(2154);
          expect(await myTestERC20.balanceOf(nonOwner.address)).to.eq(46);
          expect(subscribeTx).to.emit(subscriptionFacetV1, "ChargeSuccess");
        });
      });
    });
  });

  describe("chargeFeeBySubscriptionOwner", () => {
    beforeEach(async () => {
      signers = await ethers.getSigners();
      owner = signers[0];
      nonOwner = signers[1];

      const myTestERC20Factory = await ethers.getContractFactory("MyTestERC20");
      myTestERC20 = await myTestERC20Factory.deploy();
      await myTestERC20.deployed();
    });

    describe("when subscription plan is not found", () => {
      it("should be reverted", async () => {
        await expect(
          subscriptionFacetV1
            .connect(nonOwner)
            .chargeFeeBySubscriptionOwner(
              randomPlanId,
              myTestERC20.address,
              nonOwner.address
            )
        ).to.be.revertedWithCustomError(subscriptionFacetV1, "PlanNotFound");
      });
    });

    describe("when subscription owner is paused", () => {
      it("should be reverted", async () => {
        const createTx = await subscriptionFacetV1
          .connect(nonOwner)
          .createPlan(
            1200,
            true,
            365,
            14,
            ethers.utils.formatBytes32String("Test plan2")
          );

        const receipt = await createTx.wait();
        const planId = receipt.events[0].args[0];

        await subscriptionFacetV1
          .connect(owner)
          .pauseSubscriptionOwner(nonOwner.address);

        await expect(
          subscriptionFacetV1
            .connect(nonOwner)
            .chargeFeeBySubscriptionOwner(
              planId,
              myTestERC20.address,
              signers[2].address
            )
        ).to.be.revertedWithCustomError(
          subscriptionFacetV1,
          "PausedSubscriptionOwner"
        );
      });
    });

    describe("with a valid subscription plan", () => {
      let planId: string;

      beforeEach(async () => {
        const createTx = await subscriptionFacetV1
          .connect(nonOwner)
          .createPlan(
            1200,
            true,
            365,
            14,
            ethers.utils.formatBytes32String("Test plan2")
          );
        const receipt = await createTx.wait();
        planId = receipt.events[0].args[0];
      });

      describe("when plan not subscibed yet", () => {
        it("should revert", async () => {
          await expect(
            subscriptionFacetV1
              .connect(nonOwner)
              .chargeFeeBySubscriptionOwner(
                planId,
                myTestERC20.address,
                signers[2].address
              )
          ).to.be.revertedWith("Plan: not subscribed");
        });
      });

      describe("when user has plan subscription", () => {
        beforeEach(async () => {
          await myTestERC20.mint(signers[2].address, 2200);
          await myTestERC20.connect(signers[2]).approve(diamondAddress, 2200);

          await subscriptionFacetV1
            .connect(signers[2])
            .subscribe(planId, myTestERC20.address, nonOwner.address);
        });

        it("should set up all data", async () => {
          expect(await myTestERC20.balanceOf(signers[2].address)).to.eq(2154);

          const subscribeTx = await subscriptionFacetV1
            .connect(nonOwner)
            .chargeFeeBySubscriptionOwner(
              planId,
              myTestERC20.address,
              signers[2].address
            );

          expect(await myTestERC20.balanceOf(signers[2].address)).to.eq(2108);
          expect(await myTestERC20.balanceOf(nonOwner.address)).to.eq(92);
          expect(subscribeTx).to.emit(subscriptionFacetV1, "ChargeSuccess");
        });

        it("should revert if charged sooner than expected", async () => {
          expect(await myTestERC20.balanceOf(signers[2].address)).to.eq(2154);

          const subscribeTx = await subscriptionFacetV1
            .connect(nonOwner)
            .chargeFeeBySubscriptionOwner(
              planId,
              myTestERC20.address,
              signers[2].address
            );

          expect(await myTestERC20.balanceOf(signers[2].address)).to.eq(2108);
          expect(await myTestERC20.balanceOf(nonOwner.address)).to.eq(92);
          expect(subscribeTx).to.emit(subscriptionFacetV1, "ChargeSuccess");

          await expect(
            subscriptionFacetV1
              .connect(nonOwner)
              .chargeFeeBySubscriptionOwner(
                planId,
                myTestERC20.address,
                signers[2].address
              )
          ).to.be.revertedWith("Duplicate subscription payment");

          expect(await myTestERC20.balanceOf(signers[2].address)).to.eq(2108);
          expect(await myTestERC20.balanceOf(nonOwner.address)).to.eq(92);
        });

        it("should not revert if charged after the expected time", async () => {
          expect(await myTestERC20.balanceOf(signers[2].address)).to.eq(2154);

          const subscribeTx = await subscriptionFacetV1
            .connect(nonOwner)
            .chargeFeeBySubscriptionOwner(
              planId,
              myTestERC20.address,
              signers[2].address
            );

          expect(await myTestERC20.balanceOf(signers[2].address)).to.eq(2108);
          expect(await myTestERC20.balanceOf(nonOwner.address)).to.eq(92);
          expect(subscribeTx).to.emit(subscriptionFacetV1, "ChargeSuccess");

          await time.increase(14 * 24 * 3600);
          await subscriptionFacetV1
            .connect(nonOwner)
            .chargeFeeBySubscriptionOwner(
              planId,
              myTestERC20.address,
              signers[2].address
            );

          expect(await myTestERC20.balanceOf(signers[2].address)).to.eq(2062);
          expect(await myTestERC20.balanceOf(nonOwner.address)).to.eq(138);
        });

        it("should allow charging upto 3 days in advance", async () => {
          expect(await myTestERC20.balanceOf(signers[2].address)).to.eq(2154);

          const subscribeTx = await subscriptionFacetV1
            .connect(nonOwner)
            .chargeFeeBySubscriptionOwner(
              planId,
              myTestERC20.address,
              signers[2].address
            );

          expect(await myTestERC20.balanceOf(signers[2].address)).to.eq(2108);
          expect(await myTestERC20.balanceOf(nonOwner.address)).to.eq(92);
          expect(subscribeTx).to.emit(subscriptionFacetV1, "ChargeSuccess");

          await time.increase(11 * 24 * 3600);
          await subscriptionFacetV1
            .connect(nonOwner)
            .chargeFeeBySubscriptionOwner(
              planId,
              myTestERC20.address,
              signers[2].address
            );

          expect(await myTestERC20.balanceOf(signers[2].address)).to.eq(2062);
          expect(await myTestERC20.balanceOf(nonOwner.address)).to.eq(138);

          await time.increase(10 * 24 * 3600);
          await expect(
            subscriptionFacetV1
              .connect(nonOwner)
              .chargeFeeBySubscriptionOwner(
                planId,
                myTestERC20.address,
                signers[2].address
              )
          ).to.be.revertedWith("Duplicate subscription payment");
        });
      });

      describe("when user has plan subscription and being charged late", () => {
        beforeEach(async () => {
          await myTestERC20.mint(signers[2].address, 2200);
          await myTestERC20.connect(signers[2]).approve(diamondAddress, 2200);

          const createTx = await subscriptionFacetV1
            .connect(nonOwner)
            .createPlan(
              1200,
              true,
              60,
              30,
              ethers.utils.formatBytes32String("Test plan3")
            );
          const receipt = await createTx.wait();
          planId = receipt.events[0].args[0];

          await subscriptionFacetV1
            .connect(signers[2])
            .subscribe(planId, myTestERC20.address, nonOwner.address);
        });

        it("should revert if current end time goes over plan end time", async () => {
          subscriptionFacetV1
            .connect(nonOwner)
            .chargeFeeBySubscriptionOwner(
              planId,
              myTestERC20.address,
              signers[2].address
            );

          await time.increase(60 * 24 * 3600);
          await expect(
            subscriptionFacetV1
              .connect(nonOwner)
              .chargeFeeBySubscriptionOwner(
                planId,
                myTestERC20.address,
                signers[2].address
              )
          ).to.be.revertedWith("Plan Renewal required");
        });
      });
    });
  });

  describe("cancelSubscription", () => {
    describe("when plan doesn't exist", () => {
      it("should revert", async () => {
        await expect(
          subscriptionFacetV1
            .connect(signers[2])
            .cancelSubscription(randomPlanId)
        ).to.be.revertedWithCustomError(subscriptionFacetV1, "PlanNotFound");
      });
    });

    describe("when plan exist", () => {
      let planId: string;
      beforeEach(async () => {
        const createTx = await subscriptionFacetV1
          .connect(nonOwner)
          .createPlan(
            1200,
            true,
            365,
            14,
            ethers.utils.formatBytes32String("Test plan2")
          );
        const receipt = await createTx.wait();
        planId = receipt.events[0].args[0];
      });

      describe("and not subscribed by the user", () => {
        it("should revert", async () => {
          await expect(
            subscriptionFacetV1.connect(signers[2]).cancelSubscription(planId)
          ).to.be.revertedWith("Plan: not subscribed");
        });
      });

      describe("and is subscribed by the user", () => {
        it("should cancel the subscription for the user", async () => {
          await myTestERC20.mint(signers[1].address, 2200);
          await myTestERC20.connect(signers[1]).approve(diamondAddress, 2200);

          await subscriptionFacetV1
            .connect(signers[1])
            .subscribe(planId, myTestERC20.address, nonOwner.address);

          await myTestERC20.mint(signers[2].address, 2200);
          await myTestERC20.connect(signers[2]).approve(diamondAddress, 2200);

          await subscriptionFacetV1
            .connect(signers[2])
            .subscribe(planId, myTestERC20.address, nonOwner.address);

          expect(
            await subscriptionFacetV1.isPlanSubscribed(
              planId,
              signers[1].address
            )
          ).to.be.true;
          expect(
            await subscriptionFacetV1.isPlanSubscribed(
              planId,
              signers[2].address
            )
          ).to.be.true;

          await subscriptionFacetV1
            .connect(signers[2])
            .cancelSubscription(planId);

          expect(
            await subscriptionFacetV1.isPlanSubscribed(
              planId,
              signers[1].address
            )
          ).to.be.true;
          expect(
            await subscriptionFacetV1.isPlanSubscribed(
              planId,
              signers[2].address
            )
          ).to.be.false;
        });
      });
    });
  });

  describe("forcedCancellation", () => {
    describe("when plan doesn't exist", () => {
      it("should revert", async () => {
        await expect(
          subscriptionFacetV1
            .connect(nonOwner)
            .forcedCancellation(randomPlanId, signers[3].address)
        ).to.be.revertedWithCustomError(subscriptionFacetV1, "PlanNotFound");
      });
    });

    describe("when plan exist", () => {
      let planId: string;
      beforeEach(async () => {
        const createTx = await subscriptionFacetV1
          .connect(nonOwner)
          .createPlan(
            1200,
            true,
            365,
            14,
            ethers.utils.formatBytes32String("Test plan2")
          );
        const receipt = await createTx.wait();
        planId = receipt.events[0].args[0];
      });

      describe("and caller is not the subscription owner", () => {
        it("should revert", async () => {
          await expect(
            subscriptionFacetV1
              .connect(signers[2])
              .forcedCancellation(planId, signers[3].address)
          ).to.be.revertedWithCustomError(
            subscriptionFacetV1,
            "NotSubscriptionOwner"
          );
        });
      });

      describe("and the calleer is the subscription owner", () => {
        describe("and not subscribed by the user", () => {
          it("should revert", async () => {
            await expect(
              subscriptionFacetV1
                .connect(nonOwner)
                .forcedCancellation(planId, signers[3].address)
            ).to.be.revertedWith("Plan: not subscribed");
          });
        });

        describe("and is subscribed by the user", () => {
          it("should cancel the subscription for the user", async () => {
            await myTestERC20.mint(signers[1].address, 2200);
            await myTestERC20.connect(signers[1]).approve(diamondAddress, 2200);

            await subscriptionFacetV1
              .connect(signers[1])
              .subscribe(planId, myTestERC20.address, nonOwner.address);

            await myTestERC20.mint(signers[2].address, 2200);
            await myTestERC20.connect(signers[2]).approve(diamondAddress, 2200);

            await subscriptionFacetV1
              .connect(signers[2])
              .subscribe(planId, myTestERC20.address, nonOwner.address);

            expect(
              await subscriptionFacetV1.isPlanSubscribed(
                planId,
                signers[1].address
              )
            ).to.be.true;
            expect(
              await subscriptionFacetV1.isPlanSubscribed(
                planId,
                signers[2].address
              )
            ).to.be.true;

            await subscriptionFacetV1
              .connect(nonOwner)
              .forcedCancellation(planId, signers[2].address);

            expect(
              await subscriptionFacetV1.isPlanSubscribed(
                planId,
                signers[1].address
              )
            ).to.be.true;
            expect(
              await subscriptionFacetV1.isPlanSubscribed(
                planId,
                signers[2].address
              )
            ).to.be.false;
          });
        });
      });
    });
  });

  describe("isSubscriptionOwnerPaused", () => {
    describe("when subscription owner is paused", () => {
      it("should return true", async () => {
        await subscriptionFacetV1.pauseSubscriptionOwner(nonOwner.address);

        expect(
          await subscriptionFacetV1.isSubscriptionOwnerPaused(nonOwner.address)
        ).to.be.true;
      });
    });

    describe("when subscription owner is not paused", () => {
      it("should return false or does not exist", async () => {
        expect(
          await subscriptionFacetV1.isSubscriptionOwnerPaused(nonOwner.address)
        ).to.be.false;
      });
    });
  });

  describe("isPlanSubscribed", () => {
    describe("when plan doesn't exist", () => {
      it("should return false", async () => {
        expect(
          await subscriptionFacetV1.isPlanSubscribed(
            randomPlanId,
            signers[2].address
          )
        ).to.be.false;
      });
    });

    describe("when plan exist", () => {
      let planId: string;
      beforeEach(async () => {
        const createTx = await subscriptionFacetV1
          .connect(nonOwner)
          .createPlan(
            1200,
            true,
            365,
            14,
            ethers.utils.formatBytes32String("Test plan2")
          );

        const receipt = await createTx.wait();
        planId = receipt.events[0].args[0];
      });

      describe("and subscription doesn't", () => {
        it("should return false", async () => {
          expect(
            await subscriptionFacetV1.isPlanSubscribed(
              planId,
              signers[2].address
            )
          ).to.be.false;
        });
      });

      describe("and subsription does", () => {
        it("should return true", async () => {
          await myTestERC20.mint(signers[2].address, 2200);
          await myTestERC20.connect(signers[2]).approve(diamondAddress, 2200);

          await subscriptionFacetV1
            .connect(signers[2])
            .subscribe(planId, myTestERC20.address, nonOwner.address);

          expect(
            await subscriptionFacetV1.isPlanSubscribed(
              planId,
              signers[2].address
            )
          ).to.be.true;
        });
      });
    });
  });

  describe("isPlanActiveForOwner", () => {
    describe("when plan doesn't exist", () => {
      it("should return false", async () => {
        expect(
          await subscriptionFacetV1.isPlanActiveForOwner(
            nonOwner.address,
            randomPlanId
          )
        ).to.be.false;
      });
    });

    describe("when plan exist", () => {
      let planId: string;
      beforeEach(async () => {
        const createTx = await subscriptionFacetV1
          .connect(nonOwner)
          .createPlan(
            1200,
            true,
            365,
            14,
            ethers.utils.formatBytes32String("Test plan2")
          );
        const receipt = await createTx.wait();
        planId = receipt.events[0].args[0];
      });

      describe("when plan is active", () => {
        it("should return true", async () => {
          expect(
            await subscriptionFacetV1.isPlanActiveForOwner(
              nonOwner.address,
              planId
            )
          ).to.be.true;
        });
      });

      describe("when plan is inactive", () => {
        it("should return false", async () => {
          await subscriptionFacetV1.connect(nonOwner).stopPlan(planId);
          expect(
            await subscriptionFacetV1.isPlanActiveForOwner(
              nonOwner.address,
              planId
            )
          ).to.be.false;
        });
      });
    });
  });

  describe("getPlan", () => {
    describe("when plan doesn't exist for the provided id", () => {
      it("should raise an exception", async () => {
        await expect(
          subscriptionFacetV1.getPlan(randomPlanId)
        ).revertedWithCustomError(subscriptionFacetV1, "PlanNotFound");
      });
    });

    describe("when plan exist for the provided id", () => {
      let planId: string;
      beforeEach(async () => {
        const createTx = await subscriptionFacetV1
          .connect(nonOwner)
          .createPlan(
            1000,
            true,
            365,
            30,
            ethers.utils.formatBytes32String("Create to test plan")
          );

        const receipt = await createTx.wait();
        planId = receipt.events[0].args[0];
      });

      it("should return the subscription plan", async () => {
        const plan = await subscriptionFacetV1.getPlan(planId);
        expect(plan.duration).to.eq(365);
        expect(plan.fee).to.eq(1000);
        expect(plan.autoRenew).to.eq(true);
        expect(plan.owner).to.eq(nonOwner.address);
        expect(ethers.utils.parseBytes32String(plan.title)).to.eq(
          "Create to test plan"
        );
      });

      it("should return the subscription plan even if plan is inactive", async () => {
        await subscriptionFacetV1.connect(nonOwner).stopPlan(planId);
        const plan = await subscriptionFacetV1.getPlan(planId);
        expect(plan.duration).to.eq(365);
        expect(plan.fee).to.eq(1000);
        expect(plan.autoRenew).to.eq(true);
        expect(plan.owner).to.eq(nonOwner.address);
        expect(ethers.utils.parseBytes32String(plan.title)).to.eq(
          "Create to test plan"
        );
      });
    });
  });

  describe("setProtocolFee / getProtocolFee", () => {
    describe("when caller is not the contract owner", () => {
      it("should revert", async () => {
        await expect(
          subscriptionFacetV1.connect(signers[1]).setProtocolFee(10)
        ).to.be.revertedWith("LibDiamond: Must be contract owner");
      });
    });

    describe("when caller is the contract owner", () => {
      it("should set and get the base contract fee", async () => {
        let tx = await subscriptionFacetV1.getProtocolFee();

        expect(tx).to.be.eq(0);

        tx = await subscriptionFacetV1.connect(signers[0]).setProtocolFee(10);
        await tx.wait();

        tx = await subscriptionFacetV1.getProtocolFee();

        expect(tx).to.be.eq(10);
      });
    });
  });

  describe("transferBalance", () => {
    describe("when caller is not contract owner", () => {
      it("should revert", async () => {
        await expect(
          subscriptionFacetV1
            .connect(signers[5])
            .transferBalance(owner.address, 1)
        ).to.be.revertedWith("LibDiamond: Must be contract owner");
      });
    });

    describe("when caller is the contract owner", () => {
      describe("and recipient address is zero address", () => {
        it("should revert", async () => {
          await expect(
            subscriptionFacetV1
              .connect(owner)
              .transferBalance(ethers.constants.AddressZero, 1)
          ).to.be.revertedWithCustomError(
            subscriptionFacetV1,
            "ZeroAddressTransfer"
          );
        });
      });

      describe("and recipient address is not zero address", () => {
        beforeEach(async () => {
          const tx = await signers[5].sendTransaction({
            to: subscriptionFacetV1.address,
            value: 10,
          });
          await tx.wait();
        });

        describe("when request amount is more than the balance", () => {
          it("should revert", async () => {
            await expect(
              subscriptionFacetV1
                .connect(owner)
                .transferBalance(owner.address, 11)
            ).to.be.revertedWith("Insufficient balance in the contract");

            expect(await subscriptionFacetV1.nativeBalance()).to.eq(10);
          });
        });

        describe("when request amount is within balance", () => {
          it("should send the native tokens", async () => {
            const balance = await owner.getBalance();
            const tx = await subscriptionFacetV1
              .connect(owner)
              .transferBalance(owner.address, 10);
            const txReceipt = await tx.wait();
            const gasPaid = txReceipt.gasUsed.mul(txReceipt.effectiveGasPrice);
            expect(await subscriptionFacetV1.nativeBalance()).to.eq(0);
            expect(await owner.getBalance()).to.eq(
              balance.add(10).sub(gasPaid)
            );
          });
        });
      });
    });
  });

  describe("erc20Balance", () => {
    it("should return the erc20 balance of the contract", async () => {
      expect(await subscriptionFacetV1.erc20Balance(myTestERC20.address)).to.eq(
        0
      );
      const tx = await myTestERC20.mint(subscriptionFacetV1.address, 11);
      await tx.wait();
      expect(await subscriptionFacetV1.erc20Balance(myTestERC20.address)).to.eq(
        11
      );
    });
  });

  describe("nativeBalance", () => {
    it("should return the native token balance of the contract", async () => {
      expect(await subscriptionFacetV1.nativeBalance()).to.eq(0);
      const tx = await signers[5].sendTransaction({
        to: subscriptionFacetV1.address,
        value: 10,
      });
      await tx.wait();
      expect(await subscriptionFacetV1.nativeBalance()).to.eq(10);
    });
  });

  describe("transferERC20Balance", () => {
    describe("when caller is not contract owner", () => {
      it("should revert", async () => {
        await expect(
          subscriptionFacetV1
            .connect(signers[5])
            .transferERC20Balance(myTestERC20.address, owner.address, 1)
        ).to.be.revertedWith("LibDiamond: Must be contract owner");
      });
    });

    describe("when caller is the contract owner", () => {
      describe("and recipient address is zero address", () => {
        it("should revert", async () => {
          await expect(
            subscriptionFacetV1
              .connect(owner)
              .transferERC20Balance(
                myTestERC20.address,
                ethers.constants.AddressZero,
                1
              )
          ).to.be.revertedWithCustomError(
            subscriptionFacetV1,
            "ZeroAddressTransfer"
          );
        });
      });

      describe("and recipient address is not zero address", () => {
        beforeEach(async () => {
          const tx = await myTestERC20.mint(subscriptionFacetV1.address, 11);
          await tx.wait();
        });

        describe("when request amount is more than the balance", () => {
          it("should revert", async () => {
            await expect(
              subscriptionFacetV1
                .connect(owner)
                .transferERC20Balance(myTestERC20.address, owner.address, 12)
            ).to.be.revertedWith("Insufficient token balance in the contract");
            expect(
              await subscriptionFacetV1.erc20Balance(myTestERC20.address)
            ).to.eq(11);
          });
        });

        describe("when request amount is within balance", () => {
          it("should send the native tokens", async () => {
            expect(await myTestERC20.balanceOf(owner.address)).to.eq(0);
            expect(
              await subscriptionFacetV1.erc20Balance(myTestERC20.address)
            ).to.eq(11);
            await subscriptionFacetV1
              .connect(owner)
              .transferERC20Balance(myTestERC20.address, owner.address, 11);
            expect(
              await subscriptionFacetV1.erc20Balance(myTestERC20.address)
            ).to.eq(0);
            expect(await myTestERC20.balanceOf(owner.address)).to.eq(11);
          });
        });
      });
    });
  });

  describe("removeSubscriptionOwner", () => {
    describe("when caller is not contract owner", () => {
      it("should revert", async () => {
        await expect(
          subscriptionFacetV1
            .connect(signers[5])
            .removeSubscriptionOwner(owner.address)
        ).to.be.revertedWith("LibDiamond: Must be contract owner");
      });
    });

    describe("when caller is the contract owner", () => {
      let planIds: string[] = [];
      beforeEach(async () => {
        let createTx: any;
        let receipt: any;
        createTx = await subscriptionFacetV1
          .connect(nonOwner)
          .createPlan(
            1000,
            true,
            365,
            30,
            ethers.utils.formatBytes32String("Create to test plan")
          );

        receipt = await createTx.wait();
        planIds.push(receipt.events[0].args[0]);

        createTx = await subscriptionFacetV1
          .connect(signers[2])
          .createPlan(
            1000,
            true,
            365,
            30,
            ethers.utils.formatBytes32String("Create to test plan")
          );

        receipt = await createTx.wait();
        planIds.push(receipt.events[0].args[0]);

        createTx = await subscriptionFacetV1
          .connect(nonOwner)
          .createPlan(
            1000,
            true,
            365,
            30,
            ethers.utils.formatBytes32String("Create to test plan")
          );
        receipt = await createTx.wait();
        planIds.push(receipt.events[0].args[0]);
      });

      it("should remove all plans of the subscription and blacklist the subscription user", async () => {
        expect(
          await subscriptionFacetV1.isSubscriptionOwnerblackListed(
            nonOwner.address
          )
        ).to.be.false;
        await subscriptionFacetV1
          .connect(owner)
          .removeSubscriptionOwner(nonOwner.address);
        expect(
          await subscriptionFacetV1.isPlanActiveForOwner(
            nonOwner.address,
            planIds[0]
          )
        ).to.be.false;
        expect(
          await subscriptionFacetV1.isPlanActiveForOwner(
            nonOwner.address,
            planIds[2]
          )
        ).to.be.false;
        expect(
          await subscriptionFacetV1.isPlanActiveForOwner(
            signers[2].address,
            planIds[1]
          )
        ).to.be.true;
        expect(
          await subscriptionFacetV1.isSubscriptionOwnerblackListed(
            nonOwner.address
          )
        ).to.be.true;
      });
    });
  });

  describe("pauseSubscriptionOwner", () => {
    describe("when caller is not contract owner", () => {
      it("should revert", async () => {
        await expect(
          subscriptionFacetV1
            .connect(signers[5])
            .pauseSubscriptionOwner(nonOwner.address)
        ).to.be.revertedWith("LibDiamond: Must be contract owner");
      });
    });

    describe("when caller is contract owner", () => {
      it("should pause subscription owner", async () => {
        expect(
          await subscriptionFacetV1.isSubscriptionOwnerPaused(nonOwner.address)
        ).to.be.false;

        await subscriptionFacetV1
          .connect(owner)
          .pauseSubscriptionOwner(nonOwner.address);

        expect(
          await subscriptionFacetV1.isSubscriptionOwnerPaused(nonOwner.address)
        ).to.be.true;
      });
    });
  });

  describe("restoreSubscriptionOwner", () => {
    describe("when caller is not contract owner", () => {
      it("should revert", async () => {
        await expect(
          subscriptionFacetV1
            .connect(signers[5])
            .restoreSubscriptionOwner(nonOwner.address)
        ).to.be.revertedWith("LibDiamond: Must be contract owner");
      });
    });

    describe("when caller is contract owner", () => {
      it("should restore subscription owner", async () => {
        await subscriptionFacetV1
          .connect(owner)
          .pauseSubscriptionOwner(nonOwner.address);

        expect(
          await subscriptionFacetV1.isSubscriptionOwnerPaused(nonOwner.address)
        ).to.be.true;

        await subscriptionFacetV1
          .connect(owner)
          .restoreSubscriptionOwner(nonOwner.address);

        expect(
          await subscriptionFacetV1.isSubscriptionOwnerPaused(nonOwner.address)
        ).to.be.false;
      });
    });
  });
});
