import { ethers } from "hardhat";
import hre from "hardhat";
import { getSelectors, FacetCutAction } from "./libraries/diamond";
import * as dotenv from "dotenv";
dotenv.config();

import Config from "./../config";

export async function deploySubscriptionFacetV1() {
  const networkName = hre.network.name;

  const SubscriptionFacetV1 = await ethers.getContractFactory(
    "SubscriptionFacetV1"
  );
  const subscriptionFacetV1 = await SubscriptionFacetV1.deploy();
  await subscriptionFacetV1.deployed();
  const diamondCutFacet = await ethers.getContractAt(
    "DiamondCutFacet",
    (Config.contractAddresses.diamond as Record<string, string>)[networkName]
  );

  const zeroAddress = ethers.constants.AddressZero;
  const tx = await diamondCutFacet.diamondCut(
    [
      {
        facetAddress: subscriptionFacetV1.address,
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(subscriptionFacetV1),
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
  console.log("SubscriptionFacetV1 Deployed at: ", subscriptionFacetV1.address);
  return subscriptionFacetV1.address;
}

deploySubscriptionFacetV1()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
