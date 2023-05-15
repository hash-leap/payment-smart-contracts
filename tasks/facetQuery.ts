import "@nomicfoundation/hardhat-toolbox";
import { task, types } from "hardhat/config";
import * as dotenv from "dotenv";
import * as DiamondLoupeFacetJson from "./../src/artifacts/contracts/facets/DiamondLoupeFacet.sol/DiamondLoupeFacet.json";
import { ethers } from "ethers";
dotenv.config();

import Config from "./../config";

// Task to inspect the diamond for contract addresses and function selectors
// USAGE:
// E.g.1 npx hardhat facet-query --network bsc_testnet
// E.g.2 npx hardhat facet-query --network bsc_testnet --option all
// E.g.3 npx hardhat facet-query --network bsc_testnet --option addresses
// E.g.4. npx hardhat --network bsc_testnet facet-query --option all --selector "crossChainTransfer(string,string,address,string,uint256)"  --facet 0xd9d13A65138Afd6439109F2134D78797f4ac2907

task("facet-query", "Query facets")
  .addOptionalParam(
    "selector",
    "expects a function selector",
    undefined,
    types.string
  )
  .addOptionalParam(
    "option",
    "select an option - all, addresses",
    undefined,
    types.string
  )
  .addOptionalParam(
    "facet",
    "expects a contract facet address",
    undefined,
    types.string
  )
  .setAction(async ({ selector, facet, option }, hre) => {
    const networkName = hre.network.name;

    const provider = new ethers.providers.JsonRpcProvider(
      (Config.rpcUrl as Record<string, string>)[networkName]
    );

    const wallet = new ethers.Wallet(Config.privateKeys.nonDeployer);
    console.log(`Connected to the wallet address ${wallet.address}`);
    const signer = wallet.connect(provider);

    const contractAddress = (
      Config.contractAddresses.diamond as Record<string, string>
    )[networkName];

    const contract = new ethers.Contract(
      contractAddress,
      DiamondLoupeFacetJson.abi,
      signer
    );

    let transaction;

    if (option === "all") {
      transaction = await contract.facets();
      console.log(
        "All Contract Facets and their funcions\n",
        transaction,
        "\n"
      );
    } else if (option === "addresses") {
      transaction = await contract.facetAddresses();
      console.log("All Contract Facet Addresses\n", transaction, "\n");
    }

    if (selector) {
      transaction = await contract.facetAddress(
        ethers.utils.id(selector).substring(0, 10)
      );

      console.log(`Contract Facet Address for ${selector}: ${transaction}\n`);
    }

    if (facet) {
      transaction = await contract.facetFunctionSelectors(facet);
      console.log(`Function selectors for: ${facet}\n`, transaction);
    }
  });
