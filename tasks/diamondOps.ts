import "@nomicfoundation/hardhat-toolbox";
import { task, types } from "hardhat/config";
import * as dotenv from "dotenv";
import * as OwnershipJson from "./../src/artifacts/contracts/facets/OwnershipFacet.sol/OwnershipFacet.json";
import * as SpotPaymentJson from "./../src/artifacts/contracts/facets/SpotPaymentFacetV1.sol/SpotPaymentFacetV1.json";
import { ethers } from "ethers";
dotenv.config();
import Config from "./../config";

// USAGE:: This task is to do some temp checks on diamond
// npx hardhat diamond-ops --network bsc_testnet
task("diamond-ops", "Test diamond Ops").setAction(async ({}, hre) => {
  const networkName = hre.network.name;

  const provider = new ethers.providers.JsonRpcProvider(
    (Config.rpcUrl as Record<string, string>)[networkName]
  );

  const wallet = new ethers.Wallet(Config.privateKeys.deployer);
  console.log(`Connected to the wallet address ${wallet.address}`);

  const signer = wallet.connect(provider);
  const contractAddress = (
    Config.contractAddresses.diamond as Record<string, string>
  )[networkName];

  const ownershipC = new ethers.Contract(
    contractAddress,
    OwnershipJson.abi,
    // signer
    provider
  );

  const tx = await ownershipC.owner();
  console.log("Owner", tx);

  const spotPaymentC = new ethers.Contract(
    contractAddress,
    SpotPaymentJson.abi,
    signer
  );

  let tx1: any;
  // tx1 = await spotPaymentC.setTokenAddress(
  //   "USDC",
  //   "0x64544969ed7EBf5f083679233325356EbE738930"
  // );
  // await tx1.wait();
  tx1 = await spotPaymentC.getTokenAddress("USDC");
  console.log("Payment", tx1);
});
