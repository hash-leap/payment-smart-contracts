import "@nomicfoundation/hardhat-toolbox";
import { task, types } from "hardhat/config";
import * as SpotPaymentJson from "./../src/artifacts/contracts/facets/SpotPaymentFacetV1.sol/SpotPaymentFacetV1.json";
import { ethers } from "ethers";
import Config from "./../config";
import "./../scripts/dotenvConfig";

task("event-subscription", "Subscribe to events")
  .addOptionalParam(
    "address",
    "Address of the main/diamond contract",
    undefined,
    types.string
  )
  .setAction(async ({ address }, hre) => {
    return new Promise(() => {
      const networkName: string = hre.network.name;

      const provider = new ethers.providers.WebSocketProvider(
        (Config.wssUrl as Record<string, string>)[networkName]
      );

      const wallet = new ethers.Wallet(Config.privateKeys.deployer);
      console.log(`Connected to the wallet address ${wallet.address}`);

      const signer = wallet.connect(provider);
      const contractAddress =
        address ||
        (Config.contractAddresses.diamond as Record<string, string>)[
          networkName
        ];

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
          paymentType,
          blockNumber,
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
            paymentType,
            blockNumber,
          };
          console.log({ emittedEvent });
          console.log({ event });
        }
      );
    });
  });
