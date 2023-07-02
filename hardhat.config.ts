import "@nomicfoundation/hardhat-toolbox";
import { task, HardhatUserConfig } from "hardhat/config";
import * as dotenv from "dotenv";
dotenv.config();

import "./tasks/eventSubscription";
import "./tasks/simulatePaymentTransaction";
import "./tasks/simulateCrossChainTransaction";
import "./tasks/facetQuery";
import "./tasks/diamondOps";
import Config from "./config";

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

const accountKey = Config.privateKeys.deployer;
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.18",
    settings: {
      optimizer: {
        enabled: true,
        runs: 10000,
      },
      viaIR: true,
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
      url: Config.rpcUrl.goerli,
      accounts: [accountKey],
    },
    sepolia: {
      url: Config.rpcUrl.sepolia,
      accounts: [accountKey],
    },
    mainnet: {
      url: Config.rpcUrl.mainnet,
      accounts: [accountKey],
    },
    bsc_testnet: {
      url: Config.rpcUrl.bsc_testnet,
      accounts: [accountKey],
    },
  },
  // find all supported networks by:
  // npx hardhat verify --list-networks
  // https://hardhat.org/hardhat-runner/plugins/nomicfoundation-hardhat-verify#multiple-api-keys-and-alternative-block-explorers
  etherscan: {
    apiKey: {
      mainnet: Config.privateKeys.etherscan,
      sepolia: Config.privateKeys.etherscan,
      goerli: Config.privateKeys.etherscan,
      bsc: Config.privateKeys.bscscan,
      bscTestnet: Config.privateKeys.bscscan,
      // TODO: needs updating before going live on below chains
      polygon: Config.privateKeys.etherscan,
      polygonMumbai: Config.privateKeys.etherscan,
      arbitrumGoerli: Config.privateKeys.etherscan,
      arbitrumOne: Config.privateKeys.etherscan,
      avalanche: Config.privateKeys.etherscan,
      avalancheFujiTestnet: Config.privateKeys.etherscan,
      optimisticEthereum: Config.privateKeys.etherscan,
      optimisticGoerli: Config.privateKeys.etherscan,
      aurora: Config.privateKeys.etherscan,
      auroraTestnet: Config.privateKeys.etherscan,
    },
  },
  paths: {
    artifacts: "./src/artifacts",
    tests: "./tests",
  },
  gasReporter: {
    enabled: String(process.env.REPORT_GAS) == "1" ? true : false,
  },
};

export default config;
