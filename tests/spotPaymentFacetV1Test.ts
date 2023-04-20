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
  });

  describe("NATIVE token e.g. ETH or MATIC, etc.", () => {
    it("should revert when value sent is 0", async () => {
      await expect(
        spotPaymentFacetV1.transfer(
          signers[1].address,
          ethers.constants.AddressZero,
          20000,
          0,
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
          {
            value: ethers.utils.parseUnits("0.1", "ether"),
          }
        )
      ).to.be.revertedWith("Insufficient tokens sent");
    });

    it("should transfer the native token", async () => {
      let transferTxGasCost: BigNumber;
      const signer0InitialBalance = await signers[0].getBalance();
      const signer1InitialBalance = await signers[1].getBalance();
      const transferTokenTx = await spotPaymentFacetV1.transfer(
        signers[1].address,
        ethers.constants.AddressZero,
        ethers.utils.parseUnits("1", "ether"),
        0,
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
    });
  });

  describe("ERC20", () => {
    beforeEach(async () => {
      const myTestERC20Factory = await ethers.getContractFactory("MyTestERC20");
      myTestERC20 = await myTestERC20Factory.deploy();
      await myTestERC20.deployed();
    });

    it("should revert if the insufficient allowwance", async () => {
      await myTestERC20.mint(signers[0].address, 200000);
      await myTestERC20.approve(spotPaymentFacetV1.address, 19999);

      await expect(
        spotPaymentFacetV1.transfer(
          signers[1].address,
          myTestERC20.address,
          20000,
          1
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
          1
        )
      ).to.be.revertedWith("Insufficient token balance");
    });

    it("should transfer the ERC20 token", async () => {
      await myTestERC20.mint(signers[0].address, 200000);
      await myTestERC20.approve(spotPaymentFacetV1.address, 20000);

      const transfer = await spotPaymentFacetV1.transfer(
        signers[1].address,
        myTestERC20.address,
        20000,
        1
      );

      expect(await myTestERC20.balanceOf(signers[0].address)).to.eq(180000);
      expect(await myTestERC20.balanceOf(signers[1].address)).to.eq(20000);
      expect(transfer).to.emit(spotPaymentFacetV1, "TransferSuccessEvent");
    });
  });
});
