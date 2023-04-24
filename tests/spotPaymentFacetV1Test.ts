import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { expect } from "chai";
import { Contract, BigNumber } from "ethers";

describe("SpotPaymentFacetV1", async () => {
  let signers: SignerWithAddress[];
  let spotPaymentFacetV1: Contract;
  let myTestERC20: Contract;

  beforeEach(async () => {
    const SpotPaymentFacetV1Factory = await ethers.getContractFactory(
      "SpotPaymentFacetV1"
    );
    spotPaymentFacetV1 = await SpotPaymentFacetV1Factory.deploy();
    await spotPaymentFacetV1.deployed();

    signers = await ethers.getSigners();
    signers[2].connect;
  });

  describe("transfer", () => {
    describe("NATIVE token e.g. ETH or MATIC, etc.", () => {
      it("should revert when value sent is 0", async () => {
        await expect(
          spotPaymentFacetV1.transfer(
            signers[1].address,
            ethers.constants.AddressZero,
            20000,
            0,
            ["tag1", "tag2"],
            "invoiceNumber",
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
            ["tag1", "tag2"],
            "invoiceNumber",
            {
              value: ethers.utils.parseUnits("0.0001", "ether"),
            }
          )
        ).to.be.revertedWith("Insufficient tokens sent");
      });

      it("should revert the transaction if the token sent is 10% more than the amount parameter", async () => {
        await expect(
          spotPaymentFacetV1.transfer(
            signers[1].address,
            ethers.constants.AddressZero,
            ethers.utils.parseUnits("0.89"),
            0,
            ["tag1", "tag2"],
            "invoiceNumber",
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
            ["tag1", "tag2"],
            "invoiceNumber",
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

        expect(await spotPaymentFacetV1.getContractAddressCount()).to.eq(0);
        expect(
          await spotPaymentFacetV1.getTransferAmount(
            ethers.constants.AddressZero
          )
        ).to.eq(0);

        const transferTokenTx = await spotPaymentFacetV1.transfer(
          signers[1].address,
          ethers.constants.AddressZero,
          ethers.utils.parseUnits("1", "ether"),
          0,
          ["tag1", "tag2"],
          "invoiceNumber",
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
        expect(transferTokenTx).to.emit(
          spotPaymentFacetV1,
          "TransferSuccessEvent"
        );
        expect(transferTokenTx).to.emit(
          spotPaymentFacetV1,
          "TransferSuccessEvent"
        );
        expect(await spotPaymentFacetV1.getContractAddressAt(0)).to.eq(
          ethers.constants.AddressZero
        );

        expect(await spotPaymentFacetV1.getContractAddressCount()).to.eq(1);
        expect(
          await spotPaymentFacetV1.getTransferAmount(
            ethers.constants.AddressZero
          )
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
      });

      it("should revert the transaction if sender and recipient addresses are same", async () => {
        await expect(
          spotPaymentFacetV1.transfer(
            signers[0].address,
            ethers.constants.AddressZero,
            20000,
            1,
            ["tag1", "tag2"],
            "invoiceNumber"
          )
        ).to.be.revertedWith("Same account transfer is not allowed");
      });

      it("should revert if the insufficient allowwance", async () => {
        await myTestERC20.mint(signers[0].address, 200000);
        await myTestERC20.approve(spotPaymentFacetV1.address, 19999);

        await expect(
          spotPaymentFacetV1.transfer(
            signers[1].address,
            myTestERC20.address,
            20000,
            1,
            ["tag1", "tag2"],
            "invoiceNumber"
          )
        ).to.be.revertedWith("Insufficient allowance");
      });

      it("should revert if sender balance is less than the amount transferred", async () => {
        await myTestERC20.mint(signers[0].address, 19999);
        await myTestERC20.approve(spotPaymentFacetV1.address, 20000);

        await expect(
          spotPaymentFacetV1.transfer(
            signers[1].address,
            myTestERC20.address,
            20000,
            1,
            ["tag1", "tag2"],
            "invoiceNumber"
          )
        ).to.be.revertedWith("Insufficient token balance");
      });

      it("should transfer the ERC20 token", async () => {
        await myTestERC20.mint(signers[0].address, 200000);
        await myTestERC20.approve(spotPaymentFacetV1.address, 20000);
        expect(await spotPaymentFacetV1.getContractAddressCount()).to.eq(0);

        const transfer = await spotPaymentFacetV1.transfer(
          signers[1].address,
          myTestERC20.address,
          20000,
          1,
          ["tag1", "tag2"],
          "invoiceNumber"
        );

        expect(await myTestERC20.balanceOf(signers[0].address)).to.eq(180000);
        expect(await myTestERC20.balanceOf(signers[1].address)).to.eq(20000);
        expect(transfer).to.emit(spotPaymentFacetV1, "TransferSuccessEvent");

        expect(await spotPaymentFacetV1.getContractAddressAt(0)).to.eq(
          myTestERC20.address
        );

        expect(await spotPaymentFacetV1.getContractAddressCount()).to.eq(1);

        expect(
          await spotPaymentFacetV1.getTransferAmount(myTestERC20.address)
        ).to.eq(20000);
      });
    });
  });

  describe("getContractAddressCount, getContractAddressAt", () => {
    it("should return zero when no transfers are made", async () => {
      expect(await spotPaymentFacetV1.getContractAddressCount()).to.eq(0);
    });

    it("should return 2 when same ERC20 and native transfers are made", async () => {
      expect(await spotPaymentFacetV1.getContractAddressCount()).to.eq(0);
      expect(
        await spotPaymentFacetV1.getTransferAmount(myTestERC20.address)
      ).to.eq(0);

      expect(
        await spotPaymentFacetV1.getTransferAmount(ethers.constants.AddressZero)
      ).to.eq(0);

      await myTestERC20.mint(signers[0].address, 200000);
      await myTestERC20.approve(spotPaymentFacetV1.address, 60000);

      for (let i = 1; i < 3; i++) {
        await spotPaymentFacetV1.transfer(
          signers[i].address,
          myTestERC20.address,
          20000,
          1,
          ["tag1", "tag2"],
          "invoiceNumber"
        );
      }

      for (let i = 1; i < 3; i++) {
        await spotPaymentFacetV1.transfer(
          signers[i].address,
          ethers.constants.AddressZero,
          ethers.utils.parseUnits("1", "ether"),
          0,
          ["tag1", "tag2"],
          "invoiceNumber",
          {
            value: ethers.utils.parseUnits("1", "ether"),
          }
        );
      }

      expect(await spotPaymentFacetV1.getContractAddressCount()).to.eq(2);

      expect(await spotPaymentFacetV1.getContractAddressAt(0)).to.eq(
        myTestERC20.address
      );
      expect(await spotPaymentFacetV1.getContractAddressAt(1)).to.eq(
        ethers.constants.AddressZero
      );

      expect(
        await spotPaymentFacetV1.getTransferAmount(myTestERC20.address)
      ).to.eq(40000);

      expect(
        await spotPaymentFacetV1.getTransferAmount(ethers.constants.AddressZero)
      ).to.eq(ethers.utils.parseUnits("2", "ether"));
    });
  });
});
