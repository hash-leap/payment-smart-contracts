import { ethers } from "hardhat";
import { getSelectors, FacetCutAction } from "./libraries/diamond";
import * as dotenv from "dotenv";
dotenv.config();

export async function deploySpotPaymentFacetV1() {
  const SpotPaymentFacetV1 = await ethers.getContractFactory(
    "SpotPaymentFacetV1"
  );
  const spotPaymentFacetV1 = await SpotPaymentFacetV1.deploy();
  await spotPaymentFacetV1.deployed();
  const diamondCutFacet = await ethers.getContractAt(
    "DiamondCutFacet",
    String(process.env.DIAMOND_ADDRESS)
  );

  const zeroAddress = ethers.constants.AddressZero;
  const tx = await diamondCutFacet.diamondCut(
    [
      {
        facetAddress: spotPaymentFacetV1.address,
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(spotPaymentFacetV1),
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
  console.log("SpotPaymentFacetV1 Deployed at: ", spotPaymentFacetV1.address);
  return spotPaymentFacetV1.address;
}

deploySpotPaymentFacetV1()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
