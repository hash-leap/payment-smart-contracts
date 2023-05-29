import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { deployDiamond } from "../scripts/deploy";
import { getSelectors, FacetCutAction } from "../scripts/libraries/diamond";
import sinon from "sinon";

describe("CrossChainPaymentFacetV1", async () => {
  let owner: SignerWithAddress;
  let otherAccount: SignerWithAddress;
  let recipient: SignerWithAddress;
  let diamondAddress: string;
  let crossChainPaymentFacet: Contract;
  let myTestERC20: Contract;
  let myAxelarMock: Contract;

  before(async () => {
    sinon.stub(console, "log");
    const signers = await ethers.getSigners();
    owner = signers[0];
    otherAccount = signers[1];
    recipient = signers[2];

    const myTestERC20Factory = await ethers.getContractFactory("MyTestERC20");
    myTestERC20 = await myTestERC20Factory.deploy();
    await myTestERC20.deployed();
    await myTestERC20.mint(owner.address, 10000000);

    const myAxelarMockFactory = await ethers.getContractFactory("MyAxelarMock");
    myAxelarMock = await myAxelarMockFactory.deploy();
    await myAxelarMock.deployed();
  });

  after(() => {
    sinon.restore();
  });

  beforeEach(async () => {
    diamondAddress = await deployDiamond();

    const CrossChainPaymentFacetV1Factory = await ethers.getContractFactory(
      "CrossChainPaymentFacetV1"
    );
    const crossChainPaymentFacetV1 =
      await CrossChainPaymentFacetV1Factory.deploy();
    await crossChainPaymentFacetV1.deployed();

    diamondAddress = await deployDiamond();
    const diamondCutFacet = await ethers.getContractAt(
      "DiamondCutFacet",
      diamondAddress
    );

    await ethers.getContractAt("DiamondLoupeFacet", diamondAddress);

    await ethers.getContractAt("OwnershipFacet", diamondAddress);
    const selectors = getSelectors(crossChainPaymentFacetV1);

    const tx = await diamondCutFacet.diamondCut(
      [
        {
          facetAddress: crossChainPaymentFacetV1.address,
          action: FacetCutAction.Add,
          functionSelectors: selectors,
        },
      ],
      ethers.constants.AddressZero,
      "0x",
      { gasLimit: 800000 }
    );
    await tx.wait();

    crossChainPaymentFacet = await ethers.getContractAt(
      "CrossChainPaymentFacetV1",
      diamondAddress
    );
  });

  describe("setAxelarContract", () => {
    const newBinanceAddress = "0x4D147dCb984e6affEEC47e44293DA442580A3Ec0";
    it("Not owner: should revert", async () => {
      await expect(
        crossChainPaymentFacet
          .connect(otherAccount)
          .setAxelarContract("binance", newBinanceAddress)
      ).to.be.revertedWith("LibDiamond: Must be contract owner");
    });

    it("Owner: should set contract address for chain on axelar", async () => {
      await crossChainPaymentFacet
        .connect(owner)
        .setAxelarContract("binance", newBinanceAddress);
      expect(await crossChainPaymentFacet.getAxelarContract("binance")).to.eql(
        newBinanceAddress
      );
    });

    describe("getAxelarContract", () => {
      beforeEach(async () => {
        await crossChainPaymentFacet
          .connect(owner)
          .setAxelarContract("binance", newBinanceAddress);
      });

      it("should return the axelar contract address for the chain", async () => {
        expect(
          await crossChainPaymentFacet.getAxelarContract("binance")
        ).to.eql("0x4D147dCb984e6affEEC47e44293DA442580A3Ec0");
      });
    });
  });

  describe("transfer", () => {
    beforeEach(async () => {
      await crossChainPaymentFacet
        .connect(owner)
        .setAxelarContract("binance", myAxelarMock.address);
    });

    it("should revert when source chain address not set", async () => {
      await expect(
        crossChainPaymentFacet.transfer(
          "randomChain",
          "Avalanche",
          recipient.address,
          "USDC",
          1000,
          "0x64544969ed7EBf5f083679233325356EbE738930",
          "payref",
          ["tag1"]
        )
      ).to.be.revertedWith("Source chain address not set");
    });

    it("should revert if token contract address is 0", async () => {
      await expect(
        crossChainPaymentFacet.transfer(
          "binance",
          "Avalanche",
          recipient.address,
          "USDC",
          1000,
          ethers.constants.AddressZero,
          "payref",
          ["tag1"]
        )
      ).to.be.revertedWith("Wrong token contract");
    });

    it("should transfer the amount to the contract (on preapproval)", async () => {
      const sourceChainAddress = await crossChainPaymentFacet.getAxelarContract(
        "binance"
      );

      console.info({ sourceChainAddress });
      expect(await myTestERC20.balanceOf(owner.address)).to.equal(10000000);
      await myTestERC20.connect(owner).approve(diamondAddress, 1000);

      expect(
        await myTestERC20.allowance(diamondAddress, sourceChainAddress)
      ).to.equal(0);

      const transfer = await crossChainPaymentFacet.transfer(
        "binance",
        "Avalanche",
        recipient.address,
        "USDC",
        1000,
        myTestERC20.address,
        "payref",
        ["tag1"]
      );

      expect(await myTestERC20.balanceOf(owner.address)).to.equal(
        10000000 - 1000
      );

      expect(
        await myTestERC20.allowance(diamondAddress, sourceChainAddress)
      ).to.equal(1000);

      expect(transfer).to.emit(crossChainPaymentFacet, "TransferSuccess");
    });
  });
});
