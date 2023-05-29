import "@nomicfoundation/hardhat-toolbox";
import { task, types } from "hardhat/config";
import * as dotenv from "dotenv";
import * as CrossChainPaymentJson from "./../src/artifacts/contracts/facets/CrossChainPaymentFacetV1.sol/CrossChainPaymentFacetV1.json";
import * as IERC20Json from "./../src/artifacts/contracts/interfaces/IERC20.sol/IERC20.json";
import { ethers } from "ethers";
dotenv.config();
import Config from "./../config";

// USAGE:: This task is to test manually if everything is working.
// For erc20
// npx hardhat simulate-cross-chain-payment --token-symbol USDC --source-chain binance --network bsc_testnet --target-chain avalanche --amount 2 --recipient 0x270Fe7cB0F0a98e4c9ABe1E2b1B82eB9aC848cDA --erc-20-contract-address 0x64544969ed7EBf5f083679233325356EbE738930
task("simulate-cross-chain-payment", "Simulate cross chain payment transaction")
  .addParam("sourceChain", "e.g. binance", undefined, types.string)
  .addParam("targetChain", "e.g. avalanche", undefined, types.string)
  .addParam(
    "amount",
    "Amount of tokens to be transferred",
    undefined,
    types.float
  )
  .addParam("tokenSymbol", "e.g. USDC", undefined, types.string)
  .addParam("recipient", "Address of recipient", undefined, types.string)
  .addParam(
    "erc20ContractAddress",
    "Stablecoin contract address",
    undefined,
    types.string
  )
  .setAction(
    async (
      {
        sourceChain,
        targetChain,
        amount,
        tokenSymbol,
        recipient,
        erc20ContractAddress,
      },
      hre
    ) => {
      const networkName = hre.network.name;

      const provider = new ethers.providers.JsonRpcProvider(
        (Config.rpcUrl as Record<string, string>)[networkName]
      );

      const wallet = new ethers.Wallet(Config.privateKeys.deployer);
      console.log(`Connected to the wallet address ${wallet.address}`);

      const signer = wallet.connect(provider);
      // const transferAmount = ethers.utils.parseUnits(String(amount));
      const contractAddress = (
        Config.contractAddresses.diamond as Record<string, string>
      )[networkName];

      const tokenContract = new ethers.Contract(
        erc20ContractAddress,
        IERC20Json.abi,
        signer
      );

      const t = await tokenContract.approve(contractAddress, amount * 2, {
        gasLimit: 800000,
      });
      console.log("Approval", await t.wait());

      let transaction;
      let receipt;

      const contract = new ethers.Contract(
        contractAddress,
        CrossChainPaymentJson.abi,
        signer
      );

      transaction = await contract.getAxelarContract("avalanche");
      // transaction = await contract.setAxelarContract(
      //   "binance",
      //   "0x4D147dCb984e6affEEC47e44293DA442580A3Ec0"
      // );
      // receipt = await transaction.wait();
      console.log(transaction);
      transaction = await contract.getAxelarContract("binance");
      console.log(transaction);

      transaction = await contract.transfer(
        sourceChain,
        targetChain,
        recipient,
        tokenSymbol,
        amount,
        erc20ContractAddress,
        {
          gasLimit: 800000,
        }
      );

      receipt = await transaction.wait();

      if (!receipt.status) {
        throw Error(`Transaction failed: ${transaction.hash}`);
      }
      console.log({ receipt });
      console.log("logs:", receipt.logs);
      console.log("events", receipt.events[0].args);
    }
  );
