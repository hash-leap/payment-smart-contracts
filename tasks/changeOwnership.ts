import "@nomicfoundation/hardhat-toolbox";
import { task, types } from "hardhat/config";
import * as OwnershipJson from "./../src/artifacts/contracts/facets/OwnershipFacet.sol/OwnershipFacet.json";
import { ethers } from "ethers";
import Config from "./../config";
import "./../scripts/dotenvConfig";

// USAGE:: This task is to do some temp checks on diamond
// Testnet
// npx hardhat change-ownership --network bsc_testnet --new-owner-address 0xnewOwnerAddress
// Mainnet
// SCRIPT_ENV=prod npx hardhat change-ownership --network bsc_testnet --new-owner-address 0xnewOwnerAddress
//

// TODO: ADD A COMMAND LINE CONFIRMATION
task("change-ownership", "Change Ownership")
  .addParam(
    "newOwnerAddress",
    "expects new owner address",
    undefined,
    types.string
  )
  .setAction(async ({ newOwnerAddress }, hre) => {
    // Always do a dry run locally or on testnet before running on mainnet
    // AND MAKE SURE YOU HAVE THE PRIVATE KEY / SEED PHRASE FOR THE NEW OWNER
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
      signer
    );

    let tx = await ownershipC.owner();
    console.log("Current Owner", tx);
    await transferOwner(ownershipC, newOwnerAddress);
  });

const transferOwner = async (
  ownershipC: ethers.Contract,
  newOwnerAddress: string
) => {
  /**
   * WARNING: MAKE SURE YOU UPDATE THE NEW OWNER CURRECTLY WHETHER ON MAINNET OR TESTNET
   */

  console.log("Starting Ownership transfer to ", newOwnerAddress);
  const tx = await ownershipC.transferOwnership(newOwnerAddress);
  await tx.wait();

  const txOwner = await ownershipC.owner();
  console.log("Updated Owner", txOwner);
};
