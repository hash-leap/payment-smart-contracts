import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { expect } from "chai";
import { Contract } from "ethers";

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
    const myTestERC20Factory = await ethers.getContractFactory("MyTestERC20");
    myTestERC20 = await myTestERC20Factory.deploy();
    await myTestERC20.deployed();
  });

  it("should test function call", async () => {
    await myTestERC20.mint(signers[0].address, 200000);
    await myTestERC20.approve(spotPaymentFacetV1.address, 20000);

    await spotPaymentFacetV1.transfer(
      signers[0].address,
      signers[1].address,
      myTestERC20.address,
      20000
    );

    expect(await myTestERC20.balanceOf(signers[0].address)).to.eq(180000);
    expect(await myTestERC20.balanceOf(signers[1].address)).to.eq(20000);
  });

  it("should emit the TransferSuccessEvent", async () => {
    await myTestERC20.mint(signers[0].address, 200000);
    await myTestERC20.approve(spotPaymentFacetV1.address, 20000);

    await expect(
      spotPaymentFacetV1.transfer(
        signers[0].address,
        signers[1].address,
        myTestERC20.address,
        20000
      )
    ).to.emit(spotPaymentFacetV1, "TransferSuccessEvent");
  });
});
