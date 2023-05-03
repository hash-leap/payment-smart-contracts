import "@nomiclabs/hardhat-etherscan";
import "@nomicfoundation/hardhat-toolbox";
import "solidity-coverage";
import { task, HardhatUserConfig } from "hardhat/config";
import * as dotenv from "dotenv";
dotenv.config();

import "./tasks/eventSubscription";
import "./tasks/simulatePaymentTransaction";

task("accounts", "Prints the list of accounts", async (_, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

task("account", "Prints the account at the index")
  .addParam("index", "Account index number")
  .setAction(async (taskArgs, hre) => {
    const accounts = await hre.ethers.getSigners();
    console.log(accounts[taskArgs.index].address);
  });

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.18",
    settings: {
      optimizer: {
        enabled: true,
        runs: 10000,
      },
    },
  },
  defaultNetwork: "localhost",
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v5",
  },
  networks: {
    hardhat: {},
    goerli: {
      url: process.env.GOERLI_RPC_URL,
      accounts: [String(process.env.ACCOUNT_PRIVATE_KEY)],
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL,
      accounts: [String(process.env.ACCOUNT_PRIVATE_KEY)],
    },
    mainnet: {
      url: process.env.MAINNET_RPC_URL,
      accounts: [String(process.env.ACCOUNT_PRIVATE_KEY)],
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_PRIVATE_KEY,
  },
  paths: {
    artifacts: "./src/artifacts",
    tests: "./tests",
  },
};

export default config;
