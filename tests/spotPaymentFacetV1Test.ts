import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { expect } from "chai";
import { Contract, BigNumber } from "ethers";
import sinon from "sinon";
import { deployDiamond } from "../scripts/deploy";
import { getSelectors, FacetCutAction } from "../scripts/libraries/diamond";

describe("SpotPaymentFacetV1", async () => {
  let signers: SignerWithAddress[];
  let spotPaymentFacetV1: Contract;
  let myTestERC20: Contract;
  let paymentRef = ethers.utils.formatBytes32String("invoiceNumber");
  let paymentType = ethers.utils.formatBytes32String("invoice");
  let tags = [
    ethers.utils.formatBytes32String("tag1"),
    ethers.utils.formatBytes32String("tag2"),
  ];

  let diamondAddress: string;
  let owner: SignerWithAddress;
  let nonOwner: SignerWithAddress;

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
    const SpotPaymentFacetV1Factory = await ethers.getContractFactory(
      "SpotPaymentFacetV1"
    );
    spotPaymentFacetV1 = await SpotPaymentFacetV1Factory.connect(
      owner
    ).deploy();
    await spotPaymentFacetV1.deployed();

    const diamondCutFacet = await ethers.getContractAt(
      "DiamondCutFacet",
      diamondAddress
    );

    await ethers.getContractAt("DiamondLoupeFacet", diamondAddress);

    await ethers.getContractAt("OwnershipFacet", diamondAddress);
    const selectors = getSelectors(spotPaymentFacetV1);

    const tx = await diamondCutFacet.diamondCut(
      [
        {
          facetAddress: spotPaymentFacetV1.address,
          action: FacetCutAction.Add,
          functionSelectors: selectors,
        },
      ],
      ethers.constants.AddressZero,
      "0x",
      { gasLimit: 900000 }
    );
    await tx.wait();

    spotPaymentFacetV1 = await ethers.getContractAt(
      "SpotPaymentFacetV1",
      diamondAddress
    );

    const myTestERC20Factory = await ethers.getContractFactory("MyTestERC20");
    myTestERC20 = await myTestERC20Factory.deploy();
    await myTestERC20.deployed();
  });

  describe("pauseTransfer, restartTransfers, isPaused", () => {
    describe("when not contract owner", () => {
      it("pauseTransfers: should revert", async () => {
        expect(await spotPaymentFacetV1.isPaused()).to.be.false;

        await expect(
          spotPaymentFacetV1.connect(signers[5]).pauseTransfers()
        ).to.be.revertedWith("LibDiamond: Must be contract owner");

        expect(await spotPaymentFacetV1.isPaused()).to.be.false;
      });

      it("restartTransfers: should revert", async () => {
        expect(await spotPaymentFacetV1.isPaused()).to.be.false;

        await expect(
          spotPaymentFacetV1.connect(signers[5]).restartTransfers()
        ).to.be.revertedWith("LibDiamond: Must be contract owner");

        expect(await spotPaymentFacetV1.isPaused()).to.be.false;
      });
    });

    describe("when contract owner", () => {
      it("restartTransfers: should pause and restart", async () => {
        expect(await spotPaymentFacetV1.isPaused()).to.be.false;

        await spotPaymentFacetV1.connect(owner).pauseTransfers();
        expect(await spotPaymentFacetV1.isPaused()).to.be.true;

        await spotPaymentFacetV1.connect(owner).restartTransfers();
        expect(await spotPaymentFacetV1.isPaused()).to.be.false;
      });
    });
  });

  describe("transfer", () => {
    beforeEach(async () => {
      const tx = await spotPaymentFacetV1
        .connect(owner)
        .setTokenAddress("ETH", ethers.constants.AddressZero);
      await tx.wait();
    });

    describe("NATIVE token e.g. ETH or MATIC, etc.", () => {
      it("should revert if paused", async () => {
        await spotPaymentFacetV1.connect(owner).pauseTransfers();
        expect(await spotPaymentFacetV1.isPaused()).to.be.true;

        await expect(
          spotPaymentFacetV1
            .connect(signers[2])
            .transfer(
              signers[1].address,
              "MYK",
              20002,
              1,
              tags,
              paymentRef,
              paymentType
            )
        ).to.be.revertedWith("Transfers are paused");
      });

      it("should revert when value sent is 0", async () => {
        await expect(
          spotPaymentFacetV1.transfer(
            signers[1].address,
            ethers.constants.AddressZero,
            20000,
            0,
            tags,
            paymentRef,
            paymentType,
            {
              value: ethers.utils.parseUnits("0", "ether"),
            }
          )
        ).to.be.revertedWith("No eth was sent");
      });

      it("should revert when value sent less than the amount", async () => {
        await expect(
          spotPaymentFacetV1.transfer(
            signers[1].address,
            ethers.constants.AddressZero,
            ethers.utils.parseUnits("0.00011"),
            0,
            tags,
            paymentRef,
            paymentType,
            {
              value: ethers.utils.parseUnits("0.0001", "ether"),
            }
          )
        ).to.be.revertedWith("Insufficient tokens sent");
      });

      it("should revert when recipient is a zero address", async () => {
        const signer0InitialBalance = await signers[0].getBalance();

        expect(
          await spotPaymentFacetV1
            .connect(signers[0])
            .getTotalAmountForToken("ETH")
        ).to.eq(0);

        await expect(
          spotPaymentFacetV1.transfer(
            ethers.constants.AddressZero,
            "ETH",
            ethers.utils.parseUnits("1", "ether"),
            0,
            tags,
            paymentRef,
            paymentType,
            {
              value: ethers.utils.parseUnits("1", "ether"),
            }
          )
        ).to.be.revertedWith("Recipient with zero address");

        const signer0BalanceAfterTransfer = await signers[0].getBalance();

        expect(signer0BalanceAfterTransfer).to.eq(signer0InitialBalance);
      });

      it("should revert the transaction if the token sent is 10% more than the amount parameter", async () => {
        await expect(
          spotPaymentFacetV1.transfer(
            signers[1].address,
            ethers.constants.AddressZero,
            ethers.utils.parseUnits("0.89"),
            0,
            tags,
            paymentRef,
            paymentType,
            {
              value: ethers.utils.parseUnits("0.1", "ether"),
            }
          )
        ).to.be.revertedWith("Insufficient tokens sent");
      });

      it("should revert the transaction if sender and recipient addresses are same", async () => {
        await expect(
          spotPaymentFacetV1.transfer(
            signers[0].address,
            ethers.constants.AddressZero,
            ethers.utils.parseUnits("1"),
            0,
            tags,
            paymentRef,
            paymentType,
            {
              value: ethers.utils.parseUnits("1", "ether"),
            }
          )
        ).to.be.revertedWith("Same account transfer is not allowed");
      });

      it("should transfer the native token", async () => {
        let transferTxGasCost: BigNumber;
        const signer0InitialBalance = await signers[0].getBalance();
        const signer1InitialBalance = await signers[1].getBalance();

        expect(
          await spotPaymentFacetV1
            .connect(signers[0])
            .getTotalAmountForToken("ETH")
        ).to.eq(0);

        const transferTokenTx = await spotPaymentFacetV1.transfer(
          signers[1].address,
          "ETH",
          ethers.utils.parseUnits("1", "ether"),
          0,
          tags,
          paymentRef,
          paymentType,
          {
            value: ethers.utils.parseUnits("1", "ether"),
          }
        );

        const transferTokensTxReceipt = await transferTokenTx.wait();
        transferTxGasCost = transferTokensTxReceipt.gasUsed.mul(
          transferTokensTxReceipt.effectiveGasPrice
        );

        const signer0BalanceAfterTransfer = await signers[0].getBalance();
        const signer1BalanceAfterTransfer = await signers[1].getBalance();

        expect(signer1BalanceAfterTransfer).to.eq(
          signer1InitialBalance.add(ethers.utils.parseUnits("1"))
        );

        expect(signer0BalanceAfterTransfer).to.eq(
          signer0InitialBalance.sub(
            ethers.utils.parseUnits("1").add(transferTxGasCost)
          )
        );
        expect(transferTokenTx).to.emit(spotPaymentFacetV1, "TransferSuccess");
        expect(await spotPaymentFacetV1.getTokenAddress("ETH")).to.eq(
          ethers.constants.AddressZero
        );

        expect(
          await spotPaymentFacetV1
            .connect(signers[0])
            .getTotalAmountForToken("ETH")
        ).to.eq(ethers.utils.parseUnits("1"));
      });
    });

    describe("ERC20", () => {
      beforeEach(async () => {
        const myTestERC20Factory = await ethers.getContractFactory(
          "MyTestERC20"
        );
        myTestERC20 = await myTestERC20Factory.deploy();
        await myTestERC20.deployed();

        const tx = await spotPaymentFacetV1
          .connect(owner)
          .setTokenAddress("MYK", myTestERC20.address);
        await tx.wait();
      });

      it("should revert the transaction if sender and recipient addresses are same", async () => {
        await expect(
          spotPaymentFacetV1.transfer(
            signers[0].address,
            "MYK",
            20000,
            1,
            tags,
            paymentRef,
            paymentType
          )
        ).to.be.revertedWith("Same account transfer is not allowed");
      });

      it("should revert if the signer has insufficient allowwance", async () => {
        await myTestERC20.mint(signers[0].address, 200000);
        await myTestERC20.approve(spotPaymentFacetV1.address, 19999);

        await expect(
          spotPaymentFacetV1.transfer(
            signers[1].address,
            "MYK",
            20000,
            1,
            tags,
            paymentRef,
            paymentType
          )
        ).to.be.revertedWith("Insufficient allowance");
      });

      it("should revert if sender balance is less than the amount transferred", async () => {
        await myTestERC20.mint(signers[2].address, 19999);

        await myTestERC20
          .connect(signers[2])
          .approve(spotPaymentFacetV1.address, 20002);

        await expect(
          spotPaymentFacetV1
            .connect(signers[2])
            .transfer(
              signers[1].address,
              "MYK",
              20002,
              1,
              tags,
              paymentRef,
              paymentType
            )
        ).to.be.revertedWith("Insufficient token balance");
      });

      it("should transfer the ERC20 token", async () => {
        await myTestERC20.mint(signers[3].address, 200000);
        await myTestERC20
          .connect(signers[3])
          .approve(spotPaymentFacetV1.address, 20000);

        const transfer = await spotPaymentFacetV1
          .connect(signers[3])
          .transfer(
            signers[1].address,
            "MYK",
            20000,
            1,
            tags,
            paymentRef,
            paymentType
          );

        expect(await myTestERC20.balanceOf(signers[3].address)).to.eq(180000);
        expect(await myTestERC20.balanceOf(signers[1].address)).to.eq(20000);
        expect(transfer).to.emit(spotPaymentFacetV1, "TransferSuccess");

        expect(await spotPaymentFacetV1.getTokenAddress("MYK")).to.eq(
          myTestERC20.address
        );

        expect(await spotPaymentFacetV1.getTotalAmountForToken("MYK")).to.eq(
          20000
        );
      });
    });
  });

  describe("setTokenAddress, getTokenAddress, getContractAddressCount", () => {
    describe("when not contract owner", () => {
      it("should revert", async () => {
        await expect(
          spotPaymentFacetV1
            .connect(nonOwner)
            .setTokenAddress("MYK", myTestERC20.address)
        ).to.be.revertedWith("LibDiamond: Must be contract owner");
      });
    });

    describe("when contract owner", () => {
      it("should set the token address for erc20 token", async () => {
        expect(await spotPaymentFacetV1.getContractAddressCount()).to.eq(0);

        const tx = await spotPaymentFacetV1
          .connect(owner)
          .setTokenAddress("MYK", myTestERC20.address);
        await tx.wait();

        expect(await spotPaymentFacetV1.getContractAddressCount()).to.eq(1);
        expect(await spotPaymentFacetV1.getTokenAddress("MYK")).to.eq(
          myTestERC20.address
        );
      });

      it("should set the token address for native token", async () => {
        expect(await spotPaymentFacetV1.getContractAddressCount()).to.eq(0);

        const tx = await spotPaymentFacetV1
          .connect(owner)
          .setTokenAddress("ETH", ethers.constants.AddressZero);
        await tx.wait();

        expect(await spotPaymentFacetV1.getContractAddressCount()).to.eq(1);
        expect(await spotPaymentFacetV1.getTokenAddress("ETH")).to.eq(
          ethers.constants.AddressZero
        );
      });

      it("should set the token address for multiple tokens", async () => {
        let tx: any;
        expect(await spotPaymentFacetV1.getContractAddressCount()).to.eq(0);

        tx = await spotPaymentFacetV1
          .connect(owner)
          .setTokenAddress("ETH", ethers.constants.AddressZero);
        await tx.wait();

        expect(await spotPaymentFacetV1.getContractAddressCount()).to.eq(1);
        expect(await spotPaymentFacetV1.getTokenAddress("ETH")).to.eq(
          ethers.constants.AddressZero
        );

        tx = await spotPaymentFacetV1
          .connect(owner)
          .setTokenAddress("ETH", ethers.constants.AddressZero);
        tx.wait();

        expect(await spotPaymentFacetV1.getContractAddressCount()).to.eq(1);
        expect(await spotPaymentFacetV1.getTokenAddress("ETH")).to.eq(
          ethers.constants.AddressZero
        );

        tx = await spotPaymentFacetV1
          .connect(owner)
          .setTokenAddress("MYK", myTestERC20.address);
        await tx.wait();

        expect(await spotPaymentFacetV1.getContractAddressCount()).to.eq(2);
        expect(await spotPaymentFacetV1.getTokenAddress("ETH")).to.eq(
          ethers.constants.AddressZero
        );
        expect(await spotPaymentFacetV1.getTokenAddress("MYK")).to.eq(
          myTestERC20.address
        );

        // shouldn't be any change in the expectation statements
        tx = await spotPaymentFacetV1
          .connect(owner)
          .setTokenAddress("MYK", myTestERC20.address);
        await tx.wait();

        expect(await spotPaymentFacetV1.getContractAddressCount()).to.eq(2);
        expect(await spotPaymentFacetV1.getTokenAddress("ETH")).to.eq(
          ethers.constants.AddressZero
        );
        expect(await spotPaymentFacetV1.getTokenAddress("MYK")).to.eq(
          myTestERC20.address
        );
      });
    });
  });

  describe("getContractAddressCount, getTotalAmountForToken", () => {
    beforeEach(async () => {
      await spotPaymentFacetV1.setTokenAddress("MYK", myTestERC20.address);
      await spotPaymentFacetV1.setTokenAddress(
        "ETH",
        ethers.constants.AddressZero
      );
    });
    it("should return 2 when same ERC20 and native transfers are made", async () => {
      expect(await spotPaymentFacetV1.getContractAddressCount()).to.eq(2);
      expect(await spotPaymentFacetV1.getTotalAmountForToken("MYK")).to.eq(0);

      expect(await spotPaymentFacetV1.getTotalAmountForToken("Native")).to.eq(
        0
      );

      await myTestERC20.mint(signers[0].address, 200000);
      await myTestERC20.approve(spotPaymentFacetV1.address, 60000);

      for (let i = 1; i < 3; i++) {
        await spotPaymentFacetV1.transfer(
          signers[i].address,
          "MYK",
          20000,
          1,
          tags,
          paymentRef,
          paymentType
        );
      }

      for (let i = 1; i < 3; i++) {
        await spotPaymentFacetV1.transfer(
          signers[i].address,
          "ETH",
          ethers.utils.parseUnits("1", "ether"),
          0,
          tags,
          paymentRef,
          paymentType,
          {
            value: ethers.utils.parseUnits("1", "ether"),
          }
        );
      }

      expect(await spotPaymentFacetV1.getContractAddressCount()).to.eq(2);

      expect(await spotPaymentFacetV1.getTotalAmountForToken("MYK")).to.eq(
        40000
      );

      expect(await spotPaymentFacetV1.getTotalAmountForToken("ETH")).to.eq(
        ethers.utils.parseUnits("2", "ether")
      );

      await expect(
        spotPaymentFacetV1.connect(signers[2]).getTotalAmountForToken("ETH")
      ).to.be.rejectedWith("LibDiamond: Must be contract owner");
    });
  });
});
