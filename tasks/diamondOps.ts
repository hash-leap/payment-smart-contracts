import "@nomicfoundation/hardhat-toolbox";
import { task, types } from "hardhat/config";
import * as OwnershipJson from "./../src/artifacts/contracts/facets/OwnershipFacet.sol/OwnershipFacet.json";
import * as SpotPaymentJson from "./../src/artifacts/contracts/facets/SpotPaymentFacetV1.sol/SpotPaymentFacetV1.json";
import { ethers } from "ethers";
import Config from "./../config";
import "./../scripts/dotenvConfig";

// USAGE:: This task is to do some temp checks on diamond
// Testnet
// npx hardhat diamond-ops --network bsc_testnet --set-new-tokens false
// Mainnet
// SCRIPT_ENV=prod npx hardhat diamond-ops --network bsc_testnet --set-new-tokens false
//
task("diamond-ops", "Test diamond Ops")
  .addOptionalParam(
    "setNewTokens",
    "accepts true or false",
    undefined,
    types.boolean
  )
  .setAction(async ({ setNewTokens }, hre) => {
    const networkName = hre.network.name;

    const provider = new ethers.providers.JsonRpcProvider(
      (Config.rpcUrl as Record<string, string>)[networkName]
    );

    const wallet = new ethers.Wallet(Config.privateKeys.nonDeployer); // set this to deployer when setting onchain state
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

    const spotPaymentC = new ethers.Contract(
      contractAddress,
      SpotPaymentJson.abi,
      signer
    );

    if (setNewTokens) await addBscTokensforSpotPayment(spotPaymentC);

    const tokens = ["USDC", "USDT", "DAI", "BUSD"];
    for (const token of tokens) {
      tx = await spotPaymentC.getTokenAddress(token);
      console.log("Payment ", token, " ", tx);
    }
  });

const addBscTokensforSpotPayment = async (spotPaymentC: ethers.Contract) => {
  // BSC TESTNET
  // const tokens = [
  // ["USDC", "0x64544969ed7EBf5f083679233325356EbE738930"],
  // ["USDT", "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd"],
  // ["DAI", "0xEC5dCb5Dbf4B114C9d0F65BcCAb49EC54F6A0867"],
  // ["BUSD", "0xeD24FC36d5Ee211Ea25A80239Fb8C4Cfd80f12Ee"],
  // ];

  // BSC MAINNET
  // const tokens = [
  //   ["USDC", "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d"],
  //   ["USDT", "0x55d398326f99059fF775485246999027B3197955"],
  //   ["DAI", "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3"],
  //   ["BUSD", "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56"],
  // ];

  const tokens = [[]];
  let tx1: any;
  for (const token of tokens) {
    tx1 = await spotPaymentC.setTokenAddress(token[0], token[1]);
    await tx1.wait();
  }
};
