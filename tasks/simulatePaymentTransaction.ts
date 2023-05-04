import "@nomicfoundation/hardhat-toolbox";
import { task, types } from "hardhat/config";
import * as dotenv from "dotenv";
import * as SpotPaymentJson from "./../src/artifacts/contracts/facets/SpotPaymentFacetV1.sol/SpotPaymentFacetV1.json";
import { MyTestERC20__factory } from "../typechain-types";
import { ethers } from "ethers";
dotenv.config();

import Config from "./../config";

// USAGE:: This task is to test manually if everything is working.
// For erc20
// npx hardhat simulate-payment --token-type 1 --network sepolia --amount 1 --token-address 0x6f14c02fc1f78322cfd7d707ab90f18bad3b54f5 --recipient 0x270Fe7cB0F0a98e4c9ABe1E2b1B82eB9aC848cDA
//
// For native token e.g. eth
// npx hardhat simulate-payment --token-type 0 --network sepolia --amount 0.1 --token-address 0x6f14c02fc1f78322cfd7d707ab90f18bad3b54f5 --recipient 0x270Fe7cB0F0a98e4c9ABe1E2b1B82eB9aC848cDA

task("simulate-payment", "Simulate a payment transaction")
  .addParam("tokenType", "0 For Native and 1 for ERC20", undefined, types.int)
  .addOptionalParam(
    "address",
    "Address of the main/diamond contract",
    undefined,
    types.string
  )
  .addParam(
    "amount",
    "Amount of tokens to be transferred",
    undefined,
    types.float
  )
  .addParam("tokenAddress", "Address of the sender", undefined, types.string)
  .addParam("recipient", "Address of recipient", undefined, types.string)
  .setAction(
    async ({ tokenType, address, amount, tokenAddress, recipient }, hre) => {
      const networkName = hre.network.name;

      const provider = new ethers.providers.JsonRpcProvider(
        (Config.rpcUrl as Record<string, string>)[networkName]
      );

      const wallet = new ethers.Wallet(Config.privateKeys.nonDeployer);
      console.log(`Connected to the wallet address ${wallet.address}`);

      const signer = wallet.connect(provider);
      const transferAmount = ethers.utils.parseUnits(String(amount));
      const contractAddress = address || String(process.env.DIAMOND_ADDRESS);

      const contract = new ethers.Contract(
        contractAddress,
        SpotPaymentJson.abi,
        signer
      );

      const tags = ["test2", "USDC", "Sad Panda"];
      const paymentRef = "#sc02";
      let transaction;

      if (tokenType == 1) {
        const contractFactory = new MyTestERC20__factory(signer);
        const stablecoinContract = await contractFactory.attach(tokenAddress);
        await stablecoinContract.approve(
          String(process.env.DIAMOND_ADDRESS),
          transferAmount.add("1")
        );

        transaction = await contract.transfer(
          recipient,
          tokenAddress,
          transferAmount,
          tokenType,
          tags,
          paymentRef
        );
      } else {
        transaction = await contract.transfer(
          recipient,
          ethers.constants.AddressZero,
          ethers.utils.parseUnits(String(amount), "ether"),
          tokenType,
          tags,
          paymentRef,
          {
            value: ethers.utils.parseUnits(String(amount), "ether"),
            gasLimit: 800000,
          }
        );
      }

      const receipt = await transaction.wait();

      if (!receipt.status) {
        throw Error(`Transaction failed: ${transaction.hash}`);
      }
      console.log({ receipt });
      console.log("logs:", receipt.logs);
      console.log("events", receipt.events[0].args);
    }
  );
