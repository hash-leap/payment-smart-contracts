import { ethers } from "hardhat";
import hre from "hardhat";
import { getSelectors, FacetCutAction } from "./libraries/diamond";
import * as dotenv from "dotenv";
dotenv.config();

import Config from "./../config";

export async function deployCrossChainPaymentFacetV1() {
  const networkName = hre.network.name;

  const CrossChainPaymentFacetV1 = await ethers.getContractFactory(
    "CrossChainPaymentFacetV1"
  );
  const crossChainPaymentFacetV1 = await CrossChainPaymentFacetV1.deploy();
  await crossChainPaymentFacetV1.deployed();
  const diamondCutFacet = await ethers.getContractAt(
    "DiamondCutFacet",
    (Config.contractAddresses.diamond as Record<string, string>)[networkName]
  );

  const zeroAddress = ethers.constants.AddressZero;
  const tx = await diamondCutFacet.diamondCut(
    [
      {
        facetAddress: crossChainPaymentFacetV1.address,
        action: FacetCutAction.Replace,
        functionSelectors: getSelectors(crossChainPaymentFacetV1),
      },
    ],
    zeroAddress,
    [],
    { gasLimit: 800000 }
  );
  const receipt = await tx.wait();
  if (!receipt.status) {
    throw Error(`Diamond upgrade failed: ${tx.hash}`);
  }
  console.log(
    "CrossChainPaymentFacetV1 Deployed at: ",
    crossChainPaymentFacetV1.address
  );
  return crossChainPaymentFacetV1.address;
}

deployCrossChainPaymentFacetV1()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
