import "@nomicfoundation/hardhat-toolbox";
import { task, types } from "hardhat/config";
import * as dotenv from "dotenv";
import * as SpotPaymentJson from "./../src/artifacts/contracts/facets/SpotPaymentFacetV1.sol/SpotPaymentFacetV1.json";
import { ethers } from "ethers";
dotenv.config();

task("event-subscription", "Subscribe to events")
  .addOptionalParam(
    "address",
    "Address of the main/diamond contract",
    undefined,
    types.string
  )
  .setAction(async ({ address }, hre) => {
    return new Promise(() => {
      const networkName = hre.network.name;
      const apiKey = String(process.env.INFURA_API_KEY);
      const provider = new ethers.providers.InfuraWebSocketProvider(
        networkName,
        apiKey
      );
      const wallet = new ethers.Wallet(String(process.env.ACCOUNT_PRIVATE_KEY));
      console.log(`Connected to the wallet address ${wallet.address}`);

      const signer = wallet.connect(provider);
      const contractAddress = address || String(process.env.DIAMOND_ADDRESS);
      // contractAddress will change depending on the network, pass the diamond address via command line

      const contract = new ethers.Contract(
        contractAddress,
        SpotPaymentJson.abi,
        signer
      );

      contract.on(
        "TransferSuccess",
        (
          sender,
          recipient,
          tokenAddress,
          text,
          tags,
          amount,
          datetime,
          paymentRef,
          event
        ) => {
          const emittedEvent = {
            name: "TransferSuccess",
            sender,
            recipient,
            amount,
            tokenAddress,
            text,
            tags,
            datetime,
            paymentRef,
          };
          console.log({ emittedEvent });
          console.log(
            "Make an api request and probably log this in a service to kick off another event"
          );
          console.log({ event });
        }
      );
    });
  });
